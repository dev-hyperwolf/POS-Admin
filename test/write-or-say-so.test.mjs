/* ══ AN OPERATION THAT REPORTS SUCCESS MUST HAVE WRITTEN SOMETHING ══════════
 *
 * The sibling sweep handed back by the register fix (70c4400). Same family,
 * two different shapes, and they need OPPOSITE remedies — which is the whole
 * point of this file and the reason it is not one guard:
 *
 *   GROUP A — mobile/, ID capture.  THERE IS NO WRITE PATH TO CALL.
 *   GROUP B — a writer that CAN refuse, whose refusal was thrown away.
 *
 * ── GROUP A: WHY NOTHING WAS WIRED ─────────────────────────────────────────
 *
 * Three driver surfaces said an ID had been "saved to profile". The instinct is
 * to go and find the writer they forgot to call. There isn't one, and inventing
 * one would have been the worse bug. Three independent absences, each fatal on
 * its own:
 *
 *   1. THERE IS NO IMAGE. window.IDCapture's `shot` is a BOOLEAN. The shutter
 *      runs setShot(true) and the "captured" tile renders <Avatar name={name}>
 *      — the customer's INITIALS on a gradient. No File, no blob, no data URL.
 *      So `onCaptured` being called with no argument is not a dropped payload;
 *      there has never been a payload. Nothing was discarded at the boundary
 *      the way pos/data.jsx's two allow-lists discarded idPhotos (0668546).
 *   2. THERE IS NO PROFILE. A driver task (mobile/data.jsx, T_) carries
 *      id/order/name/phone/addr and NO member id. Nothing links a stop to a row
 *      in HW.MEMBERS, so "their profile" names a record this app cannot even
 *      identify — and the driver app DOES load pos/data.jsx, so this is an
 *      absence of linkage, not an absence of the store.
 *   3. AND A PHOTO MUST NOT MINT A LEDGER ROW. pos/data.jsx already ruled on
 *      exactly this in addCheckIn: `doc` is what a scanner read, `idPhotos` is
 *      what a human photographed, and an IDV row for a person no document has
 *      been seen for puts an identity-ledger entry behind a snapshot. Wiring
 *      IDCapture into IDV would not have completed the fix — it would have
 *      manufactured compliance evidence, which is a strictly worse defect than
 *      the wrong toast it replaced.
 *
 * So the copy was corrected and no writer was invented. What actually happens
 * is worth saying and is now said: the driver eyeballed the ID and the gate
 * opens for THIS STOP. What does not happen is persistence of any kind.
 *
 * ⚠️ TWO SITES THE SWEEP DID NOT LIST, BOTH WORSE THAN THE TOASTS IT DID.
 * A toast is gone in 2.6 seconds. These stay on screen for the whole stop:
 *   · screen-complete.jsx rendered "Saved to their profile" as a standing label
 *     under "ID captured · 21+ verified".
 *   · screen-appointment.jsx rendered "ID on file · 21+ / Verified" after a
 *     fresh capture, because `idOk` is set both by base.verified AND by a
 *     capture that stores nothing. One sentence covering both states asserted
 *     a filed record for a customer who has none.
 * A sweep that greps for the flash() string finds neither. That is the argument
 * for the rendered tests below over the source ban alone — and for the source
 * ban over the rendered tests, since it catches the claim coming back at a new
 * call site no rendered test is pointed at. Both halves are load-bearing.
 *
 * ── GROUP B: THE REFUSAL THAT WAS THROWN AWAY ──────────────────────────────
 *
 * These writers return null to REFUSE. Discarding that return and reporting
 * success anyway is the register defect one step quieter. The remedy here is
 * the opposite of Group A's: the write path exists, so call it and honour it.
 *
 * ⚠️ THE ONE WORTH READING IS THE MEMBER EDIT. It did not merely fail to toast
 * — it cleared `nameGuessed`, the standing warning that the first/last boxes
 * were INFERRED from one joined string rather than read off a document. On a
 * refused write that left the record LOOKING CONFIRMED while nothing had been
 * saved: the warning that existed to stop a bad split propagating was gone, and
 * the identity fingerprint that decides whether two records are one person
 * would go on to trust a boundary no human ever confirmed. A silent no-op
 * leaves stale data. This left CONFIDENT stale data, which is worse, and it is
 * why that site is tested hardest here.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ────────────────────────────────
 *
 * There is NO general "every success toast must have a write behind it" guard,
 * and there must not be. ~109 toasts in engage/, pipeline/ and rfid* are demo
 * furniture the owner has ruled stay; a blanket guard would fire on all of them
 * and teach everyone to ignore it. demo-toast-honesty.test.mjs owns the four
 * that name METRC / the audit log / AP, and is another agent's file.
 *
 * THREE OF THE TEN SITES HANDED OVER ARE NOT MEMBERS OF THIS FAMILY, and are
 * asserted as such at the foot of this file rather than "fixed". Adding a
 * refusal branch to a writer that cannot refuse is inventing a failure mode to
 * have something to handle — the same species of fiction as the toast.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withApp } from './ui-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* ⚠️ THE SOURCE SCANS BELOW READ CODE, NOT PROSE — and this is not a
 * convenience. The fix at each of these sites is largely a COMMENT explaining
 * why no writer was called, and those comments necessarily quote the banned
 * claim and name every writer the driver app must not reach. Scanning raw text
 * made both guards fail against the very change that satisfies them, which
 * would have left only two escapes: water down the assertion, or delete the
 * explanation. Line comments are only stripped when they START a line, so a
 * `//` inside a URL or a string is left alone. */
const code = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const mobileFiles = fs.readdirSync(path.join(ROOT, 'mobile'))
  .filter((f) => f.endsWith('.jsx')).map((f) => 'mobile/' + f);

/** Render a screen that needs props. `mount` takes none, so it is wrapped. */
async function mountWith(app, componentName, props) {
  const W = app.window;
  // MTopBar is undefined under the harness, and every driver screen renders it
  // first — without this the mount dies with "Element type is invalid" and the
  // failure looks like a bug in the screen. Same stub, same reason, as
  // driver-governed-swap.test.mjs.
  if (typeof W.MTopBar !== 'function') {
    W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
  }
  W.__HWProbe = () => W.React.createElement(W[componentName], props);
  return app.mount('__HWProbe');
}

/** Press IDCapture's shutter.
 *  It is a bare round <button> with NO text — app.click() matches on label, so
 *  it cannot reach it. The 70px width is what distinguishes the shutter from
 *  the 38px close ✕, the only other unlabelled control in the sheet. Asserted,
 *  not assumed: a miss here would leave `shot` false, the confirm button
 *  unrendered, and the test failing for a reason that has nothing to do with
 *  the claim under test. */
function pressShutter(app) {
  const W = app.window;
  const hit = [...W.document.querySelectorAll('button')]
    .filter((b) => !(b.textContent || '').trim())
    .find((b) => /width: ?70px/.test(b.getAttribute('style') || ''));
  assert.ok(hit, 'no shutter control in the ID capture sheet');
  hit.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** A stop the driver has NOT already verified, so the capture path is live. */
function unverifiedTask(W) {
  const t = W.MD.TASKS.find((x) => !x.verified);
  assert.ok(t, 'no unverified stop in the seed — the ID capture path is unreachable');
  return t;
}

/* ══ GROUP A ═══════════════════════════════════════════════════════════════ */

test('no driver surface claims an ID reached a profile', () => {
  /* The banned phrasings are the ones that were actually shipped, plus the
   * near-misses a copy-paste would produce. This is the half that catches the
   * claim coming back at a NEW call site — the rendered tests below only see
   * the two screens they drive. */
  const banned = [
    /saved to profile/i,
    /saved to (their|the customer'?s?) profile/i,
    /captured & saved/i,
  ];
  const hits = [];
  for (const f of mobileFiles) {
    const src = code(f);
    for (const re of banned) {
      const m = src.match(re);
      if (m) hits.push(`${f}: ${JSON.stringify(m[0])}`);
    }
  }
  assert.deepEqual(hits, [],
    'a driver surface tells the driver an ID was saved to a profile. mobile/ has no member ' +
    'write path at all (see the header of this file), so this claim cannot be true: ' + hits.join(' | '));
});

test('the capture button offers to confirm a check, not to save a profile', () => {
  const src = code('mobile/screen-task.jsx');
  assert.ok(!/>Save to profile</.test(src),
    'the IDCapture confirm button still offers to "Save to profile" — there is no profile to save to');
  assert.match(src, />Confirm ID checked</,
    'the honest replacement label is gone; if the button was renamed again, say what it does');
});

test('mobile/ still has no member write path — the verdict the copy rests on', () => {
  /* ⚠️ THIS IS A TRIPWIRE, NOT A PROHIBITION. The copy above is honest ONLY
   * while this holds. If someone genuinely wires the driver app to the member
   * store, this test failing is the correct and useful outcome: it means the
   * "not saved to a profile" wording has become the new lie and must be
   * revisited in the same commit. Do not silence it — re-decide it. */
  const writers = ['addMember', 'addCheckIn', 'updateMember', 'HW.IDV', 'idPhotos',
    'memberById', 'HWIdPhotos', 'IdPhotoCapture'];
  const found = [];
  for (const f of mobileFiles) {
    const src = code(f);
    for (const w of writers) if (src.includes(w)) found.push(`${f} → ${w}`);
  }
  assert.deepEqual(found, [],
    'the driver app now references the member store. That may well be right — but the ID-capture ' +
    'copy says "not saved to a profile" precisely because no such path existed. Re-decide the ' +
    'copy alongside the wiring: ' + found.join(' | '));
});

test('capturing an ID on an appointment does not tell the driver it was filed', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    // ⚠️ MOST SEEDED STOPS ARE PRE-VERIFIED. On those, `idOk` starts true, the
    // capture control is never rendered and this test would silently measure
    // nothing — so the stop is CHOSEN for being unverified, not hard-coded.
    const task = unverifiedTask(W);
    await mountWith(app, 'AppointmentScreen', { taskId: task.id });
    assert.ok(app.click((t) => /Scan customer ID/.test(t)), 'no ID scan control on the appointment');
    await app.settle();
    pressShutter(app);
    await app.settle();
    assert.ok(app.click((t) => /Confirm ID checked/.test(t)), 'no confirm control in the capture sheet');
    await app.settle();

    const toast = W.M.s.toast;
    assert.ok(toast, 'the capture produced no feedback at all');
    // Negative lookbehind, because the honest replacement CONTAINS the phrase:
    // "not saved to a profile". A bare /saved to a profile/ would reject the fix.
    assert.ok(!/(?<!not )saved to (a |their )?profile/i.test(toast.msg),
      `the toast still claims a profile write: ${JSON.stringify(toast.msg)}`);
    assert.match(toast.msg, /not saved to a profile/i,
      'the toast must say what did NOT happen, not merely omit it — a driver told nothing ' +
      'assumes the capture behaved like every other capture in the estate');

    // ⚠️ AND THE STANDING BANNER, WHICH OUTLIVES THE TOAST BY THE WHOLE STOP.
    const screen = app.text();
    // Matched on the banner's exact wording, not a loose /ID on file/: the
    // pre-arrival panel above carries its own "ID ON FILE" tile, which is a
    // different claim about different data and is not what this asserts.
    assert.ok(!/ID on file · 21\+/.test(screen),
      'after a fresh capture the readiness banner still reads "ID on file · 21+" — naming a filed ' +
      'record for a customer who has none. base.verified is the only state that may claim a file');
    assert.match(screen, /ID checked · 21\+/,
      'the banner must say the ID was checked, not filed');
    assert.match(screen, /Checked for this stop/,
      'the banner must distinguish a capture made moments ago from a genuinely pre-verified customer');

    // The gate really does open — the fix corrects the claim, not the behaviour.
    const shop = [...W.document.querySelectorAll('button')]
      .find((b) => /Start shopping/.test(b.textContent || ''));
    assert.ok(shop && !shop.disabled, 'the shopping gate no longer opens after a check');
  });
});

test('capturing an ID at close-out does not tell the driver it was filed', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    await mountWith(app, 'CompleteScreen', { taskId: unverifiedTask(W).id });
    assert.ok(app.click((t) => /Scan customer ID/.test(t)), 'no ID scan control on the close-out');
    await app.settle();
    pressShutter(app);
    await app.settle();
    assert.ok(app.click((t) => /Confirm ID checked/.test(t)), 'no confirm control in the capture sheet');
    await app.settle();

    assert.ok(!/(?<!not )saved to (a |their )?profile/i.test(W.M.s.toast.msg),
      `the toast still claims a profile write: ${JSON.stringify(W.M.s.toast.msg)}`);
    assert.match(W.M.s.toast.msg, /not saved to a profile/i,
      'the toast must say what did NOT happen rather than merely omitting it');
    // The PERSISTENT label, which the sweep missed and which a flash-string
    // grep can never find.
    const screen = app.text();
    assert.ok(!/Saved to their profile/.test(screen),
      'the standing label under "ID captured" still says the photo reached the profile');
    assert.match(screen, /Checked for this stop/,
      'the standing label must say what actually happened');
  });
});

/* ══ GROUP B ═══════════════════════════════════════════════════════════════ */

/** Open MembersScreen and land on a member's detail page. */
async function openMemberPage(app, name) {
  await app.mount('MembersScreen');
  const row = [...app.document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes(name));
  assert.ok(row, `no table row for ${name}`);
  row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await app.settle();
}

test('a REFUSED member edit does not clear the guessed-name mark', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    await openMemberPage(app, 'Manisha Saini');
    assert.ok(app.click('Edit member'), 'no Edit member button');
    await app.settle();

    // The seeded members carry a joined `name` and NO split pair, so the two
    // boxes really are an inference and the warning really is on screen. If
    // this stops being true the test below is measuring nothing, so it is
    // asserted rather than assumed.
    assert.match(app.text(), /These two boxes are a guess/,
      'the guessed-name warning is not showing, so this test cannot prove it survives a refusal');

    /* MAKE THE WRITE REFUSE THE WAY IT REFUSES IN PRODUCTION: updateMember
     * returns null when the id no longer resolves (`if (!m || !patch)`). A
     * record deleted or merged by another terminal between opening the editor
     * and pressing Save is exactly that, and it is not hypothetical on a shared
     * book. Nothing is stubbed — the real writer takes its real refusal path. */
    const idx = W.HW.MEMBERS.findIndex((m) => m.id === 'm2');
    const [gone] = W.HW.MEMBERS.splice(idx, 1);
    assert.equal(W.HW.updateMember('m2', { name: 'x' }), null,
      'the writer no longer refuses an unresolvable id — this test is set up wrong');

    assert.ok(app.click('Save changes'), 'no Save changes button');
    await app.settle();

    // 🔴 THE LOAD-BEARING ASSERTION.
    assert.match(app.text(), /These two boxes are a guess/,
      'the guessed-name mark was cleared over a write that was REFUSED. The record now reads as ' +
      'though a human confirmed the first/last boundary when nothing was saved — and the identity ' +
      'fingerprint downstream will trust that boundary. This is worse than a missing toast.');
    assert.ok(app.click === app.click && [...W.document.querySelectorAll('button')]
      .some((b) => /Save changes/.test(b.textContent || '')),
      'the editor closed on a refusal, so the operator\'s unsaved values vanished with it');
    assert.match(app.text(), /NOT saved/,
      'the refusal is silent — the operator has no way to learn the edit did not land');

    W.HW.MEMBERS.push(gone);
  });
});

test('...and an ACCEPTED member edit still clears the mark and closes the editor', async () => {
  /* The refusal fix must not have cost the success path. Without this, deleting
   * the clear-and-close entirely would leave the test above green. */
  await withApp('pos', async (app) => {
    const W = app.window;
    await openMemberPage(app, 'Manisha Saini');
    assert.ok(app.click('Edit member'), 'no Edit member button');
    await app.settle();
    assert.ok(app.click('Save changes'), 'no Save changes button');
    await app.settle();

    assert.ok(!/These two boxes are a guess/.test(app.text()),
      'a SAVED edit must clear the guessed mark — the operator confirmed the split and the ' +
      'record now holds two real columns');
    assert.equal(W.HW.MEMBERS.find((m) => m.id === 'm2').first_name, 'Manisha',
      'the accepted write did not reach the record');
    assert.ok(!/NOT saved/.test(app.text()), 'a successful save reported a failure');
  });
});

/** Set a controlled input's value the way React will notice. */
function setValue(app, el, value) {
  Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
/** A CIField is a labelled input with no placeholder — found by its label. */
function fieldByLabel(app, label) {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
}

test('a REFUSED check-in does not close the modal as though it worked', async () => {
  /* ⚠️ THIS IS THE SITE ANOTHER AGENT WAS POINTED AT AS THE GOOD EXAMPLE, and
   * it was throwing the refusal away like the rest. It calls addCheckIn — so it
   * looked right next to the register, which called nothing — but addCheckIn
   * returns null when the payload carries no customer, and the modal closed on
   * that branch too. A flow that completes and writes nothing is the exact
   * defect the comment directly above that call site describes.
   *
   * The refusal is forced at the store because the modal's own gating stops a
   * customer-less payload from being submitted, so the null return cannot be
   * reached by typing — which is precisely why it went unnoticed. The SCREEN's
   * handling of that null is what is under test. */
  await withApp('pos', async (app) => {
    const W = app.window;
    await app.mount('MembersScreen');
    const checkins0 = W.HW.CHECKINS.length;

    assert.ok(app.click('New check-in'), 'the New check-in tile did not exist');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'no ID scanner in the check-in modal');
    await new Promise((r) => setTimeout(r, 900));
    await app.settle();
    const first = fieldByLabel(app, 'First name');
    assert.ok(first, 'the scan did not open the new-customer form');
    setValue(app, first, 'Refused');
    await app.settle();
    setValue(app, fieldByLabel(app, 'Last name'), 'Probe');
    await app.settle();
    assert.ok(app.click('Create customer'), 'no Create customer button');
    await app.settle();

    W.HW.addCheckIn = () => null;             // the store declines the payload
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    assert.equal(W.HW.CHECKINS.length, checkins0,
      'precondition: the refused check-in must not have been written');
    assert.ok(app.click('Check in') !== false,
      'the modal CLOSED over a check-in the store refused. The operator watched the flow ' +
      'complete and walked away believing someone was on the waiting board who is not on it — ' +
      'and with no CHECKINS row the sale cannot later settle that visit, so a served customer ' +
      'and a walk-out stay indistinguishable');
  });
});

test('...and a check-in the store ACCEPTS still closes the modal', async () => {
  /* The counterpart, and it is not ceremony: with the guard mutated to refuse
   * ALWAYS, the check-in row is still written (addCheckIn runs before the
   * guard), so every existing assertion in member-flows.test.mjs stays green
   * and the only symptom is a modal that never closes over a check-in that
   * worked. Nothing in the suite covered that until this test. */
  await withApp('pos', async (app) => {
    const W = app.window;
    await app.mount('MembersScreen');
    const checkins0 = W.HW.CHECKINS.length;

    assert.ok(app.click('New check-in'), 'the New check-in tile did not exist');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'no ID scanner in the check-in modal');
    await new Promise((r) => setTimeout(r, 900));
    await app.settle();
    setValue(app, fieldByLabel(app, 'First name'), 'Accepted');
    await app.settle();
    setValue(app, fieldByLabel(app, 'Last name'), 'Probe');
    await app.settle();
    assert.ok(app.click('Create customer'), 'no Create customer button');
    await app.settle();
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    assert.equal(W.HW.CHECKINS.length, checkins0 + 1, 'the accepted check-in was not written');
    assert.equal(app.click('Check in'), false,
      'the modal stayed open over a check-in that SUCCEEDED — the refusal guard swallowed the ' +
      'success path, and the operator is left re-submitting a person who is already on the board');
  });
});

test('a REFUSED Weedmaps unlink does not dismiss the confirmation', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    await openMemberPage(app, 'Manisha Saini');
    W.HW.setWmLink('m2', true);
    await app.settle();
    if (!app.click((t) => /Unlink Weedmaps identity/.test(t))) {
      assert.fail('no "Unlink Weedmaps identity" control on the member page');
    }
    await app.settle();
    assert.match(app.text(), /Unlink .* from Weedmaps\?/, 'the confirmation did not open');

    const idx = W.HW.MEMBERS.findIndex((m) => m.id === 'm2');
    const [gone] = W.HW.MEMBERS.splice(idx, 1);
    assert.ok(app.click('Unlink'), 'no Unlink button in the confirmation');
    await app.settle();

    assert.match(app.text(), /NOT unlinked/,
      'the unlink was refused and the operator was told nothing. The next Weedmaps order still ' +
      'lands on this profile automatically — the exact behaviour they just acted to stop');
    W.HW.MEMBERS.push(gone);
  });
});

test('lane settings the store REFUSES do not close the modal over an unchanged fee', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    W.HW.resetLaneSettings();
    const before = W.HW.laneSettings().expressMinimum;

    await app.mount('SettingsScreen');
    // The Card is a div with an onClick, not a button — app.click() only reaches
    // button/a/[data-hw-i], so it needs its own dispatch.
    const card = [...W.document.querySelectorAll('div')]
      .find((d) => (d.textContent || '').trim().startsWith('Delivery Management'));
    assert.ok(card, 'no "Delivery Management" settings card');
    card.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    assert.match(app.text(), /Minimums and fees/, 'the lane modal did not open');

    /* ⚠️ THE REFUSAL IS FORCED AT THE STORE, and that is the honest way to test
     * it. The Save button's own `bad` check screens for the same condition
     * setLaneSettings does, so today the null return CANNOT be reached by
     * typing — which is exactly why the screen's handling of it was never
     * exercised and the modal closed over a refused write for as long as it
     * did. The two checks agree only by coincidence of the form currently
     * holding the same four keys setLaneSettings iterates; they walk DIFFERENT
     * key sets, so a fifth lane figure added to one and not the other re-opens
     * the hole silently. This pins the screen's behaviour now, so that day is
     * a green test rather than a closed modal. */
    W.HW.setLaneSettings = () => null;
    assert.ok(app.click((t) => /^Save/.test(t)), 'no Save control in the lane modal');
    await app.settle();

    assert.match(app.text(), /Minimums and fees/,
      'the modal CLOSED over a write the store refused — the operator watched it accept their ' +
      'figures and walked away believing the lanes had moved');
    assert.match(app.text(), /the store refused these figures/,
      'the refusal is silent; the operator has no way to learn the fees are unchanged');
    assert.equal(W.HW.laneSettings().expressMinimum, before, 'a refused write still moved the figure');
  });
});

test('...and lane settings the store ACCEPTS still close the modal', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    W.HW.resetLaneSettings();
    await app.mount('SettingsScreen');
    const card = [...W.document.querySelectorAll('div')]
      .find((d) => (d.textContent || '').trim().startsWith('Delivery Management'));
    assert.ok(card, 'no "Delivery Management" settings card');
    card.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    assert.ok(app.click((t) => /^Save/.test(t)), 'no Save control in the lane modal');
    await app.settle();
    assert.ok(!/Minimums and fees/.test(app.text()),
      'an ACCEPTED save no longer closes the modal — the refusal guard swallowed the success path');
    assert.ok(!/the store refused/.test(app.text()), 'a successful save reported a refusal');
  });
});

/* The swap flow is driven through the real sheet, the way driver-governed-swap
 * .test.mjs drives it. Only the STORE BOUNDARY is stubbed, and only to make it
 * take a refusal path it takes in production but cannot be steered into from
 * the UI: addSubRecord returns null for a record with no id, and again for an
 * id already on file. Same precedent as driver-honesty.test.mjs, which stubs
 * localStorage.setItem to throw. The screen's handling of that null is the
 * thing under test; everything else is the genuine article. */
function mounter(app) {
  const W = app.window;
  W.MTopBar = ({ title, sub }) => W.React.createElement('div', null, String(title || '') + ' ' + String(sub || ''));
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (taskId) => {
    close();
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.TaskScreen, { taskId }));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}
const inSheet = (label) => (t, el) => t === label && !!el.closest('[data-hw-sheet="swap"]');
const byTitle = (title) => (t, el) => el.getAttribute && el.getAttribute('title') === title;
const basketSig = (W, id) => W.M.itemsFor(id, W.MD.TASKS.find((t) => t.id === id).items)
  .map((i) => i.sku + ':' + i.qty).join(',');

/** Open the sheet on t3's second line and commit a cheaper swap to MMG100E. */
async function driveSwap(app, open) {
  await open('t3');
  assert.ok(app.click('Swap', { nth: 1 }), 'no Swap control on line 1 of t3');
  await app.settle();
  assert.ok(app.click(inSheet('cheaper')), 'no "cheaper" ladder in the sheet');
  await app.settle();
  assert.ok(app.click(byTitle('Swap to MMG100E')), 'MMG100E was not offered');
  await app.settle();
  assert.ok(app.click(inSheet('The customer agreed to this swap')), 'no consent control');
  await app.settle();
  assert.ok(app.click(inSheet('Confirm swap')), 'no confirm control');
  await app.settle();
}

test('a swap the ledger REFUSED is not reported to the driver as a swap', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      const before = basketSig(W, 't3');
      // Nothing is filed: the record reaches the store and the store declines it.
      W.HW.addSubRecord = () => null;
      await driveSwap(app, open);

      assert.match(W.M.s.toast.msg, /NOT recorded/,
        'the driver was told "Swapped to <product>" over a record the store never filed. Stock ' +
        'has left the bag with no paper behind it, so the van reconciles short at count-out and ' +
        'there is nothing to reconcile against');
      assert.equal(basketSig(W, 't3'), before,
        'the basket was rebuilt for a swap that was REFUSED. The screen and the store now ' +
        'disagree about what is in the bag, and the close-out collects on the wrong figure — ' +
        'which is the money bug the ordering of this handler exists to avoid');
    } finally { open.close(); }
  });
});

test('...and a swap the ledger ACCEPTS is still confirmed and still rebuilds the basket', async () => {
  /* Without this, deleting the whole handler body would leave the test above
   * green — a refusal test alone cannot tell "correctly refused" from "does
   * nothing at all". */
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      await driveSwap(app, open);
      assert.match(W.M.s.toast.msg, /^Swapped to /,
        'an accepted swap must still confirm — the refusal branch swallowed the success path');
      assert.ok(basketSig(W, 't3').includes('MMG100E'),
        'the accepted swap never reached the basket');
      assert.ok(W.HW.allSubRecords().length > 0, 'the accepted record never reached the store');
    } finally { open.close(); }
  });
});

test('...and a RE-COMMIT of a record already on file is not called a failure', async () => {
  /* ⚠️ THE TWO NULLS ARE NOT THE SAME EVENT, which is why the handler does not
   * collapse them into one `if (!filed)`. addSubRecord is idempotent by the
   * engine's own record id, so a double-tap returns null for a swap that really
   * did happen. Reporting THAT as "nothing was filed" would have replaced the
   * old lie with a new one and sent the driver looking for a problem that does
   * not exist. The store is stubbed to report the record already present —
   * exactly the condition the real store hits on a re-commit. */
  await withApp('driver', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      W.HW.addSubRecord = () => null;          // declined: already on file
      W.HW.subRecords = () => ({ some: () => true });
      await driveSwap(app, open);

      assert.match(W.M.s.toast.msg, /Already swapped/,
        'a re-commit of a record already on file was reported as a failure. The swap DID ' +
        'happen; only the second filing was declined');
      assert.ok(!/NOT recorded/.test(W.M.s.toast.msg),
        'an idempotent re-file must never read as a lost record');
      assert.ok(basketSig(W, 't3').includes('MMG100E'),
        'the basket must still reflect the swap that genuinely happened');
    } finally { open.close(); }
  });
});

/* ══ THE SITES THAT ARE NOT MEMBERS OF THIS FAMILY ═════════════════════════
 *
 * Handed over as part of the ten. Each was checked and each writer CANNOT
 * refuse, so there is no discarded refusal to honour. Pinning that here is the
 * point: the next sweep will re-find these call sites, see an unchecked return
 * and "fix" them by inventing a failure branch that can never run — which
 * costs a reader's attention every time they meet it and proves nothing.
 */
test('the three sites left alone have writers that genuinely cannot refuse', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;

    // pos/screen-stubs.jsx:110 — addMember is a constructor, not a validator.
    // It always builds a record. There is no null to check.
    const made = HW.addMember({ name: 'Probe Person' });
    assert.ok(made && made.id, 'addMember refused — it now HAS a refusal path, so its call sites ' +
      'in pos/screen-stubs.jsx must start honouring it');
    const idx = HW.MEMBERS.findIndex((m) => m.id === made.id);
    HW.MEMBERS.splice(idx, 1);
  });

  await withApp('driver', async (app) => {
    const M = app.window.M;
    // mobile/screen-msg.jsx:71 — saveTemplate always writes and returns nothing.
    const n = M.templates().length;
    M.saveTemplate({ label: 'Probe', body: 'x' });
    assert.equal(M.templates().length, n + 1, 'saveTemplate stopped writing unconditionally');

    // mobile/screen-profile.jsx:193 — submitPhone always writes.
    M.submitPhone('(555) 555-1234');
    assert.equal(M.profile().pendingPhone, '(555) 555-1234', 'submitPhone stopped writing');
  });
});

/* pweb/week.jsx:245 is the fourth. `pin`, `rot` and `reset` are React setState
 * updaters over local view state — no store, no return value, nothing that can
 * refuse. It is not this defect; there is nothing there to assert against. */
