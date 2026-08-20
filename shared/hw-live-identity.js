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
// PUBLIC SURFACE: window.HW_IDENTITY = { status, members, totals, member,
//   match, refresh(), search(), openMember(), matchOrder(), record() }, and
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
  // splits a shared phone (wm-demo/wmdemo/engine.py:1117-1119, factors
  // ['phone_exact_vetoed_by_document'], force_new=True at :1201) is returned by
  // resolve_identity at ingest and PERSISTED NOWHERE: hw_identities carries a
  // `flags` column and both Marchettis' are empty (read off the deployment),
  // and wm_customer_mapping stores a bare `match_tier` integer and no factors
  // at all (wm-demo/wmdemo/store.py:68-74). Re-running the ladder cannot
  // recover it either — each row carries its own document by then, so
  // /api/identity/order-match?wm_order_id=40764811 recomputes a clean tier 0
  // gov_id_exact with vetoed_by_document:false. The reasoning is simply gone.
  //
  // So this reports the COLLISION, which is a fact off the wire, and reports
  // the ABSENCE of a recorded reason, which is also a fact, and invents
  // neither. Reported to the coordinator as an engine gap; not fixable here.
  function lastWord(s) {
    if (!s) { return null; }
    var p = String(s).trim().split(/\s+/);
    return p.length > 1 ? p[p.length - 1].toLowerCase() : null;
  }

  function who(o) {
    return '#' + o.identity_id + ' ' + (o.name || '(no name)');
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

  function cohortHTML(P, m) {
    var c = cohortsFor(m);
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
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
        'margin-top:4px">And nothing records WHY they were kept apart: the ledger has no field ' +
        'for that decision. Do not read the silence as an oversight — but do not read it as a ' +
        'decision either. It was never written down.</div>';
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
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;' +
        'margin-top:4px">' + (sameLast.length
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
    h += cohortHTML(P, m);

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkMute + ';font-family:' +
      ff(P.fontMono) + ';margin-top:5px">' +
      esc(m.fulfilled_count) + ' fulfilled · first seen ' + esc(ts(m.first_seen_at) || '?') +
      ' · last ' + esc(ts(m.last_seen_at) || '?') + '</div>';

    if (m.flags && m.flags.length) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';margin-top:4px">' +
        esc(m.flags.join(' · ')) + '</div>';
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
    [['ledger', 'Ledger'], ['match', 'Order match']].forEach(function (t) {
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
    } else {
      h += '<div style="display:flex;gap:6px;margin-bottom:8px">' +
        '<input data-hwi-q placeholder="name, phone, or Weedmaps customer id" value="' +
        esc(_q) + '" style="' + ctlCSS(P) + 'flex:1 1 auto">' +
        '<button data-hwi="search" style="' + btnCSS(P, true) + '">Search</button></div>';

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
        if (e.target.hasAttribute('data-hwi-order')) { e.preventDefault(); doMatch(); }
      });
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
