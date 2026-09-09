// ── idv/screen-sessions.jsx ── #/sessions — Verifications table ────────────
// Design: explorations/Verify - Concept A - Console.html, tab "Verifications"
// (dense table, filter bar, quick chips, toolbar). Contract: docs/IDV-API-
// CONTRACT.md "GET /api/idv/sessions", "POST /api/idv/sessions", "GET /api/
// idv/workflows", "GET /api/idv/import/runs". Plan: docs/IDV-PLAN-2026-09-08
// .md §5.3 (honesty labelling), §5.6 (console shape — "verifications table
// ... in Concept A's console density").
//
// Change status lives on session detail, not here (brief + plan §5.6's
// action bar is on #/sessions/:id) — this screen only reads, filters,
// exports what is loaded, and creates a new session.
//
// URL IS THE SOURCE OF TRUTH FOR FILTERS, per the exploration's own claim
// ("Sorting and filters are in the URL, so a filtered view is a link you can
// send to someone"). Every filter change calls `navigate` with a rebuilt
// query string; this component never keeps a separate "current filters"
// state that could drift from the address bar — it re-derives filters from
// `location.hash` on every render. idv/app.jsx keys the routed frame by
// PATH only (not path+query), so switching a filter re-renders this same
// component instance rather than remounting it — and idv/app.jsx's own
// `hashchange` listener already forces that re-render on every hash change,
// including a query-only change, so reading `location.hash` fresh at the
// top of the function body (no state mirror) is enough to pick up back-
// button navigation too.
;(function () {
  const useP = window.useP;
  const HWIdv = window.HWIdv;
  const IdvShared = window.IdvShared;

  // ── fixed enums, from the contract when it is loaded, else verbatim from
  // the contract's "Common fragments" as a fallback (the hosted capture page
  // and some older pages never load contracts/index.js).
  const HWContracts = window.HWContracts;
  const FALLBACK_STATUS_LIST = ['Not Started', 'In Progress', 'Awaiting User', 'In Review', 'Approved',
    'Declined', 'Resubmitted', 'Abandoned', 'Expired', 'Kyc Expired'];
  const FALLBACK_REASON_LIST = [
    'LIVENESS_LOW', 'LIVENESS_FAILED_3X', 'FACE_MATCH_LOW', 'DOC_QUALITY_LOW', 'BARCODE_OCR_MISMATCH',
    'NAME_MISMATCH_EXPECTED', 'DUPLICATE_PERSON', 'IP_HOSTING', 'IP_VPN', 'AGE_ESTIMATE_UNDER_MARGIN',
    'OUT_OF_STATE', 'DOC_NEAR_EXPIRY', 'ENGINE_UNAVAILABLE_MANUAL',
    'DOC_EXPIRED', 'UNDER_AGE', 'FACE_BLOCKLIST_HIT', 'DOCUMENT_BLOCKLIST_HIT', 'USER_BLOCKLIST_HIT',
    'IP_TOR', 'INJECTION_DETECTED', 'CHALLENGE_NONCE_MISMATCH', 'LIVENESS_ATTEMPTS_EXHAUSTED_HARD',
  ];
  const STATUS_LIST = (HWContracts && typeof HWContracts.enumValues === 'function')
    ? HWContracts.enumValues('VerificationStatus') : FALLBACK_STATUS_LIST;
  const REASON_LIST = (HWContracts && typeof HWContracts.enumValues === 'function')
    ? HWContracts.enumValues('VerificationReason') : FALLBACK_REASON_LIST;
  // Filter enum is fuller than the create-dialog's channel enum (below) —
  // "import" and "embedded" are things a session CAN be, never things this
  // console creates directly.
  const CHANNEL_FILTER_LIST = ['hosted', 'embedded', 'pos', 'import'];
  const NEW_SESSION_CHANNELS = [{ value: 'hosted', label: 'Hosted link' }, { value: 'pos', label: 'POS check-in' }];
  const DOC_TYPE_LABEL = { DL: 'Driver Licence', ID: 'ID Card', PASSPORT: 'Passport' };
  const chLabel = (c) => c === 'hosted' ? 'Hosted' : c === 'embedded' ? 'Embedded' : c === 'pos' ? 'POS' : c === 'import' ? 'Import' : (c || '—');

  const opt = (id) => ({ id, label: id });

  // ── URL <-> filter object ─────────────────────────────────────────────
  function parseHashQuery() {
    const h = window.location.hash || '';
    const qi = h.indexOf('?');
    const usp = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
    const list = (k) => (usp.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      q: usp.get('q') || '',
      status: list('status'),
      workflow_id: list('workflow_id'),
      reason: list('reason'),
      channel: list('channel'),
      origin: usp.get('origin') || '',
      imported: usp.get('imported') === 'true',
      from: usp.get('from') || '',
      to: usp.get('to') || '',
    };
  }
  // Multi-value params are sent comma-separated — the contract's query line
  // (`?status&workflow_id&q&from&to&channel&origin&reason&imported&limit&
  // cursor`) never states the multi-value encoding, so this is a documented
  // guess (see the report's contract-gaps list), not a confirmed backend
  // behaviour.
  function buildApiQuery(f) {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.status.length) p.set('status', f.status.join(','));
    if (f.workflow_id.length) p.set('workflow_id', f.workflow_id.join(','));
    if (f.reason.length) p.set('reason', f.reason.join(','));
    if (f.channel.length) p.set('channel', f.channel.join(','));
    if (f.origin) p.set('origin', f.origin);
    if (f.imported) p.set('imported', 'true');
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
    p.set('limit', '50');
    return p.toString();
  }
  function hasAnyFilter(f) {
    return !!(f.q || f.status.length || f.workflow_id.length || f.reason.length || f.channel.length || f.origin || f.imported || f.from || f.to);
  }
  function isoDayRange(daysAgo) {
    const now = new Date();
    const from = new Date(now.getTime() - daysAgo * 86400000);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  function todayUtcRange() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { from: start.toISOString(), to: now.toISOString() };
  }

  // ── CSV export — the loaded rows only, never a re-fetch ─────────────────
  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv(rows) {
    const headers = ['session_number', 'status', 'person', 'vendor_data', 'document_type', 'issuing_state',
      'workflow', 'workflow_version', 'channel', 'origin', 'reasons', 'created_at', 'completed_at', 'imported_from'];
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      lines.push([
        r.session_number, r.status, (r.person && r.person.display_name) || '', r.vendor_data || '',
        (r.document && r.document.type) || '', (r.document && r.document.issuing_state) || '',
        (r.workflow && r.workflow.name) || '', (r.workflow && r.workflow.version) || '',
        r.channel || '', r.origin || '', (r.reasons || []).join('; '), r.created_at || '', r.completed_at || '', r.imported_from || '',
      ].map(csvCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hyperwolf-verify-sessions-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Client-side only, on whatever is currently loaded — the API contract
  // lists no `sort` param on GET /api/idv/sessions, so there is nothing to
  // ask the server to do instead.
  function sortRows(rows, sort) {
    if (!sort) return rows;
    const mul = sort.dir === 'asc' ? 1 : -1;
    const copy = rows.slice();
    copy.sort((a, b) => {
      let av, bv;
      if (sort.key === 'session_number') { av = a.session_number || 0; bv = b.session_number || 0; }
      else if (sort.key === 'created_at') { av = a.created_at || ''; bv = b.created_at || ''; }
      else { av = a.status || ''; bv = b.status || ''; }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return copy;
  }

  // ── small chip toggle button (quick filters) ─────────────────────────────
  function QuickChip({ active, onClick, children }) {
    const P = useP();
    return (
      <button type="button" onClick={onClick} data-hw-i
        style={{ height: 28, padding: '0 12px', borderRadius: P.r999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: P.fontSans, whiteSpace: 'nowrap',
          background: active ? P.accentSoft : 'transparent', color: active ? P.accentText : P.inkDim,
          border: `1px solid ${active ? P.accentBorder : P.hairline2}` }}>
        {children}
      </button>);
  }

  // ── New session dialog ───────────────────────────────────────────────────
  function NewSessionDialog({ open, onClose, workflows, session, onCreated }) {
    const P = useP();
    const [workflowId, setWorkflowId] = React.useState('');
    const [channel, setChannel] = React.useState('hosted');
    const [vendorData, setVendorData] = React.useState('');
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [dob, setDob] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [result, setResult] = React.useState(null);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
      if (!open) return;
      setError(null); setResult(null); setBusy(false); setCopied(false);
      setVendorData(''); setFirstName(''); setLastName(''); setDob(''); setChannel('hosted');
      setWorkflowId((workflows && workflows[0] && workflows[0].id) || '');
      // eslint-disable-next-line
    }, [open]);

    if (!open) return null;

    function submit() {
      if (!workflowId || busy) return;
      setBusy(true); setError(null);
      const body = { workflow_id: workflowId, channel, store_id: session.storeId, associate_id: session.id };
      const details = {};
      if (firstName.trim()) details.first_name = firstName.trim();
      if (lastName.trim()) details.last_name = lastName.trim();
      if (dob) details.date_of_birth = dob;
      if (Object.keys(details).length) body.expected_details = details;
      if (vendorData.trim()) body.vendor_data = vendorData.trim();
      HWIdv.post('/api/idv/sessions', body).then((r) => {
        setBusy(false);
        if (r.ok && r.body) {
          setResult(r.body);
          window.hdToast && window.hdToast({ title: 'Session created', description: 'No. ' + r.body.session_number, tone: 'good' });
          onCreated && onCreated();
        } else {
          setError(r.gated ? 'This backend is read-only right now — a write token is required.' : (r.error || ('HTTP ' + r.code)));
        }
      });
    }
    function copyUrl() {
      if (!result || !result.url) return;
      navigator.clipboard && navigator.clipboard.writeText(result.url).then(() => {
        setCopied(true);
        window.hdToast && window.hdToast({ title: 'Copied', description: result.url, tone: 'ok' });
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }

    const label = (t) => <div style={{ fontSize: 11, fontWeight: 600, color: P.inkDim, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 5 }}>{t}</div>;

    return (
      <div style={window.overlayScrim(P, { padding: '60px 20px' })} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...window.overlayCard, background: P.surface, borderRadius: P.r16, width: 'min(460px,96vw)', border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: P.type.title, color: P.ink }}>{result ? 'Session created' : 'New session'}</h3>
            <IconBtn icon="x" size={16} onClick={onClose} label="Close" />
          </div>

          {result ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: P.type.body, color: P.inkDim }}>
                Session <b style={{ color: P.ink }}>No. {result.session_number}</b> is <StatusPillHere status={result.status} /> — send the link below, or point the guest at it in the store.
              </div>
              <div>
                {label('Hosted URL')}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, height: P.ctrlH.md, display: 'flex', alignItems: 'center', padding: '0 11px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8, fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.url}</div>
                  <PBtn variant={copied ? 'primary' : 'secondary'} icon={copied ? 'check' : 'copy'} onClick={copyUrl}>{copied ? 'Copied' : 'Copy'}</PBtn>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkFaint }}>Expires {HWIdv.fmt.date(result.expires_at)}.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="accent" onClick={onClose}>Done</PBtn>
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                {label('Workflow')}
                <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}
                  style={{ width: '100%', height: P.ctrlH.md, padding: '0 11px', borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontFamily: P.fontSans, fontSize: 13.5 }}>
                  {(!workflows || !workflows.length) && <option value="">No workflows loaded</option>}
                  {(workflows || []).map((w) => <option key={w.id} value={w.id}>{w.name} · v{w.version}</option>)}
                </select>
              </div>
              <div>
                {label('Channel')}
                <Seg value={channel} onChange={setChannel} options={NEW_SESSION_CHANNELS} full />
              </div>
              <div>
                {label('Vendor data (optional)')}
                <Field placeholder="e.g. email:<sha256> or pos:<id>" value={vendorData} onChange={(e) => setVendorData(e.target.value)} mono />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: P.inkDim, letterSpacing: '.04em', textTransform: 'uppercase' }}>Expected details (optional)</div>
                <div style={{ fontSize: 11.5, color: P.inkFaint }}>Used to cross-check the document once it comes back — leave blank if you don't know it yet.</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <Field placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                {label('Date of birth')}
                <Field type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              {error && <div style={{ fontSize: 12.5, color: P.bad, background: P.badSoft, borderRadius: P.r8, padding: '8px 11px' }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="ghost" onClick={onClose}>Cancel</PBtn>
                <PBtn variant="accent" onClick={submit} disabled={!workflowId} busy={busy}>Create session</PBtn>
              </div>
            </div>
          )}
        </div>
      </div>);
  }
  // Tiny local alias so the dialog's confirmation line can use the shared
  // pill without importing IdvShared just for one line — same component,
  // named locally to keep the JSX above readable.
  function StatusPillHere({ status }) { return <IdvShared.StatusPill status={status} />; }

  // ── main screen ───────────────────────────────────────────────────────
  window.IdvSessionsScreen = function IdvSessionsScreen({ navigate, path, session }) {
    const P = useP();
    const filters = parseHashQuery();
    const apiQuery = buildApiQuery(filters);
    const apiPath = '/api/idv/sessions?' + apiQuery;

    const poll = HWIdv.usePoll(apiPath, 20000);
    const [extraPages, setExtraPages] = React.useState([]);
    const [nextCursor, setNextCursor] = React.useState(null);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [sort, setSort] = React.useState(null);
    const [newOpen, setNewOpen] = React.useState(false);
    const [workflows, setWorkflows] = React.useState([]);

    // A new first-page fetch (filters changed, or the poll's own version
    // moved) replaces whatever was loaded beyond page 1 — the cursors we
    // were holding are for a dataset that may no longer match.
    React.useEffect(() => {
      setExtraPages([]);
      setNextCursor(poll.data ? poll.data.next_cursor || null : null);
      // eslint-disable-next-line
    }, [poll.data]);

    React.useEffect(() => {
      let alive = true;
      HWIdv.get('/api/idv/workflows').then((r) => {
        if (alive && r.ok && r.body) setWorkflows(r.body.rows || []);
      });
      return () => { alive = false; };
    }, []);

    function loadMore() {
      if (!nextCursor || loadingMore) return;
      setLoadingMore(true);
      HWIdv.get(apiPath + '&cursor=' + encodeURIComponent(nextCursor)).then((r) => {
        setLoadingMore(false);
        if (r.ok && r.body) {
          setExtraPages((prev) => prev.concat([r.body]));
          setNextCursor(r.body.next_cursor || null);
        } else {
          window.hdToast && window.hdToast({ title: 'Could not load more', description: r.error || ('HTTP ' + r.code), tone: 'blocked' });
        }
      });
    }

    function setFilters(patch) {
      const next = Object.assign({}, filters, patch);
      const qs = buildApiQuery(next);
      // buildApiQuery adds limit=50 for the API call; strip it for the URL —
      // it is a request detail, not a filter the URL needs to carry.
      const usp = new URLSearchParams(qs);
      usp.delete('limit');
      const s = usp.toString();
      navigate('#' + path + (s ? '?' + s : ''));
    }
    function clearFilters() { navigate('#' + path); }

    const loadedRows = (poll.data ? poll.data.rows || [] : []).concat(extraPages.flatMap((p) => p.rows || []));
    const rows = sortRows(loadedRows, sort);
    const count = poll.data && typeof poll.data.count === 'number' ? poll.data.count : null;
    const headerTitle = count != null ? count.toLocaleString() + ' verifications' : 'Verifications';

    const workflowOptions = workflows.map((w) => ({ id: w.id, label: w.name + ' · v' + w.version }));
    const statusOptions = STATUS_LIST.map(opt);
    const reasonOptions = REASON_LIST.map(opt);
    const channelOptions = CHANNEL_FILTER_LIST.map((c) => ({ id: c, label: chLabel(c) }));

    const needsActionOn = filters.status.length === 1 && filters.status[0] === 'Awaiting User';
    const declinedTodayRange = todayUtcRange();
    const declinedTodayOn = filters.status.length === 1 && filters.status[0] === 'Declined' && filters.from === declinedTodayRange.from;

    function toggleNeedsAction() {
      if (needsActionOn) setFilters({ status: [] });
      else setFilters({ status: ['Awaiting User'] });
    }
    function toggleDeclinedToday() {
      if (declinedTodayOn) setFilters({ status: [], from: '', to: '' });
      else setFilters(Object.assign({ status: ['Declined'] }, declinedTodayRange));
    }

    const [datePreset, setDatePreset] = React.useState(filters.from || filters.to ? 'custom' : '30d');
    function applyPreset(v) {
      setDatePreset(v);
      if (v === 'all') setFilters({ from: '', to: '' });
      else if (v === 'custom') { /* leave from/to exactly as the URL already has them */ }
      else setFilters(isoDayRange(v === '1d' ? 1 : v === '7d' ? 7 : 30));
    }

    function onSort(key) {
      setSort((prev) => (!prev || prev.key !== key) ? { key, dir: key === 'status' ? 'asc' : 'desc' } : { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' });
    }

    const toolbar = (
      <div style={{ display: 'flex', gap: 8 }}>
        <PBtn variant="secondary" size="sm" icon="download" onClick={() => navigate('#/settings/import')}>Import</PBtn>
        <PBtn variant="secondary" size="sm" icon="download" onClick={() => exportCsv(rows)} disabled={!rows.length} title="Exports the rows currently loaded on this page">Export CSV (this page)</PBtn>
        <PBtn variant="accent" size="sm" icon="plus" onClick={() => setNewOpen(true)}>New session</PBtn>
      </div>);

    const filterBar = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}>
          <Field icon="search" placeholder="Name, email, session number, document number" value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} size="sm" />
        </div>
        <MultiSelectFilter label="Status" options={statusOptions} value={filters.status} onChange={(v) => setFilters({ status: v })} />
        <MultiSelectFilter label="Workflow" options={workflowOptions} value={filters.workflow_id} onChange={(v) => setFilters({ workflow_id: v })} />
        <MultiSelectFilter label="Reason" options={reasonOptions} value={filters.reason} onChange={(v) => setFilters({ reason: v })} />
        <MultiSelectFilter label="Channel" options={channelOptions} value={filters.channel} onChange={(v) => setFilters({ channel: v })} />
        <Seg size="sm" value={datePreset} onChange={applyPreset} options={[{ value: '1d', label: '24h' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: 'all', label: 'All' }]} />
        {hasAnyFilter(filters) && <PBtn variant="ghost" size="sm" onClick={clearFilters}>Clear</PBtn>}
      </div>);

    const quickChips = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <QuickChip active={needsActionOn} onClick={toggleNeedsAction}>Needs a guest action</QuickChip>
        <QuickChip active={declinedTodayOn} onClick={toggleDeclinedToday}>Declined today</QuickChip>
        <QuickChip active={filters.imported} onClick={() => setFilters({ imported: !filters.imported })}>Imported from Didit</QuickChip>
      </div>);

    let body;
    const looksDisconnected = poll.error === 'no-live-seam' || (poll.error && /^request failed/.test(poll.error));
    if (poll.loading && !poll.data) {
      body = <IdvShared.SkeletonTable rows={6} />;
    } else if (poll.error && !poll.data) {
      body = looksDisconnected
        ? <IdvShared.NotConnected onRetry={poll.refresh} />
        : <ErrorState title="Verifications didn't load" detail={poll.error} onRetry={poll.refresh} />;
    } else if (poll.data && rows.length === 0) {
      body = <EmptyState icon="shield" title={hasAnyFilter(filters) ? 'No verifications match these filters' : 'No verifications yet'}
        body={hasAnyFilter(filters) ? 'Clear a filter or widen the date range.' : 'Sessions started from a hosted link, POS check-in or the API will show up here.'}
        action={hasAnyFilter(filters) ? <PBtn variant="secondary" size="sm" onClick={clearFilters}>Clear filters</PBtn> : <PBtn variant="accent" size="sm" icon="plus" onClick={() => setNewOpen(true)}>New session</PBtn>} />;
    } else if (poll.data) {
      body = (
        <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, overflow: 'hidden', background: P.surface }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead>
                <tr>
                  <SortableTH label="No." k="session_number" sort={sort || { key: '', dir: 'desc' }} onSort={onSort} />
                  <TH>Guest</TH>
                  <TH>Document</TH>
                  <TH>Workflow</TH>
                  <TH>Channel</TH>
                  <SortableTH label="Status" k="status" sort={sort || { key: '', dir: 'desc' }} onSort={onSort} />
                  <TH>Reasons</TH>
                  <SortableTH label="Created" k="created_at" sort={sort || { key: '', dir: 'desc' }} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TR key={row.id} onClick={() => navigate('#/sessions/' + row.id)}>
                    <TD mono>No. {row.session_number}</TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={(row.person && row.person.display_name) || '?'} size={24} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: row.person ? P.ink : P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {(row.person && row.person.display_name) || 'No name captured'}
                          </div>
                          {row.vendor_data && (
                            <div style={{ fontSize: 11, color: P.inkFaint, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{row.vendor_data}</div>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD>{row.document ? (row.document.issuing_state ? row.document.issuing_state + ' · ' : '') + (DOC_TYPE_LABEL[row.document.type] || row.document.type) : <span style={{ color: P.inkFaint }}>—</span>}</TD>
                    <TD>{row.workflow ? row.workflow.name + ' · v' + row.workflow.version : <span style={{ color: P.inkFaint }}>—</span>}</TD>
                    <TD>
                      <div>{chLabel(row.channel)}</div>
                      {row.origin && <div style={{ fontSize: 11, color: P.inkFaint, fontFamily: P.fontMono }}>{row.origin}</div>}
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <IdvShared.StatusPill status={row.status} />
                        {row.imported_from === 'didit' && (
                          // Not IdvShared.ImportedTag: that composite prints "imported
                          // <date>", and SessionSummary carries no import-run date
                          // (only imported_from) — see the report's contract gap.
                          <Pill kind="neutral" size="sm" icon="download">Imported (Didit)</Pill>
                        )}
                      </div>
                    </TD>
                    <TD><IdvShared.ReasonChips reasons={row.reasons} /></TD>
                    <TD align="right" mono>{HWIdv.fmt.date(row.created_at)}</TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </div>
        </div>);
    } else {
      body = null;
    }

    const bodyHasRows = !!(poll.data && rows.length > 0);

    return (
      <div>
        <SectionHead level={2} eyebrow="Operate" title={headerTitle}
          subtitle="Every session, native and imported. Click a row to open it. Sorting is within the rows you've loaded; filters live in the URL, so a filtered view is a link you can send someone."
          action={toolbar} />
        {filterBar}
        {quickChips}
        {body}
        {bodyHasRows && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div style={{ fontSize: 11.5, color: P.inkFaint, fontFamily: P.fontMono }}>
              {rows.length}{count != null ? ' of ' + count.toLocaleString() : ''} loaded
            </div>
            <div style={{ flex: 1 }} />
            {nextCursor && <PBtn variant="secondary" size="sm" onClick={loadMore} busy={loadingMore}>Load more</PBtn>}
          </div>)}
        {/* onCreated only refreshes the list in the background — it must NOT
            close the dialog, or the guest's hosted URL (the whole point of
            the dialog's result panel) would flash and vanish before anyone
            could read or copy it. Only the result panel's own "Done" button
            (which calls onClose) dismisses the dialog after a create. */}
        <NewSessionDialog open={newOpen} onClose={() => setNewOpen(false)} workflows={workflows} session={session} onCreated={() => poll.refresh()} />
      </div>);
  };
})();
