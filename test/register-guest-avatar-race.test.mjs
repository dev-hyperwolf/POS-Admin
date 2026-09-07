// THE REGISTER CRASHED ON A FRESH LOAD, NO INTERACTION NEEDED — 2026-09-07.
//
//   TypeError: (name || "?").split is not a function
//   @ window.Avatar (pos/atoms.jsx), called from CustomerChip's `Avatars`
//   helper (pos/screen-register.jsx), inside RegisterScreen.
//
// Reproduced live (python3 -m http.server + a real Chrome tab), repeatedly,
// on a completely untouched Register screen: ScreenBoundary caught it,
// logged "[HW boundary] contained — The register: (name || \"?\").split is
// not a function", and recreated the tree — which is why a screenshot taken
// a moment later looks fine and this was easy to miss.
//
// ROOT CAUSE: every guest-avatar call site in this file read
//
//     window.guestName ? window.guestName(g) : g
//
// — a defensive existence-check on the global checkin.jsx installs
// (`window.guestName = gName`), with an UNSAFE FALLBACK: the raw guest
// value `g` itself. That is fine when `g` is a legacy bare string, and is
// exactly the crash the instant `g` is the RICHER guest shape this same
// file's own default state seeds four lines below (`{key, id, name, dob,
// phone, member, doc}` — see RegisterScreen's default `guests` useState) or
// that GuestEditor (pos/checkin.jsx) commits guests as: an object is
// truthy, so Avatar's own `(name || '?')` guard never catches it, and
// `.split` throws on the object.
//
// `window.guestName` is normally defined by the time RegisterScreen renders
// (checkin.jsx's <script> tag precedes it), but this file's OWN fallback
// branch assumed `g` was already display-ready whenever the global happened
// to be unavailable — a real page-load ordering nobody could then verify. A
// correct fix does not need to explain the exact timing: it makes the
// fallback safe on its own terms, mirroring `gName`/`normGuest`
// (pos/checkin.jsx) instead of trusting `g`.
//
// This test pins the fix by simulating exactly that condition — deleting
// `window.guestName` before the Register screen ever renders — and mounting
// the register with the RICH default guest objects that triggered the real
// crash. Before the fix this reliably threw inside CustomerChip; after the
// fix, `safeGuestName`'s own fallback (screen-register.jsx) extracts
// `g.name` instead of handing the object to Avatar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const SRC = readFileSync(new URL('../pos/screen-register.jsx', import.meta.url), 'utf8');

test('no guest-avatar call site trusts the raw guest value as a fallback name', () => {
  // THE ORIGINAL DEFECT, verbatim. If this pattern is back, so is the crash.
  assert.equal(/window\.guestName\s*\?\s*window\.guestName\(g\)\s*:\s*g\b/.test(SRC), false,
    'a guest-name fallback that hands the raw guest value to Avatar is exactly ' +
    'the 2026-09-07 crash — it must extract a string even when window.guestName is missing');
  assert.match(SRC, /const safeGuestName = /,
    'expected a safe, self-contained guest-name helper that never returns a non-string');
});

test('the register renders every guest avatar without window.guestName, using rich guest objects', async () => {
  await withApp('pos', async (app) => {
    // The exact condition that crashed live: the global name-extractor is not
    // available at render time, and the party carries the RICH guest shape
    // (not the legacy bare-string one) — RegisterScreen's own default state
    // when there is no pending sale.
    delete app.window.guestName;

    await app.mount('RegisterScreen');
    await app.settle();

    assert.equal(app.errors.length, 0,
      `Register screen must not crash rendering guest avatars without window.guestName. ` +
      `Errors: ${app.errors.join(' | ')}`);

    // The default party is Girish Sharma + guests Mia Tran / Sam Cole — prove
    // they actually rendered (initials, not silently dropped), not just that
    // nothing threw.
    const text = app.text();
    assert.match(text, /Girish Sharma/);
    // Avatar initials render back-to-back with no separator (e.g. "GSMTSC"),
    // so this checks for the whole run rather than a word-bounded "MT"/"SC".
    assert.match(text, /GSMTSC/, 'Girish Sharma + Mia Tran + Sam Cole avatar initials must all render, in order');
  });
});

test('loading a waiting check-in (bare-string legacy guests) still works without window.guestName', async () => {
  await withApp('pos', async (app) => {
    delete app.window.guestName;
    // Legacy shape from pos/data.jsx CHECKINS: guests is an array of bare
    // strings, e.g. c1 "Harshil Gupta" with guests: ['Alex Romero'].
    await app.mount('RegisterScreen');
    await app.settle();

    const ok = app.click((t) => t.includes('Harshil'));
    assert.ok(ok, 'the pre-seeded Harshil Gupta check-in card must be clickable');
    await app.settle();

    assert.equal(app.errors.length, 0,
      `loading a bare-string-guest check-in must not crash. Errors: ${app.errors.join(' | ')}`);
    assert.match(app.text(), /Harshil Gupta/);
    assert.match(app.text(), /HGAR/, 'Harshil Gupta + Alex Romero avatar initials must both render, in order');
  });
});
