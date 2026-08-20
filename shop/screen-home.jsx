// ── Hyperwolf storefront — HOME (web frame 1912-39178) ─────────────────────
//
//   ● OPEN
//   Good afternoon, Marcus.                  <- name in accent
//   Express delivery in ~90 min. Your usual is ready to reorder.
//   [horizontal carousel of DARK reorder cards]
//   SHOP BY CATEGORIES
const useP = window.useP;

function greeting(now) {
  const h = (now || new Date()).getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// One chip per line of the past order — the frame's [chip][chip][chip][+1].
function LineChips({ lines, max = 3 }) {
  const P = useP();
  const shown = lines.slice(0, max);
  const rest = lines.length - shown.length;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {shown.map((l) => (
        <span key={l.sku} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 5px', borderRadius: P.r999, background: P.railHover, border: `1px solid ${P.railHair}`, color: P.railInk, fontSize: P.type.meta, fontWeight: 600, maxWidth: 168, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {l.qty > 1 && <span style={{ fontFamily: P.fontMono, color: P.accent }}>×{l.qty}</span>}
          {l.product.name}
        </span>))}
      {rest > 0 &&
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px 5px', borderRadius: P.r999, background: P.railHover, border: `1px solid ${P.railHair}`, color: P.railInk, fontSize: P.type.meta, fontWeight: 700, fontFamily: P.fontMono }}>+{rest}</span>}
    </div>);

}

// The dark reorder card. The money on it is the sum of what each line was
// bought at — see the note on `_pastOrder` in shop/data.jsx. Nothing here
// re-prices anything.
function ReorderCard({ order, usual }) {
  const P = useP();
  const S = window.useShop();
  const D = window.SHOPDATA;
  const addAll = () => {
    const n = S.addAll(order);
    S.toast(n > 0 ? `Added ${n} item${n === 1 ? '' : 's'} to your cart` : 'Nothing to add');
  };
  return (
    <div style={{ flex: '0 0 auto', width: 380, maxWidth: '86vw', background: P.rail, borderRadius: P.r12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, scrollSnapAlign: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: P.accent }}>
        <Icon name="refresh" size={13} stroke={2.1} />
        <span style={{ fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', fontFamily: P.fontMono }}>
          Reorder{usual ? ' · Your usual' : ''}
        </span>
      </div>

      <div style={{ fontSize: P.type.h2, fontWeight: 700, color: P.railBright, lineHeight: 1.15 }}>{order.title}</div>

      <div style={{ fontSize: P.type.meta, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: P.railInk, fontFamily: P.fontMono }}>
        Last ordered · {order.daysAgo} days ago · <span style={{ color: P.railBright }}>{S.money(order.totalCents)}</span>
      </div>

      <LineChips lines={order.lines} />

      <div style={{ marginTop: 'auto', paddingTop: 6 }}>
        <PBtn variant="accent" size="md" iconRight="chevron-right" onClick={addAll}>Add all to cart</PBtn>
      </div>
    </div>);

}

function CategoryTile({ cat }) {
  const P = useP();
  const S = window.useShop();
  const D = window.SHOPDATA;
  const tone = P.cat[D.CAT_TOKEN[cat.id] || 'other'];
  const n = D.productsInCategory(cat.id).length;
  return (
    <button onClick={() => { S.setCategory(cat.id); S.go('shop'); }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '12px 16px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', textAlign: 'left', color: P.ink }}>
      <span style={{ width: 36, height: 36, borderRadius: P.r10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.highlightSoft, color: tone, flex: '0 0 auto' }}>
        <Icon name={D.CAT_ICON[cat.id] || 'grid'} size={18} stroke={1.8} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>{cat.label}</span>
        <span style={{ display: 'block', fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{n} item{n === 1 ? '' : 's'}</span>
      </span>
    </button>);

}

window.ShopHomeScreen = function ShopHomeScreen() {
  const P = useP();
  const S = window.useShop();
  const D = window.SHOPDATA;
  const orders = D.pastOrders();
  const eta = D.expressEtaMinutes();
  const cust = D.CUSTOMER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><window.ShopOpenPill /></div>
        <h1 style={{ margin: 0, fontSize: P.type.h1, fontWeight: 700, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>
          {greeting()}, <span style={{ color: P.accentText }}>{cust.first}</span>.
        </h1>
        <div style={{ fontSize: P.type.title, color: P.inkDim, lineHeight: 1.4, maxWidth: 640 }}>
          {eta ? `Express delivery in ~${eta} min. ` : ''}Your usual is ready to reorder.
        </div>
      </section>

      <section>
        <Eyebrow style={{ marginBottom: 12 }}>Reorder</Eyebrow>
        {orders.length === 0 ?
          <EmptyState icon="refresh" title="No past orders yet" body="Your reorder shortcuts appear here after your first delivery." /> :
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 6 }}>
            {orders.map((o, i) => <ReorderCard key={o.id} order={o} usual={i === 0} />)}
          </div>}
      </section>

      <section>
        <SectionHead level={2} title="Shop by categories"
          action={<PBtn variant="ghost" size="sm" iconRight="chevron-right" onClick={() => { S.setCategory('All'); S.go('shop'); }}>All items</PBtn>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {D.categories().map((c) => <CategoryTile key={c.id} cat={c} />)}
        </div>
      </section>
    </div>);

};
