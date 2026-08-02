// Three directions for the consumer account, in one file. The chrome sits
// outside each app's ThemeProvider, so it uses fixed dark tokens.
;(function () {
  const { useState } = React;
  const OPTS = [
    { k: 'a', label: 'Hub & groups', note: 'Option A · current', g: 'CustomerAccountApp' },
    { k: 'b', label: 'Membership card', note: 'Option B', g: 'CustomerAccountAppB' },
    { k: 'c', label: 'Concierge', note: 'Option C', g: 'CustomerAccountAppC' }];

  window.CustomerAccountSwitch = function CustomerAccountSwitch() {
    const [k, setK] = useState(() => {try {return localStorage.getItem('hw-account-opt') || 'a';} catch (e) {return 'a';}});
    const pick = (n) => {setK(n);try {localStorage.setItem('hw-account-opt', n);} catch (e) {}};
    const cur = OPTS.find((o) => o.k === k) || OPTS[0];
    const App = window[cur.g];
    return <>
      {App ? <App key={cur.k} /> : null}
      <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 2147482000, display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#15140f', border: '1px solid #3d3930', borderRadius: 13, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
        <span style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#726d61', padding: '0 6px 0 8px' }}>Direction</span>
        {OPTS.map((o) =>
        <button key={o.k} onClick={() => pick(o.k)} title={o.note} style={{ padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Inter,-apple-system,sans-serif', fontSize: 12.5, fontWeight: 600, background: o.k === k ? '#FFD100' : 'transparent', color: o.k === k ? '#15140f' : '#e9e6dd' }}>
            {o.label}
          </button>
        )}
      </div>
    </>;
  };
})();
