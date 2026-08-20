// ── shared/hw-live-identity.js ── the identity ledger & verification board ──
// Plain JS. Loads BEFORE React, on the POS entry HTML only. Third sibling of
// shared/hw-live.js and shared/hw-live-taxonomy.js, built to the same rules:
// armed on any origin (the same-origin fetch decides, so it is inert on GitHub
// Pages where /api 404s), in-place mutation of window.HW and never a
// reassignment, silent fallback when nothing answers, and the panel says out
// loud what is still mock.
//
// WHAT IT IS. The owner's question, in his words: "are we mapping members from
// weedmaps into our system / DB and matching them". The answer lives in three
// places in the API and in NO screen:
//   /api/identity/members      — our identity ledger, each row carrying the
//                                LIST of Weedmaps customer ids that resolve to
//                                that one person. THAT LIST IS THE ANSWER, so
//                                it is drawn on the face of every row here and
//                                not folded away behind a detail click.
//   /api/identity/order-match  — which identity a Weedmaps order resolved to,
//                                at what TIER, on what EVIDENCE.
//   /api/identity/verification — whether anybody has ever proved who they are.
//
// WHY THE BOARD IS IN THIS PANEL AND NOT ON THE SCREENS. Same reason the
// taxonomy board is in its own panel, plus one that is sharper here:
//
//   * pos/data.jsx:58 MEMBERS is five invented people, and it is consumed with
//     NO NULL GUARD — pos/screen-stubs.jsx:48 does `m.points.toLocaleString()`,
//     pos/screen-register.jsx:349 and :800 do the same. A real identity row has
//     no loyalty balance, because no loyalty data exists in this API. Writing
//     the real ledger into HW.MEMBERS would therefore either THROW and white-
//     screen the Members screen (points === null), or print `0 pts · $0.00
//     wallet` for 474 people whose balances nobody has ever computed. The first
//     breaks another agent's screen; the second is the exact class of lie this
//     project keeps re-learning. So HW.MEMBERS is left alone, the real ledger
//     is published on window.HW.IDENTITY, and that split is stated on the panel
//     rather than left to be discovered.
//
//   * pos/screen-orders.jsx:1258-1276 ("Identity & fraud check") renders
//     `score {wm.risk}/100` with a progress bar and four per-field badges, all
//     read from pos/data.jsx:220 WM_ORDER. There is no risk model —
//     engine.evaluate_fraud (wm-demo/wmdemo/engine.py:1260) returns (action,
//     reason) and nothing else — and there is no per-field verification model
//     at all. The screen cannot be made honest by feeding it different numbers,
//     because a bar and a badge ARE the claim that a check ran. Making it
//     honest is a screen edit, and this seam is not allowed to make one.
//
// CAN I MAKE ONE MYSELF? The owner's second question: "am I able to create new
// customers myself that come in from weedmaps or no?" The "New test customer"
// tab is the yes. It POSTs /api/customer/create, which synthesises an
// arriving Weedmaps order and fires it at our own HMAC-signed webhook — the
// same door a real order arrives through — so the ladder runs on it for real
// rather than a row being written into hw_identities behind its back. The
// route answers minted-vs-merged itself and flags the rows it created. The form defaults to a MESSY customer
// borrowed from the loaded ledger (a shared phone, a colliding birthday, no
// document), because that is the shape that exercises the rungs; a clean one
// mints a fresh row and proves nothing. If the route is not served, the tab
// says which route is missing and creates nothing — a 404 never renders as a
// tier.
//
// PUBLIC SURFACE: window.HW_IDENTITY = { status, members, totals, member,
//   match, simForm, simResult, synthetic, refresh(), search(), openMember(),
//   matchOrder(), record(), simulate() }, and
//   window.HW.IDENTITY mirrored as a plain property so a POS dev can render the
//   real ledger from a screen with no fetch code of their own.
// Turn it off: append `?hwident=off`, or run `HW_IDENTITY.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_IDENTITY && W.HW_IDENTITY.__armed) { return; }   // idempotent

  var TIMEOUT_MS = 6000;
  var OFF_KEY = 'hw-identity-off';
  var SEAM_ID = 'identity';
  // POSITION IS NO LONGER THIS FILE'S BUSINESS. Every seam used to pick its own
  // "clear the siblings" bottom offset without knowing the others existed --
  // first three collided on one line, then they were spread up the left edge as
  // four stacked pills, and each opened a 66vh card ON TOP of the Order Queue.
  // dock() below owns the geometry for all four, so there is one tray and one
  // open panel instead of four modules guessing about each other.
  var PAGE = 25;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' -- it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // discarded, which in the sibling files computed black-on-near-black and went
  // INVISIBLE in dark mode. Single quotes are equally valid CSS and survive.
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
        r.style.cssText = 'position:fixed;left:' + D.LEFT + 'px;bottom:' + D.BOTTOM +
          'px;z-index:2147482003;display:flex;flex-direction:column;align-items:flex-start;' +
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
      return (u.protocol === 'http:' || u.protocol === 'https:') &&
             /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(u.hostname);
    } catch (e) { return false; }
  }

  var override = qs('hwident');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback — otherwise a
  // crafted ?hwident=<host> link could point a viewer's page at an arbitrary
  // server and render that server's people as the operator's own customers.
  // This one matters more than it does in the siblings: the payload is names,
  // phone numbers and dates of birth.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }

  // ARMED ON ANY ORIGIN, and the SAME-ORIGIN FETCH decides — identical to
  // hw-live.js:97. On GitHub Pages /api/identity/members 404s, the fetch
  // fails, the panel says "no API", and nothing else on the page changes.
  var armed = !disabled;

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';
  var _page = null;           // parsed /api/identity/members
  var _totals = null;         // page.verification_totals
  var _q = '', _offset = 0;
  var _openId = null, _member = null, _memberErr = null;
  var _matchId = '', _match = null, _matchErr = null;
  var _tab = 'ledger';
  var _hw = null;
  var _open = false, _busy = false, _why = false;
  var _msg = null, _msgOk = false;
  var _el = null, _panel = null, _scroll = 0;
  // ── the test-customer control ────────────────────────────────────────────
  // _sim holds the FORM, because every state change repaints the whole panel
  // and an uncontrolled <input> would lose what was typed into it mid-run.
  // _simSeeded records that the messy defaults have been derived once, from a
  // ledger page that had actually loaded — re-deriving on every paint would
  // move the fields under the operator's hands.
  var _sim = null, _simSeeded = false, _simBusy = false;
  var _simResult = null;      // { order_id, match, matchErr, note }
  var _simErr = null;
  var SYNTH_KEY = 'hw-identity-synthetic';
  // THE ROUTE, AS SHIPPED. This was built against POST /api/simulate first,
  // because that was the documented shape at the time; the route that actually
  // landed is POST /api/customer/create (wm-demo/wmdemo/server.py:1526), and it
  // is strictly better — it answers minted-vs-merged itself from
  // first_seen_at, flags the rows it created `synthetic` in the ledger, and
  // returns the ladder verdict and the verification gate with it. So the panel
  // reads those answers instead of deriving its own. Nothing below infers an
  // outcome the route already states.
  var SIM_PATH = '/api/customer/create';
  var SYNTH_FLAG = 'synthetic';   // server.py:60 SYNTHETIC_FLAG
  // WHAT THIS BROWSER MINTED. Kept locally and labelled as local, because it
  // is exactly that and nothing more: another operator on another machine sees
  // none of it. The ledger's OWN synthetic signal is the API's `likely_fixture`
  // marker, which is why the form defaults the name to a QA prefix the server
  // recognises (identity_api.py:220 _FIXTURE_PREFIXES) instead of relying on
  // this list. Two independent marks, one of them server-side.
  //
  // THREE BUCKETS, NOT ONE, and the reason is the whole point. A test order
  // that MERGED into somebody lands on a row this panel did not create and
  // that may well be a real person — badging it "synthetic test customer"
  // would libel a customer as fake because a QA order touched them. So:
  //   minted  — the ledger count went up by one, this row is ours
  //   merged  — the count held, the row already existed, our order joined it
  //   unclear — the count could not be read, or moved by more than this order
  // and the badge says which. `ids` from the pre-split storage shape is read
  // back as `unclear`, because that is exactly what those entries are.
  var _synth = (function () {
    function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
    try {
      var v = JSON.parse(W.localStorage.getItem(SYNTH_KEY) || '{}');
      return { minted: arr(v.minted), merged: arr(v.merged),
               unclear: arr(v.unclear).concat(arr(v.ids)),
               wm: arr(v.wm), orders: arr(v.orders) };
    } catch (e) {
      return { minted: [], merged: [], unclear: [], wm: [], orders: [] };
    }
  })();

  function synthPush(arr, v) {
    if (v === null || v === undefined || v === '') { return; }
    v = String(v);
    if (arr.indexOf(v) === -1) { arr.push(v); }
    while (arr.length > 200) { arr.shift(); }
  }

  function synthSave() {
    try { W.localStorage.setItem(SYNTH_KEY, JSON.stringify(_synth)); } catch (e) {}
  }

  function rememberSent(wmId, orderId) {
    synthPush(_synth.wm, wmId);
    synthPush(_synth.orders, orderId);
    synthSave();
  }

  function rememberLanded(identityId, outcome) {
    if (identityId === null || identityId === undefined || identityId === '') { return; }
    synthPush(_synth[outcome] || _synth.unclear, identityId);
    synthSave();
  }

  function syntheticMark(m) {
    var id = String(m.identity_id);
    // THE SERVER'S OWN FLAG WINS. /api/customer/create flags every row it
    // brought into existence, and deliberately does NOT flag a pre-existing
    // customer it merely merged into. That is a fact on the ledger, visible to
    // every operator on every machine, so it outranks anything this browser
    // remembers.
    if ((m.flags || []).indexOf(SYNTH_FLAG) !== -1) { return 'server'; }
    if (_synth.minted.indexOf(id) !== -1) { return 'minted'; }
    if (_synth.merged.indexOf(id) !== -1) { return 'merged'; }
    if (_synth.unclear.indexOf(id) !== -1) { return 'unclear'; }
    var ids = m.wm_ids || [];
    for (var i = 0; i < ids.length; i++) {
      if (_synth.wm.indexOf(String(ids[i])) !== -1) { return 'wm'; }
    }
    return null;
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // A missing value is NEVER a dash on this panel when the API told us why it
  // is missing. This helper is only for fields the API simply does not carry a
  // reason for (a null phone is a null phone).
  function orNone(v, word) {
    return (v === null || v === undefined || v === '') ? (word || 'none on file') : String(v);
  }

  function ts(sec) {
    if (!sec) { return null; }
    try { return new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z'; }
    catch (e) { return String(sec); }
  }

  // pos/tokens.jsx is the ONLY place colours are defined (CLAUDE.md rule 2).
  // No THEMES on the page means no panel at all, rather than a hex literal here.
  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body.style.colorScheme;
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  // THE FOUR VERIFICATION STATES, drawn so that no two can be confused.
  //
  // The whole point: `never_checked` and `checked_not_proven` must not render
  // the same. "We never looked" is not a failure and must not be coloured like
  // one; "we looked and it did not prove them" is a RESULT and must not be
  // coloured like an absence. So they share no colour and no wording, and the
  // word NEVER LOOKED is spelled out rather than implied by a grey dash.
  function vtone(P, state) {
    if (state === 'verified') {
      return { fg: P.good, bg: P.goodSoft, word: 'VERIFIED' };
    }
    if (state === 'lapsed') {
      return { fg: P.bad, bg: P.badSoft, word: 'LAPSED · DOCUMENT EXPIRED' };
    }
    if (state === 'checked_not_proven') {
      return { fg: P.warn || P.bad, bg: P.warnSoft || P.badSoft,
               word: 'LOOKED · NOT PROVEN' };
    }
    // never_checked, and anything the API adds later that we do not know.
    if (state === 'never_checked') {
      return { fg: P.neutral, bg: P.neutralSoft, word: 'NEVER LOOKED' };
    }
    return { fg: P.inkMute, bg: P.neutralSoft, word: 'STATE ' + String(state).toUpperCase() };
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT — hw-live.js:32-39 and hw-live-taxonomy.js:165
  // both paid for this. Aborting on a timeout makes a slow-but-fine response
  // indistinguishable from a dead server, and on a cold load Babel is compiling
  // thirty JSX files on this same thread. The timer changes the LABEL only.
  var _settled = false;

  function getJSON(path) {
    return fetch(base + path, { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      });
  }

  function load() {
    _settled = false;
    var timer = setTimeout(function () {
      if (!_settled) { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);
    var url = '/api/identity/members?q=' + encodeURIComponent(_q) +
              '&limit=' + PAGE + '&offset=' + _offset;
    return getJSON(url).then(function (j) {
      clearTimeout(timer); _settled = true;
      // A payload with no members ARRAY is not this API answering. Refusing it
      // beats rendering an empty ledger and calling it live — an empty ledger
      // is a claim ("we know of nobody") and we would not have earned it.
      if (!j || !Array.isArray(j.members)) {
        _status = 'unreachable';
      } else {
        _page = j;
        _totals = j.verification_totals || null;
        _status = 'live';
        publishToHW();
      }
      paint();
      return _status;
    }).catch(function () {
      clearTimeout(timer); _settled = true;
      _status = 'unreachable';
      paint();
      return _status;
    });
  }

  function openMember(id) {
    _openId = String(id); _member = null; _memberErr = null;
    _busy = true; paint();
    return getJSON('/api/identity/member?identity_id=' + encodeURIComponent(id))
      .then(function (j) {
        _busy = false;
        // This route answers 200 with {error} for an unknown id (server.py:278
        // sends whatever identity_api.member returns). Show the server's own
        // sentence; a blank detail card would read as "this person has nothing".
        if (j && j.error) { _memberErr = j.error; _member = null; }
        else { _member = j; }
        publishToHW(); paint(); return j;
      }).catch(function (e) {
        _busy = false;
        _memberErr = 'request failed: ' + (e && e.message ? e.message : 'unknown');
        paint(); return null;
      });
  }

  function matchOrder(wmOrderId) {
    var id = String(wmOrderId == null ? _matchId : wmOrderId).trim();
    _matchId = id; _match = null; _matchErr = null;
    if (!id) { _matchErr = 'Enter a Weedmaps order id.'; paint(); return Promise.resolve(null); }
    _busy = true; _tab = 'match'; paint();
    return getJSON('/api/identity/order-match?wm_order_id=' + encodeURIComponent(id))
      .then(function (j) {
        _busy = false;
        if (j && j.error) { _matchErr = j.error; }
        else { _match = j; }
        publishToHW(); paint(); return j;
      }).catch(function (e) {
        _busy = false;
        _matchErr = 'request failed: ' + (e && e.message ? e.message : 'unknown');
        paint(); return null;
      });
  }

  // POST /api/identity/verify.
  //
  // WRITE AUTH. THIS COMMENT WAS WRONG AND IS CORRECTED — 2026-08-19, measured
  // in the browser against hyperwolf-wm-demo.onrender.com, not reasoned about.
  //
  // It used to say "on a public deployment /api/identity/verify 404s, so the
  // control is NOT RENDERED". Both halves were false, and the second one was
  // false about this file's OWN code: the control is gated on `_status ===
  // 'live'`, which is a fact about the READS. The deployment answers the reads,
  // so the control was being drawn there the whole time. Confirmed on the
  // deployed page: the method select and the Record button are both present in
  // the DOM of member #7's detail.
  //
  // What is actually true now: hw-live.js owns the write path and a write-state
  // probe with it (`HW_LIVE.writes` — unknown | writable | gated | rejected,
  // hw-live.js:137, :188-206, :245-256). It optionally carries an operator
  // token, and the server gate runs BEFORE the route table. Read off the
  // deployment 2026-08-19: `HW_LIVE.writes === 'writable'` with no token set,
  // so verification writes there are OPEN and this control works. hw-live.js's
  // own comment at :249-250 still records the earlier 403 and is now stale —
  // reported to the coordinator rather than edited, since that file is a
  // sibling seam this unit does not own.
  //
  // The control is therefore drawn whenever the reads are live, and DISABLED
  // with the server's own reason when the write gate is shut — never drawn as
  // a live primary action that cannot fire. A button that silently fails is
  // the same shape as the green rail that claimed a customer had been notified
  // about a rejected push.
  function record(identityId, method, decision, extra) {
    if (!armed) { return Promise.resolve({ ok: false, error: 'seam is off' }); }
    extra = extra || {};
    _busy = true; _msg = null; paint();
    var body = {
      identity_id: Number(identityId),
      method: String(method || ''),
      decision: String(decision || 'approved'),
      ref: extra.ref || null,
      expires_at: extra.expires_at || null,
      note: extra.note || null
    };
    return W.HW_LIVE.post('/api/identity/verify', body).then(function (r) {
      _busy = false;
      // The route returns 400 with its own sentence for a bad method or a bad
      // decision, and those sentences ARE the contract explaining itself.
      if (!r.ok || (r.body && r.body.error)) {
        _msgOk = false;
        _msg = 'Rejected ' + r.code + ': ' + ((r.body && r.body.error) || 'no reason given');
        paint();
        return { ok: false, error: (r.body && r.body.error) || ('HTTP ' + r.code) };
      }
      // `marked_verified` is NOT the same as `logged`. A declined attempt is
      // logged and marks nothing, and a re-scan of an already-valid document is
      // logged and marks nothing either. The server says which happened in
      // `why`; echoing our own optimistic sentence here is how "recorded" comes
      // to mean four different things.
      _msgOk = !!(r.body && r.body.logged);
      _msg = (r.body && r.body.marked_verified ? 'VERIFIED · ' : 'logged, not verified · ') +
             ((r.body && r.body.why) || '');
      // Re-read both the row and the ledger totals: the count on the badge is
      // the number this panel exists to move.
      return openMember(identityId).then(load).then(function () {
        return { ok: true, body: r.body };
      });
    }).catch(function (e) {
      _busy = false; _msgOk = false;
      _msg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint();
      return { ok: false, error: 'request failed' };
    });
  }

  // ── create a test customer ───────────────────────────────────────────────
  // THE OWNER'S QUESTION: "am I able to create new customers myself that come
  // in from weedmaps or no?" This is the yes. POST /api/customer/create
  // synthesises an arriving Weedmaps order from the form's fields and fires it
  // at our own HMAC-signed webhook — the same door a real Weedmaps order comes
  // through — so the ladder runs on it for real. Nothing here writes to
  // hw_identities directly; if it did, the answer would be a fake customer
  // rather than a real arrival.
  //
  // THE DEFAULTS ARE DELIBERATELY MESSY, and they are BORROWED FROM THE LEDGER
  // rather than invented: the phone comes off a real row on the loaded page,
  // the date of birth and the surname off another. A clean synthetic customer
  // tests nothing — it mints a fresh row every time and every rung of the
  // ladder stays dark. A shared phone, a colliding birthday and NO document is
  // the shape that actually exercises tier 1, the dob-fuzzy pass and the
  // document veto, which is where every identity bug this project has had
  // actually lived. When the ledger has not loaded, those two fields are left
  // BLANK and the form says why — a made-up phone number would be a made-up
  // collision, and the panel would then be testing itself.
  //
  // A BLANK FIELD IS SENT AS AN EMPTY STRING, ON PURPOSE. simulate_order
  // deep-merges `customer` over a default Jane Doe, and create_customer
  // overwrites every one of those fields explicitly for that reason. "" is what makes
  // "Weedmaps sent no phone" actually reach the engine, which is the case that
  // mints the un-rematchable rows. The form says this next to the fields.
  function lastNameOf(o) {
    var p = String((o && o.name) || '').trim().split(/\s+/);
    return p.length > 1 ? p[p.length - 1] : '';
  }

  function seedSim(force) {
    if (_sim && _simSeeded && !force) { return; }
    var mem = (_page && _page.members) || [];
    var withPhone = null, withDob = null;
    mem.forEach(function (o) { if (!withPhone && o.phone_e164) { withPhone = o; } });
    mem.forEach(function (o) {
      if (!withDob && o.dob && o !== withPhone) { withDob = o; }
    });
    if (!withDob) { mem.forEach(function (o) { if (!withDob && o.dob) { withDob = o; } }); }
    var stamp = String(Date.now()).slice(-6);
    _sim = {
      actor: 'POS identity panel (browser)',
      // QAID is one of the API's OWN fixture prefixes (identity_api.py:220), so
      // a row created here is marked as test data BY THE SERVER, for every
      // operator on every machine — not only in the browser that made it.
      first_name: 'QAIDPanel' + stamp,
      last_name: (withDob && lastNameOf(withDob)) || ('Probe' + stamp),
      phone: withPhone ? String(withPhone.phone_e164) : '',
      dob: withDob ? String(withDob.dob) : '',
      wm_customer_id: 'QAPANEL-' + stamp,
      doc: 'none',
      doc_state: 'CA',
      doc_number: 'QAPANEL' + stamp,
      doc_url: 'https://qa.hyperwolf.invalid/gov-id/' + stamp + '.jpg',
      fulfillment: 'delivery',
      fromPhone: withPhone ? who(withPhone) : null,
      fromDob: withDob ? who(withDob) : null,
      fromLast: (withDob && lastNameOf(withDob)) ? who(withDob) : null,
      scanned: mem.length
    };
    _simSeeded = !!mem.length;   // a blank-ledger seed is re-derived once rows arrive
  }

  function simulate() {
    if (!armed) { return Promise.resolve(null); }
    if (!W.HW_LIVE || !W.HW_LIVE.post) {
      _simErr = 'This control posts through HW_LIVE.post, and shared/hw-live.js has not ' +
        'loaded on this page. Nothing was sent.';
      paint(); return Promise.resolve(null);
    }
    seedSim();
    var f = _sim;
    // The route's OWN field names (server.py:1570-1585). Blank strings are sent
    // rather than the keys omitted, because create_customer overwrites every
    // field of simulate_order's default Jane Doe explicitly — including with
    // None — and that is exactly the behaviour the messy cases need.
    var body = {
      actor: f.actor,
      first_name: f.first_name,
      last_name: f.last_name,
      phone: f.phone,
      dob: f.dob,
      wm_customer_id: f.wm_customer_id,
      fulfillment: f.fulfillment
    };
    if (f.doc === 'document') {
      body.document = { number: f.doc_number, state: f.doc_state };
    } else if (f.doc === 'upload') {
      body.gov_id_url = f.doc_url;
    }

    _simBusy = true; _simErr = null; _simResult = null; paint();

    return W.HW_LIVE.post(SIM_PATH, body).then(function (r) {
      _simBusy = false;
      // EVERY FAILURE BRANCH NAMES THE ROUTE AND THE REASON, and none of them
      // reaches the verdict renderer — a missing route cannot draw a tier.
      if (!r.ok) {
        if (r.code === 404) {
          _simErr = 'This control needs POST ' + SIM_PATH + ', which this deployment does not ' +
            'serve (404 from ' + base + '). No customer was created and nothing was matched.';
        } else if (r.gated) {
          _simErr = 'Writes are gated on ' + base + ': ' + (r.error || 'read-only') +
            (r.hint ? ' — ' + r.hint : '') + '. No customer was created.';
        } else if (r.code === 0) {
          _simErr = (r.error || 'request failed') + ' — ' + SIM_PATH + ' at ' + base +
            ' did not answer. No customer was created.';
        } else if (!r.body) {
          _simErr = 'POST ' + SIM_PATH + ' answered HTTP ' + r.code + ' with a body that is not ' +
            'JSON. That is a file host answering a POST, not this API — so this origin does not ' +
            'serve the control. No customer was created.';
        } else {
          // 400 and 502 both carry the route's own sentence, and it explains
          // the contract better than anything this file could restate.
          _simErr = 'Refused ' + r.code + ': ' + (r.error || 'no reason given') +
            (r.body.known_skus ? ' · known skus: ' + r.body.known_skus.join(', ') : '');
        }
        paint(); return null;
      }

      var b = r.body || {};
      // 202 IS NOT A SUCCESS. The order fired and no identity had appeared by
      // the time the route stopped waiting. The route says which fact that is;
      // it is printed verbatim and no verdict is drawn.
      _simResult = {
        code: r.code,
        pending: r.code === 202,
        order_id: (b.order || {}).wm_order_id || null,
        fulfillment: (b.order || {}).fulfillment || f.fulfillment,
        created_ack: !!(b.order || {}).create_ack,
        doc_mode: f.doc,
        reason: b.reason || null,
        created_new: b.created_new_identity,
        flagged: b.flagged_synthetic,
        flag_note: b.flag_note || b.flag_error || null,
        ladder: b.ladder || null,
        ladder_error: b.ladder_error || null,
        identity: b.identity || null,
        verification: b.verification || null,
        waited_s: b.waited_s,
        path_note: b.path || null,
        ledger_q: null
      };
      var ident = _simResult.identity;
      var identId = ident && (ident.identity_id != null ? ident.identity_id : null);
      rememberSent(f.wm_customer_id, _simResult.order_id);
      rememberLanded(identId,
        _simResult.created_new === true ? 'minted'
        : _simResult.created_new === false ? 'merged' : 'unclear');

      // Put the row in front of the operator, searched by a handle the LANDED
      // ROW actually carries — which is its POS customer id, not its name; see
      // the note below. On a merge the ledger row keeps the name it already had —
      // blank-filling never overwrites a populated column — so searching for
      // what we just typed returns "nothing in the ledger matches", which
      // reads as a lost customer when the customer is right there under a
      // different name. Measured: QAIDPanel731448 merged into #1904
      // "QAIDMgDst188445969", and a search for QAIDPanel731448 returned 0 rows.
      // Never by the Weedmaps id either: store.search_identities does not look
      // at wm_ids at all.
      //
      // TWO THINGS WERE WRONG HERE AND QA PROVED BOTH IN THE BROWSER.
      // (1) `ident` is /api/simulate's identity block, built by
      //     identity_api._member_row (identity_api.py:248-256), which emits a
      //     single joined `name` — there is no first_name and no last_name on
      //     it. `'first_name' in simResult.identity` === false. The first two
      //     terms of this chain could never be truthy: dead code.
      // (2) The obvious repair — reach for `ident.name` — is ALSO wrong, and
      //     silently. store.search_identities:1460 substring-matches only
      //     first_name, last_name and pos_customer_id as separate columns, so
      //     the joined "First Last" matches NEITHER and returns zero rows.
      //     That would have turned a working button into "nothing in the
      //     ledger matches", which is the failure this comment block already
      //     describes, reintroduced by the fix for it.
      // So the POS customer id is chosen FIRST and DELIBERATELY: store.py:1067
      // assigns one to every identity at insert, and it is exact, so it lands
      // on the row itself rather than on everybody sharing a first name. Only
      // if it is missing do we fall back — and then to the FIRST TOKEN of the
      // name, which is the part search_identities can actually match.
      var identName = (ident && ident.name) ? String(ident.name).trim() : '';
      var identFirst = identName ? identName.split(/\s+/)[0] : '';
      var q = (ident && (ident.pos_customer_id || ident.phone_e164)) ||
              identFirst || f.first_name || f.phone || '';
      _simResult.ledger_q = q ? String(q) : null;
      if (q) { _q = String(q); _offset = 0; _openId = null; _member = null; return load(); }
      paint(); return null;
    }).catch(function (e) {
      _simBusy = false;
      _simErr = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint(); return null;
    });
  }


  // ── the one handle on window.HW ──────────────────────────────────────────
  // A PROPERTY WRITE on the object pos/data.jsx published, never
  // `window.HW = ...`. hw-live.js documents why (five modules capture
  // window.HW.fmt.money at module scope). It also owns an accessor on
  // `window.HW`, so this file POLLS for the object instead of installing a
  // second one — two accessors on one property is one of them winning silently.
  //
  // NOTE what this does NOT do: it does not touch HW.MEMBERS. See the header.
  function publishToHW() {
    if (!_hw) { return; }
    // `members` IS NULL WHEN WE ARE NOT LIVE, and deliberately not [].
    // An empty array is a claim — "we asked and this operator has no
    // customers" — and it is the same claim a successful search with no hits
    // makes, so a consumer cannot tell the two apart. null cannot be mapped
    // over by accident: a screen that forgets to check `status` throws loudly
    // instead of rendering a confident, empty, wrong customer list.
    var live = _status === 'live';
    _hw.IDENTITY = {
      status: _status,
      unavailable: live ? null
        : 'no identity API answered at ' + base + '. members is null rather than [] ' +
          'because an empty list would be indistinguishable from a real empty ledger.',
      members: live && _page ? _page.members : null,
      total: _page ? _page.total : null,
      totalReason: _page ? _page.total_reason : null,
      totals: _totals,
      fixtureNote: _page ? _page.fixture_note : null,
      member: _member,
      match: _match,
      source: base + '/api/identity',
      // Spelled out on the handle too, so a POS dev reading this object does
      // not have to find the panel to learn that HW.MEMBERS is still fiction.
      note: 'window.HW.MEMBERS is still the five invented rows in pos/data.jsx:58. ' +
            'This is the real ledger. They are different data and only this one is true.'
    };
  }

  var _tries = 0;
  function waitForHW() {
    if (W.HW) { _hw = W.HW; publishToHW(); return; }
    if (_tries++ > 200) { return; }         // ~30s, then give up quietly
    setTimeout(waitForHW, 150);
  }

  // ── panel pieces ─────────────────────────────────────────────────────────
  function chip(P, t, text) {
    return '<span style="display:inline-block;padding:2px 7px;border-radius:' + P.r999 + 'px;' +
      'background:' + t.bg + ';color:' + t.fg + ';font-size:' + P.type.micro + 'px;font-weight:800;' +
      'letter-spacing:.06em">' + esc(text) + '</span>';
  }

  function sectionTitle(P, s) {
    return '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin:10px 0 6px">' + esc(s) + '</div>';
  }

  function note(P, s) {
    return '<div style="display:flex;gap:7px;font-size:' + P.type.meta + 'px;color:' + P.inkDim +
      ';line-height:1.45;margin-bottom:5px"><span style="color:' + P.inkFaint + '">·</span><span>' +
      esc(s) + '</span></div>';
  }

  // A GAP. Not a zero, not a dash, not a tick — the API's own sentence about
  // why the number does not exist, drawn as its own thing so it cannot be
  // mistaken for a value. This is the single most important renderer in the
  // file: every one of the four repeat failures on this project was a null with
  // a reason that some screen turned into a confident-looking value.
  function gap(P, label, reason) {
    return '<div style="border:1px dashed ' + P.hairline2 + ';border-radius:' + P.r8 +
      'px;padding:7px 9px;margin-bottom:6px;background:transparent">' +
      '<div style="display:flex;gap:7px;align-items:baseline">' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:800;color:' + P.ink + '">' +
      esc(label) + '</span>' +
      '<span style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;color:' +
      P.inkMute + ';font-family:' + ff(P.fontMono) + '">NOT COMPUTED</span></div>' +
      '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45;' +
      'margin-top:3px">' + esc(reason || 'the API returned no reason for this null, which is ' +
      'itself worth reporting — do not fill it in.') + '</div></div>';
  }

  function kv(P, k, v, mono) {
    return '<div style="display:flex;gap:8px;font-size:' + P.type.meta + 'px;line-height:1.5">' +
      '<span style="color:' + P.inkMute + ';flex:0 0 96px">' + esc(k) + '</span>' +
      '<span style="color:' + P.ink2 + ';flex:1 1 auto;word-break:break-word' +
      (mono ? ';font-family:' + ff(P.fontMono) : '') + '">' + esc(v) + '</span></div>';
  }

  function ctlCSS(P) {
    return 'height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink + ';font-size:' +
      P.type.meta + 'px;padding:0 8px;font-family:' + ff(P.fontSans) + ';';
  }

  function btnCSS(P, primary) {
    return 'min-height:' + P.ctrlH.xs + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      (primary ? P.ink : P.hairline2) + ';background:' + (primary ? P.ink : P.surface2) +
      ';color:' + (primary ? P.surface : P.ink2) + ';font-family:' + ff(P.fontSans) +
      ';font-size:' + P.type.meta + 'px;font-weight:700;padding:0 10px;cursor:pointer;';
  }

  // ── the verification block, used in both tabs ────────────────────────────
  // Rendered from the served object in every case. It never re-derives a state
  // from the emptiness of `attempts` — deriving "never checked" from "no
  // attempts" is precisely how a declined scan disappears.
  function verificationHTML(P, v, identityId) {
    if (!v) { return ''; }
    var t = vtone(P, v.state);
    var h = '<div style="border:1px solid ' + t.fg + ';border-left:3px solid ' + t.fg +
      ';border-radius:' + P.r8 + 'px;padding:9px;margin-bottom:8px;background:' + P.surface2 + '">';
    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<span style="font-size:' + P.type.strong + 'px;font-weight:800;color:' + P.ink +
      '">Verification</span>' + chip(P, t, t.word) + '</div>';
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
      'margin-top:5px">' + esc(v.reason) + '</div>';

    if (v.at) {
      h += '<div style="margin-top:6px">' +
        kv(P, 'proved via', orNone(v.via), true) +
        kv(P, 'proved at', ts(v.at) || '—', true) +
        kv(P, 'reference', orNone(v.ref, 'none recorded'), true) +
        kv(P, 'doc expires', v.expires_at ? ts(v.expires_at)
            : 'not recorded — the scan gave no document expiry, so this verification does not lapse on its own', true) +
        '</div>';
    }

    // Attempts are what make LOOKED·NOT PROVEN different from NEVER LOOKED, so
    // they are always shown when there are any, including the declines.
    if (v.attempt_count) {
      h += sectionTitle(P, v.attempt_count + ' attempt' + (v.attempt_count > 1 ? 's' : '') + ' on record');
      (v.attempts || []).forEach(function (a) {
        var ok = String(a.decision) === 'approved';
        // The note goes on its OWN line, not in the flex row. In the row it was
        // squeezed into a ~70px column and wrapped to six lines, which is how
        // the one sentence explaining a decline becomes unreadable.
        h += '<div style="margin-bottom:4px">' +
          '<div style="display:flex;gap:8px;font-size:' + P.type.micro + 'px;font-family:' +
          ff(P.fontMono) + ';color:' + (ok ? P.good : P.bad) + ';line-height:1.6">' +
          '<span style="flex:0 0 auto;color:' + P.inkMute + '">' + esc(ts(a.ts) || '?') + '</span>' +
          '<span style="flex:0 0 auto">' + esc(a.method) + '</span>' +
          '<span style="flex:0 0 auto;font-weight:800">' + esc(a.decision) + '</span>' +
          (a.actor ? '<span style="flex:1 1 auto;text-align:right;color:' + P.inkFaint + '">' +
                     esc(a.actor) + '</span>' : '') +
          '</div>' +
          (a.note ? '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim +
                    ';line-height:1.45">' + esc(a.note) + '</div>' : '') +
          '</div>';
      });
    }

    // The T2 rung the design draws and this system cannot fill.
    h += '<div style="margin-top:7px">' +
      gap(P, 'Phone binding (design tier T2)', v.phone_binding_reason) + '</div>';

    // The write control, or the reason there is none.
    if (identityId != null) {
      if (_status === 'live') {
        // 'unknown' is NOT treated as shut. The probe may simply not have
        // answered yet, and greying out a working control on a maybe is its own
        // small lie — the post itself reports a refusal verbatim if one comes.
        var wr = (W.HW_LIVE && W.HW_LIVE.writes) || 'unknown';
        var shut = (wr === 'gated' || wr === 'rejected');
        var wtip = wr === 'gated'
          ? 'Writes are gated on this server: the write probe came back refused, so a ' +
            'verification POST would be rejected before it reached the route. An operator ' +
            'token unlocks it — HW_LIVE.setToken(…) in the console. Nothing is recorded ' +
            'until then, and the button is disabled rather than drawn as if it would work.'
          : 'The last write to this server was rejected, so this control is disabled rather ' +
            'than drawn as a live action. See the hw-live badge for what the server said.';
        var methods = (v.methods || []).map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
        }).join('');
        h += sectionTitle(P, 'Record a verification attempt');
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
          '<select data-hwi-method style="' + ctlCSS(P) + 'flex:0 0 auto">' + methods + '</select>' +
          '<select data-hwi-decision style="' + ctlCSS(P) + 'flex:0 0 auto">' +
          '<option value="approved">approved</option>' +
          '<option value="declined">declined</option>' +
          '<option value="review">review</option>' +
          '<option value="unknown">unknown</option></select>' +
          '<input data-hwi-ref placeholder="reference" style="' + ctlCSS(P) + 'flex:1 1 90px;min-width:80px">' +
          (shut
            ? '<button disabled title="' + esc(wtip) + '" style="' + btnCSS(P) +
              'opacity:.5;cursor:not-allowed">Record</button>'
            : '<button data-hwi="record" data-id="' + esc(identityId) + '" style="' +
              btnCSS(P, true) + '">' + (_busy ? 'working…' : 'Record') + '</button>') +
          '</div>';
        // The write gate, when it is shut, said in the panel rather than
        // discovered by clicking. `writes` is hw-live.js's probed state, not a
        // guess from this file (hw-live.js:137, :245-256).
        if (shut) {
          h += '<div style="font-size:' + P.type.meta + 'px;color:' + (P.warn || P.bad) +
            ';line-height:1.5;margin-top:5px;font-weight:700">' + esc(wtip) + '</div>';
        }
        h += note(P, 'Every attempt is logged whatever it decided; only "approved" marks the ' +
          'person verified, and a re-scan never rewrites the first proof. A declined scan ' +
          'recorded here will move this row from NEVER LOOKED to LOOKED · NOT PROVEN — which is ' +
          'the whole point of keeping those two apart.');
      } else {
        h += sectionTitle(P, 'Record a verification attempt');
        h += note(P, 'NOT AVAILABLE HERE. Writing is a POST to /api/identity/verify, and this ' +
          'seam carries no auth token of any kind — hw-live.js:1206-1213 POSTs with a ' +
          'Content-Type header and nothing else, and the server route checks nothing ' +
          '(wm-demo/wmdemo/server.py:423). A write therefore only works when the page\'s own ' +
          'origin serves the API. This page did not reach the API, so the button is not drawn ' +
          'rather than drawn and silently failing.');
      }
    }
    h += '</div>';
    return h;
  }

  // ── households: two rows that share a signal and are RIGHT to be two ─────
  //
  // THE OWNER'S QUESTION, in his words: "two roommates ordering from the same
  // address should never become one identity." The ledger already gets this
  // right. Verified against the deployment 2026-08-19: Paolo Marchetti #7 and
  // Elena Marchetti #6 both carry +17145550401, both carry their OWN government
  // document, and they are held as two rows.
  //
  // But it got it right SILENTLY, and that is the defect this block fixes. The
  // two rows render independently, one directly under the other, with the same
  // phone number printed on both and NOTHING joining them. Read top to bottom
  // that is not a system being careful — it is a duplicate somebody forgot to
  // clean up, and the next thing an operator reaches for is a merge. A correct
  // decision that leaves no trace on screen is indistinguishable from an
  // oversight, and here the two readings have opposite consequences.
  //
  // WHAT THIS BLOCK REFUSES TO SAY. It does NOT claim the system decided to
  // keep them apart, because nothing records that. The document veto that
  // splits a shared phone (wm-demo/wmdemo/engine.py, factors
  // ['phone_exact_vetoed_by_document'], force_new=True) used to be returned by
  // resolve_identity at ingest and PERSISTED NOWHERE: hw_identities carries a
  // `flags` column and both Marchettis' are empty (read off the deployment),
  // and wm_customer_mapping stores a bare `match_tier` integer and no factors
  // at all (wm-demo/wmdemo/store.py:68-74). Re-running the ladder cannot
  // recover it either — each row carries its own document by then, so
  // /api/identity/order-match?wm_order_id=40764811 recomputes a clean tier 0
  // gov_id_exact with vetoed_by_document:false. For those rows the reasoning is
  // simply gone, and they are still in the ledger.
  //
  // THAT IS NO LONGER TRUE OF NEW SPLITS, verified in the browser 2026-08-19
  // against a running engine: a fresh document veto now flags BOTH rows
  // `split_by_document` (engine.py:1139) and writes an `identity_split_veto`
  // row into hw_identity_audit carrying the reason, the vetoed signal, both
  // document fingerprints and an explicit "do not merge these" note
  // (engine.py:1065 _record_document_veto). /api/identity/members does not read
  // that table, so the flag is visible here and the reason is not — which is a
  // third state, and splitHTML draws all three separately.
  //
  // So this reports the COLLISION, which is a fact off the wire, and reports
  // the ABSENCE of a recorded reason, which is also a fact, and invents
  // neither. Reported to the coordinator as an engine gap; not fixable here.
  //
  // 2026-08-19 — THE GAP IS NOW CLOSEABLE FROM THE ENGINE SIDE, and splitHTML()
  // below renders the reason the moment a row carries `split_reason` (with
  // `split_from` naming the row it was split from). Nothing above changes: a
  // row without those fields still renders the paragraph that says the reason
  // was never written down, because the splits that predate the audit record
  // really were never written down and must not be back-dated into documented
  // decisions. Two states, two renderings, and the file still invents neither.
  function lastWord(s) {
    if (!s) { return null; }
    var p = String(s).trim().split(/\s+/);
    return p.length > 1 ? p[p.length - 1].toLowerCase() : null;
  }

  function who(o) {
    return '#' + o.identity_id + ' ' + (o.name || '(no name)');
  }

  // ── WHY TWO ROWS WITH ONE PHONE ARE TWO ROWS ─────────────────────────────
  // THE FIELDS ARE READ, NEVER ASSUMED. `split_from` / `split_reason` are what
  // the engine writes when it records a veto_split audit record; until a row
  // actually carries one, splitOf() returns null and the block below keeps
  // saying the reason was never written down.
  //
  // That fallback is not a placeholder to be tidied away later. Every split
  // that happened BEFORE the audit record existed is genuinely undocumented,
  // and those rows will keep arriving with neither field forever. Rendering a
  // documented-looking sentence for them would retro-claim a decision nobody
  // made — the exact failure this whole block was written to prevent. So the
  // two states are drawn differently and neither one borrows the other's
  // wording: "the engine recorded why" and "nothing was recorded" are
  // different facts with different operator consequences.
  //
  // Absent is (missing | null | ''). A row that carries `split_from` with no
  // `split_reason` is a THIRD state and says so — a recorded split with no
  // recorded reason is still more than silence, and rounding it up to a reason
  // would be inventing one.
  function splitOf(o) {
    if (!o) { return null; }
    function has(v) { return !(v === null || v === undefined || v === ''); }
    var from = o.split_from, reason = o.split_reason;
    if (!has(from) && !has(reason)) { return null; }
    return {
      from: !has(from) ? null : (Array.isArray(from) ? from.filter(has) : [from]),
      reason: !has(reason) ? null : String(reason)
    };
  }

  // The veto is written on the row the engine FORCED NEW (engine.py:1201
  // force_new=vetoed), so only one half of a split pair can carry it. Read
  // from this row AND from every neighbour that names this row, or the older
  // half would render as undocumented while its twin sits directly beneath it
  // fully explained — which is a worse reading than either fact alone.
  //
  // 2026-08-20 — THIS WAS DRAWN FROM INSIDE cohortHTML's shared-phone branch,
  // and QA measured what that cost. The engine vetoes on FOUR signals
  // (engine.py:1234 phone, :1241 name+dob, :1252 shared dob, :1282 wm customer
  // id) and flags BOTH rows `split_by_document` in every one of them
  // (engine.py:1139) — but only the phone case produces a phone cohort. So
  // three of the four vetoes rendered no warning at all: row #6 (wm-id veto)
  // drew the bare token `split_by_document` and NOTHING else, and row #4
  // (name+dob veto) drew the shared-birthday "coincidence" paragraph, which
  // points an operator AT a merge the engine has already recorded as provably
  // wrong. Worse, the block vanished on SEARCH — the cohort is scanned over
  // the rows on this page, filtering to one row empties it, and search is how
  // an operator actually reaches a customer. Measured before this change: 6
  // flagged rows on one page, 2 warnings.
  //
  // So it is now called ONCE PER ROW from memberRowHTML, unconditionally, and
  // every input it needs is ON THE ROW: `flags`, `split_from`, `split_reason`.
  // The page scan is a BONUS — it can name the other half when the other half
  // is on screen — and never a precondition. Nothing asserted here depends on
  // it, and where the scan is all there is, the block says so.
  function splitHTML(P, m, c) {
    var lines = [];
    var mine = splitOf(m);
    if (mine) { lines.push({ subject: 'This row', s: mine }); }
    // SCAN EVERY ROW ON THE PAGE, not just the phone cohort. A wm-id veto and
    // a name+dob veto share no phone at all, so a scan of the phone cohort
    // could never reach the twin that carries the reason.
    ((_page && _page.members) || []).forEach(function (o) {
      if (String(o.identity_id) === String(m.identity_id)) { return; }
      var s = splitOf(o);
      if (!s || !s.from) { return; }
      var pointsHere = s.from.some(function (f) {
        return String(f) === String(m.identity_id);
      });
      if (pointsHere) { lines.push({ subject: who(o), s: { from: null, reason: s.reason } }); }
    });

    // SCOPE OF THE SCAN, stated wherever the scan is the only thing that could
    // have named the other row. A filtered ledger is the case that used to
    // delete this whole block silently, so the filter is named explicitly.
    var scanned = ((_page && _page.members) || []).length;
    var scopeNote = 'The other row is not named here: this endpoint carries no <b>split_from</b>, ' +
      'and the scan for a neighbour that names this row covered only the ' + scanned + ' row' +
      (scanned === 1 ? '' : 's') + ' shown' +
      (_q ? ' — and the ledger is filtered to “' + esc(_q) + '”, so the other half of the ' +
        'split is very likely off screen entirely.' : '.');

    if (!lines.length) {
      // MEASURED IN THE BROWSER 2026-08-19 AND THIS BRANCH WAS WRONG. Two rows
      // split by a document veto came back carrying flags ['split_by_document']
      // — engine.py:1139 flags BOTH sides, and _record_document_veto writes a
      // full `identity_split_veto` row into hw_identity_audit. So "it was never
      // written down" had become a falsehood: it IS written down, in a table
      // /api/identity/members does not read. Three states, not two.
      var flagged = (m.flags || []).indexOf('split_by_document') !== -1;
      if (flagged) {
        return '<div style="margin-top:6px;padding:7px 8px;border-radius:' + P.r8 +
          'px;border:1px dashed ' + (P.warn || P.ink2) + '">' +
          '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
          'text-transform:uppercase;color:' + (P.warn || P.ink2) + ';margin-bottom:3px">' +
          'The split was deliberate · the reason is not on this endpoint</div>' +
          '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5">' +
          'This row carries the flag <b>split_by_document</b>, which the engine sets on BOTH ' +
          'sides when a government document vetoes a weaker match (engine.py:1139). So this row ' +
          'was held apart from at least one other <b>on purpose — do not merge them</b>. ' +
          // WHICH signal was vetoed is NOT claimed. Four rungs can produce this
          // flag and the flag records none of them, so naming one would be an
          // invention — and naming the phone one, which is what drawing this
          // inside the shared-phone block effectively did, is the invention
          // that was actually shipping.
          'Which signal was overruled — a shared phone, a shared name and birthday, a shared ' +
          'birthday alone, or a shared Weedmaps customer id — is not on this row: the flag is ' +
          'the same in all four cases, and this endpoint carries no <b>split_reason</b>. The ' +
          'evidence does exist — the engine writes an <b>identity_split_veto</b> row into ' +
          'hw_identity_audit — and this list cannot read that table. ' + scopeNote +
          '</div></div>';
      }
      // NOT flagged and no fields: nothing about this row says a split ever
      // happened. Worth a sentence only where a concrete pair is on screen to
      // be wrong about — otherwise it would print under every ordinary row and
      // train the operator to skip it.
      if (!c || !c.phone.length) { return ''; }
      return '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
        'margin-top:4px">And nothing HERE records why they were kept apart: no split_reason, and ' +
        'no split_by_document flag either. Do not read the silence as an oversight — but do not ' +
        'read it as a decision either, and do not read it as proof that nothing was recorded ' +
        'anywhere. This list carries neither field; that is all it can say.</div>';
    }

    // THE HEADER AND THE FOOTER ARE PER-LINE-STATE, NOT PER-BOX. QA read the
    // rendered DOM of the split_from-without-split_reason case and found three
    // mutually contradictory sentences in one box: a header asserting the
    // engine recorded WHY, a body saying it did not, and a footer claiming
    // only split_reason rows reach this rendering. An operator who reads
    // headers stopped at "recorded by the engine" — "we were never told"
    // rendered as "we checked and wrote it down", which is the exact swap this
    // file exists to prevent. The body was always right; the frame around it
    // was hard-coded for the best case and was a lie in the other two.
    var withReason = 0;
    lines.forEach(function (L) { if (L.s.reason) { withReason++; } });
    var head = withReason === lines.length
      ? 'Why they were kept apart · recorded by the engine'
      : (withReason === 0
        ? 'The split is recorded · the reason is NOT'
        : 'Why they were kept apart · recorded in part');
    var foot = withReason === lines.length
      ? 'Only rows that carry split_reason read like this. Older splits carry neither field and ' +
        'say so instead — an absent record is never rendered as a decision.'
      : (withReason === 0
        ? 'Nothing in this box is the engine\'s stated reason, because no line here carries a ' +
          'split_reason. split_from alone says a split WAS recorded; it does not say why. A row ' +
          'that carried the reason would print the engine\'s own sentence in its place, and this ' +
          'row does not.'
        : 'Mixed. The lines above that carry a split_reason print the engine\'s own sentence; ' +
          'the ones that do not are a recorded split with no recorded grounds. Those are two ' +
          'different facts and they are not drawn the same way.');

    var h = '<div style="margin-top:6px;padding:7px 8px;border-radius:' + P.r8 +
      'px;border:1px solid ' + (P.warn || P.ink2) + ';background:' + P.surface3 + '">';
    h += '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
      'text-transform:uppercase;color:' + (P.warn || P.ink2) + ';margin-bottom:4px">' +
      esc(head) + '</div>';
    lines.forEach(function (L) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'margin-top:3px"><b style="color:' + P.ink + '">' + esc(L.subject) + '</b>' +
        (L.s.from ? ' was split from ' + esc(L.s.from.map(function (f) { return '#' + f; })
          .join(', ')) : ' records this row as the one it was split from') + '.</div>' +
        // The engine's own sentence, printed verbatim and on its own line.
        // This file writes no reason of its own -- a second copy of the veto
        // wording here is the drift the header warns about.
        (L.s.reason
          ? '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
            'margin-top:2px">' + esc(L.s.reason) + '</div>'
          : '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
            'margin-top:2px">The split is recorded; the reason is not. split_from is present, ' +
            'split_reason is empty — a decision with no stated grounds, which is not the same ' +
            'as a documented one.</div>');
    });
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';line-height:1.45;' +
      'margin-top:5px">' + esc(foot) + '</div>';
    h += '</div>';
    return h;
  }

  function cohortsFor(m) {
    var all = (_page && _page.members) || [];
    var phone = [], dob = [];
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      if (String(o.identity_id) === String(m.identity_id)) { continue; }
      // A null phone is not a shared phone and a null dob is not a shared
      // birthday. Grouping on absence would file every row with no phone into
      // one enormous fictitious household — which is the address bug again,
      // wearing a different field.
      if (m.phone_e164 && o.phone_e164 === m.phone_e164) { phone.push(o); }
      if (m.dob && o.dob === m.dob) { dob.push(o); }
    }
    return { phone: phone, dob: dob, scanned: all.length };
  }

  // Takes the cohort as an argument now: memberRowHTML computes it ONCE and
  // hands the same object to this and to splitHTML, which must run whether or
  // not this block does.
  function cohortHTML(P, m, c) {
    if (!c.phone.length && !c.dob.length) { return ''; }
    var h = '<div style="margin-top:6px;padding:7px 8px;border-radius:' + P.r8 +
      'px;border:1px dashed ' + P.hairline2 + ';background:transparent">';

    if (c.phone.length) {
      h += '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
        'text-transform:uppercase;color:' + (P.warn || P.ink2) + ';margin-bottom:4px">' +
        'Shared phone · held as ' + (c.phone.length + 1) + ' separate people</div>';
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'font-family:' + ff(P.fontMono) + '">' + esc(m.phone_e164) + ' → ' +
        // A run of spaces COLLAPSES in HTML, so joining on whitespace printed
        // "#2 Marcus Vane #1 Tomas Iglesias" — two names with nothing between
        // them, which reads as one person with a strange name. Seen in the
        // browser before this was changed. A visible separator, always.
        esc(c.phone.map(function (o) {
          return who(o) + (o.dob && o.dob !== m.dob ? ' (dob ' + o.dob + ')' : '');
        }).join('  ·  ')) + '</div>';
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'margin-top:4px"><b style="color:' + P.ink + '">Separate rows are the intended outcome ' +
        'here, not a duplicate to tidy up.</b> A household shares a phone — a parent and an ' +
        'adult child, two roommates — so a phone is a hint about an account and never proof of ' +
        'a person. Merging on it is the failure, not the fix.</div>';
      // The one thing that CAN settle it, and where to look — not asserted,
      // because the list endpoint carries no document field at all
      // (identity_api.py:244 _member_row has no gov_id key; only
      // /api/identity/member does). Claiming a document from here would be
      // inventing the only fact that matters.
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
        'margin-top:4px">Only a government document can prove two people are two people. This ' +
        'list does not carry documents — open each row and compare the "Government document" ' +
        'line.</div>';
      // splitHTML USED TO BE CALLED HERE and nowhere else, which is why the
      // veto warning only ever appeared on the shared-phone pair. It is now
      // drawn once per row by memberRowHTML, outside this block entirely.
    }

    if (c.dob.length) {
      var sameLast = c.dob.filter(function (o) {
        return lastWord(o.name) && lastWord(o.name) === lastWord(m.name);
      });
      h += '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
        'text-transform:uppercase;color:' + P.inkMute + ';margin:' +
        (c.phone.length ? '9px 0 4px' : '0 0 4px') + '">Shared date of birth · not a signal</div>';
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'font-family:' + ff(P.fontMono) + '">' + esc(m.dob) + ' → ' +
        esc(c.dob.map(who).join('  ·  ')) + '</div>';
      // THE NUDGE IS WITHDRAWN ONCE THE ENGINE HAS ALREADY RULED. "Worth
      // opening, the shape the matcher comes closest to acting on" is sound
      // advice about an OPEN question — and this exact sentence was rendering
      // on row #4, whose split the engine had already recorded as provably
      // wrong on a document. Pointing an operator at a merge that is already
      // settled against is worse than saying nothing, so where either row
      // carries the veto flag the sentence hands off to the block that
      // explains it instead of inviting the merge.
      var dobVetoed = ((m.flags || []).indexOf('split_by_document') !== -1) ||
        c.dob.some(function (o) { return (o.flags || []).indexOf('split_by_document') !== -1; });
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
        'margin-top:4px">' + (dobVetoed
          ? 'A shared date of birth, and at least one of these rows carries ' +
            '<b>split_by_document</b> — so this is not an open question. A government document ' +
            'has already separated a pair here and the engine recorded the split on purpose. ' +
            'Read the block below before doing anything with this pairing; do NOT treat the ' +
            'shared birthday as a lead.'
          : sameLast.length
          ? 'A shared birthday AND a shared last name. Still not a match on its own — but this ' +
            'is the one pairing worth opening, because it is the shape the matcher comes ' +
            'closest to acting on (wm-demo/wmdemo/engine.py:1126-1133).'
          : 'Different last names. No rung of the matcher acts on a date of birth by itself — ' +
            'every rung that uses one also requires the name ' +
            '(wm-demo/wmdemo/engine.py:1120-1133). People sharing a birthday is a coincidence, ' +
            'and it is drawn here so it is not mistaken for a link.') + '</div>';
    }

    // SCOPE, stated rather than implied. This is a scan of the rows ON THIS
    // PAGE. There is no endpoint that groups the ledger by phone, so a person
    // sharing this number on page 2 produces NOTHING here — and a household
    // block that only sometimes appears, silently, is worse than none.
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';line-height:1.45;' +
      'margin-top:6px">Checked against the ' + c.scanned + ' row' + (c.scanned === 1 ? '' : 's') +
      ' shown on this page only. No endpoint groups the ledger by phone or by date of birth, so ' +
      'a match on another page is not detected here and this block would stay blank.</div>';

    h += '</div>';
    return h;
  }

  // ── ledger ───────────────────────────────────────────────────────────────
  // THE WM_IDS LIST IS THE ANSWER TO THE OWNER'S QUESTION, so it is on the face
  // of the row, in monospace, never behind a click.
  function memberRowHTML(P, m) {
    var t = vtone(P, m.verified ? 'verified' : 'never_checked');
    // CAREFUL: the LIST endpoint carries `verified` + `verification_reason` but
    // not the four-state `state`. A row that was checked and declined is
    // `verified:false` here and would draw as NEVER LOOKED. So the list chip
    // says only what the list knows, and the four states are resolved on the
    // detail (which calls /api/identity/verification). Drawing a confident
    // NEVER LOOKED from a field that cannot distinguish it would be the same
    // bug in a new place.
    var word = m.verified ? 'VERIFIED' : 'NOT VERIFIED';
    var open = String(m.identity_id) === String(_openId);

    var h = '<div style="border:1px solid ' + (open ? P.ink : P.hairline) +
      ';border-left:3px solid ' + t.fg + ';border-radius:' + P.r8 +
      'px;padding:8px 9px;margin-bottom:7px;background:' + P.surface2 + '">';

    h += '<div data-hwi="member" data-id="' + esc(m.identity_id) +
      '" style="display:flex;gap:8px;align-items:baseline;justify-content:space-between;cursor:pointer">' +
      '<div style="font-size:' + P.type.strong + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(m.name || '(no name)') +
      '<span style="font-weight:500;color:' + P.inkFaint + ';font-size:' + P.type.meta +
      'px;font-family:' + ff(P.fontMono) + '"> · #' + esc(m.identity_id) + '</span></div>' +
      chip(P, { fg: t.fg, bg: t.bg }, word) + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';font-family:' +
      ff(P.fontMono) + ';margin-top:1px">' + esc(orNone(m.pos_customer_id, 'no POS id')) +
      ' · ' + esc(orNone(m.phone_e164, 'no phone')) +
      ' · dob ' + esc(orNone(m.dob, 'none — Weedmaps sends none')) + '</div>';

    // The mapping itself.
    h += '<div style="margin-top:6px;padding:6px 7px;border-radius:' + P.r8 +
      'px;background:' + P.surface3 + '">';
    h += '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:4px">' +
      'Weedmaps customer ids mapped to this person</div>';
    if (!m.wm_ids || !m.wm_ids.length) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45">' +
        'none — this identity exists in our ledger but no Weedmaps customer id resolves to it. ' +
        'It came from somewhere other than a Weedmaps order.</div>';
    } else {
      h += '<div style="display:flex;gap:5px;flex-wrap:wrap">';
      m.wm_ids.forEach(function (w) {
        h += '<span style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro +
          'px;padding:2px 6px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 +
          ';color:' + P.ink2 + '">' + esc(w) + '</span>';
      });
      h += '</div>';
      if (m.wm_id_count > 1) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + (P.warn || P.ink2) +
          ';margin-top:4px;font-weight:700">' + m.wm_id_count +
          ' Weedmaps accounts resolved to this ONE person — that merge is what the matcher did, ' +
          'and it is the thing to check first if it looks wrong.</div>';
      }
    }
    h += '</div>';

    // Immediately under the mapping block, because it answers the same
    // question one step out: that block says which Weedmaps accounts folded
    // INTO this person, and this one says which neighbouring people did NOT.
    //
    // TWO CALLS, ONE COHORT, AND ONLY THE FIRST IS CONDITIONAL. cohortHTML
    // draws the household reading and needs a neighbour on this page to have
    // anything to say. splitHTML draws the document-veto warning, which is a
    // fact about THIS ROW's own flags and fields — it must render on a page of
    // one, on a search result, and on a veto that shares neither phone nor
    // date of birth. Nesting the second inside the first is what QA caught.
    var _c = cohortsFor(m);
    h += cohortHTML(P, m, _c);
    h += splitHTML(P, m, _c);

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkMute + ';font-family:' +
      ff(P.fontMono) + ';margin-top:5px">' +
      esc(m.fulfilled_count) + ' fulfilled · first seen ' + esc(ts(m.first_seen_at) || '?') +
      ' · last ' + esc(ts(m.last_seen_at) || '?') + '</div>';

    if (m.flags && m.flags.length) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';margin-top:4px">' +
        esc(m.flags.join(' · ')) + '</div>';
    }

    // CREATED HERE. A first-hand fact — this browser fired the order that made
    // or moved this row — and it is drawn as the strongest of the two synthetic
    // marks because it is the only one that is certain. It is also the LOCAL
    // one: another operator on another machine sees nothing of this list, which
    // is why the form does not lean on it and defaults the name to a prefix the
    // SERVER recognises instead. Both marks, and each one labelled for what it
    // is worth.
    var syn = syntheticMark(m);
    if (syn) {
      var SYN = {
        server: ['SYNTHETIC · FLAGGED BY THE LEDGER',
          'This row carries the ledger\'s own `synthetic` flag, which ' + SIM_PATH +
          ' sets on rows it brought into existence. It is not a real customer, and unlike the ' +
          'badges below this one is on the record — every operator sees it.'],
        minted: ['SYNTHETIC · CREATED FROM THIS PANEL',
          'This row was MINTED by a test order sent from this browser through ' + SIM_PATH +
          ' — the ledger count went up by one. It is not a real customer.'],
        merged: ['A TEST ORDER LANDED HERE',
          'This row already existed and a synthetic order from this browser MERGED into it — ' +
          'the ledger count did not move. The person may be perfectly real; only the order ' +
          'was fake.'],
        unclear: ['A TEST ORDER LANDED HERE · minted or merged unknown',
          'A synthetic order from this browser resolved to this row, but the ledger count ' +
          'could not settle whether it created the row or joined it. Neither is claimed.'],
        wm: ['CARRIES A SYNTHETIC WEEDMAPS ID',
          'One of the Weedmaps ids on this row was minted by this browser. That is a fact ' +
          'about the id, not about the person — this may be a REAL customer a test order ' +
          'attached itself to.']
      }[syn];
      h += '<div style="margin-top:5px;padding:5px 7px;border-radius:' + P.r8 +
        'px;border:1px dashed ' + (P.warn || P.ink2) + '">' +
        chip(P, { fg: P.surface, bg: (P.warn || P.ink2) }, SYN[0]) +
        '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim +
        ';line-height:1.45;margin-top:3px">' + esc(SYN[1]) +
        // THE LOCALITY DISCLAIMER BELONGS ONLY ON THE LOCAL BADGES. It was
        // appended to all of them, including the one read straight off the
        // ledger's own `flags` — so the panel said "this one is on the record,
        // every operator sees it" and then immediately said "recorded by this
        // browser only". Read in the rendered DOM before this was changed.
        (syn === 'server' ? ''
          : ' Recorded by this browser only — the ledger itself carries no such field, so ' +
            'another machine sees none of this.') + '</div></div>';
    }

    // A HINT, labelled as a hint. The API is explicit that null means "cannot
    // tell", not "real", so this never renders as a verdict about the row.
    if (m.likely_fixture) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim +
        ';margin-top:4px;line-height:1.45">Likely test data (hint, not a fact): ' +
        esc(m.fixture_marker) + '</div>';
    }

    if (open) {
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid ' + P.hairline + '">';
      if (_memberErr) {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + '">' +
          esc(_memberErr) + '</div>';
      } else if (!_member) {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + '">loading…</div>';
      } else {
        h += detailHTML(P, _member);
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function detailHTML(P, d) {
    var h = '';
    var g = d.gov_id || {};
    // `means` IS THE ANSWER AND IT WAS BEING THROWN AWAY on exactly the rows
    // where it matters. This printed g.kind when a document was present, so
    // Paolo Marchetti's detail read, in full, "Government document: document" —
    // a tautology — while the API was returning "a real document identity
    // (issuing state + number) — this can match a person and can veto a weaker
    // match" in the field beside it. Worse for the other kind: an upload hash
    // rendered as the bare word "upload_url", which looks like a document on
    // file, when identity_api.py:377-379 says it "identifies an upload, not a
    // human — it never matches and never vetoes". That distinction is the whole
    // reason the two Marchettis are two rows, and it was the one word not shown.
    // `means` is populated in all three branches (identity_api.py:364-379).
    var docKind = g.present ? (g.kind === 'document' ? 'ON FILE · REAL DOCUMENT'
                                                     : 'ON FILE · UPLOAD HASH ONLY')
                            : 'NONE';
    h += '<div style="font-size:' + P.type.meta + 'px;color:' +
      (g.kind === 'document' ? P.ink2 : P.inkDim) +
      ';line-height:1.5;margin-bottom:7px"><b style="color:' + P.ink +
      '">Government document — ' + esc(docKind) + ':</b> ' +
      esc(g.means || (g.present ? 'on file' : 'not present')) + '</div>';

    h += verificationHTML(P, d.verification, d.identity_id);

    if (d.orders && d.orders.length) {
      h += sectionTitle(P, d.order_count + ' order' + (d.order_count === 1 ? '' : 's') +
        (d.order_count_capped ? ' (list capped)' : ''));
      d.orders.forEach(function (o) {
        h += '<div style="display:flex;gap:8px;align-items:center;font-size:' + P.type.micro +
          'px;font-family:' + ff(P.fontMono) + ';color:' + P.ink2 + ';line-height:1.9">' +
          '<span style="flex:0 0 84px">' + esc(o.wm_order_id) + '</span>' +
          '<span style="flex:0 0 92px;color:' + P.inkMute + '">' + esc(o.status) + '</span>' +
          '<span style="flex:0 0 60px;color:' + P.inkMute + '">' + esc(o.fulfillment_type) + '</span>' +
          '<button data-hwi="match" data-order="' + esc(o.wm_order_id) + '" style="' +
          btnCSS(P) + 'min-height:22px;font-size:' + P.type.micro + 'px">match →</button></div>';
      });
    }
    return h;
  }

  // ── order match ──────────────────────────────────────────────────────────
  function matchHTML(P) {
    var h = '';
    h += '<div style="display:flex;gap:6px;margin-bottom:9px">' +
      '<input data-hwi-order placeholder="Weedmaps order id" value="' + esc(_matchId) +
      '" style="' + ctlCSS(P) + 'flex:1 1 auto">' +
      '<button data-hwi="do-match" style="' + btnCSS(P, true) + '">' +
      (_busy ? 'working…' : 'Match') + '</button></div>';

    if (_matchErr) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5">' +
        esc(_matchErr) + '</div>';
    }
    if (!_match) {
      if (!_matchErr) {
        h += note(P, 'Enter a Weedmaps order id, or open a person in the Ledger tab and click ' +
          '"match" on one of their orders. This is the per-order question: which identity did ' +
          'THIS order resolve to, at what tier, on what evidence.');
      }
      return h;
    }
    var m = _match;
    if (!m.found) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5">' +
        'No order ' + esc(m.wm_order_id) + ' in the store. Nothing was matched, and nothing is ' +
        'being guessed here.</div>';
      return h;
    }

    var mm = m.match || {};
    // THE TIER LABEL IS THE API'S. This file holds no copy of the ladder's
    // wording, and that is deliberate: tier 4 reads "Same Weedmaps account — an
    // account, not proof of a person" precisely because a household can share
    // one Weedmaps login, and a UI that shortens it to "same customer" has told
    // the operator something false. A second copy of these strings here is how
    // that shortening happens six months from now.
    var strong = mm.tier === 0 || mm.tier === 1;
    var tt = mm.state === 'new' ? { fg: P.neutral, bg: P.neutralSoft }
           : strong ? { fg: P.good, bg: P.goodSoft }
           : { fg: P.warn || P.ink, bg: P.warnSoft || P.neutralSoft };

    h += '<div style="border:1px solid ' + tt.fg + ';border-left:3px solid ' + tt.fg +
      ';border-radius:' + P.r8 + 'px;padding:9px;margin-bottom:8px;background:' + P.surface2 + '">';
    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<span style="font-size:' + P.type.strong + 'px;font-weight:800;color:' + P.ink +
      '">Order ' + esc(m.wm_order_id) + '</span>' +
      chip(P, tt, 'TIER ' + esc(mm.tier) + ' · ' + esc(mm.state)) + '</div>';
    h += '<div style="font-size:' + P.type.body + 'px;font-weight:700;color:' + tt.fg +
      ';line-height:1.45;margin-top:5px">' + esc(mm.tier_label) + '</div>';

    if (mm.identity_id != null) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';margin-top:4px">' +
        'resolved to identity <b style="font-family:' + ff(P.fontMono) + '">#' +
        esc(mm.identity_id) + '</b> — ' + esc((m.ours && m.ours.name) || '(no name)') + '</div>';
    }

    if (mm.evidence && mm.evidence.length) {
      h += sectionTitle(P, 'Evidence the ladder used');
      mm.evidence.forEach(function (e) { h += note(P, e); });
    }
    if (mm.vetoed_by_document) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5;' +
        'margin-top:4px">' + esc(mm.veto_note || 'a government document vetoed this match') + '</div>';
    }
    // Drawn UNDER ITS OWN HEADING, not appended to the evidence list. Appended
    // there it read as a fifth piece of evidence for the match, which is the
    // exact inversion of what the sentence says.
    if (mm.address_note) {
      h += sectionTitle(P, 'Not evidence, and never will be');
      h += note(P, mm.address_note);
    }
    h += '</div>';

    // The two sides, so "mapping members from Weedmaps into our system" is a
    // thing you can SEE rather than a thing you are told happened.
    var wm = m.weedmaps || {}, ours = m.ours || {};
    h += sectionTitle(P, 'What Weedmaps sent  →  what we hold');
    h += '<div style="display:flex;gap:8px">';
    h += '<div style="flex:1 1 0;min-width:0;border:1px solid ' + P.hairline2 + ';border-radius:' +
      P.r8 + 'px;padding:7px 8px"><div style="font-size:' + P.type.micro +
      'px;font-weight:800;color:' + P.inkMute + ';margin-bottom:4px">WEEDMAPS</div>' +
      kv(P, 'customer', orNone(wm.customer_id), true) +
      kv(P, 'name', orNone((wm.first_name || '') + ' ' + (wm.last_name || '')).trim()) +
      kv(P, 'phone', orNone(wm.phone_e164 || wm.phone_raw), true) +
      kv(P, 'dob', orNone(wm.dob, 'none sent'), true) +
      kv(P, 'email', orNone(wm.email, 'none sent'), true) + '</div>';
    h += '<div style="flex:1 1 0;min-width:0;border:1px solid ' + P.hairline2 + ';border-radius:' +
      P.r8 + 'px;padding:7px 8px"><div style="font-size:' + P.type.micro +
      'px;font-weight:800;color:' + P.inkMute + ';margin-bottom:4px">OURS</div>' +
      kv(P, 'identity', orNone(ours.identity_id), true) +
      kv(P, 'POS id', orNone(ours.pos_customer_id), true) +
      kv(P, 'name', orNone(ours.name)) +
      kv(P, 'phone', orNone(ours.phone_e164), true) +
      kv(P, 'dob', orNone(ours.dob, 'none'), true) + '</div>';
    h += '</div>';

    if (wm.absent && wm.absent.length) {
      h += '<div style="margin-top:6px">' +
        gap(P, 'Absent from the Weedmaps payload: ' + wm.absent.join(', '), wm.absent_reason) +
        '</div>';
    }

    if (ours.wm_ids && ours.wm_ids.length) {
      h += sectionTitle(P, 'All Weedmaps ids on this person');
      h += '<div style="display:flex;gap:5px;flex-wrap:wrap">';
      ours.wm_ids.forEach(function (w) {
        var isThis = String(w) === String(wm.customer_id);
        h += '<span style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro +
          'px;padding:2px 6px;border-radius:' + P.r8 + 'px;border:1px solid ' +
          (isThis ? P.ink : P.hairline2) + ';color:' + (isThis ? P.ink : P.inkMute) +
          ';font-weight:' + (isThis ? '800' : '500') + '">' + esc(w) +
          (isThis ? ' ← this order' : '') + '</span>';
      });
      h += '</div>';
    }

    // The stored mapping row, and the trap in it.
    var map = m.wm_mapping;
    h += sectionTitle(P, 'Stored wm_customer_mapping row');
    if (!map) {
      h += note(P, 'no mapping row is stored for this Weedmaps customer id.');
    } else {
      h += kv(P, 'wm customer', orNone(map.wm_customer_id), true);
      h += kv(P, 'mapped to', orNone(map.pos_customer_id), true);
      h += kv(P, 'first seen', ts(map.first_seen_at) || '?', true);
      // THE HARD RULE: this stored number is NOT the ladder's tier. Rendering
      // it through TIER_LABEL would print "Government document — exact" for
      // someone who has never shown ID, because the ingest path hardcodes 0.
      // So the raw number is shown as a raw number, explicitly disowned, and
      // never near a label.
      if (map.match_tier_is_unreliable) {
        h += '<div style="border:1px solid ' + (P.warn || P.bad) + ';border-radius:' + P.r8 +
          'px;padding:7px 9px;margin-top:6px;background:' + (P.warnSoft || P.badSoft) + '">' +
          '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;color:' +
          (P.warn || P.bad) + '">STORED match_tier = ' + esc(map.match_tier_at_mapping) +
          ' · NOT A MATCH STRENGTH</div>' +
          '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;' +
          'margin-top:3px">' + esc(map.match_tier_note) + '</div>' +
          '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;' +
          'margin-top:3px">Read as a tier it would print "' +
          esc(mm.tier_label && map.match_tier_at_mapping === 0 ? 'Government document — exact'
              : 'a label nobody earned') +
          '" for a person who may never have shown ID. The tier above is the recomputed one and ' +
          'is the only one to trust.</div></div>';
      } else {
        h += kv(P, 'stored tier', String(map.match_tier_at_mapping), true);
      }
    }

    // Stored vs recomputed.
    var st = m.stored;
    if (st) {
      h += sectionTitle(P, 'Verdict recorded at ingest vs recomputed now');
      if (st.agrees_with_recomputed) {
        h += note(P, 'they agree: identity #' + st.identity_id + '. ' + st.note);
      } else {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5">' +
          esc(st.disagreement_reason || 'the stored verdict and the recomputed one disagree') +
          '</div>';
      }
    }

    // Fraud + the gaps. This is the block the Orders screen gets wrong.
    var f = m.fraud || {}, gp = m.gaps || {};
    h += sectionTitle(P, 'Fraud check');
    h += kv(P, 'action', orNone(f.action), true);
    // `reason` and `reason_note` are two different sentences and only one of
    // them is ever populated: a real reason when the matrix ran, the note
    // explaining why it did not when it did not. Printing both put the same
    // sentence on screen twice, which reads as two independent confirmations.
    if (f.reason) { h += kv(P, 'reason', f.reason); }
    else { h += note(P, f.reason_note || 'the API gave no reason and no note for this action.'); }
    h += '<div style="margin-top:6px">';
    h += gap(P, 'Risk score', gp.risk_reason || f.risk_reason);
    h += gap(P, 'Per-field checks (ID / name / phone / address)',
             gp.checks_reason || f.checks_reason);
    h += gap(P, 'Match confidence', gp.match_confidence_reason);
    h += gap(P, 'Candidate list ("two customers match, pick one")',
             gp.match_candidates_reason);
    h += '</div>';

    h += verificationHTML(P, m.verification, mm.identity_id);

    h += '<div style="margin-top:6px">' +
      kv(P, 'payload', String(m.payload_source) +
         (m.payload_source_note ? ' — ' + m.payload_source_note : ''), true) +
      kv(P, 'signature', m.signature_verified ? 'verified' : 'NOT verified', true) + '</div>';
    return h;
  }

  // ── panel ────────────────────────────────────────────────────────────────
  // ── the test-customer form ───────────────────────────────────────────────
  function simField(P, key, label, hint, mono) {
    return '<div style="margin-bottom:7px">' +
      '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:2px">' + esc(label) +
      '</div>' +
      '<input data-hwi-sim="' + key + '" value="' + esc(_sim[key]) + '" style="' + ctlCSS(P) +
      'width:100%;box-sizing:border-box' + (mono ? ';font-family:' + ff(P.fontMono) : '') + '">' +
      (hint ? '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint +
        ';line-height:1.45;margin-top:2px">' + esc(hint) + '</div>' : '') +
      '</div>';
  }

  function simSelect(P, key, label, opts, hint) {
    var h = '<div style="margin-bottom:7px">' +
      '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:2px">' + esc(label) +
      '</div><select data-hwi-sim="' + key + '" data-hwi-sim-repaint="1" style="' + ctlCSS(P) +
      'width:100%;box-sizing:border-box">';
    opts.forEach(function (o) {
      h += '<option value="' + esc(o[0]) + '"' +
        (String(_sim[key]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    h += '</select>' + (hint ? '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint +
      ';line-height:1.45;margin-top:2px">' + esc(hint) + '</div>' : '') + '</div>';
    return h;
  }

  // EVERY LINE HERE IS THE ROUTE'S OWN ANSWER. create_customer states
  // minted-vs-merged itself (`created_new_identity`, from first_seen_at), says
  // whether it flagged the row, returns the recomputed ladder AND what ingest
  // stored, and returns the verification gate's decision so that "created" is
  // never mistaken for "checked". Nothing is re-derived here, and a null is
  // drawn as a null with the route's reason beside it.
  function simVerdictHTML(P, r) {
    var h = '';
    h += sectionTitle(P, 'What the ladder did with it');
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
      'font-family:' + ff(P.fontMono) + ';margin-bottom:6px">HTTP ' + esc(r.code) +
      ' · order ' + esc(orNone(r.order_id, 'none returned')) + ' · ' + esc(r.fulfillment) +
      ' · doc ' + esc(r.doc_mode) +
      (r.waited_s != null ? ' · waited ' + esc(r.waited_s) + 's' : '') + '</div>';

    if (r.pending) {
      h += '<div style="border:1px solid ' + (P.warn || P.bad) + ';border-radius:' + P.r8 +
        'px;padding:8px 9px;margin-bottom:7px;background:' + P.surface2 + '">' +
        chip(P, { fg: P.surface, bg: (P.warn || P.bad) }, 'ACCEPTED · NO IDENTITY YET') +
        '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'margin-top:5px">' + esc(r.reason ||
          'the route answered 202 and gave no reason, which is itself worth reporting') +
        '</div></div>';
      return h;
    }

    // 1. MINTED OR MERGED — stated by the route, never inferred from the
    //    recomputed match state. order_match re-resolves AFTER ingest has
    //    written, so a row minted seconds ago comes back as `existing`, and
    //    reading that as "merged into somebody" is the falsehood this whole
    //    block exists to avoid.
    var t = vtone(P, 'never_checked');
    if (r.created_new === true) {
      h += '<div style="border:1px solid ' + P.ink + ';border-radius:' + P.r8 +
        'px;padding:8px 9px;margin-bottom:7px;background:' + P.surface2 + '">' +
        chip(P, { fg: P.surface, bg: P.ink }, 'MINTED A NEW IDENTITY') +
        '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'margin-top:5px">Nothing on the ladder matched this arrival, so it became a new person. ' +
        // THREE STATES, NOT TWO. `flagged_synthetic === false` is a route that
        // checked and says no; ABSENT is a route that never told us. The old
        // `r.flagged === true ? ... : ...` collapsed absent into false and
        // asserted "It was NOT flagged synthetic" about a payload that had
        // said nothing at all — QA proved it with a stub that omitted the key.
        // server.py:1712/1731/1745 always sets it today, so this is one
        // deployment skew away rather than live, and that is exactly when a
        // panel starts lying quietly.
        (r.flagged === true
          ? 'The row carries the ledger\'s own `synthetic` flag, so every operator can see it is ' +
            'test data.'
          : r.flagged === false
          ? 'It was NOT flagged synthetic: ' + esc(r.flag_note ||
            'the route did not say why, which is itself worth reporting') +
            ' Until that is fixed the row is indistinguishable from a real customer.'
          : 'Whether it was flagged synthetic is NOT KNOWN: the response carried no ' +
            '`flagged_synthetic` at all, so this panel cannot tell you either way — and an ' +
            'absent field is not a "no". Check the row\'s flags in the ledger below before ' +
            'assuming this row is distinguishable from a real customer.') +
        '</div></div>';
    } else if (r.created_new === false) {
      h += '<div style="border:1px solid ' + t.fg + ';border-radius:' + P.r8 +
        'px;padding:8px 9px;margin-bottom:7px;background:' + P.surface2 + '">' +
        chip(P, t, 'MERGED INTO AN EXISTING IDENTITY') +
        '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'margin-top:5px">The ladder matched rather than minted, so nobody new was created — ' +
        'that is the matcher working, not a failure. ' +
        // SAME BUG, OTHER BRANCH. `r.flag_note || 'The row was not flagged
        // synthetic.'` fabricated a verdict out of a missing note: QA stubbed
        // {created_new_identity:false, flagged_synthetic:true} with no
        // flag_note and the panel printed "The row was not flagged synthetic"
        // straight over the top of a payload that said the opposite. The note
        // is printed when it exists; otherwise the flag itself is reported,
        // and an absent flag is reported as absent.
        esc(r.flag_note ||
          (r.flagged === true
            ? 'No flag_note came back, and the route reports flagged_synthetic TRUE on a merge — ' +
              'so a pre-existing row has been marked test data. That is worth checking: it is ' +
              'the shape that labels a real customer synthetic.'
            : r.flagged === false
            ? 'The route reports flagged_synthetic false and sent no note explaining it. Not ' +
              'flagging a row that already existed is the intended behaviour here, but the ' +
              'route normally says so in flag_note and this time did not.'
            : 'The route said nothing about flagging: no flag_note and no flagged_synthetic in ' +
              'the response. Whether this row carries the synthetic flag is unknown from here — ' +
              'not "no".')) + '</div></div>';
    } else {
      h += gap(P, 'Minted or merged', r.reason ||
        'the route returned created_new_identity as null and gave no reason for it. It is NOT ' +
        'being inferred from the recomputed match state, which cannot tell the two apart.');
    }

    // 2. WHICH RUNG FIRED. The route's own tier label and evidence sentences,
    //    printed verbatim — this file owns no tier vocabulary.
    if (r.ladder_error) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5;' +
        'margin-bottom:6px">' + esc(r.ladder_error) + '</div>';
    } else if (!r.ladder) {
      h += gap(P, 'The rung that fired',
        'the route returned no ladder block and no error explaining its absence.');
    } else {
      var L = r.ladder;
      h += kv(P, 'tier', (L.tier == null ? 'none' : L.tier) + ' · ' +
        orNone(L.tier_label, 'no label from the API'), true);
      h += kv(P, 'state', orNone(L.state) + ' (recomputed)', true);
      h += kv(P, 'identity', L.identity_id == null ? 'none' : '#' + L.identity_id, true);
      h += kv(P, 'ingest stored', L.stored_by_ingest == null
        ? 'nothing recorded on the order' : '#' + L.stored_by_ingest, true);
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
        'margin-top:5px"><b style="color:' + P.ink + '">Why: </b>' +
        ((L.evidence && L.evidence.length)
          ? esc(L.evidence.join(' · '))
          : 'nothing on this order matched any rung — no document, no phone, no name+dob, no ' +
            'Weedmaps customer id already on file.') + '</div>';
      if (L.note) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint +
          ';line-height:1.45;margin-top:4px">' + esc(L.note) + '</div>';
      }
      if (L.vetoed_by_document) {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + (P.warn || P.bad) +
          ';line-height:1.5;margin-top:5px"><b>Vetoed by document.</b> A government document ' +
          'refused a weaker match, so this arrival was kept apart on purpose.</div>';
      }
    }

    // 3. CREATING SOMEBODY IS NOT CHECKING THEIR ID, and the route returns the
    //    gate decision so nobody has to assume it.
    var v = r.verification;
    if (v) {
      h += sectionTitle(P, 'Are they verified?');
      if (v.error) {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5">' +
          esc(v.error) + '</div>';
      } else {
        var vt = vtone(P, v.state);
        h += chip(P, vt, vt.word);
        var ph = v.pickup_handoff || {};
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
          'margin-top:5px">' + esc(v.note || '') + '</div>';
        h += '<div style="margin-top:5px">' +
          kv(P, 'handoff', ph.allowed ? 'allowed' : 'BLOCKED' +
            (ph.block_code ? ' · ' + ph.block_code : ''), true) + '</div>';
        if (ph.reason) {
          h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
            'margin-top:3px">' + esc(ph.reason) + '</div>';
        }
        if (ph.remedy) {
          h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
            'margin-top:3px"><b>Remedy: </b>' + esc(ph.remedy) + '</div>';
        }
      }
    }

    var ours = r.identity;
    if (ours && ours.error) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5;' +
        'margin-top:6px">' + esc(ours.error) + '</div>';
    } else if (ours && ours.identity_id != null) {
      h += sectionTitle(P, 'The row it landed on');
      h += kv(P, 'identity', '#' + ours.identity_id, true);
      h += kv(P, 'name', orNone(ours.name, 'no name'));
      h += kv(P, 'phone', orNone(ours.phone_e164, 'none'), true);
      h += kv(P, 'dob', orNone(ours.dob, 'none'), true);
      h += kv(P, 'wm ids', (ours.wm_ids && ours.wm_ids.length)
        ? ours.wm_ids.join('  ·  ') : 'none', true);
      h += kv(P, 'flags', (ours.flags && ours.flags.length)
        ? ours.flags.join('  ·  ') : 'none', true);
      h += kv(P, 'document', (ours.gov_id && ours.gov_id.means) || 'unknown');
      h += '<div style="margin-top:6px"><button data-hwi="sim-show" style="' + btnCSS(P) +
        '">Show it in the ledger →</button></div>';
    }

    if (r.path_note) { h += note(P, r.path_note); }
    return h;
  }

  function simHTML(P) {
    seedSim();
    var h = '';
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
      'margin-bottom:8px">POST ' + esc(SIM_PATH) + ' synthesises an arriving Weedmaps order ' +
      'from these fields and fires it at our own HMAC-signed webhook — the same door, the same ' +
      'receiver, the same async ingest, the same 5-tier ladder. It does NOT write the ledger, ' +
      'so the identity falls out of the far end exactly the way a live one does. Which means ' +
      'the ladder may merge this order into somebody who already exists instead of minting ' +
      'anyone: that is the matcher working, and it is reported as such.</div>';

    if (_sim.fromPhone || _sim.fromDob) {
      h += note(P, 'The defaults are deliberately messy and borrowed from rows on this page: ' +
        (_sim.fromPhone ? 'phone from ' + _sim.fromPhone + '. ' : '') +
        (_sim.fromDob ? 'date of birth and surname from ' + _sim.fromDob + '. ' : '') +
        'A clean customer mints a fresh row every time and leaves every rung of the ladder dark.');
    } else {
      h += note(P, 'The ledger page has not loaded, so no real phone or date of birth could be ' +
        'borrowed. Those two fields are BLANK rather than filled with an invented number — a ' +
        'made-up collision would only be testing this panel against itself.');
    }

    // ACTOR IS REQUIRED BY THE ROUTE and it refuses without one, because
    // nothing in this database records who created an identity row — that gap
    // is why its own fixture answer has to be a heuristic. The default names
    // this panel rather than pretending to be a person; put your own name in
    // and the row's provenance stops being "a browser".
    h += simField(P, 'actor', 'Created by (required)',
      'The route refuses without this. Nothing else in the ledger records who made a row, so ' +
      'this is the only provenance the customer will ever carry.');
    h += simField(P, 'first_name', 'First name',
      'QAID… is one of the API\'s own fixture prefixes, so the server marks this row as test ' +
      'data for every operator. The route also flags rows it creates `synthetic` on the ledger ' +
      'itself, which does not depend on the name at all.');
    h += simField(P, 'last_name', 'Last name',
      _sim.fromLast ? 'Borrowed from ' + _sim.fromLast + ' — shared surname + shared birthday ' +
        'is the pairing the dob-fuzzy rung comes closest to acting on.' : null);
    h += simField(P, 'phone', 'Phone',
      'Blank is sent as an empty string, which means "Weedmaps sent no phone" — not "use the ' +
      'default". That is the case that mints rows the ladder can never re-find.', true);
    h += simField(P, 'dob', 'Date of birth (YYYY-MM-DD)',
      'Blank means Weedmaps sent none, which is the normal case for a delivery order.', true);
    h += simField(P, 'wm_customer_id', 'Weedmaps customer id',
      'A non-numeric id is what the API reads as synthetic — real Weedmaps customer ids are ' +
      'numeric (identity_api.py:239). Blank sends no id at all.', true);

    h += simSelect(P, 'doc', 'Government document', [
      ['none', 'None — nothing attached'],
      ['upload', 'Upload URL only — identifies an upload, not a human'],
      ['document', 'Real document — issuing state + number']
    ], 'Only the third can match at tier 0 or veto a weaker match. The second hashes a URL and ' +
       'is deliberately non-comparable, which is why it can do neither.');
    if (_sim.doc === 'document') {
      h += simField(P, 'doc_state', 'Issuing state', null, true);
      h += simField(P, 'doc_number', 'Document number',
        'Paste another row\'s number to test a tier-0 match; leave this unique to test the ' +
        'veto against a shared phone.', true);
    } else if (_sim.doc === 'upload') {
      h += simField(P, 'doc_url', 'Document URL', null, true);
    }

    h += simSelect(P, 'fulfillment', 'Fulfillment', [
      ['delivery', 'Delivery'], ['pickup', 'Pickup']
    ], 'Pickup arrives on the dispensary listing with an empty shipping address.');

    h += '<div style="display:flex;gap:6px;margin:9px 0 4px">' +
      '<button data-hwi="sim-run" style="' + btnCSS(P, true) + '">' +
      (_simBusy ? 'working…' : 'Send it as a Weedmaps order') + '</button>' +
      '<button data-hwi="sim-reseed" style="' + btnCSS(P) + '">New messy defaults</button></div>';

    if (_simErr) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.5;' +
        'margin-top:6px">' + esc(_simErr) + '</div>';
    }
    if (_simResult) { h += simVerdictHTML(P, _simResult); }

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';line-height:1.45;' +
      'margin-top:9px">A row this creates carries the ledger\'s own <b>synthetic</b> flag, which ' +
      'every operator on every machine sees. A row it merely MERGED INTO is deliberately not ' +
      'flagged — labelling a customer who already existed as a test record would be the same ' +
      'lie pointing the other way — so those are marked from a list this browser keeps, and the ' +
      'badge says which of the two it is.</div>';
    return h;
  }

  function panelHTML(P) {
    // The title now lives in the docked panel's own header, where it stays put
    // while the body scrolls.
    var h = '';

    if (_status !== 'live') {
      h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        (_status === 'pending' || _status === 'slow'
          ? 'Asking ' + esc(base) + '/api/identity/members…'
          : 'No identity API at ' + esc(base) + '. Nothing on this panel is being ' +
            'substituted from the mock — the ledger is simply not known here.') + '</div>';
      return h;
    }

    // THE HEADLINE NUMBER. Read from the API's own verification_totals every
    // paint. Not a constant in this file: a hardcoded "0 of 469" would be a
    // lie the first time somebody verifies a person, and it is already wrong —
    // the ledger holds 474.
    var T = _totals || {};
    var identities = T.identities, live = T.verified_live, lapsed = T.verified_lapsed;
    var unver = T.unverified;
    // COLOUR IS A CLAIM, and this box was making one that its own sentence
    // denied. It drew P.bad / P.badSoft whenever verified_live was 0 — measured
    // in the browser on the deployment 2026-08-19, border rgb(192,57,43) around
    // the words "0 of 8", wrapped around the sentence "That is the correct
    // state, not a failed check". A red alarm frame is read before any prose
    // inside it, so the panel announced a fault and then spent a paragraph
    // arguing with itself, and a panel that LOOKS broken is reported as broken
    // however carefully it is worded. That is the likeliest reason this screen
    // reads as "not built out".
    //
    // Red is now spent on the one state that is actually a failure: a
    // verification we DID run and that has since LAPSED — a document checked
    // and now expired, i.e. somebody who reads as cleared and is not. Nobody
    // has been checked yet is neutral, because that is precisely what the
    // sentence inside says it is.
    var alarm = !!lapsed;
    h += '<div style="border:1px solid ' + (alarm ? P.bad : P.hairline2) + ';border-radius:' +
      P.r8 + 'px;padding:9px;margin-bottom:9px;background:' +
      (alarm ? P.badSoft : P.surface2) + '">' +
      '<div style="font-size:' + P.type.h2 + 'px;font-weight:800;font-family:' + ff(P.fontMono) +
      ';color:' + (alarm ? P.bad : P.ink) + '">' + esc(live) + ' of ' + esc(identities) +
      '</div>' +
      '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;' +
      'margin-top:2px">identities have a live verification. ' + esc(unver) +
      ' have none' + (lapsed ? ', and ' + esc(lapsed) + ' have one that has lapsed' : '') +
      '. Weedmaps sends no document and no date of birth on its own, so every person who ' +
      'arrived through a Weedmaps order starts unverified. That is the correct state, not a ' +
      'failed check — and it is also the reason nobody in this ledger is cleared for a ' +
      'delivery on ID grounds.</div></div>';

    // tabs
    h += '<div style="display:flex;gap:6px;margin-bottom:8px">';
    [['ledger', 'Ledger'], ['match', 'Order match'],
     ['simulate', 'New test customer']].forEach(function (t) {
      var on = _tab === t[0];
      h += '<button data-hwi="tab" data-tab="' + t[0] + '" style="' + btnCSS(P, on) + '">' +
        esc(t[1]) + '</button>';
    });
    h += '</div>';

    if (_msg) {
      h += '<div style="margin-bottom:8px;font-size:' + P.type.meta + 'px;line-height:1.45;' +
        'font-family:' + ff(P.fontMono) + ';color:' + (_msgOk ? P.ink2 : P.bad) + '">' +
        esc(_msg) + '</div>';
    }

    if (_tab === 'match') {
      h += matchHTML(P);
    } else if (_tab === 'simulate') {
      h += simHTML(P);
    } else {
      h += '<div style="display:flex;gap:6px;margin-bottom:8px">' +
        // THE PLACEHOLDER USED TO SAY "or Weedmaps customer id" AND IT DOES NOT
        // WORK. Measured 2026-08-19 against a running API: q=qa-t-188445969
        // (a Weedmaps id sitting on identity #1904) returns 0 rows, while
        // q=QAIDMgDst188445969 returns that same row. store.search_identities
        // (wm-demo/wmdemo/store.py) matches phone digits, first_name,
        // last_name and pos_customer_id — wm_ids is not in the list, and
        // identity_api.members() has no other path. So the panel was inviting
        // an operator to paste the ONE identifier the whole panel is about and
        // then telling them "nothing in the ledger matches", which reads as a
        // lost customer rather than an unsupported search.
        '<input data-hwi-q placeholder="name, phone, or POS customer id" value="' +
        esc(_q) + '" style="' + ctlCSS(P) + 'flex:1 1 auto">' +
        '<button data-hwi="search" style="' + btnCSS(P, true) + '">Search</button></div>' +
        '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';line-height:1.45;' +
        'margin:-3px 0 7px">There is no search by Weedmaps customer id — the ledger search ' +
        'matches phone digits, first name, last name and POS id only. A Weedmaps id typed here ' +
        'returns nothing, and that is the search saying no, not the ledger.</div>';

      var mem = (_page && _page.members) || [];
      var total = _page ? _page.total : null;
      if (total == null && _page && _page.total_reason) {
        h += note(P, 'No total for this view: ' + _page.total_reason);
      }
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkMute + ';font-family:' +
        ff(P.fontMono) + ';margin-bottom:6px">showing ' + (_offset + (mem.length ? 1 : 0)) +
        '–' + (_offset + mem.length) + (total != null ? ' of ' + total : '') + '</div>';

      if (!mem.length) {
        h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
          (_q ? 'Nothing in the ledger matches “' + esc(_q) + '”.'
              : 'The ledger is empty. No Weedmaps customer has ever been mapped into our system.') +
          '</div>';
      }
      mem.forEach(function (m) { h += memberRowHTML(P, m); });

      h += '<div style="display:flex;gap:6px;margin-top:4px">' +
        '<button data-hwi="prev" style="' + btnCSS(P) + (_offset ? '' : 'opacity:.4;') +
        '">← previous</button>' +
        '<button data-hwi="next" style="' + btnCSS(P) +
        (mem.length < PAGE ? 'opacity:.4;' : '') + '">next →</button></div>';

      if (_page && _page.fixture_note) {
        h += '<div style="margin-top:8px">' + note(P, _page.fixture_note) + '</div>';
      }
    }

    // ── what is still not true, said here rather than left to be discovered ──
    // Behind the WHY toggle, not deleted: five paragraphs opening on top of the
    // ledger they describe is how this panel stopped being read at all.
    var w = '', wn = 0;
    function w_(s) { w += note(P, s); wn++; }
    w_('THE MEMBERS SCREEN IS UNTOUCHED. pos/data.jsx:58 still holds five invented ' +
      'people (Harshil, Manisha, Girish, Dony, Joseph) and they still drive the Members list, ' +
      'the Register customer card and check-in. This panel is the real ledger; those five are ' +
      'not in it.');
    w_('Why it was not overwritten: MEMBERS rows are consumed with no null guard — ' +
      'pos/screen-stubs.jsx:48 and pos/screen-register.jsx:349 and :800 all call ' +
      'm.points.toLocaleString(). A real identity has no loyalty balance (this API has no ' +
      'loyalty data at all), so writing the ledger in would either throw and white-screen the ' +
      'Members screen, or print "0 pts · $0.00 wallet" for every person — a balance nobody ' +
      'computed. Wiring it properly is a screen change: read window.HW.IDENTITY.members and ' +
      'drop the points and wallet columns, because there is nothing behind them.');
    w_('THE ORDERS SCREEN IS ALSO UNTOUCHED, and it is the one that reads falsely. ' +
      'pos/screen-orders.jsx:1258-1276 ("Identity & fraud check") draws "score {wm.risk}/100" ' +
      'with a filled progress bar and four per-field badges, all from pos/data.jsx:220 WM_ORDER. ' +
      'No risk model exists — wm-demo/wmdemo/engine.py:1260 evaluate_fraud returns (action, ' +
      'reason) and nothing else — and no per-field verification model exists at all. A bar and ' +
      'a badge ARE the claim that a check ran, so no value fed into that screen could make it ' +
      'honest; the fold has to change. The honest version of that block is the "Fraud check" ' +
      'section on the Order match tab here.');
    w_('pos/verification.jsx:34-38 draws a T0/T1/T2 assurance ladder whose T2 is ' +
      'SMS-proved phone ownership. Nothing in this codebase sends or checks that code, so no ' +
      'order in this system can honestly be described as account-bound, and T2 is unreachable.');
    w_('Everything on THIS panel comes from /api/identity/*. This file contains no ' +
      'tier labels, no state names and no reason sentences of its own — every one of them is ' +
      'the API\'s own string, printed verbatim. A second copy here is exactly the drift that ' +
      'turns "Same Weedmaps account — an account, not proof of a person" into "same customer".');
    h += whyBlock(P, 'data-hwi', _why, w, wn);
    return h;
  }

  // pos/tokens.jsx is a text/babel script: on a cold load Babel needs seconds
  // to compile it while /api answers in milliseconds, so the FIRST paint almost
  // always runs before window.THEMES exists. Bailing out there and never trying
  // again is how the taxonomy panel rendered nothing at all while its status
  // said `live` — a seam that cannot visibly fail is the same shape as a check
  // that cannot fail.
  var _waitingForTokens = false;
  function paintWhenThemed() {
    if (_waitingForTokens) { return; }
    _waitingForTokens = true;
    var tries = 0;
    (function tick() {
      if (!armed) { return; }
      if (W.THEMES && document.body) { _waitingForTokens = false; paint(); return; }
      if (tries++ > 300) { _waitingForTokens = false; return; }   // ~45s, then stop
      setTimeout(tick, 150);
    })();
  }

  function paint() {
    if (!armed) { return; }
    var P = palette();
    if (!P) { paintWhenThemed(); return; }   // no tokens yet -> wait, never a hex here
    var D = dock();
    if (!D) { paintWhenThemed(); return; }   // no document.body yet

    if (!_el) {
      // The pill goes in the SHARED TRAY; the panel is its SIBLING, pinned to
      // the dock. Before, the panel was the pill's own previous sibling inside
      // one fixed box, so opening it grew that box upward and shoved the other
      // three seams around -- which is exactly how THIS panel became
      // unreachable earlier this week.
      _el = document.createElement('div');
      _el.id = 'hw-identity-badge';
      _el.style.cssText = 'display:flex;pointer-events:none';
      D.tray().appendChild(_el);

      _panel = document.createElement('div');
      _panel.id = 'hw-identity-panel';
      _panel.setAttribute('role', 'dialog');
      _panel.setAttribute('aria-label', 'Identity ledger — Weedmaps to us');
      D.slot().appendChild(_panel);

      _el.addEventListener('click', onClick);
      _panel.addEventListener('click', onClick);
      // The pill is a div with role=button, so it needs Enter/Space itself.
      _el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        toggle();
      });
      // The panel's two one-field forms submit on Enter, which is what a
      // one-field form is expected to do. Nothing else in the panel is bound:
      // every control there is a real <button>/<select> the browser already
      // activates, and a panel-wide Enter handler would have closed the panel.
      _panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !e.target || !e.target.hasAttribute) { return; }
        if (e.target.hasAttribute('data-hwi-q')) { e.preventDefault(); doSearch(); return; }
        if (e.target.hasAttribute('data-hwi-order')) { e.preventDefault(); doMatch(); return; }
        if (e.target.hasAttribute('data-hwi-sim')) { e.preventDefault(); simulate(); }
      });
      // The test-customer form is MANY fields and the panel repaints on every
      // state change, so its values live in _sim and are synced on the way in.
      // An uncontrolled input here would lose what was typed the moment a
      // theme change or a fetch settled.
      _panel.addEventListener('input', onSimInput);
      _panel.addEventListener('change', onSimInput);
      D.register(SEAM_ID, function () { if (_open) { _open = false; paint(); } });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits
        // no event, so the style attribute is the only signal plain JS has.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _panel.querySelector('[data-hwi-scroll]');
    if (body) { _scroll = body.scrollTop; }

    var T = _totals || {};
    // A green dot here would say "identity is fine", and it is not: nobody in
    // this ledger has ever been verified. But RED said something else again —
    // that something has broken — for a ledger that is merely new, and it said
    // it from across the room, before any of the panel's careful wording got a
    // chance. Same rule as the headline box above: red is reserved for a
    // verification that LAPSED (checked, now expired — reads as cleared and is
    // not), amber for people nobody has checked yet.
    var dot = _status !== 'live' ? P.inkFaint
            : T.verified_lapsed ? P.bad
            : T.unverified ? (P.warn || P.bad) : P.good;
    var label = _status === 'live' ? 'WM identity' :
                _status === 'pending' ? 'WM identity…' :
                _status === 'slow' ? 'WM identity — still loading' : 'WM identity (no API)';
    // detail is the whole sentence and goes in the tooltip; the pill carries
    // only the part that is telling you something -- here, how many people have
    // NO live verification, because that is the number that is not fine.
    var detail = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (T.identities != null ? T.identities + ' people · ' +
               (T.verified_live || 0) + ' verified' : 'ledger loaded');
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (T.identities != null && !T.verified_live)
              ? '0 of ' + T.identities + ' verified'
              : (T.unverified ? T.unverified + ' unverified' : '');

    _el.innerHTML = pillHTML(P, 'data-hwi', dot, label, sub,
      label + ' · ' + detail + ' — click for the ledger');

    _panel.style.cssText = panelCSS(P, D, _open);
    if (!_open) { _panel.innerHTML = ''; return; }

    _panel.innerHTML = panelShell(P, 'data-hwi', 'Identity ledger · Weedmaps → us',
      panelHTML(P),
      '<button data-hwi="refresh" style="width:100%;min-height:' + P.ctrlH.sm +
      'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + ff(P.fontSans) + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">' +
      (_busy ? 'working…' : 'Re-fetch /api/identity') + '</button>');

    body = _panel.querySelector('[data-hwi-scroll]');
    if (body) { body.scrollTop = _scroll; }
  }

  // ONE panel at a time, and never open on arrival.
  function toggle() {
    _open = !_open;
    if (_open) { var D = dock(); if (D) { D.opened(SEAM_ID); } }
    paint();
  }

  // The fields live in the PANEL now, not in the pill's wrapper. Reading them
  // off _el would have returned '' for every one of them -- a search box that
  // silently searches for nothing.
  function val(sel) {
    var n = _panel && _panel.querySelector(sel);
    return n ? String(n.value || '') : '';
  }

  function doSearch() {
    _q = val('[data-hwi-q]').trim();
    _offset = 0; _openId = null; _member = null;
    load();
  }

  function doMatch() {
    matchOrder(val('[data-hwi-order]').trim());
  }

  function onSimInput(e) {
    var t = e.target;
    if (!t || !t.getAttribute || !_sim) { return; }
    var key = t.getAttribute('data-hwi-sim');
    if (!key) { return; }
    _sim[key] = String(t.value == null ? '' : t.value);
    // The document select decides WHICH fields exist below it, so that one
    // repaints. Nothing else does: repainting on every keystroke would move
    // the caret to the end of whatever was being typed.
    if (e.type === 'change' && t.getAttribute('data-hwi-sim-repaint')) { paint(); }
  }

  function onClick(e) {
    var t = e.target;
    // Buttons carry the action; a click on the label inside one still lands on
    // the button because these buttons have no inner elements.
    var act = t && t.getAttribute && t.getAttribute('data-hwi');
    if (!act && t && t.parentNode && t.parentNode.getAttribute) {
      act = t.parentNode.getAttribute('data-hwi');
      if (act) { t = t.parentNode; }
    }
    if (act === 'close') { e.stopPropagation(); _open = false; paint(); return; }
    if (act === 'why') { e.stopPropagation(); _why = !_why; paint(); return; }
    if (act === 'refresh') { e.stopPropagation(); load(); return; }
    if (act === 'search') { e.stopPropagation(); doSearch(); return; }
    if (act === 'do-match') { e.stopPropagation(); doMatch(); return; }
    if (act === 'sim-run') { e.stopPropagation(); simulate(); return; }
    if (act === 'sim-reseed') { e.stopPropagation(); seedSim(true); paint(); return; }
    if (act === 'sim-show') {
      e.stopPropagation();
      // The same handle simulate() used — the first name, never the Weedmaps
      // id, which this ledger cannot search on.
      var sq = (_simResult && _simResult.ledger_q) || '';
      _tab = 'ledger';
      if (sq) { _q = sq; _offset = 0; _openId = null; _member = null; load(); }
      else { _q = ''; _offset = 0; _openId = null; _member = null; load(); }
      return;
    }
    if (act === 'tab') {
      e.stopPropagation(); _tab = t.getAttribute('data-tab'); paint(); return;
    }
    if (act === 'prev') {
      e.stopPropagation();
      if (!_offset) { return; }
      _offset = Math.max(0, _offset - PAGE); _openId = null; _member = null; load(); return;
    }
    if (act === 'next') {
      e.stopPropagation();
      var n = ((_page && _page.members) || []).length;
      if (n < PAGE) { return; }
      _offset += PAGE; _openId = null; _member = null; load(); return;
    }
    if (act === 'member') {
      e.stopPropagation();
      var id = t.getAttribute('data-id');
      if (String(id) === String(_openId)) { _openId = null; _member = null; paint(); return; }
      openMember(id); return;
    }
    if (act === 'match') {
      e.stopPropagation(); matchOrder(t.getAttribute('data-order')); return;
    }
    if (act === 'record') {
      e.stopPropagation();
      record(t.getAttribute('data-id'), val('[data-hwi-method]'), val('[data-hwi-decision]'),
             { ref: val('[data-hwi-ref]').trim() || null });
      return;
    }
    if (t && /^(SELECT|OPTION|INPUT|TEXTAREA|BUTTON)$/.test(t.tagName)) { return; }
    // A stray click inside the open panel must not close it -- only the pill
    // toggles, and only the x and Escape close.
    if (_panel && _panel.contains(t)) { return; }
    toggle();
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_IDENTITY = {
    __armed: armed,
    get status() { return _status; },
    get members() { return (_page && _page.members) || []; },
    get page() { return _page; },
    get totals() { return _totals; },
    get member() { return _member; },
    get match() { return _match; },
    get base() { return base; },
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _status = 'pending'; paint();
      return load();
    },
    search: function (q) { _q = String(q || ''); _offset = 0; return load(); },
    openMember: openMember,
    matchOrder: matchOrder,
    record: record,
    // Create a test customer that arrives THROUGH the Weedmaps door. Takes no
    // arguments on purpose: the fields are the form's, so a console call and a
    // click send exactly the same order and cannot drift apart.
    simulate: simulate,
    get simForm() { return _sim; },
    get simResult() { return _simResult; },
    get synthetic() { return _synth; },
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

  if (armed) {
    waitForHW();
    if (document.body) { paint(); }
    else { document.addEventListener('DOMContentLoaded', paint); }
    load();
  }
})();
