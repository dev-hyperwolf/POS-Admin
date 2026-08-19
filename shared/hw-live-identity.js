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
  var RAIL_W = 74;               // shared/app-rail.jsx:46 — clear the rail
  var BOTTOM = 90;               // clears hw-live.js (bottom 14) and taxonomy (52)
  var PAGE = 25;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' -- it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // discarded, which in the sibling files computed black-on-near-black and went
  // INVISIBLE in dark mode. Single quotes are equally valid CSS and survive.
  function ff(v) { return String(v).replace(/"/g, "'"); }

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
  var _open = false, _busy = false;
  var _msg = null, _msgOk = false;
  var _el = null, _scroll = 0;

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
  // WRITE AUTH: there is none, anywhere in this seam. hw-live.js:1206-1213
  // POSTs /api/order/stage with `Content-Type` and nothing else — no bearer, no
  // token, no cookie (`credentials: 'omit'`). The server route
  // (wm-demo/wmdemo/server.py:423) checks nothing either. So a write is
  // possible exactly when the page's OWN ORIGIN serves the API, and impossible
  // otherwise, because there is no second host to send it to. On a public
  // deployment /api/identity/verify 404s. The control is therefore NOT RENDERED
  // when the reads did not come back live, and the reason is printed in its
  // place — a button that silently fails is the same shape as the green rail
  // that claimed a customer had been notified about a rejected push.
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
    return fetch(base + '/api/identity/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', cache: 'no-store',
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (j) { return { ok: res.ok, code: res.status, body: j }; },
                             function () { return { ok: false, code: res.status, body: {} }; });
    }).then(function (r) {
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
          '<button data-hwi="record" data-id="' + esc(identityId) + '" style="' + btnCSS(P, true) + '">' +
          (_busy ? 'working…' : 'Record') + '</button></div>';
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
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + (g.present ? P.ink2 : P.inkDim) +
      ';line-height:1.5;margin-bottom:7px"><b style="color:' + P.ink + '">Government document:</b> ' +
      esc(g.present ? (g.kind || 'on file') : (g.means || 'not present')) + '</div>';

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
    var h = '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:8px">' +
      'Identity ledger · Weedmaps → us</div>';

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
    h += '<div style="border:1px solid ' + (live ? P.hairline2 : P.bad) + ';border-radius:' +
      P.r8 + 'px;padding:9px;margin-bottom:9px;background:' +
      (live ? P.surface2 : P.badSoft) + '">' +
      '<div style="font-size:' + P.type.h2 + 'px;font-weight:800;font-family:' + ff(P.fontMono) +
      ';color:' + (live ? P.ink : P.bad) + '">' + esc(live) + ' of ' + esc(identities) +
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
    h += '<div style="margin-top:10px;padding-top:9px;border-top:1px solid ' + P.hairline + '">';
    h += note(P, 'THE MEMBERS SCREEN IS UNTOUCHED. pos/data.jsx:58 still holds five invented ' +
      'people (Harshil, Manisha, Girish, Dony, Joseph) and they still drive the Members list, ' +
      'the Register customer card and check-in. This panel is the real ledger; those five are ' +
      'not in it.');
    h += note(P, 'Why it was not overwritten: MEMBERS rows are consumed with no null guard — ' +
      'pos/screen-stubs.jsx:48 and pos/screen-register.jsx:349 and :800 all call ' +
      'm.points.toLocaleString(). A real identity has no loyalty balance (this API has no ' +
      'loyalty data at all), so writing the ledger in would either throw and white-screen the ' +
      'Members screen, or print "0 pts · $0.00 wallet" for every person — a balance nobody ' +
      'computed. Wiring it properly is a screen change: read window.HW.IDENTITY.members and ' +
      'drop the points and wallet columns, because there is nothing behind them.');
    h += note(P, 'THE ORDERS SCREEN IS ALSO UNTOUCHED, and it is the one that reads falsely. ' +
      'pos/screen-orders.jsx:1258-1276 ("Identity & fraud check") draws "score {wm.risk}/100" ' +
      'with a filled progress bar and four per-field badges, all from pos/data.jsx:220 WM_ORDER. ' +
      'No risk model exists — wm-demo/wmdemo/engine.py:1260 evaluate_fraud returns (action, ' +
      'reason) and nothing else — and no per-field verification model exists at all. A bar and ' +
      'a badge ARE the claim that a check ran, so no value fed into that screen could make it ' +
      'honest; the fold has to change. The honest version of that block is the "Fraud check" ' +
      'section on the Order match tab here.');
    h += note(P, 'pos/verification.jsx:34-38 draws a T0/T1/T2 assurance ladder whose T2 is ' +
      'SMS-proved phone ownership. Nothing in this codebase sends or checks that code, so no ' +
      'order in this system can honestly be described as account-bound, and T2 is unreachable.');
    h += note(P, 'Everything on THIS panel comes from /api/identity/*. This file contains no ' +
      'tier labels, no state names and no reason sentences of its own — every one of them is ' +
      'the API\'s own string, printed verbatim. A second copy here is exactly the drift that ' +
      'turns "Same Weedmaps account — an account, not proof of a person" into "same customer".');
    h += '</div>';
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

    if (!_el) {
      _el = document.createElement('div');
      _el.id = 'hw-identity-badge';
      document.body.appendChild(_el);
      _el.addEventListener('click', onClick);
      _el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target && e.target.hasAttribute) {
          if (e.target.hasAttribute('data-hwi-q')) { e.preventDefault(); doSearch(); return; }
          if (e.target.hasAttribute('data-hwi-order')) { e.preventDefault(); doMatch(); return; }
        }
        if (e.target && /^(SELECT|OPTION|INPUT|TEXTAREA)$/.test(e.target.tagName)) { return; }
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        onClick(e);
      });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits
        // no event, so the style attribute is the only signal plain JS has.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _el.querySelector('[data-hwi-scroll]');
    if (body) { _scroll = body.scrollTop; }

    var T = _totals || {};
    // A green dot here would say "identity is fine". Nobody in this ledger has
    // ever been verified, so it is not fine, and the dot says so.
    var dot = _status !== 'live' ? P.inkFaint
            : (T.identities && !T.verified_live) ? P.bad
            : T.unverified ? (P.warn || P.bad) : P.good;
    var label = _status === 'live' ? 'WM identity' :
                _status === 'pending' ? 'WM identity…' :
                _status === 'slow' ? 'WM identity — still loading' : 'WM identity (no API)';
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (T.identities != null ? T.identities + ' people · ' +
               (T.verified_live || 0) + ' verified' : 'ledger loaded');

    _el.style.cssText = 'position:fixed;left:' + (RAIL_W + 12) + 'px;bottom:' + BOTTOM + 'px;' +
      'z-index:2147482002;pointer-events:none;font-family:' + P.fontSans +
      ';max-width:min(470px,calc(100vw - ' + (RAIL_W + 28) + 'px));';

    var html = '';
    if (_open) {
      html += '<div style="background:' + P.surface + ';border:1px solid ' + P.hairline2 +
        ';border-radius:' + P.r12 + 'px;box-shadow:' + P.shadowLg + ';padding:13px;margin-bottom:8px;' +
        'pointer-events:auto"><div data-hwi-scroll style="max-height:66vh;overflow:auto">' +
        panelHTML(P) + '</div>' +
        '<button data-hwi="refresh" style="margin-top:11px;width:100%;min-height:' + P.ctrlH.sm +
        'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
        P.surface2 + ';color:' + P.ink2 + ';font-family:' + ff(P.fontSans) + ';font-size:' +
        P.type.meta + 'px;font-weight:600;cursor:pointer">' +
        (_busy ? 'working…' : 'Re-fetch /api/identity') + '</button></div>';
    }
    html += '<div role="button" tabindex="0" data-hw-i data-hwi="toggle" title="' +
      esc(label + ' — click for the ledger') + '" style="display:inline-flex;align-items:center;' +
      'gap:8px;min-height:' + P.ctrlH.xs + 'px;padding:0 12px;border-radius:' + P.r999 +
      'px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + ';box-shadow:' +
      P.shadowSm + ';cursor:pointer;user-select:none;pointer-events:auto">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + dot +
      ';flex:0 0 auto"></span>' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(label) + '</span>' +
      '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' +
      ff(P.fontMono) + '">' + esc(sub) + '</span></div>';

    _el.innerHTML = html;

    body = _el.querySelector('[data-hwi-scroll]');
    if (body) { body.scrollTop = _scroll; }
  }

  function val(sel) {
    var n = _el && _el.querySelector(sel);
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
    _open = !_open;
    paint();
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
    open: function () { _open = true; paint(); },
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
