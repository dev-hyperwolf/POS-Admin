// ── Terminal-config shared components + modals ──────────────────────────────
const useP = window.useP;
const { attentionFor, T_REGIONS, T_REGION_BY_ID, regionName, regionColor, READER_POOL, ROSTER, SCHEDULE, DAY_META, PHONE_MODELS } = window.TDATA;
const money = window.HW.fmt.money;

// Tweak context (density + drawer model) — provided by the canvas root.
const TweakCtx = React.createContext({ density: 'comfortable', drawerModel: 'session', setTweak: () => {} });
const useTk = () => React.useContext(TweakCtx);
window.TweakCtx = TweakCtx;window.useTk = useTk;

// Human labels for the three drawer models
const DRAWER_MODEL_INFO = {
  session: { name: 'Shift session', blurb: 'The drawer is a session opened at login and closed at handoff — each cashier is accountable for their own count. Best when a terminal is shared across a day.' },
  merged: { name: 'Merged 1:1', blurb: 'The drawer is part of the terminal itself — one running balance, no open/close. Simplest when one person owns a terminal all day.' },
  device: { name: 'Separate device', blurb: 'The drawer is an attachable device alongside the printer and reader (today’s model).' }
};

// ── Small atoms ─────────────────────────────────────────────────────────────
// Station = register tile. Mobile = delivery vehicle with a phone badge — reads
// unmistakably as "a driver's phone terminal in a vehicle."
window.TypeGlyph = function TypeGlyph({ kind, size = 34 }) {
  const P = useP();
  const st = kind === 'station';
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: P.r10, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: st ? P.ink : P.accent, color: st ? P.surface : P.accentInk }}>
      <Icon name={st ? 'register' : 'truck'} size={size * 0.52} stroke={1.9} />
      {!st && <span style={{ position: 'absolute', right: -4, bottom: -4, width: size * 0.46, height: size * 0.46, borderRadius: '32%', background: P.ink, color: P.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${P.surface}` }}><Icon name="phone" size={size * 0.24} stroke={2} /></span>}
    </div>);
};

window.StatusDot = function StatusDot({ online, level, size = 8 }) {
  const P = useP();
  const c = level === 'critical' ? P.bad : level === 'warn' ? P.warn : online ? P.good : P.inkFaint;
  return <span style={{ width: size, height: size, borderRadius: 99, background: c, flex: '0 0 auto', boxShadow: online && !level ? `0 0 0 3px ${P.good}22` : 'none' }} />;
};

window.TypeTag = function TypeTag({ kind }) {
  return <Pill kind={kind === 'station' ? 'dark' : 'accent'} icon={kind === 'station' ? null : 'truck'}>{kind === 'station' ? 'Station' : 'Mobile'}</Pill>;
};

// Peripheral status chip
window.PeriphChip = function PeriphChip({ icon, label, sub, ok = true, missing, tag }) {
  const P = useP();
  const c = missing ? P.bad : ok ? P.ink2 : P.warn;
  const bg = missing ? P.badSoft : ok ? P.surface3 : P.warnSoft;
  return (
    <span title={label + (sub ? ' · ' + sub : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', background: bg, borderRadius: P.r8, minWidth: 0 }}>
      <Icon name={icon} size={14} stroke={1.8} color={c} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{missing ? 'No ' + label.toLowerCase() : label}{sub && !missing && <span style={{ color: P.inkMute, fontWeight: 500 }}> · {sub}</span>}</span>
        {tag && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{tag}</span>}
      </span>
    </span>);
};

// Attention pills
window.AttnPills = function AttnPills({ t, wrap = true }) {
  const items = attentionFor(t);
  if (!items.length) return null;
  return <span style={{ display: 'inline-flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 6 }}>{items.map((a, i) =>
    <Pill key={i} kind={a.level === 'critical' ? 'bad' : 'warn'} dot>{a.label}</Pill>)}</span>;
};

// "bound to" line
window.BindLine = function BindLine({ device, locked = true }) {
  const P = useP();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: P.inkDim }}>
      {locked && <Icon name="lock" size={12} stroke={1.9} color={P.inkMute} />}
      Bound to <span style={{ fontWeight: 600, color: P.ink2 }}>{device.model}</span>
      <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{device.tag}</span>
    </span>);
};

// Drawer / cash summary respecting the drawer model
window.drawerLine = function drawerLine(t, model) {
  if (t.kind !== 'station') {
    return { icon: 'wallet', label: 'Cash bag', value: t.status === 'on-shift' ? money(t.bag.collected) : '—', sub: t.status === 'on-shift' ? 'collected' : 'off shift', tone: 'neutral' };
  }
  const d = t.drawer;
  if (model === 'device') {
    return { icon: 'cash', label: 'Cash Drawer', value: 'Device', sub: d.state === 'open' ? 'attached · open' : 'attached', tone: 'neutral' };
  }
  if (model === 'merged') {
    return { icon: 'cash', label: 'Drawer', value: money(d.expected || d.counted || d.float), sub: 'starting ' + money(d.float), tone: d.variance < 0 ? 'bad' : 'neutral' };
  }
  // session
  if (d.state === 'closed') return { icon: 'cash', label: 'Drawer', value: 'Closed', sub: 'reconciled', tone: 'neutral' };
  return { icon: 'cash', label: 'Drawer open', value: money(d.expected), sub: d.cashier ? 'by ' + d.cashier.split(' ')[0] : '', tone: d.variance < 0 ? 'bad' : 'good' };
};

// Simple popover select — menu is portaled to <body> so it never clips inside
// a modal/overflow container (fixes the "broken when expanded" dropdowns).
window.TSelect = function TSelect({ value, placeholder = 'Select…', options, onChange, size = 'md', full = true, icon, searchable }) {
  const P = useP();const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);const [rect, setRect] = React.useState(null);const [query, setQuery] = React.useState('');
  const s = { sm: { p: '8px 11px', fs: 12.5 }, md: { p: '11px 13px', fs: 13.5 } }[size];
  const sel = options.find((o) => o.value === value);
  const canSearch = searchable || options.length > 7;
  const toggle = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); setQuery(''); setOpen((o) => !o); };
  const shown = canSearch && query.trim() ? options.filter((o) => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(query.trim().toLowerCase())) : options;
  return (
    <div style={{ position: 'relative', width: full ? '100%' : 'auto' }}>
      <button ref={btnRef} onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: s.p, background: P.field, border: `1px solid ${open ? P.accentBorder : P.fieldBorder}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans, boxShadow: open ? `0 0 0 3px ${P.accentSoft}` : 'none' }}>
        {icon && <Icon name={icon} size={15} stroke={1.9} color={P.inkMute} />}
        <span style={{ flex: 1, textAlign: 'left', fontSize: s.fs, color: sel ? P.ink : P.inkMute, fontWeight: sel ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel ? sel.label : placeholder}</span>
        <Icon name="chevron-down" size={14} stroke={2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && rect && ReactDOM.createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
          <div style={{ position: 'fixed', top: rect.bottom + 5, left: rect.left, width: rect.width, maxHeight: 280, overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 5, zIndex: 401 }}>
            {canSearch && <div style={{ position: 'sticky', top: 0, background: P.surface, padding: '2px 2px 6px', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8 }}>
                <Icon name="search" size={13} stroke={1.9} color={P.inkMute} />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: P.fontSans, fontSize: 12.5, color: P.ink }} />
              </div>
            </div>}
            {shown.length === 0 && <div style={{ padding: '10px', fontSize: 12.5, color: P.inkMute, textAlign: 'center' }}>No matches</div>}
            {shown.map((o) => {const a = o.value === value;return (
                <button key={o.value} onClick={() => {onChange(o.value);setOpen(false);}} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', background: a ? P.accentSoft : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                  {o.sub && <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: o.mono ? P.fontMono : P.fontSans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sub}</span>}
                </span>
                {a && <Icon name="check" size={15} stroke={2.4} color={P.ink} />}
              </button>);})}
          </div>
        </>, document.body)}
    </div>);
};

// Field label
window.FLabel = function FLabel({ children, hint }) {
  const P = useP();
  return <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.02em', color: P.inkDim, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>{children}{hint && <span style={{ fontWeight: 400, color: P.inkMute }}>{hint}</span>}</div>;
};

// ── Overlay (portaled to viewport so it's always visible on the canvas) ─────
window.Overlay = function Overlay({ children, onClose, align = 'center', width = 560 }) {
  const P = useP();
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(24,20,16,.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: align === 'center' ? 'center' : 'stretch', justifyContent: align === 'right' ? 'flex-end' : 'center', padding: align === 'center' ? '40px' : 0, fontFamily: P.fontSans }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: P.surface, borderRadius: align === 'right' ? 0 : P.r16, boxShadow: P.shadowLg, width, maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${P.hairline2}` }}>
        {children}
      </div>
    </div>, document.body);
};

window.ModalHead = function ModalHead({ title, eyebrow, onClose, closeIcon, closeTitle }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 22px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <div>{eyebrow && <Eyebrow style={{ marginBottom: 6 }}>{eyebrow}</Eyebrow>}<h3 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>{title}</h3></div>
      <IconBtn icon={closeIcon || 'x'} title={closeTitle || 'Close'} onClick={onClose} />
    </div>);
};

// ── ADD TERMINAL — adaptive to class, region→reader automation ──────────────
window.AddTerminal = function AddTerminal({ onClose }) {
  const P = useP();const tk = useTk();
  const [step, setStep] = React.useState(1);
  const [kind, setKind] = React.useState(null);
  const [region, setRegion] = React.useState(null);
  const [name, setName] = React.useState('');
  const regReader = region ? T_REGION_BY_ID[region].reader : null;

  const KindCard = ({ k, icon, title, desc, detected }) => {
    const a = kind === k;
    return (
      <button onClick={() => setKind(k)} style={{ flex: 1, textAlign: 'left', padding: '18px 18px 16px', background: a ? P.accentSoft : P.surface2, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all .12s' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <TypeGlyph kind={k} size={38} />
          {a && <Icon name="check-circle" size={20} color={P.ink} />}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{title}</span>
        <span style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45 }}>{desc}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11.5, color: P.inkMute }}><Icon name="link" size={12} stroke={1.9} />{detected}</span>
      </button>);
  };

  return (
    <Overlay onClose={onClose} width={620}>
      <ModalHead eyebrow={step === 1 ? 'New terminal · Step 1 of 2' : 'New terminal · Step 2 of 2'} title={step === 1 ? 'What are you adding?' : kind === 'station' ? 'Set up station' : 'Set up mobile terminal'} onClose={onClose} />
      <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
        {step === 1 && <>
          <div style={{ display: 'flex', gap: 14 }}>
            <KindCard k="station" icon="register" title="Station" desc="A fixed POS on a store computer. Gets a cash drawer, receipt printer and its own card reader." detected="Auto-binds to this computer" />
            <KindCard k="driver" icon="truck" title="Mobile terminal" desc="A driver’s phone in the field. Uses the region’s static Credit Card Reader — one driver per region." detected="Auto-binds to the driver’s phone" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={15} color={P.info} /><span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.4 }}>The device is detected and locked automatically — one terminal per device, no IDs to copy.</span>
          </div>
        </>}
        {step === 2 && kind === 'station' && <StationForm name={name} setName={setName} model={tk.drawerModel} />}
        {step === 2 && kind === 'driver' && <DriverForm name={name} setName={setName} region={region} setRegion={setRegion} regReader={regReader} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="ghost" onClick={step === 1 ? onClose : () => setStep(1)}>{step === 1 ? 'Cancel' : 'Back'}</PBtn>
        {step === 1 ?
        <PBtn variant="accent" iconRight="arrow-right" disabled={!kind} onClick={() => setStep(2)}>Continue</PBtn> :
        <PBtn variant="accent" icon="check" onClick={onClose}>Create terminal</PBtn>}
      </div>
    </Overlay>);
};

function StationForm({ name, setName, model }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: P.goodSoft, borderRadius: P.r10 }}>
        <Icon name="check-circle" size={18} color={P.good} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>This computer detected & locked</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>iMac 24" · macOS 14 · LE-IMAC-06</div></div>
        <Pill kind="good" icon="lock">Bound</Pill>
      </div>
      <div><FLabel>Station name</FLabel><Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Counter 3" /></div>
      <div>
        <FLabel hint="— fixed to this station">Card reader</FLabel>
        <TSelect icon="card" value="new" onChange={() => {}} options={[{ value: 'new', label: 'BBPOS WisePad 3', sub: 'SN 00206 · in the box', mono: true }, { value: 'm2', label: 'Stripe M2', sub: 'SN 00207 · spare', mono: true }]} />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ flex: 1 }}><FLabel>Receipt printer</FLabel><TSelect icon="printer" value="epson" onChange={() => {}} options={[{ value: 'epson', label: 'Epson TM-m30', sub: 'Network · 192.168.4.x', mono: true }, { value: 'none', label: 'No printer' }]} /></div>
        <div style={{ width: 150 }}><FLabel>Starting cash balance</FLabel><Field mono value="$300.00" onChange={() => {}} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
        <Icon name="cash" size={16} color={P.inkDim} />
        <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}><b style={{ color: P.ink2 }}>Cash drawer · {DRAWER_MODEL_INFO[model].name}.</b> {DRAWER_MODEL_INFO[model].blurb}</div>
      </div>
    </div>);
}

function DriverForm({ name, setName, region, setRegion, regReader }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: P.infoSoft, borderRadius: P.r10 }}>
        <Icon name="phone" size={18} color={P.info} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Send a setup link to the driver’s phone</div><div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>They install the app and enter code <b style={{ fontFamily: P.fontMono, color: P.ink2 }}>4821</b> — it binds to whatever phone they sign in on. You don’t need their device here.</div></div>
        <Pill kind="neutral" icon="link">Pending</Pill>
      </div>
      <div><FLabel>Driver</FLabel><Field icon="user" value={name} onChange={(e) => setName(e.target.value)} placeholder="Assign an employee…" /></div>
      <div>
        <FLabel hint="— one driver each">Region</FLabel>
        <TSelect icon="pin" value={region} onChange={setRegion} placeholder="Choose the driver’s region…"
        options={T_REGIONS.map((r) => ({ value: r.id, label: r.id + ' ' + r.name, sub: r.reader ? 'Credit Card Reader: ' + r.reader.model + ' · SN ' + r.reader.sn + ' · static' : 'No reader assigned yet', mono: true }))} />
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '13px 15px', background: region ? regReader ? P.accentSoft : P.warnSoft : P.surface2, border: `1px solid ${region ? regReader ? P.accentBorder : P.warn + '55' : P.hairline}`, borderRadius: P.r12 }}>
        <Icon name={regReader ? 'card' : 'info'} size={17} color={regReader ? P.accentText : P.warn} />
        <div style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.45 }}>
          {!region && <>Pick a region — it already has a <b>static Credit Card Reader</b>, so there’s nothing to map day-to-day.</>}
          {region && regReader && <><b>Credit Card Reader:</b> {regReader.model} <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>SN {regReader.sn}</span>. Static to {regionName(region)} — this driver uses it automatically.</>}
          {region && !regReader && <><b>{regionName(region)} has no Credit Card Reader yet.</b> Assign one to the region and it stays put — flagged until then.</>}
        </div>
      </div>
      <div><FLabel hint="— the starting cash balance the driver keeps for change">Starting cash bag</FLabel><div style={{ maxWidth: 180 }}><Field mono value="$60.00" onChange={() => {}} /></div></div>
    </div>);
}

// ── SCHEDULE DRAWER — synced from Connecteam (Yesterday/Today/Tomorrow) ─────
window.ScheduleDrawer = function ScheduleDrawer({ onClose }) {
  const P = useP();
  const [day, setDay] = React.useState('today');
  const list = SCHEDULE[day];
  const working = list.filter((p) => !p.off);
  const off = list.filter((p) => p.off);
  const roleTint = (r) => r === 'driver' ? P.accent : r === 'manager' ? P.indica : P.hybrid;
  const roleLabel = (r) => r === 'driver' ? 'Driver' : r === 'manager' ? 'Manager' : 'Cashier';
  const Person = ({ p }) =>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 22px', borderTop: `1px solid ${P.hairline}` }}>
      <Avatar name={p.name} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: roleTint(p.role) === P.accent ? (P.accentText) : roleTint(p.role) }}>{roleLabel(p.role)}</span>
          {p.time && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{p.time}</span>}
        </div>
      </div>
      {p.region ?
        <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: regionColor(p.region), padding: '4px 9px', borderRadius: P.r8 }}>{regionName(p.region)}</span> :
        p.station ? <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>{p.station}</span> : null}
    </div>;
  return (
    <Overlay onClose={onClose} align="right" width={440}>
      <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, fontSize: 11.5, fontFamily: P.fontMono, color: P.inkMute, letterSpacing: '.04em' }}><Icon name="calendar" size={13} /> SYNCED FROM CONNECTEAM</div>
            <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>Shift schedule</h3>
          </div>
          <IconBtn icon="x" onClick={onClose} />
        </div>
        <Seg value={day} onChange={setDay} size="sm" options={Object.keys(DAY_META).map((k) => ({ value: k, label: DAY_META[k].label }))} />
        <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 8, fontFamily: P.fontMono }}>{DAY_META[day].date} · {working.length} working · {off.length} off</div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <div style={{ padding: '10px 22px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim }}>On shift · {working.length}</div>
        {working.map((p, i) => <Person key={i} p={p} />)}
        {off.length > 0 && <>
          <div style={{ padding: '16px 22px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim }}>Off · {off.length}</div>
          {off.map((p, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 22px', borderTop: `1px solid ${P.hairline}`, opacity: .6 }}>
              <Avatar name={p.name} size={32} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{p.name}</div><div style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.role === 'driver' ? 'Driver' : p.role === 'manager' ? 'Manager' : 'Cashier'}</div></div>
              <Pill kind="neutral">Off</Pill>
            </div>)}
        </>}
        <div style={{ padding: '14px 22px', fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>Drivers who are off hold no region today — their region shows as open coverage on the board until someone is scheduled.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 22px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="sm" icon="refresh">Re-sync</PBtn>
      </div>
    </Overlay>);
};

// ── SCHEDULE — synced from Connecteam (Yesterday/Today/Tomorrow) ────────────
// Inline on-screen panel (not a modal): who works which day, hours, and the
// region a driver covers. Off staff are listed dimmed — they hold no terminal.
window.ScheduleStrip = function ScheduleStrip({ onClose }) {
  const P = useP();
  const [day, setDay] = React.useState('today');
  const list = SCHEDULE[day];
  const working = list.filter((p) => !p.off);
  const off = list.filter((p) => p.off);
  const startMin = (tm) => { const m = (tm || '').match(/^(\d+):(\d+)([ap])/); if (!m) return 9999; let h = (+m[1]) % 12; if (m[3] === 'p') h += 12; return h * 60 + (+m[2]); };
  const GROUP_ORDER = ['RC', 'SB', 'OC', 'LA', 'floor'];
  const GROUP_LABEL = { RC: 'Riverside · RC', SB: 'San Bernardino · SB', OC: 'Orange County · OC', LA: 'Los Angeles · LA', floor: 'Store floor · Lake Elsinore' };
  const groups = {};
  working.forEach((p) => { const k = p.region ? p.region.slice(0, 2) : 'floor'; (groups[k] = groups[k] || []).push(p); });
  Object.values(groups).forEach((a) => a.sort((x, y) => startMin(x.time) - startMin(y.time)));
  const roleInk = (r) => r === 'driver' ? (P.accentText) : r === 'manager' ? P.indica : P.hybrid;
  const roleLabel = (r) => r === 'driver' ? 'Driver' : r === 'manager' ? 'Manager' : 'Cashier';
  const Tile = ({ p }) =>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, opacity: p.off ? .55 : 1 }}>
      <Avatar name={p.name} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: roleInk(p.role) }}>{roleLabel(p.role)}</span>
          {p.time && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{p.time}</span>}
        </div>
      </div>
      {p.off ? <Pill kind="neutral">Off</Pill> :
        p.region ? <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: regionColor(p.region), padding: '3px 8px', borderRadius: P.r8 }}>{p.region}</span> :
        p.station ? <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600, textAlign: 'right', maxWidth: 74 }}>{p.station}</span> : null}
    </div>;
  return (
    <div style={{ marginBottom: 24, background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: P.r8, background: P.ink, color: P.surface, flex: '0 0 auto' }}><Icon name="calendar" size={16} stroke={2} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, letterSpacing: '.05em' }}>SYNCED FROM CONNECTEAM</div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>Shift schedule</h2>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{DAY_META[day].date} · {working.length} on · {off.length} off</span>
        <Seg value={day} onChange={setDay} size="sm" options={Object.keys(DAY_META).map((k) => ({ value: k, label: DAY_META[k].label }))} />
        <IconBtn icon="x" onClick={onClose} />
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim, marginBottom: 12 }}>On shift · {working.length} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: P.inkMute }}>— grouped by region, earliest start first</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GROUP_ORDER.filter((k) => groups[k]).map((k) =>
            <div key={k}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: k === 'floor' ? P.ink : regionColor(k + '1'), flex: '0 0 auto' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{GROUP_LABEL[k]}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{groups[k].length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 10 }}>
                {groups[k].map((p, i) => <Tile key={i} p={p} />)}
              </div>
            </div>)}
        </div>
        {off.length > 0 && <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim, margin: '18px 0 10px' }}>Off · {off.length} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: P.inkMute }}>— no region/terminal today</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 10 }}>
            {off.map((p, i) => <Tile key={i} p={p} />)}
          </div>
        </>}
      </div>
    </div>);
};

// ── REGION READER MAP — assign the static reader to a region ONCE ───────────
// Inline on-screen panel (not a modal). Grouped by parent region; map each
// region's static reader once and every driver of that region inherits it.
function RegionTile({ region, reader, onAssign }) {
  const P = useP();
  const [assigning, setAssigning] = React.useState(false);
  return (
    <div style={{ padding: '11px 13px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: regionColor(region.id), padding: '3px 8px', borderRadius: P.r8, flex: '0 0 auto' }}>{region.id}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{region.name}</span>
      </div>
      {assigning ?
        <TSelect size="sm" icon="card" placeholder="Pick a reader…" value={null} options={READER_POOL}
          onChange={(v) => { const rd = READER_POOL.find((x) => x.value === v); onAssign(region.id, { model: rd.model, sn: rd.sn }); setAssigning(false); }} /> :
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {reader ?
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Icon name="card" size={13} color={P.inkMute} style={{ flex: '0 0 auto' }} /><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reader.model}</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>SN {reader.sn} · static</span></span></span> :
              <Pill kind="warn" dot>No reader</Pill>}
          </div>
          <PBtn variant={reader ? 'ghost' : 'accent'} size="xs" icon={reader ? 'refresh' : 'link'} onClick={() => setAssigning(true)} style={{ flex: '0 0 auto' }}>{reader ? 'Swap' : 'Assign'}</PBtn>
        </div>}
    </div>);
}

window.RegionReaderPanel = function RegionReaderPanel({ readers, onAssign, onClose }) {
  const P = useP();
  const mapped = T_REGIONS.filter((r) => readers[r.id]).length;
  const GROUP_ORDER = ['RC', 'SB', 'OC', 'LA'];
  const GROUP_LABEL = { RC: 'Riverside · RC', SB: 'San Bernardino · SB', OC: 'Orange County · OC', LA: 'Los Angeles · LA' };
  const groups = {};
  T_REGIONS.forEach((r) => { const k = r.id.slice(0, 2); (groups[k] = groups[k] || []).push(r); });
  return (
    <div style={{ marginBottom: 24, background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: P.r8, background: P.accent, color: P.accentInk, flex: '0 0 auto' }}><Icon name="card" size={16} stroke={2} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, letterSpacing: '.05em' }}>SET ONCE · INHERITS TO WHOEVER DRIVES THE REGION</div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>Region card readers</h2>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{mapped} of {T_REGIONS.length} mapped</span>
        <IconBtn icon="x" onClick={onClose} />
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {GROUP_ORDER.filter((k) => groups[k]).map((k) =>
          <div key={k}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: regionColor(k + '1'), flex: '0 0 auto' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{GROUP_LABEL[k]}</span>
              <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{groups[k].filter((r) => readers[r.id]).length}/{groups[k].length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 10 }}>
              {groups[k].map((r) => <RegionTile key={r.id} region={r} reader={readers[r.id]} onAssign={onAssign} />)}
            </div>
          </div>)}
      </div>
    </div>);
};

// ── REGION READER MAP (legacy modal, unused) ────────────────────────────────
function RegionReaderRow({ region, reader, onAssign }) {
  const P = useP();
  const [assigning, setAssigning] = React.useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 22px', borderTop: `1px solid ${P.hairline}` }}>
      <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: regionColor(region.id), padding: '4px 9px', borderRadius: P.r8, flex: '0 0 auto' }}>{region.id}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, minWidth: 96 }}>{region.name}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {assigning ?
          <div style={{ maxWidth: 240 }}><TSelect size="sm" icon="card" placeholder="Pick a reader…" value={null} options={READER_POOL}
            onChange={(v) => { const rd = READER_POOL.find((x) => x.value === v); onAssign(region.id, { model: rd.model, sn: rd.sn }); setAssigning(false); }} /></div> :
          reader ?
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="card" size={14} color={P.inkMute} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{reader.model}</span><span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>SN {reader.sn} · static</span></span> :
          <Pill kind="warn" dot>No reader mapped</Pill>}
      </div>
      {!assigning && <PBtn variant={reader ? 'ghost' : 'accent'} size="xs" icon={reader ? 'refresh' : 'link'} onClick={() => setAssigning(true)}>{reader ? 'Swap' : 'Assign'}</PBtn>}
    </div>);
}

window.RegionReaderMap = function RegionReaderMap({ readers, onAssign, onClose }) {
  const P = useP();
  const mapped = T_REGIONS.filter((r) => readers[r.id]).length;
  return (
    <Overlay onClose={onClose} width={560}>
      <ModalHead eyebrow="Set once · inherits to whoever drives the region" title="Map Credit Card Readers to regions" onClose={onClose} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '16px 22px 6px', padding: '11px 14px', background: P.infoSoft, borderRadius: P.r10 }}>
        <Icon name="info" size={16} color={P.info} /><span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.4 }}>A reader is <b>static to its region</b>, not the driver. Map it here one time — every driver assigned to that region inherits it, no per-shift setup.</span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {T_REGIONS.map((r) => <RegionReaderRow key={r.id} region={r} reader={readers[r.id]} onAssign={onAssign} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{mapped} of {T_REGIONS.length} regions mapped</span>
        <PBtn variant="primary" icon="check" onClick={onClose}>Done</PBtn>
      </div>
    </Overlay>);
};

// ── TERMINAL DETAIL (slide-over) ────────────────────────────────────────────
window.TerminalDetail = function TerminalDetail({ t, onClose, onReconcile, onOpenSession, session, events }) {
  const P = useP();const tk = useTk();
  const isDriver = t.kind !== 'station';
  const region = isDriver ? T_REGION_BY_ID[t.region] : null;
  const attn = attentionFor(t);
  const dl = window.drawerLine(t, tk.drawerModel);
  const sess = session || null;
  const open = sess ? !!sess.open : isDriver ? t.status === 'on-shift' : t.drawer.state === 'open';
  const log = events && events.length ? events : window.terminalEvents(t, sess);
  const Section = ({ title, children, action }) =>
  <div style={{ padding: '16px 22px', borderTop: `1px solid ${P.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><Eyebrow>{title}</Eyebrow>{action}</div>
      {children}
    </div>;
  const KV = ({ k, v, mono }) =>
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 12.5, color: P.inkDim }}>{k}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, textAlign: 'right' }}>{v}</span>
    </div>;
  return (
    <Overlay onClose={onClose} align="right" width={440}>
      <div style={{ padding: '20px 22px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <TypeTag kind={t.kind} />
          <IconBtn icon="x" onClick={onClose} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TypeGlyph kind={t.kind} size={46} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>{t.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}><StatusDot online={t.online} /><span style={{ fontSize: 12.5, color: P.inkDim }}>{t.online ? 'Online' : 'Offline'} · {t.lastActive}</span></div>
          </div>
        </div>
        {attn.length > 0 && <div style={{ marginTop: 14 }}><AttnPills t={t} /></div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <PBtn variant="secondary" size="sm" icon="pencil" full>Edit</PBtn>
          {isDriver && t.status !== 'on-shift' ?
            <PBtn variant="secondary" size="sm" icon="clock" full disabled>Off shift</PBtn> :
            open ?
              <PBtn variant="primary" size="sm" icon="cash" full onClick={() => onReconcile && onReconcile(t)}>{isDriver ? 'Deposit bag' : 'Close drawer'}</PBtn> :
              <PBtn variant="accent" size="sm" icon="wallet" full onClick={() => onOpenSession && onOpenSession(t)}>{isDriver ? 'Issue cash bag' : 'Open drawer'}</PBtn>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '8px 11px', background: open ? P.goodSoft : P.surface2, borderRadius: P.r8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: open ? P.good : P.inkFaint, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.4 }}>
            {open ? <>{isDriver ? 'Bag' : 'Drawer'} <b>open</b>{sess && sess.id ? <> · <span style={{ fontFamily: P.fontMono }}>{sess.id}</span></> : null}{sess && sess.at ? ' · since ' + sess.at : ''}{sess && sess.who ? ' · ' + sess.who.split(' ')[0] : ''}</> :
              <>{isDriver ? 'No cash bag issued' : 'Drawer closed'} — {isDriver ? 'the driver normally starts this from the Driver App at clock-on.' : 'the cashier normally opens it when they sign in.'}</>}
          </span>
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <Section title="Assigned to">
          {t.employee ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={t.employee} size={30} /><div><div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{t.employee}</div><div style={{ fontSize: 11.5, color: P.inkMute }}>{isDriver ? regionName(t.region) + ' · today' : 'Signed in'}</div></div></div> :
          <div style={{ fontSize: 12.5, color: P.inkMute, fontStyle: 'italic' }}>No one signed in</div>}
        </Section>
        <Section title="Device binding">
          <KV k="Device" v={t.device.model} />
          <KV k="OS" v={t.device.os} />
          <KV k="Hardware tag" v={t.device.tag} mono />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '8px 11px', background: P.surface2, borderRadius: P.r8 }}><Icon name="lock" size={13} color={P.inkDim} /><span style={{ fontSize: 11.5, color: P.inkDim }}>Locked to this device. Re-bind needs a manager confirm.</span></div>
        </Section>
        <Section title="Credit card reader" action={<PBtn variant="ghost" size="xs" icon="refresh">Swap</PBtn>}>
          {t.reader ? <PeriphChip icon="card" label={t.reader.model} sub={'SN ' + t.reader.sn} ok tag={isDriver ? 'Static · ' + regionName(t.region) : 'Static · this station'} /> :
          <PeriphChip icon="card" label="Card reader" missing tag={isDriver ? 'Assign to ' + regionName(t.region) : 'Assign to station'} />}
        </Section>
        {!isDriver && <Section title="Receipt printer" action={<PBtn variant="ghost" size="xs" icon="link">Swap</PBtn>}>
          <PeriphChip icon="printer" label={t.printer.model} sub={t.printer.conn + (t.printer.ip ? ' · ' + t.printer.ip : '')} ok={t.printer.ok} />
        </Section>}
        <Section title={isDriver ? 'Cash bag' : 'Cash drawer · ' + DRAWER_MODEL_INFO[tk.drawerModel].name}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: P.surface2, borderRadius: P.r10 }}>
            <Icon name={dl.icon} size={20} color={dl.tone === 'bad' ? P.bad : P.ink2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{dl.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: dl.tone === 'bad' ? P.bad : P.ink, fontFamily: P.fontMono }}>{dl.value}{dl.sub && <span style={{ fontSize: 11.5, fontWeight: 500, color: P.inkDim, marginLeft: 8 }}>{dl.sub}</span>}</div>
            </div>
          </div>
          {isDriver && <div style={{ marginTop: 8 }}><KV k="Starting change" v={money(t.bag.float)} mono /><div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 4, lineHeight: 1.45 }}>Driver starts each shift with {money(t.bag.float)} in change. Region is assigned per shift — the reader stays with the region.</div></div>}
          {!isDriver && tk.drawerModel !== 'device' && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 8, lineHeight: 1.45 }}>{DRAWER_MODEL_INFO[tk.drawerModel].blurb}</div>}
        </Section>
        <Section title={'Activity log · ' + log.length + ' events'}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {log.map((e, i) => {
              const tc = e.tone === 'bad' ? P.bad : e.tone === 'warn' ? P.warn : e.tone === 'good' ? P.good : P.inkMute;
              return <div key={i} style={{ display: 'flex', gap: 11 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                  <span style={{ width: 21, height: 21, borderRadius: 99, background: tc + '1f', color: tc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={e.icon || 'clock'} size={11} stroke={2.2} /></span>
                  {i < log.length - 1 && <span style={{ flex: 1, width: 1.5, background: P.hairline, margin: '3px 0' }} />}
                </div>
                <div style={{ paddingBottom: i < log.length - 1 ? 13 : 0, minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: P.ink, lineHeight: 1.3 }}>{e.t}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{e.at}</span>
                  </div>
                  {e.d && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>{e.d}</div>}
                </div>
              </div>;})}
          </div>
        </Section>
      </div>
      <div style={{ padding: '12px 22px', borderTop: `1px solid ${P.hairline}`, display: 'flex', justifyContent: 'space-between', background: P.surface2 }}>
        <PBtn variant="danger" size="sm" icon="trash">Deactivate</PBtn>
        <PBtn variant="ghost" size="sm" icon="printer">Export log</PBtn>
      </div>
    </Overlay>);
};

Object.assign(window, { DRAWER_MODEL_INFO });