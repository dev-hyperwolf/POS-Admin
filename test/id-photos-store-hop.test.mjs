/* ══ THE PHOTOS AN OPERATOR ATTACHED MUST SURVIVE THE STORE HOP ═════════════
 *
 * shared/id-photos.jsx lets staff photograph an ID or passport at the counter,
 * and pos/checkin.jsx hands the result to the store under its own key beside
 * the scanned document. pos/data.jsx then destroyed it, twice:
 *
 *     function addMember(m) {
 *       const rec = { id: …, first_name: …, last_name: …, name: …, email: …,
 *                     phone: …, group: …, type: …, delivery: …, visits: …,
 *                     points: …, wallet: …, member: … };      // ← no idPhotos
 *
 *     if (!member) member = addMember({ name: c.name, first_name: …, … });
 *                                                             // ← no idPhotos
 *
 * An ALLOW-LIST does not drop a key loudly. There is no error, no warning and
 * no empty state — the operator watched the tiles appear, pressed Create, got a
 * customer record back, and the photographs they deliberately took were gone.
 * This is the same failure shape as the split-name pair one field earlier
 * (test/customer-field-split.test.mjs), except that here NOTHING IS EVEN
 * DISPLAYED TO BE WRONG. The operator believes they attached it.
 *
 * ⚠️ WHAT THIS FILE PINS, AND WHAT IT MUST NEVER BE READ AS CLAIMING.
 *
 * Carrying the list through the store means one thing: it survives navigation
 * within this session. It is NOT storage. There is no server route for ID
 * images in this build, MEMBERS is an in-memory array that a reload rebuilds
 * from the seed, and shared/hw-live-identity.js deliberately never touches
 * window.HW.MEMBERS, so nothing here is ever POSTed anywhere.
 *
 * That is why the third test below is not decoration. HWIdPhotos.STORAGE.line —
 * rendered unconditionally beside every capture control — says nothing is
 * uploaded and nothing is filed against the customer. A change that made these
 * photos outlive the tab would make that sentence false, and the sentence is
 * the compliance-critical part of the feature. It is asserted here AS THE
 * SHARED CONSTANT, alongside the per-entry `stored: false` the store now
 * carries, so a persistence change cannot land without this file going red.
 *
 * ⚠️ THE LOAD-BEARING ENTRY IS M1. A check that only fires once someone deletes
 * something is a check that would never have caught the original defect. M1
 * restores the allow-list WITHOUT `idPhotos` — the exact shipped code — and is
 * recorded red in the mutation register at the foot of this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** A File in the JSDOM realm, the way test/id-photos.test.mjs builds one. */
const makeFile = (app, name, type = 'image/jpeg') =>
  new app.window.File([new app.window.Uint8Array(1)], name, { type });

/** A photo record built by the ONE place that builds them. Never a hand-rolled
 *  literal: a fixture that invents the shape cannot notice when the real shape
 *  changes, which is how a store test stays green over a broken store. */
function photo(app, name, docKey = null) {
  const H = app.window.HWIdPhotos;
  assert.ok(H && typeof H.makePhoto === 'function',
    'shared/id-photos.jsx did not load — every assertion below would pass vacuously');
  return H.makePhoto(makeFile(app, name), docKey);
}

const inputs = (app) => [...app.document.querySelectorAll('input')];
function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
/** A CIField is a labelled input with NO placeholder, so the label above it is
 *  the only handle on it. Same reader as test/customer-field-split.test.mjs. */
function fieldByLabel(app, label) {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
}

/* ── 1 · THE ALLOW-LIST ─────────────────────────────────────────────────── */

test('addMember carries the attached photos onto the record instead of constructing them away', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const p = photo(app, 'licence-front.jpg');
    const rec = HW.addMember({ first_name: 'Ada', last_name: 'Byron', name: 'Ada Byron', idPhotos: [p] });

    assert.ok(Array.isArray(rec.idPhotos),
      'the created member carries no `idPhotos` array at all. addMember is an ALLOW-LIST — it ' +
      'builds a fixed shape rather than spreading its argument — so a key it does not name is ' +
      'destroyed silently, with nothing rendered wrong for the operator to notice.');
    assert.equal(rec.idPhotos.length, 1,
      'the photo the operator attached did not reach the record');
    assert.equal(rec.idPhotos[0].name, 'licence-front.jpg',
      'something reached the record, but it is not the photo that was attached');
    // The record in the BOOK, not merely the value handed back — a return value
    // nobody stored would satisfy the lines above and fix nothing.
    const inBook = HW.MEMBERS.find((x) => x.id === rec.id);
    assert.ok(inBook && (inBook.idPhotos || []).length === 1,
      'the returned record carries the photo and the one in MEMBERS does not — every screen ' +
      'reads the book, so a photo that lives only on the return value is still discarded');
  });
});

test('no photos attached is stored as an empty list, never as a missing key', async () => {
  await withApp('pos', async (app) => {
    const rec = app.window.HW.addMember({ name: 'Grace Hopper' });
    assert.ok(Array.isArray(rec.idPhotos),
      '`idPhotos` is absent on a member created with none. "No photos were attached" is a fact ' +
      'a reader can act on; an absent key makes every reader guess whether the feature even ran ' +
      '— which is the same guess this whole change exists to remove.');
    assert.equal(rec.idPhotos.length, 0, 'a member created with no photos has photos');
  });
});

test('the record holds its OWN copy — the caller cannot mutate the book behind it', async () => {
  await withApp('pos', async (app) => {
    const list = [photo(app, 'front.jpg')];
    const rec = app.window.HW.addMember({ name: 'Katherine Johnson', idPhotos: list });
    list.push(photo(app, 'back.jpg'));
    list.length = 0;
    assert.equal(rec.idPhotos.length, 1,
      'the record aliases the caller\'s array, so the capture form\'s own state edits the stored ' +
      'record after the fact. A compliance artefact that changes when a form somewhere else ' +
      'changes is not a record.');
  });
});

/* ── 2 · THE CHECK-IN HOP ───────────────────────────────────────────────── */

test('addCheckIn carries the photos through to the customer it creates', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const doc = { type: 'CA DL', num: '••••4821', expires: '2032-05-30', scannedAt: 'Just now',
      by: 'Manisha Saini', photo: true, simulated: true };
    const docKey = app.window.HWIdPhotos.docKeyOf(doc);
    const ci = HW.addCheckIn({ customer: { id: 'new', name: 'Ng', first_name: 'Ng', last_name: '',
      doc, idPhotos: [photo(app, 'passport.jpg', docKey)] }, guests: [] });

    assert.ok(ci, 'the check-in was refused');
    const m = HW.MEMBERS.find((x) => x.id === ci.memberId);
    assert.ok(m, 'the check-in created no customer');
    assert.equal((m.idPhotos || []).length, 1,
      'the check-in call site is a SECOND allow-list: it names the keys it forwards to addMember, ' +
      'so a photo captured on the new-customer form is destroyed at that line even when ' +
      'addMember itself would have accepted it. Fixing one hop and not the other fixes nothing.');
    assert.equal(m.idPhotos[0].docKey, docKey,
      'the docKey stamp did not survive the hop. It is what lets a photo say it no longer matches ' +
      'the document now in hand — without it, one customer\'s licence can sit under another\'s ' +
      'name behind a green tick.');
  });
});

test('a returning customer\'s photos are APPENDED, never dropped and never duplicated', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const existing = HW.MEMBERS[0];
    assert.ok(existing, 'fixture changed: the member book is empty');
    const before = (existing.idPhotos || []).length;
    const first = photo(app, 'one.jpg');

    // A member already in the book skips addMember entirely — the branch where
    // the photos would fall down the same hole one line over.
    HW.addCheckIn({ customer: existing, guests: [], idPhotos: undefined });
    HW.addCheckIn({ customer: Object.assign({}, existing, { idPhotos: [first] }), guests: [] });
    assert.equal((HW.MEMBERS.find((x) => x.id === existing.id).idPhotos || []).length, before + 1,
      'photos attached while checking in someone ALREADY in the book are discarded — the ' +
      'returning-customer branch never reaches addMember, so the key is dropped one branch over');

    // The same capture handed over twice must not become two photos…
    HW.addCheckIn({ customer: Object.assign({}, existing, { idPhotos: [first] }), guests: [] });
    const after = HW.MEMBERS.find((x) => x.id === existing.id).idPhotos;
    assert.equal(after.length, before + 1,
      'one capture was counted twice. A duplicated evidence tile is a claim that two ' +
      'photographs were taken.');

    // …and a genuinely new one must not replace what is already held. A human
    // deliberately captured every one of these; nothing may silently destroy
    // evidence, which is the ruling shared/id-photos.jsx makes on re-scan.
    HW.addCheckIn({ customer: Object.assign({}, existing, { idPhotos: [photo(app, 'two.jpg')] }), guests: [] });
    const merged = HW.MEMBERS.find((x) => x.id === existing.id).idPhotos;
    assert.equal(merged.length, before + 2,
      'a new photo REPLACED the ones already held instead of joining them — evidence destroyed ' +
      'by a write nobody asked for');
    // Joined rather than deep-compared: an array built inside the jsdom realm
    // has a different Array.prototype, so deepStrictEqual reports "same
    // structure but not reference-equal" — which reads like a real defect and
    // is not one. Same realm hazard test/harness.mjs documents at `plain`.
    assert.equal(merged.slice(-2).map((x) => x.name).join(','), 'one.jpg,two.jpg',
      'the merge did not preserve both captures in order');
  });
});

/* ── 3 · AND IT MUST NOT OVERCLAIM WHAT THAT ACHIEVES ───────────────────── */

test('carrying the photos through the store does not make the storage sentence false', async () => {
  await withApp('pos', async (app) => {
    const S = app.window.HWIdPhotos && app.window.HWIdPhotos.STORAGE;
    assert.ok(S, 'shared/id-photos.jsx did not load');
    // The sentence and the mode are DESIGNED TO MOVE TOGETHER. Pinning both is
    // what stops one being changed without the other — a mode that quietly went
    // 'server' under an unchanged sentence is the overclaim this guards.
    assert.equal(S.mode, 'memory',
      'HWIdPhotos.STORAGE.mode is no longer `memory`. If a real route landed, STORAGE.line has ' +
      'to change WITH it — the sentence is the contract — and this store hop has to be ' +
      're-derived, because it was built on the fact that nothing outlives the tab.');
    assert.match(S.line, /Nothing is uploaded and nothing is filed against the customer/,
      'the storage sentence no longer says nothing is uploaded and nothing is filed against the ' +
      'customer. That is the one line on a compliance artefact that must not drift.');
    assert.match(S.line, /Reloading or closing this page loses them/,
      'the sentence no longer says a reload loses them — which is still exactly what happens: ' +
      'MEMBERS is an in-memory array and nothing serialises a member record');

    // And the record says it about ITSELF, rather than relying on a reader to
    // remember. `stored` is written by the one place that knows (makePhoto
    // reading STORAGE.mode) and nothing sets it true.
    const rec = app.window.HW.addMember({ name: 'Mary Jackson', idPhotos: [photo(app, 'id.jpg')] });
    assert.equal(rec.idPhotos[0].stored, false,
      'a photo on a stored record claims `stored: true`. Nothing in this build stores an ID ' +
      'image; a flag saying otherwise is the overclaim the whole feature was written to avoid.');
    assert.equal(rec.idPhotos[0].storage, 'memory',
      'the entry no longer names where it lives, so a reader of the record cannot tell');
  });
});

test('a photo does not mint an identity-ledger row, and does not move the assurance tier', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const ci = HW.addCheckIn({ customer: { id: 'new', name: 'Nobody Scanned', first_name: 'Nobody',
      last_name: 'Scanned', idPhotos: [photo(app, 'held-up-to-the-camera.jpg')] }, guests: [] });
    const m = HW.MEMBERS.find((x) => x.id === ci.memberId);
    assert.equal((m.idPhotos || []).length, 1, 'the photo did not reach the record');

    assert.equal(HW.IDV[m.id], undefined,
      'attaching a photograph created an IDV row for a person no document has ever been seen ' +
      'for. IDV is the ledger pos/verification.jsx derives a compliance verdict from: `doc` is ' +
      'what a scanner read, `idPhotos` is what a human photographed, and one must never be ' +
      'mistaken for evidence of the other.');
    const a = app.window.HWV.assurance(HW.IDV[m.id] || null);
    assert.equal(a.tier, 0,
      'the assurance tier moved because a photo was attached. A photograph taken by an operator ' +
      'is not an identity check, and a tier is what decides whether this person can take a ' +
      'delivery without a remote check.');
    assert.match(a.blocker, /No ID has been seen yet/,
      'the ladder stopped saying no ID has been seen, for a person whose ID has not been seen');
  });
});

/* ── 4 · THROUGH THE REAL COUNTER FLOW ──────────────────────────────────── */

test('a photo attached on the new-customer form is on the record after Check in', async () => {
  await withApp('pos', async (app) => {
    // ⚠️ THE UNIT TESTS ABOVE CANNOT REPLACE THIS ONE. They call the store
    // directly, so they would all stay green if pos/checkin.jsx stopped handing
    // the photos over — and the operator's experience would be unchanged: tiles
    // appear, Create works, the photos are gone. This drives the actual screen.
    const HW = app.window.HW;
    await app.mount('MembersScreen');
    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'the modal must lead with the scanner');
    await new Promise((r) => setTimeout(r, 900));
    await app.settle();

    setValue(app, fieldByLabel(app, 'First name'), 'Ada');
    await app.settle();
    setValue(app, fieldByLabel(app, 'Last name'), 'Byron');
    await app.settle();

    const picker = inputs(app).find((i) => i.getAttribute('data-hw-idphoto') === 'file');
    assert.ok(picker,
      'the shared capture control is not on the new-customer form — no ' +
      'input[data-hw-idphoto="file"]. Either it was never adopted or this form forked its own ' +
      'copy, which is the drift shared/id-photos.jsx exists to prevent.');
    Object.defineProperty(picker, 'files', { value: [makeFile(app, 'counter-photo.jpg')], configurable: true });
    picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    await app.settle();

    const before = HW.MEMBERS.length;
    assert.ok(app.click('Create customer'), 'no Create customer button');
    await app.settle();
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    assert.equal(HW.MEMBERS.length, before + 1, 'the check-in created no customer');
    const m = HW.MEMBERS.find((x) => x.first_name === 'Ada' && x.last_name === 'Byron');
    assert.ok(m, 'the created customer is not in the book');
    assert.equal((m.idPhotos || []).length, 1,
      'a photograph attached at the counter, on the real form, through the real Create button, ' +
      'is not on the record afterwards. Nothing on screen said so: the tile appeared, the button ' +
      'worked, and the operator believes the ID is attached.');
    assert.equal(m.idPhotos[0].name, 'counter-photo.jpg',
      'something reached the record and it is not the file the operator picked');
  });
});

/* ══ MUTATION REGISTER ══════════════════════════════════════════════════════
 *
 * Every assertion above was broken deliberately, run red, and restored.
 * pos/data.jsx was verified byte-identical by sha256 after each restore
 * (b6def7cf… is the PRE-CHANGE file; the post-change sha is recorded in the
 * agent report). The load-bearing entry is M1, because it is the check that
 * would have caught the original defect — it restores the shipped code exactly:
 *
 *   M1  restore the addMember allow-list WITHOUT the `idPhotos` key
 *       → RED: "addMember carries the attached photos onto the record" and
 *              5 others across this file
 *   M2  drop `idPhotos: c.idPhotos` from the addCheckIn → addMember call
 *       → RED: "addCheckIn carries the photos through to the customer it
 *              creates" + the real-counter-flow test
 *   M3  delete the returning-customer merge branch
 *       → RED: "a returning customer's photos are APPENDED"
 *   M4  store the caller's array by reference instead of copying it
 *       → RED: "the record holds its OWN copy"
 *   M5  replace the merge with an overwrite
 *       → RED: "a returning customer's photos are APPENDED" (evidence destroyed)
 *   M6  drop the de-duplication from mergeIdPhotos
 *       → RED: same test, "one capture was counted twice"
 *   M7  default a missing list to `null` rather than `[]`
 *       → RED: "no photos attached is stored as an empty list"
 *   M8  write the photos into the IDV row as well
 *       → RED: "a photo does not mint an identity-ledger row"
 */
