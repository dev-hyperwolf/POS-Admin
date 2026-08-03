// ── Ops fixtures — AP · credits · promo commitments · compliance ──────────
// Verbatim port of prototype/lib/fake-ops-data.ts (own seed, 808080).
;(function () {
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(808080);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const range = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const floatRange = (min, max) => min + rng() * (max - min);
  const chance = (p) => rng() < p;
  const NOW = window.HD_DATA.NOW;
  const daysAgo = (days, hours = 0) => new Date(NOW - days * 86400000 - hours * 3600000).toISOString();
  const daysFromNow = (days) => new Date(NOW + days * 86400000).toISOString();

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
    { id: 'v-camino', name: 'Camino', category: 'Edibles' },
    { id: 'v-alien', name: 'Alien Labs', category: 'Flower' },
    { id: 'v-710', name: '710 Labs', category: 'Concentrate' },
  ];
  const ENTITY_IDS = ['thc', 'ccd', 'ah', 'hwd'];
  const ENTITY_NAMES = { thc: 'The Highest Craft', ccd: 'Circle City', ah: 'Alternate Health', hwd: 'Hyperwolf Delivery' };

  // ── Accounts payable ────────────────────────────────────────────────────
  function genAPLineItems(vendorName) {
    const n = range(3, 7);
    const items = [];
    for (let i = 0; i < n; i++) {
      const qty = range(12, 96);
      const unitCost = Number(floatRange(6, 52).toFixed(2));
      items.push({ id: `apli-${vendorName}-${i}-${range(100, 999)}`, sku: `${vendorName.slice(0, 3).toUpperCase()}-${range(1000, 9999)}`, productName: `${vendorName} line ${i + 1}`, qty, unitCost, total: Number((qty * unitCost).toFixed(2)) });
    }
    return items;
  }
  function apMetrcPackage() {
    const chars = '0123456789ABCDEF';
    let s = '1A406030001';
    for (let i = 0; i < 13; i++) s += chars[Math.floor(rng() * 16)];
    return s;
  }
  function generateAPInvoices(count) {
    const out = [];
    const agingBuckets = [
      { min: -14, max: 0, weight: 4 }, { min: 1, max: 30, weight: 10 }, { min: 31, max: 60, weight: 5 },
      { min: 61, max: 90, weight: 3 }, { min: 91, max: 140, weight: 2 },
    ];
    const pool = [];
    agingBuckets.forEach((b) => { for (let i = 0; i < b.weight; i++) pool.push({ min: b.min, max: b.max }); });
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS);
      const entity = pick(ENTITY_IDS);
      const bucket = pool[i % pool.length];
      const daysOverdue = range(bucket.min, bucket.max);
      const isPaid = chance(0.22);
      const dueDate = isPaid ? daysAgo(range(10, 60)) : daysAgo(daysOverdue);
      const issuedDate = daysAgo(Math.abs(daysOverdue) + range(20, 40), range(0, 12));
      const lineItems = genAPLineItems(vendor.name);
      const gross = lineItems.reduce((s, li) => s + li.total, 0);
      const tax = Number((gross * 0.087).toFixed(2));
      const amount = Number((gross + tax).toFixed(2));
      const variance = chance(0.25) ? Number((floatRange(-350, 650) * (chance(0.4) ? -1 : 1)).toFixed(2)) : 0;
      let status;
      if (isPaid) status = 'paid';
      else if (Math.abs(variance) > 500) status = 'cfo';
      else if (variance !== 0) status = 'review';
      else if (daysOverdue > 0) status = 'overdue';
      else status = 'due_this_week';
      const paidAmount = isPaid ? amount : 0;
      const payments = isPaid ? [{ id: `pay-${i}-1`, at: daysAgo(range(1, 20)), method: pick(['ach', 'check', 'wire', 'credit_applied']), amount }] : [];
      out.push({
        id: `ap-${String(i).padStart(4, '0')}`,
        invoiceNumber: chance(0.5)
          ? `${vendor.id.replace('v-', '').toUpperCase()}-2026${String(range(1, 12)).padStart(2, '0')}${String(range(1, 28)).padStart(2, '0')}-${String(range(1, 99)).padStart(3, '0')}`
          : `INV-${range(10000, 99999)}`,
        vendorId: vendor.id, vendorName: vendor.name, vendorCategory: vendor.category, entity, issuedDate, dueDate,
        paidDate: isPaid ? payments[0].at : undefined, amount, paidAmount, variance, status,
        manifestId: chance(0.85) ? apMetrcPackage() : undefined,
        notes: chance(0.25) ? pick(['Short ship acknowledged via email 4/15.', 'Awaiting updated invoice with correct tax district.', 'Held pending COA for batch matching.', 'Vendor requested net-45 extension; pending CFO.']) : undefined,
        lineItems, payments,
        creditsAvailable: chance(0.35) ? Number(floatRange(75, 1250).toFixed(2)) : 0,
      });
    }
    return out.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }
  const AP_INVOICES = generateAPInvoices(42);

  function apSummary() {
    const open = AP_INVOICES.filter((i) => i.status !== 'paid');
    const outstanding = open.reduce((s, i) => s + i.amount, 0);
    const bucket = (minDays, maxDays) => open.filter((i) => {
      const d = (NOW - new Date(i.dueDate).getTime()) / 86400000;
      return d >= minDays && d < maxDays;
    }).reduce((s, i) => s + i.amount, 0);
    return { outstanding, aged30: bucket(1, 31), aged60: bucket(31, 61), aged90: bucket(61, Infinity), creditsAvailable: AP_INVOICES.reduce((s, i) => s + i.creditsAvailable, 0) };
  }

  // ── Credit memos ────────────────────────────────────────────────────────
  function generateCredits(count) {
    const out = [];
    const sources = ['damage', 'damage', 'promo', 'promo', 'pricing', 'pricing', 'return', 'short_ship', 'short_ship', 'admin_manual'];
    const statuses = ['draft', 'pending', 'pending', 'approved', 'approved', 'applied', 'applied', 'applied', 'disputed'];
    const reasons = {
      damage: ['3 cases arrived with crushed corners; photos attached.', 'Pallet strapping failed, 8 units unsalvageable.', 'Freezer vape pod seals compromised on receipt.'],
      promo: ['BOGO lift not honored on 4/17 Raw Garden drop.', 'Vendor co-op dollars still owed for Q1.', 'Promo spiff missing on STIIIZY Liiil run.'],
      pricing: ['Unit cost $2.40 above expected on sku ST-4412.', 'Case pack price above negotiated tier.', 'Duplicate tax line billed twice.'],
      return: ['Customer-return: faulty cart batch (CA recall tier-2).', 'Expired edible stock pulled from shelf.', 'Unsalable COA-mismatch batch returned.'],
      short_ship: ['Received 22 units on manifest of 24.', 'Short 1 case on Lowell Quicks delivery.', 'Driver signoff showed 144 / invoice billed 150.'],
      admin_manual: ['Goodwill credit per vendor call 4/12.', 'Manual adjustment for damaged signage.', 'Reconciliation true-up from Q1 audit.'],
    };
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS);
      const source = sources[i % sources.length];
      const status = pick(statuses);
      const entity = pick(ENTITY_IDS);
      const amount = Number(floatRange(85, 3200).toFixed(2));
      const createdAt = daysAgo(range(1, 55), range(0, 23));
      const evidence = [];
      if (source === 'damage' || source === 'short_ship') evidence.push({ id: `cev-${i}-1`, label: 'Dock photo', kind: 'photo', capturedAt: createdAt, capturedBy: 'Marco R.' });
      evidence.push({ id: `cev-${i}-2`, label: source === 'promo' ? 'Vendor email' : 'Source doc', kind: source === 'promo' ? 'email' : 'document', capturedAt: createdAt, capturedBy: 'Ingestion Bot' });
      if (source === 'short_ship' || source === 'return') evidence.push({ id: `cev-${i}-3`, label: 'Manifest', kind: 'manifest', capturedAt: createdAt, capturedBy: 'METRC sync' });
      const audit = [{ id: `caud-${i}-1`, at: createdAt, actor: pick(['Ingestion Bot', 'Marco R.', 'Lena K.']), action: 'Credit memo drafted' }];
      if (status !== 'draft') audit.push({ id: `caud-${i}-2`, at: new Date(new Date(createdAt).getTime() + range(1, 24) * 3600000).toISOString(), actor: 'Priya S.', action: 'Submitted for approval' });
      if (status === 'approved' || status === 'applied') audit.push({ id: `caud-${i}-3`, at: new Date(new Date(createdAt).getTime() + range(24, 72) * 3600000).toISOString(), actor: 'Manisha Patel', action: 'Approved' });
      if (status === 'applied') audit.push({ id: `caud-${i}-4`, at: new Date(new Date(createdAt).getTime() + range(72, 160) * 3600000).toISOString(), actor: 'AP Bot', action: 'Applied to invoice' });
      if (status === 'disputed') audit.push({ id: `caud-${i}-5`, at: new Date(new Date(createdAt).getTime() + range(24, 96) * 3600000).toISOString(), actor: 'Vendor portal', action: 'Vendor disputed amount' });
      out.push({
        id: `cm-${String(i).padStart(4, '0')}`,
        memoNumber: `CM-2026${String(range(1, 12)).padStart(2, '0')}-${String(range(1, 999)).padStart(4, '0')}`,
        vendorId: vendor.id, vendorName: vendor.name, source, status, amount, createdAt,
        linkedInvoiceId: chance(0.7) ? `ap-${String(range(0, 41)).padStart(4, '0')}` : undefined,
        linkedInvoiceNumber: chance(0.7) ? `INV-${range(10000, 99999)}` : undefined,
        linkedManifestId: chance(0.5) ? apMetrcPackage() : undefined,
        reason: pick(reasons[source]), entity, evidence, audit,
      });
    }
    return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  const CREDIT_MEMOS = generateCredits(28);

  function creditsSummary() {
    const outstanding = CREDIT_MEMOS.filter((c) => c.status === 'approved' || c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const appliedThisMonth = CREDIT_MEMOS.filter((c) => c.status === 'applied' && (NOW - new Date(c.createdAt).getTime()) / 86400000 <= 30).reduce((s, c) => s + c.amount, 0);
    const pendingApproval = CREDIT_MEMOS.filter((c) => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const disputed = CREDIT_MEMOS.filter((c) => c.status === 'disputed').reduce((s, c) => s + c.amount, 0);
    return { outstanding, appliedThisMonth, pendingApproval, disputed };
  }

  // ── Buyer ops: promo commitments ────────────────────────────────────────
  function generatePromoCommitments(count) {
    const out = [];
    const types = ['discount_dollars', 'discount_percent', 'volume_rebate', 'bogo', 'co_op', 'spiff'];
    const termsByType = {
      discount_dollars: ['$3 off unit cost on vape carts through 5/15', '$2 off all 3.5g flower — Q2 push', '$5 off Liiil disposable bundles'],
      discount_percent: ['15% off edibles case pack Q2', '10% rebate on new-sku introductions', '12% off preroll multi-packs'],
      volume_rebate: ['5% kicker when quarterly units > 8k', 'Tiered rebate: 3% at $25k, 5% at $50k', 'Retroactive 2% on Q1 reorder volume'],
      bogo: ['Buy-10 get-1 case on gummies', 'BOGO free on legacy SKUs closeout', 'Buy-6-cases-get-1 on signature cart line'],
      co_op: ['$3k co-op fund for in-store signage', '$1.5k sampling budget — quarterly', '$2k shelf placement contribution'],
      spiff: ['$25 per unit sold bonus to budtenders', '$15 SPIF on 2g infused prerolls', '$40 new-customer referral bonus'],
    };
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS);
      const type = types[i % types.length];
      const startDate = daysAgo(range(20, 90));
      const endDate = daysFromNow(range(-10, 90));
      const status = chance(0.75) ? 'active' : chance(0.5) ? 'expired' : 'paused';
      out.push({
        id: `pc-${String(i).padStart(4, '0')}`, vendorId: vendor.id, vendorName: vendor.name, type,
        terms: pick(termsByType[type]), amountCents: range(15000, 500000), startDate, endDate,
        honorRate: Number(floatRange(0.75, 0.97).toFixed(2)), violations: range(0, 4), status,
        loggedBy: pick(['Jordan Lee', 'Devon K.', 'Priya S.']), loggedAt: startDate,
        notes: chance(0.3) ? pick(['Verbal commitment on 4/2 vendor call — confirmed via email.', 'Tied to volume target; check honor rate monthly.', 'Watch for stacking rules vs other active promos.']) : undefined,
      });
    }
    return out;
  }
  const PROMO_COMMITMENTS = generatePromoCommitments(14);

  // ── Compliance ──────────────────────────────────────────────────────────
  const METRC_HEALTH = ENTITY_IDS.map((e, idx) => {
    const health = idx === 1 ? 'yellow' : idx === 3 ? 'red' : 'green';
    const lagMinutes = health === 'green' ? range(1, 6) : health === 'yellow' ? range(12, 38) : range(60, 240);
    return {
      entity: e, entityName: ENTITY_NAMES[e], lastSyncAt: new Date(NOW - lagMinutes * 60 * 1000).toISOString(),
      lagMinutes, errorCount24h: health === 'red' ? range(3, 11) : health === 'yellow' ? range(1, 3) : 0, health,
    };
  });

  function generateSyncEvents(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const at = new Date(NOW - i * range(45, 300) * 1000).toISOString();
      const entity = pick(ENTITY_IDS);
      const isError = chance(0.12);
      const kind = isError ? 'error' : pick(['poll', 'poll', 'poll', 'webhook', 'backfill']);
      out.push({
        id: `sev-${String(i).padStart(4, '0')}`, at, entity, kind, ok: !isError,
        summary: isError
          ? pick(['METRC API 503 — auto-retry in 30s', 'Rate limit hit — throttling', 'Schema mismatch on manifest payload'])
          : pick(['Pulled 18 manifests, 6 transfers', 'Webhook received: package status change', 'Polled transfers — 3 new', 'Backfill completed for previous hour', 'Pulled 9 manifests, 2 transfers']),
      });
    }
    return out;
  }
  const METRC_SYNC_EVENTS = generateSyncEvents(24);

  const LICENSE_DOCS = (() => {
    const out = [];
    ENTITY_IDS.forEach((e) => {
      out.push({ id: `lic-${e}-state`, entity: e, entityName: ENTITY_NAMES[e], license: `C10-0000${range(100, 999)}-LIC`, type: 'state', issued: daysAgo(range(200, 360)), expires: daysFromNow(range(-5, 120)) });
      out.push({ id: `lic-${e}-local`, entity: e, entityName: ENTITY_NAMES[e], license: `LOCAL-2025-${range(1000, 9999)}`, type: 'local', issued: daysAgo(range(180, 300)), expires: daysFromNow(range(14, 200)) });
      out.push({ id: `lic-${e}-seller`, entity: e, entityName: ENTITY_NAMES[e], license: `SR KH ${range(10, 99)}-${range(100000, 999999)}`, type: 'seller_permit', issued: daysAgo(range(360, 720)), expires: daysFromNow(range(60, 720)) });
    });
    return out.sort((a, b) => new Date(a.expires).getTime() - new Date(b.expires).getTime());
  })();

  const RECALLS = [
    {
      id: 'rec-001', recallId: 'CA-DCC-2026-0042', state: 'CA', kind: 'Tier-2 voluntary — pesticide residue',
      announcedAt: daysAgo(2), vendorName: 'Raw Garden', affectedBatchIds: ['b-0014', 'b-0029'], affectedUnits: 144, quarantined: 144,
      summary: 'CA DCC published voluntary tier-2 recall 4/19 for pesticide residue on listed packages. 2 batches matched across THC + CCD; auto-quarantine triggered in suggest-only mode.',
    },
    {
      id: 'rec-002', recallId: 'CA-DCC-2026-0038', state: 'CA', kind: 'Tier-1 mandatory — labeling',
      announcedAt: daysAgo(9), vendorName: 'Heavy Hitters', affectedBatchIds: ['b-0007'], affectedUnits: 48, quarantined: 48,
      summary: 'Mandatory labeling recall on Heavy Hitters cartridge batches manufactured 2025-11. 1 batch matched (THC). Customer outreach batch generated.',
    },
    {
      id: 'rec-003', recallId: 'CA-DCC-2026-0031', state: 'CA', kind: 'Tier-3 informational — potency variance',
      announcedAt: daysAgo(18), vendorName: 'Wyld', affectedBatchIds: [], affectedUnits: 0, quarantined: 0,
      summary: 'No matching packages in inventory. Monitoring only.',
    },
  ];

  function generateAuditLog(count) {
    const modules = ['intake', 'ap', 'credits', 'batches', 'compliance', 'flags', 'metrc', 'buyers'];
    const actors = ['Manisha Patel', 'Priya S.', 'Marco R.', 'Lena K.', 'Jordan Lee', 'Ingestion Bot', 'METRC sync', 'AP Bot'];
    const out = [];
    for (let i = 0; i < count; i++) {
      const sourceModule = pick(modules);
      const action = pick(['updated flag', 'approved credit memo', 'posted invoice', 'moved batch to approved', 'force-synced METRC', 'quarantined batch', 'received manifest', 'logged promo commitment', 'auto-posted invoice', 'exported audit log']);
      out.push({
        id: `aud-${String(i).padStart(4, '0')}`, at: daysAgo(range(0, 14), range(0, 23)), sourceModule, actor: pick(actors), action,
        target: sourceModule === 'flags' ? `flags/${pick(['intake.auto_post_threshold', 'metrc.sync_interval_min', 'batch.age_warn_hours'])}`
          : sourceModule === 'ap' ? `invoices/ap-${String(range(0, 41)).padStart(4, '0')}`
          : sourceModule === 'credits' ? `credits/cm-${String(range(0, 27)).padStart(4, '0')}`
          : sourceModule === 'batches' ? `batches/b-${String(range(0, 51)).padStart(4, '0')}`
          : `${sourceModule}/*`,
        diff: chance(0.35) ? pick(['value: 0.90 → 0.92', 'status: pending → approved', 'status: staging → shelf_ready', 'amount: $420.00 → $385.50']) : undefined,
      });
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }
  const AUDIT_LOG = generateAuditLog(56);

  window.HD_OPS = {
    AP_INVOICES, apSummary, CREDIT_MEMOS, creditsSummary, PROMO_COMMITMENTS,
    METRC_HEALTH, METRC_SYNC_EVENTS, LICENSE_DOCS, RECALLS, AUDIT_LOG, ENTITY_NAMES, VENDORS,
  };
})();
