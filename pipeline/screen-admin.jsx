// ── /admin/pipeline/[entityId] + /admin/catalog/products[/id] ─────────────
;(function () {
  const useP = window.useP;

  const MASTER_LABEL = {
    'mp-cartridges': 'Cartridges (platform master)', 'mp-connected': 'Connected — 3.5g flower', 'mp-alien': 'Alien Labs — flower',
    'mp-lowell': 'Lowell — flower', 'mp-kiva': 'Kiva Confections — edibles', 'mp-wyld': 'Wyld — edibles', 'mp-camino': 'Camino — gummies tin',
    'mp-stiiizy': 'STIIIZY — vape', 'mp-heavy': 'Heavy Hitters — vape', 'mp-select': 'Select — vape', 'mp-raw': 'Raw Garden — live resin',
    'mp-710': '710 Labs — concentrate', 'mp-jeeter': 'Jeeter — prerolls', 'mp-pax': 'PAX — hardware', 'mp-papa': 'Papa & Barkley — topicals', 'mp-cann': 'Cann — beverage',
  };
  const PACKAGING_TYPES = ['mylar_bag', 'wrapped_box', 'child_resistant_tin', 'glass_jar', 'plastic_tube', 'paper_box', 'other'];
  const TAMPER_DEFAULT = new Set(['mylar_bag', 'wrapped_box', 'child_resistant_tin']);

  function ToggleChip({ active, icon, label, onClick }) {
    const P = useP(), HD = window.HD;
    const seal = HD.tone(P, 'sealing');
    return (
      <button onClick={onClick} aria-pressed={active}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, cursor: 'pointer', fontFamily: P.fontSans,
          background: active ? seal.bg : P.canvas2, color: active ? seal.fg : P.inkMute, border: `1px solid ${active ? seal.fg + '66' : P.hairline2}` }}>
        <Icon name={icon} size={12} stroke={2} /><span>{label}</span>
      </button>);
  }

  function StageRow({ stage, index, onToggle, onRemove, onRename, onDragStart, onDragOver, onDrop, dragging }) {
    const P = useP(), HD = window.HD;
    const catalog = HD.STAGE_CATALOG[stage.stageKey];
    const [editing, setEditing] = React.useState(false);
    const dot = HD.tone(P, catalog.defaultColor).fg;
    return (
      <li draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: P.canvas, border: `1px solid ${P.hairline2}`, borderRadius: 10, padding: '8px 12px', opacity: dragging ? .5 : 1 }}>
        <span aria-label="Drag handle" style={{ padding: 4, color: P.inkMute, cursor: 'grab', display: 'inline-flex' }}><Icon name="drag" size={14} stroke={2} /></span>
        <span style={{ fontSize: 11, fontFamily: P.fontMono, color: P.inkMute, width: 24 }}>{index + 1}.</span>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: dot, flex: '0 0 auto' }} />
        {editing
          ? <input autoFocus value={stage.stageLabel} maxLength={24} onChange={(e) => onRename(stage.stageKey, e.target.value)}
            onBlur={() => setEditing(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
            style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 6, padding: '2px 8px', fontSize: 13, color: P.ink, width: 160, fontFamily: P.fontSans, outline: 'none' }} />
          : <button onClick={() => setEditing(true)} style={{ fontSize: 14, color: P.ink, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans }}>{stage.stageLabel}</button>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ToggleChip active={stage.requiresPhoto} icon="camera" label="photo" onClick={() => onToggle(stage.stageKey, 'requiresPhoto')} />
          <ToggleChip active={stage.requiresReasonCode} icon="chat" label="reason" onClick={() => onToggle(stage.stageKey, 'requiresReasonCode')} />
        </span>
        <button aria-label="Remove stage" onClick={() => onRemove(stage.stageKey)} style={{ padding: 4, background: 'none', border: 'none', color: P.inkMute, cursor: 'pointer', display: 'inline-flex' }}><Icon name="x" size={14} stroke={2} /></button>
      </li>);
  }

  window.ScreenAdminPipeline = function ScreenAdminPipeline({ path, navigate }) {
    const P = useP(), HD = window.HD;
    const entityId = path.split('/')[3] || 'thc';
    const entityMeta = HD.ENTITIES.find((e) => e.id === entityId);
    const [stages, setStages] = React.useState(() => HD.ENTITY_PIPELINE_CONFIG[entityId]?.stages ?? []);
    const [dirty, setDirty] = React.useState(false);
    const [addOpen, setAddOpen] = React.useState(false);
    const [dragKey, setDragKey] = React.useState(null);
    const seal = HD.tone(P, 'sealing');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    if (!entityMeta) {
      return (
        <div style={{ padding: 24, color: P.ink2 }}>
          Unknown entity <code style={{ fontFamily: P.fontMono }}>{entityId}</code>.{' '}
          <button onClick={() => navigate('#/batches')} style={{ background: 'none', border: 'none', padding: 0, color: accentInk, textDecoration: 'underline', cursor: 'pointer', fontFamily: P.fontSans }}>Back to batches</button>.
        </div>);
    }

    const toggle = (key, field) => { setStages((prev) => prev.map((s) => (s.stageKey === key ? { ...s, [field]: !s[field] } : s))); setDirty(true); };
    const rename = (key, label) => { setStages((prev) => prev.map((s) => (s.stageKey === key ? { ...s, stageLabel: label.slice(0, 24) } : s))); setDirty(true); };
    const remove = (key) => {
      if (key === 'incoming') { window.hdToast?.({ title: 'Incoming is required', description: "Every pipeline starts with Incoming — it's not removable.", tone: 'blocked' }); return; }
      setStages((prev) => prev.filter((s) => s.stageKey !== key).map((s, i) => ({ ...s, orderIndex: i })));
      setDirty(true);
    };
    const addStage = (key) => {
      if (stages.some((s) => s.stageKey === key)) return;
      const catalog = HD.STAGE_CATALOG[key];
      setStages((prev) => [...prev, { stageKey: key, stageLabel: catalog.displayName, orderIndex: prev.length, isRequired: true, requiresPhoto: key === 'sealing', requiresReasonCode: false, active: true }]);
      setDirty(true); setAddOpen(false);
    };
    const drop = (overKey) => {
      if (!dragKey || dragKey === overKey) return;
      const oldIdx = stages.findIndex((s) => s.stageKey === dragKey);
      const newIdx = stages.findIndex((s) => s.stageKey === overKey);
      if (oldIdx === -1 || newIdx === -1) return;
      const next = [...stages];
      next.splice(newIdx, 0, next.splice(oldIdx, 1)[0]);
      setStages(next.map((s, i) => ({ ...s, orderIndex: i })));
      setDirty(true); setDragKey(null);
    };
    function save() {
      HD.ENTITY_PIPELINE_CONFIG[entityId] = { entity: entityId, configVersion: HD.ENTITY_PIPELINE_CONFIG[entityId].configVersion + 1, stages: stages.map((s, i) => ({ ...s, orderIndex: i })) };
      setDirty(false);
      window.hdToast?.({ title: 'Pipeline saved', description: `${stages.length} stages · v${HD.ENTITY_PIPELINE_CONFIG[entityId].configVersion}. New batches use the updated flow.`, tone: 'ok' });
    }
    const availableToAdd = Object.values(HD.STAGE_CATALOG).filter((c) => c.isWorkflow && !stages.some((s) => s.stageKey === c.stageKey)).map((c) => c.stageKey);

    const overrideRows = [
      { master: 'Cartridges (all)', italic: false, scope: 'Platform-wide', added: 'sealing', skipped: '—', reason: 'Premium vape tamper-seal required by brand', link: null },
      { master: 'Kiva Camino gummies', italic: true, scope: 'Platform-wide', added: '—', skipped: 'sealing', reason: 'Wrapped box — tamper evidence already built in.', link: 'mp-kiva' },
      { master: 'Alien Labs flower', italic: true, scope: 'Platform-wide', added: '—', skipped: 'sealing', reason: 'Pre-sealed mylar bag.', link: 'mp-alien' },
    ];

    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <button onClick={() => navigate('#/batches')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: 6, fontSize: 12, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} /> Back to batches
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Pipeline config · {entityMeta.name}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkDim, maxWidth: 680 }}>Drag to reorder. Incoming is fixed; Approved, Quarantined, Recalled and Destroyed are universal and not configurable here.</p>
          </div>
          <PBtn variant="accent" onClick={save} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</PBtn>
        </div>

        <Card padding={16}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stages.map((s, i) => (
              <StageRow key={s.stageKey} stage={s} index={i} onToggle={toggle} onRemove={remove} onRename={rename}
                dragging={dragKey === s.stageKey}
                onDragStart={() => setDragKey(s.stageKey)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); drop(s.stageKey); }} />))}
          </ul>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline2}` }}>
            <button onClick={() => setAddOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 13, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="plus" size={14} stroke={2.2} /> Add stage from catalog
            </button>
            {addOpen && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availableToAdd.length === 0
                  ? <span style={{ fontSize: 12, color: P.inkMute, fontStyle: 'italic' }}>All workflow stages already in the pipeline.</span>
                  : availableToAdd.map((k) => (
                    <button key={k} onClick={() => addStage(k)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.canvas, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
                      + {HD.STAGE_CATALOG[k].displayName}
                    </button>))}
              </div>)}
          </div>
        </Card>

        <Card padding={16} style={{ marginTop: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Product overrides</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: P.inkDim }}>Specific masters add or skip stages (Phase 2 — pipeline.per_product_overrides_enabled).</p>
          </div>
          <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
            <HDTable>
              <thead><tr style={{ background: P.canvas }}><TH>Master</TH><TH>Scope</TH><TH>Added</TH><TH>Skipped</TH><TH>Reason</TH></tr></thead>
              <tbody>
                {overrideRows.map((r) => (
                  <tr key={r.master}>
                    <TD style={{ fontStyle: r.italic ? 'italic' : 'normal' }}>
                      {r.master}
                      {r.italic && <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontStyle: 'normal' }}>catalog-driven</span>}
                    </TD>
                    <TD style={{ color: P.inkMute }}>{r.scope}</TD>
                    <TD style={{ color: r.added === '—' ? P.inkMute : seal.fg }}>{r.added}</TD>
                    <TD style={{ color: r.skipped === '—' ? P.inkMute : seal.fg }}>{r.skipped}</TD>
                    <TD style={{ color: P.ink2 }}>
                      {r.reason}{' '}
                      {r.link && <button onClick={() => navigate(`#/admin/catalog/products/${r.link}`)} style={{ background: 'none', border: 'none', padding: 0, color: accentInk, cursor: 'pointer', fontFamily: P.fontSans, textDecoration: 'underline', textUnderlineOffset: 2 }}>Edit packaging →</button>}
                    </TD>
                  </tr>))}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };

  // ── Catalog ─────────────────────────────────────────────────────────────
  function CatalogIndex({ navigate }) {
    const P = useP(), HD = window.HD;
    const seal = HD.tone(P, 'sealing');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const rows = Object.values(HD.FAKE_MASTER_PACKAGING).sort((a, b) =>
      (MASTER_LABEL[a.masterProductId] ?? a.masterProductId).localeCompare(MASTER_LABEL[b.masterProductId] ?? b.masterProductId));
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <button onClick={() => navigate('#/batches')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: 6, fontSize: 12, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="arrow-left" size={12} stroke={2} /> Back to batches
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Catalog · Master products</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkDim, maxWidth: 680 }}>The packaging toggle drives the pipeline resolver. Products flagged tamper-evident auto-skip the Sealing stage at The Highest Craft.</p>
        <Card padding={0} style={{ marginTop: 20, overflow: 'hidden' }}>
          <HDTable>
            <thead><tr style={{ background: P.canvas }}><TH>Master</TH><TH>Packaging</TH><TH>Sealing at THC</TH><TH></TH></tr></thead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.masterProductId}>
                  <TD>
                    {MASTER_LABEL[r.masterProductId] ?? r.masterProductId}
                    <span style={{ display: 'block', fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>{r.masterProductId}</span>
                  </TD>
                  <TD style={{ color: P.ink2 }}>{r.packagingType ? HD.PACKAGING_TYPE_LABEL[r.packagingType] : '—'}</TD>
                  <TD>
                    {r.tamperEvidentPackaging
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: seal.fg, fontSize: 12 }}><Icon name="shield" size={12} stroke={2} /> Skip (tamper-evident)</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: P.ink2, fontSize: 12 }}><Icon name="lock" size={12} stroke={2} /> Seal required</span>}
                  </TD>
                  <TD align="right">
                    <button onClick={() => navigate(`#/admin/catalog/products/${r.masterProductId}`)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: accentInk, cursor: 'pointer', fontFamily: P.fontSans, textDecoration: 'underline', textUnderlineOffset: 2 }}>Edit →</button>
                  </TD>
                </TR>))}
            </tbody>
          </HDTable>
        </Card>
      </div>);
  }

  function CatalogEditor({ id, navigate }) {
    const P = useP(), HD = window.HD;
    const initial = HD.FAKE_MASTER_PACKAGING[id];
    const [packaging, setPackaging] = React.useState(initial?.packagingType ?? null);
    const [tamperEvident, setTamperEvident] = React.useState(initial?.tamperEvidentPackaging ?? false);
    const [dirty, setDirty] = React.useState(false);
    const [version, setVersion] = React.useState(0);
    const seal = HD.tone(P, 'sealing');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    if (!initial) {
      return (
        <div style={{ padding: 24, color: P.ink2 }}>
          Unknown master product <code style={{ fontFamily: P.fontMono }}>{id}</code>.{' '}
          <button onClick={() => navigate('#/admin/catalog/products')} style={{ background: 'none', border: 'none', padding: 0, color: accentInk, textDecoration: 'underline', cursor: 'pointer', fontFamily: P.fontSans }}>Back to catalog</button>
        </div>);
    }
    function save() {
      HD.FAKE_MASTER_PACKAGING[id] = { masterProductId: id, packagingType: packaging, tamperEvidentPackaging: tamperEvident };
      setDirty(false); setVersion((v) => v + 1);
      window.hdToast?.({ title: 'Packaging saved', description: tamperEvident ? 'Auto-skips Sealing at The Highest Craft going forward.' : 'Will seal at The Highest Craft by default.', tone: 'ok' });
    }
    const preview = React.useMemo(() => HD.resolveDetailed('thc', id), [id, version]);
    const sealingPresent = preview.stages.some((s) => s.stageKey === 'sealing');
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 20 }}>
        <button onClick={() => navigate('#/admin/catalog/products')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: 6, fontSize: 12, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="arrow-left" size={12} stroke={2} /> Back to catalog
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>{MASTER_LABEL[id] ?? id}</h1>
            <p style={{ margin: '4px 0 0', fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>{id}</p>
          </div>
          <PBtn variant="accent" onClick={save} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</PBtn>
        </div>

        <Card padding={16} style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Packaging</h2>
            {tamperEvident
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', borderRadius: 99, background: seal.bg, color: seal.fg, border: `1px solid ${seal.fg}66` }}><Icon name="shield" size={12} stroke={2} /> Auto-skips Sealing</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', borderRadius: 99, background: P.canvas2, color: P.ink2, border: `1px solid ${P.hairline2}` }}><Icon name="lock" size={12} stroke={2} /> Seal required</span>}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 12, color: P.ink2 }}>Packaging type</span>
              <select value={packaging ?? ''} onChange={(e) => { setPackaging(e.target.value); setTamperEvident(TAMPER_DEFAULT.has(e.target.value)); setDirty(true); }}
                style={{ marginTop: 4, width: '100%', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13, padding: '8px 10px', color: P.ink, fontFamily: P.fontSans }}>
                <option value="" disabled>Select…</option>
                {PACKAGING_TYPES.map((t) => <option key={t} value={t}>{HD.PACKAGING_TYPE_LABEL[t]}{TAMPER_DEFAULT.has(t) ? ' · skips by default' : ' · seals by default'}</option>)}
              </select>
            </label>
            <div>
              <span style={{ display: 'block', fontSize: 12, color: P.ink2 }}>Tamper-evident packaging</span>
              <div style={{ marginTop: 4, display: 'inline-flex', borderRadius: 8, border: `1px solid ${P.hairline3}`, overflow: 'hidden' }}>
                <button onClick={() => { setTamperEvident(true); setDirty(true); }}
                  style={{ padding: '8px 12px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: P.fontSans, background: tamperEvident ? seal.bg : 'transparent', color: tamperEvident ? seal.fg : P.ink2 }}>Yes — skip seal</button>
                <button onClick={() => { setTamperEvident(false); setDirty(true); }}
                  style={{ padding: '8px 12px', fontSize: 12, border: 'none', borderLeft: `1px solid ${P.hairline3}`, cursor: 'pointer', fontFamily: P.fontSans, background: !tamperEvident ? P.canvas2 : 'transparent', color: !tamperEvident ? P.ink : P.ink2 }}>No — seal at THC</button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: P.ink2, lineHeight: 1.45 }}>
            <strong>Does this product need sealing at THC?</strong> If the carton, mylar, or tin already provides tamper evidence, mark it "Yes — skip seal" so ops doesn't waste shrink-tube. The pipeline resolver auto-generates a sealing-skip override for this master.
          </div>
        </Card>

        <Card padding={16} style={{ marginTop: 20 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Pipeline preview · The Highest Craft</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: P.inkDim }}>Live preview of the effective pipeline for this master at THC. Saves apply immediately in-memory.</p>
          <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {preview.stages.map((s, i) => (
              <React.Fragment key={s.stageKey}>
                <li style={{ padding: '2px 8px', borderRadius: 8, background: P.canvas, border: `1px solid ${P.hairline2}`, fontSize: 12, color: P.ink }}>{s.stageLabel}</li>
                {i < preview.stages.length - 1 && <span style={{ color: P.inkMute }}>→</span>}
              </React.Fragment>))}
            {preview.skippedStages.includes('sealing') && (
              <li style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 8, border: `1px dashed ${seal.fg}66`, color: seal.fg, background: seal.bg, fontSize: 12, textDecoration: 'line-through' }}>Sealing skipped (tamper-evident)</li>)}
          </ol>
          {!sealingPresent && <p style={{ margin: '12px 0 0', fontSize: 12, color: seal.fg }}>This master skips the shrink-tube station. Floor staff see a "→ Shelf-Ready" arrow on the Labeling card.</p>}
        </Card>
      </div>);
  }

  window.ScreenAdminCatalog = function ScreenAdminCatalog({ path, navigate }) {
    const parts = path.split('/');
    const id = parts[4];
    return id ? <CatalogEditor id={id} navigate={navigate} /> : <CatalogIndex navigate={navigate} />;
  };
})();
