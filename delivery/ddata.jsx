// ── Delivery module data — counties → sub-regions, central settings + overrides,
//    schematic KML geometry + buffer zones, week schedule, and call-offs.
// Reuses ROSTER / colors from window.TDATA where useful.

// Parent regions (counties). Central settings cascade to every sub-region
// unless the sub-region overrides a field.
const COUNTIES = [
  { id: 'RC', name: 'Riverside County',       color: '#3F73D6', settings: { open: '9:00a', close: '9:00p', min: 50, fee: 5, buffer: 3 } },
  { id: 'SB', name: 'San Bernardino County',  color: '#2FA59B', settings: { open: '9:00a', close: '9:00p', min: 50, fee: 5, buffer: 3 } },
  { id: 'OC', name: 'Orange County',          color: '#D98316', settings: { open: '10:00a', close: '10:00p', min: 60, fee: 0, buffer: 2 } },
  { id: 'LA', name: 'Los Angeles County',     color: '#8A5CD6', settings: { open: '9:00a', close: '11:00p', min: 60, fee: 5, buffer: 4 } },
];
const COUNTY_BY_ID = Object.fromEntries(COUNTIES.map((c) => [c.id, c]));

// Sub-regions with schematic polygons (viewBox 1000×640, SoCal-ish layout).
// override: only the fields that differ from the county central settings.
const SUBREGIONS = [
  { id: 'LA-01', county: 'LA', city: 'Pomona',        driver: 'Kofi Mensah',  status: 'on', kml: true,  pts: [[236,168],[338,150],[372,214],[330,286],[244,278],[210,220]], override: {} },
  { id: 'LA-02', county: 'LA', city: 'Claremont',     driver: 'Elena Ruiz',   status: 'on', kml: true,  pts: [[344,120],[452,132],[470,196],[420,244],[352,224],[330,166]], override: { min: 75 } },
  { id: 'SB-01', county: 'SB', city: 'Fontana',       driver: 'Carlos Diaz',  status: 'on', kml: true,  pts: [[458,112],[576,120],[602,190],[548,244],[470,232],[442,168]], override: {} },
  { id: 'SB-02', county: 'SB', city: 'Ontario',       driver: 'Ivy Chen',     status: 'on', kml: true,  pts: [[392,224],[498,214],[532,272],[486,330],[404,320],[372,266]], override: { fee: 3 } },
  { id: 'OC-01', county: 'OC', city: 'Yorba Linda',   driver: 'Tara Shah',    status: 'on', kml: true,  pts: [[258,318],[372,308],[402,372],[356,432],[276,424],[236,366]], override: {} },
  { id: 'OC-02', county: 'OC', city: 'Brea',          driver: 'Noah Klein',   status: 'off', kml: true, pts: [[196,382],[298,372],[326,432],[286,492],[210,486],[178,428]], override: { close: '9:00p' } },
  { id: 'RC-01', county: 'RC', city: 'Temecula',      driver: 'Theo Reyes',   status: 'on', kml: true,  pts: [[528,432],[648,420],[688,486],[644,556],[548,552],[506,486]], override: {} },
  { id: 'RC-02', county: 'RC', city: 'Corona',        driver: 'Sam Okoro',    status: 'on', kml: true,  pts: [[470,300],[588,292],[614,356],[566,412],[486,402],[452,344]], override: { fee: 7 } },
  { id: 'RC-03', county: 'RC', city: 'Moreno Valley', driver: 'Dev Anand',    status: 'on', kml: false, pts: [[624,252],[792,244],[842,318],[788,388],[652,380],[606,312]], override: {} },
];

// merge central + override → effective settings for a sub-region
function effSettings(sr) {
  const base = COUNTY_BY_ID[sr.county].settings;
  return { ...base, ...sr.override };
}
function overriddenKeys(sr) { return Object.keys(sr.override || {}); }

// ── Region kit stock — DEMO DATA ────────────────────────────────────────────
// A region IS a van: one kit, one driver, fixed for the day. That is why this
// lives next to SUBREGIONS and is keyed by region id rather than by driver.
//
// Once an order is assigned, the only products that can replace a line are the
// ones physically in THAT van. Regional availability is irrelevant — another
// driver having it does not help the customer standing in front of this one.
// So this table is the candidate pool for every post-submission swap.
//
// ⚠️ DEMO DATA — no number below came from a real van. It stands in for the
// Hyperdrive POS inventory-room feed (the Blaze region rooms RC.., SB.., OC..,
// LA..) that will eventually supply it. Replace the body of buildRegionStock,
// not its shape, when that feed lands.
//
// Deterministic on purpose — the same sku-hash trick mobile/data.jsx's boxOf
// uses — so a reload never reshuffles a van and a screenshot stays reproducible.
// Every region carries a DIFFERENT subset, which is the entire point: a van does
// not have everything, and a ladder that pretends otherwise offers the customer
// stock nobody can hand over.

// Order-sensitive rolling hash. mobile/data.jsx's boxOf sums char codes, which
// is fine there; here it is not, because the SUM of 'SB-01' and of 'RC-01' is
// the same number — two counties would load identical vans.
const _stockHash = (s) => {
  let h = 7;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
  return h;
};

// Minutes since the inventory room signed each van out. Kit counts move on every
// drop-off, so stale data offers what is already gone; the engine flags anything
// older than its freshness window. RC-03 is deliberately stale so that path is
// exercised by real data rather than only by a test fixture.
const REGION_STOCK_AGE_MIN = {
  'LA-01': 4, 'LA-02': 6, 'SB-01': 3, 'SB-02': 8,
  'OC-01': 5, 'OC-02': 7, 'RC-01': 2, 'RC-02': 9, 'RC-03': 47,
};

// Units one van holds of one sku. 0 means "not loaded on this van today" — and
// roughly a third of the catalogue is 0 for any given region, which is what
// makes the subsets differ.
//
// Region and sku are hashed as ONE string. A plain `hash(sku) + hash(regionId)
// * k` looks well mixed and is not: `% 3` of it collapses to
// `hash(regionId) * k % 3`, which is constant per region, so all nine vans came
// out with three distinct subsets between them — the opposite of what this
// table exists to demonstrate. Both mistakes were made here before this comment
// was written; the check that catches them is in test/governance.test.mjs.
function _kitUnits(regionId, sku) {
  const h = _stockHash(regionId + '|' + sku);
  return h % 3 === 0 ? 0 : 1 + (h % 6);
}

// regionId -> { regionId, driver, ageMin, units:{ sku: units } }
// Built over the live catalogue so a van can never carry a sku the store does
// not sell. window.HW is loaded before this file on every entry HTML; the empty
// fallback degrades to "no kit" rather than inventing stock.
function buildRegionStock(catalogue) {
  const out = {};
  for (const sr of SUBREGIONS) {
    const units = {};
    for (const p of (catalogue || [])) {
      const n = _kitUnits(sr.id, p.sku);
      if (n > 0) units[p.sku] = n;
    }
    out[sr.id] = { regionId: sr.id, driver: sr.driver, ageMin: REGION_STOCK_AGE_MIN[sr.id] || 5, units };
  }
  return out;
}
const REGION_STOCK = buildRegionStock(window.HW ? window.HW.PRODUCTS : []);
function stockFor(regionId) { return REGION_STOCK[regionId] || null; }

// ── geometry helpers — centroid + outward-expanded buffer polygon ───────────
function centroid(pts) { const n = pts.length; let x = 0, y = 0;pts.forEach((p) => {x += p[0];y += p[1];});return [x / n, y / n]; }
function toPath(pts) { return 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z'; }
// expand polygon outward from its centroid — buffer miles → scale factor.
function bufferPath(pts, miles) {
  const [cx, cy] = centroid(pts);const k = 1 + (miles || 3) * 0.028;
  return toPath(pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]));
}

// ── Schedule — synced from ConnecTeam, full week (Mon–Sun) ──────────────────
const DRIVERS = (window.TDATA ? window.TDATA.ROSTER : []).filter((p) => p.role === 'driver');
const WEEK = [
  { key: 'mon', label: 'Mon', date: 'Jul 13' }, { key: 'tue', label: 'Tue', date: 'Jul 14', today: true },
  { key: 'wed', label: 'Wed', date: 'Jul 15' }, { key: 'thu', label: 'Thu', date: 'Jul 16' },
  { key: 'fri', label: 'Fri', date: 'Jul 17' }, { key: 'sat', label: 'Sat', date: 'Jul 18' },
  { key: 'sun', label: 'Sun', date: 'Jul 19' },
];
const SHIFTS = ['9:00a–5:00p', '10:00a–6:00p', '11:00a–7:00p', '12:00p–8:00p', '2:00p–10:00p'];
const SUB_IDS = SUBREGIONS.map((s) => s.id);
// deterministic weekly roster per day index
function scheduleForDay(di) {
  return DRIVERS.map((p, i) => {
    const off = (i + di * 2) % 6 === 0;
    if (off) return { name: p.name, off: true };
    return { name: p.name, off: false, time: SHIFTS[(i + di) % SHIFTS.length], region: SUB_IDS[(i * 2 + di) % SUB_IDS.length] };
  });
}
const SCHEDULE_WK = Object.fromEntries(WEEK.map((d, i) => [d.key, scheduleForDay(i)]));

// ── Call-offs — a scheduled driver who called off (via the call-off form) ───
// Surfaces prominently on the schedule. status: open (needs cover) | covered.
const CALLOFFS = [
  { day: 'tue', driver: 'Maya Cole',   region: 'RC-02', shift: '10:00a–6:00p', reason: 'Sick', at: '7:42 AM', status: 'open',    cover: null },
  { day: 'tue', driver: 'Grace Kim',   region: 'SB-01', shift: '11:00a–7:00p', reason: 'Car trouble', at: '8:15 AM', status: 'covered', cover: 'Jordan Vu' },
  { day: 'wed', driver: 'Nina Patel',  region: 'OC-01', shift: '9:00a–5:00p',  reason: 'Family emergency', at: 'Yesterday 6:10 PM', status: 'open', cover: null },
];

window.DDATA = { COUNTIES, COUNTY_BY_ID, SUBREGIONS, effSettings, overriddenKeys, centroid, toPath, bufferPath, WEEK, SCHEDULE_WK, CALLOFFS, DRIVERS,
  REGION_STOCK, REGION_STOCK_AGE_MIN, stockFor, buildRegionStock };
