// ── POS shared store — last completed sale + cash-drawer state ─────────────
// Tiny pub/sub so the global header (drawer pop, last-receipt) and the
// register (which completes the sale) stay in sync without prop-drilling.
const _posListeners = new Set();
const _posState = {
  lastSale: null,                       // { id, at, method, total, collected, cash, cardCharged, fee, feeLabel, credits, change, email, name, items }
  drawer: { open: false, reason: null, at: 0 },
  payVariant: (() => { try { return localStorage.getItem('hw-pos-payvariant') || 'flow'; } catch { return 'flow'; } })(),
  // Store-level policy: every drawer in THIS store opens with the same amount.
  // Managers set it once; associates only count against it, never choose it.
  requiredFloat: (() => { try { const v = parseFloat(localStorage.getItem('hw-pos-reqfloat')); return isNaN(v) ? 300 : v; } catch { return 300; } })(),
  session: (() => { try { return JSON.parse(localStorage.getItem('hw-pos-session')) || { open: false }; } catch { return { open: false }; } })(),
};
let _drawerTimer = null;
const _emit = () => _posListeners.forEach((l) => l());
const _persistSession = () => { try { localStorage.setItem('hw-pos-session', JSON.stringify(_posState.session)); } catch {} };

window.POS = {
  state: _posState,
  setLastSale(sale) {
    _posState.lastSale = sale;
    if (_posState.session && _posState.session.open) { const net = Math.max(0, (Number(sale.cash) || 0) - (Number(sale.change) || 0)); if (net > 0) { _posState.session.cashSales = (_posState.session.cashSales || 0) + net; _persistSession(); } }
    _emit();
  },
  getLastSale() { return _posState.lastSale; },
  popDrawer(reason) {
    _posState.drawer = { open: true, reason: reason || 'Manual open', at: Date.now() };
    _emit();
    clearTimeout(_drawerTimer);
    _drawerTimer = setTimeout(() => { _posState.drawer = { open: false, reason: null, at: 0 }; _emit(); }, 3200);
  },
  closeDrawer() { clearTimeout(_drawerTimer); _posState.drawer = { open: false, reason: null, at: 0 }; _emit(); },
  getDrawer() { return _posState.drawer; },
  getSession() { return _posState.session; },
  openRegister(float, by) {
    _posState.session = { open: true, float: Number(float) || 0, cashSales: 0, openedAt: Date.now(), openedBy: by || 'Manisha Saini' };
    _persistSession();
    this.popDrawer('Open register · starting cash balance ' + window.HW.fmt.money(Number(float) || 0));
  },
  closeRegister(counted) {
    const s = _posState.session || {};
    const expected = (s.float || 0) + (s.cashSales || 0);
    _posState.session = { open: false, closedAt: Date.now(), lastCounted: Number(counted) || 0, lastExpected: expected, lastVariance: +(((Number(counted) || 0) - expected).toFixed(2)) };
    _persistSession();
    this.popDrawer('Close register · counted ' + window.HW.fmt.money(Number(counted) || 0));
  },
  setPayVariant(v) { _posState.payVariant = v; try { localStorage.setItem('hw-pos-payvariant', v); } catch {} _emit(); },
  getPayVariant() { return _posState.payVariant; },
  getRequiredFloat() { return _posState.requiredFloat; },
  setRequiredFloat(n) { _posState.requiredFloat = Math.max(0, Number(n) || 0); try { localStorage.setItem('hw-pos-reqfloat', String(_posState.requiredFloat)); } catch {} _emit(); },
  subscribe(fn) { _posListeners.add(fn); return () => _posListeners.delete(fn); },
};

// Hook — re-render on any store change
window.usePOS = function usePOS() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.POS.subscribe(force), []);
  return window.POS;
};

Object.assign(window, {});
