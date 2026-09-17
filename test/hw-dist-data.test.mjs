/* ── shared/hw-dist-data.js ── request shapes, the 7-day loop, error mapping ──
 *
 * This module is the Team 2c data layer for the Refill console's shared
 * components (docs/codebase-audit/distribution/CONSOLE-ENDPOINT-MAP.md §B).
 * It never builds its own fetch/headers — every call goes through a fake
 * window.HW_LIVE stub here, exactly as the sibling *-live-*.js tests stub it
 * (test/mapping-repoint-control.test.mjs). Assertions:
 *   1. each fetcher builds the right path/query for its route,
 *   2. the received-last-7-days loop makes exactly 7 calls with the correct
 *      consecutive calendar days,
 *   3. header/token/base-URL inheritance: this module calls hwLive.get(path)
 *      / hwLive.post(path, body) with no extra arguments of its own — the
 *      transport concerns stay entirely in HW_LIVE,
 *   4. HW_LIVE's `{ ok:false, ... }` shape maps to this module's own
 *      `{ status, error }` contract,
 *   5. quantities on lines/skipped/received pass through unmodified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = readFileSync(new URL('../shared/hw-dist-data.js', import.meta.url), 'utf8');

// Objects returned by code evaluated inside a JSDOM window carry that
// window's own Object/Array prototypes, which assert.deepEqual (strict, via
// deepStrictEqual) rejects on prototype identity alone -- a false failure
// that has nothing to do with correctness (see the identical note in
// test/mapping-repoint-control.test.mjs). Compare structurally instead.
function same(actual, expected, msg) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
}

/** Boots a fresh window with a fake HW_LIVE and this file evaluated into it.
 *  `getRoutes` maps a GET path (including query string) to a canned
 *  { ok, code, body, error } response; `postRoutes` does the same for POST. */
function boot(getRoutes = {}, postRoutes = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:5173/', runScripts: 'outside-only'
  });
  const W = dom.window;
  const getCalls = [];
  const postCalls = [];
  W.HW_LIVE = {
    get: (path) => {
      getCalls.push({ path, argCount: arguments.length });
      if (Object.prototype.hasOwnProperty.call(getRoutes, path)) {
        const r = getRoutes[path];
        return Promise.resolve(typeof r === 'function' ? r() : r);
      }
      return Promise.resolve({ ok: false, code: 404, body: null, error: 'not stubbed: ' + path });
    },
    post: (path, body) => {
      postCalls.push({ path, body, argCount: arguments.length });
      if (Object.prototype.hasOwnProperty.call(postRoutes, path)) {
        const r = postRoutes[path];
        return Promise.resolve(typeof r === 'function' ? r(body) : r);
      }
      return Promise.resolve({ ok: false, code: 404, body: null, error: 'not stubbed: ' + path });
    }
  };
  W.eval(SRC);
  return { W, D: W.HWDistData, getCalls, postCalls, dom };
}

function close(b) { b.dom.window.close(); }

/* ── fetchLocations ──────────────────────────────────────────────────── */

test('fetchLocations: no params -> bare route, no leftover query string', async () => {
  const b = boot({ '/api/inventory/locations': { ok: true, code: 200, body: { locations: [] } } });
  const r = await b.D.fetchLocations();
  assert.equal(b.getCalls.length, 1);
  assert.equal(b.getCalls[0].path, '/api/inventory/locations');
  same(r, { locations: [] });
  close(b);
});

test('fetchLocations: kind + region_id build a correct query string', async () => {
  const b = boot({
    '/api/inventory/locations?kind=kit&region_id=R1': {
      ok: true, code: 200, body: { locations: [{ id: 'K1', kind: 'kit', region_id: 'R1', parent_id: 'R1' }] }
    }
  });
  const r = await b.D.fetchLocations({ kind: 'kit', region_id: 'R1' });
  assert.equal(b.getCalls[0].path, '/api/inventory/locations?kind=kit&region_id=R1');
  assert.equal(r.locations.length, 1);
  assert.equal(r.locations[0].id, 'K1');
  close(b);
});

test('fetchLocations: omitted/empty params never appear in the query string', async () => {
  const b = boot({ '/api/inventory/locations?kind=region': { ok: true, code: 200, body: { locations: [] } } });
  await b.D.fetchLocations({ kind: 'region', region_id: undefined, active: null, code: '' });
  assert.equal(b.getCalls[0].path, '/api/inventory/locations?kind=region');
  close(b);
});

test('fetchLocations: HW_LIVE error maps to { status, error }', async () => {
  const b = boot({ '/api/inventory/locations': { ok: false, code: 500, body: null, error: 'boom' } });
  const r = await b.D.fetchLocations();
  same(r, { status: 500, error: 'boom' });
  close(b);
});

test('fetchLocations: server error with no error string still yields a status-based message', async () => {
  const b = boot({ '/api/inventory/locations': { ok: false, code: 503, body: null, error: null } });
  const r = await b.D.fetchLocations();
  assert.equal(r.status, 503);
  assert.equal(r.error, 'HTTP 503');
  close(b);
});

/* ── fetchKitBoxTree (structural, no quantity math) ─────────────────────── */

test('fetchKitBoxTree: Region -> Kit -> Boxes nesting by parent_id, fields untouched', async () => {
  const locations = [
    { id: 'R1', kind: 'region', name: 'North', parent_id: null },
    { id: 'K1', kind: 'kit', name: 'Kit 1', parent_id: 'R1' },
    { id: 'B1', kind: 'box', name: 'Flower Box 1', parent_id: 'K1', capacity_units: 40 },
    { id: 'B2', kind: 'box', name: 'Cooler', parent_id: 'K1', capacity_units: 12 }
  ];
  const b = boot({ '/api/inventory/locations': { ok: true, code: 200, body: { locations } } });
  const r = await b.D.fetchKitBoxTree();
  assert.equal(r.tree.length, 1);
  assert.equal(r.tree[0].id, 'R1');
  assert.equal(r.tree[0].children.length, 1);
  const kit = r.tree[0].children[0];
  assert.equal(kit.id, 'K1');
  assert.equal(kit.children.length, 2);
  assert.equal(kit.children[0].name, 'Flower Box 1');
  assert.equal(kit.children[0].capacity_units, 40, 'capacity passed through, not recomputed');
  close(b);
});

/* ── fetchRestockPreview / fetchSkips ────────────────────────────────── */

test('fetchRestockPreview: requires store_id + shelf_location_id, never calls HW_LIVE without them', async () => {
  const b = boot();
  const r = await b.D.fetchRestockPreview({ store_id: 'S1' });
  assert.equal(b.getCalls.length, 0);
  assert.equal(r.status, 400);
  close(b);
});

test('fetchRestockPreview: builds query and returns plan.lines/skipped/warnings untouched', async () => {
  const plan = {
    lines: [{ product_id: 'P1', batch_id: 'BT1', to_location_id: 'B1', cap: 12, give: 7, reasons: [] }],
    skipped: [{ product_id: 'P2', to_location_id: 'B2', cap: 0, need: 5, reasons: ['no stock'] }],
    warnings: ['mixed batch on P1']
  };
  const b = boot({
    '/api/inventory/restock/preview?store_id=S1&shelf_location_id=B1&since=2026-09-01': {
      ok: true, code: 200, body: { plan }
    }
  });
  const r = await b.D.fetchRestockPreview({ store_id: 'S1', shelf_location_id: 'B1', since: '2026-09-01' });
  assert.equal(b.getCalls[0].path, '/api/inventory/restock/preview?store_id=S1&shelf_location_id=B1&since=2026-09-01');
  assert.equal(r.plan.lines[0].give, 7, 'give quantity passed through unmodified');
  assert.equal(r.plan.lines[0].cap, 12, 'cap quantity passed through unmodified');
  same(r.plan.skipped, plan.skipped);
  same(r.plan.warnings, plan.warnings);
  close(b);
});

test('fetchRestockPreview: missing plan.skipped/warnings default to empty arrays, not undefined', async () => {
  const b = boot({
    '/api/inventory/restock/preview?store_id=S1&shelf_location_id=B1': {
      ok: true, code: 200, body: { plan: { lines: [] } }
    }
  });
  const r = await b.D.fetchRestockPreview({ store_id: 'S1', shelf_location_id: 'B1' });
  same(r.plan.skipped, []);
  same(r.plan.warnings, []);
  close(b);
});

test('fetchSkips: re-reads the preview route, does not invent a second endpoint', async () => {
  const plan = { lines: [], skipped: [{ product_id: 'P9', reasons: ['cap 0'] }], warnings: [] };
  const b = boot({
    '/api/inventory/restock/preview?store_id=S1&shelf_location_id=B1': { ok: true, code: 200, body: { plan } }
  });
  const r = await b.D.fetchSkips({ store_id: 'S1', shelf_location_id: 'B1' });
  assert.equal(b.getCalls.length, 1, 'SkipsPanel must not add a second network call');
  same(r.skipped, plan.skipped);
  close(b);
});

test('fetchSkips: propagates the preview route\'s error shape', async () => {
  const b = boot({
    '/api/inventory/restock/preview?store_id=S1&shelf_location_id=B1': { ok: false, code: 500, body: null, error: 'db down' }
  });
  const r = await b.D.fetchSkips({ store_id: 'S1', shelf_location_id: 'B1' });
  same(r, { status: 500, error: 'db down' });
  close(b);
});

/* ── fetchBatches ────────────────────────────────────────────────────── */

test('fetchBatches: requires sku', async () => {
  const b = boot();
  const r = await b.D.fetchBatches({});
  assert.equal(b.getCalls.length, 0);
  assert.equal(r.status, 400);
  close(b);
});

test('fetchBatches: batch_no/THC/packaged fields and mixed flag pass through', async () => {
  const batches = [
    { batch_no: 'BT-001', thc_pct: 22.4, packaged_date: '2026-08-01', qty: 10 },
    { batch_no: 'BT-002', thc_pct: 19.1, packaged_date: '2026-08-15', qty: 4 }
  ];
  const b = boot({ '/api/inventory/batches?sku=SKU1': { ok: true, code: 200, body: { batches, mixed: true } } });
  const r = await b.D.fetchBatches({ sku: 'SKU1' });
  assert.equal(b.getCalls[0].path, '/api/inventory/batches?sku=SKU1');
  assert.equal(r.mixed, true);
  same(r.batches, batches);
  close(b);
});

test('fetchBatches: mixed coerces to boolean, missing batches[] defaults to []', async () => {
  const b = boot({ '/api/inventory/batches?sku=SKU2': { ok: true, code: 200, body: {} } });
  const r = await b.D.fetchBatches({ sku: 'SKU2' });
  assert.equal(r.mixed, false);
  same(r.batches, []);
  close(b);
});

/* ── fetchReceivedForDay ─────────────────────────────────────────────── */

test('fetchReceivedForDay: requires day', async () => {
  const b = boot();
  const r = await b.D.fetchReceivedForDay({});
  assert.equal(b.getCalls.length, 0);
  assert.equal(r.status, 400);
  close(b);
});

test('fetchReceivedForDay: builds the exact day query and passes quantities through', async () => {
  const received = [{ product_id: 'P1', quantity: 30, batch_id: 'BT1', location_id: 'K1', kind: 'received' }];
  const b = boot({ '/api/inventory/received?day=2026-09-10': { ok: true, code: 200, body: { received } } });
  const r = await b.D.fetchReceivedForDay({ day: '2026-09-10' });
  assert.equal(b.getCalls[0].path, '/api/inventory/received?day=2026-09-10');
  assert.equal(r.received[0].quantity, 30);
  close(b);
});

/* ── fetchReceivedLast7Days: the loop ────────────────────────────────── */

test('fetchReceivedLast7Days: makes exactly 7 calls, one per consecutive day ending at endDay', async () => {
  const days = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
  const routes = {};
  days.forEach((d) => { routes['/api/inventory/received?day=' + d] = { ok: true, code: 200, body: { received: [] } }; });
  const b = boot(routes);
  const r = await b.D.fetchReceivedLast7Days({ endDay: '2026-09-10' });
  assert.equal(b.getCalls.length, 7);
  const calledDays = b.getCalls.map((c) => c.path.split('=')[1]).sort();
  same(calledDays, days);
  same(r.days.map((d) => d.day), days, 'returned in oldest-to-newest order');
  close(b);
});

test('fetchReceivedLast7Days: crosses a month boundary correctly', async () => {
  const days = ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
  const routes = {};
  days.forEach((d) => { routes['/api/inventory/received?day=' + d] = { ok: true, code: 200, body: { received: [] } }; });
  const b = boot(routes);
  const r = await b.D.fetchReceivedLast7Days({ endDay: '2026-09-04' });
  same(r.days.map((d) => d.day), days);
  close(b);
});

test('fetchReceivedLast7Days: one bad day does not blank the other six', async () => {
  const days = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
  const routes = {};
  days.forEach((d) => { routes['/api/inventory/received?day=' + d] = { ok: true, code: 200, body: { received: [{ product_id: 'P', quantity: 1, batch_id: 'B', location_id: 'L', kind: 'received' }] } }; });
  routes['/api/inventory/received?day=2026-09-07'] = { ok: false, code: 500, body: null, error: 'timeout' };
  const b = boot(routes);
  const r = await b.D.fetchReceivedLast7Days({ endDay: '2026-09-10' });
  const bad = r.days.find((d) => d.day === '2026-09-07');
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'timeout');
  same(bad.received, []);
  const good = r.days.filter((d) => d.day !== '2026-09-07');
  assert.equal(good.length, 6);
  good.forEach((d) => assert.equal(d.ok, true));
  close(b);
});

test('fetchReceivedLast7Days: rejects a malformed endDay without calling HW_LIVE', async () => {
  const b = boot();
  const r = await b.D.fetchReceivedLast7Days({ endDay: 'not-a-date' });
  assert.equal(b.getCalls.length, 0);
  assert.equal(r.status, 400);
  close(b);
});

/* ── applyRestockPlan ("Send today" / "Move to floor") ──────────────────── */

test('applyRestockPlan: requires a plan', async () => {
  const b = boot();
  const r = await b.D.applyRestockPlan({});
  assert.equal(b.postCalls.length, 0);
  assert.equal(r.status, 400);
  close(b);
});

test('applyRestockPlan: posts { plan, actor } to the apply route and returns the server body untouched', async () => {
  const plan = { lines: [{ product_id: 'P1', give: 7 }] };
  const serverResult = { movements: [{ id: 'M1' }], approved_by: 'admin@hyperwolf.com', approved_at: '2026-09-16T10:00:00Z' };
  const b = boot({}, { '/api/inventory/restock/apply': { ok: true, code: 200, body: serverResult } });
  const r = await b.D.applyRestockPlan({ plan, actor: 'admin@hyperwolf.com' });
  assert.equal(b.postCalls.length, 1);
  assert.equal(b.postCalls[0].path, '/api/inventory/restock/apply');
  same(b.postCalls[0].body, { plan, actor: 'admin@hyperwolf.com' });
  same(r, serverResult, 'server response returned as-is, no client reshaping of movement quantities');
  close(b);
});

test('applyRestockPlan: actor defaults to null when omitted, still posts a 2-key body', async () => {
  const b = boot({}, { '/api/inventory/restock/apply': { ok: true, code: 200, body: {} } });
  await b.D.applyRestockPlan({ plan: { lines: [] } });
  same(b.postCalls[0].body, { plan: { lines: [] }, actor: null });
  close(b);
});

test('applyRestockPlan: write-gate rejection maps to { status, error }', async () => {
  const b = boot({}, { '/api/inventory/restock/apply': { ok: false, code: 403, body: null, error: 'write token required' } });
  const r = await b.D.applyRestockPlan({ plan: { lines: [] } });
  same(r, { status: 403, error: 'write token required' });
  close(b);
});

/* ── transport inheritance: no headers/base-URL logic of its own ───────── */

test('every GET call is hwLive.get(path) with exactly one argument — no headers built here', async () => {
  const b = boot({ '/api/inventory/locations': { ok: true, code: 200, body: { locations: [] } } });
  await b.D.fetchLocations();
  assert.equal(b.getCalls[0].argCount, 1);
  close(b);
});

test('every POST call is hwLive.post(path, body) with exactly two arguments', async () => {
  const b = boot({}, { '/api/inventory/restock/apply': { ok: true, code: 200, body: {} } });
  await b.D.applyRestockPlan({ plan: { lines: [] } });
  assert.equal(b.postCalls[0].argCount, 2);
  close(b);
});

test('when HW_LIVE is missing entirely, fetchers resolve to a transport error instead of throwing', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:5173/', runScripts: 'outside-only' });
  const W = dom.window;
  W.eval(SRC);
  const r = await W.HWDistData.fetchLocations();
  assert.equal(r.status, 0);
  assert.match(r.error, /HW_LIVE unavailable/);
  dom.window.close();
});
