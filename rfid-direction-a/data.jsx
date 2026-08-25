// ── RFID console — seeded fixtures ────────────────────────────────────────
// Every number on every screen comes from here. The kit reconciliation is not
// hand-written: `reconcileKit` below is a faithful JS port of
// rfid-middleware/src/reconciliation/engine.ts (argmax-RSSI → −62 dBm gate →
// SKU resolve → per-box diff → greedy cross-box moves), so the lines, the pull
// list and the rollups can never drift out of agreement with each other.
;(function () {
  // Fixed clock — the prototype must render identically on every open.
  const NOW = new Date('2026-08-24T16:42:00-07:00').getTime();

  // Deterministic PRNG (mulberry32). Same seed → same EPCs, forever.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const R = rng(20260824);
  const hex = (n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789ABCDEF'[Math.floor(R() * 16)]; return s; };

  // 96-bit closed-loop EPC: schemeId(2) · siteCode(2) · serial(12) · entropy(8).
  // Deliberately NOT SGTIN-96 — see commissioning/epc.ts.
  const SCHEME = '01', SITE = '0A';
  let SERIAL = 0x000000018F40;
  function mintEpc() { SERIAL += 1 + Math.floor(R() * 3); return SCHEME + SITE + SERIAL.toString(16).toUpperCase().padStart(12, '0') + hex(8); }

  const CONFIDENCE_THRESHOLD = -62;
  const ROOM_PASS_COVERAGE = 0.98;

  // ── Catalog ─────────────────────────────────────────────────────────────
  // Brand names come from THE brand DB — never written as a literal here.
  const brandName = (key, fallback) => (window.HW_BRANDS && window.HW_BRANDS.name[key]) || fallback;

  const SKUS = [
    { sku: 'FLW-3.5-BD',  name: 'Blue Dream 3.5g',            brand: brandName('lowell', 'Lowell Farms'),   cat: 'flower',      unit: 'jar' },
    { sku: 'PRE-1G-OGK',  name: 'OG Kush Pre-Roll 1g',        brand: brandName('jeeter', 'Jeeter'),         cat: 'preroll',     unit: 'tube' },
    { sku: 'VAP-1G-GEL',  name: 'Gelato Live Resin Cart 1g',  brand: brandName('stiiizy', 'STIIIZY'),       cat: 'vape',        unit: 'cart' },
    { sku: 'EDI-100-GUM', name: 'Mixed Berry Gummies 100mg',  brand: brandName('wyld', 'Wyld'),             cat: 'edibles',     unit: 'tin' },
    { sku: 'CON-1G-LR',   name: 'Papaya Live Resin 1g',       brand: brandName('raw', 'Raw Garden'),        cat: 'concentrate', unit: 'jar' },
  ];
  const SKU_MAP = new Map(SKUS.map((s) => [s.sku, s]));

  // ── The engine, ported ──────────────────────────────────────────────────
  function reconcileKit(reads, skuOf, plan, gateDbm) {
    const gate = gateDbm == null ? CONFIDENCE_THRESHOLD : gateDbm;
    const actualByBox = new Map();
    const unknownEpcs = [], rescan = [];
    let phantomUnitsAvoided = 0;

    for (const [epc, perBox] of reads) {
      let box = -1, best = -Infinity, seenBoxes = 0;
      for (const [b, rssi] of perBox) { seenBoxes++; if (rssi > best) { best = rssi; box = b; } }
      if (best < gate) { rescan.push({ epc, bestRssi: best, seenBoxes, nearestBox: box }); continue; }
      const sku = skuOf(epc);
      if (sku === undefined) { unknownEpcs.push(epc); continue; }
      phantomUnitsAvoided += seenBoxes - 1;
      const bc = actualByBox.get(box) || new Map();
      bc.set(sku, (bc.get(sku) || 0) + 1);
      actualByBox.set(box, bc);
    }

    const correct = [], short = [], excess = [], wrongProduct = [];
    const boxes = new Set([...plan.keys(), ...actualByBox.keys()]);
    for (const b of [...boxes].sort((a, z) => a - z)) {
      const planned = plan.get(b) || new Map();
      const actual = actualByBox.get(b) || new Map();
      for (const sku of new Set([...planned.keys(), ...actual.keys()])) {
        const p = planned.get(sku) || 0, a = actual.get(sku) || 0;
        const line = { boxIndex: b, sku, planned: p, actual: a, delta: a - p };
        if (p === 0 && a > 0) wrongProduct.push(line);
        else if (a < p) short.push(line);
        else if (a > p) excess.push(line);
        else correct.push(line);
      }
    }

    const moves = buildMoves(short, [...excess, ...wrongProduct]);
    const kitPlanned = {}, kitActual = {};
    for (const bc of plan.values()) for (const [s, q] of bc) kitPlanned[s] = (kitPlanned[s] || 0) + q;
    for (const bc of actualByBox.values()) for (const [s, q] of bc) kitActual[s] = (kitActual[s] || 0) + q;

    return { correct, short, excess, wrongProduct, unknownEpcs, rescan, moves, kitPlanned, kitActual, phantomUnitsAvoided, gate };
  }

  function buildMoves(short, surplus) {
    const moves = [], bySku = new Map();
    for (const s of short) { const e = bySku.get(s.sku) || { shorts: [], surp: [] }; e.shorts.push({ box: s.boxIndex, qty: -s.delta }); bySku.set(s.sku, e); }
    for (const s of surplus) { const e = bySku.get(s.sku) || { shorts: [], surp: [] }; e.surp.push({ box: s.boxIndex, qty: s.delta }); bySku.set(s.sku, e); }
    for (const [sku, g] of bySku) {
      let si = 0;
      for (const need of g.shorts) {
        let remaining = need.qty;
        while (remaining > 0 && si < g.surp.length) {
          const src = g.surp[si];
          if (src.qty === 0) { si++; continue; }
          const q = Math.min(remaining, src.qty);
          moves.push({ sku, fromBox: src.box, toBox: need.box, qty: q });
          remaining -= q; src.qty -= q;
          if (src.qty === 0) si++;
        }
      }
    }
    return moves;
  }

  // Group by SOURCE box — an operator works one box at a time.
  function groupMoves(moves) {
    const byFrom = new Map();
    for (const m of moves) { const a = byFrom.get(m.fromBox) || []; a.push(m); byFrom.set(m.fromBox, a); }
    return [...byFrom.keys()].sort((a, b) => a - b).map((fromBox) => {
      const items = byFrom.get(fromBox).sort((a, b) => a.toBox - b.toBox || a.sku.localeCompare(b.sku)).map((m) => ({ sku: m.sku, toBox: m.toBox, qty: m.qty }));
      return { fromBox, totalUnits: items.reduce((n, i) => n + i.qty, 0), items };
    });
  }

  // ── The pilot kit: 5 boxes, ~140 units each, planted faults ─────────────
  // Non-uniform plans on purpose: a uniform plan cannot produce a genuine
  // wrong-product line, and wrong-product is one of the four states.
  const PLAN_ROWS = {
    1: { 'FLW-3.5-BD': 40, 'PRE-1G-OGK': 40, 'VAP-1G-GEL': 30, 'EDI-100-GUM': 30 },
    2: { 'FLW-3.5-BD': 40, 'PRE-1G-OGK': 40, 'VAP-1G-GEL': 30, 'EDI-100-GUM': 30 },
    3: { 'FLW-3.5-BD': 35, 'PRE-1G-OGK': 35, 'VAP-1G-GEL': 35, 'CON-1G-LR': 35 },
    4: { 'FLW-3.5-BD': 40, 'PRE-1G-OGK': 40, 'VAP-1G-GEL': 30, 'EDI-100-GUM': 30 },
    5: { 'FLW-3.5-BD': 35, 'PRE-1G-OGK': 35, 'EDI-100-GUM': 35, 'CON-1G-LR': 35 },
  };
  // What is physically in each box once the packers are done. The deltas here
  // are the four planted faults; everything else on screen is derived.
  //   box 2 +3 FLW  (belongs in box 4)   → excess, pairs with box 4's short
  //   box 3 +4 EDI  (not planned at all) → wrong product, pairs with box 5
  //   box 1 −2 PRE                       → genuine shortfall, no surplus to fix it
  //   +2 units land below the gate       → rescan, and they make 2 boxes LOOK short
  const PACKED_ROWS = {
    1: { 'FLW-3.5-BD': 40, 'PRE-1G-OGK': 38, 'VAP-1G-GEL': 30, 'EDI-100-GUM': 30 },
    2: { 'FLW-3.5-BD': 43, 'PRE-1G-OGK': 40, 'VAP-1G-GEL': 30, 'EDI-100-GUM': 30 },
    3: { 'FLW-3.5-BD': 35, 'PRE-1G-OGK': 35, 'VAP-1G-GEL': 35, 'CON-1G-LR': 35, 'EDI-100-GUM': 4 },
    4: { 'FLW-3.5-BD': 37, 'PRE-1G-OGK': 40, 'VAP-1G-GEL': 30, 'EDI-100-GUM': 30 },
    5: { 'FLW-3.5-BD': 35, 'PRE-1G-OGK': 35, 'EDI-100-GUM': 31, 'CON-1G-LR': 35 },
  };
  // The two units the reader heard but could not place. Both are physically in
  // a box; the gate refuses to say which, so their boxes read one short.
  const BELOW_GATE = [
    { box: 1, sku: 'VAP-1G-GEL', rssi: -66.4 },
    { box: 5, sku: 'CON-1G-LR',  rssi: -64.1 },
  ];

  const toPlan = (rows) => new Map(Object.entries(rows).map(([b, m]) => [Number(b), new Map(Object.entries(m))]));
  const KIT_PLAN = toPlan(PLAN_ROWS);

  // Build the collapsed best-RSSI-per-(epc,box) map the engine consumes,
  // simulating reduced power + neighbor bleed exactly as MockAdapter does.
  const KIT_TAGS = [];                    // epc → sku, in pack order
  const KIT_READS = new Map();            // epc → Map(box → best rssi)
  const boxReadCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let physicalUnits = 0;

  function addRead(epc, box, rssi) {
    const m = KIT_READS.get(epc) || new Map();
    if (!m.has(box) || rssi > m.get(box)) m.set(box, rssi);
    KIT_READS.set(epc, m);
  }

  const gateVictims = new Set();
  Object.keys(PACKED_ROWS).forEach((bStr) => {
    const box = Number(bStr);
    Object.entries(PACKED_ROWS[bStr]).forEach(([sku, qty]) => {
      for (let i = 0; i < qty; i++) {
        const epc = mintEpc();
        KIT_TAGS.push({ epc, sku, box });
        physicalUnits++;
        const victim = BELOW_GATE.find((v) => v.box === box && v.sku === sku && !gateVictims.has(v.sku + v.box));
        if (victim) {
          gateVictims.add(victim.sku + victim.box);
          addRead(epc, box, victim.rssi);          // heard, but under the gate
          boxReadCounts[box] += 2;
          continue;
        }
        // Present read: strong. Edge units (~8%) sit at a box wall and are
        // weaker to their own reader.
        const edge = R() < 0.08;
        addRead(epc, box, +((edge ? -52 - R() * 6 : -45 - R() * 13)).toFixed(1));
        boxReadCounts[box] += 1 + Math.floor(R() * 3);
        // Neighbour bleed at reduced power. Even an edge unit bleeds weaker
        // (−63…−69) than it reads to its own box (−52…−58) — that separation is
        // exactly what reduced power buys, and what argmax then throws away.
        for (const nb of [box - 1, box + 1]) {
          if (!PACKED_ROWS[nb]) continue;
          if (R() < 0.35) {
            addRead(epc, nb, +((edge ? -63 - R() * 6 : -76 - R() * 8)).toFixed(1));
            boxReadCounts[nb] += 1;
          }
        }
      }
    });
  });
  const SKU_OF = new Map(KIT_TAGS.map((t) => [t.epc, t.sku]));
  const RECON = reconcileKit(KIT_READS, (e) => SKU_OF.get(e), KIT_PLAN, CONFIDENCE_THRESHOLD);
  const MOVE_GROUPS = groupMoves(RECON.moves);
  const READS_INGESTED = Object.values(boxReadCounts).reduce((a, b) => a + b, 0);
  const UNITS_COUNTED = Object.values(RECON.kitActual).reduce((a, b) => a + b, 0);
  const UNITS_PLANNED = Object.values(RECON.kitPlanned).reduce((a, b) => a + b, 0);
  // What "count it in every box you heard it in" would have produced from the
  // same reads: the units argmax kept, plus every extra box each was heard in.
  const NAIVE_UNITS = UNITS_COUNTED + RECON.phantomUnitsAvoided;

  // Per-box rollup for the box strip.
  const BOXES = [1, 2, 3, 4, 5].map((b) => {
    const all = [...RECON.correct, ...RECON.short, ...RECON.excess, ...RECON.wrongProduct].filter((l) => l.boxIndex === b);
    const planned = all.reduce((n, l) => n + l.planned, 0);
    const actual = all.reduce((n, l) => n + l.actual, 0);
    const short = RECON.short.filter((l) => l.boxIndex === b).length;
    const excess = RECON.excess.filter((l) => l.boxIndex === b).length;
    const wrong = RECON.wrongProduct.filter((l) => l.boxIndex === b).length;
    const rescan = RECON.rescan.filter((r) => r.nearestBox === b).length;
    const state = short || wrong ? 'blocked' : excess ? 'warn' : 'ok';
    return { box: b, planned, actual, short, excess, wrong, rescan, state, reads: boxReadCounts[b],
      scannedAt: new Date(NOW - (6 - b) * 4 * 60000).toISOString() };
  });

  const KIT = {
    id: 'KIT-2026-0824-03',
    label: 'Long Beach restock · Fri PM run',
    destination: 'Hyperwolf Long Beach',
    entity: 'hwd',
    sessionId: 'SES-9F4C21A8',
    boxCount: 5,
    status: 'reconciled',
    operator: 'D. Okafor',
    device: 'TC22R-01',
    rfPower: 20,
    gate: CONFIDENCE_THRESHOLD,
    startedAt: new Date(NOW - 27 * 60000).toISOString(),
    reconciledAt: new Date(NOW - 3 * 60000).toISOString(),
    plannedUnits: UNITS_PLANNED,
    countedUnits: UNITS_COUNTED,
    readsIngested: READS_INGESTED,
    physicalUnits,
    naiveUnits: NAIVE_UNITS,
    boxes: BOXES,
    recon: RECON,
    moveGroups: MOVE_GROUPS,
    plan: PLAN_ROWS,
  };

  // Other kit sessions, for the list screen.
  const KITS = [
    KIT,
    { id: 'KIT-2026-0824-02', label: 'Corona restock · Fri AM run', destination: 'Hyperwolf Corona', entity: 'hwd',
      boxCount: 5, status: 'closed', operator: 'D. Okafor', device: 'TC22R-01', plannedUnits: 700, countedUnits: 700,
      readsIngested: 2731, flagged: 0, moves: 0, rescan: 0, startedAt: new Date(NOW - 6.4 * 3600000).toISOString(),
      reconciledAt: new Date(NOW - 5.9 * 3600000).toISOString() },
    { id: 'KIT-2026-0824-01', label: 'West Hollywood restock', destination: 'Hyperwolf West Hollywood', entity: 'hwd',
      boxCount: 4, status: 'closed', operator: 'M. Reyes', device: 'TC22R-01', plannedUnits: 560, countedUnits: 558,
      readsIngested: 2189, flagged: 2, moves: 1, rescan: 1, startedAt: new Date(NOW - 9.2 * 3600000).toISOString(),
      reconciledAt: new Date(NOW - 8.7 * 3600000).toISOString() },
    { id: 'KIT-2026-0823-05', label: 'Lake Elsinore restock', destination: 'Hyperwolf Lake Elsinore', entity: 'hwd',
      boxCount: 5, status: 'closed', operator: 'M. Reyes', device: 'TC22R-01', plannedUnits: 700, countedUnits: 689,
      readsIngested: 2802, flagged: 6, moves: 3, rescan: 4, startedAt: new Date(NOW - 27 * 3600000).toISOString(),
      reconciledAt: new Date(NOW - 26.3 * 3600000).toISOString() },
    { id: 'KIT-2026-0823-04', label: 'Corona restock · Thu PM run', destination: 'Hyperwolf Corona', entity: 'hwd',
      boxCount: 5, status: 'closed', operator: 'D. Okafor', device: 'TC22R-01', plannedUnits: 700, countedUnits: 700,
      readsIngested: 2660, flagged: 0, moves: 0, rescan: 0, startedAt: new Date(NOW - 31 * 3600000).toISOString(),
      reconciledAt: new Date(NOW - 30.4 * 3600000).toISOString() },
  ];
  // Derived summary for the hero kit so the list and the detail cannot disagree.
  KIT.flagged = RECON.short.length + RECON.excess.length + RECON.wrongProduct.length;
  KIT.moves = RECON.moves.length;
  KIT.rescanCount = RECON.rescan.length;

  // ── Cycle counts ────────────────────────────────────────────────────────
  const strag = (n, skuKeys) => Array.from({ length: n }, (_, i) => ({
    epc: mintEpc(), sku: skuKeys[i % skuKeys.length], material: 'paper',
    lastSeen: new Date(NOW - (18 + i * 7) * 3600000).toISOString(),
  }));

  const COUNTS = [
    { id: 'CNT-2026-0824-02', room: 'Vault A · main floor', entity: 'thc', status: 'complete',
      expected: 612, uniqueFound: 601, notLocated: 11, coveragePct: 98.2, verdict: 'PASS',
      operators: 3, passes: [{ n: 1, reads: 1044, newlySeen: 512 }, { n: 2, reads: 987, newlySeen: 74 }, { n: 3, reads: 903, newlySeen: 15 }],
      startedAt: new Date(NOW - 96 * 60000).toISOString(), finishedAt: new Date(NOW - 41 * 60000).toISOString(),
      operator: 'M. Reyes', device: 'TC22R-01', rfPower: 24,
      stragglers: strag(11, ['CON-1G-LR', 'VAP-1G-GEL', 'EDI-100-GUM', 'FLW-3.5-BD']) },
    { id: 'CNT-2026-0823-01', room: 'Packing room', entity: 'thc', status: 'complete',
      expected: 348, uniqueFound: 335, notLocated: 13, coveragePct: 96.3, verdict: 'REVIEW',
      operators: 2, passes: [{ n: 1, reads: 604, newlySeen: 311 }, { n: 2, reads: 528, newlySeen: 24 }],
      startedAt: new Date(NOW - 29 * 3600000).toISOString(), finishedAt: new Date(NOW - 28.4 * 3600000).toISOString(),
      operator: 'D. Okafor', device: 'TC22R-01', rfPower: 24,
      stragglers: strag(13, ['VAP-1G-GEL', 'CON-1G-LR', 'EDI-100-GUM']) },
    { id: 'CNT-2026-0821-04', room: 'Vault A · main floor', entity: 'thc', status: 'complete',
      expected: 604, uniqueFound: 604, notLocated: 0, coveragePct: 100, verdict: 'PASS',
      operators: 3, passes: [{ n: 1, reads: 1102, newlySeen: 548 }, { n: 2, reads: 964, newlySeen: 51 }, { n: 3, reads: 877, newlySeen: 5 }],
      startedAt: new Date(NOW - 74 * 3600000).toISOString(), finishedAt: new Date(NOW - 73.2 * 3600000).toISOString(),
      operator: 'M. Reyes', device: 'TC22R-01', rfPower: 24, stragglers: [] },
  ];

  // ── Commissioning ───────────────────────────────────────────────────────
  const COMMISSION_RUNS = [
    { id: 'CMS-2026-0824-07', sku: 'FLW-3.5-BD', packageId: '1A4060300012345670000A9C3F', qty: 200, commissioned: 200,
      printed: true, actor: 'D. Okafor', at: new Date(NOW - 74 * 60000).toISOString(), status: 'ok', material: 'paper' },
    { id: 'CMS-2026-0824-06', sku: 'EDI-100-GUM', packageId: '1A4060300012345670000B1E27', qty: 150, commissioned: 150,
      printed: true, actor: 'D. Okafor', at: new Date(NOW - 133 * 60000).toISOString(), status: 'ok', material: 'paper' },
    { id: 'CMS-2026-0824-05', sku: 'VAP-1G-GEL', packageId: '1A4060300012345670000C7F91', qty: 120, commissioned: 43,
      printed: false, actor: 'M. Reyes', at: new Date(NOW - 190 * 60000).toISOString(), status: 'collision', material: 'paper',
      collision: { field: 'retailId', value: 'R-VAP-1G-GEL-004417', boundEpc: '010A000000018FA23C71B904', boundAt: new Date(NOW - 3 * 86400000).toISOString() } },
    { id: 'CMS-2026-0824-04', sku: 'PRE-1G-OGK', packageId: '1A4060300012345670000D4A08', qty: 250, commissioned: 250,
      printed: true, actor: 'M. Reyes', at: new Date(NOW - 260 * 60000).toISOString(), status: 'ok', material: 'paper' },
    { id: 'CMS-2026-0823-09', sku: 'CON-1G-LR', packageId: '1A4060300012345670000E5B13', qty: 180, commissioned: 180,
      printed: true, actor: 'D. Okafor', at: new Date(NOW - 24 * 3600000).toISOString(), status: 'ok', material: 'paper' },
  ];

  // Preview rows for the "last run" table on the commissioning screen.
  const LAST_RUN_TAGS = Array.from({ length: 8 }, (_, i) => ({
    epc: mintEpc(), retailId: `R-FLW-3.5-BD-0${9120 + i}`, sku: 'FLW-3.5-BD',
    packageId: '1A4060300012345670000A9C3F', state: 'AVAILABLE',
  }));

  const ZPL_SAMPLE = [
    '^XA',
    '^RS8,,,3',
    '^RFW,H,1,2,1^FD010A000000018FA4B72C0E91^FS',
    '^FO32,28^A0N,28,28^FDBlue Dream 3.5g^FS',
    '^FO32,64^A0N,22,22^FDFLW-3.5-BD^FS',
    '^FO32,96^BQN,2,5^FDQA,R-FLW-3.5-BD-09120^FS',
    '^FO250,96^A0N,20,20^FDR-FLW-3.5-BD-09120^FS',
    '^PQ1',
    '^XZ',
  ].join('\n');

  // ── Tag registry ────────────────────────────────────────────────────────
  const STATES = ['AVAILABLE', 'TRANSFER_PENDING', 'ALLOCATED', 'DISPATCHED', 'SOLD', 'HELD', 'SOFT_HOLD', 'RETURNED', 'DAMAGED', 'DESTROYED'];
  const REGISTRY = Array.from({ length: 24 }, (_, i) => {
    const s = SKUS[i % SKUS.length];
    const state = STATES[[0, 0, 0, 2, 2, 3, 1, 4, 5, 0, 6, 7, 0, 8, 0, 2, 3, 0, 9, 0, 1, 2, 0, 4][i]];
    return {
      epc: mintEpc(), retailId: `R-${s.sku}-0${8000 + i * 37}`, sku: s.sku,
      packageId: ['1A4060300012345670000A9C3F', '1A4060300012345670000B1E27', '1A4060300012345670000C7F91', '1A4060300012345670000D4A08'][i % 4],
      state, material: 'paper', registeredAt: new Date(NOW - (2 + i * 3.1) * 3600000).toISOString(),
    };
  });

  // ── Audit firehose ──────────────────────────────────────────────────────
  const AUDIT = [
    { at: new Date(NOW - 3 * 60000).toISOString(), actor: 'D. Okafor', action: 'KIT_RECONCILED', subject: 'SES-9F4C21A8', tone: 'ok', detail: `gate -62 dBm · ${UNITS_COUNTED} units counted · 2 moves` },
    { at: new Date(NOW - 4 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 5', tone: 'neutral', detail: `${boxReadCounts[5]} reads accepted` },
    { at: new Date(NOW - 8 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 4', tone: 'neutral', detail: `${boxReadCounts[4]} reads accepted` },
    { at: new Date(NOW - 12 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 3', tone: 'neutral', detail: `${boxReadCounts[3]} reads accepted` },
    { at: new Date(NOW - 16 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 2', tone: 'neutral', detail: `${boxReadCounts[2]} reads accepted` },
    { at: new Date(NOW - 20 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 1', tone: 'neutral', detail: `${boxReadCounts[1]} reads accepted` },
    { at: new Date(NOW - 27 * 60000).toISOString(), actor: 'D. Okafor', action: 'KIT_SESSION_OPENED', subject: 'KIT-2026-0824-03', tone: 'info', detail: '5 boxes · 700 units planned · TC22R-01 @ 20 dBm' },
    { at: new Date(NOW - 41 * 60000).toISOString(), actor: 'M. Reyes', action: 'CYCLE_COUNT_COMPLETED', subject: 'CNT-2026-0824-02', tone: 'ok', detail: '98.2% coverage → PASS · 11 stragglers' },
    { at: new Date(NOW - 74 * 60000).toISOString(), actor: 'D. Okafor', action: 'TAG_COMMISSIONED', subject: 'CMS-2026-0824-07', tone: 'ok', detail: '200 × FLW-3.5-BD bound and printed' },
    { at: new Date(NOW - 128 * 60000).toISOString(), actor: 'system', action: 'GATE_OVERRIDE', subject: 'SES-7B21D004', tone: 'warn', detail: 'gate set to -68 dBm for calibration — non-default, logged' },
    { at: new Date(NOW - 133 * 60000).toISOString(), actor: 'D. Okafor', action: 'TAG_COMMISSIONED', subject: 'CMS-2026-0824-06', tone: 'ok', detail: '150 × EDI-100-GUM bound and printed' },
    { at: new Date(NOW - 189 * 60000).toISOString(), actor: 'M. Reyes', action: 'COMMISSION_REJECTED_COLLISION', subject: 'CMS-2026-0824-05', tone: 'blocked', detail: 'retailId R-VAP-1G-GEL-004417 already bound — 409, nothing printed' },
    { at: new Date(NOW - 189.4 * 60000).toISOString(), actor: 'M. Reyes', action: 'EPC_MINT_COLLISION', subject: 'CMS-2026-0824-05', tone: 'warn', detail: 'attempt 1 of 5 — re-minted, no batch replay' },
    { at: new Date(NOW - 260 * 60000).toISOString(), actor: 'M. Reyes', action: 'TAG_COMMISSIONED', subject: 'CMS-2026-0824-04', tone: 'ok', detail: '250 × PRE-1G-OGK bound and printed' },
  ];

  // ── Hardware ────────────────────────────────────────────────────────────
  const DEVICES = {
    reader: { id: 'TC22R-01', model: 'Zebra TC22R integrated handheld', os: 'Android 13',
      battery: 78, rfPower: 20, rfMin: 15, rfMax: 30, connection: 'WebView bridge', bridge: 'v0.4-contract',
      lastRead: new Date(NOW - 3 * 60000).toISOString(), status: 'ok' },
    printer: { id: 'ZT411-01', model: 'Zebra ZT411 RFID printer', media: 'Vulcan Glint UHF · NXP UCODE 9xe',
      stockRemaining: 3214, stockTotal: 4000, status: 'ok', lastPrint: new Date(NOW - 74 * 60000).toISOString() },
    gate: { value: CONFIDENCE_THRESHOLD, passCoverage: ROOM_PASS_COVERAGE },
    // The three things that are contract, not verified integration. These are
    // shown on screen because pretending otherwise is how a pilot ships broken.
    unverified: [
      { id: 'rssi', label: 'Per-read RSSI from the Zebra SDK', note: 'argmax needs an RSSI on every read. Confirm on a real TC22R.' },
      { id: 'power', label: 'Programmatic RF power control', note: 'Reduced power is half the isolation mechanism. DataWedge cannot provide it.' },
      { id: 'zpl', label: 'ZT411 label ZPL', note: 'Never printed on real Glint stock. Print one, read it back.' },
      { id: 'gate', label: '-62 dBm gate + power setpoint', note: 'Simulation-validated only. Calibrate before rollout.' },
      { id: 'metal', label: 'On-metal tag material', note: 'No on-metal stock was purchased. The column exists; the support does not.' },
    ],
  };

  window.RFID_DATA = {
    NOW, CONFIDENCE_THRESHOLD, ROOM_PASS_COVERAGE,
    SKUS, SKU_MAP, KIT, KITS, COUNTS, COMMISSION_RUNS, LAST_RUN_TAGS, ZPL_SAMPLE,
    REGISTRY, AUDIT, DEVICES, STATES,
    reconcileKit, groupMoves,
  };
})();
