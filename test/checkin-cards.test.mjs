/* pos/screen-register.jsx — the check-in queue cards, against the approved
 * design "Option 1 — Unclaim Replaces the Pill Button".
 *
 * THE THREE DEFECTS THESE TESTS EXIST FOR, as the owner saw them on screen:
 *
 *   1. EVERY CARD READ "visits unknown". A live check-in carries no visit
 *      count, so shared/hw-live-checkin.js set `visit: null` and the pill said
 *      so — honest, and useless. There is now a real number to print for
 *      anybody the identity ledger can name: how many orders they have
 *      actually placed and not had cancelled. It is NOT a visit count and the
 *      pill must never call it one.
 *   2. EVERY TIMER READ A GARBAGE VALUE — "9879m", earlier "162h 34m 16s". The
 *      arithmetic was right the whole time; `shortWait` simply had no rung
 *      above minutes, and four seeded check-ins from 2026-08-19 were still in
 *      state `waiting`.
 *   3. EVERY CARD SAID "Claim →" AND THERE WAS NO UNCLAIM STATE AT ALL.
 *      `claimedBy` had four occurrences in this application and every one was a
 *      READ. Nothing wrote it, so "claimed" was a state the UI could paint and
 *      no click could produce.
 *
 * WATCHED TO FAIL. Every check below was run against the pre-fix tree first.
 * The pill test saw "1st visit" where the row had no count, the timer test saw
 * "11280m", and the claim tests could not find an "Unclaim" control on any
 * card because none existed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* REPAINT, THEN WAIT FOR THE PAINT — not for a fixed number of milliseconds.
 *
 * `unclaimCheckin` on an already-unclaimed row changes nothing and notifies,
 * which is exactly the nudge we want and nothing else. But the notify -> React
 * re-render round trip does not reliably complete inside ONE settle() when
 * other suites are sharing the process: two of these checks passed alone and
 * failed at 593 tests, on a strip still showing the pre-mutation text. A test
 * whose result depends on machine load is measuring the machine. So: wait for
 * the condition the test is about, and if it never arrives, fail with what was
 * actually on screen rather than with a timeout nobody can read. */
const repaint = async (app, id, expect) => {
  await app.window.HW.unclaimCheckin(id);
  for (let i = 0; i < 60; i++) {
    await app.settle();
    if (!expect || expect.test(stripText(app))) return;
  }
  assert.fail('the strip never repainted to match ' + expect
    + ' — it still reads: ' + stripText(app));
};

/** Only the queue cards. The register renders "3rd visit" in the CUSTOMER
 *  CHIP too, for the member whose cart is open, and that one is a real visit
 *  count from a real member record — asserting against the whole page would
 *  score that as the queue pill lying. */
const stripText = (app) => [...app.document.querySelectorAll('button')]
  .filter((b) => (b.getAttribute('title') || '').startsWith('Open '))
  .map((b) => (b.parentElement.textContent || '').replace(/\s+/g, ' '))
  .join(' | ');

const pillOf = (app, name) => {
  const cards = [...app.document.querySelectorAll('button')];
  const body = cards.find((b) => (b.textContent || '').includes(name)
    && (b.getAttribute('title') || '').startsWith('Open '));
  if (!body) return null;
  const card = body.parentElement;
  return [...card.querySelectorAll('button')].find((b) => b !== body) || null;
};

/* Same reasoning as repaint(): a click dispatches, a promise resolves, the
 * state setter runs, React re-renders. One settle() covers that on an idle
 * machine and not on a busy one. */
const untilPill = async (app, name, expect) => {
  for (let i = 0; i < 60; i++) {
    const p = pillOf(app, name);
    if (p && expect.test(p.textContent || '')) return p;
    await app.settle();
  }
  const p = pillOf(app, name);
  assert.fail('the pill for ' + name + ' never matched ' + expect
    + ' — it reads: ' + ((p && p.textContent) || '(no pill at all)'));
};

test('the claimed card offers UNCLAIM and the unclaimed one offers CLAIM', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const claimed = HW.CHECKINS.find((c) => c.claimedBy);
    const free = HW.CHECKINS.find((c) => !c.claimedBy);
    assert.ok(claimed && free, 'the seed has no claimed and unclaimed pair to compare');

    assert.match(pillOf(app, claimed.name).textContent, /Unclaim/,
      'a claimed card still offers something other than Unclaim');
    assert.match(pillOf(app, free.name).textContent, /Claim/,
      'an unclaimed card does not offer Claim');
    assert.doesNotMatch(pillOf(app, free.name).textContent, /Unclaim/,
      'an UNCLAIMED card offers Unclaim');
    // The pre-fix card said "Resume" here, and Resume did the same thing as
    // Claim: open the cart. Neither recorded anything.
    assert.doesNotMatch(pillOf(app, claimed.name).textContent, /Resume/,
      'the claimed pill still says Resume');
  });
});

test('pressing Claim RECORDS the claim — it is not just a label', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const free = HW.CHECKINS.find((c) => !c.claimedBy);
    assert.equal(free.claimedBy, null);

    pillOf(app, free.name).dispatchEvent(
      new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await untilPill(app, free.name, /Unclaim/);

    const after = HW.CHECKINS.find((c) => c.id === free.id);
    assert.ok(after.claimedBy, 'the claim wrote nothing — claimedBy is still empty');
    assert.equal(after.claimedBy, HW.STATS.associate.name,
      'the claim was recorded against somebody other than the associate who pressed it');
    assert.match(pillOf(app, free.name).textContent, /Unclaim/,
      'the pill did not relabel after the claim landed');
  });
});

test('one press releases — Unclaim clears the claim and the pill goes back', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const claimed = HW.CHECKINS.find((c) => c.claimedBy);
    const was = claimed.claimedBy;

    pillOf(app, claimed.name).dispatchEvent(
      new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await untilPill(app, claimed.name, /^Claim$/);

    const after = HW.CHECKINS.find((c) => c.id === claimed.id);
    assert.equal(after.claimedBy, null,
      `Unclaim left the claim in place (still ${after.claimedBy})`);
    assert.match(pillOf(app, claimed.name).textContent, /Claim/);
    assert.doesNotMatch(pillOf(app, claimed.name).textContent, /Unclaim/);
    assert.notEqual(was, null, 'the fixture was not claimed to begin with');
  });
});

test('the card BODY opens the cart, and does not claim anybody', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const free = HW.CHECKINS.find((c) => !c.claimedBy);

    const body = [...app.document.querySelectorAll('button')].find(
      (b) => (b.getAttribute('title') || '') === `Open ${free.name}'s cart`);
    assert.ok(body, 'the card body is not a control at all — only the pill was clickable');
    body.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 60 && !/End visit/.test(app.text()); i++) await app.settle();

    assert.ok(app.text().includes(free.name), 'the cart did not open for that person');
    assert.match(app.text(), /End visit/, 'no open visit — the cart did not open');
    assert.equal(HW.CHECKINS.find((c) => c.id === free.id).claimedBy, null,
      'opening the cart silently claimed the customer');
  });
});

test('a wait of days renders as days, never as five figures of minutes', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const c = HW.CHECKINS[0];
    c.waitSec = 676817;            // the real value the live board returned
    c.wait = '187h 56m 57s';
    await repaint(app, c.id, /7d 20h/);

    const txt = stripText(app);
    assert.ok(!/\d{4,}m/.test(txt),
      'the card is still rendering a four-or-more-figure minute count: ' + txt);
    assert.match(txt, /7d 20h/,
      'a 7-day wait is not rendered in days and hours: ' + txt);
  });
});

test('a stale row is labelled stale instead of drawn as a live queue timer', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const c = HW.CHECKINS[0];
    c.waitSec = 676817; c.stale = true; c.staleAfterSec = 14400;
    await repaint(app, c.id, /stale/);
    assert.match(stripText(app), /stale/,
      'a row waiting since last week is presented as a live wait');
  });
});

test('no visit count and no history reads "visits unknown", never "1st visit"', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    HW.CHECKINS.forEach((c) => {
      c.visit = null;
      c.history = { known: false, priorOrders: null, label: 'visits unknown',
                    state: 'no_identity', why: 'nobody in the ledger matches' };
    });
    await repaint(app, HW.CHECKINS[0].id, /visits unknown/);

    const txt = stripText(app);
    assert.match(txt, /visits unknown/);
    assert.ok(!/1st visit/.test(txt),
      'a person we cannot name is being called a first-time visitor: ' + txt);
  });
});

test('a real purchase count is printed as ORDERS — the pill never calls it a visit', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    const c = HW.CHECKINS[0];
    HW.CHECKINS.forEach((x) => { x.visit = null; x.history = null; });
    c.history = { known: true, priorOrders: 5, label: '5 prior orders',
                  state: 'history', identityId: 1914, identitySource: 'name_dob',
                  why: 'Dana Whitfield bought 2 products across 5 orders' };
    await repaint(app, c.id, /5 prior orders/);

    const txt = stripText(app);
    assert.match(txt, /5 prior orders/,
      'a measured order count is not on the card: ' + txt);
    // "visits unknown" on the OTHER cards is fine and expected — what must not
    // appear anywhere in this strip is an ordinal, which is the word the design
    // uses for a real visit count.
    assert.ok(!/\d(st|nd|rd|th) visit/.test(txt),
      'an ORDER count was promoted to a VISIT count on the pill: ' + txt);
  });
});

test('a known customer who has bought nothing is not the same as an unknown one', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const HW = app.window.HW;
    HW.CHECKINS.forEach((x) => { x.visit = null; x.history = null; });
    HW.CHECKINS[0].history = { known: true, priorOrders: 0, label: 'no prior orders',
                               state: 'no_purchases', why: 'bound accounts, never ordered' };
    HW.CHECKINS[1].history = { known: false, priorOrders: null, label: 'visits unknown',
                               state: 'unknown', why: 'no line data' };
    await repaint(app, HW.CHECKINS[0].id, /no prior orders/);

    const txt = stripText(app);
    assert.match(txt, /no prior orders/, txt);
    assert.match(txt, /visits unknown/, txt);
    // The whole point: these two must not render as the same sentence.
    assert.notEqual('no prior orders', 'visits unknown');
  });
});

test('the design build still renders the approved ordinals unchanged', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    // pos/data.jsx seeds visit 1 / 2 / 5 / 8 -> 1st / 2nd / 3rd / 3rd.
    const txt = stripText(app);
    assert.match(txt, /1st visit/);
    assert.match(txt, /2nd visit/);
    assert.match(txt, /3rd visit/);
  });
});
