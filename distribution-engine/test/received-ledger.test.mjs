import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRefill, receivedLedger } from '../index.js';
import { loadFixtures, kitDestinations } from './helpers.mjs';

const fx = loadFixtures();

// Run the same receiving day through planRefill exactly as OWNER-NOTES.md 2026-09-10 describes
// ("100% certainty about every received product: is it being included in kits, and if not,
// why"), then check the ledger's verdict for each of the three ArrivalKinds.
function buildDayPlans() {
  const flower = kitDestinations(fx, 'Flower Box 1');
  const vape = kitDestinations(fx, 'Vape Box 1', { 'kit-d2-vape1': { 'prod-11': ['batch-11-a'] } });
  const prerolls = kitDestinations(fx, 'Pre-Roll Box 1');

  const newSkuPlan = planRefill({
    business_day: '2026-09-10', generated_at: '2026-09-10T20:00:00Z',
    destinations: flower, batches: fx.receiving.context_batches.filter((b) => b.product_id === 'prod-21'),
    sales: [], received: fx.receiving.received_items.filter((i) => i.product_id === 'prod-21'),
  });
  const restockPlan = planRefill({
    business_day: '2026-09-10', generated_at: '2026-09-10T20:00:00Z',
    destinations: prerolls, batches: fx.receiving.context_batches.filter((b) => b.product_id === 'prod-06'),
    sales: [], received: fx.receiving.received_items.filter((i) => i.product_id === 'prod-06'),
  });
  const newBatchPlan = planRefill({
    business_day: '2026-09-10', generated_at: '2026-09-10T20:00:00Z',
    destinations: vape, batches: fx.receiving.context_batches.filter((b) => b.product_id === 'prod-11'),
    sales: [], received: fx.receiving.received_items.filter((i) => i.product_id === 'prod-11'),
  });
  return [newSkuPlan, restockPlan, newBatchPlan];
}

test('receivedLedger: a fully-placed new SKU shows included_in with the destinations that got it', () => {
  const plans = buildDayPlans();
  const ledger = receivedLedger(fx.receiving.received_items, plans);
  const newSku = ledger.find((i) => i.product_id === 'prod-21');
  assert.ok(newSku.included_in.length >= 1);
  assert.equal(newSku.reason, 'new_arrival');
});

test('receivedLedger: a plain restock, fully placed, reads "new_arrival" not mixed', () => {
  const plans = buildDayPlans();
  const ledger = receivedLedger(fx.receiving.received_items, plans);
  const restock = ledger.find((i) => i.product_id === 'prod-06');
  assert.ok(restock.included_in.length >= 1);
  assert.equal(restock.reason, 'new_arrival');
});

test('receivedLedger: a new batch placed beside an existing one reads "mixed_batch", never silent', () => {
  const plans = buildDayPlans();
  const ledger = receivedLedger(fx.receiving.received_items, plans);
  const newBatch = ledger.find((i) => i.product_id === 'prod-11');
  assert.ok(newBatch.included_in.includes('kit-d2-vape1'));
  assert.equal(newBatch.reason, 'mixed_batch');
});

test('receivedLedger: every item in the input appears exactly once in the output, none dropped', () => {
  const plans = buildDayPlans();
  const ledger = receivedLedger(fx.receiving.received_items, plans);
  assert.equal(ledger.length, fx.receiving.received_items.length);
  const ids = new Set(ledger.map((i) => i.id));
  assert.equal(ids.size, fx.receiving.received_items.length);
});

test('receivedLedger: a product not in any destination template is reported not_in_template', () => {
  const item = {
    id: 'recv-orphan', kind: 'new_sku', product_id: 'prod-never-templated',
    batch_id: 'batch-orphan', quantity: 1, location_id: 'safe-warehouse', received_at: '2026-09-10T15:00:00Z',
  };
  const plan = planRefill({
    business_day: '2026-09-10', generated_at: '2026-09-10T20:00:00Z',
    destinations: kitDestinations(fx, 'Flower Box 1'),
    batches: [{ id: 'batch-orphan', product_id: 'prod-never-templated', batch_no: 'Z', quantity: 1, received_at: '2026-09-10T15:00:00Z' }],
    sales: [], received: [item],
  });
  const ledger = receivedLedger([item], [plan]);
  assert.equal(ledger[0].included_in.length, 0);
  assert.equal(ledger[0].reason, 'not_in_template');
});
