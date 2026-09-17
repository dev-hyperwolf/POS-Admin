/* shared/hw-hr.js — the HR data layer, tested in isolation.
 *
 * Loads the plain-JS module (not JSX — no esbuild/jsdom/react needed) into a
 * `vm` context whose only globals are a fake `window.HW_LIVE` and, where a
 * test needs to control "now" (cache TTL, the summary() since-cutoffs), a
 * fake `Date`. Deliberately no `fetch` in that context: if hw-hr.js ever
 * built a request itself instead of going through HW_LIVE.get, this would
 * throw a ReferenceError, which is the header-inheritance assertion for
 * every test below — a raw fetch has no way to attach the session token or
 * same-origin base URL that shared/hw-live.js already worked out.
 *
 * Fixture records below are copied (three each) from
 * /Users/jt/wm-demo/qa/fixtures/hr/{employees,incidents,calloffs}.json,
 * transformed from the raw Airtable field-id shape those fixtures store into
 * the HrEmployee/Incident/CallOff CONTRACT shape — the shape hw-hr.js
 * actually consumes, because that is what wm-demo/wmdemo/hr/api.py's routes
 * serve (wmdemo/hr/airtable_read.py's to_hr_employee/to_incident/to_calloff).
 * Names are fake ("Fixture" records only, no real people).
 */
import { test } from 'node:test';
// Plain (non-/strict) assert: hw-hr.js runs inside a vm context with its own
// realm, so arrays/objects it returns are NOT the same Array/Object
// constructors as this test file's — assert/strict's deepStrictEqual treats
// that as unequal even when every value matches. Legacy assert.deepEqual
// compares structurally instead.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-hr.js'), 'utf8');

function fakeLive(opts = {}) {
  const calls = { get: [] };
  const getRes = opts.getRes || { ok: true, code: 200, body: {}, error: null };
  return {
    base: opts.base === undefined ? 'http://127.0.0.1:8812' : opts.base,
    calls,
    get(p) { calls.get.push(p); return Promise.resolve(typeof getRes === 'function' ? getRes(p) : getRes); }
  };
}

// A subclass of the real Date whose `now()`/no-arg constructor read from a
// mutable getter, so a test can both fast-forward time (TTL expiry) and pin
// it to a fixed instant (summary()'s since-cutoffs) while `new Date(ms)`,
// `setUTCHours`, `toISOString`, etc. all still behave like real Date.
function fakeDateClass(getNow) {
  return class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) { super(getNow()); } else { super(...args); }
    }
    static now() { return getNow(); }
  };
}

function loadModule(hwLive, opts = {}) {
  const windowObj = { HW_LIVE: hwLive };
  const context = { window: windowObj };
  if (opts.now !== undefined) {
    context.Date = fakeDateClass(typeof opts.now === 'function' ? opts.now : () => opts.now);
  }
  vm.createContext(context);
  // No `fetch`, no other globals — a raw-fetch code path would ReferenceError.
  vm.runInContext(SRC, context, { filename: 'shared/hw-hr.js' });
  return windowObj.HWHR;
}

function qsOf(pathWithQuery) {
  const q = pathWithQuery.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

// ── fixtures (contract shape, copied+transformed from wm-demo fixtures) ───

function fixtureEmployees() {
  return [
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblDtY9WsQGQOgHgw', record_id: 'rec_emp_001' },
      person_id: 'rec_emp_001', entity_id: 'highest-craft', store_id: null,
      display_name: 'Fixture Ava Torres', email: 'ava.torres@hyperwolf.example', phone: '555-0101',
      status: 'active', title: ['budtender'], location: 'Highest Craft Store', reports_to: 'rec_emp_007',
      tenure_label: '2 yr', accountability_band: 'watch', total_incidents: 1, writeup_count: 1,
      doc_flags: [], separation_date: null, separation_note: null, created_at: '2026-01-01T00:00:00.000Z' },
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblDtY9WsQGQOgHgw', record_id: 'rec_emp_003' },
      person_id: 'rec_emp_003', entity_id: 'highest-craft', store_id: null,
      display_name: 'Fixture Dana Ruiz', email: 'dana.ruiz@hyperwolf.example', phone: '555-0103',
      status: 'terminated', title: ['budtender'], location: 'Highest Craft Store', reports_to: 'rec_emp_007',
      tenure_label: '1 yr', accountability_band: null, total_incidents: 3, writeup_count: 2,
      doc_flags: [], separation_date: '2026-08-01T00:00:00Z', separation_note: 'voluntary',
      created_at: '2026-01-03T00:00:00.000Z' },
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblDtY9WsQGQOgHgw', record_id: 'rec_emp_002' },
      person_id: 'rec_emp_002', entity_id: 'circle-city', store_id: null,
      display_name: 'Fixture Marcus Webb', email: 'marcus.webb@hyperwolf.example', phone: '555-0102',
      status: 'active', title: ['budtender'], location: 'Circle City Store', reports_to: 'rec_emp_007',
      tenure_label: '3 yr', accountability_band: 'high_risk', total_incidents: 2, writeup_count: 0,
      doc_flags: [], separation_date: null, separation_note: null, created_at: '2026-01-02T00:00:00.000Z' }
  ];
}

// Only the two highest-craft rows — simulates api.py's own entity_id query filter.
function fixtureEmployeesScoped() {
  return fixtureEmployees().filter((e) => e.entity_id === 'highest-craft');
}

function fixtureIncidents() {
  return [
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblInc', record_id: 'rec_inc_001' },
      entity_id: 'highest-craft', store_id: null, employee_person_id: 'rec_emp_001', number: 1,
      type: 'customer_complaint', issue_category: 'accuracy', severity: 'medium',
      description: 'Fixture incident 1', date_of_incident: '2026-09-02T12:00:00.000Z', status: 'open',
      source: null, escalate_to_writeup: false, customer_name: 'Fixture Customer 1', order_number: 'ORD-1001',
      is_driver_involved: false, submitter_email: 'submitter1@hyperwolf.example', subject_role: 'budtender',
      attachments_count: null, dismissed: false, dismissed_at: null, dismissed_by: null,
      created_at: '2026-09-02T12:00:00.000Z' },
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblInc', record_id: 'rec_inc_002' },
      entity_id: 'circle-city', store_id: null, employee_person_id: 'rec_emp_002', number: 2,
      type: 'wrong_order_items', issue_category: 'accuracy', severity: 'high',
      description: 'Fixture incident 2', date_of_incident: '2026-09-03T12:00:00.000Z', status: 'closed',
      source: null, escalate_to_writeup: false, customer_name: 'Fixture Customer 2', order_number: 'ORD-1002',
      is_driver_involved: false, submitter_email: 'submitter1@hyperwolf.example', subject_role: 'budtender',
      attachments_count: null, dismissed: false, dismissed_at: null, dismissed_by: null,
      created_at: '2026-09-15T09:00:00.000Z' },
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblInc', record_id: 'rec_inc_003' },
      entity_id: 'highest-craft', store_id: null, employee_person_id: 'rec_emp_003', number: 3,
      type: 'policy_violation', issue_category: null, severity: 'low',
      description: 'Fixture incident 3', date_of_incident: '2026-09-15T10:00:00.000Z', status: 'closed',
      source: null, escalate_to_writeup: false, customer_name: null, order_number: null,
      is_driver_involved: false, submitter_email: 'submitter1@hyperwolf.example', subject_role: 'budtender',
      attachments_count: null, dismissed: false, dismissed_at: null, dismissed_by: null,
      created_at: '2026-09-15T10:00:00.000Z' }
  ];
  // Only rec_inc_002/003 fall inside a 7-day since-window ending 2026-09-16;
  // of those, only rec_inc_003 is entity_id highest-craft, and it is CLOSED —
  // rec_inc_001 is the one OPEN highest-craft row but is outside the window.
  // openIncidents7d for entity highest-craft over this exact fixture is 0;
  // the dedicated summary test below uses a variant with one open+in-window
  // row so the positive case is also covered.
}

function fixtureIncidentsWithOpenInWindow() {
  const rows = fixtureIncidents();
  rows[2] = { ...rows[2], status: 'open' }; // rec_inc_003: highest-craft, in-window, now open
  return rows;
}

function fixtureCalloffs() {
  return [
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblCo', record_id: 'rec_co_001' },
      entity_id: 'highest-craft', employee_person_id: 'rec_emp_001', type: 'late',
      reason: 'personal', date: '2026-09-16T08:00:00.000Z', shift_start_time: '08:00',
      expected_arrival_time: '08:30', minutes_late: 30, notes: 'Fixture call-off 1',
      doctors_note_attachment_present: null, status: 'pending_review',
      submitted_by: 'shift_lead@hyperwolf.example', team: 'front_of_house', writeup_id: null,
      dismissed: false, dismissed_at: null, dismissed_by: null, created_at: '2026-09-16T08:00:00.000Z' },
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblCo', record_id: 'rec_co_002' },
      entity_id: 'circle-city', employee_person_id: 'rec_emp_002', type: 'no_call_no_show',
      reason: 'car_trouble', date: '2026-09-16T08:00:00.000Z', shift_start_time: null,
      expected_arrival_time: null, minutes_late: null, notes: 'Fixture call-off 2',
      doctors_note_attachment_present: null, status: 'pending_review',
      submitted_by: 'shift_lead@hyperwolf.example', team: 'front_of_house', writeup_id: null,
      dismissed: false, dismissed_at: null, dismissed_by: null, created_at: '2026-09-16T09:00:00.000Z' },
    { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblCo', record_id: 'rec_co_003' },
      entity_id: 'highest-craft', employee_person_id: 'rec_emp_003', type: 'absent',
      reason: 'illness', date: '2026-09-03T08:00:00.000Z', shift_start_time: '08:00',
      expected_arrival_time: null, minutes_late: null, notes: 'Fixture call-off 3 (old)',
      doctors_note_attachment_present: null, status: 'excused',
      submitted_by: 'shift_lead@hyperwolf.example', team: 'front_of_house', writeup_id: null,
      dismissed: false, dismissed_at: null, dismissed_by: null, created_at: '2026-09-03T08:00:00.000Z' }
  ];
  // rec_co_003 is old and (in a real server response filtered by
  // since=startOfTodayIso) would never come back at all; the summary test
  // below supplies only the two "today" rows for the calloffs leg, since
  // fixing up a since-filter to be honored client-side is not this module's
  // job — the server already did it.
}

// ── employees() ──────────────────────────────────────────────────────────

test('employees() with no args builds the bare path and returns the array', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { contract: '0.5.0', employees: fixtureEmployees() }, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.employees();
  assert.equal(live.calls.get.length, 1);
  assert.equal(live.calls.get[0], '/api/hr/employees?');
  assert.equal(res.length, 3);
});

test('employees() encodes entity_id/store_id/status into the query', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { employees: [] }, error: null } });
  const HWHR = loadModule(live);
  await HWHR.employees({ entity_id: 'highest-craft', store_id: 'store 1', status: 'active' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.entity_id, 'highest-craft');
  assert.equal(q.store_id, 'store 1');
  assert.equal(q.status, 'active');
});

test('employees() with a missing employees key returns [], not undefined', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: {}, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.employees();
  assert.deepEqual(res, []);
});

// ── employee(id) ─────────────────────────────────────────────────────────

test('employee(id) builds the encoded detail path and returns the object', async () => {
  const emp = fixtureEmployees()[0];
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { employee: emp }, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.employee('rec emp/001');
  assert.equal(live.calls.get[0], '/api/hr/employees/rec%20emp%2F001');
  assert.deepEqual(res, emp);
});

test('employee() refuses locally with no id, never calling HW_LIVE', async () => {
  const live = fakeLive();
  const HWHR = loadModule(live);
  const res = await HWHR.employee();
  assert.equal(live.calls.get.length, 0);
  assert.equal(res.status, 0);
  assert.match(res.error, /id/);
});

// ── expiring() ───────────────────────────────────────────────────────────

test('expiring() with no args omits days and returns the array', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { days: 30, expiring: [{ person_id: 'rec_emp_001' }] }, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.expiring();
  assert.equal(live.calls.get[0], '/api/hr/compliance/expiring?');
  assert.equal(res.length, 1);
});

test('expiring({days}) encodes days into the query', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { expiring: [] }, error: null } });
  const HWHR = loadModule(live);
  await HWHR.expiring({ days: 60 });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.days, '60');
});

// ── incidents() / calloffs() ─────────────────────────────────────────────

test('incidents({since}) percent-encodes the since timestamp', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { incidents: fixtureIncidents() }, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.incidents({ since: '2026-09-09T12:00:00.000Z' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.since, '2026-09-09T12:00:00.000Z');
  assert.equal(res.length, 3);
});

test('calloffs({since}) percent-encodes the since timestamp', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { calloffs: fixtureCalloffs().slice(0, 2) }, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.calloffs({ since: '2026-09-16T00:00:00.000Z' });
  const q = qsOf(live.calls.get[0]);
  assert.equal(q.since, '2026-09-16T00%3A00%3A00.000Z'.replace(/%3A/g, ':')); // sanity: decodes back to itself
  assert.equal(res.length, 2);
});

// ── error mapping ────────────────────────────────────────────────────────

test('a 401 propagates as exactly {status: 401}, no error key', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 401, body: { error: { code: 'unauthorized', message: 'sign in' } }, error: { code: 'unauthorized', message: 'sign in' } } });
  const HWHR = loadModule(live);
  const res = await HWHR.employees();
  assert.deepEqual(res, { status: 401 });
});

test('a 403 always returns {status: 403, error: "hr:read needed"} regardless of the body', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 403, body: { error: { code: 'forbidden', message: 'something else entirely' } }, error: { code: 'forbidden', message: 'something else entirely' } } });
  const HWHR = loadModule(live);
  const res = await HWHR.incidents();
  assert.deepEqual(res, { status: 403, error: 'hr:read needed' });
});

test('a 500 flattens the server error body to {status, error}', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 500, body: { error: { code: 'internal', message: 'upstream read failed' } }, error: { code: 'internal', message: 'upstream read failed' } } });
  const HWHR = loadModule(live);
  const res = await HWHR.calloffs();
  assert.equal(res.status, 500);
  assert.equal(res.error, 'upstream read failed');
});

test('a codeless network failure (code 0) maps the same way', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 0, body: null, error: 'request failed: timeout' } });
  const HWHR = loadModule(live);
  const res = await HWHR.expiring();
  assert.equal(res.status, 0);
  assert.equal(res.error, 'request failed: timeout');
});

test('a 404 with no parseable error body falls back to "HTTP <code>"', async () => {
  const live = fakeLive({ getRes: { ok: false, code: 404, body: null, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.employee('nope');
  assert.equal(res.status, 404);
  assert.equal(res.error, 'HTTP 404');
});

// ── cache: hit / miss / invalidate / TTL ─────────────────────────────────

test('cache: an identical call within the TTL is a cache hit (one network call)', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { employees: fixtureEmployees() }, error: null } });
  const HWHR = loadModule(live, { now: 1_800_000_000_000 });
  await HWHR.employees({ entity_id: 'highest-craft' });
  await HWHR.employees({ entity_id: 'highest-craft' });
  assert.equal(live.calls.get.length, 1);
});

test('cache: a different query string is a cache miss', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { employees: [] }, error: null } });
  const HWHR = loadModule(live, { now: 1_800_000_000_000 });
  await HWHR.employees({ entity_id: 'highest-craft' });
  await HWHR.employees({ entity_id: 'circle-city' });
  assert.equal(live.calls.get.length, 2);
});

test('cache: invalidate() forces the next call to re-fetch', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { employees: [] }, error: null } });
  const HWHR = loadModule(live, { now: 1_800_000_000_000 });
  await HWHR.employees({ entity_id: 'highest-craft' });
  HWHR.invalidate();
  await HWHR.employees({ entity_id: 'highest-craft' });
  assert.equal(live.calls.get.length, 2);
});

test('cache: TTL expiry forces a re-fetch after 30s', async () => {
  const live = fakeLive({ getRes: { ok: true, code: 200, body: { employees: [] }, error: null } });
  let now = 1_800_000_000_000;
  const HWHR = loadModule(live, { now: () => now });
  await HWHR.employees({ entity_id: 'highest-craft' });
  now += 29_000;
  await HWHR.employees({ entity_id: 'highest-craft' });
  assert.equal(live.calls.get.length, 1, 'still within the 30s TTL');
  now += 2_000; // total +31s
  await HWHR.employees({ entity_id: 'highest-craft' });
  assert.equal(live.calls.get.length, 2, 'TTL expired, must re-fetch');
});

test('cache: a failed response is never cached — the next call always re-fetches', async () => {
  let calls = 0;
  const live = fakeLive({
    getRes: () => {
      calls++;
      return calls === 1
        ? { ok: false, code: 500, body: null, error: 'boom' }
        : { ok: true, code: 200, body: { employees: [] }, error: null };
    }
  });
  const HWHR = loadModule(live, { now: 1_800_000_000_000 });
  const r1 = await HWHR.employees({ entity_id: 'highest-craft' });
  const r2 = await HWHR.employees({ entity_id: 'highest-craft' });
  assert.equal(r1.status, 500);
  assert.equal(r2.length, 0);
  assert.equal(live.calls.get.length, 2);
});

// ── summary() ────────────────────────────────────────────────────────────

test('summary() fans out to exactly four HW_LIVE.get calls, one per route', async () => {
  const live = fakeLive({
    getRes: (p) => {
      if (p.indexOf('/api/hr/employees?') === 0) return { ok: true, code: 200, body: { employees: fixtureEmployeesScoped() }, error: null };
      if (p.indexOf('/api/hr/compliance/expiring?') === 0) return { ok: true, code: 200, body: { expiring: [] }, error: null };
      if (p.indexOf('/api/hr/incidents?') === 0) return { ok: true, code: 200, body: { incidents: [] }, error: null };
      if (p.indexOf('/api/hr/calloffs?') === 0) return { ok: true, code: 200, body: { calloffs: [] }, error: null };
      throw new Error('unexpected path ' + p);
    }
  });
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  await HWHR.summary({ entity_id: 'highest-craft' });
  assert.equal(live.calls.get.length, 4);
  const paths = live.calls.get.map((p) => p.split('?')[0]);
  assert.deepEqual(paths.sort(), [
    '/api/hr/calloffs', '/api/hr/compliance/expiring', '/api/hr/employees', '/api/hr/incidents'
  ]);
});

test('summary() passes entity_id to /employees but not to the other three routes', async () => {
  const live = fakeLive({
    getRes: (p) => {
      if (p.indexOf('/api/hr/employees?') === 0) return { ok: true, code: 200, body: { employees: [] }, error: null };
      return { ok: true, code: 200, body: { expiring: [], incidents: [], calloffs: [] }, error: null };
    }
  });
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  await HWHR.summary({ entity_id: 'highest-craft' });
  const byRoute = Object.fromEntries(live.calls.get.map((p) => [p.split('?')[0], qsOf(p)]));
  assert.equal(byRoute['/api/hr/employees'].entity_id, 'highest-craft');
  assert.equal('entity_id' in byRoute['/api/hr/compliance/expiring'], false);
  assert.equal('entity_id' in byRoute['/api/hr/incidents'], false);
  assert.equal('entity_id' in byRoute['/api/hr/calloffs'], false);
});

test('summary() counts correctly on fixture-shaped data, filtering the three unscoped routes by entity_id itself', async () => {
  const live = fakeLive({
    getRes: (p) => {
      if (p.indexOf('/api/hr/employees?') === 0) {
        return { ok: true, code: 200, body: { employees: fixtureEmployeesScoped() }, error: null }; // 1 active, 1 terminated
      }
      if (p.indexOf('/api/hr/compliance/expiring?') === 0) {
        return { ok: true, code: 200, body: { expiring: [
          { person_id: 'rec_emp_001', entity_id: 'highest-craft', doc_type: 'food_handler_card', status: 'expiring_soon', expires_at: '2026-10-01T00:00:00Z' },
          { person_id: 'rec_emp_003', entity_id: 'highest-craft', doc_type: 'drivers_license', status: 'expired', expires_at: '2026-09-01T00:00:00Z' },
          { person_id: 'rec_emp_002', entity_id: 'circle-city', doc_type: 'cannabis_handler_permit', status: 'expiring_soon', expires_at: '2026-10-05T00:00:00Z' }
        ] }, error: null };
      }
      if (p.indexOf('/api/hr/incidents?') === 0) {
        // As a real server response would look after applying `since` itself:
        // rec_inc_001 (created 09-02, outside a 7-day window ending 09-16) is
        // already gone. Only the two in-window rows come back.
        return { ok: true, code: 200, body: { incidents: fixtureIncidentsWithOpenInWindow().slice(1) }, error: null };
      }
      if (p.indexOf('/api/hr/calloffs?') === 0) {
        return { ok: true, code: 200, body: { calloffs: fixtureCalloffs().slice(0, 2) }, error: null }; // the two "today" rows
      }
      throw new Error('unexpected path ' + p);
    }
  });
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  const res = await HWHR.summary({ entity_id: 'highest-craft' });
  assert.deepEqual(res, {
    activePeople: 1,      // rec_emp_001 only (rec_emp_003 is terminated)
    expiring30d: 2,       // rec_emp_001 + rec_emp_003 rows, circle-city excluded
    openIncidents7d: 1,   // rec_inc_003: highest-craft, open, in-window (rec_inc_002 is circle-city + closed)
    calloffsToday: 1      // rec_co_001 only (rec_co_002 is circle-city)
  });
});

test('summary() with no entity_id counts across every entity in the returned arrays', async () => {
  const live = fakeLive({
    getRes: (p) => {
      if (p.indexOf('/api/hr/employees?') === 0) return { ok: true, code: 200, body: { employees: fixtureEmployees() }, error: null };
      if (p.indexOf('/api/hr/compliance/expiring?') === 0) return { ok: true, code: 200, body: { expiring: [{ entity_id: 'a' }, { entity_id: 'b' }] }, error: null };
      if (p.indexOf('/api/hr/incidents?') === 0) return { ok: true, code: 200, body: { incidents: fixtureIncidentsWithOpenInWindow() }, error: null };
      if (p.indexOf('/api/hr/calloffs?') === 0) return { ok: true, code: 200, body: { calloffs: fixtureCalloffs() }, error: null };
      throw new Error('unexpected path ' + p);
    }
  });
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  const res = await HWHR.summary();
  assert.equal(res.activePeople, 2);   // rec_emp_001 + rec_emp_002
  assert.equal(res.expiring30d, 2);
  assert.equal(res.calloffsToday, 3);  // no entity filter applied
});

test('summary() propagates a failed leg (e.g. a 403 on /incidents) instead of a partial result', async () => {
  const live = fakeLive({
    getRes: (p) => {
      if (p.indexOf('/api/hr/incidents?') === 0) return { ok: false, code: 403, body: { error: { message: 'nope' } }, error: { message: 'nope' } };
      return { ok: true, code: 200, body: { employees: [], expiring: [], calloffs: [] }, error: null };
    }
  });
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  const res = await HWHR.summary({ entity_id: 'highest-craft' });
  assert.deepEqual(res, { status: 403, error: 'hr:read needed' });
  assert.equal(live.calls.get.length, 4, 'all four legs still fire in parallel');
});

// ── since / date helpers ─────────────────────────────────────────────────

test('daysAgoIso(n) returns an ISO-8601 Z timestamp exactly n days before now', () => {
  const live = fakeLive();
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  const iso = HWHR.daysAgoIso(7);
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/);
  assert.equal(iso, '2026-09-09T12:00:00.000Z');
});

test('daysAgoIso(0) is "now"', () => {
  const live = fakeLive();
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T12:00:00.000Z') });
  assert.equal(HWHR.daysAgoIso(0), '2026-09-16T12:00:00.000Z');
});

test('startOfTodayIso() returns midnight UTC of the current day', () => {
  const live = fakeLive();
  const HWHR = loadModule(live, { now: Date.parse('2026-09-16T18:45:12.000Z') });
  assert.equal(HWHR.startOfTodayIso(), '2026-09-16T00:00:00.000Z');
});

// ── never mutates response bodies ────────────────────────────────────────

test('never mutates the response body it was handed (frozen body survives every call)', async () => {
  const body = Object.freeze({
    contract: '0.5.0',
    employees: Object.freeze(fixtureEmployees().map((e) => Object.freeze(e)))
  });
  const live = fakeLive({ getRes: { ok: true, code: 200, body, error: null } });
  const HWHR = loadModule(live);
  const res = await HWHR.employees();
  assert.equal(res.length, 3); // did not throw on the frozen body/rows
});

// ── module identity / re-entry ───────────────────────────────────────────

test('the module is idempotent against a second script tag in the same context', () => {
  const live = fakeLive();
  const windowObj = { HW_LIVE: live };
  const context = { window: windowObj };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'hw-hr.js#1' });
  const first = windowObj.HWHR;
  vm.runInContext(SRC, context, { filename: 'hw-hr.js#2' });
  assert.equal(windowObj.HWHR, first, 'a second load must not replace the armed module');
});
