// ── Pipeline UI primitives ────────────────────────────────────────────────
// The Hyperdrive-specific pieces the POS atom set doesn't cover: tone-aware
// status pills, stat tiles, UID chips, the multi-select filter chip, the
// right-hand sheet and the toast host. Everything reads live theme tokens.
;(function () {
  const useP = window.useP;
  const HD = () => window.HD;

  const TONE_ICON = { ok: 'check-circle', warn: 'flag', blocked: 'x', quarantine: 'shield', sealing: 'shield', info: 'clock', brand: 'flag', archived: 'clock', neutral: 'clock' };

  // Status pill. HD's tone/label API is now ALSO accepted by window.Pill, so
  // new code can use either; this stays as the Engage-shaped entry point.
  window.HDPill = function HDPill({ tone: t = 'neutral', label, children, icon = true, size = 'md', title, style }) {
    const P = useP();
    const c = HD().tone(P, t);
    const h = size === 'sm' ? 20 : 24;
    return (
      <span title={title || label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: h, maxWidth: 220, padding: size === 'sm' ? '0 6px' : '0 9px', background: c.bg, color: c.fg, border: `1px solid ${c.fg}44`, borderRadius: 99, fontSize: size === 'sm' ? 10 : 11.5, fontWeight: 500, whiteSpace: 'nowrap', fontFamily: P.fontSans, ...style }}>
        {icon && <Icon name={TONE_ICON[t] || 'clock'} size={11} stroke={2} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label ?? children}</span>
      </span>);
  };

  // Stat tile — surface + 3px colored top strip + hue wash + icon chip.
  window.StatTile = function StatTile({ icon, label, value, sub, hue = 'info', progress, onClick, style }) {
    const P = useP();
    const c = ['ok', 'warn', 'blocked', 'info', 'quarantine', 'sealing', 'archived', 'brand'].includes(hue)
      ? HD().tone(P, hue) : { fg: HD().hueColor(P, hue), bg: HD().hueColor(P, hue) + (P.mode === 'dark' ? '14' : '10') };
    return (
      <div onClick={onClick} style={{ position: 'relative', overflow: 'hidden', borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface, boxShadow: P.shadowSm, cursor: onClick ? 'pointer' : 'default', ...style }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: c.fg }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: c.bg, opacity: P.mode === 'dark' ? .5 : .45 }} />
        <div style={{ position: 'relative', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', color: P.inkMute }}>{label}</div>
            {icon && <span style={{ display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: c.fg + '26', color: c.fg, flex: '0 0 auto' }}><Icon name={icon} size={14} stroke={1.9} /></span>}
          </div>
          <div style={{ marginTop: 6, fontSize: 30, lineHeight: 1, fontWeight: 500, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          {typeof progress === 'number' && (
            <div style={{ marginTop: 10, height: 6, width: '100%', borderRadius: 99, background: P.hairline2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: c.fg, width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
            </div>)}
          {sub && <div style={{ marginTop: 6, fontSize: 12.5, color: P.inkDim }}>{sub}</div>}
        </div>
      </div>);
  };

  // DEPRECATED alias — the shared EmptyState is the one implementation now.
  // Kept so Engage screens don't have to change in one go.
  window.HDEmpty = function HDEmpty(props) {
    return window.EmptyState ? <window.EmptyState {...props} /> : null;
  };

  // UID chip — METRC blue / HUID gold, click to expand, copy when expanded.
  window.UidChip = function UidChip({ value, kind: kindProp = 'auto', expanded: expandedProp, size = 'sm', showPrefix = true, onClickBehavior = 'expand', style }) {
    const P = useP();
    const kind = kindProp === 'auto' ? HD().uidKind(value) : kindProp;
    const [expanded, setExpanded] = React.useState(expandedProp ?? false);
    const [copied, setCopied] = React.useState(false);
    const c = kind === 'metrc' ? P.info : (P.mode === 'dark' ? P.accent : P.accentBorder);
    const display = expanded ? value.toUpperCase() : HD().uidShort(value, kind);
    const doCopy = (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(value).catch(() => {});
      setCopied(true); window.hdToast?.({ title: 'Copied', description: value, tone: 'ok' });
      setTimeout(() => setCopied(false), 1500);
    };
    return (
      <button type="button" title={`${value.toUpperCase()} · ${kind === 'metrc' ? 'METRC package UID · state-issued' : 'Hyperdrive HUID · internal'}`}
        onClick={(e) => { if (onClickBehavior === 'copy') doCopy(e); else setExpanded((v) => !v); }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: size === 'md' ? 28 : 24, padding: '0 6px', borderRadius: 7, border: `1px solid ${c}4d`, background: c + (P.mode === 'dark' ? '1f' : '14'), color: c, fontFamily: P.fontMono, fontSize: size === 'md' ? 12.5 : 11.5, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', ...style }}>
        {showPrefix && <span style={{ borderRadius: 3, padding: '1px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', background: c + '26' }}>{kind === 'metrc' ? 'METRC' : 'HWID'}</span>}
        <span>{display}</span>
        {expanded && <span onClick={doCopy} style={{ opacity: .75, display: 'inline-flex' }}><Icon name={copied ? 'check' : 'copy'} size={11} stroke={2} /></span>}
      </button>);
  };

  // Multi-select dropdown chip used across the filter bars.
  window.MultiSelectFilter = function MultiSelectFilter({ label, options, value, onChange, align = 'start' }) {
    const P = useP();
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const active = value.length > 0;
    const summary = value.length === 0 ? label : value.length === 1 ? `${label}: ${options.find((o) => o.id === value[0])?.label ?? value[0]}` : `${label} · ${value.length}`;
    const toggle = (id) => (value.includes(id) ? onChange(value.filter((v) => v !== id)) : onChange([...value, id]));
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Filter by ${label}${value.length ? `, ${value.length} selected` : ''}`}
          style={{ height: 30, padding: '0 11px', borderRadius: 99, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap',
            background: active ? P.highlightSoft : 'transparent', color: active ? P.ink : P.inkDim, border: `1px solid ${active ? P.hairline3 : P.hairline2}` }}>
          <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
          {active
            ? <span role="button" tabIndex={0} aria-label={`Clear ${label} filter`} onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 99, marginRight: -3 }}><Icon name="x" size={10} stroke={2.4} /></span>
            : <Icon name="chevron-down" size={12} stroke={2} style={{ opacity: .6 }} />}
        </button>
        {open && (
          <div style={{ position: 'absolute', zIndex: P.z.dropdown, top: 36, [align]: 0, minWidth: 210, maxHeight: 320, overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, boxShadow: P.shadowLg, padding: 4 }}>
            <div style={{ padding: '6px 8px', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{label}</span>
              {active && <button onClick={() => onChange([])} style={{ background: 'none', border: 'none', color: P.inkDim, fontSize: 10, textTransform: 'none', letterSpacing: 0, textDecoration: 'underline', cursor: 'pointer', fontFamily: P.fontSans }}>Clear</button>}
            </div>
            {options.length === 0 && <div style={{ padding: '8px', fontSize: 12.5, color: P.inkMute }}>No options.</div>}
            {options.map((o) => {
              const checked = value.includes(o.id);
              return (
                <button key={o.id} onClick={() => toggle(o.id)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: P.ink, fontFamily: P.fontSans, textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: `1px solid ${checked ? P.ink : P.hairline3}`, background: checked ? P.ink : 'transparent', color: P.surface, flex: '0 0 auto' }}>
                    {checked && <Icon name="check" size={11} stroke={3} />}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                </button>);
            })}
          </div>)}
      </div>);
  };

  // Right-hand sheet / drawer.
  window.Sheet = function Sheet({ open, onClose, side = 'right', width = 460, children }) {
    const P = useP();
    React.useEffect(() => {
      if (!open) return;
      const h = (e) => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', h);
      return () => document.removeEventListener('keydown', h);
    }, [open, onClose]);
    if (!open) return null;
    const isBottom = side === 'bottom';
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: P.z.modal, display: 'flex', justifyContent: isBottom ? 'center' : 'flex-end', alignItems: isBottom ? 'flex-end' : 'stretch' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim, animation: 'fade .16s ease' }} />
        <div style={{ position: 'relative', width: isBottom ? '100%' : width, maxWidth: '100%', maxHeight: isBottom ? '85vh' : '100%', background: P.surface, borderLeft: isBottom ? 'none' : `1px solid ${P.hairline2}`, borderTop: isBottom ? `1px solid ${P.hairline2}` : 'none', boxShadow: P.shadowLg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>);
  };

  // Toast host — window.hdToast({ title, description, tone, action }).
  window.ToastHost = function ToastHost() {
    const P = useP();
    const [items, setItems] = React.useState([]);
    React.useEffect(() => {
      window.hdToast = (t) => {
        const id = Math.random().toString(36).slice(2);
        setItems((prev) => [...prev, { ...t, id }]);
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4200);
      };
      return () => { delete window.hdToast; };
    }, []);
    return (
      <div data-hw-chrome="toast" style={{ position: 'fixed', right: 16, bottom: 72, zIndex: P.z.toast, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', pointerEvents: 'none' }}>
        {items.map((t) => {
          const c = HD().tone(P, t.tone || 'neutral');
          return (
            <div key={t.id} style={{ pointerEvents: 'auto', minWidth: 260, maxWidth: 380, background: P.surface, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c.fg}`, borderRadius: P.r10, boxShadow: P.shadowMd, padding: '10px 12px', animation: 'fade .16s ease' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{t.title}</div>
              {t.description && <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2 }}>{t.description}</div>}
              {t.action && <button onClick={() => { t.action.onClick?.(); setItems((prev) => prev.filter((x) => x.id !== t.id)); }} style={{ marginTop: 7, background: 'none', border: 'none', padding: 0, color: P.ink, fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontFamily: P.fontSans }}>{t.action.label}</button>}
            </div>);
        })}
      </div>);
  };

  // Table primitives — 34px compact rows, uppercase micro-label heads.
  //
  // MOBILE-READINESS-AUDIT-2026-09-17 §3 shared fix #1: half the estate's
  // HDTable callers wrapped it in `overflowX:auto` themselves and half forgot
  // to, so a table either scrolled or silently compressed illegibly depending
  // on which screen you were on. HDTable now wraps ITSELF by default — the
  // `noWrap` prop is the escape hatch for a caller that already supplies its
  // own scroll container (own padding/maxHeight/etc. around the wrapper), so
  // it doesn't get a second nested scrollbar. `minWidth` lets a caller pin an
  // exact figure; left unset, it is derived from the table's own header-cell
  // count (`_minWidthForCols`) via `_colCount`, so a table that compresses to
  // mush at 390px instead scrolls at a legible width.
  //
  // `stackBelow` (px) is opt-in: below that CONTAINER width (measured with a
  // ResizeObserver on the wrapper itself, never window/viewport — a table
  // nested in a narrow sidebar should stack even on a wide screen) each row
  // renders as a labelled card instead of scrolling. No ResizeObserver in this
  // runtime -> `_shouldStack` is never asked and the table just scrolls, which
  // is always correct, only less pretty.
  function minWidthForCols(n) {
    const cols = Number(n) || 0;
    if (cols <= 0) return 480;
    return Math.max(480, Math.min(1600, cols * 120 + 40));
  }
  function shouldStack(width, stackBelow) {
    if (!stackBelow || typeof width !== 'number' || !(width > 0)) return false;
    return width < stackBelow;
  }
  function colCountInNode(node) {
    if (!node || typeof node !== 'object' || !node.props) return 0;
    if (node.type === 'tr') {
      return React.Children.toArray(node.props.children).reduce((total, cell) => total + ((cell && cell.props && cell.props.colSpan) || 1), 0);
    }
    for (const kid of React.Children.toArray(node.props.children || [])) {
      const n = colCountInNode(kid);
      if (n) return n;
    }
    return 0;
  }
  function colCount(children) {
    try {
      for (const node of React.Children.toArray(children)) {
        const n = colCountInNode(node);
        if (n) return n;
      }
    } catch (e) { /* best-effort only — falls back to the default min-width */ }
    return 0;
  }
  // Renders each `<tr>` (from a `<thead>`/`<tbody>` pair, or bare) as a
  // bordered card: one label/value line per cell, taking the label from the
  // matching `<TH>` at the same index. A `colSpan>1` cell (an empty-state row,
  // a section divider) is never labelled — it just spans the card full width,
  // same as it would span the table.
  function stackedCards(children, P) {
    const sections = React.Children.toArray(children);
    const headLabels = [];
    const bodyRows = [];
    sections.forEach((sec) => {
      if (!sec || !sec.props) return;
      if (sec.type === 'thead') {
        React.Children.toArray(sec.props.children).forEach((tr) => {
          if (tr && tr.props) React.Children.toArray(tr.props.children).forEach((th) => headLabels.push(th && th.props ? th.props.children : null));
        });
      } else if (sec.type === 'tbody') {
        React.Children.toArray(sec.props.children).forEach((tr) => { if (tr && tr.type === 'tr') bodyRows.push(tr); });
      } else if (sec.type === 'tr') {
        bodyRows.push(sec);
      }
    });
    return bodyRows.map((tr, i) => {
      const cells = React.Children.toArray(tr.props.children);
      const onClick = tr.props.onClick;
      return (
        <div key={tr.key ?? i} onClick={onClick} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 12px', marginBottom: 8, background: P.surface, cursor: onClick ? 'pointer' : 'default', minHeight: onClick ? 44 : undefined }}>
          {cells.map((cell, ci) => {
            if (!cell || !cell.props) return null;
            if (cell.props.colSpan > 1) return <div key={ci} style={{ padding: '4px 0' }}>{cell.props.children}</div>;
            const label = headLabels[ci];
            return (
              <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '4px 0', borderBottom: ci < cells.length - 1 ? `1px solid ${P.hairline}` : 'none', fontSize: 13.5 }}>
                {label ? <span style={{ color: P.inkMute, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em', flex: '0 0 auto' }}>{label}</span> : <span />}
                <span style={{ color: P.ink, textAlign: 'right', fontFamily: cell.props.mono ? P.fontMono : 'inherit' }}>{cell.props.children}</span>
              </div>);
          })}
        </div>);
    });
  }
  window.HDTable = function HDTable({ children, style, minWidth, noWrap, stackBelow }) {
    const P = useP();
    const wrapRef = React.useRef(null);
    const [stacked, setStacked] = React.useState(false);
    React.useEffect(() => {
      if (!stackBelow || noWrap) { setStacked(false); return undefined; }
      const el = wrapRef.current;
      if (!el || typeof ResizeObserver === 'undefined') { setStacked(false); return undefined; } // no-RO fallback: scroll only, never stack
      const ro = new ResizeObserver((entries) => {
        const w = entries[0] && entries[0].contentRect && entries[0].contentRect.width;
        if (typeof w === 'number') setStacked(shouldStack(w, stackBelow));
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [stackBelow, noWrap]);

    if (noWrap) {
      const mw = minWidth != null ? minWidth : minWidthForCols(colCount(children));
      return <table style={{ width: '100%', minWidth: mw, fontSize: 13.5, borderCollapse: 'separate', borderSpacing: 0, fontFamily: P.fontSans, ...style }}>{children}</table>;
    }
    if (stackBelow && stacked) {
      return <div ref={wrapRef}>{stackedCards(children, P)}</div>;
    }
    const mw = minWidth != null ? minWidth : minWidthForCols(colCount(children));
    return (
      <div ref={wrapRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
        <table style={{ width: '100%', minWidth: mw, fontSize: 13.5, borderCollapse: 'separate', borderSpacing: 0, fontFamily: P.fontSans, ...style }}>{children}</table>
      </div>);
  };
  window.HDTable._minWidthForCols = minWidthForCols;
  window.HDTable._shouldStack = shouldStack;
  window.HDTable._colCount = colCount;
  window.TH = function TH({ children, align = 'left', width, style, onClick }) {
    const P = useP();
    return <th onClick={onClick} style={{ textAlign: align, fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, padding: '9px 12px', borderBottom: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap', width, cursor: onClick ? 'pointer' : 'default', ...style }}>{children}</th>;
  };
  window.TD = function TD({ children, align = 'left', mono, style, colSpan }) {
    const P = useP();
    return <td colSpan={colSpan} style={{ textAlign: align, padding: '9px 12px', borderBottom: `1px solid ${P.hairline}`, verticalAlign: 'middle', color: P.ink, fontFamily: mono ? P.fontMono : 'inherit', fontVariantNumeric: mono ? 'tabular-nums' : 'normal', ...style }}>{children}</td>;
  };
  window.TR = function TR({ children, onClick, style }) {
    const P = useP();
    return <tr onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...(onClick ? { minHeight: 44 } : null), ...style }}
      onMouseEnter={(e) => (e.currentTarget.style.background = (style && style.background && style.background !== 'transparent') ? style.background : P.surface2)} onMouseLeave={(e) => (e.currentTarget.style.background = (style && style.background) || 'transparent')}>{children}</tr>;
  };
  window.SortableTH = function SortableTH({ label, k, sort, onSort, align }) {
    const active = sort.key === k;
    return (
      <TH align={align}>
        <button type="button" onClick={() => onSort(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer' }}>
          <span>{label}</span>
          <Icon name={active ? (sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'} size={11} stroke={2} style={{ opacity: active ? 1 : .4 }} />
        </button>
      </TH>);
  };

  // Uppercase micro-label used above value blocks.
  window.MicroLabel = function MicroLabel({ children, align, style }) {
    const P = useP();
    return <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, textAlign: align, ...style }}>{children}</div>;
  };
  window.MetaCell = function MetaCell({ label, value, mono }) {
    const P = useP();
    return (
      <div>
        <MicroLabel>{label}</MicroLabel>
        <div style={{ marginTop: 2, fontSize: 13.5, color: P.ink, fontFamily: mono ? P.fontMono : 'inherit', fontVariantNumeric: mono ? 'tabular-nums' : 'normal', wordBreak: 'break-word' }}>{value}</div>
      </div>);
  };

  // Display number — the big tabular metric used in page headers.
  window.DisplayNum = function DisplayNum({ children, size = 22, style }) {
    const P = useP();
    return <div style={{ fontSize: size, lineHeight: 1.1, fontWeight: 500, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', ...style }}>{children}</div>;
  };
})();
