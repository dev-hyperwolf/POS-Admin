/* ══ SCAN / MANUAL MODE TOGGLE (id-scan-flow-concept-b.md) ══════════════════
 *
 * GuestEditor's "New guest — onboarding" card and CheckInModal's "New
 * customer" form both gated their field grid — and their commit button — on
 * `nf.doc`, so there was no reliable way to onboard someone by hand. This
 * file proves the fix: a `<Seg>` toggle ("Scan ID" / "Enter manually") that
 * is a PURE VIEW SWITCH (never touches `nf`), a relaxed commit bar (first
 * name only), and — critically — that relaxing the commit bar did NOT make
 * check-in easier to fake: a doc-less guest/customer still reads as the
 * exact same "Needs ID" / "No ID on file" state the app already had for
 * other incomplete people, and still blocks the same gates it always did.
 *
 * See also: test/member-flows.test.mjs's "a doc-less primary customer can be
 * created (Manual mode), but cannot check in" — the CheckInModal half of the
 * same compliance proof, using the real check-in flow end to end. This file
 * covers the GuestEditor half, plus the toggle's state-preservation rules
 * (id-scan-flow-concept-b.md §2) on both surfaces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
const fieldByLabel = (app, label) => {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
};
const btn = (app, re) => [...app.document.querySelectorAll('button')]
  .find((b) => re.test((b.textContent || '').trim()));
/** The Seg control's own option buttons carry `aria-pressed` — the real
 *  IdScanPanel's "Scan ID" trigger button does not, so this is how the two
 *  identically-labelled buttons are told apart in a test. */
const segOption = (app, label) => [...app.document.querySelectorAll('button[aria-pressed]')]
  .find((b) => (b.textContent || '').trim() === label);

const DOC_A = { type: 'CA DL', num: '••••4821', expires: '2032-04-11', scannedAt: 'Just now',
  by: 'Manisha Saini', photo: true, firstName: 'Priya', lastName: 'Raman', name: 'Priya Raman',
  nameGuessed: false, dob: '03/11/1994', returning: false, lookup: 'ok', simulated: true };

/** Same shape as checkin-guest-id-photos.test.mjs's mountGuestEditor — a
 *  stubbed scanner, because this file is about the toggle and the commit
 *  bar, not the scanner itself. */
async function mountGuestEditor(app) {
  const R = app.window.React;
  app.window.HW = app.window.HW || {};
  app.window.HW.MEMBERS = [];
  app.window.HW.GUEST_POOL = [];
  app.window.__doc = DOC_A;
  app.window.IdScanPanel = function StubScan({ onChange }) {
    return R.createElement(R.Fragment, null,
      R.createElement('button', { onClick: () => onChange(app.window.__doc) }, 'STUB SCAN'),
      R.createElement('button', { onClick: () => onChange(null) }, 'STUB RESCAN'));
  };
  app.window.__guests = [];
  // A STATEFUL wrapper, not a bare closure over a module-level array: the
  // party-list / "Needs ID" banner only re-render when GuestEditor gets a
  // NEW `guests` prop, which only happens if something holding React state
  // re-renders. A plain variable mutated in onChange (as elsewhere in this
  // file's sibling suite) is enough to inspect the pushed guest object, but
  // not enough to see the rendered blocking banner update.
  app.window.__GuestProbe = () => {
    const [guests, setGuests] = R.useState([]);
    app.window.__guests = guests;
    return R.createElement(app.window.GuestEditor, {
      primaryName: 'Jordan Buyer',
      guests,
      onChange: setGuests,
    });
  };
  await app.mount('__GuestProbe');
}

test('GuestEditor: Manual mode commits a doc-less guest, and it reads as the same "Needs ID" state — still blocking', async () => {
  await withApp('pos', async (app) => {
    await mountGuestEditor(app);
    assert.ok(app.click('New guest'), 'the New guest button is not reachable');
    await app.settle();

    // Default is Scan, per id-scan-flow-concept-b.md §1.
    const scanOpt = segOption(app, 'Scan ID');
    const manualOpt = segOption(app, 'Enter manually');
    assert.ok(scanOpt && manualOpt, 'the Scan ID / Enter manually toggle did not render');
    assert.equal(scanOpt.getAttribute('aria-pressed'), 'true', 'Scan is not the default mode');

    assert.ok(app.click('Enter manually'), 'could not switch to Manual mode');
    await app.settle();
    assert.equal(segOption(app, 'Enter manually').getAttribute('aria-pressed'), 'true',
      'the toggle did not switch to Manual');
    assert.doesNotMatch(app.text(), /Government ID — scan to fill/,
      'the scan panel is still shown in Manual mode');
    // Photos stay available in Manual mode too (id-scan-flow-concept-b.md §1).
    assert.match(app.text(), /Photos of the ID \/ passport/,
      'the photo control disappeared in Manual mode');

    const first = fieldByLabel(app, 'First name');
    assert.ok(first, 'no First name field in Manual mode — the field grid did not render with no doc');
    setValue(app, first, 'Nobody');
    await app.settle();

    const commit = btn(app, /^Add to party$/);
    assert.ok(commit, 'no Add-to-party commit control');
    assert.ok(!commit.disabled, 'a first name with no document must be enough to add the guest');
    assert.ok(app.click('Add to party'), 'Add to party did not fire');
    await app.settle();

    const list = app.window.__guests;
    assert.equal(list.length, 1, 'commitNew did not push the guest');
    assert.equal(list[0].doc, null, 'a Manual-mode guest must honestly carry doc: null, not a fabricated document');
    // guestStatus (pos/checkin.jsx:32) reads doc/id — no id, no doc — is
    // 'incomplete', the same status any other doc-less/unlinked guest gets,
    // and guestBlocks/StatusPill both already treat that as blocking.
    assert.match(app.text(), /Needs ID/,
      'a doc-less guest must render the same "Needs ID" pill any other incomplete guest gets');
    assert.match(app.text(), /cannot be checked in yet/,
      'a doc-less guest created from Manual mode must still count toward the blocking banner');
  });
});

test('GuestEditor: switching modes never destroys nf — scanned then Manual, typed then Scan', async () => {
  await withApp('pos', async (app) => {
    await mountGuestEditor(app);
    assert.ok(app.click('New guest'));
    await app.settle();
    assert.ok(app.click('STUB SCAN'), 'the stub scanner never rendered');
    await app.settle();
    // Input VALUES are not part of .textContent, so this reads the field
    // directly rather than grepping app.text() for the scanned name.
    assert.equal(fieldByLabel(app, 'First name').value, 'Priya', 'the scan never filled the name fields');

    // Scanned, then switch to Manual — the scanned values must survive.
    assert.ok(app.click('Enter manually'));
    await app.settle();
    const firstAfterToManual = fieldByLabel(app, 'First name');
    assert.equal(firstAfterToManual.value, 'Priya', 'switching to Manual discarded the scanned first name');

    // Typed in Manual, then switch to Scan — the typed edit must survive too,
    // even though it is not shown while nf.doc is falsy... except nf.doc IS
    // still set from the scan here, so the field grid stays visible; the
    // real "typed in Manual with no doc, then Scan" case is covered on
    // CheckInModal below, where Manual is reachable with no doc at all.
    setValue(app, firstAfterToManual, 'Priya-Edited');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'could not switch back to Scan mode');
    await app.settle();
    const firstAfterToScan = fieldByLabel(app, 'First name');
    assert.ok(firstAfterToScan, 'the field grid vanished after switching back to Scan with nf.doc still set');
    assert.equal(firstAfterToScan.value, 'Priya-Edited',
      'the toggle called setNf (or otherwise lost state) on a pure view switch');
  });
});

test('CheckInModal: Scan mode now hides the field grid until nf.doc is set (adopting GuestEditor\'s split)', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.type('by name, e-mail or phone', 'Zzz Nobody Toggle'), 'no manual search field');
    await app.settle();
    assert.ok(app.click('Enter manually'), 'no manual path off a failed search');
    await app.settle();

    // openManual's stated exception: Manual is pre-selected, no second click.
    assert.equal(segOption(app, 'Enter manually').getAttribute('aria-pressed'), 'true',
      'openManual did not pre-select Manual mode');
    const first = fieldByLabel(app, 'First name');
    assert.ok(first, 'no First name field');
    setValue(app, first, 'Toggle');
    await app.settle();
    setValue(app, fieldByLabel(app, 'Last name'), 'Person');
    await app.settle();

    // "Scan ID instead" — a text-style, non-accent affordance back to Scan.
    const scanInstead = btn(app, /^Scan ID instead$/);
    assert.ok(scanInstead, 'no "Scan ID instead" affordance in Manual mode');
    assert.equal(scanInstead.style.backgroundColor, 'transparent',
      'the "Scan ID instead" link must be ghost, not a second accent button — one accent per view');

    assert.ok(app.click('Scan ID instead'), 'the Scan-ID-instead link did not switch modes');
    await app.settle();
    assert.equal(segOption(app, 'Scan ID').getAttribute('aria-pressed'), 'true', 'did not switch to Scan mode');
    // No document was ever scanned, so the field grid must now be HIDDEN —
    // this is the behavior this card did not have before the toggle: it used
    // to show the grid unconditionally the instant newOpen was true.
    assert.equal(fieldByLabel(app, 'First name'), undefined,
      'Scan mode is showing the field grid with no nf.doc — the nf.doc ? grid : hint split was not adopted');
    assert.match(app.text(), /fill themselves from the barcode/,
      'Scan mode with no doc yet must show the scan hint, not a blank card');

    // And switching back to Manual must not have lost what was typed.
    assert.ok(app.click('Enter manually'));
    await app.settle();
    const firstAgain = fieldByLabel(app, 'First name');
    assert.equal(firstAgain.value, 'Toggle', 'switching modes lost the typed first name');
    assert.equal(fieldByLabel(app, 'Last name').value, 'Person', 'switching modes lost the typed last name');
  });
});
