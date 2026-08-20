// ── shared/hw-live-mapping.js ── our product → THEIR product, on a screen ──
// Plain JS. Loads BEFORE React, on the POS entry HTML only. Sibling of
// shared/hw-live.js, hw-live-taxonomy.js, hw-live-identity.js and
// hw-live-checkin.js, built to the same rules: armed on any origin with the
// same-origin fetch deciding, in-place mutation of window.HW (never a
// reassignment), every write through W.HW_LIVE.post, silent fallback when
// nothing answers, and the panel says out loud what is still not true.
//
// WHAT IT IS, AND WHY IT EXISTS.
// The owner's question is "how can I map a product from our catalog to a
// weedmaps product to make sure it's verified on weedmaps?" The matching engine
// for that has existed for weeks (wmdemo/mapping.py, ~1180 lines: deterministic
// exact match, fuzzy scoring, an AI escalation band, sticky human verdicts, an
// absence ledger). Eight HTTP routes serve it. NOT ONE SCREEN CALLS THEM. The
// honest answer to "can we do this yet" was "yes, with curl", which is not an
// answer. This file is the screen. It builds no matcher of its own and re-
// derives no threshold of its own — every verdict word on it is the server's.
//
// THE STATES, AND WHY THEY ARE DRAWN AS DIFFERENTLY AS THEY ARE. Four of these
// mean "not on Weedmaps" and the operator's next move is different for each, so
// they share no colour and no wording:
//   LINKED    — a mapping row exists (status active/alert). This SKU has a WM
//               product id behind it. Linked is NOT the same as published; the
//               row says separately whether we ever pushed it and whether
//               Weedmaps handed back an item id.
//   READY     — the engine is confident (its own word: exact / auto) and
//               nothing has pressed the button. One click each. This is the
//               cheapest work on the board and it sorts first.
//   REVIEW    — the engine is NOT confident: an open queue row, or a score in
//               the AI-escalation band. A person has to look.
//   REJECTED  — a PERSON said no. Sticky: wmdemo/mapping.py:539-541 refuses to
//               re-queue it until the product itself changes. Re-running the
//               matcher does nothing. Only approving something clears it.
//   NO MATCH  — nothing scored well enough. NOT the same as "Weedmaps does not
//               have it": we have not proved absence, and this panel refuses to
//               say we have.
//   ABSENT    — the absence ledger says Weedmaps genuinely does not carry it,
//               confirmed across two DISTINCT catalogue pulls
//               (wmdemo/mapping.py:562-588). This is not our work at all — it
//               is a sentence to send the brand.
//
// PUBLIC SURFACE: window.HW_MAPPING = { status, rows, counts, absences,
//   refresh(), candidates(), approve(), reject(), unmap(), rescore(), pull(),
//   open(), close(), disable() }. Also mirrored, read-only, onto
//   window.HW.WM_MAPPING so a POS dev can render this from a screen with no
//   fetch code of their own.
// Turn it off: append `?hwmap=off`, or run `HW_MAPPING.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_MAPPING && W.HW_MAPPING.__armed) { return; }   // idempotent

  // 9s, not 6s. The list read is POST /api/mapping/bulk with rescore_all, which
  // scores every SKU against every cached WM product server-side; measured 1.4s
  // warm against the deployed instance, and a cold container there takes tens of
  // seconds to answer its first request. The timer only changes the LABEL — see
  // load(): nothing is ever aborted.
  var TIMEOUT_MS = 9000;
  var OFF_KEY = 'hw-mapping-off';
  var SEAM_ID = 'mapping';

  // ── gate ─────────────────────────────────────────────────────────────────
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' -- it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // discarded. Single quotes are equally valid in CSS and survive the attribute.
  function ff(v) { return String(v).replace(/"/g, "'"); }

  // ── the seam dock ────────────────────────────────────────────────────────
  // Every seam file defines this block identically -- whichever loads first
  // wins and the others reuse it, so there is exactly one tray and exactly one
  // open-panel rule however many seams ship.
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
      root: function () {
        if (D._root && D._root.parentNode) { return D._root; }
        var r = document.createElement('div');
        r.id = 'hw-seam-dock';
        r.style.cssText = 'position:fixed;left:' + D.LEFT + 'px;bottom:' + D.BOTTOM +
          'px;z-index:2147482003;display:flex;flex-direction:column;align-items:flex-start;' +
          'gap:8px;max-width:calc(100vw - ' + (D.LEFT + 16) + 'px);pointer-events:none';
        document.body.appendChild(r);
        D._root = r;
        return r;
      },
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
      opened: function (id) {
        Object.keys(D._closers).forEach(function (k) {
          if (k !== id) { try { D._closers[k](); } catch (e) {} }
        });
      },
      closeAll: function () {
        Object.keys(D._closers).forEach(function (k) { try { D._closers[k](); } catch (e) {} });
      }
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { D.closeAll(); }
    });
    W.HW_SEAM_DOCK = D;
    return D;
  }

  function panelCSS(P, D, open) {
    return 'width:min(400px,calc(100vw - ' + (D.LEFT + 16) + 'px));max-height:min(46vh,380px);' +
      'flex-direction:column;overflow:hidden;background:' + P.surface + ';border:1px solid ' +
      P.hairline2 + ';border-radius:' + P.r12 + 'px;box-shadow:' + P.shadowLg + ';font-family:' +
      P.fontSans + ';pointer-events:auto;display:' + (open ? 'flex' : 'none');
  }

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

  var override = qs('hwmap');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback — otherwise a
  // crafted link could point the page at an arbitrary host and have it render
  // that host's catalog, and its approve buttons, as the operator's own.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }
  // ARMED ON ANY ORIGIN, and the SAME-ORIGIN FETCH decides. On GitHub Pages
  // /api/state 404s, the reads fail, and the panel says so instead of drawing a
  // board. No regression to the public demo; a hosted one comes alive.
  var armed = !disabled;

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';   // off|pending|slow|live|unreachable|no-write-path
  var _bulk = null, _bulkErr = null;         // POST /api/mapping/bulk
  var _menuBySku = null, _stateErr = null;   // GET  /api/state  -> menu + events
  var _verdicts = null, _evHorizon = null, _evCount = 0;
  var _absBySku = null, _absErr = null, _absNote = null, _absCount = null, _absConfirmed = null;
  var _wmids = null;
  var _hw = null;
  var _open = false, _busy = false, _why = false;
  var _filter = 'all';
  var _openSku = null, _cands = null, _candStatus = 'idle', _candErr = null;
  var _candQuery = '', _candSku = null;
  var _fresh = {};                            // sku -> the server's own rescore verdict
  var _msg = null, _msgOk = false;
  var _el = null, _panel = null, _scroll = 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function ago(sec) {
    if (!sec) { return 'never'; }
    var s = Math.max(0, Math.floor(Date.now() / 1000 - sec));
    if (s < 60) { return 'just now'; }
    if (s < 3600) { return Math.floor(s / 60) + 'm ago'; }
    if (s < 86400) { return Math.floor(s / 3600) + 'h ago'; }
    return Math.floor(s / 86400) + 'd ago';
  }

  // Weight is printed EXACTLY as the two sides store it and is never converted.
  // '3.5g' vs Weedmaps' '3.54g' 1/8-oz quirk is a real difference an operator is
  // entitled to see; normalising it here would hide the thing they are checking.
  function wt(w) {
    if (!w || w.value == null) { return ''; }
    return String(w.value) + String(w.unit == null ? '' : w.unit);
  }

  // A score is a number or it is nothing. There is no third option and no zero
  // stands in for "not computed": search_candidates returns score:null for every
  // row when it was asked without a sku, and a 0.000 there would read as "scored,
  // and terrible" for a candidate that was never scored at all.
  function scoreText(s) { return s == null ? 'not scored' : Number(s).toFixed(3); }

  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body.style.colorScheme;
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  // Six states, six treatments. REJECTED is the only quiet one, because it is
  // the only one that is a recorded decision rather than an open problem — the
  // same reason the taxonomy board draws `skipped` quiet. NO MATCH and ABSENT
  // must never look alike: one is unfinished work here, the other is a sentence
  // to send a brand.
  function tone(P, st) {
    if (st === 'linked')   { return { fg: P.good,    bg: P.goodSoft,    word: 'LINKED' }; }
    if (st === 'ready')    { return { fg: P.accentText, bg: P.highlightSoft, word: 'READY · ONE CLICK' }; }
    if (st === 'review')   { return { fg: P.warn,    bg: P.warnSoft,    word: 'NEEDS REVIEW' }; }
    if (st === 'rejected') { return { fg: P.neutral, bg: P.neutralSoft, word: 'REJECTED · STICKY' }; }
    if (st === 'absent')   { return { fg: P.warn,    bg: P.warnSoft,    word: 'NOT ON WEEDMAPS' }; }
    return { fg: P.bad, bg: P.badSoft, word: 'NO CONFIDENT MATCH' };
  }

  var ORDER = { ready: 0, review: 1, rejected: 2, nomatch: 3, absent: 4, linked: 5 };

  // ── the derived board ────────────────────────────────────────────────────
  // ONE place where a state is decided, and every input to it is something the
  // server said. Nothing here re-implements the matcher and nothing re-derives
  // a threshold: T_AUTO and T_AI live in wmdemo/mapping.py:34-35 and are not
  // served, so the verdict WORD on every row is the server's own.
  function rows() {
    if (!_bulk || !Array.isArray(_bulk.rows)) { return []; }
    return _bulk.rows.map(function (r) {
      var m = r.mapping;
      var linked = !!(m && (m.status === 'active' || m.status === 'alert'));
      var sug = r.suggestion || null;
      var dec = sug && sug.decision;
      var abs = _absBySku ? _absBySku[r.sku] : null;
      var v = _verdicts ? _verdicts[r.sku] : null;
      var rejected = !linked && !!(v && v.action === 'rejected');

      var st;
      if (linked) { st = 'linked'; }
      else if (abs && (abs.state === 'absent' || abs.state === 'requested')) { st = 'absent'; }
      else if (rejected) { st = 'rejected'; }
      else if (r.queued) { st = 'review'; }
      else if (dec === 'exact' || dec === 'auto') { st = 'ready'; }
      else if (dec === 'ai') { st = 'review'; }
      else { st = 'nomatch'; }

      // Publication is a SEPARATE fact from linkage and is read from a
      // different table (menu_state). A SKU can be linked and never pushed.
      var mrows = (_menuBySku && _menuBySku[r.sku]) || [];
      var pushed = 0, accepted = 0, lastPush = 0, pushedIds = {};
      mrows.forEach(function (row) {
        pushed++;
        if (row.published && row.wm_item_id != null) { accepted++; }
        if (row.last_pushed_at && row.last_pushed_at > lastPush) { lastPush = row.last_pushed_at; }
        if (row.product_id != null) { pushedIds[String(row.product_id)] = true; }
      });
      // The listing carries a WM product id of its own. If it disagrees with the
      // mapping we hold now, the live listing is pointing at a DIFFERENT WM
      // product than this screen says — which no counter anywhere reports.
      var driftIds = m && m.wm_id != null
        ? Object.keys(pushedIds).filter(function (k) { return k !== String(m.wm_id); })
        : [];

      return {
        sku: r.sku, name: r.name, category: r.category, weight: r.weight,
        state: st, mapping: m, linked: linked, suggestion: sug,
        queued: !!r.queued, queueReason: r.queue_reason,
        wmProductId: r.wm_product_id,
        absence: abs || null, verdict: v || null,
        listings: mrows.length, pushed: pushed, accepted: accepted,
        lastPush: lastPush, driftIds: driftIds
      };
    });
  }

  function counts() {
    var c = { total: 0, linked: 0, ready: 0, review: 0, rejected: 0, nomatch: 0,
              absent: 0, accepted: 0, drift: 0, neverPushed: 0 };
    rows().forEach(function (x) {
      c.total++; c[x.state]++;
      if (x.linked) {
        if (x.accepted) { c.accepted++; }
        if (!x.listings) { c.neverPushed++; }
        if (x.driftIds.length) { c.drift++; }
      }
    });
    return c;
  }

  // What the sibling taxonomy board knows and this one cannot: a linked SKU can
  // still be rejected by Weedmaps for a missing category id. Read from the
  // sibling's already-fetched coverage — never a second fetch, and never an
  // assumption when the sibling is not there to ask.
  function taxonomyGate() {
    var T = W.HW_TAXONOMY;
    if (!T || !T.__armed) { return { known: false, why: 'the WM taxonomy seam is not loaded on this page' }; }
    if (T.status !== 'live') { return { known: false, why: 'the WM taxonomy seam is ' + T.status }; }
    var cov = T.coverage;
    if (!cov || !cov.blocked_skus) { return { known: false, why: 'the taxonomy seam served no coverage' }; }
    var byS = {};
    (cov.blocked_skus || []).forEach(function (b) {
      if (b && b.sku) { byS[String(b.sku)] = b; }
      else if (typeof b === 'string') { byS[b] = { sku: b, status: 'blocked' }; }
    });
    var n = 0;
    rows().forEach(function (x) { if (x.linked && byS[x.sku]) { n++; } });
    return { known: true, blocked: n };
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT. hw-live.js paid for this lesson already
  // (hw-live.js:32-39): aborting on a timeout makes a slow-but-perfectly-fine
  // response indistinguishable from a dead server. The timer only changes the
  // LABEL; the request runs to completion and applies late.
  var _settled = false;

  // THE LIST READ IS A POST. /api/mapping/bulk, /candidates, /absences and
  // /rescore are all reads served over POST (wmdemo/server.py:854-870), and the
  // public-mode gate at server.py:365 does not distinguish a POST that reads
  // from a POST that writes. So they go through W.HW_LIVE.post like every write
  // — one token, one same-origin rule, one place the server's own refusal text
  // is read. Which also means this panel cannot load at all without hw-live.js,
  // and says exactly that rather than rendering an empty board.
  function post(path, body) {
    if (!armed) { return Promise.resolve({ ok: false, error: 'seam is off' }); }
    if (!W.HW_LIVE || typeof W.HW_LIVE.post !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null,
        error: 'shared/hw-live.js is not loaded — this seam routes every request through its write path and has none of its own' });
    }
    return W.HW_LIVE.post(path, body);
  }

  function loadBulk() {
    // rescore_all:true is what makes READY exist. Without it the server only
    // reports suggestions for SKUs already sitting in the review queue, so a
    // catalogue the nightly job has never touched — the deployed one, today —
    // renders 39 rows of "unmapped" with no candidate on any of them, and the
    // screen is a list of problems with no button. It costs one pass of the
    // matcher over the cached feed, measured at 1.4s for 39 x 96.
    return post('/api/mapping/bulk', { rescore_all: true }).then(function (r) {
      if (!r.ok || !r.body || !Array.isArray(r.body.rows)) {
        _bulk = null;
        _bulkErr = r.gated
          ? 'This deployment is in public mode and every POST needs the write token. Open the hw-live badge and paste it — the list itself is a POST, so nothing here can load without it.'
          : (r.error || 'the bulk read returned no rows');
        return false;
      }
      _bulk = r.body; _bulkErr = null;
      return true;
    });
  }

  // Absences are read-only unless mark_requested is sent, and it never is from
  // here: flipping a SKU to 'requested' is a claim that somebody actually asked
  // the brand, and no button on this panel does that.
  function loadAbsences() {
    return post('/api/mapping/absences', {}).then(function (r) {
      if (!r.ok || !r.body || !Array.isArray(r.body.absences)) {
        _absBySku = null; _absErr = r.error || 'no absence report';
        _absCount = null; _absConfirmed = null; _absNote = null;
        return;
      }
      var by = {};
      r.body.absences.forEach(function (a) { if (a && a.sku) { by[a.sku] = a; } });
      _absBySku = by; _absErr = null;
      _absCount = r.body.count; _absConfirmed = r.body.confirmed; _absNote = r.body.note;
    });
  }

  // /api/state carries two facts nothing else serves: menu_state (did we ever
  // push this SKU, and did Weedmaps hand back an item id) and the event log —
  // the ONLY place a human rejection is visible to a client. It is a ~100KB read
  // and hw-live.js is already polling the same route; that duplication is real
  // and is named in the WHY block rather than hidden.
  function loadState() {
    return fetch(base + '/api/state', { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      })
      .then(function (j) {
        if (!j || !Array.isArray(j.events)) { throw new Error('not this API'); }
        _wmids = j.wmids || null;

        // external_id is 'hyperwolf:sku:' + sku (wmdemo/catalog.py:207). Matched
        // by suffix rather than by rebuilding the prefix here, so a server that
        // changes SKU_PREFIX does not silently turn every row into "never
        // pushed" — the one failure mode that would look like clean data.
        var by = {};
        (j.menu || []).forEach(function (row) {
          var ext = String(row.external_id == null ? '' : row.external_id);
          var i = ext.lastIndexOf(':');
          var sku = i < 0 ? ext : ext.slice(i + 1);
          if (!sku) { return; }
          var pid = null;
          try { pid = JSON.parse(row.last_payload || '{}').product_id; } catch (e) { pid = null; }
          (by[sku] = by[sku] || []).push({
            wm_menu_id: row.wm_menu_id, published: row.published,
            wm_item_id: row.wm_item_id, last_pushed_at: row.last_pushed_at,
            product_id: pid == null ? null : pid
          });
        });
        _menuBySku = by;

        // THE STICKY REJECTION, AND WHY IT IS INFERRED RATHER THAN READ.
        // mapping.reject() writes 'rejected' into the mapping_events table
        // (wmdemo/mapping.py:902-907) and NO endpoint serves that table. The
        // only client-visible trace is the dashboard log line the route also
        // writes (wmdemo/server.py:825). So: newest-first scan, first verdict
        // per SKU wins, which is the same last-event-wins rule the server's own
        // sticky check uses. Its limits are stated on the row and in the WHY —
        // this never claims a rejection it cannot see, and it never shows one
        // for a SKU that now has a mapping.
        var RX = /^mapping (approved|rejected|unmapped) (\S+)/;
        var v = {}, n = 0, oldest = null;
        j.events.forEach(function (e) {
          var msg = String(e && e.message || '');
          if (e && e.ts && (oldest == null || e.ts < oldest)) { oldest = e.ts; }
          var m = RX.exec(msg);
          if (!m) { return; }
          n++;
          if (v[m[2]]) { return; }              // newest-first: first hit wins
          var reason = /\(([^)]*)\)/.exec(msg);
          var byWho = / by (\S+)/.exec(msg);
          v[m[2]] = { action: m[1], ts: e.ts, reason: reason ? reason[1] : null,
                      by: byWho ? byWho[1] : null };
        });
        _verdicts = v; _evCount = n; _evHorizon = oldest;
        _stateErr = null;
      })
      .catch(function (e) {
        _menuBySku = null; _verdicts = null; _evHorizon = null; _evCount = 0;
        _stateErr = (e && e.message) || 'unreachable';
      });
  }

  function load() {
    _settled = false;
    var timer = setTimeout(function () {
      if (!_settled) { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);
    _busy = true; paint();
    // Three independent reads, settled independently. A failed absence report
    // must not blank the board, and a failed board must not be disguised by a
    // good absence report — each one's failure is shown where that data was
    // going to be.
    return Promise.all([loadBulk(), loadState(), loadAbsences()]).then(function (r) {
      clearTimeout(timer);
      _settled = true; _busy = false;
      _status = r[0] ? 'live'
        : (!W.HW_LIVE || typeof W.HW_LIVE.post !== 'function') ? 'no-write-path'
        : 'unreachable';
      publishToHW();
      paint();
      return _status;
    }).catch(function () {
      clearTimeout(timer);
      _settled = true; _busy = false;
      _status = 'unreachable';
      paint();
      return _status;
    });
  }

  function loadCandidates(sku) {
    _candSku = sku; _candStatus = 'pending'; _cands = null; _candErr = null;
    paint();
    // include_excluded defaults true server-side and is sent explicitly: THE
    // LOSERS ARE THE POINT. A ranked list with the guard-excluded rows quietly
    // removed cannot be disagreed with, and every one of them carries the name
    // of the guard that removed it.
    return post('/api/mapping/candidates',
                { sku: sku, query: _candQuery || null, limit: 12, include_excluded: true })
      .then(function (r) {
        if (_candSku !== sku) { return; }        // a later click won
        if (!r.ok || !r.body || !Array.isArray(r.body.candidates)) {
          _candStatus = 'error';
          _candErr = r.error || 'no candidates in the response';
        } else {
          _cands = r.body; _candStatus = 'live';
        }
        paint();
      });
  }

  // ── writes ───────────────────────────────────────────────────────────────
  // Each one shows the server's OWN reason on failure rather than swallowing it.
  function write(path, body, said) {
    _busy = true; _msg = null; paint();
    return post(path, body).then(function (r) {
      _busy = false;
      if (!r.ok) {
        _msgOk = false;
        _msg = 'Refused' + (r.code ? ' (' + r.code + ')' : '') + ': ' + (r.error || 'no reason given');
        paint();
        return { ok: false };
      }
      _msgOk = true; _msg = said;
      return load().then(function () {
        if (_openSku) { return loadCandidates(_openSku); }
      }).then(function () { return { ok: true, body: r.body }; });
    }).catch(function (e) {
      _busy = false; _msgOk = false;
      _msg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint();
      return { ok: false };
    });
  }

  function approve(sku, wmId) {
    return write('/api/mapping/approve', { sku: sku, wm_id: Number(wmId) },
                 sku + ' → WM #' + wmId + ' (manual override, tier 0)');
  }
  function reject(sku, reason) {
    return write('/api/mapping/reject', { sku: sku, reason: reason || 'no_match' },
                 sku + ' rejected — sticky until the product itself changes');
  }
  function unmap(sku) {
    return write('/api/mapping/unmap', { sku: sku },
                 sku + ' unlinked — the mapping row is kept as audit, the catalog link is cleared');
  }
  function pull() {
    // The route defaults to source 'fixture' (wmdemo/server.py:800) and this
    // sends nothing else, so the button never silently reaches for the live WM
    // partner API. The label says which one it is.
    return write('/api/mapping/pull', {}, 'brand feed re-pulled');
  }
  // Read-only: rescore never writes a mapping (wmdemo/mapping.py:1038-1040).
  function rescore(sku) {
    _busy = true; _msg = null; paint();
    return post('/api/mapping/rescore', { sku: sku }).then(function (r) {
      _busy = false;
      if (!r.ok || !r.body) {
        _msgOk = false; _msg = 'Re-score failed: ' + (r.error || 'no reason given');
      } else {
        _fresh[sku] = { decision: r.body.decision, wm_id: r.body.suggested_wm_id,
                        score: r.body.score, note: r.body.note, at: Date.now() / 1000 };
        _msgOk = true;
        _msg = sku + ': ' + r.body.decision +
               (r.body.suggested_wm_id ? ' → #' + r.body.suggested_wm_id : '') +
               ' (' + scoreText(r.body.score) + ')';
      }
      paint();
      return r;
    });
  }

  // ── the one handle on window.HW ──────────────────────────────────────────
  // A PROPERTY WRITE on the object pos/data.jsx published, never
  // `window.HW = ...` — five modules capture window.HW.fmt.money at module
  // scope and a reassignment leaves them bound to a dead object.
  //
  // AND NOTHING ELSE IS TOUCHED. hw-live.js already downgrades an unmapped
  // SKU's Weedmaps pill with the right sentence (hw-live.js:518-521), so this
  // seam does not write to window.HW.PRODUCTS at all. Two seams overwriting one
  // `wm.issue` string is a race in which the surviving message is whichever
  // fetch happened to land last — the catalog and this board would then
  // disagree in a way nobody could reproduce.
  function publishToHW() {
    if (!_hw || !_bulk) { return; }
    _hw.WM_MAPPING = {
      rows: rows(),
      counts: counts(),
      absences: _absBySku ? Object.keys(_absBySku).map(function (k) { return _absBySku[k]; }) : null,
      wmCached: _bulk.wm_cached == null ? null : _bulk.wm_cached,
      eventHorizon: _evHorizon,
      source: base + '/api/mapping/bulk'
    };
  }

  var _tries = 0;
  function waitForHW() {
    if (W.HW) { _hw = W.HW; publishToHW(); return; }
    if (_tries++ > 200) { return; }         // ~30s, then give up quietly
    setTimeout(waitForHW, 150);
  }

  // ── panel ────────────────────────────────────────────────────────────────
  function chip(P, t, text) {
    return '<span style="display:inline-block;padding:2px 7px;border-radius:' + P.r999 + 'px;' +
      'background:' + t.bg + ';color:' + t.fg + ';font-size:' + P.type.micro + 'px;font-weight:800;' +
      'letter-spacing:.06em">' + esc(text) + '</span>';
  }

  function note(P, s) {
    return '<div style="display:flex;gap:7px;font-size:' + P.type.meta + 'px;color:' + P.inkDim +
      ';line-height:1.45;margin-bottom:5px"><span style="color:' + P.inkFaint + '">·</span><span>' +
      esc(s) + '</span></div>';
  }

  function ctlCSS(P) {
    return 'height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink + ';font-size:' +
      P.type.meta + 'px;padding:0 8px;';
  }

  function btn(P, attr, act, sku, label, wm) {
    return '<button ' + attr + '="' + act + '" data-sku="' + esc(sku) + '"' +
      (wm == null ? '' : ' data-wm="' + esc(wm) + '"') + ' style="' + ctlCSS(P) +
      'height:28px;cursor:pointer;font-family:' + P.fontSans + ';font-weight:600">' +
      esc(label) + '</button>';
  }

  function mono(P, s, colour) {
    return '<span style="font-family:' + ff(P.fontMono) + ';color:' + (colour || P.ink2) + '">' +
      esc(s) + '</span>';
  }

  // One candidate. The score is printed as a number AND drawn as a bar, and the
  // bar is NEVER coloured by a threshold of ours — T_AUTO and T_AI are not
  // served, so a green bar here would be this file guessing at the engine's
  // opinion. The engine's opinion is the word above the list.
  function candHTML(P, c, rank, ourSku) {
    var out = c.excluded != null;
    var pct = c.score == null ? 0 : Math.max(2, Math.min(100, Math.round(c.score * 100)));
    var h = '<div style="border-top:1px solid ' + P.hairline + ';padding:7px 0">';
    h += '<div style="display:flex;gap:7px;align-items:baseline">' +
      '<span style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkFaint + ';flex:0 0 auto">' + rank + '</span>' +
      '<span style="flex:1 1 auto;min-width:0;font-size:' + P.type.body + 'px;font-weight:' +
      (out ? '500' : '700') + ';color:' + (out ? P.inkMute : P.ink) + '">' + esc(c.name || '(unnamed)') +
      '</span>' +
      (c.exact ? chip(P, { fg: P.good, bg: P.goodSoft }, 'EXACT') : '') + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';font-family:' +
      ff(P.fontMono) + ';margin:1px 0 4px">#' + esc(c.wm_id) + ' · ' + esc(c.category || 'no category') +
      ' · ' + esc(wt(c.weight) || 'no weight') +
      (c.items_per_pack ? ' · ' + esc(c.items_per_pack) + '-pack' : '') +
      (c.strain ? ' · ' + esc(c.strain) : '') + '</div>';

    h += '<div style="display:flex;gap:7px;align-items:center">' +
      '<div style="flex:1 1 auto;height:4px;border-radius:' + P.r999 + 'px;background:' +
      P.hairline + ';overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' +
      (out ? P.inkFaint : P.ink2) + '"></div></div>' +
      '<span style="flex:0 0 auto;font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro +
      'px;color:' + (out ? P.inkMute : P.ink2) + '">' + esc(scoreText(c.score)) + '</span>' +
      btn(P, 'data-hwm', 'approve', ourSku, out ? 'Approve anyway' : 'Approve', c.wm_id) + '</div>';

    if (out) {
      // WHY THE RUNNER-UP LOST, in the server's own vocabulary. An operator who
      // cannot see this cannot disagree with the machine — and this is exactly
      // where they are most likely to be right and it wrong.
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.warn +
        ';line-height:1.4;margin-top:3px">Excluded by the <b>' + esc(c.excluded) +
        '</b> guard, so it scores 0 whatever it looks like. Approving it overrides that guard ' +
        'and records you as the reviewer.</div>';
    }
    return h + '</div>';
  }

  function drawerHTML(P, x) {
    var h = '<div style="margin-top:8px;padding:8px 9px;border-radius:' + P.r8 +
      'px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + '">';

    // The engine's own verdict, quoted. Re-scoring replaces it with a fresher
    // one and says so, rather than the two silently blending.
    var f = _fresh[x.sku];
    var sug = x.suggestion;
    if (f) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45">' +
        '<b>Re-scored ' + esc(ago(f.at)) + ':</b> ' + esc(f.decision) +
        (f.wm_id ? ' → #' + esc(f.wm_id) : '') + ' · ' + esc(scoreText(f.score)) +
        (f.note ? ' — “' + esc(f.note) + '”' : '') + '</div>';
    } else if (sug) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45">' +
        '<b>Engine says “' + esc(sug.decision) + '”</b>' +
        (sug.wm_id ? ' → #' + esc(sug.wm_id) : '') + ' · ' + esc(scoreText(sug.score)) +
        (sug.note ? ' — “' + esc(sug.note) + '”' : '') + '</div>';
    } else {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45">' +
        'The bulk read carried no engine verdict for this SKU. Re-score to ask for one.</div>';
    }

    h += '<div style="display:flex;gap:6px;margin:7px 0 3px">' +
      '<input data-hwm-q value="' + esc(_candQuery) + '" placeholder="filter their catalog: name, strain, 3.5g…" ' +
      'style="' + ctlCSS(P) + 'height:28px;flex:1 1 auto;min-width:0;font-family:' + P.fontSans + '">' +
      btn(P, 'data-hwm', 'search', x.sku, 'Search') +
      btn(P, 'data-hwm', 'rescore', x.sku, 'Re-score') + '</div>';

    if (_candStatus === 'pending') {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';padding:6px 0">' +
        'Asking ' + esc(base) + '/api/mapping/candidates…</div>';
    } else if (_candStatus === 'error') {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.45;padding:6px 0">' +
        'No candidate list: ' + esc(_candErr) + '</div>';
    } else if (_cands) {
      var list = _cands.candidates || [];
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';margin-top:4px">' +
        esc(list.length) + ' shown of ' + esc(_cands.total) + ' in their catalog' +
        (_candQuery ? ' matching “' + esc(_candQuery) + '”' : '') +
        ' · ranked by the engine, losers included</div>';
      if (!list.length) {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;padding:6px 0">' +
          'Nothing in the Weedmaps brand feed matches that search. That is not proof they do not ' +
          'carry it — see the absence ledger, which is the only thing here allowed to say that.</div>';
      }
      list.forEach(function (c, i) { h += candHTML(P, c, i + 1, x.sku); });
    }

    if (x.state !== 'linked' && x.state !== 'rejected') {
      h += '<div style="border-top:1px solid ' + P.hairline + ';padding-top:7px;margin-top:4px">' +
        btn(P, 'data-hwm', 'reject', x.sku, 'None of these — reject') +
        '<span style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint +
        ';margin-left:7px">sticky: the matcher stops reconsidering this SKU until the product changes</span></div>';
    }
    return h + '</div>';
  }

  function rowHTML(P, x) {
    var t = tone(P, x.state);
    var h = '<div style="border:1px solid ' + (x.state === 'linked' ? P.hairline : t.fg) +
      ';border-left:3px solid ' + t.fg + ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:7px;' +
      'background:' + (x.state === 'rejected' ? 'transparent' : P.surface2) + '">';

    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<div style="flex:1 1 auto;min-width:0;font-size:' + P.type.strong + 'px;font-weight:700;color:' +
      (x.state === 'rejected' ? P.inkMute : P.ink) + '">' + esc(x.name || x.sku) + '</div>' +
      chip(P, t, t.word) + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';font-family:' +
      ff(P.fontMono) + ';margin-top:1px">' + esc(x.sku) + ' · ' + esc(x.category || 'no category') +
      (wt(x.weight) ? ' · ' + esc(wt(x.weight)) : '') + '</div>';

    // The sentence. What this state MEANS, and whose move it is next.
    var says, colour = t.fg;
    if (x.state === 'linked') {
      says = 'Linked to Weedmaps product #' + x.mapping.wm_id +
        (x.mapping.manual_override ? ' by a person' : ' by the engine') +
        ' (tier ' + x.mapping.tier + (x.mapping.score == null ? '' : ', score ' + scoreText(x.mapping.score)) + ').';
      colour = P.ink2;
    } else if (x.state === 'ready') {
      says = 'The engine is confident: “' + (x.suggestion.decision) + '” at ' +
        scoreText(x.suggestion.score) + '. Nothing has approved it, so this SKU has NO Weedmaps ' +
        'product behind it and cannot be verified there. One click below fixes it.';
    } else if (x.state === 'review') {
      says = x.queued
        ? 'In the review queue (' + (x.queueReason || 'no reason recorded') + '). The engine will not decide this one.'
        : 'The engine landed in the escalation band — good enough to be interesting, not good enough to map. A person decides.';
    } else if (x.state === 'rejected') {
      says = 'A person looked and said no' + (x.verdict.reason ? ' (' + x.verdict.reason + ')' : '') + '. ' +
        'STICKY: re-running the matcher will not re-queue it until the product itself changes. ' +
        'Approving a candidate is what clears it.';
    } else if (x.state === 'absent') {
      says = 'Weedmaps does not carry this. Confirmed across ' + x.absence.checks +
        ' distinct catalogue pulls, first seen ' + x.absence.days_absent + ' days ago. ' +
        'THIS IS NOT OUR WORK — it is a line in a message to the brand.';
    } else {
      says = 'Nothing in their catalog scored well enough' +
        (x.suggestion && x.suggestion.score != null ? ' (best ' + scoreText(x.suggestion.score) + ')' : '') +
        '. That is not the same as Weedmaps not having it — see below.';
    }
    h += '<div style="font-size:' + P.type.meta + 'px;line-height:1.45;margin-top:5px;color:' +
      colour + '">' + esc(says) + '</div>';

    // LINKED IS NOT PUBLISHED. Said on the row, because the owner's question is
    // "is it verified on Weedmaps" and a link is only the first of three things
    // that have to be true.
    if (x.state === 'linked') {
      var pub;
      if (!x.listings) {
        pub = 'Never pushed to a listing — we hold the link, Weedmaps has never been told.';
      } else if (!x.accepted) {
        pub = 'Pushed to ' + x.listings + ' listing(s) ' + ago(x.lastPush) +
          ', and NOT ONE came back with an item id. Weedmaps has not confirmed it.';
      } else {
        pub = 'Pushed and accepted on ' + x.accepted + ' of ' + x.listings + ' listing(s), last ' +
          ago(x.lastPush) + '. That is our record of the last push, not proof it is on the menu now.';
      }
      h += '<div style="font-size:' + P.type.micro + 'px;color:' +
        (x.accepted ? P.inkDim : P.warn) + ';line-height:1.4;margin-top:4px">' + esc(pub) + '</div>';
      if (x.driftIds.length) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.bad +
          ';line-height:1.4;margin-top:3px">THE LISTING DISAGREES WITH THIS SCREEN: the last payload ' +
          'we pushed carried product id ' + esc(x.driftIds.join(', ')) + ', not #' + esc(x.mapping.wm_id) +
          '. Re-push to make Weedmaps match the mapping shown here.</div>';
      }
    }

    // A 'suspected' absence is evidence, not a verdict, and it is only shown
    // where it changes what you would do next.
    if (x.absence && x.state !== 'absent') {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim + ';line-height:1.4;margin-top:4px">' +
        'Absence ledger: ' + esc(x.absence.state) + ' after ' + esc(x.absence.checks) +
        ' look(s) — not yet enough to tell a brand anything.</div>';
    }
    if (x.state === 'nomatch' && !x.absence) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim + ';line-height:1.4;margin-top:4px">' +
        'The absence ledger has NO entry for this SKU, so nobody has established that Weedmaps ' +
        'lacks it. That entry is written by the nightly pass, across two distinct feed pulls.</div>';
    }

    // Controls.
    h += '<div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap;align-items:center">';
    if (x.state === 'ready' && x.suggestion && x.suggestion.wm_id) {
      h += btn(P, 'data-hwm', 'approve', x.sku,
               'Approve #' + x.suggestion.wm_id, x.suggestion.wm_id);
    }
    h += btn(P, 'data-hwm', 'cands', x.sku,
             _openSku === x.sku ? 'Hide candidates' : (x.state === 'linked' ? 'Change…' : 'Candidates'));
    if (x.state === 'linked') { h += btn(P, 'data-hwm', 'unmap', x.sku, 'Unlink'); }
    h += '</div>';

    if (_openSku === x.sku) { h += drawerHTML(P, x); }
    return h + '</div>';
  }

  function filterBar(P, c) {
    var defs = [
      ['all', 'All ' + c.total],
      ['decide', 'To decide ' + (c.ready + c.review)],
      ['linked', 'Linked ' + c.linked],
      ['rejected', 'Rejected ' + c.rejected],
      ['nomatch', 'No match ' + c.nomatch],
      ['absent', 'Not on WM ' + c.absent]
    ];
    return '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px">' +
      defs.map(function (d) {
        var on = _filter === d[0];
        return '<button data-hwm="filter" data-f="' + d[0] + '" style="height:24px;padding:0 8px;' +
          'border-radius:' + P.r999 + 'px;cursor:pointer;font-family:' + P.fontSans + ';font-size:' +
          P.type.micro + 'px;font-weight:700;border:1px solid ' + (on ? P.ink : P.hairline2) +
          ';background:' + (on ? P.ink : P.surface2) + ';color:' + (on ? P.surface : P.ink2) + '">' +
          esc(d[1]) + '</button>';
      }).join('') + '</div>';
  }

  function panelHTML(P) {
    if (_status !== 'live') {
      var why =
        _status === 'off' ? 'This seam is switched off.'
        : _status === 'pending' ? 'Asking ' + base + '/api/mapping/bulk…'
        : _status === 'slow' ? 'Still waiting on ' + base + '/api/mapping/bulk after ' +
          TIMEOUT_MS + 'ms. The request was NOT aborted — it will land and this board will fill ' +
          'in. It scores every SKU against every cached Weedmaps product, and a cold server ' +
          'takes tens of seconds to answer its first request at all.'
        : _status === 'no-write-path' ? 'shared/hw-live.js is not loaded on this page. Every ' +
          'request here — including the list itself, which the API serves over POST — goes ' +
          'through its write path so the token and the same-origin rule live in one place. ' +
          'Without it this panel has no way to ask anything, and will not pretend otherwise.'
        : 'No API answered at ' + base + '/api/mapping/bulk' + (_bulkErr ? ' — ' + _bulkErr : '') +
          '. Nothing on this page can map a product to Weedmaps until it does.';
      return '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        esc(why) + '</div>';
    }

    var c = counts(), gate = taxonomyGate();
    var h = '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;margin-bottom:9px">' +
      'Live from ' + mono(P, base + '/api/mapping', P.inkDim) + '. ' +
      (_bulk.wm_cached == null ? 'Their catalog size was not reported by this read.'
        : 'Their brand feed holds ' + _bulk.wm_cached + ' products.') + '</div>';

    // THE HEADLINE — the owner's actual question, answered in three lines,
    // because "verified on Weedmaps" is three separate facts and only one of
    // them is a mapping.
    var short = c.total - c.linked;
    h += '<div style="border:1px solid ' + (short ? P.bad : P.good) + ';background:' +
      (short ? P.badSoft : P.goodSoft) + ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:9px">' +
      '<div style="font-size:' + P.type.title + 'px;font-weight:800;color:' + (short ? P.bad : P.good) +
      ';font-family:' + ff(P.fontMono) + '">' + esc(c.linked) + ' of ' + esc(c.total) +
      ' linked to a WM product</div>';
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + (short ? P.bad : P.good) +
      ';line-height:1.45;margin-top:2px">' + esc(short ? short + ' have no Weedmaps product behind them and cannot be verified there.'
        : 'Every product has a Weedmaps product behind it.') + '</div>';

    // Link is step one of three. Steps two and three, each with its own source.
    var pubLine = _stateErr
      ? 'Publication: UNKNOWN — ' + base + '/api/state did not answer (' + _stateErr + '), and that ' +
        'is the only place the push record lives. No count is shown rather than a wrong one.'
      : c.linked === 0 ? 'Publication: nothing is linked, so nothing can have been pushed.'
      : c.accepted + ' of the ' + c.linked + ' linked were pushed and came back with a Weedmaps item id' +
        (c.neverPushed ? ' · ' + c.neverPushed + ' have never been pushed at all' : '') +
        (c.drift ? ' · ' + c.drift + ' listing(s) carry a DIFFERENT product id than the mapping' : '') +
        '. A past push is not present publication.';
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.ink2 + ';line-height:1.4;margin-top:5px">' +
      esc(pubLine) + '</div>';
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + (gate.known && gate.blocked ? P.bad : P.inkDim) +
      ';line-height:1.4;margin-top:3px">' + esc(
        gate.known
          ? (gate.blocked
              ? gate.blocked + ' of the linked are BLOCKED by the taxonomy board — Weedmaps rejects ' +
                'them for a missing category id whatever this mapping says. Open the WM taxonomy pill.'
              : 'Taxonomy gate: none of the linked are blocked by the sub-category board.')
          : 'Taxonomy gate: not measured (' + gate.why + '). A linked SKU can still be rejected by ' +
            'Weedmaps for a missing category id, so "linked" above is not by itself "live".') +
      '</div></div>';

    h += filterBar(P, c);

    if (_msg) {
      h += '<div style="margin-bottom:8px;font-size:' + P.type.meta + 'px;line-height:1.45;font-family:' +
        ff(P.fontMono) + ';color:' + (_msgOk ? P.ink2 : P.bad) + '">' + esc(_msg) + '</div>';
    }

    // Cheapest work first, done last. An operator opens this to clear the board,
    // and the one-click rows are the only ones that cost nothing to decide.
    var list = rows().slice().sort(function (a, b) {
      var d = ORDER[a.state] - ORDER[b.state];
      if (d) { return d; }
      return (a.category + a.name).localeCompare(b.category + b.name);
    });
    if (_filter === 'decide') {
      list = list.filter(function (x) { return x.state === 'ready' || x.state === 'review'; });
    } else if (_filter !== 'all') {
      list = list.filter(function (x) { return x.state === _filter; });
    }
    if (!list.length) {
      h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        esc(c.total ? 'No product is in that state right now.'
          : 'The API served an empty catalog, so there is nothing to map.') + '</div>';
    }
    list.forEach(function (x) { h += rowHTML(P, x); });

    // What is still not true, said here rather than left to be discovered.
    var w = '', wn = 0;
    function w_(s) { w += note(P, s); wn++; }

    w_('THE POS CATALOG SCREEN IS UNTOUCHED. pos/screen-catalog.jsx renders its Weedmaps pill ' +
      'from hw-live.js, which already downgrades an unmapped SKU with its own sentence ' +
      '(hw-live.js:518-521). This seam deliberately writes nothing into window.HW.PRODUCTS — two ' +
      'seams overwriting one wm.issue string is a race whose winner is whichever fetch landed ' +
      'last. It publishes a read-only mirror at window.HW.WM_MAPPING instead.');

    if (_verdicts) {
      w_('A HUMAN REJECTION IS INFERRED, NOT READ. mapping.reject() records it in the ' +
        'mapping_events table (wmdemo/mapping.py:902-907) and NO endpoint serves that table. The ' +
        'only client-visible trace is the dashboard log line the route writes (server.py:825), so ' +
        'this panel scans /api/state events newest-first and takes the first verdict per SKU — the ' +
        'same last-event-wins rule the server\'s own sticky check uses. ' + _evCount +
        ' mapping verdict(s) are visible in that window, which reaches back to ' + ago(_evHorizon) + '.');
      w_('The limit of that inference, stated so nobody trusts it further than it goes: the log ' +
        'holds the last 500 events, so a rejection older than that window is INVISIBLE here and ' +
        'this board will call the SKU "no confident match" instead. It also cannot see the nightly ' +
        'job\'s own per-SKU mapping events, which log only as one summary line — so a SKU rejected ' +
        'and later auto-mapped is shown by its mapping, never by the stale rejection.');
    } else {
      w_('HUMAN REJECTIONS ARE NOT SHOWN AT ALL right now: ' + base + '/api/state did not answer (' +
        (_stateErr || 'unknown') + '), and that event log is the only client-visible trace of one. ' +
        'Any SKU a person rejected is therefore drawn as "no confident match" — the state is ' +
        'missing, not empty.');
    }

    if (_absErr) {
      w_('THE ABSENCE LEDGER DID NOT ANSWER (' + _absErr + '), so no row on this board can say ' +
        'Weedmaps genuinely lacks a product. Nothing is shown as "not on WM" — that is a missing ' +
        'answer, not a negative one.');
    } else {
      w_('"Not on Weedmaps" is the ledger\'s word, never this panel\'s: ' + (_absConfirmed || 0) +
        ' confirmed of ' + (_absCount || 0) + ' tracked. ' + (_absNote || '') +
        ' A truncated feed cannot manufacture an absence — the server refuses to score one below ' +
        'half the feed size (wmdemo/mapping.py:550-560).');
    }

    w_('No threshold is re-derived here. T_AUTO and T_AI live in wmdemo/mapping.py:34-35 and are ' +
      'not served, so every verdict word on this board — exact, auto, ai, reject, queued — is the ' +
      'server\'s own, and the score bars are drawn in ink, never in a green this file decided.');

    w_('The list read is POST /api/mapping/bulk with rescore_all, which scores every SKU against ' +
      'every cached WM product on the server. It is the reason a SKU the nightly job has never ' +
      'touched still shows a candidate. It also means this panel re-reads /api/state, which ' +
      'hw-live.js is already polling: one duplicated ~100KB read per refresh, for the push record ' +
      'and the event log, neither of which any other endpoint serves.');

    w_('Still mock on this panel: nothing. Every row, score, id and verdict is served. What is ' +
      'NOT here: SKU→sub-category assignment (no HTTP route), and any way to make Weedmaps ' +
      'itself confirm a listing right now — "accepted an item id" is the strongest claim the ' +
      'API can support and is the strongest one made.');

    h += whyBlock(P, 'data-hwm', _why, w, wn);
    return h;
  }

  // pos/tokens.jsx is a text/babel script: on a cold load Babel needs seconds to
  // compile it, and the API answers sooner. So the FIRST paint often runs before
  // window.THEMES exists. Bailing out there and never trying again is how a seam
  // reports `live` with a full board behind it and renders no pill at all.
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
      _el = document.createElement('div');
      _el.id = 'hw-mapping-badge';
      _el.style.cssText = 'display:flex;pointer-events:none';
      D.tray().appendChild(_el);

      _panel = document.createElement('div');
      _panel.id = 'hw-mapping-panel';
      _panel.setAttribute('role', 'dialog');
      _panel.setAttribute('aria-label', 'Weedmaps product mapping');
      D.slot().appendChild(_panel);

      _el.addEventListener('click', onClick);
      _panel.addEventListener('click', onClick);
      // The query box is rebuilt on every repaint, so its value is kept here
      // rather than in the DOM — and typing must NOT repaint, or the caret
      // jumps to the end on every keystroke.
      _panel.addEventListener('input', function (e) {
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-hwm-q')) {
          _candQuery = e.target.value;
        }
      });
      _panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') { return; }
        if (!e.target || !e.target.hasAttribute || !e.target.hasAttribute('data-hwm-q')) { return; }
        e.preventDefault();
        if (_openSku) { loadCandidates(_openSku); }
      });
      _el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        toggle();
      });
      D.register(SEAM_ID, function () { if (_open) { _open = false; paint(); } });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits no
        // event, so the style attribute is the only signal a plain-JS module has.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _panel.querySelector('[data-hwm-scroll]');
    if (body) { _scroll = body.scrollTop; }

    var c = counts();
    var short = _status === 'live' ? (c.total - c.linked) : 0;
    var dot = _status !== 'live' ? P.inkFaint : short ? P.bad : P.good;
    var label = _status === 'live' ? 'WM products' :
                _status === 'pending' ? 'WM products…' :
                _status === 'slow' ? 'WM products — still loading' : 'WM products (no API)';
    var detail = _status !== 'live' ? base.replace(/^https?:\/\//, '') :
      c.linked + '/' + c.total + ' linked' +
      ((c.ready + c.review) ? ' · ' + (c.ready + c.review) + ' to decide' : ' · nothing to decide');
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (short ? short + ' unlinked' : '');

    _el.innerHTML = pillHTML(P, 'data-hwm', dot, label, sub,
      label + ' · ' + detail + ' — click for the mapping board');

    _panel.style.cssText = panelCSS(P, D, _open);
    if (!_open) { _panel.innerHTML = ''; return; }

    _panel.innerHTML = panelShell(P, 'data-hwm', 'Weedmaps products · our catalog → theirs',
      panelHTML(P),
      '<div style="display:flex;gap:6px">' +
      '<button data-hwm="refresh" style="flex:1 1 auto;min-height:' + P.ctrlH.sm +
      'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">' +
      (_busy ? 'working…' : 'Re-read the board') + '</button>' +
      '<button data-hwm="pull" title="POST /api/mapping/pull with no source — the route defaults ' +
      'to the QA fixture (wmdemo/server.py:800). A live partner-API pull needs source:live and is ' +
      'not wired to this button." style="flex:0 0 auto;min-height:' + P.ctrlH.sm +
      'px;padding:0 9px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">Re-pull feed (fixture)</button></div>');

    body = _panel.querySelector('[data-hwm-scroll]');
    if (body) { body.scrollTop = _scroll; }
  }

  // ONE panel at a time, and never open on arrival.
  function toggle() {
    _open = !_open;
    if (_open) { var D = dock(); if (D) { D.opened(SEAM_ID); } }
    paint();
  }

  function onClick(e) {
    var t = e.target;
    var act = t && t.getAttribute && t.getAttribute('data-hwm');
    var sku = t && t.getAttribute && t.getAttribute('data-sku');
    if (act === 'close') { e.stopPropagation(); _open = false; paint(); return; }
    if (act === 'why') { e.stopPropagation(); _why = !_why; paint(); return; }
    if (act === 'refresh') { e.stopPropagation(); load(); return; }
    if (act === 'pull') { e.stopPropagation(); pull(); return; }
    if (act === 'filter') {
      e.stopPropagation();
      _filter = t.getAttribute('data-f') || 'all';
      paint();
      return;
    }
    if (act === 'cands') {
      e.stopPropagation();
      if (_openSku === sku) { _openSku = null; _cands = null; _candStatus = 'idle'; paint(); return; }
      _openSku = sku; _candQuery = '';
      loadCandidates(sku);
      return;
    }
    if (act === 'search') { e.stopPropagation(); if (sku) { loadCandidates(sku); } return; }
    if (act === 'rescore') { e.stopPropagation(); if (sku) { rescore(sku); } return; }
    if (act === 'approve') {
      e.stopPropagation();
      approve(sku, t.getAttribute('data-wm'));
      return;
    }
    if (act === 'unmap') {
      e.stopPropagation();
      // Unlinking is reversible and the API keeps the row as audit, so it asks
      // once rather than blocking behind a typed reason.
      if (!W.confirm('Unlink ' + sku + ' from its Weedmaps product?\n\n' +
                     'The mapping row is kept as an audit record and the catalog link is cleared. ' +
                     'The SKU re-enters the scoring pool.')) { return; }
      unmap(sku);
      return;
    }
    if (act === 'reject') {
      e.stopPropagation();
      // A rejection is STICKY, so it is the one action here that asks for a
      // reason: an unexplained sticky verdict is indistinguishable from an
      // accident six months later, and it is the reason the row will give.
      var reason = W.prompt('Why does no Weedmaps product match ' + sku + '?\n' +
                            'This is STICKY — the matcher stops reconsidering this SKU until the ' +
                            'product itself changes.', 'no_match');
      if (reason == null || !String(reason).trim()) { return; }
      reject(sku, String(reason).trim());
      return;
    }
    if (t && /^(SELECT|OPTION|INPUT|BUTTON)$/.test(t.tagName)) { return; }
    // A stray click inside the open panel must not close it -- only the pill
    // toggles, and only the x and Escape close.
    if (_panel && _panel.contains(t)) { return; }
    toggle();
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_MAPPING = {
    __armed: armed,
    get status() { return _status; },
    get rows() { return rows(); },
    get counts() { return counts(); },
    get absences() { return _absBySku; },
    get base() { return base; },
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _status = 'pending'; paint();
      return load();
    },
    candidates: loadCandidates,
    approve: approve,
    reject: reject,
    unmap: unmap,
    rescore: rescore,
    pull: pull,
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
