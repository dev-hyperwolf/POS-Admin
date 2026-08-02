// ── Hyperdrive Logistics — shared building blocks ───────────────────────────
const useP = window.useP;
const L = window.LDATA;

// ── Hero stat ────────────────────────────────────────────────────────────────
window.LHeroStat = function LHeroStat({ icon, label, value, unit, tone, hint, lead, onClick, active }) {
  const P = useP();
  const c = tone === 'bad' ? P.bad : tone === 'warn' ? P.warn : tone === 'good' ? P.good : tone === 'info' ? P.info : P.ink2;
  const soft = tone === 'bad' ? P.badSoft : tone === 'warn' ? P.warnSoft : tone === 'good' ? P.goodSoft : tone === 'info' ? P.infoSoft : P.surface3;
  return <div onClick={onClick} style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', gap: 7, padding: '13px 15px', background: active ? P.accentSoft : P.surface, border: `1px solid ${active ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, cursor: onClick ? 'pointer' : 'default', overflow: 'hidden', boxShadow: P.shadowSm }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, background: soft, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={13.5} stroke={2} /></span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {onClick && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: active ? (P.mode === 'dark' ? P.accent : '#7A5A00') : P.inkMute, background: active ? P.accentSoft : P.surface3, borderRadius: 99, padding: '2px 6px', flex: '0 0 auto' }}><Icon name="filter" size={9} stroke={2.4} />{active ? 'On' : 'Filter'}</span>}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-.02em', color: tone && tone !== 'neutral' ? c : P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ fontSize: 12, color: P.inkDim, fontWeight: 600 }}>{unit}</span>}
    </div>
    {hint && <span style={{ fontSize: 10.5, color: P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</span>}
  </div>;
};

window.LHeroStrip = function LHeroStrip({ h, lead }) {
  return <div style={{ display: 'flex', gap: 10 }}>
    <LHeroStat icon="clock" label="At risk of breach" value={h.atRisk} tone="bad" hint="ETA past SLA deadline" lead={lead === 'atRisk'} />
    <LHeroStat icon="flag" label="Understaffed regions" value={h.understaffed} tone="bad" hint="demand over capacity" lead={lead === 'understaffed'} />
    <LHeroStat icon="user-off" label="Unassigned" value={h.unassigned} tone="bad" hint="need a driver now" lead={lead === 'unassigned'} />
    <LHeroStat icon="user-check" label="Idle drivers" value={h.idle} tone="warn" hint="on-duty, no stop" lead={lead === 'idle'} />
    <LHeroStat icon="calendar" label="Scheduled" value={h.scheduled} tone="info" hint="pre-booked windows" lead={lead === 'scheduled'} />
    <LHeroStat icon="check-circle" label="On-time" value={h.onTime} unit="%" tone="good" hint={`${h.active} active · ${h.drivers} drivers`} />
  </div>;
};

// ── Inventory-aware reassign popover — fixed-positioned so it never clips ────
window.LReassign = function LReassign({ order, drivers, onPick, onClose, anchor }) {
  const P = useP();
  const cands = L.candidatesFor(order, drivers).slice(0, 6);
  React.useEffect(() => {
    const off = (e) => { if (!e.target.closest('[data-reassign]')) onClose(); };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, []);
  const W = 322, H = 360;
  const a = anchor || { x: window.innerWidth / 2 + W / 2, y: 120 };
  const left = Math.max(12, Math.min(a.x - W, window.innerWidth - W - 12));
  const top = Math.max(12, Math.min(a.y + 6, window.innerHeight - H - 12));
  return <div data-reassign style={{ position: 'fixed', left, top, width: W, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 300, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 13px', borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="route" size={14} color={P.accent} stroke={2} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Reassign #{order.id}</span>
      <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{L.regionLabel(order.region)}</span>
      <div style={{ flex: 1 }} /><IconBtn icon="x" size={14} onClick={onClose} style={{ width: 26, height: 26 }} />
    </div>
    <div style={{ maxHeight: 262, overflowY: 'auto' }}>
      {cands.map((c) => { const dis = c.current || !c.stock;
        return <button key={c.d.id} onClick={() => !dis && onPick(c.d.name)} disabled={dis} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', background: 'transparent', border: 'none', borderTop: `1px solid ${P.hairline}`, cursor: dis ? 'default' : 'pointer', textAlign: 'left', fontFamily: P.fontSans, opacity: dis ? .5 : 1 }}
          onMouseEnter={(e) => !dis && (e.currentTarget.style.background = P.surface2)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <Avatar name={c.d.name} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.d.name}</span>{c.current && <span style={{ fontSize: 9, fontWeight: 700, color: P.inkMute }}>CURRENT</span>}{c.idle && <Pill kind="warn" style={{ fontSize: 9, padding: '1px 6px' }}>idle</Pill>}</div>
            {c.stock ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 10.5, color: P.inkDim, fontFamily: P.fontMono }}><RegionTag code={c.d.region} size="sm" />{c.d.load} stops</div>
              : <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 10, fontWeight: 700, color: P.bad }}><Icon name="package" size={11} />No {c.missing.join(', ')} stock</div>}
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.same ? P.good : P.ink, fontFamily: P.fontMono }}>{c.eta}<span style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 500 }}> min</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 3 }}><RiskBar score={c.score} width={44} height={4} /><span style={{ fontSize: 9.5, color: P.inkMute, fontFamily: P.fontMono }}>{c.score}</span></div>
          </div>
        </button>; })}
    </div>
    <div style={{ padding: '8px 13px', borderTop: `1px solid ${P.hairline}`, fontSize: 10, color: P.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="sparkle" size={11} color={P.accent} />Only in-stock drivers are selectable · ranked by ETA · score · load</div>
  </div>;
};

// ── Inline order action buttons (fixed-anchored reassign, no clipping) ──────
window.LOrderActions = function LOrderActions({ order, drivers, onReassign, onFlash, size = 'sm' }) {
  const P = useP();
  const ref = React.useRef(null);
  const [anchor, setAnchor] = React.useState(null);
  const open = () => { const r = ref.current.getBoundingClientRect(); setAnchor({ x: r.right, y: r.bottom }); };
  const btn = (icon, title, fn, tone) => <IconBtn icon={icon} size={size === 'sm' ? 15 : 16} title={title} onClick={fn} style={{ width: 32, height: 32, color: tone || P.ink2 }} />;
  return <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} data-reassign={anchor ? '' : undefined}>
    {btn('handoff', 'Reassign driver', () => anchor ? setAnchor(null) : open(), anchor ? P.accent : P.ink2)}
    {btn('arrow-up', 'Bump priority', () => onFlash(`#${order.id} bumped to front of queue`))}
    {btn('chat', 'Message driver', () => onFlash(order.driver ? `Message sent to ${order.driver}` : `No driver assigned yet`))}
    {anchor && <LReassign order={order} drivers={drivers} anchor={anchor} onClose={() => setAnchor(null)} onPick={(name) => { setAnchor(null); onReassign(order.id, name); onFlash(`#${order.id} → ${name}`); }} />}
  </div>;
};

// ── Alert row (real-time feed) — clean surface + severity accent ────────────
window.LAlertRow = function LAlertRow({ a, onAct, compact }) {
  const P = useP();
  const c = a.sev === 'bad' ? P.bad : a.sev === 'warn' ? P.warn : P.info;
  const soft = a.sev === 'bad' ? P.badSoft : a.sev === 'warn' ? P.warnSoft : P.infoSoft;
  const actLabel = { assign: 'Assign driver', run: 'View run', rebalance: 'Rebalance', reassign: 'Reassign', bump: 'Bump', message: 'Message', endbreak: 'End break' };
  const actIcon = { assign: 'user-check', run: 'external', rebalance: 'refresh', reassign: 'route', bump: 'arrow-up', message: 'chat', endbreak: 'clock' };
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 14px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c}`, borderRadius: P.r12 }}>
    <span style={{ width: 30, height: 30, borderRadius: 8, background: soft, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={a.icon} size={16} stroke={1.9} /></span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 13, fontWeight: 700, color: P.ink, lineHeight: 1.25 }}>{a.title}</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginLeft: 'auto', flex: '0 0 auto' }}>{a.at}</span></div>
      <div style={{ fontSize: 11.5, color: P.ink2, marginTop: 3, lineHeight: 1.45 }}>{a.body}</div>
      <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
        {a.acts.map((k, i) => <PBtn key={k} size="xs" variant={i === 0 ? (a.sev === 'bad' ? 'accent' : 'secondary') : 'ghost'} icon={actIcon[k]} onClick={() => onAct(a, k)}>{actLabel[k]}</PBtn>)}
      </div>
    </div>
  </div>;
};

// ── Region health card — unassigned pulled OUT (shown only as a flag) ───────
window.LRegionCard = function LRegionCard({ stat, drivers, onReassign, onFlash, onAct, onOpen, variant = 'orders' }) {
  const P = useP();
  const c = L.regionColor(stat.code); const r = L.REGION_BY_CODE[stat.code];
  const hc = stat.health === 'bad' ? P.bad : stat.health === 'warn' ? P.warn : P.good;
  const assigned = stat.os.filter((o) => o.driver).sort((a, b) => a.risk - b.risk);
  return <div style={{ display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${stat.health === 'bad' ? hc : P.hairline2}`, borderRadius: P.r14, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: `1px solid ${P.hairline}`, borderTop: `3px solid ${c}` }}>
      <RegionTag code={stat.code} />
      <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{r.city}</span>
      <div style={{ flex: 1 }} />
      <Pill kind={stat.health === 'ok' ? 'good' : stat.health === 'warn' ? 'warn' : 'bad'} dot>{stat.health === 'ok' ? 'Healthy' : stat.health === 'warn' ? 'Tight' : 'Surge'}</Pill>
    </div>
    {stat.unassigned > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: P.badSoft, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="user-off" size={14} color={P.bad} /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.bad, flex: 1 }}>{stat.unassigned} unassigned — needs a driver</span>
      <PBtn size="xs" variant="accent" icon="user-check" onClick={() => { const u = stat.os.find((o) => !o.driver); const c0 = L.candidatesFor(u, drivers).find((x) => x.stock); if (c0) onReassign(u.id, c0.d.name); }}>Assign</PBtn>
    </div>}
    {(() => { const bm = stat.ds.filter((d) => d.status === 'break' || d.status === 'meal'); if (!bm.length) return null; return <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}><Icon name="clock" size={13} color={P.info} /><span style={{ fontSize: 10.5, color: P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bm.map((d) => `${d.name.split(' ')[0]} · ${d.status === 'meal' ? (d.mealType || 'meal') : 'on break'}`).join(' · ')}</span></div>; })()}
    <div style={{ display: 'flex', gap: 14, padding: '11px 14px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 4 }}>Load</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}><span style={{ fontSize: 20, fontWeight: 700, color: hc, fontFamily: P.fontMono }}>{stat.demand}</span><span style={{ fontSize: 11, color: P.inkDim }}>orders / {stat.driversOn} driver{stat.driversOn !== 1 ? 's' : ''}</span></div>
        <div style={{ marginTop: 6 }}><BarMeter value={stat.demand} max={Math.max(stat.capacity * 2.5, stat.demand)} color={hc} height={5} /></div>
      </div>
      <div style={{ width: 1, background: P.hairline }} />
      <div style={{ flex: '0 0 auto', textAlign: 'right' }} title="The region's single order closest to missing its SLA window. The % is that order's on-time confidence — lower means more urgent.">
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 4 }}>Riskiest order</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}><RiskDot score={stat.worst} /><span style={{ fontSize: 14, fontWeight: 700, color: L.riskColor(P, stat.band), fontFamily: P.fontMono }}>{Math.round(stat.worst * 100)}%</span></div>
        <div style={{ fontSize: 9, color: P.inkMute, marginTop: 2 }}>on-time chance</div>
      </div>
    </div>
    <div style={{ padding: '2px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {variant === 'drivers' && (() => { const rd = stat.ds.filter((d) => d.status !== 'oos'); return <>
        {rd.length === 0 && <span style={{ fontSize: 10.5, color: P.inkMute }}>No drivers on shift</span>}
        {rd.slice(0, 4).map((d) => { const bm = d.status === 'break' || d.status === 'meal'; const sc = d.status === 'idle' ? P.warn : bm ? P.info : P.good; const oc = d.load >= 3 ? P.bad : d.load >= 2 ? P.warn : P.good; return <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: sc, flex: '0 0 auto' }} />
          <span style={{ color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{d.name}</span>
          {bm ? <span style={{ fontSize: 9.5, fontWeight: 700, color: P.info }}>{d.status === 'meal' ? 'Meal' : 'Break'}</span> : <><BarMeter value={d.load} max={4} width={46} height={4} color={oc} /><span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkDim }}>{d.load}/4</span></>}
        </div>; })}
      </>; })()}
      {variant === 'sla' && <>
        {assigned.length === 0 && <span style={{ fontSize: 10.5, color: P.inkMute }}>No active stops</span>}
        {assigned.slice(0, 3).map((o) => <div key={o.id} onClick={() => onOpen && onOpen(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: onOpen ? 'pointer' : 'default' }}>
          <span style={{ fontFamily: P.fontMono, color: P.inkDim, width: 34 }}>#{o.id}</span>
          <RiskBar score={o.risk} width={64} />
          <span style={{ fontFamily: P.fontMono, fontSize: 10, color: o.late ? P.bad : P.inkMute, marginLeft: 'auto' }}>{o.late ? '+' + o.late + 'm late' : 'due ' + o.deadline}</span>
        </div>)}
      </>}
      {variant === 'orders' && <>
        {assigned.slice(0, 3).map((o) => <div key={o.id} onClick={() => onOpen && onOpen(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, cursor: onOpen ? 'pointer' : 'default' }}>
          <RiskDot score={o.risk} size={7} />
          <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>#{o.id}</span>
          <span style={{ color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{o.driver}</span>
          {o.late ? <span style={{ color: P.bad, fontWeight: 700, fontFamily: P.fontMono, fontSize: 10.5 }}>+{o.late}m</span> : <span style={{ color: P.inkMute, fontFamily: P.fontMono, fontSize: 10.5 }}>{o.deadline}</span>}
        </div>)}
        {assigned.length === 0 && <span style={{ fontSize: 10.5, color: P.inkMute }}>No active stops</span>}
        {assigned.length > 3 && <span style={{ fontSize: 10.5, color: P.inkMute }}>+{assigned.length - 3} more</span>}
      </>}
    </div>
    <div style={{ marginTop: 'auto', display: 'flex', gap: 7, padding: '10px 14px', borderTop: `1px solid ${P.hairline}` }}>
      <PBtn size="xs" variant="secondary" icon="refresh" onClick={() => onAct && onAct('rebalance', stat.code)}>Rebalance</PBtn>
      <div style={{ flex: 1 }} />
      <IconBtn icon="chevron-right" size={16} style={{ width: 28, height: 28 }} />
    </div>
  </div>;
};

Object.assign(window, {});
