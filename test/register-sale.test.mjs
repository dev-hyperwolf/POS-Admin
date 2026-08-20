/* ── THE ORDER HALF OF THE REGISTER, DRIVEN FOR REAL ─────────────────────────
 *
 * Four findings, all the same shape: a control that renders, accepts a click,
 * congratulates the operator, and changes nothing.
 *
 *   1. a completed sale created no order — the receipt named an id that had
 *      never been written, so the sale was in no queue
 *   2. the manager-approved discount lived in DiscountCard's own state
 *   3. the reward redemption lived in RewardsCard's own state
 *   4. the promo row had no value, no onChange and no onClick at all
 *
 * Every test here fails on the code as it stood. Read `ui-harness.mjs` before
 * changing any of them — in particular the CROSS-REALM trap: values reached
 * through `app.window` are jsdom-realm objects, so these compare primitives
 * (`.length`, a string, a number) and never deepEqual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** The Total line in the cart footer, as a number.
 *  NOTE the regexes here are gap-free: `app.text()` collapses whitespace and
 *  adjacent spans have none between them — the footer reads "Items2Total$39.43". */
function totalShown(app) {
  const m = app.text().match(/Items\s*(\d+)\s*Total\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[2].replace(/,/g, '')) : null;
}
/** The Sub-total line in the cart footer, as a number. */
function subShown(app) {
  const m = app.text().match(/Sub-total\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
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
/** Walk the payment modal from TENDER to a written order. `total` is the
 *  amount the footer is showing, which is what the drawer wants tendered. */
async function tenderCash(app, total) {
  assert.ok(app.click('TENDER'), 'no TENDER button');
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Cash')), `no Cash tile — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  const quick = '$' + Math.ceil(total).toFixed(2);
  assert.ok(app.click(quick), `no quick-cash ${quick} — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(clickStarts(app, 'Complete'), `no Complete button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(clickStarts(app, 'Done · new sale'), `no "Done · new sale" — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
}

/** Walk the approval modal to a signed-off discount. */
async function approve(app) {
  const IN = '[data-tour="disc-approval"]';
  assert.ok(clickStarts(app, 'Manisha Saini', IN) || app.click((t, el) => t.includes('Manisha Saini') && !!el.closest(IN)),
    'no manager chip inside the approval modal');
  await app.settle();
  assert.ok(app.type('••••', '1234'), 'no manager PIN field');
  await app.settle();
  assert.ok(clickStarts(app, 'Price match', IN), 'no reason chip inside the approval modal');
  await app.settle();
  assert.ok(clickStarts(app, 'Approve', IN), 'no Approve button');
  await app.settle();
}

/* ── 1. a completed sale must create an order ────────────────────────────── */

test('tender: a completed sale writes a real order to the queue', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');

    const before = HW.ORDERS.length;
    const total = totalShown(app);
    assert.ok(total > 0, 'the seeded ticket should have a total to tender');

    await tenderCash(app, total);

    assert.equal(HW.ORDERS.length, before + 1, 'the sale created no order — it appears in no queue');
    const rec = HW.ORDERS[0];
    assert.equal(rec.name, 'Girish Sharma', 'the order was not filed against the person who bought it');
    assert.equal(rec.items, 2, 'the order did not record the real item count');
    assert.equal(rec.total, total, 'the order total is not the total the customer was charged');
    assert.equal(rec.pay, 'Cash', 'the order did not record the tender used');
    assert.equal(rec.stage, 'verify', 'a new sale should enter the queue at verify');
    // The id and the number on the board have to be the same order.
    assert.equal(rec.id, 'ORD-' + rec.num, `id ${rec.id} and number ${rec.num} disagree`);
    assert.equal(HW.ORDERS.filter((o) => o.id === rec.id).length, 1, 'the sale reused an id already on the board');
    // The toast names the order that now exists, rather than an invented id.
    assert.match(app.text(), new RegExp(`Sale complete · ${rec.id}`), 'the confirmation does not name the order it wrote');
  });
});

/* ── 2. a manager-approved discount must reach the cart ──────────────────── */

test('discount: manager approval moves the total, and the sale records it', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');

    const sub0 = subShown(app);
    const total0 = totalShown(app);
    assert.equal(discountShown(app), null, 'the footer showed a discount before one was applied');

    assert.ok(app.type('Discount', '5'), 'no discount amount field');
    await app.settle();
    assert.ok(clickStarts(app, 'Apply', '[data-tour="disc-card"]'), 'no Apply next to the discount field');
    await app.settle();
    assert.match(app.text(), /Manager approval required/, 'Apply did not raise the approval modal');

    await approve(app);

    assert.equal(discountShown(app), 5, 'the approved discount never reached the cart');
    assert.equal(subShown(app), sub0, 'the merchandise sub-total should not move — the discount is a separate line');
    const total1 = totalShown(app);
    assert.ok(total1 < total0, `the total did not move: ${total0} → ${total1}`);
    // $5 off the merchandise, and the tax that $5 would have carried.
    const expected = Math.round((sub0 - 5) * 100) / 100;
    const withTax = Math.round((expected + HW.taxBreakdown(expected).total) * 100) / 100;
    assert.equal(total1, withTax, 'the discount was not taken off the subtotal BEFORE tax');

    assert.match(app.text(), /signed off by Manisha Saini/, 'the approval was not attributed');
  });
});

test('discount: the approved amount is on the order the tender writes', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');

    assert.ok(app.type('Discount', '5'));
    await app.settle();
    assert.ok(clickStarts(app, 'Apply', '[data-tour="disc-card"]'));
    await app.settle();
    await approve(app);
    const total = totalShown(app);

    await tenderCash(app, total);

    const rec = HW.ORDERS[0];
    assert.equal(rec.total, total, 'the order was written at the undiscounted total');
    assert.equal(rec.discount, 5, 'the discount is invisible in what the sale recorded');
    assert.equal((rec.discounts || []).map((d) => `${d.kind}:${d.off}:${d.mgr}`).join(','), 'manual:5:Manisha Saini',
      'the order does not say who signed the discount off');
  });
});

/* ── 3. a redeemed reward must apply ─────────────────────────────────────── */

test('rewards: redeeming a reward takes its value off the cart', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const sub0 = subShown(app);
    const total0 = totalShown(app);

    // The seeded ticket is Girish Sharma; the $2.50 coin is the 100-pt rung.
    assert.ok(app.click((t, el) => t.startsWith('$2.50') && !!el.closest('[data-tour="rewards-card"]')),
      `no $2.50 reward coin — cart said: ${app.text().slice(0, 200)}`);
    await app.settle();

    assert.equal(discountShown(app), 2.5, 'the reward printed as applied but took nothing off');
    const total1 = totalShown(app);
    const expected = Math.round((sub0 - 2.5) * 100) / 100;
    assert.equal(total1, Math.round((expected + HW.taxBreakdown(expected).total) * 100) / 100,
      'the reward did not come off the subtotal before tax');
    assert.match(app.text(), /\$2\.50 off applied/, 'the reward card stopped reporting the redemption');

    // Clicking the same coin again releases it.
    assert.ok(app.click((t, el) => t.startsWith('$2.50') && !!el.closest('[data-tour="rewards-card"]')));
    await app.settle();
    assert.equal(discountShown(app), null, 'un-redeeming left the discount on the cart');
    assert.equal(totalShown(app), total0, 'the total did not come back');
  });
});

/* ── 4. the promo row ────────────────────────────────────────────────────── */

test('promo: a real code applies, and an unknown one says so', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const sub0 = subShown(app);

    assert.ok(app.click('Add promo code'), 'no "Add promo code" affordance');
    await app.settle();

    // Empty: the Apply refuses, and SAYS what is missing.
    assert.match(app.text(), /Enter a promo code, then Apply/, 'the empty promo row refuses in silence');

    assert.ok(app.type('Promo code', 'NOPENOPE'), 'the promo Field takes no input');
    await app.settle();
    assert.ok(app.click((t, el) => t === 'Apply' && !!el.closest('[data-tour="disc-card"]'), { nth: 1 }),
      'no Apply next to the promo field');
    await app.settle();
    assert.match(app.text(), /NOPENOPE is not a code this store honours/, 'an unknown code was swallowed');
    assert.equal(discountShown(app), null, 'an unknown code discounted the cart anyway');

    assert.ok(app.type('Promo code', 'GREEN5'));
    await app.settle();
    assert.ok(app.click((t, el) => t === 'Apply' && !!el.closest('[data-tour="disc-card"]'), { nth: 1 }));
    await app.settle();
    assert.equal(discountShown(app), 5, 'GREEN5 did nothing — the promo row is inert');
    assert.equal(subShown(app), sub0, 'the promo changed the merchandise subtotal instead of discounting it');
    assert.match(app.text(), /Green Wednesday/, 'the applied promo is not named on the cart');
  });
});

/* ── the two silent refusals ─────────────────────────────────────────────── */

test('refusal: Apply with an empty amount says what is missing', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    assert.match(app.text(), /Enter an amount, then Apply/, 'the empty discount field refuses in silence');

    // And it really is refusing: clicking Apply raises no approval modal.
    assert.ok(clickStarts(app, 'Apply', '[data-tour="disc-card"]'), 'no Apply button to click');
    await app.settle();
    assert.doesNotMatch(app.text(), /Manager approval required/, 'an empty amount reached the approval modal');

    // A discount larger than the cart is refused by name, not by shrugging.
    assert.ok(app.type('Discount', '9999'));
    await app.settle();
    assert.match(app.text(), /That is \$9,999\.00 off a \$[\d,.]+ subtotal/, 'an over-large discount refuses in silence');
    assert.ok(clickStarts(app, 'Apply', '[data-tour="disc-card"]'));
    await app.settle();
    assert.doesNotMatch(app.text(), /Manager approval required/, 'an over-large discount reached the approval modal');
  });
});

test('refusal: Approve with no manager, PIN or reason says what is missing', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    assert.ok(app.type('Discount', '5'));
    await app.settle();
    assert.ok(clickStarts(app, 'Apply', '[data-tour="disc-card"]'));
    await app.settle();
    assert.match(app.text(), /Manager approval required/, 'the approval modal did not open');

    // Nothing filled in: the button names all three missing pieces.
    const t = app.text();
    assert.match(t, /choose the approving manager/, 'it does not say the manager is missing');
    assert.match(t, /enter the manager PIN/, 'it does not say the PIN is missing');
    assert.match(t, /pick a reason/, 'it does not say the reason is missing');

    assert.ok(clickStarts(app, 'Approve', '[data-tour="disc-approval"]'), 'no Approve button');
    await app.settle();
    assert.match(app.text(), /Manager approval required/, 'Approve closed the modal on an empty form');
    assert.equal(discountShown(app), null, 'an unsigned discount reached the cart');

    // Fill in only the manager: the sentence shrinks to what is still missing.
    assert.ok(app.click((t2, el) => t2.includes('Carla Mendes') && !!el.closest('[data-tour="disc-approval"]')));
    await app.settle();
    assert.doesNotMatch(app.text(), /choose the approving manager/, 'it still asks for a manager that was chosen');
    assert.match(app.text(), /enter the manager PIN/, 'it stopped asking for the PIN');
    assert.equal(HW.ORDERS.filter((o) => o.discount).length, 0, 'a half-filled approval wrote something');
  });
});
