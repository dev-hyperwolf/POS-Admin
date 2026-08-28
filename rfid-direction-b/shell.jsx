// ── Direction B — shell, router, and the shared "what RFID added" primitives ─
// The shell is deliberately the Hyperdrive shell you already know: the shared
// 74px rail, a module sidebar, a 56px topbar. Turning RFID on adds NOTHING to
// either navigation layer — that is the whole argument of this direction, so
// the chrome must stay byte-for-byte boring in both states.
;(function () {
  const useP = window.useP;

  // Where each workflow already lives. `app` is the console the screen is
  // lifted from, and is shown as provenance in the page header.
  const NAV_GROUPS = [
    { label: 'Distribution', items: [
      { href: '#/kits/KIT-2291', label: 'Kit build', icon: 'box', hue: 'teal', match: '#/kits' },
      { href: '#/runs', label: 'Runs', icon: 'truck', hue: 'blue', inactive: true },
      { href: '#/manifests', label: 'Manifests', icon: 'receipt', hue: 'violet', inactive: true },
    ] },
    { label: 'Operations', items: [
      { href: '#/inventory', label: 'Inventory', icon: 'package', hue: 'green', match: '#/inventory' },
      { href: '#/products/blue-dream', label: 'Products', icon: 'tag', hue: 'pink', match: '#/products' },
      { href: '#/scan', label: 'Mobile scan', icon: 'scan', hue: 'teal', inactive: true },
    ] },
    { label: 'System', items: [
      { href: '#/settings', label: 'Settings', icon: 'settings', hue: 'neutral', inactive: true },
    ] },
  ];

  const ROUTE_META = {
    '/kits': { crumbs: ['Distribution', 'Kit build'], app: 'Hyperdrive Logistics' },
    '/inventory': { crumbs: ['Operations', 'Inventory'], app: 'METRC Batch Pipeline' },
    '/products': { crumbs: ['Operations', 'Products', 'Batches & traceability'], app: 'METRC Batch Pipeline' },
  };
  function metaFor(path) {
    const key = Object.keys(ROUTE_META).find((k) => path.startsWith(k));
    return ROUTE_META[key] || { crumbs: ['Hyperdrive'], app: 'Hyperdrive' };
  }
  window.RFID_ROUTE_META = metaFor;

  // ── The diff affordance ────────────────────────────────────────────────
  // Everything RFID contributes is marked the same way: an info-toned rule on
  // the leading edge and a small "RFID" tag. It is never accent — accent is
  // reserved for the one primary action on the page.
  window.RfidTag = function RfidTag({ label = 'RFID', title }) {
    const P = useP();
    return (
      <span title={title || 'Added by the RFID module'} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px',
        borderRadius: 99, background: P.infoSoft, color: P.info, border: `1px solid ${P.info}44`,
        fontSize: 10, fontWeight: 700, letterSpacing: '.08em', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>
        <Icon name="zap" size={10} stroke={2.4} />{label}
      </span>);
  };

  // Panel = the Card every screen composes. `isNew` draws the RFID edge.
  window.RfidPanel = function RfidPanel({ title, sub, right, isNew, pad = 16, children, style }) {
    const P = useP();
    return (
      <div style={{
        background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12,
        borderLeft: isNew ? `3px solid ${P.info}` : `1px solid ${P.hairline2}`,
        overflow: 'hidden', ...style }}>
        {(title || right) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface2 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{title}</span>
                {isNew && <window.RfidTag />}
              </div>
              {sub && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{sub}</div>}
            </div>
            <div style={{ flex: 1 }} />
            {right}
          </div>)}
        <div style={{ padding: pad }}>{children}</div>
      </div>);
  };

  // The four reconciliation line states plus rescan, as one vocabulary.
  const STATE_TONE = { correct: 'ok', short: 'blocked', excess: 'warn', 'wrong-product': 'quarantine', rescan: 'neutral' };
  const STATE_LABEL = { correct: 'Correct', short: 'Short', excess: 'Excess', 'wrong-product': 'Wrong product', rescan: 'Rescan' };
  window.RfidStatePill = function RfidStatePill({ state, size = 'sm' }) {
    return <HDPill tone={STATE_TONE[state]} size={size} icon={false} label={STATE_LABEL[state]} />;
  };
  window.RFID_STATE_TONE = STATE_TONE;

  // SKU cell — mono code over the human product name, the pipeline's habit.
  window.RfidSkuCell = function RfidSkuCell({ sku, showBrand }) {
    const P = useP();
    const item = window.RFID_DATA.bySku[sku];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span aria-hidden="true" style={{ width: 6, height: 26, borderRadius: 99, background: P.cat[item ? item.cat : 'other'], flex: '0 0 auto' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{sku}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item ? item.name : '—'}{showBrand && item ? ' · ' + item.brand : ''}
          </div>
        </div>
      </div>);
  };

  // Mono number, the one type treatment every value in this repo gets.
  window.Num = function Num({ children, size = 13.5, color, weight = 500, style }) {
    const P = useP();
    return <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color: color || P.ink, ...style }}>{children}</span>;
  };

  // Delta with sign, tinted by direction. Zero is muted, never green.
  window.Delta = function Delta({ value, size = 13.5 }) {
    const P = useP();
    const c = value === 0 ? P.inkMute : value < 0 ? P.bad : P.warn;
    return <window.Num size={size} color={c} weight={600}>{value > 0 ? '+' : ''}{value}</window.Num>;
  };

  // ── Page header — title, provenance, and the one primary action ─────────
  window.RfidPageHead = function RfidPageHead({ title, sub, app, rfid, action, meta }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{app}</span>
            <span style={{ width: 4, height: 4, borderRadius: 99, background: P.inkFaint }} />
            <span style={{ fontSize: 11.5, color: P.inkMute }}>{rfid ? 'existing screen, RFID folded in' : 'existing screen, today'}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>{title}</h1>
          {sub && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.inkDim, maxWidth: 680, lineHeight: 1.45 }}>{sub}</p>}
          {meta && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>{meta}</div>}
        </div>
        {action && <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
      </div>);
  };

  // ── Module sidebar ─────────────────────────────────────────────────────
  function ModuleSidebar({ route, navigate, collapsed, setCollapsed, rfid }) {
    const P = useP(), HD = window.HD;
    const isActive = (item) => !!item.match && (route === item.match || route.startsWith(item.match + '/'));
    return (
      <aside style={{ width: collapsed ? 64 : 208, flex: `0 0 ${collapsed ? 64 : 208}px`, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${P.hairline2}`, background: P.canvas, transition: 'width .18s ease' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ height: 28, width: 28, borderRadius: 7, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontWeight: 700, fontSize: 13.5 }}>H</div>
          {!collapsed && <span style={{ fontSize: 16, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>Hyperdrive</span>}
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
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
                        <span title="Not part of this study" aria-disabled="true" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, borderRadius: 8, fontSize: 13.5, color: P.inkFaint, cursor: 'not-allowed' }}>
                          <Icon name={item.icon} size={16} stroke={1.8} color={color} />{!collapsed && <span>{item.label}</span>}
                        </span>
                      </li>);
                  }
                  return (
                    <li key={item.label}>
                      <button onClick={() => navigate(item.href)} title={item.label}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, width: '100%', borderRadius: 8, fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans,
                          background: active ? P.surface : 'transparent', boxShadow: active ? P.shadowSm : 'none', color: active ? P.ink : P.inkDim, border: 'none', borderLeft: `2px solid ${active ? P.accent : 'transparent'}` }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = P.surface3; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                        <Icon name={item.icon} size={16} stroke={1.8} color={color} />{!collapsed && <span>{item.label}</span>}
                      </button>
                    </li>);
                })}
              </ul>
            </div>))}
          {!collapsed && (
            <div style={{ margin: '4px 4px 0', padding: '9px 10px', borderRadius: P.r8, background: P.surface, border: `1px solid ${P.hairline2}`, fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>
              {rfid
                ? 'RFID is on. No item was added to the rail or to this sidebar — the work lives where it already lived.'
                : 'Flip the compare switch in the top bar to fold RFID into these same three screens.'}
            </div>)}
        </nav>
        <div style={{ padding: 8, borderTop: `1px solid ${P.hairline2}` }}>
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ width: '100%', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'transparent', border: 'none', color: P.inkMute, cursor: 'pointer' }}>
            <Icon name="chevron-left" size={16} stroke={2} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
          </button>
        </div>
      </aside>);
  }

  // ── Topbar ─────────────────────────────────────────────────────────────
  // Selection is ink-filled, never accent. The compare switch is a study
  // control, so it is set behind its own label and a hairline divider.
  function CompareSwitch({ rfid, setRfid }) {
    const P = useP();
    const opt = (on, label) => (
      <button key={label} aria-pressed={rfid === on} onClick={() => setRfid(on)}
        style={{ height: 26, padding: '0 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600,
          background: rfid === on ? P.ink : 'transparent', color: rfid === on ? P.surface : P.inkDim, transition: 'background .12s, color .12s' }}>{label}</button>);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute }}>Compare</span>
        <div role="group" aria-label="Compare today against RFID" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface3 }}>
          {opt(false, 'Today')}{opt(true, 'With RFID')}
        </div>
      </div>);
  }

  function Palette({ open, onClose, navigate }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const items = [
      { href: '#/kits/KIT-2291', label: 'Kit build · KIT-2291', group: 'Distribution', icon: 'box' },
      { href: '#/inventory', label: 'Inventory', group: 'Operations', icon: 'package' },
      { href: '#/products/blue-dream', label: 'Blue Dream 3.5g · batches', group: 'Operations', icon: 'tag' },
    ];
    React.useEffect(() => { if (open) setQ(''); }, [open]);
    if (!open) return null;
    const filtered = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
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

  function Topbar({ path, rfid, setRfid, onSearch }) {
    const P = useP(), HD = window.HD;
    const { mode, toggle } = window.useTheme();
    const crumbs = metaFor(path).crumbs;
    return (
      <header style={{ height: 56, flex: '0 0 56px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: P.inkDim, whiteSpace: 'nowrap' }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c + i}>
              {i > 0 && <Icon name="chevron-right" size={13} stroke={2} style={{ opacity: .5 }} />}
              <span style={{ color: i === crumbs.length - 1 ? P.ink : P.inkDim }}>{c}</span>
            </React.Fragment>))}
        </nav>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', maxWidth: 380, minWidth: 0, margin: '0 auto' }}>
          <button type="button" onClick={onSearch} aria-label="Open search"
            style={{ width: '100%', height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
            <Icon name="search" size={14} stroke={1.9} />
            <span style={{ flex: 1 }}>Ask anything</span>
            <Icon name="sparkle" size={11} stroke={2} color={HD.hueColor(P, 'violet')} />
            <kbd style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CompareSwitch rfid={rfid} setRfid={setRfid} />
          <span style={{ width: 1, height: 24, background: P.hairline2 }} />
          <IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} size={16} onClick={toggle} title="Toggle theme" style={{ width: 34, height: 34 }} />
          <Avatar name="Rey Alcantara" size={30} />
        </div>
      </header>);
  }

  // ── App ────────────────────────────────────────────────────────────────
  function App() {
    const P = useP();
    const [route, setRoute] = React.useState(() => location.hash || '#/kits/KIT-2291');
    const [collapsed, setCollapsed] = React.useState(false);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [rfid, setRfid] = React.useState(true);

    React.useEffect(() => {
      const h = () => setRoute(location.hash || '#/kits/KIT-2291');
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/kits/KIT-2291';
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
    const path = route.replace(/^#/, '').split('?')[0];
    const ctx = { navigate, route, path, rfid, setRfid, app: metaFor(path).app };

    let screen;
    if (path.startsWith('/kits')) screen = <window.RfidScreenKits {...ctx} />;
    else if (path.startsWith('/inventory')) screen = <window.RfidScreenInventory {...ctx} />;
    else if (path.startsWith('/products')) screen = <window.RfidScreenCommission {...ctx} />;
    else screen = <div style={{ padding: 20 }}><window.EmptyState icon="layout" title="Not in this study" body="Direction B covers three screens: Kit build, Inventory and a product's batch list." /></div>;

    return (
      <div style={{ display: 'flex', height: '100%', background: P.canvas, color: P.ink }}>
        <window.HWRail active="logistics" />
        <ModuleSidebar route={path} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} rfid={rfid} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar path={path} rfid={rfid} setRfid={setRfid} onSearch={() => setSearchOpen(true)} />
          <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{screen}</main>
        </div>
        <Palette open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} />
        <ToastHost />
      </div>);
  }

  /* == WHERE A FAILURE STOPS IN THE RFID STUDY (DIRECTION B) ==
   * CONTAINS. The boundaries sit at shell level, so the app renders whole or shows a
   * named panel -- there is no partial state that reads as a complete screen.
   * !! RENDER AND LIFECYCLE ERRORS ONLY -- not event handlers, not async work. */
  if (!window.ScreenBoundary || !window.CriticalBoundary) {
    try {console.error('[HW boundary] rfid-direction-b/index.html did not load shared/error-boundary.jsx — ' +
      'the RFID study (direction B) is running with NO error boundaries.');} catch (e) {}
  }
  const RfidFrame = window.ScreenBoundary || function RfidFrame(p) {return p.children;};

  window.RfidDirectionBApp = App;
  ReactDOM.createRoot(document.getElementById('root')).render(<ThemeProvider><RfidFrame name="The RFID console"><App /></RfidFrame></ThemeProvider>);
})();
