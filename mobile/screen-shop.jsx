// ── Shop / catalog — shop-at-home POS: browse, filter, add to cart ──────────
const useP = window.useP;
const _cardVariantKey = 'hw-m-cardvariant';

// Category dot color
const catColor = (c) => window.HW.CAT_COLOR[c] || '#6E6E66';

// ── Product cards — 3 layouts (Photo / Detailed / Compact) ──────────────────
function BoxTag({ p, tone }) {
  const P = useP();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: tone || P.surface3, color: P.ink2, fontSize: 10, fontWeight: 700, fontFamily: P.fontMono }}><Icon name="box" size={11} stroke={2} />{window.MD.boxOf(p)}</span>;
}
function SalePct({ p }) {
  if (!p.was) return null;
  const P = useP();
  const pct = Math.round((1 - p.price / p.was) * 100);
  return <span style={{ padding: '2px 7px', borderRadius: 6, background: P.accent, color: P.accentInk, fontSize: 10, fontWeight: 800 }}>-{pct}%</span>;
}
function AddCtrl({ p, full }) {
  const P = useP();const M = window.useM();
  const inCart = M.s.cart.find((c) => c.sku === p.sku);
  if (!inCart) return <PBtn variant="secondary" size="sm" full={full} icon="plus" onClick={() => window.M.addToCart(p.sku, 1)}>Add</PBtn>;
  if (!full) return <Stepper value={inCart.qty} onChange={(v) => window.M.setQty(p.sku, v)} size="sm" />;
  const btn = { width: 34, height: 34, borderRadius: 9, background: P.accent, color: P.accentInk, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: P.accentSoft, border: `1.5px solid ${P.accentBorder}`, borderRadius: P.r10, padding: 4 }}>
      <button onClick={() => window.M.setQty(p.sku, inCart.qty - 1)} style={btn}><Icon name={inCart.qty <= 1 ? 'trash' : 'minus'} size={16} stroke={2.4} /></button>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: P.accentText, fontFamily: P.fontMono }}>{inCart.qty} in cart</span>
      <button onClick={() => window.M.addToCart(p.sku, 1)} style={btn}><Icon name="plus" size={16} stroke={2.4} /></button>
    </div>);
}

// Full-bleed product thumbnail (fills its container; numeric leaf size)
function FillThumb({ p, radius = 10 }) {
  const P = useP();const hue = p?.hue ?? 90;
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', background: `linear-gradient(140deg, hsl(${hue} ${P.mode === 'dark' ? '42%' : '56%'} ${P.mode === 'dark' ? '34%' : '50%'}), hsl(${(hue + 34) % 360} ${P.mode === 'dark' ? '46%' : '62%'} ${P.mode === 'dark' ? '24%' : '38%'}))`, boxShadow: `inset 0 0 0 1px ${P.mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)'}` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,.42), transparent 56%)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="leaf" size={56} stroke={1.4} color="rgba(255,255,255,.5)" /></div>
    </div>);
}

// A · Photo-forward (grid)
function ProductCardPhoto({ p }) {
  const P = useP();
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', paddingTop: '62%' }}>
        <FillThumb p={p} radius={10} />
        <div style={{ position: 'absolute', top: 7, left: 7, display: 'flex', gap: 5 }}>{p.was && <SalePct p={p} />}</div>
        <div style={{ position: 'absolute', bottom: 7, left: 7 }}><BoxTag p={p} tone={P.mode === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.85)'} /></div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: catColor(p.cat), letterSpacing: '.01em' }}>{p.brand}</div>
      <div style={{ minHeight: 32 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{p.strain && <StrainPill type={p.strain} />}<span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{p.cat}</span></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}><span style={{ fontSize: 15, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(p.price)}</span>{p.was && <span style={{ fontSize: 11.5, color: P.inkMute, textDecoration: 'line-through', fontFamily: P.fontMono }}>{window.HW.fmt.money(p.was)}</span>}</div>
      <AddCtrl p={p} full />
    </div>);
}

// B · Detailed (full-width row)
function ProductCardDetailed({ p }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', gap: 12, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: 11 }}>
      <div style={{ position: 'relative', flex: '0 0 78px' }}><Thumb item={p} size={78} radius={10} />{p.was && <div style={{ position: 'absolute', top: 5, left: 5 }}><SalePct p={p} /></div>}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: catColor(p.cat) }} /><span style={{ fontSize: 11.5, fontWeight: 700, color: catColor(p.cat) }}>{p.brand}</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>· {p.cat}</span></div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BoxTag p={p} />{p.strain && <StrainPill type={p.strain} />}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(p.price)}</span>
          {p.was && <span style={{ fontSize: 11.5, color: P.inkMute, textDecoration: 'line-through', fontFamily: P.fontMono }}>{window.HW.fmt.money(p.was)}</span>}
          <div style={{ flex: 1 }} /><AddCtrl p={p} />
        </div>
      </div>
    </div>);
}

// C · Compact pick-list (box location first — for grabbing from the van)
function ProductCardCompact({ p }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '11px 13px' }}>
      <div style={{ flex: '0 0 62px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Box</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, color: catColor(p.cat) }}><Icon name="box" size={14} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 800, fontFamily: P.fontMono }}>{window.MD.boxOf(p).replace(/[^0-9]/g, '') || '•'}</span></div>
      </div>
      <div style={{ width: 1, alignSelf: 'stretch', background: P.hairline }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: catColor(p.cat) }}>{p.brand}</span>{p.was && <SalePct p={p} />}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{window.MD.boxOf(p)} · {p.cat}</div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(p.price)}</span>
        <AddCtrl p={p} />
      </div>
    </div>);
}

// Filter popover (brand / box)
// Filter chip → opens a bottom-sheet picker (reliable on mobile, no clipping)
function FilterChip({ label, icon, value, onOpen }) {
  const P = useP();
  const active = value != null;
  return (
    <button onClick={onOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 99, border: `1.5px solid ${active ? P.accentBorder : P.hairline2}`, background: active ? P.accentSoft : 'transparent', color: active ? P.accentText : P.ink2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
      {icon && <Icon name={icon} size={14} stroke={2} />}{active ? value : label}<Icon name="chevron-down" size={14} stroke={2.2} />
    </button>);
}
function PickerSheet({ title, subject, value, options, onPick, onClose, count }) {
  const P = useP();
  const Opt = ({ o, a }) => <button onClick={() => { onPick(a ? null : o); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '13px 14px', background: a ? P.accentSoft : 'transparent', border: 'none', borderRadius: P.r10, color: P.ink, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}><span style={{ width: 18, flex: '0 0 auto' }}>{a && <Icon name="check" size={16} stroke={2.6} color={P.accent} />}</span><span style={{ flex: 1 }}>{o == null ? `All ${subject}` : o}</span>{count && o != null && <span style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono }}>{count(o)}</span>}</button>;
  return (
    <window.Sheet title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8 }}>
        <Opt o={null} a={value == null} />
        {options.map((o) => <Opt key={o} o={o} a={value === o} />)}
      </div>
    </window.Sheet>);
}

function CartSheet({ taskId, onClose }) {
  const P = useP();const M = window.useM();
  const totals = window.MD.cartTotals(M.s.cart);
  return (
    <window.Sheet title={`Cart · ${totals.count} items`} onClose={onClose} footer={
    <PBtn variant="accent" size="xl" full icon="check" disabled={!totals.count} onClick={() => {onClose();window.M.pop();window.M.flash('Order updated');}}>Update order · {window.HW.fmt.money(totals.total)}</PBtn>
    }>
      {totals.count === 0 ? <div style={{ padding: '30px 0', textAlign: 'center', color: P.inkMute, fontSize: 13.5 }}>Cart is empty</div> : <>
        {totals.line.map((l, i) =>
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${P.hairline}` }}>
            <Thumb item={l.p} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p ? l.p.name : l.sku}</div>
              {l.p && <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: catColor(l.p.cat) }}>{l.p.brand}</span><BoxTag p={l.p} /></div>}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, marginTop: 4 }}>{window.HW.fmt.money(l.ext)}</div>
            </div>
            <Stepper value={l.qty} onChange={(v) => window.M.setQty(l.sku, v)} size="sm" />
          </div>
        )}
        <div style={{ padding: '14px 0 6px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[['Subtotal', totals.sub], ...window.HW.taxBreakdown(totals.sub).lines.map((t) => [t.k, t.v])].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: P.inkDim }}>{k}</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{window.HW.fmt.money(v)}</span></div>)}
        </div>
      </>}
    </window.Sheet>);
}

window.ShopScreen = function ShopScreen({ taskId }) {
  const P = useP();const M = window.useM();
  const [cat, setCat] = React.useState('All');
  const [q, setQ] = React.useState('');
  const [brand, setBrand] = React.useState(null);
  const [box, setBox] = React.useState(null);
  const [saleOnly, setSaleOnly] = React.useState(false);
  const [forCust, setForCust] = React.useState(false);
  const [picker, setPicker] = React.useState(null);
  const [variant, setVariant] = React.useState(() => {try {return localStorage.getItem(_cardVariantKey) || 'photo';} catch {return 'photo';}});
  const [cartOpen, setCartOpen] = React.useState(false);
  const setVar = (v) => {setVariant(v);try {localStorage.setItem(_cardVariantKey, v);} catch {}};

  const task = window.findTask && window.findTask(taskId);
  const isAppt = task && task.appt;
  const budget = window.MD.AOV.target;
  const cust = task ? task.name.split(' ')[0] : null;
  // customer affinity: brands + categories from their existing order
  const affinity = React.useMemo(() => {
    const b = new Set(),c = new Set();
    (task ? task.items : []).forEach((i) => {const p = window.MD.prod(i.sku);if (p) {b.add(p.brand);c.add(p.cat);}});
    return { brands: b, cats: c };
  }, [taskId]);

  const cats = ['All', ...window.HW.CATS];
  let list = window.HW.PRODUCTS.filter((p) => p.qty > 0);
  const inStock = list;
  if (cat === 'Deals') list = list.filter((p) => p.was);else if (cat !== 'All') list = list.filter((p) => p.cat === cat);
  if (brand) list = list.filter((p) => p.brand === brand);
  if (box) list = list.filter((p) => window.MD.boxOf(p) === box);
  if (saleOnly) list = list.filter((p) => p.was);
  // "For {customer}" — ranked by @hyperwolf/commerce-logic, not by a hand-rolled
  // brand/category match. The engine weighs favourite category, category
  // affinity (Flower → Pre-Rolls), sale, known brand, potency, stock depth and
  // margin — and, dominating all of them, whether an item UNLOCKS A PROMOTION
  // the order is close to, which is the only signal that saves the customer
  // money rather than just spending more of it.
  //
  // `recs` keeps the engine's ORDER and its per-item reason copy. The old
  // brand/category filter survives as the fallback for when the engine has not
  // loaded, so the chip degrades to its previous behaviour rather than to
  // nothing.
  const recs = React.useMemo(() => {
    if (!forCust || !window.HWSwap || !task) return null;
    return window.HWSwap.recommendations({
      catalogue: window.HW.PRODUCTS.filter((p) => p.qty > 0),
      orderItems: task.items,
      surface: 'cart_add_to_order',
      limit: 40,
    });
  }, [forCust, taskId]);
  const recReason = React.useMemo(() => {
    const m = new Map();
    (recs || []).forEach((r) => m.set(r.product.sku, r.reason));
    return m;
  }, [recs]);

  if (forCust) {
    if (recs && recs.length) {
      const order = new Map(recs.map((r, i) => [r.product.sku, i]));
      list = list.filter((p) => order.has(p.sku)).sort((a, b) => order.get(a.sku) - order.get(b.sku));
    } else {
      list = list.filter((p) => affinity.brands.has(p.brand) || affinity.cats.has(p.cat));
    }
  }
  if (q.trim()) {const s = q.toLowerCase();list = list.filter((p) => p.name.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s));}

  const brands = window.MD.brandsFor(inStock);
  const boxes = window.MD.BOXES.filter((bx) => inStock.some((p) => window.MD.boxOf(p) === bx));
  const totals = window.MD.cartTotals(M.s.cart);
  const anyFilter = brand || box || saleOnly || forCust;
  const Card3 = variant === 'detailed' ? ProductCardDetailed : variant === 'compact' ? ProductCardCompact : ProductCardPhoto;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title={isAppt ? 'Shopping with ' + cust : 'Shop'} sub={isAppt ? 'Shop@Home appointment' : window.HW.STORE.name} right={<Seg size="sm" value={variant} onChange={setVar} options={[{ value: 'photo', label: 'Photo' }, { value: 'detailed', label: 'List' }, { value: 'compact', label: 'Pick' }]} />} />
      {isAppt && <div style={{ padding: '10px 16px 2px', flex: '0 0 auto' }}>{(() => {const spent = totals.total;const min = window.MD.AOV.min;const pct = Math.min(100, spent / budget * 100);const minPct = min / budget * 100;const hitMin = spent >= min;const hitTarget = spent >= budget;const toGoal = Math.max(0, budget - spent);return (
            <div style={{ background: P.surface, border: `1px solid ${hitTarget ? P.good : hitMin ? P.hairline2 : P.warn}`, borderRadius: P.r12, padding: '11px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkDim }}>AOV goal</span><div style={{ flex: 1 }} /><span style={{ fontSize: 15, fontWeight: 800, color: hitTarget ? P.good : P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(spent)}</span><span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>&nbsp;/ {window.HW.fmt.money(budget)}</span></div>
          <div style={{ position: 'relative', height: 8, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(3, pct)}%`, background: hitTarget ? P.good : hitMin ? P.indica : P.warn, borderRadius: 99, transition: 'width .2s' }} /><div style={{ position: 'absolute', top: -2, bottom: -2, left: `${minPct}%`, width: 2, background: P.ink }} /></div>
          <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 7, color: hitTarget ? P.good : hitMin ? P.inkDim : P.warn }}>{hitTarget ? '🎯 AOV goal hit — nice work' : hitMin ? `Add ${window.HW.fmt.money(toGoal)} to hit the $${budget} goal` : `Min order is $${min} · ${window.HW.fmt.money(Math.max(0, min - spent))} to go`}</div>
        </div>);})()}</div>}
      <div style={{ padding: '10px 16px 8px', flex: '0 0 auto' }}>
        <Field icon="search" placeholder="Search products or brands" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {/* category chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 16px 10px', flex: '0 0 auto' }}>
        {cats.map((c) => {const a = cat === c;const color = catColor(c);return (
            <button key={c} onClick={() => setCat(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${a ? P.ink : P.hairline2}`, background: a ? P.ink : 'transparent', color: a ? P.surface : P.ink2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            {c !== 'All' && <span style={{ width: 7, height: 7, borderRadius: 99, background: color }} />}{c}
          </button>);})}
      </div>
      {/* quick + attribute filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 12px', flex: '0 0 auto', alignItems: 'center' }}>
        {cust && <button onClick={() => setForCust((x) => !x)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 99, border: `1.5px solid ${forCust ? '#E5A24E' : P.hairline2}`, background: forCust ? '#E5A24E22' : 'transparent', color: forCust ? '#E5A24E' : P.ink2, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}><Icon name="sparkle" size={14} stroke={2.2} />For {cust}</button>}
        <button onClick={() => setSaleOnly((x) => !x)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 99, border: `1.5px solid ${saleOnly ? P.accentBorder : P.hairline2}`, background: saleOnly ? P.accentSoft : 'transparent', color: saleOnly ? P.accentText : P.ink2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}><Icon name="tag" size={14} stroke={2} />On sale</button>
        <FilterChip label="Box" icon="box" value={box} onOpen={() => setPicker('box')} />
        <FilterChip label="Brand" icon="crown" value={brand} onOpen={() => setPicker('brand')} />
        {anyFilter && <button onClick={() => {setBrand(null);setBox(null);setSaleOnly(false);setForCust(false);}} style={{ padding: '8px 10px', background: 'transparent', border: 'none', color: P.info, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>Clear</button>}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 16px 110px' }}>
        {forCust && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#E5A24E1a', borderRadius: P.r10, marginBottom: 12 }}><Icon name="sparkle" size={15} stroke={2} color="#E5A24E" /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2 }}>{recs && recs.length ? `Ranked for ${cust} — best match first` : `Picked for ${cust} from past orders & patterns`}</span></div>}
        {variant === 'photo' ?
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{list.map((p) => <ProductCardPhoto key={p.sku} p={p} />)}</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{list.map((p) => <Card3 key={p.sku} p={p} />)}</div>}
        {list.length === 0 && <div style={{ padding: '50px 0', textAlign: 'center', color: P.inkMute, fontSize: 13.5 }}>No products found</div>}
      </div>

      {totals.count > 0 &&
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
          <button onClick={() => setCartOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: P.accent, border: 'none', borderRadius: P.r14, cursor: 'pointer' }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: P.accentInk, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, fontFamily: P.fontMono }}>{totals.count}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: P.accentInk }}>Review cart</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: P.accentInk, fontFamily: P.fontMono }}>{window.HW.fmt.money(totals.total)}</span>
          </button>
        </div>}
      {cartOpen && <CartSheet taskId={taskId} onClose={() => setCartOpen(false)} />}
      {picker === 'box' && <PickerSheet title="Filter by box" subject="boxes" value={box} options={boxes} onPick={setBox} onClose={() => setPicker(null)} count={(o) => inStock.filter((p) => window.MD.boxOf(p) === o).length} />}
      {picker === 'brand' && <PickerSheet title="Filter by brand" subject="brands" value={brand} options={brands} onPick={setBrand} onClose={() => setPicker(null)} count={(o) => inStock.filter((p) => p.brand === o).length} />}
    </div>);
};

Object.assign(window, {});