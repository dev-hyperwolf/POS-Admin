// ── shared/hw-live-history.js ── what this customer has actually bought ──────
// Plain JS. Loads BEFORE React on the POS entry HTML, after hw-live.js and its
// siblings. Seventh seam, same four rules as the other six: armed everywhere
// but decided by whether the same origin answers, IN-PLACE mutation of
// window.HW (never a reassignment), silent fallback when nothing answers, and
// the panel says out loud what is still mock.
//
// WHAT IT IS
// ----------
// pos/data.jsx models an order as O_(num, name, total, source, channel, pay,
// badge, age, items, stage, strainHue). `items` is an INTEGER — `items: 3`. An
// order therefore records a customer's NAME and a COUNT, and nothing about
// what was in the bag. There is no per-customer purchase history anywhere in
// the POS, so a "Suggested" button on the register has nothing genuine to rank
// on and would have to invent its input.
//
// wmdemo/purchase_history.py + GET /api/customer/purchase-history are the real
// thing behind it: every line item this person has actually bought, read out of
// the retained Weedmaps webhook payloads, ACROSS EVERY WEEDMAPS ACCOUNT BOUND
// TO THEM. Nothing reads it until this file.
//
// THE ONE FALSEHOOD THIS FILE EXISTS TO NOT COMMIT
// ------------------------------------------------
// An empty product list looks the same no matter which of three completely
// different facts produced it, and the default rendering is the one that looks
// like an answer:
//
//   history        we know what they bought           -> rank on it
//   no_purchases   we know them, they bought nothing  -> first-timer offer
//   unknown        we have NO line data for them      -> do not rank; go look
//
// A first-time visitor and a customer whose order lines we simply never
// captured are not the same person to an operator deciding what to suggest.
// So the three states are not three shades of the same panel here: `unknown`
// is drawn in bad tone with an explicit DO NOT RANK banner and NO product
// area at all, `no_purchases` is drawn in neutral tone and says which of the
// three no-purchase reasons applies, and only `history` gets a product table.
// The route's own `state_reason` sentence is printed verbatim in every case —
// this file writes no sentence of its own about what the data means.
//
// AND THE SECOND: A DEFAULT RANKING MUST NOT LOOK LIKE A PERSONAL ONE
// -------------------------------------------------------------------
// `ranking_input.basis_sentence` is rendered verbatim, always, and
// `basis_is_default` decides its tone. A suggestion built from this customer's
// own repeat purchases and a suggestion built from the house-brand fallback
// are different claims about a stranger, and rendering them identically is how
// the fallback quietly becomes "personalised".
//
// A 409 IS AN ANSWER, NOT AN ERROR
// ---------------------------------
// The route follows the /api/inventory/* refusal idiom: a question with no
// single answer comes back 409 with a machine `code` and a sentence written
// for a person. The most important one is `wm_id_on_multiple_identities` —
// one Weedmaps customer id in the demo database sits on FOUR live people and
// carries 6,966 orders, and answering with one of them would hand a stranger's
// entire purchase history to an operator deciding what to suggest. So this
// file reads the BODY of a 409 and renders the refusal. A seam that treated it
// as "HTTP 409" would turn a careful refusal into an outage.
//
// WHAT IT DELIBERATELY DOES NOT DO
// --------------------------------
//  * IT DOES NOT RANK. `ranking_input` is published untouched for whoever
//    builds the Suggested button. Two implementations of a ranking is how the
//    button and the panel start disagreeing about the same customer.
//  * It does not edit pos/screen-register.jsx or pos/data.jsx. Those belong to
//    another unit and are being edited right now. The migration is one call —
//    `window.HW.purchaseHistory({ identity_id: n })` — published below.
//  * It does not carry its own copy of dock(). The other six seams each carry
//    a verbatim duplicate and hw-live-lines.js's own header says that is the
//    shape that bites: an edit lands in five of six and the sixth silently
//    keeps the old behaviour. shared/hw-seam-dock.js is the real
//    implementation; this file uses it and degrades to no badge without it,
//    rather than being a seventh copy to keep in sync.
//  * It computes NO number. Every count, share and sentence came off the route.
//
// PUBLIC SURFACE: window.HW_HISTORY = { status, route, base, get(key),
//   fetch(key), cached, errors, refresh(), open(), close(), disable(),
//   enable() } and, on window.HW (mutated in place, never reassigned):
//   HW.PURCHASE_HISTORY      — { cacheKey: <the route's payload, plus the four
//                              compatibility fields decorate() adds: skus,
//                              orders, source, skus_unresolved — see decorate()> }
//   HW.purchaseHistory(key)  — synchronous accessor; starts the fetch if cold
//                              and re-renders when it lands. THE MIGRATION HOOK.
//                              `key` is { identity_id } | { pos_customer_id } |
//                              { wm_customer_id } — exactly one, same as the
//                              route, which refuses two.
// Turn it off: append `?hwhistory=off`, or run `HW_HISTORY.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_HISTORY && W.HW_HISTORY.__armed) { return; }      // idempotent

  var ROUTE = '/api/customer/purchase-history';
  var OFF_KEY = 'hw-history-off';
  var SEAM_ID = 'history';
  var TIMEOUT_MS = 6000;
  var CACHE_CAP = 100;
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // The three states, and the ONE place their treatment is decided. A state
  // this file has never heard of falls to 'unknown' rather than to the
  // friendliest branch — a new server state must not debut as good news.
  var STATE_TONE = { history: 'good', no_purchases: 'neutral', unknown: 'bad' };

  function ff(v) { return String(v).replace(/"/g, "'"); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(W.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function isLoopbackOrigin(o) {
    try {
      var u = new URL(o);
      return (u.protocol === 'http:' || u.protocol === 'https:')
        && LOOPBACK.test(u.hostname);
    } catch (e) { return false; }
  }

  var override = qs('hwhistory');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback — same rule as
  // hw-live-lines.js, and for a sharper reason here: a crafted ?hwhistory=<host>
  // link would render an arbitrary server's answer as THIS customer's purchase
  // history, beside their real name.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }
  var armed = !disabled;

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';  // off|pending|slow|live|unreachable
  var _routeReason = null;
  var _hist = {};       // cacheKey -> the route's payload, verbatim
  var _err = {};        // cacheKey -> { kind, code, message } — why THIS one failed
  var _inflight = {};
  var _order = [];
  var _subs = [];
  var _hw = null, _hwTries = 0;
  var _el = null, _panel = null, _open = false, _scroll = 0;
  var _lastKey = null, _probeDone = false;

  function notify() {
    for (var i = 0; i < _subs.length; i++) { try { _subs[i](); } catch (e) {} }
  }

  function rerender() {
    if (W.HW_LIVE && typeof W.HW_LIVE.rerender === 'function') {
      try { W.HW_LIVE.rerender(); } catch (e) {}
    }
  }

  function palette() {
    // pos/tokens.jsx is the ONLY place colours are defined. No THEMES on the
    // page means no panel at all, rather than a hex literal here.
    if (!W.THEMES) { return null; }
    var mode = document.body ? document.body.style.colorScheme : '';
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  function when(ts) {
    var n = Number(ts);
    if (!isFinite(n) || !n) { return null; }
    try { return new Date(n * 1000).toLocaleDateString(); } catch (e) { return null; }
  }

  // ── the key ──────────────────────────────────────────────────────────────
  // EXACTLY ONE, because the route refuses two — two keys can name two
  // different people and it will not pick. Normalising here means the cache
  // key and the query string are built from the same object and cannot drift.
  // A MOCK MEMBER ROW IS NOT A CUSTOMER KEY, and `id` is deliberately not in
  // this list. pos/data.jsx MEMBERS is five invented people with invented ids;
  // hw_identities ids are real people. Accepting `customer.id` here would take
  // an invented member row and hand back a REAL stranger's purchase history to
  // rank on, which is worse than returning nothing. A caller with a mock member
  // gets state:'no_key' and no fetch at all.
  var KEYS = ['identity_id', 'pos_customer_id', 'wm_customer_id'];

  function normalize(key) {
    if (key == null) { return null; }
    if (typeof key === 'number') { return { identity_id: String(key) }; }
    if (typeof key === 'string') {
      var s = key.trim();
      if (!s) { return null; }
      if (/^\d+$/.test(s)) { return { identity_id: s }; }
      if (/^POS-C-/i.test(s)) { return { pos_customer_id: s }; }
      return { wm_customer_id: s };
    }
    var out = null;
    for (var i = 0; i < KEYS.length; i++) {
      var v = key[KEYS[i]];
      if (v == null || v === '') { continue; }
      if (out) { return { __conflict: true, keys: [out.__name, KEYS[i]] }; }
      out = {}; out[KEYS[i]] = String(v); out.__name = KEYS[i];
    }
    if (!out) { return null; }
    var clean = {}; clean[out.__name] = out[out.__name];
    return clean;
  }

  function cacheKey(k) {
    for (var i = 0; i < KEYS.length; i++) {
      if (k[KEYS[i]] != null) { return KEYS[i] + '=' + k[KEYS[i]]; }
    }
    return '';
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // A 409 IS READ, NOT THROWN. The route's refusals carry a machine `code` and
  // a sentence for a person; `res.ok` is false for both a refusal and a real
  // outage, and collapsing them would turn "this Weedmaps account is bound to
  // four different people" into "HTTP 409" on an operator's screen.
  function getJSON(path) {
    return fetch(base + path, { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (res.status === 409) {
          return res.json().then(function (body) {
            return { refused: true, body: body || {} };
          }, function () {
            return { refused: true, body: { error: 'the route refused this '
              + 'request and the reason was not readable JSON',
              code: 'unreadable_refusal' } };
          });
        }
        if (!res.ok) {
          var e = new Error('HTTP ' + res.status);
          e.code = res.status;
          throw e;
        }
        return res.json().then(function (b) { return { refused: false, body: b }; });
      });
  }

  function probe() {
    if (!armed) { return Promise.resolve('off'); }
    var slow = setTimeout(function () {
      if (_status === 'pending') { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);
    // identity_id=0 is a deliberately impossible id: the route answers 409
    // `identity_not_found` for it, which PROVES the route is wired without
    // reading anybody's history. A 404 means no wmdemo API beside this page.
    return getJSON(ROUTE + '?identity_id=0').then(function (r) {
      clearTimeout(slow);
      _probeDone = true;
      _status = 'live';
      _routeReason = null;
      paint(); notify();
      return 'live';
    }).catch(function (e) {
      clearTimeout(slow);
      _probeDone = true;
      _status = 'unreachable';
      _routeReason = (e && e.code === 404)
        ? 'GET ' + ROUTE + ' answered 404. Either this page is served without '
          + 'a wmdemo API beside it (GitHub Pages is static), or the route is '
          + 'not wired on the server that answered.'
        : 'GET ' + ROUTE + ' did not answer (' + (e && e.message) + ').';
      paint(); notify();
      return 'unreachable';
    });
  }

  function fetchHistory(key, force) {
    var k = normalize(key);
    if (!k) {
      return Promise.resolve(null);
    }
    if (k.__conflict) { return Promise.resolve(null); }
    var ck = cacheKey(k);
    _lastKey = ck;
    if (!force && (_hist[ck] || _err[ck])) { return Promise.resolve(_hist[ck] || null); }
    if (_inflight[ck]) { return Promise.resolve(_hist[ck] || null); }
    _inflight[ck] = true;
    var q = ck + '&limit=40';
    return getJSON(ROUTE + '?' + q).then(function (r) {
      delete _inflight[ck];
      if (r.refused) {
        // A REFUSAL IS CACHED AS A REFUSAL, never as an empty history. The
        // distinction is the whole point of the module behind this route.
        _err[ck] = { kind: 'refused', code: r.body.code || 'refused',
                     message: r.body.error || 'the route refused this request',
                     extra: r.body };
        delete _hist[ck];
      } else {
        _hist[ck] = decorate(r.body);
        delete _err[ck];
        if (_order.indexOf(ck) < 0) { _order.push(ck); }
        while (_order.length > CACHE_CAP) { delete _hist[_order.shift()]; }
      }
      paint(); notify(); rerender();
      return _hist[ck] || null;
    }).catch(function (e) {
      delete _inflight[ck];
      _err[ck] = { kind: 'error', code: e && e.code,
                   message: 'could not read this customer\'s purchase history ('
                     + (e && e.message) + '). This is NOT "they have bought '
                     + 'nothing" — nothing was read at all.' };
      paint(); notify(); rerender();
      return null;
    });
  }

  // ── the consumer's contract, satisfied additively ────────────────────────
  // pos/screen-cart.jsx (window.HWSuggestBasis) was written against a seam that
  // did not exist yet and specified its shape precisely:
  //
  //     window.HW.purchaseHistory(customer) ->
  //         { skus: [...], orders: n, source: '<what produced this>' }
  //
  // Its readHistory() refuses a list that cannot say where it came from, and
  // refuses an empty one. That guard is right and is left alone. Without these
  // three fields the route's payload simply never lights that branch, so the
  // Suggested chip would fall back to the house-brand default forever with the
  // real history sitting one property away — two agents, two shapes for one
  // fact, which is the collision hw-live-lines.js's header warns about.
  //
  // THESE ARE ADDED, NEVER SUBSTITUTED. The route's own payload is untouched
  // beside them, `source` names the route rather than this file, and the
  // THREE-WAY DISTINCTION SURVIVES INTO THE FIELD THEY READ:
  //
  //     history       skus: [ ... ]   we know what they bought
  //     no_purchases  skus: []        the source ran; they have bought nothing
  //     unknown       skus: null      the source could not tell us at all
  //
  // `[]` and `null` both fall back in their guard, which is correct — but they
  // are not the same fact and this file will not write one where the other is
  // true. RESOLVED SKUS ONLY: a line we never matched to a catalogue product
  // has no sku to rank on, and `skus_unresolved` says how many were left out
  // rather than letting the list quietly shrink.
  function decorate(body) {
    if (!body || typeof body !== 'object') { return body; }
    var c = body.counts || {};
    // KEYED ON `sku` ALONE, and that is deliberate. purchase_history.py only
    // ever sets `sku` on a line it resolved, so the sku IS the resolution — and
    // it is the only thing a ranking can actually use. Requiring `resolved` as
    // well adds a second way for this list to come back EMPTY (a payload that
    // stopped carrying the flag) with no symptom other than a customer's
    // history quietly disappearing.
    var resolved = (body.items || []).filter(function (i) { return i.sku; });
    if (body.state === 'history') {
      body.skus = resolved.map(function (i) { return i.sku; });
    } else if (body.state === 'no_purchases') {
      body.skus = [];
    } else {
      body.skus = null;
    }
    body.orders = typeof c.purchase_orders === 'number' ? c.purchase_orders : null;
    body.source = ROUTE + ' — ' + (body.state_reason || body.state || '');
    body.skus_unresolved = (body.items || []).length - resolved.length;
    body.skus_note = body.skus_unresolved
      ? body.skus_unresolved + ' of this customer\'s products were never '
        + 'resolved to a catalogue sku and are NOT in `skus`. They are in '
        + '`items` with the reason on each.'
      : null;
    return body;
  }

  // THE MIGRATION HOOK. Synchronous, safe to call on a render path, and never
  // returns a shape that reads as an answer when it is not one. A cold key
  // starts the fetch and comes back state:'loading'; a disarmed seam comes back
  // state:'off'. Neither is 'no_purchases'.
  function accessor(key) {
    var k = normalize(key);
    if (!k) {
      return { state: 'no_key', state_reason: 'no customer key was given, so '
        + 'there is nobody to read a history for' };
    }
    if (k.__conflict) {
      return { state: 'no_key', state_code: 'conflicting_customer_keys',
        state_reason: 'two customer keys were given (' + k.keys.join(', ')
          + ') and they can name two different people' };
    }
    var ck = cacheKey(k);
    if (!armed) {
      return { state: 'off', state_reason: 'the purchase-history seam is '
        + 'switched off (HW_HISTORY.enable() to turn it back on). Nothing was '
        + 'read, which is not the same as nothing having been bought.' };
    }
    if (_hist[ck]) { return _hist[ck]; }
    if (_err[ck]) {
      return { state: 'unavailable', state_code: _err[ck].code,
               state_reason: _err[ck].message, refusal: _err[ck].extra || null };
    }
    fetchHistory(k, false);
    return { state: 'loading', state_reason: 'reading this customer\'s '
      + 'purchase history' };
  }

  function waitForHW() {
    if (W.HW && typeof W.HW === 'object') {
      _hw = W.HW;
      // IN-PLACE mutation, never a reassignment — hw-live.js's rule. A
      // reassignment drops every other seam's contribution on the floor.
      try {
        _hw.PURCHASE_HISTORY = _hist;
        _hw.purchaseHistory = accessor;
      } catch (e) {}
      return;
    }
    if (_hwTries++ > 200) { return; }
    setTimeout(waitForHW, 50);
  }

  // ── the panel ────────────────────────────────────────────────────────────
  function dock() {
    // NO SEVENTH COPY. shared/hw-seam-dock.js is the implementation; if it did
    // not load, this seam draws no badge and its accessor still works. A
    // duplicated dock is what hw-live-lines.js's own header warns about.
    return W.HW_SEAM_DOCK || null;
  }

  function toneOf(P, tone) {
    if (tone === 'good') { return [P.good, P.goodSoft || P.surface2]; }
    if (tone === 'bad') { return [P.bad, P.badSoft || P.surface2]; }
    if (tone === 'warn') { return [P.warn, P.warnSoft || P.surface2]; }
    return [P.neutral || P.inkFaint, P.neutralSoft || P.surface2];
  }

  function stateBlockHTML(P, d) {
    var tone = STATE_TONE[d.state] || 'bad';   // an unheard-of state is not good news
    var c = toneOf(P, tone);
    var label = d.state === 'history'
      ? ('HISTORY — ' + (d.counts ? d.counts.purchase_orders : '?') + ' order(s)')
      : d.state === 'no_purchases' ? 'NO PURCHASES YET' : 'UNKNOWN';
    var h = '<div style="border:1px solid ' + c[0] + ';background:' + c[1]
      + ';border-radius:8px;padding:8px 10px;margin-bottom:8px">'
      + '<div style="font-weight:700;font-size:' + P.type.meta + 'px;color:'
      + c[0] + ';letter-spacing:.04em">' + esc(label) + ''
      + '<span style="opacity:.75;font-weight:500"> · ' + esc(d.state_code || '')
      + '</span></div>'
      + '<div style="margin-top:4px;font-size:' + P.type.meta
      + 'px;line-height:1.55;color:' + P.ink + '">' + esc(d.state_reason || '')
      + '</div>';
    if (d.state === 'unknown') {
      // The banner that stops the whole defect: an operator must not rank on
      // this, and "no products shown" would otherwise read as "bought nothing".
      h += '<div style="margin-top:6px;font-weight:700;font-size:'
        + P.type.meta + 'px;color:' + P.bad + '">DO NOT RANK ON THIS. We have '
        + 'no record of what this customer bought — that is different from '
        + 'them having bought nothing.</div>';
    }
    return h + '</div>';
  }

  function basisHTML(P, d) {
    var ri = d.ranking_input;
    if (!ri) { return ''; }
    var c = toneOf(P, ri.basis_is_default ? 'warn' : 'good');
    return '<div style="border:1px dashed ' + c[0] + ';background:' + c[1]
      + ';border-radius:8px;padding:8px 10px;margin-bottom:8px">'
      + '<div style="font-size:' + P.type.meta + 'px;font-weight:700;color:'
      + c[0] + '">SUGGESTION BASIS · ' + esc(ri.basis)
      + (ri.basis_is_default ? ' · DEFAULT, NOT PERSONALISED' : '') + '</div>'
      // VERBATIM. This file writes no sentence of its own about the basis.
      + '<div style="margin-top:4px;font-size:' + P.type.meta
      + 'px;line-height:1.55;color:' + P.ink + '">'
      + esc(ri.basis_sentence || '') + '</div></div>';
  }

  function subjectHTML(P, d) {
    var s = d.subject || {};
    var h = '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkFaint
      + ';line-height:1.6;margin-bottom:8px">'
      + '<b style="color:' + P.ink + '">' + esc(s.name || s.asked_for || '—')
      + '</b>' + (s.pos_customer_id ? ' · ' + esc(s.pos_customer_id) : '')
      + '<br>' + (s.accounts || []).length + ' bound Weedmaps account(s): '
      + esc((s.accounts || []).join(', ') || 'none')
      + '<br><span style="opacity:.85">' + esc(s.scope_note || '') + '</span>';
    if (s.merge_note) {
      h += '<br><span style="color:' + P.warn + '">' + esc(s.merge_note) + '</span>';
    }
    if (s.ingest_log_note) {
      // The suspected-extra-account note. Shown because a silently dropped
      // account and a silently included one are both wrong.
      h += '<br><span style="color:' + P.warn + '">' + esc(s.ingest_log_note)
        + '</span>';
    }
    return h + '</div>';
  }

  function itemsHTML(P, d) {
    if (d.state !== 'history') { return ''; }
    var rows = (d.items || []).map(function (i) {
      var brand = i.brand_known
        ? esc(i.brand)
        // A MISSING BRAND IS NOT A BRAND. It is never printed as a name, and
        // it is never blank either — a blank cell reads as "we didn't bother".
        : '<span style="color:' + P.warn + '" title="' + esc(i.brand_reason || '')
          + '">unbranded</span>';
      var cat = i.category_known
        ? esc(i.category)
        : '<span style="color:' + P.warn + '">no category</span>';
      return '<tr><td style="padding:3px 6px 3px 0">' + esc(i.name || i.key)
        + (i.resolved ? '' : '<div style="color:' + P.bad + ';font-size:'
            + (P.type.meta - 1) + 'px">' + esc(i.unresolved_reason || '') + '</div>')
        + '</td><td style="padding:3px 6px">' + brand
        + '</td><td style="padding:3px 6px">' + cat
        + '</td><td style="padding:3px 6px;text-align:right">' + i.orders
        + '</td><td style="padding:3px 6px;text-align:right">' + i.units
        + '</td><td style="padding:3px 0 3px 6px;color:' + P.inkFaint + '">'
        + esc(when(i.last_bought_at) || '—') + '</td></tr>';
    }).join('');
    var c = d.counts || {};
    var foot = '<div style="margin-top:6px;font-size:' + (P.type.meta - 1)
      + 'px;color:' + P.inkFaint + ';line-height:1.6">'
      + c.purchase_orders + ' purchase order(s) · ' + c.cancelled_orders
      + ' cancelled (excluded) · ' + c.draft_only_carts
      + ' cart(s) price-checked and never ordered'
      + (c.orders_without_lines ? ' · ' + c.orders_without_lines
          + ' order(s) with no readable lines — this history is PARTIAL' : '')
      + (c.products_without_brand ? '<br><span style="color:' + P.warn + '">'
          + c.products_without_brand + ' of ' + c.products + ' product(s) have '
          + 'no brand on record and are excluded from brand affinity — not '
          + 'dropped silently</span>' : '')
      + '</div>';
    return '<table style="width:100%;border-collapse:collapse;font-size:'
      + P.type.meta + 'px;color:' + P.ink + '">'
      + '<thead><tr style="color:' + P.inkFaint + ';text-align:left">'
      + '<th style="padding:0 6px 4px 0;font-weight:600">product</th>'
      + '<th style="padding:0 6px 4px;font-weight:600">brand</th>'
      + '<th style="padding:0 6px 4px;font-weight:600">category</th>'
      + '<th style="padding:0 6px 4px;font-weight:600;text-align:right">ord</th>'
      + '<th style="padding:0 6px 4px;font-weight:600;text-align:right">qty</th>'
      + '<th style="padding:0 0 4px 6px;font-weight:600">last</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>' + foot;
  }

  function refusalHTML(P, e) {
    var c = toneOf(P, 'bad');
    return '<div style="border:1px solid ' + c[0] + ';background:' + c[1]
      + ';border-radius:8px;padding:8px 10px">'
      + '<div style="font-weight:700;font-size:' + P.type.meta + 'px;color:'
      + c[0] + '">' + (e.kind === 'refused' ? 'REFUSED · ' : 'NOT READ · ')
      + esc(e.code || '') + '</div>'
      + '<div style="margin-top:4px;font-size:' + P.type.meta
      + 'px;line-height:1.55;color:' + P.ink + '">' + esc(e.message) + '</div>'
      + '<div style="margin-top:6px;font-size:' + (P.type.meta - 1)
      + 'px;color:' + P.bad + '">A refusal is not an empty history. Nothing '
      + 'here says this customer has bought nothing.</div></div>';
  }

  function panelHTML(P) {
    var head = '<div style="font-family:' + ff(P.fontMono) + ';font-size:'
      + (P.type.meta - 1) + 'px;color:' + P.inkFaint + ';margin-bottom:8px">'
      + esc(ROUTE) + ' · ' + esc(_status)
      + (_routeReason ? '<div style="color:' + P.bad + ';margin-top:4px">'
          + esc(_routeReason) + '</div>' : '') + '</div>';
    if (!_lastKey) {
      return head + '<div style="font-size:' + P.type.meta + 'px;color:'
        + P.inkFaint + ';line-height:1.6">No customer has been looked up yet. '
        + 'A screen asks for one with <code>window.HW.purchaseHistory({ '
        + 'identity_id: n })</code>. Nothing is shown here until something '
        + 'does — an empty panel is not a customer with no purchases.</div>';
    }
    if (_err[_lastKey]) { return head + refusalHTML(P, _err[_lastKey]); }
    var d = _hist[_lastKey];
    if (!d) {
      return head + '<div style="font-size:' + P.type.meta + 'px;color:'
        + P.inkFaint + '">reading ' + esc(_lastKey) + '…</div>';
    }
    return head + subjectHTML(P, d) + stateBlockHTML(P, d) + basisHTML(P, d)
      + itemsHTML(P, d);
  }

  function paint() {
    var P = palette();
    var D = dock();
    if (!P || !D) { return; }
    var DOT = { off: P.inkFaint, pending: P.inkFaint, slow: P.warn,
                live: P.good, unreachable: P.bad };
    var label = 'purchase history';
    if (_lastKey && _hist[_lastKey]) { label += ' · ' + _hist[_lastKey].state; }
    else if (_lastKey && _err[_lastKey]) { label += ' · ' + _err[_lastKey].code; }
    try {
      D.register(SEAM_ID, function () { _open = false; paint(); });
      D.report(SEAM_ID, DOT[_status] || P.inkFaint, _status, label);
    } catch (e) {}
    if (!_open) {
      if (_panel && _panel.parentNode) { _panel.parentNode.removeChild(_panel); }
      _panel = null;
      return;
    }
    var slot = D.slot ? D.slot() : null;
    if (!slot) { return; }
    if (!_panel) {
      _panel = document.createElement('div');
      _panel.setAttribute('data-hw-chrome', 'seam-history');
      slot.appendChild(_panel);
    }
    _panel.style.cssText = 'pointer-events:auto;max-height:60vh;overflow:auto;'
      + 'width:min(680px,calc(100vw - 120px));background:' + P.surface
      + ';border:1px solid ' + P.hairline + ';border-radius:12px;padding:12px 14px;'
      + 'box-shadow:0 8px 28px rgba(0,0,0,.22)';
    _panel.innerHTML = panelHTML(P);
    _panel.scrollTop = _scroll;
    _panel.onscroll = function () { _scroll = _panel.scrollTop; };
  }

  function watchTheme() {
    try {
      var mo = new MutationObserver(function () { paint(); });
      if (document.body) {
        mo.observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    } catch (e) {}
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_HISTORY = {
    __armed: armed,
    get status() { return _status; },
    get route() { return ROUTE; },
    get base() { return base; },
    get reason() { return _routeReason; },
    get cached() { return _hist; },
    get errors() { return _err; },
    get: function (key) { return accessor(key); },
    fetch: function (key) { return fetchHistory(key, true); },
    subscribe: function (fn) { _subs.push(fn); },
    refresh: function () {
      _hist = {}; _err = {}; _order = [];
      _status = 'pending'; _probeDone = false;
      if (_hw) { try { _hw.PURCHASE_HISTORY = _hist; } catch (e) {} }
      paint(); notify();
      return probe().then(function (s) {
        if (_lastKey) {
          var parts = _lastKey.split('='); var k = {};
          k[parts[0]] = parts.slice(1).join('=');
          return fetchHistory(k, true).then(function () { return s; });
        }
        return s;
      });
    },
    open: function () {
      var D = dock();
      if (D) { try { D.opened(SEAM_ID); } catch (e) {} }
      _open = true; paint();
    },
    close: function () { _open = false; paint(); },
    disable: function () {
      try { W.localStorage.setItem(OFF_KEY, '1'); } catch (e) {}
      W.location.reload();
    },
    enable: function () {
      try { W.localStorage.removeItem(OFF_KEY); } catch (e) {}
      W.location.reload();
    }
  };

  // waitForHW runs EVEN WHEN DISARMED, for the same reason hw-live-lines.js
  // does it: once a screen calls window.HW.purchaseHistory() on its render
  // path, a kill switch that makes that path throw is not a kill switch. Off,
  // the accessor is still there and answers state:'off' with the reason.
  waitForHW();

  if (armed) {
    if (document.body) { paint(); watchTheme(); }
    else {
      document.addEventListener('DOMContentLoaded', function () {
        paint(); watchTheme();
      });
    }
    probe();
  }
})();
