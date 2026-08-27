/* ── ROUND 2: what survived the purge, and what the purge made worse ─────────
 *
 * Round 1 deleted the char-hash money, the fabricated compliance numbers and
 * the manufactured SMS seed. Every finding here is a SURVIVOR of that pass, and
 * three of them are worse BECAUSE of it: honest blanks beside one fabricated
 * value make the fabricated value read as the one fact that is on record.
 *
 *   1. `pick([...4 streets])` chose an ID address by a character-code sum of
 *      m.id and printed it in a grid where its four neighbours now correctly
 *      read "not recorded" — then handed it to the DELIVERY address book as the
 *      address on the document.
 *   2. seedAddresses built the whole delivery book from the same hash: how many
 *      addresses, an order count per address and a hardcoded last-used date,
 *      each row green "In zone · Routes to this region and can order delivery."
 *   3. idPhotos rendered "License · front", "Selfie match" and "Medical card"
 *      tiles from a constant list, under a ladder saying "Nobody has seen a
 *      document yet" and above a block saying the medical card is not on file.
 *   4. The compliance card dropped `doc.simulated`, so the DEMO chip the
 *      scanner shows at capture vanished on the record the scan produced.
 *   5. Both SMS panels wrote "delivered · carrier ack 0.9s" from a setTimeout
 *      1.6s after the click — the exact claim round 1 deleted from the seed,
 *      arriving later and therefore looking earned rather than defaulted.
 *   6. The scanner consulted the customer book on only one of its two branches
 *      and emitted `returning: false` — "we read the book and this person is
 *      not in it" — on the branch that read nothing.
 *   7. assurance() gated its expired-document branch on a boolean nothing sets,
 *      while every producer emits an expiry DATE — so an expired licence and a
 *      2032 passport rendered as the same pixels.
 *   8. MatchSheet promoted a candidate at 40 with the gold ring and the gold
 *      Bind button while telling the operator that anything under 60 failed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const afterScan = () => new Promise((r) => setTimeout(r, 900));
const afterFakeCarrier = () => new Promise((r) => setTimeout(r, 2200));
const disabled = (app, label) => {
  const b = [...app.document.querySelectorAll('button')]
    .find((x) => (x.textContent || '').trim() === label);
  assert.ok(b, `no ${label} button`);
  return b.disabled;
};

async function openMember(app, id) {
  await app.mount('MembersScreen');
  const m = app.window.HW.MEMBERS.find((x) => x.id === id);
  assert.ok(m, `no member ${id}`);
  const row = [...app.document.querySelectorAll('tr')]
    .find((r) => (r.textContent || '').includes(m.name));
  assert.ok(row, `no row for ${id}`);
  row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await app.settle();
  return m;
}

/* ── 1 + 2. an address nobody gave us is a routing instruction ───────────── */

test('the ID address comes off a document or says "not recorded" — never off a character hash', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // m1 holds a REAL scanned document, and that document holds no address.
    assert.ok(HW.IDV.m1 && HW.IDV.m1.doc, 'fixture changed: m1 has no document');
    assert.equal(HW.IDV.m1.doc.address, undefined,
      'fixture changed: this test needs a document with no address on it');
    await openMember(app, 'm1');

    const t = app.text();
    assert.doesNotMatch(t, /418 Mission Trail|92 Diamond Dr|5571 Grand Ave|210 Riverside Dr/,
      'the compliance card printed a street address generated from how the customer id ' +
      'spells, beside four fields that honestly say "not recorded" — the contrast makes ' +
      'the invented one read as the one fact that IS on the licence');
    assert.match(t, /ADDRESS\s*not recorded|Addressnot recorded/i,
      'an address the ledger does not hold must say so, exactly like its four neighbours');
  });
});

test('the delivery address book starts empty and says so, rather than inventing three doors', async () => {
  await withApp('pos', async (app) => {
    await openMember(app, 'm1');
    const t = app.text();
    assert.match(t, /No delivery address is on file for this customer/,
      'an empty book must render its empty state — an operator taking a delivery order ' +
      'dispatches to whatever this panel lists');
    assert.doesNotMatch(t, /Routes to this region and can order delivery/,
      'a zone verdict was rendered in the good tone for an address nobody entered');
    assert.doesNotMatch(t, /last used 2 days ago|last used Jun 2, 2026|last used May 11, 2026/,
      'an order count and a last-used date are what make an invented address believable — ' +
      'they claim other people have already delivered there');
  });
});

/* ── 3 + 4. a photo tile is a claim that the photo was taken ─────────────── */

test('no document image means no tile — and never a "Selfie match" nobody computed', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // m5 is the "never walked in, nobody has held a document" record.
    assert.ok(!HW.IDV.m5 || !HW.IDV.m5.doc, 'fixture changed: m5 now holds a document');
    await openMember(app, 'm5');
    const t = app.text();
    assert.doesNotMatch(t, /License · front|Selfie match|Medical card/,
      'captioned document tiles rendered for a customer whose own ladder says nobody has ' +
      'seen a document — and "Selfie match" names a biometric comparison this estate ' +
      'never performs');
    assert.match(t, /No document image is held for this customer/,
      'the empty state IS the content here; a placeholder tile reads as an image that has ' +
      'not finished loading');
  });
});

test('a simulated document carries the scanner’s DEMO mark onto the compliance card', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    HW.IDV.m1.doc.simulated = true;
    await openMember(app, 'm1');
    const t = app.text();
    assert.match(t, /DEMO/,
      'the DEMO chip is stamped on every document this build produces and was dropped in ' +
      'transit between the scanner and the record the scan wrote — the lesson was applied ' +
      'to the money and not to the document');
  });
});

/* ── 5. a carrier receipt is a third party's statement ───────────────────── */

test('Resend does not turn into a green Delivered with an invented carrier latency', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    delete HW.IDV.m1.phone.sentAt;
    await openMember(app, 'm1');

    assert.match(app.text(), /Pending verification/, 'the SMS panel should be on screen');
    // Nothing has been sent, so the control may not offer to send it AGAIN.
    const send = [...app.document.querySelectorAll('button')]
      .find((b) => /by SMS$/.test((b.textContent || '').trim()));
    assert.ok(send, 'no send control on the SMS panel');
    assert.match(send.textContent, /^Send /,
      '"Resend" claims a first message went out; the log beside it says nothing was sent, ' +
      'so the two halves of one panel disagreed about the same fact');

    send.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    await afterFakeCarrier();
    await app.settle();

    const t = app.text();
    assert.doesNotMatch(t, /carrier ack \d/,
      'a carrier acknowledgement latency was fabricated 1.6s after the click for a message ' +
      'no carrier ever received');
    assert.match(t, /awaiting carrier ack/,
      '"sent, no receipt yet" is true and is the state a real unwired build is in');
  });
});

/* ── 6. `returning: false` may only come from a path that read the book ──── */

test('a scan that could not read the customer book never reports a clean miss', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    // Empty the book BEFORE the FIRST scan. _demoIdx starts at 0, so this is
    // the even branch — the one that never called pickReturning and answered
    // "New customer" anyway. A zero-row customer book is indistinguishable from
    // one that did not load, and neither licenses onboarding.
    app.window.HW.MEMBERS.length = 0;

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'no scanner');
    await afterScan();
    await app.settle();

    const t = app.text();
    assert.doesNotMatch(t, /New customer · from the document/,
      'the FIRST scan of every session took the branch that never called the book and still ' +
      'emitted returning:false — the operator onboards a duplicate for someone who already ' +
      'has an account');
    assert.ok(/customer book was NOT available/i.test(t) || /customer book is not loaded/i.test(t),
      '"not in the book" and "no book" must not be the same screen');
  });
});

/* ── 7. an expiry is a date, and something has to compare it to today ───── */

test('an expired document is tier 0, and says which date it expired on', () => {
  // assurance() is the single derivation every surface reads.
  const past = { type: 'NV DL', num: '••••9012', expires: '2026-05-30',
    scannedAt: 'Just now', by: 'Manisha Saini', where: 'Front Counter 1', photo: true };
  const future = Object.assign({}, past, { expires: '2031-07-23' });
  // Loaded through the harness so the real file is under test.
  return withApp('pos', async (app) => {
    const HWV = app.window.HWV;
    const bad = HWV.assurance({ doc: past, phone: { value: 'x', smsVerified: true } });
    assert.equal(bad.tier, 0,
      'an expired driving licence cleared the counter — a valid ID and an expired one ' +
      'rendered as the same pixels, differing only by a date string nobody is asked to read');
    assert.equal(bad.canStore, false, 'an expired document may not clear an in-store sale');
    assert.match(bad.blocker, /2026-05-30/,
      'the refusal has to name the date, or the operator cannot act on it');
    const ok = HWV.assurance({ doc: future, phone: { value: 'x', smsVerified: true } });
    assert.equal(ok.tier, 2, 'a current document must still clear — the guard is a date, not a ban');
    // Unparseable is UNKNOWN, not expired: it must not fabricate a refusal either.
    const weird = HWV.assurance({ doc: Object.assign({}, past, { expires: 'sometime' }),
      phone: { value: 'x', smsVerified: true } });
    assert.equal(weird.tier, 2, 'a date we cannot read is not evidence of expiry');
  });
});

test('an expired document on file is refused at the check-in, not printed as "ID on file"', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const m1 = HW.MEMBERS.find((x) => x.id === 'm1');
    // A REAL scanned document, aged past its expiry. Nothing else changes.
    HW.IDV.m1.doc.expires = '2026-05-30';
    assert.equal(app.window.HWV.assurance(HW.IDV.m1).tier, 0,
      'an expired document still counted as a document on file');

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.type('by name, e-mail or phone', m1.name), 'no manual search field');
    await app.settle();
    assert.ok(app.click((t, el) => el.tagName === 'BUTTON' && t.includes(m1.name)),
      'the member row did not render inside the modal');
    await app.settle();

    const t = app.text();
    assert.match(t, /No ID on file/,
      'an expired driving licence and a 2032 passport rendered as the same green pill, ' +
      'differing only by a date string nobody is asked to read');
    assert.ok(disabled(app, 'Check in'),
      'the screen cleared a customer whose only document expired three months ago');
  });
});

/* ── 8. one band table, and the accent follows the stated floor ──────────── */

test('the match sheet promotes at the floor it names, not at 40', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    assert.ok(app.click('Match to a person'), 'no search affordance in the Needs-match lane');
    await app.settle();

    // Every accent Bind button in the sheet must sit on a row whose own score
    // is at or above the floor the header line quotes.
    const rows = [...app.document.querySelectorAll('div')].filter((d) => {
      const b = [...d.children].find((c) => c.tagName === 'BUTTON' && (c.textContent || '').trim() === 'Bind');
      return !!b;
    });
    assert.ok(rows.length, 'no bindable rows in the sheet');
    // The concrete case: 52 is the strongest person in the room on this
    // fixture, and 52 is BELOW the floor this sheet quotes. It used to carry
    // the accent border, the 2px accent ring and the gold Bind button.
    const fiftyTwo = rows.filter((r) => /52%/.test(r.textContent || ''));
    assert.ok(fiftyTwo.length, 'fixture changed: no 52% candidate to check the promotion against');
    for (const r of fiftyTwo) {
      assert.doesNotMatch(r.getAttribute('style') || '', /0 0 0 2px/,
        'a 52% match — below the 60% floor the same sheet quotes — was given the ring this ' +
        'product reserves for "this is the one"');
    }
    for (const r of rows) {
      const txt = r.textContent || '';
      const m = /(\d+)%/.exec(txt);
      const promoted = /0 0 0 2px/.test(r.getAttribute('style') || '');
      if (promoted) {
        assert.ok(m, 'a row was given the accent ring with no score on it at all');
        assert.ok(+m[1] >= 60,
          `a ${m[1]}% match was given the gold ring and the gold Bind button while the same ` +
          'sheet says anything under 60 failed the auto-bind — in a room of four people the ' +
          'fastest action was tapping the gold button on a match the system rejected');
      }
    }
  });
});

test('an unscored order does not state a comparison against a floor', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    assert.ok(app.click('Match to a person'), 'no search affordance in the Needs-match lane');
    await app.settle();
    assert.doesNotMatch(app.text(), /not scored · below the \d+% auto-bind floor/,
      'a floor comparison was stated for a number that was never computed');
  });
});

/* ── 9. the document is bound to whoever was already selected ────────────── */

test('a document whose name is not this customer’s is refused, not silently attached', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const HW = app.window.HW;
    const m5 = HW.MEMBERS.find((x) => x.id === 'm5');   // nobody has held their ID
    assert.equal(app.window.HWV.assurance(HW.IDV.m5).tier, 0, 'this test needs an unverified member');

    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.type('by name, e-mail or phone', m5.name), 'no manual search field');
    await app.settle();
    assert.ok(app.click((t, el) => el.tagName === 'BUTTON' && t.includes(m5.name)),
      'the member row did not render inside the modal');
    await app.settle();

    // The scanner offered INSIDE the amber block, after a person is chosen.
    assert.ok(app.click('Scan ID'), 'no scanner inside the no-ID block');
    await new Promise((r) => setTimeout(r, 900));
    await app.settle();

    const t = app.text();
    assert.match(t, /This document is not this customer’s/,
      'the document was attached with no comparison at all — pick the wrong row out of a ' +
      'search that returned two Danny F’s, scan the right person’s ID, and the modal says ' +
      'in green that THIS customer’s ID is on file');
    assert.match(t, /No ID on file/,
      'a refused document must not also flip the pill to green');
    assert.ok(disabled(app, 'Check in'), 'a mismatched document cleared the gate');
    assert.ok([...app.document.querySelectorAll('button')]
      .some((b) => /Attach to .* anyway/.test(b.textContent || '')),
      'overriding has to stay available — as an explicit choice, not as the default');
  });
});
