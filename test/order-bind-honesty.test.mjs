/* ── WHOSE ORDER IS THIS, AND WHO DECIDED ────────────────────────────────────
 *
 * The Needs-match lane binds an anonymous channel order to a real person. Three
 * separate defects lived in it, all of the same family, and none had a test.
 *
 *   1. A HUMAN BIND WROTE conf: 100 AND signals: ['handle'].
 *      The mono slot in BindStrip is where the MATCHER's computed score lives,
 *      so "the engine scored this at 100" and "a person pointed at someone"
 *      rendered as the same bold green 100 with a check mark — two different
 *      claims, identical pixels, and an audit of a mis-bind could not tell which
 *      had happened. `signals: ['handle']` renders through SIGNAL_LABEL as
 *      "handle already merged", asserting a merge that never took place.
 *      This file already won that argument once, in MatchSheet: "`5` IS NOT A
 *      SCORE" — the lesson was applied to the sheet and not to what the sheet
 *      writes.
 *
 *   2. "Check in & bind" CHECKED NOBODY IN.
 *      It called onBind(null, m.name) and never HW.addCheckIn, so the person was
 *      bound to an order while absent from the floor board — the waiting strip
 *      and the order queue disagreeing about who is in the store, with neither
 *      saying so — and the null checkinId then fell to a two-character `'a'`
 *      literal, printing "guest in a's party" for a customer the row beside it
 *      described as "not in the store".
 *
 *   3. THE SCAN BUTTON DID NOT OPEN A SCANNER.
 *      v1 had two buttons wired to one handler. v2 deleted one and renamed the
 *      survivor "Scan ID & bind", with a scan icon, still calling onMatch(o) —
 *      which opens a search sheet. The label described an intention while the
 *      code did something else, and the correct action (scan, which identifies
 *      AND captures verification in one step) became unreachable from the lane.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** The simulated PDF417 read resolves on a 700ms timer inside IdScanPanel. */
const afterScan = () => new Promise((r) => setTimeout(r, 900));

test('a bind a HUMAN made carries no score and claims no signal', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    assert.match(app.text(), /Needs match/, 'no unowned lane to bind from');

    assert.ok(app.click('Bind'), 'no candidate Bind button in the Needs-match lane');
    await app.settle();

    // Read ONLY the card that was just bound. Other cards on this board carry
    // genuine engine matches whose `handle` signal is real, and asserting over
    // the whole screen would flag those.
    const t = app.text();
    const i = t.indexOf('#ORD-00232');
    assert.ok(i > 0, 'the bound order left the board entirely');
    const card = t.slice(i, i + 260);

    assert.match(card, /by hand/,
      'a human bind must say a person decided it, in the slot where the score would be');
    assert.match(card, /bound by Manisha Saini/,
      'the strip must name who bound it and when — that is what actually happened');
    assert.doesNotMatch(card, /handle already merged/,
      'a manual bind asserted that this customer’s handle had previously been merged onto ' +
      'their record. No merge happened — somebody tapped a button.');
    assert.doesNotMatch(card, /\b100\b/,
      'a hand-bound order must not print the matcher’s 100: "the engine scored this at 100" ' +
      'and "a person pointed at someone" are different claims and had identical pixels');
  });
});

test('a confidence carries what it measures, and the colour follows the rank', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const t = app.text();
    // A bare integer beside a Bind button tells the operator nothing about what
    // was measured or what good looks like. The old colour rule — `>= 50 ?
    // warn : inkMute` — also INVERTED the ranking: 52, the strongest candidate,
    // was painted amber (this screen's problem colour) while the weaker 38 sat
    // calm and grey, and the accent border and accent Bind button on i === 0
    // pointed the other way.
    assert.match(t, /52% match/, 'a confidence must carry what it is a measurement OF');
    assert.doesNotMatch(t, /no order yet52Bind/,
      'a bare integer with no unit and no scale is back in the candidate row');

    assert.ok(app.click('Match to a person'), 'no search affordance in the Needs-match lane');
    await app.settle();
    const sheet = app.text();
    assert.match(sheet, /below the 60% auto-bind floor/,
      'the auto-bind threshold is what gives the number meaning, and it lived only in a ' +
      'source comment at data.jsx:257-260');
    assert.match(sheet, /not scored/,
      'a person nobody has been scored against must say so, never render a number or a bar');
  });
});

test('"Check in & bind" actually checks the person in', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    const n0 = HW.CHECKINS.length;

    assert.ok(app.click('Match to a person'), 'no search affordance in the Needs-match lane');
    await app.settle();
    assert.ok(app.click('All customers'), 'no All customers tab in the match sheet');
    await app.settle();
    assert.ok(app.click('Check in & bind'), 'no Check in & bind button');
    await app.settle();

    assert.equal(HW.CHECKINS.length, n0 + 1,
      'the button says "Check in" and created no check-in — the floor board and the order ' +
      'queue now disagree about who is in the store, and neither says so');
    assert.doesNotMatch(app.text(), /guest in a’s party/,
      "a missing check-in must reach the render as its own branch, not as the filler 'a'");
  });
});

test('the lane\'s scan button opens the SCANNER, not a search box', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    assert.ok(app.click('Scan ID & check in'), 'the scan affordance is missing from the lane');
    await app.settle();

    const t = app.text();
    assert.match(t, /Scan the guest’s ID or passport/,
      'a control with a scan icon and a scan label must open a scanner — v2 opened a Seg ' +
      'and a search field, with the guest standing there holding the document');
    assert.ok(app.buttons().includes('Scan ID'), 'no way to actually scan');
  });
});

test('scanning from the lane binds the order to the check-in it creates', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const HW = app.window.HW;
    const n0 = HW.CHECKINS.length;

    assert.ok(app.click('Scan ID & check in'), 'the scan affordance is missing');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'no scanner');
    await afterScan();
    await app.settle();

    // A first-timer read opens the pre-filled form; the document is already
    // attached, so the record can be created without typing anything.
    if (app.buttons().includes('Create customer')) {
      assert.ok(app.click('Create customer'), 'Create customer was refused after a scan');
      await app.settle();
    }
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    assert.equal(HW.CHECKINS.length, n0 + 1, 'the check-in was not created');
    assert.match(app.text(), /by hand/,
      'the order should now be bound, by a person, to the check-in the scan produced');
  });
});

/* ── A PAST-TENSE COMPLIANCE CLAIM NEEDS A BRANCH ────────────────────────────
 * The triage strip's third chip branched on assurance for DELIVERY and was a
 * CONSTANT for pickup: 'ID checked at the counter', rendered for every Weedmaps
 * pickup order including one where `idv` is null because wm.match === 'new' —
 * a person nobody has ever seen. The card then contradicted itself in the same
 * viewport, because `remoteUp = idvA.tier === 0` is true for exactly that order
 * and RemoteIdPanel rendered underneath saying nobody has ever held their ID.
 * The value to branch on was already computed one line above. */
test('the pickup ID chip does not assert a check that never happened', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const card = [...app.document.querySelectorAll('div')]
      .find((d) => d.getAttribute('title') === 'Open the order' && /#ORD-00237/.test(d.textContent || ''));
    assert.ok(card, 'no unmatched Weedmaps pickup order on the board');
    card.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    const t = app.text();
    assert.doesNotMatch(t, /ID checked at the counter/,
      'a past-tense compliance claim was rendered for a customer with no document on file');
    assert.match(t, /ID not yet checked/,
      'the chip must say the check has not happened — the fastest-read element on the card ' +
      'was the false one, and the panel below it said the opposite');
    assert.deepEqual(app.errors, [], 'the order card must not throw');
  });
});
