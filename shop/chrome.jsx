// ── Hyperwolf storefront — chrome: header, OPEN pill, shell ────────────────
//
// Header read off the web home frame (node 1912-39178):
//   [hamburger] HYPERWOLF | [pin] DELIVER TO / Long Beach · 90804 [>] | [search]
//
// The storefront does NOT render `window.HWRail`. The rail is the operator nav
// for admin surfaces; `Customer Account.html` — the other customer-facing
// surface in this repo — does not render it either, for the same reason.
const useP = window.useP;

// ● OPEN — the status pill above the greeting.
window.ShopOpenPill = function ShopOpenPill({ now }) {
  const P = useP();
  const st = window.SHOPDATA.openState(now);
  return <Pill kind={st.open ? 'good' : 'neutral'} dot>{st.label}</Pill>;
};

// ⚡ EXPRESS — the per-product badge on every shop grid card.
// Renders NOTHING when the product is not express-eligible: the badge is a
// claim about today's van, and an unconditional badge is a claim that is
// sometimes false.
window.ShopExpressBadge = function ShopExpressBadge({ sku, style }) {
  const P = useP();
  if (!window.SHOPDATA.isExpress(sku)) return null;
  return <Pill kind="accent" icon="zap" size="sm" style={style}>EXPRESS</Pill>;
};

// The deliver-to block. Reads the customer's zone, not a literal.
window.ShopDeliverTo = function ShopDeliverTo({ onClick }) {
  const P = useP();
  const z = window.SHOPDATA.CUSTOMER.zone;
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: P.ctrlH.md, padding: '0 12px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, cursor: 'pointer', textAlign: 'left', color: P.ink }}>
      <Icon name="map-pin" size={16} stroke={1.8} color={P.inkMute} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: P.type.micro, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, lineHeight: 1.2 }}>Deliver to</span>
        <span style={{ display: 'block', fontSize: P.type.body, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap' }}>{z.city} · {z.zip}</span>
      </span>
      <Icon name="chevron-right" size={15} stroke={2} color={P.inkMute} />
    </button>);

};

// Header cart button.
// ⚠️ EXTRAPOLATED. The web header frame shows only hamburger / wordmark /
// deliver-to / search. The MOBILE frame carries a tab bar with `Cart (5)`, so
// the counted cart entry point is the design's, and this is it in the web
// header's idiom. Listed as a design gap rather than passed off as read.
function CartButton() {
  const P = useP();
  const S = window.useShop();
  const n = S.itemCount();
  return (
    <button aria-label="Cart" onClick={() => S.go('cart')} style={{ position: 'relative', width: P.ctrlH.md, height: P.ctrlH.md, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, cursor: 'pointer', color: P.ink }}>
      <Icon name="cart" size={18} stroke={1.8} />
      {n > 0 && <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', background: P.accent, color: P.accentInk, borderRadius: P.r999, fontSize: P.type.micro, fontWeight: 700, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>}
    </button>);

}

window.ShopHeader = function ShopHeader() {
  const P = useP();
  const S = window.useShop();
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: P.bg, borderBottom: `1px solid ${P.hairline}` }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button aria-label="Menu" onClick={() => S.toggleMenu()} style={{ width: P.ctrlH.md, height: P.ctrlH.md, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink }}>
          <Icon name="menu" size={20} stroke={1.9} />
        </button>
        <button onClick={() => S.go('home')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minHeight: P.ctrlH.md, color: P.ink }}>
          <Icon name="logo-w" size={22} color={P.accent} />
          <span style={{ fontSize: P.type.title, fontWeight: 800, letterSpacing: '.10em', color: P.ink }}>HYPERWOLF</span>
        </button>
        <window.ShopDeliverTo onClick={() => S.go('checkout')} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <Field icon="search" placeholder="Search strains, brands, effects..." value={S.s.query}
            onChange={(e) => S.setQuery(e.target.value)} />
        </div>
        <CartButton />
      </div>
      {S.s.menuOpen && <ShopMenu />}
    </header>);

};

// The hamburger's menu.
// ⚠️ The frame shows the hamburger but not what it opens. These are the
// storefront's four known destinations, in the existing pill idiom — the
// minimum needed to make the shell navigable. Design gap, listed as one.
function ShopMenu() {
  const P = useP();
  const S = window.useShop();
  const items = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'shop', label: 'Shop', icon: 'shop' },
    { id: 'cart', label: 'Cart', icon: 'cart' },
    { id: 'checkout', label: 'Checkout', icon: 'card' },
  ];
  return (
    <nav style={{ borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '10px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map((it) => {
          const on = S.s.tab === it.id;
          return (
            <button key={it.id} onClick={() => S.go(it.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: P.ctrlH.md, padding: '0 16px', borderRadius: P.r999, cursor: 'pointer', background: on ? P.ink : 'transparent', color: on ? P.surface : P.ink, border: `1px solid ${on ? P.ink : P.hairline2}`, fontSize: P.type.strong, fontWeight: 600 }}>
              <Icon name={it.icon} size={15} stroke={1.8} />{it.label}
            </button>);

        })}
      </div>
    </nav>);

}

// A screen that has not loaded says so. A blank column would read as "the shop
// is empty", which is a different and much more alarming statement.
function MissingScreen({ tab }) {
  const g = window.SHOPDATA.SCREEN_GLOBAL[tab] || tab;
  return <EmptyState icon="layout-template" title="This screen isn’t loaded"
    body={`Hyperwolf Shop.html expects window.${g} from shop/screen-${tab}.jsx.`} />;
}

window.ShopShell = function ShopShell() {
  const P = useP();
  const S = window.useShop();
  const Screen = window.SHOPDATA.screenFor(S.s.tab);
  React.useEffect(() => {
    if (!S.s.toast) return undefined;
    const t = setTimeout(() => window.SHOP.clearToast(), 2600);
    return () => clearTimeout(t);
  }, [S.s.toast]);
  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.ink, fontFamily: P.fontSans }}>
      <window.ShopHeader />
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 64px' }}>
        {Screen ? <Screen /> : <MissingScreen tab={S.s.tab} />}
      </main>
      {S.s.toast &&
      <div role="status" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 60, background: P.ink, color: P.surface, borderRadius: P.r999, padding: '11px 20px', fontSize: P.type.strong, fontWeight: 600, boxShadow: P.shadowLg }}>{S.s.toast}</div>}
    </div>);

};

window.ShopApp = function ShopApp() {
  return <ThemeProvider><window.ShopShell /></ThemeProvider>;
};
