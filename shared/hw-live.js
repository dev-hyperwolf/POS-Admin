// ── shared/hw-live.js ── the live-data seam ─────────────────────────────────
// Plain JS. Loads BEFORE React, on the POS entry HTML only.
//
// WHAT IT IS. One file that lets every POS screen render REAL data from the
// wm-demo API without a single screen edit. It does that by replacing the
// CONTENTS of the arrays `pos/data.jsx` already published on `window.HW`.
//
// WHY IN-PLACE AND NOT `window.HW = adapted`. Five modules bind
// `window.HW.fmt.money` at module scope (terminals/tdrawer.jsx:7,
// terminals/v2.jsx:7, terminals/tshared.jsx:4, delivery/dapp.jsx:6,
// payflows/pay-core.jsx:4). Reassigning window.HW would leave all five
// pointing at the old object and formatting would silently keep working
// against dead data -- the worst kind of failure, because nothing throws.
// A repo-wide scan for module-level captures of any HW *array* found none
// (every screen dereferences `window.HW.PRODUCTS` inside render), which is
// exactly what makes content replacement safe with zero screen edits.
//
// WHY IT MUST NOT BREAK THE PUBLIC DEMO. This repo is served statically from
// GitHub Pages. A hard dependency on 127.0.0.1 would leave the public demo
// showing an error or an empty catalog. So the live path only arms itself on
// a loopback origin, and any failure -- server down, timeout, bad payload --
// falls back silently to the mock data that is already loaded.
//
// PUBLIC SURFACE: window.HW_LIVE = { status, report, refresh(), disable() }.
// Turn it off: append `?hwlive=off`, or run `HW_LIVE.disable()` in the console.
(function () {
  'use strict';
  var W = window;
  if (W.HW_LIVE && W.HW_LIVE.__armed) { return; }   // idempotent: two tags, one seam

  // ── configuration ────────────────────────────────────────────────────────
  var FETCH_TIMEOUT_MS = 2500;   // past this we stop waiting and mount on mock
  var OFF_KEY = 'hw-live-off';
  var RAIL_W = 74;               // shared/app-rail.jsx:46 — badge clears the rail
  var SKU_PREFIX = 'hyperwolf:sku:';  // wmdemo/catalog.py:17 — the real anchor

  // ── gate ─────────────────────────────────────────────────────────────────
  // Loopback only. The API serves this repo itself when WM_DEMO_STATIC_DIR is
  // set (wmdemo/server.py _serve_static), so on the live path the page and the
  // API share an origin and CORS never enters the picture.
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(W.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function isLoopbackOrigin(o) {
    try {
      var u = new URL(o);
      return (u.protocol === 'http:' || u.protocol === 'https:') && LOOPBACK.test(u.hostname);
    } catch (e) { return false; }
  }

  var override = qs('hwlive');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is allowed ONLY when it is itself loopback. Without that
  // check a crafted link could point a viewer's page at an arbitrary host and
  // have it render whatever that host returns as if it were the operator's
  // own catalog.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }

  var armed = !disabled && isLoopbackOrigin(W.location.origin);

  // ── state ────────────────────────────────────────────────────────────────
  var _hw = undefined;        // the object pos/data.jsx assigns to window.HW
  var _payload = null;        // parsed /api/state, or null
  var _settled = false;       // fetch resolved one way or the other
  var _applied = false;
  var _root = null, _rootEl = null;
  var _report = null;
  var _status = armed ? 'pending' : 'off';
  var _catHue = {};           // snapshotted from the mock rows, see hueFor()
  var _t0 = 0;

  // ── small helpers ────────────────────────────────────────────────────────
  function replaceContents(arr, next) {
    // The whole point of the file: same array identity, new contents.
    arr.length = 0;
    for (var i = 0; i < next.length; i++) { arr.push(next[i]); }
    return arr;
  }

  // Python's round() is banker's rounding, and wmdemo/pricing.py:53-60 derives
  // the sale price with it. Math.round is half-UP, so a price landing exactly
  // on a half cent would disagree with the API by one cent. Rare, but a penny
  // of drift between the screen and the register is the kind of bug that gets
  // found at close, not at build time.
  function roundHalfEven(x) {
    var f = Math.floor(x), d = x - f;
    if (d > 0.5) { return f + 1; }
    if (d < 0.5) { return f; }
    return (f % 2 === 0) ? f : f + 1;
  }

  function titleCase(s) {
    return String(s).split('-').map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(' ');
  }

  // 'west-la' title-cases to 'West La'. It is an initialism, not a word.
  var REGION_LABEL = { 'west-la': 'West LA' };
  function regionLabel(slug) { return REGION_LABEL[slug] || titleCase(slug); }

  function driverLabel(id) { return titleCase(String(id).replace(/^driver-/, '')); }

  function ago(epochSeconds) {
    if (!epochSeconds) { return 'never'; }
    var s = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
    if (s < 60) { return 'just now'; }
    if (s < 3600) { return Math.floor(s / 60) + 'm ago'; }
    if (s < 86400) { return Math.floor(s / 3600) + 'h ago'; }
    return Math.floor(s / 86400) + 'd ago';
  }

  // ── MISMATCH 6 · categories ──────────────────────────────────────────────
  // Live values (verified against the DB): Flower, Pre Roll, Vape Pens,
  // Edibles, Vapes, Concentrates. The design's chips are Flower, Vapes,
  // Pre-Rolls, Concentrates, Edibles, Wellness, Deals.
  // Wellness and Deals have NO live analogue and are deliberately left with no
  // mapping: their chips then count 0 and read as empty, which is true.
  // Filling them with the nearest-looking category would be a lie an operator
  // cannot see.
  var CAT_MAP = {
    'flower': 'Flower',
    'pre roll': 'Pre-Rolls', 'pre-roll': 'Pre-Rolls',
    'pre rolls': 'Pre-Rolls', 'pre-rolls': 'Pre-Rolls', 'prerolls': 'Pre-Rolls',
    'vape': 'Vapes', 'vapes': 'Vapes', 'vape pens': 'Vapes', 'vape pen': 'Vapes',
    'edible': 'Edibles', 'edibles': 'Edibles',
    'concentrate': 'Concentrates', 'concentrates': 'Concentrates'
  };

  function normCat(raw, unmapped) {
    var key = String(raw == null ? '' : raw).trim().toLowerCase();
    var hit = CAT_MAP[key];
    if (hit) { return hit; }
    // Unknown category: keep the live string so it is visible on the row, and
    // record it. It will not match any chip, so the SKU shows under All only.
    unmapped[raw] = (unmapped[raw] || 0) + 1;
    return raw || 'Other';
  }

  // ── MISMATCH 3 · THC ─────────────────────────────────────────────────────
  // The design stores a Number and filters `p.thc >= 75`. The API stores a
  // STRING, and not always a percentage: edibles carry '100mg', which is a
  // DOSE. Coercing '100mg' to 100 would put every gummy above the high-potency
  // filter. Same rule shared/commerce-adapter.js already applies to weights.
  function thcPercent(v, doses) {
    if (v == null) { return null; }
    var s = String(v).trim();
    var m = /^([0-9]+(?:\.[0-9]+)?)\s*%$/.exec(s);
    if (m) { return parseFloat(m[1]); }
    if (/mg\s*$/i.test(s)) { doses.push(s); }
    return null;
  }

  // ── MISMATCH 5 · weight ──────────────────────────────────────────────────
  // weight.value is PER UNIT, and items_per_pack is the multiplier -- but
  // items_per_pack is null on 29 of 31 seeded rows, so for a pack we usually
  // cannot compute the pack weight at all. We print exactly what the API
  // stores and FLAG the rows where the stored unit weight contradicts the
  // product's own name, rather than silently printing '1g' on an eighth.
  // Two live rows fail that check today: BD-F-35G (stores 1.0g on a 3.5g
  // eighth) and HD-FL-ZECLAIR-35 (stores 3.54g on a 3.5g eighth).
  function weightLabel(p) {
    var w = p.weight || {};
    if (w.value == null || w.unit == null) { return null; }
    var n = Number(w.value);
    var v = isFinite(n) ? String(n) : String(w.value);
    var per = p.items_per_pack == null ? null : Number(p.items_per_pack);
    if (per != null && per > 1) { return per + 'x' + v + w.unit; }
    return v + w.unit;
  }

  function weightWarning(p) {
    var w = p.weight || {};
    var n = Number(w.value);
    var name = String(p.name || '');
    var m = /([0-9]*\.?[0-9]+)\s*(mg|g)\b/i.exec(name);
    if (m && w.unit && m[2].toLowerCase() === String(w.unit).toLowerCase() &&
        isFinite(n) && Math.abs(parseFloat(m[1]) - n) > 1e-9 &&
        (p.items_per_pack == null || Number(p.items_per_pack) <= 1)) {
      return 'Name says ' + m[0] + ', stored unit weight is ' + n + w.unit +
             ' and items_per_pack is null — pack weight is unknown.';
    }
    if (/\b\d+\s*[- ]?(pack|pk)\b/i.test(name) && p.items_per_pack == null) {
      return 'Name says a multi-pack but items_per_pack is null — the label ' +
             'below is the PER-UNIT weight, not the pack.';
    }
    return null;
  }

  // ── MISMATCH 4 · sale is inverted ────────────────────────────────────────
  // Design: `price` is what you pay, `was` is the crossed-out original.
  // API:    `price` IS the original, and sale_pct (1..99) derives the sale.
  // Getting this backwards makes every sale render as a PRICE RISE.
  function priceAndWas(p) {
    var pct = parseInt(p.sale_pct, 10);
    var baseCents = roundHalfEven(Number(p.price) * 100);   // pricing.py base_cents
    if (pct >= 1 && pct <= 99) {
      var saleCents = roundHalfEven(baseCents * (100 - pct) / 100);
      return { price: saleCents / 100, was: baseCents / 100, salePct: pct };
    }
    return { price: baseCents / 100, was: null, salePct: null };
  }

  // The design derives cost/margin deterministically from the SKU + price
  // (pos/data.jsx:23-26). The API has no cost of goods at all, so the ONLY
  // honest options were to drop the margin columns (needs screen edits, which
  // this seam is forbidden) or keep the same synthetic derivation over the live
  // price. We keep it, and the badge panel says out loud that margin is not
  // live. Do not read a business decision off it.
  function syntheticCost(sku, price) {
    var h = 0;
    for (var i = 0; i < sku.length; i++) { h += sku.charCodeAt(i); }
    var marginPct = 0.28 + (h % 41) / 100;
    var cost = Math.max(0.5, +(price * (1 - marginPct)).toFixed(2));
    return { cost: cost, margin: price > 0 ? +((price - cost) / price).toFixed(3) : 0 };
  }

  // Thumbnail hue. pos/data.jsx keeps CAT_HUE module-private, so rather than
  // copy the table (a second copy is how these drift) we snapshot it off the
  // mock rows before replacing them.
  function snapshotHues(products) {
    products.forEach(function (p) {
      if (_catHue[p.cat] == null && p.hue != null) { _catHue[p.cat] = p.hue; }
    });
  }
  function hueFor(cat) { return _catHue[cat] != null ? _catHue[cat] : 90; }

  // ── the adapter ──────────────────────────────────────────────────────────
  function adaptProducts(state, rep) {
    var wmids = state.wmids || {};
    var stock = state.stock || {};
    var menuByExt = {};
    (state.menu || []).forEach(function (row) {
      (menuByExt[row.external_id] = menuByExt[row.external_id] || []).push(row);
    });
    var mapBySku = {};
    (((state.mapping || {}).mappings) || []).forEach(function (m) { mapBySku[m.sku] = m; });

    var unmappedCats = {}, doses = [], weightFlags = [], blankBrand = 0;
    var onSale = 0, extMismatch = [];

    var out = (state.catalog || []).map(function (p) {
      var sku = p.sku;
      var cat = normCat(p.category, unmappedCats);
      var pw = priceAndWas(p);
      if (pw.was != null) { onSale++; }

      // On-hand. The per-region stock matrix is what the API actually reserves
      // against; `inventory` on the product blob is a catalog-level hint and is
      // null on 10 of 31 rows. Prefer the matrix, sum across regions (this
      // estate is four regions, the design is one store), fall back to the hint.
      var qty = null, byRegion = {};
      for (var r in stock) {
        if (!Object.prototype.hasOwnProperty.call(stock, r)) { continue; }
        var cell = stock[r] && stock[r][sku];
        if (cell) { qty = (qty || 0) + (cell.qty || 0); byRegion[r] = cell; }
      }
      if (qty == null) { qty = (p.inventory == null ? 0 : p.inventory); }

      // MISMATCH 1 · external_id. The design renders 'HW-'+sku. The real
      // anchor is 'hyperwolf:sku:'+sku (wmdemo/catalog.py:17). An operator who
      // reads 'HW-BRD35SM' off the screen and searches Weedmaps for it finds
      // nothing at all.
      var ext = SKU_PREFIX + sku;
      var rows = menuByExt[ext] || [];
      if (!rows.length) {
        // Cross-check: if the API published this SKU under some OTHER
        // external_id, the prefix rule is wrong and we want to know loudly.
        for (var k in menuByExt) {
          if (k.slice(SKU_PREFIX.length) === sku && k !== ext) { extMismatch.push(k); }
        }
      }

      var listings = [], lastPushed = 0, anyUnconfirmed = false;
      rows.forEach(function (row) {
        if (row.published) {
          // MISMATCH 2 · the two listing ids are BACKWARDS in the design.
          // Truth: menu/pickup = wmids.menu, delivery = wmids.delivery.
          // Read, never hardcode -- the design's 342170912 does not exist.
          if (row.wm_menu_id === wmids.menu && listings.indexOf('pickup') < 0) { listings.push('pickup'); }
          if (row.wm_menu_id === wmids.delivery && listings.indexOf('delivery') < 0) { listings.push('delivery'); }
        }
        if (row.wm_item_id == null) { anyUnconfirmed = true; }
        if (row.last_pushed_at && row.last_pushed_at > lastPushed) { lastPushed = row.last_pushed_at; }
      });

      var mp = mapBySku[sku];
      var wmState, issue = null;
      if (!mp || mp.status !== 'active') {
        wmState = 'error';
        issue = 'No active Weedmaps product mapping for this SKU — it cannot publish until it is mapped.';
      } else if (!rows.length) {
        wmState = 'unlisted';
        issue = 'Not published to Weedmaps. Push to make it available online.';
      } else if (anyUnconfirmed || !listings.length) {
        wmState = 'pending';
        issue = 'Pushed but not confirmed by Weedmaps yet.';
      } else {
        wmState = 'synced';
      }

      var warn = weightWarning(p);
      if (warn) { weightFlags.push({ sku: sku, note: warn }); }
      if (!p.brand_name) { blankBrand++; }

      var cm = syntheticCost(sku, pw.price);

      return {
        id: sku,
        sku: sku,
        name: p.name,
        // brand_name is null on every live row today. We do NOT substitute a
        // vendor: shared/brands.js is the one brand DB and inventing a name
        // here would start a second one. '' is crash-safe (screen-catalog.jsx
        // :401 calls p.brand.toLowerCase()) and visibly empty, which is true.
        brand: p.brand_name || '',
        // The design's `strain` is the GENETICS CLASS (StrainPill renders
        // 'INDICA'/'SATIVA'/'HYBRID'). The API's `strain` is the strain NAME.
        // Feeding the name in would render a pill reading 'BLUE DREAM'.
        strain: p.genetics ? titleCase(p.genetics) : null,
        strainName: p.strain || null,
        cat: cat,
        catLive: p.category,
        thc: thcPercent(p.thc, doses),
        thcRaw: p.thc == null ? null : String(p.thc),
        wt: weightLabel(p),
        price: pw.price,
        was: pw.was,
        qty: qty,
        cost: cm.cost,
        margin: cm.margin,
        hue: hueFor(cat),
        active: qty > 0,
        wm: {
          state: wmState,
          listings: listings,
          ext: ext,
          last: lastPushed ? ago(lastPushed) : 'never',
          issue: wmState === 'synced' ? undefined : issue
        },
        _live: true,
        _stockByRegion: byRegion,
        _wmProductId: p.wm_product_id == null ? null : p.wm_product_id,
        _weightNote: warn
      };
    });

    rep.products = out.length;
    rep.unmappedCats = unmappedCats;
    rep.thcDoses = doses;
    rep.weightFlags = weightFlags;
    rep.blankBrand = blankBrand;
    rep.onSale = onSale;
    rep.extMismatch = extMismatch;
    return out;
  }

  function adaptRegionsAndDrivers(state, rep) {
    // MISMATCH 7 · regions. Design: Lake Elsinore / Wildomar / Lakeland Vlg /
    // Temescal / Murrieta. Live: corona, long-beach, riverside, west-la.
    // ZERO overlap -- there is nothing to merge, only to replace.
    var regionsRaw = state.regions || {};
    var slugs = Object.keys(regionsRaw).sort();
    var labels = slugs.map(regionLabel);

    var onShift = state.on_shift || {};
    var kits = state.kits || {};
    // A driver with at least one IN_PROGRESS order is genuinely on route.
    var openByDriver = {};
    (state.orders || []).forEach(function (o) {
      if (o.status === 'IN_PROGRESS' && o.driver_id) {
        openByDriver[o.driver_id] = (openByDriver[o.driver_id] || 0) + 1;
      }
    });

    var drivers = [];
    slugs.forEach(function (slug) {
      (regionsRaw[slug].drivers || []).forEach(function (id) {
        drivers.push({
          id: id,
          name: driverLabel(id),
          region: regionLabel(slug),
          regionSlug: slug,
          status: openByDriver[id] ? 'on-route' : (onShift[id] ? 'idle' : 'offline'),
          // The API models a driver as a POOL MEMBER WITH A KIT, not a routed
          // vehicle: there is no stop list and no vehicle capacity anywhere in
          // /api/state. Leaving these null renders the load meter empty and the
          // counter as '/'. That is the honest reading. Filling them with the
          // raw IN_PROGRESS count would print '1076/6' -- a true number that
          // means nothing, because this demo DB has been hammered by the probe
          // suites. See hw-live.README.md for how to wire real stops if the API
          // ever exposes a route.
          stops: null,
          cap: null,
          eta: '—',
          openOrders: openByDriver[id] || 0,
          kit: kits[id] || [],
          zips: regionsRaw[slug].zips || []
        });
      });
    });

    rep.regions = labels;
    rep.drivers = drivers.length;
    return { labels: labels, drivers: drivers };
  }

  function apply(state) {
    var HW = _hw;
    if (!HW) { return false; }
    var rep = { at: new Date().toISOString(), base: base, ms: _t0 ? Math.round(performance.now() - _t0) : null };

    if (!_applied) { snapshotHues(HW.PRODUCTS || []); }

    var products = adaptProducts(state, rep);
    var rd = adaptRegionsAndDrivers(state, rep);

    replaceContents(HW.PRODUCTS, products);
    replaceContents(HW.REGIONS, rd.labels);
    replaceContents(HW.DRIVERS, rd.drivers);
    HW.FLEET_TOTAL = rd.drivers.length;   // property write, not a reassignment of HW

    // MISMATCH 2, second half. Mutate the listing objects in place so anything
    // holding a reference to WM_LISTINGS.pickup still sees the correction.
    var wmids = state.wmids || {};
    if (HW.WM_LISTINGS) {
      if (HW.WM_LISTINGS.pickup) { HW.WM_LISTINGS.pickup.id = String(wmids.menu); }
      if (HW.WM_LISTINGS.delivery) { HW.WM_LISTINGS.delivery.id = String(wmids.delivery); }
    }
    rep.wmids = { pickup: String(wmids.menu), delivery: String(wmids.delivery) };

    // The live estate has no single-store identity; it has pickup counters, one
    // per region. Only the count is knowable, so only the count is replaced.
    if (HW.STORE && Array.isArray(state.pickup_locations)) {
      HW.STORE.count = state.pickup_locations.length;
    }

    rep.stillMock = ['MEMBERS', 'CHECKINS', 'ORDERS', 'DELIVERY', 'IDV', 'STATS',
                     'WM_ORDER', 'ORDER_BIND', 'REWARDS', 'cost / margin'];
    rep.unreconciled = Object.keys(state.unreconciled_menus || {});
    _report = rep;
    _applied = true;
    return true;
  }

  // ── render capture ───────────────────────────────────────────────────────
  // The fetch normally finishes long before Babel has compiled the .jsx tree,
  // so `apply()` runs before the first render and nothing else is needed. But
  // "normally" is not "always": on a cold cache or a busy machine the payload
  // can land after pos/app.jsx has already mounted. Rather than leave the
  // screen on stale mock data, capture the root so we can re-render it once.
  function armRenderCapture() {
    var RD = W.ReactDOM;
    if (!RD || typeof RD.createRoot !== 'function' || RD.createRoot.__hwLive) { return; }
    var orig = RD.createRoot;
    function patched(container, options) {
      var root = orig.call(RD, container, options);
      var render = root.render.bind(root);
      root.render = function (el) { _root = root; _rootEl = el; return render(el); };
      return root;
    }
    patched.__hwLive = true;
    RD.createRoot = patched;
  }

  function rerenderIfMounted() {
    if (_root && _rootEl) { try { _root.render(_rootEl); } catch (e) {} }
  }

  // ── theme-aware badge ────────────────────────────────────────────────────
  // pos/tokens.jsx is the ONLY place colours are defined (CLAUDE.md rule 2).
  // If THEMES is not on the page we render no badge at all rather than write a
  // hex literal here.
  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body.style.colorScheme;
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  var _badge = null, _panelOpen = false;

  function line(P, k, v, tone) {
    return '<div style="display:flex;gap:10px;justify-content:space-between;padding:3px 0">' +
      '<span style="color:' + P.inkMute + '">' + esc(k) + '</span>' +
      '<span style="color:' + (tone || P.ink) + ';font-family:' + P.fontMono + ';text-align:right">' + esc(v) + '</span></div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function panelHTML(P) {
    var r = _report;
    var live = _status === 'live';
    var h = '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:8px">Data source</div>';
    if (!live) {
      h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        'Screens are on the built-in <b>mock</b> catalogue. ' +
        esc(_status === 'off' ? 'The live seam is switched off.' :
            _status === 'unreachable' ? 'No API answered at ' + base + '/api/state.' :
            'The API did not answer within ' + FETCH_TIMEOUT_MS + 'ms.') +
        '</div>';
      return h;
    }
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;margin-bottom:10px">' +
      'Catalogue, regions, fleet and the Weedmaps listing ids come from <span style="font-family:' + P.fontMono + '">' + esc(base) + '/api/state</span>.</div>';
    h += line(P, 'Products', r.products, P.ink);
    h += line(P, 'On sale', r.onSale, r.onSale ? P.ink : P.inkMute);
    h += line(P, 'Regions', r.regions.join(', '), P.ink);
    h += line(P, 'Drivers', r.drivers, P.ink);
    h += line(P, 'Pickup listing', r.wmids.pickup, P.ink);
    h += line(P, 'Delivery listing', r.wmids.delivery, P.ink);
    h += line(P, 'external_id', SKU_PREFIX + '<sku>', P.ink);

    var notes = [];
    var uc = Object.keys(r.unmappedCats || {});
    notes.push('Wellness and Deals have no live analogue — those chips read 0 on purpose.');
    if (uc.length) { notes.push('Unmapped live categories: ' + uc.join(', ') + ' — shown under All only.'); }
    if (r.thcDoses.length) { notes.push(r.thcDoses.length + ' row(s) store THC as a dose (' + r.thcDoses.join(', ') + '), not a percentage — THC reads as blank, never as a potency.'); }
    (r.weightFlags || []).forEach(function (f) { notes.push(f.sku + ': ' + f.note); });
    if (r.blankBrand) { notes.push(r.blankBrand + ' of ' + r.products + ' live rows have brand_name = null — the Brand column is blank rather than invented.'); }
    if (r.extMismatch && r.extMismatch.length) { notes.push('external_id prefix disagreement: ' + r.extMismatch.join(', ')); }
    if (r.unreconciled && r.unreconciled.length) { notes.push('Menus not reconciled: ' + r.unreconciled.join(', ')); }
    notes.push('Drivers have no stop list or capacity in the API — the load meter is empty by design.');
    notes.push('Still mock: ' + r.stillMock.join(', ') + '.');

    h += '<div style="margin-top:10px;padding-top:9px;border-top:1px solid ' + P.hairline + '">';
    notes.forEach(function (n) {
      h += '<div style="display:flex;gap:7px;font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45;margin-bottom:5px">' +
        '<span style="color:' + P.inkFaint + '">·</span><span>' + esc(n) + '</span></div>';
    });
    h += '</div>';
    return h;
  }

  function paintBadge() {
    if (!armed) { return; }
    var P = palette();
    if (!P) { return; }   // no tokens on the page -> no badge, and no hex here

    if (!_badge) {
      _badge = document.createElement('div');
      _badge.id = 'hw-live-badge';
      document.body.appendChild(_badge);
      _badge.addEventListener('click', function (e) {
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-hwl');
        if (act === 'refresh') { e.stopPropagation(); W.HW_LIVE.refresh(); return; }
        _panelOpen = !_panelOpen;
        paintBadge();
      });
      // The pill advertises itself as a button (role + tabindex + the focus ring
      // tokens.jsx injects for [data-hw-i]). A control that takes focus and then
      // ignores Enter is worse than one that never took focus at all.
      _badge.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-hwl');
        if (act === 'refresh') { W.HW_LIVE.refresh(); return; }
        _panelOpen = !_panelOpen;
        paintBadge();
      });
    }

    var live = _status === 'live';
    var dot = live ? P.good : _status === 'pending' ? P.warn : P.inkFaint;
    var label = live ? 'Live data' : _status === 'pending' ? 'Checking API…' : 'Mock data';
    var sub = live ? _report.products + ' SKUs · ' + _report.regions.length + ' regions' :
      _status === 'pending' ? base.replace(/^https?:\/\//, '') : 'API unavailable';

    // pointer-events:none on the wrapper so the empty gutter to the right of a
    // short pill does not swallow clicks meant for the screen underneath.
    _badge.style.cssText = 'position:fixed;left:' + (RAIL_W + 12) + 'px;bottom:14px;z-index:2147482000;' +
      'pointer-events:none;font-family:' + P.fontSans +
      ';max-width:min(360px,calc(100vw - ' + (RAIL_W + 28) + 'px));';

    var html = '';
    if (_panelOpen) {
      html += '<div style="background:' + P.surface + ';border:1px solid ' + P.hairline2 + ';border-radius:' + P.r12 + 'px;' +
        'box-shadow:' + P.shadowLg + ';padding:13px;margin-bottom:8px;max-height:60vh;overflow:auto;pointer-events:auto">' + panelHTML(P) +
        '<button data-hwl="refresh" style="margin-top:11px;width:100%;min-height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;' +
        'border:1px solid ' + P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';' +
        'font-size:' + P.type.meta + 'px;font-weight:600;cursor:pointer">Re-fetch /api/state</button></div>';
    }
    html += '<div role="button" tabindex="0" data-hw-i title="' + esc(label + ' — click for detail') + '" ' +
      'style="display:inline-flex;align-items:center;gap:8px;min-height:' + P.ctrlH.xs + 'px;padding:0 12px;' +
      'border-radius:' + P.r999 + 'px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + ';' +
      'box-shadow:' + P.shadowSm + ';cursor:pointer;user-select:none;pointer-events:auto">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + dot + ';flex:0 0 auto"></span>' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">' + esc(label) + '</span>' +
      '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' + P.fontMono + '">' + esc(sub) + '</span></div>';
    _badge.innerHTML = html;
  }

  // pos/tokens.jsx repaints document.body.style on every theme change and emits
  // no event, so the style attribute is the only signal available to a plain-JS
  // module. Cheaper and exact, versus polling.
  function watchTheme() {
    if (!W.MutationObserver || !document.body) { return; }
    new MutationObserver(function () { if (_badge) { paintBadge(); } })
      .observe(document.body, { attributes: true, attributeFilter: ['style'] });
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  function load() {
    _t0 = performance.now();
    var ctl = W.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctl) { ctl.abort(); }
      if (!_settled) { settle(null, 'timeout'); }
    }, FETCH_TIMEOUT_MS);

    return fetch(base + '/api/state', {
      signal: ctl ? ctl.signal : undefined,
      credentials: 'omit',
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    }).then(function (json) {
      clearTimeout(timer);
      // A payload without a catalog is not a live estate, it is a different
      // service answering on the same port. Refusing it beats rendering an
      // empty POS and calling it live.
      if (!json || !Array.isArray(json.catalog) || !json.wmids) {
        settle(null, 'unreachable');
        return;
      }
      settle(json, 'live');
    }).catch(function () {
      clearTimeout(timer);
      if (!_settled) { settle(null, 'unreachable'); }
    });
  }

  function settle(json, status) {
    _settled = true;
    _payload = json;
    if (json) {
      if (_hw) {
        _status = apply(json) ? 'live' : 'unreachable';
        rerenderIfMounted();
      } else {
        _status = status;   // HW not up yet; the setter will apply
      }
    } else {
      _status = status;
    }
    if (_hw) { paintBadge(); }
  }

  // ── the seam itself ──────────────────────────────────────────────────────
  // pos/data.jsx:322 does `window.HW = {...}` exactly once, and seven entry
  // HTMLs load that file, so this accessor is the single point at which every
  // POS screen's data can be swapped.
  if (armed) {
    try {
      Object.defineProperty(W, 'HW', {
        configurable: true,
        enumerable: true,
        get: function () { return _hw; },
        set: function (v) {
          _hw = v;
          if (!_settled) { armRenderCapture(); }   // payload may still be in flight
          if (_payload) { _status = apply(_payload) ? 'live' : _status; }
          watchTheme();
          paintBadge();
        }
      });
    } catch (e) {
      armed = false;   // some environment already locked window.HW; stay on mock
      _status = 'off';
    }
  }

  W.HW_LIVE = {
    __armed: armed,
    get status() { return _status; },
    get report() { return _report; },
    get base() { return base; },
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _settled = false; _status = 'pending'; paintBadge();
      return load().then(function () { rerenderIfMounted(); return _status; });
    },
    disable: function () {
      try { W.localStorage.setItem(OFF_KEY, '1'); } catch (e) {}
      W.location.reload();
    },
    enable: function () {
      try { W.localStorage.removeItem(OFF_KEY); } catch (e) {}
      W.location.reload();
    }
  };

  if (armed) { load(); }
})();
