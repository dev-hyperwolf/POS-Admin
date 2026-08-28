/* ══ PHOTOS OF THE ID / PASSPORT ════════════════════════════════════════════
 *
 * shared/id-photos.jsx is a COMPLIANCE surface. This flow has already shipped
 * invented data once — a scan that returned no name silently filled in
 * 'Jordan A. Vasquez' and '09/02/1988' — and an invented IMAGE would be that
 * defect with a camera bolted on. So the assertions below are aimed at the
 * three claims that can be false in a way nobody notices:
 *
 *   · that a photo exists                (fabrication)
 *   · that a photo is VIEWABLE           ("no photo" vs "photo, broken preview")
 *   · that a photo is STORED somewhere   (overclaiming persistence)
 *
 * Every assertion here has a matching mutation aimed at it; see the register at
 * the foot of this file for what was broken, what went red, and the sha256 that
 * proves the restore was byte-identical.
 *
 * WHAT THIS FILE CANNOT TELL YOU: whether a 104px thumbnail strip fits under an
 * already-crowded card in a 560px modal. jsdom has no layout. That was checked
 * in a real browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** A File in the JSDOM realm. `bytes` controls size without allocating it. */
function makeFile(app, name, type, bytes = 1024) {
  const f = new app.window.File([new app.window.Uint8Array(1)], name, { type });
  // File.size is derived from the parts and is read-only; overriding it is how
  // the size rule gets tested without building an 8 MB buffer in a unit test.
  Object.defineProperty(f, 'size', { value: bytes, configurable: true });
  return f;
}

/** Drop files onto one of the two hidden inputs, exactly as a picker would. */
function attach(app, files, which = 'file') {
  const el = app.document.querySelector(`input[data-hw-idphoto="${which}"]`);
  assert.ok(el, `no [data-hw-idphoto="${which}"] input on screen`);
  Object.defineProperty(el, 'files', { value: files, configurable: true });
  el.dispatchEvent(new app.window.Event('change', { bubbles: true }));
}

/** Mount the control on its own, with the test holding the list. */
async function mountCapture(app, { docKey = null } = {}) {
  const R = app.window.React;
  app.window.__photos = [];
  app.window.__docKey = docKey;
  app.window.__CaptureProbe = function CaptureProbe() {
    const [list, setList] = R.useState([]);
    app.window.__photos = list;
    return R.createElement(app.window.IdPhotoCapture, {
      photos: list, onChange: (next) => setList(next), docKey: app.window.__docKey });
  };
  await app.mount('__CaptureProbe');
}

/* ── 1. the admission rules, pure ────────────────────────────────────────── */

test('a refusal names the file and the actual value — never "invalid file"', async () => {
  await withApp('pos', async (app) => {
    const H = app.window.HWIdPhotos;
    assert.ok(H, 'shared/id-photos.jsx did not load — window.HWIdPhotos is missing');

    // WRONG KIND. The sentence has to carry the filename and what the file
    // actually is, or the operator is guessing at a counter with a queue.
    const mov = H.accept(makeFile(app, 'clip.mov', 'video/quicktime'), []);
    assert.equal(mov.ok, false, 'a video was accepted as a photo of an ID');
    assert.match(mov.reason, /clip\.mov/, 'the refusal does not name the file it refused');
    assert.match(mov.reason, /video\/quicktime/,
      'the refusal must quote the type the file actually declared — "unsupported file" ' +
      'tells the operator nothing they can act on');

    // TOO BIG. Both numbers, because "too large" without the limit is a riddle.
    const big = H.accept(makeFile(app, 'front.jpg', 'image/jpeg', 14.2 * 1024 * 1024), []);
    assert.equal(big.ok, false, 'a 14 MB file passed an 8 MB limit');
    assert.match(big.reason, /14\.2 MB/, 'the refusal does not say how big the file actually is');
    assert.match(big.reason, /8\.0 MB/, 'the refusal does not say what the limit is');

    // EMPTY IS NOT SMALL. A 0-byte file is a failed transfer; letting it
    // through as "comfortably under the limit" files a photo nobody can open.
    const empty = H.accept(makeFile(app, 'back.jpg', 'image/jpeg', 0), []);
    assert.equal(empty.ok, false, 'a 0-byte file was accepted');
    assert.match(empty.reason, /0 bytes/,
      'an empty file must be refused AS EMPTY. "0 bytes" is the fact; a size-limit ' +
      'sentence would be the wrong diagnosis of the right refusal');

    // THE COUNT. Named, with the number.
    const full = [1, 2, 3, 4].map((i) => ({ id: 'p' + i }));
    const fifth = H.accept(makeFile(app, 'extra.jpg', 'image/jpeg'), full);
    assert.equal(fifth.ok, false, 'the fifth photo was accepted past a limit of four');
    assert.match(fifth.reason, /4 photos/, 'the count refusal does not say what the limit is');

    // AND THE HONEST YES.
    assert.equal(H.accept(makeFile(app, 'front.jpg', 'image/jpeg'), []).ok, true,
      'a plain 1 KB JPEG was refused — the rules are now refusing real counter photos');
  });
});

test('an empty MIME type falls back to the extension; a declared one that is wrong does NOT', async () => {
  await withApp('pos', async (app) => {
    const H = app.window.HWIdPhotos;
    // iOS Safari hands back an empty `type` for HEIC. Refusing it would refuse
    // the default format of the devices this counter actually runs on.
    assert.equal(H.accept(makeFile(app, 'IMG_0042.HEIC', ''), []).ok, true,
      'HEIC with no declared type was refused — that is what an iPad hands over');

    // The other direction is the security-shaped one: the browser TOLD us what
    // this is, and a `.jpg` on the end must not overrule it.
    const lie = H.accept(makeFile(app, 'id.jpg', 'application/pdf'), []);
    assert.equal(lie.ok, false,
      'a file declaring application/pdf was accepted because its NAME ended .jpg — the ' +
      'extension is a fallback for when the browser said nothing, never an override of ' +
      'what it did say');

    // Nothing readable from either source is a refusal, not a shrug.
    const blind = H.accept(makeFile(app, 'scan', ''), []);
    assert.equal(blind.ok, false, 'a file with no type AND no extension was waved through');
    assert.match(blind.reason, /no readable image type/,
      'the refusal must say WHY it could not tell, not just that it would not take it');
  });
});

/* ── 2. a photo remembers which document it was taken alongside ──────────── */

test('a re-scan does not delete the photos — it makes them say they no longer match', async () => {
  await withApp('pos', async (app) => {
    const H = app.window.HWIdPhotos;
    const A = H.docKeyOf({ type: 'CA DL', num: '••••4821', scannedAt: 'Just now' });
    const B = H.docKeyOf({ type: 'CA DL', num: '••••7730', scannedAt: 'Just now' });
    assert.notEqual(A, B, 'two different documents produced the same key — the stamp is useless');
    assert.equal(H.docKeyOf(null), null, 'no document must key as null, not as a string');

    assert.equal(H.docNote({ docKey: A }, A), null,
      'a photo attached to the document still on screen must say nothing at all');

    // The hazard, concretely: scan Marcus, photograph Marcus, Re-scan, scan
    // somebody else, Create. The photo may not travel silently.
    const swapped = H.docNote({ docKey: A }, B);
    assert.ok(swapped, 'a photo attached to a DIFFERENT document said nothing');
    assert.match(swapped, /different document/,
      'the note must name what actually changed, so the operator can decide');

    const dropped = H.docNote({ docKey: A }, null);
    assert.ok(dropped, 'the document was discarded and the photos still claimed to match it');
    assert.match(dropped, /discarded/, 'a discarded document must be named as discarded');

    const before = H.docNote({ docKey: null }, A);
    assert.ok(before, 'a photo attached before any scan said nothing once a document arrived');
    assert.match(before, /before this document was scanned/,
      '"taken before the scan" and "taken alongside a different scan" are different facts ' +
      'and must not share a sentence');
  });
});

test('one warning about two photos is said ONCE, names both files, and still flags each tile', async () => {
  await withApp('pos', async (app) => {
    const H = app.window.HWIdPhotos;
    // The short flag and the full sentence are the same four branches, so they
    // cannot disagree about whether there is anything wrong.
    const A = H.docKeyOf({ type: 'CA DL', num: '••••4821', scannedAt: 'Just now' });
    assert.equal(H.docFlag({ docKey: A }, A), null, 'a matching photo is flagged anyway');
    assert.equal(H.docFlag({ docKey: A }, null), 'Document discarded');
    assert.equal(H.docFlag({ docKey: null }, A), 'Taken before this scan');
    assert.equal(H.docFlag({ docKey: A }, 'other'), 'Different document');

    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await checkInAtNewCustomer(app, DOC_A);
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg'), makeFile(app, 'back.jpg', 'image/jpeg')]);
    await app.settle();
    assert.ok(app.click('STUB RESCAN'), 'the re-scan control is not reachable');
    await app.settle();

    const t = app.text();
    const sentence = 'The document this photo was attached to has been discarded';
    assert.equal(t.split(sentence).length - 1, 1,
      'the same warning was printed once per photo. Two files sharing one fact is ONE ' +
      'warning — repeating it is how amber text becomes wallpaper and stops being read');
    assert.match(t, /front\.jpg, back\.jpg/,
      'the grouped warning must name the files it is about, or the operator cannot tell ' +
      'which thumbnail it means');
    assert.equal(t.split('Document discarded').length - 1, 2,
      'each affected tile must still carry its own short flag — the grouping is about not ' +
      'repeating the sentence, not about hiding which photos are involved');
  });
});

/* ── 3. absence, unviewable and broken are three different faces ─────────── */

test('no photo renders as an absence — no placeholder, no image element, no alarm', async () => {
  await withApp('pos', async (app) => {
    await mountCapture(app);
    const t = app.text();
    assert.match(t, /No ID photos attached/, 'an empty strip says nothing about being empty');
    assert.match(t, /not an error/,
      'an absence must be marked as expected. Zero photos is a state, not a fault, and ' +
      'dressing it as one trains the operator to ignore the tile that IS a fault');
    assert.equal(app.document.querySelectorAll('img').length, 0,
      'an <img> was rendered with no photo attached — a stock ID or grey silhouette on ' +
      'this card is exactly the invented artefact this flow has been burned by');
  });
});

test('a photo the browser cannot preview reads as ATTACHED, never as absent', async () => {
  await withApp('pos', async (app) => {
    // jsdom has no URL.createObjectURL, which is the real 'unavailable' path:
    // the file is attached and there is no URL to draw it from.
    await mountCapture(app);
    attach(app, [makeFile(app, 'IMG_0042.HEIC', '')]);
    await app.settle();

    const t = app.text();
    assert.equal(app.window.__photos.length, 1, 'the file never reached the list');
    assert.match(t, /Attached · no preview/,
      'a file that is attached but cannot be drawn must SAY it is attached — this is the ' +
      'HEIC case on every desktop browser, and rendering it as blank would tell the ' +
      'operator nothing is on file when something is');
    assert.doesNotMatch(t, /No ID photos attached/,
      '"nothing was captured" and "something was captured that will not draw" are ' +
      'different facts about a compliance artefact and may not share a rendering');
    assert.match(t, /IMG_0042\.HEIC/, 'the attached file is not named on screen');
  });
});

test('a photo whose image FAILS to load is an alarm, and reads differently from one with no preview', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await mountCapture(app);
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();

    const img = app.document.querySelector('img');
    assert.ok(img, 'a previewable photo rendered no <img>');
    assert.equal(img.getAttribute('src'), 'blob:hw-test/front.jpg');

    img.dispatchEvent(new app.window.Event('error', { bubbles: true }));
    await app.settle();

    const t = app.text();
    assert.match(t, /would not load/,
      'an image that failed to decode rendered no alarm — the operator believes a document ' +
      'is on file and cannot see that it is not viewable');
    assert.doesNotMatch(t, /Attached · no preview/,
      '"this browser gave us no URL" and "we had a URL and the image is broken" are two ' +
      'different failures with two different fixes and must not share a tile');
    assert.doesNotMatch(t, /No ID photos attached/,
      'a broken preview is not an absence');
  });
});

test('a HEIC that the browser cannot DRAW is a display limit, not a broken file', async () => {
  await withApp('pos', async (app) => {
    // THIS ONE WAS FOUND IN A BROWSER, NOT IN HERE. jsdom has no
    // URL.createObjectURL, so a HEIC lands on the 'unavailable' path and looks
    // calm. Chrome DOES give a URL, the <img> then fires `error` on the single
    // most likely photo an operator will ever attach — an iPhone shoots HEIC by
    // default — and the tile wore the red "would not load" alarm on the normal
    // path. A false alarm on the common case is how operators learn to ignore
    // the alarm that is real.
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await mountCapture(app);
    attach(app, [makeFile(app, 'IMG_0042.HEIC', ''), makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();

    for (const img of [...app.document.querySelectorAll('img')]) {
      img.dispatchEvent(new app.window.Event('error', { bubbles: true }));
    }
    await app.settle();

    const t = app.text();
    assert.match(t, /no preview \(HEIC\)/,
      'a HEIC that Chrome cannot decode must read as a format this browser cannot draw — ' +
      'naming the format is what tells the operator the file is fine');
    assert.match(t, /would not load/,
      'the genuinely broken JPEG stopped raising its alarm — the point of separating these ' +
      'two is that ONE of them still shouts');
    assert.match(t, /display limit and not a damaged file/,
      'the explanation only appears when there is something to explain, and it was not there');
    assert.equal(app.window.__photos.filter((p) => p.preview === 'failed').length, 2,
      'both files are still attached and still marked unpreviewable — the softer face is ' +
      'about TONE, and must never quietly turn a failure into a success');
  });
});

test('a photo can be removed, and the strip returns to a clean absence', async () => {
  await withApp('pos', async (app) => {
    const revoked = [];
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = (u) => revoked.push(u);
    await mountCapture(app);
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();
    assert.equal(app.window.__photos.length, 1);

    assert.ok(app.click((t, el) => (el.getAttribute('aria-label') || '') === 'Remove front.jpg'),
      'there is no way to remove a photo attached by mistake');
    await app.settle();

    assert.equal(app.window.__photos.length, 0, 'Remove did not remove the photo');
    assert.match(app.text(), /No ID photos attached/,
      'removing the last photo left neither a strip nor an absence');
    assert.deepEqual(revoked, ['blob:hw-test/front.jpg'],
      'a deliberately removed photo must release its Blob URL — this is the ONE place ' +
      'revoking is safe, because the caller is not holding it any more');
  });
});

test('a rejected file is refused on screen, in full, and the good ones in the same batch still land', async () => {
  await withApp('pos', async (app) => {
    await mountCapture(app);
    attach(app, [
      makeFile(app, 'front.jpg', 'image/jpeg'),
      makeFile(app, 'clip.mov', 'video/quicktime'),
    ]);
    await app.settle();

    assert.equal(app.window.__photos.length, 1,
      'one bad file in a multi-select threw away the good one too');
    const t = app.text();
    assert.match(t, /clip\.mov/, 'the refusal never reached the screen');
    assert.match(t, /video\/quicktime/,
      'the on-screen refusal must carry the same detail the pure rule produced — a card ' +
      'that says "1 file rejected" makes the operator retry blind');
  });
});

/* ── 4. what it claims about storage ─────────────────────────────────────── */

test('the card states that nothing is stored, and never claims otherwise', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await mountCapture(app);

    // The disclosure is unconditional — it is on screen with zero photos too,
    // because the operator decides whether to rely on this BEFORE using it.
    const empty = app.text();
    assert.match(empty, /Held in this browser tab only/,
      'the storage disclosure is missing before anything is attached');

    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();

    const t = app.text();
    assert.match(t, /Nothing is uploaded/, 'the card stopped saying that nothing is uploaded');
    assert.match(t, /no server route for ID images/,
      'the disclosure must say WHY nothing is filed, or it reads as a temporary outage');
    assert.doesNotMatch(t, /\b(uploaded to|saved to|stored on|filed to|attached to the record)\b/i,
      'the card claimed the image went somewhere. Overclaiming storage on a compliance ' +
      'artefact is worse than not having the feature');

    const p = app.window.__photos[0];
    assert.equal(p.stored, false,
      'the photo record marks itself stored — nothing in this build stores anything, and a ' +
      'hopeful flag on the record outlives the sentence on the card');
    assert.equal(p.storage, 'memory',
      'the photo must carry WHERE it lives, taken from the one place that knows');
    assert.equal(app.window.HWIdPhotos.STORAGE.mode, 'memory',
      'STORAGE.mode changed without the sentence beside it — that pair is the whole ' +
      'honesty guarantee and it may only move together');
  });
});

/* ── 5. the check-in New-customer form actually uses it ──────────────────── */

/** Drive the real CheckInModal to its New-customer form with a fixed document.
 *  A stub scanner, because IdScanPanel's simulator cycles a pool and a
 *  compliance test may not depend on which face comes up. */
async function checkInAtNewCustomer(app, doc) {
  const R = app.window.React;
  app.window.HW.MEMBERS = [];
  app.window.__created = null;
  app.window.__doc = doc;
  // Two controls, because the real IdScanPanel has two: Scan emits a document
  // and Re-scan emits `null`, and "the document was replaced" and "the document
  // was discarded" are different things to do to photos already attached.
  app.window.IdScanPanel = function StubScan({ onChange }) {
    return R.createElement(R.Fragment, null,
      R.createElement('button', { onClick: () => onChange(app.window.__doc) }, 'STUB SCAN'),
      R.createElement('button', { onClick: () => onChange(null) }, 'STUB RESCAN'));
  };
  app.window.__CheckInProbe = () => R.createElement(app.window.CheckInModal, {
    onClose() {}, onCheckIn(payload) { app.window.__created = payload; } });
  await app.mount('__CheckInProbe');
  assert.ok(app.click('STUB SCAN'), 'the stub scanner was never rendered');
  await app.settle();
}

const DOC_A = { type: 'CA DL', num: '••••4821', expires: '2032-04-11', scannedAt: 'Just now',
  by: 'Manisha Saini', photo: true, firstName: 'Marcus', lastName: 'Webb', name: 'Marcus Webb',
  nameGuessed: false, dob: '03/11/1994', returning: false, lookup: 'ok', simulated: true };

test('the New-customer form carries the photo control, under the government ID card', async () => {
  await withApp('pos', async (app) => {
    await checkInAtNewCustomer(app, DOC_A);
    const t = app.text();
    assert.match(t, /Photos of the ID \/ passport/,
      'the check-in New-customer form has no photo capture at all');
    assert.match(t, /No ID photos attached/,
      'the photo control is on the form but is not rendering its own absent state');
    assert.match(t, /Held in this browser tab only/,
      'the storage disclosure did not come across with the control');

    // POSITION IS PART OF THE MEANING. The photos are a second reading of the
    // document the scanner just read; putting them below the address block
    // would file them under a different subject entirely.
    const body = app.document.body.textContent.replace(/\s+/g, ' ');
    const gov = body.indexOf('Government ID');
    const photos = body.indexOf('Photos of the ID / passport');
    const addr = body.indexOf('Address');
    assert.ok(gov >= 0 && photos > gov, 'the photo control is not under the GOVERNMENT ID card');
    assert.ok(addr > photos,
      'the photo control drifted below the address block — it belongs with the document ' +
      'it is a photograph OF, not floating in the address fields');
  });
});

test('Create carries the photos onto the customer record, under their own key', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await checkInAtNewCustomer(app, DOC_A);
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg'), makeFile(app, 'back.jpg', 'image/jpeg')]);
    await app.settle();

    assert.ok(app.click('Create customer'), 'no Create customer button');
    await app.settle();
    assert.ok(app.click('Check in'),
      'the modal could not be committed, so the created record was never emitted');
    await app.settle();

    const rec = app.window.__created && app.window.__created.customer;
    assert.ok(rec, 'check-in emitted no customer');
    assert.equal(rec.idPhotos.length, 2,
      'the photos did not travel with the record Create built');
    assert.equal(rec.idPhotos.map((p) => p.name).join(','), 'front.jpg,back.jpg',
      'the record carries something other than the two files that were attached');
    // BESIDE the document, never inside it: `doc` is what a scanner read and
    // `idPhotos` is what a human photographed, and one is not evidence of the
    // other.
    assert.equal(rec.doc.idPhotos, undefined,
      'the photos were folded into the scanned document — a photograph an operator took ' +
      'must never sit inside the record of what the barcode said');
    assert.equal(rec.idPhotos[0].stored, false,
      'a photo on the created record claims to be stored. Nothing files these anywhere');
  });
});

test('a document swapped under attached photos is flagged on the record-in-progress, not silently carried', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await checkInAtNewCustomer(app, DOC_A);
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();
    assert.doesNotMatch(app.text(), /different document|discarded/,
      'a photo attached to the document on screen is already complaining about it');

    // The same operator, the same form, a different person's licence.
    app.window.__doc = Object.assign({}, DOC_A, { num: '••••7730', firstName: 'Priya', lastName: 'Raman', name: 'Priya Raman' });
    assert.ok(app.click('STUB SCAN'), 'the scanner is not reachable from inside the form');
    await app.settle();

    // The list lives inside the modal here, not in a probe, so the SCREEN is
    // the only honest place to assert from.
    const t = app.text();
    assert.match(t, /front\.jpg/,
      'the re-scan DELETED a photo a human deliberately took. Nothing may silently destroy ' +
      'a capture; the fix is to flag it, not to bin it');
    assert.match(t, /different document/,
      'a photo taken alongside the previous licence is now sitting under a different ' +
      'person\'s scan with nothing on screen saying so — that is the exact shape of the ' +
      'defect this form exists to prevent');
  });
});

test('Re-scan discards the DOCUMENT and keeps the photos — flagged, never deleted', async () => {
  await withApp('pos', async (app) => {
    app.window.URL.createObjectURL = (f) => 'blob:hw-test/' + f.name;
    app.window.URL.revokeObjectURL = () => {};
    await checkInAtNewCustomer(app, DOC_A);
    attach(app, [makeFile(app, 'front.jpg', 'image/jpeg')]);
    await app.settle();

    // The real Re-scan clears the document UPWARD (verification.jsx calls
    // onChange(null)), which is what stops a new name wearing an old person's
    // ID. It must not take a photograph a human deliberately took with it: a
    // screen that silently bins evidence is worse than one that asks.
    assert.ok(app.click('STUB RESCAN'), 'the re-scan control is not reachable from the form');
    await app.settle();

    const t = app.text();
    assert.match(t, /front\.jpg/,
      'Re-scan DELETED the attached photo. Nothing may silently destroy a capture — the ' +
      'operator is the only one who can say whether it shows the ID still in hand');
    assert.match(t, /discarded/,
      'the photo outlived the document it was taken alongside and said nothing about it. ' +
      '"still matches" and "matches a document that is gone" are different facts');
  });
});

/* ── MUTATION REGISTER ────────────────────────────────────────────────────
 *
 * 28 mutations, one per claim these tests make. Each was applied to the source
 * it guards, this file was run and had to go RED, the source was restored, and
 * the restore was verified byte-identical by sha256. Run against an isolated
 * copy of the tree — this is a shared checkout and another agent's write landed
 * inside a mutation window on the first attempt, which is exactly how a
 * mutation gets stranded in a file nobody is looking at.
 *
 *   shared/id-photos.jsx
 *     M1  wrong-type refusal → "Invalid file."      M2  size refusal drops the limit
 *     M3  `size <= 0` → `size < 0`                  M4  count limit raised to 99
 *     M5  extension overrides a declared type       M6  extension fallback removed
 *     M7  docKeyOf ignores the document number      M8  docNote always returns null
 *     M9  "before the scan" collapsed into "other"  M10 absent state renders an <img>
 *     M11 absence shown when nothing previews       M12 the three tile faces merged into one
 *     M13 <img onError> removed                     M14 remove stops revoking the Blob URL
 *     M15 one refusal discards the whole batch      M16 refusals never rendered
 *     M17 storage disclosure gutted                 M18 `stored: true`
 *     M25 UNDRAWABLE emptied                        M26 markPreview back to the stale closure
 *     M27 the grouped warning printed per file      M28 docFlag drops a branch
 *   pos/checkin.jsx
 *     M19 the control is not rendered               M20 the card label is changed
 *     M21 Create sends `idPhotos: []`               M22 photos folded inside `doc`
 *     M23 re-scan clears the photo list             M24 `docKey` hard-wired to null
 *
 * TWO SURVIVORS ON THE FIRST PASS, and they are why this register exists.
 * M11 was a bad mutation — its anchor matched the attachment COUNT row, not the
 * branch — so it proved nothing until the anchor was fixed. M23 was a real
 * hole: nothing here drove the actual Re-scan, which emits `null`, so "a
 * re-scan must not delete a photo a human took" was an untested belief. The
 * Re-scan test above was written to close it.
 *
 * M26 exists because of a defect the BROWSER found and jsdom could not: two
 * <img>s failing in the same tick, which is the front and back of one HEIC
 * licence. See the note at `marked` in shared/id-photos.jsx.
 */
