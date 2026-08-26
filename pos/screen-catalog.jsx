// ── Catalog screen — Master Catalog / Products ─────────────────────────────
const useP = window.useP;

window.CatalogScreen = function CatalogScreen() {
  const P = useP();
  const all = window.HW.PRODUCTS;
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('All');
  const [strain, setStrain] = React.useState('All');
  const [sel, setSel] = React.useState(() => new Set());
  const [sort, setSort] = React.useState('name');
  const [view, setView] = React.useState('table');
  const [smart, setSmart] = React.useState('none');
  const [marginMin, setMarginMin] = React.useState(0); // profit-margin filter (%)
  const [metricMode, setMetricMode] = React.useState('ribbon'); // ribbon | compact | hidden
  const [detail, setDetail] = React.useState(null); // product opened in the detail page
  const [showCats, setShowCats] = React.useState(false); // category management screen
  const [addOpen, setAddOpen] = React.useState(false); // unified add-product flow (starts at the shell)
  const [section, setSection] = React.useState('products'); // catalog sub-module: products | shells
  const shells = window.HW_SHELL.useShells();

  const active = all.filter((p) => p.active).length;
  const inactive = all.length - active;
  const lowStock = all.filter((p) => p.qty > 0 && p.qty < 10).length;

  const SMART = {
    none: () => true,
    under5: (p) => p.price <= 5, under10: (p) => p.price <= 10, sale: (p) => !!p.was,
    highthc: (p) => p.thc != null && p.thc >= 70, bundle: (p) => /pack|5x|all-in|ready/i.test(p.name + p.wt),
    staff: (p) => ['LDI4DRP', 'GBZ35RR', 'FCF1LRS', 'BBH2JNT'].includes(p.sku)
  };

  const rows = React.useMemo(() => {
    let r = all.filter((p) =>
    (!q || (p.name + p.sku + p.brand).toLowerCase().includes(q.toLowerCase())) && (
    cat === 'All' || p.cat === cat) && (
    strain === 'All' || p.strain === strain) &&
    (SMART[smart] || SMART.none)(p) &&
    p.margin * 100 >= marginMin
    );
    r = [...r].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'qty' ? b.qty - a.qty : sort === 'price' ? b.price - a.price : sort === 'margin' ? b.margin - a.margin : 0);
    return r;
  }, [q, cat, strain, sort, smart, marginMin, all]);

  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.sku));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(rows.map((r) => r.sku)));
  const toggle = (sku) => setSel((s) => {const n = new Set(s);n.has(sku) ? n.delete(sku) : n.add(sku);return n;});

  const cols = [
  { label: <Check on={allSel} onChange={toggleAll} />, width: '40px', align: 'center', render: (r) => <Check on={sel.has(r.sku)} onChange={() => toggle(r.sku)} /> },
  { label: 'Product / SKU', render: (r) =>
    <div onClick={() => setDetail(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <Thumb item={r} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230 }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.03em', marginTop: 1 }}>{r.sku}</div>
        </div>
      </div> },
  { label: 'Weedmaps', width: '132px', render: (r) => <WmDot wm={r.wm} onClick={() => setDetail(r)} /> },
  { label: 'Brand', render: (r) => <span style={{ fontSize: 12.5, color: P.ink2 }}>{r.brand}</span> },
  { label: 'Strain', render: (r) => r.strain ? <StrainPill type={r.strain} thc={r.thc} /> : <span style={{ color: P.inkFaint }}>—</span> },
  { label: 'Category', render: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: P.ink2 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: window.HW.CAT_COLOR[r.cat] || P.neutral }} />{r.cat}</span> },
  { label: 'Stock', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, fontWeight: 600, fontSize: 12.5, color: r.qty === 0 ? P.bad : r.qty < 10 ? P.warn : P.ink, fontVariantNumeric: 'tabular-nums' }}>{r.qty}</span> },
  { label: 'Margin', align: 'right', render: (r) => {const mc = marginColor(P, r.margin);return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 12.5, color: mc }}>{Math.round(r.margin * 100)}%</span>
        <span style={{ width: 46, height: 4, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}><span style={{ display: 'block', width: `${Math.round(r.margin * 100)}%`, height: '100%', background: mc }} /></span>
      </div>);} },
  { label: 'Price', align: 'right', render: (r) =>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
        {r.was && <span style={{ fontSize: 11.5, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{window.HW.fmt.money0(r.was)}</span>}
        <span style={{ fontSize: 13.5, fontWeight: 700, color: r.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money0(r.price)}</span>
      </div> },
  { label: 'Status', render: (r) => r.active ? <Pill kind="good" dot>Active</Pill> : <Pill kind="neutral" dot>Inactive</Pill> },
  { label: '', align: 'right', width: '90px', render: (r) =>
    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <IconBtn icon="pencil" size={15} style={{ width: 32, height: 32 }} />
        <IconBtn icon="trash" size={15} style={{ width: 32, height: 32 }} />
      </div> }];


  // Catalog sub-nav — Products and Shells are two views of the same catalog.
  const SubNav = () =>
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, marginBottom: 18, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, width: 'fit-content' }} data-tour="catalog-subnav">
      {[['products', 'Products', 'package', all.length], ['shells', 'Shells', 'box-add', shells.length]].map(([k, label, ic, n]) => {
      const on = section === k;
      return <button key={k} onClick={() => setSection(k)} title={k === 'shells' ? 'Product shells — the family template every product hangs off' : 'Every individual product (a variation of a shell)'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: 'none', background: on ? P.surface : 'transparent', color: on ? P.ink : P.inkDim, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, boxShadow: on ? P.shadowSm : 'none', transition: 'all .12s' }}>
          <Icon name={ic} size={14} stroke={on ? 2 : 1.8} />{label}
          <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: on ? P.inkMute : P.inkFaint }}>{n}</span>
        </button>;
    })}
    </div>;

  if (detail) return <ProductDetailPage p={detail} onBack={() => setDetail(null)} />;
  if (showCats) return <window.CategoriesScreen onBack={() => setShowCats(false)} />;
  if (section === 'shells') return <div style={{ maxWidth: 1320, margin: '0 auto' }}><SubNav /><window.ShellsModule /></div>;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <SubNav />
      <SectionHead level={1} eyebrow="Master Catalog" title="Products"
      subtitle={`${all.length} SKUs across ${window.HW.STORE.count} stores · ${active} active`}
      action={<div style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" icon="grid" size="md" onClick={() => setShowCats(true)}>Categories</PBtn>
          <PBtn variant="secondary" icon="download" size="md">Export</PBtn>
          <PBtn variant="accent" icon="plus" size="md" onClick={() => setAddOpen(true)}>Add Product</PBtn>
        </div>} />

      {/* Insights header — 3 space treatments (Ribbon / Compact / Hidden) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 11 }}>
        <Eyebrow>Insights</Eyebrow>
        <Seg value={metricMode} onChange={setMetricMode} size="sm" options={[{ value: 'ribbon', label: 'Ribbon' }, { value: 'compact', label: 'Compact' }, { value: 'hidden', label: 'Hidden' }]} />
      </div>
      {metricMode === 'ribbon' && <MetricRibbon active={active} inactive={inactive} lowStock={lowStock} />}
      {metricMode === 'compact' && <MetricCompact active={active} inactive={inactive} lowStock={lowStock} />}
      {metricMode === 'hidden' && <MetricLine active={active} inactive={inactive} lowStock={lowStock} total={all.length} />}

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 200, maxWidth: 360 }}>
            <Field icon="search" placeholder="Search products, SKU, brand…" value={q} onChange={(e) => setQ(e.target.value)} size="md" />
          </div>
          <Seg value={cat} onChange={setCat} size="sm" options={[{ value: 'All', label: 'All' }, ...window.HW.CATS.filter((c) => c !== 'Deals').map((c) => ({ value: c, label: c }))]} />
          <div style={{ flex: 1 }} />
          <Seg value={strain} onChange={setStrain} size="sm" options={[{ value: 'All', label: 'All strains' }, { value: 'Indica', label: 'Indica' }, { value: 'Sativa', label: 'Sativa' }, { value: 'Hybrid', label: 'Hybrid' }]} />
          <div><MarginFilter value={marginMin} onChange={setMarginMin} rows={rows} all={all} /></div>
          <PBtn variant="secondary" size="sm" icon="sort" iconRight="chevron-down" onClick={() => setSort((s) => s === 'name' ? 'qty' : s === 'qty' ? 'price' : s === 'price' ? 'margin' : 'name')}>{sort === 'name' ? 'Name' : sort === 'qty' ? 'Stock' : sort === 'price' ? 'Price' : 'Margin'}</PBtn>
          <Seg value={view} onChange={setView} size="sm" options={[{ value: 'table', icon: 'list', label: '' }, { value: 'grid', icon: 'grid', label: '' }]} />
        </div>
        {/* Smart product filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflowX: 'auto', paddingBottom: 1 }}>
          <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}><Icon name="sparkle" size={13} stroke={1.9} color={P.warn} />Smart</span>
          {[
          ['under5', 'Under $5', 'tag'], ['under10', 'Under $10', 'tag'], ['sale', 'On Sale', 'percent'],
          ['highthc', 'High THC', 'lightning'], ['bundle', 'Bundles', 'gift'], ['staff', 'Staff Picks', 'star']].
          map(([k, label, ic]) => {
            const a = smart === k;
            const n = all.filter((p) => (cat === 'All' || p.cat === cat) && SMART[k](p)).length;
            return <button key={k} onClick={() => setSmart(a ? 'none' : k)} disabled={n === 0} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: P.r999, border: `1px solid ${a ? P.ink : P.hairline2}`, background: a ? P.ink : P.surface, color: n === 0 ? P.inkFaint : a ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: n === 0 ? 'default' : 'pointer', opacity: n === 0 ? .5 : 1, fontFamily: P.fontSans, whiteSpace: 'nowrap', transition: 'all .12s' }}>
              <Icon name={ic} size={12.5} stroke={1.9} />{label}<span style={{ fontSize: 10, fontFamily: P.fontMono, opacity: .7 }}>{n}</span>
            </button>;
          })}
          {smart !== 'none' && <button onClick={() => setSmart('none')} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', borderRadius: P.r999, border: 'none', background: 'transparent', color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="x" size={12} stroke={2} />Clear</button>}
        </div>
      </div>

      {/* Bulk action bar */}
      {sel.size > 0 &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', marginBottom: 12, background: P.ink, borderRadius: P.r12, color: P.surface, boxShadow: P.shadowMd }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: P.fontMono }}>{sel.size} selected</span>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,.2)' }} />
          <button style={bulkBtn(P)}><Icon name="tag" size={14} stroke={2} />Edit price</button>
          <button style={bulkBtn(P)}><Icon name="check-circle" size={14} stroke={2} />Activate</button>
          <button style={bulkBtn(P)}><Icon name="eye-off" size={14} stroke={2} />Deactivate</button>
          <button style={bulkBtn(P)}><Icon name="trash" size={14} stroke={2} />Delete</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSel(new Set())} style={{ ...bulkBtn(P), opacity: .7 }}>Clear</button>
        </div>
      }

      {view === 'table' ?
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.sku} selectedKeys={sel} /> :
      <CatalogGrid rows={rows} sel={sel} toggle={toggle} onOpen={setDetail} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5, color: P.inkDim }}>
        <span style={{ fontFamily: P.fontMono }}>Showing {rows.length} of {all.length}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <PBtn variant="ghost" size="sm" icon="chevron-left" disabled>Prev</PBtn>
          <PBtn variant="soft" size="sm">1</PBtn>
          <PBtn variant="ghost" size="sm">2</PBtn>
          <PBtn variant="ghost" size="sm" iconRight="chevron-right">Next</PBtn>
        </div>
      </div>
      {addOpen && <window.AddProductFlow entry="catalog" onClose={() => setAddOpen(false)} onDone={() => setAddOpen(false)} />}
    </div>);

};

// Soft, deterministic tint for a tag/chip label — a hint of color, not a shout.
const TAG_HUES = [8, 30, 48, 96, 150, 172, 200, 250, 290, 330];
function tagTint(str, P) {
  let h = 0;for (let i = 0; i < String(str).length; i++) h = h * 31 + String(str).charCodeAt(i) >>> 0;
  const hue = TAG_HUES[h % TAG_HUES.length];const dark = P.mode === 'dark';
  return { bg: `hsl(${hue} ${dark ? 42 : 82}% ${dark ? 15 : 96}%)`, fg: `hsl(${hue} ${dark ? 68 : 52}% ${dark ? 72 : 34}%)`, border: `hsl(${hue} ${dark ? 38 : 68}% ${dark ? 26 : 87}%)` };
}

function bulkBtn(P) {return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(255,255,255,.08)', color: P.surface, border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans };}

// Profit-margin color: higher = healthier
function marginColor(P, m) {return m >= 0.55 ? P.good : m >= 0.42 ? P.mode === 'light' ? '#B07A12' : P.warn : P.bad;}

// ── WHAT THIS SCREEN IS ACTUALLY TOLD ──────────────────────────────────────
// One source, and only one: shared/hw-live.js reads GET /api/state and hands
// every product `_live:true` plus `_stockByRegion` = { <region-slug>:
// { qty, reserved } } straight off /api/state.stock. Nothing else on this page
// has a source, and nothing here is allowed to invent one.
//
// Verified against https://hyperwolf-wm-demo.onrender.com/api/state on
// 2026-08-26 (GET, read-only):
//   stock        3 regions, 19 cells; 10 of 149 SKUs have ANY stock row at all.
//   reserved     unexpired soft reservations per cell. A real hold.
//   batches      the key IS served — and it is an EMPTY ARRAY (0 rows), and
//                hw-live.js never attaches it to a product, so this page has
//                never been handed a lot for any SKU.
//   orders       carry NO line items, so per-SKU units sold, revenue, velocity
//                and last-sold are not derivable from anything served.
//
// The batches TABLE (wm-demo/wmdemo/catalog.py) is region / sku / batch_id /
// thc_pct / qty / received_at. There is NO METRC tag column, NO COA result, NO
// expiration date and NO CBD anywhere in the API. Those four are UNKNOWABLE
// here and must never be printed: a fabricated METRC tag under a heading that
// says "traceability" is this system asserting a regulatory fact it does not
// have, and somebody can read it off the screen and put it in a document.
const REGION_LABEL_OVERRIDE = { 'west-la': 'West LA' };
function regionLabelOf(slug) {
  return REGION_LABEL_OVERRIDE[slug] || String(slug).split(/[-_]/).filter(Boolean).
  map((w) => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' ');
}

// Per-region stock, or null when the API never told us the split.
// null ("we were never told") and all-zeroes ("the answer is none") are
// different facts with different consequences, so they render differently.
function stockByLocation(p) {
  const by = p && p._stockByRegion;
  if (!by || typeof by !== 'object') return null;
  const slugs = Object.keys(by);
  if (!slugs.length) return null;
  const rows = slugs.sort().map((slug) => {
    const cell = by[slug] || {};
    const onHand = Number(cell.qty) || 0;
    const onHold = Number(cell.reserved) || 0;
    return { slug, s: regionLabelOf(slug), onHand, onHold, avail: Math.max(0, onHand - onHold) };
  });
  return { rows,
    totOnHand: rows.reduce((a, x) => a + x.onHand, 0),
    totHold: rows.reduce((a, x) => a + x.onHold, 0),
    totAvail: rows.reduce((a, x) => a + x.avail, 0) };
}

// Batch lots. THREE outcomes, and they are not the same fact:
//   undefined  nobody ever handed this screen batch rows        -> "not known"
//   []         the API holds no lots for this SKU               -> "none"
//   [rows]     real lots — and ONLY the five fields it really has.
function batchRowsOf(p) {
  const b = p && p._batches;
  if (!Array.isArray(b)) return undefined;
  return b.filter((r) => r && (r.sku == null || String(r.sku) === p.sku)).map((r) => ({
    id: String(r.batch_id == null ? '' : r.batch_id),
    slug: r.region == null ? null : String(r.region),
    qty: Number(r.qty) || 0,
    thc: r.thc_pct == null ? null : Number(r.thc_pct),
    received: r.received_at == null ? null : Number(r.received_at) }));
}
function receivedLabel(epochSeconds) {
  if (!epochSeconds) return null;
  const d = new Date(epochSeconds * 1000);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// The ONLY way this screen may answer a question it cannot answer: say so out
// loud, and name what is missing. Never a zero, never a dash, never a default.
function NotKnown({ title, body, icon }) {
  const P = useP();
  return <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10 }}>
    <Icon name={icon || 'info'} size={15} stroke={1.9} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink2 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.55, marginTop: 3 }}>{body}</div>
    </div>
  </div>;
}
function Mono({ children }) {const P = useP();return <span style={{ fontFamily: P.fontMono, color: P.ink2 }}>{children}</span>;}

// ── Margin tool — filter the catalog by profit margin ──────────────────────
function MarginFilter({ value, onChange, rows, all }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const presets = [0, 30, 45, 55, 65];
  const avg = all.length ? Math.round(all.reduce((s, p) => s + p.margin, 0) / all.length * 100) : 0;
  const matched = all.filter((p) => p.margin * 100 >= value).length;
  const active = value > 0;
  return (
    <div style={{ position: 'relative', flex: '0 0 auto' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r10, border: `1px solid ${active || open ? P.hairline3 : P.hairline2}`, background: active ? P.highlightSoft : P.surface, color: active ? P.ink : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
        <Icon name="percent" size={13} stroke={1.9} />Margin{active ? ` ≥${value}%` : ''}<Icon name="chevron-down" size={12} stroke={2.2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 272, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 14, zIndex: 51 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Minimum profit margin</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: marginColor(P, value / 100), fontFamily: P.fontMono }}>≥{value}%</span>
          </div>
          <input type="range" min="0" max="80" step="5" value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: '100%', accentColor: P.accent, cursor: 'pointer' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '11px 0 12px' }}>
            {presets.map((p) => {
              const a = value === p;
              return <button key={p} onClick={() => onChange(p)} style={{ padding: '5px 11px', borderRadius: P.r999, border: `1px solid ${a ? P.ink : P.hairline2}`, background: a ? P.ink : P.surface, color: a ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{p === 0 ? 'All' : `≥${p}%`}</button>;
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${P.hairline}`, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>
            <span>{matched} of {all.length} match</span>
            <span>catalog avg {avg}%</span>
          </div>
        </div>
      </>}
    </div>);

}

// Metric header · option A — slim one-line ribbon (default; best space use)
function MetricRibbon({ active, inactive, lowStock }) {
  const P = useP();
  const Item = ({ icon, label, value, sub, delta, deltaKind, accent }) => {
    const dc = !delta ? P.inkMute : deltaKind === 'bad' ? P.bad : P.good;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: accent ? P.accent : P.surface3, color: accent ? P.accentInk : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={14} stroke={1.9} /></span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
            {sub && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{sub}</span>}
            {delta != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: dc, fontFamily: P.fontMono }}>{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}%</span>}
          </div>
        </div>
      </div>);

  };
  const Div = () => <span style={{ width: 1, height: 26, background: P.hairline2, flex: '0 0 auto' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 16px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, marginBottom: 18, overflowX: 'auto' }}>
      {/* SALES RANKING DOES NOT EXIST. These sat in the same row as active /
          inactive / lowStock, which ARE computed from the live SKUs — so two
          invented product names read as measured facts and an operator
          reorders a SKU this catalog does not contain. No sales data is
          served by the API; saying so beats naming a product. */}
      <Item icon="star" label="Most sold" value="not tracked" sub="no sales data in the API" />
      <Div />
      {/* Same defect as "Most sold" one cell to the left, which a previous
          pass fixed and this one kept: $4,210 / +12% was a literal, sitting in
          the same row as active/inactive/lowStock, which ARE computed. */}
      <Item icon="chart-line" label="Top revenue" value="not tracked" sub="no sales data in the API" />
      <Div />
      <Item icon="arrow-down" label="Least sold" value="not tracked" sub="no sales data in the API" />
      <Div />
      <Item icon="check-circle" label="Active / Inactive" value={`${active} / ${inactive}`} />
      <Div />
      <Item icon="package" label="Low stock" value={lowStock} sub="< 10 left" />
    </div>);

}

// Metric header · option B — compact KPI chips (denser than the old cards)
function MetricCompact({ active, inactive, lowStock }) {
  const P = useP();
  const Chip = ({ label, value, sub, delta, deltaKind, accent }) => {
    const dc = !delta ? P.inkMute : deltaKind === 'bad' ? P.bad : P.good;
    return (
      <div style={{ background: P.surface, border: `1px solid ${accent ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, boxShadow: P.shadowSm }}>
        <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{value}</span>
          {delta != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: dc, fontFamily: P.fontMono }}>{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}%</span>}
        </div>
        {sub && <span style={{ fontSize: 11.5, color: P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
      </div>);

  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
      <Chip label="Most sold" value="—" sub="not tracked" />
      <Chip label="Top revenue" value="—" sub="not tracked" />
      <Chip label="Least sold" value="—" sub="not tracked" />
      <Chip label="Active" value={active} sub="live" />
      <Chip label="Low stock" value={lowStock} sub="< 10 left" />
    </div>);

}

// Metric header · option C — single inline line (reclaims max vertical space)
function MetricLine({ active, inactive, lowStock, total }) {
  const P = useP();
  const dot = (c) => <span style={{ width: 6, height: 6, borderRadius: 99, background: c, display: 'inline-block' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '6px 0 16px', fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{dot(P.good)}{active} active</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{dot(P.inkFaint)}{inactive} inactive</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{dot(P.warn)}{lowStock} low stock</span>
      <span style={{ color: P.inkMute }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><Icon name="star" size={12} color={P.warn} />Top seller <b style={{ color: P.ink2 }}>not tracked</b></span>
      <span style={{ marginLeft: 'auto', color: P.inkMute, whiteSpace: 'nowrap' }}>{total} SKUs</span>
    </div>);

}

function CatalogGrid({ rows, sel, toggle, onOpen }) {
  const P = useP();
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(184px,1fr))', gap: 12 }}>
    {rows.map((r) =>
    <Card key={r.sku} padding={0} hover style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => onOpen && onOpen(r)}>
        <div style={{ position: 'relative', height: 118, background: P.surface3 }}>
          <Thumb item={r} size={118} radius={0} />
          <div style={{ position: 'absolute', top: 8, left: 8 }} onClick={(e) => {e.stopPropagation();toggle(r.sku);}}><Check on={sel.has(r.sku)} onChange={() => toggle(r.sku)} /></div>
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 5 }}>{r.was && <Pill kind="bad">Sale</Pill>}<WmChip wm={r.wm} /></div>
        </div>
        <div style={{ padding: '11px 12px 13px' }}>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginBottom: 3 }}>{r.brand}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, marginBottom: 8, minHeight: 32 }}>{r.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {r.strain ? <StrainPill type={r.strain} thc={r.thc} /> : <span style={{ fontSize: 11.5, color: P.inkFaint }}>—</span>}
            <span style={{ fontSize: 13.5, fontWeight: 700, color: r.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money0(r.price)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, fontSize: 11.5, fontFamily: P.fontMono }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: P.inkMute }}><span style={{ width: 7, height: 7, borderRadius: 2, background: window.HW.CAT_COLOR[r.cat] || P.neutral }} />{r.cat}</span>
            <span style={{ fontWeight: 700, color: marginColor(P, r.margin) }}>{Math.round(r.margin * 100)}% mgn</span>
          </div>
        </div>
      </Card>
    )}
  </div>;
}

// ── Weedmaps sync indicators ───────────────────────────────────────────────
function wmStateMeta(state, P) {
  return {
    synced: { c: P.good, kind: 'good', label: 'Synced', icon: 'check-circle' },
    pending: { c: P.info, kind: 'info', label: 'Pending', icon: 'clock' },
    error: { c: P.bad, kind: 'bad', label: 'Error', icon: 'shield' },
    unlisted: { c: P.inkFaint, kind: 'neutral', label: 'Not listed', icon: 'eye-off' }
  }[state] || { c: P.inkFaint, kind: 'neutral', label: '—', icon: 'package' };
}
function listingsSub(wm) {
  if (wm.state === 'unlisted' || !wm.listings || !wm.listings.length) return 'Not on Weedmaps';
  const l = wm.listings;
  return l.length === 2 ? 'Pickup · Delivery' : l[0] === 'pickup' ? 'Pickup only' : 'Delivery only';
}
function WmDot({ wm, onClick }) {
  const P = useP();const m = wmStateMeta(wm.state, P);
  return <button onClick={(e) => {e.stopPropagation();onClick && onClick();}} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: P.fontSans }}>
    <span style={{ width: 8, height: 8, borderRadius: 99, background: m.c, flex: '0 0 auto' }} />
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2 }}>{m.label}</span>
      <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{listingsSub(wm)}</span>
    </span>
  </button>;
}
function WmChip({ wm }) {
  const P = useP();const m = wmStateMeta(wm.state, P);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, background: P.imgScrim, color: P.brand.weedmapsInk, fontSize: 10, fontWeight: 800, fontFamily: P.fontMono, letterSpacing: '.04em' }}><span style={{ width: 6, height: 6, borderRadius: 99, background: m.c }} />WM</span>;
}

// ── Product detail — dedicated full page (Overview + inventory + compliance + Weedmaps)
const PROD_SUBCAT = { Flower: 'Hybrid Flowers', Vapes: 'All-In-One Vapes', 'Pre-Rolls': 'Infused Pre-Rolls', Concentrates: 'Live Resin', Edibles: 'Gummies', Wellness: 'Tinctures' };
const PROD_EFFECTS = { Indica: ['Relaxed', 'Sleepy', 'Calm'], Sativa: ['Energetic', 'Uplifted', 'Focused'], Hybrid: ['Balanced', 'Happy', 'Creative'] };
const PROD_TERPS = ['Myrcene', 'Limonene', 'Caryophyllene', 'Pinene', 'Linalool', 'Terpinolene'];
// PROD_STORES DELETED — four hardcoded store names that no live region
// matches. Regions now come from /api/state.stock via stockByLocation().
const SUBCATS = { Flower: ['Sativa Flowers', 'Indica Flowers', 'Hybrid Flowers', 'Premium Flower', 'Budget Friendly Flower', 'Smaller Bud Flower', '5g-28g'], Vapes: ['Vapes', 'Batteries', 'Solventless Rosin Vapes', 'Live Resin Vape', 'All-In-One Vapes', 'Pod System Vapes', 'Premium Oil Vapes', 'Cured Resin Vapes'], 'Pre-Rolls': ['Prerolls', 'Single Pre-Roll', 'Single Infused Pre-Roll', 'Infused Pre-Roll Pack', 'Pre-Roll Pack'], Concentrates: ['Solventless Rosin / Hash', 'Hash', 'Sugar', 'Budder / Badder', 'Diamonds / Sauce', 'Live Resin'], Edibles: ['Gummies', 'Baked Goods', 'Drinks', 'High Dose Edibles', 'Micro Dose Edibles', 'Chocolates'], Wellness: ['Tinctures', 'Topicals', 'Capsules'], Deals: ['Hyper Deals', 'Clearance'], Accessories: ['Accessories'] };

// Storefront meta is AI-drafted per product (title, description, slug, keywords).
// Every field can be re-drafted on its own; local variants stand in when the
// model can't be reached so the UI never blocks on the network.
// Models often reply with a markdown heading, a label, or fenced text — keep the
// first real sentence-bearing line and strip the decoration.
function cleanProse(raw) {
  const lines = String(raw || '').replace(/```[a-z]*/gi, '').split('\n')
  .map((l) => l.replace(/^\s*[#>*\-\u2022]+\s*/, '').replace(/\*\*/g, '').trim())
  .filter(Boolean)
  .filter((l) => !/^(description|how to use|faq|meta title|meta description|title|slug|keywords)\s*:?$/i.test(l));
  const body = lines.filter((l) => /[.!?]/.test(l));
  return (body.length ? body : lines).join(' ').replace(/^["'\u201c]|["'\u201d]$/g, '').trim();
}
const META_SLUG = (brand, name) => (brand + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function metaVariant(field, p, name, v) {
  const wt = p.wt || '', cat = (p.cat || '').toLowerCase(), strain = p.strain || 'Hybrid';
  const T = {
    title: [
      name + ' — ' + p.brand + ' | Hyperwolf',
      'Buy ' + name + ' by ' + p.brand + ' — ' + wt + ' ' + cat + ' | Hyperwolf',
      p.brand + ' ' + name + ' (' + wt + ') — same-day delivery | Hyperwolf'],
    desc: [
      'Buy ' + name + ' by ' + p.brand + ' — ' + wt + ' ' + cat + ', lab-tested with same-day delivery across Riverside and San Bernardino.',
      name + ' from ' + p.brand + ' — ' + strain.toLowerCase() + ' ' + cat + ' in ' + wt + '. COA on every batch, reserved online for pickup or same-day delivery.',
      'Shop ' + name + ', a ' + strain.toLowerCase() + ' ' + cat + ' by ' + p.brand + '. ' + wt + ' units, potency printed per batch, delivered across the Inland Empire.'],
    slug: [
      META_SLUG(p.brand, name),
      META_SLUG(p.brand, name + ' ' + wt),
      META_SLUG(name, p.brand + ' ' + cat)],
    keywords: [
      [p.brand.toLowerCase(), name.toLowerCase(), cat, strain.toLowerCase(), 'cannabis delivery'].filter(Boolean).join(', '),
      [name.toLowerCase(), 'buy ' + name.toLowerCase() + ' online', p.brand.toLowerCase() + ' ' + cat, wt + ' ' + cat, 'same day weed delivery'].filter(Boolean).join(', '),
      [p.brand.toLowerCase() + ' ' + name.toLowerCase(), strain.toLowerCase() + ' ' + cat, cat + ' near me', 'riverside cannabis delivery', 'san bernardino dispensary'].filter(Boolean).join(', ')] };
  const arr = T[field] || [''];
  return arr[v % arr.length];
}
// One Claude call per field, so a single bad line can be re-drafted on its own.
async function aiMetaField(field, p, name) {
  const brief = '"' + name + '" by ' + p.brand + ' — a ' + (p.strain || 'hybrid') + ' ' + p.cat + ', ' + (p.wt || '') + ', sold by Hyperwolf (cannabis delivery, Riverside + San Bernardino, California).';
  const ask = {
    title: 'Write ONE SEO meta title, 50-60 characters, ending in " | Hyperwolf".',
    desc: 'Write ONE SEO meta description, 140-158 characters, no emoji, no medical claims.',
    slug: 'Write ONE URL slug: lowercase, words separated by single hyphens, no stop words, max 6 words.',
    keywords: 'Write 5 comma-separated SEO keyword phrases, lowercase, most specific first.' }[field];
  const raw = await window.claude.complete('You are an SEO copywriter for a licensed California cannabis retailer. Product: ' + brief + '\n\n' + ask + ' Reply with ONLY the text, no quotes, no preamble.');
  const line = field === 'keywords' || field === 'slug'
  ? String(raw || '').split('\n').map((l) => l.replace(/^\s*[#>*\-\u2022]+\s*/, '').trim()).filter(Boolean)[0] || ''
  : cleanProse(raw);
  if (!line) throw new Error('empty');
  return field === 'slug' ? line.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : line;
}

// AI-fetched reported effects — uses the built-in Claude helper, falls back to
// deterministic strain defaults if the call fails or returns nothing.
function AiEffects({ product }) {
  const P = useP();
  const fallback = PROD_EFFECTS[product.strain] || ['Relaxed', 'Happy', 'Calm'];
  const [effects, setEffects] = React.useState(fallback);
  const [state, setState] = React.useState('loading'); // loading | ai | fallback
  const fetchEffects = React.useCallback(async () => {
    setState('loading');
    try {
      const prompt = `You are a dispensary budtender. For the cannabis product "${product.name}" — a ${product.strain || 'hybrid'} ${product.cat} by ${product.brand}${product.thc != null ? ` at ${product.thc}% THC` : ''} — give the 3 most likely reported subjective effects a customer would feel. Reply with ONLY a JSON array of 3 short single-word effects, e.g. ["Relaxed","Euphoric","Sleepy"]. No other text.`;
      const raw = await window.claude.complete(prompt);
      const arr = JSON.parse((raw.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) {setEffects(arr.slice(0, 4).map((x) => String(x).trim()).filter(Boolean));setState('ai');} else
      throw new Error('empty');
    } catch (e) {setEffects(fallback);setState('fallback');}
  }, [product.sku]);
  React.useEffect(() => {fetchEffects();}, [fetchEffects]);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Reported effects</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: P.accentText, background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: 99, padding: '2px 7px' }}><Icon name="lightning" size={9} stroke={2} />{state === 'fallback' ? 'AI · offline' : 'AI'}</span>
      <div style={{ flex: 1 }} />
      <button onClick={fetchEffects} disabled={state === 'loading'} title="Regenerate with AI" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: state === 'loading' ? 'default' : 'pointer', color: P.inkDim, fontSize: 11.5, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}><Icon name="refresh" size={13} stroke={2} style={{ animation: state === 'loading' ? 'hwspin 0.8s linear infinite' : 'none' }} />Regenerate</button>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {state === 'loading' ? [0, 1, 2].map((i) => <span key={i} style={{ width: 82, height: 32, borderRadius: 99, background: `linear-gradient(90deg, ${P.surface2}, ${P.surface3}, ${P.surface2})`, backgroundSize: '200% 100%', animation: 'shimmer 1.1s ease-in-out infinite' }} />) :
      effects.map((e) => {const t = tagTint(e, P);return <span key={e} style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 14px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 99, fontSize: 12.5, fontWeight: 700, color: t.fg }}>{e}</span>;})}
    </div>
    {state === 'fallback' && <span style={{ fontSize: 11.5, color: P.inkMute }}>Showing strain defaults — AI couldn’t be reached. Try Regenerate.</span>}
  </div>;
}

// Weedmaps push. THIS SCREEN CANNOT PUSH, AND NOW SAYS SO.
// What used to be here: a setInterval walking four step labels 520ms apart,
// then a green panel reading "Synced just now. Price, availability & the menu
// item were pushed to Weedmaps. Pickup · Delivery listings live." Not one
// network call was made — not by that button, not by anything it invoked. The
// claim was manufactured by a timer.
// What is actually true: publishing is server-side and whole-menu
// (POST /api/sync in wm-demo/wmdemo/server.py, token-gated). There is no
// per-product push route in the API at all, and this build wires none. So the
// control explains the real state instead of performing a fake one.
function WmResyncButton({ p }) {
  const P = useP();
  const [why, setWhy] = React.useState(false);
  const L = window.HW_LIVE;
  const live = !!p._live;
  const writes = L && typeof L.writes === 'string' ? L.writes : 'unknown';
  const hasToken = !!(L && L.hasToken && L.hasToken());
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    <PBtn variant="secondary" size="sm" full icon="info" onClick={() => setWhy((v) => !v)}>
      {why ? 'Hide push status' : 'Push to Weedmaps…'}
    </PBtn>
    <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
      <Icon name="shield" size={15} stroke={1.9} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.55 }}>
        <b style={{ color: P.ink2 }}>Nothing on this screen has contacted Weedmaps.</b> The state above is whatever the catalogue was loaded with — it is not the result of a push from here.
      </div>
    </div>
    {why && <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '11px 12px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10, fontSize: 11.5, color: P.inkDim, lineHeight: 1.55 }}>
      <div>Publishing runs server-side and covers the <b style={{ color: P.ink2 }}>whole menu</b> — <span style={{ fontFamily: P.fontMono, color: P.ink2 }}>POST /api/sync</span>. The API exposes no per-product push, so there is nothing this button could call for <span style={{ fontFamily: P.fontMono, color: P.ink2 }}>{p.sku}</span> alone.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: P.fontMono, color: P.ink2 }}>
        <span>catalogue source · {live ? 'live API' : 'local demo data (not the API)'}</span>
        <span>write access · {live ? writes : 'n/a'}{live && !hasToken ? ' · no token set' : ''}</span>
        <span>last push recorded by the API · {p.wm.last}</span>
      </div>
      {p.wm.issue && <div style={{ color: P.ink2 }}>{p.wm.issue}</div>}
    </div>}
  </div>;
}

// Storefront content shown on the online menu / Weedmaps listing (comment: photo, description, directions, FAQ).
function StorefrontContent({ p }) {
  const P = useP();
  const cat = (p.cat || '').toLowerCase();
  const desc = `${p.name} by ${p.brand} is a ${p.strain ? p.strain.toLowerCase() + ' ' : ''}${cat.replace(/s$/, '')} crafted for a consistent, dependable experience. Expect the clean, true-to-strain character ${p.brand} is known for — small-batch quality, lab-tested for potency and purity, and ready for the display case or the online menu.`;
  const directions = /edible|gumm|mg/.test(cat + (p.wt || '')) ? 'Start with one piece (10 mg THC) and wait up to 2 hours before taking more. Store in a cool, dry place, away from children and pets.' :
  /pre-?roll/.test(cat) ? 'Ready to enjoy — no grinding needed. Keep sealed to preserve freshness and aroma.' :
  /vape|cart/.test(cat) ? 'Attach to a compatible 510 battery and take slow, short draws. Store upright at room temperature.' :
  /concentrate|wax|resin|badder/.test(cat) ? 'Portion a small amount with a dab tool onto a heated surface — a little goes a long way. Refrigerate for a longer shelf life.' :
  'Grind, pack, and enjoy. Store in an airtight container out of direct light to preserve the terpenes.';
  const faqs = [
  { q: 'Is this product lab tested?', a: 'Every batch is lab tested for potency and contaminants before it is released for sale. Ask for the Certificate of Analysis (COA) for the lot you receive — that document, not this listing, is the record of the result.' },
  { q: 'How should I store it?', a: directions },
  { q: 'Will the potency match what’s on the menu?', a: 'Not exactly. THC and CBD are per-batch values, so the COA on your specific unit is the source of truth — the menu figure is the catalogue’s, not your lot’s.' },
  { q: 'Is it available for delivery?', a: (p.wm.listings || []).includes('delivery') ? 'Yes — it’s live on the Weedmaps delivery listing whenever an on-shift driver in your region carries it.' : 'This item is currently pickup-only. Check back as driver kits change.' }];

  const [open, setOpen] = React.useState(0);
  const [faqList, setFaqList] = React.useState(faqs);
  // Description, How to use and the FAQ are AI-drafted; each can be re-drafted
  // on its own, and falls back to the deterministic draft if the model is out.
  const [aiSrc, setAiSrc] = React.useState({ desc: 'local', how: 'local', faq: 'local' });
  const [aiBusy, setAiBusy] = React.useState({});
  const brief = `"${p.name}" by ${p.brand} — a ${p.strain || 'hybrid'} ${p.cat}, ${p.wt || ''}, sold by Hyperwolf (licensed California cannabis delivery).`;
  const ask = async (field, prompt, apply, fallback) => {
    setAiBusy((b) => ({ ...b, [field]: true }));
    try {
      const raw = await window.claude.complete('You are a dispensary copywriter for a licensed California cannabis retailer. Product: ' + brief + '\n\n' + prompt + ' No medical claims, no emoji.');
      const txt = String(raw || '').trim();
      if (!txt) throw new Error('empty');
      apply(txt, cleanProse(txt));
      setAiSrc((x) => ({ ...x, [field]: 'ai' }));
    } catch (e) {
      fallback();
      setAiSrc((x) => ({ ...x, [field]: 'local' }));
    }
    setAiBusy((b) => ({ ...b, [field]: false }));
  };
  const AiTag2 = ({ field }) => {
    const st = aiSrc[field], on = st === 'ai';
    return <span title={on ? 'Drafted by AI' : st === 'edited' ? 'AI draft, edited by a person' : 'Local draft — the model could not be reached'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', borderRadius: 99, padding: '2px 6px',
        color: on ? P.accentText : P.inkMute, background: on ? P.accentSoft : P.surface3, border: `1px solid ${on ? P.accentBorder : P.hairline2}` }}>
      <Icon name="lightning" size={9} stroke={2} />{st === 'edited' ? 'AI · EDITED' : on ? 'AI' : 'AI · OFFLINE'}</span>;
  };
  const Redraft2 = ({ field, onClick }) =>
  <button onClick={onClick} disabled={!!aiBusy[field]} title="Re-draft with AI"
    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: aiBusy[field] ? 'default' : 'pointer', color: P.inkDim, fontSize: 11.5, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}>
    <Icon name="refresh" size={12} stroke={2} style={{ animation: aiBusy[field] ? 'hwspin 0.8s linear infinite' : 'none' }} />{aiBusy[field] ? 'Drafting' : 'Redraft'}</button>;
  const redraftDesc = () => ask('desc', 'Write ONE product description of 2 sentences (max 40 words) for the online menu. Prose only — no heading, no label, no markdown.', (t, prose) => {if (!prose) throw new Error('empty');setDescVal(prose);}, () => setDescVal(desc));
  const redraftHow = () => ask('how', 'Write ONE "how to use" instruction of 1–2 sentences, including storage. Prose only — no heading, no label, no markdown.', (t, prose) => {if (!prose) throw new Error('empty');setHowVal(prose);}, () => setHowVal(directions));
  const redraftFaq = () => ask('faq', 'Write 4 customer FAQs as JSON: [{"q":"…","a":"…"}]. Answers max 30 words. Reply with ONLY the JSON.',
  (t) => {const arr = JSON.parse((t.match(/\[[\s\S]*\]/) || ['[]'])[0]);if (!Array.isArray(arr) || !arr.length) throw new Error('bad');setFaqList(arr.slice(0, 5).map((x) => ({ q: String(x.q || ''), a: String(x.a || '') })));}, () => setFaqList(faqs));
  React.useEffect(() => {redraftDesc();redraftHow();redraftFaq();}, [p.sku]);
  const [editFaq, setEditFaq] = React.useState(false);
  const [descEdit, setDescEdit] = React.useState(false);
  const [howEdit, setHowEdit] = React.useState(false);
  const [descVal, setDescVal] = React.useState(desc);
  const [howVal, setHowVal] = React.useState(directions);
  const faqInp = { flex: 1, minWidth: 0, padding: '8px 10px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, background: P.surface, color: P.ink, fontSize: 12.5, outline: 'none', fontFamily: P.fontSans };
  const Head = ({ icon, title, sub }) => <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
    <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={15} stroke={1.9} /></span>
    <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: 11.5, color: P.inkDim }}>{sub}</div>}</div>
  </div>;
  const gallery = [1, 2, 3];
  return <Card padding={0}>
    <Head icon="layout" title="Storefront content" sub="Photo, copy & FAQ shown on the online menu and Weedmaps listing" />
    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18 }}>
      {/* media */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ position: 'relative', width: '100%', height: 240 }}>
          <image-slot id={`prod-photo-${p.sku}`} shape="rounded" radius="14" placeholder="Drop product photo" style={{ width: '100%', height: '100%' }}></image-slot>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          {gallery.map((n) => <div key={n} style={{ position: 'relative', width: '100%', height: 84, overflow: 'hidden', borderRadius: 10, background: P.surface3 }}><image-slot id={`prod-photo-${p.sku}-${n}`} shape="rounded" radius="10" placeholder={`Photo ${n}`} style={{ width: '100%', height: '100%' }}></image-slot></div>)}
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.45 }}>First image is the primary menu photo. Drop lifestyle & packaging shots into the gallery.</div>
        <div style={{ marginTop: 2, padding: 12, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Menu preview</div>
          <div style={{ display: 'flex', gap: 10, padding: 10, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
            <Thumb item={p} size={52} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>{p.brand} · {p.wt || '—'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money0(p.price)}</span>
                {p.strain && <StrainPill type={p.strain} thc={p.thc} />}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 8, lineHeight: 1.45 }}>How this product reads on the online menu and the Weedmaps card — photo, name, price and strain, nothing else.</div>
        </div>
      </div>
      {/* copy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>Description</span>
            <AiTag2 field="desc" />
            <div style={{ flex: 1 }} />
            <Redraft2 field="desc" onClick={redraftDesc} />
            <button onClick={() => setDescEdit((e) => !e)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: P.info, fontFamily: P.fontSans }}><Icon name={descEdit ? 'check' : 'pencil'} size={13} stroke={2} />{descEdit ? 'Done' : 'Edit'}</button>
          </div>
          {descEdit ?
          <textarea value={descVal} onChange={(e) => {setDescVal(e.target.value);setAiSrc((x) => ({ ...x, desc: 'edited' }));}} rows={4} style={{ width: '100%', marginTop: 6, padding: '9px 11px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, color: P.ink, fontSize: 13.5, lineHeight: 1.6, fontFamily: P.fontSans, resize: 'vertical', outline: 'none' }} /> :
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.ink2, lineHeight: 1.6, textWrap: 'pretty' }}>{descVal}</p>}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>How to use</span>
            <AiTag2 field="how" />
            <div style={{ flex: 1 }} />
            <Redraft2 field="how" onClick={redraftHow} />
            <button onClick={() => setHowEdit((e) => !e)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: P.info, fontFamily: P.fontSans }}><Icon name={howEdit ? 'check' : 'pencil'} size={13} stroke={2} />{howEdit ? 'Done' : 'Edit'}</button>
          </div>
          {howEdit ?
          <textarea value={howVal} onChange={(e) => {setHowVal(e.target.value);setAiSrc((x) => ({ ...x, how: 'edited' }));}} rows={3} style={{ width: '100%', marginTop: 6, padding: '9px 11px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, color: P.ink, fontSize: 13.5, lineHeight: 1.6, fontFamily: P.fontSans, resize: 'vertical', outline: 'none' }} /> :
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.ink2, lineHeight: 1.6 }}>{howVal}</p>}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>FAQ</span>
            <AiTag2 field="faq" />
            <div style={{ flex: 1 }} />
            <Redraft2 field="faq" onClick={redraftFaq} />
            <button onClick={() => setEditFaq((e) => !e)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: P.info, fontFamily: P.fontSans }}><Icon name={editFaq ? 'check' : 'pencil'} size={13} stroke={2} />{editFaq ? 'Done' : 'Edit'}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
            {editFaq ? <>
              {faqList.map((f, i) => <div key={i} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={f.q} onChange={(e) => setFaqList((l) => l.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} placeholder="Question" style={faqInp} />
                  <button onClick={() => setFaqList((l) => l.filter((_, j) => j !== i))} title="Remove" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute, flex: '0 0 auto', display: 'flex', padding: 3 }}><Icon name="trash" size={15} stroke={1.9} /></button>
                </div>
                <textarea value={f.a} onChange={(e) => setFaqList((l) => l.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} placeholder="Answer" rows={2} style={{ ...faqInp, resize: 'vertical', lineHeight: 1.5 }} />
              </div>)}
              <button onClick={() => setFaqList((l) => [...l, { q: '', a: '' }])} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', color: P.info, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><Icon name="plus" size={14} stroke={2.2} />Add question</button>
            </> : faqList.map((f, i) => {const on = open === i;return <div key={i} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden' }}>
              <button onClick={() => setOpen(on ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: on ? P.surface2 : P.surface, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{f.q || 'Untitled question'}</span>
                <Icon name="chevron-down" size={15} stroke={2.2} color={P.inkMute} style={{ transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: '0 0 auto' }} />
              </button>
              {on && <div style={{ padding: '0 13px 12px', fontSize: 12.5, color: P.inkDim, lineHeight: 1.55 }}>{f.a}</div>}
            </div>;})}
          </div>
        </div>
      </div>
    </div>
  </Card>;
}

// Inventory by location — one row per region the API actually reports stock
// for, expandable to the lots recorded THERE.
// What used to be here: four hardcoded store names, each given p.qty times one
// of [1, .42, .68, .25], an "on hold" of that times one of [.12,.05,.18,.08],
// and the batch list dealt round-robin across the four so every store showed
// lots it had never received. Every figure was arithmetic on p.qty.
function InventoryByLocation({ inv, batches }) {
  const P = useP();
  const [exp, setExp] = React.useState(null);
  const lotsKnown = batches !== undefined;
  const byRegion = {};
  (batches || []).forEach((b) => {if (b.slug) {(byRegion[b.slug] = byRegion[b.slug] || []).push(b);}});
  const stores = inv.rows, totals = inv;
  const gc = '1.7fr .8fr .8fr .8fr 20px';
  return <div style={{ gridColumn: '1/-1', border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
    <div style={{ display: 'grid', gridTemplateColumns: gc, gap: 10, padding: '8px 13px', background: P.surface2, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>
      <span>Location</span><span style={{ textAlign: 'right' }}>In region</span><span style={{ textAlign: 'right' }}>On hold</span><span style={{ textAlign: 'right' }}>Available</span><span />
    </div>
    {stores.map((st) => {const bs = byRegion[st.slug] || [];const open = exp === st.slug;return <div key={st.slug} style={{ borderTop: `1px solid ${P.hairline}` }}>
      <div onClick={() => setExp(open ? null : st.slug)} style={{ display: 'grid', gridTemplateColumns: gc, gap: 10, alignItems: 'center', padding: '10px 13px', cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}><Icon name="shop" size={14} color={P.inkMute} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{st.s}</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{lotsKnown ? bs.length + ' lot' + (bs.length !== 1 ? 's' : '') : 'lots not known'}</span></span>
        <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 600, color: P.ink2 }}>{st.onHand}</span>
        <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 600, color: st.onHold ? P.warn : P.inkFaint }}>{st.onHold}</span>
        <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 700, color: st.avail === 0 ? P.bad : st.avail < 10 ? P.warn : P.good }}>{st.avail}</span>
        <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </div>
      {open && <div style={{ padding: '2px 13px 11px 36px', display: 'flex', flexDirection: 'column', gap: 6, background: P.surface2 }}>
        {!lotsKnown ? <span style={{ fontSize: 11.5, color: P.inkMute }}>Which lots sit here was never reported to this screen — see Batches below.</span> :
        bs.length === 0 ? <span style={{ fontSize: 11.5, color: P.inkMute }}>No lots recorded at this location.</span> :
        bs.map((b) => <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{b.id}</span>
          <span style={{ flex: 1, minWidth: 40 }} />
          {b.thc != null && <span style={{ fontFamily: P.fontMono, color: P.ink2 }}>{b.thc}% THC</span>}
          {receivedLabel(b.received) && <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>rec. {receivedLabel(b.received)}</span>}
          <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{b.qty}u</span>
        </div>)}
      </div>}
    </div>;})}
    <div style={{ display: 'grid', gridTemplateColumns: gc, gap: 10, padding: '10px 13px', borderTop: `2px solid ${P.hairline2}`, background: P.surface2 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>All regions</span>
      <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{totals.totOnHand}</span>
      <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 700, color: P.warn }}>{totals.totHold}</span>
      <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 800, color: P.good }}>{totals.totAvail}</span>
      <span />
    </div>
  </div>;
}

function ProductDetailPage({ p, onBack }) {
  const P = useP();
  const fmt = window.HW.fmt;
  const m = wmStateMeta(p.wm.state, P);
  const h = p.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  // units30 / rev30 DELETED: /api/state.orders carries no line items, so
  // per-SKU sales are not derivable from anything served. See the rail card.
  const onPickup = (p.wm.listings || []).includes('pickup');
  const onDelivery = (p.wm.listings || []).includes('delivery');
  const kits = 1 + h % 4;
  const pkTot = 3,dlTot = 34;
  const pkOn = onPickup ? 1 + h % 3 : 0;
  const dlOn = onDelivery ? 12 + h % 23 : 0;
  const mc = marginColor(P, p.margin);
  const wmConf = p.wm.state === 'unlisted' ? 0 : p.wm.state === 'error' ? 0.46 : Math.min(0.99, 0.7 + h % 30 / 100);
  const [wmMap, setWmMap] = React.useState(false);
  const eff = PROD_EFFECTS[p.strain] || ['Relaxed', 'Happy'];
  const terps = [PROD_TERPS[h % 6], PROD_TERPS[(h + 2) % 6], PROD_TERPS[(h + 4) % 6]];
  // DELETED, all of it manufactured from charCodeSum(p.sku):
  //   cbd     — the API has no CBD column on a batch and serves cbd:null.
  //   metrc   — a state traceability tag, invented. See the note above.
  //   batch   — a lot id for a lot that does not exist.
  //   received— a receiving date for that same non-existent lot.
  //   upc     — a barcode. Not served for any SKU.
  //   stores / totalStock — p.qty times [1,.42,.68,.25] over four hardcoded
  //             store names. Replaced by `inv`, read from /api/state.stock.
  const inv = stockByLocation(p);   // null  => per-region split not held
  const bRows = batchRowsOf(p);     // undefined => lots never reported
  // `_live` is set by shared/hw-live.js only when /api/state actually answered.
  // Without it the rows are the bundled demo catalogue, and saying "the API
  // reports no stock row" would itself be a claim we cannot make.
  const fromApi = !!p._live;
  const perGram = p.wt && /g$/.test(p.wt) ? p.price / (parseFloat(p.wt) || 1) : null;
  const packN = ((p.wt || '').match(/^(\d+)\s*x/i) || [])[1] || '1';
  const weightOnly = (p.wt || '').replace(/^\d+\s*x\s*/i, '').trim() || '—';
  const pkgType = { Flower: 'Jar', 'Pre-Rolls': 'Tube', Vapes: 'Box', Edibles: 'Box', Concentrates: 'Container', Wellness: 'Box' }[p.cat] || 'Box';
  const shellName = `${p.brand} — ${p.name}`;
  const shellId = 'SH-' + p.sku;
  const shellPrice = p.price;
  const [posPrice, setPosPrice] = React.useState(h % 4 === 0 ? Math.max(1, shellPrice - Math.max(1, Math.round(shellPrice * 0.1))) : shellPrice);
  const priceOverridden = posPrice !== shellPrice;

  const Fld = ({ label, value, mono, wide, color, locked, hint, onEditLocked, onChange, onCommit, right, placeholder }) =>
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, gridColumn: wide ? '1/-1' : 'auto' }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{label}{hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}</span>
      <div style={{ padding: '9px 12px', border: `1px solid ${locked ? P.hairline : P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: locked ? P.surface2 : P.field || P.surface, fontSize: 13.5, fontWeight: 600, color: color || (locked ? P.ink2 : P.ink), fontFamily: mono ? P.fontMono : P.fontSans, minHeight: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
        {onChange ?
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={() => onCommit && onCommit()} onKeyDown={(e) => {if (e.key === 'Enter') {e.preventDefault();e.currentTarget.blur();}}} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', color: color || P.ink, fontSize: 13.5, fontWeight: 600, fontFamily: mono ? P.fontMono : P.fontSans, padding: 0 }} /> :
      <span style={{ flex: 1, minWidth: 0, whiteSpace: wide ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>}
        {right}
        {locked && (onEditLocked ?
      <button onClick={(e) => {e.preventDefault();onEditLocked();}} title="Edit in the product shell" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 0 auto', padding: '2px 8px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.info, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="pencil" size={11} stroke={2.2} />Edit in shell</button> :
      <Icon name="lock" size={12} stroke={1.9} color={P.inkFaint} style={{ flex: '0 0 auto' }} />)}
      </div>
    </label>;
  const FldSelect = ({ label, value, options, onChange, hint, tint, colorFor }) => {
    const cf = colorFor ? colorFor(value) : null;
    const tt = tint && !cf ? tagTint(value, P) : null;
    const boxBg = cf ? cf + '14' : tt ? tt.bg : P.field || P.surface;
    const boxBorder = cf ? cf + '66' : tt ? tt.border : P.fieldBorder || P.hairline2;
    const accent = cf || (tt ? tt.fg : null);
    return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{label}{hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}</span>
      <div style={{ position: 'relative' }}>
        <select value={value} onChange={(e) => onChange && onChange(e.target.value)} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '9px 34px 9px 12px', border: `1px solid ${boxBorder}`, borderLeft: accent ? `3px solid ${accent}` : `1px solid ${boxBorder}`, borderRadius: P.r10, background: boxBg, fontSize: 13.5, fontWeight: 600, color: tt ? tt.fg : P.ink, fontFamily: P.fontSans, minHeight: 38, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>{(options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    </label>;
  };
  const FldNum = ({ label, value, onChange, suffix, decimals, color, hint }) =>
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{label}{hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, minHeight: 38 }}>
        <input value={value} inputMode="decimal" onChange={(e) => {let v = e.target.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');if (decimals) {const parts = v.split('.');if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');}onChange && onChange(v);}} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', color: color || P.ink, fontSize: 13.5, fontWeight: 700, fontFamily: P.fontMono, padding: '9px 0' }} />
        {suffix && <span style={{ fontSize: 12.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{suffix}</span>}
      </div>
    </label>;
  const Sec = ({ icon, title, sub, children, cols = 2, right }) =>
  <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={15} stroke={1.9} /></span>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: 11.5, color: P.inkDim }}>{sub}</div>}</div>
        {right && <div style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{right}</div>}
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: '13px 14px' }}>{children}</div>
    </Card>;
  // terpene profile + reported effects (deterministic)
  const TERP_INFO = { Myrcene: ['Earthy · musky', '#8A5CD6'], Limonene: ['Citrus · zesty', '#D9A21C'], Caryophyllene: ['Peppery · spicy', '#D2483F'], Pinene: ['Pine · herbal', '#3DA35D'], Linalool: ['Floral · lavender', '#8E7BE0'], Terpinolene: ['Fruity · fresh', '#21A89B'] };
  // Terpenes: we do NOT collect percentages or mg — qualitative aroma + dominance only.
  const TERP_RANK = ['Dominant', 'Secondary', 'Present'];
  const terpProfile = terps.map((t, i) => ({ name: t, rank: TERP_RANK[i] || 'Present', note: TERP_INFO[t][0], color: TERP_INFO[t][1] }));
  const rankTone = (r) => r === 'Dominant' ? { c: P.accentText, bg: P.accentSoft } : r === 'Secondary' ? { c: P.ink2, bg: P.surface3 } : { c: P.inkMute, bg: P.surface3 };
  const TerpRow = ({ t }) => {const rt = rankTone(t.rank);return <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
    <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flex: '0 0 auto' }} />
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{t.name}</div><div style={{ fontSize: 11.5, color: P.inkMute }}>{t.note}</div></div>
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: rt.c, background: rt.bg, borderRadius: 6, padding: '3px 8px' }}>{t.rank}</span>
  </div>;};
  // Inventory and lots now come from `inv` / `bRows` above. The whole
  // synthetic batch generator is gone: batchCount = 3 + h % 21, METRC tag,
  // COA verdict, expiry and CBD were all charCodeSum arithmetic, and the
  // auditor predicted 13 lots, B-STZ--2508 and 1A4FF011298966656 for
  // STZ-IF-663744 from the SKU string alone.
  // THC low / high / avg are per-batch rollups, so they exist only when real
  // lots exist. The average is qty-weighted, which is what its label claims.
  const thcLots = (bRows || []).filter((b) => b.thc != null && b.qty > 0);
  const thcLo = thcLots.length ? Math.min(...thcLots.map((b) => b.thc)) : null;
  const thcHi = thcLots.length ? Math.max(...thcLots.map((b) => b.thc)) : null;
  const thcWt = thcLots.reduce((a, b) => a + b.qty, 0);
  const thcAvg = thcWt ? +(thcLots.reduce((a, b) => a + b.thc * b.qty, 0) / thcWt).toFixed(1) : null;
  const [cat, setCat] = React.useState(p.cat);
  const [subcat, setSubcat] = React.useState((SUBCATS[p.cat] || ['—'])[0]);
  const [ptype, setPtype] = React.useState(p.strain ? 'Cannabis' : 'Accessory');
  const [strainType, setStrainType] = React.useState(p.strain || 'Hybrid');
  const [unit, setUnit] = React.useState(/mg/.test(p.wt || '') ? 'each' : 'gram');
  const [netW, setNetW] = React.useState(weightOnly === '—' ? '' : weightOnly.replace(/[^0-9.]/g, ''));
  const wUnitSuffix = { gram: 'g', mg: 'mg', oz: 'oz', ml: 'ml', each: '', pack: '' }[unit] || '';
  const KIT_BY_CAT = { Flower: 'Flower Box 1', 'Pre-Rolls': 'Pre-roll Box 1', Vapes: 'Vape Box 1', Edibles: 'Edible Box', Concentrates: 'Concentrate bin 1', Wellness: 'Cooler', Deals: 'Cooler', Accessories: 'Cooler' };
  const [kitBox, setKitBox] = React.useState(KIT_BY_CAT[p.cat] || 'Cooler');
  const [shellEdit, setShellEdit] = React.useState(false);
  // The product NAME is a variation field — the flavour or strain that
  // distinguishes this product inside its shell — so it is edited right here.
  // Brand, SKU and barcode belong to the shell and stay locked.
  const [name, setName] = React.useState(p.name);
  const nameDirty = name.trim() !== p.name;
  const saveName = () => {
    const next = name.trim();
    if (!next || next === p.name) {setName(p.name);return;}
    const sh = window.HW_SHELL.shellOf(p);
    window.HW_SHELL.renameVariation(sh && sh.id, p.sku, next);
  };
  // Meta is AI-drafted. src tracks provenance per field: ai | local | edited.
  const META_FIELDS = ['title', 'desc', 'slug', 'keywords'];
  const [meta, setMeta] = React.useState(() => ({ title: metaVariant('title', p, p.name, 0), desc: metaVariant('desc', p, p.name, 0), slug: metaVariant('slug', p, p.name, 0), keywords: metaVariant('keywords', p, p.name, 0) }));
  const [metaSrc, setMetaSrc] = React.useState({ title: 'local', desc: 'local', slug: 'local', keywords: 'local' });
  const [metaBusy, setMetaBusy] = React.useState({});
  const metaVar = React.useRef({ title: 0, desc: 0, slug: 0, keywords: 0 });
  const draftMeta = React.useCallback(async (field) => {
    setMetaBusy((b) => ({ ...b, [field]: true }));
    try {
      const line = await aiMetaField(field, p, name);
      setMeta((m) => ({ ...m, [field]: line }));
      setMetaSrc((x) => ({ ...x, [field]: 'ai' }));
    } catch (e) {
      metaVar.current[field] = (metaVar.current[field] + 1) % 3;
      setMeta((m) => ({ ...m, [field]: metaVariant(field, p, name, metaVar.current[field]) }));
      setMetaSrc((x) => ({ ...x, [field]: 'local' }));
    }
    setMetaBusy((b) => ({ ...b, [field]: false }));
  }, [p.sku, name]);
  const draftAllMeta = () => META_FIELDS.forEach(draftMeta);
  const editMeta = (field, v) => {setMeta((m) => ({ ...m, [field]: v }));setMetaSrc((x) => ({ ...x, [field]: 'edited' }));};
  // First draft on open, and again whenever the product name changes.
  React.useEffect(() => {draftAllMeta();}, [p.sku]);
  const metaSlug = meta.slug, metaTitle = meta.title, metaDesc = meta.desc, metaKeywords = meta.keywords;
  const AiTag = ({ field }) => {
    const st = metaSrc[field];
    const on = st === 'ai';
    return <span title={on ? 'Drafted by AI' : st === 'edited' ? 'AI draft, edited by a person' : 'Local draft — the model could not be reached'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', borderRadius: 99, padding: '2px 6px',
        color: on ? P.accentText : P.inkMute, background: on ? P.accentSoft : P.surface3, border: `1px solid ${on ? P.accentBorder : P.hairline2}` }}>
      <Icon name="lightning" size={9} stroke={2} />{st === 'edited' ? 'AI · EDITED' : on ? 'AI' : 'AI · OFFLINE'}</span>;
  };
  const Redraft = ({ field }) =>
  <button onClick={(e) => {e.preventDefault();draftMeta(field);}} disabled={!!metaBusy[field]} title="Re-draft this field with AI"
    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 0 auto', padding: '2px 8px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.inkDim, fontSize: 11.5, fontWeight: 700, cursor: metaBusy[field] ? 'default' : 'pointer', fontFamily: P.fontSans }}>
    <Icon name="refresh" size={11} stroke={2.2} style={{ animation: metaBusy[field] ? 'hwspin 0.8s linear infinite' : 'none' }} />{metaBusy[field] ? 'Drafting' : 'Redraft'}</button>;
  // THE WORST THING THIS FILE EVER DID lived here. It printed a METRC
  // traceability tag, a COA Passed/Pending verdict, an expiry date and a THC
  // and CBD potency for every one of `3 + charCodeSum(sku) % 21` lots that do
  // not exist, under a heading that said "traceability". METRC is the state
  // cannabis traceability system; a tag read off this screen could end up in a
  // regulatory document. None of those four fields exists in the API in any
  // form — there is no column for them — so this panel renders the five fields
  // that are real and names the four that are not.
  const MISSING_NOTE = <>METRC tag, COA result, expiration date and CBD are <b>not held by this system</b>. A batch record here is lot id, region, units, THC % and date received — the API has no field for the other four. Read a traceability tag from METRC and a lab result from the COA itself; neither can be confirmed from this screen.</>;
  const BatchPanel = () => {
    const [bq, setBq] = React.useState('');const [showAll, setShowAll] = React.useState(false);
    if (bRows === undefined) {
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <NotKnown icon="shield" title="Batch lots — not known"
          body={<>Nothing has told this screen which lots <Mono>{p.sku}</Mono> is in. <Mono>GET /api/state</Mono> does carry a <b>batches</b> array, but the live seam (<Mono>shared/hw-live.js</Mono>) never attaches it to a product{fromApi ? '' : ', and this page is not reading the API at all'} — so no lot has ever reached this page. That is <b>not</b> the same statement as “this SKU has no lots”.</>} />
        <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.55 }}>{MISSING_NOTE}</div>
      </div>;
    }
    if (!bRows.length) {
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <NotKnown icon="shield" title="No batch lots recorded"
          body={<>The inventory API holds no batch rows for <Mono>{p.sku}</Mono>. Stock for this SKU is accounted for as a plain per-region total, not by lot.</>} />
        <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.55 }}>{MISSING_NOTE}</div>
      </div>;
    }
    const filtered = bRows.filter((b) => !bq || b.id.toLowerCase().includes(bq.toLowerCase()));
    const shown = showAll ? filtered : filtered.slice(0, 5);
    const totalUnits = bRows.reduce((a, b) => a + b.qty, 0);
    const potency = thcLo == null ? 'THC not recorded' : thcLo === thcHi ? `${thcLo}% THC` : `${thcLo}–${thcHi}% THC`;
    const gc = '1.2fr 1fr .6fr .6fr 1fr';
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Batches</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, background: P.surface3, padding: '2px 8px', borderRadius: 99 }}>{bRows.length}</span>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{totalUnits} units · {potency} · FIFO by date received</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 186 }}><Field icon="search" placeholder="Batch id…" value={bq} onChange={(e) => setBq(e.target.value)} size="sm" mono /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: gc, gap: '0 22px', padding: '9px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, borderBottom: `1px solid ${P.hairline}` }}>
        <span>Batch</span><span>Region</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>THC</span><span>Received</span>
      </div>
      <div style={{ maxHeight: showAll ? 340 : 'none', overflowY: showAll ? 'auto' : 'visible' }}>
        {shown.map((b, i) => <div key={b.id + '|' + b.slug + '|' + i} style={{ display: 'grid', gridTemplateColumns: gc, gap: '0 22px', alignItems: 'center', padding: '11px 14px', borderTop: i ? `1px solid ${P.hairline}` : 'none', background: i % 2 ? P.surface2 : 'transparent' }}>
          <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: P.ink }}>{b.id}</span>
          <span style={{ fontSize: 11.5, color: P.ink2 }}>{b.slug ? regionLabelOf(b.slug) : <span style={{ color: P.inkMute }}>not recorded</span>}</span>
          <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 600, color: P.ink2 }}>{b.qty}</span>
          <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 600, color: b.thc == null ? P.inkMute : P.ink }}>{b.thc == null ? 'n/r' : b.thc + '%'}</span>
          <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{receivedLabel(b.received) || 'not recorded'}</span>
        </div>)}
        {filtered.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No batches match.</div>}
      </div>
      {filtered.length > 5 && <button onClick={() => setShowAll((v) => !v)} style={{ width: '100%', padding: '10px', background: P.surface2, border: 'none', borderTop: `1px solid ${P.hairline}`, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600, color: P.info }}>{showAll ? 'Show less' : `View all ${filtered.length} batches`}</button>}
      </div>
      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.55 }}>{MISSING_NOTE}</div>
    </div>;
  };
  // The activity log was five invented entries — three of them named staff
  // ("Manisha Saini deactivated the Weedmaps delivery listing, today 2:14 PM")
  // and one receiving a lot that does not exist. An audit trail is exactly the
  // thing nobody should have to guess about. /api/state DOES carry an `events`
  // feed, but the live seam does not expose it and it is not per-SKU, so this
  // screen has no per-product history from any source.


  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      {/* Back + actions bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={17} stroke={2.2} />Back to catalog</button>
        <div style={{ flex: 1 }} />
        <PBtn variant="secondary" size="md" icon="link">View on Weedmaps</PBtn>
        <PBtn variant="secondary" size="md" icon={p.active ? 'eye-off' : 'check-circle'}>{p.active ? 'Deactivate' : 'Activate'}</PBtn>
        <PBtn variant="accent" size="md" icon="check">Save changes</PBtn>
      </div>

      {/* Identity header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '16px 18px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, marginBottom: 16, boxShadow: P.shadowSm }}>
        <Thumb item={p} size={60} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: P.ink }}>{name}</span>
            {p.strain && <StrainPill type={p.strain} />}
            {p.active ? <Pill kind="good" dot>Active</Pill> : <Pill kind="neutral" dot>Inactive</Pill>}
          </div>
          <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{p.sku} · {p.brand} · {p.cat}</div>
        </div>
      </div>

      {/* 2-col: main + rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 336px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Sec icon="package" title="Product information" cols={3}>
            <Fld label="Product name" value={name} wide hint="The variation name inside the shell — the flavour or strain. Renaming here updates every store and channel." placeholder="e.g. Blue Dream" onChange={setName} onCommit={saveName}
            right={nameDirty ?
            <button onClick={(e) => {e.preventDefault();saveName();}} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 0 auto', padding: '2px 8px', borderRadius: 99, border: 'none', background: P.accent, color: P.accentInk, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="check" size={11} stroke={2.6} />Save name</button> :
            <span title="Variation field — editable here" style={{ display: 'inline-flex', flex: '0 0 auto', color: P.inkFaint }}><Icon name="pencil" size={12} stroke={1.9} /></span>} />
            <Fld label="Brand" value={p.brand} locked onEditLocked={() => setShellEdit(true)} />
            <Fld label="Supplier / vendor" value="Not recorded" locked hint="The API serves no distributor for this SKU. What used to render here was the brand name with the word 'Distribution' stuck on the end — a licence-holder invented by string concatenation." />
            <FldSelect label="Category" value={cat} options={window.HW.CATS} onChange={(v) => {setCat(v);setSubcat((SUBCATS[v] || ['—'])[0]);}} colorFor={(v) => window.HW.CAT_COLOR[v]} />
            <FldSelect label="Subcategory" value={subcat} options={SUBCATS[cat] || ['—']} onChange={setSubcat} colorFor={() => window.HW.CAT_COLOR[cat]} />
            <FldSelect label="Product type" value={ptype} options={['Cannabis', 'Accessory', 'Wellness', 'CBD']} onChange={setPtype} tint />
            <Fld label="SKU" value={p.sku} mono locked />
            <Fld label="Barcode / UPC" value="Not recorded" locked hint="No barcode is served for this SKU. The 12-digit number that used to sit here was arithmetic on the SKU string, not a UPC." />
            <FldSelect label="Delivery kit box type" value={kitBox} options={['Flower Box 1', 'Flower Box 2', 'Pre-roll Box 1', 'Pre-roll Box 2', 'Vape Box 1', 'Vape Box 2', 'Edible Box', 'Edible Bin', 'Concentrate bin 1', 'Concentrate bin 2', 'Cooler']} onChange={setKitBox} tint />
          </Sec>

          <StorefrontContent p={p} />

          <ProductTags />

          <Sec icon="lightning" title="Cannabis facts" cols={3}>
            <FldSelect label="Strain type" value={strainType} options={['Indica', 'Sativa', 'Hybrid', 'CBD', 'N/A']} onChange={setStrainType} tint />
            <FldNum label="Net weight" value={netW} onChange={setNetW} decimals suffix={wUnitSuffix} />
            <FldSelect label="Unit" value={unit} options={['gram', 'each', 'mg', 'oz', 'ml', 'pack']} onChange={setUnit} tint />
            {/* Per-batch rollups. They exist only when real lots do; they used
                to be Math.min/max over a batch list generated from the SKU. */}
            <Fld label="THC · low" value={thcLo == null ? 'Not recorded' : thcLo + '%'} mono={thcLo != null} locked color={thcLo == null ? P.inkMute : undefined} hint="Lowest THC across in-stock lots. Rolled up from the batch records — set on the batch, not here." />
            <Fld label="THC · high" value={thcHi == null ? 'Not recorded' : thcHi + '%'} mono={thcHi != null} locked color={thcHi == null ? P.inkMute : undefined} hint="Highest THC across in-stock lots." />
            <Fld label="THC · avg" value={thcAvg == null ? 'Not recorded' : thcAvg + '%'} mono={thcAvg != null} locked color={thcAvg == null ? P.inkMute : P.accentText} hint="Units-weighted average across in-stock lots." />
            {thcLo == null &&
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: P.inkDim }}><Icon name="info" size={13} color={P.inkMute} />
              Per-batch potency needs batch records, and this screen has none — see <b style={{ color: P.ink2 }}>Batches</b> below. Catalogue-level THC for this SKU: <b style={{ color: P.ink2 }}>{p.thc == null ? 'not recorded either' : p.thc + '%'}</b>.
            </div>}
            <div style={{ gridColumn: '1/-1' }}><AiEffects product={p} /></div>
            <div style={{ gridColumn: '1/-1' }}><TerpeneEditor initial={terpProfile} /></div>
          </Sec>

          <GeneticsSection />

          <ProductTraits p={p} packN={packN} pkgType={pkgType} />

          <Sec icon="tag" title="Pricing & margin" cols={3}>
            <button onClick={() => setShellEdit(true)} title="Open the product shell" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="package" size={16} stroke={1.9} /></span>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, display: 'block' }}>Product shell · source of truth</span><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{shellName}</span> <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{shellId}</span></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: P.info }}>Open shell<Icon name="arrow-right" size={13} stroke={2.2} /></span>
            </button>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Retail price{priceOverridden && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color: P.accentText, background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: 5, padding: '1px 6px' }}>OVERRIDDEN</span>}</span>
              <div style={{ padding: '9px 12px', border: `1px solid ${priceOverridden ? P.accentBorder : P.hairline}`, borderRadius: P.r10, background: priceOverridden ? P.accentSoft : P.surface2, fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, minHeight: 38, display: 'flex', alignItems: 'center' }}>{fmt.money(posPrice)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: P.inkDim }}>
                {priceOverridden ? <><span style={{ textDecoration: 'line-through', fontFamily: P.fontMono, color: P.inkMute }}>{fmt.money(shellPrice)}</span><span>shell</span><button onClick={() => setPosPrice(shellPrice)} style={{ background: 'none', border: 'none', padding: 0, color: P.info, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5 }}>Revert to shell</button></> :
                <><Icon name="link" size={11} color={P.inkMute} /><span>Synced from shell</span><button onClick={() => setPosPrice(Math.max(1, shellPrice - Math.max(1, Math.round(shellPrice * 0.1))))} style={{ background: 'none', border: 'none', padding: 0, color: P.info, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5 }}>Override price</button></>}
              </div>
            </label>
            <Fld label="Compare-at" hint="The “was” price shown struck-through on menus to signal a markdown — usually the MSRP or pre-sale price. Leave blank when the item isn’t on sale." value={p.was ? fmt.money(p.was) : '—'} mono locked />
            <Fld label="Wholesale cost" value={fmt.money(p.cost)} mono locked />
            <Fld label="Price / gram" value={perGram ? fmt.money(perGram) : '—'} mono locked />
            <Fld label="Tax category" value="CA Cannabis" locked />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Margin</span>
              <div style={{ minHeight: 38, display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: mc, fontFamily: P.fontMono }}>{Math.round(p.margin * 100)}%</span>
                <span style={{ flex: 1, height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}><span style={{ display: 'block', width: `${Math.round(p.margin * 100)}%`, height: '100%', background: mc }} /></span>
              </div>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: P.inkDim }}><Icon name="lock" size={12} stroke={1.9} color={P.inkMute} />Retail price, wholesale cost and tax come from the <b style={{ color: P.ink2 }}>product shell</b>. Override the retail price here only when this store must deviate from shell pricing; margin is derived from the effective price.</div>
          </Sec>

          <Sec icon="package" title="Inventory by region" sub={inv ? `${inv.totAvail} available · ${inv.totHold} on hold · ${inv.totOnHand} on hand` : 'Per-region split not held'} cols={1}>
            {inv ?
            <><InventoryByLocation inv={inv} batches={bRows} />
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11.5, color: P.inkDim, lineHeight: 1.55 }}><Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 2 }} /><span>Read from <b style={{ color: P.ink2 }}>/api/state.stock</b>, one row per region the API reports for this SKU. <b style={{ color: P.ink2 }}>On hold</b> is that cell's unexpired soft reservations — a real hold placed by a real cart, not an estimate. <b style={{ color: P.ink2 }}>Available</b> = on hand minus on hold.</span></div></> :

            <NotKnown icon="package" title="Per-region inventory — not known"
              body={<>{fromApi ?
                <>The API returns no stock row for <Mono>{p.sku}</Mono> in any region, so this screen does not know where its units sit or how many are on hold.</> :
                <>This page is running on the bundled demo catalogue, not <Mono>/api/state</Mono>, and that catalogue carries no per-region stock at all — so where this SKU's units sit, and how many are on hold, is not known here.</>}{' '}
                {p.qty == null ? <>No unit count is available for it either.</> : <>The catalogue's own total for this SKU is <b>{p.qty}</b> units — a single figure with no regional split and no reservation count behind it.</>}</>} />}
          </Sec>

          <Sec icon="shield" title="Batches" sub="Lot records held by the inventory API — see the note on what it does not hold" cols={1}>
            <BatchPanel />
          </Sec>

          <Sec icon="tag" title="Meta" sub="Storefront page, search engines & link previews" cols={2}
            right={<PBtn variant="soft" size="xs" icon="sparkle" onClick={draftAllMeta} disabled={META_FIELDS.some((f) => metaBusy[f])}>{META_FIELDS.some((f) => metaBusy[f]) ? 'Drafting…' : 'Redraft all with AI'}</PBtn>}>
            <div style={{ gridColumn: '1/-1' }}><Fld label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Meta title <AiTag field="title" /></span>} value={meta.title} wide hint="Recommended 50–60 characters." onChange={(v) => editMeta('title', v)} right={<Redraft field="title" />} /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Meta description</span>
                <AiTag field="desc" />
                <span style={{ fontSize: 10, color: meta.desc.length > 158 ? P.bad : P.inkMute, fontFamily: P.fontMono }}>{meta.desc.length}/158</span>
                <div style={{ flex: 1 }} />
                <Redraft field="desc" />
              </div>
              <textarea value={meta.desc} onChange={(e) => editMeta('desc', e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 12px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.5, outline: 'none' }} />
            </div>
            <Fld label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>URL slug <AiTag field="slug" /></span>} value={meta.slug} mono onChange={(v) => editMeta('slug', v)} right={<Redraft field="slug" />} />
            <Fld label="Canonical URL" value={'hyperwolf.com/shop/' + meta.slug} mono locked hint="Generated from the slug." />
            <div style={{ gridColumn: '1/-1' }}><Fld label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Keywords <AiTag field="keywords" /></span>} value={meta.keywords} wide onChange={(v) => editMeta('keywords', v)} right={<Redraft field="keywords" />} /></div>
            <Fld label="OG image" value="Storefront photo (product)" locked hint="Falls back to this product’s photo unless a social image is set." />
            <Fld label="Robots" value={p.active ? 'index, follow' : 'noindex'} locked hint="Inactive products are automatically de-indexed." />
            <div style={{ gridColumn: '1/-1', padding: '12px 14px', background: P.surface2, borderRadius: P.r10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 7 }}>Search preview</div>
              <div style={{ fontSize: 11.5, color: P.good, fontFamily: P.fontMono }}>hyperwolf.com › shop › {meta.slug}</div>
              <div style={{ fontSize: 15, color: '#1a0dab', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{meta.title}</div>
              <div style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.5, marginTop: 3 }}>{meta.desc}</div>
            </div>
          </Sec>

          <Card padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="clock" size={15} stroke={1.9} /></span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Activity log</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Who changed what, and when — where it is recorded</div></div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <NotKnown icon="clock" title="No change history for this product"
                body={<>Nobody has told this screen who changed <Mono>{p.sku}</Mono>, or when. <Mono>/api/state</Mono> carries a workspace-wide <b>events</b> feed, but it is not per-product and the live seam does not expose it here. The entries that used to fill this card — named staff, timestamps, a received lot — were written into the file, not recorded by anything.</>} />
            </div>
          </Card>
        </div>

        {/* Rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* At a glance — pricing, margin, stock (relocated out of the header) */}
          <Card padding={0}>
            <div style={{ padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>At a glance</div></div>
            <div style={{ padding: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              {[
              ['Price', fmt.money0(p.price), p.was ? P.bad : P.ink, p.was ? `was ${fmt.money0(p.was)}` : 'retail'],
              ['Margin', `${Math.round(p.margin * 100)}%`, mc, `wholesale ${fmt.money(p.cost)}`],
              inv ? ['On hand', inv.totOnHand, inv.totOnHand === 0 ? P.bad : inv.totOnHand < 10 ? P.warn : P.ink, `${inv.rows.length} region${inv.rows.length === 1 ? '' : 's'}`] :
              ['On hand', p.qty == null ? 'not known' : p.qty, P.inkMute, p.qty == null ? 'no figure served' : 'catalogue total · no split'],
              inv ? ['Available', inv.totAvail, inv.totAvail === 0 ? P.bad : inv.totAvail < 10 ? P.warn : P.good, `${inv.totHold} on hold`] :
              ['Available', 'not known', P.inkMute, 'holds not reported']].
              map(([k, v, c, s]) =>
              <div key={k} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderLeft: `3px solid ${c}`, borderRadius: P.r10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: typeof v === 'string' && v.length > 6 ? 12.5 : 16, fontWeight: 700, color: c, fontFamily: P.fontMono, marginTop: 2 }}>{v}</div>
                  <div style={{ fontSize: 10, color: P.inkDim }}>{s}</div>
                </div>)}
            </div>
          </Card>

          {/* Weedmaps sync */}
          <Card padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: P.brand.weedmapsInk, background: P.brand.weedmaps, padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: P.brand.weedmapsInk }} />Weedmaps</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: m.c }}><span style={{ width: 8, height: 8, borderRadius: 99, background: m.c }} />{m.label}</span>
            </div>
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 12 }} data-tour="wm-card">
              <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }} data-tour="wm-listings">Last synced {p.wm.last} · {listingsSub(p.wm)}</div>
              {p.wm.issue &&
              <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: p.wm.state === 'error' ? P.badSoft : P.warnSoft, borderRadius: P.r10 }}>
                <Icon name="shield" size={15} stroke={1.9} color={p.wm.state === 'error' ? P.bad : P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>{p.wm.issue}</div>
              </div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }} data-tour="wm-extid">
                <Icon name="lock" size={13} stroke={1.9} color={P.inkMute} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>external_id</div><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{p.wm.ext}</div></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[{ ic: 'shop', c: P.warn, label: 'Pickup listings', on: pkOn, total: pkTot, live: onPickup, sub: onPickup ? 'store listings' : 'not listed', note: '2–3 store listings' }, { ic: 'truck', c: P.info, label: 'Delivery pins', on: dlOn, total: dlTot, live: onDelivery, sub: onDelivery ? `live in ${kits} on-shift kit${kits > 1 ? 's' : ''}` : 'not listed', note: 'one pin per city' }].map((r) =>
                <div key={r.label} style={{ padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={r.ic} size={14} color={r.live ? r.c : P.inkFaint} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: 11.5, fontFamily: P.fontMono, fontWeight: 700, color: r.live ? P.ink2 : P.inkFaint }}>{r.on}<span style={{ color: P.inkFaint, fontWeight: 500 }}> / {r.total}</span></span>
                    {r.live ? <Pill kind="good" dot>Live</Pill> : <Pill kind="neutral" dot>Off</Pill>}
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: P.surface3, overflow: 'hidden', marginTop: 7 }}><div style={{ width: `${Math.round(r.on / r.total * 100)}%`, height: '100%', background: r.live ? r.c : P.inkFaint }} /></div>
                  <div style={{ fontSize: 10, color: P.inkMute, marginTop: 5, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{r.sub}</span><span>{r.note}</span></div>
                </div>)}
                <button onClick={() => setWmMap(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', background: 'transparent', border: 'none', cursor: 'pointer', color: P.info, fontSize: 11.5, fontWeight: 700, fontFamily: P.fontSans }}>View all listings<Icon name="arrow-right" size={13} stroke={2.2} /></button>
              </div>
              <button onClick={() => setWmMap(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 12px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700, color: P.ink2 }}><Icon name="link" size={14} stroke={1.9} />{wmConf ? `Match · ${Math.round(wmConf * 100)}% confidence` : 'Map to a Weedmaps product'}</button>
              <WmResyncButton p={p} />
            </div>
          </Card>

          {/* Performance */}
          <Card padding={0}>
            <div style={{ padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Last 30 days</div></div>
            {/* units sold = 40 + charCodeSum(sku) % 180, revenue = that times
                the price, velocity = that over 30, last sold = a three-item
                array indexed by the same hash. All four printed as measured
                sales, in the same rail as the price and margin, which are real. */}
            <div style={{ padding: 15 }}>
              <NotKnown icon="chart-line" title="Per-product sales are not tracked here"
                body={<>Orders reach this screen without line items, so units sold, revenue, velocity and last-sold cannot be worked out for <Mono>{p.sku}</Mono> from anything available here. The POS sales report is the place to read them.</>} />
            </div>
          </Card>
        </div>
      </div>
      {wmMap && <WmMatchModal p={p} conf={wmConf} onClose={() => setWmMap(false)} />}
      {shellEdit && <window.ShellEditModal p={p} onClose={() => setShellEdit(false)} />}
    </div>);
}

// Product tags — merchandising labels (relocated out of the old custom-attributes block)
function ProductTags() {
  const P = useP();
  const [tags, setTags] = React.useState(['Relaxed', 'Sleepy', 'Top shelf']);
  const [tagInput, setTagInput] = React.useState('');
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="tag" size={15} stroke={1.9} /></span>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Tags</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Merchandising labels for search, filtering &amp; collections</div></div>
    </div>
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {tags.map((t, i) => {const tt = tagTint(t, P);return <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: tt.bg, border: `1px solid ${tt.border}`, borderRadius: 99, fontSize: 12.5, fontWeight: 600, color: tt.fg }}>{t}<button onClick={() => setTags((ts) => ts.filter((_, j) => j !== i))} title="Remove tag" style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: tt.fg, opacity: .7, padding: 0 }}><Icon name="x" size={12} stroke={2.4} /></button></span>;})}
        <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => {if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {e.preventDefault();setTags((ts) => [...ts, tagInput.trim()]);setTagInput('');}}} placeholder="Add tag…" style={{ flex: '1 0 90px', minWidth: 90, padding: '5px 10px', border: `1px dashed ${P.hairline3}`, borderRadius: 99, background: 'transparent', color: P.ink, fontSize: 12.5, outline: 'none', fontFamily: P.fontSans }} />
      </div>
    </div>
  </Card>;
}

// Product traits — editable; add / remove / modify and override the shell defaults
function ProductTraits({ p, packN, pkgType }) {
  const P = useP();
  const shell = [
  { k: 'Servings', v: /mg/.test(p.wt || '') ? '10' : '1' },
  { k: 'Units per pack', v: String(packN) },
  { k: 'Package type', v: pkgType },
  { k: 'Country of origin', v: 'USA' },
  { k: 'Storage', v: 'Cool, dry, out of light' }];

  const [rows, setRows] = React.useState(shell.map((r) => ({ ...r, shell: true, orig: r.v })));
  const set = (i, val) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, v: val } : x));
  const inpS = { minWidth: 0, width: '100%', padding: '8px 10px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, background: P.surface, color: P.ink, fontSize: 12.5, fontWeight: 600, outline: 'none', fontFamily: P.fontSans, boxSizing: 'border-box' };
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="layout" size={15} stroke={1.9} /></span>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Product traits</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Defaults come from the product shell — edit to override, or add your own</div></div>
    </div>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 92px 28px', gap: 9, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}><span>Trait</span><span>Value</span><span /><span /></div>
      {rows.map((r, i) => {const overridden = r.shell && r.v !== r.orig;return <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 92px 28px', gap: 9, alignItems: 'center' }}>
        {r.shell ? <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2 }}>{r.k}</span> : <input value={r.k} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} placeholder="Trait name" style={inpS} />}
        <input value={r.v} onChange={(e) => set(i, e.target.value)} placeholder="Value" style={inpS} />
        <span style={{ textAlign: 'right' }}>{r.shell ? overridden ? <button onClick={() => set(i, r.orig)} title="Reset to shell value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.accentText, background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: 99, padding: '2px 7px', cursor: 'pointer' }}>Overridden<Icon name="x" size={9} stroke={2.6} /></button> : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute, border: `1px solid ${P.hairline2}`, borderRadius: 99, padding: '2px 7px' }}>Shell</span> : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.info }}>Custom</span>}</span>
        <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute, padding: 5, display: 'flex' }}><Icon name="trash" size={16} stroke={1.9} /></button>
      </div>;})}
      <button onClick={() => setRows((rs) => [...rs, { k: '', v: '', shell: false }])} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', color: P.info, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><Icon name="plus" size={15} stroke={2.2} />Add trait</button>
    </div>
  </Card>;
}

// Genetics — link parent / related strains from the strain DB (search existing or add new; no limit)
const STRAIN_DB = ['Blue Dream', 'OG Kush', 'Girl Scout Cookies', 'Gelato', 'Wedding Cake', 'Sour Diesel', 'Granddaddy Purple', 'Runtz', 'Zkittlez', 'Northern Lights', 'Jack Herer', 'Pineapple Express', 'Do-Si-Dos', 'Gorilla Glue #4', 'Purple Punch', 'Durban Poison', 'Bubba Kush', 'Tangie', 'MAC', 'Sunset Sherbet', 'Biscotti', 'Chemdawg', 'GMO', 'Sherbert'];
function GeneticsSection() {
  const P = useP();
  const [sel, setSel] = React.useState([{ name: 'Gelato', rel: 'Parent' }, { name: 'Sunset Sherbet', rel: 'Parent' }]);
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const names = sel.map((s) => s.name);
  const matches = STRAIN_DB.filter((n) => n.toLowerCase().includes(q.toLowerCase()) && !names.includes(n)).slice(0, 8);
  const exact = STRAIN_DB.some((n) => n.toLowerCase() === q.trim().toLowerCase());
  const add = (name, isNew) => {setSel((s) => [...s, { name, rel: 'Related', isNew }]);setQ('');setOpen(false);};
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="link" size={15} stroke={1.9} /></span>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Genetics</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Link parent &amp; related strains from the strain database — add as many as you like</div></div>
    </div>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sel.map((s, i) => {const tt = tagTint(s.name, P);return <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 6px 5px 11px', background: tt.bg, border: `1px solid ${tt.border}`, borderRadius: 99 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: tt.fg }}>{s.name}</span>
          {s.isNew && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.good }}>New</span>}
          <select value={s.rel} onChange={(e) => setSel((ss) => ss.map((x, j) => j === i ? { ...x, rel: e.target.value } : x))} style={{ appearance: 'none', WebkitAppearance: 'none', border: `1px solid ${tt.border}`, background: P.surface, color: P.ink2, borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '2px 6px', cursor: 'pointer', fontFamily: P.fontSans }}>{['Parent', 'Related', 'Cross', 'Phenotype'].map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <button onClick={() => setSel((ss) => ss.filter((_, j) => j !== i))} title="Remove" style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: tt.fg, opacity: .7, padding: 0 }}><Icon name="x" size={13} stroke={2.4} /></button>
        </span>;})}
        {sel.length === 0 && <span style={{ fontSize: 12.5, color: P.inkMute }}>No strains linked yet.</span>}
      </div>
      <div style={{ position: 'relative', maxWidth: 380 }}>
        <Field icon="search" placeholder="Search strains…" value={q} onChange={(e) => {setQ(e.target.value);setOpen(true);}} onFocus={() => setOpen(true)} size="md" />
        {open && q.trim() && <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, boxShadow: P.shadowLg, zIndex: 41, padding: 5, maxHeight: 260, overflowY: 'auto' }}>
            {matches.map((n) => <button key={n} onClick={() => add(n, false)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><Icon name="link" size={13} color={P.inkMute} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{n}</span></button>)}
            {!exact && <button onClick={() => add(q.trim(), true)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', borderTop: matches.length ? `1px solid ${P.hairline}` : 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><Icon name="plus" size={13} color={P.good} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Add “{q.trim()}” as a new strain</span></button>}
            {matches.length === 0 && exact && <div style={{ padding: '8px 10px', fontSize: 12.5, color: P.inkMute }}>Already added.</div>}
          </div>
        </>}
      </div>
    </div>
  </Card>;
}

// Terpene profile — add / remove terpenes (qualitative dominance; no percentages)
const TERP_INFO_M = { Myrcene: ['Earthy · musky', '#8A5CD6'], Limonene: ['Citrus · zesty', '#D9A21C'], Caryophyllene: ['Peppery · spicy', '#D2483F'], Pinene: ['Pine · herbal', '#3DA35D'], Linalool: ['Floral · lavender', '#8E7BE0'], Terpinolene: ['Fruity · fresh', '#21A89B'], Humulene: ['Hoppy · woody', '#B5793B'], Ocimene: ['Sweet · herbal', '#4CA1E0'], Bisabolol: ['Chamomile · soft', '#C98BB0'] };
function TerpeneEditor({ initial }) {
  const P = useP();
  const [list, setList] = React.useState(initial || []);
  const [open, setOpen] = React.useState(false);
  const RANKS = ['Dominant', 'Secondary', 'Present'];
  const rankTone = (r) => r === 'Dominant' ? { c: P.accentText, bg: P.accentSoft } : r === 'Secondary' ? { c: P.ink2, bg: P.surface3 } : { c: P.inkMute, bg: P.surface3 };
  const avail = Object.keys(TERP_INFO_M).filter((n) => !list.some((t) => t.name === n));
  const add = (n) => {setList((l) => [...l, { name: n, rank: 'Present', note: TERP_INFO_M[n][0], color: TERP_INFO_M[n][1] }]);setOpen(false);};
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 2, padding: 13, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Terpene profile</span><span style={{ fontSize: 11.5, color: P.inkMute }}>aroma &amp; dominance · we don’t track percentages</span></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((t, i) => {const rt = rankTone(t.rank);return <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flex: '0 0 auto' }} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{t.name}</div><div style={{ fontSize: 11.5, color: P.inkMute }}>{t.note}</div></div>
        <select value={t.rank} onChange={(e) => setList((l) => l.map((x, j) => j === i ? { ...x, rank: e.target.value } : x))} style={{ appearance: 'none', WebkitAppearance: 'none', border: 'none', background: rt.bg, color: rt.c, borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', padding: '3px 8px', cursor: 'pointer', fontFamily: P.fontSans }}>{RANKS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <button onClick={() => setList((l) => l.filter((_, j) => j !== i))} title="Remove terpene" style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute, padding: 3 }}><Icon name="x" size={14} stroke={2.2} /></button>
      </div>;})}
      {list.length === 0 && <span style={{ fontSize: 12.5, color: P.inkMute }}>No terpenes added.</span>}
    </div>
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} disabled={avail.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: avail.length ? 'pointer' : 'not-allowed', color: P.info, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans, opacity: avail.length ? 1 : .5 }}><Icon name="plus" size={14} stroke={2.2} />Add terpene</button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', bottom: 'calc(100% + 5px)', left: 0, width: 240, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, boxShadow: P.shadowLg, zIndex: 41, padding: 5, maxHeight: 240, overflowY: 'auto' }}>
          {avail.map((n) => <button key={n} onClick={() => add(n)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}><span style={{ width: 8, height: 8, borderRadius: 2, background: TERP_INFO_M[n][1], flex: '0 0 auto' }} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{n}</span><span style={{ fontSize: 11.5, color: P.inkMute, marginLeft: 'auto' }}>{TERP_INFO_M[n][0]}</span></button>)}
        </div>
      </>}
    </div>
  </div>;
}

// Editable custom attributes — add / modify / remove product parameters (comment: where's the edit UI)
function CustomAttributes() {
  const P = useP();
  const [rows, setRows] = React.useState([{ k: 'Harvest date', v: 'Apr 2026' }]);
  const [tags, setTags] = React.useState(['Relaxed', 'Sleepy', 'Top shelf']);
  const [tagInput, setTagInput] = React.useState('');
  const set = (i, f, val) => setRows((r) => r.map((x, j) => j === i ? { ...x, [f]: val } : x));
  const inpS = { minWidth: 0, padding: '8px 10px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, background: P.surface, color: P.ink, fontSize: 12.5, outline: 'none', fontFamily: P.fontSans };
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="sliders" size={15} stroke={1.9} /></span>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Custom attributes</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Add, edit or remove your own product parameters — editable here (not shell-managed)</div></div>
    </div>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Tags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {tags.map((t, i) => {const tt = tagTint(t, P);return <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: tt.bg, border: `1px solid ${tt.border}`, borderRadius: 99, fontSize: 12.5, fontWeight: 600, color: tt.fg }}>{t}<button onClick={() => setTags((ts) => ts.filter((_, j) => j !== i))} title="Remove tag" style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: tt.fg, opacity: .7, padding: 0 }}><Icon name="x" size={12} stroke={2.4} /></button></span>;})}
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => {if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {e.preventDefault();setTags((ts) => [...ts, tagInput.trim()]);setTagInput('');}}} placeholder="Add tag…" style={{ flex: '1 0 90px', minWidth: 90, padding: '5px 10px', border: `1px dashed ${P.hairline3}`, borderRadius: 99, background: 'transparent', color: P.ink, fontSize: 12.5, outline: 'none', fontFamily: P.fontSans }} />
        </div>
      </div>
      <div style={{ height: 1, background: P.hairline, margin: '3px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 28px', gap: 9, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}><span>Name</span><span>Value</span><span /></div>
      {rows.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 28px', gap: 9, alignItems: 'center' }}>
        <input value={r.k} onChange={(e) => set(i, 'k', e.target.value)} placeholder="Attribute name" style={inpS} />
        <input value={r.v} onChange={(e) => set(i, 'v', e.target.value)} placeholder="Value" style={inpS} />
        <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title="Remove" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute, padding: 5, display: 'flex' }}><Icon name="trash" size={16} stroke={1.9} /></button>
      </div>)}
      <button onClick={() => setRows((rs) => [...rs, { k: '', v: '' }])} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, cursor: 'pointer', color: P.info, fontSize: 12.5, fontWeight: 600, fontFamily: P.fontSans }}><Icon name="plus" size={15} stroke={2.2} />Add attribute</button>
    </div>
  </Card>;
}

// Weedmaps product match — confidence, fetched WM params + photo, manual mapping
function WmMatchModal({ p, conf, onClose }) {
  const P = useP();const fmt = window.HW.fmt;
  const level = conf >= 0.85 ? { t: 'High confidence', c: P.good } : conf >= 0.6 ? { t: 'Medium confidence', c: P.warn } : conf > 0 ? { t: 'Low confidence — review', c: P.bad } : { t: 'No match found', c: P.inkMute };
  const cands = [
  { title: p.name, brand: p.brand, price: p.price, conf: conf },
  { title: `${p.brand} ${p.cat} ${p.strain || ''}`.trim(), brand: p.brand, price: p.price + 2, conf: Math.max(0.2, conf - 0.18) },
  { title: `${p.name} (1g)`, brand: p.brand, price: Math.max(1, p.price - 3), conf: Math.max(0.15, conf - 0.31) }];
  const [q, setQ] = React.useState('');
  // THE SAME FABRICATED BATCH GENERATOR ran a second time in here — a second
  // copy of `3 + charCodeSum(sku) % 21` lots, rendered as "Potency · per batch"
  // on BOTH sides of the comparison, so an invented range was also presented as
  // Weedmaps' own figure. Per-batch potency comes from real lots or from
  // nowhere; the API serves no potency for a Weedmaps product at all.
  const mLots = (batchRowsOf(p) || []).filter((b) => b.thc != null && b.qty > 0);
  const mThcs = mLots.map((b) => b.thc);
  const potency = mThcs.length ? (Math.min(...mThcs) === Math.max(...mThcs) ? `${mThcs[0]}% THC` : `${Math.min(...mThcs)}–${Math.max(...mThcs)}% THC`) : 'not recorded';
  const [picked, setPicked] = React.useState(conf > 0 ? 0 : null);
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px,96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: P.brand.weedmapsInk, background: P.brand.weedmaps, padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: P.brand.weedmapsInk }} />Weedmaps</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Product match & mapping</span>
        <div style={{ flex: 1 }} />
        <IconBtn icon="x" onClick={onClose} />
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 13.5, fontWeight: 700, color: level.c }}>{level.t}</span>{conf > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{Math.round(conf * 100)}%</span>}<span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkMute }}>auto-matched on name + brand + category</span></div>
          <div style={{ height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden', marginTop: 8 }}><div style={{ width: `${Math.round((conf || 0) * 100)}%`, height: '100%', background: level.c }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 13 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 9 }}>Our product</div>
            <div style={{ display: 'flex', gap: 10 }}><Thumb item={p} size={54} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{p.name}</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{p.sku}</div></div></div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5 }}>{[['Brand', p.brand], ['Category', p.cat], ['Price', fmt.money0(p.price)], ['Potency · per batch', potency]].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: P.inkMute }}>{k}</span><span style={{ color: P.ink, fontWeight: 600 }}>{v}</span></div>)}</div>
          </div>
          <div style={{ border: `1px solid ${picked != null ? P.ink : P.hairline2}`, borderRadius: P.r12, padding: 13, background: picked != null ? P.surface3 : P.surface }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.brand.weedmaps, marginBottom: 9 }}>Weedmaps product</div>
            {picked != null ? <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 54, height: 54, flex: '0 0 auto', borderRadius: 10, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="package" size={20} stroke={1.7} color={P.inkMute} /></div>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{cands[picked].title}</div><div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{p.wm.ext}</div></div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5 }}>{[['Brand', cands[picked].brand], ['Category', p.cat], ['Price on WM', fmt.money0(cands[picked].price)], ['Potency · per batch', 'not served']].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: P.inkMute }}>{k}</span><span style={{ color: P.ink, fontWeight: 600 }}>{v}</span></div>)}</div>
            </> : <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5, padding: '12px 0' }}><b style={{ color: P.ink2 }}>Unmapped — custom Weedmaps product.</b> This SKU shows on Weedmaps as its own standalone (custom) listing, not linked to a shared catalog product. Search below to link it to a Weedmaps product instead.</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Map manually — search the Weedmaps catalog</div>
          <div style={{ marginBottom: 10 }}><Field icon="search" placeholder="Search Weedmaps products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cands.map((c, i) => <button key={i} onClick={() => setPicked(i)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: picked === i ? P.surface3 : P.surface, border: `1px solid ${picked === i ? P.ink : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
              <div style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: 8, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="package" size={15} stroke={1.7} color={P.inkFaint} /></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{c.title}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{c.brand} · {fmt.money0(c.price)}</div></div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: c.conf >= 0.85 ? P.good : c.conf >= 0.6 ? P.warn : P.inkDim, fontFamily: P.fontMono }}>{Math.round(c.conf * 100)}%</span>
              {picked === i ? <Icon name="check-circle" size={17} stroke={2} color={P.good} /> : <span style={{ fontSize: 11.5, fontWeight: 700, color: P.info }}>Map</span>}
            </button>)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderTop: `1px solid ${P.hairline2}`, background: P.surface2 }}>
        <span style={{ fontSize: 11.5, color: P.inkDim, flex: 1 }}>Mapping links our SKU to a shared Weedmaps product via <b style={{ color: P.ink2 }}>external_id</b>. <b style={{ color: P.ink2 }}>Unmapping</b> makes it a custom, Weedmaps-native product with its own listing.</span>
        {picked != null && <PBtn variant="ghost" size="sm" onClick={() => setPicked(null)}>Unmap · use custom product</PBtn>}
        <PBtn variant="accent" size="md" icon="check" onClick={onClose}>Confirm match</PBtn>
      </div>
    </div>
  </div>;
}

Object.assign(window, { ProductDetailPage });