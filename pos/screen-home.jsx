// ── Home / "Today" hub — default landing for associates & floor managers ─────
//    Answers "what needs me right now?" and routes fast. Skippable by design.
window.HomeScreen = function HomeScreen({ onNav }) {
  const P = useP();
  const HW = window.HW;const fmt = HW.fmt;
  const S = HW.STATS;const a = S.associate;
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── live operational signals ──
  const orders = HW.ORDERS || [];
  const openStages = ['verify', 'pack', 'packing', 'ready'];
  const stageMeta = { verify: { label: 'Incoming', c: P.warn }, pack: { label: 'To pack', c: P.info }, packing: { label: 'Packing', c: P.info }, ready: { label: 'Ready', c: P.good } };
  const byStage = openStages.map((s) => ({ s, ...stageMeta[s], n: orders.filter((o) => o.stage === s).length }));
  const openTotal = orders.filter((o) => openStages.includes(o.stage)).length;
  const wmVerify = orders.filter((o) => o.source === 'Weedmaps' && o.stage === 'verify').length;
  const aging = orders.filter((o) => openStages.includes(o.stage) && parseInt((String(o.age || '').match(/(\d+)\s*h/) || [])[1] || 0, 10) >= 2).length;
  const checkins = (HW.CHECKINS || []).length;

  const prods = HW.PRODUCTS || [];
  const outStock = prods.filter((p) => p.qty === 0).length;
  const lowStock = prods.filter((p) => p.qty > 0 && p.qty < 10).length;
  const wmErrors = prods.filter((p) => p.wm && p.wm.state === 'error').length;
  const wmUnlisted = prods.filter((p) => p.wm && p.wm.state === 'unlisted').length;

  const attention = [
    wmVerify > 0 && { icon: 'shield', c: P.bad, t: `${wmVerify} Weedmaps order${wmVerify > 1 ? 's' : ''} need identity verification`, cta: 'Review', go: 'orders' },
    aging > 0 && { icon: 'clock', c: P.warn, t: `${aging} order${aging > 1 ? 's are' : ' is'} aging in the queue`, cta: 'Open queue', go: 'orders' },
    outStock > 0 && { icon: 'package', c: P.bad, t: `${outStock} SKU${outStock > 1 ? 's are' : ' is'} out of stock`, cta: 'Catalog', go: 'catalog' },
    lowStock > 0 && { icon: 'trending-up', c: P.warn, t: `${lowStock} SKU${lowStock > 1 ? 's' : ''} low on stock (under 10)`, cta: 'Catalog', go: 'catalog' },
    wmErrors > 0 && { icon: 'link', c: P.bad, t: `${wmErrors} product${wmErrors > 1 ? 's' : ''} failing Weedmaps sync`, cta: 'Fix', go: 'catalog' },
    wmUnlisted > 0 && { icon: 'eye-off', c: P.inkDim, t: `${wmUnlisted} product${wmUnlisted > 1 ? 's' : ''} not published to Weedmaps`, cta: 'Catalog', go: 'catalog' },
  ].filter(Boolean);

  const k = (n) => '$' + (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n));

  const Quick = ({ icon, label, sub, to, accent }) =>
    <button onClick={() => onNav(to)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', background: accent ? P.accent : P.surface, border: `1px solid ${accent ? P.accent : P.hairline2}`, borderRadius: P.r14, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, boxShadow: P.shadowSm, transition: 'transform .12s, box-shadow .12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = P.shadowMd; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = P.shadowSm; }}>
      <span style={{ width: 42, height: 42, borderRadius: 11, flex: '0 0 auto', background: accent ? 'rgba(0,0,0,.12)' : P.surface3, color: accent ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} stroke={1.9} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: accent ? P.accentInk : P.ink }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: accent ? 'rgba(0,0,0,.6)' : P.inkDim, marginTop: 1 }}>{sub}</span>
      </span>
    </button>;

  const CardHead = ({ icon, title, right }) => <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
    <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={15} stroke={1.9} /></span>
    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
    {right}
  </div>;

  const Stat = ({ label, value, sub, accent }) => <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderLeft: `3px solid ${accent ? P.accent : P.hairline2}`, borderRadius: P.r10, padding: '11px 13px' }}>
    <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, marginTop: 3 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>{sub}</div>}
  </div>;

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* greeting + shift */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{today}</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', color: P.ink }}>{greet}, {a.name.split(' ')[0]}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: P.goodSoft, borderRadius: P.r999, fontSize: 12.5, fontWeight: 700, color: P.good }}><span style={{ width: 7, height: 7, borderRadius: 99, background: P.good }} />On shift · Register {S.registerId || '101'}</span>
        </div>
      </div>

      {/* quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 20 }}>
        <Quick icon="register" label="New sale" sub="Open the register" to="register" accent />
        <Quick icon="user-plus" label="Check in customer" sub={checkins ? `${checkins} waiting` : 'Start a check-in'} to="register" />
        <Quick icon="board" label="Order queue" sub={`${openTotal} open · ${wmVerify} incoming`} to="orders" />
        <Quick icon="package" label="Catalog" sub={`${outStock + lowStock} stock alerts`} to="catalog" />
      </div>

      {/* AOV goals & leaderboard — pos/screen-aov.jsx. Real personal AOV, real
          rank within this store and across all stores, and (only for a Floor
          Manager) the goal-setting panel directly beneath it. Guarded the
          same way Brands/Cities/etc. are in pos/app.jsx: a dropped script tag
          must name the missing file, not white-screen the dashboard. */}
      <div style={{ marginBottom: 16 }}>
        {window.AovDashboardCard ? <window.AovDashboardCard /> :
          <ErrorState title="AOV goals & leaderboard did not load"
            body="pos/screen-aov.jsx defines window.AovDashboardCard and this page did not get it — check that Hyperwolf POS.html still loads that file." />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* order queue at a glance */}
          <Card padding={0}>
            <CardHead icon="board" title="Order queue" right={<button onClick={() => onNav('orders')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: P.info, fontFamily: P.fontSans }}>Open<Icon name="arrow-right" size={13} stroke={2.2} /></button>} />
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {byStage.map((s) => <button key={s.s} onClick={() => onNav('orders')} style={{ textAlign: 'left', background: P.surface2, border: `1px solid ${P.hairline}`, borderTop: `3px solid ${s.c}`, borderRadius: P.r10, padding: '12px 13px', cursor: 'pointer', fontFamily: P.fontSans }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, marginTop: 6 }}>{s.label}</div>
              </button>)}
            </div>
            {wmVerify > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 16px 16px', padding: '10px 13px', background: P.badSoft, borderRadius: P.r10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 7px', borderRadius: 99 }}>WM</span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{wmVerify} Weedmaps order{wmVerify > 1 ? 's' : ''} awaiting identity verification before fulfilment</span>
              <PBtn variant="secondary" size="sm" onClick={() => onNav('orders')}>Verify</PBtn>
            </div>}
          </Card>

          {/* needs attention */}
          <Card padding={0}>
            <CardHead icon="shield" title="Needs attention" right={attention.length ? <Pill kind="warn" dot>{attention.length}</Pill> : <Pill kind="good" dot>Clear</Pill>} />
            <div style={{ padding: attention.length ? '6px 0' : 16 }}>
              {attention.length === 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: P.inkDim, fontSize: 12.5 }}><Icon name="check-circle" size={16} color={P.good} />Nothing needs you right now — you're all caught up.</div>}
              {attention.map((x, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flex: '0 0 auto', background: P.surface3, color: x.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon} size={15} stroke={1.9} /></span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{x.t}</span>
                <button onClick={() => onNav(x.go)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: P.info, fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{x.cta}<Icon name="chevron-right" size={13} stroke={2.2} /></button>
              </div>)}
            </div>
          </Card>
        </div>

        {/* right rail — today's numbers + check-ins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding={0}>
            <CardHead icon="trending-up" title="Today" />
            <div style={{ padding: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              <Stat label="My sales" value={k(a.netToday)} sub={`${a.ordersToday} orders`} accent />
              <Stat label="My AOV" value={fmt.money0(a.aov.day)} sub={`${a.aovDelta.day >= 0 ? '+' : ''}${a.aovDelta.day}% vs avg`} />
              <Stat label="Store sales" value={k(S.storeNetToday)} sub={`${S.storeOrdersToday} orders`} />
              <Stat label="Check-in line" value={checkins} sub={checkins ? 'waiting' : 'empty'} />
            </div>
          </Card>

          <Card padding={0}>
            <CardHead icon="wallet" title="Register" />
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: P.good }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Drawer open</span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>since 9:02 AM</span>
              </div>
              <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>You're signed in on <b style={{ color: P.ink2 }}>Register {S.registerId || '101'}</b>. Cash counts and close-out live in the drawer controls up top.</div>
              <PBtn variant="secondary" size="md" icon="register" full onClick={() => onNav('register')}>Go to register</PBtn>
            </div>
          </Card>
        </div>
      </div>
    </div>);
};
