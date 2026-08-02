// ── Product shells · store + taxonomy ──────────────────────────────────────
// One shell = one product family. Brand + format + category + size + price +
// traits + delivery box are set ONCE here and inherited by every variation.
// Batches still own quantity, cost, barcode and potency.
;(function () {
  const HW = window.HW;

  // Categories mirror the live hyperwolf.com/shop menu. slug = real URL segment.
  const TAX = [
    { key: 'Flower', name: 'Flower', slug: 'flower', units: ['g', 'oz'], unit: 'g', presets: ['1g', '3.5g', '7g', '14g', '28g'],
      subs: ['Premium Flower', 'Smaller Bud Flower', 'Value Flower', 'Bulk Flower 5g–28g', 'Infused Flower', 'Smalls'],
      wm: 'Flower › Bud', traits: [{ label: 'Format', value: 'Whole flower' }, { label: 'Cure', value: 'Cold cure' }, { label: 'Infused', value: 'No' }] },
    { key: 'Pre-Rolls', name: 'Pre-Rolls', slug: 'prerolls', units: ['g', 'ct', 'oz'], unit: 'g', presets: ['0.5g', '1g', '1.75g', '2.5g', '5g'],
      subs: ['Single Pre-Roll', 'Multipacks', 'Infused Pre-Rolls', 'Blunts', 'Hash Holes'],
      wm: 'Pre Roll › Single', traits: [{ label: 'Pieces per pack', value: '1' }, { label: 'Infused', value: 'No' }] },
    { key: 'Vapes', name: 'Vapes', slug: 'vapes', units: ['g', 'ml', 'ct'], unit: 'g', presets: ['0.3g', '0.5g', '1g', '2g'],
      subs: ['All-In-One', 'Cartridges', 'Pods', 'Disposables', 'Batteries'],
      wm: 'Vape Pens › All-In-One', traits: [{ label: 'Hardware', value: 'All-in-one' }, { label: 'Extract', value: 'Distillate' }] },
    { key: 'Concentrates', name: 'Concentrates', slug: 'concentrates', units: ['g', 'ct'], unit: 'g', presets: ['0.5g', '1g', '2g', '3.5g'],
      subs: ['Live Resin', 'Live Rosin', 'Badder', 'Diamonds', 'Sauce', 'Hash', 'Solventless', 'Applicators'],
      wm: 'Concentrates › Live Resin', traits: [{ label: 'Extract type', value: 'Live Resin' }, { label: 'Consistency', value: 'Badder' }] },
    { key: 'Edibles', name: 'Edibles', slug: 'edibles', units: ['mg', 'g', 'ct', 'ml'], unit: 'mg', presets: ['10mg', '100mg', '200mg', '1000mg'],
      subs: ['Gummies', 'Chocolates', 'Baked Goods', 'Drinks', 'Tablets', 'Microdose', 'High Dose'],
      wm: 'Edibles › Gummies', traits: [{ label: 'Pieces per pack', value: '10' }, { label: 'Serving size', value: '10 mg' }] },
    { key: 'Wellness', name: 'CBD & Wellness', slug: 'cbd-wellness', units: ['mg', 'ml', 'g', 'ct'], unit: 'ml', presets: ['30ml', '60ml', '100mg', '500mg'],
      subs: ['Tinctures', 'Topicals', 'CBD', 'Ratio Products', 'Capsules', 'Pet'],
      wm: 'Wellness › Tinctures', traits: [{ label: 'Ratio', value: '1:1' }, { label: 'Format', value: 'Tincture' }] },
    { key: 'Accessories', name: 'Accessories', slug: 'accessories', units: ['ct', 'g'], unit: 'ct', presets: ['1ct', '2ct', '5ct'],
      subs: ['Batteries', 'Papers & Wraps', 'Grinders', 'Lighters', 'Glass', 'Storage', 'Apparel'],
      wm: 'Gear › Accessories', traits: [{ label: 'Material', value: '—' }] }];

  const catDef = (key) => TAX.find((c) => c.key === key) || TAX[0];

  // Delivery boxes — which box on the van a family rides in.
  let BOXES = ['Flower Box 1', 'Flower Box 2', 'Pre-roll Box 1', 'Vape Box 1', 'Vape Box 2', 'Edible Box', 'Concentrate bin 1', 'Cooler'];

  const FORMAT_BY_CAT = { Flower: 'Eighth Jar 3.5g', Vapes: 'All-In-One Vape 1g', 'Pre-Rolls': 'Pre-Roll 1g', Concentrates: 'Live Resin 1g', Edibles: 'Gummies 100mg 10pk', Wellness: 'Tincture 30ml', Accessories: 'Accessory' };
  const SHELL_FORMATS = ['All-In-One Vape 1g', 'Cartridge 1g', 'Cartridge .5g', 'Eighth Jar 3.5g', 'Quarter Jar 7g', 'Pre-Roll 1g', 'Pre-Roll 5-pack', 'Infused Pre-Roll 1.5g', 'Gummies 100mg 10pk', 'Live Resin 1g', 'Rosin 1g', 'Tincture 30ml'];
  const BOX_BY_CAT = { Flower: 'Flower Box 1', Vapes: 'Vape Box 1', 'Pre-Rolls': 'Pre-roll Box 1', Concentrates: 'Concentrate bin 1', Edibles: 'Edible Box', Wellness: 'Cooler', Accessories: 'Cooler' };

  // ── size parsing — "3.5g", "1/8", "eighth", "100 mg" all land correctly ──
  function parseSize(raw, curUnit, allowed) {
    const t = String(raw).toLowerCase().trim();
    const named = { eighth: ['3.5', 'g'], '1/8': ['3.5', 'g'], quarter: ['7', 'g'], '1/4': ['7', 'g'], half: ['14', 'g'], '1/2': ['14', 'g'], ounce: ['28', 'g'], zip: ['28', 'g'], '1/16': ['1.75', 'g'], gram: ['1', 'g'] };
    if (named[t]) return { amount: named[t][0], unit: allowed.includes(named[t][1]) ? named[t][1] : curUnit };
    const m = t.match(/^([0-9]*\.?[0-9]*)\s*([a-z]*)$/);
    if (!m) return { amount: String(raw).replace(/[^0-9.]/g, ''), unit: curUnit };
    const alias = { g: 'g', gram: 'g', grams: 'g', mg: 'mg', milligram: 'mg', ml: 'ml', milliliter: 'ml', ct: 'ct', count: 'ct', pc: 'ct', pcs: 'ct', ea: 'ct', oz: 'oz', ounce: 'oz' };
    const hit = alias[m[2]];
    return { amount: m[1], unit: hit && allowed.includes(hit) ? hit : curUnit };
  }
  const splitSize = (w) => ({ amount: String(w || '').replace(/[a-z]+$/i, ''), unit: String(w || '').replace(/^[0-9.]+/, '') || 'g' });
  const mono1 = (s) => ((s || '?').trim()[0] || '?').toUpperCase();
  const mono2 = (s) => (s || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const familyPath = (s) => s.brand + ' › ' + s.sub + ' › ' + s.weight;
  const menuPath = (s) => 'hyperwolf.com/shop/' + catDef(s.cat).slug + '/' + slugify(s.sub || '');

  // ── seed from the live catalog, grouped brand × category ──
  function seed() {
    const byBrandCat = {};
    HW.PRODUCTS.forEach((p) => {const k = p.brand + '|' + p.cat;(byBrandCat[k] = byBrandCat[k] || []).push(p);});
    return Object.keys(byBrandCat).map((k, i) => {
      const items = byBrandCat[k], first = items[0], def = catDef(first.cat);
      const fmtName = FORMAT_BY_CAT[first.cat] || 'Eighth Jar 3.5g';
      const size = splitSize(first.wt || def.presets[1] || '1g');
      const unit = def.units.includes(size.unit) ? size.unit : def.unit;
      const avgCost = Math.round(items.reduce((a, p) => a + p.cost, 0) / items.length * 100) / 100;
      // Base price = the price most of the family actually sells at, so the
      // shell reads as the family norm and only genuine outliers show OVERRIDE.
      // A shell's EFFECTIVE price is always `sale || price`, and it always
      // equals base — so "inherited" means one number across the whole line.
      const tally = {};items.forEach((p) => {tally[p.price] = (tally[p.price] || 0) + 1;});
      const base = Number(Object.keys(tally).sort((a, b) => tally[b] - tally[a] || b - a)[0]);
      // Only treat a was-price as a promo when it is plausibly the list price.
      const promo = items.map((p) => p.was || 0).filter((w) => w > base && w <= base * 2);
      const retail = promo.length ? Math.max(...promo) : base;
      const sale = promo.length ? base : 0;
      return {
        id: 'SH-' + String(1040 + i * 7),
        brand: first.brand, format: fmtName, name: first.brand + ' · ' + fmtName,
        cat: first.cat, sub: def.subs[0], ptype: first.cat === 'Accessories' ? 'Accessory' : 'Cannabis',
        unit, netW: size.amount || '1', weight: (size.amount || '1') + unit, pack: first.cat === 'Edibles' ? '10' : '1',
        kit: BOX_BY_CAT[first.cat] || 'Cooler',
        wmNode: def.wm,
        stores: 1 + first.sku.charCodeAt(1) % 4,
        hue: first.hue, price: retail, sale: sale, cost: avgCost,
        traits: def.traits.map((t) => ({ ...t })),
        variations: items.map((p) => ({ sku: p.sku, name: p.name, price: p.price, override: p.price !== base, strain: p.strain, active: p.active, qty: p.qty, sample: false, thumb: p }))
      };
    });
  }

  let SHELLS = null;
  const subs = new Set();
  const emit = () => subs.forEach((f) => f());
  function allShells() {if (!SHELLS) SHELLS = seed();return SHELLS;}
  function shellById(id) {return allShells().find((s) => s.id === id) || null;}
  function shellOf(p) {return allShells().filter((s) => s.brand === p.brand && s.cat === p.cat)[0] || allShells()[0];}
  function totalStock(s) {return s.variations.reduce((a, v) => a + (v.qty || 0), 0);}
  // What a variation sells for when it inherits — the promo price if one is
  // running, otherwise retail. Every "inherited" tag refers to this number.
  function effectivePrice(s) {return !s ? 0 : s.sale ? s.sale : s.price;}

  // React binding — any component calling useShells() re-renders on a mutation.
  function useShells() {
    const [, bump] = React.useState(0);
    React.useEffect(() => {const cb = () => bump((n) => n + 1);subs.add(cb);return () => subs.delete(cb);}, []);
    return allShells();
  }

  function saveShell(draft, editingId) {
    const list = allShells();
    const def = catDef(draft.cat);
    const weight = (draft.netW || '1') + draft.unit;
    const common = {
      brand: (draft.brand || '').trim() || 'New Brand', cat: draft.cat, sub: draft.sub || def.subs[0],
      format: draft.format || FORMAT_BY_CAT[draft.cat] || 'Eighth Jar 3.5g',
      unit: draft.unit, netW: draft.netW || '1', weight, pack: draft.pack || '1', kit: draft.kit || '—',
      ptype: draft.ptype || 'Cannabis', wmNode: draft.wmNode || def.wm,
      price: parseFloat(draft.price) || 0, sale: parseFloat(draft.sale) || 0,
      traits: (draft.traits || []).filter((t) => t.label.trim()).map((t) => ({ label: t.label.trim(), value: t.value.trim() || '—' })),
    };
    common.name = common.brand + ' · ' + common.format;
    let id = editingId;
    if (editingId) {
      SHELLS = list.map((s) => s.id === editingId ? { ...s, ...common } : s);
    } else {
      id = 'SH-' + String(2000 + Math.floor(Math.random() * 900));
      SHELLS = [{ id, ...common, stores: 1, hue: Math.floor(Math.random() * 360), cost: 0, variations: [] }, ...list];
    }
    emit();
    return id;
  }

  function addVariation(shellId, v) {
    SHELLS = allShells().map((s) => s.id === shellId ? { ...s, variations: [...s.variations, v] } : s);
    emit();
  }
  function addBox(name) {if (name && !BOXES.includes(name)) {BOXES = [...BOXES, name];emit();}}
  function renameBox(oldName, next) {
    if (!next || next === oldName) return;
    BOXES = BOXES.map((b) => b === oldName ? next : b);
    SHELLS = allShells().map((s) => s.kit === oldName ? { ...s, kit: next } : s);
    emit();
  }

  // AI product-description draft for a new variation.
  function aiDesc(shell, v) {
    if (!shell) return '';
    const type = v && v.strain || 'Hybrid';
    const name = v && v.name && v.name.trim() || shell.brand + ' ' + shell.sub;
    const effect = { Indica: 'a mellow, body-heavy calm', Sativa: 'a bright, uplifting lift', Hybrid: 'a balanced, easygoing effect', CBD: 'a clear-headed, non-intoxicating calm' }[type] || 'a balanced effect';
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return pick(['Meet ' + name + '.', 'Say hello to ' + name + '.', name + ' joins the family.']) + ' ' +
    pick(['This ' + String(type).toLowerCase() + ' ' + shell.sub.toLowerCase() + ' delivers ' + effect + ' in every ' + shell.weight + ' unit.',
    'A ' + String(type).toLowerCase() + ' spin on the ' + shell.brand + ' ' + shell.sub.toLowerCase() + ', tuned for ' + effect + '.',
    'Built for ' + effect + ', held to the same ' + shell.weight + ' spec as the rest of the line.']) + ' ' +
    pick(['Consistent, compliant, and shelf-ready.', 'Same trusted format, a fresh flavour.', 'Small-batch quality your regulars will recognise.']);
  }

  // The fields a variation inherits, rendered identically on the shell page,
  // in the create-variation step and in the add-product flow.
  function sharedRows(s) {
    const money = HW.fmt.money0;
    const low = Math.round(s.cost * 0.85), high = Math.round(s.cost * 1.18);
    return [
      { label: 'Brand', value: s.brand },
      { label: 'Category', value: s.cat },
      { label: 'Subcategory', value: s.sub },
      { label: 'Format', value: s.format },
      { label: 'Weight / size', value: s.weight },
      { label: 'Retail price', value: money(s.price) },
      { label: 'Sale price', value: s.sale ? money(s.sale) : '—', sub: s.sale ? 'was ' + money(s.price) : 'no promo running' },
      { label: 'Unit cost · batch avg', value: s.cost ? money(s.cost) : '—', sub: s.cost ? 'low ' + money(low) + '  ·  high ' + money(high) : 'set when a batch is received', flag: 'From batches' },
      { label: 'Weedmaps node', value: s.wmNode, flag: 'Synced' },
      { label: 'Delivery box', value: s.kit || '—', flag: 'Delivery only' }];
  }

  window.HW_SHELL = { TAX, catDef, get BOXES() {return BOXES;}, KIT_BOXES: BOXES, SHELL_FORMATS, FORMAT_BY_CAT,
    allShells, shellById, shellOf, useShells, saveShell, addVariation, addBox, renameBox,
    parseSize, splitSize, mono1, mono2, slugify, familyPath, menuPath, totalStock, effectivePrice, aiDesc, sharedRows };
})();
