// ── Orders pricing — pure money functions, extracted from pos/screen-orders.jsx ──
//
// STEP 1 of the screen-orders pricing-block work: EXTRACT and PIN, nothing else.
// Every function body below is byte-for-byte the inline arithmetic that used to
// live at module scope in pos/screen-orders.jsx (see the git history of that
// file for the pre-extraction original) — moved here so it can be tested
// headlessly (test/pos-orders-pricing.test.mjs) and, in a LATER step, converted
// to integer cents. No cents conversion happens in this file. No rounding rule
// changed. If a number this file produces differs from what screen-orders.jsx
// produced before this change, that is a bug in the extraction, not an
// improvement.
//
// "Pure" here means: a function of its own arguments and `window.HW.taxBreakdown`
// only — no React state, no reads of `window.HW.ORDERS`, no writes anywhere.
// `commitOrderMoney` and the per-order migration loop stay behind in
// screen-orders.jsx precisely because they call `window.HW.updateOrder` —
// a write — and are not pure.
//
// Plain JS, loaded as a classic <script> (no Babel, no JSX) right after
// pos/image-slot.js and before pos/data.jsx's consumers, so `window.HW_BRANDS`
// (from shared/brands.js) and `window.HW` (from pos/data.jsx) are both present
// by the time anything here actually RUNS. `DEMO_BASKET` itself is built at
// script-load time and therefore needs `window.HW_BRANDS` to exist already —
// shared/brands.js loads far earlier in every entry HTML, so that holds.
//
// Self-wrapped in an IIFE: leaks no globals but the one, `window.HW_ORDERS_PRICING`.
(function () {

  // ── Seed basket for an order that arrived with no lines of its own ────────
  // Verbatim from screen-orders.jsx (former module scope, just above `lineGross`).
  const DEMO_BASKET = [
    { name: 'Cake Crasher', brand: window.HW_BRANDS.name.jeeter, cat: 'Flower', qty: 4, price: 15 },
    { name: 'Blueberry Pancakes', brand: window.HW_BRANDS.name.lowell, cat: 'Pre-Rolls', qty: 1, price: 17 },
    { name: 'Doubleshot', brand: window.HW_BRANDS.name.wyld, cat: 'Edibles', qty: 2, price: 20 }];

  /**
   * What a line actually rings up.
   *
   * A rung-up sale carries its own `total` with any line-level discount already
   * taken off (screen-register builds it that way); a seeded line has only a unit
   * price. Pricing the first from price × qty hands that discount back at the
   * till, which is the same class of bug as re-rolling the cart discount.
   */
  function lineGross(l) {
    return l && l.total != null ? +l.total : (+l.price || 0) * (+l.qty || 0);
  }

  /**
   * THE STABLE IDENTITY OF ONE ORDER LINE.
   *
   * 🔴 A previous attempt filed return claims against a line by PRODUCT NAME and
   * drained them back in line-index order. One product on two lines at different
   * per-unit gross meant a claim filed against the dearer line was paid out at
   * the cheaper line's rate, and — because nothing was written to the record —
   * closing and reopening the panel let the same purchase be credited a second
   * time. A wallet went 0 -> 18.48 -> 36.96 for ONE purchase.
   *
   * So the join is the line's POSITION plus what that position holds. The name is
   * in there for a human reading the audit row, but it is not what makes the key
   * unique: two lines of the same product differ by index and by price.
   *
   * A completed order is not editable in this panel, so its lines are frozen and
   * the position is stable. If a line ever does move under a filed return, the
   * key stops matching, and the panel REFUSES the whole claim flow out loud
   * rather than guessing which line the earlier return meant.
   */
  function lineKey(l, i) {
    return [i, (l && l.name) || '', +((l && l.qty) || 0),
    +(+((l && l.price) || 0)).toFixed(2), +lineGross(l).toFixed(2)].join('|');
  }

  /** Seed the money for an order that has never had any. Called once per order. */
  function seedOrderMoney(o) {
    const seed = (o.id ? o.id.length : 5) + (o.name || '').length + (o.items || 1);
    const pk = (arr) => arr[seed % arr.length];
    // An order that ARRIVED with a basket was rung up by somebody, so its money is
    // real. Inventing a "Veteran 10%" on a real receipt is this same bug pointed
    // the other way — a real order only ever carries the discount it was sold with.
    const real = !!(o.lines && o.lines.length);
    const hasDisc = real ? +(o.discount || 0) > 0 : seed % 2 === 0;
    const hasPromo = !real && seed % 3 !== 0;
    return {
      seed,
      lines: (real ? o.lines : DEMO_BASKET.slice(0, Math.max(1, Math.min(3, o.items || 1)))).map((l) => ({ ...l })),
      discReason: real ? (o.discounts && o.discounts[0] && o.discounts[0].label) || 'Discount applied' :
      pk(['Veteran 10%', 'Daily deal · Edibles', 'Staff discount', 'Loyalty tier — Gold']),
      discAmt: hasDisc ? real ? +(o.discount || 0) : pk([6, 8, 10, 12]) : 0,
      promo: hasPromo ? pk(['WELCOME10', 'HW420', 'SUMMER15', 'FRIENDS']) : null,
      promoAmt: hasPromo ? pk([5, 8, 10]) : 0,
      referral: null,
      referralAmt: 0,
      // What the customer settled with wallet credit or rewards AT THE DRAWER.
      // This is not a discount — the sale was for the full amount and part of it
      // was paid another way — so it comes off the GRAND total, after tax, not
      // off the taxable base.
      credits: +(o.credits || 0),
      /* The driver gratuity, in dollars. Charged, per the owner's decision, but
       * NOT TAXED — a voluntary, separately-stated gratuity is not taxable in
       * California, and folding it into a line would tax it.
       *
       * It is the exact mirror of `credits`: both sit OUTSIDE the taxed base and
       * move the grand total after tax. A credit is money the customer already
       * put in; a tip is money they are adding on top. Same slot, opposite sign. */
      tip: +(o.tipAmt || 0) };

  }

  /**
   * Price a money record. THE one place an order total is computed — the header,
   * the totals block, the record in HW.ORDERS, the queue card and the engine's
   * `agreed` figures all come through here, so two views of one order cannot show
   * different money.
   */
  function priceOrderMoney(m) {
    const lines = m && m.lines || [];
    const sub = +lines.reduce((s, l) => s + lineGross(l), 0).toFixed(2);
    // Clamped: an order edited down below the value of its own discounts prices at
    // zero, never negative.
    const cartDisc = Math.min(+((+m.discAmt || 0) + (+m.promoAmt || 0) + (+m.referralAmt || 0)).toFixed(2), sub);
    const taxBase = +(sub - cartDisc).toFixed(2);
    const tax = window.HW.taxBreakdown(taxBase);
    // 🔴 CREDITS MUST BE SUBTRACTED HERE. The register files `total: collected`
    // (gross minus credits) but no money record, so commitOrderMoney used to
    // re-derive the total from the lines alone and quietly HAND THE CREDITS BACK
    // — merely opening the order panel raised what the books said was collected.
    // A recorded total that does not match what was taken is the bug this whole
    // money authority exists to prevent, pointed the other way.
    const credits = Math.max(0, +(m && m.credits || 0));
    const tip = Math.max(0, +(m && m.tip || 0));
    const gross = +(taxBase + tax.total).toFixed(2);
    // The tip is added AFTER the clamp, deliberately: an order discounted to zero
    // still owes the gratuity the customer chose to add. Clamping the two together
    // would silently swallow it.
    return { sub, cartDisc, taxBase, tax, rate: tax.rate, credits, tip, gross,
      grand: +(Math.max(0, gross - credits) + tip).toFixed(2) };
  }

  /** The money record for an order — the stored one if there is one, never re-rolled. */
  function orderMoney(o) { return o && o.money || seedOrderMoney(o || {}); }

  // ── Refund cap, split tender — pulled out of the inline expressions in
  // OrderDetails, same arithmetic, now named so they can be pinned and tested.
  // These were never named top-level functions before this extraction; the
  // expressions themselves are unchanged, character for character.

  /** The ceiling on the WHOLE order: everything ever handed back on it, across
   *  every session, can never exceed what the order actually collected. */
  function refundCap(grand, refundedSoFar) {
    return +Math.max(0, grand - refundedSoFar).toFixed(2);
  }

  /** A raw refund amount clamped to what is left under the cap. */
  function clampRefund(rawRefund, cap) {
    return +Math.min(rawRefund, cap).toFixed(2);
  }

  /** Cash tender + change for a cash-only order. `seed` picks the same
   *  rounded-up bill(s) as the order's other deterministic, per-order picks. */
  function cashTender(grand, seed) {
    const tendered = Math.ceil(grand / 5) * 5 + (seed % 2 === 0 ? 0 : 5); // rounded-up bill(s)
    return { amount: grand, tendered, change: +(tendered - grand).toFixed(2) };
  }

  /** Card + cash split tender: card takes 60% (rounded to the cent), cash takes
   *  the remainder and is tendered in rounded-up $5 bills. */
  function splitTender(grand) {
    const cardAmt = +(Math.round(grand * 0.6 * 100) / 100).toFixed(2);
    const cashAmt = +(grand - cardAmt).toFixed(2);
    const tendered = Math.ceil(cashAmt / 5) * 5;
    return { cardAmt, cashAmt, tendered, change: +(tendered - cashAmt).toFixed(2) };
  }

  window.HW_ORDERS_PRICING = {
    DEMO_BASKET, lineGross, lineKey, seedOrderMoney, priceOrderMoney, orderMoney,
    refundCap, clampRefund, cashTender, splitTender,
  };

})();
