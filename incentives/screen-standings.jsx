// ── incentives/screen-standings.jsx ── #/ — the bounty board, two readings ──
// Design: explorations/Incentives - Concept D - Two Seats.html, tab "2 ·
// Standings" (both the seat and the console panes), with Concept B's
// computation trail folded in (Incentives - Concept B - Ledger.html, tab 2
// detail panel's "How this was computed" disclosure). Plan:
// docs/INCENTIVES-PLAN-2026-09-07.md §5. Contract: docs/BOUNTY-API-CONTRACT.md
// (GET /api/incentives/me, GET /api/incentives/standings).
//
// TWO READINGS OF THE SAME LEDGER, NOT TWO SCREENS. A budtender is told where
// they stand relative to two people and what to do about it; a manager is
// shown the whole table plus what the table cannot see (the unattributed row,
// the not-yet list, the trail). incentives/app.jsx decides which SHELL frame
// (SeatFrame vs ConsoleFrame) wraps this screen, and forwards that verdict
// straight to every routed screen as props: `{ navigate, query, route, path,
// session, isManager, previewing, seat: 'console'|'seat', me }` — `me` is the
// shell's own app-wide /api/incentives/me poll (`{loading, error, data,
// refresh}`), so this screen neither re-derives role from HWInc.session() nor
// opens a second /me poll of its own. `seat === 'seat'` already accounts for
// a manager previewing the budtender seat (app.jsx sets it, not this file),
// so the console-vs-seat choice below is a straight prop read, not a
// measured width.
;(function () {
  const useP = window.useP;
  const HWInc = window.HWInc;
  const IncShared = window.IncShared;

  // ── metric vocabulary — exactly the Standing.value_kind enum, no more ────
  const METRIC_LABEL = { net_cents: 'Net', units: 'Units', gross_cents: 'Gross', txn_count: 'Orders', aov_cents: 'AOV' };
  const METRIC_OPTIONS = [
    { value: 'net_cents', label: 'Net' }, { value: 'units', label: 'Units' },
    { value: 'gross_cents', label: 'Gross' }, { value: 'txn_count', label: 'Orders' },
    { value: 'aov_cents', label: 'AOV' },
  ];
  function formatMetricLabel(metric) { return METRIC_LABEL[metric] || metric; }
  function formatMetricValue(metric, value) {
    if (value == null) return '—';
    if (metric === 'units') return HWInc.fmt.number(value) + ' units';
    if (metric === 'txn_count') return HWInc.fmt.number(value) + ' orders';
    return HWInc.fmt.cents(value);
  }

  // ── small local composites (kept local per brief — inc-shared.jsx is not
  // to be extended unless told to) ─────────────────────────────────────────
  function CardHead({ icon, title, right }) {
    const P = useP();
    return (
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name={icon} size={15} color={P.ink2} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
        {right}
      </div>);
  }

  function MovementGlyph({ movement }) {
    const P = useP();
    if (movement > 0) return <span style={{ color: P.good, fontWeight: 700 }}>▲</span>;
    if (movement < 0) return <span style={{ color: P.bad, fontWeight: 700 }}>▼</span>;
    return <span style={{ color: P.inkFaint, fontWeight: 700 }}>—</span>;
  }

  function RankCell({ standing }) {
    const P = useP();
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 13, color: P.ink, minWidth: 14, display: 'inline-block' }}>{standing.rank != null ? standing.rank : '—'}</span>
        <MovementGlyph movement={standing.movement} />
        {standing.tied && <Pill kind="neutral" size="sm">tied</Pill>}
      </span>);
  }

  // The computation trail (Concept B, tab 2): gross -> refunds -> net ->
  // attributed + unattributed, plus window and sources. Native
  // <details>/<summary> — matches Concept B's own `disc`/`disc-body`
  // construction, no new atom needed.
  function ComputationTrail({ trail }) {
    const P = useP();
    if (!trail) return null;
    const row = (label, note, value, opts) => {
      const o = opts || {};
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0', borderTop: o.sum ? `1px solid ${P.hairline2}` : 'none' }}>
          <span style={{ color: o.warn ? P.warnText : P.ink2, fontWeight: o.sum ? 700 : 500 }}>
            {label}{note && <span style={{ marginLeft: 8, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{note}</span>}
          </span>
          <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontWeight: o.sum ? 700 : 500, color: o.neg ? P.bad : o.warn ? P.warnText : P.ink }}>{value}</span>
        </div>);
    };
    return (
      <details style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '2px 14px' }}>
        <summary style={{ padding: '9px 0', fontSize: 12.5, fontWeight: 700, color: P.ink2, cursor: 'pointer' }}>How this was computed</summary>
        <div style={{ paddingBottom: 12 }}>
          {row('Gross sales', `${HWInc.fmt.number(trail.txns)} sale rows`, HWInc.fmt.cents(trail.gross_cents))}
          {row('Refunds netted', `${HWInc.fmt.number(trail.refunds)} refund rows`, '−' + HWInc.fmt.cents(trail.refund_cents), { neg: true })}
          {row('Net counted', null, HWInc.fmt.cents(trail.net_cents), { sum: true })}
          {row('Attributed to a budtender', null, HWInc.fmt.cents(trail.attributed_cents))}
          {row('No budtender on the record', null, HWInc.fmt.cents(trail.unattributed_cents), { warn: true })}
          <div style={{ marginTop: 8, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>
            {trail.window && `${HWInc.fmt.date(trail.window.from)} → ${HWInc.fmt.date(trail.window.to)} · `}
            sources: {(trail.sources || []).join(', ') || 'none'}
          </div>
        </div>
      </details>);
  }

  // ══════════════════════════════════════════════════════════════════════
  // BUDTENDER SEAT — "My day"
  // ══════════════════════════════════════════════════════════════════════

  function RankHero({ today }) {
    const P = useP();
    const rs = (today && today.rank_store) || {};
    const ra = (today && today.rank_all) || {};
    return (
      <Card padding={0}>
        <CardHead icon="trophy" title="My rank · this store · today" />
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: P.fontMono, fontSize: 52, fontWeight: 800, color: P.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {rs.rank != null ? rs.rank : '—'}
              </span>
              {rs.of != null && <span style={{ fontSize: 14, fontWeight: 600, color: P.inkMute, fontFamily: P.fontMono }}>of {rs.of}</span>}
            </div>
            {rs.tied && <Pill kind="warn" icon="alert">Tied</Pill>}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Net today</div>
              <div style={{ fontFamily: P.fontMono, fontSize: 19, fontWeight: 700, color: P.ink, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{HWInc.fmt.cents(today ? today.net_cents : 0)}</div>
              <div style={{ fontSize: 11, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>{HWInc.fmt.number(today ? today.txns : 0)} orders</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>All stores</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 19, fontWeight: 700, color: P.ink }}>{ra.rank != null ? ra.rank : '—'}</span>
                {ra.of != null && <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>of {ra.of}</span>}
              </div>
              {ra.tied && <Pill kind="neutral" size="sm" style={{ marginTop: 3 }}>tied</Pill>}
            </div>
          </div>
        </div>
      </Card>);
  }

  const AOV_SOURCE_LABEL = { override: 'your override', store_default: 'store default', fallback: 'estate fallback' };
  function AovGoalCard({ today, aovGoal }) {
    const P = useP();
    const goalCents = aovGoal.goal_cents;
    const todayAov = today ? today.aov_cents : 0;
    const pct = goalCents ? Math.min(1, todayAov / goalCents) : 0;
    return (
      <Card padding={0}>
        <CardHead icon="target" title="Average order value" />
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: P.ink }}>
              {aovGoal.met && <Icon name="check-circle" size={16} color={P.good} />}
              {aovGoal.met ? 'AOV goal met' : `Add ${HWInc.fmt.cents(aovGoal.gap_cents)} to hit today's goal`}
            </span>
            <span style={{ fontFamily: P.fontMono, fontSize: 13, fontWeight: 700, color: P.ink2, fontVariantNumeric: 'tabular-nums' }}>
              {HWInc.fmt.cents(todayAov)} <span style={{ color: P.inkMute, fontWeight: 500 }}>/</span> {HWInc.fmt.cents(goalCents)}
            </span>
          </div>
          <BarMeter value={pct} color={aovGoal.met ? P.good : P.info} height={8} />
          <div style={{ marginTop: 7, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{AOV_SOURCE_LABEL[aovGoal.source] || aovGoal.source}</div>
        </div>
      </Card>);
  }

  function NeighborsCard({ neighbors, sessionId }) {
    const P = useP();
    const sorted = [...(neighbors || [])].sort((a, b) => (a.rank == null ? 999 : a.rank) - (b.rank == null ? 999 : b.rank));
    const kind = sorted.length ? sorted[0].value_kind : null;
    return (
      <Card padding={0}>
        <CardHead icon="chart" title="Either side of you" right={kind && <Pill kind="neutral" size="sm">{formatMetricLabel(kind)} · today</Pill>} />
        <div>
          {sorted.map((n, i) => {
            const isMe = n.associate_id === sessionId;
            return (
              <div key={n.associate_id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
                borderTop: i ? `1px solid ${P.hairline}` : 'none', background: isMe ? P.accentSoft : 'transparent' }}>
                <span style={{ width: 16, textAlign: 'right', fontFamily: P.fontMono, fontWeight: 700, color: P.inkDim, flex: '0 0 auto' }}>{n.rank != null ? n.rank : '—'}</span>
                <Avatar name={n.name} size={26} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isMe ? 'You' : n.name}</span>
                  {n.tied && <Pill kind="accent" size="sm">tied</Pill>}
                </span>
                <span style={{ fontFamily: P.fontMono, fontWeight: 700, fontSize: 13, color: P.ink2, flex: '0 0 auto' }}>{formatMetricValue(n.value_kind, n.value)}</span>
              </div>);
          })}
        </div>
      </Card>);
  }

  function BountiesCard({ bounties }) {
    const P = useP();
    return (
      <Card padding={0}>
        <CardHead icon="award" title="My bounties" right={<Pill kind="neutral" size="sm">{(bounties || []).length} running</Pill>} />
        {(!bounties || bounties.length === 0) ? (
          <EmptyState compact icon="trophy" title="No bounties running right now" body="New bounties from your manager or a brand will show up here." />
        ) : bounties.map((b) => (
          <IncShared.ProgressRow key={b.id} title={b.name}
            valueLabel={b.my && b.my.rank != null ? `#${b.my.rank}` : (b.my ? formatMetricValue(b.my.value_kind, b.my.value) : null)}
            pct={b.my ? b.my.progress : 0}
            color={b.funded_by === 'brand' ? P.accent : P.info}
            sub={`${b.reward_summary || ''}${b.my && b.my.tied ? ' · tied' : ''} · ends ${HWInc.fmt.relative(b.ends_at)} · ${b.funded_by === 'brand' ? (b.brand ? b.brand + '-funded' : 'brand-funded') : 'store-funded'}`}
          />))}
      </Card>);
  }

  // Projected vs settled — the two figures never sum (plan §5.3 / brief).
  function BalanceLineCard({ earnings, navigate }) {
    const P = useP();
    return (
      <Card padding={0}>
        <CardHead icon="coins" title="My balance" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 16px 6px' }}>
          <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Settled</div>
            <div style={{ fontFamily: P.fontMono, fontSize: 19, fontWeight: 700, color: P.good, marginTop: 3 }}>{HWInc.fmt.cents(earnings.settled_cents)}</div>
          </div>
          <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Projected</div>
            <div style={{ fontFamily: P.fontMono, fontSize: 19, fontWeight: 700, color: P.ink2, marginTop: 3 }}>{HWInc.fmt.cents(earnings.projected_cents)}</div>
          </div>
        </div>
        <div style={{ padding: '2px 16px 10px', fontSize: 11, color: P.inkMute, lineHeight: 1.5 }}>
          Settled and projected are never added together — projected is what the rules say you're on track for, not what you're owed yet.
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <PBtn variant="secondary" size="lg" full onClick={() => navigate('#/earnings')}>Open my ledger</PBtn>
        </div>
      </Card>);
  }

  function MyDay({ session, navigate, me }) {
    const P = useP();

    if (me.error) return <IncShared.NotConnected onRetry={me.refresh} />;
    if (me.loading || !me.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding={0}>
            <CardHead icon="trophy" title="My rank · this store · today" />
            <div style={{ padding: 16 }}><SkeletonRows rows={2} avatar={false} /></div>
          </Card>
          <SkeletonRows rows={3} />
        </div>);
    }

    const d = me.data;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RankHero today={d.today} />
        {d.aov_goal && <AovGoalCard today={d.today} aovGoal={d.aov_goal} />}
        {d.today && d.today.neighbors && d.today.neighbors.length > 0 && <NeighborsCard neighbors={d.today.neighbors} sessionId={session.id} />}
        <BountiesCard bounties={d.bounties} />
        {d.earnings && <BalanceLineCard earnings={d.earnings} navigate={navigate} />}
        <IncShared.SourceFreshness sources={d.sources} />
      </div>);
  }

  // ══════════════════════════════════════════════════════════════════════
  // MANAGER CONSOLE — the full bounty board
  // ══════════════════════════════════════════════════════════════════════

  function standingsPath({ scope, period, metric, from, to, storeId }) {
    const p = new URLSearchParams();
    p.set('scope', scope); p.set('store_id', storeId || ''); p.set('period', period); p.set('metric', metric);
    if (period === 'custom') { if (from) p.set('from', from); if (to) p.set('to', to); }
    return '/api/incentives/standings?' + p.toString();
  }

  function PersonBoard({ data, metric, sessionId, navigate }) {
    const P = useP();
    const ranked = data.ranked || [];
    const top = ranked.length ? ranked[0].value : 0;
    const columns = [
      { key: 'rank', label: 'Rank', width: 80, render: (r) => <RankCell standing={r} /> },
      { key: 'person', label: 'Budtender', render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <Avatar name={r.name} size={26} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: P.ink }}>
              {r.associate_id === sessionId ? 'You' : r.name}
              {r.associate_id === sessionId && <Pill kind="neutral" size="sm">you</Pill>}
            </div>
            {data.scope !== 'store' && r.store_name && <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{r.store_name}</div>}
          </div>
        </div>) },
      { key: 'value', label: formatMetricLabel(metric), align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink2 }}>{formatMetricValue(metric, r.value)}</span> },
      { key: 'progress', label: 'Share of top', width: 150, render: (r) => <BarMeter value={top ? r.value / top : 0} color={r.associate_id === sessionId ? P.accent : P.info} height={7} /> },
    ];
    return (
      <>
        <DataTable columns={columns} rows={ranked} rowKey={(r) => r.associate_id} dense />
        {data.unattributed && data.unattributed.txns > 0 && (
          <div onClick={() => navigate('#/data')} role="button" tabIndex={0}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: P.warnSoft, border: `1px solid ${P.warn}`, borderRadius: P.r10, cursor: 'pointer' }}>
            <Icon name="alert" size={15} color={P.warnText} />
            <span style={{ flex: 1, fontSize: 12.5, color: P.warnText }}>
              <b>No budtender on the record</b> — {HWInc.fmt.number(data.unattributed.txns)} sales · {HWInc.fmt.cents(data.unattributed.cents)} · counted in the total, not in anyone's rank
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: P.info, display: 'inline-flex', alignItems: 'center', gap: 3, flex: '0 0 auto' }}>
              Resolve identities<Icon name="chevron-right" size={12} stroke={2} />
            </span>
          </div>)}
        {data.not_yet && data.not_yet.length > 0 && (
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, padding: '0 2px', lineHeight: 1.6 }}>
            {data.not_yet.map((p) => p.name).join(' · ')} {data.not_yet.length === 1 ? 'has' : 'have'} no sales yet in this window — listed, not ranked at zero.
          </div>)}
      </>);
  }

  function StoreVsStoreTable({ stores, metric }) {
    const P = useP();
    const columns = [
      { key: 'rank', label: 'Rank', width: 70, render: (r) => r.counted
        ? <span style={{ fontFamily: P.fontMono, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{r.rank}{r.tied && <Pill kind="neutral" size="sm">tied</Pill>}</span>
        : <span style={{ fontFamily: P.fontMono, color: P.inkFaint }}>—</span> },
      { key: 'store', label: 'Store', render: (r) => <span style={{ fontWeight: 700, color: P.ink }}>{r.store_name}</span> },
      { key: 'value', label: formatMetricLabel(metric), align: 'right', render: (r) => r.counted
        ? <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink2 }}>{formatMetricValue(metric, r.value)}</span>
        : <span style={{ fontFamily: P.fontMono, color: P.inkFaint }}>—</span> },
      { key: 'status', label: 'Source', render: (r) => r.counted
        ? <Pill kind="good" size="sm" dot>counted</Pill>
        : <Pill kind="neutral" size="sm">{r.reason || 'not counted'}</Pill> },
    ];
    return <DataTable columns={columns} rows={stores || []} rowKey={(r) => r.store_id} dense />;
  }

  function BoardBody({ data, scope, metric, sessionId, navigate }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <IncShared.SourceFreshness sources={data.sources} />
        {scope === 'stores'
          ? <StoreVsStoreTable stores={data.stores} metric={metric} />
          : <PersonBoard data={data} metric={metric} sessionId={sessionId} navigate={navigate} />}
        <ComputationTrail trail={data.trail} />
      </div>);
  }

  function BountyBoard({ session, navigate }) {
    const P = useP();
    const [scope, setScope] = React.useState('store');
    const [period, setPeriod] = React.useState('today');
    const [metric, setMetric] = React.useState('net_cents');
    const todayISO = new Date().toISOString().slice(0, 10);
    const [from, setFrom] = React.useState(todayISO);
    const [to, setTo] = React.useState(todayISO);

    const path = standingsPath({ scope, period, metric, from, to, storeId: session.storeId });
    const st = HWInc.usePoll(path, { intervalMs: 20000 });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: P.ink }}>Standings</h2>
            <div style={{ marginTop: 4, fontSize: 12.5, color: P.inkDim, maxWidth: 560, lineHeight: 1.5 }}>
              Competition ranking — a tie takes the same place and the next place is skipped. Nobody with no sales yet is ranked last at zero.
            </div>
          </div>
          <PBtn size="sm" variant="secondary" icon="refresh" onClick={st.refresh}>Refresh</PBtn>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Seg value={scope} onChange={setScope} size="sm" options={[
            { value: 'store', label: 'This store' }, { value: 'all', label: 'All stores' }, { value: 'stores', label: 'Store vs store' },
          ]} />
          <Seg value={period} onChange={setPeriod} size="sm" options={[
            { value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'custom', label: 'Custom' },
          ]} />
          <Seg value={metric} onChange={setMetric} size="sm" options={METRIC_OPTIONS} />
          {period === 'custom' && (
            <>
              <Field type="date" size="sm" value={from} onChange={(e) => setFrom(e.target.value)} full={false} style={{ width: 150 }} />
              <Field type="date" size="sm" value={to} onChange={(e) => setTo(e.target.value)} full={false} style={{ width: 150 }} />
            </>)}
        </div>

        {st.error && <IncShared.NotConnected onRetry={st.refresh} />}
        {!st.error && (st.loading || !st.data) && <SkeletonRows rows={5} />}
        {!st.error && st.data && <BoardBody data={st.data} scope={scope} metric={metric} sessionId={session.id} navigate={navigate} />}
      </div>);
  }

  // ── entry point ───────────────────────────────────────────────────────
  window.IncScreenStandings = function IncScreenStandings({ navigate, session, isManager, seat, me }) {
    const showConsole = isManager && seat !== 'seat';
    return (
      <div style={{ width: '100%' }}>
        {showConsole ? <BountyBoard session={session} navigate={navigate} /> : <MyDay session={session} navigate={navigate} me={me} />}
      </div>);
  };
})();
