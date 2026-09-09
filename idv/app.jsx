// ── idv/app.jsx ── Verify shell — HW rail · in-app nav · hash router ───────
// Owns ONLY the frame: which route is active, which screen global fills it,
// and what renders when that global is missing. Renders zero Verify content
// of its own — no idv/screen-*.jsx file exists yet (other agents build
// those, per this task's own scope), so every route today shows the guarded
// "did not load" ErrorState, the same convention incentives/app.jsx uses for
// an unbuilt screen (never a blank route, never "Something went wrong").
//
// Skeleton copied from incentives/app.jsx's shape: ROUTES() and SCREEN_SOURCE
// resolved at RENDER time (functions/maps read fresh on every render, not
// cached at module load) so a screen file loaded after this one still
// resolves; the routed frame is keyed by path so a failure clears on
// navigation instead of following the operator to the next screen.
;(function () {
  const useP = window.useP;

  const STORE_NAMES = { elsinore: 'Lake Elsinore', 'west-la': 'West Hollywood', 'long-beach': 'Long Beach', corona: 'Corona', riverside: 'Riverside' };
  const storeName = (id) => STORE_NAMES[id] || id || 'Store';

  // ── in-app nav ────────────────────────────────────────────────────────
  // Rail order per this task's brief: Home, Customers, Verifications,
  // Workflows, Lists, Integrate, Usage, Settings. Questionnaires and
  // Customization live under Settings; Review is a filter on Verifications
  // (the system is autonomous — nobody staffs a standing review queue,
  // plan §0 "Operation"), so neither gets its own top-level item.
  const NAV = [
    { id: 'home', path: '/', label: 'Home', icon: 'layout' },
    { id: 'customers', path: '/customers', label: 'Customers', icon: 'users' },
    { id: 'sessions', path: '/sessions', label: 'Verifications', icon: 'shield' },
    { id: 'workflows', path: '/workflows', label: 'Workflows', icon: 'workflow' },
    { id: 'lists', path: '/lists', label: 'Lists', icon: 'list' },
    { id: 'integrate', path: '/integrate', label: 'Integrate', icon: 'plug' },
    { id: 'usage', path: '/usage', label: 'Usage', icon: 'chart' },
    { id: 'settings', path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  // path -> [expected file, expected global]. Session detail is matched
  // separately (parametric path), same pattern as Bounty's contest detail.
  const SCREEN_SOURCE = {
    '/': ['idv/screen-home.jsx', 'window.IdvHomeScreen'],
    '/customers': ['idv/screen-people.jsx', 'window.IdvPeopleScreen'],
    '/sessions': ['idv/screen-sessions.jsx', 'window.IdvSessionsScreen'],
    '/workflows': ['idv/screen-workflows.jsx', 'window.IdvWorkflowsScreen'],
    '/lists': ['idv/screen-lists.jsx', 'window.IdvListsScreen'],
    '/integrate': ['idv/screen-integrate.jsx', 'window.IdvIntegrateScreen'],
    '/usage': ['idv/screen-usage.jsx', 'window.IdvUsageScreen'],
    '/settings': ['idv/screen-settings.jsx', 'window.IdvSettingsScreen'],
  };
  const SESSION_DETAIL_SOURCE = ['idv/screen-session.jsx', 'window.IdvSessionScreen'];
  const SESSION_DETAIL_RE = /^\/sessions\/[^/]+$/;
  // Parametric detail/sub-routes — same shape as SESSION_DETAIL_RE, one per
  // screen that already parses its own `:id`/`:tab` out of `props.path`
  // (each file's own header comment flagged this exact gap and said fixing
  // it was app.jsx's job, out of that file's scope): screen-people.jsx
  // (`/customers/:id`), screen-workflows.jsx (`/workflows/:id`, its own
  // WORKFLOW_ID_RE), screen-lists.jsx (`/lists/:id`), screen-settings.jsx
  // (`/settings/:tab`, which also self-normalizes to `?tab=` on hashchange —
  // this route is a defensive belt-and-braces match, not this file's only
  // guard against that path shape).
  const CUSTOMER_DETAIL_RE = /^\/customers\/[^/]+$/;
  const WORKFLOW_DETAIL_RE = /^\/workflows\/[^/]+$/;
  const LIST_DETAIL_RE = /^\/lists\/[^/]+$/;
  const SETTINGS_TAB_RE = /^\/settings\/[^/]+$/;

  // Resolved at RENDER time (a function, not a constant) — see file header.
  const ROUTES = () => ([
    ['/', window.IdvHomeScreen],
    ['/customers', window.IdvPeopleScreen],
    ['/sessions', window.IdvSessionsScreen],
    ['/workflows', window.IdvWorkflowsScreen],
    ['/lists', window.IdvListsScreen],
    ['/integrate', window.IdvIntegrateScreen],
    ['/usage', window.IdvUsageScreen],
    ['/settings', window.IdvSettingsScreen],
  ]);
  // '#/verifications' is an alias of '/sessions' (this task's brief) —
  // screen-home.jsx's own search box already navigates straight to the real
  // '#/sessions?q=...' route (see that file's header comment for why), so
  // this alias exists only for anyone who types or bookmarks '#/verifications'
  // directly; it must resolve exactly like '/sessions' does, list or detail.
  function normalizePath(path) {
    if (path === '/verifications') return '/sessions';
    if (path.indexOf('/verifications/') === 0) return '/sessions' + path.slice('/verifications'.length);
    return path;
  }
  function screenFor(path) {
    path = normalizePath(path);
    if (SESSION_DETAIL_RE.test(path)) return window.IdvSessionScreen;
    if (CUSTOMER_DETAIL_RE.test(path)) return window.IdvPeopleScreen;
    if (WORKFLOW_DETAIL_RE.test(path)) return window.IdvWorkflowsScreen;
    if (LIST_DETAIL_RE.test(path)) return window.IdvListsScreen;
    if (SETTINGS_TAB_RE.test(path)) return window.IdvSettingsScreen;
    return (ROUTES().find(([p]) => p === path) || [])[1];
  }
  function sourceFor(path) {
    path = normalizePath(path);
    if (SESSION_DETAIL_RE.test(path)) return SESSION_DETAIL_SOURCE;
    if (CUSTOMER_DETAIL_RE.test(path)) return SCREEN_SOURCE['/customers'];
    if (WORKFLOW_DETAIL_RE.test(path)) return SCREEN_SOURCE['/workflows'];
    if (LIST_DETAIL_RE.test(path)) return SCREEN_SOURCE['/lists'];
    if (SETTINGS_TAB_RE.test(path)) return SCREEN_SOURCE['/settings'];
    return SCREEN_SOURCE[path] || ['idv/screen' + path.replace(/\//g, '-') + '.jsx', 'that screen'];
  }
  const ROUTE_LABEL = { '/': 'Home', '/customers': 'Customers', '/sessions': 'Verifications',
    '/workflows': 'Workflows', '/lists': 'Lists', '/integrate': 'Integrate', '/usage': 'Usage', '/settings': 'Settings' };
  // Never "Something went wrong": an unlisted path is named from itself.
  function idvLabel(path) {
    path = normalizePath(path);
    if (ROUTE_LABEL[path]) return ROUTE_LABEL[path];
    if (SESSION_DETAIL_RE.test(path)) return 'Verification · ' + path.replace('/sessions/', '');
    if (CUSTOMER_DETAIL_RE.test(path)) return 'Customer · ' + path.replace('/customers/', '');
    if (WORKFLOW_DETAIL_RE.test(path)) return 'Workflow · ' + path.replace('/workflows/', '');
    if (LIST_DETAIL_RE.test(path)) return 'List · ' + path.replace('/lists/', '');
    if (SETTINGS_TAB_RE.test(path)) return 'Settings · ' + path.replace('/settings/', '');
    return path.replace(/^\//, '').replace(/\//g, ' · ') || 'Verify';
  }

  /* ── WHERE A FAILURE STOPS ────────────────────────────────────────────
   * Region-level boundaries (rail, top bar, in-app nav, routed frame), the
   * same placement rule as incentives/app.jsx / engage/app.jsx. The routed
   * frame is normally a ScreenBoundary (CONTAIN) — an unbuilt list/dashboard
   * screen failing must not take the rest of Verify down with it. Session
   * DETAIL is the one flow this shell escalates to CriticalBoundary (REFUSE):
   * it is the PII-bearing screen (document images, decision nodes, review
   * actions), and Engage's own reasoning for CONTAIN-vs-REFUSE (engage/
   * app.jsx L259-276, cited in scratch/idv-conventions-digest-2026-09-08.md
   * §7.7) applies to it directly — a session detail that renders PARTIALLY,
   * with a review action bar intact but a decision node silently missing,
   * looks complete and is not; nothing must be actionable from a screen that
   * has already failed. */
  if (!window.ScreenBoundary || !window.CriticalBoundary) {
    try {
      console.error('[HW boundary] Hyperwolf Verify.html did not load shared/error-boundary.jsx — '
        + 'Verify is running with NO error boundaries.');
    } catch (e) {}
  }
  const BFrame = window.ScreenBoundary || function BFrame(p) { return p.children; };
  const CFrame = window.CriticalBoundary || function CFrame(p) { return p.children; };

  // ── chrome ────────────────────────────────────────────────────────────
  function Topbar() {
    const P = useP();
    const { mode, toggle } = window.useTheme();
    const session = window.HWIdv.session();
    return (
      <header style={{ height: 56, flex: '0 0 56px', borderBottom: `1px solid ${P.hairline2}`, background: P.bg,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: P.r8, background: P.accent, color: P.accentInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name="shield" size={15} stroke={2} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>Verify</span>
        <div style={{ flex: 1 }} />
        <BFrame name="Engine status"><window.IdvShared.EngineBadge /></BFrame>
        <BFrame name="Terms link"><window.IdvTerms.Link /></BFrame>
        <Pill kind="neutral" size="sm">{storeName(session.storeId)}</Pill>
        <IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} size={16} onClick={toggle} title="Toggle theme" style={{ width: 34, height: 34 }} />
        <Avatar name={session.name} size={30} />
      </header>);
  }

  // Secondary, in-app nav — a second, narrow rail listing Verify's own eight
  // sections. Distinct from window.HWRail (the cross-app rail on the far
  // left, active="idv"): this one is Verify's own, the way Bounty's TABS or
  // Engage's ModuleSidebar are each app's own second-tier navigation.
  function IdvNav({ path, navigate }) {
    const P = useP();
    return (
      <nav style={{ width: 190, flex: '0 0 190px', borderRight: `1px solid ${P.hairline2}`, background: P.surface2,
        padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item) => {
          const active = path === item.path || (item.path !== '/' && path.startsWith(item.path));
          return (
            <button key={item.id} data-hw-i onClick={() => navigate('#' + item.path)} aria-current={active ? 'page' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: P.ctrlH.md, padding: '0 11px',
                background: active ? P.surface : 'transparent', color: active ? P.ink : P.inkDim,
                border: 'none', borderRadius: P.r8, cursor: 'pointer', fontFamily: P.fontSans, fontSize: P.type.body,
                fontWeight: active ? 700 : 500, textAlign: 'left', boxShadow: active ? `inset 2px 0 0 ${P.accent}` : 'none' }}>
              <Icon name={item.icon} size={16} stroke={active ? 1.95 : 1.7} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>);
        })}
      </nav>);
  }

  // ── useConsoleGate ────────────────────────────────────────────────────
  // Asks the backend once whether there is a PIN in front of the console
  // (GET /api/idv/auth/status), and re-asks whenever any screen's request
  // comes back 401 — window.HWIdv.auth publishes that, so a token that ran out
  // of its 12 hours mid-shift turns into the PIN card rather than an error
  // panel on a screen that will never load again.
  //
  // `unknown` IS NOT `gated`. When the backend cannot be reached the question
  // has no answer, and the wrong answer here is expensive in both directions:
  // guess "gated" and an operator is asked to fix a dead server by typing a
  // PIN; guess "not gated" and every screen renders its own NotConnected,
  // which is the truth. So unknown renders the app, exactly as it did before
  // this gate existed.
  function useConsoleGate() {
    const [state, setState] = React.useState({ loading: true, gated: false, ok: true, unknown: true });
    const aliveRef = React.useRef(true);
    // ONE CHECK IN FLIGHT AT A TIME, and the reason is visible in the network
    // log without it: eight screens on Home each fire their own poll, so ONE
    // expiring token produces four or five simultaneous 401s, each of which
    // asks "is there a gate now?" — four or five identical round trips to
    // answer one question, at exactly the moment the backend is refusing
    // everything. The in-flight promise is shared instead.
    const inFlightRef = React.useRef(null);
    const check = React.useCallback(() => {
      if (inFlightRef.current) return inFlightRef.current;
      const p = window.HWIdv.auth.status().then((r) => {
        inFlightRef.current = null;
        if (!aliveRef.current) return r;
        setState({ loading: false, gated: !!r.gated, ok: !!r.ok, unknown: !!r.unknown });
        return r;
      }, (e) => { inFlightRef.current = null; throw e; });
      inFlightRef.current = p;
      return p;
    }, []);
    React.useEffect(() => {
      aliveRef.current = true;
      check();
      // A 401 from ANY screen, not only from this hook's own fetch: the
      // subscription is what makes one expiry re-gate the whole console
      // instead of one panel.
      const off = window.HWIdv.auth.subscribe(() => { check(); });
      return () => { aliveRef.current = false; off(); };
    }, [check]);
    return { ...state, recheck: check };
  }

  function App() {
    const P = useP();
    const [route, setRoute] = React.useState(() => location.hash || '#/');
    const gate = useConsoleGate();

    React.useEffect(() => {
      const h = () => setRoute(location.hash || '#/');
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/';
      return () => removeEventListener('hashchange', h);
    }, []);

    const navigate = React.useCallback((href) => { location.hash = href; }, []);
    // Normalized once, here: everything downstream (screenFor/sourceFor/
    // idvLabel, ctx.path, the nav highlight, the session-detail check) sees
    // the resolved '/sessions/...' shape even when the operator navigated to
    // the '#/verifications' alias, exactly as if they had used the real path.
    const path = normalizePath(route.replace(/^#/, '').split('?')[0] || '/');

    const Screen = screenFor(path);
    const source = sourceFor(path);
    const label = idvLabel(path);
    const ctx = { navigate, path, session: window.HWIdv.session(), role: window.HWIdv.role(), can: window.HWIdv.can };

    const screenSlot = Screen ? <Screen {...ctx} /> : (
      <ErrorState title={`The ${label} screen did not load`}
        body={`${source[0]} defines ${source[1]} and this page did not get it — check that Hyperwolf Verify.html loads that file, or that this screen has not been built yet.`} />
    );

    const isSessionDetail = SESSION_DETAIL_RE.test(path);
    const RoutedFrame = isSessionDetail
      ? <CFrame name="Session detail" flow="This verification review">{screenSlot}</CFrame>
      : screenSlot;

    // ── the PIN gate ────────────────────────────────────────────────────
    // IN PLACE OF THE ROUTED FRAME, and not in place of the whole shell: the
    // rail, the top bar and Verify's own nav stay on screen, so the operator
    // can still see where they are and switch apps. What is behind the gate is
    // the CONTENT — every screen in the frame reads sessions, people, media or
    // the audit trail, and every one of those requests is 401 until a PIN is
    // entered, so rendering them would produce eight simultaneous error
    // panels saying the same thing.
    //
    // ONE EXCEPTION IS DELIBERATELY ABSENT: there is no "some screens are
    // fine" carve-out. `version` and `engine/health` are open, which is why
    // the EngineBadge in the top bar keeps working through the gate, and that
    // is the whole extent of what a gated console can honestly show.
    const locked = !gate.loading && gate.gated && !gate.ok && !gate.unknown;
    const frameSlot = locked
      ? <window.IdvShared.PinGate onUnlocked={gate.recheck} />
      : (
        // Keyed by path: a contained failure clears when the operator
        // navigates away instead of following them to a route that
        // would otherwise work.
        <BFrame key={path} name={label} onReset={() => navigate('#/')} resetLabel="Back to Home">
          {RoutedFrame}
        </BFrame>);

    return (
      <div style={{ display: 'flex', height: '100%', background: P.bg, color: P.ink, fontFamily: P.fontSans }}>
        <BFrame name="The navigation rail"><window.HWRail active="idv" /></BFrame>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <BFrame name="The top bar"><Topbar /></BFrame>
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {/* No nav while locked: every one of its eight destinations is
                behind the same PIN, so offering them is offering eight ways to
                land on the same card. The cross-app rail on the far left
                STAYS — leaving the operator no way out of Verify would be the
                worse trade. */}
            {locked ? null : <BFrame name="Verify navigation"><IdvNav path={path} navigate={navigate} /></BFrame>}
            <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto',
              padding: locked ? 0 : 20, display: locked ? 'flex' : 'block' }}>
              {frameSlot}
            </main>
          </div>
        </div>
        {/* hd-ui.jsx installs window.hdToast only once ToastHost mounts; without
            this, every screen's write outcome is a silent no-op. */}
        {window.ToastHost ? <window.ToastHost /> : null}
      </div>);
  }

  window.IdvApp = App;
  // Backstop: catches App itself and the ThemeProvider's children, so a throw
  // in App's own body is a named panel instead of a white screen.
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider><BFrame name="Verify"><App /></BFrame></ThemeProvider>);
})();
