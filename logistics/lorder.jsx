// ── Hyperdrive Logistics — live pin map + order detail (logistics + POS) ────
const useP = window.useP;
const L = window.LDATA;
const money = (n) => window.HW ? window.HW.fmt.money(n) : '$' + Number(n).toFixed(2);
const catColor = (c) => window.HW && window.HW.CAT_COLOR[c] || '#6E6E66';

// Module-level so identity is stable across renders. Defining these inside the
// render function remounts the whole subtree on every state change — which
// collapses the scroll container back to the top when you add/select an item.
function Sec({ children, bt }) { const P = useP(); return <div style={{ padding: '12px 16px', borderTop: bt ? `1px solid ${P.hairline}` : 'none' }}>{children}</div>; }
function Lbl({ children }) { const P = useP(); return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>{children}</div>; }
function CatChip({ on, onClick, icon, color, children }) { const P = useP(); return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 99, border: `1.5px solid ${on ? color || P.accentBorder : P.hairline2}`, background: on ? color ? color + '22' : P.accentSoft : 'transparent', color: on ? color || (P.mode === 'dark' ? P.accent : '#7A5A00') : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{icon && <Icon name={icon} size={13} stroke={2} />}{children}</button>; }
function CatPCard({ p, rec, qty, onQty }) {
  const P = useP();
  return <div style={{ display: 'flex', gap: 10, padding: 9, background: P.surface2, border: `1px solid ${qty ? P.accentBorder : P.hairline}`, borderRadius: P.r10 }}>
    <div style={{ position: 'relative', flex: '0 0 auto' }}><Thumb item={p} size={46} radius={9} />{p.was && <span style={{ position: 'absolute', top: -5, left: -5, padding: '1px 5px', borderRadius: 6, background: P.accent, color: P.accentInk, fontSize: 10, fontWeight: 800 }}>-{Math.round((1 - p.price / p.was) * 100)}%</span>}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: catColor(p.cat), background: catColor(p.cat) + '22', borderRadius: 5, padding: '1px 6px', flex: '0 0 auto' }}>{p.cat}</span>
        {p.thc != null && <span style={{ fontSize: 10, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{p.thc}% THC</span>}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span>{p.brand}</span><span style={{ opacity: .5 }}>·</span><Icon name="box" size={10} color={P.inkMute} /><span>{L.boxOf(p)}</span></div>
      {rec ? <div style={{ fontSize: 10, color: P.warn, fontWeight: 600, marginTop: 3 }}>{p._reason}</div> : <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(p.price)}</span>{p.was && <span style={{ fontSize: 10, color: P.inkMute, textDecoration: 'line-through', fontFamily: P.fontMono }}>{money(p.was)}</span>}</div>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>{qty ? <Stepper value={qty} onChange={onQty} size="sm" /> : <PBtn size="sm" variant="secondary" icon="plus" onClick={() => onQty(1)}>Add</PBtn>}</div>
  </div>;
}

// ── Live pin map — region backdrop + all delivery pins + driver route paths ─
window.LLiveMap = function LLiveMap({ orders, drivers, selectedId, onSelect, numById, showDrivers, showRoutes = true, detailForm, onReassign, onItems, onFlash }) {
  const P = useP();
  const sel = orders.find((o) => o.id === selectedId);
  const ref = React.useRef(null);
  const [dim, setDim] = React.useState({ w: 1, h: 1 });
  React.useLayoutEffect(() => {
    const el = ref.current;if (!el) return;
    const upd = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    upd();const ro = new ResizeObserver(upd);ro.observe(el);return () => ro.disconnect();
  }, []);
  const active = orders.filter((o) => !o.sched);
  return <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: P.r16, overflow: 'hidden', border: `1px solid ${P.hairline2}`, background: '#101014' }}>
    <window.DeliveryMap mode="filled" showBuffer showLabels={false} showPins={false} height="100%" />
    {/* route paths with direction arrows (pixel space so arrows angle correctly) */}
    {showRoutes && <svg width={dim.w} height={dim.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {drivers.filter((d) => d.status === 'duty').map((d) => {
        const stops = active.filter((o) => o.driver === d.name).sort((a, b) => b.risk < a.risk ? 1 : -1);
        if (!stops.length) return null;
        const c = L.regionColor(d.region);
        const pts = [[d.mx * dim.w, d.my * dim.h], ...stops.map((o) => [o.mx * dim.w, o.my * dim.h])];
        const path = 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
        return <g key={d.id}>
          <path d={path} fill="none" stroke={c} strokeWidth={2} strokeDasharray="5 4" opacity={0.9} strokeLinecap="round" />
          {pts.slice(1).map((p, i) => {const a = pts[i];const ang = Math.atan2(p[1] - a[1], p[0] - a[0]);const mx = a[0] + (p[0] - a[0]) * 0.55,my = a[1] + (p[1] - a[1]) * 0.55;const s = 5;
            return <path key={i} d={`M0,${-s} L${s * 1.6},0 L0,${s} Z`} fill={c} transform={`translate(${mx},${my}) rotate(${ang * 180 / Math.PI})`} />;})}
        </g>;
      })}
    </svg>}
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {L.REGIONS.map((r) => {const c = L.RMAP[r.code];if (!c) return null;return <div key={'lbl' + r.code} style={{ position: 'absolute', left: c[0] * 100 + '%', top: c[1] * 100 + '%', transform: 'translate(-50%,-50%)', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 99, background: 'rgba(12,12,10,.62)', border: `1px solid ${L.regionColor(r.code)}`, whiteSpace: 'nowrap', backdropFilter: 'blur(2px)' }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: L.regionColor(r.code) }} /><span style={{ fontFamily: P.fontMono, fontSize: 10, fontWeight: 800, color: '#fff' }}>{r.code}</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,.72)' }}>{r.city}</span>
      </div>;})}
      {showDrivers && drivers.filter((d) => ['duty', 'idle', 'break', 'meal'].includes(d.status)).map((d) => {
        const c = L.regionColor(d.region);const brk = d.status === 'break' || d.status === 'meal';
        return <div key={'d' + d.id} style={{ position: 'absolute', left: d.mx * 100 + '%', top: d.my * 100 + '%', transform: 'translate(-50%,-50%)', pointerEvents: 'auto' }} title={brk ? `${d.name} · ${d.status === 'meal' ? d.mealType || 'meal' : 'on break'}` : `${d.name} · ${d.load} stops`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 4px', background: brk ? P.info : d.status === 'idle' ? P.warn : c, borderRadius: 99, boxShadow: '0 2px 6px rgba(0,0,0,.5)', border: '2px solid rgba(255,255,255,.7)', opacity: brk ? .92 : 1 }}>
            {brk ? <Icon name="clock" size={12} color="#fff" stroke={2.2} /> : <><Icon name="truck" size={11} color="#fff" stroke={2} /><span style={{ fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: P.fontMono }}>{d.load}</span></>}
          </div>
        </div>;
      })}
      {active.map((o) => {
        const band = L.riskBand(o.risk);const c = L.riskColor(P, band);
        const un = !o.driver;const on = o.id === selectedId;const num = numById[o.id];
        return <div key={o.id} onClick={(e) => {e.stopPropagation();onSelect(o.id);}} style={{ position: 'absolute', left: o.mx * 100 + '%', top: o.my * 100 + '%', transform: `translate(-50%,-100%) scale(${on ? 1.2 : 1})`, pointerEvents: 'auto', cursor: 'pointer', zIndex: on ? 30 : un ? 20 : 10, transition: 'transform .12s' }}>
          <div style={{ position: 'relative', width: 30, height: 38, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.55))' }}>
            <svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 37C15 37 28 22 28 14A13 13 0 1 0 2 14C2 22 15 37 15 37Z" fill={un ? P.bad : c} stroke={on ? P.accent : '#fff'} strokeWidth={on ? 3 : 2} /></svg>
            <span style={{ position: 'absolute', top: 5, left: 0, right: 0, textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: un ? '#fff' : '#0b0b08', fontFamily: P.fontMono }}>{un ? '!' : num}</span>
          </div>
        </div>;
      })}
      {detailForm === 'popover' && sel && <div style={{ position: 'absolute', top: sel.my < .5 ? 14 : 'auto', bottom: sel.my < .5 ? 'auto' : 14, left: sel.mx > .5 ? 14 : 'auto', right: sel.mx > .5 ? 'auto' : 14, width: 388, maxHeight: 'calc(100% - 28px)', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden', pointerEvents: 'auto', zIndex: 50 }}>
        <window.LOrderDetail order={sel} drivers={drivers} onReassign={onReassign} onItems={onItems} onFlash={onFlash} onClose={() => onSelect(null)} />
      </div>}
    </div>
    <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 12px', background: 'rgba(12,12,10,.84)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, backdropFilter: 'blur(6px)' }}>
      {[[P.bad, 'Unassigned / at risk'], [P.warn, 'Tight SLA'], [P.good, 'On track']].map(([col, lb]) => <span key={lb} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,.8)' }}><span style={{ width: 9, height: 9, borderRadius: 99, background: col }} />{lb}</span>)}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,.8)' }}><span style={{ width: 14, borderTop: '2px dashed rgba(255,255,255,.7)' }} />driver route</span>
    </div>
  </div>;
};

// ── Inventory-aware inline reassign (inside detail panel) ───────────────────
function InlineReassign({ order, drivers, onReassign, onFlash }) {
  const P = useP();
  const all = L.candidatesFor(order, drivers).filter((c) => !c.current);
  const cands = all.slice(0, 4);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {cands.map((c) => {const dis = !c.stock;
      return <button key={c.d.id} onClick={() => !dis && (onReassign(order.id, c.d.name), onFlash(`#${order.id} → ${c.d.name}`))} disabled={dis} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: dis ? 'default' : 'pointer', textAlign: 'left', fontFamily: P.fontSans, opacity: dis ? .5 : 1 }}
      onMouseEnter={(e) => !dis && (e.currentTarget.style.borderColor = P.accentBorder)} onMouseLeave={(e) => e.currentTarget.style.borderColor = P.hairline2}>
        <Avatar name={c.d.name} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.d.name}{c.idle && <span style={{ fontSize: 10, fontWeight: 700, color: P.warn, marginLeft: 6 }}>IDLE</span>}</div>
          {c.stock ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><RegionTag code={c.d.region} size="sm" /><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{c.d.load} stops</span></div> :
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 10, fontWeight: 700, color: P.bad }}><Icon name="package" size={11} />No {c.missing.join(', ')} stock</div>}
        </div>
        {c.stock && <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13.5, fontWeight: 700, color: c.same ? P.good : P.ink, fontFamily: P.fontMono }}>{c.eta}<span style={{ fontSize: 10, color: P.inkMute }}>m</span></div><div style={{ marginTop: 2 }}><RiskBar score={c.score} width={38} height={4} /></div></div>}
        {c.stock && <Icon name="arrow-right" size={15} color={P.accent} />}
      </button>;})}
  </div>;
}

// ── Item swap picker — swap within category: similar · more potent · cheaper ─
function SwapPicker({ line, onSwap, onClose }) {
  const P = useP();
  const [mode, setMode] = React.useState('similar');
  const cur = line.p;
  const cat = cur ? cur.cat : '';
  const curThc = cur && cur.thc != null ? cur.thc : 0;
  const curPrice = cur ? cur.price : 0;
  const pool = (window.HW ? window.HW.PRODUCTS : []).filter((p) => p.qty > 0 && p.cat === cat && p.sku !== line.sku);
  let alts = pool;
  if (mode === 'potent') alts = pool.filter((p) => (p.thc || 0) > curThc).sort((a, b) => (b.thc || 0) - (a.thc || 0));
  else if (mode === 'cheaper') alts = pool.filter((p) => p.price < curPrice).sort((a, b) => a.price - b.price);
  else alts = pool.slice().sort((a, b) => Math.abs(a.price - curPrice) - Math.abs(b.price - curPrice));
  alts = alts.slice(0, 5);
  const modes = [['similar', 'Similar', 'swap'], ['potent', 'More potent', 'trending-up'], ['cheaper', 'Cheaper', 'tag']];
  return <div style={{ marginTop: 7, padding: 10, background: P.surface, border: `1px solid ${P.accentBorder}`, borderRadius: P.r10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}><Icon name="swap" size={14} color={P.accent} stroke={2} /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Swap {cur ? cur.name : line.sku}</span><span style={{ fontSize: 10, color: P.inkMute }}>· {cat || 'same category'}</span><div style={{ flex: 1 }} /><IconBtn icon="x" size={13} onClick={onClose} style={{ width: 24, height: 24 }} /></div>
    <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>{modes.map(([k, lb, ic]) => {const on = mode === k;return <button key={k} onClick={() => setMode(k)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 4px', borderRadius: P.r8, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, background: on ? P.accentSoft : 'transparent', color: on ? (P.mode === 'dark' ? P.accent : '#7A5A00') : P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name={ic} size={12} stroke={2} />{lb}</button>;})}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {alts.map((p) => {const dThc = (p.thc || 0) - curThc;const dPrice = +(p.price - curPrice).toFixed(2);
        return <button key={p.sku} onClick={() => onSwap(p.sku)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }} onMouseEnter={(e) => e.currentTarget.style.borderColor = P.accentBorder} onMouseLeave={(e) => e.currentTarget.style.borderColor = P.hairline}>
          <Thumb item={p} size={32} radius={7} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>
              <span style={{ color: P.ink2, fontWeight: 700 }}>{money(p.price)}</span>
              {dPrice !== 0 && <span style={{ color: dPrice < 0 ? P.good : P.inkDim }}>{dPrice < 0 ? '−' : '+'}{money(Math.abs(dPrice))}</span>}
              {p.thc != null && <><span style={{ opacity: .5 }}>·</span><span>{p.thc}% THC</span>{dThc !== 0 && <span style={{ color: dThc > 0 ? P.accent : P.inkDim, fontWeight: 700 }}>{dThc > 0 ? '+' : ''}{dThc.toFixed(1)}</span>}</>}
            </div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: P.accent, flex: '0 0 auto' }}>Use</span>
        </button>;})}
      {alts.length === 0 && <div style={{ fontSize: 11.5, color: P.inkMute, padding: 10, textAlign: 'center' }}>{mode === 'potent' ? 'Nothing more potent in stock' : mode === 'cheaper' ? 'Nothing cheaper in stock' : 'No alternatives in this category'}</div>}
    </div>
  </div>;
}

// ── Inline shop catalog (add items) ─────────────────────────────────────────
function LCatalog({ order, onItems, wide }) {
  const P = useP();
  const [cat, setCat] = React.useState('All');
  const [q, setQ] = React.useState('');
  const [saleOnly, setSaleOnly] = React.useState(false);
  const [forCust, setForCust] = React.useState(false);
  const cust = order.recipient.split(' ')[0];
  const all = (window.HW ? window.HW.PRODUCTS : []).filter((p) => p.qty > 0);
  const affinity = React.useMemo(() => {const b = new Set(),c = new Set();(order.items || []).forEach((i) => {const p = all.find((x) => x.sku === i.sku);if (p) {b.add(p.brand);c.add(p.cat);}});return { b, c };}, [order.id]);
  const recs = React.useMemo(() => window.HW && window.HW.upsell ? window.HW.upsell(order.items.map((i) => i.sku), { name: order.recipient }) : [], [order.id, order.items.length]);
  const cats = ['All', ...(window.HW ? window.HW.CATS : [])];
  let list = all;
  if (cat === 'Deals') list = list.filter((p) => p.was);else if (cat !== 'All') list = list.filter((p) => p.cat === cat);
  if (saleOnly) list = list.filter((p) => p.was);
  if (forCust) list = list.filter((p) => affinity.b.has(p.brand) || affinity.c.has(p.cat));
  if (q.trim()) {const s = q.toLowerCase();list = list.filter((p) => p.name.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s));}
  const qtyOf = (sku) => {const i = order.items.find((x) => x.sku === sku);return i ? i.qty : 0;};
  const setQty = (sku, qty) => {let items = order.items.slice();const idx = items.findIndex((x) => x.sku === sku);if (qty <= 0) {if (idx >= 0) items.splice(idx, 1);} else if (idx >= 0) items[idx] = { ...items[idx], qty };else items.push({ sku, qty });onItems(order.id, items);};
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Field icon="search" placeholder="Search products or brands…" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: `1.5px solid ${P.accentBorder}`, background: P.surface, boxShadow: `0 0 0 3px ${P.accentSoft}` }} />
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {cust && <CatChip on={forCust} onClick={() => setForCust((x) => !x)} icon="sparkle" color="#E5A24E">For {cust}</CatChip>}
      <CatChip on={saleOnly} onClick={() => setSaleOnly((x) => !x)} icon="tag">On sale</CatChip>
      {cats.map((c) => <CatChip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</CatChip>)}
    </div>
    {recs.length > 0 && !forCust && !saleOnly && cat === 'All' && !q && <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}><Icon name="sparkle" size={13} color="#E5A24E" /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2 }}>Recommended for {cust}</span><span style={{ fontSize: 10, color: P.inkMute }}>· from order history</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: 8 }}>{recs.slice(0, wide ? 4 : 2).map((p) => <CatPCard key={p.sku} p={p} rec qty={qtyOf(p.sku)} onQty={(v) => setQty(p.sku, v)} />)}</div>
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: 8 }}>{list.slice(0, wide ? 12 : 8).map((p) => <CatPCard key={p.sku} p={p} qty={qtyOf(p.sku)} onQty={(v) => setQty(p.sku, v)} />)}</div>
    {list.length === 0 && <div style={{ textAlign: 'center', color: P.inkMute, fontSize: 12.5, padding: 20 }}>No products found</div>}
  </div>;
}

// ── Stat tile (ETA / SLA / Placed) ──────────────────────────────────────────
function StatTile({ label, value, color, icon, note }) {
  const P = useP();
  const col = color || P.ink2;
  return <div style={{ flex: 1, minWidth: 0, position: 'relative', padding: '11px 12px 10px 14px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: col }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, background: col + '22', color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={12} stroke={2} /></span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
    <div style={{ fontSize: 16.5, fontWeight: 800, color: col, fontFamily: P.fontMono, letterSpacing: '-.01em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    {note && <div style={{ fontSize: 10, color: P.inkMute, marginTop: 3 }}>{note}</div>}
  </div>;
}

// ── Reschedule / cancel + hot-note modal ────────────────────────────────────
const RESCHED_DATES = [{ k: 'today', d: 'Today', full: 'Mon, Jul 20' }, { k: 'tomorrow', d: 'Tomorrow', full: 'Tue, Jul 21' }, { k: 'wed', d: 'Wed', full: 'Wed, Jul 22' }];
const RESCHED_WINDOWS = ['5:00–6:00 PM', '6:00–7:00 PM', '7:00–8:00 PM', '8:30–9:00 PM', '9:00–9:30 PM'];
function OrderActionModal({ order, kind, onClose, onFlash, onDone }) {
  const P = useP();const o = order;
  const isCancel = kind === 'cancel';
  const schedAssigned = o.sched && !!o.driver;
  const schedUnassigned = o.sched && !o.driver;
  // reschedule option set depends on the order's situation
  const ASAP_OPTS = [
  { k: 'wait5', label: 'Give 5 more minutes', sub: 'Guest is almost here · driver holds at the door', icon: 'clock', col: P.good },
  { k: 'soon', label: 'Come back soon', sub: '~30 min · driver runs the next stop, loops back', icon: 'refresh', col: P.info },
  { k: 'later', label: 'Come back later tonight', sub: 'Push to a later window · re-queues for auto-assign', icon: 'calendar', col: P.warn }];
  const ASSIGNED_OPTS = [
  { k: 'soon', label: 'Come back soon', sub: '~30 min · driver finishes nearby stops, loops back', icon: 'refresh', col: P.info },
  { k: 'later', label: 'Come back later', sub: 'Later tonight · driver returns before the window closes', icon: 'clock', col: P.warn },
  { k: 'another', label: 'Come back another day', sub: 'Pick a new date & delivery window', icon: 'calendar', col: P.info, picker: true }];
  const opts = schedAssigned ? ASSIGNED_OPTS : ASAP_OPTS;

  const [view, setView] = React.useState(schedUnassigned ? 'picker' : 'list');
  const [date, setDate] = React.useState(o.future ? 'tomorrow' : 'today');
  const [win, setWin] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [toProfile, setToProfile] = React.useState(true);
  const noteKind = /hostile|unsafe/i.test(reason) ? 'hostile' : /no-show/i.test(reason) ? 'noshow' : 'note';
  const pickResched = (r) => {if (r.picker) {setView('picker');return;}onFlash(`#${o.id} rescheduled · ${r.label}`);onClose();};
  const confirmWindow = () => {if (!win) return;const dt = RESCHED_DATES.find((d) => d.k === date);onFlash(`#${o.id} rescheduled · ${dt.d} ${win}`);onClose();};
  const confirmCancel = () => {if (!reason) return;if (note.trim() && toProfile) L.addHotNote(o.recipient, { kind: noteKind, text: note.trim(), at: 'Just now', reason });onFlash(`#${o.id} cancelled · ${reason}${note.trim() && toProfile ? ' · hot note saved' : ''}`);onClose();onDone && onDone();};
  const chips = [['No-show — never came out', 'noshow'], ['Hostile / unsafe', 'hostile'], ['Unreachable — no answer', 'note']];
  const winPicker = view === 'picker';
  const headTitle = isCancel ? 'Cancel order' : winPicker ? 'Pick delivery window' : 'Reschedule';
  const headIcon = isCancel ? 'user-off' : winPicker || schedAssigned ? 'calendar' : 'clock';
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: P.scrim, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(468px,96%)', maxHeight: '90%', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: isCancel ? P.badSoft : P.accentSoft, color: isCancel ? P.bad : P.mode === 'dark' ? P.accent : '#7A5A00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={headIcon} size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{headTitle} #{o.id}</div><div style={{ fontSize: 11.5, color: P.inkDim }}>{o.recipient} · {o.addr}</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!isCancel && !winPicker && <>
          {schedAssigned && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.infoSoft, borderRadius: P.r10 }}><Icon name="calendar" size={14} color={P.info} /><span style={{ fontSize: 11.5, color: P.ink2 }}>Scheduled · <b style={{ color: P.info }}>{o.win || o.deadline}</b> · {o.driver} assigned</span></div>}
          {opts.map((r) => <button key={r.k} onClick={() => pickResched(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }} onMouseEnter={(e) => e.currentTarget.style.borderColor = r.col} onMouseLeave={(e) => e.currentTarget.style.borderColor = P.hairline2}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: r.col + '22', color: r.col, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={r.icon} size={17} stroke={2} /></span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{r.label}</div><div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>{r.sub}</div></div>
            <Icon name="chevron-right" size={16} color={P.inkFaint} />
          </button>)}
        </>}
        {!isCancel && winPicker && <>
          {schedUnassigned && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}><Icon name="info" size={14} color={P.info} style={{ marginTop: 1, flex: '0 0 auto' }} /><span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>No driver yet — this order auto-assigns ~30 min before the window opens. Set the new window below.</span></div>}
          <div><Lbl>Date</Lbl><div style={{ display: 'flex', gap: 6 }}>{RESCHED_DATES.map((d) => {const on = date === d.k;return <button key={d.k} onClick={() => setDate(d.k)} style={{ flex: 1, padding: '9px 6px', background: on ? P.accentSoft : P.surface2, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}><div style={{ fontSize: 12.5, fontWeight: 700, color: on ? (P.mode === 'dark' ? P.accent : '#7A5A00') : P.ink }}>{d.d}</div><div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{d.full.split(', ')[1]}</div></button>;})}</div></div>
          <div><Lbl>Delivery window</Lbl><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{RESCHED_WINDOWS.map((w) => {const on = win === w;return <button key={w} onClick={() => setWin(w)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 11px', background: on ? P.accentSoft : P.surface2, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><span style={{ width: 13, height: 13, borderRadius: 99, border: `2px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent', flex: '0 0 auto' }} /><span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{w}</span></button>;})}</div></div>
        </>}
        {isCancel && <>
          <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 7 }}>Why is this being cancelled?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{L.CANCEL_REASONS.map((r) => {const on = reason === r;return <button key={r} onClick={() => setReason(r)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', background: on ? P.accentSoft : P.surface2, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><span style={{ width: 13, height: 13, borderRadius: 99, border: `2px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent', flex: '0 0 auto' }} /><span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink }}>{r}</span></button>;})}</div>
          </div>
          <div style={{ padding: '12px 13px', background: noteKind === 'hostile' ? P.badSoft : P.warnSoft, border: `1px solid ${noteKind === 'hostile' ? P.bad : P.warn}`, borderRadius: P.r12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><Icon name="flag" size={14} color={noteKind === 'hostile' ? P.bad : P.warn} /><span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: noteKind === 'hostile' ? P.bad : P.warn }}>Hot note</span><span style={{ fontSize: 11.5, color: P.inkDim }}>pins to the top of {o.recipient}’s profile</span></div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>{chips.map(([tx]) => <button key={tx} onClick={() => setNote(tx)} style={{ padding: '3px 8px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{tx}</button>)}</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? (e.g. no-show, wouldn’t answer, hostile at door)" rows={2} style={{ width: '100%', resize: 'vertical', padding: '9px 11px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none', boxSizing: 'border-box' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, cursor: 'pointer' }}><Check on={toProfile} onChange={setToProfile} size={17} /><span style={{ fontSize: 11.5, color: P.ink2 }}>Save to customer profile as a behaviour flag</span></label>
          </div>
        </>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '13px 18px', borderTop: `1px solid ${P.hairline}` }}>
        {winPicker && schedAssigned ? <PBtn variant="secondary" size="md" icon="chevron-left" onClick={() => setView('list')}>Back</PBtn> : <PBtn variant="secondary" size="md" onClick={onClose}>{isCancel ? 'Keep order' : 'Close'}</PBtn>}
        {isCancel && <PBtn variant="danger" size="md" icon="user-off" onClick={confirmCancel} style={{ opacity: reason ? 1 : .5 }}>Cancel order</PBtn>}
        {!isCancel && winPicker && <PBtn variant="accent" size="md" icon="check" onClick={confirmWindow} style={{ opacity: win ? 1 : .5 }}>Confirm window</PBtn>}
      </div>
    </div>
  </div>;
}

// ── Full customer profile modal (accessible anywhere a customer is selected) ─
window.LCustomerProfile = function LCustomerProfile({ name, onClose, onFlash }) {
  const P = useP();
  const cust = L.customerOf(name);const tier = L.TIER[cust.tier];const vip = cust.tier === 'VIP';
  const notes = L.hotNotesFor(name);
  const history = L.ORDERS.filter((o) => o.recipient === name);
  const Stat = ({ k, v }) => <div style={{ padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, marginTop: 2 }}>{v}</div></div>;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: P.scrim, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(540px,96%)', maxHeight: '90%', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <Avatar name={name} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{name}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: vip ? '4px 11px' : '3px 9px', borderRadius: 99, background: vip ? tier.c : tier.c + '22', color: vip ? '#1A1400' : tier.c, fontSize: vip ? 11.5 : 10.5, fontWeight: 800, boxShadow: vip ? `0 2px 10px ${tier.c}66` : 'none', border: vip ? 'none' : `1px solid ${tier.c}55` }}><Icon name={tier.ic} size={vip ? 13 : 11} stroke={2.2} />{cust.tier}</span>{notes.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99, background: P.bad, color: '#fff', fontSize: 10, fontWeight: 800 }}><Icon name="flag" size={9} stroke={2.4} />{notes.length} flag{notes.length > 1 ? 's' : ''}</span>}</div><div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{cust.phone} · member since {cust.joined}</div></div>
        <IconBtn icon="x" size={17} onClick={onClose} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {notes.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.bad }}>Behaviour flags</div>{notes.map((n, i) => <div key={i} style={{ display: 'flex', gap: 9, padding: '10px 12px', background: n.kind === 'hostile' ? P.badSoft : P.warnSoft, border: `1px solid ${n.kind === 'hostile' ? P.bad : P.warn}`, borderRadius: P.r10 }}><Icon name="flag" size={15} color={n.kind === 'hostile' ? P.bad : P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: n.kind === 'hostile' ? P.bad : P.warn }}>{n.kind === 'hostile' ? 'Hostile / unsafe' : n.kind === 'noshow' ? 'No-show' : 'Hot note'} · {n.at}{n.reason ? ' · ' + n.reason : ''}</div><div style={{ fontSize: 12.5, color: P.ink2, marginTop: 2, lineHeight: 1.45 }}>{n.text}</div></div></div>)}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}><Stat k="Orders" v={cust.orders} /><Stat k="Lifetime value" v={money(cust.ltv)} /><Stat k="Last order" v={cust.last} /><Stat k="Favorite" v={cust.fav} /><Stat k="Member since" v={cust.joined} /><Stat k="Tier" v={cust.tier} /></div>
        {cust.note && cust.note !== '—' && <div style={{ padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 4 }}>Preferences</div><div style={{ fontSize: 12.5, color: P.ink2, fontStyle: 'italic', lineHeight: 1.45 }}>“{cust.note}”</div></div>}
        <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Orders this session · {history.length}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{history.map((o) => <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}><span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: P.ink }}>#{o.id}</span><RegionTag code={o.region} size="sm" /><span style={{ fontSize: 11.5, color: P.ink2, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.addr}</span>{o.sched ? <span style={{ fontSize: 10, fontWeight: 700, color: P.info, fontFamily: P.fontMono }}>{o.win}</span> : o.late ? <span style={{ fontSize: 11.5, fontWeight: 700, color: P.bad, fontFamily: P.fontMono }}>+{o.late}m</span> : <span style={{ fontSize: 11.5, fontWeight: 700, color: P.good, fontFamily: P.fontMono }}>on track</span>}</div>)}{history.length === 0 && <div style={{ fontSize: 11.5, color: P.inkMute, padding: 8 }}>No active orders.</div>}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '13px 18px', borderTop: `1px solid ${P.hairline}` }}>
        <PBtn size="md" variant="secondary" onClick={() => onFlash(`Calling ${name}…`)}>Call</PBtn>
        <PBtn size="md" variant="secondary" icon="chat" onClick={() => onFlash(`Message to ${name}`)}>Message</PBtn>
        <div style={{ flex: 1 }} />
        <PBtn size="md" variant="accent" icon="check" onClick={onClose}>Done</PBtn>
      </div>
    </div>
  </div>;
};

// ── Order detail — logistics + POS ──────────────────────────────────────────
window.LOrderDetail = function LOrderDetail({ order, drivers, onReassign, onItems, onFlash, onClose, wide }) {
  const P = useP();const o = order;
  const band = L.riskBand(o.risk);const c = L.riskColor(P, band);
  const d = o.driver ? L.DRIVER_BY_NAME[o.driver] : null;
  const cust = L.customerOf(o.recipient);const tier = L.TIER[cust.tier];
  const t = L.orderTotals(o.items);
  const [shopping, setShopping] = React.useState(false);
  const [reassignOpen, setReassignOpen] = React.useState(!o.driver && !o.sched);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [swapFor, setSwapFor] = React.useState(null);
  const [pay, setPay] = React.useState(o.cash ? 'Cash' : 'Card');
  const [code, setCode] = React.useState('');
  const [promo, setPromo] = React.useState(null);
  const [action, setAction] = React.useState(null);
  const [profileModal, setProfileModal] = React.useState(false);
  const future = !!o.future;
  const dayNote = future ? 'Tue, Jul 21' : 'Mon, Jul 20';
  const notes = L.hotNotesFor(o.recipient);
  const discount = promo ? promo.discount : 0;
  const taxable = Math.max(0, t.sub - discount);
  const tax = +(taxable * 0.0822).toFixed(2);
  const total = +(taxable + tax).toFixed(2);
  const swap = (sku, to) => {onItems(o.id, o.items.map((it) => it.sku === sku ? { ...it, sku: to } : it));setSwapFor(null);onFlash('Item swapped');};
  const setQty = (sku, v) => {let items = o.items.slice();const idx = items.findIndex((x) => x.sku === sku);if (v <= 0) items.splice(idx, 1);else items[idx] = { ...items[idx], qty: v };onItems(o.id, items);};
  return <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, borderTop: `3px solid ${o.sched ? P.info : c}`, flex: '0 0 auto' }}>
      <span style={{ fontFamily: P.fontMono, fontSize: 15, fontWeight: 800, color: P.ink }}>#{o.id}</span>
      <RegionTag code={o.region} showCity />
      {o.sched ? <Pill kind="info" icon="calendar">Scheduled</Pill> : o.speed === 'ASAP' ? <Pill kind="bad">ASAP</Pill> : <Pill kind="info">Schedule</Pill>}
      <div style={{ flex: 1 }} />
      {!o.sched && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: c, fontFamily: P.fontMono }}><RiskDot score={o.risk} />{Math.round(o.risk * 100)}%{o.late ? ` · +${o.late}m` : ''}</span>}
      {onClose && <IconBtn icon="x" size={16} onClick={onClose} style={{ width: 30, height: 30 }} />}
    </div>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* customer (clickable profile) */}
      <Sec>
        <Lbl>Customer</Lbl>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setProfileOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1, minWidth: 0 }}>
            <Avatar name={o.recipient} size={30} />
            <div style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{o.recipient}</span>{notes.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 99, background: P.bad, color: '#fff', fontSize: 10, fontWeight: 800 }}><Icon name="flag" size={9} stroke={2.4} />{notes.length}</span>}<Icon name="chevron-down" size={13} color={P.inkMute} style={{ transform: profileOpen ? 'rotate(180deg)' : 'none' }} /></div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{cust.phone} · Txn {o.txn}</div></div>
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: cust.tier === 'VIP' ? '5px 12px' : '3px 9px', borderRadius: 99, background: cust.tier === 'VIP' ? tier.c : tier.c + '22', color: cust.tier === 'VIP' ? '#1A1400' : tier.c, fontSize: cust.tier === 'VIP' ? 12 : 10.5, fontWeight: 800, letterSpacing: '.04em', boxShadow: cust.tier === 'VIP' ? `0 2px 10px ${tier.c}66` : 'none', border: cust.tier === 'VIP' ? 'none' : `1px solid ${tier.c}55`, flex: '0 0 auto' }}><Icon name={tier.ic} size={cust.tier === 'VIP' ? 14 : 11} stroke={2.2} />{cust.tier}</span>
        </div>
        {profileOpen && <div style={{ marginTop: 9, padding: '11px 12px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
          {notes.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 11 }}>{notes.map((n, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: n.kind === 'hostile' ? P.badSoft : P.warnSoft, border: `1px solid ${n.kind === 'hostile' ? P.bad : P.warn}`, borderRadius: P.r8 }}><Icon name="flag" size={14} color={n.kind === 'hostile' ? P.bad : P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: n.kind === 'hostile' ? P.bad : P.warn }}>{n.kind === 'hostile' ? 'Hostile' : n.kind === 'noshow' ? 'No-show' : 'Hot note'} · {n.at}</div><div style={{ fontSize: 11.5, color: P.ink2, marginTop: 2, lineHeight: 1.4 }}>{n.text}</div></div></div>)}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px' }}>
            {[['Orders', cust.orders], ['Lifetime value', money(cust.ltv)], ['Last order', cust.last], ['Favorite', cust.fav], ['Member since', cust.joined]].map(([k, v]) => <div key={k}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2, marginTop: 1 }}>{v}</div></div>)}
          </div>
          {cust.note && cust.note !== '—' && <div style={{ marginTop: 9, fontSize: 11.5, color: P.inkDim, fontStyle: 'italic', lineHeight: 1.4 }}>“{cust.note}”</div>}
          <PBtn size="xs" variant="secondary" icon="external" full style={{ marginTop: 10 }} onClick={() => setProfileModal(true)}>View full profile</PBtn>
        </div>}
      </Sec>
      {/* destination */}
      <Sec bt>
        <Lbl>Destination</Lbl>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}><Icon name="pin" size={15} color={P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} /><span style={{ fontSize: 13.5, color: P.ink2 }}>{o.addr}</span></div>
      </Sec>
      {/* driver + inventory-aware reassign */}
      <Sec bt>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Lbl>Driver</Lbl>{d ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={d.name} size={30} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{d.name}</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{d.phone}</div></div>{o.sched && <span style={{ marginLeft: 2, fontSize: 10, fontWeight: 700, color: P.info }}>auto-confirmed before window</span>}</div> : o.sched ? <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.info}`, borderRadius: P.r10 }}><Icon name="calendar" size={15} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} /><div><div style={{ fontSize: 12.5, fontWeight: 700, color: P.info }}>Auto-assign scheduled</div><div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45, marginTop: 2 }}>{o.noCandReason || `A driver is assigned automatically ~30 min before the ${future ? 'window opens tomorrow' : 'delivery window'}.`}</div></div></div> : <div><div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: P.bad }}><Icon name="user-off" size={16} />No driver assigned</div><div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 6, padding: '7px 10px', background: P.badSoft, borderRadius: P.r8 }}><Icon name="info" size={13} color={P.bad} style={{ marginTop: 1, flex: '0 0 auto' }} /><span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}><b style={{ color: P.bad }}>Why:</b> {o.noCandReason || 'Awaiting the next auto-assign run.'}</span></div></div>}</div>
          {!future && <PBtn size="sm" variant={o.driver ? 'secondary' : 'accent'} icon="route" onClick={() => setReassignOpen((v) => !v)}>{o.driver ? 'Reassign' : 'Assign'}</PBtn>}
        </div>
        {reassignOpen && !future && <div style={{ marginTop: 10 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}><Icon name="sparkle" size={12} color={P.accent} /><span style={{ fontSize: 11.5, color: P.inkMute }}>In-stock drivers ranked by ETA · score · load</span></div><InlineReassign order={o} drivers={drivers} onReassign={onReassign} onFlash={onFlash} /></div>}
      </Sec>
      {/* schedule tiles */}
      <Sec bt>
        <div style={{ display: 'flex', gap: 8 }}>
          {o.sched ? <StatTile label="Window" value={o.win} icon="calendar" color={P.info} note={dayNote} /> : <StatTile label="ETA" value={o.eta || '—'} icon="clock" color={o.late ? P.bad : P.ink} note={dayNote} />}
          <StatTile label="SLA deadline" value={o.deadline} icon="target" color={o.late ? P.bad : P.ink2} note={dayNote} />
          <StatTile label="Placed" value={o.placed} icon="receipt" note="Mon, Jul 20" />
        </div>
        {o.sched && <button onClick={() => setAction('resched')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: '9px', background: 'transparent', border: `1px dashed ${P.info}`, borderRadius: P.r10, color: P.info, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="calendar" size={13} stroke={2} />Reschedule window</button>}
      </Sec>
      {/* items + swap + add */}
      <Sec bt>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}><Lbl>Items · {t.count}</Lbl><div style={{ flex: 1 }} /><PBtn size="xs" variant={shopping ? 'accent' : 'soft'} icon={shopping ? 'check' : 'plus'} onClick={() => setShopping((v) => !v)}>{shopping ? 'Done adding' : 'Add items'}</PBtn></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {t.line.map((l) => <div key={l.sku}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
              <Thumb item={l.p} size={38} radius={8} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p ? l.p.name : l.sku}</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{l.p ? l.p.brand : ''} · {money(l.ext)}</div></div>
              <IconBtn icon="swap" size={15} title="Swap product" onClick={() => setSwapFor(swapFor === l.sku ? null : l.sku)} style={{ width: 30, height: 30, color: swapFor === l.sku ? P.accent : P.ink2 }} />
              <Stepper value={l.qty} onChange={(v) => setQty(l.sku, v)} size="sm" />
            </div>
            {swapFor === l.sku && <SwapPicker line={l} onSwap={(to) => swap(l.sku, to)} onClose={() => setSwapFor(null)} />}
          </div>)}
          {t.line.length === 0 && <div style={{ padding: 14, textAlign: 'center', fontSize: 12.5, color: P.inkMute, border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10 }}>No items — add from the catalog</div>}
        </div>
        {shopping && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}><LCatalog order={o} onItems={onItems} wide={wide} /></div>}
      </Sec>
      {/* payment (POS) */}
      <Sec bt>
        <Lbl>Payment</Lbl>
        <Seg size="sm" full value={pay} onChange={(v) => {setPay(v);onFlash(`Payment set to ${v}`);}} options={L.PAY_TYPES.map((p) => ({ value: p, label: p }))} />
        {!promo && <div style={{ marginTop: 10, padding: 11, background: P.accentSoft, border: `1.5px solid ${P.accentBorder}`, borderRadius: P.r12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Icon name="tag" size={13} color={P.mode === 'dark' ? P.accent : '#7A5A00'} stroke={2} /><span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.03em', color: P.mode === 'dark' ? P.accent : '#7A5A00' }}>Promo or referral code</span></div>
          <div style={{ display: 'flex', gap: 7 }}>
            <div style={{ flex: 1 }}><Field icon="percent" placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} style={{ background: P.surface }} /></div>
            <PBtn size="md" variant="accent" onClick={() => {const p = L.applyPromo(code, t.sub);if (p) {setPromo(p);onFlash(`${p.code} applied · −${money(p.discount)}`);} else onFlash('Invalid code');}}>Apply</PBtn>
          </div>
        </div>}
        {promo && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: P.goodSoft, borderRadius: P.r8 }}><Icon name="check-circle" size={13} color={P.good} /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.good }}>{promo.code}</span><span style={{ fontSize: 11.5, color: P.ink2 }}>{promo.label}</span><div style={{ flex: 1 }} /><button onClick={() => {setPromo(null);setCode('');}} style={{ background: 'none', border: 'none', color: P.inkMute, cursor: 'pointer', fontSize: 11.5 }}>Remove</button></div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
          {[['Subtotal', money(t.sub)]].concat(discount ? [['Discount', '−' + money(discount)]] : []).concat([['Tax', money(tax)]]).map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>{k}</span><span style={{ color: k === 'Discount' ? P.good : P.ink2, fontFamily: P.fontMono }}>{v}</span></div>)}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, paddingTop: 6, marginTop: 2, borderTop: `1px solid ${P.hairline}` }}><span style={{ color: P.ink }}>{pay === 'Cash' ? 'Cash to collect' : 'Total due'}</span><span style={{ color: pay === 'Cash' ? P.accent : P.ink, fontFamily: P.fontMono }}>{money(total)}</span></div>
        </div>
      </Sec>
      <Sec bt>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={13} stroke={2} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Activity log</span>
          <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{L.activityFor(o).length} events</span>
        </div>
        <div style={{ marginTop: 12 }}>{L.activityFor(o).map((e, i, arr) => {const tc = e.tone === 'bad' ? P.bad : e.tone === 'warn' ? P.warn : e.tone === 'good' ? P.good : e.tone === 'info' ? P.info : P.ink2;return <div key={i} style={{ display: 'flex', gap: 10 }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ width: 24, height: 24, borderRadius: 99, background: tc + '22', color: tc, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={e.ic} size={12} stroke={2} /></span>{i < arr.length - 1 && <span style={{ flex: 1, width: 2, background: P.hairline, minHeight: 12 }} />}</div><div style={{ paddingBottom: 14, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{e.t}</div>{e.sub && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>{e.sub}</div>}<div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{e.at}</div></div></div>;})}</div>
      </Sec>
    </div>
    <div style={{ display: 'flex', gap: 7, padding: '11px 16px', borderTop: `1px solid ${P.hairline}`, flex: '0 0 auto' }}>
      <PBtn size="sm" variant="soft" icon="clock" onClick={() => setAction('resched')}>Reschedule</PBtn>
      <PBtn size="sm" variant="ghost" icon="user-off" onClick={() => setAction('cancel')} style={{ color: P.bad }}>Cancel</PBtn>
      <div style={{ flex: 1 }} />
      <PBtn size="sm" variant="accent" icon="check" onClick={() => {onFlash(`#${o.id} saved`);onClose && onClose();}}>Save</PBtn>
    </div>
    {action && <OrderActionModal order={o} kind={action} onClose={() => setAction(null)} onFlash={onFlash} onDone={onClose} />}
    {profileModal && <window.LCustomerProfile name={o.recipient} onClose={() => setProfileModal(false)} onFlash={onFlash} />}
  </>;
};

// ── Bottom sheet wrapper ─────────────────────────────────────────────────────
window.LOrderSheet = function LOrderSheet({ order, drivers, onReassign, onItems, onFlash, onClose }) {
  const P = useP();
  return <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim, zIndex: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(880px,94%)', maxHeight: '88%', margin: 12, display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <window.LOrderDetail order={order} drivers={drivers} onReassign={onReassign} onItems={onItems} onFlash={onFlash} onClose={onClose} wide />
    </div>
  </div>;
};

Object.assign(window, {});