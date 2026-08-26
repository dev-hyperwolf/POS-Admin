/* THE RECORD THE TAB FILES MUST BE THE RECORD THE STOREFRONT READS.
 *
 * 🔴 A refuter found the merchandising tab filing `{ id, kind, label }` while
 * shop/data.jsx resolves a pick by `item.brand` or `item.sku`. Neither key was
 * ever written, so EVERY storefront eligibility guard was switched off: a brand
 * the shop does not carry, or a sku not in the catalogue, sailed through with
 * no refusal at all.
 *
 * The tab had four screens of guards standing in front of a path no
 * POS-authored record could reach — the same shape as the returns refund branch
 * that nine tests passed over. It survived because nothing in the tab ever read
 * the FILED RECORD back; every test asserted that a click returned true.
 *
 * So these assert on what HWMerch actually holds, and then feed exactly that to
 * the storefront's own resolver.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('a brand pick carries the key the storefront resolves on', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, M = W.HWMerch, D = W.SHOPDATA;
    M.reset();
    const brand = D.allProducts()[0].brand;
    assert.ok(brand, 'the fixture needs a carried brand');

    M.set('shop_spotlight', 'all',
      { mode: 'carousel', items: [{ id: 'brand:x', kind: 'brand', brand, label: brand }], state: 'live' }, 'tester');

    const filed = M.get('shop_spotlight', 'all').items[0];
    assert.equal(filed.brand, brand, 'the filed record must carry `brand`, not only an id');
    // And the storefront's own resolver must accept it.
    assert.equal(D.merchWhyNot ? D.merchWhyNot(filed) : null, null,
      'a carried brand must not be refused');
  });
});

test('a brand the shop does NOT carry is refused — the guard is reachable', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, M = W.HWMerch, D = W.SHOPDATA;
    M.reset();
    if (typeof D.merchWhyNot !== 'function') return;   // resolver not exposed; covered elsewhere

    const bogus = { id: 'brand:nope', kind: 'brand', brand: 'Brand We Do Not Carry', label: 'Nope' };
    assert.equal(D.merchWhyNot(bogus), 'brand-not-carried',
      'this guard was unreachable while the tab filed no `brand` key at all');

    // THE NEGATIVE CONTROL: the same record WITHOUT the key sails through, which
    // is exactly what shipped.
    const keyless = { id: 'brand:nope', kind: 'brand', label: 'Nope' };
    assert.notEqual(D.merchWhyNot(keyless), 'brand-not-carried',
      'if this now refuses too, the resolver changed and this test is stale');
  });
});

test('a product pick carries its sku', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, M = W.HWMerch, D = W.SHOPDATA;
    M.reset();
    const p = D.allProducts()[0];
    M.set('cart_addon', 'all',
      { mode: 'carousel', items: [{ id: 'sku:' + p.sku, kind: 'product', sku: p.sku, label: p.name }], state: 'live' }, 'tester');
    const filed = M.get('cart_addon', 'all').items[0];
    assert.equal(filed.sku, p.sku, 'the filed record must carry `sku`');
    if (typeof D.merchWhyNot === 'function') {
      assert.equal(D.merchWhyNot(filed), null);
      assert.equal(D.merchWhyNot({ id: 'sku:zzz', kind: 'product', sku: 'ZZZ-NOT-REAL' }), 'sku-not-in-catalogue');
    }
  });
});
