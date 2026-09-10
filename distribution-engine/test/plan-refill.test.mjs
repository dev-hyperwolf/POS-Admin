import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRefill, returnBaseline } from '../index.js';
import { loadFixtures, kitDestinations, contractsValidate } from './helpers.mjs';

const fx = loadFixtures();
const validate = contractsValidate();

function assertValidPlan(plan) {
  const result = validate('Plan', plan);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  for (const line of [...plan.lines, ...plan.skipped]) {
    const r = validate('PlanLine', line);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
  }
}

// ── named regression: symptom 1 ──────────────────────────────────────────────
// DISTRIBUTION-LOGIC-MAP.md §2: "a product whose total stock is below the number of
// subregions is never placed anywhere, not even partially" was the bug. This proves the new
// engine does not reproduce it.
test('SYMPTOM 1 REGRESSION: premium product received today is in today\'s plan', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1'); // 3 destinations
  const premiumItem = fx.receiving.received_items.find((i) => i.product_id === 'prod-21');
  assert.equal(premiumItem.premium, true);
  assert.ok(premiumItem.quantity < destinations.length, 'the whole point: less stock than destinations');

  const batches = fx.receiving.context_batches.filter((b) => b.product_id === 'prod-21');
  const plan = planRefill({
    business_day: '2026-09-10',
    generated_at: '2026-09-10T20:00:00Z',
    from_location_id: 'safe-warehouse',
    destinations,
    batches,
    sales: [],
    received: [premiumItem],
  });

  const givenLines = plan.lines.filter((l) => l.product_id === 'prod-21' && l.give > 0);
  assert.ok(givenLines.length > 0, 'prod-21 must appear in at least one destination\'s plan, not be skipped everywhere');
  const totalGiven = givenLines.reduce((s, l) => s + l.give, 0);
  assert.equal(totalGiven, 2, 'all 2 received units were placed, none held back by the old all-or-nothing gate');
  for (const l of givenLines) assert.ok(l.reasons.includes('new_arrival'));
  assertValidPlan(plan);
});

// ── named regression: symptom 2 ──────────────────────────────────────────────
// DISTRIBUTION-LOGIC-MAP.md §2 / kit-refill-controller.js:1307-1308: recording the quantity
// actually handed out as next cycle's cap permanently lowers the ceiling after one short day.
// This engine derives cap from the template every single call, so it cannot ratchet.
test('SYMPTOM 2 REGRESSION: a short-stock day does not lower tomorrow\'s cap', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const templateMax = destinations[0].template.find((t) => t.product_id === 'prod-02').max;
  assert.equal(templateMax, 8);

  const day1 = planRefill({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T20:00:00Z',
    destinations,
    batches: [{ id: 'batch-02-day1', product_id: 'prod-02', batch_no: 'X1', quantity: 3, received_at: '2026-08-01T00:00:00Z' }],
    sales: [{ product_id: 'prod-02', quantity: 6, channel: 'asap', at: '2026-09-08T18:00:00Z', location_id: 'kit-d1-flower1' }],
  });
  const day1Line = day1.lines.find((l) => l.product_id === 'prod-02' && l.to_location_id === 'kit-d1-flower1');
  assert.equal(day1Line.give, 3, 'short-stock day: only 3 of the 6 needed were available');
  assert.equal(day1Line.cap, 8, 'cap is the template max even on the short day');
  assert.ok(day1Line.reasons.includes('partial_placement'));

  const day2 = planRefill({
    business_day: '2026-09-09',
    generated_at: '2026-09-09T20:00:00Z',
    destinations,
    batches: [{ id: 'batch-02-day2', product_id: 'prod-02', batch_no: 'X2', quantity: 10, received_at: '2026-09-08T00:00:00Z' }],
    sales: [{ product_id: 'prod-02', quantity: 4, channel: 'asap', at: '2026-09-09T18:00:00Z', location_id: 'kit-d1-flower1' }],
  });
  const day2Line = day2.lines.find((l) => l.product_id === 'prod-02' && l.to_location_id === 'kit-d1-flower1');
  assert.equal(day2Line.cap, 8, 'cap on day 2 is still the template max, not day 1\'s actual give');
  assert.equal(day2Line.give, 4, 'day 2 gives what day 2 needs (4), not clamped to day 1\'s 3');
  assertValidPlan(day1);
  assertValidPlan(day2);
});

// ── (b) ASAP-only for refill need, ASAP+scheduled for the return baseline ───────────────────
test('demand stream split: refill need counts ASAP only; return baseline counts ASAP + scheduled', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const plan = planRefill({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T23:59:00Z',
    destinations,
    batches: [{ id: 'batch-01-refill', product_id: 'prod-01', batch_no: 'R1', quantity: 20, received_at: '2026-08-01T00:00:00Z' }],
    sales: fx.sales.day1,
  });
  const line = plan.lines.find((l) => l.product_id === 'prod-01' && l.to_location_id === 'kit-d1-flower1');
  assert.equal(line.sold, 2, 'ASAP-only: the 1 scheduled unit is not counted toward refill need');
  assert.equal(line.give, 2);

  const baseline = returnBaseline(fx.sales.day1, {
    product_id: 'prod-01', location_id: 'kit-d1-flower1',
    sinceIso: '2026-09-08T00:00:00Z', untilIso: '2026-09-08T23:59:59Z',
  });
  assert.equal(baseline, 3, 'return baseline includes the scheduled sale too (2 asap + 1 scheduled)');
});

// ── (c) mixed batch, case 1: one destination's need unavoidably spans two batches ───────────
test('mixed batch (unavoidable split): flagged loudly with both batch numbers, THC and packaged dates', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const batches = fx.batches.batches.filter((b) => b.product_id === 'prod-04'); // qty 3 + 20
  const plan = planRefill({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T20:00:00Z',
    destinations,
    batches,
    sales: [{ product_id: 'prod-04', quantity: 5, channel: 'asap', at: '2026-09-08T18:00:00Z', location_id: 'kit-d1-flower1' }],
  });
  const lines = plan.lines.filter((l) => l.product_id === 'prod-04' && l.to_location_id === 'kit-d1-flower1');
  assert.equal(lines.length, 2, 'the 5-unit need spans both batch-04-a (3 left) and batch-04-b');
  for (const l of lines) {
    assert.equal(l.mixed_batch, true);
    assert.ok(l.reasons.includes('mixed_batch'));
    assert.match(l.note, /^MIXED BATCH/);
    assert.match(l.note, /FL04-A/);
    assert.match(l.note, /FL04-B/);
    assert.match(l.note, /THC 26\.8%/);
    assert.match(l.note, /THC 25\.1%/);
    assert.match(l.note, /packaged 2026-07-10/);
    assert.match(l.note, /packaged 2026-08-30/);
  }
  assertValidPlan(plan);
});

// ── (c) mixed batch, case 2: a new batch arrives beside one the kit already has ─────────────
test('mixed batch (new batch beside existing): flagged even when the allocation itself used one batch', () => {
  const destinations = kitDestinations(fx, 'Vape Box 1', {
    'kit-d2-vape1': { 'prod-11': ['batch-11-a'] },
  });
  const received = fx.receiving.received_items.filter((i) => i.product_id === 'prod-11');
  const batches = fx.receiving.context_batches.filter((b) => b.product_id === 'prod-11');

  const plan = planRefill({
    business_day: '2026-09-10',
    generated_at: '2026-09-10T20:00:00Z',
    from_location_id: 'safe-warehouse',
    destinations,
    batches,
    sales: [],
    received,
  });

  const d1 = plan.lines.find((l) => l.to_location_id === 'kit-d1-vape1' && l.product_id === 'prod-11');
  const d2 = plan.lines.find((l) => l.to_location_id === 'kit-d2-vape1' && l.product_id === 'prod-11');
  const d3Skip = plan.skipped.find((l) => l.to_location_id === 'kit-d3-vape1' && l.product_id === 'prod-11');

  assert.ok(d1, 'driver one (no existing batch) gets a plain new-arrival line');
  assert.equal(d1.mixed_batch, false);
  assert.equal(d1.batch_id, 'batch-11-b');

  assert.ok(d2, 'driver two (already holding batch-11-a) gets the new batch flagged, not silent');
  assert.equal(d2.mixed_batch, true);
  assert.ok(d2.reasons.includes('mixed_batch'));
  assert.match(d2.note, /VP02-A/);
  assert.match(d2.note, /VP02-B/);

  assert.ok(d3Skip, 'driver three is never dropped from the output entirely, even at zero stock left');
  assert.ok(d3Skip.reasons.includes('short_stock'));

  assertValidPlan(plan);
});

// ── (i) onlyProductIds — partial refill, rule 9 ─────────────────────────────────────────────
test('planRefill: onlyProductIds restricts the run to named SKUs (mid-day partial refill)', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1').concat(kitDestinations(fx, 'Pre-Roll Box 1'));
  const batches = [
    { id: 'b-01', product_id: 'prod-01', batch_no: 'A', quantity: 20, received_at: '2026-08-01T00:00:00Z' },
    { id: 'b-07', product_id: 'prod-07', batch_no: 'B', quantity: 20, received_at: '2026-08-01T00:00:00Z' },
  ];
  const plan = planRefill({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T23:59:00Z',
    destinations,
    batches,
    sales: fx.sales.day1, // has both prod-01 and prod-07 demand
    onlyProductIds: ['prod-07'],
  });
  assert.ok(plan.lines.every((l) => l.product_id === 'prod-07'));
  assert.ok(plan.lines.some((l) => l.product_id === 'prod-07'));
});

// ── (g) idempotency key per destination per business day ───────────────────────────────────
test('planRefill: plan.id is stable for the same scope/business_day, different for a different day', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const batches = [{ id: 'b-01', product_id: 'prod-01', batch_no: 'A', quantity: 20, received_at: '2026-08-01T00:00:00Z' }];
  const a = planRefill({ business_day: '2026-09-08', destinations, batches, sales: fx.sales.day1 });
  const b = planRefill({ business_day: '2026-09-08', destinations, batches, sales: fx.sales.day1 });
  const c = planRefill({ business_day: '2026-09-09', destinations, batches, sales: fx.sales.day2 });
  assert.equal(a.id, b.id, 'same day, same scope -> same plan id (a second run is idempotent)');
  assert.notEqual(a.id, c.id, 'a different business day gets a different plan id');
});
