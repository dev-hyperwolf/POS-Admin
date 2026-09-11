// ── Shells — the Product Shell library, living inside Catalog ──────────────
// Library (grouped by brand) → shell detail → create shell. "Add variation"
// hands off to the one Add Product flow, pre-locked to a shell. A shell no
// longer carries its own price or traits (docs/SHELLS-PLAN-2026-09-09.md
// §1) and there is no edit-shell route — "Shell details" (window.
// ShellEditModal, pos/product-shell.jsx) is read-only.
;(function () {
  const useP = window.useP;
  const S = window.HW_SHELL;

  const MonoTile = ({ label, cat, size = 52, radius = 11, fs = 19 }) => {
    const P = useP();
    const c = window.HW.CAT_COLOR[cat] || P.neutral;
    return <span style={{ width: size, height: size, borderRadius: radius, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontFamily: P.fontMono, fontWeight: 800, fontSize: fs, letterSpacing: '.01em', color: c, background: c + (P.mode === 'dark' ? '26' : '1A'), boxShadow: `inset 0 0 0 1px ${c}44` }}>{label}</span>;
  };
  const CatDot = ({ cat }) => {
    const P = useP();
    return <span style={{ width: 8, height: 8, borderRadius: 2, background: window.HW.CAT_COLOR[cat] || P.neutral, flex: '0 0 auto' }} />;
  };
  const Ey = ({ children, style }) => {
    const P = useP();
    return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, ...style }}>{children}</span>;
  };
  const FTag = ({ children, kind }) => {
    const P = useP();
    const c = kind === 'good' ? P.good : kind === 'warn' ? P.warn : P.info;
    const bg = kind === 'good' ? P.goodSoft : kind === 'warn' ? P.warnSoft : P.infoSoft;
    return <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 99, background: bg, color: c, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{children}</span>;
  };
  const ChipToggle = ({ on, onClick, children }) => {
    const P = useP();
    return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r999, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap' }}>{children}</button>;
  };

  const isManagerSession = () => {
    const a = window.HW && window.HW.STATS && window.HW.STATS.associate;
    if (!a) return false;
    return window.HWContracts ? window.HWContracts.roleAtLeast(a.role, 'manager') : a.role === 'Floor Manager';
  };

  // Attributes unplaced entries to a brand when the derive report actually
  // carries one. The plan's own shape for `unplaced` is {sku, name, reason} —
  // no brand field documented — so this degrades to "no pill" rather than
  // guessing an attribution from a name match.
  function useUnplacedByBrand() {
    const status = S.useShellsStatus();
    const [byBrand, setByBrand] = React.useState({});
    const seenId = React.useRef(null);
    React.useEffect(() => {
      const id = status.lastReportId;
      if (!id || id === seenId.current) return;
      seenId.current = id;
      S.fetchDeriveReport(id).then((r) => {
        if (!r.ok) return;
        const unplaced = (r.report && r.report.unplaced) || [];
        const m = {};
        unplaced.forEach((u) => {
          const b = u.brand_name || u.brand || u.brand_key;
          if (!b) return;
          m[b] = (m[b] || 0) + 1;
        });
        setByBrand(m);
      });
    }, [status.lastReportId]);
    return byBrand;
  }

  // ── Catalogue — "Load hyperwolf.com catalogue" (Render's own deploy
  // carries only the 151-product demo seed; derive() has nothing to
  // classify until the real catalogue is loaded). Lives inside the
  // Derive-shells sheet, above the brand picker, since that sheet is
  // already manager-gated at its own launch button — this line never
  // renders for a non-manager. Same dry-run-then-Apply shape DeriveSheet
  // itself uses, kept as its own small component so the Derive flow below
  // is untouched.
  function CatalogueRow() {
    const P = useP();
    const status = S.useCatalogueStatus();
    const [phase, setPhase] = React.useState('idle'); // idle | dry | preview | applying | done
    const [result, setResult] = React.useState(null);
    const [err, setErr] = React.useState(null);

    const runDry = () => {
      setPhase('dry'); setErr(null);
      S.loadCatalogue(true).then((r) => {
        if (!r.ok) { setErr(r.hint || r.error); setPhase('idle'); return; }
        setResult(r); setPhase('preview');
      });
    };
    const apply = () => {
      setPhase('applying'); setErr(null);
      S.loadCatalogue(false).then((r) => {
        if (!r.ok) { setErr(r.hint || r.error); setPhase('preview'); return; }
        setResult(r); setPhase('done');
      });
    };

    const known = status.productsTotal != null && status.harvestRows != null;
    const loaded = known && status.productsTotal >= status.harvestRows;
    const label = status.loading ? 'Checking catalogue…' :
      status.error ? status.error :
      !known ? 'Catalogue status unavailable' :
      loaded ? `${status.productsTotal.toLocaleString()} products loaded · harvest ${status.harvestDate || '—'}` :
      `${status.productsTotal.toLocaleString()} products · hyperwolf.com catalogue not loaded`;

    return <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', marginBottom: 16, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
      <Ey style={{ flex: '0 0 auto' }}>Catalogue</Ey>
      <span style={{ fontSize: 12.5, color: known && !loaded ? P.warn : P.ink2, fontFamily: P.fontMono, flex: 1, minWidth: 160 }}>{label}</span>
      {phase === 'idle' && <PBtn variant="secondary" size="sm" onClick={runDry}>{loaded ? 'Re-check catalogue' : 'Load hyperwolf.com catalogue'}</PBtn>}
      {phase === 'dry' && <span style={{ fontSize: 11.5, color: P.inkMute }}>Running a dry run…</span>}
      {phase === 'applying' && <span style={{ fontSize: 11.5, color: P.inkMute }}>Applying…</span>}
      {(phase === 'preview' || phase === 'done') && result &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 100%' }}>
          <span style={{ fontSize: 11.5, color: P.ink2, fontFamily: P.fontMono }}>
            {result.rows_read} read · {result.created} new · {result.updated} updated · {result.unchanged} unchanged{result.rejected ? ` · ${result.rejected} rejected` : ''}
          </span>
          {phase === 'preview' && <PBtn variant="accent" size="sm" onClick={apply}>Apply</PBtn>}
          {phase === 'done' && <FTag kind="good">Loaded</FTag>}
        </div>}
      {err && <span style={{ fontSize: 11.5, color: P.bad, flex: '1 1 100%' }}>{err}</span>}
    </div>;
  }

  // ── Derive shells — dry run, then Apply ─────────────────────────────────
  function DeriveSheet({ onClose }) {
    const P = useP();
    // Brand options come from GET /api/shells/brands (real catalog brands),
    // never shared/brands.js — that file's own id scheme ('raw' for "Raw
    // Garden") is not what derive() matches against, and the checkbox
    // values here must be brand NAMES (derive() matches products.brand_name
    // case-insensitively, plan §3 POST /api/shells/derive), not keys.
    const brandRows = S.useBrands();
    const brandOptions = brandRows.map((b) => ({ key: b.brand_name, name: b.brand_name }));
    const [selected, setSelected] = React.useState(() => new Set());
    React.useEffect(() => {
      // Default-select the Phase 1 roster once the real brand list has
      // loaded, matched case-insensitively against brand_name.
      if (brandOptions.length === 0) return;
      setSelected((s) => s.size > 0 ? s : new Set(brandOptions.map((b) => b.name)));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brandRows.length]);
    const [phase, setPhase] = React.useState('pick'); // pick | dry | preview | applying | done
    const [result, setResult] = React.useState(null);
    const [err, setErr] = React.useState(null);
    const toggle = (k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const runDry = () => {
      setPhase('dry'); setErr(null);
      S.deriveShells([...selected], true).then((r) => {
        if (!r.ok) { setErr(r.hint || r.error); setPhase('pick'); return; }
        setResult(r); setPhase('preview');
      });
    };
    const apply = () => {
      setPhase('applying'); setErr(null);
      S.deriveShells([...selected], false).then((r) => {
        if (!r.ok) { setErr(r.hint || r.error); setPhase('preview'); return; }
        setResult(r); setPhase('done');
      });
    };
    return <div onClick={onClose} style={window.overlayScrim(P, { z: 230, padding: '32px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(640px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trending-up" size={16} stroke={2} /></span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Derive shells</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Build shells and assign products from the live catalog — Phase 1 brands</div></div>
          <IconBtn icon="x" size={16} onClick={onClose} />
        </div>
        <div style={{ padding: 20, maxHeight: '64vh', overflowY: 'auto' }}>
          {phase === 'pick' && <>
            <CatalogueRow />
            <Ey style={{ display: 'block', marginBottom: 8 }}>Brands</Ey>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {brandOptions.map((b) => <ChipToggle key={b.key} on={selected.has(b.key)} onClick={() => toggle(b.key)}>{b.name}</ChipToggle>)}
              {brandOptions.length === 0 && <span style={{ fontSize: 12.5, color: P.inkMute }}>No brands in the catalog to derive from.</span>}
            </div>
          </>}
          {phase === 'dry' && <div style={{ textAlign: 'center', padding: '30px 0', color: P.inkMute, fontSize: 12.5 }}>Running a dry run…</div>}
          {phase === 'applying' && <div style={{ textAlign: 'center', padding: '30px 0', color: P.inkMute, fontSize: 12.5 }}>Applying…</div>}
          {(phase === 'preview' || phase === 'done') && result && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              {[['Formats created', result.created_formats], ['Shells created', result.created_shells.length], ['Assigned', result.assigned]].map(([k, val]) =>
                <div key={k} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '10px 12px' }}>
                  <Ey style={{ fontSize: 10 }}>{k}</Ey>
                  <div style={{ fontSize: 18, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{val}</div>
                </div>)}
            </div>
            {result.unplaced.length > 0 ?
              <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', background: P.warnSoft, fontSize: 11.5, fontWeight: 700, color: P.ink }}>{result.unplaced.length} unplaced</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {result.unplaced.slice(0, 100).map((u, i) => <div key={i} style={{ padding: '7px 12px', borderTop: i ? `1px solid ${P.hairline}` : 'none', fontSize: 11.5, color: P.ink2 }}>
                    <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{u.sku}</span> {u.name} — <span style={{ color: P.inkMute }}>{u.reason}</span>
                  </div>)}
                </div>
              </div> :
              <div style={{ fontSize: 12.5, color: P.good }}>Nothing unplaced.</div>}
            {phase === 'done' && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: P.good }}>Applied — the library has been refreshed.</div>}
          </>}
          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: P.bad }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
          <PBtn variant="secondary" size="md" onClick={onClose}>{phase === 'done' ? 'Close' : 'Cancel'}</PBtn>
          <div style={{ flex: 1 }} />
          {phase === 'pick' && <PBtn variant="accent" size="md" onClick={runDry} disabled={selected.size === 0} style={{ opacity: selected.size === 0 ? .5 : 1 }}>Run dry run</PBtn>}
          {phase === 'preview' && <><PBtn variant="secondary" size="md" onClick={() => setPhase('pick')}>Back</PBtn><PBtn variant="accent" size="md" onClick={apply}>Apply</PBtn></>}
        </div>
      </div>
    </div>;
  }

  // ══ LIBRARY ═══════════════════════════════════════════════════════════════
  function Library({ onOpen, onCreate }) {
    const P = useP();
    const shells = S.useShells();
    const status = S.useShellsStatus();
    const [q, setQ] = React.useState('');
    const [closedBrands, setClosedBrands] = React.useState(() => new Set());
    const [deriveOpen, setDeriveOpen] = React.useState(false);
    const isManager = isManagerSession();
    const unplacedByBrand = useUnplacedByBrand();

    const filtered = shells.filter((s) => !q.trim() ||
      (s.brand + ' ' + s.format + ' ' + (s.sampleNames || []).join(' ')).toLowerCase().includes(q.trim().toLowerCase()));

    const byBrand = React.useMemo(() => {
      const m = {};
      filtered.forEach((s) => { (m[s.brand] = m[s.brand] || []).push(s); });
      return Object.keys(m).sort((a, b) => a.localeCompare(b)).map((brand) => ({
        brand,
        shells: [...m[brand]].sort((a, b) => a.format.localeCompare(b.format) || String(a.weight).localeCompare(String(b.weight))),
        shellCount: m[brand].length,
        productCount: m[brand].reduce((n, s) => n + (s.variationCount || 0), 0)
      }));
    }, [filtered]);
    const toggleBrand = (b) => setClosedBrands((s) => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n; });

    const ShellCard = (s) =>
      <Card key={s.id} hover padding={0} onClick={() => onOpen(s.id)} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 13, padding: '16px 16px 14px' }}>
          <MonoTile label={S.mono2(s.brand)} cat={s.cat} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}><CatDot cat={s.cat} /><Ey>{s.cat}</Ey></div>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.02em', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.format}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink2, marginTop: 2, fontFamily: P.fontMono }}>{s.weight}{s.pack > 1 ? ' · pack of ' + s.pack : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
          <div style={{ flex: 1, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9, padding: '8px 10px' }}>
            <Ey style={{ fontSize: 10 }}>Products</Ey>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 2 }}>{s.variationCount}</div>
          </div>
        </div>
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 20 }}>
          {(s.sampleNames || []).length === 0 ?
            <span style={{ fontSize: 11.5, color: P.inkMute }}>No products yet</span> :
            s.sampleNames.slice(0, 3).map((n, i) => <span key={i} style={{ fontSize: 11.5, color: P.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>)}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 16px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
          <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{s.id}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : '#7A5A00', flex: '0 0 auto' }}>Open shell<Icon name="chevron-right" size={14} stroke={2.2} /></span>
        </div>
      </Card>;

    return <div>
      <SectionHead level={1} eyebrow="Master Catalog" title="Product Shells"
        subtitle={`${shells.length} shells · ${shells.reduce((a, s) => a + (s.variationCount || 0), 0)} products across the line`}
        action={<div style={{ display: 'flex', gap: 8 }}>
          {isManager && <PBtn variant="secondary" size="md" icon="trending-up" onClick={() => setDeriveOpen(true)}>Derive shells</PBtn>}
          <PBtn variant="accent" size="md" icon="plus" onClick={onCreate}>New Shell</PBtn>
        </div>} />

      {status.error && shells.length === 0 &&
        <window.ErrorState body={status.error} detail={status.error} onRetry={() => S.refreshShells()} style={{ marginBottom: 20 }} />}
      {status.loading && shells.length === 0 && !status.error &&
        <window.SkeletonRows rows={4} />}

      {(!status.loading || shells.length > 0) && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 200, maxWidth: 360 }}><Field icon="search" size="md" placeholder="Search brand, format, product name…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{filtered.length} of {shells.length} shells</span>
        </div>

        {byBrand.length === 0 ?
          <window.EmptyState icon="box" title="No shells yet" body="Create the first shell, or run Derive shells to build them from the live catalog." action={<PBtn variant="accent" size="sm" icon="plus" onClick={onCreate}>New shell</PBtn>} /> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byBrand.map((g) => {
              const open = !closedBrands.has(g.brand) || !!q.trim();
              const unplaced = unplacedByBrand[g.brand];
              return <section key={g.brand} style={{ marginBottom: 6 }}>
                <button onClick={() => toggleBrand(g.brand)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 4px', background: 'transparent', border: 'none', borderBottom: `1px solid ${P.hairline2}`, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                  <Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} color={P.inkMute} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: P.ink, flex: 1 }}>{g.brand}</h2>
                  <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{g.shellCount} shell{g.shellCount === 1 ? '' : 's'} · {g.productCount} product{g.productCount === 1 ? '' : 's'}</span>
                  {unplaced ? <FTag kind="warn">{unplaced} unplaced</FTag> : null}
                </button>
                {open && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, marginTop: 14, marginBottom: 6 }}>
                  {g.shells.map(ShellCard)}
                </div>}
              </section>;
            })}
          </div>}
        <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, marginTop: 14, background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r14, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: 'pointer', fontFamily: P.fontSans, width: '100%' }}>
          <Icon name="plus" size={18} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>New shell</span>
        </button>
      </>}
      {deriveOpen && <DeriveSheet onClose={() => setDeriveOpen(false)} />}
    </div>;
  }

  // ══ DETAIL ════════════════════════════════════════════════════════════════
  function Detail({ id, onBack, onViewDetails, onAddVariation }) {
    const P = useP();
    const money = window.HW.fmt.money0;
    S.useShells();
    const s = S.shellById(id);
    const detail = S.useShellDetail(id);
    const [layout, setLayout] = React.useState('split');
    if (!s) return null;
    const shared = S.sharedRows(s);
    const products = (detail && detail.products) || [];
    const loadingProducts = !detail || (detail.loading && !detail.products);
    // "inherits: E1-A-01 (FOH) · S2-B-04 (BOH) · Flower Box 1" — every
    // variation reads the SAME chip because a variation has no placement of
    // its own; it only ever inherits the shell's (docs/SHELLS-PLAN-2026-09-
    // 09.md addendum). Read-only here — editing lives on Shell details'
    // Placement section (window.PlacementSection, pos/product-shell.jsx).
    const placementChip = React.useMemo(() => {
      const storeId = S.currentStoreId();
      const locs = detail && detail.shell && detail.shell.locations;
      const fohLbl = S.effectiveLocationLabel(locs ? { locations: locs } : null, storeId, 'foh');
      const bohLbl = S.effectiveLocationLabel(locs ? { locations: locs } : null, storeId, 'boh');
      const box = detail && detail.box;
      const parts = [];
      if (fohLbl.name) parts.push(fohLbl.name + ' (FOH)');
      if (bohLbl.name) parts.push(bohLbl.name + ' (BOH)');
      if (box && box.name) parts.push(box.name);
      return parts.length ? 'inherits: ' + parts.join(' · ') : null;
    }, [detail && detail.shell, detail && detail.box]);
    const stockColor = (q) => q === 0 ? P.bad : q < 10 ? P.warn : P.ink;
    const displayName = (p) => p.name_override || p.name || p.name_derived || p.sku;

    const SharedCard = <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <Icon name="lock" size={15} stroke={1.9} color={P.inkDim} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Shared by all variations</span>
      </div>
      {shared.map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', marginBottom: 8, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 600, color: P.inkDim }}>{f.label}{f.flag && <FTag>{f.flag}</FTag>}</span>
        <span style={{ textAlign: 'right', flex: '0 1 auto', minWidth: 0, maxWidth: '62%' }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{f.value}</span>
        </span>
      </div>)}
      <div style={{ marginTop: 16, padding: 12, background: P.surface2, border: `1px dashed ${P.hairline3}`, borderRadius: P.r10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: P.inkDim }}><Icon name="lightning" size={13} />Set once, at creation</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5, lineHeight: 1.4 }}>There is no edit for an existing shell — a different brand, format or size is a new shell. Price is set per variation, not shared.</div>
      </div>
    </Card>;

    const VarHead = <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Variations</span>
        <span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{loadingProducts ? s.variationCount : products.length} products</span>
      </div>
      <span style={{ fontSize: 11.5, color: P.inkMute }}>Only <b style={{ color: P.ink2, fontFamily: P.fontMono }}>Name · Type · Price</b> differ</span>
    </div>;

    return <div>
      <PBtn variant="ghost" size="sm" icon="chevron-left" onClick={onBack} style={{ marginLeft: -6, marginBottom: 12, color: P.inkDim }}>All shells</PBtn>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 20 }}>
        <MonoTile label={S.mono2(s.brand)} cat={s.cat} size={64} radius={14} fs={25} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}><CatDot cat={s.cat} /><span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{S.familyPath(s)}</span></div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>{s.name}</h1>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 4 }}>{s.id}</div>
        </div>
        <div style={{ display: 'flex', gap: 9, flex: '0 0 auto' }}>
          <PBtn variant="secondary" size="md" icon="info" onClick={() => onViewDetails(s.id)}>Shell details</PBtn>
          <PBtn variant="accent" size="md" icon="plus" onClick={() => onAddVariation(s.id)}>Add variation</PBtn>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Ey>Shell layout</Ey>
        <Seg value={layout} onChange={setLayout} size="sm" options={[{ value: 'split', icon: 'layout', label: 'Split' }, { value: 'stacked', icon: 'list', label: 'Stacked' }]} />
      </div>

      {detail && detail.error && <window.ErrorState compact body={detail.error} onRetry={() => S.fetchShellDetail(id, true)} style={{ marginBottom: 16 }} />}

      {layout === 'split' ?
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {SharedCard}
          <window.MarketPricingSection shell={s} />
        </div>
        <div style={{ minWidth: 0 }}>
          {VarHead}
          {loadingProducts ? <window.SkeletonRows rows={3} /> :
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .6fr .8fr', gap: 0, padding: '11px 16px', background: P.surface2, borderBottom: `1px solid ${P.hairline2}`, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim }}>
              <span>Variation</span><span>Type</span><span style={{ textAlign: 'right' }}>Stock</span><span style={{ textAlign: 'right' }}>Price</span>
            </div>
            {products.map((p, i) => <div key={p.sku} style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .6fr .8fr', gap: 0, alignItems: 'center', padding: '12px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <MonoTile label={S.mono1(displayName(p))} cat={s.cat} size={34} radius={8} fs={13} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: P.ink }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(p)}</span>{p.sample && <FTag kind="warn">Sample</FTag>}{p.name_override && <FTag>Manual</FTag>}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{p.sku}</div>
                  {placementChip && <div title="Read-only — edit from Shell details' Placement section" style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placementChip}</div>}
                </div>
              </div>
              <span>{p.variation && p.variation.type ? <StrainPill type={p.variation.type} /> : <span style={{ color: P.inkFaint }}>—</span>}</span>
              <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: stockColor(p.inventory || 0), fontFamily: P.fontMono }}>{p.inventory || 0}</span>
              <span style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(p.price)}</span>
            </div>)}
            {products.length === 0 && <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No variations yet — add the first strain or flavour.</div>}
            <button onClick={() => onAddVariation(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, background: 'transparent', border: 'none', borderTop: `1px dashed ${P.hairline2}`, color: P.mode === 'dark' ? P.accent : '#7A5A00', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="plus" size={15} stroke={2.2} />Add variation to this shell</button>
          </Card>}
        </div>
      </div> :
      <div>
        <Card padding={0} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 18px 0' }}>
            <Icon name="lock" size={15} stroke={1.9} color={P.inkDim} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Shared by all variations</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkMute }}>Set once, at creation</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, padding: 18 }}>
            {shared.map((f, i) => <div key={i} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ey style={{ fontSize: 10 }}>{f.label}</Ey>{f.flag && <FTag>{f.flag}</FTag>}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 4 }}>{f.value}</div>
            </div>)}
          </div>
        </Card>
        <window.MarketPricingSection shell={s} />
        {VarHead}
        {loadingProducts ? <window.SkeletonRows rows={3} /> :
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {products.map((p) => <Card key={p.sku} hover padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
              <MonoTile label={S.mono1(displayName(p))} cat={s.cat} size={40} radius={9} fs={15} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(p)}</div>
                <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{p.sku}</div>
                {placementChip && <div title="Read-only — edit from Shell details' Placement section" style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placementChip}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {p.variation && p.variation.type ? <StrainPill type={p.variation.type} /> : <span />}{p.sample && <FTag kind="warn">Sample</FTag>}{p.name_override && <FTag>Manual</FTag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTop: `1px solid ${P.hairline}` }}>
              <div><Ey style={{ fontSize: 10 }}>Stock</Ey><div style={{ fontSize: 13.5, fontWeight: 600, color: stockColor(p.inventory || 0), fontFamily: P.fontMono, marginTop: 2 }}>{p.inventory || 0}</div></div>
              <div style={{ textAlign: 'right' }}><span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(p.price)}</span></div>
            </div>
          </Card>)}
          <button onClick={() => onAddVariation(s.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 150, background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r14, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="plus" size={22} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>Add variation</span>
          </button>
        </div>}
      </div>}
    </div>;
  }

  // ══ MODULE ════════════════════════════════════════════════════════════════
  window.ShellsModule = function ShellsModule({ initialShell }) {
    const [route, setRoute] = React.useState(initialShell ? 'detail' : 'library');
    const [cur, setCur] = React.useState(initialShell || null);
    const [viewing, setViewing] = React.useState(null); // shell id shown in the read-only details modal
    const [addFor, setAddFor] = React.useState(null);
    const top = () => {const m = document.querySelector('main');if (m) m.scrollTop = 0;};
    const goto = (r) => {setRoute(r);top();};

    return <div data-tour="shells-module">
      {route === 'library' && <Library onOpen={(id) => {setCur(id);goto('detail');}} onCreate={() => goto('form')} />}
      {route === 'detail' && cur && <Detail id={cur} onBack={() => goto('library')} onViewDetails={(id) => setViewing(id)} onAddVariation={(id) => setAddFor(id)} />}
      {route === 'form' && <window.ShellForm onCancel={() => goto(cur ? 'detail' : 'library')} onSaved={(id) => {setCur(id);goto('detail');}} />}
      {viewing && <window.ShellEditModal shellId={viewing} onClose={() => setViewing(null)} />}
      {addFor && <window.AddProductFlow entry="shell" lockShell={addFor} onClose={() => setAddFor(null)} onDone={() => {setAddFor(null);setCur(addFor);goto('detail');}} />}
    </div>;
  };
})();
