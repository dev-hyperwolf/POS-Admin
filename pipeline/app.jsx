// ── Pipeline shell — rail · module sidebar · topbar · router ──────────────
;(function () {
  const useP = window.useP;

  const NAV_GROUPS = [
    { label: 'Overview', items: [
      { href: '#/inbox', label: 'Inbox', icon: 'download', hue: 'violet', match: '#/inbox' },
    ] },
    { label: 'Operations', items: [
      { href: '#/batches', label: 'Batches', icon: 'package', hue: 'teal', match: '#/batches' },
      { href: '#/inventory', label: 'Inventory', icon: 'box', hue: 'green', match: '#/inventory' },
      { href: '#/products', label: 'Products', icon: 'tag', hue: 'pink', match: '#/products' },
      { href: '#/scan', label: 'Mobile scan', icon: 'scan', hue: 'teal', match: '#/scan' },
    ] },
    { label: 'Finance', items: [
      { href: '#/ap', label: 'AP', icon: 'receipt', hue: 'blue', match: '#/ap' },
      { href: '#/credits', label: 'Credits', icon: 'note', hue: 'violet', match: '#/credits' },
      { href: '#/buyers', label: 'Buyers', icon: 'cart', hue: 'teal', match: '#/buyers' },
      { href: '#/scorecards', label: 'Vendors', icon: 'shop', hue: 'green', match: '#/scorecards' },
    ] },
    { label: 'Compliance', items: [
      { href: '#/compliance', label: 'Compliance', icon: 'shield', hue: 'blue', match: '#/compliance', exact: true },
      { href: '#/compliance/holds', label: 'Holds', icon: 'lock', hue: 'pink', match: '#/compliance/holds', nested: true },
      { href: '#/reports', label: 'Reports', icon: 'chart', hue: 'green', inactive: true },
    ] },
    { label: 'System', items: [
      { href: '#/admin/pipeline/thc', label: 'Pipeline config', icon: 'sliders', hue: 'neutral', match: '#/admin/pipeline' },
      { href: '#/admin/catalog/products', label: 'Master catalog', icon: 'grid', hue: 'neutral', match: '#/admin/catalog' },
      { href: '#/settings/flags', label: 'Settings', icon: 'settings', hue: 'neutral', match: '#/settings' },
    ] },
  ];

  function crumbsFor(path) {
    if (path.startsWith('/inbox')) return ['Operations', 'Invoice Inbox'];
    if (path.startsWith('/invoices')) return ['Operations', 'Invoice Inbox', 'Detail'];
    if (path.startsWith('/batches/archive')) return ['Operations', 'Batch Pipeline', 'Archive'];
    if (path.startsWith('/batches/merge')) return ['Operations', 'Batch Pipeline', 'Merge'];
    if (path.startsWith('/batches')) return ['Operations', 'Batch Pipeline'];
    if (path.startsWith('/inventory')) return ['Operations', 'Inventory'];
    if (path.startsWith('/products')) return ['Operations', 'Products'];
    if (path.startsWith('/ap')) return ['Finance', 'Accounts Payable'];
    if (path.startsWith('/credits')) return ['Finance', 'Credit Memos'];
    if (path.startsWith('/buyers')) return ['Operations', 'Buyer Ops'];
    if (path.startsWith('/compliance')) return ['Operations', 'Compliance'];
    if (path.startsWith('/scan')) return ['Operations', 'Mobile Scan'];
    if (path.startsWith('/admin/pipeline')) return ['Settings', 'Pipeline Stages'];
    if (path.startsWith('/admin/catalog')) return ['Settings', 'Master Catalog'];
    if (path.startsWith('/settings/flags')) return ['Settings', 'Feature Flags'];
    if (path.startsWith('/scorecards')) return ['Vendors', 'Scorecards'];
    return ['Hyperdrive'];
  }

  function ModuleSidebar({ route, navigate, collapsed, setCollapsed }) {
    const P = useP(), HD = window.HD;
    const isActive = (item) => {
      if (!item.match) return false;
      if (item.exact || item.nested) return route === item.match;
      return route === item.match || route.startsWith(item.match + '/') || route.startsWith(item.match + '?');
    };
    return (
      <aside style={{ width: collapsed ? 64 : 208, flex: `0 0 ${collapsed ? 64 : 208}px`, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${P.hairline2}`, background: P.canvas, transition: 'width .18s ease' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ height: 28, width: 28, borderRadius: 7, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontWeight: 700, fontSize: 13.5 }}>H</div>
          {!collapsed && <span style={{ fontSize: 16, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>Hyperdrive</span>}
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              {!collapsed && <div style={{ padding: '8px 12px 4px', fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: P.inkMute }}>{group.label}</div>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((item) => {
                  const active = isActive(item);
                  const color = item.inactive ? P.inkFaint : active ? P.ink : HD.hueColor(P, item.hue);
                  if (item.inactive) {
                    return (
                      <li key={item.label}>
                        <span title="Coming in Sprint One" aria-disabled="true" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, borderRadius: 8, fontSize: 13.5, color: P.inkFaint, cursor: 'not-allowed' }}>
                          <Icon name={item.icon} size={16} stroke={1.8} color={color} />{!collapsed && <span>{item.label}</span>}
                        </span>
                      </li>);
                  }
                  return (
                    <li key={item.label}>
                      <button onClick={() => navigate(item.href)} title={item.label}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, borderRadius: 8, fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans,
                          marginLeft: item.nested && !collapsed ? 12 : 0, width: item.nested && !collapsed ? 'calc(100% - 12px)' : '100%',
                          background: active ? P.surface : 'transparent', boxShadow: active ? P.shadowSm : 'none', color: active ? P.ink : P.inkDim, border: 'none', borderLeft: `2px solid ${active ? P.accent : 'transparent'}` }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = P.surface3; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                        <Icon name={item.icon} size={16} stroke={1.8} color={color} />{!collapsed && <span>{item.label}</span>}
                      </button>
                    </li>);
                })}
              </ul>
            </div>))}
        </nav>
        <div style={{ padding: 8, borderTop: `1px solid ${P.hairline2}` }}>
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ width: '100%', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'transparent', border: 'none', color: P.inkMute, cursor: 'pointer' }}>
            <Icon name="chevron-left" size={16} stroke={2} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
          </button>
        </div>
      </aside>);
  }

  function SearchPalette({ open, onClose, navigate }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const items = React.useMemo(() => NAV_GROUPS.flatMap((g) => g.items.filter((i) => !i.inactive).map((i) => ({ ...i, group: g.label }))).concat([
      { href: '#/batches/archive', label: 'Batch archive', group: 'Operations', icon: 'box' },
      { href: '#/batches/merge', label: 'Merge packages', group: 'Operations', icon: 'swap' },
      { href: '#/products/shells', label: 'Product shells', group: 'Operations', icon: 'dollar' },
      { href: '#/credits/new', label: 'New credit memo', group: 'Finance', icon: 'plus' },
    ]), []);
    const filtered = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
    React.useEffect(() => { if (open) setQ(''); }, [open]);
    if (!open) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
        <div style={{ position: 'relative', width: 520, maxWidth: '92vw', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${P.hairline2}` }}>
            <Field icon="search" size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything — jump to a screen…" />
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
            {filtered.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: P.inkMute, textAlign: 'center' }}>No matches.</div>}
            {filtered.map((i) => (
              <button key={i.href} onClick={() => { navigate(i.href); onClose(); }}
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

  function Topbar({ route, entity, setEntity, navigate, onSearch }) {
    const P = useP(), HD = window.HD;
    const { mode, toggle } = window.useTheme();
    const crumbs = crumbsFor(route.replace(/^#/, ''));
    const entityMeta = HD.ENTITIES.find((e) => e.id === entity);
    return (
      <header style={{ height: 56, flex: '0 0 56px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: P.inkDim, whiteSpace: 'nowrap' }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c + i}>
              {i > 0 && <Icon name="chevron-right" size={13} stroke={2} style={{ opacity: .5 }} />}
              <span style={{ color: i === crumbs.length - 1 ? P.ink : P.inkDim }}>{c}</span>
            </React.Fragment>))}
        </nav>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', maxWidth: 420, minWidth: 0, margin: '0 auto' }}>
          <button type="button" onClick={onSearch} aria-label="Open natural-language search (⌘K)"
            style={{ position: 'relative', width: '100%', height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
            <Icon name="search" size={14} stroke={1.9} />
            <span style={{ flex: 1 }}>Ask anything</span>
            <Icon name="sparkle" size={11} stroke={2} color={HD.hueColor(P, 'violet')} />
            <kbd style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: HD.hueColor(P, entityMeta?.hue) }} />
            <select aria-label="Entity" value={entity} onChange={(e) => setEntity(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, color: P.ink, fontFamily: P.fontSans, cursor: 'pointer' }}>
              {HD.ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.short}</option>)}
            </select>
          </div>
          <IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} size={16} onClick={toggle} title="Toggle theme" style={{ width: 34, height: 34 }} />
          <Avatar name="Manisha Patel" size={30} />
        </div>
      </header>);
  }

  function Placeholder({ title, note }) {
    const P = useP();
    return (
      <div style={{ padding: 20 }}>
        <HDEmpty icon="layout" title={title} body={note || 'This screen is next in the port queue.'} />
      </div>);
  }

  function App() {
    const [route, setRoute] = React.useState(() => location.hash || '#/batches');
    const [entity, setEntityState] = React.useState(() => { try { return localStorage.getItem('hd-entity') || 'thc'; } catch (e) { return 'thc'; } });
    const [collapsed, setCollapsed] = React.useState(false);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const P = useP();

    React.useEffect(() => {
      const h = () => setRoute(location.hash || '#/batches');
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/batches';
      return () => removeEventListener('hashchange', h);
    }, []);
    React.useEffect(() => {
      const h = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
      };
      addEventListener('keydown', h);
      return () => removeEventListener('keydown', h);
    }, []);

    const navigate = React.useCallback((href) => { location.hash = href; }, []);
    const setEntity = React.useCallback((e) => { setEntityState(e); try { localStorage.setItem('hd-entity', e); } catch (err) {} }, []);

    const path = route.replace(/^#/, '').split('?')[0];
    const query = route.includes('?') ? new URLSearchParams(route.split('?')[1]) : new URLSearchParams();
    const ctx = { entity, setEntity, navigate, query, route, path };

    let screen;
    if (path === '/' || path === '/batches') screen = <ScreenBatches {...ctx} />;
    else if (path === '/batches/archive') screen = window.ScreenBatchArchive ? <ScreenBatchArchive {...ctx} /> : <Placeholder title="Batch archive" />;
    else if (path === '/batches/merge') screen = window.ScreenBatchMerge ? <ScreenBatchMerge {...ctx} /> : <Placeholder title="Merge packages" />;
    else if (path === '/compliance') screen = window.ScreenCompliance ? <ScreenCompliance {...ctx} /> : <Placeholder title="Compliance" />;
    else if (path === '/compliance/holds') screen = window.ScreenHolds ? <ScreenHolds {...ctx} /> : <Placeholder title="Holds" />;
    else if (path === '/inbox') screen = window.ScreenInbox ? <ScreenInbox {...ctx} /> : <Placeholder title="Inbox" />;
    else if (path.startsWith('/invoices/')) screen = window.ScreenInvoiceDetail ? <ScreenInvoiceDetail {...ctx} /> : <Placeholder title="Invoice" />;
    else if (path === '/scan') screen = window.ScreenScan ? <ScreenScan {...ctx} /> : <Placeholder title="Scan" />;
    else if (path === '/inventory') screen = window.ScreenInventory ? <ScreenInventory {...ctx} /> : <Placeholder title="Inventory" />;
    else if (path === '/products') screen = window.ScreenProducts ? <ScreenProducts {...ctx} /> : <Placeholder title="Products" />;
    else if (path === '/products/shells') screen = window.ScreenProductShells ? <ScreenProductShells {...ctx} /> : <Placeholder title="Product shells" />;
    else if (path.startsWith('/products/')) screen = window.ScreenProductDetail ? <ScreenProductDetail {...ctx} /> : <Placeholder title="Product" />;
    else if (path === '/ap') screen = window.ScreenAP ? <ScreenAP {...ctx} /> : <Placeholder title="AP" />;
    else if (path === '/credits') screen = window.ScreenCredits ? <ScreenCredits {...ctx} /> : <Placeholder title="Credits" />;
    else if (path === '/credits/new') screen = window.ScreenCreditNew ? <ScreenCreditNew {...ctx} /> : <Placeholder title="New credit memo" />;
    else if (path === '/buyers') screen = window.ScreenBuyers ? <ScreenBuyers {...ctx} /> : <Placeholder title="Buyers" />;
    else if (path === '/scorecards') screen = window.ScreenScorecards ? <ScreenScorecards {...ctx} /> : <Placeholder title="Vendor scorecards" />;
    else if (path.startsWith('/admin/pipeline')) screen = window.ScreenAdminPipeline ? <ScreenAdminPipeline {...ctx} /> : <Placeholder title="Pipeline config" />;
    else if (path.startsWith('/admin/catalog')) screen = window.ScreenAdminCatalog ? <ScreenAdminCatalog {...ctx} /> : <Placeholder title="Master catalog" />;
    else if (path === '/settings/flags') screen = window.ScreenFlags ? <ScreenFlags {...ctx} /> : <Placeholder title="Feature flags" />;
    else screen = <Placeholder title={path.replace('/', '').replace(/\//g, ' · ') || 'Screen'} />;

    return (
      <div style={{ display: 'flex', height: '100%', background: P.canvas, color: P.ink }}>
        <window.HWRail active="batches" />
        <ModuleSidebar route={path} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar route={route} entity={entity} setEntity={setEntity} navigate={navigate} onSearch={() => setSearchOpen(true)} />
          <main style={{ flex: 1, minHeight: 0, overflowY: path === '/batches' || path === '/inbox' ? 'hidden' : 'auto' }}>{screen}</main>
        </div>
        <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} />
        <ToastHost />
      </div>);
  }

  window.PipelineApp = App;
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider><App /></ThemeProvider>);
})();
