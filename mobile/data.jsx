// ── Mobile demo data — delivery stops, breaks, notifications ────────────────
// Reuses window.HW.PRODUCTS for catalog + line items. Money via HW.fmt.
const TAX_RATE = 0.0822;

// Delivery stops for "Today". A stop is a shop-at-home order the driver
// fulfills at the door: it can be prepaid (collect nothing) or COD (collect).
// x/y are normalized 0..1 positions on the route map.
function T_(id, order, name, phone, addr, city, zip, kind, win, eta, status, prio, pay, items, x, y, dist) {
  return { id, order, name, phone, addr, city, zip, kind, win, eta, status, prio, pay, items, x, y, dist, type: 'stop' };
}

const TASKS = [
  T_('t1', 'ORD-00001', 'Corina McCoy', '(785) 555-0142', '605 Dog Hill Lane', 'Topeka, KS', '66603', 'dropoff', '11:00–11:30 AM', '11:24 AM', 'in-progress', 'critical', 'cod',
    [{ sku: 'H480PRO1', qty: 1 }, { sku: 'GNJ1123', qty: 1 }, { sku: 'MMG100E', qty: 2 }], 0.52, 0.30, 2.1),
  T_('t2', 'ORD-00002', 'Rodger Struck', '(765) 555-0177', '4093 Overlook Drive', 'Richmond, IN', '47374', 'dropoff', '12:00–12:30 PM', '12:10 PM', 'not-started', 'low', 'prepaid',
    [{ sku: 'FP94AIO', qty: 1 }, { sku: 'CHP1GPR', qty: 3 }], 0.30, 0.44, 3.6),
  T_('t3', 'ORD-00003', 'Kathy Pacheco', '(312) 555-0188', '1341 Poplar Street', 'Chicago, IL', '60606', 'dropoff', '10:00–10:30 AM', '10:26 AM', 'in-progress', 'high', 'cod',
    [{ sku: 'NCO28SM', qty: 1 }, { sku: 'DBL78MG', qty: 2 }], 0.70, 0.52, 5.2),
  T_('t4', 'ORD-00004', 'Marcus Hill', '(951) 555-0163', '882 Collier Ave', 'Lake Elsinore, CA', '92530', 'dropoff', '1:00–1:30 PM', '1:12 PM', 'not-started', 'medium', 'cod',
    [{ sku: 'BRD35SM', qty: 2 }, { sku: 'FCF1LRS', qty: 1 }, { sku: 'ARCH001', qty: 1 }], 0.44, 0.66, 4.0),
  T_('t5', 'ORD-00005', 'Lena Brooks', '(951) 555-0111', '118 Diamond Dr', 'Wildomar, CA', '92595', 'dropoff', '2:00–2:30 PM', '2:05 PM', 'not-started', 'high', 'prepaid',
    [{ sku: 'LDI4DRP', qty: 1 }, { sku: 'GBZ35RR', qty: 1 }], 0.62, 0.74, 6.4),
  T_('t6', 'ORD-00006', 'Sam Oduya', '(714) 555-0199', '330 Folsom Street', 'Alton, IL', '62002', 'dropoff', '3:00–3:30 PM', '3:20 PM', 'not-started', 'low', 'cod',
    [{ sku: 'FFF81Q98', qty: 1 }, { sku: 'STG1BAD', qty: 1 }], 0.36, 0.84, 8.1),
  T_('t7', 'ORD-00007', 'Bianca Reyes', '(951) 555-0134', '77 Sycamore Ct', 'Menifee, CA', '92584', 'dropoff', '3:30–4:00 PM', '3:48 PM', 'not-started', 'medium', 'cod',
    [{ sku: 'CHP1GPR', qty: 3 }, { sku: 'GBZ35RR', qty: 2 }], 0.50, 0.90, 5.5),
  T_('t8', 'ORD-00008', 'Andre Cole', '(951) 555-0120', '210 Lakeshore Dr', 'Canyon Lake, CA', '92587', 'dropoff', '4:00–4:30 PM', '4:15 PM', 'not-started', 'high', 'cod',
    [{ sku: 'BRD35SM', qty: 2 }, { sku: 'DBL78MG', qty: 3 }, { sku: 'FP94AIO', qty: 1 }], 0.24, 0.72, 6.9),
];

// Break tasks that appear inline in the Today list (purple cards).
function BRK(id, label, mins, start, end, status) { return { id, label, mins, start, end, status, type: 'break' }; }
const BREAKS = [
  BRK('b1', 'First Lunch (30 Min)', 30, '12:05 PM', '12:35 PM', 'completed'),
  BRK('b2', '1st Break (10 Min)', 10, '2:35 PM', '2:45 PM', 'completed'),
  BRK('b3', '2nd Break (10 Min)', 10, '1:30 PM', '1:40 PM', 'upcoming'),
  BRK('b4', '2nd Lunch (30 Min)', 30, '3:30 PM', '4:00 PM', 'upcoming'),
];

// Per-task extras: visit type (first-time / VIP / regular) + schedule slack in
// minutes (positive = ahead / minutes to spare, negative = running late).
const TASK_EXTRA = {
  t1: { visit: 'vip',     slack: 6,  dwellSec: 214, tender: 'cash', verified: true },
  t2: { visit: 'regular', slack: 14, dwellSec: 176, tender: 'card', verified: true },
  t3: { visit: 'first',   slack: -3, dwellSec: 342, tender: 'card', verified: false },
  t4: { visit: 'regular', slack: 8,  dwellSec: 233, tender: 'split', verified: true },
  t5: { visit: 'vip',     slack: 5,  dwellSec: 198, tender: 'card', verified: true },
  t6: { visit: 'first',   slack: 2,  dwellSec: 287, tender: 'cash', verified: false },
  t7: { visit: 'regular', slack: 4,  dwellSec: 205, tender: 'cash', verified: true },
  t8: { visit: 'first',   slack: -6, dwellSec: 262, tender: 'card', verified: false },
};
TASKS.forEach((t) => { Object.assign(t, TASK_EXTRA[t.id] || { visit: 'regular', slack: 0, dwellSec: 240, tender: 'cash', verified: true }); t.pay = 'cod'; });
// latest arrival = end of the 90-min delivery window
function latestArrival(t) { return t.win && t.win.includes('\u2013') ? t.win.split('\u2013')[1].trim() : null; }

const VISIT = {
  first:   { label: 'First-time guest', short: 'New', icon: 'sparkle', color: '#6A99EC' },
  vip:     { label: 'VIP guest',        short: 'VIP', icon: 'crown',   color: '#E5A24E' },
  regular: { label: 'Returning guest',  short: null,  icon: 'user',    color: null },
};
// On-time status from slack minutes
function etaStatus(slack) {
  if (slack == null) return { key: 'ontime', label: 'On time', color: 'good', icon: 'check-circle' };
  if (slack <= -3) return { key: 'late', label: `${Math.abs(slack)} min late`, color: 'bad', icon: 'clock' };
  if (slack >= 8) return { key: 'ahead', label: `${slack} min ahead`, color: 'info', icon: 'clock' };
  return { key: 'ontime', label: slack > 0 ? `${slack} min to spare` : 'On time', color: 'good', icon: 'check-circle' };
}

// Scheduled tab = a MIX of same-day pre-booked orders:
//  • Shop@Home appointments (appt:true) — guest shops WITH the genius on
//    arrival, so there are NO items or order total yet (only an AOV goal).
//  • Regular scheduled deliveries (appt:false) — normal pre-built orders.
const AOV = { min: 150, target: 300 };
const SCHEDULED = [
  { id: 's1', order: 'ORD-00021', name: 'Priya Nair', phone: '(951) 555-0143', addr: '2841 Mission Trail', city: 'Wildomar, CA', zip: '92595', win: 'Today · 2:00–3:00 PM', eta: '2:10 PM', dist: 5.1, prio: 'medium', type: 'stop', kind: 'appt', appt: true, pay: 'cod', tender: 'card', status: 'not-started', visit: 'regular', verified: true, slack: 0, dwellSec: 900,
    brief: { interests: ['Flower', 'Vapes'], note: 'Prefers indica, mellow evening highs. Not into edibles.', last: 'Last shopped 3 weeks ago · $132' }, items: [] },
  { id: 's2', order: 'ORD-00022', name: 'Dev Anand', phone: '(951) 555-0166', addr: '905 Grand Ave', city: 'Lakeland Vlg, CA', zip: '92530', win: 'Today · 3:30–4:30 PM', eta: '3:40 PM', dist: 3.8, prio: 'high', type: 'stop', kind: 'appt', appt: true, pay: 'cod', tender: 'cash', status: 'not-started', visit: 'vip', verified: true, slack: 0, dwellSec: 1100,
    brief: { interests: ['Concentrates', 'Pre-Rolls'], note: 'VIP — tips well, always wants the newest drops. Give standout service.', last: 'Regular · avg $280/visit' }, items: [] },
  { id: 's4', order: 'ORD-00024', name: 'Marcus Webb', phone: '(951) 555-0155', addr: '512 Canyon Rd', city: 'Murrieta, CA', zip: '92562', win: 'Today · 4:00–5:00 PM', eta: '4:20 PM', dist: 6.0, prio: 'medium', type: 'stop', kind: 'dropoff', appt: false, pay: 'cod', tender: 'card', status: 'not-started', visit: 'regular', verified: true, slack: 0, dwellSec: 220,
    items: [{ sku: 'NCO28SM', qty: 1 }, { sku: 'CHP1GPR', qty: 2 }] },
  { id: 's3', order: 'ORD-00023', name: 'Nina Patel', phone: '(951) 555-0181', addr: '334 Riverside Dr', city: 'Temescal, CA', zip: '92883', win: 'Today · 5:00–6:00 PM', eta: '5:12 PM', dist: 7.2, prio: 'low', type: 'stop', kind: 'appt', appt: true, pay: 'cod', tender: 'card', status: 'not-started', visit: 'first', verified: false, slack: 0, dwellSec: 1400,
    brief: { interests: ['Edibles', 'Wellness'], note: 'New to cannabis — wants guidance and mild options. Walk her through dosing.', last: 'First appointment' }, items: [] },
];

const NOTIFS = [
  { id: 'n1', icon: 'package', tone: 'accent', group: 'Orders', title: 'New order assigned', body: 'ORD-00006 · Sam Oduya added to your route.', time: '2m ago', unread: true },
  { id: 'n2', icon: 'route', tone: 'info', group: 'Route', title: 'Route re-optimized', body: 'Your stops were reordered to save 12 min.', time: '18m ago', unread: true },
  { id: 'n3', icon: 'clock', tone: 'warn', group: 'Breaks', title: 'Break reminder', body: '2nd Break starts at 4:35 PM.', time: '40m ago', unread: true },
  { id: 'n6', icon: 'sparkle', tone: 'accent', group: 'Orders', title: 'VIP guest ahead', body: 'ORD-00001 · Corina McCoy is a VIP — bring your A-game on service.', time: '52m ago', unread: true },
  { id: 'n4', icon: 'cash', tone: 'good', group: 'Payments', title: 'Payment received', body: 'ORD-00992 · $120.00 collected (split).', time: '1h ago', unread: false },
  { id: 'n7', icon: 'cash', tone: 'good', group: 'Payments', title: 'Payment received', body: 'ORD-00990 · $84.20 collected (cash).', time: '2h ago', unread: false },
  { id: 'n5', icon: 'user-check', tone: 'neutral', group: 'Shift', title: 'Shift started', body: 'You went on duty at 8:02 AM.', time: '5h ago', unread: false },
];

const ANNOUNCEMENTS = [
  { id: 'a1', label: 'Our new products', on: true },
  { id: 'a2', label: 'New hours of operation', on: false },
  { id: 'a3', label: 'Holiday delivery windows', on: false },
];

const DRIVER = { name: 'Jake Telo', phone: '(424) 234-6373', id: 'DRV-2291', vehicle: 'Van · 7HWL294', region: 'Lake Elsinore', appVersion: '2.0.0' };

// Deliveries already completed earlier this shift (baseline for Activity +
// Discrepancy — live completions from the store are merged on top). `counted`
// is the cash actually reconciled into the pouch (one row is deliberately short).
function SC(id, order, name, method, total, cash, card, counted, time) {
  return { id, taskId: id, order, name, method, total, cash, card, counted: counted == null ? cash : counted, at: time, source: 'shift' };
}
const SHIFT_COMPLETED = [
  SC('sc1', 'ORD-00990', 'Kevin Yang',   'cash',    84.20, 84.20, 0,     84.20, '8:41 AM'),
  SC('sc2', 'ORD-00991', 'Dana Frost',   'card',    52.10, 0,     53.16, 0,     '9:18 AM'),
  SC('sc3', 'ORD-00992', 'Omar Diaz',    'split',  120.00, 40.00, 82.66, 40.00, '9:52 AM'),
  SC('sc4', 'ORD-00993', 'Trish Vo',     'card',    38.00, 0,     38.79, 0,     '10:23 AM'),
  SC('sc5', 'ORD-00994', 'Grant Ross',   'cash',    27.63, 27.63, 0,     27.00, '10:47 AM'),
];
const SHIFT = { startedAt: '8:02 AM', miles: 34.6, onTimePct: 92, goalDeliveries: 9, avgDwellSec: 258, rating: 4.9, ratingCount: 63, acceptPct: 98, stopsPerHr: 3.4, aovAppt: 268 };

// Driver-added items (upsell) — surfaced only for shop-at-home drivers
const UPSELL = { adds: 6, value: 182.40, items: 9, orders: 4, attachRate: 0.44 };

// ── Van storage boxes (comment: box filter + per-item box) ──────────────────
const BOXES = ['Flower Box 1', 'Flower Box 2', 'Pre-Roll Box 1', 'Pre-Roll Box 2', 'Vape Box 1', 'Vape Box 2', 'Cooler', 'Edible Box', 'Accessory Bin'];
const _BOX_MAP = {
  Flower: ['Flower Box 1', 'Flower Box 2'], 'Pre-Rolls': ['Pre-Roll Box 1', 'Pre-Roll Box 2'],
  Vapes: ['Vape Box 1', 'Vape Box 2'], Edibles: ['Edible Box', 'Cooler'],
  Concentrates: ['Cooler'], Wellness: ['Accessory Bin', 'Cooler'],
};
const _hash = (s) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
function boxOf(p) { const o = _BOX_MAP[p.cat] || ['Accessory Bin']; return o[_hash(p.sku) % o.length]; }
function batchOf(p) { const h = _hash(p.sku); return 'B' + (2400 + h % 180) + '-' + String.fromCharCode(65 + h % 6); }
function brandsFor(list) { return [...new Set(list.map((p) => p.brand))].sort(); }

// ── SMS templates (admin-controlled, dynamic params) ────────────────────────
const MSG_PARAMS = ['{first}', '{address}', '{eta}', '{vehicle}', '{driver}'];
const MSG_TEMPLATES_DEFAULT = [
  { id: 'm1', label: 'On my way', body: "Hi {first}, this is {driver} with Hyperwolf. I'm on my way to {address} — ETA about {eta}. I'll be in a {vehicle}." },
  { id: 'm2', label: 'Arriving now', body: 'Hi {first}, I\u2019ve arrived at {address} in a {vehicle}. Please come out with your ID ready — thanks!' },
  { id: 'm3', label: 'Running late', body: 'Hi {first}, apologies — I\u2019m running a few minutes behind. Updated ETA is {eta}. Thanks for your patience!' },
  { id: 'm4', label: 'Unable to reach you', body: "Hi {first}, I'm outside at {address} but can't reach you. I'll wait a few minutes — text or call when you're ready." },
];
function fillMsg(body, ctx) { return body.replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k] : m); }

// ── Cash tips — seeded log (driver keeps tips separate from company cash) ───
const TIPS_SEED = [
  { id: 'tp1', amount: 8.00, name: 'Kevin Yang', order: 'ORD-00990', at: '8:41 AM' },
  { id: 'tp2', amount: 5.00, name: 'Omar Diaz', order: 'ORD-00992', at: '9:52 AM' },
  { id: 'tp3', amount: 12.00, name: 'Grant Ross', order: 'ORD-00994', at: '10:47 AM' },
];

// ── Inventory + reconciliation discrepancies (loss-prevention reviews) ──────
const INV_DISCREPANCY = [
  { id: 'iv1', sku: 'MMG100E', box: 'Edible Box', qtyExpected: 4, qtyCounted: 3, affected: ['ORD-00001'], note: 'Check under driver seat' },
  { id: 'iv2', sku: 'CHP1GPR', box: 'Pre-Roll Box 2', qtyExpected: 6, qtyCounted: 5, affected: ['ORD-00002'], note: 'Possibly dropped at last stop' },
];

// Task history (past shifts) — for Profile
const TASK_HISTORY = [
  { id: 'h1', date: 'Yesterday', stops: 11, cod: 6, collected: 742.18, miles: 61.2, onTime: 100 },
  { id: 'h2', date: 'Mar 12', stops: 9, cod: 4, collected: 508.40, miles: 48.7, onTime: 89 },
  { id: 'h3', date: 'Mar 11', stops: 12, cod: 7, collected: 861.05, miles: 70.1, onTime: 92 },
  { id: 'h4', date: 'Mar 10', stops: 8, cod: 3, collected: 391.60, miles: 39.4, onTime: 100 },
];

// ── helpers ────────────────────────────────────────────────────────────────
const prod = (sku) => window.HW.PRODUCTS.find((p) => p.sku === sku);
function cartTotals(items) {
  const line = (items || []).map((i) => { const p = prod(i.sku); return { ...i, p, ext: (p ? p.price : 0) * i.qty }; });
  const sub = line.reduce((a, l) => a + l.ext, 0);
  const tax = Math.round(sub * TAX_RATE * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  const count = (items || []).reduce((a, i) => a + i.qty, 0);
  return { line, sub, tax, total, count };
}
// Van-packing status for a stop: how many units are staged vs. the order total.
function packStatus(task, units) {
  const total = cartTotals(task && task.items).count;
  const p = Math.min(Math.max(0, units || 0), total);
  return { packed: p, total, state: total === 0 ? 'na' : p <= 0 ? 'none' : p >= total ? 'full' : 'partial' };
}
const PRIO = {
  critical: { label: 'Critical', bg: '#E8675B', fg: '#fff' },
  high:     { label: 'High', bg: '#E5A24E', fg: '#1A1400' },
  medium:   { label: 'Medium', bg: '#6A99EC', fg: '#fff' },
  low:      { label: 'Low', bg: '#7E7E74', fg: '#fff' },
};
const STATUS = {
  'not-started': { label: 'Not Started', color: 'inkDim' },
  'in-progress': { label: 'In Progress', color: 'indica' },
  'completed':   { label: 'Completed', color: 'good' },
  'cancelled':   { label: 'Cancelled', color: 'bad' },
};

window.MD = { TASKS, BREAKS, SCHEDULED, NOTIFS, ANNOUNCEMENTS, DRIVER, TAX_RATE, prod, cartTotals, PRIO, STATUS,
  SHIFT, SHIFT_COMPLETED, TASK_HISTORY, VISIT, etaStatus, latestArrival, UPSELL, BOXES, boxOf, batchOf, brandsFor,
  MSG_PARAMS, MSG_TEMPLATES_DEFAULT, fillMsg, TIPS_SEED, INV_DISCREPANCY, AOV, packStatus };
Object.assign(window, {});
