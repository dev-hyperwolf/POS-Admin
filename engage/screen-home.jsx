// ── Dashboard home (/) — port of app/console/page.tsx ─────────────────────
;(function () {
  const useP = window.useP;

  const ACTIVITY = [
    { id: '1', at: '2 minutes ago', icon: 'zap', tone: 'ok', title: 'Audience refresh · "At-risk VIPs"', detail: '1,847 members (+63 added, 22 removed)', href: '#/audiences/aud-001' },
    { id: '2', at: '14 minutes ago', icon: 'sparkle', tone: 'info', title: 'Predictive traits rescored for 40,210 customers', detail: 'churn_30d · ltv_90d · propensity_flower' },
    { id: '3', at: '52 minutes ago', icon: 'megaphone', tone: 'neutral', title: 'Campaign "Labor Day Flower Drop" sent', detail: '11,204 SMS · 9,881 delivered · 3,112 clicks', href: '#/analytics/campaigns' },
    { id: '4', at: '1 hour ago', icon: 'gift', tone: 'ok', title: '3 customers hit Diamond tier', detail: 'auto-granted first-purchase reward', href: '#/loyalty' },
    { id: '5', at: '2 hours ago', icon: 'wallet', tone: 'neutral', title: 'Apple Wallet pass refreshed for 402 customers', href: '#/wallet' },
    { id: '6', at: '4 hours ago', icon: 'check-circle', tone: 'warn', title: 'Policy engine held 188 SMS into quiet hours', detail: 'releasing at 09:00 local', href: '#/messages' },
  ];

  const QUICK = [
    { href: '#/audiences/new', title: 'Build audience with AI', body: 'Describe your audience in plain English — we turn it into a safe, live-preview filter.', icon: 'sparkle' },
    { href: '#/campaigns', title: 'Send a campaign', body: 'SMS, email, or wallet pass. Policy engine checks quiet hours, consent, and frequency caps.', icon: 'megaphone' },
    { href: '#/interactive', title: 'Launch a game', body: 'Spin wheel, scratch card, or quiz. Server-committed draws + cannabis-safety enforced.', icon: 'gamepad' },
  ];

  function HealthRow({ label, value }) {
    const P = useP(), HD = window.HD;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <dt style={{ display: 'flex', alignItems: 'center', gap: 8, color: P.inkDim, fontSize: 13.5 }}>
          <span style={{ height: 6, width: 6, borderRadius: 99, background: HD.tone(P, 'ok').fg }} />{label}
        </dt>
        <dd style={{ margin: 0, fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{value}</dd>
      </div>);
  }

  window.ScreenEngageHome = function ScreenEngageHome({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: P.inkMute }}>Good afternoon, Jessica</span>
              <HDPill tone="neutral" size="sm" label="live" />
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 700, letterSpacing: '-.02em', textTransform: 'uppercase', color: P.ink, lineHeight: 1.05 }}>{D.TENANT.name}</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute }}>
              Segmentation, messaging, and loyalty for {HD.formatNumber(D.TENANT.customers)} customers. Your predictive traits refreshed 12 minutes ago.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="users" onClick={() => navigate('#/customers')}>View customers</PBtn>
            <PBtn size="sm" variant="accent" icon="sparkle" onClick={() => navigate('#/audiences/new')}>New audience</PBtn>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          <StatTile hue="teal" icon="users" label="Audiences live" value="27" sub="+3 this week" />
          <StatTile hue="pink" icon="message" label="Messages sent · 7d" value="184,620" sub="+5.2% vs. previous 7d" />
          <StatTile hue="green" icon="trending-up" label="Attributed revenue · 30d" value="$312,840" sub="+$48.6k vs. prev 30d" />
          <StatTile hue="violet" icon="gauge" label="Churn risk ≥ 0.6" value="3,128" sub="−4.1% · winback hitting" />
        </div>

        <div className="hd-2col">
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Recent activity</h2>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>Live feed from the event bus · pg_notify</p>
              </div>
              <PBtn size="sm" variant="ghost" onClick={() => navigate('#/audit')}>View all →</PBtn>
            </header>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {ACTIVITY.map((a) => {
                const c = HD.tone(P, a.tone);
                return (
                  <li key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${P.hairline}` }}>
                    <span style={{ marginTop: 1, height: 28, width: 28, flex: '0 0 auto', borderRadius: 99, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={a.icon} size={14} stroke={2} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {a.href
                        ? <button onClick={() => navigate(a.href)} style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 13.5, fontWeight: 500, color: P.ink, cursor: 'pointer', fontFamily: P.fontSans }}>{a.title}</button>
                        : <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: P.ink }}>{a.title}</p>}
                      {a.detail && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>{a.detail}</p>}
                    </div>
                    <span style={{ flex: '0 0 auto', fontSize: 11.5, color: P.inkMute }}>{a.at}</span>
                  </li>);
              })}
            </ol>
          </Card>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Channel health</h3>
                <HDPill tone="ok" size="sm" label="all green" />
              </div>
              <dl style={{ margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <HealthRow label="Twilio SMS" value="99.98% · 210ms p50" />
                <HealthRow label="SendGrid email" value="99.94% · 412ms p50" />
                <HealthRow label="Web push" value="99.6% · 180ms p50" />
                <HealthRow label="Wallet APNs" value="queue: 0" />
              </dl>
              <div style={{ height: 1, background: P.hairline2, margin: '16px 0' }} />
              <p style={{ margin: 0, fontSize: 11.5, color: P.inkMute }}>Traffic rolling window is 1h.</p>
            </Card>

            <Card padding={20} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkle" size={14} stroke={2} color={accentInk} />
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: accentInk }}>AI suggests</h3>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13.5, color: P.ink }}>
                <strong>412 customers</strong> look like your top “Champions” but aren't tagged. Worth a win-back campaign?
              </p>
              <PBtn size="sm" variant="secondary" style={{ marginTop: 12 }} onClick={() => navigate('#/audiences/suggested')}>Review suggestion →</PBtn>
            </Card>
          </aside>
        </div>

        <section>
          <MicroLabel>Quick actions</MicroLabel>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {QUICK.map((c) => (
              <button key={c.href} onClick={() => navigate(c.href)}
                style={{ textAlign: 'left', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: 20, cursor: 'pointer', fontFamily: P.fontSans, transition: 'transform .15s, border-color .15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = P.accentBorder; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = P.hairline2; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ height: 32, width: 32, borderRadius: 9, background: P.surface3, color: accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={c.icon} size={16} stroke={2} />
                  </span>
                  <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{c.title}</h3>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 13.5, color: P.inkMute, lineHeight: 1.45 }}>{c.body}</p>
              </button>))}
          </div>
        </section>
      </div>);
  };
})();
