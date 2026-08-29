/* ══ THE REGISTER'S CHECK-IN MUST WRITE, NOT JUST SAY IT WROTE ══════════════
 *
 * pos/screen-register.jsx had two check-in handlers and NEITHER of them called
 * window.HW.addCheckIn:
 *
 *     const onCheckIn = ({ customer: c, guests: g }) => {
 *       openVisit(c, g || []); setShowCheckIn(false);
 *       flash(`${c.name} checked in…`);                       // ← and that is all
 *     };
 *     const checkInCustomer = (m) => {
 *       openVisit(m, []); flash(`${m.name.split(' ')[0]} checked in`);
 *     };
 *
 * `openVisit` is three React setters — setTickets, setActive, setGuests. It is
 * PURELY LOCAL VIEW STATE. So a check-in completed at the busiest counter in the
 * building created no member, no CHECKINS row and no IDV row, while the toast
 * said it worked. Every other surface already called the store:
 * pos/screen-orders.jsx (bind, scan-bind, new check-in) and
 * pos/screen-stubs.jsx:113. The register was the odd one out.
 *
 * ⚠️ THIS IS THE SHAPE, NOT THE INCIDENT. A screen that reports success and
 * writes nothing cannot be caught by looking at the screen — the toast rendered,
 * the customer chip filled in, the modal closed. Three separate defects of this
 * exact family landed in one night (a reject that returned 200 with a null
 * result under a green "Recorded." banner; two allow-lists that dropped first a
 * name pair and then photographs). What every one of them has in common is that
 * the ONLY witness is the store, so that is what this file interrogates. It
 * never asserts on a toast.
 *
 * WHY THE MISSING ROWS WERE THE SMALLER HALF:
 *
 *   · IDV IS THE COMPLIANCE LEDGER. pos/verification.jsx assurance() derives a
 *     tier from it, and a tier is what decides whether a customer takes a
 *     delivery without a remote check. A person who handed a physical ID across
 *     THIS counter had no ledger entry at all, so downstream nothing knew their
 *     document had ever been seen — tier 0, blocked, for a completed scan.
 *   · THE SALE COULD NOT SETTLE THE VISIT. recordTicket() ends a check-in with
 *     HW.openCheckInFor(tk.person), which searches CHECKINS by the person's id.
 *     With no row it returns null, so on this path a served customer and a
 *     walk-out stayed indistinguishable no matter how correct the settle code
 *     was — and the ticket was seated on the modal's literal, which for a new
 *     customer carries `id: 'new'` (pos/checkin.jsx:812), a placeholder that is
 *     not an id and would never have matched a row even if one had existed.
 *
 * ⚠️ THE LOAD-BEARING ENTRY IS M1. It removes the addCheckIn call again —
 * restoring the shipped code exactly — and every store assertion here goes red.
 * A check that only fires on some later refactor is a check that would not have
 * caught this one. The register register is at the foot of this file.
 *
 * ── UPDATE 2026-08-29: CustomerSearch IS NOW WIRED ────────────────────────
 * It used to be true that `checkInCustomer` COULD NOT BE DRIVEN — CustomerSearch
 * (pos/screen-register.jsx, `function CustomerSearch`) was fully built and
 * had exactly one reference repo-wide, its own definition, so the register's
 * search→select check-in was an unreachable surface and the only honest test
 * of it read the source. It is now rendered in the intake bar next to "New
 * check-in" (a small icon-button titled "Check in a customer — search name,
 * e-mail or phone"), wired to `onSelect={checkInCustomer}`. See
 * `'search → select on the register actually checks the customer in'` below
 * for the driven test this unlocked. The two `[source]` tests that follow it
 * stay — they assert on checkInCustomer's internals (store calls, null-means-
 * unchanged) which a screen-level test would only prove indirectly — but they
 * are no longer the only witness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const SRC = readFileSync(new URL('../pos/screen-register.jsx', import.meta.url), 'utf8');

/** A CIField is a labelled input with NO placeholder, so the label above it is
 *  the only handle on it. Same reader as test/id-photos-store-hop.test.mjs — a
 *  second copy of a DOM reader is a second thing to keep in step. */
function fieldByLabel(app, label) {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
}
function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}

/**
 * Drive the REGISTER TILE end to end: New check-in → scan → name → Create → Check in.
 *
 * Everything below goes through this and not through HW.addCheckIn directly,
 * because a test that calls the store itself would have stayed green through the
 * entire life of this bug. The store was never broken. The screen never called it.
 */
async function checkInFromRegisterTile(app, { first, last }) {
  await app.mount('RegisterScreen');
  assert.ok(app.click('New check-in'),
    'no New check-in tile on the register — the entry point this whole file is about');
  await app.settle();
  assert.ok(app.click('Scan ID'), 'the check-in modal must lead with the scanner');
  await new Promise((r) => setTimeout(r, 900));   // the demo scanner's own delay
  await app.settle();

  setValue(app, fieldByLabel(app, 'First name'), first);
  await app.settle();
  setValue(app, fieldByLabel(app, 'Last name'), last);
  await app.settle();

  assert.ok(app.click('Create customer'), 'no Create customer button on the new-customer form');
  await app.settle();
  assert.ok(app.click('Check in'), 'no Check in button on the modal');
  await app.settle();
}

/** The cart footer's total, as a number. Copied from test/register-sale.test.mjs
 *  because that file exports nothing; `app.text()` collapses whitespace and
 *  adjacent spans have none between them, so the footer reads "Items2Total$39.43". */
function totalShown(app) {
  const m = app.text().match(/Items\s*(\d+)\s*Total\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[2].replace(/,/g, '')) : null;
}
/** TENDER → Cash → quick-cash → Complete → Done. Same walk as register-sale. */
async function tenderCash(app, total) {
  assert.ok(app.click('TENDER'), `no TENDER button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Cash')), `no Cash tile — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  const quick = '$' + Math.ceil(total).toFixed(2);
  assert.ok(app.click(quick), `no quick-cash ${quick} — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Complete')), `no Complete — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Done · new sale')), `no Done — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
}

/* ── 1 · THE THREE ROWS ──────────────────────────────────────────────────── */

test('a check-in from the register tile creates the member, the check-in row AND the IDV row', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const members = HW.MEMBERS.length, checkins = HW.CHECKINS.length;

    await checkInFromRegisterTile(app, { first: 'Grace', last: 'Hopper' });

    assert.equal(HW.MEMBERS.length, members + 1,
      'the register check-in created no customer. The toast said it worked; MEMBERS disagrees, '
      + 'and MEMBERS is the only witness that counts.');
    const m = HW.MEMBERS.find((x) => x.first_name === 'Grace' && x.last_name === 'Hopper');
    assert.ok(m, 'a member was created and it is not the person the operator typed');

    assert.equal(HW.CHECKINS.length, checkins + 1,
      'nobody reached the waiting board. The customer is standing in the room and no surface '
      + 'that reads CHECKINS — the floor strip, the queue, dispatch — can see them.');
    const ci = HW.CHECKINS.find((c) => c.memberId === m.id);
    assert.ok(ci, 'a check-in row exists but it is not bound to the member that was just created');

    // The load-bearing one. IDV is what assurance() reads.
    const v = HW.IDV[m.id];
    assert.ok(v && v.doc,
      'a document was SCANNED at this counter and no identity-ledger row exists for it. This is '
      + 'the half of the defect that outlives the shift: downstream nothing knows this person\'s '
      + 'ID was ever seen.');
  });
});

test('assurance() can actually see the scan — the customer is not left at tier 0', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await checkInFromRegisterTile(app, { first: 'Ada', last: 'Lovelace' });
    const m = HW.MEMBERS.find((x) => x.first_name === 'Ada' && x.last_name === 'Lovelace');
    assert.ok(m, 'no member to assess');

    const a = app.window.HWV.assurance(HW.IDV[m.id] || null);
    assert.ok(a.tier >= 1,
      `assurance() returned tier ${a.tier} for a customer whose ID was scanned at the counter. `
      + 'Tier 0 sends them through the remote check the policy card promises a verified customer '
      + 'never sees — for a document a human already held in their hand.');
    assert.doesNotMatch(String(a.blocker || ''), /No ID has been seen yet/,
      'the ladder still says no ID has been seen, for a person whose ID has been seen');
  });
});

/* ── 2 · THE SEAT, AND THE SETTLE SEAM IT FEEDS ──────────────────────────── */

test('the register seats the STORED record, so the sale can settle the visit', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await checkInFromRegisterTile(app, { first: 'Katherine', last: 'Johnson' });
    const m = HW.MEMBERS.find((x) => x.first_name === 'Katherine' && x.last_name === 'Johnson');
    assert.ok(m, 'no member was created');

    // openCheckInFor is EXACTLY what recordTicket() calls to settle the visit
    // when the sale is tendered. If this is null the sale cannot end the
    // check-in, and 'served' and 'walked out' become the same event.
    const found = HW.openCheckInFor(m);
    assert.ok(found,
      'HW.openCheckInFor() cannot find the visit for the customer sitting on the register. '
      + 'recordTicket() settles a check-in through this exact call, so on this path a completed '
      + 'sale would leave the customer on the board for ever.');

    assert.notEqual(m.id, 'new',
      "the record kept the modal's `id: 'new'` placeholder as a real member id");
    assert.ok(app.text().includes('Katherine'),
      'the check-in wrote to the store but never seated the customer on the register');
  });
});

/**
 * ⚠️ THE RETURNING-CUSTOMER PATH IS WHERE SEATING THE LITERAL BECOMES VISIBLE,
 * and it is the reason this test exists separately from the one above.
 *
 * For a NEW customer the modal's literal and the stored record look almost
 * identical — the only difference is the id — so nothing on screen changes when
 * the wrong one is seated, and the damage is deferred to the settle seam. For a
 * RETURNING customer they are nothing alike: pos/checkin.jsx's linkMember pushes
 * `{ key, id, name, first_name, last_name, dob, phone, member, doc }` and that is
 * ALL. No `points`, no `type`. The customer chip renders
 * `{customer.points} pts · {customer.type}`, so seating the literal puts
 * "undefined pts · undefined" on the register in front of a loyalty member with
 * 340 points on file.
 *
 * Manisha Saini is chosen deliberately: she is MedicinalUser, so the same read
 * also proves the type on screen came from the record rather than from the
 * modal's Adult-Use-shaped default.
 */
test('a returning customer is seated from the BOOK, not from the modal literal', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const book = HW.MEMBERS.find((x) => x.name === 'Manisha Saini');
    assert.ok(book && book.points > 0,
      'the seed no longer has Manisha Saini with points — pick another member with an IDV doc '
      + 'on file and non-zero points, or this test proves nothing');

    await app.mount('RegisterScreen');
    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.type('Search by name', 'Manisha'), 'no search field in the check-in modal');
    await app.settle();
    assert.ok(app.click((t) => t.includes('Manisha Saini')),
      `no search result for a member who is in the book — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.ok(app.click('Check in'), `no Check in button — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    const screen = app.text();
    assert.doesNotMatch(screen, /undefined/,
      'the register is rendering "undefined" for a customer who is fully on file. It seated the '
      + "modal's literal instead of the record the store returned, and that literal carries no "
      + '`points`, no `type` and no `wallet` at all.');
    assert.ok(screen.includes('Points' + book.points),
      `the chip does not show the ${book.points} points the book holds for this member — `
      + 'the loyalty balance on the register is not the loyalty balance in the store');
    assert.ok(screen.includes('$' + book.wallet.toFixed(2)),
      `the ${book.wallet} of store credit on this member's record is not on the register, so a `
      + 'cashier cannot spend money the customer actually has');
  });
});

test('the party captured at check-in reaches the store, not just the screen', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const ci = HW.addCheckIn({ customer: { id: 'new', name: 'Mae Jemison',
      first_name: 'Mae', last_name: 'Jemison' },
    guests: [{ key: 'g-1', id: null, name: 'Sally Ride', member: false }] });
    assert.ok(ci, 'the store refused a well-formed check-in');
    assert.equal((ci.guests || []).length, 1,
      'the guest roster the operator built in the modal is not on the check-in record, so the '
      + 'party exists only in React state and nothing that reads CHECKINS knows about it');
  });
});

/**
 * ⚠️ THE ONE TEST THAT CATCHES SEATING THE LITERAL ON THE **NEW**-CUSTOMER PATH.
 *
 * Everything else in this file survives that mutation, and the reason is worth
 * writing down rather than rediscovering. For a RETURNING customer the modal
 * hands back the real MEMBERS object, so record and literal are the same thing.
 * For a NEW one they differ in exactly ONE field — `id`, which is the string
 * 'new' (pos/checkin.jsx:812) — and nothing renders an id. So the wrong seat is
 * completely invisible on screen, and the damage only surfaces here, at the end
 * of the sale, where recordTicket() calls HW.openCheckInFor(tk.person) and gets
 * null for a person whose id is 'new'.
 *
 * That is the whole argument for driving the money path instead of asserting on
 * the chip: the failure is not visible where the mistake is made.
 */
test('tendering a sale to a tile check-in SETTLES the visit as served', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await checkInFromRegisterTile(app, { first: 'Annie', last: 'Easley' });
    const m = HW.MEMBERS.find((x) => x.first_name === 'Annie' && x.last_name === 'Easley');
    assert.ok(m, 'no member was created');
    const logged = HW.CHECKIN_LOG.length;

    assert.ok(app.click('Add'), `nothing to add to the cart — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    const total = totalShown(app);
    assert.ok(total > 0, 'the cart shows no total to tender');
    await tenderCash(app, total);

    assert.ok(HW.CHECKIN_LOG.length > logged,
      'the sale completed and NOTHING settled the visit. recordTicket() ends a check-in through '
      + 'HW.openCheckInFor(tk.person); if the register seated the modal literal that person '
      + "carries `id: 'new'`, no row matches, and the customer stays on the waiting board after "
      + 'being served — making a completed sale and a walk-out the same event.');
    const entry = HW.CHECKIN_LOG.find((e) => e.memberId === m.id);
    assert.ok(entry, 'something settled, but not this customer\'s visit');
    assert.equal(entry.outcome, 'served',
      `the visit ended as "${entry.outcome}" for a customer who bought something`);
    assert.ok(!HW.CHECKINS.some((c) => c.memberId === m.id),
      'the served customer is still on the waiting board');
  });
});

/* ── 3 · A REFUSAL IS NOT A CHECK-IN ─────────────────────────────────────── */

test('when the store refuses, the register does not report a check-in', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    // addCheckIn returns null rather than throwing. A handler that ignores that
    // return and reports success anyway is this same defect one step quieter —
    // which is precisely how the shipped code behaved, since it never looked at
    // a return value at all.
    const real = HW.addCheckIn;
    HW.addCheckIn = () => null;
    try {
      const members = HW.MEMBERS.length, checkins = HW.CHECKINS.length;
      await checkInFromRegisterTile(app, { first: 'Refused', last: 'Person' });

      assert.equal(HW.MEMBERS.length, members, 'the stub wrote a member — the test is not testing a refusal');
      assert.equal(HW.CHECKINS.length, checkins, 'the stub wrote a check-in row');

      const screen = app.text();
      assert.doesNotMatch(screen, /Refused Person checked in/,
        'the store refused the check-in and the register announced one anyway. Nothing was '
        + 'written and the operator was told it worked, which is the entire defect this file exists for.');
      assert.match(screen, /NOT recorded/,
        'a refused check-in passed in silence. Silence here reads as success to the person at '
        + 'the counter, who moves on to the next customer.');
      assert.doesNotMatch(screen, /Refused/,
        'the register seated a customer the store refused to record — the screen now shows a '
        + 'person the store has never heard of, which is the split this pass is closing');
    } finally { HW.addCheckIn = real; }
  });
});

/* ── 4 · THE SEARCH → SELECT PATH, DRIVEN FOR REAL ───────────────────────── */

/**
 * CustomerSearch is now rendered in the intake bar (the small search icon next
 * to "New check-in"), wired to `onSelect={checkInCustomer}`. Dony Fernandez
 * (m4) is chosen deliberately: he is the one seed member with NO existing
 * CHECKINS row (c1-c4 cover m1, m2, m3, m5), so this exercises exactly the gap
 * CustomerSearch fills — finding someone who is not already on the waiting
 * board, which WaitingStrip by construction cannot do.
 */
test('search → select on the register actually checks the customer in', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const before = HW.CHECKINS.length;

    await app.mount('RegisterScreen');
    assert.ok(app.click((t, el) => (el.title || '').includes('Check in a customer')),
      `no customer-search trigger on the register — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.ok(app.type('Search a customer', 'Dony'),
      'no search field in the customer-search dropdown');
    await app.settle();
    assert.ok(app.click((t) => t.includes('Dony Fernandez')),
      `no search result for Dony Fernandez — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.equal(HW.CHECKINS.length, before + 1,
      'selecting a search result did not write a CHECKINS row — the button looked wired but '
      + 'checkInCustomer produced no store effect, the exact silent-no-op this file exists to catch');
    const ci = HW.CHECKINS.find((c) => c.memberId === 'm4');
    assert.ok(ci, 'a check-in row exists but it is not bound to the member that was selected');
    assert.ok(app.text().includes('Dony Fernandez'),
      'the register did not seat the customer selected out of search');
  });
});

// ⚠️ SOURCE-SHAPE, NOT DRIVEN. The screen-level test above proves the wiring
// end to end for one path (a fresh check-in for an unclaimed member); these
// two keep asserting on checkInCustomer's internals directly — the null-means-
// -unchanged contract on type/delivery, and the no-whitespace-guessing rule —
// which a screen read would only prove indirectly.
test('[source] checkInCustomer writes to the store', () => {
  const body = SRC.slice(SRC.indexOf('const checkInCustomer'));
  const fn = body.slice(0, body.indexOf('\n  };') + 5);
  assert.ok(/window\.HW\.addCheckIn\(/.test(fn) || /window\.HW\.openCheckInFor\(/.test(fn),
    'checkInCustomer touches no store writer. It is unreachable today, so nothing on screen '
    + 'would tell you — and the moment CustomerSearch is wired up it ships the original bug '
    + 'back into the busiest surface in the building.');
  assert.ok(/type: null/.test(fn) && /delivery: null/.test(fn),
    'checkInCustomer must pass type/delivery as null to mean UNCHANGED. addCheckIn reads a '
    + "non-null `type` as an instruction, so a default of 'AdultUse' here silently re-designates "
    + 'every Medicinal patient picked out of search — different purchase limits, different tax.');
});

test('[source] no check-in handler guesses a given name out of whitespace', () => {
  // COMMENTS STRIPPED FIRST. The prose above these handlers QUOTES the defect
  // it removed — `m.name.split(' ')[0]` — and a source scan that reads its own
  // documentation as code fails on a file that is correct. A test that cannot
  // survive being explained is a test that punishes explaining things.
  const region = SRC.slice(SRC.indexOf('const onCheckIn'), SRC.indexOf('// ── Recording the sale'))
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.doesNotMatch(region, /\.name\.split\(/,
    'a check-in handler is still carving a first name out of the joined string. The record '
    + 'carries `first_name`/`last_name`; the identity ladder fingerprints on that pair, and a '
    + 'whitespace guess is wrong for every mononym and every double given name — which is how '
    + 'one human ends up with four profiles.');
  assert.match(region, /first_name/,
    'the handlers stopped splitting the name but never started reading the captured pair');
});

/* ══ MUTATION REGISTER ══════════════════════════════════════════════════════
 *
 * Every assertion above was broken deliberately, run RED, and restored.
 * pos/screen-register.jsx was verified byte-identical by sha256 after each
 * restore (1ea7d2251a57bcf9…); M7 touches pos/data.jsx and that file was
 * likewise verified back to 76b39995695859da… — the same digest it carried
 * before this pass began, so nothing was left behind in a file this pass does
 * not own.
 *
 * THE LOAD-BEARING ENTRY IS M1. It restores the shipped code exactly — the
 * addCheckIn call removed, the modal's literal seated — and it is the check that
 * would have caught the original defect.
 *
 *   M1  remove `window.HW.addCheckIn(p)` from onCheckIn and seat p.customer,
 *       i.e. THE SHIPPED CODE                                → RED, 5 tests:
 *         · member / check-in / IDV rows
 *         · assurance() sees the scan
 *         · seats the stored record
 *         · tendering settles the visit
 *         · a refusal is not reported as a check-in
 *   M2  seat `p.customer` instead of `memberById(ci.memberId)`
 *                                                            → RED, 1 test:
 *         · tendering settles the visit
 *       ⚠️ M2 SURVIVED TWO EARLIER VERSIONS OF THIS FILE, and that is the most
 *       useful thing in this register. Nothing on screen distinguishes the
 *       literal from the record on the new-customer path — they differ only in
 *       `id`, and no surface renders an id. The chip, the details panel and the
 *       waiting board all look correct. It is caught ONLY at the end of the
 *       money path, where openCheckInFor() gets null. A test that stopped at
 *       "the customer appears on the register" would have shipped this.
 *   M3  drop the `if (!ci) … return` guard and flash unconditionally
 *                                                            → RED, 1 test:
 *         · a refusal is not reported as a check-in
 *   M4  restore `rec.name.split(' ')[0]` in checkInCustomer   → RED, 1 test:
 *         · [source] no handler guesses a given name
 *   M5  drop the store calls from checkInCustomer entirely    → RED, 1 test:
 *         · [source] checkInCustomer writes to the store
 *   M6  pass `type: 'AdultUse', delivery: 'Pick-up'` from checkInCustomer
 *       instead of null/null                                 → RED, 1 test:
 *         · [source] checkInCustomer writes to the store
 *   M7  drop `guests: (p.guests || []).slice()` from the addCheckIn record
 *       (pos/data.jsx, restored byte-identical)              → RED, 1 test:
 *         · the party reaches the store
 *   M8  seat a hand-built `{ id, name, type }` literal rather than the book
 *       record                                               → RED, 2 tests:
 *         · seats the stored record  · tendering settles the visit
 */
