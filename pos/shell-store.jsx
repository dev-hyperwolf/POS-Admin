// ── Product shells · store + taxonomy ──────────────────────────────────────
// One shell = one product family. Brand + format + category + size + price +
// traits + delivery box are set ONCE here and inherited by every variation.
// Batches still own quantity, cost, barcode and potency.
;(function () {
  const HW = window.HW;

  // Categories mirror the live hyperwolf.com/shop menu. slug = real URL segment.
  const TAX = [
    { key: 'Flower', name: 'Flower', slug: 'flower', units: ['g', 'oz'], unit: 'g', presets: ['1g', '3.5g', '7g', '14g', '28g'],
      subs: ['Premium Flower', 'Smaller Bud Flower', 'Value Flower', 'Bulk Flower 5g–28g', 'Infused Flower', 'Smalls'],
      wm: 'Flower › Bud', traits: [{ label: 'Format', value: 'Whole flower' }, { label: 'Cure', value: 'Cold cure' }, { label: 'Infused', value: 'No' }] },
    { key: 'Pre-Rolls', name: 'Pre-Rolls', slug: 'prerolls', units: ['g', 'ct', 'oz'], unit: 'g', presets: ['0.5g', '1g', '1.75g', '2.5g', '5g'],
      subs: ['Single Pre-Roll', 'Multipacks', 'Infused Pre-Rolls', 'Blunts', 'Hash Holes'],
      wm: 'Pre Roll › Single', traits: [{ label: 'Pieces per pack', value: '1' }, { label: 'Infused', value: 'No' }] },
    { key: 'Vapes', name: 'Vapes', slug: 'vapes', units: ['g', 'ml', 'ct'], unit: 'g', presets: ['0.3g', '0.5g', '1g', '2g'],
      subs: ['All-In-One', 'Cartridges', 'Pods', 'Disposables', 'Batteries'],
      wm: 'Vape Pens › All-In-One', traits: [{ label: 'Hardware', value: 'All-in-one' }, { label: 'Extract', value: 'Distillate' }] },
    { key: 'Concentrates', name: 'Concentrates', slug: 'concentrates', units: ['g', 'ct'], unit: 'g', presets: ['0.5g', '1g', '2g', '3.5g'],
      subs: ['Live Resin', 'Live Rosin', 'Badder', 'Diamonds', 'Sauce', 'Hash', 'Solventless', 'Applicators'],
      wm: 'Concentrates › Live Resin', traits: [{ label: 'Extract type', value: 'Live Resin' }, { label: 'Consistency', value: 'Badder' }] },
    { key: 'Edibles', name: 'Edibles', slug: 'edibles', units: ['mg', 'g', 'ct', 'ml'], unit: 'mg', presets: ['10mg', '100mg', '200mg', '1000mg'],
      subs: ['Gummies', 'Chocolates', 'Baked Goods', 'Drinks', 'Tablets', 'Microdose', 'High Dose'],
      wm: 'Edibles › Gummies', traits: [{ label: 'Pieces per pack', value: '10' }, { label: 'Serving size', value: '10 mg' }] },
    { key: 'Wellness', name: 'CBD & Wellness', slug: 'cbd-wellness', units: ['mg', 'ml', 'g', 'ct'], unit: 'ml', presets: ['30ml', '60ml', '100mg', '500mg'],
      subs: ['Tinctures', 'Topicals', 'CBD', 'Ratio Products', 'Capsules', 'Pet'],
      wm: 'Wellness › Tinctures', traits: [{ label: 'Ratio', value: '1:1' }, { label: 'Format', value: 'Tincture' }] },
    { key: 'Accessories', name: 'Accessories', slug: 'accessories', units: ['ct', 'g'], unit: 'ct', presets: ['1ct', '2ct', '5ct'],
      subs: ['Batteries', 'Papers & Wraps', 'Grinders', 'Lighters', 'Glass', 'Storage', 'Apparel'],
      wm: 'Gear › Accessories', traits: [{ label: 'Material', value: '—' }] }];

  const catDef = (key) => TAX.find((c) => c.key === key) || TAX[0];

  // Delivery boxes — which box on the van a family rides in.
  let BOXES = ['Flower Box 1', 'Flower Box 2', 'Pre-roll Box 1', 'Vape Box 1', 'Vape Box 2', 'Edible Box', 'Concentrate bin 1', 'Cooler'];

  const FORMAT_BY_CAT = { Flower: 'Eighth Jar 3.5g', Vapes: 'All-In-One Vape 1g', 'Pre-Rolls': 'Pre-Roll 1g', Concentrates: 'Live Resin 1g', Edibles: 'Gummies 100mg 10pk', Wellness: 'Tincture 30ml', Accessories: 'Accessory' };
  const SHELL_FORMATS = ['All-In-One Vape 1g', 'Cartridge 1g', 'Cartridge .5g', 'Eighth Jar 3.5g', 'Quarter Jar 7g', 'Pre-Roll 1g', 'Pre-Roll 5-pack', 'Infused Pre-Roll 1.5g', 'Gummies 100mg 10pk', 'Live Resin 1g', 'Rosin 1g', 'Tincture 30ml'];
  const BOX_BY_CAT = { Flower: 'Flower Box 1', Vapes: 'Vape Box 1', 'Pre-Rolls': 'Pre-roll Box 1', Concentrates: 'Concentrate bin 1', Edibles: 'Edible Box', Wellness: 'Cooler', Accessories: 'Cooler' };

  // ── size parsing — "3.5g", "1/8", "eighth", "100 mg" all land correctly ──
  function parseSize(raw, curUnit, allowed) {
    const t = String(raw).toLowerCase().trim();
    const named = { eighth: ['3.5', 'g'], '1/8': ['3.5', 'g'], quarter: ['7', 'g'], '1/4': ['7', 'g'], half: ['14', 'g'], '1/2': ['14', 'g'], ounce: ['28', 'g'], zip: ['28', 'g'], '1/16': ['1.75', 'g'], gram: ['1', 'g'] };
    if (named[t]) return { amount: named[t][0], unit: allowed.includes(named[t][1]) ? named[t][1] : curUnit };
    const m = t.match(/^([0-9]*\.?[0-9]*)\s*([a-z]*)$/);
    if (!m) return { amount: String(raw).replace(/[^0-9.]/g, ''), unit: curUnit };
    const alias = { g: 'g', gram: 'g', grams: 'g', mg: 'mg', milligram: 'mg', ml: 'ml', milliliter: 'ml', ct: 'ct', count: 'ct', pc: 'ct', pcs: 'ct', ea: 'ct', oz: 'oz', ounce: 'oz' };
    const hit = alias[m[2]];
    return { amount: m[1], unit: hit && allowed.includes(hit) ? hit : curUnit };
  }
  const splitSize = (w) => ({ amount: String(w || '').replace(/[a-z]+$/i, ''), unit: String(w || '').replace(/^[0-9.]+/, '') || 'g' });
  const mono1 = (s) => ((s || '?').trim()[0] || '?').toUpperCase();
  const mono2 = (s) => (s || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const familyPath = (s) => s.brand + ' › ' + s.sub + ' › ' + s.weight;
  const menuPath = (s) => 'hyperwolf.com/shop/' + catDef(s.cat).slug + '/' + slugify(s.sub || '');

  // ── seed from the live catalog, grouped brand × category ──
  function seed() {
    const byBrandCat = {};
    HW.PRODUCTS.forEach((p) => {const k = p.brand + '|' + p.cat;(byBrandCat[k] = byBrandCat[k] || []).push(p);});
    return Object.keys(byBrandCat).map((k, i) => {
      const items = byBrandCat[k], first = items[0], def = catDef(first.cat);
      const fmtName = FORMAT_BY_CAT[first.cat] || 'Eighth Jar 3.5g';
      const size = splitSize(first.wt || def.presets[1] || '1g');
      const unit = def.units.includes(size.unit) ? size.unit : def.unit;
      // ── UNIT COST: AVERAGED FROM WHAT, EXACTLY ────────────────────────────
      // This averaged `p.cost`, which was the SKU character-hash (pos/data.jsx
      // P_(), now removed). Averaging a hash produces a hash. It is `null`
      // unless a real cost has actually been written onto a member of the
      // family, and the row that renders it says which (see sharedRows).
      const costs = items.map((p) => p.cost).filter((c) => typeof c === 'number' && isFinite(c));
      const avgCost = costs.length ? Math.round(costs.reduce((a, c) => a + c, 0) / costs.length * 100) / 100 : null;
      const costsKnown = costs.length, costsTotal = items.length;
      // Base price = the price most of the family actually sells at, so the
      // shell reads as the family norm and only genuine outliers show OVERRIDE.
      // A shell's EFFECTIVE price is always `sale || price`, and it always
      // equals base — so "inherited" means one number across the whole line.
      const tally = {};items.forEach((p) => {tally[p.price] = (tally[p.price] || 0) + 1;});
      const base = Number(Object.keys(tally).sort((a, b) => tally[b] - tally[a] || b - a)[0]);
      // Only treat a was-price as a promo when it is plausibly the list price.
      const promo = items.map((p) => p.was || 0).filter((w) => w > base && w <= base * 2);
      const retail = promo.length ? Math.max(...promo) : base;
      const sale = promo.length ? base : 0;
      return {
        id: 'SH-' + String(1040 + i * 7),
        brand: first.brand, format: fmtName, name: first.brand + ' · ' + fmtName,
        cat: first.cat, sub: def.subs[0], ptype: first.cat === 'Accessories' ? 'Accessory' : 'Cannabis',
        unit, netW: size.amount || '1', weight: (size.amount || '1') + unit, pack: first.cat === 'Edibles' ? '10' : '1',
        kit: BOX_BY_CAT[first.cat] || 'Cooler',
        wmNode: def.wm,
        // ⚠️ `stores` WAS `1 + first.sku.charCodeAt(1) % 4` — a count of retail
        // locations carrying this product line, taken from THE SECOND LETTER OF
        // A SKU, rendered as "3 stores" on the shell list (pos/shells.jsx:220)
        // and in the product-shell header (pos/product-shell.jsx:62).
        //
        // It is NULL, not 1. The estate claims four stores (HW.STORE.count = 4,
        // and the catalog header prints "24 SKUs across 4 stores"), but nothing
        // anywhere records WHICH of them carries a given shell — there is no
        // per-store distribution table on the mock rows, in the wm-demo
        // database or on /api/state. "1 store" would be a second invented
        // figure standing where the first one was.
        stores: null,
        hue: first.hue, price: retail, sale: sale, cost: avgCost,
        costsKnown, costsTotal,
        traits: def.traits.map((t) => ({ ...t })),
        // ── `sample: false` THREW AWAY THE ONE FLAG THIS SCREEN PROMISES TO KEEP ─
        //
        // The Display-sample toggle (pos/product-shell.jsx:342) confirms, in the
        // flow's own words: "Marked as a display sample — Kept off the sellable
        // menu, still tracked as a full product profile." Rebuilding every
        // variation with a hardcoded `false` broke that promise inside POS,
        // before anything downstream got the chance to break it.
        //
        // 🔴 THE BIGGER FINDING THE HARDCODED `false` WAS HIDING: no stored item
        // carries `sample` at all. Three writers produce product rows in this
        // build — pos/data.jsx `P_()` (:38-55), shared/demo-seed.js `product()`
        // (:196-207) and the live adapter shared/hw-live.js (:580-617) — and not
        // one of them has this field. So the flag's only home was the variation
        // object inside SHELLS, which lives exactly as long as the page. Reading
        // `p.sample` here is half the repair; `addVariation` writing it onto the
        // product row is the other half, and together they close the round trip
        // for any variation whose SKU has a row.
        //
        // `active` IS NOT A STAND-IN, and is never read backwards. It is also
        // false for `b.skip` and for qty === 0, so "inactive" cannot be decoded
        // as "is a sample" — that inference is exactly how a display sample and
        // an out-of-stock product become indistinguishable. The implication runs
        // ONE way only, and that direction is enforced: a row flagged as a
        // sample is never rebuilt as sellable, because a sample that comes back
        // active is a sample back on the menu.
        variations: items.map((p) => ({ sku: p.sku, name: p.name, price: p.price, override: p.price !== base, strain: p.strain, sample: !!p.sample, active: !!p.active && !p.sample, qty: p.qty, thumb: p }))
      };
    });
  }

  let SHELLS = null;
  const subs = new Set();
  const emit = () => subs.forEach((f) => f());
  function allShells() {if (!SHELLS) SHELLS = seed();return SHELLS;}
  function shellById(id) {return allShells().find((s) => s.id === id) || null;}
  function shellOf(p) {return allShells().filter((s) => s.brand === p.brand && s.cat === p.cat)[0] || allShells()[0];}
  function totalStock(s) {return s.variations.reduce((a, v) => a + (v.qty || 0), 0);}
  // What a variation sells for when it inherits — the promo price if one is
  // running, otherwise retail. Every "inherited" tag refers to this number.
  function effectivePrice(s) {return !s ? 0 : s.sale ? s.sale : s.price;}

  // React binding — any component calling useShells() re-renders on a mutation.
  function useShells() {
    const [, bump] = React.useState(0);
    React.useEffect(() => {const cb = () => bump((n) => n + 1);subs.add(cb);return () => subs.delete(cb);}, []);
    return allShells();
  }

  // A SHELL HAS NO SERVER REPRESENTATION, on purpose — wmdemo's catalog is
  // flat products; brand/format/category/price only exist there per-SKU,
  // encoded into each product's own fields (see productPayload below). So
  // this staying local-only is correct, not the same gap createVariation
  // fixes. What IS a real, undressed gap: editing a shell that already has
  // variations does not re-push any of them — a price or brand change here
  // is invisible to every SKU already created under it until something else
  // (a rename, a manual re-push) touches that SKU. Not fixed here: looping a
  // full /api/product upsert over up to ~50 variations from a single form
  // save is a different-shaped change (batching, partial-failure reporting,
  // rate limits) than "wire the one write this form already makes."
  function saveShell(draft, editingId) {
    const list = allShells();
    const def = catDef(draft.cat);
    const weight = (draft.netW || '1') + draft.unit;
    const common = {
      brand: (draft.brand || '').trim() || 'New Brand', cat: draft.cat, sub: draft.sub || def.subs[0],
      format: draft.format || FORMAT_BY_CAT[draft.cat] || 'Eighth Jar 3.5g',
      unit: draft.unit, netW: draft.netW || '1', weight, pack: draft.pack || '1', kit: draft.kit || '—',
      ptype: draft.ptype || 'Cannabis', wmNode: draft.wmNode || def.wm,
      price: parseFloat(draft.price) || 0, sale: parseFloat(draft.sale) || 0,
      traits: (draft.traits || []).filter((t) => t.label.trim()).map((t) => ({ label: t.label.trim(), value: t.value.trim() || '—' })),
    };
    common.name = common.brand + ' · ' + common.format;
    let id = editingId;
    if (editingId) {
      SHELLS = list.map((s) => s.id === editingId ? { ...s, ...common } : s);
    } else {
      id = 'SH-' + String(2000 + Math.floor(Math.random() * 900));
      // cost is NULL, not 0. `0` renders as "$0" — a wholesale cost of nothing,
      // and a 100% margin — where the truth is that no cost has been entered.
      SHELLS = [{ id, ...common, stores: null, hue: Math.floor(Math.random() * 360), cost: null, costsKnown: 0, costsTotal: 0, variations: [] }, ...list];
    }
    emit();
    return id;
  }

  // ── real write path: POST /api/product ──────────────────────────────────
  // wmdemo's /api/product (server.py) is a FULL UPSERT — catalog.upsert_product
  // replaces the whole stored JSON blob for a sku, so every field this shell +
  // variation actually own has to go in every call, or the rest of the record
  // is silently erased server-side (server.py's own comment on this route
  // names `sample` as the field that used to be lost exactly this way).
  //
  // CATEGORY. wmdemo/engine.build_item_payload normalises OUR spelling before
  // it ever reaches Weedmaps — taxonomy._norm_category + CATEGORY_ALIASES
  // (wmdemo/taxonomy.py:246-284) — 'Vapes' -> 'Vape Pens', 'Pre-Rolls' ->
  // 'Pre Roll', 'Wellness' and 'Accessories' are already canonical. Verified
  // by reading that table 2026-08-28: every TAX key above already resolves.
  // So shell.cat is sent AS-IS; there is no separate category-assignment step
  // to build here, and no mapping/category screen this flow needs to touch.
  function productPayload(shell, v, b) {
    // v.strain here is the GENETICS CLASS (Indica/Sativa/Hybrid/CBD or null —
    // see AddProductFlow.commit()), not a strain NAME. The API's `strain` is
    // the name (server.py, catalog.py) and v.name IS that name — it is the
    // field this whole flow calls "flavour".
    const genetics = v.strain ? String(v.strain).toLowerCase() : null;
    const body = {
      sku: v.sku,
      name: [shell.brand, v.name, shell.format].filter(Boolean).join(' '),
      category: shell.cat,
      price: typeof v.price === 'number' ? v.price : parseFloat(v.price) || 0,
      weight_unit: shell.unit, weight_value: shell.netW || '1',
      genetics,
      strain: v.name || null,
      description: v.desc || null,
      brand_name: shell.brand || null,
      items_per_pack: shell.pack && shell.pack !== '1' ? shell.pack : null,
      sample: !!v.sample,
      inventory: v.qty || 0
    };
    // THC/CBD are real top-level fields on the catalog product (server.py) —
    // there is NO batch/lot table behind them (GET /api/state.batches is
    // always empty; see the note on costRow above), so this is the only place
    // they are ever actually stored, whatever the wizard's "batch" step and
    // its cost/barcode/METRC/expiry fields might imply.
    if (b && !b.skip) {
      if (b.thc !== '' && b.thc != null) body.thc = b.thc;
      if (b.cbd !== '' && b.cbd != null) body.cbd = b.cbd;
    }
    // v.photo is a data: URL from FileReader (product-shell.jsx readImg) — it
    // is never sent as `image_url`. There is no image-hosting endpoint in
    // this build, and image_url is documented (engine.py build_item_payload)
    // as a field WM's PUT expects to be a real URL. Sending the raw base64
    // would either bloat every push or get silently rejected by WM — worse
    // than the honest gap this leaves, which the "done" screen names.
    return body;
  }

  // THE one write. Never rejects — mirrors window.HW_LIVE.post's own contract
  // (post()'s docstring, shared/hw-live.js:184), so a caller cannot mistake a
  // refusal for a network error and report a committed write as one.
  function pushProduct(body) {
    const post = window.HW_LIVE && typeof window.HW_LIVE.post === 'function' ? window.HW_LIVE.post : null;
    if (!post) {
      return Promise.resolve({ ok: false, code: 0, error: 'no-write-path',
        hint: 'shared/hw-live.js is not on this page — there is no write path to call.' });
    }
    return post('/api/product', body).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) return { ok: true, code: r.code, product: b.product, wm: b.wm };
      return { ok: false, code: r.code, error: b.error || r.error || ('HTTP ' + r.code),
        hint: r.hint || null, fields: b.field ? [b.field] : b.fields || null };
    });
  }

  // Per-listing verdict out of push_product's own return shape (engine.py):
  // {menu_id: <2xx status>} on a landed push, {menu_id: {error, ...}} on a
  // refusal (423/paused) or a caught exception. This is NOT a read-back like
  // engine.set_product_published's — push_product reports what WM's PUT
  // itself returned, nothing more — so it can say "the push was accepted",
  // never "Weedmaps is now serving it".
  function wmPushSummary(wm) {
    if (!wm || typeof wm !== 'object') return { ok: false, checked: 0, failed: [] };
    const entries = Object.entries(wm);
    const failed = entries.filter(([, v]) => !(typeof v === 'number' && v >= 200 && v < 300));
    return { ok: entries.length > 0 && failed.length === 0, checked: entries.length,
      failed: failed.map(([mid, v]) => mid + ': ' + (v && typeof v === 'object' ? (v.note || v.error) : 'no response')) };
  }

  // Reads the just-written SKU back out of the LIVE catalogue — a fresh
  // GET /api/state via window.HW_LIVE.refresh(), not the POST response we
  // already have — so "created" means the catalog actually holds it now, the
  // same discipline engine.set_product_published applies with its own
  // read-back. This is also what catches the gap a bare 200/500 cannot: a
  // push that raises AFTER catalog.upsert_product already committed (dead
  // WM_API_BASE, the exact shape server.py's do_POST wrapper answers with a
  // 500 "unhandled: ...") still leaves the product saved, and this is the
  // only way this page can find that out.
  // Resolves null when there is no live seam to ask, or the sku genuinely
  // is not there after a refresh.
  function readBackProduct(sku) {
    const HL = window.HW_LIVE;
    if (!HL || typeof HL.refresh !== 'function') return Promise.resolve(null);
    return HL.refresh().then(() => {
      const rows = (window.HW && window.HW.PRODUCTS) || [];
      return rows.find((p) => p.sku === sku) || null;
    }).catch(() => null);
  }

  // Creates a PRODUCT, not a local row. WAS: a pure client-side mock write to
  // SHELLS (and, for `sample`, to HW.PRODUCTS in place) — the Add Product flow
  // reported "created" to the operator and nothing ever reached Weedmaps.
  // NOW: POST /api/product first; SHELLS is only ever updated FROM a write the
  // live catalogue actually confirms — one source of truth, not two that can
  // disagree.
  //
  // Returns a promise of { ok, sku, wm, error, hint }:
  //   ok    the catalog write is confirmed by reading it back — never set from
  //         a bare HTTP 200.
  //   wm    per-listing push verdict (wmPushSummary), or null when a push
  //         result never came back at all (e.g. the 500-after-commit case
  //         above) — a genuinely different fact from "the push failed".
  //   error/hint  present when `ok` is false, for the one place in this flow
  //         that shows an operator what happened (product-shell.jsx commit()).
  function createVariation(shellId, v, b) {
    const shell = shellById(shellId);
    if (!shell) return Promise.resolve({ ok: false, sku: v && v.sku, error: 'unknown_shell', hint: null });
    const body = productPayload(shell, v, b);
    return pushProduct(body).then((r) => readBackProduct(v.sku).then((live) => {
      if (!live) {
        return { ok: false, sku: v.sku, error: r.error || 'not_confirmed',
          hint: r.hint || (r.ok ? null :
            'A fresh read of the catalog does not show ' + v.sku + ' — nothing was created.') };
      }
      // CONFIRMED. Populate the mock FROM the confirmed row so the shell list
      // and product sheet show exactly what the server holds, not what we
      // asked it to hold. `thumb: live` mirrors seed()'s own `thumb: p`.
      const row = { sku: live.sku, name: live.name, price: live.price, override: !!v.override,
        strain: live.strain, active: !!live.active && !live.sample, qty: live.qty || 0,
        sample: !!live.sample, thumb: live };
      SHELLS = allShells().map((s) => s.id === shell.id ? { ...s, variations: [...s.variations, row] } : s);
      emit();
      return { ok: true, sku: v.sku, wm: r.wm ? wmPushSummary(r.wm) : null };
    }));
  }

  // Reads the TRUE stored row for one sku off the new GET /api/product/<sku>
  // (wmdemo/server.py) — the same shape catalog.upsert_product reads/writes
  // (weight nested, tags a list), NOT the live-adapted shape adaptProducts
  // hands the rest of this page (shared/hw-live.js), which is missing
  // items_per_pack and the raw weight split. Resolves { ok: false, ... } on a
  // network failure, a missing read seam, or an unknown sku (404) — never
  // rejects, same contract as pushProduct/readBackProduct below.
  function fetchRawProduct(sku) {
    const get = window.HW_LIVE && typeof window.HW_LIVE.get === 'function' ? window.HW_LIVE.get : null;
    if (!get) {
      return Promise.resolve({ ok: false, error: 'no-write-path',
        hint: 'shared/hw-live.js is not on this page — there is no read path to call.' });
    }
    return get('/api/product/' + encodeURIComponent(sku)).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) return { ok: true, product: b };
      return { ok: false, code: r.code, error: b.error || r.error || ('HTTP ' + r.code),
        hint: r.hint || null };
    });
  }

  // Raw catalog row (fetchRawProduct's shape) -> the flat POST /api/product
  // body (server.py's do_POST reads weight_unit/weight_value and a comma
  // string for tags, not the nested/array forms the row itself stores). Every
  // key server.py's writer names is carried through explicitly — the same
  // discipline productPayload above already follows for a NEW variation — so
  // a get-then-modify-then-put through this function drops nothing: `sample`,
  // `items_per_pack`, `wm_manual_unpublish`, thc/cbd, the WM ids, all of it.
  // `overrides` is applied last and wins, e.g. { name: next }.
  function rawToPayload(raw, overrides) {
    const w = raw.weight || {};
    const body = {
      sku: raw.sku,
      name: raw.name,
      category: raw.category,
      price: raw.price,
      sale_pct: raw.sale_pct != null ? raw.sale_pct : '',
      weight_unit: w.unit || 'g',
      weight_value: w.value != null ? String(w.value) : '1.0',
      genetics: raw.genetics || null,
      strain: raw.strain || null,
      thc: raw.thc || null,
      cbd: raw.cbd || null,
      description: raw.description || null,
      image_url: raw.image_url || null,
      brand_name: raw.brand_name || null,
      wm_brand_id: raw.wm_brand_id || null,
      wm_product_id: raw.wm_product_id || null,
      items_per_pack: raw.items_per_pack || null,
      inventory: raw.inventory != null ? raw.inventory : 25,
      sample: !!raw.sample,
      wm_manual_unpublish: !!raw.wm_manual_unpublish,
      tags: Array.isArray(raw.tags) ? raw.tags.join(',') : (raw.tags || '')
    };
    return Object.assign(body, overrides || {});
  }

  // A variation's NAME is a variation field, not a shell field — the flavour or
  // strain that distinguishes it inside the family. It is renamed in place from
  // wherever the product is open (product detail, shell page).
  //
  // NOW FIXED, on the same "write, then read back to confirm" discipline as
  // createVariation above: GET the current row (fetchRawProduct), change only
  // `name` on it (rawToPayload), POST the complete object back, then confirm
  // via readBackProduct before touching the mock. WAS a pure client-side
  // rename with no server round-trip at all (2026-08-28 audit) — deliberately
  // NOT fixed by rebuilding a payload from the live-adapted shape this page
  // already had, because that shape drops items_per_pack and the raw weight
  // split and would have silently erased them on every rename. The missing
  // piece was GET /api/product/<sku>, added alongside this fix.
  //
  // Returns a promise of { ok, sku, wm, error, hint } — same shape
  // createVariation returns, for the same reason: one contract, one place
  // (screen-catalog.jsx's inline name editor) that shows an operator what
  // happened.
  function renameVariation(shellId, sku, next) {
    const name = (next || '').trim();
    if (!name) return Promise.resolve({ ok: false, sku, error: 'empty_name', hint: 'Enter a name.' });
    return fetchRawProduct(sku).then((g) => {
      if (!g.ok) {
        return { ok: false, sku, error: g.error || 'not_found',
          hint: g.hint || ('Could not read the current record for ' + sku +
            ' before renaming it — nothing was changed.') };
      }
      const body = rawToPayload(g.product, { name });
      return pushProduct(body).then((r) => readBackProduct(sku).then((live) => {
        if (!live || live.name !== name) {
          return { ok: false, sku, error: r.error || 'not_confirmed',
            hint: r.hint || ('A fresh read of the catalog does not show the new '
              + 'name for ' + sku + ' — the rename may not have landed.') };
        }
        // CONFIRMED. Same "populate FROM the confirmed row" rule as
        // createVariation: the shell list shows what the server holds.
        SHELLS = allShells().map((s) => s.id !== shellId ? s :
        { ...s, variations: s.variations.map((v) => v.sku === sku ?
          { ...v, name: live.name, sample: !!live.sample, thumb: live } : v) });
        const prod = (HW.PRODUCTS || []).find((x) => x.sku === sku);
        if (prod) prod.name = live.name;
        emit();
        return { ok: true, sku, wm: r.wm ? wmPushSummary(r.wm) : null };
      }));
    });
  }
  function addBox(name) {if (name && !BOXES.includes(name)) {BOXES = [...BOXES, name];emit();}}
  function renameBox(oldName, next) {
    if (!next || next === oldName) return;
    BOXES = BOXES.map((b) => b === oldName ? next : b);
    SHELLS = allShells().map((s) => s.kit === oldName ? { ...s, kit: next } : s);
    emit();
  }

  // AI product-description draft for a new variation.
  function aiDesc(shell, v) {
    if (!shell) return '';
    const type = v && v.strain || 'Hybrid';
    const name = v && v.name && v.name.trim() || shell.brand + ' ' + shell.sub;
    const effect = { Indica: 'a mellow, body-heavy calm', Sativa: 'a bright, uplifting lift', Hybrid: 'a balanced, easygoing effect', CBD: 'a clear-headed, non-intoxicating calm' }[type] || 'a balanced effect';
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return pick(['Meet ' + name + '.', 'Say hello to ' + name + '.', name + ' joins the family.']) + ' ' +
    pick(['This ' + String(type).toLowerCase() + ' ' + shell.sub.toLowerCase() + ' delivers ' + effect + ' in every ' + shell.weight + ' unit.',
    'A ' + String(type).toLowerCase() + ' spin on the ' + shell.brand + ' ' + shell.sub.toLowerCase() + ', tuned for ' + effect + '.',
    'Built for ' + effect + ', held to the same ' + shell.weight + ' spec as the rest of the line.']) + ' ' +
    pick(['Consistent, compliant, and shelf-ready.', 'Same trusted format, a fresh flavour.', 'Small-batch quality your regulars will recognise.']);
  }

  // The fields a variation inherits, rendered identically on the shell page,
  // in the create-variation step and in the add-product flow.
  function sharedRows(s) {
    const money = HW.fmt.money0;
    // ── THE HIGHEST-SEVERITY LIE ON THIS SCREEN WAS ITS LABEL ──────────────
    //
    // 🔴 The unit-cost row read:
    //     { label: 'Unit cost · batch avg', value: money(s.cost),
    //       sub: 'low ' + money(s.cost*0.85) + ' · high ' + money(s.cost*1.18),
    //       flag: 'From batches' }
    //
    // `s.cost` was the average of pos/data.jsx's SKU character-hash, and the
    // low/high spread was that hash multiplied by two constants — a "range
    // across batches" for a family whose batches were never read. And it was
    // stamped FROM BATCHES, beside a row genuinely flagged 'Synced'.
    //
    // A false provenance is worse than an undisclosed derivation: an operator
    // who is told where a number came from stops asking. GET /api/state serves
    // `batches` and it is an EMPTY ARRAY (0 rows, verified 2026-08-27) — this
    // estate has never been handed a lot for any SKU, so nothing on this screen
    // has ever been "from batches".
    //
    // The row survives, because the field is real and receiving a batch is how
    // it gets filled (pos/product-shell.jsx:402). What it may claim does not.
    const costRow = s.cost != null ?
      { label: 'Unit cost · batch avg', value: money(s.cost),
        sub: s.costsKnown === s.costsTotal ?
          'averaged over all ' + s.costsTotal + ' variation' + (s.costsTotal === 1 ? '' : 's') :
          'averaged over ' + s.costsKnown + ' of ' + s.costsTotal + ' variations — the rest have no cost recorded',
        flag: 'Entered on receipt' } :
      { label: 'Unit cost · batch avg', value: 'not recorded',
        sub: 'no cost of goods is held for this line. Nothing in this build carries one — '
           + 'GET /api/state serves no cost field and its batches list is empty — so it is '
           + 'set when a batch is received, not derived.', flag: null };
    return [
      { label: 'Brand', value: s.brand },
      { label: 'Category', value: s.cat },
      { label: 'Subcategory', value: s.sub },
      { label: 'Format', value: s.format },
      { label: 'Weight / size', value: s.weight },
      { label: 'Retail price', value: money(s.price) },
      { label: 'Sale price', value: s.sale ? money(s.sale) : '—', sub: s.sale ? 'was ' + money(s.price) : 'no promo running' },
      costRow,
      { label: 'Weedmaps node', value: s.wmNode, flag: 'Synced' },
      { label: 'Delivery box', value: s.kit || '—', flag: 'Delivery only' }];
  }

  window.HW_SHELL = { TAX, catDef, get BOXES() {return BOXES;}, KIT_BOXES: BOXES, SHELL_FORMATS, FORMAT_BY_CAT,
    allShells, shellById, shellOf, useShells, saveShell, createVariation, renameVariation, addBox, renameBox,
    parseSize, splitSize, mono1, mono2, slugify, familyPath, menuPath, totalStock, effectivePrice, aiDesc, sharedRows };
})();
