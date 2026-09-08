// ── Learn · Author — build a Snap: cards, schedule, quiz reward ────────────
// Route: #/learn/new only. Design: explorations/Incentives - Concept D - Two
// Seats.html, tab "6 · Learn", "Authoring — the console side". Plan:
// docs/INCENTIVES-PLAN-2026-09-07.md §3.7, §5. Contract:
// docs/BOUNTY-API-CONTRACT.md "Learn (snaps)".
//
// NEW ONLY — NOT EDIT. incentives/app.jsx's ROUTES() and SCREEN_SOURCE only
// register '/learn/new'; there is no '/learn/:id/edit' entry and no
// startsWith prefix handling for '/learn/' the way '/contests/:id' gets one.
// The brief said "edit if app.jsx routes it; otherwise new only and say so"
// — it does not, so this file only ever authors a brand-new snap. Re-saving
// after the first Save still works (the POST carries the id once one
// exists, see save() below), so a manager can iterate on a draft in one
// sitting; there is just no way back into it after leaving this route. That
// is a gap in incentives/app.jsx, not this file, and app.jsx is off-limits
// here (see the shared brief's "do not touch" list) — flagged in the report.
//
// WHAT "PREVIEW" ACTUALLY SHOWS. window.IncSnapPlayer (screen-learn.jsx)
// only ever reads a snap from GET /snaps/{id} — it has no path for
// unsaved local state, and this module must not invent one (no mock data,
// ever). So Preview saves the current draft first, then opens the player
// on the id that came back — it always shows what the server actually has,
// never a client-side approximation of it.
//
// POST /snaps' response shape is not written down in BOUNTY-API-CONTRACT.md
// (contests' create/update explicitly returns `{contest, summary,
// sentence}`; snaps' entry just says "body = snap + actor"). Per plan §4's
// "every write returns the refreshed read surface" convention, this file
// assumes the response is `{ snap: {...} }` and falls back to a bare
// `{id, ...}` if the wrapper is absent — see saveSnap() below and the
// report.
;(function () {
  const useP = window.useP;

  // ── local composites (kept private to this file — inc-shared.jsx says
  // "add a case here" only when a shape is reused across screens; a
  // textarea and a native <select> styled to match Field are not) ─────────
  function Multiline({ value, onChange, placeholder, rows = 3 }) {
    const P = useP();
    const [f, setF] = React.useState(false);
    return (
      <textarea value={value || ''} onChange={onChange} placeholder={placeholder} rows={rows}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ width: '100%', padding: '9px 13px', background: P.field, border: `1px solid ${f ? P.info : P.fieldBorder}`,
          borderRadius: P.r8, boxShadow: f ? P.focusRing : 'none', color: P.ink, fontSize: 12.5, fontFamily: P.fontSans,
          resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />);
  }
  function LocalSelect({ value, onChange, options, placeholder, size = 'md' }) {
    const P = useP();
    const h = { sm: P.ctrlH.sm, md: P.ctrlH.md, lg: P.ctrlH.lg }[size] || P.ctrlH.md;
    return (
      <select value={value || ''} onChange={onChange}
        style={{ width: '100%', minHeight: h, padding: '0 11px', background: P.field, border: `1px solid ${P.fieldBorder}`,
          borderRadius: P.r8, color: value ? P.ink : P.inkMute, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none' }}>
        <option value="">{placeholder || 'Choose…'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>);
  }
  function FieldLabel({ children }) {
    const P = useP();
    return <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, marginBottom: 5 }}>{children}</div>;
  }

  // ── data hooks — one-shot reads, not polls: a settings/contests list for
  // populating a picker does not need to live-update while a manager types.
  function useOneShot(path, enabled) {
    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    const aliveRef = React.useRef(true);
    const fetchIt = React.useCallback(() => {
      if (!enabled || !path) { setState({ loading: false, error: null, data: null }); return; }
      setState((s) => ({ ...s, loading: true, error: null }));
      window.HWInc.get(path).then((r) => {
        if (!aliveRef.current) return;
        if (!r.ok) { setState({ loading: false, error: r.error || `HTTP ${r.code}`, data: null }); return; }
        setState({ loading: false, error: null, data: r.body });
      });
    }, [path, enabled]);
    React.useEffect(() => { aliveRef.current = true; fetchIt(); return () => { aliveRef.current = false; }; }, [fetchIt]);
    return { ...state, refresh: fetchIt };
  }

  // ── card model ─────────────────────────────────────────────────────────
  const CARD_META = {
    image: { icon: 'camera', label: 'Image' },
    text: { icon: 'note', label: 'Text' },
    video_url: { icon: 'play', label: 'Video link' },
    quiz: { icon: 'help', label: 'Quiz' },
  };
  function newCard(type) {
    if (type === 'image') return { type, heading: '', body: '', media_id: null, media_url: null, media_size: null };
    if (type === 'video_url') return { type, heading: '', media_url: '' };
    if (type === 'quiz') return { type, question: '', choices: ['', ''], answer_index: 0 };
    return { type: 'text', heading: '', body: '' };
  }
  function cardSummary(c) {
    if (c.type === 'image') return c.media_id ? `image · ${c.media_id.slice(0, 8)}${c.media_size != null ? ` · ${Math.round(c.media_size / 1024)} KB` : ''}` : 'image · no file yet';
    if (c.type === 'video_url') return c.media_url ? 'video link set' : 'no link yet';
    if (c.type === 'quiz') return `quiz · ${(c.choices || []).length} choices`;
    return 'text';
  }
  function MB(bytes) { return (bytes / (1024 * 1024)).toFixed(1); }
  const IMAGE_CAP_BYTES = 1.5 * 1024 * 1024;

  window.IncScreenLearnAuthor = function IncScreenLearnAuthor({ navigate, session, isManager }) {
    const P = useP();

    const settingsQ = useOneShot('/api/incentives/settings', isManager);
    const contestsQ = useOneShot(`/api/incentives/contests?status=active&store_id=${encodeURIComponent(session.storeId || '')}`, isManager);

    const [title, setTitle] = React.useState('');
    const [brand, setBrand] = React.useState('');
    const [storeIds, setStoreIds] = React.useState([]);
    const [publishAt, setPublishAt] = React.useState('');
    const [expireAt, setExpireAt] = React.useState('');
    const [linkedContestId, setLinkedContestId] = React.useState('');
    const [cards, setCards] = React.useState([]);
    const [selected, setSelected] = React.useState(0);
    const [quizUnit, setQuizUnit] = React.useState('points');
    const [quizAmount, setQuizAmount] = React.useState('');

    const [savedSnapId, setSavedSnapId] = React.useState(null);
    const [savedSnap, setSavedSnap] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState(null);
    const [publishing, setPublishing] = React.useState(false);
    const [publishError, setPublishError] = React.useState(null);
    const [showPublishConfirm, setShowPublishConfirm] = React.useState(false);
    const [previewId, setPreviewId] = React.useState(null);
    const [previewing, setPreviewing] = React.useState(false);

    if (!isManager) {
      return (
        <EmptyState icon="shield" title="Authoring is a manager tool"
          body="Snaps are written and published by a floor manager. Ask one if you want to see something added here." />);
    }

    const hasQuiz = cards.some((c) => c.type === 'quiz');

    function updateCard(i, patch) {
      setCards((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    }
    function addCard(type) {
      setCards((cs) => { const next = [...cs, newCard(type)]; setSelected(next.length - 1); return next; });
    }
    function removeCard(i) {
      setCards((cs) => cs.filter((_, idx) => idx !== i));
      setSelected((s) => Math.max(0, s > i ? s - 1 : s === i ? Math.max(0, i - 1) : s));
    }
    function moveCard(i, dir) {
      setCards((cs) => {
        const j = i + dir;
        if (j < 0 || j >= cs.length) return cs;
        const next = cs.slice();
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
        return next;
      });
      setSelected((s) => (s === i ? i + dir : s === i + dir ? i : s));
    }
    function onPickImage(i, file) {
      if (!file) return;
      if (file.size > IMAGE_CAP_BYTES) {
        updateCard(i, { uploadError: `That file is ${MB(file.size)} MB — the cap is 1.5 MB. Pick a smaller image.` });
        return;
      }
      updateCard(i, { uploading: true, uploadError: null });
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = String(reader.result).split(',')[1] || '';
        window.HWInc.post('/api/incentives/media', { mime: file.type, b64, actor: session.id }).then((r) => {
          if (!r.ok) { updateCard(i, { uploading: false, uploadError: r.error || `HTTP ${r.code}` }); return; }
          updateCard(i, { uploading: false, uploadError: null, media_id: r.body.id, media_url: r.body.url, media_size: r.body.size });
        });
      };
      reader.onerror = () => updateCard(i, { uploading: false, uploadError: 'Could not read that file.' });
      reader.readAsDataURL(file);
    }

    function buildBody() {
      const toIso = (v) => (v ? new Date(v).toISOString() : null);
      const cardOut = cards.map((c) => {
        if (c.type === 'image') return { type: 'image', media_id: c.media_id, media_url: c.media_url, heading: c.heading, body: c.body };
        if (c.type === 'video_url') return { type: 'video_url', media_url: c.media_url, heading: c.heading };
        if (c.type === 'quiz') return { type: 'quiz', question: c.question, choices: c.choices, answer_index: c.answer_index };
        return { type: 'text', heading: c.heading, body: c.body };
      });
      return {
        id: savedSnapId || undefined,
        title, brand: brand || null, store_ids: storeIds,
        publish_at: toIso(publishAt), expire_at: toIso(expireAt),
        linked_contest_id: linkedContestId || null,
        cards: cardOut,
        quiz_reward: hasQuiz && quizAmount ? { unit: quizUnit, amount: Number(quizAmount) } : null,
        actor: session.id,
      };
    }

    async function saveSnap() {
      setSaving(true); setSaveError(null);
      const r = await window.HWInc.post('/api/incentives/snaps', buildBody());
      setSaving(false);
      if (!r.ok) { setSaveError(r.error || `HTTP ${r.code}`); return null; }
      const returned = (r.body && (r.body.snap || r.body)) || null;   // see the header comment — response shape assumed
      const id = returned && returned.id ? returned.id : null;
      if (id) { setSavedSnapId(id); setSavedSnap(returned); }
      window.hdToast?.({ title: 'Draft saved', description: title || 'Untitled snap', tone: 'ok' });
      return id;
    }

    async function doPublish() {
      const id = savedSnapId || await saveSnap();
      if (!id) return;
      setPublishing(true); setPublishError(null);
      const r = await window.HWInc.post(`/api/incentives/snaps/${id}/publish`, { actor: session.id });
      setPublishing(false); setShowPublishConfirm(false);
      if (!r.ok) { setPublishError(r.error || `HTTP ${r.code}`); return; }
      const returned = (r.body && (r.body.snap || r.body)) || null;
      if (returned) setSavedSnap(returned);
      window.hdToast?.({ title: 'Published', description: title || 'Untitled snap', tone: 'ok' });
    }

    async function openPreview() {
      setPreviewing(true);
      const id = savedSnapId || await saveSnap();
      setPreviewing(false);
      if (id) setPreviewId(id);
    }

    const stores = (settingsQ.data && settingsQ.data.stores) || [];
    const contests = (contestsQ.data && contestsQ.data.contests) || [];
    const brandOptions = ((window.HW_BRANDS && window.HW_BRANDS.names) || []).map((n) => ({ value: n, label: n }));
    const contestOptions = contests.map((c) => ({ value: c.id, label: c.name }));
    const current = cards[selected];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
        <style>{'@media (max-width:900px){.inc-learn-cards-grid{grid-template-columns:1fr !important}}'}</style>

        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <button type="button" onClick={() => navigate('#/learn')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', padding: 0, marginBottom: 6, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
              color: P.inkMute, fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Learn
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>New snap</h1>
              {savedSnap && <window.IncShared.StatusPill status={savedSnap.status} />}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: P.type.body, color: P.inkMute, maxWidth: 560, lineHeight: 1.5 }}>
              A snap can teach a bounty, and a bounty can point back at the snap. Linking is allowed before the bounty is approved.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PBtn variant="secondary" size="sm" icon="play" busy={previewing} onClick={openPreview}>Preview as a budtender</PBtn>
          </div>
        </header>

        {/* ── Details ────────────────────────────────────────────────────── */}
        <Card padding={0}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={14} stroke={1.9} color={P.inkMute} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Details &amp; publishing</span>
          </div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14 }}>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Field value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Blue Burst, in one line" />
            </div>
            <div>
              <FieldLabel>Brand</FieldLabel>
              <LocalSelect value={brand} onChange={(e) => setBrand(e.target.value)} options={brandOptions} placeholder="Pick a brand" />
            </div>
            <div>
              <FieldLabel>Publish</FieldLabel>
              <Field type="datetime-local" mono value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Expires</FieldLabel>
              <Field type="datetime-local" mono value={expireAt} onChange={(e) => setExpireAt(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldLabel>Stores</FieldLabel>
              {settingsQ.error ? (
                <window.IncShared.NotConnected compact onRetry={settingsQ.refresh} />
              ) : settingsQ.loading ? (
                <Skeleton lines={1} h={30} />
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stores.map((s) => {
                    const on = storeIds.includes(s.id);
                    return (
                      <button key={s.id} type="button"
                        onClick={() => setStoreIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                        style={{ padding: '6px 12px', borderRadius: P.r999, border: `1px solid ${on ? P.accentBorder : P.hairline3}`,
                          background: on ? P.accentSoft : P.surface, color: on ? P.accentText : P.ink2, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: P.fontSans }}>
                        {s.name}
                      </button>);
                  })}
                  {!stores.length && <span style={{ fontSize: 11.5, color: P.inkMute }}>No stores returned by /api/incentives/settings.</span>}
                </div>)}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldLabel>Teaches (linked bounty)</FieldLabel>
              {contestsQ.error ? (
                <window.IncShared.NotConnected compact onRetry={contestsQ.refresh} />
              ) : contestsQ.loading ? (
                <Skeleton lines={1} h={30} />
              ) : contestOptions.length ? (
                <LocalSelect value={linkedContestId} onChange={(e) => setLinkedContestId(e.target.value)}
                  options={contestOptions} placeholder="No linked bounty" />
              ) : (
                <span style={{ fontSize: 11.5, color: P.inkMute }}>No active bounties at this store to link.</span>)}
            </div>
          </div>
        </Card>

        {/* ── Cards ──────────────────────────────────────────────────────── */}
        <Card padding={0}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="story" size={14} stroke={1.9} color={P.inkMute} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Cards</span>
            <Pill kind="neutral" size="sm">{cards.length}</Pill>
          </div>
          <div className="inc-learn-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,260px) minmax(0,1fr)' }}>
            <div style={{ borderRight: `1px solid ${P.hairline2}` }}>
              {cards.map((c, i) => {
                const meta = CARD_META[c.type];
                const on = i === selected;
                return (
                  <div key={i} data-hw-i role="button" tabIndex={0} onClick={() => setSelected(i)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelected(i); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', cursor: 'pointer',
                      borderBottom: `1px solid ${P.hairline}`, background: on ? P.surface2 : 'transparent',
                      boxShadow: on ? `inset 2px 0 0 ${P.accent}` : 'none' }}>
                    <span style={{ width: 26, height: 26, borderRadius: P.r8, background: on ? P.accentSoft : P.surface3,
                      color: on ? P.accentText : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                      <span style={{ fontFamily: P.fontMono, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.heading || c.question || meta.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{cardSummary(c)}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <IconBtn icon="chevron-up" size={11} style={{ width: 20, height: 16 }} onClick={(e) => { e.stopPropagation(); moveCard(i, -1); }} label="Move up" />
                      <IconBtn icon="chevron-down" size={11} style={{ width: 20, height: 16 }} onClick={(e) => { e.stopPropagation(); moveCard(i, 1); }} label="Move down" />
                    </div>
                    <IconBtn icon="trash" size={13} onClick={(e) => { e.stopPropagation(); removeCard(i); }} label="Remove card" />
                  </div>);
              })}
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Add a card</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.keys(CARD_META).map((t) => (
                    <PBtn key={t} variant="secondary" size="xs" icon={CARD_META[t].icon} onClick={() => addCard(t)}>{CARD_META[t].label}</PBtn>))}
                </div>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              {!current ? (
                <EmptyState compact icon="story" title="No card selected"
                  body="Add a card — image, text, video link or quiz — to start building this snap." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {current.type === 'image' && (
                    <React.Fragment>
                      <div>
                        <FieldLabel>Image</FieldLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {current.media_url && <img src={current.media_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: P.r8, border: `1px solid ${P.hairline}` }} />}
                          <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={(e) => onPickImage(selected, e.target.files && e.target.files[0])} />
                            {/* Native label-forwarding: clicking anywhere in this label, including this
                                nested button, fires the hidden file input's own click — no ref, no JS. */}
                            <PBtn variant="secondary" size="sm" icon="upload" busy={current.uploading}>
                              {current.media_id ? 'Replace image' : 'Upload image'}
                            </PBtn>
                          </label>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 10.5, color: P.inkMute }}>1.5 MB a file. Anything larger is refused with its size, not silently resized.</div>
                        {current.uploadError && <div style={{ marginTop: 6, fontSize: 11.5, color: P.bad }}>{current.uploadError}</div>}
                      </div>
                      <div><FieldLabel>Heading</FieldLabel><Field value={current.heading} onChange={(e) => updateCard(selected, { heading: e.target.value })} placeholder="Blue Burst, in one line" /></div>
                      <div><FieldLabel>Caption</FieldLabel><Multiline value={current.body} onChange={(e) => updateCard(selected, { body: e.target.value })} placeholder="A live-resin pod that leads with blueberry…" /></div>
                    </React.Fragment>)}

                  {current.type === 'text' && (
                    <React.Fragment>
                      <div><FieldLabel>Heading</FieldLabel><Field value={current.heading} onChange={(e) => updateCard(selected, { heading: e.target.value })} placeholder="Who it's for" /></div>
                      <div><FieldLabel>Body</FieldLabel><Multiline rows={4} value={current.body} onChange={(e) => updateCard(selected, { body: e.target.value })} placeholder="Someone who liked Blue Dream but found it heavy…" /></div>
                    </React.Fragment>)}

                  {current.type === 'video_url' && (
                    <React.Fragment>
                      <div><FieldLabel>Heading (optional)</FieldLabel><Field value={current.heading} onChange={(e) => updateCard(selected, { heading: e.target.value })} placeholder="See it in action" /></div>
                      <div><FieldLabel>Video URL</FieldLabel><Field mono value={current.media_url} onChange={(e) => updateCard(selected, { media_url: e.target.value })} placeholder="https://…" /></div>
                      <div style={{ fontSize: 10.5, color: P.inkMute }}>Renders as a plain link in the player — no embedded player.</div>
                    </React.Fragment>)}

                  {current.type === 'quiz' && (
                    <React.Fragment>
                      <div><FieldLabel>Question</FieldLabel><Field value={current.question} onChange={(e) => updateCard(selected, { question: e.target.value })} placeholder="Blue Burst is which kind of extract?" /></div>
                      <div>
                        <FieldLabel>Choices — pick the correct one</FieldLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {current.choices.map((choice, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Check on={current.answer_index === i} onChange={() => updateCard(selected, { answer_index: i })} />
                              <div style={{ flex: 1 }}>
                                <Field value={choice} onChange={(e) => updateCard(selected, {
                                  choices: current.choices.map((c, idx) => (idx === i ? e.target.value : c)),
                                })} placeholder={`Choice ${String.fromCharCode(65 + i)}`} />
                              </div>
                              {current.choices.length > 2 && (
                                <IconBtn icon="x" size={14} label="Remove choice"
                                  onClick={() => updateCard(selected, { choices: current.choices.filter((_, idx) => idx !== i), answer_index: current.answer_index >= current.choices.length - 1 ? 0 : current.answer_index })} />)}
                            </div>))}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <PBtn variant="ghost" size="xs" icon="plus" onClick={() => updateCard(selected, { choices: [...current.choices, ''] })}>Add a choice</PBtn>
                        </div>
                      </div>
                    </React.Fragment>)}
                </div>)}
            </div>
          </div>
        </Card>

        {/* ── Quiz reward — only when a quiz card exists ────────────────── */}
        {hasQuiz && (
          <Card padding={0}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="award" size={14} stroke={1.9} color={P.inkMute} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Reward on pass</span>
            </div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 140 }}>
                <FieldLabel>Amount</FieldLabel>
                <Field mono type="number" value={quizAmount} onChange={(e) => setQuizAmount(e.target.value)} placeholder="25" />
              </div>
              <Seg value={quizUnit} onChange={setQuizUnit} options={[{ value: 'points', label: 'Points' }, { value: 'cents', label: 'Dollars' }]} />
              <div style={{ fontSize: 10.5, color: P.inkMute, maxWidth: 360 }}>
                Writes one ledger row per person per snap when they pass, so a retake cannot pay twice.
              </div>
            </div>
          </Card>)}

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PBtn variant="secondary" size="lg" busy={saving} onClick={saveSnap}>Save draft</PBtn>
            {!showPublishConfirm ? (
              <PBtn variant="accent" size="lg" icon="megaphone" onClick={() => setShowPublishConfirm(true)}>Publish</PBtn>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: P.r10,
                background: P.warnSoft, border: `1px solid ${P.warn}` }}>
                <span style={{ fontSize: 12, color: P.ink2 }}>Publish this snap? It becomes visible at the selected stores.</span>
                <PBtn variant="secondary" size="sm" onClick={() => setShowPublishConfirm(false)}>Cancel</PBtn>
                <PBtn variant="accent" size="sm" busy={publishing} onClick={doPublish}>Confirm publish</PBtn>
              </div>)}
            {saveError && <span style={{ fontSize: 12, color: P.bad }}>Could not save: {saveError}</span>}
            {publishError && <span style={{ fontSize: 12, color: P.bad }}>Could not publish: {publishError}</span>}
          </div>
        </Card>

        {previewId && (
          <window.IncSnapPlayer snapId={previewId} onClose={() => setPreviewId(null)} mode="overlay" isManager={true}
            associateId={session.id} navigate={navigate} />)}
      </div>);
  };
})();
