// ── Shells — the Product Shell library, living inside Catalog ──────────────
// Library → shell detail (split or stacked) → create / edit shell.
// "Add variation" hands off to the one Add Product flow, pre-locked to a shell.
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
  function Sel({ value, onChange, options, title }) {
    const P = useP();
    return <div style={{ position: 'relative' }} title={title}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', padding: '8px 30px 8px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontSans, outline: 'none', cursor: 'pointer' }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <Icon name="chevron-down" size={12} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }

  // ══ LIBRARY ═══════════════════════════════════════════════════════════════
  function Library({ onOpen, onCreate }) {
    const P = useP();
    const money = window.HW.fmt.money0;
    const shells = S.useShells();
    const [q, setQ] = React.useState('');
    const [fCat, setFCat] = React.useState('All');
    const [fBrand, setFBrand] = React.useState('All');
    const [fSub, setFSub] = React.useState('All');
    const [fWeight, setFWeight] = React.useState('All');
    const [sortBy, setSortBy] = React.useState('grouped');
    const [banner, setBanner] = React.useState(true);

    const uniq = (a) => [...new Set(a)];
    const filtered = shells.filter((s) =>
    (fCat === 'All' || s.cat === fCat) && (fBrand === 'All' || s.brand === fBrand) && (fSub === 'All' || s.sub === fSub) && (fWeight === 'All' || s.weight === fWeight) && (
    !q.trim() || (s.brand + ' ' + s.sub + ' ' + s.weight + ' ' + s.cat + ' ' + s.format).toLowerCase().includes(q.trim().toLowerCase())));
    const active = fCat !== 'All' || fBrand !== 'All' || fSub !== 'All' || fWeight !== 'All' || sortBy !== 'grouped' || !!q.trim();
    const opt = (all, list) => [{ value: 'All', label: all }, ...uniq(list).map((x) => ({ value: x, label: x }))];

    // Default view is the merchandising order: category → subcategory → brand
    // A–Z, so a shell sits where staff would look for it on the menu.
    const grouped = sortBy === 'grouped';
    const rows = [...filtered].sort((a, b) =>
    sortBy === 'priceLow' ? a.price - b.price : sortBy === 'priceHigh' ? b.price - a.price : a.brand.localeCompare(b.brand) || a.sub.localeCompare(b.sub));
    const catOrder = S.TAX.map((c) => c.key);
    const groups = React.useMemo(() => {
      if (!grouped) return [];
      const byCat = {};
      filtered.forEach((s) => {(byCat[s.cat] = byCat[s.cat] || {})[s.sub] = [...byCat[s.cat][s.sub] || [], s];});
      return Object.keys(byCat).
      sort((a, b) => (catOrder.indexOf(a) + 1 || 99) - (catOrder.indexOf(b) + 1 || 99) || a.localeCompare(b)).
      map((cat) => ({ cat,
        count: Object.values(byCat[cat]).reduce((n, l) => n + l.length, 0),
        subs: Object.keys(byCat[cat]).sort((a, b) => a.localeCompare(b)).
        map((sub) => ({ sub, list: [...byCat[cat][sub]].sort((a, b) => a.brand.localeCompare(b.brand) || a.weight.localeCompare(b.weight)) })) }));
    }, [filtered, grouped]);

      const ShellCard = (s) =>
      <Card key={s.id} hover padding={0} onClick={() => onOpen(s.id)} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 13, padding: '16px 16px 14px' }}>
          <MonoTile label={S.mono2(s.brand)} cat={s.cat} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}><CatDot cat={s.cat} /><Ey>{s.cat}</Ey></div>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.02em', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.brand}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub} · {s.weight}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
          {[['Variations', s.variations.length], ['Sells at', s.sale ? money(s.sale) : money(s.price)], ['In stock', S.totalStock(s)]].map(([k, v]) =>
          <div key={k} style={{ flex: 1, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9, padding: '8px 10px' }}>
            <Ey style={{ fontSize: 10 }}>{k}</Ey>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 2 }}>{v}</div>
            {k === 'Sells at' && s.sale ? <div style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono, textDecoration: 'line-through' }}>{money(s.price)}</div> : null}
          </div>)}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 16px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            {s.variations.slice(0, 3).map((v, i) => <StrainPill key={i} type={v.strain || 'Hybrid'} />)}
            {s.variations.length > 3 && <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>+{s.variations.length - 3}</span>}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : '#7A5A00', flex: '0 0 auto' }}>Open shell<Icon name="chevron-right" size={14} stroke={2.2} /></span>
        </div>
      </Card>;

    return <div>
      <SectionHead level={1} eyebrow="Master Catalog" title="Product Shells"
      subtitle={`${shells.length} shells · ${shells.reduce((a, s) => a + s.variations.length, 0)} products across the line`}
      action={<PBtn variant="accent" size="md" icon="plus" onClick={onCreate}>New Shell</PBtn>} />

      {banner && <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', background: P.accentSoft, border: `1px solid ${P.accentBorder}`, borderRadius: P.r14, marginBottom: 20 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="lightning" size={19} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Shells replace pricing templates</div>
          <div style={{ fontSize: 12.5, color: P.mode === 'dark' ? P.accent : '#7A5A00', marginTop: 2, lineHeight: 1.4 }}>A shell locks a family’s shared details — brand, format, subcategory, size, pricing, traits, delivery box — so a new variation is over half pre-filled. Group a family once, update the whole line at once.</div>
        </div>
        <PBtn variant="ghost" size="sm" onClick={() => setBanner(false)}>Got it</PBtn>
      </div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 200, maxWidth: 360 }}><Field icon="search" size="md" placeholder="Search shells, brand, subcategory…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{filtered.length} of {shells.length} shells</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Sel value={fCat} onChange={setFCat} options={opt('All categories', shells.map((s) => s.cat))} title="Filter by category" />
          <Sel value={fBrand} onChange={setFBrand} options={opt('All brands', shells.map((s) => s.brand))} title="Filter by brand" />
          <Sel value={fSub} onChange={setFSub} options={opt('All subcategories', shells.map((s) => s.sub))} title="Filter by subcategory" />
          <Sel value={fWeight} onChange={setFWeight} options={opt('All sizes', shells.map((s) => s.weight))} title="Filter by weight / size" />
          <span style={{ width: 1, height: 22, background: P.hairline2 }} />
          <Sel value={sortBy} onChange={setSortBy} options={[{ value: 'grouped', label: 'Grouped: Category → Sub → Brand' }, { value: 'name', label: 'Flat: Brand A–Z' }, { value: 'priceLow', label: 'Flat: Price low → high' }, { value: 'priceHigh', label: 'Flat: Price high → low' }]} title="Grouped puts every shell under its category and subcategory; the flat options list them all together." />
          <div style={{ flex: 1 }} />
          {active && <PBtn variant="ghost" size="sm" icon="x" onClick={() => {setFCat('All');setFBrand('All');setFSub('All');setFWeight('All');setSortBy('grouped');setQ('');}}>Clear</PBtn>}
        </div>
      </div>

      {grouped ?
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {groups.map((g) =>
        <section key={g.cat}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 16, borderBottom: `1px solid ${P.hairline2}` }}>
            <CatDot cat={g.cat} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>{g.cat}</h2>
            <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{g.count} shell{g.count === 1 ? '' : 's'} · {g.subs.length} subcategor{g.subs.length === 1 ? 'y' : 'ies'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {g.subs.map((sg) =>
            <div key={sg.sub}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <Ey style={{ fontSize: 10, color: P.inkDim }}>{sg.sub}</Ey>
                <span style={{ flex: 1, height: 1, background: P.hairline }} />
                <span style={{ fontSize: 11.5, color: P.inkFaint, fontFamily: P.fontMono }}>{sg.list.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>{sg.list.map(ShellCard)}</div>
            </div>)}
          </div>
        </section>)}
        {groups.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13.5, color: P.inkMute }}>No shells match those filters.</div>}
        <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r14, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="plus" size={18} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>New shell</span>
        </button>
      </div> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {rows.map(ShellCard)}
        <button onClick={onCreate} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 180, background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r14, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="plus" size={22} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>New shell</span>
        </button>
      </div>}
    </div>;
  }

  // ══ DETAIL ════════════════════════════════════════════════════════════════
  function Detail({ id, onBack, onEdit, onAddVariation }) {
    const P = useP();
    const money = window.HW.fmt.money0;
    S.useShells();
    const s = S.shellById(id);
    const [layout, setLayout] = React.useState('split');
    if (!s) return null;
    const shared = S.sharedRows(s);
    const stockColor = (q) => q === 0 ? P.bad : q < 10 ? P.warn : P.ink;

    const SharedCard = <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <Icon name="lock" size={15} stroke={1.9} color={P.inkDim} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Shared by all variations</span>
      </div>
      {shared.map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', marginBottom: 8, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 600, color: P.inkDim }}>{f.label}{f.flag && <FTag>{f.flag}</FTag>}</span>
        <span style={{ textAlign: 'right', flex: '0 0 auto' }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{f.value}</span>
          {f.sub && <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{f.sub}</span>}
        </span>
      </div>)}
      {(s.traits || []).length > 0 && <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Ey style={{ fontSize: 10 }}>Product traits · carry across the line</Ey>
          <span title="Every product trait & sub-trait: pieces per pack, pack of 5 pre-rolls, infused with diamonds. Set once on the shell; applies to the whole family." style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} /></span></div>
        {s.traits.map((t, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ fontSize: 12.5, color: P.inkDim }}>{t.label}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{t.value}</span>
        </div>)}
      </div>}
      <div style={{ marginTop: 16, padding: 12, background: P.surface2, border: `1px dashed ${P.hairline3}`, borderRadius: P.r10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: P.inkDim }}><Icon name="lightning" size={13} />Change once, applies everywhere</div>
        <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5, lineHeight: 1.4 }}>Editing the retail or sale price here updates every non-overridden variation in this shell.</div>
      </div>
    </Card>;

    const VarHead = <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Variations</span>
        <span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{s.variations.length} products</span>
      </div>
      <span style={{ fontSize: 11.5, color: P.inkMute }}>Only <b style={{ color: P.ink2, fontFamily: P.fontMono }}>Name · Strain · Price</b> differ</span>
    </div>;

    return <div>
      <PBtn variant="ghost" size="sm" icon="chevron-left" onClick={onBack} style={{ marginLeft: -6, marginBottom: 12, color: P.inkDim }}>All shells</PBtn>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 20 }}>
        <MonoTile label={S.mono2(s.brand)} cat={s.cat} size={64} radius={14} fs={25} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}><CatDot cat={s.cat} /><span style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono }}>{S.familyPath(s)}</span></div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>{s.name}</h1>
          <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 4 }}>{s.id} · {s.stores} store{s.stores > 1 ? 's' : ''} · {S.totalStock(s)} in stock</div>
        </div>
        <div style={{ display: 'flex', gap: 9, flex: '0 0 auto' }}>
          <PBtn variant="secondary" size="md" icon="pencil" onClick={() => onEdit(s.id)}>Edit shell</PBtn>
          <PBtn variant="accent" size="md" icon="plus" onClick={() => onAddVariation(s.id)}>Add variation</PBtn>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Ey>Shell layout</Ey>
        <Seg value={layout} onChange={setLayout} size="sm" options={[{ value: 'split', icon: 'layout', label: 'Split' }, { value: 'stacked', icon: 'list', label: 'Stacked' }]} />
      </div>

      {layout === 'split' ?
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {SharedCard}
        <div style={{ minWidth: 0 }}>
          {VarHead}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .6fr .8fr 44px', gap: 0, padding: '11px 16px', background: P.surface2, borderBottom: `1px solid ${P.hairline2}`, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim }}>
              <span>Variation</span><span>Type</span><span style={{ textAlign: 'right' }}>Stock</span><span style={{ textAlign: 'right' }}>Price</span><span />
            </div>
            {s.variations.map((v, i) => <div key={v.sku} style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .6fr .8fr 44px', gap: 0, alignItems: 'center', padding: '12px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <MonoTile label={S.mono1(v.name)} cat={s.cat} size={34} radius={8} fs={13} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: P.ink }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>{v.sample && <FTag kind="warn">Sample</FTag>}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{v.sku}</div>
                </div>
              </div>
              <span>{v.strain ? <StrainPill type={v.strain} /> : <span style={{ color: P.inkFaint }}>—</span>}</span>
              <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: stockColor(v.qty || 0), fontFamily: P.fontMono }}>{v.qty || 0}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(v.price)}</span>
                {v.override ? <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', color: P.warn, fontFamily: P.fontMono }}>OVERRIDE</span> : <span style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono }}>inherited</span>}
              </div>
              <span style={{ textAlign: 'right' }}><IconBtn icon="pencil" size={15} style={{ width: 32, height: 32 }} onClick={() => onEdit(s.id)} /></span>
            </div>)}
            {s.variations.length === 0 && <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No variations yet — add the first flavour or strain.</div>}
            <button onClick={() => onAddVariation(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, background: 'transparent', border: 'none', borderTop: `1px dashed ${P.hairline2}`, color: P.mode === 'dark' ? P.accent : '#7A5A00', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="plus" size={15} stroke={2.2} />Add variation to this shell</button>
          </Card>
        </div>
      </div> :
      <div>
        <Card padding={0} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 18px 0' }}>
            <Icon name="lock" size={15} stroke={1.9} color={P.inkDim} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Shared by all variations</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkMute }}>Change once, applies to the whole line</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, padding: 18 }}>
            {shared.map((f, i) => <div key={i} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Ey style={{ fontSize: 10 }}>{f.label}</Ey>{f.flag && <FTag>{f.flag}</FTag>}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 4 }}>{f.value}</div>
              {f.sub && <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{f.sub}</div>}
            </div>)}
            {(s.traits || []).map((t, i) => <div key={'t' + i} style={{ background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10, padding: '11px 13px' }}>
              <Ey style={{ fontSize: 10 }}>{t.label}</Ey>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 4 }}>{t.value}</div>
            </div>)}
          </div>
        </Card>
        {VarHead}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {s.variations.map((v) => <Card key={v.sku} hover padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
              <MonoTile label={S.mono1(v.name)} cat={s.cat} size={40} radius={9} fs={15} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{v.sku}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {v.strain ? <StrainPill type={v.strain} /> : <span />}{v.sample && <FTag kind="warn">Sample</FTag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTop: `1px solid ${P.hairline}` }}>
              <div><Ey style={{ fontSize: 10 }}>Stock</Ey><div style={{ fontSize: 13.5, fontWeight: 600, color: stockColor(v.qty || 0), fontFamily: P.fontMono, marginTop: 2 }}>{v.qty || 0}</div></div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(v.price)}</span>
                <div>{v.override ? <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', color: P.warn, fontFamily: P.fontMono }}>OVERRIDE</span> : <span style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono }}>inherited</span>}</div>
              </div>
            </div>
          </Card>)}
          <button onClick={() => onAddVariation(s.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 150, background: 'transparent', border: `1.5px dashed ${P.hairline3}`, borderRadius: P.r14, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="plus" size={22} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>Add variation</span>
          </button>
        </div>
      </div>}
    </div>;
  }

  // ══ MODULE ════════════════════════════════════════════════════════════════
  window.ShellsModule = function ShellsModule({ initialShell }) {
    const [route, setRoute] = React.useState(initialShell ? 'detail' : 'library');
    const [cur, setCur] = React.useState(initialShell || null);
    const [editing, setEditing] = React.useState(null);
    const [addFor, setAddFor] = React.useState(null);
    const top = () => {const m = document.querySelector('main');if (m) m.scrollTop = 0;};
    const goto = (r) => {setRoute(r);top();};

    return <div data-tour="shells-module">
      {route === 'library' && <Library onOpen={(id) => {setCur(id);goto('detail');}} onCreate={() => {setEditing(null);goto('form');}} />}
      {route === 'detail' && cur && <Detail id={cur} onBack={() => goto('library')} onEdit={(id) => {setEditing(id);goto('form');}} onAddVariation={(id) => setAddFor(id)} />}
      {route === 'form' && <window.ShellForm editingId={editing} onCancel={() => goto(editing ? 'detail' : 'library')} onSaved={(id) => {setCur(id);setEditing(null);goto('detail');}} />}
      {addFor && <window.AddProductFlow entry="shell" lockShell={addFor} onClose={() => setAddFor(null)} onDone={() => {setAddFor(null);setCur(addFor);goto('detail');}} />}
    </div>;
  };
})();