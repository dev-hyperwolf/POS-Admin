/* ══ THE PARTY'S GUEST ONBOARDING ADOPTS THE SHARED PHOTO CONTROL ═══════════
 *
 * pos/checkin.jsx's "New guest" onboarding block (inside window.GuestEditor)
 * used to carry a comment explaining exactly why no photo strip existed yet —
 * "adopting it is three lines" — pending an owner decision on real backend
 * persistence. The owner's decision: build the control now, honestly, with no
 * real persistence, exactly as test/id-photos.test.mjs already proves for the
 * check-in New-customer form's copy of the same control.
 *
 * This file is the guest-form half of that same proof: the control renders,
 * a captured photo travels onto the pushed guest under its own `idPhotos`
 * key, the storage disclosure is on screen, and nothing here manufactures a
 * false "ID on file" claim — guestStatus (pos/checkin.jsx:32) is keyed on
 * `doc`/`id` only, and attaching a photo must not move that needle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

function makeFile(app, name, type, bytes = 1024) {
  const f = new app.window.File([new app.window.Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: bytes, configurable: true });
  return f;
}

function attach(app, files, which = 'file') {
  const el = app.document.querySelector(`input[data-hw-idphoto="${which}"]`);
  assert.ok(el, `no [data-hw-idphoto="${which}"] input on screen`);
  Object.defineProperty(el, 'files', { value: files, configurable: true });
  el.dispatchEvent(new app.window.Event('change', { bubbles: true }));
}

const DOC_A = { type: 'CA DL', num: '••••4821', expires: '2032-04-11', scannedAt: 'Just now',
  by: 'Manisha Saini', photo: true, firstName: 'Priya', lastName: 'Raman', name: 'Priya Raman',
  nameGuessed: false, dob: '03/11/1994', returning: false, lookup: 'ok', simulated: true };

/** Mount GuestEditor on its own, the test holding the guest list — same shape
 *  as id-photos.test.mjs's checkInAtNewCustomer, but for the party form. */
async function mountGuestEditor(app) {
  const R = app.window.React;
  app.window.HW = app.window.HW || {};
  app.window.HW.MEMBERS = [];
  app.window.HW.GUEST_POOL = [];
  app.window.__doc = DOC_A;
  // A stub scanner — the real IdScanPanel's simulator cycles a pool, and this
  // is about the photo control, not the scanner. Two controls because the
  // real one has two: Scan emits a document, Re-scan emits null.
  app.window.IdScanPanel = function StubScan({ onChange }) {
    return R.createElement(R.Fragment, null,
      R.createElement('button', { onClick: () => onChange(app.window.__doc) }, 'STUB SCAN'),
      R.createElement('button', { onClick: () => onChange(null) }, 'STUB RESCAN'));
  };
  app.window.__guests = [];
  app.window.__GuestProbe = () => R.createElement(app.window.GuestEditor, {
    primaryName: 'Jordan Buyer',
    guests: app.window.__guests,
    onChange(next) { app.window.__guests = next; },
  });
  await app.mount('__GuestProbe');
}

test('the New-guest onboarding block carries the photo control, under the government ID card', async () => {
  await withApp('pos', async (app) => {
    await mountGuestEditor(app);
    assert.ok(app.click('New guest'), 'the New guest button is not reachable');
    await app.settle();

    const t = app.text();
    assert.match(t, /Photos of the ID \/ passport/,
      'the party onboarding form has no photo capture at all — the three lines were never wired');
    assert.match(t, /No ID photos attached/,
      'the photo control is on the form but is not rendering its own absent state');
    assert.match(t, /Held in this browser tab only/,
      'the storage disclosure did not come across with the control');

    // POSITION: the photos are a second reading of the document the scanner
    // just read, so they belong directly under the government-ID card.
    const body = app.document.body.textContent.replace(/\s+/g, ' ');
    const gov = body.indexOf('Government ID');
    const photos = body.indexOf('Photos of the ID / passport');
    assert.ok(gov >= 0 && photos > gov, 'the photo control is not under the government ID card');
  });
});

test('a captured photo travels onto the pushed guest, under its own key — never inside `doc`', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await mountGuestEditor(app);
    assert.ok(app.click('New guest'));
    await app.settle();
    assert.ok(app.click('STUB SCAN'), 'the stub scanner never rendered inside the guest form');
    await app.settle();

    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg'), makeFile(app, 'back.jpg', 'image/jpeg')]);
    await app.settle();

    assert.ok(app.click('Add to party'), 'no Add-guest commit control');
    await app.settle();

    const list = app.window.__guests;
    assert.equal(list.length, 1, 'commitNew did not push the new guest');
    const g = list[0];
    assert.equal(g.idPhotos.length, 2, 'the photos did not travel with the pushed guest');
    assert.equal(g.idPhotos.map((p) => p.name).join(','), 'front.jpg,back.jpg',
      'the guest carries something other than the two files attached');
    assert.equal(g.doc.idPhotos, undefined,
      'the photos were folded into the scanned document — a photograph an operator took ' +
      'must never sit inside the record of what the barcode said');
    assert.equal(g.idPhotos[0].stored, false,
      'a photo on the pushed guest claims to be stored — nothing in this build stores anything');
  });
});

test('attaching a photo does not manufacture a false "ID on file" claim', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await mountGuestEditor(app);
    assert.ok(app.click('New guest'));
    await app.settle();
    assert.ok(app.click('STUB SCAN'));
    await app.settle();
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();

    // guestStatus (pos/checkin.jsx:32) reads `doc`/`id` only. A photo being
    // attached is not a document being on file, and the card must not blur
    // the two the way mobile/screen-task.jsx's now-fixed "ID ON FILE" tile
    // once did for an unverified first-timer (commit 4d87ce0).
    assert.doesNotMatch(app.text(), /ID on file/,
      'the onboarding card claimed "ID on file" from a photo attachment alone — that claim ' +
      'belongs to a verified record, not a picture taken in this tab');

    // The honest, unconditional disclosure is what is actually on screen.
    assert.match(app.text(), /Nothing is uploaded/,
      'the card stopped disclosing that nothing is uploaded');
  });
});
