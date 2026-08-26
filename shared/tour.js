// ── Hyperwolf guided tour ───────────────────────────────────────────────────
// An on-screen walkthrough that runs ON the real UI: it dims the app, cuts a
// hole around the actual element being explained, and lets the user click
// straight through that hole to keep working. Steps live in tour-steps.js.
//
//   <script src="shared/tour-steps.js"></script>
//   <script src="shared/tour.js"></script>
(function () {
  if (window.__hwTour) return; window.__hwTour = true;

  // Resolve which tour belongs to this page. Exported/bundled copies get
  // renamed — "Hyperwolf POS (standalone).html", "… (offline).html", a "-print"
  // variant — and an exact filename match would silently drop the tour from
  // every file we actually hand to people. Strip those qualifiers and fall back
  // to a prefix match so a renamed copy still finds its steps.
  var RAW = decodeURIComponent((location.pathname.split('/').pop() || '')).toLowerCase();
  var FILE = RAW.replace(/\s*\((standalone|offline|copy|bundled|final|v\d+)\)/g, '').replace(/[-_](standalone|offline|print|copy|bundled)(?=\.html?$)/g, '').trim();
  var ALL = window.HW_TOUR_STEPS || {};
  var TOUR = null, KEYNAME = FILE;
  var base = function (s) { return s.replace(/\.html?$/, '').trim(); };
  Object.keys(ALL).forEach(function (k) { if (k.toLowerCase() === FILE) { TOUR = ALL[k]; KEYNAME = k.toLowerCase(); } });
  if (!TOUR) Object.keys(ALL).forEach(function (k) {
    var kb = base(k.toLowerCase());
    if (!TOUR && kb && base(FILE).indexOf(kb) === 0) { TOUR = ALL[k]; KEYNAME = kb; }
  });
  if (!TOUR || !TOUR.steps || !TOUR.steps.length) return;

  var KEY = 'hw-tour:' + KEYNAME;
  var steps = TOUR.steps, i = 0, live = false, raf = null;

  // ── helpers exposed to step definitions ───────────────────────────────────
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function vis(e) { return e && e.offsetParent !== null && e.getBoundingClientRect().width > 0; }
  function byText(t, opt) {
    opt = opt || {};
    var scope = opt.scope ? document.querySelector(opt.scope) : document;
    if (!scope) return null;
    var els = [].slice.call(scope.querySelectorAll(opt.tag || 'button,a,input,[role=button],h1,h2,h3,td,th,label,span,div'));
    var n = norm(t);
    var exact = els.filter(function (e) { return vis(e) && norm(e.textContent) === n; });
    var pool = exact.length ? exact : els.filter(function (e) {
      return vis(e) && norm(e.textContent).indexOf(n) >= 0 && e.getBoundingClientRect().height < (opt.maxH || 260);
    });
    pool.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    return pool[0] || null;
  }
  function click(t, opt) {
    var e = byText(t, opt); if (!e) return false;
    var c = e.closest('button,a,[role=button]') || e;
    c.click(); return true;
  }
  window.HWTour = { byText: byText, click: click };
  // ── DOM ───────────────────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '#hwt-w{position:fixed;inset:0;z-index:var(--hwz-tourMask);pointer-events:none;font-family:Inter,-apple-system,system-ui,sans-serif}',
    '#hwt-w.on{pointer-events:none}',
    '.hwt-m{position:fixed;background:rgba(12,11,7,.62);pointer-events:auto;transition:all .26s cubic-bezier(.4,0,.2,1)}',
    '#hwt-ring{position:fixed;border:2px solid #FFD100;border-radius:12px;pointer-events:none;box-shadow:0 0 0 3px rgba(255,209,0,.22),0 8px 34px rgba(0,0,0,.35);transition:all .26s cubic-bezier(.4,0,.2,1)}',
    '#hwt-ring.none{opacity:0}',
    '#hwt-c{position:fixed;z-index:var(--hwz-tourCard);width:352px;max-width:calc(100vw - 28px);background:#15140f;border:1px solid #3d3930;border-radius:16px;box-shadow:0 26px 64px rgba(0,0,0,.5);color:#e9e6dd;pointer-events:auto;transition:transform .26s cubic-bezier(.4,0,.2,1),top .26s cubic-bezier(.4,0,.2,1),left .26s cubic-bezier(.4,0,.2,1);overflow:hidden}',
    '#hwt-c .hd{display:flex;align-items:center;gap:9px;padding:13px 16px 0}',
    '#hwt-c .ey{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#FFD100}',
    '#hwt-c .ct{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;color:#7a7568;margin-left:auto}',
    '#hwt-c .xb{background:transparent;border:none;color:#7a7568;cursor:pointer;padding:2px;line-height:0;border-radius:6px}',
    '#hwt-c .xb:hover{color:#e9e6dd;background:#2a2820}',
    '#hwt-c h4{margin:7px 16px 0;font-size:15.5px;font-weight:750;letter-spacing:-.01em;line-height:1.28;color:#fff}',
    '#hwt-c p{margin:7px 16px 0;font-size:13px;line-height:1.62;color:#c2beb2;text-wrap:pretty}',
    '#hwt-c p b{color:#fff;font-weight:650}',
    '#hwt-c p code{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;background:#26241d;border:1px solid #3d3930;border-radius:5px;padding:1px 5px;color:#FFD100}',
    '#hwt-c .do{display:flex;gap:8px;align-items:flex-start;margin:11px 16px 0;padding:9px 11px;background:#221f16;border:1px solid #4a4327;border-radius:10px;font-size:12px;line-height:1.5;color:#e6c96a}',
    '#hwt-c .do svg{flex:0 0 auto;width:14px;height:14px;stroke:#FFD100;fill:none;stroke-width:2.2;margin-top:1px}',
    '#hwt-c .ft{display:flex;align-items:center;gap:8px;padding:14px 16px 15px}',
    '#hwt-c .dots{display:flex;gap:4px;flex-wrap:wrap;max-width:150px}',
    '#hwt-c .dot{width:5px;height:5px;border-radius:99px;background:#3d3930}',
    '#hwt-c .dot.on{background:#FFD100}#hwt-c .dot.pt{background:#6b6558}',
    '#hwt-c .sp{flex:1}',
    '#hwt-c button.b{border:none;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}',
    '#hwt-c button.gh{background:transparent;color:#8a8578}#hwt-c button.gh:hover{color:#e9e6dd}',
    '#hwt-c button.se{background:#2a2820;color:#e9e6dd}#hwt-c button.se:hover{background:#37342a}',
    '#hwt-c button.pr{background:#FFD100;color:#1a1400}#hwt-c button.pr:hover{background:#ffdb35}',
    '#hwt-launch{position:fixed;right:16px;bottom:68px;z-index:var(--hwz-chromeBar);width:44px;height:44px;border-radius:13px;border:1px solid #3d3930;background:#15140f;color:#FFD100;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:0;transition:transform .12s}',
    '#hwt-launch:hover{transform:scale(1.06)}',
    '#hwt-launch .pip{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:99px;background:#FFD100;border:2px solid #15140f}',
    '@media(max-width:560px){#hwt-c{width:calc(100vw - 24px)}}',
  ].join('');
  document.head.appendChild(css);

  var wrap = document.createElement('div');
  wrap.id = 'hwt-w';
  wrap.setAttribute('data-hw-chrome', 'tour');
  wrap.innerHTML = '<div class="hwt-m" data-m="t"></div><div class="hwt-m" data-m="b"></div>' +
    '<div class="hwt-m" data-m="l"></div><div class="hwt-m" data-m="r"></div><div id="hwt-ring"></div><div id="hwt-c"></div>';
  var card = null, ring = null, masks = {};

  var launch = document.createElement('button');
  launch.id = 'hwt-launch';
  launch.setAttribute('data-hw-chrome', 'tour-launch');
  launch.title = 'Guided walkthrough';
  launch.innerHTML = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a2.9 2.9 0 1 1 3.6 3.1c-.6.2-.9.7-.9 1.3v.5"/><path d="M12 17.4h.01"/></svg>';
  launch.onclick = function () { start(0); };

  function mount() {
    document.body.appendChild(wrap);
    document.body.appendChild(launch);
    card = document.getElementById('hwt-c');
    ring = document.getElementById('hwt-ring');
    ['t', 'b', 'l', 'r'].forEach(function (k) { masks[k] = wrap.querySelector('[data-m="' + k + '"]'); });
    hideChrome();
    var seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch (e) {}
    if (!seen) { launch.querySelector('.pip') || launch.insertAdjacentHTML('beforeend', '<span class="pip"></span>'); setTimeout(function () { start(0); }, 700); }
  }

  function hideChrome() {
    wrap.style.display = 'none';
    ['t', 'b', 'l', 'r'].forEach(function (k) { masks[k].style.display = 'none'; });
  }

  // ── target + geometry ─────────────────────────────────────────────────────
  function resolve(s) {
    if (s.sel) { var e = document.querySelector(s.sel); if (vis(e)) return e; }
    if (s.text) {
      var t = byText(s.text, s);
      if (t && s.up) for (var k = 0; k < s.up && t.parentElement && t.parentElement !== document.body; k++) t = t.parentElement;
      return t;
    }
    return null;
  }
  function scrollTo(el) {
    // walk up to the nearest scrollable ancestor and centre the target in it
    var p = el.parentElement;
    while (p && p !== document.body) {
      var st = getComputedStyle(p);
      if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 8) {
        var pr = p.getBoundingClientRect(), er = el.getBoundingClientRect();
        var d = (er.top - pr.top) - (p.clientHeight / 2 - er.height / 2);
        if (Math.abs(d) > 24) p.scrollTop += d;
        return;
      }
      p = p.parentElement;
    }
    var r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 80) window.scrollBy(0, r.top - innerHeight / 2 + r.height / 2);
  }

  function place() {
    var s = steps[i], el = s._el;
    var W = innerWidth, H = innerHeight, pad = s.pad == null ? 8 : s.pad;
    if (!el) {
      ring.classList.add('none');
      ['t', 'b', 'l', 'r'].forEach(function (k) { masks[k].style.display = 'none'; });
      masks.t.style.display = 'block';
      Object.assign(masks.t.style, { left: '0px', top: '0px', width: W + 'px', height: H + 'px' });
      var cw = card.offsetWidth, ch = card.offsetHeight;
      card.style.left = Math.round((W - cw) / 2) + 'px';
      card.style.top = Math.round((H - ch) / 2) + 'px';
      return;
    }
    var r = el.getBoundingClientRect();
    var x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
    var w = Math.min(W - x, r.width + pad * 2), h = Math.min(H - y, r.height + pad * 2);
    ring.classList.remove('none');
    Object.assign(ring.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: (s.round == null ? 12 : s.round) + 'px' });
    ['t', 'b', 'l', 'r'].forEach(function (k) { masks[k].style.display = 'block'; });
    Object.assign(masks.t.style, { left: '0px', top: '0px', width: W + 'px', height: y + 'px' });
    Object.assign(masks.b.style, { left: '0px', top: (y + h) + 'px', width: W + 'px', height: Math.max(0, H - y - h) + 'px' });
    Object.assign(masks.l.style, { left: '0px', top: y + 'px', width: x + 'px', height: h + 'px' });
    Object.assign(masks.r.style, { left: (x + w) + 'px', top: y + 'px', width: Math.max(0, W - x - w) + 'px', height: h + 'px' });

    var cw = card.offsetWidth, ch = card.offsetHeight, gap = 14, L, T;
    var side = s.place || (x + w + gap + cw < W - 10 ? 'right' : x - gap - cw > 10 ? 'left' : y + h + gap + ch < H - 10 ? 'bottom' : 'top');
    if (side === 'right') { L = x + w + gap; T = y + h / 2 - ch / 2; }
    else if (side === 'left') { L = x - gap - cw; T = y + h / 2 - ch / 2; }
    else if (side === 'bottom') { L = x + w / 2 - cw / 2; T = y + h + gap; }
    else { L = x + w / 2 - cw / 2; T = y - gap - ch; }
    card.style.left = Math.round(Math.min(Math.max(10, L), W - cw - 10)) + 'px';
    card.style.top = Math.round(Math.min(Math.max(10, T), H - ch - 10)) + 'px';
  }

  // ── render ────────────────────────────────────────────────────────────────
  function draw() {
    var s = steps[i];
    var dots = steps.map(function (_, n) { return '<span class="dot' + (n === i ? ' on' : n < i ? ' pt' : '') + '"></span>'; }).join('');
    card.innerHTML =
      '<div class="hd"><span class="ey">' + (s.ey || TOUR.name || 'Walkthrough') + '</span>' +
      '<span class="ct">' + (i + 1) + ' / ' + steps.length + '</span>' +
      '<button class="xb" data-t="end" title="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<h4>' + s.title + '</h4><p>' + s.body + '</p>' +
      (s.act ? '<div class="do"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>' + s.act + '</span></div>' : '') +
      '<div class="ft"><div class="dots">' + dots + '</div><span class="sp"></span>' +
      (i > 0 ? '<button class="b gh" data-t="prev">Back</button>' : '<button class="b gh" data-t="end">Skip</button>') +
      '<button class="b ' + (i === steps.length - 1 ? 'pr' : 'pr') + '" data-t="' + (i === steps.length - 1 ? 'fin' : 'next') + '">' +
      (i === steps.length - 1 ? (TOUR.endLabel || 'Done') : 'Next') + '</button></div>';
    place();
  }

  // Bumped on every show(). A step's before()/resolve() work is deferred behind
  // timers, so a slow step that has since been navigated away from must not run
  // its go() and repaint the card with stale content — hence the token check.
  var seq = 0;
  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    var s = steps[i];
    var my = ++seq;
    lastBox = '';
    var go = function () {
      if (my !== seq) return;
      s._el = resolve(s);
      if (s._el) scrollTo(s._el);
      setTimeout(function () {
        if (my !== seq) return;
        s._el = resolve(s) || s._el; draw();
      }, s._el ? 130 : 0);
    };
    if (s.before) { try { s.before(); } catch (e) {} setTimeout(go, s.wait || 420); }
    else go();
  }

  function start(n) {
    live = true;
    wrap.style.display = 'block';
    launch.style.display = 'none';
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    var pip = launch.querySelector('.pip'); if (pip) pip.remove();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    show(n || 0);
    loop();
  }
  function end() {
    live = false; hideChrome(); launch.style.display = 'flex';
    if (raf) cancelAnimationFrame(raf), raf = null;
  }
  window.HWTour.start = start; window.HWTour.end = end;
  window.HWTour.at = function () { return i; };
  window.HWTour.count = function () { return steps.length; };
  // Keep-alive loop. It runs the whole time the tour is live, so it has to stay
  // cheap: a per-frame resolve()/place() saturates the main thread and starves
  // React's scheduler, which stops before()-driven UI changes (tab switches,
  // navigation) from ever committing. Poll on a timer and only re-place when
  // the target rect actually moved.
  var lastBox = '';
  function loop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (!live) return;
    var s = steps[i];
    if (s && s._el) {
      if (!document.contains(s._el) || !vis(s._el)) {
        var f = resolve(s);
        if (f && f !== s._el) { s._el = f; scrollTo(f); lastBox = ''; }
      }
      var r = s._el.getBoundingClientRect();
      var box = (r.top | 0) + ':' + (r.left | 0) + ':' + (r.width | 0) + ':' + (r.height | 0);
      if (box !== lastBox) { lastBox = box; place(); }
    }
    raf = requestAnimationFrame(function () { setTimeout(loop, 120); });
  }

  card_click();
  function card_click() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#hwt-c [data-t]');
      if (!b) return;
      var t = b.dataset.t;
      if (t === 'next') show(i + 1);
      else if (t === 'prev') show(i - 1);
      else if (t === 'fin') { end(); if (TOUR.onEnd) try { TOUR.onEnd(); } catch (x) {} }
      else end();
    }, true);
  }
  document.addEventListener('keydown', function (e) {
    if (!live) return;
    if (e.key === 'Escape') end();
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
  addEventListener('resize', function () { if (live) place(); });

  if (document.body) setTimeout(mount, 400);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 400); });
})();
