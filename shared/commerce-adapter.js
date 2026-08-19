/* ── The one bridge from this estate's product shape to the swap engine ──────
 *
 * `shared/commerce-engine.js` is @hyperwolf/commerce-logic, built from
 * dev-hyperwolf/hyperwolf-commerce-logic. It is UI-agnostic and knows nothing
 * about this repo. This file is the only place the two shapes are mapped, so
 * the POS and the driver app rank alternatives with THE SAME CODE as the web
 * cart instead of each growing its own idea of "similar".
 *
 * Exposes `window.HWSwap`. Degrades to null when the engine has not loaded —
 * callers render no swap control rather than a broken one.
 *
 * MONEY IS INTEGER CENTS inside the engine. This estate stores dollars. The
 * conversion happens here and nowhere else.
 */
(function () {
  'use strict';

  const E = typeof window !== 'undefined' && window.HWCommerce;
  if (!E) { window.HWSwap = null; return; }

  const cents = (dollars) => Math.round((+dollars || 0) * 100);

  /** '1g' → 1 · '3.5g' → 3.5 · '10mg' → null (mg is an EDIBLES dose, not a weight). */
  function grams(wt) {
    if (typeof wt !== 'string') return undefined;
    const m = wt.trim().match(/^([\d.]+)\s*(g|mg)$/i);
    if (!m) return undefined;
    return m[2].toLowerCase() === 'g' ? +m[1] : undefined;
  }

  const STRAIN = { indica: 'indica', sativa: 'sativa', hybrid: 'hybrid' };

  /**
   * POS/driver product → engine Product.
   *
   * `brand` is REQUIRED by the engine on purpose: a swap row cannot render
   * without one, which is the type system enforcing a gap design kept leaving.
   */
  function toEngineProduct(p) {
    if (!p) return null;
    const out = {
      id: p.id || p.sku,
      sku: p.sku || p.id,
      name: p.name,
      brand: p.brand || '—',
      category: p.cat || p.category || '—',
      price: cents(p.price),
    };
    const w = grams(p.wt);
    if (w != null) out.sizeGrams = w;
    if (p.was != null) out.compareAtPrice = cents(p.was);
    if (p.thc != null) out.thcPercent = +p.thc;
    const s = STRAIN[String(p.strain || '').toLowerCase()];
    if (s) out.strainType = s;
    // POS margin is a 0..1 fraction; the engine wants 0..100.
    if (p.margin != null) out.marginPct = Math.round(+p.margin * 100);
    return out;
  }

  /**
   * Ranked alternatives for one line, in the engine's three ladders.
   *
   * `pool` is whatever the CALLER says is eligible, and that is the whole point
   * of the split: in the POS it is the store catalogue; in the driver app it is
   * ONE van's kit. Same ranking, different pool.
   *
   * Returns `{ similar, cheaper, stronger, diagnostics }` where each candidate
   * carries `product` (the ORIGINAL estate object, not the engine one),
   * `priceDeltaLabel`, `unitsAvailable`, `fillable`, `partial` and `shortfall`.
   */
  function candidates(opts) {
    const current = toEngineProduct(opts.current);
    if (!current) return null;

    const config0 = Object.assign({}, E.defaultSwapConfig, opts.config || {});

    const bySrc = new Map();
    const pool = [];
    for (const raw of (opts.pool || [])) {
      const ep = toEngineProduct(raw);
      if (!ep || ep.id === current.id) continue;
      // ⚠️ CATEGORY RESTRICTION IS THE CALLER'S JOB HERE.
      // `buildCandidates` is the SHARED substitution core and deliberately
      // ranks whatever pool it is handed — `planSwap` is what slices the
      // catalogue by category before calling it. Using the core directly means
      // doing that slice ourselves; without it the POS cheerfully offers a
      // Pre-Roll to replace Flower, which config.restrictToSameCategory exists
      // to prevent and which customers read as a bug.
      if (config0.restrictToSameCategory && ep.category !== current.category) continue;
      bySrc.set(ep.id, raw);
      pool.push(ep);
    }

    const quantity = Math.max(1, opts.quantity || 1);
    const unitsFor = opts.unitsFor || ((ep) => {
      const raw = bySrc.get(ep.id);
      return raw && raw.qty != null ? raw.qty : 0;
    });

    const config = config0;
    const built = E.buildCandidates({
      current, pool, quantity, unitsFor, config,
      exclude: new Set(opts.exclude || []),
      poolLabel: opts.poolLabel || 'this catalogue',
      modes: E.SWAP_MODES,
    });

    const hydrate = (list) => (list || []).map((c) => Object.assign({}, c, {
      engineProduct: c.product,
      product: bySrc.get(c.product.id) || c.product,
    }));

    return {
      similar: hydrate(built.byMode.similar),
      cheaper: hydrate(built.byMode.cheaper),
      stronger: hydrate(built.byMode.stronger),
      diagnostics: built.diagnostics,
      total: built.total,
    };
  }

  /** Why a ladder is empty, in a sentence safe to render. */
  function emptyNote(result, mode, currentCat) {
    const d = result && result.diagnostics && result.diagnostics.perMode
      && result.diagnostics.perMode[mode];
    if (d && d.note) return d.note;
    if (mode === 'cheaper') return 'Nothing cheaper is in stock.';
    if (mode === 'stronger') return 'Nothing stronger is in stock.';
    return `Nothing else in ${currentCat || 'this category'} is available.`;
  }

  // ── Upsell ────────────────────────────────────────────────────────────────

  /**
   * Assemble the engine's EvalContext from this estate's data.
   *
   * The engine is PURE: it does no I/O and reads no clock it was not given, so
   * everything it needs arrives here. `now` is passed in rather than read so a
   * caller can make time-of-day promotion rules deterministic in a test.
   */
  function buildContext(opts) {
    const catalogue = (opts.catalogue || []).filter(Boolean);
    const products = [];
    const availability = {};
    for (const raw of catalogue) {
      const ep = toEngineProduct(raw);
      if (!ep) continue;
      products.push(ep);
      // One stock figure per product in this estate. Express is a DRIVER'S KIT
      // and scheduled is the loadable pool; without per-lane data we report the
      // same number for both rather than inventing a split.
      const units = raw.qty != null ? raw.qty : 0;
      availability[ep.id] = { express: units, scheduled: units };
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = (opts.orderItems || []).map((it, i) => {
      const raw = catalogue.find((p) => p.sku === it.sku || p.id === it.sku);
      const ep = raw && toEngineProduct(raw);
      return ep && byId.has(ep.id) ?
        { id: 'l' + i, productId: ep.id, quantity: it.qty || 1, lane: opts.lane || 'express' } : null;
    }).filter(Boolean);

    // What the customer already bought is the only affinity signal this estate
    // has. The engine turns it into "Usually buys Flower" / a known brand.
    const favouriteCategories = [], purchasedBrands = [];
    for (const l of lines) {
      const p = byId.get(l.productId);
      if (!p) continue;
      if (favouriteCategories.indexOf(p.category) < 0) favouriteCategories.push(p.category);
      if (purchasedBrands.indexOf(p.brand) < 0) purchasedBrands.push(p.brand);
    }

    return {
      snapshot: { products, availability, asOf: opts.asOf },
      cart: { lines },
      customer: Object.assign({
        favoriteCategories: favouriteCategories,
        purchasedBrands: purchasedBrands,
      }, opts.customer || {}),
      lanes: E.defaultLanes,
      now: opts.now || new Date(),
    };
  }

  /**
   * Ranked recommendations for a surface, as the ENGINE ranks them.
   *
   * Replaces hand-rolled "same brand or same category" filters. The engine
   * weighs favourite category, category affinity, sale, known brand, potency,
   * stock depth, margin — and, dominating all of them, whether the item unlocks
   * a promotion the order is close to.
   *
   * Returns entries carrying the ORIGINAL estate product plus the engine's own
   * `reason` / `headline` copy, so a card can say WHY it is being shown.
   */
  function recommendations(opts) {
    const catalogue = (opts.catalogue || []).filter(Boolean);
    const ctx = buildContext({
      catalogue,
      orderItems: opts.orderItems,
      customer: opts.customer,
      lane: opts.lane,
      now: opts.now,
    });
    const surface = opts.surface || 'cart_add_to_order';
    const limit = opts.limit || 24;

    // Slot counts are tuned for the web cart's rails; a full driver grid wants
    // more. Override the slot rather than the ranking.
    const config = Object.assign({}, E.defaultConfig, {
      upsell: Object.assign({}, E.defaultConfig.upsell, {
        slotsBySurface: Object.assign({}, E.defaultConfig.upsell.slotsBySurface, { [surface]: limit }),
      }),
    });

    let offers = [];
    try {
      offers = E.getUpsells(ctx, surface, { config, rules: opts.rules || [] }) || [];
    } catch (err) {
      return null; // caller falls back to its own list rather than rendering nothing
    }

    const bySku = new Map(catalogue.map((p) => [p.id || p.sku, p]));
    return offers.map((o) => ({
      product: bySku.get(o.product.id) || o.product,
      reason: o.reason,
      headline: o.headline,
      subline: o.subline,
      kind: o.kind,
      score: o.score,
    })).filter((x) => x.product);
  }

  window.HWSwap = { toEngineProduct, candidates, emptyNote, buildContext, recommendations,
    MODES: E.SWAP_MODES, engine: E };
})();
