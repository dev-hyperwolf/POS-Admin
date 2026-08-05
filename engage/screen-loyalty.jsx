// ── /loyalty · /loyalty/[id] · /referrals(+programs, fraud) · /wallet ─────
;(function () {
  const useP = window.useP;

  // ── Loyalty list ────────────────────────────────────────────────────────
  window.ScreenLoyalty = function ScreenLoyalty({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Loyalty</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Points ledger, tiers, and rewards. The ledger is the source of truth — balances are identical at every store because points never live in a POS.
            </p>
          </div>
          <PBtn size="sm" variant="accent" icon="plus" onClick={() => window.hdToast?.({ title: 'New program', description: 'Program wizard opens in the next release.', tone: 'info' })}>New program</PBtn>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {D.LOYALTY_PROGRAMS.map((p) => (
            <li key={p.id}>
              <Card padding={20} style={{ cursor: 'pointer', height: '100%' }} onClick={() => navigate(`#/loyalty/${p.id}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="coins" size={16} stroke={2} color={P.mode === 'dark' ? P.accent : P.accentBorder} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>{p.name}</h2>
                  </div>
                  <HDPill tone={p.status === 'active' ? 'ok' : 'neutral'} icon={false} size="sm" label={p.status} />
                </div>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {[['Members', HD.formatNumber(p.members)], ['Points outstanding', HD.formatNumber(p.pointsOutstanding)], ['Liability', HD.formatCents(p.liabilityCents, { showCents: false })], ['Earn rate', p.earnRate]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{v}</div>
                    </div>))}
                </div>
                {p.tiers.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 4 }}>
                    {p.tiers.map((t, i) => (
                      <div key={t.name} style={{ flex: t.members || 1, minWidth: 4 }}>
                        <div style={{ height: 6, borderRadius: 99, background: [P.accent, HD.hueColor(P, 'teal'), HD.hueColor(P, 'blue'), HD.hueColor(P, 'violet')][i] }} />
                        <div style={{ marginTop: 4, fontSize: 10, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      </div>))}
                  </div>)}
              </Card>
            </li>))}
        </ul>
      </div>);
  };

  // ── Loyalty program detail ──────────────────────────────────────────────
  window.ScreenLoyaltyProgram = function ScreenLoyaltyProgram({ path, navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const id = path.split('/')[2];
    const p = D.LOYALTY_PROGRAMS.find((x) => x.id === id) || D.LOYALTY_PROGRAMS[0];
    const wallets = [...D.CUSTOMERS].sort((a, b) => b.pointsBalance - a.pointsBalance).slice(0, 10);
    const liability = { startingBalance: p.pointsOutstanding - 42000, accrued: 88400, redeemed: 41200, expired: 5100, adjusted: -100, endingBalance: p.pointsOutstanding, wowEndingDelta: 32800 };
    const events = [
      ['Credited', 'ok', '+250 pts · order 8841', D.ago(12)],
      ['Reward redeemed', 'info', '$15 off · 280 pts', D.ago(44)],
      ['Tier entered', 'ok', 'Diamond', D.ago(120)],
      ['Expired', 'warn', '-5,100 pts · 12-month window', D.agoDays(1)],
      ['Debited', 'neutral', '-100 pts · manual adjustment', D.agoDays(2)],
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('#/loyalty')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Loyalty
            </button>
            <Icon name="coins" size={26} stroke={1.8} color={P.mode === 'dark' ? P.accent : P.accentBorder} />
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{p.name}</h1>
              <p style={{ margin: '2px 0 0', fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{p.id} · {p.earnRate} · {p.redeemRate} · expires {p.expiryMonths}mo</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HDPill tone={p.status === 'active' ? 'ok' : 'neutral'} icon={false} size="sm" label={p.status} />
            <PBtn size="sm" variant="secondary" icon="pencil">Edit</PBtn>
            <PBtn size="sm" variant="ghost" icon="pause">Pause</PBtn>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[['Wallets', HD.formatNumber(p.members), 'users', null], ['Active balance', HD.formatNumber(p.pointsOutstanding), 'coins', "= today's points liability"], ['Lifetime earned', HD.formatNumber(Math.round(p.pointsOutstanding * 3.2)), 'trending-up', null], ['Lifetime spent', HD.formatNumber(Math.round(p.pointsOutstanding * 2.2)), 'arrow-down', null]].map(([label, value, icon, hint]) => (
            <Card key={label} padding={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
                <Icon name={icon} size={11} stroke={2} />{label}
              </div>
              <div style={{ marginTop: 4, fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, color: label === 'Lifetime earned' ? HD.tone(P, 'ok').fg : P.ink }}>{value}</div>
              {hint && <div style={{ marginTop: 2, fontSize: 10, color: P.inkMute }}>{hint}</div>}
            </Card>))}
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Points liability · today</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Daily snapshot from <code style={{ fontFamily: P.fontMono, background: P.surface3, borderRadius: 3, padding: '1px 4px' }}>analytics.liability_rollup</code>; worker writes it nightly.</p>
          </header>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {[['Starting', liability.startingBalance, null], ['Accrued', liability.accrued, 'ok'], ['Redeemed', -liability.redeemed, null], ['Expired', -liability.expired, 'warn'], ['Adjusted', liability.adjusted, null], ['Ending', liability.endingBalance, 'brand']].map(([label, value, tone], i) => (
              <div key={label} style={{ padding: '14px 20px', borderLeft: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</div>
                <div style={{ marginTop: 4, fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, color: tone ? HD.tone(P, tone).fg : P.ink }}>
                  {value > 0 && tone === 'ok' ? '+' : ''}{HD.formatNumber(value)}
                </div>
                {label === 'Ending' && <div style={{ marginTop: 2, fontSize: 10, color: P.inkMute }}>+{HD.formatNumber(liability.wowEndingDelta)} vs 7d ago</div>}
              </div>))}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="grid" size={14} stroke={2} color={P.inkMute} />
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Tiers</h2>
              <HDPill tone="neutral" icon={false} size="sm" label={String(p.tiers.length)} />
            </header>
            {p.tiers.length === 0
              ? <p style={{ margin: 0, padding: '20px', fontSize: 12.5, color: P.inkMute }}>No tiers configured — points-only program.</p>
              : <HDTable>
                <thead><tr><TH width={48}>Rank</TH><TH>Tier</TH><TH>Threshold</TH><TH align="right">Members</TH><TH>Perks</TH></tr></thead>
                <tbody>
                  {p.tiers.map((t, i) => (
                    <TR key={t.name}>
                      <TD mono style={{ fontSize: 11.5 }}>{i + 1}</TD>
                      <TD style={{ fontWeight: 500 }}>{t.name}</TD>
                      <TD mono style={{ color: P.inkDim }}>{HD.formatNumber(t.threshold)} pts</TD>
                      <TD align="right" mono>{HD.formatNumber(t.members)}</TD>
                      <TD style={{ fontSize: 11.5, color: P.inkMute }}>{t.perks.join(' · ')}</TD>
                    </TR>))}
                </tbody>
              </HDTable>}
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="gift" size={14} stroke={2} color={P.inkMute} />
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Rewards</h2>
              <HDPill tone="neutral" icon={false} size="sm" label={String(p.rewards.length)} />
            </header>
            {p.rewards.length === 0
              ? <p style={{ margin: 0, padding: 20, fontSize: 12.5, color: P.inkMute }}>No rewards configured yet.</p>
              : <HDTable>
                <thead><tr><TH>Reward</TH><TH align="right">Cost</TH><TH align="right">Redeemed · 30d</TH><TH>Status</TH></tr></thead>
                <tbody>
                  {p.rewards.map((r) => (
                    <TR key={r.id}>
                      <TD style={{ fontWeight: 500 }}>{r.name}</TD>
                      <TD align="right" mono>{r.cost === 0 ? 'auto' : `${HD.formatNumber(r.cost)} pts`}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatNumber(r.redeemed30d)}</TD>
                      <TD><HDPill tone={r.status === 'active' ? 'ok' : r.status === 'automatic' ? 'info' : 'warn'} icon={false} size="sm" label={r.status} /></TD>
                    </TR>))}
                </tbody>
              </HDTable>}
          </Card>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Activity</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Loyalty events scoped to this program — credits and debits carry the per-wallet programId tag.</p>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {events.map(([label, tone, meta, at]) => (
              <li key={label + at} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12.5 }}>
                <HDPill tone={tone} icon={false} size="sm" label={label} />
                <span style={{ color: P.inkDim, fontFamily: P.fontMono, fontSize: 11.5 }}>{meta}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute }}>{HD.relativeTime(at)}</span>
              </li>))}
          </ul>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Top wallets · by balance</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Top 10 wallets right now. Click any row to drill into the customer profile.</p>
            </div>
            <span style={{ fontSize: 11.5, color: P.inkMute }}>of {HD.formatNumber(p.members)}</span>
          </header>
          <HDTable>
            <thead><tr><TH>Customer</TH><TH align="right">Balance</TH><TH align="right">Lifetime earned</TH><TH align="right">Lifetime spent</TH><TH width={32}></TH></tr></thead>
            <tbody>
              {wallets.map((w) => (
                <TR key={w.id} onClick={() => navigate(`#/customers/${w.id}`)}>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ height: 26, width: 26, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{w.initials}</span>
                      <div>
                        <div style={{ fontWeight: 500, color: P.ink }}>{w.name}</div>
                        <div style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{w.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </TD>
                  <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatNumber(w.pointsBalance)}</TD>
                  <TD align="right" mono style={{ color: HD.tone(P, 'ok').fg }}>{HD.formatNumber(w.lifetimeEarned)}</TD>
                  <TD align="right" mono style={{ color: P.inkMute }}>{HD.formatNumber(w.lifetimeSpent)}</TD>
                  <TD><Icon name="arrow-right" size={14} stroke={2} color={P.inkMute} /></TD>
                </TR>))}
            </tbody>
          </HDTable>
        </Card>
      </div>);
  };

  // ── Referrals dashboard ─────────────────────────────────────────────────
  window.ScreenReferrals = function ScreenReferrals({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const refs = D.REFERRALS;
    const totalInvites = refs.length * 38;
    const completed = refs.filter((r) => r.status === 'completed').length * 38;
    const qualified = Math.round(completed * 1.35);
    const fraud = refs.filter((r) => r.status === 'fraud_flagged').length * 38;
    const pending = totalInvites - completed - qualified - fraud;
    const funnel = [
      { state: 'pending', label: 'Pending', count: Math.max(0, pending) },
      { state: 'qualified', label: 'Qualified', count: qualified },
      { state: 'completed', label: 'Completed', count: completed },
      { state: 'rejected_fraud', label: 'Rejected · fraud', count: fraud },
    ];
    const leaders = [...D.CUSTOMERS].slice(0, 8).map((c, i) => ({ ...c, completed: 24 - i * 2, qualified: 30 - i * 2, pointsEarned: (24 - i * 2) * 1000 }));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Referrals</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Dual-sided referral attribution with anti-fraud signals. Aggregated live from the attribution graph; rewards land in the loyalty ledger as <code style={{ fontFamily: P.fontMono, background: P.surface3, borderRadius: 3, padding: '1px 4px' }}>campaign_bonus</code>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="shield" onClick={() => navigate('#/referrals/fraud')}>Fraud review</PBtn>
            <PBtn size="sm" variant="accent" icon="sparkle" onClick={() => navigate('#/referrals/programs')}>Configure programs</PBtn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="teal" icon="users" label="Total invites" value={HD.formatNumber(totalInvites)} sub="last 30 days" />
          <StatTile hue="green" icon="target" label="Completed" value={HD.formatNumber(completed)} sub={`${HD.formatNumber(qualified)} qualified`} />
          <StatTile hue="pink" icon="trending-up" label="Conversion" value={HD.formatPercent(completed / totalInvites, 1)} sub="completed / total invites" />
          <StatTile hue="violet" icon="gift" label="Points granted" value={HD.formatNumber(completed * 1000)} sub="across referrer + referee grants" />
        </div>

        {fraud > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: `1px solid ${HD.tone(P, 'blocked').fg}55`, background: HD.tone(P, 'blocked').bg, padding: 12, fontSize: 12.5, color: HD.tone(P, 'blocked').fg }}>
            <Icon name="shield" size={15} stroke={2} />
            <span><strong>{HD.formatNumber(fraud)}</strong> attributions flagged as fraud — review the audit log on each before granting rewards.</span>
            <PBtn size="xs" variant="ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('#/referrals/fraud')}>Open review →</PBtn>
          </div>)}

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Funnel</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Conversion across attribution states. Same row counts as the state filter on each customer.</p>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {funnel.map((s, i) => {
              const pct = (s.count / totalInvites) * 100;
              const color = s.state === 'completed' ? HD.tone(P, 'ok').fg : s.state === 'rejected_fraud' ? HD.tone(P, 'blocked').fg : P.accent;
              return (
                <li key={s.state} style={{ padding: '14px 20px', borderLeft: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{s.label}</div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, color: P.ink }}>{HD.formatNumber(s.count)}</span>
                    <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color }} />
                  </div>
                </li>);
            })}
          </ul>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Top referrers</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Leaderboard by completed attributions; ties broken by qualified count.</p>
          </header>
          <HDTable>
            <thead><tr><TH>Referrer</TH><TH align="right">Completed</TH><TH align="right">Qualified</TH><TH align="right">Points earned</TH><TH width={32}></TH></tr></thead>
            <tbody>
              {leaders.map((r, i) => (
                <TR key={r.id} onClick={() => navigate(`#/customers/${r.id}`)}>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ height: 26, width: 26, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{r.initials}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i < 3 && <HDPill tone="neutral" icon={false} size="sm" label={`#${i + 1}`} />}
                        <div>
                          <div style={{ fontWeight: 500, color: P.ink }}>{r.name}</div>
                          <div style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{r.id.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD align="right" mono style={{ fontWeight: 600 }}>{r.completed}</TD>
                  <TD align="right" mono style={{ color: P.inkMute }}>{r.qualified}</TD>
                  <TD align="right" mono>{HD.formatNumber(r.pointsEarned)}</TD>
                  <TD><Icon name="arrow-right" size={14} stroke={2} color={P.inkMute} /></TD>
                </TR>))}
            </tbody>
          </HDTable>
        </Card>
      </div>);
  };

  // ── Referral programs ───────────────────────────────────────────────────
  window.ScreenReferralPrograms = function ScreenReferralPrograms({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [programs, setPrograms] = React.useState(D.REFERRAL_PROGRAMS);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <button onClick={() => navigate('#/referrals')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Referrals
          </button>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Referral programs</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute }}>Both sides of the reward, the qualification rule, and the payout cap. Changing a live program only affects new attributions.</p>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {programs.map((p) => (
            <li key={p.id}>
              <Card padding={20} style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>{p.name}</h2>
                  <HDPill tone={p.status === 'active' ? 'ok' : 'warn'} icon={false} size="sm" label={p.status} />
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  {[['Advocate gets', p.advocateReward], ['Friend gets', p.friendReward], ['Qualifies on', 'first completed order ≥ $40'], ['Payout cap', '$50 / advocate / month']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: P.inkMute }}>{k}</span><span style={{ color: P.ink, textAlign: 'right' }}>{v}</span>
                    </div>))}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}`, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[['Referrals · 30d', HD.formatNumber(p.referrals30d)], ['Completed', HD.formatNumber(p.completed30d)], ['Revenue', HD.formatCents(p.revenueCents, { showCents: false })], ['Payout', HD.formatCents(p.payoutCents, { showCents: false })]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{l}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: P.fontMono, color: P.ink }}>{v}</div>
                    </div>))}
                </div>
                {p.fraudFlagged30d > 0 && <p style={{ margin: '12px 0 0', fontSize: 11.5, color: HD.tone(P, 'warn').fg }}>{p.fraudFlagged30d} flagged for fraud in the last 30 days</p>}
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <PBtn size="sm" variant="secondary" icon="pencil" full>Edit rules</PBtn>
                  <PBtn size="sm" variant="ghost" icon={p.status === 'active' ? 'pause' : 'play'}
                    onClick={() => setPrograms((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: x.status === 'active' ? 'paused' : 'active' } : x)))} />
                </div>
              </Card>
            </li>))}
        </ul>
      </div>);
  };

  // ── Referral fraud review ───────────────────────────────────────────────
  window.ScreenReferralFraud = function ScreenReferralFraud({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [decided, setDecided] = React.useState({});
    const flagged = D.REFERRALS.filter((r) => r.status === 'fraud_flagged' || r.riskScore > 0.35);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <button onClick={() => navigate('#/referrals')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Referrals
          </button>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Fraud review</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute }}>Attributions the anti-fraud scorer held back. Approving grants both rewards; rejecting writes a suppression and keeps the audit trail.</p>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Code</TH><TH>Advocate → Friend</TH><TH align="right">Risk</TH><TH>Signals</TH><TH align="right">First order</TH><TH>Attributed</TH><TH align="right">Decision</TH></tr></thead>
              <tbody>
                {flagged.map((r) => {
                  const d = decided[r.id];
                  const riskTone = r.riskScore > 0.7 ? 'blocked' : r.riskScore > 0.45 ? 'warn' : 'neutral';
                  return (
                    <TR key={r.id}>
                      <TD mono style={{ fontSize: 11.5 }}>{r.code}</TD>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                          <span style={{ color: P.ink }}>{r.advocateName}</span>
                          <Icon name="arrow-right" size={11} stroke={2} color={P.inkMute} />
                          <span style={{ color: P.ink2 }}>{r.friendName}</span>
                        </div>
                      </TD>
                      <TD align="right"><HDPill tone={riskTone} icon={false} size="sm" label={r.riskScore.toFixed(2)} /></TD>
                      <TD style={{ fontSize: 11.5, color: P.inkMute }}>{r.riskReasons.length ? r.riskReasons.join(' · ') : 'velocity heuristic'}</TD>
                      <TD align="right" mono>{r.firstOrderCents ? HD.formatCents(r.firstOrderCents) : '—'}</TD>
                      <TD style={{ fontSize: 11.5, color: P.inkDim }}>{HD.relativeTime(r.attributedAt)}</TD>
                      <TD align="right">
                        {d
                          ? <HDPill tone={d === 'approved' ? 'ok' : 'blocked'} icon={false} size="sm" label={d} />
                          : <div style={{ display: 'inline-flex', gap: 6 }}>
                            <PBtn size="xs" variant="secondary" onClick={() => { setDecided((s) => ({ ...s, [r.id]: 'approved' })); window.hdToast?.({ title: 'Referral approved', description: 'Both rewards granted to the loyalty ledger.', tone: 'ok' }); }}>Approve</PBtn>
                            <PBtn size="xs" variant="ghost" onClick={() => { setDecided((s) => ({ ...s, [r.id]: 'rejected' })); window.hdToast?.({ title: 'Referral rejected', description: 'Suppression written · advocate notified.', tone: 'warn' }); }}>Reject</PBtn>
                          </div>}
                      </TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };

  // ── Wallet passes ───────────────────────────────────────────────────────
  window.ScreenWallet = function ScreenWallet({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const w = D.WALLET_PASSES;
    const apple = Math.round(w.installed * w.appleShare), google = w.installed - apple;
    const regs = D.CUSTOMERS.slice(0, 8).map((c, i) => ({ ...c, serialNumber: `GL-${c.id.slice(0, 8).toUpperCase()}`, provider: i % 3 === 0 ? 'google' : 'apple', registeredAt: D.ago(D.range(5, 900)), unregisteredAt: i === 5 ? D.ago(200) : null }));
    const passes = D.CUSTOMERS.slice(8, 16).map((c, i) => ({ ...c, loyaltyCode: `GL${c.id.slice(0, 6).toUpperCase()}`, activeDeviceCount: i % 4 === 0 ? 0 : (i % 3) + 1, updatedAt: D.ago(D.range(2, 600)) }));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Wallet passes</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Apple Wallet + Google Wallet pass issuance and device registrations. Each pass gets a per-customer serial; APNs silent pushes update the barcode and points balance in real time.
            </p>
          </div>
          <PBtn size="sm" variant="secondary" icon="credit-card" disabled>Design pass</PBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <StatTile hue="blue" icon="wallet" label="Total passes" value={HD.formatNumber(w.installed)} sub={`latest ${HD.relativeTime(w.lastPushAt)}`} />
          <StatTile hue="green" icon="smartphone" label="Active devices" value={HD.formatNumber(Math.round(w.installed * 0.91))} sub={`last APNs push ${HD.relativeTime(w.lastPushAt)}`} />
          <StatTile hue="violet" icon="smartphone" label="Apple" value={HD.formatNumber(apple)} sub={`${HD.formatPercent(w.appleShare, 0)} of active`} />
          <StatTile hue="teal" icon="smartphone" label="Google" value={HD.formatNumber(google)} sub={`${HD.formatPercent(w.googleShare, 0)} of active`} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: `1px solid ${HD.tone(P, 'warn').fg}55`, background: HD.tone(P, 'warn').bg, padding: 12, fontSize: 12.5, color: HD.tone(P, 'warn').fg }}>
          <Icon name="user-off" size={15} stroke={2} />
          <span><strong>{HD.formatNumber(w.staleOver7d)}</strong> passes haven't refreshed in 7+ days (soft-deleted registrations are kept for audit). Watch for spikes — typically signals a pass-design or content issue.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="users" size={14} stroke={2} color={P.inkMute} />Recent registrations
                <HDPill tone="neutral" icon={false} size="sm" label={String(regs.length)} />
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Newest device adds and removes (last 25).</p>
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {regs.map((r) => (
                <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12.5 }}>
                  <button onClick={() => navigate(`#/customers/${r.id}`)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                    <span style={{ height: 26, width: 26, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }}>{r.initials}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500, color: P.ink }}>{r.name}</span>
                      <span style={{ display: 'block', fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{r.serialNumber}</span>
                    </span>
                  </button>
                  <HDPill tone={r.provider === 'apple' ? 'brand' : 'info'} icon={false} size="sm" label={r.provider === 'apple' ? 'Apple' : 'Google'} />
                  {r.unregisteredAt ? <HDPill tone="warn" icon={false} size="sm" label="removed" /> : <span style={{ fontSize: 10, color: P.inkMute }}>{HD.relativeTime(r.registeredAt)}</span>}
                </li>))}
            </ul>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="credit-card" size={14} stroke={2} color={P.inkMute} />Recent passes
                <HDPill tone="neutral" icon={false} size="sm" label={String(passes.length)} />
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Newest pass_state rows; updates fire on every loyalty event.</p>
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {passes.map((p) => (
                <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12.5 }}>
                  <button onClick={() => navigate(`#/customers/${p.id}`)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                    <span style={{ height: 26, width: 26, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }}>{p.initials}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500, color: P.ink }}>{p.name}</span>
                      <span style={{ display: 'block', fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{p.loyaltyCode}</span>
                    </span>
                  </button>
                  {p.activeDeviceCount > 0
                    ? <HDPill tone="ok" icon={false} size="sm" label={`${p.activeDeviceCount} device${p.activeDeviceCount === 1 ? '' : 's'}`} />
                    : <HDPill tone="neutral" icon={false} size="sm" label="unregistered" />}
                  <span style={{ fontSize: 10, color: P.inkMute }}>{HD.relativeTime(p.updatedAt)}</span>
                </li>))}
            </ul>
          </Card>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Passes by store</h2>
          </header>
          <HDTable>
            <thead><tr><TH>Store</TH><TH align="right">Installed</TH><TH align="right">Active</TH><TH>Health</TH></tr></thead>
            <tbody>
              {w.byStore.map((s) => {
                const rate = s.active / s.installed;
                return (
                  <TR key={s.store}>
                    <TD>{s.store}</TD>
                    <TD align="right" mono>{HD.formatNumber(s.installed)}</TD>
                    <TD align="right" mono>{HD.formatNumber(s.active)}</TD>
                    <TD>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 90, height: 5, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${rate * 100}%`, background: rate > 0.9 ? HD.tone(P, 'ok').fg : HD.tone(P, 'warn').fg }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.inkMute }}>{HD.formatPercent(rate, 0)} active</span>
                      </div>
                    </TD>
                  </TR>);
              })}
            </tbody>
          </HDTable>
        </Card>

        <Card padding={16} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : P.accentBorder }}>
            <Icon name="trending-up" size={12} stroke={2} />How updates flow
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: P.ink2, lineHeight: 1.55 }}>
            Loyalty events (points credited / tier entered / reward granted) fire the wallet-pass-updater worker, which rewrites <code style={{ fontFamily: P.fontMono, background: P.surface3, borderRadius: 3, padding: '1px 4px' }}>pass_state.pass_json</code> and sends an APNs silent push to every active Apple registration. Google passes update via the JWT-signed payload on the next device fetch. No customer PII flows through the pass payload.
          </p>
        </Card>
      </div>);
  };
})();
