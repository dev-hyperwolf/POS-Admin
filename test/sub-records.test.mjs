/* The audit store the governed swap needs — built before the surface that uses
 * it, because keeping it in component state is what sank three attempts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const rec = (id, orderId) => ({ id, orderId, lineId: 'l1', quantity: 1,
  fromProductName: 'A', toProductName: 'B', occurredAt: '2026-08-19T22:00:00.000Z' });

test('a filed record outlives the screen that filed it', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const id = HW.ORDERS[0].id;
    assert.ok(HW.addSubRecord(rec('sub-1', id)));
    assert.equal(HW.subRecords(id).length, 1, 'the record must be readable from anywhere, not just the panel');
  });
});

test('filing the same substitution twice files ONE record', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const id = HW.ORDERS[0].id;
    HW.addSubRecord(rec('sub-dup', id));
    // Attempt 3 minted ids from a component ref that reset to 0 on unmount, so
    // one order+line produced the SAME id across visits — different events
    // sharing an id. Keying on the engine's id makes a re-commit a no-op.
    assert.equal(HW.addSubRecord(rec('sub-dup', id)), null, 'a duplicate must be refused');
    assert.equal(HW.subRecords(id).filter((r) => r.id === 'sub-dup').length, 1);
  });
});

test('records are scoped to their order, and a write notifies', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const [a, b] = [HW.ORDERS[0].id, HW.ORDERS[1].id];
    let fired = 0;
    const off = HW.subscribe(() => { fired++; });
    HW.addSubRecord(rec('sub-a', a));
    HW.addSubRecord(rec('sub-b', b));
    off();
    assert.equal(fired, 2, 'a panel that never re-renders shows a stale audit trail');
    assert.ok(HW.subRecords(a).every((r) => r.orderId === a), "another order's records must not leak in");
    assert.ok(!HW.subRecords(a).some((r) => r.id === 'sub-b'));
  });
});

test('a record without an engine id is refused, not filed under undefined', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    assert.equal(HW.addSubRecord(null), null);
    assert.equal(HW.addSubRecord({ orderId: 'ORD-1' }), null, 'no id means the caller read the wrong path off the engine result');
  });
});
