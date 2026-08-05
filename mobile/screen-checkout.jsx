// ── Mobile checkout — tender flow + card terminal (folded into Complete) ────
const useP = window.useP;
const _c2 = (n) => Math.round(n * 100) / 100;
const _m = (n) => window.HW.fmt.money(n);

const M_FEE = [
{ id: 'flat6', label: '6% flat', rate: 0.06, flat: 0, note: '6% of card' },
{ id: 'p550', label: '5% + $0.50', rate: 0.05, flat: 0.50, note: '5% + $0.50' }];

const mFee = (base, o) => !o || base <= 0 ? 0 : _c2(base * o.rate + o.flat);

function padPush(s, k) {
  if (k === 'del') return s.slice(0, -1);
  if (k === '.' && s.includes('.')) return s;
  if (k === '.' && s === '') return '0.';
  if (s.includes('.') && s.split('.')[1].length >= 2) return s;
  return s + k;
}
function Keypad({ onPress }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) =>
      <button key={k} data-pad={k} onClick={() => onPress(k)} style={{ padding: '11px 0', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, fontSize: 21, fontWeight: 600, color: k === 'del' ? P.bad : P.ink, cursor: 'pointer', fontFamily: P.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k === 'del' ? <Icon name="x" size={18} stroke={2.2} /> : k}</button>
      )}
    </div>);

}
function FeePick({ base, value, onChange }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {M_FEE.map((o) => {const a = value === o.id,f = mFee(base, o);return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ textAlign: 'left', padding: '12px 14px', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${a ? P.accent : P.hairline3}`, background: a ? P.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a && <Icon name="check" size={9} stroke={3.4} color={P.accentInk} />}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{o.label}</span></div>
          <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 8 }}>Fee +{_m(f)}</div>
          <div style={{ fontSize: 12.5, color: P.ink2, fontFamily: P.fontMono, marginTop: 2 }}>Charge {_m(_c2(base + f))}</div>
        </button>);})}
    </div>);

}

// Card terminal — device identity + status + handshake
window.MTerminal = function MTerminal({ amount, feeLabel, onApproved, onDeclined, onCancel, onSwitchCash, onEditSplit, canSplit }) {
  const P = useP();
  const [phase, setPhase] = React.useState('connecting');
  const timers = React.useRef([]);
  const clr = () => {timers.current.forEach(clearTimeout);timers.current = [];};
  React.useEffect(() => {
    if (phase === 'connecting') timers.current.push(setTimeout(() => setPhase('waiting'), 1300));
    if (phase === 'processing') timers.current.push(setTimeout(() => setPhase('approved'), 1400));
    if (phase === 'approved') timers.current.push(setTimeout(() => onApproved && onApproved(), 950));
    return clr;
  }, [phase]);
  const steps = [['connecting', 'Connect'], ['waiting', 'Reader'], ['processing', 'Auth'], ['approved', 'Done']];
  const ai = { connecting: 0, waiting: 1, processing: 2, approved: 3, declined: 1 }[phase];
  const online = phase !== 'connecting';
  const slabel = phase === 'connecting' ? 'Connecting…' : phase === 'processing' ? 'Busy' : 'Ready';
  const label = { connecting: 'Connecting to reader…', waiting: 'Follow the prompts on the card reader', processing: 'Authorizing payment…', approved: 'Approved — thank you', declined: 'Card declined' }[phase];
  return (
    <div style={{ padding: '4px 4px 8px' }}>
      {/* device */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, marginBottom: 18 }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: P.ink, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="card" size={16} stroke={1.9} /></span>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>LeisurePay Mobile</div><div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>LP-A7F4-2291 · v2.4</div></div>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: 99 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: online ? P.good : P.warn }} /><span style={{ fontSize: 11.5, fontWeight: 700, color: online ? P.ink2 : P.warn, fontFamily: P.fontMono }}>{slabel}</span></span>
      </div>
      {/* steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 22 }}>
        {steps.map((s, i) => {const done = i < ai || phase === 'approved',cur = i === ai && phase !== 'declined';return (
            <React.Fragment key={s[0]}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 18, height: 18, borderRadius: 99, background: done ? P.good : cur ? P.ink : P.surface3, color: done || cur ? '#fff' : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: P.fontMono }}>{done ? <Icon name="check" size={10} stroke={3} color="#fff" /> : i + 1}</span><span style={{ fontSize: 10, fontWeight: cur ? 700 : 600, color: cur ? P.ink : done ? P.ink2 : P.inkMute }}>{s[1]}</span></div>
            {i < 3 && <span style={{ width: 12, height: 1, background: P.hairline2 }} />}
          </React.Fragment>);})}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ width: 62, height: 62, borderRadius: 99, background: phase === 'approved' ? P.goodSoft : phase === 'declined' ? P.badSoft : P.surface3, color: phase === 'approved' ? P.good : phase === 'declined' ? P.bad : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: phase === 'connecting' || phase === 'processing' ? 'hwspin 1.1s linear infinite' : 'none' }}><Icon name={phase === 'approved' ? 'check' : phase === 'declined' ? 'x' : phase === 'waiting' ? 'card' : 'refresh'} size={30} stroke={2.4} /></span>
        <div style={{ fontSize: 15, fontWeight: 700, color: phase === 'declined' ? P.bad : P.ink, marginTop: 14, textAlign: 'center' }}>{label}</div>
        <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 4, fontFamily: P.fontMono }}>{feeLabel} · {_m(amount)}</div>
      </div>
      {phase === 'waiting' && <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: 10, color: P.inkMute, textAlign: 'center', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Waiting for reader · demo</div>
        <div style={{ display: 'flex', gap: 9 }}><PBtn variant="accent" size="lg" full icon="check" onClick={() => setPhase('processing')}>Approve</PBtn><PBtn variant="danger" size="lg" full icon="x" onClick={() => setPhase('declined')}>Decline</PBtn></div>
        <PBtn variant="ghost" size="sm" full onClick={onCancel}>Cancel payment</PBtn>
      </div>}
      {phase === 'connecting' && <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}><PBtn variant="ghost" size="sm" onClick={onCancel}>Cancel</PBtn></div>}
      {phase === 'declined' && <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <PBtn variant="accent" size="lg" full icon="refresh" onClick={() => setPhase('connecting')}>Retry on terminal</PBtn>
        <div style={{ display: 'flex', gap: 9 }}><PBtn variant="secondary" size="lg" full icon="cash" onClick={onSwitchCash}>Switch to cash</PBtn>{canSplit && <PBtn variant="secondary" size="lg" full icon="split" onClick={onEditSplit}>Edit split</PBtn>}</div>
        <PBtn variant="ghost" size="sm" full onClick={onCancel}>Cancel payment</PBtn>
      </div>}
    </div>);

};

// Full payment flow overlay. onDone(sale) fires when collected.
window.MobilePayment = function MobilePayment({ total, customer, startMethod, onDone, onCancel }) {
  const P = useP();
  const [method, setMethod] = React.useState(startMethod || null); // cash | card | split
  const [cash, setCash] = React.useState('');
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [stage, setStage] = React.useState('choose'); // choose | entry | terminal
  const opt = M_FEE.find((o) => o.id === feeOpt);
  const cashNum = parseFloat(cash) || 0;
  const cardBase = method === 'card' ? total : method === 'split' ? Math.max(0, _c2(total - cashNum)) : 0;
  const fee = mFee(cardBase, opt);
  const cardCharged = _c2(cardBase + fee);
  const change = method === 'cash' ? _c2(cashNum - total) : 0;
  const pad = (k) => setCash((s) => padPush(s, k));

  const finalize = () => {
    const sale = {
      method, total, at: Date.now(),
      cash: method === 'cash' ? total : method === 'split' ? cashNum : 0,
      cardBase, cardCharged: method === 'cash' ? 0 : cardCharged, fee, feeLabel: method === 'cash' ? null : opt.label,
      collected: _c2((method === 'cash' ? total : cashNum) + (method === 'cash' ? 0 : cardCharged)),
      change: Math.max(0, change)
    };
    if (method === 'cash' || method === 'split') window.M.flash('Cash collected — remember to log any tip separately', 'good');
    onDone && onDone(sale);
  };
  const primary = () => {if (method === 'cash') finalize();else setStage('terminal');};
  const canPrimary = method === 'card' ? true : method === 'cash' ? cashNum >= total : cashNum > 0 && cashNum < total;
  const methods = [['cash', 'Cash', 'cash', 'No fee'], ['card', 'Card', 'card', '+ processing fee'], ['split', 'Split', 'split', 'Cash first, then card']];

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 140, background: P.bg, display: 'flex', flexDirection: 'column', animation: 'fade .18s ease' }}>
      <window.MTopBar title="Take payment" sub={customer} onBack={() => stage === 'choose' ? onCancel() : setStage('choose')} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 12px' }}>
        {/* balance banner */}
        <div style={{ padding: '10px 16px', background: P.rail, borderRadius: P.r14, marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>Balance due</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: P.accent, fontFamily: P.fontMono }}>{_m(total)}</div>
        </div>

        {stage === 'terminal' ?
        <window.MTerminal amount={cardCharged} feeLabel={opt.label} canSplit={method === 'split'} onApproved={finalize} onCancel={() => setStage('choose')} onSwitchCash={() => {setMethod('cash');setCash('');setStage('choose');}} onEditSplit={() => setStage('choose')} /> :
        <>
            {/* Compact tender switch — pre-set from the order, changeable if the customer changed their mind */}
            <div style={{ marginBottom: 10 }}>
              <Seg full value={method || 'cash'} onChange={(v) => {setMethod(v);if (v !== 'split') setCash('');}} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'split', label: 'Split' }]} />
            </div>

            {method === 'cash' && <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r12, padding: '8px 12px' }}><div style={{ fontSize: 10, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Tendered</div><div style={{ textAlign: 'right', fontSize: 21, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>${cash === '' ? '0.00' : cash}</div></div>
                <div style={{ flex: 1, background: change >= 0 ? P.goodSoft : P.badSoft, borderRadius: P.r12, padding: '8px 12px' }}><div style={{ fontSize: 10, color: change >= 0 ? P.good : P.bad, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>{change >= 0 ? 'Change' : 'Owed'}</div><div style={{ textAlign: 'right', fontSize: 21, fontWeight: 700, color: change >= 0 ? P.good : P.bad, fontFamily: P.fontMono }}>{_m(Math.abs(change))}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>{[Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20].filter((v, i, a) => a.indexOf(v) === i).map((v) => <button key={v} onClick={() => setCash(v.toFixed(2))} style={{ flex: 1, padding: '9px 4px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 13.5, fontWeight: 700, color: P.info, cursor: 'pointer', fontFamily: P.fontMono }}>{_m(v)}</button>)}</div>
              <Keypad onPress={pad} />
              <button onClick={() => window.M.openSheet('makechange', {})} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '8px auto 0', padding: '4px 12px', background: 'transparent', border: 'none', color: P.info, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="cash" size={14} stroke={2} />Break a bill · make change</button>
            </>}

            {method === 'card' && <>
              <div style={{ padding: '12px 15px', background: P.surface2, borderRadius: P.r12, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Card base</span><span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{_m(total)}</span></div>
              <Eyebrow style={{ marginBottom: 8 }}>Processing fee — choose structure</Eyebrow>
              <FeePick base={total} value={feeOpt} onChange={setFeeOpt} />
            </>}

            {method === 'split' && <>
              <Eyebrow style={{ marginBottom: 8 }}>Cash portion (entered first)</Eyebrow>
              <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r12, padding: '12px 16px', textAlign: 'right', fontSize: 30, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 12 }}>${cash === '' ? '0.00' : cash}</div>
              <Keypad onPress={pad} />
              <div style={{ padding: '12px 15px', background: P.infoSoft, borderRadius: P.r12, margin: '14px 0', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.info }}>Card gets the rest</span><span style={{ fontSize: 15, fontWeight: 700, color: P.info, fontFamily: P.fontMono }}>{_m(cardBase)}</span></div>
              <Eyebrow style={{ marginBottom: 8 }}>Fee on {_m(cardBase)}</Eyebrow>
              <FeePick base={cardBase} value={feeOpt} onChange={setFeeOpt} />
            </>}
          </>}
      </div>

      {stage !== 'terminal' && method &&
      <div style={{ padding: '14px 16px 34px', borderTop: `1px solid ${P.hairline}`, background: P.bg }}>
          <PBtn variant="accent" size="xl" full icon={method === 'cash' ? 'check' : 'card'} disabled={!canPrimary} onClick={primary}>{method === 'cash' ? `Collect ${_m(total)}` : `Charge card ${_m(cardCharged)}`}</PBtn>
        </div>
      }
    </div>);

};

Object.assign(window, { padPush });