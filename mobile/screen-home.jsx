// ── Home — task list + map (Today / Scheduled) ──────────────────────────────
const useP = window.useP;

// Big segmented Today / Scheduled control
function TodaySeg() {
  const P = useP();const M = window.useM();
  const v = M.s.homeTab;
  return (
    <div style={{ display: 'flex', background: P.surface2, borderRadius: P.r999, padding: 4, margin: '2px 16px 12px', flex: '0 0 auto' }}>
      {[['today', 'Today'], ['scheduled', 'Scheduled']].map(([id, l]) => {const a = v === id;return (
          <button key={id} onClick={() => window.M.setHomeTab(id)} style={{ flex: 1, padding: '11px 0', borderRadius: P.r999, border: 'none', cursor: 'pointer', background: a ? P.surface : 'transparent', color: a ? P.ink : P.inkDim, fontSize: 15, fontWeight: 700, boxShadow: a ? P.shadowSm : 'none', transition: 'all .15s', fontFamily: P.fontSans }}>{l}</button>);})}
    </div>);

}

function PrioTag({ prio }) {
  const P = useP();const d = window.MD.PRIO[prio];if (!d) return null;
  return <span style={{ padding: '2px 9px', borderRadius: 99, background: d.bg, color: d.fg, fontSize: 11.5, fontWeight: 700 }}>{d.label}</span>;
}

// Pack status chip — not packed / partial / staged in van
function PackChip({ task, size = 'sm' }) {
  const P = useP();const M = window.useM();
  const ps = window.MD.packStatus(task, M.packedUnits(task.id));
  if (ps.state === 'na') return null;
  const map = {
    none: { c: P.bad, ic: 'package', label: 'Not packed' },
    partial: { c: P.accent, ic: 'package', label: `Packed ${ps.packed}/${ps.total}` },
    full: { c: P.good, ic: 'check-circle', label: 'Packed' } };
  const d = map[ps.state];
  const fs = size === 'md' ? 11 : 10.5;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px 2px 7px', borderRadius: 99, background: d.c + (P.mode === 'dark' ? '22' : '18'), color: d.c, fontSize: fs, fontWeight: 800, whiteSpace: 'nowrap' }}><Icon name={d.ic} size={12} stroke={2.2} color={d.c} />{d.label}</span>;
}

function StopCard({ t }) {
  const P = useP();const M = window.useM();
  const done = M.isDone(t.id);
  const st = window.MD.STATUS[done ? 'completed' : t.status] || window.MD.STATUS['not-started'];
  const totals = window.MD.cartTotals(t.items);
  const es = window.MD.etaStatus(t.slack);
  const etaColor = P[es.color] || P.ink;
  const hasEta = t.eta && t.eta !== '—';
  const latest = window.MD.latestArrival(t);
  const isAppt = t.appt;
  const accentC = isAppt ? P.indica : etaColor;
  return (
    <div data-tour={done ? undefined : isAppt ? 'appt' : 'stop'} onClick={() => window.M.push(isAppt ? 'appointment' : 'task', { taskId: t.id })} style={{ background: P.surface, border: `1px solid ${done ? P.hairline : isAppt ? P.indica + '66' : P.hairline2}`, borderRadius: P.r16, padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        {isAppt && !done && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px 2px 7px', borderRadius: 99, background: P.indica, color: '#fff', fontSize: 11.5, fontWeight: 800 }}><Icon name="home" size={11} stroke={2.2} color="#fff" />SHOP@HOME</span>}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P[st.color] || P.inkDim }}>{st.label}</span>
        {!done && <PrioTag prio={t.prio} />}
        {!done && <window.VisitBadge visit={t.visit} size="md" />}
        {!done && !isAppt && <PackChip task={t} size="md" />}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{t.order}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{t.name}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: P.inkDim, fontSize: 12.5 }}><Icon name="pin" size={14} stroke={1.8} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} /><span>{t.addr}, {t.city} {t.zip}</span></div>

      {/* Appointment window (scheduled) shown alongside ETA */}
      {isAppt && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.indica + (P.mode === 'dark' ? '1c' : '12'), borderRadius: P.r10 }}><Icon name="clock" size={14} stroke={2} color={P.indica} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.indica }}>{t.win}</span></div>}

      {/* ETA / distance / (items or AOV goal) strip */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: done ? P.surface2 : accentC + (P.mode === 'dark' ? '1c' : '14'), border: `1px solid ${done ? P.hairline : accentC + '44'}`, borderRadius: P.r12, padding: '9px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: done ? P.inkMute : accentC, fontFamily: P.fontMono }}>ETA</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: done ? P.ink2 : accentC, fontFamily: P.fontMono, lineHeight: 1.15, marginTop: 1 }}>{hasEta ? t.eta.replace(/\s?[AP]M/, '') : '—'}</div>
        </div>
        <div style={{ flex: 1, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: '9px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Distance</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1.15, marginTop: 1 }}>{t.dist !== '—' ? t.dist : '—'}<span style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute }}> mi</span></div>
        </div>
        <div style={{ flex: 1, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: '9px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{isAppt ? 'AOV goal' : 'Items'}</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1.15, marginTop: 1 }}>{isAppt ? window.HW.fmt.money(window.MD.AOV.target) : totals.count}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
        {isAppt ? <>
          <Icon name="shop" size={14} stroke={2} color={P.indica} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: P.indica }}>Guest shops on arrival</span>
          <div style={{ flex: 1 }} />
          <Icon name="chevron-right" size={16} stroke={2} color={P.inkFaint} />
        </> : <>
          <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{latest ? `Arrive by ${latest}` : t.win}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: P.inkDim }}>To collect</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(totals.total)}</span>
          <Icon name="chevron-right" size={16} stroke={2} color={P.inkFaint} />
        </>}
      </div>
    </div>);

}

function BreakCard({ b }) {
  const P = useP();const M = window.useM();
  const done = b.status === 'completed';
  return (
    <div onClick={() => !done && window.M.startBreak(b.label, b.mins) === undefined && window.M.push('breaktimer')} style={{ background: done ? P.surface2 : '#6B4FBF', border: done ? `1px solid ${P.hairline2}` : 'none', borderRadius: P.r16, padding: '14px 16px', cursor: done ? 'default' : 'pointer', opacity: done ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: done ? P.ink : '#fff' }}>{b.label}</span>
        {done && <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: P.good }}>Completed</span>}
      </div>
      <div style={{ display: 'flex', gap: 40 }}>
        {[['Start Time', b.start], ['End Time', b.end]].map(([k, v]) =>
        <div key={k}><div style={{ fontSize: 11.5, color: done ? P.inkMute : 'rgba(255,255,255,.65)' }}>{k}</div><div style={{ fontSize: 15, fontWeight: 700, color: done ? P.ink2 : '#fff', fontFamily: P.fontMono, marginTop: 2 }}>{v}</div></div>
        )}
      </div>
    </div>);

}

// Welcome / off-duty empty state
function WelcomeHero() {
  const P = useP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 32px', textAlign: 'center' }}>
      <div style={{ width: 148, height: 96, position: 'relative', marginBottom: 30 }}>
        <div style={{ position: 'absolute', left: 30, top: 8, width: 118, height: 66, background: P.accent, borderRadius: '8px 10px 8px 8px' }} />
        <div style={{ position: 'absolute', left: 0, top: 28, width: 46, height: 46, background: P.accent, borderRadius: '10px 4px 6px 8px' }} />
        <div style={{ position: 'absolute', left: 66, top: 20, fontSize: 30, fontWeight: 800, color: P.accentInk }}>HW</div>
        <div style={{ position: 'absolute', left: 14, bottom: -6, width: 22, height: 22, borderRadius: 99, background: '#111', border: `3px solid ${P.inkMute}` }} />
        <div style={{ position: 'absolute', left: 104, bottom: -6, width: 22, height: 22, borderRadius: 99, background: '#111', border: `3px solid ${P.inkMute}` }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: P.ink }}>Welcome Back!</div>
      <div style={{ fontSize: 15, color: P.inkDim, marginTop: 10, lineHeight: 1.5 }}>Ready to hit the road? Go on duty to see today's stops.</div>
      <div style={{ marginTop: 22 }}><PBtn variant="accent" size="xl" icon="lightning" onClick={() => window.M.openSheet('onduty')}>Go On Duty</PBtn></div>
    </div>);

}

// Route map (schematic)
function RouteMap({ stops }) {
  const P = useP();
  const pts = stops.map((s) => ({ x: 26 + s.x * 320, y: 40 + s.y * 460, s }));
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(0) + ' ' + p.y.toFixed(0)).join(' ');
  return (
    <div style={{ position: 'relative', height: '100%', background: P.mode === 'dark' ? '#12131A' : '#E7EAF0', overflow: 'hidden' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} viewBox="0 0 372 560" preserveAspectRatio="xMidYMid slice">
        {[...Array(9)].map((_, i) => <line key={'h' + i} x1="0" y1={i * 64} x2="372" y2={i * 64 + 30} stroke={P.mode === 'dark' ? '#1C1E28' : '#D3D8E2'} strokeWidth="8" />)}
        {[...Array(7)].map((_, i) => <line key={'v' + i} x1={i * 60} y1="0" x2={i * 60 + 20} y2="560" stroke={P.mode === 'dark' ? '#181A22' : '#DADFE8'} strokeWidth="5" />)}
        <path d={path} stroke={P.accent} strokeWidth="3.5" fill="none" strokeDasharray="2 8" strokeLinecap="round" opacity="0.9" />
        {pts.map((p, i) =>
        <g key={i} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }} onClick={() => window.M.push('task', { taskId: p.s.id })}>
            <circle r="15" fill={P.ink} stroke={P.accent} strokeWidth="2.5" />
            <text textAnchor="middle" dy="5" fontSize="15" fontWeight="700" fill={P.surface} fontFamily="'JetBrains Mono', monospace">{i + 1}</text>
          </g>
        )}
        <circle cx="200" cy="300" r="9" fill="#2E7CF6" stroke="#fff" strokeWidth="3" />
      </svg>
      <button onClick={() => window.M.setHomeView('list')} style={{ position: 'absolute', bottom: 20, right: 18, display: 'flex', alignItems: 'center', gap: 8, padding: '13px 20px', background: P.ink, color: P.surface, border: 'none', borderRadius: 99, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: P.shadowLg }}><Icon name="list" size={18} stroke={2} />List</button>
    </div>);

}

// Van-packing progress banner (Today) — nudges the driver to stage every
// order before departing, not just the next one.
function VanPackBanner() {
  const P = useP();const M = window.useM();
  const stops = window.MD.TASKS.filter((t) => !M.isDone(t.id) && window.MD.cartTotals(t.items).count > 0);
  if (!stops.length) return null;
  const per = stops.map((t) => window.MD.packStatus(t, M.packedUnits(t.id)));
  const fullN = per.filter((p) => p.state === 'full').length;
  const allDone = fullN === stops.length;
  const unitsPacked = per.reduce((a, p) => a + p.packed, 0);
  const unitsTotal = per.reduce((a, p) => a + p.total, 0);
  const pct = unitsTotal ? unitsPacked / unitsTotal : 0;
  return (
    <div data-tour="pack" onClick={() => window.M.push('packing')} style={{ margin: '0 16px 12px', padding: '13px 15px', borderRadius: P.r16, cursor: 'pointer', background: allDone ? P.goodSoft : P.surface, border: `1px solid ${allDone ? P.good + '55' : P.accentBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: allDone ? P.good : P.accent, color: allDone ? '#fff' : P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={allDone ? 'check-circle' : 'package'} size={20} stroke={2.1} color={allDone ? '#fff' : P.accentInk} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: P.ink }}>{allDone ? 'Van packed — ready to roll' : 'Pack your orders before you depart'}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1, fontFamily: P.fontMono }}>{fullN}/{stops.length} orders staged · {unitsPacked}/{unitsTotal} items</div>
        </div>
        {!allDone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 99, background: P.accent, color: P.accentInk, fontSize: 12.5, fontWeight: 800, flex: '0 0 auto' }}>Pack<Icon name="chevron-right" size={14} stroke={2.4} color={P.accentInk} /></span>}
      </div>
      {!allDone && <div style={{ height: 5, borderRadius: 99, background: P.surface3, marginTop: 11, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: P.accent, borderRadius: 99, transition: 'width .3s' }} /></div>}
    </div>);
}

// Full-screen van packing — every item is staged by SCANNING its barcode.
function ScanLine({ t, l }) {
  const P = useP();const M = window.useM();
  const p = l.p || {};
  const scanned = M.isScanned(t.id, l.sku);
  const box = window.MD.boxOf(p.cat ? p : { cat: 'Flower', sku: l.sku });
  return (
    <button onClick={() => scanned ? window.M.unscanLine(t.id, l.sku) : window.M.scanLine(t.id, l.sku)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: scanned ? P.goodSoft : P.surface2, border: `1px solid ${scanned ? P.good + '55' : P.hairline2}`, borderRadius: P.r12, padding: '9px 11px', cursor: 'pointer' }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: scanned ? P.good : P.surface3, color: scanned ? '#fff' : P.inkMute }}><Icon name={scanned ? 'check' : 'barcode'} size={16} stroke={2.2} color={scanned ? '#fff' : P.inkMute} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand || 'Hyperwolf'}</span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || l.sku}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{box} · ×{l.qty}</span>
      </span>
      {scanned ?
      <span style={{ fontSize: 11.5, fontWeight: 800, color: P.good, fontFamily: P.fontMono, flex: '0 0 auto' }}>SCANNED</span> :
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 99, background: P.ink, color: P.bg, fontSize: 12.5, fontWeight: 800, flex: '0 0 auto' }}><Icon name="scan" size={13} stroke={2.2} color={P.bg} />Scan</span>}
    </button>);
}

function PackRow({ t }) {
  const P = useP();const M = window.useM();
  const totals = window.MD.cartTotals(t.items);
  const ps = window.MD.packStatus(t, M.packedUnits(t.id));
  const c = ps.state === 'full' ? P.good : ps.state === 'partial' ? P.accent : P.inkMute;
  const scannedLines = totals.line.filter((l) => M.isScanned(t.id, l.sku)).length;
  return (
    <div style={{ background: P.surface, border: `1px solid ${ps.state === 'full' ? P.good + '55' : P.hairline2}`, borderRadius: P.r16, padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{t.name}</span><window.VisitBadge visit={t.visit} size="sm" /></div>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{t.order} · {scannedLines}/{totals.line.length} lines scanned</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 800, color: c, fontFamily: P.fontMono }}>{ps.state === 'full' ? <Icon name="check-circle" size={15} stroke={2.2} color={c} /> : null}{ps.packed}/{ps.total}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {totals.line.map((l, i) => <ScanLine key={i} t={t} l={l} />)}
      </div>
    </div>);
}

window.PackingScreen = function PackingScreen() {
  const P = useP();const M = window.useM();
  const stops = window.MD.TASKS.filter((t) => !M.isDone(t.id) && window.MD.cartTotals(t.items).count > 0);
  const per = stops.map((t) => window.MD.packStatus(t, M.packedUnits(t.id)));
  const fullN = per.filter((p) => p.state === 'full').length;
  const allDone = stops.length > 0 && fullN === stops.length;
  const remaining = stops.filter((t) => window.MD.packStatus(t, M.packedUnits(t.id)).state !== 'full');
  const unitsLeft = per.reduce((a, p) => a + (p.total - p.packed), 0);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title="Pack your orders" sub={`${fullN}/${stops.length} orders staged`} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 130px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: P.infoSoft || P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r14 }}>
          <Icon name="barcode" size={17} stroke={2} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.45 }}>Scan every item's barcode into the van before your first stop. Orders can only be staged by scanning — all {stops.length} must be complete before you roll.</span>
        </div>
        {stops.map((t) => <PackRow key={t.id} t={t} />)}
        {allDone && <div style={{ textAlign: 'center', color: P.good, fontSize: 13.5, fontWeight: 700, padding: '8px 0' }}>All orders packed — you're ready to roll.</div>}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
        {allDone ?
        <PBtn variant="accent" size="xl" full icon="check" onClick={() => {window.M.pop();window.M.flash('Van packed — ready to roll');}}>Done — van packed</PBtn> :
        <PBtn variant="primary" size="xl" full icon="barcode" disabled>{unitsLeft} item{unitsLeft === 1 ? '' : 's'} left to scan</PBtn>}
      </div>
    </div>);
};

window.HomeScreen = function HomeScreen() {
  const P = useP();const M = window.useM();
  const onDuty = M.s.duty;
  const tab = M.s.homeTab;
  const view = M.s.homeView;

  if (view === 'map' && onDuty) return <div style={{ position: 'absolute', inset: 0 }}><RouteMap stops={window.MD.TASKS} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TodaySeg />
      {!onDuty ? <WelcomeHero /> :
      <>
          <window.BreakBanner />
          {tab === 'today' && <VanPackBanner />}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 10px', flex: '0 0 auto' }}>
            <div style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono }}>{tab === 'today' ? `${window.MD.TASKS.length} stops today` : `${window.MD.SCHEDULED.length} scheduled · ${window.MD.SCHEDULED.filter((s) => s.appt).length} shop@home`}</div>
            <div style={{ flex: 1 }} />
            <button onClick={() => window.M.openSheet('filters')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Filters<Icon name="chevron-down" size={15} stroke={2} color={P.info} /></button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'today' ?
          (() => {
            const tmin = (s) => {if (!s) return 9999;const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);if (!m) return 9999;let h = +m[1] % 12;if (/PM/i.test(m[3])) h += 12;return h * 60 + +m[2];};
            const active = window.MD.TASKS.filter((t) => !M.isDone(t.id)).map((t) => ({ kind: 'stop', t, at: tmin(t.eta) }));
            const openBreaks = window.MD.BREAKS.filter((b) => b.status !== 'completed').map((b) => ({ kind: 'break', b, at: tmin(b.start) }));
            const merged = [...active, ...openBreaks].sort((a, x) => a.at - x.at);
            const doneList = window.MD.TASKS.filter((t) => M.isDone(t.id));
            const doneBreaks = window.MD.BREAKS.filter((b) => b.status === 'completed');
            return [
            ...merged.map((e) => e.kind === 'stop' ? <StopCard key={e.t.id} t={e.t} /> : <BreakCard key={e.b.id} b={e.b} />),
            ...(doneList.length + doneBreaks.length > 0 ? [<div key="dh" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px 0' }}><span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Completed</span><div style={{ flex: 1, height: 1, background: P.hairline2 }} /><span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{doneList.length}</span></div>] : []),
            ...doneList.map((t) => <StopCard key={t.id} t={t} />),
            ...doneBreaks.map((b) => <BreakCard key={b.id} b={b} />)];

          })() :
          window.MD.SCHEDULED.map((s) => <StopCard key={s.id} t={s} />)}
          </div>
        </>
      }
      {onDuty && view === 'list' &&
      <button onClick={() => window.M.setHomeView('map')} style={{ position: 'absolute', bottom: 96, right: 18, display: 'flex', alignItems: 'center', gap: 8, padding: '13px 20px', background: P.ink, color: P.surface, border: 'none', borderRadius: 99, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: P.shadowLg, zIndex: 20 }}><Icon name="map" size={18} stroke={2} />Map</button>
      }
    </div>);

};