/* ── THE TILL WRITES THE MONEY RECORD ────────────────────────────────────────
 *
 * The refuter: two open tickets, "Pay all", a $5 reward taken at the drawer.
 * The drawer says Collected $67.70 and the two orders it writes add up to
 * $67.70 — correct AT THE INSTANT OF THE WRITE, and correct for a reason
 * nobody chose. recordTicket filed `total: collected` with `credits` and
 * `grossTotal` as loose fields and NO money record, so the first time anyone
 * opened one of those orders, commitOrderMoney RE-SEEDED its money from the
 * lines: a rung-up sale re-derived by the function whose job is to invent money
 * for demo records. It happened to land on the same figure. "Happens to agree"
 * is not a money authority.
 *
 * These assert INVARIANTS, never a dollar figure worked out here:
 *   · what the orders say was collected == what the drawer says was collected
 *   · and it is STILL true after every one of those orders has been opened
 *   · the record carries its own money the moment it is written, and the panel
 *     does not replace it
 *   · what came off the sale is recorded as what it WAS — a promo code is a
 *     promo, not an anonymous discount with the promo's name on it
 *
 * ⚠️ OrderDetails needs { o, onClose } and its OWN host node — app.mount()
 * re-roots #root, and a second root on one container throws React into "Should
 * not already be working", which poisons LATER tests instead of failing this
 * one. ⚠️ Values off app.window are jsdom-realm, so these compare primitives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── mounting an order panel beside the register ─────────────────────────── */

/** Mount OrderDetails on its own host. `panel.text()` is scoped to that host,
 *  so the register's own footer cannot be mistaken for the panel's totals. */
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
    return { text: () => (host.textContent || '').replace(/\s+/g, ' ').trim() };
  };
  open.close = close;
  return open;
}

/* ── driving the register ────────────────────────────────────────────────── */

const money = (t, label) => {
  const m = t.match(new RegExp(label + '\\s*\\$([\\d,]+\\.\\d\\d)'));
  return m ? Number(m[1].replace(/,/g, '')) : null;
};
const clickStarts = (app, prefix, within) =>
  app.click((t, el) => t.startsWith(prefix) && (!within || !!el.closest(within)));

/** Open a separate ticket for the first guest and put a product on it. */
async function openSecondTicket(app) {
  assert.ok(clickStarts(app, 'Party'), `no Party button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click('Ticket'), `no "Ticket" button in the party panel — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.match(app.text(), /Separate ticket opened/, 'the second ticket was not opened');
  assert.ok(app.click('Add'), `no product Add button — buttons: ${app.buttons().slice(0, 12).join(' | ')}`);
  await app.settle();
}

/** Take cash to the receipt. Returns what the DRAWER says it collected. */
async function tenderCashToReceipt(app, due) {
  assert.ok(app.click((t) => t.startsWith('Cash')), `no Cash tile — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  const quick = '$' + Math.ceil(due).toFixed(2);
  assert.ok(app.click(quick), `no quick-cash ${quick} — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(clickStarts(app, 'Complete'), `no Complete button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.match(app.text(), /Payment complete/, 'the receipt stage never rendered — the money was not taken');
  const collected = money(app.text(), 'Collected');
  assert.ok(collected > 0, `the receipt shows no Collected figure: ${app.text().slice(0, 400)}`);
  return collected;
}

/**
 * The bottom line of the panel's totals block, whatever it is called there.
 *
 * The label moves with the order — 'Total' on a plain sale, 'Collected' once a
 * credit was taken against it, 'Left to pay' while it is still open — so
 * pinning one of them tests the wording rather than the money. This takes the
 * LAST of them, which is the strong row under the tax lines. 'Order total' and
 * 'Total settled' do not match: the amount has to sit directly against the
 * label, and those two do not.
 */
function bottomLine(t) {
  const all = [...t.matchAll(/(?:Collected|Left to pay|Total)\s*\$([\d,]+\.\d\d)/g)];
  return all.length ? Number(all[all.length - 1][1].replace(/,/g, '')) : null;
}

/* ── 1. the refuter, and what has to survive it ──────────────────────────── */

test('pay all: the money record is written at the till, not guessed by the panel', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const open = mounter(app);
    const before = HW.ORDERS.length;

    await openSecondTicket(app);
    const partyDue = money(app.text(), 'Party');
    assert.ok(partyDue > 5, `the party bar shows nothing worth crediting against: ${app.text().slice(0, 300)}`);

    assert.ok(app.click('Pay all'), `no "Pay all" button — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.match(app.text(), /Balance due/, '"Pay all" did not open a tender');

    // A reward taken AT THE DRAWER — the payment modal's ladder, not the cart's
    // rewards card. This is a credit, not a discount: the sale was for the full
    // amount and $5 of it was settled another way.
    assert.ok(app.click((t, el) => t.startsWith('$5 off') && !el.closest('[data-tour="rewards-card"]')),
      `no $5 reward in the payment modal — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    const drawer = await tenderCashToReceipt(app, Math.round((partyDue - 5) * 100) / 100);
    assert.ok(clickStarts(app, 'Done · new sale'), `no "Done · new sale" — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    const written = HW.ORDERS.slice(0, HW.ORDERS.length - before);
    assert.equal(written.length, 2, '"Pay all" did not write one order per open ticket');
    const ids = written.map((o) => o.id);

    // (a) The record carries its own money the instant it is written. Read
    //     BEFORE any panel exists — this is the whole claim.
    for (const o of written) {
      assert.ok(o.money, `${o.id} was filed with no money record — the panel is left to re-derive a rung-up sale`);
      assert.equal(typeof o.money.credits, 'number', `${o.id}'s money record carries no credits rung`);
      assert.equal(o.money.lines.length, (o.lines || []).length, `${o.id}'s money record is not priced off the lines it filed`);
      // The till took the money, so the till says so on the record. Leaving
      // this to be inferred from the order's channel is how the panel came to
      // print "Payment due at pickup" over a sale settled minutes earlier.
      assert.equal(o.paid, true, `${o.id} was rung up at the drawer and the record does not say it was paid`);
    }

    // (b) The credit is on the order it was taken against, and only once
    //     across the party — a credit counted twice is money invented.
    const creditSum = Math.round(written.reduce((s, o) => s + (+o.money.credits || 0), 0) * 100) / 100;
    assert.equal(creditSum, 5, `the $5 taken at the drawer is recorded as ${creditSum} across ${ids.join(', ')}`);

    // (c) Sum of what the orders say was collected == what the drawer collected.
    const sum = () => Math.round(HW.ORDERS.filter((o) => ids.includes(o.id))
      .reduce((s, o) => s + o.total, 0) * 100) / 100;
    assert.equal(sum(), drawer,
      `the orders (${written.map((o) => o.total).join(' + ')}) do not add up to the ${drawer} the drawer took`);

    // (d) And it is STILL true after every one of them has been opened —
    //     twice, because re-opening is exactly when a third figure appeared.
    const frozen = written.map((o) => `${o.id}:${o.total}:${o.money.credits}:${o.money.discAmt}`).join('|');
    try {
      for (const pass of [1, 2]) {
        for (const id of ids) {
          const panel = await open(id);
          const rec = HW.orderById(id);
          const shown = bottomLine(panel.text());
          assert.equal(shown, rec.total,
            `pass ${pass}: the panel prints ${shown} for ${id} while the record says ${rec.total}`);
        }
      }
    } finally { open.close(); }

    const after = HW.ORDERS.filter((o) => ids.includes(o.id))
      .map((o) => `${o.id}:${o.total}:${o.money.credits}:${o.money.discAmt}`).join('|');
    assert.equal(after, frozen, 'opening the orders in the panel rewrote the money the till had already filed');
    assert.equal(sum(), drawer,
      `after every order was opened, the books say ${sum()} was collected and the drawer says ${drawer}`);
  });
});

/* ── 2. what came off the sale is recorded as what it WAS ────────────────── */

test('promo: a code taken at the cart reaches the order as a promo, not an anonymous discount', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const open = mounter(app);
    const before = HW.ORDERS.length;

    assert.ok(app.click('Add promo code'), 'no "Add promo code" affordance');
    await app.settle();
    assert.ok(app.type('Promo code', 'GREEN5'), 'the promo Field takes no input');
    await app.settle();
    assert.ok(app.click((t, el) => t === 'Apply' && !!el.closest('[data-tour="disc-card"]'), { nth: 1 }),
      'no Apply next to the promo field');
    await app.settle();
    const total = money(app.text(), 'Total');
    assert.ok(total > 0, 'the cart footer shows no total to tender');

    assert.ok(app.click('TENDER'), 'no TENDER button');
    await app.settle();
    const drawer = await tenderCashToReceipt(app, total);
    assert.ok(clickStarts(app, 'Done · new sale'), 'no "Done · new sale"');
    await app.settle();

    assert.equal(HW.ORDERS.length, before + 1, 'the promo sale wrote no order');
    const rec = HW.ORDERS[0];
    assert.equal(rec.total, drawer, 'the order total is not what the drawer collected');
    assert.ok(rec.money, 'the promo sale was filed with no money record');
    assert.equal(rec.paid, true, 'the sale was tendered at the drawer and the record does not say it was paid');

    // The promo has its own rung in the money record. Rolling it into discAmt
    // prices the same and describes the sale wrongly — the operator reading the
    // order cannot tell a signed-off manual discount from a public code.
    assert.equal(rec.money.promo, 'GREEN5',
      `the code the customer used is not on the record — money.promo is ${JSON.stringify(rec.money.promo)}`);
    assert.equal(rec.money.promoAmt, 5, 'the promo rung carries none of the money that came off');
    assert.equal(rec.money.discAmt, 0, 'the promo was ALSO counted as a plain discount — that is the money taken twice');

    try {
      const panel = await open(rec.id);
      assert.match(panel.text(), /Promo · GREEN5/,
        'the panel does not name the code the sale was actually given');
      assert.equal(bottomLine(panel.text()), rec.total,
        'the panel prints a different total from the record it was handed');
    } finally { open.close(); }
  });
});

/* ── The clamp the refuter found missing ─────────────────────────────────────
 *
 * The till takes `off = Math.min(lineMerch, offSum(ds))`, but ticketMoney filed
 * discAmt / promoAmt / referralAmt RAW. Discounts are clamped against the
 * subtotal AT APPLY TIME, so a cart discounted and THEN reduced can carry
 * discounts worth more than the merchandise left behind.
 *
 * This matters because the ORDER PANEL RENDERS discAmt RAW
 * (pos/screen-orders.jsx:2728, `<TotRow v={fmt.money(discAmt)} neg />`) rather
 * than the clamped cartDisc — so an over-large recorded discount prints a
 * discount line bigger than the sale, and the rows stop adding up to the total.
 *
 * ⚠️ MY FIRST VERSION OF THIS TEST WAS A NEGATIVE CONTROL. It asserted the
 * order total was >= 0, which priceOrderMoney's own clamp guarantees whatever
 * the record holds — so it passed with the fix mutated out. It is asserted on
 * THE RECORD now, which is the thing the fix actually changes.
 */
test('a tendered sale never records a discount bigger than the merchandise', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const before = HW.ORDERS.length;

    assert.ok(app.click('Add promo code'), 'no "Add promo code" affordance');
    await app.settle();
    assert.ok(app.type('Promo code', 'GREEN5'), 'the promo Field takes no input');
    await app.settle();
    assert.ok(app.click((t, el) => t === 'Apply' && !!el.closest('[data-tour="disc-card"]'), { nth: 1 }),
      'no Apply next to the promo field');
    await app.settle();

    const total = money(app.text(), 'Total');
    assert.ok(total > 0, 'the cart footer shows no total to tender');
    assert.ok(app.click('TENDER'), 'no TENDER button');
    await app.settle();
    await tenderCashToReceipt(app, total);
    assert.ok(clickStarts(app, 'Done · new sale'), 'no "Done · new sale"');
    await app.settle();

    assert.equal(HW.ORDERS.length, before + 1, 'the sale wrote no order');
    const m = HW.ORDERS[0].money;
    assert.ok(m, 'filed with no money record');
    const merch = +m.lines.reduce((s2, l) => s2 + (l.total != null ? +l.total : l.price * l.qty), 0).toFixed(2);
    const off = +((+m.discAmt || 0) + (+m.promoAmt || 0) + (+m.referralAmt || 0)).toFixed(2);
    assert.ok(off <= merch + 0.001,
      `the record claims $${off.toFixed(2)} came off $${merch.toFixed(2)} of merchandise`);
  });
});
