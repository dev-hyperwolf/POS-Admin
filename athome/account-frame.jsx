// ── athome/account-frame.jsx — window.AccountFrame ──────────────────────────
// The phone bezel + status bar + home-indicator chrome that account-a/b/c.jsx's
// App() each carried as a byte-identical copy (only `noTab` differed). On a
// real ≤600px phone (window.HWPhone.useIsPhone(), same breakpoint as
// mobile/app.jsx's PhoneRoot) there is no reason to draw a fake 390×844 phone
// inside the real one, so this renders the account app full-viewport instead
// — no decorative bezel, no fake "9:41" status bar, no fake home indicator —
// with real safe-area padding via shared/hw-safe-area.js standing in for both.
// On a wide screen the decorative bezel preview is unchanged.
;(function () {
  const useIsPhone = window.HWPhone ? window.HWPhone.useIsPhone : function useIsPhone() {return false;};
  if (!window.HWPhone) {
    try {console.error('[HW phone] shared/hw-phone.js did not load — Customer Account.html is running with NO ' +
      'phone breakpoint, so a real phone falls back to the decorative bezel preview.');} catch (e) {}
  }
  const pad = (edge, n) => window.HWSafe ? window.HWSafe[edge](n) : n + 'px';

  window.AccountFrame = function AccountFrame({ children, tabBar, scrollRef }) {
    const useP = window.useP;
    const P = useP();
    const isPhone = useIsPhone();

    if (isPhone) {
      return (<>
        <style>{'.hw-account-phone-root{height:100vh;height:100dvh;width:100vw;}'}</style>
        <div className="hw-account-phone-root" style={{ display: 'flex', flexDirection: 'column', background: P.bg, fontFamily: P.fontSans, overflow: 'hidden' }}>
          <div style={{ height: pad('top', 0), flex: '0 0 auto' }} />
          <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', overflowX: 'hidden', background: P.bg, position: 'relative' }}>{children}</div>
          {tabBar}
          {/* No fake home indicator on a real phone — the OS draws its own.
              The real bottom safe-area inset still needs clearing, though,
              so a device with a home indicator doesn't sit on top of the tab
              bar / composer. */}
          <div style={{ height: pad('bottom', 0), flex: '0 0 auto', background: P.surface }} />
        </div>
      </>);
    }

    // Wide screen: today's decorative 390×min(844,vh-56) phone bezel, unchanged.
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.bg, fontFamily: P.fontSans, padding: '28px 0' }}>
        <div style={{ width: 390, height: 'min(844px, calc(100vh - 56px))', maxHeight: 844, borderRadius: 46, background: '#000', padding: 10, boxShadow: '0 40px 90px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.2)', flex: '0 0 auto' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 37, overflow: 'hidden', background: P.bg, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 44, flex: '0 0 44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', background: P.surface, zIndex: 20 }}>
              <span className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>9:41</span>
              <div style={{ position: 'absolute', left: '50%', top: 9, transform: 'translateX(-50%)', width: 96, height: 26, borderRadius: 20, background: '#000' }} />
              <span style={{ display: 'flex', gap: 5, alignItems: 'center', color: P.ink }}><window.Icon name="target" size={13} /><window.Icon name="chart" size={13} /><span style={{ width: 22, height: 11, border: `1.4px solid ${P.ink}`, borderRadius: 3, position: 'relative' }}><span style={{ position: 'absolute', inset: 1.5, right: 5, background: P.ink, borderRadius: 1 }} /></span></span>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', background: P.bg, position: 'relative' }}>{children}</div>
            {tabBar}
            <div style={{ height: 20, flex: '0 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.surface }}><span style={{ width: 130, height: 5, borderRadius: 99, background: P.ink, opacity: .35 }} /></div>
          </div>
        </div>
      </div>);
  };
})();
