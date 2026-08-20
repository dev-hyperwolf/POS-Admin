/* AN ORDER THIS APP DID NOT CREATE MUST NOT HAVE ITS MONEY INVENTED.
 *
 * Live Weedmaps orders arrive through shared/hw-live.js with `_live: true` and
 * deliberately no `money` and no `lines` — items:0 means "we were not told",
 * not "there is nothing". seedOrderMoney's answer to an order with no lines is
 * DEMO_BASKET, so commitOrderMoney would fabricate a basket for a real
 * customer's order and overwrite its total with goods they never bought.
 *
 * ⚠️ THIS CANNOT FAIL ON main ALONE — it needs the Weedmaps seam present to have
 * anything to corrupt. It is written here so the guard is pinned BEFORE the
 * merge rather than discovered after it, and so that anyone removing the guard
 * later fails a test instead of a customer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('a live order keeps its own total and is given no money record', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, HW = W.HW;
    // Exactly the shape hw-live files: a real total, no lines, no money.
    const o = HW.addOrder({ name: 'WM Customer', total: 87.5, items: 0, stage: 'verify',
      source: 'Weedmaps', channel: 'Delivery' });
    HW.updateOrder(o.id, { _live: true });

    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: HW.orderById(o.id), onClose() {} }));
    await app.settle(); await app.settle();
    try {
      const after = HW.orderById(o.id);
      assert.equal(after.total, 87.5,
        `the panel rewrote a live order's total: 87.5 -> ${after.total}`);
      assert.equal(after.money, undefined,
        'a live order must not be given a fabricated money record');
    } finally { root.unmount(); host.remove(); }
  });
});

test('an order this app DID create is still priced normally', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, HW = W.HW;
    // The negative control: without it, `return false` at the top of
    // commitOrderMoney would pass the test above and break every real order.
    const p = HW.PRODUCTS.find((x) => x.active);
    const o = HW.addOrder({ name: 'Local Sale', total: 0, items: 1, stage: 'verify',
      lines: [{ name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price, total: p.price }] });

    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: HW.orderById(o.id), onClose() {} }));
    await app.settle(); await app.settle();
    try {
      const after = HW.orderById(o.id);
      assert.ok(after.money, 'a locally created order must still get its money record');
      assert.ok(after.total > 0, 'and must still be priced');
    } finally { root.unmount(); host.remove(); }
  });
});
