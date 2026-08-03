// ── /integrations(+[id]) · /audit · /health · /settings(+cost, flags) · /onboarding ──
;(function () {
  const useP = window.useP;
  const STATUS_META = { connected: ['Active', 'ok'], migrating: ['Mapping', 'info'], pending: ['Probing', 'info'], error: ['Error', 'blocked'], revoked: ['Revoked', 'neutral'] };
  const HEALTH_META = { ok: ['Healthy', 'ok'], degraded: ['Degraded', 'warn'], warn: ['Needs review', 'warn'], idle: ['Idle', 'neutral'], failing: ['Failing', 'blocked'] };

  window.ScreenIntegrations = function ScreenIntegrations({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Integrations</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
              POS connectors and channel providers that feed the customer + order graph. Auto-discovery probes the vendor's API, infers the field mapping, and flags rows needing operator review before going live. Sync health rolls up from per-resource circuit breakers.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="settings" disabled>Configure</PBtn>
            <PBtn size="sm" variant="accent" icon="plus">Add integrator</PBtn>
          </div>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Integrator</TH><TH>Status</TH><TH>Sync health</TH><TH>Direction</TH><TH align="right">Rows · 24h</TH><TH>Last sync</TH><TH width={40}></TH></tr></thead>
              <tbody>
                {D.INTEGRATIONS.map((r) => {
                  const [sLabel, sTone] = STATUS_META[r.status] || [r.status, 'neutral'];
                  const [hLabel, hTone] = HEALTH_META[r.health] || [r.health, 'neutral'];
                  return (
                    <TR key={r.id} onClick={() => navigate(`#/integrations/${r.id}`)}>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ height: 30, width: 30, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }}>{r.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <div style={{ fontWeight: 500, color: P.ink }}>{r.name}</div>
                            <div style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>api.{r.slug}.com · {r.kind}</div>
                          </div>
                        </div>
                      </TD>
                      <TD><HDPill tone={sTone} icon={false} size="sm" label={sLabel} /></TD>
                      <TD><HDPill tone={hTone} icon={false} size="sm" label={hLabel} /></TD>
                      <TD style={{ fontSize: 12, color: P.inkDim }}>{r.direction}</TD>
                      <TD align="right" mono>{r.rows24h ? HD.formatNumber(r.rows24h) : '—'}</TD>
                      <TD style={{ fontSize: 11, color: P.inkMute }}>{r.lastSyncAt ? HD.relativeTime(r.lastSyncAt) : '—'}</TD>
                      <TD align="right"><Icon name="chevron-right" size={14} stroke={2} color={P.inkMute} /></TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Card padding={16} style={{ border: `1px solid ${HD.tone(P, 'warn').fg}55`, background: HD.tone(P, 'warn').bg }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="alert" size={16} stroke={2} color={HD.tone(P, 'warn').fg} />
            <div>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.ink }}>Alpine IQ migration in progress</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: P.ink2, lineHeight: 1.5 }}>
                Loyalty tiers still read from Alpine IQ while the ledger backfills. Once the wallet counts reconcile, flip <code style={{ fontFamily: P.fontMono }}>loyalty.source_of_truth</code> to Engage and the AIQ connector goes read-only.
              </p>
            </div>
          </div>
        </Card>
      </div>);
  };

  window.ScreenIntegrationDetail = function ScreenIntegrationDetail({ path, navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const id = path.split('/')[2];
    const r = D.INTEGRATIONS.find((x) => x.id === id) || D.INTEGRATIONS[0];
    const [sLabel, sTone] = STATUS_META[r.status] || [r.status, 'neutral'];
    const resources = [
      { name: 'customers', mapped: 14, total: 14, lastRun: D.ago(4), rows: Math.round(r.rows24h * 0.4), breaker: 'closed' },
      { name: 'orders', mapped: 22, total: 24, lastRun: D.ago(6), rows: Math.round(r.rows24h * 0.5), breaker: 'closed' },
      { name: 'products', mapped: 11, total: 16, lastRun: D.ago(64), rows: Math.round(r.rows24h * 0.08), breaker: r.health === 'degraded' ? 'half-open' : 'closed' },
      { name: 'loyalty', mapped: 6, total: 9, lastRun: D.ago(180), rows: Math.round(r.rows24h * 0.02), breaker: 'open' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <button onClick={() => navigate('#/integrations')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Integrations
            </button>
            <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{r.name}</h1>
            <p style={{ margin: '4px 0 0', fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>api.{r.slug}.com · {r.kind} · {r.direction}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HDPill tone={sTone} icon={false} size="sm" label={sLabel} />
            <PBtn size="sm" variant="secondary" icon="refresh" onClick={() => window.hdToast?.({ title: 'Re-probe queued', description: 'Field mapping will be re-inferred in ~2 min.', tone: 'info' })}>Re-probe</PBtn>
            <PBtn size="sm" variant="ghost" icon="ban">Revoke</PBtn>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile hue="teal" icon="database" label="Rows · 24h" value={HD.formatNumber(r.rows24h)} sub={r.lastSyncAt ? `last sync ${HD.relativeTime(r.lastSyncAt)}` : 'never synced'} />
          <StatTile hue="green" icon="check-circle" label="Mapping confidence" value="92%" sub="53 of 63 fields resolved" />
          <StatTile hue="blue" icon="zap" label="Sync interval" value="5 min" sub="webhook preferred, poll fallback" />
          <StatTile hue="violet" icon="activity" label="Consecutive failures" value={r.health === 'ok' ? '0' : '3'} sub="breaker trips at 5" />
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Resources</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: P.inkMute }}>Each resource has its own circuit breaker — one bad endpoint can't stall the rest.</p>
          </header>
          <HDTable>
            <thead><tr><TH>Resource</TH><TH>Field mapping</TH><TH align="right">Rows · 24h</TH><TH>Last run</TH><TH>Breaker</TH></tr></thead>
            <tbody>
              {resources.map((res) => (
                <TR key={res.name}>
                  <TD mono style={{ fontSize: 12 }}>{res.name}</TD>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 90, height: 5, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(res.mapped / res.total) * 100}%`, background: res.mapped === res.total ? HD.tone(P, 'ok').fg : HD.tone(P, 'warn').fg }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: P.fontMono, color: P.inkMute }}>{res.mapped}/{res.total}</span>
                    </div>
                  </TD>
                  <TD align="right" mono>{HD.formatNumber(res.rows)}</TD>
                  <TD style={{ fontSize: 11, color: P.inkMute }}>{HD.relativeTime(res.lastRun)}</TD>
                  <TD><HDPill tone={res.breaker === 'closed' ? 'ok' : res.breaker === 'half-open' ? 'warn' : 'blocked'} icon={false} size="sm" label={res.breaker} /></TD>
                </TR>))}
            </tbody>
          </HDTable>
        </Card>
      </div>);
  };

  // ── Audit log ───────────────────────────────────────────────────────────
  const PREFIXES = [['', 'All'], ['identity.', 'Identity'], ['compliance.', 'Compliance'], ['commerce.', 'Commerce'], ['loyalty.', 'Loyalty'], ['referral.', 'Referrals'], ['audience.', 'Segmentation'], ['campaign.', 'Campaigns'], ['flow.', 'Flows']];
  const ACTORS = [['', 'Any actor'], ['user', 'Operator'], ['system', 'System']];

  function auditTone(t) {
    if (t.startsWith('identity.consent.granted')) return 'ok';
    if (t.startsWith('identity.consent.revoked')) return 'warn';
    if (t.startsWith('identity.pii.')) return 'info';
    if (t.startsWith('compliance.')) return 'blocked';
    if (t.startsWith('commerce.')) return 'ok';
    if (t.startsWith('loyalty.points.credited') || t.startsWith('loyalty.tier.entered')) return 'ok';
    if (t.startsWith('campaign.message.failed') || t.startsWith('referral.fraud_flagged')) return 'blocked';
    if (t.startsWith('campaign.message.delivered') || t.startsWith('referral.completed')) return 'ok';
    return 'neutral';
  }

  window.ScreenAudit = function ScreenAudit({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [prefix, setPrefix] = React.useState('');
    const [actor, setActor] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [page, setPage] = React.useState(1);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const PAGE = 14;
    const rows = D.AUDIT.filter((e) => {
      if (prefix && !e.eventType.startsWith(prefix)) return false;
      if (actor === 'user' && e.actor.startsWith('system:')) return false;
      if (actor === 'system' && !e.actor.startsWith('system:')) return false;
      if (subject.trim() && !e.customerId.includes(subject.trim()) && !e.customerName.toLowerCase().includes(subject.trim().toLowerCase())) return false;
      return true;
    });
    React.useEffect(() => setPage(1), [prefix, actor, subject]);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
    const visible = rows.slice((page - 1) * PAGE, page * PAGE);
    const Pill = ({ label, active, onClick }) => (
      <button onClick={onClick} style={{ borderRadius: 99, padding: '2px 9px', fontSize: 11, cursor: 'pointer', fontFamily: P.fontSans,
        background: active ? P.accentSoft : P.surface, color: active ? accentInk : P.inkMute, border: `1px solid ${active ? P.accentBorder : P.hairline2}` }}>{label}</button>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Audit log</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
              Tenant-wide firehose of every domain event. Same data the per-entity activity feeds read from, just unfiltered — useful when you want the cross-cutting “what happened today” view.
            </p>
          </div>
          <HDPill tone="neutral" icon={false} label={`${HD.formatNumber(D.AUDIT.length * 214)} total events`} />
        </div>

        <Card padding={12}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}><Field icon="search" size="sm" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Search by subject id or customer name…" /></div>
            <PBtn size="sm" variant="secondary" icon="download" onClick={() => window.hdToast?.({ title: 'Export queued', description: `${rows.length} events · CSV emailed to you.`, tone: 'info' })}>Export CSV</PBtn>
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${P.hairline2}` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}><Icon name="filter" size={11} stroke={2} />Type</span>
            {PREFIXES.map(([v, l]) => <Pill key={l} label={l} active={prefix === v} onClick={() => setPrefix(v)} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}><Icon name="shield" size={11} stroke={2} />Actor</span>
            {ACTORS.map(([v, l]) => <Pill key={l} label={l} active={actor === v} onClick={() => setActor(v)} />)}
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          {visible.length === 0
            ? <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: P.inkMute }}>No events match those filters.</div>
            : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {visible.map((e) => (
                <li key={e.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,auto) minmax(0,1fr) auto auto', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
                  <HDPill tone={auditTone(e.eventType)} icon={false} size="sm" label={e.eventType} />
                  <button onClick={() => navigate(`#/customers/${e.customerId}`)} style={{ minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12, color: P.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: P.fontMono }}>{e.customerId.slice(0, 8)}…</span> · {e.customerName}
                  </button>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: P.inkMute, fontSize: 11 }}>
                    <Icon name={e.actor.startsWith('system:') ? 'workflow' : 'user' } size={11} stroke={2} />
                    <span style={{ fontFamily: P.fontMono }}>{e.actor.startsWith('system:') ? e.actor.replace('system:', '') : e.actor.split('@')[0]}</span>
                  </span>
                  <span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute, whiteSpace: 'nowrap' }}>{HD.relativeTime(e.at)}</span>
                </li>))}
            </ul>}
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: P.inkMute }}>
          <span>Page {page} of {totalPages} · {rows.length} matching</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <PBtn size="xs" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</PBtn>
              <PBtn size="xs" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</PBtn>
            </div>)}
        </div>
      </div>);
  };

  // ── System health ───────────────────────────────────────────────────────
  const CHECKS = [
    { section: 'Messaging providers', items: [
      { label: 'Twilio SMS/MMS', value: '99.98% · 210ms p50', tone: 'ok', detail: 'Messaging Service MG…d2e9' },
      { label: 'SendGrid email', value: '99.94% · 412ms p50', tone: 'ok', detail: 'Webhook signature verified' },
      { label: 'Web Push', value: '99.6% · 180ms p50', tone: 'ok' },
      { label: 'APNs (wallet silent)', value: 'queue: 0', tone: 'ok' },
      { label: 'FCM (Android push)', value: 'not wired', tone: 'warn', detail: 'Deferred to next sprint' },
    ] },
    { section: 'Data pipeline', items: [
      { label: 'Postgres primary', value: 'connections: 14/100', tone: 'ok' },
      { label: 'pgvector ivfflat', value: '3 indexes healthy', tone: 'ok' },
      { label: 'Event bus (pg_notify)', value: '47 events/min', tone: 'ok' },
      { label: 'Trait refresher', value: 'debounce 10s · last 2m ago', tone: 'ok' },
    ] },
    { section: 'Predictive models', items: [
      { label: 'churn_30d', value: 'AUC 0.812 · rescored 12 min ago', tone: 'ok', detail: 'XGBoost · v3f8a' },
      { label: 'ltv_90d', value: 'MAE $42.80 · rescored 12 min ago', tone: 'ok', detail: 'BG/NBD + Gamma-Gamma · v1c2d' },
      { label: 'propensity_*', value: '5/7 categories trained', tone: 'warn', detail: 'concentrates + topicals pending' },
    ] },
    { section: 'Compliance', items: [
      { label: 'Consent hash-chain', value: 'tip verified · 142,018 rows', tone: 'ok' },
      { label: 'WORM replication', value: 'lag 0 · S3 object-lock compliance', tone: 'ok' },
      { label: 'Suppression list', value: '8,412 entries', tone: 'ok' },
      { label: 'Active policy config', value: 'v4 · 7 rules', tone: 'ok' },
    ] },
  ];

  window.ScreenHealth = function ScreenHealth() {
    const P = useP();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>System health</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
            Everything Engage relies on, in one place. Run a full check before launching a high-priority campaign.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
          {CHECKS.map((section) => (
            <Card key={section.section} padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>{section.section}</h2>
              </div>
              <div>
                {section.items.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HDPill tone={item.tone} size="sm" label={item.tone === 'ok' ? 'ok' : item.tone} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: P.ink }}>{item.label}</span>
                      </div>
                      {item.detail && <div style={{ marginTop: 2, fontSize: 11, color: P.inkMute }}>{item.detail}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, textAlign: 'right', whiteSpace: 'nowrap' }}>{item.value}</span>
                  </div>))}
              </div>
            </Card>))}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: P.inkMute }}>Uptime windows are rolling 24h.</p>
      </div>);
  };

  // ── Settings ────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'brand', label: 'Brand', icon: 'shop', description: 'Logo, colors, sender names, display store name.', lines: ['Primary color — Hyperwolf gold', 'Display name — Green Leaf Collective', 'Wallet pass artwork — not uploaded'] },
    { id: 'compliance', label: 'Compliance', icon: 'shield', description: 'Consent, quiet hours, age gate, opt-out footer.', lines: ['Quiet hours — 21:00–09:00 (customer-local)', 'Age gate — 21+ enforced on /l/*', 'Opt-out footer — “Reply STOP to opt out.”'] },
    { id: 'integrations', label: 'Integrations', icon: 'plug', description: 'Twilio, SendGrid, Hyperdrive POS, Blaze POS (legacy).', lines: ['Twilio — Messaging Service MG…d2e9', 'SendGrid — API key ending …4f1c', 'Hyperdrive POS — connected'], href: '#/integrations' },
    { id: 'team', label: 'Team', icon: 'users', description: 'Operators, roles, SSO, API tokens.', lines: ['Members — 4 active', 'Roles — Admin, Marketer, Viewer', 'SSO — WorkOS (connected)'] },
    { id: 'cost', label: 'Cost controls', icon: 'dollar', description: 'Per-resource caps, alerts, and hard-stop behaviour.', lines: ['SMS cap — $2,000 / month', 'Alert at — 80% of cap', 'Hard cap — off (throttle instead)'], href: '#/settings/cost' },
    { id: 'flags', label: 'Feature flags', icon: 'sliders', description: 'Per-tenant toggles. Env overrides stomp tenant values so ops can kill anything instantly.', lines: ['Registry lives in @engage/core/feature-flags', 'Env override — ENGAGE_FLAG_<NAME>=1|0', 'Tenant overrides — tenant.settings.flags[name]'], href: '#/settings/flags' },
  ];

  window.ScreenSettings = function ScreenSettings({ navigate }) {
    const P = useP();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
            <span>Tenant</span><HDPill tone="neutral" size="sm" label="Green Leaf Collective" />
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Settings</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13, color: P.inkMute }}>Brand, compliance, integrations, team, and feature flags. Changes are scoped to this tenant unless noted.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {TABS.map((t) => (
            <Card key={t.id} padding={20}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ height: 34, width: 34, borderRadius: 9, background: P.surface3, color: accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <Icon name={t.icon} size={16} stroke={2} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>{t.label}</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: P.inkMute, lineHeight: 1.45 }}>{t.description}</p>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {t.lines.map((line) => (
                  <li key={line} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: P.inkDim }}>
                    <span style={{ height: 4, width: 4, borderRadius: 99, background: P.inkMute, flex: '0 0 auto' }} />{line}
                  </li>))}
              </ul>
              <div style={{ marginTop: 14 }}>
                {t.href
                  ? <PBtn size="sm" variant="secondary" onClick={() => navigate(t.href)}>Manage →</PBtn>
                  : <PBtn size="sm" variant="secondary" disabled>Coming soon</PBtn>}
              </div>
            </Card>))}
        </div>
      </div>);
  };

  // ── Cost controls ───────────────────────────────────────────────────────
  window.ScreenCost = function ScreenCost({ navigate }) {
    const P = useP(), HD = window.HD;
    const A = window.EngageAnalyticsData;
    const [caps, setCaps] = React.useState({ sms: 2000, email: 500, ai: 300 });
    const [hardCap, setHardCap] = React.useState(false);
    const [alertAt, setAlertAt] = React.useState(80);
    const spend = { sms: 1292.34, email: 214.34, ai: 84.6 };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <button onClick={() => navigate('#/settings')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Settings
          </button>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Cost controls</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
            Monthly caps per metered resource. Caps are soft by default — hitting one throttles the queue and raises an alert instead of dropping sends.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {[['sms', 'SMS · Twilio'], ['email', 'Email · SendGrid'], ['ai', 'AI generations']].map(([k, label]) => {
            const pct = spend[k] / caps[k];
            return (
              <Card key={k} padding={20}>
                <MicroLabel>{label}</MicroLabel>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 600, fontFamily: P.fontMono, color: P.ink }}>{HD.formatCurrency(spend[k])}</span>
                  <span style={{ fontSize: 12, color: P.inkMute }}>of {HD.formatCurrency(caps[k], { showCents: false })}</span>
                </div>
                <div style={{ marginTop: 10, height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pct * 100)}%`, background: pct > 0.8 ? HD.tone(P, 'blocked').fg : pct > 0.6 ? HD.tone(P, 'warn').fg : HD.tone(P, 'ok').fg }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <MicroLabel style={{ marginBottom: 6 }}>Monthly cap ($)</MicroLabel>
                  <Field type="number" step={50} value={caps[k]} onChange={(e) => setCaps({ ...caps, [k]: Number(e.target.value || 0) })} />
                </div>
              </Card>);
          })}
        </div>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Daily spend · 14 days</h2>
          </header>
          <div style={{ padding: 20 }}>
            <window.ELine labels={A.days} height={200} valueFormat={(v) => `$${Math.round(v)}`}
              series={[{ name: 'Total', data: A.days.map((_, i) => 980 + Math.sin(i / 2) * 130 + i * 9) }]} />
          </div>
        </Card>

        <Card padding={20}>
          <MicroLabel>Behaviour</MicroLabel>
          <label style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: P.ink2, cursor: 'pointer' }}>
            <Check on={hardCap} onChange={setHardCap} size={18} />
            <span>
              <span style={{ display: 'block', color: P.ink }}>Hard cap — fail closed at 100%</span>
              <span style={{ display: 'block', fontSize: 11, color: P.inkMute, marginTop: 2 }}>Off means the queue throttles and drains next month. On means sends are rejected outright once the cap is hit.</span>
            </span>
          </label>
          <div style={{ marginTop: 16, maxWidth: 220 }}>
            <MicroLabel style={{ marginBottom: 6 }}>Alert at (% of cap)</MicroLabel>
            <Field type="number" min={10} max={100} value={alertAt} onChange={(e) => setAlertAt(Number(e.target.value || 0))} />
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <PBtn size="sm" variant="accent" onClick={() => window.hdToast?.({ title: 'Cost controls saved', description: `Alerting at ${alertAt}% · hard cap ${hardCap ? 'on' : 'off'}.`, tone: 'ok' })}>Save changes</PBtn>
            <PBtn size="sm" variant="ghost" onClick={() => navigate('#/analytics/usage')}>View usage →</PBtn>
          </div>
        </Card>
      </div>);
  };

  // ── Feature flags (Engage registry) ─────────────────────────────────────
  const ENGAGE_FLAGS = [
    { key: 'pos_auto_discovery', category: 'Integrations', on: true, description: 'Probe a vendor API and infer the field mapping instead of hand-writing an adapter.' },
    { key: 'onboarding_wizard', category: 'Onboarding', on: true, description: 'Five-step guided setup for brand-new tenants.' },
    { key: 'ai_audience_builder', category: 'Segmentation', on: true, description: 'Plain-English prompt → validated DSL with live preview.' },
    { key: 'ai_audience_suggestions', category: 'Segmentation', on: true, description: 'Nightly clustering surfaces untagged behavioural cohorts.' },
    { key: 'lookalike_expansion', category: 'Segmentation', on: true, description: 'pgvector centroid expansion off a seed audience.' },
    { key: 'wallet_passes', category: 'Loyalty', on: true, description: 'Issue Apple + Google wallet passes and push silent updates.' },
    { key: 'interactive_games', category: 'Engage', on: true, description: 'Spin wheel, scratch card, quiz with server-committed draws.' },
    { key: 'referral_fraud_guard', category: 'Referrals', on: true, description: 'Hold attributions that trip device/payment/velocity heuristics.' },
    { key: 'quiet_hours_enforcement', category: 'Compliance', on: true, description: 'Hold sends into a customer-local quiet window rather than dropping them.' },
    { key: 'frequency_caps', category: 'Compliance', on: true, description: 'Cap messages per customer per rolling window.' },
    { key: 'warehouse_export', category: 'Data', on: true, description: 'Reverse-ETL rollups into Snowflake / BigQuery.' },
    { key: 'cost_hard_cap', category: 'Cost', on: false, description: 'Reject sends at 100% of the monthly cap instead of throttling.' },
    { key: 'llm_copy_assist', category: 'Templates', on: false, description: 'Draft SMS/email copy from a brief. Off until legal signs off on claims review.' },
    { key: 'kill_switch', category: 'Platform', on: false, description: 'Emergency freeze — Engage becomes read-only platform-wide.' },
  ];

  window.ScreenEngageFlags = function ScreenEngageFlags({ navigate }) {
    const P = useP(), HD = window.HD;
    const [flags, setFlags] = React.useState(ENGAGE_FLAGS);
    const [q, setQ] = React.useState('');
    const rows = flags.filter((f) => (f.key + f.description + f.category).toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <button onClick={() => navigate('#/settings')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Settings
            </button>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Feature flags</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
              Per-tenant toggles from <code style={{ fontFamily: P.fontMono }}>@engage/core/feature-flags</code>. An env override (<code style={{ fontFamily: P.fontMono }}>ENGAGE_FLAG_&lt;NAME&gt;</code>) stomps the tenant value so ops can kill anything instantly.
            </p>
          </div>
          <div style={{ width: 280 }}><Field icon="search" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flags" /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
          {rows.map((f) => (
            <Card key={f.key} padding={16}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <code style={{ fontFamily: P.fontMono, fontSize: 12, fontWeight: 600, color: P.ink }}>{f.key}</code>
                    <HDPill tone="neutral" icon={false} size="sm" label={f.category} />
                    {f.key === 'kill_switch' && <HDPill tone="blocked" icon={false} size="sm" label="danger" />}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: P.inkDim, lineHeight: 1.45 }}>{f.description}</p>
                </div>
                <button onClick={() => { setFlags((cur) => cur.map((x) => (x.key === f.key ? { ...x, on: !x.on } : x))); window.hdToast?.({ title: `${f.key} ${f.on ? 'disabled' : 'enabled'}`, description: 'Change written to the tenant flag snapshot + audit log.', tone: f.on ? 'warn' : 'ok' }); }}
                  role="switch" aria-checked={f.on} aria-label={`Toggle ${f.key}`}
                  style={{ flex: '0 0 auto', width: 40, height: 22, borderRadius: 99, border: `1px solid ${f.on ? P.accentBorder : P.hairline2}`, background: f.on ? P.accent : P.surface3, position: 'relative', cursor: 'pointer', padding: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: f.on ? 20 : 2, height: 16, width: 16, borderRadius: 99, background: f.on ? P.accentInk : P.inkMute, transition: 'left .15s' }} />
                </button>
              </div>
            </Card>))}
        </div>
      </div>);
  };

  // ── Onboarding ──────────────────────────────────────────────────────────
  window.ScreenOnboarding = function ScreenOnboarding({ navigate }) {
    const P = useP();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const STEPS = [
      { icon: 'plug', title: 'Plug in your keys', body: 'Twilio, SendGrid, and your POS adapter — validated as you paste.' },
      { icon: 'database', title: 'Sync your customer list', body: 'Auto-detected field mapping, no waiting on a manual import.' },
      { icon: 'sparkle', title: 'Build your first audience', body: 'Describe it in plain English; we translate and preview live.' },
      { icon: 'layout-template', title: 'Pick a template', body: 'Pre-built welcome, win-back, and birthday flows you can launch now.' },
      { icon: 'send', title: 'Send a test', body: 'Runs the full 7-rule policy chain so you see exactly what a customer would.' },
    ];
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: `linear-gradient(180deg, ${P.bg} 0%, ${P.accentSoft} 55%, ${P.bg} 100%)` }}>
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, padding: '5px 12px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: accentInk }}>
            <Icon name="sparkle" size={11} stroke={2} />Five steps · about 10 minutes
          </span>
          <h1 style={{ margin: '18px 0 0', fontSize: 40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.03em', color: P.ink, lineHeight: 1.05 }}>Let's get you sending</h1>
          <p style={{ margin: '12px 0 0', fontSize: 14, color: P.inkMute, lineHeight: 1.6 }}>
            We'll plug in your keys, sync your customer list, build your first audience, pick a template, and send a test — end to end — so you leave this page with a live campaign.
          </p>
          <div style={{ margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
            {STEPS.map((s, i) => (
              <div key={s.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface, padding: '10px 14px' }}>
                <span style={{ height: 28, width: 28, borderRadius: 8, background: P.surface3, color: accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <Icon name={s.icon} size={14} stroke={2} />
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: P.ink }}>{i + 1}. {s.title}</div>
                  <div style={{ fontSize: 11, color: P.inkMute, marginTop: 2 }}>{s.body}</div>
                </div>
              </div>))}
          </div>
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <PBtn size="sm" variant="ghost" onClick={() => navigate('#/')}>Skip for now</PBtn>
            <PBtn variant="accent" icon="compass" onClick={() => window.hdToast?.({ title: 'Setup started', description: 'Step 1 of 5 — provider credentials.', tone: 'info' })}>Start setup →</PBtn>
          </div>
        </div>
      </div>);
  };
})();
