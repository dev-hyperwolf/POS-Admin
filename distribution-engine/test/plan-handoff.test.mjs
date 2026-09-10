import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planHandoff } from '../index.js';
import { contractsValidate } from './helpers.mjs';

const validate = contractsValidate();

test('planHandoff: kind is "handoff", from/to are the two kits', () => {
  const plan = planHandoff('kit-d1-flower1', 'kit-d2-flower1', [
    { product_id: 'prod-01', quantity: 3, batch_id: 'batch-01-a' },
  ], { business_day: '2026-09-10' });
  assert.equal(plan.kind, 'handoff');
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.lines[0].from_location_id, 'kit-d1-flower1');
  assert.equal(plan.lines[0].to_location_id, 'kit-d2-flower1');
  assert.equal(plan.lines[0].give, 3);
  assert.ok(plan.lines[0].reasons.includes('manual'));
});

test('planHandoff: a named batch is trusted directly, no FEFO re-derivation', () => {
  const plan = planHandoff('kit-d1-vape1', 'kit-d3-vape1', [
    { product_id: 'prod-12', quantity: 2, batch_id: 'batch-12-a' },
  ]);
  assert.equal(plan.lines[0].batch_id, 'batch-12-a');
  assert.equal(plan.lines[0].mixed_batch, false);
});

test('planHandoff: without a named batch, FEFO-splits from the source kit\'s batches and flags mixed', () => {
  const plan = planHandoff('kit-d1-flower1', 'kit-d2-flower1', [
    { product_id: 'prod-04', quantity: 5 },
  ], {
    batches: [
      { id: 'batch-04-a', product_id: 'prod-04', batch_no: 'FL04-A', quantity: 3, expires_at: '2026-11-10T00:00:00Z', received_at: '2026-07-15T00:00:00Z', location_id: 'kit-d1-flower1' },
      { id: 'batch-04-b', product_id: 'prod-04', batch_no: 'FL04-B', quantity: 20, expires_at: '2027-02-28T00:00:00Z', received_at: '2026-09-05T00:00:00Z', location_id: 'kit-d1-flower1' },
    ],
  });
  const lines = plan.lines.filter((l) => l.product_id === 'prod-04');
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => l.mixed_batch === true));
  const total = lines.reduce((s, l) => s + l.give, 0);
  assert.equal(total, 5);
});

test('planHandoff: plan validates against the contract', () => {
  const plan = planHandoff('kit-d1-flower1', 'kit-d2-flower1', [
    { product_id: 'prod-01', quantity: 3, batch_id: 'batch-01-a' },
  ]);
  const result = validate('Plan', plan);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
