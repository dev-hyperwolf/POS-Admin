// ── Hyperdrive Logistics — unified app (Board · Map · Lanes share one state) ─
const useP = window.useP;
const L = window.LDATA;

// Light mode comes from the shared token file, same as every other console.
// This file used to carry a private "toned-down paper" ramp (its own bg / bg2 /
// surface / surface2 / surface3), which made Logistics the one page in the
// estate sitting on a different set of greys. `bg` is already warm paper and a
// card is already `surface` + a `hairline2` rule everywhere else, so there is
// nothing on this page that needs a ramp of its own.

function useLState() {
  const [orders, setOrders] = React.useState(L.ORDERS);
  const [drivers, setDrivers] = React.useState(L.DRIVERS);
  const [flash, setF] = React.useState(null);
  const t = React.useRef();
  const setFlash = (m) => {setF(m);clearTimeout(t.current);t.current = setTimeout(() => setF(null), 2600);};
  const reassign = (id, name) => {
    setOrders((os) => os.map((o) => {
      if (o.id !== id) return o;
      const cand = L.candidatesFor(o, drivers).find((c) => c.d.name === name);
      const nr = cand ? Math.max(o.risk, cand.score) : o.risk;
      return { ...o, driver: name, risk: nr, late: nr >= 0.70 ? null : o.late };
    }));
    setDrivers((ds) => ds.map((d) => d.name === name ? { ...d, load: d.load + 1, status: d.status === 'idle' ? 'duty' : d.status, idle: undefined } : d));
  };
  const setItems = (id, items) => setOrders((os) => os.map((o) => o.id === id ? { ...o, items } : o));
  return { orders, drivers, flash, setFlash, reassign, setItems };
}
function makeAlertHandler(s) {
  return (a, k) => {
    if (k === 'assign' && a.order) {const o = s.orders.find((x) => x.id === a.order);const c = L.candidatesFor(o, s.drivers).find((x) => x.stock) || L.candidatesFor(o, s.drivers)[0];s.reassign(a.order, c.d.name);s.setFlash(`#${a.order} → ${c.d.name}`);} else
    if (k === 'rebalance') s.setFlash(a.region ? `Rebalancing ${L.regionLabel(a.region)}…` : 'Rebalancing fleet…');else
    if (k === 'reassign' && a.order) {const o = s.orders.find((x) => x.id === a.order);const c = L.candidatesFor(o, s.drivers).find((x) => x.stock && !x.current) || L.candidatesFor(o, s.drivers)[0];s.reassign(a.order, c.d.name);s.setFlash(`#${a.order} → ${c.d.name}`);} else
    if (k === 'bump' && a.order) s.setFlash(`#${a.order} bumped to front`);else
    if (k === 'message') s.setFlash(a.driver ? `Message sent to ${a.driver}` : 'Message sent');else
    if (k === 'endbreak') s.setFlash(`${a.driver} break ended`);else
    if (k === 'run') s.setFlash(`Opening assignment run #${a.order}`);
  };
}
function ViewHead({ title, sub, children }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
    <div><h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: P.ink }}>{title}</h1>{sub && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 2 }}>{sub}</div>}</div>
    <div style={{ flex: 1 }} />{children}</div>;
}
function Sel({ icon, value, onChange, options }) {
  const P = useP();
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 34, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10 }}>
    <Icon name={icon} size={14} color={P.inkMute} />
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ border: 'none', background: 'transparent', color: P.ink, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans, outline: 'none', cursor: 'pointer', maxWidth: 150 }}>
      {options.map((o) => <option key={o.v} value={o.v} style={{ background: P.surface, color: P.ink }}>{o.l}</option>)}
    </select>
  </div>;
}

// ── Header ──────────────────────────────────────────────────────────────────
// Same language as every other Hyperwolf app: 60px, surface background, a
// hairline underneath, atoms for the controls. Branding lives in the rail.
function AppHeader({ view, onView, mode, onToggleMode, onSettings }) {
  const P = useP();
  return <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 60, background: P.surface, borderBottom: `1px solid ${P.hairline2}`, flex: '0 0 auto', zIndex: 30 }}>
    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', color: P.ink, fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good }} />ALL REGIONS
      <Icon name="chevron-down" size={14} stroke={2} color={P.inkMute} />
    </button>
    <div style={{ width: 1, height: 24, background: P.hairline2 }} />
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Operations</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>Dispatch</span>
    </div>
    <div style={{ marginLeft: 6 }}>
      <Seg value={view} onChange={onView} size="sm" options={[{ value: 'board', label: 'Board', icon: 'grid' }, { value: 'map', label: 'Map', icon: 'map' }, { value: 'lanes', label: 'Lanes', icon: 'board' }]} />
    </div>
    <div style={{ flex: 1 }} />
    <Pill kind="good" dot>LIVE</Pill>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontFamily: P.fontMono, color: P.inkDim }}><Icon name="clock" size={13} color={P.inkMute} />{L.NOW}</span>
    <button onClick={onToggleMode} title="Toggle theme" style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: P.r10, color: P.ink2, cursor: 'pointer' }}><Icon name={mode === 'dark' ? 'sun' : 'moon'} size={18} stroke={1.9} /></button>
    <IconBtn icon="settings" size={18} title="Settings" onClick={onSettings} />
    <div style={{ width: 1, height: 26, background: P.hairline2, margin: '0 2px' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Avatar name="Manisha Saini" size={32} />
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Manisha Saini</div>
        <div style={{ fontSize: 11.5, color: P.inkDim }}>Dispatch · Ops</div>
      </div>
    </div>
  </header>;
}

// ── New-task dropdown ────────────────────────────────────────────────────────
function NewTaskButton({ onPick }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {if (!open) return;const off = (e) => {if (!e.target.closest('[data-newtask]')) setOpen(false);};document.addEventListener('pointerdown', off, true);return () => document.removeEventListener('pointerdown', off, true);}, [open]);
  const items = [['order', 'New order', 'cart', 'Full POS — cart, payment, assign'], ['break', 'Break task', 'clock', '10-min rest break'], ['meal', 'Meal task', 'clock', 'First / second meal']];
  return <div data-newtask style={{ position: 'relative' }}>
    <PBtn size="sm" variant="accent" icon="plus" iconRight="chevron-down" onClick={() => setOpen((v) => !v)}>New task</PBtn>
    {open && <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 240, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 200, padding: 6 }}>
      {items.map(([k, lb, ic, sub]) => <button key={k} onClick={() => {setOpen(false);onPick(k);}} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: P.r8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: P.surface3, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={ic} size={15} stroke={2} /></span>
        <div><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{lb}</div><div style={{ fontSize: 11.5, color: P.inkMute }}>{sub}</div></div>
      </button>)}
    </div>}
  </div>;
}
function MultiCardFilter({ kind, value, onChange, drivers }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const isRegion = kind === 'region';
  React.useEffect(() => {if (!open) return;const off = (e) => {if (!e.target.closest('[data-mcf="' + kind + '"]')) setOpen(false);};document.addEventListener('pointerdown', off, true);return () => document.removeEventListener('pointerdown', off, true);}, [open]);
  const list = isRegion ? L.REGIONS : drivers.filter((d) => d.status !== 'oos');
  const idOf = (x) => isRegion ? x.code : x.name;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const label = value.length === 0 ? isRegion ? 'All regions' : 'All drivers' : `${value.length} ${isRegion ? 'region' : 'driver'}${value.length > 1 ? 's' : ''}`;
  return <div data-mcf={kind} style={{ position: 'relative' }}>
    <button onClick={() => setOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 11px', background: value.length ? P.highlightSoft : P.field, border: `1px solid ${value.length ? P.hairline3 : P.fieldBorder}`, borderRadius: P.r10, color: P.ink, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name={isRegion ? 'map' : 'truck'} size={14} color={value.length ? P.ink : P.inkMute} />{label}<Icon name="chevron-down" size={13} color={P.inkMute} /></button>
    {open && <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: isRegion ? 306 : 286, maxHeight: 372, display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 200, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${P.hairline}` }}><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, flex: 1 }}>Filter by {isRegion ? 'region' : 'driver'} · pick one or more</span>{value.length > 0 && <button onClick={() => onChange([])} style={{ fontSize: 11.5, fontWeight: 700, color: P.mode === 'dark' ? P.accent : '#7A5A00', background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear ({value.length})</button>}</div>
      <div style={{ padding: 8, overflowY: 'auto', display: 'grid', gridTemplateColumns: isRegion ? '1fr 1fr' : '1fr', gap: 6 }}>
        {list.map((x) => {const id = idOf(x);const on = value.includes(id);
          if (isRegion) return <button key={id} onClick={() => toggle(id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', background: on ? P.surface3 : P.surface2, border: `1px solid ${on ? P.ink : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><RegionTag code={id} size="sm" /><span style={{ fontSize: 11.5, color: P.ink, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.city}</span>{on && <Icon name="check" size={13} color={P.ink} stroke={2.6} />}</button>;
          const st = x.status;const sc = st === 'idle' ? P.warn : st === 'break' || st === 'meal' ? P.info : P.good;
          return <button key={id} onClick={() => toggle(id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', background: on ? P.surface3 : P.surface2, border: `1px solid ${on ? P.ink : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><Avatar name={x.name} size={26} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}><RegionTag code={x.region} size="sm" /><span style={{ fontSize: 10, color: sc, fontWeight: 700 }}>{st}</span></div></div>{on && <Icon name="check" size={14} color={P.ink} stroke={2.6} />}</button>;
        })}
      </div>
    </div>}
  </div>;
}
function FilterBar({ region, setRegion, driver, setDriver, status, setStatus, drivers, onNew, right, inline }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: inline ? '10px 13px' : '11px 20px', border: inline ? `1px solid ${P.hairline2}` : 'none', borderBottom: inline ? `1px solid ${P.hairline2}` : `1px solid ${P.hairline}`, borderRadius: inline ? P.r12 : 0, background: inline ? P.surface : P.bg, flex: '0 0 auto', flexWrap: 'wrap' }}>
    <MultiCardFilter kind="region" value={region} onChange={setRegion} />
    <MultiCardFilter kind="driver" value={driver} onChange={setDriver} drivers={drivers} />
    <Seg size="sm" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'atrisk', label: 'At risk' }, { value: 'unassigned', label: 'Unassigned' }, { value: 'scheduled', label: 'Scheduled' }]} />
    <div style={{ flex: 1 }} />
    {right}
    <NewTaskButton onPick={onNew} />
  </div>;
}
function Hero({ h, status, setStatus }) {
  const pick = (k) => setStatus(status === k ? 'all' : k);
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
    <LHeroStat icon="clock" label="At risk of breach" value={h.atRisk} tone="bad" hint="ETA past SLA" onClick={() => pick('atrisk')} active={status === 'atrisk'} />
    <LHeroStat icon="flag" label="Understaffed regions" value={h.understaffed} tone="bad" hint="demand over capacity" />
    <LHeroStat icon="user-off" label="Unassigned" value={h.unassigned} tone="bad" hint="need a driver now" onClick={() => pick('unassigned')} active={status === 'unassigned'} />
    <LHeroStat icon="user-check" label="Idle drivers" value={h.idle} tone="warn" hint="on-duty, no stop" />
    <LHeroStat icon="calendar" label="Scheduled" value={h.scheduled} tone="info" hint="pre-booked" onClick={() => pick('scheduled')} active={status === 'scheduled'} />
    <LHeroStat icon="check-circle" label="On-time" value={h.onTime} unit="%" tone="good" hint={`${h.active} active · ${h.drivers} drivers`} />
  </div>;
}
function filterOrders(orders, { region, driver, status }) {
  let fo = orders;
  if (region.length) fo = fo.filter((o) => region.includes(o.region));
  if (driver.length) fo = fo.filter((o) => driver.includes(o.driver));
  if (status === 'atrisk') fo = fo.filter((o) => !o.sched && L.riskBand(o.risk) !== 'ok');else
  if (status === 'unassigned') fo = fo.filter((o) => !o.driver && !o.sched);else
  if (status === 'scheduled') fo = fo.filter((o) => o.sched);
  return fo;
}

// ── Settings drawer ──────────────────────────────────────────────────────────
function SettingsModal({ onClose, onFlash }) {
  const P = useP();
  const cats = ['Failure Reason', 'Announcements', 'Transportation', 'Checklist', 'Checkout', 'Out of Service', 'Buffer Spillover Rules', 'Routing Config'];
  const [cat, setCat] = React.useState('Routing Config');
  const Field2 = ({ k, v, suffix }) => <div style={{ background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: '9px 12px' }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 3 }}>{v}{suffix && <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 500 }}> {suffix}</span>}</div></div>;
  const body = () => {
    if (cat === 'Routing Config') return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
      <Field2 k="SLA" v={L.CFG.sla} suffix="min" /><Field2 k="SLA buffer" v={L.CFG.buffer} suffix="min" /><Field2 k="Risk OK ≥" v={L.CFG.ok} /><Field2 k="Risk BAD <" v={L.CFG.bad} /><Field2 k="Idle start" v="10" suffix="min" /><Field2 k="KM cap" v="20" /><Field2 k="Load spread cap" v="4" /><Field2 k="Buffer penalty" v="-0.35" />
    </div>;
    if (cat === 'Transportation') return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{['Bicycle', 'Bike', 'Car'].map((v, i) => <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}><Icon name="truck" size={16} color={P.ink2} /><span style={{ flex: 1, fontSize: 13.5, color: P.ink }}>{v}</span><Switch on={i === 2} onChange={() => onFlash(`${v} toggled`)} /></div>)}</div>;
    if (cat === 'Out of Service') return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{['Route Issue/Delay', 'Family emergency', 'Paperwork pending', 'Failure', 'Accident', 'Maintenance'].map((r) => <div key={r} style={{ display: 'flex', alignItems: 'center', padding: '10px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}><span style={{ flex: 1, fontSize: 13.5, color: P.ink }}>{r}</span><Icon name="pencil" size={14} color={P.inkMute} /></div>)}</div>;
    if (cat === 'Buffer Spillover Rules') return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{L.REGIONS.map((r) => <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}><RegionTag code={r.code} size="sm" /><span style={{ flex: 1, fontSize: 13.5, color: P.ink }}>{r.city}</span><span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>4000 m</span></div>)}</div>;
    return <div style={{ padding: '30px', textAlign: 'center', color: P.inkMute, fontSize: 13.5 }}>{cat} settings · configure and save from here</div>;
  };
  return <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim, zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px,94%)', height: '100%', background: P.bg, borderLeft: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}><Icon name="settings" size={18} color={P.ink} /><span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Settings</span><div style={{ flex: 1 }} /><IconBtn icon="x" size={18} onClick={onClose} /></div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '200px 1fr' }}>
        <div style={{ borderRight: `1px solid ${P.hairline}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: P.r10, border: 'none', background: cat === c ? P.accent : 'transparent', color: cat === c ? P.accentInk : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{c}</button>)}
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink, marginBottom: 14 }}>{cat}</div>{body()}</div>
      </div>
    </div>
  </div>;
}

// ── New order (full POS) + break/meal task flows ────────────────────────────
function NewOrderSheet({ drivers, onFlash, onClose }) {
  const P = useP();
  const [draft, setDraft] = React.useState({ id: 'NEW', txn: '—', region: 'RC5', driver: null, speed: 'ASAP', recipient: 'New guest', addr: 'Set delivery address', items: [], cash: 0, placed: L.NOW, deadline: '—', eta: null, risk: 0.9, late: null });
  return <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim, zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(880px,94%)', maxHeight: '90%', margin: 12, display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ padding: '11px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="cart" size={16} color={P.accent} /><span style={{ fontSize: 13.5, fontWeight: 800, color: P.ink }}>New order</span><span style={{ fontSize: 11.5, color: P.inkDim }}>Full POS — build the cart, take payment, assign a driver</span></div>
      <window.LOrderDetail order={draft} drivers={drivers} onReassign={(id, name) => setDraft((d) => ({ ...d, driver: name }))} onItems={(id, items) => setDraft((d) => ({ ...d, items }))} onFlash={onFlash} onClose={onClose} wide />
    </div>
  </div>;
}
function TaskFlowModal({ kind, drivers, onClose, onFlash }) {
  const P = useP();
  const isBreak = kind === 'break';
  const [drv, setDrv] = React.useState((drivers.find((d) => d.status !== 'oos') || {}).name || '');
  const opts = isBreak ? ['First 10-min break', 'Second 10-min break', 'Third 10-min break (full shift only)'] : ['First Meal (30 min)', 'Second Meal (30 min · full shift, waivable)'];
  const [sel, setSel] = React.useState(opts[0]);
  const [waive, setWaive] = React.useState(false);
  return <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px,96%)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}><span style={{ width: 30, height: 30, borderRadius: 8, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : '#7A5A00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={16} stroke={2} /></span><span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{isBreak ? 'Break task' : 'Meal task'}</span><div style={{ flex: 1 }} /><IconBtn icon="x" size={16} onClick={onClose} /></div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Driver</div>
          <div style={{ display: 'inline-flex', width: '100%', alignItems: 'center', gap: 6, padding: '0 10px', height: 40, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10 }}><Icon name="truck" size={15} color={P.inkMute} /><select value={drv} onChange={(e) => setDrv(e.target.value)} style={{ flex: 1, border: 'none', background: 'transparent', color: P.ink, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, outline: 'none' }}>{drivers.filter((d) => d.status !== 'oos').map((d) => <option key={d.id} value={d.name} style={{ background: P.surface }}>{d.name}</option>)}</select></div>
        </div>
        <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>{isBreak ? 'Break' : 'Meal'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{opts.map((o) => <button key={o} onClick={() => setSel(o)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: sel === o ? P.surface3 : P.surface2, border: `1px solid ${sel === o ? P.ink : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><span style={{ width: 15, height: 15, borderRadius: 99, border: `2px solid ${sel === o ? P.ink : P.hairline3}`, background: sel === o ? P.ink : 'transparent', flex: '0 0 auto' }} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{o}</span></button>)}</div>
        </div>
        {!isBreak && <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}><Check on={waive} onChange={setWaive} size={18} /><span style={{ fontSize: 12.5, color: P.ink2 }}>Waive this meal (driver declined)</span></label>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 18px', borderTop: `1px solid ${P.hairline}` }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" onClick={() => {onFlash(`${sel}${waive ? ' — waived' : ''} · ${drv}`);onClose();}}>{waive ? 'Log waiver' : 'Create task'}</PBtn>
      </div>
    </div>
  </div>;
}

// ── BOARD ────────────────────────────────────────────────────────────────────
function BoardView({ s, F, onOpen }) {
  const P = useP();
  const onAct = makeAlertHandler(s);
  const doReassign = (id, name) => {s.reassign(id, name);s.setFlash(`#${id} → ${name}`);};
  const [q, setQ] = React.useState('');
  const [af, setAf] = React.useState('all');
  let stats = L.allRegionStats(s.orders, s.drivers);
  if (F.region.length) stats = stats.filter((r) => F.region.includes(r.code));
  if (q.trim()) {const t = q.toLowerCase();stats = stats.filter((st) => st.code.toLowerCase().includes(t) || (L.REGION_BY_CODE[st.code].city || '').toLowerCase().includes(t) || st.ds.some((d) => d.name.toLowerCase().includes(t)));}
  return <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
      <ViewHead title="Region command board" sub="Every region ranked worst-first · load vs capacity & SLA">
        <div style={{ width: 220 }}><Field icon="search" size="sm" placeholder="Region, city, driver…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </ViewHead>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(236px,1fr))', gap: 12, alignContent: 'start' }}>
        {stats.map((st) => <LRegionCard key={st.code} stat={st} drivers={s.drivers} variant="orders" onReassign={doReassign} onOpen={onOpen} onAct={(k, code) => onAct({ region: code }, k)} />)}
        {stats.length === 0 && <div style={{ color: P.inkMute, fontSize: 12.5, padding: 20 }}>No regions match “{q}”.</div>}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: P.bad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={15} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Live alerts</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Flagged the moment it happens</div></div>
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '9px 12px', borderBottom: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['unassigned', 'Unassigned'], ['sla', 'SLA risk'], ['capacity', 'Capacity'], ['driver', 'Drivers']].map(([k, lb]) => {const on = af === k;const n = k === 'all' ? L.ALERTS.length : L.ALERTS.filter((a) => a.type === k).length;return <button key={k} onClick={() => setAf(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : 'transparent', color: on ? P.surface : P.inkDim, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>{lb}<span style={{ fontFamily: P.fontMono, opacity: .7 }}>{n}</span></button>;})}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {L.ALERTS.filter((a) => af === 'all' || a.type === af).map((a) => <LAlertRow key={a.id} a={a} onAct={onAct} />)}
        {L.ALERTS.filter((a) => af === 'all' || a.type === af).length === 0 && <div style={{ padding: 24, textAlign: 'center', color: P.inkMute, fontSize: 12.5 }}>No {af} alerts right now.</div>}
      </div>
    </div>
  </div>;
}

// ── MAP ──────────────────────────────────────────────────────────────────────
function MapView({ s, F }) {
  const P = useP();
  const [sel, setSel] = React.useState(1012);
  const [form, setForm] = React.useState('popover');
  const [showDrivers, setShowDrivers] = React.useState(true);
  const [sort, setSort] = React.useState('region');
  const fo = filterOrders(s.orders, F);
  const listAll = [...fo].sort((a, b) => a.risk - b.risk);
  const numById = {};listAll.filter((o) => !o.sched).forEach((o, i) => {numById[o.id] = i + 1;});
  const CN = { RC: 'Riverside', SB: 'San Bernardino', OC: 'Orange', LA: 'Los Angeles' };
  const rows = React.useMemo(() => {
    let arr = [...fo];const byRisk = (a, b) => a.risk - b.risk;
    if (sort === 'unassigned') arr.sort((a, b) => (a.driver ? 1 : 0) - (b.driver ? 1 : 0) || byRisk(a, b));else
    if (sort === 'region') arr.sort((a, b) => a.region.localeCompare(b.region) || byRisk(a, b));else
    if (sort === 'driver') arr.sort((a, b) => (a.driver || '~~').localeCompare(b.driver || '~~') || byRisk(a, b));else
    if (sort === 'county') arr.sort((a, b) => L.REGION_BY_CODE[a.region].county.localeCompare(L.REGION_BY_CODE[b.region].county) || byRisk(a, b));else
    arr.sort(byRisk);
    if (['region', 'driver', 'county'].includes(sort)) {
      const keyOf = (o) => sort === 'region' ? o.region : sort === 'driver' ? o.driver || 'Unassigned' : L.REGION_BY_CODE[o.region].county;
      const counts = {};arr.forEach((o) => {const k = keyOf(o);counts[k] = (counts[k] || 0) + 1;});
      const out = [];let cur = null;arr.forEach((o) => {const k = keyOf(o);if (k !== cur) {out.push({ h: k, n: counts[k] });cur = k;}out.push({ o });});return out;
    }
    return arr.map((o) => ({ o }));
  }, [fo, sort]);
  const selOrder = s.orders.find((o) => o.id === sel);
  const doReassign = (id, name) => {s.reassign(id, name);s.setFlash(`#${id} → ${name}`);};
  return <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
    <div style={{ minWidth: 0 }}>
      <LLiveMap orders={fo} drivers={s.drivers} selectedId={form === 'popover' ? sel : null} onSelect={setSel} numById={numById} showDrivers={showDrivers} detailForm={form} onReassign={doReassign} onItems={s.setItems} onFlash={s.setFlash} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="list" size={15} stroke={2} /></span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{listAll.length} orders</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Tap a pin or row to open · edit anywhere</div></div>
          <button onClick={() => setShowDrivers((v) => !v)} title="Toggle drivers + routes" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 99, border: `1px solid ${showDrivers ? P.ink : P.hairline2}`, background: showDrivers ? P.ink : 'transparent', color: showDrivers ? P.surface : P.inkDim, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="route" size={12} />Routes</button>
        </div>
        <Seg size="sm" full value={form} onChange={setForm} options={[{ value: 'popover', label: 'Popover', icon: 'pin' }, { value: 'sheet', label: 'Bottom sheet', icon: 'layout' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>Sort</span>
          <Sel icon="list" value={sort} onChange={setSort} options={[{ v: 'risk', l: 'Worst SLA' }, { v: 'unassigned', l: 'Unassigned first' }, { v: 'region', l: 'By region' }, { v: 'driver', l: 'By driver' }, { v: 'county', l: 'By county' }]} />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((it, ix) => {if (it.h !== undefined) return <div key={'h' + ix} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 6px 4px', position: 'sticky', top: 0, background: P.surface, zIndex: 2 }}>{sort === 'region' ? <RegionTag code={it.h} size="sm" /> : <span style={{ width: 8, height: 8, borderRadius: 2, background: sort === 'county' ? L.CC[it.h] : P.inkFaint }} />}<span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.ink2 }}>{sort === 'region' ? L.REGION_BY_CODE[it.h].city : sort === 'county' ? CN[it.h] + ' County' : it.h}</span><span style={{ fontSize: 10, fontFamily: P.fontMono, fontWeight: 700, color: P.inkMute, background: P.surface2, padding: '1px 7px', borderRadius: 99 }}>{it.n}</span><span style={{ flex: 1, height: 1, background: P.hairline }} /></div>;
          const o = it.o;const band = L.riskBand(o.risk);const c = L.riskColor(P, band);const on = o.id === sel;const un = !o.driver && !o.sched;
          return <button key={o.id} onClick={() => setSel(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: on ? P.surface3 : P.surface2, border: `1px solid ${on ? P.ink : un ? P.bad : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: P.fontSans }}>
            <span style={{ position: 'relative', width: 26, height: 26, flex: '0 0 auto' }}><svg width="26" height="26" viewBox="0 0 30 38" style={{ position: 'absolute', inset: 0 }}><path d="M15 37C15 37 28 22 28 14A13 13 0 1 0 2 14C2 22 15 37 15 37Z" fill={un ? P.bad : c} /></svg><span style={{ position: 'absolute', left: 0, right: 0, top: 3, textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: un ? '#fff' : '#0b0b08', fontFamily: P.fontMono }}>{un ? '!' : o.sched ? 'S' : numById[o.id] || '•'}</span></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: P.ink }}>#{o.id}</span><RegionTag code={o.region} size="sm" />{o.sched ? <Pill kind="info" style={{ fontSize: 10, padding: '0 6px' }}>sched</Pill> : o.speed === 'ASAP' && <span style={{ fontSize: 10, fontWeight: 800, color: P.bad }}>ASAP</span>}</div><div style={{ fontSize: 11.5, color: P.ink2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.recipient} · {un ? <span style={{ color: P.bad, fontWeight: 700 }}>Unassigned</span> : o.driver}</div></div>
            <div style={{ textAlign: 'right', flex: '0 0 auto' }}><div style={{ fontSize: 12.5, fontWeight: 700, color: o.sched ? P.info : c, fontFamily: P.fontMono }}>{o.sched ? 'SCHED' : Math.round(o.risk * 100) + '%'}</div><div style={{ fontSize: 10, color: o.late ? P.bad : P.inkMute, fontFamily: P.fontMono }}>{o.late ? '+' + o.late + 'm' : o.deadline}</div></div>
          </button>;
        })}
        {rows.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: P.inkMute, fontSize: 12.5 }}>No orders match filters</div>}
      </div>
    </div>
    {form === 'sheet' && selOrder && <LOrderSheet order={selOrder} drivers={s.drivers} onReassign={doReassign} onItems={s.setItems} onFlash={s.setFlash} onClose={() => setSel(null)} />}
  </div>;
}

// ── LANES (grouped by county) ────────────────────────────────────────────────
function LanesView({ s, F }) {
  const P = useP();
  const ord = { duty: 0, idle: 1, break: 2, meal: 2, oos: 3 };
  let ds = [...s.drivers].filter((d) => (F.region.length === 0 || F.region.includes(d.region)) && (F.driver.length === 0 || F.driver.includes(d.name))).sort((a, b) => ord[a.status] - ord[b.status] || b.load - a.load);
  const doReassign = (id, name) => {s.reassign(id, name);s.setFlash(`#${id} → ${name}`);};
  const CN = { RC: 'Riverside County', SB: 'San Bernardino County', OC: 'Orange County', LA: 'Los Angeles County' };
  const counties = ['RC', 'SB', 'OC', 'LA'].filter((cc) => ds.some((d) => L.REGION_BY_CODE[d.region].county === cc));
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    <ViewHead title="Driver capacity lanes" sub="Grouped by county · reassign across lanes in one move">
      <PBtn size="sm" variant="accent" icon="refresh" onClick={() => s.setFlash('Auto-rebalancing overloaded lanes…')}>Rebalance all</PBtn>
    </ViewHead>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {counties.map((cc) => {const cd = ds.filter((d) => L.REGION_BY_CODE[d.region].county === cc);const col = L.CC[cc];
        return <div key={cc}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{CN[cc]}</span>
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{cd.length} driver{cd.length !== 1 ? 's' : ''}</span>
            <span style={{ flex: 1, height: 1, background: P.hairline }} />
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', height: 340, paddingBottom: 4 }}>
            {cd.map((d) => <LDriverLane key={d.id} driver={d} orders={s.orders} drivers={s.drivers} onReassign={doReassign} onFlash={s.setFlash} />)}
          </div>
        </div>;
      })}
      {counties.length === 0 && <div style={{ color: P.inkMute, fontSize: 12.5, padding: 20 }}>No drivers match filters.</div>}
    </div>
  </div>;
}

// ── App shell ────────────────────────────────────────────────────────────────
// Theme is the shared ThemeProvider from pos/tokens.jsx — the same one Engage,
// @ Home and POS mount. It seeds from `hw-pos-theme` and writes back to it, so
// Logistics opens in whatever mode the operator last chose instead of forcing
// its own. It previously held a private ThemeCtx pinned to `useState('dark')`,
// which ignored that key entirely and made this the only console that opened
// dark on a light-mode platform.
window.LogisticsApp = function LogisticsApp() {
  return <window.ThemeProvider><LogisticsShell /></window.ThemeProvider>;
};

function LogisticsShell() {
  const { mode, P, toggle } = window.useTheme();
  const s = useLState();
  const [view, setView] = React.useState('map');
  const [region, setRegion] = React.useState([]);
  const [driver, setDriver] = React.useState([]);
  const [status, setStatus] = React.useState('all');
  const [settings, setSettings] = React.useState(false);
  const [taskFlow, setTaskFlow] = React.useState(null); // 'order' | 'break' | 'meal'
  const h = L.HERO(s.orders, s.drivers);
  const F = { region, driver, status };
  const [openId, setOpenId] = React.useState(null);
  const openOrder = s.orders.find((o) => o.id === openId);
  return <React.Fragment>
    <div style={{ display: 'flex', height: '100vh', background: P.bg, overflow: 'hidden' }}>
    <window.HWRail active="logistics" />
    <div style={{ flex: 1, minWidth: 0, height: '100vh', background: P.bg, color: P.ink, fontFamily: P.fontSans, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <AppHeader view={view} onView={setView} mode={mode} onToggleMode={toggle} onSettings={() => setSettings(true)} />
      {(() => {const un = s.orders.filter((o) => !o.driver && !o.sched);if (!un.length) return null;return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', background: P.badSoft, borderBottom: `1px solid ${P.bad}`, flex: '0 0 auto', flexWrap: 'wrap' }}>
        <Icon name="user-off" size={15} color={P.bad} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{un.length} order{un.length > 1 ? 's' : ''} unassigned — need a driver now</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{un.slice(0, 5).map((o) => <button key={o.id} onClick={() => setOpenId(o.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, border: `1px solid ${P.bad}`, background: P.surface, color: P.ink, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontMono }}>#{o.id}<span style={{ color: P.inkMute, fontWeight: 500 }}>{o.region}</span></button>)}{un.length > 5 && <span style={{ fontSize: 11.5, color: P.inkDim, alignSelf: 'center' }}>+{un.length - 5}</span>}</div>
        <div style={{ flex: 1 }} />
        <PBtn size="xs" variant="accent" icon="user-check" onClick={() => {setView('map');setStatus('unassigned');}}>Review all</PBtn>
      </div>;})()}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 20px 18px' }}>
        <Hero h={h} status={status} setStatus={setStatus} />
        <FilterBar inline region={region} setRegion={setRegion} driver={driver} setDriver={setDriver} status={status} setStatus={setStatus} drivers={s.drivers} onNew={(k) => setTaskFlow(k)}
          right={<span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginRight: 4 }}>{filterOrders(s.orders, F).length} orders shown below</span>} />
        {view === 'board' && <BoardView s={s} F={F} onOpen={setOpenId} />}
        {view === 'map' && <MapView s={s} F={F} />}
        {view === 'lanes' && <LanesView s={s} F={F} />}
      </div>
      {openId && openOrder && <LOrderSheet order={openOrder} drivers={s.drivers} onReassign={(id, name) => {s.reassign(id, name);s.setFlash(`#${id} → ${name}`);}} onItems={s.setItems} onFlash={s.setFlash} onClose={() => setOpenId(null)} />}
      {taskFlow === 'order' && <NewOrderSheet drivers={s.drivers} onFlash={s.setFlash} onClose={() => setTaskFlow(null)} />}
      {(taskFlow === 'break' || taskFlow === 'meal') && <TaskFlowModal kind={taskFlow} drivers={s.drivers} onClose={() => setTaskFlow(null)} onFlash={s.setFlash} />}
      {settings && <SettingsModal onClose={() => setSettings(false)} onFlash={s.setFlash} />}
      <LToast msg={s.flash} />
    </div>
    </div>
  </React.Fragment>;
}

Object.assign(window, {});