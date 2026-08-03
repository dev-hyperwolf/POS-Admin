// ── Flow 3 — Balance Waterfall (running ledger) ────────────────────────────
// The order of operations IS the interface: total cascades down through
// credits to a balance, then cash is taken, then the card base + fee.
const useP = window.useP;

window.Flow3 = function Flow3() {
  const P = useP();
  const { txn, cust } = window.PAY, money = window.money, c2 = window.c2;

  const [reward, setReward] = React.useState('10off');
  const [wallet, setWallet] = React.useState(5);
  const [cash, setCash] = React.useState('10');
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [done, setDone] = React.useState(false);

  const rw = window.PAY.rewards.find((r) => r.id === reward);
  const rewardVal = rw ? rw.value : 0;
  const afterReward = c2(txn.total - rewardVal);
  const afterWallet = c2(afterReward - wallet);
  const balance = Math.max(0, afterWallet);
  const cashNum = Math.min(parseFloat(cash) || 0, balance);
  const cardBase = Math.max(0, c2(balance - cashNum));
  const opt = window.PAY.feeOpts.find((o) => o.id === feeOpt);
  const feeAmt = window.PAY.fee(cardBase, opt);
  const cardCharged = c2(cardBase + feeAmt);

  if (done) return <window.FlowFrame title="Balance waterfall" tag="Flow 3 · Ledger"><window.Complete P={P} onReset={() => setDone(false)} lines={[['Cash', cashNum], ['Card charged', cardCharged], ['Credits', c2(rewardVal + wallet)]]} change={0} /></window.FlowFrame>;

  // Waterfall row — running balance + shrinking bar
  const Bar = ({ frac, color }) => (
    <div style={{ height: 6, background: P.surface3, borderRadius: 99, overflow: 'hidden', marginTop: 7 }}><div style={{ height: '100%', width: Math.max(0, Math.min(1, frac)) * 100 + '%', background: color, borderRadius: 99, transition: 'width .2s' }} /></div>
  );
  const chip = (active, label, onClick, dis, key) => <button key={key} onClick={onClick} disabled={dis} style={{ padding: '5px 11px', background: active ? P.accent : P.surface, color: active ? P.accentInk : P.ink2, border: `1px solid ${active ? P.accentBorder : P.hairline2}`, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .5 : 1, fontFamily: P.fontSans }}>{label}</button>;

  const rowStyle = (hero) => ({ padding: hero ? '14px 18px' : '13px 18px', background: hero ? P.ink : P.surface, border: `1px solid ${hero ? P.ink : P.hairline2}`, borderRadius: P.r12, color: hero ? '#fff' : P.ink });

  return (
    <window.FlowFrame title="Balance waterfall" tag="Flow 3 · Ledger"
      foot={<div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '13px 22px', borderTop: `1px solid ${P.hairline2}`, background: P.surface }}>
        <div style={{ fontSize: 11.5, color: P.inkDim }}>Cash <b style={{ color: P.ink, fontFamily: P.fontMono }}>{money(cashNum)}</b> + Card <b style={{ color: P.ink, fontFamily: P.fontMono }}>{money(cardCharged)}</b></div>
        <div style={{ flex: 1 }} />
        <window.PBtn variant="accent" size="lg" icon="check" onClick={() => setDone(true)}>Complete payment</window.PBtn>
      </div>}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {/* 1 total */}
        <div style={rowStyle(false)}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><span style={{ fontSize: 13, fontWeight: 700 }}>Order total</span><span style={{ fontSize: 17, fontWeight: 700, fontFamily: P.fontMono }}>{money(txn.total)}</span></div>
          <Bar frac={1} color={P.inkFaint} />
        </div>
        {/* 2 rewards */}
        <div style={rowStyle(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="star" size={15} color={P.accent} />
            <span style={{ fontSize: 12.5, fontWeight: 700, flex: '0 0 auto' }}>Redeem points</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>{window.PAY.rewards.map((r) => chip(reward === r.id, r.label, () => setReward(reward === r.id ? null : r.id), cust.points < r.cost && !r.bday, r.id))}</div>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: P.fontMono, color: rewardVal ? P.good : P.inkMute }}>{rewardVal ? '− ' + money(rewardVal) : '—'}</span>
          </div>
          <Bar frac={afterReward / txn.total} color={P.accent} />
        </div>
        {/* 3 wallet */}
        <div style={rowStyle(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="wallet" size={15} color={P.good} />
            <span style={{ fontSize: 12.5, fontWeight: 700, flex: '0 0 auto' }}>Wallet credit</span>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>{[0, 5, 10, cust.wallet].filter((v, i, a) => a.indexOf(v) === i).map((v) => chip(wallet === v, v === 0 ? 'Off' : v === cust.wallet ? `Max ${money(v)}` : money(v), () => setWallet(v), false, 'w' + v))}</div>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: P.fontMono, color: wallet ? P.good : P.inkMute }}>{wallet ? '− ' + money(wallet) : '—'}</span>
          </div>
          <Bar frac={afterWallet / txn.total} color={P.good} />
        </div>
        {/* 4 balance due (hero) */}
        <div style={rowStyle(true)}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', fontFamily: P.fontMono }}>Balance due → split below</span><span style={{ fontSize: 24, fontWeight: 700, fontFamily: P.fontMono, color: P.accent }}>{money(balance)}</span></div>
        </div>
        {/* 5 cash first */}
        <div style={{ ...rowStyle(false), borderColor: P.hairline3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="cash" size={15} color={P.ink2} />
            <span style={{ fontSize: 12.5, fontWeight: 700, flex: '0 0 auto' }}>Cash first</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              {[0, c2(balance / 2), balance].filter((v, i, a) => a.indexOf(v) === i).map((v) => chip(cashNum === v, v === 0 ? 'None' : v === balance ? 'All cash' : 'Half', () => setCash(String(v)), false, 'c' + v))}
              <div style={{ width: 96 }}><Field value={cash} onChange={(e) => setCash(e.target.value.replace(/[^0-9.]/g, ''))} size="sm" mono icon="dollar" placeholder="0.00" /></div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: P.fontMono }}>{money(cashNum)}</span>
          </div>
        </div>
        {/* 6 card base + fee */}
        <div style={{ ...rowStyle(false), borderColor: cardBase > 0 ? P.accentBorder : P.hairline2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: cardBase > 0 ? 10 : 0 }}>
            <Icon name="card" size={15} color={P.ink2} />
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Card {money(cardBase)} <span style={{ color: P.warn }}>+ fee {money(feeAmt)}</span></span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 17, fontWeight: 700, fontFamily: P.fontMono, color: P.ink }}>{money(cardCharged)}</span>
          </div>
          {cardBase > 0 && <window.FeeCompare base={cardBase} value={feeOpt} onChange={setFeeOpt} layout="strip" />}
        </div>
      </div>
    </window.FlowFrame>
  );
};
const c2 = window.c2;
Object.assign(window, {});
