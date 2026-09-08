// ── incentives/screen-settings.jsx ── #/settings — stores · tie rule · managers ─
// Contract: docs/BOUNTY-API-CONTRACT.md §Settings — GET/POST /api/incentives/settings,
// `{ stores: [{id,name,tz,pos}], tie_rule_default: 'split'|'earliest', managers: [Person] }`.
// No mockup tab covers this screen (Concept D's tab list stops at "10 · States" and never
// names Settings), so the layout below follows the estate's own convention instead: a
// read-only DataTable for the store roster (this is where every other screen's store_id list
// comes from — plan §3.4's contest `store_ids` picker and Data's connections table both read
// this same GET), a Seg for the one editable setting, and a plain roster list for managers —
// nothing invented beyond what the contract sends.
//
// MANAGER ONLY. Same role derivation as every other screen in this build:
// window.HWInc.session().role, never a prop (app.jsx passes only {navigate, query, route,
// path} — see incentives/screen-data.jsx's header for why that is verified, not assumed).
;(function () {
  const useP = window.useP;
  const HWInc = window.HWInc;

  const TIE_RULE_COPY = {
    split: 'A prize tied across several people is split equally between them.',
    earliest: 'A prize tied across several people goes to whoever reached the value first.',
  };

  window.IncScreenSettings = function IncScreenSettings() {
    const P = useP();
    const session = HWInc.session();
    const isManager = session.role === 'Floor Manager' || session.role === 'Admin';

    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    const load = React.useCallback(() => {
      if (!isManager) return;
      setState((s) => ({ ...s, loading: true }));
      HWInc.get('/api/incentives/settings').then((r) => {
        if (r.ok && r.body) setState({ loading: false, error: null, data: r.body });
        else setState({ loading: false, error: r.error || 'unreachable', data: null });
      });
    }, [isManager]);
    React.useEffect(() => { load(); }, [load]);

    const [savingTieRule, setSavingTieRule] = React.useState(false);

    if (!isManager) {
      return <EmptyState icon="settings" title="Settings are a manager tool" body="Store hours, the tie-break rule, and who manages Bounty live here. There's nothing for you to change on this screen." />;
    }
    if (state.loading && !state.data) {
      return <Card padding={0}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="settings" size={15} color={P.ink2} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Settings</span>
        </div>
        <div style={{ padding: 16 }}><SkeletonRows rows={3} /></div>
      </Card>;
    }
    if (state.error || !state.data) return <window.IncShared.NotConnected onRetry={load} />;

    const d = state.data;
    const setTieRule = (v) => {
      if (v === d.tie_rule_default) return;
      setSavingTieRule(true);
      HWInc.post('/api/incentives/settings', { tie_rule_default: v, actor: session.id }).then((r) => {
        setSavingTieRule(false);
        if (r.ok && r.body) {
          setState({ loading: false, error: null, data: r.body });
          window.hdToast && window.hdToast({ title: 'Tie rule updated', description: v === 'split' ? 'Ties now split equally by default.' : 'Ties now go to whoever got there first, by default.', tone: 'ok' });
        } else {
          window.hdToast && window.hdToast({ title: 'Could not save', description: r.error || 'Unknown error.', tone: 'blocked' });
        }
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.01em', color: P.ink }}>Settings</h1>
          <p style={{ margin: '4px 0 0', maxWidth: 640, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>Stores, the default tie-break rule for new bounties, and who has Bounty’s manager tools.</p>
        </div>

        <Card padding={0}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="map-pin" size={15} color={P.ink2} /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Stores</span>
            <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{d.stores.length} stores</span>
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Store', render: (s) => <b>{s.name}</b> },
              { key: 'id', label: 'Id', render: (s) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{s.id}</span> },
              { key: 'tz', label: 'Timezone', render: (s) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5 }}>{s.tz}</span> },
              { key: 'pos', label: 'POS', render: (s) => <Pill kind={s.pos === 'none' ? 'neutral' : s.pos === 'treez' ? 'warn' : 'good'} size="sm">{s.pos}</Pill> },
            ]}
            rows={d.stores} rowKey={(s) => s.id} />
        </Card>

        <Card padding={0}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="split" size={15} color={P.ink2} /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Default tie rule</span>
            {savingTieRule && <Pill kind="neutral" size="sm">saving…</Pill>}
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Seg value={d.tie_rule_default} onChange={setTieRule}
              options={[{ value: 'split', label: 'Split' }, { value: 'earliest', label: 'Earliest' }]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['split', 'earliest'].map((v) => (
                <div key={v} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: v === d.tie_rule_default ? P.ink2 : P.inkMute }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: v === d.tie_rule_default ? P.accent : P.inkFaint, marginTop: 5, flex: '0 0 auto' }} />
                  <span><b style={{ color: v === d.tie_rule_default ? P.ink : P.inkDim }}>{v === 'split' ? 'Split' : 'Earliest'}</b> — {TIE_RULE_COPY[v]}</span>
                </div>))}
            </div>
            <div style={{ fontSize: 11, color: P.inkFaint }}>Applies to a new bounty unless its builder sets its own tie rule.</div>
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="shield" size={15} color={P.ink2} /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Managers</span>
            <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{d.managers.length}</span>
          </div>
          {d.managers.length === 0
            ? <div style={{ padding: 16 }}><EmptyState compact icon="shield" title="No managers on record" body="Manager-only actions across Bounty need at least one person here." /></div>
            : <DataTable
                columns={[
                  { key: 'name', label: 'Person', render: (m) => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={m.name} size={24} />{m.name}{m.associate_id === session.id && <span style={{ marginLeft: 6 }}><Pill kind="neutral" size="sm">you</Pill></span>}</div> },
                  { key: 'store', label: 'Store', render: (m) => m.store_name },
                  { key: 'role', label: 'Role', render: (m) => <Pill kind="neutral" size="sm">{m.role}</Pill> },
                ]}
                rows={d.managers} rowKey={(m) => m.associate_id} />}
        </Card>
      </div>);
  };
})();
