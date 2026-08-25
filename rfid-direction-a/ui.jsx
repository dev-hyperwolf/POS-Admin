// ── RFID-specific primitives ──────────────────────────────────────────────
// Only the things the shared kit genuinely does not cover. Everything else on
// these screens is Card / PBtn / Field / StatTile / HDPill / HDTable / Sheet /
// EmptyState / hdToast, unchanged.
;(function () {
  const useP = window.useP;
  const HD = () => window.HD;

  // Page header — the pipeline's 30px title + one-line subtitle + right actions.
  window.RfidPageHead = function RfidPageHead({ title, sub, back, actions, meta }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {back && (
            <button onClick={back.onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, marginBottom: 8, color: P.inkDim, fontSize: 12.5, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={13} stroke={2} />{back.label}
            </button>)}
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1, fontFamily: title.mono ? P.fontMono : P.fontSans }}>{title.text || title}</h1>
          {sub && <p style={{ margin: '5px 0 0', fontSize: 13.5, color: P.inkDim, maxWidth: 720, lineHeight: 1.45 }}>{sub}</p>}
          {meta && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{meta}</div>}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>{actions}</div>}
      </div>);
  };

  // EPC chip. Same grammar as UidChip, different namespace: an EPC is neither a
  // METRC package UID nor a Hyperdrive HUID, so it gets its own prefix rather
  // than being mislabelled as one of theirs. 24 hex chars is too wide for a
  // table cell, so it shows head…tail and expands on click.
  window.EpcChip = function EpcChip({ value, size = 'sm', expanded: expandedProp, muted }) {
    const P = useP();
    const [expanded, setExpanded] = React.useState(expandedProp ?? false);
    const [copied, setCopied] = React.useState(false);
    const c = muted ? P.inkMute : HD().hueColor(P, 'violet');
    const display = expanded ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
    const doCopy = (e) => {
      e.stopPropagation();
      if (navigator.clipboard) navigator.clipboard.writeText(value).catch(() => {});
      setCopied(true);
      if (window.hdToast) window.hdToast({ title: 'EPC copied', description: value, tone: 'ok' });
      setTimeout(() => setCopied(false), 1500);
    };
    return (
      <button type="button" title={`${value} · 96-bit closed-loop EPC (not SGTIN-96)`} onClick={() => setExpanded((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: size === 'md' ? 28 : 24, padding: '0 6px', borderRadius: 7,
          border: `1px solid ${P.hairline2}`, background: P.surface3, color: muted ? P.inkDim : P.ink2,
          fontFamily: P.fontMono, fontSize: size === 'md' ? 12.5 : 11.5, fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}>
        <span style={{ borderRadius: 3, padding: '1px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: c, background: P.surface }}>EPC</span>
        <span>{display}</span>
        {expanded && <span onClick={doCopy} style={{ opacity: .75, display: 'inline-flex' }}><Icon name={copied ? 'check' : 'copy'} size={11} stroke={2} /></span>}
      </button>);
  };

  // The four reconciliation states + rescan, mapped onto existing tones.
  // correct→ok · short→blocked · excess→warn · wrong product→quarantine ·
  // rescan→neutral. No new colour enters the system.
  const LINE_TONE = { correct: 'ok', short: 'blocked', excess: 'warn', wrong: 'quarantine', rescan: 'neutral' };
  const LINE_LABEL = { correct: 'Correct', short: 'Short', excess: 'Excess', wrong: 'Wrong product', rescan: 'Rescan' };
  const LINE_ICON = { correct: 'check-circle', short: 'arrow-down', excess: 'arrow-up', wrong: 'swap', rescan: 'help' };
  window.RFID_LINE_TONE = LINE_TONE;
  window.RFID_LINE_LABEL = LINE_LABEL;

  window.LinePill = function LinePill({ state, size = 'sm' }) {
    const P = useP();
    const c = HD().tone(P, LINE_TONE[state]);
    const h = size === 'md' ? 24 : 20;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: h, padding: '0 8px', background: c.bg, color: c.fg, border: `1px solid ${P.hairline2}`, borderRadius: 99, fontSize: size === 'md' ? 11.5 : 10, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: P.fontSans }}>
        <Icon name={LINE_ICON[state]} size={11} stroke={2.2} />{LINE_LABEL[state]}
      </span>);
  };

  // Signed delta — mono, tabular, tone-coloured, always carrying its sign.
  window.Delta = function Delta({ value, size = 13.5 }) {
    const P = useP();
    const c = value === 0 ? P.inkMute : HD().tone(P, value < 0 ? 'blocked' : 'warn').fg;
    return <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: size, color: c, fontWeight: 600 }}>{value > 0 ? '+' : ''}{value}</span>;
  };

  // A dBm reading. Signal strength is a number, so it is mono; the minus sign
  // is part of the value and never gets typographically prettified away.
  window.Dbm = function Dbm({ value, gate, size = 12.5 }) {
    const P = useP();
    const under = gate != null && value < gate;
    return <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: size, color: under ? HD().tone(P, 'blocked').fg : P.ink2 }}>{value.toFixed(1)} dBm</span>;
  };

  // Single-select chip row. Selected is INK, never accent (design-system rule 0).
  window.ChipFilter = function ChipFilter({ value, onChange, options, ariaLabel }) {
    const P = useP();
    return (
      <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {options.map((o) => {
          const a = o.id === value;
          return (
            <button key={o.id} aria-pressed={a} onClick={() => onChange(o.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '0 12px', height: 32, borderRadius: 8, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap',
                background: a ? P.ink : 'transparent', color: a ? P.surface : P.inkDim, border: `1px solid ${a ? P.ink : P.hairline2}` }}>
              {o.label}
              {o.count != null && <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: a ? P.surface : P.inkMute }}>{o.count}</span>}
            </button>);
        })}
      </div>);
  };

  // Callout. Used a great deal here because this module ships with real
  // caveats — an unverified bridge, one reader, unprinted ZPL — and hiding
  // them in a doc is how a pilot ships broken.
  window.Callout = function Callout({ tone = 'warn', icon = 'flag', title, children, action, style }) {
    const P = useP();
    const c = HD().tone(P, tone);
    return (
      <div style={{ display: 'flex', gap: 10, padding: '11px 13px', background: c.bg, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c.fg}`, borderRadius: P.r10, ...style }}>
        <span style={{ color: c.fg, flex: '0 0 auto', marginTop: 1 }}><Icon name={icon} size={15} stroke={2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{title}</div>}
          {children && <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5, marginTop: title ? 3 : 0 }}>{children}</div>}
          {action && <div style={{ marginTop: 9 }}>{action}</div>}
        </div>
      </div>);
  };

  // Card section header — 15px/600 with an optional right slot.
  window.CardHead = function CardHead({ title, sub, right, style }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, ...style }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>{title}</div>
          {sub && <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>}
        </div>
        {right && <div style={{ flex: '0 0 auto' }}>{right}</div>}
      </div>);
  };

  // Label / value pair. Values are mono unless explicitly prose.
  window.KV = function KV({ label, value, mono = true, tone }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ fontSize: 12.5, color: P.inkMute, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 12.5, color: tone || P.ink, fontFamily: mono ? P.fontMono : P.fontSans, fontVariantNumeric: mono ? 'tabular-nums' : 'normal', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
      </div>);
  };

  // A SKU token. SKUs are codes, so they are mono everywhere they appear.
  window.SkuToken = function SkuToken({ sku, withName }) {
    const P = useP();
    const meta = window.RFID_DATA.SKU_MAP.get(sku);
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{sku}</span>
        {withName && meta && <span style={{ fontSize: 11.5, color: P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.name} · {meta.brand}</span>}
      </span>);
  };
})();
