// ── Cart pane + Payment modal ──────────────────────────────────────────────
const useP = window.useP;

/* ── THE ONE PLACE THE POS ASKS THE ENGINE FOR AN OFFER ──────────────────────
 *
 * `window.HWSwap.recommendations` is @hyperwolf/commerce-logic reached through
 * shared/commerce-adapter.js — the SAME call pos/screen-orders.jsx's
 * AddItemPanel already makes, and the same code the web cart and the driver app
 * rank with. This wrapper adds the three things every POS surface needs and
 * nothing else. It scores nothing itself.
 *
 * ⚠️ DO NOT ADD A SCORER HERE. pos/data.jsx still carries its own `upsell()`
 * helper — a small hand-rolled "same brand or same category" ranker that cannot
 * see promotion unlocks, which is exactly why the cart used to miss them. It
 * stays as the no-engine fallback and MUST NOT grow a second opinion.
 *
 * It lives on `window` rather than as a top-level function because these pages
 * have no module scope: pos/screen-register.jsx is a separate <script> and
 * reaches this by name at call time. screen-cart.jsx loads first, so it is
 * always defined by the time anything renders.
 */
window.HWPosUpsell = (function () {
  'use strict';

  const swap = () => (typeof window !== 'undefined' && window.HWSwap) || null;

  /**
   * The engine's OWN slot count for a surface — never a number chosen here.
   *
   * How many offers a surface may show is a merchandising decision that lives
   * in `defaultConfig.upsell.slotsBySurface`, next to the weights that produced
   * the ranking. A screen that picks its own `.slice(0, 4)` silently overrides
   * that config and the config stops being the answer to "how many do we show".
   *
   * Returns 0 when the engine is not loaded, which is the caller's signal to
   * render no control at all rather than an inert one.
   */
  function slotsFor(surface) {
    const S = swap();
    const u = S && S.engine && S.engine.defaultConfig && S.engine.defaultConfig.upsell;
    const n = u && u.slotsBySurface ? u.slotsBySurface[surface] : 0;
    return typeof n === 'number' && n > 0 ? n : 0;
  }

  /**
   * Ranked offers for one surface.
   *
   * Returns `null` when the engine is absent (caller falls back or renders
   * nothing) and `[]` when the engine ran and had nothing to say — two very
   * different states that must not look alike.
   *
   * ⚠️ FULFILLABILITY IS THE ENGINE'S JOB, NOT A FILTER OUT HERE. The whole
   * catalogue goes in; the adapter turns each product's `qty` into per-lane
   * availability and `upsell.respectLaneAvailability` drops anything the lane
   * cannot actually fill. Post-filtering on `qty` here would look identical on
   * a good day and quietly disagree with the engine on a bad one — and it would
   * take slots away from offers that WERE fulfillable, because the slice has
   * already happened by then.
   *
   * ⚠️ DISMISSAL IS FILTERED AFTER, AND HAS TO BE. `getUpsells` takes a
   * `dismissed` option, but shared/commerce-adapter.js does not forward it (and
   * that file is not ours to change). So we ask for `slots + hidden.length`
   * offers and drop the hidden ones from the top: because only `hidden.length`
   * ids can ever be dropped, what is left is exactly the top `slots` offers
   * that were not dismissed. The number DISPLAYED is still the config's.
   */
  function offersFor(opts) {
    const S = swap();
    if (!S || typeof S.recommendations !== 'function') return null;
    const slots = slotsFor(opts.surface);
    if (!slots) return null;
    const hidden = opts.hidden || [];
    const catalogue = opts.catalogue ||
      (window.HW.PRODUCTS || []).filter((p) => p.active);
    // The member's go-to category is the one affinity signal this estate has
    // that the cart itself cannot supply. It is DATA handed to the engine, not
    // a ranking: the engine decides what it is worth (weights.favoriteCategory).
    const fav = opts.customer && window.HW.favCategory ?
      window.HW.favCategory(opts.customer) : null;
    const ranked = S.recommendations({
      catalogue,
      orderItems: opts.orderItems || [],
      surface: opts.surface,
      limit: slots + hidden.length,
      customer: fav ? { favoriteCategories: [fav] } : undefined,
    });
    if (!ranked) return null;
    const drop = new Set(hidden);
    return ranked.
      filter((o) => !drop.has(o.product.sku || o.product.id)).
      slice(0, slots).
      map((o) => ({ p: o.product, reason: o.reason, kind: o.kind }));
  }

  return { slotsFor, offersFor };
})();

/* ── WHO THIS CUSTOMER IS, AND WHAT THAT ENTITLES THE SCREEN TO CLAIM ────────
 *
 * The register has two suggestion chips. "Pairs with cart" ranks on the TICKET
 * and goes through the engine above. This one is about the PERSON, and the
 * person is where this estate has almost nothing — so this module's whole job
 * is to name the basis it actually got, out loud, every time.
 *
 * ⚠️ THERE IS NO PER-CUSTOMER PURCHASE HISTORY IN THIS BUILD. Verified
 * 2026-08-27, not assumed:
 *   * pos/data.jsx MEMBERS carries name / visits / points / wallet / type and
 *     nothing about what anyone bought. pos/data.jsx O_() records an item
 *     COUNT (`items: 3`) and no line items at all.
 *   * shared/hw-live.js:982 lists MEMBERS among the things the live seam
 *     deliberately does NOT replace, so the live path does not supply it
 *     either — HW.MEMBERS is the same five invented rows on every path.
 *   * MemberDetails' `ARCHIVE` (pos/screen-register.jsx) is a hardcoded list
 *     of six orders shown identically for EVERY member. It is not history and
 *     nothing here may rank on it.
 * So the history branch below is reached only through a NAMED SEAM that does
 * not exist yet — `window.HW.purchaseHistory` — and until something defines
 * it, this module says "no history" rather than producing an ordering and
 * letting the chip's label imply one. See SPEC at the bottom of this comment.
 *
 * ⚠️ DO NOT REACH FOR `window.HW.favCategory`. It is the one thing on this page
 * that LOOKS like a purchase-affinity signal, and it is a hash:
 *   seed = name.length + visits*3 + points;  cats[seed % cats.length]
 * Verified 2026-08-27 — renaming a member from "Girish Sharma" to "Girish
 * Sharmax" changes their "favourite category" from Flower to Vapes. It is
 * already handed to the engine by offersFor() above as `favoriteCategories`,
 * where `weights.favoriteCategory` is 6 (second only to a promotion unlock, and
 * four times the margin weight), and the engine turns it into the on-screen
 * reason "Usually buys {category}". So the cart rail currently prints a
 * purchase-history claim about a person that was computed from the length of
 * their name. THIS MODULE DOES NOT USE IT, and the "Suggested" chip therefore
 * makes no affinity claim at all. Reported, not fixed here: changing it changes
 * the "Pairs with cart" ranking, which this task was told to leave alone.
 *
 * ⚠️ THE HOUSE-BRAND DEFAULT IS ONLY AS REAL AS THE CATALOGUE IN FRONT OF IT.
 * The owner's rule is that a first-timer gravitates to house-branded product.
 * Whether that rule can be APPLIED depends entirely on which catalogue is
 * loaded, and the three differ (verified 2026-08-27):
 *   * pos/data.jsx mock — 0 of 24 rows are Hyperwolf. shared/brands.js is the
 *     VENDOR list and has no Hyperwolf row at all, so there is nothing to read
 *     a house brand off. The default can rank NOTHING here.
 *   * the wm-demo repo database — 31 products, `brand_name` empty on all 31.
 *     Also nothing.
 *   * the deployed instance, GET /api/state — 149 products, 8 are 'Hyperwolf'
 *     and 33 carry no brand_name at all. Here the default is real, and it is
 *     real over 116 of 149 rows.
 * "Found 8 house-brand products" and "this catalogue has none" must not render
 * the same, so `ranks` is false in the second case and the grid does not move.
 * A blank brand is NOT a brand: it is counted and reported separately, never
 * silently scored as "not house brand".
 *
 * SPEC — WHAT THE HISTORY-BASED VERSION NEEDS, precisely, so it is a task and
 * not an ambition. The data exists; the join does not:
 *   1. wm_order_events.raw_payload carries `lineItems` on every order and is
 *      NOT NULL (wmdemo/order_lines.py). GET /api/order/lines already serves
 *      them PER ORDER (wmdemo/server.py:1722, wired 2026-08-26).
 *   2. orders.identity_id keys an order to a person. Measured on the repo
 *      database: 880 of 4,064 orders carry an identity_id, 1,721 of their
 *      webhook events carry lineItems, and 294 distinct identities have at
 *      least one lined order (266 have two or more). So the history is
 *      DERIVABLE today for 294 of 651 identities.
 *   3. What is missing is (a) a route — no endpoint returns lines BY PERSON;
 *      GET /api/identity/member returns `fulfilled_count`, an order COUNT, and
 *      no skus; and (b) the register's customer is a mock MEMBERS row with no
 *      identity_id on it, so there is nothing to look the person up BY.
 *   Deliver those two and define `window.HW.purchaseHistory(customer)` →
 *   `{ skus: [...], orders: n, source: '<what produced this>' }`; the branch
 *   below lights up and relabels itself with no other change.
 */
window.HWSuggestBasis = (function () {
  'use strict';

  // The catalogue's own `brand` string. There is no id to match on: the live
  // seam sets `brand: p.brand_name || ''` (shared/hw-live.js) and the mock sets
  // a display name out of shared/brands.js. So the name is the only key there
  // is, and it is compared case-insensitively and trimmed.
  var HOUSE_BRAND = 'Hyperwolf';

  function brandOf(p) { return String((p && p.brand) || '').trim(); }
  function isHouse(p) { return brandOf(p).toLowerCase() === HOUSE_BRAND.toLowerCase(); }
  function skuOf(p) { return p.sku || p.id; }

  /**
   * The purchase-history seam. Absent in this build — see the header.
   *
   * A list that cannot say WHERE IT CAME FROM is refused, not used: `source` is
   * what lets the banner name the basis, and a ranking whose basis cannot be
   * named is the thing this whole module exists to prevent. Same for an empty
   * list — "the source ran and this person has bought nothing" is not history.
   */
  function readHistory(customer) {
    var HW = window.HW;
    if (!customer || !HW || typeof HW.purchaseHistory !== 'function') return { state: 'no-seam' };
    var h;
    try { h = HW.purchaseHistory(customer); } catch (e) { return { state: 'no-seam' }; }
    if (!h || typeof h !== 'object') return { state: 'no-seam' };

    // TRANSIENT AND REFUSED STATES ARE NOT "NO HISTORY". shared/hw-live-history.js
    // publishes state:'loading' while the fetch is in flight, 'off' when the seam
    // is disarmed, 'unavailable' when the route refused, 'no_key' when the row
    // carries nothing to look the person up by. Before this branch existed all
    // four fell through the `!h.skus.length` guard below and rendered as the
    // house-brand default under the sentence "no itemised purchase history on
    // this record" -- an assertion about the RECORD made while the request had
    // not come back yet. Verified 2026-08-27: loading and unknown produced a
    // byte-identical banner.
    var st = String(h.state || '');
    if (st === 'loading') {
      return { state: 'loading', detail: h.state_reason || null };
    }
    // 'no_key' and 'off' ARE NOT REFUSALS AND MUST NOT RENDER AS ONE.
    // 'no_key' means this ticket's row carries nothing to look the person up
    // by -- the normal, permanent condition of every mock MEMBERS row in this
    // build, where the seam fires no fetch at all. 'off' means the seam was
    // deliberately disarmed. In both we never asked, so the honest basis is
    // the visit-count fallback below, exactly as before this seam existed.
    // Verified 2026-08-27: routing these two to the refusal branch broke both
    // tests in test/suggested-basis.test.mjs, which is the app saying that the
    // register's ordinary path runs through here.
    if (st === 'no_key' || st === 'off') { return { state: 'no-seam' }; }
    if (st === 'unavailable') {
      // The route was actually asked and actually refused -- e.g. a Weedmaps
      // id bound to four different people. That one an operator must see.
      return { state: 'unavailable', code: h.state_code || st,
        detail: h.state_reason || null };
    }

    // A list that cannot say where it came from is still refused, exactly as
    // before -- `source` is what lets the banner name the basis.
    var src = String(h.source || '').trim();
    if (!src) return { state: 'no-seam' };
    var orders = typeof h.orders === 'number' ? h.orders : null;

    // THE THREE STATES, KEPT APART. purchase_history.py distinguishes them and
    // hw-live-history.js carries the distinction into `skus` as [...] / [] /
    // null. Collapsing the last two is the defect this project keeps shipping:
    // "they have bought nothing" and "we cannot see what they bought" are
    // different facts about a person and lead an operator to different offers.
    if (h.skus === null || h.skus === undefined) {
      return { state: 'unknown', source: src, detail: h.state_reason || null };
    }
    if (!Array.isArray(h.skus)) return { state: 'no-seam' };
    if (!h.skus.length) {
      return { state: 'no-purchases', source: src, orders: orders,
        detail: h.state_reason || null };
    }
    return { state: 'history', skus: h.skus.slice(), source: src, orders: orders };
  }

  /**
   * WHY WE ARE FALLING BACK, which is not one state but four, and they are four
   * different sentences because they are four different facts about the person:
   *
   *   no-customer     nobody is on this ticket, so nothing at all is known
   *   visits-unknown  there IS a person and their record carries no visit count.
   *                   `visitLabel()` renders this as "1st visit" (`n = n || 1`)
   *                   and it is reachable — pos/screen-register.jsx loadCheckIn
   *                   builds `{ name, points, type, member }` with no `visits`
   *                   for a check-in whose member row is gone. NOT KNOWING is
   *                   not the same as knowing they are new, and this module
   *                   refuses to round one into the other.
   *   first-visit     visits is a number and it is 1 or 0 — the owner's rule
   *   returning       visits is a number and it is 2 or more, and we still have
   *                   no history. The operator has to be able to tell this from
   *                   first-visit: a regular is being shown house brand because
   *                   we know NOTHING about them, not because they buy it.
   */
  function why(customer) {
    if (!customer) return 'no-customer';
    if (typeof customer.visits !== 'number' || !isFinite(customer.visits)) return 'visits-unknown';
    return customer.visits <= 1 ? 'first-visit' : 'returning';
  }

  var LEAD = {
    'no-customer': 'No customer on this ticket — nothing is known about who this is',
    'visits-unknown': 'No visit count on this record — we do not know if they are new',
    'first-visit': 'First visit — no purchase history yet',
    'returning': null // built from the count, below
  };

  function lead(kind, customer, histLead) {
    // The seam's own sentence wins when the seam actually answered: it names
    // what we know about their PURCHASES, not how many times they walked in.
    if (histLead) { return histLead; }
    if (kind === 'returning') {
      return 'Visit ' + customer.visits + ' — no itemised purchase history on this record';
    }
    return LEAD[kind];
  }

  /**
   * resolve({ customer, catalogue }) → the basis, always. Never null: "I have
   * no basis" is itself a basis the screen has to print.
   *
   *   kind    machine-readable state, one of the seven below
   *   ranks   may the grid be re-ordered on this? false means DO NOT MOVE IT
   *   skus    the skus to lift, in catalogue order. No score, no weighting —
   *           this module ranks nothing, it SELECTS. (The engine next door is
   *           the only scorer, and note that its margin weight is fed by
   *           pos/data.jsx's char-code hash; nothing here touches that.)
   *   reason  the per-tile line, a fact rather than a claim
   *   line    the banner the operator reads. Every branch has one.
   */
  function resolve(opts) {
    opts = opts || {};
    var customer = opts.customer || null;
    var all = (opts.catalogue || []).filter(function (p) { return p && p.active !== false; });
    // Lift only what can be sold. A house-brand tile the store has none of is
    // not a suggestion, it is a promise the till cannot keep.
    var sellable = all.filter(function (p) { return p.qty == null || p.qty > 0; });
    var houses = sellable.filter(isHouse);
    var noBrand = all.filter(function (p) { return !brandOf(p); }).length;
    var counts = { catalogue: all.length, house: houses.length, noBrand: noBrand };
    // Said out loud wherever the house-brand default is what answered: a third
    // of the live catalogue carries no brand at all, so the basis is PARTIAL
    // and the operator is told by how much rather than left to assume it is total.
    var caveat = noBrand ? ' ' + noBrand + ' of ' + counts.catalogue +
      ' products carry no brand at all and could not be judged.' : '';

    var h = readHistory(customer);
    if (h.state === 'history') {
      // THE RANKING'S ORDER IS THE RANKING. `skus` arrives ordered by
      // wmdemo/suggestion_rank.py -- repeat purchases first, then category
      // affinity, then brand affinity. Filtering the catalogue rebuilt that
      // list in CATALOGUE order and silently threw the ranking away: verified
      // 2026-08-27, a seam returning C,A,B rendered as A,B,C. The position of
      // each sku in `skus` is carried through instead. First occurrence wins,
      // so a duplicated sku cannot promote itself.
      var want = Object.create(null);
      h.skus.forEach(function (s, i) {
        if (!Object.prototype.hasOwnProperty.call(want, s)) { want[s] = i; }
      });
      var hit = sellable.filter(function (p) {
        return Object.prototype.hasOwnProperty.call(want, skuOf(p));
      }).sort(function (a, b) { return want[skuOf(a)] - want[skuOf(b)]; });
      // History that is entirely out of stock is NOT "no history" — the
      // operator can still say "the two things you always buy are out".
      if (!hit.length) {
        return { kind: 'history-nothing-stocked', ranks: false, skus: [], counts: counts,
          source: h.source, reason: null,
          line: 'Purchase history found (' + h.source + '), but none of the ' + h.skus.length +
                ' product' + (h.skus.length === 1 ? '' : 's') + ' on it is in stock — nothing ranked.' };
      }
      return { kind: 'history', ranks: true, skus: hit.map(skuOf), counts: counts,
        source: h.source, reason: 'Bought before', historyState: 'history',
        line: 'Ranked on this customer’s purchase history — ' + hit.length + ' of ' +
              h.skus.length + ' previously bought product' + (h.skus.length === 1 ? '' : 's') +
              ' in stock. Source: ' + h.source + '.' };
    }

    // WHY WE ARE FALLING BACK. `why(customer)` reads the VISIT COUNT, which is a
    // different fact from whether we know what they bought -- so when the seam
    // has actually spoken, its answer names the fallback instead. All four
    // fallbacks below rank the same house-brand set; what differs is the
    // SENTENCE, which is the entire point of the chip.
    var k = why(customer);
    var histLead = null;
    if (h.state === 'no-purchases') {
      k = 'no-purchases';
      histLead = 'We have this customer\u2019s record and they have bought nothing yet' +
        (typeof h.orders === 'number' && h.orders === 0 ? ' \u2014 no orders on file' : '') +
        '. This is a first purchase, not a blank record';
    } else if (h.state === 'unknown') {
      k = 'history-unknown';
      histLead = 'WE DO NOT KNOW what this customer has bought \u2014 ' +
        (h.detail || 'no line data could be read for them') +
        '. Do NOT read this as a first-time customer';
    } else if (h.state === 'loading' || h.state === 'unavailable') {
      // Nothing is asserted and the grid does not move. Ranking on a default
      // while the real answer is seconds away, under a banner that claims the
      // record is empty, is the failure this branch exists to prevent.
      return { kind: h.state === 'loading' ? 'history-loading' : 'history-unavailable',
        ranks: false, skus: [], counts: counts, source: null, reason: null,
        historyState: h.state, code: h.code || null,
        line: (h.state === 'loading'
          ? 'Reading this customer\u2019s purchase history\u2026 nothing is ranked yet, and nothing is being claimed about them.'
          : 'This customer\u2019s purchase history could not be read (' +
            (h.code || 'unavailable') + ') \u2014 ' + (h.detail || 'the seam did not answer') +
            '. That is not the same as them having bought nothing, so nothing was ranked.') };
    }

    if (!houses.length) {
      // The default the owner asked for cannot be applied to THIS catalogue.
      // Saying so is the honest output; re-ordering the grid on an empty set
      // and leaving "Suggested" lit is the failure this branch exists to avoid.
      return { kind: 'no-house-brand', ranks: false, skus: [], counts: counts,
        source: null, reason: null, fallbackWhy: k, historyState: h.state,
        line: lead(k, customer, histLead) + ' — and no ' + HOUSE_BRAND +
              '-branded product is in this catalogue (0 of ' + counts.catalogue +
              '), so nothing was ranked.' + caveat };
    }
    return { kind: k, ranks: true, skus: houses.map(skuOf), counts: counts,
      source: null, reason: HOUSE_BRAND + ' — house brand', historyState: h.state,
      line: lead(k, customer, histLead) + ' — showing ' + HOUSE_BRAND + ' (house brand) first: ' +
            counts.house + ' of ' + counts.catalogue + ' products.' + caveat };
  }

  return { resolve: resolve, HOUSE_BRAND: HOUSE_BRAND, isHouse: isHouse };
})();

// `merch` is what the goods cost; `sub` is what is left to tax after
// `discountOff` comes off. They are separate props because the footer has to
// show the customer both — a total that quietly shrank is a total nobody trusts.
window.CartPane = function CartPane({ P, lines, merch, discountOff = 0, sub, tax, total, count, pay, setPay, setQty, remove, onClearCart, customer, cartSkus, onAdd, discMode, setDiscMode, discounts, onApplyDiscount, onRemoveDiscount, tab, setTab, onPay, tabs, footNote }) {
  const walletAmt = customer?.wallet || 0;
  const [taxOpen, setTaxOpen] = React.useState(false);
  const goal = window.HW.STATS.associate.goal;
  const gap = Math.max(0, goal - total);
  const goalPct = goal > 0 ? Math.min(1, total / goal) : 0;

  /* ── SUGGESTIONS WHILE THE SALE IS BEING RUNG UP ──────────────────────────
   *
   * The cart is the highest-intent moment in the shop: the person is at the
   * counter, the screen already has their attention, and the associate has a
   * reason to speak. So this rail is ranked by the upsell engine — the same one
   * behind the driver's "For {customer}" chip and the order picker — and not by
   * the local `HW.upsell` helper, which cannot see promotion unlocks.
   *
   * ⚠️ THE STRING KEY IS DELIBERATE. `lines` is a new array on every render,
   * so memoising on it directly would re-rank on every keystroke anywhere in
   * the register.
   *
   * When the engine has not loaded we fall back to `HW.upsell` rather than
   * showing an empty rail — the cart still has to sell something. `engine`
   * records WHICH list this is, because a hand-rolled list dressed as an
   * engine-ranked one is how nobody notices the engine stopped loading.
   */
  const cartKey = (lines || []).map((l) => l.sku + ':' + l.qty).join(',');
  const custKey = customer ? customer.id || customer.name : '';
  const { recs, engineRanked } = React.useMemo(() => {
    /* ⚠️ THE ENGINE IS CAUGHT, AND IT HAS TO BE CAUGHT HERE.
     *
     * This runs on the RENDER path, inside a CriticalBoundary that refuses the
     * whole sale (see the boundary at the CartPane call site in
     * pos/screen-register.jsx). Uncaught, a fault anywhere in the ranking engine
     * would stop the till over a SUGGESTION RAIL — a decorative lane refusing
     * the money it sits next to. That is the wrong trade, and it is not one the
     * boundary can make for us: a ScreenBoundary nested inside a
     * CriticalBoundary deliberately does not contain, it escalates.
     *
     * So the containment for this lane is a try/catch, not a boundary. The
     * `engineRanked: false` path below is already the honest fallback for "the
     * engine is not loaded" — a throwing engine is the same fact arriving by a
     * different route, and `engineRanked` still records that this list is the
     * hand-rolled one. */
    let ranked = null;
    try {
      ranked = window.HWPosUpsell && window.HWPosUpsell.offersFor({
        surface: 'cart_add_to_order',
        orderItems: (lines || []).map((l) => ({ sku: l.sku, qty: l.qty })),
        customer,
      });
    } catch (e) {
      try { console.error('[cart] upsell engine threw; falling back to HW.upsell', e); } catch (_) {}
      ranked = null;
    }
    if (ranked) return { recs: ranked, engineRanked: true };
    return {
      recs: window.HW.upsell(cartSkus || [], customer).slice(0, 4).
        map((p) => ({ p, reason: p._reason })),
      engineRanked: false,
    };
  }, [cartKey, custKey]);

  const payMethods = [
  ['cash', 'Cash', 'cash', null],
  ['card', 'Credit Card', 'card', null],
  ['wallet', 'Wallet', 'wallet', walletAmt],
  ['split', 'Split', 'split', null]];


  return (
    <div style={{ flex: '0 0 408px', width: 408, display: 'flex', flexDirection: 'column', background: P.surface2, minHeight: 0 }}>
      {tabs}
      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 16px' }}>
        {count === 0 ?
        <div style={{ padding: '60px 16px', textAlign: 'center', color: P.inkMute }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 99, background: P.surface3, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name="cart" size={24} stroke={1.6} /></span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink2 }}>Cart is empty</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>Add products to start a sale</div>
          </div> :
        <>
          {/* Cart lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow>{count} item{count > 1 ? 's' : ''}</Eyebrow>
              {/* ⚠️ TWO BUTTONS READ "Clear" ON THE REGISTER AT ONCE, and until
                  now they were indistinguishable: same word, same x icon, same
                  11.5px inkDim, both on screen for every sale with a customer
                  and a line in the cart. THIS one empties the ticket in front
                  of you. The other — CustomerChip's, in the top bar of
                  pos/screen-register.jsx — ENDS THE VISIT and takes every
                  ticket in the party with it. Neither said which it was. Each
                  now states its own consequence; see the matching note there. */}
              <button onClick={() => onClearCart && onClearCart()} title={`Empty this ticket — removes all ${count} item${count > 1 ? 's' : ''} and any discount on it. The customer stays checked in and the rest of the party's tickets are untouched.`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: P.ctrlH.xs, padding: '0 4px', background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="x" size={12} stroke={2} />Clear cart</button>
            </div>
            {lines.map((l) =>
            <div key={l.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: P.surface, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                <Thumb item={l.p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p.name}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{window.HW.fmt.money0(l.p.price)}{l.p.was && <span style={{ textDecoration: 'line-through', marginLeft: 5, color: P.inkFaint }}>{window.HW.fmt.money0(l.p.was)}</span>}</div>
                </div>
                <Stepper value={l.qty} onChange={(v) => setQty(l.sku, v)} size="sm" />
                <div style={{ width: 54, textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(l.total)}</div>
                <IconBtn icon="trash" size={14} style={{ width: 28, height: 28 }} onClick={() => remove(l.sku)} />
              </div>
            )}
          </div>

          {/* The pairs-with-cart lane. It renders its own refusal; see CartPairs. */}
          <CartPairs P={P} skus={(lines || []).map((l) => l.sku)} onAdd={onAdd} />

          {/* The for_guest lane — this customer's own purchases, then the
              look-alike cohort. It renders its own refusal; see GuestReco. */}
          <GuestReco P={P} customer={customer} onAdd={onAdd} />

          {/* AOV booster — goal meter + engine-ranked up-sells (comment 8).
              ⚠️ THIS IS NOT THE PAIRING LANE, AND NOT THE for_guest LANE EITHER
              — its heading says "Suggested for this sale" / "Recommended for
              this member", the two cards above say "Pairs with cart" and "For
              this guest", and all three are ranked by DIFFERENT engines on
              different kinds of evidence. See CartPairs' and GuestReco's
              headers. */}
          <AovBooster P={P} total={total} goal={goal} gap={gap} goalPct={goalPct} recs={recs} onAdd={onAdd}
          engineRanked={engineRanked} />

          {/* Discount + promo — committed to the compact layout */}
          <DiscountCard P={P} discMode={discMode} setDiscMode={setDiscMode} subtotal={merch == null ? sub : merch}
          discounts={discounts} onApply={onApplyDiscount} onRemove={onRemoveDiscount} />

          {/* Rewards — placed right by the payment types (comment: move rewards near payment) */}
          <RewardsCard P={P} customer={customer} discounts={discounts} onApply={onApplyDiscount} onRemove={onRemoveDiscount} />
        </>}
      </div>

      {footNote}
      {/* Totals + tender (sticky footer) — committed to the detailed view, height minimized */}
      {count > 0 &&
      <div style={{ flex: '0 0 auto', padding: '9px 11px 11px 18px', borderTop: `1px solid ${P.hairline2}`, background: P.surface }}>
          {/* Totals column + the 52px vertical TENDER column, flush to the
            right edge. The three tax lines collapse into one summary row —
            they are the same every sale, so they only cost height. */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, fontSize: 11.5 }}>
              <Row P={P} k="Sub-total" v={window.HW.fmt.money(merch == null ? sub : merch)} />
              {discountOff > 0 && <Row P={P} k="Discount" v={`−${window.HW.fmt.money(discountOff)}`} tone={P.good} />}
              <TaxRow P={P} sub={sub} open={taxOpen} onToggle={() => setTaxOpen((o) => !o)} />
              <Row P={P} k="Items" v={count} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2, paddingTop: 5, borderTop: `1px dashed ${P.hairline2}` }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Total</span><span style={{ fontSize: 21, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(total)}</span></div>
            </div>
            <button onClick={onPay} title={`Tender · ${window.HW.fmt.money(total)}`} style={{ flex: '0 0 auto', width: 52, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.accent, color: P.accentInk, border: 'none', borderRadius: P.r12, cursor: 'pointer', fontFamily: P.fontSans, padding: '10px 4px', overflow: 'hidden' }}>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 13.5, fontWeight: 800, letterSpacing: '.16em', whiteSpace: 'nowrap' }}>TENDER</span>
            </button>
          </div>
        </div>
      }
    </div>);

};

// Loyalty rewards — the tier coins, sized small so the cart stays short.
// The ladder is fixed: 100 pts → $2.50, 200 → $5, 400 → $10, 800 → $20, plus
// the birthday $20 which is not points-gated at all.
//
// The redemption used to live in this component's own `redeemed` state, so the
// card printed "$2.50 off applied · 100 pts redeemed" over a total that had not
// moved a cent. It now hands the discount UP to the ticket, and reads back the
// one the ticket is actually carrying.
function RewardsCard({ P, customer, discounts, onApply, onRemove }) {
  const rewards = window.HW.REWARDS;
  const pts = customer?.points || 0;
  const goldInk = P.accentText;
  const tier = pts >= 2000 ? 'Platinum' : pts >= 1000 ? 'Gold' : pts >= 300 ? 'Silver' : 'Bronze';
  const tierColor = tier === 'Platinum' ? P.info : tier === 'Gold' ? goldInk : tier === 'Silver' ? P.neutral : P.warn;
  const unlocked = (r) => r.bday || pts >= r.cost;
  const held = (discounts || []).filter((d) => d.kind === 'reward')[0] || null;
  const redeemed = held ? held.rewardId : null;
  const doRedeem = (r) => {
    if (redeemed === r.id) {onRemove && onRemove('reward');return;}
    onApply && onApply({ kind: 'reward', rewardId: r.id, off: r.value, label: r.label, points: r.bday ? 0 : r.cost });
  };

  if (!customer) {
    return (
      <Card padding={11} style={{ marginBottom: 10, background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={12} stroke={1.9} /></span>
          <Eyebrow>Rewards</Eyebrow>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute }}>Check in a member to view points &amp; redeem rewards.</div>
      </Card>);
  }

  return (
    <Card density="compact" padding={10} style={{ marginBottom: 10 }} data-tour="rewards-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ width: 20, height: 20, borderRadius: 6, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="star" size={12} stroke={1.9} /></span>
        <Eyebrow>Rewards</Eyebrow>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: tierColor }}><Icon name="crown" size={11} color={tierColor} />{tier.toUpperCase()}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{pts.toLocaleString()} <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600 }}>PTS</span></span>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 1 }}>
        {rewards.map((r) => {
          const can = unlocked(r);const isR = redeemed === r.id;
          return (
            <button key={r.id} disabled={!can} onClick={() => doRedeem(r)} title={can ? r.bday ? 'Birthday reward — no points required' : `${r.cost} pts` : `Locked — ${r.cost - pts} more points needed`}
              style={{ flex: '0 0 auto', width: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 4px 6px', background: isR ? P.accentSoft : P.surface, border: `1px solid ${isR ? P.accentBorder : can ? P.hairline2 : P.hairline}`, borderRadius: P.r10, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .55, fontFamily: P.fontSans }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, background: can ? P.accent : P.surface3, color: can ? P.accentInk : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={isR ? 'check' : can ? r.icon : 'lock'} size={12} stroke={2} /></span>
              <span style={{ fontSize: 10, fontWeight: 700, color: P.ink, textAlign: 'center', lineHeight: 1.15, whiteSpace: 'nowrap' }}>{r.short || r.label}</span>
              <span style={{ fontSize: 10, fontFamily: P.fontMono, color: can ? goldInk : P.inkFaint, whiteSpace: 'nowrap' }}>{r.bday ? 'birthday' : r.cost}</span>
            </button>);
        })}
      </div>

      {held &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 11.5, color: goldInk, fontWeight: 600 }}>
          <Icon name="gift" size={12} stroke={1.9} />
          {/* "costs", not "redeemed": the points come off when the sale is
              tendered, and this card is not the thing that debits them. */}
          {/* No remove button: the coin itself is the toggle, and it is already
              a proper target. A second 20px × on top of it would be worse. */}
          {held.label} applied — {window.HW.fmt.money(held.off)} off{held.points ? ` · costs ${held.points} pts` : ''} · tap the coin to release it
        </div>}
    </Card>);
}

// ── Manager approval for a manual discount ─────────────────────────────────
// A hand-typed discount is money leaving the till, so it never applies on the
// associate's say-so. It requires a named manager, their PIN, and a reason —
// and the whole thing is written to the audit log with the amount attached.
const DISC_REASONS = [
{ k: 'price-match', label: 'Price match', d: 'Matching a competitor or our own advertised price.' },
{ k: 'damaged', label: 'Damaged packaging', d: 'Product is sellable but the packaging is not perfect.' },
{ k: 'service', label: 'Service recovery', d: 'Making good on a bad order, a long wait or a missed delivery.' },
{ k: 'expiring', label: 'Near expiry', d: 'Moving stock that is close to its date.' },
{ k: 'employee', label: 'Employee / friends & family', d: 'Staff purchase at the approved rate.' },
{ k: 'other', label: 'Other', d: 'Anything else — a note is required.' }];
const MANAGERS = ['Manisha Saini', 'Carla Mendes', 'Devon Pierce'];

function DiscountApprovalModal({ P, amount, mode, subtotal, onClose, onApprove }) {
  const money = window.HW.fmt.money;
  const [mgr, setMgr] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const amt = parseFloat(amount) || 0;
  const off = mode === '%' ? subtotal * (amt / 100) : amt;
  const pctOff = subtotal > 0 ? off / subtotal * 100 : 0;
  const steep = pctOff >= 25;
  const needNote = reason === 'other';
  // What is still missing, named. The button used to sit at 50% opacity and
  // `return` on click: the gate was right, the SILENCE was the bug — a manager
  // pressing Approve on an empty form got nothing back and no reason.
  const missing = [
  !mgr && 'choose the approving manager',
  pin.length < 4 && 'enter the manager PIN',
  !reason && 'pick a reason',
  needNote && note.trim().length <= 2 && 'write the note that "Other" requires'].
  filter(Boolean);
  const ok = missing.length === 0;
  const submit = () => {
    if (!ok) return;
    onApprove({ mgr, reason, note: note.trim(), off });
    onClose();
  };
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 };
  return <div onClick={onClose} style={window.overlayScrim(P, { z: 210, padding: '40px 20px' })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(520px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }} data-tour="disc-approval">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: steep ? P.badSoft : P.warnSoft, color: steep ? P.bad : P.warn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Manager approval required</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Manual discounts are never applied without a sign-off</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: steep ? P.badSoft : P.surface2, border: `1px solid ${steep ? P.bad : P.hairline}`, borderRadius: P.r12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Discount requested</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: steep ? P.bad : P.ink, fontFamily: P.fontMono, marginTop: 2 }}>−{money(off)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{pctOff.toFixed(1)}% of {money(subtotal)}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>new subtotal {money(Math.max(0, subtotal - off))}</div>
          </div>
        </div>
        {steep && <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: P.badSoft, borderRadius: P.r10 }}>
          <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This is <b style={{ color: P.bad }}>{pctOff.toFixed(0)}% off</b> — steep enough that it will be flagged in the daily discount report.</span>
        </div>}
        <div>
          <div style={lbl}>Approving manager</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MANAGERS.map((m) => {const on = mgr === m;
              return <button key={m} onClick={() => setMgr(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Avatar name={m} size={18} />{m}</button>;})}
          </div>
        </div>
        <div>
          <div style={lbl}>Manager PIN</div>
          <div style={{ maxWidth: 180 }}><Field mono type="password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} /></div>
          {pin.length > 0 && pin.length < 4 && <div style={{ fontSize: 11.5, color: P.warn, marginTop: 5 }}>A manager PIN is at least 4 digits.</div>}
        </div>
        <div>
          <div style={lbl}>Reason</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DISC_REASONS.map((r) => {const on = reason === r.k;
              return <button key={r.k} onClick={() => setReason(r.k)} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 10px', textAlign: 'left', background: on ? P.surface3 : P.surface2, border: `1px solid ${on ? P.ink : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}>
                <span style={{ width: 13, height: 13, borderRadius: 99, border: `2px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent', flex: '0 0 auto', marginTop: 1 }} />
                <span><span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{r.label}</span><span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, lineHeight: 1.4, marginTop: 1 }}>{r.d}</span></span>
              </button>;})}
          </div>
        </div>
        <div>
          <div style={lbl}>Note {needNote ? '· required' : '· optional'}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What justifies this discount? Order number, competitor price, what went wrong…"
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 12px', border: `1px solid ${needNote && !note.trim() ? P.warn : P.hairline2}`, borderRadius: P.r10, background: P.surface, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, lineHeight: 1.5, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}>
          <Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>The manager's name, the reason and the amount are written to the audit log against this sale and appear in the daily discount report.</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {!ok && <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>
          <Icon name="info" size={13} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          To approve, {missing.join(', ')}.
        </span>}
        <div style={{ flex: ok ? 1 : '0 0 auto' }} />
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" disabled={!ok} title={ok ? `Approve ${money(off)} off` : `Still needed: ${missing.join(', ')}`} onClick={submit}>Approve −{money(off)}</PBtn>
      </div>
    </div>
  </div>;
}

// The promo codes this store honours. Local, like DISC_REASONS and MANAGERS —
// a code that is not on this list is REFUSED OUT LOUD rather than swallowed.
const PROMO_CODES = [
{ code: 'WELCOME10', pct: 10, label: '10% off · new member welcome' },
{ code: 'GREEN5', amt: 5, label: '$5 off · Green Wednesday' },
{ code: 'LOCAL15', pct: 15, label: '15% off · neighbourhood rate' }];

// Discount + promo — one compact layout. The manager-sign-off rule is taught
// in the guided walkthrough, not printed under the field every sale.
//
// ⚠️ The approved discount does NOT live here. It used to — `applied` was local
// state, so a manager could sign off and the total would not move. Everything
// that changes money is handed to `onApply` and read back out of `discounts`.
function DiscountCard({ P, discMode, setDiscMode, subtotal, discounts, onApply, onRemove }) {
  const [promoOpen, setPromoOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [code, setCode] = React.useState('');
  const [promoErr, setPromoErr] = React.useState('');
  const [approval, setApproval] = React.useState(null); // pending request
  const money = window.HW.fmt.money;
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  const list = discounts || [];
  const applied = list.filter((d) => d.kind === 'manual')[0] || null;
  const promo = list.filter((d) => d.kind === 'promo')[0] || null;
  const sub = r2(subtotal);
  const amt = parseFloat(amount) || 0;
  const off = discMode === '%' ? r2(sub * (amt / 100)) : r2(amt);
  const modeSeg = <Seg value={discMode} onChange={setDiscMode} size="sm" options={[{ value: '$', label: '$' }, { value: '%', label: '%' }]} />;
  // Why Apply is refusing, in a sentence. An empty field used to `return` and
  // say nothing at all, which reads exactly like a dead button.
  const blocked =
  sub <= 0 ? 'Add something to the cart before discounting it.' :
  !amount.trim() ? 'Enter an amount, then Apply.' :
  !(amt > 0) ? 'A discount has to be more than zero.' :
  discMode === '%' && amt > 100 ? 'A percentage cannot be over 100%.' :
  off > sub ? `That is ${money(off)} off a ${money(sub)} subtotal.` : '';
  // Applying is a REQUEST — nothing changes until a manager signs it off.
  const request = () => {if (blocked) return;setApproval({ amount, mode: discMode });};
  const applyPromo = () => {
    const c = code.trim().toUpperCase();
    if (!c) {setPromoErr('Enter a promo code, then Apply.');return;}
    if (sub <= 0) {setPromoErr('Add something to the cart before applying a code.');return;}
    const hit = PROMO_CODES.filter((p) => p.code === c)[0];
    if (!hit) {setPromoErr(`${c} is not a code this store honours.`);return;}
    const value = Math.min(sub, hit.pct ? r2(sub * hit.pct / 100) : r2(hit.amt));
    onApply && onApply({ kind: 'promo', off: value, label: hit.label, code: c });
    setPromoErr('');setCode('');
  };
  const note = { fontSize: 10, color: P.inkDim, lineHeight: 1.4, marginTop: 5 };
  return (
    <Card padding={9} style={{ marginBottom: 10, background: P.surface }} data-tour="disc-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <Eyebrow>Discount &amp; promo</Eyebrow>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: P.inkMute, fontWeight: 600 }} title="Manual discounts need a manager sign-off and a reason."><Icon name="lock" size={10} color={P.inkMute} />sign-off</span>
      </div>

      {applied && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 9px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10, marginBottom: 7 }}>
        <Icon name="check-circle" size={13} color={P.good} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>−{money(applied.off)} approved</div>
          <div style={{ fontSize: 10, color: P.inkDim, lineHeight: 1.4 }}>{(DISC_REASONS.filter((r) => r.k === applied.reason)[0] || {}).label} · signed off by {applied.mgr}</div>
        </div>
        <IconBtn icon="x" size={12} style={{ width: 20, height: 20 }} title="Remove discount" label="Remove discount" onClick={() => {onRemove && onRemove('manual');setAmount('');}} />
      </div>}

      {promo && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10, marginBottom: 7 }}>
        <Icon name="tag" size={13} color={P.good} style={{ flex: '0 0 auto' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>−{money(promo.off)} · {promo.code}</div>
          <div style={{ fontSize: 10, color: P.inkDim, lineHeight: 1.4 }}>{promo.label}</div>
        </div>
        <IconBtn icon="x" size={12} style={{ width: 20, height: 20 }} title="Remove promo code" label="Remove promo code" onClick={() => onRemove && onRemove('promo')} />
      </div>}

      <div style={{ display: 'flex', gap: 7 }}>
        <Field placeholder="Discount" size="sm" mono value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} suffix={modeSeg} />
        <PBtn variant="soft" size="sm" disabled={!!blocked} title={blocked || `Request ${money(off)} off`} onClick={request}>Apply</PBtn>
      </div>
      {blocked && <div style={note}>{blocked}</div>}
      {promoOpen ?
      <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            <Field icon="tag" placeholder="Promo code" size="sm" value={code}
            onChange={(e) => {setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));setPromoErr('');}} />
            <PBtn variant="soft" size="sm" disabled={!code.trim()} title={code.trim() ? `Apply ${code.trim()}` : 'Enter a promo code first'} onClick={applyPromo}>Apply</PBtn>
          </div>
          {(promoErr || !code.trim()) &&
          <div style={{ ...note, color: promoErr ? P.bad : P.inkDim, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              {promoErr && <Icon name="alert" size={11} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />}
              {promoErr || 'Enter a promo code, then Apply.'}
            </div>}
        </div> :
      <button onClick={() => setPromoOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, minHeight: P.ctrlH.xs, background: 'none', border: 'none', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, padding: '0 2px' }}><Icon name="plus" size={12} stroke={2.2} />Add promo code</button>}

      {approval && <DiscountApprovalModal P={P} amount={approval.amount} mode={approval.mode} subtotal={sub}
      onClose={() => setApproval(null)}
      onApprove={(r) => {onApply && onApply({ kind: 'manual', off: Math.min(sub, r2(r.off)), label: 'Manual discount', mgr: r.mgr, reason: r.reason, note: r.note });setAmount('');}} />}
    </Card>);

}

/* ── "PAIRS WITH CART", INSIDE THE CART ──────────────────────────────────────
 *
 * The owner asked for this by name: "we also have the cards inside of the cart
 * that show suggestions — that's where I'd like to see pairs well with cart
 * suggestions as well."
 *
 * WHAT THE CARDS SHOWED BEFORE, so the change is legible: the rail below this
 * one (`AovBooster`) is the @hyperwolf/commerce-logic upsell ranking for the
 * `cart_add_to_order` surface. It IS handed the cart — but its evidence is
 * same-brand / same-category / promotion-unlock heuristics plus a
 * `favoriteCategories` hint. Nothing in it is a measurement that two products
 * were bought together. It is a perfectly good up-sell rail and it is not a
 * pairing claim, so it keeps its own heading and this card does not borrow
 * from it.
 *
 * CORRECTION 2026-08-27: this paragraph used to say `HW.favCategory` was a
 * HASH OF THE MEMBER'S NAME. That was true when it was written and is not true
 * now — `favCategoryBasis()` (pos/data.jsx:207) reads real purchase history
 * through `HW.purchaseHistory` and returns null WITH A REASON when it cannot
 * (no identity key, seam absent, no history, no line the route could resolve to
 * a category). The char-hash was deleted. The stale sentence was read back as
 * current fact by an agent today and nearly relayed to the owner, which is the
 * whole cost of leaving a corrected claim standing in a comment.
 *
 * WHAT THIS CARD SHOWS: the `pairs_with_cart` lane of wmdemo/reco/core.py,
 * through `HW.cartPairings` (shared/hw-live-suggest.js), and NOTHING ELSE.
 *
 * ⚠️ THE HONEST ANSWER TODAY IS A REFUSAL, AND THE REFUSAL IS THE RENDER.
 * The HTTP route now exists (GET /api/reco/pairs-with-cart, added 2026-08-27,
 * p99 15.9 ms), so the first half of this warning is spent. The second half
 * still stands and is the reason the card refuses: the lane
 * refuses on the current order data: a co-occurrence pair needs three DISTINCT
 * customers and 187 of the 191 multi-item baskets belong to one synthetic
 * account. So this card's normal state is a stated refusal carrying the lane's
 * own code and the lane's own sentence — never an empty rail, never a spinner
 * that stays forever, and never a filler list.
 *
 * ✅ FIXED 2026-08-31 — TWO CONTROLS READ "PAIRS WITH CART" AND THEY ARE NOW
 * THE SAME ENGINE. Until then the register's grid chip (pos/screen-register.jsx,
 * `rankOn`) carried that label but was ranked by @hyperwolf/commerce-logic
 * through `HWPosUpsell` — the hardcoded category-affinity table, not this
 * lane — so the two controls could disagree about the same cart. The grid
 * chip now calls `HW.cartPairings` directly, same as this card, and a
 * refusal here is a refusal there too. `HWPosUpsell`/`HWSwap` are UNCHANGED
 * and still back the OTHER upsell surfaces that were never mislabelled
 * "pairs with cart" — this card's own rail below (`AovBooster`, surface
 * `cart_add_to_order`, labelled "Suggested for this sale"), screen-orders.jsx's
 * "For this order", and mobile/screen-shop.jsx's customer recommendations.
 * `promotion_gap` — the one genuinely useful piece of `HWPosUpsell`'s
 * heuristics (closing an AOV/promotion threshold) — was ported INTO this lane
 * as a new core.py contribution source rather than lost, so the register's
 * grid keeps that signal without running a second, disagreeing engine.
 *
 * ⚠️ NO SUBSTITUTES, NO BESTSELLERS, NO BACKFILL. When the lane refuses this
 * card renders zero product tiles. It says how many substitutes exist, because
 * that is a useful thing for an associate to know, and it does not show one:
 * a product you could buy INSTEAD of what is on the counter is not a product
 * that goes WITH it, and putting one under this heading is a false claim
 * dressed as a feature. `window.HW_CART_PAIRS.status()` shows what was asked.
 */
function CartPairs({ P, skus, onAdd }) {
  // Re-asked only when the CART changes. The string key is deliberate for the
  // same reason AovBooster's is: `skus` is a new array on every render.
  const key = (skus || []).slice().sort().join(',');
  // ⚠️ AND WHEN THE LANE ANSWERS. The first ask returns 'loading' and the reply
  // arrives later, so a card memoised on the cart alone would show 'Asking…'
  // for the rest of the sale — including for the REFUSAL, which is the one
  // answer this card exists to render. `tick` is bumped by the seam after every
  // terminal outcome, refusals and failures included.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const S = window.HW_CART_PAIRS;
    if (!S || typeof S.subscribe !== 'function') return undefined;
    return S.subscribe(() => setTick((n) => n + 1));
  }, []);
  const ans = React.useMemo(
    () => (window.HW && typeof window.HW.cartPairings === 'function' ?
      window.HW.cartPairings(skus || []) :
      { state: 'unavailable', code: 'no_seam', items: [], substitutes_found: 0,
        sentence: 'shared/hw-live-suggest.js is not loaded, so the pairs-with-cart ' +
          'lane was never asked. Nothing is being claimed about this cart.' }),
    [key, tick]);

  if (!ans || ans.state === 'empty') return null;

  const pairs = ans.state === 'pairs' ? ans.items || [] : [];
  const tone = ans.state === 'pairs' ? P.accentText : P.inkMute;

  return (
    <div data-hw-cart-pairs={ans.state} data-hw-cart-pairs-code={ans.code || ''}
      style={{ marginBottom: 10, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px 6px' }}>
        <Icon name="sparkle" size={12} stroke={2} color={tone} style={{ flex: '0 0 auto' }} />
        <Eyebrow>Pairs with cart</Eyebrow>
        {/* WHICH STATE THIS IS, in one word, next to the heading. A refusal and
            a ranking that worked must not be told apart only by squinting at
            whether any cards are underneath. */}
        <span style={{ marginLeft: 'auto', fontSize: P.type.micro, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: tone, whiteSpace: 'nowrap' }}>
          {ans.state === 'pairs' ? `${pairs.length} bought together` :
           ans.state === 'loading' ? 'Asking…' :
           ans.state === 'refused' ? 'No pairing evidence' : 'Not available'}
        </span>
      </div>

      {/* THE LANE'S OWN SENTENCE, VERBATIM, IN EVERY STATE. This is the part
          that cannot be got wrong: a screen that renders `items.length === 0`
          as blank space is indistinguishable from one whose engine died. */}
      {ans.sentence &&
      <div style={{ padding: '0 11px 8px', fontSize: P.type.micro, fontWeight: ans.state === 'pairs' ? 700 : 600, color: ans.state === 'pairs' ? P.accentText : P.ink2, lineHeight: 1.5 }}>
        {ans.state !== 'pairs' &&
        <span style={{ display: 'inline-block', marginRight: 5, padding: '0 5px', borderRadius: 5, background: P.surface3, color: P.inkDim, fontFamily: P.fontMono, fontSize: 10, fontWeight: 700 }}>{ans.code}</span>}
        {ans.sentence}
      </div>}

      {/* Substitutes are COUNTED here and rendered NOWHERE. See the header. */}
      {ans.state !== 'pairs' && ans.substitutes_found > 0 &&
      <div style={{ padding: '0 11px 9px', fontSize: P.type.micro, fontWeight: 600, color: P.inkMute, lineHeight: 1.5 }}>
        {ans.substitutes_found} product{ans.substitutes_found === 1 ? ' is' : 's are'} attribute-similar
        to what is on the counter. Those are substitutes — things to buy INSTEAD — so none of them is
        shown here.
      </div>}

      {pairs.length > 0 &&
      <div style={{ borderTop: `1px solid ${P.hairline}`, padding: '7px 11px 9px', background: P.surface2, display: 'flex', gap: 8, overflowX: 'auto' }}>
        {pairs.map((it) => {
          const p = (window.HW.PRODUCTS || []).find((x) => x.sku === it.sku) || null;
          return (
            <div key={it.sku} style={{ flex: '0 0 auto', width: 232, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: 9, display: 'flex', gap: 9 }}>
              {p && <Thumb item={p} size={44} radius={8} />}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.brand_name || (p && p.brand) || ''}</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name || (p && p.name) || it.sku}</div>
                {/* THE EVIDENCE, COUNTED. "N of the M baskets that contained X
                    also contained this" — the lane's own words, not ours. */}
                {it.top_reason && <div style={{ fontSize: P.type.micro, fontWeight: 700, color: P.accentText, lineHeight: 1.4 }}>{it.top_reason}</div>}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 1 }}>{window.HW.fmt.money0(it.price != null ? it.price : (p ? p.price : 0))}</div>
              </div>
              {p && onAdd &&
              <button onClick={() => onAdd(p)} title={`Add ${it.name || it.sku}`} style={{ flex: '0 0 auto', alignSelf: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: P.accent, color: P.accentInk, border: 'none', borderRadius: 10, cursor: 'pointer' }}><Icon name="plus" size={17} stroke={2.6} /></button>}
            </div>);
        })}
      </div>}
    </div>);
}

/* ── "FOR THIS GUEST", INSIDE THE CART ───────────────────────────────────────
 *
 * WHAT THIS CARD SHOWS: the `for_guest` lane of wmdemo/reco/core.py, through
 * `HW.guestRecommendations` (shared/hw-live-guest-reco.js), and NOTHING ELSE.
 * That lane ranks on what THIS PERSON has actually bought first, and only
 * when that is thin does it borrow signal from a look-alike cohort — a
 * k-means group over category mix (wmdemo/reco/fit.py). Nothing here is a
 * hash, a hardcoded list, or the commerce-logic upsell rail below it.
 *
 * ⚠️ NOTHING RENDERS UNTIL A REAL CUSTOMER IS ON THE TICKET. A mock MEMBERS
 * row with no identity_id / pos_customer_id / wm_customer_id has no key this
 * lane can ask by — see hw-live-history.js's own note on why `customer.id`
 * is deliberately not accepted as one. The card renders nothing at all for
 * that case ('no-customer'), same as CartPairs renders nothing for an empty
 * cart, rather than showing a permanently-broken placeholder.
 *
 * ⚠️ A LOOK-ALIKE COHORT IS THE INTERESTING CASE AND THE RARE ONE TODAY.
 * Measured 2026-08-27 in wmdemo/reco/fit.py: 369 of 371 placeable guests on
 * the real database share the IDENTICAL category-mix vector (100% flower), so
 * the model is built with ZERO cohorts and `meta.cohort.code` comes back
 * `no_cohorts_in_model` for nearly everyone. That is a data-sparsity fact,
 * not this card lying — a guest can still get a perfectly real list ranked on
 * their OWN purchases (basis `own_purchases`) or the house-brand/popularity
 * fallback (basis `not_personalised`) with no cohort in sight. So the cohort
 * status is shown as ITS OWN small line, separate from the headline list,
 * exactly the way this codebase keeps a personalised list and a fallback list
 * from ever reading as the same claim (see AovBooster's "Ranked" chip).
 *
 * ⚠️ A REFUSAL IS THE RENDER, NOT A HIDDEN STATE. `recommends: false` is a
 * normal, first-class answer from this engine (core.py names ten refusal
 * codes) and this card shows the engine's own sentence for it verbatim —
 * never an empty rail that reads as "nothing to suggest", which is
 * indistinguishable from the engine being broken.
 */
function GuestReco({ P, customer, onAdd }) {
  // Re-asked only when the CUSTOMER changes. `customer` is not a stable
  // reference across renders in every caller, so a string key is used for the
  // same reason CartPairs' and AovBooster's are.
  const key = customer ?
  [customer.identity_id, customer.pos_customer_id, customer.wm_customer_id, customer.id, customer.name].
  filter((v) => v != null && v !== '').join('|') :
  '';
  // ⚠️ AND WHEN THE LANE ANSWERS. The first ask returns 'loading' and the
  // reply arrives later — including the history lookup this lane depends on
  // — so a card memoised on the customer alone would show 'Asking…' forever.
  // `tick` is bumped by the reco seam after every terminal outcome AND by the
  // history seam it depends on: the first render typically catches
  // HW.purchaseHistory still cold, this card fetches nothing yet (it has no
  // subject to ask by), and HW_GUEST_RECO alone would never fire again once
  // the history answer lands a moment later. Confirmed live: without this
  // second subscription the card hangs on 'Asking…' forever the instant
  // history resolves after this component's first render.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const unsubs = [];
    const G = window.HW_GUEST_RECO;
    if (G && typeof G.subscribe === 'function') unsubs.push(G.subscribe(bump));
    const H = window.HW_HISTORY;
    if (H && typeof H.subscribe === 'function') H.subscribe(bump); // no unsubscribe offered
    return () => unsubs.forEach((fn) => fn && fn());
  }, []);
  const ans = React.useMemo(
    () => (window.HW && typeof window.HW.guestRecommendations === 'function' ?
      window.HW.guestRecommendations(customer || null) :
      { state: 'unavailable', code: 'no_seam', items: [], cohort: null,
        sentence: 'shared/hw-live-guest-reco.js is not loaded, so the '
          + 'for_guest lane was never asked. Nothing is being claimed about '
          + 'this customer.' }),
    [key, tick]);

  if (!ans || ans.state === 'no-customer') return null;

  const items = ans.state === 'ranked' ? ans.items || [] : [];
  const tone = ans.state === 'ranked' ? P.accentText : P.inkMute;
  const cohort = ans.cohort || null;
  // The cohort line is shown ONLY when it is informative: a real assignment,
  // or a real reason none was made. `no_cohorts_in_model` on an artifact with
  // zero cohorts fitted is the expected state on today's data — see header.
  const cohortLine = cohort && cohort.code === 'assigned' ?
  `Look-alike cohort ${cohort.cohort || cohort.nearest || ''} — built from ${cohort.members || 0} guests like this one.` :
  cohort && cohort.why ? cohort.why : null;

  return (
    <div data-hw-guest-reco={ans.state} data-hw-guest-reco-code={ans.code || ''}
      style={{ marginBottom: 10, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px 6px' }}>
        <Icon name="user" size={12} stroke={2} color={tone} style={{ flex: '0 0 auto' }} />
        <Eyebrow>For this guest</Eyebrow>
        {/* WHICH STATE THIS IS, in one word, next to the heading — same
            discipline as CartPairs' chip. */}
        <span style={{ marginLeft: 'auto', fontSize: P.type.micro, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: tone, whiteSpace: 'nowrap' }}>
          {ans.state === 'ranked' ?
          `${items.length} ${ans.personalised ? 'personalised' : cohort && cohort.code === 'assigned' ? 'look-alike' : 'suggested'}` :
          ans.state === 'loading' ? 'Asking…' :
          ans.state === 'refused' ? 'Not enough data yet' :
          ans.state === 'ambiguous' ? 'Identity unclear' : 'Not available'}
        </span>
      </div>

      {/* THE LANE'S OWN SENTENCE, VERBATIM, IN EVERY STATE — the part that
          cannot be got wrong: rendering `items.length === 0` as blank space
          is indistinguishable from the engine having died. */}
      {ans.sentence &&
      <div style={{ padding: '0 11px 8px', fontSize: P.type.micro, fontWeight: ans.state === 'ranked' ? 700 : 600, color: ans.state === 'ranked' ? P.accentText : P.ink2, lineHeight: 1.5 }}>
        {ans.state !== 'ranked' &&
        <span style={{ display: 'inline-block', marginRight: 5, padding: '0 5px', borderRadius: 5, background: P.surface3, color: P.inkDim, fontFamily: P.fontMono, fontSize: 10, fontWeight: 700 }}>{ans.code}</span>}
        {ans.sentence}
      </div>}

      {/* THE LOOK-ALIKE STATUS, ON ITS OWN LINE. Never folded into the
          sentence above — a cohort assignment and a purchase-history basis
          are two different facts, and this card does not let one borrow the
          other's confidence. See header. */}
      {cohortLine && (ans.state === 'ranked' || ans.state === 'refused') &&
      <div style={{ padding: '0 11px 9px', fontSize: P.type.micro, fontWeight: 600, color: cohort.code === 'assigned' ? P.accentText : P.inkMute, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
        <Icon name={cohort.code === 'assigned' ? 'sparkle' : 'info'} size={11} stroke={2} color={cohort.code === 'assigned' ? P.accentText : P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
        {cohortLine}
      </div>}

      {items.length > 0 &&
      <div style={{ borderTop: `1px solid ${P.hairline}`, padding: '7px 11px 9px', background: P.surface2, display: 'flex', gap: 8, overflowX: 'auto' }}>
        {items.slice(0, 6).map((it) => {
          const p = (window.HW.PRODUCTS || []).find((x) => x.sku === it.sku) || null;
          return (
            <div key={it.sku} style={{ flex: '0 0 auto', width: 232, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: 9, display: 'flex', gap: 9 }}>
              {p && <Thumb item={p} size={44} radius={8} />}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.brand_name || (p && p.brand) || ''}</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name || (p && p.name) || it.sku}</div>
                {/* THE EVIDENCE, IN THE LANE'S OWN WORDS — "this guest bought
                    N unit(s) of X" or "N of the M guests in cohort-Y bought
                    this", never a summary written here. */}
                {it.top_reason && <div style={{ fontSize: P.type.micro, fontWeight: 700, color: P.accentText, lineHeight: 1.4 }}>{it.top_reason}</div>}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 1 }}>{window.HW.fmt.money0(it.price != null ? it.price : (p ? p.price : 0))}</div>
              </div>
              {p && onAdd &&
              <button onClick={() => onAdd(p)} title={`Add ${it.name || it.sku}`} style={{ flex: '0 0 auto', alignSelf: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: P.accent, color: P.accentInk, border: 'none', borderRadius: 10, cursor: 'pointer' }}><Icon name="plus" size={17} stroke={2.6} /></button>}
            </div>);
        })}
      </div>}
    </div>);
}

// AOV goal meter — the bar, plus recommended up-sells.
/**
 * The goal meter and the suggestion rail, in one card.
 *
 * ⚠️ `recs` IS `[{ p, reason }]`, not a list of products. It used to be
 * products carrying a `_reason` the card then threw away — the local helper had
 * been computing a reason for every row since it was written and no cashier
 * ever saw one. Both list shapes now arrive normalised, so the card renders the
 * engine's copy and the fallback's copy through the same path.
 *
 * ⚠️ THE RAIL IS NO LONGER GATED ON THE AOV GOAL. It used to disappear the
 * moment `total` crossed the associate's goal, which meant the suggestion
 * surface switched itself off during exactly the sales that were going well.
 * The meter is a staff metric; the rail is the customer's. They share a card
 * and nothing else.
 */
function AovBooster({ P, total, goal, gap, goalPct, recs, onAdd, engineRanked }) {
  const met = gap <= 0;
  const meterColor = met ? P.good : P.info;
  const headColor = met ? P.good : P.warn;
  const fmt0 = window.HW.fmt.money0;

  return (
    <div style={{ marginBottom: 10, border: `1px solid ${met ? P.goodSoft : P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
      <div style={{ padding: '7px 11px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 }}>
          <Icon name="target" size={12} stroke={2} color={headColor} style={{ alignSelf: 'center', flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{met ? 'AOV goal met' : `Add ${fmt0(Math.ceil(gap))} to hit goal`}</span>
          <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{fmt0(total)} / {fmt0(goal)}</span>
        </div>
        <BarMeter value={goalPct} max={1} color={meterColor} height={4} />
      </div>

      {recs.length > 0 &&
      <div style={{ borderTop: `1px solid ${P.hairline}`, padding: '7px 11px 9px', background: P.surface2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Eyebrow>{engineRanked ? 'Suggested for this sale' : 'Recommended for this member'}</Eyebrow>
            {/* Say which list this is. A hand-rolled fallback that looks like an
                engine ranking is how nobody notices the engine stopped loading. */}
            {engineRanked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap' }}><Icon name="sparkle" size={11} stroke={2} />Ranked</span>}
          </div>
          <div data-hw-aov-rail style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {recs.map(({ p: r, reason }) =>
          // Small, on purpose — matches the density of the catalog grid's own
          // ProductRow (pos/screen-register.jsx), not a bigger promoted card.
          // Dropping the dismiss column freed width for the name to run a
          // little longer before truncating; it did not free a mandate to
          // grow the card.
          // Three columns — thumb | info | price+Add — same shape as
          // ProductRow (pos/screen-register.jsx). Price and Add sit in their
          // OWN column now, sharing the row's height instead of stacking
          // underneath the info column and adding a row's worth of height on
          // top of it. Wider (216->248) to give that column real room.
          <div key={r.sku} style={{ flex: '0 0 auto', width: 248, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: 7, display: 'flex', gap: 7, alignItems: 'center' }}>
                <Thumb item={r} size={44} radius={8} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.brand}</span>
                    <span style={{ fontSize: 10, color: r.qty < 10 ? P.warn : P.inkFaint, fontFamily: P.fontMono, marginLeft: 'auto', whiteSpace: 'nowrap', flex: '0 0 auto' }}>{r.qty} left</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  {/* WHY this card is here, in the engine's own words. */}
                  {reason && <div style={{ fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reason}</div>}
                  {/* Plain dot+text, not StrainPill's padded badge — StrainPill's
                      own 2px/7px chrome (pos/atoms.jsx) made this row visibly
                      taller than every sibling row for no informational gain. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    {r.strain && (() => {
                      const c = r.strain.toLowerCase() === 'indica' ? P.indica : r.strain.toLowerCase() === 'sativa' ? P.sativa : P.hybrid;
                      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: c, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: 99, background: c, flex: '0 0 auto' }} />{r.strain.toUpperCase()}
                      </span>;
                    })()}
                    {r.wt && <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{r.wt}</span>}
                  </div>
                </div>
                <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    {r.was && <span style={{ fontSize: 10, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{fmt0(r.was)}</span>}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: r.was ? P.bad : P.ink, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{fmt0(r.price)}</span>
                  </div>
                  <button onClick={() => onAdd && onAdd(r)} title={`Add ${r.name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: P.accent, color: P.accentInk, border: 'none', borderRadius: 8, cursor: 'pointer', flex: '0 0 auto' }}>
                    <Icon name="plus" size={14} stroke={2.6} />
                  </button>
                </div>
              </div>
          )}
          </div>
        </div>}
    </div>);

}

// Taxes are identical every sale, so they collapse into one row by default.
function TaxRow({ P, sub, open, onToggle }) {
  const tb = window.HW.taxBreakdown(sub);
  const money = window.HW.fmt.money;
  return (
    <>
      <button onClick={onToggle} aria-expanded={open} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: P.ctrlH.xs, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5, color: P.inkDim, textAlign: 'left' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
          Taxes<span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>({(tb.rate * 100).toFixed(2)}%)</span>
          <Icon name="chevron-down" size={11} stroke={2.4} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </span>
        <span style={{ color: P.ink2, fontWeight: 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{money(tb.total)}</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0 1px 10px', borderLeft: `1px solid ${P.hairline2}`, marginLeft: 1 }}>
        {tb.lines.map((t) => <div key={t.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, color: P.inkMute }}><span style={{ whiteSpace: 'nowrap' }}>{t.k}</span><span style={{ fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{money(t.v)}</span></div>)}
      </div>}
    </>);
}

function Row({ P, k, v, tone }) {return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: P.inkDim }}><span style={{ whiteSpace: 'nowrap' }}>{k}</span><span style={{ color: tone || P.ink2, fontWeight: 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{v}</span></div>;}


Object.assign(window, {});