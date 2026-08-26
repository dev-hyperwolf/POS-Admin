// ── RFID-specific primitives + the decision store ─────────────────────────
// Only the things the shared kit genuinely does not cover. Everything else on
// these screens is Card / PBtn / Field / StatTile / HDPill / HDTable / Sheet /
// EmptyState / hdToast, unchanged.
//
// Colour discipline for this whole module:
//   · zero hex literals — every colour is a token or HD.tone()/HD.hueColor()
//   · never `canvas` / `canvas2` — since the ramps were unified they are just
//     bg/bg2, so a panel that leaned on them for "raised" now vanishes. Structure
//     comes from surface/surface2/surface3, a hairline border, or shadowSm.
//   · accent at most once per view, and never for selection. Selection is ink.
;(function () {
  const useP = window.useP;
  const HD = () => window.HD;

  /* ══════════════════════ THE DECISION STORE ══════════════════════ */
  // C's argument, made structural: the handheld ASSERTS, the desk DECIDES.
  // Both surfaces render out of this one store, so approving a kit on the desk
  // changes what the device says about it, and every decision writes an audit
  // event that #/audit shows above the seeded history.

  const DecCtx = React.createContext(null);

  const INITIAL = {
    kit: { status: 'submitted', by: null, at: null, note: null },   // submitted → approved | rejected
    rescanRequested: false,
    stragglersClosed: {},          // epc → { reason, at }
    binding: { status: 'open', resolution: null, reason: null },    // open → rebound | kept
    gate: null,                    // null = default; a number = an override
    events: [],
  };

  window.RfidDecisionProvider = function RfidDecisionProvider({ children }) {
    const [st, setSt] = React.useState(INITIAL);
    const D = window.RFID_DATA;
    const ACTOR = 'Dara Okafor';

    const log = (ev) => ({ at: new Date(D.NOW + 1000).toISOString(), actor: ACTOR, live: true, ...ev });

    const api = React.useMemo(() => ({
      approveKit(note) {
        setSt((s) => ({ ...s, kit: { status: 'approved', by: ACTOR, at: D.NOW, note: note || null },
          events: [log({ action: 'KIT_APPROVED', subject: D.KIT.sessionId, tone: 'ok',
            detail: `${D.KIT_SUMMARY.assigned} units posted · ${D.KIT_SUMMARY.missingUnits} units carried as a kit exception` }), ...s.events] }));
      },
      rejectKit(reason) {
        setSt((s) => ({ ...s, kit: { status: 'rejected', by: ACTOR, at: D.NOW, note: reason },
          events: [log({ action: 'KIT_REJECTED', subject: D.KIT.sessionId, tone: 'blocked',
            detail: `sent back to ${D.KIT.device} for a full re-scan — ${reason}` }), ...s.events] }));
      },
      requestRescan() {
        setSt((s) => ({ ...s, rescanRequested: true,
          events: [log({ action: 'RESCAN_REQUESTED', subject: D.KIT.sessionId, tone: 'info',
            detail: `${D.KIT_SUMMARY.rescan} tags queued to ${D.KIT.device} for a close-range pass` }), ...s.events] }));
      },
      closeStragglers(epcs, reason) {
        setSt((s) => {
          const next = { ...s.stragglersClosed };
          epcs.forEach((e) => { next[e] = { reason, at: D.NOW }; });
          return { ...s, stragglersClosed: next,
            events: [log({ action: 'STRAGGLER_CLOSED_MISSING', subject: D.LIVE_COUNT.id, tone: 'warn',
              detail: `${epcs.length} unit${epcs.length === 1 ? '' : 's'} written off as missing — ${reason}` }), ...s.events] };
        });
      },
      resolveBinding(kind, reason) {
        setSt((s) => ({ ...s, binding: { status: kind, resolution: kind, reason },
          events: [log({
            action: kind === 'rebound' ? 'EPC_REBOUND' : 'BINDING_UPHELD',
            subject: D.COLLISION.auditEventId, tone: kind === 'rebound' ? 'warn' : 'ok',
            detail: kind === 'rebound'
              ? `${D.COLLISION.value} rebound to a new EPC — ${reason}`
              : `${D.COLLISION.value} kept its original EPC; the incoming label was voided — ${reason}`,
          }), ...s.events] }));
      },
      setGate(v, reason) {
        setSt((s) => ({ ...s, gate: v,
          events: [log({ action: 'GATE_OVERRIDE', subject: 'module defaults', tone: 'warn',
            detail: `confidence gate set to ${v} dBm (default ${D.CONFIDENCE_THRESHOLD}) — ${reason}` }), ...s.events] }));
      },
      reset() { setSt(INITIAL); },
    }), []);

    const gateValue = st.gate == null ? D.CONFIDENCE_THRESHOLD : st.gate;

    // RE-RUN THE ENGINE. The gate is the safety property this whole module rests on;
    // a control that visibly changes the number while changing nothing is the exact
    // shape of bug this estate keeps producing. reconcileKit is pure, so this is just
    // a memo over the same reads.
    const recon = React.useMemo(
      () => D.reconcileKit(D.KIT_READS, (e) => D.SKU_OF.get(e), D.KIT_PLAN, gateValue),
      [gateValue],
    );
    const baseline = React.useMemo(
      () => D.reconcileKit(D.KIT_READS, (e) => D.SKU_OF.get(e), D.KIT_PLAN, D.CONFIDENCE_THRESHOLD),
      [],
    );
    const units = (r) => Object.values(r.kitActual).reduce((a, b) => a + b, 0);
    const reconDelta = React.useMemo(() => ({
      rescan: recon.rescan.length - baseline.rescan.length,
      short: recon.short.length - baseline.short.length,
      excess: recon.excess.length - baseline.excess.length,
      wrongProduct: recon.wrongProduct.length - baseline.wrongProduct.length,
      moves: recon.moves.length - baseline.moves.length,
      assigned: units(recon) - units(baseline),
    }), [recon, baseline]);

    const value = React.useMemo(
      () => ({ ...st, ...api, gateValue, recon, baseline, reconDelta,
        // True when what is on screen was computed at a gate the session was NOT posted at.
        gateDiffersFromPosted: gateValue !== D.CONFIDENCE_THRESHOLD }),
      [st, api, gateValue, recon, baseline, reconDelta],
    );
    return <DecCtx.Provider value={value}>{children}</DecCtx.Provider>;
  };

  window.useDecisions = function useDecisions() { return React.useContext(DecCtx); };

  /* ══════════════════════ PAGE + TEXT ══════════════════════ */

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
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1, fontFamily: title.mono ? P.fontMono : P.fontSans, fontVariantNumeric: title.mono ? 'tabular-nums' : 'normal' }}>{title.text || title}</h1>
          {sub && <p style={{ margin: '5px 0 0', fontSize: 13.5, color: P.inkDim, maxWidth: 720, lineHeight: 1.45 }}>{sub}</p>}
          {meta && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{meta}</div>}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>{actions}</div>}
      </div>);
  };

  // Card section header — 15px/600 with an optional right slot.
  // The title is a real <h2>. Every page has exactly one <h1> (RfidPageHead)
  // and these screens are long; a screen reader's heading list is the only
  // outline they have. Styled to 15/600 with margin:0, so nothing moves.
  window.CardHead = function CardHead({ title, sub, right, style }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, ...style }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>{title}</h2>
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

  /* ══════════════════════ VALUE TOKENS ══════════════════════ */

  // EPC chip. Same grammar as UidChip, different namespace: an EPC is neither a
  // METRC package UID nor a Hyperdrive HUID, so it gets its own prefix rather
  // than being mislabelled as one of theirs. 24 hex chars is too wide for a
  // table cell, so it shows head…tail and expands on click.
  window.EpcChip = function EpcChip({ value, size = 'sm', expanded: expandedProp, muted }) {
    const P = useP();
    const [expanded, setExpanded] = React.useState(expandedProp ?? false);
    const [copied, setCopied] = React.useState(false);
    const c = muted ? P.inkMute : HD().hueColor(P, 'violet');
    const display = expanded ? value : window.RFID_DATA.shortEpc(value);
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
  // rescan→info. No new colour enters the system.
  const LINE_ICON = { correct: 'check-circle', short: 'arrow-down', excess: 'arrow-up', wrong: 'swap', rescan: 'help' };

  window.LinePill = function LinePill({ state, size = 'sm' }) {
    const P = useP(), D = window.RFID_DATA;
    const c = HD().tone(P, D.STATE_TONE[state]);
    const h = size === 'md' ? 24 : 20;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: h, padding: '0 8px', background: c.bg, color: c.fg, border: `1px solid ${P.hairline2}`, borderRadius: 99, fontSize: size === 'md' ? 11.5 : 10, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: P.fontSans }}>
        <Icon name={LINE_ICON[state]} size={11} stroke={2.2} />{D.STATE_LABEL[state]}
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

  // The mono style object, for the shared atoms that take a `style` prop
  // (HDPill, Pill) and whose label is a pure value rather than a sentence.
  window.monoStyle = (P) => ({ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' });

  // Inline numeral inside prose. Every number, ID, dBm, timestamp, percent and
  // SKU is mono with tabular-nums — including the ones that sit in a sentence.
  window.Mono = function Mono({ children, color }) {
    const P = useP();
    return <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: color || P.ink }}>{children}</span>;
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

  // Category swatch used as a row lead — the only decorative colour, from P.cat.
  // Opacity does the tinting so no alpha string is ever concatenated onto a token.
  window.CatDot = function CatDot({ cat, size = 34, label }) {
    const P = useP();
    const c = P.cat[cat] || P.cat.other;
    return (
      <span style={{ position: 'relative', width: size, height: size, borderRadius: P.r8, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: c, opacity: P.mode === 'dark' ? .22 : .13 }} />
        <span style={{ position: 'relative', color: c, fontFamily: P.fontMono, fontSize: Math.round(size * 0.34), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {label != null ? label : cat.slice(0, 2).toUpperCase()}
        </span>
      </span>);
  };

  /* ══════════════════════ CONTROLS ══════════════════════ */

  // Text for assistive tech only. Not `display:none` — that would remove it from
  // the accessibility tree, which is the one place it is meant to exist.
  window.SrOnly = function SrOnly({ children, live, as }) {
    const Tag = as || 'span';
    return <Tag aria-live={live} style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0, fontSize: 'inherit', fontWeight: 'inherit' }}>{children}</Tag>;
  };

  // A horizontally scrollable well for a wide table.
  //
  // A bare `overflow-x:auto` div is a keyboard trap in reverse: Chrome does not
  // put scroll containers in the tab order, so every column past the fold is
  // unreachable without a mouse. `tabIndex=0` + a name is the standard fix —
  // the container becomes one focusable stop that arrow keys then scroll.
  // `overflow-y: visible` is deliberately NOT set: a scroll container may not
  // mix visible and auto, and setting it would silently produce a second
  // vertical scroller.
  window.ScrollX = function ScrollX({ label, children, style }) {
    return (
      <div role="region" aria-label={label} tabIndex={0} style={{ overflowX: 'auto', ...style }}>
        {children}
      </div>);
  };

  // Checkbox with a name. The shared `Check` atom takes no props beyond
  // on/onChange/size, so a row-selection checkbox built from it announces as
  // "checkbox, not checked" and nothing else — on #/counts/:id that is eleven
  // identical unnamed controls gating a write-off decision. Same pixels, same
  // stopPropagation, plus the label it always needed.
  window.RfidCheck = function RfidCheck({ on, onChange, size = 20, label }) {
    const P = useP();
    return (
      <button data-hw-i type="button" role="checkbox" aria-checked={!!on} aria-label={label}
        onClick={(e) => { e.stopPropagation(); onChange(!on); }}
        style={{ width: size, height: size, borderRadius: 6, border: `1.5px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: '0 0 auto', transition: 'all .12s' }}>
        {on && <Icon name="check" size={size * 0.66} stroke={3} color={P.surface} />}
      </button>);
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

  window.RfidSelect = function RfidSelect({ value, onChange, options, label }) {
    const P = useP();
    return (
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', minHeight: P.ctrlH.md, padding: '0 11px', background: P.field, color: P.ink,
          border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8, fontSize: 13.5, fontFamily: P.fontSans, cursor: 'pointer' }}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>);
  };

  window.FormRow = function FormRow({ label, hint, children }) {
    const P = useP();
    return (
      <div>
        <MicroLabel style={{ marginBottom: 5 }}>{label}</MicroLabel>
        {children}
        {hint && <div style={{ marginTop: 5, fontSize: 11.5, color: P.inkMute, lineHeight: 1.45 }}>{hint}</div>}
      </div>);
  };

  /* ══════════════════════ METERS ══════════════════════ */

  // Coverage meter with the 98% pass bar drawn on it. The threshold is the
  // whole point of the number, so it is never left implicit.
  window.CoverageBar = function CoverageBar({ pct, height = 8, showValue = true }) {
    const P = useP();
    const pass = window.RFID_DATA.ROOM_PASS_COVERAGE * 100;
    const c = HD().tone(P, pct >= pass ? 'ok' : 'warn');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 60, height, background: P.surface3, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: c.fg, borderRadius: 99 }} />
          <div aria-hidden="true" title={`${pass}% pass bar`} style={{ position: 'absolute', top: -1, bottom: -1, left: `${pass}%`, width: 2, background: P.ink }} />
        </div>
        {showValue && <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: P.ink, minWidth: 46, textAlign: 'right' }}>{pct.toFixed(1)}%</span>}
      </div>);
  };

  // RF power scale. The setpoint is deliberately at the low end: reduced power
  // is half of why argmax can isolate one box, so the screen shows where in the
  // range we actually sit rather than just printing a number.
  window.PowerScale = function PowerScale({ value, min, max }) {
    const P = useP();
    const pct = (value - min) / (max - min) * 100;
    return (
      <div>
        <div style={{ position: 'relative', height: 8, borderRadius: 99, background: P.surface3, marginTop: 6 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: P.ink, borderRadius: 99 }} />
          <div style={{ position: 'absolute', left: `${pct}%`, top: -4, width: 3, height: 16, background: P.ink, borderRadius: 99, transform: 'translateX(-1.5px)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, fontVariantNumeric: 'tabular-nums' }}>
          <span>{min} dBm</span><span style={{ color: P.ink }}>{value} dBm · reduced</span><span>{max} dBm</span>
        </div>
      </div>);
  };

  /* ══════════════════════ DECISION UI ══════════════════════ */

  // Focus management for the two overlays in this module (ReasonModal and the
  // ⌘K palette). Escape already closed them; what was missing is the rest of
  // the contract — focus enters the dialog, Tab cannot leave it while it is
  // open, and focus returns to whatever opened it. Without the last part,
  // dismissing the approve-kit modal drops the caret back at the top of the
  // document, which on these screens is 30 tab stops from the button you
  // pressed.
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  window.useDialogFocus = function useDialogFocus(open, onClose) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const opener = document.activeElement;
      const node = ref.current;
      const first = node && node.querySelector(FOCUSABLE);
      if (first) first.focus();
      const h = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
        if (e.key !== 'Tab' || !node) return;
        const items = Array.prototype.filter.call(node.querySelectorAll(FOCUSABLE), (el) => el.offsetParent !== null);
        if (!items.length) return;
        const a = items[0], z = items[items.length - 1];
        const inside = node.contains(document.activeElement);
        if (e.shiftKey && (!inside || document.activeElement === a)) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && (!inside || document.activeElement === z)) { e.preventDefault(); a.focus(); }
      };
      document.addEventListener('keydown', h, true);
      return () => {
        document.removeEventListener('keydown', h, true);
        if (opener && opener.focus && document.contains(opener)) opener.focus();
      };
    }, [open, onClose]);
    return ref;
  };

  // The provenance tag that makes the two surfaces legibly one system: this
  // figure came off that device, held by that person, at that minute.
  window.FromDevice = function FromDevice({ who, when, device, label = 'asserted by' }) {
    const P = useP();
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 9px', borderRadius: 99, background: P.surface3, border: `1px solid ${P.hairline}`, color: P.inkDim, fontSize: 11.5, whiteSpace: 'nowrap' }}>
        <Icon name="smartphone" size={12} stroke={1.9} />
        <span style={{ color: P.inkMute }}>{label}</span>
        <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink2 }}>{device}</span>
        <span style={{ color: P.inkFaint }}>·</span>
        <span>{who}</span>
        <span style={{ color: P.inkFaint }}>·</span>
        <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{when}</span>
      </span>);
  };

  // Every irreversible decision in this module goes through here: a review
  // step, a typed reason, and a confirm that stays disabled until there is one.
  // HANDOFF: "destructive/irreversible actions require a review step or a typed
  // reason before the confirm button enables."
  window.ReasonModal = function ReasonModal({ open, onClose, title, body, confirmLabel, tone = 'warn', placeholder, onConfirm, minLength = 8 }) {
    const P = useP();
    const [reason, setReason] = React.useState('');
    React.useEffect(() => { if (open) setReason(''); }, [open]);
    const dialogRef = window.useDialogFocus(open, onClose);
    const titleId = React.useId ? React.useId() : 'rfid-reason-title';
    if (!open) return null;
    const ok = reason.trim().length >= minLength;
    const c = HD().tone(P, tone);
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 320, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim, animation: 'fade .16s ease' }} />
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ position: 'relative', width: 520, maxWidth: '92vw', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ color: c.fg, display: 'inline-flex' }}><Icon name="flag" size={16} stroke={2} /></span>
            <span id={titleId} style={{ fontSize: 15, fontWeight: 600, color: P.ink }}>{title}</span>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.55 }}>{body}</div>
            <div>
              <MicroLabel style={{ marginBottom: 5 }}>Reason — written to the audit log</MicroLabel>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={placeholder}
                style={{ width: '100%', padding: '9px 11px', background: P.field, color: P.ink, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.5, resize: 'vertical' }} />
              <div style={{ marginTop: 5, fontSize: 11.5, color: ok ? P.inkMute : HD().tone(P, 'warn').fg, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
                {reason.trim().length} / {minLength} characters minimum
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
            <PBtn size="sm" variant="ghost" onClick={onClose}>Cancel</PBtn>
            <PBtn size="sm" variant="accent" disabled={!ok} onClick={() => { onConfirm(reason.trim()); onClose(); }}>{confirmLabel}</PBtn>
          </div>
        </div>
      </div>);
  };
})();
