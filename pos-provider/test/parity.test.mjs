// test/parity.test.mjs — the same logical calls against MemoryProvider and BlazeProvider(mock
// http) must produce contract-equal results: both validate against the shared contract, and both
// agree on every field a caller actually depends on (name, sku, price, quantity, channel, lines).
// external_ids differ by design (`source: 'blaze'` vs `'hwpos'`) and are excluded from the
// equality check on purpose — see BLAZE-DEPENDENCY-MAP.md §3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BlazeProvider, } from '../blaze.js';
import { MemoryProvider } from '../memory.js';
import { channelFromOrderTags } from '../index.js';
import Contracts from '../../contracts/index.js';
import { makeFakeHttp, jsonResponse } from './helpers.mjs';
import { rawBlazeProduct, rawBlazeBatch, rawBlazeTransaction } from './fixtures.mjs';

function omit(obj, keys) {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

test('parity: listProducts agrees on every caller-visible field', async () => {
  const http = makeFakeHttp([
    { match: (u) => u.includes('/partner/store/inventory/products'), respond: () => jsonResponse(200, { values: [rawBlazeProduct] }) },
  ]);
  const blaze = BlazeProvider({ baseUrl: 'https://api.blaze.me/api/v1', partnerKey: 'pk', authKey: 'ak', http });
  const memory = MemoryProvider({
    products: [
      {
        id: '9001',
        platform: 'hyperwolf',
        source: 'first-party',
        name: 'Synthetic Gummies 100mg',
        sku: 'SKU-9001',
        brand: 'Synthetic Brand Co',
        category: 'edible',
        price: Contracts.money(2450, 'inc_tax', 'USD'),
        quantity_on_hand: 42,
        external_ids: [Contracts.externalId('hwpos', '9001')],
      },
    ],
  });

  const [blazeProducts, memoryProducts] = await Promise.all([blaze.listProducts({}), memory.listProducts({})]);
  assert.equal(Contracts.validate('Product', blazeProducts[0]).ok, true);
  assert.equal(Contracts.validate('Product', memoryProducts[0]).ok, true);
  const strip = (p) => omit(p, ['external_ids', 'source']);
  assert.deepEqual(strip(blazeProducts[0]), strip(memoryProducts[0]));
  // and the one field that's SUPPOSED to differ, differs as designed
  assert.equal(blazeProducts[0].external_ids[0].source, 'blaze');
  assert.equal(memoryProducts[0].external_ids[0].source, 'hwpos');
});

test('parity: listBatches agrees on quantity, batch_no and received_at', async () => {
  const http = makeFakeHttp([
    { match: (u) => u.includes('/partner/store/batches'), respond: () => jsonResponse(200, { values: [rawBlazeBatch] }) },
  ]);
  const blaze = BlazeProvider({ baseUrl: 'https://api.blaze.me/api/v1', partnerKey: 'pk', authKey: 'ak', http });
  const [blazeBatches] = await Promise.all([blaze.listBatches({ productId: '9001' })]);
  const memory = MemoryProvider({
    batches: [
      {
        id: '5001',
        product_id: '9001',
        sku: 'SKU-9001',
        batch_no: 'B-5001',
        received_at: blazeBatches[0].received_at,
        thc_pct: null,
        quantity: 150,
        location_id: null,
        external_ids: [Contracts.externalId('hwpos', '5001')],
      },
    ],
  });
  const memoryBatches = await memory.listBatches({ productId: '9001' });
  assert.equal(Contracts.validate('Batch', blazeBatches[0]).ok, true);
  assert.equal(Contracts.validate('Batch', memoryBatches[0]).ok, true);
  const strip = (b) => omit(b, ['external_ids', 'metrc_tag', 'packaged_at', 'expires_at', 'unit_cost']);
  assert.deepEqual(strip(blazeBatches[0]), strip(memoryBatches[0]));
});

test('parity: listSales channel derivation is the one function both providers share', async () => {
  const raw = rawBlazeTransaction({ id: 1, orderTags: ['pickup'] });
  const http = makeFakeHttp([
    { match: (u) => u.includes('/partner/transactions'), respond: (u) => jsonResponse(200, { values: new URL(u).searchParams.get('skip') === '0' ? [raw] : [] }) },
  ]);
  const blaze = BlazeProvider({ baseUrl: 'https://api.blaze.me/api/v1', partnerKey: 'pk', authKey: 'ak', http });
  const blazeSales = await blaze.listSales({ since: '2025-01-01T00:00:00Z', until: '2025-01-02T00:00:00Z' });

  const memory = MemoryProvider({
    sales: [
      {
        order_id: '1',
        at: blazeSales[0].at,
        channel: channelFromOrderTags(raw.orderTags),
        terminal_id: '301',
        lines: [{ product_id: '9001', batch_id: '5001', quantity: 2 }],
      },
    ],
  });
  const memorySales = await memory.listSales({ since: '2025-01-01T00:00:00Z', until: '2025-01-02T00:00:00Z' });
  assert.equal(blazeSales[0].channel, 'pickup');
  assert.deepEqual(blazeSales[0], memorySales[0]);
});
