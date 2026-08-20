/* ── THE RETURN / EXCHANGE / WARRANTY FLOW ───────────────────────────────────
 *
 * Two attempts at this were reverted. The first left `onClick={() => setDone(true)}`
 * and then rendered "$X credited to <name>'s wallet · receipt sent" having
 * written nothing at all. The second wrote money, and wrote it wrong in four
 * separate ways — a wallet went 0 -> 18.48 -> 36.96 for ONE purchase.
 *
 * So every test here drives the real screen through real clicks and then asks
 * the ORDER BOOK and the MEMBER RECORD what actually happened. None of them
 * assert on a dollar figure I worked out myself: the app's own `order.total`
 * (which IS priceOrderMoney's `grand`) and wallet deltas are the only money
 * these tests know about.
 *
 * ⚠️ Each mounts OrderDetails on its OWN host node. app.mount() re-roots #root
 * and throws React into "Should not already be working", which poisons LATER
 * tests rather than failing the one at fault.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (id) => {
    close();
    const rec = W.HW.orderById(id);
    assert.ok(rec, `${id} is not in the order book`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: rec, onClose() {} }));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

/** Real catalogue products — the panel joins lines back to HW.PRODUCTS by name. */
const prod = (HW, n) => {
  const p = HW.PRODUCTS.filter((x) => x.active)[n];
  assert.ok(p, `the catalogue must hold at least ${n + 1} active products`);
  return p;
};
const line = (p, qty, price) => ({ name: p.name, brand: p.brand, cat: p.cat, qty,
  price: price == null ? p.price : price, total: +((price == null ? p.price : price) * qty).toFixed(2) });

/** A COMPLETED order — the return block is gated to orders out of fulfillment. */
const mkOrder = (HW, { name, lines, memberId, credits }) => {
  const r = HW.addOrder({ name, items: lines.length, stage: 'done', pay: 'Card', source: 'Stilo', lines });
  const patch = {};
  if (memberId) patch.memberId = memberId;
  if (credits) patch.credits = credits;
  if (Object.keys(patch).length) HW.updateOrder(r.id, patch);
  return r.id;
};

const walletOf = (HW, id) => +HW.memberById(id).wallet;
/** What the order actually collected. `total` is 0 until the panel's own effect
 *  commits the money record, so this opens the panel once and then reads it —
 *  never a figure this test worked out for itself. */
const collected = async (app, open, id) => { await open(id); return HW_total(app, id); };
const HW_total = (app, id) => +app.window.HW.orderById(id).total;
const returnsOf = (HW, id) => (HW.orderById(id).returns || []).length;

/** Click the Nth item row in the panel. The rows are divs; while they are
 *  pickable they carry data-hw-i, which is the only reason they are reachable. */
const pickRow = (app, i) => app.click((t, el) => el.getAttribute('data-hw-line') === String(i)
  && el.getAttribute('data-hw-i') === 'return-line');
const creditBtn = (t) => /^Credit \$[\d,.]+ to wallet$/.test(t);

/** Open → start → pick row(s) → reason. Leaves the commit button on screen. */
async function stage(app, open, id, rows, reason) {
  await open(id);
  assert.ok(app.click((t) => /^Start a return \/ exchange \/ warranty/.test(t)),
    `the return flow must be reachable; saw: ${app.buttons().join(' | ').slice(0, 400)}`);
  await app.settle();
  for (const i of rows) assert.ok(pickRow(app, i), `item row ${i} must be selectable`);
  await app.settle();
  assert.ok(app.click(reason), `the reason "${reason}" must be offerable`);
  await app.settle();
}

test('the commit button writes money — a wallet and a return record, not just a banner', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Rey Alvarez', member: true });
    const id = mkOrder(HW, { name: m.name, memberId: m.id, lines: [line(prod(HW, 0), 1)] });
    try {
      const before = walletOf(HW, m.id);
      await stage(app, open, id, [0], 'Wrong item');
      assert.ok(app.click(creditBtn), `the commit button must be on screen; saw: ${app.buttons().join(' | ').slice(0, 400)}`);
      await app.settle();

      assert.ok(walletOf(HW, m.id) > before,
        `the button rendered a credit and wrote nothing: wallet stayed at ${before}`);
      assert.equal(returnsOf(HW, id), 1, 'the return must be filed on the order record, not in component state');
      const rec = HW.orderById(id).returns[0];
      assert.equal(rec.memberId, m.id, 'the return must name the member it paid');
      assert.equal(+(walletOf(HW, m.id) - before).toFixed(2), +rec.amount.toFixed(2),
        'the wallet moved by a different amount than the return says it paid');
      // There is no mailer in this estate.
      assert.ok(!app.text().includes('receipt sent'),
        'the panel claimed a receipt was sent; nothing in this estate sends one');
    } finally { open.close(); }
  });
});

test('a ticket with no member id refuses, and never credits whoever shares the name', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    // TWO real members share the name on the ticket. This is the whole trap: the
    // reverted attempt did MEMBERS.find(m => m.name === o.name) under a comment
    // claiming it refused to do exactly that.
    //
    // ⚠️ ORDER MATTERS AND IT IS THE POINT. HW.addMember UNSHIFTS, so the LAST
    // one added is the one a name lookup finds first. `real` is added first and
    // `twin` second, so a name lookup returns TWIN — the wrong person — and the
    // assertions below can tell the two apart. My first draft added them the
    // other way round and the name lookup happened to land on the right member,
    // which made this test pass against code that resolves by name.
    const real = HW.addMember({ name: 'Casey Lindqvist', member: true });
    const twin = HW.addMember({ name: 'Casey Lindqvist', member: true });
    assert.notEqual(real.id, twin.id);
    assert.equal(HW.MEMBERS.find((x) => x.name === 'Casey Lindqvist').id, twin.id,
      'the decoy must be the one a name lookup would find, or this test proves nothing');
    const id = mkOrder(HW, { name: 'Casey Lindqvist', lines: [line(prod(HW, 0), 1)] });   // no memberId
    try {
      const before = walletOf(HW, twin.id), realBefore0 = walletOf(HW, real.id);
      await stage(app, open, id, [0], 'Wrong item');

      assert.equal(app.click(creditBtn), false,
        'a commit button was offered on an order with no member id — there is no wallet it could pay');
      await app.settle();
      const txt = app.text();
      assert.ok(/no member id/i.test(txt) && /nothing has been credited/i.test(txt),
        `the refusal must name what did not happen and why; saw: ${txt.slice(-400)}`);
      assert.equal(walletOf(HW, twin.id), before,
        'the wallet of the customer who merely shares the name on the ticket was credited');
      assert.equal(returnsOf(HW, id), 0, 'a refused return must file nothing');
      assert.equal(walletOf(HW, real.id), realBefore0, 'nobody was credited for a walk-in ticket');

      // The other half of the same rule: when the order DOES carry an id, the
      // id wins over a name that matches somebody else. Without this, the
      // refusal above is satisfied by a guard on `o.memberId` alone while the
      // resolution underneath it is still a name lookup.
      const idB = mkOrder(HW, { name: 'Casey Lindqvist', memberId: real.id, lines: [line(prod(HW, 0), 1)] });
      const twinBefore = walletOf(HW, twin.id), realBefore = walletOf(HW, real.id);
      await stage(app, open, idB, [0], 'Wrong item');
      assert.ok(app.click(creditBtn), 'an order carrying a member id must commit');
      await app.settle();
      assert.ok(walletOf(HW, real.id) > realBefore,
        'the member the order actually names was not credited');
      assert.equal(walletOf(HW, twin.id), twinBefore,
        'the credit landed on the first member sharing the name rather than the one the order names');
      assert.equal(HW.orderById(idB).returns[0].memberId, real.id,
        'the filed return names the wrong member');
    } finally { open.close(); }
  });
});

test('one product on two lines: the dearer line pays its own rate, and each line bounds itself', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Ines Duarte', member: true });
    const p = prod(HW, 0);
    // SAME product, two lines, different per-unit gross — the exact shape that
    // sent a claim filed against the dearer line to the cheaper one.
    const id = mkOrder(HW, { name: m.name, memberId: m.id, lines: [line(p, 1, 10), line(p, 1, 30)] });
    try {
      const grand = await collected(app, open, id);
      const w0 = walletOf(HW, m.id);

      await stage(app, open, id, [1], 'Wrong item');           // the DEARER line
      assert.ok(app.click(creditBtn), 'the commit button must be on screen for the dearer line');
      await app.settle();
      const dear = +(walletOf(HW, m.id) - w0).toFixed(2);

      // Reopening is where the second attempt let the same purchase be paid
      // again. Here it must let the OTHER line — and only the other line — go.
      const w1 = walletOf(HW, m.id);
      await stage(app, open, id, [0], 'Wrong item');           // the CHEAPER line
      assert.ok(app.click(creditBtn), 'the second, cheaper line must still be returnable');
      await app.settle();
      const cheap = +(walletOf(HW, m.id) - w1).toFixed(2);

      assert.ok(dear > cheap,
        `the dearer line paid ${dear} and the cheaper one ${cheap} — a claim was attributed to the wrong line`);
      assert.equal(returnsOf(HW, id), 2, 'two returns were filed against two lines');
      const ids = HW.orderById(id).returns.map((r) => r.id);
      assert.equal(new Set(ids).size, 2, `two returns must not share one id: ${ids.join(', ')}`);
      // Returning every unit gives back what the order collected — no more.
      assert.ok(dear + cheap <= grand + 0.02,
        `returning both lines paid ${(dear + cheap).toFixed(2)} against a collected ${grand}`);
      assert.ok(dear + cheap >= grand - 0.02,
        `returning both lines paid only ${(dear + cheap).toFixed(2)} of a collected ${grand}`);
    } finally { open.close(); }
  });
});

test('a credit settled at the drawer is not handed back a second time', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const p0 = prod(HW, 0), p1 = prod(HW, 1);
    const plainM = HW.addMember({ name: 'No Credit Buyer', member: true });
    const credM = HW.addMember({ name: 'Wallet Credit Buyer', member: true });
    // Identical baskets. Two lines, and only ONE of them is returned, so the
    // order-level cap cannot be what makes the two differ — a clamp that
    // rescues the assertion is the trap this whole file exists to avoid.
    const lines = () => [line(p0, 1, 20), line(p1, 1, 20)];
    const plain = mkOrder(HW, { name: plainM.name, memberId: plainM.id, lines: lines() });
    const cred = mkOrder(HW, { name: credM.name, memberId: credM.id, lines: lines(), credits: 10 });
    try {
      const plainGrand = await collected(app, open, plain);
      const credGrand = await collected(app, open, cred);
      assert.equal(+(plainGrand - credGrand).toFixed(2), 10,
        'the two orders must differ by exactly the credit settled at the drawer');

      const a0 = walletOf(HW, plainM.id);
      await stage(app, open, plain, [0], 'Wrong item');
      assert.ok(app.click(creditBtn), 'the plain order must commit');
      await app.settle();
      const paidPlain = +(walletOf(HW, plainM.id) - a0).toFixed(2);

      const b0 = walletOf(HW, credM.id);
      await stage(app, open, cred, [0], 'Wrong item');
      assert.ok(app.click(creditBtn), 'the credited order must commit');
      await app.settle();
      const paidCred = +(walletOf(HW, credM.id) - b0).toFixed(2);

      assert.ok(paidPlain > 0 && paidCred > 0, 'both returns must actually pay something');
      // Neither is near the cap, so nothing downstream is clamping these.
      assert.ok(paidPlain < plainGrand - 0.5 && paidCred < credGrand - 0.5,
        `a single line of two came out at the order cap — the clamp, not the split, is doing the work`);
      assert.ok(paidCred < paidPlain - 0.01,
        `the credited order gave back ${paidCred} and the uncredited one ${paidPlain}: `
        + 'wallet credit settled at the drawer was handed back a second time');
    } finally { open.close(); }
  });
});

test('closing and reopening the panel cannot credit the same purchase again', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Rasha Odeh', member: true });
    const id = mkOrder(HW, { name: m.name, memberId: m.id, lines: [line(prod(HW, 0), 1)] });
    try {
      const grand = await collected(app, open, id);
      const before = walletOf(HW, m.id);
      await stage(app, open, id, [0], 'Wrong item');
      assert.ok(app.click(creditBtn), 'the first return must commit');
      await app.settle();
      const after = walletOf(HW, m.id);
      assert.ok(after > before, 'the first return must actually pay');

      // Reopen — a fresh component, `done` back to false. Only the record can
      // stop this, and the record is the point.
      await open(id);
      assert.ok(/Already returned on this order/.test(app.text()),
        'a reopened panel must show what has already gone back');
      // The one unit on the one line is gone, so nothing on it is selectable.
      assert.equal(pickRow(app, 0), false,
        'a fully-returned line was still selectable on a reopened panel');
      assert.equal(app.click(creditBtn), false, 'a second commit button was offered');

      assert.equal(walletOf(HW, m.id), after,
        `the wallet moved again on a reopened panel: ${before} -> ${after} -> ${walletOf(HW, m.id)}`);
      assert.equal(returnsOf(HW, id), 1, 'a second return was filed for one purchase');
      assert.ok(+(walletOf(HW, m.id) - before).toFixed(2) <= grand + 0.02,
        'more was given back than the order ever collected');
    } finally { open.close(); }
  });
});

test('the record is re-read at commit time, so a return filed since the render cannot be paid twice', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Ola Bergqvist', member: true });
    // TWO lines, and the prior return exhausts only ONE of them. The order
    // still has plenty left to give back, so the order-level cap cannot be what
    // refuses this — it has to be the per-line bound, checked against the book.
    const id = mkOrder(HW, { name: m.name, memberId: m.id, lines: [line(prod(HW, 0), 1, 20), line(prod(HW, 1), 1, 20)] });
    try {
      await stage(app, open, id, [0], 'Wrong item');
      const before = walletOf(HW, m.id);
      const rec = HW.orderById(id);

      // ⚠️ WRITTEN WITHOUT NOTIFYING, ON PURPOSE. HW.updateOrder notifies, the
      // panel re-renders, and a re-render hands the button a FRESH closure —
      // which would rescue a handler that trusts its render-time values and
      // make this test decorative. Mutating in place is what the second half of
      // a double-fire actually looks like to a handler that has not re-rendered:
      // the record has moved, this render has not.
      //
      // The key comes from the screen's own lineKey (published as
      // window.orderLineKey) — a hand-rolled copy here would drift and the test
      // would end up agreeing with itself.
      rec.returns = [{ id: 'RET-' + id + '-1', at: Date.now(), memberId: m.id, member: m.name,
        amount: 1, units: 1, reason: 'Wrong item', by: 'another till',
        lines: [{ key: app.window.orderLineKey(rec.lines[0], 0), idx: 0, name: rec.lines[0].name, qty: 1, unit: 1 }] }];

      assert.ok(app.click(creditBtn), 'the commit button is still on screen from the earlier render');
      await app.settle();

      assert.equal(walletOf(HW, m.id), before,
        'the handler paid out against its own stale render instead of re-reading the order book');
      assert.equal(returnsOf(HW, id), 1, 'a second return was filed on top of one already on the record');
      assert.ok(/only 0 of that line/i.test(app.text()),
        `the refusal must name the line that is exhausted; saw: ${app.text().slice(-500)}`);
    } finally { open.close(); }
  });
});

test('one exhausted line does not close the rest of the order, and cannot be picked again', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Yusuf Kaya', member: true });
    const id = mkOrder(HW, { name: m.name, memberId: m.id, lines: [line(prod(HW, 0), 1, 20), line(prod(HW, 1), 1, 20)] });
    try {
      const grand = await collected(app, open, id);
      const start0 = walletOf(HW, m.id);
      await stage(app, open, id, [0], 'Wrong item');
      assert.ok(app.click(creditBtn), 'the first line must commit');
      await app.settle();
      const paid1 = +(walletOf(HW, m.id) - start0).toFixed(2);
      assert.ok(paid1 > 0 && paid1 < grand - 0.5, `one line of two must pay part of ${grand}, not ${paid1}`);

      // Reopen. The order is NOT finished — line 1 is untouched — so the flow
      // must still be offered, and it must let exactly one line through.
      await open(id);
      assert.ok(app.click((t) => /^Start a return \/ exchange \/ warranty/.test(t)),
        'an order with one line still unreturned must still offer the flow');
      await app.settle();
      assert.equal(pickRow(app, 0), false, 'the exhausted line was offered for return a second time');
      assert.ok(pickRow(app, 1), 'the untouched line must still be returnable');
      await app.settle();
      assert.ok(app.click('Wrong item'));
      await app.settle();
      const start1 = walletOf(HW, m.id);
      assert.ok(app.click(creditBtn), 'the untouched line must commit');
      await app.settle();
      const paid2 = +(walletOf(HW, m.id) - start1).toFixed(2);

      assert.ok(paid2 > 0, 'the second line paid nothing');
      assert.equal(returnsOf(HW, id), 2, 'two lines, two returns');
      assert.ok(paid1 + paid2 <= grand + 0.02,
        `the two lines together paid ${(paid1 + paid2).toFixed(2)} against a collected ${grand}`);
    } finally { open.close(); }
  });
});

test('two commit clicks in one go file one return, not two', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Dele Okonkwo', member: true });
    // qty 4 on one line, one unit selected — so the LINE bound is nowhere near
    // being hit and cannot be what refuses the second click.
    const id = mkOrder(HW, { name: m.name, memberId: m.id, lines: [line(prod(HW, 0), 4)] });
    try {
      await stage(app, open, id, [0], 'Wrong item');
      const before = walletOf(HW, m.id);
      const btn = [...app.document.querySelectorAll('[data-hw-i]')]
        .find((el) => creditBtn((el.textContent || '').trim()));
      assert.ok(btn, 'the commit button must be on screen');
      const fire = () => btn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      fire(); fire();
      await app.settle();

      assert.equal(returnsOf(HW, id), 1,
        `two clicks filed ${returnsOf(HW, id)} returns for one claim`);
      const paid = +(walletOf(HW, m.id) - before).toFixed(2);
      assert.equal(paid, +HW.orderById(id).returns[0].amount.toFixed(2),
        `the wallet took ${paid} for a single filed return of ${HW.orderById(id).returns[0].amount}`);
    } finally { open.close(); }
  });
});

test('the edit panel does not promise a wallet credit that nothing writes', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const m = HW.addMember({ name: 'Edit Copy Probe', member: true });
    // Still in fulfillment — that is the only state the edit panel opens in.
    const r = HW.addOrder({ name: m.name, items: 1, stage: 'verify', pay: 'Card', source: 'Stilo',
      lines: [line(prod(HW, 0), 2)] });
    HW.updateOrder(r.id, { memberId: m.id });
    try {
      const before = walletOf(HW, m.id);
      await open(r.id);
      assert.ok(app.click('Edit order'), 'the edit panel must open');
      await app.settle();
      // Step the only line down — that is the refund-shaped edit.
      assert.ok(app.click((t, el) => el.getAttribute('aria-label') === 'Decrease' || t === '−' || t === '-'),
        `a quantity stepper must be reachable; saw: ${app.buttons().join(' | ').slice(0, 300)}`);
      await app.settle();
      const txt = app.text();
      assert.ok(/Refund owed to the customer/.test(txt),
        `the lower-total notice must name what is actually owed; saw: ${txt.slice(0, 600)}`);
      assert.ok(!/credited to wallet/i.test(txt) && !/Applied automatically on save/i.test(txt),
        'the edit panel still promises an automatic wallet credit; no code writes one');
      assert.equal(walletOf(HW, m.id), before, 'editing an order must not move a wallet');
    } finally { open.close(); }
  });
});
