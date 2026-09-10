import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRestock } from '../index.js';
import { loadFixtures, shelfDestinations, batchesAt, contractsValidate } from './helpers.mjs';

const fx = loadFixtures();
const validate = contractsValidate();

test('planRestock: floor restock is driven by register sales, channel register, kind restock', () => {
  const destinations = shelfDestinations(fx, 'Flower Shelf');
  const batches = batchesAt(fx, 'store-1-safe').filter((b) =>
    ['prod-01', 'prod-02', 'prod-25'].includes(b.product_id));
  const plan = planRestock({
    business_day: '2026-09-08',
    generated_at: '2026-09-08T23:59:00Z',
    from_location_id: 'store-1-safe',
    store_id: 'store-1',
    destinations,
    batches,
    sales: fx.sales.day1,
  });
  assert.equal(plan.kind, 'restock');
  assert.equal(plan.channel, 'register');
  assert.equal(plan.store_id, 'store-1');
  const line = plan.lines.find((l) => l.product_id === 'prod-01');
  assert.ok(line);
  assert.equal(line.sold, 2); // the one register sale in fixtures/sales.json day1
  assert.equal(line.give, 2);
  assert.equal(line.to_location_id, 'store-1-shelf-flower');
});

test('planRestock: ASAP/scheduled sales at the same location never count toward floor need', () => {
  const destinations = shelfDestinations(fx, 'Flower Shelf');
  const batches = batchesAt(fx, 'store-1-safe').filter((b) => b.product_id === 'prod-01');
  const sales = [
    { product_id: 'prod-01', quantity: 2, channel: 'register', at: '2026-09-08T18:00:00Z', location_id: 'store-1-shelf-flower' },
    { product_id: 'prod-01', quantity: 100, channel: 'asap', at: '2026-09-08T18:05:00Z', location_id: 'store-1-shelf-flower' },
    { product_id: 'prod-01', quantity: 100, channel: 'scheduled', at: '2026-09-08T18:10:00Z', location_id: 'store-1-shelf-flower' },
  ];
  const plan = planRestock({
    business_day: '2026-09-08', generated_at: '2026-09-08T23:59:00Z', destinations, batches, sales,
  });
  const line = plan.lines.find((l) => l.product_id === 'prod-01');
  assert.equal(line.sold, 2, 'only the register sale counts; the 200 asap/scheduled units are ignored');
});

test('planRestock: a new arrival is pushed to the floor immediately, same as a delivery refill', () => {
  const destinations = shelfDestinations(fx, 'Flower Shelf');
  const batches = [{ id: 'batch-25-new', product_id: 'prod-25', batch_no: 'FL07-B', quantity: 5, received_at: '2026-09-10T15:00:00Z' }];
  const received = [{
    id: 'recv-store-1', kind: 'restock', product_id: 'prod-25', batch_id: 'batch-25-new',
    quantity: 5, location_id: 'store-1-safe', received_at: '2026-09-10T15:00:00Z',
  }];
  const plan = planRestock({
    business_day: '2026-09-10', generated_at: '2026-09-10T20:00:00Z', destinations, batches, sales: [], received,
  });
  const line = plan.lines.find((l) => l.product_id === 'prod-25');
  assert.ok(line);
  assert.ok(line.reasons.includes('new_arrival'));
  assert.equal(line.give, 5);
});

test('planRestock: every line and skip validates against the contract', () => {
  const destinations = shelfDestinations(fx, 'Flower Shelf');
  const batches = batchesAt(fx, 'store-1-safe');
  const plan = planRestock({
    business_day: '2026-09-09', generated_at: '2026-09-09T23:59:00Z', destinations, batches, sales: fx.sales.day2,
  });
  const result = validate('Plan', plan);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  for (const line of [...plan.lines, ...plan.skipped]) {
    const r = validate('PlanLine', line);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
  }
});
