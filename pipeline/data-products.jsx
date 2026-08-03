// ── Product wrappers, product shells, product batches ─────────────────────
// Verbatim port of prototype/lib/fixtures/products.ts + fake-product-matcher.ts.
;(function () {
  const PRODUCTS_NOW = new Date('2026-04-20T18:30:00-07:00').getTime();
  const daysAgoIso = (days) => new Date(PRODUCTS_NOW - days * 86400000).toISOString();
  const daysAheadIso = (days) => new Date(PRODUCTS_NOW + days * 86400000).toISOString();

  const PRODUCT_SHELLS = [
    { id: 'sh-edibles-100mg', name: 'Premium Edibles 100mg', basePriceCents: 2200, marginPct: 0.55, appliesToCategory: 'Edibles', productCount: 4 },
    { id: 'sh-cart-1g', name: 'Premium 1g Cart', basePriceCents: 4500, marginPct: 0.5, appliesToCategory: 'Vapes', productCount: 4 },
    { id: 'sh-preroll-pack', name: 'Pre-Roll Pack', basePriceCents: 3800, marginPct: 0.48, appliesToCategory: 'Pre-Rolls', productCount: 3 },
  ];
  const getProductShell = (id) => (id ? PRODUCT_SHELLS.find((t) => t.id === id) ?? null : null);
  const productRetailCents = (product, shell) => {
    if (product.customRetailCents != null) return product.customRetailCents;
    if (shell) return shell.basePriceCents;
    return null;
  };

  const PRODUCT_SEEDS = [
    { id: 'p-kiva-camino-wild', name: 'Camino Wild Berry Gummies', brandId: 'v-kiva', brandName: 'Kiva', type: 'hybrid', weight: { value: 100, unit: 'mg' }, traits: ['vegan', 'live resin', 'fast-onset'], productShellId: 'sh-edibles-100mg', customRetailCents: null, category: 'Edibles', sku: 'HD-KIVA-001', photoSeed: 11 },
    { id: 'p-kiva-terra-espresso', name: 'Terra Bites Milk Chocolate Espresso', brandId: 'v-kiva', brandName: 'Kiva', type: 'hybrid', weight: { value: 100, unit: 'mg' }, traits: ['small-batch', 'espresso'], productShellId: 'sh-edibles-100mg', customRetailCents: null, category: 'Edibles', sku: 'HD-KIVA-002', photoSeed: 12 },
    { id: 'p-kiva-petra-moroccan', name: 'Petra Mints Moroccan', brandId: 'v-kiva', brandName: 'Kiva', type: 'sativa', weight: { value: 100, unit: 'mg' }, traits: ['low-cal', 'discreet'], productShellId: 'sh-edibles-100mg', customRetailCents: 2500, category: 'Edibles', sku: 'HD-KIVA-003', photoSeed: 13 },
    { id: 'p-wyld-raspberry', name: 'Raspberry Sativa Gummies', brandId: 'v-wyld', brandName: 'Wyld', type: 'sativa', weight: { value: 100, unit: 'mg' }, traits: ['real-fruit', 'vegan'], productShellId: 'sh-edibles-100mg', customRetailCents: null, category: 'Edibles', sku: 'HD-WYLD-001', photoSeed: 21 },
    { id: 'p-stiiizy-blue-dream', name: 'Pod Blue Dream Live Resin', brandId: 'v-stiiizy', brandName: 'Stiiizy', type: 'hybrid', weight: { value: 0.5, unit: 'g' }, traits: ['live resin', 'proprietary pod'], productShellId: 'sh-cart-1g', customRetailCents: 3200, category: 'Vapes', sku: 'HD-STII-001', photoSeed: 31 },
    { id: 'p-stiiizy-sour-diesel', name: 'Pod Sour Diesel', brandId: 'v-stiiizy', brandName: 'Stiiizy', type: 'sativa', weight: { value: 1, unit: 'g' }, traits: ['classic strain'], productShellId: 'sh-cart-1g', customRetailCents: null, category: 'Vapes', sku: 'HD-STII-002', photoSeed: 32 },
    { id: 'p-hh-og-kush', name: 'OG Kush Cartridge', brandId: 'v-heavy', brandName: 'Heavy Hitters', type: 'indica', weight: { value: 1, unit: 'g' }, traits: ['high-potency', 'ceramic coil'], productShellId: 'sh-cart-1g', customRetailCents: null, category: 'Vapes', sku: 'HD-HEAV-001', photoSeed: 41 },
    { id: 'p-hh-diamond-pineapple', name: 'Diamond Pineapple', brandId: 'v-heavy', brandName: 'Heavy Hitters', type: 'sativa', weight: { value: 1, unit: 'g' }, traits: ['diamond-infused'], productShellId: 'sh-cart-1g', customRetailCents: null, category: 'Vapes', sku: 'HD-HEAV-002', photoSeed: 42 },
    { id: 'p-jeeter-baby-churros', name: 'Baby Cannon Churros', brandId: 'v-jeeter', brandName: 'Jeeter', type: 'hybrid', weight: { value: 1.3, unit: 'g' }, traits: ['infused', 'kief-coated'], productShellId: 'sh-preroll-pack', customRetailCents: null, category: 'Pre-Rolls', sku: 'HD-JEET-001', photoSeed: 51 },
    { id: 'p-jeeter-joints-runtz', name: 'Joints Runtz 5-Pack', brandId: 'v-jeeter', brandName: 'Jeeter', type: 'hybrid', weight: { value: 5, unit: 'pk' }, traits: ['5-pack', 'indoor'], productShellId: 'sh-preroll-pack', customRetailCents: null, category: 'Pre-Rolls', sku: 'HD-JEET-002', photoSeed: 52 },
    { id: 'p-cookies-lpc', name: 'London Pound Cake Pre-Roll', brandId: 'v-cookies', brandName: 'Cookies', type: 'indica', weight: { value: 1, unit: 'g' }, traits: ['single', 'indoor'], productShellId: 'sh-preroll-pack', customRetailCents: null, category: 'Pre-Rolls', sku: 'HD-COOK-001', photoSeed: 61 },
    { id: 'p-cookies-gary-payton', name: 'Gary Payton Flower', brandId: 'v-cookies', brandName: 'Cookies', type: 'hybrid', weight: { value: 3.5, unit: 'g' }, traits: ['indoor', 'exotics'], productShellId: null, customRetailCents: 5800, category: 'Flower', sku: 'HD-COOK-002', photoSeed: 62 },
  ];

  // Brand hues drive the product thumbnails (rendered as token gradients
  // rather than the source's placeholder image service).
  const HUE_BY_BRAND = { 'v-kiva': 24, 'v-wyld': 340, 'v-stiiizy': 222, 'v-heavy': 0, 'v-jeeter': 36, 'v-cookies': 152 };

  const PRODUCTS = PRODUCT_SEEDS.map((s) => ({
    id: s.id, name: s.name, brandId: s.brandId, brandName: (window.HW_BRANDS.byId[s.brandId] || {}).name || s.brandName, type: s.type, weight: s.weight,
    traits: s.traits, hue: HUE_BY_BRAND[s.brandId] ?? 90, photoSeed: s.photoSeed,
    productShellId: s.productShellId, customRetailCents: s.customRetailCents, category: s.category, sku: s.sku, active: true,
  }));
  const getProduct = (id) => PRODUCTS.find((p) => p.id === id) ?? null;

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(778899);
  const range = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  function pad24() {
    let s = '1A40603000';
    const hex = '0123456789ABCDEF';
    while (s.length < 24) s += hex[Math.floor(rng() * 16)];
    return s;
  }

  function batchesForProduct(p, idx) {
    const count = range(2, 5);
    const rows = [];
    const tpl = getProductShell(p.productShellId);
    const retail = productRetailCents(p, tpl) ?? 3000;
    const targetMargin = tpl?.marginPct ?? 0.5;
    const baseCost = Math.round(retail * (1 - targetMargin));
    for (let i = 0; i < count; i++) {
      const ageDays = range(2, 90);
      const expiresInDays = range(-15, 360);
      const status = expiresInDays < 0 ? 'sold_out' : i === 0 ? 'selling' : (i === count - 1 && range(0, 10) < 2) ? 'recalled' : 'active';
      const qtyReceived = range(80, 360);
      const qtyOnHand = status === 'sold_out' ? 0 : Math.max(0, qtyReceived - range(0, Math.floor(qtyReceived * 0.6)));
      const costJitter = 0.85 + rng() * 0.3;
      const wholesaleCostCents = Math.round(baseCost * costJitter);
      const isEdible = p.weight.unit === 'mg';
      rows.push({
        id: `pb-${idx + 1}-${i + 1}`, productId: p.id, metrcPackageId: pad24(), qtyReceived, qtyOnHand,
        thcPct: isEdible ? undefined : Number((18 + rng() * 14).toFixed(1)), thcMg: isEdible ? p.weight.value : undefined,
        packageDate: daysAgoIso(ageDays),
        expirationDate: expiresInDays >= 0 ? daysAheadIso(expiresInDays) : daysAgoIso(-expiresInDays),
        wholesaleCostCents, sourceInvoiceId: `INV-2026-${range(1000, 9999)}`, status,
      });
    }
    return rows.sort((a, b) => new Date(b.packageDate).getTime() - new Date(a.packageDate).getTime());
  }

  const PRODUCT_BATCHES = PRODUCTS.flatMap((p, i) => batchesForProduct(p, i));
  const batchesFor = (productId) => PRODUCT_BATCHES.filter((b) => b.productId === productId);
  const hasNearExpiryBatch = (productId) => {
    const cutoff = PRODUCTS_NOW + 30 * 86400000;
    return PRODUCT_BATCHES.some((b) => b.productId === productId && b.status !== 'sold_out' && new Date(b.expirationDate).getTime() <= cutoff);
  };

  const UNMAPPED_BATCHES = [
    { id: 'ub-001', metrcPackageId: pad24(), productName: 'Kiva Lost Farms Honeydew Gummies 100mg', brand: 'Kiva', category: 'Edibles', qty: 144, receivedAt: daysAgoIso(2), vendorName: 'Kiva Confections' },
    { id: 'ub-002', metrcPackageId: pad24(), productName: 'Stiiizy 40s Strawberry Cough 5-pack', brand: 'Stiiizy', category: 'Edibles', qty: 60, receivedAt: daysAgoIso(1), vendorName: 'STIIIZY' },
    { id: 'ub-003', metrcPackageId: pad24(), productName: 'Heavy Hitters Diamond Disposable Mango 1g', brand: 'Heavy Hitters', category: 'Vapes', qty: 96, receivedAt: daysAgoIso(3), vendorName: 'Heavy Hitters' },
  ];

  function summarize(product) {
    const batches = batchesFor(product.id);
    const total = batches.reduce((acc, b) => acc + b.qtyOnHand, 0);
    const tpl = getProductShell(product.productShellId);
    return {
      batchCount: batches.length, totalQtyOnHand: total, hasNearExpiry: hasNearExpiryBatch(product.id),
      effectiveRetailCents: productRetailCents(product, tpl),
      retailFromShell: product.customRetailCents == null && product.productShellId != null,
    };
  }

  function batchExpiryStatus(iso) {
    const t = new Date(iso).getTime();
    if (t < PRODUCTS_NOW) return 'expired';
    if (t - PRODUCTS_NOW <= 30 * 86400000) return 'near';
    return 'ok';
  }
  const batchMarginPct = (wholesaleCostCents, retailCents) => (retailCents == null || retailCents <= 0 ? null : (retailCents - wholesaleCostCents) / retailCents);

  // In-memory mapping surface for the "map batch to product" flow.
  let mappedBatches = {};
  const listeners = new Set();
  const getMappedProductId = (batchId) => mappedBatches[batchId] ?? null;
  const mapBatchToProduct = (batchId, productId) => { mappedBatches = { ...mappedBatches, [batchId]: productId }; listeners.forEach((l) => l()); };
  const subscribeMappings = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

  // ── Line → product matcher ──────────────────────────────────────────────
  const STOPWORDS = new Set(['the', 'a', 'and', 'of', 'with', 'for', 'by', 'to', 'in', 'on', 'pack', 'pk', 'single', 'single-serve', 'cartridge', 'cart', 'pod', 'preroll', 'pre-roll', 'gummies', 'gummy', 'live', 'resin', 'infused']);
  const tokenize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t && !STOPWORDS.has(t));
  function tokenOverlap(a, b) {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    let hits = 0;
    for (const t of b) if (setA.has(t)) hits += 1;
    return hits / Math.max(a.length, b.length);
  }
  function brandHint(desc, vendorName) {
    const blob = `${desc} ${vendorName ?? ''}`.toLowerCase();
    const brands = [...new Set(PRODUCTS.map((p) => p.brandName.toLowerCase()))].sort((a, b) => b.length - a.length);
    for (const b of brands) if (blob.includes(b)) return b;
    return '';
  }
  function matchLineToProduct(description, vendorName) {
    const descTokens = tokenize(description);
    const hint = brandHint(description, vendorName);
    const scored = PRODUCTS.map((p) => {
      const productTokens = tokenize(`${p.brandName} ${p.name}`);
      let score = tokenOverlap(descTokens, productTokens);
      if (hint && p.brandName.toLowerCase() === hint) score = Math.min(1, score + 0.18);
      const wLine = description.match(/(\d+(?:\.\d+)?)\s*(mg|g)/i);
      const wProd = `${p.weight.value}${p.weight.unit}`;
      if (wLine && wLine[0].toLowerCase().replace(/\s+/g, '') === wProd) score = Math.min(1, score + 0.08);
      return { productId: p.id, productName: p.name, brandName: p.brandName, confidence: Number(score.toFixed(3)) };
    }).filter((c) => c.confidence > 0).sort((a, b) => b.confidence - a.confidence);
    const best = scored[0];
    if (!best || best.confidence < 0.18) return { productId: null, confidence: 0, candidates: [] };
    const shape = (raw) => Math.min(0.99, raw >= 0.55 ? 0.92 + (raw - 0.55) * 0.18 : raw >= 0.32 ? 0.55 + (raw - 0.32) * 0.78 : 0.35 + raw * 0.5);
    const shaped = shape(best.confidence);
    const candidates = scored.slice(0, 4).map((c) => ({ ...c, confidence: Number(shape(c.confidence).toFixed(3)) }));
    return { productId: shaped >= 0.5 ? best.productId : null, confidence: Number(shaped.toFixed(3)), candidates };
  }

  window.HD_PRODUCTS = {
    PRODUCT_SHELLS, getProductShell, productRetailCents, PRODUCTS, getProduct,
    PRODUCT_BATCHES, batchesFor, hasNearExpiryBatch, UNMAPPED_BATCHES, summarize,
    batchExpiryStatus, batchMarginPct, getMappedProductId, mapBatchToProduct, subscribeMappings,
    matchLineToProduct, PRODUCTS_NOW,
  };
})();
