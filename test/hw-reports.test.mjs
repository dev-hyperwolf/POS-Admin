/* shared/hw-reports.js — the Reports data layer, tested in isolation.
 *
 * Loads the plain-JS module (not JSX — no esbuild/jsdom/react needed) into a `vm` context whose
 * only global is a fake `window.HW_LIVE`. Deliberately no `fetch` in that context: if
 * hw-reports.js ever built a request itself instead of going through HW_LIVE.get, this would
 * throw a ReferenceError, which is the header-inheritance assertion for every test below — a
 * raw fetch has no way to attach the session token or same-origin base URL that shared/
 * hw-live.js already worked out. Same harness shape as test/hw-restock.test.mjs.
 */
import { test } from 'node:test';
// Plain (non-/strict) assert: hw-reports.js runs inside a vm context with its own realm, so
// arrays/objects it returns are NOT the same Array/Object constructors as this test file's --
// assert/strict's deepStrictEqual treats that as unequal even when every value matches. Legacy
// assert.deepEqual compares structurally instead.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-reports.js'), 'utf8');

function fakeLive(opts = {}) {
  const calls = { get: [] };
  const getRes = opts.getRes || { ok: true, code: 200, body: {}, error: null };
  return {
    base: opts.base === undefined ? 'http://127.0.0.1:8920' : opts.base,
    calls,
    get(p) { calls.get.push(p); return Promise.resolve(typeof getRes === 'function' ? getRes(p) : getRes); }
  };
}

function loadModule(hwLive) {
  const windowObj = { HW_LIVE: hwLive };
  const context = { window: windowObj };
  vm.createContext(context);
  // No `fetch`, no other globals — a raw-fetch code path would ReferenceError.
  vm.runInContext(SRC, context, { filename: 'shared/hw-reports.js' });
  return windowObj.HWReports;
}

function qsOf(pathWithQuery) {
  const q = pathWithQuery.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

// ── list() ───────────────────────────────────────────────────────────────

test('list() calls GET /api/reports with no query string and returns the catalogue', async () => {
  const live = fakeLive({
    getRes: { ok: true, code: 200, body: { reports: [{ name: 'sales_summary', title: 'Sales Summary' }] }, error: null }
  });
  const HWReports = loadModule(live);
  const res = await HWReports.list();
  assert.equal(live.calls.get.length, 1);
  assert.equal(live.calls.get[0], '/api/reports');
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(res.error, null);
  assert.deepEqual(res.reports, [{ name: 'sales_summary', title: 'Sales Summary' }]);
});

test('list() defaults to an empty array when the server body carries no reports key', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: {}, error: null } });
  const HWReports = loadModule(live);
  const res = await HWReports.list();
  assert.deepEqual(res.reports, []);
});

test('list() maps a server error body to {status, error} and an empty reports array', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 401, body: { error: 'no credential' }, error: 'no credential' } });
  const HWReports = loadModule(live);
  const res = await HWReports.list();
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.equal(res.error, 'no credential');
  assert.deepEqual(res.reports, []);
});

test('list() flattens a codeless network failure the same way run() does', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 0, body: null, error: 'request failed: timeout' } });
  const HWReports = loadModule(live);
  const res = await HWReports.list();
  assert.equal(res.error, 'request failed: timeout');
  assert.equal(res.status, 0);
});

// ── run() ────────────────────────────────────────────────────────────────

test('run() builds the GET path from the report name and store_id/since/until/group_by', async () => {
  const live = fakeLive({
    getRes: { ok: true, code: 200, body: { report: 'sales_summary', rows: [{ period: '2026-09-17' }], totals: {}, truncated: false }, error: null }
  });
  const HWReports = loadModule(live);
  const res = await HWReports.run('sales_summary', {
    store_id: 'corona', since: '2026-09-16', until: '2026-09-17', group_by: 'day'
  });
  assert.equal(live.calls.get.length, 1);
  assert.match(live.calls.get[0], /^\/api\/reports\/sales_summary\?/);
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.store_id, 'corona');
  assert.equal(q.since, '2026-09-16');
  assert.equal(q.until, '2026-09-17');
  assert.equal(q.group_by, 'day');
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(res.error, null);
  assert.deepEqual(res.report, { report: 'sales_summary', rows: [{ period: '2026-09-17' }], totals: {}, truncated: false });
});

test('run() omits since/until/group_by from the query string when not given', async () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  await HWReports.run('sales_by_product', { store_id: 'corona' });
  const q = qsOf(live.calls.get[0]);
  assert.deepEqual(Object.keys(q), ['store_id']);
});

test('run() URL-encodes the report name into the path segment', async () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  await HWReports.run('weird name/x', { store_id: 'corona' });
  assert.match(live.calls.get[0], /^\/api\/reports\/weird%20name%2Fx\?/);
});

test('run() percent-encodes query values', async () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  await HWReports.run('sales_summary', { store_id: 'store one', since: '2026-09-16T00:00:00+00:00' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.store_id, 'store one'); // URLSearchParams decodes back for the assertion
  assert.equal(q.since, '2026-09-16T00:00:00+00:00');
});

test('run() refuses locally without a report name, never calling HW_LIVE', async () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  const res = await HWReports.run('', { store_id: 'corona' });
  assert.equal(live.calls.get.length, 0, 'must not hit the network with a known-bad request');
  assert.equal(res.ok, false);
  assert.equal(res.status, 0);
  assert.match(res.error, /report name/);
});

test('run() refuses locally without a store_id, never calling HW_LIVE', async () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  const res = await HWReports.run('sales_summary', {});
  assert.equal(live.calls.get.length, 0);
  assert.equal(res.ok, false);
  assert.match(res.error, /store_id/);
});

test('run() maps a 404 store-scoping error body to {status, error} and a null report', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 404, body: { error: 'not_found' }, error: 'not_found' } });
  const HWReports = loadModule(live);
  const res = await HWReports.run('sales_summary', { store_id: 'nope' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
  assert.equal(res.error, 'not_found');
  assert.equal(res.report, null);
});

test('run() maps a 403 scope error (reports:pii/reports:export) the same way', async () => {
  const live = fakeLive({
    getRes: { ok: false, code: 403, body: { error: 'report requires the reports:pii scope' }, error: 'report requires the reports:pii scope' }
  });
  const HWReports = loadModule(live);
  const res = await HWReports.run('sales_by_employee', { store_id: 'corona' });
  assert.equal(res.status, 403);
  assert.match(res.error, /reports:pii/);
  assert.equal(res.report, null);
});

test('run() flattens a server error object shaped {code, message}', async () => {
  const live = fakeLive({
    getRes: { ok: false, code: 400, body: { error: { code: 'bad_request', message: 'store_id is required' } }, error: { code: 'bad_request', message: 'store_id is required' } }
  });
  const HWReports = loadModule(live);
  const res = await HWReports.run('sales_summary', { store_id: 'corona' });
  assert.equal(res.error, 'store_id is required');
});

test('run() passes the report body through verbatim, including columns/note/truncated', async () => {
  const body = {
    report: 'profit_loss', title: 'Profit Loss Report', category: 'Overview',
    params: { store_id: 'corona' },
    columns: [{ name: 'period', kind: 'date' }, { name: 'margin_pct', kind: 'pct' }],
    rows: [{ period: '2026-09-17', margin_pct: 90.0 }],
    totals: { gross_cents: 11000 }, truncated: false,
    note: 'COGS is estimated from batch_meta.unit_cost_cents...'
  };
  const live = fakeLive({ getRes: { ok: true, code: 200, body, error: null } });
  const HWReports = loadModule(live);
  const res = await HWReports.run('profit_loss', { store_id: 'corona' });
  assert.deepEqual(res.report, body);
});

// ── csvUrl() ─────────────────────────────────────────────────────────────

test('csvUrl() builds the .csv path with every param and uses HW_LIVE.base', () => {
  const live = fakeLive({ base: 'http://127.0.0.1:8920' });
  const HWReports = loadModule(live);
  const url = HWReports.csvUrl('sales_summary', { store_id: 'corona', since: '2026-09-16', until: '2026-09-17' });
  assert.equal(url.indexOf('http://127.0.0.1:8920/api/reports/sales_summary.csv?'), 0);
  const q = qsOf(url);
  assert.equal(q.store_id, 'corona');
  assert.equal(q.since, '2026-09-16');
  assert.equal(q.until, '2026-09-17');
});

test('csvUrl() never calls HW_LIVE.get — it only builds a string', () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  HWReports.csvUrl('sales_summary', { store_id: 'corona' });
  assert.equal(live.calls.get.length, 0);
});

test('csvUrl() tolerates missing args and an empty base', () => {
  const live = fakeLive({ base: '' });
  const HWReports = loadModule(live);
  const url = HWReports.csvUrl('sales_summary');
  assert.equal(url, '/api/reports/sales_summary.csv?');
});

test('csvUrl() URL-encodes the report name the same way run() does', () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  const url = HWReports.csvUrl('weird name/x', { store_id: 'corona' });
  assert.match(url, /\/api\/reports\/weird%20name%2Fx\.csv\?/);
});

// ── module hygiene ─────────────────────────────────────────────────────────

test('the module is idempotent across two loads into the same window (two script tags)', () => {
  const windowObj = { HW_LIVE: fakeLive() };
  const context = { window: windowObj };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'shared/hw-reports.js' });
  const first = windowObj.HWReports;
  vm.runInContext(SRC, context, { filename: 'shared/hw-reports.js' });
  assert.equal(windowObj.HWReports, first, 'a second load must not replace the armed module');
});

test('the public surface exposes exactly list/run/csvUrl (plus the __armed flag)', () => {
  const live = fakeLive();
  const HWReports = loadModule(live);
  assert.deepEqual(Object.keys(HWReports).sort(), ['__armed', 'csvUrl', 'list', 'run']);
});
