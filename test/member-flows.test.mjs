/* The Members / check-in create-flows, driven the way a person drives them.
 *
 * Same lesson as add-product-flow.test.mjs, one layer worse. There the button
 * refused in silence; here SIX controls reported success and wrote nothing:
 * the check-in modal's payload was dropped by its callers, "Apply credit" was
 * `onClick={() => setModal(null)}`, "Done editing" only flipped a boolean, the
 * address form's four inputs had no value and no onChange, and a plain note
 * fell through a handler that only looked at the hot branch.
 *
 * A create that closes its modal and writes nothing is the worst shape of all,
 * because the operator is TOLD it worked. Every test below asserts the record,
 * never the modal closing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── driving helpers ─────────────────────────────────────────────────────── */

/** Set a controlled input/textarea the way a keystroke does — React listens for
 *  `input`, and assigning `.value` alone never reaches its onChange. */
function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  const proto = el.tagName === 'TEXTAREA'
    ? app.window.HTMLTextAreaElement.prototype : app.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
const inputs = (app) => [...app.document.querySelectorAll('input')];
const byPlaceholder = (app, ph) => inputs(app).find((i) => (i.getAttribute('placeholder') || '').includes(ph));
const btn = (app, re) => [...app.document.querySelectorAll('button')]
  .find((b) => re.test((b.textContent || '').trim()));

/** Open a member's page by clicking their table row.
 *  ⚠️ app.click() only reaches button/a/[data-hw-i]; a <tr> needs its own
 *  dispatch. Asserting the row was found is what stops this from "passing"
 *  against a click that landed on nothing. */
function openMember(app, name) {
  const row = [...app.document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes(name));
  assert.ok(row, `no table row for ${name}`);
  row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** A CIField is a labelled input with no placeholder, so it can only be found
 *  by the label sitting immediately above it. */
function fieldByLabel(app, label) {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
}

/** The simulated ID read resolves on a 700ms timer inside IdScanPanel. */
const afterScan = (app) => new Promise((r) => setTimeout(r, 900));

/** New check-in → SCAN → (form opens pre-filled) → name → Create customer.
 *  Leaves the modal on its footer, one click from "Check in".
 *
 *  ⚠️ THIS HELPER CHANGED, AND THE CHANGE IS THE POINT. It used to click a
 *  "New" button beside the search box and type into a BLANK form. That button
 *  is gone: it asked the operator to declare "this person is new" at the one
 *  moment they cannot know it — the same defect as the New/Returning toggle the
 *  owner deleted — and it captured no verification, so the customer it created
 *  was tier 0 and would later be sent through a remote ID check they had
 *  already earned their way out of at the counter. The scan decides, opens the
 *  form pre-filled from the barcode, and attaches the document. The name is
 *  still typed here only because this test needs a known probe name. */
async function newCustomerCheckIn(app, name) {
  assert.ok(app.click('New check-in'), 'the New check-in tile did not exist');
  await app.settle();
  assert.ok(app.click('Scan ID'), 'no ID scanner in the check-in modal — the scan IS the way in');
  await afterScan(app);
  await app.settle();
  const field = fieldByLabel(app, 'Full name');
  assert.ok(field, 'the scan did not open the new-customer form pre-filled');
  assert.notEqual(field.value.trim(), '',
    'the barcode carries the legal name — an empty box means the pre-fill was dropped');
  setValue(app, field, name);
  await app.settle();
  assert.ok(app.click('Create customer'), 'no Create customer button');
  await app.settle();
}

/* THE BUYER IS HELD TO THE SAME BAR AS THEIR FRIEND.
 * "Create customer" was gated on a non-empty name alone, while a GUEST could
 * not join the party without a scanned document — so the person whose age
 * actually has to be verified for the sale cleared a weaker check than the
 * person standing behind them. */
test('Check-in: the primary customer cannot be created from a typed name alone', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('New check-in'), 'the New check-in tile did not exist');
    await app.settle();
    assert.equal(app.buttons().filter((b) => b === 'New').length, 0,
      'the pre-emptive "New" button is back — it asks a question the scan answers');
    // Reach the manual form the only way it is now reachable: a search that
    // matches nobody.
    // The modal's own field. Three inputs on this page contain a search
    // placeholder — the check-in strip's 'Search customer by e-mail or phone'
    // and the members table's 'Search by name, email, phone…' both match
    // shorter fragments and would be typed into instead.
    assert.ok(app.type('by name, e-mail or phone', 'Zzz Nobody Probe'), 'no manual search field');
    await app.settle();
    assert.ok(app.click('Enter manually'), 'a search with no match must still offer a manual path');
    await app.settle();
    const field = fieldByLabel(app, 'Full name');
    assert.ok(field, 'no Full name field in the manual form');
    setValue(app, field, 'Zzz Nobody Probe');
    await app.settle();
    const create = [...app.document.querySelectorAll('button')]
      .find((b) => (b.textContent || '').trim() === 'Create customer');
    assert.ok(create, 'no Create customer button');
    assert.ok(create.disabled, 'a typed name with no document must NOT create the buyer');
    assert.match(app.text(), /Scan the ID first/,
      'a disabled button with no stated reason makes the operator guess the blocker');
  });
});

/* ── 1. check-in creates a check-in ──────────────────────────────────────── */

test('MembersScreen: a completed check-in creates the check-in AND the customer', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const checkins0 = app.window.HW.CHECKINS.length;
    const members0 = app.window.HW.MEMBERS.length;

    await newCustomerCheckIn(app, 'Rosa Probe');
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    assert.equal(app.window.HW.CHECKINS.length, checkins0 + 1,
      'the modal closed and nothing was written — the payload was dropped again');
    assert.equal(app.window.HW.MEMBERS.length, members0 + 1,
      'a person waiting in the room who exists on no record is not a check-in');
    assert.match(app.text(), /Rosa Probe/,
      'the record exists but the screen never re-rendered, which reads as broken');
    assert.match(app.text(), new RegExp(`${checkins0 + 1} waiting`),
      'the waiting count must move with the queue');
  });
});

test('OrdersScreen: "check in & start sale" books the check-in and hands over the customer', async () => {
  await withApp('pos', async (app) => {
    await app.mount('OrdersScreen');
    const checkins0 = app.window.HW.CHECKINS.length;

    await newCustomerCheckIn(app, 'Rosa Probe');
    assert.ok(app.click((t) => /^Check in & start sale$/.test(t)), 'no start-sale button');
    await app.settle();

    assert.equal(app.window.HW.CHECKINS.length, checkins0 + 1, 'the check-in was not created');
    assert.match(app.text(), /Rosa Probe/, 'the new check-in is missing from the strip');
    const pending = app.window.HW.takePendingSale();
    assert.ok(pending, 'the sale started with nobody attached — it would open on the demo ticket');
    assert.equal(pending.customer.name, 'Rosa Probe',
      'the sale must open on the person who just checked in');
    assert.deepEqual(app.errors.join(' | '), '', 'the flow must not throw on the way through');
  });
});

test('...and the register opens on that person rather than its default ticket', async () => {
  // The negative control for the hand-off: without startSaleFor the register
  // seeds itself with HW.MEMBERS[2] (Girish Sharma), which is exactly the bug.
  await withApp('pos', async (app) => {
    const who = app.window.HW.MEMBERS.find((m) => m.name === 'Dony Fernandez');
    app.window.HW.startSaleFor(who, []);
    await app.mount('RegisterScreen');
    assert.match(app.text(), /Dony Fernandez/, 'the register ignored the checked-in customer');
    // The demo ticket arrives with two products already in the cart; a real
    // check-in starts empty. (Girish's NAME still appears — he is one of the
    // people in the waiting strip — so the cart is what tells the two apart.)
    assert.match(app.text(), /Cart is empty/, 'it fell back to the seeded demo ticket');
  });
});

test('...and with nothing pending the register still seeds its own ticket', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    assert.match(app.text(), /Girish Sharma/, 'the default ticket disappeared');
  });
});

/* ── 2. wallet credit ────────────────────────────────────────────────────── */

test('Adjust wallet: "Apply credit" actually credits the wallet', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    const before = app.window.HW.MEMBERS.find((m) => m.name === 'Manisha Saini').wallet;

    assert.ok(app.click('Adjust wallet'), 'no Adjust wallet button');
    await app.settle();
    assert.ok(app.click('Apply credit'), 'no Apply credit button');
    await app.settle();

    const after = app.window.HW.MEMBERS.find((m) => m.name === 'Manisha Saini').wallet;
    assert.equal(after, before + 10, 'the manager was told the credit applied and it did not');
    assert.match(app.text(), new RegExp('\\$' + after.toFixed(2)),
      'the Wallet tile still shows the old balance');
    assert.match(app.text(), /Wallet credit \$10\.00 · Service recovery/,
      'money moved with no entry in the activity feed');
  });
});

test('...and a zero / empty amount is refused OUT LOUD, not silently', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Adjust wallet');
    await app.settle();
    setValue(app, inputs(app).find((i) => i.value === '10.00'), '');
    await app.settle();

    const b = btn(app, /^Apply credit$/);
    assert.equal(b.disabled, true, 'a credit button that does nothing must not look clickable');
    assert.match(app.text(), /Enter an amount above \$0\.00/, 'it must say why');
  });
});

/* ── 3. Add member — the documented silent-refusal shape ─────────────────── */

test('Add Member: Create member is DISABLED until the form is complete, and SAYS what is missing', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('Add Member'), 'no Add Member button');
    await app.settle();

    const b = btn(app, /^Create member$/);
    assert.ok(b, 'no Create member button');
    assert.equal(b.disabled, true,
      'five clicks that move nothing and raise nothing is what "it just does not work" means');
    // The un-scanned ID is the real blocker and the one the screen never named.
    assert.match(app.text(), /Still needs scan the government ID/,
      'it must name the blocker — a faded button is not feedback');
  });
});

test('...and a completed form creates the member', async () => {
  // Negative control. Without it the test above is just as happy with a button
  // that is disabled forever.
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    const before = app.window.HW.MEMBERS.length;
    app.click('Add Member');
    await app.settle();

    // The scan button's label is product copy and has changed once already
    // ("Scan ID & capture photo" -> "Scan ID" when the panel gained a
    // new/returning mode toggle). This asserts the FLOW, not the wording, so it
    // finds the button by its stable prefix rather than an exact sentence.
    const scanBtn = btn(app, /^Scan ID/);
    assert.ok(scanBtn, 'no scan button');
    scanBtn.click();
    await new Promise((r) => setTimeout(r, 1100));   // the simulated scanner takes 700ms
    setValue(app, byPlaceholder(app, '(951) 555-0100'), '(951) 555-0123');
    await app.settle();
    setValue(app, byPlaceholder(app, 'Jane Doe'), 'Rosa Probe');
    await app.settle();

    const b = btn(app, /^Create member$/);
    assert.equal(b.disabled, false, 'a complete form must unblock the button');
    app.click('Create member');
    await app.settle();

    assert.equal(app.window.HW.MEMBERS.length, before + 1, 'no member record was created');
    assert.match(app.text(), /Rosa Probe/, 'the new member is missing from the table');
  });
});

/* ── 4. editing a member ─────────────────────────────────────────────────── */

test('Edit member: the edit is saved, and survives going back to the table', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();

    assert.ok(app.click('Edit member'), 'no Edit member button');
    await app.settle();
    setValue(app, inputs(app).find((i) => i.value === 'Manisha Saini'), 'Manisha Sainz');
    await app.settle();
    assert.ok(app.click('Save changes'), 'no Save changes button');
    await app.settle();

    assert.equal(app.window.HW.MEMBERS.find((m) => m.id === 'm2').name, 'Manisha Sainz',
      'the edit lived in local state and was never written back');
    assert.ok(app.click('Back to members'), 'no back button');
    await app.settle();
    assert.match(app.text(), /Manisha Sainz/,
      'the table reverted — the edited name was on screen right up until you navigated away');
  });
});

test('...and Discard leaves the record alone', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Edit member');
    await app.settle();
    setValue(app, inputs(app).find((i) => i.value === 'Manisha Saini'), 'Wrong Name');
    await app.settle();
    assert.ok(app.click('Discard'), 'no Discard button');
    await app.settle();
    assert.equal(app.window.HW.MEMBERS.find((m) => m.id === 'm2').name, 'Manisha Saini',
      'Discard wrote the edit anyway');
  });
});

/* ── 5. delivery addresses ───────────────────────────────────────────────── */

test('Add address: the four fields are wired and Save creates the address', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();

    assert.ok(app.click('Add address'), 'no Add address button');
    await app.settle();
    for (const [ph, v] of [['Label', 'Mum'], ['Street address', '12 Probe Way'], ['City', 'Corona'], ['ZIP', '92879']]) {
      setValue(app, byPlaceholder(app, ph), v);
      await app.settle();
    }
    assert.ok(app.click('Save'), 'no Save button');
    await app.settle();

    assert.match(app.text(), /12 Probe Way/,
      'the address the operator entered for a delivery customer was discarded');
    // 92879 is in no region — the honest answer, and the one the panel promises.
    assert.match(app.text(), /Not served/, 'an unserved ZIP must be flagged, not hidden');
  });
});

test('...and Save is refused OUT LOUD while the address is incomplete', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Add address');
    await app.settle();
    setValue(app, byPlaceholder(app, 'Label'), 'Mum');
    await app.settle();

    const b = btn(app, /^Save$/);
    assert.equal(b.disabled, true, 'Save must not look clickable with an empty address');
    assert.match(app.text(), /Still needs a street address, a city and a 5-digit ZIP/,
      'it must say what is missing');
  });
});

/* ── 6. notes ────────────────────────────────────────────────────────────── */

test('Add note: a plain internal note is kept and shown in Activity', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();

    assert.ok(app.click('Add note'), 'no Add note button');
    await app.settle();
    setValue(app, app.document.querySelector('textarea'), 'Prefers evening delivery, called ahead.');
    await app.settle();
    assert.ok(app.click('Save note'), 'no Save note button');
    await app.settle();

    assert.match(app.text(), /Prefers evening delivery, called ahead\./,
      'the note evaporated — the modal closed and it appears nowhere on the profile');
  });
});

test('...and the hot-note path still pins to the banner', async () => {
  // The control that made the plain path look functional: hot notes always
  // worked, so the bug only showed on the quiet half of the same modal.
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Add note');
    await app.settle();

    const label = [...app.document.querySelectorAll('label')]
      .find((l) => /Make this a hot note/.test(l.textContent || ''));
    assert.ok(label, 'no hot-note toggle');
    label.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    setValue(app, app.document.querySelector('textarea'), 'Blocked the driver at the door.');
    await app.settle();
    assert.ok(app.click('Save hot note'), 'no Save hot note button');
    await app.settle();

    assert.match(app.text(), /Blocked the driver at the door\./, 'the hot note did not pin');
  });
});

test('...and Save note is refused OUT LOUD on an empty note', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Add note');
    await app.settle();
    assert.equal(btn(app, /^Save note$/).disabled, true,
      'an empty note must not look saveable');
  });
});
