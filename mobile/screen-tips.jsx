// ── Cash tips — driver keeps tips separate from company funds ───────────────
const useP = window.useP;
const _t = (n) => window.HW.fmt.money(n);

// Full tips screen (pushed)
window.TipsScreen = function TipsScreen() {
  const P = useP(); const M = window.useM();
  const tips = window.M.seedTips();
  const total = window.M.tipTotal();
  const cashSales = window.MD.SHIFT_COMPLETED.filter((s) => s.cash > 0).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title="My tips" sub="Kept separate from company cash" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
        {/* tip bank */}
        <div style={{ background: P.rail, borderRadius: P.r20, padding: '20px', marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>Your tip bank · today</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: P.accent, fontFamily: P.fontMono, letterSpacing: '-.01em', marginTop: 4 }}>{_t(total)}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono, marginTop: 3 }}>{tips.length} tips · your money, not the company's</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <PBtn variant="accent" size="lg" full icon="plus" onClick={() => window.M.openSheet('addtip', {})}>Log a tip</PBtn>
          <PBtn variant="secondary" size="lg" full icon="cash" onClick={() => window.M.openSheet('makechange', {})}>Make change</PBtn>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: P.infoSoft, borderRadius: P.r12, marginBottom: 18 }}>
          <Icon name="info" size={16} stroke={2} color={P.info} />
          <span style={{ fontSize: 12.5, color: P.info, fontWeight: 600, lineHeight: 1.4 }}>Log tips here so they never get counted against your pouch at reconciliation.</span>
        </div>

        <Eyebrow style={{ marginBottom: 10 }}>Today's tips</Eyebrow>
        {tips.length === 0 ? <div style={{ padding: '30px 0', textAlign: 'center', color: P.inkMute, fontSize: 13.5 }}>No tips logged yet.</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {tips.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: P.accentSoft, color: P.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="cash" size={18} stroke={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{t.name || 'Cash tip'}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{t.order ? t.order + ' · ' : ''}{t.at}</div></div>
              <span style={{ fontSize: 16, fontWeight: 800, color: P.good, fontFamily: P.fontMono }}>+{_t(t.amount)}</span>
            </div>
          ))}
        </div>}
      </div>
    </div>);
};

// Log a tip (sheet)
window.AddTipSheet = function AddTipSheet({ name, order }) {
  const P = useP();
  const [amt, setAmt] = React.useState('');
  const [who, setWho] = React.useState(name || '');
  const num = parseFloat(amt) || 0;
  return (
    <window.Sheet title="Log a cash tip" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="accent" size="xl" full icon="check" disabled={num <= 0} onClick={() => { window.M.addTip({ amount: num, name: who || 'Cash tip', order: order || null }); window.M.closeSheet(); window.M.flash('Tip added to your bank'); }}>Add {num > 0 ? _t(num) : 'tip'} to bank</PBtn>
    }>
      <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r12, padding: '16px', textAlign: 'center', fontSize: 40, fontWeight: 800, color: num > 0 ? P.ink : P.inkFaint, fontFamily: P.fontMono, marginBottom: 12 }}>{num > 0 ? _t(num) : '$0.00'}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>{[2, 3, 5, 10, 20].map((v) => <button key={v} onClick={() => setAmt(String(v))} style={{ flex: 1, padding: '12px 4px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 15, fontWeight: 700, color: P.info, cursor: 'pointer', fontFamily: P.fontMono }}>${v}</button>)}</div>
      <Eyebrow style={{ marginBottom: 8 }}>Amount</Eyebrow>
      <div style={{ marginBottom: 14 }}><Field icon="cash" placeholder="0.00" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} mono /></div>
      <Eyebrow style={{ marginBottom: 8 }}>From (optional)</Eyebrow>
      <Field icon="user" placeholder="Customer name" value={who} onChange={(e) => setWho(e.target.value)} />
    </window.Sheet>);
};

// Make change from tip bank (sheet)
window.MakeChangeSheet = function MakeChangeSheet() {
  const P = useP(); const M = window.useM();
  const [owed, setOwed] = React.useState('');
  const [bill, setBill] = React.useState(0);
  const bank = window.M.tipTotal();
  const owedN = parseFloat(owed) || 0;
  const change = bill > 0 && owedN > 0 ? Math.round((bill - owedN) * 100) / 100 : 0;
  const enough = change <= bank;
  return (
    <window.Sheet title="Make change" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant={change > 0 && enough ? 'accent' : 'secondary'} size="xl" full icon="check" disabled={change <= 0 || !enough} onClick={() => { window.M.closeSheet(); window.M.flash(`Hand back ${_t(change)} in change`); }}>{change > 0 ? `Give ${_t(change)} change` : 'Enter amounts'}</PBtn>
    }>
      <div style={{ fontSize: 13.5, color: P.inkDim, lineHeight: 1.5, marginBottom: 16 }}>Break a customer's large bill using your own tip cash — keeps company funds untouched.</div>
      <Eyebrow style={{ marginBottom: 8 }}>Amount owed</Eyebrow>
      <div style={{ marginBottom: 16 }}><Field icon="receipt" placeholder="0.00" value={owed} onChange={(e) => setOwed(e.target.value.replace(/[^0-9.]/g, ''))} mono /></div>
      <Eyebrow style={{ marginBottom: 8 }}>Customer paying with</Eyebrow>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>{[20, 50, 100].map((v) => { const a = bill === v; return <button key={v} onClick={() => setBill(v)} style={{ flex: 1, padding: '13px 4px', background: a ? P.accentSoft : P.surface2, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, fontSize: 16, fontWeight: 700, color: P.ink, cursor: 'pointer', fontFamily: P.fontMono }}>${v}</button>; })}</div>
      <div style={{ padding: '15px 16px', borderRadius: P.r14, background: change > 0 ? (enough ? P.goodSoft : P.badSoft) : P.surface2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 13.5, fontWeight: 700, color: change > 0 ? (enough ? P.good : P.bad) : P.inkDim }}>Change to give</span><span style={{ fontSize: 21, fontWeight: 800, color: change > 0 ? (enough ? P.good : P.bad) : P.inkFaint, fontFamily: P.fontMono }}>{_t(change)}</span></div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 6 }}>Tip bank available: {_t(bank)}{change > 0 && !enough ? ' · not enough tip cash' : ''}</div>
      </div>
    </window.Sheet>);
};

Object.assign(window, {});
