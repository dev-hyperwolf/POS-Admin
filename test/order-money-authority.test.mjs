/* ONE ORDER, ONE SET OF NUMBERS — and one place to release it from.
 *
 * The owner's rule, verbatim: "the total needs to fully update when an
 * adjustment is made - no exceptions. This needs to be bulletproof."
 *
 * Every figure on the order panel used to be derived from
 *     seed = o.id.length + o.name.length + (o.items || 1)
 * while saveEdit writes `items: lines.length`. Changing the LINE COUNT
 * therefore changed the seed, which re-rolled the discount and the promo — so
 * the record, the panel that was open, and the panel reopened after the save
 * each held a different total for the same order. On top of that the committed
 * total was priced off a hard-coded demo basket the record had never agreed to
 * (ORD-00224: record $52.10, panel $131.85).
 *
 * These tests assert the INVARIANT, not a particular figure: whatever the money
 * is, HW.ORDERS and every rendering of that order say the same thing, before and
 * after an edit. A test pinned to $131.85 would pass a build that had merely
 * re-rolled the same wrong way twice.
 *
 * ⚠️ Values read through app.window are jsdom-realm objects: compare primitives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/**
 * Mount OrderDetails on a real record — and be able to CLOSE it and open it
 * again, because reopening from the queue is exactly when the third total used
 * to appear.
 *
 * ⚠️ Not app.mount(): that calls createRoot on the same #root every time, and a
 * second root on one container throws React's scheduler into "Should not
 * already be working", which then poisons every LATER test in the file instead
 * of failing the one that caused it. This owns its own host node and unmounts
 * the previous panel first, the way closing the modal would.
 */
function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => {
    if (!cur) return;
    try {cur.root.unmount();} catch {/* already gone */}
    cur.host.remove();
    cur = null;
  };
  const open = async (id) => {
    close();
    const rec = W.HW.orderById(id);
    assert.ok(rec, `${id} is not in the order book`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: rec, onClose() {} }));
    cur = { root, host };
    await app.settle();
    await app.settle();
    return W;
  };
  open.close = close;
  return open;
}

/** Run a body with a panel mounter, and always tear the panel down. */
function withPanels(fn) {
  return withApp('pos', async (app) => {
    const open = mounter(app);
    try {await fn(app, open);} finally {open.close();}
  });
}

/** Every "Total$xx.xx" the panel renders — the header figure and the totals
 *  row. Capital T, so "Subtotal", "Net subtotal" and "New total" are excluded. */
function totalsShown(app) {
  return [...app.text().matchAll(/(?:^|[^a-zA-Z])Total\$([\d,]+\.\d{2})/g)].
  map((m) => +m[1].replace(/,/g, ''));
}

/** The cart-level money the panel is showing, as one comparable string. */
function discountLine(app) {
  const t = app.text();
  const disc = t.match(/Discount · ([^−$]*)−\$([\d,]+\.\d{2})/);
  const promo = t.match(/Promo · ([A-Z0-9]+)\s*−\$([\d,]+\.\d{2})/);
  return `disc=${disc ? disc[1].trim() + '/' + disc[2] : 'none'} promo=${promo ? promo[1] + '/' + promo[2] : 'none'}`;
}

const clickIncrease = (app, nth = 0) => {
  const inc = [...app.document.querySelectorAll('button[aria-label="Increase"]')];
  assert.ok(inc[nth], 'no quantity stepper in the edit panel');
  inc[nth].dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

/* ── 1. the record and the panel open on the same money ──────────────────── */

test('OrderDetails: the queue record and the panel agree BEFORE anything is edited', async () => {
  await withPanels(async (app, open) => {
    const W = await open('ORD-00224');
    const rec = W.HW.orderById('ORD-00224');
    const shown = totalsShown(app);
    assert.ok(shown.length >= 1, `the panel rendered no total at all — ${app.text().slice(0, 300)}`);
    for (const v of shown) {
      assert.equal(v, rec.total,
        `the panel says $${v.toFixed(2)} and the order book says $${rec.total.toFixed(2)} — ` +
        'two views of one order, and an edit commits whichever one it happened to read');
    }
  });
});

/* ── 2. an edit that changes the line count must not re-roll the money ───── */

test('OrderDetails: adding a line does not re-roll the discount the customer agreed', async () => {
  await withPanels(async (app, open) => {
    const W = await open('ORD-00224');
    const before = discountLine(app);

    assert.ok(app.click('Edit order'), 'no Edit order button on a fulfilment order');
    await app.settle();
    assert.ok(app.click('Add item'), 'no Add item control in the edit panel');
    await app.settle();
    assert.ok(app.click('Add'), 'the product picker offered nothing to add');
    await app.settle();
    assert.ok(app.click('Save changes'), 'Save changes refused an added line');
    await app.settle();

    const saved = W.HW.orderById('ORD-00224');
    assert.equal(saved.items, saved.lines.length, 'the item count and the saved lines disagree');
    assert.equal(saved.items, 4, 'the added line was not committed, so nothing re-rolls either way');

    // Close and reopen — what the operator does when they click the card again.
    await open('ORD-00224');
    const after = discountLine(app);
    assert.equal(after, before,
      'the line count changed, so the seed changed, so the order re-rolled its own ' +
      'discount — money the customer had already agreed to');

    const rec = W.HW.orderById('ORD-00224');
    for (const v of totalsShown(app)) {
      assert.equal(v, rec.total,
        `the reopened panel says $${v.toFixed(2)} and the record holds $${rec.total.toFixed(2)} — ` +
        'the third of the three totals this order used to have');
    }
  });
});

/* ── 3. a promo applied mid-edit moves the DRAFT, not the agreed order ───── */

test('OrderDetails: a promo typed into an open edit does not move the committed total', async () => {
  await withPanels(async (app, open) => {
    const W = await open('ORD-00224');
    const committed = W.HW.orderById('ORD-00224').total;

    assert.ok(app.click('Edit order'), 'no Edit order button');
    await app.settle();
    const shownBefore = totalsShown(app);

    assert.ok(app.type('e.g. SUMMER15', 'BOGO5'), 'no promo code field in the edit panel');
    await app.settle();
    assert.ok(app.click('Apply'), 'no Apply button for the promo code');
    await app.settle();

    assert.match(app.text(), /Promo · BOGO5/, 'the code was accepted but nothing shows it');
    assert.equal(W.HW.orderById('ORD-00224').total, committed,
      'a promo typed into an UNSAVED edit moved the money on the record');
    assert.equal(totalsShown(app).join(','), shownBefore.join(','),
      'the agreed total moved while the edit was still open — the header now shows a ' +
      'price nobody saved, and the balance row compares the draft against it');
    assert.doesNotMatch(app.text(), /No balance change/,
      'a $5.00 promo changed what this order costs and the balance row says nothing moved');
  });
});

/* ── 4. a non-Weedmaps order stuck in verify has a release control ───────── */

test('OrderDetails: a non-Weedmaps order in Verification Pending can actually be released', async () => {
  await withPanels(async (app, open) => {
    const W = await open('ORD-00224');
    assert.notEqual(W.HW.orderById('ORD-00224').source, 'Weedmaps', 'fixture drift: this must not be a WM order');
    assert.equal(W.HW.orderById('ORD-00224').stage, 'verify', 'fixture drift');

    assert.ok(app.click('Verify & release'),
      'a non-Weedmaps order sitting in Verification Pending has no release control anywhere — ' +
      `buttons on screen: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.equal(W.HW.orderById('ORD-00224').stage, 'pack',
      'the release control did not move the order out of verification');
    assert.match(app.text(), /Now in Need to Pack on the board\./,
      'the operator is not told where the released order went');
  });
});

test('PackScanner: an unverified non-Weedmaps order is not sent to a panel it does not have', async () => {
  await withPanels(async (app, open) => {
    await open('ORD-00224');
    assert.ok(app.click('Scan to pack'), 'no Scan to pack button');
    await app.settle();
    const t = app.text();
    assert.match(t, /has not been verified yet/, 'fixture drift: the scanner note is gone');
    assert.doesNotMatch(t, /Weedmaps block/,
      'the scanner points the operator at the Weedmaps block, which does not render on this order');
  });
});

/* ── 5. a low-risk Weedmaps order does not claim to be released ──────────── */

test('WmOrderBlock: a low-risk order in verify shows the control instead of claiming it is done', async () => {
  await withPanels(async (app, open) => {
    const W = await open('ORD-00231');
    assert.equal(W.HW.WM_ORDER['ORD-00231'].level, 'low', 'fixture drift: this test needs a low-risk WM order');
    assert.equal(W.HW.orderById('ORD-00231').stage, 'verify', 'fixture drift');

    assert.doesNotMatch(app.text(), /Verified — cleared for fulfillment/,
      'the copy says the order is released while the board still has it in Verification Pending');
    assert.ok(app.click('Verify & release'),
      'a low-risk order pre-approves itself, so the row that calls doVerify never renders and ' +
      `nothing can release it. Buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.equal(W.HW.orderById('ORD-00231').stage, 'pack',
      'the order still has not left verification');
    assert.match(app.text(), /Verified — cleared for fulfillment/,
      'now that it really is released, say so');
  });
});

/* ── 6. the driver shown is the driver assigned ──────────────────────────── */

test('OrderDetails: the modal shows the driver that was ASSIGNED, not the seed', async () => {
  await withPanels(async (app, open) => {
    // What AssignDriverSheet writes, through the same store call.
    assert.ok(app.window.HW.updateOrder('ORD-00218', { driver: 'Maya C.' }), 'ORD-00218 is not in the order book');
    await open('ORD-00218');

    assert.match(app.text(), /Maya C\./,
      'the assigned driver is on the record and the modal renders the HW.DELIVERY seed instead');
    assert.doesNotMatch(app.text(), /Theo Reyes/,
      'the modal named a driver nobody assigned');
  });
});

test('OrderDetails: an unassigned delivery does not name a driver it has not got', async () => {
  await withPanels(async (app, open) => {
    const W = await open('ORD-00216');
    assert.equal((W.HW.DELIVERY['ORD-00216'] || {}).driver, 'Unassigned', 'fixture drift');
    assert.equal(W.HW.orderById('ORD-00216').driver, undefined, 'fixture drift: nothing has been assigned');

    assert.match(app.text(), /Unassigned/,
      'an order with no driver has to say so — dispatch acts on this field');
    assert.doesNotMatch(app.text(), /Theo Reyes/,
      'the modal named a driver for an order nobody is assigned to');
  });
});
