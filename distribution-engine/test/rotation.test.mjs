import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotation } from '../index.js';
import { loadFixtures, batchesAt } from './helpers.mjs';

const fx = loadFixtures();

test('rotation: orders batches oldest-expiry first (FEFO)', () => {
  const batches = batchesAt(fx, 'safe-warehouse').filter((b) => b.product_id === 'prod-03');
  const { ordered } = rotation(batches);
  assert.equal(ordered.length, 2);
  assert.equal(ordered[0].id, 'batch-03-a'); // expires 2026-12-28, sooner
  assert.equal(ordered[1].id, 'batch-03-b'); // expires 2027-01-27
});

test('rotation: no-expiry batches sort after every batch that does expire', () => {
  const { ordered } = rotation([
    { id: 'no-expiry', quantity: 5, received_at: '2026-01-01T00:00:00Z' },
    { id: 'expires-later', quantity: 5, expires_at: '2027-01-01T00:00:00Z', received_at: '2026-06-01T00:00:00Z' },
  ]);
  assert.deepEqual(ordered.map((b) => b.id), ['expires-later', 'no-expiry']);
});

test('rotation: ties on expiry break on received_at, oldest first', () => {
  const { ordered } = rotation([
    { id: 'received-later', quantity: 5, expires_at: '2027-01-01T00:00:00Z', received_at: '2026-06-01T00:00:00Z' },
    { id: 'received-earlier', quantity: 5, expires_at: '2027-01-01T00:00:00Z', received_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.deepEqual(ordered.map((b) => b.id), ['received-earlier', 'received-later']);
});

test('rotation.allocate: a need that fits in the oldest batch never touches the newer one', () => {
  const batches = batchesAt(fx, 'safe-warehouse').filter((b) => b.product_id === 'prod-03');
  const { allocate } = rotation(batches);
  const alloc = allocate(10); // batch-03-a alone has 15
  assert.equal(alloc.filled, 10);
  assert.equal(alloc.remaining, 0);
  assert.equal(alloc.mixed_batch, false);
  assert.deepEqual(alloc.allocations.map((a) => a.batch_id), ['batch-03-a']);
});

test('rotation.allocate: a need bigger than the oldest batch spans batches and is flagged mixed', () => {
  const batches = batchesAt(fx, 'safe-warehouse').filter((b) => b.product_id === 'prod-04');
  const { allocate } = rotation(batches); // batch-04-a qty 3, batch-04-b qty 20
  const alloc = allocate(5);
  assert.equal(alloc.filled, 5);
  assert.equal(alloc.mixed_batch, true);
  assert.equal(alloc.allocations.length, 2);
  assert.equal(alloc.allocations[0].batch_id, 'batch-04-a');
  assert.equal(alloc.allocations[0].quantity, 3);
  assert.equal(alloc.allocations[1].batch_id, 'batch-04-b');
  assert.equal(alloc.allocations[1].quantity, 2);
});

test('rotation.allocate: asking for more than total stock reports the shortfall, never throws', () => {
  const { allocate } = rotation([{ id: 'only-batch', quantity: 4, received_at: '2026-01-01T00:00:00Z' }]);
  const alloc = allocate(10);
  assert.equal(alloc.filled, 4);
  assert.equal(alloc.remaining, 6);
});

test('rotation: never mutates the batches it was given', () => {
  const batches = batchesAt(fx, 'safe-warehouse').filter((b) => b.product_id === 'prod-04');
  const before = JSON.stringify(batches);
  rotation(batches).allocate(5);
  assert.equal(JSON.stringify(batches), before);
});
