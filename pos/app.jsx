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
  if (route === 'members') screen = <MembersScreen />;else
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