// ── Terminals — consolidated "By location" screen ───────────────────────────
// Store floor (stations) + delivery regions (one driver + one STATIC Credit
// Card Reader each). Search + filters across both. Readers are assigned once
// and stay put — static to a station or static to a region.
const useP = window.useP;
const { STATIONS, REGION_TERMINALS, FLEET, T_REGIONS, T_REGION_BY_ID, regionName, regionColor, attentionFor, READER_POOL, ROSTER } = window.TDATA;
const money = window.HW.fmt.money;

// ── Page header ─────────────────────────────────────────────────────────────
window.TPageHeader = function TPageHeader({ onAdd, onSchedule }) {
  const P = useP();const S = window.TDATA.STORE_T;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, fontSize: 11, fontFamily: P.fontMono, color: P.inkMute, letterSpacing: '.04em' }}>
          <Icon name="settings" size={13} stroke={1.8} /> Settings <Icon name="chevron-right" size={12} /> <span style={{ color: P.ink2, fontWeight: 600 }}>POS Terminals</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 29, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Terminals</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 13, color: P.inkDim }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good }} />{S.name}<span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{S.code}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PBtn variant="secondary" icon="calendar" onClick={onSchedule}>Schedule</PBtn>
        <PBtn variant="secondary" icon="refresh">Sync</PBtn>
        <PBtn variant="accent" icon="plus" onClick={onAdd}>Add terminal</PBtn>
      </div>
    </div>);
};

// ── KPI strip ───────────────────────────────────────────────────────────────
window.TStatStrip = function TStatStrip({ onAttn }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
      <KPI icon="register" label="Stations" value={FLEET.stations} sublabel="this store" />
      <KPI icon="truck" label="Mobile terminals" value={FLEET.mobileOnShift} sublabel={'of ' + FLEET.mobile + ' on shift'} />
      <KPI icon="card" label="Readers to assign" value={FLEET.unassignedReaders} sublabel="unassigned" />
      <KPI icon="bell" label="Needs attention" value={FLEET.needsAttention} accent onClick={onAttn} />
    </div>);
};

// ── Static Credit Card Reader cell (assign / swap) ──────────────────────────
function ReaderCell({ id, reader, onAssign }) {
  const P = useP();
  const [assigning, setAssigning] = React.useState(false);
  if (assigning) return (
    <div style={{ width: '100%', maxWidth: 230 }} onClick={(e) => e.stopPropagation()}>
      <TSelect size="sm" icon="card" placeholder="Pick a reader…" value={null}
      onChange={(v) => {const rd = READER_POOL.find((x) => x.value === v);onAssign(id, { model: rd.model, sn: rd.sn });setAssigning(false);}} options={READER_POOL} />
    </div>);
  if (reader) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
      <Icon name="card" size={14} color={P.inkMute} style={{ flex: '0 0 auto' }} />
      <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reader.model}</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>SN {reader.sn} · static</span></span>
      <PBtn variant="ghost" size="xs" icon="refresh" onClick={() => setAssigning(true)} style={{ marginLeft: 'auto', flex: '0 0 auto' }}>Swap</PBtn>
    </div>);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }} onClick={(e) => e.stopPropagation()}>
      <Pill kind="warn" dot>No reader</Pill>
      <PBtn variant="accent" size="xs" icon="link" onClick={() => setAssigning(true)}>Assign</PBtn>
    </div>);
}

// ── Person cell (station associate) — inline swap, mirrors ReaderCell ───────
function PersonCell({ value, onChange }) {
  const P = useP();const [swapping, setSwapping] = React.useState(false);
  const eligible = ROSTER.filter((p) => p.role !== 'driver').map((p) => ({ value: p.name, label: p.name, sub: p.role === 'manager' ? 'Manager' : 'Cashier' }));
  if (swapping) return (
    <div style={{ width: '100%', maxWidth: 190 }} onClick={(e) => e.stopPropagation()}>
      <TSelect size="sm" icon="user" placeholder="Assign associate…" value={value} options={eligible} onChange={(v) => {onChange(v);setSwapping(false);}} />
    </div>);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
      {value ? <><Avatar name={value} size={22} /><span style={{ fontSize: 12, color: P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value.split(' ')[0]}</span></> : <span style={{ fontStyle: 'italic', color: P.inkMute, fontSize: 12 }}>No sign-in</span>}
      <PBtn variant="ghost" size="xs" icon="refresh" onClick={() => setSwapping(true)} style={{ marginLeft: 'auto', flex: '0 0 auto' }}>Swap</PBtn>
    </div>);
}

// ── Driver cell (mobile) — name + terminal + inline swap ────────────────────
function DriverSwap({ value, onChange, vehicle }) {
  const P = useP();const [sw, setSw] = React.useState(false);
  const eligible = ROSTER.filter((p) => p.role === 'driver').map((p) => ({ value: p.name, label: p.name, sub: 'Driver' }));
  if (sw) return <div style={{ flex: 1, minWidth: 0, maxWidth: 190 }} onClick={(e) => e.stopPropagation()}><TSelect size="sm" icon="user" placeholder="Assign driver…" value={value} options={eligible} onChange={(v) => {onChange(v);setSw(false);}} /></div>;
  return <><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span><span style={{ fontSize: 10.5, color: P.inkMute }}>Mobile terminal · {vehicle}</span></span><PBtn variant="ghost" size="xs" icon="refresh" onClick={() => setSw(true)} style={{ flex: '0 0 auto' }}>Swap</PBtn></>;
}

// ── Station row ─────────────────────────────────────────────────────────────
const STATION_COLS = '1.7fr 1.4fr 2fr 1.2fr 1fr';
function StationRow({ t, reader, onAssign, onOpen }) {
  const P = useP();const tk = window.useTk();
  const [emp, setEmp] = React.useState(t.employee);
  const attn = attentionFor({ ...t, reader });const dl = window.drawerLine(t, tk.drawerModel);
  const pad = tk.density === 'compact' ? '9px 16px' : '13px 16px';
  return (
    <div onClick={onOpen} style={{ display: 'grid', gridTemplateColumns: STATION_COLS, gap: 14, alignItems: 'center', padding: pad, borderTop: `1px solid ${P.hairline}`, cursor: 'pointer', background: attn.some((a) => a.level === 'critical') ? P.badSoft : 'transparent' }}
    onMouseEnter={(e) => {if (!attn.some((a) => a.level === 'critical')) e.currentTarget.style.background = P.surface2;}} onMouseLeave={(e) => {if (!attn.some((a) => a.level === 'critical')) e.currentTarget.style.background = 'transparent';}}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><TypeGlyph kind="station" size={30} /><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{t.name}</span><span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}><Icon name="lock" size={10} style={{ verticalAlign: '-1px' }} /> {t.device.model} · {t.device.tag}</span></span></span>
      <PersonCell value={emp} onChange={setEmp} />
      <ReaderCell id={t.id} reader={reader} onAssign={onAssign} />
      <span style={{ fontSize: 12.5, color: dl.tone === 'bad' ? P.bad : P.ink2, fontFamily: P.fontMono, fontWeight: 600 }}>{dl.value} <span style={{ fontSize: 10.5, color: P.inkMute }}>{dl.label.toLowerCase()}</span></span>
      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>{attn.length ? <AttnPills t={{ ...t, reader }} wrap={false} /> : <Pill kind="good" dot>Ready</Pill>}</span>
    </div>);
}

// ── Mobile-terminal (region) row ────────────────────────────────────────────
const MOBILE_COLS = '1.3fr 1.7fr 1.2fr 2fr 0.9fr 1fr';
function MobileRow({ t, reader, onAssign, onOpen }) {
  const P = useP();const tk = window.useTk();
  const [drv, setDrv] = React.useState(t.name);
  const attn = attentionFor({ ...t, reader });
  const pad = tk.density === 'compact' ? '9px 16px' : '12px 16px';
  const statusMap = { 'on-shift': { k: 'good', l: 'On shift' }, off: { k: 'neutral', l: 'Off shift' }, offline: { k: 'bad', l: 'Offline' } };
  const sm = statusMap[t.status];
  return (
    <div onClick={onOpen} style={{ display: 'grid', gridTemplateColumns: MOBILE_COLS, gap: 14, alignItems: 'center', padding: pad, borderTop: `1px solid ${P.hairline}`, cursor: 'pointer', background: attn.some((a) => a.level === 'critical') ? P.badSoft : 'transparent' }}
    onMouseEnter={(e) => {if (!attn.some((a) => a.level === 'critical')) e.currentTarget.style.background = P.surface2;}} onMouseLeave={(e) => {if (!attn.some((a) => a.level === 'critical')) e.currentTarget.style.background = 'transparent';}}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ width: 34, height: 26, borderRadius: P.r8, background: regionColor(t.region), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, fontWeight: 700, fontSize: 11.5, flex: '0 0 auto' }}>{t.region}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.regionCity}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }} onClick={(e) => e.stopPropagation()}><TypeGlyph kind="mobile" size={30} /><DriverSwap value={drv} onChange={setDrv} vehicle={t.vehicle} /></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: P.inkDim }}><StatusDot online={t.online} size={7} /><span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}><span>{t.device.model}</span><span style={{ fontSize: 9.5, color: P.inkMute, fontFamily: P.fontMono }}>{t.device.tag}</span></span></span>
      <ReaderCell id={t.id} reader={reader} onAssign={onAssign} />
      <span style={{ fontSize: 12.5, color: P.ink2, fontFamily: P.fontMono, fontWeight: 600 }}>{t.status === 'on-shift' ? money(t.bag.collected) : '—'}</span>
      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>{attn.length ? <AttnPills t={{ ...t, reader }} wrap={false} /> : <Pill kind={sm.k} dot>{sm.l}</Pill>}</span>
    </div>);
}

// ── Section shell with header ───────────────────────────────────────────────
// Color-coded zones: stations use the near-black "ink" chip, mobile terminals
// use the Hyperwolf accent — matching their TypeGlyph colors so the two zones
// read at a glance. Bold title + colored rule under the column headers.
function SectionBlock({ icon, tone = 'ink', eyebrow, count, cols, headers, children }) {
  const P = useP();
  const chipBg = tone === 'accent' ? P.accent : P.ink;
  const chipInk = tone === 'accent' ? P.accentInk : P.surface;
  const [title, ...rest] = eyebrow.split(' · ');
  const sub = rest.join(' · ');
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 29, height: 29, borderRadius: P.r8, background: chipBg, color: chipInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={16} stroke={2} /></span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17.5, fontWeight: 700, letterSpacing: '-.015em', color: P.ink }}>{title}</h2>
          {sub && <span style={{ fontSize: 12.5, color: P.inkDim, fontWeight: 500, whiteSpace: 'nowrap' }}>{sub}</span>}
        </div>
        <span style={{ flex: 1, height: 1, background: P.hairline }} />
        <span style={{ fontSize: 11, color: P.ink2, fontFamily: P.fontMono, fontWeight: 600, padding: '4px 10px', background: P.surface3, borderRadius: P.r999, whiteSpace: 'nowrap' }}>{count}</span>
      </div>
      <Card padding={0} style={{ overflow: 'visible' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '11px 16px', background: P.surface2, borderRadius: `${P.r14}px ${P.r14}px 0 0`, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.ink2, borderBottom: `2px solid ${chipBg}` }}>
          {headers.map((h, i) => <span key={i} style={{ textAlign: i === headers.length - 1 ? 'right' : 'left' }}>{h}</span>)}
        </div>
        {children}
      </Card>
    </div>);
}

// ── Toolbar: search + filters ───────────────────────────────────────────────
// Quick facet toggles the ops team asked for — online / offline / no reader /
// needs attention — combined as an OR across whatever is active.
const FLAG_OPTS = [
{ id: 'online', label: 'On shift / online', icon: 'check' },
{ id: 'offline', label: 'Offline', icon: 'x' },
{ id: 'noreader', label: 'No card reader', icon: 'card' },
{ id: 'attention', label: 'Needs attention', icon: 'bell' }];

function FilterChips({ flags, toggle }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {FLAG_OPTS.map((o) => {const on = flags.has(o.id);return (
          <button key={o.id} onClick={() => toggle(o.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: P.r999, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, transition: 'all .12s' }}>
          <Icon name={o.icon} size={13} stroke={2} color={on ? P.surface : P.inkMute} />{o.label}
        </button>);})}
    </div>);
}
function Toolbar({ q, setQ, type, setType, region, setRegion, flags, toggleFlag }) {
  const P = useP();
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px 0 14px', marginBottom: 6, background: P.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 11 }}>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 340 }}><Field icon="search" placeholder="Search stations, drivers, regions…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" /></div>
        <Seg value={type} onChange={setType} size="sm" options={[{ value: 'all', label: 'All' }, { value: 'station', label: 'Stations', icon: 'register' }, { value: 'mobile', label: 'Mobile', icon: 'truck' }]} />
        <div style={{ width: 200 }}><TSelect size="sm" icon="pin" value={region} onChange={setRegion} options={[{ value: 'all', label: 'All regions' }, ...T_REGIONS.map((r) => ({ value: r.id, label: r.id + ' ' + r.name }))]} /></div>
      </div>
      <FilterChips flags={flags} toggle={toggleFlag} />
    </div>);
}

window.VersionByLocation = function VersionByLocation() {
  const P = useP();
  const [add, setAdd] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [reconcile, setReconcile] = React.useState(null);
  const [opening, setOpening] = React.useState(null);
  const [sessions, setSessions] = React.useState(() => {
    const m = {};
    STATIONS.forEach((s) => m[s.id] = { open: s.drawer.state === 'open', at: s.drawer.since || null, who: s.drawer.cashier || s.employee, float: s.drawer.float, id: null, deposits: [] });
    REGION_TERMINALS.forEach((d) => m[d.id] = { open: d.status === 'on-shift', at: null, who: d.employee || d.name, float: d.bag.float, id: null, deposits: [] });
    return m;
  });
  const openSession = (id, r) => setSessions((m) => ({ ...m, [id]: { ...m[id], open: true, at: r.at, who: r.who, float: r.float, id: r.id } }));
  const closeSession = (id, dep) => setSessions((m) => ({ ...m, [id]: { ...m[id], open: false, id: null, deposits: [dep, ...(m[id].deposits || [])] } }));
  const [readerMap, setReaderMap] = React.useState(false);
  const [schedule, setSchedule] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState('all');
  const [region, setRegion] = React.useState('all');
  const [flags, setFlags] = React.useState(() => new Set());
  const toggleFlag = (id) => setFlags((f) => {const n = new Set(f);n.has(id) ? n.delete(id) : n.add(id);return n;});
  const [readers, setReaders] = React.useState(() => {
    const m = {};STATIONS.forEach((s) => m[s.id] = s.reader);REGION_TERMINALS.forEach((d) => m[d.id] = d.reader);return m;
  });
  const assign = (id, rd) => setReaders((m) => ({ ...m, [id]: rd }));

  const ql = q.trim().toLowerCase();
  const matchFlags = (t, online) => {
    if (flags.size === 0) return true;
    const attn = attentionFor({ ...t, reader: readers[t.id] });
    const checks = { online, offline: !online, noreader: !readers[t.id], attention: attn.length > 0 };
    return [...flags].some((f) => checks[f]);
  };
  const stations = STATIONS.filter((s) => type !== 'mobile' && region === 'all' && (
  !ql || s.name.toLowerCase().includes(ql) || (s.employee || '').toLowerCase().includes(ql)) &&
  matchFlags(s, s.online));
  const mobiles = REGION_TERMINALS.filter((d) => type !== 'station' && (
  region === 'all' || d.region === region) && (
  !ql || d.name.toLowerCase().includes(ql) || d.regionCity.toLowerCase().includes(ql) || d.region.toLowerCase().includes(ql)) &&
  matchFlags(d, d.status === 'on-shift'));

  const clearFilters = () => {setQ('');setType('all');setRegion('all');setFlags(new Set());};
  const nothing = stations.length === 0 && mobiles.length === 0;

  return (
    <div style={{ minHeight: '100%', background: P.bg, color: P.ink, fontFamily: P.fontSans, padding: '26px 34px 60px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <TPageHeader onAdd={() => setAdd(true)} onSchedule={() => setSchedule(true)} />
        <TStatStrip onAttn={() => setFlags((f) => {const n = new Set(f);n.add('attention');return n;})} />

        {schedule && <ScheduleStrip onClose={() => setSchedule(false)} />}

        <Toolbar q={q} setQ={setQ} type={type} setType={setType} region={region} setRegion={setRegion} flags={flags} toggleFlag={toggleFlag} />

        {stations.length > 0 && <div>
          <SectionBlock icon="register" tone="ink" eyebrow="Store floor · Lake Elsinore" count={stations.length + ' stations'} cols={STATION_COLS}
          headers={['Station', 'Signed in', 'Credit Card Reader', 'Drawer', 'Status']}>
            {stations.map((s) => <StationRow key={s.id} t={s} reader={readers[s.id]} onAssign={assign} onOpen={() => setDetail({ ...s, reader: readers[s.id] })} />)}
          </SectionBlock>
        </div>}

        {mobiles.length > 0 && <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '11px 14px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={16} color={P.info} /><span style={{ flex: 1, fontSize: 12.5, color: P.ink2, lineHeight: 1.4 }}>Each region has <b>one driver</b> and <b>one static Credit Card Reader</b>. Map the reader to the region once — whoever drives it inherits the setting.</span>
            <PBtn variant="secondary" size="sm" icon="card" onClick={() => setReaderMap((v) => !v)} style={{ flex: '0 0 auto' }}>Map region readers</PBtn>
          </div>
          {readerMap && <RegionReaderPanel readers={readers} onAssign={assign} onClose={() => setReaderMap(false)} />}
          <SectionBlock icon="truck" tone="accent" eyebrow="Delivery regions · mobile terminals" count={mobiles.length + ' of ' + REGION_TERMINALS.length + ' regions'} cols={MOBILE_COLS}
          headers={['Region', 'Driver', 'Device', 'Credit Card Reader', 'Cash', 'Status']}>
            {mobiles.map((d) => <div key={d.id} data-comment-anchor={d.id === 'RC1' ? 'b9ebcdff54-div-37-7' : undefined}><MobileRow t={d} reader={readers[d.id]} onAssign={assign} onOpen={() => setDetail({ ...d, reader: readers[d.id] })} /></div>)}
          </SectionBlock>
        </div>}

        {nothing && <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: P.inkMute, marginBottom: 12 }}>No terminals match your filters.</div>
          <PBtn variant="secondary" size="sm" icon="x" onClick={clearFilters}>Clear filters</PBtn>
        </div>}
      </div>

      {add && <AddTerminal onClose={() => setAdd(false)} />}
      {detail && <TerminalDetail t={detail} session={sessions[detail.id]} events={window.terminalEvents(detail, sessions[detail.id])}
        onClose={() => setDetail(null)}
        onOpenSession={(t) => setOpening(t)}
        onReconcile={(t) => setReconcile(t)} />}
      {opening && <OpenDrawerModal t={opening} onClose={() => setOpening(null)} onOpened={(r) => openSession(opening.id, r)} />}
      {reconcile && <DrawerReconcile t={reconcile} onClose={() => setReconcile(null)} onDeposited={(d) => closeSession(reconcile.id, d)} />}
    </div>);
};