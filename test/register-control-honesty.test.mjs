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

test('two controls both reading "Clear" are on the register at once', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    // This is the PREMISE of the next test, asserted rather than assumed. If a
    // later change removes or renames one of them this goes red and says so,
    // instead of the honesty test passing vacuously over one button.
    const clears = labelled(app, 'Clear');
    assert.equal(clears.length, 2,
      `expected the chip's Clear and the cart's Clear on a seeded register, saw ${clears.length}: `
      + `${clears.map((c) => c.getAttribute('title') || '(no title)').join(' | ')}`);
  });
});

test('neither "Clear" is silent about which one it is', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const titles = labelled(app, 'Clear').map((el) => (el.getAttribute('title') || '').trim());

    for (const [i, t] of titles.entries()) {
      assert.ok(t.length > 0,
        `the "Clear" at index ${i} states no consequence at all — it is pixel-identical to the other one`);
    }
    assert.notEqual(titles[0], titles[1],
      'both "Clear" buttons say the same thing, so they are still indistinguishable');

    // And they must say the RIGHT thing, not merely different things. One ends
    // the visit; one empties a ticket and leaves the customer checked in.
    const endsVisit = titles.filter((t) => /end this visit/i.test(t));
    const emptiesTicket = titles.filter((t) => /empt(y|ies) this ticket/i.test(t));
    assert.equal(endsVisit.length, 1,
      `exactly one Clear should name ending the visit; saw ${endsVisit.length} of: ${JSON.stringify(titles)}`);
    assert.equal(emptiesTicket.length, 1,
      `exactly one Clear should name emptying the ticket; saw ${emptiesTicket.length} of: ${JSON.stringify(titles)}`);
    // The cheap one has to promise the expensive thing does NOT happen.
    assert.match(emptiesTicket[0], /stays checked in/i,
      'the cart Clear does not say the customer survives it, which is the whole difference');
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
