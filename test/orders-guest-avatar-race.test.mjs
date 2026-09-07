// THE SAME DEFECT CLASS THAT CRASHED THE REGISTER, FLAGGED AGAINST THIS FILE
// BY THE 2026-09-07 FIX (see commit d9787dd, pos/screen-register.jsx) —
// verified here, not merely flagged.
//
//   TypeError: (name || "?").split is not a function
//   @ window.Avatar (pos/atoms.jsx)
//
// ROOT CAUSE, identical to the register screen: two call sites in
// pos/screen-orders.jsx read
//
//     window.guestName ? window.guestName(g) : g
//
// — a defensive existence-check on the global checkin.jsx installs
// (`window.guestName = gName`), with an UNSAFE FALLBACK: the raw guest value
// `g` itself. That's fine for a legacy bare-string guest (pos/data.jsx's seed
// CHECKINS), and is exactly the crash the instant `g` is the RICHER guest
// shape GuestEditor commits (pos/checkin.jsx:281,300 — `{key, id, name, dob,
// phone, member, doc}`): an object is truthy, so Avatar's own `(name || '?')`
// guard never catches it, and `.split` throws on the object.
//
// Both shapes genuinely reach this file's CheckInCard/MatchSheet: they read
// straight off window.HW.CHECKINS, and `checkIn()` (pos/data.jsx:705) stores
// `guests: (p.guests || []).slice()` verbatim — whatever GuestEditor handed
// it. The seed data happens to be bare strings; a real check-in taken through
// the counter flow is not.
//
//   Site 1 (line ~405, CheckInCard "In the store" queue): the raw value goes
//   straight into <Avatar name=... />.
//   Site 2 (line ~720, MatchSheet's partyGuests): the raw value is stored as
//   `.name` on a row object, which is READ BACK into <Avatar name={g.name} />
//   and into visible text (`{g.name}`) at line 789 — so an unsafe fallback
//   here reaches Avatar exactly the same way, just one hop later.
//
// Fix: a local safeGuestName() helper, identical in shape to
// screen-register.jsx's, mirroring gName/normGuest (pos/checkin.jsx) so it
// always returns a string even when window.guestName is unavailable.
//
// This test pins the fix by deleting window.guestName before render and
// injecting a check-in whose guest is the rich object shape, at both call
// sites independently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const SRC = readFileSync(new URL('../pos/screen-orders.jsx', import.meta.url), 'utf8');

test('no guest-avatar call site in screen-orders.jsx trusts the raw guest value as a fallback name', () => {
  // THE ORIGINAL DEFECT, verbatim. If this pattern is back, so is the crash.
  assert.equal(/window\.guestName\s*\?\s*window\.guestName\(g\)\s*:\s*g\b/.test(SRC), false,
    'a guest-name fallback that hands the raw guest value to Avatar is exactly ' +
    'the register-screen crash shape — it must extract a string even when window.guestName is missing');
  assert.match(SRC, /const ordersSafeGuestName = /,
    'expected a safe, self-contained guest-name helper that never returns a non-string ' +
    '— named distinctly from screen-register.jsx\'s safeGuestName so the two top-level ' +
    'consts do not collide as globals (see test/global-collisions.test.mjs)');
});

// The rich shape GuestEditor actually commits (pos/checkin.jsx:300) — an
// object with no `.split` method, which is exactly what breaks Avatar's
// unguarded `(name || '?')`.
const richGuest = (name, key) => ({ key, id: null, first_name: name.split(' ')[0], last_name: name.split(' ')[1] || '', name, dob: '', phone: '', member: false, doc: null });

test('the "In the store" check-in queue renders a rich-object guest avatar without window.guestName', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // A fresh walk-in check-in, same shape checkIn() actually writes, carrying
    // a guest GuestEditor committed as the rich object — not the legacy
    // bare-string shape the seed data uses.
    HW.CHECKINS.push({
      id: 'c-race', memberId: null, name: 'Priya Nair', group: 'Walk-In', type: 'AdultUse',
      delivery: 'Pick-up', wait: '0h 0m 05s', waitSec: 5, claimedBy: null, member: false, visit: 1,
      guests: [richGuest('Dev Anand', 'g-race-1')],
    });

    // The exact condition that crashed live: the global name-extractor is not
    // available at render time.
    delete app.window.guestName;

    await app.mount('OrdersScreen');
    await app.settle();

    assert.equal(app.errors.length, 0,
      `Orders screen must not crash rendering a rich-object guest avatar without window.guestName. ` +
      `Errors: ${app.errors.join(' | ')}`);

    const text = app.text();
    assert.match(text, /Priya Nair/, 'the new check-in itself must render');
    // Avatar initials render back-to-back with no separator — same convention
    // the register-screen regression test checks against.
    assert.match(text, /PNDA/, 'Priya Nair + Dev Anand avatar initials must both render, in order');
  });
});

test('MatchSheet renders a rich-object party guest as a bindable person without window.guestName', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    HW.CHECKINS.push({
      id: 'c-race2', memberId: null, name: 'Rosa Delgado', group: 'Walk-In', type: 'AdultUse',
      delivery: 'Pick-up', wait: '0h 0m 05s', waitSec: 5, claimedBy: null, member: false, visit: 1,
      guests: [richGuest('Wei Chen', 'g-race-2')],
    });

    delete app.window.guestName;

    await app.mount('OrdersScreen');
    await app.settle();
    assert.equal(app.errors.length, 0, `boot must not crash: ${app.errors.join(' | ')}`);

    assert.ok(app.click('Match to a person'), 'no search affordance in the Needs-match lane');
    await app.settle();

    assert.equal(app.errors.length, 0,
      `MatchSheet must not crash rendering a rich-object party guest without window.guestName. ` +
      `Errors: ${app.errors.join(' | ')}`);

    const sheet = app.text();
    assert.match(sheet, /Guests inside a party/, 'the party-guests section must render at all');
    assert.match(sheet, /Wei Chen/,
      'the rich-object guest\'s real name must render as text, not the fallback raw object');
    assert.match(sheet, /Rosa.?s party/,
      'the bindable-guest row must still say whose party the guest belongs to');
  });
});
