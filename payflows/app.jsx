// ── Payment flows — canvas app ─────────────────────────────────────────────
const { useP } = window;

// Static comparison card for the dev team
function CompareBoard() {
  const P = window.THEMES.light;
  const rows = [
    ['Flow 1 · Guided wizard', 'One decision per screen, progress rail', 'New / seasonal staff, error-averse', 'Highest — 4–5 screens', 'Safest. Hard to mis-tender. Slowest.'],
    ['Flow 2 · Tender board', 'One screen, slider splits cash/card', 'Fast walk-up lanes', 'Lowest — everything visible', 'Fastest for pros. Denser to learn.'],
    ['Flow 3 · Balance waterfall', 'Ledger cascades total → credits → split', 'Training + transparency', 'Medium — scroll one column', 'Teaches the order of operations best.'],
    ['Flow 4 · Method cards + drawer', 'Big tiles raise a bottom sheet', 'Touch screens, gloves', 'Medium — tile then drawer', 'Most touch-friendly. Biggest targets.'],
    ['Flow 5 · Smart calculator', 'Keypad feeds a locked bucket', 'Cashiers who like a calculator', 'Medium — assign & type', 'Enforces cash-first via a hard lock.'],
  ];
  const cols = ['Flow', 'Core idea', 'Best for', 'Taps', 'Trade-off'];
  return (
    <div style={{ width: '100%', height: '100%', background: P.surface, fontFamily: P.fontSans, color: P.ink, padding: '26px 30px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, marginBottom: 6 }}>For the dev team</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 4 }}>Five flows, one rule set</div>
      <div style={{ fontSize: 12.5, color: P.inkDim, maxWidth: 720, marginBottom: 18 }}>Every flow enforces the same logic: credits (points + wallet) come off the total first, then a Split takes the <b>cash amount before card</b> so the merchant fee only lands on the card base. Both fee structures — <b>6% flat</b> and <b>5% + $0.50</b> — are always shown side-by-side to pick from.</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead><tr>{cols.map((c, i) => <th key={c} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1.5px solid ${P.hairline3}`, fontFamily: P.fontMono, width: i === 0 ? '20%' : i === 1 ? '26%' : i === 4 ? '26%' : 'auto' }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci} style={{ padding: '13px 12px', borderBottom: `1px solid ${P.hairline}`, verticalAlign: 'top', color: ci === 0 ? P.ink : P.ink2, fontWeight: ci === 0 ? 700 : 500, lineHeight: 1.4 }}>{cell}</td>)}</tr>)}</tbody>
      </table>
      <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {[['Total', '$34.63', 'demo cart · 2 items'], ['If cash', '$10.00', 'entered first'], ['Card base', '$9.63', 'after credits + cash'], ['6% flat', '+$0.58', 'card charged $10.21'], ['5% + $0.50', '+$0.98', 'card charged $10.61']].map((m, i) => (
          <div key={i} style={{ minWidth: 92 }}><div style={{ fontSize: 9.5, color: P.inkMute, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: P.fontMono }}>{m[0]}</div><div style={{ fontSize: 19, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{m[1]}</div><div style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono }}>{m[2]}</div></div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const light = { mode: 'light', P: window.THEMES.light, setMode() {}, toggle() {} };
  const W = 940, H = 720;
  return (
    <window.ThemeCtx.Provider value={light}>
      <window.DesignCanvas>
        <window.DCSection id="flows" title="Payment flows" subtitle="Five ways to run the same tender — all cash, all card, or split (cash first, fee on card). Click through each; pick one for the devs.">
          <window.DCArtboard id="f1" label="Flow 1 · Guided wizard — one decision per screen" width={W} height={H}><window.Flow1 /></window.DCArtboard>
          <window.DCArtboard id="f2" label="Flow 2 · Tender board — allocation slider on one screen" width={W} height={H}><window.Flow2 /></window.DCArtboard>
          <window.DCArtboard id="f3" label="Flow 3 · Balance waterfall — order of operations as a ledger" width={W} height={H}><window.Flow3 /></window.DCArtboard>
          <window.DCArtboard id="f4" label="Flow 4 · Method cards + drawer — touch-first bottom sheet" width={W} height={H}><window.Flow4 /></window.DCArtboard>
          <window.DCArtboard id="f5" label="Flow 5 · Smart calculator — keypad feeds a locked bucket" width={W} height={H}><window.Flow5 /></window.DCArtboard>
        </window.DCSection>
        <window.DCSection id="compare" title="Comparison" subtitle="Shared spec + a quick side-by-side for the implementation call.">
          <window.DCArtboard id="cmp" label="Flow comparison" width={1000} height={620}><CompareBoard /></window.DCArtboard>
        </window.DCSection>
      </window.DesignCanvas>
    </window.ThemeCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
