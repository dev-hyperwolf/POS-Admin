/* ── shared/hw-tax.js ── request shapes, error mapping, no client-side tax math ──
 *
 * This module is the Team 6b data layer for `/api/tax/*`
 * (ADMIN-GAP-LIST-2026-09-17.md §B "Tax" / §C items 2, 6, 7). It never
 * builds its own fetch/headers — every call goes through a fake
 * window.HW_LIVE stub here, exactly as hw-dist-data.js's own test stubs it.
 * Assertions:
 *   1. each fetcher builds the right path/query/body for its route,
 *   2. header/token/base-URL inheritance: this module calls hwLive.get(path)
 *      / hwLive.post(path, body) with no extra arguments of its own — the
 *      transport concerns stay entirely in HW_LIVE,
 *   3. HW_LIVE's `{ ok:false, ... }` shape maps to this module's own
 *      `{ status, error, code }` contract, `code` taken from the server
 *      body when present,
 *   4. rate/breakdown fields pass through unmodified — no cent is ever
 *      computed in this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = readFileSync(new URL('../shared/hw-tax.js', import.meta.url), 'utf8');

function same(actual, expected, msg) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
}

/** Boots a fresh window with a fake HW_LIVE and this file evaluated into it.
 *  `getRoutes` maps a GET path (including query string) to a canned
 *  { ok, code, body, error } response; `postRoutes` does the same for POST,
 *  keyed by path with the request body available via a function value. */
function boot(getRoutes = {}, postRoutes = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:5173/', runScripts: 'outside-only'
  });
  const W = dom.window;
  const getCalls = [];
  const postCalls = [];
  W.HW_LIVE = {
    get: function (path) {
      getCalls.push({ path, argCount: arguments.length });
      if (Object.prototype.hasOwnProperty.call(getRoutes, path)) {
        const r = getRoutes[path];
        return Promise.resolve(typeof r === 'function' ? r() : r);
      }
      return Promise.resolve({ ok: false, code: 404, body: null, error: 'not stubbed: ' + path });
    },
    post: function (path, body) {
      postCalls.push({ path, body, argCount: arguments.length });
      if (Object.prototype.hasOwnProperty.call(postRoutes, path)) {
        const r = postRoutes[path];
        return Promise.resolve(typeof r === 'function' ? r(body) : r);
      }
      return Promise.resolve({ ok: false, code: 404, body: null, error: 'not stubbed: ' + path });
    }
  };
  W.eval(SRC);
  return { W, T: W.HWTax, getCalls, postCalls, dom };
}

function close(b) { b.dom.window.close(); }

const EXAMPLE_RATE = {
  id: 'TR-1', store_id: null, jurisdiction_kind: 'state', jurisdiction_name: 'California',
  kind: 'excise', basis: 'pre_tax', rate_bps: 1500, applies_to: 'cannabis', member_type: 'all',
  effective_from: '2026-09-17', effective_to: null, note: 'EXAMPLE -- confirm with JT'
};

/* ── fetchTaxRates ────────────────────────────────────────────────────────── */

test('fetchTaxRates: no params -> bare route, no leftover query string', async () => {
  const b = boot({ '/api/tax/rates': { ok: true, code: 200, body: { rates: [] } } });
  const r = await b.T.fetchTaxRates();
  assert.equal(b.getCalls.length, 1);
  assert.equal(b.getCalls[0].path, '/api/tax/rates');
  same(r, { rates: [] });
  close(b);
});

test('fetchTaxRates: store_id + at build a correct query string', async () => {
  const b = boot({
    '/api/tax/rates?store_id=elsinore&at=2026-09-17': { ok: true, code: 200, body: { rates: [EXAMPLE_RATE] } }
  });
  const r = await b.T.fetchTaxRates({ store_id: 'elsinore', at: '2026-09-17' });
  assert.equal(b.getCalls[0].path, '/api/tax/rates?store_id=elsinore&at=2026-09-17');
  assert.equal(r.rates.length, 1);
  assert.equal(r.rates[0].id, 'TR-1');
  close(b);
});

test('fetchTaxRates: omitted/empty params never appear in the query string', async () => {
  const b = boot({ '/api/tax/rates?store_id=elsinore': { ok: true, code: 200, body: { rates: [] } } });
  await b.T.fetchTaxRates({ store_id: 'elsinore', at: undefined });
  assert.equal(b.getCalls[0].path, '/api/tax/rates?store_id=elsinore');
  close(b);
});

test('fetchTaxRates: HW_LIVE error maps to { status, error, code }', async () => {
  const b = boot({ '/api/tax/rates': { ok: false, code: 401, body: { error: 'unauthorized' }, error: 'unauthorized' } });
  const r = await b.T.fetchTaxRates();
  same(r, { status: 401, error: 'unauthorized', code: null });
  close(b);
});

test('fetchTaxRates: server error with no error string still yields a status-based message', async () => {
  const b = boot({ '/api/tax/rates': { ok: false, code: 503, body: null, error: null } });
  const r = await b.T.fetchTaxRates();
  assert.equal(r.status, 503);
  assert.equal(r.error, 'HTTP 503');
  assert.equal(r.code, null);
  close(b);
});

/* ── fetchTaxAudit ────────────────────────────────────────────────────────── */

test('fetchTaxAudit: store_id builds the right query string and passes rows through untouched', async () => {
  const closedRate = Object.assign({}, EXAMPLE_RATE, { effective_to: '2026-12-31', created_by: 'jt', updated_at: '2026-09-17T08:00:00Z' });
  const b = boot({ '/api/tax/audit?store_id=elsinore': { ok: true, code: 200, body: { audit: [closedRate] } } });
  const r = await b.T.fetchTaxAudit({ store_id: 'elsinore' });
  assert.equal(b.getCalls[0].path, '/api/tax/audit?store_id=elsinore');
  same(r.audit, [closedRate]);
  close(b);
});

test('fetchTaxAudit: no store_id -> bare route (every store)', async () => {
  const b = boot({ '/api/tax/audit': { ok: true, code: 200, body: { audit: [] } } });
  await b.T.fetchTaxAudit();
  assert.equal(b.getCalls[0].path, '/api/tax/audit');
  close(b);
});

test('fetchTaxAudit: tax:admin-missing 403 maps through with the server code', async () => {
  const b = boot({
    '/api/tax/audit': { ok: false, code: 403, body: { error: 'forbidden', missing_scope: 'tax:admin' }, error: 'forbidden' }
  });
  const r = await b.T.fetchTaxAudit();
  assert.equal(r.status, 403);
  assert.equal(r.error, 'forbidden');
  close(b);
});

/* ── createTaxRate ────────────────────────────────────────────────────────── */

test('createTaxRate: posts the rate object verbatim to /api/tax/rates', async () => {
  const payload = { jurisdiction_kind: 'state', jurisdiction_name: 'California', kind: 'excise',
    basis: 'pre_tax', rate_bps: 1500, applies_to: 'cannabis', member_type: 'all', effective_from: '2026-09-17' };
  const b = boot({}, {
    '/api/tax/rates': (body) => ({ ok: true, code: 201, body: { rate: Object.assign({ id: 'TR-2' }, body) } })
  });
  const r = await b.T.createTaxRate(payload);
  assert.equal(b.postCalls.length, 1);
  assert.equal(b.postCalls[0].path, '/api/tax/rates');
  same(b.postCalls[0].body, payload, 'this module never mutates the caller\'s payload');
  assert.equal(r.rate.id, 'TR-2');
  assert.equal(r.rate.rate_bps, 1500);
  close(b);
});

test('createTaxRate: missing rate object -> a local 400, no network call at all', async () => {
  const b = boot({}, { '/api/tax/rates': { ok: true, code: 201, body: { rate: EXAMPLE_RATE } } });
  const r = await b.T.createTaxRate(null);
  assert.equal(r.status, 400);
  assert.equal(r.code, 'bad_body');
  assert.equal(b.postCalls.length, 0, 'never calls HW_LIVE for a request this module can refuse locally');
  close(b);
});

test('createTaxRate: over-posting (400 over_post) surfaces the server code untouched', async () => {
  const b = boot({}, {
    '/api/tax/rates': { ok: false, code: 400, body: { error: 'unexpected field(s): bogus', code: 'over_post', fields: ['bogus'] }, error: 'unexpected field(s): bogus' }
  });
  const r = await b.T.createTaxRate({ bogus: 'x' });
  assert.equal(r.status, 400);
  assert.equal(r.code, 'over_post');
  assert.match(r.error, /bogus/);
  close(b);
});

test('createTaxRate: id-reuse -> 409 rate_id_exists surfaces as-is (this module never retries or edits)', async () => {
  const b = boot({}, {
    '/api/tax/rates': { ok: false, code: 409, body: { error: 'tax rate id already exists', code: 'rate_id_exists' }, error: 'tax rate id already exists' }
  });
  const r = await b.T.createTaxRate({ id: 'TR-1' });
  assert.equal(r.status, 409);
  assert.equal(r.code, 'rate_id_exists');
  close(b);
});

/* ── closeTaxRate ─────────────────────────────────────────────────────────── */

test('closeTaxRate: posts to /api/tax/rates/{id}/close with effective_to, id percent-encoded', async () => {
  const b = boot({}, {
    '/api/tax/rates/TR%201/close': (body) => ({ ok: true, code: 200, body: { rate: Object.assign({}, EXAMPLE_RATE, { id: 'TR 1', effective_to: body.effective_to }) } })
  });
  const r = await b.T.closeTaxRate('TR 1', '2026-12-31');
  assert.equal(b.postCalls[0].path, '/api/tax/rates/TR%201/close');
  same(b.postCalls[0].body, { effective_to: '2026-12-31' });
  assert.equal(r.rate.effective_to, '2026-12-31');
  close(b);
});

test('closeTaxRate: missing id -> a local 400, no network call', async () => {
  const b = boot();
  const r = await b.T.closeTaxRate(null, '2026-12-31');
  assert.equal(r.status, 400);
  assert.equal(r.code, 'bad_body');
  assert.equal(b.postCalls.length, 0);
  close(b);
});

test('closeTaxRate: already-closed -> 409 already_closed surfaces as-is', async () => {
  const b = boot({}, {
    '/api/tax/rates/TR-1/close': { ok: false, code: 409, body: { error: 'already closed', code: 'already_closed' }, error: 'already closed' }
  });
  const r = await b.T.closeTaxRate('TR-1', '2026-12-31');
  assert.equal(r.status, 409);
  assert.equal(r.code, 'already_closed');
  close(b);
});

/* ── quoteTax ─────────────────────────────────────────────────────────────── */

test('quoteTax: posts lines/store_id/member_type, defaults member_type to "all", omits `at` when not given', async () => {
  const lines = [{ line_idx: 0, base_cents: 3000, category: 'Flower' }];
  const b = boot({}, {
    '/api/tax/quote': (body) => ({ ok: true, code: 200, body: { lines: [{ line_idx: 0, taxable_cents: 3000, taxes: [] }], totals: {}, total_tax_cents: 0 } })
  });
  const r = await b.T.quoteTax({ lines, store_id: 'elsinore' });
  same(b.postCalls[0].body, { lines, store_id: 'elsinore', member_type: 'all' });
  assert.equal(r.total_tax_cents, 0);
  assert.equal(r.lines[0].taxable_cents, 3000);
  close(b);
});

test('quoteTax: an explicit `at` is included in the posted body', async () => {
  const b = boot({}, {
    '/api/tax/quote': { ok: true, code: 200, body: { lines: [], totals: {}, total_tax_cents: 0 } }
  });
  await b.T.quoteTax({ lines: [], at: '2020-03-01' });
  assert.equal(b.postCalls[0].body.at, '2020-03-01');
  close(b);
});

test('quoteTax: lines not an array -> a local 400, no network call', async () => {
  const b = boot();
  const r = await b.T.quoteTax({ lines: 'nope' });
  assert.equal(r.status, 400);
  assert.equal(r.code, 'bad_body');
  assert.equal(b.postCalls.length, 0);
  close(b);
});

test('quoteTax: breakdown fields (taxes[], totals, total_tax_cents) pass through with no client-side arithmetic', async () => {
  const breakdown = {
    lines: [{ line_idx: 0, taxable_cents: 10000, taxes: [
      { rate_id: 'TR-1', kind: 'excise', jurisdiction: 'California', rate_bps: 1500, basis: 'pre_tax', tax_cents: 1500 },
      { rate_id: 'TR-2', kind: 'sales', jurisdiction: 'California', rate_bps: 600, basis: 'post_excise', tax_cents: 690 }
    ] }], totals: { excise: 1500, sales: 690 }, total_tax_cents: 2190
  };
  const b = boot({}, { '/api/tax/quote': { ok: true, code: 200, body: breakdown } });
  const r = await b.T.quoteTax({ lines: [{ line_idx: 0, base_cents: 10000, is_cannabis: true }], member_type: 'recreational' });
  same(r, breakdown, 'this module never recomputes or rounds anything the server already computed');
  close(b);
});

test('quoteTax: a network-level failure (code 0) is reported the same way as an HTTP error', async () => {
  const b = boot({}, { '/api/tax/quote': { ok: false, code: 0, body: null, error: 'request failed: fetch failed' } });
  const r = await b.T.quoteTax({ lines: [] });
  assert.equal(r.status, 0);
  assert.match(r.error, /request failed/);
  close(b);
});

/* ── HW_LIVE inheritance (no local transport logic) ──────────────────────── */

test('HWTax never calls HW_LIVE.get/post with extra arguments of its own', async () => {
  const b = boot({ '/api/tax/rates': { ok: true, code: 200, body: { rates: [] } } },
                 { '/api/tax/quote': { ok: true, code: 200, body: { lines: [], totals: {}, total_tax_cents: 0 } } });
  await b.T.fetchTaxRates();
  await b.T.quoteTax({ lines: [] });
  assert.equal(b.getCalls[0].argCount, 1, 'get(path) only');
  assert.equal(b.postCalls[0].argCount, 2, 'post(path, body) only');
  close(b);
});

test('HWTax degrades to a local error, never throws, when HW_LIVE is entirely absent', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:5173/', runScripts: 'outside-only' });
  dom.window.eval(SRC);
  const r1 = await dom.window.HWTax.fetchTaxRates();
  const r2 = await dom.window.HWTax.quoteTax({ lines: [] });
  assert.equal(r1.status, 0);
  assert.equal(r2.status, 0);
  assert.match(r1.error, /HW_LIVE unavailable/);
  dom.window.close();
});
