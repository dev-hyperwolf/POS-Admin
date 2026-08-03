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
    ['Shop at Home.html', 'Shop @ Home', 'sah'],
    ['Members CRM.html', 'Members CRM', 'crm'],
    ['Customer Account.html', 'Customer Account', 'acct'],
    ['dashboard.html', 'Dev Console', 'dev'],
  ];
  var here = decodeURIComponent((location.pathname.split('/').pop() || '')).toLowerCase();

  var wrap = document.createElement('div');
  wrap.setAttribute('data-hw-switcher', '');
  wrap.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace';

  var menu = document.createElement('div');
  menu.style.cssText = 'position:absolute;right:0;bottom:52px;width:222px;max-height:70vh;overflow:auto;background:#1c1b15;border:1px solid #3d3930;border-radius:13px;padding:6px;box-shadow:0 18px 44px rgba(0,0,0,.5);opacity:0;transform:translateY(8px) scale(.98);pointer-events:none;transition:opacity .14s,transform .14s';
  var head = document.createElement('div');
  head.textContent = 'Hyperwolf apps';
  head.style.cssText = 'font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#726d61;padding:8px 10px 7px';
  menu.appendChild(head);
  APPS.forEach(function (a) {
    var cur = here === a[0].toLowerCase();
    var el = document.createElement('a');
    el.href = a[0]; el.textContent = a[1];
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;text-decoration:none;font-size:12.5px;font-weight:600;font-family:Inter,-apple-system,sans-serif;color:' + (cur ? '#15140f' : '#e9e6dd') + ';background:' + (cur ? '#FFD100' : 'transparent') + ';cursor:pointer';
    var dot = document.createElement('span');
    dot.style.cssText = 'width:6px;height:6px;border-radius:9px;flex:0 0 auto;background:' + (cur ? '#15140f' : '#5a5648');
    el.insertBefore(dot, el.firstChild);
    if (!cur) { el.onmouseenter = function () { el.style.background = '#292720'; }; el.onmouseleave = function () { el.style.background = 'transparent'; }; }
    if (cur) el.onclick = function (e) { e.preventDefault(); close(); };
    menu.appendChild(el);
  });

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

  wrap.appendChild(menu); wrap.appendChild(btn);
  function mount() { document.body.appendChild(wrap); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
