// ── Locations — the FOH/BOH shelf library a shell's placement points at ────
// Catalog sub-nav, beside Shells and Formats. A Location is anywhere product
// can physically be (contracts/index.js 0.4.2 Location + LocationKind) — a
// shell (or one store's override of it) points at one per side via
// ShellLocationBinding (pos/shell-store.jsx setShellLocation/effectiveLocation).
//
// Backend: wm-demo (parallel build, distribution/OWNER-NOTES.md 2026-09-10),
// GET/POST /api/shells/locations*, through window.HW_LIVE — get/post never
// reject, always {ok, code, body, error, hint}. Every write here goes through
// pos/shell-store.jsx (window.HW_SHELL) — this file owns no fetch of its own.
//
// docs/SHELLS-PLAN-2026-09-09.md's owner ruling on rebind: "never all or
// none... allow taking a segment of that list and assigning it elsewhere" —
// the same shape pos/shell-formats.jsx's delete/reassign flow already
// implements for formats. ReassignModal below is that exact UX, copied.
//
// Self-wrapped IIFE — leaks exactly one global, window.ShellLocationsModule.
;(function () {
  const useP = window.useP;
  const S = window.HW_SHELL;

  // ── session / actor — identical accessor to shell-formats.jsx / shell-
  // store.jsx: there is no second "who is this" for the POS layer. ─────────
  function associate() { return (window.HW && window.HW.STATS && window.HW.STATS.associate) || {}; }
  function actorName() { const a = associate(); return a.id || a.name || 'POS'; }
  function isManagerActor() {
    const a = associate();
    return window.HWContracts ? window.HWContracts.roleAtLeast(a.role, 'manager') : a.role === 'Floor Manager';
  }

  const SIDES = [{ key: 'foh', label: 'Front of house' }, { key: 'boh', label: 'Back of house' }];
  const KIND_LABEL = { floor: 'Floor', shelf: 'Shelf', display: 'Display', safe: 'Safe', quarantine: 'Quarantine' };
  const sideOf = (kind) => (S.LOCATION_KINDS_BY_SIDE.foh.includes(kind) ? 'foh' : S.LOCATION_KINDS_BY_SIDE.boh.includes(kind) ? 'boh' : null);
  const kindsFor = (side) => S.LOCATION_KINDS_BY_SIDE[side] || [];

  // ── store scope — "Company default" (store_id null) or one real store ──
  function StorePicker({ value, onChange }) {
    const P = useP();
    const stores = (window.HW_STORES && window.HW_STORES.list) || [];
    return <div style={{ position: 'relative', minWidth: 220 }}>
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}
        style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '9px 32px 9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 13, fontWeight: 700, color: P.ink, fontFamily: P.fontSans, outline: 'none', cursor: 'pointer' }}>
        <option value="">Company default</option>
        {stores.map((st) => <option key={st.slug} value={st.slug}>{st.name || st.slug}</option>)}
      </select>
      <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }

  // ── Destination picker — an existing location on the SAME side (never
  // FOH ↔ BOH), or "+ New location…". Reused by: this file's own delete/
  // reassign flow, AND pos/product-shell.jsx's Placement section (exported
  // below as window.ShellLocationsModule.DestPicker) — one picker, so a
  // destination always means the same thing wherever it's chosen. ─────────
  function DestPicker({ locations, side, excludeId, value, placeholder, disabled, onPick, onRequestNew }) {
    const P = useP();
    const list = (locations || []).filter((l) => l.id !== excludeId && sideOf(l.kind) === side);
    return <div style={{ position: 'relative' }}>
      <select disabled={disabled} value={value || ''} onChange={(e) => {
        const v = e.target.value;
        if (v === '__new__') { onRequestNew(); return; }
        onPick(v || null);
      }} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '8px 30px 8px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: disabled ? P.disabledBg : P.field, fontSize: 12.5, fontWeight: 600, color: disabled ? P.disabledInk : P.ink, fontFamily: P.fontSans, outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <option value="" disabled={!!value}>{placeholder || 'Choose a destination…'}</option>
        {list.map((l) => <option key={l.id} value={l.id}>{l.name}{l.address ? ' · ' + l.address : ''}</option>)}
        <option value="__new__">+ New location…</option>
      </select>
      <Icon name="chevron-down" size={13} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }

  // ── compact inline "New location…" — name + kind + address + capacity,
  // created immediately (never a floating draft object) so every caller that
  // picks "+ New location…" — a reassign row, "Move all to…", or the
  // Placement section on the shell form — ends up holding a real id it can
  // point at right away, exactly like an existing location. ───────────────
  function NewLocationInline({ side, storeId, onCancel, onCreated }) {
    const P = useP();
    const [name, setName] = React.useState('');
    const [kind, setKind] = React.useState(kindsFor(side)[0] || '');
    const [address, setAddress] = React.useState('');
    const [capacity, setCapacity] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const canCreate = !!(name.trim() && kind && !busy);
    const create = () => {
      if (!canCreate) return;
      setBusy(true); setErr(null);
      S.saveLocation({ name: name.trim(), kind, address: address.trim(), store_id: storeId, capacity, active: true }).then((r) => {
        setBusy(false);
        if (!r.ok) { setErr(r.error || 'Could not create the location.'); return; }
        onCreated(r.location);
      });
    };
    return <div onClick={onCancel} style={window.overlayScrim(P, { padding: '60px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(460px,94vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, flex: 1 }}>New {side === 'foh' ? 'front of house' : 'back of house'} location</span>
          <IconBtn icon="x" size={16} label="Close" onClick={onCancel} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Name *</div>
          <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shelf E1" autoFocus />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Kind *</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {kindsFor(side).map((k) => <button key={k} type="button" onClick={() => setKind(k)}
              style={{ padding: '7px 12px', borderRadius: P.r999, border: `1px solid ${kind === k ? P.ink : P.hairline2}`, background: kind === k ? P.ink : P.surface, color: kind === k ? P.surface : P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{KIND_LABEL[k] || k}</button>)}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10, marginBottom: 4 }}>
          <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Address <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></div>
            <Field mono value={address} onChange={(e) => setAddress(e.target.value)} placeholder="E1-A-01" /></div>
          <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Capacity</div>
            <Field mono value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ''))} placeholder="—" /></div>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 11.5, color: P.bad, fontWeight: 600 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <PBtn variant="secondary" size="md" onClick={onCancel}>Cancel</PBtn>
          <PBtn variant="accent" size="md" icon="check" busy={busy} disabled={!canCreate} onClick={create}>Create</PBtn>
        </div>
      </div>
    </div>;
  }

  // ══ ADD / EDIT SHEET ═══════════════════════════════════════════════════════
  function LocationSheet({ editing, side, storeId, onClose, onSaved }) {
    const P = useP();
    const [name, setName] = React.useState(editing ? editing.name || '' : '');
    const [kind, setKind] = React.useState(editing ? editing.kind : (kindsFor(side)[0] || ''));
    const [address, setAddress] = React.useState(editing ? editing.address || '' : '');
    const [capacity, setCapacity] = React.useState(editing && editing.capacity != null ? String(editing.capacity) : '');
    const [active, setActive] = React.useState(editing ? editing.active !== false : true);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const effSide = editing ? (sideOf(editing.kind) || side) : side;
    const canSave = !!(name.trim() && kind && !busy);

    const save = () => {
      if (!canSave) return;
      setBusy(true); setErr(null);
      const draft = { id: editing ? editing.id : undefined, name: name.trim(), kind, address, store_id: storeId, capacity, active };
      S.saveLocation(draft).then((r) => {
        setBusy(false);
        if (!r.ok) { setErr(r.notAvailable ? r.error : (r.error || 'Could not save this location.')); return; }
        onSaved(r.location);
      });
    };

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '48px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(520px,96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{editing ? 'Edit location' : 'New location'}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Name *</div>
            <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shelf E1" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Kind * <span style={{ textTransform: 'none', fontWeight: 500, color: P.inkFaint }}>({effSide === 'foh' ? 'front of house' : 'back of house'})</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {kindsFor(effSide).map((k) => <button key={k} type="button" onClick={() => setKind(k)}
                style={{ padding: '7px 12px', borderRadius: P.r999, border: `1px solid ${kind === k ? P.ink : P.hairline2}`, background: kind === k ? P.ink : P.surface, color: kind === k ? P.surface : P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{KIND_LABEL[k] || k}</button>)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}>
            <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Address <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></div>
              <Field mono value={address} onChange={(e) => setAddress(e.target.value)} placeholder="E1-A-01" /></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Capacity</div>
              <Field mono value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ''))} placeholder="—" /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Active</div>
              <div style={{ fontSize: 11, color: P.inkMute }}>Deactivate instead of delete to keep it out of new pickers without reassigning what's there.</div>
            </div>
            <window.Switch on={active} onChange={setActive} />
          </div>
          {err && <div style={{ padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10, fontSize: 12, color: P.bad, fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <PBtn variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancel</PBtn>
          <PBtn variant="accent" size="lg" icon="check" busy={busy} disabled={!canSave} onClick={save}>{editing ? 'Save changes' : 'Create location'}</PBtn>
        </div>
      </div>
    </div>;
  }

  // ══ DELETE → REASSIGN (never orphans — the same shape as Formats) ═════════
  // Rows are keyed by shell+store+side (never just shell id) because one
  // shell can hold this location on more than one side/store at once, and
  // the owner's ruling is explicit: a SEGMENT of the affected list, never
  // all-or-nothing.
  function rowKeyOf(a) { return a.shell_id + '|' + (a.store_id || '') + '|' + a.side; }

  function ReassignModal({ location, onClose, onDeleted }) {
    const P = useP();
    const [state, setState] = React.useState({ loading: true, error: null, affected: null, stockHeld: 0 });
    const [dest, setDest] = React.useState({});       // rowKey -> location_id
    const [newFor, setNewFor] = React.useState(null); // rowKey | 'ALL' | null
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const locations = S.useLocations(null, null);

    React.useEffect(() => {
      S.previewLocationDelete(location.id).then((r) => {
        if (r.ok) setState({ loading: false, error: null, affected: r.affected || [], stockHeld: r.stockHeld || 0 });
        else setState({ loading: false, error: r.notAvailable ? 'not-available' : (r.error || 'Preview failed'), affected: null, stockHeld: 0 });
      });
    }, [location.id]);

    const affected = state.affected || [];
    const setRowDest = (k, id) => setDest((o) => ({ ...o, [k]: id }));
    const applyMoveAll = (id) => setDest((o) => { const n = { ...o }; affected.forEach((a) => { if (sideOf(location.kind) === a.side) n[rowKeyOf(a)] = id; }); return n; });
    const missing = affected.filter((a) => !dest[rowKeyOf(a)]);
    const canDelete = !busy && missing.length === 0 && state.stockHeld === 0;
    const side = sideOf(location.kind);

    function confirm() {
      if (!canDelete) return;
      setBusy(true); setErr(null);
      const rows = affected.map((a) => ({ shell_id: a.shell_id, store_id: a.store_id || null, side: a.side, to_location_id: dest[rowKeyOf(a)] }));
      S.deleteLocation(location.id, { rows }).then((r) => {
        setBusy(false);
        if (r.ok) { onDeleted(r.result); return; }
        if (r.manager) { setErr({ manager: true }); return; }
        if (r.stockHeld) { setErr({ message: 'Still holds product — move it first.' }); return; }
        if (r.missing) { setErr({ missing: r.missing, message: r.error }); return; }
        setErr({ message: r.notAvailable ? r.error : (r.error || 'That was refused.') });
      });
    }

    if (err && err.manager) {
      return <div onClick={onClose} style={window.overlayScrim(P, { padding: '60px 20px' })}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(480px,94vw)', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, padding: 4 }}>
          <window.ErrorState title="Manager only" body="Deleting a location is a manager-only action. Nothing was changed." onRetry={onClose} />
        </div>
      </div>;
    }

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '32px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(820px,97vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <Icon name="trash" size={16} color={P.bad} />
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Delete — {location.name}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ padding: 18, maxHeight: '68vh', overflowY: 'auto' }}>
          {!isManagerActor() && <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: P.warnSoft, borderRadius: P.r10, marginBottom: 14 }}>
            <Icon name="alert" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Deleting a location is manager-only. Confirm will be refused if this session isn't one.</div>
          </div>}

          {state.loading && <window.SkeletonRows rows={3} />}
          {!state.loading && state.error === 'not-available' && <window.ErrorState title="Locations not available on this server yet" body="The locations backend hasn't landed on this environment — nothing can be previewed or deleted here yet." onRetry={onClose} />}
          {!state.loading && state.error && state.error !== 'not-available' && <window.ErrorState title="Preview didn't load" detail={state.error} onRetry={onClose} />}

          {!state.loading && !state.error && state.stockHeld > 0 && <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}44`, borderRadius: P.r10, marginBottom: 14 }}>
            <Icon name="alert" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>{location.name}</b> still holds product ({state.stockHeld} unit{state.stockHeld === 1 ? '' : 's'}) — move it first. Nothing can be deleted while stock sits here.</div>
          </div>}

          {!state.loading && !state.error && affected.length === 0 && state.stockHeld === 0 && <window.EmptyState icon="check" title="Nothing points at this location" body="No shell or store override uses it — deleting is safe." />}

          {!state.loading && !state.error && affected.length > 0 && <>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginBottom: 12 }}>Every row needs a destination before Delete is enabled — pick one at a time or move them all at once. A subset may go elsewhere; it's never all-or-nothing.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkDim, whiteSpace: 'nowrap' }}>Move all to&hellip;</span>
              <div style={{ flex: 1 }}>
                <DestPicker locations={locations} side={side} excludeId={location.id} placeholder="Choose a destination for every row…"
                  onPick={(id) => applyMoveAll(id)} onRequestNew={() => setNewFor('ALL')} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {affected.map((a) => { const k = rowKeyOf(a); const has = !!dest[k]; const storeName = a.store_id ? (window.HW_STORES ? window.HW_STORES.name(a.store_id) : a.store_id) : 'Company default';
                return <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: has ? P.surface : P.warnSoft, border: `1px solid ${has ? P.hairline : P.warn + '55'}`, borderRadius: P.r10 }}>
                  <span style={{ flex: '0 0 auto' }}>{has ? <Icon name="check-circle" size={16} color={P.good} /> : <Icon name="alert" size={16} color={P.warn} />}</span>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.shell_name || a.shell_id}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 1 }}>{storeName} &middot; {a.side === 'foh' ? 'Front of house' : 'Back of house'}</div>
                  </div>
                  <div style={{ flex: '1 1 240px', maxWidth: 300 }}>
                    <DestPicker locations={locations} side={side} excludeId={location.id} value={dest[k]}
                      placeholder="Choose a destination…" onPick={(v) => v && setRowDest(k, v)} onRequestNew={() => setNewFor(k)} />
                  </div>
                </div>; })}
            </div>
          </>}

          {err && !err.manager && <div style={{ marginTop: 14, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: P.bad }}>{err.message || 'That was refused.'}</div>
            {err.missing && err.missing.length > 0 && <div style={{ marginTop: 4, fontSize: 11.5, color: P.warnText, fontFamily: P.fontMono }}>Still missing: {err.missing.join(', ')}</div>}
          </div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 12.5, color: (missing.length || state.stockHeld) ? P.warnText : P.inkMute }}>
            {state.stockHeld > 0 ? state.stockHeld + ' unit' + (state.stockHeld === 1 ? '' : 's') + ' still held' :
              missing.length ? (missing.length === 1 ? '1 row still needs a destination' : missing.length + ' rows still need a destination') :
              (affected.length > 0 ? 'Every row has a destination.' : 'Nothing to reassign.')}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <PBtn variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="danger" size="lg" icon="trash" busy={busy} disabled={!canDelete} onClick={confirm}>Delete location</PBtn>
          </div>
        </div>
      </div>
      {newFor != null && <NewLocationInline side={side} storeId={location.store_id || null} onCancel={() => setNewFor(null)}
        onCreated={(loc) => { if (newFor === 'ALL') applyMoveAll(loc.id); else setRowDest(newFor, loc.id); setNewFor(null); }} />}
    </div>;
  }

  // ══ LIST — one side's table ═════════════════════════════════════════════
  function SideTable({ side, list, onAdd, onEdit, onDeactivate, onDelete }) {
    const P = useP();
    const columns = [
      { label: 'Name', render: (l) => <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{l.name}</div>
          <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{l.address || '—'}</div>
        </div> },
      { label: 'Kind', render: (l) => <Pill kind="neutral" dot>{KIND_LABEL[l.kind] || l.kind}</Pill> },
      { label: 'Capacity', align: 'right', render: (l) => <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>{l.capacity != null ? l.capacity : '—'}</span> },
      { label: 'Used by', align: 'right', render: (l) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{l.shell_count != null ? l.shell_count : '—'}{l.shell_count != null ? ' shell' + (l.shell_count === 1 ? '' : 's') : ''}</span> },
      { label: 'Status', render: (l) => l.active !== false ? <Pill kind="good" dot>Active</Pill> : <Pill kind="neutral" dot>Inactive</Pill> },
      { label: '', align: 'right', width: '160px', render: (l) => <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <IconBtn icon="scan" size={13} title="QR label — printing not wired up yet" label={'QR label for ' + l.name} style={{ width: 30, height: 30, opacity: .65 }} onClick={(e) => e.stopPropagation()} />
          <IconBtn icon={l.active !== false ? 'eye-off' : 'eye'} size={14} title={l.active !== false ? 'Deactivate' : 'Reactivate'} label={(l.active !== false ? 'Deactivate ' : 'Reactivate ') + l.name} style={{ width: 30, height: 30 }} onClick={() => onDeactivate(l)} />
          <IconBtn icon="pencil" size={14} label={'Edit ' + l.name} style={{ width: 30, height: 30 }} onClick={() => onEdit(l)} />
          <IconBtn icon="trash" size={14} label={'Delete ' + l.name} style={{ width: 30, height: 30 }} onClick={() => onDelete(l)} />
        </div> }
    ];
    return <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, flex: 1 }}>{side === 'foh' ? 'Front of house' : 'Back of house'}</span>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{list.length} location{list.length === 1 ? '' : 's'}</span>
        <PBtn variant="soft" size="xs" icon="plus" onClick={onAdd}>Add</PBtn>
      </div>
      {list.length === 0 ? <div style={{ padding: 22, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No {side === 'foh' ? 'front of house' : 'back of house'} locations for this store yet.</div> :
        <DataTable columns={columns} rows={list} rowKey={(l) => l.id} />}
    </Card>;
  }

  // ── QR label stub — a plain note, no fake action ──
  function QrNote() {
    const P = useP();
    return <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10, marginBottom: 18 }}>
      <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>The <b>QR label</b> button on each row is a placeholder — label printing isn't wired up yet. It will generate a scannable QR per location once the print pipeline lands (owner's RFID/QR-first rule, distribution/OWNER-NOTES.md 2026-09-10).</div>
    </div>;
  }

  // ══ MODULE ════════════════════════════════════════════════════════════════
  window.ShellLocationsModule = function ShellLocationsModule() {
    const P = useP();
    const [storeId, setStoreId] = React.useState(null);
    const list = S.useLocations(storeId, null);
    const status = S.useLocationsStatus(storeId, null);
    const [sheet, setSheet] = React.useState(null);       // { editing, side } | null
    const [deleteFor, setDeleteFor] = React.useState(null);
    const [flash, setFlash] = React.useState(null);
    const flashTimer = React.useRef(null);
    React.useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
    function showFlash(msg) {
      setFlash(msg);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 4200);
    }
    function toggleActive(l) { S.saveLocation({ id: l.id, name: l.name, kind: l.kind, address: l.address, store_id: l.store_id, capacity: l.capacity, active: !(l.active !== false) }).then((r) => { if (r.ok) showFlash((r.location.active !== false ? 'Reactivated ' : 'Deactivated ') + r.location.name + '.'); }); }

    const foh = (list || []).filter((l) => sideOf(l.kind) === 'foh');
    const boh = (list || []).filter((l) => sideOf(l.kind) === 'boh');

    return <div data-tour="shell-locations">
      <SectionHead level={1} eyebrow="Master Catalog" title="Locations"
        subtitle={(list ? list.length : 0) + ' locations · front and back of house, per store'}
        action={<StorePicker value={storeId} onChange={setStoreId} />} />

      <QrNote />

      {status.loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {[0, 1].map((i) => <Card key={i} padding={0}><div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}><window.Skeleton w={160} h={14} /></div><div style={{ padding: 16 }}><window.SkeletonRows rows={2} avatar={false} /></div></Card>)}
      </div>}

      {!status.loading && status.error === 'not-available' && <Card padding={0}><window.EmptyState icon="map-pin" title="Locations are not available on this server yet" body="This environment hasn't shipped the locations backend — the panel will populate the moment it does." /></Card>}
      {!status.loading && status.error && status.error !== 'not-available' && <Card padding={0}><window.ErrorState title="Locations didn't load" detail={status.error} onRetry={() => S.refreshLocations()} /></Card>}

      {!status.loading && !status.error && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SideTable side="foh" list={foh} onAdd={() => setSheet({ editing: null, side: 'foh' })} onEdit={(l) => setSheet({ editing: l, side: 'foh' })} onDeactivate={toggleActive} onDelete={setDeleteFor} />
        <SideTable side="boh" list={boh} onAdd={() => setSheet({ editing: null, side: 'boh' })} onEdit={(l) => setSheet({ editing: l, side: 'boh' })} onDeactivate={toggleActive} onDelete={setDeleteFor} />
      </div>}

      {sheet && <LocationSheet editing={sheet.editing} side={sheet.side} storeId={storeId}
        onClose={() => setSheet(null)}
        onSaved={(loc) => { setSheet(null); showFlash('Saved “' + loc.name + '”.'); }} />}

      {deleteFor && <ReassignModal location={deleteFor}
        onClose={() => setDeleteFor(null)}
        onDeleted={(res) => { setDeleteFor(null); showFlash('Deleted. ' + ((res && res.moved) || 0) + ' rows moved.'); }} />}

      {flash && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', background: P.ink, color: P.surface, borderRadius: 99, fontSize: 12.5, fontWeight: 600, boxShadow: P.shadowLg, zIndex: P.z.toast, whiteSpace: 'nowrap', maxWidth: '86vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flash}</div>}
    </div>;
  };

  // Exported for reuse by pos/product-shell.jsx's Placement section — the
  // same picker, the same meaning of "destination", wherever it's chosen.
  window.ShellLocationsModule.DestPicker = DestPicker;
  window.ShellLocationsModule.sideOf = sideOf;
  window.ShellLocationsModule.kindsFor = kindsFor;
  window.ShellLocationsModule.KIND_LABEL = KIND_LABEL;

  // openNew({ side, storeId, onCreated }) — a standalone create, the same
  // "mount a one-off into a detached root" trick ShellFormatsModule.openNew
  // uses, so a caller elsewhere on the page (the Placement section) can offer
  // "+ New location" without this module already being mounted.
  window.ShellLocationsModule.openNew = function openNew(opts) {
    opts = opts || {};
    const host = document.createElement('div');
    host.setAttribute('data-hw-shell-location-standalone', '');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    function teardown() { try { root.unmount(); } catch (e) { /* already gone */ } host.remove(); }
    root.render(<NewLocationInline side={opts.side || 'foh'} storeId={opts.storeId || null}
      onCancel={teardown}
      onCreated={(loc) => { teardown(); if (typeof opts.onCreated === 'function') opts.onCreated(loc); }} />);
  };
})();
