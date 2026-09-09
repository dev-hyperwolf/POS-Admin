/* pos/data.jsx's ORDER_STAGES (exported as window.HW.STAGES) is now DERIVED from
 * the contract instead of a hand-typed literal:
 *
 *   const ORDER_STAGES = window.HWContracts.enumValues('FulfillmentStage')
 *     .filter((s) => s !== 'canceled');
 *
 * data.jsx itself can't be loaded under `vm` the way shared/commerce-adapter.js
 * is (test/harness.mjs) — it's JSX, transformed by Babel in the browser, not
 * plain JS. This test instead loads the ONE dependency that derivation reads
 * (contracts/index.js, via Node `require()` exactly as test/contracts.test.mjs
 * group 1 does — same realm, so plain assert.deepEqual on its return values is
 * meaningful) and re-runs the exact same derivation, pinning today's literal as
 * the expected result. If FulfillmentStage ever changes shape, this fails
 * instead of the kanban's five columns silently gaining or losing a stage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const C = require(path.join(ROOT, 'contracts', 'index.js'));

const TODAYS_LITERAL = ['verify', 'pack', 'packing', 'ready', 'done'];

test('ORDER_STAGES derived from HWContracts.enumValues(FulfillmentStage) equals the literal pos/data.jsx shipped before', () => {
  const derived = C.enumValues('FulfillmentStage').filter((s) => s !== 'canceled');
  assert.deepEqual(derived, TODAYS_LITERAL,
    'pos/data.jsx ORDER_STAGES uses this exact derivation — if this test fails, ' +
    'FulfillmentStage moved and pos/data.jsx (and screen-orders.jsx STAGES, which ' +
    'reads window.HW.STAGES) need a look before shipping, not after.');
});

test('FulfillmentStage still contains exactly one value besides the five kanban stages: canceled', () => {
  const all = C.enumValues('FulfillmentStage');
  const extra = all.filter((s) => !TODAYS_LITERAL.includes(s));
  assert.deepEqual(extra, ['canceled'],
    'pos/data.jsx\'s derivation drops "canceled" on the assumption that it is the ' +
    'only value the kanban does not have a column for — if a second new value ' +
    'shows up here, that assumption needs re-checking, not just re-asserting.');
});
