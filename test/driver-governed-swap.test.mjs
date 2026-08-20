/* ── THE GOVERNED DRIVER SWAP, DRIVEN THROUGH THE REAL SCREEN ────────────────
 *
 * Attempts 1–4 were reverted. Every one of them passed its own tests, because
 * the tests were decorative on the exact claims they were named for: a reviewer
 * deleted the scan invalidation, hardcoded the audit id, and replaced the
 * engine's split with a hand-rolled SKU join, and 11/11 stayed green.
 *
 * So every test here was WATCHED TO FAIL under the mutation it names, and the
 * mutation is written next to it. Three rules were followed throughout:
 *
 *   · nothing is asserted by calling a function directly — the bug lives in the
 *     CALLER, so the caller is what is clicked;
 *   · no dollar figure is ever pinned. The ENGINE's own number — as filed in the
 *     audit record it produced — is compared against what the screen RENDERED;
 *   · a guard is only claimed once a mutation has made this file go red.
 *
 * ⚠️ `window.MTopBar` lives in `mobile/app.jsx`, which the harness deliberately
 * skips (it is the bootstrapper and would boot a second app). It is stubbed
 * below. Nothing under test is stubbed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Mount ONE screen on its OWN host node — app.mount() re-roots #root. */
function mounter(app) {
  const W = app.window;
  W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (taskId) => {
    close();
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.TaskScreen, { taskId }));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

/** Text inside the swap sheet only — the page carries a dev rail as well. */
const sheetText = (app) => {
  const el = app.window.document.querySelector('[data-hw-sheet="swap"]');
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
};
/** The close-out button — the screen's own rendering of what to collect. */
const closeOutBtn = (app) => app.buttons().find((b) => b.startsWith('Close out')) || '';
const closeOutEl = (app) => [...app.window.document.querySelectorAll('button')]
  .find((b) => (b.textContent || '').trim().startsWith('Close out'));

const inSheet = (label) => (t, el) => t === label && !!el.closest('[data-hw-sheet="swap"]');
const byTitle = (title) => (t, el) => el.getAttribute && el.getAttribute('title') === title;

const task = (W, id) => W.MD.TASKS.find((t) => t.id === id);
const basketSig = (W, id) => W.M.itemsFor(id, task(W, id).items).map((i) => i.sku + ':' + i.qty).join(',');

/** Open the sheet on one line, pick a ladder, choose a named candidate. */
async function pick(app, open, taskId, lineIdx, mode, productId) {
  await open(taskId);
  assert.ok(app.click('Swap', { nth: lineIdx }), `no Swap control on line ${lineIdx} of ${taskId}`);
  await app.settle();
  assert.ok(app.click(inSheet(mode)), `no "${mode}" ladder in the sheet`);
  await app.settle();
  assert.ok(app.click(byTitle('Swap to ' + productId)),
    `${productId} was not offered in ${mode}; the sheet showed: ${sheetText(app)}`);
  await app.settle();
}

/** Tick consent and commit. */
async function confirm(app) {
  assert.ok(app.click(inSheet('The customer agreed to this swap')), 'no consent control');
  await app.settle();
  assert.ok(app.click(inSheet('Confirm swap')), 'no confirm control');
  await app.settle();
}

// ── F2 · THE TAUTOLOGY ──────────────────────────────────────────────────────
//
// MUTATION WATCHED TO FAIL: in `governedFor`, derive the order's van from the
// session — `kitId: G.actorKitId(window.MD.DRIVER)` in place of `base.kitId`.
// Both sides then come from one value, `wrong_kit` can never fire, and the
// second half of this test (t8 refused) goes red immediately.
test('F2 — the order van and the actor van are independent, and the verdicts swap', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    const refusedWrongKit = async (taskId) => {
      await open(taskId);
      assert.ok(app.click('Swap', { nth: 0 }), `no Swap control on ${taskId}`);
      await app.settle();
      const txt = sheetText(app);
      assert.ok(txt, `the sheet did not open on ${taskId}`);
      return txt.includes('wrong_kit');
    };
    try {
      assert.equal(W.MD.DRIVER.regionId, 'RC-01', 'precondition: Jake is covering RC-01');
      assert.equal(task(W, 't1').kitId, 'RC-01');
      assert.equal(task(W, 't8').kitId, 'RC-03', 'precondition: t8 was re-assigned to another van');

      const t1AsRC01 = await refusedWrongKit('t1');
      const t8AsRC01 = await refusedWrongKit('t8');
      assert.equal(t1AsRC01, false, 'a driver must be able to work their own stop');
      assert.equal(t8AsRC01, true, "and must not be able to hand over another van's stock");

      // A different person picks up the phone. The STOPS do not move.
      W.MD.DRIVER.regionId = 'RC-03';
      const t1AsRC03 = await refusedWrongKit('t1');
      const t8AsRC03 = await refusedWrongKit('t8');
      assert.equal(t1AsRC03, true, 'RC-01 stop must now refuse');
      assert.equal(t8AsRC03, false, 'RC-03 stop must now allow');

      // Both verdicts moved, in OPPOSITE directions. One source cannot do this.
      assert.notEqual(t1AsRC01, t1AsRC03);
      assert.notEqual(t8AsRC01, t8AsRC03);
    } finally { open.close(); }
  });
});

// ── F5 · THE ENGINE REFUSES, NOT A DISABLED BUTTON ──────────────────────────
//
// MUTATIONS WATCHED TO FAIL, both:
//   (a) pass `attested: true` unconditionally in `commit` — the refusal never
//       appears and the first half goes red;
//   (b) put `disabled={!attested}` on the confirm PBtn — the tap never reaches
//       the engine, no refusal is rendered, and the same assertion goes red.
test('F5 — an unattested confirm is refused BY THE ENGINE, on screen, changing nothing', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      const before = basketSig(W, 't3');
      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');

      // Tap Confirm with no consent. The button must NOT be inert.
      assert.ok(app.click(inSheet('Confirm swap')), 'the confirm control must be reachable and enabled');
      await app.settle();

      const txt = sheetText(app);
      assert.ok(txt.includes('consent_required'),
        `the engine refusal must be on screen; sheet said: ${txt}`);
      assert.ok(txt.includes('Confirm the customer agreed to this swap'),
        "the engine's own message, not a local paraphrase");
      assert.equal(basketSig(W, 't3'), before, 'a refused swap must not touch the basket');
      assert.equal(W.HW.subRecords(task(W, 't3').order).length, 0,
        'a refused swap must not file an audit record');

      // Now attest, and the same tap goes through.
      await confirm(app);
      assert.notEqual(basketSig(W, 't3'), before, 'an attested swap must change the basket');
      assert.equal(W.HW.subRecords(task(W, 't3').order).length, 1);
    } finally { open.close(); }
  });
});

// ── F3 + F7 · ONE MONEY AUTHORITY, AND COD COLLECTS LESS ────────────────────
//
// MUTATIONS WATCHED TO FAIL:
//   (a) rebuild the basket with the old hand-rolled join
//       `items.map((it) => it.sku === sku ? { ...it, sku: c.product.sku } : it)`
//       instead of `result.order.lines` — the rendered total stops matching the
//       engine's on the partial case below;
//   (b) render `picked.settlement.label` for a COD stop — "Refund $2.17 in cash
//       at the door" appears on an order where nothing has been charged.
test('F3/F7 — the RENDERED total is the ENGINE figure, and a cheaper COD swap collects LESS', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    const open = mounter(app);
    try {
      await open('t3');
      const orderId = task(W, 't3').order;
      const beforeBtn = closeOutBtn(app);
      assert.ok(beforeBtn, 'the close-out button must render a figure');

      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');
      const confirmTxt = sheetText(app);
      // COD: nothing has been charged, so a cheaper swap reduces the collection.
      assert.ok(/nothing has been charged yet/i.test(confirmTxt),
        `the COD state must be stated; sheet said: ${confirmTxt}`);
      assert.ok(!/refund/i.test(confirmTxt),
        `no refund may be promised against a payment that never happened: ${confirmTxt}`);
      assert.ok(/ less than the /.test(confirmTxt), 'a cheaper swap must read as collecting less');

      await confirm(app);

      // The ENGINE's own figure, as it filed it. Not recomputed here.
      const rec = HW.subRecords(orderId)[0];
      assert.ok(rec, 'the swap must have filed a record to read the engine figure from');
      const engineTotal = HW.fmt.money(rec.money.newTotalCents / 100);
      const afterBtn = closeOutBtn(app);
      assert.ok(afterBtn.includes(engineTotal),
        `the screen collects ${afterBtn} while the engine priced ${engineTotal}`);
      assert.notEqual(afterBtn, beforeBtn, 'the total must actually move');
      assert.ok(rec.money.customerOwesDeltaCents < 0, 'precondition: this was the cheaper ladder');
    } finally { open.close(); }
  });
});

// ── F6 · THE RECORD IS FILED, OUTLIVES THE SCREEN, AND IS NEVER ONE ID ──────
//
// MUTATION WATCHED TO FAIL: replace `mintRecordId(...)` with a constant
// `'sub-1'`. `HW.addSubRecord` is idempotent by the engine's id, so the second
// swap files nothing and the count assertion goes red — which is exactly what
// attempt 3 shipped, from a component ref that reset to 0 on unmount.
test('F6 — every swap files ONE distinct engine record, and it outlives the screen', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    const open = mounter(app);
    try {
      const orderId = task(W, 't4').order;

      await pick(app, open, 't4', 2, 'cheaper', 'H480PRO1');
      await confirm(app);
      await pick(app, open, 't4', 1, 'cheaper', 'TMS1SUG');
      await confirm(app);

      const recs = HW.subRecords(orderId);
      assert.equal(recs.length, 2, 'two swaps, two audit rows');
      assert.equal(new Set(recs.map((r) => r.id)).size, 2, 'a shared id loses one of the two events');
      const moves = recs.map((r) => r.fromProductId + '>' + r.toProductId).sort().join('|');
      assert.equal(moves, 'ARCH001>H480PRO1|FCF1LRS>TMS1SUG',
        'the record must describe the swap that actually happened');
      for (const r of recs) {
        assert.equal(r.orderId, orderId);
        assert.equal(r.kitId, 'RC-01', "the record must name the van the order was routed to");
        assert.equal(r.consent.channel, 'driver_verbal', 'the attestation is what makes this an agreement');
      }

      // The screen goes away; the audit trail does not.
      open.close();
      await open('t4');
      assert.equal(HW.subRecords(orderId).length, 2, 'a record that dies with the screen is not an audit trail');
    } finally { open.close(); }
  });
});

// ── SCAN INVALIDATION ───────────────────────────────────────────────────────
//
// MUTATION WATCHED TO FAIL: delete the two `delete n[...]` lines in
// `onCommitted`. Swapping AWAY from a product and back again then leaves its old
// scan counts standing, and the stop reports itself verified without a re-scan.
//
// ⚠️ The round trip is the point. Swap once and the new sku is simply absent
// from `scanned`, so the line reads unverified whether the guard is there or
// not — a test that stopped there would pass against the mutation.
test('a swap invalidates that line\'s scans — including a swap back to what was scanned', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    /** Click each per-line Scan button until every unit is verified. */
    const scanEverything = async () => {
      for (let i = 0; i < 40; i++) {
        const hit = app.click((t) => t !== 'Scan all' && /^Scan\b/.test(t));
        if (!hit) break;
        await app.settle();
      }
    };
    try {
      await open('t3');
      await scanEverything();
      assert.ok(app.text().includes('All items scanned & verified'), 'the stop must reach verified');
      assert.equal(closeOutEl(app).disabled, false, 'a verified stop can close out');

      // Swap the line away…
      assert.ok(app.click('Swap', { nth: 1 }));
      await app.settle();
      assert.ok(app.click(inSheet('cheaper')));
      await app.settle();
      assert.ok(app.click(byTitle('Swap to MMG100E')));
      await app.settle();
      await confirm(app);
      assert.equal(basketSig(W, 't3').includes('MMG100E'), true);

      // …and back to the product that WAS scanned.
      assert.ok(app.click('Swap', { nth: 1 }));
      await app.settle();
      assert.ok(app.click(inSheet('stronger')));
      await app.settle();
      assert.ok(app.click(byTitle('Swap to DBL78MG')),
        `the round trip must be offered; sheet said: ${sheetText(app)}`);
      await app.settle();
      await confirm(app);

      assert.equal(basketSig(W, 't3'), 'NCO28SM:1,DBL78MG:2', 'precondition: we are back where we started');
      assert.ok(!app.text().includes('All items scanned & verified'),
        'the bag was re-packed; those scans no longer describe what is in it');
      assert.ok(app.text().includes('Scan all items to continue'));
      assert.equal(closeOutEl(app).disabled, true, 'an unverified stop must not be closeable');
    } finally { open.close(); }
  });
});

// ── THE VAN LEDGER, AND THE ENGINE'S SPLIT ──────────────────────────────────
//
// MUTATIONS WATCHED TO FAIL:
//   (a) drop the `VanLedger.apply(result.intents.inventory)` call — the third
//       stop is never short, no partial is ever offered, and the assertion that
//       SRO28SM is down to one unit goes red;
//   (b) rebuild the basket by SKU join instead of from `result.order.lines` —
//       the partial commit moves BOTH units instead of the one the van has, the
//       basket loses its remainder line and the rendered total stops matching
//       the engine's.
test('a unit promised at one stop is gone at the next, and a short van splits the line', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW, DD = W.DDATA;
    const open = mounter(app);
    try {
      const loaded = DD.REGION_STOCK['RC-01'].units.SRO28SM;
      assert.equal(loaded, 3, 'precondition: RC-01 was loaded with three of this sku');

      // Two earlier stops each take one unit of the same product.
      await pick(app, open, 't3', 0, 'cheaper', 'SRO28SM');
      await confirm(app);
      await pick(app, open, 't5', 1, 'cheaper', 'SRO28SM');
      await confirm(app);

      assert.equal(W.MVanLedger.remaining('RC-01', 'SRO28SM'), 1,
        'two units are promised away; one is left on the van');
      assert.equal(DD.REGION_STOCK['RC-01'].units.SRO28SM, loaded,
        'the LOAD SHEET must not be rewritten — what is left is loaded minus promised');

      // A third stop wants two of them. The van has one.
      await open('t7');
      const beforeBtn = closeOutBtn(app);
      assert.ok(app.click('Swap', { nth: 1 }));
      await app.settle();
      assert.ok(app.click(inSheet('cheaper')));
      await app.settle();
      assert.ok(sheetText(app).includes('Only 1 of 2 left on this van'),
        `the shortfall must be shown; sheet said: ${sheetText(app)}`);

      assert.ok(app.click(byTitle('Swap to SRO28SM')));
      await app.settle();
      await confirm(app);

      // The engine SPLIT the line: one unit moved, one stayed. A sku join would
      // have moved both — and the van does not have both.
      assert.equal(basketSig(W, 't7'), 'CHP1GPR:3,GBZ35RR:1,SRO28SM:1',
        'the basket must be the engine\'s updated order, rebuilt by position');
      const rec = HW.subRecords(task(W, 't7').order)[0];
      assert.equal(rec.quantity, 1, 'the record must say what actually moved, not what the line held');
      assert.ok(closeOutBtn(app).includes(HW.fmt.money(rec.money.newTotalCents / 100)),
        `the screen collects ${closeOutBtn(app)} while the engine priced ${HW.fmt.money(rec.money.newTotalCents / 100)}`);
      assert.notEqual(closeOutBtn(app), beforeBtn);
      assert.equal(W.MVanLedger.remaining('RC-01', 'SRO28SM'), 0, 'the last unit is now spoken for');
    } finally { open.close(); }
  });
});

// ── F4 · THE PROMOTION GATE SAYS SO WHEN IT CANNOT FIRE ─────────────────────
//
// Cycle one authored demo promotion rules inside a screen file to make this
// gate demonstrable, and the flag then announced a promotion the customer had
// never been given. No order in this estate carries an engine-shaped rule, so
// the honest rendering is to say the check has nothing to test.
test('F4 — with no engine-shaped promotion on the order, the sheet says so rather than inventing one', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      const order = W.HWGovern.buildOrder(task(W, 't3'), { kitId: 'RC-01', lines: task(W, 't3').items });
      assert.equal(order.appliedPromotionIds, undefined,
        'precondition: the estate attaches no promotion ids to an order');

      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');
      const txt = sheetText(app);
      assert.ok(txt.includes('No promotion is attached to this order'),
        `the gate must state that it cannot fire; sheet said: ${txt}`);
      assert.ok(!txt.includes('Promotion lost'), 'nothing may be announced as lost');
    } finally { open.close(); }
  });
});

// ── THE ROOT CAUSE OF ATTEMPT 4 · A BASKET BELONGS TO ITS STOP ──────────────
//
// The driver app had ONE cart slot for the whole app, and every reader did
//   M.s.cartTaskId === taskId && M.s.cart.length ? M.s.cart : base.items
// so opening ANY other stop silently reverted the first stop's basket to what
// the order shipped with — while the audit record and the van ledger survived.
// The van's stock stayed spent and the order asked for the original product
// again, so a unit could be over-allocated once per revisit.
//
// MUTATION WATCHED TO FAIL: put that expression back in place of
// `M.itemsFor(taskId, base.items)`.
test('a committed swap survives a visit to another stop — the basket is per stop', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    const open = mounter(app);
    try {
      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');
      await confirm(app);
      const swapped = basketSig(W, 't3');
      const collected = closeOutBtn(app);
      assert.ok(swapped.includes('MMG100E'));

      // The driver looks at the next stop — and that stop CLAIMS THE ONE CART
      // SLOT (`Add / edit` calls `M.startCart`). That claim is the whole bug:
      // it is what used to revert the first stop's basket. A test that merely
      // navigates away does not reproduce it, because the slot still holds the
      // first stop's contents.
      await open('t7');
      assert.ok(app.click('Add / edit'), 'the other stop must take the cart slot');
      await app.settle();
      assert.equal(W.M.s.cartTaskId, 't7', 'precondition: the single slot now belongs to the other stop');
      await open('t3');

      assert.equal(basketSig(W, 't3'), swapped,
        'the stop reverted to what it shipped with — the van stock stays spent while the order asks for the original product again');
      assert.equal(closeOutBtn(app), collected, 'and the driver would collect the pre-swap figure');
      const rec = HW.subRecords(task(W, 't3').order)[0];
      assert.ok(closeOutBtn(app).includes(HW.fmt.money(rec.money.newTotalCents / 100)),
        'the collected figure must still be the engine figure after leaving and returning');
    } finally { open.close(); }
  });
});

// ── A DOUBLE TAP IS ONE SWAP ────────────────────────────────────────────────
//
// FOUND BY THIS TEST, NOT BY REVIEW: two taps on Confirm before the sheet
// unmounted filed TWO audit records for one swap and debited the van twice —
// −4 units where the engine had moved 2. `setPicked(null)` cannot stop it,
// because state does not settle between two synchronous handler calls.
//
// ⚠️ NO `await` BETWEEN THE TWO CLICKS. Awaiting a re-render is exactly what
// rescues a double-fire bug and makes the test decorative.
//
// MUTATION WATCHED TO FAIL: remove the `committing` ref guard from `commit`.
test('two taps on Confirm are ONE swap — one record, one debit to the van', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');
      assert.ok(app.click(inSheet('The customer agreed to this swap')));
      await app.settle();

      const first = app.click(inSheet('Confirm swap'));
      const second = app.click(inSheet('Confirm swap'));
      await app.settle();
      assert.equal(first, true);
      assert.equal(second, true, 'precondition: the second tap really did reach a live handler');

      const recs = W.HW.subRecords(task(W, 't3').order);
      assert.equal(recs.length, 1, 'one swap, one audit row');
      assert.equal(W.MVanLedger.delta('RC-01', 'MMG100E'), -recs[0].quantity,
        'the van must be debited exactly what the engine moved');
      assert.equal(W.MVanLedger.delta('RC-01', 'DBL78MG'), recs[0].quantity,
        'and credited exactly what came off the order');
      assert.equal(basketSig(W, 't3'), 'NCO28SM:1,MMG100E:2');
    } finally { open.close(); }
  });
});

// ── SCANS BELONG TO ONE STOP ────────────────────────────────────────────────
//
// FOUND BY PROBING, NOT BY REVIEW, and it pre-dates the governed swap: the
// router renders this screen with a new taskId when the driver moves on, and
// React REUSES the component instance. `scanned` is component state keyed by
// SKU, so two stops carrying the same sku shared a count — t7, never touched,
// reported "3/5 units verified" after t2 was driven to verified. Two stops with
// matching baskets would have unlocked close-out on an unscanned bag.
//
// ⚠️ This must render into the SAME root, the way the router does. Unmounting
// between stops throws the state away and the bug cannot appear.
//
// MUTATION WATCHED TO FAIL: remove the `if (seenTask !== taskId)` reset block.
test('moving to the next stop does not carry the last stop\'s scans with it', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    const show = async (taskId) => {
      root.render(W.React.createElement(W.TaskScreen, { taskId }));
      await app.settle(); await app.settle();
    };
    try {
      // t2 and t7 both carry CHP1GPR ×3 — the same sku on two different stops.
      const shared = 'CHP1GPR';
      assert.ok(task(W, 't2').items.some((i) => i.sku === shared));
      assert.ok(task(W, 't7').items.some((i) => i.sku === shared));

      await show('t2');
      for (let i = 0; i < 40; i++) {
        if (!app.click((t) => t !== 'Scan all' && /^Scan\b/.test(t))) break;
        await app.settle();
      }
      assert.ok(app.text().includes('All items scanned & verified'), 'precondition: t2 reaches verified');

      await show('t7');
      const progress = (app.text().match(/Scan to verify · (\d+)\/(\d+) units/) || []);
      assert.ok(progress.length, `t7 must show a scan progress line; screen said: ${app.text().slice(0, 400)}`);
      assert.equal(progress[1], '0',
        `t7 was never scanned but claims ${progress[1]} of ${progress[2]} units already verified`);
      assert.equal(closeOutEl(app).disabled, true, 'an unscanned stop must not be closeable');
    } finally {
      try { root.unmount(); } catch { /* already gone */ }
      host.remove();
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * ROUND 6 — THE THREE GUARDS NO TEST CONSTRAINED
 *
 * Three reviewers returned RISKY on a GREEN suite: no behaviour bug, but three
 * load-bearing lines that could each be deleted with 10/10 still passing. Each
 * test below was written by applying the deletion FIRST, watching it stay
 * green, then writing the assertion that goes red. The mutation is named above
 * each one.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Mount CompleteScreen — the close-out — on its OWN host, and read only it. */
function closeOutMounter(app) {
  const W = app.window;
  W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (taskId) => {
    close();
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.CompleteScreen, { taskId }));
    cur = { root, host };
    await app.settle(); await app.settle();
    return (host.textContent || '').replace(/\s+/g, ' ').trim();
  };
  open.close = close;
  return open;
}

/** Click every per-line Scan control until the stop reports itself verified. */
async function scanEverything(app) {
  for (let i = 0; i < 60; i++) {
    if (!app.click((t) => t !== 'Scan all' && /^Scan\b/.test(t))) break;
    await app.settle();
  }
}

// ── GUARD 1 · THE LEGACY SLOT IS KEPT IN STEP, AND THE MONEY IS COLLECTED
//              ON THE SCREEN THAT READS IT ───────────────────────────────────
//
// MUTATION WATCHED TO FAIL: delete `window.M.startCart(taskId, next)` from
// `onCommitted` (screen-task.jsx:543).
//
// ⚠️ WHY THE OBVIOUS TEST DOES NOT CATCH IT. The sibling `setBasket(taskId,
// next)` on the line above makes the TASK screen look right, so every existing
// assertion — all of which read the task screen — stays green. The damage is
// one screen further on: `CompleteScreen` reads the LEGACY single cart slot
// (`M.s.cartTaskId === taskId && M.s.cart.length ? M.s.cart : base.items`), and
// that slot is only correct because `onCommitted` writes it.
//
// ⚠️ AND WHY THE SLOT MUST BE CLAIMED FIRST. With the slot empty, deleting the
// line leaves CompleteScreen falling through to `base.items` — still wrong, but
// the Close out button re-seeds the slot from `items` on the way in and hides
// it. `Add / edit` is the driver's real route to the shop screen and it claims
// the slot for this stop with the PRE-swap lines; the adopt effect at :503 then
// sees `legacySig !== itemsSig` on the next render and rewrites the per-stop
// basket FROM the stale slot. The swap is silently undone on both screens, and
// nothing re-seeds it because `items` is by then the pre-swap basket.
test('guard 1 — the close-out screen collects the ENGINE figure, not the pre-swap one', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    const open = mounter(app);
    const closeOut = closeOutMounter(app);
    try {
      const orderId = task(W, 't3').order;
      const shipped = task(W, 't3').items;
      const shippedTotal = HW.fmt.money(W.MD.cartTotals(shipped).total);

      // 1. The driver taps `Add / edit` and comes back. That is the one other
      //    legitimate editor of this basket, and it claims the legacy slot.
      await open('t3');
      assert.ok(app.click('Add / edit'), 'the shop hand-off must be reachable');
      await app.settle();
      assert.equal(W.M.s.cartTaskId, 't3',
        'precondition: the legacy single slot now belongs to this stop');
      assert.equal(W.M.s.cart.map((c) => c.sku + ':' + c.qty).join(','),
        shipped.map((c) => c.sku + ':' + c.qty).join(','),
        'precondition: and it holds the PRE-swap lines');

      // 2. A governed swap on the second line.
      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');
      await confirm(app);

      const rec = HW.subRecords(orderId)[0];
      assert.ok(rec, 'the swap must have filed a record to read the engine figure from');
      const engineTotal = HW.fmt.money(rec.money.newTotalCents / 100);
      assert.notEqual(engineTotal, shippedTotal,
        'precondition: the swap moved the money, so this test is able to fail');

      // 3. The driver verifies the re-packed bag and closes out — the real route
      //    to the money screen, `startCart` and all.
      await scanEverything(app);
      assert.ok(app.text().includes('All items scanned & verified'),
        `the re-packed stop must reach verified; screen said: ${app.text().slice(0, 400)}`);
      const btn = closeOutEl(app);
      assert.equal(btn.disabled, false, 'a verified stop can close out');
      assert.ok(app.click((t) => t.startsWith('Close out')), 'the close-out control must be reachable');
      await app.settle();

      // 4. THE MONEY. What the close-out screen asks the driver to collect must
      //    be the engine's own figure, as the engine filed it.
      const txt = await closeOut('t3');
      assert.ok(txt.includes('Collect ' + engineTotal + ' to finish'),
        `the close-out screen must ask for the engine figure ${engineTotal}; it said: ${txt.slice(0, 500)}`);
      assert.ok(!txt.includes('Collect ' + shippedTotal + ' to finish'),
        `the driver is being asked to collect the PRE-SWAP figure ${shippedTotal} on a bag that no longer contains that product`);
      assert.ok(txt.includes('Amount to collect' + engineTotal),
        `the collect line must agree with the button; it said: ${txt.slice(0, 500)}`);
    } finally { closeOut.close(); open.close(); }
  });
});

// ── GUARD 2 · THE AUDIT-ID NONCE, IN THE SHAPE THAT ACTUALLY COLLIDED ───────
//
// MUTATION WATCHED TO FAIL: reduce `mintRecordId` (screen-task.jsx:66) to
// `return 'sub-' + orderId + '-' + lineId;` — no timestamp, no sequence.
//
// ⚠️ F6 ABOVE DOES NOT CATCH THIS, and that is the whole point of writing it
// again. F6 swaps two DIFFERENT lines (l2 and l3), so an id that is merely
// stable PER LINE is still unique across them and 10/10 stay green. Attempt 3's
// real collision was THE SAME LINE swapped twice on separate visits: its minter
// was a component ref that reset to 0 on unmount, so visit two re-minted visit
// one's id.
//
// The consequence is not just a missing row. `addSubRecord` is idempotent by
// id, and `filed` is what gates `VanLedger.apply` — so a collided second swap
// files no audit row AND never hands the first product back to the van. The
// van stays short a unit it is actually still carrying, at every later stop.
test('guard 2 — the SAME line swapped twice across visits files two records, and the van settles', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    const open = mounter(app);
    try {
      const orderId = task(W, 't3').order;
      const shippedQty = task(W, 't3').items[1].qty;

      // Visit one — line 2 goes from what it shipped with to the cheaper option.
      await pick(app, open, 't3', 1, 'cheaper', 'MMG100E');
      await confirm(app);
      assert.equal(basketSig(W, 't3'), 'NCO28SM:1,MMG100E:2', 'precondition: line 2 moved');
      assert.equal(W.MVanLedger.delta('RC-01', 'MMG100E'), -shippedQty,
        'the van is down the units it just promised away');
      assert.equal(W.MVanLedger.delta('RC-01', 'DBL78MG'), shippedQty,
        'and holds back the units that came off the order');

      // The driver leaves this stop and works another one. The screen — and any
      // component-scoped counter inside it — goes away.
      await open('t7');
      assert.ok(app.text().includes('Bianca Reyes'), 'precondition: a different stop was really visited');

      // Visit two — THE SAME LINE, swapped again.
      await pick(app, open, 't3', 1, 'stronger', 'DBL78MG');
      await confirm(app);

      const recs = HW.subRecords(orderId);
      assert.equal(recs.length, 2,
        'the second swap on the same line filed NOTHING — its id collided with the first, and addSubRecord is idempotent by id');
      assert.equal(new Set(recs.map((r) => r.id)).size, 2,
        'two events on one line must not share one audit id');
      assert.equal(new Set(recs.map((r) => r.lineId)).size, 1,
        'precondition: this is the same line twice, which is the shape that collided');
      const moves = recs.map((r) => r.fromProductId + '>' + r.toProductId).sort().join('|');
      assert.equal(moves, 'DBL78MG>MMG100E|MMG100E>DBL78MG',
        'both directions of the round trip must be on the record');

      // THE MONEY SIDE OF THE SAME GUARD. `filed` gates the van ledger, so an
      // unfiled second swap leaves the van permanently short a unit it is
      // still physically carrying.
      assert.equal(basketSig(W, 't3'), 'NCO28SM:1,DBL78MG:2', 'the basket came back to what it shipped with');
      assert.equal(W.MVanLedger.delta('RC-01', 'MMG100E'), 0,
        'the cheaper units were handed back to the van and the ledger must say so');
      assert.equal(W.MVanLedger.delta('RC-01', 'DBL78MG'), 0,
        'and the original units are spoken for again — a round trip nets to zero');
    } finally { open.close(); }
  });
});

// ── GUARD 3 · A SHEET BELONGS TO THE STOP IT WAS OPENED AT ──────────────────
//
// MUTATIONS WATCHED TO FAIL, each ALONE and together:
//   (a) remove `key={taskId + ':' + swapIdx}` from MGovernedSwapSheet (:645);
//   (b) remove the `setSwapIdx(null); setScanning(false)` half of the per-stop
//       reset (:516);
//   (c) both — which is the one that costs money: the sheet stays mounted AND
//       keeps the candidate picked against the PREVIOUS customer's order, so
//       the very next tap on a Confirm the driver never re-read commits a swap
//       against the WRONG customer's order.
//
// ⚠️ THIS MUST RENDER INTO THE SAME ROOT, the way the router does. Unmounting
// between stops throws the state away and the bug cannot appear — which is
// exactly why nothing caught it.
test('guard 3 — a swap sheet opened at one stop is gone at the next, and cannot commit there', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    const show = async (taskId) => {
      root.render(W.React.createElement(W.TaskScreen, { taskId }));
      await app.settle(); await app.settle();
    };
    try {
      const kathy = task(W, 't3'), bianca = task(W, 't7');
      assert.notEqual(kathy.order, bianca.order, 'precondition: two stops, two customers, two orders');
      const biancaBefore = basketSig(W, 't7');

      // Kathy's stop: the sheet is opened, a candidate is picked and the
      // customer's consent is ticked. The driver is one tap from committing.
      await show('t3');
      assert.ok(app.click('Swap', { nth: 1 }), 'no Swap control on line 2 of t3');
      await app.settle();
      assert.ok(app.click(inSheet('cheaper')), 'no "cheaper" ladder in the sheet');
      await app.settle();
      assert.ok(app.click(byTitle('Swap to MMG100E')),
        `MMG100E was not offered; the sheet showed: ${sheetText(app)}`);
      await app.settle();
      assert.ok(app.click(inSheet('The customer agreed to this swap')), 'no consent control');
      await app.settle();
      assert.ok(sheetText(app).includes('Confirm swap'),
        'precondition: the sheet is armed and one tap from a commit');

      // The driver moves on without closing it. The ROUTER re-renders this
      // screen with the next stop's id; React reuses the instance.
      await show('t7');
      assert.ok(app.text().includes(bianca.name), 'precondition: the next customer is on screen');

      // 1. Nothing from the last customer may still be on screen.
      assert.equal(sheetText(app), '',
        `a swap sheet opened at ${kathy.name}'s stop is still mounted at ${bianca.name}'s`);

      // 2. And the tap that was one away must reach nothing at all.
      assert.equal(app.click(inSheet('Confirm swap')), false,
        'a live Confirm from the previous stop is still tappable at this one');
      await app.settle();

      // 3. THE MONEY. Neither order may have moved.
      assert.equal(HW.subRecords(bianca.order).length, 0,
        `a swap chosen for ${kathy.name} was committed against ${bianca.name}'s order`);
      assert.equal(HW.subRecords(kathy.order).length, 0,
        'nothing was ever confirmed at the first stop either');
      assert.equal(basketSig(W, 't7'), biancaBefore,
        "the next customer's basket was rewritten by a sheet they never saw");
      assert.equal(W.MVanLedger.delta('RC-01', 'MMG100E'), 0, 'and the van was never debited');
    } finally {
      try { root.unmount(); } catch { /* already gone */ }
      host.remove();
    }
  });
});

// ── GUARD 3, THE OTHER HALF · THE SCANNER OVERLAY IS PER STOP TOO ───────────
//
// MUTATION WATCHED TO FAIL: remove `setScanning(false)` from the per-stop reset
// (:516). The camera overlay opened at one stop stays up when the router moves
// on, now listing the NEXT customer's items — and because `setScanned({})` did
// run, it presents itself as a fresh scan of a bag the driver never opened.
test('guard 3b — the scanner overlay does not follow the driver to the next stop', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    const inScanner = () => /\d+\/\d+ units verified/.test(app.text());
    const show = async (taskId) => {
      root.render(W.React.createElement(W.TaskScreen, { taskId }));
      await app.settle(); await app.settle();
    };
    try {
      await show('t3');
      assert.ok(app.click('Scan all'), 'the scanner must be reachable');
      await app.settle();
      assert.ok(inScanner(), 'precondition: the camera overlay is up at this stop');

      await show('t7');
      assert.ok(app.text().includes(task(W, 't7').name), 'precondition: the next customer is on screen');
      assert.equal(inScanner(), false,
        "the camera opened at the last stop is still up, now counting the next customer's items");
    } finally {
      try { root.unmount(); } catch { /* already gone */ }
      host.remove();
    }
  });
});

// ── GUARD 3, THE THIRD FINDING · THE KEY IS REDUNDANT, AND THIS TEST SAYS SO
//
// 🔴 MUTATION THAT SURVIVES, REPORTED RATHER THAN PAPERED OVER: removing
// `key={taskId + ':' + swapIdx}` (:645) leaves this file GREEN, including this
// test. It is not for want of trying — the key is unreachable defence in depth,
// and here is the derivation, so the next reviewer does not spend the hour I did:
//
//   · the `taskId` half is masked by the per-stop reset at :516, which sets
//     `swapIdx` to null DURING RENDER. The sheet is unmounted before a render
//     with the new stop and the old sheet could ever commit — which is why the
//     test above dies on the reset and not on the key;
//   · the `swapIdx` half needs `swapIdx` to go from one line's index straight to
//     another's. It cannot. Every exit sets it to null first (:516 reset, :558
//     onCommitted, :645 onClose), so the sheet unmounts and its state dies with
//     it. The only control that could set a second index is another line's Swap
//     button, and while the sheet is open the scrim at :266 covers the screen —
//     a tap there hits `onClose`, it never reaches the button. This harness CAN
//     click through the scrim, and a test that did so would be asserting against
//     a transition no driver can produce.
//
// So the key is redundant TODAY, given the reset. It stops being redundant the
// moment anyone makes the sheet close without clearing `swapIdx` — which is why
// what is worth pinning is not the key but the INVARIANT it exists to protect,
// and that is what this test does.
//
// THE INVARIANT: consent belongs to the swap it was given for. The customer
// agreed to a swap on one product; that tick must not still be ticked when the
// driver opens a swap on a different one, or one tap files a record claiming
// `driver_verbal` consent for something the customer was never asked about —
// F5's guarantee, defeated from the other side. This test dies if closing and
// reopening the sheet ever stops resetting that state, whatever the mechanism.
//
// MUTATION WATCHED TO FAIL — and F5 SURVIVES IT, which is what makes this test
// worth its line count: hoist the consent tick out of the sheet instance, the
// same shape as attempt 3's minter —
//     let _lastAttested = false;                       // module scope
//     const [attested, setAttested] = React.useState(_lastAttested);
//     React.useEffect(() => { _lastAttested = attested; }, [attested]);
// F5 stays green (its first tap is still the first of the page, so the engine
// still refuses it) while this test goes red: the sheet reopens on line 2 with
// the tick already on, one tap commits, and the assertion reads back an empty
// sheet — because the swap went through and the sheet unmounted.

test('guard 3c — consent ticked on one line does not carry to the next line', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const HW = W.HW;
    const open = mounter(app);
    try {
      const orderId = task(W, 't3').order;

      // Line 1: the customer agrees to a swap… and the driver backs out of it.
      await pick(app, open, 't3', 0, 'cheaper', 'SRO28SM');
      assert.ok(app.click(inSheet('The customer agreed to this swap')), 'no consent control');
      await app.settle();
      assert.ok(app.click(inSheet('Back to options')), 'the step-2 back control must be reachable');
      await app.settle();
      assert.ok(app.click(inSheet('Cancel')), 'the sheet must be cancellable');
      await app.settle();
      assert.equal(sheetText(app), '', 'precondition: the sheet was closed, nothing committed');
      assert.equal(HW.subRecords(orderId).length, 0, 'precondition: nothing was committed on line 1');

      // Line 2: a DIFFERENT product. Nobody has agreed to anything about it.
      assert.ok(app.click('Swap', { nth: 1 }), 'no Swap control on line 2');
      await app.settle();
      assert.ok(app.click(inSheet('cheaper')), 'no "cheaper" ladder in the sheet');
      await app.settle();
      assert.ok(app.click(byTitle('Swap to MMG100E')),
        `MMG100E was not offered; the sheet showed: ${sheetText(app)}`);
      await app.settle();

      // ONE tap. It must reach the engine and be REFUSED, because this customer
      // has not agreed to THIS swap.
      const before = basketSig(W, 't3');
      assert.ok(app.click(inSheet('Confirm swap')), 'the confirm control must be reachable');
      await app.settle();

      const txt = sheetText(app);
      assert.ok(txt.includes('consent_required'),
        `a consent ticked for another product was still ticked here — the swap committed on one tap; sheet said: ${txt}`);
      assert.equal(HW.subRecords(orderId).length, 0,
        'an unagreed swap was filed as agreed — the record would claim driver_verbal consent the customer never gave');
      assert.equal(basketSig(W, 't3'), before, 'and the basket must not have moved');
      assert.equal(W.MVanLedger.delta('RC-01', 'MMG100E'), 0, 'nor the van');
    } finally { open.close(); }
  });
});
