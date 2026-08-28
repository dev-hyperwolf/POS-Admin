// ── POS atoms — theme-aware (read live tokens via useP) ────────────────────
const useP = window.useP;

// Card. Elevation is a ROLE, not a decoration:
//   flat   border, no shadow      in-page cards, rows, panels   (default)
//   raised shadow, no border      popovers, sheets, dragged things
//   sunken canvas2 fill + hairline  wells, empty states
// The hairline is load-bearing, not decoration: canvas2 == bg2, so a sunken
// well dropped straight onto the page background is a 9/765 delta in dark
// mode and disappears. The border is what makes it read as recessed there.
// A card never has both a border and a shadow.
window.Card = function Card({ children, padding, density = 'default', elevation = 'flat', radius, style, onClick, hover: hoverable, ...rest }) {
  const P = useP();
  const [h, setH] = React.useState(false);
  const pad = padding != null ? padding : { compact: 12, default: 16, roomy: 20 }[density] ?? 16;
  const lift = hoverable && h;
  const E = {
    flat: { background: P.surface, border: `1px solid ${lift ? P.hairline3 : P.hairline2}`, boxShadow: lift ? P.shadowMd : 'none' },
    raised: { background: P.surface, border: '1px solid transparent', boxShadow: lift ? P.shadowLg : P.shadowMd },
    sunken: { background: P.canvas2, border: `1px solid ${P.hairline}`, boxShadow: 'none' }
  }[elevation] || {};
  return (
    <div onClick={onClick}
    onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{
      ...E, borderRadius: radius ?? P.r12, padding: pad,
      transform: lift ? 'translateY(-1px)' : 'none',
      transition: 'box-shadow .15s ease, transform .15s ease, background .2s ease, border-color .2s ease',
      cursor: onClick ? 'pointer' : 'default', ...style
    }} {...rest}>{children}</div>);

};

// ── Modal overlay — THE SCRIM IS A COMPONENT NOW, BECAUSE IT WAS NEVER ONE ──
//
// There was no shared scrim. The same object literal was retyped inline at 36
// call sites, and 17 of them were missing `overflowY`, so whether a modal could
// be submitted depended on which copy the author started from. That is not a
// styling inconsistency — it is a correctness one.
//
// THE BUG THIS FIXES. `alignItems:'center'` on a non-scrolling fixed overlay
// centres the card and then puts the parts that do not fit OUTSIDE the viewport
// on BOTH edges, where no scroll container exists to reach them. The Add-member
// modal is 888px tall; at 1440x800 its "Create member" button sat at y=824 and
// a member simply could not be created. Typing a first name and no last name
// adds the mononym note (+59px) and breaks 1440x900 too — so the note that
// exists to serve mononyms was what made the mononym case unusable.
//
// WHY `margin:'auto'` ON THE CARD RATHER THAN `alignItems:'center'`. Auto
// margins on the cross axis outrank align-items, so the card still centres when
// there IS spare room — today's look is unchanged. But when free space goes
// negative, auto margins resolve to ZERO instead of to a negative offset, so the
// card sits flush against the padded top edge and the scroll container can reach
// every pixel of it. `alignItems:'center'` cannot do that: it centres an
// overflowing child and strands the overhang above the scroll origin.
//
// That is the whole point of fixing the container instead of trimming content:
// this survives ANY height, so the next note anyone adds cannot resurrect the
// bug. Tuning a fixed height to today's tallest modal only moves the cliff.
//
//   <div style={overlayScrim(P, { z: P.z.modal })}>
//     <div style={{ ...overlayCard, width: 'min(520px,96%)' }}>…</div>
//   </div>
//
// `overscrollBehavior:'contain'` stops a scroll that reaches the end of the
// overlay from chaining to the page underneath it.
window.overlayScrim = function overlayScrim(P, opts) {
  const o = opts || {};
  return {
    position: 'fixed', inset: 0, zIndex: o.z == null ? 200 : o.z,
    background: P.scrim, display: 'flex', justifyContent: 'center',
    // flex-start, NOT center: see the note above. The card's `margin:auto`
    // is what restores centring in the case where centring is safe.
    alignItems: 'flex-start',
    padding: o.padding == null ? '40px 20px' : o.padding,
    overflowY: 'auto', overscrollBehavior: 'contain',
    // Opt-IN, so migrating an existing modal onto this helper cannot quietly
    // add an animation it never had.
    ...(o.animate ? { animation: 'fade .15s ease' } : null)
  };
};

// The other half of the contract. A card that forgets this still scrolls, but
// pins to the top edge instead of centring — so it is a style object rather
// than a convention nobody can enforce.
window.overlayCard = { margin: 'auto', flex: '0 0 auto' };

// Eyebrow label (mono, uppercase)
window.Eyebrow = function Eyebrow({ children, color, style }) {
  const P = useP();
  return <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: color || P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap', ...style }}>{children}</div>;
};

// Section header
window.SectionHead = function SectionHead({ eyebrow, title, subtitle, action, level = 2, style }) {
  const P = useP();
  const HTag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  const sz = { 1: { t: 30, st: 14, eb: 11 }, 2: { t: 20, st: 13, eb: 10.5 }, 3: { t: 15, st: 12.5, eb: 10 } }[level];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 14, ...style }}>
      <div style={{ minWidth: 0 }}>
        {/* CONTRAST, NOT TASTE. This eyebrow was P.inkMute — rgba(15,15,12,.42)
          on the warm paper bg, which measures 2.76:1, under even the 3:1 floor
          large text gets, and it is not large text: 10-11px uppercase is the
          SMALLEST type on the screen. P.inkDim is the next step on the same ramp
          and measures 4.85:1 on bg / 5.03:1 on surface, clearing AA 4.5:1 for
          normal text in both modes (dark: 6.65:1 on bg).
          The fix is deliberately HERE and not on the inkMute token itself:
          inkMute is also carrying KPI labels, table headers and field labels,
          and a token bump would silently restyle all of them. One component,
          one measured decision. */}
        {eyebrow && <div style={{ fontSize: sz.eb, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkDim, marginBottom: level === 1 ? 9 : 6, fontFamily: P.fontMono }}>{eyebrow}</div>}
        <HTag style={{ margin: 0, fontSize: sz.t, fontWeight: level === 1 ? 700 : 600, letterSpacing: level === 1 ? '-.02em' : '-.01em', color: P.ink, lineHeight: 1.12 }}>{title}</HTag>
        {subtitle && <div style={{ fontSize: sz.st, color: P.inkDim, marginTop: 6, maxWidth: 680, lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
      {action && <div style={{ flex: '0 0 auto' }}>{action}</div>}
    </div>);

};

// KPI tile
window.KPI = function KPI({ label, value, sublabel, delta, deltaKind, hint, accent, icon, spark, sparkColor, onClick }) {
  const P = useP();
  const dc = !delta ? P.inkMute : deltaKind === 'bad' ? P.bad : deltaKind === 'warn' ? P.warn : P.good;
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      background: P.surface, border: `1px solid ${accent ? P.accentBorder : P.hairline2}`, borderRadius: P.r12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0,
      cursor: onClick ? 'pointer' : 'default', boxShadow: onClick && h ? P.shadowMd : P.shadowSm,
      transition: 'box-shadow .15s ease, background .2s ease, border-color .2s ease', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <span style={{ width: 22, height: 22, borderRadius: 6, background: accent ? P.accent : P.surface3, color: accent ? P.accentInk : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={13} stroke={1.9} /></span>}
        <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}{hint && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: P.inkFaint }}> · {hint}</span>}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 600, color: P.ink, letterSpacing: '-.01em', fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{value}</div>
        {delta != null && <div style={{ fontSize: 11.5, fontWeight: 600, color: dc, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}%</div>}
        {sublabel && <div style={{ fontSize: 11.5, color: P.inkDim, whiteSpace: 'nowrap' }}>{sublabel}</div>}
      </div>
      {spark && <div style={{ marginTop: 2 }}><Spark data={spark} color={sparkColor || P.ink} fill /></div>}
    </div>);

};

window.Spark = function Spark({ data, color, height = 22, width = 96, fill }) {
  const P = useP();color = color || P.ink;
  if (!data || !data.length) return null;
  const max = Math.max(...data),min = Math.min(...data),rng = max - min || 1;
  const pts = data.map((v, i) => [i / (data.length - 1) * width, height - (v - min) / rng * (height - 4) - 2]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return <svg width={width} height={height} style={{ display: 'block' }}>
    {fill && <path d={path + ` L ${width} ${height} L 0 ${height} Z`} fill={color} opacity={P.mode === 'dark' ? .14 : .09} />}
    <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
};

// Status pill
// Status pill. Accepts the POS `kind` and the Hyperdrive `tone`/`label`
// vocabulary, so both kits render the same object.
window.Pill = function Pill({ kind, tone, label, children, dot, icon, soft, size, style }) {
  const P = useP();
  // HD tones that have no POS equivalent map onto the nearest signal.
  const TONE = { ok: 'good', warn: 'warn', blocked: 'bad', quarantine: 'warn', sealing: 'info',
    brand: 'accent', archived: 'neutral', info: 'info', neutral: 'neutral' };
  kind = kind || TONE[tone] || 'neutral';
  children = children != null ? children : label;
  const sm = size === 'sm';
  const map = {
    good: { bg: P.goodSoft, fg: P.good }, warn: { bg: P.warnSoft, fg: P.warn }, bad: { bg: P.badSoft, fg: P.bad },
    info: { bg: P.infoSoft, fg: P.info }, accent: { bg: P.accentSoft, fg: P.accentText },
    neutral: { bg: P.neutralSoft, fg: P.ink2 }, ghost: { bg: 'transparent', fg: P.inkDim, border: `1px solid ${P.hairline2}` },
    dark: { bg: P.ink, fg: P.surface }
  };
  const c = map[kind] || map.neutral;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: sm ? '2px 7px 3px' : '3px 8px 4px', background: c.bg, color: c.fg, border: c.border || 'none', borderRadius: P.r999, fontSize: sm ? 10 : 11.5, fontWeight: 600, letterSpacing: '.01em', whiteSpace: 'nowrap', fontFamily: P.fontSans, ...style }}>
    {dot && <span style={{ width: 5.5, height: 5.5, borderRadius: 99, background: c.fg, display: 'inline-block' }} />}
    {icon && <Icon name={icon} size={11} stroke={2} />}{children}</span>;
};

// Button. Four jobs: primary (the one action), secondary (outline), ghost
// (text), danger (destructive looks destructive). `accent` is the primary
// treatment; `primary` stays ink-filled for “selected/strong”; `soft` is kept
// as a deprecated alias of secondary-with-fill so old call sites don't move.
// Sizes are MIN-HEIGHTS — md and up are safe for touch.
window.PBtn = function PBtn({ variant = 'secondary', size = 'md', children, icon, iconRight, onClick, disabled, busy, active, full, style, title, ...rest }) {
  const P = useP();
  const [h, setH] = React.useState(false);
  const sizes = {
    xs: { h: P.ctrlH.xs, px: 10, fs: 11.5, ih: 13, r: P.r8 },
    sm: { h: P.ctrlH.sm, px: 12, fs: 12.5, ih: 14, r: P.r8 },
    md: { h: P.ctrlH.md, px: 16, fs: 13.5, ih: 15, r: P.r8 },
    lg: { h: P.ctrlH.lg, px: 20, fs: 14, ih: 17, r: P.r10 },
    xl: { h: P.ctrlH.xl, px: 24, fs: 15, ih: 18, r: P.r12 }
  };
  const s = sizes[size] || sizes.md;
  const V = {
    primary: { bg: P.ink, fg: P.surface, bd: P.ink, hov: P.ink2 },
    accent: { bg: P.accent, fg: P.accentInk, bd: P.accentBorder, hov: P.accentHover },
    secondary: { bg: P.surface, fg: P.ink, bd: P.hairline3, hov: P.surface3 },
    soft: { bg: P.surface3, fg: P.ink, bd: 'transparent', hov: P.hairline2 },
    ghost: { bg: 'transparent', fg: P.ink2, bd: 'transparent', hov: P.surface3 },
    danger: { bg: P.bad, fg: '#FFFFFF', bd: P.bad, hov: `color-mix(in srgb, ${P.bad} 88%, #000)` }
  };
  const v = V[active ? 'primary' : variant] || V.secondary;
  const off = disabled || busy;
  return <button data-hw-i onClick={off ? undefined : onClick} disabled={off} title={title} aria-busy={busy || undefined}
    onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: full ? '100%' : 'auto',
    minHeight: s.h, padding: `0 ${s.px}px`, fontSize: s.fs, fontWeight: 600, whiteSpace: 'nowrap',
    background: off ? P.disabledBg : h ? v.hov : v.bg, color: off ? P.disabledInk : v.fg,
    border: `1px solid ${off ? P.disabledBorder : v.bd}`,
    borderRadius: s.r, cursor: off ? 'not-allowed' : 'pointer', fontFamily: P.fontSans,
    transition: 'background .12s ease, transform .06s ease, color .12s ease', ...style
  }} onMouseDown={(e) => !off && (e.currentTarget.style.transform = 'translateY(1px)')}
     onMouseUp={(e) => (e.currentTarget.style.transform = 'none')} {...rest}>
    {busy ? <span style={{ width: s.ih, height: s.ih, borderRadius: 99, border: `2px solid ${P.disabledInk}`, borderTopColor: 'transparent', animation: 'hwspin .7s linear infinite', flex: '0 0 auto' }} /> :
    icon && <Icon name={icon} size={s.ih} stroke={2} />}
    {children}{iconRight && !busy && <Icon name={iconRight} size={s.ih} stroke={2} />}</button>;
};

// Icon button (touch target). `label` is required for anything without visible
// text — it becomes the accessible name; `title` stays the mouse tooltip.
window.IconBtn = function IconBtn({ icon, size = 18, onClick, badge, badgeColor, tone = 'ghost', title, label, style, ...rest }) {
  const P = useP();
  const [h, setH] = React.useState(false);
  const bg = tone === 'solid' ? P.surface3 : 'transparent';
  return <button data-hw-i {...rest} title={title || label} aria-label={label || title || icon} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
    position: 'relative', width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: h ? P.surface3 : bg, color: P.ink2, border: 'none', borderRadius: P.r8, cursor: 'pointer', transition: 'background .12s ease', ...style
  }}>
    <Icon name={icon} size={size} stroke={1.8} />
    {badge != null && <span style={{ position: 'absolute', top: 5, right: 5, minWidth: badge === true ? 8 : 15, height: badge === true ? 8 : 15, padding: badge === true ? 0 : '0 4px', background: badgeColor || P.accent, color: P.accentInk, borderRadius: 99, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono }}>{badge === true ? '' : badge}</span>}
  </button>;
};

// Segmented control
window.Seg = function Seg({ value, onChange, options, size = 'md', full }) {
  const P = useP();
  const s = { sm: { p: '5px 10px', fs: 11.5 }, md: { p: '8px 14px', fs: 12.5 }, lg: { p: '11px 18px', fs: 13.5 } }[size];
  return <div style={{ display: full ? 'flex' : 'inline-flex', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: 3, gap: 2 }}>
    {options.map((o) => {const a = o.value === value;return (
        <button data-hw-i key={o.value} onClick={() => onChange(o.value)} aria-pressed={a} style={{ flex: full ? 1 : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: size === 'lg' ? P.ctrlH.md : size === 'md' ? P.ctrlH.sm : P.ctrlH.xs, padding: s.p, fontSize: s.fs, fontWeight: 600,
          background: a ? P.surface : 'transparent', color: a ? P.ink : P.inkDim, border: 'none', borderRadius: 7, cursor: 'pointer',
          boxShadow: a ? P.shadowSm : 'none', fontFamily: P.fontSans, transition: 'background .12s, color .12s', whiteSpace: 'nowrap' }}>
        {o.icon && <Icon name={o.icon} size={14} stroke={1.9} color={o.color && a ? o.color : undefined} />}{o.label}{o.count != null && <span style={{ fontFamily: P.fontMono, fontSize: s.fs - 2, fontWeight: 700, color: o.color || (a ? P.ink : P.inkMute), background: o.color ? `${o.color}1f` : 'transparent', padding: o.color ? '1px 7px' : 0, borderRadius: 99 }}>{o.count}</span>}
      </button>);})}
  </div>;
};

// Underline tabs
window.Tabs = function Tabs({ value, onChange, options, style }) {
  const P = useP();
  return <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${P.hairline2}`, ...style }}>
    {options.map((o) => {const a = o.value === value;return (
        <button data-hw-i key={o.value} onClick={() => onChange(o.value)} aria-selected={a} style={{ padding: '11px 0 13px', fontSize: 13.5, fontWeight: 600, color: a ? P.ink : P.inkDim, background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: a ? `2px solid ${P.ink}` : '2px solid transparent', marginBottom: -1, transition: 'color .12s' }}>
        {o.label}{o.count != null && <span style={{ marginLeft: 6, fontSize: 11.5, color: a ? P.ink : P.inkMute, fontWeight: 600, fontFamily: P.fontMono }}>{o.count}</span>}
      </button>);})}
  </div>;
};

// Bar meter
window.BarMeter = function BarMeter({ value, max = 1, color, height = 6, showLabel, width }) {
  const P = useP();color = color || P.ink;
  const pct = Math.max(0, Math.min(1, value / max));
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: width || '100%' }}>
    <div style={{ flex: 1, background: P.surface3, height, borderRadius: 99, overflow: 'hidden', minWidth: 36 }}><div style={{ width: pct * 100 + '%', height: '100%', background: color, borderRadius: 99 }} /></div>
    {showLabel && <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right', fontFamily: P.fontMono }}>{Math.round(pct * 100)}%</div>}
  </div>;
};

// Product thumbnail — gradient from hue (no real imagery). Leaf glyph baked in.
window.Thumb = function Thumb({ item, size = 42, radius = 9 }) {
  const P = useP();
  const hue = item?.hue ?? 90;
  return <div style={{ width: size, height: size, borderRadius: radius, position: 'relative', overflow: 'hidden', flex: '0 0 auto',
    background: `linear-gradient(140deg, hsl(${hue} ${P.mode === 'dark' ? '42%' : '56%'} ${P.mode === 'dark' ? '34%' : '50%'}), hsl(${(hue + 34) % 360} ${P.mode === 'dark' ? '46%' : '62%'} ${P.mode === 'dark' ? '24%' : '38%'}))`,
    boxShadow: `inset 0 0 0 1px ${P.mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)'}` }}>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,.42), transparent 56%)' }} />
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.34)' }}><Icon name="leaf" size={size * 0.46} stroke={1.4} color="rgba(255,255,255,.5)" /></div>
  </div>;
};

// Avatar (initials)
window.Avatar = function Avatar({ name = '', size = 34, hue, crown }) {
  const P = useP();
  const init = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const h = hue ?? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <div style={{ position: 'relative', width: size, height: size, borderRadius: 99, flex: '0 0 auto',
    background: `linear-gradient(140deg, hsl(${h} 48% ${P.mode === 'dark' ? '40%' : '52%'}), hsl(${(h + 40) % 360} 52% ${P.mode === 'dark' ? '30%' : '40%'}))`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.36, letterSpacing: '.02em' }}>
    {init}
    {crown && <span style={{ position: 'absolute', top: -6, right: -5, width: 16, height: 16, background: P.accent, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${P.surface}` }}><Icon name="crown" size={9} color={P.accentInk} /></span>}
  </div>;
};

// Text field. Focus is info-blue, not yellow — yellow means “primary action”.
window.Field = function Field({ icon, placeholder, value, onChange, size = 'md', suffix, full = true, style, mono, ...rest }) {
  const P = useP();
  const [f, setF] = React.useState(false);
  const s = { sm: { h: P.ctrlH.sm, px: 11, fs: 12.5, ih: 14 }, md: { h: P.ctrlH.md, px: 13, fs: 13.5, ih: 16 }, lg: { h: P.ctrlH.xl, px: 16, fs: 15, ih: 18 } }[size];
  return <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: full ? '100%' : 'auto', minHeight: s.h, padding: `0 ${s.px}px`, background: P.field, border: `1px solid ${f ? P.info : P.fieldBorder}`, borderRadius: P.r8, boxShadow: f ? P.focusRing : 'none', transition: 'border-color .12s, box-shadow .12s', ...style }}>
    {icon && <Icon name={icon} size={s.ih} stroke={1.9} color={P.inkMute} />}
    <input value={value} onChange={onChange} placeholder={placeholder} onFocus={() => setF(true)} onBlur={() => setF(false)} {...rest}
    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: s.fs, fontFamily: mono ? P.fontMono : P.fontSans, padding: '9px 0' }} />
    {suffix}
  </div>;
};

// Qty stepper
window.Stepper = function Stepper({ value, onChange, min = 0, size = 'md' }) {
  const P = useP();
  const s = { sm: { h: 30, w: 30, fs: 13 }, md: { h: 36, w: 36, fs: 14 }, lg: { h: 44, w: 44, fs: 16 } }[size];
  const btn = (ic, fn, dis) => <button data-hw-i aria-label={ic === 'minus' ? 'Decrease' : 'Increase'} onClick={fn} disabled={dis} style={{ width: s.w, height: s.h, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: dis ? P.inkFaint : P.ink, cursor: dis ? 'default' : 'pointer', borderRadius: P.r8 }}><Icon name={ic} size={15} stroke={2.2} /></button>;
  return <div style={{ display: 'inline-flex', alignItems: 'center', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
    {btn('minus', () => onChange(Math.max(min, value - 1)), value <= min)}
    <span style={{ minWidth: 24, textAlign: 'center', fontSize: s.fs, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    {btn('plus', () => onChange(value + 1))}
  </div>;
};

// Toggle switch
window.Switch = function Switch({ on, onChange, size = 20 }) {
  const P = useP();
  return <button data-hw-i role="switch" aria-checked={!!on} onClick={() => onChange(!on)} style={{ width: size * 1.85, height: size, borderRadius: 99, background: on ? P.accent : P.hairline3, border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', transition: 'background .15s ease' }}>
    <span style={{ width: size - 4, height: size - 4, borderRadius: 99, background: on ? P.accentInk : P.surface, transform: on ? `translateX(${size * 0.85}px)` : 'translateX(0)', transition: 'transform .18s ease', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
  </button>;
};

// Strain pill
window.StrainPill = function StrainPill({ type, thc, size = 'sm' }) {
  const P = useP();
  if (!type) return null;
  const c = type.toLowerCase() === 'indica' ? P.indica : type.toLowerCase() === 'sativa' ? P.sativa : P.hybrid;
  const L = type[0].toUpperCase();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: P.fontMono }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, background: c + (P.mode === 'dark' ? '28' : '1F'), color: c, fontSize: 10, fontWeight: 700, letterSpacing: '.04em' }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: c }} />{type.toUpperCase()}</span>
    {thc != null && <span style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>{thc}%</span>}
  </span>;
};

// Data table
window.DataTable = function DataTable({ columns, rows, dense, onRowClick, stickyHead, rowKey, selectedKeys, style }) {
  const P = useP();
  return <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, overflow: 'hidden', background: P.surface, ...style }}>
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, fontFamily: P.fontSans }}>
      <thead>
        <tr style={{ background: P.surface2 }}>
          {columns.map((c, i) => <th key={i} style={{ textAlign: c.align || 'left', padding: dense ? '9px 12px' : '11px 16px', fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap', width: c.width || 'auto', position: stickyHead ? 'sticky' : 'static', top: 0 }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: P.inkMute, fontSize: 13.5 }}>No results</td></tr>}
        {rows.map((row, ri) => {const k = rowKey ? rowKey(row) : ri;const sel = selectedKeys && selectedKeys.has(k);return (
            <tr key={k} data-hw-i={onRowClick ? '' : undefined} tabIndex={onRowClick ? 0 : undefined} role={onRowClick ? 'button' : undefined}
            onKeyDown={onRowClick ? (e) => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();onRowClick(row);}} : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined} style={{ cursor: onRowClick ? 'pointer' : 'default', background: sel ? P.surface3 : 'transparent', transition: 'background .1s' }}
            onMouseEnter={(e) => !sel && (e.currentTarget.style.background = P.surface2)} onMouseLeave={(e) => !sel && (e.currentTarget.style.background = 'transparent')}>
            {columns.map((c, ci) => <td key={ci} style={{ textAlign: c.align || 'left', padding: dense ? '9px 12px' : '13px 16px', borderTop: `1px solid ${P.hairline}`, borderLeft: ci === 0 && selectedKeys ? `3px solid ${sel ? P.ink : 'transparent'}` : undefined, color: P.ink, verticalAlign: 'middle' }}>{c.render ? c.render(row) : row[c.key]}</td>)}
          </tr>);})}
      </tbody>
    </table>
    </div>
  </div>;
};

// Checkbox
window.Check = function Check({ on, onChange, size = 20 }) {
  const P = useP();
  return <button data-hw-i role="checkbox" aria-checked={!!on} onClick={(e) => {e.stopPropagation();onChange(!on);}} style={{ width: size, height: size, borderRadius: 6, border: `1.5px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: '0 0 auto', transition: 'all .12s' }}>
    {on && <Icon name="check" size={size * 0.66} stroke={3} color={P.surface} />}</button>;
};

Object.assign(window, {});