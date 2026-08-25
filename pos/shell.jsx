// ── POS Shell — left rail + top context bar ────────────────────────────────
const useP = window.useP,useTheme = window.useTheme;

window.Rail = function Rail({ active, onNav }) {
  return <window.HWRail active={active} onNav={onNav} />;
};

// Store selector
function StoreSelect() {
  const P = useP();const [open, setOpen] = React.useState(false);
  const S = window.HW.STORE;
  return <div style={{ position: 'relative' }}>
    <button onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }} title={`${S.id} · ${S.count} stores`}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good, flex: '0 0 auto' }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', fontFamily: P.fontMono }} title={S.name}>{S.id.split('-').pop()}</span>
      <Icon name="chevron-down" size={14} stroke={2} color={P.inkMute} />
    </button>
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 280, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 6, zIndex: 401 }}>
        <div style={{ padding: '4px 10px 8px', marginBottom: 4, borderBottom: `1px solid ${P.hairline}` }}><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.04em' }}>{S.id} · {S.count} stores</span></div>
        {[S.name + ' · Main', 'Hyperwolf Murrieta', 'Hyperwolf Temecula', 'Hyperwolf Wildomar'].map((n, i) =>
        <button key={n} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', background: i === 0 ? P.surface3 : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: i < 2 ? P.good : P.inkFaint }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, flex: 1 }}>{n}</span>
            {i === 0 && <Icon name="check" size={14} stroke={2.4} color={P.ink} />}
          </button>
        )}
      </div>
    </>}
  </div>;
}

// Theme toggle — compact icon button (was a 64px slider; merged to save space)
window.ThemeToggle = function ThemeToggle() {
  const { mode, toggle } = useTheme();const P = useP();
  const [h, setH] = React.useState(false);
  return <button onClick={toggle} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} title={mode === 'light' ? 'Switch to dark' : 'Switch to light'} style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: h ? P.surface3 : 'transparent', border: 'none', borderRadius: P.r10, color: P.ink2, cursor: 'pointer', transition: 'background .12s' }}>
    <Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} stroke={1.9} />
  </button>;
};

function HeaderViewMenu({ hv, setHv }) {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const opts = [
  { value: 'cards', label: 'Stat cards', icon: 'layout' },
  { value: 'split', label: 'Store + me split', icon: 'trending-up' },
  { value: 'ticker', label: 'Compact ticker', icon: 'minus' }];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} title="Header layout" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: open ? P.surface3 : 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name="layout" size={15} stroke={1.9} />
        <Icon name="chevron-down" size={12} stroke={2.2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 196, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 6, zIndex: 401 }}>
          <div style={{ padding: '4px 9px 7px', fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Header layout</div>
          {opts.map((o) => {
            const a = o.value === hv;
            return (
              <button key={o.value} onClick={() => {setHv(o.value);setOpen(false);}} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 9px', background: a ? P.surface3 : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <Icon name={o.icon} size={14} stroke={1.9} color={a ? P.ink : P.ink2} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{o.label}</span>
                {a && <Icon name="check" size={14} stroke={2.6} color={P.ink} />}
              </button>);
          })}
        </div>
      </>}
    </div>);
}

// Receipt printer status. Red dot means the printer needs attention — the most
// common reason a sale "completes" but nothing comes out of the machine.
function PrinterStatus() {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const ok = false; // demo: out of paper
  return <div style={{ position: 'relative' }}>
    <IconBtn icon="printer" badge={!ok} badgeColor={P.bad} title={ok ? 'Receipt printer — ready' : 'Receipt printer — needs attention'} onClick={() => setOpen((o) => !o)} />
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 286, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 12, zIndex: 401 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <Icon name="printer" size={15} stroke={1.9} color={P.ink2} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Receipt printer</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: ok ? P.good : P.bad }}><span style={{ width: 6, height: 6, borderRadius: 99, background: ok ? P.good : P.bad }} />{ok ? 'Ready' : 'Low paper'}</span>
        </div>
        <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden', marginBottom: 10 }}>
          {[['Model', 'Epson TM-m30'], ['Connection', 'Network · 192.168.4.21'], ['Station', 'Front Counter 1'], ['Last receipt', '2 min ago']].map(([k, v], i) =>
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 11px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <span style={{ fontSize: 11.5, color: P.inkDim }}>{k}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{v}</span>
            </div>)}
        </div>
        {!ok && <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: P.badSoft, borderRadius: P.r10, marginBottom: 10 }}>
          <Icon name="shield" size={13} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Paper roll is nearly out. Replace it before the next rush — sales still complete, but receipts will not print.</span>
        </div>}
        <div style={{ display: 'flex', gap: 7 }}>
          <PBtn variant="secondary" size="sm" icon="receipt" full onClick={() => setOpen(false)}>Reprint last</PBtn>
          <PBtn variant="secondary" size="sm" icon="refresh" onClick={() => setOpen(false)}>Test</PBtn>
        </div>
      </div>
    </>}
  </div>;
}

window.TopBar = function TopBar({ user, onMode, mode }) {
  const P = useP();
  const S = window.HW.STATS;const a = S.associate;
  const m0 = window.HW.fmt.money0;
  const k = (n) => '$' + (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n));
  const [hv, setHv] = React.useState(() => {try {const v = localStorage.getItem('hw-pos-hv');return ['cards', 'split', 'ticker'].includes(v) ? v : 'cards';} catch {return 'cards';}});
  React.useEffect(() => {try {localStorage.setItem('hw-pos-hv', hv);} catch {}}, [hv]);

  const Fig = ({ label, value, accent }) =>
  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: accent ? P.accentText : P.ink, fontFamily: P.fontMono }}>{value}</span>
    </span>;
  const dot = <span style={{ color: P.inkFaint }}>·</span>;
  const StatPill = ({ label, value, accent }) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: accent ? P.accent : P.inkFaint }} />
      <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{value}</span>
    </span>;

  const trend = a.aovDelta.day;
  const trendEl = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 700, color: trend >= 0 ? P.good : P.bad, fontFamily: P.fontMono }}><Icon name={trend >= 0 ? 'trending-up' : 'trending-up'} size={11} stroke={2.2} />{trend >= 0 ? '+' : ''}{trend}%</span>;

  // Mini stat card: icon + label + big value + sub
  const StatCard = ({ icon, label, value, sub, accent }) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 8px', background: P.surface2, border: `1px solid ${accent ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, whiteSpace: 'nowrap', flex: '0 1 auto', minWidth: 0, overflow: 'hidden' }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, background: accent ? P.accent : P.surface3, color: accent ? P.accentInk : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={13} stroke={1.9} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{value}</span><span style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono }}>{sub}</span></span>
      </span>
    </span>;

  // Grouped figures (store cluster, me cluster) for the split view
  const Group = ({ title, children, accent }) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: accent ? P.accentText : P.inkMute }}>{title}</span>
      {children}
    </span>;

  let mid = null;
  if (hv === 'cards') {
    mid = <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, minWidth: 0, overflow: 'hidden', flex: '1 1 auto' }}>
      <StatCard icon="shop" label="Store today" value={k(S.storeNetToday)} sub={`${S.storeOrdersToday} ord`} />
      <StatCard icon="user" label={a.name.split(' ')[0] + ' today'} value={k(a.netToday)} sub={`${a.ordersToday} ord`} accent />
      <StatCard icon="trending-up" label="My AOV" value={m0(a.aov.day)} sub={`${trend >= 0 ? '+' : ''}${trend}%`} />
    </div>;
  } else if (hv === 'split') {
    mid = <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
      <Group title="Store"><Fig label="net" value={k(S.storeNetToday)} />{dot}<Fig label="ord" value={S.storeOrdersToday} /></Group>
      <span style={{ width: 1, height: 22, background: P.hairline2 }} />
      <Group title={a.name.split(' ')[0]} accent><Fig label="net" value={k(a.netToday)} accent />{dot}<Fig label="ord" value={a.ordersToday} />{dot}<Fig label="aov" value={m0(a.aov.day)} />{trendEl}</Group>
    </div>;
  } else if (hv === 'ticker') {
    mid = <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 8 }}><Fig label="Store" value={k(S.storeNetToday)} />{dot}<Fig label="Me" value={k(a.netToday)} accent />{dot}<Fig label="AOV" value={m0(a.aov.day)} />{trendEl}</div>;
  }

  return (
    <header style={{ height: 60, flex: '0 0 60px', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', background: P.surface, borderBottom: `1px solid ${P.hairline2}`, transition: 'background .2s ease', position: 'relative', zIndex: 60, minWidth: 0 }}>
      <StoreSelect />
      {mid}
      <div style={{ flex: 1 }} />
      <window.DrawerControls />
      <div style={{ width: 1, height: 26, background: P.hairline2, margin: '0 2px' }} />
      <HeaderViewMenu hv={hv} setHv={setHv} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <window.PriceCheck />
        <IconBtn icon="search" title="Search anything" />
        <window.OpenTickets />
        <PrinterStatus />
        <ThemeToggle />
      </div>
      <div style={{ width: 1, height: 26, background: P.hairline2, margin: '0 2px' }} />
      <button style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 4px 4px', background: 'transparent', border: 'none', borderRadius: P.r10, cursor: 'pointer', minWidth: 0, flex: '0 1 auto' }}>
        <Avatar name={user.name} size={32} />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
          <span style={{ fontSize: 11.5, color: P.inkDim, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.role}</span>
        </span>
        <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} style={{ flex: '0 0 auto' }} />
      </button>
    </header>);

};

Object.assign(window, {});