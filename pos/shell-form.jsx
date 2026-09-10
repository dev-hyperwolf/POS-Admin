// ── Shell form — the one editor for creating a product family ──────────────
// A shell is now just brand + format + weight/unit/pack + kit box + Weedmaps
// node (docs/SHELLS-PLAN-2026-09-09.md §1) — no price, no traits, no shared
// "sub" of its own; those either live on the FORMAT (subcategory, template)
// or on the variation (price). There is also no update-shell route in this
// phase: a shell is keyed by brand+format+weight+unit+pack, so this form
// only ever CREATES (pos/shell-store.jsx saveShell()).
;(function () {
  const useP = window.useP;
  const S = window.HW_SHELL;

  function Lb({ children, hint, right }) {
    const P = useP();
    return <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute }}>{children}</span>
      {hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>;
  }
  function Sel({ value, onChange, options, full }) {
    const P = useP();
    return <div style={{ position: 'relative', width: full ? '100%' : 'auto' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '9px 32px 9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontSans, minHeight: 38, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>{options.map((o) => <option key={o.value != null ? o.value : o} value={o.value != null ? o.value : o}>{o.label != null ? o.label : o}</option>)}</select>
      <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }
  function Chip({ on, onClick, children, style, title }) {
    const P = useP();
    return <button title={title} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: P.r999, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, whiteSpace: 'nowrap', transition: 'all .12s', ...style }}>{children}</button>;
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
    return <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 99, background: bg, color: c, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{children}</span>;
  };

  function blankDraft() {
    const def = S.catDef('Edibles');
    return { brand: '', cat: 'Edibles', format_id: '', sub: def.subs[0], unit: def.unit, netW: '', pack: '1', kit: '', wmNode: '' };
  }

  // debounced async preview — used for both preview lines below.
  function useDebounced(fn, deps, delay) {
    const [val, setVal] = React.useState(null);
    React.useEffect(() => {
      let live = true;
      const t = setTimeout(() => {
        const r = fn();
        if (r && typeof r.then === 'function') r.then((v) => { if (live) setVal(v); });
        else if (live) setVal(r);
      }, delay);
      return () => { live = false; clearTimeout(t); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return val;
  }

  // ── the form ──────────────────────────────────────────────────────────────
  window.ShellForm = function ShellForm({ compact, onCancel, onSaved }) {
    const P = useP();
    const shells = S.useShells();
    const formats = S.useFormats();
    const brandRows = S.useBrands();
    const [d, setD] = React.useState(blankDraft);
    const s1 = (k, x) => setD((o) => ({ ...o, [k]: x }));
    const def = S.catDef(d.cat);
    const [brandOpen, setBrandOpen] = React.useState(false);
    const [brandQ, setBrandQ] = React.useState('');
    const [fmtOpen, setFmtOpen] = React.useState(false);
    const [fmtQ, setFmtQ] = React.useState('');
    const [boxOpen, setBoxOpen] = React.useState(false);
    const [boxQ, setBoxQ] = React.useState('');
    const [boxEdit, setBoxEdit] = React.useState(null);
    const [boxEditVal, setBoxEditVal] = React.useState('');
    const [extraPresets, setExtraPresets] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const [saveErr, setSaveErr] = React.useState(null);

    // Brand list comes from GET /api/shells/brands (real catalog brands,
    // resolved server-side through the one brand_key fold — see pos/shell-
    // store.jsx) — NOT shared/brands.js, whose own id scheme ('raw' for
    // "Raw Garden") caused the brand-key collision this fixes. product_count
    // here is the real catalog count, not just this brand's existing shells,
    // so a brand can be picked before it has a single shell yet.
    const brandCounts = React.useMemo(() => {
      const m = {};brandRows.forEach((b) => {m[b.brand_name] = b.product_count || 0;});return m;
    }, [brandRows]);
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

    const catFormats = formats.filter((f) => f.category === d.cat && f.active !== 0 && f.active !== false);
    const fmtHits = catFormats.filter((f) => !fmtQ.trim() || (f.name + ' ' + (f.subcategory || '') + ' ' + f.template).toLowerCase().includes(fmtQ.trim().toLowerCase()));
    const selectedFmt = formats.find((f) => f.id === d.format_id) || null;
    const canSave = !!(d.brand.trim() && d.format_id && !saving);

    const pickCat = (key) => {
      const c = S.catDef(key);
      setD((o) => ({ ...o, cat: key, sub: c.subs[0], unit: c.unit, netW: '', format_id: '', kit: '', wmNode: '' }));
    };
    const pickFormat = (f) => {
      setD((o) => ({ ...o, format_id: f.id, sub: f.subcategory || o.sub, unit: f.default_unit || o.unit,
        netW: f.default_weight != null ? String(f.default_weight) : o.netW, pack: f.default_pack != null ? String(f.default_pack) : o.pack,
        kit: f.kit_box || o.kit, wmNode: f.wm_node || o.wmNode }));
      setFmtOpen(false);
    };

    const resultingName = React.useMemo(() => {
      if (!d.brand.trim() || !d.format_id) return '';
      return S.previewShellName(d.brand.trim(), d.format_id, amtNum > 0 ? amtNum : (selectedFmt && selectedFmt.default_weight) || 0, d.unit, parseInt(d.pack || '1', 10), shells);
    }, [d.brand, d.format_id, d.netW, d.unit, d.pack, shells]);

    const exampleName = useDebounced(() => {
      if (!d.format_id) return Promise.resolve(null);
      return S.previewName(d.format_id, { name: 'Blue Dream' }, { weight: amtNum > 0 ? amtNum : (selectedFmt && selectedFmt.default_weight) || 0, unit: d.unit, pack: parseInt(d.pack || '1', 10), category: d.cat });
    }, [d.format_id, d.netW, d.unit, d.pack, d.cat], 250);

    const save = () => {
      if (!canSave) return;
      setSaving(true); setSaveErr(null);
      S.saveShell(d).then((r) => {
        setSaving(false);
        if (!r.ok) { setSaveErr(r.hint || r.error || 'Could not create the shell.'); return; }
        onSaved && onSaved(r.shell.id);
      });
    };

    const canOpenNewFormat = window.ShellFormatsModule && typeof window.ShellFormatsModule.openNew === 'function';
    const openNewFormat = () => {
      window.ShellFormatsModule.openNew({ category: d.cat, subcategory: d.sub, onSaved: (fmt) => {
        S.refreshFormats();
        if (fmt && fmt.id) pickFormat(fmt);
      } });
    };

    return <div style={{ maxWidth: compact ? '100%' : 860, margin: '0 auto' }} data-tour="shell-form">
      {!compact && <>
        <PBtn variant="ghost" size="sm" icon="chevron-left" onClick={onCancel} style={{ marginLeft: -6, marginBottom: 12, color: P.inkDim }}>All shells</PBtn>
        <Eyebrow>New product shell</Eyebrow>
        <h1 style={{ margin: '9px 0 6px', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Define the family</h1>
        <div style={{ fontSize: 13.5, color: P.inkDim, marginBottom: 20, maxWidth: 580, lineHeight: 1.45 }}>
          Set the brand, format and size every product in this line will share. You’ll add the individual variations — the strains and flavours — afterwards.
        </div>
      </>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── family identity ── */}
        <Sec title="Family identity" sub="Brand, format and size — the spine of the shell name.">
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
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{b}</span>
                    <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{brandCounts[b]} products</span>
                  </div>)}
                  {brandHits.length === 0 && <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No brand matches that search.</div>}
                </div>
                <button onClick={() => {const n = brandQ.trim();if (!n) return;s1('brand', n);setBrandOpen(false);}} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: P.surface2, border: 'none', borderTop: `1px solid ${P.hairline}`, color: P.accentText, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
                  <Icon name="plus" size={15} stroke={2.2} />{brandQ.trim() ? `Create brand “${brandQ.trim()}”` : 'Create new brand'}</button>
              </div>}
            </div>

            <div style={{ position: 'relative' }}>
              <Lb hint="The format, size or pack from the shared format library — never a flavour or strain."
                right={!canOpenNewFormat ? <FTag>Managed on Catalog → Formats</FTag> : null}>Format *</Lb>
              <div onClick={() => {setFmtOpen(!fmtOpen);setFmtQ('');}} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, cursor: 'pointer', minHeight: 38 }}>
                <Icon name="box" size={15} stroke={1.8} color={P.inkMute} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: selectedFmt ? 600 : 400, color: selectedFmt ? P.ink : P.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFmt ? selectedFmt.name : 'Select a format…'}</span>
                <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} />
              </div>
              {fmtOpen && <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, overflow: 'hidden' }}>
                <div style={{ padding: 9, borderBottom: `1px solid ${P.hairline}` }}><Field icon="search" size="sm" placeholder="Search formats…" value={fmtQ} onChange={(e) => setFmtQ(e.target.value)} autoFocus /></div>
                <div style={{ maxHeight: 230, overflowY: 'auto', padding: 5 }}>
                  {fmtHits.map((f) => <div key={f.id} onClick={() => pickFormat(f)} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: P.ink }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{f.subcategory || '—'} · {f.template}</span>
                  </div>)}
                  {fmtHits.length === 0 && <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No {d.cat} formats match that search.</div>}
                </div>
                {canOpenNewFormat ?
                <button onClick={() => {setFmtOpen(false);openNewFormat();}} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: P.surface2, border: 'none', borderTop: `1px solid ${P.hairline}`, color: P.accentText, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
                  <Icon name="plus" size={15} stroke={2.2} />+ New format</button> :
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, fontSize: 11.5, color: P.inkMute, lineHeight: 1.45 }}>Formats are managed on Catalog → Formats.</div>}
              </div>}
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
            <Lb hint="Follows the chosen format's subcategory — change it here only to steer a '+ New format' you're about to create.">Subcategory</Lb>
            <Sel value={d.sub} onChange={(x) => s1('sub', x)} options={def.subs} full />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
              <Icon name="link" size={12} stroke={1.9} color={P.inkMute} />
              <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>Live menu path · {S.menuPath({ cat: d.cat, sub: d.sub })}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div>
              <Lb hint="Defaults from the format — type any amount to override it for this shell. Shorthand works: 3.5g, 100 mg, 1/8, eighth, oz.">Weight / size *</Lb>
              <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, overflow: 'hidden' }}>
                <input value={d.netW} placeholder="Any amount — 3.5, 1/8, 100mg…" onChange={(e) => {const p = S.parseSize(e.target.value, d.unit, def.units);setD((o) => ({ ...o, netW: p.amount, unit: p.unit }));}}
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontMono, padding: '10px 12px' }} />
                <select value={d.unit} onChange={(e) => s1('unit', e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none', border: 'none', borderLeft: `1px solid ${P.hairline2}`, background: P.surface2, color: P.ink, fontSize: 13.5, fontWeight: 700, fontFamily: P.fontMono, padding: '0 12px', cursor: 'pointer' }}>
                  {def.units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ minHeight: 18, marginTop: 7, display: 'flex', alignItems: 'center', gap: 7 }}>
                {amtNum > 0 ?
                <><Icon name="check" size={13} stroke={2.4} color={P.good} /><span style={{ fontSize: 11.5, fontWeight: 600, color: P.good, fontFamily: P.fontMono }}>{sizeEcho}</span></> :
                <span style={{ fontSize: 11.5, color: P.inkMute }}>{selectedFmt && selectedFmt.default_weight != null ? `Defaults to ${selectedFmt.default_weight}${selectedFmt.default_unit || ''} from the format.` : 'Enter any value — the shortcuts below are just shortcuts.'}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute }}>Common</span>
                {presets.map((p) => {const sp = S.splitSize(p);return <Chip key={p} on={d.netW === sp.amount && d.unit === sp.unit} onClick={() => setD((o) => ({ ...o, netW: sp.amount, unit: sp.unit }))} style={{ padding: '4px 9px', fontSize: 11.5, fontFamily: P.fontMono }}>{p}</Chip>;})}
                {amtNum > 0 && !presets.includes(amtNum + d.unit) && <Chip onClick={() => setExtraPresets((o) => ({ ...o, [d.cat]: [...(o[d.cat] || []), amtNum + d.unit] }))} style={{ padding: '4px 9px', fontSize: 11.5, borderStyle: 'dashed', color: P.accentText }}>+ Save {amtNum + d.unit}</Chip>}
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
                    <button onClick={() => {const n = boxQ.trim();if (!n) return;S.addBox(n);s1('kit', n);setBoxOpen(false);}} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: P.surface2, border: 'none', borderTop: `1px solid ${P.hairline}`, color: P.accentText, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
                      <Icon name="plus" size={15} stroke={2.2} />{boxQ.trim() ? `Create box “${boxQ.trim()}”` : 'Create new box'}</button>
                  </div>}
                </div>
                <div><Lb hint="Units per package — 1 for a single, 10 for a 10-pack.">Pack</Lb><Field mono value={d.pack} onChange={(e) => s1('pack', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Lb hint="Defaults from the format — override only if this shell's listing really needs a different node.">Weedmaps node</Lb>
                <Field value={d.wmNode} onChange={(e) => s1('wmNode', e.target.value)} placeholder={selectedFmt ? selectedFmt.wm_node || '—' : '—'} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
            <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Resulting shell name</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{resultingName || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
            <span style={{ fontSize: 10, color: P.inkMute, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Example product name</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{exampleName ? (exampleName.name || '—') : (d.format_id ? '…' : '—')}</span>
            {exampleName && exampleName.warnings && exampleName.warnings.length > 0 &&
              <span style={{ fontSize: 11, color: P.warn, fontWeight: 600 }}>{exampleName.warnings[0]}</span>}
          </div>
          <Note tone="info">Strain “Blue Dream” is a preview only — the naming engine derives every real product name from what the intake person types, never a typed-in product name.</Note>
        </Sec>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
        <span style={{ fontSize: 12.5, color: saveErr ? P.bad : P.inkMute }}>{saveErr || 'Next: add variations to the shell'}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <PBtn variant="secondary" size="lg" onClick={onCancel}>Cancel</PBtn>
          <PBtn variant="accent" size="lg" icon="check" busy={saving} onClick={save} style={{ opacity: canSave ? 1 : .5 }}>Create shell</PBtn>
        </div>
      </div>
    </div>;
  };

  Object.assign(window, { ShellFormBits: { Lb, Sel, Chip, Sec, Note, FTag } });
})();
