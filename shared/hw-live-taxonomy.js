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
// WHY THE BOARD IS IN THIS PANEL AND NOT ON THAT SCREEN. `SEED` is a
// module-scope const inside a Babel-compiled .jsx, and the screen holds it in
// `React.useState(SEED)` (screen-categories.jsx:130). There is no window handle
// and no props seam — the component simply cannot be driven from outside
// without editing it, and this unit owns exactly one new file plus one script
// tag. So the LIVE board renders here, in the seam's own panel, and that screen
// is untouched and still shows its own invented data. That is stated on the
// panel rather than left for someone to discover.
//
// THE FOUR STATES, AND WHY THEY ARE DRAWN AS DIFFERENTLY AS THEY ARE.
//   mapped   — one or more LIVE WM nodes. Publishes.
//   unmapped — AN OUTAGE, not a gap on a to-do list. Every product under it is
//              rejected by Weedmaps and no amount of re-syncing fixes it.
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
//   board from a screen with no fetch code of their own.
// Turn it off: append `?hwtax=off`, or run `HW_TAXONOMY.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_TAXONOMY && W.HW_TAXONOMY.__armed) { return; }   // idempotent

  var TIMEOUT_MS = 6000;
  var OFF_KEY = 'hw-taxonomy-off';
  var RAIL_W = 74;               // shared/app-rail.jsx:46 — clear the rail
  var BOTTOM = 90   // STACKED, NOT STACKED ON.
  // Every seam picked its own "clear the siblings" offset without knowing the
  // others existed, so three pills landed on the same 90px line at the same
  // z-index. The last one in the DOM won elementFromPoint() everywhere and the
  // panels behind it were openable only from the console -- a feature nobody
  // can click is a feature nobody has. Taxonomy 90, identity 126, check-in 162.;               // clears hw-live.js's badge (bottom 14 + 30)

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
  var _open = false, _busy = false;
  var _msg = null, _msgOk = false;
  var _el = null, _scroll = 0;

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
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', cache: 'no-store',
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (j) { return { ok: res.ok, code: res.status, body: j }; },
                             function () { return { ok: false, code: res.status, body: {} }; });
    }).then(function (r) {
      _busy = false;
      if (!r.ok) {
        _msgOk = false;
        _msg = 'Rejected ' + r.code + ': ' + ((r.body && r.body.error) || 'no reason given');
        paint();
        return { ok: false, error: (r.body && r.body.error) || ('HTTP ' + r.code) };
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

  function sectionTitle(P, s) {
    return '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:6px">' + esc(s) + '</div>';
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
             ' REJECTED by Weedmaps right now. Re-syncing does not fix it — only a mapping does.';
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
    var h = sectionTitle(P, 'Weedmaps taxonomy · the mapping board');

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
      '. A blocked product is rejected by Weedmaps and does not appear on the menu.</div></div>';

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

    // What is still not true, said here rather than left to be discovered.
    h += '<div style="margin-top:10px;padding-top:9px;border-top:1px solid ' + P.hairline + '">';
    h += note(P, 'THE CATEGORIES SCREEN ITSELF IS UNTOUCHED. pos/screen-categories.jsx still ' +
      'renders its own const SEED and 89 hand-typed Weedmaps LABELS with no ids ' +
      '(screen-categories.jsx:17-29, :38-62). Its board is a mockup; this one is the contract. ' +
      'They will disagree, and this one is right.');
    h += note(P, 'Why here and not there: SEED is a module-scope const held in React.useState ' +
      '(screen-categories.jsx:130) with no window handle, so the screen cannot be driven without ' +
      'editing it — and this seam is not allowed to. Wiring it is a one-line change for the POS ' +
      'devs: read window.HW.WM_TAXONOMY.rows instead of SEED.');
    var noSub = (cov.by_status || {}).no_sub_category || 0;
    if (noSub) {
      h += note(P, noSub + ' of ' + cov.products + ' live products carry NO sub-category at all, so ' +
        'this board cannot even speak for them — they are blocked before the mapping question is ' +
        'reached. They are counted in the blocked total above.');
    }
    var orphan = _nodes.filter(function (n) { return /^\?/.test(n.path || ''); }).length;
    if (orphan) {
      h += note(P, orphan + ' live node(s) show a path beginning "?": the last feed we seeded gave ' +
        'us the node but not its parent. We publish [parent, self], so those items carry a parent ' +
        'id with no row behind it. Two different things produce this and the board CANNOT tell ' +
        'them apart: Weedmaps RETIRED the parent (which is an outage, and the rows above do catch ' +
        'it when we hold a retired row for it), or the parent simply was not in the page we ' +
        'pulled. Re-fetch the taxonomy before treating these as broken.');
    }
    h += note(P, 'Node ids, paths and retirement come from the API\'s own wm_nodes table. This file ' +
      'contains no taxonomy list of its own — a second copy is exactly the drift this board exists ' +
      'to end.');
    h += note(P, 'Still mock on this panel: nothing. Still mock on the Categories SCREEN: all of it — ' +
      'its categories, its sub-categories, its WM node labels and its status pills.');
    h += note(P, 'SKU→sub-category assignment has no HTTP route yet, so the per-row product counts ' +
      'move only when someone writes to the API directly. Every other control here is live.');
    h += '</div>';
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

  function paint() {
    if (!armed) { return; }
    var P = palette();
    if (!P) { paintWhenThemed(); return; }   // no tokens yet -> wait, never a hex here

    if (!_el) {
      _el = document.createElement('div');
      _el.id = 'hw-taxonomy-badge';
      document.body.appendChild(_el);
      _el.addEventListener('click', onClick);
      _el.addEventListener('keydown', function (e) {
        if (e.target && /^(SELECT|OPTION|INPUT)$/.test(e.target.tagName)) { return; }
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        onClick(e);
      });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits no
        // event, so the style attribute is the only signal a plain-JS module has.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _el.querySelector('[data-hwt-scroll]');
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
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '') :
      (_coverage ? _coverage.publishable + '/' + _coverage.products + ' publish' : '') +
      (broken ? ' · ' + broken + ' broken' : ' · clean');

    _el.style.cssText = 'position:fixed;left:' + (RAIL_W + 12) + 'px;bottom:' + BOTTOM + 'px;' +
      'z-index:2147482001;pointer-events:none;font-family:' + P.fontSans +
      ';max-width:min(430px,calc(100vw - ' + (RAIL_W + 28) + 'px));';

    var html = '';
    if (_open) {
      html += '<div style="background:' + P.surface + ';border:1px solid ' + P.hairline2 +
        ';border-radius:' + P.r12 + 'px;box-shadow:' + P.shadowLg + ';padding:13px;margin-bottom:8px;' +
        'pointer-events:auto"><div data-hwt-scroll style="max-height:66vh;overflow:auto">' +
        panelHTML(P) + '</div>' +
        '<button data-hwt="refresh" style="margin-top:11px;width:100%;min-height:' + P.ctrlH.sm +
        'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 +
        ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' + P.type.meta +
        'px;font-weight:600;cursor:pointer">' + (_busy ? 'working…' : 'Re-fetch /api/taxonomy') +
        '</button></div>';
    }
    html += '<div role="button" tabindex="0" data-hw-i data-hwt="toggle" title="' +
      esc(label + ' — click for the board') + '" style="display:inline-flex;align-items:center;gap:8px;' +
      'min-height:' + P.ctrlH.xs + 'px;padding:0 12px;border-radius:' + P.r999 + 'px;background:' +
      P.surface + ';border:1px solid ' + P.hairline2 + ';box-shadow:' + P.shadowSm +
      ';cursor:pointer;user-select:none;pointer-events:auto">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + dot +
      ';flex:0 0 auto"></span>' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(label) + '</span>' +
      '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' +
      ff(P.fontMono) + '">' + esc(sub) + '</span></div>';

    _el.innerHTML = html;

    body = _el.querySelector('[data-hwt-scroll]');
    if (body) { body.scrollTop = _scroll; }
  }

  function onClick(e) {
    var t = e.target;
    var act = t && t.getAttribute && t.getAttribute('data-hwt');
    if (act === 'refresh') { e.stopPropagation(); load(); return; }
    if (act === 'map') {
      e.stopPropagation();
      var sid = t.getAttribute('data-sid');
      var sel = _el.querySelector('[data-hwt-node="' + sid + '"]');
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
    _open = !_open;
    paint();
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
