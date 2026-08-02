// ── Hyperdrive Logistics — live dispatch data + primitives ──────────────────
// Snapshot pinned at NOW = Jul 20 2026, 7:52 PM. Real region codes (from Buffer
// Spillover Rules) + real driver names (from the roster screenshots). SLA 90m,
// buffer 10m, risk thresholds OK≥.85 / BAD<.70 (from Routing Config).
const useP = window.useP;
const CC = { RC: '#3F73D6', SB: '#2FA59B', OC: '#D98316', LA: '#8A5CD6' };

const NOW = '7:52 PM';
const CFG = { sla: 90, buffer: 10, ok: 0.85, bad: 0.70 };

// ── Regions ─────────────────────────────────────────────────────────────────
const REGIONS = [
  { code: 'RC5', city: 'Redlands',      county: 'RC' },
  { code: 'RC4', city: 'Corona',        county: 'RC' },
  { code: 'RC3', city: 'Moreno Valley', county: 'RC' },
  { code: 'RC1', city: 'Temecula',      county: 'RC' },
  { code: 'RC2', city: 'Lake Elsinore', county: 'RC' },
  { code: 'RC8', city: 'Floater',       county: 'RC' },
  { code: 'SB1', city: 'Fontana',       county: 'SB' },
  { code: 'SB2', city: 'North Rancho',  county: 'SB' },
  { code: 'SB3', city: 'San Dimas',     county: 'SB' },
];
const REGION_BY_CODE = Object.fromEntries(REGIONS.map((r) => [r.code, r]));
const regionColor = (code) => CC[(REGION_BY_CODE[code] || {}).county] || '#7E7E74';
const regionLabel = (code) => code + ' ' + ((REGION_BY_CODE[code] || {}).city || '');

// ── Drivers ───────────────────────────────────────────────────────────────
// status: duty (working a load) · idle (on-duty, no active stop) · break · oos
const DRIVERS = [
  { id: 1193, name: 'Fabian Romero',    region: 'RC5', status: 'duty', vehicle: 'Car',     load: 3, etaNext: 7.6,  since: '5:02 PM', phone: '+1 (951) 286-8707' },
  { id: 1303, name: 'Anthony Campbell', region: 'RC5', status: 'idle', vehicle: 'Car',     load: 0, idle: 22,      since: '3:48 PM', phone: '+1 (951) 555-0142' },
  { id: 1211, name: 'Arron Lemaster',   region: 'RC8', status: 'idle', vehicle: 'Car',     load: 0, idle: 8,       since: '4:10 PM', phone: '+1 (951) 555-0198', floater: true },
  { id: 1274, name: 'Neha Gupta',       region: 'RC4', status: 'duty', vehicle: 'Car',     load: 2, etaNext: 11.2, since: '2:20 PM', phone: '+1 (714) 555-0110' },
  { id: 1312, name: 'Francisco Guerra', region: 'RC4', status: 'duty', vehicle: 'Car',     load: 1, etaNext: 6.4,  since: '3:15 PM', phone: '+1 (714) 555-0187' },
  { id: 1263, name: 'Uday Pathania',    region: 'RC3', status: 'duty', vehicle: 'Car',     load: 2, etaNext: 9.1,  since: '1:40 PM', phone: '+1 (951) 555-0166' },
  { id: 1305, name: 'Jayant Grover',    region: 'RC3', status: 'oos',  vehicle: 'Car',     load: 0, reason: 'Maintenance', since: '—', phone: '+1 (951) 555-0173' },
  { id: 1330, name: 'Armani Olivio',    region: 'RC1', status: 'duty', vehicle: 'Bike',    load: 1, etaNext: 4.8,  since: '4:02 PM', phone: '+1 (951) 555-0120', stock: ['Flower', 'Pre-Rolls', 'Vapes', 'Edibles'] },
  { id: 1341, name: 'Cory Krcilek',     region: 'RC1', status: 'break',vehicle: 'Car',     load: 0, brk: 14, brkPlan: 5, since: '4:40 PM', phone: '+1 (951) 555-0155' },
  { id: 1352, name: 'Diya Sharma',      region: 'RC2', status: 'duty', vehicle: 'Car',     load: 1, etaNext: 12.5, since: '2:55 PM', phone: '+1 (951) 555-0131' },
  { id: 1360, name: 'Vivek Chamyal',    region: 'SB1', status: 'duty', vehicle: 'Car',     load: 1, etaNext: 8.0,  since: '3:36 PM', phone: '+1 (909) 555-0144' },
  { id: 1371, name: 'Brenden Lemus',    region: 'SB1', status: 'meal', vehicle: 'Bicycle', load: 0, mealType: 'First Meal', brk: 22, brkPlan: 30, since: '4:20 PM', phone: '+1 (909) 555-0177', stock: ['Flower', 'Vapes', 'Pre-Rolls'] },
  { id: 1380, name: 'Eduardo Martinez', region: 'SB2', status: 'duty', vehicle: 'Car',     load: 1, etaNext: 10.3, since: '3:00 PM', phone: '+1 (909) 555-0159' },
  { id: 1391, name: 'Dylan Johnson',    region: 'SB3', status: 'duty', vehicle: 'Car',     load: 1, etaNext: 5.9,  since: '3:22 PM', phone: '+1 (909) 555-0162' },
];
const DRIVER_BY_NAME = Object.fromEntries(DRIVERS.map((d) => [d.name, d]));

// ── Live orders (active only — not delivered / cancelled) ───────────────────
// risk: 0..1 (share of SLA window remaining after projected ETA). late: minutes
// projected past deadline (null if on time). speed: ASAP | Schedule.
const ORDERS = [
  { id: 1012, txn: '1284420', region: 'RC5', driver: null,             speed: 'Schedule', recipient: 'Manisha Saini',  addr: '431 Mulvihill Ave, Redlands',      product: 'Dev & Waffles Melted Diamonds', qty: 1, cash: 64, placed: '7:40 PM', deadline: '7:58 PM', eta: null, risk: 0.38, late: null, noCand: true, noCandReason: 'All RC5 Redlands drivers are over SLA capacity — no in-zone driver can hit the 90-min window. Nearest idle driver (Anthony Campbell) is just outside the region buffer.' },
  { id: 1011, txn: '1284417', region: 'RC5', driver: 'Fabian Romero',  speed: 'ASAP',     recipient: 'Manisha Saini',  addr: '431 Mulvihill Ave, Redlands',      product: 'Dev & Waffles Melted Diamonds', qty: 1, cash: 64, placed: '7:22 PM', deadline: '8:12 PM', eta: '8:14 PM', risk: 0.63, late: 2 },
  { id: 1004, txn: '1284410', region: 'RC5', driver: 'Fabian Romero',  speed: 'ASAP',     recipient: 'D. Alvarez',     addr: 'Oakmont Trail, Redlands',          product: 'Hyperwolf Live Resin 1g',       qty: 2, cash: 0,  placed: '7:16 PM', deadline: '8:04 PM', eta: '8:11 PM', risk: 0.54, late: 7 },
  { id: 1010, txn: '1284182', region: 'RC3', driver: 'Uday Pathania',  speed: 'ASAP',     recipient: 'R. Okafor',      addr: 'Alessandro Blvd, Moreno Valley',   product: 'THE STUF Cart 1g',              qty: 1, cash: 40, placed: '7:20 PM', deadline: '8:18 PM', eta: '8:12 PM', risk: 0.74, late: null },
  { id: 1009, txn: '1284181', region: 'RC3', driver: 'Uday Pathania',  speed: 'ASAP',     recipient: 'hyper hypertest',addr: 'Perris Blvd, Moreno Valley',       product: 'Hyperwolf Gummies 100mg',       qty: 3, cash: 0,  placed: '7:28 PM', deadline: '8:26 PM', eta: '8:19 PM', risk: 0.80, late: null },
  { id: 1008, txn: '1284180', region: 'RC4', driver: 'Neha Gupta',     speed: 'ASAP',     recipient: 'M. Flores',      addr: 'Ontario Ave, Corona',              product: 'Preroll 5-pack',                qty: 1, cash: 55, placed: '7:31 PM', deadline: '8:29 PM', eta: '8:16 PM', risk: 0.83, late: null },
  { id: 1007, txn: '1284179', region: 'RC4', driver: 'Francisco Guerra',speed: 'ASAP',    recipient: 'T. Nguyen',      addr: 'Magnolia Ave, Corona',             product: 'Hyperwolf Vape Box',            qty: 1, cash: 0,  placed: '7:38 PM', deadline: '8:36 PM', eta: '8:15 PM', risk: 0.90, late: null },
  { id: 1006, txn: '1284178', region: 'RC1', driver: 'Armani Olivio',  speed: 'ASAP',     recipient: 'S. Park',        addr: 'Rancho California Rd, Temecula',    product: 'Melted Diamonds 1g',            qty: 1, cash: 50, placed: '7:35 PM', deadline: '8:33 PM', eta: '8:10 PM', risk: 0.88, late: null },
  { id: 1005, txn: '1284177', region: 'RC2', driver: 'Diya Sharma',    speed: 'ASAP',     recipient: 'J. Rivera',      addr: 'Grand Ave, Lake Elsinore',         product: 'Live Rosin Gummies',            qty: 2, cash: 0,  placed: '7:41 PM', deadline: '8:39 PM', eta: '8:20 PM', risk: 0.93, late: null },
  { id: 1003, txn: '1284176', region: 'SB1', driver: 'Vivek Chamyal',  speed: 'ASAP',     recipient: 'A. Cole',        addr: 'Sierra Ave, Fontana',              product: 'THE STUF Cart 1g',              qty: 1, cash: 38, placed: '7:33 PM', deadline: '8:31 PM', eta: '8:12 PM', risk: 0.86, late: null },
  { id: 1002, txn: '1284175', region: 'SB2', driver: 'Eduardo Martinez',speed: 'Schedule',recipient: 'L. Grant',       addr: 'Foothill Blvd, Rancho Cucamonga',  product: 'Hyperwolf Gummies 100mg',       qty: 2, cash: 0,  placed: '6:50 PM', deadline: '8:30 PM', eta: '8:18 PM', risk: 0.89, late: null },
  { id: 1001, txn: '1284174', region: 'SB3', driver: 'Dylan Johnson',  speed: 'ASAP',     recipient: 'K. Osei',        addr: 'Bonita Ave, San Dimas',            product: 'Preroll 5-pack',                qty: 1, cash: 45, placed: '7:37 PM', deadline: '8:35 PM', eta: '8:09 PM', risk: 0.91, late: null },
  { id: 1000, txn: '1284173', region: 'RC4', driver: null,             speed: 'ASAP',     recipient: 'B. Iverson',     addr: 'Sixth St, Corona',                 product: 'Live Resin 1g',                 qty: 1, cash: 60, placed: '7:44 PM', deadline: '8:42 PM', eta: null, risk: 0.71, late: null, noCandReason: 'Both RC4 Corona drivers are mid-route and would breach SLA if diverted. Engine is holding for the next free driver.' },
  // Scheduled (pre-booked, not yet active) — future windows
  { id: 1101, txn: '1284501', region: 'RC5', driver: 'Anthony Campbell', speed: 'Schedule', sched: true, recipient: 'Manisha Saini', addr: '431 Mulvihill Ave, Redlands', cash: 64, placed: '6:10 PM', win: 'Today 8:30\u20139:00 PM', deadline: '9:00 PM', eta: '8:44 PM', risk: 0.95, late: null },
  { id: 1102, txn: '1284502', region: 'RC4', driver: null,             speed: 'Schedule', sched: true, recipient: 'Priya Nair',    addr: '2841 Mission Trail, Corona', cash: 0,  placed: '5:50 PM', win: 'Today 9:00\u20139:30 PM', deadline: '9:30 PM', eta: null, risk: 0.90, late: null, noCandReason: 'Scheduled window opens later tonight — auto-assign runs 30 min before the window.' },
  { id: 1103, txn: '1284503', region: 'RC3', driver: 'Uday Pathania',   speed: 'Schedule', sched: true, future: true, recipient: 'Dev Anand',     addr: '905 Grand Ave, Moreno Valley', cash: 0, placed: '5:30 PM', win: 'Tomorrow 10:00\u201310:30 AM', deadline: '10:30 AM', eta: '10:12 AM', risk: 0.97, late: null },
  { id: 1104, txn: '1284504', region: 'SB1', driver: null,             speed: 'Schedule', sched: true, future: true, recipient: 'Nina Patel',    addr: '334 Riverside Dr, Fontana', cash: 50, placed: '4:40 PM', win: 'Tomorrow 5:00\u20136:00 PM', deadline: '6:00 PM', eta: null, risk: 0.95, late: null, noCandReason: 'Scheduled for tomorrow — auto-assign runs 30 min before the window opens.' },
];

// map coordinates (0..1 over the schematic map) + real catalog line items -----
const RMAP = { RC5: [.75, .40], RC4: [.39, .53], RC3: [.60, .60], RC1: [.55, .86], RC2: [.47, .76], RC8: [.67, .30], SB1: [.50, .29], SB2: [.40, .25], SB3: [.30, .33] };
const OITEMS = {
  1012: [['H480PRO1', 1]], 1011: [['H480PRO1', 1]], 1004: [['NCO28SM', 1], ['CHP1GPR', 2]],
  1010: [['FP94AIO', 1]], 1009: [['DBL78MG', 3]], 1008: [['CHP1GPR', 1], ['GBZ35RR', 1]],
  1007: [['FP94AIO', 1]], 1006: [['H480PRO1', 1]], 1005: [['DBL78MG', 2]], 1003: [['FP94AIO', 1]],
  1002: [['DBL78MG', 2]], 1001: [['CHP1GPR', 1]], 1000: [['NCO28SM', 1]],
  1101: [['H480PRO1', 1]], 1102: [['NCO28SM', 1], ['DBL78MG', 1]], 1103: [['FP94AIO', 1]], 1104: [['CHP1GPR', 2]],
};
ORDERS.forEach((o) => {
  const c = RMAP[o.region] || [.5, .5];
  o.mx = Math.min(.94, Math.max(.06, c[0] + ((o.id * 37) % 100 / 100 - .5) * .13));
  o.my = Math.min(.9, Math.max(.08, c[1] + ((o.id * 53) % 100 / 100 - .5) * .13));
  o.items = (OITEMS[o.id] || [['CHP1GPR', 1]]).map(([sku, qty]) => ({ sku, qty }));
});
DRIVERS.forEach((d) => {
  const c = RMAP[d.region] || [.5, .5];
  d.mx = Math.min(.95, Math.max(.05, c[0] + ((d.id * 29) % 100 / 100 - .5) * .1));
  d.my = Math.min(.92, Math.max(.06, c[1] + ((d.id * 61) % 100 / 100 - .5) * .1));
});
function orderTotals(items) {
  const cat = (window.HW && window.HW.PRODUCTS) || [];
  const line = (items || []).map((it) => { const p = cat.find((x) => x.sku === it.sku); return { ...it, p, ext: (p ? p.price : 0) * it.qty }; });
  const sub = line.reduce((a, l) => a + l.ext, 0);
  const tax = +(sub * 0.0822).toFixed(2);
  return { line, sub, tax, total: +(sub + tax).toFixed(2), count: (items || []).reduce((a, i) => a + i.qty, 0) };
}

// ── Risk helpers ────────────────────────────────────────────────────────────
function riskBand(s) { return s >= CFG.ok ? 'ok' : s >= CFG.bad ? 'warn' : 'bad'; }
function riskColor(P, band) { return band === 'ok' ? P.good : band === 'warn' ? P.warn : P.bad; }
function riskLabel(b) { return b === 'ok' ? 'On track' : b === 'warn' ? 'Tight' : 'At risk'; }

// ── Derived selectors ────────────────────────────────────────────────────────
function ordersInRegion(code, orders) { return (orders || ORDERS).filter((o) => o.region === code); }
function regionStat(code, orders, drivers) {
  const os = ordersInRegion(code, orders).filter((o) => !o.sched);
  const ds = (drivers || DRIVERS).filter((d) => d.region === code);
  const active = ds.filter((d) => d.status === 'duty' || d.status === 'idle');
  const worst = os.length ? Math.min(...os.map((o) => o.risk)) : 1;
  const unassigned = os.filter((o) => !o.driver).length;
  const band = riskBand(worst);
  const demand = os.length, capacity = Math.max(active.length, 1);
  let health = 'ok';
  if (unassigned > 0 || band === 'bad' || demand > capacity * 2.5) health = 'bad';
  else if (band === 'warn' || demand > capacity * 1.5) health = 'warn';
  return { code, os, ds, active, worst, band, unassigned, demand, capacity, health, driversOn: active.length };
}
function allRegionStats(orders, drivers) {
  return REGIONS.map((r) => regionStat(r.code, orders, drivers))
    .sort((a, b) => a.worst - b.worst || b.demand - a.demand);
}

// candidate drivers for (re)assigning an order — ranked by ETA, mirrors the
// Assignment Logs scoring (eta / distance / score / load).
// category-level van inventory — a driver can only fulfil what they carry
const ALL_CATS = ['Flower', 'Vapes', 'Pre-Rolls', 'Concentrates', 'Edibles', 'Wellness'];
function catsOf(items) { const cat = (window.HW && window.HW.PRODUCTS) || []; return [...new Set((items || []).map((it) => { const p = cat.find((x) => x.sku === it.sku); return p ? p.cat : null; }).filter(Boolean))]; }
function driverStock(d) { return d.stock || ALL_CATS; }
function stockCheck(d, order) { const need = catsOf(order.items); const have = driverStock(d); const missing = need.filter((c) => !have.includes(c)); return { ok: missing.length === 0, missing }; }

function candidatesFor(order, drivers) {
  const ds = (drivers || DRIVERS).filter((d) => d.status === 'duty' || d.status === 'idle');
  const same = (d) => d.region === order.region;
  const near = (d) => REGION_BY_CODE[d.region] && REGION_BY_CODE[d.region].county === (REGION_BY_CODE[order.region] || {}).county;
  return ds.map((d) => {
    const base = same(d) ? 5 : near(d) ? 13 : 24;
    const eta = +(base + d.load * 4.5 + (d.idle ? -1.5 : 0)).toFixed(1);
    const dist = +(eta * 0.32).toFixed(1);
    const score = +Math.max(0.2, Math.min(0.98, 1 - eta / 42 - d.load * 0.08 + (d.idle ? 0.06 : 0))).toFixed(2);
    const sc = stockCheck(d, order);
    return { d, eta, dist, score, current: d.name === order.driver, idle: d.status === 'idle', same: same(d), stock: sc.ok, missing: sc.missing };
  }).sort((a, b) => (b.stock - a.stock) || (b.score - a.score));
}

// ── Real-time alert feed — the "flag it the moment it happens" surface ──────
const ALERTS = [
  { id: 'a1', sev: 'bad',  type: 'unassigned', icon: 'user-off', title: 'Order #1012 has no driver', body: 'HyperDrive found no eligible candidate · SLA in 6 min · Redlands', region: 'RC5', order: 1012, acts: ['assign', 'run'], at: '7:46 PM' },
  { id: 'a2', sev: 'bad',  type: 'capacity', icon: 'flag',     title: 'RC5 Redlands is surging', body: '4 active orders · 1 driver working, 1 idle unrouted · demand 2× capacity', region: 'RC5', acts: ['rebalance'], at: '7:49 PM' },
  { id: 'a3', sev: 'bad',  type: 'sla', icon: 'clock',    title: 'Order #1004 projected 7 min late', body: 'Fabian Romero is carrying 3 stops · reassign to recover SLA', region: 'RC5', order: 1004, acts: ['reassign', 'bump'], at: '7:50 PM' },
  { id: 'a4', sev: 'warn', type: 'driver', icon: 'clock',    title: 'Cory Krcilek over break', body: '14 min taken · 5 min planned · RC1 Temecula', region: 'RC1', driver: 'Cory Krcilek', acts: ['message', 'endbreak'], at: '7:51 PM' },
  { id: 'a5', sev: 'warn', type: 'driver', icon: 'truck',    title: 'Jayant Grover out of service', body: 'Maintenance · RC3 Moreno Valley down a driver', region: 'RC3', driver: 'Jayant Grover', acts: ['message'], at: '7:38 PM' },
  { id: 'a6', sev: 'info', type: 'capacity', icon: 'user-check',title: 'Arron Lemaster (Floater) available', body: 'Idle 8 min · can absorb a Redlands or Corona overflow', region: 'RC8', driver: 'Arron Lemaster', acts: ['rebalance'], at: '7:52 PM' },
];

const HERO = (orders, drivers) => {
  const os = orders || ORDERS, ds = drivers || DRIVERS;
  const act = os.filter((o) => !o.sched);
  const rs = REGIONS.map((r) => regionStat(r.code, os, ds));
  return {
    atRisk:      act.filter((o) => riskBand(o.risk) === 'bad').length,
    understaffed:rs.filter((r) => r.health === 'bad').length,
    idle:        ds.filter((d) => d.status === 'idle').length,
    unassigned:  act.filter((o) => !o.driver).length,
    scheduled:   os.filter((o) => o.sched).length,
    onTime:      Math.round(act.filter((o) => !o.late).length / (act.length || 1) * 100),
    active:      act.length,
    drivers:     ds.filter((d) => d.status === 'duty' || d.status === 'idle').length,
  };
};

// ── Customer profiles + promo codes (logistics + POS) ───────────────────────
const CUSTOMERS = {
  'Manisha Saini': { tier: 'VIP', orders: 42, ltv: 5120, last: '3 days ago \u00b7 $128', fav: 'Concentrates', phone: '+1 (555) 222-2222', joined: 'Mar 2024', note: 'Prefers evening drops. Tips well.' },
  'D. Alvarez':    { tier: 'Regular', orders: 11, ltv: 840, last: '2 weeks ago \u00b7 $72', fav: 'Flower', phone: '+1 (951) 555-0301', joined: 'Aug 2025', note: '\u2014' },
  'R. Okafor':     { tier: 'Regular', orders: 7, ltv: 512, last: '9 days ago \u00b7 $58', fav: 'Vapes', phone: '+1 (951) 555-0344', joined: 'Nov 2025', note: '\u2014' },
  'M. Flores':     { tier: 'VIP', orders: 63, ltv: 8940, last: 'Yesterday \u00b7 $210', fav: 'Pre-Rolls', phone: '+1 (714) 555-0355', joined: 'Jan 2024', note: 'High-value regular. Always wants new drops.' },
  'Priya Nair':    { tier: 'Regular', orders: 9, ltv: 690, last: '3 weeks ago \u00b7 $132', fav: 'Flower', phone: '+1 (951) 555-0143', joined: 'Jul 2025', note: 'Prefers indica, mellow evenings.' },
  'Dev Anand':     { tier: 'VIP', orders: 38, ltv: 4200, last: 'Regular \u00b7 avg $280', fav: 'Concentrates', phone: '+1 (951) 555-0166', joined: 'Feb 2024', note: 'VIP \u2014 give standout service.' },
  'Nina Patel':    { tier: 'New', orders: 1, ltv: 0, last: 'First appointment', fav: '\u2014', phone: '+1 (951) 555-0181', joined: 'Today', note: 'New to cannabis \u2014 wants guidance.' },
};
function customerOf(name) { return CUSTOMERS[name] || { tier: 'New', orders: 1, ltv: 0, last: 'First order', fav: '\u2014', phone: '\u2014', joined: 'Today', note: 'First-time guest' }; }
const TIER = { VIP: { c: '#E0A53A', ic: 'crown' }, Regular: { c: '#6A99EC', ic: 'user' }, New: { c: '#46C07E', ic: 'sparkle' } };
const PAY_TYPES = ['Cash', 'Card', 'Split'];
// physical box type carried on the van, per product category (real fulfilment kit)
const BOX_TYPE = { Flower: 'Flower Box', 'Pre-Rolls': 'Pre-Roll Box', Vapes: 'Vape Box', Concentrates: 'Concentrate Box', Edibles: 'Edibles Box', Wellness: 'Wellness Box' };
function boxOf(p) { if (!p) return null; const t = BOX_TYPE[p.cat] || (p.cat + ' Box'); const n = (p.sku.charCodeAt(0) % 3) + 1; return t + ' ' + n; }
const PROMOS = [
  { code: 'WELCOME15', label: '15% off first order', kind: 'pct', value: 0.15 },
  { code: 'HYPER10', label: '$10 off', kind: 'amt', value: 10 },
  { code: 'REFER-JV', label: 'Referral \u00b7 $20 credit', kind: 'amt', value: 20 },
  { code: 'VIP20', label: 'VIP 20% off', kind: 'pct', value: 0.20 },
];
function applyPromo(code, sub) { const p = PROMOS.find((x) => x.code.toUpperCase() === String(code || '').toUpperCase().trim()); if (!p) return null; return { ...p, discount: p.kind === 'pct' ? +(sub * p.value).toFixed(2) : Math.min(p.value, sub) }; }

// ── Cancellation reasons + hot notes (behaviour flags on the customer) ──────
const CANCEL_REASONS = ['Customer no-show', 'Customer unreachable', 'Hostile / unsafe', 'Wrong / bad address', 'Underage / no valid ID', 'Payment declined', 'Duplicate order', 'Item out of stock', 'Other'];
const HOTNOTES = {
  'D. Alvarez': [{ kind: 'noshow', text: 'No-show on Jul 12 — didn’t answer 3 calls, order returned to HQ.', at: 'Jul 12', reason: 'Customer no-show' }],
};
function hotNotesFor(name) { return HOTNOTES[name] ? [...HOTNOTES[name]] : []; }
function addHotNote(name, note) { (HOTNOTES[name] = HOTNOTES[name] || []).unshift(note); }

// ── Per-task activity log ──────────────────────────────────────────────
function activityFor(o) {
  const today = 'Mon, Jul 20';
  const ev = [{ ic: 'receipt', tone: 'ink', t: 'Order placed', sub: 'Created via website', at: today + ' · ' + o.placed }];
  if (o.sched) ev.push({ ic: 'calendar', tone: 'info', t: 'Scheduled delivery', sub: o.win, at: today + ' · ' + o.placed });
  if (o.driver) ev.push({ ic: 'user-check', tone: 'good', t: 'Assigned to ' + o.driver, sub: 'HyperDrive auto-assign', at: today + ' · ' + o.placed });
  else if (o.future) ev.push({ ic: 'clock', tone: 'info', t: 'Queued for scheduled auto-assign', sub: 'Runs ~30 min before the window', at: '—' });
  else ev.push({ ic: 'sparkle', tone: 'warn', t: 'Awaiting auto-assign', sub: o.noCandReason ? 'No eligible driver yet' : 'Next assignment run', at: '—' });
  if (o.late) ev.push({ ic: 'clock', tone: 'bad', t: 'Projected ' + o.late + ' min late', sub: 'ETA ' + o.eta + ' vs SLA ' + o.deadline, at: 'Now · ' + NOW });
  else if (!o.sched && o.driver) ev.push({ ic: 'route', tone: 'ink', t: 'En route', sub: 'ETA ' + (o.eta || '—'), at: 'Now · ' + NOW });
  return ev.reverse();
}


// ── Small primitives ─────────────────────────────────────────────────────────
window.RiskDot = function RiskDot({ score, size = 8 }) {
  const P = useP(); const c = riskColor(P, riskBand(score));
  return <span style={{ width: size, height: size, borderRadius: 99, background: c, flex: '0 0 auto', boxShadow: `0 0 0 3px ${c}22` }} />;
};

window.RiskBar = function RiskBar({ score, width, height = 5 }) {
  const P = useP(); const c = riskColor(P, riskBand(score));
  return <div style={{ width: width || '100%', height, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
    <div style={{ width: Math.round(score * 100) + '%', height: '100%', background: c, borderRadius: 99 }} /></div>;
};

window.RegionTag = function RegionTag({ code, size = 'md', showCity }) {
  const P = useP(); const c = regionColor(code); const r = REGION_BY_CODE[code] || {};
  const s = size === 'sm' ? { fs: 10, p: '2px 6px' } : { fs: 11.5, p: '3px 8px' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: P.fontMono, fontSize: s.fs, fontWeight: 700, color: '#fff', background: c, padding: s.p, borderRadius: 7, whiteSpace: 'nowrap' }}>{code}{showCity && <span style={{ fontWeight: 500, opacity: .85 }}>{r.city}</span>}</span>;
};

window.Money = function Money({ v }) {
  const P = useP();
  if (!v) return <span style={{ color: P.inkMute }}>—</span>;
  return <span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>${v}<span style={{ fontSize: '.8em', color: P.inkDim, fontWeight: 500 }}> cash</span></span>;
};

// floating confirmation toast (per-view)
window.LToast = function LToast({ msg }) {
  const P = useP();
  if (!msg) return null;
  return <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', background: P.ink, color: P.surface, borderRadius: P.r999, boxShadow: P.shadowLg, fontSize: 13, fontWeight: 600, zIndex: 60, whiteSpace: 'nowrap' }}>
    <Icon name="check-circle" size={16} stroke={2} color={P.accent} />{msg}</div>;
};

window.LDATA = {
  NOW, CFG, CC, REGIONS, REGION_BY_CODE, regionColor, regionLabel, RMAP,
  DRIVERS, DRIVER_BY_NAME, ORDERS, ALERTS,
  riskBand, riskColor, riskLabel, ordersInRegion, regionStat, allRegionStats,
  candidatesFor, HERO, orderTotals,
  catsOf, driverStock, stockCheck, CUSTOMERS, customerOf, TIER, PAY_TYPES, BOX_TYPE, boxOf, PROMOS, applyPromo,
  CANCEL_REASONS, hotNotesFor, addHotNote, activityFor,
};
