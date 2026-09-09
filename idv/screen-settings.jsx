// ── idv/screen-settings.jsx ── #/settings — Team · Audit · Retention · Import ·
//    Questionnaires · Customization ─────────────────────────────────────────
// Contract: docs/IDV-API-CONTRACT.md "Usage, audit, team, retention", "Import
// (migration)", "Workflows, questionnaires, customization". Plan: docs/IDV-
// PLAN-2026-09-08.md §3.9-3.11 (data model), §5.3 (honesty labelling), §6
// (roles), §11.5 (console auth is a platform decision, not built here), §11.7
// (Terms/counsel gate — nothing ships to real guests before counsel signs
// off; this screen only surfaces the draft and the developer instruction).
// Conventions: scratch/idv-conventions-digest-2026-09-08.md §2-§5 + checklist.
//
// ROUTING NOTE — #/settings/:tab vs idv/app.jsx's router. idv/app.jsx (out of
// scope to edit) resolves a screen with EXACT path equality only
// (`ROUTES().find(([p]) => p === path)`) — there is no wildcard match for a
// settings sub-path the way SESSION_DETAIL_RE exists for `/sessions/:id`. A
// literal `#/settings/audit` hash therefore never matches `/settings` and
// app.jsx renders its "did not load" ErrorState instead of this screen — a
// router gap in app.jsx, not something fixable from here without editing it.
// idv/screen-sessions.jsx already worked around the same constraint for ITS
// own view state by keeping filters in a QUERY STRING appended to the
// registered path (`#/sessions?status=...`) rather than a path segment,
// because app.jsx strips everything after `?` before matching
// (`path.split('?')[0]`). This file follows that exact precedent: the tab
// lives at `#/settings?tab=<id>`, which app.jsx matches to `/settings`
// perfectly on cold load and on every navigation, no hacks required. It ALSO
// accepts and silently normalizes the literal `#/settings/:tab` form the
// brief asked for (path segment) by rewriting it to the query form the
// instant the hash appears — at module-eval time (before idv/app.jsx's own
// hashchange listener exists, since this file's <script> tag loads earlier
// in Hyperwolf Verify.html) and again on every subsequent hashchange, so
// BOTH url shapes land on this screen with the right tab selected, on cold
// load and mid-session alike.
;(function () {
  const useP = window.useP;
  const HWIdv = window.HWIdv;
  const IdvShared = window.IdvShared;

  const TAB_IDS = ['team', 'audit', 'retention', 'import', 'questionnaires', 'customization'];
  const TAB_LABELS = {
    team: 'Team', audit: 'Audit', retention: 'Retention', import: 'Import',
    questionnaires: 'Questionnaires', customization: 'Customization',
  };

  // ── #/settings/:tab <-> #/settings?tab=:tab (see file header) ───────────
  function parseSettingsTab() {
    let h = '';
    try { h = window.location.hash || ''; } catch (e) { /* noop */ }
    const seg = h.match(/^#\/settings\/([^/?]+)/);
    if (seg && TAB_IDS.indexOf(seg[1]) !== -1) return seg[1];
    const qi = h.indexOf('?');
    if (qi >= 0) {
      const usp = new URLSearchParams(h.slice(qi + 1));
      const t = usp.get('tab');
      if (t && TAB_IDS.indexOf(t) !== -1) return t;
    }
    return 'team';
  }
  // Rewrites a path-segment settings hash to the query form BEFORE idv/
  // app.jsx's router ever sees it, so the exact-match router in app.jsx
  // still resolves this screen. Registered at module scope (this file loads
  // before idv/app.jsx in Hyperwolf Verify.html), and 'hashchange' listeners
  // fire in registration order, so this always runs before app.jsx's own.
  function normalizeSettingsPathTab() {
    let h = '';
    try { h = window.location.hash || ''; } catch (e) { /* noop */ }
    const m = h.match(/^#\/settings\/([^/?]+)/);
    if (m && TAB_IDS.indexOf(m[1]) !== -1) {
      try {
        window.history.replaceState(null, '', '#/settings' + (m[1] === 'team' ? '' : ('?tab=' + m[1])));
      } catch (e) { /* noop */ }
    }
  }
  normalizeSettingsPathTab();
  try { window.addEventListener('hashchange', normalizeSettingsPathTab); } catch (e) { /* noop */ }

  function useSettingsTab() {
    const [tab, setTabState] = React.useState(parseSettingsTab);
    React.useEffect(() => {
      function onHash() { setTabState(parseSettingsTab()); }
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);
    const setTab = React.useCallback((t) => {
      setTabState(t);
      try { window.history.replaceState(null, '', '#/settings' + (t === 'team' ? '' : ('?tab=' + t))); } catch (e) { /* noop */ }
    }, []);
    return [tab, setTab];
  }

  // ── small local composites (same shape as screen-integrate.jsx's own
  // file-local CardHead — not a shared atom, each screen keeps its own) ────
  function CardHead({ icon, title, meta, action }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 26, height: 26, borderRadius: P.r8, background: P.surface3, color: P.inkDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name={icon} size={14} stroke={1.9} />
        </span>
        <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, flex: '0 0 auto' }}>{title}</div>
        {meta}
        <div style={{ flex: 1 }} />
        {action}
      </div>);
  }

  function WarnBanner({ children }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', gap: 8, padding: 10, background: P.warnSoft, borderRadius: P.r8 }}>
        <Icon name="alert" size={15} stroke={1.8} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ fontSize: P.type.meta, color: P.warnText, lineHeight: 1.55 }}>{children}</div>
      </div>);
  }

  function AdminNote({ can, action, children }) {
    const P = useP();
    if (can) return null;
    return (
      <div style={{ marginTop: 10, fontSize: P.type.meta, color: P.inkMute }}>
        {children || `You are signed in as an analyst (the estate's fallback identity) — ${action} needs admin.`}
      </div>);
  }

  const SELECT_STYLE_BASE = (P) => ({
    padding: '0 11px', borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field,
    color: P.ink, fontFamily: P.fontSans, fontSize: P.type.body,
  });

  function formatBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  // Confirm dialog — overlayScrim/overlayCard atoms + Card, no private modal
  // shell (pos/atoms.jsx's own documented pattern for a fixed overlay).
  function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) {
    const P = useP();
    React.useEffect(() => {
      if (!open) return undefined;
      const onKey = (e) => e.key === 'Escape' && onCancel && onCancel();
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!open) return null;
    return (
      <div style={window.overlayScrim(P, {})} onClick={onCancel}>
        <div style={{ ...window.overlayCard, width: 'min(460px,94%)' }} onClick={(e) => e.stopPropagation()}>
          <Card elevation="raised">
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, marginBottom: 18 }}>{body}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <PBtn variant="ghost" onClick={onCancel} disabled={busy}>Cancel</PBtn>
              <PBtn variant={danger ? 'danger' : 'accent'} onClick={onConfirm} busy={busy}>{confirmLabel}</PBtn>
            </div>
          </Card>
        </div>
      </div>);
  }

  // ══════════════════════════════════════════════════════════════ Team ════
  // Contract: GET /api/idv/team -> { rows:[{associate_id,name,role,store_id}],
  // auth_note }. POST /api/idv/team/{id}/role (admin) { role } -> {associate_id,role}.
  const ROLE_OPTIONS = ['viewer', 'analyst', 'admin'];

  function TeamTab({ can }) {
    const P = useP();
    const poll = HWIdv.usePoll('/api/idv/team', 30000);
    const [savingId, setSavingId] = React.useState(null);
    const isAdmin = can('team');

    async function changeRole(associateId, role) {
      setSavingId(associateId);
      const r = await HWIdv.post(`/api/idv/team/${encodeURIComponent(associateId)}/role`, { role });
      setSavingId(null);
      if (!r.ok) {
        window.hdToast && window.hdToast({ title: 'Role not changed', description: r.error || `HTTP ${r.code}`, tone: 'blocked' });
        return;
      }
      window.hdToast && window.hdToast({ title: 'Role updated', description: `${associateId} is now ${(r.body && r.body.role) || role}.`, tone: 'ok' });
      poll.refresh();
    }

    if (poll.error) return <IdvShared.NotConnected onRetry={poll.refresh} />;
    if (poll.loading && !poll.data) return <IdvShared.SkeletonTable rows={5} />;

    const rows = (poll.data && poll.data.rows) || [];
    const authNote = poll.data && poll.data.auth_note;

    const columns = [
      { label: 'Associate', key: 'name', render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Avatar name={r.name} size={26} />
          <div>
            <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{r.name}</div>
            <div style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>{r.associate_id}</div>
          </div>
        </div>) },
      { label: 'Store', key: 'store_id', render: (r) => <span style={{ fontSize: P.type.body, color: P.ink2 }}>{r.store_id || '—'}</span> },
      { label: 'Role', key: 'role', align: 'right', render: (r) => (
        isAdmin ? (
          <select value={r.role} disabled={savingId === r.associate_id} onChange={(e) => changeRole(r.associate_id, e.target.value)}
            style={{ ...SELECT_STYLE_BASE(P), height: P.ctrlH.sm }}>
            {ROLE_OPTIONS.map((rl) => <option key={rl} value={rl}>{rl}</option>)}
          </select>
        ) : <Pill kind="neutral" size="sm">{r.role}</Pill>) },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {authNote && <WarnBanner>{authNote}</WarnBanner>}
        <Card>
          <CardHead icon="users" title="Team" meta={<Pill kind="neutral" size="sm">{rows.length} associate{rows.length === 1 ? '' : 's'}</Pill>} />
          {rows.length === 0
            ? <EmptyState icon="users" title="No associates yet" body="Associates appear here once they exist in the Connecteam roster." />
            : <DataTable columns={columns} rows={rows} rowKey={(r) => r.associate_id} />}
          <AdminNote can={isAdmin} action="changing a role" />
        </Card>
      </div>);
  }

  // ═════════════════════════════════════════════════════════════ Audit ════
  // Contract: GET /api/idv/audit?actor&action&via&from&to&path&limit&cursor
  // -> { rows:[{at,actor_id,actor_role,via,method,path,status,action,
  // target_type,target_id,ip,detail}] }. The real backend (wmdemo/idv_api.py
  // L625-632) also returns idv_version + next_cursor, which the contract
  // doc's fenced example omits — used here for cursor "Load more".
  function AuditTab() {
    const P = useP();
    const [f, setF] = React.useState({ actor: '', action: '', via: '', path: '', from: '', to: '' });
    const [rows, setRows] = React.useState([]);
    const [cursor, setCursor] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    function buildQuery(f2, c) {
      const p = new URLSearchParams();
      if (f2.actor) p.set('actor', f2.actor);
      if (f2.action) p.set('action', f2.action);
      if (f2.via) p.set('via', f2.via);
      if (f2.path) p.set('path', f2.path);
      if (f2.from) p.set('from', f2.from + 'T00:00:00Z');
      if (f2.to) p.set('to', f2.to + 'T23:59:59Z');
      p.set('limit', '50');
      if (c) p.set('cursor', c);
      return p.toString();
    }
    async function load(f2, reset, cursorOverride) {
      setLoading(true); setError(null);
      const r = await HWIdv.get('/api/idv/audit?' + buildQuery(f2, reset ? null : (cursorOverride !== undefined ? cursorOverride : cursor)));
      setLoading(false);
      if (!r.ok) { setError(r.error || `HTTP ${r.code}`); return; }
      const newRows = (r.body && r.body.rows) || [];
      // Audit rows carry no stable id (contract: at/actor/via/method/path/
      // status/action/target/ip/detail only) — two rows can legitimately
      // share every one of those (e.g. two same-second list-entry adds with
      // the same target), which produced a real React duplicate-key warning
      // in manual verification. Tag each row with its position in the
      // accumulated list instead of composing a "unique" key from fields
      // that are not actually guaranteed unique.
      setRows((prev) => {
        const base = reset ? 0 : prev.length;
        const tagged = newRows.map((row, i) => ({ ...row, _k: base + i }));
        return reset ? tagged : prev.concat(tagged);
      });
      setCursor((r.body && r.body.next_cursor) || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { load(f, true); }, []); // initial load only — filter changes go through Search/Enter

    function onSearch() { load(f, true, null); }
    function onLoadMore() { load(f, false); }
    function clearFilters() {
      const cleared = { actor: '', action: '', via: '', path: '', from: '', to: '' };
      setF(cleared);
      load(cleared, true, null);
    }

    const columns = [
      { label: 'At', key: 'at', render: (r) => <span style={{ fontSize: P.type.meta, color: P.inkDim, whiteSpace: 'nowrap' }}>{window.HD ? window.HD.formatDateTime(r.at) : r.at}</span> },
      { label: 'Actor', key: 'actor', render: (r) => (
        <div>
          <div style={{ fontSize: P.type.body, color: P.ink, fontFamily: P.fontMono }}>{r.actor_id || '—'}</div>
          {r.actor_role && <div style={{ fontSize: P.type.micro, color: P.inkFaint }}>{r.actor_role}</div>}
        </div>) },
      { label: 'Via', key: 'via', render: (r) => <Pill kind="neutral" size="sm">{r.via || '—'}</Pill> },
      { label: 'Method / path or action', key: 'mp', render: (r) => (
        r.method || r.path
          ? <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink2 }}>{r.method} {r.path}{r.status != null ? ` · ${r.status}` : ''}</span>
          : <span style={{ fontSize: P.type.body, color: P.ink2 }}>{r.action || '—'}</span>) },
      { label: 'Target', key: 'target', render: (r) => (r.target_type || r.target_id)
          ? <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>{r.target_type}{r.target_id ? ` · ${r.target_id}` : ''}</span>
          : <span style={{ color: P.inkFaint }}>—</span> },
      { label: 'IP', key: 'ip', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>{r.ip || '—'}</span> },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardHead icon="list" title="Audit trail" meta={<Pill kind="neutral" size="sm">{rows.length} row{rows.length === 1 ? '' : 's'}</Pill>}
            action={<PBtn variant="secondary" size="sm" icon="search" onClick={onSearch} busy={loading && rows.length === 0}>Search</PBtn>} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: '1 1 150px', minWidth: 130 }}>
              <Field placeholder="Actor id" value={f.actor} onChange={(e) => setF((x) => ({ ...x, actor: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 130 }}>
              <Field placeholder="Action" value={f.action} onChange={(e) => setF((x) => ({ ...x, action: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
            </div>
            <div style={{ flex: '1 1 170px', minWidth: 150 }}>
              <Field placeholder="Path contains…" mono value={f.path} onChange={(e) => setF((x) => ({ ...x, path: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
            </div>
            <select value={f.via} onChange={(e) => { const v = e.target.value; const nf = { ...f, via: v }; setF(nf); load(nf, true, null); }}
              style={{ ...SELECT_STYLE_BASE(P), height: P.ctrlH.md }} aria-label="Filter by via">
              <option value="">Any via</option>
              <option value="console">Console</option>
              <option value="system">System</option>
            </select>
            <input type="date" aria-label="From date" value={f.from} onChange={(e) => setF((x) => ({ ...x, from: e.target.value }))}
              style={{ ...SELECT_STYLE_BASE(P), height: P.ctrlH.md, padding: '0 10px' }} />
            <input type="date" aria-label="To date" value={f.to} onChange={(e) => setF((x) => ({ ...x, to: e.target.value }))}
              style={{ ...SELECT_STYLE_BASE(P), height: P.ctrlH.md, padding: '0 10px' }} />
          </div>

          {error ? <ErrorState onRetry={onSearch} detail={error} />
            : (loading && rows.length === 0) ? <IdvShared.SkeletonTable rows={6} />
            : rows.length === 0 ? (
              <EmptyState icon="list" title="No audit rows match" compact
                body="Every console request and analyst action is logged here — widen the filters or clear them."
                action={<PBtn variant="secondary" size="sm" onClick={clearFilters}>Clear filters</PBtn>} />
            ) : (
              <React.Fragment>
                <DataTable columns={columns} rows={rows} dense rowKey={(r) => r._k} />
                {cursor && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                    <PBtn variant="secondary" size="sm" busy={loading} onClick={onLoadMore}>Load more</PBtn>
                  </div>)}
              </React.Fragment>)}
        </Card>
      </div>);
  }

  // ═══════════════════════════════════════════════════════════ Retention ══
  // Contract: GET /api/idv/retention -> {policy, media_count, media_bytes,
  // oldest_media_at, at_rest, deletion_requests:{pending}} + addendum fields
  // {consented, unconsented, purging_next_24h}. GET/POST-execute deletion-
  // requests. T&C: idv/idv-terms.jsx's Link/Modal + window.IDV_TERMS.
  function RetentionTab({ can }) {
    const P = useP();
    const poll = HWIdv.usePoll('/api/idv/retention', 30000);
    const delPoll = HWIdv.usePoll('/api/idv/deletion-requests', 30000);
    const terms = window.IdvTerms.useTerms();
    const T = window.IDV_TERMS;
    const [confirmReq, setConfirmReq] = React.useState(null);
    const [executing, setExecuting] = React.useState(false);
    const isAdmin = can('deletion');

    async function doExecute() {
      if (!confirmReq) return;
      setExecuting(true);
      const r = await HWIdv.post(`/api/idv/deletion-requests/${encodeURIComponent(confirmReq.id)}/execute`, {});
      setExecuting(false);
      if (!r.ok) {
        window.hdToast && window.hdToast({ title: 'Execute failed', description: r.error || `HTTP ${r.code}`, tone: 'blocked' });
        return;
      }
      const b = r.body || {};
      window.hdToast && window.hdToast({
        title: 'Deletion executed',
        description: `${b.outcome || 'done'} · media ${b.media_deleted ?? 0} · templates ${b.templates_deleted ?? 0}${b.tombstoned ? ' · tombstoned' : ''}`,
        tone: 'ok' });
      setConfirmReq(null);
      delPoll.refresh(); poll.refresh();
    }

    if (poll.error) return <IdvShared.NotConnected onRetry={poll.refresh} />;
    if (poll.loading && !poll.data) return <IdvShared.SkeletonCard lines={6} />;
    const R = poll.data || {};

    const delRows = (delPoll.data && delPoll.data.rows) || [];
    const delColumns = [
      { label: 'Target', key: 'target', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta }}>{r.target_type} · {r.target_id}</span> },
      { label: 'Instruction', key: 'instruction', render: (r) => <span style={{ fontSize: P.type.body, color: P.ink2 }}>{r.instruction}</span> },
      { label: 'Requested', key: 'requested_at', render: (r) => (
        <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{r.requested_by} · {window.HD ? window.HD.formatDateTime(r.requested_at) : r.requested_at}</span>) },
      { label: 'Status', key: 'status', align: 'right', render: (r) => (
        r.executed_at
          ? <Pill kind="good" size="sm">Executed{r.outcome ? ` · ${r.outcome}` : ''}</Pill>
          : isAdmin
            ? <PBtn variant="danger" size="xs" icon="trash" onClick={() => setConfirmReq(r)}>Execute</PBtn>
            : <Pill kind="warn" size="sm">Pending</Pill>) },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardHead icon="lock" title="Retention policy" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: P.type.body, color: P.ink2, lineHeight: 1.55, marginBottom: 14 }}>
            <div>Licence-derived data is kept for verification and fraud prevention only.</div>
            <div>Selfie and face-template data are kept only with biometric consent.</div>
            <div style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>At rest: {R.at_rest || '—'}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ flex: '1 1 160px', minWidth: 150 }}><StatTile icon="database" label="Media" value={window.HWIdv.fmt.number(R.media_count ?? 0)} sub={formatBytes(R.media_bytes)} hue="info" /></div>
            <div style={{ flex: '1 1 160px', minWidth: 150 }}><StatTile icon="check-circle" label="Consented" value={window.HWIdv.fmt.number(R.consented ?? 0)} sub="until customer deleted" hue="ok" /></div>
            <div style={{ flex: '1 1 160px', minWidth: 150 }}><StatTile icon="shield" label="Unconsented" value={window.HWIdv.fmt.number(R.unconsented ?? 0)} sub="purge after decision" hue="warn" /></div>
            <div style={{ flex: '1 1 160px', minWidth: 150 }}><StatTile icon="clock" label="Purging next 24h" value={window.HWIdv.fmt.number(R.purging_next_24h ?? 0)} hue="warn" /></div>
          </div>
        </Card>

        <Card>
          <CardHead icon="scroll" title="Terms and Conditions" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <window.IdvTerms.Link />
            <span style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>version {terms.version || '—'}</span>
          </div>
          {T && T.developerInstruction && <div style={{ marginTop: 10 }}><WarnBanner>{T.developerInstruction}</WarnBanner></div>}
        </Card>

        <Card>
          <CardHead icon="trash" title="Deletion requests" meta={<Pill kind="neutral" size="sm">{delRows.length}</Pill>} />
          {delPoll.error ? <IdvShared.NotConnected onRetry={delPoll.refresh} compact />
            : (delPoll.loading && !delPoll.data) ? <IdvShared.SkeletonTable rows={3} />
            : delRows.length === 0
              ? <EmptyState icon="trash" title="No deletion requests" compact
                  body="Requests appear here when a session or person delete is requested from session detail or the People screen." />
              : <DataTable columns={delColumns} rows={delRows} rowKey={(r) => r.id} />}
        </Card>

        <ConfirmDialog open={!!confirmReq} title="Execute deletion?"
          body={confirmReq && (
            <React.Fragment>
              <div>Target: <b style={{ fontFamily: P.fontMono }}>{confirmReq.target_type} · {confirmReq.target_id}</b></div>
              <div style={{ marginTop: 6 }}>Instruction: <b>{confirmReq.instruction}</b></div>
              <div style={{ marginTop: 10, color: P.inkDim, fontSize: P.type.meta }}>Purges media and, unless the request retains it, the face template. This cannot be undone.</div>
            </React.Fragment>)}
          confirmLabel="Execute" danger busy={executing} onConfirm={doExecute} onCancel={() => setConfirmReq(null)} />
      </div>);
  }

  // ═══════════════════════════════════════════════════════════════ Import ═
  // Contract: POST /api/idv/import/didit/{kind} (admin) -> 202 {run:RunReport};
  // GET /api/idv/import/runs?kind&limit -> {rows:[RunReport]}. Invariant:
  // rows_read == inserted+unchanged+conflicts+rejected. The backend
  // (wmdemo/idv_api.py L1789-1805) always records a `failed` run today with
  // the literal error "...no DIDIT_API_KEY is configured on this server,
  // so nothing was read" — matched exactly below.
  const IMPORT_KINDS = ['sessions', 'media', 'users', 'lists', 'workflows', 'questionnaires'];
  const RUN_STATUS_TONE = { running: 'info', ok: 'good', partial: 'warn', failed: 'bad' };
  const DIDIT_KEY_NOTE = 'Needs DIDIT_API_KEY in wm-demo/.env — run tools/set_didit_key.sh';

  // ── run detail drawer — GET /api/idv/import/runs/{id} -> { run, rejects:
  // [{row_ref,reason}], conflicts:[{row_ref,field,ours,theirs}] } (contract
  // line 202). A reject whose row_ref is prefixed "media:" is a media file
  // that failed to store, not a rejected row (idv_import_didit.py's
  // run.media_error()) — flagged with its own pill so a run that silently
  // dropped media is visible instead of blending into the row-reject count.
  function ImportRunDrawer({ run, onClose }) {
    const P = useP();
    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    React.useEffect(() => {
      let alive = true;
      setState({ loading: true, error: null, data: null });
      HWIdv.get(`/api/idv/import/runs/${encodeURIComponent(run.id)}`).then((r) => {
        if (!alive) return;
        if (!r.ok) { setState({ loading: false, error: r.error || `HTTP ${r.code}`, data: null }); return; }
        setState({ loading: false, error: null, data: r.body });
      });
      return () => { alive = false; };
    }, [run.id]);

    const rejects = ((state.data && state.data.rejects) || []).map((r, i) => ({ ...r, _k: i }));
    const conflicts = ((state.data && state.data.conflicts) || []).map((r, i) => ({ ...r, _k: i }));
    const mediaCount = rejects.filter((r) => /^media:/.test(r.row_ref || '')).length;

    const rejectColumns = [
      { label: 'Row', key: 'row_ref', render: (r) => {
          const isMedia = /^media:/.test(r.row_ref || '');
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink }}>{(r.row_ref || '').replace(/^media:/, '')}</span>
              {isMedia && <Pill kind="warn" size="sm">Media</Pill>}
            </div>);
        } },
      { label: 'Reason', key: 'reason', render: (r) => <span style={{ fontSize: 12, color: P.ink2 }}>{r.reason}</span> },
    ];
    const conflictColumns = [
      { label: 'Row', key: 'row_ref', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink }}>{r.row_ref}</span> },
      { label: 'Field', key: 'field', render: (r) => <span style={{ fontSize: 12, color: P.ink2 }}>{r.field}</span> },
      { label: 'Ours', key: 'ours', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{r.ours}</span> },
      { label: 'Theirs', key: 'theirs', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{r.theirs}</span> },
    ];

    return (
      <Sheet open onClose={onClose} width={560}>
        <div style={{ padding: 16, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, textTransform: 'capitalize' }}>{run.kind} run #{run.id}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 2 }}>
              {rejects.length} reject{rejects.length === 1 ? '' : 's'}{mediaCount ? ` (${mediaCount} media)` : ''} · {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
            </div>
          </div>
          <IconBtn icon="x" onClick={onClose} label="Close" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {state.loading ? <IdvShared.SkeletonTable rows={4} /> :
           state.error ? <ErrorState compact detail={state.error} onRetry={() => setState({ loading: true, error: null, data: null })} /> :
            <React.Fragment>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Rejects · {rejects.length}
                </div>
                {rejects.length === 0
                  ? <div style={{ fontSize: 12.5, color: P.inkMute }}>No rejected rows on this run.</div>
                  : <DataTable dense rowKey={(r) => r._k} columns={rejectColumns} rows={rejects} />}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Conflicts · {conflicts.length}
                </div>
                {conflicts.length === 0
                  ? <div style={{ fontSize: 12.5, color: P.inkMute }}>No field conflicts on this run.</div>
                  : <DataTable dense rowKey={(r) => r._k} columns={conflictColumns} rows={conflicts} />}
              </div>
            </React.Fragment>}
        </div>
      </Sheet>);
  }

  function ImportTab({ can }) {
    const P = useP();
    const [busyKind, setBusyKind] = React.useState(null);
    const [rows, setRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [drawerRun, setDrawerRun] = React.useState(null);
    const isAdmin = can('import'); // idv-client.jsx's ACTION_MIN_ROLE now has an explicit import: 'admin' entry (contract: admin)

    async function loadRuns() {
      setLoading(true); setError(null);
      const r = await HWIdv.get('/api/idv/import/runs?limit=50');
      setLoading(false);
      if (!r.ok) { setError(r.error || `HTTP ${r.code}`); return; }
      setRows((r.body && r.body.rows) || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { loadRuns(); }, []);

    async function triggerImport(kind) {
      setBusyKind(kind);
      const r = await HWIdv.post(`/api/idv/import/didit/${kind}`, { since: null, limit: 500, resume: false });
      setBusyKind(null);
      if (!r.ok) {
        window.hdToast && window.hdToast({ title: 'Import did not start', description: r.error || `HTTP ${r.code}`, tone: 'blocked' });
        return;
      }
      const run = r.body && r.body.run;
      const keyIssue = !!(run && run.error && run.error.indexOf('DIDIT_API_KEY') !== -1);
      window.hdToast && window.hdToast({
        title: run ? `${kind} run #${run.id}: ${run.status}` : `${kind} import attempted`,
        description: keyIssue ? DIDIT_KEY_NOTE : ((run && run.error) || 'See the runs table below.'),
        tone: run && run.status === 'ok' ? 'ok' : run && run.status === 'partial' ? 'warn' : 'blocked' });
      loadRuns();
    }

    function invariantHolds(r) {
      return (r.rows_read || 0) === (r.inserted || 0) + (r.unchanged || 0) + (r.conflicts || 0) + (r.rejected || 0);
    }

    const columns = [
      { label: 'Kind', key: 'kind', render: (r) => <span style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink, textTransform: 'capitalize' }}>{r.kind}</span> },
      { label: 'Status', key: 'status', render: (r) => <Pill kind={RUN_STATUS_TONE[r.status] || 'neutral'} size="sm" dot>{r.status}</Pill> },
      { label: 'Read', key: 'rows_read', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono }}>{r.rows_read ?? 0}</span> },
      { label: 'Invariant', key: 'inv', render: (r) => {
          // A running import has not finished reading yet, so rows_read !=
          // inserted+unchanged+conflicts+rejected is expected, not a defect —
          // judging the invariant on an in-flight row painted every running
          // import red. Only rows that have actually finished get judged.
          if (r.status === 'running') {
            return (
              <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>
                In progress · {r.rows_read ?? 0} row{(r.rows_read ?? 0) === 1 ? '' : 's'} read so far
              </span>);
          }
          const ok = invariantHolds(r);
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: P.fontMono, fontSize: P.type.meta, color: ok ? P.inkDim : P.bad, fontWeight: ok ? 400 : 700 }}>
              {r.rows_read ?? 0} = {r.inserted ?? 0}+{r.unchanged ?? 0}+{r.conflicts ?? 0}+{r.rejected ?? 0}
              {!ok && <Icon name="alert" size={12} stroke={2.2} color={P.bad} />}
            </span>);
        } },
      { label: 'Unresolved', key: 'unresolved_identities', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>{r.unresolved_identities ?? '—'}</span> },
      { label: 'Started / finished', key: 'started_at', render: (r) => (
        <span style={{ fontSize: P.type.meta, color: P.inkDim, whiteSpace: 'nowrap' }}>
          {window.HD ? window.HD.formatDateTime(r.started_at) : r.started_at}
          {r.finished_at ? ` → ${window.HD ? window.HD.formatDateTime(r.finished_at) : r.finished_at}` : ' · running'}
        </span>) },
      { label: 'Error', key: 'error', render: (r) => {
          if (!r.error) return <span style={{ color: P.inkFaint }}>—</span>;
          const keyIssue = r.error.indexOf('DIDIT_API_KEY') !== -1;
          return (
            <div style={{ maxWidth: 300 }}>
              <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.45 }}>{r.error}</div>
              {keyIssue && <div style={{ marginTop: 4, fontSize: P.type.meta, color: P.warnText, fontWeight: 700 }}>{DIDIT_KEY_NOTE}</div>}
            </div>);
        } },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardHead icon="download" title="Didit history" meta={<Pill kind="neutral" size="sm">migration, not live sync</Pill>} />
          <div style={{ fontSize: P.type.body, color: P.inkDim, marginBottom: 12, lineHeight: 1.55 }}>
            Pulls historical rows from Didit into this system, once per kind. Every run is recorded below honestly — a run that reads nothing is marked <b>failed</b>, never a silent "0 rows, ok".
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {IMPORT_KINDS.map((k) => (
              <PBtn key={k} variant="secondary" size="sm" icon="download" busy={busyKind === k}
                disabled={!isAdmin || (!!busyKind && busyKind !== k)}
                title={isAdmin ? undefined : 'Admin role required'} onClick={() => triggerImport(k)}>
                {k[0].toUpperCase() + k.slice(1)}
              </PBtn>))}
          </div>
          <AdminNote can={isAdmin} action="starting an import run" />
        </Card>

        <Card>
          <CardHead icon="database" title="Import runs" meta={<Pill kind="neutral" size="sm">{rows.length}</Pill>}
            action={<PBtn variant="ghost" size="xs" icon="refresh" onClick={loadRuns} busy={loading}>Refresh</PBtn>} />
          {error ? <ErrorState onRetry={loadRuns} detail={error} />
            : (loading && rows.length === 0) ? <IdvShared.SkeletonTable rows={4} />
            : rows.length === 0
              ? <EmptyState icon="database" title="No import runs yet" body="Trigger one above — even a failed run (e.g. missing DIDIT_API_KEY) is recorded here." />
              : <React.Fragment>
                  <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} dense onRowClick={(r) => setDrawerRun(r)} />
                  <div style={{ marginTop: 8, fontSize: P.type.micro, color: P.inkFaint }}>Click a run to see its rejects and conflicts, including any media that failed to store.</div>
                </React.Fragment>}
        </Card>

        {drawerRun && <ImportRunDrawer run={drawerRun} onClose={() => setDrawerRun(null)} />}
      </div>);
  }

  // ═══════════════════════════════════════════════════════ Questionnaires ═
  // Contract: GET|POST|PATCH /api/idv/questionnaires[/{id}] -> {id,name,
  // version,status,schema:[{id,type,label,options,required}]}. Backend
  // requires admin on POST/PATCH (wmdemo/idv_api.py L1361-1394) though the
  // contract's prose doesn't mark it "(admin)" the way workflows/
  // customization do — gated via HWIdv.can('questionnaires'), which already
  // has this right per idv-client.jsx's own role table.
  const QUESTION_TYPES = [
    { value: 'single', label: 'Single choice' }, { value: 'multi', label: 'Multi choice' },
    { value: 'text', label: 'Text' }, { value: 'date', label: 'Date' }, { value: 'bool', label: 'Yes / no' },
  ];
  function blankQuestion() { return { id: 'q_' + Math.random().toString(36).slice(2, 8), type: 'text', label: '', options: [], required: false }; }
  function blankQuestionnaire() { return { id: null, name: '', status: 'active', schema: [blankQuestion()] }; }

  function QuestionnairesTab({ can }) {
    const P = useP();
    const poll = HWIdv.usePoll('/api/idv/questionnaires', 30000);
    const [editing, setEditing] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const isAdmin = can('questionnaires');

    function startNew() { setEditing(blankQuestionnaire()); }
    function startEdit(q) { setEditing({ id: q.id, name: q.name, status: q.status, schema: (q.schema || []).map((s) => ({ ...s })) }); }
    function updateQ(i, patch) { setEditing((e) => ({ ...e, schema: e.schema.map((s, si) => (si === i ? { ...s, ...patch } : s)) })); }
    function addQ() { setEditing((e) => ({ ...e, schema: e.schema.concat([blankQuestion()]) })); }
    function removeQ(i) { setEditing((e) => ({ ...e, schema: e.schema.filter((_, si) => si !== i) })); }

    async function save() {
      if (!editing || !editing.name.trim()) {
        window.hdToast && window.hdToast({ title: 'Name required', description: 'Give the questionnaire a name before saving.', tone: 'blocked' });
        return;
      }
      setSaving(true);
      const schema = editing.schema.map((s) => ({
        id: s.id, type: s.type, label: s.label,
        options: (s.type === 'single' || s.type === 'multi') ? (s.options || []) : [],
        required: !!s.required }));
      const r = editing.id
        ? await HWIdv.patch(`/api/idv/questionnaires/${encodeURIComponent(editing.id)}`, { name: editing.name, schema, status: editing.status })
        : await HWIdv.post('/api/idv/questionnaires', { name: editing.name, schema });
      setSaving(false);
      if (!r.ok) { window.hdToast && window.hdToast({ title: 'Save failed', description: r.error || `HTTP ${r.code}`, tone: 'blocked' }); return; }
      window.hdToast && window.hdToast({ title: 'Saved', description: `${editing.name} saved.`, tone: 'ok' });
      setEditing(null);
      poll.refresh();
    }

    if (poll.error) return <IdvShared.NotConnected onRetry={poll.refresh} />;
    if (poll.loading && !poll.data) return <IdvShared.SkeletonTable rows={3} />;
    const rows = (poll.data && poll.data.rows) || [];

    const columns = [
      { label: 'Name', key: 'name', render: (r) => <span style={{ fontWeight: 600, color: P.ink }}>{r.name}</span> },
      { label: 'Version', key: 'version', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>v{r.version}</span> },
      { label: 'Status', key: 'status', render: (r) => <Pill kind={r.status === 'active' ? 'good' : 'neutral'} size="sm">{r.status}</Pill> },
      { label: 'Questions', key: 'n', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>{(r.schema || []).length}</span> },
      { label: '', key: 'edit', align: 'right', render: (r) => (
        <PBtn variant="ghost" size="xs" icon="pencil" disabled={!isAdmin} title={isAdmin ? undefined : 'Admin role required'} onClick={() => startEdit(r)}>Edit</PBtn>) },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardHead icon="scroll" title="Questionnaires"
            action={<PBtn variant="accent" size="sm" icon="plus" disabled={!isAdmin} title={isAdmin ? undefined : 'Admin role required'} onClick={startNew}>New questionnaire</PBtn>} />
          {rows.length === 0
            ? <EmptyState icon="scroll" title="No questionnaires yet" body="Build one to collect extra answers during capture."
                action={isAdmin ? <PBtn variant="secondary" size="sm" onClick={startNew}>New questionnaire</PBtn> : undefined} />
            : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
          <AdminNote can={isAdmin} action="creating or editing a questionnaire" />
        </Card>

        {editing && (
          <Card elevation="raised">
            <CardHead icon={editing.id ? 'pencil' : 'plus'} title={editing.id ? `Edit — ${editing.name || 'questionnaire'}` : 'New questionnaire'}
              action={<PBtn variant="ghost" size="xs" icon="x" onClick={() => setEditing(null)}>Cancel</PBtn>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 4 }}>Name</div>
                <Field value={editing.name} onChange={(e) => setEditing((ed) => ({ ...ed, name: e.target.value }))} placeholder="e.g. Medical eligibility" />
              </div>
              {editing.id && (
                <div>
                  <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 4 }}>Status</div>
                  <Seg value={editing.status} onChange={(v) => setEditing((ed) => ({ ...ed, status: v }))}
                    options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} size="sm" />
                </div>)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: P.type.meta, color: P.inkDim }}>Questions</div>
                {editing.schema.map((q, i) => (
                  <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: P.canvas2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select value={q.type} onChange={(e) => updateQ(i, { type: e.target.value })} style={{ ...SELECT_STYLE_BASE(P), height: P.ctrlH.sm }}>
                        {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <div style={{ flex: '1 1 200px', minWidth: 160 }}><Field value={q.label} onChange={(e) => updateQ(i, { label: e.target.value })} placeholder="Question label" /></div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: P.type.meta, color: P.inkDim, whiteSpace: 'nowrap' }}>
                        <Check on={!!q.required} onChange={(v) => updateQ(i, { required: v })} size={17} /> Required
                      </label>
                      <IconBtn icon="trash" label="Remove question" onClick={() => removeQ(i)} />
                    </div>
                    {(q.type === 'single' || q.type === 'multi') && (
                      <Field value={(q.options || []).join(', ')}
                        onChange={(e) => updateQ(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        placeholder="Options, comma separated" />)}
                  </div>))}
                <PBtn variant="secondary" size="sm" icon="plus" onClick={addQ}>Add question</PBtn>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</PBtn>
                <PBtn variant="accent" onClick={save} busy={saving}>Save</PBtn>
              </div>
            </div>
          </Card>)}
      </div>);
  }

  // ═══════════════════════════════════════════════════════════ Customization
  // Contract: GET|PUT /api/idv/customization (PUT admin) -> {brand_name,
  // logo_media_id, accent, copy:{intro,document,selfie,processing,approved,
  // review,declined,paused}, hosted_domain, updated_at}. accent must be a
  // pos/tokens.jsx token name — restricted here to the signal/accent set
  // (accent, good, warn, bad, info, neutral), per plan §3.11.
  const ACCENT_TOKENS = ['accent', 'good', 'warn', 'bad', 'info', 'neutral'];
  const COPY_STEPS = [
    { key: 'intro', label: 'Intro' }, { key: 'document', label: 'Document' }, { key: 'selfie', label: 'Selfie' },
    { key: 'processing', label: 'Processing' }, { key: 'approved', label: 'Approved' }, { key: 'review', label: 'In review' },
    { key: 'declined', label: 'Declined' }, { key: 'paused', label: 'Engine paused' },
  ];

  function CustomizationTab({ can }) {
    const P = useP();
    const poll = HWIdv.usePoll('/api/idv/customization', 30000);
    const [draft, setDraft] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const isAdmin = can('customization');

    React.useEffect(() => {
      if (poll.data && !draft) {
        setDraft({
          brand_name: poll.data.brand_name || '',
          accent: ACCENT_TOKENS.indexOf(poll.data.accent) !== -1 ? poll.data.accent : 'accent',
          copy: { ...(poll.data.copy || {}) },
          hosted_domain: poll.data.hosted_domain || '',
        });
      }
    }, [poll.data]); // eslint-disable-line react-hooks/exhaustive-deps

    async function save() {
      setSaving(true);
      const r = await HWIdv.put('/api/idv/customization', draft);
      setSaving(false);
      if (!r.ok) { window.hdToast && window.hdToast({ title: 'Save failed', description: r.error || `HTTP ${r.code}`, tone: 'blocked' }); return; }
      window.hdToast && window.hdToast({ title: 'Saved', description: 'Customization updated.', tone: 'ok' });
      poll.refresh();
    }

    if (poll.error) return <IdvShared.NotConnected onRetry={poll.refresh} />;
    if ((poll.loading && !draft) || !draft) return <IdvShared.SkeletonCard lines={7} />;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardHead icon="sliders" title="White label"
            action={<PBtn variant="accent" size="sm" icon="check" disabled={!isAdmin} busy={saving} title={isAdmin ? undefined : 'Admin role required'} onClick={save}>Save</PBtn>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 4 }}>Brand name</div>
                <Field value={draft.brand_name} disabled={!isAdmin} onChange={(e) => setDraft((d) => ({ ...d, brand_name: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 4 }}>Hosted domain</div>
                <Field value={draft.hosted_domain} disabled={!isAdmin} placeholder="verify.hyperwolf.com" onChange={(e) => setDraft((d) => ({ ...d, hosted_domain: e.target.value }))} />
              </div>
              <div style={{ flex: '0 0 180px' }}>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 4 }}>Accent token</div>
                <select value={draft.accent} disabled={!isAdmin} onChange={(e) => setDraft((d) => ({ ...d, accent: e.target.value }))}
                  style={{ ...SELECT_STYLE_BASE(P), width: '100%', height: P.ctrlH.md }}>
                  {ACCENT_TOKENS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 8 }}>Copy per step</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {COPY_STEPS.map((step) => (
                  <div key={step.key}>
                    <div style={{ fontSize: P.type.micro, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{step.label}</div>
                    <Field value={(draft.copy && draft.copy[step.key]) || ''} disabled={!isAdmin}
                      onChange={(e) => setDraft((d) => ({ ...d, copy: { ...d.copy, [step.key]: e.target.value } }))} />
                  </div>))}
              </div>
            </div>
            <AdminNote can={isAdmin} action="editing customization" />
          </div>
        </Card>

        <Card elevation="sunken">
          <CardHead icon="eye" title="Live preview" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Pill kind={draft.accent} size="md" dot>{draft.brand_name || 'Hyperwolf'}</Pill>
            <span style={{ fontSize: P.type.body, color: P.ink2 }}>{(draft.copy && draft.copy.intro) || '—'}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: P.type.meta, color: P.inkFaint, fontFamily: P.fontMono }}>
            accent token: {draft.accent}{draft.hosted_domain ? ` · ${draft.hosted_domain}` : ''}
          </div>
        </Card>
      </div>);
  }

  // ═════════════════════════════════════════════════════════════ Screen ═══
  function IdvSettingsScreen(props) {
    const P = useP();
    const role = (props && props.role) ? props.role : window.HWIdv.role();
    const can = (props && props.can) ? props.can : window.HWIdv.can;
    const [tab, setTab] = useSettingsTab();

    return (
      <div>
        <SectionHead eyebrow="Verify" title="Settings" level={2}
          subtitle="Team roles, the audit trail, retention & deletion, the Didit migration, questionnaires and white-label customization."
          action={<Pill kind="neutral" size="sm">signed in as {role}</Pill>} />
        <Tabs value={tab} onChange={setTab} style={{ marginBottom: 18 }}
          options={TAB_IDS.map((id) => ({ value: id, label: TAB_LABELS[id] }))} />
        {tab === 'team' && <TeamTab can={can} />}
        {tab === 'audit' && <AuditTab can={can} />}
        {tab === 'retention' && <RetentionTab can={can} />}
        {tab === 'import' && <ImportTab can={can} />}
        {tab === 'questionnaires' && <QuestionnairesTab can={can} />}
        {tab === 'customization' && <CustomizationTab can={can} />}
      </div>);
  }

  window.IdvSettingsScreen = IdvSettingsScreen;
})();
