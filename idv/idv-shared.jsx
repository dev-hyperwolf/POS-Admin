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
  // neutral.
  const STATUS_TONE = {
    'Approved': 'good',
    'Declined': 'bad',
    'In Review': 'warn', 'Awaiting User': 'warn',
    'In Progress': 'info', 'Resubmitted': 'info',
    'Not Started': 'neutral', 'Abandoned': 'neutral', 'Expired': 'neutral', 'Kyc Expired': 'neutral',
  };
  window.IdvShared.STATUS_TONE = STATUS_TONE;
  window.IdvShared.StatusPill = function StatusPill({ status, size = 'sm' }) {
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
    const poll = window.HWIdv ? window.HWIdv.usePoll('/api/idv/engine/health', ms) : { loading: false, error: 'no-live-seam', data: null };
    let tone = 'neutral', icon = 'clock', label = 'Checking engine…';
    if (poll.error) {
      tone = 'neutral'; icon = 'plug'; label = 'Backend not connected';
    } else if (poll.loading && !poll.data) {
      tone = 'neutral'; icon = 'clock'; label = 'Checking engine…';
    } else if (poll.data && poll.data.ok === false) {
      tone = 'warn'; icon = 'zap'; label = 'Engine not reachable';
    } else if (poll.data && poll.data.ok) {
      tone = 'good'; icon = 'check-circle';
      label = 'Verify engine' + (poll.data.version ? ` · v${poll.data.version}` : '');
    } else {
      tone = 'neutral'; icon = 'plug'; label = 'Backend not connected';
    }
    return <Pill kind={tone} dot icon={icon} size={size} title={label}>{label}</Pill>;
  };

  // ── ImportedTag ─────────────────────────────────────────────────────────
  // Session-level honesty label (plan §5.3): imported Didit history is marked
  // and never silently blends into engine-accuracy panels.
  window.IdvShared.ImportedTag = function ImportedTag({ date, size = 'sm' }) {
    const fmtDate = window.HWIdv ? window.HWIdv.fmt.date : (d) => d;
    return <Pill kind="neutral" size={size} icon="download">{`Verified by Didit, imported ${fmtDate(date)}`}</Pill>;
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
