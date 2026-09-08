// ── idv/screen-people.jsx ── #/customers · #/customers/:id ─────────────────
// Design source: explorations/Verify - Concept C - Customer File.html, tab
// "3 · Customer file" (owner's pick, plan §5.6: "Customer file (Concept C) is
// the primary object"). The list view is the flat, secondary surface that
// same exploration's tab 6 describes for sessions — this file's list view is
// the equivalent for people, per this task's brief.
//
// Contract: docs/IDV-API-CONTRACT.md — People routes, `Person`, `SessionSummary`,
// `Review`. Built ONLY from pos/atoms.jsx + shared/states.jsx + shared/hd-ui.jsx
// (via idv/idv-shared.jsx composites) + idv/idv-client.jsx (window.HWIdv).
// IIFE-wrapped; the only global this file leaks is window.IdvPeopleScreen.
//
// ROUTING GAP (flagged, not fixed — idv/app.jsx is out of this task's scope):
// idv/app.jsx's SCREEN_SOURCE/ROUTES() map '/customers' to this screen exactly,
// but — unlike '/sessions/:id', which gets its own SESSION_DETAIL_RE — there is
// no parametric entry for '/customers/:id'. incentives/app.jsx has exactly this
// shape already for '/contests/:id' (`path.startsWith('/contests/') && path !==
// '/contests/new')`). Until idv/app.jsx grows the equivalent
// (`path.startsWith('/customers/') && path !== '/customers'` → this same
// screen), a click into a person's file resolves to no screen at all and
// app.jsx's own "did not load" ErrorState renders instead of ever reaching the
// code below. This file still parses `props.path` defensively (same pattern
// as incentives/screen-contest-detail.jsx), so it is correct the moment that
// one map entry is added.
//
// HONESTY GAPS this screen accepts rather than papering over (plan §5.3 — a
// screen never invents a field the contract doesn't return):
//  - `SessionSummary` (what `GET /api/idv/people/{id}` returns per session)
//    carries no liveness score, face-match score, model name or "decided by"
//    actor/engine — only the full per-session `Decision` does. Fetching a
//    Decision per timeline card would be one request per session just to
//    render a file; this screen shows exactly what SessionSummary carries
//    (status, workflow+version, document type/state, channel/origin, reason
//    codes, the imported tag) and leaves liveness/decided-by off the card
//    rather than guessing them from the exploration's mockup copy.
//  - The People detail route's `documents` fragment has no PDF417/OCR
//    agreement flag and no media id (front/back images aren't returned at
//    this endpoint) — the design's "agrees with OCR on N fields" line and
//    document thumbnail are Decision-level facts this route doesn't carry.
//    This screen shows type/issuing state/expiry/hash only.
//  - No route returns a session's consent state to the console — capture
//    stores `consents` on session state (docs/IDV-API-CONTRACT.md capture
//    API), but neither `SessionSummary` nor `GET /api/idv/sessions/{id}`
//    exposes it. The Retention block says so in one sentence instead of
//    inventing a state.
//  - "Assurance tier" (the design's "T2 · document + liveness") isn't a
//    contract field either. This screen derives a plain label from
//    `person.face_template_count > 0` and says, in the row's own tooltip,
//    that it's derived — never presented as a value the backend returned.
//  - `POST /api/idv/sessions` is documented "(analyst+)"; idv-client.jsx's
//    `ACTION_MIN_ROLE` table now has an explicit `create_session: 'analyst'`
//    key, so "New verification"/"Ask to re-verify" gate on `can('create_session')`
//    the same way `can('merge_person')` and `can('add_to_list')` already did.
;(function () {
  const useP = window.useP;

  // ── shared little maps (module-local; Person.status ≠ the ten Didit
  // session-status literals StatusPill/STATUS_TONE already cover) ──────────
  const STORE_NAMES = { elsinore: 'Lake Elsinore', 'west-la': 'West Hollywood', 'long-beach': 'Long Beach', corona: 'Corona', riverside: 'Riverside' };
  const PERSON_STATUS_TONE = { active: 'good', blocked: 'bad', deleted: 'neutral' };
  const PERSON_STATUS_LABEL = { active: 'Active', blocked: 'Blocked', deleted: 'Deleted' };
  const RETENTION_POLICY_LABEL = { until_customer_deleted: 'Kept until the person is deleted', purge_after_decision: 'Purged after each decision' };
  const CHANNEL_LABEL = { hosted: 'Hosted link', embedded: 'Embedded', pos: 'POS', import: 'Import' };
  const PERSON_STATUS_OPTS = [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'deleted', label: 'Deleted' }];
  const HAS_HITS_OPTS = [{ value: 'any', label: 'Any' }, { value: 'yes', label: 'Has hits' }, { value: 'no', label: 'No hits' }];

  function personDisplayName(p) {
    const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    if (n) return n;
    if (p.vendor_data) return p.vendor_data;
    return 'Unnamed customer';
  }
  function ageFromDOB(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }
  // Whole days from now to `iso`; negative once past. Used for both the KYC
  // countdown pill and a document's own expiry bar.
  function daysUntil(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }
  function originLabel(s) {
    const origin = s.origin || '';
    if (origin === 'website') return 'Website';
    if (origin.indexOf('pos:') === 0) { const sid = origin.slice(4); return 'POS · ' + (STORE_NAMES[sid] || sid); }
    if (origin === 'didit-import') return 'Imported from Didit';
    return CHANNEL_LABEL[s.channel] || 'Verification';
  }

  // ── KV — a label/value row, used all down the standing + retention cards ─
  function KV({ label, value, mono, hint }) {
    const P = useP();
    return (
      <div title={hint} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: P.type.meta, color: P.inkMute, flex: '0 0 auto' }}>{label}</span>
        <span style={{ fontSize: P.type.body, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, textAlign: 'right', wordBreak: 'break-word', minWidth: 0 }}>{value}</span>
      </div>);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Action panels — inline Cards under the top bar, not a Sheet: each is a
  // short form with a clear done/cancel, matching incentives/screen-contest-
  // detail.jsx's ConfirmRow shape rather than pulling in a drawer for a
  // three-field form.
  // ═══════════════════════════════════════════════════════════════════════

  // "Ask to re-verify" and "New verification" are the same write — POST
  // /api/idv/sessions with a workflow, this person's vendor_data and
  // channel: 'hosted' — with different defaults: re-verify prefills the
  // workflow this person was last verified against (if it's still active),
  // "New verification" starts blank.
  function CreateSessionPanel({ person, mode, defaultWorkflowId, onClose }) {
    const P = useP();
    const [workflows, setWorkflows] = React.useState(null); // null = loading
    const [wfError, setWfError] = React.useState(null);
    const [workflowId, setWorkflowId] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const [result, setResult] = React.useState(null);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
      let alive = true;
      window.HWIdv.get('/api/idv/workflows').then((r) => {
        if (!alive) return;
        if (r.ok) {
          const rows = (r.body && r.body.rows) || [];
          const active = rows.filter((w) => w.status === 'active');
          setWorkflows(active);
          const pick = (defaultWorkflowId && active.find((w) => w.id === defaultWorkflowId)) || active[0];
          if (pick) setWorkflowId(pick.id);
        } else {
          setWfError(r.error || ('HTTP ' + r.code));
          setWorkflows([]);
        }
      });
      return () => { alive = false; };
      // eslint-disable-next-line
    }, []);

    async function send() {
      if (!workflowId) return;
      setBusy(true); setErr(null);
      const session = window.HWIdv.session();
      const body = { workflow_id: workflowId, channel: 'hosted', store_id: session.storeId, associate_id: session.id };
      if (person.vendor_data) body.vendor_data = person.vendor_data;
      const r = await window.HWIdv.post('/api/idv/sessions', body);
      setBusy(false);
      if (r.ok) {
        setResult(r.body || {});
        if (window.hdToast) window.hdToast({ title: 'Verification link created', description: 'Share it, or open it yourself to walk them through it.', tone: 'ok' });
      } else {
        setErr((r.body && r.body.error) || r.error || ('HTTP ' + r.code));
      }
    }
    function copyUrl() {
      if (!result || !result.url) return;
      try { navigator.clipboard && navigator.clipboard.writeText(result.url); } catch (e) {}
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }

    return (
      <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>
            {mode === 'reverify' ? 'Ask this customer to re-verify' : 'Start a new verification'}
          </div>
          <IconBtn icon="x" label="Close this panel" onClick={onClose} />
        </div>
        {!result ? (
          <React.Fragment>
            <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5 }}>
              {mode === 'reverify'
                ? 'You’re sending a fresh hosted link tied to this same person. They’ll go through the workflow again from the start.'
                : 'You’re creating a brand-new hosted session. If this person has a vendor key on file, it carries over automatically.'}
            </div>
            <div>
              <div style={{ fontSize: P.type.meta, color: P.inkMute, marginBottom: 4 }}>Workflow</div>
              {workflows === null ? <Skeleton lines={1} h={P.ctrlH.sm} /> : workflows.length === 0 ? (
                <div style={{ fontSize: P.type.body, color: P.bad }}>
                  {wfError ? `Workflows didn’t load: ${wfError}` : 'No active workflow is set up yet — build one on the Workflows screen first.'}
                </div>
              ) : (
                <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}
                  style={{ height: P.ctrlH.sm, width: '100%', borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: P.type.body, fontFamily: P.fontSans, padding: '0 10px' }}>
                  {workflows.map((w) => <option key={w.id} value={w.id}>{w.name} · v{w.version}</option>)}
                </select>
              )}
            </div>
            {err && <div style={{ fontSize: P.type.meta, color: P.bad }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <PBtn size="sm" variant="accent" icon="send" busy={busy} disabled={!workflowId} onClick={send}>Send it</PBtn>
              <PBtn size="sm" variant="ghost" disabled={busy} onClick={onClose}>Cancel</PBtn>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ fontSize: P.type.body, color: P.ink2 }}>The link is live. Share it with the customer, or open it yourself to walk them through it in person.</div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: P.canvas2, border: `1px solid ${P.hairline}`, borderRadius: P.r8, fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink2, overflow: 'hidden' }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.url || '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PBtn size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copyUrl}>{copied ? 'Copied' : 'Copy link'}</PBtn>
              {result.url && <PBtn size="sm" variant="secondary" icon="external" onClick={() => window.open(result.url, '_blank', 'noopener')}>Open</PBtn>}
              <PBtn size="sm" variant="ghost" onClick={onClose}>Done</PBtn>
            </div>
          </React.Fragment>
        )}
      </Card>);
  }

  // "Add to list" — POST /api/idv/lists/{id}/entries. The value defaults to
  // this person's vendor key, editable because a list can also hold a
  // document hash or a raw email/phone the person's vendor_data doesn't carry.
  function AddToListPanel({ person, onClose }) {
    const P = useP();
    const [lists, setLists] = React.useState(null);
    const [listId, setListId] = React.useState('');
    const [value, setValue] = React.useState(person.vendor_data || '');
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const [done, setDone] = React.useState(false);

    React.useEffect(() => {
      let alive = true;
      window.HWIdv.get('/api/idv/lists').then((r) => {
        if (!alive) return;
        if (r.ok) {
          const rows = (r.body && r.body.rows) || [];
          setLists(rows);
          if (rows.length) setListId(rows[0].id);
        } else { setLists([]); setErr(r.error || ('HTTP ' + r.code)); }
      });
      return () => { alive = false; };
    }, []);

    async function submit() {
      if (!listId || !reason.trim()) return;
      setBusy(true); setErr(null);
      const r = await window.HWIdv.post('/api/idv/lists/' + encodeURIComponent(listId) + '/entries', {
        value: value.trim() || null, reason: reason.trim(), source_session_id: null, expires_at: null,
      });
      setBusy(false);
      if (r.ok) {
        setDone(true);
        if (window.hdToast) window.hdToast({ title: 'Added to list', description: reason.trim(), tone: 'ok' });
      } else {
        setErr((r.body && r.body.error) || r.error || ('HTTP ' + r.code));
      }
    }

    return (
      <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Add to a list</div>
          <IconBtn icon="x" label="Close this panel" onClick={onClose} />
        </div>
        {done ? (
          <React.Fragment>
            <div style={{ fontSize: P.type.body, color: P.ink2 }}>Added. Anyone screening against that list sees this entry from now on.</div>
            <PBtn size="sm" variant="ghost" onClick={onClose}>Close</PBtn>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={{ fontSize: P.type.body, color: P.inkDim }}>Pick which list this person belongs on, and say why — the reason is what an analyst reads later.</div>
            <div>
              <div style={{ fontSize: P.type.meta, color: P.inkMute, marginBottom: 4 }}>List</div>
              {lists === null ? <Skeleton lines={1} h={P.ctrlH.sm} /> : lists.length === 0 ? (
                <div style={{ fontSize: P.type.body, color: P.bad }}>{err ? `Lists didn’t load: ${err}` : 'No list exists yet — create one on the Lists screen first.'}</div>
              ) : (
                <select value={listId} onChange={(e) => setListId(e.target.value)}
                  style={{ height: P.ctrlH.sm, width: '100%', borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: P.type.body, fontFamily: P.fontSans, padding: '0 10px' }}>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.list_type}</option>)}
                </select>
              )}
            </div>
            <Field placeholder="Value to list (defaults to their vendor key)" value={value} onChange={(e) => setValue(e.target.value)} size="sm" mono />
            <Field placeholder="Why you’re adding them (required)" value={reason} onChange={(e) => setReason(e.target.value)} size="sm" />
            {err && lists && lists.length > 0 && <div style={{ fontSize: P.type.meta, color: P.bad }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <PBtn size="sm" variant="accent" busy={busy} disabled={!listId || !reason.trim()} onClick={submit}>Add</PBtn>
              <PBtn size="sm" variant="ghost" disabled={busy} onClick={onClose}>Cancel</PBtn>
            </div>
          </React.Fragment>
        )}
      </Card>);
  }

  // "Merge into…" — POST /api/idv/people/{id}/merge. `defaultTarget` lets a
  // duplicate row in the evidence column open this pre-filled.
  function MergePanel({ person, defaultTarget, onClose, onMerged }) {
    const P = useP();
    const [target, setTarget] = React.useState(defaultTarget || '');
    const [comment, setComment] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);

    async function submit() {
      if (!target.trim()) return;
      setBusy(true); setErr(null);
      const body = { into: target.trim() };
      if (comment.trim()) body.comment = comment.trim();
      const r = await window.HWIdv.post('/api/idv/people/' + encodeURIComponent(person.id) + '/merge', body);
      setBusy(false);
      if (r.ok) {
        if (window.hdToast) window.hdToast({ title: 'Merged', description: 'This file now points to the other person.', tone: 'ok' });
        if (onMerged) onMerged(r.body && r.body.person);
        onClose();
      } else {
        setErr((r.body && r.body.error) || r.error || ('HTTP ' + r.code));
      }
    }

    return (
      <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Merge into another person</div>
          <IconBtn icon="x" label="Close this panel" onClick={onClose} />
        </div>
        <div style={{ fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5 }}>
          This marks this file as merged into the one you name below. Nothing is deleted or rewritten — every session stays where it is, and the merge itself is recorded in the trail.
        </div>
        <Field placeholder="Target person id (e.g. p_9c41…)" value={target} onChange={(e) => setTarget(e.target.value)} size="sm" mono />
        <Field placeholder="A note for the audit trail (optional)" value={comment} onChange={(e) => setComment(e.target.value)} size="sm" />
        {err && <div style={{ fontSize: P.type.meta, color: P.bad }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <PBtn size="sm" variant="accent" busy={busy} disabled={!target.trim()} onClick={submit}>Merge this file</PBtn>
          <PBtn size="sm" variant="ghost" disabled={busy} onClick={onClose}>Cancel</PBtn>
        </div>
      </Card>);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Customer file — #/customers/:id
  // ═══════════════════════════════════════════════════════════════════════

  function StandingColumn({ person }) {
    const P = useP();
    const age = ageFromDOB(person.date_of_birth);
    const assurance = (person.face_template_count || 0) > 0 ? 'Document + liveness' : 'Document only';
    const hits = person.list_hits || [];
    return (
      <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <MicroLabel>Contact</MicroLabel>
          <div style={{ marginTop: 6, fontSize: P.type.body, color: P.ink2, lineHeight: 1.7 }}>
            <div>{person.email_masked || 'No email on file'}</div>
            <div>{person.phone_masked || 'No phone on file'}</div>
            <div>{person.date_of_birth ? `DOB ${person.date_of_birth}${age != null ? ` · ${age}` : ''}` : 'No date of birth on file'}</div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${P.hairline}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <KV label="Standing" value={<Pill kind={PERSON_STATUS_TONE[person.status] || 'neutral'} dot size="sm">{PERSON_STATUS_LABEL[person.status] || person.status || 'Unknown'}</Pill>} />
          <KV label="Verifications" value={window.HWIdv.fmt.number(person.sessions_count || 0)} mono />
          <KV label="First seen" value={person.created_at ? window.HWIdv.fmt.date(person.created_at) : '—'} />
          <KV label="Last verified" value={person.last_verified_at ? window.HWIdv.fmt.date(person.last_verified_at) : 'Never'} />
          <KV label="KYC expires" value={person.kyc_expires_at ? window.HWIdv.fmt.date(person.kyc_expires_at) : '—'} />
          <KV label="Assurance" hint="Derived here from face_template_count > 0 — the API has no assurance-tier field of its own." value={assurance} />
        </div>
        <div style={{ borderTop: `1px solid ${P.hairline}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <MicroLabel>Keys</MicroLabel>
          <KV label="vendor_data" value={person.vendor_data || '—'} mono />
          <KV label="Blaze member" value={person.blaze_member_id || 'Not linked'} mono />
          <KV label="hw_identity" value={person.hw_identity_id || 'Not linked'} mono />
        </div>
        <div style={{ borderTop: `1px solid ${P.hairline}`, paddingTop: 12 }}>
          <MicroLabel>List membership</MicroLabel>
          <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hits.length === 0
              ? <Pill kind="neutral" size="sm">Not on any list</Pill>
              : hits.map((h, i) => <Pill key={i} kind={h.list_type === 'allowlist' ? 'good' : 'bad'} size="sm" title={h.reason || ''}>{h.list_name}</Pill>)}
          </div>
        </div>
      </Card>);
  }

  function SessionCard({ session, onClick }) {
    const P = useP();
    const S = window.IdvShared;
    const fmt = window.HWIdv.fmt;
    const doc = session.document;
    return (
      <Card padding={12} hover onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 120, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{originLabel(session)}</span>
          <S.StatusPill status={session.status} />
          <Pill kind="ghost" size="sm" style={{ fontFamily: P.fontMono }}>{'#' + (session.session_number != null ? session.session_number : '—')}</Pill>
          <span style={{ fontSize: P.type.meta, color: P.inkMute }}>{fmt.date(session.created_at)}</span>
          <Icon name="chevron-right" size={13} stroke={2} color={P.inkFaint} />
        </div>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.7 }}>
          {session.workflow && <div><b style={{ color: P.ink2 }}>Workflow</b> {session.workflow.name} v{session.workflow.version}</div>}
          {doc && <div><b style={{ color: P.ink2 }}>Document</b> {doc.type || 'Unknown type'}{doc.issuing_state ? ` · ${doc.issuing_state}` : ''}{doc.issuing_country ? `, ${doc.issuing_country}` : ''}</div>}
        </div>
        {session.reasons && session.reasons.length > 0 && <S.ReasonChips reasons={session.reasons} />}
        {session.imported_from === 'didit' && <S.ImportedTag date={session.created_at} />}
      </Card>);
  }

  function YearLabel({ year }) {
    const P = useP();
    return <div style={{ fontSize: P.type.meta, fontWeight: 700, color: P.inkFaint, marginTop: 2 }}>{year}</div>;
  }

  function DocumentRow({ doc }) {
    const P = useP();
    const days = daysUntil(doc.expiration_date);
    const tone = days == null ? P.inkMute : days < 0 ? P.inkMute : days <= 14 ? P.bad : days <= 30 ? P.warn : P.good;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
        <span style={{ width: 32, height: 32, borderRadius: P.r8, background: P.canvas2, border: `1px solid ${P.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute, flex: '0 0 auto' }}>
          <Icon name="card" size={15} stroke={1.7} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: P.type.body, color: P.ink }}>{doc.document_type || 'Document'}{doc.issuing_state ? ` · ${doc.issuing_state}` : ''}</div>
          <div style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{doc.document_number_hash ? doc.document_number_hash.slice(0, 10) + '…' : '—'}</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 62 }}>
          {doc.expiration_date ? (
            <React.Fragment>
              <BarMeter value={days == null ? 0 : Math.max(0, Math.min(days, 365))} max={365} color={tone} height={5} width={56} />
              <div style={{ fontSize: P.type.micro, color: tone, marginTop: 2 }}>{days == null ? '—' : days < 0 ? 'Expired' : days + 'd left'}</div>
            </React.Fragment>
          ) : <span style={{ fontSize: P.type.meta, color: P.inkMute }}>No expiry on file</span>}
        </div>
      </div>);
  }

  function EvidenceColumn({ person, documents, templates, duplicates, retentionPoll, canMerge, onMerge }) {
    const P = useP();
    const fmt = window.HWIdv.fmt;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MicroLabel>Documents on file</MicroLabel>
            <Pill kind="ghost" size="sm">{documents.length}</Pill>
          </div>
          {documents.length === 0
            ? <div style={{ fontSize: P.type.meta, color: P.inkMute, padding: '6px 0' }}>No document has been captured for this person yet.</div>
            : documents.map((d, i) => (
                <div key={i} style={{ borderTop: i ? `1px solid ${P.hairline}` : 'none' }}><DocumentRow doc={d} /></div>))}
        </Card>

        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MicroLabel>Face templates</MicroLabel>
            <Pill kind="ghost" size="sm">{templates.length}</Pill>
          </div>
          {templates.length === 0 ? (
            <div style={{ fontSize: P.type.meta, color: P.inkMute, padding: '6px 0' }}>No face template stored — this person has never passed a liveness check that kept one.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {templates.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: P.type.meta, color: P.inkDim }}>
                  <span>{fmt.date(t.created_at)}</span>
                  <span style={{ fontFamily: P.fontMono }}>{t.quality != null ? `quality ${Number(t.quality).toFixed(2)}` : '—'}</span>
                </div>))}
            </div>)}
          <div style={{ fontSize: P.type.micro, color: P.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
            Embeddings only — the images they came from are separate media rows, not shown here.
          </div>
        </Card>

        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MicroLabel>Possible duplicates</MicroLabel>
            <Pill kind={duplicates.length ? 'warn' : 'ghost'} size="sm">{duplicates.length}</Pill>
          </div>
          {duplicates.length === 0 ? (
            <div style={{ fontSize: P.type.meta, color: P.inkMute, padding: '6px 0' }}>No other file has come back as a possible match.</div>
          ) : duplicates.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: P.type.body, color: P.ink, fontFamily: P.fontMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  possible duplicate of {d.person_id}
                </div>
                <div style={{ fontSize: P.type.meta, color: P.inkMute }}>via {d.via} · similarity {d.similarity != null ? Number(d.similarity).toFixed(1) : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                <PBtn size="xs" variant="secondary" onClick={() => { location.hash = '#/customers/' + encodeURIComponent(d.person_id); }}>Open</PBtn>
                <PBtn size="xs" variant="secondary" disabled={!canMerge} title={!canMerge ? 'Requires analyst access' : undefined} onClick={() => onMerge(d.person_id)}>Merge</PBtn>
              </div>
            </div>))}
        </Card>

        <Card padding={16}>
          <MicroLabel>Retention</MicroLabel>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <KV label="Estate policy" hint="From /api/idv/retention — applies estate-wide, not just to this person."
              value={retentionPoll.loading && !retentionPoll.data ? '…' : retentionPoll.data ? (RETENTION_POLICY_LABEL[retentionPoll.data.policy] || retentionPoll.data.policy) : '—'} />
            <KV label="Face templates" value={String(person.face_template_count || 0)} mono />
            <KV label="Consent" value="Not exposed by the API"
              hint="Capture stores consent per session (docs/IDV-API-CONTRACT.md capture API), but no console route returns it yet — this file can't show what it was never given." />
          </div>
        </Card>
      </div>);
  }

  function PersonFile({ navigate, id, can, role }) {
    const P = useP();
    const S = window.IdvShared;
    const poll = window.HWIdv.usePoll('/api/idv/people/' + encodeURIComponent(id), 20000);
    const retentionPoll = window.HWIdv.usePoll('/api/idv/retention', 60000);
    const [panel, setPanel] = React.useState(null); // null | 'reverify' | 'newverify' | 'addlist' | 'merge'
    const [mergeTarget, setMergeTarget] = React.useState('');

    const isAnalystPlus = role === 'analyst' || role === 'admin';
    const canMerge = can ? can('merge_person') : isAnalystPlus;
    const canAddList = can ? can('add_to_list') : isAnalystPlus;
    // idv-client.jsx's ACTION_MIN_ROLE now has an explicit create_session:
    // 'analyst' entry (see the file-header note above, which predates this
    // fix), so "New verification"/"Ask to re-verify" use the real can() key
    // like merge/add-to-list already did, instead of the role() workaround.
    const canCreateSession = can ? can('create_session') : isAnalystPlus;

    const back = (
      <button onClick={() => navigate('#/customers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', padding: 0, fontSize: P.type.meta, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name="arrow-left" size={12} stroke={2} />Customers
      </button>);

    if (poll.error && !poll.data) {
      const notConnected = poll.error === 'no-live-seam';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {back}
          {notConnected ? <S.NotConnected onRetry={poll.refresh} /> : <ErrorState title="This customer file didn’t load" detail={poll.error} onRetry={poll.refresh} />}
        </div>);
    }
    if (poll.loading && !poll.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {back}
          <S.SkeletonCard lines={3} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,.85fr) minmax(320px,1.3fr) minmax(240px,.85fr)', gap: 16 }}>
            <S.SkeletonCard lines={7} />
            <S.SkeletonTable rows={4} />
            <S.SkeletonCard lines={6} />
          </div>
        </div>);
    }

    const data = poll.data || {};
    const person = data.person;
    if (!person) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {back}
          <EmptyState icon="user-off" title="You can’t find this customer"
            body="This id doesn’t match anyone on file — they may have been merged into another record. Search from the Customers list instead."
            action={<PBtn size="sm" variant="secondary" icon="arrow-left" onClick={() => navigate('#/customers')}>Back to Customers</PBtn>} />
        </div>);
    }

    const sessions = (Array.isArray(data.sessions) ? data.sessions.slice() : [])
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const documents = Array.isArray(data.documents) ? data.documents : [];
    const templates = Array.isArray(data.templates) ? data.templates : [];
    const duplicates = Array.isArray(data.duplicates) ? data.duplicates : [];

    const name = personDisplayName(person);
    const kycDays = daysUntil(person.kyc_expires_at);
    const lastSession = sessions[sessions.length - 1];
    const defaultWorkflowId = lastSession && lastSession.workflow ? lastSession.workflow.id : undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {back}
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Avatar name={name} size={44} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: P.type.h1, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{name}</h1>
                <Pill kind={PERSON_STATUS_TONE[person.status] || 'neutral'} dot size="sm">{PERSON_STATUS_LABEL[person.status] || person.status || 'Unknown'}</Pill>
                {kycDays != null && kycDays <= 30 && (
                  <Pill kind={kycDays <= 0 ? 'neutral' : kycDays <= 14 ? 'bad' : 'warn'} size="sm">
                    {kycDays <= 0 ? 'KYC expired' : `Document expires in ${kycDays} day${kycDays === 1 ? '' : 's'}`}
                  </Pill>)}
              </div>
              <div style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>idv_people/{person.id}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PBtn size="sm" variant="secondary" icon="refresh" disabled={!canCreateSession} title={!canCreateSession ? 'Requires analyst access' : undefined}
                onClick={() => setPanel(panel === 'reverify' ? null : 'reverify')}>Ask to re-verify</PBtn>
              <PBtn size="sm" variant="secondary" icon="flag" disabled={!canAddList} title={!canAddList ? 'Requires analyst access' : undefined}
                onClick={() => setPanel(panel === 'addlist' ? null : 'addlist')}>Add to list</PBtn>
              <PBtn size="sm" variant="secondary" icon="users" disabled={!canMerge} title={!canMerge ? 'Requires analyst access' : undefined}
                onClick={() => { setMergeTarget(''); setPanel(panel === 'merge' ? null : 'merge'); }}>Merge into…</PBtn>
              <PBtn size="sm" variant="accent" icon="plus" disabled={!canCreateSession} title={!canCreateSession ? 'Requires analyst access' : undefined}
                onClick={() => setPanel(panel === 'newverify' ? null : 'newverify')}>New verification</PBtn>
            </div>
          </div>
        </Card>

        {panel === 'reverify' && <CreateSessionPanel person={person} mode="reverify" defaultWorkflowId={defaultWorkflowId} onClose={() => setPanel(null)} />}
        {panel === 'newverify' && <CreateSessionPanel person={person} mode="new" onClose={() => setPanel(null)} />}
        {panel === 'addlist' && <AddToListPanel person={person} onClose={() => setPanel(null)} />}
        {panel === 'merge' && <MergePanel person={person} defaultTarget={mergeTarget} onClose={() => setPanel(null)} onMerged={() => poll.refresh()} />}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,.85fr) minmax(320px,1.3fr) minmax(240px,.85fr)', gap: 16, alignItems: 'start' }}>
          <StandingColumn person={person} />
          <TimelineColumn sessions={sessions} navigate={navigate} />
          <EvidenceColumn person={person} documents={documents} templates={templates} duplicates={duplicates}
            retentionPoll={retentionPoll} canMerge={canMerge} onMerge={(pid) => { setMergeTarget(pid); setPanel('merge'); }} />
        </div>
      </div>);
  }

  // The middle column: every session, oldest first, grouped by year (design
  // source's tab 3 timeline). Function declarations hoist, so its use above
  // in PersonFile resolves fine regardless of definition order.
  function TimelineColumn({ sessions, navigate }) {
    if (!sessions.length) {
      return (
        <Card padding={16}>
          <EmptyState compact icon="clock" title="No sessions yet"
            body="Once this person starts a verification, every attempt lines up here in order, oldest first." />
        </Card>);
    }
    let lastYear = null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MicroLabel>Verification history</MicroLabel>
          <Pill kind="ghost" size="sm">{sessions.length} session{sessions.length === 1 ? '' : 's'}</Pill>
          <Pill kind="ghost" size="sm">oldest first</Pill>
        </div>
        {sessions.map((s) => {
          const year = s.created_at ? new Date(s.created_at).getFullYear() : null;
          const showYear = year != null && year !== lastYear;
          lastYear = year;
          return (
            <React.Fragment key={s.id}>
              {showYear && <YearLabel year={year} />}
              <SessionCard session={s} onClick={() => navigate('#/sessions/' + encodeURIComponent(s.id))} />
            </React.Fragment>);
        })}
      </div>);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Customers list — #/customers
  // ═══════════════════════════════════════════════════════════════════════

  function PeopleList({ navigate }) {
    const P = useP();
    const S = window.IdvShared;
    const [qInput, setQInput] = React.useState('');
    const [q, setQ] = React.useState('');
    const [status, setStatus] = React.useState('all');
    const [hasHits, setHasHits] = React.useState('any');
    const [expiringBefore, setExpiringBefore] = React.useState('');
    const [rows, setRows] = React.useState([]);
    const [count, setCount] = React.useState(null);
    const [nextCursor, setNextCursor] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [notConnected, setNotConnected] = React.useState(false);
    const reqRef = React.useRef(0);

    React.useEffect(() => {
      const t = setTimeout(() => setQ(qInput.trim()), 350);
      return () => clearTimeout(t);
    }, [qInput]);

    const buildPath = React.useCallback((cursor) => {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (status !== 'all') p.set('status', status);
      if (hasHits !== 'any') p.set('has_hits', hasHits === 'yes' ? 'true' : 'false');
      if (expiringBefore) p.set('expiring_before', expiringBefore);
      p.set('limit', '50');
      if (cursor) p.set('cursor', cursor);
      return '/api/idv/people?' + p.toString();
    }, [q, status, hasHits, expiringBefore]);

    const load = React.useCallback(async (opts) => {
      const cursor = opts && opts.cursor;
      const myReq = ++reqRef.current;
      if (!cursor) { setLoading(true); setError(null); setNotConnected(false); }
      else setLoadingMore(true);
      const r = await window.HWIdv.get(buildPath(cursor));
      if (myReq !== reqRef.current) return; // a newer request landed first
      if (!cursor) setLoading(false); else setLoadingMore(false);
      if (!r.ok) {
        if (r.error === 'no-live-seam') setNotConnected(true); else setError(r.error || ('HTTP ' + r.code));
        if (!cursor) setRows([]);
        return;
      }
      const body = r.body || {};
      setCount(typeof body.count === 'number' ? body.count : null);
      setNextCursor(body.next_cursor || null);
      setRows((prev) => (cursor ? prev.concat(body.rows || []) : (body.rows || [])));
    }, [buildPath]);

    React.useEffect(() => { load(); }, [load]);

    function clearFilters() { setQInput(''); setQ(''); setStatus('all'); setHasHits('any'); setExpiringBefore(''); }
    const anyFilterActive = !!(q || status !== 'all' || hasHits !== 'any' || expiringBefore);

    const columns = [
      { label: 'Customer', render: (r) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar name={personDisplayName(r)} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personDisplayName(r)}</div>
              <div style={{ fontSize: P.type.meta, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email_masked || r.phone_masked || r.vendor_data || '—'}</div>
            </div>
          </div>) },
      { label: 'Status', render: (r) => <Pill kind={PERSON_STATUS_TONE[r.status] || 'neutral'} dot size="sm">{PERSON_STATUS_LABEL[r.status] || r.status || 'Unknown'}</Pill> },
      { label: 'Sessions', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono }}>{r.sessions_count != null ? r.sessions_count : '—'}</span> },
      { label: 'Last verified', render: (r) => r.last_verified_at ? window.HWIdv.fmt.date(r.last_verified_at) : 'Never' },
      { label: 'KYC expires', render: (r) => {
          if (!r.kyc_expires_at) return <span style={{ color: P.inkMute }}>—</span>;
          const days = daysUntil(r.kyc_expires_at);
          const tone = days == null ? P.inkMute : days < 0 ? P.inkMute : days <= 14 ? P.bad : days <= 30 ? P.warn : P.good;
          return <span style={{ color: tone, fontFamily: P.fontMono }}>{days == null ? '—' : days < 0 ? 'Expired' : days + 'd'}</span>;
        } },
      { label: 'List hits', align: 'right', render: (r) => (r.list_hits && r.list_hits.length) ? <Pill kind="bad" size="sm">{r.list_hits.length}</Pill> : <Pill kind="ghost" size="sm">None</Pill> },
    ];

    let body;
    if (loading) {
      body = <SkeletonRows rows={6} avatar />;
    } else if (notConnected) {
      body = <S.NotConnected onRetry={() => load()} />;
    } else if (error) {
      body = <ErrorState detail={error} onRetry={() => load()} />;
    } else if (rows.length === 0) {
      body = (
        <EmptyState icon="users" title={anyFilterActive ? 'No customers match these filters' : 'No customers yet'}
          body={anyFilterActive
            ? 'Try a broader search, or clear the status, hits and expiry filters below.'
            : 'Nobody has completed a verification yet — people show up here the moment their first session finishes.'}
          action={anyFilterActive ? <PBtn size="sm" variant="secondary" onClick={clearFilters}>Clear filters</PBtn> : undefined} />);
    } else {
      body = (
        <React.Fragment>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate('#/customers/' + encodeURIComponent(r.id))} />
          {nextCursor && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <PBtn variant="secondary" size="sm" busy={loadingMore} onClick={() => load({ cursor: nextCursor })}>Load more</PBtn>
            </div>)}
        </React.Fragment>);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHead eyebrow="Verify" title="Customers"
          subtitle="Search everyone you’ve ever verified — sessions, documents and list hits all live on their file."
          action={count != null ? <Pill kind="ghost">{window.HWIdv.fmt.number(count)} total</Pill> : undefined} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field icon="search" placeholder="Search by name, email, phone or vendor key…" value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ maxWidth: 420 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Seg value={status} onChange={setStatus} options={PERSON_STATUS_OPTS} size="sm" />
            <Seg value={hasHits} onChange={setHasHits} options={HAS_HITS_OPTS} size="sm" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: P.type.meta, color: P.inkMute, whiteSpace: 'nowrap' }}>KYC expires before</span>
              <Field type="date" value={expiringBefore} onChange={(e) => setExpiringBefore(e.target.value)} size="sm" style={{ width: 158 }} />
            </div>
            {anyFilterActive && <PBtn size="sm" variant="ghost" icon="x" onClick={clearFilters}>Clear</PBtn>}
          </div>
        </div>
        {body}
      </div>);
  }

  // ── route entry ─────────────────────────────────────────────────────────
  // See the file-header ROUTING GAP note: idv/app.jsx has no parametric entry
  // for '/customers/:id' today, so this branch is unreachable until that map
  // grows one. Parsed the same defensive way incentives/screen-contest-
  // detail.jsx reads '/contests/:id'.
  window.IdvPeopleScreen = function IdvPeopleScreen(props) {
    const parts = (props.path || '').split('/').filter(Boolean); // ['customers', id?]
    const id = parts[1];
    return id
      ? <PersonFile navigate={props.navigate} id={id} can={props.can} role={props.role} />
      : <PeopleList navigate={props.navigate} />;
  };
})();
