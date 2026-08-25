// ── RFID module — the one data layer ─────────────────────────────────────
// Every number on every screen — desktop AND handheld — comes from here.
// The kit reconciliation is not hand-written: `reconcileKit` below is a
// faithful JS port of rfid-middleware/src/reconciliation/engine.ts
// (argmax-RSSI → −62 dBm gate → SKU resolve → per-box diff → greedy cross-box
// moves), so the lines, the pull list, the box strip, the rollups and the
// handheld's live counters can never drift out of agreement with each other.
//
// Rule for anyone editing this module: **no screen may hold its own figure.**
// If the TC22R says 696 assigned, the desk says 696, because both read
// RFID_DATA.KIT.countedUnits and neither is allowed to compute.
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
  const skuOf = (id) => SKU_MAP.get(id) || { sku: id, name: id, brand: '', cat: 'other', unit: 'unit' };

  // ── The engine, ported ──────────────────────────────────────────────────
  function reconcileKit(reads, skuOfEpc, plan, gateDbm) {
    const gate = gateDbm == null ? CONFIDENCE_THRESHOLD : gateDbm;
    const actualByBox = new Map();
    const unknownEpcs = [], rescan = [];
    let phantomUnitsAvoided = 0;

    for (const [epc, perBox] of reads) {
      let box = -1, best = -Infinity, seenBoxes = 0;
      for (const [b, rssi] of perBox) { seenBoxes++; if (rssi > best) { best = rssi; box = b; } }
      if (best < gate) { rescan.push({ epc, bestRssi: best, seenBoxes, nearestBox: box }); continue; }
      const sku = skuOfEpc(epc);
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

  // Shorts the greedy pairing could not satisfy from any surplus in the kit.
  // Lives here, not in a screen, because the handheld's "moving won't fix
  // these" list and the desk's "unresolved shortfall" table are the same list.
  function unresolvedShorts(r) {
    const covered = new Map();
    for (const m of r.moves) covered.set(`${m.toBox}|${m.sku}`, (covered.get(`${m.toBox}|${m.sku}`) || 0) + m.qty);
    const rescanNearest = new Map();
    for (const x of r.rescan) rescanNearest.set(x.nearestBox, (rescanNearest.get(x.nearestBox) || 0) + 1);
    return r.short.map((l) => {
      const q = -l.delta - (covered.get(`${l.boxIndex}|${l.sku}`) || 0);
      const maybeRescan = q === 1 && rescanNearest.has(l.boxIndex);
      return {
        boxIndex: l.boxIndex, sku: l.sku, qty: q, maybeRescan,
        cause: maybeRescan
          ? 'One unit sits in the rescan queue — likely present, not missing.'
          : 'Never packed. No surplus of this SKU anywhere in the kit.',
      };
    }).filter((u) => u.qty > 0);
  }

  // ── The pilot kit: 5 boxes, 140 units each, planted faults ──────────────
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
  // are the planted faults; everything else on screen is derived.
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
  // simulating reduced power + neighbour bleed exactly as MockAdapter does.
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
  const UNRESOLVED = unresolvedShorts(RECON);
  const READS_INGESTED = Object.values(boxReadCounts).reduce((a, b) => a + b, 0);
  const UNITS_COUNTED = Object.values(RECON.kitActual).reduce((a, b) => a + b, 0);
  const UNITS_PLANNED = Object.values(RECON.kitPlanned).reduce((a, b) => a + b, 0);
  // What "count it in every box you heard it in" would have produced from the
  // same reads: the units argmax kept, plus every extra box each was heard in.
  const NAIVE_UNITS = UNITS_COUNTED + RECON.phantomUnitsAvoided;

  // Per-box radio telemetry, derived from the same read map the engine ate.
  // The handheld shows these live while scanning; the desk shows them as a
  // column. Neither surface may invent one.
  const BOX_BLEED = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const BOX_RSSI_SUM = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const BOX_RSSI_N = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const [, perBox] of KIT_READS) {
    let win = -1, best = -Infinity;
    for (const [b, rssi] of perBox) if (rssi > best) { best = rssi; win = b; }
    for (const [b] of perBox) if (b !== win) BOX_BLEED[b] += 1;
    if (best >= CONFIDENCE_THRESHOLD && BOX_RSSI_N[win] != null) { BOX_RSSI_SUM[win] += best; BOX_RSSI_N[win] += 1; }
  }

  // Per-box rollup for the box strip and for every handheld box screen.
  const BOXES = [1, 2, 3, 4, 5].map((b) => {
    const all = [...RECON.correct, ...RECON.short, ...RECON.excess, ...RECON.wrongProduct].filter((l) => l.boxIndex === b);
    const planned = all.reduce((n, l) => n + l.planned, 0);
    const actual = all.reduce((n, l) => n + l.actual, 0);
    const short = RECON.short.filter((l) => l.boxIndex === b).length;
    const excess = RECON.excess.filter((l) => l.boxIndex === b).length;
    const wrong = RECON.wrongProduct.filter((l) => l.boxIndex === b).length;
    const rescan = RECON.rescan.filter((r) => r.nearestBox === b).length;
    const state = short || wrong ? 'blocked' : excess ? 'warn' : 'ok';
    return {
      box: b, planned, actual, short, excess, wrong, rescan, state,
      reads: boxReadCounts[b],
      bleedRejected: BOX_BLEED[b],
      avgRssi: BOX_RSSI_N[b] ? +(BOX_RSSI_SUM[b] / BOX_RSSI_N[b]).toFixed(1) : 0,
      // Read duration is the one per-box figure the read map cannot yield, so
      // it is derived from the read count at the adapter's ~12 reads/s rather
      // than typed independently on two screens.
      seconds: Math.round(boxReadCounts[b] / 12),
      lines: all.map((l) => ({ ...l, state: l.planned === 0 && l.actual > 0 ? 'wrong' : l.delta < 0 ? 'short' : l.delta > 0 ? 'excess' : 'correct' }))
        .sort((x, y) => SKUS.findIndex((s) => s.sku === x.sku) - SKUS.findIndex((s) => s.sku === y.sku)),
      scannedAt: new Date(NOW - (6 - b) * 4 * 60000).toISOString(),
    };
  });

  // Every line, tagged with its state — the desk's table and the handheld's
  // per-box list read this same array.
  const LINES = [
    ...RECON.short.map((l) => ({ ...l, state: 'short' })),
    ...RECON.excess.map((l) => ({ ...l, state: 'excess' })),
    ...RECON.wrongProduct.map((l) => ({ ...l, state: 'wrong' })),
    ...RECON.correct.map((l) => ({ ...l, state: 'correct' })),
  ].sort((a, b) => a.boxIndex - b.boxIndex || a.sku.localeCompare(b.sku));

  const KIT = {
    id: 'KIT-2026-0824-03',
    label: 'Long Beach restock · Fri PM run',
    destination: 'Hyperwolf Long Beach',
    route: 'Route 12 · Vault A → Long Beach',
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
    submittedAt: new Date(NOW - 3 * 60000).toISOString(),
    plannedUnits: UNITS_PLANNED,
    countedUnits: UNITS_COUNTED,
    readsIngested: READS_INGESTED,
    physicalUnits,
    naiveUnits: NAIVE_UNITS,
    boxes: BOXES,
    lines: LINES,
    recon: RECON,
    moveGroups: MOVE_GROUPS,
    unresolved: UNRESOLVED,
    plan: PLAN_ROWS,
    // The box the handheld is standing in front of in the scan/box screens.
    // Box 3 is the wrong-product box, so the device gets to show the state a
    // count alone could never explain.
    liveBox: 3,
  };

  // One summary object. The handheld band, the desk stat tiles and the kit
  // list row all read these fields — there is no second copy anywhere.
  const KIT_SUMMARY = {
    planned: UNITS_PLANNED,
    assigned: UNITS_COUNTED,
    physical: physicalUnits,
    naive: NAIVE_UNITS,
    reads: READS_INGESTED,
    rescan: RECON.rescan.length,
    unknown: RECON.unknownEpcs.length,
    scanned: UNITS_COUNTED + RECON.rescan.length + RECON.unknownEpcs.length,
    correct: RECON.correct.length,
    short: RECON.short.length,
    excess: RECON.excess.length,
    wrong: RECON.wrongProduct.length,
    flagged: RECON.short.length + RECON.excess.length + RECON.wrongProduct.length,
    moveLines: RECON.moves.length,
    moveUnits: RECON.moves.reduce((n, m) => n + m.qty, 0),
    moveGroups: MOVE_GROUPS.length,
    missingUnits: UNRESOLVED.reduce((n, u) => n + u.qty, 0),
    phantomUnitsAvoided: RECON.phantomUnitsAvoided,
    verdict: (RECON.short.length + RECON.excess.length + RECON.wrongProduct.length) ? 'REVIEW' : 'PASS',
  };
  KIT.flagged = KIT_SUMMARY.flagged;
  KIT.moves = KIT_SUMMARY.moveLines;
  KIT.rescanCount = KIT_SUMMARY.rescan;

  // Other kit sessions, for the list screen. Only the hero kit carries a real
  // reconciliation; the rest are list fixtures and say so when opened.
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

  // ── Cycle counts ────────────────────────────────────────────────────────
  // Stragglers carry a shelf hint and a likely cause: the handheld sends the
  // operator to a place, and the desk needs the cause to decide whether a unit
  // is hiding or gone.
  const STRAG_CAUSE = ['Foil-lined pouch', 'Stacked dense', 'Behind metal shelf', 'Mylar overwrap'];
  const strag = (n, skuKeys, seed) => {
    const g = rng(seed);
    return Array.from({ length: n }, (_, i) => ({
      epc: mintEpc(), sku: skuKeys[i % skuKeys.length], material: 'paper',
      shelf: `A-${2 + Math.floor(g() * 8)}-${1 + Math.floor(g() * 4)}`,
      cause: STRAG_CAUSE[Math.floor(g() * STRAG_CAUSE.length)],
      lastSeen: new Date(NOW - (18 + i * 7) * 3600000).toISOString(),
    }));
  };

  const COUNTS = [
    { id: 'CNT-2026-0824-02', room: 'Vault A · main floor', entity: 'thc', status: 'complete',
      expected: 612, uniqueFound: 601, notLocated: 11, coveragePct: 98.2, verdict: 'PASS',
      operators: 3, passes: [{ n: 1, reads: 1044, newlySeen: 512 }, { n: 2, reads: 987, newlySeen: 74 }, { n: 3, reads: 903, newlySeen: 15 }],
      zones: ['Aisle 1', 'Aisle 2', 'Aisle 3', 'Aisle 4', 'Aisle 5'], liveZone: 2,
      startedAt: new Date(NOW - 96 * 60000).toISOString(), finishedAt: new Date(NOW - 41 * 60000).toISOString(),
      operator: 'M. Reyes', device: 'TC22R-01', rfPower: 24, minutes: 55,
      stragglers: strag(11, ['CON-1G-LR', 'VAP-1G-GEL', 'EDI-100-GUM', 'FLW-3.5-BD'], 7700) },
    { id: 'CNT-2026-0823-01', room: 'Packing room', entity: 'thc', status: 'complete',
      expected: 348, uniqueFound: 335, notLocated: 13, coveragePct: 96.3, verdict: 'REVIEW',
      operators: 2, passes: [{ n: 1, reads: 604, newlySeen: 311 }, { n: 2, reads: 528, newlySeen: 24 }],
      zones: ['Bench 1', 'Bench 2', 'Bench 3'], liveZone: 1,
      startedAt: new Date(NOW - 29 * 3600000).toISOString(), finishedAt: new Date(NOW - 28.4 * 3600000).toISOString(),
      operator: 'D. Okafor', device: 'TC22R-01', rfPower: 24, minutes: 36,
      stragglers: strag(13, ['VAP-1G-GEL', 'CON-1G-LR', 'EDI-100-GUM'], 8800) },
    { id: 'CNT-2026-0821-04', room: 'Vault A · main floor', entity: 'thc', status: 'complete',
      expected: 604, uniqueFound: 604, notLocated: 0, coveragePct: 100, verdict: 'PASS',
      operators: 3, passes: [{ n: 1, reads: 1102, newlySeen: 548 }, { n: 2, reads: 964, newlySeen: 51 }, { n: 3, reads: 877, newlySeen: 5 }],
      zones: ['Aisle 1', 'Aisle 2', 'Aisle 3', 'Aisle 4', 'Aisle 5'], liveZone: 4,
      startedAt: new Date(NOW - 74 * 3600000).toISOString(), finishedAt: new Date(NOW - 73.2 * 3600000).toISOString(),
      operator: 'M. Reyes', device: 'TC22R-01', rfPower: 24, minutes: 48, stragglers: [] },
  ];
  // The count the handheld is walking. Everything the device shows for it is
  // read off this record.
  const LIVE_COUNT = COUNTS[0];

  // ── Commissioning ───────────────────────────────────────────────────────
  const COLLISION_INCOMING = mintEpc();
  const COMMISSION_RUNS = [
    { id: 'CMS-2026-0824-07', sku: 'FLW-3.5-BD', packageId: '1A4060300012345670000A9C3F', qty: 200, commissioned: 200,
      printed: true, actor: 'D. Okafor', at: new Date(NOW - 74 * 60000).toISOString(), status: 'ok', material: 'paper', labelsPerMin: 22 },
    { id: 'CMS-2026-0824-06', sku: 'EDI-100-GUM', packageId: '1A4060300012345670000B1E27', qty: 150, commissioned: 150,
      printed: true, actor: 'D. Okafor', at: new Date(NOW - 133 * 60000).toISOString(), status: 'ok', material: 'paper', labelsPerMin: 22 },
    { id: 'CMS-2026-0824-05', sku: 'VAP-1G-GEL', packageId: '1A4060300012345670000C7F91', qty: 120, commissioned: 43,
      printed: false, actor: 'M. Reyes', at: new Date(NOW - 190 * 60000).toISOString(), status: 'collision', material: 'paper', labelsPerMin: 22,
      collision: {
        field: 'retailId', value: 'R-VAP-1G-GEL-004417',
        incomingEpc: COLLISION_INCOMING,
        boundEpc: '010A000000018FA23C71B904',
        boundAt: new Date(NOW - 3 * 86400000).toISOString(),
        boundBy: 'D. Okafor',
        auditEventId: 'AE-2026-0824-00417',
        status: '409 COLLISION',
      } },
    { id: 'CMS-2026-0824-04', sku: 'PRE-1G-OGK', packageId: '1A4060300012345670000D4A08', qty: 250, commissioned: 250,
      printed: true, actor: 'M. Reyes', at: new Date(NOW - 260 * 60000).toISOString(), status: 'ok', material: 'paper', labelsPerMin: 22 },
    { id: 'CMS-2026-0823-09', sku: 'CON-1G-LR', packageId: '1A4060300012345670000E5B13', qty: 180, commissioned: 180,
      printed: true, actor: 'D. Okafor', at: new Date(NOW - 24 * 3600000).toISOString(), status: 'ok', material: 'paper', labelsPerMin: 22 },
  ];
  // The run the handheld is holding — the one that hit the 1:1 refusal.
  const LIVE_RUN = COMMISSION_RUNS[2];
  const COLLISION = LIVE_RUN.collision;

  // Preview rows for the "last run" table on the commissioning screen.
  const LAST_RUN_TAGS = Array.from({ length: 8 }, (_, i) => ({
    epc: mintEpc(), retailId: `R-FLW-3.5-BD-0${9120 + i}`, sku: 'FLW-3.5-BD',
    packageId: '1A4060300012345670000A9C3F', state: 'AVAILABLE',
  }));
  // Rows the handheld shows ticking past during the live run.
  const LIVE_RUN_TAGS = Array.from({ length: LIVE_RUN.commissioned }, (_, i) => ({
    n: i + 1, epc: mintEpc(), retailId: `R-${LIVE_RUN.sku}-00${4370 + i}`, ok: i !== 28,
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
  const TAG_INVENTORY = { purchased: 4000, commissioned: REGISTRY.length + 1583, remaining: 4000 - (REGISTRY.length + 1583) };

  // ── Audit firehose ──────────────────────────────────────────────────────
  // Seeded history. Anything a supervisor decides in this session is prepended
  // to it live by the decision store in ui.jsx — a rejection is a record too.
  const AUDIT = [
    { at: new Date(NOW - 3 * 60000).toISOString(), actor: 'D. Okafor', action: 'KIT_SUBMITTED', subject: 'SES-9F4C21A8', tone: 'info', detail: `submitted for approval · ${UNITS_COUNTED} units assigned · ${KIT_SUMMARY.flagged} flagged lines` },
    { at: new Date(NOW - 3.2 * 60000).toISOString(), actor: 'system', action: 'KIT_RECONCILED', subject: 'SES-9F4C21A8', tone: 'ok', detail: `gate ${CONFIDENCE_THRESHOLD} dBm · ${UNITS_COUNTED} units counted · ${RECON.moves.length} moves` },
    { at: new Date(NOW - 4 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 5', tone: 'neutral', detail: `${boxReadCounts[5]} reads accepted` },
    { at: new Date(NOW - 8 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 4', tone: 'neutral', detail: `${boxReadCounts[4]} reads accepted` },
    { at: new Date(NOW - 12 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 3', tone: 'neutral', detail: `${boxReadCounts[3]} reads accepted` },
    { at: new Date(NOW - 16 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 2', tone: 'neutral', detail: `${boxReadCounts[2]} reads accepted` },
    { at: new Date(NOW - 20 * 60000).toISOString(), actor: 'D. Okafor', action: 'BOX_READS_APPENDED', subject: 'SES-9F4C21A8 · box 1', tone: 'neutral', detail: `${boxReadCounts[1]} reads accepted` },
    { at: new Date(NOW - 27 * 60000).toISOString(), actor: 'D. Okafor', action: 'KIT_SESSION_OPENED', subject: 'KIT-2026-0824-03', tone: 'info', detail: `5 boxes · ${UNITS_PLANNED} units planned · TC22R-01 @ 20 dBm` },
    { at: new Date(NOW - 41 * 60000).toISOString(), actor: 'M. Reyes', action: 'CYCLE_COUNT_COMPLETED', subject: 'CNT-2026-0824-02', tone: 'ok', detail: '98.2% coverage → PASS · 11 stragglers' },
    { at: new Date(NOW - 74 * 60000).toISOString(), actor: 'D. Okafor', action: 'TAG_COMMISSIONED', subject: 'CMS-2026-0824-07', tone: 'ok', detail: '200 × FLW-3.5-BD bound and printed' },
    { at: new Date(NOW - 128 * 60000).toISOString(), actor: 'system', action: 'GATE_OVERRIDE', subject: 'SES-7B21D004', tone: 'warn', detail: 'gate set to -68 dBm for calibration — non-default, logged' },
    { at: new Date(NOW - 133 * 60000).toISOString(), actor: 'D. Okafor', action: 'TAG_COMMISSIONED', subject: 'CMS-2026-0824-06', tone: 'ok', detail: '150 × EDI-100-GUM bound and printed' },
    { at: new Date(NOW - 189 * 60000).toISOString(), actor: 'M. Reyes', action: 'COMMISSION_REJECTED_COLLISION', subject: 'CMS-2026-0824-05', tone: 'blocked', detail: `retailId ${COLLISION.value} already bound — 409, nothing printed` },
    { at: new Date(NOW - 189.4 * 60000).toISOString(), actor: 'M. Reyes', action: 'EPC_MINT_COLLISION', subject: 'CMS-2026-0824-05', tone: 'warn', detail: 'attempt 1 of 5 — re-minted, no batch replay' },
    { at: new Date(NOW - 260 * 60000).toISOString(), actor: 'M. Reyes', action: 'TAG_COMMISSIONED', subject: 'CMS-2026-0824-04', tone: 'ok', detail: '250 × PRE-1G-OGK bound and printed' },
  ];

  // ── Hardware ────────────────────────────────────────────────────────────
  const DEVICES = {
    reader: { id: 'TC22R-01', model: 'Zebra TC22R integrated handheld', os: 'Android 13',
      battery: 78, rfPower: 20, rfMin: 15, rfMax: 30, connection: 'WebView bridge', bridge: 'v0.4-contract',
      firmware: '11.09.03', screen: '5″ · 360 × 660 logical',
      lastRead: new Date(NOW - 3 * 60000).toISOString(), status: 'ok' },
    printer: { id: 'ZT411-01', model: 'Zebra ZT411 RFID printer', media: 'Vulcan Glint UHF · NXP UCODE 9xe',
      stockRemaining: 3214, stockTotal: 4000, status: 'ok', darkness: 27, speed: 4, headTemp: 41,
      ribbonRemaining: 0.48, lastCalibration: new Date(NOW - 3 * 86400000).toISOString(),
      lastPrint: new Date(NOW - 74 * 60000).toISOString() },
    gate: { value: CONFIDENCE_THRESHOLD, passCoverage: ROOM_PASS_COVERAGE },
    // The five things that are contract, not verified integration. These are
    // shown on screen because pretending otherwise is how a pilot ships broken.
    unverified: [
      { id: 'rssi', label: 'Per-read RSSI from the Zebra SDK', note: 'argmax needs an RSSI on every read. Confirm on a real TC22R.' },
      { id: 'power', label: 'Programmatic RF power control', note: 'Reduced power is half the isolation mechanism. DataWedge cannot provide it.' },
      { id: 'zpl', label: 'ZT411 label ZPL', note: 'Never printed on real Glint stock. Print one, read it back.' },
      { id: 'gate', label: '-62 dBm gate + power setpoint', note: 'Simulation-validated only. Calibrate before rollout.' },
      { id: 'metal', label: 'On-metal tag material', note: 'No on-metal stock was purchased. The column exists; the support does not.' },
    ],
  };

  const OPERATORS = [
    { id: 'op-do', name: 'D. Okafor', shift: '06:00 – 14:30', device: 'TC22R-01', activeSince: new Date(NOW - 27 * 60000).toISOString(), task: `Kit verification · Box ${KIT.liveBox}` },
    { id: 'op-mr', name: 'M. Reyes', shift: '08:00 – 16:30', device: 'TC22R-01', activeSince: new Date(NOW - 190 * 60000).toISOString(), task: 'Commissioning · CMS-…-05' },
  ];

  // Who is allowed to decide what, and why it sits there. This table is the
  // module's decision model in one place; the screens enforce it, the
  // "Handheld & desk" view renders it, and nothing else may contradict it.
  const DECISION_RIGHTS = [
    { decision: 'Read a box · walk a room', owner: 'Handheld', why: 'Only the device has the radio.' },
    { decision: 'Assign a tag to a box', owner: 'Module core', why: 'argmax-RSSI plus the −62 dBm gate. Not a human judgement.' },
    { decision: 'Confirm a physical move', owner: 'Handheld', why: 'The person holding the box ticks it off, one box at a time.' },
    { decision: 'Submit a kit for approval', owner: 'Handheld', why: 'The floor asserts what it read. It does not post it.' },
    { decision: 'Approve and post a kit', owner: 'Supervisor', why: 'A kit with exceptions must be accepted by a person.' },
    { decision: 'Reject a kit and re-scan', owner: 'Supervisor', why: 'Re-opening a session invalidates counts already written.' },
    { decision: 'Close a straggler as missing', owner: 'Supervisor', why: 'Shrink is an accounting decision, never a scan result.' },
    { decision: 'Rebind an EPC to a retail ID', owner: 'Supervisor', why: '1:1 is enforced at commissioning; overriding it writes an audit event.' },
    { decision: 'Change RF power or the gate', owner: 'Supervisor', why: 'Non-default gate values are written to the audit log.' },
  ];

  const STATE_LABEL = { correct: 'Correct', short: 'Short', excess: 'Excess', wrong: 'Wrong product', rescan: 'Rescan' };
  const STATE_TONE = { correct: 'ok', short: 'blocked', excess: 'warn', wrong: 'quarantine', rescan: 'info' };

  const fmtClock = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const fmtDur = (s) => Math.floor(s / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0');
  const shortEpc = (e) => `${e.slice(0, 8)}…${e.slice(-6)}`;

  window.RFID_DATA = {
    NOW, CONFIDENCE_THRESHOLD, ROOM_PASS_COVERAGE,
    SKUS, SKU_MAP, skuOf,
    KIT, KITS, KIT_SUMMARY, LINES, MOVE_GROUPS, UNRESOLVED, BOXES,
    COUNTS, LIVE_COUNT,
    COMMISSION_RUNS, LIVE_RUN, COLLISION, LAST_RUN_TAGS, LIVE_RUN_TAGS, ZPL_SAMPLE,
    REGISTRY, STATES, TAG_INVENTORY,
    AUDIT, DEVICES, OPERATORS, DECISION_RIGHTS,
    STATE_LABEL, STATE_TONE,
    fmtClock, fmtDur, shortEpc,
    reconcileKit, groupMoves, unresolvedShorts,
    // The engine's INPUTS, so a gate override can genuinely re-run it rather than
    // only relabelling the number. Without these, reconcileKit is exported but
    // uncallable against the real session — which is how the gate control ended up
    // looking like it worked while changing nothing.
    KIT_READS, SKU_OF, KIT_PLAN,
  };
})();
