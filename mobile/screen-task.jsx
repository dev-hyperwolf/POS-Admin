// ── Task detail — arrival (ID + street view), items w/ barcode scan, collect ─
const useP = window.useP;

function findTask(id) {
  return window.MD.TASKS.find((t) => t.id === id) || window.MD.SCHEDULED.find((t) => t.id === id);
}

/* ── THE VAN LEDGER — what this van has already promised away ────────────────
 *
 * `applyOrderSubstitution` hands back `intents.inventory`: a `release` of the
 * unit that came off the order and an `allocate` of the one that replaced it.
 * If nothing applies them, the same physical unit can be promised at every stop
 * on the route — the van is over-allocated once per swap and nothing says so.
 *
 * It deliberately does NOT write back into `DDATA.REGION_STOCK`. That table is
 * the van AS LOADED this morning; what is left is loaded-minus-promised. Fold
 * one into the other and the two become indistinguishable, the load sheet can
 * never be recovered, and every other reader of REGION_STOCK — the delivery
 * app's own screens — silently sees a number that is no longer the load sheet.
 */
const _LEDGER_KEY = 'hw-m-vanledger';
let _ledger = (function () { try { return JSON.parse(localStorage.getItem(_LEDGER_KEY)) || {}; } catch { return {}; } })();
const VanLedger = {
  /** Signed units this van has promised away (−) or had handed back (+). */
  delta(kitId, productId) { const k = _ledger[kitId]; return (k && k[productId]) || 0; },
  /** The ENGINE's inventory intents, applied. Any other shape is ignored. */
  apply(intents) {
    if (!Array.isArray(intents)) return null;
    let touched = false;
    for (const i of intents) {
      const step = !i ? 0
        : i.kind === 'allocate' ? -Math.abs(+i.quantity || 0)
        : i.kind === 'release' ? Math.abs(+i.quantity || 0) : 0;
      if (!step || !i.kitId || !i.productId) continue;
      const k = _ledger[i.kitId] || (_ledger[i.kitId] = {});
      k[i.productId] = (k[i.productId] || 0) + step;
      touched = true;
    }
    if (touched) { try { localStorage.setItem(_LEDGER_KEY, JSON.stringify(_ledger)); } catch {} }
    return touched ? _ledger : null;
  },
  /** A KitInventory adjusted by this ledger. The one passed in is never touched. */
  applyTo(kit) {
    const d = kit && _ledger[kit.kitId];
    if (!d) return kit;
    const units = Object.assign({}, kit.units);
    for (const id of Object.keys(d)) units[id] = Math.max(0, (units[id] || 0) + d[id]);
    return Object.assign({}, kit, { units });
  },
  /** What the van can still physically hand over of one sku. */
  remaining(kitId, productId) {
    const G = window.HWGovern;
    const kit = G && G.buildKit(kitId);
    if (!kit) return 0;
    return Math.max(0, (kit.units[productId] || 0) + VanLedger.delta(kitId, productId));
  },
  reset() { _ledger = {}; try { localStorage.removeItem(_LEDGER_KEY); } catch {} },
};

/* Record ids are minted at MODULE scope on purpose. Attempt 3 minted them from
 * a component ref that reset to 0 on unmount, so two different swaps on the
 * same order produced the SAME id — and `HW.addSubRecord` is idempotent by id,
 * so the second swap filed no audit row at all. */
let _recSeq = 0;
function mintRecordId(orderId, lineId) {
  return 'sub-' + orderId + '-' + lineId + '-' + Date.now().toString(36) + '-' + (++_recSeq);
}

/**
 * Everything the governed flow needs for one stop.
 *
 * ⚠️ THE ORDER'S VAN AND THE ACTOR'S VAN COME FROM DIFFERENT PLACES, and that
 * is the entire guarantee. `base.kitId` is routing's choice, seeded per TASK in
 * `MD.TASK_VAN`; `actorKitId(MD.DRIVER)` is who is carrying it. Derive both from
 * the session — as an earlier attempt did — and `checkActor` compares a value to
 * itself, `wrong_kit` can never fire, and the guarantee is decorative.
 */
function governedFor(base, items) {
  const G = window.HWGovern;
  if (!G) return { G: null, order: null, actor: null, kit: null };
  const MD = window.MD;
  return {
    G,
    order: G.buildOrder(base, { kitId: base.kitId, lines: items }),
    actor: G.buildActor({ id: MD.DRIVER.id, name: MD.DRIVER.name, role: 'driver', kitId: G.actorKitId(MD.DRIVER) }),
    kit: base.kitId ? VanLedger.applyTo(G.buildKit(base.kitId)) : null,
  };
}

// ── Media placeholders (drop real photos here later) ────────────────────────
//
// 🔴 THIS TILE USED TO SAY "ID ON FILE · 21+" FOR EVERY STOP, INCLUDING A
// FIRST-TIME GUEST. `base.verified` is the same field that drives the
// "First-time guest" / "Returning guest" banner text (mobile/data.jsx,
// mobile/chrome.jsx VisitBanner) and the ID-readiness gate in
// screen-appointment.jsx / screen-complete.jsx — it already distinguishes a
// guest with a real prior ID check from one who has never been checked. This
// tile is the only place on the screen that was NOT reading it, so a
// first-timer saw a banner admitting no ID exists yet next to a tile
// asserting one does. Gate on the same field the rest of the screen already
// trusts; do not invent a new "has an ID photo" concept.
function IDPhoto({ base, h = 150, onZoom }) {
  const P = useP();
  const verified = !!(base && base.verified);
  return (
    <button onClick={onZoom} style={{ position: 'relative', width: '100%', height: h, borderRadius: P.r14, overflow: 'hidden', border: `1px solid ${P.hairline2}`, cursor: 'zoom-in', padding: 0, background: `linear-gradient(135deg, ${P.mode === 'dark' ? '#242a1c' : '#e9ecdd'}, ${P.mode === 'dark' ? '#1a1e14' : '#dfe3d2'})` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Avatar name={base.name} size={h * 0.42} /></div>
      <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', fontFamily: P.fontMono }}>{verified ? 'ID ON FILE · 21+' : 'ID VERIFICATION PENDING'}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,.6))' }}><div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{base.name}</div>{verified ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', fontFamily: P.fontMono }}>DOB 09/14/1992 · CA</div> : <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', fontFamily: P.fontMono }}>First-time guest — not yet checked</div>}</div>
      <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 99, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="search" size={13} stroke={2.2} /></div>
    </button>);
}
function StreetView({ base, h = 150, onZoom }) {
  const P = useP();
  return (
    <button onClick={onZoom} style={{ position: 'relative', width: '100%', height: h, borderRadius: P.r14, overflow: 'hidden', border: `1px solid ${P.hairline2}`, cursor: 'zoom-in', padding: 0, background: P.mode === 'dark' ? '#12131A' : '#dbe0ea' }}>
      <svg width="100%" height="100%" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
        <rect width="300" height="160" fill={P.mode === 'dark' ? '#12131A' : '#dbe0ea'} />
        <rect y="112" width="300" height="48" fill={P.mode === 'dark' ? '#1b1d26' : '#c3c9d4'} />
        <path d="M120 160 L150 96 L180 160 Z" fill={P.mode === 'dark' ? '#2a2e3a' : '#aeb6c4'} />
        <rect x="128" y="112" width="44" height="48" fill={P.mode === 'dark' ? '#33384a' : '#9aa3b4'} />
        <rect x="140" y="124" width="20" height="36" fill={P.accent} opacity="0.85" />
        <circle cx="60" cy="70" r="26" fill={P.mode === 'dark' ? '#1f2430' : '#b9c0cd'} />
        <rect x="54" y="70" width="12" height="42" fill={P.mode === 'dark' ? '#2a2e3a' : '#a7afbe'} />
        <path d="M0 120 L300 108" stroke={P.mode === 'dark' ? '#2a2e3a' : '#c9cfd9'} strokeWidth="3" />
      </svg>
      <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', fontFamily: P.fontMono }}>STREET VIEW</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,.55))' }}><div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{base.addr}</div></div>
      <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 99, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="search" size={13} stroke={2.2} /></div>
    </button>);
}

// Arrival section — ID + Street view; 2 staff-customizable layouts (tracked)
function ArrivalSection({ base, onZoom }) {
  const P = useP();
  const [layout, setLayout] = React.useState(() => {try {return localStorage.getItem('hw-m-arrival') || 'split';} catch {return 'split';}});
  const pick = (v) => {setLayout(v);try {localStorage.setItem('hw-m-arrival', v);const k = 'hw-m-arrival-stats';const a = JSON.parse(localStorage.getItem(k) || '{}');a[v] = (a[v] || 0) + 1;localStorage.setItem(k, JSON.stringify(a));} catch {}};
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <Eyebrow>Know before you knock</Eyebrow><div style={{ flex: 1 }} />
        <Seg size="sm" value={layout} onChange={pick} options={[{ value: 'split', label: 'Split' }, { value: 'stack', label: 'Stack' }]} />
      </div>
      {layout === 'split' ?
      <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><IDPhoto base={base} h={150} onZoom={() => onZoom('id')} /></div><div style={{ flex: 1 }}><StreetView base={base} h={150} onZoom={() => onZoom('street')} /></div></div> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><StreetView base={base} h={168} onZoom={() => onZoom('street')} /><IDPhoto base={base} h={150} onZoom={() => onZoom('id')} /></div>}
      <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 8, textAlign: 'center' }}>Tap to enlarge · your team's preferred layout is saved</div>
    </div>);
}

// ID capture — in-app camera with a placement overlay (unverified guests)
//
// 🔴 THIS BUTTON SAID "Save to profile" AND THERE IS NO PROFILE TO SAVE TO.
// Read that as three separate absences, because fixing any one of them alone
// would still leave the claim false:
//
//   1. THERE IS NO IMAGE. `shot` is a BOOLEAN. Pressing the shutter runs
//      setShot(true) and the "captured ID" tile below renders <Avatar name=…>,
//      which draws the customer's INITIALS on a gradient. No File, no blob, no
//      data URL — nothing is digitised, so `onCaptured` has nothing to be
//      handed and is correctly called with no argument. The photo is not
//      dropped on the way to the store; it never existed.
//   2. THERE IS NO PROFILE. A driver task (mobile/data.jsx T_) carries
//      id/order/name/phone/addr — and NO member id. Nothing links a stop to a
//      row in HW.MEMBERS, so "their profile" names a record this app cannot
//      identify. mobile/ references MEMBERS, addMember, addCheckIn, IDV,
//      idPhotos, memberById, HWIdPhotos and IdPhotoCapture exactly ZERO times.
//   3. AND A PHOTO MUST NOT MINT A LEDGER ROW ANYWAY. pos/data.jsx (addCheckIn)
//      rules on this explicitly: `doc` is what a scanner read, `idPhotos` is
//      what a human photographed, and an IDV row for a person no document has
//      been seen for would put an identity-ledger entry behind a snapshot. So
//      wiring this to IDV would not be the missing half of the fix — it would
//      be a second, worse defect.
//
// ⚠️ SO THE COPY WAS CHANGED AND NO WRITER WAS INVENTED. What actually happens
// is real and worth saying: the driver eyeballed the ID and the shopping /
// collection gate opens. What does NOT happen is any persistence — the gate is
// React state (useState in screen-appointment.jsx and screen-complete.jsx),
// discarded on unmount. A driver told an ID was "saved to profile" would
// reasonably stop re-checking it on the next visit, and would be wrong.
window.IDCapture = function IDCapture({ name, onCancel, onCaptured }) {
  const P = useP();
  const [shot, setShot] = React.useState(false);
  const CW = 300,CH = CW / 1.586; // ID-1 card ratio
  const corner = (pos) => {const b = `3px solid ${P.accent}`;const s = { position: 'absolute', width: 26, height: 26 };const m = { tl: { top: -2, left: -2, borderTop: b, borderLeft: b, borderTopLeftRadius: 8 }, tr: { top: -2, right: -2, borderTop: b, borderRight: b, borderTopRightRadius: 8 }, bl: { bottom: -2, left: -2, borderBottom: b, borderLeft: b, borderBottomLeftRadius: 8 }, br: { bottom: -2, right: -2, borderBottom: b, borderRight: b, borderBottomRightRadius: 8 } }[pos];return <span style={{ ...s, ...m }} />;};
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 180, background: '#000', display: 'flex', flexDirection: 'column', animation: 'fade .15s ease' }}>
      <div style={{ height: 52, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px' }}><div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Scan customer ID</div><div style={{ flex: 1 }} /><button onClick={onCancel} style={{ width: 38, height: 38, borderRadius: 99, background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={19} stroke={2.2} /></button></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {!shot ? <>
          <div style={{ position: 'relative', width: CW, height: CH, borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', background: 'rgba(255,255,255,.04)' }}>
            {corner('tl')}{corner('tr')}{corner('bl')}{corner('br')}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: .5 }}><Icon name="user" size={40} stroke={1.5} color="#fff" /><div style={{ width: 90, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.4)' }} /><div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.3)' }} /></div>
          </div>
          <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 13.5, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>Lay the <b style={{ color: '#fff' }}>front of the ID</b> flat inside the frame. Fill the box and avoid glare.</div>
        </> : <>
          <div style={{ width: CW, height: CH, borderRadius: 12, overflow: 'hidden', border: `2px solid ${P.good}`, background: `linear-gradient(135deg, #2b3220, #1a1e14)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Avatar name={name} size={70} /><span style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: P.fontMono }}>ID CAPTURED</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: P.good, fontSize: 13.5, fontWeight: 700 }}><Icon name="check-circle" size={17} stroke={2} />Looks good — clear & readable</div>
        </>}
      </div>
      <div style={{ padding: '16px 20px 40px', background: '#0c0c0c' }}>
        {!shot ?
        <button onClick={() => setShot(true)} style={{ width: 70, height: 70, borderRadius: 99, background: '#fff', border: `4px solid rgba(255,255,255,.4)`, cursor: 'pointer', margin: '0 auto', display: 'block' }} /> :
        <div style={{ display: 'flex', gap: 10 }}><PBtn variant="secondary" size="xl" full icon="refresh" onClick={() => setShot(false)}>Retake</PBtn><PBtn variant="accent" size="xl" full icon="check" onClick={onCaptured}>Confirm ID checked</PBtn></div>}
        {!shot && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', fontSize: 11.5, marginTop: 12, fontFamily: P.fontMono }}>Tap to capture · camera only, no library</div>}
      </div>
    </div>);
};

// Zoom overlay
function ZoomView({ kind, base, onClose }) {
  const P = useP();
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 170, background: 'rgba(0,0,0,.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fade .15s ease' }}>
      <div style={{ width: '100%', maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>{kind === 'id' ? <IDPhoto base={base} h={380} onZoom={() => {}} /> : <StreetView base={base} h={340} onZoom={() => {}} />}</div>
      <button onClick={onClose} style={{ marginTop: 20, padding: '11px 22px', background: 'rgba(255,255,255,.14)', color: '#fff', border: 'none', borderRadius: 99, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Close</button>
    </div>);
}

// ── Item row with batch + scan verification ─────────────────────────────────
function ScanRow({ l, count, onScan, onSwap, mode }) {
  const P = useP();
  const done = count >= l.qty;
  const batch = l.p ? window.MD.batchOf(l.p) : '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${P.hairline}` }}>
      <div style={{ position: 'relative' }}><Thumb item={l.p} size={44} />{done && <span style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 99, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${P.bg}` }}><Icon name="check" size={11} stroke={3} /></span>}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p ? l.p.name : l.sku}</div>
        <div style={{ fontSize: 11.5, color: done ? P.good : P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{l.p ? `${l.p.brand}` : ''} · Batch {batch}{done ? ' ✓' : ''}</div>
        {l.qty > 1 && <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>{Array.from({ length: l.qty }).map((_, i) => <span key={i} style={{ width: 16, height: 5, borderRadius: 3, background: i < count ? P.good : P.hairline3 }} />)}</div>}
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: done ? P.good : P.ink2, fontFamily: P.fontMono }}>{count}/{l.qty}</div>
        {/* A VERIFIED line can still be swapped — and swapping is exactly what
            invalidates its verification. Hiding the control once the line is
            scanned made the invalidation unreachable, which is how a guard
            stops being a guard. */}
        {mode === 'peritem' && onSwap &&
        <button onClick={onSwap} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 40, padding: '4px 12px', background: 'transparent', color: P.ink2, border: `1px solid ${P.hairline2}`, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="swap" size={13} stroke={2} />Swap</button>}
        {mode === 'peritem' && (done ?
        <span style={{ fontSize: 11.5, fontWeight: 700, color: P.good }}>Verified</span> :
        <button data-tour="scan" onClick={onScan} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: P.ink, color: P.surface, border: 'none', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="barcode" size={13} stroke={2} />Scan {l.qty > 1 ? `(${count + 1}/${l.qty})` : ''}</button>)}
      </div>
    </div>);
}

/**
 * SWAP A LINE ON A LIVE ORDER — the driver's version, GOVERNED.
 *
 * ⚠️ THIS IS POST-SUBMISSION AND IT IS NOT THE SAME AS THE CART.
 * The order is already out. `HWSwap.candidates()` — the shared RANKING core —
 * is the right call for a cart, where nothing has been agreed and nobody has
 * been charged. On a live order it means no actor check, no order-state check,
 * no money against the agreed totals, no promotion check, no settlement figure
 * and no audit record. `HWGovern.planGoverned` / `commitGoverned` is the engine
 * flow that has all six, and this sheet renders it and decides none of it.
 *
 *  1. THE POOL IS ONE VAN'S KIT — `buildKit(base.kitId)`, minus what this van
 *     has already promised away at earlier stops (see VanLedger).
 *  2. SWAPPING INVALIDATES VERIFICATION. Units are scanned per item; replacing
 *     the product means the scans no longer describe what is in the bag.
 *  3. THE ENGINE REFUSES, NOT THIS FILE. The confirm button is never disabled:
 *     the tap reaches `commitGoverned` and the engine's own refusal is what
 *     appears on screen, so the gate is demonstrably the engine's.
 *
 * Layout is the Figma swap sheet (node 1960-54044): the current line with its
 * LANE and QUANTITY, the engine's three ladders named exactly, and each row as
 * BRAND / name / meta · price with the delta as a signed figure beside it.
 */
function MGovernedSwapSheet({ base, items, lineIndex, onClose, onCommitted }) {
  const P = useP();
  const HW = window.HW;
  const [intent, setIntent] = React.useState('upsell');
  const [mode, setMode] = React.useState('similar');
  const [picked, setPicked] = React.useState(null);
  const [attested, setAttested] = React.useState(false);
  const [ackPromo, setAckPromo] = React.useState(false);
  const [reason, setReason] = React.useState(null);
  const [refusal, setRefusal] = React.useState(null);
  /* A SECOND TAP LANDS BEFORE THE SHEET UNMOUNTS. Found by clicking Confirm
   * twice with no re-render in between: two audit records were filed for one
   * swap and the van was debited twice (−4 units where the engine moved 2).
   * `setPicked(null)` cannot prevent it — state does not settle between two
   * synchronous handler calls, so the latch has to be a ref. */
  const committing = React.useRef(false);

  const sig = items.map((i) => i.sku + ':' + i.qty).join(',');
  const G = window.HWGovern;
  // In the deps so the F2 flip — a different driver picks up the phone — is
  // re-planned rather than served from a memo taken under the old kit.
  const driverKit = G ? G.actorKitId(window.MD.DRIVER) : null;
  const ctx = React.useMemo(() => governedFor(base, items), [base.id, base.kitId, sig, driverKit]);
  const lineId = 'l' + (lineIndex + 1);
  const planned = React.useMemo(() => {
    if (!ctx.G) return null;
    return ctx.G.planGoverned({
      order: ctx.order, kit: ctx.kit, lineId, actor: ctx.actor,
      intent, now: new Date(), modes: ctx.G.engine.SWAP_MODES,
    });
  }, [ctx, lineId, intent]);

  const shell = (body) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: P.scrim, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div data-hw-sheet="swap" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '86%', overflowY: 'auto', background: P.surface, borderTopLeftRadius: P.r20, borderTopRightRadius: P.r20, padding: '14px 16px 22px' }}>
        <div style={{ width: 38, height: 4, borderRadius: 99, background: P.hairline3, margin: '0 auto 12px' }} />
        {body}
      </div>
    </div>);

  const note = (text, tone) => (
    <div style={{ display: 'flex', gap: 8, padding: '12px 13px', borderRadius: P.r12, background: tone === 'bad' ? P.badSoft : P.surface2, border: `1px solid ${tone === 'bad' ? P.bad : P.hairline2}`, marginBottom: 12 }}>
      <Icon name={tone === 'bad' ? 'ban' : 'info'} size={16} stroke={2} color={tone === 'bad' ? P.bad : P.inkMute} />
      <div style={{ flex: 1, fontSize: 12.5, color: P.ink, lineHeight: 1.45 }}>{text}</div>
    </div>);

  const header = (
    <>
      <div style={{ fontSize: 11, fontFamily: P.fontMono, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, fontWeight: 700 }}>Swap on a live order</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, marginBottom: 10 }}>Another option</div>
    </>);

  if (!ctx.G) {
    return shell(<>{header}{note('The substitution engine is not loaded on this page, so no alternative can be offered or priced. Nothing here is guessed in its absence.')}<PBtn variant="soft" size="lg" full onClick={onClose}>Close</PBtn></>);
  }

  const cur = window.MD.prod(items[lineIndex] && items[lineIndex].sku);
  const qty = items[lineIndex] ? items[lineIndex].qty : 1;
  const lane = ctx.order ? ctx.order.lane : null;
  const meta = (p, priceCents) => [
    p && p.thc != null ? p.thc + '% THC' : null,
    p && p.wt ? p.wt : null,
    HW.fmt.money((priceCents != null ? priceCents / 100 : (p ? p.price : 0))),
  ].filter(Boolean).join(' · ');

  /* The current line, with its LANE and QUANTITY — the Figma's `SCHEDULED · ×1`.
     The lane is the ENGINE order's lane, not a label typed in here. */
  const currentCard = cur ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, marginBottom: 12 }}>
      <Thumb item={cur} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{cur.brand}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{cur.name}</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{meta(cur)}</div>
      </div>
      {lane && <span style={{ padding: '3px 9px', borderRadius: 99, background: P.surface3, color: P.ink2, fontSize: 11, fontWeight: 800, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase', flex: '0 0 auto' }}>{lane + ' · ×' + qty}</span>}
    </div>) : null;

  // Every refusal on this screen is the ENGINE's, verbatim, including its code.
  if (!planned || !planned.ok) {
    const r = (planned && planned.refusal) || { code: 'line_not_found', message: 'That line is not on this order.' };
    return shell(<>
      {header}{currentCard}
      <div style={{ padding: '12px 13px', borderRadius: P.r12, background: P.badSoft, border: `1px solid ${P.bad}`, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase', color: P.bad, fontWeight: 700 }}><Icon name="ban" size={13} stroke={2.2} color={P.bad} />{'Refused · ' + r.code}</div>
        <div style={{ fontSize: 12.5, color: P.ink, marginTop: 4, lineHeight: 1.45 }}>{r.message}</div>
      </div>
      <PBtn variant="soft" size="lg" full onClick={onClose}>Close</PBtn>
    </>);
  }

  const gate = planned.gate;
  const reasons = ctx.G.REASONS_BY_INTENT[intent] || [];
  const activeReason = reasons.indexOf(reason) >= 0 ? reason : reasons[0];

  // ── Step 2 — confirm, price and record ───────────────────────────────────
  if (picked) {
    const cod = base.pay === 'cod';
    const d = picked.settlement.amountCents;
    const agreedLabel = HW.fmt.money(ctx.order.agreed.totalCents / 100);
    const commit = () => {
      if (committing.current) return;
      committing.current = true;
      const res = ctx.G.commitGoverned({
        order: ctx.order, plan: planned.plan, candidate: picked.candidate, actor: ctx.actor,
        reason: activeReason, attested, acknowledgePromotionLoss: ackPromo,
        now: new Date(), recordId: mintRecordId(ctx.order.id, planned.plan.lineId),
      });
      // A refusal is not a commit: unlatch so the driver can attest and retry.
      if (!res.ok) { committing.current = false; setRefusal(res.refusal); return; }
      setRefusal(null);
      onCommitted(res.result);
    };
    const toggle = (on, label, onClick, tone) => (
      <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '10px 12px', marginBottom: 10, textAlign: 'left', background: on ? (tone === 'bad' ? P.badSoft : P.surface3) : 'transparent', border: `1.5px solid ${on ? (tone === 'bad' ? P.bad : P.ink) : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer' }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, flex: '0 0 auto', border: `1.5px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="check" size={14} stroke={3} color={P.surface} />}</span>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.4 }}>{label}</span>
      </button>);

    return shell(<>
      <div style={{ fontSize: 11, fontFamily: P.fontMono, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, fontWeight: 700 }}>Confirm swap</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: P.ink }}>{picked.name}</div>
      <div style={{ fontSize: 12.5, color: P.inkDim, marginBottom: 12 }}>{'Replacing ' + (cur ? cur.brand + ' ' + cur.name : lineId) + ' · ×' + qty}</div>

      {/* ONE money authority: the engine's figure, in the engine's own words.
          For a COD stop NOTHING HAS BEEN CHARGED YET, so a cheaper swap reduces
          what is collected at the door — it does not generate a refund on top
          of a payment that never happened. */}
      <div style={{ background: cod ? P.accentSoft : P.surface2, border: `1.5px solid ${cod ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, padding: '13px 15px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: cod ? P.accentText : P.inkMute, fontFamily: P.fontMono }}>{cod ? 'To collect at the door' : 'Settlement'}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.01em', margin: '2px 0 3px' }}>{picked.newTotalLabel}</div>
        <div style={{ fontSize: 12, color: P.inkDim, lineHeight: 1.45 }}>{cod
          ? (d === 0
            ? 'Unchanged — still ' + agreedLabel + '. Nothing has been charged yet; this stop is COD.'
            : HW.fmt.money(Math.abs(d) / 100) + (d > 0 ? ' more' : ' less') + ' than the ' + agreedLabel + ' agreed. Nothing has been charged yet; this stop is COD.')
          : picked.settlement.label}</div>
      </div>

      {picked.warnings.map((w, i) =>
        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: P.warn, fontWeight: 600, marginBottom: 8 }}><Icon name="alert" size={14} stroke={2} color={P.warn} />{w}</div>)}

      {picked.promotion.breaks
        ? <div style={{ background: P.badSoft, border: `1px solid ${P.bad}`, borderRadius: P.r12, padding: '11px 13px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase', color: P.bad, fontWeight: 700 }}><Icon name="alert" size={13} stroke={2.2} color={P.bad} />Promotion lost</div>
            <div style={{ fontSize: 12.5, color: P.ink, marginTop: 4, lineHeight: 1.45 }}>{picked.promotion.headline}</div>
          </div>
        /* F4 — the estate publishes no engine-shaped Rule objects and no order
           carries a promotion id, so this gate cannot fire. Say so, rather than
           authoring demo rules to make it demonstrable. */
        : <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: P.inkMute, lineHeight: 1.45, marginBottom: 10 }}>
            <Icon name="info" size={14} stroke={2} color={P.inkMute} />
            <span>No promotion is attached to this order, so this swap cannot cost the customer one. The estate does not yet publish promotions in the engine&apos;s rule shape — the check runs, it simply has nothing to test.</span>
          </div>}

      {picked.promotion.breaks && toggle(ackPromo, picked.promotion.acknowledgeLabel, () => setAckPromo(!ackPromo), 'bad')}

      <div style={{ fontSize: 11, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, fontWeight: 700, marginBottom: 6 }}>Why</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {reasons.map((id) =>
          <button key={id} onClick={() => setReason(id)} style={{ minHeight: 40, padding: '0 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: P.fontSans,
            background: activeReason === id ? P.ink : 'transparent', color: activeReason === id ? P.surface : P.ink2, border: `1px solid ${activeReason === id ? P.ink : P.hairline2}` }}>{ctx.G.REASONS[id]}</button>)}
      </div>

      {toggle(attested, 'The customer agreed to this swap', () => setAttested(!attested))}

      {refusal && <div style={{ padding: '11px 13px', borderRadius: P.r12, background: P.badSoft, border: `1px solid ${P.bad}`, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase', color: P.bad, fontWeight: 700 }}><Icon name="ban" size={13} stroke={2.2} color={P.bad} />{'Refused · ' + refusal.code}</div>
        <div style={{ fontSize: 12.5, color: P.ink, marginTop: 4, lineHeight: 1.45 }}>{refusal.message}</div>
      </div>}

      {/* NEVER disabled. The tap must reach the engine so that what refuses is
          demonstrably the engine and not a local `disabled` attribute. */}
      <PBtn variant="accent" size="xl" full icon="swap" onClick={commit}>Confirm swap</PBtn>
      <PBtn variant="soft" size="lg" full style={{ marginTop: 8 }} onClick={() => { setRefusal(null); setPicked(null); }}>Back to options</PBtn>
    </>);
  }

  // ── Step 1 — the ladders ─────────────────────────────────────────────────
  const rows = gate.byMode[mode] || [];
  const diag = (gate.diagnostics && gate.diagnostics.perMode && gate.diagnostics.perMode[mode]) || null;

  return shell(<>
    {header}
    {currentCard}

    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {ctx.G.engine.SWAP_MODES.map((id) =>
        <button key={id} onClick={() => setMode(id)} style={{ flex: 1, minHeight: 40, borderRadius: P.r8, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize',
          background: mode === id ? P.ink : 'transparent', color: mode === id ? P.surface : P.ink2, border: `1px solid ${mode === id ? P.ink : P.hairline2}` }}>{id}</button>)}
    </div>

    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {['upsell', 'replacement'].map((id) =>
        <button key={id} onClick={() => { setIntent(id); setReason(null); }} style={{ flex: 1, minHeight: 40, borderRadius: 99, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
          background: intent === id ? P.surface3 : 'transparent', color: intent === id ? P.ink : P.inkMute, border: `1px solid ${intent === id ? P.hairline3 : P.hairline2}` }}>{id === 'upsell' ? 'Upgrade' : 'Replacement'}</button>)}
    </div>

    {rows.length === 0
      ? <div style={{ padding: '16px 0', fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>{(diag && diag.note) || ('Nothing in ' + gate.kitId + " is a " + mode + ' alternative to this line.')}</div>
      : rows.map((row, i) => {
        const c = row.candidate;
        const p = HW.PRODUCTS.find((x) => x.sku === row.productId) || null;
        const dl = c.priceDeltaCents === 0 ? null
          : (c.priceDeltaCents < 0 ? '−' : '+') + HW.fmt.money(Math.abs(c.priceDeltaCents) / 100);
        return (
          <div key={row.productId + ':' + i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: `1px solid ${P.hairline}` }}>
            <Thumb item={p} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{c.product.brand}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{c.product.name}</div>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>
                {meta(p, c.product.price)}
                {dl && <span style={{ color: c.priceDeltaCents < 0 ? P.good : P.inkMute, fontWeight: 700 }}>{' ' + dl}</span>}
              </div>
              {c.partial && <div style={{ fontSize: 11, color: P.warn, fontWeight: 700, marginTop: 2 }}>{'Only ' + c.fillable + ' of ' + qty + ' left on this van'}</div>}
            </div>
            <PBtn variant="accent" size="md" title={'Swap to ' + row.productId} onClick={() => { setRefusal(null); setPicked(row); }}>Swap</PBtn>
          </div>);
      })}

    <PBtn variant="soft" size="lg" full style={{ marginTop: 14 }} onClick={onClose}>Cancel</PBtn>
  </>);
}

// Scanner overlay (simulated camera) — requires a scan per UNIT of each item
function Scanner({ items, scanned, onScanOne, onDone, onClose }) {
  const P = useP();
  const cnt = (sku) => scanned[sku] || 0;
  const totalUnits = items.reduce((a, l) => a + l.qty, 0);
  const doneUnits = items.reduce((a, l) => a + Math.min(l.qty, cnt(l.sku)), 0);
  const next = items.find((l) => cnt(l.sku) < l.qty);
  React.useEffect(() => { if (!next) { const t = setTimeout(onDone, 500); return () => clearTimeout(t); } }, [next]);
  const nextUnit = next ? cnt(next.sku) + 1 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 175, background: '#000', display: 'flex', flexDirection: 'column', animation: 'fade .15s ease' }}>
      <div style={{ height: 52, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px' }}><div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Scan items</div><div style={{ flex: 1 }} /><button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 99, background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={19} stroke={2.2} /></button></div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: 250, height: 250, border: `3px solid ${P.accent}`, borderRadius: 24, position: 'relative', boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }}>
          <div style={{ position: 'absolute', left: 12, right: 12, top: '50%', height: 2, background: P.accent, boxShadow: `0 0 12px ${P.accent}`, animation: 'hwscan 1.6s ease-in-out infinite' }} />
        </div>
        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 13.5, fontFamily: P.fontMono }}>{next ? `${next.p ? next.p.name : next.sku} — unit ${nextUnit} of ${next.qty}` : 'All units verified'}</div>
      </div>
      <div style={{ padding: '16px 20px 40px', background: '#0c0c0c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, fontFamily: P.fontMono }}>{doneUnits}/{totalUnits} units verified</span><span style={{ color: P.accent, fontSize: 12.5, fontWeight: 700, fontFamily: P.fontMono }}>{next ? `Batch ${next.p ? window.MD.batchOf(next.p) : ''}` : 'Done'}</span></div>
        {next ?
        <PBtn variant="accent" size="xl" full icon="barcode" onClick={() => onScanOne(next.sku)}>Scan {next.p ? next.p.name.split(' ').slice(0, 2).join(' ') : next.sku} · {nextUnit}/{next.qty}</PBtn> :
        <PBtn variant="accent" size="xl" full icon="check" onClick={onDone}>Done</PBtn>}
      </div>
    </div>);
}

window.TaskScreen = function TaskScreen({ taskId }) {
  const P = useP();const M = window.useM();
  const base = findTask(taskId);
  const [scanned, setScanned] = React.useState(() => ({}));
  const [scanning, setScanning] = React.useState(false);
  const [swapIdx, setSwapIdx] = React.useState(null);
  const [zoom, setZoom] = React.useState(null);
  // ⚠️ HOOKS BEFORE THE EARLY RETURN. `base` can be missing and the effect below
  // must still be called on every render or React re-orders the hook list.
  const items = base ? M.itemsFor(taskId, base.items) : [];
  const itemsSig = items.map((c) => c.sku + ':' + c.qty).join(',');
  const legacySig = M.s.cartTaskId === taskId ? M.s.cart.map((c) => c.sku + ':' + c.qty).join(',') : '';
  /* `Add / edit` routes to the shop screen, which writes the LEGACY single cart
   * slot (`M.s.cart`). That slot is the bug this stop's basket replaces, but the
   * shop screen is the one other legitimate editor of this basket and it cannot
   * be changed from here — so its output is adopted into the per-stop store on
   * the way back in. One basket per stop, still, with two ways to edit it. */
  React.useEffect(() => {
    if (legacySig && legacySig !== itemsSig) window.M.setBasket(taskId, window.M.s.cart);
  }, [taskId, legacySig, itemsSig]);
  /* 🔴 SCANS BELONG TO ONE STOP, AND SO DOES AN OPEN SWAP SHEET.
   * The router renders this screen with a new `taskId` when the driver moves on
   * and React REUSES the instance, so component state survives the move. Two
   * stops carrying the same sku then shared a scan count: driving t2 to
   * verified left t7 — never scanned — reporting "3/5 units" against a bag
   * nobody had touched, and two stops with matching baskets would have unlocked
   * close-out outright. The same reuse left a half-finished swap sheet on
   * screen priced against the previous order.
   * React's documented way to reset state on a prop change: adjust it during
   * render, so nothing is committed with the wrong stop's numbers. */
  const [seenTask, setSeenTask] = React.useState(taskId);
  if (seenTask !== taskId) { setSeenTask(taskId); setScanned({}); setSwapIdx(null); setScanning(false); }
  if (!base) return <div style={{ height: '100%' }}><window.MTopBar title="Order" /></div>;
  const totals = window.MD.cartTotals(items);
  const done = M.isDone(taskId);
  const cod = base.pay === 'cod';
  const st = window.MD.STATUS[done ? 'completed' : base.status || 'not-started'];
  const es = window.MD.etaStatus(base.slack);
  const v = window.MD.VISIT[base.visit];
  const lines = totals.line;
  const allScanned = lines.every((l) => (scanned[l.sku] || 0) >= l.qty);
  const scanOne = (sku) => setScanned((s) => ({ ...s, [sku]: (s[sku] || 0) + 1 }));
  /**
   * A governed swap came back from the engine. Four things happen, all of them
   * driven by what the engine returned and none of them re-derived here.
   *
   * ⚠️ THE BASKET IS REBUILT FROM `result.order.lines` AND NOTHING ELSE.
   * Attempt 4 joined the display rows back to the agreed lines BY SKU while the
   * engine had SPLIT the line by a quantity it derived from the agreed line —
   * two baskets, one index. On a partial the engine leaves the un-covered units
   * on their own line; a sku join silently moves all of them.
   */
  const onCommitted = (result) => {
    // 🔴 THE STORE IS ASKED FIRST, BECAUSE THE BASKET USED TO MOVE FIRST.
    // The old order was: rebuild the basket, restage the cart, THEN file the
    // record — and then flash "Swapped to <product>" no matter what filing
    // returned. `filed` did correctly gate the van debit, so that one line was
    // right; everything around it ignored the answer. On a refusal the driver
    // was holding a rebuilt basket, a restaged collection total and a toast
    // confirming a swap the store had never recorded.
    //
    // addSubRecord returns null in TWO DIFFERENT SITUATIONS and they need two
    // different sentences, which is why this is not one `if (!filed)`:
    //
    //   · ALREADY ON FILE — idempotent by the engine's own record id
    //     (pos/data.jsx addSubRecord). The swap really did happen; this is a
    //     re-commit of the same one, e.g. a double-tap. Nothing more should be
    //     written and the van MUST NOT be debited twice, but calling it a
    //     failure would be its own lie. It is simply already done, and says so.
    //   · NO RECORD, OR A RECORD WITH NO ID — nothing is filed at all. This is
    //     the one that costs money: stock has physically left the bag with no
    //     paper behind it, so the van reconciles short at count-out and there
    //     is nothing to reconcile against. Here NOTHING is mutated — the basket
    //     and the collection total stay as they were, which keeps the screen
    //     and the store telling the same story — and the refusal is said out
    //     loud instead of a confirmation.
    const already = !!(result.record && result.record.id) &&
      window.HW.subRecords(result.record.orderId).some((r) => r.id === result.record.id);
    const filed = window.HW.addSubRecord(result.record);
    if (!filed && !already) {
      setSwapIdx(null);
      window.M.flash('Swap NOT recorded — nothing was filed against this order', 'bad');
      return;
    }
    const next = result.order.lines.map((l) => ({ sku: l.productId, qty: l.quantity }));
    window.M.setBasket(taskId, next);
    // The close-out screen still reads the legacy slot, so it is kept in step —
    // otherwise the driver is told to collect one figure and closes out on
    // another, which is the money bug this whole flow exists to avoid.
    window.M.startCart(taskId, next);
    // The van is debited ONLY for a record that was newly filed. A re-commit of
    // a record already on file must not move the van a second time.
    if (filed) VanLedger.apply(result.intents.inventory);
    // A swap invalidates that line's verification — the scans described a
    // product that is no longer in the bag. Which products moved is the record's
    // answer, not a guess from the basket.
    setScanned((s) => {
      const n = { ...s };
      delete n[result.record.fromProductId];
      delete n[result.record.toProductId];
      return n;
    });
    setSwapIdx(null);
    window.M.flash(filed ? 'Swapped to ' + result.record.toProductName
                         : 'Already swapped to ' + result.record.toProductName);
  };
  const totalUnits = lines.reduce((a, l) => a + l.qty, 0);
  const doneUnits = lines.reduce((a, l) => a + Math.min(l.qty, scanned[l.sku] || 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <window.MTopBar title={base.order} sub={base.name} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 130px' }}>
        {/* status + on-time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P[st.color] || P.inkDim }}>{st.label}</span>
          {base.prio && !done && <span style={{ padding: '2px 9px', borderRadius: 99, background: window.MD.PRIO[base.prio].bg, color: window.MD.PRIO[base.prio].fg, fontSize: 11.5, fontWeight: 700 }}>{window.MD.PRIO[base.prio].label}</span>}
          {v && v.short && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px 2px 7px', borderRadius: 99, background: v.color + (P.mode === 'dark' ? '26' : '1f'), color: v.color, fontSize: 11.5, fontWeight: 800 }}><Icon name={v.icon} size={11} stroke={2.2} />{v.short}</span>}
          <div style={{ flex: 1 }} />
          {base.eta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: P[es.color] + (P.mode === 'dark' ? '22' : '18'), color: P[es.color], fontSize: 11.5, fontWeight: 700 }}><Icon name={es.icon} size={12} stroke={2} />{es.label}</span>}
        </div>

        {/* new / VIP guest banner — prominent */}
        {v && v.short && <div style={{ marginBottom: 16 }}><window.VisitBanner visit={base.visit} /></div>}

        {/* arrival — ID + street view */}
        <ArrivalSection base={base} onZoom={setZoom} />

        {/* customer / address */}
        <Card padding={0} style={{ padding: '2px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${P.hairline}` }}>
            <Avatar name={base.name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{base.name}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{base.phone}</div></div>
            <button onClick={() => window.M.flash('Calling ' + base.name)} style={{ width: 38, height: 38, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={17} stroke={1.9} /></button>
            <button data-tour="text" onClick={() => window.M.openSheet('textcustomer', { task: base })} title="Text customer" style={{ width: 38, height: 38, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.info, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chat" size={17} stroke={1.9} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0' }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="pin" size={17} stroke={1.8} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono }}>Address</div><div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, marginTop: 2 }}>{base.addr}{base.city ? `, ${base.city}` : ''} {base.zip || ''}</div></div>
            <button onClick={() => window.M.flash('Opening navigation')} style={{ padding: '9px 14px', background: P.ink, color: P.surface, border: 'none', borderRadius: P.r10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="route" size={14} stroke={2} />Go</button>
          </div>
        </Card>

        {/* items + barcode scan */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Eyebrow>Verify order · {totals.count} items</Eyebrow><div style={{ flex: 1 }} />
          {!done && <button onClick={() => {window.M.startCart(taskId, items);window.M.push('shop', { taskId });}} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="plus" size={13} stroke={2.2} />Add / edit</button>}
        </div>

        {!done && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name={allScanned ? 'check-circle' : 'barcode'} size={17} stroke={2} color={allScanned ? P.good : P.ink2} />
          <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13.5, fontWeight: 700, color: allScanned ? P.good : P.ink }}>{allScanned ? 'All items scanned & verified' : `Scan to verify · ${doneUnits}/${totalUnits} units`}</span></div>
          {!allScanned && <button onClick={() => setScanning(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: P.ink, color: P.bg, border: 'none', borderRadius: 99, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', flex: '0 0 auto' }}><Icon name="scan" size={14} stroke={2.2} color={P.bg} />Scan all</button>}
        </div>}

        <Card padding={0} style={{ padding: '4px 16px', marginBottom: 16 }}>
          {lines.map((l, i) => <ScanRow key={i} l={l} count={done ? l.qty : (scanned[l.sku] || 0)} onScan={() => scanOne(l.sku)} onSwap={() => setSwapIdx(i)} mode={done ? 'view' : 'peritem'} />)}
          <div style={{ borderTop: `1px solid ${P.hairline2}`, padding: '12px 0 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Subtotal', totals.sub], ...window.HW.taxBreakdown(totals.sub).lines.map((x) => [x.k, x.v])].map(([k, val]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>{k}</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{window.HW.fmt.money(val)}</span></div>)}
          </div>
        </Card>

        {/* BIG to-collect / total */}
        <div style={{ background: cod ? P.accentSoft : P.surface, border: `1.5px solid ${cod ? P.accentBorder : P.hairline2}`, borderRadius: P.r16, padding: '16px 18px', display: 'flex', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: cod ? P.accentText : P.inkMute, fontFamily: P.fontMono }}>{cod ? 'To collect' : 'Order total'}</div>
            {cod && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3 }}>Marked <b style={{ textTransform: 'capitalize' }}>{base.tender}</b> at checkout</div>}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 36, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, letterSpacing: '-.01em' }}>{window.HW.fmt.money(totals.total)}</div>
        </div>

        {!done && <button onClick={() => window.M.openSheet('moretime', { task: base })} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px auto 0', padding: '10px 14px', background: 'transparent', border: 'none', color: P.inkDim, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="clock" size={15} stroke={2} />Customer not ready?</button>}
      </div>

      {/* footer */}
      {!done ?
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
          {!allScanned && <div style={{ fontSize: 11.5, color: P.warn, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Scan all items to continue</div>}
          <PBtn variant="accent" size="xl" full icon={cod ? 'cash' : 'check'} disabled={!allScanned} onClick={() => {window.M.startCart(taskId, items);window.M.push('complete', { taskId });}}>{cod ? `Close out · collect ${window.HW.fmt.money(totals.total)}` : 'Close out · confirm delivery'}</PBtn>
        </div> :
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px 34px', background: P.bg, borderTop: `1px solid ${P.hairline}` }}>
          <PBtn variant="secondary" size="xl" full icon="receipt" onClick={() => window.M.push('complete', { taskId, receiptOnly: true })}>View receipt</PBtn>
        </div>}

      {zoom && <ZoomView kind={zoom} base={base} onClose={() => setZoom(null)} />}
      {/* Keyed by stop AND line: a new line is a new sheet, with no consent
          ticked and nothing picked carried over from the last one. */}
      {swapIdx != null && items[swapIdx] &&
        <MGovernedSwapSheet key={taskId + ':' + swapIdx} base={base} items={items} lineIndex={swapIdx} onClose={() => setSwapIdx(null)} onCommitted={onCommitted} />}
      {scanning && <Scanner items={lines} scanned={scanned} onScanOne={scanOne} onDone={() => { const full = {}; lines.forEach((l) => full[l.sku] = l.qty); setScanned(full); setScanning(false); window.M.flash('All units verified'); }} onClose={() => setScanning(false)} />}
    </div>);
};

/* Published for the same reason the components are: a money-writing path that
 * cannot be addressed from outside the module cannot be tested from outside it
 * either. `MVanLedger` is the van's promised-away ledger; `mintRecordId` is the
 * audit id minter that must never restart at 0. */
Object.assign(window, { findTask, IDPhoto, StreetView, ArrivalSection, ZoomView,
  MGovernedSwapSheet, MVanLedger: VanLedger, mintRecordId, governedFor });

// ── Customer needs more time — smart wait / reroute / reschedule ────────────
window.MoreTimeSheet = function MoreTimeSheet({ task }) {
  const P = useP();
  const [choice, setChoice] = React.useState(null);
  // nearest other not-started stop to knock out while waiting
  const near = window.MD.TASKS.filter((t) => t.id !== (task && task.id) && !window.M.isDone(t.id)).sort((a, b) => a.dist - b.dist)[0];
  const opts = [
    { id: 'wait', mins: '≤5 min', icon: 'clock', tint: P.good, title: 'Wait here', desc: 'Short wait — stay parked and hold the order.' },
    { id: 'reroute', mins: '6–10 min', icon: 'route', tint: P.info, title: 'Run the next stop', desc: near ? `Knock out ${near.name} (${near.dist} mi) and loop back.` : 'Drive to a nearby stop and loop back.' },
    { id: 'resched', mins: '10 min+', icon: 'calendar', tint: P.warn, title: 'Reschedule', desc: 'Push to later today or hand back to dispatch.' },
  ];
  const rec = (m) => { const c = opts.find((o) => o.id === choice); if (!c) return; if (choice === 'wait') window.M.flash('Holding — waiting on customer'); else if (choice === 'reroute' && near) { window.M.closeSheet(); window.M.push('task', { taskId: near.id }); window.M.flash(`Rerouted to ${near.name} — come back after`); return; } else window.M.flash('Sent to dispatch to reschedule'); window.M.closeSheet(); };
  return (
    <window.Sheet title="Customer needs more time?" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="accent" size="xl" full icon="check" disabled={!choice} onClick={rec}>{choice === 'reroute' ? 'Reroute & come back' : choice === 'resched' ? 'Reschedule this stop' : 'Confirm'}</PBtn>
    }>
      <div style={{ fontSize: 13.5, color: P.inkDim, lineHeight: 1.5, marginBottom: 14 }}>How long do they need? We'll suggest the smartest move so your route stays tight.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opts.map((o) => { const a = choice === o.id; return (
          <button key={o.id} onClick={() => setChoice(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', background: a ? o.tint + (P.mode === 'dark' ? '1f' : '14') : P.surface2, border: `1.5px solid ${a ? o.tint : P.hairline2}`, borderRadius: P.r14, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: o.tint + (P.mode === 'dark' ? '22' : '18'), color: o.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={o.icon} size={20} stroke={1.9} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{o.title}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: o.tint, fontFamily: P.fontMono }}>{o.mins}</span></div><div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div></div>
            {a && <Icon name="check-circle" size={18} stroke={2} color={o.tint} />}
          </button>); })}
      </div>
    </window.Sheet>);
};