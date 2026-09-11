// ── Boxes — the delivery-kit-box library a shell's box picker points at ────
// Catalog sub-nav, beside Shells, Formats and Locations. A box is which
// physical box in a driver's kit a shell's variations ride in
// (docs/SHELLS-PLAN-2026-09-09.md — kit_box); it is now a real record
// (id, name, type, sort, active) rather than a bare string, and a shell
// points at one by id via POST /api/shells/<id>/box (pos/shell-store.jsx
// setShellBox).
//
// Backend: wm-demo (parallel build), GET/POST /api/shells/boxes*, through
// window.HW_LIVE — get/post never reject, always {ok, code, body, error,
// hint}. Every write here goes through pos/shell-store.jsx (window.HW_SHELL).
//
// Delete never orphans: the same preview → per-row destination → confirm
// shape pos/shell-formats.jsx and pos/shell-locations.jsx already use for
// their own delete flows. A box has no side split (locations do, boxes
// don't) so this is the simpler cousin of shell-locations.jsx's ReassignModal.
//
// Self-wrapped IIFE — leaks exactly one global, window.ShellBoxesModule.
;(function () {
  const useP = window.useP;
  const S = window.HW_SHELL;

  function associate() { return (window.HW && window.HW.STATS && window.HW.STATS.associate) || {}; }
  function actorName() { const a = associate(); return a.id || a.name || 'POS'; }
  function isManagerActor() {
    const a = associate();
    return window.HWContracts ? window.HWContracts.roleAtLeast(a.role, 'manager') : a.role === 'Floor Manager';
  }

  const BOX_TYPES = ['Flower', 'Pre-Roll', 'Vape', 'Concentrate', 'Edible', 'Wellness', 'Mixed', 'Cooler'];

  // ── destination picker — an existing box (never the one being deleted),
  // or "+ New box…". Exported for reuse by the Placement section. ─────────
  function DestPicker({ boxes, excludeId, value, placeholder, disabled, onPick, onRequestNew }) {
    const P = useP();
    const list = (boxes || []).filter((b) => b.id !== excludeId);
    return <div style={{ position: 'relative' }}>
      <select disabled={disabled} value={value || ''} onChange={(e) => {
        const v = e.target.value;
        if (v === '__new__') { onRequestNew(); return; }
        onPick(v || null);
      }} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '8px 30px 8px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: disabled ? P.disabledBg : P.field, fontSize: 12.5, fontWeight: 600, color: disabled ? P.disabledInk : P.ink, fontFamily: P.fontSans, outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <option value="" disabled={!!value}>{placeholder || 'Choose a destination…'}</option>
        {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value="__new__">+ New box…</option>
      </select>
      <Icon name="chevron-down" size={13} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }

  function NewBoxInline({ onCancel, onCreated }) {
    const P = useP();
    const [name, setName] = React.useState('');
    const [type, setType] = React.useState(BOX_TYPES[0]);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const canCreate = !!(name.trim() && !busy);
    const create = () => {
      if (!canCreate) return;
      setBusy(true); setErr(null);
      S.saveBox({ name: name.trim(), type, active: true }).then((r) => {
        setBusy(false);
        if (!r.ok) { setErr(r.error || 'Could not create the box.'); return; }
        onCreated(r.box);
      });
    };
    return <div onClick={onCancel} style={window.overlayScrim(P, { padding: '60px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(420px,94vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, flex: 1 }}>New box</span>
          <IconBtn icon="x" size={16} label="Close" onClick={onCancel} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Name *</div>
          <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flower Box 2" autoFocus />
        </div>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Type</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BOX_TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)}
              style={{ padding: '6px 11px', borderRadius: P.r999, border: `1px solid ${type === t ? P.ink : P.hairline2}`, background: type === t ? P.ink : P.surface, color: type === t ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{t}</button>)}
          </div>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 11.5, color: P.bad, fontWeight: 600 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <PBtn variant="secondary" size="md" onClick={onCancel}>Cancel</PBtn>
          <PBtn variant="accent" size="md" icon="check" busy={busy} disabled={!canCreate} onClick={create}>Create</PBtn>
        </div>
      </div>
    </div>;
  }

  function BoxSheet({ editing, onClose, onSaved }) {
    const P = useP();
    const [name, setName] = React.useState(editing ? editing.name || '' : '');
    const [type, setType] = React.useState(editing ? editing.type || BOX_TYPES[0] : BOX_TYPES[0]);
    const [sort, setSort] = React.useState(editing && editing.sort != null ? String(editing.sort) : '');
    const [active, setActive] = React.useState(editing ? editing.active !== false : true);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const canSave = !!(name.trim() && !busy);

    const save = () => {
      if (!canSave) return;
      setBusy(true); setErr(null);
      S.saveBox({ id: editing ? editing.id : undefined, name: name.trim(), type, sort, active }).then((r) => {
        setBusy(false);
        if (!r.ok) { setErr(r.error || 'Could not save this box.'); return; }
        onSaved(r.box);
      });
    };

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '48px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(480px,96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{editing ? 'Edit box' : 'New box'}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Name *</div>
            <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flower Box 2" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Type</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BOX_TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)}
                style={{ padding: '7px 12px', borderRadius: P.r999, border: `1px solid ${type === t ? P.ink : P.hairline2}`, background: type === t ? P.ink : P.surface, color: type === t ? P.surface : P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{t}</button>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Sort order</div>
            <Field mono value={sort} onChange={(e) => setSort(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Active</div>
              <div style={{ fontSize: 11, color: P.inkMute }}>Retired boxes stay for history but can't take new shells.</div>
            </div>
            <window.Switch on={active} onChange={setActive} />
          </div>
          {err && <div style={{ padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10, fontSize: 12, color: P.bad, fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <PBtn variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancel</PBtn>
          <PBtn variant="accent" size="lg" icon="check" busy={busy} disabled={!canSave} onClick={save}>{editing ? 'Save changes' : 'Create box'}</PBtn>
        </div>
      </div>
    </div>;
  }

  // ══ DELETE → REASSIGN ═══════════════════════════════════════════════════
  function ReassignModal({ box, boxes, onClose, onDeleted }) {
    const P = useP();
    const [state, setState] = React.useState({ loading: true, error: null, affected: null });
    const [dest, setDest] = React.useState({});
    const [newFor, setNewFor] = React.useState(null); // shell_id | 'ALL' | null
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);

    React.useEffect(() => {
      S.previewBoxDelete(box.id).then((r) => {
        if (r.ok) setState({ loading: false, error: null, affected: r.affected || [] });
        else setState({ loading: false, error: r.notAvailable ? 'not-available' : (r.error || 'Preview failed'), affected: null });
      });
    }, [box.id]);

    const affected = state.affected || [];
    const setRowDest = (shellId, id) => setDest((o) => ({ ...o, [shellId]: id }));
    const applyMoveAll = (id) => setDest((o) => { const n = { ...o }; affected.forEach((a) => { n[a.shell_id] = id; }); return n; });
    const missing = affected.filter((a) => !dest[a.shell_id]);
    const canDelete = !busy && missing.length === 0;

    function confirm() {
      if (!canDelete) return;
      setBusy(true); setErr(null);
      const rows = affected.map((a) => ({ shell_id: a.shell_id, to_box_id: dest[a.shell_id] }));
      S.deleteBox(box.id, { rows }).then((r) => {
        setBusy(false);
        if (r.ok) { onDeleted(r.result); return; }
        if (r.manager) { setErr({ manager: true }); return; }
        if (r.missing) { setErr({ missing: r.missing, message: r.error }); return; }
        setErr({ message: r.notAvailable ? r.error : (r.error || 'That was refused.') });
      });
    }

    if (err && err.manager) {
      return <div onClick={onClose} style={window.overlayScrim(P, { padding: '60px 20px' })}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(480px,94vw)', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, padding: 4 }}>
          <window.ErrorState title="Manager only" body="Deleting a box is a manager-only action. Nothing was changed." onRetry={onClose} />
        </div>
      </div>;
    }

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '32px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(760px,97vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <Icon name="trash" size={16} color={P.bad} />
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Delete — {box.name}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ padding: 18, maxHeight: '68vh', overflowY: 'auto' }}>
          {!isManagerActor() && <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: P.warnSoft, borderRadius: P.r10, marginBottom: 14 }}>
            <Icon name="alert" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Deleting a box is manager-only. Confirm will be refused if this session isn't one.</div>
          </div>}

          {state.loading && <window.SkeletonRows rows={3} />}
          {!state.loading && state.error === 'not-available' && <window.ErrorState title="Boxes not available on this server yet" body="The boxes backend hasn't landed on this environment." onRetry={onClose} />}
          {!state.loading && state.error && state.error !== 'not-available' && <window.ErrorState title="Preview didn't load" detail={state.error} onRetry={onClose} />}
          {!state.loading && !state.error && affected.length === 0 && <window.EmptyState icon="check" title="No shells on this box" body="Nothing to reassign — deleting is safe." />}

          {!state.loading && !state.error && affected.length > 0 && <>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginBottom: 12 }}>Every shell needs a destination before Delete is enabled — pick one at a time or move them all at once.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkDim, whiteSpace: 'nowrap' }}>Move all to&hellip;</span>
              <div style={{ flex: 1 }}><DestPicker boxes={boxes} excludeId={box.id} placeholder="Choose a destination for every shell…" onPick={applyMoveAll} onRequestNew={() => setNewFor('ALL')} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {affected.map((a) => { const has = !!dest[a.shell_id]; return (
                <div key={a.shell_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: has ? P.surface : P.warnSoft, border: `1px solid ${has ? P.hairline : P.warn + '55'}`, borderRadius: P.r10 }}>
                  <span style={{ flex: '0 0 auto' }}>{has ? <Icon name="check-circle" size={16} color={P.good} /> : <Icon name="alert" size={16} color={P.warn} />}</span>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.shell_name || a.shell_id}</div>
                  </div>
                  <div style={{ flex: '1 1 220px', maxWidth: 280 }}>
                    <DestPicker boxes={boxes} excludeId={box.id} value={dest[a.shell_id]} placeholder="Choose a destination…" onPick={(v) => v && setRowDest(a.shell_id, v)} onRequestNew={() => setNewFor(a.shell_id)} />
                  </div>
                </div>); })}
            </div>
          </>}

          {err && !err.manager && <div style={{ marginTop: 14, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: P.bad }}>{err.message || 'That was refused.'}</div>
            {err.missing && err.missing.length > 0 && <div style={{ marginTop: 4, fontSize: 11.5, color: P.warnText, fontFamily: P.fontMono }}>Still missing: {err.missing.join(', ')}</div>}
          </div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 12.5, color: missing.length ? P.warnText : P.inkMute }}>{missing.length ? (missing.length === 1 ? '1 shell still needs a destination' : missing.length + ' shells still need a destination') : (affected.length > 0 ? 'Every shell has a destination.' : 'Nothing to reassign.')}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <PBtn variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="danger" size="lg" icon="trash" busy={busy} disabled={!canDelete} onClick={confirm}>Delete box</PBtn>
          </div>
        </div>
      </div>
      {newFor != null && <NewBoxInline onCancel={() => setNewFor(null)}
        onCreated={(b) => { if (newFor === 'ALL') applyMoveAll(b.id); else setRowDest(newFor, b.id); setNewFor(null); }} />}
    </div>;
  }

  // ══ MODULE ════════════════════════════════════════════════════════════════
  window.ShellBoxesModule = function ShellBoxesModule() {
    const P = useP();
    const list = S.useBoxes();
    const status = S.useBoxesStatus();
    const [sheet, setSheet] = React.useState(undefined); // undefined=closed, null=new, box=edit
    const [deleteFor, setDeleteFor] = React.useState(null);
    const [flash, setFlash] = React.useState(null);
    const flashTimer = React.useRef(null);
    React.useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
    function showFlash(msg) {
      setFlash(msg);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 4200);
    }

    const columns = [
      { label: 'Box', render: (b) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="box" size={15} stroke={1.8} color={P.inkMute} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{b.name}</span>
        </div> },
      { label: 'Type', render: (b) => <Pill kind="neutral" dot>{b.type || '—'}</Pill> },
      { label: 'Sort', align: 'right', render: (b) => <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>{b.sort != null ? b.sort : '—'}</span> },
      { label: 'Used by', align: 'right', render: (b) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{b.shell_count != null ? b.shell_count : '—'}{b.shell_count != null ? ' shell' + (b.shell_count === 1 ? '' : 's') : ''}</span> },
      { label: 'Status', render: (b) => b.active !== false ? <Pill kind="good" dot>Active</Pill> : <Pill kind="neutral" dot>Inactive</Pill> },
      { label: '', align: 'right', width: '80px', render: (b) => <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <IconBtn icon="pencil" size={14} label={'Edit ' + b.name} style={{ width: 30, height: 30 }} onClick={() => setSheet(b)} />
          <IconBtn icon="trash" size={14} label={'Delete ' + b.name} style={{ width: 30, height: 30 }} onClick={() => setDeleteFor(b)} />
        </div> }
    ];

    return <div data-tour="shell-boxes">
      <SectionHead level={1} eyebrow="Master Catalog" title="Boxes"
        subtitle={(list ? list.length : 0) + ' delivery boxes — which physical box a shell rides in'}
        action={<PBtn variant="accent" size="md" icon="plus" onClick={() => setSheet(null)}>Add Box</PBtn>} />

      {status.loading && <Card padding={0}><div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}><window.Skeleton w={140} h={14} /></div><div style={{ padding: 16 }}><window.SkeletonRows rows={3} avatar={false} /></div></Card>}

      {!status.loading && status.error === 'not-available' && <Card padding={0}><window.EmptyState icon="box" title="Boxes are not available on this server yet" body="This environment hasn't shipped the boxes backend — the panel will populate the moment it does." /></Card>}
      {!status.loading && status.error && status.error !== 'not-available' && <Card padding={0}><window.ErrorState title="Boxes didn't load" detail={status.error} onRetry={() => S.refreshBoxes()} /></Card>}

      {!status.loading && !status.error && (!list || list.length === 0) && <Card padding={0}>
        <window.EmptyState icon="box" title="No boxes yet" body="A box is which physical container in a driver's kit a shell's variations ride in." action={<PBtn variant="accent" icon="plus" onClick={() => setSheet(null)}>Add Box</PBtn>} />
      </Card>}

      {!status.loading && !status.error && list && list.length > 0 && <Card padding={0}><DataTable columns={columns} rows={list} rowKey={(b) => b.id} /></Card>}

      {sheet !== undefined && <BoxSheet editing={sheet} onClose={() => setSheet(undefined)}
        onSaved={(box) => { setSheet(undefined); showFlash('Saved “' + box.name + '”.'); }} />}

      {deleteFor && <ReassignModal box={deleteFor} boxes={list || []}
        onClose={() => setDeleteFor(null)}
        onDeleted={(res) => { setDeleteFor(null); showFlash('Deleted. ' + ((res && res.moved) || 0) + ' shells moved.'); }} />}

      {flash && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', background: P.ink, color: P.surface, borderRadius: 99, fontSize: 12.5, fontWeight: 600, boxShadow: P.shadowLg, zIndex: P.z.toast, whiteSpace: 'nowrap', maxWidth: '86vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flash}</div>}
    </div>;
  };

  window.ShellBoxesModule.DestPicker = DestPicker;

  // openNew({ onCreated }) — standalone create, same detached-root trick as
  // ShellFormatsModule.openNew / ShellLocationsModule.openNew, so the
  // Placement section's box picker can offer "+ New box" without this
  // module already being mounted.
  window.ShellBoxesModule.openNew = function openNew(opts) {
    opts = opts || {};
    const host = document.createElement('div');
    host.setAttribute('data-hw-shell-box-standalone', '');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    function teardown() { try { root.unmount(); } catch (e) { /* already gone */ } host.remove(); }
    root.render(<NewBoxInline onCancel={teardown}
      onCreated={(box) => { teardown(); if (typeof opts.onCreated === 'function') opts.onCreated(box); }} />);
  };
})();
