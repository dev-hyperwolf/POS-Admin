// ── Misc screens & sheets — on-duty prompt, filters, drawer prompt, break,
//    notifications, help ─────────────────────────────────────────────────────
const useP = window.useP;
const SB = 52;

// Generic bottom sheet shell
function Sheet({ title, onClose, children, footer }) {
  const P = useP();
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 150, background: P.scrim, display: 'flex', alignItems: 'flex-end', animation: 'fade .15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: P.surface, borderRadius: `${P.r24}px ${P.r24}px 0 0`, boxShadow: P.shadowLg, maxHeight: '82%', display: 'flex', flexDirection: 'column', animation: 'sheetUp .24s cubic-bezier(.2,.8,.2,1)', paddingBottom: 24 }}>
        {title !== undefined && <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px 12px', flex: '0 0 auto' }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: P.ink }}>{title}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={17} stroke={2.2} /></button>
        </div>}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px 0', flex: '0 0 auto' }}>{footer}</div>}
      </div>
    </div>);

}

// Center confirm dialog
function Dialog({ children, actions }) {
  const P = useP();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 160, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, animation: 'fade .15s ease' }}>
      <div style={{ width: '100%', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, padding: 22, border: `1px solid ${P.hairline2}` }}>
        {children}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>{actions}</div>
      </div>
    </div>);

}

// On-duty prompt
window.OnDutySheet = function OnDutySheet() {
  const P = useP();
  return (
    <Dialog actions={<>
      <PBtn variant="accent" size="xl" full onClick={() => {window.M.setDuty(true);window.M.closeSheet();window.M.flash('You are now On Duty');}}>On Duty</PBtn>
      <PBtn variant="secondary" size="xl" full onClick={() => window.M.closeSheet()}>Cancel</PBtn>
    </>}>
      <div style={{ fontSize: 18, fontWeight: 700, color: P.ink, lineHeight: 1.35 }}>To view today's tasks, please go on duty.</div>
    </Dialog>);

};

// Cash tips sheet, add-tip, make-change, and SMS templates live in
// screen-tips.jsx / screen-msg.jsx (loaded after this file).

// Filters sheet — Status + Priority chips
window.FiltersSheet = function FiltersSheet() {
  const P = useP();
  const [status, setStatus] = React.useState([]);
  const [tags, setTags] = React.useState([]);
  const chip = (label, active, onClick) =>
  <button key={label} onClick={onClick} style={{ padding: '9px 16px', borderRadius: 99, border: `1.5px solid ${active ? P.accentBorder : P.hairline3}`, background: active ? P.accentSoft : 'transparent', color: active ? P.mode === 'dark' ? P.accent : '#7A5A00' : P.ink2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>;

  const toggle = (v, set, arr) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <Sheet title="Filters" onClose={() => window.M.closeSheet()} footer={<div style={{ display: 'flex', gap: 10 }}>
      <PBtn variant="accent" size="xl" full onClick={() => {window.M.closeSheet();window.M.flash('Filters applied');}}>Apply</PBtn>
      <PBtn variant="secondary" size="xl" full onClick={() => {setStatus([]);setTags([]);}}>Reset</PBtn>
    </div>}>
      <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, margin: '4px 0 12px' }}>Status</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{['Not Started', 'In Progress', 'Completed', 'Cancelled'].map((s) => chip(s, status.includes(s), () => toggle(s, setStatus, status)))}</div>
      <div style={{ height: 1, background: P.hairline2, margin: '18px 0' }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, marginBottom: 12 }}>Priority</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 8 }}>{['Critical', 'High', 'Medium', 'Low'].map((s) => chip(s, tags.includes(s), () => toggle(s, setTags, tags)))}</div>
    </Sheet>);

};

// Break countdown timer (full screen) — 3 design options; no end-early.
window.BreakTimerScreen = function BreakTimerScreen() {
  const P = useP();const M = window.useM();
  const [, tick] = React.useReducer((x) => x + 1, 0);
  const [variant, setVariant] = React.useState('focus');
  React.useEffect(() => {const t = setInterval(tick, 1000);return () => clearInterval(t);}, []);
  const b = M.s.breakActive;
  if (!b) {return <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}><window.MTopBar title="Break" /><div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute }}>No active break</div></div>;}
  const left = Math.max(0, b.endsAt - Date.now());
  const total = b.mins * 60000;
  const frac = total ? left / total : 0;
  const elapsed = 1 - frac;
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor(left % 60000 / 1000)).padStart(2, '0');
  const endTime = new Date(b.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const name = b.label.replace(/\s*\(.*\)/, '');
  const nextStop = window.MD.TASKS.find((t) => !M.isDone(t.id));
  const almostDone = left < 60000;

  const closeBtn =
  <button onClick={() => window.M.pop()} title="Back to route" style={{ width: 40, height: 40, borderRadius: 99, background: P.surface3, border: 'none', cursor: 'pointer', color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-down" size={22} stroke={2.2} /></button>;

  // ── Variant A: radial ring ──
  const Ring = () => {
    const R = 120,C = 2 * Math.PI * R;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
        <div style={{ position: 'relative', width: 264, height: 264 }}>
          <svg width="264" height="264" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="132" cy="132" r={R} fill="none" stroke={P.surface3} strokeWidth="14" />
            <circle cx="132" cy="132" r={R} fill="none" stroke={almostDone ? P.warn : P.accent} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{mm}:{ss}</div>
            <div style={{ fontSize: 12, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.08em', marginTop: 6 }}>REMAINING</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: P.ink }}>{name}</div>
          <div style={{ fontSize: 14.5, color: P.inkDim, marginTop: 8 }}>Ends at <b style={{ color: P.ink2, fontFamily: P.fontMono }}>{endTime}</b></div>
        </div>
      </div>);
  };

  // ── Variant B: linear bar + schedule ──
  const Bar = () =>
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px', gap: 30 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: almostDone ? P.warn : P.accent, fontFamily: P.fontMono }}>{name}</div>
        <div style={{ fontSize: 80, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1.05, letterSpacing: '-.02em', marginTop: 6 }}>{mm}:{ss}</div>
        <div style={{ fontSize: 14.5, color: P.inkDim }}>break time remaining</div>
      </div>
      <div>
        <div style={{ height: 14, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(2, elapsed * 100)}%`, background: almostDone ? P.warn : P.accent, borderRadius: 99, transition: 'width 1s linear' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          {[['Started', new Date(b.endsAt - total).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })], ['Ends', endTime]].map(([k, v]) => <div key={k} style={{ textAlign: k === 'Ends' ? 'right' : 'left' }}><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase' }}>{k}</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, marginTop: 2 }}>{v}</div></div>)}
        </div>
      </div>
    </div>;

  // ── Variant C: focus / next-up ──
  const Focus = () =>
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', margin: '0 20px 8px', borderRadius: P.r24, overflow: 'hidden', padding: '30px 26px', justifyContent: 'space-between' }}>
      {/* calming animated background (drop in a relaxing clip later) */}
      <div style={{ position: 'absolute', inset: 0, background: almostDone ? `linear-gradient(160deg, ${P.warnSoft}, ${P.surface})` : 'linear-gradient(160deg, #6B4FBF33, #2E7CF622, #21A89B22)', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 99, background: '#6B4FBF', filter: 'blur(60px)', opacity: 0.35, top: -40, left: -30, zIndex: 0, animation: 'hwfloat 9s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: 99, background: '#21A89B', filter: 'blur(60px)', opacity: 0.3, bottom: 20, right: -40, zIndex: 0, animation: 'hwfloat 11s ease-in-out infinite reverse' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, background: P.mode === 'dark' ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.6)' }}><Icon name="clock" size={16} stroke={2.2} color={almostDone ? P.warn : P.ink} /><span style={{ fontSize: 13, fontWeight: 800, color: P.ink }}>{name}</span></div>
      </div>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 88, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, lineHeight: 1, letterSpacing: '-.02em', textShadow: P.mode === 'dark' ? '0 2px 30px rgba(0,0,0,.4)' : 'none' }}>{mm}:{ss}</div>
        <div style={{ fontSize: 15, color: P.ink2, marginTop: 8, fontWeight: 600 }}>{almostDone ? 'Wrap up — break ending soon' : `Breathe. Back on the road at ${endTime}`}</div>
      </div>
      {nextStop ? <div style={{ background: P.surface, borderRadius: P.r16, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: P.ink, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="pin" size={18} stroke={2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase' }}>Next up</div><div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextStop.name} · {nextStop.eta}</div></div>
      </div> : <div />}
    </div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg }}>
      <div style={{ height: SB, flex: '0 0 auto' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px 10px' }}>
        <Seg size="sm" value={variant} onChange={setVariant} options={[{ value: 'ring', label: 'Ring' }, { value: 'bar', label: 'Bar' }, { value: 'focus', label: 'Focus' }]} />
        <div style={{ flex: 1 }} />{closeBtn}
      </div>
      {variant === 'ring' ? <Ring /> : variant === 'bar' ? <Bar /> : <Focus />}
      <div style={{ padding: '10px 24px 40px', flex: '0 0 auto' }}>
        <PBtn variant="secondary" size="xl" full icon="route" onClick={() => window.M.pop()}>Back to route</PBtn>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: P.inkMute, marginTop: 10 }}>Your break keeps running in the background</div>
      </div>
    </div>);

};

// Notifications — grouped, dismissible
window.NotifsScreen = function NotifsScreen() {
  const P = useP();const M = window.useM();
  React.useEffect(() => {window.M.markNotifRead();}, []);
  const tone = (t) => ({ accent: [P.accentSoft, P.mode === 'dark' ? P.accent : '#7A5A00'], info: [P.infoSoft, P.info], warn: [P.warnSoft, P.warn], good: [P.goodSoft, P.good], neutral: [P.neutralSoft, P.ink2] })[t] || [P.surface3, P.ink2];
  const visible = window.MD.NOTIFS.filter((n) => !M.s.dismissed.includes(n.id));
  const groups = [];
  visible.forEach((n) => {let g = groups.find((x) => x.name === n.group);if (!g) {g = { name: n.group, items: [] };groups.push(g);}g.items.push(n);});
  const anyDismissed = M.s.dismissed.length > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.MTopBar title="Notifications" right={visible.length > 0 ? <button onClick={() => {window.MD.NOTIFS.forEach((n) => window.M.dismissNotif(n.id));window.M.flash('All cleared');}} style={{ padding: '7px 12px', background: 'transparent', border: 'none', color: P.info, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear all</button> : null} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 40px' }}>
        {visible.length === 0 ?
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', textAlign: 'center', padding: '0 30px' }}>
            <span style={{ width: 78, height: 78, borderRadius: 22, background: P.surface2, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}><Icon name="bell" size={36} stroke={1.5} color={P.inkMute} /></span>
            <div style={{ fontSize: 18, fontWeight: 800, color: P.ink }}>You're all caught up</div>
            <div style={{ fontSize: 13.5, color: P.inkDim, marginTop: 8 }}>New orders, route changes and reminders will show here.</div>
            {anyDismissed && <PBtn variant="secondary" size="md" icon="refresh" onClick={() => window.M.clearDismissed()} style={{ marginTop: 20 }}>Restore cleared</PBtn>}
          </div> :
        groups.map((g) =>
        <div key={g.name} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 9px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{g.name}</span>
              <div style={{ flex: 1, height: 1, background: P.hairline }} />
              <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{g.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {g.items.map((n) => {const [bg, fg] = tone(n.tone);return (
                <div key={n.id} style={{ display: 'flex', gap: 12, padding: '13px 14px', background: n.unread ? P.surface : P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, position: 'relative' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={n.icon} size={19} stroke={1.9} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>{n.title}</span>{n.unread && <span style={{ width: 7, height: 7, borderRadius: 99, background: P.accent }} />}<div style={{ flex: 1 }} /><span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{n.time}</span></div>
                    <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 3, lineHeight: 1.4, paddingRight: 22 }}>{n.body}</div>
                  </div>
                  <button onClick={() => window.M.dismissNotif(n.id)} title="Dismiss" style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 99, background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} stroke={2.2} /></button>
                </div>);})}
            </div>
          </div>
        )}
      </div>
    </div>);

};

// Help / chat
window.HelpScreen = function HelpScreen() {
  const P = useP();
  const [msg, setMsg] = React.useState('');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.MTopBar title="Help" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 10, alignSelf: 'center', marginBottom: 30 }}>
          {['#A78BE0', '#fff'].map((c, i) => <div key={i} style={{ width: 56, height: 44, borderRadius: 12, background: c, position: 'relative', marginTop: i * 8 }}><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: 6, height: 6, borderRadius: 99, background: i ? '#6A99EC' : '#fff' }} />)}</div></div>)}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: P.accent }}>Hi there,</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: P.ink, marginBottom: 12 }}>How can we help?</div>
        <div style={{ fontSize: 14.5, color: P.inkDim, lineHeight: 1.5 }}>Let us know how we can assist. Please provide a brief description of your issue or request.</div>
      </div>
      <div style={{ padding: '12px 16px 34px', flex: '0 0 auto' }}>
        <button onClick={() => window.M.flash("We'll be back online tomorrow", 'warn')} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '16px 20px', background: P.accent, border: 'none', borderRadius: P.r16, cursor: 'pointer', textAlign: 'left' }}>
          <div><div style={{ fontSize: 17, fontWeight: 800, color: P.accentInk }}>Chat with us</div><div style={{ fontSize: 12.5, color: 'rgba(26,20,0,.7)', marginTop: 2 }}>We'll be back online tomorrow</div></div>
          <div style={{ flex: 1 }} /><Icon name="arrow-right" size={22} color={P.accentInk} stroke={2.2} />
        </button>
      </div>
    </div>);

};

Object.assign(window, { Sheet, Dialog });