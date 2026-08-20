/* ONE TAX AUTHORITY ACROSS SURFACES.
 *
 * The storefront quoted the engine's built-in flat rate while every other
 * screen in the estate itemises HW.taxBreakdown (local + excise + sales). A
 * reviewer measured the gap: the customer was quoted one figure and the order
 * re-priced about 10% higher the moment it was opened in the POS.
 *
 * The owner ruled on this directly — "give the engine our tax function" — and
 * "the total needs to fully update when an adjustment is made - no exceptions.
 * This needs to be bulletproof."
 *
 * Asserted as an INVARIANT against HW.taxBreakdown itself, never against a rate
 * written down here: a pinned 23.22% would go stale the day a rate moves and
 * would then fail against correct code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('the tax the storefront quotes is the estate tax, not the engine default', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, SHOP = W.SHOP, HW = W.HW;
    assert.ok(SHOP, 'the shop store must be loaded');
    assert.equal(typeof HW.taxBreakdown, 'function');

    const p = HW.PRODUCTS.find((x) => x.active);
    assert.ok(p, 'the catalogue must hold an active product');
    SHOP.add(p.sku, 2);

    const t = SHOP.totals();
    assert.ok(t, 'the storefront must be able to price its own cart');

    // What the estate would charge on the very base the engine taxed.
    const expected = Math.round(HW.taxBreakdown(t.taxableBaseCents / 100).total * 100);
    assert.equal(t.taxCents, expected,
      `the storefront quoted ${t.taxCents} where the estate charges ${expected} on the same base`);
  });
});

test('and it is materially different from the engine default — so this test can fail', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, SHOP = W.SHOP, HW = W.HW;
    const p = HW.PRODUCTS.find((x) => x.active);
    SHOP.add(p.sku, 2);
    const t = SHOP.totals();

    // A NEGATIVE CONTROL FOR THE TEST ABOVE. If the estate rate happened to
    // equal the engine's built-in rate, that test would pass whether or not
    // computeTax was ever wired — exactly the kind of always-true assertion
    // that has slipped through here before.
    const engineDefault = Math.round(t.taxableBaseCents * 0.1025);
    assert.notEqual(t.taxCents, engineDefault,
      'the two rates coincide, so the test above proves nothing — pick a different fixture');
  });
});
