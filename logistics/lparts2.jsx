// ── Hyperdrive Logistics — order row, driver lane, action-queue item ────────
const useP = window.useP;
const L = window.LDATA;
const _money = (n) => window.HW ? window.HW.fmt.money(n) : '$' + Number(n).toFixed(2);

// ── Order triage row (dense list) ───────────────────────────────────────────
window.LOrderRow = function LOrderRow({ o, drivers, onReassign, onFlash, up, first }) {
  const P = useP();
  const band = L.riskBand(o.risk); const c = L.riskColor(P, band);
  const d = o.driver ? L.DRIVER_BY_NAME[o.driver] : null;
  return <div style={{ display: 'grid', gridTemplateColumns: '52px 1.7fr 96px 1.3fr 118px 150px 116px', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: first ? 'none' : `1px solid ${P.hairline}`, background: band === 'bad' ? P.badSoft : 'transparent' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 3, height: 30, borderRadius: 2, background: c }} /><span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: P.ink }}>{o.id}</span></div>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.recipient}</span>{o.speed === 'ASAP' ? <Pill kind="bad" style={{ fontSize: 10, padding: '1px 6px' }}>ASAP</Pill> : <Pill kind="info" style={{ fontSize: 10, padding: '1px 6px' }}>Sched</Pill>}</div>
      <div style={{ fontSize: 11.5, color: P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.addr}{o.cash ? ` · $${o.cash} cash` : ''}</div>
    </div>
    <RegionTag code={o.region} showCity={false} />
    <div style={{ minWidth: 0 }}>{d ? <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar name={d.name} size={24} /><span style={{ fontSize: 12.5, color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span></span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: P.bad }}><Icon name="user-off" size={15} />Unassigned</span>}</div>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontFamily: P.fontMono, color: o.late ? P.bad : P.ink2 }}>{o.eta || '—'}{o.late ? <span style={{ fontWeight: 700 }}> +{o.late}m</span> : ''}</div>
      <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>SLA {o.deadline}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><RiskBar score={o.risk} width={62} /><span style={{ fontSize: 11.5, fontWeight: 700, color: c, fontFamily: P.fontMono }}>{Math.round(o.risk * 100)}%</span></div>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><LOrderActions order={o} drivers={drivers} onReassign={onReassign} onFlash={onFlash} up={up} /></div>
  </div>;
};

// ── Status menu (fixed-positioned so it never clips) ────────────────────────
function StatusMenu({ driver, anchor, onClose, onFlash }) {
  const P = useP();
  React.useEffect(() => { const off = (e) => { if (!e.target.closest('[data-statusmenu]')) onClose(); }; document.addEventListener('pointerdown', off, true); return () => document.removeEventListener('pointerdown', off, true); }, []);
  const items = driver.status === 'oos' ? [['Return to service', 'user-check']]
    : [['Start 1st break (10 min)', 'clock'], ['Start 1st meal (30 min)', 'clock'], ['Return to HQ', 'arrow-right'], ['Set out of service', 'truck']];
  const W = 210, H = items.length * 38 + 12;
  const left = Math.max(12, Math.min(anchor.x - W, window.innerWidth - W - 12));
  const top = Math.max(12, anchor.y - H - 6);
  return <div data-statusmenu style={{ position: 'fixed', left, top, width: W, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 300, padding: 6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute, padding: '4px 8px 6px' }}>{driver.name.split(' ')[0]} · set status</div>
    {items.map(([lb, ic]) => <button key={lb} onClick={() => { onFlash(`${driver.name}: ${lb}`); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: P.r8, cursor: 'pointer', color: P.ink, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans, textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}><Icon name={ic} size={14} color={P.inkDim} />{lb}</button>)}
  </div>;
}

// ── Driver lane (capacity kanban) ───────────────────────────────────────────
window.LDriverLane = function LDriverLane({ driver, orders, drivers, onReassign, onFlash }) {
  const P = useP();
  const c = L.regionColor(driver.region);
  const stops = orders.filter((o) => o.driver === driver.name && !o.sched).sort((a, b) => a.risk - b.risk);
  const st = driver.status;
  const stMap = { duty: { k: 'good', t: 'On duty' }, idle: { k: 'warn', t: 'Idle' }, break: { k: 'info', t: 'On break' }, meal: { k: 'accent', t: 'On meal' }, oos: { k: 'bad', t: 'Out of service' } }[st];
  const over = st === 'duty' && stops.length >= 3;
  const [sm, setSm] = React.useState(null);
  return <div style={{ width: 274, flex: '0 0 auto', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${over ? P.bad : P.hairline2}`, borderRadius: P.r14, overflow: 'hidden', maxHeight: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderBottom: `1px solid ${P.hairline}`, borderTop: `3px solid ${c}` }}>
      <Icon name="drag" size={14} color={P.inkFaint} />
      <Avatar name={driver.name} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{driver.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><RegionTag code={driver.region} size="sm" /><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{driver.vehicle}</span></div>
      </div>
      <Pill kind={stMap.k} dot>{stMap.t}</Pill>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>Load</span>
      <BarMeter value={stops.length} max={4} color={over ? P.bad : c} height={5} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: over ? P.bad : P.ink2, fontFamily: P.fontMono }}>{stops.length}/4</span>
    </div>
    <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', minHeight: 90 }}>
      {st === 'oos' && <div style={{ textAlign: 'center', padding: '18px 8px', color: P.bad }}><Icon name="truck" size={22} /><div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>Out of service</div><div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 2 }}>{driver.reason}</div></div>}
      {(st === 'break' || st === 'meal') && <div style={{ textAlign: 'center', padding: '18px 8px', color: driver.brk > driver.brkPlan ? P.warn : P.info }}><Icon name="clock" size={22} /><div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{st === 'meal' ? (driver.mealType || 'Meal') : `${driver.brk} min break`}</div><div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 2 }}>{driver.brk} of {driver.brkPlan} min{driver.brk > driver.brkPlan ? ' · over plan' : ''}</div></div>}
      {st === 'idle' && stops.length === 0 && <div style={{ border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, padding: '16px 8px', textAlign: 'center', color: P.inkDim }}><Icon name="package" size={20} color={P.warn} /><div style={{ fontSize: 11.5, fontWeight: 700, color: P.warn, marginTop: 6 }}>Idle {driver.idle} min</div><div style={{ fontSize: 11.5, marginTop: 2 }}>Available — drag an order here</div></div>}
      {stops.map((o, i) => { const band = L.riskBand(o.risk); const bc = L.riskColor(P, band); const cu = L.customerOf(o.recipient); const tt = L.orderTotals(o.items); const tier = L.TIER[cu.tier]; const hi = tt.total >= 60;
        return <div key={o.id} style={{ position: 'relative', display: 'flex', gap: 8, padding: '8px 9px', background: band === 'bad' ? P.badSoft : P.surface2, border: `1px solid ${band === 'bad' ? bc : P.hairline}`, borderRadius: P.r10 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, background: P.surface3, color: P.inkDim, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontFamily: P.fontMono }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: P.ink }}>#{o.id}</span><RiskDot score={o.risk} size={6} />{cu.tier !== 'Regular' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 800, color: cu.tier === 'VIP' ? '#1A1400' : tier.c, background: cu.tier === 'VIP' ? tier.c : tier.c + '22', borderRadius: 5, padding: '1px 5px' }}><Icon name={tier.ic} size={9} />{cu.tier === 'VIP' ? 'VIP' : 'NEW'}</span>}{hi && <span style={{ fontSize: 10, fontWeight: 800, color: P.accent }} title="High-value — priority">★</span>}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{o.addr}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 6 }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>ETA</div><div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}><span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: o.late ? P.bad : P.ink }}>{o.eta || '—'}</span>{o.late ? <span style={{ fontFamily: P.fontMono, fontSize: 10, fontWeight: 800, color: '#fff', background: P.bad, borderRadius: 5, padding: '0 4px' }}>+{o.late}m</span> : null}</div></div>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>SLA</div><div style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 600, color: P.ink2, marginTop: 1 }}>{o.deadline}</div></div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Total</div><div style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 800, color: hi ? P.accent : P.ink, marginTop: 1 }}>{_money(tt.total)}</div></div>
            </div>
          </div>
          <LOrderActions order={o} drivers={drivers} onReassign={onReassign} onFlash={onFlash} vertical />
        </div>; })}
    </div>
    <div style={{ display: 'flex', gap: 6, padding: '9px 11px', borderTop: `1px solid ${P.hairline}` }}>
      <PBtn size="xs" variant="ghost" icon="phone" onClick={() => onFlash(`Calling ${driver.name}…`)}>Call</PBtn>
      <PBtn size="xs" variant="ghost" icon="chat" onClick={() => onFlash(`Message sent to ${driver.name}`)}>Message</PBtn>
      <div style={{ flex: 1 }} />
      <PBtn size="xs" variant="soft" icon="sliders" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSm({ x: r.right, y: r.top }); }}>Status</PBtn>
    </div>
    {sm && <StatusMenu driver={driver} anchor={sm} onClose={() => setSm(null)} onFlash={onFlash} />}
  </div>;
};

// ── Compact action-queue item (Map rail) ────────────────────────────────────
window.LQueueItem = function LQueueItem({ o, drivers, onReassign, onFlash, up }) {
  const P = useP();
  const band = L.riskBand(o.risk); const c = L.riskColor(P, band);
  return <div style={{ padding: '11px 13px', background: band === 'bad' ? P.badSoft : P.surface2, border: `1px solid ${band === 'bad' ? c : P.hairline2}`, borderLeft: `3px solid ${c}`, borderRadius: P.r10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: P.ink }}>#{o.id}</span>
      <RegionTag code={o.region} size="sm" />
      {o.late ? <span style={{ fontSize: 11.5, fontWeight: 700, color: P.bad, fontFamily: P.fontMono }}>+{o.late}m late</span> : <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>SLA {o.deadline}</span>}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c, fontFamily: P.fontMono }}>{Math.round(o.risk * 100)}%</span>
    </div>
    <div style={{ fontSize: 11.5, color: P.ink2, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.recipient} · {o.addr}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
      <span style={{ flex: 1, fontSize: 11.5, color: o.driver ? P.inkDim : P.bad, fontWeight: o.driver ? 500 : 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.driver || 'No driver — engine found no candidate'}</span>
      <LOrderActions order={o} drivers={drivers} onReassign={onReassign} onFlash={onFlash} up={up} />
    </div>
  </div>;
};

Object.assign(window, {});
