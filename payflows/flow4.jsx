// ── Flow 4 — Method Cards + Drawer (touch-first) ───────────────────────────
// Big tap targets. Credits collapse at top. Choosing a method raises a bottom
// drawer; Split forces cash entry first, card fee chosen from two big cards.
const useP = window.useP;

window.Flow4 = function Flow4() {
  const P = useP();
  const { txn, cust } = window.PAY, money = window.money, c2 = window.c2;

  const [reward, setReward] = React.useState(null);
  const [wallet, setWallet] = React.useState(0);
  const [creditsOpen, setCreditsOpen] = React.useState(true);
  const [method, setMethod] = React.useState(null);
  const [cash, setCash] = React.useState('');
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [done, setDone] = React.useState(false);

  const rw = window.PAY.rewards.find((r) => r.id === reward);
  const credits = c2((rw ? rw.value : 0) + wallet);
  const balance = Math.max(0, c2(txn.total - credits));
  const cashNum = parseFloat(cash) || 0;
  const cardBase = method === 'card' ? balance : method === 'split' ? Math.max(0, c2(balance - cashNum)) : 0;
  const opt = window.PAY.feeOpts.find((o) => o.id === feeOpt);
  const feeAmt = window.PAY.fee(cardBase, opt);
  const cardCharged = c2(cardBase + feeAmt);
  const change = method === 'cash' ? c2(cashNum - balance) : 0;
  const pad = (k) => setCash((s) => window.padPush(s, k));
  const closeDrawer = () => { setMethod(null); setCash(''); };

  const canComplete = method === 'card' ? true : method === 'cash' ? cashNum >= balance : method === 'split' ? (cashNum > 0 && cashNum < balance) : false;

  if (done) return <window.FlowFrame title="Method cards" tag="Flow 4 · Touch"><window.Complete P={P} onReset={() => { setDone(false); closeDrawer(); }} lines={[['Cash', method === 'cash' ? balance : cashNum], ['Card charged', method === 'cash' ? 0 : cardCharged], ['Credits', credits]]} change={change} /></window.FlowFrame>;

  const methods = [['cash', 'Cash', 'cash', 'No fee'], ['card', 'Card', 'card', '+ processing fee'], ['split', 'Split', 'split', 'Cash first, then card']];

  return (
    <window.FlowFrame title="Method cards" tag="Flow 4 · Touch">
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', padding: '18px 22px' }}>
        {/* balance banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: P.ink, borderRadius: P.r16, color: '#fff', marginBottom: 14 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>Balance due</div><div style={{ fontSize: 30, fontWeight: 700, fontFamily: P.fontMono, color: P.accent, letterSpacing: '-.01em' }}>{money(balance)}</div></div>
          <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono, lineHeight: 1.7 }}>Total {money(txn.total)}<br />{credits > 0 ? `Credits − ${money(credits)}` : 'No credits applied'}</div>
        </div>

        {/* credits collapsible */}
        <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, background: P.surface, marginBottom: 16, overflow: 'hidden' }}>
          <button onClick={() => setCreditsOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="gift" size={17} color={P.ink2} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Apply credits</span>
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{cust.points.toLocaleString()} pts · {money(cust.wallet)} wallet</span>
            <div style={{ flex: 1 }} /><Icon name="chevron-down" size={16} stroke={2.2} color={P.inkDim} style={{ transform: creditsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {creditsOpen && <div style={{ padding: '0 16px 15px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Eyebrow style={{ marginBottom: 8 }}>Redeem points</Eyebrow>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{window.PAY.rewards.map((r) => { const a = reward === r.id, can = cust.points >= r.cost; return <button key={r.id} disabled={!can} onClick={() => setReward(a ? null : r.id)} style={{ padding: '10px 16px', background: a ? P.accentSoft : P.surface2, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, fontSize: 13, fontWeight: 700, color: P.ink, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .5, fontFamily: P.fontSans }}>{r.label}<span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginLeft: 6 }}>{r.cost}p</span></button>; })}</div>
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 8 }}>Wallet credit</Eyebrow>
              <div style={{ display: 'flex', gap: 8 }}>{[0, 5, 10, cust.wallet].filter((v, i, a) => a.indexOf(v) === i).map((v) => { const a = wallet === v; return <button key={v} onClick={() => setWallet(v)} style={{ flex: 1, padding: '11px 8px', background: a ? P.accentSoft : P.surface2, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, fontSize: 13, fontWeight: 700, color: P.ink, cursor: 'pointer', fontFamily: P.fontMono }}>{v === 0 ? 'None' : v === cust.wallet ? `Max ${money(v)}` : money(v)}</button>; })}</div>
            </div>
          </div>}
        </div>

        {/* method tiles */}
        <Eyebrow style={{ marginBottom: 10 }}>Choose tender</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flex: '0 0 auto' }}>
          {methods.map(([v, l, ic, d]) => (
            <button key={v} onClick={() => { setMethod(v); if (v !== 'split') setCash(''); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '22px 12px', background: P.surface, border: `1.5px solid ${P.hairline2}`, borderRadius: P.r16, cursor: 'pointer', fontFamily: P.fontSans }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: P.surface3, color: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={26} stroke={1.7} /></span>
              <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{l}</span>
              <span style={{ fontSize: 11, color: P.inkDim, textAlign: 'center' }}>{d}</span>
            </button>
          ))}
        </div>

        {/* drawer */}
        {method && <>
          <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, background: P.scrim, animation: 'fade .15s ease', zIndex: 5 }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6, background: P.surface, borderTop: `1px solid ${P.hairline2}`, borderRadius: `${P.r20}px ${P.r20}px 0 0`, boxShadow: P.shadowLg, padding: '16px 22px 20px', maxHeight: '82%', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Icon name={method === 'cash' ? 'cash' : method === 'card' ? 'card' : 'split'} size={19} color={P.ink} />
              <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{method === 'cash' ? 'Cash payment' : method === 'card' ? 'Card payment' : 'Split — cash first'}</span>
              <div style={{ flex: 1 }} /><IconBtn icon="x" size={17} onClick={closeDrawer} />
            </div>

            {method === 'split' && <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: '0 0 250px' }}>
                <Eyebrow style={{ marginBottom: 8 }}>Cash portion</Eyebrow>
                <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, padding: '12px 14px', textAlign: 'right', fontSize: 24, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 10 }}>${cash === '' ? '0.00' : cash}</div>
                <window.PadKeys onPress={pad} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ padding: '12px 15px', background: P.infoSoft, borderRadius: P.r12, marginBottom: 12 }}><window.KV k="Card gets the rest" v={money(cardBase)} strong color={P.info} /></div>
                <Eyebrow style={{ marginBottom: 8 }}>Processing fee on {money(cardBase)}</Eyebrow>
                <window.FeeCompare base={cardBase} value={feeOpt} onChange={setFeeOpt} layout="cards" />
              </div>
            </div>}

            {method === 'card' && <div>
              <div style={{ padding: '12px 15px', background: P.surface2, borderRadius: P.r12, marginBottom: 14 }}><window.KV k="Card base" v={money(balance)} strong /></div>
              <Eyebrow style={{ marginBottom: 8 }}>Processing fee — choose structure</Eyebrow>
              <window.FeeCompare base={balance} value={feeOpt} onChange={setFeeOpt} layout="cards" />
            </div>}

            {method === 'cash' && <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: '0 0 250px' }}>
                <Eyebrow style={{ marginBottom: 8 }}>Cash tendered</Eyebrow>
                <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, padding: '12px 14px', textAlign: 'right', fontSize: 24, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 10 }}>${cash === '' ? '0.00' : cash}</div>
                <window.PadKeys onPress={pad} />
              </div>
              <div style={{ flex: 1 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Quick cash</Eyebrow>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{[Math.ceil(balance), Math.ceil(balance / 5) * 5, Math.ceil(balance / 10) * 10, Math.ceil(balance / 20) * 20].filter((v, i, a) => a.indexOf(v) === i).map((v) => <button key={v} onClick={() => setCash(v.toFixed(2))} style={{ padding: '11px 16px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 14, fontWeight: 700, color: P.info, cursor: 'pointer', fontFamily: P.fontMono }}>{money(v)}</button>)}</div>
                <div style={{ padding: '14px 16px', borderRadius: P.r12, background: change >= 0 ? P.goodSoft : P.badSoft }}><window.KV k={change >= 0 ? 'Change due' : 'Still owed'} v={money(Math.abs(change))} strong color={change >= 0 ? P.good : P.bad} /></div>
              </div>
            </div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <PBtn variant="secondary" size="lg" onClick={closeDrawer}>Cancel</PBtn>
              <div style={{ flex: 1 }} />
              <PBtn variant="accent" size="lg" icon="check" disabled={!canComplete} onClick={() => setDone(true)}>Charge {money(method === 'cash' ? balance : c2((method === 'split' ? cashNum : 0) + cardCharged))}</PBtn>
            </div>
          </div>
        </>}
      </div>
    </window.FlowFrame>
  );
};
const c2 = window.c2;
Object.assign(window, {});
