// ── shared/hw-live-lines.js ── the real line items of a real order ──────────
// Plain JS. Loads BEFORE React on the POS entry HTML, after hw-live.js and its
// three siblings. Fourth seam, built to the same four rules: armed everywhere
// but decided by whether the same origin answers, IN-PLACE mutation of
// window.HW (never a reassignment), silent fallback to the mock when nothing
// answers, and the panel says out loud what is still mock.
//
// WHAT IT REPLACES, AND WHY THAT IS THE WHOLE POINT
// -------------------------------------------------
// pos/screen-orders.jsx:1486 builds the order detail sheet's product table from
// a hardcoded literal:
//
//   const baseItems = [
//     { name: 'Cake Crasher',        brand: …jeeter, cat: 'Flower',    qty: 4, price: 15 },
//     { name: 'Blueberry Pancakes',  brand: …lowell, cat: 'Pre-Rolls', qty: 1, price: 17 },
//     { name: 'Doubleshot Edible',   brand: …wyld,   cat: 'Edibles',   qty: 2, price: 20 }
//   ].slice(0, Math.max(1, Math.min(3, o.items || 1)));
//
// Three invented products, sliced to the order's item COUNT. Every other number
// in that sheet — the item subtotal, the proportional discount allocation, the
// CA excise/sales/local tax lines, the grand total, the cash tendered, the
// change, the packing checklist, the return/exchange picker — is derived from
// those three literals. So on a live board showing 3,630 real Weedmaps orders,
// the sheet renders a fake cart and then does honest arithmetic on it.
//
// wmdemo/order_lines.py is the real thing behind it. It reads the retained
// Weedmaps webhook payload (`wm_order_events.raw_payload`, NOT NULL, the
// authoritative copy) and joins each line to the product we resolved it to and
// to the FIFO batch allocation commit actually took off the shelf. Nothing read
// it until this file.
//
// ⚠️ THE ROUTE IS NOT WIRED YET — AND THIS FILE SAYS SO ON SCREEN
// ---------------------------------------------------------------
// As of 2026-08-19 `grep -n order_lines wmdemo/server.py` returns NOTHING. The
// module exists and works; no route serves it. GET /api/order/lines therefore
// 404s today, and this seam renders that 404 as a NAMED REASON — "the module
// exists, no route serves it" — never as an empty table and never as a fallback
// to the mock rows dressed up as live. server.py is another unit's file; the
// six-line snippet that wires it is in the handover note that ships with this
// change, not applied here.
//
// THE FALSEHOODS THIS FILE EXISTS TO NOT COMMIT
// ---------------------------------------------
//  1. A DROPPED UNRESOLVED LINE. engine.ingest_order drops a line it cannot
//     resolve with `continue` (engine.py:1577). order_lines.py returns it
//     anyway with `resolved:false` and a reason. This panel renders that line
//     IN PLACE, in bad-tone, at its real index — the line Weedmaps billed the
//     customer for that we have no product for is the single most important row
//     on a picking sheet, and dropping it is how it stays invisible.
//     NOT EXERCISED ON REAL DATA: all 3,630 orders on this board resolve every
//     line. The branch was proven against a synthetic payload in a COPY of the
//     database, never against the shared one. Said plainly rather than claimed.
//  2. AN EMPTY TABLE FOR AN ORDER WHOSE PAYLOAD WAS NEVER RETAINED. 7 of the
//     orders on this board have no `orders` row and no webhook event at all,
//     and 263 have a payload with an empty lineItems list. Those are different
//     facts with different fixes, order_lines.py tells them apart in `reason` /
//     `lines_reason`, and this panel prints the sentence instead of a blank.
//  3. $0.00 FOR A PRICE WE DO NOT HAVE. order_lines.py refuses to fall back to
//     `salePrice` (Weedmaps sends "0.00" on a line that is not on sale). When
//     `unit_price` is null this panel prints `unit_price_reason`, not a zero.
//  4. A BATCH-LEVEL POTENCY THAT IS NOT SERVED. `order_line_batches`
//     (catalog.py:103) carries region/sku/batch_id/qty/committed_at and NO
//     thc_pct — the potency lives on `batches` and this route does not join it.
//     So a committed line shows the batch ID that went out and says the batch's
//     own THC is not carried on this route. The product-level `thc` is drawn as
//     the CATALOGUE figure, labelled as such, never as "what is in this bag".
//  5. A LINE SUM PRINTED AS THE ORDER TOTAL. `lines_subtotal` and `grand_total`
//     are not expected to agree — grandTotal carries fees, taxes and cart-level
//     discounts that ride on no line. Both are shown, with the route's own
//     sentence explaining the gap, and neither is presented as the other.
//  6. A DRAFT SOLD AS THE PAID ORDER. 6,047 orders in this database have only a
//     `draft` event — the pre-order price check, i.e. the customer's cart
//     BEFORE we accepted it. order_lines.py prefers `pending` and reports which
//     it read; this panel puts that on the header in warn tone when it is a
//     draft, because a draft is a weaker answer than a pending.
//
// WHAT IT DELIBERATELY DOES NOT DO
// --------------------------------
//  * It does not edit pos/screen-orders.jsx and it does not remove `baseItems`.
//    That file belongs to the POS unit. So the invented table is STILL THERE,
//    below this panel, and this panel says so in red with the file:line — an
//    unlabelled second table would be the same falsehood with better manners.
//    The one-line migration that deletes it is `window.HW.orderLines(o.id)`,
//    published below and documented in the handover note.
//  * It does not compute a price, a tax, a discount or a total. Every number
//    here came out of order_lines.py. There is no second arithmetic.
//  * It holds NO React root. hw-live.js wrapped ReactDOM.createRoot before us,
//    so our own wrapper would never see the call, `_root` would stay null and
//    the re-render would be a SILENT NO-OP. Re-renders go through
//    window.HW_LIVE.rerender().
//
// BADGE OFFSET: bottom 198. Taxonomy 90, identity 126, check-in 162, this 198 —
// stacked, not stacked ON. Verified clickable with document.elementFromPoint.
//
// PUBLIC SURFACE: window.HW_LINES = { status, route, base, get(id), fetch(id),
//   cached, errors, refresh(), open(), disable(), enable() }
// and, on window.HW (mutated in place, never reassigned):
//   HW.ORDER_LINES        — { wm_order_id: <the route's payload, verbatim> }
//   HW.orderLines(id)     — synchronous accessor; starts the fetch if cold and
//                           re-renders when it lands. THE MIGRATION HOOK.
// Turn it off: append `?hwlines=off`, or run `HW_LINES.disable()`.
// Point it at another loopback API: `?hwlines=http://127.0.0.1:8799`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_LINES && W.HW_LINES.__armed) { return; }      // idempotent

  // '/api/order/lines' is the wired path. This file was written against
  // '/api/order/lines' while the API module specified the other -- two agents,
  // two names for one route, and the seam sat silently 'unreachable' against a
  // server that was answering perfectly. Serving both would just move the
  // ambiguity into the server; one canonical name is the fix.
  var ROUTE = '/api/order/lines';
  var OFF_KEY = 'hw-lines-off';
  var SEAM_ID = 'lines';
  // POSITION IS NO LONGER THIS FILE'S BUSINESS. Every seam used to pick its own
  // "clear the siblings" bottom offset without knowing the others existed --
  // first three collided on one line, then they were spread up the left edge as
  // four stacked pills, and each opened a 66vh card ON TOP of the Order Queue.
  // dock() below owns the geometry for all four, so there is one tray and one
  // open panel instead of four modules guessing about each other.
  var TIMEOUT_MS = 6000;
  var CACHE_CAP = 200;           // a sheet is opened one at a time; this is generous

  // ── gate ─────────────────────────────────────────────────────────────────
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) contains DOUBLE QUOTES. Interpolated raw into style="…" the
  // first one terminates the attribute and every declaration after it is
  // silently dropped — hw-live-taxonomy.js:62 paid for this in a black-on-black
  // warning line. Single quotes survive.
  function ff(v) { return String(v).replace(/"/g, "'"); }

  // ── the seam dock ────────────────────────────────────────────────────────
  // WHY THIS EXISTS. Four sibling seams each pinned their own fixed pill up the
  // left edge and each opened a 66vh card ON TOP of the Order Queue -- its tabs,
  // its kanban, and the pills of the other three. The owner could not drive the
  // demo. What these panels SAY is not negotiable; how much of the screen they
  // take is. So: ONE tray of small pills, ONE open panel at a time, docked
  // bottom-left, height-capped, scrolling inside itself, dismissed by Escape or
  // by a visible close control. Every seam file defines this block identically
  // -- whichever loads first wins and the others reuse it, so there is exactly
  // one tray and exactly one open-panel rule however many seams ship.
  function dock() {
    if (W.HW_SEAM_DOCK) { return W.HW_SEAM_DOCK; }
    if (!document.body) { return null; }
    var D = {
      LEFT: 86,            // shared/app-rail.jsx:46 — 74px rail + 12px gutter
      BOTTOM: 52,          // clears hw-live.js's own pill (bottom 14 + ~30 tall)
      _root: null,
      _slot: null,
      _tray: null,
      _closers: {},
      // ONE bottom-anchored column: the open panel on top, the pill tray
      // underneath. The column is what makes this self-correcting -- when the
      // tray wraps to a second row on a narrow window the panel is pushed up by
      // the layout, not by arithmetic somebody has to keep in sync. Measured in
      // the browser: an earlier build pinned the panel at a fixed bottom:92 and
      // a wrapped second tray row grew 26px straight through it.
      root: function () {
        if (D._root && D._root.parentNode) { return D._root; }
        var r = document.createElement('div');
        r.id = 'hw-seam-dock';
        // pointer-events:none here and auto on each pill and panel: the empty
        // gutter beside a short pill must not swallow a click meant for the app.
        r.setAttribute('data-hw-chrome', 'seam-dock');
        r.style.cssText = 'position:fixed;left:' + D.LEFT + 'px;bottom:' + D.BOTTOM +
          'px;z-index:var(--hwz-chromeDock);display:flex;flex-direction:column;align-items:flex-start;' +
          'gap:8px;max-width:calc(100vw - ' + (D.LEFT + 16) + 'px);pointer-events:none';
        document.body.appendChild(r);
        D._root = r;
        return r;
      },
      // Where every seam's panel lives. Above the tray, always.
      slot: function () {
        if (D._slot && D._slot.parentNode) { return D._slot; }
        var s = document.createElement('div');
        s.id = 'hw-seam-panels';
        s.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:8px;' +
          'max-width:100%;pointer-events:none';
        var r = D.root();
        r.insertBefore(s, r.firstChild);
        D._slot = s;
        return s;
      },
      tray: function () {
        if (D._tray && D._tray.parentNode) { return D._tray; }
        var t = document.createElement('div');
        t.id = 'hw-seam-tray';
        t.style.cssText = 'display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;' +
          'max-width:100%;pointer-events:none';
        D.root().appendChild(t);
        D._tray = t;
        return t;
      },
      register: function (id, close) { D._closers[id] = close; },
      // Opening one closes its siblings. Four overlapping cards at the same
      // z-index is how the identity panel became unreachable earlier this week.
      opened: function (id) {
        Object.keys(D._closers).forEach(function (k) {
          if (k !== id) { try { D._closers[k](); } catch (e) {} }
        });
      },
      closeAll: function () {
        Object.keys(D._closers).forEach(function (k) { try { D._closers[k](); } catch (e) {} });
      }
    };
    // The only globally bound key, and it only ever CLOSES. A panel you cannot
    // get out of without hunting for its pill again is the bug being fixed.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { D.closeAll(); }
    });
    W.HW_SEAM_DOCK = D;
    return D;
  }

  // The docked panel box. It sits in the dock's own column, so the tray below
  // it can never be overlapped, and it is capped in BOTH dimensions so it can
  // never grow over the working area again -- the body scrolls INSIDE it, which
  // is what keeps the cap honest.
  function panelCSS(P, D, open) {
    return 'width:min(400px,calc(100vw - ' + (D.LEFT + 16) + 'px));max-height:min(46vh,380px);' +
      'flex-direction:column;overflow:hidden;background:' + P.surface + ';border:1px solid ' +
      P.hairline2 + ';border-radius:' + P.r12 + 'px;box-shadow:' + P.shadowLg + ';font-family:' +
      P.fontSans + ';pointer-events:auto;display:' + (open ? 'flex' : 'none');
  }

  // Header (title + a real close control) · body that scrolls inside itself ·
  // footer that stays reachable however long the body gets.
  function panelShell(P, attr, title, bodyHTML, footerHTML) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;flex:0 0 auto;' +
      'border-bottom:1px solid ' + P.hairline + '"><span style="flex:1 1 auto;min-width:0;font-size:' +
      P.type.micro + 'px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' +
      P.inkMute + '">' + esc(title) + '</span>' +
      '<button ' + attr + '="close" aria-label="Close this panel" title="Close (Esc)" ' +
      'style="flex:0 0 auto;width:24px;height:24px;padding:0;line-height:1;border-radius:' + P.r8 +
      'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink2 +
      ';font-family:' + P.fontSans + ';font-size:' + P.type.body +
      'px;font-weight:700;cursor:pointer">×</button></div>' +
      '<div ' + attr + '-scroll style="flex:1 1 auto;min-height:0;overflow:auto;padding:11px">' +
      bodyHTML + '</div>' +
      (footerHTML ? '<div style="flex:0 0 auto;padding:9px 11px;border-top:1px solid ' +
        P.hairline + '">' + footerHTML + '</div>' : '');
  }

  // The small pill. Sub-text is carried only when it is TELLING you something
  // -- a count of what is broken, or where the API that did not answer lives.
  // A clean seam is a dot and a name, because four fully-spelled pills is what
  // pushed this tray into three rows and over the app's own controls.
  function pillHTML(P, attr, dot, label, sub, tip) {
    return '<div role="button" tabindex="0" data-hw-i ' + attr + '="toggle" title="' + esc(tip) +
      '" style="display:inline-flex;align-items:center;gap:7px;min-height:' + P.ctrlH.xs +
      'px;padding:0 11px;border-radius:' + P.r999 + 'px;background:' + P.surface + ';border:1px solid ' +
      P.hairline2 + ';box-shadow:' + P.shadowSm + ';cursor:pointer;user-select:none;' +
      'pointer-events:auto;white-space:nowrap">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + dot +
      ';flex:0 0 auto"></span>' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(label) + '</span>' +
      (sub ? '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' +
        ff(P.fontMono) + '">' + esc(sub) + '</span>' : '') + '</div>';
  }

  // EVERY WORD OF THE DISCLOSURE IS STILL HERE — it is one click away instead of
  // 900px of prose opening over the board it is describing. Shortened
  // presentation, never shortened content.
  function whyBlock(P, attr, open, notesHTML, n) {
    return '<div style="margin-top:10px;padding-top:9px;border-top:1px solid ' + P.hairline + '">' +
      '<button ' + attr + '="why" aria-expanded="' + (open ? 'true' : 'false') +
      '" style="width:100%;text-align:left;min-height:' + P.ctrlH.xs + 'px;padding:0 9px;' +
      'border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 +
      ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' + P.type.micro +
      'px;font-weight:700;letter-spacing:.06em;cursor:pointer">' + (open ? '▾' : '▸') +
      '  WHY · SOURCE, AND WHAT IS STILL NOT TRUE (' + n + ')</button>' +
      (open ? '<div style="margin-top:8px">' + notesHTML + '</div>' : '') + '</div>';
  }

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

  var override = qs('hwlines');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback. A crafted
  // ?hwlines=<host> link would otherwise point an operator's picking sheet at
  // an arbitrary server and render that server's cart as this customer's order.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }
  // Armed on any origin; the same-origin fetch is what decides. On GitHub Pages
  // /api/order/lines 404s, the fetch fails, and the sheet stays exactly as it
  // is today — with this panel saying which of the two 404s it got.
  var armed = !disabled;

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';   // off|pending|slow|live|unreachable
  var _routeReason = null;     // why the route is not answering, in words
  var _lines = {};             // wm_order_id -> the route's payload, verbatim
  var _err = {};               // wm_order_id -> why this one did not load
  var _inflight = {};          // wm_order_id -> true
  var _order = [];             // cache insertion order, for the cap
  var _hw = null, _hwTries = 0, _wrapTries = 0;
  var _subs = [];              // React panels listening for a repaint
  var _el = null, _panel = null, _open = false, _why = false, _scroll = 0, _lookup = '';
  var _lastOrderId = null;
  var _probeDone = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function notify() {
    for (var i = 0; i < _subs.length; i++) { try { _subs[i](); } catch (e) {} }
  }

  // hw-live.js is the ONLY holder of a React root. Ours would be null.
  function rerender() {
    if (W.HW_LIVE && typeof W.HW_LIVE.rerender === 'function') {
      try { W.HW_LIVE.rerender(); } catch (e) {}
    }
  }

  function money(v) {
    if (v == null) { return null; }
    var n = Number(v);
    if (!isFinite(n)) { return null; }
    return '$' + n.toFixed(2);
  }

  function when(ts) {
    var n = Number(ts);
    if (!isFinite(n) || !n) { return null; }
    try { return new Date(n * 1000).toLocaleString(); } catch (e) { return null; }
  }

  // pos/tokens.jsx is the ONLY place colours are defined (CLAUDE.md rule 2).
  // No THEMES on the page means no panel at all, rather than a hex literal here.
  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body ? document.body.style.colorScheme : '';
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT. Both older siblings paid for this: aborting on
  // a timeout makes a slow-but-fine response indistinguishable from a dead
  // server, and on a cold load Babel is compiling thirty JSX files on this same
  // thread. The timer changes the LABEL only; the request runs to completion.
  function getJSON(path) {
    return fetch(base + path, { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) {
          var e = new Error('HTTP ' + res.status);
          e.code = res.status;
          throw e;
        }
        return res.json();
      });
  }

  // A 404 on this route has exactly one known cause in this estate and saying
  // it beats "unreachable": wmdemo/order_lines.py exists and nothing in
  // server.py dispatches to it. Any other failure is reported as itself.
  function failReason(e) {
    if (e && e.code === 404) {
      return 'GET ' + base + ROUTE + ' returned 404. wmdemo/order_lines.py ' +
             'exists and works, but no route in wmdemo/server.py serves it yet ' +
             '— so the real line items cannot be read. The wiring snippet is in ' +
             'this change\'s handover note.';
    }
    if (e && e.code) { return 'GET ' + ROUTE + ' returned HTTP ' + e.code + '.'; }
    return 'GET ' + base + ROUTE + ' did not answer (' +
           ((e && e.message) || 'unknown') + '). On a page that is not served ' +
           'beside the demo API this is expected, and the sheet stays on its ' +
           'mock rows.';
  }

  // Liveness probe. order_lines.order_lines('') answers 200 with found:false and
  // reason "no wm_order_id given" — a real answer from the real module, which is
  // exactly what a probe should require. Anything else is not this API.
  function probe() {
    if (!armed) { return Promise.resolve('off'); }
    var timer = setTimeout(function () {
      if (!_probeDone) { _status = 'slow'; paint(); notify(); }
    }, TIMEOUT_MS);
    return getJSON(ROUTE + '?wm_order_id=').then(function (j) {
      clearTimeout(timer); _probeDone = true;
      if (!j || typeof j !== 'object' || !j.counts || !Array.isArray(j.lines)) {
        _status = 'unreachable';
        _routeReason = base + ROUTE + ' answered, but the body is not ' +
          'order_lines output (no `lines` array, no `counts`). Refusing to ' +
          'render it — an unrecognised body drawn as line items is how a wrong ' +
          'cart gets onto a picking sheet.';
      } else {
        _status = 'live';
        _routeReason = null;
      }
      paint(); notify();
      return _status;
    }).catch(function (e) {
      clearTimeout(timer); _probeDone = true;
      _status = 'unreachable';
      _routeReason = failReason(e);
      paint(); notify();
      return _status;
    });
  }

  function remember(id) {
    _order.push(id);
    while (_order.length > CACHE_CAP) {
      var drop = _order.shift();
      if (drop !== id) { delete _lines[drop]; delete _err[drop]; }
    }
  }

  function fetchLines(id, force) {
    id = String(id == null ? '' : id);
    if (!armed || !id) { return Promise.resolve(null); }
    if (!force && (_lines[id] || _err[id] || _inflight[id])) {
      return Promise.resolve(_lines[id] || null);
    }
    if (force) { delete _lines[id]; delete _err[id]; }
    _inflight[id] = true;
    notify();
    return getJSON(ROUTE + '?wm_order_id=' + encodeURIComponent(id))
      .then(function (j) {
        delete _inflight[id];
        if (!j || typeof j !== 'object' || !j.counts || !Array.isArray(j.lines)) {
          _err[id] = base + ROUTE + ' answered for ' + id + ' with a body that ' +
            'is not order_lines output. Not rendered.';
          _status = 'unreachable';
        } else {
          _lines[id] = j;
          _status = 'live';
          _routeReason = null;
          publishToHW();
        }
        remember(id);
        paint(); notify(); rerender();
        return _lines[id] || null;
      })
      .catch(function (e) {
        delete _inflight[id];
        _err[id] = failReason(e);
        if (e && e.code === 404) { _status = 'unreachable'; _routeReason = _err[id]; }
        remember(id);
        paint(); notify(); rerender();
        return null;
      });
  }

  // ── publish onto window.HW, IN PLACE ─────────────────────────────────────
  // HW.ORDER_LINES is created once and only ever has keys written into it. The
  // screens hold references to window.HW's sub-objects from module scope, so a
  // reassignment here would be invisible to every one of them.
  function publishToHW() {
    if (!_hw) { return; }
    if (!_hw.ORDER_LINES) { _hw.ORDER_LINES = {}; }
    Object.keys(_lines).forEach(function (k) { _hw.ORDER_LINES[k] = _lines[k]; });
  }

  // THE MIGRATION HOOK. A POS dev deletes the six `baseItems` lines and reads
  // this instead; it is synchronous, it never throws, it never returns a fake
  // list, and it kicks off the fetch on a cold id so the second render has the
  // answer. `state` is what a caller must branch on — never `lines.length`.
  //
  //   const L = window.HW.orderLines(o.id);
  //   // L.state: 'off' | 'loading' | 'live' | 'error'
  //   // L.lines: [] unless state === 'live'
  //   // L.reason: the sentence to print when there is nothing to draw
  function orderLinesAccessor(id) {
    id = String(id == null ? '' : id);
    if (!armed) {
      return { state: 'off', lines: [], data: null, reason:
        'the live line-items seam is switched off (?hwlines=off or ' +
        'HW_LINES.disable()) — the products shown are the design\'s mock rows' };
    }
    if (_lines[id]) {
      var d = _lines[id];
      return { state: 'live', lines: d.lines, data: d,
               reason: d.found ? (d.lines_reason || null) : (d.reason || null) };
    }
    if (_err[id]) { return { state: 'error', lines: [], data: null, reason: _err[id] }; }
    fetchLines(id);
    return { state: 'loading', lines: [], data: null,
             reason: 'reading the retained Weedmaps payload for order ' + id + '…' };
  }

  function waitForHW() {
    if (W.HW) {
      _hw = W.HW;
      publishToHW();
      _hw.orderLines = orderLinesAccessor;
      rerender();
      return;
    }
    if (_hwTries++ > 200) { return; }        // ~30s, then give up quietly
    setTimeout(waitForHW, 150);
  }

  // ── the in-sheet panel ───────────────────────────────────────────────────
  // window.OrderDetails is assigned onto window (screen-orders.jsx:1459), and
  // BOTH call sites resolve it late — screen-orders.jsx:99 as a bare global
  // identifier inside JSX, screen-register.jsx:854 as React.createElement(
  // window.OrderDetails, …). So wrapping the global is enough, and no screen is
  // edited. The original is rendered UNCHANGED as a child element (not called
  // as a function) so its ~40 hooks stay in their own component instance.
  var _Panel = null;

  function buildPanel(React) {
    var h = React.createElement;

    function chip(P, text, fg, bg) {
      return h('span', { style: {
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.06em',
        textTransform: 'uppercase', color: fg, background: bg,
        padding: '2px 7px', borderRadius: P.r999, whiteSpace: 'nowrap'
      } }, text);
    }

    function note(P, text, fg, bg, key) {
      return h('div', { key: key, style: {
        fontSize: P.type.meta, lineHeight: 1.5, color: fg, background: bg,
        border: '1px solid ' + fg, borderRadius: P.r8, padding: '7px 9px'
      } }, text);
    }

    function batchTone(P, state) {
      if (state === 'committed') { return { fg: P.good, bg: P.goodSoft, word: 'batch committed' }; }
      if (state === 'reversed') { return { fg: P.warn, bg: P.warnSoft, word: 'batch reversed' }; }
      if (state === 'none') { return { fg: P.neutral, bg: P.neutralSoft, word: 'no batch recorded' }; }
      return { fg: P.neutral, bg: P.neutralSoft, word: 'batch unknown' };
    }

    function batchRows(P, list, fg) {
      return list.map(function (b, i) {
        return h('div', { key: i, style: {
          fontSize: P.type.meta, fontFamily: P.fontMono, color: fg,
          display: 'flex', gap: 8, flexWrap: 'wrap'
        } },
          h('span', { style: { fontWeight: 700 } }, b.batch_id),
          h('span', null, '× ' + b.qty),
          h('span', null, b.region || 'region not recorded'),
          h('span', { style: { color: P.inkMute } }, when(b.committed_at) || 'no commit time'));
      });
    }

    function lineRow(P, l) {
      var wm = l.wm || {};
      var tone = batchTone(P, l.batch_state);
      var bad = !l.resolved;
      var kids = [];

      kids.push(h('div', { key: 'top', style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
        h('span', { style: { fontSize: P.type.body, fontWeight: 700, color: P.ink, flex: 1, minWidth: 0 } },
          wm.name || '(Weedmaps sent no name on this line)'),
        h('span', { style: { fontSize: P.type.numRow, fontWeight: 800, fontFamily: P.fontMono, color: P.ink } },
          '× ' + l.quantity)));

      kids.push(h('div', { key: 'wmmeta', style: {
        fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono,
        wordBreak: 'break-all'
      } }, (wm.brand ? wm.brand + ' · ' : '') + (wm.external_id || 'no externalId')));

      // Price, or the reason there is not one. Never a zero.
      kids.push(h('div', { key: 'price', style: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' } },
        l.unit_price == null
          ? h('span', { style: { fontSize: P.type.meta, color: P.bad, fontWeight: 600 } }, l.unit_price_reason)
          : h('span', { style: { fontSize: P.type.meta, fontFamily: P.fontMono, color: P.ink2 } },
              money(l.unit_price) + ' ea'),
        l.line_total != null && h('span', { style: {
          fontSize: P.type.body, fontFamily: P.fontMono, fontWeight: 700, color: P.ink
        } }, money(l.line_total)),
        wm.original_price && wm.adjusted_price && wm.original_price !== wm.adjusted_price &&
          h('span', { style: { fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono } },
            'was ' + money(wm.original_price))));

      if (bad) {
        // THE ROW THAT MUST NEVER BE DROPPED.
        kids.push(h('div', { key: 'unres', style: {
          marginTop: 2, fontSize: P.type.meta, lineHeight: 1.5, color: P.bad,
          background: P.badSoft, border: '1px solid ' + P.bad,
          borderRadius: P.r8, padding: '7px 9px'
        } },
          h('span', { style: { fontWeight: 700 } }, 'NOT RESOLVED TO A SKU — '),
          l.unresolved_reason));
      } else {
        kids.push(h('div', { key: 'pos', style: { fontSize: P.type.meta, color: P.ink2 } },
          h('span', { style: { fontFamily: P.fontMono, fontWeight: 700 } }, l.sku),
          ' · ' + (l.category || 'no category') +
          (l.strain ? ' · ' + l.strain : '') +
          (l.thc ? ' · ' + l.thc + ' THC (catalogue figure, not this batch)' : '')));
      }

      kids.push(h('div', { key: 'batch', style: { marginTop: 2 } },
        chip(P, tone.word, tone.fg, tone.bg)));

      if ((l.batches || []).length) {
        kids.push(h('div', { key: 'bl', style: { display: 'flex', flexDirection: 'column', gap: 2 } },
          batchRows(P, l.batches, P.ink2)));
        kids.push(h('div', { key: 'bthc', style: { fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.5 } },
          'This is the stock that physically went out. The batch\'s own THC % is ' +
          'on catalog.batches and is NOT carried on this route, so it is not shown.'));
      }
      if ((l.reversed_batches || []).length) {
        kids.push(h('div', { key: 'rbl', style: { display: 'flex', flexDirection: 'column', gap: 2 } },
          batchRows(P, l.reversed_batches, P.warn)));
      }
      if (l.batch_note) {
        kids.push(h('div', { key: 'bn', style: { fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.5 } },
          l.batch_note));
      }

      return h('div', { key: l.index, style: {
        display: 'flex', flexDirection: 'column', gap: 5,
        padding: '10px 11px',
        background: bad ? P.badSoft : P.surface2,
        border: '1px solid ' + (bad ? P.bad : P.hairline),
        borderRadius: P.r10
      } }, kids);
    }

    return function HWLinesPanel(props) {
      var orderId = String(props.orderId == null ? '' : props.orderId);
      var tick = React.useState(0);
      var setTick = tick[1];

      React.useEffect(function () {
        var fn = function () { setTick(function (n) { return n + 1; }); };
        _subs.push(fn);
        W.addEventListener('resize', fn);
        return function () {
          var i = _subs.indexOf(fn);
          if (i >= 0) { _subs.splice(i, 1); }
          W.removeEventListener('resize', fn);
        };
      }, []);

      React.useEffect(function () {
        if (orderId) { _lastOrderId = orderId; fetchLines(orderId); paint(); }
      }, [orderId]);

      var P = palette();
      if (!P || !armed) { return null; }      // no tokens ⇒ no panel, not a hex literal

      var narrow = W.innerWidth < 1160;
      var d = _lines[orderId];
      var err = _err[orderId];
      var loading = !!_inflight[orderId] || (!d && !err);

      var head = [];
      head.push(h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 7 } },
        h('span', { style: {
          width: 7, height: 7, borderRadius: P.r999, flex: '0 0 auto',
          background: d ? P.good : err ? P.bad : P.inkFaint
        } }),
        h('span', { style: { fontSize: P.type.strong, fontWeight: 700, color: P.ink, flex: 1 } },
          'Line items · from the Weedmaps payload'),
        h('span', { style: { fontSize: P.type.micro, fontFamily: ff(P.fontMono), color: P.inkMute } },
          '#' + orderId)));

      // The red line, FIRST. Which of the two tables on this screen to trust is
      // the most important sentence here, and a warning that needs scrolling to
      // reach is a warning that does not exist.
      head.push(h('div', { key: 'mock', style: {
        fontSize: P.type.micro, lineHeight: 1.55, color: P.bad,
        background: P.badSoft, border: '1px solid ' + P.bad,
        borderRadius: P.r8, padding: '7px 9px'
      } },
        h('span', { style: { fontWeight: 700 } }, 'STILL MOCK: '),
        'the product table inside the sheet behind this panel is a hardcoded ' +
        'literal (pos/screen-orders.jsx:1486 — Cake Crasher / Blueberry Pancakes / ' +
        'Doubleshot Edible, sliced to the item count), and every total, tax and ' +
        'change figure on that sheet is arithmetic over it. This seam does not ' +
        'own that file. Replace baseItems with window.HW.orderLines(o.id).'));

      var body = [];

      if (loading) {
        body.push(note(P, 'Reading the retained Weedmaps payload for order ' +
          orderId + ' — GET ' + ROUTE + '…', P.inkDim, P.surface2, 'load'));
      } else if (err) {
        body.push(note(P, err, P.bad, P.badSoft, 'err'));
        body.push(h('div', { key: 'errfoot', style: { fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.5 } },
          'Nothing below this panel changed: the sheet is still drawing its ' +
          'hardcoded mock products. This panel refuses to guess what was on the order.'));
      } else if (!d.found) {
        body.push(note(P, d.reason, P.warn, P.warnSoft, 'nf'));
        if (d.known_order) {
          body.push(h('div', { key: 'kn', style: { fontSize: P.type.meta, color: P.ink2, lineHeight: 1.6 } },
            'What we do know about this order: status ' + (d.status || 'not recorded') +
            (d.grand_total != null ? ', total ' + money(d.grand_total) : ', no total recorded') +
            (d.customer_name ? ', customer ' + d.customer_name : '') + '.'));
        }
      } else {
        // header facts that qualify everything below
        var meta = [];
        meta.push(chip(P, d.payload_source === 'pending' ? 'paid order webhook' : 'draft — pre-order cart',
          d.payload_source === 'pending' ? P.good : P.warn,
          d.payload_source === 'pending' ? P.goodSoft : P.warnSoft));
        meta.push(chip(P, d.signature_verified ? 'signature verified' : 'signature NOT verified',
          d.signature_verified ? P.good : P.warn,
          d.signature_verified ? P.goodSoft : P.warnSoft));
        meta.push(chip(P, d.counts.lines + ' lines · ' + d.counts.resolved + ' resolved' +
          (d.counts.unresolved ? ' · ' + d.counts.unresolved + ' UNRESOLVED' : ''),
          d.counts.unresolved ? P.bad : P.neutral,
          d.counts.unresolved ? P.badSoft : P.neutralSoft));
        body.push(h('div', { key: 'meta', style: { display: 'flex', gap: 5, flexWrap: 'wrap' } },
          meta.map(function (c, i) { return h('span', { key: i }, c); })));

        if (d.payload_source === 'draft') {
          body.push(note(P, 'No Create (pending) webhook was retained for this order, so ' +
            'these lines are the customer\'s cart at the pre-order price check — ' +
            'not necessarily what was finally accepted.', P.warn, P.warnSoft, 'draft'));
        }

        if (!d.lines.length) {
          body.push(note(P, d.lines_reason, P.warn, P.warnSoft, 'nolines'));
        } else {
          body.push(h('div', { key: 'lines', style: { display: 'flex', flexDirection: 'column', gap: 7 } },
            d.lines.map(function (l) { return lineRow(P, l); })));

          body.push(h('div', { key: 'tot', style: {
            display: 'flex', flexDirection: 'column', gap: 3,
            paddingTop: 8, borderTop: '1px solid ' + P.hairline2
          } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: P.type.body } },
              h('span', { style: { color: P.inkDim } }, 'Lines subtotal'),
              h('span', { style: { fontFamily: P.fontMono, fontWeight: 700, color: P.ink } },
                money(d.lines_subtotal) || 'not computable — a line has no price')),
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: P.type.body } },
              h('span', { style: { color: P.inkDim } }, 'Weedmaps grand total'),
              h('span', { style: { fontFamily: P.fontMono, fontWeight: 700, color: P.ink } },
                money(d.grand_total) || 'not sent')),
            h('div', { style: { fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.5, marginTop: 2 } },
              d.grand_total_covers)));
        }

        body.push(h('div', { key: 'cart', style: { fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.5, fontFamily: ff(P.fontMono) } },
          'cart ' + (d.wm_cart_id || '—') + ' · ' + d.cart_id_source +
          (when(d.payload_received_at) ? ' · payload ' + when(d.payload_received_at) : '')));
      }

      // CLEARS THE FLOATING LAUNCHERS, AND DOES IT WITHOUT vh. tour.js, the
      // notes layer and app-switcher.js each pin a 44px button at right:16, and
      // together they own the bottom ~152px of that column at z-index
      // 2147483000 — a panel that runs past that puts its last rows under them.
      // The first attempt capped the height with calc(100vh - 166px) and STILL
      // overlapped: measured in the browser, this pane renders at a ~1.08 zoom,
      // so 100vh and getBoundingClientRect disagree by 8%. Anchoring to BOTH
      // edges (top + bottom) makes the browser do the arithmetic in whatever
      // coordinate system it is actually using, and no zoom can defeat it.
      var pos = narrow
        ? { left: 12, right: 76, bottom: 88, maxHeight: '42vh' }   // clears the seam tray
        : { top: 34, right: 20, bottom: 160, width: 'min(400px, 94vw)' };

      var style = {
        // Owned by the order-details sheet it renders inside, so it takes the
        // scale's modal-popover rung rather than a number of its own.
        position: 'fixed', zIndex: (P.z ? P.z.modalPop : 320), boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 9,
        background: P.surface, border: '1px solid ' + P.hairline2,
        borderRadius: P.r12, boxShadow: P.shadowLg, padding: 13,
        overflowY: 'auto', fontFamily: P.fontSans
      };
      Object.keys(pos).forEach(function (k) { style[k] = pos[k]; });

      // stopPropagation: the sheet's scrim closes on click and this panel is a
      // sibling of it, but a stray bubble here must not shut the record.
      return h('div', { onClick: function (e) { e.stopPropagation(); }, style: style },
        head, body);
    };
  }

  function wrapOrderDetails() {
    if (!armed) { return; }
    var OD = W.OrderDetails;
    if (typeof OD !== 'function' || !W.React) {
      if (_wrapTries++ > 300) { return; }    // ~45s, then give up quietly
      setTimeout(wrapOrderDetails, 150);
      return;
    }
    if (OD.__hwLines) { return; }
    var React = W.React;
    if (!_Panel) { _Panel = buildPanel(React); }
    function Wrapped(props) {
      return React.createElement(React.Fragment, null,
        React.createElement(OD, props),
        React.createElement(_Panel, { orderId: props && props.o ? props.o.id : null }));
    }
    Wrapped.__hwLines = true;
    Wrapped.displayName = 'HWLines(OrderDetails)';
    W.OrderDetails = Wrapped;
  }

  // ── theme-aware pill + docked panel ──────────────────────────────────────
  function panelBodyHTML(P) {
    var cached = Object.keys(_lines).length;
    var failed = Object.keys(_err).length;
    var p = '';

    // A dead route is an ACTIVE FAILURE and never goes behind a toggle.
    if (_routeReason) {
      p += '<div style="font-size:' + P.type.meta + 'px;line-height:1.55;color:' + P.bad +
           ';background:' + P.badSoft + ';border:1px solid ' + P.bad + ';border-radius:' +
           P.r8 + 'px;padding:8px 9px;margin-bottom:8px">' + esc(_routeReason) + '</div>';
    }

    // The one-line version of the claim, always visible. The paragraph that
    // proves it is in WHY below -- shortened presentation, not shortened
    // content: no word of it has been deleted.
    p += '<div style="font-size:' + P.type.meta + 'px;line-height:1.55;color:' + P.bad +
         ';background:' + P.badSoft + ';border:1px solid ' + P.bad + ';border-radius:' +
         P.r8 + 'px;padding:8px 9px;margin-bottom:8px"><b>Still mock:</b> the order detail ' +
         'sheet draws its own hardcoded product table, not these lines.</div>';

    p += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.7">' +
         'status <b>' + esc(_status) + '</b> · cached ' + cached + ' · failed ' + failed +
         (_lastOrderId ? ' · last sheet #' + esc(_lastOrderId) : '') + '</div>';

    p += '<div style="display:flex;gap:6px;margin-top:9px">' +
         '<input data-hwl="q" value="' + esc(_lookup) + '" placeholder="wm_order_id" ' +
         'style="flex:1;min-width:0;min-height:' + P.ctrlH.sm + 'px;padding:0 9px;border:1px solid ' +
         P.fieldBorder + ';border-radius:' + P.r8 + 'px;background:' + P.field + ';color:' + P.ink +
         ';font-family:' + ff(P.fontMono) + ';font-size:' + P.type.meta + 'px;box-sizing:border-box">' +
         '<button data-hwl="go" style="min-height:' + P.ctrlH.sm + 'px;padding:0 11px;border-radius:' +
         P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink2 +
         ';font-family:' + P.fontSans + ';font-size:' + P.type.meta +
         'px;font-weight:600;cursor:pointer">Read</button></div>';

    if (_lookup && (_lines[_lookup] || _err[_lookup] || _inflight[_lookup])) {
      var d = _lines[_lookup];
      var t = _inflight[_lookup] ? 'reading…'
            : _err[_lookup] ? _err[_lookup]
            : !d.found ? d.reason
            : d.counts.lines + ' lines · ' + d.counts.resolved + ' resolved · ' +
              d.counts.unresolved + ' unresolved · source ' + d.payload_source +
              (d.lines_reason ? ' · ' + d.lines_reason : '');
      p += '<div style="margin-top:8px;font-size:' + P.type.meta + 'px;line-height:1.55;color:' +
           P.ink2 + ';font-family:' + ff(P.fontMono) + '">' + esc(t) + '</div>';
    }

    p += '<div style="margin-top:9px;font-size:' + P.type.micro + 'px;color:' + P.inkMute +
         ';line-height:1.5">Open any order on the Orders screen — the real lines render ' +
         'in a panel pinned to the sheet.</div>';

    // ── WHY. Every word that used to open unbidden over the queue. ──────────
    var w = '';
    w += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim +
         ';line-height:1.6;margin-bottom:8px">Source: <span style="font-family:' +
         ff(P.fontMono) + '">GET ' + esc(base + ROUTE) + '?wm_order_id=…</span> ' +
         '→ wmdemo/order_lines.py, which reads the retained Weedmaps webhook payload ' +
         '(wm_order_events.raw_payload) and joins each line to the sku we resolved it ' +
         'to and the FIFO batch commit actually took.</div>';
    w += '<div style="font-size:' + P.type.meta + 'px;line-height:1.55;color:' + P.ink2 +
         ';line-height:1.6;margin-bottom:8px"><b>Still mock, in full:</b> the order ' +
         'detail sheet\'s own product table is a hardcoded literal at ' +
         'pos/screen-orders.jsx:1486, and the item subtotal, the proportional ' +
         'discount split, the three CA tax lines, the grand total, the cash change ' +
         'and the packing checklist are all arithmetic over it. This seam does not ' +
         'own that file; it renders the truth beside it and names the lie. The ' +
         'migration is one line: <span style="font-family:' + ff(P.fontMono) +
         '">window.HW.orderLines(o.id)</span>.</div>';
    w += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkMute +
         ';line-height:1.5">Turn this seam off with <span style="font-family:' +
         ff(P.fontMono) + '">?hwlines=off</span>.</div>';
    p += whyBlock(P, 'data-hwl', _why, w, 3);

    return p;
  }

  function pillBits(P) {
    var cached = Object.keys(_lines).length;
    var failed = Object.keys(_err).length;
    return {
      dot: _status === 'live' ? (failed ? P.warn : P.good) :
           _status === 'unreachable' ? P.bad : P.inkFaint,
      label: _status === 'live' ? 'WM order lines' :
             _status === 'pending' ? 'WM order lines…' :
             _status === 'slow' ? 'WM order lines — still loading' :
             _status === 'off' ? 'WM order lines (off)' : 'WM order lines (no route)',
      // detail is the whole sentence and goes in the tooltip; the pill carries
      // only what is telling you something -- reads that FAILED, or the route
      // that did not answer.
      detail: _status === 'live'
        ? cached + ' read' + (failed ? ' · ' + failed + ' failed' : '')
        : base.replace(/^https?:\/\//, '') + ROUTE,
      sub: _status === 'live' ? (failed ? failed + ' failed' : '')
                              : base.replace(/^https?:\/\//, '') + ROUTE
    };
  }

  function paint() {
    if (!armed || !document.body) { return; }
    var P = palette();
    if (!P) { return; }                       // no tokens ⇒ no badge, not a hex literal
    var D = dock();
    if (!D) { return; }

    if (!_el) {
      // The pill goes in the SHARED TRAY; the panel is its SIBLING, pinned to
      // the dock. Before, the panel was the pill's own previous sibling inside
      // one fixed box, so opening it grew that box upward and shoved the other
      // three seams around.
      _el = document.createElement('div');
      _el.id = 'hw-lines-badge';
      _el.style.cssText = 'display:flex;pointer-events:none';
      D.tray().appendChild(_el);

      _panel = document.createElement('div');
      _panel.id = 'hw-lines-panel';
      _panel.setAttribute('role', 'dialog');
      _panel.setAttribute('aria-label', 'Weedmaps order lines');
      D.slot().appendChild(_panel);

      _el.addEventListener('click', onClick);
      _panel.addEventListener('click', onClick);
      _panel.addEventListener('input', function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-hwl') === 'q') {
          _lookup = e.target.value.trim();
        }
      });
      // Enter in the one-field lookup submits it. Nothing else in the panel is
      // key-bound: every control there is a real <button> the browser already
      // activates, and a panel-wide handler would have closed the panel.
      _panel.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target && e.target.getAttribute &&
            e.target.getAttribute('data-hwl') === 'q') {
          e.preventDefault();
          if (_lookup) { fetchLines(_lookup, true); }
        }
      });
      // The pill is a div with role=button, so it needs Enter/Space itself.
      _el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        toggle();
      });
      D.register(SEAM_ID, function () { if (_open) { _open = false; paint(); } });
    }

    var box = _panel.querySelector('[data-hwl-scroll]');
    if (box) { _scroll = box.scrollTop; }

    var b = pillBits(P);
    // The dock's collapsed summary pill speaks for all seven seams, so each
    // reports its own tone and status rather than the pill guessing from the
    // DOM. Worst tone wins; see shared/hw-seam-dock.js tone().
    if (D.report) { D.report(SEAM_ID, b.dot, _status, b.label); }
    _el.innerHTML = pillHTML(P, 'data-hwl', b.dot, b.label, b.sub,
      b.label + ' · ' + b.detail + ' — click for the source');

    _panel.style.cssText = panelCSS(P, D, _open);
    if (!_open) { _panel.innerHTML = ''; return; }

    _panel.innerHTML = panelShell(P, 'data-hwl',
      'Order line items · what the sheet should be drawing', panelBodyHTML(P), '');

    box = _panel.querySelector('[data-hwl-scroll]');
    if (box) { box.scrollTop = _scroll; }
  }

  // ONE panel at a time, and never open on arrival.
  function toggle() {
    _open = !_open;
    if (_open) { var D = dock(); if (D) { D.opened(SEAM_ID); } }
    paint();
  }

  function onClick(e) {
    var t = e.target;
    var act = t && t.getAttribute && t.getAttribute('data-hwl');
    if (act === 'close') { e.stopPropagation(); _open = false; paint(); return; }
    if (act === 'why') { e.stopPropagation(); _why = !_why; paint(); return; }
    if (act === 'go') { e.stopPropagation(); if (_lookup) { fetchLines(_lookup, true); } return; }
    if (act === 'q') { return; }
    if (t && /^(INPUT|BUTTON|SELECT|OPTION)$/.test(t.tagName)) { return; }
    // A stray click inside the open panel must not close it -- only the pill
    // toggles, and only the x and Escape close.
    if (_panel && _panel.contains(t)) { return; }
    toggle();
  }

  function watchTheme() {
    try {
      var mo = new MutationObserver(function () { paint(); });
      if (document.body) { mo.observe(document.body, { attributes: true, attributeFilter: ['style'] }); }
    } catch (e) {}
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_LINES = {
    __armed: armed,
    get status() { return _status; },
    get route() { return ROUTE; },
    get base() { return base; },
    get reason() { return _routeReason; },
    get cached() { return _lines; },
    get errors() { return _err; },
    get: function (id) { return orderLinesAccessor(id); },
    fetch: function (id) { return fetchLines(id, true); },
    refresh: function () {
      _lines = {}; _err = {}; _order = [];
      _status = 'pending'; _probeDone = false; paint(); notify();
      return probe().then(function (s) {
        if (_lastOrderId) { return fetchLines(_lastOrderId, true).then(function () { return s; }); }
        return s;
      });
    },
    open: function () {
      var D = dock();
      if (D) { D.opened(SEAM_ID); }
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

  // waitForHW runs EVEN WHEN DISARMED. Once screen-orders.jsx has been migrated
  // to window.HW.orderLines(o.id), that call is on the render path — and a
  // kill switch that makes the render path throw is not a kill switch. Off, the
  // accessor is still there and answers state:'off' with the reason; nothing is
  // fetched, nothing is wrapped, no badge is drawn.
  waitForHW();

  if (armed) {
    wrapOrderDetails();
    if (document.body) { paint(); watchTheme(); }
    else {
      document.addEventListener('DOMContentLoaded', function () { paint(); watchTheme(); });
    }
    probe();
  }
})();
