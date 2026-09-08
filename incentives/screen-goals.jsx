// ── incentives/screen-goals.jsx ── #/goals — the absorbed AOV goal ──────────
// Design: explorations/Incentives - Concept D - Two Seats.html tab "8 · Goals". Plan
// §0/§3.4/§5.1: an AOV goal is one bounty kind (aov_goal), but its backend is unchanged —
// docs/BOUNTY-API-CONTRACT.md says so explicitly: "/api/aov/* unchanged (see plan §3.5).
// Bounty's Goals screen calls exactly those." So this file is a PORT, not a rewrite: the
// manager console below is pos/screen-aov.jsx's AovManagerCard, moved out of the sunken panel
// on POS Home and into this workspace tab, calling the exact same six routes. pos/screen-aov.jsx
// itself is untouched (owner rule) — its copy keeps running for the Home card until
// pos/screen-incentives-card.jsx replaces that card in the same commit set.
//
// THREE THINGS CHANGED IN THE PORT, PER BRIEF: (1) IIFE-wrapped, so its helpers stop leaking
// into the shared global scope the way pos/screen-aov.jsx's top-level `function` declarations
// currently do (that file is POS-only today, so it gets away with it; two apps sharing one
// scope would not). (2) `alert()`/`confirm()` are gone — a failed save is an hdToast, and
// "Clear this override" is an inline confirm row (the same shape Data's Bind/Create actions
// use), never a native dialog. (3) The roster is `window.DataTable`, not a hand-rolled row list.
//
// THE SEAT NEVER SEES THE CONSOLE. A budtender's goal is one progress row — value, meter, and
// which of override/store-default/fallback set it — read from the SAME field the shell's
// app-wide `props.me` (its `/api/incentives/me` poll) already carries for the Home card
// (`aov_goal`, `today.aov_cents`), never a second goals fetch of its own. No manager controls
// exist in that branch; the choice is `props.isManager && props.seat !== 'seat'`, so a manager
// previewing the budtender seat gets the seat card, not the console crammed into 420px.
;(function () {
  const useP = window.useP;
  const HWInc = window.HWInc;

  // Same 5 slugs as pos/screen-aov.jsx's AOV_STORE_NAMES — its own copy, not an import,
  // because there is no module system here (see the estate's global-collision rule); this is
  // a display-only label, not a second source of truth (every response already carries
  // store_name where it matters).
  const STORE_NAMES = { elsinore: 'Lake Elsinore', 'west-la': 'West Hollywood', 'long-beach': 'Long Beach', corona: 'Corona', riverside: 'Riverside' };
  const storeName = (id) => STORE_NAMES[id] || id || 'Store';

  const GOAL_SOURCE_LABEL = { override: 'your override', store_default: 'store default', fallback: 'fallback goal' };

  function useAovGoalsStatus(storeId) {
    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    const load = React.useCallback(() => {
      if (!storeId) { setState({ loading: false, error: 'no-store', data: null }); return; }
      setState((s) => ({ ...s, loading: true }));
      HWInc.get(`/api/aov/goals?store_id=${encodeURIComponent(storeId)}`).then((r) => {
        if (r.ok && r.body) setState({ loading: false, error: null, data: r.body });
        else setState({ loading: false, error: r.error || 'unreachable', data: null });
      });
    }, [storeId]);
    React.useEffect(() => { load(); }, [load]);
    return { ...state, refresh: load };
  }
  function useAovHistory(storeId) {
    const [rows, setRows] = React.useState(null);
    const load = React.useCallback(() => {
      if (!storeId) { setRows(null); return; }
      HWInc.get(`/api/aov/goals/history?store_id=${encodeURIComponent(storeId)}`).then((r) => { if (r.ok && r.body) setRows(r.body.events || []); });
    }, [storeId]);
    React.useEffect(() => { load(); }, [load]);
    return { rows, refresh: load };
  }

  function InlineConfirm({ label, confirmLabel, prompt, busy, tone, onConfirm }) {
    const P = useP();
    const [armed, setArmed] = React.useState(false);
    if (!armed) return <PBtn size="xs" variant="ghost" style={tone === 'bad' ? { color: P.bad } : undefined} onClick={() => setArmed(true)}>{label}</PBtn>;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 7px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r8 }}>
        <span style={{ fontSize: 10.5, color: P.inkDim }}>{prompt}</span>
        <PBtn size="xs" variant="ghost" onClick={() => setArmed(false)} disabled={busy}>Cancel</PBtn>
        <PBtn size="xs" variant="danger" busy={busy} onClick={() => onConfirm(() => setArmed(false))}>{confirmLabel}</PBtn>
      </span>);
  }

  function AovGoalRow({ P, k, v }) {
    return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '6px 0', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
      <span style={{ color: P.inkDim }}>{k}</span><span style={{ fontWeight: 600, color: P.ink }}>{v}</span>
    </div>;
  }

  // ── manager console ─────────────────────────────────────────────────────
  function ManagerGoalsCard({ storeId, actorId, actorName }) {
    const P = useP();
    const goals = useAovGoalsStatus(storeId);
    const hist = useAovHistory(storeId);
    const [editing, setEditing] = React.useState(null); // {associateId|null, value, reason}
    const [busy, setBusy] = React.useState(false);
    const [clearingId, setClearingId] = React.useState(null);

    const save = () => {
      if (!editing) return;
      setBusy(true);
      HWInc.post('/api/aov/goals', {
        store_id: storeId, associate_id: editing.associateId || undefined,
        goal: editing.value, set_by: actorName, reason: editing.reason || null,
      }).then((res) => {
        setBusy(false);
        if (res.ok) {
          setEditing(null); goals.refresh(); hist.refresh();
          window.hdToast && window.hdToast({ title: editing.associateId ? 'Override saved' : 'Store default saved', description: `Goal set to ${HWInc.fmt.cents(Math.round(parseFloat(editing.value) * 100))}.`, tone: 'ok' });
        } else {
          window.hdToast && window.hdToast({ title: 'Could not save goal', description: res.error || 'Unknown error.', tone: 'blocked' });
        }
      });
    };
    const clearOverride = (associateId, done) => {
      setClearingId(associateId);
      HWInc.post('/api/aov/goals/clear', { store_id: storeId, associate_id: associateId, set_by: actorName, reason: 'cleared from the Goals screen' }).then((res) => {
        setClearingId(null); done && done();
        if (res.ok) { goals.refresh(); hist.refresh(); window.hdToast && window.hdToast({ title: 'Override cleared', description: 'Reverted to the store default.', tone: 'ok' }); }
        else window.hdToast && window.hdToast({ title: 'Could not clear override', description: res.error || 'Unknown error.', tone: 'blocked' });
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.01em', color: P.ink }}>AOV goals</h1>
          <p style={{ margin: '4px 0 0', maxWidth: 640, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
            {storeName(storeId)}. Every associate at this store inherits the default unless they have their own override below.
          </p>
        </div>

        {goals.loading && <Card padding={16}><SkeletonRows rows={3} /></Card>}
        {!goals.loading && goals.error &&
          <Card padding={16}><ErrorState compact title="Goal settings aren’t connected" body="Needs the wmdemo backend — not reachable right now." onRetry={goals.refresh} /></Card>}

        {!goals.loading && goals.data && (
          <>
            <Card padding={0}>
              <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name="target" size={15} color={P.ink2} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Store default</span>
                <PBtn size="xs" variant="secondary" onClick={() => setEditing({ associateId: null, value: (goals.data.default.goal_cents / 100).toFixed(2), reason: '' })}>Edit</PBtn>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: P.inkDim, marginBottom: 8 }}>Every associate at this store inherits this goal unless they have their own override below.</div>
                <AovGoalRow P={P} k="Current goal" v={HWInc.fmt.cents(goals.data.default.goal_cents)} />
                <AovGoalRow P={P} k="Set by" v={goals.data.default.set_by || '—'} />
                <AovGoalRow P={P} k="Last changed" v={goals.data.default.updated_at ? goals.data.default.updated_at.slice(0, 10) : '—'} />
              </div>
            </Card>

            <Card padding={0}>
              <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name="users" size={15} color={P.ink2} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Roster</span>
                <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{goals.data.roster.length} people · {goals.data.overridden} overridden</span>
              </div>
              <DataTable
                columns={[
                  { key: 'name', label: 'Person', render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={r.name} size={24} /><b>{r.name}</b>{r.associate_id === actorId && <Pill kind="neutral" size="sm">you</Pill>}</div> },
                  { key: 'source', label: 'Source', render: (r) => <Pill kind={r.source === 'override' ? 'warn' : 'neutral'} size="sm">{r.source === 'override' ? 'override' : `inherits ${HWInc.fmt.cents(goals.data.default.goal_cents)}`}</Pill> },
                  { key: 'goal', label: 'Goal', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{HWInc.fmt.cents(r.goal_cents)}</span> },
                  {
                    key: 'action', label: '', align: 'right', render: (r) => (
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <PBtn size="xs" variant="ghost" onClick={() => setEditing({ associateId: r.associate_id, value: (r.goal_cents / 100).toFixed(2), reason: '' })}>{r.source === 'override' ? 'Edit' : 'Set override'}</PBtn>
                        {r.source === 'override' && <InlineConfirm label="Clear" confirmLabel="Clear" prompt="Revert to default?" tone="bad" busy={clearingId === r.associate_id} onConfirm={(done) => clearOverride(r.associate_id, done)} />}
                      </span>),
                  },
                ]}
                rows={goals.data.roster} rowKey={(r) => r.associate_id} />
            </Card>

            <Card padding={0}>
              <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name="clock" size={15} color={P.ink2} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Audit trail</span>
                <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>append-only · newest first</span>
              </div>
              <div style={{ padding: 16 }}>
                {(hist.rows || []).length === 0 &&
                  <EmptyState compact icon="clock" title="No changes recorded yet" body="Goal changes and overrides will show up here as they happen." />}
                {(hist.rows || []).map((ev) => {
                  const who = ev.associate_id ? (goals.data.roster.find((r) => r.associate_id === ev.associate_id) || {}).name || ev.associate_id : 'Store default';
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: `1px dashed ${P.hairline2}`, fontSize: 11.5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, marginTop: 5, flex: '0 0 auto', background: ev.action === 'cleared' ? P.warn : P.good }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: P.ink }}>
                          {ev.action === 'cleared' ? 'Override cleared' : (ev.old_cents == null ? 'Goal set' : 'Goal changed')} — {who}
                          {ev.old_cents != null && ev.new_cents != null && ` (${HWInc.fmt.cents(ev.old_cents)} → ${HWInc.fmt.cents(ev.new_cents)})`}
                          {ev.old_cents == null && ev.new_cents != null && ` (→ ${HWInc.fmt.cents(ev.new_cents)})`}
                        </div>
                        {ev.reason && <div style={{ color: P.ink2, marginTop: 2, fontStyle: 'italic' }}>&#8220;{ev.reason}&#8221;</div>}
                        <div style={{ color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{ev.ts} · set by {ev.set_by}</div>
                      </div>
                    </div>);
                })}
              </div>
            </Card>
          </>)}

        {editing && (
          <div style={window.overlayScrim(P, { padding: '60px 20px' })} onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
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
                  <textarea value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} placeholder="Why is this changing?"
                    style={{ width: '100%', height: 64, padding: '9px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, fontFamily: P.fontSans, fontSize: 12.5, resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
                <PBtn variant="secondary" onClick={() => setEditing(null)}>Cancel</PBtn>
                <PBtn variant="accent" busy={busy} onClick={save}>{editing.associateId ? 'Save override' : 'Save default'}</PBtn>
              </div>
            </div>
          </div>)}
      </div>);
  }

  // ── budtender seat ──────────────────────────────────────────────────────
  function SeatGoalsCard({ me }) {
    const P = useP();
    return (
      <Card padding={0}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="target" size={15} color={P.ink2} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>My goals</span>
        </div>
        {me.loading && !me.data && <div style={{ padding: 16 }}><SkeletonRows rows={2} avatar={false} /></div>}
        {me.error && !me.data && <div style={{ padding: 16 }}><window.IncShared.NotConnected compact onRetry={me.refresh} /></div>}
        {me.data && (
          <>
            {(() => {
              const g = me.data.aov_goal, t = me.data.today;
              const pct = g && g.goal_cents ? Math.min(1, (t.aov_cents || 0) / g.goal_cents) : 0;
              const sub = g ? `${g.met ? 'goal met today' : `add ${HWInc.fmt.cents(g.gap_cents)} to hit today’s goal`} · ${t.txns} order${t.txns === 1 ? '' : 's'} · ${GOAL_SOURCE_LABEL[g.source] || g.source}` : '';
              return (
                <window.IncShared.ProgressRow title="AOV goal · today"
                  valueLabel={g ? `${HWInc.fmt.cents(t.aov_cents)} / ${HWInc.fmt.cents(g.goal_cents)}` : '—'}
                  pct={pct} color={g && g.met ? P.good : P.info} sub={sub} style={{ borderTop: 'none' }} />);
            })()}
            {me.data.sources && me.data.sources.length > 0 &&
              <div style={{ padding: '0 13px 13px' }}><window.IncShared.SourceFreshness sources={me.data.sources} /></div>}
          </>)}
      </Card>);
  }

  window.IncScreenGoals = function IncScreenGoals({ session, isManager, seat, me }) {
    return (isManager && seat !== 'seat')
      ? <ManagerGoalsCard storeId={session.storeId} actorId={session.id} actorName={session.name} />
      : <SeatGoalsCard me={me} />;
  };
})();
