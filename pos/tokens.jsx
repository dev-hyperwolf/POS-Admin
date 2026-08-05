// ── Hyperwolf POS — theming ────────────────────────────────────────────────
// Editorial operator aesthetic. Two fully-designed modes (light + dark).
// Hyperwolf yellow (#FFD100) is the ONLY brand accent, used sparingly.
// Inter for UI, JetBrains Mono for all numerics/metadata.

const LIGHT = {
  mode:'light',
  // Surfaces (warm paper)
  bg:        '#F4F2EC',
  bg2:       '#EEEBE2',
  surface:   '#FFFFFF',
  surface2:  '#FAF9F5',
  surface3:  '#F1EFE9',
  rail:      '#13130F',          // near-black warm nav rail
  railInk:   'rgba(255,255,255,.72)',
  railBright:'#FFFFFF',
  railHover: 'rgba(255,255,255,.06)',
  railActive:'rgba(255,209,0,.14)',
  railHair:  'rgba(255,255,255,.08)',
  scrim:     'rgba(20,18,12,.42)',

  // Ink
  ink:       '#0F0F0C',
  ink2:      '#2A2A26',
  inkDim:    'rgba(15,15,12,.60)',
  inkMute:   'rgba(15,15,12,.42)',
  inkFaint:  'rgba(15,15,12,.22)',

  // Hairlines
  hairline:  'rgba(15,15,12,.08)',
  hairline2: 'rgba(15,15,12,.14)',
  hairline3: 'rgba(15,15,12,.24)',

  // Accent
  accent:    '#FFD100',
  accentInk: '#1A1400',
  accentSoft:'#FFF4B8',
  accentBorder:'#F2C200',
  accentHover:'#F5C900', accentActive:'#E0B800',
  // Emphasis text on a light surface. Yellow at readable contrast is olive, so
  // this is the ONE place that gold exists — never write it inline.
  accentText:'#7A5A00',
  // Neutral “notice” wash, for the many places accentSoft was used decoratively.
  highlightSoft:'#F1EFE9',
  // Focus + disabled are tokens, not opacity tricks.
  focusRing:'0 0 0 2px #FFFFFF, 0 0 0 4px #2C5BB8',
  disabledBg:'#F1EFE9', disabledInk:'rgba(15,15,12,.42)', disabledBorder:'rgba(15,15,12,.14)',

  // Signals
  good:'#1F8A4F', goodSoft:'#E2F2E8',
  warn:'#C07A12', warnSoft:'#FBEFD6',
  bad: '#C0392B', badSoft:'#F8E2DF',
  info:'#2C5BB8', infoSoft:'#E3ECFA',
  neutral:'#6E6E66', neutralSoft:'#ECEAE2',

  // Strain
  indica:'#7E55C9', sativa:'#D98316', hybrid:'#3F9E72',

  // Categorical wayfinding hues (decorative only, never status)
  // DEPRECATED: use `cat` for product taxonomy. Kept for Engage stat tiles
  // until they are migrated.
  hue:{ blue:'#1F5FA8', violet:'#6D4AC8', teal:'#0E7C6B', green:'#2C7A34', pink:'#B4306A' },

  // Cool workspace ramp — for dense data surfaces (kanban boards, wide tables)
  // that read muddy when every fill is warm paper. Cards stay `surface`.
  canvas:    '#EDEFF3',
  canvas2:   '#E1E6EC',

  // Field
  field:'#FFFFFF', fieldBorder:'rgba(15,15,12,.18)',

  shadowSm:'0 1px 0 rgba(15,15,12,.04), 0 1px 2px rgba(15,15,12,.05)',
  shadowMd:'0 1px 0 rgba(15,15,12,.04), 0 6px 18px rgba(15,15,12,.07)',
  shadowLg:'0 1px 0 rgba(15,15,12,.04), 0 18px 44px rgba(15,15,12,.14)',
};

const DARK = {
  mode:'dark',
  bg:        '#0D0D0A',
  bg2:       '#0A0A07',
  surface:   '#1A1A14',
  surface2:  '#211F18',
  surface3:  '#28261D',
  rail:      '#070705',
  railInk:   'rgba(245,243,236,.66)',
  railBright:'#FBFAF4',
  railHover: 'rgba(255,255,255,.05)',
  railActive:'rgba(255,209,0,.14)',
  railHair:  'rgba(255,255,255,.07)',
  scrim:     'rgba(0,0,0,.62)',

  ink:       '#F5F3EA',
  ink2:      '#D9D6CA',
  inkDim:    'rgba(245,243,234,.60)',
  inkMute:   'rgba(245,243,234,.40)',
  inkFaint:  'rgba(245,243,234,.22)',

  hairline:  'rgba(245,243,234,.09)',
  hairline2: 'rgba(245,243,234,.15)',
  hairline3: 'rgba(245,243,234,.26)',

  accent:    '#FFD100',
  accentInk: '#1A1400',
  accentSoft:'rgba(255,209,0,.15)',
  accentBorder:'rgba(255,209,0,.40)',
  accentHover:'#FFDA33', accentActive:'#E8BE00',
  accentText:'#FFD100',
  highlightSoft:'rgba(245,243,234,.06)',
  focusRing:'0 0 0 2px #1A1A14, 0 0 0 4px #6A99EC',
  disabledBg:'#28261D', disabledInk:'rgba(245,243,234,.40)', disabledBorder:'rgba(245,243,234,.15)',

  good:'#46C07E', goodSoft:'rgba(70,192,126,.15)',
  warn:'#E0A53A', warnSoft:'rgba(224,165,58,.15)',
  bad: '#E8675B', badSoft:'rgba(232,103,91,.16)',
  info:'#6A99EC', infoSoft:'rgba(106,153,236,.16)',
  neutral:'#9A968B', neutralSoft:'rgba(245,243,234,.08)',

  indica:'#A789E0', sativa:'#E5A24E', hybrid:'#5DBE93',

  hue:{ blue:'#8FC2FF', violet:'#B79CFF', teal:'#67D6C4', green:'#8FD68B', pink:'#F7A8C4' },

  canvas:    '#0E1013',
  canvas2:   '#171B21',

  field:'#15150F', fieldBorder:'rgba(245,243,234,.22)',

  shadowSm:'0 1px 0 rgba(0,0,0,.30), 0 1px 2px rgba(0,0,0,.40)',
  shadowMd:'0 1px 0 rgba(0,0,0,.30), 0 8px 22px rgba(0,0,0,.45)',
  shadowLg:'0 1px 0 rgba(0,0,0,.30), 0 22px 50px rgba(0,0,0,.62)',
};

// Shared (mode-independent) tokens
const SHARED = {
  // Radius by ROLE. 8 controls · 12 cards · 20 sheets · 999 pills.
  // r6 / r16 / r24 are deprecated — kept so old call sites don't break.
  r6:6, r8:8, r10:10, r12:12, r14:14, r16:16, r20:20, r24:24, r999:999,
  // Control heights. Anything a hand touches at the counter is md or larger;
  // xs/sm are for dense admin surfaces driven by a mouse.
  ctrlH:{ xs:30, sm:34, md:40, lg:44, xl:48 },
  // 4px spacing scale — use instead of inventing 9/11/13/15/22.
  space:{ x1:4, x2:8, x3:12, x4:16, x5:20, x6:24, x8:32 },
  // Type scale. Seven steps with jobs, plus two numeric steps because mono at
  // the same nominal size reads smaller than sans.
  type:{ micro:10, meta:11.5, body:12.5, strong:13.5, title:16, h2:21, h1:30, numRow:15, numTotal:21 },
  weight:{ body:500, emph:600, num:800 },
  fontSans:'"Inter", -apple-system, system-ui, sans-serif',
  fontMono:'"JetBrains Mono","SF Mono",ui-monospace,monospace',
  // category accents (kept consistent across modes, tuned for contrast)
  cat:{
    flower:'#3F9E72', vape:'#3F73D6', edibles:'#E0477C', concentrate:'#C2841D',
    tincture:'#8A5CD6', preroll:'#D45A3C', wellness:'#2FA59B', deals:'#FFD100',
    premium:'#9A7B3A', other:'#7E7E74',
  },
};

const THEMES = {
  light: { ...SHARED, ...LIGHT },
  dark:  { ...SHARED, ...DARK },
};

const ThemeCtx = React.createContext({ mode:'light', P:THEMES.light, setMode:()=>{}, toggle:()=>{} });
function useP(){ return React.useContext(ThemeCtx).P; }
function useTheme(){ return React.useContext(ThemeCtx); }

function ThemeProvider({ children }){
  const [mode, setMode] = React.useState(()=>{
    try { return localStorage.getItem('hw-pos-theme') || 'light'; } catch { return 'light'; }
  });
  React.useEffect(()=>{
    try { localStorage.setItem('hw-pos-theme', mode); } catch {}
    const P = THEMES[mode];
    document.documentElement.style.background = P.bg;
    document.body.style.background = P.bg;
    document.body.style.colorScheme = mode;
    // Keyboard focus. Inline styles can't express :focus-visible, so every
    // interactive atom carries data-hw-i and picks the ring up from here.
    let css = document.getElementById('hw-focus-css');
    if (!css) { css = document.createElement('style'); css.id = 'hw-focus-css'; document.head.appendChild(css); }
    css.textContent =
      '[data-hw-i]:focus{outline:none}' +
      // One rule for every screen in every app: native interactives get the ring
      // automatically, and [data-hw-i] stays an explicit opt-in for the things
      // that are not buttons (DataTable rows, custom chips).
      'button:focus-visible,[tabindex]:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[data-hw-i]:focus-visible' +
      '{outline:none;box-shadow:' + P.focusRing + ';position:relative;z-index:1}' +
      '@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}';
  }, [mode]);
  const toggle = React.useCallback(()=> setMode(m => m==='light'?'dark':'light'), []);
  const value = React.useMemo(()=>({ mode, P:THEMES[mode], setMode, toggle }), [mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

Object.assign(window, { THEMES, ThemeCtx, useP, useTheme, ThemeProvider });
