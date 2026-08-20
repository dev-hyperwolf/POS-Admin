// ── App root + router ──────────────────────────────────────────────────────
const useP = window.useP,useTheme = window.useTheme;

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