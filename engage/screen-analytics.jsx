// ── Analytics: overview · deliverability · campaigns · attribution ────────
;(function () {
  const useP = window.useP;
  const CHANNELS = ['sms', 'email', 'push', 'wallet'];
  const CHANNEL_LABEL = { sms: 'SMS', email: 'Email', push: 'Push', wallet: 'Wallet' };

  // Deterministic analytics rollup derived once from the shared PRNG.
  const A = (() => {
    const D = window.ENGAGE_DATA;
    const days = Array.from({ length: 14 }, (_, i) => new Date(D.NOW - (13 - i) * 86400000).toISOString().slice(5, 10));
    const perChannel = CHANNELS.map((ch, i) => {
      const sent = [86000, 61000, 18400, 12100][i];
      const delivered = Math.round(sent * [0.968, 0.979, 0.951, 0.998][i]);
      const opened = Math.round(delivered * [0.42, 0.31, 0.28, 0.6][i]);
      const clicked = Math.round(delivered * [0.078, 0.041, 0.032, 0.11][i]);
      return { channel: ch, sent, delivered, opened, clicked, optedOut: Math.round(delivered * [0.004, 0.002, 0.006, 0.0005][i]), blocked: Math.round(sent * 0.008), revenueCents: [18400000, 7600000, 2900000, 2380000][i] };
    });
    const trend = CHANNELS.map((ch, ci) => ({
      name: CHANNEL_LABEL[ch],
      data: days.map((_, i) => Math.round(perChannel[ci].sent / 14 * (0.82 + Math.sin(i / 2 + ci) * 0.12 + i * 0.012))),
    }));
    const deliveryDays = days.map((d, i) => ({ day: d, rate: 0.952 + Math.sin(i / 3) * 0.018 + (i > 10 ? 0.006 : 0) }));
    return { days, perChannel, trend, deliveryDays };
  })();

  const sum = (k) => A.perChannel.reduce((a, c) => a + c[k], 0);

  window.ScreenAnalytics = function ScreenAnalytics({ navigate }) {
    const P = useP(), HD = window.HD;
    const [win, setWin] = React.useState(30);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const sent = sum('sent'), delivered = sum('delivered'), clicked = sum('clicked'), revenue = sum('revenueCents');
    const deliveryRate = delivered / sent, ctr = clicked / delivered;
    const insights = [
      `SMS drove ${HD.formatCents(A.perChannel[0].revenueCents, { showCents: false })} (${HD.formatPercent(A.perChannel[0].revenueCents / revenue, 0)} of attributed revenue) — top channel for the period.`,
      `Delivery rate is healthy at ${HD.formatPercent(deliveryRate, 1)} — well above the 92% degradation threshold.`,
      `CTR of ${HD.formatPercent(ctr, 1)} is strong — consider A/B testing more aggressive offers.`,
      'Attributed revenue is up 18% vs. the previous period — good time to widen the test.',
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Analytics</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Last {win}d · Aggregated from <code style={{ fontFamily: P.fontMono, background: P.surface3, borderRadius: 3, padding: '1px 4px' }}>analytics.campaign_rollup</code> and <code style={{ fontFamily: P.fontMono, background: P.surface3, borderRadius: 3, padding: '1px 4px' }}>analytics.attribution</code>. Compared against the previous {win}d for delta arrows.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'inline-flex', gap: 2, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 2 }}>
              {[7, 30, 90].map((o) => (
                <button key={o} onClick={() => setWin(o)}
                  style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, fontFamily: P.fontMono, cursor: 'pointer', border: 'none',
                    background: win === o ? P.ink : 'transparent', color: win === o ? P.surface : P.inkDim }}>{o}d</button>))}
            </div>
            <PBtn size="sm" variant="secondary" icon="download" disabled>Export CSV</PBtn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="pink" icon="message" label="Messages sent" value={HD.formatNumber(sent)} sub="+5.2% vs. prev period" />
          <StatTile hue="teal" icon="check-circle" label="Delivery rate" value={HD.formatPercent(deliveryRate, 1)} sub={`${HD.formatNumber(delivered)} delivered`} />
          <StatTile hue="blue" icon="activity" label="Clicks" value={HD.formatNumber(clicked)} sub={`CTR ${HD.formatPercent(ctr, 1)}`} />
          <StatTile hue="green" icon="trending-up" label="Attributed revenue" value={HD.formatCents(revenue, { showCents: false })} sub="1,284 conversions" />
        </div>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Sends by channel · 14 days</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Daily message volume per channel from the rollup table.</p>
          </header>
          <div style={{ padding: 20 }}>
            <window.ELine series={A.trend} labels={A.days} height={230} valueFormat={(v) => `${Math.round(v / 1000)}k`} />
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <Card padding={0}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Attributed revenue by channel</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Last-touch model · click within 72h of order.</p>
            </header>
            <div style={{ padding: 20 }}>
              <window.EBar rows={A.perChannel.map((c) => ({ label: CHANNEL_LABEL[c.channel], value: c.revenueCents / 100 }))} valueFormat={(v) => HD.formatCurrency(v, { showCents: false })} />
            </div>
          </Card>

          <Card padding={0}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Cohort retention · weeks since first order</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Share of each signup cohort ordering again.</p>
            </header>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1, 2, 3, 4, 5].map((c) => (
                <window.EHeatRow key={c} label={`W-${c}`} format={(v) => `${v}%`}
                  values={[100, 62, 48, 39, 33, 29, 26, 24].map((base, i) => (i < 8 - c ? Math.max(0, Math.round(base - c * 3)) : 0))} />))}
              <p style={{ margin: '8px 0 0', fontSize: 11.5, color: P.inkMute }}>Columns are weeks 0→7 after the first order.</p>
            </div>
          </Card>
        </div>

        <Card padding={20} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: accentInk }}>
            <Icon name="sparkle" size={15} stroke={2} />Derived insights
          </div>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {insights.map((i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: P.ink2, lineHeight: 1.5 }}>
                <Icon name="arrow-right" size={12} stroke={2} style={{ marginTop: 3, flex: '0 0 auto' }} />{i}
              </li>))}
          </ul>
          <p style={{ margin: '12px 0 0', fontSize: 10, color: P.inkMute }}>Heuristic, not LLM-derived — the full AI-insight rail (anomaly detection, win/loss commentary) is a follow-up.</p>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[['Deliverability', '#/analytics/deliverability', 'mail'], ['Campaigns', '#/analytics/campaigns', 'megaphone'], ['Attribution', '#/analytics/attribution', 'target'], ['Cohorts', '#/analytics/cohorts', 'grid'], ['RFM matrix', '#/analytics/rfm', 'grid'], ['Geo', '#/analytics/geo', 'map-pin'], ['Staff', '#/analytics/staff', 'users-2'], ['Usage & spend', '#/analytics/usage', 'gauge']].map(([label, href, icon]) => (
            <button key={href} onClick={() => navigate(href)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface, padding: '12px 14px', cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.accentBorder)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hairline2)}>
              <Icon name={icon} size={15} stroke={2} color={accentInk} />
              <span style={{ flex: 1, fontSize: 13.5, color: P.ink }}>{label}</span>
              <Icon name="chevron-right" size={13} stroke={2} color={P.inkMute} />
            </button>))}
        </div>
      </div>);
  };

  function SubHeader({ crumb, title, blurb, navigate, right }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
            <button onClick={() => navigate('#/analytics')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
              <Icon name="arrow-left" size={12} stroke={2} />Analytics
            </button>
            <span>·</span><span>{crumb}</span>
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>{title}</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>{blurb}</p>
        </div>
        {right}
      </div>);
  }
  window.EngageSubHeader = SubHeader;

  window.ScreenDeliverability = function ScreenDeliverability({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const from = A.days[0], to = A.days[A.days.length - 1];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <SubHeader crumb="Deliverability" title="Deliverability" navigate={navigate}
          right={<HDPill tone="neutral" icon={false} label={`${from} → ${to}`} />}
          blurb={<>Per-channel delivery, engagement, and opt-out rates — rolled up from <code style={{ fontFamily: P.fontMono, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : P.accentBorder, borderRadius: 3, padding: '1px 5px' }}>analytics.campaign_rollup</code> across the last 14 days.</>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {A.perChannel.map((c, i) => {
            const dr = c.delivered / c.sent, open = c.opened / c.delivered, click = c.clicked / c.delivered, opt = c.optedOut / c.delivered;
            return (
              <Card key={c.channel} padding={16}>
                <MicroLabel>{CHANNEL_LABEL[c.channel]}</MicroLabel>
                <div style={{ marginTop: 4, fontSize: 30, fontWeight: 600, fontFamily: P.fontMono, color: dr > 0.95 ? HD.tone(P, 'ok').fg : HD.tone(P, 'warn').fg }}>{HD.formatPercent(dr, 2)}</div>
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
                  Delivery · {HD.formatNumber(c.sent)} sent<br />
                  Open {HD.formatPercent(open, 1)} · Click {HD.formatPercent(click, 1)} · Opt-out {HD.formatPercent(opt, 2)}
                </p>
              </Card>);
          })}
        </div>

        <Card padding={0}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Delivery rate by channel</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>14-day rollup · delivered ÷ sent.</p>
            </div>
            <HDPill tone="neutral" icon={false} size="sm" label={`${A.perChannel.length} channels`} />
          </header>
          <div style={{ padding: 20 }}>
            <window.EBar rows={A.perChannel.map((c) => ({ label: CHANNEL_LABEL[c.channel], value: (c.delivered / c.sent) * 100 }))} valueFormat={(v) => `${v.toFixed(2)}%`} />
            <window.EStrip days={A.deliveryDays} label="Daily delivery rate" />
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Top campaigns · by send volume</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Deliver, open, click, opt-out rates per campaign over the window.</p>
          </header>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Campaign</TH><TH>Channel</TH><TH align="right">Sent</TH><TH align="right">Deliver</TH><TH align="right">Open</TH><TH align="right">Click</TH><TH align="right">Opt-out</TH></tr></thead>
              <tbody>
                {D.CAMPAIGNS.filter((c) => c.sent > 0).map((c) => {
                  const deliver = c.delivered / c.sent, open = (c.clicked * 3.1) / c.delivered, click = c.clicked / c.delivered, opt = 0.0032;
                  return (
                    <TR key={c.id} onClick={() => navigate('#/campaigns')}>
                      <TD style={{ fontWeight: 500 }}>{c.name}</TD>
                      <TD><HDPill tone="neutral" icon={false} size="sm" label={CHANNEL_LABEL[c.channel] || c.channel} /></TD>
                      <TD align="right" mono>{HD.formatNumber(c.sent)}</TD>
                      <TD align="right" mono>{HD.formatPercent(deliver, 2)}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatPercent(Math.min(0.99, open), 1)}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatPercent(click, 1)}</TD>
                      <TD align="right" mono style={{ color: P.inkMute }}>{HD.formatPercent(opt, 2)}</TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };

  window.ScreenCampaignAnalytics = function ScreenCampaignAnalytics({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [sortKey, setSortKey] = React.useState('revenue');
    const rows = D.CAMPAIGNS.filter((c) => c.sent > 0).map((c) => ({
      ...c, deliveryRate: c.delivered / c.sent, ctr: c.clicked / c.sent,
      revenuePerSend: c.revenueCents / c.sent / 100, roas: c.revenueCents / Math.max(1, c.sent * 2) / 100,
    })).sort((a, b) => (sortKey === 'revenue' ? b.revenueCents - a.revenueCents : sortKey === 'ctr' ? b.ctr - a.ctr : b.sent - a.sent));
    const best = rows[0];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <SubHeader crumb="Campaigns" title="Campaign analytics" navigate={navigate}
          blurb="Per-send performance with revenue-per-message and ROAS. Sorted so the campaigns worth repeating float to the top."
          right={<div style={{ display: 'inline-flex', gap: 2, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 2 }}>
            {[['revenue', 'Revenue'], ['ctr', 'CTR'], ['sent', 'Volume']].map(([k, l]) => (
              <button key={k} onClick={() => setSortKey(k)} style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: P.fontSans, background: sortKey === k ? P.ink : 'transparent', color: sortKey === k ? P.surface : P.inkDim }}>{l}</button>))}
          </div>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="green" icon="trending-up" label="Best campaign" value={HD.formatCents(best.revenueCents, { showCents: false })} sub={best.name} />
          <StatTile hue="pink" icon="message" label="Total sends" value={HD.formatNumber(rows.reduce((a, r) => a + r.sent, 0))} sub={`${rows.length} campaigns`} />
          <StatTile hue="blue" icon="activity" label="Avg CTR" value={HD.formatPercent(rows.reduce((a, r) => a + r.ctr, 0) / rows.length, 1)} sub="clicks ÷ sends" />
          <StatTile hue="violet" icon="dollar" label="Revenue / send" value={HD.formatCurrency(rows.reduce((a, r) => a + r.revenuePerSend, 0) / rows.length)} sub="attributed, last-touch" />
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Campaign</TH><TH>Channel</TH><TH>Audience</TH><TH align="right">Sent</TH><TH align="right">Delivery</TH><TH align="right">CTR</TH><TH align="right">Revenue</TH><TH align="right">Rev / send</TH></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD style={{ fontWeight: 500 }}>{c.name}</TD>
                    <TD><HDPill tone="neutral" icon={false} size="sm" label={CHANNEL_LABEL[c.channel] || c.channel} /></TD>
                    <TD style={{ fontSize: 12.5, color: P.inkDim }}>{c.audience}</TD>
                    <TD align="right" mono>{HD.formatNumber(c.sent)}</TD>
                    <TD align="right" mono>{HD.formatPercent(c.deliveryRate, 1)}</TD>
                    <TD align="right" mono style={{ color: c.ctr > 0.2 ? HD.tone(P, 'ok').fg : P.ink2 }}>{HD.formatPercent(c.ctr, 1)}</TD>
                    <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(c.revenueCents, { showCents: false })}</TD>
                    <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatCurrency(c.revenuePerSend)}</TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Revenue per send · by campaign</h2>
          </header>
          <div style={{ padding: 20 }}>
            <window.EBar rows={rows.map((c) => ({ label: c.name.split(' ').slice(0, 2).join(' '), value: c.revenuePerSend }))} valueFormat={(v) => HD.formatCurrency(v)} />
          </div>
        </Card>
      </div>);
  };

  window.ScreenAttribution = function ScreenAttribution({ navigate }) {
    const P = useP(), HD = window.HD;
    const [model, setModel] = React.useState('last_touch');
    const MODELS = [['last_touch', 'Last touch'], ['first_touch', 'First touch'], ['linear', 'Linear'], ['position', 'Position-based']];
    const weights = { last_touch: [1, 0.72, 0.51, 0.4], first_touch: [0.62, 1, 0.44, 0.36], linear: [0.8, 0.86, 0.62, 0.52], position: [0.9, 0.8, 0.55, 0.45] };
    const rows = A.perChannel.map((c, i) => ({
      channel: c.channel,
      revenueCents: Math.round(c.revenueCents * weights[model][i]),
      conversions: Math.round(c.clicked * 0.12 * weights[model][i]),
      touches: c.clicked,
    }));
    const total = rows.reduce((a, r) => a + r.revenueCents, 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <SubHeader crumb="Attribution" title="Attribution" navigate={navigate}
          blurb="Which touch gets the credit. Switch models to see how sensitive your revenue picture is to the attribution rule — big swings mean overlapping channels."
          right={<div style={{ display: 'inline-flex', gap: 2, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 2, flexWrap: 'wrap' }}>
            {MODELS.map(([k, l]) => (
              <button key={k} onClick={() => setModel(k)} style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: P.fontSans, background: model === k ? P.ink : 'transparent', color: model === k ? P.surface : P.inkDim }}>{l}</button>))}
          </div>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="green" icon="dollar" label="Attributed revenue" value={HD.formatCents(total, { showCents: false })} sub={`${MODELS.find(([k]) => k === model)[1]} model`} />
          <StatTile hue="teal" icon="target" label="Conversions" value={HD.formatNumber(rows.reduce((a, r) => a + r.conversions, 0))} sub="within 72h attribution window" />
          <StatTile hue="blue" icon="activity" label="Touches" value={HD.formatNumber(rows.reduce((a, r) => a + r.touches, 0))} sub="clicks + opens counted" />
          <StatTile hue="violet" icon="percent" label="Avg order value" value={HD.formatCurrency(total / 100 / Math.max(1, rows.reduce((a, r) => a + r.conversions, 0)))} sub="attributed orders only" />
        </div>

        <Card padding={0}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Revenue share by channel</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Same underlying touch data, re-weighted by the selected model.</p>
          </header>
          <div style={{ padding: 20 }}>
            <window.EBar rows={rows.map((r) => ({ label: CHANNEL_LABEL[r.channel], value: r.revenueCents / 100 }))} valueFormat={(v) => HD.formatCurrency(v, { showCents: false })} />
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <HDTable>
            <thead><tr><TH>Channel</TH><TH align="right">Touches</TH><TH align="right">Conversions</TH><TH align="right">Conv. rate</TH><TH align="right">Revenue</TH><TH align="right">Share</TH></tr></thead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.channel}>
                  <TD><HDPill tone="neutral" icon={false} size="sm" label={CHANNEL_LABEL[r.channel]} /></TD>
                  <TD align="right" mono>{HD.formatNumber(r.touches)}</TD>
                  <TD align="right" mono>{HD.formatNumber(r.conversions)}</TD>
                  <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatPercent(r.conversions / r.touches, 1)}</TD>
                  <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatCents(r.revenueCents, { showCents: false })}</TD>
                  <TD align="right" mono>{HD.formatPercent(r.revenueCents / total, 0)}</TD>
                </TR>))}
            </tbody>
          </HDTable>
        </Card>

        <Card padding={16} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : P.accentBorder }}>Reading the model swing</p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: P.ink2, lineHeight: 1.55 }}>
            SMS looks strongest under last-touch because it's usually the final nudge; email gains under first-touch because it starts more journeys. If a channel's share moves more than ~15 points between models, treat its standalone ROI numbers with suspicion.
          </p>
        </Card>
      </div>);
  };

  window.EngageAnalyticsData = A;
})();
