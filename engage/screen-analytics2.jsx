// ── Analytics: cohorts · rfm · geo · staff · usage ────────────────────────
;(function () {
  const useP = window.useP;
  const SubHeader = () => null; // replaced below by the shared one

  const SEGMENT_ORDER = ['champions', 'loyal', 'potential_loyal', 'new', 'needs_attention', 'at_risk', 'hibernating'];
  const SEGMENT_LABEL = { champions: 'Champions', loyal: 'Loyal', potential_loyal: 'Potential loyalist', new: 'New', needs_attention: 'Needs attention', at_risk: 'At risk', hibernating: 'Hibernating' };

  window.ScreenCohorts = function ScreenCohorts({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA, Head = window.EngageSubHeader;
    const cohorts = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => {
      const size = 1200 + i * 340 + D.range(-120, 180);
      const curve = [100, 58, 44, 36, 31, 27].map((v, k) => (k <= 5 - i ? Math.max(0, Math.round(v - i * 2 + D.range(-2, 2))) : null));
      return { month: m, size, curve, ltv: 4200 + i * 380 };
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <Head crumb="Cohorts" title="Cohorts" navigate={navigate}
          blurb="Retention and LTV by signup month. Each row follows one cohort forward — a row that decays faster than the ones above it is a product problem, not a marketing one." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="teal" icon="users" label="Cohorts tracked" value={String(cohorts.length)} sub="monthly signup cohorts" />
          <StatTile hue="green" icon="trending-up" label="Best M1 retention" value="58%" sub="November cohort" />
          <StatTile hue="pink" icon="dollar" label="Avg 6-mo LTV" value={HD.formatCurrency(cohorts.reduce((a, c) => a + c.ltv, 0) / cohorts.length / 100 * 100 / 100 * 100)} sub="attributed spend" />
          <StatTile hue="violet" icon="activity" label="Blended M3" value="36%" sub="all cohorts" />
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Retention triangle</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Percent of the cohort ordering again in month N.</p>
          </header>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Cohort</TH><TH align="right">Size</TH>{[0, 1, 2, 3, 4, 5].map((m) => <TH key={m} align="right">M{m}</TH>)}<TH align="right">6-mo LTV</TH></tr></thead>
              <tbody>
                {cohorts.map((c) => (
                  <TR key={c.month}>
                    <TD style={{ fontWeight: 500 }}>{c.month} 2025</TD>
                    <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatNumber(c.size)}</TD>
                    {c.curve.map((v, i) => (
                      <TD key={i} align="right" mono>
                        {v == null ? <span style={{ color: P.inkFaint }}>—</span>
                          : <span style={{ display: 'inline-block', minWidth: 46, borderRadius: 5, padding: '2px 6px', background: `color-mix(in oklab, ${P.accent} ${Math.round(12 + v * 0.7)}%, ${P.surface})`, color: v > 60 ? (P.mode === 'dark' ? P.accentInk : P.ink) : P.ink2 }}>{v}%</span>}
                      </TD>))}
                    <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(c.ltv * 100, { showCents: false })}</TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Retention curves</h2>
          </header>
          <div style={{ padding: 20 }}>
            <window.ELine labels={['M0', 'M1', 'M2', 'M3', 'M4', 'M5']} height={230} valueFormat={(v) => `${Math.round(v)}%`} yMaxOverride={100}
              series={cohorts.slice(0, 4).map((c) => ({ name: c.month, data: c.curve.map((v) => v ?? 0) }))} />
          </div>
        </Card>
      </div>);
  };

  window.ScreenRfm = function ScreenRfm({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA, Head = window.EngageSubHeader;
    const [picked, setPicked] = React.useState(null);
    const cells = React.useMemo(() => {
      const out = [];
      for (let r = 1; r <= 5; r++) for (let f = 1; f <= 5; f++) {
        const centre = 1 - (Math.abs(r - 3) + Math.abs(f - 3)) / 6;
        out.push({ r, f, count: Math.round(D.TENANT.customers / 25 * (0.35 + centre * 1.6) * (r === 5 && f === 5 ? 1.4 : 1)) });
      }
      return out;
    }, []);
    const total = cells.reduce((a, c) => a + c.count, 0);
    const segments = SEGMENT_ORDER.map((s) => {
      const members = D.CUSTOMERS.filter((c) => c.rfmSegment === s);
      const share = members.length / D.CUSTOMERS.length;
      return { segment: s, count: Math.round(total * share), avgMonetaryCents: Math.round(members.reduce((a, c) => a + c.lifetimeSpentCents, 0) / Math.max(1, members.length)) };
    }).sort((a, b) => SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment));
    const top = [...segments].sort((a, b) => b.count - a.count)[0];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <Head crumb="RFM" title="RFM matrix" navigate={navigate}
          blurb="Recency, frequency, monetary — the classic customer-health grid, pre-scored per tenant. Use the matrix to spot the cells that will best respond to a win-back push." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          <StatTile hue="teal" icon="grid" label="Customers with RFM" value={HD.formatNumber(total)} sub="from segmentation.customer_trait" />
          <StatTile hue="green" icon="award" label="Largest segment" value={SEGMENT_LABEL[top.segment]} sub={`${HD.formatNumber(top.count)} customers · avg ${HD.formatCents(top.avgMonetaryCents, { showCents: false })}`} />
          <StatTile hue="pink" icon="tag" label="Labeled customers" value={HD.formatNumber(segments.reduce((a, s) => a + s.count, 0))} sub="carry a canonical rfm_segment" />
        </div>

        <Card padding={0}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Recency × frequency · 5×5</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>
                Quintile buckets over <code style={{ fontFamily: P.fontMono, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : P.accentBorder, borderRadius: 3, padding: '1px 5px' }}>recency_days</code> and <code style={{ fontFamily: P.fontMono, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : P.accentBorder, borderRadius: 3, padding: '1px 5px' }}>frequency_90d</code>.
              </p>
            </div>
            {picked && <HDPill tone="brand" icon={false} size="sm" label={`R${picked.r} F${picked.f} · ${HD.formatNumber(picked.count)}`} />}
          </header>
          <div style={{ padding: 20 }}>
            <window.ERfmMatrix cells={cells} total={total} onCell={(r, f, count) => setPicked({ r, f, count })} />
            {picked && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, padding: 12 }}>
                <Icon name="sparkle" size={14} stroke={2} color={P.mode === 'dark' ? P.accent : P.accentBorder} />
                <span style={{ flex: 1, fontSize: 12.5, color: P.ink2 }}>
                  {HD.formatNumber(picked.count)} customers in R{picked.r}/F{picked.f}. {picked.r <= 2 && picked.f >= 4 ? 'High frequency but stale — prime win-back cell.' : picked.r >= 4 && picked.f >= 4 ? 'Your champions — protect with early access, not discounts.' : 'Mid-grid: test a small offer before scaling.'}
                </span>
                <PBtn size="xs" variant="secondary" icon="sparkle" onClick={() => navigate('#/audiences/new')}>Build audience</PBtn>
              </div>)}
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Canonical RFM segments</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Pre-computed labels from <code style={{ fontFamily: P.fontMono }}>segmentation.customer_trait.rfm_segment</code>.</p>
          </header>
          <HDTable>
            <thead><tr><TH>Segment</TH><TH align="right">Customers</TH><TH align="right">% of tenant</TH><TH align="right">Avg monetary · 90d</TH></tr></thead>
            <tbody>
              {segments.map((s) => (
                <TR key={s.segment}>
                  <TD style={{ fontWeight: 500 }}>{SEGMENT_LABEL[s.segment]}</TD>
                  <TD align="right" mono>{HD.formatNumber(s.count)}</TD>
                  <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatPercent(s.count / total, 1)}</TD>
                  <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(s.avgMonetaryCents, { showCents: false })}</TD>
                </TR>))}
            </tbody>
          </HDTable>
        </Card>
      </div>);
  };

  window.ScreenGeo = function ScreenGeo({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA, Head = window.EngageSubHeader;
    const zones = [
      { name: 'West Hollywood', zip: '90069', customers: 8420, revenueCents: 9840000, aov: 8600, growth: 0.14 },
      { name: 'Long Beach', zip: '90802', customers: 6180, revenueCents: 6420000, aov: 7400, growth: 0.08 },
      { name: 'Corona', zip: '92879', customers: 5240, revenueCents: 5210000, aov: 7100, growth: -0.03 },
      { name: 'Lake Elsinore', zip: '92530', customers: 4110, revenueCents: 3980000, aov: 6900, growth: 0.21 },
      { name: 'Santa Monica', zip: '90401', customers: 3860, revenueCents: 4640000, aov: 9200, growth: 0.06 },
      { name: 'Pasadena', zip: '91101', customers: 3020, revenueCents: 3120000, aov: 8100, growth: -0.09 },
      { name: 'Anaheim', zip: '92805', customers: 2740, revenueCents: 2510000, aov: 6600, growth: 0.02 },
      { name: 'Torrance', zip: '90501', customers: 2180, revenueCents: 2010000, aov: 7000, growth: 0.11 },
    ];
    const totalCustomers = zones.reduce((a, z) => a + z.customers, 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <Head crumb="Geo" title="Geo" navigate={navigate}
          blurb="Where the demand actually is — customers, revenue, and AOV per delivery zone. Use it to decide which zone deserves the next driver, not just the next discount." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="blue" icon="map-pin" label="Zones with demand" value={String(zones.length)} sub="ZIP-level rollup" />
          <StatTile hue="teal" icon="users" label="Customers mapped" value={HD.formatNumber(totalCustomers)} sub="geocoded from last order" />
          <StatTile hue="green" icon="trending-up" label="Fastest growing" value="Lake Elsinore" sub="+21% revenue vs prev 30d" />
          <StatTile hue="pink" icon="dollar" label="Highest AOV" value={HD.formatCents(9200, { showCents: false })} sub="Santa Monica" />
        </div>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Revenue by zone</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Last 30 days · attributed to the delivery address.</p>
          </header>
          <div style={{ padding: 20 }}>
            <window.EBar rows={zones.map((z) => ({ label: z.name, value: z.revenueCents / 100 }))} valueFormat={(v) => HD.formatCurrency(v, { showCents: false })} />
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Zone</TH><TH>ZIP</TH><TH align="right">Customers</TH><TH align="right">Revenue · 30d</TH><TH align="right">AOV</TH><TH align="right">Growth</TH><TH>Share</TH></tr></thead>
              <tbody>
                {zones.map((z) => (
                  <TR key={z.zip}>
                    <TD style={{ fontWeight: 500 }}>{z.name}</TD>
                    <TD mono style={{ color: P.inkDim }}>{z.zip}</TD>
                    <TD align="right" mono>{HD.formatNumber(z.customers)}</TD>
                    <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(z.revenueCents, { showCents: false })}</TD>
                    <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatCents(z.aov)}</TD>
                    <TD align="right" mono style={{ color: z.growth > 0 ? HD.tone(P, 'ok').fg : HD.tone(P, 'blocked').fg }}>{z.growth > 0 ? '+' : ''}{HD.formatPercent(z.growth, 0)}</TD>
                    <TD>
                      <div style={{ width: 100, height: 5, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(z.customers / totalCustomers) * 260}%`, maxWidth: '100%', background: P.accent }} />
                      </div>
                    </TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };

  window.ScreenStaff = function ScreenStaff({ navigate }) {
    const P = useP(), HD = window.HD, Head = window.EngageSubHeader;
    const staff = [
      { name: 'Ana Ruiz', role: 'Budtender · WeHo', signups: 184, optIns: 168, redemptions: 92, attributedCents: 1840000 },
      { name: 'Devon Clarke', role: 'Budtender · Long Beach', signups: 152, optIns: 121, redemptions: 74, attributedCents: 1420000 },
      { name: 'Priya Nair', role: 'Shift lead · Corona', signups: 141, optIns: 136, redemptions: 88, attributedCents: 1610000 },
      { name: 'Marcus Webb', role: 'Budtender · Corona', signups: 118, optIns: 84, redemptions: 41, attributedCents: 820000 },
      { name: 'Tomas Silva', role: 'Driver · WeHo', signups: 96, optIns: 88, redemptions: 52, attributedCents: 940000 },
      { name: 'Renee Okafor', role: 'Budtender · Lake Elsinore', signups: 88, optIns: 62, redemptions: 30, attributedCents: 610000 },
    ];
    const totalSignups = staff.reduce((a, s) => a + s.signups, 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <Head crumb="Staff" title="Staff" navigate={navigate}
          blurb="Loyalty signups, consent capture, and redemption assists per staff member. Consent rate is the number that matters — a high signup count with low opt-in means the pitch isn't landing." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="teal" icon="user-plus" label="Signups · 30d" value={HD.formatNumber(totalSignups)} sub={`${staff.length} staff contributing`} />
          <StatTile hue="green" icon="shield" label="Consent rate" value={HD.formatPercent(staff.reduce((a, s) => a + s.optIns, 0) / totalSignups, 0)} sub="express written consent" />
          <StatTile hue="pink" icon="gift" label="Redemption assists" value={HD.formatNumber(staff.reduce((a, s) => a + s.redemptions, 0))} sub="rewards redeemed in-store" />
          <StatTile hue="violet" icon="dollar" label="Attributed revenue" value={HD.formatCents(staff.reduce((a, s) => a + s.attributedCents, 0), { showCents: false })} sub="orders from staff signups" />
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Leaderboard</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Sorted by signups; consent rate flags where coaching would help.</p>
          </header>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Staff</TH><TH>Role</TH><TH align="right">Signups</TH><TH align="right">Opt-ins</TH><TH align="right">Consent rate</TH><TH align="right">Redemptions</TH><TH align="right">Attributed</TH></tr></thead>
              <tbody>
                {staff.map((s, i) => {
                  const rate = s.optIns / s.signups;
                  return (
                    <TR key={s.name}>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {i < 3 && <HDPill tone="neutral" icon={false} size="sm" label={`#${i + 1}`} />}
                          <span style={{ fontWeight: 500, color: P.ink }}>{s.name}</span>
                        </div>
                      </TD>
                      <TD style={{ fontSize: 12.5, color: P.inkDim }}>{s.role}</TD>
                      <TD align="right" mono>{s.signups}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{s.optIns}</TD>
                      <TD align="right" mono style={{ color: rate > 0.85 ? HD.tone(P, 'ok').fg : rate > 0.7 ? HD.tone(P, 'warn').fg : HD.tone(P, 'blocked').fg }}>{HD.formatPercent(rate, 0)}</TD>
                      <TD align="right" mono>{s.redemptions}</TD>
                      <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(s.attributedCents, { showCents: false })}</TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };

  window.ScreenUsage = function ScreenUsage({ navigate }) {
    const P = useP(), HD = window.HD, Head = window.EngageSubHeader;
    const A = window.EngageAnalyticsData;
    const lines = [
      { resource: 'SMS segments · Twilio', usage: 184620, unit: 'segments', costCents: 1292340, capPct: 0.62 },
      { resource: 'Email sends · SendGrid', usage: 612400, unit: 'emails', costCents: 214340, capPct: 0.41 },
      { resource: 'Web push', usage: 88200, unit: 'pushes', costCents: 0, capPct: 0.18 },
      { resource: 'Wallet APNs pushes', usage: 42100, unit: 'pushes', costCents: 0, capPct: 0.09 },
      { resource: 'AI audience generations', usage: 412, unit: 'calls', costCents: 84600, capPct: 0.34 },
      { resource: 'Warehouse export rows', usage: 4210000, unit: 'rows', costCents: 62000, capPct: 0.71 },
    ];
    const total = lines.reduce((a, l) => a + l.costCents, 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <Head crumb="Usage" title="Usage &amp; spend" navigate={navigate}
          blurb="Metered usage per resource with the monthly cap. Spend here is provider cost, not customer revenue — pair it with attribution to judge whether a channel earns its keep." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="pink" icon="dollar" label="Spend · month to date" value={HD.formatCents(total, { showCents: false })} sub="all metered resources" />
          <StatTile hue="teal" icon="message" label="SMS segments" value={HD.formatNumber(lines[0].usage)} sub={`${HD.formatCents(lines[0].costCents, { showCents: false })} · 62% of cap`} />
          <StatTile hue="green" icon="trending-up" label="Cost / attributed $" value="$0.041" sub="spend ÷ attributed revenue" />
          <StatTile hue="violet" icon="gauge" label="Nearest cap" value="71%" sub="warehouse export rows" />
        </div>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Daily spend · 14 days</h2>
          </header>
          <div style={{ padding: 20 }}>
            <window.ELine labels={A.days} height={200} valueFormat={(v) => `$${Math.round(v)}`}
              series={[{ name: 'SMS', data: A.days.map((_, i) => 780 + Math.sin(i / 2) * 120 + i * 8) }, { name: 'Email', data: A.days.map((_, i) => 140 + Math.cos(i / 3) * 24) }, { name: 'AI + export', data: A.days.map((_, i) => 90 + (i % 4) * 12) }]} />
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Resource</TH><TH align="right">Usage</TH><TH align="right">Cost</TH><TH>Monthly cap</TH></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <TR key={l.resource}>
                    <TD style={{ fontWeight: 500 }}>{l.resource}</TD>
                    <TD align="right" mono>{HD.formatNumber(l.usage)} <span style={{ color: P.inkMute, fontSize: 11.5 }}>{l.unit}</span></TD>
                    <TD align="right" mono style={{ fontWeight: 600 }}>{l.costCents ? HD.formatCents(l.costCents) : '—'}</TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 120, height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${l.capPct * 100}%`, background: l.capPct > 0.8 ? HD.tone(P, 'blocked').fg : l.capPct > 0.6 ? HD.tone(P, 'warn').fg : HD.tone(P, 'ok').fg }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.inkMute }}>{HD.formatPercent(l.capPct, 0)}</span>
                      </div>
                    </TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Card padding={16} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : P.accentBorder }}>Caps are soft by default</p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: P.ink2, lineHeight: 1.55 }}>
            Hitting a cap raises an alert and throttles the queue rather than dropping sends. Flip <code style={{ fontFamily: P.fontMono }}>cost.hard_cap</code> in feature flags if you'd rather fail closed.
          </p>
          <PBtn size="sm" variant="secondary" style={{ marginTop: 12 }} onClick={() => navigate('#/settings/cost')}>Open cost controls →</PBtn>
        </Card>
      </div>);
  };
})();
