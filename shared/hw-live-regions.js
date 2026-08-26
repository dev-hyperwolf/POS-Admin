// ── shared/hw-live-regions.js ── region → Weedmaps listing, made visible ────
// Plain JS. Loads BEFORE React, on the POS entry HTML only. Sibling of
// shared/hw-live.js, hw-live-taxonomy.js, hw-live-identity.js,
// hw-live-checkin.js and hw-live-lines.js, and built to the same rules: the
// shared dock, one panel open at a time, armed on any origin, window.HW
// mutated IN PLACE, every write routed through W.HW_LIVE.post, and a panel
// that says out loud what it does not know instead of drawing a zero.
//
// WHY IT EXISTS. The owner asked: "How can I map our regions to a weedmaps
// listing (for pick up or for delivery?)". The mapping ALREADY EXISTS and is
// already live — wmdemo/catalog.py:109 defines the `region_menus` table,
// catalog.py:743 (set_region_menu) and catalog.py:773 (set_menu_mode) write
// it, engine.menu_plan() (engine.py:255) resolves it, and every sync and
// reconcile pass publishes from it. What does not exist is any way to SEE or
// CHANGE it. /api/state has been serving `region_menus` and `menu_plan` on
// every poll (server.py:226-227) and nothing on any screen reads either one.
// This file is the screen. It builds no engine and duplicates no rule.
//
// THE ONE THING THIS PANEL IS FOR: MODE, IN PLAIN LANGUAGE.
//   `full` / `pickup` = the PICKUP storefront. It sells the store's on-hand
//        stock, collected in person. engine._channel_for (engine.py:108) maps
//        both of these to the "pickup" inventory channel — the safe.
//   `kits` = DELIVERY. It sells the union of the ON-SHIFT driver kits,
//        zip-routed to a region. _channel_for maps it to "express".
//   The design's own tour already says this in as many words (shared/
//   tour-steps.js:391: "Pickup sells store on-hand stock... Delivery sells the
//   union of on-shift driver kits... mapping them the same way is the classic
//   mistake"). So mode is NOT a label and this panel never draws it as one: it
//   spells out what the listing publishes AND which channel it draws from, and
//   it asks before it changes either.
//
// MODE BELONGS TO THE LISTING, NOT TO THE ROW. set_region_menu refuses a mode
// that contradicts another region's claim on the same wmid (catalog.py:757) —
// "one menu, one mode". With three regions on a listing there is no legal
// ordering of per-row edits at all: the first one is rejected by the guard.
// That is why the mode control here is per LISTING and posts to /api/menu-mode
// (catalog.set_menu_mode, the escape hatch that guard needed), and why MAPPING
// a region into a listing sends that listing's CURRENT mode rather than the
// handler's `kits` default (server.py:598) — sending the default would 400
// against the storefront and read as "the server is broken".
//
// PUBLIC SURFACE: window.HW_REGIONS = { status, rows, plan, listings, regions,
//   base, refresh(), map(), unmap(), setActive(), setMode(), open(), close() }.
//   Mirrored onto window.HW.WM_REGION_MENUS so a POS dev can render the real
//   grid from a screen with no fetch code of their own.
// Turn it off: append `?hwregions=off`, or run `HW_REGIONS.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_REGIONS && W.HW_REGIONS.__armed) { return; }   // idempotent

  var TIMEOUT_MS = 6000;
  var OFF_KEY = 'hw-regions-off';
  var SEAM_ID = 'regions';

  // ── gate ─────────────────────────────────────────────────────────────────
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' — it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // dropped. Single quotes are equally valid CSS and survive the attribute.
  function ff(v) { return String(v).replace(/"/g, "'"); }

  // ── the seam dock ────────────────────────────────────────────────────────
  // Defined identically in every seam file: whichever loads first wins and the
  // rest reuse it, so there is exactly ONE tray and exactly ONE open panel
  // however many seams ship. Do not "improve" this copy alone — it is a shared
  // contract, and a divergent copy is a second tray.
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
      root: function () {
        if (D._root && D._root.parentNode) { return D._root; }
        var r = document.createElement('div');
        r.id = 'hw-seam-dock';
        r.setAttribute('data-hw-chrome', 'seam-dock');
        r.style.cssText = 'position:fixed;left:' + D.LEFT + 'px;bottom:' + D.BOTTOM +
          'px;z-index:var(--hwz-chromeDock);display:flex;flex-direction:column;align-items:flex-start;' +
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

  var override = qs('hwregions');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback — otherwise a
  // crafted link could point the page at an arbitrary host and have it render
  // that host's region map as the operator's own, with live write controls on
  // top of it.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }
  // ARMED ON ANY ORIGIN; the SAME-ORIGIN FETCH decides. On GitHub Pages
  // /api/state 404s, the fetch fails, and the panel says so instead of drawing
  // an empty grid. On the deployed demo it comes alive.
  var armed = !disabled;

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';
  var _rows = null;        // region_menus: [{region, wm_menu_id, mode, active}]
  var _plan = null;        // menu_plan: {wmid: {mode, regions, mode_conflict}}
  var _modes = [];         // menu_modes: the modes the server will accept
  var _wmids = null;       // {menu, delivery} — the CONFIGURED role of each pin
  var _regionNames = [];   // regions the estate actually has
  var _unrec = null;       // unreconciled_menus: {wmid: [region,...]}
  var _hw = null, _mirror = '';
  var _open = false, _busy = false, _why = false;
  var _msg = null, _msgOk = false;
  var _el = null, _panel = null, _scroll = 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Mirrors catalog.region_label (catalog.py:265): str.title() alone gives
  // "West La" — two-letter tokens in California region names are initialisms.
  function regionLabel(r) {
    return String(r || '').replace(/-/g, ' ').split(/\s+/).filter(Boolean)
      .map(function (w) { return w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1); })
      .join(' ');
  }

  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body.style.colorScheme;
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  // ── the vocabulary, in one place ─────────────────────────────────────────
  // Every sentence this panel says about a mode comes from here, so the grid,
  // the listing card and the confirm dialog cannot drift apart and describe the
  // same change two different ways.
  //
  // `channel` is not decoration: it is engine._channel_for (engine.py:108-127),
  // which decides which inventory the listing is priced and stocked from.
  var MODE_INFO = {
    full:   { sells: 'PICKUP',   channel: 'pickup',
              what: 'the store\'s on-hand stock, collected in person',
              chan: 'the store safe (pickup channel)' },
    pickup: { sells: 'PICKUP',   channel: 'pickup',
              what: 'the store\'s on-hand stock, collected in person',
              chan: 'the store safe (pickup channel)' },
    kits:   { sells: 'DELIVERY', channel: 'express',
              what: 'the union of the ON-SHIFT driver kits, zip-routed to a region',
              chan: 'the on-shift driver kits (express channel)' }
  };

  function modeInfo(mode) {
    if (mode && MODE_INFO[mode]) { return MODE_INFO[mode]; }
    // Unreachable against today's MENU_MODES, and still not a green tick: an
    // unknown mode has NO channel (engine._channel_for returns None) and the
    // listing silently falls back to the estate-wide THC range.
    return { sells: 'UNKNOWN', channel: null,
             what: 'nothing this panel can describe — the server accepted a mode ' +
                   'this file has no wording for',
             chan: 'NO inventory channel: engine._channel_for returns None for this mode' };
  }

  // The word the grid header and the card chip carry. A listing with NO rows has
  // no mode to read, which is a different fact from a mode this file has no
  // wording for -- and "UNKNOWN" said both, which reads as a parse failure when
  // it is really "nobody has mapped this pin".
  function sellsWord(wmid) {
    return listingMode(wmid) ? modeInfo(listingMode(wmid)).sells : 'NO MODE';
  }

  function listings() {
    // The union of every wmid that has a ROW and every wmid the config gives a
    // ROLE to. A configured pin with no rows at all must still get a column —
    // "this pin has no regions" is precisely the failure that is invisible
    // everywhere else, and leaving the column out would hide it here too.
    var seen = {};
    (_rows || []).forEach(function (r) { seen[String(r.wm_menu_id)] = true; });
    if (_wmids) {
      if (_wmids.menu != null) { seen[String(_wmids.menu)] = true; }
      if (_wmids.delivery != null) { seen[String(_wmids.delivery)] = true; }
    }
    var ids = Object.keys(seen);
    // Storefront first, delivery second, anything unrecognised after — the
    // order the owner reads them in, not numeric order.
    return ids.sort(function (a, b) { return rank(a) - rank(b) || (Number(a) - Number(b)); });
  }

  function rank(wmid) {
    if (!_wmids) { return 2; }
    if (String(_wmids.menu) === String(wmid)) { return 0; }
    if (String(_wmids.delivery) === String(wmid)) { return 1; }
    return 2;
  }

  // The role CONFIG gives the pin (server.py:234 — wmids), which is a different
  // fact from the mode the table gives it. Holding them apart is the whole
  // point of the mismatch check below.
  function roleOf(wmid) {
    if (!_wmids) { return null; }
    if (String(_wmids.menu) === String(wmid)) { return 'storefront'; }
    if (String(_wmids.delivery) === String(wmid)) { return 'delivery'; }
    return null;
  }

  function rowsFor(wmid) {
    return (_rows || []).filter(function (r) { return String(r.wm_menu_id) === String(wmid); });
  }

  function rowFor(region, wmid) {
    var f = (_rows || []).filter(function (r) {
      return r.region === region && String(r.wm_menu_id) === String(wmid);
    });
    return f.length ? f[0] : null;
  }

  // A listing's mode. menu_plan only carries ACTIVE rows (catalog.py:292), so a
  // listing whose rows are all paused would read as "no mode" from the plan
  // alone — and then a Map click would post the handler's `kits` default into
  // the storefront and be rejected. Fall through to the rows themselves.
  function listingMode(wmid) {
    var p = _plan && _plan[String(wmid)];
    if (p && p.mode) { return p.mode; }
    var rs = rowsFor(wmid);
    if (rs.length) { return rs[0].mode; }
    return null;
  }

  // What mode a brand-new mapping should carry when the listing has NO rows at
  // all and therefore no mode of its own. This is the ONLY place a default is
  // invented, it comes from the configured role, and the confirm dialog says
  // out loud that it is being invented.
  function defaultModeFor(wmid) {
    var role = roleOf(wmid);
    if (role === 'storefront') { return 'full'; }
    if (role === 'delivery') { return 'kits'; }
    return null;
  }

  function activeRows() { return (_rows || []).filter(function (r) { return r.active; }); }

  function listingsFeeding(region) {
    return listings().filter(function (id) {
      var r = rowFor(region, id);
      return !!(r && r.active);
    });
  }

  // Every region the panel must draw a line for: the estate's own regions PLUS
  // any region that only exists as a mapping row. An orphan row is a real state
  // (catalog.py:816 documents that orphaned region_menus rows have happened)
  // and dropping it from the grid would hide the one thing worth seeing.
  function allRegions() {
    var seen = {};
    _regionNames.forEach(function (r) { seen[r] = true; });
    (_rows || []).forEach(function (r) { seen[r.region] = true; });
    return Object.keys(seen).sort();
  }

  function isOrphanRegion(region) { return _regionNames.indexOf(region) < 0; }

  // A listing with rows but none active. server.py:232 serves this straight
  // from catalog.unreconciled_menus(), which exists because such a listing is
  // absent from the plan, never visited by sync or reconcile, and stays frozen
  // on Weedmaps with whatever was last pushed to it.
  function frozenListings() {
    if (!_unrec) { return []; }
    return Object.keys(_unrec);
  }

  function conflictListings() {
    if (!_plan) { return []; }
    return Object.keys(_plan).filter(function (k) {
      var c = _plan[k] && _plan[k].mode_conflict;
      return c && c.length;
    });
  }

  // The pin whose configured ROLE and whose MODE disagree. Getting the two
  // listing ids backwards was a real bug in this project, and this is the shape
  // it takes in the data: the delivery pin publishing store stock, or the
  // storefront publishing driver kits. Nothing else reports it.
  function backwardsListings() {
    return listings().filter(function (id) {
      var role = roleOf(id);
      var m = listingMode(id);
      if (!role || !m) { return false; }
      var ch = modeInfo(m).channel;
      if (role === 'storefront') { return ch !== 'pickup'; }
      return ch !== 'express';
    });
  }

  // What the pill counts. A region that feeds nothing, a frozen listing, a mode
  // conflict and a role/mode mismatch are all outages, not to-do items — and
  // "no active row at all" is counted as one more, because the fallback it
  // triggers means publishing continues out of this table's control.
  function brokenCount() {
    var unmapped = allRegions().filter(function (r) { return !listingsFeeding(r).length; }).length;
    return unmapped + frozenListings().length + conflictListings().length +
           backwardsListings().length + (activeRows().length ? 0 : 1);
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT — the lesson hw-live.js:32-39 already paid for.
  // Aborting on a timeout makes a slow-but-fine response indistinguishable from
  // a dead server, and on a cold load Babel is compiling thirty JSX files on
  // this same thread. The timer changes the LABEL only; the request runs to
  // completion and applies late.
  var _settled = false;
  function load() {
    _settled = false;
    var timer = setTimeout(function () {
      if (!_settled) { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);
    return fetch(base + '/api/state', {
      credentials: 'omit', cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    }).then(function (j) {
      clearTimeout(timer);
      _settled = true;
      // `region_menus` is the payload that makes this panel meaningful. A
      // /api/state without it is not this API answering, and rendering an empty
      // grid off it would say "no region feeds any listing" — the single worst
      // falsehood this screen could tell.
      if (!j || !Array.isArray(j.region_menus)) {
        _status = 'incomplete';
      } else {
        _rows = j.region_menus;
        _plan = j.menu_plan || {};
        _modes = Array.isArray(j.menu_modes) && j.menu_modes.length
          ? j.menu_modes : [];
        _wmids = j.wmids || null;
        _regionNames = j.regions ? Object.keys(j.regions).sort() : [];
        _unrec = j.unreconciled_menus || {};
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

  // POSTs. Every one goes through W.HW_LIVE.post — the shared write path that
  // owns the token, the same-origin rule and the server's error text — and
  // every refusal is shown VERBATIM. This API refuses a mode that contradicts
  // another region's claim on the same wmid, and refuses a mode change for a
  // wmid no region maps to. Both refusals are the contract explaining itself.
  function post(path, body, describe) {
    if (!armed) { return Promise.resolve({ ok: false, error: 'seam is off' }); }
    if (!W.HW_LIVE || typeof W.HW_LIVE.post !== 'function') {
      _msgOk = false;
      _msg = 'No write path: shared/hw-live.js is not on this page, and this seam ' +
             'deliberately has no fetch of its own for writes.';
      paint();
      return Promise.resolve({ ok: false, error: 'no write path' });
    }
    _busy = true; _msg = null; paint();
    return W.HW_LIVE.post(path, body).then(function (r) {
      _busy = false;
      if (!r.ok) {
        _msgOk = false;
        _msg = 'Rejected ' + r.code + ': ' +
               ((r.body && r.body.error) || r.error || 'no reason given');
        paint();
        return { ok: false, error: (r.body && r.body.error) || ('HTTP ' + r.code) };
      }
      _msgOk = true;
      _msg = describe;
      // Re-read the whole state rather than trusting the write's echo: the
      // write returns region_menus and menu_plan, but unreconciled_menus is
      // derived from them and is NOT in that echo. Patching the two we were
      // given and leaving the third stale is how a panel starts contradicting
      // itself one box down.
      return load().then(function () { return { ok: true }; });
    }).catch(function (e) {
      _busy = false; _msgOk = false;
      _msg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint();
      return { ok: false, error: 'request failed' };
    });
  }

  function mapRegion(region, wmid) {
    // Send the LISTING's current mode, never the handler's `kits` default
    // (server.py:598). set_region_menu raises "one menu, one mode" on anything
    // else (catalog.py:757) and the operator would read a correct guard as a
    // broken server.
    var mode = listingMode(wmid) || defaultModeFor(wmid);
    if (!mode) {
      _msgOk = false;
      _msg = 'Listing ' + wmid + ' has no rows and no configured role, so this ' +
             'panel does not know what mode a new mapping should carry. It will ' +
             'not guess one — set the mode on the listing first.';
      paint();
      return Promise.resolve({ ok: false, error: 'no mode' });
    }
    return post('/api/region-menu',
      { region: region, wm_menu_id: Number(wmid), mode: mode, active: true },
      regionLabel(region) + ' now feeds ' + wmid + ' (' + mode + ')');
  }

  function unmapRegion(region, wmid) {
    return post('/api/region-menu',
      { region: region, wm_menu_id: Number(wmid), delete: true },
      regionLabel(region) + ' no longer feeds ' + wmid);
  }

  function setActive(region, wmid, active) {
    var mode = listingMode(wmid) || defaultModeFor(wmid);
    var r = rowFor(region, wmid);
    if (r) { mode = r.mode; }     // never re-write a paused row's own mode
    if (!mode) { return Promise.resolve({ ok: false, error: 'no mode' }); }
    return post('/api/region-menu',
      { region: region, wm_menu_id: Number(wmid), mode: mode, active: !!active },
      regionLabel(region) + ' → ' + wmid + ' ' + (active ? 'resumed' : 'paused'));
  }

  function setMode(wmid, mode) {
    return post('/api/menu-mode', { wm_menu_id: Number(wmid), mode: mode },
      'listing ' + wmid + ' is now ' + mode + ' — ' + modeInfo(mode).sells);
  }

  // ── the one handle on window.HW ──────────────────────────────────────────
  // A PROPERTY WRITE on the object pos/data.jsx published, never
  // `window.HW = ...`: five modules capture window.HW.fmt.money at module
  // scope, and reassigning would leave them bound to a dead object. hw-live.js
  // also owns an accessor on `window.HW`, so this file POLLS for the object
  // rather than installing a second one — two accessors on one property is one
  // of them winning and the other never running.
  function publishToHW() {
    if (!_hw || !_rows) { return; }
    _hw.WM_REGION_MENUS = {
      rows: _rows,
      plan: _plan,
      listings: listings().map(function (id) {
        return { wm_menu_id: Number(id), role: roleOf(id), mode: listingMode(id),
                 channel: modeInfo(listingMode(id)).channel,
                 regions: rowsFor(id).filter(function (r) { return r.active; })
                            .map(function (r) { return r.region; }).sort() };
      }),
      regions: allRegions().map(function (r) {
        return { region: r, label: regionLabel(r), feeds: listingsFeeding(r).map(Number) };
      }),
      modes: _modes,
      wmids: _wmids,
      unreconciled: _unrec,
      source: base + '/api/state'
    };
    // Re-render only when the published mapping actually CHANGED. Nothing on
    // any screen reads this handle today (that is the gap this file documents,
    // not one it can close from here), so an unconditional rerender every poll
    // would be churn nobody asked for.
    var sig = JSON.stringify(_hw.WM_REGION_MENUS.listings) +
              JSON.stringify(_hw.WM_REGION_MENUS.regions);
    if (sig !== _mirror) {
      _mirror = sig;
      // ONE React root exists and hw-live.js holds it; ours would be a silent
      // no-op, so siblings re-render through it.
      if (W.HW_LIVE && typeof W.HW_LIVE.rerender === 'function') {
        try { W.HW_LIVE.rerender(); } catch (e) {}
      }
    }
  }

  var _tries = 0;
  function waitForHW() {
    if (W.HW) { _hw = W.HW; publishToHW(); return; }
    if (_tries++ > 200) { return; }         // ~30s, then give up quietly
    setTimeout(waitForHW, 150);
  }

  // ── panel ────────────────────────────────────────────────────────────────
  function chip(P, fg, bg, text) {
    return '<span style="display:inline-block;padding:2px 7px;border-radius:' + P.r999 + 'px;' +
      'background:' + bg + ';color:' + fg + ';font-size:' + P.type.micro + 'px;font-weight:800;' +
      'letter-spacing:.06em">' + esc(text) + '</span>';
  }

  function note(P, s) {
    return '<div style="display:flex;gap:7px;font-size:' + P.type.meta + 'px;color:' + P.inkDim +
      ';line-height:1.45;margin-bottom:5px"><span style="color:' + P.inkFaint + '">·</span><span>' +
      esc(s) + '</span></div>';
  }

  function box(P, fg, bg, title, bodyText) {
    return '<div style="border:1px solid ' + fg + ';background:' + bg + ';border-radius:' + P.r8 +
      'px;padding:8px 9px;margin-bottom:8px">' +
      '<div style="font-size:' + P.type.meta + 'px;font-weight:800;color:' + fg +
      ';letter-spacing:.04em">' + esc(title) + '</div>' +
      '<div style="font-size:' + P.type.meta + 'px;color:' + fg + ';line-height:1.45;margin-top:3px">' +
      esc(bodyText) + '</div></div>';
  }

  function mono(P, s) {
    return '<span style="font-family:' + ff(P.fontMono) + '">' + esc(s) + '</span>';
  }

  // ONE LISTING CARD. Everything on it is read off the server's own payload —
  // the id, the configured role, the mode, and the regions from menu_plan.
  function listingCardHTML(P, wmid) {
    var role = roleOf(wmid);
    var m = listingMode(wmid);
    var info = modeInfo(m);
    var rs = rowsFor(wmid);
    var act = rs.filter(function (r) { return r.active; });
    var frozen = frozenListings().indexOf(String(wmid)) >= 0;
    var conflict = (_plan && _plan[String(wmid)] && _plan[String(wmid)].mode_conflict) || [];
    var backwards = backwardsListings().indexOf(String(wmid)) >= 0;

    var bad = backwards || frozen || conflict.length || !act.length;
    var fg = bad ? P.bad : P.good;

    var h = '<div style="border:1px solid ' + P.hairline2 + ';border-left:3px solid ' + fg +
      ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:8px;background:' + P.surface2 + '">';

    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<div style="font-size:' + P.type.strong + 'px;font-weight:800;color:' + P.ink +
      ';font-family:' + ff(P.fontMono) + '">' + esc(wmid) + '</div>' +
      chip(P, fg, bad ? P.badSoft : P.goodSoft, sellsWord(wmid)) + '</div>';

    // The configured role, stated separately from the mode ON PURPOSE. They are
    // two different facts and the whole "which id is which" bug lives in the
    // gap between them.
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45;margin-top:3px">' +
      (role === 'storefront'
        ? 'The STOREFRONT pin (config wmids.menu).'
        : role === 'delivery'
          ? 'The DELIVERY pin (config wmids.delivery).'
          : 'Not one of the two configured pins — the server names only wmids.menu and ' +
            'wmids.delivery, so this panel cannot say what role this listing plays.') +
      '</div>';

    if (m) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;margin-top:4px">' +
        'Mode ' + mono(P, m) + ' — publishes ' + esc(info.what) + '.<br>' +
        'Draws its inventory from ' + esc(info.chan) + '.</div>';
    } else {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.45;margin-top:4px">' +
        'NO MODE: no region maps to this listing at all, so there is no row to read a mode from. ' +
        'It publishes nothing and /api/menu-mode will refuse a mode change until a region feeds it.</div>';
    }

    if (backwards) {
      h += '<div style="margin-top:6px">' + box(P, P.bad, P.badSoft, 'ROLE AND MODE DISAGREE',
        'This is the ' + (role === 'storefront' ? 'storefront' : 'delivery') + ' pin, but its mode is "' +
        m + '", which publishes ' + info.what + '. That is the two listings mapped backwards — ' +
        'the exact failure this project has already had once.') + '</div>';
    }

    if (conflict.length) {
      h += '<div style="margin-top:6px">' + box(P, P.bad, P.badSoft, 'MODE CONFLICT',
        'Regions claim this listing with conflicting modes [' + conflict.join(', ') + ']. ' +
        'The server publishes it as "' + m + '" by precedence and logs an alert on every write ' +
        'pass. One menu has one mode; this state should not be reachable.') + '</div>';
    }

    if (frozen) {
      h += '<div style="margin-top:6px">' + box(P, P.warn || P.bad, P.warnSoft || P.badSoft,
        'FROZEN ON WEEDMAPS',
        'This listing has ' + rs.length + ' mapping row(s) and NONE of them is active. It is absent ' +
        'from the plan, so sync and reconcile never visit it: whatever was last pushed stays live ' +
        'on Weedmaps and the self-healing loop is switched off for it.') + '</div>';
    }

    var paused = rs.length - act.length;
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + (act.length ? P.inkDim : P.bad) +
      ';margin-top:5px">' +
      (act.length
        ? act.length + ' region' + (act.length === 1 ? '' : 's') + ' feeding: ' +
          act.map(function (r) { return regionLabel(r.region); }).join(' · ') +
          (paused ? ' — plus ' + paused + ' paused' : '')
        : paused
          ? 'No region feeds this listing: all ' + paused + ' of its rows are paused.'
          : 'No region feeds this listing, and it has no rows at all.') + '</div>';

    // The mode control. Per LISTING, because mode is a property of the listing
    // (catalog.py:773) and per-row edits are refused by the one-menu-one-mode
    // guard before the first one lands.
    if (_modes.length && rs.length) {
      h += '<div style="display:flex;gap:6px;margin-top:7px;align-items:center">' +
        '<select data-hwr-mode="' + esc(wmid) + '" aria-label="Publish mode for listing ' + esc(wmid) + '" ' +
        'style="flex:1 1 auto;min-width:0;height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 +
        'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface + ';color:' + P.ink +
        ';font-family:' + P.fontSans + ';font-size:' + P.type.meta + 'px;padding:0 6px">' +
        _modes.map(function (x) {
          return '<option value="' + esc(x) + '"' + (x === m ? ' selected' : '') + '>' +
            esc(x) + ' — ' + esc(modeInfo(x).sells) + '</option>';
        }).join('') + '</select>' +
        '<button data-hwr="mode" data-wmid="' + esc(wmid) + '" style="flex:0 0 auto;height:' +
        P.ctrlH.sm + 'px;padding:0 10px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 +
        ';background:' + P.surface + ';color:' + P.ink2 + ';font-family:' + P.fontSans +
        ';font-size:' + P.type.meta + 'px;font-weight:700;cursor:pointer">Change mode…</button></div>';
    }

    h += '</div>';
    return h;
  }

  // THE GRID. Every region against every listing. A cell is the state PLUS the
  // control, because a grid you can read and not act on is the situation this
  // file exists to end.
  function gridHTML(P) {
    var ids = listings();
    var regs = allRegions();
    if (!regs.length) {
      return '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        'The API returned no regions and no mapping rows. There is nothing to map yet — ' +
        'this is an empty estate, not a healthy one.</div>';
    }

    var h = '<div style="overflow-x:auto;margin-bottom:9px">' +
      '<table style="width:100%;border-collapse:collapse;table-layout:fixed">';

    // Header: the id, and which pin it is, in plain words.
    h += '<tr><th style="width:78px;text-align:left;padding:0 4px 5px 0;font-size:' + P.type.micro +
      'px;font-weight:700;letter-spacing:.06em;color:' + P.inkMute + '">REGION</th>';
    ids.forEach(function (id) {
      var role = roleOf(id);
      var info = modeInfo(listingMode(id));
      // The header carries the word for what this pin CURRENTLY publishes (read
      // off its mode) over the role config gives it. When those two disagree
      // the header would otherwise read perfectly calmly — "DELIVERY /
      // storefront pin" — while being the exact backwards-listing bug. So the
      // disagreement is marked in the grid itself, not only on the card below.
      var backwards = backwardsListings().indexOf(String(id)) >= 0;
      h += '<th style="text-align:left;padding:0 0 5px 4px;font-size:' + P.type.micro +
        'px;font-weight:700;color:' + P.inkMute + ';letter-spacing:.04em">' +
        '<div style="color:' + (backwards ? P.bad : listingMode(id) ? P.ink2 : P.bad) +
        ';font-weight:800">' + esc(sellsWord(id)) + '</div>' +
        '<div style="font-family:' + ff(P.fontMono) + ';font-weight:500">' + esc(id) + '</div>' +
        '<div style="font-weight:500">' + esc(role === 'storefront' ? 'storefront pin'
          : role === 'delivery' ? 'delivery pin' : 'role unknown') + '</div>' +
        (backwards ? '<div style="color:' + P.bad + ';font-weight:800">⚠ role/mode disagree</div>' : '') +
        '</th>';
    });
    h += '</tr>';

    regs.forEach(function (region) {
      var feeds = listingsFeeding(region);
      var orphan = isOrphanRegion(region);
      h += '<tr><td style="vertical-align:top;padding:3px 4px 3px 0;border-top:1px solid ' +
        P.hairline + '">' +
        '<div style="font-size:' + P.type.meta + 'px;font-weight:700;color:' +
        (feeds.length ? P.ink : P.bad) + ';line-height:1.3">' + esc(regionLabel(region)) + '</div>' +
        (orphan ? '<div style="font-size:' + P.type.micro + 'px;color:' + P.bad + '">not a region</div>' : '') +
        '</td>';
      ids.forEach(function (id) {
        h += '<td style="vertical-align:top;padding:3px 0 3px 4px;border-top:1px solid ' +
          P.hairline + '">' + cellHTML(P, region, id) + '</td>';
      });
      h += '</tr>';
    });

    h += '</table></div>';
    return h;
  }

  function cellHTML(P, region, wmid) {
    var r = rowFor(region, wmid);
    var btn = 'width:100%;min-height:' + P.ctrlH.xs + 'px;border-radius:' + P.r8 +
      'px;font-family:' + P.fontSans + ';font-size:' + P.type.micro +
      'px;font-weight:800;letter-spacing:.04em;cursor:pointer;padding:2px 4px;line-height:1.25;';

    if (!r) {
      return '<button data-hwr="map" data-region="' + esc(region) + '" data-wmid="' + esc(wmid) + '" ' +
        'title="' + esc(regionLabel(region) + ' does not feed listing ' + wmid +
          ' — click to map it') + '" style="' + btn + 'border:1px dashed ' + P.hairline2 +
        ';background:transparent;color:' + P.inkMute + '">NOT MAPPED<br>' +
        '<span style="font-weight:600">map →</span></button>';
    }
    if (!r.active) {
      return '<button data-hwr="resume" data-region="' + esc(region) + '" data-wmid="' + esc(wmid) + '" ' +
        'title="' + esc('This row exists but is PAUSED: ' + regionLabel(region) +
          ' is not published to ' + wmid + '. Click to resume.') + '" style="' + btn +
        'border:1px solid ' + (P.warn || P.bad) + ';background:' + (P.warnSoft || P.badSoft) +
        ';color:' + (P.warn || P.bad) + '">PAUSED<br><span style="font-weight:600">resume →</span></button>';
    }
    return '<div style="display:flex;flex-direction:column;gap:3px">' +
      '<div style="border:1px solid ' + P.good + ';background:' + P.goodSoft + ';color:' + P.good +
      ';border-radius:' + P.r8 + 'px;padding:3px 5px;font-size:' + P.type.micro +
      'px;font-weight:800;letter-spacing:.04em;text-align:center">FEEDS</div>' +
      '<div style="display:flex;gap:3px">' +
      '<button data-hwr="unmap" data-region="' + esc(region) + '" data-wmid="' + esc(wmid) + '" ' +
      'title="' + esc('Stop ' + regionLabel(region) + ' feeding ' + wmid) + '" ' +
      'style="flex:1 1 0;min-height:24px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 +
      ';background:' + P.surface + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.micro + 'px;font-weight:700;cursor:pointer;padding:0">unmap</button>' +
      '<button data-hwr="pause" data-region="' + esc(region) + '" data-wmid="' + esc(wmid) + '" ' +
      'title="' + esc('Keep the row, stop publishing ' + regionLabel(region) + ' to ' + wmid) + '" ' +
      'style="flex:1 1 0;min-height:24px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 +
      ';background:' + P.surface + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.micro + 'px;font-weight:700;cursor:pointer;padding:0">pause</button>' +
      '</div></div>';
  }

  // The verdict lines. This is where "a region mapped to NO listing sells
  // nothing on Weedmaps" is said — on the region it is true of, not as a
  // general disclaimer.
  function verdictsHTML(P) {
    var h = '';
    allRegions().forEach(function (region) {
      var feeds = listingsFeeding(region);
      if (feeds.length) { return; }
      var rs = (_rows || []).filter(function (r) { return r.region === region; });
      h += box(P, P.bad, P.badSoft, regionLabel(region).toUpperCase() + ' SELLS NOTHING ON WEEDMAPS',
        rs.length
          ? 'It has ' + rs.length + ' mapping row(s) and every one of them is paused, so it ' +
            'publishes to no listing. Its stock is unsellable on Weedmaps and nothing else in the ' +
            'estate reports this.'
          : 'It is mapped to NO listing. Its stock is not published to either pin, it cannot be ' +
            'bought for pickup or for delivery, and nothing else in the estate reports this — ' +
            'validate_menu_for_region is deliberately quiet for a region with no rows.');
    });
    return h;
  }

  function panelHTML(P) {
    // NOT LIVE → the reason, never a grid. An empty grid here reads as "no
    // region feeds any listing", which is both false and the most alarming
    // thing this panel could say.
    if (_status !== 'live') {
      var why = _status === 'pending'
        ? 'Fetching ' + base + '/api/state. Nothing is drawn until it answers.'
        : _status === 'slow'
          ? 'Still waiting on ' + base + '/api/state after ' + (TIMEOUT_MS / 1000) + 's. The ' +
            'request has NOT been cancelled and will apply late if it lands.'
          : _status === 'incomplete'
            ? base + '/api/state answered, but with no `region_menus` array — that is not this ' +
              'API. Nothing here is drawn from a payload this panel does not recognise.'
            : _status === 'off'
              ? 'This seam is switched off (?hwregions=off, or HW_REGIONS.disable()).'
              : base + '/api/state did not answer.';
      return '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        esc(why) + '</div>' +
        '<div style="margin-top:8px;font-size:' + P.type.meta + 'px;color:' + P.inkDim +
        ';line-height:1.45">No grid is drawn without live data. An empty grid would read as ' +
        '"no region feeds any listing" — which would be a lie, and the most alarming one this ' +
        'panel is capable of telling.</div>';
    }

    var h = '';

    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim +
      ';line-height:1.45;margin-bottom:9px">Live from ' + mono(P, '/api/state') +
      ' — the ' + mono(P, 'region_menus') + ' table, which is what sync and reconcile actually ' +
      'publish from. Every id, mode and region below is the server\'s, not this file\'s.</div>';

    // The one global failure the grid cannot show, because it is about the
    // ABSENCE of rows: engine.menu_plan() falls back to the two config
    // constants with regions=None — "every region" — when no row is active.
    // Un-mapping everything therefore does NOT stop publishing; it silently
    // restores the pre-table behaviour of publishing every region to both pins.
    if (!activeRows().length) {
      h += box(P, P.bad, P.badSoft, 'NO ACTIVE MAPPING — AND THAT DOES NOT MEAN NOTHING PUBLISHES',
        'With no active row, engine.menu_plan() falls back to the two configured pins with ' +
        '"every region" behind each. Publishing does not stop; it reverts to the pre-table ' +
        'default and this table stops controlling it.');
    }

    h += verdictsHTML(P);

    if (_msg) {
      h += '<div style="margin-bottom:8px;font-size:' + P.type.meta + 'px;line-height:1.45;font-family:' +
        ff(P.fontMono) + ';color:' + (_msgOk ? P.ink2 : P.bad) + '">' + esc(_msg) + '</div>';
    }

    h += gridHTML(P);

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkMute +
      ';letter-spacing:.06em;font-weight:700;margin:10px 0 6px">THE TWO LISTINGS</div>';
    listings().forEach(function (id) { h += listingCardHTML(P, id); });

    var w = '', wn = 0;
    function w_(s) { w += note(P, s); wn++; }
    w_('SOURCE. Everything above is /api/state\'s own region_menus, menu_plan, menu_modes, ' +
      'wmids and unreconciled_menus. This file holds no region list, no listing list and no ' +
      'mode list of its own — a second copy is the drift every other board in this estate died of.');
    w_('MODE IS A PROPERTY OF THE LISTING, NOT OF THE ROW. set_region_menu refuses a mode that ' +
      'contradicts another region\'s claim on the same wmid (catalog.py:757), so with three ' +
      'regions on a listing there is no legal order of per-row edits — the first is rejected. ' +
      'That is why the mode control is on the listing card and posts to /api/menu-mode.');
    w_('MAPPING A REGION SENDS THE LISTING\'S CURRENT MODE, not the /api/region-menu handler\'s ' +
      '"kits" default (server.py:598). Sending the default would be rejected by that same guard ' +
      'against the storefront listing, and a correct refusal would read as a broken server.');
    w_('A MODE CHANGE IS NOT A LABEL. engine._channel_for (engine.py:108) maps full and pickup ' +
      'to the "pickup" channel and kits to "express", so changing the mode changes which ' +
      'inventory the listing is stocked and priced from as well as what it publishes. Nothing ' +
      'here changes until the next sync/reconcile pass — catalog.set_menu_mode does not touch WM.');
    w_('UNMAPPING DOES NOT UNPUBLISH ON WEEDMAPS. delete_region_menu drops our row only; the ' +
      'items already on the listing come down on the next reconcile pass, from the new plan.');
    w_('PAUSED IS NOT REMOVED. active=0 keeps the row and takes the region out of the plan. If ' +
      'every row on a listing is paused the listing is FROZEN: sync and reconcile never visit it ' +
      'and whatever was last pushed stays live on Weedmaps indefinitely.');
    w_('STILL MOCK ON THIS PANEL: nothing. Still missing from the app: no SCREEN reads this ' +
      'mapping. window.HW.WM_REGION_MENUS is published for a POS dev to render from, and today ' +
      'this panel is the only place the mapping is visible at all.');
    w_('NOT SHOWN HERE: which SKUs each listing ends up publishing. That is the taxonomy board ' +
      'and the catalog, one seam over — this panel answers "which pin does this region feed, and ' +
      'what does that pin sell", and deliberately does not re-derive the rest.');
    h += whyBlock(P, 'data-hwr', _why, w, wn);
    return h;
  }

  // pos/tokens.jsx is a text/babel script: on a cold load Babel needs seconds
  // to compile it while /api/state answers in milliseconds, so the FIRST paint
  // almost always runs before window.THEMES exists. Bailing out there and never
  // retrying is how a seam reports `live` with a full payload behind it and
  // renders no element at all.
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
      _el.id = 'hw-regions-badge';
      _el.style.cssText = 'display:flex;pointer-events:none';
      D.tray().appendChild(_el);

      _panel = document.createElement('div');
      _panel.id = 'hw-regions-panel';
      _panel.setAttribute('role', 'dialog');
      _panel.setAttribute('aria-label', 'Region to Weedmaps listing — the mapping grid');
      D.slot().appendChild(_panel);

      _el.addEventListener('click', onClick);
      _panel.addEventListener('click', onClick);
      // Only the PILL needs a key handler: it is a div with role=button.
      // Everything inside the panel is a real <button>/<select>, which the
      // browser already activates on Enter and Space.
      _el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        toggle();
      });
      D.register(SEAM_ID, function () { if (_open) { _open = false; paint(); } });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits
        // no event, so the style attribute is the only signal plain JS gets.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _panel.querySelector('[data-hwr-scroll]');
    if (body) { _scroll = body.scrollTop; }

    var broken = _status === 'live' ? brokenCount() : 0;
    var dot = _status !== 'live' ? P.inkFaint : broken ? P.bad : P.good;
    var label = _status === 'live' ? 'Region → listing' :
                _status === 'pending' ? 'Region → listing…' :
                _status === 'slow' ? 'Region → listing — still loading' :
                _status === 'incomplete' ? 'Region → listing (wrong API)' :
                'Region → listing (no API)';
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (broken ? broken + ' broken' : '');
    var detail = _status !== 'live' ? base.replace(/^https?:\/\//, '')
      : activeRows().length + ' live mapping(s) · ' + allRegions().length + ' region(s) · ' +
        listings().length + ' listing(s)' + (broken ? ' · ' + broken + ' broken' : ' · clean');

    // The dock's collapsed summary pill speaks for all seven seams, so each
    // reports its own tone and status rather than the pill guessing from the
    // DOM. Worst tone wins; see shared/hw-seam-dock.js tone().
    if (D.report) { D.report(SEAM_ID, dot, _status, label); }
    _el.innerHTML = pillHTML(P, 'data-hwr', dot, label, sub,
      label + ' · ' + detail + ' — click for the grid');

    _panel.style.cssText = panelCSS(P, D, _open);
    if (!_open) { _panel.innerHTML = ''; return; }

    _panel.innerHTML = panelShell(P, 'data-hwr',
      'Region → Weedmaps listing',
      panelHTML(P),
      '<button data-hwr="refresh" style="width:100%;min-height:' + P.ctrlH.sm +
      'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">' +
      (_busy ? 'working…' : 'Re-fetch /api/state') + '</button>');

    body = _panel.querySelector('[data-hwr-scroll]');
    if (body) { body.scrollTop = _scroll; }
  }

  function toggle() {
    _open = !_open;
    if (_open) { var D = dock(); if (D) { D.opened(SEAM_ID); } }
    paint();
  }

  // Every destructive or publishing-changing action confirms FIRST, and the
  // confirm spells out the consequence in the same words the panel uses. None
  // of these is a label change.
  function confirmUnmap(region, wmid) {
    var only = listingsFeeding(region).length <= 1;
    return W.confirm('Stop ' + regionLabel(region) + ' feeding listing ' + wmid + '?\n\n' +
      regionLabel(region) + '’s stock will no longer be published to that pin' +
      (only ? ', and it is the ONLY listing this region feeds — ' + regionLabel(region) +
              ' will sell NOTHING on Weedmaps.' : '.') + '\n\n' +
      'The Weedmaps listing itself is not touched here: its items come down on the next ' +
      'reconcile pass, from the new plan.');
  }

  function confirmPause(region, wmid) {
    return W.confirm('Pause ' + regionLabel(region) + ' → ' + wmid + '?\n\n' +
      'The row stays, but the region leaves the plan and stops publishing to that pin.\n\n' +
      'If this is the last active row on the listing, the listing is FROZEN: sync and reconcile ' +
      'never visit it again and whatever was last pushed stays live on Weedmaps.');
  }

  function confirmMode(wmid, from, to) {
    var fi = modeInfo(from), ti = modeInfo(to);
    var n = rowsFor(wmid).length;
    return W.confirm('Change listing ' + wmid + ' from "' + from + '" to "' + to + '"?\n\n' +
      'THIS IS NOT A LABEL. It changes what the listing publishes AND which inventory it ' +
      'draws from:\n\n' +
      '  now:  ' + from + ' → ' + fi.sells + ' — ' + fi.what + '\n' +
      '        stocked from ' + fi.chan + '\n\n' +
      '  after: ' + to + ' → ' + ti.sells + ' — ' + ti.what + '\n' +
      '        stocked from ' + ti.chan + '\n\n' +
      'Mode belongs to the listing, so this applies to all ' + n + ' region row(s) on it at once. ' +
      'Weedmaps is not touched now; the change publishes on the next sync/reconcile pass.');
  }

  function onClick(e) {
    var t = e.target;
    // A click can land on a <br> or a <span> inside a button — walk up to the
    // element that actually carries the action, or the inner markup makes the
    // control dead in exactly the places it looks most clickable.
    var el = t, act = null;
    while (el && el !== _panel && el !== _el) {
      if (el.getAttribute) {
        act = el.getAttribute('data-hwr');
        if (act) { break; }
      }
      el = el.parentNode;
    }
    if (!act && t && t.getAttribute) { act = t.getAttribute('data-hwr'); el = t; }

    if (act === 'close') { e.stopPropagation(); _open = false; paint(); return; }
    if (act === 'why') { e.stopPropagation(); _why = !_why; paint(); return; }
    if (act === 'refresh') { e.stopPropagation(); load(); return; }

    if (act === 'map') {
      e.stopPropagation();
      var reg = el.getAttribute('data-region'), wid = el.getAttribute('data-wmid');
      var mode = listingMode(wid);
      var invented = !mode;
      if (invented) { mode = defaultModeFor(wid); }
      var mi = modeInfo(mode);
      if (!W.confirm('Map ' + regionLabel(reg) + ' to listing ' + wid + '?\n\n' +
            'It will publish as "' + mode + '" — ' + mi.sells + ': ' + mi.what + ', stocked from ' +
            mi.chan + '.\n\n' +
            (invented
              ? 'No region maps to this listing yet, so that mode is the one its CONFIGURED ROLE ' +
                'implies, not one read from the table.'
              : 'That mode is the listing\'s own, read from the table — mode belongs to the ' +
                'listing, and a row cannot carry a different one.'))) { return; }
      mapRegion(reg, wid);
      return;
    }
    if (act === 'unmap') {
      e.stopPropagation();
      var r1 = el.getAttribute('data-region'), w1 = el.getAttribute('data-wmid');
      if (!confirmUnmap(r1, w1)) { return; }
      unmapRegion(r1, w1);
      return;
    }
    if (act === 'pause') {
      e.stopPropagation();
      var r2 = el.getAttribute('data-region'), w2 = el.getAttribute('data-wmid');
      if (!confirmPause(r2, w2)) { return; }
      setActive(r2, w2, false);
      return;
    }
    if (act === 'resume') {
      e.stopPropagation();
      setActive(el.getAttribute('data-region'), el.getAttribute('data-wmid'), true);
      return;
    }
    if (act === 'mode') {
      e.stopPropagation();
      var w3 = el.getAttribute('data-wmid');
      var sel = _panel && _panel.querySelector('[data-hwr-mode="' + w3 + '"]');
      var v = sel && sel.value;
      var cur = listingMode(w3);
      if (!v) { _msgOk = false; _msg = 'Pick a mode first.'; paint(); return; }
      if (v === cur) {
        _msgOk = false;
        _msg = 'Listing ' + w3 + ' is already "' + cur + '". Nothing sent.';
        paint();
        return;
      }
      if (!confirmMode(w3, cur, v)) { return; }
      setMode(w3, v);
      return;
    }

    if (t && /^(SELECT|OPTION|INPUT|BUTTON)$/.test(t.tagName)) { return; }
    // A stray click inside the open panel must not close it — only the pill
    // toggles, and only the × and Escape close.
    if (_panel && _panel.contains(t)) { return; }
    toggle();
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_REGIONS = {
    __armed: armed,
    get status() { return _status; },
    get rows() { return _rows; },
    get plan() { return _plan; },
    get modes() { return _modes; },
    get wmids() { return _wmids; },
    get unreconciled() { return _unrec; },
    get base() { return base; },
    listings: listings,
    regions: allRegions,
    modeOf: listingMode,
    channelOf: function (wmid) { return modeInfo(listingMode(wmid)).channel; },
    feeds: listingsFeeding,
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _status = 'pending'; paint();
      return load();
    },
    map: mapRegion,
    unmap: unmapRegion,
    setActive: setActive,
    setMode: setMode,
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
