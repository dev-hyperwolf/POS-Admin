// ── Interactive guided walkthrough — tap-to-advance coach marks ─────────────
//   Steps spotlight a real element; the dim is click-through so the user taps
//   the actual control. Tapping the highlighted target advances the tour.
const useP = window.useP;

// tap:true  → user must tap the spotlighted [data-tour] target to continue
// otherwise → a Next button advances (descriptive steps)
const TOUR = [
{ title: 'Welcome to the Field App', body: "Let's walk through every tool hands-on. Tap along and I'll guide you — skip anytime, or restart from Profile.", place: 'center', cta: 'Start tour', go: () => { window.M.setDuty(true); window.M.setHomeTab('today'); window.M.popAll(); window.M.go('home'); } },
{ title: 'You start on duty here', body: 'This toggle starts and ends your shift — you only see stops while on duty.', target: 'duty' },
{ title: 'Your bottom nav', body: 'Home, Activity, Discrepancy and Profile — with Help in the center, reachable from any screen.', target: 'nav', place: 'top' },
{ title: 'Pack your van first', body: 'Before you roll, stage every order — not just the next one. Each stop card shows a pack status. Tap the highlighted banner to open packing.', target: 'pack', tap: true, place: 'bottom', go: () => { window.M.setDuty(true); window.M.setHomeTab('today'); window.M.popAll(); window.M.go('home'); } },
{ title: 'Scan every order in', body: "Orders are staged only by scanning each item's barcode \u2014 nothing is marked by hand. Scan every line, across all orders, so nothing is missed. Tap Next.", place: 'top', go: () => { window.M.popAll(); window.M.go('home'); window.M.push('packing'); } },
{ title: 'Open a stop', body: 'Tap any stop card to see the full order. Go ahead — tap the highlighted stop.', target: 'stop', tap: true, go: () => { window.M.closeSheet(); window.M.setHomeTab('today'); window.M.popAll(); window.M.go('home'); } },
{ title: 'Know before you knock', body: 'ID on file + a street view of the address, an on-time pill, and one-tap Call / Text / Navigate.', place: 'top' },
{ title: 'Scan to verify', body: 'Confirm the right item and batch by scanning each unit. Tap Scan on the highlighted item.', target: 'scan', tap: true },
{ title: 'Text the customer', body: 'Tap the message button to open your approved templates.', target: 'text', tap: true, place: 'bottom' },
{ title: 'Pick a template', body: 'Each auto-fills the customer name, your ETA and vehicle. Admins manage the list. Tap Next to continue.', place: 'top' },
{ title: 'Customer needs more time?', body: "Nobody at the door, or they need a few minutes? Tap “Customer not ready?” on any stop to wait, run the nearest stop and loop back, or reschedule — dispatch stays in sync so your route stays tight.", place: 'center', go: () => { window.M.closeSheet(); window.M.popAll(); window.M.go('home'); const t = window.MD.TASKS.find((x) => !window.M.isDone(x.id)); window.M.push('task', { taskId: t.id }); window.M.openSheet('moretime', { task: t }); } },
{ title: 'Scheduled & Shop@Home', body: 'Pre-booked and same-day Shop@Home visits live under the Scheduled tab. Tap the highlighted Shop@Home visit to open it.', target: 'appt', tap: true, place: 'top', go: () => { window.M.closeSheet(); window.M.popAll(); window.M.go('home'); window.M.setHomeTab('scheduled'); } },
{ title: 'Close out the order', body: 'Verify ID, collect payment (cash / card / split), and complete. The receipt emails automatically and you get your stop metrics.', place: 'bottom', go: () => { window.M.closeSheet(); window.M.popAll(); window.M.push('complete', { taskId: 't1' }); } },
{ title: 'Your tips stay separate', body: 'Log cash tips so they never hit your pouch, and break a bill from your tip bank with Make change.', place: 'bottom', go: () => { window.M.closeSheet(); window.M.popAll(); window.M.push('tips'); } },
{ title: 'Track your day', body: 'Collected, on-time, upsells, a searchable ledger and route progress. Week / Month show performance, not cash.', place: 'bottom', go: () => { window.M.popAll(); window.M.go('activity'); } },
{ title: 'Reconcile at shift end', body: 'Count cash, confirm card, and respond to inventory flags — loss prevention reviews them. That’s the whole app!', place: 'bottom', go: () => { window.M.popAll(); window.M.go('discrepancy'); } }];

window.TOUR_LEN = TOUR.length;

window.TourOverlay = function TourOverlay() {
  const P = useP();const M = window.useM();
  const step = M.s.tourStep;
  const [rect, setRect] = React.useState(null);
  const [, force] = React.useReducer((x) => x + 1, 0);
  const cur = step >= 0 ? TOUR[step] : null;
  const last = step === TOUR.length - 1;
  const advance = () => last ? window.M.endTour() : window.M.setTourStep(step + 1);

  // auto-start once, the first time the driver goes on duty
  React.useEffect(() => {if (M.s.duty && step < 0 && !window.M.tourSeen()) {const t = setTimeout(() => window.M.startTour(), 600);return () => clearTimeout(t);}}, [M.s.duty]);

  // run the step's setup + measure the spotlight target
  React.useEffect(() => {
    if (!cur) return;
    if (cur.go) cur.go();
    setRect(null);
    const t = setTimeout(() => {
      if (!cur.target) {force();return;}
      const root = document.querySelector('[data-approot]');
      const el = document.querySelector(`[data-tour="${cur.target}"]`);
      if (!root || !el) {setRect(null);return;}
      const cr = root.getBoundingClientRect();const er = el.getBoundingClientRect();
      const scale = cr.width / 402 || 1;
      setRect({ left: (er.left - cr.left) / scale, top: (er.top - cr.top) / scale, width: er.width / scale, height: er.height / scale });
    }, 300);
    return () => clearTimeout(t);
  }, [step]);

  // tap-to-advance: listen for a real tap on the spotlighted target
  React.useEffect(() => {
    if (!cur || !cur.tap) return;
    const handler = (e) => { const hit = e.target.closest && e.target.closest(`[data-tour="${cur.target}"]`); if (hit) { setTimeout(advance, 480); } };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [step]);

  if (!cur) return null;
  const pad = 8;
  const place = cur.place || (rect ? 'auto' : 'bottom');
  const dim = 'rgba(0,0,0,.34)';

  const Card =
  <div style={{ position: 'absolute', left: 16, right: 16, ...(place === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : place === 'top' ? { top: 96 } : { bottom: 30 }), zIndex: 320, pointerEvents: 'auto' }}>
      <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r20, boxShadow: P.shadowLg, padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lightning" size={15} stroke={2.2} /></span>
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>Tour · {step + 1} of {TOUR.length}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => window.M.endTour()} style={{ background: 'none', border: 'none', color: P.inkDim, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Skip</button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, marginBottom: 5 }}>{cur.title}</div>
        <div style={{ fontSize: 13.5, color: P.ink2, lineHeight: 1.5 }}>{cur.body}</div>
        {cur.tap && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '7px 12px', borderRadius: 99, background: P.accentSoft, color: P.accentText, fontSize: 12.5, fontWeight: 800 }}><span style={{ display: 'inline-flex', animation: 'hwtap 1.1s ease-in-out infinite' }}><Icon name="target" size={14} stroke={2.4} /></span>Tap the highlighted spot</div>}
        <div style={{ display: 'flex', gap: 4, margin: '14px 0 14px' }}>{TOUR.map((_, i) => <span key={i} style={{ height: 4, flex: 1, borderRadius: 99, background: i <= step ? P.accent : P.hairline3 }} />)}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {step > 0 && <PBtn variant="secondary" size="lg" icon="chevron-left" onClick={() => window.M.setTourStep(step - 1)}>Back</PBtn>}
          <div style={{ flex: 1 }} />
          {cur.tap
            ? <button onClick={advance} style={{ background: 'none', border: 'none', color: P.inkDim, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Skip step ›</button>
            : <PBtn variant="accent" size="lg" iconRight={last ? 'check' : 'chevron-right'} onClick={advance}>{cur.cta || (last ? 'Finish' : 'Next')}</PBtn>}
        </div>
      </div>
    </div>;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 300, pointerEvents: 'none', animation: 'fade .2s ease' }}>
      {rect && place !== 'center' ?
      <div style={{ position: 'absolute', left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, borderRadius: 14, boxShadow: `0 0 0 3px ${P.accent}, 0 0 0 4000px ${dim}`, animation: cur.tap ? 'hwring 1.4s ease-in-out infinite' : 'none' }} /> :
      <div style={{ position: 'absolute', inset: 0, background: dim }} />
      }
      {Card}
    </div>);

};

Object.assign(window, {});
