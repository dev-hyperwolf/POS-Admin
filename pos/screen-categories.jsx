// ── Categories module — Categories + Sub-Categories management, both editors,
//    and a Weedmaps taxonomy mapping layer (sub-category → WM node, many-to-one).
//    Fixes WM "no taxonomy node" errors. Three mapping surfaces are provided so
//    the team can choose: (A) inline in the editors, (B) a dedicated mapping
//    board tab, (C) a Weedmaps column + status pill in the list views.
const useP = window.useP;

// Category glyph colors (match the storefront category palette).
const CAT_COLORS = { Deals: '#E0563B', Flower: '#3FA45B', Vapes: '#3B82C4', Concentrates: '#E08A2B', Prerolls: '#8A5CD6', Edibles: '#E36597', Wellness: '#3FB6AC', Accessories: '#4FA84F' };
const catColor = (name) => CAT_COLORS[name] || '#6E6E66';

// ── Full public Weedmaps product taxonomy (category group → nodes) ──────────
// The REAL Weedmaps taxonomy (Menu API 2025-07, developer.weedmaps.com/docs/wm-categories).
// group = an L1 root category; nodes = its L2 sub-categories, with L3 leaves
// written "L2 › L3". Every menu item must carry at least one valid category_id,
// so an unmapped sub-category here is a product Weedmaps will reject.
const WM_TAXONOMY = [
{ group: 'Flower', nodes: ['Big Buds', 'Bud', 'Ground', 'Infused Flower', 'Smalls'] },
{ group: 'Pre Roll', nodes: ['Blunts', 'Joints', 'Minis'] },
{ group: 'Infused Pre Roll', nodes: ['Infused Blunts', 'Infused Joints', 'Infused Minis'] },
{ group: 'Vape Pens', nodes: ['Batteries › Pull', 'Batteries › Push Button', 'Cartridge', 'Disposable', 'Pods'] },
{ group: 'Concentrates', nodes: ['Nug Run', 'Solvent › Badder', 'Solvent › Crumble', 'Solvent › Crystalline', 'Solvent › Diamonds', 'Solvent › Distillate', 'Solvent › HTE', 'Solvent › Jar', 'Solvent › Live Resin', 'Solvent › Sauce', 'Solvent › Shatter', 'Solvent › Sugar', 'Solvent › Syringe', 'Solventless › Ice Water Hash', 'Solventless › Kief', 'Solventless › Rosin', 'Sugar Leaf', 'Taffy', 'Trim Run'] },
{ group: 'Edibles', nodes: ['Baked Goods › Brownies', 'Baked Goods › Cookies', 'Baked Goods › Treats', 'Candy', 'Chocolates', 'Cooking › Butter', 'Cooking › Condiments', 'Dairy Free', 'Gluten Free', 'Gummies', 'Kosher', 'Mints', 'Nut Free', 'Paleo Edibles', 'Snacks › Cereal', 'Snacks › Ice Cream', 'Sugar Free', 'Vegan'] },
{ group: 'Drinks', nodes: ['Carbonated', 'Mix-ins › Powder', 'Mix-ins › Syrup', 'Non-carbonated'] },
{ group: 'Wellness', nodes: ['Therapeutics › Capsules', 'Therapeutics › Extract Oils', 'Therapeutics › Oral Spray', 'Therapeutics › Patches', 'Therapeutics › RSO', 'Therapeutics › Tinctures', 'Topicals › Balms', 'Topicals › Bath', 'Topicals › Creams', 'Topicals › Lubricants', 'Topicals › Sprays'] },
{ group: 'Gear', nodes: ['Accessories › Rolling Papers', 'Accessories › Stickers', 'Apparel › Hats', 'Apparel › Hoodies', 'Apparel › Shirts', 'Bongs › Bowls', 'Bongs › Bubblers', 'Dab Rigs › Banger & Nails', 'Dab Rigs › Carb Cap', 'Dab Rigs › Dab Tools', 'Dab Rigs › Torches', 'Grinders', 'Pipes', 'Storage', 'Vaporizer'] },
{ group: 'Cultivation', nodes: ['Clone', 'Fresh Frozen', 'Seeds', 'Trim', 'Whole Plant'] },
{ group: 'Other', nodes: ['Other'] }];

const WM_ALL = WM_TAXONOMY.flatMap((g) => g.nodes.map((n) => `${g.group}/${n}`));
const wmNode = (key) => key.split('/')[1];
const wmGroup = (key) => key.split('/')[0];

// ── Hyperwolf taxonomy — seeded exactly from the admin (Categories screenshots).
//    Each sub-category carries its own WM mapping (array, many-to-one) + a
//    `skip` flag for promo/pseudo categories that intentionally never sync.
const S = (name, wm, skip) => ({ name, wm: wm || [], skip: !!skip });
const SEED = [
{ id: 'deals', name: 'Deals', status: 'Active', subs: [S('Hyper Deals', [], true), S('Clearance', [], true)] },
{ id: 'flower', name: 'Flower', status: 'Active', subs: [
  S('Sativa Flowers', ['Flower/Bud']), S('Indica Flowers', ['Flower/Bud']), S('Hybrid Flowers', ['Flower/Bud']),
  S('Premium Flower', ['Flower/Big Buds']), S('Budget Friendly Flower', ['Flower/Bud']), S('Smaller Bud Flower', ['Flower/Smalls']), S('5g-28g', ['Flower/Bud'])] },
{ id: 'vapes', name: 'Vapes', status: 'Active', subs: [
  S('Vapes', ['Vape Pens/Cartridge']), S('Batteries', ['Vape Pens/Batteries › Push Button']), S('Solventless Rosin Vapes', ['Vape Pens/Cartridge']),
  S('Live Resin Vape', ['Vape Pens/Cartridge']), S('All-In-One Vapes', ['Vape Pens/Disposable']), S('Pod System Vapes', ['Vape Pens/Pods']),
  S('Premium Oil Vapes', ['Vape Pens/Cartridge']), S('Cured Resin Vapes', [])] },
{ id: 'concentrates', name: 'Concentrates', status: 'Active', subs: [
  S('Solventless Rosin / Hash', ['Concentrates/Solventless › Rosin', 'Concentrates/Solventless › Ice Water Hash']), S('Hash', ['Concentrates/Solventless › Ice Water Hash']), S('Sugar', ['Concentrates/Solvent › Sugar']),
  S('Budder / Badder', ['Concentrates/Solvent › Badder']), S('Diamonds / Sauce', ['Concentrates/Solvent › Diamonds', 'Concentrates/Solvent › Sauce'])] },
{ id: 'prerolls', name: 'Prerolls', status: 'Active', subs: [
  S('Prerolls', ['Pre Roll/Joints']), S('Single Pre-Roll', ['Pre Roll/Joints']), S('Single Infused Pre-Roll', ['Infused Pre Roll/Infused Joints']),
  S('Single Solventless Rosin / Hash Pre-Roll', ['Infused Pre Roll/Infused Joints']), S('Infused Pre-Roll Pack', ['Infused Pre Roll/Infused Minis']),
  S('Solventless Rosin / Hash Pre-Roll Pack', ['Infused Pre Roll/Infused Minis']), S('Pre-Roll Pack', ['Pre Roll/Minis'])] },
{ id: 'edibles', name: 'Edibles', status: 'Active', subs: [
  S('Edibles', ['Edibles/Gummies']), S('High Dose Edibles', ['Edibles/Gummies']), S('Micro Dose Edibles', ['Edibles/Gummies']),
  S('Ratio (CBN/CBD) Edibles', []), S('Solventless Rosin / Hash Edibles', ['Edibles/Gummies']), S('Gummies', ['Edibles/Gummies']),
  S('Baked Goods', ['Edibles/Baked Goods › Cookies']), S('Drinks', ['Drinks/Non-carbonated'])] },
{ id: 'wellness', name: 'Wellness', status: 'Active', subs: [
  S('Wellness', ['Wellness/Topicals › Balms']), S('Tinctures', ['Wellness/Therapeutics › Tinctures']), S('Topicals', ['Wellness/Topicals › Creams'])] },
{ id: 'accessories', name: 'Accessories', status: 'Active', subs: [S('Accessories', ['Gear/Accessories › Rolling Papers'])] }];

// POS catalog category each maps to (for live product counts).
const POS_CAT = { flower: 'Flower', vapes: 'Vapes', concentrates: 'Concentrates', prerolls: 'Pre-Rolls', edibles: 'Edibles', wellness: 'Wellness', accessories: 'Wellness', deals: 'Deals' };
const catCount = (id) => {try {return window.HW.catCount(POS_CAT[id]);} catch (e) {return 0;}};

// sub mapping status: 'mapped' | 'skipped' | 'unmapped'
const subStatus = (s) => s.wm && s.wm.length ? 'mapped' : s.skip ? 'skipped' : 'unmapped';
const flatSubs = (cats) => cats.flatMap((c) => c.subs.map((s) => ({ ...s, parent: c.name, catId: c.id })));

// ── small colored category glyph ────────────────────────────────────────────
function CatGlyph({ name, size = 34 }) {
  const P = useP();const c = catColor(name);
  return <span style={{ width: size, height: size, borderRadius: 9, flex: '0 0 auto', background: `linear-gradient(140deg, ${c}, ${c}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .42, fontWeight: 800, color: '#fff', fontFamily: P.fontMono }}>{name[0]}</span>;
}

// ── Weedmaps mapping pill(s) — read-only display of a sub's WM nodes/status ──
function WmPill({ sub, compact }) {
  const P = useP();const st = subStatus(sub);
  if (st === 'skipped') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: P.inkMute, background: P.surface3, borderRadius: 99, padding: '3px 9px' }}><Icon name="eye-off" size={11} stroke={1.9} />Not synced</span>;
  if (st === 'unmapped') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: P.warn, background: P.warnSoft, borderRadius: 99, padding: '3px 9px' }}><Icon name="shield" size={11} stroke={2} />Unmapped</span>;
  const shown = compact ? sub.wm.slice(0, 1) : sub.wm.slice(0, 3);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
    {shown.map((k) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: P.ink, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: 99, padding: '3px 8px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '1px 5px', borderRadius: 99 }}>WM</span>{wmNode(k)}</span>)}
    {sub.wm.length > shown.length && <span style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute }}>+{sub.wm.length - shown.length}</span>}
  </span>;
}

// ── Weedmaps taxonomy multi-picker popover (many-to-one) ────────────────────
function WmMultiPicker({ value = [], skip, onChange, onSkip, onClose, anchor = 'right' }) {
  const P = useP();const [q, setQ] = React.useState('');
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', [anchor]: 0, width: 300, maxHeight: 400, display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 91, overflow: 'hidden' }}>
      <div style={{ padding: 9, borderBottom: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 7px', borderRadius: 99 }}>WM</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Weedmaps taxonomy</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{value.length} selected</span>
        </div>
        <Field icon="search" placeholder="Search nodes…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {WM_TAXONOMY.map((g) => {
          const nodes = g.nodes.filter((n) => !q || (g.group + ' ' + n).toLowerCase().includes(q.toLowerCase()));
          if (!nodes.length) return null;
          return <div key={g.group} style={{ marginBottom: 4 }}>
            <div style={{ padding: '6px 8px 4px', fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{g.group}</div>
            {nodes.map((n) => {const k = `${g.group}/${n}`;const on = value.includes(k);return (
                <button key={k} onClick={() => toggle(k)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', background: on ? P.accentSoft : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? P.accent : P.hairline3}`, background: on ? P.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{on && <Icon name="check" size={11} stroke={3} color={P.accentInk} />}</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{n}</span>
              </button>);})}
          </div>;})}
      </div>
      <button onClick={() => {onSkip(!skip);}} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: `1px solid ${P.hairline}`, background: skip ? P.surface2 : 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>
        <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${skip ? P.ink : P.hairline3}`, background: skip ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{skip && <Icon name="check" size={11} stroke={3} color={P.surface} />}</span>
        <span style={{ textAlign: 'left', flex: 1 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, display: 'block' }}>Intentionally not synced</span><span style={{ fontSize: 11.5, color: P.inkMute }}>Promo/pseudo category — skip Weedmaps</span></span>
      </button>
    </div>
  </>;
}

Object.assign(window, { CAT_COLORS, catColor, WM_TAXONOMY, WM_ALL, wmNode, wmGroup, catCount, subStatus, CatGlyph, WmPill, WmMultiPicker, POS_CAT });

window.CategoriesScreen = function CategoriesScreen({ onBack }) {
  const P = useP();
  const [tab, setTab] = React.useState('categories');
  const [cats, setCats] = React.useState(SEED);
  const [editCat, setEditCat] = React.useState(null);
  const [editSub, setEditSub] = React.useState(null); // {catId, name}
  const [q, setQ] = React.useState('');
  const [pick, setPick] = React.useState(null); // `${catId}::${subName}` currently picking inline

  const setSub = (catId, name, patch) => setCats((cs) => cs.map((c) => c.id !== catId ? c : { ...c, subs: c.subs.map((s) => s.name === name ? { ...s, ...patch } : s) }));
  const saveCat = (next) => {setCats((cs) => cs.map((c) => c.id === next.id ? next : c));setEditCat(null);};

  if (editCat) return <window.CategoryEdit cat={cats.find((c) => c.id === editCat)} onBack={() => setEditCat(null)} onSave={saveCat} onSetSub={setSub} />;
  if (editSub) {const c = cats.find((x) => x.id === editSub.catId);const s = c && c.subs.find((x) => x.name === editSub.name);if (c && s) return <window.SubCategoryEdit cat={c} sub={s} onBack={() => setEditSub(null)} onSetSub={setSub} />;}

  const subs = flatSubs(cats);
  const mappedSubs = subs.filter((s) => subStatus(s) === 'mapped').length;
  const unmapped = subs.filter((s) => subStatus(s) === 'unmapped');
  const skipped = subs.filter((s) => subStatus(s) === 'skipped').length;
  const fc = cats.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.subs.some((s) => s.name.toLowerCase().includes(q.toLowerCase())));
  const fs = subs.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.parent.toLowerCase().includes(q.toLowerCase()));
  const th = (t, r) => <th style={{ textAlign: r ? 'right' : 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap' }}>{t}</th>;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={17} stroke={2.2} />Back to catalog</button>
      </div>

      <SectionHead level={1} eyebrow="Master Catalog" title="Categories"
      subtitle={`${cats.length} categories · ${subs.length} sub-categories · ${mappedSubs} mapped to Weedmaps${skipped ? ` · ${skipped} skipped` : ''}`}
      action={<div style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" icon="refresh" size="md">Sync Categories</PBtn>
          <PBtn variant="accent" icon="plus" size="md">Add Category</PBtn>
        </div>} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0 16px', flexWrap: 'wrap' }}>
        <Seg value={tab} onChange={setTab} size="lg" options={[{ value: 'categories', label: 'Categories' }, { value: 'subcategories', label: 'Sub Categories' }, { value: 'mapping', label: 'Weedmaps mapping' }]} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 280 }}><Field icon="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} size="md" /></div>
      </div>

      {/* Unmapped warnings strip (option: warnings list) */}
      {unmapped.length > 0 && tab !== 'mapping' &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', background: P.warnSoft, borderRadius: P.r12, marginBottom: 14 }}>
        <Icon name="shield" size={16} stroke={1.9} color={P.warn} />
        <span style={{ fontSize: 12.5, color: P.ink2, flex: 1 }}><b style={{ color: P.ink }}>{unmapped.length} sub-categor{unmapped.length === 1 ? 'y is' : 'ies are'} unmapped.</b> Products in them stay hidden on Weedmaps until a taxonomy node is set.</span>
        <button onClick={() => setTab('mapping')} style={{ fontSize: 12.5, fontWeight: 700, color: P.warn, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>Review →</button>
      </div>}

      {tab === 'mapping' ? <MappingBoard cats={cats} setSub={setSub} onEditSub={(catId, name) => setEditSub({ catId, name })} /> :
      <Card padding={0} style={{ overflow: 'visible' }}>
        <div style={{ overflowX: 'auto' }}>
          {tab === 'categories' ?
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ background: P.surface2 }}>{th('')}{th('Category')}{th('Sub-categories')}{th('Weedmaps')}{th('Products', true)}{th('Status')}{th('', true)}</tr></thead>
            <tbody>
              {fc.map((c) => {const cu = c.subs.filter((s) => subStatus(s) === 'unmapped').length;const cm = c.subs.filter((s) => subStatus(s) === 'mapped').length;return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${P.hairline}` }}>
                  <td style={{ padding: '12px 8px 12px 16px', width: 30 }}><Icon name="sort" size={15} color={P.inkFaint} style={{ cursor: 'grab' }} /></td>
                  <td style={{ padding: '12px 16px' }}><button onClick={() => setEditCat(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}><CatGlyph name={c.name} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{c.name}</span></button></td>
                  <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {c.subs.slice(0, 3).map((s) => <span key={s.name} style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2, background: P.surface3, borderRadius: 7, padding: '3px 8px' }}>{s.name}</span>)}
                      {c.subs.length > 3 && <span style={{ fontSize: 11.5, fontWeight: 600, color: P.inkMute, padding: '3px 4px' }}>+{c.subs.length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{cu > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: P.warn }}><span style={{ width: 7, height: 7, borderRadius: 99, background: P.warn }} />{cu} unmapped</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: cm ? P.good : P.inkMute }}><span style={{ width: 7, height: 7, borderRadius: 99, background: cm ? P.good : P.inkFaint }} />{cm ? 'All mapped' : 'Skipped'}</span>}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: P.fontMono, fontWeight: 600, color: P.ink2 }}>{catCount(c.id)}</td>
                  <td style={{ padding: '12px 16px' }}><Pill kind="good" dot>{c.status}</Pill></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <IconBtn icon="pencil" size={15} style={{ width: 32, height: 32 }} onClick={() => setEditCat(c.id)} />
                    <IconBtn icon="trash" size={15} style={{ width: 32, height: 32 }} />
                  </td>
                </tr>);})}
            </tbody>
          </table> :
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ background: P.surface2 }}>{th('Sub-category')}{th('Parent category')}{th('Weedmaps taxonomy')}{th('Status')}{th('', true)}</tr></thead>
            <tbody>
              {fs.map((r, i) =>
              <tr key={i} style={{ borderTop: `1px solid ${P.hairline}` }}>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: P.ink }}><button onClick={() => setEditSub({ catId: r.catId, name: r.name })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: 13.5, fontWeight: 700, fontFamily: P.fontSans, padding: 0, textAlign: 'left' }}>{r.name}</button></td>
                  <td style={{ padding: '11px 16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: P.ink2 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: catColor(r.parent) }} />{r.parent}</span></td>
                  <td style={{ padding: '11px 16px' }}><WmPill sub={r} /></td>
                  <td style={{ padding: '11px 16px' }}><Pill kind="good" dot>Active</Pill></td>
                  <td style={{ padding: '11px 16px', textAlign: 'right' }}><IconBtn icon="pencil" size={15} style={{ width: 32, height: 32 }} onClick={() => setEditSub({ catId: r.catId, name: r.name })} /></td>
                </tr>)}
            </tbody>
          </table>}
        </div>
      </Card>}
    </div>);
};

// ── Weedmaps mapping board (Option B) — assign every sub-category to WM nodes.
function MappingBoard({ cats, setSub, onEditSub }) {
  const P = useP();
  const [pick, setPick] = React.useState(null); // `${catId}::${name}`
  const subs = flatSubs(cats);
  const mapped = subs.filter((s) => subStatus(s) === 'mapped').length;
  const unmapped = subs.filter((s) => subStatus(s) === 'unmapped');
  const skipped = subs.filter((s) => subStatus(s) === 'skipped').length;
  const Stat = ({ n, label, c }) => <div style={{ flex: 1, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: '11px 14px' }}><div style={{ fontSize: 21, fontWeight: 800, color: c, fontFamily: P.fontMono }}>{n}</div><div style={{ fontSize: 11.5, color: P.inkDim, fontWeight: 600 }}>{label}</div></div>;

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', gap: 12 }}>
      <Stat n={mapped} label="Mapped to Weedmaps" c={P.good} />
      <Stat n={unmapped.length} label="Unmapped — needs a node" c={unmapped.length ? P.warn : P.inkMute} />
      <Stat n={skipped} label="Intentionally not synced" c={P.inkMute} />
      <Stat n={WM_ALL.length} label="Weedmaps nodes available" c={P.ink2} />
    </div>

    {unmapped.length > 0 &&
    <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, background: P.warnSoft }}><Icon name="shield" size={15} stroke={2} color={P.warn} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Needs mapping</span><span style={{ fontSize: 11.5, color: P.inkDim }}>{unmapped.length} sub-categories have no Weedmaps node and aren’t marked skip</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 14 }}>
        {unmapped.map((s) => <button key={s.catId + s.name} onClick={() => onEditSub(s.catId, s.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: P.ink, background: P.surface, border: `1px solid ${P.warn}`, borderRadius: 99, padding: '5px 11px', cursor: 'pointer', fontFamily: P.fontSans }}><span style={{ width: 6, height: 6, borderRadius: 2, background: catColor(s.parent) }} />{s.name}<Icon name="arrow-right" size={12} stroke={2.2} color={P.inkMute} /></button>)}
      </div>
    </Card>}

    {cats.map((c) => <Card key={c.id} padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <CatGlyph name={c.name} size={28} /><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{c.name}</span>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{c.subs.length} sub-categories</span>
      </div>
      <div>
        {c.subs.map((s, i) => <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
          <span style={{ flex: '0 0 240px', fontSize: 12.5, fontWeight: 600, color: P.ink }}>{s.name}</span>
          <Icon name="arrow-right" size={14} color={P.inkFaint} style={{ flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}><WmPill sub={s} /></div>
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <button onClick={() => setPick(pick === c.id + '::' + s.name ? null : c.id + '::' + s.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: P.r10, border: `1px solid ${P.hairline2}`, background: P.surface, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: P.ink2, fontFamily: P.fontSans }}><Icon name="link" size={13} stroke={2} />Map<Icon name="chevron-down" size={12} stroke={2.2} color={P.inkMute} /></button>
            {pick === c.id + '::' + s.name && <WmMultiPicker value={s.wm} skip={s.skip} onChange={(wm) => setSub(c.id, s.name, { wm, skip: wm.length ? false : s.skip })} onSkip={(skip) => setSub(c.id, s.name, { skip, wm: skip ? [] : s.wm })} onClose={() => setPick(null)} />}
          </div>
        </div>)}
      </div>
    </Card>)}
  </div>;
}