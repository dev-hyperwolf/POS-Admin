// ── Mobile app store — nav stack, duty, breaks, POS cart, completed work ────
// Pub/sub store shared across the phone app (mirrors pos/store.jsx pattern).
const _mListeners = new Set();
const _load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const _save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const _M = {
  tab: 'home',                          // home | activity | discrepancy | profile
  stack: [],                            // pushed full screens: [{name, props}]
  sheet: null,                          // bottom sheet / modal: {name, props}
  duty: _load('hw-m-duty', false),      // on/off duty
  homeView: 'list',                     // list | map
  homeTab: 'today',                     // today | scheduled
  breakActive: _load('hw-m-break', null), // {label, endsAt} | null
  cart: [],                             // [{sku, qty}] active shop-at-home cart
  cartTaskId: null,                     // task the cart belongs to
  completed: _load('hw-m-completed', []), // [{taskId, at, method, total, ...}]
  lastSale: _load('hw-m-lastsale', null),
  tips: _load('hw-m-tips', null),        // [{id, amount, name, order, at}] | null (seed on first read)
  toast: null,
  notifRead: _load('hw-m-notifread', false),
  dismissed: _load('hw-m-notifdismiss', []),
  msgTemplates: _load('hw-m-msgtpl', null), // null → seed from default
  profile: _load('hw-m-profile', null),     // { phone, pendingPhone, avatar, vehicles[], vehIdx }
  packed: _load('hw-m-packed', {}),         // { [taskId]: [sku,...] } — barcodes scanned into the van
  tourStep: -1,                             // guided walkthrough step (-1 = off)
};
let _toastT = null;
const _emit = () => _mListeners.forEach((l) => l());

window.M = {
  s: _M,
  // navigation
  go(tab) { _M.tab = tab; _M.stack = []; _M.sheet = null; _emit(); },
  push(name, props) { _M.stack = [..._M.stack, { name, props: props || {} }]; _emit(); },
  pop() { _M.stack = _M.stack.slice(0, -1); _emit(); },
  popAll() { _M.stack = []; _emit(); },
  replace(name, props) { _M.stack = [..._M.stack.slice(0, -1), { name, props: props || {} }]; _emit(); },
  openSheet(name, props) { _M.sheet = { name, props: props || {} }; _emit(); },
  closeSheet() { _M.sheet = null; _emit(); },
  // duty
  setDuty(v) { _M.duty = v; _save('hw-m-duty', v); _emit(); },
  // home controls
  setHomeView(v) { _M.homeView = v; _emit(); },
  setHomeTab(v) { _M.homeTab = v; _emit(); },
  // breaks
  startBreak(label, mins) { _M.breakActive = { label, endsAt: Date.now() + mins * 60000 }; _save('hw-m-break', _M.breakActive); _emit(); },
  endBreak() { _M.breakActive = null; _save('hw-m-break', null); _emit(); },
  // cart
  startCart(taskId, items) { _M.cartTaskId = taskId; _M.cart = items ? items.map((i) => ({ ...i })) : []; _emit(); },
  addToCart(sku, qty) { const e = _M.cart.find((c) => c.sku === sku); if (e) e.qty += (qty || 1); else _M.cart = [..._M.cart, { sku, qty: qty || 1 }]; _emit(); },
  setQty(sku, qty) { if (qty <= 0) _M.cart = _M.cart.filter((c) => c.sku !== sku); else { const e = _M.cart.find((c) => c.sku === sku); if (e) e.qty = qty; } _emit(); },
  clearCart() { _M.cart = []; _M.cartTaskId = null; _emit(); },
  cartCount() { return _M.cart.reduce((a, c) => a + c.qty, 0); },
  // sale completion
  recordSale(sale) {
    _M.lastSale = sale; _save('hw-m-lastsale', sale);
    _M.completed = [sale, ..._M.completed]; _save('hw-m-completed', _M.completed);
    _emit();
  },
  isDone(taskId) { return _M.completed.some((c) => c.taskId === taskId); },
  // guided walkthrough / tour
  startTour() { _M.tourStep = 0; _emit(); },
  setTourStep(n) { _M.tourStep = n; _emit(); },
  endTour() { _M.tourStep = -1; try { localStorage.setItem('hw-m-tourseen', '1'); } catch {} _emit(); },
  tourSeen() { try { return localStorage.getItem('hw-m-tourseen') === '1'; } catch { return true; } },
  // editable driver profile — phone + vehicles
  profile() { if (_M.profile == null) { const d = window.MD.DRIVER; _M.profile = { phone: d.phone, vehicles: [{ id: 'v1', label: d.vehicle, plate: '7HWL294' }], vehIdx: 0 }; _save('hw-m-profile', _M.profile); } return _M.profile; },
  setPhone(v) { const p = window.M.profile(); p.phone = v; _M.profile = { ...p }; _save('hw-m-profile', _M.profile); _emit(); },
  submitPhone(v) { const p = window.M.profile(); p.pendingPhone = v; _M.profile = { ...p }; _save('hw-m-profile', _M.profile); _emit(); },
  approvePhone() { const p = window.M.profile(); if (p.pendingPhone) { p.phone = p.pendingPhone; p.pendingPhone = null; _M.profile = { ...p }; _save('hw-m-profile', _M.profile); _emit(); } },
  setAvatar(dataUrl) { const p = window.M.profile(); p.avatar = dataUrl; _M.profile = { ...p }; _save('hw-m-profile', _M.profile); _emit(); },
  // van packing — orders are staged by SCANNING each item's barcode; never marked by hand
  scannedSkus(taskId) { return _M.packed[taskId] || []; },
  isScanned(taskId, sku) { return (_M.packed[taskId] || []).includes(sku); },
  scanLine(taskId, sku) { const cur = _M.packed[taskId] || []; if (cur.includes(sku)) return; _M.packed = { ..._M.packed, [taskId]: [...cur, sku] }; _save('hw-m-packed', _M.packed); _emit(); },
  unscanLine(taskId, sku) { const cur = _M.packed[taskId] || []; _M.packed = { ..._M.packed, [taskId]: cur.filter((s) => s !== sku) }; _save('hw-m-packed', _M.packed); _emit(); },
  resetPack(taskId) { _M.packed = { ..._M.packed, [taskId]: [] }; _save('hw-m-packed', _M.packed); _emit(); },
  packedUnits(taskId) { const t = window.MD.TASKS.find((x) => x.id === taskId) || window.MD.SCHEDULED.find((x) => x.id === taskId); if (!t) return 0; const skus = _M.packed[taskId] || []; return window.MD.cartTotals(t.items).line.filter((l) => skus.includes(l.sku)).reduce((a, l) => a + l.qty, 0); },
  selectVehicle(i) { const p = window.M.profile(); p.vehIdx = i; _M.profile = { ...p }; _save('hw-m-profile', _M.profile); _emit(); },
  saveVehicle(veh, i) { const p = window.M.profile(); if (i == null) p.vehicles = [...p.vehicles, { id: 'v' + Date.now(), ...veh }]; else p.vehicles[i] = { ...p.vehicles[i], ...veh }; _M.profile = { ...p, vehicles: [...p.vehicles] }; _save('hw-m-profile', _M.profile); _emit(); },
  removeVehicle(i) { const p = window.M.profile(); if (p.vehicles.length <= 1) return; p.vehicles = p.vehicles.filter((_, j) => j !== i); if (p.vehIdx >= p.vehicles.length) p.vehIdx = 0; _M.profile = { ...p, vehicles: [...p.vehicles] }; _save('hw-m-profile', _M.profile); _emit(); },
  vehicle() { const p = window.M.profile(); return p.vehicles[p.vehIdx] || p.vehicles[0]; },
  // cash tips (kept separate from company cash)
  seedTips() { if (_M.tips == null) { _M.tips = window.MD.TIPS_SEED.map((t) => ({ ...t })); _save('hw-m-tips', _M.tips); } return _M.tips; },
  addTip(t) { const tip = { id: 'tp' + Date.now(), at: 'just now', ...t }; _M.tips = [tip, ...(_M.tips || [])]; _save('hw-m-tips', _M.tips); _emit(); },
  removeTip(id) { _M.tips = (_M.tips || []).filter((t) => t.id !== id); _save('hw-m-tips', _M.tips); _emit(); },
  // Seeds first. Fixing this at the Profile call site left an identical dead end
  // in MakeChangeSheet, which is opened from checkout: any reader that forgot to
  // seed silently showed $0.00 over a real tip bank. One reader cannot be the
  // place this is fixed — the accessor is.
  tipTotal() { window.M.seedTips(); return (_M.tips || []).reduce((a, t) => a + t.amount, 0); },
  // stop-list filters. Apply used to close the sheet and flash "Filters applied"
  // while discarding every chip the driver had tapped.
  filters() { return _M.filters || { status: [], tags: [] }; },
  setFilters(f) { _M.filters = { status: [...(f.status || [])], tags: [...(f.tags || [])] }; _save('hw-m-filters', _M.filters); _emit(); },
  clearFilters() { _M.filters = { status: [], tags: [] }; _save('hw-m-filters', _M.filters); _emit(); },
  filterCount() { const f = window.M.filters(); return f.status.length + f.tags.length; },
  // OR within a group, AND across groups — the way every filter UI behaves.
  // 'Completed' is the one chip that is NOT t.status: a stop is completed when
  // the driver has finished it on THIS phone, which lives in M.isDone.
  matchesFilters(t) {
    const f = window.M.filters();
    if (!f.status.length && !f.tags.length) return true;
    if (f.status.length) {
      const ok = f.status.some((label) => label === 'Completed'
        ? window.M.isDone(t.id)
        : !window.M.isDone(t.id) && t.status === label.toLowerCase().replace(/ /g, '-'));
      if (!ok) return false;
    }
    if (f.tags.length && !f.tags.some((label) => (t.prio || '') === label.toLowerCase())) return false;
    return true;
  },
  // notifications
  dismissNotif(id) { _M.dismissed = [..._M.dismissed, id]; _save('hw-m-notifdismiss', _M.dismissed); _emit(); },
  clearDismissed() { _M.dismissed = []; _save('hw-m-notifdismiss', []); _emit(); },
  // SMS templates (admin-controlled)
  templates() { if (_M.msgTemplates == null) { _M.msgTemplates = window.MD.MSG_TEMPLATES_DEFAULT.map((t) => ({ ...t })); _save('hw-m-msgtpl', _M.msgTemplates); } return _M.msgTemplates; },
  saveTemplate(tpl) { const list = window.M.templates(); const i = list.findIndex((t) => t.id === tpl.id); if (i >= 0) list[i] = tpl; else list.push({ ...tpl, id: 'm' + Date.now() }); _M.msgTemplates = [...list]; _save('hw-m-msgtpl', _M.msgTemplates); _emit(); },
  deleteTemplate(id) { _M.msgTemplates = window.M.templates().filter((t) => t.id !== id); _save('hw-m-msgtpl', _M.msgTemplates); _emit(); },
  // toast
  flash(msg, kind) { _M.toast = { msg, kind: kind || 'good' }; _emit(); clearTimeout(_toastT); _toastT = setTimeout(() => { _M.toast = null; _emit(); }, 2600); },
  markNotifRead() { _M.notifRead = true; _save('hw-m-notifread', true); _emit(); },
  subscribe(fn) { _mListeners.add(fn); return () => _mListeners.delete(fn); },
};

window.useM = function useM() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.M.subscribe(force), []);
  return window.M;
};

Object.assign(window, {});
