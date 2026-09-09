/* ── pos/orders-pricing.js — characterisation tests ──────────────────────────
 *
 * STEP 1 of the screen-orders pricing-block work: PIN what the extracted money
 * functions currently do. No cents conversion happens yet — that is step 2 —
 * so every value below is a dollars-and-cents float, exactly as
 * pos/screen-orders.jsx has always produced it.
 *
 * These numbers are CHARACTERISATION VALUES, not a spec: they were produced by
 * running the extracted functions once (right after the extraction, before any
 * behaviour change) and pasting the output. If a later step changes what one of
 * these fixtures returns, that is a deliberate, reviewed change to go make in
 * this file — not evidence the old number was "wrong". The point of this file
 * is to make an ACCIDENTAL change to the arithmetic loud.
 *
 * pos/orders-pricing.js and pos/data.jsx are PLAIN JS (no JSX syntax despite
 * the .jsx extension — verified: `grep -c "React.createElement|<[A-Z]"` on
 * data.jsx returns 0), loaded as classic <script> tags in the browser. So,
 * exactly like test/harness.mjs does for shared/commerce-engine.js and
 * shared/commerce-adapter.js, this loads them BYTE FOR BYTE under `vm` with a
 * `window` global and nothing else — no babel, no jsdom. shared/brands.js goes
 * in first because pos/orders-pricing.js's DEMO_BASKET reads
 * `window.HW_BRANDS.name.*` at script-load time, and pos/data.jsx goes in
 * second because it is what actually defines `window.HW.taxBreakdown` —
 * priceOrderMoney's one real dependency, and the reason this test uses the
 * REAL tax function instead of a hand-copied stub that could drift from it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadOrdersPricing() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'shared', 'brands.js'), 'utf8'),
    ctx, { filename: 'shared/brands.js' }
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'pos', 'data.jsx'), 'utf8'),
    ctx, { filename: 'pos/data.jsx' }
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'pos', 'orders-pricing.js'), 'utf8'),
    ctx, { filename: 'pos/orders-pricing.js' }
  );
  return sandbox;
}

const W = loadOrdersPricing();
const OP = W.HW_ORDERS_PRICING;
const ORDERS = W.HW.ORDERS;

test('pos/orders-pricing.js loads and exposes the expected surface', () => {
  assert.equal(typeof OP, 'object');
  assert.equal(typeof W.HW.taxBreakdown, 'function'); // real tax function, not a stub
  for (const k of ['DEMO_BASKET', 'lineGross', 'lineKey', 'seedOrderMoney',
    'priceOrderMoney', 'orderMoney', 'refundCap', 'clampRefund', 'cashTender', 'splitTender']) {
    assert.ok(k in OP, `HW_ORDERS_PRICING is missing ${k}`);
  }
});

/** Only the fields a fixture cares to pin — real orders pin the whole priced
 *  record, edge cases usually pin one or two numbers off a narrower call. */
function pinned(actual, expected) {
  for (const [k, v] of Object.entries(expected)) {
    assert.deepStrictEqual(actual[k], v, `field "${k}"`);
  }
}

// ── 6 real orders, from pos/data.jsx's ORDERS array, through the same
// orderMoney() -> priceOrderMoney() path OrderDetails uses. None of these
// orders carries a stored `money`, so orderMoney() falls through to
// seedOrderMoney() — same as it does for every seeded order in this app today.
const REAL_ORDER_FIXTURES = [
  { id: 'ORD-00231', expect: { sub: 117, cartDisc: 6, taxBase: 111, gross: 136.77, grand: 136.77 } },
  { id: 'ORD-00232', expect: { sub: 77, cartDisc: 10, taxBase: 67, gross: 82.56, grand: 82.56 } },
  { id: 'ORD-00234', expect: { sub: 60, cartDisc: 8, taxBase: 52, gross: 64.07, grand: 64.07 } },
  // ORD-00224 is the order named in the code's own comments as the money-model
  // bug's example (record $52.10 vs panel $131.85) — pinning it here nails
  // down the figure the comments say is the RIGHT one.
  { id: 'ORD-00224', expect: { sub: 117, cartDisc: 10, taxBase: 107, gross: 131.85, grand: 131.85 } },
  { id: 'ORD-00220', expect: { sub: 117, cartDisc: 6, taxBase: 111, gross: 136.77, grand: 136.77 } },
  { id: 'ORD-00217', expect: { sub: 117, cartDisc: 10, taxBase: 107, gross: 131.85, grand: 131.85 } },
];

for (const { id, expect } of REAL_ORDER_FIXTURES) {
  test(`priceOrderMoney(orderMoney(${id})) matches the pinned figures`, () => {
    const o = ORDERS.find((x) => x.id === id);
    assert.ok(o, `${id} is not in pos/data.jsx's ORDERS`);
    const money = OP.orderMoney(o);
    const priced = OP.priceOrderMoney(money);
    pinned(priced, expect);
  });
}

// ── 6 edge cases ─────────────────────────────────────────────────────────────

test('edge: a $0 line prices to zero everywhere, not negative, not NaN', () => {
  const m = { lines: [{ name: 'Freebie', price: 0, qty: 1 }], discAmt: 0, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  pinned(priced, { sub: 0, cartDisc: 0, taxBase: 0, gross: 0, grand: 0 });
});

test('edge: a 3-decimal price (9.995) — toFixed(2) rounding is pinned as-is', () => {
  // lineGross itself does NOT round: price * qty stays 9.995 until
  // priceOrderMoney's own .toFixed(2) touches it.
  assert.equal(OP.lineGross({ price: 9.995, qty: 1 }), 9.995);
  const m = { lines: [{ name: 'X', price: 9.995, qty: 1 }], discAmt: 0, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  // (9.995).toFixed(2) === '9.99' in JS float representation — not '10.00'.
  // This is exactly what screen-orders.jsx has always done; pinning it here so
  // the later cents-conversion step can decide, deliberately, whether to keep
  // or fix it — not discover it by accident.
  pinned(priced, { sub: 9.99, taxBase: 9.99, gross: 12.31, grand: 12.31 });
});

test('edge: refund cap on a $12.35 order', () => {
  assert.equal(OP.refundCap(12.35, 0), 12.35);
  assert.equal(OP.refundCap(12.35, 5), 7.35);
  // Refunded-so-far can never push the cap negative.
  assert.equal(OP.refundCap(12.35, 50), 0);
  // A raw refund bigger than what is left under the cap clamps to the cap.
  assert.equal(OP.clampRefund(20, OP.refundCap(12.35, 0)), 12.35);
});

test('edge: split tender on a $50 order — card takes 60%, cash the remainder', () => {
  const t = OP.splitTender(50);
  pinned(t, { cardAmt: 30, cashAmt: 20, tendered: 20, change: 0 });
});

test('edge: cash tender rounds up to the next $5 bill, seed picks the +$5 bump', () => {
  const even = OP.cashTender(37.5, 24); // seed % 2 === 0
  const odd = OP.cashTender(37.5, 23); // seed % 2 === 1
  pinned(even, { amount: 37.5, tendered: 40, change: 2.5 });
  pinned(odd, { amount: 37.5, tendered: 45, change: 7.5 });
});

test('edge: a discount larger than the subtotal clamps at the subtotal, tax base never negative', () => {
  const m = { lines: [{ name: 'Y', price: 20, qty: 2 }], discAmt: 50, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  // sub is 40; a $50 discount clamps to 40, taxBase floors at 0, nothing taxed.
  pinned(priced, { sub: 40, cartDisc: 40, taxBase: 0, gross: 0, grand: 0 });
});

test('edge: an empty cart prices to all zeros', () => {
  const m = { lines: [], discAmt: 0, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  pinned(priced, { sub: 0, cartDisc: 0, taxBase: 0, gross: 0, grand: 0 });
});
