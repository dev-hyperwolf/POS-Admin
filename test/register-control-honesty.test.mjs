/* ── CONTROLS THAT LIE OR DUPLICATE, DRIVEN FOR REAL ─────────────────────────
 *
 * Three findings of one family were already fixed by hand (the "New customer /
 * Returning" toggle beside the scanner, the search-first check-in modal, the
 * bind card's two buttons on one handler). Nothing stopped them coming back,
 * and nothing was watching the rest of the register. This file watches two
 * that are still live in the money path.
 *
 *   A. TWO BUTTONS READING "Clear" ON SCREEN AT THE SAME TIME.
 *      CustomerChip's (pos/screen-register.jsx) runs `openVisit(null, [])` and
 *      throws away EVERY ticket in the party. The cart pane's
 *      (pos/screen-cart.jsx) empties the ticket in front of you. Same word,
 *      same x icon, same 11.5px inkDim, both rendered for any sale with a
 *      customer and a line in the cart. A cashier cannot tell them apart from
 *      anything on the screen, and one of them costs a party of sales.
 *
 *   B. THE TENDER BUTTON GOING GREY WITH NOTHING TO READ.
 *      `canPrimary` in pos/payment.jsx encodes three separate refusals. Split
 *      is the vicious one: type the FULL balance into the split pad and
 *      `cashNum < balance` fails, so the button dies with the number that
 *      killed it sitting on screen looking perfectly correct. The way out —
 *      cancel and pick Cash — is not guessable from anything displayed.
 *
 * MUTATION-TESTED 2026-08-27. Each assertion here was watched go RED against
 * the pre-fix source and GREEN after; the log is in the report that shipped
 * with them. NOTE FOR WHOEVER EDITS THESE: `app.text()` collapses whitespace,
 * and adjacent spans have none between them, so keep the regexes gap-tolerant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Every element on screen whose visible label is exactly `label`. */
function labelled(app, label) {
  return [...app.window.document.querySelectorAll('button,a,[data-hw-i]')]
    .filter((el) => (el.textContent || '').trim() === label);
}

/* ── A. the two "Clear" buttons ──────────────────────────────────────────── */

// UPDATED, NOT DELETED. These two tests were written to DOCUMENT the defect --
// two controls both reading "Clear", distinguished only by a `title` a touch
// terminal can never raise. The defect is fixed: the visit-ender now reads
// "End visit" in the destructive tone with its own icon, and the cart control
// reads "Clear cart". They now assert the FIX, because a test that still
// demands the broken shape would block the repair it was written to provoke.
test('the two controls are distinguishable by LABEL, not by a tooltip', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    // THE OLD ASSERTION WAS `labelled(app,'Clear').length === 2`, which is what
    // the defect looked like. Now exactly ONE control may read a bare "Clear",
    // and it must be the cart one, named for its object.
    const bare = labelled(app, 'Clear').filter(
      (el) => (el.textContent || '').trim() === 'Clear');
    assert.equal(bare.length, 0,
      `no control may read a bare "Clear" any more; saw ${bare.length}: `
      + bare.map((c) => c.getAttribute('title') || '(no title)').join(' | '));

    const endVisit = labelled(app, 'End visit');
    const clearCart = labelled(app, 'Clear cart');
    assert.ok(endVisit.length >= 1,
      'the visit-ending control must say "End visit" ON SCREEN, not in a title');
    assert.ok(clearCart.length >= 1,
      'the cart control must say "Clear cart" ON SCREEN, not in a title');
  });
});

test('the destructive control names the visit, the cart control names the cart', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    // The distinction must survive with the TOOLTIPS REMOVED, because a touch
    // terminal never raises one. Read the visible text only.
    const endText = labelled(app, 'End visit').map((e) => (e.textContent || '').trim());
    const cartText = labelled(app, 'Clear cart').map((e) => (e.textContent || '').trim());
    assert.ok(endText.some((t) => /end visit/i.test(t)),
      `the visit-ender does not name the visit in its visible label: ${JSON.stringify(endText)}`);
    assert.ok(cartText.some((t) => /clear cart/i.test(t)),
      `the cart control does not name the cart in its visible label: ${JSON.stringify(cartText)}`);
    assert.notDeepEqual(endText, cartText,
      'the two controls still read identically, which is the defect this file exists for');

    // The titles must STILL be right -- a pointer user should get the detail,
    // and the cart one must still promise the expensive thing does not happen.
    const cartTitle = (labelled(app, 'Clear cart')[0].getAttribute('title') || '');
    assert.ok(/checked in|stays/i.test(cartTitle),
      `the cart control must still say the customer survives it: ${JSON.stringify(cartTitle)}`);
  });
});

/* ── B. the tender button's silent refusals ──────────────────────────────── */

/** Open the payment modal on a given tender tile. */
async function openTender(app, tile) {
  assert.ok(app.click('TENDER'), `no TENDER button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith(tile)), `no ${tile} tile — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
}

/** Press a key on the tender pad.
 *  ⚠️ NOT `app.click('1')`. Three buttons on the register have the exact text
 *  "1" and the pad's is the LAST of them, so a bare click by label pressed
 *  something else entirely, the cash stayed $0.00, and the assertion that
 *  followed failed for a reason that had nothing to do with the code under
 *  test. Scope to the pad by the one key nothing else on the screen is: `.`. */
function padPress(app, key) {
  const dot = [...app.window.document.querySelectorAll('button')]
    .find((b) => (b.textContent || '').trim() === '.');
  assert.ok(dot, 'no tender pad on screen');
  const hit = [...dot.parentElement.querySelectorAll('button')]
    .find((b) => (b.textContent || '').trim() === key);
  assert.ok(hit, `no ${key} key on the pad`);
  hit.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** The drawer's primary button element (Complete… / Charge card…). */
function primary(app) {
  return [...app.window.document.querySelectorAll('button')]
    .find((b) => /^(Complete|Charge card)\s*·/.test((b.textContent || '').trim()));
}

test('split tender: a disabled Charge card says WHY, on the screen', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    await openTender(app, 'Split');

    // Nothing typed yet. The button is dead and the operator has to be told
    // that the CASH half is what it is waiting for.
    let b = primary(app);
    assert.ok(b, `no primary tender button — buttons: ${app.buttons().join(' | ')}`);
    assert.ok(b.disabled, 'the split primary should refuse with no cash portion entered');
    assert.match(app.text(), /Enter the cash portion first/i,
      'the split drawer refuses an empty cash portion in total silence');

    // Now the dead end that strands people: cash big enough to cover the whole
    // balance, which is not a split at all. The button dies and the number
    // responsible looks fine.
    for (const k of ['9', '9', '9', '9']) padPress(app, k);
    await app.settle();
    b = primary(app);
    assert.ok(b.disabled, 'cash over the balance is not a split and the button must refuse');
    assert.match(app.text(), /covers the whole|nothing is left for the card/i,
      'the split drawer went dead with the full balance typed in and explained nothing');
    assert.match(app.text(), /choose Cash instead/i,
      'the refusal does not name the way out, which is the only thing the operator needs');
  });
});

test('cash tender: a short tender names the shortfall, not just a grey button', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    await openTender(app, 'Cash');

    const b0 = primary(app);
    assert.ok(b0 && b0.disabled, 'the cash primary should refuse before anything is tendered');
    assert.match(app.text(), /Enter the cash the customer handed over/i,
      'the cash drawer refuses an empty tender in silence');

    padPress(app, '1');
    await app.settle();
    const b1 = primary(app);
    assert.ok(b1.disabled, '$1 cannot clear the seeded balance');
    assert.match(app.text(), /still short/i,
      'a short cash tender does not say it is short');
  });
});

test('the tender button has ONE card label, not two identical ones', async () => {
  // pos/payment.jsx wrote `split ? 'Charge card · X' : 'Charge card · X'` —
  // two arms of a ternary that produced byte-identical text. A distinction
  // asserted in the source that never existed on screen is the same defect as
  // two buttons on one handler, and it is how a real difference gets added to
  // one arm and silently lost.
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');

    await openTender(app, 'Card');
    const cardLabel = (primary(app).textContent || '').trim();
    assert.match(cardLabel, /^Charge card · \$/, `card tender labelled "${cardLabel}"`);

    assert.ok(app.click('Cancel'), 'no Cancel in the card drawer');
    await app.settle();
    await app.settle();
    assert.ok(app.click((t) => t.startsWith('Split')), `no Split tile — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    for (const k of ['1', '0']) padPress(app, k);
    await app.settle();

    const splitLabel = (primary(app).textContent || '').trim();
    assert.match(splitLabel, /^Charge card · \$/, `split tender labelled "${splitLabel}"`);
    // The card amounts differ (split's card leg is the balance less the cash),
    // so the two labels must NOT be identical strings. If they are, the label
    // is not naming the split's card leg and the ternary was hiding it.
    assert.notEqual(splitLabel, cardLabel,
      'the split drawer names the same figure as a full card sale — it is not naming the card leg of the split');
  });
});
