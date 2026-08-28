// ── Canvas mount + display options (theme / density / drawer model) ─────────
const useP = window.useP,useTheme = window.useTheme;
const TweakCtx = window.TweakCtx;
const DRAWER_MODEL_INFO = window.DRAWER_MODEL_INFO;

function OptionsPanel() {
  const P = useP();const { mode, toggle } = useTheme();
  const tk = React.useContext(TweakCtx);
  React.useEffect(() => {try {const s = localStorage.getItem('hw_term_theme');if (s && s !== mode) toggle();} catch (e) {}}, []);
  const toggleTheme = () => {const next = mode === 'light' ? 'dark' : 'light';toggle();try {localStorage.setItem('hw_term_theme', next);} catch (e) {}};
  const Group = ({ label, hint, children }) => <div style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>{hint && <span style={{ fontSize: 10, color: P.inkFaint }}>{hint}</span>}</div>
    {children}
  </div>;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap', padding: '14px 22px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface, fontFamily: P.fontSans }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: P.ink, marginRight: 'auto' }}><Icon name="sliders" size={16} />Display options<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 500, color: P.inkMute }}><Icon name="check-circle" size={12} color={P.good} />saved to this device</span></span>
      <Group label="Cash drawer model" hint="how a shift session tracks the drawer"><Seg value={tk.drawerModel} onChange={(v) => tk.setTweak('drawerModel', v)} options={[{ value: 'session', label: DRAWER_MODEL_INFO.session.name }, { value: 'merged', label: DRAWER_MODEL_INFO.merged.name }, { value: 'device', label: DRAWER_MODEL_INFO.device.name }]} /></Group>
      {/* The one theme control used in production — same icon button as every other app. */}
      <button onClick={toggleTheme} title="Toggle theme" style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: P.r10, color: P.ink2, cursor: 'pointer' }}><Icon name={mode === 'dark' ? 'sun' : 'moon'} size={18} stroke={1.9} /></button>
    </div>);
}

/* == WHERE A FAILURE STOPS IN the terminal console ==
 * Terminal configuration. Everything CONTAINS: these are configuration and version
 * read-outs, the boundaries sit at panel level where each panel is a visually
 * self-contained card, and nothing that survives one failing is a figure a
 * person acts on.
 * !! RENDER AND LIFECYCLE ERRORS ONLY -- not event handlers, not async work.
 * The buttons that actually write are unguarded by anything here. */
if (!window.ScreenBoundary || !window.CriticalBoundary) {
  try {console.error('[HW boundary] POS Terminal Configuration.html did not load shared/error-boundary.jsx — ' +
    'the terminal console is running with NO error boundaries.');} catch (e) {}
}
const TermFrame = window.ScreenBoundary || function TermFrame(p) {return p.children;};

function TerminalCanvas() {
  const P = useP();
  // Comfortable is the shipped density — the toggle is gone from the UI.
  const density = 'comfortable';
  const [drawerModel, setDrawerModel] = React.useState(() => {try {return localStorage.getItem('hw_term_drawer') || 'session';} catch (e) {return 'session';}});
  const setTweak = (k, v) => {
    if (k === 'drawerModel') {setDrawerModel(v);try {localStorage.setItem('hw_term_drawer', v);} catch (e) {}}
  };
  const value = React.useMemo(() => ({ density, drawerModel, setTweak }), [drawerModel]);
  return (
    <TweakCtx.Provider value={value}>
      <div style={{ display: 'flex', height: '100vh', background: P.bg, overflow: 'hidden' }}>
        <TermFrame name="The navigation rail"><window.HWRail active="terminals" /></TermFrame>
        <div style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden', background: P.bg }}>
          <TermFrame name="Display options"><OptionsPanel /></TermFrame>
          <TermFrame name="Versions by location"><VersionByLocation /></TermFrame>
        </div>
      </div>
    </TweakCtx.Provider>);
}

/* Backstop: catches TerminalCanvas's own body and its context provider. */
function Root() {return <ThemeProvider><TermFrame name="Terminal configuration"><TerminalCanvas /></TermFrame></ThemeProvider>;}
ReactDOM.createRoot(document.getElementById('root')).render(<Root />);