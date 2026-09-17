/* shared/hw-register.js — the cash-drawer register-session data layer, tested in isolation.
 *
 * Loads the plain-JS module (not JSX — no esbuild/jsdom/react needed) into a
 * `vm` context whose only global is a fake `window.HW_LIVE`. Deliberately no
 * `fetch` in that context: if hw-register.js ever built a request itself
 * instead of going through HW_LIVE.get/post, this would throw a
 * ReferenceError, which is the header-inheritance assertion for every test
 * below — a raw fetch has no way to attach the session token or same-origin
 * base URL that shared/hw-live.js already worked out. Pattern copied from
 * test/hw-restock.test.mjs.
 */
import { test } from 'node:test';
// Plain (non-/strict) assert: hw-register.js runs inside a vm context with its own
// realm, so arrays/objects it returns are NOT the same Array/Object constructors as
// this test file's — assert/strict's deepStrictEqual treats that as unequal even when
// every value matches. Legacy assert.deepEqual compares structurally instead.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-register.js'), 'utf8');

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
  vm.runInContext(SRC, context, { filename: 'shared/hw-register.js' });
  return windowObj.HWRegister;
}

function qsOf(pathWithQuery) {
  const q = pathWithQuery.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

// ── open() ───────────────────────────────────────────────────────────────

test('open() posts the four required fields and returns the session', async () => {
  const session = { id: '1', store_id: 'corona', register_id: '1', status: 'open' };
  const live = fakeLive({ postRes: { ok: true, code: 201, body: { contract: '0.5.0', session }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.open({ store_id: 'corona', register_id: '1', opened_by: 'devon-ruiz', opening_float_cents: 30000 });
  assert.equal(live.calls.post.length, 1);
  assert.equal(live.calls.post[0].path, '/api/register/open');
  assert.deepEqual(live.calls.post[0].body,
    { store_id: 'corona', register_id: '1', opened_by: 'devon-ruiz', opening_float_cents: 30000 });
  assert.equal(res.ok, true);
  assert.equal(res.status, 201);
  assert.deepEqual(res.session, session);
});

test('open() includes notes only when given', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  await HWRegister.open({ store_id: 'corona', register_id: '1', opened_by: 'x', opening_float_cents: 100 });
  assert.equal('notes' in live.calls.post[0].body, false);
  await HWRegister.open({ store_id: 'corona', register_id: '1', opened_by: 'x', opening_float_cents: 100, notes: 'till 2 short a roll' });
  assert.equal(live.calls.post[1].body.notes, 'till 2 short a roll');
});

test('open() refuses locally when a required field is missing, never calling HW_LIVE', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  const res = await HWRegister.open({ store_id: 'corona', register_id: '1', opened_by: 'x' });
  assert.equal(live.calls.post.length, 0, 'must not hit the network with a known-bad request');
  assert.equal(res.ok, false);
  assert.equal(res.status, 0);
  assert.match(res.error, /opening_float_cents/);
});

test('open() maps a 409 conflict body to {status, error}', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 409, body: { error: { code: 'conflict', message: 'already has an open session' } }, error: { code: 'conflict', message: 'already has an open session' } } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.open({ store_id: 'corona', register_id: '1', opened_by: 'x', opening_float_cents: 100 });
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.equal(res.error, 'already has an open session');
  assert.equal(res.session, null);
});

// ── drop() ───────────────────────────────────────────────────────────────

test('drop() posts to /api/register/{id}/drop with amount_cents/reason/by', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  await HWRegister.drop({ session_id: '7', amount_cents: 5000, reason: 'paid_out', by: 'devon-ruiz', bag_ref: 'BAG-1' });
  assert.equal(live.calls.post[0].path, '/api/register/7/drop');
  assert.deepEqual(live.calls.post[0].body, { amount_cents: 5000, reason: 'paid_out', by: 'devon-ruiz', bag_ref: 'BAG-1' });
});

test('drop() omits bag_ref when not given, and refuses locally without a required field', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  await HWRegister.drop({ session_id: '7', amount_cents: 5000, reason: 'drop', by: 'x' });
  assert.equal('bag_ref' in live.calls.post[0].body, false);
  const res = await HWRegister.drop({ session_id: '7', amount_cents: 5000, by: 'x' });
  assert.equal(live.calls.post.length, 1, 'the second, invalid call must never reach the network');
  assert.equal(res.ok, false);
  assert.match(res.error, /reason/);
});

test('drop() encodes the session id in the path', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  await HWRegister.drop({ session_id: 'weird id/1', amount_cents: 100, reason: 'drop', by: 'x' });
  assert.equal(live.calls.post[0].path, '/api/register/weird%20id%2F1/drop');
});

// ── count() ──────────────────────────────────────────────────────────────

test('count() forwards denominations exactly and never adds a total_cents of its own', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  const denominations = { '10000': 3, '100': 5 };
  await HWRegister.count({ session_id: '7', kind: 'closing', denominations, by: 'devon-ruiz' });
  const sentBody = live.calls.post[0].body;
  assert.deepEqual(sentBody, { kind: 'closing', denominations: { '10000': 3, '100': 5 }, by: 'devon-ruiz' });
  assert.equal('total_cents' in sentBody, false, 'this module must never compute or send a total_cents');
});

test('count() clones the denominations object rather than sending the caller\'s own reference', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  const denominations = { '100': 1 };
  await HWRegister.count({ session_id: '7', kind: 'opening', denominations, by: 'x' });
  live.calls.post[0].body.denominations['100'] = 999; // mutate what was SENT
  assert.equal(denominations['100'], 1, 'the caller\'s own object must be untouched');
});

test('count() with a server-computed total in the response never gets re-derived here', async () => {
  const session = { id: '7', counts: [{ id: '1', kind: 'closing', total_cents: 30500, denominations: { '10000': 3, '100': 5 } }] };
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { session }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.count({ session_id: '7', kind: 'closing', denominations: { '10000': 3, '100': 5 }, by: 'x' });
  assert.equal(res.session.counts[0].total_cents, 30500, 'the total shown is whatever the server said, verbatim');
});

test('count() refuses locally without denominations', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  const res = await HWRegister.count({ session_id: '7', kind: 'opening', by: 'x' });
  assert.equal(live.calls.post.length, 0);
  assert.match(res.error, /denominations/);
});

// ── close() ──────────────────────────────────────────────────────────────

test('close() posts closed_by and surfaces needs_review WITHOUT turning it into ok:false', async () => {
  const session = { id: '7', status: 'closed', expected_cash_cents: 15000, counted_cash_cents: 25000, variance_cents: 10000, needs_review: true };
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { session, breakdown: { final: true } }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.close({ session_id: '7', closed_by: 'devon-ruiz' });
  assert.equal(live.calls.post[0].path, '/api/register/7/close');
  assert.deepEqual(live.calls.post[0].body, { closed_by: 'devon-ruiz' });
  assert.equal(res.ok, true, 'a flagged variance is still a successful close (D1 — never blocks)');
  assert.equal(res.session.needs_review, true);
  assert.deepEqual(res.breakdown, { final: true });
});

test('close() refuses locally without closed_by', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  const res = await HWRegister.close({ session_id: '7' });
  assert.equal(live.calls.post.length, 0);
  assert.match(res.error, /closed_by/);
});

test('close() maps a 409 (no closing count yet) the same way every other error maps', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 409, body: { error: { message: 'no closing count has been recorded' } }, error: { message: 'no closing count has been recorded' } } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.close({ session_id: '7', closed_by: 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.match(res.error, /no closing count/);
  assert.equal(res.breakdown, null);
});

// ── void() ───────────────────────────────────────────────────────────────

test('void() posts voided_by and reason, and refuses locally without a reason', async () => {
  const live = fakeLive();
  const HWRegister = loadModule(live);
  await HWRegister.void({ session_id: '7', voided_by: 'manager', reason: 'opened by mistake' });
  assert.equal(live.calls.post[0].path, '/api/register/7/void');
  assert.deepEqual(live.calls.post[0].body, { voided_by: 'manager', reason: 'opened by mistake' });
  const res = await HWRegister.void({ session_id: '7', voided_by: 'manager' });
  assert.equal(live.calls.post.length, 1, 'the invalid call must never reach the network');
  assert.match(res.error, /reason/);
});

test('void() maps a 403 (missing register:admin) distinctly from a 401', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 403, body: { error: { message: 'voiding a register session requires register:admin' } }, error: { message: 'voiding a register session requires register:admin' } } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.void({ session_id: '7', voided_by: 'x', reason: 'y' });
  assert.equal(res.status, 403);
  assert.match(res.error, /register:admin/);
});

// ── session() / sessions() / variance() ─────────────────────────────────

test('session() GETs /api/register/{id} and returns {session, breakdown}', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { session: { id: '7' }, breakdown: { expected_cash_cents: 100 } }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.session({ session_id: '7' });
  assert.equal(live.calls.get[0], '/api/register/7');
  assert.deepEqual(res.session, { id: '7' });
  assert.deepEqual(res.breakdown, { expected_cash_cents: 100 });
});

test('sessions() builds the query string from store_id/day and defaults to an empty list on error', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { sessions: [{ id: '1' }, { id: '2' }] }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.sessions({ store_id: 'corona', day: '2026-09-17' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.store_id, 'corona');
  assert.equal(q.day, '2026-09-17');
  assert.equal(res.sessions.length, 2);

  const live2 = fakeLive({ getRes: { ok: false, code: 500, body: null, error: 'internal error' } });
  const HWRegister2 = loadModule(live2);
  const res2 = await HWRegister2.sessions({ store_id: 'corona' });
  assert.deepEqual(res2.sessions, []);
  assert.equal(res2.error, 'internal error');
});

test('variance() builds the query string from store_id/since', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { variance: [{ id: '1', needs_review: true }] }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.variance({ store_id: 'corona', since: '2026-09-01T00:00:00Z' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.store_id, 'corona');
  assert.equal(q.since, '2026-09-01T00:00:00Z');
  assert.equal(res.variance[0].needs_review, true);
});

// ── getPolicy() / setPolicy() ────────────────────────────────────────────

test('getPolicy() GETs /api/register/policy and refuses locally without a store_id', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { policy: { blind_counts: false, require_drawer_for_sales: false } }, error: null } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.getPolicy({ store_id: 'corona' });
  assert.equal(qsOf(live.calls.get[0]).store_id, 'corona');
  assert.deepEqual(res.policy, { blind_counts: false, require_drawer_for_sales: false });
  const bad = await HWRegister.getPolicy({});
  assert.equal(live.calls.get.length, 1, 'the missing-store_id call must never reach the network');
  assert.match(bad.error, /store_id/);
});

test('setPolicy() only sends toggles that were actually given (a true partial update)', async () => {
  const live = fakeLive({ postRes: { ok: true, code: 200, body: { policy: { blind_counts: true, require_drawer_for_sales: false } }, error: null } });
  const HWRegister = loadModule(live);
  await HWRegister.setPolicy({ store_id: 'long-beach', blind_counts: true });
  assert.deepEqual(live.calls.post[0].body, { store_id: 'long-beach', blind_counts: true });
  await HWRegister.setPolicy({ store_id: 'long-beach', require_drawer_for_sales: false });
  assert.deepEqual(live.calls.post[1].body, { store_id: 'long-beach', require_drawer_for_sales: false });
});

test('setPolicy() maps a 403 (missing register:admin) the same way void() does', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 403, body: { error: { message: 'setting register policy requires register:admin' } }, error: { message: 'setting register policy requires register:admin' } } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.setPolicy({ store_id: 'corona', blind_counts: true });
  assert.equal(res.status, 403);
  assert.match(res.error, /register:admin/);
});

// ── cross-cutting ────────────────────────────────────────────────────────

test('a network failure with no code maps status 0 with the raw error text, for every write', async () => {
  const live = fakeLive({ postRes: { ok: false, code: 0, body: null, error: 'request failed: timeout' } });
  const HWRegister = loadModule(live);
  const res = await HWRegister.open({ store_id: 'c', register_id: '1', opened_by: 'x', opening_float_cents: 0 });
  assert.equal(res.status, 0);
  assert.equal(res.error, 'request failed: timeout');
});
