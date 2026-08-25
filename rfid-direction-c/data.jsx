// ── RFID Direction C — seeded fixtures + pure domain helpers ───────────────
// Everything on both surfaces is generated here from one fixed seed, so the
// handheld and the supervisor desktop are always looking at the SAME session.
// No colors live in this file. Brand names come from shared/brands.js only.
;(function () {
  const NOW = new Date('2026-08-24T15:42:00-07:00').getTime();

  // Deterministic PRNG — every run of the page shows the identical session.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const HEXD = '0123456789ABCDEF';
  // 96-bit closed-loop EPC (NOT SGTIN-96 — see commissioning/epc.ts). 24 hex chars.
  function epcAt(i) {
    const r = mulberry32(910000 + i * 7);
    let s = 'E2801170';
    for (let k = 0; k < 16; k++) s += HEXD[Math.floor(r() * 16)];
    return s;
  }

  const BR = window.HW_BRANDS;
  const bn = (k) => (BR && BR.name[k]) || k;

  // The five SKUs in this kit. `cat` keys straight into P.cat.
  const SKUS = [
    { sku: 'FLW-3.5-BLUEDREAM',  name: 'Blue Dream 3.5g',            brand: bn('lowell'),  cat: 'flower',      unit: 'jar'  },
    { sku: 'PRE-1G-OGKUSH',      name: 'Baby Cannon OG Kush 1g',     brand: bn('jeeter'),  cat: 'preroll',     unit: 'tube' },
    { sku: 'VAP-1G-GELATO',      name: 'Gelato Pod 1g',              brand: bn('stiiizy'), cat: 'vape',        unit: 'pod'  },
    { sku: 'EDI-100MG-GUMMY',    name: 'Raspberry Gummies 100mg',    brand: bn('wyld'),    cat: 'edibles',     unit: 'tin'  },
    { sku: 'CON-1G-LIVEROSIN',   name: 'Live Rosin 1g',              brand: bn('labs710'), cat: 'concentrate', unit: 'jar'  },
  ];
  const SKU_BY_ID = {}; SKUS.forEach((s) => { SKU_BY_ID[s.sku] = s; });

  // ── The kit ───────────────────────────────────────────────────────────────
  // 5 boxes × 140 planned units = 700. The distribution plan already lives in
  // the host DB; the module reads it through PlanProvider and never writes it.
  const KIT = {
    id: 'KIT-2026-0824-03',
    route: 'Route 12 · West Hollywood → Corona',
    boxCount: 5,
    plannedUnits: 700,
    openedAt: NOW - 41 * 60000,
    gate: -62,        // dBm — CONFIDENCE_THRESHOLD
    power: 20,        // dBm — reduced power setpoint
    reader: 'TC22R-01',
    device: 'Zebra TC22R',
  };

  const PLAN = {
    1: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 30, 'VAP-1G-GELATO': 30, 'EDI-100MG-GUMMY': 40 },
    2: { 'FLW-3.5-BLUEDREAM': 45, 'PRE-1G-OGKUSH': 25, 'VAP-1G-GELATO': 30, 'EDI-100MG-GUMMY': 40 },
    3: { 'FLW-3.5-BLUEDREAM': 30, 'PRE-1G-OGKUSH': 30, 'VAP-1G-GELATO': 40, 'EDI-100MG-GUMMY': 20, 'CON-1G-LIVEROSIN': 20 },
    4: { 'FLW-3.5-BLUEDREAM': 30, 'PRE-1G-OGKUSH': 35, 'VAP-1G-GELATO': 25, 'EDI-100MG-GUMMY': 25, 'CON-1G-LIVEROSIN': 25 },
    5: { 'FLW-3.5-BLUEDREAM': 25, 'PRE-1G-OGKUSH': 25, 'VAP-1G-GELATO': 30, 'EDI-100MG-GUMMY': 30, 'CON-1G-LIVEROSIN': 30 },
  };
  // What the argmax pass actually assigned to each box. Planted defects:
  //   box 4 +3 FLW  ↔  box 2 −3 FLW      → one clean rebalance move
  //   box 1 +2 CON (wrong-product)  ↔  box 5 −2 CON → second move
  //   box 3 −4 VAP  with no surplus anywhere → kit shortfall, no move possible
  //   box 5 +1 PRE  with no shortfall anywhere → kit overage, no move possible
  const ACTUAL = {
    1: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 30, 'VAP-1G-GELATO': 30, 'EDI-100MG-GUMMY': 40, 'CON-1G-LIVEROSIN': 2 },
    2: { 'FLW-3.5-BLUEDREAM': 42, 'PRE-1G-OGKUSH': 25, 'VAP-1G-GELATO': 30, 'EDI-100MG-GUMMY': 40 },
    3: { 'FLW-3.5-BLUEDREAM': 30, 'PRE-1G-OGKUSH': 30, 'VAP-1G-GELATO': 36, 'EDI-100MG-GUMMY': 20, 'CON-1G-LIVEROSIN': 20 },
    4: { 'FLW-3.5-BLUEDREAM': 33, 'PRE-1G-OGKUSH': 35, 'VAP-1G-GELATO': 25, 'EDI-100MG-GUMMY': 25, 'CON-1G-LIVEROSIN': 25 },
    5: { 'FLW-3.5-BLUEDREAM': 25, 'PRE-1G-OGKUSH': 26, 'VAP-1G-GELATO': 30, 'EDI-100MG-GUMMY': 30, 'CON-1G-LIVEROSIN': 28 },
  };

  // ── Pure reconciliation (mirrors reconciliation/engine.ts line states) ─────
  function lines() {
    const out = [];
    for (let b = 1; b <= KIT.boxCount; b++) {
      const p = PLAN[b] || {}, a = ACTUAL[b] || {};
      const skus = Object.keys(Object.assign({}, p, a));
      skus.sort((x, y) => SKUS.findIndex((s) => s.sku === x) - SKUS.findIndex((s) => s.sku === y));
      for (const sku of skus) {
        const planned = p[sku] || 0, actual = a[sku] || 0, delta = actual - planned;
        const state = planned === 0 && actual > 0 ? 'wrong'
          : delta < 0 ? 'short'
          : delta > 0 ? 'excess'
          : 'correct';
        out.push({ boxIndex: b, sku, planned, actual, delta, state });
      }
    }
    return out;
  }
  const LINES = lines();

  // Fungible product-level matching: surplus (excess + wrong-product) fills
  // shortfall of the same SKU. Anything left over cannot be solved by moving.
  function solve() {
    const moves = [], unresolved = [];
    for (const s of SKUS) {
      const sur = LINES.filter((l) => l.sku === s.sku && l.delta > 0).map((l) => ({ box: l.boxIndex, qty: l.delta }));
      const def = LINES.filter((l) => l.sku === s.sku && l.delta < 0).map((l) => ({ box: l.boxIndex, qty: -l.delta }));
      let i = 0, j = 0;
      while (i < sur.length && j < def.length) {
        const q = Math.min(sur[i].qty, def[j].qty);
        moves.push({ sku: s.sku, fromBox: sur[i].box, toBox: def[j].box, qty: q });
        sur[i].qty -= q; def[j].qty -= q;
        if (sur[i].qty === 0) i++;
        if (def[j].qty === 0) j++;
      }
      sur.slice(i).forEach((x) => x.qty > 0 && unresolved.push({ sku: s.sku, boxIndex: x.box, qty: x.qty, kind: 'overage' }));
      def.slice(j).forEach((x) => x.qty > 0 && unresolved.push({ sku: s.sku, boxIndex: x.box, qty: x.qty, kind: 'shortfall' }));
    }
    return { moves, unresolved };
  }
  const SOLVED = solve();

  // Grouped by SOURCE box — an operator works one box at a time.
  function groupMoves(moves) {
    const by = {};
    moves.forEach((m) => { (by[m.fromBox] = by[m.fromBox] || []).push(m); });
    return Object.keys(by).map(Number).sort((a, b) => a - b).map((fromBox) => {
      const items = by[fromBox].slice().sort((a, b) => a.toBox - b.toBox || a.sku.localeCompare(b.sku));
      return { fromBox, totalUnits: items.reduce((n, i) => n + i.qty, 0), items };
    });
  }
  const MOVE_GROUPS = groupMoves(SOLVED.moves);

  // Tags whose strongest read fell below the gate. No location asserted, no move.
  const RESCAN = [
    { epc: epcAt(4101), sku: 'VAP-1G-GELATO',      bestRssi: -64.8, bestBox: 3, reason: 'Below gate on every box' },
    { epc: epcAt(4102), sku: 'EDI-100MG-GUMMY',    bestRssi: -67.1, bestBox: 5, reason: 'Below gate on every box' },
  ];
  const UNKNOWN_EPCS = [{ epc: epcAt(4103), bestRssi: -51.2, bestBox: 2 }];

  // Per-box scan telemetry. ONE reader exists, so boxes are scanned in sequence.
  const BOXES = [
    { i: 1, state: 'done',     unique: 142, reads: 431, bleedRejected: 88,  seconds: 34, avgRssi: -48.2, operator: 'M. Delgado', at: NOW - 33 * 60000 },
    { i: 2, state: 'done',     unique: 137, reads: 402, bleedRejected: 104, seconds: 31, avgRssi: -47.6, operator: 'M. Delgado', at: NOW - 27 * 60000 },
    { i: 3, state: 'scanning', unique: 136, reads: 388, bleedRejected: 96,  seconds: 29, avgRssi: -49.1, operator: 'M. Delgado', at: NOW - 21 * 60000 },
    { i: 4, state: 'done',     unique: 143, reads: 447, bleedRejected: 121, seconds: 36, avgRssi: -46.9, operator: 'R. Okafor',  at: NOW - 14 * 60000 },
    { i: 5, state: 'done',     unique: 139, reads: 419, bleedRejected: 93,  seconds: 33, avgRssi: -48.8, operator: 'R. Okafor',  at: NOW - 6 * 60000 },
  ];

  const totalActual = BOXES.reduce((n, b) => n + b.unique, 0);
  const KIT_SUMMARY = {
    planned: KIT.plannedUnits,
    assigned: totalActual,
    rescan: RESCAN.length,
    unknown: UNKNOWN_EPCS.length,
    scanned: totalActual + RESCAN.length + UNKNOWN_EPCS.length,
    correct: LINES.filter((l) => l.state === 'correct').length,
    short: LINES.filter((l) => l.state === 'short').length,
    excess: LINES.filter((l) => l.state === 'excess').length,
    wrong: LINES.filter((l) => l.state === 'wrong').length,
    // Telemetry only — never acted on. What a naive "count it in every box it
    // was read in" method would have invented as phantom overage.
    phantomUnitsAvoided: BOXES.reduce((n, b) => n + b.bleedRejected, 0),
    verdict: 'REVIEW',
    moves: SOLVED.moves.reduce((n, m) => n + m.qty, 0),
  };

  // ── Cycle count (roomAudit) ───────────────────────────────────────────────
  const ROOMS = [
    {
      id: 'RM-PACK-A', name: 'Packing Room A', expected: 612, found: 601, coverage: 98.2,
      verdict: 'PASS', operator: 'M. Delgado', passes: 2, minutes: 11, at: NOW - 52 * 60000,
    },
    {
      id: 'RM-VAULT-B', name: 'Vault B', expected: 488, found: 472, coverage: 96.7,
      verdict: 'REVIEW', operator: 'R. Okafor', passes: 1, minutes: 8, at: NOW - 96 * 60000,
    },
    {
      id: 'RM-STAGE-C', name: 'Staging C', expected: 240, found: 240, coverage: 100,
      verdict: 'PASS', operator: 'M. Delgado', passes: 1, minutes: 4, at: NOW - 140 * 60000,
    },
  ];
  const STRAG_CAUSE = ['Foil-lined pouch', 'Stacked dense', 'Behind metal shelf', 'Mylar overwrap'];
  const STRAGGLERS = Array.from({ length: 11 }).map((_, i) => {
    const r = mulberry32(7700 + i);
    const s = SKUS[Math.floor(r() * SKUS.length)];
    return {
      epc: epcAt(5200 + i), sku: s.sku, name: s.name, brand: s.brand, cat: s.cat,
      lastSeen: NOW - (2 + Math.floor(r() * 40)) * 3600000,
      cause: STRAG_CAUSE[Math.floor(r() * STRAG_CAUSE.length)],
      shelf: 'A-' + (2 + Math.floor(r() * 8)) + '-' + (1 + Math.floor(r() * 4)),
    };
  });

  // Live walk state used by the handheld "walking" screen.
  const WALK = { room: ROOMS[0], elapsed: 386, zone: 'Aisle 3 of 5', uniqueSoFar: 601, readsSoFar: 2148 };

  // ── Tag commissioning ─────────────────────────────────────────────────────
  const RUN = {
    id: 'RUN-2026-0824-11', sku: 'FLW-3.5-BLUEDREAM', packageId: 'PKG-1A4060300012345670000A9C',
    qty: 250, printed: 187, verified: 186, voided: 1, collisions: 1,
    printer: 'ZT411-01', operator: 'R. Okafor',
    startedAt: NOW - 9 * 60000, labelsPerMin: 22,
  };
  const PRINTER = {
    id: 'ZT411-01', state: 'online', stock: 'Vulcan Glint · NXP UCODE 9xe',
    darkness: 27, speed: 4, mediaRemaining: 0.62,
    ribbonRemaining: 0.48, headTemp: 41, lastCalibration: NOW - 3 * 86400000,
    warning: 'The ZPL template has never been run on a real ZT411. Print one label on the real Glint stock and read it back before any production run.',
  };
  const COLLISION = {
    retailId: 'R-FLW-3.5-BLUEDREAM-004412',
    incomingEpc: epcAt(8801),
    boundEpc: epcAt(1204),
    boundAt: NOW - 19 * 86400000,
    boundBy: 'M. Delgado',
    auditEventId: 'AE-2026-0824-00417',
    status: '409 COLLISION',
  };
  const RECENT_RUNS = [
    { id: 'RUN-2026-0824-11', sku: 'FLW-3.5-BLUEDREAM',  qty: 250, done: 187, state: 'running',  at: NOW - 9 * 60000,  collisions: 1 },
    { id: 'RUN-2026-0824-10', sku: 'VAP-1G-GELATO',      qty: 400, done: 400, state: 'complete', at: NOW - 74 * 60000, collisions: 0 },
    { id: 'RUN-2026-0823-09', sku: 'EDI-100MG-GUMMY',    qty: 320, done: 320, state: 'complete', at: NOW - 26 * 3600000, collisions: 0 },
    { id: 'RUN-2026-0823-08', sku: 'PRE-1G-OGKUSH',      qty: 500, done: 496, state: 'complete', at: NOW - 31 * 3600000, collisions: 2 },
    { id: 'RUN-2026-0822-07', sku: 'CON-1G-LIVEROSIN',   qty: 180, done: 180, state: 'complete', at: NOW - 50 * 3600000, collisions: 0 },
  ];
  const TAG_INVENTORY = { purchased: 4000, commissioned: 1583, remaining: 2417, kitsRemaining: 3 };

  // ── Operators / devices ───────────────────────────────────────────────────
  const OPERATORS = [
    { id: 'op-md', name: 'M. Delgado', initials: 'MD', shift: '06:00 – 14:30', device: 'TC22R-01', activeSince: NOW - 41 * 60000, task: 'Kit verification · Box 3' },
    { id: 'op-ro', name: 'R. Okafor',  initials: 'RO', shift: '08:00 – 16:30', device: 'TC22R-01', activeSince: NOW - 9 * 60000,  task: 'Commissioning · RUN-…-11' },
  ];
  const DEVICES = [
    { id: 'TC22R-01', model: 'Zebra TC22R', battery: 0.68, rf: 20, state: 'in use', by: 'M. Delgado', firmware: '11.09.03' },
  ];

  // Human-facing line-state vocabulary — one place, both surfaces.
  const STATE_LABEL = { correct: 'Correct', short: 'Short', excess: 'Excess', wrong: 'Wrong product', rescan: 'Rescan' };
  const STATE_TONE  = { correct: 'ok', short: 'blocked', excess: 'warn', wrong: 'quarantine', rescan: 'info' };

  const fmtClock = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const fmtDur = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const skuOf = (id) => SKU_BY_ID[id] || { sku: id, name: id, brand: '', cat: 'other', unit: 'unit' };
  const shortEpc = (e) => e.slice(0, 8) + '…' + e.slice(-6);

  window.RFID = {
    NOW, KIT, PLAN, ACTUAL, SKUS, SKU_BY_ID, LINES, MOVE_GROUPS, UNRESOLVED: SOLVED.unresolved,
    RESCAN, UNKNOWN_EPCS, BOXES, KIT_SUMMARY,
    ROOMS, STRAGGLERS, WALK,
    RUN, PRINTER, COLLISION, RECENT_RUNS, TAG_INVENTORY,
    OPERATORS, DEVICES, STATE_LABEL, STATE_TONE,
    fmtClock, fmtDur, skuOf, shortEpc, epcAt,
  };
})();
