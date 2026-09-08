// ── incentives/inc-shared.jsx ── window.IncShared — composites built from atoms ─
// Every export here is assembled ONLY from pos/atoms.jsx + shared/states.jsx +
// Icon — no hex, no hand-rolled primitive that duplicates what an atom already
// does. A Bounty screen that needs a new shape adds a case here, not a private
// div tree of its own; that is what keeps the module honest about "atoms only".
;(function () {
  const useP = window.useP;

  window.IncShared = window.IncShared || {};

  // ── SourceFreshness ─────────────────────────────────────────────────────
  // Renders exactly the per-source line the plan (§5.3) specifies, from a
  // `sources` array shaped like inc_ingest_runs / inc_sync_cursors:
  //   { source, store, status: 'ok'|'warn'|'bad'|'off', synced_at,
  //     count_today, last_error, last_upload, format, lines }
  // The four verbatim examples this mirrors:
  //   "Blaze API · Corona · synced 2m ago · 143 sales today"
  //   "Meadow API · West Hollywood · last error 14:02: 401 (client key)"
  //   "Blaze CSV · Lake Elsinore · last upload 2026-09-05 (All Sales, 1,204 lines)"
  //   "never synced"
  function freshnessLine(HD, s) {
    const rel = (iso) => (HD ? HD.relativeTime(iso) : iso);
    const label = [s.source, s.store].filter(Boolean).join(' · ');
    if (s.last_error) return `${label} · last error ${s.last_error}`;
    if (s.last_upload) {
      const detail = s.format ? ` (${s.format}${s.lines != null ? `, ${HD ? HD.formatNumber(s.lines) : s.lines} lines` : ''})` : '';
      return `${label} · last upload ${s.last_upload}${detail}`;
    }
    if (s.synced_at) {
      const count = s.count_today != null ? ` · ${HD ? HD.formatNumber(s.count_today) : s.count_today} sales today` : '';
      return `${label} · synced ${rel(s.synced_at)}${count}`;
    }
    return label ? `${label} · never synced` : 'never synced';
  }

  // The API contract's `Source` (docs/BOUNTY-API-CONTRACT.md, "Common
  // fragments") is accepted natively: `configured`/`last_ok_at`/`today`/`stale`
  // are mapped here, once, so no screen carries its own adapter. The older
  // display shape ({status, synced_at, count_today, last_upload}) still works.
  const SOURCE_LABEL = { 'blaze-api': 'Blaze API', 'meadow-api': 'Meadow API', 'blaze-csv': 'Blaze CSV',
    'meadow-csv': 'Meadow CSV', 'hwpos': 'Register' };
  function fromContract(s) {
    if (!s || !('configured' in s || 'last_ok_at' in s)) return s;
    const isCsv = /-csv$/.test(s.source || '');
    let status = 'off';
    if (s.last_error) status = 'bad';
    else if (s.stale) status = 'warn';
    else if (s.last_ok_at) status = 'ok';
    const errAt = s.last_error_at ? new Date(s.last_error_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ': ' : '';
    return {
      source: SOURCE_LABEL[s.source] || s.source, store: s.store_name || s.store_id, status,
      synced_at: s.last_ok_at || null,
      count_today: s.today ? (isCsv ? s.today.lines : s.today.txns) : null,
      last_error: s.last_error ? errAt + s.last_error : (s.configured === false && !isCsv ? 'not configured — no key' : null),
    };
  }

  window.IncShared.SourceFreshness = function SourceFreshness({ sources, style }) {
    const P = useP();
    const HD = window.HD;
    sources = (sources || []).map(fromContract);
    if (!sources || !sources.length) {
      return <div style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono, ...style }}>never synced</div>;
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '9px 13px',
        background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, ...style }}>
        {sources.map((s, i) => {
          const dot = s.status === 'ok' ? P.good : s.status === 'warn' ? P.warnText : s.status === 'bad' ? P.bad : P.inkFaint;
          const color = s.status === 'bad' ? P.bad : s.status === 'warn' ? P.warnText : P.inkDim;
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: P.type.meta, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: dot, flex: '0 0 auto' }} />
              {freshnessLine(HD, s)}
            </span>);
        })}
      </div>);
  };

  // ── InboxRow ────────────────────────────────────────────────────────────
  // pos/screen-home.jsx's "Needs attention" row, promoted to a standalone
  // composite for the manager console's inbox column (Concept D): 30px icon
  // plate · 12.5px/600 label · a right-aligned action in P.info, exactly that
  // row's shape and colour so the console's inbox reads as the same idea as
  // Home's "Needs attention" card, not a new one.
  window.IncShared.InboxRow = function InboxRow({ icon = 'alert', title, sub, actionLabel, onAction, active, onClick, tone }) {
    const P = useP();
    const iconColor = tone === 'bad' ? P.bad : tone === 'warn' ? P.warnText : tone === 'good' ? P.good : P.inkDim;
    return (
      <div data-hw-i onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', minHeight: 52,
          borderBottom: `1px solid ${P.hairline}`, background: active ? P.surface : 'transparent',
          boxShadow: active ? `inset 2px 0 0 ${P.accent}` : 'none', cursor: onClick ? 'pointer' : 'default' }}>
        <span style={{ width: 30, height: 30, borderRadius: P.r8, background: P.surface3, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name={icon} size={15} stroke={1.8} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: P.type.body, fontWeight: 600, color: P.ink, lineHeight: 1.35 }}>{title}</span>
          {sub && <span style={{ display: 'block', fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{sub}</span>}
        </span>
        {actionLabel && (
          <button data-hw-i type="button" onClick={(e) => { e.stopPropagation(); onAction && onAction(); }}
            style={{ fontSize: P.type.meta, fontWeight: 700, color: P.info, background: 'transparent', border: 'none',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            {actionLabel}<Icon name="chevron-right" size={13} stroke={2} />
          </button>)}
      </div>);
  };

  // ── ProgressRow ─────────────────────────────────────────────────────────
  // Concept D's `.prow`: a title/value line, a BarMeter, and a mono caption
  // underneath. Used by "My bounties" in the budtender seat and anywhere else
  // a list item is a current value against a target.
  window.IncShared.ProgressRow = function ProgressRow({ title, valueLabel, pct, color, sub, style }) {
    const P = useP();
    return (
      <div style={{ padding: '12px 13px', borderTop: `1px solid ${P.hairline}`, ...style }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
          {valueLabel != null &&
            <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: P.type.body, fontWeight: 600, color: P.ink2 }}>{valueLabel}</span>}
        </div>
        <BarMeter value={pct == null ? 0 : pct} max={1} color={color || P.info} height={9} />
        {sub && <div style={{ marginTop: 6, fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
      </div>);
  };

  // ── StatusPill ──────────────────────────────────────────────────────────
  // The bounty state machine (plan §3.4: draft -> pending_approval -> active
  // -> ended -> settled, plus cancelled) mapped onto the shared Pill kinds, so
  // a status never grows a colour scheme of its own.
  const STATUS_KIND = {
    draft: 'neutral', pending_approval: 'warn', active: 'good',
    ended: 'neutral', settled: 'info', cancelled: 'bad',
  };
  const STATUS_LABEL = {
    draft: 'Draft', pending_approval: 'Needs approval', active: 'Active',
    ended: 'Ended', settled: 'Settled', cancelled: 'Cancelled',
  };
  window.IncShared.StatusPill = function StatusPill({ status, size = 'sm' }) {
    return <Pill kind={STATUS_KIND[status] || 'neutral'} size={size} dot>{STATUS_LABEL[status] || status || 'Unknown'}</Pill>;
  };

  // ── NotConnected ────────────────────────────────────────────────────────
  // The estate's ErrorState with Bounty's own wording (the AOV pattern: never
  // fall back to a fixture number when the backend is unreachable -- say so,
  // plainly, in the place the real content would have been).
  window.IncShared.NotConnected = function NotConnected({ onRetry, compact }) {
    return (
      <ErrorState compact={compact} title="Bounty isn't connected"
        body="Needs the wmdemo backend — not reachable right now. Standings, bounties and earnings will appear here once it connects."
        onRetry={onRetry} />);
  };
})();
