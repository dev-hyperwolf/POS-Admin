// ── Cash lifecycle: open a session → take cash → count → deposit → receipt ──
// Every terminal that touches cash has an explicit session. Stations open a
// drawer; drivers are issued a cash bag. Both close the same way: count →
// confirm destination → sealed receipt. Nothing "just closes".
const useP = window.useP;
const { regionName, regionColor, ROSTER } = window.TDATA;
const money = window.HW.fmt.money;

const DENOM_BILLS = [{ v: 100, l: '$100' }, { v: 50, l: '$50' }, { v: 20, l: '$20' }, { v: 10, l: '$10' }, { v: 5, l: '$5' }, { v: 1, l: '$1' }];
const DENOM_COINS = [{ v: 0.25, l: 'Quarters', u: '25¢' }, { v: 0.10, l: 'Dimes', u: '10¢' }, { v: 0.05, l: 'Nickels', u: '5¢' }, { v: 0.01, l: 'Pennies', u: '1¢' }];
const DENOM_ROLLS = [{ v: 10, l: 'Quarter roll', u: '$10' }, { v: 5, l: 'Dime roll', u: '$5' }, { v: 2, l: 'Nickel roll', u: '$2' }, { v: 0.50, l: 'Penny roll', u: '50¢' }];
const DENOM_ASC = [
  { k: 'c0.01', v: 0.01, l: 'pennies' }, { k: 'c0.05', v: 0.05, l: 'nickels' }, { k: 'c0.1', v: 0.10, l: 'dimes' }, { k: 'c0.25', v: 0.25, l: 'quarters' },
  { k: 'b1', v: 1, l: '$1' }, { k: 'b5', v: 5, l: '$5' }, { k: 'b10', v: 10, l: '$10' }, { k: 'b20', v: 20, l: '$20' }, { k: 'b50', v: 50, l: '$50' }, { k: 'b100', v: 100, l: '$100' }];

function keepBackPlan(q, target) {
  let remaining = target;const leave = [];
  for (const d of DENOM_ASC) {
    if (remaining < 0.005) break;
    const avail = parseInt(q[d.k] || '0', 10) || 0;
    if (!avail) continue;
    const take = Math.min(avail, Math.floor((remaining + 1e-9) / d.v));
    if (take > 0) { leave.push({ l: d.l, take, amt: +(take * d.v).toFixed(2) }); remaining = +(remaining - take * d.v).toFixed(2); }
  }
  return { leave, short: +remaining.toFixed(2) };
}

function DenomCounter({ q, set }) {
  const P = useP();
  const line = (k, v) => (parseInt(q[k] || '0', 10) || 0) * v;
  const Grp = ({ title, tint, arr, pfx }) =>
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: tint }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.ink2 }}>{title}</span>
      </div>
      <div style={{ padding: '6px 12px 10px' }}>
        {arr.map((d) => {const k = pfx + d.v;const st = line(k, d.v);const active = st > 0;return (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 74px', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2 }}>{d.l}{d.u && <span style={{ color: P.inkMute, fontWeight: 400, fontSize: 11.5 }}> · {d.u}</span>}</span>
              <input value={q[k] || ''} onChange={(e) => set(k, e.target.value)} placeholder="0" inputMode="numeric"
                style={{ width: '100%', padding: '7px 8px', textAlign: 'center', fontFamily: P.fontMono, fontWeight: 600, fontSize: 13.5, background: active ? P.accentSoft : P.field, border: `1px solid ${active ? P.accentBorder : P.fieldBorder}`, borderRadius: P.r8, color: P.ink, outline: 'none' }} />
              <span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: active ? 700 : 400, color: active ? P.ink : P.inkFaint, textAlign: 'right' }}>{money(st)}</span>
            </div>);})}
      </div>
    </div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Grp title="Bills" tint={P.hybrid} arr={DENOM_BILLS} pfx="b" />
      <div style={{ display: 'grid', gap: 12 }}>
        <Grp title="Loose coins" tint={P.info} arr={DENOM_COINS} pfx="c" />
        <Grp title="Coin rolls" tint={P.sativa} arr={DENOM_ROLLS} pfx="r" />
      </div>
    </div>);
}

const denomSum = (q) => [['b', DENOM_BILLS], ['c', DENOM_COINS], ['r', DENOM_ROLLS]]
  .reduce((s, [p, arr]) => s + arr.reduce((ss, d) => ss + (parseInt(q[p + d.v] || '0', 10) || 0) * d.v, 0), 0);

const nowTime = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const rid = (pfx) => pfx + '-' + (4000 + Math.floor(Math.random() * 5000));
const managers = () => ROSTER.filter((p) => p.role !== 'driver').map((p) => ({ value: p.name, label: p.name, sub: p.role === 'manager' ? 'Manager' : 'Cashier' }));

// Shared bits ───────────────────────────────────────────────────────────────
function StageBar({ steps, at }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '11px 22px', borderBottom: `1px solid ${P.hairline}`, background: P.surface2 }}>
      {steps.map((s, i) => {
        const done = i < at, on = i === at;
        return <React.Fragment key={s}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 20, height: 20, borderRadius: 99, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700,
              background: done ? P.good : on ? P.ink : P.surface3, color: done || on ? '#fff' : P.inkMute, border: done || on ? 'none' : `1px solid ${P.hairline2}` }}>
              {done ? <Icon name="check" size={12} stroke={3} color="#fff" /> : i + 1}</span>
            <span style={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? P.ink : done ? P.ink2 : P.inkMute, whiteSpace: 'nowrap' }}>{s}</span>
          </span>
          {i < steps.length - 1 && <span style={{ flex: 1, height: 1, background: i < at ? P.good : P.hairline2, margin: '0 10px', minWidth: 14 }} />}
        </React.Fragment>;})}
    </div>);
}
function Tile({ label, value, sub, bg, br, ink }) {
  const P = useP();
  return <div style={{ padding: '12px 14px', borderRadius: P.r12, background: bg || P.surface2, border: `1px solid ${br || P.hairline}` }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkDim, marginBottom: 5, lineHeight: 1.2 }}>{label}</div>
    <div style={{ fontSize: 21, fontWeight: 800, fontFamily: P.fontMono, color: ink || P.ink, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: P.inkMute, marginTop: 5 }}>{sub}</div>}
  </div>;
}
function KVRow({ k, v, mono, strong }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '8px 0', borderTop: `1px solid ${P.hairline}` }}>
    <span style={{ fontSize: 12.5, color: P.inkDim }}>{k}</span>
    <span style={{ fontSize: strong ? 14 : 12.5, fontWeight: strong ? 800 : 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, textAlign: 'right' }}>{v}</span>
  </div>;
}

// ── OPEN: start a drawer session / issue a cash bag ─────────────────────────
window.OpenDrawerModal = function OpenDrawerModal({ t, onClose, onOpened }) {
  const P = useP();
  const isDriver = t.kind !== 'station';
  const defFloat = isDriver ? t.bag.float : t.drawer.float;
  const [stage, setStage] = React.useState(0);
  const [who, setWho] = React.useState(isDriver ? t.name : t.employee || '');
  const [amt, setAmt] = React.useState(String(defFloat));
  const [q, setQ] = React.useState({});
  const [verify, setVerify] = React.useState(false);
  const [res, setRes] = React.useState(null);
  const counted = +denomSum(q).toFixed(2);
  const target = parseFloat(amt || '0') || 0;
  const diff = +(counted - target).toFixed(2);
  const ok = verify ? Math.abs(diff) < 0.005 : true;

  const open = () => {
    const r = { id: rid(isDriver ? 'BAG' : 'DRW'), at: nowTime(), who, float: target };
    setRes(r); setStage(2); onOpened && onOpened(r);
  };

  return (
    <Overlay onClose={onClose} width={620}>
      <ModalHead eyebrow={(isDriver ? 'Issue cash bag · ' : 'Open drawer · ') + t.name}
        title={stage === 2 ? (isDriver ? 'Cash bag issued' : 'Drawer open') : isDriver ? 'Issue a cash bag' : 'Open the drawer'} onClose={onClose} />
      <StageBar steps={[isDriver ? 'Who & cash' : 'Cashier & cash', 'Verify', 'Open']} at={stage} />
      <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
        {stage === 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={15} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.5 }}>
              {isDriver ? <>Normally the driver does this themselves — they tap <b>Start shift</b> in the Driver App at clock-on and the bag is issued against their region. Use this when you are handing them the bag over the counter.</> :
              <>Normally the cashier opens their own drawer when they sign in to the station. Use this to open one on their behalf.</>}
            </span>
          </div>
          <div><FLabel>{isDriver ? 'Driver taking the bag' : 'Cashier opening the drawer'}</FLabel>
            <TSelect icon="user" value={who} onChange={setWho} placeholder="Choose a person…"
              options={isDriver ? ROSTER.filter((p) => p.role === 'driver').map((p) => ({ value: p.name, label: p.name, sub: 'Driver' })) : managers()} /></div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <div style={{ width: 180 }}><FLabel hint={isDriver ? '— change they carry' : '— change to open with'}>Starting cash balance</FLabel>
              <Field mono value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" /></div>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 3 }}>
              {[isDriver ? 40 : 200, defFloat, isDriver ? 100 : 400].map((v, i) =>
                <PBtn key={i} size="sm" variant={String(v) === amt ? 'accent' : 'secondary'} onClick={() => setAmt(String(v))}>{money(v)}</PBtn>)}
            </div>
          </div>
          {isDriver && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
            <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: regionColor(t.region), padding: '4px 9px', borderRadius: P.r8 }}>{regionName(t.region)}</span>
            <span style={{ fontSize: 12.5, color: P.ink2 }}>The bag is issued against this region — the reader stays with the region either way.</span>
          </div>}
        </div>}

        {stage === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Check on={verify} onChange={setVerify} size={18} />
            <span style={{ fontSize: 13.5, color: P.ink2 }}>Count the starting cash balance by denomination before handing it over</span>
          </label>
          {verify ? <>
            <DenomCounter q={q} set={(k, v) => setQ((m) => ({ ...m, [k]: v.replace(/[^0-9]/g, '') }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Tile label="Counted" value={money(counted)} bg={P.surface} br={P.hairline2} />
              <Tile label={Math.abs(diff) < 0.005 ? 'Matches ✓' : diff < 0 ? 'Short of starting balance' : 'Over starting balance'} value={(diff > 0 ? '+' : '') + money(diff)}
                bg={Math.abs(diff) < 0.005 ? P.goodSoft : diff < 0 ? P.badSoft : P.warnSoft} br={(Math.abs(diff) < 0.005 ? P.good : diff < 0 ? P.bad : P.warn) + '44'}
                ink={Math.abs(diff) < 0.005 ? P.good : diff < 0 ? P.bad : P.warn} />
            </div>
          </> : <div style={{ padding: '14px 16px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
            Skipping the count means {money(target)} is recorded as issued on trust. Any discrepancy will surface at close-out as a variance against this starting balance.
          </div>}
          <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '4px 14px 10px' }}>
            <KVRow k={isDriver ? 'Driver' : 'Cashier'} v={who || '—'} />
            <KVRow k={isDriver ? 'Region' : 'Station'} v={isDriver ? regionName(t.region) : t.name} />
            <KVRow k="Starting cash balance" v={money(target)} mono strong />
          </div>
        </div>}

        {stage === 2 && res && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 99, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="check" size={22} stroke={3} color="#fff" /></span>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>{isDriver ? 'Bag issued to ' + who.split(' ')[0] : 'Drawer open for ' + who.split(' ')[0]}</div>
              <div style={{ fontSize: 12.5, color: P.ink2, marginTop: 2 }}>{money(res.float)} starting cash · session <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{res.id}</span> · {res.at}</div></div>
          </div>
          <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '4px 14px 10px' }}>
            <KVRow k="Session id" v={res.id} mono />
            <KVRow k="Opened at" v={res.at} mono />
            <KVRow k="Accountable" v={who} />
            <KVRow k="Starting cash balance" v={money(res.float)} mono />
            <KVRow k="Verified by count" v={verify ? 'Yes' : 'No — issued on trust'} />
          </div>
          <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.55 }}>
            {isDriver ? <>From here every cash sale adds to the bag. At end of shift the driver returns and you run <b>Deposit bag</b> from this terminal — count, seal, drop.</> :
            <>From here every cash sale adds to the drawer. At handoff or end of day you run <b>Close drawer</b> — count, reconcile the variance, deposit the rest.</>}
          </div>
        </div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {stage === 2 ? <span style={{ fontSize: 11.5, color: P.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={13} />Logged to the activity log</span> :
          <PBtn variant="ghost" icon={stage === 0 ? null : 'arrow-left'} onClick={stage === 0 ? onClose : () => setStage(stage - 1)}>{stage === 0 ? 'Cancel' : 'Back'}</PBtn>}
        {stage === 0 && <PBtn variant="accent" iconRight="arrow-right" disabled={!who || target <= 0} onClick={() => setStage(1)}>Continue</PBtn>}
        {stage === 1 && <PBtn variant="primary" icon="check" disabled={!ok} onClick={open}>{isDriver ? 'Issue bag' : 'Open drawer'}</PBtn>}
        {stage === 2 && <div style={{ display: 'flex', gap: 10 }}><PBtn variant="secondary" icon="printer">Print slip</PBtn><PBtn variant="primary" icon="check" onClick={onClose}>Done</PBtn></div>}
      </div>
    </Overlay>);
};

// Activity log for a terminal — base history plus anything done this session.
window.terminalEvents = function terminalEvents(t, sess) {
  const isDriver = t.kind !== 'station';
  const who = (isDriver ? t.employee || t.name : (t.drawer && t.drawer.cashier) || t.employee || 'Staff');
  const out = [];
  (sess && sess.deposits || []).forEach((d) => out.push({
    at: d.at, icon: 'lock', tone: 'good', t: (isDriver ? 'Deposit ' : 'Close-out ') + d.id + ' · ' + money(d.amount),
    d: 'Bag ' + d.bag + ' accepted by ' + d.acceptedBy + (Math.abs(d.variance) >= 0.005 ? ' · variance ' + (d.variance > 0 ? '+' : '') + money(d.variance) + (d.reason ? ' (' + d.reason + ')' : '') : ' · balanced') }));
  if (sess && sess.open && sess.id) out.push({
    at: sess.at, icon: 'wallet', tone: 'good', t: (isDriver ? 'Cash bag issued' : 'Drawer opened') + ' · ' + sess.id,
    d: money(sess.float) + ' starting cash to ' + (sess.who || who) });
  if (isDriver) {
    out.push({ at: '2:14 PM', icon: 'card', tone: 'neutral', t: 'Card sale · ' + money(t.bag.card || 0), d: 'On the region reader' + (t.reader ? ' · SN ' + t.reader.sn : '') });
    out.push({ at: '11:02 AM', icon: 'truck', tone: 'neutral', t: 'Clocked on · ' + regionName(t.region), d: (t.employee || t.name) + ' · ' + t.device.model });
  } else {
    out.push({ at: '1:48 PM', icon: 'card', tone: 'neutral', t: 'Reader heartbeat OK', d: t.reader ? t.reader.model + ' · SN ' + t.reader.sn : 'No reader assigned' });
    out.push({ at: '9:02 AM', icon: 'user-check', tone: 'neutral', t: 'Signed in · ' + who, d: t.device.model + ' · ' + t.device.tag });
  }
  out.push({ at: 'Yesterday', icon: 'lock', tone: 'neutral', t: isDriver ? 'Previous bag deposited' : 'Previous drawer closed', d: 'Balanced · no variance' });
  return out;
};
const DESTS = [
  { v: 'safe', label: 'Safe drop — store', sub: 'Sealed and dropped in the store safe', icon: 'vault' },
  { v: 'bank', label: 'Bank deposit — armored pickup', sub: 'Sealed for the next armored collection', icon: 'shield' },
  { v: 'hand', label: 'Manager hand-off', sub: 'Counted a second time and signed over', icon: 'handoff' }];

window.DrawerReconcile = function DrawerReconcile({ t, onClose, onDeposited }) {
  const P = useP();
  const isDriver = t.kind !== 'station';
  const startCash = isDriver ? t.bag.float : t.drawer.float;
  const cashSales = isDriver ? t.bag.collected : t.drawer.expected - t.drawer.float;
  const cardAmt = isDriver ? t.bag.card || 0 : t.drawer.cardSales || 0;
  const totalSales = +(cashSales + cardAmt).toFixed(2);
  const expected = +(startCash + cashSales).toFixed(2);
  const cashTxns = isDriver ? t.bag.cashTxns || 0 : t.drawer.cashCount || 0;
  const cardTxns = isDriver ? t.bag.cardTxns || 0 : t.drawer.cardCount || 0;
  const splitTxns = isDriver ? t.bag.splitTxns || 0 : t.drawer.splitCount || 0;
  const warrantyTxns = isDriver ? t.bag.warrantyTxns || 0 : t.drawer.warrantyCount || 0;
  const employee = isDriver ? t.employee : t.drawer.cashier || t.employee;

  const [stage, setStage] = React.useState(0);
  const [mode, setMode] = React.useState('denom');
  const [manual, setManual] = React.useState(!isDriver && t.drawer.counted != null ? String(t.drawer.counted) : '');
  const [q, setQ] = React.useState({});
  const [dest, setDest] = React.useState('safe');
  const [bag, setBag] = React.useState('');
  const [acceptedBy, setAcceptedBy] = React.useState('Manisha Saini');
  const [reason, setReason] = React.useState('');
  const [res, setRes] = React.useState(null);

  const denomTotal = denomSum(q);
  const counted = mode === 'denom' ? +denomTotal.toFixed(2) : parseFloat(manual || '0') || 0;
  const has = mode === 'denom' ? denomTotal > 0 : manual !== '';
  const variance = +(counted - expected).toFixed(2);
  const vcolor = !has ? P.inkMute : Math.abs(variance) < 0.005 ? P.good : variance < 0 ? P.bad : P.warn;
  const deposit = +(counted - startCash).toFixed(2);
  const plan = mode === 'denom' && has ? keepBackPlan(q, startCash) : null;
  const offBalance = Math.abs(variance) >= 0.005;
  const canConfirm = !!bag.trim() && !!acceptedBy && (!offBalance || !!reason.trim());

  const confirm = () => {
    const r = { id: rid('DEP'), at: nowTime(), amount: Math.max(0, deposit), dest, bag: bag.trim(), acceptedBy, variance, reason: reason.trim() };
    setRes(r); setStage(2); onDeposited && onDeposited(r);
  };

  const Txn = ({ label, n, tint, last }) =>
    <div style={{ flex: 1, textAlign: 'center', padding: '11px 6px', borderRight: last ? 'none' : `1px solid ${P.hairline}` }}>
      <div style={{ fontSize: 21, fontWeight: 800, fontFamily: P.fontMono, color: n ? tint || P.ink : P.inkFaint }}>{n}</div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: P.inkMute, marginTop: 3, lineHeight: 1.2 }}>{label}</div>
    </div>;

  const destObj = DESTS.find((d) => d.v === dest);

  return (
    <Overlay onClose={onClose} width={660}>
      <ModalHead eyebrow={(isDriver ? 'Deposit cash bag · ' : 'Close drawer · ') + t.name}
        title={stage === 2 ? (isDriver ? 'Deposit confirmed' : 'Drawer closed') : stage === 1 ? (isDriver ? 'Confirm the deposit' : 'Confirm the close-out') : isDriver ? 'Driver cash deposit' : 'Reconcile & close drawer'}
        onClose={onClose} closeIcon={stage === 0 ? 'arrow-left' : 'x'} closeTitle={stage === 0 ? 'Back to terminal' : 'Close'} />
      <StageBar steps={['Count', 'Confirm', isDriver ? 'Deposited' : 'Closed']} at={stage} />

      <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
        {stage === 0 && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Avatar name={employee || t.name} size={42} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{employee || '—'}</div>
              <div style={{ fontSize: 12.5, color: P.inkDim, fontWeight: 500 }}>{isDriver ? t.device.model : (t.drawer.since ? 'Opened ' + t.drawer.since : 'Session') + ' · ' + t.name}</div>
            </div>
            {isDriver ?
              <span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: '#fff', background: regionColor(t.region), padding: '5px 11px', borderRadius: P.r8 }}>{regionName(t.region)}</span> :
              <Pill kind="dark" icon="register">Station</Pill>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Tile label="Total sales" value={money(totalSales)} sub="cash + card" />
            <Tile label="Expected cash in drawer" value={money(expected)} sub={'starting ' + money(startCash) + ' + cash'} bg={P.accentSoft} br={P.accentBorder} />
            <Tile label="Card · settled" value={money(cardAmt)} sub="not in the drawer" bg={P.infoSoft} br={P.info + '55'} />
          </div>

          <div style={{ marginTop: 12, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
            <div style={{ padding: '7px 14px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim }}>Transactions this shift</div>
            <div style={{ display: 'flex' }}>
              <Txn label="Cash" n={cashTxns} tint={P.good} /><Txn label="Split" n={splitTxns} tint={P.sativa} />
              <Txn label="Card" n={cardTxns} tint={P.info} /><Txn label="Warranty / exch." n={warrantyTxns} tint={P.warn} last />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 11, gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Count the drawer</span>
            <Seg size="sm" value={mode} onChange={setMode} options={[{ value: 'denom', label: 'By denomination' }, { value: 'quick', label: 'Quick' }]} />
          </div>
          {mode === 'denom' ?
            <DenomCounter q={q} set={(k, v) => setQ((m) => ({ ...m, [k]: v.replace(/[^0-9]/g, '') }))} /> :
            <div style={{ maxWidth: 260 }}><FLabel>Counted amount</FLabel><Field mono value={manual} onChange={(e) => setManual(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" size="lg" /></div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <Tile label="Counted total" value={has ? money(counted) : '—'} bg={P.surface} br={P.hairline2} />
            <div style={{ padding: '12px 14px', borderRadius: P.r12, background: !has ? P.surface2 : Math.abs(variance) < 0.005 ? P.goodSoft : variance < 0 ? P.badSoft : P.warnSoft, border: `1px solid ${!has ? P.hairline : (Math.abs(variance) < 0.005 ? P.good : variance < 0 ? P.bad : P.warn) + '44'}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkDim, marginBottom: 5 }}>{!has ? 'Over / short' : !offBalance ? 'Balanced ✓' : variance < 0 ? 'Short' : 'Over'}</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: vcolor, fontFamily: P.fontMono, lineHeight: 1 }}>{has ? (variance > 0 ? '+' : '') + money(variance) : '—'}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: P.r12, background: P.goodSoft, border: `1px solid ${P.good}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: plan ? 11 : 4 }}>
              <Icon name="cash" size={16} color={P.good} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Leave {money(startCash)} in the drawer — small bills &amp; coins for change</span>
            </div>
            {plan ? <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
                {plan.leave.length ? plan.leave.map((x, i) =>
                  <span key={i} style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: P.ink, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, padding: '5px 11px' }}>{x.take} × {x.l}</span>) :
                  <span style={{ fontSize: 12.5, color: P.inkDim }}>Not enough small denominations counted yet.</span>}
              </div>
              {plan.short > 0.005 && <div style={{ fontSize: 11.5, color: P.warn, marginBottom: 10, fontWeight: 500 }}>Still {money(plan.short)} short on small bills — break a larger bill or pull change from the safe.</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 11, borderTop: `1px solid ${P.good}33` }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink2 }}>Deposit the rest</span>
                <span style={{ fontSize: 21, fontWeight: 800, fontFamily: P.fontMono, color: P.ink }}>{money(Math.max(0, deposit))}</span>
              </div>
            </> : <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45 }}>Count the drawer above and we’ll suggest exactly which bills &amp; coins to leave for the next shift — the rest is your deposit.</div>}
          </div>
        </>}

        {stage === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Tile label="Depositing" value={money(Math.max(0, deposit))} sub={'counted ' + money(counted) + ' − starting ' + money(startCash)} bg={P.accentSoft} br={P.accentBorder} />
            <Tile label={!offBalance ? 'Balanced ✓' : variance < 0 ? 'Short' : 'Over'} value={(variance > 0 ? '+' : '') + money(variance)} sub="against expected" ink={vcolor}
              bg={!offBalance ? P.goodSoft : variance < 0 ? P.badSoft : P.warnSoft} br={(!offBalance ? P.good : variance < 0 ? P.bad : P.warn) + '44'} />
          </div>

          <div>
            <FLabel>Where is it going?</FLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {DESTS.map((d) => {const on = dest === d.v;return (
                <button key={d.v} onClick={() => setDest(d.v)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans,
                  background: on ? P.accentSoft : P.surface, border: `1.5px solid ${on ? P.accentBorder : P.hairline2}`, borderRadius: P.r10 }}>
                  <span style={{ width: 15, height: 15, borderRadius: 99, flex: '0 0 auto', border: `2px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent' }} />
                  <Icon name={d.icon} size={17} color={on ? (P.accentText) : P.inkMute} />
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{d.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>{d.sub}</span></span>
                </button>);})}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}><FLabel hint="— written on the sealed bag">Bag / envelope number</FLabel>
              <Field mono icon="barcode" value={bag} onChange={(e) => setBag(e.target.value.toUpperCase())} placeholder="e.g. LE-00841" /></div>
            <div style={{ flex: 1 }}><FLabel>Accepted by</FLabel>
              <TSelect icon="user-check" value={acceptedBy} onChange={setAcceptedBy} options={managers()} /></div>
          </div>

          {offBalance && <div style={{ padding: '13px 15px', background: variance < 0 ? P.badSoft : P.warnSoft, border: `1px solid ${(variance < 0 ? P.bad : P.warn)}`, borderRadius: P.r12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Icon name="flag" size={14} color={variance < 0 ? P.bad : P.warn} />
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: variance < 0 ? P.bad : P.warn }}>Variance needs an explanation</span>
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {['Miscount at close', 'Change given in error', 'Unlogged payout', 'Till short at open', 'Under investigation'].map((r) =>
                <button key={r} onClick={() => setReason(r)} style={{ padding: '3px 9px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: reason === r ? P.ink : P.surface, color: reason === r ? '#fff' : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{r}</button>)}
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="What happened?"
              style={{ width: '100%', resize: 'vertical', padding: '9px 11px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none', boxSizing: 'border-box' }} />
          </div>}

          <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '4px 14px 10px' }}>
            <KVRow k="Counted" v={money(counted)} mono />
            <KVRow k="Starting cash left in drawer" v={money(startCash)} mono />
            <KVRow k={isDriver ? 'Deposit amount' : 'To deposit'} v={money(Math.max(0, deposit))} mono strong />
          </div>
        </div>}

        {stage === 2 && res && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 99, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="check" size={22} stroke={3} color="#fff" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>{money(res.amount)} sealed &amp; recorded</div>
              <div style={{ fontSize: 12.5, color: P.ink2, marginTop: 2 }}>Deposit <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{res.id}</span> · bag <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{res.bag}</span> · {res.at}</div>
            </div>
          </div>

          <div>
            <FLabel>What happens next</FLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { t: 'Counted & sealed', d: employee + ' counted ' + money(counted) + '; bag ' + res.bag + ' sealed.', done: true },
                { t: 'Accepted by ' + res.acceptedBy.split(' ')[0], d: 'Second signature recorded against the deposit.', done: true },
                { t: destObj.label, d: destObj.sub + '.', done: dest === 'hand' },
                { t: 'Reconciled to the bank feed', d: 'Matched automatically when the deposit clears — variance closes the session.', done: false },
              ].map((s, i, arr) =>
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.done ? P.good : P.surface3, border: s.done ? 'none' : `1.5px solid ${P.hairline2}` }}>
                      {s.done ? <Icon name="check" size={12} stroke={3} color="#fff" /> : <span style={{ width: 5, height: 5, borderRadius: 99, background: P.inkMute }} />}</span>
                    {i < arr.length - 1 && <span style={{ flex: 1, width: 1.5, background: P.hairline, margin: '3px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 13 : 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: s.done ? P.ink : P.inkDim }}>{s.t}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 1, lineHeight: 1.45 }}>{s.d}</div>
                  </div>
                </div>)}
            </div>
          </div>

          <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '4px 14px 10px' }}>
            <KVRow k="Deposit id" v={res.id} mono />
            <KVRow k="Bag / envelope" v={res.bag} mono />
            <KVRow k="Destination" v={destObj.label} />
            <KVRow k="Accepted by" v={res.acceptedBy} />
            <KVRow k="Variance" v={(res.variance > 0 ? '+' : '') + money(res.variance)} mono />
            {res.reason && <KVRow k="Variance reason" v={res.reason} />}
            <KVRow k="Amount deposited" v={money(res.amount)} mono strong />
          </div>
          <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.55 }}>
            {isDriver ? <>The bag session is now closed. {money(startCash)} change stays issued to {regionName(t.region)} for the next shift — the driver does not re-count it at clock-on.</> :
            <>The drawer session is closed and {money(startCash)} starting cash carries to the next associate. The next person opening this station starts a fresh session.</>}
          </div>
        </div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {stage === 2 ? <span style={{ fontSize: 11.5, color: P.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={13} />Posted to the activity log</span> :
          <span style={{ fontSize: 11.5, color: P.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={13} />{money(startCash)} starting cash stays for the next associate</span>}
        <div style={{ display: 'flex', gap: 10 }}>
          {stage === 0 && <><PBtn variant="ghost" onClick={onClose}>Cancel</PBtn>
            <PBtn variant="primary" iconRight="arrow-right" disabled={!has} onClick={() => setStage(1)}>{isDriver ? 'Continue to deposit' : 'Continue to close-out'}</PBtn></>}
          {stage === 1 && <><PBtn variant="ghost" icon="arrow-left" onClick={() => setStage(0)}>Back to count</PBtn>
            <PBtn variant="primary" icon="lock" disabled={!canConfirm} onClick={confirm}>{isDriver ? 'Confirm deposit' : 'Close drawer'}</PBtn></>}
          {stage === 2 && <><PBtn variant="secondary" icon="printer">Print receipt</PBtn>
            <PBtn variant="primary" icon="check" onClick={onClose}>Done</PBtn></>}
        </div>
      </div>
    </Overlay>);
};
