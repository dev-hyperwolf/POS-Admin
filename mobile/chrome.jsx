// ── Mobile app chrome — header, bottom nav, toast, overlays ─────────────────
const useP = window.useP,useTheme = window.useTheme;

// iOS-style switch used inside the duty card
function DutySwitch({ on }) {
  return (
    <span style={{ width: 52, height: 30, borderRadius: 99, background: on ? '#34C759' : '#E8675B', padding: 3, display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .2s', flex: '0 0 auto' }}>
      <span style={{ width: 24, height: 24, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </span>);
}

// On/Off duty status card — elevated, with a live status dot + shift line
window.DutyToggle = function DutyToggle() {
  const P = useP();const M = window.useM();
  const on = M.s.duty;
  const toggle = () => { if (on) {window.M.setDuty(false);} else {window.M.openSheet('onduty');} };
  const dot = on ? P.good : '#E8675B';
  const left = window.MD.TASKS.filter((t) => !window.M.isDone(t.id)).length;
  const sub = on ? `On since ${window.MD.SHIFT.startedAt} · ${left} stop${left === 1 ? '' : 's'} left` : 'Tap to start your shift';
  return (
    <button data-tour="duty" onClick={toggle} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: on ? P.goodSoft : P.surface, border: `1px solid ${on ? P.good + '55' : P.hairline2}`, borderRadius: P.r16, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', transition: 'all .2s' }}>
      <span style={{ position: 'relative', width: 12, height: 12, flex: '0 0 auto' }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: dot, boxShadow: on ? `0 0 0 4px ${P.good}33, 0 0 12px ${P.good}` : 'none' }} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16.5, fontWeight: 800, color: P.ink, lineHeight: 1.15 }}>{on ? 'On Duty' : 'Off Duty'}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: on ? P.good : P.inkMute, fontFamily: P.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      <DutySwitch on={on} />
    </button>);

};

// Round header icon button with optional numeric badge
function HdrIcon({ icon, badge, onClick }) {
  const P = useP();
  return (
    <button onClick={onClick} style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2 }}>
      <Icon name={icon} size={23} stroke={1.7} />
      {badge != null && <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, padding: '0 4px', background: P.bad, color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, border: `2px solid ${P.bg}` }}>{badge}</span>}
    </button>);

}

// App header — adapts by tab
window.AppHeader = function AppHeader({ tab }) {
  const P = useP();const M = window.useM();
  const unread = M.s.notifRead ? null : window.MD.NOTIFS.filter((n) => n.unread).length;
  const titles = { activity: 'Activity', discrepancy: 'Discrepancy', profile: 'Profile' };
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = window.MD.DRIVER.name.split(' ')[0];
  if (tab === 'home') return (
    <div style={{ padding: '2px 16px 10px', display: 'flex', flexDirection: 'column', gap: 11, flex: '0 0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{greet}</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, lineHeight: 1.1, marginTop: 2 }}>{firstName}</div>
        </div>
        <HdrIcon icon="bell" badge={unread} onClick={() => window.M.push('notifs')} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><DutyToggle /></div>
    </div>);
  return (
    <div style={{ padding: '6px 16px 8px', display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
      <div style={{ width: 8 }} /><div style={{ flex: 1, textAlign: 'center', fontSize: 21, fontWeight: 700, color: P.ink }}>{titles[tab]}</div><HdrIcon icon="bell" badge={unread} onClick={() => window.M.push('notifs')} />
    </div>);

};

// Break banner (Home) — yellow outlined countdown
window.BreakBanner = function BreakBanner() {
  const P = useP();const M = window.useM();
  const [, tick] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {const t = setInterval(tick, 1000);return () => clearInterval(t);}, []);
  const b = M.s.breakActive;
  if (!b) return null;
  const left = Math.max(0, b.endsAt - Date.now());
  React.useEffect(() => {if (left <= 0) window.M.endBreak();}, [left <= 0]);
  if (left <= 0) return null;
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor(left % 60000 / 1000)).padStart(2, '0');
  return (
    <div onClick={() => window.M.push('breaktimer')} style={{ margin: '2px 16px 10px', padding: '12px 15px', border: `1px solid ${P.indica}55`, borderRadius: P.r14, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', background: P.indica + (P.mode === 'dark' ? '26' : '14') }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: P.indica, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="clock" size={17} color="#fff" stroke={2.2} /></span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Your {b.label.split('(')[0].trim()} break ends in <span style={{ fontFamily: P.fontMono, color: P.indica }}>{mm}:{ss}</span></span>
      <Icon name="chevron-right" size={16} stroke={2} color={P.indica} />
    </div>);

};

// Bottom tab bar
window.BottomNav = function BottomNav() {
  const P = useP();const M = window.useM();
  const tab = M.s.tab;
  const items = [['home', 'Home', 'home'], ['activity', 'Activity', 'chart'], ['help', 'Help', 'help', true], ['discrepancy', 'Discrepancy', 'package'], ['profile', 'Profile', 'user']];
  const topName = M.s.stack.length ? M.s.stack[M.s.stack.length - 1].name : null;
  return (
    <div data-tour="nav" style={{ flex: '0 0 auto', display: 'flex', padding: '10px 4px 26px', borderTop: `1px solid ${P.hairline}`, background: P.bg, gap: 2 }}>
      {items.map(([id, label, icon, isPush]) => {const a = isPush ? topName === 'help' : tab === id && !topName;return (
          <button key={id} onClick={() => isPush ? window.M.push('help') : window.M.go(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', color: a ? P.ink : P.inkMute }}>
          <Icon name={icon} size={22} stroke={a ? 2.1 : 1.7} />
          <span style={{ fontSize: 11.5, fontWeight: a ? 700 : 500 }}>{label}</span>
        </button>);})}
    </div>);

};

// Toast
window.Toast = function Toast() {
  const P = useP();const M = window.useM();
  const t = M.s.toast;
  if (!t) return null;
  const c = t.kind === 'bad' ? P.bad : t.kind === 'warn' ? P.warn : P.good;
  return (
    <div style={{ position: 'absolute', top: 60, left: 16, right: 16, zIndex: 200, padding: '12px 15px', background: P.surface, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c}`, borderRadius: P.r12, boxShadow: P.shadowLg, display: 'flex', alignItems: 'center', gap: 10, animation: 'fade .2s ease' }}>
      <Icon name={t.kind === 'bad' ? 'info' : 'check-circle'} size={18} color={c} stroke={2} />
      <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{t.msg}</span>
    </div>);

};

// ── Guest status: New / VIP — prominent, shared across every screen ─────────
window.VisitBadge = function VisitBadge({ visit, size = 'sm' }) {
  const P = useP();const v = window.MD.VISIT[visit];
  if (!v || !v.short) return null;
  const c = v.color;
  const S = { sm: { fs: 10.5, pad: '2px 9px 2px 7px', ic: 11 }, md: { fs: 12, pad: '4px 11px 4px 9px', ic: 13 }, lg: { fs: 13, pad: '5px 13px 5px 11px', ic: 15 } }[size];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: S.pad, borderRadius: 99, background: c, color: '#1A1400', fontSize: S.fs, fontWeight: 800, letterSpacing: '.02em', whiteSpace: 'nowrap' }}><Icon name={v.icon} size={S.ic} stroke={2.4} color="#1A1400" />{size === 'sm' ? v.short : v.label}</span>;
};

// Contextual guidance banner for first-time / VIP guests
window.VisitBanner = function VisitBanner({ visit }) {
  const P = useP();const v = window.MD.VISIT[visit];
  if (!v || !v.short) return null;
  const c = v.color;
  const msg = visit === 'vip' ?
  'VIP guest — roll out the red carpet. Deliver standout service, share what’s new, and toss in some stickers or swag.' :
  'First-time guest — verify their ID, walk them through the menu, and explain the rewards program.';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: c + (P.mode === 'dark' ? '1f' : '18'), border: `1.5px solid ${c}`, borderRadius: P.r14 }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: c, color: '#1A1400', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={v.icon} size={21} stroke={2.2} color="#1A1400" /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: P.ink }}>{v.label}</div>
        <div style={{ fontSize: 12.5, color: P.ink2, marginTop: 2, lineHeight: 1.4 }}>{msg}</div>
      </div>
    </div>);

};

Object.assign(window, { HdrIcon });