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

// ── Identity & binding tab registration (pos/screen-identity-binding.jsx) ─
// Same rule as Brands above: MUTATE window.HW_NAV.items IN PLACE. Reassigning
// window.HW_NAV would leave shared/app-rail.jsx and shared/app-switcher.js
// pointing at the old object.
//
// wmdemo/wm_binding.py (GET/POST /api/identity/wm-binding[/unbind]) had zero
// UI anywhere in POS-Admin before this — a support rep fixing "this Weedmaps
// account is bound to the wrong customer" had only a raw API call. Placed
// next to Members, the other customer-identity surface, rather than folded
// into it: pos/screen-stubs.jsx's MembersScreen is still window.HW.MEMBERS
// mock data with no server round-trip, and grafting a live-backed binding
// panel onto it would make one screen half-real, half-fixture.
(function () {
  var NAV = window.HW_NAV;
  if (!NAV || !Array.isArray(NAV.items)) { return; }
  if (NAV.items.some(function (i) { return i.id === 'identity-binding'; })) { return; }
  var at = NAV.items.findIndex(function (i) { return i.id === 'members'; });
  NAV.items.splice(at < 0 ? NAV.items.length : at + 1, 0,
    { id: 'identity-binding', label: 'Identity & binding', icon: 'link', pos: 'identity-binding' });
  NAV.all = NAV.items.concat([NAV.settings]);
})();

/* ── WHERE A FAILURE STOPS ───────────────────────────────────────────────────
 *
 * On 2026-08-27 `cart.map(...)` on an undefined cart — one line, on the render
 * path of pos/screen-register.jsx — took the WHOLE application down. Not the
 * cart pane: the register, the rail, the top bar, the check-in queue. There
 * were no error boundaries anywhere in this estate, so the blast radius of any
 * render error was everything.
 *
 * A boundary ABOVE the router would bound nothing — every screen is still one
 * subtree, and the first throw still costs you all of them. So the boundaries
 * go here, around each of the four things that can fail INDEPENDENTLY: the
 * rail, the top bar, the routed screen, and the cash-drawer control.
 *
 * The screen boundary is KEYED BY ROUTE. Without the key, React keeps the same
 * boundary instance across a navigation, so its error state survives and the
 * user is stranded on a dead frame after moving to a screen that works.
 *
 * ⚠️ THIS CATCHES RENDER AND LIFECYCLE ERRORS ONLY. Not event handlers, not
 * async callbacks, not the plain-JS chrome. The register's actual sale path is
 * mostly onClick handlers and none of it is covered here. See the limits note
 * in shared/error-boundary.jsx before treating any of this as a guarantee.
 */

/* If shared/error-boundary.jsx is ever dropped from Hyperwolf POS.html, a bare
 * <ScreenBoundary> would be an undefined component — which white-screens the
 * whole app, the exact failure this wiring exists to end. Fall back to a
 * pass-through (the status quo, no worse) and SAY SO, rather than dying.
 * Module scope, not inside App(): a component defined during render is a new
 * component type every render, and React remounts the entire subtree. */
if (!window.ScreenBoundary || !window.CriticalBoundary) {
  try { console.error('[HW boundary] Hyperwolf POS.html did not load shared/error-boundary.jsx — '
    + 'the POS is running with NO error boundaries. One render error will take the whole app down.'); }
  catch (e) {}
}
const ScreenFrame = window.ScreenBoundary || function ScreenFrame(p) {return p.children;};
const CriticalFrame = window.CriticalBoundary || function CriticalFrame(p) {return p.children;};

/* The name a boundary prints. "Something went wrong" is the same defect in a
 * friendlier font, so every route gets the words a person on the floor uses.
 * An unlisted route falls back to its id — still named, never anonymous. */
const POS_SCREEN_LABELS = {
  home: 'Home', register: 'The register', orders: 'Orders', catalog: 'Catalog',
  brands: 'Brands', cities: 'Cities', 'category-map': 'The category map',
  'publish-gate': 'The publish gate', members: 'Members',
  'identity-binding': 'Identity & binding', merch: 'Merch',
  settings: 'Settings' };

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
  // Guarded the same way Brands is, and for the same reason: a dropped script
  // tag must name the missing file rather than white-screening the whole app.
  if (route === 'identity-binding') screen = window.IdentityBindingScreen ? <window.IdentityBindingScreen /> :
    <ErrorState title="The Identity &amp; binding screen did not load"
      body="pos/screen-identity-binding.jsx defines window.IdentityBindingScreen and this page did not get it — check that Hyperwolf POS.html still loads that file." />;else
  if (route === 'merch') screen = <window.MerchScreen />;else
  if (route === 'settings') screen = <SettingsScreen />;else
  screen = <RegisterScreen />;

  const fullBleed = route === 'register'; // register manages its own scroll/height

  const screenName = POS_SCREEN_LABELS[route] || ('The ' + route + ' screen');

  return (
    <div style={{ display: 'flex', height: '100vh', background: P.bg, color: P.ink, fontFamily: P.fontSans, overflow: 'hidden' }}>
      {/* CONTAINED. What survives a dead rail is the screen you are already on,
          and nothing about it becomes wrong — you lose the ability to NAVIGATE,
          which is visible the instant you look at where the rail used to be. */}
      <ScreenFrame name="The navigation rail">
        <Rail active={route} onNav={go} />
      </ScreenFrame>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* CONTAINED, same argument as the rail: the store picker and the
            POS/Fulfillment switch stop being available, and their absence is
            what you see. Nothing it reports is money. */}
        <ScreenFrame name="The top bar">
          <TopBar user={USER} mode={mode} onMode={onMode} />
        </ScreenFrame>
        <main style={{ flex: 1, overflowY: fullBleed ? 'hidden' : 'auto', overflowX: 'hidden', padding: fullBleed ? 0 : '26px 30px 56px', zoom: 1.08 }}>
          {/* CONTAINED AT THE SCREEN, which for a money screen IS the refusal.
              Nothing sellable survives inside this frame: when the register
              throws, the whole register is replaced by a named failure and the
              rail beside it still works. A CriticalBoundary placed INSIDE a
              screen (around a cart or a tender pane) escalates to this
              boundary, so a broken money pane takes its whole screen with it
              rather than leaving a usable-looking shell around a hole.

              key={route} so navigating away CLEARS the failure. Without it the
              same boundary instance carries its error state onto the next
              screen and the user is stranded. */}
          <ScreenFrame key={route} name={screenName} onReset={() => go('home')} resetLabel="Go to Home">
            {screen}
          </ScreenFrame>
        </main>
      </div>
      {/* REFUSES. ⚠️ BE HONEST ABOUT HOW MUCH THIS BUYS TODAY — MEASURED, not
          assumed. At the app root there is no ScreenBoundary to escalate to, so
          CriticalFrame paints its own panel and a ScreenFrame here would paint
          a very similar one. The two were compared by breaking this component
          in memory both ways; the visible difference is small.

          It is still the right one, for two reasons that are about the NEXT
          edit rather than this one:
            · nothing inside this subtree can re-contain the failure. A
              ScreenBoundary nested in a CriticalBoundary escalates instead of
              containing, so a well-meaning inner boundary cannot quietly turn
              this back into a card.
            · the moment this control moves inside a screen — or an ancestor
              boundary appears — it takes that whole frame down instead of
              leaving a working-looking POS around a dead cash control.

          🔴 THE REAL QUESTION IS NOT SETTLED HERE. If this throws, POS.getDrawer()
          is broken, which means drawer state is untrustworthy in the REGISTER
          too — and the register would still take a cash sale. Whether a broken
          drawer subsystem must block the cash tender path is a decision for
          whoever owns pos/drawer.jsx and the sale path; it is not ours, and a
          boundary here cannot make it for them. Do not read this wrapper as
          having answered it. */}
      <CriticalFrame name="The cash drawer control" flow="Cash handling">
        <window.CashDrawerOverlay />
      </CriticalFrame>
    </div>);

}

function Root() {
  return <ThemeProvider><App /></ThemeProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);