/* ══ THE REGISTER'S MEMBER PANEL MAY NOT INVENT A DOCUMENT ══════════════════
 *
 * pos/screen-register.jsx declared three photo tiles as a CONSTANT and rendered
 * them for every member, with nothing anywhere checking that a photo existed:
 *
 *     const photos = [
 *       { id: 'front',  label: 'License · front', hue: 210, glyph: 'card' },
 *       { id: 'selfie', label: 'Selfie match',    hue: 150, glyph: 'user' },
 *       { id: 'med',    label: 'Medical card',    hue:  90, glyph: 'shield' }];
 *     …
 *     {photos.map((p2) => <PhotoCard key={p2.id} p2={p2} />)}
 *
 * Each was a coloured gradient with an icon, captioned as a document on file
 * and clickable into an "Enlarge" lightbox. 'Selfie match' drew <Avatar
 * name={m.name}/> — a blob generated from the CUSTOMER'S OWN NAME — under a
 * label asserting a biometric comparison that nothing in this estate performs.
 * The panel eleven lines to the right printed "number not on file" when the
 * licence number was missing: scrupulous about its text, inventing its images.
 *
 * ⚠️ WHY THESE ASSERTIONS ARE ABOUT RENDERED TEXT AND STRUCTURE, NOT SOURCE.
 * A grep for the array proves the literal is gone and proves nothing about what
 * the operator reads. The whole failure mode is that the screen looks right, so
 * these boot the real .jsx and read the DOM.
 *
 * ⚠️ AND THE LOAD-BEARING ONE IS "THE UNCONDITIONAL RENDER GOES RED". A check
 * that only fires once someone deletes the array is a check that would never
 * have caught this. The mutation register at the foot of this file restores the
 * original `photos.map(...)` verbatim and records which assertions failed.
 *
 * WHAT THIS FILE CANNOT TELL YOU: whether the capture strip fits beside a
 * 196px licence card in the register's full-width dropdown. jsdom has no
 * layout. That was checked in a real browser at 1440 and 1024.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';
import { createPortal } from 'react-dom';

/* react-dom/client has no createPortal and this panel's order modal wants one;
 * without it a render error would blank the body and every assertion below
 * would pass vacuously. Same shim as test/fabricated-numbers.test.mjs. */
function withPortals(app) {
  if (typeof app.window.ReactDOM.createPortal !== 'function') {
    app.window.ReactDOM.createPortal = createPortal;
  }
  return app;
}

/* A mounter that KEEPS THE ROOT so props can be swapped on the SAME instance.
 * The register does exactly this — one <MemberDetails> re-pointed at whichever
 * customer is loaded — and a helper that unmounts between renders would hide
 * the one bug that shape produces. */
function panel(app) {
  const W = app.window;
  const host = W.document.createElement('div');
  W.document.body.appendChild(host);
  const root = W.ReactDOM.createRoot(host);
  const show = async (customer) => {
    assert.equal(typeof W.MemberDetails, 'function',
      `MemberDetails is not on the page — errors: ${app.errors.join(' | ') || '(none)'}`);
    root.render(W.React.createElement(W.MemberDetails, { customer, guests: [], onClose() {} }));
    await app.settle(); await app.settle();
    return String(host.textContent || '').replace(/\s+/g, ' ').trim();
  };
  show.host = host;
  show.close = () => { try { root.unmount(); } catch { /* gone */ } host.remove(); };
  return show;
}

/** A File in the JSDOM realm, the way test/id-photos.test.mjs builds one. */
function makeFile(app, name, type = 'image/jpeg') {
  return new app.window.File([new app.window.Uint8Array(1)], name, { type });
}

/** Drop a file on the hidden picker inside the panel, exactly as a picker does. */
function attach(app, host, file) {
  const el = host.querySelector('input[data-hw-idphoto="file"]');
  assert.ok(el, 'the shared capture control is not in the member panel — ' +
    'no input[data-hw-idphoto="file"]. Either it was never adopted, or this ' +
    'panel forked its own copy, which is the drift shared/id-photos.jsx exists ' +
    'to prevent.');
  Object.defineProperty(el, 'files', { value: [file], configurable: true });
  el.dispatchEvent(new app.window.Event('change', { bubbles: true }));
}

const labels = (host) => [...host.querySelectorAll('button')]
  .map((b) => String(b.textContent || '').trim());

/* A member the ID ledger knows nothing about — no scan, no phone check, no
 * remote check. The panel's claims about this person are the ones that were
 * pure invention. */
const ghost = (W) => ({ ...W.HW.MEMBERS[0], id: 'no-such-idv-row', name: 'Nobody Scanned' });

/* ── 1 · THE UNCONDITIONAL RENDER ───────────────────────────────────────── */

test('a member with no photo on file gets no document tile — the tile IS the claim', async () => {
  await withApp('pos', async (app) => {
    const show = panel(withPortals(app));
    try {
      const t = await show(ghost(app.window));
      assert.ok(t.length > 200, 'the member panel actually rendered');

      // The three captions, each of which asserted a document exists.
      assert.ok(!/License · front/.test(t),
        'a "License · front" tile is rendered for a customer whose ID ledger holds ' +
        'nothing. The tile is the claim: an operator points at it to show the ID was checked.');
      assert.ok(!/Selfie match/.test(t),
        'a "Selfie match" tile is on screen. Nothing in this estate performs a face ' +
        'comparison — no vendor, no score, no threshold — so this label cannot be true ' +
        'for any customer, on any build, today.');
      // The Panel TITLE "Medical card" is legitimate and stays; what may not
      // exist is a captioned image tile of a card, so this asserts on the
      // control that made it one — the Enlarge affordance.
      assert.ok(!/Enlarge/.test(t),
        'a photo tile still offers "Enlarge". There is no image in this build to ' +
        'magnify, so the affordance can only be sitting on a fabricated one.');

      // And structurally: no image element at all when nothing was captured.
      assert.equal(show.host.querySelectorAll('img').length, 0,
        'the panel rendered an <img> for a member with no captured photo');
    } finally { show.close(); }
  });
});

test('the absence is SAID, not left blank', async () => {
  await withApp('pos', async (app) => {
    const show = panel(withPortals(app));
    try {
      const t = await show(ghost(app.window));
      assert.ok(/No ID photos attached/.test(t),
        'nothing on screen says the customer has no ID photos. A silent gap where a ' +
        'document tile used to be reads as "not loaded yet", which is the ambiguity ' +
        'the licence row beside it already refuses ("number not on file").');
    } finally { show.close(); }
  });
});

/* ── 2 · NONE ON FILE ≠ ON FILE BUT UNVIEWABLE ───────────────────────────── */

test('an attached photo that cannot be drawn never reads as no photo at all', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const show = panel(withPortals(app));
    try {
      const before = await show(ghost(W));
      assert.ok(/No ID photos attached/.test(before), 'the empty state is the starting point');

      // (i) THE BROWSER GIVES US NO PREVIEW URL. iOS HEIC lands here.
      const realCreate = W.URL.createObjectURL;
      W.URL.createObjectURL = () => { throw new Error('no object URLs here'); };
      attach(app, show.host, makeFile(W, 'licence-front.heic', 'image/heic'));
      await app.settle();
      const noPreview = String(show.host.textContent || '').replace(/\s+/g, ' ').trim();

      assert.ok(!/No ID photos attached/.test(noPreview),
        'a photo IS attached and the panel still says none are. The operator believes ' +
        'nothing was captured and re-takes it, or worse, records that none exists.');
      assert.ok(/licence-front\.heic/.test(noPreview),
        'the attached file is not named on screen, so the operator cannot tell WHAT is held');
      assert.ok(/Attached · no preview/.test(noPreview),
        'an attached photo with no preview URL must say it is attached and undrawable. ' +
        'An empty box would be indistinguishable from nothing being there.');
      assert.ok(!/would not load/.test(noPreview),
        '"no preview available" and "the image failed to decode" are different facts ' +
        'and were rendered as the same one');

      // (ii) A URL WE DID GET, AND THE IMAGE WOULD NOT DECODE. Different alarm.
      W.URL.createObjectURL = () => 'blob:hw-test/decodes-badly';
      attach(app, show.host, makeFile(W, 'licence-back.jpg', 'image/jpeg'));
      await app.settle();
      const img = [...show.host.querySelectorAll('img')]
        .find((n) => n.getAttribute('src') === 'blob:hw-test/decodes-badly');
      assert.ok(img, 'a photo with a usable preview URL did not render an <img>');
      img.dispatchEvent(new W.Event('error', { bubbles: false }));
      await app.settle();
      const failed = String(show.host.textContent || '').replace(/\s+/g, ' ').trim();

      assert.ok(/Attached · would not load/.test(failed),
        'a photo that is on the record and would not decode renders as if it were fine, ' +
        'or as if it were absent. It is neither — the operator believes something is ' +
        'filed and cannot see what.');
      assert.ok(!/No ID photos attached/.test(failed), 'two attached photos still read as none');
      W.URL.createObjectURL = realCreate;
    } finally { show.close(); }
  });
});

/* ── 3 · THE PANEL IS RE-POINTED, NOT REMOUNTED ──────────────────────────── */

test("one customer's ID photos never follow the operator to the next customer", async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const show = panel(withPortals(app));
    try {
      const a = { ...W.HW.MEMBERS[0], id: 'photo-owner-a', name: 'Ada Owner' };
      const b = { ...W.HW.MEMBERS[0], id: 'photo-owner-b', name: 'Bo Other' };

      await show(a);
      attach(app, show.host, makeFile(W, 'ada-licence.jpg'));
      await app.settle();
      assert.ok(/ada-licence\.jpg/.test(show.host.textContent), 'the photo attached to Ada');

      const onB = await show(b);
      assert.ok(!/ada-licence\.jpg/.test(onB),
        "Ada's licence photograph is displayed under Bo's name. The register mounts ONE " +
        'MemberDetails and swaps the customer under it, so a list held in plain component ' +
        'state follows the operator — a compliance artefact filed against the wrong human.');
      assert.ok(/No ID photos attached/.test(onB),
        'the next customer must start from the honest empty state');

      const backOnA = await show(a);
      assert.ok(/ada-licence\.jpg/.test(backOnA),
        'the photo was lost on returning to the customer it was taken for — a deliberate ' +
        'capture must not be destroyed by navigation');
    } finally { show.close(); }
  });
});

/* ── 4 · NO CONTROL PROMISES WHAT THE BUILD CANNOT DO ────────────────────── */

test('every image control on the panel is the real capture, not a lightbox wearing its label', async () => {
  await withApp('pos', async (app) => {
    const show = panel(withPortals(app));
    try {
      await show(ghost(app.window));
      const btns = labels(show.host);

      assert.ok(!btns.includes('Update image'),
        '"Update image" is back. Its only effect was setLb(photos[0]) — it opened a ' +
        'lightbox of the fabricated tile. A button that names a capture must perform one.');
      assert.ok(!btns.some((l) => /Replace image/.test(l)),
        '"Replace image" is back. It carried no onClick AT ALL: a primary accent button ' +
        'on a compliance modal that did nothing when pressed.');
      assert.ok(!btns.includes('View card'),
        '"View card" is back. It opened the third fabricated tile; no medical-card image ' +
        'is stored anywhere in this build.');

      assert.ok(btns.includes('Add photo') && btns.includes('Take photo'),
        'the real capture controls are missing — the panel has no way to attach a photo, ' +
        'which is how it ended up displaying ones nobody took');
    } finally { show.close(); }
  });
});

test('the panel states where the photos go, and does not overclaim it', async () => {
  await withApp('pos', async (app) => {
    const show = panel(withPortals(app));
    try {
      const t = await show(ghost(app.window));
      // ONE storage sentence, owned by shared/id-photos.jsx, rendered verbatim.
      // Asserted as the SHARED constant rather than as copy pinned here: a
      // second literal in a second file is the drift this adoption prevents.
      const line = app.window.HWIdPhotos && app.window.HWIdPhotos.STORAGE.line;
      assert.ok(line, 'shared/id-photos.jsx did not load');
      assert.ok(t.includes(line.replace(/\s+/g, ' ').trim()),
        'the storage sentence from shared/id-photos.jsx is not on screen. It is the one ' +
        'line that says nothing is uploaded and nothing is filed against the customer, ' +
        'and a capture control without it overclaims persistence on a compliance record.');
      assert.ok(!/saved|uploaded to|filed against/i.test(t.replace(line, '')),
        'something outside the shared sentence claims these images are saved');
    } finally { show.close(); }
  });
});

/* ── 5 · THE GREEN TICK IN THE HEADER ────────────────────────────────────── */

test('"ID VERIFIED" is not printed over every customer who happens to be open', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const show = panel(withPortals(app));
    try {
      const unseen = await show(ghost(W));
      assert.ok(!/ID VERIFIED/i.test(unseen),
        'a green "ID VERIFIED" tick is printed for a customer the identity ledger has ' +
        'never seen. It was hardcoded beside the invented photo tiles — the same ' +
        'fabrication in eleven characters, and the badge an operator would point at.');
      assert.ok(/Unverified/.test(unseen),
        'the header must say what the ledger actually holds for this person');

      // …and a member with a real scanned document reads differently.
      const m1 = W.HW.MEMBERS.find((x) => x.id === 'm1');
      assert.ok(m1 && W.HW.IDV.m1 && W.HW.IDV.m1.doc, 'fixture changed: m1 has no scanned document');
      const scanned = await show(m1);
      assert.ok(!/Unverified/.test(scanned),
        'a customer with a scanned document on file reads the same as one with nothing — ' +
        'the badge is not reading the ledger');
      assert.ok(/ID on file/.test(scanned),
        'the tier the assurance ladder derives is what the header shows');
    } finally { show.close(); }
  });
});

/* ══ MUTATION REGISTER ══════════════════════════════════════════════════════
 *
 * Every assertion above was broken deliberately, run red, and restored. The
 * restore of pos/screen-register.jsx was verified byte-identical by sha256
 * after each one. Recorded in the agent report; the load-bearing entry is the
 * FIRST, because it is the check that would have caught the original defect:
 *
 *   M1  restore the constant `photos` array and `{photos.map(…)}` verbatim
 *       → RED: "a member with no photo on file gets no document tile"
 *              (License · front, Selfie match, Enlarge all reappear)
 *   M2  render <Avatar name={m.name}/> under a "Selfie match" caption again
 *       → RED: same test, Selfie match assertion
 *   M3  drop the member-id key — hold `captured` in plain component state
 *       → RED: "one customer's ID photos never follow the operator"
 *   M4  collapse preview 'failed' and 'unavailable' onto one caption
 *       → RED: "an attached photo that cannot be drawn never reads as no photo"
 *   M5  restore the "Update image" / "Replace image" / "View card" buttons
 *       → RED: "every image control on the panel is the real capture"
 *   M6  restore the hardcoded green "ID VERIFIED" span
 *       → RED: '"ID VERIFIED" is not printed over every customer'
 *   M7  render the capture control without the shared storage sentence
 *       → RED: "the panel states where the photos go"
 *   M8  never render the adopted control, so no empty state is ever drawn
 *       → RED: "the absence is SAID, not left blank" (+4 others)
 */
