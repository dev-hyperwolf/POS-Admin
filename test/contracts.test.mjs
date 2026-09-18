/* @hyper-tech/contracts — does the one file say what it claims, in every runtime, and does the
 * rest of the estate still agree with it?
 *
 * Three groups:
 *   1. The file loads three ways (Node require, browser-style vm with `window`, and the JSON
 *      exports Python reads) and they are the SAME vocabulary. A drift here is a build step
 *      that was skipped: fix by `node tools/contracts-export.mjs`.
 *   2. The conventions do what the README promises (cents, ids, time, roles, errors, events,
 *      the schema validator accepts a good record and rejects a mutated one).
 *   3. DRIFT AGAINST THE ESTATE. Enums in this package are copied from files that live
 *      elsewhere; those files are parsed here and must still say the same thing. Our own
 *      estate (wm-demo) drifting FAILS. The Hyper-Tech production repos drifting is REPORTED
 *      (they are read-only to us and already disagree with themselves — the report says so),
 *      and fails only with HW_CONTRACTS_STRICT_PROD=1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'contracts', 'index.js');
const require = createRequire(import.meta.url);
const C = require(FILE);
const WM = process.env.WM_DEMO_ROOT || '/Users/jt/wm-demo';
const HT = process.env.HYPER_TECH_ROOT || '/Users/jt/hyper-tech';

function loadBrowser() {
  const sandbox = { console }; sandbox.window = sandbox; sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: 'contracts/index.js' });
  return sandbox;
}

// ── 1. one vocabulary, three runtimes ───────────────────────────────────────
test('browser load leaks exactly one global, HWContracts, with the same surface as require()', () => {
  const w = loadBrowser();
  const leaked = Object.keys(w).filter((k) => !['console', 'window', 'self'].includes(k));
  assert.deepEqual(leaked, ['HWContracts']);
  assert.equal(JSON.stringify(Object.keys(w.HWContracts).sort()), JSON.stringify(Object.keys(C).sort()));
  assert.equal(w.HWContracts.VERSION, C.VERSION);
  assert.equal(JSON.stringify(w.HWContracts.enumValues('Role')), JSON.stringify(C.enumValues('Role')), 'same vocabulary across realms');
});

test('enums.json and schema/*.json are exactly what index.js exports (run tools/contracts-export.mjs otherwise)', () => {
  const ej = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'enums.json'), 'utf8'));
  assert.equal(ej.contract, C.VERSION);
  const fromJs = {}; for (const [k, v] of Object.entries(C.ENUMS)) fromJs[k] = v.values;
  assert.deepEqual(ej.enums, fromJs, 'enums.json drifted from index.js');
  assert.deepEqual(ej.http_status, C.HTTP_STATUS);
  assert.deepEqual(ej.rule_field_type, C.RULE_FIELD_TYPE, 'enums.json rule_field_type drifted from index.js');
  assert.deepEqual(ej.rule_limits, C.RULE_LIMITS, 'enums.json rule_limits drifted from index.js');
  assert.deepEqual(ej.rule_ops_by_type, C.RULE_OPS_BY_TYPE, 'enums.json rule_ops_by_type drifted from index.js');
  assert.deepEqual(ej.pii_class, C.PII_CLASS, 'enums.json pii_class drifted from index.js');
  const dir = path.join(ROOT, 'contracts', 'schema');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  assert.deepEqual(files, Object.keys(C.SCHEMAS).sort(), 'schema files do not match SCHEMAS');
  for (const name of files) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8'));
    const { $id, contract, ...rest } = j;
    assert.equal($id, name); assert.equal(contract, C.VERSION);
    assert.deepEqual(rest, JSON.parse(JSON.stringify(C.SCHEMAS[name])), 'schema ' + name + ' drifted');
  }
});

test('types.d.ts declares every export index.js has, and every enum literal', () => {
  const dts = fs.readFileSync(path.join(ROOT, 'contracts', 'types.d.ts'), 'utf8');
  for (const k of Object.keys(C)) {
    if (k === k.toUpperCase()) continue; // consts checked below
    assert.ok(new RegExp('export function ' + k + '(<[^>]*>)?\\(').test(dts), 'types.d.ts lacks ' + k);
  }
  for (const k of ['VERSION', 'HEADER', 'ENUMS', 'SCHEMAS']) assert.ok(dts.includes('export const ' + k), 'types.d.ts lacks const ' + k);
  for (const [name, e] of Object.entries(C.ENUMS)) {
    if (!new RegExp('export type ' + name + ' =').test(dts)) continue; // not every enum is a named type
    for (const v of e.values) assert.ok(dts.includes("'" + v + "'"), 'types.d.ts type ' + name + ' lacks ' + v);
  }
});

// ── 2. the conventions ──────────────────────────────────────────────────────
test('money: the one dollars→cents boundary rounds like a till and refuses garbage', () => {
  assert.equal(C.centsFromDollars(61.2), 6120);
  assert.equal(C.centsFromDollars('$1,234.56'), 123456);
  assert.equal(C.centsFromDollars(0.285), 29, 'half rounds away from zero');
  assert.equal(C.centsFromDollars(-0.285), -29);
  assert.equal(C.centsFromDollars(1.1 + 2.2), 330, 'float noise does not become a cent');
  assert.throws(() => C.centsFromDollars('ten'));
  assert.throws(() => C.centsFromDollars(NaN));
  assert.throws(() => C.assertCents(1.5));
  assert.throws(() => C.money(100, 'dollars'));
  assert.deepEqual(C.money(100, 'inc_tax'), { cents: 100, currency: 'USD', basis: 'inc_tax' });
  assert.equal(C.dollarsFromCents(6120), 61.2);
});

test('ids: ObjectId, uuid-hex and slug are told apart; external ids are {source,id} and never a bare string', () => {
  assert.ok(C.isObjectId('5f9df52827e11708c30b7855'));
  assert.ok(!C.isObjectId('p_' + 'a'.repeat(32)));
  assert.ok(C.isUuidHex('a'.repeat(32)));
  assert.ok(C.isSlug('manisha-saini')); assert.ok(!C.isSlug('Manisha Saini'));
  assert.deepEqual(C.externalId('blaze', 'odkEgmqfW3MDJJedc3QJ'), { source: 'blaze', id: 'odkEgmqfW3MDJJedc3QJ' });
  assert.throws(() => C.externalId('shopify', '1'), /unknown id source/);
  assert.throws(() => C.externalId('blaze', ''), /empty/);
  assert.equal(C.formatExternalId(C.externalId('meadow', 42)), 'meadow:42');
  assert.deepEqual(C.parseExternalId('meadow:42'), { source: 'meadow', id: '42' });
  assert.equal(C.parseExternalId('nope'), null);
});

test('time: legacy epoch ms and wm-demo epoch seconds both become one ISO-UTC form', () => {
  assert.equal(C.isoFromEpoch(1757440000), '2025-09-09T17:46:40Z');
  assert.equal(C.isoFromEpoch(1757440000000), '2025-09-09T17:46:40Z');
  assert.equal(C.toIso('2026-09-09'), '2026-09-09T00:00:00Z');
  assert.ok(C.isIsoUtc(C.isoNow()));
  assert.ok(!C.isIsoUtc('2026-09-09T10:00:00'), 'no Z, not UTC');
  assert.ok(!C.isIsoUtc('2026-13-40T10:00:00Z'), 'a pattern match is not a date');
  assert.throws(() => C.epochMsFromIso('2026-09-09'));
});

test('roles: every vocabulary in the estate maps to the one enum, unknown falls to viewer', () => {
  assert.equal(C.roleFrom({ isSuperAdmin: true, userRoles: ['x'] }), 'superadmin');
  assert.equal(C.roleFrom({ userRoles: ['Super Admin'] }), 'superadmin');
  assert.equal(C.roleFrom({ userRoles: ['admin', 'viewer'] }), 'admin', 'highest wins');
  assert.equal(C.roleFrom('Floor Manager'), 'manager', 'Bounty MANAGER_ROLES');
  assert.equal(C.roleFrom('analyst'), 'manager', 'Verify analyst = estate manager');
  assert.equal(C.roleFrom('Budtender'), 'associate');
  assert.equal(C.roleFrom('whatever'), 'viewer');
  assert.equal(C.roleFrom(null), 'viewer');
  assert.ok(C.roleAtLeast('Admin', 'manager')); assert.ok(!C.roleAtLeast('Budtender', 'manager'));
});

test('errors and events: one shape, real HTTP codes, legacy shapes converted', () => {
  assert.deepEqual(C.error('not_found', 'no such session'), { error: { code: 'not_found', message: 'no such session' } });
  assert.equal(C.httpStatus('unprocessable'), 422);
  assert.throws(() => C.error('oops'));
  assert.deepEqual(C.errorFromLegacy(403, { error: 'read-only: public', hint: 'set the token' }),
    { error: { code: 'forbidden', message: 'read-only: public', details: { hint: 'set the token' } } });
  assert.deepEqual(C.errorFromLegacy(400, { message: 'bad' }).error.code, 'bad_request');
  const ev = C.event('order.completed', { id: 'o1' }, { source: 'hwpos', at: '2026-09-09T10:00:00Z', event_id: 'e1' });
  assert.deepEqual(ev, { event_id: 'e1', type: 'order.completed', contract: C.VERSION, at: '2026-09-09T10:00:00Z', source: 'hwpos', data: { id: 'o1' } });
  assert.ok(C.validate('Event', ev).ok);
  assert.throws(() => C.event('order.exploded', {}));
  assert.equal(C.signingPreimage(1757440000, { b: 2.005, a: [1, { z: 'x' }], c: 2.675, d: true }), '1757440000.{"a":[1,{"z":"x"}],"b":2,"c":2.67,"d":true}',
    'keys sorted, floats to 2dp by binary value (2.005→2, 2.675→2.67, as Python round), integral numbers without a point, no whitespace');
  assert.match(C.randomHex(8), /^[0-9a-f]{16}$/);
});

test('validate: a contract Order passes, a mutated one names every defect', () => {
  const order = { id: 'ORD-00224', platform: 'hyperwolf', store_id: 'elsinore', status: 'completed', txn_type: 'sale',
    created_at: '2026-09-09T10:00:00Z', subtotal: C.money(5400, 'ex_tax_gross'), discount: C.money(400, 'ex_tax_gross'),
    total: C.money(6120, 'inc_tax'), associate_id: 'manisha-saini',
    lines: [{ product_id: 'cake-crasher', name: 'Cake Crasher', quantity: 1, unit_price: C.money(5400, 'ex_tax_gross'), line_gross: C.money(5400, 'ex_tax_gross'), discount: C.money(400, 'ex_tax_gross') }],
    external_ids: [C.externalId('hwpos', 'ORD-00224')] };
  assert.deepEqual(C.validate('Order', order), { ok: true, errors: [] });
  const bad = JSON.parse(JSON.stringify(order));
  bad.status = 'done'; bad.total.cents = 61.2; delete bad.store_id; bad.lines[0].quantity = -1; bad.external_ids[0].source = 'shopify';
  const r = C.validate('Order', bad);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [
    '$: missing required store_id',
    '$.status: "done" is not a OrderStatus',
    '$.total.cents: expected integer, got number',
    '$.lines[0].quantity: below minimum 0',
    '$.external_ids[0].source: "shopify" is not a IdSource',
  ]);
  assert.equal(C.validate('Nope', {}).ok, false);
  for (const name of Object.keys(C.SCHEMAS)) assert.equal(C.validate(name, null).ok, false, name + ' accepts null');
});

test('PlanLine: batch identity fields (batch_no/thc_pct/packaged_at/received_at/expires_at) validate present or absent', () => {
  const base = { product_id: 'cake-crasher', batch_id: 'B-1001', to_location_id: 'loc-foh-1',
    sold: 3, need: 5, cap: 10, give: 5, reasons: [] };
  const withBatchMeta = { ...base, batch_no: 'BN-2026-0914', thc_pct: 21.4,
    packaged_at: '2026-09-01T10:00:00Z', received_at: '2026-09-05T10:00:00Z', expires_at: '2027-03-01T00:00:00Z' };
  assert.deepEqual(C.validate('PlanLine', withBatchMeta), { ok: true, errors: [] });
  const withoutBatchMeta = { ...base, batch_no: null, thc_pct: null, packaged_at: null, received_at: null, expires_at: null,
    note: 'mixed batch, see pick sheet' };
  assert.deepEqual(C.validate('PlanLine', withoutBatchMeta), { ok: true, errors: [] });
  const missingEntirely = { ...base }; // fields omitted altogether, not just null -- also valid (additive, optional)
  assert.deepEqual(C.validate('PlanLine', missingEntirely), { ok: true, errors: [] });
  const bad = { ...base, thc_pct: 142, packaged_at: '2026-09-01' };
  const r = C.validate('PlanLine', bad);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [
    '$.thc_pct: above maximum 100',
    '$.packaged_at: "2026-09-01" does not match ' + '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$',
  ]);
});

// ── 2a. Cash drawers (Team 6a, ADMIN-GAP-LIST-2026-09-17.md §B "Drawers") ───

test('RegisterSession: an open session and a fully-closed one both validate; a mutated one names every defect', () => {
  const open = { id: '1', store_id: 'corona', register_id: '1', opened_by: 'devon-ruiz',
    opened_at: '2026-09-17T14:00:00Z', opening_float_cents: 30000,
    expected_cash_cents: null, counted_cash_cents: null, variance_cents: null,
    needs_review: false, status: 'open', closed_by: null, closed_at: null,
    voided_by: null, voided_at: null, void_reason: null, notes: null,
    drops: [], counts: [] };
  assert.deepEqual(C.validate('RegisterSession', open), { ok: true, errors: [] });

  const closed = { ...open, status: 'closed', closed_by: 'manisha-saini',
    closed_at: '2026-09-17T22:05:00Z', expected_cash_cents: 84500,
    counted_cash_cents: 84200, variance_cents: -300, needs_review: false,
    drops: [{ id: '1', session_id: '1', amount_cents: 20000, reason: 'drop', by: 'manisha-saini',
              at: '2026-09-17T20:00:00Z', bag_ref: 'BAG-4471' }],
    counts: [{ id: '1', session_id: '1', kind: 'closing',
               denominations: { '10000': 5, '2000': 3, '100': 20 }, total_cents: 58600,
               by: 'manisha-saini', at: '2026-09-17T22:00:00Z' }] };
  assert.deepEqual(C.validate('RegisterSession', closed), { ok: true, errors: [] });

  const bad = JSON.parse(JSON.stringify(closed));
  bad.status = 'shredded'; delete bad.opened_by; bad.opening_float_cents = -5;
  bad.drops[0].reason = 'skim'; bad.counts[0].total_cents = -1;
  const r = C.validate('RegisterSession', bad);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [
    '$: missing required opened_by',
    '$.opening_float_cents: below minimum 0',
    '$.status: "shredded" is not a RegisterSessionStatus',
    '$.drops[0].reason: "skim" is not a CashDropReason',
    '$.counts[0].total_cents: below minimum 0',
  ]);
});

test('CashDrop and CashCount reject over-posting (additionalProperties:false)', () => {
  const drop = { id: '1', session_id: '1', amount_cents: 5000, reason: 'paid_out',
    by: 'devon-ruiz', at: '2026-09-17T18:00:00Z', bag_ref: null };
  assert.deepEqual(C.validate('CashDrop', drop), { ok: true, errors: [] });
  assert.equal(C.validate('CashDrop', { ...drop, total_cents: 5000 }).ok, false,
    'a client-supplied total on a drop must be rejected, never silently accepted');

  const count = { id: '1', session_id: '1', kind: 'opening', denominations: { '10000': 3 },
    total_cents: 30000, by: 'devon-ruiz', at: '2026-09-17T14:00:00Z' };
  assert.deepEqual(C.validate('CashCount', count), { ok: true, errors: [] });
  assert.equal(C.validate('CashCount', { ...count, verified_total_cents: 30000 }).ok, false);
});

// ── 2b. Tax (Team 6b, ADMIN-GAP-LIST-2026-09-17.md §B "Tax") ────────────────
test('TaxRate: a valid EXAMPLE row passes; bad rate_bps, unknown enum and over-posting are all named', () => {
  const rate = { id: 'TR-1', store_id: null, jurisdiction_kind: 'state', jurisdiction_name: 'California',
    kind: 'excise', basis: 'pre_tax', rate_bps: 1500, applies_to: 'cannabis', member_type: 'all',
    effective_from: '2026-09-17', effective_to: null, note: 'EXAMPLE -- confirm with JT' };
  assert.deepEqual(C.validate('TaxRate', rate), { ok: true, errors: [] });
  const bad = JSON.parse(JSON.stringify(rate));
  bad.rate_bps = 10001; bad.kind = 'federal'; bad.extra_field = 'nope';
  const r = C.validate('TaxRate', bad);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [
    '$.kind: "federal" is not a TaxKind',
    '$.rate_bps: above maximum 10000',
    '$: unexpected property extra_field',
  ]);
  assert.equal(C.validate('TaxRate', { ...rate, rate_bps: -1 }).ok, false, 'negative rate_bps rejected');
  assert.equal(C.validate('TaxRate', { ...rate, effective_from: '2026-9-17' }).ok, false, 'non-padded date rejected');
});

test('TaxLine and TaxBreakdown: valid shapes pass, a bad nested TaxLine fails the whole breakdown', () => {
  const line = { rate_id: 'TR-1', kind: 'excise', jurisdiction: 'California', rate_bps: 1500, basis: 'pre_tax', tax_cents: 450 };
  assert.deepEqual(C.validate('TaxLine', line), { ok: true, errors: [] });
  const breakdown = { lines: [{ line_idx: 0, taxable_cents: 3000, taxes: [line] }], totals: { excise: 450 }, total_tax_cents: 450 };
  assert.deepEqual(C.validate('TaxBreakdown', breakdown), { ok: true, errors: [] });
  const badLine = { ...line, tax_cents: -1 };
  const badBreakdown = { ...breakdown, lines: [{ line_idx: 0, taxable_cents: 3000, taxes: [badLine] }] };
  const r = C.validate('TaxBreakdown', badBreakdown);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, ['$.lines[0].taxes[0].tax_cents: below minimum 0']);
  assert.equal(C.validate('TaxBreakdown', { lines: [], totals: {}, total_tax_cents: 0 }).ok, true, 'no taxes fired is valid');
});

test('the refuter inputs: both runtimes now agree and both fail closed', () => {
  assert.equal(C.roleAtLeast('viewer', 'Manager'), false, 'an unknown need denies, never grants');
  assert.equal(C.roleAtLeast('Admin', 'manager'), true);
  assert.equal(C.roleFrom({ userRoles: [], role: 'admin' }), 'admin', 'an empty userRoles falls through to role');
  assert.equal(C.validate('Money', JSON.parse('{"cents":1,"currency":"USD","basis":"inc_tax","toString":1}')).ok, false, 'prototype keys are not own properties');
  assert.equal(C.isIsoUtc('2026-02-30T00:00:00Z'), false, 'Feb 30 is not a date even though V8 rolls it');
  assert.equal(C.isIsoUtc('2026-09-09T24:00:00Z'), false);
  assert.equal(C.isoFromEpoch(1757440000.7), '2025-09-09T17:46:40Z', 'fractional seconds truncate');
  assert.equal(C.validate('Money', { cents: Infinity, currency: 'USD', basis: 'inc_tax' }).ok, false);
  assert.throws(() => C.toIso('2026-09-09T10:00:00'), /not a time/, 'no local-time parsing');
  assert.throws(() => C.centsFromDollars('5.50abc'));
  assert.throws(() => C.centsFromDollars('1_000'));
  assert.equal(C.canonicalJson({ a: undefined, b: 1 }), '{"b":1}', 'undefined properties are dropped, never printed');
  assert.equal(C.canonicalJson([1, undefined]), '[1,null]');
  assert.equal(C.signingPreimage(1, { progress: 0.125, neg: -0.125 }), '1.{"neg":-0.13,"progress":0.13}', 'exact binary ties round away from zero');
});

// ── 2b. cross-runtime parity, computed, not hand-typed ─────────────────────
import { spawnSync } from 'node:child_process';
const py = spawnSync('python3', ['--version']);
const canPy = py.status === 0 && fs.existsSync(path.join(WM, 'wmdemo', 'contracts.py'));
test('Python twin agrees with JS on validator messages, preimage, roles, money and time (computed by running python3)', { skip: !canPy && 'python3 or wm-demo not available' }, () => {
  const bad = { id: 'o1', platform: 'wm', status: 'done', total: { cents: 1.5, currency: 'USD', basis: 'inc_tax' }, lines: [{ product_id: 'x', name: 'x', quantity: -1, unit_price: null, line_gross: { cents: 1, currency: 'USD', basis: 'ex_tax_gross' }, discount: { cents: 0.5, currency: 'USD', basis: 'ex_tax_gross' } }], external_ids: [{ source: 'shopify', id: '' }] };
  const body = { b: 2.005, a: [1, { z: 'x' }], c: 2.675, d: true, e: 0.125, f: -0.125, g: 123456789012.5, h: 'ünï', i: null };
  const cases = { bad, body, roles: [{ isSuperAdmin: true }, { userRoles: ['Super Admin'] }, { userRoles: [], role: 'admin' }, ' Floor Manager ', 'analyst', 'nobody', null],
    dollars: ['$61.20', '1,234.56', 0.285, -0.285, 1.005, 2.675, 0.1 + 0.2, '0.125'], epochs: [1757440000, 1757440000.7, 1757440000000, 0], isos: ['2026-02-30T00:00:00Z', '2026-09-09T24:00:00Z', '2026-09-09T10:00:00Z\n', '2026-09-09T10:00:00.123Z', '2026-13-01T00:00:00Z'] };
  const jsOut = { errors: C.validate('Order', cases.bad).errors, preimage: C.signingPreimage(7, cases.body),
    roles: cases.roles.map((r) => C.roleFrom(r)), atLeast: [C.roleAtLeast('viewer', 'Manager'), C.roleAtLeast('Admin', 'manager')],
    dollars: cases.dollars.map((d) => C.centsFromDollars(d)), epochs: cases.epochs.map((e) => C.isoFromEpoch(e)), isos: cases.isos.map((s) => C.isIsoUtc(s)) };
  const script = `
import json, sys; sys.path.insert(0, ${JSON.stringify(WM)})
import os; os.environ['HW_CONTRACTS_DIR'] = ${JSON.stringify(path.join(ROOT, 'contracts'))}
from wmdemo import contracts as C
cases = json.loads(sys.stdin.read())
print(json.dumps({'errors': C.validate('Order', cases['bad'])['errors'], 'preimage': C.signing_preimage(7, cases['body']),
  'roles': [C.role_from(r) for r in cases['roles']], 'atLeast': [C.role_at_least('viewer', 'Manager'), C.role_at_least('Admin', 'manager')],
  'dollars': [C.cents_from_dollars(d) for d in cases['dollars']], 'epochs': [C.iso_from_epoch(e) for e in cases['epochs']], 'isos': [C.is_iso_utc(s) for s in cases['isos']]}))`;
  const r = spawnSync('python3', ['-c', script], { input: JSON.stringify(cases), encoding: 'utf8' });
  assert.equal(r.status, 0, 'python failed: ' + r.stderr);
  const pyOut = JSON.parse(r.stdout);
  assert.deepEqual(pyOut, JSON.parse(JSON.stringify(jsOut)), 'JS and Python disagree');
});

test('Tax: Python twin (wmdemo/contracts.py validate()) agrees on TaxRate/TaxBreakdown verdicts',
  { skip: !canPy && 'python3 or wm-demo not available' }, () => {
  const goodRate = { id: 'TR-1', store_id: null, jurisdiction_kind: 'state', jurisdiction_name: 'California',
    kind: 'sales', basis: 'post_excise', rate_bps: 600, applies_to: 'cannabis', member_type: 'recreational',
    effective_from: '2026-09-17', effective_to: null };
  const badRate = { ...goodRate, rate_bps: 99999 };
  const jsOut = { good: C.validate('TaxRate', goodRate), bad: C.validate('TaxRate', badRate) };
  const script = `
import json, sys; sys.path.insert(0, ${JSON.stringify(WM)})
import os; os.environ['HW_CONTRACTS_DIR'] = ${JSON.stringify(path.join(ROOT, 'contracts'))}
from wmdemo import contracts as C
cases = json.loads(sys.stdin.read())
print(json.dumps({'good': C.validate('TaxRate', cases['good']), 'bad': C.validate('TaxRate', cases['bad'])}))`;
  const r = spawnSync('python3', ['-c', script], { input: JSON.stringify({ good: goodRate, bad: badRate }), encoding: 'utf8' });
  assert.equal(r.status, 0, 'python failed: ' + r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), JSON.parse(JSON.stringify(jsOut)), 'JS and Python disagree on TaxRate');
});

// ── 2c. PromotionRule fixtures: the one file list both runtimes must agree on ─
const RULE_FIXTURES_DIR = path.join(ROOT, 'contracts', 'fixtures', 'promotion-rule');
test('PromotionRule valid fixtures: every one passes both validate() and validatePromotionRule()', () => {
  const dir = path.join(RULE_FIXTURES_DIR, 'valid');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 12, 'expected at least 12 valid fixtures, found ' + files.length);
  for (const f of files) {
    const rule = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const v = C.validate('PromotionRule', rule);
    assert.deepEqual(v.errors, [], f + ' failed validate(): ' + JSON.stringify(v.errors));
    const p = C.validatePromotionRule(rule);
    assert.deepEqual(p.errors, [], f + ' failed validatePromotionRule(): ' + JSON.stringify(p.errors));
  }
  // every op and every then.kind appears at least once across the set
  const rules = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const seenOps = new Set(), seenKinds = new Set();
  const walkOps = (node) => { if (!node) return; if (node.op) seenOps.add(node.op);
    ['all', 'any', 'not'].forEach((k) => (node[k] || []).forEach(walkOps)); };
  for (const r of rules) { walkOps(r.if); seenKinds.add(r.then.kind); }
  assert.deepEqual([...seenOps].sort(), [...C.ENUMS.RuleOp.values].sort(), 'a RuleOp is missing from the valid fixtures');
  assert.deepEqual([...seenKinds].sort(), [...C.ENUMS.RuleThenKind.values].sort(), 'a RuleThenKind is missing from the valid fixtures');
});

test('PromotionRule invalid fixtures: every one fails validatePromotionRule() and names the offending path', () => {
  const dir = path.join(RULE_FIXTURES_DIR, 'invalid');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 15, 'expected at least 15 invalid fixtures, found ' + files.length);
  for (const f of files) {
    const rule = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const r = C.validatePromotionRule(rule);
    assert.equal(r.ok, false, f + ' was expected to be invalid');
    assert.ok(r.errors.length > 0 && r.errors.every((e) => e.startsWith('$')), f + ' error does not name a path: ' + JSON.stringify(r.errors));
  }
});

const wmDemoExists = fs.existsSync(path.join(WM, 'wmdemo', 'contracts.py'));
test('PromotionRule fixtures: Python twin (wmdemo/contracts.py validate()) agrees on every fixture verdict', { skip: !canPy && 'python3 or wm-demo not available' }, () => {
  if (!wmDemoExists) return; // contracts.py itself absent is covered by the skip above in practice
  const validFiles = fs.readdirSync(path.join(RULE_FIXTURES_DIR, 'valid')).filter((f) => f.endsWith('.json'));
  const invalidFiles = fs.readdirSync(path.join(RULE_FIXTURES_DIR, 'invalid')).filter((f) => f.endsWith('.json'));
  const script = `
import json, sys; sys.path.insert(0, ${JSON.stringify(WM)})
import os; os.environ['HW_CONTRACTS_DIR'] = ${JSON.stringify(path.join(ROOT, 'contracts'))}
from wmdemo import contracts as C
names = json.loads(sys.stdin.read())
out = {}
for kind, files in names.items():
    out[kind] = {}
    for fn, rule in files.items():
        out[kind][fn] = C.validate('PromotionRule', rule)['ok']
print(json.dumps(out))`;
  const payload = { valid: {}, invalid: {} };
  for (const f of validFiles) payload.valid[f] = JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'valid', f), 'utf8'));
  for (const f of invalidFiles) payload.invalid[f] = JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'invalid', f), 'utf8'));
  const r = spawnSync('python3', ['-c', script], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(r.status, 0, 'python failed: ' + r.stderr);
  const pyOut = JSON.parse(r.stdout);
  // This checks Python's plain schema-level validate() ONLY, not the structural walk (that's the
  // separate test below, now that wmdemo/contracts.py has its own validate_promotion_rule).
  // So: every valid JS fixture must also pass Python's schema validate(); an invalid fixture whose
  // defect is schema-shaped (bad enum, missing/extra key) must also fail Python's validate() --
  // invalid fixtures whose defect is a structural-only rule (depth/nodes/list/string, both/neither
  // form, op-type/value-type) are schema-valid and are EXPECTED to pass Python's plain validate().
  const structuralOnly = new Set(['op-type-mismatch.json', 'depth-5-exceeds-limit.json', '51-condition-nodes.json',
    '201-item-list.json', 'both-forms-one-node.json', 'neither-form.json', 'value-type-wrong.json', 'string-too-long.json',
    'in-op-value-not-array.json',
    // 2026-09-16 tree-size-cap + then.value fixtures: all schema-valid (the subset has no
    // maxItems and then.value is deliberately typeless), rejected only by validatePromotionRule.
    '51-empty-groups-no-conditions.json', '1000-empty-groups-exceeds-max-bytes.json',
    'nested-group-51-items-exceeds-max-group-items.json', 'rule-exceeds-max-bytes-with-legal-lists.json',
    'then-value-percent-101-exceeds-max.json', 'then-value-percent-zero-not-positive.json',
    'then-value-percent-too-many-decimals.json', 'then-value-price-negative.json', 'then-value-amount-zero.json',
    'then-value-points-fractional.json', 'then-value-gift-empty-string.json']);
  // then-cap-cents-negative.json and then-max-per-order-zero.json are NOT structural-only:
  // cap_cents/max_per_order don't depend on then.kind, so their `minimum` lives in the schema
  // itself (SCHEMAS.PromotionRule.then) and Python's plain validate() already rejects them.
  for (const f of validFiles) assert.equal(pyOut.valid[f], true, 'python validate() rejected valid fixture ' + f);
  for (const f of invalidFiles) {
    const expected = !structuralOnly.has(f);
    assert.equal(pyOut.invalid[f], !expected, 'python validate() disagreed with JS schema verdict on ' + f);
  }
});

// wmdemo/contracts.py now carries its own validate_promotion_rule (2026-09-16, mirroring
// validatePromotionRule line-for-line -- byte-size gate first, every node counted, max_group_items
// capped before recursing, then.value checked per then.kind). Full parity, not just the
// schema-level check above: every fixture must get the SAME ok/not-ok verdict on both sides.
test('PromotionRule fixtures: Python twin validate_promotion_rule() agrees with JS validatePromotionRule() on every verdict', { skip: !canPy && 'python3 or wm-demo not available' }, () => {
  if (!wmDemoExists) return;
  const validFiles = fs.readdirSync(path.join(RULE_FIXTURES_DIR, 'valid')).filter((f) => f.endsWith('.json'));
  const invalidFiles = fs.readdirSync(path.join(RULE_FIXTURES_DIR, 'invalid')).filter((f) => f.endsWith('.json'));
  const script = `
import json, sys; sys.path.insert(0, ${JSON.stringify(WM)})
import os; os.environ['HW_CONTRACTS_DIR'] = ${JSON.stringify(path.join(ROOT, 'contracts'))}
from wmdemo import contracts as C
names = json.loads(sys.stdin.read())
out = {}
for kind, files in names.items():
    out[kind] = {}
    for fn, rule in files.items():
        if not hasattr(C, 'validate_promotion_rule'):
            out[kind][fn] = None
        else:
            out[kind][fn] = C.validate_promotion_rule(rule)['ok']
print(json.dumps(out))`;
  const payload = { valid: {}, invalid: {} };
  for (const f of validFiles) payload.valid[f] = JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'valid', f), 'utf8'));
  for (const f of invalidFiles) payload.invalid[f] = JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'invalid', f), 'utf8'));
  const r = spawnSync('python3', ['-c', script], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(r.status, 0, 'python failed: ' + r.stderr);
  const pyOut = JSON.parse(r.stdout);
  if (Object.values(pyOut.valid)[0] === null) return; // older wm-demo checkout with no validate_promotion_rule yet
  for (const f of validFiles) {
    const js = C.validatePromotionRule(JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'valid', f), 'utf8')));
    assert.equal(pyOut.valid[f], js.ok, 'validate_promotion_rule disagreed on valid fixture ' + f);
  }
  for (const f of invalidFiles) {
    const js = C.validatePromotionRule(JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'invalid', f), 'utf8')));
    assert.equal(pyOut.invalid[f], js.ok, 'validate_promotion_rule disagreed on invalid fixture ' + f);
  }
});

// The two refuter attack payloads (scratchpad attack2.cjs, 2026-09-16) rebuilt here PROGRAMMATICALLY
// -- never checked in as fixture files -- so the tree-size cap is proven against the exact shape
// that broke it (empty groups, no leaf conditions, well under max_depth) without a 6-29 MB file in git.
test('validatePromotionRule rejects the refuter\'s unbounded-empty-groups DoS payloads, fast and by name', () => {
  const validBase = JSON.parse(fs.readFileSync(path.join(RULE_FIXTURES_DIR, 'valid', 'op-eq-product-sku.json'), 'utf8'));
  const emptyGroup = () => ({ all: [], any: [], not: [] });
  for (const n of [200000, 1000000]) {
    const rule = JSON.parse(JSON.stringify(validBase));
    rule.if = { all: Array.from({ length: n }, emptyGroup), any: [], not: [] };
    const t0 = Date.now();
    const r = C.validatePromotionRule(rule);
    const ms = Date.now() - t0;
    assert.equal(r.ok, false, n + ' empty groups must be rejected');
    assert.ok(r.errors.length === 1 && r.errors[0].includes('max_bytes'), n + ' empty groups: expected a max_bytes error, got ' + JSON.stringify(r.errors));
    assert.ok(ms < 2000, n + ' empty groups took ' + ms + 'ms -- the byte-size gate should reject before any recursion, not walk the tree');
  }
});

// ── 2d. HR/LP fixtures (Team 3b, BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §4 Track 3) ─────────
// Each fixture is { shape, record } so one flat directory per domain can cover several shapes
// (HrEmployee/HrEmployeeRestricted/Incident/WriteUp/CallOff in hr/, CloserReport/LossLedgerEntry in lp/).
function checkFixtureDomain(domain, minValid, minInvalid) {
  const dir = path.join(ROOT, 'contracts', 'fixtures', domain);
  test(domain + ' fixtures: every valid fixture passes validate() for its declared shape', () => {
    const files = fs.readdirSync(path.join(dir, 'valid')).filter((f) => f.endsWith('.json'));
    assert.ok(files.length >= minValid, 'expected at least ' + minValid + ' valid ' + domain + ' fixtures, found ' + files.length);
    for (const f of files) {
      const { shape, record } = JSON.parse(fs.readFileSync(path.join(dir, 'valid', f), 'utf8'));
      const v = C.validate(shape, record);
      assert.deepEqual(v.errors, [], f + ' (' + shape + ') failed validate(): ' + JSON.stringify(v.errors));
    }
  });
  test(domain + ' fixtures: every invalid fixture fails validate() for its declared shape and names the path', () => {
    const files = fs.readdirSync(path.join(dir, 'invalid')).filter((f) => f.endsWith('.json'));
    assert.ok(files.length >= minInvalid, 'expected at least ' + minInvalid + ' invalid ' + domain + ' fixtures, found ' + files.length);
    for (const f of files) {
      const { shape, record } = JSON.parse(fs.readFileSync(path.join(dir, 'invalid', f), 'utf8'));
      const v = C.validate(shape, record);
      assert.equal(v.ok, false, f + ' (' + shape + ') was expected to be invalid');
      assert.ok(v.errors.length > 0 && v.errors.every((e) => e.startsWith('$')), f + ' error does not name a path: ' + JSON.stringify(v.errors));
    }
  });
}
checkFixtureDomain('hr', 10, 15); // 5 shapes x (2 valid + 3 invalid)
checkFixtureDomain('lp', 4, 6);   // 2 shapes x (2 valid + 3 invalid)
// Team 6c: Region (ADMIN-GAP-LIST-2026-09-17.md §B Regions; ADMIN-LIVE-AUDIT-2026-09-17.md
// /regions). 3 valid (minimal, full incl. nested RegionHours + KML, a sub-region) + 3 invalid
// (missing required `name`, `active` wrong type, RegionHours' own additionalProperties:false
// catching an unknown weekday key nested under opening_hours).
// Fix pass on refute-modules-2.md finding #8: +1 valid (store_id set) + 1 invalid
// (store_id wrong type) proving the new nullable field is enforced.
checkFixtureDomain('region', 4, 4);
// Metrc Phase 1 (READ-ONLY foundation, METRC-PROGRAM-PLAN-2026-09-17.md §5): MetrcPackage/
// MetrcLedgerLine/MetrcReconVariance, 3 shapes x (2 valid + 3 invalid).
checkFixtureDomain('metrc', 6, 9);
// SaleLine (docs/SALES.md, wmdemo/pos_sale_lines.py): the line-grain sale ledger. 4 valid
// (fefo_bulk, not_tracked minimal, unit_tracked, a void's negated quantity) + 4 invalid
// (missing required, bad resolution_path, bad priced_by, negative line_no).
checkFixtureDomain('sales', 2, 3);
// Batch compliance: optional/null overrides, all buckets, nonnegative integer amounts and typed fields.
checkFixtureDomain('batch-compliance', 6, 10);

test('HrEmployee is the over-posting guard for HrEmployeeRestricted: restricted PII on an HrEmployee record is rejected', () => {
  const withSsn = { source_ref: { base: 'app8mI9K1lS1D3Uhk', table: 'tblDtY9WsQGQOgHgw', record_id: 'recX' },
    entity_id: 'entTHC', display_name: 'X', status: 'active', ssn: '000-00-0000' };
  const v = C.validate('HrEmployee', withSsn);
  assert.equal(v.ok, false, 'HrEmployee must reject an ssn property (additionalProperties:false)');
});

test('PII_CLASS: every HrEmployeeRestricted property is restricted, and none of its properties appear on HrEmployee', () => {
  for (const k of Object.keys(C.SCHEMAS.HrEmployeeRestricted.properties)) {
    if (k === 'source_ref' || k === 'person_id' || k === 'entity_id') continue; // structural/join keys, not PII
    assert.equal(C.PII_CLASS['HrEmployeeRestricted.' + k], 'restricted', k + ' should be restricted');
    assert.ok(!(k in C.SCHEMAS.HrEmployee.properties), 'HrEmployee must not also carry restricted field ' + k);
  }
});

test('PII_CLASS covers every property of every 0.5.0 Track-3 shape (no gaps a route could misclassify)', () => {
  for (const shape of ['HrEmployee', 'HrEmployeeRestricted', 'Incident', 'WriteUp', 'CallOff', 'CloserReport', 'LossLedgerEntry']) {
    for (const prop of Object.keys(C.SCHEMAS[shape].properties)) {
      const key = shape + '.' + prop;
      assert.ok(key in C.PII_CLASS, 'PII_CLASS missing ' + key);
      assert.ok(['restricted', 'internal', 'normal'].includes(C.PII_CLASS[key]), key + ' has a bad PII_CLASS value');
    }
  }
});

// ── 3. drift against the estate ─────────────────────────────────────────────
function pyTuple(file, name) {
  const src = fs.readFileSync(file, 'utf8').replace(/#[^\n]*/g, '');
  const m = new RegExp('^' + name + '\\s*=\\s*\\(([\\s\\S]*?)\\)', 'm').exec(src);
  assert.ok(m, name + ' not found in ' + file);
  return [...m[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((x) => x[1] || x[2]);
}
const wmExists = fs.existsSync(path.join(WM, 'wmdemo'));
test('our estate: wm-demo enums still equal the contract (FAILS on drift)', { skip: !wmExists && 'wm-demo not at ' + WM }, () => {
  assert.deepEqual(pyTuple(path.join(WM, 'wmdemo/incentives/schema.py'), 'CLASSES'), C.enumValues('Classification'));
  assert.deepEqual(pyTuple(path.join(WM, 'wmdemo/incentives/scoring.py'), 'METRICS'), C.enumValues('Metric'));
  assert.deepEqual(pyTuple(path.join(WM, 'wmdemo/incentives/scoring.py'), 'KINDS'), C.enumValues('ContestKind'));
  assert.deepEqual(pyTuple(path.join(WM, 'wmdemo/incentives/education.py'), 'STATUSES'), C.enumValues('SnapStatus'));
  const pk = pyTuple(path.join(WM, 'wmdemo/incentives/rewards.py'), 'KINDS');
  assert.deepEqual(pk, C.enumValues('PointsKind').filter((k) => k !== 'redeemed' && k !== 'expired'), 'rewards KINDS (redeemed/expired are the Rewards-service and Engage additions)');
  // Estate files that own a 0.3.0 vocabulary.
  const jsList = (file, name) => { const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const m = new RegExp('(?:const |window\\.)' + name + '\\s*=\\s*\\[([^\\]]*)\\]').exec(src); assert.ok(m, name + ' in ' + file);
    return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]); };
  assert.deepEqual(jsList('promo/pshared.jsx', 'DISCOUNT_KINDS'), C.enumValues('DiscountKind'), 'promo/pshared.jsx DISCOUNT_KINDS');
  assert.deepEqual(jsList('engage/data.jsx', 'CAMPAIGN_STATUSES'), C.enumValues('CampaignStatus'), 'engage CAMPAIGN_STATUSES');
  assert.deepEqual(jsList('engage/data.jsx', 'FLOW_STATUSES'), C.enumValues('FlowStatus'), 'engage FLOW_STATUSES');
  assert.deepEqual(jsList('engage/data.jsx', 'AUDIENCE_STATUSES'), C.enumValues('AudienceStatus'), 'engage AUDIENCE_STATUSES');
  assert.deepEqual(pyTuple(path.join(WM, 'wmdemo/idv_rules.py'), 'STATUSES'), C.enumValues('VerificationStatus'));
  const server = fs.readFileSync(path.join(WM, 'wmdemo/server.py'), 'utf8');
  const tx = /txn_type not in \(([^)]*)\)/.exec(server); assert.ok(tx);
  assert.deepEqual([...tx[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]), C.enumValues('TxnType'));
  const contests = fs.readFileSync(path.join(WM, 'wmdemo/incentives/contests.py'), 'utf8');
  const mr = /MANAGER_ROLES\s*=\s*frozenset\(\[([^\]]*)\]\)/.exec(contests); assert.ok(mr);
  for (const r of [...mr[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])) assert.ok(C.roleAtLeast(r, 'manager'), r + ' must map to manager+');
  const idvApi = fs.readFileSync(path.join(WM, 'wmdemo/idv_api.py'), 'utf8');
  for (const r of ['viewer', 'analyst', 'admin']) assert.ok(idvApi.includes('"' + r + '"') || idvApi.includes("'" + r + "'"), 'Verify ladder still names ' + r);
  // 0.2.0 enums copied from estate files: keep those files the source of truth.
  const domain = fs.readFileSync(path.join(ROOT, 'pipeline/domain.jsx'), 'utf8');
  // The literal is now a fallback (BATCH_STATUS_ORDER = contract.enumValues(...) || [...]);
  // match the fallback array itself, wherever the '[' lands after '='.
  const bs = /BATCH_STATUS_ORDER\s*=[^[]*\[([^\]]*)\]/.exec(domain); assert.ok(bs);
  assert.deepEqual([...bs[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), C.enumValues('BatchStage'), 'pipeline/domain.jsx BATCH_STATUS_ORDER');
  const fulfil = fs.readFileSync(path.join(WM, 'wmdemo/fulfillment.py'), 'utf8');
  const wm = /WM_STATUS_ORDER\s*=\s*\(([^)]*)\)/.exec(fulfil); assert.ok(wm);
  for (const v of [...wm[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1])) assert.ok(C.isEnum('WeedmapsOrderStatus', v), 'WeedmapsOrderStatus lacks ' + v);
  const chk = fs.readFileSync(path.join(WM, 'wmdemo/checkin_api.py'), 'utf8');
  // The module boots from contracts.vocab("CheckinState", (<local literal>), …); the literal is the source.
  const all = /_ALL_STATES\s*=\s*(?:contracts\.vocab\("CheckinState",\s*)?\(([^)]*)\)/.exec(chk); assert.ok(all);
  assert.deepEqual([...all[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]), C.enumValues('CheckinState'), 'checkin_api.py _ALL_STATES');
  const hwlive = fs.readFileSync(path.join(ROOT, 'shared/hw-live.js'), 'utf8');
  const lfs = /HW_LIVE_STATES\s*=\s*(?:Object\.freeze\()?\[([^\]]*)\]/.exec(hwlive); assert.ok(lfs, 'shared/hw-live.js HW_LIVE_STATES');
  assert.deepEqual([...lfs[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]), C.enumValues('LiveFeedStatus'), 'HW_LIVE_STATES');
  // every reason the Verify rules can emit must be in the enum, or contracts.py's is_enum filter
  // drops it from outbound payloads (0.3.2 found 15 such). Order-free: the doc block owns order.
  const rules = fs.readFileSync(path.join(WM, 'wmdemo/idv_rules.py'), 'utf8');
  const emitted = new Set();
  for (const name of ['REASONS_RETRYABLE', 'REASONS_DECLINE']) {
    const m = rules.match(new RegExp('^' + name + ' = frozenset\\(\\(([\\s\\S]*?)\\)\\)', 'm'));
    assert.ok(m, name + ' in idv_rules.py');
    for (const r of m[1].matchAll(/"([A-Z0-9_]+)"/g)) emitted.add(r[1]);
  }
  const enumSet = new Set(C.enumValues('VerificationReason'));
  assert.deepEqual([...emitted].filter((r) => !enumSet.has(r)), [], 'idv_rules.py reasons missing from VerificationReason');
  const contract = fs.readFileSync(path.join(ROOT, 'docs/IDV-API-CONTRACT.md'), 'utf8');
  const reasons = [...contract.slice(contract.indexOf('// Reason'), contract.indexOf('// Score')).matchAll(/\b[A-Z][A-Z0-9_]{3,}\b/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(reasons)], C.enumValues('VerificationReason'), 'IDV-API-CONTRACT Reason list');
});

const htExists = fs.existsSync(path.join(HT, 'promotion-engine'));
test('production repos: report (or, with HW_CONTRACTS_STRICT_PROD=1, fail) where they disagree', { skip: !htExists && 'Hyper-Tech clones not at ' + HT }, () => {
  const strict = process.env.HW_CONTRACTS_STRICT_PROD === '1';
  const drift = [];
  const check = (what, actual, expected) => { const a = [...actual].sort(), e = [...expected].sort();
    if (JSON.stringify(a) !== JSON.stringify(e)) drift.push(what + ': repo says ' + JSON.stringify(a) + ', contract says ' + JSON.stringify(e)); };
  const jsArray = (file, name) => { const src = fs.readFileSync(file, 'utf8');
    const m = new RegExp('const ' + name + '\\s*=\\s*\\[([^\\]]*)\\]').exec(src); assert.ok(m, name + ' in ' + file);
    return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]); };
  check('promotion-engine rule-types/', fs.readdirSync(path.join(HT, 'promotion-engine/rule-types')).filter((d) => !d.includes('.')), C.enumValues('RuleType'));
  const consts = fs.readFileSync(path.join(HT, 'promotion-engine/core/constants.js'), 'utf8');
  const rt = /const RULE_TYPES = \{([^}]*)\}/.exec(consts); check('promotion-engine constants.js RULE_TYPES', [...rt[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]), C.enumValues('RuleType'));
  const pl = /const PLATFORMS = \{([^}]*)\}/.exec(consts); check('promotion-engine constants.js PLATFORMS', [...pl[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]), C.enumValues('Platform'));
  const regions = fs.readFileSync(path.join(HT, 'distribution-backend/models/Regions.js'), 'utf8');
  const pe = /platform:[^\n]*enum:\s*\[([^\]]*)\]/.exec(regions); check('distribution-backend Regions.platform', [...pe[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]), C.enumValues('Platform'));
  check('hyperdrive-backend Fleets validFleetStatus', jsArray(path.join(HT, 'hyperdrive-backend/models/Fleets.js'), 'validFleetStatus'), C.enumValues('FleetStatus'));
  check('hyperdrive-backend Tasks validTaskStatus', jsArray(path.join(HT, 'hyperdrive-backend/models/TasksModel.js'), 'validTaskStatus'), C.enumValues('TaskStatus'));
  check('hyperdrive-backend Tasks validTaskAssignmentMode', jsArray(path.join(HT, 'hyperdrive-backend/models/TasksModel.js'), 'validTaskAssignmentMode'), C.enumValues('TaskAssignmentMode'));
  const promo = fs.readFileSync(path.join(HT, 'promotion-backend/models/Promotion.js'), 'utf8');
  const ps = /status:\s*\{[^}]*enum:\s*\[([^\]]*)\]/.exec(promo); assert.ok(ps, 'Promotion.status enum');
  // The writer's enum is a SUBSET of the contract's (0.2.0 widened it for the Promotions Suite); a value the writer has that we lack is drift.
  const writerStatuses = [...ps[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  const missing = writerStatuses.filter((v) => !C.isEnum('PromotionStatus', v));
  if (missing.length) drift.push('promotion-backend Promotion.status has values the contract lacks: ' + JSON.stringify(missing));
  const orderJoi = fs.readFileSync(path.join(HT, 'hyperwolf-backend/models/Order.js'), 'utf8');
  const os = /status: Joi\.string\(\)\.valid\(([^)]*)\)/.exec(orderJoi);
  const joiStatuses = [...os[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  for (const s of joiStatuses) if (!C.isEnum('OrderStatus', s)) drift.push('hyperwolf-backend Order status ' + s + ' is not an OrderStatus');
  console.log('\n  production drift (' + drift.length + ' items; expected today — the audit found these):');
  for (const d of drift) console.log('    - ' + d);
  if (strict) assert.deepEqual(drift, []);
  // These three are the ones the contract is anchored to and must NOT drift even in report mode.
  assert.ok(!drift.some((d) => d.startsWith('promotion-engine rule-types/')), 'the six evaluator directories are the RuleType source');
  assert.ok(!drift.some((d) => d.startsWith('hyperdrive-backend Fleets')), 'FleetStatus source');
  assert.ok(!drift.some((d) => d.startsWith('promotion-backend Promotion.status')), 'PromotionStatus source');
});

test('writeup-pipeline fixtures: all valid fixtures pass, all invalid fixtures fail', () => {
  const fixturesDir = path.join(ROOT, 'contracts', 'fixtures', 'writeups');
  const validDir = path.join(fixturesDir, 'valid');
  const invalidDir = path.join(fixturesDir, 'invalid');

  // Test valid fixtures
  const validFiles = fs.readdirSync(validDir).filter((f) => f.endsWith('.json'));
  const shapeNames = new Set();
  for (const file of validFiles) {
    const fixture = JSON.parse(fs.readFileSync(path.join(validDir, file), 'utf8'));
    let shapeName;
    if (file.startsWith('wu-')) {
      shapeName = 'WriteUp';
    } else if (file.startsWith('inc-')) {
      shapeName = 'Incident';
    } else if (file.startsWith('co-')) {
      shapeName = 'CallOff';
    }
    shapeNames.add(shapeName);
    const result = C.validate(shapeName, fixture);
    assert.equal(result.ok, true, `Valid fixture ${file} (${shapeName}) failed: ${JSON.stringify(result.errors)}`);
  }

  // Test invalid fixtures
  const invalidFiles = fs.readdirSync(invalidDir).filter((f) => f.endsWith('.json'));
  for (const file of invalidFiles) {
    const fixture = JSON.parse(fs.readFileSync(path.join(invalidDir, file), 'utf8'));
    let shapeName;
    if (file.startsWith('wu-')) {
      shapeName = 'WriteUp';
    } else if (file.startsWith('inc-')) {
      shapeName = 'Incident';
    } else if (file.startsWith('co-')) {
      shapeName = 'CallOff';
    }
    shapeNames.add(shapeName);
    const result = C.validate(shapeName, fixture);
    assert.equal(result.ok, false, `Invalid fixture ${file} (${shapeName}) passed but should have failed. Path: ${path.join(invalidDir, file)}`);
    assert.ok(result.errors.length > 0, `Invalid fixture ${file} (${shapeName}) has no errors. Path: ${path.join(invalidDir, file)}`);
  }

  // Verify we have fixtures for all three shapes
  assert.deepEqual([...shapeNames].sort(), ['CallOff', 'Incident', 'WriteUp'].sort(), 'should have fixtures for WriteUp, Incident, and CallOff');

  // Count fixtures per shape
  const validCounts = {};
  const invalidCounts = {};
  for (const file of validFiles) {
    let shape;
    if (file.startsWith('wu-')) shape = 'WriteUp';
    else if (file.startsWith('inc-')) shape = 'Incident';
    else if (file.startsWith('co-')) shape = 'CallOff';
    validCounts[shape] = (validCounts[shape] || 0) + 1;
  }
  for (const file of invalidFiles) {
    let shape;
    if (file.startsWith('wu-')) shape = 'WriteUp';
    else if (file.startsWith('inc-')) shape = 'Incident';
    else if (file.startsWith('co-')) shape = 'CallOff';
    invalidCounts[shape] = (invalidCounts[shape] || 0) + 1;
  }

  console.log(`\n  WriteUp: ${validCounts.WriteUp} valid, ${invalidCounts.WriteUp} invalid`);
  console.log(`  Incident: ${validCounts.Incident} valid, ${invalidCounts.Incident} invalid`);
  console.log(`  CallOff: ${validCounts.CallOff} valid, ${invalidCounts.CallOff} invalid`);

  // Assert minimum counts
  for (const shape of ['WriteUp', 'Incident', 'CallOff']) {
    assert.ok((validCounts[shape] || 0) >= 8, `${shape}: need >= 8 valid fixtures, got ${validCounts[shape] || 0}`);
    assert.ok((invalidCounts[shape] || 0) >= 6, `${shape}: need >= 6 invalid fixtures, got ${invalidCounts[shape] || 0}`);
  }
});
