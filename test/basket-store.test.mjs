/* A basket belongs to a STOP, not to the app.
 *
 * Four attempts at the governed driver swap died partly here. `cart`/`cartTaskId`
 * is one slot for the whole app, and every reader falls back to the shipped
 * basket when the slot names a different task — so a swap committed at stop A
 * was silently undone by opening stop B. The audit record survived, the van
 * ledger survived, and the BASKET reverted, which is the worst of the three:
 * the stock stayed spent while the order went back to asking for the original
 * product, so the van could be over-allocated once per revisit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const A = 't1', B = 't2';
const basket = (sku, qty) => [{ sku, qty }];

test('a basket survives the driver visiting another stop', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    M.setBasket(A, basket('SKU-A', 2));
    // The whole failure, in one line: touch another stop.
    M.startCart(B, basket('SKU-B', 1));
    assert.equal(M.basketFor(A)[0].sku, 'SKU-A', 'stop A lost its basket the moment stop B was opened');
    assert.equal(M.basketFor(A)[0].qty, 2);
  });
});

test('itemsFor prefers the edited basket and falls back to what shipped', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    const shipped = basket('SKU-SHIPPED', 3);
    assert.equal(M.itemsFor('t-none', shipped)[0].sku, 'SKU-SHIPPED', 'an unedited stop delivers what it shipped with');
    M.setBasket('t-none', basket('SKU-SWAPPED', 1));
    assert.equal(M.itemsFor('t-none', shipped)[0].sku, 'SKU-SWAPPED', 'once edited, the edit is what is delivered');
    assert.equal(M.itemsFor('t-none', shipped).length, 1);
  });
});

test('two stops keep two different baskets', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    M.setBasket(A, basket('SKU-A', 1));
    M.setBasket(B, basket('SKU-B', 5));
    assert.equal(M.basketFor(A)[0].sku, 'SKU-A');
    assert.equal(M.basketFor(B)[0].qty, 5);
    assert.notEqual(M.basketFor(A)[0].sku, M.basketFor(B)[0].sku);
  });
});

test('the store hands out copies — a caller cannot mutate it by reference', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    M.setBasket(A, basket('SKU-A', 1));
    const got = M.basketFor(A);
    got[0].qty = 999;
    assert.equal(M.basketFor(A)[0].qty, 1, 'a screen holding the array must not be able to edit the store through it');
  });
});

test('a junk basket is refused, never filed under undefined', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    assert.equal(M.setBasket(null, basket('X', 1)), null, 'no taskId means the caller lost track of the stop');
    assert.equal(M.setBasket(A, 'not-an-array'), null);
    // A zero-qty line is not a line. Filing it makes an empty basket look edited.
    assert.equal(M.setBasket(A, [{ sku: 'X', qty: 0 }, { sku: 'Y', qty: 2 }]).length, 1);
    assert.equal(M.basketFor(A)[0].sku, 'Y');
  });
});

test('clearing is real, and says whether it did anything', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    M.setBasket(A, basket('SKU-A', 1));
    assert.equal(M.clearBasket(A), true);
    assert.equal(M.basketFor(A), null, 'a cleared stop goes back to delivering what it shipped with');
    assert.equal(M.clearBasket(A), false, 'clearing nothing must report that it cleared nothing');
  });
});

test('a write notifies — a screen that never re-renders is still broken', async () => {
  await withApp('driver', async (app) => {
    const M = app.window.M;
    let fired = 0;
    const off = M.subscribe(() => { fired++; });
    M.setBasket(A, basket('SKU-A', 1));
    M.clearBasket(A);
    off();
    M.setBasket(A, basket('SKU-A', 1));
    assert.equal(fired, 2);
  });
});
