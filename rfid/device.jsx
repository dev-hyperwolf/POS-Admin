// ── The TC22R device frame + handheld chrome ─────────────────────────────
// Direction C's surface, carried over whole. Adapted from mobile/ios-frame.jsx
// (bezel → status bar → flex content → bottom indicator), re-shaped for a Zebra
// TC22R: rugged square bezel, physical side triggers, on-screen Android nav
// triad, and a 360×660 logical screen instead of a 402×874 phone.
//
// Ergonomic rules encoded here, and nowhere else:
//   · the ONE action is pinned to the bottom dock — thumb reach, one-handed
//   · list rows are 64px, actions 64px, chips 40px, steppers 48px
//     (HANDOFF: touch targets on a scan screen are ≥56px for anything primary)
//   · the state answer is a full-bleed band at the top of the content, readable
//     while walking; the detail sits underneath it for when you stop
//   · every value is mono/tabular so digits do not dance as they tick
//   · never two accents: while the radio is reading, the commit action is quiet
//
// Colour note: every tone wash here is `HD.tone().bg` with a `hairline2` border
// and a tone-coloured edge. Nothing depends on the ground colour to read as
// raised — that is exactly what the canvas/bg unification broke elsewhere.
;(function () {
  const useP = window.useP;
  const HD = () => window.HD;

  /* ══════════════════════ THE DEVICE ══════════════════════ */

  window.TCDevice = function TCDevice({ children, battery, rf, online = true, scanning = false, onTrigger }) {
    const P = useP(), D = window.RFID_DATA;
    const batt = battery == null ? D.DEVICES.reader.battery / 100 : battery;
    const power = rf == null ? D.DEVICES.reader.rfPower : rf;
    return (
      <div style={{ position: 'relative', width: 400, flex: '0 0 auto' }}>
        <div style={{ width: 400, borderRadius: 26, background: P.rail, padding: '18px 20px 22px', boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, position: 'relative' }}>
          {/* top bezel — speaker slit + model mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px' }}>
            <span style={{ width: 44, height: 4, borderRadius: 99, background: P.railHair }} />
            <span style={{ flex: 1, height: 4, borderRadius: 99, background: P.railHover }} />
            <span style={{ fontFamily: P.fontMono, fontSize: 9.5, letterSpacing: '.16em', color: P.railInk }}>TC22R</span>
          </div>

          {/* screen */}
          <div style={{ width: 360, height: 660, borderRadius: 8, overflow: 'hidden', background: P.bg, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: `inset 0 0 0 1px ${P.hairline3}` }}>
            <TCStatusBar battery={batt} rf={power} online={online} scanning={scanning} />
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
            <TCNavTriad />
          </div>

          {/* bottom bezel */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 12 }}>
            <span style={{ width: 96, height: 4, borderRadius: 99, background: P.railHair }} />
          </div>

          {/* physical scan triggers — hardware, deliberately NOT accent-coloured:
              accent on this page belongs to the one on-screen primary action. */}
          {['left', 'right'].map((side) => (
            <button key={side} onClick={onTrigger} aria-label="Side scan trigger"
              style={{ position: 'absolute', [side]: -5, top: 232, width: 8, height: 76, borderRadius: 4, border: 'none', padding: 0,
                background: scanning ? P.good : P.neutral, cursor: 'pointer', transition: 'background .12s' }} />))}
        </div>
      </div>);
  };

  function TCStatusBar({ battery, rf, online, scanning }) {
    const P = useP(), D = window.RFID_DATA;
    const t = HD().tone(P, scanning ? 'ok' : 'neutral');
    const pct = Math.round(battery * 100);
    return (
      <div style={{ flex: '0 0 auto', height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
        background: P.surface2, borderBottom: `1px solid ${P.hairline2}`,
        fontFamily: P.fontMono, fontSize: 10.5, color: P.inkMute, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: P.ink2 }}>{D.fmtClock(D.NOW)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 6px', height: 17, borderRadius: 99, background: t.bg, color: t.fg }}>
          <Icon name="lightning" size={9} stroke={2.2} />{rf} dBm
        </span>
        <span style={{ flex: 1 }} />
        <Icon name={online ? 'link' : 'x'} size={11} stroke={2} color={online ? P.good : P.bad} />
        <span>{pct}%</span>
        <span style={{ position: 'relative', width: 18, height: 9, borderRadius: 2, border: `1px solid ${P.inkFaint}` }}>
          <span style={{ position: 'absolute', inset: 1, width: `calc(${pct}% - 2px)`, background: pct < 20 ? P.bad : P.ink2, borderRadius: 1 }} />
        </span>
      </div>);
  }

  function TCNavTriad() {
    const P = useP();
    const g = (d) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.inkMute} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
    return (
      <div style={{ flex: '0 0 auto', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 62, background: P.surface2, borderTop: `1px solid ${P.hairline2}` }}>
        {g(<path d="M19 12H5m0 0l6-6m-6 6l6 6" />)}
        {g(<circle cx="12" cy="12" r="8" />)}
        {g(<rect x="5" y="5" width="14" height="14" rx="2" />)}
      </div>);
  }

  /* ══════════════════════ IN-SCREEN CHROME ══════════════════════ */

  // 56px title bar. Back is top-left (rare); the frequent action is at the bottom.
  window.HHBar = function HHBar({ title, sub, onBack, right }) {
    const P = useP();
    return (
      <div style={{ flex: '0 0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 4px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: P.ink, cursor: 'pointer' }}>
            <Icon name="chevron-left" size={24} stroke={2.2} />
          </button>)}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: onBack ? 0 : 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
        </div>
        {right}
      </div>);
  };

  // Full-bleed verdict band — the thing you read from four feet away.
  window.HHBand = function HHBand({ tone = 'neutral', icon, title, value, sub }) {
    const P = useP();
    const c = HD().tone(P, tone);
    return (
      <div style={{ flex: '0 0 auto', padding: '14px 16px 16px', background: c.bg, borderBottom: `2px solid ${c.fg}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: P.r8, background: P.surface, border: `1px solid ${P.hairline2}`, color: c.fg, flex: '0 0 auto' }}><Icon name={icon} size={15} stroke={2.1} /></span>}
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: c.fg, fontFamily: P.fontMono }}>{title}</span>
        </div>
        {value != null && (
          <div style={{ marginTop: 8, fontSize: 44, lineHeight: 1, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{value}</div>)}
        {sub && <div style={{ marginTop: 7, fontSize: 13.5, color: P.ink2, lineHeight: 1.35 }}>{sub}</div>}
      </div>);
  };

  // Scrollable content well.
  window.HHBody = function HHBody({ children, pad = 12, style }) {
    return <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 8, ...style }}>{children}</div>;
  };

  // 64px list row — the handheld's only list primitive.
  window.HHRow = function HHRow({ lead, title, sub, value, valueSub, tone, onClick, done, style }) {
    const P = useP();
    const c = tone ? HD().tone(P, tone) : null;
    return (
      <div onClick={onClick} style={{
        minHeight: 64, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
        background: done ? P.surface2 : P.surface, border: `1px solid ${P.hairline2}`,
        borderLeft: c ? `4px solid ${c.fg}` : `1px solid ${P.hairline2}`,
        borderRadius: P.r12, cursor: onClick ? 'pointer' : 'default', opacity: done ? .6 : 1, flex: '0 0 auto', ...style,
      }}>
        {lead}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: P.ink, lineHeight: 1.25, textDecoration: done ? 'line-through' : 'none' }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
        </div>
        {value != null && (
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: c ? c.fg : P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
            {valueSub && <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{valueSub}</div>}
          </div>)}
      </div>);
  };

  // Round tick lead used by the pull list and the straggler chase.
  window.HHTick = function HHTick({ on }) {
    const P = useP();
    return (
      <span style={{ width: 34, height: 34, borderRadius: 99, border: `2px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        {on && <Icon name="check" size={18} stroke={3} color={P.surface} />}
      </span>);
  };

  // Neutral glyph lead.
  window.HHLead = function HHLead({ icon, tone, text }) {
    const P = useP();
    const c = tone ? HD().tone(P, tone) : null;
    return (
      <span style={{ width: 34, height: 34, borderRadius: P.r8, background: c ? c.bg : P.surface3, border: `1px solid ${P.hairline2}`, color: c ? c.fg : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontFamily: P.fontMono, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {icon ? <Icon name={icon} size={17} stroke={2} /> : text}
      </span>);
  };

  // Square value plate used in 2-up grids.
  window.HHStat = function HHStat({ label, value, sub, tone }) {
    const P = useP();
    const c = tone ? HD().tone(P, tone) : null;
    return (
      <div style={{ flex: 1, minWidth: 0, padding: '10px 11px', background: c ? c.bg : P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: 24, lineHeight: 1, fontWeight: 600, color: c ? c.fg : P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {sub && <div style={{ marginTop: 3, fontSize: 11, color: P.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>);
  };

  // Bottom action dock — pinned, thumb-height, one primary at most.
  window.HHDock = function HHDock({ children, note }) {
    const P = useP();
    return (
      <div style={{ flex: '0 0 auto', padding: 12, borderTop: `1px solid ${P.hairline2}`, background: P.surface, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {note && <div style={{ fontSize: 11.5, color: P.inkMute, textAlign: 'center', lineHeight: 1.3 }}>{note}</div>}
        {children}
      </div>);
  };

  // 64px full-width action. `variant`: accent (THE action) · ink (selected /
  // strong secondary) · outline · quiet.
  window.HHAction = function HHAction({ children, sub, icon, variant = 'accent', onClick, disabled }) {
    const P = useP();
    const V = {
      accent:  { bg: P.accent, fg: P.accentInk, bd: P.accentBorder },
      ink:     { bg: P.ink, fg: P.surface, bd: P.ink },
      outline: { bg: P.surface, fg: P.ink, bd: P.hairline3 },
      quiet:   { bg: P.surface3, fg: P.ink2, bd: P.hairline2 },
    }[variant];
    return (
      <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
        width: '100%', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: disabled ? P.disabledBg : V.bg, color: disabled ? P.disabledInk : V.fg,
        border: `1px solid ${disabled ? P.disabledBorder : V.bd}`, borderRadius: P.r12,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: P.fontSans, padding: '0 16px',
      }}>
        {icon && <Icon name={icon} size={22} stroke={2.1} />}
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>{children}</span>
          {sub && <span style={{ fontSize: 11.5, opacity: .78, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
        </span>
      </button>);
  };

  // 40px filter/segment chip strip. Selection is ink — never accent.
  window.HHChips = function HHChips({ value, onChange, options, style }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, flex: '0 0 auto', ...style }}>
        {options.map((o) => {
          const a = o.value === value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={a} style={{
              flex: '0 0 auto', minHeight: 40, padding: '0 14px', borderRadius: P.r999, cursor: 'pointer',
              background: a ? P.ink : P.surface, color: a ? P.surface : P.ink2,
              border: `1px solid ${a ? P.ink : P.hairline2}`, fontFamily: P.fontSans, fontSize: 13, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
              {o.label}
              {o.count != null && <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: .8 }}>{o.count}</span>}
            </button>);
        })}
      </div>);
  };

  // The live scan surface: a big target that reports what the radio is doing.
  // Power and gate live here so a miscalibration shows up on the floor rather
  // than in a log an operator will never open.
  window.HHScanField = function HHScanField({ scanning, unique, reads, seconds, gate, power }) {
    const P = useP(), D = window.RFID_DATA;
    const c = HD().tone(P, scanning ? 'ok' : 'neutral');
    return (
      <div style={{ flex: '0 0 auto', margin: 12, padding: '18px 16px 16px', borderRadius: P.r14,
        background: c.bg, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c.fg}`, position: 'relative', overflow: 'hidden' }}>
        {scanning && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: c.fg, animation: 'rfidsweep 1.5s ease-in-out infinite' }} />)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ position: 'relative', width: 9, height: 9, flex: '0 0 auto' }}>
            {scanning && <span aria-hidden="true" style={{ position: 'absolute', inset: -4, borderRadius: 99, background: c.fg, opacity: .22 }} />}
            <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: c.fg }} />
          </span>
          <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: c.fg }}>
            {scanning ? 'Reading' : 'Trigger released'}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim, fontVariantNumeric: 'tabular-nums' }}>{D.fmtDur(seconds)}</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 56, lineHeight: .95, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em' }}>{unique}</span>
          <span style={{ fontSize: 13.5, color: P.inkDim, fontWeight: 600 }}>unique tags</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 14, fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
          <span>{reads} reads</span>
          <span>power {power} dBm</span>
          <span>gate {gate} dBm</span>
        </div>
      </div>);
  };

  // Small mono meta grid: "label / value" pairs, 2-up.
  window.HHMeta = function HHMeta({ items }) {
    const P = useP();
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', padding: '10px 12px', background: P.surface3, border: `1px solid ${P.hairline}`, borderRadius: P.r12, flex: '0 0 auto' }}>
        {items.map((it, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{it.label}</div>
            <div style={{ fontSize: 13, color: P.ink, marginTop: 2, fontFamily: it.mono === false ? P.fontSans : P.fontMono, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.value}</div>
          </div>))}
      </div>);
  };

  // A tone-washed caveat sized for the handheld.
  window.HHNote = function HHNote({ tone = 'warn', icon = 'alert', children }) {
    const P = useP();
    const c = HD().tone(P, tone);
    return (
      <div style={{ padding: '10px 12px', background: c.bg, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c.fg}`, borderRadius: P.r12, display: 'flex', gap: 9, flex: '0 0 auto' }}>
        <Icon name={icon} size={16} stroke={2} color={c.fg} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.4 }}>{children}</span>
      </div>);
  };

  // Plain prose inside a handheld body.
  window.HHText = function HHText({ children }) {
    const P = useP();
    return <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45, padding: '2px 2px 8px', flex: '0 0 auto' }}>{children}</div>;
  };

  // Uppercase section rule inside a handheld body.
  window.HHSection = function HHSection({ children, right }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px 0', flex: '0 0 auto' }}>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{children}</span>
        <span style={{ flex: 1, height: 1, background: P.hairline }} />
        {right && <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkMute, fontVariantNumeric: 'tabular-nums' }}>{right}</span>}
      </div>);
  };
})();
