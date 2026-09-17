// Three directions for the consumer account, in one file. The chrome sits
// outside each app's ThemeProvider, so it uses fixed dark tokens.
;(function () {
  const { useState } = React;
  const useIsPhone = window.HWPhone ? window.HWPhone.useIsPhone : function useIsPhone() {return false;};
  const OPTS = [
    { k: 'a', label: 'Hub & groups', note: 'Option A · current', g: 'CustomerAccountApp' },
    { k: 'b', label: 'Membership card', note: 'Option B', g: 'CustomerAccountAppB' },
    { k: 'c', label: 'Concierge', note: 'Option C', g: 'CustomerAccountAppC' }];

  /* == WHERE A FAILURE STOPS IN THE CUSTOMER ACCOUNT ==
   * CONTAINS, keyed by direction. Each direction is a whole self-contained account
   * app, so one failing shows a named panel while the direction switcher below it
   * keeps working -- which is the only control that could get the reader out.
   * !! RENDER AND LIFECYCLE ERRORS ONLY -- not event handlers, not async work. */
  if (!window.ScreenBoundary || !window.CriticalBoundary) {
    try {console.error('[HW boundary] Customer Account.html did not load shared/error-boundary.jsx — ' +
      'the customer account is running with NO error boundaries.');} catch (e) {}
  }
  const AccountFrame = window.ScreenBoundary || function AccountFrame(p) {return p.children;};

  window.CustomerAccountSwitch = function CustomerAccountSwitch() {
    const [k, setK] = useState(() => {try {return localStorage.getItem('hw-account-opt') || 'a';} catch (e) {return 'a';}});
    const pick = (n) => {setK(n);try {localStorage.setItem('hw-account-opt', n);} catch (e) {}};
    const cur = OPTS.find((o) => o.k === k) || OPTS[0];
    const App = window[cur.g];
    const isPhone = useIsPhone();
    // This picker is a design-review tool, not a customer feature -- the
    // owner picks the direction later, then it goes away. On a real phone it
    // would just be a floating bar a customer could tap by accident, so it
    // only shows there behind an explicit ?review=1, same URL a reviewer
    // would already be using to open this on their own phone to check it.
    let showChrome = true;
    if (isPhone) {
      try {showChrome = new URLSearchParams(window.location.search).get('review') === '1';} catch (e) {showChrome = false;}
    }
    return <>
      {App ? <AccountFrame key={cur.k} name={'The customer account · ' + (cur.label || cur.k)}><App /></AccountFrame> : null}
      {showChrome &&
      <div data-hw-chrome="athome-direction" style={{ position: 'fixed', left: 16, bottom: 16, zIndex: (window.HW_Z || {}).chromeBar, display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#15140f', border: '1px solid #3d3930', borderRadius: 13, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
        <span style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#726d61', padding: '0 6px 0 8px' }}>Direction</span>
        {OPTS.map((o) =>
        <button key={o.k} onClick={() => pick(o.k)} title={o.note} style={{ padding: '7px 12px', minHeight: 44, borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Inter,-apple-system,sans-serif', fontSize: 12.5, fontWeight: 600, background: o.k === k ? '#FFD100' : 'transparent', color: o.k === k ? '#15140f' : '#e9e6dd' }}>
            {o.label}
          </button>
        )}
      </div>}
    </>;
  };
})();
