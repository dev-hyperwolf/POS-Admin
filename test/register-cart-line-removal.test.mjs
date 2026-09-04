/* ══ CART LINE: A STEP TO ZERO REMOVES, BUT LEAVES AN UNDOABLE TRACE ═══════
 *
 * pos/screen-register.jsx's setQty used to delete a cart line the instant its
 * Stepper reached zero — no confirmation, no way back, indistinguishable from
 * any other qty change. The minus button is the easiest control on the whole
 * cart to overshoot, and it is exactly the control an operator uses to walk a
 * swap/upsell suggestion (added from CartPairs/GuestReco/AovBooster in
 * pos/screen-cart.jsx, then adjusted like any other cart line) back down after
 * adding one too many. A slip took the whole line with it, silently, and the
 * row it had occupied closed up with nothing left to say a product had ever
 * been there.
 *
 * The fix keeps the delete — `count` and `merch` in pos/screen-register.jsx
 * both sum `qty`, so a line stepped to zero was already worth nothing to the
 * total either way — but leaves a brief "Removed — Undo" banner in the slot
 * the line held, naming what was taken off and putting it straight back in
 * one click (`data-hw-removed-line` in pos/screen-cart.jsx). It renders even
 * when the removed line was the LAST one on the ticket, so zeroing the only
 * item does not erase the one place Undo could still be reached from — see
 * the third test.
 *
 * The trash icon on each line is a separate, deliberate delete control and is
 * DELIBERATELY UNCHANGED (see setQty's own comment in pos/screen-register.jsx
 * for why): the second test proves it still removes with no banner, so a
 * regression that routed it through the same Undo path would show here too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** The Stepper's −/+ and the line's trash are icon-only buttons; aria-label
 *  is the only handle on them (same convention as register-tender-integrity
 *  and order-flows). */
function clickIcon(app, label, { nth = 0 } = {}) {
  return app.click((t, el) => el.getAttribute('aria-label') === label, { nth });
}

/** The removal banner, scoped by its own marker rather than whole-page text —
 *  the product's name is ALSO on its catalogue tile in the grid on the left,
 *  so asserting on `app.text()` alone would pass whether or not the banner
 *  itself ever rendered. */
const removedBanner = (app) => app.window.document.querySelector('[data-hw-removed-line]');
const decreaseCount = (app) => app.window.document.querySelectorAll('button[aria-label="Decrease"]').length;

test('cart: stepping a line to zero removes it but leaves a Removed/Undo banner, and Undo restores it', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const name0 = app.window.HW.PRODUCTS[0].name;

    assert.match(app.text(), /Items\s*2/, `the seeded ticket should start at 2 items: ${app.text().slice(0, 200)}`);
    assert.equal(decreaseCount(app), 2, 'the seeded ticket should start with two cart lines, each with its own stepper');
    assert.equal(removedBanner(app), null, 'no removal banner before anything has been removed');

    assert.ok(clickIcon(app, 'Decrease'), `no quantity stepper on a cart line — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    // The line is gone from the cart — the old, silent behaviour — but it did
    // not just vanish: exactly one stepper remains, and a banner stands where
    // the second one used to be.
    assert.equal(decreaseCount(app), 1, 'the zeroed line should be gone from the cart lines list');
    assert.match(app.text(), /Items\s*1/, 'the removed line should stop counting toward Items');
    const banner = removedBanner(app);
    assert.ok(banner, 'stepping a line to zero must leave a Removed/Undo banner, not delete silently');
    assert.ok(banner.textContent.includes(name0), `the banner should name what was taken off — saw "${banner.textContent}"`);
    assert.ok(banner.textContent.includes('Undo'), `the banner should offer Undo — saw "${banner.textContent}"`);

    assert.ok(app.click('Undo'), 'Undo did not fire');
    await app.settle();

    assert.equal(removedBanner(app), null, 'the banner should be gone once Undo has run');
    assert.equal(decreaseCount(app), 2, 'Undo should put the line — and its own stepper — back');
    assert.match(app.text(), /Items\s*2/, 'Undo should restore the original item count');
  });
});

test('cart: the trash icon still deletes a line immediately, with no Undo banner', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    assert.match(app.text(), /Items\s*2/, 'the seeded ticket should start at 2 items');

    assert.ok(clickIcon(app, 'trash'), `no trash control on a cart line — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.match(app.text(), /Items\s*1/, 'the trash icon should still remove the line immediately');
    assert.equal(removedBanner(app), null, 'the trash icon is a deliberate, explicit delete — it must not show an Undo banner');
    assert.ok(!app.buttons().includes('Undo'), 'no Undo control should appear after a trash delete');
  });
});

test('cart: zeroing the LAST line still shows the Removed/Undo banner, not just "Cart is empty"', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const name0 = app.window.HW.PRODUCTS[0].name;

    // Drop the second seeded line with the (unchanged) trash icon first, so
    // exactly one line — the one the stepper will zero out below — is left.
    assert.ok(clickIcon(app, 'trash', { nth: 1 }), 'no trash control on the second cart line');
    await app.settle();
    assert.match(app.text(), /Items\s*1/, 'expected exactly one line left before the stepper test');

    assert.ok(clickIcon(app, 'Decrease'), 'no quantity stepper on the remaining line');
    await app.settle();

    // Both are true at once: the ticket has nothing left ON IT, and the one
    // thing that was just taken OFF it is still named on screen with a way
    // back. Losing either half was the bug — a banner with no empty-state
    // notice would be as dishonest as an empty-state notice with no banner.
    assert.match(app.text(), /Cart is empty/, 'the cart should read empty once its only line is at zero');
    const banner = removedBanner(app);
    assert.ok(banner, 'zeroing the only line must still leave a Removed/Undo banner');
    assert.ok(banner.textContent.includes(name0), `the banner should still name the product that was removed — saw "${banner.textContent}"`);

    assert.ok(app.click('Undo'), 'Undo did not fire from the empty-cart state');
    await app.settle();

    assert.match(app.text(), /Items\s*1/, 'Undo should restore the only line');
    assert.ok(!app.text().includes('Cart is empty'), 'the cart should no longer read empty after Undo');
    assert.equal(removedBanner(app), null, 'the banner should clear once Undo has run');
  });
});
