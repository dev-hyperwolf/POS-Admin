/* pos/data.jsx — a check-in must record WHY it left the queue.
 *
 * THE DEFECT THESE TESTS EXIST FOR. removeCheckIn() spliced the row out of
 * CHECKINS and a check-in record carried no status or outcome field at all. So
 * "we sold to them" and "they walked out" were the same event: the only
 * surviving fact was the absence of the row. Nothing could tell throughput from
 * abandonment, and nothing said it could not.
 *
 * Worse, a completed sale never left the queue at all — onPaid marked the
 * TICKET paid and never touched CHECKINS — so a served customer sat on the
 * board until somebody pressed the X meant for a walk-out, at which point the
 * two became indistinguishable in the only way the data could express.
 *
 * WATCHED TO FAIL. Each check below was run against the pre-fix code first:
 * `settleCheckIn` did not exist, `removeCheckIn` returned a record with no
 * `outcome`, and CHECKIN_LOG was undefined. All four failed. They are evidence,
 * not decoration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

// JSDOM objects carry THAT realm's Object.prototype, so assert/strict's
// deepStrictEqual fails on two objects that print identically — it compares
// prototypes. Copy into this realm before deep-comparing.
const plain = (o) => JSON.parse(JSON.stringify(o));

test('a settled check-in records WHY it left, not just that it is gone', async () => {
  await withApp('pos', (app) => {
    const win = app.window;
    const HW = win.HW;
    const id = HW.CHECKINS[0].id;
    const before = HW.CHECKINS.length;

    const out = HW.settleCheckIn(id, 'served', { orderId: 'ORD-TEST' });

    assert.ok(out, 'settleCheckIn returned nothing for a real check-in id');
    assert.equal(out.outcome, 'served');
    assert.equal(out.orderId, 'ORD-TEST');
    assert.ok(out.settledAt > 0, 'no settledAt timestamp');
    assert.equal(HW.CHECKINS.length, before - 1, 'it did not leave the queue');
    assert.equal(HW.checkinById(id), null, 'still resolvable in the open queue');
  });
});

test('served and left are DISTINGUISHABLE after the fact — the whole point', async () => {
  await withApp('pos', (app) => {
    const win = app.window;
    const HW = win.HW;
    const [a, b] = HW.CHECKINS;
    HW.settleCheckIn(a.id, 'served');
    HW.settleCheckIn(b.id, 'left');

    const log = HW.settledCheckIns();
    const served = log.filter((e) => e.outcome === 'served').map((e) => e.id);
    const left = log.filter((e) => e.outcome === 'left').map((e) => e.id);

    assert.deepEqual(plain(served), [a.id]);
    assert.deepEqual(plain(left), [b.id]);
    // The pre-fix code could not express this at all: both rows simply vanished.
    assert.notEqual(served[0], left[0]);
  });
});

test('an unrecognised outcome is refused, never coerced to a plausible one', async () => {
  await withApp('pos', (app) => {
    const win = app.window;
    const HW = win.HW;
    const id = HW.CHECKINS[0].id;
    const before = HW.CHECKINS.length;

    assert.equal(HW.settleCheckIn(id, 'finished'), null, 'a typo was accepted');
    assert.equal(HW.settleCheckIn(id, undefined), null, 'a missing outcome was accepted');
    assert.equal(HW.CHECKINS.length, before, 'a refused settle still removed the row');
  });
});

test('no check-in has ended yet reads as "not known", never as zero', async () => {
  await withApp('pos', (app) => {
    const win = app.window;
    const HW = win.HW;
    // An empty board and "nothing has ended yet" are different answers. Returning
    // {} or {served:0} here would be the plausible default the estate keeps
    // getting caught by.
    assert.equal(HW.checkinOutcomeCounts(), null);
    HW.settleCheckIn(HW.CHECKINS[0].id, 'left');
    assert.deepEqual(plain(HW.checkinOutcomeCounts()), { left: 1 });
  });
});

test('openCheckInFor matches on memberId only — never guesses by name', async () => {
  await withApp('pos', (app) => {
    const win = app.window;
    const HW = win.HW;
    const ci = HW.CHECKINS[0];

    assert.equal(HW.openCheckInFor({ id: ci.memberId }).id, ci.id);
    // A guest on their own ticket carries no member id. Matching them by name
    // would settle the wrong person's check-in, undetectably.
    assert.equal(HW.openCheckInFor({ name: ci.name }), null, 'matched on name');
    assert.equal(HW.openCheckInFor(null), null);
  });
});
