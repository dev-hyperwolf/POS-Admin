/* shared/hw-restock.js — the Floor Restock data layer, tested in isolation.
 *
 * Loads the plain-JS module (not JSX — no esbuild/jsdom/react needed) into a
 * `vm` context whose only global is a fake `window.HW_LIVE`. Deliberately no
 * `fetch` in that context: if hw-restock.js ever built a request itself
 * instead of going through HW_LIVE.get/post, this would throw a
 * ReferenceError, which is the header-inheritance assertion for every test
 * below — a raw fetch has no way to attach the session token or same-origin
 * base URL that shared/hw-live.js already worked out.
 */
import { test } from 'node:test';
// Plain (non-/strict) assert: hw-restock.js runs inside a vm context with its own
// realm, so arrays/objects it returns are NOT the same Array/Object constructors as
// this test file's — assert/strict's deepStrictEqual treats that as unequal even when
// every value matches. Legacy assert.deepEqual compares structurally instead.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-restock.js'), 'utf8');

function fakeLive(opts = {}) {
  const calls = { get: [], post: [] };
  const getRes = opts.getRes || { ok: true, code: 200, body: {}, error: null };
  const postRes = opts.postRes || { ok: true, code: 200, body: {}, error: null };
  return {
    base: opts.base === undefined ? 'http://127.0.0.1:8812' : opts.base,
    calls,
    get(p) { calls.get.push(p); return Promise.resolve(typeof getRes === 'function' ? getRes(p) : getRes); },
    post(p, b) { calls.post.push({ path: p, body: b }); return Promise.resolve(typeof postRes === 'function' ? postRes(p, b) : postRes); }
  };
}

function loadModule(hwLive) {
  const windowObj = { HW_LIVE: hwLive };
  const context = { window: windowObj };
  vm.createContext(context);
  // No `fetch`, no other globals — a raw-fetch code path would ReferenceError.
  vm.runInContext(SRC, context, { filename: 'shared/hw-restock.js' });
  return windowObj.HWRestock;
}

function qsOf(pathWithQuery) {
  const q = pathWithQuery.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

// ── preview() ────────────────────────────────────────────────────────────

test('preview() builds the GET path with store_id/shelf_location_id/since and returns the plan', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { contract: '0.5.0', plan: { id: 'p1', lines: [] } }, error: null } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.preview({ store_id: 'corona', shelf_location_id: 'f1', since: '2026-09-16T09:00:00Z' });
  assert.equal(live.calls.get.length, 1);
  assert.match(live.calls.get[0], /^\/api\/inventory\/restock\/preview\?/);
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.store_id, 'corona');
  assert.equal(q.shelf_location_id, 'f1');
  assert.equal(q.since, '2026-09-16T09:00:00Z');
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(res.error, null);
  assert.deepEqual(res.plan, { id: 'p1', lines: [] });
});

test('preview() refuses locally when a required field is missing, never calling HW_LIVE', async () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  const res = await HWRestock.preview({ store_id: 'corona', since: '2026-09-16T09:00:00Z' });
  assert.equal(live.calls.get.length, 0, 'must not hit the network with a known-bad request');
  assert.equal(res.ok, false);
  assert.equal(res.status, 0);
  assert.match(res.error, /shelf_location_id/);
});

test('preview() maps a server error body to {status, error} and a null plan', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 404, body: { error: { code: 'not_found', message: 'no such shelf' } }, error: { code: 'not_found', message: 'no such shelf' } } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.preview({ store_id: 'corona', shelf_location_id: 'nope', since: '2026-09-16T09:00:00Z' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
  assert.equal(res.error, 'no such shelf');
  assert.equal(res.plan, null);
});

test('preview() flattens a bare string error and a codeless network failure the same way', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 0, body: null, error: 'request failed: timeout' } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.preview({ store_id: 'c', shelf_location_id: 's', since: 'now' });
  assert.equal(res.error, 'request failed: timeout');
  assert.equal(res.status, 0);
});

test('preview() percent-encodes query values', async () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  await HWRestock.preview({ store_id: 'corona', shelf_location_id: 'f 1', since: '2026-09-16T09:00:00+00:00' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.shelf_location_id, 'f 1'); // URLSearchParams decodes back for the assertion
  assert.equal(q.since, '2026-09-16T09:00:00+00:00');
});

// ── plan() ───────────────────────────────────────────────────────────────

test('plan() posts store_id/shelf_location_id/actor and omits since when not given', async () => {
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { plan: { id: 'p2', planned_by: 'Marcus D.' } }, error: null } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.plan({ store_id: 'corona', shelf_location_id: 'f1', actor: 'Marcus D.' });
  assert.equal(live.calls.post.length, 1);
  assert.equal(live.calls.post[0].path, '/api/inventory/restock/plan');
  assert.deepEqual(live.calls.post[0].body, { store_id: 'corona', shelf_location_id: 'f1', actor: 'Marcus D.' });
  assert.equal(res.ok, true);
  assert.equal(res.plan.planned_by, 'Marcus D.');
});

test('plan() includes since when given', async () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  await HWRestock.plan({ store_id: 'corona', shelf_location_id: 'f1', actor: 'Marcus D.', since: '2026-09-16T08:00:00Z' });
  assert.equal(live.calls.post[0].body.since, '2026-09-16T08:00:00Z');
});

test('plan() refuses locally without an actor', async () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  const res = await HWRestock.plan({ store_id: 'corona', shelf_location_id: 'f1' });
  assert.equal(live.calls.post.length, 0);
  assert.equal(res.ok, false);
  assert.match(res.error, /actor/);
});

test('plan() maps a server error the same way preview() does', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 400, body: { error: { message: 'bad_request' } }, error: { message: 'bad_request' } } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.plan({ store_id: 'c', shelf_location_id: 's', actor: 'a' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, 'bad_request');
});

// ── apply() ──────────────────────────────────────────────────────────────

function samplePlan() {
  return {
    id: 'restock-1', kind: 'restock', shelf_location_id: 'f1', since: '2026-09-16T08:00:00Z',
    lines: [
      { product_id: 'sku-1', batch_id: 'b1', to_location_id: 'f1', sold: 6, need: 7, cap: 3, give: 3, reasons: ['oldest_first'] },
      { product_id: 'sku-2', batch_id: 'b2', to_location_id: 'f1', sold: 2, need: 2, cap: 2, give: 2, reasons: ['mixed_batch'], mixed_batch: true }
    ]
  };
}

test('apply() refuses locally without a plan or an actor, never calling HW_LIVE', async () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  const r1 = await HWRestock.apply({ actor: 'Marcus D.' });
  const r2 = await HWRestock.apply({ plan: samplePlan() });
  assert.equal(live.calls.post.length, 0);
  assert.equal(r1.ok, false); assert.match(r1.error, /plan/);
  assert.equal(r2.ok, false); assert.match(r2.error, /actor/);
});

test('apply() posts a CLONE of the plan, and never mutates the caller\'s plan object', async () => {
  const live = fakeLive({
    postRes: { ok: true, code: 200, body: { applied: [], skipped: [], adjusted: [], movements: [] }, error: null }
  });
  const HWRestock = loadModule(live);
  const plan = samplePlan();
  const before = JSON.stringify(plan);
  Object.freeze(plan); Object.freeze(plan.lines); plan.lines.forEach(Object.freeze);
  await HWRestock.apply({ plan, actor: 'Marcus D.', station_id: 'reg-1', read: { tag_ids: ['t1'] } });
  assert.equal(JSON.stringify(plan), before, 'the input plan must be byte-identical after apply()');
  assert.notEqual(live.calls.post[0].body.plan, plan, 'the posted plan must be a clone, not the same reference');
  assert.deepEqual(live.calls.post[0].body.plan, JSON.parse(before), 'the clone must still match the original values');
});

test('apply() includes station_id and read only when given', async () => {
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { applied: [], skipped: [], adjusted: [], movements: [] }, error: null } });
  const HWRestock = loadModule(live);
  await HWRestock.apply({ plan: samplePlan(), actor: 'Marcus D.' });
  const body = live.calls.post[0].body;
  assert.equal('station_id' in body, false);
  assert.equal('read' in body, false);
});

test('apply() maps the three outcomes (applied/skipped/adjusted) and movements verbatim', async () => {
  const applied = [{ product_id: 'sku-1', batch_id: 'b1', give: 3 }];
  const skipped = [{ line: { product_id: 'sku-2', batch_id: 'b2' }, reason: 'hand_count_required' }];
  const adjusted = [{ line: { product_id: 'sku-3', batch_id: 'b3' }, reason: 'capped', requested: 10, applied: 4 }];
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { applied, skipped, adjusted, movements: ['m1'] }, error: null } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.apply({ plan: samplePlan(), actor: 'Marcus D.' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.applied, applied);
  assert.deepEqual(res.skipped, skipped);
  assert.deepEqual(res.adjusted, adjusted);
  assert.deepEqual(res.movements, ['m1']);
});

test('apply() surfaces per-line hand_count_required, pulled out of skipped', async () => {
  const line1 = { product_id: 'sku-2', batch_id: 'b2' };
  const skipped = [
    { line: line1, reason: 'hand_count_required' },
    { line: { product_id: 'sku-9', batch_id: 'b9' }, reason: 'not_in_derived_plan' }
  ];
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { applied: [], skipped, adjusted: [], movements: [] }, error: null } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.apply({ plan: samplePlan(), actor: 'Marcus D.' });
  assert.equal(res.handCountRequired.length, 1);
  assert.deepEqual(res.handCountRequired[0], line1);
});

test('apply() error path returns empty outcome arrays, not undefined', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 422, body: { error: { message: 'not a contract Plan' } }, error: { message: 'not a contract Plan' } } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.apply({ plan: samplePlan(), actor: 'Marcus D.' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.equal(res.error, 'not a contract Plan');
  assert.deepEqual(res.applied, []);
  assert.deepEqual(res.skipped, []);
  assert.deepEqual(res.adjusted, []);
  assert.deepEqual(res.movements, []);
  assert.deepEqual(res.handCountRequired, []);
});

// ── slipUrl() ────────────────────────────────────────────────────────────

test('slipUrl() defaults to format=html and uses HW_LIVE.base', () => {
  const live = fakeLive({ base: 'http://127.0.0.1:8812' });
  const HWRestock = loadModule(live);
  const url = HWRestock.slipUrl({ store_id: 'corona', shelf_location_id: 'f1', since: '2026-09-16T08:00:00Z' });
  assert.equal(url.indexOf('http://127.0.0.1:8812/api/inventory/restock/slip?'), 0);
  const q = qsOf(url);
  assert.equal(q.store_id, 'corona');
  assert.equal(q.shelf_location_id, 'f1');
  assert.equal(q.format, 'html');
});

test('slipUrl() accepts an explicit format and a Plan-shaped source (shelf_location_id/since stamped by the server)', () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  const plan = samplePlan(); // carries store_id? no — stamped fields are shelf_location_id/since
  plan.store_id = 'corona';
  const url = HWRestock.slipUrl(plan, 'text');
  const q = qsOf(url);
  assert.equal(q.format, 'text');
  assert.equal(q.shelf_location_id, 'f1');
  assert.equal(q.since, '2026-09-16T08:00:00Z');
});

// ── locations() ──────────────────────────────────────────────────────────

test('locations() builds an empty query with no args and returns the list on success', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { locations: [{ id: 'f1', name: 'Top Shelf' }] }, error: null } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.locations();
  assert.equal(live.calls.get[0], '/api/inventory/locations?');
  assert.equal(res.ok, true);
  assert.deepEqual(res.locations, [{ id: 'f1', name: 'Top Shelf' }]);
});

test('locations() passes kind/region_id/active through as query params', async () => {
  const live = fakeLive();
  const HWRestock = loadModule(live);
  await HWRestock.locations({ kind: 'shelf', region_id: 'corona', active: true });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.kind, 'shelf');
  assert.equal(q.region_id, 'corona');
  assert.equal(q.active, '1');
});

test('locations() error path returns an empty array, not undefined', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 500, body: null, error: 'HTTP 500' } });
  const HWRestock = loadModule(live);
  const res = await HWRestock.locations({ kind: 'shelf' });
  assert.equal(res.ok, false);
  assert.deepEqual(res.locations, []);
});

// ── module identity / re-entry ───────────────────────────────────────────

test('the module is idempotent against a second script tag in the same context', () => {
  const live = fakeLive();
  const windowObj = { HW_LIVE: live };
  const context = { window: windowObj };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'hw-restock.js#1' });
  const first = windowObj.HWRestock;
  vm.runInContext(SRC, context, { filename: 'hw-restock.js#2' });
  assert.equal(windowObj.HWRestock, first, 'a second load must not replace the armed module');
});
