/* pos/screen-orders.jsx — the Order Queue's check-in card.
 *
 * THE SAME THREE DEFECTS THE REGISTER STRIP HAD, ON A SECOND SCREEN. The
 * register's card was fixed and this one was left carrying every one of them,
 * which is the whole reason this file exists: a fix applied to one of two
 * copies is not applied to the behaviour.
 *
 *   1. THE FOOTER READ "Claim & start sale" / "Claimed by X" AND RECORDED
 *      NOTHING. It called onStartSale and nothing else, so `claimedBy` was a
 *      state this card could paint and no click on it could produce. On the
 *      live board that is worse than inert: publishToHW replaces the CONTENTS
 *      of HW.CHECKINS on every read, so a claim held in component state
 *      survives until the next poll and then vanishes under the associate.
 *   2. THERE WAS NO UNCLAIM ANYWHERE ON THIS SCREEN. A person claimed by
 *      mistake stayed claimed.
 *   3. THE WAIT PRINTED `c.wait` RAW — the seam's '0h 2m 11s' shape, which for
 *      the four check-ins left in state `waiting` since 2026-08-19 rendered on
 *      the live board as '188h 12m 33s'.
 *
 * WATCHED TO FAIL. Every check below was run against the pre-fix card: the two
 * claim tests found no Unclaim control and saw `claimedBy` unchanged after the
 * press, and the format tests read '188h 12m 33s' off the card.
 *
 * WHAT THIS CANNOT SEE: jsdom answers "does this WORK", never "does this LOOK
 * right". Nothing here checks that the split claimed footer lays out, that the
 * stale row is visibly dimmer, or that either button is reachable at the card's
 * real width.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** OrdersScreen takes `onStartSale` as a prop and `mount` passes none, so the
 *  probe supplies one and records every call. Built with the PAGE's React —
 *  an element from another copy would not render into the page's root. */
async function mountOrders(app) {
  app.window.__sales = [];
  app.window.OrdersProbe = function OrdersProbe() {
    return app.window.React.createElement(app.window.OrdersScreen, {
      onStartSale: (...a) => { app.window.__sales.push(a.length ? a[0] : true); },
    });
  };
  await app.mount('OrdersProbe');
  await app.settle();
}

/** The check-in card for this person: every card carries exactly one
 *  "Remove <first> from the waiting list" control, and the card root is its
 *  grandparent (card > header > IconBtn). */
function cardFor(app, first) {
  const btn = [...app.document.querySelectorAll('button')]
    .find((b) => (b.getAttribute('aria-label') || '')
      === `Remove ${first} from the waiting list`);
  assert.ok(btn, `no check-in card on the Order Queue for ${first}`);
  return btn.parentElement.parentElement;
}

const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ');

const btnIn = (card, re) => [...card.querySelectorAll('button')]
  .find((b) => re.test((b.textContent || '').replace(/\s+/g, ' ')));

/** Press, then wait for the card to actually repaint. The claim goes through a
 *  promise (both builds return one), so the state change lands a microtask
 *  later and a single settle() is not reliably enough under a loaded box. */
async function press(app, btn, first, expect) {
  btn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  for (let i = 0; i < 60; i++) {
    await app.settle();
    if (expect.test(textOf(cardFor(app, first)))) return;
  }
  assert.fail('the card never repainted to match ' + expect
    + ' — it still reads: ' + textOf(cardFor(app, first)));
}

const rowOf = (app, id) => app.window.HW.CHECKINS.find((c) => c.id === id);

test('pressing Claim on the Order Queue RECORDS the claim — it is not just a label', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    // c2 (Manisha Saini) ships unclaimed in pos/data.jsx.
    assert.equal(rowOf(app, 'c2').claimedBy, null, 'c2 did not start unclaimed');
    const card = cardFor(app, 'Manisha');
    const claim = btnIn(card, /Claim & start sale/);
    assert.ok(claim, 'the unclaimed card offers no claim control');
    await press(app, claim, 'Manisha', /Unclaim/);
    assert.equal(rowOf(app, 'c2').claimedBy, 'Manisha Saini',
      'the press changed the label and recorded nothing');
    assert.match(textOf(cardFor(app, 'Manisha')), /Claimed\s*You/,
      'the card does not say who holds the claim');
  });
});

test('the claim is what opens the sale — a refused claim starts nothing', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    // Go through the HANDLE, not around it: this is the seam's override point,
    // and a card that started the sale without it would look identical here.
    app.window.HW.claimCheckin = () => Promise.resolve(
      { ok: false, why: 'somebody else took this customer' });
    const claim = btnIn(cardFor(app, 'Manisha'), /Claim & start sale/);
    claim.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 40; i++) {
      await app.settle();
      if (/somebody else took this customer/.test(textOf(cardFor(app, 'Manisha')))) break;
    }
    assert.match(textOf(cardFor(app, 'Manisha')), /somebody else took this customer/,
      'the refusal was dropped on the floor and the button just looks broken');
    assert.equal(app.window.__sales.length, 0,
      'the sale opened on a customer the server refused to give us');
    assert.equal(rowOf(app, 'c2').claimedBy, null);
  });
});

test('a claim that is accepted DOES open the sale', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    await press(app, btnIn(cardFor(app, 'Manisha'), /Claim & start sale/), 'Manisha', /Unclaim/);
    assert.equal(app.window.__sales.length, 1,
      'the claim landed but the sale never opened');
  });
});

test('one press releases — Unclaim clears the claim and the footer goes back', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    // c1 (Harshil Gupta) ships CLAIMED by Manisha Saini.
    assert.equal(rowOf(app, 'c1').claimedBy, 'Manisha Saini', 'c1 did not start claimed');
    const card = cardFor(app, 'Harshil');
    const un = btnIn(card, /Unclaim/);
    assert.ok(un, 'the claimed card offers no Unclaim — the mistake is unrecoverable');
    await press(app, un, 'Harshil', /Claim & start sale/);
    assert.equal(rowOf(app, 'c1').claimedBy, null, 'the release recorded nothing');
  });
});

test('the claimed card still opens the sale, and opening it claims nobody', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    const start = btnIn(cardFor(app, 'Harshil'), /Start sale/);
    assert.ok(start, 'a claimed card has no way to open the sale at all');
    start.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    assert.equal(app.window.__sales.length, 1, 'Start sale did not open the sale');
    assert.equal(rowOf(app, 'c1').claimedBy, 'Manisha Saini',
      'opening the sale rewrote the claim');
  });
});

test('a wait of days renders as days, never as the raw 188-hour string', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    // The shape the live board actually produced: waitLabel() emits
    // '188h 12m 33s' for a check-in left in `waiting` since 2026-08-19.
    const c = rowOf(app, 'c2');
    c.waitSec = 677553;
    c.wait = '188h 12m 33s';
    await app.window.HW.unclaimCheckin('c2');   // notify -> repaint, changes nothing
    for (let i = 0; i < 60; i++) {
      await app.settle();
      if (/7d 20h/.test(textOf(cardFor(app, 'Manisha')))) break;
    }
    const txt = textOf(cardFor(app, 'Manisha'));
    assert.match(txt, /7d 20h/, 'a 7-day wait is not shown in days: ' + txt);
    assert.ok(!/188h/.test(txt), 'the raw seam string is still on the card: ' + txt);
    assert.ok(!/\d{4,}m/.test(txt), 'a five-figure minute count is on the card: ' + txt);
    // The measurement itself is untouched — it is the evidence the row was
    // abandoned, and a card that quietly resets it hides the abandonment.
    assert.equal(rowOf(app, 'c2').waitSec, 677553);
  });
});

test('a stale row is called stale rather than drawn as a live queue timer', async () => {
  await withApp('pos', async (app) => {
    await mountOrders(app);
    const c = rowOf(app, 'c2');
    c.waitSec = 677553; c.wait = '188h 12m 33s';
    c.stale = true; c.staleAfterSec = 14400;
    await app.window.HW.unclaimCheckin('c2');
    for (let i = 0; i < 60; i++) {
      await app.settle();
      if (/stale/.test(textOf(cardFor(app, 'Manisha')))) break;
    }
    assert.match(textOf(cardFor(app, 'Manisha')), /7d 20h · stale/,
      'the stale row reads as an ordinary live wait');
  });
});

test('the Order Queue and the register print the SAME wait the same way', async () => {
  // The two screens each had their own ladder once; shared/hw-wait.js is now
  // the only implementation and both call it. This is the check that fails the
  // moment somebody adds a second copy back to either screen.
  await withApp('pos', async (app) => {
    const src = [
      'pos/screen-orders.jsx', 'pos/screen-register.jsx', 'shared/hw-live-checkin.js',
    ];
    const { readFileSync } = await import('node:fs');
    const ROOT = new URL('..', import.meta.url).pathname;
    for (const f of src) {
      const code = readFileSync(ROOT + f, 'utf8');
      assert.ok(!/function shortWait\s*\(sec\)\s*\{[^}]*\d/.test(
        code.replace(/return W\.HW_WAIT[^\n]*/, '')),
        f + ' has grown its own wait ladder again');
    }
    assert.equal(app.window.HW_WAIT.shortWait(677553), '7d 20h');
    assert.equal(app.window.HW_WAIT.shortWait(131), '2m');
    assert.equal(app.window.HW_WAIT.shortWait(58), '58s');
    assert.equal(app.window.HW_WAIT.shortWait(7200), '2h 0m');
  });
});
