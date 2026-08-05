// ── /batches — the batch pipeline board ───────────────────────────────────
// Port of app/(shell)/batches/page.tsx + components/batches/filter-bar.tsx.
// Filters compose AND across keys, OR within a key; search is independent.
;(function () {
  const useP = window.useP;
  const AGE_BUCKETS = ['<1d', '1-3d', '3-7d', '>7d'];
  const STOCKOUT_RISKS = ['healthy', 'at_risk', 'stockout_imminent'];
  const STOCKOUT_RISK_LABEL = { healthy: 'Healthy', at_risk: 'At-risk', stockout_imminent: 'Stockout imminent' };
  const EMPTY_FILTERS = { entity: [], brand: [], category: [], status: [], age: [], stockoutRisk: [] };
  const bucketLabel = (b) => ({ '<1d': '< 1 day', '1-3d': '1-3 days', '3-7d': '3-7 days', '>7d': '> 7 days' }[b]);
  const hasActiveFilters = (f) => f.entity.length + f.brand.length + f.category.length + f.status.length + f.age.length + f.stockoutRisk.length > 0;

  function ageBucketFor(iso) {
    const days = (window.HD_DATA.NOW - new Date(iso).getTime()) / 86400000;
    if (days < 1) return '<1d';
    if (days < 3) return '1-3d';
    if (days < 7) return '3-7d';
    return '>7d';
  }
  // "Vape" matches "Vapes", "Pre-roll" matches "Pre-Rolls".
  const categoryMatches = (batchCat, filterCat) => batchCat.toLowerCase().replace(/s$/, '') === filterCat.toLowerCase().replace(/s$/, '');

  // Stockout risk per batch — derived from the buyer-analytics thermometer
  // when those fixtures are loaded; unmapped batches default to healthy.
  function buildStockoutMap(batches) {
    const skus = window.HD_BUYER?.BUYER_SKUS;
    const m = new Map();
    const idx = new Map();
    if (skus) skus.forEach((s) => idx.set(s.sku.toUpperCase(), s));
    for (const b of batches) {
      const match = idx.get(b.sku.toUpperCase());
      m.set(b.id, match && window.HD_BUYER?.stockHealth ? window.HD_BUYER.stockHealth(match, '30d') : 'healthy');
    }
    return m;
  }

  function FilterBar({ query, onQueryChange, filters, onFiltersChange, matchCount, brandOptions, categoryOptions, statusOptions }) {
    const P = useP(), HD = window.HD;
    const active = hasActiveFilters(filters);
    return (
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Field icon="search" size="sm" value={query} onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by SKU, product, METRC, HUID, or brand…" aria-label="Search batches" type="search" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <MultiSelectFilter label="Entity" options={HD.ENTITIES.map((e) => ({ id: e.id, label: e.name }))} value={filters.entity} onChange={(v) => onFiltersChange({ ...filters, entity: v })} />
          <MultiSelectFilter label="Brand" options={brandOptions.map((b) => ({ id: b, label: b }))} value={filters.brand} onChange={(v) => onFiltersChange({ ...filters, brand: v })} />
          <MultiSelectFilter label="Category" options={categoryOptions.map((c) => ({ id: c, label: c }))} value={filters.category} onChange={(v) => onFiltersChange({ ...filters, category: v })} />
          <MultiSelectFilter label="Status" options={statusOptions.map((s) => ({ id: s, label: HD.BATCH_STATUS_LABEL[s] }))} value={filters.status} onChange={(v) => onFiltersChange({ ...filters, status: v })} />
          <MultiSelectFilter label="Age" options={AGE_BUCKETS.map((b) => ({ id: b, label: bucketLabel(b) }))} value={filters.age} onChange={(v) => onFiltersChange({ ...filters, age: v })} />
          <MultiSelectFilter label="Stockout risk" options={STOCKOUT_RISKS.map((s) => ({ id: s, label: STOCKOUT_RISK_LABEL[s] }))} value={filters.stockoutRisk} onChange={(v) => onFiltersChange({ ...filters, stockoutRisk: v })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            {active && <button type="button" onClick={() => onFiltersChange(EMPTY_FILTERS)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Clear filters</button>}
            <span style={{ fontSize: 12.5, color: P.inkMute, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: P.ink }}>{matchCount}</span> {matchCount === 1 ? 'batch' : 'batches'} matching
            </span>
          </div>
        </div>
      </div>);
  }

  window.ScreenBatches = function ScreenBatches({ entity, setEntity, navigate }) {
    const P = useP(), HD = window.HD;
    const [rawQuery, setRawQuery] = React.useState('');
    const [debouncedQuery, setDebouncedQuery] = React.useState('');
    const [filters, setFilters] = React.useState(EMPTY_FILTERS);
    React.useEffect(() => { const t = setTimeout(() => setDebouncedQuery(rawQuery), 200); return () => clearTimeout(t); }, [rawQuery]);

    const entityScoped = React.useMemo(() => window.HD_DATA.BATCHES.filter((b) => b.entity === entity), [entity]);
    const { activeBatches, archivedCount } = React.useMemo(() => {
      const active = []; let archived = 0;
      for (const b of entityScoped) { if (HD.isArchived(b)) archived += 1; else active.push(b); }
      return { activeBatches: active, archivedCount: archived };
    }, [entityScoped]);

    const brandOptions = React.useMemo(() => [...new Set(activeBatches.map((b) => b.brand))].sort(), [activeBatches]);
    const categoryOptions = React.useMemo(() => {
      const SPEC_CATS = ['Flower', 'Vapes', 'Edibles', 'Pre-Rolls', 'Concentrates', 'Topicals'];
      return SPEC_CATS.filter((c) => activeBatches.some((b) => categoryMatches(b.category, c)));
    }, [activeBatches]);
    const workflowStages = React.useMemo(() => HD.getWorkflowStages(entity), [entity]);
    const statusOptions = React.useMemo(() => [...workflowStages.map((s) => s.stageKey), 'quarantined', 'recalled', 'destroyed'], [workflowStages]);
    const stockoutMap = React.useMemo(() => buildStockoutMap(activeBatches), [activeBatches]);

    const filteredBatches = React.useMemo(() => {
      const q = debouncedQuery.trim().toLowerCase();
      return activeBatches.filter((b) => {
        if (q) {
          const huidHit = b.huidList?.some((h) => h.toLowerCase().includes(q)) ?? false;
          if (!b.productName.toLowerCase().includes(q) && !b.sku.toLowerCase().includes(q) && !b.metrcPackageId.toLowerCase().includes(q) && !b.brand.toLowerCase().includes(q) && !huidHit) return false;
        }
        if (filters.entity.length > 0 && !filters.entity.includes(b.entity)) return false;
        if (filters.brand.length > 0 && !filters.brand.includes(b.brand)) return false;
        if (filters.category.length > 0 && !filters.category.some((c) => categoryMatches(b.category, c))) return false;
        if (filters.status.length > 0 && !filters.status.includes(b.status)) return false;
        if (filters.age.length > 0 && !filters.age.includes(ageBucketFor(b.statusEnteredAt))) return false;
        if (filters.stockoutRisk.length > 0 && !filters.stockoutRisk.includes(stockoutMap.get(b.id) ?? 'healthy')) return false;
        return true;
      });
    }, [activeBatches, debouncedQuery, filters, stockoutMap]);

    const totalUnits = filteredBatches.reduce((s, b) => s + b.qty, 0);
    const totalValue = filteredBatches.reduce((s, b) => s + b.qty * b.unitValue, 0);
    const hasSealing = workflowStages.some((s) => s.stageKey === 'sealing');
    const entityMeta = HD.ENTITIES.find((e) => e.id === entity);
    const configVersion = HD.ENTITY_PIPELINE_CONFIG[entity].configVersion;
    const anyActive = debouncedQuery.trim().length > 0 || hasActiveFilters(filters);
    const seal = HD.tone(P, 'sealing');
    const unmapped = window.HD_PRODUCTS?.UNMAPPED_BATCHES ?? [];

    function clearAll() { setRawQuery(''); setFilters(EMPTY_FILTERS); }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>Batch pipeline</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: P.inkMute }}>Drag cards across columns to progress.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {hasSealing && (
                <div title={`Sealing active for ${entityMeta?.short ?? entity.toUpperCase()} · C12 shrink-tube tamper station`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 99, background: seal.bg, border: `1px solid ${seal.fg}66`, fontSize: 11.5, color: seal.fg }}>
                  <Icon name="shield" size={12} stroke={2} />
                  <span>Sealing active for {entityMeta?.short ?? entity.toUpperCase()}</span>
                  <span style={{ opacity: .7 }}>· C12 shrink-tube tamper station</span>
                </div>)}
              {archivedCount > 0 && (
                <button onClick={() => navigate('#/batches/archive')} title="View archived batches (approved · destroyed · resolved recalls · shelf-ready > 7d)"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 99, background: P.surface, border: `1px solid ${P.hairline2}`, fontSize: 11.5, color: P.inkDim, cursor: 'pointer', fontFamily: P.fontSans }}>
                  <Icon name="box" size={11} stroke={2} />
                  <span>{archivedCount} archived · view archive →</span>
                </button>)}
              {unmapped.length > 0 && (
                <button onClick={() => navigate('#/products')} title="Map unmapped batches to a product wrapper"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 9px', borderRadius: 99, background: HD.tone(P, 'warn').bg, border: `1px solid ${HD.tone(P, 'warn').fg}4d`, color: HD.tone(P, 'warn').fg, fontSize: 11.5, cursor: 'pointer', fontFamily: P.fontSans }}>
                  <Icon name="link" size={11} stroke={2} />{unmapped.length} unmapped
                </button>)}
            </div>
          </div>
          <div style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface, boxShadow: P.shadowSm, overflow: 'hidden', minWidth: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: `1px solid ${P.hairline}`, background: P.surface2 }}>
              <MicroLabel style={{ fontSize: 10, letterSpacing: '.08em' }}>Currently shown</MicroLabel>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: HD.tone(P, 'ok').fg, fontFamily: P.fontMono }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: HD.tone(P, 'ok').fg }} />LIVE
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>v{configVersion} · {workflowStages.length} stages</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ padding: '7px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                <MicroLabel>Entity</MicroLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: HD.hueColor(P, entityMeta?.hue), flex: '0 0 auto' }} />
                  <select aria-label="Entity filter" value={entity} onChange={(e) => setEntity(e.target.value)}
                    style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13.5, padding: '3px 8px', color: P.ink, fontFamily: P.fontSans }}>
                    {HD.ENTITIES.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ padding: '7px 12px', borderLeft: `1px solid ${P.hairline}` }}><MicroLabel>Batches</MicroLabel><DisplayNum>{filteredBatches.length}</DisplayNum></div>
              <div style={{ padding: '7px 12px', borderLeft: `1px solid ${P.hairline}` }}><MicroLabel>Units</MicroLabel><DisplayNum>{totalUnits.toLocaleString()}</DisplayNum></div>
              <div style={{ padding: '7px 12px', borderLeft: `1px solid ${P.hairline}` }}>
                <MicroLabel style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Value</span>
                  <span title="Sum across all batches matching your current entity + search + filter selection. Updates live as you filter." aria-label="Value calculation help" style={{ display: 'inline-flex', cursor: 'help' }}><Icon name="info" size={11} stroke={2} /></span>
                </MicroLabel>
                <DisplayNum>{HD.formatCurrency(totalValue, { showCents: false })}</DisplayNum>
              </div>
              <div style={{ marginLeft: 'auto', padding: '7px 10px', borderLeft: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center' }}>
                <PBtn size="xs" variant="secondary" icon="settings" onClick={() => navigate(`#/admin/pipeline/${entity}`)}>Configure</PBtn>
              </div>
            </div>
          </div>
        </div>
        <FilterBar query={rawQuery} onQueryChange={setRawQuery} filters={filters} onFiltersChange={setFilters}
          matchCount={filteredBatches.length} brandOptions={brandOptions} categoryOptions={categoryOptions} statusOptions={statusOptions} />
        <div style={{ flex: 1, minHeight: 0, paddingTop: 16 }}>
          {filteredBatches.length === 0
            ? <HDEmpty style={{ height: '100%', justifyContent: 'center' }} title="No batches match."
              body={anyActive ? 'Your filters cleared the board. Drop one, or clear them all to see every batch again.' : 'This entity has no active batches on the board right now.'}
              action={anyActive ? <PBtn size="sm" variant="secondary" onClick={clearAll}>Clear all</PBtn> : undefined} />
            : <KanbanBoard initial={filteredBatches} entity={entity} />}
        </div>
      </div>);
  };

  Object.assign(window, { AGE_BUCKETS, STOCKOUT_RISKS, STOCKOUT_RISK_LABEL, EMPTY_FILTERS, ageBucketFor, categoryMatches });
})();
