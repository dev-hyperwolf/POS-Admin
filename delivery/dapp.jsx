// ── Delivery page — mimics Terminals: ConnecTeam schedule (full week) + call-offs,
//    plus delivery regions (counties → sub-regions), central settings + overrides,
//    combined KML homescreen map (3 style options) and per-region KML detail.
const useP = window.useP;
const D = window.DDATA;
const money = window.HW.fmt.money;

function countyOf(id) {return D.COUNTY_BY_ID[id.slice(0, 2)];}
function subById(id) {return D.SUBREGIONS.find((s) => s.id === id);}

// ── Page header ─────────────────────────────────────────────────────────────
function PageHeader({ onAdd, mode, onToggleTheme }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, fontSize: 11.5, fontFamily: P.fontMono, color: P.inkMute, letterSpacing: '.04em' }}><Icon name="truck" size={13} stroke={1.8} /> Operations <Icon name="chevron-right" size={12} /> <span style={{ color: P.ink2, fontWeight: 600 }}>Delivery</span></div>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Delivery</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 13.5, color: P.inkDim }}><span style={{ width: 7, height: 7, borderRadius: 99, background: P.good }} />4 counties · {D.SUBREGIONS.length} sub-regions · {D.SUBREGIONS.filter((s) => s.status === 'on').length} drivers on shift</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={onToggleTheme} title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} style={{ width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink2, cursor: 'pointer' }}><Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} stroke={1.9} /></button>
      <PBtn variant="secondary" icon="refresh">Sync</PBtn>
      <PBtn variant="accent" icon="plus" onClick={onAdd}>Add region</PBtn>
    </div>
  </div>;
}

// ── Call-off card (via the call-off form) ───────────────────────────────────
function CallOffCard({ c }) {
  const P = useP();const open = c.status === 'open';const col = open ? P.bad : P.warn;const cty = countyOf(c.region);
  return <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: open ? P.badSoft : P.warnSoft, border: `1px solid ${open ? P.bad : P.hairline2}`, borderRadius: P.r12 }}>
    <span style={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: 9, background: P.surface, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${col}` }}><Icon name="user-off" size={18} stroke={1.9} /></span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{c.driver}</span>
        <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: cty.color, padding: '2px 7px', borderRadius: 6 }}>{c.region}</span>
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{c.shift}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: col }}><span style={{ width: 6, height: 6, borderRadius: 99, background: col }} />Called off · {c.reason}</span>
      </div>
      <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 3 }}>Submitted via call-off form · {c.at}{c.cover ? ` · covered by ${c.cover}` : ''}</div>
    </div>
    {open ? <PBtn variant="accent" size="sm" icon="user-check">Cover shift</PBtn> : <Pill kind="good" dot>Covered</Pill>}
  </div>;
}

// ── Schedule — synced from ConnecTeam, full week + call-offs ────────────────
function ScheduleWeek() {
  const P = useP();
  const [day, setDay] = React.useState('tue');
  const list = D.SCHEDULE_WK[day];
  const working = list.filter((p) => !p.off);const off = list.filter((p) => p.off);
  const dayCalloffs = D.CALLOFFS.filter((c) => c.day === day);
  const openCalloffs = dayCalloffs.filter((c) => c.status === 'open');
  const calledOffNames = new Set(dayCalloffs.map((c) => c.driver));
  const meta = D.WEEK.find((d) => d.key === day);
  const startMin = (tm) => {const m = (tm || '').match(/^(\d+):(\d+)([ap])/);if (!m) return 9999;let h = +m[1] % 12;if (m[3] === 'p') h += 12;return h * 60 + +m[2];};
  const groups = {};
  working.forEach((p) => {const k = p.region ? p.region.slice(0, 2) : 'x';(groups[k] = groups[k] || []).push(p);});
  Object.values(groups).forEach((a) => a.sort((x, y) => startMin(x.time) - startMin(y.time)));

  const Tile = ({ p }) => {
    const cty = p.region ? countyOf(p.region) : null;const calledOff = calledOffNames.has(p.name);
    return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: calledOff ? P.badSoft : P.surface, border: `1px solid ${calledOff ? P.bad : P.hairline2}`, borderRadius: P.r10 }}>
      <Avatar name={p.name} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          {calledOff ? <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.bad }}>Called off</span> : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: P.mode === 'dark' ? P.accent : '#7A5A00' }}>Driver</span>}
          {p.time && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, textDecoration: calledOff ? 'line-through' : 'none' }}>{p.time}</span>}
        </div>
      </div>
      {cty && <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: cty.color, padding: '3px 8px', borderRadius: P.r8, opacity: calledOff ? .5 : 1 }}>{p.region}</span>}
    </div>;
  };

  return <div>
    {/* Schedule strip */}
    <div style={{ background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: P.r8, background: P.ink, color: P.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="calendar" size={16} stroke={2} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, letterSpacing: '.05em' }}>SYNCED FROM CONNECTEAM</div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>Driver schedule</h2>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{meta.date} · {working.length} on · {off.length} off{dayCalloffs.length ? ` · ${dayCalloffs.length} called off` : ''}</span>
      </div>
      {/* week tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 18px', borderBottom: `1px solid ${P.hairline}`, overflowX: 'auto' }}>
        {D.WEEK.map((d) => {const on = day === d.key;const co = D.CALLOFFS.some((c) => c.day === d.key);return (
            <button key={d.key} onClick={() => setDay(d.key)} style={{ position: 'relative', flex: '1 0 auto', minWidth: 104, padding: '11px 15px', borderRadius: P.r10, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{d.label}{d.today && <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 5, color: on ? P.accent : P.good }}>TODAY</span>}</div>
            <div style={{ fontSize: 11.5, fontFamily: P.fontMono, opacity: .72, marginTop: 2 }}>{d.date}</div>
            {co && <span style={{ position: 'absolute', top: 6, right: 8, width: 6, height: 6, borderRadius: 99, background: P.bad }} />}
          </button>);})}
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {D.COUNTIES.filter((c) => groups[c.id]).map((c) =>
        <div key={c.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{c.name}</span>
              <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{groups[c.id].length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 10 }}>{groups[c.id].map((p, i) => <Tile key={i} p={p} />)}</div>
          </div>)}
        {off.length > 0 && <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim, marginTop: 4 }}>Off · {off.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 10 }}>{off.map((p, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, opacity: .55 }}><Avatar name={p.name} size={30} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{p.name}</div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: P.inkMute }}>Driver</div></div><Pill kind="neutral">Off</Pill></div>)}</div>
        </>}
      </div>
    </div>

    {/* Call-offs — beneath the schedule */}
    {dayCalloffs.length > 0 && <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ width: 29, height: 29, borderRadius: P.r8, background: P.bad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-off" size={16} stroke={2} /></span>
        <h2 style={{ margin: 0, fontSize: 17.5, fontWeight: 700, letterSpacing: '-.015em', color: P.ink }}>Call-offs</h2>
        {openCalloffs.length > 0 && <Pill kind="bad" dot>{openCalloffs.length} need cover</Pill>}
        <span style={{ flex: 1, height: 1, background: P.hairline }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 10 }}>
        {dayCalloffs.map((c, i) => <CallOffCard key={i} c={c} />)}
      </div>
    </div>}
  </div>;
}

// ── Setting cell — value + central/override tag ─────────────────────────────
function SettingRow({ label, value, overridden }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{value}</span>
      {overridden ? <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.mode === 'dark' ? P.accent : '#7A5A00', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: 5, padding: '1px 5px' }}>Override</span> : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>central</span>}
    </div>
  </div>;
}
function fmtTime(t) {const m = String(t).trim().match(/^(\d{1,2}):(\d{2})([ap])$/);return m ? `${+m[1]}:${m[2]} ${m[3] === 'a' ? 'AM' : 'PM'}` : t;}
function fmtHrs(s) {return String(s).split('–').map((x) => fmtTime(x)).join(' – ');}
function settingsCells(sr) {
  const s = D.effSettings(sr);const o = D.overriddenKeys(sr);
  return [
  { label: 'Hours', value: fmtHrs(`${s.open}–${s.close}`), overridden: o.includes('open') || o.includes('close') },
  { label: 'Min order', value: money(s.min), overridden: o.includes('min') },
  { label: 'Delivery fee', value: s.fee === 0 ? 'Free' : money(s.fee), overridden: o.includes('fee') },
  { label: 'Buffer', value: `${s.buffer} mi`, overridden: o.includes('buffer') }];

}

// ── Weedmaps — pins are one-per-city. At scale that's 30-40 delivery pins, so:
//    tabbed (delivery / pickup), named by city, searchable, each pin carrying
//    its own parameters. Account credentials are shared by every pin.
function WmParam({ label, value, mono }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
    <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
  </div>;
}
function WmPinRow({ pin, expanded, onToggle }) {
  const P = useP();
  const accent = pin.kind === 'Pickup' ? P.warn : P.info;
  return <div style={{ flexShrink: 0, border: `1px solid ${expanded ? P.hairline2 : P.hairline}`, borderRadius: P.r10, overflow: 'hidden', background: expanded ? P.surface2 : P.surface }}>
    <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', background: 'transparent', border: 'none', borderLeft: `3px solid ${accent}`, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, background: pin.cty ? pin.cty.color : P.surface3, color: pin.cty ? '#fff' : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={pin.kind === 'Pickup' ? 'shop' : 'truck'} size={14} stroke={1.9} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pin.city}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{pin.kind} · {pin.cty ? pin.cty.name : pin.store} · wmid {pin.wmid}</div>
      </div>
      <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{pin.ext}</span>
      {pin.live ? <Pill kind="good" dot>Live</Pill> : <Pill kind="warn" dot>Paused</Pill>}
      <Icon name="chevron-down" size={15} stroke={2.2} color={P.inkMute} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: '0 0 auto' }} />
    </button>
    {expanded && <div style={{ padding: '4px 13px 14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 7px', borderRadius: 99 }}><span style={{ width: 5, height: 5, borderRadius: 2, background: '#fff' }} />Fetched from Weedmaps</span>
            <span style={{ fontSize: 11.5, color: P.inkMute }}>read-only · issued & owned by the WM pin</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px 16px', padding: '12px 14px' }}>
            <WmParam label="WM pin ID" value={pin.pinId} mono />
            <WmParam label="Menu ID" value={pin.menu} mono />
            <WmParam label="Pin status" value={pin.live ? 'Published' : 'Paused'} />
            <WmParam label="Pin location" value={`${pin.lat}, ${pin.lng}`} mono />
            <WmParam label="Sync token" value={pin.token} mono />
            <WmParam label="Listing URL" value={pin.url} mono />
            <WmParam label="Last sync" value={pin.sync} mono />
          </div>
        </div>
        <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: P.mode === 'dark' ? P.accent : '#7A5A00', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, padding: '2px 7px', borderRadius: 99 }}><Icon name="pin" size={10} stroke={2} />Set in Hyperwolf</span>
            <span style={{ fontSize: 11.5, color: P.inkMute }}>we set these · pushed to the pin</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px 16px', padding: '12px 14px' }}>
            <WmParam label="external_id" value={pin.ext} mono />
            <WmParam label={pin.kind === 'Pickup' ? 'Linked store' : 'Linked region'} value={pin.kind === 'Pickup' ? pin.store : pin.city} />
            <WmParam label="Hours" value={fmtHrs(pin.hours)} mono />
            <WmParam label="Min order" value={pin.min ? '$' + pin.min : 'None'} mono />
            {pin.kind !== 'Pickup' && <WmParam label="Delivery fee" value={pin.fee ? '$' + pin.fee : 'Free'} mono />}
            <WmParam label={pin.kind === 'Pickup' ? 'Fulfilment' : 'Service radius'} value={pin.radius} mono />
            <WmParam label="Availability" value={pin.kind === 'Pickup' ? 'store on-hand' : 'on-shift kits'} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <PBtn variant="secondary" size="sm" icon="refresh">Re-sync pin</PBtn>
        <PBtn variant="ghost" size="sm" icon="link">Open on Weedmaps</PBtn>
        <span style={{ fontSize: 11.5, color: P.inkMute, marginLeft: 'auto' }}>Parameters are scoped to this pin.</span>
      </div>
    </div>}
  </div>;
}
function AddWmPinModal({ kind, onClose, onSave }) {
  const P = useP();
  const [city, setCity] = React.useState('');
  const [assoc, setAssoc] = React.useState('');
  const [pinId, setPinId] = React.useState('');
  const [menuId, setMenuId] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const inp = { width: '100%', padding: '10px 12px', background: P.field || P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, outline: 'none' };
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, display: 'block', marginBottom: 6 };
  const save = () => {if (!city.trim()) return;onSave({ city: city.trim(), assoc: assoc.trim(), pinId: pinId.trim(), menuId: menuId.trim(), apiKey: apiKey.trim() });};
  return <div onClick={onClose} style={window.overlayScrim(P, { z: 90, padding: 20 })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(420px,96vw)', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>New {kind.toLowerCase()} pin</span>
        <div style={{ flex: 1 }} /><IconBtn icon="x" onClick={onClose} />
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><span style={lbl}>City</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Pasadena" style={inp} autoFocus /></div>
        <div><span style={lbl}>{kind === 'Pickup' ? 'Store' : 'County / region'}</span><input value={assoc} onChange={(e) => setAssoc(e.target.value)} placeholder={kind === 'Pickup' ? 'e.g. Hyperwolf' : 'e.g. Los Angeles County'} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={lbl}>WM pin ID <span style={{ textTransform: 'none', color: P.inkFaint, fontWeight: 600 }}>· optional</span></span><input value={pinId} onChange={(e) => setPinId(e.target.value)} placeholder="PIN-00000" style={{ ...inp, fontFamily: P.fontMono, fontSize: 13.5 }} /></div>
          <div><span style={lbl}>Menu ID <span style={{ textTransform: 'none', color: P.inkFaint, fontWeight: 600 }}>· optional</span></span><input value={menuId} onChange={(e) => setMenuId(e.target.value)} placeholder="menu_del_xxxx" style={{ ...inp, fontFamily: P.fontMono, fontSize: 13.5 }} /></div>
        </div>
        <div><span style={lbl}>API / sync key <span style={{ textTransform: 'none', color: P.inkFaint, fontWeight: 600 }}>· optional</span></span><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="ptok_••••••••" style={{ ...inp, fontFamily: P.fontMono, fontSize: 13.5 }} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.surface2, borderRadius: P.r10, fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}><Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} /><span>Paste an existing pin&rsquo;s ID, menu ID &amp; API key to <b style={{ color: P.ink2 }}>link</b> it now — or leave blank and Weedmaps issues them on create, starting <b style={{ color: P.ink2 }}>paused</b> until first sync.</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 18px 18px' }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="plus" onClick={save}>Create pin</PBtn>
      </div>
    </div>
  </div>;
}
function WeedmapsPanel({ regions }) {
  const P = useP();
  const [tab, setTab] = React.useState('delivery');
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(null);
  const [added, setAdded] = React.useState([]);
  const [adding, setAdding] = React.useState(false);
  const hash = (s) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  const deliveryPins = regions.map((r) => {const cty = countyOf(r.id);const h = hash(r.id);return {
      key: 'd-' + r.id, kind: 'Delivery', city: r.city || r.id, cty,
      wmid: String(342170000 + h % 9000), ext: `HW-DEL-${r.id}`, menu: `menu_del_${r.id.toLowerCase()}`,
      pinId: 'PIN-' + String(342170000 + h % 9000).slice(-5), lat: (33.7 + h % 45 / 100).toFixed(4), lng: (-118.35 + h % 100 / 100).toFixed(4), token: 'ptok_' + (h * 31 % 99999).toString(36) + 'x9', url: `weedmaps.com/deliveries/hw-${r.id.toLowerCase()}`,
      live: r.kml !== false, hours: `${8 + h % 3}:00a–${8 + h % 4}:00p`, min: [40, 50, 60][h % 3], fee: [0, 5, 8][h % 3],
      radius: `${4 + h % 5} mi`, sync: ['just now', '2m ago', '11m ago', '1h ago'][h % 4] };});
  const STORE_PINS = [{ key: 'lb', city: 'Long Beach', store: 'Stilo Supply' }, { key: 'cor', city: 'Corona', store: 'CHKN N WAFFLEZ' }, { key: 'weho', city: 'West Hollywood', store: 'Hyperwolf' }, { key: 'le', city: 'Lake Elsinore', store: 'Hyperwolf' }];
  const pickupPins = STORE_PINS.map((s) => {const h = hash(s.key);return {
      key: 'p-' + s.key, kind: 'Pickup', city: s.city, store: s.store, cty: null,
      wmid: String(342180000 + h % 9000), ext: `HW-PU-${s.key.toUpperCase()}`, menu: `menu_pu_${s.key}`,
      pinId: 'PIN-' + String(342180000 + h % 9000).slice(-5), lat: (33.8 + h % 40 / 100).toFixed(4), lng: (-118.3 + h % 90 / 100).toFixed(4), token: 'ptok_' + (h * 17 % 99999).toString(36) + 'p4', url: `weedmaps.com/dispensaries/hw-${s.key}`,
      live: true, hours: '9:00a–9:00p', min: 0, fee: 0, radius: 'in-store', sync: ['just now', '4m ago', '18m ago'][h % 3] };});

  const allDelivery = [...deliveryPins, ...added.filter((p) => p.kind === 'Delivery')];
  const allPickup = [...pickupPins, ...added.filter((p) => p.kind === 'Pickup')];
  const pins = tab === 'delivery' ? allDelivery : allPickup;
  const addPin = ({ city, assoc }) => {
    const isPickup = tab === 'pickup';const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pin';const h = hash(slug + Date.now());
    const np = { key: (isPickup ? 'p-' : 'd-') + slug + '-' + h % 999, kind: isPickup ? 'Pickup' : 'Delivery', city, store: isPickup ? assoc || 'Hyperwolf' : undefined, cty: isPickup ? null : { name: assoc || 'Unassigned county', color: P.info },
      wmid: String((isPickup ? 342180000 : 342170000) + h % 9000), ext: `${isPickup ? 'HW-PU' : 'HW-DEL'}-${slug.toUpperCase().replace(/-/g, '').slice(0, 8)}`, menu: `menu_${isPickup ? 'pu' : 'del'}_${slug}`,
      pinId: 'PIN-' + String(10000 + h % 89999), lat: (33.7 + h % 45 / 100).toFixed(4), lng: (-118.35 + h % 100 / 100).toFixed(4), token: 'ptok_' + (h * 31 % 99999).toString(36) + 'x9', url: `weedmaps.com/${isPickup ? 'dispensaries' : 'deliveries'}/hw-${slug}`,
      live: false, hours: '9:00a–9:00p', min: isPickup ? 0 : 50, fee: isPickup ? 0 : 5, radius: isPickup ? 'in-store' : '5 mi', sync: 'never' };
    setAdded((a) => [...a, np]);setAdding(false);setOpen(np.key);
  };
  const filtered = pins.filter((p) => !q || p.city.toLowerCase().includes(q.toLowerCase()) || p.ext.toLowerCase().includes(q.toLowerCase()));
  const liveCount = pins.filter((p) => p.live).length;
  const creds = [
  { k: 'OAuth client', v: 'wm_live_8f3a…c21', note: 'client_credentials · auto-renews' },
  { k: 'Access token', v: 'expires 11d', note: 'rotated nightly' },
  { k: 'Webhook secret', v: 'whsec_…9d2', note: 'HMAC-verified' },
  { k: 'Merchant ID', v: 'HW-CA-0001', note: 'partner account' }];

  const TabBtn = ({ id, label, n }) => {const on = tab === id;return <button onClick={() => {setTab(id);setOpen(null);}} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: P.r999, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700 }}><Icon name={id === 'pickup' ? 'shop' : 'truck'} size={14} stroke={1.9} />{label}<span style={{ fontSize: 11.5, fontFamily: P.fontMono, opacity: .7 }}>{n}</span></button>;};

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* account credentials — shared by every pin */}
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Account credentials</span><Icon name="lock" size={13} color={P.inkMute} /><span style={{ fontSize: 11.5, color: P.inkDim }}>One partner account — shared by all {allDelivery.length + allPickup.length} pins. Menu, hours &amp; availability are set per pin below.</span></div>
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
        {creds.map((c) => <div key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good, flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>{c.k}</div><div style={{ fontSize: 10, color: P.inkMute }}>{c.note}</div></div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>{c.v}</span>
        </div>)}
      </div>
    </div>

    {/* pins — tabbed, named by city, searchable, each with its own parameters */}
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Weedmaps pins</span>
        <span style={{ fontSize: 11.5, color: P.inkDim }}>One pin per city · {liveCount}/{pins.length} live</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#1F5FC0' }} />from Weedmaps</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: P.accent }} />set here</span></span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}><TabBtn id="delivery" label="Delivery" n={allDelivery.length} /><TabBtn id="pickup" label="Pickup" n={allPickup.length} /></div>
      </div>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}><Field icon="search" placeholder="Search pins by city or external_id…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" /></div>
        <PBtn variant="accent" size="sm" icon="plus" onClick={() => setAdding(true)}>Add {tab} pin</PBtn>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 520, overflowY: 'auto' }}>
        {filtered.map((p) => <WmPinRow key={p.key} pin={p} expanded={open === p.key} onToggle={() => setOpen(open === p.key ? null : p.key)} />)}
        {filtered.length === 0 && <div style={{ padding: '26px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No pins match “{q}”.</div>}
      </div>
    </div>
    {adding && <AddWmPinModal kind={tab === 'pickup' ? 'Pickup' : 'Delivery'} onClose={() => setAdding(false)} onSave={addPin} />}
  </div>;
}

// ── Regions home — combined map (3 options) + county/sub-region list ────────
function RegionsHome({ onOpen, regions }) {
  const P = useP();
  const [mode, setMode] = React.useState('filled');
  const [buffer, setBuffer] = React.useState(true);
  const [labels, setLabels] = React.useState(true);
  const [pins, setPins] = React.useState(true);
  const modes = [{ value: 'filled', label: 'Filled zones' }, { value: 'outline', label: 'Outline + buffer' }, { value: 'grouped', label: 'Grouped by county' }];
  const Toggle = ({ on, set, children }) => <button onClick={() => set((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r999, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5, fontWeight: 600 }}><Icon name={on ? 'check' : 'x'} size={12} stroke={2.4} color={on ? P.surface : P.inkMute} />{children}</button>;

  return <div>
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Coverage map · 3 options</span>
        <div style={{ flex: 1 }} />
        <Seg value={mode} onChange={setMode} size="sm" options={modes} />
        <Toggle on={buffer} set={setBuffer}>Buffer</Toggle>
        <Toggle on={labels} set={setLabels}>Labels</Toggle>
        <Toggle on={pins} set={setPins}>Drivers</Toggle>
      </div>
      <window.DeliveryMap mode={mode} showBuffer={buffer} showLabels={labels} showPins={pins} height={500} />
      <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>{mode === 'filled' ? 'Option 1 — every sub-region filled with its county color, solid KML border, dashed buffer zone, and a name pill. Best for reading coverage density at a glance.' : mode === 'outline' ? 'Option 2 — transparent fills with bold KML outlines and prominent dashed buffer rings. Ops-focused; buffer overlap between regions reads clearly.' : 'Option 3 — sub-regions merged under a soft county halo with one big county label. Best for the portfolio view across all four counties.'}</div>
    </div>

    {/* counties + sub-regions */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {D.COUNTIES.map((c) => {
        const subs = regions.filter((s) => s.county === c.id);
        return <div key={c.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
            <span style={{ width: 29, height: 29, borderRadius: P.r8, background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, fontWeight: 800, fontSize: 12.5 }}>{c.id}</span>
            <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, letterSpacing: '-.015em', color: P.ink }}>{c.name}</h2>
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{subs.length} sub-regions</span>
            <span style={{ flex: 1, height: 1, background: P.hairline }} />
            {/* central settings summary */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              {[['clock', fmtHrs(`${c.settings.open}–${c.settings.close}`), P.info], ['wallet', `min ${money(c.settings.min)}`, P.good], ['truck', `fee ${c.settings.fee === 0 ? 'Free' : money(c.settings.fee)}`, P.warn], ['pin', `buffer ${c.settings.buffer}mi`, P.ink2]].map(([ic, tx, col]) => <span key={tx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: col, background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: 99, padding: '4px 10px', fontFamily: P.fontMono }}><Icon name={ic} size={12} stroke={2} color={col} />{tx}</span>)}
            </span>
          </div>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {subs.map((s, i) => {
              const cells = settingsCells(s);const anyOverride = D.overriddenKeys(s).length > 0;
              return <div key={s.id} onClick={() => onOpen(s.id)} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.3fr repeat(4,0.9fr) 0.7fr', gap: 14, alignItems: 'center', padding: '13px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#fff', background: c.color, padding: '3px 8px', borderRadius: P.r8 }}>{s.id}</span>
                  <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{s.city}</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{s.kml ? 'KML uploaded' : 'no KML'}</span></span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Avatar name={s.driver} size={24} /><span style={{ fontSize: 12.5, color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.driver}</span></span>
                {cells.map((cell) => <SettingRow key={cell.label} {...cell} />)}
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>{s.status === 'on' ? <Pill kind="good" dot>On</Pill> : <Pill kind="neutral" dot>Off</Pill>}<Icon name="chevron-right" size={15} color={P.inkFaint} /></span>
              </div>;
            })}
          </Card>
        </div>;
      })}
    </div>
  </div>;
}

// ── Editable setting — inline input with central/override state ─────────────
function EditableSetting({ label, prefix, suffix, value, overridden, onChange, onReset }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim }}>{label}</span>
      {overridden ? <button onClick={onReset} title="Reset to central value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.mode === 'dark' ? P.accent : '#7A5A00', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: 99, padding: '2px 7px', cursor: 'pointer' }}>Overridden<Icon name="x" size={10} stroke={2.6} /></button> : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute, border: `1px solid ${P.hairline2}`, borderRadius: 99, padding: '2px 7px' }}>Central</span>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: P.surface, border: `1px solid ${overridden ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, padding: '0 11px', height: 40, minWidth: 0 }}>
      {prefix && <span style={{ fontSize: 15, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, marginRight: 2 }}>{prefix}</span>}
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', color: P.ink, fontSize: 16, fontWeight: 700, fontFamily: P.fontMono, padding: 0 }} />
      {suffix && <span style={{ fontSize: 13.5, fontWeight: 600, color: P.inkMute, fontFamily: P.fontMono, marginLeft: 4 }}>{suffix}</span>}
    </div>
  </div>;
}

// ── KML list — multiple files per region, each toggleable on/off ────────────
function KmlList({ region, color, onChange }) {
  const P = useP();
  const kmls = region.kmls || [];
  const toggle = (i) => onChange({ ...region, kmls: kmls.map((k, j) => j === i ? { ...k, on: !k.on } : k) });
  const del = (i) => onChange({ ...region, kmls: kmls.filter((_, j) => j !== i) });
  const add = () => {
    const n = kmls.length + 1;
    onChange({ ...region, kml: true, kmls: [...kmls, { id: 'k' + Date.now(), name: `kml-${region.id.replace('-', '')}-${n}.kml`, on: true }] });
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    {kmls.length === 0 && <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12.5, color: P.inkMute, border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10 }}>No KML files yet — add one to draw this region.</div>}
    {kmls.map((k, i) => <div key={k.id || i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: P.surface2, border: `1px solid ${k.on ? P.hairline2 : P.hairline}`, borderRadius: P.r10, opacity: k.on ? 1 : .6 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: k.on ? color : P.inkFaint, flex: '0 0 auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{k.on ? 'active · routing enabled' : 'hidden · not routing'}</div>
      </div>
      <button onClick={() => toggle(i)} title={k.on ? 'Turn off' : 'Turn on'} style={{ position: 'relative', width: 40, height: 23, borderRadius: 99, border: 'none', cursor: 'pointer', background: k.on ? P.good : P.hairline3, transition: 'background .15s', flex: '0 0 auto' }}>
        <span style={{ position: 'absolute', top: 2.5, left: k.on ? 20 : 2.5, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
      </button>
      <button onClick={() => del(i)} title="Remove" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute, display: 'flex', padding: 4 }}><Icon name="trash" size={15} stroke={1.9} /></button>
    </div>)}
    <button onClick={add} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 12px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', color: P.ink2, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><Icon name="upload" size={15} stroke={1.9} />Add KML file</button>
  </div>;
}

// ── Add region modal ────────────────────────────────────────────────────────
function AddRegionModal({ regions, onClose, onSave }) {
  const P = useP();
  const [county, setCounty] = React.useState('LA');
  const [city, setCity] = React.useState('');
  const [newCty, setNewCty] = React.useState(false);
  const [newCtyName, setNewCtyName] = React.useState('');
  const NEW_COLORS = ['#3B7DD8', '#C065C0', '#2FA98C', '#D98A2B', '#7A5AD9', '#D2483F'];
  const newCountyId = () => {const base = (newCtyName.trim().match(/\b\w/g) || ['C', 'O']).join('').slice(0, 2).toUpperCase() || 'CO';let cid = base,n = 1;while (D.COUNTY_BY_ID[cid]) {cid = base[0] + n;n++;}return cid;};
  const nextId = () => {
    const n = regions.filter((r) => r.county === county).length + 1;
    return `${county}-${String(n).padStart(2, '0')}`;
  };
  const id = newCty ? `${newCountyId()}-01` : nextId();
  const hex = (() => {const cx = 460 + regions.length % 3 * 40,cy = 300 + regions.length % 2 * 40,r = 66;return Array.from({ length: 6 }, (_, i) => {const a = Math.PI / 6 + i * Math.PI / 3;return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];});})();
  const cty = newCty ? { id: '__new', name: newCtyName.trim() || 'New county', color: NEW_COLORS[D.COUNTIES.length % NEW_COLORS.length], settings: { open: '9:00a', close: '9:00p', min: 50, fee: 0, buffer: 2 } } : D.COUNTY_BY_ID[county];
  const save = () => {
    let countyId = county;
    if (newCty) {
      countyId = newCountyId();
      if (!D.COUNTY_BY_ID[countyId]) {const nc = { id: countyId, name: newCtyName.trim() || 'New county', color: cty.color, settings: cty.settings };D.COUNTIES.push(nc);D.COUNTY_BY_ID[countyId] = nc;}
    }
    const rid = newCty ? `${countyId}-01` : id;
    onSave({ id: rid, county: countyId, city: city.trim() || rid, driver: 'Unassigned', status: 'on', kml: false, pts: hex, override: {}, kmls: [] });
  };
  const inp = { width: '100%', height: 42, border: `1px solid ${P.hairline2}`, background: P.surface, borderRadius: P.r10, padding: '0 12px', fontSize: 13.5, color: P.ink, fontFamily: P.fontSans, outline: 'none' };
  const lbl = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim, marginBottom: 6, display: 'block' };

  return <div onClick={onClose} style={window.overlayScrim(P, { z: 90, padding: '60px 20px' })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(480px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: cty.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="map" size={17} stroke={1.9} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>Add region</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>New sub-region · {id}</div></div>
        <IconBtn icon="x" size={17} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div><span style={lbl}>County</span>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {D.COUNTIES.map((c) => {const on = !newCty && county === c.id;return <button key={c.id} onClick={() => {setNewCty(false);setCounty(c.id);}} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r999, border: `1px solid ${on ? c.color : P.hairline2}`, background: on ? c.color : P.surface, color: on ? '#fff' : P.ink2, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><span style={{ width: 8, height: 8, borderRadius: 2, background: on ? '#fff' : c.color }} />{c.name}</button>;})}
            <button onClick={() => setNewCty(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r999, border: `1px dashed ${newCty ? cty.color : P.hairline3}`, background: newCty ? cty.color : P.surface, color: newCty ? '#fff' : P.info, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: P.fontSans }}><Icon name="plus" size={13} stroke={2.4} color={newCty ? '#fff' : P.info} />New county</button>
          </div>
          {newCty && <input value={newCtyName} onChange={(e) => setNewCtyName(e.target.value)} placeholder="New county name (e.g. San Diego County)" style={{ ...inp, marginTop: 8 }} autoFocus />}
        </div>
        <div><span style={lbl}>City / area name</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Riverside" style={inp} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}><Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto' }} /><span>Inherits <b style={{ color: P.ink2 }}>{cty.name}</b> central settings ({cty.settings.open}–{cty.settings.close} · min {money(cty.settings.min)} · buffer {cty.settings.buffer}mi). Add KMLs and override settings after creating.</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline2}` }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="plus" onClick={save}>Create region</PBtn>
      </div>
    </div>
  </div>;
}

// ── Region detail — loud driver, editable settings, multiple KMLs ───────────
function RegionDetail({ region, onBack, onChange }) {
  const P = useP();const s = region;const c = countyOf(s.id);
  const central = D.COUNTY_BY_ID[s.county].settings;const eff = D.effSettings(s);
  const setField = (key, raw) => {
    let v = raw;
    if (key === 'min' || key === 'fee' || key === 'buffer') {v = raw === '' ? 0 : Number(String(raw).replace(/[^0-9.]/g, '')) || 0;}
    onChange({ ...s, override: { ...s.override, [key]: v } });
  };
  const reset = (key) => {const o = { ...s.override };delete o[key];onChange({ ...s, override: o });};
  const ov = (key) => key in (s.override || {});
  const fields = [
  { key: 'open', label: 'Open', value: eff.open },
  { key: 'close', label: 'Close', value: eff.close },
  { key: 'min', label: 'Min order', prefix: '$', value: eff.min },
  { key: 'fee', label: 'Delivery fee', prefix: '$', value: eff.fee },
  { key: 'buffer', label: 'Buffer', suffix: 'mi', value: eff.buffer }];


  return <div>
    <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, padding: 0, marginBottom: 16 }}><Icon name="chevron-left" size={17} stroke={2.2} />Back to regions</button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, marginBottom: 16, boxShadow: P.shadowSm, flexWrap: 'wrap' }}>
      <span style={{ width: 46, height: 46, borderRadius: P.r10, background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, fontWeight: 800, fontSize: 15 }}>{s.id}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: P.ink }}>{s.city}</span>{s.status === 'on' ? <Pill kind="good" dot>On shift</Pill> : <Pill kind="neutral" dot>Off</Pill>}</div>
        <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{c.name}</div>
      </div>
      <PBtn variant="accent" size="md" icon="check">Save</PBtn>
    </div>

    {/* LOUD driver callout — driver changes every day */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '15px 18px', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: P.r16, marginBottom: 16 }}>
      <Avatar name={s.driver} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 800, letterSpacing: '.11em', textTransform: 'uppercase', color: P.mode === 'dark' ? P.accent : '#7A5A00' }}><Icon name="truck" size={14} stroke={2.2} />Today&rsquo;s driver</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.15, marginTop: 2 }}>{s.driver}</div>
        <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 3 }}>Rotates daily · pulled from the ConnecTeam schedule. Check the Schedule section for who covers {s.id} on other days.</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: '#fff', background: c.color, padding: '6px 12px', borderRadius: P.r999, flex: '0 0 auto' }}><span style={{ width: 7, height: 7, borderRadius: 99, background: '#fff' }} />{s.id}</span>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 16, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        <window.DeliveryMap mode="filled" focus={s.id} showBuffer showLabels showPins height={460} />
        <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>The <b style={{ color: P.ink2 }}>{s.id}</b> zone is shown in {c.name}&rsquo;s color with a dashed <b style={{ color: P.ink2 }}>{eff.buffer}-mile buffer</b> extending outward — orders inside the buffer still route to this region.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card padding={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="settings" size={15} stroke={2} /></span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Delivery settings</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Inherited from {c.id} · edit any field to override</div></div>
          </div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {fields.map((f) => <EditableSetting key={f.key} label={f.label} prefix={f.prefix} suffix={f.suffix} value={f.value} overridden={ov(f.key)} onChange={(v) => setField(f.key, v)} onReset={() => reset(f.key)} />)}
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}><Icon name="info" size={15} color={P.info} style={{ flex: '0 0 auto' }} /><span><b style={{ color: P.ink2 }}>Central</b> values come from {c.name} ({central.open}–{central.close} · min {money(central.min)} · buffer {central.buffer}mi). Editing a field creates an <b style={{ color: P.ink2 }}>override</b> for {s.id} only; reset any override to fall back to central.</span></div>
          </div>
        </Card>
        <Card padding={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>KML files</div><div style={{ fontSize: 11.5, color: P.inkDim }}>{(s.kmls || []).filter((k) => k.on).length} active · toggle any on / off</div></div>
          </div>
          <div style={{ padding: 16 }}>
            <KmlList region={s} color={c.color} onChange={onChange} />
          </div>
        </Card>
      </div>
    </div>
  </div>;
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionBanner({ icon, title, sub }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
    <span style={{ width: 32, height: 32, borderRadius: P.r8, background: P.ink, color: P.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={17} stroke={2} /></span>
    <div><h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em', color: P.ink }}>{title}</h2>{sub && <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 1 }}>{sub}</div>}</div>
    <span style={{ flex: 1, height: 1, background: P.hairline }} />
  </div>;
}

// ── App shell ───────────────────────────────────────────────────────────────
window.DeliveryApp = function DeliveryApp() {
  const [mode, setMode] = React.useState(() => {try {return localStorage.getItem('hw-pos-theme') || 'light';} catch (e) {return 'light';}});
  React.useEffect(() => {try {localStorage.setItem('hw-pos-theme', mode);} catch (e) {}document.documentElement.style.background = window.THEMES[mode].bg;}, [mode]);
  const themeValue = React.useMemo(() => ({ mode, P: window.THEMES[mode], setMode, toggle: () => setMode((m) => m === 'light' ? 'dark' : 'light') }), [mode]);
  const P = window.THEMES[mode];
  const [focus, setFocus] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const [regions, setRegions] = React.useState(() => D.SUBREGIONS.map((s) => ({
    ...s, override: { ...s.override },
    kmls: s.kml ? [{ id: 'k-' + s.id, name: `kml-${s.id.replace('-', '')}.kml`, on: true }] : []
  })));
  const updateRegion = (next) => setRegions((rs) => rs.map((r) => r.id === next.id ? next : r));
  const addRegion = (r) => {setRegions((rs) => [...rs, r]);setAdding(false);setFocus(r.id);};
  const focused = focus ? regions.find((r) => r.id === focus) : null;

  return <window.ThemeCtx.Provider value={themeValue}><div style={{ display: 'flex', height: '100vh', background: P.bg, color: P.ink, fontFamily: P.fontSans, overflow: 'hidden' }}>
    <window.HWRail active="delivery" />
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '26px 34px 60px' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <PageHeader onAdd={() => setAdding(true)} mode={mode} onToggleTheme={themeValue.toggle} />
      {focused ?
      <RegionDetail region={focused} onBack={() => setFocus(null)} onChange={updateRegion} /> :
      <>
          <div style={{ marginBottom: 34 }}>
            <ScheduleWeek />
          </div>
          <div>
            <SectionBanner icon="map" title="Regions" sub="Counties → sub-regions · central settings, overrides & KML zones" />
            <RegionsHome onOpen={setFocus} regions={regions} />
          </div>
          <div style={{ marginTop: 34 }}>
            <SectionBanner icon="link" title="Weedmaps" sub="Region → listing mappings, menu IDs & API credentials" />
            <WeedmapsPanel regions={regions} />
          </div>
        </>}
    </div>
    {adding && <AddRegionModal regions={regions} onClose={() => setAdding(false)} onSave={addRegion} />}
  </div></div></window.ThemeCtx.Provider>;
};

ReactDOM.createRoot(document.getElementById('root')).render(<window.DeliveryApp />);