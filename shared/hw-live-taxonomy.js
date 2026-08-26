// ── shared/hw-live-taxonomy.js ── the sub-category → Weedmaps mapping board ──
// Plain JS. Loads BEFORE React, on the POS entry HTML only. Sibling of
// shared/hw-live.js and deliberately built to the same rules: loopback-only
// gate, in-place mutation of window.HW (never a reassignment), silent fallback
// when nothing answers, and the panel says out loud what is still mock.
//
// WHAT IT IS. The guided tour calls the Categories screen "the whole contract
// in one screen". It is not one yet: pos/screen-categories.jsx drives its board
// from `const SEED` and `const WM_TAXONOMY` — 89 hand-typed Weedmaps node
// LABELS with no ids behind them (screen-categories.jsx:17-29, :38-62). A label
// cannot be published. Weedmaps requires a real category_id on every menu item,
// and a sub-category with none means every product under it is REJECTED.
//
// THE SCREEN IS NO LONGER BLIND (2026-08-20). pos/screen-categories.jsx now
// reads window.HW_TAXONOMY itself and writes through HW_TAXONOMY.map/unmap, so
// the Categories screen and this panel render the same rows and the same node
// ids. This panel stays because it is reachable from anywhere in the POS and
// because it states the seam's own status; it is a second view of one board,
// not the only honest one.
//
// THE FOUR STATES, AND WHY THEY ARE DRAWN AS DIFFERENTLY AS THEY ARE.
//   mapped   — one or more LIVE WM nodes. Publishes.
//   unmapped — AN OUTAGE, not a gap on a to-do list. Every product under it is
//              published to Weedmaps WITHOUT A CATEGORY, and no amount of
//              re-syncing fixes it. (This said "rejected" until 2026-08-20. It
//              is not rejected -- verified by executing build_item_payload on an
//              unmapped category: the payload is built, published stays true,
//              and category_ids is simply absent. A rejection would at least be
//              visible; publishing uncategorised is silent, which is why the
//              wrong word mattered.)
//   skipped  — a recorded DECISION that this never syncs, with its reason and
//              its author. "Skipped and unmapped look similar and mean opposite
//              things", so here they share no colour, no icon and no wording.
//   stale    — the mapping is fine and the node underneath it is gone. This is
//              the silent killer: the row looks healthy, WM rejects the items,
//              and nothing upstream raises anything. It has two causes and the
//              second is the one that hides — a LIVE node whose PARENT was
//              retired, because we publish [parent, self] and the dead parent
//              is in the payload.
//
// PUBLIC SURFACE: window.HW_TAXONOMY = { status, board, nodes, coverage,
//   refresh(), map(), unmap(), skip(), unskip() }. Also mirrored onto
//   window.HW.WM_TAXONOMY as a plain property so a POS dev can render the real
//   board from a screen with no fetch code of their own. pos/screen-categories.jsx
//   reads the getters above directly and is the primary consumer.
// Turn it off: append `?hwtax=off`, or run `HW_TAXONOMY.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_TAXONOMY && W.HW_TAXONOMY.__armed) { return; }   // idempotent

  var TIMEOUT_MS = 6000;
  var OFF_KEY = 'hw-taxonomy-off';
  var SEAM_ID = 'taxonomy';
  // POSITION IS NO LONGER THIS FILE'S BUSINESS. Every seam used to pick its own
  // "clear the siblings" bottom offset without knowing the others existed --
  // first three collided on one line, then they were spread up the left edge as
  // four stacked pills, and each opened a 66vh card ON TOP of the Order Queue.
  // dock() below owns the geometry for all four, so there is one tray and one
  // open panel instead of four modules guessing about each other.

  // ── gate ─────────────────────────────────────────────────────────────────
  // Same rule as hw-live.js: loopback only, so the GitHub Pages copy of this
  // repo never fetches anything and this file adds nothing but a no-op.
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' -- it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // discarded. That is not cosmetic here: it dropped the colour off the line
  // naming which Weedmaps node had died, which then computed black-on-near-black
  // and was INVISIBLE in dark mode. Single quotes are equally valid in CSS and
  // survive the attribute.
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
  // ⚠️ ONE OF SIX. This dock() fallback is duplicated verbatim in all six
  // shared/hw-live-*.js seams (lines, checkin, mapping, identity, taxonomy,
  // regions), and shared/hw-seam-dock.js is the real implementation this defers to.
  //
  // They are code-identical but NOT byte-identical — two of them are missing a
  // comment block the other four carry. That is the shape that bites: an edit lands
  // in five of six and the sixth silently keeps the old behaviour, with nothing to
  // flag it. If you change this function, change it in all six, or collapse them
  // into a shared helper and delete these.
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

  var override = qs('hwtax');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback — otherwise a
  // crafted link could point the page at an arbitrary host and have it render
  // that host's taxonomy as the operator's own.
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

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';
  var _board = null, _nodes = [], _coverage = null, _staleRows = [];
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

  function ago(sec) {
    if (!sec) { return 'never'; }
    var s = Math.max(0, Math.floor(Date.now() / 1000 - sec));
    if (s < 60) { return 'just now'; }
    if (s < 3600) { return Math.floor(s / 60) + 'm ago'; }
    if (s < 86400) { return Math.floor(s / 3600) + 'h ago'; }
    return Math.floor(s / 86400) + 'd ago';
  }

  function rows() { return (_board && _board.rows) || []; }
  function counts() { return (_board && _board.counts) || {}; }

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

  // The four states, drawn so that no two of them can be confused at a glance.
  // `skipped` is the only one that is quiet, and it is the only one carrying a
  // sentence somebody actually wrote.
  // `hasStale` is a SEPARATE argument because keying on state alone made the
  // one row this board exists for read as healthy. A partly-stale row is
  // state 'mapped' -- it does publish, on its live targets -- while silently
  // dropping the products on its retired ones. Drawn green it was
  // BYTE-IDENTICAL to a clean row, and its own warning sentence was painted
  // green too. A board whose whole purpose is that a stale mapping must not
  // look healthy cannot afford to draw the only stale-but-publishing row as
  // healthy.
  function tone(P, state, hasStale) {
    if (state === 'mapped' && hasStale) {
      return { fg: P.warn || P.bad, bg: P.warnSoft || P.badSoft,
               word: 'PUBLISHES · PARTLY STALE' };
    }
    if (state === 'mapped') { return { fg: P.good, bg: P.goodSoft, word: 'PUBLISHES' }; }
    if (state === 'unmapped') { return { fg: P.bad, bg: P.badSoft, word: 'OUTAGE · UNMAPPED' }; }
    if (state === 'stale') { return { fg: P.bad, bg: P.badSoft, word: 'OUTAGE · STALE' }; }
    return { fg: P.neutral, bg: P.neutralSoft, word: 'SKIPPED · DECIDED' };
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT. hw-live.js paid for this lesson already
  // (hw-live.js:32-39): aborting on a timeout makes a slow-but-perfectly-fine
  // response indistinguishable from a dead server, and on a cold load Babel is
  // compiling thirty JSX files on this same thread. Verified in the browser
  // 2026-08-19: with a 6s abort the pill read "WM taxonomy (no API)" against a
  // server that was answering fine. The timer now only changes the LABEL; the
  // request runs to completion and applies late.
  var _settled = false;
  function load() {
    _settled = false;
    var timer = setTimeout(function () {
      if (!_settled) { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);
    return fetch(base + '/api/taxonomy', {
      credentials: 'omit', cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    }).then(function (j) {
      clearTimeout(timer);
      _settled = true;
      // A payload with no board is not this API answering — refusing it beats
      // rendering an empty board and calling it live.
      if (!j || !j.board || !Array.isArray(j.board.rows)) {
        _status = 'unreachable';
      } else {
        _board = j.board;
        _nodes = Array.isArray(j.wm_nodes) ? j.wm_nodes : [];
        _staleRows = Array.isArray(j.stale) ? j.stale : [];
        _coverage = j.coverage || null;
        _status = 'live';
        publishToHW();
      }
      paint();
      return _status;
    }).catch(function () {
      clearTimeout(timer);
      _settled = true;
      _status = 'unreachable';
      paint();
      return _status;
    });
  }

  // POSTs. Each one shows the server's OWN reason on failure rather than
  // swallowing it: this API refuses a mapping onto a retired node, refuses a
  // skip while mappings exist, and refuses a mapping onto a skipped row — and
  // every one of those refusals is the contract explaining itself.
  function post(path, body) {
    if (!armed) { return Promise.resolve({ ok: false, error: 'seam is off' }); }
    _busy = true; _msg = null; paint();
    return W.HW_LIVE.post(path, body).then(function (r) {
      _busy = false;
      if (!r.ok) {
        // hw-live.js already produced the only honest sentence available for a
        // transport failure ('request failed: Failed to fetch', code 0). Dropping
        // it left every caller printing 'HTTP 0', which names no cause at all --
        // verified in the browser 2026-08-20 with the API stopped mid-session.
        var why = (r.body && r.body.error) || r.error || null;
        _msgOk = false;
        _msg = 'Rejected ' + r.code + ': ' + (why || 'no reason given');
        paint();
        return { ok: false, error: why || ('HTTP ' + r.code) };
      }
      _msgOk = true;
      var row = r.body && r.body.row;
      _msg = row ? (row.id + ' → ' + row.state +
                    (row.has_stale && row.state === 'mapped' ? ' (one target is stale)' : ''))
                 : 'done';
      return load().then(function () { return { ok: true, row: row }; });
    }).catch(function (e) {
      _busy = false; _msgOk = false;
      _msg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint();
      return { ok: false, error: 'request failed' };
    });
  }

  function mapNode(sid, nodeId) {
    return post('/api/taxonomy/map', { sub_category_id: sid, wm_node_id: Number(nodeId) });
  }
  function unmapNode(sid, nodeId) {
    return post('/api/taxonomy/map', { sub_category_id: sid, wm_node_id: Number(nodeId), remove: true });
  }
  function skip(sid, reason) {
    return post('/api/taxonomy/skip', { sub_category_id: sid, reason: reason });
  }
  function unskip(sid) {
    return post('/api/taxonomy/skip', { sub_category_id: sid, clear: true });
  }

  // ── the one handle on window.HW ──────────────────────────────────────────
  // A PROPERTY WRITE on the object pos/data.jsx published, never
  // `window.HW = ...`. hw-live.js documents why (five modules capture
  // window.HW.fmt.money at module scope); reassigning would leave them bound to
  // a dead object and formatting would keep silently working on nothing.
  // hw-live.js also owns an accessor on `window.HW`, so this file polls for the
  // object instead of installing a second one — two accessors on one property
  // is one of them winning and the other never running.
  var _blockedMarked = 0;

  function publishToHW() {
    if (!_hw || !_board) { return; }
    _hw.WM_TAXONOMY = {
      rows: _board.rows,
      counts: _board.counts,
      nodes: _nodes,
      stale: _staleRows,
      coverage: _coverage,
      generatedAt: _board.generated_at,
      source: base + '/api/taxonomy'
    };
    // Downgrade any catalog row this board knows is blocked, then re-render
    // through the ONE captured root (ours is null -- hw-live.js wraps
    // createRoot first, so a local rerender here would be a silent no-op).
    var n = markBlockedSkus();
    if (n && W.HW_LIVE && typeof W.HW_LIVE.rerender === 'function') {
      try { W.HW_LIVE.rerender(); } catch (e) {}
    }
    _blockedMarked = n;
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

  // One board row. Everything on it is read off the served row — nothing here
  // re-derives a state from the emptiness of `targets`, which is precisely how
  // skipped and unmapped become indistinguishable.
  function rowHTML(P, r) {
    var t = tone(P, r.state, !!(r && r.has_stale));
    var h = '<div style="border:1px solid ' + (r.state === 'mapped' ? P.hairline : t.fg) +
      ';border-left:3px solid ' + t.fg + ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:7px;' +
      'background:' + (r.state === 'skipped' ? 'transparent' : P.surface2) + '">';

    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<div style="font-size:' + P.type.strong + 'px;font-weight:700;color:' +
      (r.state === 'skipped' ? P.inkMute : P.ink) + '">' + esc(r.name) +
      '<span style="font-weight:500;color:' + P.inkFaint + ';font-size:' + P.type.meta + 'px"> · ' +
      esc(r.category) + '</span></div>' + chip(P, t, t.word) + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';font-family:' +
      ff(P.fontMono) + ';margin-top:1px">' + esc(r.id) + '</div>';

    // What this state MEANS for the SKUs sitting under it. The count is the
    // difference between a row on a list and an outage somebody has to fix.
    var n = r.sku_count;
    var skus = n + (n === 1 ? ' product' : ' products');
    var vb = n === 1 ? 'is' : 'are';
    var says;
    if (r.state === 'mapped' && r.has_stale) {
      says = 'Publishes ' + skus + ' on the live node — and silently DROPS them from the ' +
             'retired one below. Half-listed, with nothing anywhere reporting it.';
    } else if (r.state === 'mapped') {
      says = 'Publishes ' + skus + ' to Weedmaps under category_ids ' +
             (r.category_ids || []).join(' + ') + '.';
    } else if (r.state === 'unmapped') {
      says = 'NO Weedmaps node. All ' + skus + ' under this ' + vb +
             ' publishing to Weedmaps RIGHT NOW WITH NO CATEGORY. Re-syncing does not fix' +
             ' it — only a mapping does.';
    } else if (r.state === 'stale') {
      says = 'Weedmaps RETIRED the node underneath this mapping. All ' + skus +
             ' stopped appearing, the row still looks mapped, and nothing raised an error.';
    } else {
      says = 'Decided: never syncs. The ' + skus + ' here ' + vb + ' deliberately not on ' +
             'Weedmaps, and this row is NOT work to be done.';
    }
    h += '<div style="font-size:' + P.type.meta + 'px;line-height:1.45;margin-top:5px;color:' +
      (r.state === 'mapped' && !r.has_stale ? P.ink2 : r.state === 'skipped' ? P.inkMute : t.fg) +
      '">' + esc(says) + '</div>';

    if (r.state === 'skipped') {
      // The reason is the entire difference between this and `unmapped`, so it
      // is quoted verbatim with its author, never summarised away.
      h += '<div style="margin-top:6px;padding:6px 8px;border-left:2px solid ' + P.hairline3 +
        ';font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45">“' +
        esc(r.skip_reason) + '”<span style="color:' + P.inkFaint + '"> — ' +
        esc(r.skipped_by || 'unknown') + ', ' + esc(ago(r.skipped_at)) + '</span></div>';
    }

    (r.targets || []).forEach(function (tg) {
      var dead = tg.retired;
      h += '<div style="display:flex;gap:8px;align-items:center;margin-top:5px;font-size:' +
        P.type.meta + 'px;font-family:' + ff(P.fontMono) + ';color:' + (dead ? P.bad : P.ink2) + '">' +
        '<span style="flex:1;min-width:0">' + (dead ? '✕ ' : '→ ') + esc(tg.path || '(unknown node)') +
        ' <span style="color:' + P.inkFaint + '">#' + esc(tg.wm_node_id) + '</span></span>' +
        '<button data-hwt="unmap" data-sid="' + esc(r.id) + '" data-node="' + esc(tg.wm_node_id) +
        '" style="' + ctlCSS(P) + 'height:24px;cursor:pointer;font-family:' + P.fontSans +
        '">remove</button></div>';
      if (dead) {
        // The two causes need two different sentences, because they need two
        // different responses. `retired_ancestor` is the one that hides.
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.bad +
          ';line-height:1.4;margin-left:14px">' + esc(
            !tg.known ? 'We have never seen this node id. It was never seeded, or it came from a truncated fetch.'
            : tg.retired_ancestor != null
              ? 'THE SILENT ONE: this node is still live, but its PARENT (#' + tg.retired_ancestor +
                ') was retired. We publish [parent, self], so the payload carries a dead id and ' +
                'Weedmaps drops the item — while this row looks perfectly healthy.'
              : 'Weedmaps retired this node. The mapping is intact and the products are gone.'
          ) + '</div>';
      }
    });

    // Controls. A skipped row cannot be mapped and a mapped row cannot be
    // skipped — the API refuses both, naming the other, so the panel offers
    // only the move that is legal from here.
    h += '<div style="display:flex;gap:6px;margin-top:7px;align-items:center">';
    if (r.state === 'skipped') {
      h += '<button data-hwt="unskip" data-sid="' + esc(r.id) + '" style="' + ctlCSS(P) +
        'height:28px;cursor:pointer;font-family:' + P.fontSans + ';font-weight:600">Un-skip</button>' +
        '<span style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint +
        '">un-skipping returns it to UNMAPPED — i.e. back onto the work list</span>';
    } else {
      h += '<select data-hwt-node="' + esc(r.id) + '" style="' + ctlCSS(P) + 'height:28px;flex:1;min-width:0;font-family:' +
        P.fontSans + '">' + nodeOptions(P) + '</select>' +
        '<button data-hwt="map" data-sid="' + esc(r.id) + '" style="' + ctlCSS(P) +
        'height:28px;cursor:pointer;font-family:' + P.fontSans + ';font-weight:600">Map</button>';
      if (!(r.targets || []).length) {
        h += '<button data-hwt="skip" data-sid="' + esc(r.id) + '" style="' + ctlCSS(P) +
          'height:28px;cursor:pointer;font-family:' + P.fontSans + '">Skip…</button>';
      }
    }
    h += '</div></div>';
    return h;
  }

  // Real nodes, real ids, straight off /api/taxonomy's wm_nodes (the server
  // serves it pickable_only, i.e. WM's L2/L3 — a root is mappable but is not
  // what an operator picks). No label list lives in this file: a second copy of
  // WM's taxonomy is the bug this board exists to end.
  function nodeOptions(P) {
    if (!_nodes.length) {
      return '<option value="">no live WM nodes — the taxonomy has never been seeded</option>';
    }
    // A node whose path starts "?" is one WM gave us WITHOUT its parent, and we
    // publish [parent, self] — so picking it binds an id this estate has never
    // seen. Verified against the live API 2026-08-19: POST /api/taxonomy/map
    // ACCEPTS node #7 (live) whose parent #4 is retired, and the board calls the
    // resulting row `stale` the instant it is created. add_mapping only checks
    // the node's own `retired` flag (wmdemo/taxonomy.py:602-616). The picker
    // will not hide those nodes — hiding a state the data can hold is how it
    // stops being findable — it labels them.
    return '<option value="">pick a live Weedmaps node…</option>' + _nodes.map(function (n) {
      var orphan = /^\?/.test(n.path || '');
      return '<option value="' + esc(n.id) + '">' + esc(n.path) + '  #' + esc(n.id) +
        (orphan ? '  ⚠ parent missing from WM’s feed' : '') + '</option>';
    }).join('');
  }

  function panelHTML(P) {
    // The title now lives in the docked panel's own header, where it stays put
    // while the body scrolls.
    var h = '';

    if (_status !== 'live') {
      h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        esc(_status === 'off' ? 'This seam is switched off.'
          : _status === 'pending' ? 'Asking ' + base + '/api/taxonomy…'
          : _status === 'slow' ? 'Still waiting on ' + base + '/api/taxonomy after ' +
            TIMEOUT_MS + 'ms. The request was NOT aborted — it will land and this board will ' +
            'fill in. A slow answer is not a dead server.'
          : 'No API answered at ' + base + '/api/taxonomy. The Categories screen is showing its ' +
            'own built-in list, which carries no Weedmaps ids at all.') + '</div>';
      return h;
    }

    var c = counts(), cov = _coverage || {};
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;margin-bottom:9px">' +
      'Live from <span style="font-family:' + ff(P.fontMono) + '">' + esc(base) + '/api/taxonomy</span>. ' +
      'Every node id below is a real Weedmaps id.</div>';

    // The headline number: what can actually publish today.
    var blocked = cov.blocked || 0;
    h += '<div style="border:1px solid ' + (blocked ? P.bad : P.good) + ';background:' +
      (blocked ? P.badSoft : P.goodSoft) + ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:9px">' +
      '<div style="font-size:' + P.type.title + 'px;font-weight:800;color:' + (blocked ? P.bad : P.good) +
      ';font-family:' + ff(P.fontMono) + '">' + esc(cov.publishable) + ' of ' + esc(cov.products) +
      ' products can publish</div>' +
      '<div style="font-size:' + P.type.meta + 'px;color:' + (blocked ? P.bad : P.good) +
      ';line-height:1.45;margin-top:2px">' + esc(blocked) + ' are BLOCKED by this board: ' +
      esc(Object.keys(cov.by_status || {}).filter(function (k) { return k !== 'ok'; })
        .map(function (k) { return (cov.by_status[k]) + ' ' + k; }).join(' · ')) +
      '. A blocked product is NOT rejected: engine.py:192 looks the category up, misses,' +
      ' and engine.py:219 simply omits category_ids — so it publishes UNCATEGORISED. That is' +
      ' worse than a rejection, because a rejection is visible and this is not.</div></div>';

    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
      chip(P, tone(P, 'mapped'), c.mapped + ' mapped') +
      chip(P, tone(P, 'unmapped'), c.unmapped + ' unmapped') +
      chip(P, tone(P, 'stale'), c.stale + ' stale') +
      chip(P, tone(P, 'skipped'), c.skipped + ' skipped') +
      // Labelled "of which" because partly-stale rows are a SUBSET of mapped,
      // not a fifth bucket. Presented as a peer the chips summed to more than
      // there are rows, and an operator counting them finds one that is not
      // there.
      (c.partially_stale ? chip(P, { fg: P.warn || P.bad, bg: P.warnSoft || P.badSoft },
                                 c.partially_stale + ' of which partly stale') : '') +
      '</div>';

    if (_msg) {
      h += '<div style="margin-bottom:8px;font-size:' + P.type.meta + 'px;line-height:1.45;font-family:' +
        ff(P.fontMono) + ';color:' + (_msgOk ? P.ink2 : P.bad) + '">' + esc(_msg) + '</div>';
    }

    // Worst first: an operator opens this to find what is broken, not to browse.
    var order = { unmapped: 0, stale: 1, mapped: 2, skipped: 3 };
    var sorted = rows().slice().sort(function (a, b) {
      var d = order[a.state] - order[b.state];
      if (d) { return d; }
      if (a.state === 'mapped') {
        var s = (b.has_stale ? 1 : 0) - (a.has_stale ? 1 : 0);
        if (s) { return s; }
      }
      return (a.category + a.name).localeCompare(b.category + b.name);
    });
    if (!sorted.length) {
      h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        'The API has no sub-categories at all, so there is no contract to show. ' +
        'Every product is blocked on <span style="font-family:' + ff(P.fontMono) + '">no_sub_category</span>.</div>';
    }
    sorted.forEach(function (r) { h += rowHTML(P, r); });

    // What is still not true, said here rather than left to be discovered. It
    // is behind the WHY toggle, not deleted: eight paragraphs opening on top of
    // the board they describe is how this panel stopped being read at all.
    var w = '', wn = 0;
    function w_(s) { w += note(P, s); wn++; }
    w_('THE CATEGORIES SCREEN IS NOW WIRED TO THIS BOARD (2026-08-20). It reads ' +
      'window.HW_TAXONOMY directly — same rows, same node ids, same states — and writes through ' +
      'HW_TAXONOMY.map/unmap, so the two cannot disagree about what is mapped. Its hand-typed ' +
      'node labels survive only as the no-API fallback and are stamped MOCK wherever they show. ' +
      'This panel is now a second view of the same data, not the only honest one.');
    w_('The screen carries three checks this panel does not: our category NAME against ' +
      'Weedmaps\' tree (engine.py:176 resolves by lowercased name, and a miss publishes the item ' +
      'UNCATEGORISED rather than blocking it), a mapping whose WM ROOT disagrees with our ' +
      'top-level category, and the category_shutout in mapping.py:220. Corrections there are ' +
      'offered and never auto-applied.');
    var noSub = (cov.by_status || {}).no_sub_category || 0;
    if (noSub) {
      w_(noSub + ' of ' + cov.products + ' live products carry NO sub-category at all, so ' +
        'this board cannot even speak for them — they are blocked before the mapping question is ' +
        'reached. They are counted in the blocked total above.');
    }
    var orphan = _nodes.filter(function (n) { return /^\?/.test(n.path || ''); }).length;
    if (orphan) {
      w_(orphan + ' live node(s) show a path beginning "?": the last feed we seeded gave ' +
        'us the node but not its parent. We publish [parent, self], so those items carry a parent ' +
        'id with no row behind it. Two different things produce this and the board CANNOT tell ' +
        'them apart: Weedmaps RETIRED the parent (which is an outage, and the rows above do catch ' +
        'it when we hold a retired row for it), or the parent simply was not in the page we ' +
        'pulled. Re-fetch the taxonomy before treating these as broken.');
    }
    w_('Node ids, paths and retirement come from the API\'s own wm_nodes table. This file ' +
      'contains no taxonomy list of its own — a second copy is exactly the drift this board exists ' +
      'to end.');
    w_('Still mock on this panel: nothing. Still mock on the Categories SCREEN: nothing ' +
      'while this seam is live — it renders these same rows and node ids. Its own hand-typed ' +
      'labels appear only when no API answers, and they are labelled MOCK when they do. Its ' +
      'category COPY fields (descriptions, meta, FAQs) are still unwired: there is no route.');
    w_('SKU→sub-category assignment has no HTTP route yet, so the per-row product counts ' +
      'move only when someone writes to the API directly. Every other control here is live.');
    h += whyBlock(P, 'data-hwt', _why, w, wn);
    return h;
  }

  // pos/tokens.jsx is a text/babel script: on a cold load Babel needs seconds to
  // compile it, and /api/taxonomy answers in milliseconds. So the FIRST paint
  // almost always runs before window.THEMES exists. Bailing out there and never
  // trying again is how this panel rendered nothing at all while HW_TAXONOMY
  // reported `live` with a full board behind it — a seam that cannot visibly
  // fail is the same shape as a check that cannot fail. Verified in the browser
  // 2026-08-19: without this retry the badge element was never created.
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

  // THE CATALOG AND THIS BOARD DISAGREED ON THE SAME SCREEN.
  // hw-live.js derives a SKU's Weedmaps pill purely from our own record of a
  // past push (wm_menu_items.published / wm_item_id). It has no idea about the
  // sub-category gate, so 10 of the 11 rows it green-ticked "Synced · Pickup ·
  // Delivery" were SKUs this board calls blocked -- published uncategorised and
  // absent from the menu. An operator saw Blue Dream ticked, concluded it was
  // buyable, and did not chase it. The board 40px below said the opposite.
  //
  // A past push is not present publication. This downgrades those rows once we
  // know which SKUs the gate blocks, and says WHY on the row rather than just
  // changing a colour. It only ever downgrades -- it never invents a tick.
  function markBlockedSkus() {
    if (!_hw || !_coverage) { return 0; }
    // blocked_skus is a list of OBJECTS {sku, status, category} -- not strings.
    // An indexOf(p.sku) against it silently matches nothing, which would have
    // made this whole fix inert while looking correct: the exact shape this
    // project keeps repeating. Checked against the live payload, not assumed.
    var list = _coverage.blocked_skus || [];
    var byS = {};
    list.forEach(function (b) {
      if (b && b.sku) { byS[String(b.sku)] = b; }
      else if (typeof b === 'string') { byS[b] = { sku: b, status: 'blocked' }; }
    });
    var WHY = {
      no_sub_category: 'has no sub-category, so it carries no Weedmaps category id',
      unmapped: 'sits under a sub-category with NO Weedmaps node',
      stale: 'sits under a sub-category whose Weedmaps node was RETIRED',
      skipped: 'sits under a sub-category deliberately marked skipped'
    };
    var n = 0;
    (_hw.PRODUCTS || []).forEach(function (p) {
      var b = byS[String(p.sku)];
      if (!b || !p.wm) { return; }
      // ONLY EVER A DOWNGRADE. This never invents a tick.
      p.wm.state = 'error';
      p.wm.issue = 'Blocked by the Weedmaps taxonomy board: this SKU '
        + (WHY[b.status] || ('is blocked (' + String(b.status) + ')'))
        + '. Weedmaps REJECTS it — it is not on the menu, and re-syncing does '
        + 'not fix it. A past push is not present publication.';
      n++;
    });
    return n;
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
      // three seams around. Now the pill never moves and never stops being
      // clickable while its panel is open.
      _el = document.createElement('div');
      _el.id = 'hw-taxonomy-badge';
      _el.style.cssText = 'display:flex;pointer-events:none';
      D.tray().appendChild(_el);

      _panel = document.createElement('div');
      _panel.id = 'hw-taxonomy-panel';
      _panel.setAttribute('role', 'dialog');
      _panel.setAttribute('aria-label', 'Weedmaps taxonomy — the mapping board');
      D.slot().appendChild(_panel);

      _el.addEventListener('click', onClick);
      _panel.addEventListener('click', onClick);
      // Only the PILL needs a key handler: it is a div with role=button.
      // Everything inside the panel is a real <button>/<select>, which the
      // browser already activates on Enter and Space -- and a panel-wide
      // Enter/Space handler would have closed the panel on a stray keypress.
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

    var body = _panel.querySelector('[data-hwt-scroll]');
    if (body) { _scroll = body.scrollTop; }

    var c = counts();
    // partially_stale COUNTS AS BROKEN. It publishes on its live targets and
    // silently drops the products on its retired ones -- half-listed is not
    // fine, and leaving it out of this number is how the badge said "clean"
    // while a row was quietly dropping stock.
    var broken = (c.unmapped || 0) + (c.stale || 0) + (c.partially_stale || 0);
    var dot = _status !== 'live' ? P.inkFaint : broken ? P.bad : P.good;
    var label = _status === 'live' ? 'WM taxonomy' :
                _status === 'pending' ? 'WM taxonomy…' :
                _status === 'slow' ? 'WM taxonomy — still loading' : 'WM taxonomy (no API)';
    // detail is the whole sentence and goes in the tooltip AND the panel. The
    // pill carries only the part that is telling you something: what is broken,
    // or where the API that did not answer lives. A clean seam is a dot and a
    // name -- four fully-spelled pills is what made this tray three rows tall.
    var detail = _status !== 'live' ? base.replace(/^https?:\/\//, '') :
      (_coverage ? _coverage.publishable + '/' + _coverage.products + ' publish' : '') +
      (broken ? ' · ' + broken + ' broken' : ' · clean');
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (broken ? broken + ' broken' : '');

    // The dock's collapsed summary pill speaks for all seven seams, so each
    // reports its own tone and status rather than the pill guessing from the
    // DOM. Worst tone wins; see shared/hw-seam-dock.js tone().
    if (D.report) { D.report(SEAM_ID, dot, _status, label); }
    _el.innerHTML = pillHTML(P, 'data-hwt', dot, label, sub,
      label + ' · ' + detail + ' — click for the board');

    _panel.style.cssText = panelCSS(P, D, _open);
    if (!_open) { _panel.innerHTML = ''; return; }

    _panel.innerHTML = panelShell(P, 'data-hwt', 'Weedmaps taxonomy · the mapping board',
      panelHTML(P),
      '<button data-hwt="refresh" style="width:100%;min-height:' + P.ctrlH.sm +
      'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">' +
      (_busy ? 'working…' : 'Re-fetch /api/taxonomy') + '</button>');

    body = _panel.querySelector('[data-hwt-scroll]');
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
    var act = t && t.getAttribute && t.getAttribute('data-hwt');
    if (act === 'close') { e.stopPropagation(); _open = false; paint(); return; }
    if (act === 'why') { e.stopPropagation(); _why = !_why; paint(); return; }
    if (act === 'refresh') { e.stopPropagation(); load(); return; }
    if (act === 'map') {
      e.stopPropagation();
      var sid = t.getAttribute('data-sid');
      // The node picker lives in the PANEL now, not in the pill's wrapper.
      // Querying _el would have found nothing and every Map click would have
      // said "Pick a Weedmaps node first" with a node already picked.
      var sel = _panel && _panel.querySelector('[data-hwt-node="' + sid + '"]');
      var v = sel && sel.value;
      if (!v) { _msgOk = false; _msg = 'Pick a Weedmaps node first.'; paint(); return; }
      mapNode(sid, v);
      return;
    }
    if (act === 'unmap') {
      e.stopPropagation();
      unmapNode(t.getAttribute('data-sid'), t.getAttribute('data-node'));
      return;
    }
    if (act === 'skip') {
      e.stopPropagation();
      // The API refuses a blank reason, and it is right to: an unexplained skip
      // is indistinguishable from an accident six months later.
      var reason = W.prompt('Why does this sub-category never sync to Weedmaps?\n' +
                            'This reason is what makes SKIPPED different from UNMAPPED.');
      if (reason == null || !String(reason).trim()) { return; }
      skip(t.getAttribute('data-sid'), String(reason).trim());
      return;
    }
    if (act === 'unskip') { e.stopPropagation(); unskip(t.getAttribute('data-sid')); return; }
    if (t && /^(SELECT|OPTION|INPUT|BUTTON)$/.test(t.tagName)) { return; }
    // A stray click inside the open panel must not close it -- only the pill
    // toggles, and only the x and Escape close.
    if (_panel && _panel.contains(t)) { return; }
    toggle();
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_TAXONOMY = {
    __armed: armed,
    get status() { return _status; },
    get board() { return _board; },
    get nodes() { return _nodes; },
    get coverage() { return _coverage; },
    get stale() { return _staleRows; },
    get base() { return base; },
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _status = 'pending'; paint();
      return load();
    },
    map: mapNode,
    unmap: unmapNode,
    skip: skip,
    unskip: unskip,
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
