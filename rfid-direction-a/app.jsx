// ── RFID shell — rail · module sidebar · topbar · router ─────────────────
// Same three-part chrome as the METRC Batch Pipeline and Engage consoles:
// the shared 74px HWRail, a 208px module sidebar, a 56px topbar with
// breadcrumb / ⌘K / entity / theme / avatar, and hash routing.
;(function () {
  const useP = window.useP;

  const NAV_GROUPS = [
    { label: 'Sessions', items: [
      { href: '#/kits', label: 'Kit verification', icon: 'box', hue: 'teal', match: '#/kits' },
      { href: '#/counts', label: 'Cycle counts', icon: 'scan', hue: 'blue', match: '#/counts' },
    ] },
    { label: 'Tags', items: [
      { href: '#/commission', label: 'Commissioning', icon: 'printer', hue: 'violet', match: '#/commission' },
      { href: '#/registry', label: 'Tag registry', icon: 'barcode', hue: 'pink', match: '#/registry' },
    ] },
    { label: 'System', items: [
      { href: '#/devices', label: 'Devices', icon: 'smartphone', hue: 'neutral', match: '#/devices' },
      { href: '#/audit', label: 'Audit log', icon: 'activity', hue: 'neutral', match: '#/audit' },
      { href: '#/settings', label: 'Settings', icon: 'settings', hue: 'neutral', inactive: true },
    ] },
  ];

  function crumbsFor(path) {
    if (path.startsWith('/kits/')) return ['Sessions', 'Kit verification', 'Session'];
    if (path.startsWith('/kits')) return ['Sessions', 'Kit verification'];
    if (path.startsWith('/counts/')) return ['Sessions', 'Cycle counts', 'Count'];
    if (path.startsWith('/counts')) return ['Sessions', 'Cycle counts'];
    if (path.startsWith('/commission')) return ['Tags', 'Commissioning'];
    if (path.startsWith('/registry')) return ['Tags', 'Tag registry'];
    if (path.startsWith('/devices')) return ['System', 'Devices'];
    if (path.startsWith('/audit')) return ['System', 'Audit log'];
    return ['RFID'];
  }

  function ModuleSidebar({ route, navigate, collapsed, setCollapsed }) {
    const P = useP(), HD = window.HD;
    const isActive = (item) => {
      if (!item.match) return false;
      return route === item.match || route.startsWith(item.match + '/') || route.startsWith(item.match + '?');
    };
    return (
      <aside style={{ width: collapsed ? 64 : 208, flex: `0 0 ${collapsed ? 64 : 208}px`, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${P.hairline2}`, background: P.canvas, transition: 'width .18s ease' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ height: 28, width: 28, borderRadius: 7, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name="scan" size={16} stroke={2.1} />
          </div>
          {!collapsed && <span style={{ fontSize: 16, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>RFID</span>}
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
                        <span title="Not in the pilot scope" aria-disabled="true" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, borderRadius: 8, fontSize: 13.5, color: P.inkFaint, cursor: 'not-allowed' }}>
                          <Icon name={item.icon} size={16} stroke={1.8} color={color} />{!collapsed && <span>{item.label}</span>}
                        </span>
                      </li>);
                  }
                  return (
                    <li key={item.label}>
                      <button onClick={() => navigate(item.href)} title={item.label}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, borderRadius: 8, fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans, width: '100%',
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
        {!collapsed && <ReaderChip />}
        <div style={{ padding: 8, borderTop: `1px solid ${P.hairline2}` }}>
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ width: '100%', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'transparent', border: 'none', color: P.inkMute, cursor: 'pointer' }}>
            <Icon name="chevron-left" size={16} stroke={2} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
          </button>
        </div>
      </aside>);
  }

  // The one device. Persistent, because every screen in this console is
  // meaningless if the handheld is not on the bridge.
  function ReaderChip() {
    const P = useP(), HD = window.HD, D = window.RFID_DATA.DEVICES.reader;
    const ok = HD.tone(P, 'ok');
    return (
      <button onClick={() => { location.hash = '#/devices'; }} style={{ margin: '0 8px 8px', padding: '9px 10px', borderRadius: P.r10, background: P.surface, border: `1px solid ${P.hairline2}`, textAlign: 'left', cursor: 'pointer', fontFamily: P.fontSans, display: 'block', width: 'calc(100% - 16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: ok.fg, flex: '0 0 auto' }} />
          <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{D.id}</span>
        </div>
        <div style={{ marginTop: 3, fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{D.rfPower} dBm · {D.battery}%</div>
      </button>);
  }

  function SearchPalette({ open, onClose, navigate }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const items = React.useMemo(() => NAV_GROUPS.flatMap((g) => g.items.filter((i) => !i.inactive).map((i) => ({ ...i, group: g.label })))
      .concat(window.RFID_DATA.KITS.map((k) => ({ href: `#/kits/${k.id}`, label: `${k.id} · ${k.label}`, group: 'Kit sessions', icon: 'box' })))
      .concat(window.RFID_DATA.COUNTS.map((c) => ({ href: `#/counts/${c.id}`, label: `${c.id} · ${c.room}`, group: 'Cycle counts', icon: 'scan' }))), []);
    const filtered = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
    React.useEffect(() => { if (open) setQ(''); }, [open]);
    if (!open) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
        <div style={{ position: 'relative', width: 520, maxWidth: '92vw', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${P.hairline2}` }}>
            <Field icon="search" size="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything — a kit, a count, a screen…" />
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
            {filtered.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: P.inkMute, textAlign: 'center' }}>No matches.</div>}
            {filtered.map((i) => (
              <button key={i.href} onClick={() => { navigate(i.href); onClose(); }}
                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Icon name={i.icon} size={15} stroke={1.8} color={P.inkMute} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, flex: '0 0 auto' }}>{i.group}</span>
              </button>))}
          </div>
        </div>
      </div>);
  }

  function Topbar({ route, entity, setEntity, onSearch }) {
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
          <button type="button" onClick={onSearch} aria-label="Open search (⌘K)"
            style={{ position: 'relative', width: '100%', height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
            <Icon name="search" size={14} stroke={1.9} />
            <span style={{ flex: 1 }}>Ask anything</span>
            <Icon name="sparkle" size={11} stroke={2} color={HD.hueColor(P, 'violet')} />
            <kbd style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: HD.hueColor(P, entityMeta && entityMeta.hue) }} />
            <select aria-label="Entity" value={entity} onChange={(e) => setEntity(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, color: P.ink, fontFamily: P.fontSans, cursor: 'pointer' }}>
              {HD.ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.short}</option>)}
            </select>
          </div>
          <IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} size={16} onClick={toggle} title="Toggle theme" style={{ width: 34, height: 34 }} />
          <Avatar name="Dara Okafor" size={30} />
        </div>
      </header>);
  }

  function App() {
    const [route, setRoute] = React.useState(() => location.hash || '#/kits');
    const [entity, setEntityState] = React.useState(() => { try { return localStorage.getItem('hd-entity') || 'hwd'; } catch (e) { return 'hwd'; } });
    const [collapsed, setCollapsed] = React.useState(false);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const P = useP();

    React.useEffect(() => {
      const h = () => setRoute(location.hash || '#/kits');
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/kits';
      return () => removeEventListener('hashchange', h);
    }, []);
    React.useEffect(() => {
      const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); } };
      addEventListener('keydown', h);
      return () => removeEventListener('keydown', h);
    }, []);
    React.useEffect(() => { const m = document.getElementById('rfid-main'); if (m) m.scrollTop = 0; }, [route]);

    const navigate = React.useCallback((href) => { location.hash = href; }, []);
    const setEntity = React.useCallback((e) => { setEntityState(e); try { localStorage.setItem('hd-entity', e); } catch (err) {} }, []);

    const path = route.replace(/^#/, '').split('?')[0];
    const ctx = { entity, setEntity, navigate, route, path };

    let screen;
    if (path === '/' || path === '/kits') screen = <ScreenKits {...ctx} />;
    else if (path.startsWith('/kits/')) screen = <ScreenKitSession {...ctx} kitId={path.slice('/kits/'.length)} />;
    else if (path === '/counts') screen = <ScreenCounts {...ctx} />;
    else if (path.startsWith('/counts/')) screen = <ScreenCountDetail {...ctx} countId={path.slice('/counts/'.length)} />;
    else if (path === '/commission') screen = <ScreenCommission {...ctx} />;
    else if (path === '/registry') screen = <ScreenRegistry {...ctx} />;
    else if (path === '/devices') screen = <ScreenDevices {...ctx} />;
    else if (path === '/audit') screen = <ScreenAudit {...ctx} />;
    else screen = <div style={{ padding: 20 }}><EmptyState icon="layout" title="No such screen" body="That route is not part of the RFID console." action={<PBtn size="sm" variant="secondary" onClick={() => navigate('#/kits')}>Back to kit verification</PBtn>} /></div>;

    return (
      <div style={{ display: 'flex', height: '100%', background: P.canvas, color: P.ink }}>
        <window.HWRail active="rfid" />
        <ModuleSidebar route={path} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar route={route} entity={entity} setEntity={setEntity} onSearch={() => setSearchOpen(true)} />
          <main id="rfid-main" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{screen}</main>
        </div>
        <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} />
        <ToastHost />
      </div>);
  }

  /* == WHERE A FAILURE STOPS IN THE RFID STUDY (DIRECTION A) ==
   * CONTAINS. The boundaries sit at shell level, so the app renders whole or shows a
   * named panel -- there is no partial state that reads as a complete screen.
   * !! RENDER AND LIFECYCLE ERRORS ONLY -- not event handlers, not async work. */
  if (!window.ScreenBoundary || !window.CriticalBoundary) {
    try {console.error('[HW boundary] rfid-direction-a/index.html did not load shared/error-boundary.jsx — ' +
      'the RFID study (direction A) is running with NO error boundaries.');} catch (e) {}
  }
  const RfidFrame = window.ScreenBoundary || function RfidFrame(p) {return p.children;};

  window.RfidApp = App;
  ReactDOM.createRoot(document.getElementById('root')).render(<ThemeProvider><RfidFrame name="The RFID console"><App /></RfidFrame></ThemeProvider>);
})();
