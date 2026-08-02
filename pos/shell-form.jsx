// ── Shell form — the one editor for a product family (create + edit) ───────
// Used by the Shells module, by "Edit shell" on a product page, and inline in
// the Add Product flow. Everything set here is inherited by every variation.
;(function () {
  const useP = window.useP;
  const S = window.HW_SHELL;

  function Lb({ children, hint, right }) {
    const P = useP();
    return <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute }}>{children}</span>
      {hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>;
  }
  function Sel({ value, onChange, options, full }) {
    const P = useP();
    return <div style={{ position: 'relative', width: full ? '100%' : 'auto' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '9px 32px 9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 13, fontWeight: 600, color: P.ink, fontFamily: P.fontSans, minHeight: 38, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }
  function Chip({ on, onClick, children, style, title }) {
    const P = useP();
    return <button title={title} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r999, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, background: on ? P.accentSoft : P.surface, color: on ? P.ink : P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap', transition: 'all .12s', ...style }}>{children}</button>;
  }
  function Sec({ title, sub, right, children }) {
    const P = useP();
    return <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
        </div>{right}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </Card>;
  }
  const Note = ({ children, tone }) => {
    const P = useP();
    const bg = tone === 'info' ? P.infoSoft : P.surface2;
    return <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: bg, border: tone === 'info' ? 'none' : `1px solid ${P.hairline}`, borderRadius: P.r10, marginTop: 14 }}>
      <Icon name="info" size={14} color={tone === 'info' ? P.info : P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>{children}</div>
    </div>;
  };
  const FTag = ({ children, kind }) => {
    const P = useP();
    const c = kind === 'good' ? P.good : kind === 'warn' ? P.warn : P.info;
    const bg = kind === 'good' ? P.goodSoft : kind === 'warn' ? P.warnSoft : P.infoSoft;
    return <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 99, background: bg, color: c, fontSize: 8.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{children}</span>;
  };

  const TRAIT_SUGGESTIONS = ['Pieces per pack', 'Serving size', 'Infused', 'Cultivation style', 'Terpenes', 'Cannabinoids', 'Extract type', 'Hardware'];

  function blankDraft() {
    const def = S.catDef('Edibles');
    return { brand: '', cat: 'Edibles', sub: def.subs[0], format: S.FORMAT_BY_CAT.Edibles, unit: def.unit, netW: '', pack: '1', kit: '', ptype: 'Cannabis', wmNode: def.wm, price: '', sale: '', traits: [] };
  }
  function draftFrom(s) {
    return { brand: s.brand, cat: s.cat, sub: s.sub, format: s.format, unit: s.unit, netW: s.netW, pack: s.pack, kit: s.kit, ptype: s.ptype, wmNode: s.wmNode,
      price: String(s.price || ''), sale: s.sale ? String(s.sale) : '', traits: (s.traits || []).map((t) => ({ ...t })) };
  }

  // ── the form ──────────────────────────────────────────────────────────────
  window.ShellForm = function ShellForm({ editingId, compact, onCancel, onSaved }) {
    const P = useP();
    const money = window.HW.fmt.money0;
    const shells = S.useShells();
    const editing = editingId ? S.shellById(editingId) : null;
    const [d, setD] = React.useState(() => editing ? draftFrom(editing) : blankDraft());
    const s1 = (k, x) => setD((o) => ({ ...o, [k]: x }));
    const def = S.catDef(d.cat);
    const [brandOpen, setBrandOpen] = React.useState(false);
    const [brandQ, setBrandQ] = React.useState('');
    const [boxOpen, setBoxOpen] = React.useState(false);
    const [boxQ, setBoxQ] = React.useState('');
    const [boxEdit, setBoxEdit] = React.useState(null);
    const [boxEditVal, setBoxEditVal] = React.useState('');
    const [extraPresets, setExtraPresets] = React.useState({});

    const brandCounts = React.useMemo(() => {
      const m = {};shells.forEach((s) => {m[s.brand] = (m[s.brand] || 0) + s.variations.length;});return m;
    }, [shells]);
    const brandHits = Object.keys(brandCounts).filter((b) => !brandQ.trim() || b.toLowerCase().includes(brandQ.trim().toLowerCase())).sort();
    const boxHits = S.BOXES.filter((b) => !boxQ.trim() || b.toLowerCase().includes(boxQ.trim().toLowerCase()));
    const presets = [...def.presets, ...(extraPresets[d.cat] || [])];
    const amtNum = parseFloat(d.netW);
    let sizeEcho = '';
    if (amtNum > 0) {
      sizeEcho = amtNum + ' ' + d.unit;
      if (d.unit === 'oz') sizeEcho += '  ·  ' + Math.round(amtNum * 28.35 * 10) / 10 + ' g per unit';else
      if (d.unit === 'g') sizeEcho += '  ·  ' + Math.round(amtNum * 1000) + ' mg';
    }
    const canSave = !!(d.brand.trim() && d.sub && parseFloat(d.price) > 0);
    const derivedName = (d.brand.trim() || 'Brand') + ' · ' + d.format;

    const pickCat = (key) => {
      const c = S.catDef(key);
      setD((o) => ({ ...o, cat: key, sub: c.subs[0], unit: c.unit, netW: '', wmNode: c.wm, format: S.FORMAT_BY_CAT[key] || o.format, traits: o.traits.length ? o.traits : c.traits.map((t) => ({ ...t })) }));
    };
    const save = () => {
      if (!canSave) return;
      const id = S.saveShell(d, editingId);
      onSaved && onSaved(id);
    };

    return <div style={{ maxWidth: compact ? '100%' : 860, margin: '0 auto' }} data-tour="shell-form">
      {!compact && <>
        <PBtn variant="ghost" size="sm" icon="chevron-left" onClick={onCancel} style={{ marginLeft: -6, marginBottom: 12, color: P.inkDim }}>All shells</PBtn>
        <Eyebrow>{editing ? 'Edit product shell' : 'New product shell'}</Eyebrow>
        <h1 style={{ margin: '9px 0 6px', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{editing ? 'Edit the family' : 'Define the family'}</h1>
        <div style={{ fontSize: 13.5, color: P.inkDim, marginBottom: 20, maxWidth: 580, lineHeight: 1.45 }}>
          {editing ?
          'Changes here apply to every variation in this line that hasn’t overridden the value. Traits, pricing and the delivery box update across the whole family.' :
          'Set the details every product in this line will share. You’ll add the individual variations — the flavours, strains and prices — afterwards.'}
        </div>
      </>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── family identity ── */}
        <Sec title="Family identity" sub="Brand, category and size — the spine of the shell name.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <Lb hint="Pick a brand already in the catalog, or create one. Brands are records, not free text.">Brand *</Lb>
              <div onClick={() => {setBrandOpen(!brandOpen);setBrandQ('');}} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, cursor: 'pointer', minHeight: 38 }}>
                <Icon name="tag" size={15} stroke={1.8} color={P.inkMute} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: d.brand ? 600 : 400, color: d.brand ? P.ink : P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.brand || 'Select a brand…'}</span>
                <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} />
              </div>
              {brandOpen && <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, overflow: 'hidden' }}>
                <div style={{ padding: 9, borderBottom: `1px solid ${P.hairline}` }}><Field icon="search" size="sm" placeholder="Search brands…" value={brandQ} onChange={(e) => setBrandQ(e.target.value)} autoFocus /></div>
                <div style={{ maxHeight: 210, overflowY: 'auto', padding: 5 }}>
                  {brandHits.map((b) => <div key={b} onClick={() => {s1('brand', b);setBrandOpen(false);}} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: P.fontMono }}>{S.mono2(b)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: P.ink }}>{b}</span>
                    <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{brandCounts[b]} products</span>
                  </div>)}
                  {brandHits.length === 0 && <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, color: P.inkMute }}>No brand matches that search.</div>}
                </div>
                <button onClick={() => {const n = brandQ.trim();if (!n) return;s1('brand', n);setBrandOpen(false);}} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: P.surface2, border: 'none', borderTop: `1px solid ${P.hairline}`, color: P.mode === 'dark' ? P.accent : '#7A5A00', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
                  <Icon name="plus" size={15} stroke={2.2} />{brandQ.trim() ? `Create brand “${brandQ.trim()}”` : 'Create new brand'}</button>
              </div>}
            </div>
            <div>
              <Lb hint="The format, size or pack — never a flavour or strain.">Format *</Lb>
              <Sel value={d.format} onChange={(x) => s1('format', x)} options={[d.format, ...S.SHELL_FORMATS].filter((x, i, a) => a.indexOf(x) === i)} full />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Lb>Category *</Lb>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 8 }}>
              {S.TAX.map((c) => <Chip key={c.key} on={d.cat === c.key} onClick={() => pickCat(c.key)} style={{ justifyContent: 'flex-start', padding: '9px 12px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: window.HW.CAT_COLOR[c.key] || P.neutral }} />{c.name}
              </Chip>)}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Lb>Subcategory *</Lb>
            <Sel value={d.sub} onChange={(x) => s1('sub', x)} options={def.subs} full />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
              <Icon name="link" size={12} stroke={1.9} color={P.inkMute} />
              <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>Live menu path · {S.menuPath({ cat: d.cat, sub: d.sub })}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div>
              <Lb hint="Type any amount — shorthand works: 3.5g, 100 mg, 1/8, eighth, oz.">Weight / size *</Lb>
              <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, overflow: 'hidden' }}>
                <input value={d.netW} placeholder="Any amount — 3.5, 1/8, 100mg…" onChange={(e) => {const p = S.parseSize(e.target.value, d.unit, def.units);setD((o) => ({ ...o, netW: p.amount, unit: p.unit }));}}
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: 14, fontWeight: 600, fontFamily: P.fontMono, padding: '10px 12px' }} />
                <select value={d.unit} onChange={(e) => s1('unit', e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', border: 'none', borderLeft: `1px solid ${P.hairline2}`, background: P.surface2, color: P.ink, fontSize: 13, fontWeight: 700, fontFamily: P.fontMono, padding: '0 12px', cursor: 'pointer' }}>
                  {def.units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ minHeight: 18, marginTop: 7, display: 'flex', alignItems: 'center', gap: 7 }}>
                {amtNum > 0 ?
                <><Icon name="check" size={13} stroke={2.4} color={P.good} /><span style={{ fontSize: 11.5, fontWeight: 600, color: P.good, fontFamily: P.fontMono }}>{sizeEcho}</span></> :
                <span style={{ fontSize: 11, color: P.inkMute }}>Enter any value — the shortcuts below are just shortcuts.</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute }}>Common</span>
                {presets.map((p) => {const sp = S.splitSize(p);return <Chip key={p} on={d.netW === sp.amount && d.unit === sp.unit} onClick={() => setD((o) => ({ ...o, netW: sp.amount, unit: sp.unit }))} style={{ padding: '4px 9px', fontSize: 11, fontFamily: P.fontMono }}>{p}</Chip>;})}
                {amtNum > 0 && !presets.includes(amtNum + d.unit) && <Chip onClick={() => setExtraPresets((o) => ({ ...o, [d.cat]: [...(o[d.cat] || []), amtNum + d.unit] }))} style={{ padding: '4px 9px', fontSize: 11, borderStyle: 'dashed', color: P.mode === 'dark' ? P.accent : '#7A5A00' }}>+ Save {amtNum + d.unit}</Chip>}
              </div>
            </div>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <Lb hint="Which physical box in a driver's kit this family rides in. Delivery only — ignored in store."><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Delivery box <FTag>Delivery only</FTag></span></Lb>
                  <div onClick={() => {setBoxOpen(!boxOpen);setBoxQ('');setBoxEdit(null);}} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, cursor: 'pointer', minHeight: 38 }}>
                    <Icon name="package" size={15} stroke={1.8} color={P.inkMute} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: d.kit ? P.ink : P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.kit || 'Select a box…'}</span>
                    <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} />
                  </div>
                  {boxOpen && <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, overflow: 'hidden' }}>
                    <div style={{ padding: 9, borderBottom: `1px solid ${P.hairline}` }}><Field size="sm" placeholder="Search or name a new box…" value={boxQ} onChange={(e) => setBoxQ(e.target.value)} /></div>
                    <div style={{ maxHeight: 190, overflowY: 'auto', padding: 5 }}>
                      {boxHits.map((b) => <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8 }}>
                        {boxEdit === b ?
                        <><div style={{ flex: 1 }}><Field size="sm" value={boxEditVal} onChange={(e) => setBoxEditVal(e.target.value)} autoFocus /></div>
                          <PBtn variant="accent" size="xs" onClick={() => {S.renameBox(b, boxEditVal.trim());if (d.kit === b) s1('kit', boxEditVal.trim() || b);setBoxEdit(null);}}>Save</PBtn></> :
                        <><span onClick={() => {s1('kit', b);setBoxOpen(false);}} style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: P.ink, cursor: 'pointer' }}>{b}</span>
                          <IconBtn icon="pencil" size={13} title="Rename this box" style={{ width: 26, height: 26 }} onClick={() => {setBoxEdit(b);setBoxEditVal(b);}} /></>}
                      </div>)}
                    </div>
                    <button onClick={() => {const n = boxQ.trim();if (!n) return;S.addBox(n);s1('kit', n);setBoxOpen(false);}} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: P.surface2, border: 'none', borderTop: `1px solid ${P.hairline}`, color: P.mode === 'dark' ? P.accent : '#7A5A00', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
                      <Icon name="plus" size={15} stroke={2.2} />{boxQ.trim() ? `Create box “${boxQ.trim()}”` : 'Create new box'}</button>
                  </div>}
                </div>
                <div><Lb hint="Units per package — 1 for a single, 10 for a 10-pack.">Pack</Lb><Field mono value={d.pack} onChange={(e) => s1('pack', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}>Weedmaps</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.wmNode}</span>
                <span style={{ fontSize: 10.5, color: P.good, fontWeight: 700 }}>Mapped</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
            <span style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Resulting shell name</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{derivedName}</span>
          </div>
        </Sec>

        {/* ── pricing ── */}
        <Sec title="Default pricing" sub="Every variation sells at this price unless it explicitly overrides it.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><Lb hint="Changing this reprices every variation that hasn't been overridden.">Retail price *</Lb>
              <Field mono placeholder="18.00" value={d.price} onChange={(e) => s1('price', e.target.value.replace(/[^0-9.]/g, ''))} icon="dollar" /></div>
            <div><Lb hint="Optional promo price. When set, this is what the customer pays and retail shows struck through.">Sale price</Lb>
              <Field mono placeholder="optional" value={d.sale} onChange={(e) => s1('sale', e.target.value.replace(/[^0-9.]/g, ''))} icon="percent" /></div>
          </div>
          {editing && editing.variations.filter((v) => v.override).length > 0 &&
          <div style={{ marginTop: 12, fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>
            <b style={{ color: P.warn }}>{editing.variations.filter((v) => v.override).length} variation{editing.variations.filter((v) => v.override).length > 1 ? 's' : ''}</b> override this price and will not move.
          </div>}
          <Note><b>Unit cost isn’t set here.</b> It’s owned by the batch record and rolls up on the shell as avg / low / high once batches are received.</Note>
          <Note><b>Storefront meta isn’t set here either.</b> Title, description, slug and keywords are written per <b>product</b> — every variation gets its own search listing. Set them on the product page or as you add the variation.</Note>
        </Sec>

        {/* ── traits ── */}
        <Sec title="Product traits" sub="Pack count, servings, infusion, cultivation style — set once, inherited by every variation." right={<FTag>Carries across the line</FTag>}>
          {(d.traits || []).map((t, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: '0 0 40%' }}><Field placeholder="Trait — e.g. Pieces per pack" value={t.label} onChange={(e) => setD((o) => ({ ...o, traits: o.traits.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} /></div>
            <div style={{ flex: 1 }}><Field placeholder="Value — e.g. 20" value={t.value} onChange={(e) => setD((o) => ({ ...o, traits: o.traits.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} /></div>
            <IconBtn icon="trash" size={15} title="Remove this trait" style={{ width: 34, height: 34 }} onClick={() => setD((o) => ({ ...o, traits: o.traits.filter((_, j) => j !== i) }))} />
          </div>)}
          {(d.traits || []).length === 0 && <div style={{ padding: 14, border: `1px dashed ${P.hairline3}`, borderRadius: P.r10, textAlign: 'center', fontSize: 12, color: P.inkMute, marginBottom: 10 }}>No traits yet — add the details that stay the same across every product in this family.</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
            <PBtn variant="secondary" size="sm" icon="plus" onClick={() => setD((o) => ({ ...o, traits: [...o.traits, { label: '', value: '' }] }))}>Add trait</PBtn>
            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, marginLeft: 4 }}>Quick add</span>
            {TRAIT_SUGGESTIONS.filter((l) => !(d.traits || []).some((t) => t.label === l)).map((l) =>
            <Chip key={l} onClick={() => setD((o) => ({ ...o, traits: [...o.traits, { label: l, value: '' }] }))} style={{ padding: '4px 9px', fontSize: 11 }}>+ {l}</Chip>)}
          </div>
        </Sec>

      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
        <span style={{ fontSize: 12, color: P.inkMute }}>{editing ? `Applies to all ${editing.variations.length} variation${editing.variations.length === 1 ? '' : 's'} that inherit these values` : 'Next: add variations to the shell'}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <PBtn variant="secondary" size="lg" onClick={onCancel}>Cancel</PBtn>
          <PBtn variant="accent" size="lg" icon="check" onClick={save} style={{ opacity: canSave ? 1 : .5 }}>{editing ? 'Save changes' : 'Create shell'}</PBtn>
        </div>
      </div>
    </div>;
  };

  Object.assign(window, { ShellFormBits: { Lb, Sel, Chip, Sec, Note, FTag } });
})();
