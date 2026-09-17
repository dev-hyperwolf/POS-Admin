// ── Phone breakpoint helper — window.HWPhone ────────────────────────────────
// The ≤600px "is this a real phone, not the framed desktop preview" check was
// a byte-identical `useIsPhone()` (HW_PHONE_QUERY + matchMedia + lazy useState
// init) duplicated as each phone-first surface got the same treatment:
// mobile/app.jsx first, then athome/account-frame.jsx and pipeline/app.jsx.
// One copy here instead of three, same lazy-init contract as the original in
// mobile/app.jsx: matchMedia is read synchronously in the useState initializer
// so a phone never flashes the framed/desktop layout on first paint, and the
// effect just keeps it in sync after that.
//
// Plain JS, IIFE, one global — no JSX, so it loads as a plain <script> (after
// React/ReactDOM, since useIsPhone calls React hooks) the same way
// shared/hw-safe-area.js loads before every screen that reads it.
(function () {
  const HW_PHONE_QUERY = '(max-width: 600px)';

  // Pure and side-effect-free — takes an optional matchMedia so it's testable
  // under `node --test` with no real browser (test/phone-root.test.mjs stubs
  // a fake `window.matchMedia`). Defaults to the real window.matchMedia.
  function isPhone(matchMedia) {
    const mm = matchMedia || (typeof window !== 'undefined' ? window.matchMedia : undefined);
    try {
      return typeof mm === 'function' && mm(HW_PHONE_QUERY).matches;
    } catch (e) {
      return false;
    }
  }

  // pipeline/app.jsx: the /scan route renders full-viewport on a real phone
  // even though the shell still frames every other route. One predicate here
  // so the render check and its test agree on what "the scan route" means —
  // matches either a bare path ('/scan') or a full hash route ('#/scan').
  function isScanRoute(path) {
    if (!path) return false;
    const p = String(path).replace(/^#/, '').split('?')[0];
    return p === '/scan' || p === 'scan';
  }

  function useIsPhone() {
    const [phone, setPhone] = React.useState(() => isPhone());
    React.useEffect(() => {
      let mql;
      try { mql = window.matchMedia(HW_PHONE_QUERY); } catch (e) { return; }
      const onChange = () => setPhone(mql.matches);
      onChange();
      if (mql.addEventListener) mql.addEventListener('change', onChange); else if (mql.addListener) mql.addListener(onChange);
      window.addEventListener('resize', onChange);
      return () => {
        if (mql.removeEventListener) mql.removeEventListener('change', onChange); else if (mql.removeListener) mql.removeListener(onChange);
        window.removeEventListener('resize', onChange);
      };
    }, []);
    return phone;
  }

  window.HWPhone = { QUERY: HW_PHONE_QUERY, isPhone, isScanRoute, useIsPhone };
})();
