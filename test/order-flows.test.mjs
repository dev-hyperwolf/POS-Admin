/* The ORDER half of the demo, driven the way the floor drives it.
 *
 * Two findings, one shape — the same shape as the Members half. Every control
 * here RENDERED off window.HW.ORDERS and none of them could WRITE to it, so:
 *
 *   · "Save changes" appended a line to component state, closed the modal and
 *     said "Order updated". The record kept the old basket and the old money.
 *   · Nothing anywhere moved an order between fulfilment stages. A grep for
 *     `.stage =` found the seed literals and nothing else, so "Verify &
 *     release" released nothing and a completed pack scan packed nothing.
 *
 * Every test below asserts the RECORD in HW.ORDERS, and where the point is that
 * the operator can see it, the rendered text as well. None of them assert a
 * modal closing — closing the modal is precisely what the broken versions did.
 *
 * ⚠️ Values read through app.window are jsdom-realm objects: compare primitives
 * (a number, a string, .length, .join(',')), never deepEqual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── driving helpers ─────────────────────────────────────────────────────── */

/** The order card for an id. Cards are plain divs with an onClick, so app.click
 *  (button/a/[data-hw-i] only) cannot reach them — the innermost div carrying
 *  the id is the card body. Asserting it was found is what stops a test from
 *  "passing" against a click that landed on nothing. */
function openOrder(app, id) {
  const hits = [...app.document.querySelectorAll('div')]
    .filter((d) => (d.textContent || '').includes('#' + id));
  const card = hits[hits.length - 1];
  assert.ok(card, `no order card for ${id} on the board`);
  card.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Mount OrderDetails on a real record from the order book. The board mounts
 *  the same component with the same object; this skips the click-through when
 *  the test is about the record, not the navigation. */
async function openDetails(app, id) {
  const W = app.window;
  const rec = W.HW.orderById(id);
  assert.ok(rec, `${id} is not in the order book`);
  W.__OrderDetailsUnderTest = () => W.React.createElement(W.OrderDetails, { o: rec, onClose() {} });
  await app.mount('__OrderDetailsUnderTest');
  return W;
}

/** The Stepper's + is an icon-only button; its aria-label is the handle. */
function bumpQty(app, nth = 0) {
  const inc = [...app.document.querySelectorAll('button[aria-label="Increase"]')];
  assert.ok(inc[nth], 'no quantity stepper in the edit panel');
  inc[nth].dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

const clickDone = (app) => app.click((t) => /^Done/.test(t));

/* ── 1. "Save changes" commits the edit ──────────────────────────────────── */

test('OrderDetails: Save changes writes the basket, the total and the item count', async () => {
  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00224');
    const before = W.HW.orderById('ORD-00224');
    const total0 = before.total;
    assert.equal(before.lines, undefined, 'fixture drift: this order should start with no saved lines');

    assert.ok(app.click('Edit order'), 'no Edit order button on a fulfilment order');
    await app.settle();
    bumpQty(app);                       // Cake Crasher 4 → 5, +$15 of product
    await app.settle();
    assert.ok(app.click('Save changes'), 'no Save changes button');
    await app.settle();

    const after = W.HW.orderById('ORD-00224');
    assert.notEqual(after.total, total0,
      'the toast said "Order updated" and the record still holds the old money');
    assert.ok(after.lines && after.lines.length === 3,
      'the edited line items were never written to the order');
    assert.equal(after.lines.map((l) => l.qty).join(','), '5,1,2',
      'the draft quantity was thrown away on save');
    assert.equal(after.items, 3, 'the item count must match the lines that were saved');
    assert.match(app.text(), /Order updated/, 'the operator gets no confirmation at all');
  });
});

/* ── 2. …and the queue behind it moves ───────────────────────────────────── */

test('OrdersScreen: a saved edit shows up on the order card in the queue', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const money = (id) => {
      const o = app.window.HW.orderById(id);
      return app.window.HW.fmt.money(o.total);
    };
    assert.match(app.text(), new RegExp(money('ORD-00224').replace('$', '\\$')),
      'fixture drift: the card should show the seeded total before the edit');

    openOrder(app, 'ORD-00224');
    await app.settle();
    assert.ok(app.click('Edit order'), 'the card did not open the order detail');
    await app.settle();
    bumpQty(app);
    await app.settle();
    assert.ok(app.click('Save changes'));
    await app.settle();

    const saved = app.window.HW.orderById('ORD-00224');
    assert.ok(saved.total > 52.1, 'nothing was committed, so there is nothing to show');
    assert.match(app.text(), new RegExp(app.window.HW.fmt.money(saved.total).replace('$', '\\$')),
      'the record moved but the queue still renders the old total — which reads as broken');
  });
});

/* ── 3. a refusal names itself ───────────────────────────────────────────── */

test('OrderDetails: Save changes says why it is disabled instead of just greying out', async () => {
  await withApp('pos', async (app) => {
    await openDetails(app, 'ORD-00224');
    assert.ok(app.click('Edit order'));
    await app.settle();

    // Nothing touched yet.
    assert.match(app.text(), /Nothing has changed yet/,
      'a disabled Save with no sentence beside it is indistinguishable from a dead button');

    // Strip every unit off every line: that is a cancellation, not an edit.
    for (let pass = 0; pass < 12; pass++) {
      const dec = [...app.document.querySelectorAll('button[aria-label="Decrease"]')]
        .filter((b) => !b.disabled);
      if (!dec.length) break;
      dec[0].dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await app.settle();
    }
    assert.match(app.text(), /cancellation, not an edit/,
      'emptying the order must be refused out loud, not saved as a zero-item order');
    assert.equal(app.window.HW.orderById('ORD-00224').lines, undefined,
      'nothing may be committed while the edit is refused');
  });
});

/* ── 4. "Verify & release" leaves 'verify' ───────────────────────────────── */

test('WmOrderBlock: Verify & release moves the order out of Verification Pending', async () => {
  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00232');
    assert.equal(W.HW.orderById('ORD-00232').stage, 'verify', 'fixture drift');

    assert.ok(app.click('Verify & release'), 'no Verify & release button');
    await app.settle();

    assert.equal(W.HW.orderById('ORD-00232').stage, 'pack',
      'the order was "cleared for fulfillment" and never left the verification column');
    assert.match(app.text(), /Our stageNeed to Pack/,
      'the record moved but the panel still shows the old stage');
    assert.match(app.text(), /moved to Need to Pack/,
      'the activity log must record where the order went');
  });
});

/* ── 5. hold / reject deliberately do NOT move it — and say so ───────────── */

test('WmOrderBlock: Hold and Reject leave the stage alone and say where the order sits', async () => {
  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00237');
    assert.ok(app.click('Hold'), 'no Hold button');
    await app.settle();
    assert.equal(W.HW.orderById('ORD-00237').stage, 'verify',
      'an order on hold must stay in Verification Pending');
    assert.match(app.text(), /Stays in Verification Pending/,
      'a decision that moves nothing on the board has to say so');
  });

  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00237');
    assert.ok(app.click('Reject'), 'no Reject button');
    await app.settle();
    assert.equal(W.HW.orderById('ORD-00237').stage, 'verify',
      'there is no cancelled stage — a rejected order must not be written into one');
    assert.match(app.text(), /no cancelled column/,
      'the operator has to be told the rejected order is still sitting on the board');
  });
});

/* ── 6. a completed pack scan leaves packing ─────────────────────────────── */

test('PackScanner: scanning every unit moves the order to Ready for Pickup', async () => {
  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00222');
    assert.equal(W.HW.orderById('ORD-00222').stage, 'pack', 'fixture drift');

    assert.ok(app.click('Scan to pack'), 'no Scan to pack button');
    await app.settle();
    for (let i = 0; i < 8; i++) {
      if (!app.click('Simulate scan')) break;   // the button disappears when all units are in
      await app.settle();
    }
    const doneLabels = app.buttons().filter((b) => /^Done/.test(b)).join(' | ');
    assert.ok(clickDone(app), 'no Done button');
    await app.settle();

    assert.equal(W.HW.orderById('ORD-00222').stage, 'ready',
      'every unit was scanned and packed and the order never left the packing lane');
    assert.match(app.text(), /Scanned & packed 4\/4 units/,
      'the log must record what was actually scanned, not the full order regardless');
    assert.match(doneLabels, /Done — move to Ready for Pickup/,
      'the button must say what it is about to do before it is pressed');
  });
});

/* ── 7. a half-finished scan is packing, not ready ───────────────────────── */

test('PackScanner: a partial scan moves Need to Pack → Packing in Progress, not Ready', async () => {
  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00222');
    assert.ok(app.click('Scan to pack'));
    await app.settle();
    assert.ok(app.click('Simulate scan'), 'no Simulate scan button');
    await app.settle();
    assert.ok(clickDone(app));
    await app.settle();

    assert.equal(W.HW.orderById('ORD-00222').stage, 'packing',
      'one unit of four is packing under way, not ready for pickup');
  });
});

/* ── 8. packing does not release an unverified order — and says why ──────── */

test('PackScanner: an unverified order is not released by packing it', async () => {
  await withApp('pos', async (app) => {
    const W = await openDetails(app, 'ORD-00224');
    assert.equal(W.HW.orderById('ORD-00224').stage, 'verify', 'fixture drift');

    assert.ok(app.click('Scan to pack'));
    await app.settle();
    for (let i = 0; i < 10; i++) {
      if (!app.click('Simulate scan')) break;
      await app.settle();
    }
    assert.match(app.text(), /has not been verified yet/,
      'the scanner has to explain why finishing will not move the order');
    assert.ok(clickDone(app));
    await app.settle();

    assert.equal(W.HW.orderById('ORD-00224').stage, 'verify',
      'packing an order must never skip the verification gate');
  });
});
