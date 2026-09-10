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

  // ── PinGate ─────────────────────────────────────────────────────────────
  // THE FULL-SCREEN CARD IN FRONT OF THE CONSOLE. Rendered by idv/app.jsx in
  // place of the routed frame whenever the backend says `gated && !ok`
  // (wmdemo/idv_api.py `require_console`, GET /api/idv/auth/status).
  //
  // WHAT IT SAYS AND WHAT IT DOES NOT. One sentence, no jargon, and no hex or
  // token anywhere on screen: the person in front of this is an associate at a
  // counter, and the only thing they can do about it is type six digits. It
  // does not say WHY the console is gated, does not name the environment
  // variable, does not print the token it just received, and does not offer a
  // "forgot the PIN" path — there is nothing behind such a link (the PIN lives
  // in the server's environment and only the owner can change it), and a
  // dead-end link is worse than its absence.
  //
  // THE ERROR LINE RELAYS THE SERVER'S OWN SENTENCE. Three refusals reach it
  // and they are genuinely different problems, so none of them is flattened
  // into "that failed":
  //   403 wrong PIN     -> "That PIN is not right." (the server's words)
  //   429 too many      -> the server's wait-a-minute sentence
  //   503 not set up    -> "Console PIN is not configured on this server."
  //                        Typing harder cannot fix that one, so the field is
  //                        left alone and the sentence stands as-is; it is
  //                        addressed to whoever owns the deployment.
  // The one sentence this file writes itself is for the write-token 403, which
  // is not about the PIN at all (shared/hw-live.js gates every POST on a
  // public deployment) and whose raw text names an HTTP header.
  //
  // NUMERIC AND MASKED. `type="password"` so it is not readable over a
  // shoulder at the counter, `inputMode="numeric"` so a tablet shows the
  // number pad rather than a full keyboard, and the value is filtered to
  // digits — the PIN is digits, and silently accepting a stray letter from an
  // autocorrect produces a refusal the operator cannot see the cause of.
  window.IdvShared.PinGate = function PinGate({ onUnlocked, compact }) {
    const P = useP();
    const [pin, setPin] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const aliveRef = React.useRef(true);
    React.useEffect(() => () => { aliveRef.current = false; }, []);

    const ready = pin.length >= 4 && !busy;

    function submit() {
      if (!ready) return;
      setBusy(true); setErr(null);
      window.HWIdv.auth.enter(pin).then((r) => {
        if (!aliveRef.current) return;
        setBusy(false);
        if (r.ok) {
          setPin('');
          if (typeof onUnlocked === 'function') onUnlocked();
          return;
        }
        setPin('');
        setErr(r.gated
          ? 'This device cannot sign in yet — it is missing the link the owner '
            + 'sends out to unlock writes on this deployment. Ask for that link '
            + 'and open Verify from it, then enter the PIN.'
          : (r.error || 'That did not work.'));
      });
    }

    return (
      <div data-hw="idv-pin-gate" style={{ flex: 1, minHeight: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: P.space.x5,
        background: P.bg }}>
        <Card elevation="raised" style={{ width: '100%', maxWidth: compact ? 320 : 380,
          display: 'flex', flexDirection: 'column', gap: P.space.x4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x3 }}>
            <div style={{ width: 34, height: 34, borderRadius: P.r8, background: P.accent,
              color: P.accentInk, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name="shield" size={17} stroke={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink,
                letterSpacing: '-.01em' }}>Verify</div>
              <div style={{ fontSize: P.type.meta, color: P.inkDim }}>Enter the Verify PIN to continue.</div>
            </div>
          </div>

          {/* A real <form>, so Enter submits and a tablet's keyboard shows a
              Go key — not a div listening for keydown. */}
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: P.space.x3 }}>
            <Field size="lg" icon="lock" placeholder="PIN" value={pin} mono
              type="password" inputMode="numeric" autoComplete="off"
              autoFocus aria-label="Verify PIN"
              onChange={(e) => { setErr(null); setPin(e.target.value.replace(/\D/g, '').slice(0, 24)); }} />
            {err ? (
              <div role="alert" style={{ display: 'flex', gap: P.space.x2, alignItems: 'flex-start' }}>
                <Icon name="alert" size={14} stroke={2} color={P.bad}
                  style={{ flex: '0 0 auto', marginTop: 2 }} />
                <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.45 }}>{err}</span>
              </div>) : null}
            {/* ONE SUBMIT PATH, not two. `type="submit"` inside the form is
                what makes Enter work in the field; adding `onClick={submit}`
                on top of it would ALSO run the handler on the click, and a
                double-fire here is not cosmetic — it spends two of the five
                attempts the server allows per minute per IP, so a mistyped
                PIN would lock the tablet out in three tries instead of six. */}
            <PBtn variant="primary" size="lg" full busy={busy} disabled={!ready}
              type="submit">Continue</PBtn>
          </form>

          <div style={{ fontSize: P.type.micro, color: P.inkFaint, lineHeight: 1.5 }}>
            One PIN for this store, and this device remembers it for the rest of
            the day.
          </div>
        </Card>
      </div>);
  };

  // ── ImportedTag ─────────────────────────────────────────────────────────
  // Session-level honesty label (plan §5.3): imported Didit history is marked
  // and never silently blends into engine-accuracy panels.
  window.IdvShared.ImportedTag = function ImportedTag({ date, size = 'sm' }) {
    const fmtDate = window.HWIdv ? window.HWIdv.fmt.date : (d) => d;
    const label = date ? `Verified by Didit, imported ${fmtDate(date)}` : 'Verified by Didit, imported';
    return <Pill kind="neutral" size={size} icon="download">{label}</Pill>;
  };

  // ── fmtDuration ─────────────────────────────────────────────────────────
  // Seconds -> "m:ss", or "h:mm:ss" once an hour is crossed (a stalled
  // Awaiting User session can sit for a while, and the aggregate stats on
  // #/usage can span a whole percentile distribution — this must not wrap
  // or truncate silently past 59:59). null/undefined/NaN -> "—": the timing
  // addendum (2026-09-10, Addendum 3) is a field every screen that reads it
  // must render defensively until the backend ships `timing`/`stats/timing`.
  // Shared here (not duplicated per-screen) because screen-sessions.jsx,
  // screen-session.jsx and screen-usage.jsx all format the same seconds.
  window.IdvShared.fmtDuration = function fmtDuration(s) {
    if (s == null || typeof s !== 'number' || isNaN(s)) return '—';
    const total = Math.max(0, Math.round(s));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  // ── TIMING_STEPS ────────────────────────────────────────────────────────
  // The five capture steps the timing addendum's per-step views show (Session
  // screen's bar strip, Usage's aggregate step table) — "front, back, rec,
  // selfie, liveness" per the brief, in that display order. `key` matches
  // `timing.steps[].step` / `stats/timing.steps` object keys; an unrecognised
  // key from either endpoint is simply not one of these five and never
  // rendered, rather than crashing on a label lookup miss. Promoted here (not
  // duplicated per screen) the moment a second screen needed it, per the "if
  // one does, this is the seam to promote into idv-shared.jsx" rule
  // screen-home.jsx's own BarRows comment states for exactly this situation.
  window.IdvShared.TIMING_STEPS = [
    { key: 'document_front', label: 'Front' },
    { key: 'document_back', label: 'Back' },
    { key: 'medical_rec', label: 'Rec' },
    { key: 'selfie', label: 'Selfie' },
    { key: 'liveness', label: 'Liveness' },
  ];

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
