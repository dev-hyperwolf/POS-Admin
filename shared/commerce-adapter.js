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

  window.HWSwap = { toEngineProduct, candidates, emptyNote, MODES: E.SWAP_MODES, engine: E };
})();
