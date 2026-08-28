/* ── IDENTITY AT THE COUNTER: what the screen may and may not claim ──────────
 *
 * Everything here guards one rule, in the shape it kept coming back in:
 *
 *   AN ABSENCE AND AN UNKNOWN RENDER IDENTICALLY UNLESS THE CODE IS FORCED TO
 *   DISTINGUISH THEM, AND THE DEFAULT IS ALWAYS THE ONE THAT LOOKS LIKE AN
 *   ANSWER.
 *
 * Five instances lived in the check-in and verification flow at once, and none
 * of them had a test:
 *
 *   1. `linkMember` wrote `doc: { onFile: true }` for every member the search
 *      box returned, so linking Joseph Levi — "Never walked in, no document
 *      anyone has held" — produced a green "Existing customer" tick and cleared
 *      a gate whose own banner reads "A name on its own is not enough."
 *   2. A returning barcode naming a member id that could not be resolved fell
 *      through to the NEW-CUSTOMER form, so "we matched you to a record we
 *      cannot load" and "you are new" were the same screen — and the copy under
 *      the scanner promises "no match starts a new one", so the operator reads
 *      the pre-filled form as proof of no match and creates the duplicate.
 *   3. The scan captured a document and `createNew` dropped it, so the person
 *      who had just handed over a physical ID was tier 0 and would be sent
 *      through a remote check the policy card says they will never see.
 *   4. "Customer type" defaulted to Adult Use and nothing ever seeded it from
 *      the record, and data.jsx's `p.type || member.type` could not fall
 *      through because p.type was always a non-empty string — so scanning a
 *      Medicinal patient silently re-designated them, with different purchase
 *      limits and different tax.
 *   5. SmsVerifyPanel manufactured a DELIVERED attempt with an invented carrier
 *      acknowledgement latency whenever no attempts were passed — which is
 *      every real render, because no call site passes any.
 *
 * These assertions drive the real screens. A source-shaped check would have
 * passed on several of these while the UI stayed wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** The simulated PDF417 read resolves on a 700ms timer inside IdScanPanel. */
const afterScan = () => new Promise((r) => setTimeout(r, 900));

function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  const proto = el.tagName === 'TEXTAREA'
    ? app.window.HTMLTextAreaElement.prototype : app.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
function fieldByLabel(app, label) {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
}
const disabled = (app, label) => {
  const b = [...app.document.querySelectorAll('button')]
    .find((x) => (x.textContent || '').trim() === label);
  assert.ok(b, `no ${label} button`);
  return b.disabled;
};

/* ── 1. the scan is the way in, and it carries the document ──────────────── */

test('the counter scan writes a real verification record, not just a form fill', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const before = Object.keys(HW.IDV).length;

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'the modal must LEAD with the scanner');
    await afterScan();
    await app.settle();

    const first = fieldByLabel(app, 'First name');
    assert.ok(first, 'a no-match scan must open the new-customer form');
    assert.ok(fieldByLabel(app, 'Last name'),
      'the form must capture a first and a last name SEPARATELY [OWNER RULING 2026-08-27] — ' +
      'the server accepts only `first_name`/`last_name` and the identity fingerprint is built ' +
      'from the pair, so a joined box makes the client guess the split it then sends');
    assert.match(app.text(), /First name · from ID/,
      'a value read off a government document and one typed by a colleague are different ' +
      'legal claims and must not render as the same grey box');
    assert.match(app.text(), /Last name · from ID/,
      'AAMVA PDF417 carries the family name as its own element — the surname is READ here, ' +
      'not inferred, and the label has to say so or the guessed path is indistinguishable');
    setValue(app, first, 'Scan');
    await app.settle();
    setValue(app, fieldByLabel(app, 'Last name'), 'Probe');
    await app.settle();
    assert.ok(app.click('Create customer'), 'no Create customer button');
    await app.settle();
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    const m = HW.MEMBERS.find((x) => x.name === 'Scan Probe');
    assert.ok(m, 'the check-in did not create the customer');
    assert.equal(Object.keys(HW.IDV).length, before + 1,
      'the scan captured a document and the ledger never received it');
    const a = app.window.HWV.assurance(HW.IDV[m.id]);
    assert.ok(a.tier >= 1,
      'a customer who just handed over a physical ID must not read as Unverified — ' +
      'that is what sends them through a remote check they already earned their way out of');
  });
});

/* ── 2. the buyer is held to the same bar as their friend ────────────────── */

test('a member with no document on file does NOT clear the check-in gate', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    // m5 — "Never walked in, no document anyone has held" (data.jsx).
    const m5 = HW.MEMBERS.find((x) => x.id === 'm5');
    assert.equal(app.window.HWV.assurance(HW.IDV.m5).tier, 0,
      'this test needs a member nobody has ever verified');

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.type('by name, e-mail or phone', m5.name), 'no manual search field');
    await app.settle();
    // The members TABLE row behind the modal carries the same name and the same
    // phone and is itself clickable (a <tr data-hw-i>), so restrict to the
    // modal's own <button> row or the click navigates away instead.
    assert.ok(app.click((t, el) => el.tagName === 'BUTTON' && t.includes(m5.name)),
      'the member row did not render inside the modal');
    await app.settle();

    const t = app.text();
    assert.match(t, /No ID on file/,
      'selecting a customer from the book proves a NAME. It must not render as a document.');
    assert.match(t, /Nobody has held this customer’s ID/,
      'the screen must say what is missing, not just grey a button out');
    assert.ok(disabled(app, 'Check in'),
      'a name on its own cleared the gate — the exact thing the banner says it does not');
    assert.match(t, /Scan the buyer’s ID/,
      'a disabled button with no stated reason makes the operator guess the blocker');
  });
});

/* ── 3. an unresolvable match is neither a match nor a miss ──────────────── */

test('a returning barcode we cannot resolve is REFUSED, not turned into a new customer', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    // Empty the book AFTER load: the scan then reports returning + a member id
    // that resolves to nothing, which is the state that used to render as "new".
    app.window.HW.MEMBERS.length = 0;

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    // The simulator alternates; the second read is the returning one.
    assert.ok(app.click('Scan ID'), 'no scanner');
    await afterScan();
    await app.settle();
    if (app.click('Re-scan')) { await app.settle(); app.click('Scan ID'); await afterScan(); await app.settle(); }

    const t = app.text();
    // With no book at all the scan cannot claim a clean miss either.
    assert.ok(/customer book was NOT available/i.test(t) || /this device cannot load/i.test(t),
      'an unread customer book rendered as a clean miss — "not in the book" and "no book" ' +
      'are different facts and only one of them licenses onboarding a second profile');
    assert.doesNotMatch(t, /New customer · from the document/,
      'an unresolvable lookup must never present itself as a confirmed first-timer');
  });
});

/* ── 4. the record answers the question, not the operator ────────────────── */

test('a resumed Medicinal patient is NOT silently re-designated Adult Use', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const n0 = HW.CHECKINS.length;

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    // First read is a first-timer; re-scan to reach the returning branch, which
    // resolves to a REAL member record (m2 — MedicinalUser).
    assert.ok(app.click('Scan ID'), 'no scanner');
    await afterScan();
    await app.settle();
    assert.ok(app.click('Re-scan'), 'Re-scan must be reachable');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'the scanner did not return to idle after Re-scan');
    await afterScan();
    await app.settle();

    // The resumed record replaces the scanner with the customer card, so the
    // proof it resumed is that the visit-detail segments are now seeded.
    assert.match(app.text(), /on their record/,
      'a segment seeded from the record must say where its value came from — an operator ' +
      'shown a bare default has no cue that the file already answered the question');

    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();
    assert.equal(HW.CHECKINS.length, n0 + 1, 'the check-in was not written');
    const rec = HW.CHECKINS[HW.CHECKINS.length - 1];
    const member = HW.MEMBERS.find((x) => x.id === rec.memberId);
    assert.equal(rec.type, member.type,
      'the check-in re-classified a customer the record had already classified — ' +
      'different purchase limits and different tax, behind a default that looks like an answer');
  });
});

/* ── 5. a receipt we did not receive is not a fallback value ─────────────── */

test('nothing sent renders as NO send log — never as a green Delivered', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // m1 is tier 1 (document on file, phone unconfirmed) so the SMS panel shows.
    // Strip the one fact that says an SMS ever left: with no attempts and no
    // sentAt, the panel used to manufacture "delivered · carrier ack 1.4s".
    delete HW.IDV.m1.phone.sentAt;
    await app.mount('MembersScreen');
    const row = [...app.document.querySelectorAll('tr')]
      .find((r) => (r.textContent || '').includes(HW.MEMBERS.find((m) => m.id === 'm1').name));
    assert.ok(row, 'no row for m1');
    row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    const t = app.text();
    assert.match(t, /Pending verification/, 'the SMS panel should be on screen for a tier-1 customer');
    assert.doesNotMatch(t, /carrier ack/,
      'a carrier acknowledgement latency was invented for a message that was never sent');
    assert.doesNotMatch(t, /Send log/,
      'no attempt means no send log — an empty log is a state, not a thing to fill');
    assert.match(t, /Nothing has been sent to this number yet/,
      'the panel must say nothing was sent, so the operator RESENDS instead of ' +
      'concluding the customer is ignoring a code they never received');
  });
});
