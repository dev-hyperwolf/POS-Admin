// ── /compliance + /compliance/holds ───────────────────────────────────────
// Ports app/(shell)/compliance/page.tsx, compliance/holds/page.tsx and
// components/compliance/lineage-tree.tsx.
;(function () {
  const useP = window.useP;
  const severity = (h) => (h === 'green' ? 0 : h === 'yellow' ? 1 : 2);

  function MetrcHealthCard() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const worst = OPS.METRC_HEALTH.reduce((acc, e) => (severity(e.health) > severity(acc) ? e.health : acc), 'green');
    const t = worst === 'green' ? 'ok' : worst === 'yellow' ? 'warn' : 'blocked';
    const label = worst === 'green' ? 'All entities green' : worst === 'yellow' ? '1 entity lagging' : '1 entity red';
    return (
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: HD.tone(P, t).fg }}>
          <Icon name="shield" size={16} stroke={1.9} /><span>METRC sync</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: P.ink, lineHeight: 1, letterSpacing: '-.01em' }}>{label}</div>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {OPS.METRC_HEALTH.map((h) => {
            const c = HD.tone(P, h.health === 'green' ? 'ok' : h.health === 'yellow' ? 'warn' : 'blocked');
            return (
              <span key={h.entity} title={`Last sync ${HD.relativeTime(h.lastSyncAt)} · ${h.lagMinutes}m lag`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.fg, border: `1px solid ${c.fg}66` }}>
                <span style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{h.entity}</span>
                <span style={{ fontFamily: P.fontMono }}>{h.lagMinutes}m</span>
              </span>);
          })}
        </div>
      </Card>);
  }

  const THEME_ORDER = ['error', 'poll', 'webhook', 'backfill'];
  const THEME_META = { error: { label: 'Errors', tone: 'blocked' }, poll: { label: 'Polls', tone: 'ok' }, webhook: { label: 'Webhooks', tone: 'info' }, backfill: { label: 'Backfills', tone: 'warn' } };
  function entitySpan(evs) {
    const set = [...new Set(evs.map((e) => e.entity.toUpperCase()))];
    if (set.length === 1) return set[0];
    if (set.length === 2) return `${set[0]} and ${set[1]}`;
    return `${set.length} entities`;
  }
  function summarizeTheme(kind, evs) {
    const n = evs.length, span = entitySpan(evs);
    switch (kind) {
      case 'error': return `${n} sync ${n === 1 ? 'error' : 'errors'} on ${span} — all set to auto-retry; no manual action yet.`;
      case 'poll': return `${n} clean ${n === 1 ? 'poll' : 'polls'} across ${span} — manifests and transfers flowing, zero failures.`;
      case 'webhook': return `${n} live ${n === 1 ? 'webhook' : 'webhooks'} from ${span} — package status changes applied in real time.`;
      default: return `${n} ${n === 1 ? 'backfill' : 'backfills'} on ${span} — gap-filled the prior hour to stay current.`;
    }
  }

  function SyncThemeRow({ kind, events }) {
    const P = useP(), HD = window.HD;
    const [open, setOpen] = React.useState(false);
    const meta = THEME_META[kind];
    const latest = events.reduce((a, b) => (a.at > b.at ? a : b));
    return (
      <li style={{ borderTop: `1px solid ${P.hairline}` }}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          style={{ width: '100%', textAlign: 'left', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}
          onMouseEnter={(e) => (e.currentTarget.style.background = P.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <HDPill tone={meta.tone} icon={false} size="sm" label={`${meta.label} · ${events.length}`} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: P.inkDim }}>
            <Icon name="sparkle" size={12} stroke={2} color={HD.hueColor(P, 'violet')} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summarizeTheme(kind, events)}</span>
          </span>
          <span style={{ fontSize: 12, color: P.inkMute, fontFamily: P.fontMono }}>{HD.relativeTime(latest.at)}</span>
          <Icon name="chevron-down" size={14} stroke={2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        {open && (
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 6px' }}>
            {events.map((ev) => (
              <li key={ev.id} style={{ padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 10, color: P.inkMute, width: 40, flex: '0 0 40px' }}>{ev.entity}</span>
                <span style={{ flex: 1, minWidth: 0, color: P.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.summary}</span>
                <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{HD.relativeTime(ev.at)}</span>
              </li>))}
          </ul>)}
      </li>);
  }

  function MetrcTab() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const groups = THEME_ORDER.map((kind) => ({ kind, events: OPS.METRC_SYNC_EVENTS.slice(0, 24).filter((e) => e.kind === kind) })).filter((g) => g.events.length > 0);
    return (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card padding={0}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Entity sync status</h3>
            <PBtn size="sm" variant="secondary" icon="refresh" onClick={() => window.hdToast?.({ title: 'Force sync queued', description: 'All four entities will re-pull manifests.', tone: 'ok' })}>Force sync all</PBtn>
          </div>
          <HDTable>
            <thead><tr><TH>Entity</TH><TH>Last sync</TH><TH>Lag</TH><TH>Errors (24h)</TH><TH>Health</TH><TH align="right">Action</TH></tr></thead>
            <tbody>
              {OPS.METRC_HEALTH.map((h) => (
                <tr key={h.entity}>
                  <TD><div style={{ color: P.ink }}>{h.entityName}</div><div style={{ fontSize: 11, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h.entity}</div></TD>
                  <TD style={{ fontSize: 13, color: P.ink2 }}>{HD.relativeTime(h.lastSyncAt)}</TD>
                  <TD mono>{h.lagMinutes}m</TD>
                  <TD mono style={{ color: h.errorCount24h > 0 ? HD.tone(P, 'warn').fg : P.inkMute }}>{h.errorCount24h}</TD>
                  <TD><HDPill tone={h.health === 'green' ? 'ok' : h.health === 'yellow' ? 'warn' : 'blocked'} label={h.health === 'green' ? 'Healthy' : h.health === 'yellow' ? 'Lagging' : 'Red'} /></TD>
                  <TD align="right"><PBtn size="xs" variant="ghost" icon="refresh" onClick={() => window.hdToast?.({ title: `Force sync — ${h.entityName}`, tone: 'ok' })}>Force</PBtn></TD>
                </tr>))}
            </tbody>
          </HDTable>
        </Card>
        <Card padding={0}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Recent sync events</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: P.inkMute, maxWidth: 720 }}>Grouped by signal and auto-summarized. Expand a group to read the raw events. Replaces the legacy 24hr polling window per the METRC sync rebuild.</p>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {groups.map((g) => <SyncThemeRow key={g.kind} kind={g.kind} events={g.events} />)}
          </ul>
        </Card>
      </div>);
  }

  function DocumentsTab() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    return (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card padding={0}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>License &amp; document tracker</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: P.inkMute }}>Sorted by expiration. Rows turn warn at &lt;60 days, blocked at &lt;14 days or past expired.</p>
          </div>
          <HDTable>
            <thead><tr><TH>License</TH><TH>Entity</TH><TH>Type</TH><TH>Issued</TH><TH>Expires</TH><TH>Status</TH></tr></thead>
            <tbody>
              {OPS.LICENSE_DOCS.map((l) => {
                const daysToExp = (new Date(l.expires).getTime() - window.HD_DATA.NOW) / 86400000;
                const t = daysToExp < 14 ? 'blocked' : daysToExp < 60 ? 'warn' : 'ok';
                return (
                  <tr key={l.id}>
                    <TD mono>{l.license}</TD>
                    <TD>{l.entityName}</TD>
                    <TD style={{ color: P.ink2, textTransform: 'capitalize' }}>{l.type.replace('_', ' ')}</TD>
                    <TD style={{ fontSize: 13, color: P.inkMute }}>{HD.formatDate(l.issued)}</TD>
                    <TD style={{ fontSize: 13 }}>{HD.formatDate(l.expires)}</TD>
                    <TD><HDPill tone={t} label={daysToExp < 0 ? `Expired ${Math.abs(Math.round(daysToExp))}d ago` : `${Math.round(daysToExp)}d left`} /></TD>
                  </tr>);
              })}
            </tbody>
          </HDTable>
        </Card>
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Icon name="check-circle" size={18} stroke={1.9} color={P.mode === 'dark' ? P.accent : P.accentBorder} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: P.ink }}>COA coverage</div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: P.inkMute, maxWidth: 720 }}>48 of 52 live batches have an attached Certificate of Analysis. Four batches pending lab upload (tier-2 quarantine fallback if not resolved within 72h).</p>
            </div>
            <PBtn size="sm" variant="secondary">Review gaps</PBtn>
          </div>
        </Card>
      </div>);
  }

  function MiniStat({ label, value, tone }) {
    const P = useP(), HD = window.HD;
    const color = tone ? HD.tone(P, tone === 'ok' ? 'ok' : 'warn').fg : P.ink;
    return (
      <div style={{ borderRadius: 8, background: P.canvas2, border: `1px solid ${P.hairline2}`, padding: '8px 12px', minWidth: 80 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 16, fontWeight: 600, color, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      </div>);
  }

  function RecallsTab() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const [suggestOnly, setSuggestOnly] = React.useState(true);
    const [autoPull, setAutoPull] = React.useState(true);
    const ok = HD.tone(P, 'ok');
    return (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: P.ink }}>Auto-quarantine policy</div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: P.inkMute, maxWidth: 720 }}>When a state recall feed matches a batch, Hyperdrive can move affected packages to quarantine automatically. Current locked default: suggest-only (human approves before state hold).</p>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: P.ink2, cursor: 'pointer' }}>
              <Check on={suggestOnly} onChange={setSuggestOnly} size={18} />Suggest-only mode
            </label>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 12, color: P.ink2 }}>
              Auto-pull recall status from METRC
              <span style={{ display: 'block', fontSize: 11, color: P.inkMute }}>Synced via the active-batches API. Matches feed the Recalled column automatically.</span>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: P.ink2, cursor: 'pointer', flex: '0 0 auto' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 99, fontSize: 11, background: autoPull ? ok.bg : P.canvas2, color: autoPull ? ok.fg : P.inkMute, border: `1px solid ${autoPull ? ok.fg + '66' : P.hairline2}` }}>{autoPull ? 'Active' : 'Off'}</span>
              <Switch on={autoPull} onChange={setAutoPull} size={18} />
            </label>
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {OPS.RECALLS.map((r) => (
            <Card key={r.id} padding={16}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HDPill tone="blocked" icon={false} size="sm" label={r.state} />
                    <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkMute }}>{r.recallId}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: P.ink }}>{r.vendorName} · {r.kind}</div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkDim, maxWidth: 680 }}>{r.summary}</p>
                  <div style={{ marginTop: 8, fontSize: 11, color: P.inkMute }}>Announced {HD.relativeTime(r.announcedAt)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 8 }}>
                  <MiniStat label="Batches" value={String(r.affectedBatchIds.length)} />
                  <MiniStat label="Units" value={String(r.affectedUnits)} />
                  <MiniStat label="Quarantined" value={String(r.quarantined)} tone={r.quarantined === r.affectedUnits ? 'ok' : 'warn'} />
                </div>
              </div>
              {r.affectedBatchIds.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.affectedBatchIds.map((bid) => (
                    <span key={bid} style={{ fontFamily: P.fontMono, fontSize: 11, background: P.canvas2, border: `1px solid ${P.hairline2}`, padding: '2px 8px', borderRadius: 6, color: P.ink2 }}>{bid}</span>))}
                  <PBtn size="sm" variant="secondary" style={{ marginLeft: 'auto' }} onClick={() => { location.hash = '#/compliance/holds'; }}>Open quarantine task</PBtn>
                </div>)}
            </Card>))}
        </div>
      </div>);
  }

  function AuditTab() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const [mod, setMod] = React.useState('all');
    const [actor, setActor] = React.useState('all');
    const [query, setQuery] = React.useState('');
    const modules = React.useMemo(() => [...new Set(OPS.AUDIT_LOG.map((a) => a.sourceModule))].sort(), []);
    const actors = React.useMemo(() => [...new Set(OPS.AUDIT_LOG.map((a) => a.actor))].sort(), []);
    const filtered = OPS.AUDIT_LOG.filter((a) => {
      if (mod !== 'all' && a.sourceModule !== mod) return false;
      if (actor !== 'all' && a.actor !== actor) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return a.action.toLowerCase().includes(q) || a.target.toLowerCase().includes(q) || (a.diff || '').toLowerCase().includes(q);
      }
      return true;
    });
    const sel = { height: 34, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13, padding: '0 10px', color: P.ink, fontFamily: P.fontSans };
    return (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={mod} onChange={(e) => setMod(e.target.value)} style={{ ...sel, width: 160 }} aria-label="Module">
            <option value="all">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={actor} onChange={(e) => setActor(e.target.value)} style={{ ...sel, width: 180 }} aria-label="Actor">
            <option value="all">Any actor</option>
            {actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div style={{ flex: 1, maxWidth: 320, minWidth: 200 }}>
            <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, target, diff" aria-label="Search audit log" />
          </div>
          <PBtn size="sm" variant="secondary" icon="download" style={{ marginLeft: 'auto' }} onClick={() => window.hdToast?.({ title: 'Audit log exported', description: `${filtered.length} rows queued as CSV.`, tone: 'ok' })}>Export CSV</PBtn>
        </div>
        <Card padding={0}>
          <HDTable>
            <thead><tr><TH width={140}>When</TH><TH width={120}>Module</TH><TH>Actor</TH><TH>Action</TH><TH>Target</TH><TH>Diff</TH></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><TD colSpan={6}><div style={{ padding: '32px 0', textAlign: 'center', color: P.inkMute, fontSize: 13 }}>No audit entries match.</div></TD></tr>
                : filtered.slice(0, 40).map((entry) => (
                  <tr key={entry.id}>
                    <TD style={{ fontSize: 12, color: P.inkMute }}>{HD.relativeTime(entry.at)}</TD>
                    <TD><HDPill tone="neutral" icon={false} size="sm" label={entry.sourceModule} /></TD>
                    <TD style={{ fontSize: 13, color: P.ink2 }}>{entry.actor}</TD>
                    <TD style={{ fontSize: 13 }}>{entry.action}</TD>
                    <TD mono style={{ fontSize: 11, color: P.inkMute }}>{entry.target}</TD>
                    <TD mono style={{ fontSize: 11, color: P.ink2 }}>{entry.diff || '—'}</TD>
                  </tr>))}
            </tbody>
          </HDTable>
        </Card>
        <p style={{ margin: 0, fontSize: 12, color: P.inkMute }}>Showing {Math.min(filtered.length, 40)} of {filtered.length} matching entries (cap for readability). Append-only log; exports include full history and signed integrity hash.</p>
      </div>);
  }

  window.ScreenCompliance = function ScreenCompliance() {
    const P = useP(), OPS = window.HD_OPS;
    const [tab, setTab] = React.useState('metrc');
    const expiringSoon = OPS.LICENSE_DOCS.filter((l) => (new Date(l.expires).getTime() - window.HD_DATA.NOW) / 86400000 <= 60).length;
    const activeRecalls = OPS.RECALLS.filter((r) => r.affectedBatchIds.length > 0).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          <MetrcHealthCard />
          <StatTile icon="calendar" label="Licenses expiring" value={String(expiringSoon)} sub="Within 60 days" hue={expiringSoon > 0 ? 'warn' : 'ok'} />
          <StatTile icon="flag" label="Active recalls" value={String(activeRecalls)} sub={`${OPS.RECALLS.reduce((s, r) => s + r.affectedUnits, 0)} units affected`} hue={activeRecalls > 0 ? 'blocked' : 'ok'} />
          <StatTile icon="check-circle" label="Documents OK" value={String(OPS.LICENSE_DOCS.length - expiringSoon)} sub="Insurance, COAs, licenses" hue="ok" />
        </div>
        <div style={{ padding: '8px 20px 20px' }}>
          <Tabs value={tab} onChange={setTab} options={[{ value: 'metrc', label: 'METRC' }, { value: 'documents', label: 'Documents' }, { value: 'recalls', label: 'Recalls' }, { value: 'audit', label: 'Audit Trail' }]} />
          {tab === 'metrc' && <MetrcTab />}
          {tab === 'documents' && <DocumentsTab />}
          {tab === 'recalls' && <RecallsTab />}
          {tab === 'audit' && <AuditTab />}
        </div>
      </div>);
  };

  // ── Lineage tree ────────────────────────────────────────────────────────
  function buildTree(root, all) {
    const byUid = new Map(all.map((b) => [b.metrcPackageId, b]));
    const walk = (b) => ({ batch: b, children: (b.childMetrcPackageIds ?? []).map((uid) => byUid.get(uid)).filter(Boolean).map(walk) });
    return walk(root);
  }
  function climbToRoot(batch, all) {
    const byUid = new Map(all.map((b) => [b.metrcPackageId, b]));
    let current = batch, guard = 0;
    while (current.parentMetrcPackageId && guard < 20) {
      const parent = byUid.get(current.parentMetrcPackageId);
      if (!parent) break;
      current = parent; guard++;
    }
    return current;
  }
  const flatten = (node) => [node.batch, ...node.children.flatMap(flatten)];
  const lineageLabel = (s) => ({ recalled: 'Recalled', quarantined: 'Quarantined', destroyed: 'Destroyed', approved: 'Approved' }[s] || s.replace('_', ' '));
  const lineageTone = (s) => ({ recalled: 'blocked', quarantined: 'quarantine', destroyed: 'archived', approved: 'ok' }[s] || 'info');

  function LineageNode({ node, depth, isLast, isRoot }) {
    const P = useP();
    const { batch, children } = node;
    return (
      <div style={{ fontFamily: P.fontMono }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', paddingLeft: depth > 0 ? 16 : 0 }}>
          {depth > 0 && <span style={{ color: P.inkMute, userSelect: 'none' }}>{isLast ? '└─' : '├─'}</span>}
          <UidChip value={batch.metrcPackageId} kind="metrc" size="sm" />
          <span style={{ fontSize: 12, color: P.ink2, fontFamily: P.fontSans }}>{batch.qty > 0 ? `${batch.qty}u` : '(split)'}</span>
          <HDPill tone={lineageTone(batch.status)} label={lineageLabel(batch.status)} size="sm" />
          {isRoot && <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontSans, textTransform: 'uppercase', letterSpacing: '.06em' }}>root</span>}
        </div>
        {children.length > 0 && (
          <div style={{ borderLeft: depth > 0 && !isLast ? `1px solid ${P.hairline2}` : 'none', marginLeft: depth > 0 && !isLast ? 12 : 0 }}>
            {children.map((c, i) => <LineageNode key={c.batch.id} node={c} depth={depth + 1} isLast={i === children.length - 1} isRoot={false} />)}
          </div>)}
      </div>);
  }

  window.LineageTree = function LineageTree({ batch }) {
    const P = useP(), HD = window.HD;
    const all = window.HD_DATA.BATCHES;
    const root = React.useMemo(() => climbToRoot(batch, all), [batch]);
    const tree = React.useMemo(() => buildTree(root, all), [root]);
    const nodes = React.useMemo(() => flatten(tree), [tree]);
    const descendants = nodes.filter((b) => b.id !== root.id);
    const activeDescendants = descendants.filter((b) => b.status !== 'quarantined' && b.status !== 'destroyed');
    const bad = HD.tone(P, 'blocked');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {root.status === 'recalled' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: P.r10, border: `1px solid ${bad.fg}66`, background: bad.bg, padding: '10px 12px' }}>
            <Icon name="shield" size={16} stroke={2} color={bad.fg} />
            <div>
              <div style={{ fontSize: 12, color: bad.fg, fontWeight: 500 }}>Parent package recalled — {descendants.length} descendant{descendants.length === 1 ? '' : 's'} affected</div>
              <div style={{ fontSize: 11, color: P.inkMute, marginTop: 2 }}>Total units across tree: {nodes.reduce((s, b) => s + b.qty, 0).toLocaleString()}</div>
            </div>
          </div>)}
        <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.canvas, padding: 12, overflowX: 'auto' }}>
          <LineageNode node={tree} depth={0} isLast isRoot />
        </div>
        {root.status === 'recalled' && activeDescendants.length > 0 && (
          <PBtn variant="danger" full icon="flag" onClick={() => window.hdToast?.({ title: `${activeDescendants.length} descendants quarantined`, description: 'Chain-of-custody audit log updated.', tone: 'blocked' })}>
            Quarantine all {activeDescendants.length} active descendants
          </PBtn>)}
        <div style={{ fontSize: 11, color: P.inkMute, paddingTop: 8, borderTop: `1px solid ${P.hairline2}` }}>
          Lineage resolved from METRC parent/child refs · {nodes.length} node{nodes.length === 1 ? '' : 's'} total
        </div>
      </div>);
  };

  // ── Holds ───────────────────────────────────────────────────────────────
  const HOLD_TABS = [
    { id: 'quarantined', label: 'Quarantined', empty: 'Nothing on quarantine hold.' },
    { id: 'recalled', label: 'Recalled', empty: 'No active recalls.' },
    { id: 'destroyed', label: 'Destroyed', empty: 'No destruction records to show.' },
  ];

  function HoldRow({ b, canReturn, onLineage }) {
    const P = useP(), HD = window.HD;
    const hasLineage = !!b.parentMetrcPackageId || (b.childMetrcPackageIds?.length ?? 0) > 0;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) 1fr 1fr 1fr 1fr', borderBottom: `1px solid ${P.hairline}` }}
        onMouseEnter={(e) => (e.currentTarget.style.background = P.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <div style={{ padding: '12px' }}>
          <div style={{ fontSize: 13, color: P.ink }}>{b.productName}</div>
          <div style={{ fontFamily: P.fontMono, fontSize: 11, color: P.inkMute, marginTop: 2 }}>{b.metrcPackageId.slice(0, 12)}…{b.metrcPackageId.slice(-4)}</div>
          {hasLineage && <button onClick={() => onLineage(b)} style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, fontSize: 11, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>View package lineage</button>}
        </div>
        <div style={{ padding: 12 }}><HDPill tone="info" icon={false} size="sm" label={b.entity.toUpperCase()} /></div>
        <div style={{ padding: 12, fontSize: 12, color: P.ink2 }}>{b.notes ?? <span style={{ color: P.inkMute, fontStyle: 'italic' }}>no reason logged</span>}</div>
        <div style={{ padding: 12, fontSize: 12, color: P.inkMute }}>{HD.ageInStatus(b.statusEnteredAt)}</div>
        <div style={{ padding: 12, textAlign: 'right' }}>
          <div style={{ fontFamily: P.fontMono, fontSize: 13, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{HD.formatCurrency(b.qty * b.unitValue, { showCents: false })}</div>
          {canReturn && (
            <div style={{ marginTop: 6 }}>
              <PBtn size="xs" variant="secondary" onClick={() => window.hdToast?.({ title: 'Returned to inventory', description: b.productName, tone: 'ok', action: { label: 'View inventory', onClick: () => { location.hash = '#/inventory'; } } })}>Return to inventory</PBtn>
            </div>)}
        </div>
      </div>);
  }

  window.ScreenHolds = function ScreenHolds({ navigate }) {
    const P = useP();
    const [tab, setTab] = React.useState('quarantined');
    const [lineage, setLineage] = React.useState(null);
    const current = HOLD_TABS.find((t) => t.id === tab);
    const rows = window.HD_DATA.BATCHES.filter((b) => b.status === tab);
    const canReturn = tab === 'quarantined';
    const head = { padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute };
    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
              <Icon name="shield" size={12} stroke={2} />Compliance
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>Holds</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkDim }}>Quarantined, recalled, and destroyed batches. Audit-ready; export from each tab.</p>
          </div>
          <button onClick={() => navigate('#/inventory')} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: P.inkMute, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>← Inventory</button>
        </div>

        <div>
          <Tabs value={tab} onChange={setTab} options={HOLD_TABS.map((t) => ({ value: t.id, label: t.label, count: window.HD_DATA.BATCHES.filter((b) => b.status === t.id).length }))} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: P.inkMute }}>{rows.length} batch{rows.length === 1 ? '' : 'es'} on {current.label.toLowerCase()} hold</div>
              <PBtn size="sm" variant="secondary" icon="download" onClick={() => window.hdToast?.({ title: `${current.label} ledger exported`, description: `${rows.length} rows queued as audit_export_${tab}_${Date.now()}.csv`, tone: 'ok' })}>Export for audit</PBtn>
            </div>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) 1fr 1fr 1fr 1fr', background: P.canvas, borderBottom: `1px solid ${P.hairline2}` }}>
                <div style={head}>Product / UID</div><div style={head}>Entity</div><div style={head}>Reason</div><div style={head}>Age on hold</div><div style={{ ...head, textAlign: 'right' }}>Value</div>
              </div>
              {rows.length === 0
                ? <div style={{ padding: '40px 16px', textAlign: 'center', color: P.inkMute, fontSize: 13 }}>{current.empty}</div>
                : rows.map((b) => <HoldRow key={b.id} b={b} canReturn={canReturn} onLineage={setLineage} />)}
            </Card>
          </div>
        </div>

        <Sheet open={!!lineage} onClose={() => setLineage(null)} width={520}>
          {lineage && (
            <React.Fragment>
              <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <MicroLabel>Package lineage</MicroLabel>
                  <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 600, color: P.ink }}>{lineage.productName}</h2>
                </div>
                <IconBtn icon="x" size={16} onClick={() => setLineage(null)} style={{ width: 30, height: 30, margin: -4 }} />
              </div>
              <div style={{ padding: 20, overflow: 'auto' }}><LineageTree batch={lineage} /></div>
            </React.Fragment>)}
        </Sheet>
      </div>);
  };
})();
