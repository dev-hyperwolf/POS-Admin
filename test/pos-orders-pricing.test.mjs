/* ── pos/orders-pricing.js — characterisation tests ──────────────────────────
 *
 * STEP 1 pinned what the extracted money functions did as dollar-and-cents
 * floats, byte for byte off pos/screen-orders.jsx. STEP 2 (this revision)
 * converts the module's internal arithmetic to integer cents; the pins below
 * were re-derived against that conversion, not hand-edited to match a guess.
 * A row unchanged from step 1 means cents math agreed with the old float
 * result to the cent. A row that changed is called out at its own site with
 * why — search this file for "cents math gives" to find every one.
 *
 * These numbers are still CHARACTERISATION VALUES, not a spec: they were
 * produced by running the (now cents-converted) functions once and pasting
 * the output. If a later step changes what one of these fixtures returns,
 * that is a deliberate, reviewed change to go make in this file — not
 * evidence the old number was "wrong". The point of this file is to make an
 * ACCIDENTAL change to the arithmetic loud.
 *
 * pos/orders-pricing.js and pos/data.jsx are PLAIN JS (no JSX syntax despite
 * the .jsx extension — verified: `grep -c "React.createElement|<[A-Z]"` on
 * data.jsx returns 0), loaded as classic <script> tags in the browser. So,
 * exactly like test/harness.mjs does for shared/commerce-engine.js and
 * shared/commerce-adapter.js, this loads them BYTE FOR BYTE under `vm` with a
 * `window` global and nothing else — no babel, no jsdom.
 *
 * Load order: contracts/index.js (window.HWContracts) and
 * shared/commerce-engine.js (window.HWCommerce) before
 * shared/commerce-adapter.js, which needs HWCommerce present the moment it
 * runs to expose window.HWSwap at all — so this test exercises the REAL,
 * TOP-of-the-fallback-chain path, `window.HWSwap.cents`, for every cents()
 * call orders-pricing.js makes, not one of its fallbacks. shared/brands.js
 * goes in next because pos/orders-pricing.js's DEMO_BASKET reads
 * `window.HW_BRANDS.name.*` at script-load time, and pos/data.jsx goes in
 * after that because it is what actually defines `window.HW.taxBreakdown` —
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
  const load = (...parts) => vm.runInContext(
    fs.readFileSync(path.join(ROOT, ...parts), 'utf8'),
    ctx, { filename: parts.join('/') }
  );
  load('contracts', 'index.js');       // window.HWContracts
  load('shared', 'commerce-engine.js'); // window.HWCommerce — HWSwap needs this present at load time
  load('shared', 'commerce-adapter.js'); // window.HWSwap.cents — the proven path cents() prefers
  load('shared', 'brands.js');
  load('pos', 'data.jsx');
  load('pos', 'orders-pricing.js');
  return sandbox;
}

const W = loadOrdersPricing();
const OP = W.HW_ORDERS_PRICING;
const ORDERS = W.HW.ORDERS;

test('the cents() boundary this suite exercises is the real window.HWSwap.cents, not a fallback', () => {
  assert.equal(typeof W.HWSwap, 'object', 'commerce-adapter.js must have loaded HWCommerce before it ran');
  assert.equal(typeof W.HWSwap.cents, 'function');
  assert.equal(W.HWSwap.cents(0.285), 29, 'HWSwap.cents delegates to HWContracts.centsFromDollars, not the naive Math.round');
});

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

test('edge: a 3-decimal price (9.995) — cents math rounds it up, not down', () => {
  // lineGross now rounds at the cents boundary instead of formatting a float:
  // was 9.995 (toFixed artefact); cents math gives 10.00.
  // (9.995).toFixed(2) === '9.99' because 9.995 is not exactly representable
  // in binary floating point (it is actually 9.994999999999999...); the cents
  // boundary rounds half away from zero on the scaled integer instead
  // (Math.round(999.5 + 1e-9) === 1000), which is the correct answer.
  assert.equal(OP.lineGross({ price: 9.995, qty: 1 }), 10, 'was 9.995 (toFixed artefact); cents math gives 10.00');
  const m = { lines: [{ name: 'X', price: 9.995, qty: 1 }], discAmt: 0, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  // was sub 9.99 / taxBase 9.99 / gross 12.31 / grand 12.31 (toFixed
  // artefact); cents math gives sub 10.00, taxBase 10.00, gross 12.32,
  // grand 12.32.
  pinned(priced, { sub: 10, taxBase: 10, gross: 12.32, grand: 12.32 });
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

// ── 4 rows that ONLY cents math gets right — step 2's own regression floor.
// Each pairs a float trap with the naive float result, so a future revert to
// dollar arithmetic fails loudly instead of silently.

test('cents: three 0.10 lines sum to a sub of exactly 0.30, not 0.30000000000000004', () => {
  // 0.10 + 0.10 + 0.10 in plain float is 0.30000000000000004 (try it: node -e
  // "console.log(0.10+0.10+0.10)"). The old code's .toFixed(2) happened to
  // paper over this one case; cents math never has the error to paper over —
  // 10 + 10 + 10 cents is exactly 30 cents, always.
  const m = {
    lines: [{ name: 'a', price: 0.10, qty: 1 }, { name: 'b', price: 0.10, qty: 1 }, { name: 'c', price: 0.10, qty: 1 }],
    discAmt: 0, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0,
  };
  const priced = OP.priceOrderMoney(m);
  assert.equal(priced.sub, 0.30, 'sub must be exactly 0.30');
  pinned(priced, { sub: 0.3, cartDisc: 0, taxBase: 0.3, gross: 0.37, grand: 0.37 });
});

test('cents: a 0.285 price lands on the correct cent, not the one naive rounding gives', () => {
  // 0.285 * 100 === 28.499999999999996 in plain float, so Math.round(dollars*100)
  // — the naive last-resort in cents()'s own fallback chain — gives 28. The
  // real boundary, HWContracts.centsFromDollars (reached here via
  // window.HWSwap.cents), adds an epsilon before rounding and gets the actual
  // answer: 29.
  assert.equal(Math.round(0.285 * 100), 28, 'the naive rounding this suite is NOT exercising — recorded so the contrast is explicit');
  assert.equal(OP.lineGross({ price: 0.285, qty: 1 }), 0.29);
  const m = { lines: [{ name: 'x', price: 0.285, qty: 1 }], discAmt: 0, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  pinned(priced, { sub: 0.29, cartDisc: 0, taxBase: 0.29, gross: 0.36, grand: 0.36 });
});

test('cents: a 33.33% discount on 10.00 clamps to a real cent amount', () => {
  // 10 * 0.3333 is 3.3329999999999997 in plain float — not a whole number of
  // cents. cents() rounds that through the same boundary as every other
  // dollar amount in this file (half away from zero, epsilon-tolerant), so
  // the discount lands on 333 cents ($3.33), not on a value that would make
  // taxBase carry a fractional cent forward.
  const rawDiscount = 10 * 0.3333;
  const m = { lines: [{ name: 'y', price: 10.00, qty: 1 }], discAmt: rawDiscount, promoAmt: 0, referralAmt: 0, credits: 0, tip: 0 };
  const priced = OP.priceOrderMoney(m);
  pinned(priced, { sub: 10, cartDisc: 3.33, taxBase: 6.67, gross: 8.22, grand: 8.22 });
});

test('cents: a refund cap that lands on 0.05 is exact, never 0.049999999999999996', () => {
  // 0.30 - 0.25 in plain float is 0.04999999999999999. The old refundCap
  // already masked this with its own .toFixed(2); cents math removes the
  // float subtraction entirely — 30 cents minus 25 cents is exactly 5 cents —
  // so there is no near-miss left to mask.
  assert.notEqual(0.30 - 0.25, 0.05, 'the float trap this test exists to route around');
  assert.equal(OP.refundCap(0.30, 0.25), 0.05);
});
