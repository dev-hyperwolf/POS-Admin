// ── AOV goals & leaderboard ──────────────────────────────────────────────────
// Design: POS-Admin/explorations/AOV Goals & Leaderboard.html (tabs 2-4).
// Backend: wmdemo/associates.py + wmdemo/aov_goals.py + wmdemo/pos_sales.py.
//
// TWO AUDIENCES, ONE SCREEN, LABELLED APART — per the owner's own framing.
// `AovDashboardCard` renders on the Home dashboard (screen-home.jsx) and
// always shows "Your AOV" (the associate view: personal meter, rank within
// this store, rank across all stores, and a lazy full leaderboard). Directly
// under it, ONLY for a Floor Manager (window.HW.STATS.associate.role), a
// second card labelled "Manage · AOV goals" carries the store default,
// per-associate overrides and the audit trail. The two are visually and
// textually separate cards so neither reads as belonging to the other
// audience — an associate who is not a manager never sees the second card at
// all, and a manager sees both because Manisha Saini, this demo's logged-in
// user, is both a manager and the one associate on shift.
//
// LIVE, NOT FABRICATED. Every number here comes from a GET against wmdemo
// (wmdemo/server.py's /api/aov/* routes), which computes it straight out of
// the pos_sales ledger — nothing here is typed in like the old
// `STATS.associate.goal = 90`. On a page with no reachable wmdemo backend
// (the public GitHub Pages demo, hwlive=off) this card says so plainly
// rather than silently showing the pre-live fixture numbers as if they were
// real.
//
// Uses window.HW_LIVE.get/post — the SAME seam shared/hw-live.js already
// established (base resolution: same-origin first, ?hwlive=<loopback>
// override, graceful failure). No new fetch plumbing.

function _live() { return window.HW_LIVE || null; }

function useAovStats(storeId, associateId) {
  const [state, setState] = React.useState({ loading: true, error: null, data: null });
  const load = React.useCallback(() => {
    const live = _live();
    if (!live || !storeId || !associateId) {
      setState({ loading: false, error: 'no-live-seam', data: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    live.get(`/api/aov/stats?store_id=${encodeURIComponent(storeId)}&associate_id=${encodeURIComponent(associateId)}`)
      .then((res) => {
        if (res.ok && res.body) setState({ loading: false, error: null, data: res.body });
        else setState({ loading: false, error: res.error || 'unreachable', data: null });
      });
  }, [storeId, associateId]);
  React.useEffect(() => { load(); }, [load]);
  return { ...state, refresh: load };
}

function useAovGoalsStatus(storeId, enabled) {
  const [state, setState] = React.useState({ loading: true, error: null, data: null });
  const load = React.useCallback(() => {
    const live = _live();
    if (!live || !storeId || !enabled) {
      setState({ loading: false, error: enabled ? 'no-live-seam' : null, data: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    live.get(`/api/aov/goals?store_id=${encodeURIComponent(storeId)}`)
      .then((res) => {
        if (res.ok && res.body) setState({ loading: false, error: null, data: res.body });
        else setState({ loading: false, error: res.error || 'unreachable', data: null });
      });
  }, [storeId, enabled]);
  React.useEffect(() => { load(); }, [load]);
  return { ...state, refresh: load };
}

function useAovHistory(storeId, enabled) {
  const [rows, setRows] = React.useState(null);
  const load = React.useCallback(() => {
    const live = _live();
    if (!live || !storeId || !enabled) { setRows(null); return; }
    live.get(`/api/aov/goals/history?store_id=${encodeURIComponent(storeId)}`)
      .then((res) => { if (res.ok && res.body) setRows(res.body.events || []); });
  }, [storeId, enabled]);
  React.useEffect(() => { load(); }, [load]);
  return { rows, refresh: load };
}

function useAovLeaderboard(scope, storeId, active) {
  const [state, setState] = React.useState({ loading: false, data: null });
  React.useEffect(() => {
    const live = _live();
    if (!live || !active || (scope === 'store' && !storeId)) return;
    setState({ loading: true, data: null });
    const q = scope === 'store'
      ? `scope=store&store_id=${encodeURIComponent(storeId)}&period=day`
      : `scope=all&period=day`;
    live.get(`/api/aov/leaderboard?${q}`).then((res) => {
      setState({ loading: false, data: res.ok ? res.body : null });
    });
  }, [scope, storeId, active]);
  return state;
}

function _money0(cents) { return window.HW.fmt.money0((cents || 0) / 100); }

// Same 5 slugs as wmdemo/associates.py's STORES — display-name lookup only,
// never a second source of truth for which stores exist (the API responses
// already carry store_name on every leaderboard row that needs one).
const AOV_STORE_NAMES = { elsinore: 'Lake Elsinore', 'west-la': 'West Hollywood',
  'long-beach': 'Long Beach', corona: 'Corona', riverside: 'Riverside' };
function _storeName(id) { return AOV_STORE_NAMES[id] || id; }

// ── associate view ──────────────────────────────────────────────────────────
window.AovDashboardCard = function AovDashboardCard() {
  const P = useP();
  const a = window.HW.STATS.associate;
  const storeId = a.storeId, associateId = a.id;
  const isManager = a.role === 'Floor Manager';

  const stats = useAovStats(storeId, associateId);
  const [boardOpen, setBoardOpen] = React.useState(false);
  const [scope, setScope] = React.useState('store');
  const board = useAovLeaderboard(scope, storeId, boardOpen);

  if (stats.loading) {
    // Same header the loaded card will show, so the card doesn't visually
    // "pop" once data lands — only the body resolves from skeleton to real.
    return <Card padding={0}>
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="target" size={15} color={P.ink2} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Your AOV</span>
      </div>
      <div style={{ padding: 16 }}><SkeletonRows rows={2} avatar={false} /></div>
    </Card>;
  }
  if (stats.error || !stats.data) {
    // HONEST DEGRADE. Never fall back to the pre-live fixture numbers here —
    // that would show $81.05/"rank 2 of 6" as if it were real when nothing
    // answered. See module header. ErrorState is the same shared/states.jsx
    // atom every other "backend didn't answer" surface in this app uses
    // (screen-brands.jsx, screen-publish-gate.jsx, …) — this card was
    // hand-rolling its own instead of matching them.
    return (
      <Card padding={0}>
        <ErrorState compact title="AOV goals & leaderboard isn't connected"
          body={`Needs the wmdemo backend — not reachable right now${stats.error && stats.error !== 'no-live-seam' ? ` (${stats.error})` : ''}. Real progress and rank will appear here once it connects.`}
          onRetry={stats.refresh} />
      </Card>);
  }

  const d = stats.data;
  const goalCents = d.goal.goal_cents;
  const todayCents = d.day.aov_cents;
  const gapCents = Math.max(0, goalCents - todayCents);
  const met = todayCents >= goalCents && d.day.orders > 0;
  const pct = goalCents ? Math.min(1, todayCents / goalCents) : 0;
  const meterColor = met ? P.good : P.info;

  // Same ▲/▼ convention as the KPI atom's delta rendering (pos/atoms.jsx) —
  // this card had its own +/- text instead of matching it.
  const Delta = ({ v, label }) => {
    if (v == null) return <span style={{ color: P.inkMute }}>{label}: no prior data</span>;
    const c = v > 0 ? P.good : v < 0 ? P.bad : P.inkMute;
    return <span style={{ color: c, fontWeight: 600 }}>{v > 0 ? '▲' : v < 0 ? '▼' : '—'} {Math.abs(v)}% {label}</span>;
  };

  // Icon distinguishes the two ranking scopes at a glance (home = this store,
  // globe = every store) instead of relying on reading the label text.
  const RankChip = ({ rank, scope: s }) => {
    const [h, setH] = React.useState(false);
    return (
      <button onClick={() => { setScope(s); setBoardOpen(true); }}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
          background: P.surface2, border: `1px solid ${h ? P.hairline3 : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer',
          fontFamily: P.fontSans, textAlign: 'left', boxShadow: h ? P.shadowSm : 'none',
          transition: 'box-shadow .12s ease, border-color .12s ease' }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, flex: '0 0 auto', background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={s === 'store' ? 'home' : 'globe'} size={14} stroke={1.8} />
        </span>
        {rank
          ? <span style={{ fontFamily: P.fontMono, fontSize: 19, fontWeight: 800, color: P.ink, flex: '0 0 auto' }}>
              {rank.rank}<span style={{ fontSize: 11, fontWeight: 600, color: P.inkMute }}>{`/${rank.of}`}</span>
            </span>
          : <span style={{ fontFamily: P.fontMono, fontSize: 15, fontWeight: 700, color: P.inkFaint, flex: '0 0 auto' }}>—</span>}
        <span style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>
            {s === 'store' ? 'Rank · this store' : 'Rank · all stores'}
          </div>
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>
            {rank ? 'today' : 'no sales yet today'}
          </div>
        </span>
      </button>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={0}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="target" size={15} color={P.ink2} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Your AOV</span>
          <Pill kind="neutral" size="sm">{_storeName(storeId)}</Pill>
        </div>
        <div style={{ padding: '14px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15.5, fontWeight: 700, color: P.ink, flex: 1 }}>
              {met && <Icon name="check-circle" size={16} color={P.good} />}
              {met ? 'AOV goal met' : `Add ${_money0(gapCents)} to hit today's goal`}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
              {_money0(todayCents)} <span style={{ color: P.inkMute, fontWeight: 500 }}>/</span> {_money0(goalCents)}
            </span>
          </div>
          <BarMeter value={pct} max={1} color={meterColor} height={8} />
        </div>
        {/* Supporting detail, deliberately uniform now — the hero above is the
            one place this card spends its accent colour and its largest type,
            so "Today" here no longer repeats that emphasis on the same number. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, padding: '0 16px 14px' }}>
          <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderLeft: `3px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Today</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, marginTop: 3 }}>{_money0(todayCents)}</div>
            <div style={{ fontSize: 11, marginTop: 1 }}><Delta v={d.delta_day_vs_trailing7} label="vs 7d avg" /></div>
          </div>
          <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderLeft: `3px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>This week</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, marginTop: 3 }}>{_money0(d.week.aov_cents)}</div>
            <div style={{ fontSize: 11, marginTop: 1 }}><Delta v={d.delta_week_vs_prior} label="vs prior 7d" /></div>
          </div>
          <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderLeft: `3px solid ${P.hairline2}`, borderRadius: P.r10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>This month</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, marginTop: 3 }}>{_money0(d.month.aov_cents)}</div>
            <div style={{ fontSize: 11, marginTop: 1 }}><Delta v={d.delta_month_vs_prior} label="vs prior 30d" /></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 16px 14px', flexWrap: 'wrap' }}>
          <RankChip rank={d.rank_store} scope="store" />
          <RankChip rank={d.rank_all} scope="all" />
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <PBtn variant="secondary" size="sm" iconRight={boardOpen ? 'chevron-up' : 'chevron-down'} onClick={() => setBoardOpen((v) => !v)}>
            {boardOpen ? 'Hide leaderboard' : 'See full leaderboard'}
          </PBtn>
        </div>
        {boardOpen &&
        <div style={{ borderTop: `1px solid ${P.hairline}`, padding: 16 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <PBtn size="sm" icon="home" variant={scope === 'store' ? 'primary' : 'secondary'} onClick={() => setScope('store')}>This store</PBtn>
            <PBtn size="sm" icon="globe" variant={scope === 'all' ? 'primary' : 'secondary'} onClick={() => setScope('all')}>All stores</PBtn>
          </div>
          {board.loading && <SkeletonRows rows={3} avatar={false} />}
          {board.data &&
          // Same bordered/rounded convention as the DataTable atom (header row
          // on surface2, a hairline under it, a hairline between body rows) —
          // this table was hand-styled with different spacing and no border at
          // all, so it read as a different, less-finished surface than every
          // other table in the app.
          <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: P.surface2 }}>
                <th style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, padding: '9px 12px', borderBottom: `1px solid ${P.hairline2}` }}>#</th>
                <th style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, padding: '9px 12px', borderBottom: `1px solid ${P.hairline2}` }}>Associate</th>
                {scope === 'all' && <th style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, padding: '9px 12px', borderBottom: `1px solid ${P.hairline2}` }}>Store</th>}
                <th style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, padding: '9px 12px', borderBottom: `1px solid ${P.hairline2}` }}>AOV today</th>
                <th style={{ textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, padding: '9px 12px', borderBottom: `1px solid ${P.hairline2}` }}>Orders</th>
              </tr>
            </thead>
            <tbody>
              {board.data.ranked.map((r) => (
                <tr key={r.associate_id} style={{ background: r.associate_id === associateId ? P.accentSoft : 'transparent' }}>
                  <td style={{ padding: '9px 12px', fontFamily: P.fontMono, fontWeight: 700, fontSize: 12.5, borderTop: `1px solid ${P.hairline}` }}>
                    {r.rank === 1
                      ? <span style={{ display: 'inline-flex', minWidth: 20, justifyContent: 'center', padding: '2px 6px', borderRadius: 6, background: P.accentSoft, color: P.accentText, fontWeight: 800 }}>{r.rank}</span>
                      : <span style={{ color: P.inkDim }}>{r.rank}</span>}
                  </td>
                  <td style={{ padding: '9px 12px', borderTop: `1px solid ${P.hairline}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Avatar name={r.name} size={22} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                      {r.associate_id === associateId && <Pill kind="neutral" size="sm">you</Pill>}
                    </div>
                  </td>
                  {scope === 'all' && <td style={{ padding: '9px 12px', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, borderTop: `1px solid ${P.hairline}` }}>{r.store_name}</td>}
                  <td style={{ padding: '9px 12px', fontSize: 12.5, color: P.ink2, fontFamily: P.fontMono, borderTop: `1px solid ${P.hairline}` }}>{_money0(r.aov_cents)}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono, borderTop: `1px solid ${P.hairline}` }}>{r.orders}</td>
                </tr>))}
              {board.data.no_sales.length > 0 &&
              <tr><td colSpan={scope === 'all' ? 5 : 4} style={{ padding: '10px 12px', fontSize: 11, color: P.inkFaint, fontFamily: P.fontMono, textAlign: 'center', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
                {board.data.no_sales.length} associate{board.data.no_sales.length > 1 ? 's' : ''} with no sales yet today
              </td></tr>}
            </tbody>
          </table>
          </div>
          </div>}
        </div>}
      </Card>

      {/* A separate zone, not just a separate label. `elevation="sunken"`
          (an existing Card treatment, previously unused anywhere in pos/)
          recedes this card onto a duller fill so it visually reads as
          "a different audience's panel" the instant it's on screen, before a
          manager ever reads the header text — the two cards used to be
          styled identically apart from their copy. */}
      {isManager &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Manager tools</Eyebrow>
        <AovManagerCard storeId={storeId} onGoalChanged={stats.refresh} />
      </div>}
    </div>);
};

// ── manager view ─────────────────────────────────────────────────────────────
function AovManagerCard({ storeId, onGoalChanged }) {
  const P = useP();
  const goals = useAovGoalsStatus(storeId, true);
  const hist = useAovHistory(storeId, true);
  const [editing, setEditing] = React.useState(null); // {associateId|null, value, reason}
  const [busy, setBusy] = React.useState(false);

  const save = () => {
    if (!editing) return;
    const live = _live();
    if (!live) return;
    setBusy(true);
    live.post('/api/aov/goals', {
      store_id: storeId, associate_id: editing.associateId || undefined,
      goal: editing.value, set_by: window.HW.STATS.associate.name,
      reason: editing.reason || null,
    }).then((res) => {
      setBusy(false);
      if (res.ok) { setEditing(null); goals.refresh(); hist.refresh(); onGoalChanged && onGoalChanged(); }
      else alert('Could not save goal: ' + (res.error || 'unknown error'));
    });
  };

  const clearOverride = (associateId) => {
    const live = _live();
    if (!live) return;
    if (!confirm('Clear this override and revert to the store default?')) return;
    live.post('/api/aov/goals/clear', {
      store_id: storeId, associate_id: associateId,
      set_by: window.HW.STATS.associate.name, reason: 'cleared from manager screen',
    }).then((res) => {
      if (res.ok) { goals.refresh(); hist.refresh(); onGoalChanged && onGoalChanged(); }
      else alert('Could not clear override: ' + (res.error || 'unknown error'));
    });
  };

  return (
    <Card padding={0} elevation="sunken">
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="shield" size={15} color={P.ink2} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Manage · AOV goals</span>
        <Pill kind="neutral" size="sm">Floor Manager only</Pill>
      </div>

      {goals.loading && <div style={{ padding: 16 }}><SkeletonRows rows={3} /></div>}
      {!goals.loading && goals.error &&
      <div style={{ padding: 16 }}>
        <ErrorState compact title="Goal settings aren't connected" body="Needs the wmdemo backend — not reachable right now." onRetry={goals.refresh} />
      </div>}

      {!goals.loading && goals.data &&
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* store default. Explicit `background: P.surface` on every sub-card
            here (and below) so it stands crisp against this card's own
            recessed `elevation="sunken"` fill instead of blending into it. */}
        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Store default</span>
            <PBtn size="xs" variant="secondary" style={{ marginLeft: 'auto' }}
              onClick={() => setEditing({ associateId: null, value: (goals.data.default.goal_cents / 100).toFixed(2), reason: '' })}>
              Edit
            </PBtn>
          </div>
          <div style={{ fontSize: 12, color: P.inkDim, marginBottom: 8 }}>Every associate at this store inherits this goal unless they have their own override below.</div>
          <AovGoalRow P={P} k="Current goal" v={_money0(goals.data.default.goal_cents)} />
          <AovGoalRow P={P} k="Set by" v={goals.data.default.set_by || '—'} />
          <AovGoalRow P={P} k="Last changed" v={goals.data.default.updated_at ? goals.data.default.updated_at.slice(0, 10) : '—'} />
        </div>

        {/* roster */}
        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: P.ink }}>Associate roster</span>
            <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{goals.data.roster.length} associates · {goals.data.overridden} overridden</span>
          </div>
          {goals.data.roster.map((r, i) => (
            <div key={r.associate_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <Avatar name={r.name} size={26} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: P.ink, minWidth: 0 }}>
                {r.name}{r.associate_id === window.HW.STATS.associate.id && <span style={{ marginLeft: 6 }}><Pill kind="neutral" size="sm">you</Pill></span>}
              </div>
              <Pill kind={r.source === 'override' ? 'warn' : 'neutral'} size="sm">
                {r.source === 'override' ? 'override' : `inherits ${_money0(goals.data.default.goal_cents)}`}
              </Pill>
              <span style={{ fontFamily: P.fontMono, fontSize: 13, fontWeight: 600, color: P.ink2, whiteSpace: 'nowrap' }}>{_money0(r.goal_cents)}</span>
              <PBtn size="xs" variant="ghost" onClick={() => setEditing({ associateId: r.associate_id, value: (r.goal_cents / 100).toFixed(2), reason: '' })}>
                {r.source === 'override' ? 'Edit' : 'Set override'}
              </PBtn>
              {r.source === 'override' && <PBtn size="xs" variant="ghost" style={{ color: P.bad }} onClick={() => clearOverride(r.associate_id)}>Clear</PBtn>}
            </div>))}
        </div>

        {/* audit trail */}
        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Audit trail</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>newest first</span>
          </div>
          {/* Same EmptyState atom + icon/copy screen-brands.jsx already uses for
              an empty change history — was plain unstyled text here. */}
          {(hist.rows || []).length === 0 &&
          <EmptyState compact icon="clock" title="No changes recorded yet"
            body="Goal changes and overrides will show up here as they happen." />}
          {(hist.rows || []).map((ev) => {
            const who = ev.associate_id
              ? (goals.data.roster.find((r) => r.associate_id === ev.associate_id) || {}).name || ev.associate_id
              : 'Store default';
            return (
              <div key={ev.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: `1px dashed ${P.hairline2}`, fontSize: 11.5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, marginTop: 5, flex: '0 0 auto', background: ev.action === 'cleared' ? P.warn : P.good }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: P.ink }}>
                    {ev.action === 'cleared' ? 'Override cleared' : (ev.old_cents == null ? 'Goal set' : 'Goal changed')} — {who}
                    {ev.old_cents != null && ev.new_cents != null && ` (${_money0(ev.old_cents)} → ${_money0(ev.new_cents)})`}
                    {ev.old_cents == null && ev.new_cents != null && ` (→ ${_money0(ev.new_cents)})`}
                  </div>
                  {ev.reason && <div style={{ color: P.ink2, marginTop: 2, fontStyle: 'italic' }}>"{ev.reason}"</div>}
                  <div style={{ color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{ev.ts} · set by {ev.set_by}</div>
                </div>
              </div>);
          })}
        </div>
      </div>}

      {/* window.overlayScrim/overlayCard — the shared modal-shell helper
          (pos/atoms.jsx) every other modal in this app uses. This one was
          hand-typing the scrim object literal instead, which is the exact
          anti-pattern that helper exists to retire: no `overflowY`, so on a
          short viewport the Save/Cancel row could sit off-screen with no way
          to reach it. */}
      {editing &&
      <div style={window.overlayScrim(P, { padding: '60px 20px' })}
        onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
        <div style={{ ...window.overlayCard, background: P.surface, borderRadius: P.r16, width: 'min(440px,96vw)', border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14.5 }}>{editing.associateId ? 'Set associate override' : 'Edit store default'}</h3>
            <button onClick={() => setEditing(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, color: P.inkMute }}>✕</button>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Goal ($)</label>
              <input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, background: P.surface, fontFamily: P.fontMono, fontSize: 14, color: P.ink }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Reason</label>
              <textarea value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                placeholder="Why is this changing?"
                style={{ width: '100%', height: 64, padding: '9px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, fontFamily: P.fontSans, fontSize: 12.5, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
            <PBtn variant="secondary" onClick={() => setEditing(null)}>Cancel</PBtn>
            <PBtn variant="accent" busy={busy} onClick={save}>{editing.associateId ? 'Save override' : 'Save default'}</PBtn>
          </div>
        </div>
      </div>}
    </Card>);
}

function AovGoalRow({ P, k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '6px 0', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
    <span style={{ color: P.inkDim }}>{k}</span><span style={{ fontWeight: 600, color: P.ink }}>{v}</span>
  </div>;
}
