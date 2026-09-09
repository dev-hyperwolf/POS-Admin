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
// MANAGER ONLY. `props.isManager` and `props.session`, exactly as incentives/app.jsx computes
// and forwards them to every routed screen.
;(function () {
  const useP = window.useP;
  const HWInc = window.HWInc;

  // ── the store registry, editable ────────────────────────────────────────
  // WHY THIS TABLE IS WRITEABLE NOW. The store list used to be a hard-coded
  // dict in three Python files; this card was a read-only view of it, so the
  // only way to open a store was a code change and a deploy. It is now the
  // `inc_stores` registry (GET/POST /api/incentives/stores), and a store added
  // here appears immediately in every picker in the app — Data's connections
  // and upload target, the bounty builder's store chips, the standings
  // switcher, the contests filter — because all of them read the same served
  // list rather than a copy of their own.
  //
  // DEACTIVATE, NOT DELETE, IS THE DEFAULT VERB. A store id is on every
  // transaction, line and points row it ever wrote; deleting one orphans all
  // of them. The backend refuses such a delete outright and says what points
  // at the store, so the button below is offered and the refusal is rendered
  // verbatim rather than hidden behind a disabled control that explains
  // nothing.
  const POS_COPY = {
    blaze: 'Blaze — polled live',
    meadow: 'Meadow — polled live',
    treez: 'Treez — CSV upload only, no API client here',
    none: 'No POS — CSV upload or the register only',
  };

  function StoreRowEditor({ store, actor, onDone }) {
    const P = useP();
    const [mode, setMode] = React.useState(null);   // null | 'rename' | 'delete'
    const [name, setName] = React.useState(store.name);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);

    const send = (payload, okTitle) => {
      setBusy(true); setErr(null);
      HWInc.post('/api/incentives/stores', Object.assign({ store_id: store.id, actor: actor }, payload)).then((r) => {
        setBusy(false);
        if (r.ok) {
          setMode(null);
          window.hdToast && window.hdToast({ title: okTitle, description: store.name, tone: 'ok' });
          onDone();
        } else {
          // The server's sentence, verbatim — it is the one that names what
          // points at the store. A generic "could not delete" would throw away
          // the only part of the answer a manager can act on.
          const msg = (r.body && r.body.error) || r.error || ('HTTP ' + r.code);
          setErr(msg);
          window.hdToast && window.hdToast({ title: 'Refused', description: msg, tone: 'blocked' });
        }
      });
    };

    if (mode === 'rename') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Field size="sm" value={name} onChange={(e) => setName(e.target.value)} full={false} style={{ width: 190 }} />
          <PBtn size="xs" variant="ghost" disabled={busy} onClick={() => { setMode(null); setName(store.name); setErr(null); }}>Cancel</PBtn>
          <PBtn size="xs" variant="accent" busy={busy} onClick={() => send({ action: 'rename', name: name }, 'Store renamed')}>Save</PBtn>
          {err && <span style={{ fontSize: 11, color: P.bad, maxWidth: 320 }}>{err}</span>}
        </span>);
    }
    if (mode === 'delete') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: P.inkDim }}>Delete the row entirely?</span>
          <PBtn size="xs" variant="ghost" disabled={busy} onClick={() => { setMode(null); setErr(null); }}>Cancel</PBtn>
          <PBtn size="xs" variant="danger" busy={busy} onClick={() => send({ action: 'delete' }, 'Store deleted')}>Delete</PBtn>
          {err && <span style={{ fontSize: 11, color: P.bad, maxWidth: 380, lineHeight: 1.45 }}>{err}</span>}
        </span>);
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <PBtn size="xs" variant="secondary" onClick={() => setMode('rename')}>Rename</PBtn>
        {store.active
          ? <PBtn size="xs" variant="secondary" busy={busy} onClick={() => send({ action: 'deactivate' }, 'Store deactivated')}>Deactivate</PBtn>
          : <PBtn size="xs" variant="accent" busy={busy} onClick={() => send({ action: 'activate' }, 'Store reactivated')}>Reactivate</PBtn>}
        {!store.active && <PBtn size="xs" variant="ghost" onClick={() => setMode('delete')}>Delete</PBtn>}
        {err && <span style={{ fontSize: 11, color: P.bad, maxWidth: 380, lineHeight: 1.45 }}>{err}</span>}
      </span>);
  }

  function AddStoreForm({ vendors, actor, onDone }) {
    const P = useP();
    const [open, setOpen] = React.useState(false);
    const [id, setId] = React.useState('');
    const [name, setName] = React.useState('');
    const [tz, setTz] = React.useState('America/Los_Angeles');
    const [pos, setPos] = React.useState('none');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);

    if (!open) return <PBtn size="xs" variant="accent" icon="plus" onClick={() => setOpen(true)}>Add store</PBtn>;
    const submit = () => {
      setBusy(true); setErr(null);
      HWInc.post('/api/incentives/stores', { action: 'add', store_id: id.trim(), name: name.trim(), tz: tz.trim(), pos: pos, actor: actor }).then((r) => {
        setBusy(false);
        if (r.ok) {
          setOpen(false); setId(''); setName('');
          window.hdToast && window.hdToast({ title: 'Store added', description: (name.trim() || id.trim()) + ' is now available on every screen.', tone: 'ok' });
          onDone();
        } else {
          const msg = (r.body && r.body.error) || r.error || ('HTTP ' + r.code);
          setErr(msg);
        }
      });
    };
    return (
      <div style={{ padding: 16, borderTop: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Field size="sm" full={false} style={{ width: 170 }} mono value={id} placeholder="store id (e.g. riverside-2)" onChange={(e) => setId(e.target.value)} />
          <Field size="sm" full={false} style={{ width: 200 }} value={name} placeholder="Display name" onChange={(e) => setName(e.target.value)} />
          <Field size="sm" full={false} style={{ width: 200 }} mono value={tz} placeholder="America/Los_Angeles" onChange={(e) => setTz(e.target.value)} />
          <Seg value={pos} onChange={setPos} size="sm" options={(vendors || ['blaze', 'meadow', 'treez', 'none']).map((v) => ({ value: v, label: v }))} />
          <PBtn size="xs" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setErr(null); }}>Cancel</PBtn>
          <PBtn size="xs" variant="accent" busy={busy} disabled={!id.trim()} onClick={submit}>Add</PBtn>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.5, maxWidth: 660 }}>
          The id is what every transaction, goal and bounty is keyed on and cannot be changed afterwards — lowercase letters, digits and <code>-</code> only.
          The timezone decides which local day a sale lands on. You do <b>not</b> need to add a store here to onboard one: setting
          {' '}<code>BLAZE_AUTH_KEY_&lt;SLUG&gt;</code> or <code>MEADOW_CLIENT_KEY_&lt;SLUG&gt;</code> registers it by itself, at the next sync and at every restart.
        </div>
        {err && <div style={{ fontSize: 12, color: P.bad, lineHeight: 1.5 }}>{err}</div>}
      </div>);
  }

  const TIE_RULE_COPY = {
    split: 'A prize tied across several people is split equally between them.',
    earliest: 'A prize tied across several people goes to whoever reached the value first.',
  };

  window.IncScreenSettings = function IncScreenSettings({ session, isManager, refreshStores }) {
    const P = useP();

    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    // The REGISTRY, including retired stores — `/settings.stores` is active-only
    // because it is what every picker is built from, and a manager cannot bring
    // back a store they cannot see.
    const [reg, setReg] = React.useState({ loading: true, stores: [], vendors: null });
    const loadStores = React.useCallback(() => {
      if (!isManager) return;
      HWInc.get('/api/incentives/stores?include_inactive=1').then((r) => {
        if (r.ok && r.body) setReg({ loading: false, stores: r.body.stores || [], vendors: r.body.vendors || null });
        else setReg({ loading: false, stores: [], vendors: null });
      });
    }, [isManager]);
    React.useEffect(() => { loadStores(); }, [loadStores]);
    const load = React.useCallback(() => {
      if (!isManager) return;
      setState((s) => ({ ...s, loading: true }));
      HWInc.get('/api/incentives/settings').then((r) => {
        if (r.ok && r.body) setState({ loading: false, error: null, data: r.body });
        else setState({ loading: false, error: r.error || 'unreachable', data: null });
      });
    }, [isManager]);
    React.useEffect(() => { load(); }, [load]);

    // One callback for every registry write: re-read the registry (this card),
    // re-read /settings (the other cards' store list) and tell the app shell to
    // re-read the switcher's list, so a store added here is switchable to
    // without a reload.
    const afterStoreWrite = React.useCallback(() => {
      loadStores(); load();
      if (typeof refreshStores === 'function') refreshStores();
    }, [loadStores, load, refreshStores]);

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
    // The registry when it has answered; `/settings.stores` (active only) as the
    // fallback, so this card still renders on a backend without /stores.
    const regStores = reg.stores.length ? reg.stores : (d.stores || []);
    const inactiveCount = regStores.filter((x) => x.active === false).length;
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
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <Icon name="map-pin" size={15} color={P.ink2} /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Stores</span>
            <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{regStores.length} stores{inactiveCount ? ` · ${inactiveCount} retired` : ''}</span>
            <AddStoreForm vendors={reg.vendors} actor={session.id} onDone={afterStoreWrite} />
          </div>
          <div style={{ padding: '10px 16px 0', fontSize: 11.5, color: P.inkMute, lineHeight: 1.55, maxWidth: 720 }}>
            This is the list every other screen is built from. A store added here is immediately pickable on Standings, Data, Goals and the bounty builder.
            A store whose Blaze or Meadow key appears in the environment registers itself — those rows are marked <b>auto</b>.
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Store', render: (s) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <b style={{ color: s.active ? P.ink : P.inkMute }}>{s.name}</b>
                  {!s.active && <Pill kind="neutral" size="sm">retired</Pill>}
                  {/* The one nudge `name_source` exists for: Blaze exposes no
                      shop name on any endpoint this estate reads, so a store
                      auto-registered from a Blaze key is named after its slug
                      and somebody has to say so out loud. */}
                  {s.name_source === 'slug' && <Pill kind="warn" size="sm">named from its id</Pill>}
                  {s.source === 'env' && <Pill kind="neutral" size="sm">auto</Pill>}
                </span>) },
              { key: 'id', label: 'Id', render: (s) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{s.id}</span> },
              { key: 'tz', label: 'Timezone', render: (s) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5 }}>{s.tz}</span> },
              { key: 'pos', label: 'POS', render: (s) => (
                <span title={POS_COPY[s.pos] || s.pos}>
                  <Pill kind={s.pos === 'none' ? 'neutral' : s.pos === 'treez' ? 'warn' : 'good'} size="sm">{s.pos}</Pill>
                </span>) },
              { key: 'actions', label: '', align: 'right', render: (s) => <StoreRowEditor store={s} actor={session.id} onDone={afterStoreWrite} /> },
            ]}
            rows={regStores} rowKey={(s) => s.id} />
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
