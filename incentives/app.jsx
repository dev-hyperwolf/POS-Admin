// ── Bounty shell — HW rail · two seats · hash router ────────────────────────
// Design: explorations/Incentives - Concept D - Two Seats.html ("Why" +
// "Standings" tabs). Plan: docs/INCENTIVES-PLAN-2026-09-07.md §0, §4, §5, §6.
// Skeleton copied from engage/app.jsx — same HWRail, same hash router shape,
// same ROUTES()-resolved-at-render trick, same guarded-missing-screen fallback.
//
// CONCEPT D, IN ONE SENTENCE. A budtender and a floor manager want opposite
// things from the same ledger, so this shell gives them deliberately different
// frames rather than one screen with sections hidden:
//   SeatFrame     a single ≤420px column (register-adjacent sizing, ctrlH
//                 lg/xl touch targets) — the budtender's whole app.
//   ConsoleFrame  a left "Needs you" inbox + a right tabbed workspace — the
//                 manager's whole app, with a Seg toggle to preview the seat.
// Which one mounts is decided ONCE, from HWInc.session().role, in App() below.
// This file owns ONLY the frame: which shell, which route is active, which
// screen global fills it, and what renders when that global is missing. It
// renders zero bounty content of its own — no screen files exist yet, so
// every route today shows the guarded "did not load" ErrorState, which is
// the correct state for a shell with no feature screens (see the task that
// produced this file: screens are explicitly out of scope).
//
// PREVIEW, NOT A SECOND SESSION. "Preview as budtender" is local React state,
// never persisted and never a role change — HWInc.session() still reports the
// manager underneath. The seat renders for real (real layout, real copy) with
// its whole body under pointer-events:none, because a preview a manager can
// accidentally click through is a manager who thinks they took a budtender
// action they did not, on a screen that will eventually carry real writes.
;(function () {
  const useP = window.useP;

  // LAST-RESORT LABELS ONLY. The store list is now served —
  // GET /api/incentives/stores, backed by the `inc_stores` registry, which
  // grows by itself when a store is added to the POS system. This map is what
  // renders in the half-second before that request lands (and if it never
  // does); anything that must be CURRENT reads `useStores()` below, never this.
  // Same five names as pos/screen-aov.jsx's AOV_STORE_NAMES — kept as its own
  // copy rather than a shared import because there is no module system here
  // (see the estate's global-collision rule).
  const STORE_NAMES = { elsinore: 'Lake Elsinore', 'west-la': 'West Hollywood', 'long-beach': 'Long Beach', corona: 'Corona', riverside: 'Riverside' };
  const storeName = (id) => STORE_NAMES[id] || id || 'Store';

  // ── the store list, and which store this session is looking at ──────────
  // WHY THE APP OWNS THIS AND NOT EACH SCREEN. Seven screens take a store_id.
  // If each read it from `session.storeId` (which they did until now) then a
  // manager could only ever see their own store — the owner's report: "I can
  // only see the Lake Elsinore store data". A manager is responsible for more
  // than one store, so the store being VIEWED is app state, and every screen
  // receives it as `props.store` instead of deriving it.
  //
  // `session.storeId` does NOT change. It is still who this person is and
  // where they work: /me is called with it (their own day, their own rank,
  // their own bounties), and a budtender has no switcher at all.
  const STORE_KEY = 'hw-bounty-store';
  const ALL_STORES = { id: 'all', name: 'All stores' };

  function readStored() {
    // localStorage throws outright in some embedded contexts, so every read
    // and write here is guarded — a switcher that cannot remember is a minor
    // annoyance; one that white-screens the app is not.
    try { return localStorage.getItem(STORE_KEY) || ''; } catch (e) { return ''; }
  }
  function writeStored(id) {
    try { if (id) localStorage.setItem(STORE_KEY, id); else localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  function useStores(enabled) {
    const [state, setState] = React.useState({ loading: true, error: null, stores: [] });
    const load = React.useCallback(() => {
      if (!enabled) { setState({ loading: false, error: null, stores: [] }); return; }
      window.HWInc.get('/api/incentives/stores').then((r) => {
        if (r.ok && r.body && Array.isArray(r.body.stores)) setState({ loading: false, error: null, stores: r.body.stores });
        else setState({ loading: false, error: r.error || ('HTTP ' + r.code), stores: [] });
      });
    }, [enabled]);
    React.useEffect(() => { load(); }, [load]);
    return { loading: state.loading, error: state.error, stores: state.stores, refresh: load };
  }

  // A plain <select>, styled to the estate's field tokens. Deliberately native:
  // the store list is unbounded (that is the entire point of the registry), so
  // a Seg — which lays every option out side by side — stops working at the
  // sixth store, and a hand-rolled popover would be one more thing to get
  // keyboard support wrong on.
  function StoreSwitcher({ stores, value, onChange, includeAll }) {
    const P = useP();
    const opts = (includeAll ? [ALL_STORES] : []).concat(stores.map((s) => ({ id: s.id, name: s.name })));
    // The current value always appears, even if the list has not landed yet or
    // the store was retired — a <select> whose value is absent from its options
    // renders BLANK, which would read as "no store" rather than "still loading".
    if (value && !opts.some((o) => o.id === value)) opts.unshift({ id: value, name: storeName(value) });
    return (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px 0 10px',
        background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8, cursor: 'pointer' }}>
        <Icon name="map-pin" size={13} stroke={1.9} color={P.inkMute} />
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Store being viewed"
          style={{ border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: 12,
            fontWeight: 600, fontFamily: P.fontSans, cursor: 'pointer', maxWidth: 190 }}>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>);
  }

  // ── routes ──────────────────────────────────────────────────────────────
  // Exactly the ten routes specified for this shell. Resolved at RENDER time
  // (a function, not a constant) so a screen file loaded after this one still
  // resolves — same reason engage/app.jsx's ROUTES() is a function.
  const ROUTES = () => ([
    ['/', window.IncScreenStandings],
    ['/contests/new', window.IncScreenContestBuilder],
    ['/contests', window.IncScreenContests],
    ['/earnings', window.IncScreenEarnings],
    ['/learn/new', window.IncScreenLearnAuthor],
    ['/learn', window.IncScreenLearn],
    ['/data', window.IncScreenData],
    ['/goals', window.IncScreenGoals],
    ['/settings', window.IncScreenSettings],
  ]);

  // path -> [expected file, expected global], for the "did not load" copy
  // only — copies pos/app.jsx's convention verbatim: a dropped script tag (or,
  // today, a screen not yet written) must say which file it needed, never
  // white-screen and never say "Something went wrong".
  const SCREEN_SOURCE = {
    '/': ['incentives/screen-standings.jsx', 'window.IncScreenStandings'],
    '/contests': ['incentives/screen-contests.jsx', 'window.IncScreenContests'],
    '/contests/new': ['incentives/screen-contest-builder.jsx', 'window.IncScreenContestBuilder'],
    '/earnings': ['incentives/screen-earnings.jsx', 'window.IncScreenEarnings'],
    '/learn': ['incentives/screen-learn.jsx', 'window.IncScreenLearn'],
    '/learn/new': ['incentives/screen-learn-author.jsx', 'window.IncScreenLearnAuthor'],
    '/data': ['incentives/screen-data.jsx', 'window.IncScreenData'],
    '/goals': ['incentives/screen-goals.jsx', 'window.IncScreenGoals'],
    '/settings': ['incentives/screen-settings.jsx', 'window.IncScreenSettings'],
  };
  const CONTEST_DETAIL_SOURCE = ['incentives/screen-contest-detail.jsx', 'window.IncScreenContestDetail'];
  function sourceFor(path) {
    if (/^\/contests\/[^/]+\/edit$/.test(path)) return SCREEN_SOURCE['/contests/new'];
    if (path.startsWith('/contests/') && path !== '/contests/new') return CONTEST_DETAIL_SOURCE;
    return SCREEN_SOURCE[path] || ['incentives/screen' + path.replace(/\//g, '-') + '.jsx', 'that screen'];
  }

  const ROUTE_LABEL = {
    '/': 'Standings', '/contests': 'Bounties', '/contests/new': 'New bounty',
    '/earnings': 'Earnings', '/learn': 'Learn', '/learn/new': 'New Snap',
    '/data': 'Data', '/goals': 'Goals', '/settings': 'Settings',
  };
  // Never "Something went wrong": an unlisted path is named from itself.
  function bountyLabel(path) {
    if (ROUTE_LABEL[path]) return ROUTE_LABEL[path];
    if (path.startsWith('/contests/')) return 'Bounty · ' + path.replace('/contests/', '');
    return path.replace(/^\//, '').replace(/\//g, ' · ') || 'Bounty';
  }

  /* ── WHERE A FAILURE STOPS ─────────────────────────────────────────────────
   * Same placement rule as engage/app.jsx and pos/app.jsx: the boundary sits
   * at each independently-failing REGION (rail, top bar, the routed frame),
   * never around a panel inside one of those. The routed frame is keyed by
   * path so a failure clears the moment the operator navigates away instead
   * of following them to the next screen. Bounty carries no money surface of
   * its own (payout EXECUTION is explicitly out of scope, plan §0) so nothing
   * here needs a CriticalBoundary — every region here is safe to CONTAIN. */
  if (!window.ScreenBoundary || !window.CriticalBoundary) {
    try {
      console.error('[HW boundary] Hyperwolf Bounty.html did not load shared/error-boundary.jsx — '
        + 'Bounty is running with NO error boundaries.');
    } catch (e) {}
  }
  const BFrame = window.ScreenBoundary || function BFrame(p) { return p.children; };

  // ── chrome shared by both seats ─────────────────────────────────────────
  function Topbar({ stores, storeId, onStoreChange, canSwitch }) {
    const P = useP();
    const { mode, toggle } = window.useTheme();
    const session = window.HWInc.session();
    return (
      <header style={{ height: 56, flex: '0 0 56px', borderBottom: `1px solid ${P.hairline2}`, background: P.bg,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: P.r8, background: P.accent, color: P.accentInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name="trophy" size={15} stroke={2} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>Bounty</span>
        <div style={{ flex: 1 }} />
        {/* A budtender gets the pill they always had — one store, stated, not
            offered. A manager gets the switcher, because "which store am I
            looking at" is a question only they can have. */}
        {canSwitch
          ? <StoreSwitcher stores={stores} value={storeId} onChange={onStoreChange} includeAll />
          : <Pill kind="neutral" size="sm">{storeName(session.storeId)}</Pill>}
        <IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} size={16} onClick={toggle} title="Toggle theme" style={{ width: 34, height: 34 }} />
        <Avatar name={session.name} size={30} />
      </header>);
  }

  // ── the budtender seat ──────────────────────────────────────────────────
  // One column, ≤420px, centered in whatever width the shell gives it — the
  // same panel width this would dock at beside the register. `previewLocked`
  // is true only when a manager is previewing: the whole body goes
  // pointer-events:none so every action in it is structurally disabled, not
  // just visually dimmed.
  function SeatFrame({ screenSlot, previewLocked, previewBand, meError, meLoading, meRefresh }) {
    const P = useP();
    const session = window.HWInc.session();
    return (
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 16px 40px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {previewBand}
          <div style={{ pointerEvents: previewLocked ? 'none' : 'auto', opacity: previewLocked ? .82 : 1,
            display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: P.r12,
              background: P.rail, color: P.railBright }}>
              <Avatar name={session.name} size={30} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>Bounty · My day</div>
              <div style={{ fontSize: 10, fontFamily: P.fontMono, color: P.railInk }}>{storeName(session.storeId)}</div>
            </div>
            {meError && <window.IncShared.NotConnected compact onRetry={meRefresh} />}
            {!meError && meLoading && <SkeletonRows rows={2} avatar={false} />}
            {screenSlot}
          </div>
        </div>
      </div>);
  }

  // ── the manager console ─────────────────────────────────────────────────
  // Left: a fixed 300px "Needs you" inbox. Right: a tabbed workspace holding
  // the routed screen. The Seg switch (Manager / Preview as budtender) lives
  // in the console's own top strip, never in the shared Topbar — a budtender
  // never sees it, and per Concept D's own note, a control they cannot use is
  // one that teaches them the product is not for them.
  const TABS = [
    { value: '/', label: 'Standings' },
    { value: '/contests', label: 'Bounties' },
    { value: '/earnings', label: 'Earnings' },
    { value: '/learn', label: 'Learn' },
    { value: '/data', label: 'Data' },
    { value: '/goals', label: 'Goals' },
    { value: '/settings', label: 'Settings' },
  ];
  function ConsoleFrame({ navigate, path, screenSlot, isManager, previewing, onTogglePreview, meError, meLoading, meRefresh }) {
    const P = useP();
    const session = window.HWInc.session();
    const activeTab = TABS.find((t) => path === t.value || (t.value !== '/' && path.startsWith(t.value + '/')));
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: P.surface,
          borderBottom: `1px solid ${P.hairline2}`, flexWrap: 'wrap' }}>
          <Avatar name={session.name} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{session.name}</div>
            <div style={{ fontSize: 10.5, fontFamily: P.fontMono, color: P.inkDim }}>{session.role} · {storeName(session.storeId)}</div>
          </div>
          <div style={{ flex: 1 }} />
          {isManager && (
            <Seg value={previewing ? 'preview' : 'manager'} onChange={(v) => onTogglePreview(v === 'preview')}
              options={[{ value: 'manager', label: 'Manager', icon: 'shield' }, { value: 'preview', label: 'Preview as budtender', icon: 'eye' }]} />
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)' }}>
          {/* Grid items default to min-height:auto (same rule as flex items), so
              without an explicit minHeight:0 each column grows to its content's
              height instead of the stretched row height — the descendant's
              overflowY:auto never gets a box small enough to need to scroll. */}
          <div style={{ minHeight: 0, background: P.surface2, borderRight: `1px solid ${P.hairline2}`, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${P.hairline2}` }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: P.ink }}>Needs you</span>
              <Icon name="inbox" size={15} stroke={1.8} color={P.inkMute} />
            </div>
            {meError ? (
              <div style={{ padding: 8 }}><window.IncShared.NotConnected compact onRetry={meRefresh} /></div>
            ) : meLoading ? (
              <div style={{ padding: 14 }}><SkeletonRows rows={3} avatar /></div>
            ) : (
              <EmptyState compact icon="check-circle" title="Nothing needs you right now"
                body="Pending approvals, unresolved identities, source errors and settlements due will show up here." />
            )}
          </div>
          <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 16px', background: P.surface, borderBottom: `1px solid ${P.hairline2}` }}>
              <Tabs value={activeTab ? activeTab.value : path} onChange={(v) => navigate('#' + v)} options={TABS} />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
              {screenSlot}
            </div>
          </div>
        </div>
      </div>);
  }

  function App() {
    const P = useP();
    const [route, setRoute] = React.useState(() => location.hash || '#/');
    const [previewing, setPreviewing] = React.useState(false); // preview toggle: React state only, never persisted

    React.useEffect(() => {
      const h = () => setRoute(location.hash || '#/');
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/';
      return () => removeEventListener('hashchange', h);
    }, []);

    const navigate = React.useCallback((href) => { location.hash = href; }, []);
    const path = route.replace(/^#/, '').split('?')[0] || '/';
    const query = route.includes('?') ? new URLSearchParams(route.split('?')[1]) : new URLSearchParams();

    // One app-wide poll, not per-route: /api/incentives/me is "the one call
    // for the Home card and the app's landing view" (plan §4) — rank, active
    // bounties, balance, unread Snaps, source freshness. No route in this
    // shell consumes its payload yet (no screens are built), but both seats
    // use its ok/error state right here to prove the honesty pattern end to
    // end: the backend has no /api/incentives/* routes today, so this 404s,
    // and NotConnected is what a person on either seat actually sees.
    // /me is per person: the route refuses a call without both ids (400) rather
    // than guessing whose day to show, so the ids come from the one session
    // accessor the production port swaps.
    const sessionIds = window.HWInc.session();
    const me = window.HWInc.usePoll(
      '/api/incentives/me?store_id=' + encodeURIComponent(sessionIds.storeId || '') +
      '&associate_id=' + encodeURIComponent(sessionIds.id || ''), { intervalMs: 20000 });

    // Screens get the session, the role verdict, the preview flag and the
    // /me poll as props so no screen re-derives role from a string or opens a
    // second /me poll. `previewing` lets a screen render its budtender
    // version for a manager who asked to see it.
    const session = window.HWInc.session();
    const isManager = session.role === 'Floor Manager' || session.role === 'Admin';

    // THE STORE BEING VIEWED. Managers only: `canSwitch` gates the control AND
    // the resolution below, so a budtender's `props.store` is their home store
    // no matter what a stale localStorage key from a previous manager session
    // on the same browser says.
    const canSwitch = isManager;
    const storesQ = useStores(canSwitch);
    const [picked, setPicked] = React.useState(readStored);
    const chooseStore = React.useCallback((id) => { setPicked(id); writeStored(id); }, []);

    const home = session.storeId || null;
    let storeId = home;
    if (canSwitch) {
      const wanted = picked || home;
      // Validated against the SERVED list once it lands: a store that was
      // deactivated (or a slug from another deployment) must not leave the app
      // pinned to a store the backend will 404 on every request. Before the
      // list lands, the remembered choice is honoured optimistically — the
      // alternative is one render of the wrong store's board on every load.
      const resolved = (wanted === ALL_STORES.id || !storesQ.stores.length
        || storesQ.stores.some((x) => x.id === wanted)) ? wanted : home;
      storeId = resolved || home;
    }
    const storeRow = storesQ.stores.find((x) => x.id === storeId);
    const store = storeId === ALL_STORES.id
      ? { id: ALL_STORES.id, name: ALL_STORES.name, all: true }
      : { id: storeId, name: (storeRow && storeRow.name) || storeName(storeId), all: false,
          tz: storeRow && storeRow.tz, pos: storeRow && storeRow.pos };

    const ctx = { navigate, query, route, path, session, isManager, previewing, seat: isManager && !previewing ? 'console' : 'seat', me,
      store, stores: storesQ.stores, refreshStores: storesQ.refresh, homeStoreId: home };

    let Screen = null;
    if (/^\/contests\/[^/]+\/edit$/.test(path)) Screen = window.IncScreenContestBuilder;
    else if (path.startsWith('/contests/') && path !== '/contests/new') Screen = window.IncScreenContestDetail;
    else Screen = (ROUTES().find(([p]) => p === path) || [])[1];

    const source = sourceFor(path);
    const label = bountyLabel(path);
    const screenSlot = Screen ? <Screen {...ctx} /> : (
      <ErrorState title={`The ${label} screen did not load`}
        body={`${source[0]} defines ${source[1]} and this page did not get it — check that Hyperwolf Bounty.html loads that file, or that this screen has not been built yet.`} />
    );

    const showConsole = isManager && !previewing;

    const previewBand = (isManager && previewing) ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: P.infoSoft,
        border: `1px solid ${P.info}`, borderRadius: P.r10, fontSize: P.type.body, color: P.ink2 }}>
        <Icon name="eye" size={15} stroke={1.9} color={P.info} />
        <span style={{ flex: 1 }}>You&#8217;re previewing what budtenders see. Nothing here is clickable.</span>
        <PBtn size="xs" variant="secondary" onClick={() => setPreviewing(false)}>Back to manager</PBtn>
      </div>
    ) : null;

    return (
      <div style={{ display: 'flex', height: '100%', background: P.bg, color: P.ink, fontFamily: P.fontSans }}>
        <BFrame name="The navigation rail"><window.HWRail active="bounty" /></BFrame>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <BFrame name="The top bar">
            <Topbar stores={storesQ.stores} storeId={storeId} onStoreChange={chooseStore} canSwitch={canSwitch} />
          </BFrame>
          <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Keyed by path: without the key, React keeps the same boundary
                instance across a navigation and its error state follows the
                operator to a route that would otherwise work. */}
            <BFrame key={path + '|' + storeId} name={label} onReset={() => navigate('#/')} resetLabel="Back to Standings">
              {showConsole ? (
                <ConsoleFrame navigate={navigate} path={path} screenSlot={screenSlot} isManager={isManager}
                  previewing={previewing} onTogglePreview={setPreviewing}
                  meError={me.error} meLoading={me.loading} meRefresh={me.refresh} />
              ) : (
                <SeatFrame screenSlot={screenSlot} previewLocked={isManager && previewing} previewBand={previewBand}
                  meError={me.error} meLoading={me.loading} meRefresh={me.refresh} />
              )}
            </BFrame>
          </main>
        </div>
        {/* hd-ui.jsx installs window.hdToast only once ToastHost mounts; without
            this, every screen's write outcome is a silent no-op. */}
        {window.ToastHost ? <window.ToastHost /> : null}
      </div>);
  }

  window.BountyApp = App;
  // Backstop, same reasoning as engage/app.jsx's: catches App itself and the
  // ThemeProvider's children, so a throw in App's own body is a named panel
  // instead of a white screen.
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider><BFrame name="Bounty"><App /></BFrame></ThemeProvider>);
})();
