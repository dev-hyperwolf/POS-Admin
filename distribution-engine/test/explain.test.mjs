import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, planRefill } from '../index.js';
import { loadFixtures, kitDestinations } from './helpers.mjs';

const fx = loadFixtures();

test('explain: a mixed-batch line gets its own loud line naming both batches, THC and packaged dates', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const batches = fx.batches.batches.filter((b) => b.product_id === 'prod-04');
  const plan = planRefill({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T20:00:00Z',
    destinations,
    batches,
    sales: [{ product_id: 'prod-04', quantity: 5, channel: 'asap', at: '2026-09-08T18:00:00Z', location_id: 'kit-d1-flower1' }],
  });
  const lines = explain(plan);
  const loud = lines.filter((l) => l.startsWith('MIXED BATCH'));
  assert.ok(loud.length >= 1);
  assert.match(loud[0], /FL04-A/);
  assert.match(loud[0], /FL04-B/);
  assert.match(loud[0], /THC/);
  assert.match(loud[0], /packaged/);
  // and the ordinary give-line for the same product is still there, readably, right after it
  assert.ok(lines.some((l) => l.includes('Give') && l.includes('prod-04')));
});

test('explain: a plain give-line reads product, quantity, batch, destination and a human reason', () => {
  const destinations = kitDestinations(fx, 'Pre-Roll Box 1');
  const plan = planRefill({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T20:00:00Z',
    destinations,
    batches: fx.batches.batches.filter((b) => b.product_id === 'prod-07'),
    sales: [{ product_id: 'prod-07', quantity: 3, channel: 'asap', at: '2026-09-08T17:30:00Z', location_id: 'kit-d2-preroll1' }],
  });
  const lines = explain(plan);
  const line = lines.find((l) => l.startsWith('Give'));
  assert.match(line, /Give 3 × prod-07/);
  assert.match(line, /kit-d2-preroll1/);
  assert.match(line, /replace ASAP sales/);
});

test('explain: a skip line names the reason and shows need vs cap, never a bare "skipped"', () => {
  const destinations = kitDestinations(fx, 'Flower Box 1');
  const plan = planRefill({
    business_day: '2026-09-10',
    generated_at: '2026-09-10T20:00:00Z',
    destinations,
    batches: fx.receiving.context_batches.filter((b) => b.product_id === 'prod-21'),
    sales: [],
    received: fx.receiving.received_items.filter((i) => i.product_id === 'prod-21'),
  });
  const lines = explain(plan);
  const skipLine = lines.find((l) => l.startsWith('Skip'));
  assert.ok(skipLine);
  assert.match(skipLine, /need \d+, cap \d+/);
  assert.ok(!skipLine.toLowerCase().includes(' skipped '));
});

test('explain: returns no output at all for an empty plan (no lines, no skips)', () => {
  const emptyPlan = { kind: 'refill', business_day: '2026-09-10', generated_at: '2026-09-10T20:00:00Z', channel: 'asap', lines: [], skipped: [], warnings: [] };
  assert.deepEqual(explain(emptyPlan), []);
});
