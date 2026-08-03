// ── Buyer analytics fixtures — SKU-level performance data ─────────────────
// Verbatim port of prototype/lib/fixtures/buyer-analytics.ts (seed 913177).
;(function () {
  const BUYER_CATEGORIES = ['Flower', 'Vapes', 'Edibles', 'Pre-Rolls', 'Concentrates', 'Topicals', 'Accessories'];

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(913177);
  const range = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const BUYER_NOW = new Date('2026-04-20T18:30:00-07:00').getTime();
  const daysAgoIso = (days) => new Date(BUYER_NOW - days * 86400000).toISOString();
  const ENTITY_IDS = ['thc', 'ccd', 'ah', 'hwd'];

  const SKU_SEEDS = [
    { brand: 'Kiva', category: 'Edibles', productName: 'Kiva Camino Wild Berry Gummies 100mg', archetype: 'hot_hero' },
    { brand: 'Kiva', category: 'Edibles', productName: 'Kiva Terra Bites Milk Chocolate Espresso 100mg', archetype: 'steady' },
    { brand: 'Kiva', category: 'Edibles', productName: 'Kiva Petra Mints Moroccan 100mg', archetype: 'premium_slow' },
    { brand: 'Kiva', category: 'Edibles', productName: 'Kiva Dark Chocolate Bar 60mg', archetype: 'dog' },
    { brand: 'Stiiizy', category: 'Vapes', productName: 'Stiiizy Pod Blue Dream Live Resin 0.5g', archetype: 'hot_hero' },
    { brand: 'Stiiizy', category: 'Vapes', productName: 'Stiiizy Pod Sour Diesel 1g', archetype: 'steady' },
    { brand: 'Stiiizy', category: 'Vapes', productName: 'Stiiizy Liiil Disposable OG Kush 1g', archetype: 'stockout' },
    { brand: 'Stiiizy', category: 'Edibles', productName: 'Stiiizy 40s Gummies Strawberry', archetype: 'steady' },
    { brand: 'Wyld', category: 'Edibles', productName: 'Wyld Raspberry Sativa Gummies 100mg', archetype: 'hot_hero' },
    { brand: 'Wyld', category: 'Edibles', productName: 'Wyld Elderberry Indica Gummies 100mg', archetype: 'steady' },
    { brand: 'Wyld', category: 'Edibles', productName: 'Wyld Marionberry Hybrid Gummies 100mg', archetype: 'premium_slow' },
    { brand: 'Heavy Hitters', category: 'Vapes', productName: 'Heavy Hitters OG Kush Cartridge 1g', archetype: 'hot_hero' },
    { brand: 'Heavy Hitters', category: 'Vapes', productName: 'Heavy Hitters Diamond Pineapple 1g', archetype: 'stockout' },
    { brand: 'Heavy Hitters', category: 'Vapes', productName: 'Heavy Hitters Disposable Blueberry 1g', archetype: 'steady' },
    { brand: 'Raw Garden', category: 'Concentrates', productName: 'Raw Garden Refined Live Resin Pineapple OG 1g', archetype: 'hot_hero' },
    { brand: 'Raw Garden', category: 'Vapes', productName: 'Raw Garden Classic Cart Strawberry Shortcake 0.5g', archetype: 'steady' },
    { brand: 'Raw Garden', category: 'Concentrates', productName: 'Raw Garden Crushed Diamonds 1g', archetype: 'premium_slow' },
    { brand: 'Raw Garden', category: 'Concentrates', productName: 'Raw Garden Live Rosin 1g', archetype: 'dog' },
    { brand: 'Cookies', category: 'Flower', productName: 'Cookies Gary Payton 3.5g', archetype: 'hot_hero' },
    { brand: 'Cookies', category: 'Flower', productName: 'Cookies Cereal Milk 3.5g', archetype: 'steady' },
    { brand: 'Cookies', category: 'Pre-Rolls', productName: 'Cookies Pre-Roll London Pound Cake 1g', archetype: 'stockout' },
    { brand: 'Jeeter', category: 'Pre-Rolls', productName: 'Jeeter Baby Cannon Churros 1.3g', archetype: 'hot_hero' },
    { brand: 'Jeeter', category: 'Pre-Rolls', productName: 'Jeeter XL Blueberry Kush 2g', archetype: 'steady' },
    { brand: 'Jeeter', category: 'Pre-Rolls', productName: 'Jeeter Joints Runtz 1g 5-pack', archetype: 'premium_slow' },
    { brand: 'Jeeter', category: 'Pre-Rolls', productName: 'Jeeter Infused Horchata 1g', archetype: 'dog' },
    { brand: 'Papa & Barkley', category: 'Topicals', productName: 'P&B Releaf Balm 1.7oz', archetype: 'steady' },
    { brand: 'Papa & Barkley', category: 'Topicals', productName: 'P&B Releaf Patch 30mg', archetype: 'premium_slow' },
    { brand: 'Papa & Barkley', category: 'Topicals', productName: 'P&B 3:1 CBD:THC Tincture', archetype: 'dog' },
    { brand: 'Pax Labs', category: 'Accessories', productName: 'Pax Era Pro Vaporizer', archetype: 'steady' },
    { brand: 'Pax Labs', category: 'Accessories', productName: 'Pax Mini Onyx', archetype: 'premium_slow' },
  ];

  const PROFILES = {
    hot_hero: { costRangeCents: [800, 2200], markupRange: [2.0, 2.6], qtyOnHandRange: [40, 120], qtySold30dRange: [180, 380], reorderFreqDaysRange: [7, 14], reorderThresholdRange: [30, 80], lastSaleHoursAgoRange: [1, 6] },
    steady: { costRangeCents: [600, 1800], markupRange: [2.1, 2.8], qtyOnHandRange: [60, 220], qtySold30dRange: [60, 160], reorderFreqDaysRange: [14, 30], reorderThresholdRange: [30, 80], lastSaleHoursAgoRange: [2, 24] },
    premium_slow: { costRangeCents: [1500, 4500], markupRange: [2.6, 3.6], qtyOnHandRange: [40, 110], qtySold30dRange: [10, 35], reorderFreqDaysRange: [30, 60], reorderThresholdRange: [10, 25], lastSaleHoursAgoRange: [24, 96] },
    stockout: { costRangeCents: [900, 2400], markupRange: [2.1, 2.7], qtyOnHandRange: [3, 10], qtySold30dRange: [150, 300], reorderFreqDaysRange: [7, 14], reorderThresholdRange: [30, 80], lastSaleHoursAgoRange: [1, 4] },
    dog: { costRangeCents: [700, 2000], markupRange: [1.7, 2.2], qtyOnHandRange: [80, 220], qtySold30dRange: [2, 10], reorderFreqDaysRange: [45, 90], reorderThresholdRange: [5, 15], lastSaleHoursAgoRange: [72, 360] },
  };

  function buildSku(seed, idx) {
    const p = PROFILES[seed.archetype];
    const costCents = range(p.costRangeCents[0], p.costRangeCents[1]);
    const markup = p.markupRange[0] + rng() * (p.markupRange[1] - p.markupRange[0]);
    const sellCents = Math.round(costCents * markup);
    const qtyOnHand = range(p.qtyOnHandRange[0], p.qtyOnHandRange[1]);
    const qtySold30d = range(p.qtySold30dRange[0], p.qtySold30dRange[1]);
    const qtySold7d = Math.max(0, Math.round(qtySold30d / 4 + (rng() - 0.5) * (qtySold30d / 8)));
    const qtySold90d = Math.max(qtySold30d, Math.round(qtySold30d * (2.4 + rng() * 0.6)));
    return {
      id: `sku-${String(idx + 1).padStart(3, '0')}`,
      sku: `HD-${seed.brand.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`,
      productName: seed.productName, brand: seed.brand, category: seed.category, entity: pick(ENTITY_IDS),
      costCents, sellCents, qtyOnHand, qtySold7d, qtySold30d, qtySold90d,
      reorderFrequencyDays: range(p.reorderFreqDaysRange[0], p.reorderFreqDaysRange[1]),
      reorderThreshold: range(p.reorderThresholdRange[0], p.reorderThresholdRange[1]),
      lastSaleAt: daysAgoIso(range(p.lastSaleHoursAgoRange[0], p.lastSaleHoursAgoRange[1]) / 24),
    };
  }

  const BUYER_SKUS = SKU_SEEDS.map((s, i) => buildSku(s, i));

  const qtySoldForWindow = (sku, h) => (h === '7d' ? sku.qtySold7d : h === '30d' ? sku.qtySold30d : sku.qtySold90d);
  const windowDays = (h) => (h === '7d' ? 7 : h === '30d' ? 30 : 90);
  function sellThroughRate(sku, h) {
    const sold = qtySoldForWindow(sku, h);
    const denom = sold + sku.qtyOnHand;
    return denom <= 0 ? 0 : sold / denom;
  }
  function daysOfSupply(sku, h) {
    const sold = qtySoldForWindow(sku, h);
    if (sold <= 0) return Number.POSITIVE_INFINITY;
    return sku.qtyOnHand / (sold / windowDays(h));
  }
  const marginPct = (sku) => (sku.sellCents <= 0 ? 0 : (sku.sellCents - sku.costCents) / sku.sellCents);
  function stockHealth(sku, h) {
    const dos = daysOfSupply(sku, h);
    if (!Number.isFinite(dos)) return 'healthy';
    if (dos < 3) return 'stockout_imminent';
    if (dos < sku.reorderFrequencyDays) return 'at_risk';
    return 'healthy';
  }
  const revenueCentsForWindow = (sku, h) => qtySoldForWindow(sku, h) * sku.sellCents;
  const profitCentsForWindow = (sku, h) => qtySoldForWindow(sku, h) * (sku.sellCents - sku.costCents);

  function rollupByBrand(skus, h) {
    const map = new Map();
    for (const s of skus) {
      const rev = revenueCentsForWindow(s, h);
      const cost = qtySoldForWindow(s, h) * s.costCents;
      const profit = rev - cost;
      const sellThrough = sellThroughRate(s, h);
      const health = stockHealth(s, h);
      const existing = map.get(s.brand);
      if (existing) {
        existing.skuCount += 1;
        existing.revenueCents += rev;
        existing.costCents += cost;
        existing.profitCents += profit;
        existing.avgSellThrough = (existing.avgSellThrough * (existing.skuCount - 1) + sellThrough) / existing.skuCount;
        if (health !== 'healthy') existing.flaggedSkuCount += 1;
      } else {
        map.set(s.brand, { brand: s.brand, skuCount: 1, revenueCents: rev, costCents: cost, profitCents: profit, avgSellThrough: sellThrough, flaggedSkuCount: health === 'healthy' ? 0 : 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  }

  function categoryMedianSellThrough(skus, category, h) {
    const vals = skus.filter((s) => s.category === category).map((s) => sellThroughRate(s, h)).sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }
  const isSlowMover = (sku, skus, h) => sellThroughRate(sku, h) < categoryMedianSellThrough(skus, sku.category, h) * 0.5;

  window.HD_BUYER = {
    BUYER_CATEGORIES, BUYER_SKUS, BUYER_NOW, qtySoldForWindow, windowDays, sellThroughRate, daysOfSupply,
    marginPct, stockHealth, revenueCentsForWindow, profitCentsForWindow, rollupByBrand, categoryMedianSellThrough, isSlowMover,
  };
})();
