// ── Hyperwolf storefront — SHOP (web frame 1912-40813) ─────────────────────
//
//   CATEGORY · ALL
//   All items                          BRAND SPOTLIGHT (dark card, top right)
//   [sidebar: SHOP BY CATEGORIES ^]    [rails: Fresh Drops · On Sale · …]
//                                      [product grid, ⚡ EXPRESS per card]
const useP = window.useP;

// Shelf price. This is CATALOGUE data in dollars, formatted by the estate's own
// `HW.fmt` — it is not a cart total. Every cart figure comes from
// `SHOP.totals()`; nothing on this screen adds money up.
function shelfPrice(p) { return window.HW.fmt.money(p.price); }

/* ── THE SPOTLIGHT — WHAT MARKETING PICKED, OR THE HOUSE CARD ────────────────
 *
 * 🔴 THIS SCREEN DERIVES NOTHING. It used to print the deepest markdown in the
 * catalogue, which is how the shop came to advertise "Connected — Up to 97% off"
 * to customers. `SHOPDATA.brandSpotlight()` now reads
 * `HWMerch.live('shop_spotlight', region)`, and when there is no live pick it
 * hands back the HOUSE CARD — never the derivation.
 *
 * CAROUSEL vs WEIGHTED is settled in the data layer: `cards` is already the list
 * this visitor should see (all of them in carousel, exactly one in weighted), so
 * mapping over it honours both modes without this file knowing which is on.
 */
function SpotlightCard({ card, source }) {
  const P = useP();
  const S = window.useShop();
  const merch = source === 'merch';
  // The CTA only exists when the card names a brand the catalogue carries — a
  // "Shop nothing" button is worse than no button.
  const cta = card.brand || null;
  const meta = [card.kicker, card.etaMinutes ? `Ready ~${card.etaMinutes}m` : '']
    .filter(Boolean).join(' · ');
  return (
    <div style={{ background: P.rail, borderRadius: P.r12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
      <div style={{ fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: P.accent, fontFamily: P.fontMono }}>
        {merch ? 'Brand spotlight' : 'Hyperwolf'}
      </div>
      <div style={{ fontSize: P.type.h2, fontWeight: 700, color: P.railBright, lineHeight: 1.15 }}>{card.title}</div>
      {card.offer &&
      <div style={{ fontSize: P.type.strong, fontWeight: 600, color: P.accent }}>{card.offer}</div>}
      {meta &&
      <div style={{ fontSize: P.type.meta, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: P.railInk, fontFamily: P.fontMono }}>{meta}</div>}
      {cta &&
      <div style={{ marginTop: 4 }}>
        <PBtn variant="accent" size="sm" iconRight="chevron-right"
          onClick={() => { S.setQuery(cta); S.setCategory('All'); }}>Shop {cta}</PBtn>
      </div>}
    </div>);

}

function BrandSpotlight() {
  const P = useP();
  const sp = window.SHOPDATA.brandSpotlight();
  if (!sp || !sp.cards || !sp.cards.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {sp.cards.map((c, i) => <SpotlightCard key={(c.brand || c.title || '') + i} card={c} source={sp.source} />)}
      </div>
      {/* ⚠️ SAY THAT THIS IS DEMO STORAGE. HWMerch is per-browser and syncs with
          nothing, so two marketers have two realities. A surface that implied a
          shared source of truth would be lying about where its content came
          from — and the whole point of the seam is that this stays visible until
          the real backing store is chosen. */}
      {sp.demo &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>
        <Icon name="info" size={12} stroke={1.8} />
        Demo merchandising · this browser only
      </div>}
    </div>);

}

function CategorySidebar() {
  const P = useP();
  const S = window.useShop();
  const D = window.SHOPDATA;
  const [open, setOpen] = React.useState(true);
  const cats = D.categories();
  return (
    <aside style={{ width: 236, flex: '0 0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <Eyebrow>Shop by categories</Eyebrow>
        <button aria-label={open ? 'Collapse categories' : 'Expand categories'} onClick={() => setOpen(!open)}
          style={{ width: P.ctrlH.md, height: P.ctrlH.md, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute }}>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} stroke={2} />
        </button>
      </div>
      {open &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cats.map((c) => {
          const on = S.s.category === c.id;
          const tone = P.cat[D.CAT_TOKEN[c.id] || 'other'];
          return (
            <button key={c.id} onClick={() => S.setCategory(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, minHeight: P.ctrlH.md, padding: '0 14px', borderRadius: P.r999, cursor: 'pointer', textAlign: 'left', background: on ? P.ink : 'transparent', color: on ? P.surface : P.ink, border: `1px solid ${on ? P.ink : 'transparent'}`, fontSize: P.type.strong, fontWeight: 600 }}>
              <Icon name={D.CAT_ICON[c.id] || 'grid'} size={16} stroke={1.8} color={on ? P.accent : tone} />
              {c.label}
            </button>);

        })}
      </div>}
    </aside>);

}

/* ── THE FIVE RAILS ─────────────────────────────────────────────────────────
 *
 * 🔴 A RAIL LABEL MAKES A CLAIM, SO THE SCREEN SAYS WHAT THE LIST ACTUALLY IS.
 * "Best Sellers" claims sales data and "New Arrivals" claims stocking dates. The
 * catalogue carries neither `unitsSold` nor `firstSeenAt`, so an auto rail would
 * have to invent a ranking — the same failure as the 97% card, wearing a
 * different label. `SHOPDATA.railBasis()` reports where the list came from
 * (a merchandiser's pick / a real markdown / an editorial list) and the note is
 * shown under the chips for whichever rail is selected.
 */
function RailBasisNote({ railId }) {
  const P = useP();
  const b = window.SHOPDATA.railBasis(railId);
  if (!b || !b.note) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: P.type.meta, color: P.inkMute }}>
      <Icon name={b.source === 'merch' ? 'megaphone' : 'info'} size={13} stroke={1.8} />
      <span>{b.note}{b.source === 'merch' && b.by && b.by.who ? ` · ${b.by.who}` : ''}</span>
    </div>);

}

function Rails() {
  const P = useP();
  const S = window.useShop();
  const D = window.SHOPDATA;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {D.RAILS.map((r) => {
        const on = S.s.rail === r.id;
        const tone = P.cat[r.token] || P.cat.other;
        return (
          <button key={r.id} onClick={() => S.setRail(r.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: P.ctrlH.md, padding: '0 16px', borderRadius: P.r999, cursor: 'pointer', background: on ? P.ink : P.surface, color: on ? P.surface : P.ink, border: `1px solid ${on ? P.ink : P.hairline2}`, fontSize: P.type.strong, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: P.r999, background: tone, flex: '0 0 auto' }} />
            {r.label}
          </button>);

      })}
    </div>);

}

function ProductCard({ p }) {
  const P = useP();
  const S = window.useShop();
  const lane = window.SHOPDATA.defaultLaneFor(p.sku);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
        <window.ShopExpressBadge sku={p.sku} />
      </div>
      <Thumb item={p} size={72} radius={P.r10} />
      <div style={{ minWidth: 0 }}>
        <Eyebrow style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand}</Eyebrow>
        <div style={{ fontSize: P.type.strong, fontWeight: 600, color: P.ink, lineHeight: 1.3, marginTop: 3 }}>{p.name}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <StrainPill type={p.strain} thc={p.thc} />
        {p.wt && <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{p.wt}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: P.type.numRow, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{shelfPrice(p)}</span>
          {p.was != null &&
          <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono, textDecoration: 'line-through' }}>{window.HW.fmt.money(p.was)}</span>}
        </div>
        <PBtn variant="secondary" size="sm" icon="plus"
          onClick={() => { S.add(p.sku, 1); S.toast(`${p.name} added · ${lane === 'express' ? 'Express' : 'Scheduled'}`); }}>Add</PBtn>
      </div>
    </div>);

}

window.ShopShopScreen = function ShopShopScreen() {
  const P = useP();
  const S = window.useShop();
  const D = window.SHOPDATA;

  const cat = S.s.category || 'All';
  const railId = S.s.rail;
  const q = (S.s.query || '').trim().toLowerCase();

  // Filters compose: category, then rail membership, then search.
  let list = D.productsInCategory(cat);
  if (railId) {
    const inRail = new Set(D.railProducts(railId).map((p) => p.sku));
    list = list.filter((p) => inRail.has(p.sku));
  }
  if (q) {
    list = list.filter((p) =>
      (p.name + ' ' + p.brand + ' ' + (p.strain || '') + ' ' + p.cat).toLowerCase().includes(q));
  }

  const railLabel = railId ? (D.RAILS.find((r) => r.id === railId) || {}).label : null;
  const title = railLabel || (cat === 'All' ? 'All items' : cat);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <Eyebrow>Category · {cat}</Eyebrow>
          <h1 style={{ margin: '8px 0 0', fontSize: P.type.h1, fontWeight: 700, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>{title}</h1>
        </div>
        <BrandSpotlight />
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <CategorySidebar />
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Rails />
          {railId && <RailBasisNote railId={railId} />}
          {list.length === 0 ?
            <EmptyState icon="search" title="Nothing here yet"
              body="No products match this category, rail and search together."
              action={<PBtn variant="secondary" size="sm" onClick={() => { S.setCategory('All'); S.setQuery(''); }}>Clear filters</PBtn>} /> :
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(226px, 1fr))', gap: 14 }}>
              {list.map((p) => <ProductCard key={p.sku} p={p} />)}
            </div>}
        </div>
      </div>
    </div>);

};
