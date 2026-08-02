// ── Flow 2 — Tender Board (single screen, allocation slider) ───────────────
// Everything on one screen. A slider allocates the balance between cash and
// card; the card fee recomputes live. Credits sit on top and reduce first.
const useP = window.useP;

window.Flow2 = function Flow2() {
  const P = useP();
  const { txn, cust } = window.PAY, money = window.money, c2 = window.c2;

  const [reward, setReward] = React.useState('10off');
  const [wallet, setWallet] = React.useState(5);
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [cash, setCash] = React.useState(10);            // $ allocated to cash
  const [done, setDone] = React.useState(false);

  const rw = window.PAY.rewards.find((r) => r.id === reward);
  const credits = c2((rw ? rw.value : 0) + wallet);
  const balance = Math.max(0, c2(txn.total - credits));
  const cashV = Math.min(cash, balance);
  const cardBase = Math.max(0, c2(balance - cashV));
  const opt = window.PAY.feeOpts.find((o) => o.id === feeOpt);
  const feeAmt = window.PAY.fee(cardBase, opt);
  const cardCharged = c2(cardBase + feeAmt);
  const kind = cardBase <= 0 ? 'All cash' : cashV <= 0 ? 'All card' : 'Split';

  React.useEffect(() => { if (cash > balance) setCash(balance); }, [balance]);

  const preset = (k) => { if (k === 'cash') setCash(balance); if (k === 'card') setCash(0); if (k === 'half') setCash(c2(balance / 2)); };
  const pct = balance > 0 ? (cashV / balance) * 100 : 0;

  if (done) return <window.FlowFrame title="Tender board" tag="Flow 2 · Single screen"><window.Complete P={P} onReset={() => setDone(false)} lines={[['Cash', cashV], ['Card charged', cardCharged], ['Credits', credits]]} change={0} /></window.FlowFrame>;

  return (
    <window.FlowFrame title="Tender board" tag="Flow 2 · Single screen"
      foot={<div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '13px 22px', borderTop: `1px solid ${P.hairline2}`, background: P.surface }}>
        <div><div style={{ fontSize: 10, color: P.inkMute, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Collected</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(c2(cashV + cardCharged + credits))}</div></div>
        <div style={{ flex: 1 }} />
        <window.PBtn variant="accent" size="lg" icon="check" onClick={() => setDone(true)}>Charge {money(c2(cashV + cardCharged))}</window.PBtn>
      </div>}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left — order + credits */}
        <div style={{ flex: '0 0 300px', background: P.surface2, borderRight: `1px solid ${P.hairline2}`, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          <div>
            <Eyebrow style={{ marginBottom: 9 }}>Order · {txn.items} items</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {txn.lines.map((l) => <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Thumb item={l} size={30} /><span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span><span style={{ fontSize: 12, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(l.price)}</span></div>)}
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <window.KV k="Subtotal" v={money(txn.sub)} />
              <window.KV k="Tax 8.22%" v={money(txn.tax)} />
              <window.KV k="Total" v={money(txn.total)} strong />
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${P.hairline2}`, paddingTop: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}><Icon name="star" size={13} color={P.accent} /><span style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>Redeem points</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {window.PAY.rewards.map((r) => { const a = reward === r.id, can = cust.points >= r.cost; return <button key={r.id} disabled={!can} onClick={() => setReward(a ? null : r.id)} style={{ padding: '6px 10px', background: a ? P.accent : P.surface, color: a ? P.accentInk : P.ink2, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .5, fontFamily: P.fontSans }}>{r.label}</button>; })}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}><Icon name="wallet" size={13} color={P.good} /><span style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>Wallet</span><span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{money(cust.wallet)}</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 5, 10, cust.wallet].filter((v, i, a) => a.indexOf(v) === i).map((v) => { const a = wallet === v; return <button key={v} onClick={() => setWallet(v)} style={{ flex: 1, padding: '7px 6px', background: a ? P.accentSoft : P.surface, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: P.ink, cursor: 'pointer', fontFamily: P.fontMono }}>{v === 0 ? 'Off' : v === cust.wallet ? 'Max' : money(v)}</button>; })}
            </div>
          </div>
        </div>

        {/* Right — allocation board */}
        <div style={{ flex: 1, minWidth: 0, padding: '20px 26px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
            <div><Eyebrow>Balance due</Eyebrow><div style={{ fontSize: 34, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.02em' }}>{money(balance)}</div></div>
            <window.Pill kind={kind === 'Split' ? 'accent' : 'neutral'} icon={kind === 'All cash' ? 'cash' : kind === 'All card' ? 'card' : 'split'}>{kind}</window.Pill>
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '14px 0 6px' }}>
            {[['cash', 'All cash'], ['half', '50 / 50'], ['card', 'All card']].map(([k, l]) => <button key={k} onClick={() => preset(k)} style={{ flex: 1, padding: '8px 0', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 12, fontWeight: 700, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>{l}</button>)}
          </div>

          {/* slider */}
          <div style={{ padding: '16px 4px 4px' }}>
            <div style={{ position: 'relative', height: 12 }}>
              <div style={{ position: 'absolute', inset: '3px 0', borderRadius: 99, background: P.info, opacity: .22 }} />
              <div style={{ position: 'absolute', top: 3, bottom: 3, left: 0, width: pct + '%', borderRadius: 99, background: P.info }} />
              <input type="range" min={0} max={Math.max(1, balance)} step={0.01} value={cashV} onChange={(e) => setCash(parseFloat(e.target.value))} style={{ position: 'absolute', inset: 0, width: '100%', margin: 0, opacity: 0, cursor: 'pointer' }} />
              <div style={{ position: 'absolute', top: '50%', left: `calc(${pct}% )`, transform: 'translate(-50%,-50%)', width: 22, height: 22, borderRadius: 99, background: '#fff', border: `2px solid ${P.info}`, boxShadow: P.shadowMd, pointerEvents: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}><span>← more cash</span><span>more card →</span></div>
          </div>

          {/* two tender cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div style={{ padding: '14px 16px', background: P.surface, border: `1.5px solid ${cashV > 0 ? P.hairline3 : P.hairline}`, borderRadius: P.r14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><Icon name="cash" size={16} color={P.ink2} /><span style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>Cash</span><span style={{ marginLeft: 'auto', fontSize: 9.5, color: P.inkMute, fontFamily: P.fontMono }}>no fee</span></div>
              <div style={{ fontSize: 26, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(cashV)}</div>
            </div>
            <div style={{ padding: '14px 16px', background: P.surface, border: `1.5px solid ${cardBase > 0 ? P.accentBorder : P.hairline}`, borderRadius: P.r14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><Icon name="card" size={16} color={P.ink2} /><span style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>Card</span><span style={{ marginLeft: 'auto', fontSize: 9.5, color: P.warn, fontWeight: 700, fontFamily: P.fontMono }}>+ fee</span></div>
              <div style={{ fontSize: 26, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(cardCharged)}</div>
              <div style={{ fontSize: 10.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{money(cardBase)} base + {money(feeAmt)} fee</div>
            </div>
          </div>

          {/* fee toggle */}
          {cardBase > 0 && <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><Icon name="percent" size={13} color={P.inkDim} /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Processing fee on card</span></div>
            <window.FeeCompare base={cardBase} value={feeOpt} onChange={setFeeOpt} layout="strip" />
          </div>}
        </div>
      </div>
    </window.FlowFrame>
  );
};
const c2 = window.c2;
Object.assign(window, {});
