// ── idv/idv-shared.jsx ── window.IdvShared — composites built from atoms ───
// Every export here is assembled ONLY from pos/atoms.jsx + shared/states.jsx +
// shared/hd-ui.jsx (per the task brief) — no hex, no hand-rolled primitive
// duplicating what an atom already does. A Verify screen that needs a new
// shape adds a case here, not a private div tree of its own.
;(function () {
  const useP = window.useP;

  window.IdvShared = window.IdvShared || {};

  // ── NotConnected ────────────────────────────────────────────────────────
  // Same shape as IncShared.NotConnected (incentives/inc-shared.jsx L186-191),
  // own nouns, per scratch/idv-conventions-digest-2026-09-08.md §4.
  window.IdvShared.NotConnected = function NotConnected({ onRetry, compact }) {
    return (
      <ErrorState compact={compact} title="Verify isn't connected"
        body="Needs the wmdemo backend — not reachable right now. Sessions, reviews and lists will appear here once it connects."
        onRetry={onRetry} />);
  };

  // ── StatusPill ──────────────────────────────────────────────────────────
  // The ten Didit status literals (docs/IDV-API-CONTRACT.md "Common
  // fragments"), case-sensitive, mapped onto the shared Pill kinds exactly as
  // specified: Approved good, Declined bad, In Review/Awaiting User warn,
  // In Progress/Resubmitted info, Not Started/Abandoned/Expired/Kyc Expired
  // neutral. Tones themselves are not part of the contract (VerificationStatus
  // is a closed list of strings, not a list of {value,tone} pairs), so the
  // tone-per-status mapping stays hand-written here; only the KEY SET is
  // derived from window.HWContracts.enumValues('VerificationStatus') when
  // HWContracts is loaded, falling back to this same literal list otherwise
  // (the hosted capture page and some older pages never load contracts/).
  // A status the enum does not recognise still renders (as 'neutral', same
  // as always) — it is never dropped, only flagged, per below.
  const STATUS_TONE_BY_STATUS = {
    'Approved': 'good',
    'Declined': 'bad',
    'In Review': 'warn', 'Awaiting User': 'warn',
    'In Progress': 'info', 'Resubmitted': 'info',
    'Not Started': 'neutral', 'Abandoned': 'neutral', 'Expired': 'neutral', 'Kyc Expired': 'neutral',
  };
  const FALLBACK_STATUS_ENUM = ['Not Started', 'In Progress', 'Awaiting User', 'In Review', 'Approved',
    'Declined', 'Resubmitted', 'Abandoned', 'Expired', 'Kyc Expired'];
  const HWC = window.HWContracts;
  const STATUS_ENUM = (HWC && typeof HWC.enumValues === 'function')
    ? HWC.enumValues('VerificationStatus') : FALLBACK_STATUS_ENUM;
  const STATUS_TONE = {};
  STATUS_ENUM.forEach((s) => { STATUS_TONE[s] = STATUS_TONE_BY_STATUS[s] || 'neutral'; });
  window.IdvShared.STATUS_TONE = STATUS_TONE;

  // Dev-only, once-per-status: a status the API sends that is not in the
  // enum (contract's, or the fallback list when contracts/ is not loaded)
  // is a drift worth knowing about, never a reason to change what renders.
  const IS_DEV = typeof location !== 'undefined'
    && /^(127\.0\.0\.1|localhost)$/.test(location.hostname || '');
  const _warnedStatuses = {};
  function warnIfUnknownStatus(status) {
    if (!IS_DEV || !status || Object.prototype.hasOwnProperty.call(STATUS_TONE, status)
      || _warnedStatuses[status]) return;
    _warnedStatuses[status] = true;
    console.error('[IdvShared] status "' + status + '" from the API is not in the '
      + 'VerificationStatus enum');
  }
  window.IdvShared.StatusPill = function StatusPill({ status, size = 'sm' }) {
    warnIfUnknownStatus(status);
    return <Pill kind={STATUS_TONE[status] || 'neutral'} size={size} dot>{status || 'Unknown'}</Pill>;
  };

  // ── ReasonChips ─────────────────────────────────────────────────────────
  // Reason codes are a fixed string enum (docs/IDV-API-CONTRACT.md "Common
  // fragments" — review: LIVENESS_LOW, ... ; decline: DOC_EXPIRED, ...). This
  // renders each verbatim (never invents friendlier prose the backend did not
  // send) as a small mono ghost pill, wrapping.
  window.IdvShared.ReasonChips = function ReasonChips({ reasons, size = 'sm', style }) {
    const P = useP();
    if (!reasons || !reasons.length) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
        {reasons.map((r, i) => (
          <span key={i} title={r} style={{ display: 'inline-flex', alignItems: 'center', padding: size === 'sm' ? '2px 7px 3px' : '3px 8px 4px',
            background: 'transparent', color: P.inkDim, border: `1px solid ${P.hairline2}`, borderRadius: P.r999,
            fontSize: size === 'sm' ? 10 : 11.5, fontWeight: 600, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>
            {r}
          </span>))}
      </div>);
  };

  // ── ScorePill ───────────────────────────────────────────────────────────
  // `score` is either a plain number 0-100 or a Score object
  // { score, model, model_version, certified, caption }. The pill shows the
  // value (and the threshold, if given); the caption — e.g. "open model ·
  // uncertified" — prints VERBATIM next to it, exactly as the API contract
  // requires ("the UI prints caption verbatim") — it is never hard-coded or
  // reworded here, only relayed.
  window.IdvShared.ScorePill = function ScorePill({ score, threshold, size = 'sm' }) {
    const P = useP();
    const obj = score && typeof score === 'object' ? score : null;
    const value = obj ? obj.score : score;
    const caption = obj && obj.caption;
    const has = value != null;
    const tone = !has ? 'neutral' : (threshold != null ? (value >= threshold ? 'good' : 'bad') : 'neutral');
    const fmtScore = window.HWIdv ? window.HWIdv.fmt.score : (v) => (v == null ? '—' : Number(v).toFixed(1));
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Pill kind={tone} dot size={size}>
          {has ? fmtScore(value) : '—'}{threshold != null ? ` / ${fmtScore(threshold)}` : ''}
        </Pill>
        {obj && obj.model && (
          <span style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>{obj.model}{obj.model_version ? ` v${obj.model_version}` : ''}</span>
        )}
        {caption && <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{caption}</span>}
      </span>);
  };

  // ── MediaThumb ──────────────────────────────────────────────────────────
  // `media` is a Media row (docs/IDV-API-CONTRACT.md "Common fragments"):
  // { id, kind, mime, bytes, width, height, captured_at, source, url }.
  // Media is role-gated (`GET /api/idv/media/{id}`, no-store, audited), so
  // this tries the image and falls back to a labelled icon tile on any load
  // failure — never a broken-image glyph, never a silent blank box.
  const MEDIA_ICON = {
    document_front: 'card', document_back: 'card', selfie: 'user', selfie_frame: 'user',
    liveness_video: 'play', portrait_crop: 'user', challenge_frame: 'camera', import_pdf: 'scroll',
  };
  function kindLabel(kind) {
    if (!kind) return 'Media';
    return kind.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  window.IdvShared.MediaThumb = function MediaThumb({ media, size = 64 }) {
    const P = useP();
    const [failed, setFailed] = React.useState(false);
    const showImg = media && media.url && /^image\//.test(media.mime || '') && !failed;
    return (
      <div title={media ? `${kindLabel(media.kind)}${media.width ? ` · ${media.width}x${media.height}` : ''}` : 'Media'}
        style={{ width: size, height: size, borderRadius: P.r8, overflow: 'hidden', position: 'relative', flex: '0 0 auto',
          background: P.canvas2, border: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {showImg ? (
          <img src={media.url} alt={kindLabel(media && media.kind)} onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: P.inkMute }}>
            <Icon name={MEDIA_ICON[media && media.kind] || 'camera'} size={size * 0.32} stroke={1.6} />
            <span style={{ fontSize: 9, fontFamily: P.fontMono, color: P.inkFaint }}>{kindLabel(media && media.kind)}</span>
          </div>)}
      </div>);
  };

  // ── EngineBadge ─────────────────────────────────────────────────────────
  // Polls `/api/idv/engine/health` (EngineHealth shape, docs/IDV-API-CONTRACT
  // .md) and renders exactly the three states plan §5.4 requires: backend
  // down (no HWIdv seam / request failed outright), engine down (backend
  // answered but `ok:false`), or ok with the engine's real version.
  window.IdvShared.EngineBadge = function EngineBadge({ ms = 20000, size = 'sm' }) {
    // usePoll is a HOOK — it calls useState/useRef/useEffect/useCallback
    // internally — so it must be called unconditionally, in the same order,
    // on every render. The previous `window.HWIdv ? usePoll(...) : {...}`
    // ternary skipped that call entirely on any render where HWIdv read as
    // falsy and started calling it on a later render, which is exactly what
    // produces React's "Rendered fewer hooks than expected than during the
    // previous render" error. Script load order (Hyperwolf Verify.html loads
    // idv-client.jsx, which sets window.HWIdv, before idv-shared.jsx or any
    // screen) guarantees HWIdv already exists by the time this ever mounts —
    // every other window.HWIdv.usePoll call site in this codebase (e.g.
    // screen-integrate.jsx's EnginePanel) already calls it unguarded.
    const poll = window.HWIdv.usePoll('/api/idv/engine/health', ms);

    // Three states (plan §5.4 / docs/IDV-API-CONTRACT.md), told apart by the
    // 503 EngineHealth BODY now surviving a non-2xx response (idv-client.jsx
    // usePoll keeps `r.body` on `!r.ok` instead of discarding it):
    //   1. backend unreachable — network failure or no live seam at all:
    //      poll.error is set and no usable body ever arrived.
    //   2. backend ok, engine ok:false — the body itself says so (503).
    //   3. ok — the body says ok:true, show its version.
    let tone = 'neutral', icon = 'clock', label = 'Checking engine…';
    if (poll.data && poll.data.ok === false) {
      tone = 'warn'; icon = 'zap'; label = 'Engine not reachable';
    } else if (poll.data && poll.data.ok) {
      tone = 'good'; icon = 'check-circle';
      label = 'Engine ok' + (poll.data.version ? ` · v${poll.data.version}` : '');
    } else if (poll.error) {
      tone = 'neutral'; icon = 'plug'; label = 'Backend not connected';
    } else if (!poll.loading) {
      tone = 'neutral'; icon = 'plug'; label = 'Backend not connected';
    }
    return <Pill kind={tone} dot icon={icon} size={size} title={label}>{label}</Pill>;
  };

  // ── ImportedTag ─────────────────────────────────────────────────────────
  // Session-level honesty label (plan §5.3): imported Didit history is marked
  // and never silently blends into engine-accuracy panels.
  window.IdvShared.ImportedTag = function ImportedTag({ date, size = 'sm' }) {
    const fmtDate = window.HWIdv ? window.HWIdv.fmt.date : (d) => d;
    const label = date ? `Verified by Didit, imported ${fmtDate(date)}` : 'Verified by Didit, imported';
    return <Pill kind="neutral" size={size} icon="download">{label}</Pill>;
  };

  // ── Skeleton wrappers ───────────────────────────────────────────────────
  // Shaped placeholders built on shared/states.jsx's Skeleton/SkeletonRows,
  // for the two container shapes Verify screens repeat most: a detail Card
  // and a table-shaped list.
  window.IdvShared.SkeletonCard = function SkeletonCard({ lines = 3, style }) {
    return <Card elevation="flat" style={style}><Skeleton lines={lines} h={11} gap={8} /></Card>;
  };
  window.IdvShared.SkeletonTable = function SkeletonTable({ rows = 5, style }) {
    return <SkeletonRows rows={rows} avatar={false} style={style} />;
  };
})();
