// ── Shop@Home appointment — consultative in-home shopping flow ──────────────
//   For customers who booked a scheduled appointment. The genius arrives,
//   reviews the brief, then shops WITH the customer against their budget.
const useP = window.useP;
const _am = (n) => window.HW.fmt.money(n);

window.AppointmentScreen = function AppointmentScreen({ taskId }) {
  const P = useP();const M = window.useM();
  const base = window.findTask(taskId);
  const [zoom, setZoom] = React.useState(null);
  const [showIdCam, setShowIdCam] = React.useState(false);
  const [idOk, setIdOk] = React.useState(!!(base && base.verified));
  if (!base) return <div style={{ height: '100%' }}><window.MTopBar title="Appointment" /></div>;
  const done = M.isDone(taskId);
  const es = window.MD.etaStatus(base.slack);
  const v = window.MD.VISIT[base.visit];
  const brief = base.brief || {};
  const preItems = window.MD.cartTotals(base.items);
  const start = () => {window.M.startCart(taskId, base.items);window.M.push('shop', { taskId });};

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title={base.name} sub="Shop@Home appointment" right={
      <button onClick={() => window.M.openSheet('textcustomer', { task: base })} title="Text customer" style={{ width: 40, height: 40, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chat" size={19} stroke={1.9} /></button>} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 168px' }}>
        {/* appointment window banner */}
        <div style={{ background: P.indica, borderRadius: P.r20, padding: '16px 18px', marginBottom: 16, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.2)', fontSize: 11.5, fontWeight: 800 }}><Icon name="home" size={12} stroke={2.2} color="#fff" />SHOP@HOME</span>
            <div style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.16)', fontSize: 11.5, fontWeight: 700 }}><Icon name={es.icon} size={12} stroke={2} color="#fff" />{es.label}</span>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.01em' }}>{base.win}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', fontFamily: P.fontMono, marginTop: 3 }}>ETA {base.eta} · {base.dist} mi away</div>
        </div>

        {/* prominent visit banner */}
        {v && v.short && <div style={{ marginBottom: 16 }}><window.VisitBanner visit={base.visit} /></div>}

        {/* customer brief */}
        <Eyebrow style={{ marginBottom: 10 }}>Customer brief</Eyebrow>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>AOV goal</div><div style={{ fontSize: 21, fontWeight: 800, color: P.accent, fontFamily: P.fontMono, marginTop: 2 }}>{_am(window.MD.AOV.target)}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>min {_am(window.MD.AOV.min)}</div></div>
            <div style={{ flex: 2, borderLeft: `1px solid ${P.hairline}`, paddingLeft: 14 }}><div style={{ fontSize: 11.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, marginBottom: 6 }}>Interested in</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(brief.interests || []).map((c) => <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: (window.HW.CAT_COLOR[c] || P.ink) + '22', color: window.HW.CAT_COLOR[c] || P.ink, fontSize: 12.5, fontWeight: 700 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: window.HW.CAT_COLOR[c] || P.ink }} />{c}</span>)}</div></div>
          </div>
          {brief.note && <div style={{ display: 'flex', gap: 9, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${P.hairline}` }}><Icon name="note" size={16} stroke={1.9} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} /><div style={{ fontSize: 13.5, color: P.ink2, lineHeight: 1.5 }}>{brief.note}</div></div>}
          {brief.last && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 10 }}>{brief.last}</div>}
        </Card>

        {/* arrival — ID + street view */}
        <window.ArrivalSection base={base} onZoom={setZoom} />

        {/* address + contact */}
        <Card padding={0} style={{ padding: '2px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0' }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="pin" size={17} stroke={1.8} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Address</div><div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, marginTop: 2 }}>{base.addr}, {base.city} {base.zip}</div></div>
            <button onClick={() => window.M.flash('Opening navigation')} style={{ padding: '9px 14px', background: P.ink, color: P.surface, border: 'none', borderRadius: P.r10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="route" size={14} stroke={2} />Go</button>
          </div>
        </Card>

        {/* ID readiness */}
        {idOk ?
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: P.goodSoft, border: `1px solid ${P.good}`, borderRadius: P.r16, marginBottom: 16 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="check" size={20} stroke={2.2} /></span>
            {/* 🔴 "ID on file" IS TRUE FOR ONE OF THESE TWO STATES ONLY.
                `idOk` is seeded from base.verified but is ALSO set by a capture
                made moments ago on this phone, and that capture stores nothing
                (see the note over window.IDCapture in screen-task.jsx). So a
                driver who had just held up a camera was shown "ID on file ·
                Verified", which names a record that does not exist — the same
                claim the toast underneath it used to make, except this one
                stays on screen for the rest of the appointment. The two states
                are told apart rather than sharing one sentence. */}
            <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{base.verified ? 'ID on file · 21+' : 'ID checked · 21+'}</div><div style={{ fontSize: 12.5, color: P.mode === 'dark' ? P.good : '#1B5E20', marginTop: 1, fontWeight: 600 }}>{base.verified ? 'Verified — ready to shop' : 'Checked for this stop — ready to shop'}</div></div>
          </div> :

        <button onClick={() => setShowIdCam(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', background: P.surface, border: `1.5px solid ${P.warn}`, borderRadius: P.r16, cursor: 'pointer', marginBottom: 16 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: P.warnSoft, color: P.warn, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="camera" size={21} stroke={2} /></span>
            <div style={{ flex: 1, textAlign: 'left' }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>Scan customer ID · 21+</div><div style={{ fontSize: 12.5, color: P.warn, marginTop: 2, fontWeight: 600 }}>First-time guest — capture before shopping</div></div>
            <Icon name="chevron-right" size={18} stroke={2} color={P.inkFaint} />
          </button>
        }

        {preItems.count > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: P.surface2, borderRadius: P.r12 }}><Icon name="cart" size={16} stroke={2} color={P.ink2} /><span style={{ fontSize: 12.5, color: P.ink2, fontWeight: 600 }}>{preItems.count} item{preItems.count > 1 ? 's' : ''} pre-picked from their wishlist</span></div>}
      </div>

      {/* footer
          ⚠️ An appointment must ALWAYS have an exit. Shopping is gated on the ID
          scan, and the gate is right — but with nothing beside it the driver hit
          a dead end in exactly the cases that need finishing most: guest not
          home, guest won't show ID, guest changed their mind. The close-out is
          therefore NOT gated; it routes to CompleteScreen, which owns both
          halves of an ending — collect payment, or "Can't complete this order". */}
      {!done ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 30px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
        {!idOk && <div style={{ fontSize: 11.5, color: P.warn, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Scan the customer's ID to begin shopping</div>}
        <PBtn variant="accent" size="xl" full icon="shop" disabled={!idOk} onClick={start}>Start shopping with {base.name.split(' ')[0]}</PBtn>
        <button onClick={() => window.M.push('complete', { taskId })} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4, background: 'transparent', border: 'none', color: P.inkDim, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="flag" size={15} stroke={2} />Close out appointment</button>
      </div> : <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
        <PBtn variant="secondary" size="xl" full icon="receipt" onClick={() => window.M.push('complete', { taskId, receiptOnly: true })}>View receipt</PBtn>
      </div>}

      {zoom && <window.ZoomView kind={zoom} base={base} onClose={() => setZoom(null)} />}
      {showIdCam && <window.IDCapture name={base.name} onCancel={() => setShowIdCam(false)} onCaptured={() => {setIdOk(true);setShowIdCam(false);window.M.flash('ID checked for this stop — not saved to a profile');}} />}
    </div>);
};

Object.assign(window, {});