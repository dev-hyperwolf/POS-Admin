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
