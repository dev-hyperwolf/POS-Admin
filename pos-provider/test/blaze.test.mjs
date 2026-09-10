import test from 'node:test';
import assert from 'node:assert/strict';
import { BlazeProvider } from '../blaze.js';
import { PosError } from '../index.js';
import Contracts from '../../contracts/index.js';
import { makeFakeHttp, jsonResponse, noopSleep } from './helpers.mjs';
import { rawBlazeProduct, rawBlazeBatch, rawBlazeLocation, rawBlazeTerminal, rawBlazeTransaction, rawBlazeMember } from './fixtures.mjs';

const SECRET_PARTNER_KEY = 'pk-super-secret-value';
const SECRET_AUTH_KEY = 'ak-super-secret-value';

function makeProvider(handlers, extra = {}) {
  const http = makeFakeHttp(handlers);
  const provider = BlazeProvider({
    baseUrl: 'https://api.blaze.me/api/v1',
    partnerKey: SECRET_PARTNER_KEY,
    authKey: SECRET_AUTH_KEY,
    http,
    sleep: noopSleep,
    ...extra,
  });
  return { provider, http };
}

test('listProducts maps Blaze products to a contract-valid Product[]', async () => {
  const { provider, http } = makeProvider([
    { match: (u) => u.includes('/partner/store/inventory/products'), respond: () => jsonResponse(200, { values: [rawBlazeProduct] }) },
  ]);
  const products = await provider.listProducts({ storeId: 'corona' });
  assert.equal(products.length, 1);
  const p = products[0];
  assert.equal(p.id, '9001');
  assert.equal(p.source, 'blaze');
  assert.deepEqual(p.external_ids, [{ source: 'blaze', id: '9001' }]);
  assert.equal(p.price.cents, 2450);
  const result = Contracts.validate('Product', p);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  // request carried the credentials as headers, not in the URL
  assert.ok(!http.calls[0].url.includes(SECRET_PARTNER_KEY));
  assert.ok(!http.calls[0].url.includes(SECRET_AUTH_KEY));
});

test('getProduct maps a single Blaze product', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/partner/products/9001'), respond: () => jsonResponse(200, rawBlazeProduct) },
  ]);
  const p = await provider.getProduct('9001');
  assert.equal(p.name, 'Synthetic Gummies 100mg');
  assert.equal(Contracts.validate('Product', p).ok, true);
});

test('listBatches requires productId and maps to a contract-valid Batch[]', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/partner/store/batches'), respond: () => jsonResponse(200, { values: [rawBlazeBatch] }) },
  ]);
  await assert.rejects(() => provider.listBatches({}), (e) => e instanceof PosError && e.code === 'bad_request');
  const batches = await provider.listBatches({ productId: '9001' });
  assert.equal(batches.length, 1);
  const b = batches[0];
  assert.equal(b.product_id, '9001');
  assert.equal(b.batch_no, 'B-5001');
  assert.equal(b.quantity, 150); // liveQuantity, not quantity
  assert.equal(Contracts.validate('Batch', b).ok, true);
});

test('listLocations maps to a contract-valid Location[]', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/partner/store/inventory/inventories'), respond: () => jsonResponse(200, { values: [rawBlazeLocation] }) },
  ]);
  const locations = await provider.listLocations({});
  assert.equal(locations.length, 1);
  assert.equal(Contracts.validate('Location', locations[0]).ok, true);
});

test('listTerminals maps the port terminal shape', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/partner/store/inventory/terminals'), respond: () => jsonResponse(200, { values: [rawBlazeTerminal] }) },
  ]);
  const terminals = await provider.listTerminals({});
  assert.deepEqual(terminals, [{ terminal_id: '301', name: 'Driver Terminal 1', region_id: '12', location_id: '701' }]);
});

test('listSales: pagination, dedupe, completed-only filter, and asap/scheduled/pickup/express channel mapping', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => rawBlazeTransaction({ id: i + 1 }));
  const page2 = [
    rawBlazeTransaction({ id: 1 }), // duplicate of page1's id — must not double-count
    rawBlazeTransaction({ id: 101, orderTags: ['delivery'] }), // -> scheduled (no asap/pickup/express tag)
    rawBlazeTransaction({ id: 102, status: 'cancelled' }), // excluded entirely
    rawBlazeTransaction({ id: 103, orderTags: ['pickup'] }),
    rawBlazeTransaction({ id: 104, orderTags: ['express'], sellerTerminalId: 999 }),
  ];
  const { provider, http } = makeProvider([
    {
      match: (u) => u.includes('/partner/transactions'),
      respond: (u) => {
        const skip = new URL(u).searchParams.get('skip');
        return jsonResponse(200, { values: skip === '0' ? page1 : page2 });
      },
    },
  ]);

  const sales = await provider.listSales({ since: '2025-01-01T00:00:00Z', until: '2025-01-02T00:00:00Z' });
  // 100 (ids 1-100, asap) + 101 (scheduled) + 103 (pickup) + 104 (express); 102 excluded (cancelled);
  // duplicate id 1 counted once.
  assert.equal(sales.length, 103);
  assert.equal(http.calls.filter((c) => c.url.includes('/partner/transactions')).length, 2);

  const byId = Object.fromEntries(sales.map((s) => [s.order_id, s]));
  assert.equal(byId['1'].channel, 'asap');
  assert.equal(byId['101'].channel, 'scheduled');
  assert.equal(byId['103'].channel, 'pickup');
  assert.equal(byId['104'].channel, 'express');
  assert.equal(byId['1'].lines[0].product_id, '9001');
  assert.equal(byId['1'].lines[0].quantity, 2);
  assert.ok(!('102' in byId), 'cancelled transaction must be excluded');

  const filtered = await provider.listSales({ since: '2025-01-01T00:00:00Z', until: '2025-01-02T00:00:00Z', terminalIds: ['999'] });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].order_id, '104');
});

test('429 retries honouring retry-after, then succeeds', async () => {
  let calls = 0;
  const { provider, http } = makeProvider([
    {
      match: (u) => u.includes('/partner/store/inventory/inventories'),
      respond: () => {
        calls++;
        if (calls === 1) return jsonResponse(429, { error: 'slow down' }, { 'retry-after': '0' });
        return jsonResponse(200, { values: [rawBlazeLocation] });
      },
    },
  ]);
  const locations = await provider.listLocations({});
  assert.equal(locations.length, 1);
  assert.equal(http.calls.length, 2);
});

test('429 forever eventually throws rate_limited, not an infinite loop', async () => {
  const { provider, http } = makeProvider([
    { match: (u) => u.includes('/partner/store/inventory/inventories'), respond: () => jsonResponse(429, {}, { 'retry-after': '0' }) },
  ]);
  await assert.rejects(
    () => provider.listLocations({}),
    (e) => e instanceof PosError && e.code === 'rate_limited' && e.provider === 'blaze'
  );
  assert.equal(http.calls.length, 6); // initial + 5 retries
});

test('a non-2xx error becomes a PosError with no secret inside', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/partner/products/'), respond: () => jsonResponse(500, { error: 'boom' }) },
  ]);
  await assert.rejects(
    () => provider.getProduct('9001'),
    (e) => {
      assert.ok(e instanceof PosError);
      assert.equal(e.code, 'internal');
      assert.equal(e.status, 500);
      assert.equal(e.provider, 'blaze');
      const serialized = JSON.stringify({ message: e.message, code: e.code, status: e.status, provider: e.provider });
      assert.ok(!serialized.includes(SECRET_PARTNER_KEY));
      assert.ok(!serialized.includes(SECRET_AUTH_KEY));
      return true;
    }
  );
});

test('findMember: found by id validates as Person, and a 404 resolves to null', async () => {
  const { provider } = makeProvider([
    { match: (u) => u.includes('/partner/members/4001'), respond: () => jsonResponse(200, rawBlazeMember) },
    { match: (u) => u.includes('/partner/members/search/phone'), respond: () => jsonResponse(404, { error: 'no such member' }) },
  ]);
  const found = await provider.findMember({ id: '4001' });
  assert.equal(found.display_name, 'Synthetic Member');
  assert.equal(Contracts.validate('Person', found).ok, true);

  const missing = await provider.findMember({ phone: '+15555559999' });
  assert.equal(missing, null);
});

test('findMember requires a query key', async () => {
  const { provider } = makeProvider([]);
  await assert.rejects(() => provider.findMember({}), (e) => e instanceof PosError && e.code === 'bad_request');
});

test('createTransfer then acceptTransfer round-trip', async () => {
  const { provider, http } = makeProvider([
    { match: (u, o) => u.includes('/transferInventory') && !u.includes('/accept') && o.method === 'POST', respond: () => jsonResponse(200, { id: 8001 }) },
    { match: (u, o) => u.includes('/transferInventory/8001/accept') && o.method === 'POST', respond: () => jsonResponse(200, { ok: true }) },
  ]);
  const created = await provider.createTransfer({ from_location_id: '701', to_location_id: '702', lines: [{ product_id: '9001', batch_id: '5001', quantity: 5 }] });
  assert.deepEqual(created, { transfer_id: '8001', status: 'created' });
  const accepted = await provider.acceptTransfer(created.transfer_id);
  assert.deepEqual(accepted, { transfer_id: '8001', status: 'accepted' });
  const createBody = JSON.parse(http.calls[0].opts.body);
  assert.equal(createBody.fromInventoryId, '701');
  assert.equal(createBody.transferLogs[0].transferAmount, 5);
});

test('capabilities declares every operation supported', () => {
  const { provider } = makeProvider([]);
  const caps = provider.capabilities();
  assert.equal(caps.name, 'blaze');
  for (const supported of Object.values(caps.supports)) assert.equal(supported, true);
});
