// ── Payment flow (Flow 4) — method tiles → drawer, card-terminal handshake,
//    cash-drawer pop, receipt reprint / email / print ───────────────────────
const useP = window.useP;
const _money = (n) => window.HW.fmt.money(n);
const _c2 = (n) => Math.round(n * 100) / 100;

// Merchant processing-fee structures applied to the CARD portion only
const FEE_OPTS = [
  { id: 'flat6', label: '6% flat',    rate: 0.06, flat: 0,    note: '6% of the card amount' },
  { id: 'p550',  label: '5% + $0.50', rate: 0.05, flat: 0.50, note: '5% of card + $0.50 fixed' },
];
const feeAmt = (base, opt) => (!opt || base <= 0) ? 0 : _c2(base * opt.rate + opt.flat);

// Points → CASH rewards only. Same fixed ladder the register's rewards card
// shows, plus the birthday $20 which is a perk and costs no points.
const CASH_REWARDS = [
  { id: 'r250', label: '$2.50 off', cost: 100, value: 2.5 },
  { id: 'r5',  label: '$5 off',  cost: 200,  value: 5 },
  { id: 'r10', label: '$10 off', cost: 400, value: 10 },
  { id: 'r20', label: '$20 off', cost: 800, value: 20 },
  { id: 'rbd', label: 'Birthday $20', cost: 0, value: 20, bday: true },
];

// keypad reducer
const padPush = (s, k) => {
  if (k === 'del') return s.slice(0, -1);
  if (k === '.' && s.includes('.')) return s;
  if (k === '.' && s === '') return '0.';
  if (s.includes('.') && s.split('.')[1].length >= 2) return s;
  return s + k;
};

function Pad({ onPress }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
      {['1','2','3','4','5','6','7','8','9','.','0','del'].map((k) => (
        <button key={k} onClick={() => onPress(k)} style={{ padding: '13px 0', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 16, fontWeight: 600, color: k === 'del' ? P.bad : P.ink, cursor: 'pointer', fontFamily: P.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 46 }}>{k === 'del' ? <Icon name="x" size={17} stroke={2.2} /> : k}</button>
      ))}
    </div>
  );
}

// Fee comparison — both structures shown side-by-side, radio-select
function FeeCompare({ base, value, onChange }) {
  const P = useP();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {FEE_OPTS.map((o) => {
        const a = value === o.id, f = feeAmt(base, o), tot = _c2(base + f);
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', textAlign: 'left', background: a ? P.surface3 : P.surface, border: `1.5px solid ${a ? P.ink : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', fontFamily: P.fontSans }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${a ? P.ink : P.hairline3}`, background: a ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{a && <Icon name="check" size={9} stroke={3.4} color={P.surface} />}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{o.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{o.note}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}><span style={{ fontSize: 10, color: P.inkDim, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Fee</span><span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>+{_money(f)}</span></div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, borderTop: `1px dashed ${P.hairline2}`, paddingTop: 6 }}>Card charged <b style={{ color: P.ink }}>{_money(tot)}</b></div>
          </button>
        );
      })}
    </div>
  );
}

function KV({ k, v, strong, sign, color }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}><span style={{ fontSize: strong ? 13 : 12, color: strong ? P.ink : P.inkDim, fontWeight: strong ? 700 : 500 }}>{k}</span><span style={{ fontSize: strong ? 16 : 12.5, fontWeight: strong ? 700 : 600, color: color || (strong ? P.ink : P.ink2), fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{sign || ''}{v}</span></div>;
}

// ── Card terminal handshake ────────────────────────────────────────────────
// We do NOT control the reader. The POS reflects its status and waits for the
// terminal to report success/decline. Demo controls stand in for the reader.
window.CardTerminal = function CardTerminal({ amount, feeLabel, onApproved, onDeclined, onCancel, onSwitchCash, onEditSplit, canEditSplit }) {
  const P = useP();
  const [phase, setPhase] = React.useState('connecting'); // connecting | waiting | processing | approved | declined
  const timers = React.useRef([]);
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  React.useEffect(() => {
    if (phase === 'connecting') timers.current.push(setTimeout(() => setPhase('waiting'), 1300));
    if (phase === 'processing') timers.current.push(setTimeout(() => setPhase('approved'), 1400));
    if (phase === 'approved') timers.current.push(setTimeout(() => onApproved && onApproved(), 900));
    return clearAll;
  }, [phase]);

  const steps = [['connecting', 'Connecting'], ['waiting', 'On reader'], ['processing', 'Processing'], ['approved', 'Approved']];
  const activeIdx = { connecting: 0, waiting: 1, processing: 2, approved: 3, declined: 1 }[phase];

  const StatusIcon = () => {
    if (phase === 'approved') return <span style={{ width: 60, height: 60, borderRadius: 99, background: P.goodSoft, color: P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={32} stroke={2.6} /></span>;
    if (phase === 'declined') return <span style={{ width: 60, height: 60, borderRadius: 99, background: P.badSoft, color: P.bad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={30} stroke={2.6} /></span>;
    return <span style={{ width: 60, height: 60, borderRadius: 99, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: phase !== 'approved' ? 'hwspin 1.1s linear infinite' : 'none' }}><Icon name={phase === 'waiting' ? 'card' : 'refresh'} size={26} stroke={1.9} /></span>;
  };
  const label = { connecting: 'Connecting to LeisurePay reader…', waiting: 'Follow the prompts on the card reader', processing: 'Authorizing payment…', approved: 'Approved — thank you', declined: 'Card declined' }[phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 6px' }}>
      {/* device identity + connection status */}
      {(() => {
        const online = phase !== 'connecting';
        const sdot = online ? P.good : P.warn;
        const slabel = phase === 'connecting' ? 'Connecting…' : phase === 'processing' ? 'Busy' : phase === 'approved' ? 'Ready' : phase === 'declined' ? 'Ready' : 'Ready';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'stretch', padding: '9px 13px', marginBottom: 18, background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="card" size={16} stroke={1.9} /></span>
            <div style={{ minWidth: 0, lineHeight: 1.25 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>LeisurePay Lane 03</div>
              <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>Device LP-A7F4-2291 · v2.4</div>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: 99 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: sdot }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: online ? P.ink2 : P.warn, fontFamily: P.fontMono, letterSpacing: '.04em' }}>{slabel}</span>
            </span>
          </div>
        );
      })()}
      {/* step rail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        {steps.map((s, i) => {
          const done = i < activeIdx || phase === 'approved' && i <= 3, cur = i === activeIdx && phase !== 'declined';
          return <React.Fragment key={s[0]}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: 99, background: done ? P.good : cur ? P.ink : P.surface3, color: done || cur ? '#fff' : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: P.fontMono, border: `1px solid ${done ? P.good : cur ? P.ink : P.hairline2}` }}>{done ? <Icon name="check" size={10} stroke={3} color="#fff" /> : i + 1}</span>
              <span style={{ fontSize: 11.5, fontWeight: cur ? 700 : 600, color: cur ? P.ink : done ? P.ink2 : P.inkMute, whiteSpace: 'nowrap' }}>{s[1]}</span>
            </div>
            {i < steps.length - 1 && <span style={{ width: 16, height: 1, background: P.hairline2 }} />}
          </React.Fragment>;
        })}
      </div>

      <StatusIcon />
      <div style={{ fontSize: 15, fontWeight: 700, color: phase === 'declined' ? P.bad : P.ink, marginTop: 14 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 4, fontFamily: P.fontMono }}>{feeLabel} · charging <b style={{ color: P.ink }}>{_money(amount)}</b></div>

      {/* Reader stand-in — since the physical reader is 3rd-party, these mimic
          what the terminal reports back to the POS. */}
      {phase === 'waiting' && (
        <div style={{ marginTop: 22, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 10, color: P.inkMute, textAlign: 'center', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Waiting for reader · demo</div>
          <div style={{ display: 'flex', gap: 9 }}>
            <PBtn variant="accent" size="lg" full icon="check" onClick={() => setPhase('processing')}>Simulate approval</PBtn>
            <PBtn variant="danger" size="lg" full icon="x" onClick={() => setPhase('declined')}>Simulate decline</PBtn>
          </div>
          <PBtn variant="ghost" size="sm" full onClick={onCancel}>Cancel payment</PBtn>
        </div>
      )}
      {phase === 'connecting' && <PBtn variant="ghost" size="sm" onClick={onCancel} style={{ marginTop: 22 }}>Cancel</PBtn>}

      {phase === 'declined' && (
        <div style={{ marginTop: 22, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PBtn variant="accent" size="lg" full icon="refresh" onClick={() => setPhase('connecting')}>Retry on terminal</PBtn>
          <div style={{ display: 'flex', gap: 9 }}>
            <PBtn variant="secondary" size="lg" full icon="cash" onClick={onSwitchCash}>Switch to cash</PBtn>
            {canEditSplit && <PBtn variant="secondary" size="lg" full icon="split" onClick={onEditSplit}>Edit split</PBtn>}
          </div>
          <PBtn variant="ghost" size="sm" full onClick={onCancel}>Cancel payment</PBtn>
        </div>
      )}
    </div>
  );
};

// ── Receipt actions — reprint + email vs print (shared) ────────────────────
window.ReceiptActions = function ReceiptActions({ sale, compact }) {
  const P = useP();
  const [emailing, setEmailing] = React.useState(false);
  const [addr, setAddr] = React.useState(sale?.email || '');
  const [toast, setToast] = React.useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <PBtn variant="secondary" size={compact ? 'sm' : 'md'} icon="printer" onClick={() => flash('Receipt sent to printer')}>Reprint</PBtn>
        <PBtn variant={emailing ? 'primary' : 'secondary'} size={compact ? 'sm' : 'md'} icon="receipt" onClick={() => setEmailing((o) => !o)}>Email</PBtn>
      </div>
      {emailing && (
        <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'center' }}>
          <div style={{ flex: 1 }}><Field icon="user" size="sm" placeholder="name@email.com" value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
          <PBtn variant="accent" size="sm" icon="arrow-right" disabled={!/.+@.+\..+/.test(addr)}
          title={/.+@.+\..+/.test(addr) ? `Email the receipt to ${addr}` : addr.trim() ? `“${addr.trim()}” is not a complete e-mail address` : 'Type the customer’s e-mail address first'}
          onClick={() => { flash('Receipt emailed to ' + addr); setEmailing(false); }}>Send</PBtn>
        </div>
      )}
      {sale?.email && !emailing && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 7 }}>On file: {sale.email}</div>}
      {toast && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 11.5, fontWeight: 600, color: P.good }}><Icon name="check-circle" size={13} stroke={2} />{toast}</div>}
    </div>
  );
};

// ── Main payment modal ─────────────────────────────────────────────────────
window.PaymentModal = function PaymentModal({ total, sub, tax, count, customer, onClose, onDone }) {
  const P = useP();
  const wallet0 = customer?.wallet || 0;
  const points = customer?.points || 0;

  const [reward, setReward] = React.useState(null);
  const [walletAmt, setWalletAmt] = React.useState(0);
  const [creditsOpen, setCreditsOpen] = React.useState(true);
  const [method, setMethod] = React.useState(null);   // cash | card | split
  const [cash, setCash] = React.useState('');
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [stage, setStage] = React.useState('choose'); // choose | terminal | done
  const [sale, setSale] = React.useState(null);

  const rw = CASH_REWARDS.find((r) => r.id === reward);
  const credits = _c2((rw ? rw.value : 0) + walletAmt);
  const balance = Math.max(0, _c2(total - credits));
  const cashNum = parseFloat(cash) || 0;
  const cardBase = method === 'card' ? balance : method === 'split' ? Math.max(0, _c2(balance - cashNum)) : 0;
  const opt = FEE_OPTS.find((o) => o.id === feeOpt);
  const fee = feeAmt(cardBase, opt);
  const cardCharged = _c2(cardBase + fee);
  const change = method === 'cash' ? _c2(cashNum - balance) : 0;
  const pad = (k) => setCash((s) => padPush(s, k));
  const closeDrawer = () => { setMethod(null); setCash(''); };

  // finalize: build the sale record, pop drawer if cash component, print
  const finalize = () => {
    const rec = {
      id: 'ORD-' + String(224 + Math.floor(Math.random() * 40)).padStart(5, '0'),
      at: Date.now(), method, total, collected: _c2((method === 'cash' ? balance : cashNum) + (method === 'cash' ? 0 : cardCharged)),
      cash: method === 'cash' ? balance : method === 'split' ? cashNum : 0,
      cardCharged: method === 'cash' ? 0 : cardCharged, cardBase, fee, feeLabel: method === 'cash' ? null : opt.label,
      credits, change: Math.max(0, change), email: customer?.email || '', name: customer?.name || 'Guest', items: count,
    };
    setSale(rec);
    window.POS.setLastSale(rec);
    if (method === 'cash' || method === 'split') window.POS.popDrawer(`Cash sale · ${rec.id}`);
    setStage('done');
  };

  // route the primary drawer action
  const drawerPrimary = () => {
    if (method === 'cash') { finalize(); return; }
    // card or split → card portion goes to the terminal
    setStage('terminal');
  };
  const canPrimary = method === 'card' ? true : method === 'cash' ? cashNum >= balance : method === 'split' ? (cashNum > 0 && cashNum < balance) : false;

  /* WHY THE TENDER BUTTON IS GREY, IN A SENTENCE.
   *
   * `canPrimary` above encodes three different refusals and the button said
   * none of them — it simply went flat. The split case is the one that strands
   * an operator mid-shift: type the FULL balance into the split pad and the
   * condition `cashNum < balance` fails, so the button dies with the number
   * that killed it sitting right there looking correct. There is nothing on
   * the screen to read, and the way out (go back and choose Cash) is not
   * guessable from anything shown.
   *
   * Same `title`-carries-the-reason pattern as the discount card in
   * pos/screen-cart.jsx and the address form in pos/customer-extras.jsx. */
  const primaryWhy =
  method === 'cash' ? (
    canPrimary ? `Take ${_money(balance)} in cash and complete the sale` :
    cashNum <= 0 ? `Enter the cash the customer handed over — ${_money(balance)} is due` :
    `Tendered ${_money(cashNum)} of ${_money(balance)} — ${_money(_c2(balance - cashNum))} still short`) :
  method === 'split' ? (
    canPrimary ? `Cash ${_money(cashNum)} taken, ${_money(cardCharged)} to the card` :
    cashNum <= 0 ? 'Enter the cash portion first — the card takes whatever is left' :
    `${_money(cashNum)} covers the whole ${_money(balance)} balance, so nothing is left for the card. Cancel and choose Cash instead.`) :
  `Send ${_money(cardCharged)} to the card terminal`;

  const methods = [['cash', 'Cash', 'cash', 'No fee'], ['card', 'Card', 'card', '+ processing fee'], ['split', 'Split', 'split', 'Cash first, then card']];

  return (
    <div style={window.overlayScrim(P, { z: 80, animate: true })} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(780px, 96vw)', maxHeight: 'calc(100vh - 80px)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden', border: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 20px', borderBottom: `1px solid ${P.hairline2}`, flex: '0 0 auto' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="receipt" size={16} stroke={1.9} /></span>
          <div><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, lineHeight: 1.1 }}>Take payment</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.04em' }}>{count} items · {customer?.name || 'Guest'}</div></div>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" size={17} onClick={onClose} />
        </div>

        {/* ── DONE — success + receipt actions ── */}
        {stage === 'done' && sale && (
          <div style={{ padding: '26px 26px 24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ width: 62, height: 62, borderRadius: 99, background: P.goodSoft, color: P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={32} stroke={2.4} /></span>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 21, fontWeight: 700, color: P.ink }}>Payment complete</div><div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 3, fontFamily: P.fontMono }}>{sale.id} · receipt printed{(sale.method !== 'card') ? ' · drawer opened' : ''}</div></div>
              {sale.change > 0 && <div style={{ padding: '9px 18px', background: P.goodSoft, borderRadius: P.r12, fontSize: 15, fontWeight: 700, color: P.good, fontFamily: P.fontMono }}>Change due {_money(sale.change)}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Eyebrow style={{ marginBottom: 2 }}>Tender</Eyebrow>
                <KV k="Order total" v={_money(sale.total)} />
                {sale.credits > 0 && <KV k="Credits" v={_money(sale.credits)} sign="− " color={P.good} />}
                {sale.cash > 0 && <KV k="Cash" v={_money(sale.cash)} />}
                {sale.cardCharged > 0 && <><KV k="Card base" v={_money(sale.cardBase)} /><KV k={`Fee · ${sale.feeLabel}`} v={_money(sale.fee)} sign="+ " color={P.warn} /><KV k="Card charged" v={_money(sale.cardCharged)} /></>}
                <div style={{ borderTop: `2px solid ${P.ink}`, paddingTop: 8, marginTop: 2 }}><KV k="Collected" v={_money(sale.collected)} strong /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Eyebrow style={{ marginBottom: 10 }}>Receipt</Eyebrow>
                <window.ReceiptActions sale={sale} />
                <div style={{ flex: 1 }} />
                <PBtn variant="accent" size="lg" icon="check" full onClick={() => { onDone && onDone(sale); }} style={{ marginTop: 16 }}>Done · new sale</PBtn>
              </div>
            </div>
          </div>
        )}

        {/* ── TERMINAL — card handshake ── */}
        {stage === 'terminal' && (
          <div style={{ padding: '22px 26px 26px', overflowY: 'auto' }}>
            <window.CardTerminal amount={cardCharged} feeLabel={opt.label} canEditSplit={method === 'split'}
              onApproved={finalize}
              onCancel={() => setStage('choose')}
              onSwitchCash={() => { setMethod('cash'); setCash(''); setStage('choose'); }}
              onEditSplit={() => setStage('choose')} />
          </div>
        )}

        {/* ── CHOOSE — credits + method tiles + drawer ── */}
        {stage === 'choose' && (
          <div style={{ padding: '18px 22px 22px', overflowY: 'auto', position: 'relative' }}>
            {/* balance banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: P.ink, borderRadius: P.r16, color: '#fff', marginBottom: 14 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>Balance due</div><div style={{ fontSize: 30, fontWeight: 700, fontFamily: P.fontMono, color: P.accent, letterSpacing: '-.01em' }}>{_money(balance)}</div></div>
              <div style={{ textAlign: 'right', fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono, lineHeight: 1.7 }}>Total {_money(total)}<br />{credits > 0 ? `Credits − ${_money(credits)}` : 'No credits applied'}</div>
            </div>

            {/* credits collapsible */}
            <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, background: P.surface, marginBottom: 16, overflow: 'hidden' }}>
              <button onClick={() => setCreditsOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>
                <Icon name="gift" size={17} color={P.ink2} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Apply credits</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{points.toLocaleString()} pts · {_money(wallet0)} wallet</span>
                <div style={{ flex: 1 }} /><Icon name="chevron-down" size={16} stroke={2.2} color={P.inkDim} style={{ transform: creditsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {creditsOpen && <div style={{ padding: '0 16px 15px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Eyebrow style={{ marginBottom: 8 }}>Redeem points · cash off</Eyebrow>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{CASH_REWARDS.map((r) => { const a = reward === r.id, can = r.bday || points >= r.cost; return <button key={r.id} disabled={!can} onClick={() => setReward(a ? null : r.id)} style={{ padding: '10px 16px', background: a ? P.ink : P.surface2, border: `1.5px solid ${a ? P.ink : P.hairline2}`, borderRadius: P.r10, fontSize: 13.5, fontWeight: 700, color: a ? P.surface : P.ink, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .5, fontFamily: P.fontSans }}>{r.label}<span style={{ fontSize: 10, color: a ? P.surface : P.inkMute, fontFamily: P.fontMono, marginLeft: 6 }}>{r.bday ? 'perk' : r.cost + 'p'}</span></button>; })}</div>
                </div>
                <div>
                  <Eyebrow style={{ marginBottom: 8 }}>Wallet credit</Eyebrow>
                  {wallet0 > 0 ? <div style={{ display: 'flex', gap: 8 }}>{[0, 5, 10, wallet0].filter((v, i, a) => a.indexOf(v) === i && v <= wallet0).map((v) => { const a = walletAmt === v; return <button key={v} onClick={() => setWalletAmt(v)} style={{ flex: 1, padding: '11px 8px', background: a ? P.ink : P.surface2, border: `1.5px solid ${a ? P.ink : P.hairline2}`, borderRadius: P.r10, fontSize: 13.5, fontWeight: 700, color: a ? P.surface : P.ink, cursor: 'pointer', fontFamily: P.fontMono }}>{v === 0 ? 'None' : v === wallet0 ? `Max ${_money(v)}` : _money(v)}</button>; })}</div>
                    : <div style={{ fontSize: 11.5, color: P.inkMute }}>No wallet balance on file.</div>}
                </div>
              </div>}
            </div>

            {/* method tiles */}
            <Eyebrow style={{ marginBottom: 10 }}>Choose tender</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {methods.map(([v, l, ic, d]) => (
                <button key={v} onClick={() => { setMethod(v); if (v !== 'split') setCash(''); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '22px 12px', background: P.surface, border: `1.5px solid ${P.hairline2}`, borderRadius: P.r16, cursor: 'pointer', fontFamily: P.fontSans }}>
                  <span style={{ width: 52, height: 52, borderRadius: 14, background: P.surface3, color: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={26} stroke={1.7} /></span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{l}</span>
                  <span style={{ fontSize: 11.5, color: P.inkDim, textAlign: 'center' }}>{d}</span>
                </button>
              ))}
            </div>

            {/* drawer */}
            {method && <>
              <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, background: P.scrim, animation: 'fade .15s ease', zIndex: 5 }} />
              <div style={{ position: 'absolute', inset: 0, zIndex: 6, background: P.surface, display: 'flex', flexDirection: 'column', boxShadow: P.shadowLg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px 12px', flex: '0 0 auto' }}>
                  <Icon name={method === 'cash' ? 'cash' : method === 'card' ? 'card' : 'split'} size={19} color={P.ink} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{method === 'cash' ? 'Cash payment' : method === 'card' ? 'Card payment' : 'Split — cash first'}</span>
                  <div style={{ flex: 1 }} /><IconBtn icon="x" size={17} onClick={closeDrawer} />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px 4px' }}>
                {method === 'split' && <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: '0 0 250px' }}>
                    <Eyebrow style={{ marginBottom: 8 }}>Cash portion (entered first)</Eyebrow>
                    <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, padding: '12px 14px', textAlign: 'right', fontSize: 30, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 10 }}>${cash === '' ? '0.00' : cash}</div>
                    <Pad onPress={pad} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ padding: '12px 15px', background: P.infoSoft, borderRadius: P.r12, marginBottom: 12 }}><KV k="Card gets the rest" v={_money(cardBase)} strong color={P.info} /></div>
                    <Eyebrow style={{ marginBottom: 8 }}>Processing fee on {_money(cardBase)}</Eyebrow>
                    <FeeCompare base={cardBase} value={feeOpt} onChange={setFeeOpt} />
                  </div>
                </div>}

                {method === 'card' && <div>
                  <div style={{ padding: '12px 15px', background: P.surface2, borderRadius: P.r12, marginBottom: 14 }}><KV k="Card base" v={_money(balance)} strong /></div>
                  <Eyebrow style={{ marginBottom: 8 }}>Processing fee — choose structure</Eyebrow>
                  <FeeCompare base={balance} value={feeOpt} onChange={setFeeOpt} />
                </div>}

                {method === 'cash' && <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: '0 0 250px' }}>
                    <Eyebrow style={{ marginBottom: 8 }}>Cash tendered</Eyebrow>
                    <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, padding: '12px 14px', textAlign: 'right', fontSize: 30, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 10 }}>${cash === '' ? '0.00' : cash}</div>
                    <Pad onPress={pad} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Eyebrow style={{ marginBottom: 8 }}>Quick cash</Eyebrow>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{[Math.ceil(balance), Math.ceil(balance / 5) * 5, Math.ceil(balance / 10) * 10, Math.ceil(balance / 20) * 20].filter((v, i, a) => a.indexOf(v) === i).map((v) => <button key={v} onClick={() => setCash(v.toFixed(2))} style={{ padding: '11px 16px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 13.5, fontWeight: 700, color: P.info, cursor: 'pointer', fontFamily: P.fontMono }}>{_money(v)}</button>)}</div>
                    <div style={{ padding: '14px 16px', borderRadius: P.r12, background: change >= 0 ? P.goodSoft : P.badSoft }}><KV k={change >= 0 ? 'Change due' : 'Still owed'} v={_money(Math.abs(change))} strong color={change >= 0 ? P.good : P.bad} /></div>
                  </div>
                </div>}

                </div>

                <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${P.hairline2}`, flex: '0 0 auto', background: P.surface }}>
                  <PBtn variant="secondary" size="lg" onClick={closeDrawer}>Cancel</PBtn>
                  {/* The refusal, printed — not only in the tooltip. A POS is a
                      touch screen; hover text is not reachable there, so a grey
                      button with its reason only in `title` is still a dead end
                      for the person actually standing at the till. */}
                  {!canPrimary && <span style={{ flex: 1, minWidth: 0, alignSelf: 'center', fontSize: 11.5, color: P.inkDim, lineHeight: 1.4 }}>{primaryWhy}</span>}
                  <div style={{ flex: canPrimary ? 1 : '0 0 auto' }} />
                  {/* The `split` and `card` branches of this label were written
                      as two arms of a ternary and produced BYTE-IDENTICAL text
                      — a distinction presented in the source that never existed
                      on screen. Collapsed to the one string it always was. */}
                  <PBtn variant="accent" size="lg" icon={method === 'cash' ? 'check' : 'card'} disabled={!canPrimary} title={primaryWhy} onClick={drawerPrimary}>
                    {method === 'cash' ? `Complete · ${_money(balance)}` : `Charge card · ${_money(cardCharged)}`}
                  </PBtn>
                </div>
              </div>
            </>}
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, {});
