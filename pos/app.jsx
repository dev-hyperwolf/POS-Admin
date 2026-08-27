// ── App root + router ──────────────────────────────────────────────────────
const useP = window.useP,useTheme = window.useTheme;

// ── Brands tab registration (pos/screen-brands.jsx) ────────────────────────
// The rail renders window.HW_NAV.items, so a POS-only screen registers itself
// by MUTATING that array IN PLACE — the same rule window.HW lives under.
// Reassigning window.HW_NAV would leave shared/app-rail.jsx and
// shared/app-switcher.js pointing at the old object. Done here rather than in
// shared/app-nav.js on purpose: Brands is a POS route, and only this page
// carries the screen that answers it.
(function () {
  var NAV = window.HW_NAV;
  if (!NAV || !Array.isArray(NAV.items)) { return; }
  if (NAV.items.some(function (i) { return i.id === 'brands'; })) { return; }
  var at = NAV.items.findIndex(function (i) { return i.id === 'catalog'; });
  NAV.items.splice(at < 0 ? NAV.items.length : at + 1, 0,
    { id: 'brands', label: 'Brands', icon: 'database', pos: 'brands' });
  NAV.all = NAV.items.concat([NAV.settings]);
})();

// ── Cities tab registration (pos/screen-city-listing.jsx) ────────────────
// Same rule as Brands directly above: MUTATE window.HW_NAV.items IN PLACE.
// Reassigning window.HW_NAV would leave shared/app-rail.jsx and
// shared/app-switcher.js pointing at the old object.
(function () {
  var NAV = window.HW_NAV;
  if (!NAV || !Array.isArray(NAV.items)) { return; }
  if (NAV.items.some(function (i) { return i.id === 'cities'; })) { return; }
  var at = NAV.items.findIndex(function (i) { return i.id === 'brands'; });
  NAV.items.splice(at < 0 ? NAV.items.length : at + 1, 0,
    { id: 'cities', label: 'Cities', icon: 'map-pin', pos: 'cities' });
  NAV.all = NAV.items.concat([NAV.settings]);
})();

// ── Category map tab registration (pos/screen-category-map.jsx) ───────────
// Same rule as Brands below: MUTATE window.HW_NAV.items IN PLACE. Reassigning
// window.HW_NAV would leave shared/app-rail.jsx and shared/app-switcher.js
// pointing at the old object.
//
// A FIRST-CLASS RAIL ITEM, deliberately. The sub-category board
// (pos/screen-categories.jsx) is reachable only through Catalog -> a secondary
// "Categories" button, two levels down, and the owner's report was literally "I
// dont see where I can visualize or map the categories". A screen nobody can
// find is the same defect as a screen that was never built.
(function () {
  var NAV = window.HW_NAV;
  if (!NAV || !Array.isArray(NAV.items)) { return; }
  if (NAV.items.some(function (i) { return i.id === 'category-map'; })) { return; }
  var at = NAV.items.findIndex(function (i) { return i.id === 'brands'; });
  NAV.items.splice(at < 0 ? NAV.items.length : at + 1, 0,
    { id: 'category-map', label: 'Category map', icon: 'grid', pos: 'category-map' });
  NAV.all = NAV.items.concat([NAV.settings]);
})();

// ── Publish gate tab registration (pos/screen-publish-gate.jsx) ───────────
// Same rule as Brands directly above: MUTATE window.HW_NAV.items IN PLACE.
// Reassigning window.HW_NAV would leave shared/app-rail.jsx and
// shared/app-switcher.js pointing at the old object.
(function () {
  var NAV = window.HW_NAV;
  if (!NAV || !Array.isArray(NAV.items)) { return; }
  if (NAV.items.some(function (i) { return i.id === 'publish-gate'; })) { return; }
  var at = NAV.items.findIndex(function (i) { return i.id === 'brands'; });
  NAV.items.splice(at < 0 ? NAV.items.length : at + 1, 0,
    { id: 'publish-gate', label: 'Publish gate', icon: 'shield', pos: 'publish-gate' });
  NAV.all = NAV.items.concat([NAV.settings]);
})();

const USER = { name: 'Manisha Saini', role: 'Floor Manager' };

function App() {
  const P = useP();
  const [route, setRoute] = React.useState(() => {try {return localStorage.getItem('hw-pos-route') || 'home';} catch {return 'home';}});

  React.useEffect(() => {try {localStorage.setItem('hw-pos-route', route);} catch {}}, [route]);

  const go = (r) => setRoute(r);
  // POS / Fulfillment switch mirrors the route: Fulfillment → Orders (pickup queue)
  const mode = route === 'orders' ? 'fulfillment' : 'pos';
  const onMode = (m) => go(m === 'fulfillment' ? 'orders' : 'register');

  let screen;
  if (route === 'home') screen = <HomeScreen onNav={go} />;else
  if (route === 'register') screen = <RegisterScreen />;else
  if (route === 'orders') screen = <OrdersScreen onStartSale={() => go('register')} />;else
  if (route === 'catalog') screen = <CatalogScreen />;else
  // Guarded rather than bare: if the script tag for pos/screen-brands.jsx is
  // ever dropped from the page, a bare <window.BrandsScreen/> takes the WHOLE
  // app down with a white screen and no clue why. Name the missing file.
  if (route === 'brands') screen = window.BrandsScreen ? <window.BrandsScreen /> :
    <ErrorState title="The Brands screen did not load"
      body="pos/screen-brands.jsx defines window.BrandsScreen and this page did not get it — check that Hyperwolf POS.html still loads that file." />;else
  // Guarded the same way Brands is, and for the same reason: a dropped script
  // tag must name the missing file rather than white-screening the whole app.
  if (route === 'category-map') screen = window.CategoryMapScreen ? <window.CategoryMapScreen /> :
    <ErrorState title="The Category map screen did not load"
      body="pos/screen-category-map.jsx defines window.CategoryMapScreen and this page did not get it — check that Hyperwolf POS.html still loads that file." />;else
  // Guarded the same way Brands is, and for the same reason: a dropped script
  // tag must name the missing file rather than white-screening the whole app.
  if (route === 'publish-gate') screen = window.PublishGateScreen ? <window.PublishGateScreen /> :
    <ErrorState title="The Publish gate screen did not load"
      body="pos/screen-publish-gate.jsx defines window.PublishGateScreen and this page did not get it — check that Hyperwolf POS.html still loads that file." />;else
  // Guarded the same way, and for the same reason: a dropped script tag must
  // name the missing file rather than white-screening the whole app.
  if (route === 'cities') screen = window.CityListingScreen ? <window.CityListingScreen /> :
    <ErrorState title="The Cities screen did not load"
      body="pos/screen-city-listing.jsx defines window.CityListingScreen and this page did not get it — check that Hyperwolf POS.html still loads that file." />;else
  if (route === 'members') screen = <MembersScreen />;else
  if (route === 'merch') screen = <window.MerchScreen />;else
  if (route === 'settings') screen = <SettingsScreen />;else
  screen = <RegisterScreen />;

  const fullBleed = route === 'register'; // register manages its own scroll/height

  return (
    <div style={{ display: 'flex', height: '100vh', background: P.bg, color: P.ink, fontFamily: P.fontSans, overflow: 'hidden' }}>
      <Rail active={route} onNav={go} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar user={USER} mode={mode} onMode={onMode} />
        <main style={{ flex: 1, overflowY: fullBleed ? 'hidden' : 'auto', overflowX: 'hidden', padding: fullBleed ? 0 : '26px 30px 56px', zoom: 1.08 }}>
          {screen}
        </main>
      </div>
      <window.CashDrawerOverlay />
    </div>);

}

function Root() {
  return <ThemeProvider><App /></ThemeProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);