// ── Engage shell — HW rail · module sidebar · topbar · router ──────────────
// Nav mirrors components/console/sidebar.tsx: five groups, fixed categorical
// hue per item, 2px accent left-border on active, collapsible to an icon rail.
;(function () {
  const useP = window.useP;

  const NAV_GROUPS = [
    { label: 'Reach', items: [
      { href: '#/', label: 'Dashboard', icon: 'layout', hue: 'blue', match: '/', exact: true, kbd: 'G D' },
      { href: '#/audiences', label: 'Audiences', icon: 'users', hue: 'teal', match: '/audiences', kbd: 'G A' },
      { href: '#/campaigns', label: 'Campaigns', icon: 'megaphone', hue: 'pink', match: '/campaigns', kbd: 'G C' },
      { href: '#/templates', label: 'Templates', icon: 'layout-template', hue: 'violet', match: '/templates' },
      { href: '#/messages', label: 'Messages', icon: 'message', hue: 'green', match: '/messages' },
    ] },
    { label: 'Engage', items: [
      { href: '#/flows', label: 'Flows', icon: 'workflow', hue: 'violet', match: '/flows' },
      { href: '#/loyalty', label: 'Loyalty', icon: 'gift', hue: 'pink', match: '/loyalty' },
      { href: '#/interactive', label: 'Interactive', icon: 'gamepad', hue: 'green', match: '/interactive' },
      { href: '#/referrals', label: 'Referrals', icon: 'share', hue: 'teal', match: '/referrals' },
      { href: '#/wallet', label: 'Wallet passes', icon: 'wallet', hue: 'blue', match: '/wallet' },
    ] },
    { label: 'Understand', items: [
      { href: '#/customers', label: 'Customers', icon: 'users', hue: 'blue', match: '/customers' },
      { href: '#/analytics', label: 'Analytics', icon: 'chart', hue: 'pink', match: '/analytics', exact: true },
      { href: '#/traits', label: 'Traits & tags', icon: 'tag', hue: 'violet', soon: true },
      { href: '#/health', label: 'System health', icon: 'gauge', hue: 'green', match: '/health' },
    ] },
    { label: 'Insights', items: [
      { href: '#/analytics/deliverability', label: 'Deliverability', icon: 'mail', hue: 'blue', match: '/analytics/deliverability' },
      { href: '#/analytics/staff', label: 'Staff', icon: 'users', hue: 'teal', match: '/analytics/staff' },
      { href: '#/analytics/geo', label: 'Geo', icon: 'map-pin', hue: 'pink', match: '/analytics/geo' },
      { href: '#/analytics/rfm', label: 'RFM matrix', icon: 'grid', hue: 'violet', match: '/analytics/rfm' },
    ] },
    { label: 'Operate', items: [
      { href: '#/onboarding', label: 'Onboarding', icon: 'compass', hue: 'green', match: '/onboarding' },
      { href: '#/integrations', label: 'Integrations', icon: 'plug', hue: 'teal', match: '/integrations' },
      { href: '#/audit', label: 'Audit log', icon: 'scroll', hue: 'violet', match: '/audit' },
      { href: '#/settings', label: 'Settings', icon: 'settings', hue: 'blue', match: '/settings' },
    ] },
  ];

  const CRUMBS = [
    ['/customers/', ['Understand', 'Customers', 'Profile']], ['/customers', ['Understand', 'Customers']],
    ['/audiences/new', ['Reach', 'Audiences', 'Builder']], ['/audiences/compare', ['Reach', 'Audiences', 'Compare']],
    ['/audiences/suggested', ['Reach', 'Audiences', 'AI suggestions']], ['/audiences/', ['Reach', 'Audiences', 'Detail']],
    ['/audiences', ['Reach', 'Audiences']],
    ['/campaigns', ['Reach', 'Campaigns']], ['/templates', ['Reach', 'Templates']], ['/messages', ['Reach', 'Messages']],
    ['/flows/new', ['Engage', 'Flows', 'New flow']], ['/flows/templates', ['Engage', 'Flows', 'Templates']],
    ['/flows/', ['Engage', 'Flows', 'Detail']], ['/flows', ['Engage', 'Flows']],
    ['/loyalty/', ['Engage', 'Loyalty', 'Program']], ['/loyalty', ['Engage', 'Loyalty']],
    ['/interactive/', ['Engage', 'Interactive', 'Campaign']], ['/interactive', ['Engage', 'Interactive']],
    ['/referrals/fraud', ['Engage', 'Referrals', 'Fraud review']], ['/referrals/programs', ['Engage', 'Referrals', 'Programs']],
    ['/referrals', ['Engage', 'Referrals']], ['/wallet', ['Engage', 'Wallet passes']],
    ['/analytics/attribution', ['Analytics', 'Attribution']], ['/analytics/campaigns', ['Analytics', 'Campaigns']],
    ['/analytics/cohorts', ['Analytics', 'Cohorts']], ['/analytics/deliverability', ['Analytics', 'Deliverability']],
    ['/analytics/geo', ['Analytics', 'Geo']], ['/analytics/rfm', ['Analytics', 'RFM matrix']],
    ['/analytics/staff', ['Analytics', 'Staff']], ['/analytics/usage', ['Analytics', 'Usage']],
    ['/analytics', ['Understand', 'Analytics']],
    ['/integrations/', ['Operate', 'Integrations', 'Detail']], ['/integrations', ['Operate', 'Integrations']],
    ['/audit', ['Operate', 'Audit log']], ['/onboarding', ['Operate', 'Onboarding']],
    ['/settings/cost', ['Operate', 'Settings', 'Cost']], ['/settings/flags', ['Operate', 'Settings', 'Feature flags']],
    ['/settings', ['Operate', 'Settings']], ['/health', ['Understand', 'System health']],
  ];
  const crumbsFor = (path) => (CRUMBS.find(([p]) => path === p || path.startsWith(p))?.[1]) || ['Engage'];

  function ModuleSidebar({ path, navigate, collapsed, setCollapsed }) {
    const P = useP(), HD = window.HD;
    const isActive = (item) => {
      if (!item.match) return false;
      if (item.exact) return path === item.match;
      return path === item.match || path.startsWith(item.match + '/');
    };
    return (
      <aside style={{ width: collapsed ? 60 : 216, flex: `0 0 ${collapsed ? 60 : 216}px`, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${P.hairline2}`, background: P.bg, transition: 'width .18s ease' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? 0 : '0 14px', justifyContent: collapsed ? 'center' : 'flex-start', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ height: 28, width: 28, borderRadius: 7, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name="sparkle" size={16} stroke={2.2} />
          </div>
          {!collapsed && <>
            <span style={{ fontSize: 16, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>Engage</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, height: 18, padding: '0 6px', borderRadius: 4, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : P.accentBorder, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Beta</span>
          </>}
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 6px' : '8px' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 10 }}>
              {collapsed
                ? <div style={{ margin: '0 8px 6px', height: 1, background: P.hairline2 }} />
                : <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', color: P.inkMute }}>{group.label}</div>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((item) => {
                  const active = isActive(item);
                  const color = item.soon ? P.inkFaint : HD.hueColor(P, item.hue);
                  if (item.soon) {
                    return (
                      <li key={item.label}>
                        <span title="Coming soon" aria-disabled="true" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: collapsed ? 0 : '0 12px', justifyContent: collapsed ? 'center' : 'flex-start', height: 34, borderRadius: 8, fontSize: 13.5, color: P.inkFaint, cursor: 'not-allowed' }}>
                          <Icon name={item.icon} size={16} stroke={1.8} color={color} />
                          {!collapsed && <><span style={{ flex: 1 }}>{item.label}</span><span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>soon</span></>}
                        </span>
                      </li>);
                  }
                  return (
                    <li key={item.label}>
                      <button onClick={() => navigate(item.href)} title={collapsed ? item.label : undefined}
                        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: collapsed ? 0 : '0 12px', justifyContent: collapsed ? 'center' : 'flex-start', height: 34, borderRadius: 8, fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans,
                          background: active ? P.surface : 'transparent', boxShadow: active ? P.shadowSm : 'none', color: active ? P.ink : P.inkDim, border: 'none', borderLeft: `2px solid ${active ? P.accent : 'transparent'}` }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = P.surface3; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                        <Icon name={item.icon} size={16} stroke={1.8} color={color} />
                        {!collapsed && <>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.kbd && <kbd style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 4px' }}>{item.kbd}</kbd>}
                        </>}
                      </button>
                    </li>);
                })}
              </ul>
            </div>))}
        </nav>
        <div style={{ padding: 8, borderTop: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'transparent', border: 'none', color: P.inkMute, cursor: 'pointer', flex: '0 0 auto' }}>
            <Icon name="chevron-left" size={15} stroke={2} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
          </button>
          {!collapsed && <p style={{ margin: 0, flex: 1, fontSize: 11.5, lineHeight: 1.35, color: P.inkMute }}>Keyboard-first — press <kbd style={{ fontFamily: P.fontMono, fontSize: 10, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 3, padding: '0 3px' }}>?</kbd> for shortcuts.</p>}
        </div>
      </aside>);
  }

  function TenantMenu() {
    const P = useP(), D = window.ENGAGE_DATA;
    const [open, setOpen] = React.useState(false);
    const active = D.TENANTS[0];
    const initials = (n) => n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen((o) => !o)} aria-label="Switch tenant"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans, fontSize: 13.5, color: P.ink }}>
          <span style={{ height: 22, width: 22, borderRadius: 5, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{initials(active.name)}</span>
          <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{active.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: window.HD.tone(P, 'warn').fg, background: window.HD.tone(P, 'warn').bg, borderRadius: 4, padding: '2px 5px' }}>Dev</span>
          <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} />
        </button>
        {open && <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 41, width: 300, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 6 }}>
            <MicroLabel style={{ padding: '6px 8px' }}>Your tenants</MicroLabel>
            {D.TENANTS.map((t) => (
              <button key={t.id} onClick={() => setOpen(false)} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 8, padding: '8px', borderRadius: 8, background: t.id === active.id ? P.surface3 : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <span style={{ height: 22, width: 22, borderRadius: 5, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : P.accentBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: '0 0 auto', marginTop: 1 }}>{initials(t.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: P.ink }}>{t.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{t.slug} · {t.role} · {window.HD.formatNumber(t.customers)}</span>
                </span>
              </button>))}
            <div style={{ height: 1, background: P.hairline2, margin: '6px 2px' }} />
            <button onClick={() => setOpen(false)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13.5, color: P.ink2, fontFamily: P.fontSans }}>Provision new tenant…</button>
          </div>
        </>}
      </div>);
  }

  function CommandPalette({ open, onClose, navigate }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const items = React.useMemo(() => NAV_GROUPS.flatMap((g) => g.items.filter((i) => !i.soon).map((i) => ({ ...i, group: g.label }))).concat([
      { href: '#/audiences/new', label: 'New audience (AI builder)', group: 'Reach', icon: 'sparkle' },
      { href: '#/audiences/suggested', label: 'AI audience suggestions', group: 'Reach', icon: 'sparkle' },
      { href: '#/audiences/compare', label: 'Compare audiences', group: 'Reach', icon: 'chart' },
      { href: '#/flows/new', label: 'New flow', group: 'Engage', icon: 'plus' },
      { href: '#/flows/templates', label: 'Flow templates', group: 'Engage', icon: 'layout-template' },
      { href: '#/referrals/fraud', label: 'Referral fraud review', group: 'Engage', icon: 'shield' },
      { href: '#/analytics/attribution', label: 'Attribution', group: 'Analytics', icon: 'chart' },
      { href: '#/analytics/cohorts', label: 'Cohorts', group: 'Analytics', icon: 'grid' },
      { href: '#/analytics/campaigns', label: 'Campaign analytics', group: 'Analytics', icon: 'megaphone' },
      { href: '#/analytics/usage', label: 'Usage & spend', group: 'Analytics', icon: 'gauge' },
      { href: '#/settings/cost', label: 'Cost controls', group: 'Operate', icon: 'dollar' },
      { href: '#/settings/flags', label: 'Feature flags', group: 'Operate', icon: 'sliders' },
    ]), []);
    const filtered = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
    React.useEffect(() => { if (open) setQ(''); }, [open]);
    if (!open) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
        <div style={{ position: 'relative', width: 540, maxWidth: '92vw', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${P.hairline2}` }}>
            <Field icon="search" size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search audiences, customers, templates…" />
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: 6 }}>
            {filtered.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: P.inkMute, textAlign: 'center' }}>No matches.</div>}
            {filtered.map((i) => (
              <button key={i.href + i.label} onClick={() => { navigate(i.href); onClose(); }}
                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Icon name={i.icon} size={15} stroke={1.8} color={P.inkMute} />
                <span style={{ flex: 1 }}>{i.label}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute }}>{i.group}</span>
              </button>))}
          </div>
        </div>
      </div>);
  }

  function Topbar({ path, onSearch }) {
    const P = useP();
    const { mode, toggle } = window.useTheme();
    const crumbs = crumbsFor(path);
    return (
      <header style={{ height: 56, flex: '0 0 56px', borderBottom: `1px solid ${P.hairline2}`, background: P.bg, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
        <TenantMenu />
        <div style={{ width: 1, height: 20, background: P.hairline2 }} />
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: P.inkDim, whiteSpace: 'nowrap' }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c + i}>
              {i > 0 && <Icon name="chevron-right" size={13} stroke={2} style={{ opacity: .5 }} />}
              <span style={{ color: i === crumbs.length - 1 ? P.ink : P.inkDim }}>{c}</span>
            </React.Fragment>))}
        </nav>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <button type="button" onClick={onSearch} aria-label="Open command palette (⌘K)"
            style={{ width: '100%', maxWidth: 400, height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
            <Icon name="search" size={14} stroke={1.9} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search audiences, customers, templates…</span>
            <kbd style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconBtn icon="bell" size={16} title="Notifications" style={{ width: 34, height: 34 }} />
          <IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} size={16} onClick={toggle} title="Toggle theme" style={{ width: 34, height: 34 }} />
          <Avatar name="Jessica Tran" size={30} />
        </div>
      </header>);
  }

  function Placeholder({ title }) {
    return <div style={{ padding: 24 }}><HDEmpty icon="layout" title={title} body="This Engage surface is next in the port queue." /></div>;
  }

  const ROUTES = () => ([
    ['/', window.ScreenEngageHome], ['/customers', window.ScreenCustomers],
    ['/audiences/new', window.ScreenAudienceBuilder], ['/audiences/compare', window.ScreenAudienceCompare],
    ['/audiences/suggested', window.ScreenSuggestedAudiences], ['/audiences', window.ScreenAudiences],
    ['/campaigns', window.ScreenCampaigns], ['/templates', window.ScreenTemplates], ['/messages', window.ScreenMessages],
    ['/flows/new', window.ScreenFlowNew], ['/flows/templates', window.ScreenFlowTemplates], ['/flows', window.ScreenFlows],
    ['/loyalty', window.ScreenLoyalty], ['/interactive', window.ScreenInteractive],
    ['/referrals/fraud', window.ScreenReferralFraud], ['/referrals/programs', window.ScreenReferralPrograms], ['/referrals', window.ScreenReferrals],
    ['/wallet', window.ScreenWallet],
    ['/analytics/attribution', window.ScreenAttribution], ['/analytics/campaigns', window.ScreenCampaignAnalytics],
    ['/analytics/cohorts', window.ScreenCohorts], ['/analytics/deliverability', window.ScreenDeliverability],
    ['/analytics/geo', window.ScreenGeo], ['/analytics/rfm', window.ScreenRfm], ['/analytics/staff', window.ScreenStaff],
    ['/analytics/usage', window.ScreenUsage], ['/analytics', window.ScreenAnalytics],
    ['/integrations', window.ScreenIntegrations], ['/audit', window.ScreenAudit], ['/onboarding', window.ScreenOnboarding],
    ['/settings/cost', window.ScreenCost], ['/settings/flags', window.ScreenEngageFlags], ['/settings', window.ScreenSettings],
    ['/health', window.ScreenHealth],
  ]);

  function App() {
    const [route, setRoute] = React.useState(() => location.hash || '#/');
    const [collapsed, setCollapsed] = React.useState(false);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const P = useP();

    React.useEffect(() => {
      const h = () => setRoute(location.hash || '#/');
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/';
      return () => removeEventListener('hashchange', h);
    }, []);
    React.useEffect(() => {
      let last = 0;
      const h = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); return; }
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        const k = e.key.toLowerCase();
        if (k === 'g') { last = Date.now(); return; }
        if (Date.now() - last < 900) {
          if (k === 'd') location.hash = '#/';
          else if (k === 'a') location.hash = '#/audiences';
          else if (k === 'c') location.hash = '#/campaigns';
          else if (k === 'f') location.hash = '#/flows';
          last = 0;
        }
      };
      addEventListener('keydown', h);
      return () => removeEventListener('keydown', h);
    }, []);

    const navigate = React.useCallback((href) => { location.hash = href; }, []);
    const path = route.replace(/^#/, '').split('?')[0] || '/';
    const query = route.includes('?') ? new URLSearchParams(route.split('?')[1]) : new URLSearchParams();
    const ctx = { navigate, query, route, path };

    let Screen = null;
    if (path.startsWith('/customers/') && path.length > 11) Screen = window.ScreenCustomerDetail;
    else if (path.startsWith('/audiences/') && !['/audiences/new', '/audiences/compare', '/audiences/suggested'].includes(path)) Screen = window.ScreenAudienceDetail;
    else if (path.startsWith('/flows/') && !['/flows/new', '/flows/templates'].includes(path)) Screen = window.ScreenFlowDetail;
    else if (path.startsWith('/loyalty/')) Screen = window.ScreenLoyaltyProgram;
    else if (path.startsWith('/interactive/')) Screen = window.ScreenInteractiveDetail;
    else if (path.startsWith('/integrations/')) Screen = window.ScreenIntegrationDetail;
    else Screen = (ROUTES().find(([p]) => p === path) || [])[1];

    return (
      <div style={{ display: 'flex', height: '100%', background: P.bg, color: P.ink }}>
        <window.HWRail active="engage" />
        <ModuleSidebar path={path} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar path={path} onSearch={() => setSearchOpen(true)} />
          <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {Screen ? <Screen {...ctx} /> : <Placeholder title={path.replace(/^\//, '').replace(/\//g, ' · ') || 'Screen'} />}
          </main>
        </div>
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} />
        <ToastHost />
      </div>);
  }

  window.EngageApp = App;
  ReactDOM.createRoot(document.getElementById('root')).render(<ThemeProvider><App /></ThemeProvider>);
})();
