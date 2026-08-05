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
      (PUSH_SCREENS[top.name] || (() => null))(top.props) :
      <>
            <div style={{ height: SB_PAD, flex: '0 0 auto' }} />
            <window.AppHeader tab={M.s.tab} />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{(TAB_SCREENS[M.s.tab] || TAB_SCREENS.home)()}</div>
            <window.BottomNav />
          </>}
      {M.s.sheet && (SHEETS[M.s.sheet.name] || (() => null))(M.s.sheet.props)}
      <window.Toast />
      <window.TourOverlay />
    </div>);

}

function Root() {
  const { mode } = useTheme();
  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', background: mode === 'dark' ? '#050505' : '#c9c7c0', overflow: 'hidden' }}>
      <window.HWRail active="driver" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '24px 0' }}>
        <IOSDevice dark={mode === 'dark'} width={402} height={874}>
          <AppInner />
        </IOSDevice>
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