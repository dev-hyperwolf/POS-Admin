// ── Product shells · store + taxonomy ──────────────────────────────────────
// One shell = one product family: brand + format + weight/unit/pack + kit box
// + Weedmaps node. That is now the WHOLE shell record (docs/SHELLS-PLAN-2026-
// 09-09.md §1) — price, traits and a shared "sub" no longer live here. A
// variation (a real catalog product) hangs off a shell and owns its own
// price; its NAME is never typed, it is DERIVED by the naming engine from the
// slots (strain/flavor, ratio, tier, type…) the operator fills in, applied to
// the shell's format template. Numeric weights never appear in a name — the
// owner's ruling, plan §0.
//
// THIS FILE IS NOW A THIN CLIENT over the wm-demo shells API
// (docs/SHELLS-PLAN-2026-09-09.md §3), through window.HW_LIVE.get/post — the
// one read/write seam every sibling seam on this page shares (shared/hw-
// live.js). There is no more client-side SHELLS mock rebuilt from
// HW.PRODUCTS on every page load: the library is fetched once, cached here,
// and refetched after every write, exactly the discipline the plan names.
;(function () {
  const HW = window.HW;

  // Categories mirror the live hyperwolf.com/shop menu. slug = real URL segment.
  // Still used for: the category chips on the shell form (which filter the
  // format picker), catDef()/menuPath() and the weight-unit/preset helpers.
  // Subcategory, traits and a per-category default FORMAT no longer live
  // here — formats are server records now (GET /api/shells/formats), owned by
  // pos/shell-formats.jsx.
  const TAX = [
    { key: 'Flower', name: 'Flower', slug: 'flower', units: ['g', 'oz'], unit: 'g', presets: ['1g', '3.5g', '7g', '14g', '28g'],
      subs: ['Premium Flower', 'Smaller Bud Flower', 'Value Flower', 'Bulk Flower 5g–28g', 'Infused Flower', 'Smalls'],
      wm: 'Flower › Bud' },
    { key: 'Pre-Rolls', name: 'Pre-Rolls', slug: 'prerolls', units: ['g', 'ct', 'oz'], unit: 'g', presets: ['0.5g', '1g', '1.75g', '2.5g', '5g'],
      subs: ['Single Pre-Roll', 'Multipacks', 'Infused Pre-Rolls', 'Blunts', 'Hash Holes'],
      wm: 'Pre Roll › Single' },
    { key: 'Vapes', name: 'Vapes', slug: 'vapes', units: ['g', 'ml', 'ct'], unit: 'g', presets: ['0.3g', '0.5g', '1g', '2g'],
      subs: ['All-In-One', 'Cartridges', 'Pods', 'Disposables', 'Batteries'],
      wm: 'Vape Pens › All-In-One' },
    { key: 'Concentrates', name: 'Concentrates', slug: 'concentrates', units: ['g', 'ct'], unit: 'g', presets: ['0.5g', '1g', '2g', '3.5g'],
      subs: ['Live Resin', 'Live Rosin', 'Badder', 'Diamonds', 'Sauce', 'Hash', 'Solventless', 'Applicators'],
      wm: 'Concentrates › Live Resin' },
    { key: 'Edibles', name: 'Edibles', slug: 'edibles', units: ['mg', 'g', 'ct', 'ml'], unit: 'mg', presets: ['10mg', '100mg', '200mg', '1000mg'],
      subs: ['Gummies', 'Chocolates', 'Baked Goods', 'Drinks', 'Tablets', 'Microdose', 'High Dose'],
      wm: 'Edibles › Gummies' },
    { key: 'Wellness', name: 'CBD & Wellness', slug: 'cbd-wellness', units: ['mg', 'ml', 'g', 'ct'], unit: 'ml', presets: ['30ml', '60ml', '100mg', '500mg'],
      subs: ['Tinctures', 'Topicals', 'CBD', 'Ratio Products', 'Capsules', 'Pet'],
      wm: 'Wellness › Tinctures' },
    { key: 'Accessories', name: 'Accessories', slug: 'accessories', units: ['ct', 'g'], unit: 'ct', presets: ['1ct', '2ct', '5ct'],
      subs: ['Batteries', 'Papers & Wraps', 'Grinders', 'Lighters', 'Glass', 'Storage', 'Apparel'],
      wm: 'Gear › Accessories' }];

  const catDef = (key) => TAX.find((c) => c.key === key) || TAX[0];

  // Delivery boxes — which box on the van a family rides in. Still a local,
  // client-only list (the plan never gives this its own table); a shell's own
  // `kit_box` field just needs to hold a value, any value, and this is where
  // the picker gets its suggestions from.
  let BOXES = ['Flower Box 1', 'Flower Box 2', 'Pre-roll Box 1', 'Vape Box 1', 'Vape Box 2', 'Edible Box', 'Concentrate bin 1', 'Cooler'];
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
  // Purely decorative — a deterministic gradient hue for a shell tile, same
  // char-sum technique window.Avatar already uses for a person's initials.
  // The server does not send a hue (there is nothing for it to mean), so this
  // is never treated as data — only ever passed to <Thumb>.
  const hueOf = (s) => [...String((s && (s.id || s.brand)) || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  // Sends the ASSOCIATE ID, not the display name -- confirmed live:
  // wmdemo's contests.is_manager(actor) does associates.get(actor), a lookup
  // keyed by associate_id ('manisha-saini'), not by the display name
  // ('Manisha Saini'). Sending the name 403'd every manager-only call
  // (format delete, name_override) under a real Floor Manager. Same
  // accessor pos/shell-formats.jsx's actorName() already uses -- there is
  // no second "who is this" for the POS layer.
  function actor() {
    const a = (HW && HW.STATS && HW.STATS.associate) || {};
    return a.id || a.name || 'POS';
  }
  function apiGet(path) {
    const get = window.HW_LIVE && typeof window.HW_LIVE.get === 'function' ? window.HW_LIVE.get : null;
    if (!get) return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-write-path',
      hint: 'shared/hw-live.js is not on this page — there is no read path to call.' });
    return get(path);
  }
  function apiPost(path, body) {
    const post = window.HW_LIVE && typeof window.HW_LIVE.post === 'function' ? window.HW_LIVE.post : null;
    if (!post) return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-write-path',
      hint: 'shared/hw-live.js is not on this page — there is no write path to call.' });
    return post(path, body);
  }

  const subs = new Set();
  const emit = () => subs.forEach((f) => f());
  // A write can settle its fetch (and call emit()) BETWEEN a component's first
  // render and the effect below actually running — GET /api/shells resolves
  // over microtask hops, and a subscriber that was not registered yet simply
  // misses that emit() forever, leaving the screen on its stale first-render
  // snapshot with no error and no further update. Calling `cb()` once, right
  // after subscribing, re-reads current state unconditionally and closes that
  // window — idempotent (one extra render) when nothing changed underneath.
  function useSubscribed(readFn) {
    const [, bump] = React.useState(0);
    React.useEffect(() => {
      const cb = () => bump((n) => n + 1);
      subs.add(cb);
      cb();
      return () => subs.delete(cb);
    }, []);
    return readFn();
  }

  // ══ FORMATS — GET /api/shells/formats ═══════════════════════════════════
  let FORMATS = null, FORMAT_COUNTS = {}, formatsLoading = false, formatsError = null, formatsPromise = null;

  function fetchFormats() {
    if (formatsPromise) return formatsPromise;
    formatsLoading = true; formatsError = null; emit();
    formatsPromise = apiGet('/api/shells/formats').then((r) => {
      formatsLoading = false; formatsPromise = null;
      const b = r.body || {};
      if (r.ok && Array.isArray(b.formats)) {
        FORMATS = b.formats; FORMAT_COUNTS = b.counts || {}; formatsError = null;
        // The two fetches run concurrently — if the shells library already
        // landed with formats still unknown, decorate() fell back on empty
        // category/subcategory/format-name strings. Re-decorate from the
        // untouched raw rows now that the format lookups can actually
        // resolve, so this file settles like a shell page that loaded the
        // format library first would have — never left silently blank.
        if (RAW_SHELLS) { SHELLS = RAW_SHELLS.map(decorate); }
      }
      else { formatsError = (b && b.error) || r.error || ('HTTP ' + r.code); }
      emit();
      return FORMATS || [];
    });
    return formatsPromise;
  }
  function formats() { if (FORMATS === null && !formatsLoading) fetchFormats(); return FORMATS || []; }
  function formatById(id) { return formats().find((f) => f.id === id) || null; }
  function formatCounts(id) { return FORMAT_COUNTS[id] || { shells: 0, products: 0 }; }
  function useFormats() { return useSubscribed(formats); }
  function useFormatsStatus() { return useSubscribed(() => ({ loading: formatsLoading, error: formatsError, loaded: FORMATS !== null })); }
  function refreshFormats() { FORMATS = null; formatsPromise = null; return fetchFormats(); }

  // ══ BRANDS — GET /api/shells/brands ══════════════════════════════════════
  // The one source of {brand_key, brand_name, product_count, shell_count} —
  // resolved server-side through wmdemo.mapping.brand_key, the SAME fold
  // derive() and create_shell() use. shared/brands.js is a DIFFERENT id
  // scheme (its own `key`, e.g. 'raw' for "Raw Garden") built for the
  // register-screen mock data; using it here landed a shell on brand RAW
  // instead of Raw Garden (docs/SHELLS-PLAN-2026-09-09.md's brand-key-
  // collision fix). Nothing in this file should read window.HW_BRANDS again.
  let BRANDS = null, brandsLoading = false, brandsError = null, brandsPromise = null;

  function fetchBrands() {
    if (brandsPromise) return brandsPromise;
    brandsLoading = true; brandsError = null; emit();
    brandsPromise = apiGet('/api/shells/brands').then((r) => {
      brandsLoading = false; brandsPromise = null;
      const b = r.body || {};
      if (r.ok && Array.isArray(b.brands)) { BRANDS = b.brands; brandsError = null; }
      else { brandsError = (b && b.error) || r.error || ('HTTP ' + r.code); }
      emit();
      return BRANDS || [];
    });
    return brandsPromise;
  }
  function brands() { if (BRANDS === null && !brandsLoading) fetchBrands(); return BRANDS || []; }
  function useBrands() { return useSubscribed(brands); }
  function refreshBrands() { BRANDS = null; brandsPromise = null; return fetchBrands(); }

  // ══ CATALOGUE STATUS — GET /api/shells/catalogue/status ══════════════════
  // "Is the hyperwolf.com catalogue loaded" (Render's own deploy carries
  // only the 151-product demo seed). Same lazy-fetch/cache shape as FORMATS/
  // BRANDS above.
  let CAT_STATUS = null, catStatusLoading = false, catStatusError = null, catStatusPromise = null;

  function fetchCatalogueStatus() {
    if (catStatusPromise) return catStatusPromise;
    catStatusLoading = true; catStatusError = null; emit();
    catStatusPromise = apiGet('/api/shells/catalogue/status').then((r) => {
      catStatusLoading = false; catStatusPromise = null;
      const b = r.body || {};
      if (r.ok && !b.error) { CAT_STATUS = b; catStatusError = null; }
      else { catStatusError = (b && b.error) || r.error || ('HTTP ' + r.code); }
      emit();
      return CAT_STATUS;
    });
    return catStatusPromise;
  }
  function catalogueStatus() { if (CAT_STATUS === null && !catStatusLoading) fetchCatalogueStatus(); return CAT_STATUS; }
  function refreshCatalogueStatus() { CAT_STATUS = null; catStatusPromise = null; return fetchCatalogueStatus(); }
  function useCatalogueStatus() {
    return useSubscribed(() => {
      const s = catalogueStatus() || {};
      return {
        loading: catStatusLoading, error: catStatusError,
        productsTotal: s.products_total != null ? s.products_total : null,
        harvestRows: s.harvest_rows != null ? s.harvest_rows : null,
        harvestDate: s.harvest_date || null,
        brandsInScope: s.brands_in_phase1_scope || []
      };
    });
  }

  // ── POST /api/shells/catalogue/load — dry run first, then Apply ──
  // Never fires anything Weedmaps-facing (the server route deliberately has
  // no access to that call — see wmdemo/shells.py's load_hyperwolf_catalogue
  // docstring). A real (non-dry-run) load refreshes brands + the shells
  // library + this status, same discipline deriveShells already applies.
  function loadCatalogue(dryRun) {
    return apiPost('/api/shells/catalogue/load',
      { dry_run: !!dryRun, actor: actor() }).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) {
        if (!dryRun) { refreshCatalogueStatus(); refreshBrands(); refreshShells(); }
        return { ok: true, rows_read: b.rows_read || 0, created: b.created || 0,
          updated: b.updated || 0, unchanged: b.unchanged || 0,
          rejected: b.rejected || 0, dry_run: !!b.dry_run };
      }
      return { ok: false, error: (b && b.error) || r.error || ('HTTP ' + r.code), hint: r.hint || null };
    });
  }

  // ══ SHELLS LIBRARY — GET /api/shells ═════════════════════════════════════
  // Raw server rows are augmented with the flat, legacy-shaped fields the
  // rest of this estate's UI (and pos/pricing-shared.jsx, which this file does
  // not own) already reads: brand, cat, sub, weight, format — so the blast
  // radius of moving to a real backend stays inside this file rather than
  // spreading through every screen that renders a shell.
  let SHELLS = null, RAW_SHELLS = null, shellsLoading = false, shellsError = null, shellsPromise = null;
  const SHELL_DETAILS = {};       // id -> { loading, error, shell, format, products, promise }
  const _skuToShellId = {};       // opportunistic sku -> shell id, filled by detail fetches & writes
  let _lastReportId = null;

  function decorate(raw) {
    const fmt = formatById(raw.format_id);
    const unit = raw.unit || (fmt && fmt.default_unit) || 'g';
    const weight = raw.weight != null ? raw.weight : (fmt && fmt.default_weight);
    // The live server already answers GET /api/shells with `cat` and
    // `format_name` on every row (verified 2026-09-09) — prefer THOSE first.
    // Falling back straight to the format-library lookup, and only then to
    // '', meant a shell rendered with a BLANK category/format the instant
    // formats hadn't loaded yet (a real race — GET /api/shells and GET
    // /api/shells/formats fire concurrently), clobbering a perfectly good
    // value the shells response itself already carried.
    return Object.assign({}, raw, {
      brand: raw.brand_name || raw.brand_key || '',
      cat: raw.cat || (fmt && fmt.category) || raw.category || '',
      sub: raw.sub || (fmt && fmt.subcategory) || raw.subcategory || '',
      format: raw.format_name || (fmt && fmt.name) || raw.format_id || '',
      unit, netW: weight != null ? String(weight) : '1',
      // weight 0 or missing is not a measurement — it means the source data
      // never carried one (2026-09-09 derive report: Heavy Hitters edibles
      // landed at 0.0 from unparseable source rows). Showing "0g" would
      // invent a number nobody measured; say so honestly instead.
      weight: (weight === 0 || weight == null) ? 'weight not recorded' : (weight + unit),
      pack: raw.pack != null ? raw.pack : (fmt && fmt.default_pack) || 1,
      kit: raw.kit_box || (fmt && fmt.kit_box) || '—',
      wmNode: raw.wm_node || (fmt && fmt.wm_node) || '—',
      variationCount: raw.product_count || 0,
      sampleNames: raw.sample_names || []
    });
  }

  function fetchShells(params) {
    if (shellsPromise) return shellsPromise;
    shellsLoading = true; shellsError = null; emit();
    const qs = params ? '?' + Object.keys(params).filter((k) => params[k]).map((k) => k + '=' + encodeURIComponent(params[k])).join('&') : '';
    shellsPromise = apiGet('/api/shells' + qs).then((r) => {
      shellsLoading = false; shellsPromise = null;
      const b = r.body || {};
      if (r.ok && Array.isArray(b.shells)) {
        RAW_SHELLS = b.shells;
        SHELLS = RAW_SHELLS.map(decorate);
        shellsError = null;
        if (b.last_report_id) _lastReportId = b.last_report_id;
      } else {
        shellsError = (b && b.error) || r.error || ('HTTP ' + r.code);
      }
      emit();
      return SHELLS || [];
    });
    return shellsPromise;
  }
  function allShells() { if (SHELLS === null && !shellsLoading) fetchShells(); return SHELLS || []; }
  function shellById(id) { return allShells().find((s) => s.id === id) || null; }
  // No arbitrary allShells()[0] fallback — a product whose shell cannot be
  // resolved renders "No shell" honestly (pos/product-shell.jsx,
  // pos/screen-catalog.jsx) rather than borrowing a random one.
  function shellOf(p) {
    if (!p) return null;
    const sid = p.shell_id || _skuToShellId[p.sku];
    return sid ? shellById(sid) : null;
  }
  function refreshShells(params) { SHELLS = null; shellsPromise = null; return fetchShells(params); }
  function useShells() { return useSubscribed(allShells); }
  function useShellsStatus() { return useSubscribed(() => ({ loading: shellsLoading, error: shellsError, loaded: SHELLS !== null, lastReportId: _lastReportId })); }

  // ── one shell's full product list — GET /api/shells/<id> ──
  function fetchShellDetail(id, force) {
    if (!id) return Promise.resolve(null);
    const cur = SHELL_DETAILS[id];
    if (cur && cur.promise && !force) return cur.promise;
    const entry = Object.assign({}, cur, { loading: true, error: null });
    SHELL_DETAILS[id] = entry; emit();
    const p = apiGet('/api/shells/' + encodeURIComponent(id)).then((r) => {
      const b = r.body || {};
      const next = SHELL_DETAILS[id] || entry;
      next.promise = null; next.loading = false;
      if (r.ok && b.shell) {
        next.error = null; next.shell = b.shell; next.format = b.format || formatById(b.shell.format_id);
        next.products = Array.isArray(b.products) ? b.products : [];
        next.products.forEach((pr) => { if (pr.sku) _skuToShellId[pr.sku] = id; });
      } else {
        next.error = (b && b.error) || r.error || ('HTTP ' + r.code);
      }
      SHELL_DETAILS[id] = next; emit();
      return next;
    });
    entry.promise = p;
    return p;
  }
  function shellDetail(id) { return id ? SHELL_DETAILS[id] || null : null; }
  function useShellDetail(id) {
    React.useEffect(() => { if (id && !SHELL_DETAILS[id]) fetchShellDetail(id); }, [id]);
    return useSubscribed(() => shellDetail(id));
  }

  function totalStock(products) { return (products || []).reduce((a, p) => a + (p.inventory || 0), 0); }
  // A shell's own price is a client-side READ of whatever variations are
  // already cached for it (detail fetch), never a shell-level field — the
  // server does not have one (docs/SHELLS-PLAN-2026-09-09.md §1: shells own
  // brand+format+weight/unit/pack+kit+wm_node, nothing priced). Returns null
  // until a detail fetch has actually landed — callers (MarketPricingSection)
  // must treat null as "no shelf price yet", not as $0.
  function effectivePrice(s) {
    if (!s) return null;
    const det = SHELL_DETAILS[s.id];
    const products = det && det.products;
    if (!products || !products.length) return null;
    const withPrice = products.filter((p) => typeof p.price === 'number' && isFinite(p.price));
    if (!withPrice.length) return null;
    const tally = {};
    withPrice.forEach((p) => { tally[p.price] = (tally[p.price] || 0) + 1; });
    return Number(Object.keys(tally).sort((a, b) => tally[b] - tally[a] || b - a)[0]);
  }

  // Resulting shell name, computed client-side by the same rule the server
  // uses to derive it (plan §1): "<brand> · <format.name>", with the weight
  // appended ONLY when this brand already has this exact format at a
  // DIFFERENT weight/unit/pack — i.e. the weight is the thing telling two
  // shells apart. Purely a preview; the server is the actual author of
  // `shell.name` once POST /api/shells lands.
  function previewShellName(brandName, formatId, weight, unit, pack, existing) {
    const fmt = formatById(formatId);
    const fmtName = (fmt && fmt.name) || '';
    if (!brandName || !fmtName) return '';
    const key = brandKeyFor(brandName);
    const siblings = (existing || allShells()).filter((s) => (s.brand_key || brandKeyFor(s.brand)) === key && s.format_id === formatId);
    const distinctWeights = new Set(siblings.map((s) => String(s.weight)));
    distinctWeights.add(String(weight) + unit);
    const needsWeight = distinctWeights.size > 1;
    return brandName + ' · ' + fmtName + (needsWeight ? ' · ' + weight + unit + (pack > 1 ? ' (' + pack + ')' : '') : '');
  }

  // Client-side-only approximation, used purely for the LOCAL preview above
  // (grouping "does this brand already have this format at another weight").
  // It is never sent to the server — saveShell() sends brand_name only and
  // the server is the one and only place a brand_key is ever computed for
  // real (mapping.brand_key, GET /api/shells/brands). Prefers the server's
  // own brand list so the preview groups the same way the write will.
  function brandKeyFor(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return '';
    const hit = brands().find((b) => (b.brand_name || '').toLowerCase() === trimmed.toLowerCase());
    return hit ? hit.brand_key : slugify(trimmed);
  }

  // ── the one write: create a shell — POST /api/shells ──
  // No update-shell route exists in this phase (plan §3): a shell is
  // effectively keyed by brand+format+weight+unit+pack (UNIQUE in the
  // schema), so changing any of those is a new shell, not an edit of this
  // one. saveShell() only ever creates.
  //
  // brand_key is NEVER sent — only brand_name. The server resolves the key
  // itself via the one fold function (mapping.brand_key) that GET
  // /api/shells/brands, derive() and create_shell() all share; a client-
  // computed key (this file used to send one, via shared/brands.js's own id
  // scheme) is exactly what caused the brand-key collision this fixes.
  function saveShell(draft) {
    const body = {
      brand_name: (draft.brand || '').trim(),
      format_id: draft.format_id,
      actor: actor()
    };
    if (draft.netW !== '' && draft.netW != null) body.weight = parseFloat(draft.netW);
    if (draft.unit) body.unit = draft.unit;
    if (draft.pack !== '' && draft.pack != null) body.pack = parseInt(draft.pack, 10);
    if (draft.kit) body.kit_box = draft.kit;
    if (draft.wmNode) body.wm_node = draft.wmNode;
    return apiPost('/api/shells', body).then((r) => {
      const b = r.body || {};
      if (r.ok && b.shell) { refreshShells(); return { ok: true, shell: decorate(b.shell) }; }
      return { ok: false, code: r.code, error: (b && b.error) || r.error || ('HTTP ' + r.code), hint: r.hint || null };
    });
  }

  // ── create a variation — POST /api/shells/<id>/variations ──
  // Sends SLOTS, never a free-text product name — the server derives the
  // name from the shell's format template (naming engine, plan §2) and hands
  // it back. `extra` carries sku?, price, cost?, thc?, genetics?.
  function createVariation(shellId, slots, extra) {
    if (!shellId) return Promise.resolve({ ok: false, error: 'unknown_shell', hint: 'This shell no longer exists — pick one again.' });
    const body = Object.assign({ slots: slots || {} }, extra || {});
    if (body.actor == null) body.actor = actor();
    return apiPost('/api/shells/' + encodeURIComponent(shellId) + '/variations', body).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error && b.product) {
        if (b.product.sku) _skuToShellId[b.product.sku] = shellId;
        refreshShells();
        if (SHELL_DETAILS[shellId]) fetchShellDetail(shellId, true);
        return { ok: true, sku: b.product.sku, product: b.product, name_derived: b.name_derived, warnings: b.warnings || [] };
      }
      return { ok: false, error: (b && b.error) || r.error || ('HTTP ' + r.code), hint: r.hint || null,
        warnings: (b && b.warnings) || null, fields: b && (b.field ? [b.field] : b.fields || null) };
    });
  }

  // ── rename / re-slot a variation — POST /api/shells/<id>/variations/<sku> ──
  // Two calling shapes, on purpose:
  //   renameVariation(shellId, sku, {ratio, tier, type, …})  — re-derive from
  //     new slots (product-shell.jsx / a future variation editor).
  //   renameVariation(shellId, sku, "Some Typed Name")        — a MANAGER
  //     override (plan §1: shell_products.name_override, "set only by a
  //     manager"). This is the exact shape pos/screen-catalog.jsx's inline
  //     name editor already calls (`renameVariation(shellId, sku, next)`,
  //     `next` a free-typed string) — that file is owned by the sibling doing
  //     Catalog/Formats and is not touched here, so the string form stays
  //     supported rather than breaking that call site. Routing a typed string
  //     to `name_override` (never to a slot) keeps the owner's ruling intact:
  //     the ONLY way a literal string becomes a product name is the
  //     manager-override path the plan itself names.
  function renameVariation(shellId, sku, nameOrSlots) {
    if (!shellId) return Promise.resolve({ ok: false, sku, error: 'unknown_shell',
      hint: 'This product has no shell on record — open it from the shell page.' });
    const body = { actor: actor() };
    if (typeof nameOrSlots === 'string') {
      const trimmed = nameOrSlots.trim();
      if (!trimmed) return Promise.resolve({ ok: false, sku, error: 'empty_name', hint: 'Enter a name.' });
      body.name_override = trimmed;
    } else {
      body.slots = nameOrSlots || {};
    }
    return apiPost('/api/shells/' + encodeURIComponent(shellId) + '/variations/' + encodeURIComponent(sku), body).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) {
        refreshShells();
        if (SHELL_DETAILS[shellId]) fetchShellDetail(shellId, true);
        return { ok: true, sku, product: b.product || null, name_derived: b.name_derived || null, warnings: b.warnings || [] };
      }
      return { ok: false, sku, error: (b && b.error) || r.error || ('HTTP ' + r.code), hint: r.hint || null };
    });
  }

  // ── naming preview — local engine when loaded, else the server route ──
  // POST /api/shells/name/preview {format_id | template, slots, shell?} ->
  // {name, warnings[]}. window.HW_NAMING (shared/hw-naming.js, the sibling's
  // file) implements the identical pure function synchronously — when it has
  // loaded, this calls it directly (no round trip on every keystroke); either
  // path returns a Promise so callers never need two code paths.
  function previewName(formatIdOrTemplate, slots, shell) {
    const isTemplate = typeof formatIdOrTemplate === 'string' && /[{}]/.test(formatIdOrTemplate);
    if (window.HW_NAMING && typeof window.HW_NAMING.derive === 'function') {
      let template = formatIdOrTemplate;
      if (!isTemplate) { const f = formatById(formatIdOrTemplate); template = f ? f.template : null; }
      if (template) {
        try { return Promise.resolve(window.HW_NAMING.derive(template, slots || {}, shell || {})); }
        catch (e) { /* fall through to the server on a local-engine exception */ }
      }
    }
    const body = { slots: slots || {}, shell: shell || {} };
    if (isTemplate) body.template = formatIdOrTemplate; else body.format_id = formatIdOrTemplate;
    return apiPost('/api/shells/name/preview', body).then((r) => {
      const b = r.body || {};
      if (r.ok && b.name != null) return { name: b.name, warnings: b.warnings || [] };
      return { name: '', warnings: [(b && b.error) || r.error || ('HTTP ' + r.code)] };
    });
  }

  // ── derive — POST /api/shells/derive, GET /api/shells/derive/<id> ──
  function deriveShells(brands, dryRun) {
    return apiPost('/api/shells/derive', { brands: brands || [], dry_run: !!dryRun, actor: actor() }).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) {
        if (b.report_id) _lastReportId = b.report_id;
        if (!dryRun) refreshShells();
        return { ok: true, created_formats: b.created_formats || 0, created_shells: b.created_shells || [],
          assigned: b.assigned || 0, unplaced: b.unplaced || [], report_id: b.report_id || null };
      }
      return { ok: false, error: (b && b.error) || r.error || ('HTTP ' + r.code), hint: r.hint || null };
    });
  }
  function fetchDeriveReport(reportId) {
    if (!reportId) return Promise.resolve({ ok: false, error: 'no_report' });
    return apiGet('/api/shells/derive/' + encodeURIComponent(reportId)).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) return { ok: true, report: b };
      return { ok: false, error: (b && b.error) || r.error || ('HTTP ' + r.code) };
    });
  }
  function lastReportId() { return _lastReportId; }

  // ══ product-field editing that has nothing to do with shell naming ══════
  // category/genetics (and anything else /api/product owns that shells does
  // not) still go through the raw catalog row, GET -> modify -> POST ->
  // read-back, exactly as before. This is what pos/screen-catalog.jsx's
  // "Save changes" button calls (SH.updateVariationFields) and is left
  // unchanged by the shells rewrite — it was never a shell-naming concern.
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
  function wmPushSummary(wm) {
    if (!wm || typeof wm !== 'object') return { ok: false, checked: 0, failed: [] };
    const entries = Object.entries(wm);
    const failed = entries.filter(([, v]) => !(typeof v === 'number' && v >= 200 && v < 300));
    return { ok: entries.length > 0 && failed.length === 0, checked: entries.length,
      failed: failed.map(([mid, v]) => mid + ': ' + (v && typeof v === 'object' ? (v.note || v.error) : 'no response')) };
  }
  function readBackProduct(sku) {
    const HL = window.HW_LIVE;
    if (!HL || typeof HL.refresh !== 'function') return Promise.resolve(null);
    return HL.refresh().then(() => {
      const rows = (HW && HW.PRODUCTS) || [];
      return rows.find((p) => p.sku === sku) || null;
    }).catch(() => null);
  }
  function fetchRawProduct(sku) {
    return apiGet('/api/product/' + encodeURIComponent(sku)).then((r) => {
      const b = r.body || {};
      if (r.ok && !b.error) return { ok: true, product: b };
      return { ok: false, code: r.code, error: b.error || r.error || ('HTTP ' + r.code), hint: r.hint || null };
    });
  }
  function rawToPayload(raw, overrides) {
    const w = raw.weight || {};
    const body = {
      sku: raw.sku, name: raw.name, category: raw.category, price: raw.price,
      sale_pct: raw.sale_pct != null ? raw.sale_pct : '',
      weight_unit: w.unit || 'g', weight_value: w.value != null ? String(w.value) : '1.0',
      genetics: raw.genetics || null, strain: raw.strain || null, thc: raw.thc || null, cbd: raw.cbd || null,
      description: raw.description || null, image_url: raw.image_url || null,
      brand_name: raw.brand_name || null, wm_brand_id: raw.wm_brand_id || null, wm_product_id: raw.wm_product_id || null,
      items_per_pack: raw.items_per_pack || null, inventory: raw.inventory != null ? raw.inventory : 25,
      sample: !!raw.sample, wm_manual_unpublish: !!raw.wm_manual_unpublish,
      tags: Array.isArray(raw.tags) ? raw.tags.join(',') : (raw.tags || '')
    };
    return Object.assign(body, overrides || {});
  }
  function updateVariationFields(shellId, sku, overrides, confirm) {
    return fetchRawProduct(sku).then((g) => {
      if (!g.ok) {
        return { ok: false, sku, error: g.error || 'not_found',
          hint: g.hint || ('Could not read the current record for ' + sku + ' before saving — nothing was changed.') };
      }
      const body = rawToPayload(g.product, overrides);
      return pushProduct(body).then((r) => readBackProduct(sku).then((live) => {
        if (!live || (confirm && !confirm(live))) {
          return { ok: false, sku, error: r.error || 'not_confirmed',
            hint: r.hint || ('A fresh read of the catalog does not show the change for ' + sku + ' — it may not have landed.') };
        }
        return { ok: true, sku, wm: r.wm ? wmPushSummary(r.wm) : null };
      }));
    });
  }

  function addBox(name) { if (name && !BOXES.includes(name)) { BOXES = [...BOXES, name]; emit(); } }
  function renameBox(oldName, next) {
    if (!next || next === oldName) return;
    BOXES = BOXES.map((b) => b === oldName ? next : b);
    emit();
  }

  // AI product-description draft for a new variation.
  function aiDesc(shell, v) {
    if (!shell) return '';
    const type = v && v.type || 'Hybrid';
    const name = v && v.name && v.name.trim() || shell.brand + ' ' + shell.format;
    const effect = { Indica: 'a mellow, body-heavy calm', Sativa: 'a bright, uplifting lift', Hybrid: 'a balanced, easygoing effect', CBD: 'a clear-headed, non-intoxicating calm' }[type] || 'a balanced effect';
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return pick(['Meet ' + name + '.', 'Say hello to ' + name + '.', name + ' joins the family.']) + ' ' +
    pick(['This ' + String(type).toLowerCase() + ' ' + String(shell.sub || shell.format).toLowerCase() + ' delivers ' + effect + ' in every ' + shell.weight + ' unit.',
    'A ' + String(type).toLowerCase() + ' spin on the ' + shell.brand + ' ' + String(shell.format).toLowerCase() + ', tuned for ' + effect + '.',
    'Built for ' + effect + ', held to the same ' + shell.weight + ' spec as the rest of the line.']) + ' ' +
    pick(['Consistent, compliant, and shelf-ready.', 'Same trusted format, a fresh flavour.', 'Small-batch quality your regulars will recognise.']);
  }

  // The fields a variation inherits — shown identically on the shell page and
  // in the create-variation step. No price/traits rows any more: neither is
  // a shell-level field in the new model (a variation owns its own price;
  // there is no traits column at all — see the file header).
  function sharedRows(s) {
    return [
      { label: 'Brand', value: s.brand },
      { label: 'Category', value: s.cat },
      { label: 'Subcategory', value: s.sub },
      { label: 'Format', value: s.format },
      { label: 'Weight / size', value: s.weight },
      { label: 'Pack', value: String(s.pack || 1) },
      { label: 'Weedmaps node', value: s.wmNode, flag: 'From format' },
      { label: 'Delivery box', value: s.kit || '—', flag: 'Delivery only' }];
  }

  window.HW_SHELL = {
    TAX, catDef, get BOXES() { return BOXES; }, KIT_BOXES: BOXES,
    formats, formatById, formatCounts, useFormats, useFormatsStatus, refreshFormats,
    brands, useBrands, refreshBrands,
    catalogueStatus, useCatalogueStatus, refreshCatalogueStatus, loadCatalogue,
    allShells, shellById, shellOf, useShells, useShellsStatus, refreshShells,
    shellDetail, useShellDetail, fetchShellDetail,
    saveShell, createVariation, renameVariation, updateVariationFields, previewName, previewShellName,
    deriveShells, fetchDeriveReport, lastReportId,
    addBox, renameBox, brandKeyFor, actor,
    fetchRawProduct,
    parseSize, splitSize, mono1, mono2, slugify, familyPath, menuPath, hueOf,
    totalStock, effectivePrice, aiDesc, sharedRows };
})();
