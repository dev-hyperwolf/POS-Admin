// ── Task detail — arrival (ID + street view), items w/ barcode scan, collect ─
const useP = window.useP;

function findTask(id) {
  return window.MD.TASKS.find((t) => t.id === id) || window.MD.SCHEDULED.find((t) => t.id === id);
}

// ── Media placeholders (drop real photos here later) ────────────────────────
function IDPhoto({ base, h = 150, onZoom }) {
  const P = useP();
  return (
    <button onClick={onZoom} style={{ position: 'relative', width: '100%', height: h, borderRadius: P.r14, overflow: 'hidden', border: `1px solid ${P.hairline2}`, cursor: 'zoom-in', padding: 0, background: `linear-gradient(135deg, ${P.mode === 'dark' ? '#242a1c' : '#e9ecdd'}, ${P.mode === 'dark' ? '#1a1e14' : '#dfe3d2'})` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Avatar name={base.name} size={h * 0.42} /></div>
      <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', fontFamily: P.fontMono }}>ID ON FILE · 21+</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,.6))' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{base.name}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', fontFamily: P.fontMono }}>DOB 09/14/1992 · CA</div></div>
      <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 99, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="search" size={13} stroke={2.2} /></div>
    </button>);
}
function StreetView({ base, h = 150, onZoom }) {
  const P = useP();
  return (
    <button onClick={onZoom} style={{ position: 'relative', width: '100%', height: h, borderRadius: P.r14, overflow: 'hidden', border: `1px solid ${P.hairline2}`, cursor: 'zoom-in', padding: 0, background: P.mode === 'dark' ? '#12131A' : '#dbe0ea' }}>
      <svg width="100%" height="100%" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
        <rect width="300" height="160" fill={P.mode === 'dark' ? '#12131A' : '#dbe0ea'} />
        <rect y="112" width="300" height="48" fill={P.mode === 'dark' ? '#1b1d26' : '#c3c9d4'} />
        <path d="M120 160 L150 96 L180 160 Z" fill={P.mode === 'dark' ? '#2a2e3a' : '#aeb6c4'} />
        <rect x="128" y="112" width="44" height="48" fill={P.mode === 'dark' ? '#33384a' : '#9aa3b4'} />
        <rect x="140" y="124" width="20" height="36" fill={P.accent} opacity="0.85" />
        <circle cx="60" cy="70" r="26" fill={P.mode === 'dark' ? '#1f2430' : '#b9c0cd'} />
        <rect x="54" y="70" width="12" height="42" fill={P.mode === 'dark' ? '#2a2e3a' : '#a7afbe'} />
        <path d="M0 120 L300 108" stroke={P.mode === 'dark' ? '#2a2e3a' : '#c9cfd9'} strokeWidth="3" />
      </svg>
      <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', fontFamily: P.fontMono }}>STREET VIEW</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,.55))' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{base.addr}</div></div>
      <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 99, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="search" size={13} stroke={2.2} /></div>
    </button>);
}

// Arrival section — ID + Street view; 2 staff-customizable layouts (tracked)
function ArrivalSection({ base, onZoom }) {
  const P = useP();
  const [layout, setLayout] = React.useState(() => {try {return localStorage.getItem('hw-m-arrival') || 'split';} catch {return 'split';}});
  const pick = (v) => {setLayout(v);try {localStorage.setItem('hw-m-arrival', v);const k = 'hw-m-arrival-stats';const a = JSON.parse(localStorage.getItem(k) || '{}');a[v] = (a[v] || 0) + 1;localStorage.setItem(k, JSON.stringify(a));} catch {}};
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <Eyebrow>Know before you knock</Eyebrow><div style={{ flex: 1 }} />
        <Seg size="sm" value={layout} onChange={pick} options={[{ value: 'split', label: 'Split' }, { value: 'stack', label: 'Stack' }]} />
      </div>
      {layout === 'split' ?
      <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><IDPhoto base={base} h={150} onZoom={() => onZoom('id')} /></div><div style={{ flex: 1 }}><StreetView base={base} h={150} onZoom={() => onZoom('street')} /></div></div> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><StreetView base={base} h={168} onZoom={() => onZoom('street')} /><IDPhoto base={base} h={150} onZoom={() => onZoom('id')} /></div>}
      <div style={{ fontSize: 10.5, color: P.inkMute, marginTop: 8, textAlign: 'center' }}>Tap to enlarge · your team's preferred layout is saved</div>
    </div>);
}

// ID capture — in-app camera with a placement overlay (unverified guests)
window.IDCapture = function IDCapture({ name, onCancel, onCaptured }) {
  const P = useP();
  const [shot, setShot] = React.useState(false);
  const CW = 300,CH = CW / 1.586; // ID-1 card ratio
  const corner = (pos) => {const b = `3px solid ${P.accent}`;const s = { position: 'absolute', width: 26, height: 26 };const m = { tl: { top: -2, left: -2, borderTop: b, borderLeft: b, borderTopLeftRadius: 8 }, tr: { top: -2, right: -2, borderTop: b, borderRight: b, borderTopRightRadius: 8 }, bl: { bottom: -2, left: -2, borderBottom: b, borderLeft: b, borderBottomLeftRadius: 8 }, br: { bottom: -2, right: -2, borderBottom: b, borderRight: b, borderBottomRightRadius: 8 } }[pos];return <span style={{ ...s, ...m }} />;};
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 180, background: '#000', display: 'flex', flexDirection: 'column', animation: 'fade .15s ease' }}>
      <div style={{ height: 52, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px' }}><div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Scan customer ID</div><div style={{ flex: 1 }} /><button onClick={onCancel} style={{ width: 38, height: 38, borderRadius: 99, background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={19} stroke={2.2} /></button></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {!shot ? <>
          <div style={{ position: 'relative', width: CW, height: CH, borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', background: 'rgba(255,255,255,.04)' }}>
            {corner('tl')}{corner('tr')}{corner('bl')}{corner('br')}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: .5 }}><Icon name="user" size={40} stroke={1.5} color="#fff" /><div style={{ width: 90, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.4)' }} /><div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.3)' }} /></div>
          </div>
          <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 13.5, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>Lay the <b style={{ color: '#fff' }}>front of the ID</b> flat inside the frame. Fill the box and avoid glare.</div>
        </> : <>
          <div style={{ width: CW, height: CH, borderRadius: 12, overflow: 'hidden', border: `2px solid ${P.good}`, background: `linear-gradient(135deg, #2b3220, #1a1e14)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Avatar name={name} size={70} /><span style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 9.5, fontWeight: 700, fontFamily: P.fontMono }}>ID CAPTURED</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: P.good, fontSize: 14, fontWeight: 700 }}><Icon name="check-circle" size={17} stroke={2} />Looks good — clear & readable</div>
        </>}
      </div>
      <div style={{ padding: '16px 20px 40px', background: '#0c0c0c' }}>
        {!shot ?
        <button onClick={() => setShot(true)} style={{ width: 70, height: 70, borderRadius: 99, background: '#fff', border: `4px solid rgba(255,255,255,.4)`, cursor: 'pointer', margin: '0 auto', display: 'block' }} /> :
        <div style={{ display: 'flex', gap: 10 }}><PBtn variant="secondary" size="xl" full icon="refresh" onClick={() => setShot(false)}>Retake</PBtn><PBtn variant="accent" size="xl" full icon="check" onClick={onCaptured}>Save to profile</PBtn></div>}
        {!shot && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', fontSize: 11.5, marginTop: 12, fontFamily: P.fontMono }}>Tap to capture · camera only, no library</div>}
      </div>
    </div>);
};

// Zoom overlay
function ZoomView({ kind, base, onClose }) {
  const P = useP();
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 170, background: 'rgba(0,0,0,.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fade .15s ease' }}>
      <div style={{ width: '100%', maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>{kind === 'id' ? <IDPhoto base={base} h={380} onZoom={() => {}} /> : <StreetView base={base} h={340} onZoom={() => {}} />}</div>
      <button onClick={onClose} style={{ marginTop: 20, padding: '11px 22px', background: 'rgba(255,255,255,.14)', color: '#fff', border: 'none', borderRadius: 99, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close</button>
    </div>);
}

// ── Item row with batch + scan verification ─────────────────────────────────
function ScanRow({ l, count, onScan, mode }) {
  const P = useP();
  const done = count >= l.qty;
  const batch = l.p ? window.MD.batchOf(l.p) : '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${P.hairline}` }}>
      <div style={{ position: 'relative' }}><Thumb item={l.p} size={44} />{done && <span style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 99, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${P.bg}` }}><Icon name="check" size={11} stroke={3} /></span>}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p ? l.p.name : l.sku}</div>
        <div style={{ fontSize: 11, color: done ? P.good : P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{l.p ? `${l.p.brand}` : ''} · Batch {batch}{done ? ' ✓' : ''}</div>
        {l.qty > 1 && <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>{Array.from({ length: l.qty }).map((_, i) => <span key={i} style={{ width: 16, height: 5, borderRadius: 3, background: i < count ? P.good : P.hairline3 }} />)}</div>}
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: done ? P.good : P.ink2, fontFamily: P.fontMono }}>{count}/{l.qty}</div>
        {mode === 'peritem' && (done ?
        <span style={{ fontSize: 11, fontWeight: 700, color: P.good }}>Verified</span> :
        <button data-tour="scan" onClick={onScan} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: P.ink, color: P.surface, border: 'none', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="barcode" size={13} stroke={2} />Scan {l.qty > 1 ? `(${count + 1}/${l.qty})` : ''}</button>)}
      </div>
    </div>);
}

// Scanner overlay (simulated camera) — requires a scan per UNIT of each item
function Scanner({ items, scanned, onScanOne, onDone, onClose }) {
  const P = useP();
  const cnt = (sku) => scanned[sku] || 0;
  const totalUnits = items.reduce((a, l) => a + l.qty, 0);
  const doneUnits = items.reduce((a, l) => a + Math.min(l.qty, cnt(l.sku)), 0);
  const next = items.find((l) => cnt(l.sku) < l.qty);
  React.useEffect(() => { if (!next) { const t = setTimeout(onDone, 500); return () => clearTimeout(t); } }, [next]);
  const nextUnit = next ? cnt(next.sku) + 1 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 175, background: '#000', display: 'flex', flexDirection: 'column', animation: 'fade .15s ease' }}>
      <div style={{ height: 52, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px' }}><div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Scan items</div><div style={{ flex: 1 }} /><button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 99, background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={19} stroke={2.2} /></button></div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: 250, height: 250, border: `3px solid ${P.accent}`, borderRadius: 24, position: 'relative', boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }}>
          <div style={{ position: 'absolute', left: 12, right: 12, top: '50%', height: 2, background: P.accent, boxShadow: `0 0 12px ${P.accent}`, animation: 'hwscan 1.6s ease-in-out infinite' }} />
        </div>
        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 13, fontFamily: P.fontMono }}>{next ? `${next.p ? next.p.name : next.sku} — unit ${nextUnit} of ${next.qty}` : 'All units verified'}</div>
      </div>
      <div style={{ padding: '16px 20px 40px', background: '#0c0c0c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, fontFamily: P.fontMono }}>{doneUnits}/{totalUnits} units verified</span><span style={{ color: P.accent, fontSize: 12.5, fontWeight: 700, fontFamily: P.fontMono }}>{next ? `Batch ${next.p ? window.MD.batchOf(next.p) : ''}` : 'Done'}</span></div>
        {next ?
        <PBtn variant="accent" size="xl" full icon="barcode" onClick={() => onScanOne(next.sku)}>Scan {next.p ? next.p.name.split(' ').slice(0, 2).join(' ') : next.sku} · {nextUnit}/{next.qty}</PBtn> :
        <PBtn variant="accent" size="xl" full icon="check" onClick={onDone}>Done</PBtn>}
      </div>
    </div>);
}

window.TaskScreen = function TaskScreen({ taskId }) {
  const P = useP();const M = window.useM();
  const base = findTask(taskId);
  const [scanned, setScanned] = React.useState(() => ({}));
  const [scanning, setScanning] = React.useState(false);
  const [zoom, setZoom] = React.useState(null);
  if (!base) return <div style={{ height: '100%' }}><window.MTopBar title="Order" /></div>;
  const items = M.s.cartTaskId === taskId && M.s.cart.length ? M.s.cart : base.items;
  const totals = window.MD.cartTotals(items);
  const done = M.isDone(taskId);
  const cod = base.pay === 'cod';
  const st = window.MD.STATUS[done ? 'completed' : base.status || 'not-started'];
  const es = window.MD.etaStatus(base.slack);
  const v = window.MD.VISIT[base.visit];
  const lines = totals.line;
  const allScanned = lines.every((l) => (scanned[l.sku] || 0) >= l.qty);
  const scanOne = (sku) => setScanned((s) => ({ ...s, [sku]: (s[sku] || 0) + 1 }));
  const totalUnits = lines.reduce((a, l) => a + l.qty, 0);
  const doneUnits = lines.reduce((a, l) => a + Math.min(l.qty, scanned[l.sku] || 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title={base.order} sub={base.name} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 130px' }}>
        {/* status + on-time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: P[st.color] || P.inkDim }}>{st.label}</span>
          {base.prio && !done && <span style={{ padding: '2px 9px', borderRadius: 99, background: window.MD.PRIO[base.prio].bg, color: window.MD.PRIO[base.prio].fg, fontSize: 10.5, fontWeight: 700 }}>{window.MD.PRIO[base.prio].label}</span>}
          {v && v.short && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px 2px 7px', borderRadius: 99, background: v.color + (P.mode === 'dark' ? '26' : '1f'), color: v.color, fontSize: 10.5, fontWeight: 800 }}><Icon name={v.icon} size={11} stroke={2.2} />{v.short}</span>}
          <div style={{ flex: 1 }} />
          {base.eta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: P[es.color] + (P.mode === 'dark' ? '22' : '18'), color: P[es.color], fontSize: 11, fontWeight: 700 }}><Icon name={es.icon} size={12} stroke={2} />{es.label}</span>}
        </div>

        {/* new / VIP guest banner — prominent */}
        {v && v.short && <div style={{ marginBottom: 16 }}><window.VisitBanner visit={base.visit} /></div>}

        {/* arrival — ID + street view */}
        <ArrivalSection base={base} onZoom={setZoom} />

        {/* customer / address */}
        <Card padding={0} style={{ padding: '2px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${P.hairline}` }}>
            <Avatar name={base.name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{base.name}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{base.phone}</div></div>
            <button onClick={() => window.M.flash('Calling ' + base.name)} style={{ width: 38, height: 38, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={17} stroke={1.9} /></button>
            <button data-tour="text" onClick={() => window.M.openSheet('textcustomer', { task: base })} title="Text customer" style={{ width: 38, height: 38, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.info, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chat" size={17} stroke={1.9} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0' }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="pin" size={17} stroke={1.8} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Address</div><div style={{ fontSize: 14, fontWeight: 600, color: P.ink, marginTop: 2 }}>{base.addr}{base.city ? `, ${base.city}` : ''} {base.zip || ''}</div></div>
            <button onClick={() => window.M.flash('Opening navigation')} style={{ padding: '9px 14px', background: P.ink, color: P.surface, border: 'none', borderRadius: P.r10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="route" size={14} stroke={2} />Go</button>
          </div>
        </Card>

        {/* items + barcode scan */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Eyebrow>Verify order · {totals.count} items</Eyebrow><div style={{ flex: 1 }} />
          {!done && <button onClick={() => {window.M.startCart(taskId, items);window.M.push('shop', { taskId });}} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Icon name="plus" size={13} stroke={2.2} />Add / edit</button>}
        </div>

        {!done && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name={allScanned ? 'check-circle' : 'barcode'} size={17} stroke={2} color={allScanned ? P.good : P.ink2} />
          <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 700, color: allScanned ? P.good : P.ink }}>{allScanned ? 'All items scanned & verified' : `Scan to verify · ${doneUnits}/${totalUnits} units`}</span></div>
          {!allScanned && <button onClick={() => setScanning(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: P.ink, color: P.bg, border: 'none', borderRadius: 99, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', flex: '0 0 auto' }}><Icon name="scan" size={14} stroke={2.2} color={P.bg} />Scan all</button>}
        </div>}

        <Card padding={0} style={{ padding: '4px 16px', marginBottom: 16 }}>
          {lines.map((l, i) => <ScanRow key={i} l={l} count={done ? l.qty : (scanned[l.sku] || 0)} onScan={() => scanOne(l.sku)} mode={done ? 'view' : 'peritem'} />)}
          <div style={{ borderTop: `1px solid ${P.hairline2}`, padding: '12px 0 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Subtotal', totals.sub], ...window.HW.taxBreakdown(totals.sub).lines.map((x) => [x.k, x.v])].map(([k, val]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>{k}</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{window.HW.fmt.money(val)}</span></div>)}
          </div>
        </Card>

        {/* BIG to-collect / total */}
        <div style={{ background: cod ? P.accentSoft : P.surface, border: `1.5px solid ${cod ? P.accentBorder : P.hairline2}`, borderRadius: P.r16, padding: '16px 18px', display: 'flex', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: cod ? P.mode === 'dark' ? P.accent : '#7A5A00' : P.inkMute, fontFamily: P.fontMono }}>{cod ? 'To collect' : 'Order total'}</div>
            {cod && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3 }}>Marked <b style={{ textTransform: 'capitalize' }}>{base.tender}</b> at checkout</div>}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 36, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.01em' }}>{window.HW.fmt.money(totals.total)}</div>
        </div>

        {!done && <button onClick={() => window.M.openSheet('moretime', { task: base })} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px auto 0', padding: '10px 14px', background: 'transparent', border: 'none', color: P.inkDim, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Icon name="clock" size={15} stroke={2} />Customer not ready?</button>}
      </div>

      {/* footer */}
      {!done ?
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
          {!allScanned && <div style={{ fontSize: 11.5, color: P.warn, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Scan all items to continue</div>}
          <PBtn variant="accent" size="xl" full icon={cod ? 'cash' : 'check'} disabled={!allScanned} onClick={() => {window.M.startCart(taskId, items);window.M.push('complete', { taskId });}}>{cod ? `Close out · collect ${window.HW.fmt.money(totals.total)}` : 'Close out · confirm delivery'}</PBtn>
        </div> :
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
          <PBtn variant="secondary" size="xl" full icon="receipt" onClick={() => window.M.push('complete', { taskId, receiptOnly: true })}>View receipt</PBtn>
        </div>}

      {zoom && <ZoomView kind={zoom} base={base} onClose={() => setZoom(null)} />}
      {scanning && <Scanner items={lines} scanned={scanned} onScanOne={scanOne} onDone={() => { const full = {}; lines.forEach((l) => full[l.sku] = l.qty); setScanned(full); setScanning(false); window.M.flash('All units verified'); }} onClose={() => setScanning(false)} />}
    </div>);
};

Object.assign(window, { findTask, IDPhoto, StreetView, ArrivalSection, ZoomView });

// ── Customer needs more time — smart wait / reroute / reschedule ────────────
window.MoreTimeSheet = function MoreTimeSheet({ task }) {
  const P = useP();
  const [choice, setChoice] = React.useState(null);
  // nearest other not-started stop to knock out while waiting
  const near = window.MD.TASKS.filter((t) => t.id !== (task && task.id) && !window.M.isDone(t.id)).sort((a, b) => a.dist - b.dist)[0];
  const opts = [
    { id: 'wait', mins: '≤5 min', icon: 'clock', tint: P.good, title: 'Wait here', desc: 'Short wait — stay parked and hold the order.' },
    { id: 'reroute', mins: '6–10 min', icon: 'route', tint: P.info, title: 'Run the next stop', desc: near ? `Knock out ${near.name} (${near.dist} mi) and loop back.` : 'Drive to a nearby stop and loop back.' },
    { id: 'resched', mins: '10 min+', icon: 'calendar', tint: P.warn, title: 'Reschedule', desc: 'Push to later today or hand back to dispatch.' },
  ];
  const rec = (m) => { const c = opts.find((o) => o.id === choice); if (!c) return; if (choice === 'wait') window.M.flash('Holding — waiting on customer'); else if (choice === 'reroute' && near) { window.M.closeSheet(); window.M.push('task', { taskId: near.id }); window.M.flash(`Rerouted to ${near.name} — come back after`); return; } else window.M.flash('Sent to dispatch to reschedule'); window.M.closeSheet(); };
  return (
    <window.Sheet title="Customer needs more time?" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="accent" size="xl" full icon="check" disabled={!choice} onClick={rec}>{choice === 'reroute' ? 'Reroute & come back' : choice === 'resched' ? 'Reschedule this stop' : 'Confirm'}</PBtn>
    }>
      <div style={{ fontSize: 13, color: P.inkDim, lineHeight: 1.5, marginBottom: 14 }}>How long do they need? We'll suggest the smartest move so your route stays tight.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opts.map((o) => { const a = choice === o.id; return (
          <button key={o.id} onClick={() => setChoice(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', background: a ? o.tint + (P.mode === 'dark' ? '1f' : '14') : P.surface2, border: `1.5px solid ${a ? o.tint : P.hairline2}`, borderRadius: P.r14, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: o.tint + (P.mode === 'dark' ? '22' : '18'), color: o.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={o.icon} size={20} stroke={1.9} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>{o.title}</span><span style={{ fontSize: 10.5, fontWeight: 700, color: o.tint, fontFamily: P.fontMono }}>{o.mins}</span></div><div style={{ fontSize: 12, color: P.inkDim, marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div></div>
            {a && <Icon name="check-circle" size={18} stroke={2} color={o.tint} />}
          </button>); })}
      </div>
    </window.Sheet>);
};