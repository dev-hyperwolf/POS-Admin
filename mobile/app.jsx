// ── Mobile app root + router ────────────────────────────────────────────────
const useP = window.useP,useTheme = window.useTheme;
const SB_PAD = 52; // clear the iOS status bar / dynamic island

// Shared top bar for pushed (full-screen) views — back chevron + title
window.MTopBar = function MTopBar({ title, onBack, right, sub }) {
  const P = useP();
  return (
    <div style={{ flex: '0 0 auto', padding: `${SB_PAD}px 10px 10px`, display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${P.hairline}`, background: P.bg }}>
      <button onClick={onBack || (() => window.M.pop())} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink }}><Icon name="chevron-left" size={26} stroke={2.2} /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, textAlign: right ? 'left' : 'center', lineHeight: 1.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, textAlign: right ? 'left' : 'center' }}>{sub}</div>}
      </div>
      <div style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>);

};

/* == WHERE A FAILURE STOPS IN THE DRIVER APP =================================
 *
 * On 2026-08-27 one dereference of `undefined` on a render path took the whole
 * POS down -- nav, queue, every screen -- because this estate had no error
 * boundaries at all. The same exposure existed here, and here it is worse: this
 * app is held by a driver standing at a customer's door.
 *
 * So the decision is made PER SURFACE, and it is written down below rather than
 * left to whoever edits a screen next:
 *
 *   REFUSE  (CriticalBoundary) -- the stop, the appointment, adding to an
 *           order, checkout, completing a handoff, the tip bank, the van pack
 *           gate, end-of-shift reconciliation, and the two cash sheets.
 *           Nothing of the subtree renders. A driver must never be able to act
 *           on half of one of these: a stop card missing its ID-check row, a
 *           change calculation missing its "not enough tip cash" warning, or a
 *           pack list missing an order still reads as a complete screen, and
 *           the driver hands over product or money against it.
 *
 *   CONTAIN (ScreenBoundary) -- the tab frames, history, notifications, help,
 *           the break timer and the non-money sheets. Nothing that survives a
 *           failure there can be acted on wrongly, and the tab bar below stays
 *           alive so the driver can get somewhere that works.
 *
 * Omission is safe by design: an unguarded throw propagates to the nearest
 * ScreenBoundary above, which is the app frame, so a surface nobody classified
 * behaves like a refusal rather than like a contained one.
 *
 * !! THIS CATCHES RENDER AND LIFECYCLE ERRORS ONLY. Not event handlers, not
 * async work, not the plain-JS chrome. A driver tapping "Complete delivery" and
 * hitting a throw inside that onClick is NOT protected by anything here. The
 * driver app's actual write path -- packing, tipping, completing -- is mostly
 * handlers, and guarding those is a separate mechanism that does not exist yet.
 * Do not read a green boundary as cover for it.
 * ========================================================================== */

/* If Hyperwolf Driver App.html ever stops loading shared/error-boundary.jsx, a
 * bare <ScreenFrame> would be an undefined component -- which white-screens the
 * app, the exact failure this wiring exists to end. Fall back to a pass-through
 * (the status quo, no worse) and SAY SO. Note the pass-through degrades REFUSE
 * to "no boundary", which still renders nothing on a throw -- it degrades
 * toward showing less, never toward showing a usable-looking screen.
 * Module scope, not inside a component: a component defined during render is a
 * new type every render and React remounts the whole subtree. */
if (!window.ScreenBoundary || !window.CriticalBoundary) {
  try {console.error('[HW boundary] Hyperwolf Driver App.html did not load shared/error-boundary.jsx — ' +
    'the driver app is running with NO error boundaries. One render error will take the whole app down.');} catch (e) {}
}
const ScreenFrame = window.ScreenBoundary || function ScreenFrame(p) {return p.children;};
const CriticalFrame = window.CriticalBoundary || function CriticalFrame(p) {return p.children;};

/* Surfaces that REFUSE. `name` is what broke, `flow` is what has been stopped,
 * both in the words a driver would use -- the panel prints them, so a generic
 * name is a bug. */
const M_REFUSE_TAB = {
  discrepancy: { name: 'End-of-shift reconciliation', flow: 'This reconciliation' } };

const M_REFUSE_PUSH = {
  task: { name: 'This stop', flow: 'This delivery' },
  appointment: { name: 'This appointment', flow: 'This appointment' },
  shop: { name: 'Adding to this order', flow: 'This order change' },
  checkout: { name: 'Checkout', flow: 'This sale' },
  complete: { name: 'Completing this stop', flow: 'This handoff' },
  tips: { name: 'Your tip bank', flow: 'Your tip bank' },
  packing: { name: 'Van packing', flow: 'Packing this van' } };

const M_REFUSE_SHEET = {
  addtip: { name: 'Log a cash tip', flow: 'This tip' },
  makechange: { name: 'Make change', flow: 'This change' } };

/* Names for the surfaces that CONTAIN. An unlisted key falls back to its own
 * id -- still named, never "Something went wrong". */
const M_LABEL = {
  home: 'Today', activity: 'Activity', profile: 'Your profile',
  notifs: 'Notifications', help: 'Help', breaktimer: 'The break timer',
  orderhistory: 'Order history', taskhistory: 'Task history',
  onduty: 'Going on duty', filters: 'Filters', textcustomer: 'Texting the customer',
  editphone: 'Editing the phone number', vehicles: 'Vehicles', editvehicle: 'Editing a vehicle',
  editavatar: 'Editing your photo', moretime: 'Asking for more time',
  msgtemplates: 'Message templates', editmsg: 'Editing a message' };

/* One place that turns a surface id into the boundary it was classified with.
 * `key` matters: without it React reuses one boundary instance across a
 * navigation, so its error state survives and the driver is stranded on a dead
 * frame after moving to a screen that works. */
function mGuard(refuseTable, key, node, onReset, resetLabel) {
  const r = refuseTable[key];
  if (r) return <CriticalFrame key={key} name={r.name} flow={r.flow}>{node}</CriticalFrame>;
  return <ScreenFrame key={key} name={M_LABEL[key] || key} onReset={onReset} resetLabel={resetLabel}>{node}</ScreenFrame>;
}

const TAB_SCREENS = {
  home: () => <window.HomeScreen />,
  activity: () => <window.ActivityScreen />,
  discrepancy: () => <window.DiscrepancyScreen />,
  profile: () => <window.ProfileScreen />
};
const PUSH_SCREENS = {
  task: (p) => <window.TaskScreen {...p} />,
  appointment: (p) => <window.AppointmentScreen {...p} />,
  shop: (p) => <window.ShopScreen {...p} />,
  checkout: (p) => <window.CheckoutScreen {...p} />,
  complete: (p) => <window.CompleteScreen {...p} />,
  notifs: (p) => <window.NotifsScreen {...p} />,
  help: (p) => <window.HelpScreen {...p} />,
  tips: (p) => <window.TipsScreen {...p} />,
  breaktimer: (p) => <window.BreakTimerScreen {...p} />,
  orderhistory: (p) => <window.OrderHistoryScreen {...p} />,
  taskhistory: (p) => <window.TaskHistoryScreen {...p} />,
  packing: (p) => <window.PackingScreen {...p} />
};
const SHEETS = {
  onduty: (p) => <window.OnDutySheet {...p} />,
  filters: (p) => <window.FiltersSheet {...p} />,
  tips: (p) => <window.TipsSheetUnused {...p} />,
  addtip: (p) => <window.AddTipSheet {...p} />,
  makechange: (p) => <window.MakeChangeSheet {...p} />,
  textcustomer: (p) => <window.TextCustomerSheet {...p} />,
  editphone: (p) => <window.EditPhoneSheet {...p} />,
  vehicles: (p) => <window.VehiclesSheet {...p} />,
  editvehicle: (p) => <window.EditVehicleSheet {...p} />,
  editavatar: (p) => <window.EditAvatarSheet {...p} />,
  moretime: (p) => <window.MoreTimeSheet {...p} />,
  msgtemplates: (p) => <window.MsgTemplatesSheet {...p} />,
  editmsg: (p) => <window.EditMsgSheet {...p} />
};

function AppInner() {
  const P = useP();const M = window.useM();
  const top = M.s.stack[M.s.stack.length - 1];
  return (
    <div data-approot style={{ height: '100%', display: 'flex', flexDirection: 'column', background: P.bg, position: 'relative', overflow: 'hidden' }}>
      {top ?
      /* A pushed screen IS the whole frame -- there is no tab bar behind it --
         so a contained one has to hand back its own way out. */
      mGuard(M_REFUSE_PUSH, top.name, (PUSH_SCREENS[top.name] || (() => null))(top.props),
      () => window.M.pop(), 'Back to today') :
      <>
            <div style={{ height: SB_PAD, flex: '0 0 auto' }} />
            <ScreenFrame name="The header"><window.AppHeader tab={M.s.tab} /></ScreenFrame>
            {/* No onReset on a tab: the tab bar below is still alive and IS the
                way back. A refusing tab escalates past these siblings to the
                app frame, which takes the header and the tab bar with it. */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {mGuard(M_REFUSE_TAB, TAB_SCREENS[M.s.tab] ? M.s.tab : 'home',
        (TAB_SCREENS[M.s.tab] || TAB_SCREENS.home)())}
            </div>
            <ScreenFrame name="The tab bar"><window.BottomNav /></ScreenFrame>
          </>}
      {M.s.sheet && mGuard(M_REFUSE_SHEET, M.s.sheet.name,
      (SHEETS[M.s.sheet.name] || (() => null))(M.s.sheet.props),
      () => window.M.closeSheet(), 'Close')}
      <ScreenFrame name="The toast"><window.Toast /></ScreenFrame>
      <ScreenFrame name="The tour overlay"><window.TourOverlay /></ScreenFrame>
    </div>);

}

function Root() {
  const { mode } = useTheme();
  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', background: mode === 'dark' ? '#050505' : '#c9c7c0', overflow: 'hidden' }}>
      <ScreenFrame name="The navigation rail"><window.HWRail active="driver" /></ScreenFrame>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px 0' }}>
        {/* Two frames on purpose. The OUTER one catches the phone chrome itself
            (mobile/ios-frame.jsx) -- without it a throw there is unguarded and
            white-screens the page. The INNER one is the escalation target every
            refusing surface inside the app hands up to, so a refusal blanks the
            phone screen but leaves the device frame and the rail standing. */}
        <ScreenFrame name="The phone frame">
          <IOSDevice dark={mode === 'dark'} width={402} height={874}>
            <ScreenFrame name="The driver app">
              <AppInner />
            </ScreenFrame>
          </IOSDevice>
        </ScreenFrame>
      </div>
    </div>);

}

function MobileThemeProvider({ children }) {
  const [mode, setMode] = React.useState(() => {try {return localStorage.getItem('hw-m-theme') || 'dark';} catch {return 'dark';}});
  React.useEffect(() => {
    try {localStorage.setItem('hw-m-theme', mode);} catch {}
    const P = window.THEMES[mode];
    document.documentElement.style.background = mode === 'dark' ? '#050505' : '#c9c7c0';
    document.body.style.colorScheme = mode;
  }, [mode]);
  const toggle = React.useCallback(() => setMode((m) => m === 'light' ? 'dark' : 'light'), []);
  const value = React.useMemo(() => ({ mode, P: window.THEMES[mode], setMode, toggle }), [mode]);
  return <window.ThemeCtx.Provider value={value}>{children}</window.ThemeCtx.Provider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <MobileThemeProvider><Root /></MobileThemeProvider>
);