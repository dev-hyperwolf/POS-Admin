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
// PUBLIC SURFACE: window.HW_LIVE = { status, report, refresh(), disable(),
//   post(path, body), setToken(v), clearToken(), hasToken(), writes }.
// post() is the ONE write path for this seam and its four siblings: it attaches
// the x-hw-write-token header when a token is known and returns the server's own
// error/hint instead of a bare status code.
// Turn it off: append `?hwlive=off`, or run `HW_LIVE.disable()` in the console.
(function () {
  'use strict';
  var W = window;
  if (W.HW_LIVE && W.HW_LIVE.__armed) { return; }   // idempotent: two tags, one seam

  // ── configuration ────────────────────────────────────────────────────────
  // Past this we stop WAITING and mount on mock -- we do not stop the request.
  // 2500 was too tight and, worse, the timeout used to abort() the fetch, so a
  // payload that arrived at 2.6s could never land and the demo was pinned to
  // mock data for the rest of the session. /api/state is ~1.9MB and Babel is
  // compiling thirty JSX files on the same thread during a cold load, so
  // blowing a 2.5s budget is normal rather than exceptional. The request now
  // runs to completion and applies late, exactly as the board fetch already
  // does -- the badge simply shows mock until it lands.
  var FETCH_TIMEOUT_MS = 4000;
  var OFF_KEY = 'hw-live-off';
  var RAIL_W = 74;               // shared/app-rail.jsx:46 — badge clears the rail
  var SKU_PREFIX = 'hyperwolf:sku:';  // wmdemo/catalog.py:17 — the real anchor
  // The board is a SECOND, slower call (it walks every order row), so it gets
  // its own controller and its own budget. It must never be able to abort the
  // catalogue fetch: a slow board should cost the order queue, not the whole
  // live path.
  var BOARD_TIMEOUT_MS = 8000;
  var BOARD_LIMIT = 200;         // per stage; the board's COUNTS are exact regardless
  var DELIVERY_CAP = 250;        // delivery rows kept. Pickup is never capped — see below.

  // ── gate ─────────────────────────────────────────────────────────────────
  // Loopback only. The API serves this repo itself when WM_DEMO_STATIC_DIR is
  // set (wmdemo/server.py _serve_static), so on the live path the page and the
  // API share an origin and CORS never enters the picture.
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' -- it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // discarded. That is not cosmetic here: it dropped the colour off the line
  // naming which Weedmaps node had died, which then computed black-on-near-black
  // and was INVISIBLE in dark mode. Single quotes are equally valid in CSS and
  // survive the attribute.
  function ff(v) { return String(v).replace(/"/g, "'"); }

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

  // ARMED ON ANY ORIGIN, and the SAME-ORIGIN FETCH decides.
  //
  // This used to require a loopback origin, which meant the seam was inert
  // anywhere the demo was actually hosted -- a tunnel or a deployed instance
  // served the design and then rendered MOCK data, which is the worst of both
  // outcomes. "Is this localhost?" was never the real question; "does this
  // origin serve our API?" is, and it answers itself: on GitHub Pages
  // /api/state 404s, the fetch fails, and we fall back to the mock exactly as
  // before. No regression to the public demo, and a hosted one comes alive.
  //
  // The OVERRIDE stays loopback-only. That check exists for a different reason
  // and is still needed: a crafted ?hwlive=<host> link could otherwise point a
  // viewer's page at an arbitrary server and render whatever it returns as if
  // it were the operator's own catalog.
  var armed = !disabled;

  // ── writes: the token, and the one POST helper ─────────────────────
  //
  // WHY THIS EXISTS. The deployed demo runs WM_DEMO_PUBLIC=1, and the gate at
  // wmdemo/server.py:364 refuses every POST that does not carry
  // `x-hw-write-token` -- and it runs BEFORE the route table, so it catches
  // check-in, stage advance, taxonomy mapping and identity verify alike. No
  // seam sent that header, so on the deployed URL every interactive control in
  // this estate failed, and failed while printing a bare status code over a 403
  // whose body carried a perfectly good sentence. Both halves are fixed here,
  // once, for all four sibling seams.
  //
  // SECURITY, and it is not negotiable: this token is the only thing between a
  // public URL and anonymous writes to real Weedmaps listings. So it is
  //   * sent to OUR OWN ORIGIN and nowhere else -- never to an ?hwlive=
  //     override, never cross-origin (sameOrigin() below);
  //   * stripped out of the address bar the instant it is read, so it cannot be
  //     screenshotted, pasted into a chat along with the link, or handed to the
  //     next site in a Referer header;
  //   * never logged, never echoed into an error string, and never rendered
  //     back into the DOM -- not even masked. A masked secret is still a secret
  //     with its length published.
  var TOKEN_KEY = 'hw-live-token';
  var TOKEN_HEADER = 'x-hw-write-token';   // wmdemo/server.py:366
  var PROBE_PATH = '/api/__hw_write_probe';
  var _token = null;
  var _writes = 'unknown';   // unknown | writable | gated | rejected
  var _tokenSent = false;    // did the last ANSWERED post actually carry it

  function loadToken() {
    try { return (W.localStorage.getItem(TOKEN_KEY) || '').trim() || null; }
    catch (e) { return null; }
  }
  function storeToken(v) {
    try {
      if (v) { W.localStorage.setItem(TOKEN_KEY, v); }
      else { W.localStorage.removeItem(TOKEN_KEY); }
    } catch (e) {}
  }

  // `base` is normally W.location.origin, but ?hwlive=<loopback> can repoint
  // it, and a repointed base is BY DEFINITION a different server. It does not
  // get our secret just because it answers on 127.0.0.1.
  function sameOrigin() { return base === W.location.origin; }

  function takeTokenFromURL() {
    var raw = qs('hwtoken');
    if (raw === null) { return; }
    // STRIP FIRST, unconditionally, before the value is even looked at.
    // Everything after this line can fail safely; a token left in the address
    // bar cannot.
    try {
      var kept = W.location.search.replace(/^\?/, '').split('&').filter(function (p) {
        return p && p.split('=')[0] !== 'hwtoken';
      });
      if (W.history && W.history.replaceState) {
        W.history.replaceState(null, '', W.location.pathname +
          (kept.length ? '?' + kept.join('&') : '') + W.location.hash);
      }
    } catch (e) {}
    var v = String(raw).trim();
    _token = v || null;         // `?hwtoken=` with nothing after it is the log-out
    storeToken(_token);
  }

  _token = loadToken();
  takeTokenFromURL();           // a token on the URL wins over the stored one

  // THE one POST path. Returns the shape the sibling seams' own fetch chains
  // already build -- { ok, code, body } -- so adopting it is a one-line change
  // in each, plus `error`, `hint` and `gated` for anything that wants the
  // reason without digging for it.
  //
  // It NEVER rejects. A caller forced to choose between .then and .catch to
  // learn whether a request was refused is a caller that gets it wrong once and
  // reports a COMMITTED write as a network error -- which is exactly the bug
  // advance() carries a comment about below.
  function post(path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var sent = false;
    if (_token && sameOrigin()) { headers[TOKEN_HEADER] = _token; sent = true; }
    return fetch(base + path, {
      method: 'POST',
      headers: headers,
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (j) { return settleWrite(res, j, sent); },
                             function () { return settleWrite(res, null, sent); });
    }).catch(function (e) {
      // The browser's own message ('Failed to fetch'), never ours, and never
      // anything derived from the token.
      return { ok: false, code: 0, body: null, gated: false, hint: null,
               error: 'request failed: ' + (e && e.message ? e.message : 'unknown') };
    });
  }

  function settleWrite(res, j, sent) {
    // Only the public-mode gate answers 403 with an `error` beginning
    // 'read-only' (wmdemo/server.py:368). Anything else -- 200, 400, 404, 500 --
    // means the gate let us through, whatever the route then decided.
    var gated = res.status === 403 && !!(j && typeof j.error === 'string' &&
                                         j.error.indexOf('read-only') === 0);
    // A body we could not parse as JSON is not this API talking (a static host
    // answers a POST with an HTML 405), so it is evidence of nothing and we
    // claim nothing from it. Silence beats a green tick.
    if (j) {
      _tokenSent = sent;
      noteWrites(gated ? (sent ? 'rejected' : 'gated') : 'writable');
    }
    // ONE VALUE, TWO DIALECTS. Routes here answer a refusal with `error`
    // (stage, taxonomy, identity) or with `why` (check-in). The check-in seam
    // prints `why`, which is how a 403 carrying a perfectly good sentence
    // surfaced as 'HTTP 403 with no reason in the body'. The alias is only ever
    // ADDED, never overwritten, and the string is always the server's own -- we
    // are renaming a key, not inventing a reason.
    if (j && typeof j.error === 'string' && j.why == null) { j.why = j.error; }
    return {
      ok: res.ok,
      code: res.status,
      body: j,
      gated: gated,
      error: (j && (j.error || j.why)) || ('HTTP ' + res.status),
      hint: (j && j.hint) || null
    };
  }

  function noteWrites(state) {
    if (_writes === state) { return; }
    _writes = state;
    paintBadge();
  }

  // A NON-MUTATING write probe. The gate runs BEFORE the route table, so a POST
  // to a path that does not exist comes back 403 'read-only' when writes are
  // gated and 404 'not found' when they are not. Nothing is created, nothing is
  // changed, no real endpoint is touched -- which is the only reason it is safe
  // to point at the shared demo. Verified 2026-08-19: 403 from
  // hyperwolf-wm-demo.onrender.com, 404 from 127.0.0.1:8787.
  //
  // The 404 IS the good answer, and devtools logs it as a failed resource.
  // That one red line in the console is the price of the badge being able to
  // say 'writes enabled' truthfully instead of guessing, and it is the only
  // request this seam makes that is expected to fail.
  function probeWrites() { return post(PROBE_PATH, {}).then(function () { return _writes; }); }


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

  // orders
  var _board = null;          // parsed /api/fulfillment/board, or null
  var _statusMap = null;      // parsed /api/fulfillment/status-map, or null
  var _ordersLive = false;
  var _stageOverride = {};    // order_id -> the order_view a POST /api/order/stage returned
  var _advId = '', _advStage = 'packing', _advMsg = null, _advOk = false;

  var _deliveryCap = DELIVERY_CAP;
  var capQ = qs('hworders');
  if (capQ != null) {
    if (/^all$/i.test(capQ)) { _deliveryCap = Infinity; }
    else { var capN = parseInt(capQ, 10); if (isFinite(capN) && capN >= 0) { _deliveryCap = capN; } }
  }

  // ── small helpers ────────────────────────────────────────────────────────
  function replaceContents(arr, next) {
    // The whole point of the file: same array identity, new contents.
    arr.length = 0;
    for (var i = 0; i < next.length; i++) { arr.push(next[i]); }
    return arr;
  }

  // Same rule for the two order LOOKUPS (WM_ORDER, DELIVERY): same object
  // identity, new keys. Anything holding a reference keeps working.
  function replaceObject(obj, next) {
    if (!obj) { return obj; }
    Object.keys(obj).forEach(function (k) { delete obj[k]; });
    Object.keys(next).forEach(function (k) { obj[k] = next[k]; });
    return obj;
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

  // The order card prints `o.age` verbatim and reads staleness off it with
  // parseInt (screen-orders.jsx:426), so the design's own 'Xh Ym' shape is the
  // only safe one. Past two days it would read '751h 4m', so it rolls to days —
  // parseInt still sees a number >= 2 and the card still marks it aging.
  function ageLabel(epochSeconds) {
    if (!epochSeconds) { return '—'; }
    var s = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
    if (s < 172800) { return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm'; }
    return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
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

  // ── ORDERS · the fulfilment board ────────────────────────────────────────
  // The kanban reads window.HW.ORDERS[].stage; the Weedmaps block on an order
  // reads window.HW.WM_ORDER[id]; the dispatch table reads window.HW.DELIVERY
  // [id]. All three were invented. They are replaced from
  // /api/fulfillment/board (stage, push state, exact counts) joined to
  // /api/state.orders (the fields the board does not carry: fulfilment type,
  // driver, region).
  //
  // THREE THINGS THIS MUST NOT LIE ABOUT.
  //
  // 1. THE WEEDMAPS COLUMN. A stage maps to a WM status, but that map is a
  //    CONTRACT — what we WOULD tell Weedmaps — not evidence that we did. The
  //    Orders API 403s (wmdemo/fulfillment.py:20), so a push can sit queued or
  //    fail while our stage moves on. The board reports both halves per order:
  //    wm_status_mirrored (what WM was last told) and push.state. The block's
  //    top line therefore always says what Weedmaps ACTUALLY has and whether
  //    anything reached it. Painting a stage change as delivered is exactly the
  //    failure that let 1,064 failed pushes look like success.
  //
  // 2. GUESSED STAGES. An order with no persisted stage row is not stageless:
  //    its stage is reverse-mapped from the WM status on the spot, and
  //    IN_PROGRESS reverses to BOTH `pack` and `packing`. Almost every order
  //    here is in that state (the backfill has never been run), so the board
  //    reports stage_is_guess and those cards carry 'stage guessed' next to
  //    the clock. An order someone has actually advanced is exact and carries
  //    no mark.
  //
  // 3. COUNTS. The board's per-stage LISTS are capped; its COUNTS are exact.
  //    The design's kanban is the pickup board, so pickup orders are never
  //    capped — every one is loaded and every column count is the estate's own
  //    number. Delivery is a flat table and IS capped; the badge panel says by
  //    how much, because the tab counter then reads the page size.
  var DESIGN_STAGES = ['verify', 'pack', 'packing', 'ready', 'done'];

  // Reverse map DERIVED from the served contract rather than typed out a second
  // time. fulfillment.py's own warning: "two copies that agree today are a
  // scheduled outage, not a source of truth." First stage wins, and a WM status
  // claimed by two stages is flagged ambiguous — which reproduces the server's
  // is_guess rule (fulfillment.py stage_for_wm_status) without restating it.
  function reverseStageMap(sm) {
    var map = sm.map || {}, rev = {};
    (sm.stages || []).forEach(function (st) {
      var wm = (map[st] || {}).wm;
      if (!wm) { return; }
      if (rev[wm]) { rev[wm].ambiguous = true; } else { rev[wm] = { stage: st, ambiguous: false }; }
    });
    return rev;
  }

  // What has, or has not, reached Weedmaps for THIS order. `queueEmpty` is the
  // one case where an order outside the board's slice can still be answered
  // exactly: if the whole queue is empty, nothing was pushed for anything.
  function pushPhrase(v, queueEmpty) {
    if (queueEmpty) { return 'never sent to Weedmaps'; }
    if (!v) { return 'not loaded for this order (outside the board slice)'; }
    var p = v.push || {};
    if (!p.state || p.state === 'none') { return 'never sent to Weedmaps'; }
    if (p.state === 'pending') { return 'QUEUED, not sent yet'; }
    if (p.state === 'claimed') { return 'in flight'; }
    if (p.state === 'sent') { return 'sent ' + ago(p.updated_at); }
    if (p.state === 'failed') {
      return 'FAILED after ' + (p.attempts || 0) + ' — ' + (p.last_error || 'no reason recorded');
    }
    return p.state;
  }

  function adaptOrders(state, rep) {
    var smap = _statusMap.map || {};
    var rev = reverseStageMap(_statusMap);
    var wmids = state.wmids || {};
    var q = _board.queue || {};
    var queueEmpty = !((q.pending || 0) + (q.claimed || 0) + (q.sent || 0) + (q.failed || 0));

    var bview = {};
    (_board.stages || []).forEach(function (g) {
      (g.orders || []).forEach(function (v) { bview[String(v.order_id)] = v; });
    });

    var reviews = {};
    (((state.identity || {}).reviews) || []).forEach(function (r) {
      if (r.state === 'open') { reviews[String(r.wm_order_id)] = r; }
    });

    // Region chips on the dispatch view are built from state.regions. An order
    // whose region_id is not one of those is real, but no chip will ever find
    // it — the same shape as the unmapped catalogue categories above.
    var knownRegions = state.regions || {};
    var offRegion = {};

    var counts = {}, unplaceable = {}, canceledHidden = 0;
    var guessed = 0, chGuessed = 0, outOfSync = 0, deliveryKept = 0, reviewOpen = 0, pushFailed = 0;
    DESIGN_STAGES.forEach(function (s) { counts[s] = { Store: 0, Delivery: 0 }; });

    var rows = (state.orders || []).slice().sort(function (a, b) {
      return (b.updated_at || 0) - (a.updated_at || 0);
    });

    var orders = [], wmOrder = {}, delivery = {};

    rows.forEach(function (o) {
      var id = String(o.wm_order_id);
      // Precedence: what a stage POST just told us > what the board listed >
      // the reverse map. Only the last of those three is a derivation.
      var v = _stageOverride[id] || bview[id] || null;
      var status = String(o.status == null ? '' : o.status).trim().toUpperCase();
      var r = rev[status];
      if (!v && !r) {
        // A status the served contract does not place. Counting it beats
        // parking it in `verify` and calling that a stage.
        var key = status || '(blank)';
        unplaceable[key] = (unplaceable[key] || 0) + 1;
        return;
      }
      var stage = v ? v.stage : r.stage;
      var guess = v ? !!v.stage_is_guess : r.ambiguous;
      // The design's board has five columns and no Canceled one. Mapping a
      // canceled order onto a live column would be the worst of both; it is
      // dropped, and the count is reported.
      if (DESIGN_STAGES.indexOf(stage) < 0) { canceledHidden++; return; }

      var ch, chGuess = false;
      if (o.fulfillment_type === 'pickup' || (wmids.menu != null && o.wm_menu_id === wmids.menu)) {
        ch = 'Store';
      } else if (o.fulfillment_type === 'delivery' ||
                 (wmids.delivery != null && o.wm_menu_id === wmids.delivery)) {
        ch = 'Delivery';
      } else {
        // Neither a fulfilment type nor a listing id. It has to land on one of
        // the two tabs or vanish; it lands on the one this estate actually
        // runs, and says on the card that that was a guess.
        ch = 'Delivery'; chGuess = true;
      }

      var mapped = (smap[stage] || {}).wm || null;
      var sync = mapped != null && mapped === status;

      counts[stage][ch]++;
      if (guess) { guessed++; }
      if (chGuess) { chGuessed++; }
      if (!sync) { outOfSync++; }
      if (reviews[id]) { reviewOpen++; }

      // Counted above, kept below: the cap must not bend the numbers.
      if (ch === 'Delivery') {
        if (deliveryKept >= _deliveryCap) { return; }
        deliveryKept++;
      }

      var marks = [];
      if (guess) { marks.push('stage guessed'); }
      if (chGuess) { marks.push('channel guessed'); }

      var name = o.customer_name && String(o.customer_name).trim() ?
        String(o.customer_name).trim() : 'No name on the order';

      orders.push({
        id: id,
        num: id,
        name: name,
        total: Number(o.grand_total) || 0,
        source: 'Weedmaps',      // gates the WM block on the card and the sheet
        channel: ch,
        // No payment record exists on an order row. The design prints this
        // verbatim after the word "Pay".
        pay: 'Not in the API',
        badge: null,
        // The only per-card slot the design leaves free for provenance.
        age: ageLabel(v ? v.stage_updated_at : o.updated_at) +
             (marks.length ? ' · ' + marks.join(' · ') : ''),
        // /api/state carries no line items, and inventing a basket size would
        // put a fake number on every card. 0 reads as "we were not told".
        items: 0,
        stage: stage,
        hue: 200,
        _live: true,
        _guess: guess,
        _mirrored: status,
        _mapped: mapped,
        _inSync: sync,
        _push: v ? v.push : null
      });

      var pstate = v && v.push ? (v.push.state || 'none') : (queueEmpty ? 'none' : null);
      if (pstate === 'failed') { pushFailed++; }

      var rvw = reviews[id];
      var flags = ['The API carries no identity or fraud scoring for this order — ' +
                   'nothing on this panel has been checked.'];
      if (rvw) {
        flags.push('Identity review OPEN in the API — decision "' + rvw.decision +
                   '" (' + rvw.reason + ')');
      }

      // The one line always visible at the top of the Weedmaps block, and the
      // only honest answer to "has Weedmaps been told?".
      //
      // ORDER MATTERS HERE. The push state comes FIRST because it is the only
      // evidence. orders.status is a LOCAL MIRROR, and engine.push_status_tracked
      // (wmdemo/engine.py) calls upsert_order(status=...) BEFORE it looks at the
      // HTTP code — so the mirror is rewritten even when Weedmaps rejected the
      // call. Verified 2026-08-19: two orders advanced to `ready`, both pushes
      // came back HTTP 400, and both mirrors nonetheless read
      // READY_FOR_ATTAINMENT. Leading with the mirror would have rendered a
      // rejected push as an accepted one — the exact failure the fulfilment
      // module was written to end.
      var head = 'WM ' + id + ' · push: ' + pushPhrase(v, queueEmpty) +
                 ' · local mirror: ' + (status || 'unknown');
      if (mapped && mapped !== status) { head += ' (our stage maps to ' + mapped + ')'; }
      if (pstate === 'failed') {
        // engine.push_status_tracked writes this column EITHER WAY -- that
        // call also creates the order row, and gating it on the response left
        // rejected orders with no row at all. So it records what we TRIED, not
        // what Weedmaps accepted, and the queue row above is the only evidence.
        // Verified rather than assumed: this order's push failed and the
        // mirror still reads the pushed status.
        head += ' — what we TRIED to send. It is written even on a rejected'
              + ' push, so it is NOT proof Weedmaps agrees; the push state'
              + ' above is';
      }

      wmOrder[id] = {
        wmId: head,
        contact: { name: name, phone: null, email: null, address: null },
        matchOn: [],
        wmStatus: status,
        // No risk model exists on this side. A number here would be read as a
        // verdict, so the panel reads "unknown risk · score 0/100" instead.
        risk: 0,
        level: 'unknown',
        match: 'new',
        checks: {
          id: 'missing', name: 'unverified', phone: 'missing',
          address: ch === 'Delivery' ? 'missing' : 'n/a'
        },
        flags: flags,
        delivery: ch === 'Delivery',
        remoteId: null
      };

      // Region and driver are real. Address, distance, ETA window and map
      // coordinates do not exist anywhere in the API, so they are left absent
      // and the table renders '—' rather than a plausible street.
      if (o.region_id && !Object.prototype.hasOwnProperty.call(knownRegions, o.region_id)) {
        offRegion[o.region_id] = (offRegion[o.region_id] || 0) + 1;
      }

      delivery[id] = {
        zone: o.region_id ? regionLabel(o.region_id) : null,
        driver: o.driver_id ? driverLabel(o.driver_id) : 'Unassigned'
      };
    });

    var pickupTotal = 0, deliveryTotal = 0;
    DESIGN_STAGES.forEach(function (s) {
      pickupTotal += counts[s].Store; deliveryTotal += counts[s].Delivery;
    });

    rep.orders = {
      shown: orders.length,
      pickup: { shown: pickupTotal, total: pickupTotal },   // never capped
      delivery: { shown: deliveryKept, total: deliveryTotal },
      byStage: counts,
      guessed: guessed,
      channelGuessed: chGuessed,
      outOfSync: outOfSync,
      pushFailed: pushFailed,
      reviewOpen: reviewOpen,
      canceledHidden: canceledHidden,
      unplaceable: unplaceable,
      offRegion: offRegion,
      queue: q,
      boardTotal: _board.total,
      boardGuessed: _board.guessed_stages,
      cap: _deliveryCap
    };
    return { orders: orders, wmOrder: wmOrder, delivery: delivery };
  }

  function applyOrders(rep) {
    var HW = _hw;
    if (!HW || !_payload || !_board || !_statusMap || !HW.ORDERS) { return false; }
    rep = rep || _report;
    if (!rep) { return false; }

    var out = adaptOrders(_payload, rep);
    replaceContents(HW.ORDERS, out.orders);
    replaceObject(HW.WM_ORDER, out.wmOrder);
    replaceObject(HW.DELIVERY, out.delivery);

    // The stage -> WM status -> customer sentence map is a CONTRACT, and the
    // API serves the only copy that matters. Overwriting the JSX literal's copy
    // in place is what stops the screen narrating one sentence while
    // weedmaps.com shows another — the drift fulfillment.py:30 warns about.
    var sm = _statusMap.map || {};
    if (HW.WM_STATUS_MAP) {
      Object.keys(sm).forEach(function (k) {
        var dst = HW.WM_STATUS_MAP[k];
        if (!dst) { dst = HW.WM_STATUS_MAP[k] = {}; }
        dst.wm = sm[k].wm; dst.label = sm[k].label; dst.cust = sm[k].cust; dst.tone = sm[k].tone;
      });
    }
    if (HW.WM_STATUS_ORDER && _statusMap.wm_status_order) {
      replaceContents(HW.WM_STATUS_ORDER, _statusMap.wm_status_order);
    }

    if (!_advId && out.orders.length) { _advId = out.orders[0].id; }
    _ordersLive = true;
    return true;
  }

  function stillMock() {
    var m = ['MEMBERS', 'CHECKINS', 'IDV', 'STATS', 'REWARDS', 'ORDER_BIND', 'cost / margin'];
    if (_ordersLive) {
      m.push('order line items', 'order activity log',
             'delivery addresses / distances / ETA windows / map pins');
    } else {
      m.unshift('ORDERS', 'WM_ORDER', 'DELIVERY');
    }
    return m;
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

    // The board may still be in flight; if it is, applyOrders runs when it
    // lands (see load()) and rewrites stillMock then.
    applyOrders(rep);
    rep.stillMock = stillMock();
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
    if (!_root || !_rootEl) { return; }
    try {
      // Re-rendering the SAME element object does NOTHING: React bails out when
      // the root child is reference-identical with identical props, so the
      // screens keep rendering the data they mounted with. Verified in the
      // browser 2026-08-19 — window.HW.ORDERS held 255 live orders, the badge
      // said 'live', and the tabs still counted the design's 11 mock ones.
      // cloneElement gives it a fresh props object, which is the difference
      // between "the payload landed" and "the payload landed and anyone can
      // see it".
      var el = (W.React && W.React.cloneElement) ? W.React.cloneElement(_rootEl) : _rootEl;
      _root.render(el);
    } catch (e) {}
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
      '<span style="color:' + (tone || P.ink) + ';font-family:' + ff(P.fontMono) + ';text-align:right">' + esc(v) + '</span></div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── writes panel ─────────────────────────────────────────────────────────
  // Read-only is a STATE, not an error, and it is stated first -- above the
  // catalogue counts -- because it is the answer to "why did that button do
  // nothing?". When it is read-only the panel says exactly how to fix it; a
  // user staring at a 403 must never have to guess.
  function writeLabel() {
    return _writes === 'writable' ? (_tokenSent ? 'Writes enabled (token accepted)' : 'Writes enabled')
         : _writes === 'gated'    ? 'Read-only \u2014 no write token'
         : _writes === 'rejected' ? 'Read-only \u2014 the stored token was refused'
         : 'Writes not tested yet';
  }

  function writesHTML(P) {
    var ok = _writes === 'writable';
    var bad = _writes === 'gated' || _writes === 'rejected';
    var tone = ok ? P.good : bad ? P.bad : P.inkMute;
    var ctl = 'height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink + ';font-size:' +
      P.type.meta + 'px;padding:0 8px;';
    var note = 'font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;margin-top:5px';

    var h = '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:6px">Writes</div>';
    h += '<div style="display:flex;align-items:center;gap:7px;font-size:' + P.type.body +
      'px;font-weight:700;color:' + tone + ';line-height:1.5">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + tone +
      ';flex:0 0 auto"></span>' + esc(writeLabel()) + '</div>';

    if (bad) {
      h += '<div style="' + note + '">' + esc(
        'this deployment gates writes; append ?hwtoken=\u2026 (Render dashboard \u2192 the ' +
        'service \u2192 Environment \u2192 WM_DEMO_WRITE_TOKEN)') + '</div>';
      h += '<div style="' + note + '">Or paste it here \u2014 it is stored for this browser only, ' +
        'sent to ' + esc(W.location.origin) + ' and nowhere else, and never shown again.</div>';
      h += '<div style="display:flex;gap:6px;align-items:center;margin-top:7px">' +
        '<input data-hwl-token type="password" autocomplete="off" spellcheck="false" ' +
          'placeholder="write token" style="' + ctl + 'flex:1;min-width:0;font-family:' + ff(P.fontMono) + '">' +
        '<button data-hwl="settoken" style="' + ctl + 'font-family:' + P.fontSans +
          ';font-weight:600;cursor:pointer;color:' + P.ink2 + '">Use</button></div>';
    } else if (ok) {
      h += '<div style="' + note + '">Every interactive control on this page \u2014 stage advance, ' +
        'check-in, identity, taxonomy \u2014 posts through this seam and is accepted.</div>';
    } else if (_status !== 'live') {
      h += '<div style="' + note + '">No API has answered here, so there is nothing to write to. ' +
        'The screens are on mock data.</div>';
    }

    // A stored token that CANNOT be sent is worse than none, because the user
    // believes they have fixed it. Say so.
    if (_token && !sameOrigin()) {
      h += '<div style="' + note + ';color:' + P.bad + '">A token is stored, but this page is served ' +
        'from ' + esc(W.location.origin) + ' while the API base is ' + esc(base) + '. It is never ' +
        'sent cross-origin, so writes stay read-only here.</div>';
    }
    if (_token) {
      h += '<button data-hwl="cleartoken" style="' + ctl + 'margin-top:7px;font-family:' + P.fontSans +
        ';font-weight:600;cursor:pointer;color:' + P.inkMute + '">Forget stored token</button>';
    }
    return '<div style="padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid ' +
      P.hairline + '">' + h + '</div>';
  }

  // ── the sibling dock ─────────────────────────────────────────────────────
  // The four sibling seams share window.HW_SEAM_DOCK (created by whichever of
  // them paints first): a tray of pills at bottom 52 and their panels at bottom
  // 92, both deliberately ABOVE this pill at bottom 14
  // (hw-live-identity.js:87-89). This panel opens UPWARD out of that pill,
  // straight into their column -- which is why the tray was painting on top of
  // it. So while it is open it sits above them and their panels close, which is
  // the dock's own one-panel-at-a-time rule (hw-live-identity.js:107); the
  // moment it closes it drops back under the tray and every sibling pill is
  // clickable again.
  var _dockReg = false;
  function dockSync() {
    var D = W.HW_SEAM_DOCK;
    if (!D) { return; }
    if (!_dockReg && D.register) {
      D.register('hw-live', function () {
        if (_panelOpen) { _panelOpen = false; paintBadge(); }
      });
      _dockReg = true;
    }
    if (_panelOpen && D.opened) { D.opened('hw-live'); }
  }

  // The value is read, used and wiped in the same tick; it is never written
  // back into the DOM and never leaves this function as anything but a header.
  function setTokenFromPanel() {
    if (!_badge) { return; }
    var el = _badge.querySelector('[data-hwl-token]');
    if (!el) { return; }
    var v = String(el.value || '').trim();
    el.value = '';
    if (!v) { return; }
    W.HW_LIVE.setToken(v);
  }

  function panelHTML(P) {
    var r = _report;
    var live = _status === 'live';
    var h = writesHTML(P);
    h += '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:8px">Data source</div>';
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
      'Catalogue, regions, fleet and the Weedmaps listing ids come from <span style="font-family:' + ff(P.fontMono) + '">' + esc(base) + '/api/state</span>.</div>';
    h += line(P, 'Products', r.products, P.ink);
    h += line(P, 'On sale', r.onSale, r.onSale ? P.ink : P.inkMute);
    h += line(P, 'Regions', r.regions.join(', '), P.ink);
    h += line(P, 'Drivers', r.drivers, P.ink);
    h += line(P, 'Pickup listing', r.wmids.pickup, P.ink);
    h += line(P, 'Delivery listing', r.wmids.delivery, P.ink);
    h += line(P, 'external_id', SKU_PREFIX + '<sku>', P.ink);

    var ro = r.orders;
    if (ro) {
      var q = ro.queue || {};
      h += '<div style="margin-top:10px;padding-top:9px;border-top:1px solid ' + P.hairline + '">' +
        '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:6px">Order queue</div></div>';
      h += line(P, 'Pickup board', ro.pickup.total + ' orders · complete', P.ink);
      h += line(P, 'Delivery tab', ro.delivery.shown + ' of ' + ro.delivery.total +
        (ro.delivery.shown < ro.delivery.total ? ' · capped' : ''),
        ro.delivery.shown < ro.delivery.total ? P.warn : P.ink);
      h += line(P, 'Stages guessed', ro.guessed + ' of ' + (ro.pickup.total + ro.delivery.total),
        ro.guessed ? P.warn : P.ink);
      h += line(P, 'Pushes failed', ro.pushFailed, ro.pushFailed ? P.bad : P.ink);
      h += line(P, 'Stage ahead of mirror', ro.outOfSync, ro.outOfSync ? P.warn : P.ink);
      h += line(P, 'Push queue', 'pending ' + (q.pending || 0) + ' · sent ' + (q.sent || 0) +
        ' · failed ' + (q.failed || 0), (q.failed ? P.bad : P.ink));
      h += line(P, 'Hidden (canceled)', ro.canceledHidden, P.inkMute);
    }

    var notes = [];
    if (ro) {
      notes.push('Order stages, push state and counts come from /api/fulfillment/board; ' +
        'fulfilment type, driver and region are joined from /api/state.');
      notes.push('The pickup board is COMPLETE — every pickup order is loaded, so each column ' +
        'count is the estate\'s own number, not a page size.');
      if (ro.delivery.shown < ro.delivery.total) {
        notes.push('The delivery tab is capped at ' + ro.delivery.shown + ' of ' +
          ro.delivery.total + ' open delivery orders, so ITS tab counter reads the cap. ' +
          'Append ?hworders=all for every row, or ?hworders=N for a different cap.');
      }
      if (ro.canceledHidden) {
        notes.push(ro.canceledHidden + ' canceled orders are not shown at all — the design\'s ' +
          'board has five columns and no Canceled one, and putting them in a live column ' +
          'would be worse than leaving them out.');
      }
      if (ro.guessed) {
        notes.push(ro.guessed + ' of ' + (ro.pickup.total + ro.delivery.total) + ' stages are ' +
          'GUESSED: an order nobody has advanced has no stage of its own, so it is reverse-mapped ' +
          'from the Weedmaps status — and IN_PROGRESS cannot tell "need to pack" from "packing". ' +
          'Those cards read "stage guessed" next to the clock; an advanced one is exact and unmarked.');
      }
      if (ro.channelGuessed) {
        notes.push(ro.channelGuessed + ' orders carry neither a fulfilment type nor a listing id. ' +
          'They are shown on the Delivery tab and say "channel guessed" on the card.');
      }
      notes.push('The "Weedmaps status" column is the CONTRACT — what our stage WOULD be pushed as — ' +
        'not evidence that it was. Each order\'s block leads with the real push state. Queue today: ' +
        'pending ' + ((ro.queue || {}).pending || 0) + ', sent ' + ((ro.queue || {}).sent || 0) +
        ', failed ' + ((ro.queue || {}).failed || 0) + '.');
      notes.push('READ THIS BEFORE TRUSTING A STATUS: the local mirror (orders.status) is rewritten ' +
        'by engine.push_status_tracked BEFORE it checks the HTTP code, so a REJECTED push still ' +
        'leaves a green-looking status behind. Only the push line is evidence. ' +
        (ro.pushFailed ? ro.pushFailed + ' loaded order(s) are in exactly that state.'
                       : 'No loaded order is in that state right now.'));
      if (ro.outOfSync) {
        notes.push(ro.outOfSync + ' order(s) have a stage whose mapped status the mirror has not ' +
          'caught up with — their block says so in brackets.');
      }
      if (ro.reviewOpen) {
        notes.push(ro.reviewOpen + ' of the loaded orders have an OPEN identity review in the API — ' +
          'it is listed in that order\'s signals.');
      }
      var oreg = Object.keys(ro.offRegion || {});
      if (oreg.length) {
        notes.push('Orders sit in ' + oreg.length + ' region(s) that are not in the live region ' +
          'list (' + oreg.join(', ') + '), so no Region chip on the dispatch view will ever ' +
          'select them. Their row still shows the real region.');
      }
      var up = Object.keys(ro.unplaceable || {});
      if (up.length) {
        notes.push('Weedmaps statuses the served contract cannot place, so those orders are ' +
          'excluded rather than parked: ' + up.join(', ') + '.');
      }
      notes.push('No risk model exists on this side: every Weedmaps block reads "unknown risk · ' +
        'score 0/100" rather than a made-up number, and every identity check reads missing.');
      notes.push('Order rows carry no line items or payment record: cards read "0 item" and ' +
        '"Pay Not in the API", and the detail sheet\'s line items, activity log, ' +
        '"Payment collected on handover" and ID-check link are the design\'s placeholders.');
      notes.push('Order <-> check-in binding stays mock — there is no live check-in list to match ' +
        'against, so every card shows the design\'s default "own account · signed in".');
      notes.push('Delivery addresses, distances, ETA windows and map coordinates exist nowhere in ' +
        'the API: the dispatch table shows "—", route distance reads 0.0 mi and every map pin ' +
        'stacks in the centre. Region and driver ARE live.');
    } else {
      notes.push('The fulfilment board did not answer — ORDERS, WM_ORDER and DELIVERY are still ' +
        'the built-in mock queue.');
    }
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
    h += advanceHTML(P);
    return h;
  }

  // ── stage control ────────────────────────────────────────────────────────
  // The Orders screen has NO stage-advance control — no button, no drag, no
  // menu item moves a card between columns (screen-orders.jsx renders the
  // board read-only; the only stage reference outside rendering is the
  // stageOrder lookup at :1558). Rather than invent one inside a screen this
  // seam is forbidden to edit, the control lives here, in the seam's own
  // panel, clearly labelled as not part of the design. Wiring a real button is
  // then a one-liner for the POS devs: HW_LIVE.orders.advance(id, stage).
  function advanceHTML(P) {
    if (!_ordersLive) { return ''; }
    var stages = (_statusMap && _statusMap.stages) || [];
    var ctl = 'height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink + ';font-size:' +
      P.type.meta + 'px;padding:0 8px;';
    var h = '<div style="margin-top:11px;padding-top:9px;border-top:1px solid ' + P.hairline + '">';
    h += '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:5px">Stage control</div>';
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45;margin-bottom:7px">' +
      'The Orders screen has no stage button to drive, so this one belongs to the seam, not to the design. ' +
      'It POSTs /api/order/stage, shows the validator&#39;s reason when a move is illegal, and re-reads the board.</div>';
    h += '<div style="display:flex;gap:6px;align-items:center">' +
      '<input data-hwl-id value="' + esc(_advId) + '" placeholder="order id" ' +
        'style="' + ctl + 'flex:1;min-width:0;font-family:' + ff(P.fontMono) + '">' +
      '<select data-hwl-stage style="' + ctl + 'font-family:' + P.fontSans + '">' +
        stages.map(function (s) {
          return '<option value="' + esc(s) + '"' + (s === _advStage ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('') +
      '</select>' +
      '<button data-hwl="advance" style="' + ctl + 'font-family:' + P.fontSans +
        ';font-weight:600;cursor:pointer;color:' + P.ink2 + '">Advance</button></div>';
    if (_advMsg) {
      h += '<div style="margin-top:7px;font-size:' + P.type.meta + 'px;line-height:1.45;font-family:' +
        ff(P.fontMono) + ';color:' + (_advOk ? P.ink2 : P.bad) + '">' + esc(_advMsg) + '</div>';
    }
    h += '</div>';
    return h;
  }

  function advanceFromPanel() {
    if (!_badge) { return; }
    var i = _badge.querySelector('[data-hwl-id]'), s = _badge.querySelector('[data-hwl-stage]');
    if (i) { _advId = i.value; }
    if (s) { _advStage = s.value; }
    advance(_advId, _advStage, 'pos-demo');
  }

  function paintBadge() {
    if (!armed) { return; }
    var P = palette();
    if (!P) { return; }   // no tokens on the page -> no badge, and no hex here

    if (!_badge) {
      _badge = document.createElement('div');
      _badge.id = 'hw-live-badge';
      document.body.appendChild(_badge);
      // A form control inside the panel must not close the panel it lives in,
      // so the toggle stops at anything interactive.
      var formish = function (el) {
        var t = el && el.tagName;
        return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'OPTION';
      };
      _badge.addEventListener('click', function (e) {
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-hwl');
        if (act === 'refresh') { e.stopPropagation(); W.HW_LIVE.refresh(); return; }
        if (act === 'advance') { e.stopPropagation(); advanceFromPanel(); return; }
        if (act === 'settoken') { e.stopPropagation(); setTokenFromPanel(); return; }
        if (act === 'cleartoken') { e.stopPropagation(); W.HW_LIVE.clearToken(); return; }
        if (formish(e.target)) { return; }
        _panelOpen = !_panelOpen;
        paintBadge();
      });
      // The pill advertises itself as a button (role + tabindex + the focus ring
      // tokens.jsx injects for [data-hw-i]). A control that takes focus and then
      // ignores Enter is worse than one that never took focus at all.
      _badge.addEventListener('keydown', function (e) {
        // Space is a character in the order-id box, not a toggle. Enter there
        // submits, which is what a one-field form is expected to do.
        if (formish(e.target)) {
          if (e.key === 'Enter' && e.target.hasAttribute('data-hwl-id')) {
            e.preventDefault(); advanceFromPanel();
          }
          if (e.key === 'Enter' && e.target.hasAttribute('data-hwl-token')) {
            e.preventDefault(); setTokenFromPanel();
          }
          return;
        }
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        var act = e.target && e.target.getAttribute && e.target.getAttribute('data-hwl');
        if (act === 'refresh') { W.HW_LIVE.refresh(); return; }
        if (act === 'advance') { advanceFromPanel(); return; }
        if (act === 'settoken') { setTokenFromPanel(); return; }
        if (act === 'cleartoken') { W.HW_LIVE.clearToken(); return; }
        _panelOpen = !_panelOpen;
        paintBadge();
      });
    }

    var live = _status === 'live';
    var dot = live ? P.good : _status === 'pending' ? P.warn : P.inkFaint;
    var label = live ? 'Live data' : _status === 'pending' ? 'Checking API…' : 'Mock data';
    var sub = live ? _report.products + ' SKUs · ' + _report.regions.length + ' regions' +
        (_report.orders ? ' · ' + _report.orders.shown + ' orders' : '') :
      _status === 'pending' ? base.replace(/^https?:\/\//, '') : 'API unavailable';
    // A user who never opens the panel still has to know the buttons will not
    // write. This is the whole diagnosis in one word, on the pill.
    if (live && (_writes === 'gated' || _writes === 'rejected')) { sub += ' \u00b7 read-only'; }

    // pointer-events:none on the wrapper so the empty gutter to the right of a
    // short pill does not swallow clicks meant for the screen underneath.
    dockSync();
    _badge.style.cssText = 'position:fixed;left:' + (RAIL_W + 12) + 'px;bottom:14px;z-index:' +
      (_panelOpen ? 2147482005 : 2147482000) + ';' +
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
      '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' + ff(P.fontMono) + '">' + esc(sub) + '</span></div>';
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
  function okJson(res) {
    if (!res.ok) { throw new Error('HTTP ' + res.status); }
    return res.json();
  }

  // Its own controller and its own budget: a slow board must cost the order
  // queue and nothing else. Failure is silent and leaves ORDERS on mock, which
  // stillMock() then reports.
  function loadBoard() {
    var ctl = W.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) { ctl.abort(); } }, BOARD_TIMEOUT_MS);
    var opt = { signal: ctl ? ctl.signal : undefined, credentials: 'omit', cache: 'no-store' };
    return Promise.all([
      fetch(base + '/api/fulfillment/board?limit=' + BOARD_LIMIT, opt).then(okJson),
      fetch(base + '/api/fulfillment/status-map', opt).then(okJson)
    ]).then(function (r) {
      clearTimeout(timer);
      if (!r[0] || !Array.isArray(r[0].stages) || !r[1] || !r[1].map) { return false; }
      _board = r[0];
      _statusMap = r[1];
      return true;
    }).catch(function () { clearTimeout(timer); return false; });
  }

  // POST /api/order/stage. A rejected transition comes back 400 carrying the
  // validator's own reason, and that reason is shown rather than swallowed — a
  // control that silently does nothing gets clicked four more times and then
  // reported as a data bug (wmdemo/server.py:346).
  function advance(orderId, stage, actor) {
    if (!armed) { return Promise.resolve({ ok: false, error: 'live seam is off' }); }
    var id = String(orderId || '').trim();
    if (!id) { _advMsg = 'Enter an order id.'; _advOk = false; paintBadge(); return Promise.resolve({ ok: false, error: 'no order id' }); }
    _advMsg = 'Advancing ' + id + ' → ' + stage + '…'; _advOk = true; paintBadge();
    // Through the shared helper: it attaches x-hw-write-token when one is
    // known, and hands back the server's OWN sentence rather than a status.
    return post('/api/order/stage',
      { wm_order_id: id, stage: String(stage), actor: actor || 'pos-demo' }
    ).then(function (r) {
      if (!r.ok) {
        _advOk = false;
        // r.error is the server's own text when there is one, and a plain
        // 'HTTP nnn' when there genuinely is not. Never 'no reason given' over
        // a body that had a reason in it.
        _advMsg = r.code ? ('Rejected ' + r.code + ': ' + r.error) : r.error;
        paintBadge();
        return { ok: false, error: r.error };
      }
      var view = r.body.order || null;
      if (view) { _stageOverride[String(view.order_id)] = view; }
      // The drain runs inline server-side, so its result is the honest answer
      // to "did Weedmaps hear about this?" — and today it is an HTTP 400 from
      // the Orders API. NOTE the shape: drain is an OBJECT with a `results`
      // list, not a list (wmdemo/fulfillment.py drain). Treating it as a list
      // threw, and the throw was caught and reported as "request failed" while
      // the transition had in fact been committed — a stage change that looked
      // like a network error is exactly the bug that gets clicked twice.
      var results = (r.body.drain && r.body.drain.results) || [];
      var pushed = null;
      for (var i = 0; i < results.length; i++) {
        if (String(results[i].order_id) === id) { pushed = results[i]; break; }
      }
      _advOk = true;
      _advMsg = id + ' → ' + (view ? view.stage : stage) +
        ' · queued ' + ((r.body.stage && r.body.stage.wm_status) || '?') +
        ' · ' + (pushed ? ('push ' + pushed.state + (pushed.error ? ': ' + pushed.error : ''))
                        : 'not drained in this call');
      _advId = id;
      return loadBoard().then(function () {
        if (_hw && _report) { applyOrders(); _report.stillMock = stillMock(); rerenderIfMounted(); }
        paintBadge();
        return { ok: true, order: view, push: pushed };
      });
    }).catch(function (e) {
      _advOk = false;
      _advMsg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paintBadge();
      return { ok: false, error: 'request failed' };
    });
  }

  function load() {
    _t0 = performance.now();
    var ctl = W.AbortController ? new AbortController() : null;
    // NOTE: deliberately does NOT abort. Aborting is what made a slow-but-fine
    // response indistinguishable from a dead server. settle() is safe to call
    // again with the real payload afterwards; it applies and re-renders.
    var timer = setTimeout(function () {
      if (!_settled) { settle(null, 'timeout'); }
    }, FETCH_TIMEOUT_MS);

    // Kicked in parallel, awaited alongside. If it lands after apply() has
    // already run, it re-applies just the orders and re-renders.
    var boardP = loadBoard().then(function (ok) {
      if (ok && _hw && _applied) {
        if (applyOrders()) {
          if (_report) { _report.stillMock = stillMock(); }
          rerenderIfMounted();
        }
      }
      if (_hw) { paintBadge(); }
      return ok;
    });

    var stateP = fetch(base + '/api/state', {
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

    // The API answered, so ask it the one question the badge cannot guess:
    // does it take writes from this page? One non-mutating POST, once.
    return Promise.all([stateP, boardP]).then(function (rs) {
      if (_payload) { probeWrites(); }
      return rs;
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
          // ALWAYS arm, even when /api/state has already settled. The BOARD is
          // a second, slower payload (it walks every order row), so a late
          // arrival is the normal case here, not the edge case: on a warm cache
          // the catalogue lands before the mount and the order queue lands
          // after it. Gating this on `!_settled` left the queue on the mock
          // orders while the badge cheerfully reported 255 live ones — the tab
          // counters read the design's 11/5 and nothing threw.
          armRenderCapture();
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
    // ONLY THIS FILE HOLDS A REACT ROOT. It wraps ReactDOM.createRoot first, so

    // every sibling seam's identical wrapper never sees the call, its _root stays

    // null and its rerender is a SILENT NO-OP. That is how the check-in strip

    // ended up holding live people in window.HW.CHECKINS while the screen kept

    // painting the four invented ones. Siblings re-render through here.

    rerender: rerenderIfMounted,
    // The shared write path. Every sibling seam routes its POSTs through this
    // one function so the token, the same-origin rule and the server's own
    // error text all live in exactly one place.
    post: post,
    get writes() { return _writes; },
    hasToken: function () { return !!_token; },
    // Takes the token, stores it, re-probes. Returns the new write state --
    // NEVER the token, and nothing derived from it.
    setToken: function (v) {
      v = String(v == null ? '' : v).trim();
      _token = v || null;
      storeToken(_token);
      _writes = 'unknown'; _tokenSent = false;
      paintBadge();
      return probeWrites();
    },
    clearToken: function () {
      _token = null;
      storeToken(null);
      _writes = 'unknown'; _tokenSent = false;
      paintBadge();
      return probeWrites();
    },
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _settled = false; _status = 'pending'; paintBadge();
      return load().then(function () { rerenderIfMounted(); return _status; });
    },
    // The order queue's own surface. `advance` is the whole stage control: a
    // POS dev wires a real button to it with one line and deletes nothing.
    orders: {
      advance: advance,
      get board() { return _board; },
      get statusMap() { return _statusMap; },
      get live() { return _ordersLive; },
      get cap() { return _deliveryCap; }
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
