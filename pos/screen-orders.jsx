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
  // Header 'Filters' had no handler at all — the one control that promises to
  // narrow the queue did nothing. It now drives the same `visible` set the
  // search box does, so a filter that is ON is visible in the count below.
  const [qf, setQf] = React.useState({ source: 'All', pay: 'All' });
  const [filtOpen, setFiltOpen] = React.useState(false);
  // Local overrides for order ↔ check-in binding (what the associate resolved
  // this shift). bindOf() reads the engine's answer unless a human changed it.
  const [binds, setBinds] = React.useState({});
  const [matching, setMatching] = React.useState(null); // order awaiting a manual match
  const bindOf = (o) => binds[o.id] || window.HW.bindFor(o);
  const setBind = (id, b) => setBinds((prev) => ({ ...prev, [id]: b }));
  const confirmBind = (o) => setBind(o.id, { ...bindOf(o), state: 'auto', conf: 100, confirmedBy: 'Manisha Saini' });
  const bindTo = (o, checkinId, guest) => setBind(o.id, { state: 'auto', conf: 100, checkinId, guest, signals: ['handle'], boundBy: 'Manisha Saini' });
  const orders = window.HW.ORDERS;
  // Reads the live check-in store — a new check-in has to appear in the strip
  // above, not just close its modal.
  const checkins = window.useHW().CHECKINS;
  const isDelivery = tab === 'delivery';
  const channelOf = (o) => isDelivery ? o.channel === 'Delivery' : o.channel === 'Store';
  const visible = orders.filter((o) => channelOf(o) &&
  (!q || (o.name + o.id).toLowerCase().includes(q.toLowerCase())) &&
  (qf.source === 'All' || o.source === qf.source) &&
  (qf.pay === 'All' || o.pay === qf.pay));
  const nFilt = ['source', 'pay'].filter((k) => qf[k] !== 'All').length;
  // An order with no owner never enters the fulfilment flow — it waits in the lane.
  const unowned = visible.filter((o) => bindOf(o).state === 'none');
  const owned = visible.filter((o) => bindOf(o).state !== 'none');

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      <SectionHead level={1} eyebrow="Fulfillment" title="Order Queue"
      subtitle="Live pickup & delivery orders across the floor"
      action={<div style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" icon="link" size="md" onClick={() => setWmMapOpen(true)}>WM status map</PBtn>
          <QueueFilters value={qf} onChange={setQf} orders={orders} open={filtOpen} onOpen={setFiltOpen} shown={visible.length} />
          <PBtn variant="accent" icon="plus" size="md" onClick={onStartSale}>New Sale</PBtn>
        </div>} />
      {wmMapOpen && <WmStatusMapModal onClose={() => setWmMapOpen(false)} />}
      {/* Dev orientation: what this queue does that is not visible from the
          rows themselves — how retries are paced, what is deliberately
          serialised, and where the gates actually live. */}
      {/* TONE STAYS 'gap', AND THE TITLE NAMES WHICH GAP. The cross-order
          stall this note used to be about IS fixed, and it was retoned to
          'info' on that basis — which silently removed the KNOWN GAP badge
          (dev-note.jsx renders it for tone='gap' only) from a note whose first
          paragraph still promised the operator something that does not exist:
          a way to requeue a permanently-failed push. There is no
          /api/fulfillment/requeue route and no control on any screen;
          fulfillment.requeue() has zero shipping callers. Until that is wired,
          this screen keeps the one visual marker that says something here is
          unfinished, and the sentence below says plainly what it costs. */}
      <DevNote id="orders-gates-and-queue" tone="gap"
               title="Status pushes retry forever and no longer block each other — but a permanently failed push cannot be requeued from any screen">
        <DevNoteP>
          Every stage change queues an outbound push to Weedmaps. Those pushes
          are retried by a background loop, not by your click &mdash; so a push
          that failed is not lost, and you do not need to tap another stage to
          make it move. Weedmaps answers 403 on a large share of pushes today;
          403 is treated as a statement about the <b>integration</b>, not about
          the order, so it stays pending and is retried.
        </DevNoteP>
        <DevNoteP>
          <b>The gap:</b> 400/404/409/410/422 are treated as permanent and the
          row leaves the retry pool. Putting one back is deliberately a human
          decision &mdash; but there is <b>no button for it</b>. The server
          function exists (<DevNoteMono>fulfillment.requeue()</DevNoteMono>) and
          nothing calls it: no route, no control here. Today a permanently
          failed push can only be revived by someone with direct database
          access. If you are reading this because a status never reached
          Weedmaps and the strip above shows it under <i>permanently failed</i>,
          that is the reason, and it needs an engineer.
        </DevNoteP>
        <DevNoteP>
          <b>One failing order no longer stalls the others.</b> A push that
          fails sets a per-row <DevNoteMono>next_attempt_at</DevNoteMono> on its
          <DevNoteMono>wm_status_queue</DevNoteMono> row (about 30s, doubling to
          a hard 5-minute ceiling &mdash; each wait is shortened by up to 10% so
          a batch that failed together does not come due together), so it drops
          out of the next selection and the rows behind it get their turn.
          Before this, the drain reclaimed the same oldest rows every pass and
          everything behind the head was never attempted at all.
        </DevNoteP>
        <DevNoteP>
          <b>Still true, and on purpose:</b> pushes for the <i>same</i> order are
          serialised. A row is not attempted while an older undelivered row for
          that order still exists, so an order whose first push is backed off
          will not have its later status delivered early &mdash; otherwise
          Weedmaps could accept <DevNoteMono>COMPLETE</DevNoteMono> and then
          <DevNoteMono>IN_PROGRESS</DevNoteMono> and show &ldquo;Store is
          preparing your order&rdquo; on an order the customer already collected.
          So a stuck order still lags; the other orders no longer wait for it.
        </DevNoteP>
        <DevNoteP>
          Verification gates are enforced server-side, not here: pickup handoff
          is blocked, discounts and promos are gated, and delivery dispatch is
          gated. In-store ID scan counts as document-backed verification, so a
          customer verified at the counter is <b>not</b> sent through Didit
          again.
        </DevNoteP>
      </DevNote>

      {/* The queue's own health, from GET /api/fulfillment/board. Deliberately
          ABOVE the tabs: it is a fact about every order on this screen, pickup
          and delivery alike, and it is the only thing that distinguishes "the
          drain has nothing to do" from "every push is sitting out a backoff".
          Renders nothing at all when there is no live server to ask. */}
      <QueueHealthStrip />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Seg value={tab} onChange={setTab} size="lg" options={[
        { value: 'pickup', label: 'Pickup Orders', icon: 'shop', color: P.warn, count: orders.filter((o) => o.channel === 'Store').length },
        { value: 'delivery', label: 'Delivery Orders', icon: 'truck', color: P.info, count: orders.filter((o) => o.channel === 'Delivery').length }]
        } />
        {/* Delivery gets its own layout options — board / list / map */}
        {isDelivery &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.08em', textTransform: 'uppercase' }}>View</span>
            <Seg value={['regions', 'drivers', 'map'].includes(view) ? view : 'dispatch'} onChange={setView} size="md" options={[
          { value: 'dispatch', label: 'Dispatch', icon: 'list' },
          { value: 'map', label: 'Map', icon: 'map-pin' },
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
        <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{visible.length} order{visible.length === 1 ? '' : 's'} shown below{nFilt > 0 ? ` · ${nFilt} filter${nFilt === 1 ? '' : 's'} on` : ''}</span>
        {(q || nFilt > 0) && <PBtn variant="ghost" size="xs" icon="x" onClick={() => {setQ('');setQf({ source: 'All', pay: 'All' });}}>Clear</PBtn>}
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
      view === 'map' ? <DeliveryMap items={visible} onStartSale={onStartSale} onOpen={setDetail} /> :
      view === 'regions' ? <RegionsView items={visible} onStartSale={onStartSale} onOpen={setDetail} /> :
      view === 'drivers' ? <DriversView items={visible} onStartSale={onStartSale} onOpen={setDetail} /> :
      <DispatchView items={visible} onStartSale={onStartSale} onOpen={setDetail} />}

      {matching && <MatchSheet o={matching} bind={bindOf(matching)} onBind={(cid, guest) => {bindTo(matching, cid, guest);setMatching(null);}} onClose={() => setMatching(null)} />}

      {/* The payload was being thrown away: the check-in was never created, and
          "check in & start sale" opened the register on whoever it seeds itself
          with rather than the person standing there. */}
      {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} onCheckIn={(p) => {
        const ci = window.HW.addCheckIn(p);
        setShowCheckIn(false);
        if (p.start && ci) {window.HW.startSaleFor(window.HW.memberById(ci.memberId), ci.guests);onStartSale && onStartSale();}
      }} />}
      {detail && <OrderDetails o={detail} onClose={() => setDetail(null)} />}
    </div>);

};

// ── Queue filters ──────────────────────────────────────────────────────────
// Source and payment are the two facets the board cannot already show: the
// queue groups by STAGE, and the cards carry the customer, so filtering by
// either of those would only repeat what is on screen. Options are read off the
// live orders, so a seeded Weedmaps order adds its own filter chip.
function QueueFilters({ value, onChange, orders, open, onOpen, shown }) {
  const P = useP();
  const opts = (k) => ['All'].concat(Array.from(new Set(orders.map((o) => o[k]).filter(Boolean))));
  const n = ['source', 'pay'].filter((k) => value[k] !== 'All').length;
  const Row = ({ label, k }) =>
  <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{opts(k).map((o) => {const on = value[k] === o;return (
        <button key={o} onClick={() => onChange({ ...value, [k]: o })} style={{ minHeight: 40, padding: '0 13px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{o}</button>);})}
      </div>
    </div>;
  return (
    <div style={{ position: 'relative' }}>
      <PBtn variant={n ? 'accent' : 'secondary'} icon="sliders" size="md" onClick={() => onOpen(!open)}>Filters{n ? ` · ${n}` : ''}</PBtn>
      {open && <>
        <div onClick={() => onOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 7px)', right: 0, zIndex: 61, width: 300, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 15, textAlign: 'left', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Filter by source &amp; payment</span>
            <div style={{ flex: 1 }} />
            <IconBtn icon="x" size={14} label="Close filters" onClick={() => onOpen(false)} style={{ width: 40, height: 40 }} />
          </div>
          <Row label="Source" k="source" />
          <Row label="Payment" k="pay" />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <PBtn variant="secondary" size="sm" full onClick={() => onChange({ source: 'All', pay: 'All' })}>Clear all</PBtn>
            <PBtn variant="accent" size="sm" full onClick={() => onOpen(false)}>Show {shown}</PBtn>
          </div>
        </div>
      </>}
    </div>);

}

function CheckInStrip({ checkins, onStartSale, onNewCheckIn }) {
  const P = useP();
  // The strip's search box was rendered with no value and no onChange: typing
  // in it changed nothing, because an uncontrolled Field in a React tree that
  // re-renders is a box that eats what you type. It searches the person's
  // member record too — the placeholder promises e-mail and phone, and the
  // check-in record carries neither.
  const [cq, setCq] = React.useState('');
  const ql = cq.trim().toLowerCase();
  const shown = !ql ? checkins : checkins.filter((c) => {
    const m = window.HW.memberById(c.memberId) || {};
    return `${c.name} ${m.email || ''} ${m.phone || ''}`.toLowerCase().includes(ql);
  });
  return (
    <Card padding={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="user-check" size={16} stroke={1.9} color={P.ink2} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Check-in List</span>
          <Pill kind="accent">{checkins.length} waiting</Pill>
          {ql && <Pill kind="neutral">{shown.length} match{shown.length === 1 ? '' : 'es'}</Pill>}
        </div>
        <div style={{ width: 280 }}><Field icon="search" placeholder="Search customer by e-mail or phone" size="sm" value={cq} onChange={(e) => setCq(e.target.value)}
          suffix={cq ? <IconBtn icon="x" size={13} label="Clear the check-in search" onClick={() => setCq('')} style={{ width: 40, height: 40, margin: '-8px -6px -8px 0' }} /> : null} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: 14, overflowX: 'auto' }}>
        {ql && shown.length === 0 &&
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '18px 16px', color: P.inkMute, fontSize: 12.5 }}>
            <Icon name="search" size={15} color={P.inkFaint} />Nobody waiting matches “{cq}”.
          </div>}
        {shown.map((c) => <CheckInCard key={c.id} c={c} onStartSale={onStartSale} />)}
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
  // The ✕ had no handler, so the only control that means "this person is not
  // here any more" left them on the board for ever. It removes the check-in for
  // real — and because that is not undoable, it asks first rather than
  // deleting a walk-in on a mis-tap.
  const [confirm, setConfirm] = React.useState(false);
  const [failed, setFailed] = React.useState('');
  const first = c.name.split(' ')[0];
  const remove = () => {
    // The X means "this person is not here any more" (the note above), so the
    // outcome is 'left' and is recorded as such. This used to call
    // removeCheckIn, which splices the row and records nothing -- which is why
    // a walk-out and a completed sale looked the same afterwards.
    const gone = window.HW.settleCheckIn(c.id, 'left');
    setConfirm(false);
    if (!gone) setFailed('Already gone — somebody else cleared this check-in.');
  };
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
        <IconBtn icon="x" size={15} label={`Remove ${first} from the waiting list`} onClick={() => {setFailed('');setConfirm(true);}} />
      </div>
      {confirm &&
      <div style={{ margin: '0 13px 10px', padding: '9px 11px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, marginBottom: 7, lineHeight: 1.4 }}>Take {first} off the waiting list?</div>
          <div style={{ fontSize: 10, color: P.inkDim, marginBottom: 8, lineHeight: 1.45 }}>The customer record stays; only the check-in goes. There is no undo.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <PBtn variant="ghost" size="xs" onClick={() => setConfirm(false)}>Keep waiting</PBtn>
            <div style={{ flex: 1 }} />
            <PBtn variant="danger" size="xs" icon="trash" onClick={remove}>Remove</PBtn>
          </div>
        </div>}
      {failed && <div style={{ margin: '0 13px 10px', fontSize: 10, fontWeight: 600, color: P.bad }}>{failed}</div>}
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
                <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>{bind.boardWhy || 'Nobody in the room is a plausible match — search the customer book or check them in from the order.'}</span>
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
  // COMPARE MINUTES, NOT STRINGS. This reduced with `o.age > a` over display
  // strings, so '22h 34m' < '4h 11m' lexicographically and the banner reported
  // the oldest order as 4h when a 22h one was three cards down. An operator
  // triaging by this banner never escalates the order that has actually been
  // waiting a day. Zero-padding is inconsistent too ('5h 02m' vs '0h 3m'), so
  // the string ordering was arbitrary regardless of magnitude.
  const ageMins = (a) => {const m = /(\d+)\s*h\s*(\d+)/.exec(String(a || '')); return m ? (+m[1]) * 60 + (+m[2]) : -1;};
  const oldest = items.reduce((a, o) => ageMins(o.age) > ageMins(a) ? o.age : a, '0h 0m');
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
  // `5` IS NOT A SCORE. This defaulted every unscored person to the constant 5
  // and then drew it under "ranked by match" with a bar meter. On live data
  // that is four real people standing in a real room, each shown a confidence
  // nobody computed, sorted by a value that is the same for all of them. Null
  // means unscored and renders as "not scored", never as a number or a bar.
  const scored = (ci) => {const c = (bind.candidates || []).find((x) => x.checkinId === ci.id);return c ? c.conf : null;};
  const anyScored = (bind.candidates || []).length > 0;
  const inRoom = checkins.slice().sort((a, b) => (scored(b) == null ? -1 : scored(b)) - (scored(a) == null ? -1 : scored(a)));
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
            <Eyebrow>{anyScored ? 'People in the store \u00b7 ranked by match' : 'People in the store \u00b7 NOT ranked \u2014 nobody has been scored against this order'}</Eyebrow>
            {inRoom.map((ci) => {const s = scored(ci);const top = s >= 40;
              return (
                <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: P.surface, border: `1px solid ${top ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, boxShadow: top ? `0 0 0 2px ${P.accentSoft}` : 'none' }}>
                  <Avatar name={ci.name} size={30} crown={ci.member} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{ci.name}</span>
                    <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>in store {ci.wait.replace(/^0h /, '')} · {ci.type}{(ci.guests || []).length ? ` · party of ${1 + ci.guests.length}` : ''}</span>
                  </span>
                  {/* A bar IS the claim that a confidence was computed. Drawing
                      one for an unscored person is the same lie as the number. */}
                  <span style={{ width: 64 }}>{s == null ? null : <BarMeter value={s / 100} color={s >= 50 ? P.warn : P.neutral} height={4} />}</span>
                  <span style={{ fontSize: s == null ? 9.5 : 11.5, fontWeight: 800, color: s == null ? P.inkMute : s >= 50 ? P.warn : P.inkMute, fontFamily: P.fontMono, width: s == null ? 62 : 22, textAlign: 'right' }}>{s == null ? 'not scored' : s}</span>
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
function DeliveryMap({ items, onStartSale, onOpen }) {
  const P = useP();
  useHolds();
  const dlv = window.HW.DELIVERY;
  const [sel, setSel] = React.useState(items[0]?.id || null);
  const [assign, setAssign] = React.useState(null);
  const [call, setCall] = React.useState(null);
  // 'Optimize' had no handler. It orders the run nearest-first from the
  // distances the routing table already carries — that is the whole of what
  // this data can support, so the button says exactly that and nothing more.
  // It is a toggle: an operator who wants the original sequence back can have
  // it, which is why it does not silently rewrite the list once and for ever.
  const [opt, setOpt] = React.useState(false);
  const distOf = (o) => (dlv[o.id] || {}).dist != null ? dlv[o.id].dist : Infinity;
  const stops = opt ? items.slice().sort((a, b) => distOf(a) - distOf(b)) : items;
  const totalMi = items.reduce((s2, o) => s2 + ((dlv[o.id] || {}).dist || 0), 0);
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
        {stops.map((o, i) => {const d = dlv[o.id] || { x: .5, y: .5 };const a = sel === o.id;const st = stageMeta(o.stage);
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
          <PBtn variant={opt ? 'accent' : 'soft'} size="xs" icon="route" title="Re-order the run by distance from the store"
          onClick={() => setOpt((v) => !v)}>{opt ? 'Nearest first' : 'Optimize'}</PBtn>
        </div>
        {opt &&
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 10px', background: P.infoSoft, borderRadius: P.r10, fontSize: 10, color: P.ink2, lineHeight: 1.45 }}>
            <Icon name="route" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span>Ordered nearest-first · {items.length} stop{items.length === 1 ? '' : 's'} · {totalMi.toFixed(1)} mi total. Distance only — this does not know traffic, ETA windows or who is driving.</span>
          </div>}
        {stops.map((o, i) => {const d = dlv[o.id] || {};const a = sel === o.id;const st = stageMeta(o.stage);const un = driverOf(o) === 'Unassigned';const ds = dispatchStateOf(o);
          return (
            <div key={o.id} onClick={() => setSel(o.id)} style={{ display: 'flex', gap: 11, padding: '11px 12px', background: a ? P.surface3 : P.surface, border: `1px solid ${a ? P.ink : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', transition: 'all .12s' }}>
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
                    {/* Same rule as the dispatch table: a live stop gets the
                        gate verdict, a mock stop gets the local roster. */}
                    <PBtn variant={ds.kind === 'held' ? 'accent' : ds.kind === 'mock' && un ? 'accent' : 'soft'} size="xs"
                  icon={ds.kind === 'mock' ? 'user-check' : 'shield'} full
                  title={ds.kind === 'mock' ? un ? 'Assign a driver to this demo stop (local only)' : 'Move this stop to another driver' : 'What the API says about this stop'}
                  onClick={(e) => {e.stopPropagation();setAssign(o);}}>{
                  ds.kind === 'mock' ? un ? 'Assign driver' : driverOf(o) :
                  ds.kind === 'held' ? ds.hold.releasable ? 'Release & dispatch' : 'Held · ' + (ds.hold.block_code || ds.hold.held_for) : ds.text}</PBtn>
                    <PBtn variant="secondary" size="xs" icon="phone" title="Show the phone number on file"
                  onClick={(e) => {e.stopPropagation();setCall((c) => c === o.id ? null : o.id);}} />
                    <PBtn variant="secondary" size="xs" icon="arrow-right" title="Start a sale" onClick={(e) => {e.stopPropagation();onStartSale && onStartSale();}} />
                  </div>}
                {a && call === o.id && <PhoneNote o={o} />}
              </div>
            </div>);
        })}
      </div>
      {assign && <AssignDriverSheet o={assign} onClose={() => setAssign(null)} />}
    </div>);

}

// The phone control is the one thing on this row the demo cannot actually do:
// there is no handset behind it. So it shows the number it has — and says so —
// rather than pretending to dial.
function PhoneNote({ o }) {
  const P = useP();
  const m = window.HW.MEMBERS.find((x) => x.name === o.name);
  const phone = m && m.phone && m.phone !== '—' ? m.phone : null;
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 7, padding: '8px 10px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
    <Icon name="phone" size={13} color={phone ? P.ink2 : P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
    <span style={{ fontSize: 10, color: P.ink2, lineHeight: 1.45 }}>
      {phone ? <><b style={{ fontFamily: P.fontMono, fontSize: 11.5 }}>{phone}</b> — on {o.name.split(' ')[0]}’s customer record. Dialling is not wired to a handset in this demo; call it from the store phone.</> :
      <>No phone number on this order, and no customer record to take one from.</>}
    </span>
  </div>;
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
            <button key={p} onClick={() => {setLabel(p === 'Today' ? 'Jun 10' : p === 'Yesterday' ? 'Jun 9' : p);setOpen(false);}} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: label === p ? P.surface3 : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600, color: P.ink }}>
                {p}{label === p && <Icon name="check" size={14} stroke={2.4} color={P.ink} />}
              </button>
            )}
          </div>
          {/* The two boxes here took typing and threw it away. A custom range
              cannot be honoured against this data at all: an order carries an
              AGE ("2h 8m"), not a timestamp, so there is nothing to compare a
              date to. Refusing and saying why beats a box that eats input. */}
          <div style={{ padding: '10px 4px 2px', marginTop: 4, borderTop: `1px solid ${P.hairline}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Custom range</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 12px 1fr', alignItems: 'center', gap: 6, opacity: .55 }}>
              <div style={{ minWidth: 0 }}><Field icon="calendar" placeholder="From" size="sm" mono value="" onChange={() => {}} disabled /></div>
              <span style={{ color: P.inkMute, textAlign: 'center', fontSize: 12.5 }}>–</span>
              <div style={{ minWidth: 0 }}><Field icon="calendar" placeholder="To" size="sm" mono value="" onChange={() => {}} disabled /></div>
            </div>
            <div style={{ fontSize: 10, color: P.inkMute, lineHeight: 1.45, marginTop: 7 }}>Custom ranges need order timestamps. These demo orders carry an age, not a date — so the presets above label the view and the queue is filtered by search and by Filters, not by this.</div>
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

// ── Driver assignment ──────────────────────────────────────────────────────
//
// Every "Assign driver" / "Assign" / "Re-route" control on the delivery side
// was inert, and the dispatch table's was worse than inert: it had no handler
// at all, so the click fell through to the row and opened the order modal —
// the operator asked to route a stop and got a receipt.
//
// An assignment is a WRITE, to the order. HW.DELIVERY is seed data with no
// setter and no subscribers, so anything written there would not have
// re-rendered anything; `o.driver` goes through HW.updateOrder, which notifies.
// driverOf() reads the order first and falls back to the seed.
//
// The roster names people in full ("Theo Reyes") and the routing table names
// them the way a dispatcher writes them on a board ("Theo R."). Writing the
// full name would have invented a second driver that no view could match, so
// one converter is used on every write and every comparison.
function shortDriver(name) {
  const p = String(name || '').trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || '';
}
function driverOf(o) {
  return o.driver || (window.HW.DELIVERY[o.id] || {}).driver || 'Unassigned';
}

// ── THE BOARD IS NOT THE DISPATCHER ────────────────────────────────────────
//
// Everything above this line writes to window.HW and stops there. That is the
// correct behaviour for a MOCK order — pos/data.jsx's ORD-002xx rows exist
// nowhere else, so a local write is the whole truth about them.
//
// It is a LIE about a live one. When shared/hw-live.js is up it replaces
// HW.ORDERS with the API's own rows (`_live: true`, id = wm_order_id), and on
// that data:
//
//   · There is NO route that binds a driver to an existing order. POST
//     /api/driver is roster CRUD, not an assignment. A driver is bound in
//     exactly two places, both server-side: engine.ingest_order() at ingest,
//     and engine.release_hold() at release ("Route now, at release, for the
//     same reason ingest routes at ingest", wmdemo/engine.py:2548).
//   · Every delivery order on the live board reads "Unassigned" — and the
//     reason is never "a dispatcher has not got to it yet". Verified against
//     the deployment 2026-08-26: GET /api/state returned 10 delivery orders,
//     all with driver_id null; GET /api/orders/held returned all 10 of them,
//     held at GATE 3, each with a block code and a remedy.
//
// So the board rendered a verification hold as an empty driver slot and put an
// "Assign" button next to it. Pressing it moved a name in this browser, told
// the operator it had worked, and left an order the server will refuse to
// dispatch. That is the worst control on a screen: a success that is not one.
//
// WHAT THIS SEAM DOES. It reads the API's own answer to "why has this stop got
// nobody on it" from GET /api/orders/held (read-only by construction — see
// engine.held_orders: "Nothing here binds a driver") and renders it. The one
// action that really dispatches — POST /api/order/release-hold — goes through
// W.HW_LIVE.post, the shared write path, so the token, the same-origin rule and
// the server's own error text stay in exactly one place.
//
// WHY A `fetch` FOR THE READ AND NOT HW_LIVE.post. /api/orders/held is a GET,
// and must be: do_POST's public-mode guard 403s an unauthenticated POST, and a
// read-only board must not 403 on its own data (wmdemo/server.py:1376).
// HW_LIVE publishes no GET helper, so the read is a plain fetch off
// HW_LIVE.base — the same shape every sibling seam uses. Every WRITE still
// goes through HW_LIVE.post.
//
// FOUR STATES, AND THE THIRD IS NOT THE FOURTH.
//   'off'      no live seam — a mock board. There is no server to ask.
//   'loading'  asked, no answer yet.
//   'live'     answered. In the map ⇒ held. Absent from the map ⇒ not held.
//   'error'    the feed did not answer. The hold state is NOT KNOWN, and is
//              rendered as not-known — never as "Unassigned", which would be a
//              claim that the order is merely waiting for a dispatcher.
const HOLDS = { state: 'off', by: {}, error: null, at: 0, seq: 0 };
const _holdSubs = new Set();
function holdsPing() {HOLDS.seq++;_holdSubs.forEach((f) => {try {f(HOLDS.seq);} catch (e) {}});}
function holdsBase() {
  const L = window.HW_LIVE;
  return L && L.__armed && L.orders && L.orders.live ? L.base || '' : null;
}
function loadHolds(force) {
  const base = holdsBase();
  if (base == null) {
    if (HOLDS.state !== 'off') {HOLDS.state = 'off';HOLDS.by = {};HOLDS.error = null;holdsPing();}
    return;
  }
  if (!force && (HOLDS.state === 'loading' ||
  HOLDS.state === 'live' && Date.now() - HOLDS.at < 15000)) return;
  HOLDS.state = 'loading';holdsPing();
  fetch(base + '/api/orders/held', { credentials: 'omit', cache: 'no-store' }).
  then((r) => r.ok ? r.json() : r.json().then(
  (j) => Promise.reject(new Error(j && (j.error || j.why) || 'HTTP ' + r.status)),
  () => Promise.reject(new Error('HTTP ' + r.status)))).
  then((j) => {
    const by = {};
    ((j && j.held) || []).forEach((h) => {by[String(h.order)] = h;});
    HOLDS.by = by;HOLDS.error = null;HOLDS.state = 'live';HOLDS.at = Date.now();holdsPing();
  }).
  catch((e) => {
    // Reported, never swallowed into an empty map: an empty map means
    // "nothing is held", which is a different fact from "we could not ask".
    HOLDS.by = {};HOLDS.error = e && e.message || 'the hold feed did not answer';
    HOLDS.state = 'error';HOLDS.at = Date.now();holdsPing();
  });
}
function useHolds() {
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    _holdSubs.add(bump);loadHolds();
    return () => {_holdSubs.delete(bump);};
  }, []);
  return HOLDS;
}

// ── THE OUTBOUND STATUS QUEUE, ON A SCREEN ────────────────────────────────
//
// WHY THIS EXISTS AT ALL. wm_status_queue grew a per-row `next_attempt_at`, and
// with it queue_summary() grew `deferred` (pending rows serving a backoff) and
// `ready_now` (pending rows that are due AND not held behind an older push for
// the same order). GET /api/fulfillment/board has served both since the day
// they were written. NOTHING RENDERED EITHER ONE. `ready_now` had zero readers
// anywhere in shipping code — not a route, not a loop, not a line of JSX.
//
// That is this repo's signature defect ("built, tested, never wired"), and the
// number matters more than most: after the fix, the ordinary steady state of a
// queue Weedmaps is refusing is a drain pass that attempts NOTHING, because
// every row is waiting out its own backoff. On a screen — and in a log — that
// is indistinguishable from an empty queue. `undelivered` alone cannot tell
// the operator which one they are looking at. deferred + ready_now can.
//
// SAME FOUR STATES AS THE HOLD FEED ABOVE, for the same reason: 'error' is not
// 'empty'. A queue we could not ask about must never render as a quiet queue —
// that is precisely the "looks tended, is not" failure the drain loop and this
// strip both exist to end. Read-only GET, off HW_LIVE.base, exactly like
// /api/orders/held; every WRITE on this screen still goes through HW_LIVE.post.
const QBOARD = { state: 'off', q: null, error: null, at: 0, seq: 0 };
const _qboardSubs = new Set();
function qboardPing() {QBOARD.seq++;_qboardSubs.forEach((f) => {try {f(QBOARD.seq);} catch (e) {}});}
function loadQueueBoard(force) {
  const base = holdsBase();
  if (base == null) {
    if (QBOARD.state !== 'off') {QBOARD.state = 'off';QBOARD.q = null;QBOARD.error = null;qboardPing();}
    return;
  }
  if (!force && (QBOARD.state === 'loading' ||
  QBOARD.state === 'live' && Date.now() - QBOARD.at < 15000)) return;
  QBOARD.state = 'loading';qboardPing();
  // limit=1 keeps the per-stage order LISTS down to one row each. The counts
  // this strip reads are exact over the whole table regardless of the cut
  // (fulfillment.board() counts separately from what it lists), so asking for
  // the default 100 rows per stage would be a much larger payload for exactly
  // the same four numbers.
  fetch(base + '/api/fulfillment/board?limit=1', { credentials: 'omit', cache: 'no-store' }).
  then((r) => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))).
  then((j) => {
    const q = j && j.queue;
    if (!q || typeof q.undelivered !== 'number' || typeof q.deferred !== 'number' ||
    typeof q.ready_now !== 'number') {
      // A board that answered without the counts is a SHAPE change, not a
      // healthy empty queue. Rendering zeros here would invent the one fact
      // this strip is for.
      throw new Error('the board answered without deferred/ready_now');
    }
    QBOARD.q = q;QBOARD.error = null;QBOARD.state = 'live';QBOARD.at = Date.now();qboardPing();
  }).
  catch((e) => {
    QBOARD.q = null;QBOARD.error = e && e.message || 'the queue board did not answer';
    QBOARD.state = 'error';QBOARD.at = Date.now();qboardPing();
  });
}
function useQueueBoard() {
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    _qboardSubs.add(bump);loadQueueBoard();
    // 20s: slower than the server's own 30s drain cadence would let a change
    // sit on screen for a full pass, faster than that is polling for its own
    // sake. loadQueueBoard's 15s freshness window is what actually rate-limits
    // this, so a second mount does not double the request rate.
    const t = setInterval(() => loadQueueBoard(), 20000);
    return () => {_qboardSubs.delete(bump);clearInterval(t);};
  }, []);
  return QBOARD;
}
// The four numbers, in the one sentence an operator can act on. `held` is the
// remainder deliberately — undelivered minus the two named buckets — so the
// pills always add up to `undelivered` even if the server grows a fifth
// category. A number this strip cannot explain shows up in `held` rather than
// silently vanishing from the total.
window.QueueHealthStrip = function QueueHealthStrip() {
  const P = useP();
  const B = useQueueBoard();
  if (B.state === 'off') return null;          // mock board: no server to ask
  const box = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    marginBottom: 14, padding: '9px 13px', background: P.surface,
    border: `1px solid ${P.hairline2}`, borderRadius: P.r12 };
  const head = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>
      <Icon name="send" size={13} stroke={2} />Weedmaps status queue</span>;
  if (B.state === 'loading') {
    return <div style={box}>{head}<Pill kind="ghost" dot>Asking the queue…</Pill></div>;
  }
  if (B.state === 'error') {
    return <div style={box}>{head}
      <Pill kind="bad" dot>Queue state not known</Pill>
      <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{B.error}</span>
    </div>;
  }
  const q = B.q || {};
  const undelivered = q.undelivered || 0;
  const deferred = q.deferred || 0;
  const ready = q.ready_now || 0;
  const held = Math.max(0, undelivered - deferred - ready);
  if (!undelivered) {
    return <div style={box}>{head}<Pill kind="good" dot>Nothing waiting to reach Weedmaps</Pill>
      <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{q.sent || 0} delivered · {q.failed || 0} permanently failed</span>
    </div>;
  }
  return <div style={box}>{head}
    <Pill kind="warn" dot>{undelivered} push{undelivered === 1 ? '' : 'es'} not yet delivered</Pill>
    <Pill kind={ready ? 'info' : 'neutral'} dot>{ready} ready now</Pill>
    {/* The pill that stops "the queue attempted nothing" reading as "the
        queue is empty". It is the normal picture during a 403 outage, not an
        alarm, so it is neutral — the alarm is `failed`. */}
    <Pill kind="neutral" dot>{deferred} waiting out a retry backoff</Pill>
    {held > 0 && <Pill kind="neutral" dot>{held} behind an older push for the same order, or in flight</Pill>}
    {(q.failed || 0) > 0 && <Pill kind="bad" dot>{q.failed} permanently failed</Pill>}
    <div style={{ flex: 1 }} />
    <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>retried by the server, not by your click</span>
  </div>;
};
// True only for a row the API served. A mock row is not "not held" — it has no
// server to be held by.
function isLiveOrder(o) {return !!(o && o._live);}
// The ONE place that decides what a delivery row's driver slot may say.
function dispatchStateOf(o) {
  if (!isLiveOrder(o)) return { kind: 'mock', text: driverOf(o) };
  if (HOLDS.state === 'live') {
    const h = HOLDS.by[String(o.id)];
    // `held_for` is why it WAS held; `block_code` is why it still is. A hold
    // the gate no longer blocks must not keep wearing the old block's name —
    // "Held · never_checked" on an order the API reports releasable is a
    // sentence about a check that has since happened.
    if (h) return { kind: 'held', hold: h,
      text: h.releasable ? 'Held · releasable now' :
      'Held · ' + (h.block_code || h.held_for || 'verification') };
    const d = (window.HW.DELIVERY[o.id] || {}).driver;
    return d && d !== 'Unassigned' ?
    { kind: 'bound', text: d } :
    { kind: 'none', text: 'No driver bound' };
  }
  return { kind: 'unknown',
    text: HOLDS.state === 'loading' ? 'Checking the gate…' : 'Hold state not known' };
}
function DispatchCell({ o }) {
  useHolds();
  const s = dispatchStateOf(o);
  if (s.kind === 'mock') {const un = s.text === 'Unassigned';return <Pill kind={un ? 'warn' : 'neutral'} dot>{s.text}</Pill>;}
  if (s.kind === 'held') return <Pill kind={s.hold.releasable ? 'warn' : 'bad'} dot>{s.text}</Pill>;
  if (s.kind === 'unknown') return <Pill kind="ghost" dot>{s.text}</Pill>;
  return <Pill kind="neutral" dot>{s.text}</Pill>;
}

// Re-routing moves the load as well as the label: the previous driver gives the
// stop back. Without that, capacity is decoration and a driver can be filled
// past `cap` by moving the same order back and forth.
//
// ⚠️ NULL IS NOT ZERO. On live data hw-live.js sets stops and cap to null on
// every driver, deliberately: "The API models a driver as a POOL MEMBER WITH A
// KIT, not a routed vehicle: there is no stop list and no vehicle capacity
// anywhere in /api/state" (shared/hw-live.js:648). `drv.stops += 1` turned that
// not-known into a 1, and the load meter then drew a bar off it. A number we
// were never given stays not-given.
function assignDriverTo(o, drv) {
  const before = window.HW.DRIVERS.find((x) => shortDriver(x.name) === driverOf(o));
  if (before && typeof before.stops === 'number' && before.stops > 0) before.stops -= 1;
  if (typeof drv.stops === 'number') drv.stops += 1;
  return window.HW.updateOrder(o.id, { driver: shortDriver(drv.name) });
}
function stopsFor(driverName, orders) {
  const s = shortDriver(driverName);
  return orders.filter((o) => driverOf(o) === s);
}

// ── Sheet chrome, shared by both sheets below ─────────────────────────────
function SheetShell({ icon, title, sub, onClose, children }) {
  const P = useP();
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'fade .15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={16} stroke={2} color={P.accent} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{sub}</span>
          </span>
          <IconBtn icon="x" size={17} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 500, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>);

}
function Note({ tone, children }) {
  const P = useP();
  const c = { bad: P.bad, warn: P.warn, good: P.good, info: P.info }[tone] || P.inkMute;
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 12px', background: P.surface2, border: `1px solid ${c}44`, borderRadius: P.r10 }}>
    <span style={{ flex: '0 0 auto', width: 6, alignSelf: 'stretch', borderRadius: 99, background: c }} />
    <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, minWidth: 0 }}>{children}</div>
  </div>;
}

// ── THE LIVE STOP. What the API says, and the only thing that really moves ──
//
// No roster here, because there is nothing to pick from: no route reassigns a
// driver on an existing order. The gate verdict is the API's own sentence,
// printed verbatim, and the button posts POST /api/order/release-hold —
// engine.release_hold(), which RE-ASKS the gate server-side, routes a driver
// and dispatches. The server's answer is what gets rendered; this component
// computes nothing and congratulates nobody.
function LiveDispatchSheet({ o, onClose }) {
  const P = useP();
  const holds = useHolds();
  const d = window.HW.DELIVERY[o.id] || {};
  const st = dispatchStateOf(o);
  const h = st.kind === 'held' ? st.hold : null;
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);
  const L = window.HW_LIVE;

  const release = () => {
    if (!L || typeof L.post !== 'function') {
      setRes({ tone: 'bad', head: 'No write path',
        body: 'This control posts through HW_LIVE.post and shared/hw-live.js has not armed on this page. Nothing was sent.' });
      return;
    }
    setBusy(true);setRes(null);
    L.post('/api/order/release-hold', { wm_order_id: String(o.id) }).then((r) => {
      setBusy(false);
      const b = r.body || {};
      if (r.gated) {
        setRes({ tone: 'warn', head: 'Refused before it reached the route',
          body: 'This deployment is read-only without a write token, so the release was never attempted. ' + (r.hint || '') });
        return;
      }
      if (!r.ok && !b.outcome) {
        setRes({ tone: 'bad', head: 'The request failed',
          body: r.error || b.why || b.error || ('HTTP ' + r.code + ' with no reason in the body.') });
        return;
      }
      // From here every word is the server's. `released: false` is not an
      // error and is not a success — it is the gate's answer, and it says why.
      // release_hold() leaves `reason` null on success, so the pieces are
      // joined only where they exist rather than padded into a sentence of
      // ours.
      //
      // `counted` IS NOT A PASS/FAIL. It is `first` from
      // store.count_order_fulfilled: false on an idempotent re-release (already
      // credited) and false again when the order carries no identity (nothing
      // to credit). Printing one sentence for both would state the wrong fact
      // half the time, so the count itself is printed and the two cases are
      // told apart by whether there is a count at all.
      const ledger = b.fulfilled_count == null ?
      'fulfilled ledger untouched — this order resolves to no identity' :
      'fulfilled count now ' + b.fulfilled_count +
      (b.counted ? ' (credited by this release)' : ' (already counted; this release added nothing)');
      const parts = [b.reason || b.note || null,
      b.driver ? 'driver bound by the server: ' + b.driver : null,
      b.released ? ledger : null].
      filter(Boolean);
      setRes({ tone: b.released ? 'good' : 'warn',
        head: b.released ? 'Released and dispatched' : 'Not released — ' + (b.outcome || 'refused'),
        body: parts.join(' · '), raw: b });
      loadHolds(true);
      if (L.refresh) {try {L.refresh();} catch (e) {}}
    });
  };

  return (
    <SheetShell icon="truck" onClose={onClose}
    title={res && res.raw && res.raw.released ? 'Released and dispatched' :
    h ? 'Held at the verification gate' : 'Dispatch — nothing on this screen can move this stop'}
    sub={`#${o.id} · ${o.name} · ${d.zone || 'no region on the order'}`}>

      {holds.state === 'loading' && <Note tone="info">Asking the API which orders are held…</Note>}

      {holds.state === 'error' &&
      <Note tone="bad"><b>The hold feed did not answer.</b> {holds.error} — so whether this
        order is held is <b>not known</b>. It is not "unassigned", and it is not "clear";
        nobody has been able to look. Reload the board before acting on it.</Note>}

      {h &&
      <>
        <Note tone={h.releasable ? 'warn' : 'bad'}>
          <b>{h.releasable ? 'The gate no longer blocks this order.' : 'BLOCKED · ' + (h.block_code || h.held_for)}</b>
          <div style={{ marginTop: 4 }}>{h.reason}</div>
          {h.remedy && <div style={{ marginTop: 6, color: P.ink }}><b>Remedy:</b> {h.remedy}</div>}
        </Note>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, lineHeight: 1.6 }}>
          held for {h.held_for} · gate {h.gate} · review {h.review_state_known ? h.review_state || 'not in the queue' : 'unknown'} · identity {h.identity_id == null ? 'none resolved' : '#' + h.identity_id}
        </div>
        <Note tone="info">A held order has <b>no driver because it cannot have one</b>. The
          API binds a driver at ingest and again at release (engine.release_hold), and there
          is no route that assigns one to an existing order — so this board has no way to
          give this stop to anybody, and no button here pretends otherwise.</Note>
      </>}

      {!h && holds.state === 'live' &&
      <Note tone="info">This order is <b>not in a verification hold</b>. The API reports its
        driver as <b>{(d.driver && d.driver !== 'Unassigned') ? d.driver : 'none bound'}</b>.
        There is no route that reassigns a driver on an existing order, so there is nothing
        this screen can change about it.</Note>}

      {res &&
      <Note tone={res.tone}><b>{res.head}</b>{res.body ? <div style={{ marginTop: 4 }}>{res.body}</div> : null}</Note>}

      {h &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 2 }}>
        <div style={{ flex: 1, fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>
          Release re-asks the gate on the server. If it still blocks, nothing is dispatched
          and the refusal is printed here.
        </div>
        <PBtn variant="accent" size="md" icon="check" busy={busy} disabled={busy}
        onClick={release}>{busy ? 'Releasing…' : 'Release & dispatch'}</PBtn>
      </div>}
    </SheetShell>);

}

// Pick a driver — MOCK ROWS ONLY. Refusals are shown, never hidden: an offline
// or full driver stays on the list with the reason next to them, because "why
// can't I give this to Aaron" is the question a disabled row has to answer.
function AssignDriverSheet({ o, onClose }) {
  const P = useP();
  // A live order has no assignment route anywhere in the API. Offering a
  // roster for it is the falsehood this split exists to end.
  if (isLiveOrder(o)) return <LiveDispatchSheet o={o} onClose={onClose} />;
  const d = window.HW.DELIVERY[o.id] || {};
  const cur = driverOf(o);
  const rank = (x) => (d.zone && x.region === d.zone ? 0 : 1);
  const list = window.HW.DRIVERS.slice().sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  // `stops`/`cap` are null when the API supplied the roster — not zero. A
  // `null >= null` capacity test is silently false, which let an unknown load
  // read as room to spare. Unknown is now said out loud instead.
  const loadKnown = (x) => typeof x.stops === 'number' && typeof x.cap === 'number';
  const refuse = (x) =>
  x.status === 'offline' ? `${x.name.split(' ')[0]} is off shift` :
  loadKnown(x) && x.stops >= x.cap ? `At capacity · ${x.stops}/${x.cap} stops` :
  shortDriver(x.name) === cur ? 'Already has this stop' : null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'fade .15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="truck" size={16} stroke={2} color={P.accent} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{cur === 'Unassigned' ? 'Assign a driver' : `Re-route — currently ${cur}`}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>#{o.id} · {o.name} · {d.addr || 'no address on file'}{d.zone ? ` · ${d.zone}` : ''}{d.win ? ` · ${d.win}` : ''}</span>
          </span>
          <IconBtn icon="x" size={17} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
          {holdsBase() != null &&
          <Note tone="warn">This is a <b>demo record</b>. #{o.id} exists in this browser only —
            it is not in the API, so this assignment is local to this tab and reaches no
            server. The Weedmaps rows on the same board behave differently, and say so.</Note>}
          {d.zone && <Eyebrow>{d.zone} first · then the rest of the fleet</Eyebrow>}
          {list.map((x) => {
            const no = refuse(x);
            const col = x.status === 'on-route' ? P.good : x.status === 'idle' ? P.warn : P.inkFaint;
            return (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: P.surface, border: `1px solid ${d.zone && x.region === d.zone ? P.accentBorder : P.hairline2}`, borderRadius: P.r10 }}>
                <Avatar name={x.name} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>{x.name}<Pill kind={x.status === 'on-route' ? 'good' : x.status === 'idle' ? 'warn' : 'neutral'} dot sm>{x.status}</Pill></div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pin" size={11} />{x.region} · {loadKnown(x) ? `${x.stops}/${x.cap} stops` : 'load not served by the API'}</div>
                  {no && <div style={{ fontSize: 10, fontWeight: 600, color: P.bad, marginTop: 3 }}>{no}</div>}
                </div>
                {/* An empty meter reads as "no load". Where the load is not
                    known, no meter is drawn at all. */}
                <div style={{ width: 66, flex: '0 0 auto' }}>{loadKnown(x) ?
                  <BarMeter value={x.cap ? x.stops / x.cap : 0} color={col} height={6} /> :
                  <span style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono }}>load n/k</span>}</div>
                <PBtn variant="accent" size="md" icon="user-check" disabled={!!no} title={no || `Give this stop to ${x.name}`}
                onClick={() => {assignDriverTo(o, x);onClose();}}>{cur === 'Unassigned' ? 'Assign' : 'Move here'}</PBtn>
              </div>);
          })}
        </div>
      </div>
    </div>);

}

// What a driver is actually carrying, from the live queue — not a route
// optimiser. "Route" used to do nothing; this at least answers the question the
// button implies, and says plainly when there is nothing to show.
function DriverRouteSheet({ d, orders, onClose }) {
  const P = useP();const dlv = window.HW.DELIVERY;
  const stops = stopsFor(d.name, orders).slice().sort((a, b) => (dlv[a.id] ? dlv[a.id].dist : 99) - (dlv[b.id] ? dlv[b.id].dist : 99));
  const miles = stops.reduce((s, o) => s + ((dlv[o.id] || {}).dist || 0), 0);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'fade .15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <Avatar name={d.name} size={32} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>{d.name}’s route</span>
            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{d.region} · {stops.length} stop{stops.length === 1 ? '' : 's'} in the queue · {miles.toFixed(1)} mi · next ETA {d.eta && d.eta !== '—' ? d.eta : 'not served'}</span>
          </span>
          <IconBtn icon="x" size={17} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
          {stops.length === 0 ?
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
              <Icon name="info" size={15} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
              {/* The old copy told the operator to "assign a stop from
                  Dispatch" — an instruction with no action behind it once the
                  board is live, and a shift-total sentence about two numbers
                  the API does not serve. Both are conditional now. */}
              <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Nothing in today’s queue is assigned to {d.name.split(' ')[0]}. {holdsBase() != null ?
                'The API binds a driver at ingest and at release — there is no route that assigns one from this screen, so a stop appears here only once the server has routed it.' :
                'Assign a stop from Dispatch or the Unassigned list and it appears here.'} {typeof d.stops === 'number' && typeof d.cap === 'number' ?
                `The ${d.stops}/${d.cap} on the card counts the whole shift, not just what the board is holding right now.` :
                'The card shows no stop count because /api/state carries none — a driver there is a pool member with a kit, not a routed vehicle.'}</div>
            </div> :
          stops.map((o, i) => {const dd = dlv[o.id] || {};const st = stageMeta(o.stage);return (
              <div key={o.id} style={{ display: 'flex', gap: 11, padding: '10px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
                <span style={{ flex: '0 0 auto', width: 24, height: 24, borderRadius: 99, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, fontFamily: P.fontMono }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{o.name}</span>
                    <span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: P.ink }}>{window.HW.fmt.money(o.total)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{dd.addr || '—'} · {dd.zone || '—'} · {dd.dist != null ? dd.dist.toFixed(1) + ' mi' : '—'} · {dd.win || '—'}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: st.color(P) }} />{st.label}</div>
                </div>
              </div>);})}
        </div>
      </div>
    </div>);

}

// Delivery · DISPATCH — dense filterable table (scales to a big fleet)
function DispatchView({ items, onStartSale, onOpen }) {
  const P = useP();const dlv = window.HW.DELIVERY;
  // Subscribes this render to the hold feed: the action column below calls
  // dispatchStateOf() outside any child component, so without this the buttons
  // would keep the label the feed had when the view first mounted.
  const holds = useHolds();
  const [region, setRegion] = React.useState('All');
  const [unOnly, setUnOnly] = React.useState(false);
  const [assign, setAssign] = React.useState(null);
  const rows = items.filter((o) => {const d = dlv[o.id] || {};const un = driverOf(o) === 'Unassigned';return (region === 'All' || d.zone === region) && (!unOnly || un);});
  const liveRows = items.filter(isLiveOrder);
  const heldRows = holds.state === 'live' ? liveRows.filter((o) => HOLDS.by[String(o.id)]) : [];
  const Chip = ({ active, onClick, children }) => <button onClick={onClick} style={{ flex: '0 0 auto', padding: '6px 12px', borderRadius: P.r999, border: `1px solid ${active ? P.ink : P.hairline2}`, background: active ? P.ink : P.surface, color: active ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{children}</button>;
  return (
    <div style={{ marginTop: 4 }}>
      <FleetBar P={P} />
      {/* WHAT THIS BOARD CAN AND CANNOT DO, said once at the top rather than
          implied by a row of buttons. */}
      {holdsBase() != null &&
      <div style={{ marginBottom: 12 }}>
        {holds.state === 'error' ?
        <Note tone="bad"><b>The hold feed did not answer</b> ({holds.error}). Every live row
          below is showing <b>hold state not known</b> — not "unassigned". Reload before
          acting on this board.</Note> :
        holds.state === 'loading' ?
        <Note tone="info">Asking the API which of these orders are held…</Note> :
        <Note tone={heldRows.length ? 'warn' : 'info'}>
          <b>{heldRows.length} of {liveRows.length} live delivery orders are held at the
          verification gate</b>, which is why they have no driver. This board does not assign
          drivers: the API binds one at ingest and again at release, and has no route that
          reassigns one. The only dispatch action here is <b>Release &amp; dispatch</b> on a
          held order, and the server re-asks the gate before it moves anything.
        </Note>}
      </div>}
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
      // "Unassigned" was the WRONG WORD for every live row on this board: not
      // one of them is waiting for a dispatcher, they are held at GATE 3. The
      // cell now prints what the API says — including "not known" when the
      // hold feed could not be asked.
      { label: 'Driver', render: (o) => <DispatchCell o={o} /> },
      { label: 'ETA window', width: 116, render: (o) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2 }}>{dlv[o.id]?.win || '—'}</span> },
      { label: 'Total', align: 'right', width: 80, render: (o) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{window.HW.fmt.money(o.total)}</span> },
      // THE BUTTON MUST NAME WHAT IT ACTUALLY DOES. On a live row it opens the
      // gate verdict and the one real action (release-hold); on a mock row it
      // opens the local roster. Same sheet component, two honest labels.
      { label: '', align: 'right', width: 112, render: (o) => {const st = dispatchStateOf(o);return (
          // stopPropagation, or the row's onRowClick opens the order modal on
          // top of the sheet — the fall-through that made this control DO THE
          // WRONG THING rather than nothing.
          <PBtn variant={st.kind === 'held' ? 'accent' : 'soft'} size="xs"
          icon={st.kind === 'mock' ? 'user-check' : 'shield'}
          title={st.kind === 'mock' ? 'Assign a driver to this demo stop (local only)' :
          st.kind === 'held' ? 'Why this stop is held, and the one action that dispatches it' :
          'What the API says about this stop'}
          onClick={(e) => {e.stopPropagation();setAssign(o);}}>{
          st.kind === 'mock' ? driverOf(o) === 'Unassigned' ? 'Assign' : 'Re-route' :
          st.kind === 'held' ? st.hold.releasable ? 'Release' : 'Held — why' : 'Details'}</PBtn>);} }]}

      rows={rows} />
      {assign && <AssignDriverSheet o={assign} onClose={() => setAssign(null)} />}
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
  const holds = useHolds();
  const [route, setRoute] = React.useState(null);
  const [assign, setAssign] = React.useState(null);
  // "Unassigned" is a claim about a dispatcher's inbox. Held is a claim about a
  // customer's ID. They were being counted as the same pile.
  const noDriver = items.filter((o) => driverOf(o) === 'Unassigned');
  const held = noDriver.filter((o) => dispatchStateOf(o).kind === 'held');
  const unassigned = noDriver.filter((o) => dispatchStateOf(o).kind !== 'held');
  return (
    <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
      <div>
        <FleetBar P={P} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 10 }}>
          {D.map((d) => {const known = typeof d.stops === 'number' && typeof d.cap === 'number';const pct = known && d.cap ? d.stops / d.cap : 0;const col = d.status === 'on-route' ? P.good : d.status === 'idle' ? P.warn : P.inkFaint;return (
              <div key={d.id} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={d.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pin" size={11} />{d.region}</div>
                </div>
                <Pill kind={d.status === 'on-route' ? 'good' : d.status === 'idle' ? 'warn' : 'neutral'} dot>{d.status}</Pill>
              </div>
              {/* A meter at zero reads as "carrying nothing". When the API
                  serves no stop count and no capacity, nothing is drawn. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                {known ? <>
                  <div style={{ flex: 1 }}><BarMeter value={pct} color={col} height={6} /></div>
                  <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink2, fontWeight: 600 }}>{d.stops}/{d.cap}</span>
                </> : <span style={{ flex: 1, fontSize: 11, color: P.inkFaint, fontFamily: P.fontMono }}>stops / capacity not served by the API</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>ETA next {d.eta && d.eta !== '—' ? d.eta : 'not served'}</span>
                <PBtn variant="soft" size="xs" icon="route" title={`See what ${d.name.split(' ')[0]} is carrying`} onClick={() => setRoute(d)}>Route</PBtn>
              </div>
            </div>);})}
        </div>
      </div>
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, background: P.surface, padding: 12 }}>
        {/* HELD FIRST, AND SEPARATELY. A held order is not waiting for this
            panel — it is waiting for a person's ID. Filing it under
            "Unassigned" told the operator to do the one thing that cannot
            work. */}
        {held.length > 0 &&
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Icon name="shield" size={15} color={P.bad} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Held at the gate</span><Pill kind="bad">{held.length}</Pill></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {held.map((o) => {const h = HOLDS.by[String(o.id)] || {};return (
                <div key={o.id} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span><span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 12.5, color: P.ink, flex: '0 0 auto' }}>{window.HW.fmt.money(o.total)}</span></div>
                <div style={{ fontSize: 11.5, color: P.inkDim, margin: '3px 0 8px', fontFamily: P.fontMono }}>#{o.id} · {h.block_code || h.held_for || 'verification'}{h.releasable ? ' · releasable now' : ''}</div>
                <PBtn variant={h.releasable ? 'accent' : 'soft'} size="xs" icon="shield" full onClick={() => setAssign(o)}>{h.releasable ? 'Release & dispatch' : 'Held — why'}</PBtn>
              </div>);})}
          </div>
        </div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Icon name="user-off" size={15} color={P.warn} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{holdsBase() != null ? 'No driver bound' : 'Unassigned'}</span><Pill kind="warn">{unassigned.length}</Pill></div>
        {holds.state === 'error' &&
        <div style={{ marginBottom: 8 }}><Note tone="bad">The hold feed did not answer ({holds.error}), so which of these are held is <b>not known</b>.</Note></div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {unassigned.map((o) => {const d = dlv[o.id] || {};return (
              <div key={o.id} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span><span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 12.5, color: P.ink, flex: '0 0 auto' }}>{window.HW.fmt.money(o.total)}</span></div>
              <div style={{ fontSize: 11.5, color: P.inkDim, margin: '3px 0 9px', fontFamily: P.fontMono }}>{d.zone} · {d.win}</div>
              <PBtn variant={isLiveOrder(o) ? 'soft' : 'accent'} size="xs" icon={isLiveOrder(o) ? 'shield' : 'user-check'} full onClick={() => setAssign(o)}>{isLiveOrder(o) ? 'Details' : 'Assign driver'}</PBtn>
            </div>);})}
          {unassigned.length === 0 && <div style={{ padding: '20px 8px', textAlign: 'center', color: P.inkFaint, fontSize: 12.5 }}>{held.length ? 'Nothing else is waiting on a driver.' : 'All orders assigned'}</div>}
        </div>
      </div>
      {route && <DriverRouteSheet d={route} orders={items} onClose={() => setRoute(null)} />}
      {assign && <AssignDriverSheet o={assign} onClose={() => setAssign(null)} />}
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
/**
 * SWAP ONE LINE FOR ANOTHER PRODUCT — GOVERNED.
 *
 * This runs the engine's post-submission flow (`planOrderSubstitution`), not the
 * raw ranker. The difference is everything that happens around the list: who may
 * act, whether the order's state allows it, whether the replacement is actually
 * in the fulfilment source, what the customer now owes, and an audit row saying
 * who changed what.
 *
 * THREE THINGS THIS DELIBERATELY DOES NOT DO, each one a defect from an earlier
 * attempt that was reviewed and reverted:
 *
 *  · It prices against the order's AGREED totals — what the customer actually
 *    committed to at checkout — never against the unsaved draft. Pricing a
 *    settlement off a draft answers "what would they owe if they'd ordered this
 *    instead", which is not the question at the counter.
 *  · Consent is a real tap. `attested` starts false and only the operator sets
 *    it; the ENGINE refuses the commit until then. Hardcoding it made the gate
 *    unfirable while looking present.
 *  · It keeps `result.record` and `result.intents`. Discarding them leaves a
 *    governed flow with nothing to show for the governance.
 */
function SwapPanel({ P, fmt, line, draft, orderCtx, onSwap, onClose }) {
  const [mode, setMode] = React.useState('upgrade');
  const [picked, setPicked] = React.useState(null);
  const [attested, setAttested] = React.useState(false);
  const G = window.HWGovern;

  const planned = React.useMemo(() => {
    if (!G || !orderCtx) return null;
    return G.planGoverned({
      actor: orderCtx.actor,
      order: orderCtx.order,
      kit: orderCtx.kit,
      lineId: orderCtx.lineIdFor(line),
      now: orderCtx.now,
    });
  }, [G, orderCtx, line.name, line.qty]);

  // The panel must not silently become a plain product picker if the governance
  // is missing — that is the state an earlier attempt shipped in.
  if (!G) return (
    <div style={{ marginTop: 6, padding: '12px 14px', border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface2, fontSize: 12.5, color: P.inkMute }}>
      Swap is unavailable: <code>shared/commerce-governance.js</code> is not loaded on this page.
    </div>);

  const refusal = planned && !planned.ok ? planned.refusal : null;
  const plan = planned && planned.plan;
  const byMode = (plan && plan.candidatesByMode) || {};
  const MODES = [['upgrade', 'Upgrade'], ['similar', 'Similar'], ['cheaper', 'Cheaper']];
  const rows = byMode[mode] || [];

  const sel = picked && rows.find((c) => c.product.id === picked);
  const settle = sel && G.settlementView(orderCtx.order.paymentMethod, sel.money.customerOwesDeltaCents);
  const breaks = sel && sel.money.promotionsBroken && sel.money.promotionsBroken.length > 0;
  const needsAck = sel && sel.verdict && sel.verdict.requiresPromotionAcknowledgement;

  const commit = () => {
    const res = G.commitGoverned({
      plan, candidate: sel, actor: orderCtx.actor, order: orderCtx.order,
      attested, acknowledgePromotionLoss: attested && !!needsAck, now: orderCtx.now,
    });
    onSwap(sel, res);
  };

  return (
    <div style={{ marginTop: 6, border: `1px solid ${P.accentBorder}`, borderRadius: P.r12, background: P.surface, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderBottom: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <Icon name="swap" size={14} stroke={2} color={P.inkDim} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Replace {line.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>
            {line.brand} · {fmt.money(line.price)} ea · ×{line.qty} · from {orderCtx.kitLabel}
          </div>
        </div>
        <IconBtn icon="x" size={14} style={{ width: 28, height: 28 }} onClick={onClose} />
      </div>

      {refusal ?
      <div style={{ padding: '14px 12px', fontSize: 12.5, color: P.ink2, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <Icon name="ban" size={15} stroke={2} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span>{refusal.message || refusal.code}</span>
        </div> :
      <React.Fragment>
        <div style={{ display: 'flex', gap: 6, padding: '9px 11px' }}>
            {MODES.map(([id, label]) =>
          <button key={id} onClick={() => {setMode(id);setPicked(null);setAttested(false);}} style={{ flex: 1, minHeight: 40, padding: '6px 10px', borderRadius: P.r8, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700,
            background: mode === id ? P.ink : 'transparent', color: mode === id ? P.surface : P.ink2,
            border: `1px solid ${mode === id ? P.ink : P.hairline2}` }}>{label}</button>)}
          </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', borderTop: `1px solid ${P.hairline}` }}>
            {rows.length === 0 ?
          <div style={{ padding: '14px 12px', fontSize: 12.5, color: P.inkMute }}>
                {/* The PLAN's current product, not the draft row: the draft row's
                    `cat` is stale and told a Pre-Roll it was Flower. */}
                {(plan.diagnostics && plan.diagnostics.perMode && plan.diagnostics.perMode[mode] && plan.diagnostics.perMode[mode].note)
                  || `Nothing in ${plan.currentProduct.category} is available from ${orderCtx.kitLabel} for this ladder.`}
              </div> :
          rows.map((c, i) => {
            const on = picked === c.product.id;
            const money = G.settlementView(orderCtx.order.paymentMethod, c.money.customerOwesDeltaCents);
            return (
              <div key={i} onClick={() => {setPicked(on ? null : c.product.id);setAttested(false);}}
                data-hw-i style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', cursor: 'pointer',
                  background: on ? P.surface3 : 'transparent', boxShadow: on ? `inset 3px 0 0 ${P.ink}` : 'none',
                  borderBottom: i < rows.length - 1 ? `1px solid ${P.hairline}` : 'none' }}>
                    <Thumb item={{ name: c.product.name, cat: c.product.cat || line.cat }} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{c.product.brand}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{c.product.name}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{money.label}</div>
                      {c.partial && <div style={{ fontSize: 11, color: P.warn, fontWeight: 700, marginTop: 2 }}>
                        {`Only ${c.fillable} of ${line.qty} available — ${c.shortfall} stays on ${line.name}`}
                      </div>}
                      {c.money.promotionsBroken && c.money.promotionsBroken.length > 0 &&
                        <div style={{ fontSize: 11, color: P.bad, fontWeight: 700, marginTop: 2 }}>
                          Removes a promotion the customer earned
                        </div>}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{fmt.money(c.product.price)}</span>
                  </div>);
          })}
          </div>

        {sel &&
        <div style={{ borderTop: `1px solid ${P.hairline}`, padding: '11px 12px', background: P.surface2, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {breaks &&
          <div style={{ border: `1.5px solid ${P.bad}`, background: P.badSoft, borderRadius: P.r10, padding: '10px 11px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Icon name="alert" size={15} stroke={2} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: P.ink, fontWeight: 600, lineHeight: 1.45 }}>
                      {G.promotionView(sel).headline}
                    </div>
                  </div>
                </div>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: P.ink, fontWeight: 700 }}>
                <Icon name={settle.direction === 'refund' ? 'cash' : 'card'} size={15} stroke={2} color={P.inkDim} />
                <span>{settle.label}</span>
              </div>

              <label className="ck" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, cursor: 'pointer', color: P.ink2, minHeight: 40 }}>
                <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, accentColor: P.accent }} />
                <span>{breaks
                  ? 'The customer agreed to this swap and to losing the promotion above.'
                  : 'The customer agreed to this swap.'}</span>
              </label>

              <PBtn variant="accent" size="md" full disabled={!attested} onClick={commit}>
                {`Swap for ${sel.product.name}`}
              </PBtn>
            </div>}
      </React.Fragment>}
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
    // "For this order" RANKS, it does not filter — every row survives the
    // predicate and only the ORDER changes. See `recs` / `rank` below.
    fororder: () => true,
    under10: (p) => p.price <= 10,
    sale: (p) => !!p.was,
    highthc: (p) => p.thc != null && p.thc >= 70,
    instock: (p) => p.qty > 20,
    highmgn: (p) => p.margin >= 0.5
  };
  const cats = ['All', ...window.HW.CATS.filter((c) => c !== 'Deals')];
  let rows = all.filter((p) =>
  (!q || (p.name + p.sku + p.brand).toLowerCase().includes(q.toLowerCase())) && (
  cat === 'All' || p.cat === cat) && (
  brands.size === 0 || brands.has(p.brand)) &&
  (SMART[smart] || SMART.none)(p));

  /**
   * "FOR THIS ORDER" — ranked by @hyperwolf/commerce-logic via `window.HWSwap`,
   * the same engine the web cart, the driver app and SwapPanel above rank with.
   * Nothing here re-implements "what would this customer want".
   *
   * The ORDER is the context, and the order is `draft`. Draft lines carry no
   * sku — `draftAdd` builds them from name/brand/cat/price — so they are
   * resolved back to catalogue products BY NAME, exactly as SwapPanel resolves
   * its current line one function up.
   */
  const forOrder = smart === 'fororder';

  /**
   * ⚠️ THE RANKING IS FROZEN WHILE THE CHIP IS ON. Do not re-derive it from
   * `draft`.
   *
   * It used to memoise on `[forOrder, draft]`, and `draftAdd` mutates `draft`.
   * So every "Add" re-ran the engine, the product just added was excluded as
   * now-on-order, and the whole list re-sorted UNDER THE CASHIER'S FINGER — the
   * row they had just tapped jumped out of the viewport, and the next tap
   * landed on something else. Two independent reviewers caught it; it is the
   * kind of bug that is invisible in code and obvious the first time a real
   * person adds two items in a row.
   *
   * `basis` is the order as it stood WHEN THE CHIP WAS SWITCHED ON. Turning the
   * chip off and on again is the deliberate way to re-rank against what is now
   * in the order.
   */
  const [basis, setBasis] = React.useState(null);
  React.useEffect(() => {
    if (!forOrder) { setBasis(null); return; }
    if (basis) return;                       // already frozen for this activation
    setBasis(draft.filter((l) => l.qty > 0).
      map((l) => {const p = all.find((x) => x.name === l.name);return p ? { sku: p.sku, qty: l.qty } : null;}).
      filter(Boolean));
  }, [forOrder]);

  const recs = React.useMemo(() => {
    if (!forOrder || !basis || !window.HWSwap) return null;
    return window.HWSwap.recommendations({
      catalogue: all,
      orderItems: basis,
      surface: 'cart_add_to_order',
      /**
       * The engine's own slot count for this surface, NOT the whole catalogue.
       *
       * Ranking everything put a gold reason line on 21 of 24 visible rows,
       * which is wallpaper rather than a signal and breaks the estate's
       * one-accent-per-view rule. A handful of genuinely-best rows rise with a
       * reason; everything else keeps catalogue order beneath them.
       */
      limit: 6
    });
  }, [forOrder, basis]);
  // sku → the engine's own reason copy, so a row can say WHY it is up here.
  const recReason = React.useMemo(() => {
    const m = new Map();
    (recs || []).forEach((r) => m.set(r.product.sku, r.reason));
    return m;
  }, [recs]);
  // ORDER, never filter. The engine drops anything it scores at zero and skips
  // what is already on the order, so filtering the picker down to its output
  // would quietly empty a control the cashier is mid-search in. Ranked items
  // rise; everything else keeps catalogue order beneath them (sort is stable,
  // and equal keys — not Infinity − Infinity — keep the comparator sane).
  if (forOrder && recs && recs.length) {
    const rank = new Map(recs.map((r, i) => [r.product.sku, i]));
    const rk = (p) => rank.has(p.sku) ? rank.get(p.sku) : Number.MAX_SAFE_INTEGER;
    rows = rows.slice().sort((a, b) => rk(a) - rk(b));
  }
  // Is anything the cashier can actually SEE ranked? Search and the category
  // chips still apply, so a ranking can be live and yet have nothing left in
  // view — and "Best match first" over a list where no row is ranked is a
  // claim about nothing. `recReason` is already the set of ranked skus.
  const rankedHere = forOrder && rows.some((p) => recReason.has(p.sku));

  const toggleBrand = (b) => setBrands((p) => {const n = new Set(p);n.has(b) ? n.delete(b) : n.add(b);return n;});
  const inDraft = (name) => draft.find((l) => l.name === name && l.qty > 0);
  // The "For this order" chip is DROPPED when the engine is absent, rather than
  // shown doing nothing. Its filter predicate is `() => true`, so without
  // window.HWSwap pressing it would change no rows, sort nothing and render no
  // reasons — a control that is always there and sometimes inert is worse than
  // one that is honestly missing. Same rule the engine applies to its own swap
  // control. The other five chips are pure predicates and always work.
  const smartChips = [
    ...(window.HWSwap ? [['fororder', 'For this order']] : []),
    ['under10', 'Under $10'], ['sale', 'On sale'], ['highthc', 'High THC'],
    ['instock', 'In stock'], ['highmgn', 'High margin'],
  ];

  return (
    <div style={{ marginTop: 6, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Field icon="search" placeholder="Search product, SKU or brand…" size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
        {/* categories (color-coded) + brand filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 1 }}>
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <button onClick={() => setBrandOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: P.r999, border: `1px solid ${brands.size || brandOpen ? P.hairline3 : P.hairline2}`, background: brands.size ? P.highlightSoft : P.surface, color: brands.size ? P.ink : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}><Icon name="tag" size={12} stroke={1.9} />{brands.size ? `${brands.size} brand${brands.size > 1 ? 's' : ''}` : 'Brands'}<Icon name="chevron-down" size={11} stroke={2.2} /></button>
            {brandOpen && <>
              <div onClick={() => setBrandOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, width: 220, maxHeight: 240, overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, boxShadow: P.shadowLg, padding: 6, zIndex: 61 }}>
                {brands.size > 0 && <button onClick={() => setBrands(new Set())} style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 7, color: P.inkDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, marginBottom: 2 }}><Icon name="x" size={11} stroke={2} />Clear all</button>}
                {allBrands.map((b) => {const on = brands.has(b);return (
                    <button key={b} onClick={() => toggleBrand(b)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: on ? P.surface3 : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
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
              <button key={k} onClick={() => setSmart(a ? 'none' : k)} style={{ flex: '0 0 auto', padding: '5px 10px', borderRadius: P.r999, border: `1px solid ${a ? P.ink : P.hairline2}`, background: a ? P.ink : P.surface, color: a ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{label}</button>);})}
        </div>
      </div>
      {/* results */}
      <div style={{ maxHeight: 250, overflowY: 'auto', padding: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 6px' }}>
          <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{rows.length} product{rows.length === 1 ? '' : 's'}</span>
          {/* Say which list this is. A ranking that silently failed and a ranking
              that found nothing must not look like a ranking that worked. */}
          {forOrder && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap' }}><Icon name="sparkle" size={11} stroke={2} />{rankedHere ? 'Best match first' : 'No ranking — catalogue order'}</span>}
        </div>
        {rows.map((p) => {const added = inDraft(p.name);const why = forOrder ? recReason.get(p.sku) : null;return (
            <div key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 8 }}>
            <Thumb item={p} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: window.HW.CAT_COLOR[p.cat] || P.neutral, flex: '0 0 auto' }} />{p.brand} · {p.qty} left</div>
              {/* The engine's own reason copy — same conditional third line
                  SwapPanel uses for a partial cover, not a new row shape. */}
              {why && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: P.type.micro, fontWeight: 700, color: P.accentText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Icon name="sparkle" size={10} stroke={2} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{why}</span></div>}
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
// Progressive disclosure. All the same data, but only what needs a DECISION
// is open on arrival — the rest is one click away with its state summarised
// on the closed header, so nothing is hidden, just not shouted at once.
//
// ⚠️ MODULE SCOPE ON PURPOSE. Declared inside WmOrderBlock, this was a NEW
// component type on every render, so React threw every fold away and rebuilt it
// at `defOpen` whenever anything in the block changed state. A fold you opened
// snapped shut the moment you touched a control — and the verification result,
// which arrives by exactly such a state change, closed the fold it was written
// in. Out here the folds keep the state the operator put them in.
function Fold({ id, icon, title, status, tone, children, defOpen }) {
  const P = useP();
  const [open, setOpen] = React.useState(!!defOpen);
  const c = tone === 'bad' ? P.bad : tone === 'warn' ? P.warn : tone === 'good' ? P.good : P.ink2;
  return <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }} data-hw={id}>
    <button onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
      <Icon name={icon} size={14} stroke={1.9} color={c} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{title}</span>
      <div style={{ flex: 1 }} />
      {status && <span style={{ fontSize: 11.5, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{status}</span>}
      <Icon name="chevron-down" size={15} stroke={2.2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: '0 0 auto' }} />
    </button>
    {open && <div style={{ padding: '12px 12px 12px', borderTop: `1px solid ${P.hairline}` }}>{children}</div>}
  </div>;
}

// Search the customer book and link this Weedmaps order to a real person.
//
// Deliberately NOT a create form: this is the escape hatch from "a new customer
// will be created", so the only outcome it offers is picking somebody who
// already exists. Finding nobody is a real answer too, and it says so.
function FindCustomerSheet({ contact, onClose, onPick }) {
  const P = useP();
  const [q, setQ] = React.useState('');
  const ql = q.trim().toLowerCase();
  const all = window.HW.MEMBERS;
  const hits = ql ? all.filter((m) => `${m.name} ${m.email} ${m.phone}`.toLowerCase().includes(ql)) : all.slice(0, 6);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'fade .15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="search" size={15} stroke={2} color={P.accent} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>Link this order to an existing customer</span>
            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{contact ? `${contact.name} · ${contact.phone || 'no phone'} · ${contact.email || 'no e-mail'}` : 'Weedmaps contact'}</span>
          </span>
          <IconBtn icon="x" size={17} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: '12px 18px 0' }}>
          <Field icon="search" placeholder="Search customers by name, e-mail or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 400, overflowY: 'auto' }}>
          <Eyebrow>{ql ? `${hits.length} match${hits.length === 1 ? '' : 'es'}` : 'Most recent customers'}</Eyebrow>
          {hits.map((m) => <WmMergeCandidate key={m.id} m={m} onMerge={() => onPick(m)} />)}
          {hits.length === 0 &&
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
              <Icon name="user-plus" size={15} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Nobody matches “{q}”. If they really are new, close this — the order already creates a customer on its own.</div>
            </div>}
        </div>
      </div>
    </div>);

}

function WmOrderBlock({ o, wm, onLog }) {
  const P = useP();
  const map = window.HW.WM_STATUS_MAP;
  const cur = map[o.stage] || map.verify;
  // MERGE 2026-08-20, hunk 1 of 3: UNION, with main's one line winning.
  // The push/ack rail below is mine and survives whole -- 17 references in this
  // component depend on push/pushState/acked/railTo/wmTone/pushLine.
  // The useState initialiser is MAIN'S, deliberately: mine keyed off wm.level,
  // so a LOW-RISK order rendered 'Verified — cleared for fulfillment' while it
  // sat unreleased in Verification Pending, and the pending action row is the
  // only caller of doVerify, so nothing could then release it. Main's keys off
  // o.stage, which is the fact. Low risk shortens a review; it does not perform
  // one. Both sides were fixing a rendered falsehood; main's was the right fix.
  // WHAT WEEDMAPS ACTUALLY HAS, which is not the same as what our stage implies.
  // This block used to derive the whole progress rail from `cur` -- our stage run
  // through the contract map -- with tone hardcoded to "good". So advancing an
  // order to `ready` painted a green, check-marked rail through
  // READY_FOR_ATTAINMENT and the sentence "customer sees: Ready for pickup",
  // whether or not the push to Weedmaps succeeded. It currently returns HTTP 400,
  // so that rail was reliably a lie, and an operator reading it stops chasing an
  // order the customer was never told about.
  // `_push` is supplied by shared/hw-live.js from the live outbound queue and is
  // ABSENT on mock data, so the mock demo is untouched and renders exactly as before.
  // On the ORDER, not on `wm` -- shared/hw-live.js attaches the queue evidence
  // to the order row. Reading it off `wm` silently yielded null, so every
  // honest branch below was inert and the panel kept asserting delivery. The
  // `wm` fallback is there only so a future seam change cannot re-break this
  // without saying so.
  const push = (o && o._push) || wm._push || null;
  const pushState = push ? (push.state || 'none') : null;
  const acked = pushState === 'sent';
  // The rail advances to what WM acknowledged. Un-acknowledged is not "done".
  const railTo = push == null ? cur.wm : (acked ? ((o && o._mirrored) || wm._mirrored || cur.wm) : null);
  const wmTone = push == null ? 'good'
    : acked ? 'good' : pushState === 'failed' ? 'bad' : 'warn';
  const pushLine = push == null ? null
    : acked ? 'Weedmaps acknowledged this status.'
    : pushState === 'failed'
      ? ('NOT sent to Weedmaps — push failed' + (push.attempts ? ' after ' + push.attempts + ' attempt(s)' : '') + (push.last_error ? ': ' + push.last_error : '') + '. The customer has not been told.')
      : pushState === 'none'
        ? 'Never pushed to Weedmaps. The customer has not been told.'
        : ('Queued for Weedmaps, not yet acknowledged' + (push.attempts ? ' (' + push.attempts + ' attempt(s))' : '') + '. The customer has not been told.');
  // 🔴 THE STAGE IS THE TRUTH, NOT THE RISK SCORE. This initialised to
  // 'approved' whenever `wm.level === 'low'`, so a low-risk order sitting in
  // Verification Pending rendered "Verified — cleared for fulfillment" while
  // the board showed it unreleased — and because the pending action row is the
  // only thing that calls doVerify, nothing could ever release it. Two stories
  // about one order, and the copy was the wrong one.
  //
  // An order is verified when it has LEFT 'verify'. Low risk shortens the
  // review; it does not perform it. (Auto-releasing here instead would move
  // money-bearing state as a side effect of rendering a panel, which is worse.)
  const [verify, setVerify] = React.useState(o.stage === 'verify' ? 'pending' : 'approved');
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

  // ── Where a verification decision leaves the order ────────────────────────
  //
  // "Verify & release" is the gate at the FRONT of fulfilment. The order sits in
  // 'verify' precisely because nobody has cleared it, and releasing it means the
  // floor may now pack it — so approving advances verify → the next stage, and
  // does nothing at all to an order that is already past verification. (The
  // "Override & release" button can be reached on an order that has moved on;
  // it must not drag a packed order backwards, nor shove it past the packers.)
  //
  // Hold and Reject deliberately DO NOT move the stage, and that is the answer,
  // not an omission:
  //   · "On hold" IS the order staying exactly where it is — in Verification
  //     Pending — which is already what the board shows.
  //   · There is no cancelled stage. HW.STAGES ends at 'done' = Completed, so
  //     the only writes available would be refused by setStage or would park a
  //     fraud order in the completed column.
  // Both cases say where the order sits, in the status row below, rather than
  // leaving the operator to guess whether the board moved.
  const doVerify = (v) => {
    setVerify(v);
    const moved = v === 'approved' && o.stage === 'verify' ?
    window.HW.setStage(o.id, window.HW.nextStage('verify')) : null;
    onLog && onLog({ who: 'Manisha Saini', role: 'You',
      action: v === 'approved' ? 'Verified Weedmaps order · cleared for fulfillment' + (moved ? ` · moved to ${stageMeta(moved.stage).label}` : '') :
      v === 'hold' ? `Placed Weedmaps order on hold · pending verification · stays in ${stageMeta(o.stage).label}` :
      `Canceled Weedmaps order · reported as fraud · stays in ${stageMeta(o.stage).label}`,
      time: 'just now', icon: v === 'approved' ? 'check-circle' : v === 'hold' ? 'clock' : 'shield', accent: true });
  };
  // 'Find customer' was the ONLY offered escape from "a new customer will be
  // created", and it was inert — so an operator who could see the match the
  // engine had missed had no way to say so. `linkedTo` records who they picked,
  // because on this branch there is no `matched` and the merged panel would
  // otherwise say "merged into existing customer" without naming anybody.
  const [find, setFind] = React.useState(false);
  const [linkedTo, setLinkedTo] = React.useState(null);
  const doMerge = (m) => {setMerge('merged');setLinkedTo(m);onLog && onLog({ who: 'Manisha Saini', role: 'You', action: `Merged Weedmaps customer into ${m.name} · order history unified`, time: 'just now', icon: 'link', accent: true });};

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
        {[['Name', wm.contact.name, wm.checks.name, false], ['Phone', wm.contact.phone, wm.checks.phone, true], ['Email', (wm.contact && wm.contact.email) || 'Not provided by Weedmaps', (wm.contact && wm.contact.email) ? (wm.checks && wm.checks.email) || 'na' : 'na', false], ...(wm.contact.address ? [['Delivery address', wm.contact.address, wm.checks.address, true]] : [])].map(([lb, val, st, mono]) => {const bad = badState(st);return <div key={lb} style={{ minWidth: 0, gridColumn: lb === 'Delivery address' ? '1/-1' : 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>{lb}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: bad ? P.bad : P.ink, fontFamily: mono ? P.fontMono : P.fontSans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>{bad && <Icon name="shield" size={11} stroke={2} color={P.bad} style={{ flex: '0 0 auto' }} />}</div>
        </div>;})}
      </div>
    </div></Fold>}
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
      {/* The middle and right cells used to assert what Weedmaps holds and what
          the customer reads, both derived from OUR stage. On a rejected push
          that is simply false, and this strip is the most prominent thing on
          the panel -- an operator reads it and stops chasing the order. When
          the live seam supplies push evidence (absent on mock data, so the
          mock demo is unchanged) an unacknowledged status says so here. */}
      {[['Our stage', stageMeta(o.stage).label, P.ink],
        ['Weedmaps status', push && !acked ? 'NOT SENT — ' + cur.wm : cur.wm, push && !acked ? P.bad : '#1F5FC0'],
        ['Customer sees', push && !acked ? 'nothing yet — never delivered' : cur.cust, push && !acked ? P.bad : (cur.tone === 'good' ? P.good : cur.tone === 'bad' ? P.bad : P.ink2)]].map(([k, v, c], i) =>
      <React.Fragment key={k}>
        {i > 0 && <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', color: P.inkFaint }}><Icon name="chevron-right" size={15} stroke={2.2} /></div>}
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: c, fontFamily: i === 1 ? P.fontMono : P.fontSans, marginTop: 2, lineHeight: 1.3 }}>{v}</div>
        </div>
      </React.Fragment>)}
    </div>
    {/* WM status progression — reference, not a decision. Folded by default. */}
    <Fold id="wm-status" icon="link" title="Weedmaps order status" status={cur.wm.replace(/_/g, ' ')} tone={wmTone}>
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}><Icon name="link" size={12} color="#1F5FC0" /><span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>What the customer sees</span><span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>on weedmaps.com</span></div>
      {pushLine && <div style={{ padding: '9px 12px', background: acked ? P.surface : P.surface3, borderBottom: `1px solid ${P.hairline}`, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <Icon name={acked ? 'check' : 'alert'} size={12} color={acked ? P.good : pushState === 'failed' ? P.bad : P.warn || P.inkDim} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: acked ? P.ink : P.bad, lineHeight: 1.35 }}>{pushLine}</span>
      </div>}
      <div style={{ padding: '14px 14px 12px', background: P.surface }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {window.HW.WM_STATUS_ORDER.map((ws, i) => {const ci = railTo == null ? -1 : window.HW.WM_STATUS_ORDER.indexOf(railTo);const active = i === ci;const done = i < ci;return <React.Fragment key={ws}>
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
    <Fold id="wm-fraud" icon="shield" title="Identity & fraud check" tone={(o && o._live) ? 'warn' : wm.level === 'high' ? 'bad' : wm.level === 'medium' ? 'warn' : 'good'}
    status={verify === 'pending' ? wm.flags && wm.flags.length ? wm.flags.length + ' signal' + (wm.flags.length > 1 ? 's' : '') + ' · needs a decision' : 'needs a decision' : verify === 'approved' ? 'cleared' : verify === 'hold' ? 'on hold' : 'rejected'}
    defOpen={verify === 'pending'}>
    <div>
      {/* NO RISK MODEL EXISTS. engine.evaluate_fraud returns (action, reason) —
          there is no score, and no per-field check model at all. On a LIVE
          order the bar below would fill to a number nobody computed and, worse,
          the no-flags branch renders a green tick reading "Identity checks
          passed", which is how an operator releases an order believing it was
          screened. A bar and a badge ARE the claim that a check ran, so no
          value can make them honest — the block has to say it did not run.
          Gated on o._live, which the live seam sets, so mock orders keep the
          design's original behaviour untouched. */}
      {o && o._live ? <div style={{ border: `1px dashed ${P.hairline2}`, borderRadius: P.r12, padding: '11px 12px', marginBottom: 10, background: P.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <Icon name="shield" size={14} stroke={1.9} color={P.inkMute} />
          <span style={{ fontSize: 12, fontWeight: 800, color: P.ink, letterSpacing: '.02em' }}>NOT COMPUTED</span>
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: P.ink2 }}>
          There is no risk score and no per-field identity check in this system.
          The anti-abuse gate returns an action and a reason, not a score, and
          nothing here has screened this customer. Weedmaps sends a name, a
          phone and sometimes an address — no document, no date of birth — so a
          Weedmaps contact starts unverified and that is the correct answer, not
          a failure. Use the identity panel for what is actually known.
        </div>
      </div> : <React.Fragment>
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
      </React.Fragment>}
      {wm.flags && wm.flags.length > 0 &&
        <div style={{ marginTop: 9, padding: '10px 12px', background: P.badSoft, borderRadius: P.r10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.bad, marginBottom: 6 }}>{wm.flags.length} fraud signal{wm.flags.length > 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {wm.flags.map((f, i) => <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11.5, color: P.ink2, lineHeight: 1.4 }}><Icon name="x" size={13} stroke={2.6} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />{f}</div>)}
        </div>
      </div>}
      {gate && verify === 'pending' &&
        <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.badSoft, borderRadius: P.r10, fontSize: 11.5, fontWeight: 600, color: P.bad }}><Icon name="truck" size={14} stroke={2} />Do not dispatch — high-risk delivery must be verified first.</div>}
      {/* Low risk is a shorter review, not a completed one — said here rather
                 than by silently pre-approving the order. */}
      {verify === 'pending' && wm.level === 'low' && !gate &&
        <div style={{ marginTop: 9, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.goodSoft, borderRadius: P.r10 }}>
        <Icon name="check-circle" size={14} stroke={2} color={P.good} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Low risk — every signal on this order matched, so this is a routine release. It still has to be released: the order stays in Verification Pending until somebody does it.</span>
      </div>}
      {verify === 'pending' ?
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <PBtn variant="accent" size="md" icon="check" full onClick={() => doVerify('approved')}>Verify & release</PBtn>
        <PBtn variant="secondary" size="md" icon="clock" onClick={() => doVerify('hold')}>Hold</PBtn>
        <PBtn variant="secondary" size="md" icon="shield" onClick={() => doVerify('canceled')}>Reject</PBtn>
      </div> :
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 11, padding: '10px 12px', borderRadius: P.r10, background: verify === 'approved' ? P.goodSoft : verify === 'hold' ? P.warnSoft : P.badSoft }}>
        <Icon name={verify === 'approved' ? 'check-circle' : verify === 'hold' ? 'clock' : 'shield'} size={16} stroke={2} color={verify === 'approved' ? P.good : verify === 'hold' ? P.warn : P.bad} style={{ flex: '0 0 auto' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: P.ink }}>{verify === 'approved' ? 'Verified — cleared for fulfillment' : verify === 'hold' ? 'On hold — awaiting verification' : 'Rejected & reported as fraud'}</span>
          {/* Say where the order actually IS. A decision that moves nothing on
                     the board looks identical to a dead button unless it says so. */}
          <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>
            {verify === 'approved' ? `Now in ${stageMeta(o.stage).label} on the board.` :
            verify === 'hold' ? `Stays in ${stageMeta(o.stage).label} — nothing is packed until it is released.` :
            `Stays in ${stageMeta(o.stage).label} — the board has no cancelled column, so it will not clear itself off the queue.`}
          </span>
        </span>
        {verify !== 'approved' && <PBtn variant="soft" size="sm" onClick={() => doVerify('approved')}>Override &amp; release</PBtn>}
        {/* Fraud can surface AFTER the order was released. Initialising `verify`
                   from the stage means an already-packed order opens as approved, so this
                   is the path that used to exist only because that order opened as
                   'pending' — kept, rather than quietly removed. It does not move the
                   stage; the row above says where the order still sits. */}
        {verify === 'approved' && o.stage !== 'verify' && <PBtn variant="secondary" size="sm" icon="shield" onClick={() => doVerify('canceled')}>Flag as fraud</PBtn>}
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
          <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Merged into {(linkedTo || matched) ? (linkedTo || matched).name : 'existing customer'}</div>
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
          <PBtn variant="secondary" size="sm" icon="search" onClick={() => setFind(true)}>Find customer</PBtn>
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
    {find && <FindCustomerSheet contact={wm.contact} onClose={() => setFind(false)} onPick={(m) => {doMerge(m);setFind(false);}} />}
  </div>;
}

// Scan-to-pack overlay — hardware barcode scanner (keyboard-wedge) reads each
// unit to save/reserve/mark packed. No camera.
//
// Finishing the scan DOES move the order: scanning is the packing work, so
// pretending otherwise left the board frozen while the shelf emptied. The
// caller owns the transition and passes it in — `nextLabel` names the stage the
// Done button will move the order to, and `stageNote` explains it when it will
// not move at all. The operator reads both BEFORE clicking, not after.
function PackScanner({ items, packScan, onScanOne, onDone, onClose, nextLabel, stageNote }) {
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
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>Scan to pack</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Hardware scanner · reserves stock · {nextLabel ? `Done moves this order to ${nextLabel}` : 'Done leaves the stage unchanged'}</div></div>
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
      <div style={{ padding: '14px 18px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Why Done will not move the board, said before it is clicked. */}
        {stageNote &&
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
          <Icon name="shield" size={14} stroke={2} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>{stageNote}</span>
        </div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: P.fontMono, color: allDone ? P.good : P.ink2 }}>{doneUnits}/{totalUnits} units packed &amp; reserved</span>
          <div style={{ flex: 1 }} />
          <PBtn variant={allDone ? 'accent' : 'secondary'} size="md" icon="check" onClick={onDone}>{nextLabel ? `Done — move to ${nextLabel}` : allDone ? `Done — ${totalUnits} packed` : 'Done'}</PBtn>
        </div>
      </div>
    </div>
  </div>;
}

// ── ORDER MONEY — SEEDED ONCE, STORED, THEN ONLY READ ───────────────────────
//
// 🔴 What this replaces, and why it was money rather than cosmetics.
//
// Every figure on this receipt used to be derived from
//     seed = o.id.length + o.name.length + (o.items || 1)
// and saveEdit writes `items: lines.length`. So ADDING OR REMOVING A LINE
// CHANGED THE SEED, which re-rolled hasDisc, the discount amount and the promo
// — money the customer had already agreed to. The record, the panel that was
// open, and the panel reopened after the save ended up holding three different
// totals for one order.
//
// A hash-derived discount was harmless while nothing could write to an order.
// It stopped being harmless the moment saveEdit could.
//
// So the discount becomes a real, stored property of the record. It is seeded
// ONCE and never re-derived while `o.money` exists, and the seed itself is
// stored alongside it, so nothing else on the receipt (associate, date, card
// last-4, cash tendered) can drift under an edit either.
//
// The seeded totals in HW.ORDERS never matched what the panel rendered
// (ORD-00224: record $52.10, panel $131.85), so any edit rewrote the queue's
// money to an unrelated figure with no warning. One of the two had to give, and
// the panel's is the one derived from an actual basket — so the migration at
// the bottom of this block prices every seeded record and writes the total back
// at LOAD, before a panel can be opened or edited. The board and the panel are
// in agreement from the first paint, and nothing visibly jumps.
const DEMO_BASKET = [
{ name: 'Cake Crasher', brand: window.HW_BRANDS.name.jeeter, cat: 'Flower', qty: 4, price: 15 },
{ name: 'Blueberry Pancakes', brand: window.HW_BRANDS.name.lowell, cat: 'Pre-Rolls', qty: 1, price: 17 },
{ name: 'Doubleshot', brand: window.HW_BRANDS.name.wyld, cat: 'Edibles', qty: 2, price: 20 }];


/**
 * What a line actually rings up.
 *
 * A rung-up sale carries its own `total` with any line-level discount already
 * taken off (screen-register builds it that way); a seeded line has only a unit
 * price. Pricing the first from price × qty hands that discount back at the
 * till, which is the same class of bug as re-rolling the cart discount.
 */
function lineGross(l) {
  return l && l.total != null ? +l.total : (+l.price || 0) * (+l.qty || 0);
}

/**
 * THE STABLE IDENTITY OF ONE ORDER LINE.
 *
 * 🔴 A previous attempt filed return claims against a line by PRODUCT NAME and
 * drained them back in line-index order. One product on two lines at different
 * per-unit gross meant a claim filed against the dearer line was paid out at
 * the cheaper line's rate, and — because nothing was written to the record —
 * closing and reopening the panel let the same purchase be credited a second
 * time. A wallet went 0 -> 18.48 -> 36.96 for ONE purchase.
 *
 * So the join is the line's POSITION plus what that position holds. The name is
 * in there for a human reading the audit row, but it is not what makes the key
 * unique: two lines of the same product differ by index and by price.
 *
 * A completed order is not editable in this panel, so its lines are frozen and
 * the position is stable. If a line ever does move under a filed return, the
 * key stops matching, and the panel REFUSES the whole claim flow out loud
 * rather than guessing which line the earlier return meant.
 */
function lineKey(l, i) {
  return [i, (l && l.name) || '', +((l && l.qty) || 0),
  +(+((l && l.price) || 0)).toFixed(2), +lineGross(l).toFixed(2)].join('|');
}

/** Seed the money for an order that has never had any. Called once per order. */
function seedOrderMoney(o) {
  const seed = (o.id ? o.id.length : 5) + (o.name || '').length + (o.items || 1);
  const pk = (arr) => arr[seed % arr.length];
  // An order that ARRIVED with a basket was rung up by somebody, so its money is
  // real. Inventing a "Veteran 10%" on a real receipt is this same bug pointed
  // the other way — a real order only ever carries the discount it was sold with.
  const real = !!(o.lines && o.lines.length);
  const hasDisc = real ? +(o.discount || 0) > 0 : seed % 2 === 0;
  const hasPromo = !real && seed % 3 !== 0;
  return {
    seed,
    lines: (real ? o.lines : DEMO_BASKET.slice(0, Math.max(1, Math.min(3, o.items || 1)))).map((l) => ({ ...l })),
    discReason: real ? (o.discounts && o.discounts[0] && o.discounts[0].label) || 'Discount applied' :
    pk(['Veteran 10%', 'Daily deal · Edibles', 'Staff discount', 'Loyalty tier — Gold']),
    discAmt: hasDisc ? real ? +(o.discount || 0) : pk([6, 8, 10, 12]) : 0,
    promo: hasPromo ? pk(['WELCOME10', 'HW420', 'SUMMER15', 'FRIENDS']) : null,
    promoAmt: hasPromo ? pk([5, 8, 10]) : 0,
    referral: null,
    referralAmt: 0,
    // What the customer settled with wallet credit or rewards AT THE DRAWER.
    // This is not a discount — the sale was for the full amount and part of it
    // was paid another way — so it comes off the GRAND total, after tax, not
    // off the taxable base.
    credits: +(o.credits || 0),
    /* The driver gratuity, in dollars. Charged, per the owner's decision, but
     * NOT TAXED — a voluntary, separately-stated gratuity is not taxable in
     * California, and folding it into a line would tax it.
     *
     * It is the exact mirror of `credits`: both sit OUTSIDE the taxed base and
     * move the grand total after tax. A credit is money the customer already
     * put in; a tip is money they are adding on top. Same slot, opposite sign. */
    tip: +(o.tipAmt || 0) };

}

/**
 * Price a money record. THE one place an order total is computed — the header,
 * the totals block, the record in HW.ORDERS, the queue card and the engine's
 * `agreed` figures all come through here, so two views of one order cannot show
 * different money.
 */
function priceOrderMoney(m) {
  const lines = m && m.lines || [];
  const sub = +lines.reduce((s, l) => s + lineGross(l), 0).toFixed(2);
  // Clamped: an order edited down below the value of its own discounts prices at
  // zero, never negative.
  const cartDisc = Math.min(+((+m.discAmt || 0) + (+m.promoAmt || 0) + (+m.referralAmt || 0)).toFixed(2), sub);
  const taxBase = +(sub - cartDisc).toFixed(2);
  const tax = window.HW.taxBreakdown(taxBase);
  // 🔴 CREDITS MUST BE SUBTRACTED HERE. The register files `total: collected`
  // (gross minus credits) but no money record, so commitOrderMoney used to
  // re-derive the total from the lines alone and quietly HAND THE CREDITS BACK
  // — merely opening the order panel raised what the books said was collected.
  // A recorded total that does not match what was taken is the bug this whole
  // money authority exists to prevent, pointed the other way.
  const credits = Math.max(0, +(m && m.credits || 0));
  const tip = Math.max(0, +(m && m.tip || 0));
  const gross = +(taxBase + tax.total).toFixed(2);
  // The tip is added AFTER the clamp, deliberately: an order discounted to zero
  // still owes the gratuity the customer chose to add. Clamping the two together
  // would silently swallow it.
  return { sub, cartDisc, taxBase, tax, rate: tax.rate, credits, tip, gross,
    grand: +(Math.max(0, gross - credits) + tip).toFixed(2) };
}

/** The money record for an order — the stored one if there is one, never re-rolled. */
function orderMoney(o) {return o && o.money || seedOrderMoney(o || {});}

/**
 * Store the seeded money on the record and reconcile its total to it, once.
 * Returns true only when it actually wrote — an order that already carries
 * money is never touched again, which is the whole point.
 */
function commitOrderMoney(o) {
  if (!o || o.money) return false;
  /* 🔴 NEVER INVENT MONEY FOR AN ORDER THIS APP DID NOT CREATE.
   *
   * A live Weedmaps order arrives through shared/hw-live.js carrying `_live:true`
   * and, deliberately, NO `money` and NO `lines` — hw-live sets items:0 meaning
   * "we were not told", not "there is nothing". seedOrderMoney's answer to an
   * order with no lines is DEMO_BASKET, so this function would have fabricated a
   * basket for a real customer's order and then OVERWRITTEN its total with the
   * price of goods they never bought.
   *
   * Found by the Weedmaps session's merge QA, not by me. It would not have
   * fired on `main` alone — it needs their seam present to have anything to
   * corrupt — which is exactly why two green halves are not a green whole.
   *
   * A live order's money belongs to whoever fetched it. We display it; we do not
   * price it. */
  if (o._live) return false;
  const m = seedOrderMoney(o);
  return !!window.HW.updateOrder(o.id, { money: m, total: priceOrderMoney(m).grand });
}

// Migrate the board at load, before any panel can be opened.
(window.HW.ORDERS || []).forEach(commitOrderMoney);

// Verification for an order that is NOT a Weedmaps order.
//
// 🔴 There was no release control for one anywhere. WmOrderBlock is the only
// thing that calls setStage out of 'verify', and it renders only when
// HW.WM_ORDER has an entry — so a Stilo or Web order that entered at 'verify'
// (ORD-00224, ORD-00223) sat there for ever, while the pack scanner's note
// pointed the operator at "the Weedmaps block above", which does not exist on
// that order. This is the missing path, and it is named after the gate rather
// than after the channel that happened to have one.
//
// Module scope on purpose — same reason as Fold: declared inline it would be a
// new component type on every render and lose its own state.
function VerifyReleaseBlock({ o, onLog }) {
  const P = useP();
  // The STAGE is the truth, not a risk score. An order is verified when it has
  // left 'verify', and until then the control has to be reachable.
  const released = o.stage !== 'verify';
  const doRelease = () => {
    const moved = window.HW.setStage(o.id, window.HW.nextStage('verify'));
    onLog && onLog({ who: 'Manisha Saini', role: 'You',
      action: 'Verified order · cleared for fulfillment' + (moved ? ` · moved to ${stageMeta(moved.stage).label}` : ''),
      time: 'just now', icon: 'check-circle', accent: true });
  };
  return <div data-hw="verify-release" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 13, border: `1px solid ${released ? P.hairline2 : P.warn}55`, borderRadius: P.r14, background: released ? P.surface2 : P.warnSoft }}>
    <Icon name={released ? 'check-circle' : 'shield'} size={18} stroke={2} color={released ? P.good : P.warn} style={{ flex: '0 0 auto' }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{released ? 'Verified — cleared for fulfillment' : 'Verification pending — nothing is packed until this is released'}</div>
      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>
        {released ? `Now in ${stageMeta(o.stage).label} on the board.` :
        'ID and age were checked at the counter. Releasing hands the order to the packers — this is where the release lives for a non-Weedmaps order.'}
      </div>
    </div>
    {!released && <PBtn variant="accent" size="md" icon="check" style={{ flex: '0 0 auto' }} onClick={doRelease}>Verify &amp; release</PBtn>}
  </div>;
}

// Order details + warranty/return/exchange — refunds go to WALLET only (never cash)
window.OrderDetails = function OrderDetails({ o, onClose }) {
  const P = useP();
  // This record is read straight off the order book and every control below
  // writes back to it — without the subscription a real write (a saved edit, a
  // stage move) renders as nothing happening, which is the bug it is fixing.
  window.useHW();
  const dlv = window.HW.DELIVERY[o.id] || {};
  const wm = o.source === 'Weedmaps' ? window.HW.WM_ORDER[o.id] : null;
  const fmt = window.HW.fmt;
  // ⚠️ READ, NEVER RE-DERIVE. `money` is the stored record; `seed` is the value
  // it was seeded with, kept so the cosmetic picks below (associate, date, card
  // last-4) cannot drift under an edit either. `o.items` is deliberately no
  // longer an input to any of this — it is the field saveEdit writes.
  const money = orderMoney(o);
  const seed = money.seed;
  const pk = (arr) => arr[seed % arr.length];
  // An order created AFTER load — a rung-up sale, a HWSeed demo record — has no
  // money on it yet. Commit it from an effect, never during render.
  React.useEffect(() => {commitOrderMoney(o);}, [o, o.money]);

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
  const [subRecords, setSubRecords] = React.useState([]); // engine SubstitutionRecords filed this session
  // ⚠️ THE PROMO EDITOR EDITS THE DRAFT, NOT THE ORDER. `promo`/`promoAmt` used
  // to be live component state that the COMMITTED total was computed from, so
  // typing a code mid-edit moved the header total of an order nobody had saved,
  // and balanceDiff — draft minus committed — then read "No balance change"
  // because both sides had moved together. These four are the draft's copy;
  // startEdit seeds them from the record and saveEdit writes them back.
  const [dPromo, setDPromo] = React.useState(null);
  const [dPromoAmt, setDPromoAmt] = React.useState(0);
  const [dReferral, setDReferral] = React.useState(null);
  const [dReferralAmt, setDReferralAmt] = React.useState(0);

  // MERGE 2026-08-20, hunk 2 of 3: a THREE-WAY CHAIN, and the ORDER is
  // load-bearing in a way neither branch had on its own.
  //
  //     o.lines  ->  LIVE Weedmaps lines  ->  money.lines
  //
  // Main's side was `o.lines || money.lines`, and money.lines reaches
  // orderMoney() -> seedOrderMoney(), whose answer for an order with NO lines
  // is DEMO_BASKET. A live Weedmaps order arrives with no lines -- hw-live.js
  // sets items:0 deliberately, meaning "we were not told", never "zero items".
  // So main's ordering would have rendered a REAL CUSTOMER'S ORDER as three
  // invented demo products. Found by the main-side session, not by me: I know
  // the live path, they know the money path, and the bug existed only at the
  // join.
  //
  // My side dropped main's edited-order case, where a saved edit puts real
  // lines on the record and those must beat everything.
  //
  // So: an EDITED order's own lines win, then what Weedmaps actually sent,
  // then the money record. The demo basket is last and is now only ever
  // reached by mock data, which is the only thing it was ever true for.
  //
  // THE ID HAS TO BE AN API ID BEFORE IT IS WORTH ASKING ABOUT. This board
  // holds two populations at once: the API's rows (`_live`, id = the real
  // wm_order_id, e.g. 12005695) and pos/data.jsx's demo rows (ORD-00216..237).
  // Asking the route about a demo id is not a lookup that fails, it is a
  // question about an order that never existed — verified against the
  // deployment 2026-08-26:
  //   GET /api/order/lines?wm_order_id=12005695 -> found:true, 1 line
  //   GET /api/order/lines?wm_order_id=00224    -> found:false,
  //       "order 00224 is not in this database at all — no orders row and no
  //        webhook event. Check the id."
  // That last sentence is addressed to somebody who mistyped an id, and it was
  // being produced for every demo row on the board. A demo row's cart is the
  // money record, and always was.
  const _liveLines = isLiveOrder(o) && window.HW_LINES && typeof window.HW_LINES.get === 'function' ?
  window.HW_LINES.get(o.id) : null;
  // .found lives on .data, not the top level, and the first call returns
  // state:'loading' while it fetches. Checking .found here made this branch
  // INERT once already: it always fell through to the invented cart and looked
  // correct. It re-renders through HW_LIVE when the payload lands.
  const _ll = _liveLines && _liveLines.state === 'live' && (_liveLines.lines || []).length
    ? _liveLines.lines : null;
  const _liveBase = _ll ? _ll.map((l) => ({
    name: (l.pos_name || (l.wm && l.wm.name) || l.sku || 'Unresolved line'),
    brand: (l.wm && l.wm.brand) || '',
    cat: l.category || '',
    qty: Number((l.wm && l.wm.quantity) || 1),
    price: Number((l.wm && (l.wm.adjusted_price || l.wm.original_price)) || 0),
    // An unresolved line is not dropped: a line we could not match to a SKU is
    // exactly what an operator needs to see.
    unresolved: !l.resolved,
    unresolvedWhy: l.unresolved_reason || null
  })) : null;
  const baseItems = (o.lines && o.lines.length ? o.lines
                     : _liveBase ? _liveBase
                     : money.lines).map((l) => ({ ...l }));

  // ── Order metadata ──
  const channel = o.channel === 'Delivery' ? 'delivery' : o.source === 'Web' || o.source === 'Weedmaps' || /pick/i.test(o.pay || '') ? 'pickup' : 'pos';
  const channelMeta = { pos: { label: 'POS · In-store', icon: 'register' }, pickup: { label: 'Pickup', icon: 'box' }, delivery: { label: 'Delivery', icon: 'truck' } }[channel];
  const associate = pk(['Manisha Saini', 'Devon Pierce', 'Carla Mendes', 'Theo Park']);
  // ⚠️ THE WRITTEN FIELD WINS. This read the HW.DELIVERY seed and never
  // `o.driver` — the field AssignDriverSheet writes through HW.updateOrder — so
  // assigning or re-routing a driver changed nothing in this modal, and an
  // order with nobody on it still named "Theo Reyes". driverOf() is the same
  // resolver every delivery view already uses: order first, seed second.
  const driver = driverOf(o);
  const hasDriver = driver !== 'Unassigned';
  const placedBy = channel === 'delivery' ? driver : associate;
  const placedRole = channel === 'delivery' ? 'Driver' : 'Sales associate';
  const date = pk(['Jun 10, 2026 · 2:14 PM', 'Jun 9, 2026 · 11:38 AM', 'Jun 8, 2026 · 5:02 PM', 'Jun 7, 2026 · 1:21 PM']);
  const storeName = window.HW.STORE.name;
  // ── The committed money, straight off the record ──────────────────────────
  // Every one of these used to be re-rolled from the seed on each render, which
  // is why an edit could move them. They are read now, and only saveEdit writes
  // them back.
  const hasDisc = money.discAmt > 0;
  const discReason = money.discReason;
  const discAmt = money.discAmt;
  const promo = money.promo;
  const promoAmt = money.promoAmt || 0;
  const referral = money.referral || null;
  const referralAmt = money.referralAmt || 0;
  const hasPromo = !!promo;
  // Priced through the ONE pricer, against the lines actually being rendered.
  const priced = priceOrderMoney({ ...money, lines: baseItems });
  const itemsSub = priced.sub;
  const cartDisc = priced.cartDisc; // total cart-level discount, clamped at the subtotal

  // ── What has ALREADY been given back on this order ────────────────────────
  //
  // 🔴 THIS IS WHAT MAKES A SECOND CREDIT IMPOSSIBLE. `done` is component
  // state: it dies with the modal, so a flow that only sets it lets the same
  // purchase be credited again the moment the panel is reopened. The returns
  // live on the ORDER RECORD, keyed by lineKey(), and every bound below is read
  // from them.
  const filedReturns = Array.isArray(o.returns) ? o.returns : [];
  const liveKeys = baseItems.map((l, i) => lineKey(l, i));
  const returnedBy = {};
  filedReturns.forEach((r) => ((r && r.lines) || []).forEach((rl) => {
    if (rl && rl.key) returnedBy[rl.key] = (returnedBy[rl.key] || 0) + (+rl.qty || 0);
  }));
  // A filed return that no longer matches any line on the order. Nothing can be
  // worked out from here without guessing, so the flow refuses instead.
  const orphanKey = Object.keys(returnedBy).find((k) => returnedBy[k] > 0 && liveKeys.indexOf(k) < 0) || null;
  const refundedSoFar = +filedReturns.reduce((s2, r) => s2 + (+(r && r.amount) || 0), 0).toFixed(2);
  // 🔴 A RETURN GIVES BACK WHAT THE LINE CONTRIBUTED TO WHAT WAS COLLECTED.
  // priceOrderMoney is the authority and it says `grand = gross - credits`:
  // wallet and reward credit settled at the drawer were never taken in the
  // first place. Refunding the line's GROSS share hands those credits back a
  // SECOND time. This ratio is 1 on an order that paid no credits, so it costs
  // an ordinary order nothing.
  const collectedRatio = priced.gross > 0 ? priced.grand / priced.gross : 0;

  // ── Proportional discount allocation across each item (comment 6) ──
  const items = baseItems.map((l, i) => {
    const gross = lineGross(l);
    const discShare = itemsSub > 0 ? +(cartDisc * gross / itemsSub).toFixed(2) : 0;
    const net = gross - discShare;
    const unitNet = l.qty ? net / l.qty : 0;
    const key = liveKeys[i];
    const returned = Math.min(+l.qty || 0, returnedBy[key] || 0);
    return { ...l, gross, discShare, net, unitNet, unitDisc: l.qty ? discShare / l.qty : 0,
      // Identity, what is left on THIS line, and what one of its units is worth
      // back. A returned unit can never exceed what this specific line holds.
      key, idx: i, returned, remaining: Math.max(0, (+l.qty || 0) - returned),
      unitRefund: unitNet * (1 + priced.rate) * collectedRatio };
  });

  // ── CA cannabis tax breakdown (comment 4) ──
  // MERGE 2026-08-20, hunk 3 of 3: MAIN WHOLESALE, with _liveGrand spliced back.
  //
  // Main's tax block is right and mine is deleted: HW.taxBreakdown is one
  // helper precisely so no screen can quietly disagree about tax, and my copy
  // was a second set of the same rates. The governed swapCtx below is main's
  // and has no counterpart on my side.
  //
  // STORED WINS. Where Weedmaps served an authoritative grand_total, that is
  // what the customer agreed to, and recomputing it prices a governed
  // substitution against a fiction -- a recorded case turned a real $28 order
  // into a $9.86 sheet against a $34 queue card. A recomputation that
  // disagrees with the record is the bug, whatever the arithmetic says.
  // HW.taxBreakdown, not a second copy of the rates: data.jsx keeps one helper
  // precisely so no screen can quietly disagree about tax.
  const taxBase = priced.taxBase;
  const stateExcise = priced.tax.excise; // state cannabis excise 15%
  const stateSales = priced.tax.sales; // state sales tax 6%
  const localTax = priced.tax.local; // local cannabis tax 2.22%
  const totalTax = priced.tax.total;
  const taxRate = priced.rate;
  const _liveGrand = _ll && _liveLines && _liveLines.data
    && typeof _liveLines.data.grand_total === 'number'
    ? _liveLines.data.grand_total : null;
  const grand = _liveGrand != null ? _liveGrand : priced.grand;

  // ── The governed-substitution context ───────────────────────────────────────
  //
  // ⚠️ BUILT FROM THE AGREED TOTALS, NOT THE DRAFT. `grand` above is what the
  // customer committed to. Pricing a settlement against the unsaved draft
  // answers a different question — "what would they owe if they had ordered this
  // instead" — and an earlier attempt shipped exactly that, so the door figure
  // and the order total disagreed by real money.
  //
  // There are no fees on a POS order (grand === taxBase + totalTax), so `agreed`
  // reconciles exactly, with no residual to absorb.
  const swapCtx = React.useMemo(() => {
    const G = window.HWGovern;
    if (!G) return null;
    const cents = (d) => Math.round((+d || 0) * 100);
    const now = new Date();

    const lines = items.map((l, i) => ({
      id: 'ol' + i,
      productId: (window.HW.PRODUCTS.find((p) => p.name === l.name) || {}).id || l.name,
      quantity: l.qty,
      unitPriceCents: cents(l.price),
    }));

    // A DELIVERY order already dispatched to a van draws from THAT van; anything
    // else is fulfilled off the shop floor. A driver cannot hand over stock that
    // is still in the store.
    const regionId = G.orderKitId(o.id);
    const kit = regionId ? G.buildKit(regionId, { now }) : G.buildStoreKit({ now });

    return {
      now,
      kitLabel: regionId ? ('van ' + regionId) : 'the store',
      // A POS operator is unscoped by permission (D1) — not carrying a kit, so a
      // 'support'-kind actor to the engine.
      actor: { kind: 'support', id: 'pos-user', name: 'POS' },
      kit,
      order: {
        id: o.id,
        status: 'submitted',
        lane: regionId ? 'express' : 'pickup',
        paymentMethod: /cash/i.test(o.pay || '') ? 'cash' : 'card',
        placedAt: now.toISOString(),
        ...(regionId ? { assignedKitId: regionId } : {}),
        lines,
        agreed: {
          subtotalCents: cents(itemsSub),
          discountCents: cents(cartDisc),
          // NOT ZERO WHEN THE TOTAL IS LIVE. Main's comment below is true of a
          // POS order -- no fees, so grand === taxBase + totalTax and `agreed`
          // reconciles exactly. It is NOT true of a Weedmaps order: their
          // grand_total covers fees and cart-level discounts carried on no line,
          // so hard-coding 0 leaves the governance engine short by real money on
          // exactly the orders it matters for. Derive the residual instead.
          feesCents: _liveGrand != null
            ? cents(grand - taxBase - totalTax)
            : 0,
          taxCents: cents(totalTax),
          totalCents: cents(grand),
        },
      },
      /**
       * A draft row back to the AGREED line it came from, by name. Null for a row
       * ADDED during this edit: there is no agreed line to substitute, so it is
       * not a post-submission substitution at all.
       */
      lineIdFor(dl) {
        const i = items.findIndex((l) => l.name === dl.name);
        return i >= 0 ? 'ol' + i : null;
      },
    };
  }, [o.id, o.pay, items, itemsSub, cartDisc, totalTax, grand]);


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
  const selEntries = Object.entries(selected).filter(([, q]) => q > 0)
  .map(([i, q]) => ({ item: items[+i], q })).filter((e) => e.item);
  // The ceiling on the WHOLE order: everything ever handed back on it, across
  // every session, can never exceed what the order actually collected.
  const refundCap = +Math.max(0, grand - refundedSoFar).toFixed(2);
  const rawRefund = +selEntries.reduce((s2, { item, q }) => s2 + item.unitRefund * q, 0).toFixed(2);
  const refundAmt = +Math.min(rawRefund, refundCap).toFixed(2);
  const refundUnits = selEntries.reduce((s2, { q }) => s2 + q, 0);

  // ── WHOSE WALLET ──────────────────────────────────────────────────────────
  //
  // 🔴 BY ID, NEVER BY NAME. A previous attempt did
  // `MEMBERS.find(m => m.name === o.name)` under a comment claiming it refused
  // to “credit whoever happens to share the name on the ticket” — which is
  // exactly what it did. Two customers called Girish Sharma is not a rare
  // event, and the one who gets the money is whichever the array happens to
  // hold first.
  //
  // A walk-in has no wallet. That is not a problem to route around; it is the
  // answer, and it is said out loud.
  const claimMemberId = o.memberId || o.customerId || null;
  const claimMember = claimMemberId ? window.HW.memberById(claimMemberId) : null;
  const claimRefusal =
  // ⚠️ DO NOT NAME A REMEDY THAT IS NOT ON THE SCREEN. The first draft of this
  // string told the operator to “attach the customer to the order from Members”
  // — and nothing in this estate writes a memberId onto an order, so that is
  // the same defect as the panel that pointed at a Weedmaps block which does
  // not render. Say what is true and stop.
  !claimMemberId ? `This order carries no member id — “${o.name || 'Walk-in'}” is a name on a ticket, not a wallet. Nothing has been credited, and nothing on this screen can attach a member to a completed order. A walk-in has no wallet.` :
  !claimMember ? `This order names member ${claimMemberId}, who is not in the member book. Nothing has been credited — a return cannot be paid into a wallet that does not exist.` :
  orphanKey ? 'A return on this order was filed against a line that is no longer on it, so what is left to give back cannot be worked out from the record. Nothing has been credited, and this screen will not guess which line that return meant.' :
  refundCap <= 0 ? (refundedSoFar > 0
    ? `Everything this order collected (${fmt.money(grand)}) has already been given back. Nothing has been credited.`
    // An order settled entirely on wallet/reward credit collected nothing, so
    // there is nothing at the till to reverse — and saying it was "given back"
    // would be a false statement about money.
    : 'This order collected no money — wallet or reward credit covered it in full. Nothing has been credited.') :
  null;

  const [claimError, setClaimError] = React.useState(null);
  // ⚠️ A LATCH, NOT STATE. Two clicks land in the SAME tick, before React has
  // re-rendered anything — so a guard that reads `done` or `claimOpen` from this
  // render sees the pre-click values on both and files two returns. A ref moves
  // synchronously, which is the only thing that is true of both clicks.
  const claiming = React.useRef(false);
  const submitBlockedWhy =
  selEntries.length === 0 ? 'Select at least one item above to return.' :
  !reason ? 'Choose a reason for the return.' :
  null;
  const canSubmit = claimOpen && !claimRefusal && !submitBlockedWhy;

  const toggleItem = (i) => setSelected((p) => {
    if (!items[i] || items[i].remaining <= 0) return p;   // nothing left on that line
    const n = { ...p };if (n[i]) delete n[i];else n[i] = 1;return n;
  });
  // Bounded by what THIS LINE still holds, not by what it was sold with.
  const setItemQty = (i, q) => setSelected((p) => ({ ...p, [i]: Math.max(1, Math.min(items[i].remaining, q)) }));
  const startClaim = () => {claiming.current = false;setClaimOpen(true);setSelected({});setReason(null);setNote('');setClaimError(null);};

  /**
   * FILE THE RETURN, THEN PAY IT.
   *
   * Everything that decides money is re-read from the order book HERE, at click
   * time — never trusted from the render that drew the button. That is what
   * makes a double-fire and a reopened panel behave the same as a first click:
   * both see the returns that are actually on the record.
   *
   * The record is written BEFORE the wallet, and rolled back if the wallet
   * refuses. The other order — pay, then record — leaves a credited wallet with
   * no return against it, which is a second credit waiting to happen.
   */
  const commitClaim = () => {
    if (claiming.current) return;
    claiming.current = true;
    const refuse = (msg) => {claiming.current = false;setClaimError(msg);};
    setClaimError(null);
    if (claimRefusal) return refuse(claimRefusal);
    const rec = window.HW.orderById(o.id);
    if (!rec) return refuse(`Order ${o.id} is not in the order book, so nothing was credited and no return was filed. Close this and reopen it from the queue.`);
    const prior = Array.isArray(rec.returns) ? rec.returns : [];
    const priorBy = {};
    prior.forEach((r) => ((r && r.lines) || []).forEach((rl) => {
      if (rl && rl.key) priorBy[rl.key] = (priorBy[rl.key] || 0) + (+rl.qty || 0);
    }));
    const claimLines = selEntries.map(({ item, q }) => ({ key: item.key, idx: item.idx, name: item.name, qty: q, unit: +item.unitRefund.toFixed(4) }));
    // Bounded LINE BY LINE against the live record. This is the check a
    // second click in the same tick trips on.
    const over = claimLines.find((cl) => (priorBy[cl.key] || 0) + cl.qty > ((items[cl.idx] && items[cl.idx].qty) || 0));
    if (over) {
      const left = Math.max(0, ((items[over.idx] && items[over.idx].qty) || 0) - (priorBy[over.key] || 0));
      return refuse(`${over.name}: only ${left} of that line ${left === 1 ? 'is' : 'are'} left to return, and ${over.qty} ${over.qty === 1 ? 'was' : 'were'} asked for. Nothing has been credited.`);
    }
    const priorAmt = +prior.reduce((s2, r) => s2 + (+(r && r.amount) || 0), 0).toFixed(2);
    const cap = +Math.max(0, grand - priorAmt).toFixed(2);
    const amount = +Math.min(+claimLines.reduce((s2, cl) => s2 + cl.unit * cl.qty, 0).toFixed(2), cap).toFixed(2);
    if (!(amount > 0)) return refuse(`This order has nothing left to give back — ${fmt.money(grand)} was collected and ${fmt.money(priorAmt)} has already been returned. Nothing has been credited.`);
    // The id is minted from what is already filed, so two returns on one order
    // cannot share one. A duplicate is refused rather than overwriting the
    // first — the same rule addSubRecord already applies to audit records.
    const id = `RET-${o.id}-${prior.length + 1}`;
    if (prior.some((r) => r && r.id === id)) return refuse(`A return is already filed under ${id} on this order, so this one was not filed and nothing has been credited.`);
    const record = { id, at: Date.now(), memberId: claimMember.id, member: claimMember.name,
      amount, units: refundUnits, reason, note: note.trim() || null, by: 'Manisha Saini', lines: claimLines };
    const filed = window.HW.updateOrder(o.id, { returns: prior.concat([record]) });
    if (!filed) return refuse(`Order ${o.id} could not be written, so nothing has been credited.`);
    const credited = window.HW.creditWallet(claimMember.id, amount, `Return · ${o.id} · ${reason}`);
    if (!credited) {
      window.HW.updateOrder(o.id, { returns: prior });   // roll the record back
      return refuse(`${claimMember.name}’s wallet refused ${fmt.money(amount)}. Nothing has been credited and no return was filed.`);
    }
    setExtraLog((l) => [...l, { who: 'Manisha Saini', role: 'You',
      action: `Return ${id} · ${refundUnits} unit${refundUnits === 1 ? '' : 's'} · ${reason} · ${fmt.money(amount)} to ${credited.member.name}’s wallet`,
      time: 'just now', icon: 'refresh', accent: true }]);
    setClaimOpen(false);setSelected({});
    setDone({ ...record, wallet: credited.member.wallet });
  };

  // ── Edit-order flow (fulfillment orders) ──
  const startEdit = () => {setDraft(baseItems.map((l) => ({ ...l })));setEditOpen(true);setApproval(false);setEditNote('');
    setDPromo(promo);setDPromoAmt(promoAmt);setDReferral(referral);setDReferralAmt(referralAmt);};
  // A rung-up line carries a `total` with its line discount already inside it,
  // and that total goes stale the instant the quantity moves — so a qty change
  // drops it and the line re-prices from the unit price the operator can see.
  // Rows left alone keep theirs, which is what makes an untouched edit worth
  // exactly zero.
  const draftSetQty = (i, q) => setDraft((d) => d.map((l, idx) => idx === i ? { ...l, total: undefined, qty: Math.max(0, q) } : l));
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

  // `total: undefined` for the SAME reason draftSetQty drops it: a rung-up line
  // carries a total with its line discount inside, and lineGross() PREFERS that
  // total. Merging a new unit while keeping it meant adding a unit of something
  // already on the order moved the quantity and not one cent of the money.
  const draftAdd = (p) => setDraft((d) => {const ex = d.find((l) => l.name === p.name);return ex ? d.map((l) => l.name === p.name ? { ...l, total: undefined, qty: l.qty + 1 } : l) : [...d, { name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price }];});
  // The draft is priced by the SAME function as the committed order, so the two
  // figures either side of balanceDiff are always comparable — an edit that
  // changes nothing is worth nothing, to the cent.
  const draftMoney = { ...money, lines: draft, promo: dPromo, promoAmt: dPromoAmt, referral: dReferral, referralAmt: dReferralAmt };
  const draftPriced = priceOrderMoney(draftMoney);
  const draftSub = draftPriced.sub;
  const draftDisc = draftPriced.cartDisc;
  const draftTaxBase = draftPriced.taxBase;
  const draftGrand = draftPriced.grand;
  const balanceDiff = +(draftGrand - grand).toFixed(2); // + = balance due, − = refund due
  // A line stepped to 0 is a removal — it is what gets saved, not what is shown.
  const keptLines = draft.filter((l) => l.qty > 0);
  const removedCount = baseItems.length - keptLines.length;
  const needsApproval = balanceDiff < -0.01 || removedCount > 0; // refunds / removals need a manager
  const editChanged = Math.abs(balanceDiff) > 0.01 || draft.length !== baseItems.length ||
  draft.some((l, i) => !baseItems[i] || baseItems[i].qty !== l.qty || baseItems[i].name !== l.name) ||
  dPromo !== promo || dReferral !== referral;
  // ⚠️ A DISABLED BUTTON MUST SAY WHY (the Add Product precedent: the gate was
  // right, the silence was the bug). One string, rendered next to the button,
  // and `canSaveEdit` is simply "no reason to refuse".
  const saveBlockedWhy =
  !editChanged ? 'Nothing has changed yet — adjust a quantity, swap a product or add an item.' :
  keptLines.length === 0 ? 'Every item has been removed. That is a cancellation, not an edit — put at least one item back.' :
  needsApproval && !approval ? `${removedCount > 0 ? 'Removing items' : 'Refunding to the wallet'} needs a manager — tick the approval box above.` :
  null;
  const canSaveEdit = !saveBlockedWhy;
  const [saveError, setSaveError] = React.useState(null);

  const saveEdit = () => {
    // ⚠️ COMMIT FIRST, THEN REPORT. This handler used to append a line to
    // component state and nothing else: the record was never touched, so
    // "Order updated" meant "the modal closed" and the queue behind it still
    // showed the old basket and the old money.
    //
    // The MONEY goes with the lines. The discount is a stored property now, so
    // saving has to carry it forward untouched (plus whatever the promo editor
    // changed) and re-price through the one pricer — otherwise the next render
    // reads a record whose lines and total disagree, which is the three-totals
    // bug back again by another door. `total` comes from the same pricer that
    // produced draftGrand, so the queue card and this panel cannot diverge.
    const lines = keptLines.map((l) => {
      const n = { name: l.name, brand: l.brand, cat: l.cat, qty: l.qty, price: l.price };
      if (l.total != null) n.total = +l.total; // an untouched rung-up line keeps what it rang up
      return n;
    });
    const nextMoney = { ...money, lines, promo: dPromo, promoAmt: dPromoAmt, referral: dReferral, referralAmt: dReferralAmt };
    const saved = window.HW.updateOrder(o.id, { money: nextMoney, lines, total: priceOrderMoney(nextMoney).grand, items: lines.length });
    if (!saved) {
      setSaveError(`Order ${o.id} is not in the order book, so nothing was saved. Close this and reopen it from the queue.`);
      return;
    }
    setSaveError(null);
    const verb = balanceDiff > 0 ? `+${fmt.money(balanceDiff)} due at ${channel === 'delivery' ? 'delivery' : 'pickup'}` : balanceDiff < 0 ? `${fmt.money(Math.abs(balanceDiff))} refund owed` : 'no balance change';
    const why = editNote.trim() ? ` · “${editNote.trim()}”` : '';
    setExtraLog((l) => [...l, { who: 'Manisha Saini', role: 'You', action: `Edited order · ${lines.length} line${lines.length === 1 ? '' : 's'} · ${fmt.money(saved.total)} · ${verb}${approval ? ' · mgr approved (Carla M.)' : ''}${why}`, time: 'just now', icon: 'pencil', accent: true }]);
    setEditOpen(false);setSavedEdit(true);
  };

  // ── Scan to pack ───────────────────────────────────────────────────────────
  //
  // Scanning IS the packing work, so the scan is what reports it:
  //   every unit scanned → the packing is finished     → 'ready'
  //   some, but not all  → packing is under way        → 'packing'
  //   nothing scanned    → nothing happened            → no move
  //
  // An order still in 'verify' is NOT released by packing it. Verification is a
  // separate decision made in the block above, and moving a scanned order to
  // 'ready' from there would skip the one gate that exists. So the stage stays
  // put and the scanner says why — on the button, before it is pressed.
  const totalUnits = items.reduce((a, l) => a + l.qty, 0);
  const packedUnits = items.reduce((a, l, i) => a + Math.min(l.qty, packScan[i] || 0), 0);
  const allPacked = totalUnits > 0 && packedUnits >= totalUnits;
  const packTarget =
  o.stage !== 'pack' && o.stage !== 'packing' ? null :
  allPacked ? 'ready' :
  packedUnits > 0 && o.stage === 'pack' ? 'packing' :
  null;
  const packStageNote =
  packTarget || !inFulfillment ? null :
  // ⚠️ NAME A PANEL THAT EXISTS. This sent every unverified order to "the
  // Weedmaps block above", which only renders when HW.WM_ORDER has an entry —
  // so on a Stilo or Web order it pointed the operator at nothing.
  o.stage === 'verify' ? `This order has not been verified yet, so packing it will not move it out of Verification Pending — release it in the ${wm ? 'Weedmaps block' : 'Verification block'} at the top of this order first.` :
  o.stage === 'ready' ? 'This order is already Ready for Pickup — a re-scan re-reserves the stock and leaves the stage alone.' :
  packedUnits === 0 ? 'Nothing has been scanned yet, so Done will leave this order exactly where it is.' :
  null;

  // ── Activity log — who did what, manager approvals, etc. ──
  const stageOrder = ['verify', 'pack', 'packing', 'ready', 'done'];
  const reached = stageOrder.indexOf(o.stage || 'done');
  const baseLog = [
  { who: channel === 'delivery' || channel === 'pickup' ? 'Online order' : associate, role: channel === 'pos' ? 'Sales associate' : 'Web', action: `Order created · ${channelMeta.label}`, time: date.split(' · ')[1] || date, icon: 'plus' },
  reached >= 0 && { who: associate, role: 'Sales associate', action: 'ID verified · age check passed', time: '2:16 PM', icon: 'check-circle' },
  reached >= 1 && { who: pk(['Devon Pierce', 'Carla Mendes']), role: 'Budtender', action: 'Pick ticket printed · staged to pack', time: '2:21 PM', icon: 'box' },
  reached >= 2 && { who: pk(['Theo Park', 'Devon Pierce']), role: 'Budtender', action: 'Packing started', time: '2:28 PM', icon: 'box' },
  hasDisc && { who: 'Carla Mendes', role: 'Manager', action: `Approved discount · ${discReason}`, time: '2:30 PM', icon: 'shield', accent: true },
  reached >= 3 && { who: pk(['Theo Park', 'Devon Pierce']), role: 'Budtender', action: channel === 'delivery' ? hasDriver ? 'Handed to driver · ' + driver : 'Staged for dispatch · no driver assigned yet' : 'Ready for pickup · customer notified', time: '2:34 PM', icon: 'check' },
  reached >= 4 && { who: o.name, role: 'Customer', action: 'Order completed', time: '2:41 PM', icon: 'check-circle' }].
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
          {/* The release gate for everything that is NOT a Weedmaps order. A
                     Stilo or Web order entering at 'verify' had no release control on any
                     screen — see VerifyReleaseBlock. */}
          {!wm && inFulfillment && <VerifyReleaseBlock o={o} onLog={(e) => setExtraLog((l) => [...l, e])} />}
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
                  {/* The refusal names itself. A greyed-out Save with no
                             sentence beside it is indistinguishable from a dead one. */}
                  {(saveError || saveBlockedWhy) &&
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: saveError ? P.badSoft : P.surface2, border: `1px solid ${saveError ? P.bad : P.hairline2}`, borderRadius: P.r10 }}>
                    <Icon name={saveError ? 'shield' : 'info'} size={14} stroke={2} color={saveError ? P.bad : P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>{saveError || saveBlockedWhy}</span>
                  </div>}
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
                <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: allPacked ? P.good : P.inkMute }}>{packedUnits}/{totalUnits} packed</span>
                <PBtn variant={allPacked ? 'soft' : 'accent'} size="sm" icon="package" onClick={() => setScanOpen(true)}>{allPacked ? 'Re-scan' : 'Scan to pack'}</PBtn>
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
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, width: 56, textAlign: 'right' }}>{fmt.money(lineGross(l))}</span>
                    <IconBtn icon="swap" size={14} style={{ width: 28, height: 28 }} title="Swap for another product" onClick={() => {setSwapIdx((x) => x === i ? null : i);setShowAdd(false);}} />
                    <IconBtn icon="trash" size={14} style={{ width: 28, height: 28 }} onClick={() => draftRemove(i)} />
                  </div>
                {swapIdx === i && <SwapPanel P={P} fmt={fmt} line={l} draft={draft} orderCtx={swapCtx}
                  onClose={() => setSwapIdx(null)}
                  onSwap={(c, res) => {draftSwap(i, c);setSwapIdx(null);
                    if (res && res.ok && res.record) setSubRecords((r) => [...r, res.record]);}} />}
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
                // A line with nothing left on it is not pickable — the bound is
                // per line, read from the returns filed on the record.
                const pickable = claimOpen && !done && l.remaining > 0;
                const packed = inFulfillment && (packScan[i] || 0) >= l.qty;
                return (
                  // ⚠️ A ROW THE OPERATOR CLICKS IS A CONTROL. While it is
                  // pickable it announces itself as one — which is also what
                  // makes it addressable to anything driving this screen; a
                  // bare div with an onClick is unreachable to a keyboard and
                  // to a test alike, and an unreachable money control is how
                  // the dead commit button survived review twice.
                  <div key={i} data-hw-i={pickable ? 'return-line' : undefined} data-hw-line={i}
                  role={pickable ? 'button' : undefined} tabIndex={pickable ? 0 : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', minHeight: 40, background: packed ? P.goodSoft : active ? P.surface3 : P.surface2, border: `1.5px solid ${packed ? P.good : active ? P.ink : P.hairline}`, borderRadius: P.r10, cursor: pickable ? 'pointer' : 'default' }} onClick={() => pickable && toggleItem(i)}>
                    {packed && <Icon name="check-circle" size={16} stroke={2} color={P.good} style={{ flex: '0 0 auto' }} />}
                    {pickable &&
                    <span style={{ flex: '0 0 auto', width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${active ? P.ink : P.hairline3}`, background: active ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{active && <Icon name="check" size={11} stroke={3} color={P.surface} />}</span>}
                    <Thumb item={{ name: l.name, cat: l.cat }} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{l.name}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{l.brand} · {fmt.money(l.price)} ea{l.discShare > 0 ? ` · −${fmt.money(l.discShare)} disc` : ''}{l.returned > 0 ? ` · ${l.returned} of ${l.qty} returned` : ''}</div>
                    </div>
                    {/* per-item qty selector when this item is selected & qty>1 (comment 7) */}
                    {pickable && active && l.remaining > 1 ?
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Stepper value={selected[i]} min={1} max={l.remaining} onChange={(q) => setItemQty(i, q)} size="sm" />
                        <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>of {l.remaining} left</span>
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
                <PromoEditor promo={dPromo} promoAmt={dPromoAmt} referral={dReferral} referralAmt={dReferralAmt}
              onPromo={(c, v) => {setDPromo(c);setDPromoAmt(v);}} onReferral={(c, v) => {setDReferral(c);setDReferralAmt(v);}} />
                <TotRow k="New subtotal" v={fmt.money(draftSub)} />
                {draftDisc > 0 && <TotRow k="Discounts applied" v={fmt.money(draftDisc)} color={P.good} neg />}
                {window.HW.taxBreakdown(draftTaxBase).lines.map((t) => <TotRow key={t.k} k={t.k} v={fmt.money(t.v)} />)}
                <TotRow k="New total" v={fmt.money(draftGrand)} strong />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 6, padding: '9px 11px', borderRadius: P.r10, background: balanceDiff > 0 ? P.warnSoft : balanceDiff < 0 ? P.goodSoft : P.surface2, border: `1px solid ${balanceDiff > 0 ? P.warn + '55' : balanceDiff < 0 ? P.good + '55' : P.hairline}` }}>
                  <Icon name={balanceDiff > 0 ? 'cash' : balanceDiff < 0 ? 'wallet' : 'check'} size={15} color={balanceDiff > 0 ? P.warn : balanceDiff < 0 ? P.good : P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{balanceDiff > 0 ? `Balance due at ${channel === 'delivery' ? 'delivery' : 'pickup'}` : balanceDiff < 0 ? 'Refund owed to the customer' : 'No balance change'}</div>
                    {/* ⚠️ SAY ONLY WHAT SAVING ACTUALLY DOES. This read
                          “Overpayment — credited to wallet · applied automatically
                          on save”, and no line of code anywhere writes a wallet on
                          save. Naming a remedy the screen does not perform is the
                          same defect as naming one the screen does not show. */}
                    <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>{balanceDiff > 0 ? 'Collect the difference when the order is handed over.' : balanceDiff < 0 ? 'Saving changes the order only — no wallet is credited here. Settle the difference at ' + (channel === 'delivery' ? 'delivery' : 'pickup') + '.' : 'The edited order costs the same as the original.'}</div>
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
          {scanOpen && <PackScanner items={items} packScan={packScan} onScanOne={(i) => setPackScan((s) => ({ ...s, [i]: (s[i] || 0) + 1 }))} onClose={() => setScanOpen(false)}
          nextLabel={packTarget ? stageMeta(packTarget).label : null} stageNote={packStageNote}
          onDone={() => {
            const moved = packTarget ? window.HW.setStage(o.id, packTarget) : null;
            setScanOpen(false);
            setExtraLog((l) => [...l, { who: 'Manisha Saini', role: 'You',
              action: `Scanned & packed ${packedUnits}/${totalUnits} units · reserved from inventory` + (moved ? ` · moved to ${stageMeta(moved.stage).label}` : ''),
              time: 'just now', icon: 'package', accent: true }]);
          }} />}
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
          <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, background: P.surface2, padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* ⚠️ THE REFUSAL LIVES ABOVE THE PANEL IT CAME FROM. Refusing
                    can itself change what this block renders — a claim refused
                    because the order is now fully returned closes the claim
                    panel — and an error rendered INSIDE that panel disappears
                    with it. The operator would see the button do nothing, which
                    is the failure mode this whole flow exists to end. */}
              {claimError &&
            <div data-hw="claim-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                  <Icon name="alert" size={16} stroke={2} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  <div style={{ fontSize: 11.5, color: P.ink, lineHeight: 1.45 }}>{claimError}</div>
                </div>}

              {/* WHAT HAS ALREADY GONE BACK. This is the visible half of the
                    bound: the panel cannot be reopened and credited again,
                    because the returns are on the record and they are shown. */}
              {filedReturns.length > 0 &&
            <div data-hw="returns-filed" style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Icon name="refresh" size={13} stroke={2} color={P.ink2} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Already returned on this order</span>
                    <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{fmt.money(refundedSoFar)} of {fmt.money(grand)}</span>
                  </div>
                  {filedReturns.map((r) =>
              <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, lineHeight: 1.6 }}>
                      <span style={{ color: P.ink2 }}>{r.id}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{(r.lines || []).map((rl) => `${rl.qty} × ${rl.name}`).join(', ')} · {r.reason}</span>
                      <span style={{ color: P.ink, fontWeight: 700 }}>{fmt.money(r.amount)}</span>
                    </div>
              )}
                </div>}

              {refundCap <= 0 ?
            <div data-hw="fully-returned" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: P.surface, border: `1.5px solid ${P.hairline2}`, borderRadius: P.r12 }}>
                  <span style={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: 8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ban" size={17} stroke={1.9} /></span>
                  <div style={{ flex: 1 }}>
                    {/* 🔴 TWO DIFFERENT STATES, AND ONE OF THEM WAS A LIE.
                        `refundCap <= 0` is true both when a return really has
                        given everything back AND when the order collected
                        nothing in the first place because wallet/reward credit
                        covered it — `grand = gross - credits`, so an order
                        settled entirely on credit has grand 0 from the moment
                        it was rung up. Telling that operator "everything has
                        already been given back" is false: nothing has. */}
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>
                      {refundedSoFar > 0 ? 'Nothing left to return' : 'This order collected no money'}
                    </div>
                    <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>
                      {refundedSoFar > 0
                        ? `Everything this order collected (${fmt.money(grand)}) has already been given back.`
                        : <>Wallet or reward credit covered it in full, so there is nothing at the till to reverse. <b style={{ color: P.ink }}>Returning the credit itself is not built yet</b> — adjust the member&rsquo;s wallet directly from their record.</>}
                    </div>
                  </div>
                </div> :
            !claimOpen ?
            <button onClick={startClaim} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 40, padding: '11px 13px', background: P.surface, border: `1.5px solid ${P.hairline2}`, borderRadius: P.r12, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                  <span style={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="refresh" size={17} stroke={1.9} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Start a return / exchange / warranty</div>
                    <div style={{ fontSize: 11.5, color: P.inkDim }}>One flow — select items, choose a reason, credit the member's wallet. {fmt.money(refundCap)} left to give back.</div>
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
                    return <button key={r} onClick={() => setReason(r)} style={{ padding: '6px 11px', borderRadius: P.r999, border: `1px solid ${a ? P.ink : P.hairline2}`, background: a ? P.ink : P.surface, color: a ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{r}</button>;
                  })}
                    </div>
                  </div>

                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional) — condition, manager approval…" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none', boxSizing: 'border-box' }} />

                  {/* WHAT WILL BE WRITTEN, or WHY NOTHING WILL BE. Never both,
                        and never a button that cannot do what it says. */}
                  {claimRefusal ?
              <div data-hw="claim-refused" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                    <Icon name="user-off" size={16} stroke={1.9} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>No wallet to credit — nothing has been credited</div>
                      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>{claimRefusal}</div>
                    </div>
                  </div> :
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, borderRadius: P.r10 }}>
                    <Icon name="wallet" size={16} stroke={1.9} color={P.good} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>To {claimMember.name}’s wallet</div>
                      <div style={{ fontSize: 11.5, color: P.inkDim }}>Item value incl. tax, less its share of the discount{collectedRatio < 1 ? ' and of the credit settled at the drawer' : ''} · no cash refunds.</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: P.good, fontFamily: P.fontMono }}>+{fmt.money(refundAmt)}</span>
                  </div>}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                    {/* A DISABLED BUTTON MUST SAY WHY — the saveEdit precedent. */}
                    {!claimRefusal && submitBlockedWhy && <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: P.inkDim, textAlign: 'right' }}>{submitBlockedWhy}</span>}
                    <PBtn variant="secondary" size="md" onClick={() => setClaimOpen(false)}>Cancel</PBtn>
                    {/* No wallet → no button. An enabled control that can only
                          fail, or a disabled one with no explanation, are the two
                          ways this screen has lied before. */}
                    {!claimRefusal &&
                <PBtn variant="accent" size="md" icon="wallet" disabled={!canSubmit} onClick={commitClaim}>Credit {fmt.money(refundAmt)} to wallet</PBtn>}
                  </div>
                </div>}
            </div>}

          {done &&
          <div data-hw="claim-done" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: P.goodSoft, borderRadius: P.r12 }}>
              <Icon name="check-circle" size={22} stroke={2} color={P.good} />
              <div style={{ flex: 1 }}>
                {/* Every figure here comes off the record that was written and
                      the wallet that took it — not off component state that
                      described an intention. “receipt sent” is gone: there is no
                      mailer in this estate, so nothing was sent. */}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{fmt.money(done.amount)} credited to {done.member}’s wallet</div>
                <div style={{ fontSize: 11.5, color: P.inkDim }}>{done.units} unit{done.units === 1 ? '' : 's'} · {done.reason} · {done.id} · wallet now {fmt.money(done.wallet)}</div>
              </div>
              <PBtn variant="soft" size="md" onClick={onClose}>Done</PBtn>
            </div>}
        </div>
      </div>
    </div>);

};

// Exported so other screens mount the SAME component rather than a fork — the
// check-in queue has to behave identically wherever it appears.
//
// `lineKey` is published for a narrower reason: it is the join a filed return
// uses, and nothing outside this module can construct one. A test that needs to
// put a PRIOR return on a record — to prove the commit path re-reads the book
// rather than trusting its own render — would otherwise have to hand-roll a
// second copy of this function, and a hand-rolled copy that drifts makes the
// test agree with itself instead of with the screen.
Object.assign(window, { CheckInStrip, orderLineKey: lineKey });