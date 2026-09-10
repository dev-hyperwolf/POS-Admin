import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBuild } from '../index.js';
import { loadFixtures, kitDestinations, batchesAt, contractsValidate } from './helpers.mjs';

const fx = loadFixtures();
const validate = contractsValidate();

function buildPlan() {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const batches = batchesAt(fx, 'safe-warehouse').filter((b) =>
    ['prod-01', 'prod-02', 'prod-03', 'prod-04'].includes(b.product_id));
  return planBuild({
    business_day: '2026-09-07',
    generated_at: '2026-09-07T16:00:00Z',
    from_location_id: 'safe-warehouse',
    destinations,
    batches,
  });
}

test('planBuild: shape and basics', () => {
  const plan = buildPlan();
  assert.equal(plan.kind, 'build');
  assert.equal(plan.business_day, '2026-09-07');
  assert.equal(plan.channel, 'asap');
  assert.ok(Array.isArray(plan.lines) && plan.lines.length > 0);
});

test('planBuild: ample stock (prod-01) fully covers every destination at the template max', () => {
  const plan = buildPlan();
  const p1Lines = plan.lines.filter((l) => l.product_id === 'prod-01');
  const byDest = new Map(p1Lines.map((l) => [l.to_location_id, l]));
  for (const destId of ['kit-d1-flower1', 'kit-d2-flower1', 'kit-d3-flower1']) {
    assert.equal(byDest.get(destId).give, 6); // template max
    assert.equal(byDest.get(destId).mixed_batch, false);
  }
});

test('planBuild: need derives from the template max, never a prior distributed quantity', () => {
  const plan = buildPlan();
  const p1Line = plan.lines.find((l) => l.product_id === 'prod-01' && l.to_location_id === 'kit-d1-flower1');
  assert.equal(p1Line.need, 6);
  assert.equal(p1Line.cap, 6);
});

test('planBuild: scarce product (prod-04) is placed at every destination it can reach, never dropped entirely', () => {
  const plan = buildPlan();
  const p4Lines = plan.lines.filter((l) => l.product_id === 'prod-04');
  const gaveTo = new Set(p4Lines.map((l) => l.to_location_id));
  assert.equal(gaveTo.size, 3, 'all three flower boxes got at least something of prod-04');
  const totalGiven = p4Lines.reduce((s, l) => s + l.give, 0);
  assert.equal(totalGiven, 23); // everything the warehouse had (3 + 20)
});

test('planBuild: the destination whose need spans two batches is flagged mixed_batch, loudly', () => {
  const plan = buildPlan();
  const mixedLines = plan.lines.filter((l) => l.product_id === 'prod-04' && l.mixed_batch);
  assert.ok(mixedLines.length >= 2, 'both batch-04-a and batch-04-b lines are present and flagged');
  const batchIds = new Set(mixedLines.map((l) => l.batch_id));
  assert.deepEqual([...batchIds].sort(), ['batch-04-a', 'batch-04-b']);
  for (const l of mixedLines) {
    assert.ok(l.reasons.includes('mixed_batch'));
    assert.match(l.note, /MIXED BATCH/);
    assert.match(l.note, /FL04-A/);
    assert.match(l.note, /FL04-B/);
    assert.match(l.note, /THC/);
    assert.match(l.note, /packaged/);
  }
});

test('planBuild: a destination whose total given falls short of its need is marked partial_placement', () => {
  // Not "any single batch-split line gives less than the full need" (that's normal for a
  // mixed-batch line) -- specifically the destination that, once every batch is exhausted,
  // still didn't receive its full template max.
  const plan = buildPlan();
  const byDestination = new Map();
  for (const l of plan.lines.filter((l) => l.product_id === 'prod-04')) {
    const agg = byDestination.get(l.to_location_id) || { given: 0, need: l.need, reasons: new Set() };
    agg.given += l.give;
    for (const r of l.reasons) agg.reasons.add(r);
    byDestination.set(l.to_location_id, agg);
  }
  const shortDestinations = [...byDestination.values()].filter((d) => d.given < d.need);
  assert.ok(shortDestinations.length >= 1, 'at least one destination did not get its full need');
  for (const d of shortDestinations) assert.ok(d.reasons.has('partial_placement'));
});

test('planBuild: every returned Plan and every line validates against the contract', () => {
  const plan = buildPlan();
  const result = validate('Plan', plan);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  for (const line of [...plan.lines, ...plan.skipped]) {
    const lineResult = validate('PlanLine', line);
    assert.equal(lineResult.ok, true, JSON.stringify(lineResult.errors));
  }
});

test('planBuild: plan.id is stable for the same business day and scope (idempotency key material)', () => {
  const a = buildPlan();
  const b = buildPlan();
  assert.equal(a.id, b.id);
});
