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

  // Signals
  good:'#1F8A4F', goodSoft:'#E2F2E8',
  warn:'#C07A12', warnSoft:'#FBEFD6',
  bad: '#C0392B', badSoft:'#F8E2DF',
  info:'#2C5BB8', infoSoft:'#E3ECFA',
  neutral:'#6E6E66', neutralSoft:'#ECEAE2',

  // Strain
  indica:'#7E55C9', sativa:'#D98316', hybrid:'#3F9E72',

  // Categorical wayfinding hues (decorative only, never status)
  hue:{ blue:'#1F5FA8', violet:'#6D4AC8', teal:'#0E7C6B', green:'#2C7A34', pink:'#B4306A' },

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

  good:'#46C07E', goodSoft:'rgba(70,192,126,.15)',
  warn:'#E0A53A', warnSoft:'rgba(224,165,58,.15)',
  bad: '#E8675B', badSoft:'rgba(232,103,91,.16)',
  info:'#6A99EC', infoSoft:'rgba(106,153,236,.16)',
  neutral:'#9A968B', neutralSoft:'rgba(245,243,234,.08)',

  indica:'#A789E0', sativa:'#E5A24E', hybrid:'#5DBE93',

  hue:{ blue:'#8FC2FF', violet:'#B79CFF', teal:'#67D6C4', green:'#8FD68B', pink:'#F7A8C4' },

  field:'#15150F', fieldBorder:'rgba(245,243,234,.22)',

  shadowSm:'0 1px 0 rgba(0,0,0,.30), 0 1px 2px rgba(0,0,0,.40)',
  shadowMd:'0 1px 0 rgba(0,0,0,.30), 0 8px 22px rgba(0,0,0,.45)',
  shadowLg:'0 1px 0 rgba(0,0,0,.30), 0 22px 50px rgba(0,0,0,.62)',
};

// Shared (mode-independent) tokens
const SHARED = {
  r6:6, r8:8, r10:10, r12:12, r14:14, r16:16, r20:20, r24:24, r999:999,
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
  }, [mode]);
  const toggle = React.useCallback(()=> setMode(m => m==='light'?'dark':'light'), []);
  const value = React.useMemo(()=>({ mode, P:THEMES[mode], setMode, toggle }), [mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

Object.assign(window, { THEMES, ThemeCtx, useP, useTheme, ThemeProvider });
