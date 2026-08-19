/* ── The GOVERNED post-submission substitution bridge ───────────────────────
 *
 * `shared/commerce-adapter.js` (window.HWSwap) maps this estate's products onto
 * the engine and calls `buildCandidates` — the engine's shared RANKING core.
 * That is the right thing to call for a cart, where nothing has been agreed yet
 * and nobody has been charged.
 *
 * It is the WRONG thing to call for an order that is already placed. On a live
 * order `buildCandidates` alone means:
 *
 *   • no check that this actor may touch this order       (checkActor)
 *   • no check that the order is still changeable         (checkOrderState)
 *   • no money against the FROZEN agreed totals           (priceSubstitution)
 *   • no idea a promotion the customer already earned is about to vanish
 *   • no settlement figure, so nobody knows what to collect at the door
 *   • no SubstitutionRecord — nothing to answer "who changed this, and why"
 *
 * The engine already implements every one of those, in `planOrderSubstitution`
 * / `applyOrderSubstitution`. This file is the bridge from estate data to them.
 * It exposes `window.HWGovern` and it does NOT re-decide anything the engine
 * decides: the plan comes back UNCHANGED, and every refusal below either comes
 * from the engine or is a permission question the engine has no vocabulary for.
 *
 * Degrades to `null` when the engine (or the adapter) has not loaded, exactly
 * like HWSwap — a surface then renders no swap control rather than a broken one.
 *
 * ⚠️ LOADING. This file needs, in order:
 *      shared/commerce-engine.js → shared/commerce-adapter.js → this
 *    and, for `buildKit`, the region stock table in `delivery/ddata.jsx`.
 *    Today `delivery/ddata.jsx` is loaded ONLY by `Hyperwolf Delivery.html`, so
 *    on the POS and the Driver App `buildKit(regionId)` returns null until the
 *    stock table is either loaded there too or moved into `shared/`. That is a
 *    wiring decision, not something this file should paper over, so it does not:
 *    it reports the gap through `HWGovern.capabilities.regionStock`.
 */
(function () {
  'use strict';

  const E = typeof window !== 'undefined' && window.HWCommerce;
  const SWAP = typeof window !== 'undefined' && window.HWSwap;

  // The engine is the authority; the adapter is the ONLY product mapper in this
  // estate (see CLAUDE.md). Without either, there is nothing honest to return.
  if (!E || typeof E.planOrderSubstitution !== 'function' || !SWAP) {
    window.HWGovern = null;
    return;
  }

  const money = typeof E.money === 'function'
    ? E.money
    : (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(Math.round(c)) / 100).toFixed(2);

  // ── Policy — the owner's decisions, 2026-08-19 ────────────────────────────
  //
  //  priceDelta 'settle_at_door'
  //      "cash orders settle in cash, card orders re-authorize." NOT
  //      `any_reconcile_at_closeout` (the engine's default), which defers the
  //      money to end of shift and is the opposite of what was asked for.
  //  consent 'verbal_ok'
  //      the driver attests the customer agreed. One tap, works with no signal,
  //      and turns a unilateral change into a recorded agreement.
  //  everything else stays at the engine's default, including
  //  allowCrossKitSubstitution:false — a driver can only hand over what is in
  //  their own van — and blockIfPromotionBroken:false, because the owner asked
  //  for broken promotions to be ALLOWED and flagged, not forbidden.
  const POLICY = E.makeFulfillmentPolicy({
    priceDelta: 'settle_at_door',
    consent: 'verbal_ok',
  });

  /**
   * Does the LOADED engine bundle actually implement `settle_at_door`?
   *
   * `shared/commerce-engine.js` is a built artefact that is republished from the
   * engine repo; the copy in this repo can lag the source. `settlementFor` is a
   * `switch` with no default, so a bundle that predates `settle_at_door` falls
   * off the end and returns `undefined` — the driver would be shown a blank
   * where "Collect $4.41 in cash" belongs, and nothing would throw.
   *
   * Probed ONCE, here, with a known input, rather than guessed per call.
   */
  const ENGINE_SETTLES_AT_DOOR = (function () {
    try {
      return E.settlementFor(POLICY, 'cash', 100) === 'driver_collects_cash'
        && E.settlementFor(POLICY, 'cash', -100) === 'driver_refunds_cash'
        && E.settlementFor(POLICY, 'card', 100) === 'card_adjustment';
    } catch (err) { return false; }
  })();

  /**
   * The settlement method for a delta under THIS policy.
   *
   * Prefers the engine. The fallback reproduces the engine's own
   * `settle_at_door` branch and nothing else — cash settles in cash and the sign
   * chooses only the DIRECTION; every other instrument is a card adjustment.
   * It exists so a stale bundle degrades to the right answer instead of to
   * `undefined`, and `capabilities.settleAtDoorFromEngine` says which ran.
   */
  function settlementMethod(paymentMethod, deltaCents) {
    if (!deltaCents) return 'none';
    if (ENGINE_SETTLES_AT_DOOR) return E.settlementFor(POLICY, paymentMethod, deltaCents);
    return paymentMethod === 'cash'
      ? (deltaCents > 0 ? 'driver_collects_cash' : 'driver_refunds_cash')
      : 'card_adjustment';
  }

  // ── Who may swap — PERMISSIONS, not job titles ────────────────────────────
  //
  // The owner: "anyone with the correct permissions inside the POS like managers,
  // sales associates and anyone that facilitates deliveries like a driver or a
  // support agent." Drivers are scoped to their OWN orders; support and POS staff
  // are broader.
  //
  // The engine's `Actor.kind` is NOT a job title even though it reads like one.
  // 'driver' means KIT-SCOPED — checkActor refuses when actor.kitId does not
  // match the order's. 'support' means not kit-scoped. So the mapping below is
  // permission → scope, and a manager riding along with a van gets 'driver'
  // scoping if that is the permission they hold, not because of their title.
  const P = {
    OWN: 'substitute:own',   // may swap on orders assigned to MY kit
    ANY: 'substitute:any',   // may swap on any order
  };

  /** Demo role → permission map. The real one comes from the POS permission set. */
  const ROLE_PERMISSIONS = {
    driver: [P.OWN],
    manager: [P.ANY],
    sales_associate: [P.ANY],
    support_agent: [P.ANY],
    // Everything else holds neither, and buildActor returns null for it.
  };

  /**
   * Estate actor spec → engine Actor, or null when this person may not swap.
   *
   * spec: { id, name, role?, permissions?, kitId? }
   * `permissions` wins when both are given — the role map is only a demo default.
   *
   * Returns null (not a 'system' actor) when there is no permission: the engine
   * refuses 'system' outright, and a surface that gets null renders no control,
   * which is the honest failure. Drivers carry kitId; a kit-scoped actor with no
   * kit cannot act, so that is null too.
   */
  function buildActor(spec) {
    if (!spec || !spec.id) return null;
    const perms = Array.isArray(spec.permissions)
      ? spec.permissions
      : (ROLE_PERMISSIONS[spec.role] || []);
    const name = spec.name || spec.id;
    if (perms.indexOf(P.ANY) >= 0) return { kind: 'support', id: spec.id, name };
    if (perms.indexOf(P.OWN) >= 0) {
      if (!spec.kitId) return null;
      return { kind: 'driver', id: spec.id, name, kitId: spec.kitId };
    }
    return null;
  }

  // ── Order status — mapped honestly, never invented ────────────────────────
  //
  // The estate has TWO order shapes and NEITHER of them has all six of the
  // engine's statuses. Where the estate has no signal, nothing is synthesised:
  // there is no estate equivalent of 'picked' (items pulled into the kit), so
  // 'picked' is never produced by this file. An invented status would silently
  // move the substitution cutoff.

  /** mobile/data.jsx TASKS + SCHEDULED — already on a driver's route. */
  const TASK_STATUS = {
    'not-started': 'assigned',
    'in-progress': 'en_route',
    'completed': 'delivered',
    'cancelled': 'cancelled',
  };

  /** pos/data.jsx ORDERS — a STORE fulfilment stage, no driver implied. */
  const POS_STAGE_STATUS = {
    verify: 'submitted',
    pack: 'submitted',
    packing: 'submitted',
    ready: 'submitted',
    done: 'delivered',
    canceled: 'cancelled',
  };

  /**
   * `ready` means packed and waiting. With a kit attached that IS the engine's
   * 'assigned'; without one it is still 'submitted'. Nothing else about a POS
   * row moves with the kit, and no POS stage means 'picked' or 'en_route'.
   */
  function posStatus(stage, hasKit) {
    const base = POS_STAGE_STATUS[stage];
    if (!base) return null;                     // unknown stage → refuse, do not guess
    return (stage === 'ready' && hasKit) ? 'assigned' : base;
  }

  /**
   * Payment instrument, which under `settle_at_door` decides whether the driver
   * takes cash or the card is re-authorized. Getting it wrong is precisely the
   * failure owner decision 2 is about, so the INSTRUMENT is preferred over the
   * timing word wherever the estate records one.
   *
   * A driver task carries `tender` ('cash' | 'card' | 'split') — that is the
   * instrument, use it. A POS row carries `pay` ('Cash' | 'Card' | 'Split' |
   * 'Prepaid'); 'Prepaid' names WHEN the money moved, not HOW. The estate does
   * not store the instrument behind a prepaid order, so it maps to 'card' — the
   * settlement class every prepaid channel here actually adjusts against. If a
   * prepaid order was in fact a wallet, this labels it a card adjustment. That
   * is a known gap in the DATA, recorded here rather than hidden.
   */
  const TENDERS = { cash: 'cash', card: 'card', split: 'split', wallet: 'wallet' };
  function paymentMethodOf(src, override) {
    if (override && TENDERS[override]) return TENDERS[override];
    const t = String(src.tender || '').toLowerCase();
    if (TENDERS[t]) return TENDERS[t];
    const pay = String(src.pay || '').toLowerCase();
    if (TENDERS[pay]) return TENDERS[pay];
    if (pay === 'prepaid') return 'card';
    return null;
  }

  const cents = (dollars) => Math.round((+dollars || 0) * 100);

  /**
   * Coerce a caller-supplied `now`.
   *
   * NOT `instanceof Date`. That check is realm-sensitive: a Date constructed in
   * a different realm — a test harness's `vm` context, an iframe, a worker —
   * has a different `Date.prototype` and fails it. The failure is silent and
   * lands in the worst possible place: the call falls back to a LIVE clock, so
   * a caller that injected a fixed time to keep records deterministic gets the
   * wall clock instead and never finds out. The engine is pure and reads no
   * clock it was not given; this is the seam where that promise could be broken
   * without anything throwing. Duck-type instead.
   */
  function asDate(v) {
    return (v && typeof v.getTime === 'function' && !isNaN(v.getTime())) ? v : new Date();
  }

  /** Deterministic stand-in id for a person the estate only stores by name. */
  function driverIdFor(name) {
    if (!name) return undefined;
    return 'drv-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * Estate order or driver task → the engine's SubmittedOrder.
   *
   * @param {object} src   a mobile/data.jsx task/scheduled row, or a
   *                       pos/data.jsx ORDERS row.
   * @param {object} [opts]
   *        kitId            the region carrying it, e.g. 'RC-02'
   *        driverId         overrides the id derived from the region's driver
   *        lane             'express' | 'scheduled' | 'pickup'
   *        paymentMethod    overrides the instrument derived from the row
   *        promotionIds     promotions applied at checkout (see the note below)
   *        discountCents    what those promotions took off
   *        catalogue        estate products, defaults to window.HW.PRODUCTS
   *        customerId
   * @returns {object|null} null when the row cannot be mapped honestly.
   *
   * ⚠️ `unitPriceCents` is documented by the engine as the price AS AGREED AT
   * CHECKOUT — not today's catalogue price. The estate stores no historical
   * price anywhere, so today's catalogue price is used as a stand-in. Every
   * money figure downstream is a delta against it, so when the real order
   * archive lands it must be threaded in HERE and nowhere else.
   *
   * ⚠️ A pos/data.jsx ORDERS row stores `items` as a COUNT, not a list. Such a
   * row has no lines to substitute and returns null; pass `opts.lines`
   * (`[{ sku, qty }]`) to supply them.
   */
  function buildOrder(src, opts) {
    if (!src) return null;
    const o = opts || {};
    const catalogue = o.catalogue || (window.HW && window.HW.PRODUCTS) || [];
    const bySku = new Map(catalogue.map((p) => [p.sku || p.id, p]));

    const rawLines = Array.isArray(o.lines) ? o.lines
      : (Array.isArray(src.items) ? src.items : null);
    if (!rawLines || rawLines.length === 0) return null;

    const lines = [];
    let subtotalCents = 0;
    for (let i = 0; i < rawLines.length; i++) {
      const it = rawLines[i];
      const p = bySku.get(it.sku || it.productId);
      if (!p) return null;                       // a line we cannot price is not mappable
      const qty = Math.max(1, +it.qty || 1);
      const unit = cents(p.price);
      lines.push({ id: it.id || ('l' + (i + 1)), productId: p.sku || p.id, quantity: qty, unitPriceCents: unit });
      subtotalCents += unit * qty;
    }

    const hasKit = !!o.kitId;
    const status = src.stage != null
      ? posStatus(src.stage, hasKit)
      : TASK_STATUS[String(src.status || '')];
    if (!status) return null;                    // unknown stage/status → refuse, do not guess

    const paymentMethod = paymentMethodOf(src, o.paymentMethod);
    if (!paymentMethod) return null;

    // Tax through the ONE estate helper, so the engine's frozen totals agree
    // with what every screen already shows. `taxBreakdown` takes dollars.
    const discountCents = Math.max(0, Math.round(+o.discountCents || 0));
    const feesCents = Math.max(0, Math.round(+o.feesCents || 0));
    const taxable = Math.max(0, subtotalCents - discountCents);
    const taxCents = (window.HW && typeof window.HW.taxBreakdown === 'function')
      ? cents(window.HW.taxBreakdown(taxable / 100).total)
      : 0;

    const order = {
      id: src.order || src.id,
      status,
      lane: o.lane || (src.appt ? 'scheduled' : 'express'),
      lines,
      paymentMethod,
      agreed: {
        subtotalCents,
        discountCents,
        feesCents,
        taxCents,
        totalCents: taxable + feesCents + taxCents,
      },
      placedAt: o.placedAt || new Date(0).toISOString(),
    };
    if (o.promotionIds && o.promotionIds.length) order.appliedPromotionIds = o.promotionIds.slice();
    if (o.kitId) order.assignedKitId = o.kitId;
    const drv = o.driverId || driverIdFor(o.driverName);
    if (drv) order.assignedDriverId = drv;
    const cust = o.customerId || src.memberId || null;
    if (cust) order.customerId = cust;
    return order;
  }

  // ── The kit — one region, one van ─────────────────────────────────────────

  /** The region stock table, when whatever page we are on has loaded it. */
  function regionStock() {
    return (window.DDATA && window.DDATA.REGION_STOCK) || null;
  }

  /**
   * regionId ('SB-01', 'RC-01', 'OC-01', 'LA-01' …) → the engine's KitInventory.
   *
   * @param {string} regionId
   * @param {object} [opts]  now (Date, required for asOf), stock (override table)
   *
   * `asOf` is ALWAYS set. The engine treats a kit with no `asOf` as undated and
   * pushes "Kit data is undated — freshness cannot be checked" onto EVERY
   * candidate, which trains drivers to ignore the warning line that also carries
   * the promotion loss. The estate has no live inventory clock, so the region's
   * demo `ageMin` is resolved against the injected `now`; when the real
   * inventory-room feed lands, its timestamp goes here.
   */
  function buildKit(regionId, opts) {
    const o = opts || {};
    const table = o.stock || regionStock();
    const row = table && table[regionId];
    if (!row) return null;
    const now = asDate(o.now);
    const ageMin = o.ageMin != null ? +o.ageMin : (+row.ageMin || 0);
    const kit = {
      kitId: regionId,
      units: Object.assign({}, row.units),
      asOf: new Date(now.getTime() - ageMin * 60000).toISOString(),
    };
    const drv = o.driverId || driverIdFor(row.driver);
    if (drv) kit.driverId = drv;
    return kit;
  }

  // ── The gate the surfaces render ──────────────────────────────────────────

  /**
   * ⚠️ EVERY ENTRY MUST BRANCH ON SIGN. The cash methods encode direction in
   * their own name; `card_adjustment` does NOT — one method covers a charge AND
   * a refund, so a single verb for it is WRONG HALF THE TIME.
   *
   * Adversarial review 2026-08-19 caught exactly that: a card order swapped
   * DOWN produced `amountCents: -8010` — the customer is owed $80.10 — and the
   * driver was shown "Re-authorize $80.10 on the card on file", which reads as
   * taking $80.10 FROM them. This is the instruction the operator physically
   * acts on at the door, so getting the direction wrong is not a copy nit.
   */
  const SETTLEMENT_COPY = {
    driver_collects_cash: { direction: 'collect', verb: 'Collect', where: 'in cash at the door' },
    driver_refunds_cash: { direction: 'refund', verb: 'Refund', where: 'in cash at the door' },
    card_adjustment: {
      owes: { direction: 'charge', verb: 'Charge', where: 'to the card on file' },
      owed: { direction: 'refund', verb: 'Refund', where: 'to the card on file' },
    },
    closeout_reconciliation: { direction: 'closeout', verb: 'Reconcile', where: 'at end of shift' },
    none: { direction: 'none', verb: '', where: '' },
  };

  /** Resolve a copy entry, branching on sign where the method does not. */
  function settlementCopy(method, owedCents) {
    const entry = SETTLEMENT_COPY[method] || SETTLEMENT_COPY.none;
    if (entry.owes || entry.owed) return owedCents >= 0 ? entry.owes : entry.owed;
    return entry;
  }

  /**
   * What the driver/agent must be shown about the money, in this order's own
   * payment method. Owner decision 2 is settled AT THE DOOR, so this is an
   * instruction to carry out now, not a line for a close-out report.
   */
  function settlementView(paymentMethod, owedCents) {
    const method = settlementMethod(paymentMethod, owedCents);
    const copy = settlementCopy(method, owedCents);
    return {
      method,
      direction: copy.direction,
      /** Signed as the engine signs it: + the customer owes more. */
      amountCents: owedCents,
      /** Always positive — what to actually hand over or take. */
      magnitudeCents: Math.abs(owedCents),
      label: owedCents === 0
        ? 'Total unchanged — collect nothing extra.'
        : copy.verb + ' ' + money(Math.abs(owedCents)) + ' ' + copy.where + '.',
      fromEngine: ENGINE_SETTLES_AT_DOOR,
    };
  }

  /**
   * The promotion gate. Owner decision 3: broken promotions are ALLOWED, with
   * the driver attesting the customer agreed — but "this needs to be flagged
   * CLEARLY on the POS and drivers app", so the loss is a headline, above the
   * confirm button, not a string in a warnings array nobody reads.
   *
   * `blocking` is the engine's own behaviour restated, not this file's opinion:
   * `applyOrderSubstitution` REFUSES without `acknowledgePromotionLoss: true`.
   */
  function promotionView(m) {
    const broken = m.promotionsBroken || [];
    if (broken.length === 0) {
      return { breaks: false, blocking: false, lost: [], lossCents: 0, headline: null, acknowledgeLabel: null };
    }
    const names = broken.map((p) => '“' + p.name + '”').join(', ');
    return {
      breaks: true,
      blocking: true,
      lost: broken.map((p) => ({
        ruleId: p.ruleId, name: p.name, valueCents: p.valueCents, label: money(p.valueCents),
      })),
      lossCents: m.promotionLossCents,
      headline: 'This removes ' + names + '. The customer loses ' + money(m.promotionLossCents) + ' they already earned.',
      acknowledgeLabel: 'I told the customer they lose ' + names + ' (' + money(m.promotionLossCents) + ').',
    };
  }

  /**
   * One candidate, flattened into exactly what a confirm screen has to show.
   *
   * `candidate` is the ENGINE'S own object, by reference and unmodified — it is
   * carried here so a surface can hand the row straight to `commitGoverned`
   * without indexing back into the plan and risking an off-by-one between what
   * was displayed and what gets committed.
   */
  function gateFor(candidate, order, mode) {
    const m = candidate.money;
    return {
      mode,
      candidate,
      productId: candidate.product.id,
      name: candidate.product.brand + ' ' + candidate.product.name,
      priceDeltaLabel: candidate.priceDeltaLabel,
      reason: candidate.reason,
      unitsAvailable: candidate.unitsAvailable,
      newTotalCents: m.newTotalCents,
      newTotalLabel: money(m.newTotalCents),
      settlement: settlementView(order.paymentMethod, m.customerOwesDeltaCents),
      promotion: promotionView(m),
      requiresApproval: candidate.verdict.requiresApproval,
      /** Restated from the engine's verdict; the commit refuses without it. */
      requiresPromotionAcknowledgement: candidate.verdict.requiresPromotionAcknowledgement,
      warnings: candidate.verdict.warnings.slice(),
    };
  }

  /**
   * Repair ONE field on a stale engine bundle, and nothing else.
   *
   * When the loaded bundle predates `settle_at_door`, `candidate.money.settlement`
   * is `undefined`. `applyOrderSubstitution` copies that value verbatim into two
   * places that get PERSISTED — the SubstitutionRecord and the
   * ReconciliationIntent. An audit row that cannot say how the money was settled
   * fails at the one question it exists to answer, six months later, in a
   * dispute. Displaying the right figure while filing a blank one would be worse
   * than either.
   *
   * So the candidate handed to the engine carries the settlement the gate showed,
   * from the same fallback, on a SHALLOW COPY — the plan and its candidates are
   * never mutated. When the bundle is refreshed the probe goes true and this
   * becomes a no-op that returns the candidate untouched.
   */
  function withSettlement(candidate, paymentMethod) {
    if (ENGINE_SETTLES_AT_DOOR) return candidate;
    const fixed = settlementMethod(paymentMethod, candidate.money.customerOwesDeltaCents);
    if (candidate.money.settlement === fixed) return candidate;
    return Object.assign({}, candidate, {
      money: Object.assign({}, candidate.money, { settlement: fixed }),
    });
  }

  const REFUSALS = {
    no_engine_products: 'No product catalogue was supplied, so nothing can be offered.',
    actor_not_permitted: 'You do not have permission to change items on this order.',
    order_not_mappable: 'This order could not be read: its status, payment method or line items are missing or unrecognised.',
    kit_unknown: 'No stock is loaded for that region, so there is nothing this van can offer.',
    line_not_found: 'That line is not on this order.',
  };
  const refuse = (code, message) => ({ ok: false, refusal: { code, message: message || REFUSALS[code] || code }, plan: null, gate: null });

  /**
   * Plan a governed substitution.
   *
   * @param {object} input
   *        order      SubmittedOrder (from buildOrder)
   *        kit        KitInventory (from buildKit)
   *        lineId     the line being replaced
   *        actor      engine Actor (from buildActor) — null means "no permission"
   *        intent     'upsell' (default) | 'replacement'
   *        catalogue  estate products, defaults to window.HW.PRODUCTS
   *        rules      promotion rules applied at checkout
   *        now        Date — injected, never read from a clock here
   *        modes      defaults to the engine's UPSELL_MODES (upgrade first)
   *
   * @returns {object} { ok, refusal, plan, gate, policy }
   *   `plan` is the engine's OrderSubstitutionPlan, BYTE FOR BYTE as returned —
   *   nothing here rewrites it, reorders it or filters it. `gate` is a parallel
   *   view carrying the figures and copy a confirm screen needs, so a surface
   *   never has to re-derive money or re-decide what is allowed.
   */
  function planGoverned(input) {
    const i = input || {};
    if (!i.actor) return refuse('actor_not_permitted');
    if (!i.order) return refuse('order_not_mappable');
    if (!i.kit) return refuse('kit_unknown');

    const catalogue = i.catalogue || (window.HW && window.HW.PRODUCTS) || [];
    const products = catalogue.map(SWAP.toEngineProduct).filter(Boolean);
    if (products.length === 0) return refuse('no_engine_products');

    const plan = E.planOrderSubstitution({
      order: i.order,
      kit: i.kit,
      lineId: i.lineId,
      actor: i.actor,
      intent: i.intent || 'upsell',
      products,
      rules: i.rules || [],
      policy: POLICY,
      now: asDate(i.now),
      modes: i.modes || E.UPSELL_MODES,
    });

    // The engine returns null for a line or product it cannot find at all.
    if (!plan) return refuse('line_not_found');

    if (plan.blocked) {
      return { ok: false, refusal: { code: plan.blocked.code, message: plan.blocked.message }, plan, gate: null, policy: POLICY };
    }

    const byMode = {};
    const flat = [];
    const modes = Object.keys(plan.candidatesByMode);
    for (const mode of modes) {
      const rows = (plan.candidatesByMode[mode] || []).map((c) => gateFor(c, i.order, mode));
      byMode[mode] = rows;
      for (const r of rows) flat.push(r);
    }

    return {
      ok: true,
      refusal: null,
      plan,
      policy: POLICY,
      gate: {
        orderId: plan.orderId,
        lineId: plan.lineId,
        kitId: plan.kitId,
        intent: plan.intent,
        candidateCount: plan.candidateCount,
        byMode,
        all: flat,
        /** True when ANY offer on the table costs the customer a promotion. */
        anyBreaksPromotion: flat.some((r) => r.promotion.breaks),
        /** The engine's own copy for why a ladder is empty. */
        diagnostics: plan.diagnostics,
      },
    };
  }

  /**
   * Commit a governed substitution.
   *
   * @param {object} input
   *        order, plan, candidate   as returned by planGoverned / the engine
   *        actor                    engine Actor
   *        reason                   a SubstitutionReason
   *        attested                 TRUE only when the actor confirmed the
   *                                 customer agreed (owner decision: verbal_ok)
   *        acknowledgePromotionLoss TRUE only when the actor was shown the
   *                                 promotion headline and confirmed it
   *        note                     optional free text onto the consent record
   *        now, recordId            injected, so records are deterministic
   *
   * @returns {object} { ok, result, refusal } — `result` is the engine's
   *   ApplyOrderSubstitutionResult unchanged: the updated order, the
   *   SubstitutionRecord to persist, and the inventory / reconciliation /
   *   notification intents for the integration to carry out.
   *
   * Two things this deliberately does NOT do:
   *   • it never defaults `acknowledgePromotionLoss` to true. The customer
   *     earned that discount; someone has to have seen it going away.
   *   • when `attested` is false it does not refuse locally — it passes consent
   *     channel 'not_required' and lets the ENGINE refuse. The gate stays the
   *     engine's, so a policy change there changes behaviour here for free.
   */
  function commitGoverned(input) {
    const i = input || {};
    if (!i.actor) return { ok: false, refusal: { code: 'actor_not_permitted', message: REFUSALS.actor_not_permitted } };
    if (!i.order || !i.plan || !i.candidate) {
      return { ok: false, refusal: { code: 'nothing_to_commit', message: 'No plan or candidate was supplied.' } };
    }

    const now = asDate(i.now);
    const consent = i.attested === true
      ? {
          // 'driver_verbal' vs 'support_verbal' records WHO attested. Both
          // satisfy verbal_ok; only the record can tell them apart afterwards.
          channel: i.actor.kind === 'driver' ? 'driver_verbal' : 'support_verbal',
          recordedByActorId: i.actor.id,
          recordedAt: now.toISOString(),
        }
      : { channel: 'not_required', recordedAt: now.toISOString() };
    if (i.note) consent.note = i.note;

    const result = E.applyOrderSubstitution({
      order: i.order,
      plan: i.plan,
      candidate: withSettlement(i.candidate, i.order.paymentMethod),
      actor: i.actor,
      reason: i.reason || 'customer_upgraded',
      consent,
      acknowledgePromotionLoss: i.acknowledgePromotionLoss === true,
      policy: POLICY,
      now,
      recordId: i.recordId,
    });

    if (!result.ok) return { ok: false, refusal: result.refusal, result };
    return { ok: true, refusal: null, result };
  }

  window.HWGovern = {
    // policy + capability, so a surface can show what regime it is under
    POLICY,
    PERMISSIONS: P,
    ROLE_PERMISSIONS,
    REASONS: E.SUBSTITUTION_REASONS,
    REASONS_BY_INTENT: E.REASONS_BY_INTENT,
    MODES: E.UPSELL_MODES,
    capabilities: {
      /** False = the loaded engine bundle predates priceDelta 'settle_at_door'. */
      settleAtDoorFromEngine: ENGINE_SETTLES_AT_DOOR,
      /** False = delivery/ddata.jsx is not loaded on this page; buildKit returns null. */
      get regionStock() { return !!regionStock(); },
    },
    // builders
    buildActor,
    buildOrder,
    buildKit,
    // the governed flow
    planGoverned,
    commitGoverned,
    // exposed for tests and for a surface that already holds engine objects
    settlementView,
    promotionView,
    engine: E,
  };
})();
