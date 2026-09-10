import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryProvider } from '../memory.js';
import { PosError } from '../index.js';

const fixtures = {
  products: [{ id: 'P1', platform: 'hyperwolf', source: 'first-party', name: 'Widget', price: { cents: 100, currency: 'USD', basis: 'inc_tax' } }],
  batches: [{ id: 'B1', product_id: 'P1', batch_no: 'B1', received_at: '2025-01-01T00:00:00Z', quantity: 10 }],
  locations: [{ id: 'L1', kind: 'safe', name: 'Safe', store_id: 'S1' }],
  terminals: [{ terminal_id: 'T1', name: 'Terminal 1', region_id: null, location_id: 'L1' }],
  sales: [{ order_id: 'O1', at: '2025-01-01T12:00:00Z', channel: 'asap', terminal_id: 'T1', lines: [{ product_id: 'P1', batch_id: 'B1', quantity: 1 }] }],
  members: [{ id: 'M1', kind: 'customer', display_name: 'Jane', email: 'jane@example.com', phone: null }],
};

test('MemoryProvider serves fixtures back through every port method', async () => {
  const provider = MemoryProvider(fixtures);
  assert.deepEqual(await provider.listProducts({}), fixtures.products);
  assert.equal((await provider.getProduct('P1')).id, 'P1');
  await assert.rejects(() => provider.getProduct('NOPE'), (e) => e instanceof PosError && e.code === 'not_found');
  assert.equal((await provider.listBatches({ productId: 'P1' })).length, 1);
  assert.equal((await provider.listLocations({ storeId: 'S1' })).length, 1);
  assert.equal((await provider.listTerminals({})).length, 1);
  assert.equal((await provider.findMember({ email: 'jane@example.com' })).id, 'M1');
  assert.equal(await provider.findMember({ email: 'nobody@example.com' }), null);
});

test('MemoryProvider listSales filters by window and terminal', async () => {
  const provider = MemoryProvider(fixtures);
  const inWindow = await provider.listSales({ since: '2025-01-01T00:00:00Z', until: '2025-01-02T00:00:00Z' });
  assert.equal(inWindow.length, 1);
  const outOfWindow = await provider.listSales({ since: '2025-02-01T00:00:00Z', until: '2025-02-02T00:00:00Z' });
  assert.equal(outOfWindow.length, 0);
  const wrongTerminal = await provider.listSales({ since: '2025-01-01T00:00:00Z', until: '2025-01-02T00:00:00Z', terminalIds: ['T-other'] });
  assert.equal(wrongTerminal.length, 0);
});

test('MemoryProvider createTransfer/acceptTransfer round-trip and reject an unknown id', async () => {
  const provider = MemoryProvider(fixtures);
  const created = await provider.createTransfer({ from_location_id: 'L1', to_location_id: 'L2', lines: [{ product_id: 'P1', batch_id: 'B1', quantity: 1 }] });
  assert.equal(created.status, 'created');
  const accepted = await provider.acceptTransfer(created.transfer_id);
  assert.equal(accepted.status, 'accepted');
  await assert.rejects(() => provider.acceptTransfer('nope'), (e) => e instanceof PosError && e.code === 'not_found');
});
