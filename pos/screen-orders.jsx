// ── Orders screen — fulfillment queue (kanban) ─────────────────────────────
const useP = window.useP;

const STAGES = [
{ id: 'verify', label: 'Verification Pending', color: (P) => P.neutral },
{ id: 'pack', label: 'Need to Pack', color: (P) => '#C24EA8' },
{ id: 'packing', label: 'Packing in Progress', color: (P) => P.info },
{ id: 'ready', label: 'Ready for Pickup', color: (P) => P.good },
{ id: 'done', label: 'Completed', color: (P) => P.inkMute }];


window.OrdersScreen = function OrdersScreen({ onStartSale }) {
  const P = useP();
  const [tab, setTab] = React.useState('pickup');
  const [wmMapOpen, setWmMapOpen] = React.useState(false);
  const [view, setView] = React.useState('dispatch'); // delivery: dispatch | regions | drivers
  const [showCheckIn, setShowCheckIn] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [q, setQ] = React.useState('');
  // Local overrides for order ↔ check-in binding (what the associate resolved
  // this shift). bindOf() reads the engine's answer unless a human changed it.
  const [binds, setBinds] = React.useState({});
  const [matching, setMatching] = React.useState(null); // order awaiting a manual match
  const bindOf = (o) => binds[o.id] || window.HW.bindFor(o);
  const setBind = (id, b) => setBinds((prev) => ({ ...prev, [id]: b }));
  const confirmBind = (o) => setBind(o.id, { ...bindOf(o), state: 'auto', conf: 100, confirmedBy: 'Manisha Saini' });
  const bindTo = (o, checkinId, guest) => setBind(o.id, { state: 'auto', conf: 100, checkinId, guest, signals: ['handle'], boundBy: 'Manisha Saini' });
  const orders = window.HW.ORDERS;
  const checkins = window.HW.CHECKINS;
  const isDelivery = tab === 'delivery';
  const channelOf = (o) => isDelivery ? o.channel === 'Delivery' : o.channel === 'Store';
  const visible = orders.filter((o) => channelOf(o) && (!q || (o.name + o.id).toLowerCase().includes(q.toLowerCase())));
  // An order with no owner never enters the fulfilment flow — it waits in the lane.
  const unowned = visible.filter((o) => bindOf(o).state === 'none');
  const owned = visible.filter((o) => bindOf(o).state !== 'none');

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      <SectionHead level={1} eyebrow="Fulfillment" title="Order Queue"
      subtitle="Live pickup & delivery orders across the floor"
      action={<div style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" icon="link" size="md" onClick={() => setWmMapOpen(true)}>WM status map</PBtn>
          <PBtn variant="secondary" icon="sliders" size="md">Filters</PBtn>
          <PBtn variant="accent" icon="plus" size="md" onClick={onStartSale}>New Sale</PBtn>
        </div>} />
      {wmMapOpen && <WmStatusMapModal onClose={() => setWmMapOpen(false)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Seg value={tab} onChange={setTab} size="lg" options={[
        { value: 'pickup', label: 'Pickup Orders', icon: 'shop', color: P.warn, count: orders.filter((o) => o.channel === 'Store').length },
        { value: 'delivery', label: 'Delivery Orders', icon: 'truck', color: P.info, count: orders.filter((o) => o.channel === 'Delivery').length }]
        } />
        {/* Delivery gets its own layout options — board / list / map */}
        {isDelivery &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.08em', textTransform: 'uppercase' }}>View</span>
            <Seg value={['regions', 'drivers'].includes(view) ? view : 'dispatch'} onChange={setView} size="md" options={[
          { value: 'dispatch', label: 'Dispatch', icon: 'list' },
          { value: 'regions', label: 'Regions', icon: 'map' },
          { value: 'drivers', label: 'Drivers', icon: 'truck' }]
          } />
          </div>}
        <div style={{ flex: 1 }} />
      </div>

      {/* Check-in list — pickup only (people physically in store) */}
      {!isDelivery && <CheckInStrip checkins={checkins} onStartSale={onStartSale} onNewCheckIn={() => setShowCheckIn(true)} />}

      {/* Order-queue filters — deliberately sit directly above the queue they
            filter, not above the check-in list, which they do not touch. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '10px 13px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}><Icon name="filter" size={13} stroke={2} />Filter the queue</span>
        <div style={{ width: 260 }}><Field icon="search" placeholder="Search order # or customer…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" /></div>
        <DateRange />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{visible.length} order{visible.length === 1 ? '' : 's'} shown below</span>
        {q && <PBtn variant="ghost" size="xs" icon="x" onClick={() => setQ('')}>Clear</PBtn>}
      </div>

      {/* Pickup → board. Delivery → board / list / map */}
      {!isDelivery ?
      <>
          {unowned.length > 0 && <UnownedBanner items={unowned} onResolve={() => setMatching(unowned[0])} />}
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(286px, 1fr)', gap: 14, overflowX: 'auto', paddingBottom: 8, marginTop: 4 }}>
            {unowned.length > 0 && <MatchLane items={unowned} bindOf={bindOf} onBind={bindTo} onMatch={setMatching} onOpen={setDetail} />}
            {STAGES.map((st) => {
            const items = owned.filter((o) => o.stage === st.id);
            return <Column key={st.id} stage={st} items={items} onStartSale={onStartSale} onOpen={setDetail} bindOf={bindOf} onConfirm={confirmBind} onMatch={setMatching} />;
          })}
          </div>
        </> :
      view === 'regions' ? <RegionsView items={visible} onStartSale={onStartSale} onOpen={setDetail} /> :
      view === 'drivers' ? <DriversView items={visible} onStartSale={onStartSale} onOpen={setDetail} /> :
      <DispatchView items={visible} onStartSale={onStartSale} onOpen={setDetail} />}

      {matching && <MatchSheet o={matching} bind={bindOf(matching)} onBind={(cid, guest) => {bindTo(matching, cid, guest);setMatching(null);}} onClose={() => setMatching(null)} />}

      {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} onCheckIn={({ start }) => {setShowCheckIn(false);if (start) onStartSale();}} />}
      {detail && <OrderDetails o={detail} onClose={() => setDetail(null)} />}
    </div>);

};

function CheckInStrip({ checkins, onStartSale, onNewCheckIn }) {
  const P = useP();
  return (
    <Card padding={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="user-check" size={16} stroke={1.9} color={P.ink2} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Check-in List</span>
          <Pill kind="accent">{checkins.length} waiting</Pill>
        </div>
        <div style={{ width: 280 }}><Field icon="search" placeholder="Search customer by e-mail or phone" size="sm" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: 14, overflowX: 'auto' }}>
        {checkins.map((c) => <CheckInCard key={c.id} c={c} onStartSale={onStartSale} />)}
        <button onClick={onNewCheckIn} style={{ flex: '0 0 auto', width: 200, border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r12, background: 'transparent', color: P.inkDim, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 18, fontFamily: P.fontSans }}>
          <span style={{ width: 34, height: 34, borderRadius: 99, background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-plus" size={17} stroke={1.9} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>New check-in</span>
        </button>
      </div>
    </Card>);

}

function CheckInCard({ c, onStartSale }) {
  const P = useP();
  const claimed = !!c.claimedBy;
  const [guests, setGuests] = React.useState(c.guests || []);
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState('from-waiting');
  return (
    <div style={{ flex: '0 0 auto', width: 262, border: `1px solid ${claimed ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, overflow: 'visible', background: P.surface, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar name={c.name} size={36} crown={c.member} />
          {guests.slice(0, 2).map((g, i) => <span key={i} style={{ marginLeft: -11, borderRadius: 99, boxShadow: `0 0 0 2px ${P.surface}` }}><Avatar name={window.guestName ? window.guestName(g) : g} size={26} /></span>)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>{c.name}{guests.length > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: P.ink2, background: P.surface3, padding: '1px 6px', borderRadius: 99 }}>+{guests.length}</span>}</div>
          {c.second && <span style={{ fontSize: 10, fontWeight: 600, color: P.warn, background: P.warnSoft, padding: '1px 6px', borderRadius: 99 }}>Second visit</span>}
        </div>
        <IconBtn icon="x" size={14} style={{ width: 28, height: 28 }} />
      </div>
      <div style={{ padding: '0 13px 9px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 10px', fontSize: 11.5 }}>
        {[['Type', c.type], ['Method', c.delivery], ['Wait', c.wait]].map(([k, v]) =>
        <React.Fragment key={k}><span style={{ color: P.inkMute }}>{k}</span><span style={{ color: P.ink2, fontWeight: 600, textAlign: 'right', fontFamily: k === 'Wait' ? P.fontMono : P.fontSans }}>{v}</span></React.Fragment>
        )}
      </div>
      {/* Party — add guest to this existing check-in */}
      <div style={{ padding: '0 13px 11px' }}>
        <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', background: open ? P.accentSoft : P.surface2, border: `1px solid ${open ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, color: P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="user-plus" size={13} stroke={2} />{guests.length > 0 ? `Party of ${1 + guests.length} · edit` : 'Add guest to check-in'}
        </button>
      </div>
      <button data-hw-i onClick={onStartSale} style={{ width: '100%', padding: '10px', background: claimed ? P.surface3 : P.ink, color: claimed ? P.ink : P.surface, border: 'none', borderTop: `1px solid ${P.hairline}`, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: '0 0 11px 11px' }}>
        {claimed ? <><Icon name="check" size={14} stroke={2.5} />Claimed by {c.claimedBy.split(' ')[0]}</> : <>Claim & start sale<Icon name="arrow-right" size={14} stroke={2.2} /></>}
      </button>

      {open &&
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fade .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 94vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <Avatar name={c.name} size={32} crown={c.member} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{c.name.split(' ')[0]}’s party</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Check-in · {c.type} · {c.wait}</div></div>
              <IconBtn icon="x" size={16} onClick={() => setOpen(false)} />
            </div>
            <p style={{ margin: '0 0 13px', fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>Add guests to this check-in. Guests are tracked as referrals; the sale stays on {c.name.split(' ')[0]}.</p>
            <GuestEditor primaryName={c.name} guests={guests} onChange={setGuests} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><PBtn variant="accent" size="md" icon="check" onClick={() => setOpen(false)}>Done</PBtn></div>
          </div>
        </div>
      }
    </div>);

}

function Column({ stage, items, onStartSale, onOpen, bindOf, onConfirm, onMatch }) {
  const P = useP();
  const c = stage.color(P);
  const sum = items.reduce((s, o) => s + o.total, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 11px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{stage.label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, background: P.surface3, padding: '1px 7px', borderRadius: 99 }}>{items.length}</span>
        <div style={{ flex: 1 }} />
        {sum > 0 && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{window.HW.fmt.money0(sum)}</span>}
      </div>
      <div style={{ background: P.bg2, border: `1px solid ${P.hairline}`, borderRadius: P.r14, borderTop: `2px solid ${c}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, flex: 1 }}>
        {items.length === 0 && <div style={{ padding: '30px 8px', textAlign: 'center', color: P.inkFaint, fontSize: 12.5 }}>No orders</div>}
        {items.map((o) => <OrderCard key={o.id} o={o} onStartSale={onStartSale} onOpen={onOpen} bindOf={bindOf} onConfirm={onConfirm} onMatch={onMatch} />)}
      </div>
    </div>);

}

// ── Order ↔ check-in ownership ────────────────────────────────────────────
// One strip per card answering the only question that stops the floor turning
// into chaos: whose order is this? Green = matched. Amber = matched, needs a
// nod. Red = nobody, and the card cannot move.
function BindStrip({ bind, o, onConfirm, onMatch }) {
  const P = useP();
  const ci = bind.checkinId ? window.HW.checkinById(bind.checkinId) : null;
  const who = bind.guest || (ci ? ci.name : null);
  const stop = (e) => e.stopPropagation();
  const sig = (bind.signals || []).map((s) => window.HW.SIGNAL_LABEL[s] || s).join(' + ');

  if (bind.self) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, paddingTop: 8, borderTop: `1px solid ${P.hairline}`, fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>
        <Icon name="user-check" size={12} stroke={1.9} color={P.good} />own account · signed in
      </div>);
  }

  const tone = bind.state === 'auto' ? P.good : bind.state === 'confirm' ? P.warn : P.bad;
  const soft = bind.state === 'auto' ? P.goodSoft : bind.state === 'confirm' ? P.warnSoft : P.badSoft;
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', background: soft, border: `1px solid ${tone}55`, borderRadius: P.r10 }}>
        {who ? <Avatar name={who} size={24} /> :
        <span style={{ width: 24, height: 24, borderRadius: 99, border: `1.5px dashed ${P.hairline3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, color: P.inkMute, flex: '0 0 auto' }}>?</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: bind.state === 'none' ? P.bad : P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bind.state === 'none' ? 'No owner' : who}{bind.state === 'confirm' ? ' ?' : ''}
          </span>
          <span style={{ display: 'block', fontSize: 10, color: P.inkDim, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bind.state === 'none' ? bind.why : bind.guest ? `guest in ${ci ? ci.name.split(' ')[0] : 'a'}’s party · ${sig}` : `${sig} · in store ${ci ? ci.wait.replace(/^0h /, '') : ''}`}
          </span>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: tone, fontFamily: P.fontMono, flex: '0 0 auto' }}>{bind.conf}</span>
        {bind.state === 'auto' && <Icon name="check-circle" size={13} stroke={2.2} color={P.good} />}
      </div>
      {bind.state === 'confirm' &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }} onClick={stop}>
          <PBtn variant="ghost" size="xs" onClick={() => onMatch && onMatch(o)}>Not them</PBtn>
          <div style={{ flex: 1 }} />
          <PBtn variant="accent" size="xs" icon="check" onClick={() => onConfirm && onConfirm(o)}>Yes, that’s them</PBtn>
        </div>}
      {bind.state === 'none' &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }} onClick={stop}>
          <Pill kind="bad" dot>blocked from packing</Pill>
          <div style={{ flex: 1 }} />
          <PBtn variant="accent" size="xs" icon="link" onClick={() => onMatch && onMatch(o)}>Match…</PBtn>
        </div>}
    </div>);

}

// The lane. Not a stage — a holding pen with candidates resolvable in one tap.
function MatchLane({ items, bindOf, onBind, onMatch, onOpen }) {
  const P = useP();
  const sum = items.reduce((s, o) => s + o.total, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }} data-tour="match-lane">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 11px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: P.bad }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Needs match</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', fontFamily: P.fontMono, background: P.bad, padding: '1px 7px', borderRadius: 99 }}>{items.length}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{window.HW.fmt.money0(sum)}</span>
      </div>
      <div style={{ background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r14, borderTop: `2px solid ${P.bad}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: P.warn, fontWeight: 600, lineHeight: 1.45, padding: '0 2px' }}>Not a stage — orders wait here until a person owns them. They cannot be packed.</div>
        {items.map((o) => {
          const bind = bindOf(o);
          const cands = (bind.candidates || []).map((c) => ({ ...c, ci: window.HW.checkinById(c.checkinId) })).filter((c) => c.ci);
          return (
            <div key={o.id} onClick={() => onOpen && onOpen(o)} title="Open the order" style={{ background: P.surface, border: `1px solid ${P.bad}`, borderRadius: P.r12, padding: '11px 12px', boxShadow: P.shadowSm, cursor: 'pointer', transition: 'box-shadow .14s, transform .14s' }}
              onMouseEnter={(e) => {e.currentTarget.style.boxShadow = P.shadowMd;e.currentTarget.style.transform = 'translateY(-1px)';}}
              onMouseLeave={(e) => {e.currentTarget.style.boxShadow = P.shadowSm;e.currentTarget.style.transform = 'none';}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, background: P.surface3, padding: '2px 7px', borderRadius: 6 }}>#{o.id}</span>
                <div style={{ flex: 1 }} />
                {o.source === 'Weedmaps' ? <WmOrderTag /> : <Pill kind="ghost">{o.source}</Pill>}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{o.items} item{o.items > 1 ? 's' : ''} · {o.age}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{window.HW.fmt.money(o.total)}</span>
              </div>
              <div style={{ fontSize: 10, color: P.bad, lineHeight: 1.4, margin: '7px 0 0' }}>{bind.why}</div>
              <div onClick={(e) => e.stopPropagation()}>
              {cands.length > 0 ? <>
                <Eyebrow style={{ margin: '10px 0 5px' }}>Best candidates</Eyebrow>
                {cands.map((c, i) =>
              <div key={c.checkinId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 7px', marginBottom: 5, background: i === 0 ? P.surface : P.surface2, border: `1px solid ${i === 0 ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, boxShadow: i === 0 ? `0 0 0 2px ${P.accentSoft}` : 'none' }}>
                    <Avatar name={c.ci.name} size={24} crown={c.ci.member} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ci.name}</span>
                      <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>in store {c.ci.wait.replace(/^0h /, '')} · no order yet</span>
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: c.conf >= 50 ? P.warn : P.inkMute, fontFamily: P.fontMono }}>{c.conf}</span>
                    <PBtn variant={i === 0 ? 'accent' : 'secondary'} size="xs" onClick={() => onBind(o, c.checkinId)}>Bind</PBtn>
                  </div>
              )}
              </> :
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '9px 0 0', padding: '8px 9px', background: P.infoSoft, borderRadius: P.r10 }}>
                <Icon name="info" size={12} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Nobody in the room is a plausible match — search the customer book or check them in from the order.</span>
              </div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <PBtn variant="secondary" size="xs" icon="search" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onMatch(o)}>Search</PBtn>
                <PBtn variant="soft" size="xs" icon="user-plus" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onMatch(o)}>Check in &amp; bind</PBtn>
              </div>
              </div>
            </div>);
        })}
      </div>
    </div>);

}

function UnownedBanner({ items, onResolve }) {
  const P = useP();
  const sum = items.reduce((s, o) => s + o.total, 0);
  const oldest = items.reduce((a, o) => o.age > a ? o.age : a, '0h 0m');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14, padding: '11px 15px', background: P.surface, border: `1px solid ${P.warn}`, borderLeft: `4px solid ${P.warn}`, borderRadius: P.r12 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: P.warnSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="shield" size={16} stroke={2} color={P.warn} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{items.length} order{items.length > 1 ? 's' : ''} on the floor with no owner</span>
        <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, marginTop: 2 }}>Oldest has been waiting {oldest} · {window.HW.fmt.money(sum)} of product can’t be packed until each one is matched to a check-in.</span>
      </span>
      <PBtn variant="accent" size="sm" icon="link" onClick={onResolve}>Resolve</PBtn>
    </div>);

}

// Manual mapping — the fallback when the engine can't decide. Bind to someone
// in the room, to any customer in the book, or check the person in from here.
function MatchSheet({ o, bind, onBind, onClose }) {
  const P = useP();
  const [q, setQ] = React.useState('');
  const [tabv, setTabv] = React.useState('room');
  const wm = window.HW.WM_ORDER[o.id] || {};
  const checkins = window.HW.CHECKINS;
  const scored = (ci) => {const c = (bind.candidates || []).find((x) => x.checkinId === ci.id);return c ? c.conf : 5;};
  const inRoom = checkins.slice().sort((a, b) => scored(b) - scored(a));
  const ql = q.trim().toLowerCase();
  const book = ql ? window.HW.MEMBERS.filter((m) => (m.name + m.email + m.phone).toLowerCase().includes(ql)) : window.HW.MEMBERS.slice(0, 5);
  // Guests already on record inside a party are bindable people too.
  const partyGuests = [];
  checkins.forEach((ci) => (ci.guests || []).forEach((g) => partyGuests.push({ ci, name: window.guestName ? window.guestName(g) : g })));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'fade .15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: '#1F5FC0', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="link" size={15} stroke={2} color="#fff" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>Who is this order for?</span>
            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>#{o.id} · {o.name} · {o.items} item{o.items > 1 ? 's' : ''} · {window.HW.fmt.money(o.total)}</span>
          </span>
          <IconBtn icon="x" size={17} onClick={onClose} />
        </div>

        <div style={{ display: 'flex', gap: 9, padding: '12px 18px 0', alignItems: 'center' }}>
          <Seg value={tabv} onChange={setTabv} size="sm" options={[{ value: 'room', label: 'In the store', icon: 'users', count: checkins.length }, { value: 'book', label: 'All customers', icon: 'search' }]} />
          <div style={{ flex: 1 }} />
          {bind.why && <span style={{ fontSize: 11.5, color: P.bad, fontFamily: P.fontMono }}>{bind.conf} · auto-match failed</span>}
        </div>

        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 420, overflowY: 'auto' }}>
          {wm.contact &&
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
              {[['Handle', wm.contact.name], ['Phone', wm.contact.phone || '— none sent —'], ['E-mail', wm.contact.email]].map(([k, v]) =>
            <span key={k}><span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{k}</span><span style={{ display: 'block', fontSize: 11.5, color: v && v.indexOf('none') < 0 ? P.ink2 : P.bad, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span></span>
            )}
            </div>}

          {tabv === 'room' ? <>
            <Eyebrow>People in the store · ranked by match</Eyebrow>
            {inRoom.map((ci) => {const s = scored(ci);const top = s >= 40;
              return (
                <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: P.surface, border: `1px solid ${top ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, boxShadow: top ? `0 0 0 2px ${P.accentSoft}` : 'none' }}>
                  <Avatar name={ci.name} size={30} crown={ci.member} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{ci.name}</span>
                    <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>in store {ci.wait.replace(/^0h /, '')} · {ci.type}{(ci.guests || []).length ? ` · party of ${1 + ci.guests.length}` : ''}</span>
                  </span>
                  <span style={{ width: 64 }}><BarMeter value={s / 100} color={s >= 50 ? P.warn : P.neutral} height={4} /></span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: s >= 50 ? P.warn : P.inkMute, fontFamily: P.fontMono, width: 22, textAlign: 'right' }}>{s}</span>
                  <PBtn variant={top ? 'accent' : 'secondary'} size="xs" onClick={() => onBind(ci.id)}>Bind</PBtn>
                </div>);
            })}
            {partyGuests.length > 0 && <>
              <Eyebrow style={{ marginTop: 4 }}>Guests inside a party · bindable too</Eyebrow>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {partyGuests.map((g) =>
                <button key={g.ci.id + g.name} onClick={() => onBind(g.ci.id, g.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, fontSize: 11.5, fontWeight: 600, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
                    <Avatar name={g.name} size={18} />{g.name}<span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>· {g.ci.name.split(' ')[0]}’s party</span>
                  </button>
                )}
              </div>
            </>}
          </> : <>
            <Field icon="search" placeholder="Search every customer by name, e-mail or phone…" size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
            {book.map((m) =>
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
                <Avatar name={m.name} size={30} crown={m.member} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{m.name}</span>
                  <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.points} pts · not in the store</span>
                </span>
                <PBtn variant="secondary" size="xs" icon="user-check" onClick={() => onBind(null, m.name)}>Check in &amp; bind</PBtn>
              </div>
            )}
            {book.length === 0 && <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No customer matches “{q}”</div>}
          </>}

          <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Binding writes <b style={{ fontFamily: P.fontMono }}>{o.name}</b> onto that customer’s record, so every future order from this handle matches silently. The lane shrinks every time you use it.</span>
          </div>
        </div>
      </div>
    </div>);

}

function OrderCard({ o, onStartSale, onOpen, bindOf, onConfirm, onMatch }) {
  const P = useP();
  const stale = o.age.startsWith('2') || o.age.includes('h') && parseInt(o.age) >= 2;
  const wm = o.source === 'Weedmaps' ? window.HW.WM_ORDER[o.id] : null;
  const bind = bindOf ? bindOf(o) : window.HW.bindFor(o);
  return (
    <div onClick={() => onOpen ? onOpen(o) : onStartSale()} style={{ background: P.surface, border: `1px solid ${wm && wm.level === 'high' ? P.bad : P.hairline2}`, borderRadius: P.r12, padding: '12px 13px', cursor: 'pointer', boxShadow: P.shadowSm, transition: 'box-shadow .14s, transform .14s' }}
    onMouseEnter={(e) => {e.currentTarget.style.boxShadow = P.shadowMd;e.currentTarget.style.transform = 'translateY(-1px)';}}
    onMouseLeave={(e) => {e.currentTarget.style.boxShadow = P.shadowSm;e.currentTarget.style.transform = 'none';}}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, background: P.surface3, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>#{o.id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {wm && wm.level === 'high' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#fff', background: P.bad, padding: '2px 7px', borderRadius: 99 }}><Icon name="shield" size={10} stroke={2.4} />Review</span>}
          {wm ? <WmOrderTag /> : o.badge === 'Member' ? <Pill kind="accent" icon="crown" title="Loyalty member — earns points and member pricing">Member</Pill> : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <Avatar name={o.name} size={30} crown={o.badge === 'Member'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute }}>{o.items} item{o.items > 1 ? 's' : ''}</div>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{window.HW.fmt.money(o.total)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px', fontSize: 11.5, color: P.inkDim, paddingTop: 9, borderTop: `1px solid ${P.hairline}` }}>
        <span>Source <b style={{ color: P.ink2, fontWeight: 600 }}>{o.source}</b></span>
        <span style={{ textAlign: 'right' }}>Pay <b style={{ color: P.ink2, fontWeight: 600 }}>{o.pay}</b></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, fontSize: 11.5, color: stale ? P.warn : P.inkMute, fontFamily: P.fontMono }}>
        <Icon name="clock" size={12} stroke={1.9} />{o.age}{stale && <span style={{ marginLeft: 'auto', color: P.warn, fontWeight: 600 }}>● aging</span>}
      </div>
      <BindStrip bind={bind} o={o} onConfirm={onConfirm} onMatch={onMatch} />
    </div>);

}

const stageMeta = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

// Weedmaps → our order-status mapping reference (opened from the queue header).
function WmStatusMapModal({ onClose }) {
  const P = useP();
  const map = window.HW.WM_STATUS_MAP;
  const toneC = (t) => t === 'good' ? P.good : t === 'bad' ? P.bad : t === 'info' ? P.info : P.ink2;
  const rows = STAGES.map((s) => ({ our: s.label, color: s.color(P), ...(map[s.id] || {}) }));
  const gc = '1fr 1fr 1.3fr';
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fade .15s ease' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>Order status mapping</div><div style={{ fontSize: 11.5, color: P.inkDim }}>How our fulfillment stages map to Weedmaps statuses — and what the customer sees</div></div>
        <IconBtn icon="x" size={18} onClick={onClose} />
      </div>
      <div style={{ overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', gap: 10, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, marginBottom: 14 }}>
          <Icon name="link" size={15} stroke={1.9} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}><b style={{ color: P.ink2 }}>DRAFT</b> — Weedmaps sends the cart to our synchronous webhook first; we validate stock &amp; pricing before it ever becomes an order in this queue.</div>
        </div>
        <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: gc, gap: 10, padding: '9px 14px', background: P.surface2, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>
            <span>Our status</span><span>Weedmaps status</span><span>Customer sees</span>
          </div>
          {rows.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: gc, gap: 10, alignItems: 'center', padding: '11px 14px', borderTop: `1px solid ${P.hairline}` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: P.ink }}><span style={{ width: 8, height: 8, borderRadius: 99, background: r.color, flex: '0 0 auto' }} />{r.our}</span>
            <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#1F5FC0' }}>{r.wm || '—'}</span>
            <span style={{ fontSize: 12.5, color: toneC(r.tone) }}>{r.cust || '—'}</span>
          </div>)}
          <div style={{ display: 'grid', gridTemplateColumns: gc, gap: 10, alignItems: 'center', padding: '11px 14px', borderTop: `1px solid ${P.hairline}`, background: P.badSoft }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: P.ink }}><span style={{ width: 8, height: 8, borderRadius: 99, background: P.bad, flex: '0 0 auto' }} />Canceled / rejected</span>
            <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: '#1F5FC0' }}>{map.canceled.wm}</span>
            <span style={{ fontSize: 12.5, color: P.bad }}>{map.canceled.cust}</span>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5, marginTop: 12 }}>Advancing a Weedmaps order through these stages pushes the mapped status back to Weedmaps automatically — that’s what tells the customer where their order is. This same mapping drives the status strip inside each Weedmaps order.</div>
      </div>
    </div>
  </div>;
}

// ── Delivery · LIST view — routing manifest (dense table) ──────────────────
function DeliveryList({ items, onStartSale }) {
  const P = useP();
  const dlv = window.HW.DELIVERY;
  const totalMi = items.reduce((s, o) => s + (dlv[o.id]?.dist || 0), 0);
  const unassigned = items.filter((o) => (dlv[o.id]?.driver || 'Unassigned') === 'Unassigned').length;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12, flexWrap: 'wrap' }}>
        <Stat label="Stops" value={items.length} />
        <Divider />
        <Stat label="Route distance" value={totalMi.toFixed(1) + ' mi'} />
        <Divider />
        <Stat label="Unassigned" value={unassigned} tone={unassigned ? P.warn : P.good} />
        <div style={{ flex: 1 }} />
        <PBtn variant="secondary" size="sm" icon="route">Optimize route</PBtn>
        <PBtn variant="soft" size="sm" icon="user-check">Assign driver</PBtn>
      </div>
      <DataTable dense onRowClick={onStartSale} rowKey={(o) => o.id}
      columns={[
      { label: 'Order', width: 108, render: (o) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: P.ink2 }}>#{o.num}</span> },
      { label: 'Customer', render: (o) =>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Avatar name={o.name} size={28} crown={o.badge === 'Member'} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap' }}>{o.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute }}>{o.items} item{o.items > 1 ? 's' : ''} · {o.pay}</div>
              </div>
            </div> },
      { label: 'Drop-off', render: (o) => {const d = dlv[o.id] || {};return (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: P.ink2, fontWeight: 600, whiteSpace: 'nowrap' }}>{d.addr || '—'}</div>
              <div style={{ fontSize: 11.5, color: P.inkMute, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pin" size={11} />{d.zone || '—'}</div>
            </div>);} },
      { label: 'Distance', align: 'right', width: 88, render: (o) => <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>{dlv[o.id]?.dist?.toFixed(1) ?? '—'} mi</span> },
      { label: 'ETA window', align: 'left', width: 128, render: (o) => {const d = dlv[o.id] || {};return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2 }}><Icon name="clock" size={12} color={P.inkMute} />{d.win || '—'}</span>);} },
      { label: 'Driver', width: 120, render: (o) => {const dr = dlv[o.id]?.driver || 'Unassigned';const un = dr === 'Unassigned';return (
            <Pill kind={un ? 'warn' : 'neutral'} dot>{un ? 'Unassigned' : dr}</Pill>);} },
      { label: 'Stage', width: 150, render: (o) => {const st = stageMeta(o.stage);return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: P.ink2 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: st.color(P) }} />{st.label}</span>);} },
      { label: 'Total', align: 'right', width: 80, render: (o) => <span style={{ fontFamily: P.fontMono, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{window.HW.fmt.money(o.total)}</span> },
      { label: '', align: 'right', width: 40, render: () => <Icon name="chevron-right" size={15} color={P.inkFaint} /> }]
      }
      rows={items} />
    </div>);

}

// ── Delivery · MAP view — schematic dispatch map + stop list ───────────────
function DeliveryMap({ items, onStartSale }) {
  const P = useP();
  const dlv = window.HW.DELIVERY;
  const [sel, setSel] = React.useState(items[0]?.id || null);
  const zones = ['Lake Elsinore', 'Wildomar', 'Lakeland Vlg', 'Temescal'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, marginTop: 4, alignItems: 'start' }}>
      {/* Map canvas (schematic, no tiles) */}
      <div style={{ position: 'relative', height: 560, borderRadius: P.r16, overflow: 'hidden', border: `1px solid ${P.hairline2}`,
        background: P.mode === 'dark' ?
        'radial-gradient(120% 120% at 30% 10%, #16160f, #0c0c08)' :
        'radial-gradient(120% 120% at 30% 10%, #f7f5ee, #eceadf)' }}>
        {/* grid */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="mg" width="46" height="46" patternUnits="userSpaceOnUse">
              <path d="M46 0H0V46" fill="none" stroke={P.hairline} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mg)" />
          {/* arterial roads */}
          <path d="M-20 180 Q 300 120 760 260" fill="none" stroke={P.hairline2} strokeWidth="8" strokeLinecap="round" />
          <path d="M180 -20 Q 240 280 420 600" fill="none" stroke={P.hairline2} strokeWidth="6" strokeLinecap="round" />
          <path d="M-20 440 Q 380 420 800 380" fill="none" stroke={P.hairline} strokeWidth="5" strokeLinecap="round" />
        </svg>
        {/* store marker */}
        <div style={{ position: 'absolute', left: '46%', top: '42%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: P.shadowMd }}><Icon name="shop" size={18} color={P.accent} /></span>
          <span style={{ fontSize: 10, fontWeight: 700, color: P.ink2, background: P.surface, padding: '1px 7px', borderRadius: 99, border: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap' }}>Store</span>
        </div>
        {/* zone labels */}
        {zones.map((z, i) =>
        <span key={z} style={{ position: 'absolute', left: `${[14, 68, 18, 72][i]}%`, top: `${[16, 14, 80, 72][i]}%`, fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: P.inkFaint, fontFamily: P.fontMono }}>{z}</span>
        )}
        {/* pins */}
        {items.map((o, i) => {const d = dlv[o.id] || { x: .5, y: .5 };const a = sel === o.id;const st = stageMeta(o.stage);
          return (
            <button key={o.id} onClick={() => setSel(o.id)} style={{ position: 'absolute', left: `${d.x * 100}%`, top: `${d.y * 100}%`, transform: 'translate(-50%,-100%)', background: 'none', border: 'none', cursor: 'pointer', zIndex: a ? 5 : 2 }}>
              <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: a ? 30 : 24, height: a ? 30 : 24, borderRadius: '50% 50% 50% 2px', transform: 'rotate(45deg)', background: a ? P.accent : P.surface, border: `2px solid ${a ? P.accentInk : st.color(P)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: P.shadowMd, transition: 'all .12s' }}>
                  <span style={{ transform: 'rotate(-45deg)', fontSize: 11.5, fontWeight: 800, color: a ? P.accentInk : P.ink, fontFamily: P.fontMono }}>{i + 1}</span>
                </span>
                {a && <span style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: P.ink, background: P.surface, padding: '2px 8px', borderRadius: 99, border: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap', boxShadow: P.shadowSm }}>{window.HW.fmt.money(o.total)} · {d.eta}m</span>}
              </span>
            </button>);
        })}
        {/* legend */}
        <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 12, padding: '8px 12px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, boxShadow: P.shadowSm }}>
          {STAGES.filter((s) => ['verify', 'pack', 'packing', 'ready'].includes(s.id)).map((s) =>
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: s.color(P) }} />{s.label}</span>
          )}
        </div>
      </div>

      {/* Stop list / dispatch rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 0' }}>
          <Eyebrow>Dispatch · {items.length} stops</Eyebrow>
          <PBtn variant="soft" size="xs" icon="route">Optimize</PBtn>
        </div>
        {items.map((o, i) => {const d = dlv[o.id] || {};const a = sel === o.id;const st = stageMeta(o.stage);const un = (d.driver || 'Unassigned') === 'Unassigned';
          return (
            <div key={o.id} onClick={() => setSel(o.id)} style={{ display: 'flex', gap: 11, padding: '11px 12px', background: a ? P.accentSoft : P.surface, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', transition: 'all .12s' }}>
              <span style={{ flex: '0 0 auto', width: 24, height: 24, borderRadius: 99, background: a ? P.accent : P.surface3, color: a ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, fontFamily: P.fontMono, alignSelf: 'flex-start', marginTop: 1 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap' }}>{o.name}</span>
                  <span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: P.ink }}>{window.HW.fmt.money(o.total)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: P.inkDim, display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0 7px' }}><Icon name="pin" size={11} color={P.inkMute} />{d.addr} · {d.zone}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}><Icon name="route" size={11} />{d.dist} mi</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}><Icon name="clock" size={11} />{d.win}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: P.ink2 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: st.color(P) }} />{st.label}</span>
                </div>
                {a &&
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
                    <PBtn variant={un ? 'accent' : 'soft'} size="xs" icon="user-check" full>{un ? 'Assign driver' : d.driver}</PBtn>
                    <PBtn variant="secondary" size="xs" icon="phone" />
                    <PBtn variant="secondary" size="xs" icon="arrow-right" onClick={(e) => {e.stopPropagation();onStartSale && onStartSale();}} />
                  </div>}
              </div>
            </div>);
        })}
      </div>
    </div>);

}

function Stat({ label, value, tone }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{ fontSize: 16, fontWeight: 700, color: tone || P.ink, fontFamily: P.fontMono }}>{value}</span>
  </div>;
}
function Divider() {const P = useP();return <span style={{ width: 1, height: 26, background: P.hairline2 }} />;}

// ── Promo / referral editor — cart-level discounts while editing an order ───
const PROMO_BOOK = { WELCOME10: 10, HW420: 4.20, SUMMER15: 15, FRIENDS: 10, BOGO5: 5 };
const REFERRAL_BOOK = { 'REF-MANISHA': 10, 'REF-GIRISH': 10, 'REF-NINA': 10 };
function PromoEditor({ promo, promoAmt, referral, referralAmt, onPromo, onReferral }) {
  const P = useP();const fmt = window.HW.fmt;
  const [code, setCode] = React.useState('');
  const [kind, setKind] = React.useState('promo');
  const [err, setErr] = React.useState('');
  const apply = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const book = kind === 'promo' ? PROMO_BOOK : REFERRAL_BOOK;
    const v = book[c];
    if (!v) {setErr(kind === 'promo' ? 'No promo with that code' : 'No referral with that code');return;}
    setErr('');setCode('');
    kind === 'promo' ? onPromo(c, v) : onReferral(c, v);
  };
  const Chip = ({ label, amt, tone, onClear, icon }) =>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: tone + '14', border: `1px solid ${tone}44`, borderRadius: P.r8 }}>
      <Icon name={icon} size={13} stroke={2.2} color={tone} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: tone, fontFamily: P.fontMono }}>−{fmt.money(amt)}</span>
      <IconBtn icon="x" size={12} style={{ width: 22, height: 22 }} onClick={onClear} />
    </div>;
  return (
    <div style={{ marginBottom: 10, padding: 11, background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <Icon name="tag" size={13} stroke={2} color={P.ink2} />
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.ink2 }}>Promotions &amp; referrals</span>
      </div>
      {(promo || referral) &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 9 }}>
          {promo && <Chip label={'Promo · ' + promo} amt={promoAmt} tone={P.good} icon="tag" onClear={() => onPromo(null, 0)} />}
          {referral && <Chip label={'Referral · ' + referral} amt={referralAmt} tone={P.info} icon="link" onClear={() => onReferral(null, 0)} />}
        </div>}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <Seg size="sm" value={kind} onChange={(v) => {setKind(v);setErr('');}} options={[{ value: 'promo', label: 'Promo' }, { value: 'referral', label: 'Referral' }]} />
        <div style={{ flex: 1, minWidth: 0 }}><Field mono size="sm" icon="percent" value={code} placeholder={kind === 'promo' ? 'e.g. SUMMER15' : 'e.g. REF-NINA'} onChange={(e) => {setCode(e.target.value.toUpperCase());setErr('');}} /></div>
        <PBtn variant="accent" size="sm" icon="check" disabled={!code.trim()} onClick={apply}>Apply</PBtn>
      </div>
      {err && <div style={{ fontSize: 11.5, color: P.bad, fontWeight: 600, marginTop: 6 }}>{err}</div>}
      <div style={{ fontSize: 10, color: P.inkMute, marginTop: 7, lineHeight: 1.45 }}>Discounts apply to the cart and spread proportionally across items, so tax and any refund stay correct.</div>
    </div>);
}

function DateRange() {
  const P = useP();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('Jun 9 – Jun 10');
  const presets = ['Today', 'Yesterday', 'Last 7 days', 'This month', 'Jun 9 – Jun 10'];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name="calendar" size={15} stroke={1.9} color={P.inkMute} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{label}</span>
        <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} />
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 300, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, padding: 8, zIndex: 51, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {presets.map((p) =>
            <button key={p} onClick={() => {setLabel(p === 'Today' ? 'Jun 10' : p === 'Yesterday' ? 'Jun 9' : p);setOpen(false);}} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: label === p ? P.accentSoft : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600, color: P.ink }}>
                {p}{label === p && <Icon name="check" size={14} stroke={2.4} color={P.ink} />}
              </button>
            )}
          </div>
          <div style={{ padding: '10px 4px 2px', marginTop: 4, borderTop: `1px solid ${P.hairline}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Custom range</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 12px 1fr', alignItems: 'center', gap: 6 }}>
              <div style={{ minWidth: 0 }}><Field icon="calendar" placeholder="From" size="sm" mono /></div>
              <span style={{ color: P.inkMute, textAlign: 'center', fontSize: 12.5 }}>–</span>
              <div style={{ minWidth: 0 }}><Field icon="calendar" placeholder="To" size="sm" mono /></div>
            </div>
          </div>
        </div>
      </>}
    </div>);

}

function FleetBar({ P }) {
  const D = window.HW.DRIVERS;const total = window.HW.FLEET_TOTAL;
  const onRoute = D.filter((d) => d.status === 'on-route').length;
  const idle = D.filter((d) => d.status === 'idle').length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
      <Stat label="Fleet on shift" value={`${onRoute + idle} / ${total}`} />
      <Divider /><Stat label="On route" value={onRoute} tone={P.good} />
      <Divider /><Stat label="Idle" value={idle} tone={P.warn} />
      <Divider /><Stat label="Regions" value={window.HW.REGIONS.length} />
    </div>);

}

// Delivery · DISPATCH — dense filterable table (scales to a big fleet)
function DispatchView({ items, onStartSale, onOpen }) {
  const P = useP();const dlv = window.HW.DELIVERY;
  const [region, setRegion] = React.useState('All');
  const [unOnly, setUnOnly] = React.useState(false);
  const rows = items.filter((o) => {const d = dlv[o.id] || {};const un = (d.driver || 'Unassigned') === 'Unassigned';return (region === 'All' || d.zone === region) && (!unOnly || un);});
  const Chip = ({ active, onClick, children }) => <button onClick={onClick} style={{ flex: '0 0 auto', padding: '6px 12px', borderRadius: P.r999, border: `1px solid ${active ? P.ink : P.hairline2}`, background: active ? P.ink : P.surface, color: active ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{children}</button>;
  return (
    <div style={{ marginTop: 4 }}>
      <FleetBar P={P} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        <span style={{ flex: '0 0 auto', fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Region</span>
        <Chip active={region === 'All'} onClick={() => setRegion('All')}>All</Chip>
        {window.HW.REGIONS.map((r) => <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>)}
        <span style={{ flex: '0 0 auto', width: 1, height: 20, background: P.hairline2 }} />
        <Chip active={unOnly} onClick={() => setUnOnly((v) => !v)}>Unassigned only</Chip>
      </div>
      <DataTable dense onRowClick={onOpen} rowKey={(o) => o.id}
      columns={[
      { label: 'Order', width: 96, render: (o) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 11.5, color: P.ink2 }}>#{o.num}</span> },
      { label: 'Customer', render: (o) => <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={o.name} size={26} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap' }}>{o.name}</span></div> },
      { label: 'Source', width: 108, render: (o) => o.source === 'Weedmaps' ? <WmOrderTag /> : <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>In-house</span> },
      { label: 'Region', render: (o) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: P.ink2 }}><Icon name="pin" size={12} color={P.inkMute} />{dlv[o.id]?.zone || '—'}</span> },
      { label: 'Driver', render: (o) => {const dr = dlv[o.id]?.driver || 'Unassigned';const un = dr === 'Unassigned';return <Pill kind={un ? 'warn' : 'neutral'} dot>{un ? 'Unassigned' : dr}</Pill>;} },
      { label: 'ETA window', width: 116, render: (o) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2 }}>{dlv[o.id]?.win || '—'}</span> },
      { label: 'Total', align: 'right', width: 80, render: (o) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{window.HW.fmt.money(o.total)}</span> },
      { label: '', align: 'right', width: 96, render: (o) => {const un = (dlv[o.id]?.driver || 'Unassigned') === 'Unassigned';return <PBtn variant={un ? 'accent' : 'soft'} size="xs" icon="user-check">{un ? 'Assign' : 'Re-route'}</PBtn>;} }]}

      rows={rows} />
    </div>);

}

// Delivery · REGIONS — grouped by region with per-region driver load
function RegionsView({ items, onStartSale, onOpen }) {
  const P = useP();const dlv = window.HW.DELIVERY;const D = window.HW.DRIVERS;
  const regions = window.HW.REGIONS;
  return (
    <div style={{ marginTop: 4 }}>
      <FleetBar P={P} />
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(262px, 1fr)', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
        {regions.map((r) => {
          const ords = items.filter((o) => dlv[o.id]?.zone === r);
          const drv = D.filter((d) => d.region === r);
          const onR = drv.filter((d) => d.status === 'on-route').length;
          return (
            <div key={r} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 11px' }}>
                <Icon name="pin" size={14} color={P.ink2} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{r}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono, background: P.surface3, padding: '1px 7px', borderRadius: 99 }}>{ords.length}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{onR}/{drv.length} drv</span>
              </div>
              <div style={{ background: P.bg2, border: `1px solid ${P.hairline}`, borderRadius: P.r14, padding: 10, display: 'flex', flexDirection: 'column', gap: 9, minHeight: 150, flex: 1 }}>
                {drv.length > 0 &&
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{drv.map((d) => <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: P.ink2, background: P.surface, border: `1px solid ${P.hairline2}`, padding: '3px 8px', borderRadius: 99 }}><span style={{ width: 5, height: 5, borderRadius: 99, background: d.status === 'on-route' ? P.good : d.status === 'idle' ? P.warn : P.inkFaint }} />{d.name.split(' ')[0]} {d.stops}/{d.cap}</span>)}</div>}
                {ords.length === 0 && <div style={{ padding: '22px 8px', textAlign: 'center', color: P.inkFaint, fontSize: 12.5 }}>No active orders</div>}
                {ords.map((o) => {const d = dlv[o.id] || {};return (
                    <div key={o.id} onClick={() => onOpen(o)} style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: '9px 11px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span><span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 12.5, color: P.ink }}>{window.HW.fmt.money(o.total)}</span></div>
                    <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3, fontFamily: P.fontMono }}>{d.addr} · {d.win}</div>
                  </div>);})}
              </div>
            </div>);
        })}
      </div>
    </div>);

}

// Delivery · DRIVERS — fleet roster + unassigned queue
function DriversView({ items, onStartSale }) {
  const P = useP();const D = window.HW.DRIVERS;const dlv = window.HW.DELIVERY;
  const unassigned = items.filter((o) => (dlv[o.id]?.driver || 'Unassigned') === 'Unassigned');
  return (
    <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
      <div>
        <FleetBar P={P} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 10 }}>
          {D.map((d) => {const pct = d.cap ? d.stops / d.cap : 0;const col = d.status === 'on-route' ? P.good : d.status === 'idle' ? P.warn : P.inkFaint;return (
              <div key={d.id} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={d.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pin" size={11} />{d.region}</div>
                </div>
                <Pill kind={d.status === 'on-route' ? 'good' : d.status === 'idle' ? 'warn' : 'neutral'} dot>{d.status}</Pill>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1 }}><BarMeter value={pct} color={col} height={6} /></div>
                <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink2, fontWeight: 600 }}>{d.stops}/{d.cap}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>ETA next {d.eta}</span>
                <PBtn variant="soft" size="xs" icon="route">Route</PBtn>
              </div>
            </div>);})}
        </div>
      </div>
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, background: P.surface, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Icon name="user-off" size={15} color={P.warn} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Unassigned</span><Pill kind="warn">{unassigned.length}</Pill></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {unassigned.map((o) => {const d = dlv[o.id] || {};return (
              <div key={o.id} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span><span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 12.5, color: P.ink, flex: '0 0 auto' }}>{window.HW.fmt.money(o.total)}</span></div>
              <div style={{ fontSize: 11.5, color: P.inkDim, margin: '3px 0 9px', fontFamily: P.fontMono }}>{d.zone} · {d.win}</div>
              <PBtn variant="accent" size="xs" icon="user-check" full>Assign driver</PBtn>
            </div>);})}
          {unassigned.length === 0 && <div style={{ padding: '20px 8px', textAlign: 'center', color: P.inkFaint, fontSize: 12.5 }}>All orders assigned</div>}
        </div>
      </div>
    </div>);

}

// Add-item picker — search, brand multi-select, smart filters, categories
/**
 * SWAP ONE LINE FOR ANOTHER PRODUCT.
 *
 * Adding an item and REPLACING one are different jobs and this is the second.
 * The three ladders — Similar / Cheaper / Stronger — and their ordering come
 * from @hyperwolf/commerce-logic via `window.HWSwap`, which is the same code
 * the web cart ranks with. Nothing here re-implements "similar"; if this list
 * ever disagrees with the website, the bug is in one engine, not two.
 *
 * Renders nothing when the engine has not loaded — a control that sometimes
 * does nothing is worse than no control.
 */
function SwapPanel({ P, fmt, line, draft, onSwap, onClose }) {
  const [mode, setMode] = React.useState('similar');
  const S = window.HWSwap;

  const result = React.useMemo(() => {
    if (!S) return null;
    const current = window.HW.PRODUCTS.find((p) => p.name === line.name) ||
      { id: line.name, sku: line.name, name: line.name, brand: line.brand, cat: line.cat, price: line.price };
    return S.candidates({
      current,
      pool: window.HW.PRODUCTS.filter((p) => p.active),
      quantity: Math.max(1, line.qty || 1),
      // Already on the order — swapping into a duplicate line confuses the
      // stepper and reads as a bug.
      exclude: draft.filter((l) => l.qty > 0 && l.name !== line.name)
        .map((l) => (window.HW.PRODUCTS.find((p) => p.name === l.name) || {}).id).filter(Boolean),
      poolLabel: 'this store',
    });
  }, [line.name, line.qty, draft]);

  if (!S) return null;
  const rows = (result && result[mode]) || [];
  const TABS = [['similar', 'Similar'], ['cheaper', 'Cheaper'], ['stronger', 'Stronger']];

  return (
    <div style={{ marginTop: 6, border: `1px solid ${P.accentBorder}`, borderRadius: P.r12, background: P.surface, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderBottom: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <Icon name="swap" size={14} stroke={2} color={P.inkDim} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Replace {line.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{line.brand} · {fmt.money(line.price)} ea · ×{line.qty}</div>
        </div>
        <IconBtn icon="x" size={14} style={{ width: 28, height: 28 }} onClick={onClose} />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '9px 11px' }}>
        {TABS.map(([id, label]) =>
          <button key={id} onClick={() => setMode(id)} style={{ flex: 1, minHeight: P.ctrlH ? P.ctrlH[0] : 30, padding: '6px 10px', borderRadius: P.r8, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700,
            background: mode === id ? P.ink : 'transparent', color: mode === id ? P.surface : P.ink2,
            border: `1px solid ${mode === id ? P.ink : P.hairline2}` }}>{label}</button>)}
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto', borderTop: `1px solid ${P.hairline}` }}>
        {rows.length === 0 ?
          <div style={{ padding: '14px 12px', fontSize: 12.5, color: P.inkMute }}>{S.emptyNote(result, mode, line.cat)}</div> :
          rows.map((c, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderBottom: i < rows.length - 1 ? `1px solid ${P.hairline}` : 'none' }}>
              <Thumb item={{ name: c.product.name, cat: c.product.cat }} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{c.product.brand}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{c.product.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>
                  {c.product.thc != null ? `${c.product.thc}% THC · ` : ''}{fmt.money(c.product.price)}
                  {c.priceDeltaLabel ? <span style={{ color: c.priceDeltaCents < 0 ? P.good : P.inkMute, fontWeight: 700 }}>{` ${c.priceDeltaLabel}`}</span> : null}
                </div>
                {/* Partial cover is a DIFFERENT promise from a full swap and must say so. */}
                {c.partial && <div style={{ fontSize: 11, color: P.warn, fontWeight: 700, marginTop: 2 }}>{`Covers ${c.fillable} of ${line.qty} — ${c.shortfall} would stay on ${line.name}`}</div>}
              </div>
              <PBtn variant="accent" size="sm" onClick={() => onSwap(c)}>Swap</PBtn>
            </div>)}
      </div>
    </div>);
}

function AddItemPanel({ P, fmt, draft, onAdd }) {
  const all = window.HW.PRODUCTS.filter((p) => p.active);
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('All');
  const [smart, setSmart] = React.useState('none');
  const [brands, setBrands] = React.useState(() => new Set());
  const [brandOpen, setBrandOpen] = React.useState(false);
  const allBrands = React.useMemo(() => [...new Set(all.map((p) => p.brand))].sort(), [all]);
  const SMART = {
    none: () => true,
    under10: (p) => p.price <= 10,
    sale: (p) => !!p.was,
    highthc: (p) => p.thc != null && p.thc >= 70,
    instock: (p) => p.qty > 20,
    highmgn: (p) => p.margin >= 0.5
  };
  const cats = ['All', ...window.HW.CATS.filter((c) => c !== 'Deals')];
  const rows = all.filter((p) =>
  (!q || (p.name + p.sku + p.brand).toLowerCase().includes(q.toLowerCase())) && (
  cat === 'All' || p.cat === cat) && (
  brands.size === 0 || brands.has(p.brand)) &&
  (SMART[smart] || SMART.none)(p));
  const toggleBrand = (b) => setBrands((p) => {const n = new Set(p);n.has(b) ? n.delete(b) : n.add(b);return n;});
  const inDraft = (name) => draft.find((l) => l.name === name && l.qty > 0);
  const smartChips = [['under10', 'Under $10'], ['sale', 'On sale'], ['highthc', 'High THC'], ['instock', 'In stock'], ['highmgn', 'High margin']];

  return (
    <div style={{ marginTop: 6, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Field icon="search" placeholder="Search product, SKU or brand…" size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
        {/* categories (color-coded) + brand filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 1 }}>
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <button onClick={() => setBrandOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: P.r999, border: `1px solid ${brands.size || brandOpen ? P.accentBorder : P.hairline2}`, background: brands.size ? P.accentSoft : P.surface, color: P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}><Icon name="tag" size={12} stroke={1.9} />{brands.size ? `${brands.size} brand${brands.size > 1 ? 's' : ''}` : 'Brands'}<Icon name="chevron-down" size={11} stroke={2.2} /></button>
            {brandOpen && <>
              <div onClick={() => setBrandOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, width: 220, maxHeight: 240, overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, boxShadow: P.shadowLg, padding: 6, zIndex: 61 }}>
                {brands.size > 0 && <button onClick={() => setBrands(new Set())} style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 7, color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, marginBottom: 2 }}><Icon name="x" size={11} stroke={2} />Clear all</button>}
                {allBrands.map((b) => {const on = brands.has(b);return (
                    <button key={b} onClick={() => toggleBrand(b)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: on ? P.accentSoft : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                    <Check on={on} onChange={() => toggleBrand(b)} size={15} />
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</span>
                    <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{all.filter((p) => p.brand === b).length}</span>
                  </button>);})}
              </div>
            </>}
          </div>
          <span style={{ flex: '0 0 auto', width: 1, height: 18, background: P.hairline2 }} />
          {cats.map((c) => {const a = cat === c;const col = window.HW.CAT_COLOR[c] || P.ink2;return (
              <button key={c} onClick={() => setCat(c)} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: P.r999, border: `1px solid ${a ? col : P.hairline2}`, background: a ? col : P.surface, color: a ? c === 'Deals' ? '#1A1400' : '#fff' : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>
              {c !== 'All' && <span style={{ width: 6, height: 6, borderRadius: 99, background: a ? c === 'Deals' ? '#1A1400' : '#fff' : col }} />}{c}
            </button>);})}
        </div>
        {/* smart filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 1 }}>
          <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}><Icon name="sparkle" size={11} stroke={1.9} />Smart</span>
          {smartChips.map(([k, label]) => {const a = smart === k;return (
              <button key={k} onClick={() => setSmart(a ? 'none' : k)} style={{ flex: '0 0 auto', padding: '5px 10px', borderRadius: P.r999, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, background: a ? P.accentSoft : P.surface, color: a ? P.ink : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{label}</button>);})}
        </div>
      </div>
      {/* results */}
      <div style={{ maxHeight: 250, overflowY: 'auto', padding: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 6px' }}>
          <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{rows.length} product{rows.length === 1 ? '' : 's'}</span>
        </div>
        {rows.map((p) => {const added = inDraft(p.name);return (
            <div key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 8 }}>
            <Thumb item={p} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: window.HW.CAT_COLOR[p.cat] || P.neutral, flex: '0 0 auto' }} />{p.brand} · {p.qty} left</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: p.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{fmt.money0(p.price)}</span>
            <button onClick={() => onAdd(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: added ? P.goodSoft : P.accent, color: added ? P.good : P.accentInk, border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}><Icon name={added ? 'check' : 'plus'} size={12} stroke={2.4} />{added ? `In order (${added.qty})` : 'Add'}</button>
          </div>);})}
        {rows.length === 0 && <div style={{ padding: '26px 8px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No products match these filters</div>}
      </div>
    </div>);

}

// Payment part — one tender (card or cash) with full detail
function PayPart({ pt, P, fmt, single }) {
  const isCash = pt.kind === 'cash';
  const Row = ({ k, v, mono = true, strong }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: strong ? 12.5 : 11.5, padding: '1.5px 0' }}>
      <span style={{ color: strong ? P.ink : P.inkDim, fontWeight: strong ? 700 : 500, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ color: P.ink2, fontWeight: strong ? 700 : 600, fontFamily: mono ? P.fontMono : P.fontSans, whiteSpace: 'nowrap' }}>{v}</span>
    </div>;
  return (
    <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 7, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={isCash ? 'cash' : 'card'} size={15} stroke={1.9} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{isCash ? 'Cash' : `${pt.brand} ••${pt.last4}`}</div>
          <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{isCash ? 'Cash tender' : `${pt.type} · ${pt.entry} · ${pt.aid}`}</div>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{fmt.money(pt.amount)}</span>
      </div>
      <div style={{ borderTop: `1px solid ${P.hairline}`, paddingTop: 7 }}>
        {isCash ? <>
          <Row k="Amount due" v={fmt.money(pt.amount)} />
          <Row k="Cash tendered" v={fmt.money(pt.tendered)} />
          <Row k="Change given" v={fmt.money(pt.change)} strong />
        </> : <>
          <Row k="Auth code" v={pt.auth} />
          <Row k="Card type" v={`${pt.brand} ${pt.type}`} mono={false} />
          <Row k="Entry mode" v={pt.entry} mono={false} />
          <Row k="Amount charged" v={fmt.money(pt.amount)} strong />
        </>}
      </div>
    </div>);

}

// ── Weedmaps order block — status mapping · fraud verification · identity merge
function WmOrderTag() {
  const P = useP();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99, letterSpacing: '.02em' }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>;
}
function WmCheckRow({ label, state }) {
  const P = useP();
  const META = {
    pass: { c: P.good, ic: 'check-circle', t: 'Verified' }, match: { c: P.good, ic: 'check-circle', t: 'Match' }, verified: { c: P.good, ic: 'check-circle', t: 'Verified' }, valid: { c: P.good, ic: 'check-circle', t: 'Valid' },
    partial: { c: P.warn, ic: 'shield', t: 'Partial' }, pending: { c: P.warn, ic: 'clock', t: 'Pending' }, unverified: { c: P.warn, ic: 'shield', t: 'Unverified' },
    suspicious: { c: P.bad, ic: 'shield', t: 'Suspicious' }, missing: { c: P.bad, ic: 'x', t: 'Missing' }, invalid: { c: P.bad, ic: 'x', t: 'Bounced' }
  };
  if (state === 'n/a') return null;
  const m = META[state] || { c: P.inkFaint, ic: 'x', t: state };
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: P.surface, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
    <Icon name={m.ic} size={14} stroke={2} color={m.c} />
    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: P.ink2 }}>{label}</span>
    <span style={{ fontSize: 11.5, fontWeight: 700, color: m.c, fontFamily: P.fontMono }}>{m.t}</span>
  </div>;
}
function WmMergeCandidate({ m, conf, onMerge, primary }) {
  const P = useP();const fmt = window.HW.fmt;
  if (!m) return null;
  return <div style={{ border: `1px solid ${primary ? P.accentBorder : P.hairline2}`, background: primary ? P.accentSoft : P.surface, borderRadius: P.r12, padding: '11px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Avatar name={m.name} size={32} crown={m.member} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{m.name}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.visits} visit{m.visits > 1 ? 's' : ''}</div>
      </div>
      {conf != null && <span style={{ fontSize: 11.5, fontWeight: 800, color: conf >= 0.9 ? P.good : conf >= 0.7 ? P.warn : P.inkDim, fontFamily: P.fontMono }}>{Math.round(conf * 100)}%</span>}
    </div>
    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>
      <span>{m.email}</span><span style={{ marginLeft: 'auto' }}>{fmt.money(m.wallet)} wallet</span>
    </div>
    {onMerge && <div style={{ marginTop: 9 }}><PBtn variant={primary ? 'accent' : 'secondary'} size="sm" icon="link" full onClick={onMerge}>Merge into {m.name.split(' ')[0]}</PBtn></div>}
  </div>;
}
function WmOrderBlock({ o, wm, onLog }) {
  const P = useP();
  const map = window.HW.WM_STATUS_MAP;
  const cur = map[o.stage] || map.verify;
  const [verify, setVerify] = React.useState(wm.level === 'low' ? 'approved' : 'pending');
  const [merge, setMerge] = React.useState(wm.merged ? 'merged' : 'idle');
  const riskC = wm.level === 'high' ? P.bad : wm.level === 'medium' ? P.warn : P.good;
  const gate = wm.delivery && wm.level === 'high';
  const [view, setView] = React.useState('detailed');
  const matched = wm.matchId ? window.HW.memberById(wm.matchId) : null;
  const cand = (wm.candidates || []).map((id) => window.HW.memberById(id)).filter(Boolean);
  const MATCH_LABEL = { phone: 'Phone', email: 'Email', name: 'Name', id: 'ID', device: 'Device' };
  const badState = (s) => ['invalid', 'missing', 'suspicious', 'unverified'].includes(s);
  const MatchChips = () => (wm.matchOn || []).length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>{wm.matchOn.map((k) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: P.good, background: P.goodSoft, borderRadius: 99, padding: '3px 9px' }}><Icon name="check" size={11} stroke={2.6} />{MATCH_LABEL[k] || k} match</span>)}</div> : null;
  const CompareRows = ({ m }) => m ? <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden', marginBottom: 9 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 1fr', gap: 10, padding: '6px 11px', background: P.surface2, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}><span>Field</span><span>Weedmaps order</span><span>Matched customer</span></div>
    {[['Name', wm.contact && wm.contact.name, m.name, 'name'], ['Phone', wm.contact && wm.contact.phone, m.phone, 'phone']].map(([lb, a, b, key]) => {const on = (wm.matchOn || []).includes(key);return <div key={lb} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 1fr', gap: 10, padding: '7px 11px', borderTop: `1px solid ${P.hairline}`, alignItems: 'center' }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? P.good : P.inkMute, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{on && <Icon name="check" size={11} stroke={2.6} color={P.good} />}{lb}</span>
      <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a || '—'}</span>
      <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: on ? P.ink : P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b || '—'}</span>
    </div>;})}
  </div> : null;

  const doVerify = (v) => {setVerify(v);onLog && onLog({ who: 'Manisha Saini', role: 'You', action: v === 'approved' ? 'Verified Weedmaps order · cleared for fulfillment' : v === 'hold' ? 'Placed Weedmaps order on hold · pending verification' : 'Canceled Weedmaps order · reported as fraud', time: 'just now', icon: v === 'approved' ? 'check-circle' : v === 'hold' ? 'clock' : 'shield', accent: true });};
  const doMerge = (m) => {setMerge('merged');onLog && onLog({ who: 'Manisha Saini', role: 'You', action: `Merged Weedmaps customer into ${m.name} · order history unified`, time: 'just now', icon: 'link', accent: true });};

  // Identity assurance for whoever this order resolves to. A matched customer
  // brings their existing record; a brand-new WM contact starts at nothing.
  const idvFor = (mid) => (window.HW.IDV || {})[mid] || null;
  const idv = matched && (merge === 'merged' || wm.match === 'existing') ? idvFor(matched.id) : null;
  const idvA = window.HWV ? window.HWV.assurance(idv) : { tier: 0 };
  const [peek, setPeek] = React.useState(false);
  const peekTarget = matched || (cand.length === 1 ? cand[0] : null);
  const isDel = !!wm.delivery;
  const [door, setDoor] = React.useState(false); // deferred to a driver ID scan at the door
  // Who needs what: the remote ID check (nobody has ever held this person's ID) applies to
  // ANY Weedmaps order, pickup or delivery — WM never passes us a document. The
  // phone-binding SMS is delivery-only, because that is the one question a
  // remote order raises. Either way the control is hoisted out of the fold.
  const remoteUp = idvA.tier === 0;
  const smsUp = isDel && idvA.tier === 1;
  const verifyUp = remoteUp || smsUp;
  // Progressive disclosure. All the same data, but only what needs a DECISION
  // is open on arrival — the rest is one click away with its state summarised
  // on the closed header, so nothing is hidden, just not shouted at once.
  const Fold = ({ id, icon, title, status, tone, children, defOpen }) => {
    const [o, setO] = React.useState(!!defOpen);
    const c = tone === 'bad' ? P.bad : tone === 'warn' ? P.warn : tone === 'good' ? P.good : P.ink2;
    return <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }} data-hw={id}>
      <button onClick={() => setO((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
        <Icon name={icon} size={14} stroke={1.9} color={c} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{title}</span>
        <div style={{ flex: 1 }} />
        {status && <span style={{ fontSize: 11.5, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{status}</span>}
        <Icon name="chevron-down" size={15} stroke={2.2} color={P.inkMute} style={{ transform: o ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: '0 0 auto' }} />
      </button>
      {o && <div style={{ padding: '12px 12px 12px', borderTop: `1px solid ${P.hairline}` }}>{children}</div>}
    </div>;
  };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 13, border: `1px solid ${gate && verify === 'pending' ? P.bad : '#1F5FC0'}`, borderRadius: P.r14, background: P.mode === 'dark' ? 'rgba(31,95,192,.08)' : 'rgba(31,95,192,.05)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <WmOrderTag />
      <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{wm.wmId} · Payment collected on handover</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: isDel ? P.info : P.ink2, background: isDel ? P.infoSoft : P.surface3, borderRadius: 99, padding: '2px 8px' }}><Icon name={isDel ? 'truck' : 'shop'} size={11} stroke={2.2} />{isDel ? 'Delivery' : 'Pickup'}</span>
      <div style={{ flex: 1 }} />
    </div>
    {/* Triage strip — the three things that decide what to do next, in one line. */}
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {[[verify === 'approved' ? 'check-circle' : verify === 'hold' ? 'clock' : 'shield', verify === 'approved' ? 'Verified' : verify === 'hold' ? 'On hold' : verify === 'canceled' ? 'Rejected' : 'Needs verification', verify === 'approved' ? P.good : verify === 'hold' ? P.warn : verify === 'canceled' ? P.bad : gate ? P.bad : P.warn],
      ['user-check', merge === 'merged' ? 'Customer merged' : wm.match === 'existing' ? 'Match to confirm' : wm.match === 'ambiguous' ? 'Two possible matches' : 'New customer', merge === 'merged' ? P.good : wm.match === 'new' ? P.ink2 : P.warn],
      [isDel ? 'truck' : 'shop', isDel ? idvA.tier >= 2 ? 'Delivery cleared' : 'ID check pending' : 'ID checked at the counter', isDel ? idvA.tier >= 2 ? P.good : P.warn : P.ink2]].map(([ic, lb, c]) =>
      <span key={lb} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: c + '14', color: c, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}><Icon name={ic} size={12} stroke={2.2} />{lb}</span>)}
    </div>
    {/* Phone confirmation / remote ID check — the one action staff need to reach
        WITHOUT digging through a fold, so it sits right under the triage chips on
        any delivery order still waiting on it. Pickup never gets an SMS. */}
    {verifyUp && <div data-hw="wm-sms">
      {remoteUp ?
      <window.RemoteIdPanel phone={(idv && idv.phone || {}).value || wm.contact.phone} remoteId={idv && idv.remoteId || wm.remoteId} onLog={onLog} onDoor={() => setDoor(true)} /> :
      <window.SmsVerifyPanel phone={(idv && idv.phone || {}).value || wm.contact.phone} state={(idv && idv.phone || {}).sentAt ? 'sent' : 'idle'} sentAt={(idv && idv.phone || {}).sentAt} onLog={onLog} />}
    </div>}
    {door && <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
      <Icon name="scan" size={15} color={P.good} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}><b>Deferred to a door scan.</b> The driver inspects and photographs the ID on delivery — that clears the account permanently, exactly like a counter scan.</span>
      <PBtn variant="ghost" size="xs" icon="x" onClick={() => setDoor(false)}>Undo</PBtn>
    </div>}
    {/* Order data as submitted on Weedmaps */}
    {view === 'detailed' && wm.contact && <Fold id="wm-submitted" icon="user" title="Order details" status="as submitted on Weedmaps" defOpen>
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}><Icon name="user" size={13} stroke={1.9} color={P.ink2} /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Contact on file</span><button onClick={() => setPeek(true)} title="Open the customer profile" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="user-check" size={11} stroke={2.2} />View profile</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', padding: '11px 12px', background: P.surface }}>
        {[['Name', wm.contact.name, wm.checks.name, false], ['Phone', wm.contact.phone, wm.checks.phone, true], ['Email', 'Not provided by Weedmaps', 'na', false], ...(wm.contact.address ? [['Delivery address', wm.contact.address, wm.checks.address, true]] : [])].map(([lb, val, st, mono]) => {const bad = badState(st);return <div key={lb} style={{ minWidth: 0, gridColumn: lb === 'Delivery address' ? '1/-1' : 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>{lb}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: bad ? P.bad : P.ink, fontFamily: mono ? P.fontMono : P.fontSans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>{bad && <Icon name="shield" size={11} stroke={2} color={P.bad} style={{ flex: '0 0 auto' }} />}</div>
        </div>;})}
      </div>
    </div></Fold>}
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
      {[['Our stage', stageMeta(o.stage).label, P.ink], ['Weedmaps status', cur.wm, '#1F5FC0'], ['Customer sees', cur.cust, cur.tone === 'good' ? P.good : cur.tone === 'bad' ? P.bad : P.ink2]].map(([k, v, c], i) =>
      <React.Fragment key={k}>
        {i > 0 && <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', color: P.inkFaint }}><Icon name="chevron-right" size={15} stroke={2.2} /></div>}
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: c, fontFamily: i === 1 ? P.fontMono : P.fontSans, marginTop: 2, lineHeight: 1.3 }}>{v}</div>
        </div>
      </React.Fragment>)}
    </div>
    {/* WM status progression — reference, not a decision. Folded by default. */}
    <Fold id="wm-status" icon="link" title="Weedmaps order status" status={cur.wm.replace(/_/g, ' ')} tone="good">
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}><Icon name="link" size={12} color="#1F5FC0" /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>What the customer sees</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>on weedmaps.com</span></div>
      <div style={{ padding: '14px 14px 12px', background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {window.HW.WM_STATUS_ORDER.map((ws, i) => {const ci = window.HW.WM_STATUS_ORDER.indexOf(cur.wm);const active = i === ci;const done = i < ci;return <React.Fragment key={ws}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= ci ? P.good : P.hairline2, marginTop: 9 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto', width: 76 }}>
              <span style={{ width: 20, height: 20, borderRadius: 99, background: active ? '#1F5FC0' : done ? P.good : P.surface3, color: active || done ? '#fff' : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', border: active || done ? 'none' : `1px solid ${P.hairline2}`, boxShadow: active ? '0 0 0 3px rgba(31,95,192,.18)' : 'none' }}>{done ? <Icon name="check" size={12} stroke={2.6} /> : <span style={{ fontSize: 10, fontWeight: 800, fontFamily: P.fontMono }}>{i + 1}</span>}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.02em', color: active ? P.ink : P.inkMute, textAlign: 'center', lineHeight: 1.2, fontFamily: P.fontMono }}>{ws.replace(/_/g, ' ')}</span>
            </div>
          </React.Fragment>;})}
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', background: P.accentSoft, borderRadius: P.r10 }}><Pill kind="accent" dot>Now</Pill><span style={{ fontSize: 11.5, color: P.ink2 }}>Weedmaps status <b style={{ color: P.ink }}>{cur.wm.replace(/_/g, ' ')}</b> — customer sees “{cur.cust}”</span></div>
      </div>
    </div></Fold>
    <Fold id="wm-fraud" icon="shield" title="Identity & fraud check" tone={wm.level === 'high' ? 'bad' : wm.level === 'medium' ? 'warn' : 'good'}
    status={verify === 'pending' ? wm.flags && wm.flags.length ? wm.flags.length + ' signal' + (wm.flags.length > 1 ? 's' : '') + ' · needs a decision' : 'needs a decision' : verify === 'approved' ? 'cleared' : verify === 'hold' ? 'on hold' : 'rejected'}
    defOpen={verify === 'pending'}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Icon name="shield" size={15} stroke={1.9} color={riskC} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Risk score</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: riskC, fontFamily: P.fontMono, textTransform: 'capitalize' }}>{wm.level} risk</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>score {wm.risk}/100</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden', marginBottom: 10 }}><div style={{ width: `${wm.risk}%`, height: '100%', background: riskC }} /></div>
      {view !== 'detailed' && (wm.flags && wm.flags.length ? <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: P.bad, marginBottom: 2 }}><Icon name="shield" size={13} stroke={2} color={P.bad} />{wm.flags.length} signal{wm.flags.length > 1 ? 's' : ''} to review before releasing</div> : <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: P.good, marginBottom: 2 }}><Icon name="check-circle" size={13} stroke={2} color={P.good} />Identity checks passed</div>)}
      {view === 'detailed' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <WmCheckRow label="Government ID / age" state={wm.checks.id} />
        <WmCheckRow label="Name" state={wm.checks.name} />
        <WmCheckRow label="Phone" state={wm.checks.phone} />
        {wm.checks.address !== 'n/a' && <WmCheckRow label="Delivery address" state={wm.checks.address} />}
      </div>}
      {wm.flags && wm.flags.length > 0 &&
        <div style={{ marginTop: 9, padding: '10px 12px', background: P.badSoft, borderRadius: P.r10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.bad, marginBottom: 6 }}>{wm.flags.length} fraud signal{wm.flags.length > 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {wm.flags.map((f, i) => <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11.5, color: P.ink2, lineHeight: 1.4 }}><Icon name="x" size={13} stroke={2.6} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />{f}</div>)}
        </div>
      </div>}
      {gate && verify === 'pending' &&
        <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.badSoft, borderRadius: P.r10, fontSize: 11.5, fontWeight: 600, color: P.bad }}><Icon name="truck" size={14} stroke={2} />Do not dispatch — high-risk delivery must be verified first.</div>}
      {verify === 'pending' ?
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <PBtn variant="accent" size="md" icon="check" full onClick={() => doVerify('approved')}>Verify & release</PBtn>
        <PBtn variant="secondary" size="md" icon="clock" onClick={() => doVerify('hold')}>Hold</PBtn>
        <PBtn variant="secondary" size="md" icon="shield" onClick={() => doVerify('canceled')}>Reject</PBtn>
      </div> :
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 11, padding: '10px 12px', borderRadius: P.r10, background: verify === 'approved' ? P.goodSoft : verify === 'hold' ? P.warnSoft : P.badSoft }}>
        <Icon name={verify === 'approved' ? 'check-circle' : verify === 'hold' ? 'clock' : 'shield'} size={16} stroke={2} color={verify === 'approved' ? P.good : verify === 'hold' ? P.warn : P.bad} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: P.ink }}>{verify === 'approved' ? 'Verified — cleared for fulfillment' : verify === 'hold' ? 'On hold — awaiting verification' : 'Rejected & reported as fraud'}</span>
        {verify !== 'approved' && <PBtn variant="soft" size="sm" onClick={() => doVerify('approved')}>Override & release</PBtn>}
      </div>}
    </div></Fold>
    <Fold id="wm-identity" icon="user-check" title="Customer identity"
    tone={merge === 'merged' ? 'good' : wm.match === 'ambiguous' ? 'warn' : 'neutral'}
    status={merge === 'merged' ? 'merged' : merge === 'separate' ? 'kept separate' : wm.match === 'existing' ? 'match found' : wm.match === 'ambiguous' ? 'needs review' : 'new customer'}
    defOpen={merge === 'idle' && wm.match !== 'new'}>
    <div data-hw="wm-identity-body">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Icon name="user-check" size={15} stroke={1.9} color={P.ink2} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Match</span>
        <Pill kind={wm.match === 'existing' ? 'good' : wm.match === 'ambiguous' ? 'warn' : 'neutral'} dot>{wm.match === 'existing' ? 'Match found' : wm.match === 'ambiguous' ? 'Needs review' : 'New customer'}</Pill>
        {idv && <span style={{ marginLeft: 'auto' }}><window.AssuranceBadge v={idv} size="sm" /></span>}
      </div>
      {merge === 'merged' ?
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, borderRadius: P.r10 }}>
        <Icon name="link" size={16} stroke={2} color={P.good} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Merged into {matched ? matched.name : 'existing customer'}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim }}>This order + WM profile now live under one customer. Logged to their history in Members.</div>
        </div>
      </div> :
        wm.match === 'existing' ? <>
        <p style={{ margin: '0 0 9px', fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>Matched an existing customer on {(wm.matchOn || ['phone', 'email']).map((k) => (MATCH_LABEL[k] || k).toLowerCase()).join(' + ')}. Merge to unify order history, wallet and loyalty — or keep separate if it’s a different person.</p>
        <MatchChips />
        {view === 'detailed' && <CompareRows m={matched} />}
        <WmMergeCandidate m={matched} conf={wm.matchConf} primary onMerge={() => doMerge(matched)} />
        <div style={{ marginTop: 8 }}><PBtn variant="secondary" size="sm" onClick={() => setMerge('separate')}>Keep as a separate customer</PBtn></div>
      </> :
        wm.match === 'ambiguous' ? <>
        <p style={{ margin: '0 0 9px', fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>Two customers match this order’s {(wm.matchOn || ['name', 'phone']).map((k) => (MATCH_LABEL[k] || k).toLowerCase()).join(' + ')}. Pick the right one to merge, or keep separate.</p>
        <MatchChips />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>{cand.map((m) => <WmMergeCandidate key={m.id} m={m} conf={wm.matchConf} onMerge={() => doMerge(m)} />)}</div>
        <div style={{ marginTop: 8 }}><PBtn variant="ghost" size="sm" onClick={() => setMerge('separate')}>None of these — keep separate</PBtn></div>
      </> : <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
          <Icon name="user-plus" size={16} stroke={1.9} color={P.ink2} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>No match — a new customer will be created</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Or search and link to an existing profile manually.</div></div>
          <PBtn variant="secondary" size="sm" icon="search">Find customer</PBtn>
        </div>
      </>}
      {merge === 'separate' && <div style={{ marginTop: 8, fontSize: 11.5, color: P.inkDim, fontStyle: 'italic' }}>Kept separate — recorded in the customer’s history.</div>}
      {/* Identity assurance. The SMS is a DELIVERY gate only — a Weedmaps
             pickup order is cleared by the counter ID check like any walk-in, so
             nothing is ever texted for one. */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }} data-hw="wm-assurance">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="shield" size={14} stroke={1.9} color={P.ink2} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Verification status</span>
          <span style={{ fontSize: 11.5, color: P.inkMute }}>· what this customer has already cleared</span>
          {verifyUp && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: P.warn, whiteSpace: 'nowrap' }}><Icon name="arrow-up" size={11} stroke={2.4} color={P.warn} />{remoteUp ? 'ID check link is at the top' : 'resend is at the top'}</span>}
        </div>
        {!isDel ? <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
          <Icon name="shop" size={15} color={P.ink2} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
            <b>Pickup — no phone-binding SMS is sent.</b> They collect in store, so the counter scans and photographs their ID at hand-off exactly like any walk-in. The binding SMS only exists for <b>remote</b> orders — but if you want their ID on file before they arrive, the <b>ID check link above</b> does it.
          </div>
        </div> : idv ? <>
          <window.IdentityLadder v={idv} compact />
          {!verifyUp && idvA.tier === 1 && <div style={{ marginTop: 11 }} data-hw="wm-sms-fold">
            <window.SmsVerifyPanel phone={(idv.phone || {}).value || wm.contact.phone} state={(idv.phone || {}).sentAt ? 'sent' : 'idle'} sentAt={(idv.phone || {}).sentAt} onLog={onLog} />
          </div>}
          {idvA.tier === 2 && <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: P.goodSoft, borderRadius: P.r10 }}>
            <Icon name="check-circle" size={15} color={P.good} />
            <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Cleared {idvA.via === 'remote' ? 'by a remote ID check' : idvA.via === 'door' ? 'by a driver ID scan at the door' : 'in store — ID scanned at the counter'}. <b>No Persona check needed</b>, now or later.</span>
          </div>}
        </> : <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
            <Icon name="shield" size={15} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
              <b>Nobody has ever seen this person’s ID.</b> Weedmaps does not pass us a verified document, so a brand-new WM contact starts at zero on our side.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', background: P.infoSoft, border: `1px solid ${P.info}44`, borderRadius: P.r10 }}>
            <Icon name="scan" size={15} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>ID check link sent automatically</div>
              <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>Weedmaps passes no verified document, so the system sends a remote ID-check link the moment a new WM contact appears. Nobody has to remember to trigger it — and the send, resend and door-scan controls are {verifyUp ? 'at the top of this block' : 'right below'}.</div>
            </div>
          </div>
          {!verifyUp && <window.RemoteIdPanel phone={wm.contact.phone} remoteId={idv && idv.remoteId || wm.remoteId} onLog={onLog} onDoor={() => setDoor(true)} />}
        </>}
      </div>
    </div></Fold>
    {peek && <window.CustomerPeek member={peekTarget} contact={wm.contact} idv={idv} onClose={() => setPeek(false)} />}
  </div>;
}

// Scan-to-pack overlay — hardware barcode scanner (keyboard-wedge) reads each
// unit to save/reserve/mark packed. No camera; no order-status change.
function PackScanner({ items, packScan, onScanOne, onDone, onClose }) {
  const P = useP();
  const inputRef = React.useRef(null);
  const [buf, setBuf] = React.useState('');
  const [last, setLast] = React.useState(null);
  const cnt = (i) => packScan[i] || 0;
  const totalUnits = items.reduce((a, l) => a + l.qty, 0);
  const doneUnits = items.reduce((a, l, i) => a + Math.min(l.qty, cnt(i)), 0);
  const next = items.findIndex((l, i) => cnt(i) < l.qty);
  const nl = next >= 0 ? items[next] : null;
  const allDone = next < 0;
  React.useEffect(() => {const t = setInterval(() => {if (inputRef.current && document.activeElement !== inputRef.current) inputRef.current.focus();}, 400);return () => clearInterval(t);}, []);
  const scan = () => {if (next < 0) return;setLast(items[next].name);onScanOne(next);setBuf('');};
  return <div onClick={(e) => {e.stopPropagation();inputRef.current && inputRef.current.focus();}} style={{ position: 'fixed', inset: 0, zIndex: 95, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fade .15s ease' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: P.ink, color: P.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="package" size={17} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>Scan to pack</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Hardware scanner · reserves stock · no status change</div></div>
        <IconBtn icon="x" size={18} onClick={onClose} />
      </div>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', border: `1.5px solid ${allDone ? P.good : P.accentBorder}`, background: allDone ? P.goodSoft : P.accentSoft, borderRadius: P.r12 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: allDone ? P.good : P.accent, flex: '0 0 auto' }} />
          <Icon name="package" size={18} stroke={1.9} color={P.ink2} style={{ flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input ref={inputRef} autoFocus value={buf} onChange={(e) => setBuf(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') {e.preventDefault();scan();}}} placeholder={allDone ? 'All items packed' : 'Waiting for scan…'} disabled={allDone} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }} />
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{allDone ? 'Done' : nl ? `Next: ${nl.name} · unit ${cnt(next) + 1}/${nl.qty}` : ''}</div>
          </div>
          {!allDone && <PBtn variant="secondary" size="sm" icon="package" onClick={scan}>Simulate scan</PBtn>}
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: P.inkDim, display: 'flex', alignItems: 'center', gap: 6 }}>{last && !allDone ? <span style={{ color: P.good, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check-circle" size={13} stroke={2} />Scanned {last}</span> : <span style={{ fontFamily: P.fontMono }}>Field stays focused — each scan from the handheld registers a unit &amp; reserves stock.</span>}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
        {items.map((l, i) => {const c = Math.min(l.qty, cnt(i));const complete = c >= l.qty;const isNext = i === next;return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', marginBottom: 8, background: complete ? P.goodSoft : isNext ? P.accentSoft : P.surface2, border: `1px solid ${complete ? P.good : isNext ? P.accentBorder : P.hairline2}`, borderRadius: P.r10 }}>
            {complete ? <Icon name="check-circle" size={17} stroke={2} color={P.good} style={{ flex: '0 0 auto' }} /> : <span style={{ flex: '0 0 auto', width: 17, height: 17, borderRadius: 99, border: `2px solid ${isNext ? P.accent : P.hairline3}` }} />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: P.fontMono, color: complete ? P.good : P.ink2 }}>{c}/{l.qty}</span>
          </div>);})}
      </div>
      <div style={{ padding: '14px 18px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: P.fontMono, color: allDone ? P.good : P.ink2 }}>{doneUnits}/{totalUnits} units packed &amp; reserved</span>
        <div style={{ flex: 1 }} />
        <PBtn variant={allDone ? 'accent' : 'secondary'} size="md" icon="check" onClick={onDone}>{allDone ? `Done — ${totalUnits} packed` : 'Done'}</PBtn>
      </div>
    </div>
  </div>;
}

// Order details + warranty/return/exchange — refunds go to WALLET only (never cash)
window.OrderDetails = function OrderDetails({ o, onClose }) {
  const P = useP();
  const dlv = window.HW.DELIVERY[o.id] || {};
  const wm = o.source === 'Weedmaps' ? window.HW.WM_ORDER[o.id] : null;
  const fmt = window.HW.fmt;
  const seed = (o.id ? o.id.length : 5) + (o.name || '').length + (o.items || 1);
  const pk = (arr) => arr[seed % arr.length];

  const [claimOpen, setClaimOpen] = React.useState(false);
  const [selected, setSelected] = React.useState({}); // { idx: qtySelected }
  const [reason, setReason] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [done, setDone] = React.useState(false);
  const [packScan, setPackScan] = React.useState({});
  const [scanOpen, setScanOpen] = React.useState(false);

  // Order is still in fulfillment (verify/pack/packing/ready) → editable, not returnable
  const inFulfillment = !!o.stage && o.stage !== 'done';
  const [editOpen, setEditOpen] = React.useState(false);
  const [draft, setDraft] = React.useState([]); // working copy of line items
  const [approval, setApproval] = React.useState(false);
  const [editNote, setEditNote] = React.useState('');
  const [extraLog, setExtraLog] = React.useState([]); // entries appended this session
  const [savedEdit, setSavedEdit] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);
  const [swapIdx, setSwapIdx] = React.useState(null); // draft row whose swap panel is open

  const baseItems = [
  { name: 'Cake Crasher', brand: window.HW_BRANDS.name.jeeter, cat: 'Flower', qty: 4, price: 15 },
  { name: 'Blueberry Pancakes', brand: window.HW_BRANDS.name.lowell, cat: 'Pre-Rolls', qty: 1, price: 17 },
  { name: 'Doubleshot Edible', brand: window.HW_BRANDS.name.wyld, cat: 'Edibles', qty: 2, price: 20 }].
  slice(0, Math.max(1, Math.min(3, o.items || 1)));

  // ── Order metadata ──
  const channel = o.channel === 'Delivery' ? 'delivery' : o.source === 'Web' || o.source === 'Weedmaps' || /pick/i.test(o.pay || '') ? 'pickup' : 'pos';
  const channelMeta = { pos: { label: 'POS · In-store', icon: 'register' }, pickup: { label: 'Pickup', icon: 'box' }, delivery: { label: 'Delivery', icon: 'truck' } }[channel];
  const associate = pk(['Manisha Saini', 'Devon Pierce', 'Carla Mendes', 'Theo Park']);
  const driver = dlv.driver && dlv.driver !== 'Unassigned' ? dlv.driver : 'Theo Reyes';
  const placedBy = channel === 'delivery' ? driver : associate;
  const placedRole = channel === 'delivery' ? 'Driver' : 'Sales associate';
  const date = pk(['Jun 10, 2026 · 2:14 PM', 'Jun 9, 2026 · 11:38 AM', 'Jun 8, 2026 · 5:02 PM', 'Jun 7, 2026 · 1:21 PM']);
  const storeName = window.HW.STORE.name;
  const hasDisc = seed % 2 === 0;
  const discReason = pk(['Veteran 10%', 'Daily deal · Edibles', 'Staff discount', 'Loyalty tier — Gold']);
  const discAmt = hasDisc ? pk([6, 8, 10, 12]) : 0;
  const hasPromo = seed % 3 !== 0;
  const promo0 = pk(['WELCOME10', 'HW420', 'SUMMER15', 'FRIENDS']);
  const [promo, setPromo] = React.useState(hasPromo ? promo0 : null);
  const [promoAmt, setPromoAmt] = React.useState(hasPromo ? pk([5, 8, 10]) : 0);
  const [referral, setReferral] = React.useState(null);
  const [referralAmt, setReferralAmt] = React.useState(0);
  const cartDisc = discAmt + promoAmt + referralAmt; // total cart-level discount
  const itemsSub = baseItems.reduce((s, l) => s + l.price * l.qty, 0);

  // ── Proportional discount allocation across each item (comment 6) ──
  const items = baseItems.map((l) => {
    const gross = l.price * l.qty;
    const discShare = itemsSub > 0 ? +(cartDisc * gross / itemsSub).toFixed(2) : 0;
    const net = gross - discShare;
    return { ...l, gross, discShare, net, unitNet: net / l.qty, unitDisc: discShare / l.qty };
  });
  const taxBase = items.reduce((s, l) => s + l.net, 0);

  // ── CA cannabis tax breakdown (comment 4) ──
  const stateExcise = +(taxBase * 0.15).toFixed(2); // state cannabis excise 15%
  const stateSales = +(taxBase * 0.06).toFixed(2); // state sales tax 6%
  const localTax = +(taxBase * 0.0222).toFixed(2); // local cannabis tax 2.22%
  const totalTax = +(stateExcise + stateSales + localTax).toFixed(2);
  const taxRate = taxBase > 0 ? totalTax / taxBase : 0;
  const grand = +(taxBase + totalTax).toFixed(2);

  // ── Payment detail — Leisure Pay style breakdown (comment 1) ──────────────
  // Deterministic per-order: cash / card / split, last-4, change, processor refs.
  const payKind = (() => {
    const p = (o.pay || '').toLowerCase();
    if (p.includes('split')) return 'split';
    if (p.includes('cash')) return 'cash';
    if (p.includes('card') || p.includes('credit') || p.includes('debit')) return 'card';
    return ['cash', 'card', 'split', 'card'][seed % 4];
  })();
  const cardBrands = ['Visa', 'Mastercard', 'Amex', 'Discover'];
  const mkCard = (n) => {
    const brand = cardBrands[(seed + n) % 4];
    const last4 = String(1000 + (seed * 37 + n * 911) % 9000).slice(0, 4);
    return { brand, last4, type: ['Credit', 'Debit'][(seed + n) % 2], auth: 'A' + (100000 + (seed * 53 + n * 131) % 899999), aid: 'A000000003' + (10 + n), entry: ['Chip', 'Tap', 'Swipe'][(seed + n) % 3] };
  };
  let payment;
  if (payKind === 'cash') {
    const tendered = Math.ceil(grand / 5) * 5 + (seed % 2 === 0 ? 0 : 5); // rounded-up bill(s)
    payment = { kind: 'cash', parts: [{ kind: 'cash', amount: grand, tendered, change: +(tendered - grand).toFixed(2) }] };
  } else if (payKind === 'card') {
    payment = { kind: 'card', parts: [{ kind: 'card', amount: grand, ...mkCard(0) }] };
  } else {
    const cardAmt = +(Math.round(grand * 0.6 * 100) / 100).toFixed(2);
    const cashAmt = +(grand - cardAmt).toFixed(2);
    const tendered = Math.ceil(cashAmt / 5) * 5;
    payment = { kind: 'split', parts: [
      { kind: 'card', amount: cardAmt, ...mkCard(0) },
      { kind: 'cash', amount: cashAmt, tendered, change: +(tendered - cashAmt).toFixed(2) }]
    };
  }
  const payProcessor = 'Leisure Pay';
  const payRef = 'LP-' + (o.id || '').replace(/\D/g, '').padStart(6, '0') + '-' + (seed % 90 + 10);
  const payLabel = payment.kind === 'split' ? 'Split' : payment.kind === 'cash' ? 'Cash' : `${payment.parts[0].brand} ••${payment.parts[0].last4}`;
  const paySub = payment.kind === 'split' ? `${payment.parts[0].brand} + cash` : payment.kind === 'cash' ? `${fmt.money(payment.parts[0].change)} change` : `${payment.parts[0].type} · ${payment.parts[0].entry}`;
  // Payment isn't captured until the order is completed & paid. Until then, never
  // surface change given, auth codes, or a Leisure Pay transaction number (comment).
  // We do not take payment online. A customer picks a payment TYPE up front;
  // the money is always collected at hand-over — by the driver at the door, or
  // at the counter on pickup. So there is never an authorization on file.
  const settleAt = channel === 'delivery' ? 'delivery' : 'pickup';
  const metaPayValue = inFulfillment ? payLabel.replace(/ ••\d+$/, '') : payLabel;
  const metaPaySub = inFulfillment ? `Collected at ${settleAt}` : paySub;

  // ── Single return / exchange / warranty flow (comment 5) ──
  const reasons = ['Changed mind', 'Wrong item', 'Didn’t like effect', 'Wrong strain / potency', 'Defective — won’t fire', 'Leaking / damaged', 'Expired product', 'Priced wrong'];
  const selEntries = Object.entries(selected).filter(([, q]) => q > 0).map(([i, q]) => ({ item: items[+i], q }));
  const refundAmt = +selEntries.reduce((s, { item, q }) => s + item.unitNet * (1 + taxRate) * q, 0).toFixed(2);
  const refundUnits = selEntries.reduce((s, { q }) => s + q, 0);
  const canSubmit = claimOpen && selEntries.length > 0 && reason;

  const toggleItem = (i) => setSelected((p) => {const n = { ...p };if (n[i]) delete n[i];else n[i] = 1;return n;});
  const setItemQty = (i, q) => setSelected((p) => ({ ...p, [i]: Math.max(1, Math.min(items[i].qty, q)) }));
  const startClaim = () => {setClaimOpen(true);setSelected({});setReason(null);setNote('');};

  // ── Edit-order flow (fulfillment orders) ──
  const startEdit = () => {setDraft(baseItems.map((l) => ({ ...l })));setEditOpen(true);setApproval(false);setEditNote('');};
  const draftSetQty = (i, q) => setDraft((d) => d.map((l, idx) => idx === i ? { ...l, qty: Math.max(0, q) } : l));
  const draftRemove = (i) => setDraft((d) => d.filter((_, idx) => idx !== i));
  // Replace the product on a line, keeping its quantity. A PARTIAL candidate
  // cannot cover the whole line, so it SPLITS: the covered units become the new
  // product and the rest stay on the original. Replacing outright there would
  // promise units the store does not have.
  const draftSwap = (i, c) => setDraft((d) => d.map((l, idx) => {
    if (idx !== i) return l;
    return { name: c.product.name, brand: c.product.brand, cat: c.product.cat,
      qty: c.partial ? c.fillable : l.qty, price: c.product.price };
  }).reduce((acc, l, idx) => {
    acc.push(l);
    if (idx === i && c.partial && c.shortfall > 0) {
      const orig = d[i];
      acc.push({ name: orig.name, brand: orig.brand, cat: orig.cat, qty: c.shortfall, price: orig.price });
    }
    return acc;
  }, []));

  const draftAdd = (p) => setDraft((d) => {const ex = d.find((l) => l.name === p.name);return ex ? d.map((l) => l.name === p.name ? { ...l, qty: l.qty + 1 } : l) : [...d, { name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price }];});
  const draftSub = draft.reduce((s, l) => s + l.price * l.qty, 0);
  const draftDisc = Math.min(cartDisc, draftSub);
  const draftTaxBase = draftSub - draftDisc;
  const draftGrand = +(draftTaxBase + window.HW.taxBreakdown(draftTaxBase).total).toFixed(2);
  const balanceDiff = +(draftGrand - grand).toFixed(2); // + = balance due, − = refund due
  const removedCount = baseItems.length - draft.filter((l) => l.qty > 0).length;
  const needsApproval = balanceDiff < -0.01 || removedCount > 0; // refunds / removals need a manager
  const editChanged = Math.abs(balanceDiff) > 0.01 || draft.length !== baseItems.length || draft.some((l, i) => !baseItems[i] || baseItems[i].qty !== l.qty);
  const canSaveEdit = editChanged && (!needsApproval || approval);

  const saveEdit = () => {
    const verb = balanceDiff > 0 ? `+${fmt.money(balanceDiff)} due at ${channel === 'delivery' ? 'delivery' : 'pickup'}` : balanceDiff < 0 ? `${fmt.money(Math.abs(balanceDiff))} to wallet` : 'no balance change';
    setExtraLog((l) => [...l, { who: 'Manisha Saini', role: 'You', action: `Edited order · ${verb}${approval ? ' · mgr approved (Carla M.)' : ''}`, time: 'just now', icon: 'pencil', accent: true }]);
    setEditOpen(false);setSavedEdit(true);
  };

  // ── Activity log — who did what, manager approvals, etc. ──
  const stageOrder = ['verify', 'pack', 'packing', 'ready', 'done'];
  const reached = stageOrder.indexOf(o.stage || 'done');
  const baseLog = [
  { who: channel === 'delivery' || channel === 'pickup' ? 'Online order' : associate, role: channel === 'pos' ? 'Sales associate' : 'Web', action: `Order created · ${channelMeta.label}`, time: date.split(' · ')[1] || date, icon: 'plus' },
  reached >= 0 && { who: associate, role: 'Sales associate', action: 'ID verified · age check passed', time: '2:16 PM', icon: 'check-circle' },
  reached >= 1 && { who: pk(['Devon Pierce', 'Carla Mendes']), role: 'Budtender', action: 'Pick ticket printed · staged to pack', time: '2:21 PM', icon: 'box' },
  reached >= 2 && { who: pk(['Theo Park', 'Devon Pierce']), role: 'Budtender', action: 'Packing started', time: '2:28 PM', icon: 'box' },
  hasDisc && { who: 'Carla Mendes', role: 'Manager', action: `Approved discount · ${discReason}`, time: '2:30 PM', icon: 'shield', accent: true },
  reached >= 3 && { who: pk(['Theo Park', 'Devon Pierce']), role: 'Budtender', action: channel === 'delivery' ? 'Handed to driver · ' + driver : 'Ready for pickup · customer notified', time: '2:34 PM', icon: 'check' },
  reached >= 4 && { who: o.name, role: 'Customer', action: 'Order completed · receipt sent', time: '2:41 PM', icon: 'check-circle' }].
  filter(Boolean);
  const fullLog = [...baseLog, ...extraLog];

  const Meta = ({ icon, label, value, sub, accent }) =>
  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      <span style={{ flex: '0 0 auto', width: 28, height: 28, borderRadius: 7, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}><Icon name={icon} size={14} stroke={1.9} /></span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', lineHeight: 1.5, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: accent ? P.accentText : P.ink, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{value}</span>
        {sub && <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, lineHeight: 1.4, whiteSpace: 'nowrap' }}>{sub}</span>}
      </div>
    </div>;
  const TotRow = ({ k, v, color, strong, neg }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: strong ? 14 : 12, lineHeight: 1.7 }}>
      <span style={{ color: strong ? P.ink : P.inkDim, fontWeight: strong ? 700 : 500, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ flex: '0 0 auto', color: color || P.ink, fontWeight: strong ? 700 : 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{neg ? '−' : ''}{v}</span>
    </div>;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '34px 20px', animation: 'fade .15s ease', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden', border: `1px solid ${P.hairline2}` }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
          <Avatar name={o.name} size={38} crown={o.badge === 'Member'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{o.name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: P.ink2, background: P.surface3, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}><Icon name={channelMeta.icon} size={11} stroke={2} />{channelMeta.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>Order #{o.id} · {date}</div>
          </div>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute }}>Total</span><span style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.01em', marginTop: 3 }}>{fmt.money(grand)}</span></span>
          {inFulfillment && !editOpen && !savedEdit &&
          <PBtn variant="secondary" size="sm" icon="pencil" style={{ flex: '0 0 auto' }} onClick={startEdit}>Edit order</PBtn>}
          <IconBtn icon="x" size={17} onClick={onClose} />
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {wm && <WmOrderBlock o={o} wm={wm} onLog={(e) => setExtraLog((l) => [...l, e])} />}
          {/* Edit-order controls — kept at the top of the record (conventional),
                     not buried at the very bottom (comment). */}
          {inFulfillment && (editOpen || savedEdit) &&
          <div style={{ border: `1px solid ${editOpen ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, background: editOpen ? P.accentSoft : P.surface2, padding: 13 }}>
              {savedEdit ?
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="check-circle" size={20} stroke={2} color={P.good} /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Order updated</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Logged to activity · no payment taken · balance settles at {channel === 'delivery' ? 'delivery' : 'pickup'}.</div></div><PBtn variant="soft" size="sm" onClick={() => setSavedEdit(false)}>Edit again</PBtn></div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="pencil" size={15} stroke={1.9} color={P.ink2} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Editing order</span>
                    <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>Adjust items below — no payment taken · balance settles at {channel === 'delivery' ? 'delivery' : 'pickup'}.</span>
                  </div>
                  <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Reason for edit (e.g. out of stock, customer added an item)…" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none', boxSizing: 'border-box' }} />
                  {needsApproval &&
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: approval ? P.goodSoft : P.warnSoft, borderRadius: P.r10, cursor: 'pointer' }}>
                      <Check on={approval} onChange={() => setApproval((a) => !a)} size={18} />
                      <Icon name="shield" size={15} stroke={1.9} color={approval ? P.good : P.warn} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Manager approval required</div>
                        <div style={{ fontSize: 11.5, color: P.inkDim }}>{removedCount > 0 ? 'Removing items' : 'Refund to wallet'} needs a manager. {approval ? 'Approved · Carla M.' : 'Tap to approve.'}</div>
                      </div>
                    </label>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <PBtn variant="secondary" size="md" onClick={() => setEditOpen(false)}>Cancel</PBtn>
                    <PBtn variant="accent" size="md" icon="check" disabled={!canSaveEdit} onClick={saveEdit}>Save changes</PBtn>
                  </div>
                </div>}
            </div>}
          {/* Order metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 16px', padding: 13, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r14 }}>
            <Meta icon="calendar" label="Placed" value={date.split(' · ')[0]} sub={date.split(' · ')[1]} />
            <Meta icon="shop" label="Store" value={storeName.replace(/^Hyperwolf /, '')} sub={window.HW.STORE.id} />
            <Meta icon={channelMeta.icon} label="Channel" value={channelMeta.label} />
            <Meta icon={channel === 'delivery' ? 'truck' : 'user'} label={placedRole} value={placedBy} sub={channel === 'delivery' ? (dlv.zone || 'Lake Elsinore') + ' route' : 'Register 2'} accent />
            <Meta icon={payment.kind === 'cash' ? 'cash' : 'card'} label="Payment" value={metaPayValue} sub={metaPaySub} />
            <Meta icon="receipt" label="Status" value={inFulfillment ? stageMeta(o.stage).label : 'Completed'} sub={`${items.length} items`} />
          </div>

          {/* Discounts & promo */}
          {(hasDisc || hasPromo) &&
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hasDisc &&
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: P.r10 }}>
                  <Icon name="tag" size={14} stroke={1.9} color={P.accentText} />
                  <div><div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Discount · {discReason}</div><div style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono }}>−{fmt.money(discAmt)} applied</div></div>
                </div>}
              {hasPromo &&
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
                  <Icon name="gift" size={14} stroke={1.9} color={P.info} />
                  <div><div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, letterSpacing: '.04em' }}>{promo}</div><div style={{ fontSize: 10, color: P.inkDim, fontFamily: P.fontMono }}>Promo code · −{fmt.money(promoAmt)}</div></div>
                </div>}
            </div>}

          {/* Payment — captured breakdown (change given, auth, Leisure Pay ref) only
                      once the order is completed & paid. In fulfillment → pending note. */}
          {!inFulfillment ?
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <Eyebrow>Payment</Eyebrow>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}><Icon name="lock" size={11} stroke={1.9} />{payProcessor} · {payRef}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {payment.parts.map((pt, i) => <PayPart key={i} pt={pt} P={P} fmt={fmt} single={payment.parts.length === 1} />)}
              {payment.kind === 'split' &&
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: P.ink }}>
                  <span>Total captured</span><span style={{ fontFamily: P.fontMono }}>{fmt.money(grand)}</span>
                </div>}
            </div>
          </div> :
          <div>
            <Eyebrow style={{ marginBottom: 9 }}>Payment</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
              <span style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 7, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={15} stroke={1.9} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{`Payment due at ${settleAt}`}</div>
                <div style={{ fontSize: 11.5, color: P.inkDim }}>{`${payLabel.replace(/ ••\d+$/, '')} selected — nothing is captured until the order is handed over at ${settleAt}.`}</div>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{fmt.money(grand)}</span>
            </div>
          </div>}

          {/* Items */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <Eyebrow>Items{editOpen ? ' · editing' : ''}</Eyebrow>
              {claimOpen && <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>Select item(s) &amp; qty to return</span>}
              {editOpen && <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>Adjust qty or remove — no payment taken</span>}
              {inFulfillment && !editOpen && !claimOpen && <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: items.reduce((a, l, i) => a + Math.min(l.qty, packScan[i] || 0), 0) >= items.reduce((a, l) => a + l.qty, 0) ? P.good : P.inkMute }}>{items.reduce((a, l, i) => a + Math.min(l.qty, packScan[i] || 0), 0)}/{items.reduce((a, l) => a + l.qty, 0)} packed</span>
                <PBtn variant={items.reduce((a, l, i) => a + Math.min(l.qty, packScan[i] || 0), 0) >= items.reduce((a, l) => a + l.qty, 0) ? 'soft' : 'accent'} size="sm" icon="package" onClick={() => setScanOpen(true)}>{items.reduce((a, l, i) => a + Math.min(l.qty, packScan[i] || 0), 0) >= items.reduce((a, l) => a + l.qty, 0) ? 'Re-scan' : 'Scan to pack'}</PBtn>
              </div>}
            </div>
            {editOpen ?
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {draft.map((l, i) =>
              <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: l.qty === 0 ? P.badSoft : P.surface2, border: `1.5px solid ${l.qty === 0 ? P.bad : P.hairline}`, borderRadius: P.r10 }}>
                    <Thumb item={{ name: l.name, cat: l.cat }} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, textDecoration: l.qty === 0 ? 'line-through' : 'none' }}>{l.name}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{l.brand} · {fmt.money(l.price)} ea</div>
                    </div>
                    <Stepper value={l.qty} min={0} max={99} onChange={(q) => draftSetQty(i, q)} size="sm" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, width: 56, textAlign: 'right' }}>{fmt.money(l.price * l.qty)}</span>
                    <IconBtn icon="swap" size={14} style={{ width: 28, height: 28 }} title="Swap for another product" onClick={() => {setSwapIdx((x) => x === i ? null : i);setShowAdd(false);}} />
                    <IconBtn icon="trash" size={14} style={{ width: 28, height: 28 }} onClick={() => draftRemove(i)} />
                  </div>
                {swapIdx === i && <SwapPanel P={P} fmt={fmt} line={l} draft={draft}
                  onClose={() => setSwapIdx(null)}
                  onSwap={(c) => {draftSwap(i, c);setSwapIdx(null);}} />}
                </React.Fragment>
              )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowAdd((s) => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', background: showAdd ? P.surface3 : 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r10, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name={showAdd ? 'x' : 'plus'} size={14} stroke={2.2} />{showAdd ? 'Close product picker' : 'Add item'}</button>
                  {showAdd && <AddItemPanel P={P} fmt={fmt} draft={draft} onAdd={draftAdd} />}
                </div>
              </div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((l, i) => {
                const active = !!selected[i];
                const pickable = claimOpen && !done;
                const packed = inFulfillment && (packScan[i] || 0) >= l.qty;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: packed ? P.goodSoft : active ? P.accentSoft : P.surface2, border: `1.5px solid ${packed ? P.good : active ? P.accentBorder : P.hairline}`, borderRadius: P.r10, cursor: pickable ? 'pointer' : 'default' }} onClick={() => pickable && toggleItem(i)}>
                    {packed && <Icon name="check-circle" size={16} stroke={2} color={P.good} style={{ flex: '0 0 auto' }} />}
                    {pickable &&
                    <span style={{ flex: '0 0 auto', width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${active ? P.accentBorder : P.hairline3}`, background: active ? P.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{active && <Icon name="check" size={11} stroke={3} color={P.accentInk} />}</span>}
                    <Thumb item={{ name: l.name, cat: l.cat }} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{l.name}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{l.brand} · {fmt.money(l.price)} ea{l.discShare > 0 ? ` · −${fmt.money(l.discShare)} disc` : ''}</div>
                    </div>
                    {/* per-item qty selector when this item is selected & qty>1 (comment 7) */}
                    {pickable && active && l.qty > 1 ?
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Stepper value={selected[i]} min={1} max={l.qty} onChange={(q) => setItemQty(i, q)} size="sm" />
                        <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>of {l.qty}</span>
                      </div> :
                    <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>×{l.qty}</span>}
                    <div style={{ width: 64, textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{fmt.money(l.net)}</div>
                      {l.discShare > 0 && <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, textDecoration: 'line-through' }}>{fmt.money(l.gross)}</div>}
                    </div>
                  </div>);
              })}
            </div>}
            {/* Totals — proportional discount + CA tax breakdown */}
            {editOpen ?
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${P.hairline2}` }}>
                <PromoEditor promo={promo} promoAmt={promoAmt} referral={referral} referralAmt={referralAmt}
              onPromo={(c, v) => {setPromo(c);setPromoAmt(v);}} onReferral={(c, v) => {setReferral(c);setReferralAmt(v);}} />
                <TotRow k="New subtotal" v={fmt.money(draftSub)} />
                {draftDisc > 0 && <TotRow k="Discounts applied" v={fmt.money(draftDisc)} color={P.good} neg />}
                {window.HW.taxBreakdown(draftTaxBase).lines.map((t) => <TotRow key={t.k} k={t.k} v={fmt.money(t.v)} />)}
                <TotRow k="New total" v={fmt.money(draftGrand)} strong />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 6, padding: '9px 11px', borderRadius: P.r10, background: balanceDiff > 0 ? P.warnSoft : balanceDiff < 0 ? P.goodSoft : P.surface2, border: `1px solid ${balanceDiff > 0 ? P.warn + '55' : balanceDiff < 0 ? P.good + '55' : P.hairline}` }}>
                  <Icon name={balanceDiff > 0 ? 'cash' : balanceDiff < 0 ? 'wallet' : 'check'} size={15} color={balanceDiff > 0 ? P.warn : balanceDiff < 0 ? P.good : P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{balanceDiff > 0 ? `Balance due at ${channel === 'delivery' ? 'delivery' : 'pickup'}` : balanceDiff < 0 ? 'Overpayment — credited to wallet' : 'No balance change'}</div>
                    <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>{balanceDiff > 0 ? 'Collect the difference when the order is handed over.' : balanceDiff < 0 ? 'Applied automatically on save — store credit, not a cash refund. Nothing to click.' : 'The edited order costs the same as the original.'}</div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: P.fontMono, flex: '0 0 auto', color: balanceDiff > 0 ? P.warn : balanceDiff < 0 ? P.good : P.inkMute }}>{balanceDiff > 0 ? '+' : balanceDiff < 0 ? '−' : ''}{fmt.money(Math.abs(balanceDiff))}</span>
                </div>
              </div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${P.hairline2}` }}>
              <TotRow k="Subtotal" v={fmt.money(itemsSub)} />
              {hasDisc && <TotRow k={`Discount · ${discReason}`} v={fmt.money(discAmt)} color={P.good} neg />}
              {promo && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '3px 0', padding: '7px 11px', background: P.goodSoft, border: `1px solid ${P.good}33`, borderRadius: P.r8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: P.good }}><Icon name="tag" size={14} stroke={2.2} />Promo · {promo}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: P.good, fontFamily: P.fontMono }}>−{fmt.money(promoAmt)}</span>
              </div>}
              {referral && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '3px 0', padding: '7px 11px', background: P.infoSoft, border: `1px solid ${P.info}33`, borderRadius: P.r8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: P.info }}><Icon name="link" size={14} stroke={2.2} />Referral · {referral}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: P.info, fontFamily: P.fontMono }}>−{fmt.money(referralAmt)}</span>
              </div>}
              {cartDisc > 0 && <TotRow k="Net subtotal" v={fmt.money(taxBase)} />}
              <TotRow k="Local cannabis tax (2.22%)" v={fmt.money(localTax)} />
              <TotRow k="State excise tax (15%)" v={fmt.money(stateExcise)} />
              <TotRow k="State sales tax (6%)" v={fmt.money(stateSales)} />
              <TotRow k="Total" v={fmt.money(grand)} strong />
            </div>}
          </div>

          {/* Activity log — who did what, approvals (comment 1) */}
          {scanOpen && <PackScanner items={items} packScan={packScan} onScanOne={(i) => setPackScan((s) => ({ ...s, [i]: (s[i] || 0) + 1 }))} onClose={() => setScanOpen(false)} onDone={() => {setScanOpen(false);setExtraLog((l) => [...l, { who: 'Manisha Saini', role: 'You', action: `Scanned & packed ${items.reduce((a, x) => a + x.qty, 0)} items · reserved from inventory`, time: 'just now', icon: 'package', accent: true }]);}} />}
          <div>
            <Eyebrow style={{ marginBottom: 9 }}>Activity log</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {fullLog.map((e, i) =>
              <div key={i} style={{ display: 'flex', gap: 11, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 99, background: e.accent ? P.accentSoft : P.surface3, color: e.accent ? P.accentText : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${e.accent ? P.accentBorder : P.hairline2}` }}><Icon name={e.icon} size={13} stroke={1.9} /></span>
                    {i < fullLog.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 14, background: P.hairline2 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: i < fullLog.length - 1 ? 12 : 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.35 }}>{e.action}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{e.who} · {e.role} · {e.time}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ACTION — completed orders → return / exchange / warranty.
                     Edit order now lives in the header + a top bar (comment), not here. */}
          {done || inFulfillment ? null :
          <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, background: P.surface2, padding: 13 }}>
              {!claimOpen ?
            <button onClick={startClaim} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 13px', background: P.surface, border: `1.5px solid ${P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                  <span style={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="refresh" size={17} stroke={1.9} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Start a return / exchange / warranty</div>
                    <div style={{ fontSize: 11.5, color: P.inkDim }}>One flow — select items, choose a reason, credit the wallet.</div>
                  </div>
                  <Icon name="chevron-right" size={16} color={P.inkFaint} />
                </button> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Icon name="refresh" size={14} stroke={1.9} color={P.ink2} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Return · Exchange · Warranty</span>
                    <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>{refundUnits > 0 ? `${refundUnits} unit${refundUnits > 1 ? 's' : ''} selected` : 'select items above'}</span>
                  </div>

                  {/* Reason */}
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, marginBottom: 7 }}>Reason</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {reasons.map((r) => {
                    const a = reason === r;
                    return <button key={r} onClick={() => setReason(r)} style={{ padding: '6px 11px', borderRadius: P.r999, border: `1px solid ${a ? P.accentBorder : P.hairline2}`, background: a ? P.accentSoft : P.surface, color: a ? P.ink : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{r}</button>;
                  })}
                    </div>
                  </div>

                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional) — condition, manager approval…" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none', boxSizing: 'border-box' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, borderRadius: P.r10 }}>
                    <Icon name="wallet" size={16} stroke={1.9} color={P.good} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Credited to customer wallet</div>
                      <div style={{ fontSize: 11.5, color: P.inkDim }}>Item value incl. tax · proportional discount applied · no cash refunds.</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: P.good, fontFamily: P.fontMono }}>+{fmt.money(refundAmt)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <PBtn variant="secondary" size="md" onClick={() => setClaimOpen(false)}>Cancel</PBtn>
                    <PBtn variant="accent" size="md" icon="wallet" disabled={!canSubmit} onClick={() => setDone(true)}>Credit {fmt.money(refundAmt)} to wallet</PBtn>
                  </div>
                </div>}
            </div>}

          {done &&
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: P.goodSoft, borderRadius: P.r12 }}>
              <Icon name="check-circle" size={22} stroke={2} color={P.good} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{fmt.money(refundAmt)} credited to {o.name.split(' ')[0]}’s wallet</div>
                <div style={{ fontSize: 11.5, color: P.inkDim }}>{refundUnits} unit{refundUnits > 1 ? 's' : ''} · {reason} · receipt sent</div>
              </div>
              <PBtn variant="soft" size="md" onClick={onClose}>Done</PBtn>
            </div>}
        </div>
      </div>
    </div>);

};

// Exported so other screens mount the SAME component rather than a fork — the
// check-in queue has to behave identically wherever it appears.
Object.assign(window, { CheckInStrip });