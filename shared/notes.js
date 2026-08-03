// Hyperwolf shared annotation layer — Figma-style comments pinned onto any
// prototype screen, synced to a small JSON backend so the whole team sees the
// same notes. Plain JS, no build step, no React. Loads LAST on every entry:
//   <script src="shared/notes.js"></script>
// Degrades to local-only (with a "not connected" badge) until NOTES_API is set.
(function () {
  if (window.__hwNotes) return; window.__hwNotes = true;

  // ── backend contract ───────────────────────────────────────────────────────
  const NOTES_API = 'https://hw-notes.hyperwolf.workers.dev';
  const NOTES_API_VERSION = 1;

  var K_PASS = 'hw-notes-passcode', K_AUTHOR = 'hw-notes-author';
  var K_CACHE = 'hw-notes-cache', K_QUEUE = 'hw-notes-queue';
  var LIVE = NOTES_API.indexOf('__') !== 0;
  var FILE = decodeURIComponent((location.pathname.split('/').pop() || 'index.html'));

  function ls(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }

  // ── palette ────────────────────────────────────────────────────────────────
  // Every colour resolves from pos/tokens.jsx. Pages without it (dev console)
  // fall back to CSS system colours — never a literal hex.
  var SYS = {
    mode: 'light', surface: 'Canvas', surface2: 'color-mix(in srgb, Canvas 94%, CanvasText)',
    surface3: 'color-mix(in srgb, Canvas 88%, CanvasText)', ink: 'CanvasText',
    inkDim: 'color-mix(in srgb, CanvasText 68%, Canvas)', inkMute: 'color-mix(in srgb, CanvasText 46%, Canvas)',
    hairline: 'color-mix(in srgb, CanvasText 12%, Canvas)', hairline2: 'color-mix(in srgb, CanvasText 22%, Canvas)',
    accent: 'AccentColor', accentInk: 'AccentColorText', accentBorder: 'AccentColor',
    accentSoft: 'color-mix(in srgb, AccentColor 18%, Canvas)',
    good: 'green', warn: 'darkorange', bad: 'crimson', info: 'royalblue', neutral: 'gray',
    scrim: 'color-mix(in srgb, CanvasText 45%, transparent)',
    fontMono: 'ui-monospace, Menlo, monospace', fontSans: 'Inter, -apple-system, system-ui, sans-serif',
  };
  function mode() { return ls('hw-pos-theme', 'light') === 'dark' ? 'dark' : 'light'; }
  function palette() {
    var T = window.THEMES;
    if (!T || !T[mode()]) return SYS;
    var P = T[mode()];
    return {
      mode: P.mode, surface: P.surface, surface2: P.surface2, surface3: P.surface3,
      ink: P.ink, inkDim: P.inkDim, inkMute: P.inkMute, hairline: P.hairline, hairline2: P.hairline2,
      accent: P.accent, accentInk: P.accentInk, accentBorder: P.accentBorder, accentSoft: P.accentSoft,
      good: P.good, warn: P.warn, bad: P.bad, info: P.info, neutral: P.neutral, scrim: P.scrim,
      fontMono: P.fontMono || SYS.fontMono, fontSans: P.fontSans || SYS.fontSans,
    };
  }
  // accent-text rule: yellow fails contrast on white, so accent TEXT is
  // accentBorder in light mode and accent in dark.
  function accText(P) { return P.mode === 'dark' ? P.accent : P.accentBorder; }
  function typeColor(P, t) {
    return t === 'bug' ? P.bad : t === 'idea' ? accText(P) : t === 'question' ? P.info : P.neutral;
  }

  // ── state ──────────────────────────────────────────────────────────────────
  var notes = jget(K_CACHE, { notes: [] }).notes || [];
  var stale = notes.length > 0, connected = false, authFail = false;
  var noteMode = false, panelOpen = false, showAll = false, showResolved = false;
  var filterStatus = 'all', filterType = 'all', filterAuthor = 'all';
  var pending = null, openThread = null, serverTime = null, polling = null;

  function author() { return ls(K_AUTHOR, ''); }
  function pass() { return ls(K_PASS, ''); }
  function route() { return location.hash || ''; }
  function normRoute(r) { return (r || '').replace(/^#/, '').replace(/\/$/, '') || '/'; }
  function onThisPage(n) { return n.page === FILE; }
  function onThisRoute(n) { return onThisPage(n) && normRoute(n.route) === normRoute(route()); }
  function uid() { return 'l-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function rel(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  // ── api ────────────────────────────────────────────────────────────────────
  function req(method, path, body) {
    if (!LIVE) return Promise.reject(new Error('offline'));
    var h = { 'X-Notes-Passcode': pass(), 'X-Notes-Author': author(), 'X-Notes-Version': String(NOTES_API_VERSION) };
    if (body !== undefined) h['Content-Type'] = 'text/plain';   // avoids CORS preflight
    return fetch(NOTES_API + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 401) { authFail = true; render(); throw new Error('401'); }
        if (!r.ok) throw new Error('http ' + r.status);
        authFail = false; return r.json();
      });
  }
  function cache() { lset(K_CACHE, JSON.stringify({ notes: notes, at: new Date().toISOString() })); }
  function merge(incoming) {
    (incoming || []).forEach(function (n) {
      var i = notes.findIndex(function (x) { return x.id === n.id; });
      if (i < 0) notes.push(n);
      else if (!notes[i].updatedAt || new Date(n.updatedAt) >= new Date(notes[i].updatedAt)) notes[i] = n;
    });
    notes = notes.filter(function (n) { return !n._deleted; });
    cache();
  }
  function queue(op) { var q = jget(K_QUEUE, []); q.push(op); lset(K_QUEUE, JSON.stringify(q)); }
  function flush() {
    var q = jget(K_QUEUE, []); if (!q.length || !LIVE) return Promise.resolve();
    lset(K_QUEUE, '[]');
    return q.reduce(function (p, op) {
      return p.then(function () {
        if (op.op === 'create') return req('POST', '/notes', op.body).then(function (r) { swap(op.localId, r.note); });
        if (op.op === 'update') return req('PATCH', '/notes/' + op.id, op.body).then(function (r) { merge([r.note]); });
        if (op.op === 'delete') return req('DELETE', '/notes/' + op.id);
        if (op.op === 'reply') return req('POST', '/notes/' + op.id + '/replies', op.body).then(function (r) { merge([r.note]); });
      }).catch(function () { queue(op); });
    }, Promise.resolve());
  }
  function swap(localId, server) {
    var i = notes.findIndex(function (x) { return x.id === localId; });
    if (i < 0) notes.push(server); else notes[i] = server;
    if (openThread === localId) openThread = server.id;
    cache(); render();
  }
  function pull() {
    if (!LIVE) { connected = false; return; }
    flush().then(function () {
      return req('GET', '/notes' + (serverTime ? '?since=' + encodeURIComponent(serverTime) : ''));
    }).then(function (r) {
      connected = true; stale = false; serverTime = r.serverTime || serverTime;
      merge(r.notes); render();
    }).catch(function () { connected = false; stale = true; render(); });
  }
  function startPoll() { stopPoll(); polling = setInterval(function () { if (document.visibilityState === 'visible') pull(); }, 15000); }
  function stopPoll() { if (polling) clearInterval(polling), polling = null; }

  // ── writes ─────────────────────────────────────────────────────────────────
  function ensureIdentity() {
    if (!author()) {
      var n = prompt('Your name (shown on your notes)');
      if (!n) return false; lset(K_AUTHOR, n.trim());
    }
    if (LIVE && !pass()) {
      var p = prompt('Team passcode');
      if (!p) return false; lset(K_PASS, p.trim());
    }
    return true;
  }
  function create(n) {
    var localId = uid();
    var note = Object.assign({ id: localId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), author: author(), status: 'open', replies: [] }, n);
    notes.push(note); cache(); render();
    var body = Object.assign({}, note); delete body.id;
    if (!LIVE) return;
    req('POST', '/notes', body).then(function (r) { swap(localId, r.note); })
      .catch(function () { queue({ op: 'create', localId: localId, body: body }); });
  }
  function patch(id, delta) {
    var i = notes.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
    notes[i] = Object.assign({}, notes[i], delta, { updatedAt: new Date().toISOString() });
    cache(); render();
    if (!LIVE) return;
    req('PATCH', '/notes/' + id, delta).then(function (r) { merge([r.note]); render(); })
      .catch(function () { queue({ op: 'update', id: id, body: delta }); });
  }
  function destroy(id) {
    notes = notes.filter(function (x) { return x.id !== id; });
    if (openThread === id) openThread = null;
    cache(); render();
    if (!LIVE) return;
    req('DELETE', '/notes/' + id).catch(function () { queue({ op: 'delete', id: id }); });
  }
  function reply(id, text) {
    var i = notes.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
    var r = { id: uid(), author: author(), body: text, createdAt: new Date().toISOString() };
    notes[i] = Object.assign({}, notes[i], { replies: (notes[i].replies || []).concat([r]), updatedAt: r.createdAt });
    cache(); render();
    if (!LIVE) return;
    req('POST', '/notes/' + id + '/replies', { author: r.author, body: r.body })
      .then(function (res) { merge([res.note]); render(); })
      .catch(function () { queue({ op: 'reply', id: id, body: { author: r.author, body: r.body } }); });
  }

  // ── anchoring ──────────────────────────────────────────────────────────────
  // These screens are inline-styled with no stable selectors, so we anchor on
  // element TEXT first and fall back to a percentage of the scroll canvas.
  function scroller() {
    var best = null, bestArea = 0;
    var all = document.querySelectorAll('div,main,section,aside,ul,tbody');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.closest('[data-hw-notes]')) continue;
      if (e.scrollHeight - e.clientHeight < 40 || e.clientHeight < 200) continue;
      var a = e.clientWidth * e.clientHeight;
      if (a > bestArea) { bestArea = a; best = e; }
    }
    return best || document.scrollingElement || document.documentElement;
  }
  function box(sc) {
    if (sc === document.scrollingElement || sc === document.documentElement) return { left: 0, top: 0, w: innerWidth, h: innerHeight };
    var r = sc.getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height };
  }
  function heading(el) {
    var probe = el, seen = 0;
    while (probe && seen++ < 400) {
      if (probe.previousElementSibling) probe = probe.previousElementSibling;
      else { probe = probe.parentElement; continue; }
      if (/^H[1-4]$/.test(probe.tagName)) return probe.textContent.trim().slice(0, 60);
      var h = probe.querySelector && probe.querySelector('h1,h2,h3,h4');
      if (h && h.textContent.trim()) return h.textContent.trim().slice(0, 60);
    }
    return '';
  }
  function capture(e) {
    var sc = scroller(), b = box(sc);
    var el = e.target;
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return {
      xPct: (e.clientX - b.left + sc.scrollLeft) / Math.max(1, sc.scrollWidth || b.w),
      yPct: (e.clientY - b.top + sc.scrollTop) / Math.max(1, sc.scrollHeight || b.h),
      elText: txt, elTag: (el.tagName || '').toLowerCase(), nearestHeading: heading(el),
    };
  }
  function locate(n) {
    var a = n.anchor || {}, sc = scroller(), b = box(sc);
    if (a.elText && a.elText.length > 2) {
      var want = a.elText.toLowerCase(), pool = [];
      var els = document.querySelectorAll(a.elTag && /^[a-z0-9]+$/.test(a.elTag) ? a.elTag : '*');
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        if (e.closest('[data-hw-notes]')) continue;
        if ((e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80).toLowerCase() !== want) continue;
        var r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        pool.push({ e: e, r: r, area: r.width * r.height });
      }
      pool.sort(function (x, y) { return x.area - y.area; });
      if (pool[0]) return { x: pool[0].r.left + Math.min(18, pool[0].r.width / 2), y: pool[0].r.top + pool[0].r.height / 2, exact: true };
    }
    return {
      x: b.left + (a.xPct || 0) * (sc.scrollWidth || b.w) - sc.scrollLeft,
      y: b.top + (a.yPct || 0) * (sc.scrollHeight || b.h) - sc.scrollTop, exact: false,
    };
  }

  // ── chrome ─────────────────────────────────────────────────────────────────
  var root = document.createElement('div');
  root.setAttribute('data-hw-notes', '');
  var style = document.createElement('style');
  document.head.appendChild(style);

  function css(P) {
    var acc = accText(P);
    return [
      '[data-hw-notes]{position:fixed;inset:0;z-index:2147480000;pointer-events:none;font-family:' + P.fontSans + '}',
      '[data-hw-notes] *{box-sizing:border-box}',
      '[data-hw-notes] button{font-family:inherit;cursor:pointer}',
      '.hwn-l{position:absolute;inset:0;pointer-events:none}',
      '.hwn-pin{position:fixed;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:99px;display:flex;align-items:center;justify-content:center;font-family:' + P.fontMono + ';font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums;pointer-events:auto;border:2px solid ' + P.surface + ';box-shadow:0 3px 10px ' + P.scrim + ';transition:transform .12s}',
      '.hwn-pin:hover{transform:translate(-50%,-50%) scale(1.14)}',
      '.hwn-pin.appx{border-style:dashed;border-color:' + P.hairline2 + '}',
      '.hwn-pin.res{opacity:.42;background:' + P.surface + ' !important}',
      '.hwn-tip{position:fixed;transform:translate(-50%,-100%);margin-top:-14px;max-width:236px;padding:7px 9px;border-radius:8px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + ';box-shadow:0 10px 26px ' + P.scrim + ';font-size:11.5px;line-height:1.42;color:' + P.ink + ';pointer-events:none}',
      '.hwn-btn{position:fixed;right:16px;bottom:120px;width:44px;height:44px;border-radius:13px;border:1px solid ' + P.hairline2 + ';background:' + P.surface + ';color:' + P.ink + ';pointer-events:auto;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px ' + P.scrim + ';transition:transform .12s}',
      '.hwn-btn:hover{transform:scale(1.06)}',
      '.hwn-btn.on{background:' + P.accent + ';color:' + P.accentInk + ';border-color:' + P.accentBorder + '}',
      '.hwn-badge{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:' + P.bad + ';color:' + P.surface + ';font-family:' + P.fontMono + ';font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid ' + P.surface + '}',
      '.hwn-conn{position:fixed;right:70px;bottom:129px;padding:3px 7px;border-radius:7px;background:' + P.surface + ';border:1px solid ' + P.hairline + ';font-family:' + P.fontMono + ';font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:' + P.inkMute + ';pointer-events:none;white-space:nowrap}',
      '.hwn-mode{position:fixed;left:50%;top:14px;transform:translateX(-50%);padding:7px 13px;border-radius:99px;background:' + P.accent + ';color:' + P.accentInk + ';font-size:12px;font-weight:650;box-shadow:0 8px 22px ' + P.scrim + ';pointer-events:none}',
      '.hwn-mode b{font-family:' + P.fontMono + ';font-weight:700}',
      '.hwn-pop{position:fixed;width:294px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + ';border-radius:14px;box-shadow:0 22px 54px ' + P.scrim + ';pointer-events:auto;overflow:hidden}',
      '.hwn-panel{position:fixed;top:0;bottom:0;width:376px;background:' + P.surface + ';border-left:1px solid ' + P.hairline2 + ';border-right:1px solid ' + P.hairline2 + ';box-shadow:0 0 60px ' + P.scrim + ';pointer-events:auto;display:flex;flex-direction:column}',
      '.hwn-hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid ' + P.hairline + ';background:' + P.surface2 + '}',
      '.hwn-ey{font-family:' + P.fontMono + ';font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + P.inkMute + '}',
      '.hwn-ttl{font-size:13.5px;font-weight:680;color:' + P.ink + '}',
      '.hwn-x{width:26px;height:26px;border-radius:8px;border:1px solid ' + P.hairline + ';background:' + P.surface + ';color:' + P.inkDim + ';display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1}',
      '.hwn-x:hover{background:' + P.surface3 + '}',
      '.hwn-body{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}',
      '.hwn-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.hwn-seg{display:flex;gap:3px;padding:3px;border-radius:10px;background:' + P.surface3 + '}',
      '.hwn-seg button{flex:1;height:26px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:' + P.inkDim + ';font-size:11.5px;font-weight:620}',
      '.hwn-seg button.on{background:' + P.surface + ';color:' + P.ink + ';box-shadow:0 1px 3px ' + P.scrim + '}',
      '.hwn-in,.hwn-ta,.hwn-sel{width:100%;border:1px solid ' + P.hairline2 + ';border-radius:10px;background:' + P.surface + ';color:' + P.ink + ';font-family:inherit;font-size:12.5px;padding:0 10px;height:34px;outline:none}',
      '.hwn-ta{height:auto;min-height:74px;padding:9px 10px;line-height:1.48;resize:vertical}',
      '.hwn-in:focus,.hwn-ta:focus{border-color:' + P.accentBorder + '}',
      '.hwn-b{height:34px;padding:0 12px;border-radius:10px;border:1px solid ' + P.hairline2 + ';background:' + P.surface + ';color:' + P.ink + ';font-size:12px;font-weight:640;display:inline-flex;align-items:center;gap:6px}',
      '.hwn-b:hover{background:' + P.surface3 + '}',
      '.hwn-b.pri{background:' + P.accent + ';border-color:' + P.accentBorder + ';color:' + P.accentInk + '}',
      '.hwn-b.sm{height:27px;padding:0 9px;font-size:11.5px;border-radius:8px}',
      '.hwn-b.dan{color:' + P.bad + '}',
      '.hwn-card{border:1px solid ' + P.hairline + ';border-radius:12px;background:' + P.surface + ';padding:10px 11px;display:flex;flex-direction:column;gap:7px}',
      '.hwn-card.sel{border-color:' + P.accentBorder + ';box-shadow:0 0 0 3px ' + P.accentSoft + '}',
      '.hwn-card.res{opacity:.6}',
      '.hwn-meta{font-family:' + P.fontMono + ';font-size:10.5px;color:' + P.inkMute + ';font-variant-numeric:tabular-nums}',
      '.hwn-txt{font-size:12.5px;line-height:1.5;color:' + P.ink + ';white-space:pre-wrap;text-wrap:pretty}',
      '.hwn-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:6px;background:' + P.surface3 + ';font-family:' + P.fontMono + ';font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' + P.inkDim + '}',
      '.hwn-dot{width:7px;height:7px;border-radius:99px;flex:0 0 auto}',
      '.hwn-grp{font-family:' + P.fontMono + ';font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + acc + ';padding:8px 2px 2px}',
      '.hwn-rep{border-left:2px solid ' + P.hairline2 + ';padding:0 0 0 9px;display:flex;flex-direction:column;gap:5px}',
      '.hwn-ft{display:flex;gap:6px;padding:10px 12px;border-top:1px solid ' + P.hairline + ';background:' + P.surface2 + '}',
      '.hwn-empty{padding:26px 10px;text-align:center;font-size:12.5px;color:' + P.inkMute + '}',
      'html.hwn-mode-on,html.hwn-mode-on *{cursor:crosshair !important}',
    ].join('');
  }

  var SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-8.5 8.5 8.9 8.9 0 01-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 013.9 11 8.4 8.4 0 0112.4 3h.5a8.4 8.4 0 018 8v.5z"/></svg>';

  // ── render ─────────────────────────────────────────────────────────────────
  function visible() {
    return notes.filter(function (n) {
      if (!(showAll ? true : onThisRoute(n))) return false;
      if (!showResolved && n.status === 'resolved') return false;
      if (filterStatus !== 'all' && n.status !== filterStatus) return false;
      if (filterType !== 'all' && n.type !== filterType) return false;
      if (filterAuthor !== 'all' && n.author !== filterAuthor) return false;
      return true;
    }).sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  }
  function pinList() {
    return notes.filter(function (n) { return onThisRoute(n) && (showResolved || n.status !== 'resolved'); })
      .sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  }
  function panelSide() {
    return /driver app/i.test(document.title) || /scan/i.test(route()) ? 'left' : 'right';
  }

  function render() {
    var P = palette();
    style.textContent = css(P);
    var openCount = notes.filter(function (n) { return onThisPage(n) && n.status === 'open'; }).length;
    var pins = pinList();
    var h = [];

    h.push('<div class="hwn-l" data-layer>');
    pins.forEach(function (n, i) {
      var p = locate(n), res = n.status === 'resolved';
      var c = typeColor(P, n.type);
      h.push('<button class="hwn-pin' + (p.exact ? '' : ' appx') + (res ? ' res' : '') + '" data-pin="' + n.id + '" ' +
        'style="left:' + Math.round(p.x) + 'px;top:' + Math.round(p.y) + 'px;background:' + (res ? P.surface : c) + ';color:' + (res ? P.inkMute : P.surface) + '" ' +
        'title="' + esc((n.author || '') + ' · ' + n.body) + '">' + (i + 1) + '</button>');
    });
    h.push('</div>');

    if (noteMode) h.push('<div class="hwn-mode">Click anywhere to leave a note · <b>Esc</b> to cancel</div>');

    h.push('<button class="hwn-btn' + (noteMode ? ' on' : '') + '" data-toggle title="Notes (N)">' + SVG +
      (openCount ? '<span class="hwn-badge">' + openCount + '</span>' : '') + '</button>');

    // status badge stays out of the way until the layer is actually in use
    if (authFail) h.push('<div class="hwn-conn" style="color:' + P.bad + '">passcode incorrect</div>');
    else if (panelOpen || noteMode || pending) {
      if (!LIVE) h.push('<div class="hwn-conn">not connected · local only</div>');
      else if (stale) h.push('<div class="hwn-conn">offline · showing cached</div>');
    }

    if (pending) h.push(composer(P));
    if (openThread) { var t = notes.find(function (x) { return x.id === openThread; }); if (t) h.push(thread(P, t, pins.indexOf(t) + 1)); }
    if (panelOpen) h.push(panel(P));

    root.innerHTML = h.join('');
    document.documentElement.classList.toggle('hwn-mode-on', noteMode);
  }

  function composer(P) {
    var x = Math.min(Math.max(12, pending.px - 147), innerWidth - 306);
    var y = Math.min(Math.max(12, pending.py + 16), innerHeight - 300);
    var seg = function (name, val, opts) {
      return '<div class="hwn-seg">' + opts.map(function (o) {
        return '<button data-set="' + name + '" data-val="' + o + '" class="' + (val === o ? 'on' : '') + '">' + o + '</button>';
      }).join('') + '</div>';
    };
    return '<div class="hwn-pop" style="left:' + x + 'px;top:' + y + 'px">' +
      '<div class="hwn-hd"><span class="hwn-dot" style="background:' + typeColor(P, pending.type) + '"></span>' +
      '<div style="flex:1"><div class="hwn-ey">New note</div><div class="hwn-ttl">' + esc(author() || 'You') + '</div></div>' +
      '<button class="hwn-x" data-cancel>✕</button></div>' +
      '<div style="padding:11px 12px;display:flex;flex-direction:column;gap:8px">' +
      (pending.anchor.elText ? '<div class="hwn-meta">on “' + esc(pending.anchor.elText.slice(0, 44)) + '”</div>' : '') +
      seg('type', pending.type, ['bug', 'idea', 'question', 'cosmetic']) +
      seg('severity', pending.severity, ['low', 'med', 'high']) +
      '<textarea class="hwn-ta" data-body placeholder="What should change here?">' + esc(pending.body) + '</textarea>' +
      '<div class="hwn-row" style="justify-content:flex-end"><button class="hwn-b" data-cancel>Cancel</button>' +
      '<button class="hwn-b pri" data-save>Post note</button></div></div></div>';
  }

  function thread(P, n, num) {
    var p = locate(n);
    var x = Math.min(Math.max(12, p.x - 147), innerWidth - 306);
    var y = Math.min(Math.max(12, p.y + 18), innerHeight - 320);
    var mine = n.author === author();
    return '<div class="hwn-pop" style="left:' + x + 'px;top:' + y + 'px">' +
      '<div class="hwn-hd"><span class="hwn-dot" style="background:' + typeColor(P, n.type) + '"></span>' +
      '<div style="flex:1"><div class="hwn-ey">' + esc(n.type) + ' · ' + esc(n.severity) + ' · #' + num + '</div>' +
      '<div class="hwn-ttl">' + esc(n.author) + '</div></div><button class="hwn-x" data-close-thread>✕</button></div>' +
      '<div style="padding:11px 12px;display:flex;flex-direction:column;gap:9px;max-height:56vh;overflow:auto">' +
      '<div class="hwn-txt">' + esc(n.body) + '</div>' +
      '<div class="hwn-meta">' + rel(n.createdAt) + (p.exact ? '' : ' · position approximate') + '</div>' +
      (n.status === 'resolved' ? '<div class="hwn-chip" style="color:' + P.good + '">Resolved by ' + esc(n.resolvedBy || '—') + '</div>' : '') +
      ((n.replies || []).length ? '<div class="hwn-rep">' + n.replies.map(function (r) {
        return '<div><div class="hwn-meta">' + esc(r.author) + ' · ' + rel(r.createdAt) + '</div><div class="hwn-txt">' + esc(r.body) + '</div></div>';
      }).join('') + '</div>' : '') +
      '<textarea class="hwn-ta" data-reply-body placeholder="Reply…" style="min-height:56px"></textarea>' +
      '<div class="hwn-row" style="justify-content:space-between">' +
      '<div class="hwn-row">' + (mine ? '<button class="hwn-b sm" data-edit="' + n.id + '">Edit</button><button class="hwn-b sm dan" data-del="' + n.id + '">Delete</button>' : '') + '</div>' +
      '<div class="hwn-row"><button class="hwn-b sm" data-resolve="' + n.id + '">' + (n.status === 'resolved' ? 'Reopen' : 'Resolve') + '</button>' +
      '<button class="hwn-b sm pri" data-reply="' + n.id + '">Reply</button></div></div></div></div>';
  }

  function panel(P) {
    var list = visible(), side = panelSide();
    var authors = notes.map(function (n) { return n.author; }).filter(function (a, i, s) { return a && s.indexOf(a) === i; });
    var groups = {};
    list.forEach(function (n) {
      var k = showAll ? n.page + ' ' + normRoute(n.route) : normRoute(n.route);
      (groups[k] = groups[k] || []).push(n);
    });
    var sel = function (name, val, opts) {
      return '<select class="hwn-sel" data-filter="' + name + '" style="width:auto;flex:1">' + opts.map(function (o) {
        return '<option value="' + o + '"' + (val === o ? ' selected' : '') + '>' + o + '</option>';
      }).join('') + '</select>';
    };
    var bodyHtml = Object.keys(groups).length ? Object.keys(groups).map(function (k) {
      return '<div class="hwn-grp">' + esc(k) + ' · ' + groups[k].length + '</div>' + groups[k].map(function (n) {
        var num = pinList().indexOf(n) + 1;
        return '<div class="hwn-card' + (openThread === n.id ? ' sel' : '') + (n.status === 'resolved' ? ' res' : '') + '" data-goto="' + n.id + '">' +
          '<div class="hwn-row"><span class="hwn-dot" style="background:' + typeColor(P, n.type) + '"></span>' +
          '<span class="hwn-chip">' + esc(n.type) + '</span><span class="hwn-chip">' + esc(n.severity) + '</span>' +
          (num > 0 ? '<span class="hwn-meta">#' + num + '</span>' : '') +
          '<span style="flex:1"></span><span class="hwn-meta">' + rel(n.createdAt) + '</span></div>' +
          '<div class="hwn-txt">' + esc(n.body) + '</div>' +
          '<div class="hwn-row"><span class="hwn-meta">' + esc(n.author) + '</span>' +
          ((n.replies || []).length ? '<span class="hwn-meta">· ' + n.replies.length + ' repl' + (n.replies.length === 1 ? 'y' : 'ies') + '</span>' : '') +
          (n.status === 'resolved' ? '<span class="hwn-meta" style="color:' + P.good + '">· resolved by ' + esc(n.resolvedBy || '—') + '</span>' : '') +
          '</div></div>';
      }).join('');
    }).join('') : '<div class="hwn-empty">No notes here yet.<br>Press <b>N</b>, then click the thing you want to talk about.</div>';

    return '<div class="hwn-panel" style="' + side + ':0">' +
      '<div class="hwn-hd"><div style="flex:1"><div class="hwn-ey">Annotations</div>' +
      '<div class="hwn-ttl">' + esc(showAll ? 'All pages' : document.title) + '</div></div>' +
      '<button class="hwn-x" data-close-panel>✕</button></div>' +
      '<div style="padding:9px 12px;display:flex;flex-direction:column;gap:7px;border-bottom:1px solid ' + P.hairline + '">' +
      '<div class="hwn-seg"><button data-scope="page" class="' + (showAll ? '' : 'on') + '">This page</button>' +
      '<button data-scope="all" class="' + (showAll ? 'on' : '') + '">All pages</button></div>' +
      '<div class="hwn-row">' + sel('status', filterStatus, ['all', 'open', 'resolved']) + sel('type', filterType, ['all', 'bug', 'idea', 'question', 'cosmetic']) + sel('author', filterAuthor, ['all'].concat(authors)) + '</div>' +
      '<label class="hwn-row" style="gap:7px;font-size:12px;color:' + P.inkDim + '"><input type="checkbox" data-showres' + (showResolved ? ' checked' : '') + '/>Show resolved pins</label></div>' +
      '<div class="hwn-body">' + bodyHtml + '</div>' +
      '<div class="hwn-ft"><button class="hwn-b sm" data-newnote>Add note</button><span style="flex:1"></span>' +
      '<button class="hwn-b sm" data-md>Copy Markdown</button><button class="hwn-b sm" data-json>Download JSON</button></div></div>';
  }

  // ── interaction ────────────────────────────────────────────────────────────
  function beginPin(e) {
    if (!ensureIdentity()) { noteMode = false; render(); return; }
    pending = { px: e.clientX, py: e.clientY, type: 'bug', severity: 'med', body: '', anchor: capture(e) };
    noteMode = false; render();
    var ta = root.querySelector('[data-body]'); if (ta) ta.focus();
  }
  document.addEventListener('click', function (e) {
    if (!noteMode) return;
    if (e.target.closest && e.target.closest('[data-hw-notes]')) return;
    e.preventDefault(); e.stopPropagation(); beginPin(e);
  }, true);

  root.addEventListener('click', function (e) {
    var t = e.target, q = function (s) { return t.closest(s); };
    var pin = q('[data-pin]');
    if (q('[data-toggle]')) { if (panelOpen) { panelOpen = false; } else { panelOpen = true; } render(); return; }
    if (q('[data-cancel]')) { pending = null; render(); return; }
    if (q('[data-set]')) {
      var b = q('[data-set]');
      var ta0 = root.querySelector('[data-body]'); if (ta0) pending.body = ta0.value;
      pending[b.getAttribute('data-set')] = b.getAttribute('data-val'); render();
      var ta1 = root.querySelector('[data-body]'); if (ta1) ta1.focus(); return;
    }
    if (q('[data-save]')) {
      var ta = root.querySelector('[data-body]');
      var body = (ta && ta.value.trim()) || '';
      if (!body) { ta && ta.focus(); return; }
      create({
        app: document.title, page: FILE, route: route(), viewport: { w: innerWidth, h: innerHeight },
        anchor: pending.anchor, type: pending.type, severity: pending.severity, body: body,
      });
      pending = null; render(); return;
    }
    if (pin) { openThread = openThread === pin.getAttribute('data-pin') ? null : pin.getAttribute('data-pin'); render(); return; }
    if (q('[data-close-thread]')) { openThread = null; render(); return; }
    if (q('[data-close-panel]')) { panelOpen = false; render(); return; }
    if (q('[data-scope]')) { showAll = q('[data-scope]').getAttribute('data-scope') === 'all'; render(); return; }
    if (q('[data-showres]')) { showResolved = q('[data-showres]').checked; render(); return; }
    if (q('[data-newnote]')) { if (ensureIdentity()) { noteMode = true; render(); } return; }
    if (q('[data-md]')) { copyMd(); return; }
    if (q('[data-json]')) { dlJson(); return; }
    if (q('[data-resolve]')) {
      var id = q('[data-resolve]').getAttribute('data-resolve');
      var n = notes.find(function (x) { return x.id === id; }); if (!n) return;
      if (!ensureIdentity()) return;
      patch(id, n.status === 'resolved' ? { status: 'open', resolvedBy: null, resolvedAt: null }
        : { status: 'resolved', resolvedBy: author(), resolvedAt: new Date().toISOString() });
      return;
    }
    if (q('[data-reply]')) {
      var rid = q('[data-reply]').getAttribute('data-reply');
      var rb = root.querySelector('[data-reply-body]');
      if (!rb || !rb.value.trim()) { rb && rb.focus(); return; }
      if (!ensureIdentity()) return;
      reply(rid, rb.value.trim()); return;
    }
    if (q('[data-edit]')) {
      var eid = q('[data-edit]').getAttribute('data-edit');
      var en = notes.find(function (x) { return x.id === eid; }); if (!en || en.author !== author()) return;
      var next = prompt('Edit note', en.body);
      if (next != null && next.trim()) patch(eid, { body: next.trim() });
      return;
    }
    if (q('[data-del]')) {
      var did = q('[data-del]').getAttribute('data-del');
      var dn = notes.find(function (x) { return x.id === did; }); if (!dn || dn.author !== author()) return;
      if (confirm('Delete your note?')) destroy(did);
      return;
    }
    var card = q('[data-goto]');
    if (card) {
      var gid = card.getAttribute('data-goto');
      var gn = notes.find(function (x) { return x.id === gid; }); if (!gn) return;
      if (gn.page !== FILE) { location.href = gn.page + (gn.route || ''); return; }
      if (normRoute(gn.route) !== normRoute(route())) { location.hash = gn.route || ''; }
      setTimeout(function () { openThread = gid; render(); }, 90);
    }
  });
  root.addEventListener('change', function (e) {
    var f = e.target.closest('[data-filter]'); if (!f) return;
    var k = f.getAttribute('data-filter');
    if (k === 'status') filterStatus = f.value; if (k === 'type') filterType = f.value; if (k === 'author') filterAuthor = f.value;
    render();
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
      if (e.key === 'Escape' && pending) { pending = null; render(); }
      return;
    }
    if (e.key === 'Escape') { if (pending) { pending = null; render(); } else if (openThread) { openThread = null; render(); } else if (noteMode) { noteMode = false; render(); } return; }
    if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!noteMode && !ensureIdentity()) return;
      noteMode = !noteMode; pending = null; render();
    }
  });

  // ── export helpers ─────────────────────────────────────────────────────────
  function md() {
    var list = visible();
    var out = ['# Notes — ' + (showAll ? 'all pages' : document.title), ''];
    list.forEach(function (n, i) {
      out.push('## ' + (i + 1) + '. [' + n.type + '/' + n.severity + '] ' + (n.status === 'resolved' ? '~~open~~ resolved' : 'open'));
      out.push('- **' + n.author + '** · ' + new Date(n.createdAt).toISOString());
      out.push('- ' + n.page + ' ' + normRoute(n.route) + (n.anchor && n.anchor.nearestHeading ? ' · under “' + n.anchor.nearestHeading + '”' : ''));
      if (n.anchor && n.anchor.elText) out.push('- on “' + n.anchor.elText + '”');
      out.push('', n.body, '');
      (n.replies || []).forEach(function (r) { out.push('> **' + r.author + '**: ' + r.body); });
      if (n.status === 'resolved') out.push('', '_Resolved by ' + (n.resolvedBy || '—') + '_');
      out.push('');
    });
    return out.join('\n');
  }
  function copyMd() {
    var text = md();
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
    else { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  }
  function dlJson() {
    var blob = new Blob([JSON.stringify({ version: NOTES_API_VERSION, exportedAt: new Date().toISOString(), notes: visible() }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hyperwolf-notes-' + FILE.replace(/\.html?$/, '').replace(/\s+/g, '-').toLowerCase() + '.json';
    a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  window.HWNotes = {
    open: function () { panelOpen = true; render(); },
    mode: function () { noteMode = true; render(); },
    all: function () { return notes.slice(); },
    markdown: md, refresh: pull,
  };

  // ── lifecycle ──────────────────────────────────────────────────────────────
  var lastMode = mode(), lastSig = '';
  function tick() {
    if (mode() !== lastMode) { lastMode = mode(); render(); return; }
    var sig = normRoute(route()) + '|' + innerWidth + '|' + Math.round(scrollY);
    if (sig !== lastSig) { lastSig = sig; render(); }
    else if (pinList().length) {
      // pins track their anchors as the page scrolls internally
      var layer = root.querySelector('[data-layer]');
      if (layer) pinList().forEach(function (n, i) {
        var el = layer.children[i]; if (!el) return;
        var p = locate(n); el.style.left = Math.round(p.x) + 'px'; el.style.top = Math.round(p.y) + 'px';
      });
    }
  }
  function mount() {
    document.body.appendChild(root);
    render();
    if (LIVE) { if (pass()) pull(); startPoll(); }
    setInterval(tick, 350);
    addEventListener('resize', render);
    addEventListener('hashchange', function () { openThread = null; render(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pull(); });
    addEventListener('scroll', tick, true);
  }
  if (document.body) setTimeout(mount, 500);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 500); });
})();
