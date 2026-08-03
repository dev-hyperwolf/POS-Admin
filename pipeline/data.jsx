// ── METRC batch pipeline — deterministic fixtures ─────────────────────────
// Verbatim port of hyperdrive-design prototype/lib/fake-data.ts. The seeded
// mulberry32 PRNG and the exact call order are preserved so every invoice,
// batch and vendor matches the source prototype row for row.
;(function () {
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(424242);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const range = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const floatRange = (min, max) => min + rng() * (max - min);
  const chance = (p) => rng() < p;

  // Fixed "now" for deterministic aging in the prototype.
  const NOW = new Date('2026-04-20T18:30:00-07:00').getTime();
  const daysAgo = (days, hours = 0) => new Date(NOW - days * 86400000 - hours * 3600000).toISOString();

  const VENDORS = [
    { id: 'v-kiva', name: 'Kiva Confections', category: 'Edibles' },
    { id: 'v-stiiizy', name: 'STIIIZY', category: 'Vape' },
    { id: 'v-jeeter', name: 'Jeeter', category: 'Pre-roll' },
    { id: 'v-lowell', name: 'Lowell Farms', category: 'Flower' },
    { id: 'v-raw', name: 'Raw Garden', category: 'Concentrate' },
    { id: 'v-papa', name: 'Papa & Barkley', category: 'Topical' },
    { id: 'v-cann', name: 'Cann', category: 'Beverage' },
    { id: 'v-heavy', name: 'Heavy Hitters', category: 'Vape' },
    { id: 'v-wyld', name: 'Wyld', category: 'Edibles' },
    { id: 'v-connected', name: 'Connected', category: 'Flower' },
    { id: 'v-select', name: 'Select', category: 'Vape' },
    { id: 'v-pax', name: 'Pax Labs', category: 'Hardware' },
    { id: 'v-camino', name: 'Camino', category: 'Edibles' },
    { id: 'v-alien', name: 'Alien Labs', category: 'Flower' },
    { id: 'v-710', name: '710 Labs', category: 'Concentrate' },
  ];

  const PRODUCTS = {
    'v-kiva': ['Kiva Terra Bites Milk Chocolate Espresso 100mg', 'Kiva Camino Gummies Wild Berry 100mg', 'Kiva Dark Chocolate Bar 60mg', 'Kiva Petra Mints Moroccan 100mg'],
    'v-stiiizy': ['STIIIZY Pod Live Resin Blue Dream 0.5g', 'STIIIZY Pod Sour Diesel 1g', 'STIIIZY 40s Gummies Strawberry', 'STIIIZY Liiil Disposable OG Kush'],
    'v-jeeter': ['Jeeter Baby Cannon Churros 1.3g', 'Jeeter XL Blueberry Kush 2g', 'Jeeter Joints Runtz 1g 5-pack', 'Jeeter Infused Horchata 1g'],
    'v-lowell': ['Lowell Reserve Preroll 5-pack Sativa', 'Lowell Quicks Indica 10-pack', 'Lowell Flower Grape Gas 3.5g', 'Lowell 35s Hybrid 3.5g'],
    'v-raw': ['Raw Garden Refined Live Resin 1g Pineapple OG', 'Raw Garden Classic Cart Strawberry Shortcake 0.5g', 'Raw Garden Crushed Diamonds 1g', 'Raw Garden Live Rosin 1g'],
    'v-papa': ['Papa & Barkley Releaf Balm 1.7oz', 'Papa & Barkley CBD:THC 3:1 Tincture', 'Papa & Barkley Releaf Patch 30mg', 'Papa & Barkley Releaf Body Oil 1:3'],
    'v-cann': ['Cann Blood Orange Cardamom 6-pack', 'Cann Grapefruit Rosemary 4-pack', 'Cann Roadies Lemon Lavender', 'Cann Hi Boys Yuzu Elderflower'],
    'v-heavy': ['Heavy Hitters Cartridge OG Kush 1g', 'Heavy Hitters Diamond Cart Pineapple 1g', 'Heavy Hitters Disposable Blueberry 1g', 'Heavy Hitters Pax Pod Granddaddy 0.5g'],
    'v-wyld': ['Wyld Real Fruit Raspberry Sativa 100mg', 'Wyld Pear CBN Gummies', 'Wyld Marionberry Indica 100mg', 'Wyld Huckleberry Hybrid Gummies'],
    'v-connected': ['Connected Biscotti 3.5g', 'Connected Gelonade Preroll 1g', 'Connected The Chem 3.5g', 'Connected Alien Labs Area 41 3.5g'],
    'v-select': ['Select Elite Cart Jack Herer 1g', 'Select Squeeze Pomegranate 100mg', 'Select Fresh Live Rosin 0.5g', 'Select Disposable Live Grape Ape 1g'],
    'v-pax': ['PAX Era Pod Battery Onyx', 'PAX Era Life Charging Cable', 'PAX Mini Device Lunar', 'PAX Era Pro Sage'],
    'v-camino': ['Camino Wild Berry Gummies 100mg', 'Camino Pineapple Habanero Gummies', 'Camino Midnight Blueberry Sleep', 'Camino Sparkling Pear'],
    'v-alien': ['Alien Labs Biskante 3.5g', 'Alien Labs Milk Cake Preroll', 'Alien Labs Area 41 Live Resin 1g', 'Alien Labs Atomic Apple 3.5g'],
    'v-710': ['710 Labs Persy Badder 1g', '710 Labs Water Hash 1g', '710 Labs Persy Rosin 1g', '710 Labs Live Diamonds 1g'],
  };

  const ENTITY_IDS = ['thc', 'ccd', 'ah', 'hwd'];

  function metrcPackage() {
    const chars = '0123456789ABCDEF';
    let s = '1A406030001';
    for (let i = 0; i < 13; i++) s += chars[Math.floor(rng() * 16)];
    return s;
  }

  function genSiblingUids(totalQty, forceHigh = true) {
    const n = chance(0.32) ? (chance(0.5) ? 2 : 3) : 1;
    const uids = [];
    if (n === 1) {
      uids.push({ uid: metrcPackage(), qty: totalQty, confidence: forceHigh ? 0.98 : 0.9, matchReason: 'exact_sku_qty' });
      return uids;
    }
    let remaining = totalQty;
    for (let i = 0; i < n - 1; i++) {
      const min = Math.max(1, Math.floor(totalQty * 0.2));
      const max = Math.floor(totalQty * 0.5);
      const chunk = range(min, max);
      const take = Math.min(remaining - (n - i - 1), Math.max(1, chunk));
      uids.push({ uid: metrcPackage(), qty: take, confidence: forceHigh ? 0.95 : 0.88, matchReason: 'sum_match' });
      remaining -= take;
    }
    uids.push({ uid: metrcPackage(), qty: remaining, confidence: forceHigh ? 0.95 : 0.88, matchReason: 'sum_match' });
    return uids;
  }

  function genLineItems(vendorId, withVariance) {
    const products = PRODUCTS[vendorId] || ['Generic Cannabis Product'];
    const n = range(3, 8);
    const items = [];
    for (let i = 0; i < n; i++) {
      const productName = products[i % products.length];
      const sku = `${vendorId.replace('v-', '').toUpperCase()}-${range(1000, 9999)}`;
      const baseQty = range(24, 144);
      const unitCost = Number(floatRange(4, 48).toFixed(2));
      let invoiceQty = baseQty, manifestQty = baseQty, receiptQty = baseQty;
      let expectedUnitCost = unitCost, variance = 'none', varianceNote;
      if (withVariance && i < 2 && chance(0.7)) {
        const diff = range(1, 6);
        if (chance(0.5)) {
          receiptQty = baseQty - diff;
          variance = diff > 3 ? 'major' : 'minor';
          varianceNote = `Short ${diff} on receipt vs invoice`;
        } else {
          expectedUnitCost = Number((unitCost - floatRange(0.5, 3)).toFixed(2));
          variance = 'minor';
          varianceNote = `Unit cost $${(unitCost - expectedUnitCost).toFixed(2)} above expected`;
        }
        if (chance(0.2)) { variance = 'critical'; varianceNote = `Wrong SKU — expected ${sku.slice(0, -2)}42`; }
      }
      const hasHighConfidence = !withVariance || variance === 'none' || variance === 'minor';
      items.push({ id: `li-${vendorId}-${i}-${range(100, 999)}`, sku, productName, qty: baseQty, unitCost, manifestQty, receiptQty, invoiceQty, expectedUnitCost, variance, varianceNote, metrcUids: genSiblingUids(baseQty, hasHighConfidence) });
    }
    return items;
  }

  function deriveInboxStatus(s) {
    switch (s) {
      case 'auto_posted': return 'autoposted';
      case 'orphan': return 'unmatched';
      case 'review': case 'cfo': case 'corrected_requested': return 'corrected';
      case 'unprocessed': return 'requested';
    }
  }

  function generateInvoices(count) {
    const out = [];
    const statuses = ['auto_posted', 'auto_posted', 'auto_posted', 'auto_posted', 'auto_posted', 'review', 'review', 'review', 'cfo', 'orphan', 'unprocessed', 'corrected_requested'];
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS);
      const status = pick(statuses);
      const entity = pick(ENTITY_IDS);
      const hasVariance = status === 'review' || status === 'cfo' || status === 'corrected_requested';
      const lineItems = genLineItems(vendor.id, hasVariance);
      const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unitCost, 0);
      const tax = Number((subtotal * 0.087).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));
      const varianceAmount = lineItems.reduce((s, li) => {
        if (!li.variance || li.variance === 'none') return s;
        const qtyDiff = (li.invoiceQty || li.qty) - (li.receiptQty || li.qty);
        const costDiff = (li.unitCost - (li.expectedUnitCost || li.unitCost)) * (li.receiptQty || li.qty);
        return s + qtyDiff * li.unitCost + costDiff;
      }, 0);
      const receivedDaysAgo = range(0, 28);
      const invoiceDate = daysAgo(receivedDaysAgo + range(0, 3));
      const received = daysAgo(receivedDaysAgo);
      const invNum = chance(0.4)
        ? `${vendor.id.replace('v-', '').toUpperCase()}-2026${String(range(1, 12)).padStart(2, '0')}${String(range(1, 28)).padStart(2, '0')}-${String(range(1, 99)).padStart(3, '0')}`
        : `INV-${range(10000, 99999)}`;
      const version = hasVariance && chance(0.3) ? range(2, 3) : 1;
      const order = { none: 0, minor: 1, major: 2, critical: 3 };
      const varianceSeverity = lineItems.reduce((max, li) => (order[li.variance || 'none'] > order[max || 'none'] ? li.variance : max), 'none');
      const id = `inv-${String(i).padStart(4, '0')}`;
      const chain = version > 1 ? Array.from({ length: version - 1 }, (_, k) => `${id}-v${k + 1}`) : undefined;
      const unmappedUids = chance(0.15) || i === 0
        ? Array.from({ length: range(1, 2) }, () => {
            const hintedProduct = pick(PRODUCTS[vendor.id] || ['unknown']);
            return {
              uid: metrcPackage(),
              productHint: chance(0.6) ? hintedProduct : undefined,
              qty: range(6, 60),
              reason: pick(['qty mismatch on all candidates', 'SKU not on invoice', 'product name fuzzy score <0.6', 'manifest line has no invoice twin']),
            };
          })
        : undefined;
      const inboxStatus = deriveInboxStatus(status);
      const autoPostedAt = inboxStatus === 'autoposted' ? new Date(new Date(received).getTime() + range(2, 47) * 60000).toISOString() : undefined;
      const correctedBy = inboxStatus === 'corrected' ? pick(['Lena K.', 'Marco R.', 'Priya S.', 'Dante W.', 'Sam B.']) : undefined;
      out.push({
        id, invoiceNumber: invNum, vendorId: vendor.id, vendorName: vendor.name, entity,
        receivedDate: received, invoiceDate, total, subtotal, tax, status, inboxStatus, autoPostedAt, correctedBy,
        version, varianceAmount: Number(varianceAmount.toFixed(2)), varianceSeverity: varianceSeverity || 'none', lineItems,
        metrcManifest: chance(0.85) ? metrcPackage() : undefined,
        confidence: Number(floatRange(0.72, 0.995).toFixed(3)),
        notes: hasVariance ? pick(['Case damage noted at dock. Photos attached.', 'Vendor acknowledged short-ship via email 4/17.', 'Unit cost discrepancy flagged by ingestion.', 'Tax line missing district portion.']) : undefined,
        amendmentChain: chain, unmappedManifestUids: unmappedUids,
      });
    }
    return out.sort((a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime());
  }

  const INVOICES = generateInvoices(28);

  // Smart-batch banner demo data — 4 clean Nabis-distributed invoices so the
  // "N clean invoices from <distributor> ready to approve" prompt fires.
  const SMART_BATCH_DEMO_INVOICES = (() => {
    const out = [];
    const nabisBrand = VENDORS.find((v) => v.id === 'v-kiva');
    const cleanLineSets = [
      [
        { sku: 'KV-5800', productName: 'Kiva Camino Wild Berry Gummies 100mg', qty: 48, unitCost: 27.5 },
        { sku: 'KV-5800-B', productName: 'Kiva Terra Bites Milk Chocolate Espresso 100mg', qty: 36, unitCost: 24.0 },
        { sku: 'WY-1141', productName: 'Wyld Raspberry Sativa Gummies 100mg', qty: 60, unitCost: 22.4 },
        { sku: 'KV-5800-C', productName: 'Kiva Petra Mints Moroccan 100mg', qty: 24, unitCost: 25.5 },
      ],
      [
        { sku: 'KV-5801', productName: 'Kiva Camino Wild Berry Gummies 100mg', qty: 72, unitCost: 27.5 },
        { sku: 'KV-5801-B', productName: 'Kiva Terra Bites Milk Chocolate Espresso 100mg', qty: 48, unitCost: 24.0 },
        { sku: 'STI-2204', productName: 'Stiiizy Pod Sour Diesel 1g', qty: 30, unitCost: 18.0 },
      ],
      [
        { sku: 'KV-5802', productName: 'Kiva Petra Mints Moroccan 100mg', qty: 36, unitCost: 25.5 },
        { sku: 'HH-9911', productName: 'Heavy Hitters OG Kush Cartridge 1g', qty: 60, unitCost: 17.5 },
        { sku: 'HH-9912', productName: 'Heavy Hitters Diamond Pineapple 1g', qty: 48, unitCost: 17.5 },
        { sku: 'WY-1142', productName: 'Wyld Raspberry Sativa Gummies 100mg', qty: 96, unitCost: 22.4 },
      ],
      [
        { sku: 'KV-5803', productName: 'Kiva Camino Wild Berry Gummies 100mg', qty: 60, unitCost: 27.5 },
        { sku: 'JT-3201', productName: 'Jeeter Baby Cannon Churros 1.3g', qty: 48, unitCost: 19.5 },
        { sku: 'JT-3202', productName: 'Jeeter Joints Runtz 5-Pack 1g', qty: 24, unitCost: 28.0 },
      ],
    ];
    for (let i = 0; i < 4; i++) {
      const lines = cleanLineSets[i];
      const subtotal = Number(lines.reduce((s, l) => s + l.qty * l.unitCost, 0).toFixed(2));
      const tax = Number((subtotal * 0.085).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));
      const receivedHoursAgo = 6 + i * 9;
      const received = new Date(NOW - receivedHoursAgo * 3600000).toISOString();
      const invoiceDate = new Date(NOW - (receivedHoursAgo + 4) * 3600000).toISOString().split('T')[0];
      const autoPostedAt = new Date(new Date(received).getTime() + 4 * 60000).toISOString();
      out.push({
        id: `inv-smart-${i}`, invoiceNumber: `NAB-2026-${1100 + i}`, vendorId: nabisBrand.id, vendorName: 'Nabis Distribution',
        entity: 'thc', receivedDate: received, invoiceDate, total, subtotal, tax, status: 'auto_posted', inboxStatus: 'autoposted',
        autoPostedAt, version: 1, varianceAmount: 0, varianceSeverity: 'none',
        lineItems: lines.map((l, k) => ({ id: `inv-smart-${i}-l${k + 1}`, sku: l.sku, productName: l.productName, qty: l.qty, unitCost: l.unitCost })),
        metrcManifest: metrcPackage(), confidence: Number((0.955 + i * 0.008).toFixed(3)), unmappedManifestUids: [],
      });
    }
    return out;
  })();

  // Mixed-confidence demo invoice — a STIIIZY shipment with one line the
  // matcher can't pin down.
  const MIXED_CONFIDENCE_DEMO_INVOICE = (() => {
    const lines = [
      { sku: 'STZ-7701', productName: 'Stiiizy Pod Blue Dream Live Resin 0.5g', qty: 60, unitCost: 19.5 },
      { sku: 'STZ-7702', productName: 'Stiiizy Pod Sour Diesel 1g', qty: 48, unitCost: 24.0 },
      { sku: 'STZ-7703', productName: 'STIIIZY 40s Strawberry Cough 5-pack', qty: 36, unitCost: 32.0 },
      { sku: 'STZ-7704', productName: 'Stiiizy Pod Sour Diesel 1g', qty: 24, unitCost: 24.0 },
    ];
    const subtotal = Number(lines.reduce((s, l) => s + l.qty * l.unitCost, 0).toFixed(2));
    const tax = Number((subtotal * 0.085).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    const receivedHoursAgo = 14;
    const received = new Date(NOW - receivedHoursAgo * 3600000).toISOString();
    const invoiceDate = new Date(NOW - (receivedHoursAgo + 5) * 3600000).toISOString().split('T')[0];
    return {
      id: 'inv-mix-demo', invoiceNumber: 'STZ-2026-4421', vendorId: 'v-stiiizy', vendorName: 'STIIIZY', entity: 'thc',
      receivedDate: received, invoiceDate, total, subtotal, tax, status: 'review', inboxStatus: 'corrected', version: 1,
      varianceAmount: 0, varianceSeverity: 'none',
      lineItems: lines.map((l, k) => ({ id: `inv-mix-demo-l${k + 1}`, sku: l.sku, productName: l.productName, qty: l.qty, unitCost: l.unitCost })),
      metrcManifest: metrcPackage(), confidence: 0.78, unmappedManifestUids: [],
    };
  })();

  INVOICES.push(...SMART_BATCH_DEMO_INVOICES, MIXED_CONFIDENCE_DEMO_INVOICE);
  INVOICES.sort((a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime());

  function generateBatches(count) {
    const out = [];
    const distribution = [
      { status: 'incoming', weight: 8 }, { status: 'received', weight: 12 }, { status: 'labeling', weight: 6 },
      { status: 'sealing', weight: 4 }, { status: 'shelf_ready', weight: 11 }, { status: 'merchandised', weight: 5 },
      { status: 'approved', weight: 10 }, { status: 'quarantined', weight: 3 }, { status: 'recalled', weight: 2 },
      { status: 'destroyed', weight: 2 },
    ];
    const pool = [];
    distribution.forEach((d) => { for (let i = 0; i < d.weight; i++) pool.push(d.status); });
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS);
      const products = PRODUCTS[vendor.id] || ['Generic'];
      const productName = pick(products);
      const entity = pick(ENTITY_IDS);
      let status = pool[i % pool.length];
      if (status === 'sealing' && entity !== 'thc') status = 'labeling';
      if (status === 'merchandised' && entity !== 'ccd' && entity !== 'ah') status = 'shelf_ready';
      const qty = range(24, 288);
      const unitValue = Number(floatRange(8, 65).toFixed(2));
      const hoursOld = range(1, 96);
      const statusEnteredAt = new Date(NOW - hoursOld * 3600000).toISOString();
      const timeline = [
        { id: `t-${i}-1`, at: new Date(NOW - (hoursOld + range(4, 48)) * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' },
        { id: `t-${i}-2`, at: new Date(NOW - (hoursOld + range(2, 24)) * 3600000).toISOString(), actor: 'Marco R.', event: 'Scanned at dock', status: 'received' },
      ];
      if (status !== 'incoming' && status !== 'received') {
        timeline.push({ id: `t-${i}-3`, at: statusEnteredAt, actor: pick(['Lena K.', 'Marco R.', 'Priya S.', 'Dante W.']), event: `Moved to ${status.replace('_', ' ')}`, status });
      }
      const batchDate = daysAgo(range(30, 90));
      const packageDate = daysAgo(range(20, 80));
      const expirationDate = new Date(NOW + range(-10, 320) * 86400000).toISOString();
      const location = chance(0.65) ? 'foh' : 'boh';
      const testLab = pick(['Anresco Labs', 'CC Testing Labs', 'SC Labs', 'Steep Hill']);
      const coaId = `COA-2026-${range(1000, 9999)}`;
      out.push({
        id: `b-${String(i).padStart(4, '0')}`,
        metrcPackageId: metrcPackage(),
        sku: `${vendor.id.replace('v-', '').toUpperCase()}-${range(1000, 9999)}`,
        productName, brand: vendor.name, category: vendor.category, qty, unitValue, status, statusEnteredAt, entity,
        entityPipelineConfigVersion: 1, masterProductId: `mp-${vendor.id.replace('v-', '')}`, vendorName: vendor.name,
        notes: chance(0.2) ? pick(['COA pending — attached stub.', 'RFID tag missing on 4 units.', 'Light case damage; dented corner.', 'Customer-return carton.']) : undefined,
        batchDate, packageDate, expirationDate, location, testLab, coaId, timeline,
        evidence: [
          { id: `ev-${i}-1`, label: 'Manifest scan', capturedAt: timeline[0].at, uploader: 'Intake Bot', kind: 'manifest' },
          { id: `ev-${i}-2`, label: 'Dock photo', capturedAt: timeline[1].at, uploader: 'Marco R.', kind: 'photo' },
        ],
      });
    }
    return out;
  }

  const BATCHES = generateBatches(52);

  // Three THC batches at the shrink-tube station so Sealing has visible load.
  const THC_SEALING_BATCHES = [
    {
      id: 'b-thc-seal-001', metrcPackageId: '1A4060100000000000000123', sku: 'STIIIZY-8821',
      productName: 'STIIIZY Pod Live Resin Blue Dream 0.5g', brand: 'STIIIZY', category: 'Vape', qty: 144, unitValue: 42.5,
      status: 'sealing', statusEnteredAt: new Date(NOW - 45 * 60000).toISOString(), entity: 'thc',
      entityPipelineConfigVersion: 1, masterProductId: 'mp-cartridges', vendorName: 'STIIIZY',
      notes: 'Double-seal required — premium vape tamper evidence.',
      timeline: [
        { id: 't-thc-seal-001-1', at: new Date(NOW - 6 * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' },
        { id: 't-thc-seal-001-2', at: new Date(NOW - 5 * 3600000).toISOString(), actor: 'Marco R.', event: 'Scanned at dock', status: 'received' },
        { id: 't-thc-seal-001-3', at: new Date(NOW - 2 * 3600000).toISOString(), actor: 'Lena K.', event: 'Labels applied', status: 'labeling' },
        { id: 't-thc-seal-001-4', at: new Date(NOW - 45 * 60000).toISOString(), actor: 'Dante W.', event: 'Moved to Sealing', status: 'sealing' },
      ],
      evidence: [
        { id: 'ev-thc-seal-001-1', label: 'Manifest scan', capturedAt: new Date(NOW - 6 * 3600000).toISOString(), uploader: 'Intake Bot', kind: 'manifest' },
        { id: 'ev-thc-seal-001-2', label: 'Dock photo', capturedAt: new Date(NOW - 5 * 3600000).toISOString(), uploader: 'Marco R.', kind: 'photo' },
      ],
    },
    {
      id: 'b-thc-seal-002', metrcPackageId: '1A4060100000000000000124', sku: 'HEAVY-4432',
      productName: 'Heavy Hitters Live Resin Cart — Sour Diesel 1g', brand: 'Heavy Hitters', category: 'Vape', qty: 72, unitValue: 51.0,
      status: 'sealing', statusEnteredAt: new Date(NOW - 18 * 60000).toISOString(), entity: 'thc',
      entityPipelineConfigVersion: 1, masterProductId: 'mp-cartridges', vendorName: 'Heavy Hitters',
      timeline: [
        { id: 't-thc-seal-002-1', at: new Date(NOW - 4 * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' },
        { id: 't-thc-seal-002-2', at: new Date(NOW - 3.5 * 3600000).toISOString(), actor: 'Marco R.', event: 'Scanned at dock', status: 'received' },
        { id: 't-thc-seal-002-3', at: new Date(NOW - 1 * 3600000).toISOString(), actor: 'Priya S.', event: 'Labels applied', status: 'labeling' },
        { id: 't-thc-seal-002-4', at: new Date(NOW - 18 * 60000).toISOString(), actor: 'Dante W.', event: 'Moved to Sealing', status: 'sealing' },
      ],
      evidence: [
        { id: 'ev-thc-seal-002-1', label: 'Manifest scan', capturedAt: new Date(NOW - 4 * 3600000).toISOString(), uploader: 'Intake Bot', kind: 'manifest' },
        { id: 'ev-thc-seal-002-2', label: 'Dock photo', capturedAt: new Date(NOW - 3.5 * 3600000).toISOString(), uploader: 'Marco R.', kind: 'photo' },
      ],
    },
    {
      id: 'b-thc-seal-003', metrcPackageId: '1A4060100000000000000125', sku: 'RAW-7710',
      productName: 'Raw Garden Refined Live Resin 1g — Pineapple OG', brand: 'Raw Garden', category: 'Concentrate', qty: 96, unitValue: 34.0,
      status: 'sealing', statusEnteredAt: new Date(NOW - 5 * 60000).toISOString(), entity: 'thc',
      entityPipelineConfigVersion: 1, masterProductId: 'mp-raw', vendorName: 'Raw Garden',
      notes: 'Shrink-tube station camera evidence required.',
      timeline: [
        { id: 't-thc-seal-003-1', at: new Date(NOW - 3 * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' },
        { id: 't-thc-seal-003-2', at: new Date(NOW - 2.5 * 3600000).toISOString(), actor: 'Marco R.', event: 'Scanned at dock', status: 'received' },
        { id: 't-thc-seal-003-3', at: new Date(NOW - 30 * 60000).toISOString(), actor: 'Priya S.', event: 'Labels applied', status: 'labeling' },
        { id: 't-thc-seal-003-4', at: new Date(NOW - 5 * 60000).toISOString(), actor: 'Dante W.', event: 'Moved to Sealing', status: 'sealing' },
      ],
      evidence: [
        { id: 'ev-thc-seal-003-1', label: 'Manifest scan', capturedAt: new Date(NOW - 3 * 3600000).toISOString(), uploader: 'Intake Bot', kind: 'manifest' },
        { id: 'ev-thc-seal-003-2', label: 'Dock photo', capturedAt: new Date(NOW - 2.5 * 3600000).toISOString(), uploader: 'Marco R.', kind: 'photo' },
      ],
    },
  ];
  BATCHES.push(...THC_SEALING_BATCHES);

  // THC batches in Labeling that auto-skip Sealing (tamper-evident masters).
  const THC_SKIP_SEAL_BATCHES = [
    {
      id: 'b-thc-skip-001', metrcPackageId: '1A4060100000000000000221', sku: 'KIVA-9030',
      productName: 'Kiva Camino Gummies Wild Berry 100mg', brand: 'Kiva Confections', category: 'Edibles', qty: 120, unitValue: 14.5,
      status: 'labeling', statusEnteredAt: new Date(NOW - 22 * 60000).toISOString(), entity: 'thc',
      entityPipelineConfigVersion: 1, masterProductId: 'mp-kiva', vendorName: 'Kiva Confections',
      notes: 'Wrapped carton — tamper evidence built in, skipping shrink tube.',
      timeline: [
        { id: 't-thc-skip-001-1', at: new Date(NOW - 5 * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' },
        { id: 't-thc-skip-001-2', at: new Date(NOW - 4 * 3600000).toISOString(), actor: 'Marco R.', event: 'Scanned at dock', status: 'received' },
        { id: 't-thc-skip-001-3', at: new Date(NOW - 22 * 60000).toISOString(), actor: 'Lena K.', event: 'Labels applied', status: 'labeling' },
      ],
      evidence: [
        { id: 'ev-thc-skip-001-1', label: 'Manifest scan', capturedAt: new Date(NOW - 5 * 3600000).toISOString(), uploader: 'Intake Bot', kind: 'manifest' },
        { id: 'ev-thc-skip-001-2', label: 'Dock photo', capturedAt: new Date(NOW - 4 * 3600000).toISOString(), uploader: 'Marco R.', kind: 'photo' },
      ],
    },
    {
      id: 'b-thc-skip-002', metrcPackageId: '1A4060100000000000000222', sku: 'ALIEN-7703',
      productName: 'Alien Labs Biskante 3.5g', brand: 'Alien Labs', category: 'Flower', qty: 60, unitValue: 42.0,
      status: 'labeling', statusEnteredAt: new Date(NOW - 12 * 60000).toISOString(), entity: 'thc',
      entityPipelineConfigVersion: 1, masterProductId: 'mp-alien', vendorName: 'Alien Labs',
      notes: 'Pre-sealed mylar — skip sealing.',
      timeline: [
        { id: 't-thc-skip-002-1', at: new Date(NOW - 4 * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' },
        { id: 't-thc-skip-002-2', at: new Date(NOW - 3 * 3600000).toISOString(), actor: 'Marco R.', event: 'Scanned at dock', status: 'received' },
        { id: 't-thc-skip-002-3', at: new Date(NOW - 12 * 60000).toISOString(), actor: 'Priya S.', event: 'Labels applied', status: 'labeling' },
      ],
      evidence: [
        { id: 'ev-thc-skip-002-1', label: 'Manifest scan', capturedAt: new Date(NOW - 4 * 3600000).toISOString(), uploader: 'Intake Bot', kind: 'manifest' },
        { id: 'ev-thc-skip-002-2', label: 'Dock photo', capturedAt: new Date(NOW - 3 * 3600000).toISOString(), uploader: 'Marco R.', kind: 'photo' },
      ],
    },
  ];
  BATCHES.push(...THC_SKIP_SEAL_BATCHES);

  // Recall lineage demo — parent split into 3 children, one grandchild.
  const RECALL_PARENT_UID = '1A4060100000000001PARENT';
  const RECALL_CHILD_A = '1A40601000000000001CHILDA';
  const RECALL_CHILD_B = '1A40601000000000001CHILDB';
  const RECALL_CHILD_C = '1A40601000000000001CHILDC';
  const RECALL_GRAND_A = '1A40601000000000001GRANDA';

  const LINEAGE_BATCHES = [
    {
      id: 'b-lineage-parent', metrcPackageId: RECALL_PARENT_UID, sku: 'LOWELL-2045',
      productName: 'Lowell Reserve Preroll 5-pack Sativa', brand: 'Lowell Farms', category: 'Pre-roll', qty: 0, unitValue: 42.5,
      status: 'recalled', statusEnteredAt: daysAgo(1, 2), entity: 'thc', vendorName: 'Lowell Farms',
      notes: 'CDPH recall 2026-047 — mycotoxin above action limit.',
      batchDate: daysAgo(45), testLab: 'Anresco Labs', coaId: 'COA-2026-9821',
      childMetrcPackageIds: [RECALL_CHILD_A, RECALL_CHILD_B, RECALL_CHILD_C],
      timeline: [
        { id: 't-lineage-p-1', at: daysAgo(14), actor: 'Intake Bot', event: 'Received from Lowell', status: 'received' },
        { id: 't-lineage-p-2', at: daysAgo(10), actor: 'Priya S.', event: 'Split into 3 child packages', status: 'received' },
        { id: 't-lineage-p-3', at: daysAgo(1, 2), actor: 'Compliance Officer', event: 'Recalled — CDPH 2026-047', status: 'recalled' },
      ],
      evidence: [{ id: 'ev-lineage-p-1', label: 'Recall notice PDF', capturedAt: daysAgo(1, 2), uploader: 'Compliance Officer', kind: 'document' }],
    },
    {
      id: 'b-lineage-childA', metrcPackageId: RECALL_CHILD_A, sku: 'LOWELL-2045',
      productName: 'Lowell Reserve Preroll 5-pack Sativa', brand: 'Lowell Farms', category: 'Pre-roll', qty: 200, unitValue: 42.5,
      status: 'quarantined', statusEnteredAt: daysAgo(1, 1), entity: 'thc', vendorName: 'Lowell Farms',
      notes: 'Pulled from shelf-ready floor during recall sweep.',
      batchDate: daysAgo(45), testLab: 'Anresco Labs', coaId: 'COA-2026-9821', parentMetrcPackageId: RECALL_PARENT_UID,
      timeline: [
        { id: 't-lineage-ca-1', at: daysAgo(10), actor: 'Priya S.', event: 'Created from split', status: 'received' },
        { id: 't-lineage-ca-2', at: daysAgo(1, 1), actor: 'Compliance Officer', event: 'Quarantined (parent recalled)', status: 'quarantined' },
      ],
      evidence: [],
    },
    {
      id: 'b-lineage-childB', metrcPackageId: RECALL_CHILD_B, sku: 'LOWELL-2045',
      productName: 'Lowell Reserve Preroll 5-pack Sativa', brand: 'Lowell Farms', category: 'Pre-roll', qty: 200, unitValue: 42.5,
      status: 'quarantined', statusEnteredAt: daysAgo(1, 1), entity: 'thc', vendorName: 'Lowell Farms',
      notes: 'Pulled from delivery van load before dispatch.',
      batchDate: daysAgo(45), testLab: 'Anresco Labs', coaId: 'COA-2026-9821', parentMetrcPackageId: RECALL_PARENT_UID,
      timeline: [
        { id: 't-lineage-cb-1', at: daysAgo(10), actor: 'Priya S.', event: 'Created from split', status: 'received' },
        { id: 't-lineage-cb-2', at: daysAgo(1, 1), actor: 'Compliance Officer', event: 'Quarantined (parent recalled)', status: 'quarantined' },
      ],
      evidence: [],
    },
    {
      id: 'b-lineage-childC', metrcPackageId: RECALL_CHILD_C, sku: 'LOWELL-2045',
      productName: 'Lowell Reserve Preroll 5-pack Sativa', brand: 'Lowell Farms', category: 'Pre-roll', qty: 40, unitValue: 42.5,
      status: 'quarantined', statusEnteredAt: daysAgo(1, 1), entity: 'thc', vendorName: 'Lowell Farms',
      batchDate: daysAgo(45), testLab: 'Anresco Labs', coaId: 'COA-2026-9821',
      parentMetrcPackageId: RECALL_PARENT_UID, childMetrcPackageIds: [RECALL_GRAND_A],
      timeline: [
        { id: 't-lineage-cc-1', at: daysAgo(10), actor: 'Priya S.', event: 'Created from split', status: 'received' },
        { id: 't-lineage-cc-2', at: daysAgo(5), actor: 'Dante W.', event: 'Further split — grandchild A created', status: 'received' },
        { id: 't-lineage-cc-3', at: daysAgo(1, 1), actor: 'Compliance Officer', event: 'Quarantined (parent recalled)', status: 'quarantined' },
      ],
      evidence: [],
    },
    {
      id: 'b-lineage-grandA', metrcPackageId: RECALL_GRAND_A, sku: 'LOWELL-2045',
      productName: 'Lowell Reserve Preroll 5-pack Sativa', brand: 'Lowell Farms', category: 'Pre-roll', qty: 60, unitValue: 42.5,
      status: 'quarantined', statusEnteredAt: daysAgo(1, 1), entity: 'ccd', vendorName: 'Lowell Farms',
      notes: 'Transferred to Circle City retail; pulled from shelf.',
      batchDate: daysAgo(45), testLab: 'Anresco Labs', coaId: 'COA-2026-9821', parentMetrcPackageId: RECALL_CHILD_C,
      timeline: [
        { id: 't-lineage-g-1', at: daysAgo(5), actor: 'Dante W.', event: 'Created from split of child C', status: 'received' },
        { id: 't-lineage-g-2', at: daysAgo(1, 1), actor: 'Compliance Officer', event: 'Quarantined (ancestor recalled)', status: 'quarantined' },
      ],
      evidence: [],
    },
  ];
  BATCHES.push(...LINEAGE_BATCHES);

  // 20 deterministic incoming batches spanning every vendor + entity so the
  // search and filter bar have realistic material.
  const TEST_INCOMING_BATCHES = (() => {
    const out = [];
    for (let i = 0; i < 20; i++) {
      const vendor = VENDORS[i % VENDORS.length];
      const products = PRODUCTS[vendor.id] || ['Generic'];
      const productName = products[i % products.length];
      const entity = ENTITY_IDS[i % ENTITY_IDS.length];
      const hoursOld = 1 + ((i * 7) % 72);
      const statusEnteredAt = new Date(NOW - hoursOld * 3600000).toISOString();
      const qty = 24 + ((i * 13) % 240);
      const unitValue = Number((9 + ((i * 3.1) % 56)).toFixed(2));
      const batchDate = daysAgo(30 + ((i * 5) % 60));
      const labs = ['Anresco Labs', 'CC Testing Labs', 'SC Labs', 'Steep Hill'];
      const testLab = labs[i % labs.length];
      const coaId = `COA-2026-${4000 + i}`;
      const sku = `${vendor.id.replace('v-', '').toUpperCase()}-${5000 + i}`;
      const noteOptions = [
        'Manifest matched on first pass — clean intake.',
        'COA expected by EOD; flagged for compliance follow-up.',
        'Dock photo missing — capture before scanning.',
        'Vendor flagged this batch as priority delivery.',
      ];
      const notes = i % 4 === 0 ? noteOptions[(i / 4) % noteOptions.length] : undefined;
      out.push({
        id: `b-incoming-${String(i).padStart(2, '0')}`, metrcPackageId: metrcPackage(), sku, productName,
        brand: vendor.name, category: vendor.category, qty, unitValue, status: 'incoming', statusEnteredAt, entity,
        entityPipelineConfigVersion: 1, masterProductId: `mp-${vendor.id.replace('v-', '')}`, vendorName: vendor.name,
        notes, batchDate, testLab, coaId,
        timeline: [{ id: `t-incoming-${i}-1`, at: new Date(NOW - (hoursOld + 4 + ((i * 2) % 12)) * 3600000).toISOString(), actor: 'Intake Bot', event: 'Manifest received from METRC', status: 'incoming' }],
        evidence: [{ id: `ev-incoming-${i}-1`, label: 'Manifest scan', capturedAt: statusEnteredAt, uploader: 'Intake Bot', kind: 'manifest' }],
      });
    }
    return out;
  })();
  BATCHES.push(...TEST_INCOMING_BATCHES);

  // ── Inbox metrics ───────────────────────────────────────────────────────
  function inboxSummary() {
    const total = INVOICES.length;
    const autoposted = INVOICES.filter((i) => i.inboxStatus === 'autoposted').length;
    const review = INVOICES.filter((i) => i.status === 'review').length;
    const cfo = INVOICES.filter((i) => i.status === 'cfo').length;
    const unmatched = INVOICES.filter((i) => i.inboxStatus === 'unmatched').length;
    return { total, autoPostRate: total ? autoposted / total : 0, pendingReview: review, cfoEscalations: cfo, unmatched, hoursSaved: 46 };
  }

  const WINDOW_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

  // Share of invoices auto-posted inside the window, plus a per-bucket
  // series and the delta against the prior equivalent period.
  function autoPostRate(windowKey) {
    const days = WINDOW_DAYS[windowKey] ?? 30;
    const inWindow = (from, to) => INVOICES.filter((i) => {
      const age = (NOW - new Date(i.receivedDate).getTime()) / 86400000;
      return age >= from && age < to;
    });
    const rateOf = (list) => (list.length ? list.filter((i) => i.inboxStatus === 'autoposted').length / list.length : 0);
    const current = inWindow(0, days);
    const prior = inWindow(days, days * 2);
    const buckets = 8;
    const series = [];
    for (let b = buckets - 1; b >= 0; b--) {
      const from = (days / buckets) * b;
      const slice = inWindow(from, from + days / buckets);
      series.push(Number((slice.length ? rateOf(slice) : rateOf(current)).toFixed(3)));
    }
    const rate = rateOf(current);
    return { window: windowKey, rate, delta: rate - rateOf(prior), series, sampleSize: current.length };
  }

  window.HD_RNG = { rng, pick, range, floatRange, chance, daysAgo, NOW };
  window.HD_DATA = { NOW, VENDORS, PRODUCTS, INVOICES, BATCHES, daysAgo, metrcPackage, inboxSummary, autoPostRate };
})();
