// ── Flow 5 — Smart Calculator (bucket assignment) ──────────────────────────
// One keypad, tap a bucket to aim it. In Split the card bucket is LOCKED until
// cash is entered — enforcing cash-first. Fee strip recomputes the card total.
const useP = window.useP;

window.Flow5 = function Flow5() {
  const P = useP();
  const { txn, cust } = window.PAY, money = window.money, c2 = window.c2;

  const [reward, setReward] = React.useState(null);
  const [wallet, setWallet] = React.useState(0);
  const [mode, setMode] = React.useState('split');       // cash | card | split
  const [active, setActive] = React.useState('cash');    // which bucket keypad feeds
  const [cash, setCash] = React.useState('');
  const [cardStr, setCardStr] = React.useState('');
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [done, setDone] = React.useState(false);

  const rw = window.PAY.rewards.find((r) => r.id === reward);
  const credits = c2((rw ? rw.value : 0) + wallet);
  const balance = Math.max(0, c2(txn.total - credits));

  const cashNum = parseFloat(cash) || 0;
  const cardBase = mode === 'card' ? balance : (parseFloat(cardStr) || 0);
  const opt = window.PAY.feeOpts.find((o) => o.id === feeOpt);
  const feeAmt = window.PAY.fee(cardBase, opt);
  const cardCharged = c2(cardBase + feeAmt);
  const allocated = c2((mode === 'cash' ? balance : cashNum) + (mode === 'cash' ? 0 : cardBase));
  const remaining = c2(balance - (mode === 'cash' ? balance : cashNum) - (mode === 'cash' ? 0 : (mode === 'card' ? balance : cardBase)));
  const cardLocked = mode === 'split' && cashNum <= 0;

  const setMode2 = (m) => { setMode(m); setCash(''); setCardStr(''); setActive(m === 'card' ? 'card' : 'cash'); };
  const pad = (k) => {
    if (active === 'cash') setCash((s) => window.padPush(s, k));
    else if (active === 'card' && !cardLocked) setCardStr((s) => window.padPush(s, k));
  };
  const fillRemaining = () => {
    const r = mode === 'split' ? Math.max(0, c2(balance - cashNum)) : balance;
    if (active === 'cash') setCash(r.toFixed(2)); else setCardStr(r.toFixed(2));
  };
  const ready = mode === 'cash' ? true : mode === 'card' ? true : (cashNum > 0 && cardBase > 0 && Math.abs(remaining) < 0.005);

  if (done) return <window.FlowFrame title="Smart calculator" tag="Flow 5 · Keypad"><window.Complete P={P} onReset={() => setMode2('split')} lines={[['Cash', mode === 'cash' ? balance : cashNum], ['Card charged', mode === 'cash' ? 0 : cardCharged], ['Credits', credits]]} change={mode === 'cash' ? 0 : 0} /></window.FlowFrame>;

  const bucket = (id, label, ic, val, note, locked) => {
    const a = active === id, on = !locked;
    return (
      <button onClick={() => on && setActive(id)} disabled={!on} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textAlign: 'left', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : .6, fontFamily: P.fontSans }}>
        <span style={{ width: 36, height: 36, borderRadius: 9, flex: '0 0 auto', background: a ? P.accent : P.surface3, color: a ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={locked ? 'lock' : ic} size={18} stroke={1.8} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{label}{a && <span style={{ marginLeft: 7, fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.08em' }}>◀ TYPING</span>}</div>
          <div style={{ fontSize: 11.5, color: locked ? P.warn : P.inkDim, fontFamily: P.fontMono }}>{locked ? 'Enter cash first' : note}</div>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(val)}</span>
      </button>
    );
  };

  return (
    <window.FlowFrame title="Smart calculator" tag="Flow 5 · Keypad"
      foot={<div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 22px', borderTop: `1px solid ${P.hairline2}`, background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: Math.abs(remaining) < 0.005 ? P.good : P.warn }}><Icon name={Math.abs(remaining) < 0.005 ? 'check-circle' : 'info'} size={15} stroke={2} />{Math.abs(remaining) < 0.005 ? 'Fully allocated' : `${money(Math.abs(remaining))} ${remaining > 0 ? 'unassigned' : 'over'}`}</div>
        <div style={{ flex: 1 }} />
        <window.PBtn variant="accent" size="lg" icon="check" disabled={!ready} onClick={() => setDone(true)}>Complete</window.PBtn>
      </div>}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left — buckets */}
        <div style={{ flex: 1, minWidth: 0, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 11, overflow: 'hidden' }}>
          {/* mode + remaining */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Seg value={mode} onChange={setMode2} options={[{ value: 'cash', label: 'All cash' }, { value: 'card', label: 'All card' }, { value: 'split', label: 'Split' }]} />
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: P.inkMute, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Balance</div><div style={{ fontSize: 21, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(balance)}</div></div>
          </div>

          {/* credit pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
            <Icon name="gift" size={13} color={P.inkDim} />
            {window.PAY.rewards.map((r) => { const a = reward === r.id, can = cust.points >= r.cost; return <button key={r.id} disabled={!can} onClick={() => setReward(a ? null : r.id)} style={{ padding: '5px 10px', background: a ? P.accent : P.surface, color: a ? P.accentInk : P.ink2, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .5, fontFamily: P.fontSans }}>{r.label}</button>; })}
            <span style={{ width: 1, height: 16, background: P.hairline2 }} />
            {[5, cust.wallet].filter((v, i, a) => a.indexOf(v) === i).map((v) => { const a = wallet === v; return <button key={v} onClick={() => setWallet(a ? 0 : v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: a ? P.accent : P.surface, color: a ? P.accentInk : P.ink2, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="wallet" size={11} />{v === cust.wallet ? `Wallet ${money(v)}` : money(v)}</button>; })}
          </div>

          {/* buckets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 2 }}>
            {mode !== 'card' && bucket('cash', 'Cash', 'cash', mode === 'cash' ? balance : cashNum, mode === 'cash' ? 'Covers full balance' : 'No processing fee', false)}
            {mode !== 'cash' && bucket('card', 'Card', 'card', cardCharged, cardBase > 0 ? `${money(cardBase)} base + ${money(feeAmt)} fee` : 'Processing fee applies', cardLocked)}
          </div>

          {/* fee strip */}
          {mode !== 'cash' && cardBase > 0 && <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}><Icon name="percent" size={12} color={P.inkDim} /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Fee on card {money(cardBase)}</span></div>
            <window.FeeCompare base={cardBase} value={feeOpt} onChange={setFeeOpt} layout="strip" />
          </div>}
        </div>

        {/* Right — keypad */}
        <div style={{ flex: '0 0 268px', background: P.surface2, borderLeft: `1px solid ${P.hairline2}`, padding: '18px 18px', display: 'flex', flexDirection: 'column' }}>
          <Eyebrow style={{ marginBottom: 8 }}>Feeding: {active === 'cash' ? 'Cash' : 'Card'}{cardLocked && active === 'card' ? ' (locked)' : ''}</Eyebrow>
          <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, padding: '13px 15px', textAlign: 'right', fontSize: 30, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 10 }}>${(active === 'cash' ? cash : cardStr) === '' ? '0.00' : (active === 'cash' ? cash : cardStr)}</div>
          <button onClick={fillRemaining} disabled={mode === 'card'} style={{ padding: '9px 0', marginBottom: 10, background: P.surface, border: `1px dashed ${P.hairline3}`, borderRadius: P.r10, fontSize: 12.5, fontWeight: 700, color: mode === 'card' ? P.inkFaint : P.info, cursor: mode === 'card' ? 'not-allowed' : 'pointer', fontFamily: P.fontSans }}>Fill remaining · {money(Math.max(0, mode === 'split' ? c2(balance - cashNum) : balance))}</button>
          <window.PadKeys onPress={pad} />
        </div>
      </div>
    </window.FlowFrame>
  );
};
const c2 = window.c2;
Object.assign(window, {});
