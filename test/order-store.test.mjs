/* The order store — the write path that did not exist.
 *
 * Same gap as MEMBERS, same symptom: every screen rendered from window.HW.ORDERS
 * and nothing could write to it, so "Save changes" toasted "Order updated" and
 * committed nothing, a completed sale printed a receipt naming an order id that
 * was never created, and a grep for `.stage =` found only seed literals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('addOrder creates a real record at the top of the queue', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const before = HW.ORDERS.length;
    const o = HW.addOrder({ name: 'Probe Person', total: 41.25, items: 2, pay: 'Card' });

    assert.equal(HW.ORDERS.length, before + 1);
    assert.equal(HW.ORDERS[0].id, o.id, 'newest first, or nobody sees the sale they just took');
    assert.equal(o.total, 41.25);
    assert.equal(o.stage, 'verify', 'a new order starts at the front of fulfilment');
    assert.ok(/^ORD-\d{5}$/.test(o.id), `id looks wrong: ${o.id}`);
  });
});

test('ids do not collide with what is already on the board', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    for (let i = 0; i < 5; i++) HW.addOrder({ name: 'P' + i, total: 10 });
    const ids = HW.ORDERS.map((o) => o.id).join(',').split(',');
    assert.equal(new Set(ids).size, ids.length, 'duplicate order id');
  });
});

test('setStage moves an order, and REFUSES a stage that does not exist', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const o = HW.addOrder({ name: 'Stage Probe', total: 20 });

    assert.ok(HW.setStage(o.id, 'pack'));
    assert.equal(HW.orderById(o.id).stage, 'pack');

    // A typo'd stage silently removes the order from every queue that filters on
    // the known set — which looks exactly like the order having been deleted.
    assert.equal(HW.setStage(o.id, 'nonsense'), null, 'an unknown stage must be refused');
    assert.equal(HW.orderById(o.id).stage, 'pack', 'and must not have been written');
  });
});

test('nextStage walks the pipeline and stops at the end', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const walked = [];
    let s = 'verify';
    while (s) { walked.push(s); s = HW.nextStage(s); }
    assert.equal(walked.join(' -> '), HW.STAGES.join(' -> '));
    assert.equal(HW.nextStage('done'), null, 'nothing follows done');
    assert.equal(HW.nextStage('nonsense'), null);
  });
});

test('updateOrder patches in place and keeps money in cents', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const o = HW.addOrder({ name: 'Money Probe', total: 10 });
    assert.equal(HW.updateOrder(o.id, { total: 99.999 }).total, 100,
      'a float total would print as $99.99899999 somewhere');
    assert.equal(HW.updateOrder('ORD-NOPE', { total: 1 }), null, 'unknown id must not create one');
  });
});

test('a write notifies subscribers — or the screen never shows it', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    let fired = 0;
    const off = HW.subscribe(() => { fired++; });
    HW.addOrder({ name: 'Notify Probe', total: 5 });
    HW.setStage(HW.ORDERS[0].id, 'pack');
    off();
    HW.addOrder({ name: 'After Unsubscribe', total: 5 });
    assert.equal(fired, 2, 'a real write the table does not re-render for is still broken to the user');
  });
});
