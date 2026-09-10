// ── idv/screen-session.jsx ── IdvSessionScreen — one verification, in full ──
// Route: #/sessions/:id (idv/app.jsx resolves this with SESSION_DETAIL_RE and
// wraps it in a CriticalBoundary — see that file's header comment for why:
// this is the one PII-bearing screen where a partially-rendered page with an
// intact action bar is worse than no page at all).
//
// Design sources (owner's picks, plan §5.6):
//   explorations/Verify - Concept A - Console.html, tab "Session" — the
//     action bar PINNED under the title (Approve · Decline · Ask to redo ▾ ·
//     Edit data · Add to list · Download PDF · Delete, kbd hints A/D/R) so
//     nobody has to scroll to act.
//   explorations/Verify - Concept D - Floor.html, tab "Session detail" — the
//     decision-node LIST (name, model caption verbatim, bar, score vs
//     threshold, status dot), the barcode↔print cross-check table, and the
//     session-facts block.
//
// Contract: docs/IDV-API-CONTRACT.md — GET/PATCH/DELETE /api/idv/sessions/*,
// /api/idv/sessions/{id}/features/{node_id}/update-status, resubmit-link,
// pdf, /api/idv/lists*, /api/idv/media/{id}. Media is served behind a console
// role (X-HW-Actor), so every image/video on this screen is fetched with that
// header and shown from a blob: URL — never a bare <img src>, which would
// send no header and 403 (or worse, be a public link an analyst could
// forward). See useBlobUrl() below; it is this file's one deliberate
// departure from IdvShared.MediaThumb, which uses a bare <img> because it was
// written before this screen needed the header.
//
// SCORE CAPTIONS ARE NEVER REWORDED. A Score object's `caption` (e.g. "open
// model · uncertified") is API-authored provenance text, printed verbatim via
// IdvShared.ScorePill — this file adds no adjectives of its own to a model's
// confidence.
//
// CONTRACT GAPS FOUND WHILE BUILDING (also in this task's final report):
//   1. GET /sessions/{id}'s documented `session` shape omits `guidance` and
//      `next_step`, though the 2026-09-08 addendum says idv_sessions gained
//      both columns and a live probe shows them present. Read defensively.
//   2. The live response also carries a top-level `consents` array that is
//      nowhere in the documented shape. Read defensively; rendered as-is.
//   3. No route returns a session's resolved thresholds (workflow.config).
//      This file fetches GET /api/idv/workflows/{id}/versions and matches
//      session.workflow.version to get thresholds for the score-vs-threshold
//      display the design calls for — reasonable, but a direct
//      GET /api/idv/workflows/{id} would be more obviously correct.
//   4. idv-client.jsx's ACTION_MIN_ROLE has no entry for viewing/downloading
//      the PDF or media, so HWIdv.can() would default an unrecognised action
//      to admin-only (its own documented fallback). That default is too
//      strict for a read-only export of what is already on screen, so
//      Download PDF is gated on can('view') (always true) rather than an
//      invented action name — idv-client.jsx itself is out of this task's
//      scope to edit.
//   5. can('deletion') requires admin, but the contract only admin-gates
//      POST .../execute, not the DELETE (request) route itself. This screen
//      follows the client's stricter gate since idv-client.jsx is out of
//      scope here; worth reconciling later.
//   6. Delete's confirm dialog collects a required comment per this task's
//      brief, but DELETE /api/idv/sessions/{id}'s body has no comment field
//      (only instruction + retain_face_template) and no route exists to
//      attach a standalone analyst note to a session. The comment is
//      collected (so the analyst is asked to state why) but is not sent
//      anywhere — nothing in the contract has a slot for it.
//   7. Ask-to-redo's node checklist is built from which decision node arrays
//      are non-empty (OCR/LIVENESS/FACE_MATCH), matched to the
//      nodes_to_resubmit enum the contract shows (["LIVENESS","OCR"]) — there
//      is no endpoint listing "resubmittable steps" directly.
//   8. Cross-check table values are reconstructed by mapping OCR field names
//      to AAMVA barcode field codes (DAC/DCS/DBB/DAQ/DBA/DAJ) client-side;
//      the contract's `crosschecks.barcode_vs_ocr` only gives agree/disagree/
//      missing field-name arrays, not the paired values Concept D's table
//      shows. A dedicated per-field crosscheck shape would remove the
//      guesswork. (2026-09-09 fix: the "Print (OCR)" column was reading
//      `id_verifications[0][field]` — the node's barcode-derived value once
//      the barcode decodes — instead of the OCR reader's own output, so a
//      failed OCR read showed the barcode's value twice under a "missing"
//      Agrees flag. It now reads only `engine_detail.ocr_fields` (fallback
//      `ocr_fields`) and shows "—" when the OCR reader produced nothing for
//      that field; the Agrees column renders yes/no/not-read pills and a
//      `DECODED_OCR_FAILED` / `NO_BARCODE` status prints a one-line note.)
;(function () {
  const useP = window.useP;
  const S = window.IdvShared || {};

  const NEEDS_ANALYST = 'Needs an analyst role';
  const NEEDS_ADMIN = 'Needs an admin role';

  const FEATURE_LABEL = { OCR: 'Document (OCR)', LIVENESS: 'Liveness', FACE_MATCH: 'Face match' };
  const AAMVA_CODE = { first_name: 'DAC', last_name: 'DCS', date_of_birth: 'DBB', document_number: 'DAQ', expiration_date: 'DBA', issuing_state: 'DAJ' };
  const FIELD_LABEL = { first_name: 'First name', last_name: 'Last name', date_of_birth: 'Date of birth', document_number: 'Document number', expiration_date: 'Expires', issuing_state: 'Issuing state', nationality: 'Nationality' };
  // ── passport / MRZ (2026-09-09 contract) ──────────────────────────────────
  const DOC_TYPE_LABEL_LONG = { drivers_license: "Driver's licence / state ID", passport: 'Passport' };
  const MRZ_CHECK_LABEL = { document_number: 'Document number', date_of_birth: 'Date of birth',
    expiration_date: 'Expiration date', personal_number: 'Personal number', composite: 'Composite' };
  const MRZ_CHECK_ORDER = ['document_number', 'date_of_birth', 'expiration_date', 'personal_number', 'composite'];
  const MEDIA_ORDER = ['document_front', 'document_back', 'medical_rec', 'selfie', 'proof', 'selfie_frame', 'portrait_crop', 'liveness_video', 'challenge_frame', 'import_pdf'];
  // Timing step order/labels (2026-09-10 Addendum 3) live in idv-shared.jsx's
  // IdvShared.TIMING_STEPS — see that file for why (needed by both this
  // screen and screen-usage.jsx's aggregate step table).
  const MEDIA_LABEL = { document_front: 'Front', document_back: 'Back', medical_rec: "Doctor's recommendation", selfie: 'Selfie', proof: 'Proof (selfie + ID)', selfie_frame: 'Selfie frame', liveness_video: 'Liveness clip', portrait_crop: 'Portrait crop', challenge_frame: 'Challenge frame', import_pdf: 'Imported PDF' };
  // ── medical_rec (MED_18_REC, 2026-09-09 gap C) — MED_REC_* in plain words,
  // per idv_rules.py's _medical_block ordering (:2454-2463) and GUIDANCE
  // (:339-345, 431-448). Analyst-facing, not the guest-facing GUIDANCE copy.
  // Addendum 4, 2026-09-10: the OUT_OF_STATE/INVALID_LICENSE sentences no
  // longer name California by name — `_medical_block` compares against the
  // workflow's own configured `jurisdiction` now, which is not always CA.
  const MED_REC_REASON_TEXT = {
    MED_REC_MISSING: 'No recommendation has been submitted.',
    MED_REC_UNREADABLE: 'The recommendation could not be read well enough to confirm — too few core fields, or OCR confidence below the floor.',
    MED_REC_OUT_OF_STATE: "The physician licence state doesn't match the workflow's configured jurisdiction.",
    MED_REC_INVALID_LICENSE: "The physician licence number doesn't match the configured jurisdiction's pattern.",
    MED_REC_NAME_MISMATCH: "The patient name on the recommendation doesn't match the ID.",
    MED_REC_DOB_MISMATCH: "The patient date of birth on the recommendation doesn't match the ID.",
    MED_REC_EXPIRED: 'The recommendation is expired, or dated in the future.',
    MED_REC_JURISDICTION_UNCONFIGURED: "No medical-proof pattern is configured for the workflow's jurisdiction — declined rather than approved on an unverified rule.",
  };
  const MED_REC_STATUS_TONE = { Approved: 'good', Declined: 'bad', 'Not Finished': 'warn' };
  const REVIEW_ACTION_LABEL = { approve: 'Approved', decline: 'Declined', request_resubmission: 'Requested resubmission', note: 'Added a note', assign: 'Assigned', escalate: 'Escalated', override_feature: 'Overrode a feature', edit_data: 'Edited data', merge_person: 'Merged people', add_to_list: 'Added to a list' };
  const TERMINAL_STATUS = { Approved: 1, Declined: 1, Abandoned: 1, Expired: 1, 'Kyc Expired': 1 };

  function toneColor(P, tone) {
    return { good: P.good, bad: P.bad, warn: P.warn, info: P.info, neutral: P.inkFaint }[tone] || P.inkFaint;
  }

  // ── the one place this screen touches the network for bytes ─────────────
  // Every media/PDF fetch goes through this: same actor header idv-client.jsx
  // puts on every console request, same base HW_LIVE resolves, but returning
  // a Response so the caller can read bytes (blob) instead of JSON.
  function liveBase() { return (window.HW_LIVE && window.HW_LIVE.base) || ''; }
  function actorHeaders() {
    // Same headers as every other console request -- actor AND the console PIN
    // token. A local copy that sent only the actor worked while the gate was
    // off locally and failed on the first production session (2026-09-09:
    // every media tile "Could not load" while the engine, holding a media
    // token, fetched the same files fine).
    if (window.HWIdv && typeof window.HWIdv.actorHeaders === 'function') return window.HWIdv.actorHeaders();
    const s = window.HWIdv ? window.HWIdv.session() : null;
    const h = s && s.id ? { 'X-HW-Actor': s.id } : {};
    try { const t = window.localStorage.getItem('hw-console-token'); if (t) h['X-HW-Console-Token'] = t; } catch (e) {}
    return h;
  }
  function fetchBytes(path) {
    return fetch(liveBase() + path, { method: 'GET', credentials: 'omit', cache: 'no-store', headers: actorHeaders() })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
  }

  // PATCH (update-status, update-data, features/*/update-status per
  // IDV-API-CONTRACT.md) and DELETE (the deletion request) now go through
  // window.HWIdv.patch()/HWIdv.del() (idv/idv-client.jsx) directly, below —
  // this file's own local `verb()` mirror of that same header/write-token
  // behaviour was a plain duplicate and has been removed.

  // Fetches a media/PDF byte route WITH the actor header and hands back a
  // blob: URL — the only correct way to put this image in an <img>/<video>
  // src, since the header cannot ride along on a bare src attribute.
  function useBlobUrl(path) {
    const [state, setState] = React.useState({ url: null, failed: false, loading: !!path });
    React.useEffect(() => {
      let alive = true, objUrl = null;
      if (!path) { setState({ url: null, failed: false, loading: false }); return; }
      setState({ url: null, failed: false, loading: true });
      fetchBytes(path).then((blob) => {
        if (!alive) return;
        objUrl = URL.createObjectURL(blob);
        setState({ url: objUrl, failed: false, loading: false });
      }).catch(() => { if (alive) setState({ url: null, failed: true, loading: false }); });
      return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
    }, [path]);
    return state;
  }

  // ── media tile — blob-backed, never a bare <img src> ─────────────────────
  function MediaTile({ media, onOpen }) {
    const P = useP();
    const { url, failed, loading } = useBlobUrl(media && media.url);
    const isVideo = /^video\//.test((media && media.mime) || '');
    const label = MEDIA_LABEL[media && media.kind] || (media && media.kind) || 'Media';
    return (
      <div>
        <div onClick={url && onOpen ? () => onOpen(url, media) : undefined}
          title={media ? `${label} · ${media.mime}${media.width ? ` · ${media.width}×${media.height}` : ''}` : label}
          style={{ position: 'relative', width: '100%', aspectRatio: isVideo ? '4/3' : '3/2', borderRadius: P.r8, overflow: 'hidden',
            background: P.canvas2, border: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: url && onOpen ? 'pointer' : 'default' }}>
          {url && !isVideo && <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          {url && isVideo && <video src={url} muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          {!url && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: P.inkMute }}>
              <Icon name={loading ? 'clock' : failed ? 'x' : 'camera'} size={20} stroke={1.6} />
              <span style={{ fontSize: 9, fontFamily: P.fontMono, color: P.inkFaint }}>{loading ? 'Loading…' : failed ? 'Could not load' : label}</span>
            </div>)}
        </div>
        <div style={{ marginTop: 4, fontSize: P.type.micro, color: P.inkMute, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span>{label}</span>
          {media && media.bytes ? <span style={{ fontFamily: P.fontMono }}>{(media.bytes / 1024).toFixed(0)}KB</span> : null}
        </div>
      </div>);
  }

  function FaceThumb({ face }) {
    const P = useP();
    const { url, failed, loading } = useBlobUrl(face && face.media_url);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: '0 0 auto', width: 76 }}>
        <div style={{ width: 56, height: 56, borderRadius: P.r8, overflow: 'hidden', background: P.canvas2, border: `1px solid ${P.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {url ? <img src={url} alt="Similar face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
            <Icon name={loading ? 'clock' : failed ? 'x' : 'user'} size={16} stroke={1.6} color={P.inkMute} />}
        </div>
        <div style={{ fontSize: P.type.micro, fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{Number(face.similarity).toFixed(1)}</div>
      </div>);
  }

  function Lightbox({ src, isVideo, label, onClose }) {
    const P = useP();
    return (
      <div style={overlayScrim(P, { padding: '40px 24px' })} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...overlayCard, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconBtn icon="x" onClick={onClose} label="Close" tone="solid" style={{ background: P.surface, boxShadow: P.shadowMd }} />
          </div>
          {isVideo
            ? <video src={src} controls autoPlay style={{ maxWidth: '92vw', maxHeight: '76vh', borderRadius: P.r12, boxShadow: P.shadowLg }} />
            : <img src={src} alt={label} style={{ maxWidth: '92vw', maxHeight: '76vh', borderRadius: P.r12, boxShadow: P.shadowLg, display: 'block' }} />}
        </div>
      </div>);
  }

  // ── small display helpers ────────────────────────────────────────────────
  function Kv({ label, value, mono }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: `1px solid ${P.hairline}` }}>
        <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{label}</span>
        <span style={{ fontSize: P.type.body, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, textAlign: 'right', wordBreak: 'break-word' }}>{value == null || value === '' ? '—' : value}</span>
      </div>);
  }

  function CardHead({ icon, title, right }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: `1px solid ${P.hairline}` }}>
        {icon && <Icon name={icon} size={14} stroke={1.8} color={P.inkDim} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
        {right}
      </div>);
  }

  // ── per-step timing bar (Timing card, 2026-09-10 Addendum 3) ─────────────
  // `row` is one entry of `timing.steps` — {step, first_s, last_s, attempts}
  // — seconds since opened_at, per the contract. The segment's position and
  // width are both scaled against the SESSION's total_s (not the step's own
  // range), so a step that happened early and a step that happened late line
  // up against one shared timeline instead of each stretching to fill its own
  // row — that comparison ("did this session spend its time on step 2 or on
  // retaking step 4?") is the reason the brief calls for a strip and not five
  // independent meters. Renders a flat "—" row, never omits the label, when
  // there is no data for that step (no capture, or `timing` itself absent).
  function TimingBarStep({ label, row, totalS }) {
    const P = useP();
    const has = row && row.first_s != null;
    const denom = totalS != null && totalS > 0 ? totalS : (has && row.last_s != null ? Math.max(row.last_s, 1) : 1);
    const leftPct = has ? Math.max(0, Math.min(100, (row.first_s / denom) * 100)) : 0;
    const rawLast = has && row.last_s != null ? row.last_s : (has ? row.first_s : 0);
    const widthPct = has ? Math.max(1.5, Math.min(100 - leftPct, ((rawLast - row.first_s) / denom) * 100)) : 0;
    const attempts = has && row.attempts > 1 ? row.attempts : null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 52, flex: '0 0 auto', fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>{label}</span>
        <div style={{ flex: 1, position: 'relative', height: 7, background: P.surface3, borderRadius: 99, overflow: 'hidden' }}>
          {has && <div style={{ position: 'absolute', left: leftPct + '%', width: widthPct + '%', top: 0, bottom: 0, background: attempts ? P.warn : P.accent, borderRadius: 99 }} />}
        </div>
        <span style={{ width: 108, flex: '0 0 auto', textAlign: 'right', fontSize: P.type.micro, fontFamily: P.fontMono, color: P.inkMute, whiteSpace: 'nowrap' }}>
          {has ? `${S.fmtDuration(row.first_s)}–${S.fmtDuration(rawLast)}` : '—'}{attempts ? ` · ${attempts}x` : ''}
        </span>
      </div>);
  }

  // ── decision node row ─────────────────────────────────────────────────────
  function NodeRow({ label, status, score, threshold, caption }) {
    const P = useP();
    const tone = (S.STATUS_TONE && S.STATUS_TONE[status]) || 'neutral';
    const numeric = score != null && typeof score === 'object' ? score.score : score;
    const pct = numeric != null && !isNaN(numeric) ? Math.max(0, Math.min(100, Number(numeric))) : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '11px 14px', borderTop: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: toneColor(P, tone), flex: '0 0 auto' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{label}</span>
          {S.ScorePill ? <S.ScorePill score={score} threshold={threshold} /> : null}
        </div>
        {pct != null && <BarMeter value={pct} max={100} color={toneColor(P, tone)} height={5} />}
        {caption && <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5 }}>{caption}</div>}
      </div>);
  }

  // ── ask-to-redo panel (inline, under the pinned action bar) ──────────────
  function RedoPanel({ available, selected, onToggle, comment, onComment, busy, onSend, onCancel }) {
    const P = useP();
    return (
      <Card elevation="raised" style={{ marginTop: 10 }}>
        <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink, marginBottom: 4 }}>Ask the guest to redo one step</div>
        <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5, marginBottom: 10 }}>
          Tick only the steps that failed — the guest redoes those and nothing else.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {available.length === 0 && <div style={{ fontSize: P.type.body, color: P.inkMute }}>No decision nodes on this session yet to choose from.</div>}
          {available.map((f) => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, cursor: 'pointer' }}
              onClick={(e) => { e.preventDefault(); onToggle(f.key); }}>
              <Check on={selected.has(f.key)} onChange={() => onToggle(f.key)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{FEATURE_LABEL[f.key] || f.key}</div>
                {f.sub && <div style={{ fontSize: P.type.meta, color: P.inkDim }}>{f.sub}</div>}
              </div>
            </label>))}
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Note for the trail (optional)</div>
          <textarea value={comment} onChange={(e) => onComment(e.target.value)} rows={2} placeholder="Why you're asking for this — goes on the record, not to the guest"
            style={{ width: '100%', padding: '9px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, fontFamily: P.fontSans, fontSize: P.type.body, resize: 'vertical', background: P.field, color: P.ink }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PBtn variant="accent" size="sm" icon="send" busy={busy} disabled={selected.size === 0} onClick={onSend}>Send resubmission link</PBtn>
          <PBtn variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancel</PBtn>
        </div>
      </Card>);
  }

  // ── confirm dialog (decline / delete) — required comment ─────────────────
  function ConfirmDialog({ title, body, confirmLabel, requireComment, comment, onComment, extra, busy, onConfirm, onClose }) {
    const P = useP();
    return (
      <div style={overlayScrim(P)} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...overlayCard, background: P.surface, borderRadius: P.r16, width: 'min(460px,96vw)', border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: P.type.title, color: P.ink }}>{title}</h3>
            <IconBtn icon="x" onClick={onClose} label="Close" />
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {body && <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.55 }}>{body}</div>}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>
                Comment{requireComment ? ' (required)' : ' (optional)'}
              </div>
              <textarea value={comment} onChange={(e) => onComment(e.target.value)} rows={3} placeholder="What you saw and why — goes in the trail"
                style={{ width: '100%', padding: '9px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, fontFamily: P.fontSans, fontSize: P.type.body, resize: 'vertical', background: P.field, color: P.ink }} />
            </div>
            {extra}
          </div>
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
            <PBtn variant="ghost" onClick={onClose} disabled={busy}>Leave it alone</PBtn>
            <PBtn variant="danger" busy={busy} disabled={requireComment && !comment.trim()} onClick={onConfirm}>{confirmLabel}</PBtn>
          </div>
        </div>
      </div>);
  }

  // ── edit data dialog ──────────────────────────────────────────────────────
  function EditDataDialog({ initial, busy, onSubmit, onClose }) {
    const P = useP();
    const [f, setF] = React.useState(initial);
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const setAddr = (k) => (e) => setF((p) => ({ ...p, parsed_address: { ...(p.parsed_address || {}), [k]: e.target.value } }));
    const row = (label, key, placeholder) => (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
        <Field value={f[key] || ''} onChange={set(key)} placeholder={placeholder} />
      </div>);
    return (
      <div style={overlayScrim(P)} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...overlayCard, background: P.surface, borderRadius: P.r16, width: 'min(560px,96vw)', border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: P.type.title, color: P.ink }}>Edit extracted data</h3>
            <IconBtn icon="x" onClick={onClose} label="Close" />
          </div>
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: '62vh', overflowY: 'auto' }}>
            <div style={{ gridColumn: '1 / -1', fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5 }}>
              This sits on top of the original OCR/barcode read — nothing is overwritten, and the edit is diffed in the trail.
            </div>
            {row('First name', 'first_name')}
            {row('Last name', 'last_name')}
            {row('Date of birth', 'date_of_birth', 'YYYY-MM-DD')}
            {row('Gender (M/F/U)', 'gender')}
            {row('Document type', 'document_type')}
            {row('Document number', 'document_number')}
            {row('Issuing state', 'issuing_state')}
            {row('Nationality', 'nationality')}
            {row('Date of issue', 'date_of_issue', 'YYYY-MM-DD')}
            {row('Expiration date', 'expiration_date', 'YYYY-MM-DD')}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Address</div>
              <Field value={f.address || ''} onChange={set('address')} placeholder="Street address, one line" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>City</div>
              <Field value={(f.parsed_address && f.parsed_address.city) || ''} onChange={setAddr('city')} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Region</div>
              <Field value={(f.parsed_address && f.parsed_address.region) || ''} onChange={setAddr('region')} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Postal code</div>
              <Field value={(f.parsed_address && f.parsed_address.postal_code) || ''} onChange={setAddr('postal_code')} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Country</div>
              <Field value={(f.parsed_address && f.parsed_address.country) || ''} onChange={setAddr('country')} />
            </div>
          </div>
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
            <PBtn variant="secondary" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="accent" busy={busy} onClick={() => onSubmit(f)}>Save the edit</PBtn>
          </div>
        </div>
      </div>);
  }

  // ── add to list dialog ────────────────────────────────────────────────────
  function AddToListDialog({ busy, onSubmit, onClose }) {
    const P = useP();
    const [lists, setLists] = React.useState({ loading: true, error: null, rows: [] });
    const [listId, setListId] = React.useState('');
    const [value, setValue] = React.useState('');
    const [reason, setReason] = React.useState('');
    React.useEffect(() => {
      let alive = true;
      window.HWIdv.get('/api/idv/lists').then((r) => {
        if (!alive) return;
        if (r.ok) setLists({ loading: false, error: null, rows: (r.body && r.body.rows) || [] });
        else setLists({ loading: false, error: r.error || 'Could not load lists', rows: [] });
      });
      return () => { alive = false; };
    }, []);
    const chosen = lists.rows.find((l) => l.id === listId);
    return (
      <div style={overlayScrim(P)} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...overlayCard, background: P.surface, borderRadius: P.r16, width: 'min(460px,96vw)', border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: P.type.title, color: P.ink }}>Add to a list</h3>
            <IconBtn icon="x" onClick={onClose} label="Close" />
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lists.loading && <Skeleton lines={3} />}
            {lists.error && <ErrorState compact title="Lists didn't load" body={lists.error} />}
            {!lists.loading && !lists.error && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>List</div>
                <select value={listId} onChange={(e) => setListId(e.target.value)}
                  style={{ width: '100%', minHeight: P.ctrlH.md, padding: '0 11px', borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontFamily: P.fontSans, fontSize: P.type.body }}>
                  <option value="">Choose a list…</option>
                  {lists.rows.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.list_type}/{l.entry_type}</option>)}
                </select>
              </div>)}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Value{chosen ? ` (${chosen.entry_type})` : ''}</div>
              <Field value={value} onChange={(e) => setValue(e.target.value)} placeholder={chosen ? `The ${chosen.entry_type} to list` : 'Choose a list first'} disabled={!chosen} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5 }}>Reason (required)</div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why this belongs on the list"
                style={{ width: '100%', padding: '9px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, fontFamily: P.fontSans, fontSize: P.type.body, resize: 'vertical', background: P.field, color: P.ink }} />
            </div>
          </div>
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
            <PBtn variant="secondary" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="accent" busy={busy} disabled={!listId || !value.trim() || !reason.trim()}
              onClick={() => onSubmit({ list_id: listId, value: value.trim(), reason: reason.trim() })}>Add to list</PBtn>
          </div>
        </div>
      </div>);
  }

  // ── the screen ────────────────────────────────────────────────────────────
  function IdvSessionScreen(props) {
    const P = useP();
    const { navigate, path, role, can } = props;
    const id = decodeURIComponent(String(path || '').replace(/^\/sessions\//, ''));
    const HWIdv = window.HWIdv;
    const fmt = HWIdv ? HWIdv.fmt : { date: (d) => d, relative: (d) => d, score: (v) => (v == null ? '—' : v) };

    const poll = HWIdv ? HWIdv.usePoll('/api/idv/sessions/' + encodeURIComponent(id), 20000)
      : { loading: false, error: 'no-live-seam', data: null, refresh: () => {} };

    const data = poll.data || {};
    const sess = data.session || null;
    const decision = data.decision || null;
    const media = data.media || [];
    const similarFaces = data.similar_faces || [];
    const consents = data.consents || [];
    const queue = data.queue || null;
    const idn0 = decision && decision.id_verifications && decision.id_verifications[0];
    // idv_sessions.document_type is the session-level field (contract,
    // 2026-09-09); id_verifications[0].document_type carrying Didit's literal
    // "Passport" is the fallback for a session read before that column
    // existed on this row.
    const documentType = (sess && sess.document_type)
      || (idn0 && idn0.document_type === 'Passport' ? 'passport' : 'drivers_license');
    const isPassport = documentType === 'passport';
    // ── doctor's recommendation (medical_rec, 2026-09-09 — MED_18_REC gap C) ─
    // `decision.medical_recommendations` only exists on the payload at all
    // when a medical_rec image was uploaded (idv-engine app.py:882-886 never
    // sends an empty array), so `medRec` here doubles as "was one submitted".
    // Addendum 4, 2026-09-10: this used to read an EMPTY array on every
    // session — `idv_decisions` had no column for this node at all, unlike
    // MRZ — because the persistence bug meant `decision.medical_recommendations`
    // never actually reached this payload. Fixed backend-side
    // (`idv_store.insert_decision` now stores it, `idv_api.decision_out`
    // returns it); this line did not have to change to pick that up.
    const medRec = decision && decision.medical_recommendations && decision.medical_recommendations[0];

    // ── thresholds — fetched once per workflow version (gap #3 above) ──────
    // GET …/workflows/{id}/versions carries idv_version alongside the list now
    // (contract addendum J: "a bare array has nowhere to put the counter"),
    // so the response is `{ idv_version, rows: [...] }`, not a bare array —
    // read defensively for either shape rather than assume the array form.
    // When the session's own pinned version isn't in that list, this falls
    // back to the latest version instead of showing nothing; thresholdsFrom
    // records which version was actually used so the fallback can be labelled
    // rather than presented as if it were the session's real thresholds.
    const [thresholds, setThresholds] = React.useState(null);
    const [thresholdsFrom, setThresholdsFrom] = React.useState(null);
    const wfId = sess && sess.workflow && sess.workflow.id;
    const wfVersion = sess && sess.workflow && sess.workflow.version;
    React.useEffect(() => {
      if (!wfId || !HWIdv) return;
      let alive = true;
      HWIdv.get('/api/idv/workflows/' + encodeURIComponent(wfId) + '/versions').then((r) => {
        if (!alive || !r.ok) return;
        const versions = Array.isArray(r.body) ? r.body : (r.body && Array.isArray(r.body.rows) ? r.body.rows : null);
        if (!versions || !versions.length) return;
        const pinned = versions.find((v) => v.version === wfVersion);
        const row = pinned || versions[versions.length - 1];
        if (row && row.config && row.config.thresholds) {
          setThresholds(row.config.thresholds);
          setThresholdsFrom(pinned ? null : row.version);
        }
      });
      return () => { alive = false; };
    }, [wfId, wfVersion]);

    // ── dialog / panel state ────────────────────────────────────────────────
    const [confirm, setConfirm] = React.useState(null); // 'decline' | 'delete' | null
    const [confirmComment, setConfirmComment] = React.useState('');
    const [deleteInstruction, setDeleteInstruction] = React.useState('operational_session_delete');
    const [retainTemplate, setRetainTemplate] = React.useState(false);
    const [redoOpen, setRedoOpen] = React.useState(false);
    const [redoSelected, setRedoSelected] = React.useState(() => new Set());
    const [redoComment, setRedoComment] = React.useState('');
    const [resubmitResult, setResubmitResult] = React.useState(null); // { url, expires_at }
    const [editOpen, setEditOpen] = React.useState(false);
    const [listOpen, setListOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(null); // which action is in flight
    const [pdfBusy, setPdfBusy] = React.useState(false);
    const [lightbox, setLightbox] = React.useState(null); // { src, isVideo, label }
    const [eventsOpen, setEventsOpen] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const toast = (t) => { if (window.hdToast) window.hdToast(t); };

    // ── keyboard shortcuts — A / D / R, ignored while typing or a dialog is open
    React.useEffect(() => {
      function onKey(e) {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || confirm || editOpen || listOpen) return;
        if (e.key === 'a' || e.key === 'A') doApprove();
        else if (e.key === 'd' || e.key === 'D') openDecline();
        else if (e.key === 'r' || e.key === 'R') setRedoOpen((o) => !o);
      }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line
    }, [confirm, editOpen, listOpen, sess && sess.status, role]);

    // Both memos below must run on EVERY render, before the early returns —
    // conditionally skipping a hook call is what produced "Rendered more
    // hooks than during the previous render" here originally (loading ->
    // loaded changed how many hooks ran). Each guards its own null inputs
    // instead of being skipped.
    const redoAvailable = React.useMemo(() => {
      const rows = [];
      const push = (key, nodeArr) => {
        const n = nodeArr && nodeArr[0];
        rows.push({ key, sub: n && (n.status ? `Last result: ${n.status}` : null) });
      };
      if (!decision) return [{ key: 'OCR' }, { key: 'LIVENESS' }, { key: 'FACE_MATCH' }];
      if (decision.id_verifications && decision.id_verifications.length) push('OCR', decision.id_verifications);
      if (decision.liveness_checks && decision.liveness_checks.length) push('LIVENESS', decision.liveness_checks);
      if (decision.face_matches && decision.face_matches.length) push('FACE_MATCH', decision.face_matches);
      return rows;
    }, [decision]);

    // SAME RENDERING FOR BOTH SOURCES (contract, 2026-09-09): a passport
    // session reads `crosschecks.mrz_vs_ocr` instead of `barcode_vs_ocr` —
    // same shape (status/agree/disagree/missing/confidence) — and the
    // "primary" column's value comes from the node's own top-level field
    // rather than an AAMVA-coded side-bag, because the contract fills those
    // top-level fields FROM THE MRZ once `mrz.valid`. There is no
    // `mrz_fields` the way `barcode_fields` exists for AAMVA codes.
    const crosscheckRows = React.useMemo(() => {
      const cc = decision && decision.crosschecks && (isPassport ? decision.crosschecks.mrz_vs_ocr : decision.crosschecks.barcode_vs_ocr);
      if (!idn0 || !cc) return [];
      // Print (OCR) values must come from the OCR reader itself, never from the
      // node's top-level fields — those are barcode/MRZ-derived once decoded,
      // so filling the column from them silently echoes that value back in a
      // column labeled "Print" (see 2026-09-09 contract addendum:
      // barcode_vs_ocr.missing means the OCR reader produced nothing for that
      // field, and this column must say so, not restate the chip's value).
      const ocrFields = (idn0.engine_detail && idn0.engine_detail.ocr_fields) || idn0.ocr_fields || null;
      const fields = Array.from(new Set([].concat(cc.agree || [], cc.disagree || [], cc.missing || [])));
      return fields.map((f) => {
        let primary;
        if (isPassport) {
          primary = idn0[f];
        } else {
          const code = AAMVA_CODE[f];
          primary = code && idn0.barcode_fields ? idn0.barcode_fields[code] : null;
        }
        const print = ocrFields ? ocrFields[f] : null;
        const agrees = (cc.agree || []).includes(f) ? 'yes' : (cc.disagree || []).includes(f) ? 'no' : (cc.missing || []).includes(f) ? 'missing' : '—';
        return { field: FIELD_LABEL[f] || f, primary: primary == null ? '—' : String(primary), print: print == null ? '—' : String(print), agrees };
      });
    }, [decision, idn0, isPassport]);

    if (poll.error && !poll.data) {
      return <S.NotConnected onRetry={poll.refresh} />;
    }
    if (poll.loading && !poll.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card padding={16}><Skeleton lines={2} /></Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,340px) minmax(0,1fr)', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><S.SkeletonCard lines={4} /><S.SkeletonCard lines={3} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><S.SkeletonTable rows={5} /><S.SkeletonCard lines={4} /></div>
          </div>
        </div>);
    }
    if (!sess) {
      return <ErrorState title="This session could not be found" body={poll.error || 'It may have been deleted, or the id in the address bar is wrong.'} onRetry={poll.refresh} />;
    }

    // ── derived display values ──────────────────────────────────────────────
    const displayName = (sess.person && sess.person.display_name) || (idn0 && idn0.full_name) || 'Guest';
    const since = sess.completed_at || sess.created_at;
    const workflowLabel = sess.workflow ? `${sess.workflow.name} · v${sess.workflow.version}` : '—';
    const channelLabel = [sess.channel, sess.origin].filter(Boolean).join(' · ') || '—';
    const isImported = sess.imported_from === 'didit';
    const importedAt = (decision && decision.engine && decision.engine.imported_at) || sess.created_at;
    const isTerminal = !!TERMINAL_STATUS[sess.status];
    const isDeclined = sess.status === 'Declined';

    const approveNeeds = isDeclined ? 'override_declined' : 'approve';
    const canApprove = can(approveNeeds) && sess.status !== 'Approved';
    const approveTooltip = !can(approveNeeds) ? (isDeclined ? NEEDS_ADMIN : NEEDS_ANALYST) : (sess.status === 'Approved' ? 'Already approved' : undefined);
    const canDecline = can('decline') && sess.status !== 'Declined';
    const declineTooltip = !can('decline') ? NEEDS_ANALYST : (sess.status === 'Declined' ? 'Already declined' : undefined);
    const canRedo = can('resubmit') && !isTerminal;
    const redoTooltip = !can('resubmit') ? NEEDS_ANALYST : (isTerminal ? 'This session is finished' : undefined);
    const canEdit = can('edit_data');
    const canAddToList = can('add_to_list');
    const canDelete = can('deletion');

    async function updateStatus(newStatus, body) {
      setBusy(newStatus);
      const r = await HWIdv.patch('/api/idv/sessions/' + encodeURIComponent(id) + '/update-status', Object.assign({ new_status: newStatus }, body || {}));
      setBusy(null);
      if (r.ok) {
        poll.refresh();
        return r;
      }
      const msg = (r.body && r.body.error) || r.error || ('HTTP ' + r.code);
      toast({ title: "That didn't go through", description: msg, tone: 'blocked' });
      return r;
    }

    function doApprove() {
      if (!canApprove || busy) return;
      updateStatus('Approved', { comment: '' }).then((r) => {
        if (r.ok) toast({ title: 'Approved', description: `#${sess.session_number} is approved.`, tone: 'ok' });
      });
    }
    function openDecline() { if (canDecline) { setConfirmComment(''); setConfirm('decline'); } }
    async function doDecline() {
      const r = await updateStatus('Declined', { comment: confirmComment.trim() });
      if (r.ok) { setConfirm(null); toast({ title: 'Declined', description: `#${sess.session_number} is declined.`, tone: 'warn' }); }
    }

    function toggleRedo(key) {
      setRedoSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    }
    async function sendRedo() {
      setBusy('resubmit');
      const r = await HWIdv.patch('/api/idv/sessions/' + encodeURIComponent(id) + '/update-status',
        { new_status: 'Resubmitted', comment: redoComment.trim(), nodes_to_resubmit: Array.from(redoSelected) });
      if (!r.ok) {
        setBusy(null);
        toast({ title: "That didn't go through", description: (r.body && r.body.error) || r.error, tone: 'blocked' });
        return;
      }
      const link = await HWIdv.post('/api/idv/sessions/' + encodeURIComponent(id) + '/resubmit-link', {});
      setBusy(null);
      poll.refresh();
      if (link.ok) {
        setResubmitResult(link.body);
        setRedoOpen(false); setRedoSelected(new Set()); setRedoComment('');
        toast({ title: 'Resubmission link ready', description: 'Status is now Awaiting User.', tone: 'ok' });
      } else {
        toast({ title: 'Status updated, but the link failed', description: (link.body && link.body.error) || link.error, tone: 'blocked' });
      }
    }

    async function submitDelete() {
      setBusy('delete');
      const r = await HWIdv.del('/api/idv/sessions/' + encodeURIComponent(id), { instruction: deleteInstruction, retain_face_template: retainTemplate });
      setBusy(null);
      if (r.ok) {
        setConfirm(null);
        toast({ title: 'Deletion requested', description: (r.body && r.body.deletion_request_id) ? `Request ${r.body.deletion_request_id} is queued for an admin to execute.` : 'Queued for an admin to execute.', tone: 'warn' });
        poll.refresh();
      } else {
        toast({ title: "That didn't go through", description: (r.body && r.body.error) || r.error, tone: 'blocked' });
      }
    }

    async function submitEdit(fields) {
      setBusy('edit');
      const body = Object.assign({}, fields, { node_id: idn0 && idn0.node_id });
      const r = await HWIdv.patch('/api/idv/sessions/' + encodeURIComponent(id) + '/update-data', body);
      setBusy(null);
      if (r.ok) { setEditOpen(false); poll.refresh(); toast({ title: 'Saved', description: 'The edit is in the trail.', tone: 'ok' }); }
      else toast({ title: "That didn't go through", description: (r.body && r.body.error) || r.error, tone: 'blocked' });
    }

    async function submitAddToList({ list_id, value, reason }) {
      setBusy('list');
      const r = await HWIdv.post('/api/idv/lists/' + encodeURIComponent(list_id) + '/entries',
        { value, reason, source_session_id: id });
      setBusy(null);
      if (r.ok) { setListOpen(false); toast({ title: 'Added to the list', description: reason, tone: 'ok' }); poll.refresh(); }
      else toast({ title: "That didn't go through", description: (r.body && r.body.error) || r.error, tone: 'blocked' });
    }

    async function downloadPdf() {
      setPdfBusy(true);
      try {
        const blob = await fetchBytes('/api/idv/sessions/' + encodeURIComponent(id) + '/pdf');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `verify-session-${sess.session_number}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast({ title: 'PDF downloaded', description: `verify-session-${sess.session_number}.pdf`, tone: 'ok' });
      } catch (e) {
        toast({ title: 'PDF did not download', description: 'request failed: ' + e.message, tone: 'blocked' });
      }
      setPdfBusy(false);
    }

    function copyLink(url) {
      navigator.clipboard?.writeText(url).catch(() => {});
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }

    // ── nodes for the decision list ──────────────────────────────────────────
    const nodes = [];
    if (decision) {
      (decision.id_verifications || []).forEach((n) => nodes.push({ key: 'doc-' + (n.node_id || '0'), label: 'Document · OCR & barcode', status: n.status, score: n.front_image_quality_score, threshold: thresholds && thresholds.doc_quality_min, caption: n.warnings && n.warnings[0] && n.warnings[0].short_description }));
      (decision.liveness_checks || []).forEach((n) => nodes.push({ key: 'live-' + (n.node_id || '0'), label: 'Liveness', status: n.status, score: n.score, threshold: thresholds && thresholds.liveness_min }));
      (decision.face_matches || []).forEach((n) => nodes.push({ key: 'face-' + (n.node_id || '0'), label: 'Face match', status: n.status, score: n.score, threshold: thresholds && thresholds.face_match_min }));
      (decision.age_estimations || []).forEach((n) => nodes.push({ key: 'age-' + (n.node_id || '0'), label: `Age · ${n.rule || 'rule'}`, status: n.status, score: n.score, caption: n.margin_ok === false ? 'Under the required margin' : undefined }));
      (decision.ip_analyses || []).forEach((n) => nodes.push({ key: 'ip-' + (n.node_id || '0'), label: 'IP & device', status: n.status, score: n.risk_score, caption: [n.tor && 'Tor', n.vpn && 'VPN', n.hosting && 'Hosting'].filter(Boolean).join(' · ') || 'No Tor, VPN or hosting signal' }));
      const hits = decision.list_hits || [];
      nodes.push({ key: 'lists', label: 'Lists', status: hits.length ? 'In Review' : 'Approved', score: null, caption: hits.length ? `${hits.length} hit${hits.length === 1 ? '' : 's'} — see below` : 'No hits on any checked list' });
    }

    const otherCrosschecks = decision && decision.crosschecks;
    // `primaryCC` is whichever of the two the session's document type reads —
    // same shape either way (contract: mrz_vs_ocr mirrors barcode_vs_ocr).
    const primaryCC = otherCrosschecks && (isPassport ? otherCrosschecks.mrz_vs_ocr : otherCrosschecks.barcode_vs_ocr);
    const ocrFailNote = primaryCC && primaryCC.status === 'DECODED_OCR_FAILED'
      ? `The print could not be read on this front; the ${isPassport ? 'MRZ' : 'barcode'} is the data source.`
      // NO_BARCODE is the only "nothing decoded" literal the contract names;
      // read defensively for a passport-specific analogue too in case the
      // engine sends one once it ships.
      : primaryCC && (primaryCC.status === 'NO_BARCODE' || primaryCC.status === 'NO_MRZ')
      ? (isPassport ? 'No MRZ was read; print only.' : 'No barcode was decoded; print only.')
      : null;

    const orderedMedia = MEDIA_ORDER.map((k) => media.find((m) => m.kind === k)).filter(Boolean)
      .concat(media.filter((m) => !MEDIA_ORDER.includes(m.kind)));

    const reviews = (decision && decision.reviews) || [];
    const events = (decision && decision.events) || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* ── pinned header + action bar ─────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 0, zIndex: P.z.sticky, background: P.bg, margin: '-20px -20px 0', padding: '20px 20px 14px', borderBottom: `1px solid ${P.hairline2}` }}>
          <button onClick={() => navigate('#/sessions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: 8,
            fontSize: P.type.meta, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Verifications
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: P.type.h1, fontWeight: 700, color: P.ink, letterSpacing: '-.02em' }}>#{sess.session_number} · {displayName}</h2>
              <div style={{ marginTop: 4, fontSize: P.type.body, color: P.inkDim, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span>{sess.status} since {fmt.relative(since)}</span><span>·</span>
                <span>{workflowLabel}</span><span>·</span>
                <span>{channelLabel}</span>
                {sess.vendor_data && <><span>·</span><span style={{ fontFamily: P.fontMono, fontSize: P.type.meta }}>vendor_data {sess.vendor_data}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <S.StatusPill status={sess.status} />
              <S.ReasonChips reasons={sess.reasons} />
              {isImported && <S.ImportedTag date={importedAt} />}
              {queue && queue.assigned_to && <Pill kind="info" size="sm" icon="user">Assigned · {queue.assigned_to}</Pill>}
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PBtn variant="accent" size="sm" icon="check-circle" busy={busy === 'Approved'} disabled={!canApprove || !!busy} title={approveTooltip} onClick={doApprove}>Approve</PBtn>
            <PBtn variant="danger" size="sm" icon="ban" disabled={!canDecline || !!busy} title={declineTooltip} onClick={openDecline}>Decline</PBtn>
            <PBtn variant="secondary" size="sm" iconRight="chevron-down" disabled={!canRedo || !!busy} title={redoTooltip} onClick={() => setRedoOpen((o) => !o)}>Ask to redo</PBtn>
            <PBtn variant="ghost" size="sm" icon="pencil" disabled={!canEdit || !decision} title={!canEdit ? NEEDS_ANALYST : (!decision ? 'No decision to edit yet' : undefined)} onClick={() => setEditOpen(true)}>Edit data</PBtn>
            <PBtn variant="ghost" size="sm" icon="list" disabled={!canAddToList} title={!canAddToList ? NEEDS_ANALYST : undefined} onClick={() => setListOpen(true)}>Add to list</PBtn>
            <PBtn variant="ghost" size="sm" icon="download" busy={pdfBusy} onClick={downloadPdf}>Download PDF</PBtn>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: P.fontMono, fontSize: 10.5, color: P.inkMute, whiteSpace: 'nowrap' }}>
              Approve <kbd>A</kbd> · Decline <kbd>D</kbd> · Redo <kbd>R</kbd>
            </span>
            <PBtn variant="ghost" size="sm" icon="trash" disabled={!canDelete} title={!canDelete ? NEEDS_ADMIN : undefined}
              style={{ color: canDelete ? P.bad : undefined }} onClick={() => { setConfirmComment(''); setConfirm('delete'); }}>Delete</PBtn>
          </div>

          {redoOpen && (
            <RedoPanel available={redoAvailable} selected={redoSelected} onToggle={toggleRedo}
              comment={redoComment} onComment={setRedoComment} busy={busy === 'resubmit'}
              onSend={sendRedo} onCancel={() => setRedoOpen(false)} />)}

          {resubmitResult && (
            <Card elevation="raised" style={{ marginTop: 10, background: P.infoSoft, border: `1px solid ${P.info}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name="link" size={14} color={P.info} /><span style={{ fontWeight: 700, color: P.ink }}>Resubmission link</span>
                <div style={{ flex: 1 }} /><IconBtn icon="x" onClick={() => setResubmitResult(null)} label="Dismiss" />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink }}>{resubmitResult.url}</code>
                <PBtn size="xs" variant="secondary" onClick={() => copyLink(resubmitResult.url)}>{copied ? 'Copied' : 'Copy'}</PBtn>
              </div>
              <div style={{ marginTop: 6, fontSize: P.type.meta, color: P.inkDim }}>
                Owner-only link — send it to the guest, not to a group chat. Expires {fmt.relative(resubmitResult.expires_at)}.
              </div>
            </Card>)}
        </div>

        {/* ── two-pane body ─────────────────────────────────────────────── */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0,340px) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>

          {/* LEFT — media, similar faces, consent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <Card padding={0}>
              <CardHead icon="camera" title="Media" right={<Pill kind="neutral" size="sm">{media.length}</Pill>} />
              <div style={{ padding: 12 }}>
                {media.length === 0
                  ? <EmptyState compact icon="camera" title="No media yet" body="Nothing has been captured on this session." />
                  : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {orderedMedia.map((m) => (
                        <MediaTile key={m.id} media={m} onOpen={(url, mm) => setLightbox({ src: url, isVideo: /^video\//.test(mm.mime || ''), label: MEDIA_LABEL[mm.kind] || mm.kind })} />
                      ))}
                    </div>}
                <div style={{ marginTop: 10, fontSize: P.type.micro, color: P.inkFaint, lineHeight: 1.5 }}>
                  Served by one route that forces the stored MIME type, sets nosniff, and requires a console role — fetched here with that role's header, never a bare link.
                </div>
              </div>
            </Card>

            <Card padding={0}>
              <CardHead icon="users-2" title="Similar faces" right={<Pill kind="neutral" size="sm">{similarFaces.length}</Pill>} />
              <div style={{ padding: 12 }}>
                {similarFaces.length === 0
                  ? <EmptyState compact icon="users-2" title="No similar faces" body="Nothing scored close enough to show." />
                  : <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
                      {similarFaces.map((f, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <FaceThumb face={f} />
                          <button onClick={() => navigate('#/sessions/' + encodeURIComponent(f.session_id))}
                            style={{ background: 'none', border: 'none', padding: 0, color: P.info, fontSize: P.type.micro, cursor: 'pointer', fontFamily: P.fontSans }}>
                            Open session
                          </button>
                        </div>))}
                    </div>}
              </div>
            </Card>

            <Card padding={0}>
              <CardHead icon="check-circle" title="Consent" />
              <div style={{ padding: 12 }}>
                {consents.length === 0
                  ? <div style={{ fontSize: P.type.body, color: P.inkMute }}>No consent recorded on this session.</div>
                  : consents.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
                      <span style={{ fontSize: P.type.body, color: P.ink }}>{c.kind}</span>
                      <span style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>{c.accepted_at ? fmt.date(c.accepted_at) : '—'}</span>
                    </div>))}
              </div>
            </Card>
          </div>

          {/* RIGHT — decision, cross-check, facts, lists, guidance, trail, events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <Card padding={0}>
              <CardHead icon="shield" title="Decision" right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {thresholdsFrom != null && (
                    <Pill kind="warn" size="sm" dot>thresholds from v{thresholdsFrom} — this session's v{wfVersion} was not found</Pill>)}
                  {decision && decision.engine ? <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>{decision.engine.name}{decision.engine.version ? ` ${decision.engine.version}` : ''}</span> : null}
                </div>} />
              {!decision
                ? <div style={{ padding: 16 }}><EmptyState compact icon="shield" title="No decision yet" body="The engine hasn't scored this session — there's no media, or it hasn't finished." /></div>
                : nodes.map((n) => <NodeRow key={n.key} {...n} />)}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card padding={0}>
                <CardHead icon={isPassport ? 'scroll' : 'barcode'} title={isPassport ? 'MRZ vs printed' : 'Cross-check'} />
                {crosscheckRows.length === 0
                  ? <div style={{ padding: 16 }}><EmptyState compact icon={isPassport ? 'scroll' : 'barcode'} title="Nothing to compare"
                      body={isPassport ? 'No MRZ read, or no document on this session.' : 'No barcode read, or no document on this session.'} /></div>
                  : (
                    <div style={{ overflowX: 'auto' }}>
                      {ocrFailNote && (
                        <div style={{ padding: '8px 12px', fontSize: P.type.meta, color: P.inkDim, borderBottom: `1px solid ${P.hairline2}` }}>{ocrFailNote}</div>)}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: P.type.meta }}>
                        <thead><tr style={{ background: P.surface2 }}>
                          {['Field', isPassport ? 'MRZ' : 'Barcode', 'Print (OCR)', 'Agrees'].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontWeight: 600, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1px solid ${P.hairline2}` }}>{h}</th>))}
                        </tr></thead>
                        <tbody>
                          {crosscheckRows.map((r, i) => (
                            <tr key={i} style={{ background: r.agrees === 'no' ? P.badSoft : 'transparent' }}>
                              <td style={{ padding: '7px 12px', borderTop: `1px solid ${P.hairline}`, color: P.ink }}>{r.field}</td>
                              <td style={{ padding: '7px 12px', borderTop: `1px solid ${P.hairline}`, fontFamily: P.fontMono, color: P.ink }}>{r.primary}</td>
                              <td style={{ padding: '7px 12px', borderTop: `1px solid ${P.hairline}`, fontFamily: P.fontMono, color: P.ink }}>{r.print}</td>
                              <td style={{ padding: '7px 12px', borderTop: `1px solid ${P.hairline}` }}>
                                <Pill kind={r.agrees === 'yes' ? 'good' : r.agrees === 'no' ? 'bad' : 'neutral'} size="sm">
                                  {r.agrees === 'yes' ? 'yes' : r.agrees === 'no' ? 'no' : r.agrees === 'missing' ? 'not read' : '—'}
                                </Pill>
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                      {(otherCrosschecks || (primaryCC && primaryCC.confidence != null)) && (
                        <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {primaryCC && primaryCC.confidence != null && <Pill kind="neutral" size="sm">Print read at {Math.round(primaryCC.confidence)}% confidence</Pill>}
                          {otherCrosschecks && otherCrosschecks.portrait_vs_selfie != null && <Pill kind="neutral" size="sm">Portrait vs selfie {fmt.score(otherCrosschecks.portrait_vs_selfie)}</Pill>}
                          {otherCrosschecks && otherCrosschecks.name_vs_expected && <Pill kind={otherCrosschecks.name_vs_expected === 'match' ? 'good' : otherCrosschecks.name_vs_expected === 'mismatch' ? 'bad' : 'neutral'} size="sm">Name vs expected: {otherCrosschecks.name_vs_expected}</Pill>}
                          {otherCrosschecks && otherCrosschecks.dob_vs_age_rule && <Pill kind={otherCrosschecks.dob_vs_age_rule === 'pass' ? 'good' : otherCrosschecks.dob_vs_age_rule === 'fail' ? 'bad' : 'neutral'} size="sm">DOB vs age rule: {otherCrosschecks.dob_vs_age_rule}</Pill>}
                        </div>)}
                    </div>)}
              </Card>

              <Card padding={0}>
                <CardHead icon="note" title="Session facts" />
                <div style={{ padding: '0 14px' }}>
                  <Kv label="Status" value={sess.status} mono />
                  <Kv label="Document type" value={DOC_TYPE_LABEL_LONG[documentType] || documentType} mono />
                  <Kv label="Reasons" value={(sess.reasons || []).join(', ') || 'none'} mono />
                  <Kv label="Channel · origin" value={channelLabel} mono />
                  {/* Device (2026-09-10 Addendum 3): parsed server-side from the
                      UA of the first capture `state` request, so it is null for
                      any session opened before that column existed, or one that
                      never got past the link (never opened). Rendered as one
                      "os · browser" line, never split into two Kv rows — that
                      matches how channelLabel above already joins two facts
                      with " · " rather than doubling the row count. */}
                  <Kv label="Device" value={[sess.device_os, sess.device_browser].filter(Boolean).join(' · ') || null} mono />
                  <Kv label="Workflow" value={workflowLabel} mono />
                  {/* Addendum 4, 2026-09-10: which state's medical-proof rule and out-of-state comparison this session ran under — pinned to the workflow VERSION this session was created on, same as `workflowLabel` above. */}
                  <Kv label="Jurisdiction" value={sess.jurisdiction || '—'} mono />
                  <Kv label="Liveness attempts" value={sess.liveness_attempts} mono />
                  <Kv label="Resubmissions" value={sess.resubmissions} mono />
                  <Kv label="Created" value={fmt.date(sess.created_at)} mono />
                  <Kv label="Expires" value={sess.expires_at ? fmt.date(sess.expires_at) : '—'} mono />
                  {queue && <Kv label="Queue" value={`priority ${queue.priority} · ${fmt.relative(queue.enqueued_at)}`} mono />}
                </div>
                <div style={{ height: 12 }} />
              </Card>
            </div>

            {/* ── Timing (2026-09-10 Addendum 3) ──────────────────────────────
                Always rendered, never conditioned on `sess.timing` existing —
                the addendum's own instruction ("code defensively, render '—'
                when timing is absent") means an empty card full of dashes is
                the correct state for a session opened before the backend
                shipped this, not a hidden card. `st.session_timing` computes
                this server-side from timestamps this screen otherwise has no
                access to (media captured_at, decision computed_at, audit
                rows) — there is nothing to derive client-side as a fallback. */}
            {(() => {
              const timing = sess.timing || null;
              const stepsByKey = {};
              (timing && timing.steps || []).forEach((r) => { if (r && r.step) stepsByKey[r.step] = r; });
              const retakes = timing && timing.retakes;
              return (
                <Card padding={0}>
                  <CardHead icon="clock" title="Timing" right={
                    timing && timing.total_s == null ? <Pill kind="info" size="sm">still open</Pill> : null} />
                  <div style={{ padding: '0 14px' }}>
                    <Kv label="Total (opened → decision)" value={timing ? S.fmtDuration(timing.total_s) : '—'} mono />
                    <Kv label="Before opening" value={timing ? S.fmtDuration(timing.before_open_s) : '—'} mono />
                    <Kv label="Base (first pass)" value={timing ? S.fmtDuration(timing.base_s) : '—'} mono />
                    <Kv label="Retakes" value={timing ? `${S.fmtDuration(timing.retake_s)}${retakes ? ` · ${retakes} retake${retakes === 1 ? '' : 's'}` : (retakes === 0 ? ' · none' : '')}` : '—'} mono />
                  </div>
                  <div style={{ padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(S.TIMING_STEPS || []).map((st) => (
                      <TimingBarStep key={st.key} label={st.label} row={stepsByKey[st.key]} totalS={timing && timing.total_s} />
                    ))}
                  </div>
                </Card>);
            })()}

            {/* ── MRZ (passports only, 2026-09-09 contract) ──────────────────
                Format, the identity fields the MRZ itself carries, and the
                five check digits as green/red/grey ticks (grey = not
                applicable — `personal_number` is `bool|null`). This is the
                MRZ's OWN read, not the cross-check above: the table compares
                it against the visual zone, this card just shows what it is. */}
            {isPassport && idn0 && idn0.mrz && (
              <Card padding={0}>
                <CardHead icon="scroll" title="MRZ" right={
                  <Pill kind={idn0.mrz.valid ? 'good' : 'bad'} size="sm" dot>{idn0.mrz.valid ? 'valid' : 'invalid'}</Pill>} />
                <div style={{ padding: '0 14px' }}>
                  <Kv label="Format" value={idn0.mrz.format} mono />
                  <Kv label="Document number" value={idn0.mrz.document_number} mono />
                  <Kv label="Nationality" value={idn0.mrz.nationality} mono />
                  <Kv label="Issuing state" value={idn0.mrz.issuing_state} mono />
                  <Kv label="Date of birth" value={idn0.mrz.date_of_birth} mono />
                  <Kv label="Expiration date" value={idn0.mrz.expiration_date} mono />
                  <Kv label="Sex" value={idn0.mrz.sex} mono />
                </div>
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {MRZ_CHECK_ORDER.map((k) => {
                    const v = idn0.mrz.checks ? idn0.mrz.checks[k] : null;
                    const ok = v === true, bad = v === false;
                    return (
                      <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: P.type.meta,
                        color: ok ? P.good : bad ? P.bad : P.inkMute }}>
                        <Icon name={ok ? 'check-circle' : bad ? 'x' : 'minus'} size={13} stroke={2} />
                        {MRZ_CHECK_LABEL[k] || k}
                      </span>);
                  })}
                </div>
                {idn0.mrz.ocr_confidence != null && (
                  <div style={{ padding: '0 14px 10px', fontSize: P.type.micro, color: P.inkMute }}>
                    Read at {Math.round(idn0.mrz.ocr_confidence)}% confidence
                  </div>)}
              </Card>)}

            {/* ── doctor's recommendation (medical_rec, MED_18_REC gap C) ────
                Only rendered when the engine sent a node at all — the same
                "was one submitted" test as `medRec` above. Reasons combine
                `engine_detail.status_reason` (the engine's own opinion) with
                any MED_REC_* code already in `sess.reasons` (the rules'
                verdict), deduped — either can be present without the other
                depending on where in the flow the session currently sits. */}
            {medRec && (() => {
              const medReasons = Array.from(new Set([
                medRec.engine_detail && medRec.engine_detail.status_reason,
                ...((sess && sess.reasons) || []).filter((r) => String(r).indexOf('MED_REC_') === 0),
              ].filter(Boolean)));
              const cross = medRec.crosscheck || {};
              const agreePill = (v) => (
                <Pill kind={v === 'match' ? 'good' : v === 'mismatch' ? 'bad' : 'neutral'} size="sm">
                  {v === 'match' ? 'agrees' : v === 'mismatch' ? 'disagrees' : 'not read'}
                </Pill>);
              return (
                <Card padding={0}>
                  <CardHead icon="leaf" title="Doctor's recommendation" right={
                    <Pill kind={MED_REC_STATUS_TONE[medRec.status] || 'neutral'} size="sm" dot>{medRec.status || 'Unknown'}</Pill>} />
                  <div style={{ padding: '0 14px' }}>
                    <Kv label="Physician name" value={medRec.physician_name} />
                    <Kv label="Licence number" value={medRec.physician_license} mono />
                    <Kv label="Licence state" value={medRec.license_state} mono />
                    <Kv label="Patient name" value={medRec.patient_name} />
                    <Kv label="Issue date" value={medRec.issue_date} mono />
                    <Kv label="Expiration date" value={medRec.expiration_date} mono />
                  </div>
                  <div style={{ padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: P.type.meta, color: P.inkDim }}>Name vs ID {agreePill(cross.name_vs_document)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: P.type.meta, color: P.inkDim }}>DOB vs ID {agreePill(cross.dob_vs_document)}</span>
                  </div>
                  {medRec.ocr_confidence != null && (
                    <div style={{ padding: '0 14px 10px', fontSize: P.type.micro, color: P.inkMute }}>
                      Read at {Math.round(medRec.ocr_confidence)}% confidence
                    </div>)}
                  {medReasons.length > 0 && (
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {medReasons.map((code) => (
                        <div key={code} style={{ fontSize: P.type.meta, color: P.ink }}>
                          <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>{code}</span> — {MED_REC_REASON_TEXT[code] || 'See the reason code.'}
                        </div>))}
                    </div>)}
                </Card>);
            })()}

            <Card padding={0}>
              <CardHead icon="ban" title="List hits" right={<Pill kind={decision && decision.list_hits && decision.list_hits.length ? 'bad' : 'good'} size="sm">{decision && decision.list_hits ? decision.list_hits.length : 0}</Pill>} />
              <div style={{ padding: 12 }}>
                {!decision || !decision.list_hits || !decision.list_hits.length
                  ? <div style={{ fontSize: P.type.body, color: P.inkMute }}>No list hits.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {decision.list_hits.map((h, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: P.badSoft, borderRadius: P.r8 }}>
                          <Icon name="flag" size={13} color={P.bad} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{h.list_name}</div>
                            <div style={{ fontSize: P.type.meta, color: P.inkDim }}>{h.list_type}/{h.entry_type} · {h.reason}</div>
                          </div>
                        </div>))}
                    </div>}
              </div>
            </Card>

            {(sess.guidance || sess.next_step) && (
              <Card style={{ background: P.warnSoft, border: `1px solid ${P.warn}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon name="megaphone" size={14} color={P.warnText} /><span style={{ fontWeight: 700, color: P.ink }}>Shown to the guest</span>
                </div>
                {sess.guidance && (
                  <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>
                    {sess.guidance.fix || sess.guidance.step}{sess.guidance.attempt != null ? ` (attempt ${sess.guidance.attempt} of ${sess.guidance.max})` : ''}
                  </div>)}
                {sess.next_step && sess.next_step !== 'none' && (
                  <div style={{ marginTop: 6, fontSize: P.type.body, color: P.ink2 }}>Next step: {sess.next_step === 'in_store' ? 'Bring a physical ID to any Hyperwolf store.' : sess.next_step}</div>)}
              </Card>)}

            <Card padding={0}>
              <CardHead icon="user-check" title="Analyst trail" right={<Pill kind="neutral" size="sm">{reviews.length}</Pill>} />
              <div style={{ padding: 12 }}>
                {reviews.length === 0
                  ? <div style={{ fontSize: P.type.body, color: P.inkMute }}>No analyst actions yet.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {reviews.map((r) => (
                        <div key={r.id} style={{ display: 'flex', gap: 10 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: P.info, marginTop: 5, flex: '0 0 auto' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{REVIEW_ACTION_LABEL[r.action] || r.action}{r.analyst && r.analyst.name ? ` · ${r.analyst.name}` : ''}</div>
                            <div style={{ fontSize: P.type.meta, color: P.inkDim }}>{fmt.date(r.created_at)}{r.from_status ? ` · ${r.from_status} → ${r.to_status}` : ''}</div>
                            {r.comment && <div style={{ marginTop: 3, fontSize: P.type.body, color: P.ink2, fontStyle: 'italic' }}>“{r.comment}”</div>}
                            {r.diff && (
                              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {Object.keys(r.diff).map((k) => (
                                  <span key={k} style={{ fontSize: 10.5, fontFamily: P.fontMono, color: P.inkDim, background: P.surface3, borderRadius: P.r999, padding: '2px 7px' }}>
                                    {k}: {String(r.diff[k][0])} → {String(r.diff[k][1])}
                                  </span>))}
                              </div>)}
                          </div>
                        </div>))}
                    </div>}
              </div>
            </Card>

            <Card padding={0}>
              <button onClick={() => setEventsOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <Icon name="clock" size={14} color={P.inkDim} />
                <span style={{ flex: 1, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Events</span>
                <Pill kind="neutral" size="sm">{events.length}</Pill>
                <Icon name={eventsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={P.inkMute} />
              </button>
              {eventsOpen && (
                <div style={{ padding: '0 14px 12px' }}>
                  {events.length === 0
                    ? <div style={{ fontSize: P.type.body, color: P.inkMute }}>No events recorded.</div>
                    : events.map((e, i) => (
                      <div key={e.event_id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
                        <span style={{ fontSize: P.type.meta, color: P.ink }}>{e.type}{e.status_from ? ` · ${e.status_from} → ${e.status_to}` : ''}</span>
                        <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{e.source} · {fmt.date(e.received_at)}{e.signature_ok === false ? ' · unsigned' : ''}</span>
                      </div>))}
                </div>)}
            </Card>
          </div>
        </div>

        {lightbox && <Lightbox src={lightbox.src} isVideo={lightbox.isVideo} label={lightbox.label} onClose={() => setLightbox(null)} />}

        {confirm === 'decline' && (
          <ConfirmDialog title="Decline this session?" tone="bad" confirmLabel="Decline" requireComment
            body="The guest sees a path back — bring a physical ID to any Hyperwolf store. This is recorded in the trail."
            comment={confirmComment} onComment={setConfirmComment} busy={busy === 'Declined'}
            onConfirm={doDecline} onClose={() => setConfirm(null)} />)}

        {confirm === 'delete' && (
          <ConfirmDialog title="Request deletion?" tone="bad" confirmLabel="Request deletion" requireComment={false}
            body="This writes a deletion request; an admin has to execute it before anything is actually removed. Nothing is deleted by this step alone."
            comment={confirmComment} onComment={setConfirmComment} busy={busy === 'delete'}
            extra={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: P.type.body, color: P.ink, cursor: 'pointer' }}>
                  <input type="radio" checked={deleteInstruction === 'operational_session_delete'} onChange={() => setDeleteInstruction('operational_session_delete')} />
                  Operational delete (this session's own media)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: P.type.body, color: P.ink, cursor: 'pointer' }}>
                  <input type="radio" checked={deleteInstruction === 'privacy_erasure'} onChange={() => setDeleteInstruction('privacy_erasure')} />
                  Privacy erasure (this person, everywhere)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: P.type.body, color: P.ink, cursor: 'pointer' }}>
                  <Check on={retainTemplate} onChange={setRetainTemplate} /> Retain the face template (blocklist purposes)
                </label>
              </div>)}
            onConfirm={submitDelete} onClose={() => setConfirm(null)} />)}

        {editOpen && idn0 && (
          <EditDataDialog initial={{ first_name: idn0.first_name, last_name: idn0.last_name, date_of_birth: idn0.date_of_birth, gender: idn0.gender, document_type: idn0.document_type, document_number: idn0.document_number, issuing_state: idn0.issuing_state, nationality: idn0.nationality, date_of_issue: idn0.date_of_issue, expiration_date: idn0.expiration_date, address: idn0.address, parsed_address: idn0.parsed_address }}
            busy={busy === 'edit'} onSubmit={submitEdit} onClose={() => setEditOpen(false)} />)}

        {listOpen && (
          <AddToListDialog busy={busy === 'list'} onSubmit={submitAddToList} onClose={() => setListOpen(false)} />)}
      </div>);
  }

  window.IdvSessionScreen = IdvSessionScreen;
})();
