// ── Temporary screen stubs (overridden by real screen files loaded after) ───
(function () {
  const useP = window.useP;
  const Stub = (label) => function () {
    const P = useP();
    return <div style={{ padding: '80px 24px', textAlign: 'center', color: P.inkMute }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{label}</div>
      <div style={{ fontSize: 12.5, marginTop: 6 }}>Coming up</div>
    </div>;
  };
  const names = ['HomeScreen', 'ActivityScreen', 'DiscrepancyScreen', 'ProfileScreen', 'TaskScreen', 'ShopScreen', 'CheckoutScreen', 'CompleteScreen', 'NotifsScreen', 'HelpScreen', 'BreakTimerScreen', 'OrderHistoryScreen', 'TaskHistoryScreen', 'OnDutySheet', 'FiltersSheet', 'DrawerPromptSheet'];
  names.forEach((n) => { if (!window[n]) window[n] = Stub(n); });
})();
