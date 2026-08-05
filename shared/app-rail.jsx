// ── The Hyperwolf left rail — one component, every app ─────────────────────
// Items come from shared/app-nav.js. An app passes the id it owns as `active`
// and, if it hosts POS routes internally, an `onNav` to handle them locally.
// Dense by design: the whole list has to survive a 700px laptop viewport, and
// when it can't, the rail scrolls itself to the active item on mount.
;(function () {
  const useP = window.useP;

  window.HWRail = function HWRail({ active, onNav }) {
    const P = useP();
    const railRef = React.useRef(null);
    const activeRef = React.useRef(null);

    React.useLayoutEffect(() => {
      const center = () => {
        const rail = railRef.current, btn = activeRef.current;
        if (!rail || !btn) return;
        if (rail.scrollHeight <= rail.clientHeight) { rail.scrollTop = 0; return; }
        rail.scrollTop = Math.max(0, btn.offsetTop - rail.clientHeight / 2 + btn.offsetHeight / 2);
      };
      center();
      addEventListener('resize', center);
      return () => removeEventListener('resize', center);
    }, [active]);

    const Item = ({ item }) => {
      const a = item.id === active;
      const [h, setH] = React.useState(false);
      return (
        <button ref={a ? activeRef : null} title={item.label}
          onClick={() => a ? onNav && onNav(item.id) : window.HW_NAV.go(item, onNav)}
          onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
            position: 'relative', width: '100%', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '7px 3px 6px', background: a ? P.railActive : h ? P.railHover : 'transparent', color: a ? P.railBright : P.railInk,
            border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'background .12s, color .12s', fontFamily: P.fontSans }}>
          {a && <span style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: P.accent, borderRadius: 99 }} />}
          <span style={{ position: 'relative', display: 'flex' }}>
            <Icon name={item.icon} size={19} stroke={a ? 1.95 : 1.7} />
            {item.badge && <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 14, height: 14, padding: '0 3px', background: P.accent, color: P.accentInk, borderRadius: 99, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono }}>{item.badge}</span>}
          </span>
          <span style={{ fontSize: 10, fontWeight: a ? 700 : 500, letterSpacing: '.01em', whiteSpace: 'nowrap' }}>{item.label}</span>
        </button>);
    };

    return (
      <aside ref={railRef} style={{ width: 74, flex: '0 0 74px', background: P.rail, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', gap: 2, overflowY: 'auto', scrollbarWidth: 'none', transition: 'background .2s ease' }}>
        <a href="Hyperwolf.html" title="All Hyperwolf apps" style={{ width: 34, height: 34, borderRadius: 9, background: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7, flex: '0 0 auto' }}>
          <Icon name="logo-w" size={21} color={P.accentInk} />
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', flex: '0 0 auto' }}>{window.HW_NAV.items.map((i) => <Item key={i.id} item={i} />)}</div>
        <div style={{ flex: 1, minHeight: 8 }} />
        <div style={{ width: '100%', flex: '0 0 auto', paddingTop: 4, borderTop: `1px solid ${P.railHair}` }}><Item item={window.HW_NAV.settings} /></div>
      </aside>);
  };
})();
