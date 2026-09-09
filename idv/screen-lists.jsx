// ── idv/screen-lists.jsx ── window.IdvListsScreen ── Lists (routes #/lists, #/lists/:id) ──
// Didit-compatible lists: eleven system lists seeded at migration (docs/IDV-
// PLAN-2026-09-08.md §3.7), matched during the decision step so a hit lands
// as a `list_hits[]` warning carrying the list id — never a silent decline.
// Blocklisting is a judgement about a person: the system never adds to a
// blocklist on its own (plan §11.8) — this screen is where a HUMAN does it,
// and every blocklist view says so.
//
// ROUTING NOTE — why `#/lists/:id` is handled INSIDE this file rather than by
// idv/app.jsx's router: app.jsx's SCREEN_SOURCE/ROUTES() only special-case a
// parametric path for session detail (SESSION_DETAIL_RE); there is no
// equivalent regex for `/lists/:id`, and this task is scoped to this file
// only — app.jsx is not touched. So a real `location.hash` change to
// `#/lists/l_xxx` would make app.jsx's own router look up `screenFor('/lists
// /l_xxx')`, find nothing, and swap this whole screen out for the "did not
// load" ErrorState. To avoid that, list-detail navigation is done with
// `history.replaceState` (which does NOT fire `hashchange` and so never
// reaches app.jsx's listener) — the address bar still reflects `#/lists/<id>`
// for copy-paste, but the swap between master and detail is local React
// state. A cold load of `#/lists/<id>` therefore still shows the app-level
// "did not load" screen (app.jsx has no route for it) — that is a real gap,
// listed in this file's own contract-gaps note at the bottom.
//
// MEDIA — face-list entries. `docs/IDV-API-CONTRACT.md`'s Media route is
// role-gated (`GET /api/idv/media/{id}`, `X-HW-Actor` required, audited), so
// a plain `<img src>` cannot carry that header. Entries' face thumbnails are
// fetched with `fetch()` + the actor header, turned into a blob URL, and
// revoked on unmount — `useAuthedBlob` below. `IdvShared.MediaThumb` was not
// reused here because it renders `<img src={media.url}>` directly with no
// header, which is fine for the Decision object's already-authorised inline
// fetch, not for a role-gated console list.
//
// MEDIA UPLOAD — face-list "Add entry" now creates the `media_id` the
// entries route requires. docs/IDV-API-CONTRACT.md addendum H added
// `POST /api/idv/media` (analyst+, multipart `kind`/`file`/optional
// `session_id`) precisely to fill the gap this file used to document here:
// the only OTHER media-upload route, `POST /api/idv/capture/{token}/media`,
// is session-token bearer, not a console/analyst route. `uploadMedia()`
// below calls the new route directly with `fetch` + FormData rather than
// through `window.HWIdv.post()`, because that helper always sends
// `Content-Type: application/json` — adding a multipart path there is an
// edit to a shared file this task is not scoped to touch. Same actor header
// / same-origin write-token convention as idv-client.jsx's writeVerb(),
// minus Content-Type, which the browser must set itself (with the
// multipart boundary) rather than have it set manually.
;(function () {
  const useP = window.useP;

  // ── enums → presentation, never invented data ──────────────────────────
  const LIST_TYPE_TONE = { blocklist: 'bad', allowlist: 'good', custom: 'neutral' };
  const LIST_TYPE_LABEL = { blocklist: 'Blocklist', allowlist: 'Allowlist', custom: 'Custom' };
  const SOURCE_LABEL = { system: 'System', user: 'User', 'didit-import': 'Didit import' };
  // Friendly labels for the entry_type enum actually seen on this backend
  // (11 values — the plan §3.7 DDL comment lists 8 and the live seed adds
  // bank/wallet/business; see this file's contract-gaps note).
  const ENTRY_TYPE_LABEL = {
    user: 'Person', document: 'Document no.', face: 'Face template', ip: 'IP / CIDR',
    device: 'Device id', email: 'Email (hashed)', phone: 'Phone (hashed)', country: 'Country',
    bank: 'Account', wallet: 'Wallet address', business: 'Business',
  };
  function entryTypeLabel(t) {
    if (!t) return '—';
    return ENTRY_TYPE_LABEL[t] || (t[0].toUpperCase() + t.slice(1).replace(/_/g, ' '));
  }
  // The real entry_type enum, for the Create-list dialog's dropdown — kept
  // as what the backend actually returns (checked live), not the plan's
  // smaller documented set.
  const ENTRY_TYPES = ['user', 'document', 'face', 'ip', 'device', 'email', 'phone', 'country', 'bank', 'wallet', 'business'];
  const LIST_TYPES = ['blocklist', 'allowlist', 'custom'];

  function fmtDate(iso) { return window.HWIdv ? window.HWIdv.fmt.date(iso) : iso; }
  function fmtRelative(iso) { return window.HWIdv ? window.HWIdv.fmt.relative(iso) : iso; }

  // ── useAuthedBlob(url) — role-gated media as a blob-URL, never a bare <img src> ──
  function useAuthedBlob(url) {
    const [state, setState] = React.useState({ url: null, loading: !!url, failed: false });
    React.useEffect(() => {
      if (!url) { setState({ url: null, loading: false, failed: false }); return undefined; }
      let alive = true, objectUrl = null;
      setState({ url: null, loading: true, failed: false });
      const L = window.HW_LIVE;
      const base = (L && L.base) || '';
      const session = window.HWIdv ? window.HWIdv.session() : null;
      const headers = session && session.id ? { 'X-HW-Actor': session.id } : {};
      fetch(base + url, { method: 'GET', headers, credentials: 'omit', cache: 'no-store' })
        .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.blob(); })
        .then((blob) => {
          if (!alive) return;
          objectUrl = URL.createObjectURL(blob);
          setState({ url: objectUrl, loading: false, failed: false });
        })
        .catch(() => { if (alive) setState({ url: null, loading: false, failed: true }); });
      return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [url]);
    return state;
  }

  // ── uploadMedia(kind, file, sessionId) — POST /api/idv/media (analyst+) ──
  // Multipart, so it cannot go through window.HWIdv.post() (JSON-only — see
  // this file's header comment). Mirrors idv-client.jsx's writeVerb(): same
  // X-HW-Actor header, same same-origin write-token lookup off the
  // `hw-live-token` localStorage key, never rejects. Resolves to
  // { ok, code, body, error } — no `gated` flag, since a multipart upload has
  // no read-only-mode probe to make sense of.
  function uploadMedia(kind, file, sessionId) {
    const L = window.HW_LIVE;
    if (!L || typeof L.post !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam' });
    }
    const base = L.base || '';
    const sameOrigin = !base || base === window.location.origin;
    const session = window.HWIdv ? window.HWIdv.session() : null;
    const headers = {};
    if (session && session.id) headers['X-HW-Actor'] = session.id;
    if (sameOrigin) {
      let token = null;
      try { token = (window.localStorage.getItem('hw-live-token') || '').trim() || null; } catch (e) { token = null; }
      if (token) headers['x-hw-write-token'] = token;
    }
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    if (sessionId) form.append('session_id', sessionId);
    return fetch(base + '/api/idv/media', { method: 'POST', credentials: 'omit', cache: 'no-store', headers, body: form })
      .then((res) => res.json().then(
        (j) => ({ ok: res.ok, code: res.status, body: j, error: (j && j.error) || (res.ok ? null : ('HTTP ' + res.status)) }),
        () => ({ ok: res.ok, code: res.status, body: null, error: res.ok ? null : ('HTTP ' + res.status) })))
      .catch((e) => ({ ok: false, code: 0, body: null, error: 'request failed: ' + (e && e.message ? e.message : 'unknown') }));
  }

  function FaceThumb({ mediaUrl, size = 44 }) {
    const P = useP();
    const { url, loading, failed } = useAuthedBlob(mediaUrl);
    return (
      <div style={{ width: size, height: size, borderRadius: P.r8, overflow: 'hidden', flex: '0 0 auto',
        background: P.canvas2, border: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {url ? (
          <img src={url} alt="Face on this list" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Icon name={loading ? 'clock' : failed ? 'user-off' : 'user'} size={size * 0.4} stroke={1.7} color={P.inkMute} />
        )}
      </div>);
  }

  function ListTypePill({ type, size = 'sm' }) {
    return <Pill kind={LIST_TYPE_TONE[type] || 'neutral'} dot size={size}>{LIST_TYPE_LABEL[type] || type}</Pill>;
  }

  // ── BlocklistNote — plan §11.8, verbatim intent, own words ───────────────
  function BlocklistNote({ style }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', background: P.highlightSoft,
        border: `1px solid ${P.hairline2}`, borderRadius: P.r12, ...style }}>
        <Icon name="user" size={15} stroke={1.9} color={P.inkDim} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
          Blocklisting is a judgement about a person — the system never adds to a blocklist on its own.
        </div>
      </div>);
  }

  // ── Create list — admin-only ─────────────────────────────────────────────
  function CreateListDialog({ open, onClose, onCreated }) {
    const P = useP();
    const [name, setName] = React.useState('');
    const [listType, setListType] = React.useState('custom');
    const [entryType, setEntryType] = React.useState('user');
    const [description, setDescription] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);

    React.useEffect(() => {
      if (!open) return undefined;
      setName(''); setListType('custom'); setEntryType('user'); setDescription(''); setErr(null);
      const onKey = (e) => e.key === 'Escape' && !busy && onClose();
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line
    }, [open]);

    if (!open) return null;

    async function submit() {
      if (!name.trim()) { setErr('Name a list before creating it.'); return; }
      setBusy(true); setErr(null);
      const r = await window.HWIdv.post('/api/idv/lists', {
        name: name.trim(), list_type: listType, entry_type: entryType,
        description: description.trim() || null,
      });
      setBusy(false);
      if (!r.ok) { setErr(r.error || `The list wasn't created (HTTP ${r.code}).`); return; }
      window.hdToast && window.hdToast({ title: 'List created', description: `${name.trim()} is ready for entries.`, tone: 'ok' });
      onCreated(r.body);
    }

    return (
      <div style={overlayScrim(P, {})} onClick={() => !busy && onClose()}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...overlayCard, width: 'min(480px,96%)', background: P.surface,
          border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>Create list</div>
            <IconBtn icon="x" onClick={onClose} label="Close" disabled={busy} />
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Name</span>
            <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Suspect devices" />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Kind</span>
            <Seg value={listType} onChange={setListType} options={LIST_TYPES.map((t) => ({ value: t, label: LIST_TYPE_LABEL[t] }))} full />
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Entry type</span>
            <select value={entryType} onChange={(e) => setEntryType(e.target.value)}
              style={{ minHeight: P.ctrlH.md, padding: '0 12px', background: P.field, border: `1px solid ${P.fieldBorder}`,
                borderRadius: P.r8, color: P.ink, fontFamily: P.fontSans, fontSize: P.type.body }}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{entryTypeLabel(t)}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Description (optional)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              style={{ padding: '9px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8,
                color: P.ink, fontFamily: P.fontSans, fontSize: P.type.body, resize: 'vertical', minHeight: 60 }} />
          </label>

          {err && <div style={{ fontSize: P.type.meta, color: P.bad }}>{err}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <PBtn variant="ghost" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="accent" onClick={submit} busy={busy}>Create list</PBtn>
          </div>
        </div>
      </div>);
  }

  // ── Add entry — analyst+ ──────────────────────────────────────────────────
  function AddEntryDialog({ list, open, onClose, onAdded }) {
    const P = useP();
    const isFace = list && list.entry_type === 'face';
    const [value, setValue] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [expiresAt, setExpiresAt] = React.useState('');
    const [sourceSessionId, setSourceSessionId] = React.useState('');
    const [file, setFile] = React.useState(null);
    const [fileErr, setFileErr] = React.useState(null);
    const [previewUrl, setPreviewUrl] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const dropRef = React.useRef(null);

    React.useEffect(() => {
      if (!open) return undefined;
      setValue(''); setReason(''); setExpiresAt(''); setSourceSessionId('');
      setFile(null); setFileErr(null); setPreviewUrl(null); setErr(null);
      const onKey = (e) => e.key === 'Escape' && !busy && onClose();
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line
    }, [open]);

    React.useEffect(() => {
      if (!file) { setPreviewUrl(null); return undefined; }
      const u = URL.createObjectURL(file);
      setPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    }, [file]);

    if (!open || !list) return null;

    function pickFile(f) {
      setFileErr(null); setFile(null);
      if (!f) return;
      if (!/^image\/(jpeg|png)$/.test(f.type)) { setFileErr('Only JPEG or PNG is accepted.'); return; }
      if (f.size > 8 * 1024 * 1024) { setFileErr('That file is over 8 MB.'); return; }
      setFile(f);
    }

    async function submit() {
      setErr(null);
      if (!reason.trim()) { setErr('Say why this is being added — it goes in the audit trail.'); return; }
      if (!isFace && !value.trim()) { setErr('Enter a value to add.'); return; }
      if (isFace && !file) { setErr('Choose a photo first.'); return; }
      setBusy(true);
      let mediaId = null;
      if (isFace) {
        const mr = await uploadMedia('face_list', file, sourceSessionId.trim() || null);
        if (!mr.ok) {
          setBusy(false);
          setErr((mr.body && mr.body.error) || mr.error || `The photo wasn't uploaded (HTTP ${mr.code}).`);
          return;
        }
        mediaId = mr.body && mr.body.media && mr.body.media.id;
      }
      const r = await window.HWIdv.post(`/api/idv/lists/${encodeURIComponent(list.id)}/entries`, {
        value: isFace ? null : value.trim(),
        media_id: isFace ? mediaId : null,
        reason: reason.trim(),
        expires_at: expiresAt || null,
        source_session_id: sourceSessionId.trim() || null,
      });
      setBusy(false);
      if (!r.ok) { setErr(r.error || `The entry wasn't added (HTTP ${r.code}).`); return; }
      window.hdToast && window.hdToast({ title: 'Entry added', description: `Added to ${list.name}.`, tone: 'ok' });
      onAdded();
    }

    return (
      <div style={overlayScrim(P, {})} onClick={() => !busy && onClose()}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...overlayCard, width: 'min(520px,96%)', background: P.surface,
          border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>Add to {list.name}</div>
              <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 2 }}>{entryTypeLabel(list.entry_type)} · <ListTypePill type={list.list_type} /></div>
            </div>
            <IconBtn icon="x" onClick={onClose} label="Close" disabled={busy} />
          </div>

          {list.list_type === 'blocklist' && <BlocklistNote />}

          {isFace ? (
            <React.Fragment>
              <div ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '22px 16px', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r12, background: P.canvas2, textAlign: 'center' }}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected face" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: P.r8, border: `1px solid ${P.hairline}` }} />
                ) : (
                  <Icon name="camera" size={26} stroke={1.6} color={P.inkMute} />
                )}
                <div style={{ fontSize: P.type.body, color: P.ink2 }}>{file ? file.name : 'Drop a photo here, or choose a file'}</div>
                <div style={{ fontSize: P.type.meta, color: P.inkFaint }}>JPEG or PNG · face must be clear · ≤ 8 MB</div>
                <label style={{ marginTop: 2 }}>
                  <input type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
                    onChange={(e) => pickFile(e.target.files && e.target.files[0])} />
                  <span data-hw-i style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: P.ctrlH.sm, padding: '0 12px',
                    fontSize: P.type.meta, fontWeight: 600, border: `1px solid ${P.hairline3}`, borderRadius: P.r8, color: P.ink, cursor: 'pointer' }}>
                    Choose photo
                  </span>
                </label>
                {fileErr && <div style={{ fontSize: P.type.meta, color: P.bad }}>{fileErr}</div>}
              </div>
            </React.Fragment>
          ) : (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Value</span>
              <Field value={value} onChange={(e) => setValue(e.target.value)} placeholder={`e.g. a ${entryTypeLabel(list.entry_type).toLowerCase()}`} mono />
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Why <span style={{ color: P.inkFaint, fontWeight: 500 }}>— required, written to the audit trail</span></span>
            <Field value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened, in one sentence" />
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Expires (optional)</span>
              <Field value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="date" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkDim }}>Session it came from (optional)</span>
              <Field value={sourceSessionId} onChange={(e) => setSourceSessionId(e.target.value)} placeholder="session id" mono />
            </label>
          </div>

          {err && <div style={{ fontSize: P.type.meta, color: P.bad }}>{err}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <PBtn variant="ghost" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant={list.list_type === 'blocklist' ? 'danger' : 'accent'} onClick={submit} busy={busy} disabled={busy || (isFace && !file)}>
              {list.list_type === 'blocklist' ? 'Add to blocklist' : 'Add entry'}
            </PBtn>
          </div>
        </div>
      </div>);
  }

  // ── Remove entry, with an inline (not native) confirm ────────────────────
  function RemoveEntryButton({ onConfirm }) {
    const P = useP();
    const [confirming, setConfirming] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    if (confirming) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: P.type.meta, color: P.inkDim, whiteSpace: 'nowrap' }}>Remove?</span>
          <PBtn variant="danger" size="xs" busy={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); setConfirming(false); }}>Yes</PBtn>
          <PBtn variant="ghost" size="xs" onClick={() => setConfirming(false)} disabled={busy}>No</PBtn>
        </div>);
    }
    return <IconBtn icon="trash" label="Remove entry" title="Remove entry" onClick={() => setConfirming(true)} />;
  }

  // ── useListEntries — one-shot fetch + manual refresh ─────────────────────
  // Not a `usePoll`: `GET /api/idv/lists/{id}/entries` carries no idv_version
  // field (checked live and against the contract — see this file's
  // contract-gaps note), so there is nothing to short-circuit on, and a
  // detail view opened by a click does not need a standing interval. Writes
  // (add/remove) call `refresh()` directly — "re-GET after writes".
  function useListEntries(listId) {
    const [state, setState] = React.useState({ loading: true, error: null, rows: null });
    const fetchIt = React.useCallback(() => {
      if (!window.HWIdv) { setState({ loading: false, error: 'no-live-seam', rows: null }); return Promise.resolve(); }
      return window.HWIdv.get(`/api/idv/lists/${encodeURIComponent(listId)}/entries`).then((r) => {
        if (!r.ok) { setState((s) => ({ loading: false, error: r.error || `HTTP ${r.code}`, rows: s.rows })); return; }
        setState({ loading: false, error: null, rows: (r.body && r.body.rows) || [] });
      });
    }, [listId]);
    React.useEffect(() => { setState({ loading: true, error: null, rows: null }); fetchIt(); }, [listId, fetchIt]);
    return { loading: state.loading, error: state.error, rows: state.rows, refresh: fetchIt };
  }

  // ── List detail ───────────────────────────────────────────────────────────
  function ListDetail({ list, onBack, canWrite, navigate, onListsChanged }) {
    const P = useP();
    const entries = useListEntries(list.id);
    const [showAdd, setShowAdd] = React.useState(false);

    function afterWrite() { entries.refresh(); onListsChanged(); }

    return (
      <div>
        <button data-hw-i onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none',
          border: 'none', cursor: 'pointer', color: P.inkDim, fontSize: P.type.meta, fontWeight: 600, padding: '4px 0', marginBottom: 10 }}>
          <Icon name="chevron-left" size={14} stroke={2} /> Back to lists
        </button>

        <SectionHead
          eyebrow={SOURCE_LABEL[list.source] || list.source}
          title={list.name}
          subtitle={list.description || undefined}
          action={canWrite ? <PBtn variant="accent" icon="plus" onClick={() => setShowAdd(true)}>Add entry</PBtn> : undefined}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <ListTypePill type={list.list_type} />
          <Pill kind="neutral" size="sm">{entryTypeLabel(list.entry_type)}</Pill>
          <span style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>
            {entries.rows ? entries.rows.length : list.entries} {(entries.rows ? entries.rows.length : list.entries) === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {list.list_type === 'blocklist' && <BlocklistNote style={{ marginBottom: 14 }} />}

        {entries.loading ? (
          <IdvShared.SkeletonTable rows={4} />
        ) : entries.error ? (
          entries.error === 'no-live-seam'
            ? <IdvShared.NotConnected onRetry={entries.refresh} />
            : <ErrorState onRetry={entries.refresh} detail={entries.error} />
        ) : !entries.rows.length ? (
          <EmptyState icon="list" title="No entries in this list yet"
            body={canWrite ? 'Add the first one above.' : 'Nothing has been added to this list.'} />
        ) : (
          <EntriesTable list={list} rows={entries.rows} canWrite={canWrite} navigate={navigate} afterWrite={afterWrite} />
        )}

        <AddEntryDialog list={list} open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); afterWrite(); }} />
      </div>);
  }

  // ── Entries table ─────────────────────────────────────────────────────────
  function EntriesTable({ list, rows, canWrite, navigate, afterWrite }) {
    const P = useP();
    const isFace = list.entry_type === 'face';

    // DELETE has no body and HWIdv.post always issues a POST, so this is the
    // one call site in the file that talks to fetch() directly rather than
    // through window.HWIdv — same actor-header/base plumbing as idv-client.jsx's
    // own post(), for the one verb (DELETE) that client doesn't expose.
    async function removeEntry(entryId) {
      const L = window.HW_LIVE;
      const base = (L && L.base) || '';
      const session = window.HWIdv.session();
      const headers = session && session.id ? { 'X-HW-Actor': session.id } : {};
      try {
        const res = await fetch(`${base}/api/idv/lists/${encodeURIComponent(list.id)}/entries/${encodeURIComponent(entryId)}`,
          { method: 'DELETE', headers, credentials: 'omit', cache: 'no-store' });
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          window.hdToast && window.hdToast({ title: "Couldn't remove entry", description: (j && j.error) || `HTTP ${res.status}`, tone: 'blocked' });
          return;
        }
        window.hdToast && window.hdToast({ title: 'Entry removed', tone: 'ok' });
        afterWrite();
      } catch (e) {
        window.hdToast && window.hdToast({ title: "Couldn't remove entry", description: 'request failed: ' + (e && e.message), tone: 'blocked' });
      }
    }

    const columns = [];
    if (isFace) {
      columns.push({ label: 'Face', key: 'face', width: 60, render: (r) => <FaceThumb mediaUrl={r.face_media_url} /> });
    }
    columns.push({ label: 'Value', key: 'value_masked', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: P.type.body, color: P.ink }}>{r.value_masked || '—'}</span> });
    columns.push({ label: 'Reason', key: 'reason', render: (r) => <span style={{ fontSize: P.type.body, color: P.ink2 }}>{r.reason || '—'}</span> });
    columns.push({ label: 'Added by', key: 'added_by', render: (r) => <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{r.added_by || '—'}</span> });
    columns.push({ label: 'Added', key: 'added_at', render: (r) => <span title={r.added_at} style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>{fmtRelative(r.added_at)}</span> });
    columns.push({ label: 'Expires', key: 'expires_at', render: (r) => <span style={{ fontSize: P.type.meta, color: r.expires_at ? P.inkDim : P.inkFaint, fontFamily: P.fontMono }}>{r.expires_at ? fmtDate(r.expires_at) : 'Never'}</span> });
    columns.push({
      label: 'Source session', key: 'source_session_id',
      render: (r) => r.source_session_id
        ? <PBtn variant="ghost" size="xs" icon="external" onClick={() => navigate('#/sessions/' + r.source_session_id)}>View</PBtn>
        : <span style={{ color: P.inkFaint, fontSize: P.type.meta }}>—</span>,
    });
    if (canWrite) {
      columns.push({ label: '', key: 'actions', align: 'right', width: 96, render: (r) => <RemoveEntryButton onConfirm={() => removeEntry(r.id)} /> });
    }

    return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} dense />;
  }

  // ── Master table ──────────────────────────────────────────────────────────
  const TABS = [
    { value: 'all', label: 'All' },
    { value: 'blocklist', label: 'Blocklists' },
    { value: 'allowlist', label: 'Allowlists' },
    { value: 'custom', label: 'Custom' },
    { value: 'biometric', label: 'Biometric templates' },
  ];

  function ListsMaster({ rows, onOpen, canCreate, onCreateClick }) {
    const P = useP();
    const [tab, setTab] = React.useState('all');

    const counts = React.useMemo(() => ({
      all: rows.length,
      blocklist: rows.filter((r) => r.list_type === 'blocklist').length,
      allowlist: rows.filter((r) => r.list_type === 'allowlist').length,
      custom: rows.filter((r) => r.list_type === 'custom').length,
      biometric: rows.filter((r) => r.entry_type === 'face').length,
    }), [rows]);

    const filtered = tab === 'all' ? rows
      : tab === 'biometric' ? rows.filter((r) => r.entry_type === 'face')
      : rows.filter((r) => r.list_type === tab);

    const columns = [
      { label: 'List', key: 'name', render: (r) => <span style={{ fontWeight: 600, color: P.ink, fontSize: P.type.body }}>{r.name}</span> },
      { label: 'Kind', key: 'list_type', width: 110, render: (r) => <ListTypePill type={r.list_type} /> },
      { label: 'Entry type', key: 'entry_type', width: 140, render: (r) => <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{entryTypeLabel(r.entry_type)}</span> },
      { label: 'Entries', key: 'entries', width: 90, align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: r.entries ? P.ink : P.inkFaint }}>{r.entries}</span> },
      { label: 'Source', key: 'source', width: 120, render: (r) => <Pill kind="neutral" size="sm">{SOURCE_LABEL[r.source] || r.source}</Pill> },
      { label: 'Last entry', key: 'last_entry_at', width: 120, render: (r) => <span style={{ fontSize: P.type.meta, color: r.last_entry_at ? P.inkDim : P.inkFaint, fontFamily: P.fontMono }}>{r.last_entry_at ? fmtRelative(r.last_entry_at) : '—'}</span> },
    ];

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <Tabs value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t, count: counts[t.value] }))} />
          {canCreate && <PBtn variant="accent" icon="plus" onClick={onCreateClick} style={{ flex: '0 0 auto' }}>Create list</PBtn>}
        </div>

        {tab === 'blocklist' && <BlocklistNote style={{ marginBottom: 14 }} />}

        {filtered.length === 0 ? (
          <EmptyState icon="list" title="No lists in this view" body="Try a different tab." compact />
        ) : (
          <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} onRowClick={onOpen} />
        )}
      </div>);
  }

  // ── Screen ────────────────────────────────────────────────────────────────
  window.IdvListsScreen = function IdvListsScreen(ctx) {
    const P = useP();
    const can = (ctx && ctx.can) || (() => false);
    const navigate = (ctx && ctx.navigate) || (() => {});
    const poll = window.HWIdv
      ? window.HWIdv.usePoll('/api/idv/lists', 20000)
      : { loading: false, error: 'no-live-seam', data: null, refresh: () => {} };

    const [selectedId, setSelectedId] = React.useState(() => {
      const m = /^#\/lists\/([^/?]+)/.exec(location.hash || '');
      return m ? decodeURIComponent(m[1]) : null;
    });
    const [showCreate, setShowCreate] = React.useState(false);

    function openList(id) {
      setSelectedId(id);
      try { history.replaceState(null, '', '#/lists/' + encodeURIComponent(id)); } catch (e) {}
    }
    function closeList() {
      setSelectedId(null);
      try { history.replaceState(null, '', '#/lists'); } catch (e) {}
    }

    const rows = (poll.data && poll.data.rows) || null;
    const selected = rows && selectedId ? rows.find((r) => r.id === selectedId) : null;

    // Selected id survived a poll refresh but the row it pointed to is gone
    // (deleted elsewhere) — fall back to the master view instead of a blank
    // detail screen.
    React.useEffect(() => {
      if (rows && selectedId && !selected) closeList();
      // eslint-disable-next-line
    }, [rows, selectedId]);

    let body;
    if (poll.loading && !rows) {
      body = <IdvShared.SkeletonTable rows={6} />;
    } else if (poll.error && !rows) {
      body = poll.error === 'no-live-seam'
        ? <IdvShared.NotConnected onRetry={poll.refresh} />
        : <ErrorState onRetry={poll.refresh} detail={poll.error} />;
    } else if (selected) {
      body = (
        <ListDetail list={selected} onBack={closeList} canWrite={can('add_to_list')} navigate={navigate}
          onListsChanged={poll.refresh} />);
    } else {
      body = (
        <ListsMaster rows={rows || []} onOpen={(r) => openList(r.id)}
          canCreate={can('lists_manage')} onCreateClick={() => setShowCreate(true)} />);
    }

    return (
      <div>
        {!selected && (
          <SectionHead eyebrow="Configure" title="Lists"
            subtitle="Blocklists, allowlists and custom lists matched during every decision. A hit is a warning carrying the list id — only a human puts someone on a blocklist." />
        )}
        {body}
        <CreateListDialog open={showCreate} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); poll.refresh(); }} />
      </div>);
  };
})();
