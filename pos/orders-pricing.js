// ── Orders pricing — pure money functions, extracted from pos/screen-orders.jsx ──
//
// STEP 1 of the screen-orders pricing-block work extracted these functions
// verbatim from pos/screen-orders.jsx (see that file's git history for the
// pre-extraction original) so they could be tested headlessly
// (test/pos-orders-pricing.test.mjs), and pinned their float-math output
// unchanged. STEP 2 (this revision) converts the arithmetic between those
// pins to integer cents — see the IIFE comment below for the boundary. Every
// exported name, signature and dollar-typed field is unchanged: a caller that
// only reads what it always read sees the same shape, and, apart from the
// handful of pins step 2's report calls out as float artefacts of the old
// per-step `.toFixed(2)` rounding, the same numbers.
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
//
// STEP 2: converted to integer-cents arithmetic through the estate's one
// boundary (shared/commerce-adapter.js's `window.HWSwap.cents`, falling back
// to `window.HWContracts.centsFromDollars`, falling back to the naive
// `Math.round(n*100)` when neither has loaded — same three-tier chain
// commerce-adapter.js itself uses, so this file never has a second opinion
// about what a dollar amount is). Every function still takes and returns
// DOLLARS at its public boundary — same names, same signatures, same types —
// so screen-orders.jsx (excluded from this change; it already calls through
// `window.HW_ORDERS_PRICING`) keeps working unmodified. What changed is what
// happens BETWEEN the boundaries: cents in, integer math, cents out, divided
// back to dollars exactly once. Every record-returning function also gains
// parallel `*_cents` fields (and, where `window.HWContracts` has loaded, a
// `money` object built with `HWContracts.money()`) for callers ready to move
// off dollars.
(function () {

  // THE dollars→cents boundary for this file. Mirrors
  // shared/commerce-adapter.js's own `cents` exactly: HWSwap.cents first (it
  // already does this same fallback chain, so going through it when present
  // means one shared implementation instead of two), HWContracts.centsFromDollars
  // next, the naive multiply-and-round last. Junk/missing input floors to 0,
  // never NaN, for the same reason commerce-adapter.js floors it: a poisoned
  // amount must not propagate into every downstream figure.
  function cents(dollars) {
    const n = +dollars;
    const safe = Number.isFinite(n) ? n : 0;
    if (window.HWSwap && typeof window.HWSwap.cents === 'function') return window.HWSwap.cents(safe);
    if (window.HWContracts && typeof window.HWContracts.centsFromDollars === 'function') {
      return window.HWContracts.centsFromDollars(safe);
    }
    return Math.round(safe * 100);
  }

  /** The one place `taxBreakdown` (pos/data.jsx — dollars in, dollars out, left
   *  alone) gets its input converted from cents. Routes through
   *  `window.HWContracts.dollarsFromCents` when it has loaded (same division,
   *  but paired with the boundary that also asserts the input really is an
   *  integer number of cents), plain division otherwise. */
  function dollarsFromCents(c) {
    const HWC = window.HWContracts;
    return (HWC && typeof HWC.dollarsFromCents === 'function') ? HWC.dollarsFromCents(c) : c / 100;
  }

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
    return lineGrossCents(l) / 100;
  }

  /** `lineGross`'s integer-cents core. A rung-up line's own `total` is
   *  converted at the boundary and used as-is; a seeded line multiplies
   *  cents-of-price by qty. `qty` is an integer for every line this estate
   *  actually produces — asserted here by construction (`Number.isInteger`)
   *  rather than thrown on, because a line ever carrying a fractional qty
   *  (pre-weighed flower sold by the gram, say) is a real quantity, not a bad
   *  input, and still needs a whole-cent answer: `Math.round` on the product,
   *  not a silent truncation. */
  function lineGrossCents(l) {
    if (l && l.total != null) return cents(+l.total || 0);
    const qty = +(l && l.qty) || 0;
    const priceCents = cents((l && l.price) || 0);
    return Number.isInteger(qty) ? priceCents * qty : Math.round(priceCents * qty);
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
    // ── Everything from here to the `out` object is integer cents. Each
    // dollar-typed field on the return value divides its cents figure by 100
    // exactly once, at the boundary, instead of the old per-step `.toFixed(2)`
    // rounding — so an intermediate total can no longer drift a cent before
    // the field that reports it gets its own independent rounding.
    const subCents = lines.reduce((s, l) => s + lineGrossCents(l), 0);
    // Clamped: an order edited down below the value of its own discounts prices at
    // zero, never negative.
    const cartDiscCents = Math.min(
      cents(m && m.discAmt || 0) + cents(m && m.promoAmt || 0) + cents(m && m.referralAmt || 0),
      subCents
    );
    const taxBaseCents = subCents - cartDiscCents; // never negative — cartDiscCents is clamped to subCents above
    const tax = window.HW.taxBreakdown(dollarsFromCents(taxBaseCents));
    // Each tax line converted at the boundary and summed in cents, rather than
    // converting the pre-summed dollar `tax.total` once — the same reason
    // `lineGrossCents` sums per line instead of rounding the sub once: summing
    // whole cents can't accumulate the fractional remainder a single late
    // rounding step would silently drop or add.
    const taxCents = { local: cents(tax.local), excise: cents(tax.excise), sales: cents(tax.sales) };
    const taxTotalCents = taxCents.local + taxCents.excise + taxCents.sales;
    // 🔴 CREDITS MUST BE SUBTRACTED HERE. The register files `total: collected`
    // (gross minus credits) but no money record, so commitOrderMoney used to
    // re-derive the total from the lines alone and quietly HAND THE CREDITS BACK
    // — merely opening the order panel raised what the books said was collected.
    // A recorded total that does not match what was taken is the bug this whole
    // money authority exists to prevent, pointed the other way.
    const creditsCents = Math.max(0, cents(m && m.credits || 0));
    const tipCents = Math.max(0, cents(m && m.tip || 0));
    const grossCents = taxBaseCents + taxTotalCents;
    // The tip is added AFTER the clamp, deliberately: an order discounted to zero
    // still owes the gratuity the customer chose to add. Clamping the two together
    // would silently swallow it.
    const grandCents = Math.max(0, grossCents - creditsCents) + tipCents;

    const out = {
      sub: subCents / 100,
      cartDisc: cartDiscCents / 100,
      taxBase: taxBaseCents / 100,
      tax, rate: tax.rate,
      credits: creditsCents / 100,
      tip: tipCents / 100,
      gross: grossCents / 100,
      grand: grandCents / 100,
      // ── Parallel cents fields — the boundary this file computed in, exposed
      // for any caller ready to stop reading the dollar fields. ──
      sub_cents: subCents,
      cartDisc_cents: cartDiscCents,
      taxBase_cents: taxBaseCents,
      tax_cents: { local: taxCents.local, excise: taxCents.excise, sales: taxCents.sales, total: taxTotalCents },
      credits_cents: creditsCents,
      tip_cents: tipCents,
      gross_cents: grossCents,
      grand_cents: grandCents,
    };
    if (window.HWContracts && typeof window.HWContracts.money === 'function') {
      out.money = {
        grand: window.HWContracts.money(grandCents, 'inc_tax'),
        sub: window.HWContracts.money(subCents, 'ex_tax_gross'),
        cartDisc: window.HWContracts.money(cartDiscCents, 'ex_tax_gross'),
        taxBase: window.HWContracts.money(taxBaseCents, 'ex_tax_net'), // sub minus discounts = net, per BOUNTY-API-CONTRACT.md money_basis
      };
    }
    return out;
  }

  /** The money record for an order — the stored one if there is one, never re-rolled. */
  function orderMoney(o) { return o && o.money || seedOrderMoney(o || {}); }

  // ── Refund cap, split tender — pulled out of the inline expressions in
  // OrderDetails, same arithmetic, now named so they can be pinned and tested.
  // These were never named top-level functions before this extraction; the
  // expressions themselves are unchanged, character for character.

  /** The ceiling on the WHOLE order: everything ever handed back on it, across
   *  every session, can never exceed what the order actually collected.
   *  Plain integer subtraction in cents — no fraction is ever taken of either
   *  input, so there is no rounding rule to get right, only the conversion at
   *  each boundary. Returns a bare dollar number, same as before: this is a
   *  scalar throughout the estate (`refundCap <= 0`, `fmt.money(refundCap)`),
   *  not a record, so it gets no `_cents` sibling or `money` object. */
  function refundCap(grand, refundedSoFar) {
    return Math.max(0, cents(grand) - cents(refundedSoFar)) / 100;
  }

  /** A raw refund amount clamped to what is left under the cap. Same scalar
   *  shape as refundCap, same reason it stays a bare number. */
  function clampRefund(rawRefund, cap) {
    return Math.min(cents(rawRefund), cents(cap)) / 100;
  }

  /** Cash tender + change for a cash-only order. `seed` picks the same
   *  rounded-up bill(s) as the order's other deterministic, per-order picks.
   *  `amount` echoes the caller's own `grand` unchanged, exactly as before —
   *  it is not re-derived from the cents round-trip, so it can never disagree
   *  with the total the caller is holding. */
  function cashTender(grand, seed) {
    const grandCents = cents(grand);
    // Rounded up to the next $5 bill (500 cents), plus the seed's +$5 bump.
    const tenderedCents = Math.ceil(grandCents / 500) * 500 + (seed % 2 === 0 ? 0 : 500);
    const changeCents = tenderedCents - grandCents;
    return {
      amount: grand, tendered: tenderedCents / 100, change: changeCents / 100,
      amount_cents: grandCents, tendered_cents: tenderedCents, change_cents: changeCents,
    };
  }

  /** Card + cash split tender: card takes 60% (rounded to the cent), cash takes
   *  the remainder and is tendered in rounded-up $5 bills.
   *
   *  The 60% cut is taken directly on `grandCents`, half away from zero, via
   *  `Math.floor(grandCents * 0.6 + 0.5)` — never by going back out to dollars
   *  and re-entering through `cents()`. `cents(dollarsFromCents(grandCents) *
   *  0.6)` looks equivalent but is not: it reintroduces exactly the float
   *  error this whole file exists to remove, on a value that is about to be
   *  rounded again on the way back in. One boundary crossing each way, not two. */
  function splitTender(grand) {
    const grandCents = cents(grand);
    const cardCents = Math.floor(grandCents * 0.6 + 0.5);
    const cashCents = grandCents - cardCents;
    const tenderedCents = Math.ceil(cashCents / 500) * 500; // rounded-up $5 bill(s)
    const changeCents = tenderedCents - cashCents;
    return {
      cardAmt: cardCents / 100, cashAmt: cashCents / 100,
      tendered: tenderedCents / 100, change: changeCents / 100,
      cardAmt_cents: cardCents, cashAmt_cents: cashCents,
      tendered_cents: tenderedCents, change_cents: changeCents,
    };
  }

  window.HW_ORDERS_PRICING = {
    DEMO_BASKET, lineGross, lineKey, seedOrderMoney, priceOrderMoney, orderMoney,
    refundCap, clampRefund, cashTender, splitTender,
  };

})();
