// ── Complete Order — close-out: ID check → collect (inline tender) → done ───
//   Payment IS the completion. No success/failure toggle; problems are a
//   separate, de-emphasised path. Done screen shows delivery metrics.
const useP = window.useP;
const _mm = (n) => window.HW.fmt.money(n);
const _dwell = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

const PROBLEM_REASONS = [
{ id: 'unavailable', label: 'Customer unavailable' },
{ id: 'idfail', label: 'Failed ID / under 21' },
{ id: 'address', label: 'Address issue' },
{ id: 'refused', label: 'Order refused' },
{ id: 'other', label: 'Other' }];


// Metric row for the done screen
function Metric({ icon, tint, label, value, sub }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14 }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: tint + (P.mode === 'dark' ? '22' : '18'), color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={20} stroke={1.9} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, marginTop: 1 }}>{value}</div>
      </div>
      {sub && <div style={{ fontSize: 11.5, fontWeight: 700, color: tint, fontFamily: P.fontMono, textAlign: 'right', maxWidth: 96 }}>{sub}</div>}
    </div>);

}

window.CompleteScreen = function CompleteScreen({ taskId, receiptOnly }) {
  const P = useP();const M = window.useM();
  const base = window.findTask(taskId);
  const existing = M.s.completed.find((c) => c.taskId === taskId);
  const items = M.s.cartTaskId === taskId && M.s.cart.length ? M.s.cart : base ? base.items : [];
  const totals = window.MD.cartTotals(items);
  const cod = base && base.pay === 'cod';
  const origCount = base ? window.MD.cartTotals(base.items).count : 0;
  const addedCount = Math.max(0, totals.count - origCount);
  const addedValue = base ? Math.max(0, totals.total - window.MD.cartTotals(base.items).total) : 0;

  const [idChecked, setIdChecked] = React.useState(!!(base && base.verified));
  const [showIdCam, setShowIdCam] = React.useState(false);
  const [pay, setPay] = React.useState(null);
  const [showPay, setShowPay] = React.useState(false);
  const [payMethod, setPayMethod] = React.useState(base && base.tender || 'cash');
  const [ann, setAnn] = React.useState(window.MD.ANNOUNCEMENTS.map((a) => ({ ...a })));
  const [problemOpen, setProblemOpen] = React.useState(false);
  const [reason, setReason] = React.useState(null);
  const [done, setDone] = React.useState(receiptOnly ? existing || null : null);

  if (!base && !done) return <div style={{ height: '100%' }}><window.MTopBar title="Complete" /></div>;

  const finish = (outcome, saleFromPay) => {
    const p = saleFromPay || pay;
    const sale = {
      taskId, order: base.order, name: base.name, at: Date.now(), visit: base.visit, slack: base.slack,
      outcome, items: totals.count, total: totals.total, addedCount, addedValue, dwellSec: base.dwellSec,
      method: outcome === 'failure' ? 'none' : cod ? p.method : 'prepaid',
      collected: outcome === 'failure' ? 0 : cod ? p.collected : 0,
      cash: cod && p ? p.cash : 0, cardCharged: cod && p ? p.cardCharged : 0,
      fee: cod && p ? p.fee : 0, feeLabel: cod && p ? p.feeLabel : null, change: cod && p ? p.change : 0,
      reason: outcome === 'failure' ? reason : null, email: base.name
    };
    window.M.recordSale(sale);
    window.M.clearCart();
    setDone(sale);
  };

  // ── DONE ──
  if (done) {
    const s = done;
    const failed = s.outcome === 'failure';
    const es = window.MD.etaStatus(s.slack);
    const avg = window.MD.SHIFT.avgDwellSec;
    const diff = (s.dwellSec || avg) - avg;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
        <window.MTopBar title={failed ? 'Order closed' : 'Delivered'} onBack={() => {window.M.popAll();window.M.go('home');}} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <span style={{ width: 66, height: 66, borderRadius: 99, background: failed ? P.badSoft : P.goodSoft, color: failed ? P.bad : P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={failed ? 'x' : 'check'} size={34} stroke={2.4} /></span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 21, fontWeight: 800, color: P.ink }}>{failed ? 'Marked unable to complete' : `Delivered to ${s.name.split(' ')[0]}`}</div>
              <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 4, fontFamily: P.fontMono }}>{s.order} · {s.name}{failed && s.reason ? ` · ${PROBLEM_REASONS.find((r) => r.id === s.reason)?.label || ''}` : ''}</div>
            </div>
            {s.change > 0 && <div style={{ padding: '9px 18px', background: P.goodSoft, borderRadius: P.r12, fontSize: 16, fontWeight: 800, color: P.good, fontFamily: P.fontMono }}>Change due {_mm(s.change)}</div>}
          </div>

          {!failed && <>
            <Eyebrow style={{ marginBottom: 10 }}>This stop</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
              <Metric icon={es.icon} tint={P[es.color]} label="Timing" value={es.label} sub={es.key === 'late' ? 'behind' : 'on target'} />
              <Metric icon="clock" tint={P.info} label="Time with customer" value={_dwell(s.dwellSec || avg)} sub={diff <= 0 ? `${_dwell(Math.abs(diff))} faster` : `${_dwell(diff)} slower`} />
              {s.addedCount > 0 ?
              <Metric icon="plus" tint={P.accent} label="You upsold at the door" value={`${s.addedCount} item${s.addedCount > 1 ? 's' : ''} added`} sub={`+${_mm(s.addedValue)}`} /> :
              <Metric icon="package" tint={P.neutral} label="Order" value={`${s.items} items delivered`} />}
            </div>
          </>}

          {s.method !== 'prepaid' && s.method !== 'none' && <>
            <Eyebrow style={{ marginBottom: 10 }}>Payment collected</Eyebrow>
            <Card style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: P.inkDim }}>Method</span><span style={{ color: P.ink, fontWeight: 600, textTransform: 'capitalize' }}>{s.method}{s.feeLabel ? ` · ${s.feeLabel}` : ''}</span></div>
                {s.cash > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: P.inkDim }}>Cash</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{_mm(s.cash)}</span></div>}
                {s.cardCharged > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: P.inkDim }}>Card charged</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{_mm(s.cardCharged)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, paddingTop: 7, borderTop: `2px solid ${P.ink}` }}><span style={{ color: P.ink }}>Collected</span><span style={{ color: P.ink, fontFamily: P.fontMono }}>{_mm(s.collected)}</span></div>
                {s.cash > 0 && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>Reminder: keep any cash tip separate — <button onClick={() => window.M.openSheet('addtip', { name: s.name, order: s.order })} style={{ background: 'none', border: 'none', color: P.info, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11.5 }}>log a tip</button></div>}
              </div>
            </Card>
          </>}

          {!failed && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', background: P.goodSoft, borderRadius: P.r14 }}>
            <Icon name="check-circle" size={19} stroke={2} color={P.good} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: P.mode === 'dark' ? P.good : '#1B5E20' }}>Receipt emailed to the customer automatically</span>
          </div>}
        </div>
        <div style={{ padding: '14px 16px 34px', borderTop: `1px solid ${P.hairline}` }}>
          <PBtn variant="accent" size="xl" full icon="route" onClick={() => {window.M.popAll();window.M.go('home');}}>Next stop</PBtn>
        </div>
      </div>);
  }

  // ── CLOSE-OUT FORM ──
  const v = window.MD.VISIT[base.visit];
  const alreadyVerified = base.verified;
  const canCollect = idChecked || base.verified;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title="Close out order" sub={base.order} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 130px' }}>
        {/* customer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
          <Avatar name={base.name} size={50} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 21, fontWeight: 800, color: P.ink }}>{base.name}</span>
              {v && v.short && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px 2px 7px', borderRadius: 99, background: v.color + (P.mode === 'dark' ? '26' : '1f'), color: v.color, fontSize: 11.5, fontWeight: 800 }}><Icon name={v.icon} size={11} stroke={2.2} />{v.short}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2 }}>{base.addr}, {base.city} {base.zip || ''}</div>
          </div>
        </div>

        {/* prominent new / VIP banner */}
        {v && v.short && <div style={{ marginBottom: 16 }}><window.VisitBanner visit={base.visit} /></div>}

        {/* ID — verified on file (compact) OR capture for first-time guests */}
        {alreadyVerified ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', background: P.goodSoft, border: `1px solid ${P.good}`, borderRadius: P.r16, marginBottom: 16 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="check" size={20} stroke={2.2} /></span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>ID on file · 21+ verified</div><div style={{ fontSize: 12.5, color: P.mode === 'dark' ? P.good : '#1B5E20', marginTop: 1, fontWeight: 600 }}>Confirmed on a previous visit</div></div>
          </div>
        ) : (
          <button onClick={() => idChecked ? null : setShowIdCam(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', background: idChecked ? P.goodSoft : P.surface, border: `1.5px solid ${idChecked ? P.good : P.warn}`, borderRadius: P.r16, cursor: 'pointer', marginBottom: 16 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: idChecked ? P.good : P.warnSoft, color: idChecked ? '#fff' : P.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={idChecked ? 'check' : 'camera'} size={21} stroke={2.1} /></span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{idChecked ? 'ID captured · 21+ verified' : 'Scan customer ID · 21+'}</div>
              <div style={{ fontSize: 12.5, color: idChecked ? (P.mode === 'dark' ? P.good : '#1B5E20') : P.warn, marginTop: 2, fontWeight: 600 }}>{idChecked ? 'Saved to their profile' : 'First-time guest — photo required'}</div>
            </div>
            {!idChecked && <Icon name="chevron-right" size={18} stroke={2} color={P.inkFaint} />}
          </button>
        )}

        {/* payment (COD) — tender pre-set from order, inline */}
        {cod && <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Eyebrow>Collect payment</Eyebrow><div style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>marked {base.tender} at checkout</span>
          </div>
          {pay ?
          <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: P.goodSoft, color: P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check-circle" size={21} stroke={2} /></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink, textTransform: 'capitalize' }}>{pay.method} · {_mm(pay.collected)}</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{pay.change > 0 ? `Change ${_mm(pay.change)}` : 'Collected'}{pay.feeLabel ? ` · fee ${pay.feeLabel}` : ''}</div></div>
                <button onClick={() => setPay(null)} style={{ padding: '8px 13px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Redo</button>
              </div>
            </Card> :
          <>
            {/* the tender buttons live right here (one tap → entry) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12, opacity: canCollect ? 1 : 0.5, pointerEvents: canCollect ? 'auto' : 'none' }}>
              {[['cash', 'Cash', 'cash'], ['card', 'Card', 'card'], ['split', 'Split', 'split']].map(([m, l, ic]) => {
                const expected = base.tender === m;
                return (
                  <button key={m} onClick={() => {setPayMethod(m);setShowPay(true);}} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 6px', background: expected ? P.accentSoft : P.surface, border: `1.5px solid ${expected ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, cursor: 'pointer' }}>
                    {expected && <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: P.accentText }}>EXPECTED</span>}
                    <span style={{ width: 42, height: 42, borderRadius: 11, background: expected ? P.accent : P.surface3, color: expected ? P.accentInk : P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={22} stroke={1.7} /></span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{l}</span>
                  </button>);
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '2px 4px' }}>
              <span style={{ fontSize: 12.5, color: P.inkDim, fontWeight: 600 }}>Amount to collect</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{_mm(totals.total)}</span>
            </div>
          </>}
        </div>}

        {/* items + edit */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Eyebrow>Order · {totals.count} items</Eyebrow><div style={{ flex: 1 }} />
          <button onClick={() => {window.M.startCart(taskId, items);window.M.push('shop', { taskId });}} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="plus" size={13} stroke={2.2} />Add / edit</button>
        </div>
        {addedCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: P.accentSoft, borderRadius: P.r10, marginBottom: 16 }}><Icon name="sparkle" size={15} stroke={2} color={P.accentText} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.accentText }}>You added {addedCount} item{addedCount > 1 ? 's' : ''} · +{_mm(addedValue)}</span></div>}

        {/* talking points / reminders — dynamic to guest */}
        <Eyebrow style={{ marginBottom: 8 }}>Before you go</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
          {(() => {
            const list = [...ann];
            if (base.visit === 'vip') list.unshift({ id: 'vip', label: 'VIP — top-tier service; offer stickers/swag', on: false, hot: true });
            if (base.visit === 'first') list.unshift({ id: 'new', label: 'New guest — explain the rewards program', on: false, hot: true });
            return list.map((a, i) =>
            <div key={a.id} onClick={() => a.id === 'vip' || a.id === 'new' ? null : setAnn((arr) => arr.map((x) => x.id === a.id ? { ...x, on: !x.on } : x))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: a.hot ? P.accentSoft : P.surface, border: `1px solid ${a.hot ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: a.hot ? P.accent : P.surface3, color: a.hot ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={a.hot ? 'star' : 'megaphone'} size={15} stroke={2} /></span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{a.label}</span>
                {!a.hot && <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${a.on ? P.ink : P.hairline3}`, background: a.on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{a.on && <Icon name="check" size={13} stroke={3} color={P.surface} />}</span>}
              </div>);
          })()}
        </div>

        {/* problem path (de-emphasised) */}
        {!problemOpen ?
        <button onClick={() => setProblemOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto', padding: '10px 14px', background: 'transparent', border: 'none', color: P.inkDim, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="flag" size={15} stroke={2} />Can't complete this order</button> :

        <div style={{ padding: '14px 15px', background: P.surface, border: `1px solid ${P.bad}`, borderRadius: P.r14 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.bad }}>What went wrong?</span><div style={{ flex: 1 }} /><button onClick={() => {setProblemOpen(false);setReason(null);}} style={{ background: 'none', border: 'none', color: P.inkMute, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>Cancel</button></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {PROBLEM_REASONS.map((r) => {const a = reason === r.id;return <button key={r.id} onClick={() => setReason(r.id)} style={{ padding: '9px 13px', borderRadius: 99, border: `1.5px solid ${a ? P.bad : P.hairline3}`, background: a ? P.badSoft : 'transparent', color: a ? P.bad : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{r.label}</button>;})}
            </div>
            <PBtn variant="danger" size="lg" full icon="flag" disabled={!reason} onClick={() => finish('failure')}>Mark unable to complete</PBtn>
          </div>
        }
      </div>

      {/* footer */}
      {!problemOpen && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
        {!canCollect && <div style={{ fontSize: 11.5, color: P.warn, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Scan the customer's ID to continue</div>}
        {cod ?
        <PBtn variant="accent" size="xl" full icon="check" disabled={!canCollect || !pay} onClick={() => finish('success')}>{pay ? 'Complete delivery' : `Collect ${_mm(totals.total)} to finish`}</PBtn> :
        <PBtn variant="accent" size="xl" full icon="check" disabled={!canCollect} onClick={() => finish('success')}>Confirm delivered</PBtn>}
      </div>}

      {showIdCam && <window.IDCapture name={base.name} onCancel={() => setShowIdCam(false)} onCaptured={() => { setIdChecked(true); setShowIdCam(false); window.M.flash('ID captured & saved to profile'); }} />}

      {showPay && <window.MobilePayment total={totals.total} customer={base.name} startMethod={payMethod} onCancel={() => setShowPay(false)} onDone={(sale) => {setPay(sale);setShowPay(false);window.M.flash('Payment collected');}} />}
    </div>);
};