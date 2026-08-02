// ── Weedmaps channel — integrated into the Promotions Suite (pweb) ──────────
// How Weedmaps plugs into Hyperwolf: orders → regions → drivers, sync health,
// and reconciling WM promotions against ours. Uses WM_* data from promo/pdata.
const useP = window.useP;
const { pfmt, WM_ONLY_PROMOS, WM_REGIONS, WM_LISTINGS, WM_STORE, WM_SYNC, WM_ORDER_FLOW, WM_AUTOMATION } = window;

const WM_ACTOR = { Weedmaps:'#1F5FC0', Hyperwolf:'#15140F', Driver:'#2E7D46', Store:'#B7791F' };

// deterministic WM sync state for a Suite promo (this dataset has no wm field yet)
function wmStateFor(p, i) {
  if (p.status === 'scheduled' || p.status === 'draft') return 'not_pushed';
  if (p.status === 'paused') return 'paused';
  if (p.status === 'ended') return 'ended';
  if (i === 2) return 'overlap';
  return 'synced';
}

function WmPanel({ title, sub, right, children, pad = 18 }) {
  const P = useP();
  return (
    <div style={{ background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r14, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:`1px solid ${P.hairline}` }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{title}</div>
          {sub && <div style={{ fontSize:11.5, color:P.inkDim, marginTop:2, lineHeight:1.45 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding:pad }}>{children}</div>
    </div>);
}

function WmActorChip({ actor }) {
  const c = WM_ACTOR[actor] || '#7C7869';
  return <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.04em', textTransform:'uppercase', color:'#fff', background:c, borderRadius:20, padding:'2px 8px', whiteSpace:'nowrap' }}>{actor}</span>;
}

function WmOrderFlow() {
  const P = useP();
  return (
    <div style={{ display:'flex', gap:0, overflowX:'auto', paddingBottom:4 }}>
      {WM_ORDER_FLOW.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ flex:'1 0 148px', minWidth:148, background: s.key ? P.accentSoft : P.surface2, border:`1px solid ${s.key ? P.accentBorder : P.hairline2}`, borderRadius:P.r12, padding:'11px 13px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
              <WmActorChip actor={s.actor} /><span style={{ fontFamily:P.fontMono, fontSize:10, fontWeight:800, color:P.inkFaint }}>{i + 1}</span>
            </div>
            <div style={{ fontSize:12.5, fontWeight:700, color:P.ink, lineHeight:1.25, marginBottom:3 }}>{s.t}</div>
            <div style={{ fontSize:10.5, color:P.inkDim, lineHeight:1.4 }}>{s.d}</div>
          </div>
          {i < WM_ORDER_FLOW.length - 1 && <div style={{ display:'flex', alignItems:'center', color:P.inkFaint, padding:'0 3px' }}><Icon name="chevron-right" size={16} stroke={2.2} /></div>}
        </React.Fragment>))}
    </div>);
}

function WmRegionMap() {
  const P = useP();
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', minWidth:620, borderCollapse:'collapse', fontSize:12.5 }}>
        <thead><tr style={{ background:P.surface2 }}>
          {['Region', 'Zip codes', 'Drivers (on-shift feed the listing)', 'Feeds'].map((h, i) => (
            <th key={i} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>))}
        </tr></thead>
        <tbody>
          {WM_REGIONS.map((r) => {
            const on = r.drivers.filter((d) => d.on).length; const L = WM_LISTINGS[r.listing];
            return (
              <tr key={r.region}>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontWeight:700, color:P.ink }}>{r.region}<div style={{ fontSize:10, fontWeight:500, color: on ? P.good : P.warn, fontFamily:P.fontMono }}>{on}/{r.drivers.length} on shift</div></td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontFamily:P.fontMono, fontSize:11, color:P.ink2 }}>{r.zips.join(' · ')}</td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {r.drivers.map((d) => (
                      <span key={d.n} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background: d.on ? P.goodSoft : P.neutralSoft, color: d.on ? P.good : P.inkDim }}>
                        <span style={{ width:6, height:6, borderRadius:99, background: d.on ? P.good : P.inkMute }} />{d.n} · {d.kit} SKUs</span>))}
                  </div>
                </td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}><Pill kind={L.kind === 'Pickup' ? 'warn' : 'info'} dot>{L.kind}</Pill></td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>);
}

// ── full Weedmaps promotions table — every parameter WM exposes + mapping ──
function wmCents(c) { return c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function wmYN(b) { return b ? 'Yes' : 'No'; }
function wmArr(a) { return a && a.length ? a.join(', ') : '—'; }
function wmVal(v) { return v == null || v === '' ? '—' : v; }
function wmMapPill(m) {
  if (m.state === 'mapped') return <Pill kind="good" dot>Mapped</Pill>;
  if (m.state === 'standalone') return <Pill kind="info" dot>Standalone</Pill>;
  return <Pill kind={m.overlap ? 'bad' : 'warn'} dot>Unmapped</Pill>;
}
function WmField({ label, value, mono }) {
  const P = useP();
  return <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:P.inkMute }}>{label}</span>
    <span style={{ fontSize:12, color:P.ink, fontFamily: mono ? P.fontMono : P.fontSans, wordBreak:'break-word' }}>{value}</span>
  </div>;
}
function WmGroup({ title, children }) {
  const P = useP();
  return <div>
    <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:P.inkDim, marginBottom:9 }}>{title}</div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'12px 16px' }}>{children}</div>
  </div>;
}
function WmPromoDetail({ p, onOpen, onOpenWm }) {
  const P = useP();
  const minSpend = p.min_spend_cents != null ? wmCents(p.min_spend_cents) : (p.min_spend ? '$' + p.min_spend : '$0');
  return <div style={{ background:P.surface2, borderTop:`1px solid ${P.hairline2}`, padding:'16px 18px', display:'flex', flexDirection:'column', gap:18 }}>
    <WmGroup title="Offer">
      <WmField label="Promo type" value={wmVal(p.promo_type)} />
      <WmField label="Display" value={wmVal(p.display)} />
      <WmField label="Discount value" value={`${p.discount_value}${p.discount_unit}`} />
      <WmField label="Applies" value={wmVal(p.apply)} />
      <WmField label="Code" value={wmVal(p.code)} mono />
      <WmField label="Stackable" value={wmYN(p.stackable)} />
      <WmField label="Priority" value={wmVal(p.priority)} />
      <WmField label="Max discount" value={wmCents(p.max_discount_cents)} />
    </WmGroup>
    <WmGroup title="Targeting">
      <WmField label="Scope" value={wmVal(p.scope)} />
      <WmField label="Targets" value={wmArr(p.targets)} />
      <WmField label="Excludes" value={wmArr(p.excludes)} />
      <WmField label="Channel" value={wmVal(p.channel)} />
      <WmField label="WM menu ids" value={wmArr(p.wm_menu_ids)} mono />
    </WmGroup>
    <WmGroup title="Eligibility">
      <WmField label="Customer segment" value={wmVal(p.customer_segment)} />
      <WmField label="New-customer only" value={wmYN(p.new_customer_only)} />
      <WmField label="First-order only" value={wmYN(p.first_order_only)} />
      <WmField label="Min spend" value={minSpend} />
      <WmField label="Min items" value={wmVal(p.min_items)} />
      <WmField label="Usage limit" value={wmVal(p.usage_limit)} />
      <WmField label="Per-customer limit" value={wmVal(p.per_customer_limit)} />
    </WmGroup>
    <WmGroup title="Schedule">
      <WmField label="Status" value={wmVal(p.status)} />
      <WmField label="Start" value={wmVal(p.start)} mono />
      <WmField label="End" value={wmVal(p.end)} mono />
      <WmField label="Recurrence" value={wmVal(p.recurrence)} />
      <WmField label="Dayparts" value={wmVal(p.dayparts)} />
    </WmGroup>
    <WmGroup title="Performance">
      <WmField label="Redemptions" value={pfmt.num(p.redemptions)} />
      <WmField label="Revenue" value={wmCents(p.revenue_cents)} />
      <WmField label="Discount cost" value={wmCents(p.discount_cost_cents)} />
    </WmGroup>
    <WmGroup title="Sync & mapping">
      <WmField label="Created source" value={wmVal(p.created_source)} />
      <WmField label="external_id (our link)" value={wmVal(p.external_id)} mono />
      <WmField label="Weedmaps id" value={wmVal(p.wm_id)} mono />
      <WmField label="Created at" value={wmVal(p.created_at)} mono />
      <WmField label="Updated at" value={wmVal(p.updated_at)} mono />
      <WmField label="Last synced" value={wmVal(p.last_synced)} />
      <WmField label="Mapping" value={p.mapping.state} />
      <WmField label="Mapped to" value={wmVal(p.mapping.internal)} />
      <WmField label="Match confidence" value={p.mapping.confidence ? Math.round(p.mapping.confidence * 100) + '%' : '—'} />
      <WmField label="Overlap with" value={wmVal(p.mapping.overlap_with)} />
    </WmGroup>
    {p.mapping.note && <div style={{ fontSize:11.5, color:P.inkDim, lineHeight:1.5, fontStyle:'italic' }}>{p.mapping.note}</div>}
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:2 }}>
      <PBtn variant="secondary" size="sm" icon="eye" onClick={() => onOpenWm && onOpenWm(p)}>Open in builder (read-only)</PBtn>
      {p.mapping.state === 'mapped' ? <><PBtn variant="secondary" size="sm" onClick={() => onOpen && onOpen(p.mapping.internal_id)}>View internal promo</PBtn><PBtn variant="ghost" size="sm">Unlink</PBtn></> :
        <><PBtn variant="primary" size="sm">Link to an internal promo</PBtn><PBtn variant="secondary" size="sm">Merge into new promo</PBtn><PBtn variant="ghost" size="sm">Keep standalone</PBtn></>}
    </div>
  </div>;
}
function WmPromoTable({ onOpen, onOpenWm }) {
  const P = useP();
  const [open, setOpen] = React.useState(null);
  const rows = window.WM_PROMOS || [];
  const th = (t, r) => <th style={{ textAlign: r ? 'right' : 'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}`, whiteSpace:'nowrap' }}>{t}</th>;
  const td = { padding:'12px 14px', borderTop:`1px solid ${P.hairline}`, verticalAlign:'middle' };
  return <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', minWidth:820, borderCollapse:'collapse', fontSize:12.5 }}>
      <thead><tr style={{ background:P.surface2 }}>{th('Weedmaps promotion')}{th('Type')}{th('Discount')}{th('Scope')}{th('Channel')}{th('Status')}{th('Redeemed', true)}{th('Mapping')}{th('')}</tr></thead>
      <tbody>
        {rows.map((p) => {
          const isOpen = open === p.wm_id;
          return <React.Fragment key={p.wm_id}>
            <tr onClick={() => setOpen(isOpen ? null : p.wm_id)} style={{ cursor:'pointer', background: isOpen ? P.surface2 : 'transparent' }}>
              <td style={td}><div style={{ fontWeight:600, color:P.ink }}>{p.name}</div><div style={{ fontSize:10, color:P.inkMute, fontFamily:P.fontMono }}>{p.wm_id}</div></td>
              <td style={td}><Pill kind="ghost">{p.promo_type}</Pill></td>
              <td style={{ ...td, fontFamily:P.fontMono, fontWeight:600 }}>{p.display}</td>
              <td style={td}>{p.scope}{p.targets && p.targets.length ? <span style={{ color:P.inkMute }}> · {p.targets.join(', ')}</span> : ''}</td>
              <td style={td}><Pill kind={p.channel === 'both' ? 'neutral' : p.channel === 'delivery' ? 'info' : 'warn'}>{p.channel}</Pill></td>
              <td style={td}>{window.statusPill ? window.statusPill(p.status === 'live' ? 'active' : p.status) : p.status}</td>
              <td style={{ ...td, textAlign:'right', fontFamily:P.fontMono, fontWeight:600 }}>{pfmt.num(p.redemptions)}</td>
              <td style={td}><div style={{ display:'flex', flexDirection:'column', gap:2 }}>{wmMapPill(p.mapping)}{p.mapping.internal && <span style={{ fontSize:10, color:P.inkMute, whiteSpace:'nowrap' }}>→ {p.mapping.internal}</span>}</div></td>
              <td style={{ ...td, textAlign:'right', color:P.inkMute }}><Icon name="chevron-down" size={15} stroke={2.2} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .15s' }} /></td>
            </tr>
            {isOpen && <tr><td colSpan={9} style={{ padding:0 }}><WmPromoDetail p={p} onOpen={onOpen} onOpenWm={onOpenWm} /></td></tr>}
          </React.Fragment>;
        })}
      </tbody>
    </table>
  </div>;
}

// ── Our promotions ⇄ Weedmaps ───────────────────────────────────────────────
// The actual sync surface: every Hyperwolf promotion, what state it is in on
// Weedmaps, and the one button that changes it. Pushing writes the state back
// onto the promo, so the Studio and the dashboard see it too.
const WM_STATE = {
  synced: { label:'Synced', kind:'good', dot:true },
  syncing: { label:'Pushing…', kind:'info', dot:true },
  not_pushed: { label:'Not pushed', kind:'neutral' },
  paused: { label:'Paused on WM', kind:'warn', dot:true },
  overlap: { label:'Overlaps a WM promo', kind:'bad', dot:true },
  ended: { label:'Ended', kind:'neutral' } };

function OurPromosOnWm({ promos, setPromos, onOpen }) {
  const P = useP();
  const [busy, setBusy] = React.useState({});
  const stateOf = (p, i) => busy[p.id] || (p.wm && p.wm.state) || wmStateFor(p, i);
  const patch = (id, wm) => setPromos && setPromos((prev) => prev.map((x) => x.id === id ? { ...x, wm: { ...x.wm, ...wm } } : x));
  const stamp = () => new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  const push = (p, next) => {
    setBusy((b) => ({ ...b, [p.id]: 'syncing' }));
    setTimeout(() => {
      setBusy((b) => {const n = { ...b };delete n[p.id];return n;});
      patch(p.id, { state: next, pushedAt: stamp(), wmId: (p.wm && p.wm.wmId) || 'wmp_' + String(p.id).replace(/\D/g, '').slice(-6).padStart(6, '0') });
    }, 900);
  };
  const th = (t, r) => <th style={{ textAlign: r ? 'right' : 'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}`, whiteSpace:'nowrap' }}>{t}</th>;
  const td = { padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, verticalAlign:'middle' };

  return <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', minWidth:860, borderCollapse:'collapse', fontSize:12.5 }}>
      <thead><tr style={{ background:P.surface2 }}>{th('Hyperwolf promotion')}{th('Runs on')}{th('Weedmaps ID')}{th('Sync state')}{th('Last push', true)}{th('')}</tr></thead>
      <tbody>
        {promos.map((p, i) => {
          const st = stateOf(p, i), m = WM_STATE[st] || WM_STATE.not_pushed;
          const live = p.status === 'active' || p.status === 'live';
          return <tr key={p.id}>
            <td style={td}>
              <div onClick={() => onOpen && onOpen(p.id)} style={{ fontWeight:600, color:P.ink, cursor:'pointer' }}>{p.name}</div>
              <div style={{ fontSize:10, color:P.inkMute, fontFamily:P.fontMono }}>{p.code || p.id}</div>
            </td>
            <td style={td}><div style={{ display:'flex', gap:5 }}>
              <Pill kind={live ? 'warn' : 'ghost'}>Pickup</Pill><Pill kind={live ? 'info' : 'ghost'}>Delivery</Pill>
            </div></td>
            <td style={{ ...td, fontFamily:P.fontMono, color: p.wm && p.wm.wmId ? P.ink2 : P.inkFaint }}>{p.wm && p.wm.wmId || '—'}</td>
            <td style={td}><Pill kind={m.kind} dot={m.dot}>{m.label}</Pill></td>
            <td style={{ ...td, textAlign:'right', fontFamily:P.fontMono, color:P.inkMute }}>{p.wm && p.wm.pushedAt || '—'}</td>
            <td style={{ ...td, textAlign:'right' }}>
              {st === 'syncing' ? <span style={{ fontSize:11.5, color:P.info, fontWeight:600 }}>Pushing…</span> :
              st === 'overlap' ? <PBtn variant="primary" size="xs" icon="shield" onClick={() => push(p, 'synced')}>Resolve &amp; push</PBtn> :
              st === 'not_pushed' ? <PBtn variant="accent" size="xs" icon="arrow-up" onClick={() => push(p, 'synced')}>Push to WM</PBtn> :
              st === 'paused' ? <PBtn variant="secondary" size="xs" icon="refresh" onClick={() => push(p, 'synced')}>Resume</PBtn> :
              st === 'ended' ? <span style={{ fontSize:11.5, color:P.inkFaint }}>—</span> :
              <div style={{ display:'inline-flex', gap:5 }}>
                <PBtn variant="secondary" size="xs" icon="refresh" onClick={() => push(p, 'synced')}>Re-sync</PBtn>
                <PBtn variant="ghost" size="xs" onClick={() => patch(p.id, { state:'paused' })}>Pause</PBtn>
              </div>}
            </td>
          </tr>;
        })}
        {promos.length === 0 && <tr><td colSpan={6} style={{ padding:34, textAlign:'center', color:P.inkMute }}>No promotions yet.</td></tr>}
      </tbody>
    </table>
  </div>;
}

window.WeedmapsView = function WeedmapsView({ promos = [], setPromos, onOpen, onOpenWm }) {
  const P = useP();
  const withWm = promos.map((p, i) => ({ p, state: p.wm && p.wm.state || wmStateFor(p, i) }));
  const synced = withWm.filter((x) => x.state === 'synced').length;
  const notPushed = withWm.filter((x) => x.state === 'not_pushed').length;

  const kpis = [
    { label:'Products mapped', value:`${WM_SYNC.productsMapped}/${WM_SYNC.productsTotal}`, sublabel:`${WM_SYNC.review} in review`, icon:'package' },
    { label:'Promos synced', value:`${synced}/${promos.length}`, sublabel:`${notPushed} not pushed`, icon:'gift' },
    { label:'WM orders today', value:pfmt.num(WM_SYNC.ordersToday), sublabel:'auto-routed', icon:'truck' },
    { label:'Push latency', value:`${WM_SYNC.p50}ms`, sublabel:`p95 ${WM_SYNC.p95}ms`, icon:'refresh' },
    { label:'Sync errors 60s', value:WM_SYNC.errors, sublabel:`reconcile ${WM_SYNC.lastReconcile}`, icon:'shield', accent:WM_SYNC.errors > 0 },
    { label:'API token', value:`${WM_SYNC.tokenDays}d`, sublabel:'auto-renews', icon:'clock' },
  ];

  return (
    <div style={{ maxWidth:1320, margin:'0 auto' }}>
      <SectionHead level={1} eyebrow="Channel" title="Weedmaps"
        subtitle="How Weedmaps plugs into Hyperwolf — orders, regions, drivers and promotions. Almost all of it runs in the background; you only step in when the logic can’t resolve something itself."
        action={<Pill kind="good" dot>Live · event-driven</Pill>} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:22 }}>
        {kpis.map((k) => <KPI key={k.label} {...k} />)}
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="Your promotions on Weedmaps" pad={0}
          sub={`Every Hyperwolf promotion and where it stands on the channel. Pushing sends the offer to both listings — it lands inside the five-second Draft window, so a cart being built right now picks it up.`}
          right={<div style={{ display:'flex', gap:6 }}><Pill kind="good" dot>{synced} synced</Pill><Pill kind="neutral">{notPushed} not pushed</Pill></div>}>
          <OurPromosOnWm promos={promos} setPromos={setPromos} onOpen={onOpen} />
        </WmPanel>
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="How a Weedmaps order reaches a driver" sub="A customer’s cart on Weedmaps becomes a routed, driver-assigned order in seconds. Highlighted steps are where our logic decides who can fulfil it.">
          <WmOrderFlow />
          <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10, padding:'11px 13px' }}>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.info, marginBottom:4 }}>Delivery orders</div>
              <div style={{ fontSize:12, color:P.ink2, lineHeight:1.55 }}>Come from Weedmaps → we resolve <b>zip → region → one on-shift driver</b>, and only offer SKUs in that driver’s kit. The order binds to that driver.</div>
            </div>
            <div style={{ background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10, padding:'11px 13px' }}>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.warn, marginBottom:4 }}>Pickup orders</div>
              <div style={{ fontSize:12, color:P.ink2, lineHeight:1.55 }}>Also from Weedmaps, but fulfilled from <b>store on-hand stock</b> — no driver, no routing. The order binds to the <b>{WM_STORE.name}</b> store and is marked ready for pickup.</div>
            </div>
          </div>
        </WmPanel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16, marginBottom:22 }}>
        <WmPanel title="Regions → drivers → Weedmaps listing" sub="Each region maps to a set of zips and drivers. On-shift drivers’ kits decide what the Delivery listing can sell right now.">
          <WmRegionMap />
        </WmPanel>
        <WmPanel title="The two Weedmaps listings" sub="Same catalog, different availability rules.">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {Object.values(WM_LISTINGS).map((l) => (
              <div key={l.id} style={{ border:`1px solid ${P.hairline2}`, borderLeft:`3px solid ${l.kind === 'Pickup' ? P.warn : P.info}`, borderRadius:P.r10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:P.ink }}>{l.name}</span>
                  <Pill kind={l.kind === 'Pickup' ? 'warn' : 'info'}>{l.kind}</Pill>
                </div>
                <div style={{ fontSize:11, color:P.inkDim, fontFamily:P.fontMono, marginBottom:4 }}>wmid {l.id} · {l.policy}</div>
                <div style={{ fontSize:11.5, color:P.ink2, lineHeight:1.45 }}>{l.desc}</div>
              </div>))}
          </div>
        </WmPanel>
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="What runs itself — and when we ask a human" sub="Mapping and routing are automated end-to-end. A person is only pulled in for the cases the logic can’t safely resolve.">
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:680, borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:P.surface2 }}>
                {['Area', 'How it works', 'Automatic', 'Needs a human'].map((h, i) => (
                  <th key={i} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>))}
              </tr></thead>
              <tbody>
                {WM_AUTOMATION.map((a) => (
                  <tr key={a.area}>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontWeight:700, color:P.ink, whiteSpace:'nowrap' }}>{a.area}</td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, color:P.ink2, lineHeight:1.45 }}>{a.how}</td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}><span style={{ display:'inline-flex', alignItems:'center', gap:6, color:P.good, fontWeight:600 }}><Icon name="check" size={13} stroke={2.6} />{a.auto}</span></td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, color:P.warn, fontWeight:600 }}>{a.human}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </WmPanel>
      </div>

      <div>
        <WmPanel title="Every Weedmaps promotion" sub="All promos live on Weedmaps — whether mapped to one of ours, kept standalone, or unmapped and awaiting a decision. Click any row to expose every Weedmaps parameter." pad={0}
          right={<div style={{ display:'flex', gap:6 }}><Pill kind="good" dot>{(window.WM_PROMOS||[]).filter(p=>p.mapping.state==='mapped').length} mapped</Pill><Pill kind="info" dot>{(window.WM_PROMOS||[]).filter(p=>p.mapping.state==='standalone').length} standalone</Pill><Pill kind="warn" dot>{(window.WM_PROMOS||[]).filter(p=>p.mapping.state==='unmapped').length} unmapped</Pill></div>}>
          <WmPromoTable onOpen={onOpen} onOpenWm={onOpenWm} />
        </WmPanel>
      </div>
    </div>);
};
