/* ── THE REGISTER'S MONEY PATHS, DRIVEN FOR REAL ─────────────────────────────
 *
 * Six findings, one family: the register takes money and then disagrees with
 * itself about what happened.
 *
 *   1. a finalized payment dismissed with the header ✕ (or the scrim) wrote NO
 *      order — the drawer had popped, the cash was banked on the session and
 *      the receipt had printed, but recordSale only ran from "Done · new sale"
 *   2. a paid ticket kept its cart and its TENDER button, so a second press
 *      wrote a SECOND real order for money nobody collected
 *   3. "Pay all" — the party's one-tender control — was a bare toast: it
 *      congratulated the operator and wrote nothing
 *   4. emptying a ticket line-by-line left its discounts behind, so the next
 *      sale on that ticket was silently mispriced
 *   5. the order recorded the cart total, not the money collected: the reward
 *      ladder and wallet credit in pos/payment.jsx reduce `balance` and never
 *      touch the cart total
 *   6. the member's order history handed OrderDetails a synthetic literal whose
 *      id ('00219', not 'ORD-00219') no order book has ever held
 *
 * Every test here fails on the code as it stood. Read `ui-harness.mjs` first —
 * in particular the CROSS-REALM trap: values reached through `app.window` are
 * jsdom-realm objects, so these compare primitives and never deepEqual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** The Total line in the cart footer, as a number. `app.text()` collapses
 *  whitespace and adjacent spans have none, so the footer reads "Items2Total$39.43". */
function totalShown(app) {
  const m = app.text().match(/Items\s*(\d+)\s*Total\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[2].replace(/,/g, '')) : null;
}
/** The Discount line, or null when the footer is not showing one. */
function discountShown(app) {
  const m = app.text().match(/Discount\s*−\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
/** Click a button whose label STARTS with `prefix`, optionally inside `within`. */
function clickStarts(app, prefix, within) {
  return app.click((t, el) => t.startsWith(prefix) && (!within || !!el.closest(within)));
}
/** Click an IconBtn by the aria-label its `icon` name produces. */
function clickIcon(app, label, { nth = 0 } = {}) {
  return app.click((t, el) => el.getAttribute('aria-label') === label, { nth });
}
/** Walk the payment modal to the point where the money is taken and the
 *  receipt is on screen — but do NOT dismiss it. `due` is the balance the
 *  drawer is asking for, which is the cart total minus any credits applied. */
async function tenderCashToReceipt(app, due) {
  assert.ok(app.click('TENDER'), `no TENDER button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Cash')), `no Cash tile — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  const quick = '$' + Math.ceil(due).toFixed(2);
  assert.ok(app.click(quick), `no quick-cash ${quick} — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(clickStarts(app, 'Complete'), `no Complete button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.match(app.text(), /Payment complete/, 'the receipt stage never rendered — the money was not taken');
}
/** The whole flow, dismissed the normal way. */
async function tenderCash(app, due) {
  await tenderCashToReceipt(app, due);
  assert.ok(clickStarts(app, 'Done · new sale'), `no "Done · new sale" — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
}
/** Open a separate ticket for the first guest in the party roster. */
async function openSecondTicket(app) {
  assert.ok(clickStarts(app, 'Party'), `no Party button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click('Ticket'), `no "Ticket" button in the party panel — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.match(app.text(), /Separate ticket opened/, 'the second ticket was not opened');
}

/* ── 1. the receipt's ✕ must not decide whether the sale is recorded ──────── */

test('tender: dismissing the receipt with ✕ still writes the order', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');

    const before = HW.ORDERS.length;
    const total = totalShown(app);
    assert.ok(total > 0, 'the seeded ticket should have a total to tender');

    await tenderCashToReceipt(app, total);

    // The money is already taken at this point: the drawer popped and the
    // receipt printed. Dismiss with the header ✕ instead of "Done · new sale".
    assert.ok(clickIcon(app, 'x'), `no ✕ on the receipt — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.equal(HW.ORDERS.length, before + 1,
      'the payment was finalized and dismissed with ✕ — the money was taken and no order exists');
    const rec = HW.ORDERS[0];
    assert.equal(rec.name, 'Girish Sharma', 'the order was not filed against the person who bought it');
    assert.equal(rec.total, total, 'the order total is not what the customer was charged');
    assert.equal(rec.stage, 'verify', 'a new sale should enter the queue at verify');
    // And the ticket is reset, exactly as the Done button leaves it.
    assert.match(app.text(), /Cart is empty/, 'the ticket was not reset after the sale was recorded');
  });
});

test('tender: dismissing the receipt with the scrim still writes the order', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');

    const before = HW.ORDERS.length;
    const total = totalShown(app);
    await tenderCashToReceipt(app, total);

    // The scrim is a plain div, so it is not reachable through app.click —
    // dispatch on it the way a user's click on the dark surround does.
    const scrim = [...app.document.querySelectorAll('div')].find((d) => d.style.zIndex === '80');
    assert.ok(scrim, 'no payment-modal scrim to click');
    scrim.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    assert.equal(HW.ORDERS.length, before + 1,
      'the payment was finalized and dismissed with the scrim — the money was taken and no order exists');
    assert.equal(HW.ORDERS[0].total, total, 'the order total is not what the customer was charged');
  });
});

test('tender: abandoning the modal BEFORE paying still writes nothing', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const before = HW.ORDERS.length;
    const total = totalShown(app);

    assert.ok(app.click('TENDER'), 'no TENDER button');
    await app.settle();
    assert.match(app.text(), /Balance due/, 'the tender did not open');
    assert.ok(clickIcon(app, 'x'), 'no ✕ on the payment modal');
    await app.settle();

    assert.equal(HW.ORDERS.length, before, 'walking away from an unpaid tender wrote an order');
    assert.equal(totalShown(app), total, 'the ticket was cleared by a cancelled tender');
  });
});

/* ── 2. a paid ticket cannot be paid again ───────────────────────────────── */

test('tender: a paid ticket cannot be re-tendered into a second order', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const before = HW.ORDERS.length;

    await openSecondTicket(app);
    // The new ticket is empty and now active — put something on it.
    assert.ok(app.click('Add'), `no product Add button — buttons: ${app.buttons().slice(0, 12).join(' | ')}`);
    await app.settle();

    const guestTotal = totalShown(app);
    assert.ok(guestTotal > 0, 'the guest ticket has nothing on it to tender');
    await tenderCash(app, guestTotal);
    assert.equal(HW.ORDERS.length, before + 1, 'the guest ticket did not write its order');
    const firstId = HW.ORDERS[0].id;

    // Go back to the ticket that was just paid.
    assert.ok(app.click((t) => /paid/.test(t) && /Mia/.test(t)),
      `no paid ticket tab to return to — buttons: ${app.buttons().slice(0, 12).join(' | ')}`);
    await app.settle();

    // A paid ticket must present nothing to tender. If it still does, driving it
    // writes the second phantom order this test exists to stop.
    const retendered = app.click('TENDER');
    if (retendered) {
      await app.settle();
      if (app.click((t) => t.startsWith('Cash'))) {
        await app.settle();
        const quick = '$' + Math.ceil(guestTotal).toFixed(2);
        if (app.click(quick)) {
          await app.settle();
          if (clickStarts(app, 'Complete')) {
            await app.settle();
            clickStarts(app, 'Done · new sale');
            await app.settle();
          }
        }
      }
    }

    assert.equal(HW.ORDERS.length, before + 1,
      `re-tendering a paid ticket wrote a second real order (${HW.ORDERS.map((o) => o.id).slice(0, 3).join(', ')})`);
    assert.equal(HW.ORDERS[0].id, firstId, 'a second order was filed for money nobody collected');
  });
});

/* ── 3. "Pay all" must write every open ticket ───────────────────────────── */

test('pay all: the party one-tender writes a real order per open ticket', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const before = HW.ORDERS.length;

    await openSecondTicket(app);
    assert.ok(app.click('Add'), 'no product Add button');
    await app.settle();

    // Two open tickets, both with items.
    assert.match(app.text(), /0 paid, 2 open/, `the party bar is not showing two open tickets: ${app.text().slice(0, 300)}`);
    const partyDue = Number((app.text().match(/Party\s*\$([\d,]+\.\d\d)/) || [])[1]?.replace(/,/g, ''));
    assert.ok(partyDue > 0, 'the party bar shows no money owed');

    assert.ok(app.click('Pay all'), `no "Pay all" button — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    // One tender, taken once, for the whole party.
    assert.match(app.text(), /Balance due/, '"Pay all" did not open a tender — it is still a bare toast');
    assert.ok(app.click((t) => t.startsWith('Cash')), 'no Cash tile on the party tender');
    await app.settle();
    assert.ok(app.click('$' + Math.ceil(partyDue).toFixed(2)),
      `no quick-cash for the party total — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.ok(clickStarts(app, 'Complete'), 'no Complete button on the party tender');
    await app.settle();
    assert.ok(clickStarts(app, 'Done · new sale'), 'no "Done · new sale" on the party receipt');
    await app.settle();

    assert.equal(HW.ORDERS.length, before + 2,
      '"Pay all" charged the party and wrote no orders — the sale is in no queue');
    const two = HW.ORDERS.slice(0, 2);
    const sum = Math.round(two.reduce((s, o) => s + o.total, 0) * 100) / 100;
    assert.equal(sum, partyDue, `the two orders (${two.map((o) => o.total).join(' + ')}) do not add up to the ${partyDue} tendered`);
    assert.equal(two.filter((o) => o.stage === 'verify').length, 2, 'the party orders did not enter the queue');
    // Distinct records, distinct ids.
    assert.notEqual(two[0].id, two[1].id, 'both tickets were filed under one order id');
    assert.match(app.text(), /2 paid, 0 open/, 'the party bar still shows open tickets after one tender');
  });
});

/* ── 4. emptying a ticket empties its discounts ──────────────────────────── */

test('discount: emptying a ticket line-by-line does not leave a discount behind', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');

    // The seeded ticket is Girish Sharma; the $2.50 coin is the 100-pt rung.
    assert.ok(app.click((t, el) => t.startsWith('$2.50') && !!el.closest('[data-tour="rewards-card"]')),
      'no $2.50 reward coin on the cart');
    await app.settle();
    assert.equal(discountShown(app), 2.5, 'the reward did not apply');

    // Empty the cart the way an associate does — one line at a time, never
    // touching Clear. Two lines, two trash presses.
    assert.ok(clickIcon(app, 'trash'), `no trash control on a cart line — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.ok(clickIcon(app, 'trash'), 'no trash control on the last cart line');
    await app.settle();
    assert.match(app.text(), /Cart is empty/, 'the cart did not empty');

    // Next sale on the same ticket.
    assert.ok(app.click('Add'), 'no product Add button');
    await app.settle();

    assert.equal(discountShown(app), null,
      'the $2.50 discount survived the empty cart and silently mispriced the next sale');
  });
});

/* ── 5. the order records what was collected, not the pre-credit total ───── */

test('credits: a reward taken at the drawer is on the order the sale writes', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const total = totalShown(app);
    assert.ok(total > 2.5, 'the seeded ticket is too small to redeem against');

    assert.ok(app.click('TENDER'), 'no TENDER button');
    await app.settle();

    // The payment modal's own reward ladder — NOT the cart's rewards card.
    assert.ok(app.click((t, el) => t.startsWith('$2.50 off') && !el.closest('[data-tour="rewards-card"]')),
      `no $2.50 reward in the payment modal — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    const due = Math.round((total - 2.5) * 100) / 100;
    assert.match(app.text(), new RegExp(`Credits − \\$2\\.50`), 'the credit did not reduce the balance due');

    assert.ok(app.click((t) => t.startsWith('Cash')), 'no Cash tile');
    await app.settle();
    assert.ok(app.click('$' + Math.ceil(due).toFixed(2)), `no quick-cash for the ${due} balance — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.ok(clickStarts(app, 'Complete'), 'no Complete button');
    await app.settle();
    assert.ok(clickStarts(app, 'Done · new sale'), 'no "Done · new sale"');
    await app.settle();

    const rec = HW.ORDERS[0];
    assert.equal(rec.total, due,
      `the order records ${rec.total} but only ${due} was collected — the $2.50 credit was discarded`);
    assert.equal(rec.credits, 2.5, 'the order does not say a credit was applied');
    assert.equal(rec.grossTotal, total, 'the order does not record what the cart came to before the credit');
  });
});

/* ── 6. the member's order history opens the REAL order ──────────────────── */

test('history: a member order row opens the record the order book holds', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');

    assert.ok(app.click('Details'), `no Details button on the customer chip — buttons: ${app.buttons().slice(0, 14).join(' | ')}`);
    await app.settle();
    assert.match(app.text(), /Member details/, 'the member panel did not open');

    // Girish Sharma's live order on the board.
    const live = HW.orderById('ORD-00221');
    assert.ok(live && live.name === 'Girish Sharma', 'the seed no longer holds ORD-00221 for Girish Sharma');
    assert.equal(live.stage, 'pack', 'the seeded stage moved — pick another live order for this test');

    assert.ok(app.click((t) => t.includes('ORD-00221')),
      `the member's order history offers no live order to open — it is all synthetic literals: ${app.buttons().filter((b) => /^#?0/.test(b)).join(' | ')}`);
    await app.settle();

    // What OrderDetails got must be the record HW.updateOrder can find — the
    // landmine is a literal like { id: '00219' } that no order book holds, so
    // every save from that modal returns null and fails in silence.
    assert.match(app.text(), /ORD-00221/, 'the details modal is not showing the board id');
    const shown = app.text().match(/ORD-\d{5}/g) || [];
    for (const id of new Set(shown)) {
      assert.ok(HW.orderById(id), `the modal is showing ${id}, which the order book does not hold`);
    }
    // The synthetic literal had no stage; the real record does, which is what
    // turns the edit controls on.
    assert.ok(HW.orderById('ORD-00221').stage, 'the opened order carries no stage');
  });
});
