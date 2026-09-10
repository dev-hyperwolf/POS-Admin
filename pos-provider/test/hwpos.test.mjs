import test from 'node:test';
import assert from 'node:assert/strict';
import { HwposProvider } from '../hwpos.js';
import { PosError } from '../index.js';
import Contracts from '../../contracts/index.js';
import { makeFakeHttp, jsonResponse } from './helpers.mjs';

const rawWmProduct = { sku: 'SKU-1', name: 'Preroll 1g', category: 'flower', price: 12, brand_name: 'House Brand' };
const rawWmBatch = { region: 'corona', sku: 'SKU-1', batch_id: 'BATCH-1', thc_pct: 22.5, qty: 40, received_at: 1735689600 }; // epoch SECONDS
const rawWmLocation = { id: 1, name: 'Corona Safe', kind: 'safe', region: 'corona', active: 1 };

function makeProvider(handlers) {
  const http = makeFakeHttp(handlers);
  return { provider: HwposProvider({ baseUrl: 'https://wm-demo.example.com', token: 'tok', http }), http };
}

test('listProducts reads GET /api/state (.catalog) and maps to a contract-valid Product[]', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/api/state'), respond: () => jsonResponse(200, { catalog: [rawWmProduct], batches: [] }) },
  ]);
  const products = await provider.listProducts({});
  assert.equal(products.length, 1);
  const p = products[0];
  assert.equal(p.id, 'SKU-1');
  assert.equal(p.source, 'first-party');
  assert.equal(p.price.cents, 1200);
  assert.equal(Contracts.validate('Product', p).ok, true);
});

test('getProduct reads GET /api/product/:sku', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/api/product/SKU-1'), respond: () => jsonResponse(200, rawWmProduct) },
  ]);
  const p = await provider.getProduct('SKU-1');
  assert.equal(p.name, 'Preroll 1g');
  assert.equal(Contracts.validate('Product', p).ok, true);
});

test('getProduct 404 becomes a not_found PosError', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/api/product/MISSING'), respond: () => jsonResponse(404, { error: 'no such product' }) },
  ]);
  await assert.rejects(() => provider.getProduct('MISSING'), (e) => e instanceof PosError && e.code === 'not_found');
});

test('listBatches reads GET /api/state (.batches), filters by productId, converts epoch seconds', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/api/state'), respond: () => jsonResponse(200, { catalog: [], batches: [rawWmBatch, { ...rawWmBatch, sku: 'SKU-2', batch_id: 'BATCH-2' }] }) },
  ]);
  const all = await provider.listBatches({});
  assert.equal(all.length, 2);
  const filtered = await provider.listBatches({ productId: 'SKU-1' });
  assert.equal(filtered.length, 1);
  const b = filtered[0];
  assert.equal(b.received_at, '2025-01-01T00:00:00Z');
  assert.equal(Contracts.validate('Batch', b).ok, true);
});

test('listLocations reads GET /api/inventory/locations and maps wm-demo kinds', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/api/inventory/locations'), respond: () => jsonResponse(200, [rawWmLocation, { ...rawWmLocation, id: 2, kind: 'kit' }]) },
  ]);
  const locations = await provider.listLocations({});
  assert.equal(locations.length, 2);
  assert.equal(locations[0].kind, 'safe');
  assert.equal(locations[1].kind, 'kit_box');
  for (const l of locations) assert.equal(Contracts.validate('Location', l).ok, true);
});

test('the honest gaps: listTerminals, listSales, createTransfer, acceptTransfer, findMember all throw not_supported', async () => {
  const { provider } = makeProvider([]);
  for (const call of [
    () => provider.listTerminals({}),
    () => provider.listSales({}),
    () => provider.createTransfer({}),
    () => provider.acceptTransfer('x'),
    () => provider.findMember({}),
  ]) {
    await assert.rejects(call, (e) => e instanceof PosError && e.code === 'not_supported' && e.provider === 'hwpos');
  }
});

test('capabilities declares the same gaps it throws for', () => {
  const { provider } = makeProvider([]);
  const caps = provider.capabilities();
  assert.equal(caps.name, 'hwpos');
  assert.equal(caps.supports.listProducts, true);
  assert.equal(caps.supports.listBatches, true);
  assert.equal(caps.supports.listLocations, true);
  assert.equal(caps.supports.listTerminals, false);
  assert.equal(caps.supports.listSales, false);
  assert.equal(caps.supports.createTransfer, false);
  assert.equal(caps.supports.acceptTransfer, false);
  assert.equal(caps.supports.findMember, false);
});
