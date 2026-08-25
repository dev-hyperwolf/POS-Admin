// ── Direction B — seeded fixtures ─────────────────────────────────────────
// Every number below is generated once from a fixed seed so the screens are
// stable across reloads. Shapes mirror the middleware's own types:
//   SkuLine { boxIndex, sku, planned, actual, delta }
//   MoveGroup { fromBox, totalUnits, items:[{ sku, toBox, qty }] }
//   RoomAuditResult { expected, uniqueFound, notLocated, coveragePct, verdict }
// Brand names come from window.HW_BRANDS — never written as literals.
;(function () {
  const B = window.HW_BRANDS.name;

  // deterministic PRNG so EPCs never shuffle between reloads
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(0x5A17D);
  const HEXCHARS = '0123456789ABCDEF';
  const hex = (n) => Array.from({ length: n }, () => HEXCHARS[Math.floor(rnd() * 16)]).join('');
  const mintEpc = () => 'E280' + hex(20);            // 24-hex closed-loop EPC

  // ── Catalog ─────────────────────────────────────────────────────────────
  const SKUS = [
    { sku: 'FLW-3.5-BLUEDREAM', name: 'Blue Dream 3.5g', brand: B.lowell, cat: 'flower', strain: 'Hybrid', thc: 24.6, unitCost: 12.40 },
    { sku: 'PRE-1G-OGKUSH', name: 'OG Kush Preroll 1g', brand: B.jeeter, cat: 'preroll', strain: 'Indica', thc: 28.1, unitCost: 3.85 },
    { sku: 'VAPE-1G-GELATO', name: 'Gelato Live Resin Cart 1g', brand: B.stiiizy, cat: 'vape', strain: 'Hybrid', thc: 82.4, unitCost: 18.60 },
    { sku: 'EDI-100MG-GUMMY', name: 'Raspberry Gummies 100mg', brand: B.wyld, cat: 'edibles', unitCost: 7.20 },
    { sku: 'CON-1G-LIVEROSIN', name: 'Live Rosin 1g', brand: B.labs710, cat: 'concentrate', unitCost: 26.00 },
  ];
  const bySku = {}; SKUS.forEach((s) => (bySku[s.sku] = s));

  // ── Kit KIT-2291 · five boxes, 700 units ────────────────────────────────
  // plan[boxIndex][sku] — box 5 is the concentrate/top-up box and is NOT
  // planned to carry gummies, which is what makes the wrong-product line real.
  const PLAN = {
    1: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 35, 'EDI-100MG-GUMMY': 30 },
    2: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 35, 'EDI-100MG-GUMMY': 30 },
    3: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 35, 'EDI-100MG-GUMMY': 30 },
    4: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 35, 'EDI-100MG-GUMMY': 30 },
    5: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 30, 'VAPE-1G-GELATO': 30, 'CON-1G-LIVEROSIN': 40 },
  };
  // actual[boxIndex][sku] — argmax-assigned counts, one EPC to exactly one box
  const ACTUAL = {
    1: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 37, 'EDI-100MG-GUMMY': 30 },
    2: { 'FLW-3.5-BLUEDREAM': 37, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 35, 'EDI-100MG-GUMMY': 30 },
    3: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 33, 'EDI-100MG-GUMMY': 30 },
    4: { 'FLW-3.5-BLUEDREAM': 43, 'PRE-1G-OGKUSH': 35, 'VAPE-1G-GELATO': 35, 'EDI-100MG-GUMMY': 26 },
    5: { 'FLW-3.5-BLUEDREAM': 40, 'PRE-1G-OGKUSH': 30, 'VAPE-1G-GELATO': 30, 'CON-1G-LIVEROSIN': 40, 'EDI-100MG-GUMMY': 2 },
  };

  function buildLines() {
    const lines = [];
    for (let b = 1; b <= 5; b++) {
      const keys = new Set([...Object.keys(PLAN[b]), ...Object.keys(ACTUAL[b])]);
      for (const sku of [...keys].sort()) {
        const planned = PLAN[b][sku] || 0;
        const actual = ACTUAL[b][sku] || 0;
        const delta = actual - planned;
        let state = 'correct';
        if (planned === 0 && actual > 0) state = 'wrong-product';
        else if (delta < 0) state = 'short';
        else if (delta > 0) state = 'excess';
        lines.push({ boxIndex: b, sku, planned, actual, delta, state });
      }
    }
    return lines;
  }
  const LINES = buildLines();

  // Product-level moves, grouped by SOURCE box (moveList.groupMoves shape).
  const MOVES = [
    { fromBox: 1, totalUnits: 2, items: [{ sku: 'VAPE-1G-GELATO', toBox: 3, qty: 2 }] },
    { fromBox: 4, totalUnits: 3, items: [{ sku: 'FLW-3.5-BLUEDREAM', toBox: 2, qty: 3 }] },
    { fromBox: 5, totalUnits: 2, items: [{ sku: 'EDI-100MG-GUMMY', toBox: 4, qty: 2 }] },
  ];

  // Two units whose strongest read never cleared the gate. No box asserted.
  const RESCAN = [
    { epc: mintEpc(), sku: 'EDI-100MG-GUMMY', bestRssi: -66.4, heardIn: [4, 5], note: 'Strongest read in Box 5, 4.4 dB under the gate' },
    { epc: mintEpc(), sku: 'EDI-100MG-GUMMY', bestRssi: -71.8, heardIn: [4], note: 'Single weak read — likely buried under the liner' },
  ];

  // Per-box scan telemetry from the session.
  const BOX_SCANS = [
    { boxIndex: 1, reads: 386, heard: 191, assigned: 142, seconds: 38, medianRssi: -48.6 },
    { boxIndex: 2, reads: 471, heard: 236, assigned: 137, seconds: 41, medianRssi: -49.2 },
    { boxIndex: 3, reads: 489, heard: 241, assigned: 138, seconds: 36, medianRssi: -47.9 },
    { boxIndex: 4, reads: 470, heard: 233, assigned: 139, seconds: 44, medianRssi: -50.1 },
    { boxIndex: 5, reads: 381, heard: 190, assigned: 142, seconds: 39, medianRssi: -46.8 },
  ];

  const KIT = {
    id: 'KIT-2291',
    run: 'Long Beach · Tue 25 Aug',
    entity: 'ccd',
    boxes: 5,
    plannedUnits: 700,
    packedBy: 'Rey Alcantara',
    stagedAt: 'Dock 3 · lane B',
    manualMinutes: 34,
    session: {
      id: 'RFS-2291-04',
      device: 'TC22R-01',
      firmware: '2.14.0',
      battery: 78,
      powerDbm: 20,
      gateDbm: -62,
      startedAt: '09:41',
      finishedAt: '09:44',
      totalReads: 2197,
      located: 698,
      operator: 'Rey Alcantara',
    },
    // Telemetry only — never acted on. What naive per-box counting would claim.
    antiPattern: { physicalUnits: 700, argmaxUnits: 698, naiveUnits: 1091, inflation: 1.56, phantomAvoided: 393 },
  };

  // ── Cycle count · Back of house, Long Beach ─────────────────────────────
  const INVENTORY = [
    { product: 'Blue Dream 3.5g', brand: B.lowell, sku: 'FLW-3.5-BLUEDREAM', cat: 'flower', loc: 'boh', units: 128, found: 126, batches: 2, unitCost: 12.40, expiryDays: 118 },
    { product: 'OG Kush Preroll 1g', brand: B.jeeter, sku: 'PRE-1G-OGKUSH', cat: 'preroll', loc: 'boh', units: 96, found: 96, batches: 1, unitCost: 3.85, expiryDays: 74 },
    { product: 'Gelato Live Resin Cart 1g', brand: B.stiiizy, sku: 'VAPE-1G-GELATO', cat: 'vape', loc: 'foh', units: 84, found: 82, batches: 2, unitCost: 18.60, expiryDays: 203 },
    { product: 'Raspberry Gummies 100mg', brand: B.wyld, sku: 'EDI-100MG-GUMMY', cat: 'edibles', loc: 'boh', units: 72, found: 72, batches: 1, unitCost: 7.20, expiryDays: 26 },
    { product: 'Live Rosin 1g', brand: B.labs710, sku: 'CON-1G-LIVEROSIN', cat: 'concentrate', loc: 'boh', units: 40, found: 39, batches: 1, unitCost: 26.00, expiryDays: 151 },
    { product: 'Terra Bites Espresso 100mg', brand: B.kiva, sku: 'EDI-100MG-TERRA', cat: 'edibles', loc: 'boh', units: 66, found: 63, batches: 1, unitCost: 8.10, expiryDays: 12 },
    { product: 'Blood Orange Cardamom 6-pack', brand: B.cann, sku: 'BEV-6PK-BLOODORANGE', cat: 'wellness', loc: 'foh', units: 58, found: 58, batches: 1, unitCost: 9.45, expiryDays: 88 },
    { product: 'OG Kush Cartridge 1g', brand: B.heavy, sku: 'VAPE-1G-OGKUSH', cat: 'vape', loc: 'foh', units: 68, found: 68, batches: 1, unitCost: 16.90, expiryDays: 244 },
  ];

  const STRAGGLERS = [
    { epc: mintEpc(), product: 'Terra Bites Espresso 100mg', brand: B.kiva, cause: 'Foil-lined pouch', shelf: 'BOH · R4-C2' },
    { epc: mintEpc(), product: 'Terra Bites Espresso 100mg', brand: B.kiva, cause: 'Foil-lined pouch', shelf: 'BOH · R4-C2' },
    { epc: mintEpc(), product: 'Terra Bites Espresso 100mg', brand: B.kiva, cause: 'Foil-lined pouch', shelf: 'BOH · R4-C2' },
    { epc: mintEpc(), product: 'Gelato Live Resin Cart 1g', brand: B.stiiizy, cause: 'Stacked dense', shelf: 'FOH · display 2' },
    { epc: mintEpc(), product: 'Gelato Live Resin Cart 1g', brand: B.stiiizy, cause: 'Stacked dense', shelf: 'FOH · display 2' },
    { epc: mintEpc(), product: 'Blue Dream 3.5g', brand: B.lowell, cause: 'Mylar bag, back of shelf', shelf: 'BOH · R1-C5' },
    { epc: mintEpc(), product: 'Blue Dream 3.5g', brand: B.lowell, cause: 'Mylar bag, back of shelf', shelf: 'BOH · R1-C5' },
    { epc: mintEpc(), product: 'Live Rosin 1g', brand: B.labs710, cause: 'Glass jar in a metal rack', shelf: 'BOH · vault' },
  ];

  const CYCLE = {
    room: 'Back of house · Long Beach',
    expected: 612,
    uniqueFound: 604,
    notLocated: 8,
    coveragePct: 98.7,
    verdict: 'PASS',
    passBar: 98,
    operators: 3,
    reads: 4918,
    duration: '11m 20s',
    ranAt: 'today 07:12',
    lastManualCount: 41,          // days since the last clipboard count
    manualHours: 6,
  };

  // ── Commissioning · batch b-2291 ────────────────────────────────────────
  const BATCH_TAG_ROWS = Array.from({ length: 6 }, (_, i) => ({
    retailId: 'R-FLW35-BD-' + String(141 + i).padStart(6, '0'),
    epc: mintEpc(),
    state: 'AVAILABLE',
  }));

  const COLLISIONS = [
    { retailId: 'R-FLW35-BD-000138', epc: mintEpc(), boundAt: '18 Aug · 14:22', boundBy: 'Rey Alcantara', auditId: 'AE-88213' },
    { retailId: 'R-FLW35-BD-000139', epc: mintEpc(), boundAt: '18 Aug · 14:22', boundBy: 'Rey Alcantara', auditId: 'AE-88214' },
  ];

  const BATCHES = [
    { id: 'b-2291', metrc: '1A4060300012345670000A9C3F', product: 'Blue Dream 3.5g', brand: B.lowell, sku: 'FLW-3.5-BLUEDREAM', cat: 'flower', qty: 200, unitCost: 12.40, received: '22 Aug', status: 'approved', tagged: 0, coa: 'passed' },
    { id: 'b-2288', metrc: '1A4060300012345670000B1E27', product: 'Blue Dream 3.5g', brand: B.lowell, sku: 'FLW-3.5-BLUEDREAM', cat: 'flower', qty: 160, unitCost: 12.10, received: '14 Aug', status: 'approved', tagged: 160, coa: 'passed' },
    { id: 'b-2274', metrc: '1A4060300012345670000C7F91', product: 'Blue Dream 3.5g', brand: B.lowell, sku: 'FLW-3.5-BLUEDREAM', cat: 'flower', qty: 120, unitCost: 11.95, received: '02 Aug', status: 'approved', tagged: 120, coa: 'passed' },
  ];

  const PRINTER = {
    name: 'ZT411-DOCK3',
    model: 'Zebra ZT411 RFID',
    media: 'Vulcan Glint UHF · NXP UCODE 9xe',
    size: '4.00 × 2.00 in',
    stockRemaining: 3608,
    stockTotal: 4000,
    status: 'ready',
    lastCalibrated: '19 Aug',
  };

  window.RFID_DATA = {
    SKUS, bySku, PLAN, ACTUAL, LINES, MOVES, RESCAN, BOX_SCANS, KIT,
    INVENTORY, STRAGGLERS, CYCLE, BATCHES, BATCH_TAG_ROWS, COLLISIONS, PRINTER,
    lineCounts: {
      correct: LINES.filter((l) => l.state === 'correct').length,
      short: LINES.filter((l) => l.state === 'short').length,
      excess: LINES.filter((l) => l.state === 'excess').length,
      wrongProduct: LINES.filter((l) => l.state === 'wrong-product').length,
      rescan: RESCAN.length,
      moves: MOVES.reduce((n, g) => n + g.items.length, 0),
    },
  };
})();
