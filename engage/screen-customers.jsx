// ── /customers + /customers/[id] ──────────────────────────────────────────
// Ports customers/page.tsx (+ search bar, add dialog, export) and
// customers/[id]/page.tsx (PII reveal, unified balance, predictive, consents).
;(function () {
  const useP = window.useP;
  const PAGE_SIZE = 12;

  const SegBadge = ({ seg }) => {
    const D = window.ENGAGE_DATA;
    return <HDPill tone={D.RFM_TONE[seg] || 'neutral'} icon={false} size="sm" label={seg.replace(/_/g, ' ')} />;
  };

  function AddCustomerDialog({ open, onClose }) {
    const P = useP();
    const [form, setForm] = React.useState({ first: '', last: '', email: '', phone: '', consent: true });
    if (!open) return null;
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
        <Card padding={0} style={{ position: 'relative', width: 460, maxWidth: '92vw' }}>
          <div style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: P.ink }}>Add customer</h2>
            <p style={{ margin: '6px 0 16px', fontSize: 12, color: P.inkMute }}>Identity columns are AES-GCM encrypted on write. A consent event is recorded with source <code style={{ fontFamily: P.fontMono }}>console.manual</code>.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><MicroLabel style={{ marginBottom: 6 }}>First name</MicroLabel><Field value={form.first} onChange={set('first')} placeholder="Jordan" /></div>
              <div><MicroLabel style={{ marginBottom: 6 }}>Last name</MicroLabel><Field value={form.last} onChange={set('last')} placeholder="Alvarez" /></div>
            </div>
            <div style={{ marginTop: 10 }}><MicroLabel style={{ marginBottom: 6 }}>Email</MicroLabel><Field value={form.email} onChange={set('email')} placeholder="jordan@example.com" /></div>
            <div style={{ marginTop: 10 }}><MicroLabel style={{ marginBottom: 6 }}>Mobile</MicroLabel><Field value={form.phone} onChange={set('phone')} placeholder="+1 310 555 0142" /></div>
            <label style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: P.ink2, cursor: 'pointer' }}>
              <Check on={form.consent} onChange={(v) => setForm({ ...form, consent: v })} size={18} />Record SMS + email consent (express written)
            </label>
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <PBtn variant="ghost" onClick={onClose}>Cancel</PBtn>
            <PBtn variant="accent" icon="user-plus" onClick={() => { onClose(); window.hdToast?.({ title: 'Customer created', description: `${form.first || 'Unnamed'} ${form.last} added to the identity graph.`, tone: 'ok' }); }}>Add customer</PBtn>
          </div>
        </Card>
      </div>);
  }

  window.ScreenCustomers = function ScreenCustomers({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [query, setQuery] = React.useState('');
    const [segment, setSegment] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [addOpen, setAddOpen] = React.useState(false);

    const filtered = React.useMemo(() => D.CUSTOMERS.filter((c) => {
      if (segment && c.rfmSegment !== segment) return false;
      if (query.trim() && !c.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    }), [query, segment]);
    React.useEffect(() => setPage(1), [query, segment]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Customers</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
              Full identity graph — phones + emails + wallet tokens + POS ids all resolved to a single customer row. Identity columns are AES-GCM encrypted at rest; the list view shows the operator-safe derivatives only.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="download" onClick={() => window.hdToast?.({ title: 'Export queued', description: `${filtered.length} rows · redacted CSV emailed to you.`, tone: 'info' })}>Export</PBtn>
            <PBtn size="sm" variant="accent" icon="user-plus" onClick={() => setAddOpen(true)}>Add customer</PBtn>
          </div>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ borderBottom: `1px solid ${P.hairline2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
              <div style={{ flex: 1 }}><Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by first or last name…" /></div>
              {(query || segment) && <button onClick={() => { setQuery(''); setSegment(''); }} style={{ fontSize: 12, color: P.inkMute, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, fontFamily: P.fontSans }}>Clear</button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}><Icon name="filter" size={11} stroke={2} />RFM</span>
              {[{ value: '', label: 'All' }, ...D.RFM_SEGMENTS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))].map((o) => (
                <button key={o.value} onClick={() => setSegment(o.value)} role="radio" aria-checked={segment === o.value}
                  style={{ height: 26, padding: '0 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontFamily: P.fontSans,
                    background: segment === o.value ? P.accentSoft : P.surface, color: segment === o.value ? accentInk : P.inkDim, border: `1px solid ${segment === o.value ? P.accentBorder : P.hairline2}` }}>{o.label}</button>))}
            </div>
          </div>
          {rows.length === 0
            ? <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: P.inkMute }}>No customers match those filters.</div>
            : <div style={{ overflowX: 'auto' }}>
              <HDTable>
                <thead><tr>
                  <TH>Customer</TH><TH>Tier</TH><TH>RFM</TH><TH align="right">Lifetime</TH><TH align="right">Orders</TH>
                  <TH align="right">Recency</TH><TH align="right">Points</TH><TH>Consent</TH>
                </tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <TR key={c.id} onClick={() => navigate(`#/customers/${c.id}`)}>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ height: 28, width: 28, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }}>{c.initials}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 500, color: P.ink }}>{c.name}</div>
                            <div style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{c.id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </TD>
                      <TD><HDPill tone="neutral" icon={false} size="sm" label={c.tierName} /></TD>
                      <TD><SegBadge seg={c.rfmSegment} /></TD>
                      <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(c.lifetimeSpentCents)}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatNumber(c.lifetimeOrders)}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{c.recencyDays}d ago</TD>
                      <TD align="right" mono>{HD.formatNumber(c.pointsBalance)}</TD>
                      <TD>{c.hasConsent ? <HDPill tone="ok" icon={false} size="sm" label="opted in" /> : <HDPill tone="neutral" icon={false} size="sm" label="none" />}</TD>
                    </TR>))}
                </tbody>
              </HDTable>
            </div>}
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: P.inkMute }}>
          <span>{HD.formatNumber(filtered.length)} total{query || segment ? ' · filters active' : ''}</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PBtn size="xs" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</PBtn>
              <span style={{ fontFamily: P.fontMono }}>Page {page} of {totalPages}</span>
              <PBtn size="xs" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next →</PBtn>
            </div>)}
        </div>

        <AddCustomerDialog open={addOpen} onClose={() => setAddOpen(false)} />
      </div>);
  };

  // ── Detail ──────────────────────────────────────────────────────────────
  function Stat({ label, value, icon }) {
    const P = useP();
    return (
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
          <Icon name={icon} size={11} stroke={2} />{label}
        </div>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      </Card>);
  }

  function ScoreTile({ label, value, hint, inverse }) {
    const P = useP(), HD = window.HD;
    const pct = Math.round(value * 100);
    const high = value > 0.5;
    const color = inverse ? (high ? HD.tone(P, 'blocked').fg : HD.tone(P, 'ok').fg) : (high ? HD.tone(P, 'ok').fg : P.inkMute);
    return (
      <div style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 600, color, fontFamily: P.fontMono }}>{pct}%</span>
          <Icon name={inverse ? (high ? 'arrow-down' : 'check-circle') : (high ? 'trending-up' : 'arrow-down')} size={12} stroke={2} color={color} />
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 10, color: P.inkMute }}>{hint}</p>
      </div>);
  }

  function PiiReveal({ customer }) {
    const P = useP(), HD = window.HD;
    const [revealed, setRevealed] = React.useState(false);
    const info = HD.tone(P, 'info');
    const email = `${customer.name.split(' ')[0].toLowerCase()}.${customer.name.split(' ')[1].toLowerCase()}@example.com`;
    return (
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
            <Icon name="lock" size={11} stroke={2} />Encrypted identity
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: P.fontMono, color: P.ink2 }}>
            <Icon name="mail" size={13} stroke={2} color={P.inkMute} />{revealed ? email : '••••••••••@•••••.com'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: P.fontMono, color: P.ink2 }}>
            <Icon name="phone" size={13} stroke={2} color={P.inkMute} />{revealed ? '+1 (310) 555-0142' : '+1 (•••) •••-••••'}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {revealed && <span style={{ fontSize: 11, color: info.fg, background: info.bg, borderRadius: 99, padding: '3px 8px' }}>reveal logged to audit</span>}
            <PBtn size="sm" variant={revealed ? 'ghost' : 'secondary'} icon={revealed ? 'eye-off' : 'eye'}
              onClick={() => { setRevealed((v) => !v); if (!revealed) window.hdToast?.({ title: 'PII revealed', description: 'identity.pii.revealed written to the audit log.', tone: 'info' }); }}>
              {revealed ? 'Hide' : 'Reveal (audited)'}
            </PBtn>
          </div>
        </div>
      </Card>);
  }

  const EVENT_LABEL = {
    'identity.consent.granted': ['Consent granted', 'ok'], 'identity.consent.revoked': ['Consent revoked', 'warn'],
    'identity.pii.revealed': ['PII revealed', 'info'], 'compliance.suppression.added': ['Suppression added', 'blocked'],
    'commerce.order.completed': ['Order completed', 'ok'], 'loyalty.points.credited': ['Points credited', 'ok'],
    'loyalty.tier.entered': ['Tier entered', 'ok'], 'loyalty.reward.redeemed': ['Reward redeemed', 'info'],
    'campaign.message.sent': ['Message sent', 'info'], 'campaign.message.delivered': ['Message delivered', 'ok'],
    'campaign.message.clicked': ['Message clicked', 'ok'], 'campaign.message.failed': ['Message failed', 'blocked'],
    'referral.attributed': ['Referral attributed', 'info'], 'referral.completed': ['Referral completed', 'ok'],
    'referral.fraud_flagged': ['Referral fraud flagged', 'blocked'], 'audience.refreshed': ['Audience refreshed', 'neutral'],
    'flow.version.published': ['Flow version published', 'neutral'],
  };

  window.ScreenCustomerDetail = function ScreenCustomerDetail({ path, navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const id = path.split('/')[2];
    const c = D.CUSTOMERS.find((x) => x.id === id) || D.CUSTOMERS.find((x) => x.id.startsWith(id));
    if (!c) return <div style={{ padding: 24 }}><HDEmpty icon="users" title="Customer not found" body="This id isn't in the current tenant." /></div>;

    const audiences = D.AUDIENCES.slice(0, 4).map((a, i) => ({ audienceId: a.id, audienceName: a.name, audienceSource: a.source === 'ai' ? 'AI builder' : 'rule-based', joinedAt: D.agoDays(i * 3 + 1) }));
    const consents = [
      { id: 'c1', action: 'granted', channel: 'sms', purpose: 'marketing', source: 'pos.checkout', occurredAt: D.agoDays(120) },
      { id: 'c2', action: 'granted', channel: 'email', purpose: 'marketing', source: 'web.landing', occurredAt: D.agoDays(118) },
      { id: 'c3', action: 'updated', channel: 'push', purpose: 'transactional', source: 'app.settings', occurredAt: D.agoDays(30) },
    ];
    const messages = D.MESSAGES.slice(0, 5);
    const events = D.AUDIT.slice(0, 8);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('#/customers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Customers
            </button>
            <span style={{ height: 48, width: 48, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>{c.initials}</span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{c.name}</h1>
              <p style={{ margin: '2px 0 0', fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>{c.id}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <HDPill tone="neutral" icon={false} size="sm" label={c.tierName} />
            <SegBadge seg={c.rfmSegment} />
            {c.ageVerifiedAt ? <HDPill tone="ok" icon={false} size="sm" label="age verified" /> : <HDPill tone="warn" icon={false} size="sm" label="unverified" />}
          </div>
        </header>

        <PiiReveal customer={c} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Stat label="Lifetime spend" value={HD.formatCents(c.lifetimeSpentCents)} icon="trending-up" />
          <Stat label="Lifetime orders" value={HD.formatNumber(c.lifetimeOrders)} icon="calendar" />
          <Stat label="Recency" value={`${c.recencyDays}d`} icon="clock" />
          <Stat label="Points balance" value={HD.formatNumber(c.pointsBalance)} icon="coins" />
        </div>

        <Card padding={20} style={{ border: `1px solid ${P.accentBorder}`, background: P.accentSoft }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
            <Icon name="sparkle" size={11} stroke={2} color={P.mode === 'dark' ? P.accent : P.accentBorder} />
            Unified loyalty balance
            <span style={{ marginLeft: 6, borderRadius: 99, background: P.surface, padding: '2px 7px', fontSize: 9, fontWeight: 700, color: P.mode === 'dark' ? P.accent : P.accentBorder }}>across all stores</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{HD.formatNumber(c.pointsBalance)}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: P.inkMute }}>
              Green Leaf Rewards · <span style={{ color: HD.tone(P, 'ok').fg }}>+{HD.formatNumber(c.lifetimeEarned)} earned</span> · −{HD.formatNumber(c.lifetimeSpent)} spent (lifetime)
            </div>
          </div>
          <MicroLabel style={{ marginTop: 16 }}>By store · last 90 days</MicroLabel>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['green-leaf-wh', 620, 14], ['green-leaf-le', 240, 6], ['green-leaf-cor', -180, 3], ['unattributed', 40, 1]].map(([slug, net, entries]) => (
              <li key={slug} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface, padding: '8px 12px', fontSize: 12 }}>
                <span style={{ fontFamily: P.fontMono, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{slug === 'unattributed' ? 'Pre-iter-104 (no store tag)' : slug}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: P.fontMono, fontWeight: 600, color: net > 0 ? HD.tone(P, 'ok').fg : P.inkMute }}>{net > 0 ? '+' : ''}{HD.formatNumber(net)}</span>
                  <span style={{ color: P.inkMute }}>{entries} {entries === 1 ? 'entry' : 'entries'}</span>
                </span>
              </li>))}
          </ul>
        </Card>

        <Card padding={20}>
          <MicroLabel>Predictive scores</MicroLabel>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <ScoreTile label="Churn risk · 30d" value={c.churnRisk30d} hint="probability customer churns in next 30 days" inverse />
            <ScoreTile label="Win-back probability" value={c.winBackProbability} hint="response likelihood to a winback campaign" />
            <div style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Predicted LTV · 90d</div>
              <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{HD.formatCents(c.predictedLtv90dCents)}</div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={14} stroke={2} color={P.inkMute} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Audience memberships</h2>
              <HDPill tone="neutral" icon={false} size="sm" label={String(audiences.length)} />
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {audiences.map((a) => (
                <li key={a.audienceId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
                  <button onClick={() => navigate(`#/audiences/${a.audienceId}`)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans }}>
                    <p style={{ margin: 0, fontWeight: 500, color: P.ink }}>{a.audienceName}</p>
                    <p style={{ margin: 0, fontSize: 10, color: P.inkMute }}>{a.audienceSource}</p>
                  </button>
                  <span style={{ fontSize: 10, color: P.inkMute }}>joined {HD.formatDateTime(a.joinedAt)}</span>
                </li>))}
            </ul>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={14} stroke={2} color={P.inkMute} />
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Consent log</h2>
              <HDPill tone="neutral" icon={false} size="sm" label={String(consents.length)} />
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {consents.map((cs) => (
                <li key={cs.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <HDPill tone={cs.action === 'granted' ? 'ok' : cs.action === 'revoked' ? 'blocked' : 'neutral'} icon={false} size="sm" label={cs.action} />
                      <span style={{ textTransform: 'capitalize', color: P.ink }}>{cs.channel}</span>
                      <span style={{ color: P.inkMute }}>· {cs.purpose}</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: P.inkMute }}>source: <span style={{ fontFamily: P.fontMono }}>{cs.source}</span></p>
                  </div>
                  <span style={{ fontSize: 10, color: P.inkMute }}>{HD.formatDateTime(cs.occurredAt)}</span>
                </li>))}
            </ul>
          </Card>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Activity</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: P.inkMute }}>Every domain event mentioning this customer — consent grants, PII reveals, loyalty credits, message sends, referral attributions. Newest first.</p>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {events.map((e) => {
              const [label, tone] = EVENT_LABEL[e.eventType] || [e.eventType, 'neutral'];
              return (
                <li key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <HDPill tone={tone} icon={false} size="sm" label={label} />
                    <span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{e.eventType}</span>
                  </div>
                  <span style={{ fontSize: 10, color: P.inkMute, whiteSpace: 'nowrap' }}>{HD.relativeTime(e.at)}</span>
                </li>);
            })}
          </ul>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="message" size={14} stroke={2} color={P.inkMute} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Recent messages</h2>
            <HDPill tone="neutral" icon={false} size="sm" label={String(messages.length)} />
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {messages.map((m) => (
              <li key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HDPill tone="neutral" icon={false} size="sm" label={m.channel.toUpperCase()} />
                    <span style={{ fontWeight: 500, color: P.ink }}>{m.templateName}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: P.inkMute }}>scheduled {HD.formatDateTime(m.scheduledFor)}{m.deliveredAt ? ` · delivered ${HD.formatDateTime(m.deliveredAt)}` : ''}</p>
                </div>
                <HDPill icon={false} size="sm" label={m.status}
                  tone={m.status === 'delivered' ? 'ok' : m.status === 'sent' || m.status === 'queued' ? 'info' : m.status === 'failed' || m.status === 'blocked' ? 'blocked' : m.status === 'held' ? 'warn' : 'neutral'} />
              </li>))}
          </ul>
        </Card>
      </div>);
  };
})();
