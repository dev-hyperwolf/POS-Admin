// Hyperwolf cross-app launcher — a small floating button present on every app,
// so you can jump between the canonical surfaces (and the hub) without hunting
// for files. Plain JS, no build step. Include with:
//   <script src="shared/app-switcher.js"></script>   (root apps)
(function () {
  if (window.__hwSwitcher) return; window.__hwSwitcher = true;
  var APPS = [
    ['Hyperwolf.html', 'Home', 'home'],
    ['Hyperwolf POS.html', 'POS', 'pos'],
    ['METRC Batch Pipeline.html', 'Batch Pipeline', 'batch'],
    ['Promotions Suite.html', 'Promotions', 'promo'],
    ['Hyperwolf Engage.html', 'Engage', 'eng'],
    ['Hyperwolf Delivery.html', 'Delivery', 'del'],
    ['Hyperdrive Logistics.html', 'Logistics', 'log'],
    ['Hyperwolf Driver App.html', 'Driver App', 'drv'],
    ['POS Terminal Configuration.html', 'Terminals', 'term'],
    ['Hyperwolf Shop.html', 'Shop', 'shop'],
    ['Shop at Home.html', 'Shop @ Home', 'sah'],
    ['Members CRM.html', 'Members CRM', 'crm'],
    ['Customer Account.html', 'Customer Account', 'acct'],
    ['dashboard.html', 'Dev Console', 'dev'],
  ];
  var here = decodeURIComponent((location.pathname.split('/').pop() || '')).toLowerCase();

  var wrap = document.createElement('div');
  wrap.setAttribute('data-hw-switcher', '');
  // data-hw-chrome is what keeps an annotation pin off this menu: notes.js
  // locate() re-finds a pin by matching its text across the whole document and
  // taking the SMALLEST visible match, and these rows -- `Home`, `POS`,
  // `Export` -- are small. See shared/notes.js locate().
  wrap.setAttribute('data-hw-chrome', 'app-switcher');
  wrap.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:var(--hwz-chromeBar);font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace';

  // `menu` is deliberately NOT appended inside `wrap`. `wrap` is
  // `position:fixed` + `z-index:chromeBar`, which makes it its own stacking
  // context -- a descendant's z-index only competes against other
  // descendants of THAT context, never against a sibling widget's chrome.
  // shared/demo-seed.js renders the exact same shape one gutter over
  // (its own fixed wrap at chromeBar, its own menu at chromeMenu), so a
  // chromeMenu nested inside a chromeBar here never actually outranks it --
  // both wraps tie at chromeBar (66) and DOM order decides the overlap,
  // regardless of either menu's higher (68) number. Appending `menu`
  // straight to <body> as its own top-level fixed element is what lets
  // chromeMenu really outrank chromeBar, on every page, for both widgets.
  // right/bottom below are wrap's own right:16/bottom:16 plus the 52px this
  // menu always sat above the button -- the same screen position as before,
  // just no longer inherited from being a child of `wrap`.
  var menu = document.createElement('div');
  // data-hw-chrome moves onto `menu` directly: it's no longer inside `wrap`
  // for notes.js's `closest('[data-hw-chrome]')` pin-exclusion walk to find.
  menu.setAttribute('data-hw-chrome', 'app-switcher-menu');
  menu.style.cssText = 'position:fixed;z-index:var(--hwz-chromeMenu);right:16px;bottom:68px;width:222px;max-height:70vh;overflow:auto;background:#1c1b15;border:1px solid #3d3930;border-radius:13px;padding:6px;box-shadow:0 18px 44px rgba(0,0,0,.5);opacity:0;transform:translateY(8px) scale(.98);pointer-events:none;transition:opacity .14s,transform .14s';
  var head = document.createElement('div');
  head.textContent = 'Hyperwolf apps';
  head.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#726d61;padding:8px 10px 7px';
  menu.appendChild(head);
  APPS.forEach(function (a) {
    var cur = here === a[0].toLowerCase();
    var el = document.createElement('a');
    el.href = a[0]; el.textContent = a[1];
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;text-decoration:none;font-size:12.5px;font-weight:600;font-family:Inter,-apple-system,sans-serif;color:' + (cur ? '#15140f' : '#e9e6dd') + ';background:' + (cur ? '#e9e6dd' : 'transparent') + ';cursor:pointer';
    var dot = document.createElement('span');
    dot.style.cssText = 'width:6px;height:6px;border-radius:9px;flex:0 0 auto;background:' + (cur ? '#15140f' : '#5a5648');
    el.insertBefore(dot, el.firstChild);
    if (!cur) { el.onmouseenter = function () { el.style.background = '#292720'; }; el.onmouseleave = function () { el.style.background = 'transparent'; }; }
    if (cur) el.onclick = function (e) { e.preventDefault(); close(); };
    menu.appendChild(el);
  });

  // ── which build am I looking at ───────────────────────────────────────────
  // This used to be a 169x23 pill pinned at right:8/bottom:8 by build-stamp.js,
  // at the SAME z-index as this button and appended after its fetch resolved --
  // so DOM order made it win the hit test and it killed the bottom 15px of both
  // this button and "+ Demo data" (34% of a 44px target). The information is
  // worth one row in a menu somebody opens when they ask "what am I looking
  // at"; it was never worth permanent screen space on every page.
  // build-stamp.js still owns the whole resolution chain and publishes the
  // answer on window.HW_BUILD + a `hw:build` event, so drift stays detectable.
  var buildRow = document.createElement('div');
  buildRow.setAttribute('data-hw-build', '');
  buildRow.style.cssText = 'display:none;margin:6px 4px 2px;padding:8px 6px 2px;border-top:1px solid #3d3930;' +
    'font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.02em;' +
    'color:#726d61;user-select:text;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  menu.appendChild(buildRow);
  function paintBuild(info) {
    if (!info || !info.sha) { return; }
    buildRow.textContent = info.host + ' \u00b7 ' + info.branch + ' @ ' + String(info.sha).slice(0, 7);
    buildRow.title = info.title || '';
    buildRow.style.display = 'block';
  }
  if (window.HW_BUILD) { paintBuild(window.HW_BUILD); }
  window.addEventListener('hw:build', function (e) { paintBuild(e.detail || window.HW_BUILD); });

  var btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Switch app');
  btn.style.cssText = 'width:44px;height:44px;border-radius:13px;border:1px solid #3d3930;background:#15140f;color:#FFD100;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:0;transition:transform .12s';
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  btn.onmouseenter = function () { btn.style.transform = 'scale(1.06)'; };
  btn.onmouseleave = function () { btn.style.transform = 'scale(1)'; };

  var open = false;
  function toggle() { open ? close() : show(); }
  function show() { open = true; menu.style.opacity = '1'; menu.style.transform = 'translateY(0) scale(1)'; menu.style.pointerEvents = 'auto'; }
  function close() { open = false; menu.style.opacity = '0'; menu.style.transform = 'translateY(8px) scale(.98)'; menu.style.pointerEvents = 'none'; }
  btn.onclick = function (e) { e.stopPropagation(); toggle(); };
  document.addEventListener('click', function () { if (open) close(); });
  menu.addEventListener('click', function (e) { e.stopPropagation(); });

  wrap.appendChild(btn);
  function mount() { document.body.appendChild(wrap); document.body.appendChild(menu); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
