/* ── A LABEL THAT SURVIVES BEING FILLED, AND A WARNING THAT WAITS ────────────
 *
 * [OWNER RULING 2026-08-27] "each customer parameter needs a dedicated input
 *  field, we cannot have dirty data — first name / last name / street number +
 *  street name / city / state / zip — everything needs its own separate field.
 *  fix it system-wide"
 *
 * A SEPARATE FILE on purpose. test/customer-field-split.test.mjs and
 * test/capture-split-surfaces.test.mjs are both being edited by concurrent
 * sessions, and two sessions in one file is how a merge quietly eats an
 * assertion. Everything here is new behaviour, so it has somewhere of its own
 * to live.
 *
 * TWO DEFECTS, BOTH FOUND IN A BROWSER RATHER THAN IN JSDOM, and both of them
 * are the SPLIT DEFEATING ITSELF — the fix for dirty data creating a new way to
 * misread the form:
 *
 *   1. THE FIVE BOXES HAD NO NAMES. Splitting one address box into five and
 *      labelling them only with placeholders means that the moment they are
 *      filled, nothing on screen says which is which: "3400" sits in one box
 *      and "S Las Vegas Blvd" in another, and a placeholder is the one piece of
 *      text guaranteed to be gone by then. Both of these panels are re-opened
 *      to CHECK an address, not only to type one. That moved the ambiguity out
 *      of the parser and into the operator's eyes; it did not remove it.
 *
 *   2. THE REFUSAL FIRED BEFORE THE FORM WAS STARTED. "Still needs a label, a
 *      street number, …" rendered the instant the panel opened, listing six
 *      things nobody had yet had the chance to type. An unstarted form is not a
 *      form with errors. This is the SAME principle the split work already
 *      carries one field over — an empty box is an ABSENCE, not a fault, and
 *      warning on every untouched field is precisely how operators learn to
 *      read past the warning that matters.
 *
 * Each half below is paired with its negative control, because the lazy way to
 * pass 1 is to add a label nobody can see, and the lazy way to pass 2 is to
 * delete the warning outright — and a suite that cannot tell those apart from
 * the fix is not defending anything.
 *
 * ⚠️ JSDOM. `app.text()` is `body.textContent`, which NEVER contains a
 * placeholder attribute — that is exactly what makes it the right instrument
 * here: a label found in the text is a real element, not the placeholder being
 * read back. It still says nothing about whether the label is legible, or
 * whether six labelled boxes fit in a narrow panel on a phone. That needs a
 * browser and a person.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const inputs = (app) => [...app.document.querySelectorAll('input')];
const byPlaceholder = (app, ph) => inputs(app).find((i) => (i.getAttribute('placeholder') || '').includes(ph));
function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
function openMember(app, name) {
  const row = [...app.document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes(name));
  assert.ok(row, `no table row for ${name}`);
  row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
/** Open the POS delivery address book on a seeded member and start a new address. */
async function addressForm(app) {
  await app.mount('MembersScreen');
  openMember(app, 'Manisha Saini');
  await app.settle();
  assert.ok(app.click('Add address'), 'no Add address button');
  await app.settle();
}
/** Open the storefront address editor. */
async function shopForm(app) {
  app.window.SCO_STATE.addr = { streetNumber: '', streetName: '', city: '', state: '', zip: '' };
  app.window.SCO_STATE.address = '';
  app.window.__LabProbe = () => app.window.React.createElement(app.window.ShopAddressRow, { onChange: () => {} });
  await app.mount('__LabProbe');
  assert.ok(app.click('Add Address'), 'no Add Address control');
  await app.settle();
}

/* ═══ 1. THE POS DELIVERY ADDRESS BOOK ══════════════════════════════════════ */

test('an UNTOUCHED address form does not accuse the operator of anything', async () => {
  await withApp('pos', async (app) => {
    await addressForm(app);
    // Opening the panel is not an attempt to save it. This line used to greet
    // the operator with all six parameters listed as missing, every single
    // time, before a key was pressed.
    assert.doesNotMatch(app.text(), /Still needs/,
      'the refusal fires on a form nobody has started — an ABSENCE reported as a fault. An ' +
      'operator who meets the amber every time they open the panel learns to read past it, ' +
      'and then it is worth nothing on the address that really is half-filled');
  });
});

test('the refusal STILL fires the moment the form is started, naming every missing part', async () => {
  // THE NEGATIVE CONTROL, and the whole reason the test above is not satisfied
  // by deleting the warning. The gate is "has anybody typed", not "never warn".
  await withApp('pos', async (app) => {
    await addressForm(app);
    setValue(app, byPlaceholder(app, 'Label'), 'Mum');
    await app.settle();

    const t = app.text();
    assert.match(t, /Still needs/, 'one keystroke must bring the refusal back — the form is now started');
    for (const frag of ['a street number', 'a street name', 'a city', 'a 2-letter state', 'a 5-digit ZIP']) {
      assert.ok(t.includes(frag), `the refusal no longer names the missing "${frag}"`);
    }
    assert.ok(!t.includes('a label'), 'the one field that WAS filled is still being demanded');
  });
});

test('typing and then clearing the form returns it to unstarted, not to a form in error', async () => {
  await withApp('pos', async (app) => {
    await addressForm(app);
    setValue(app, byPlaceholder(app, 'Label'), 'Mum');
    await app.settle();
    assert.match(app.text(), /Still needs/, 'precondition: the started form warns');

    setValue(app, byPlaceholder(app, 'Label'), '');
    await app.settle();
    // "Started" is derived from the boxes themselves rather than latched on the
    // first keystroke, so undoing the typing genuinely undoes the state. A
    // latch would leave the operator staring at a six-item complaint about a
    // form that is empty again.
    assert.doesNotMatch(app.text(), /Still needs/,
      'the form is empty again and is therefore unstarted again — a warning that can never be ' +
      'dismissed is a warning that gets ignored');
  });
});

test('every split box is NAMED, and the name is still there once the box is full', async () => {
  await withApp('pos', async (app) => {
    await addressForm(app);
    // Fill every box, which is precisely when a placeholder stops existing and
    // an unlabelled form becomes unreadable.
    for (const [ph, v] of [['Label', 'Sister'], ['Street no.', '3400'], ['Street name', 'S Las Vegas Blvd'],
                           ['City', 'Las Vegas'], ['State', 'NV'], ['ZIP', '89109']]) {
      setValue(app, byPlaceholder(app, ph), v);
      await app.settle();
    }
    // `text()` is textContent and a placeholder attribute is NOT in it, so
    // finding these words proves a real label element exists on the page.
    const t = app.text();
    for (const label of ['Label', 'Street no.', 'Street name', 'City', 'State', 'ZIP']) {
      assert.ok(t.includes(label),
        `"${label}" names no element once its box is filled — with "3400" in one box and ` +
        '"S Las Vegas Blvd" in another, nothing on screen says which parameter is which, ' +
        'which moves the ambiguity out of the parser and into the operator rather than ' +
        'removing it');
    }
  });
});

/* ═══ 2. THE STOREFRONT CHECKOUT ════════════════════════════════════════════ */

test('the storefront does not open its address editor by telling the buyer they are wrong', async () => {
  await withApp('shop', async (app) => {
    await shopForm(app);
    // On a storefront this is worse than noise. The first thing the page did
    // after "Add Address" was list four things the customer had got wrong
    // before they had typed a character.
    assert.doesNotMatch(app.text(), /Still needs/,
      'the refusal renders on an untouched storefront form — the page greets a buyer who has ' +
      'typed nothing with a list of their failures');
  });
});

test('the storefront refusal returns on the first keystroke, still naming each part', async () => {
  // Negative control again: the fix is a gate, not a deletion.
  await withApp('shop', async (app) => {
    await shopForm(app);
    setValue(app, byPlaceholder(app, 'Street no.'), '3400');
    await app.settle();

    const t = app.text();
    assert.match(t, /Still needs/, 'the started form must refuse out loud');
    for (const frag of ['a street name', 'a city', 'a 2-letter state', 'a 5-digit ZIP']) {
      assert.ok(t.includes(frag), `the refusal does not name the missing "${frag}"`);
    }
    assert.ok(!t.includes('a street number'), 'a field that WAS filled is still being demanded');
  });
});

test('the storefront names each of its five boxes, and keeps naming them when filled', async () => {
  await withApp('shop', async (app) => {
    await shopForm(app);
    for (const [ph, v] of [['Street no.', '3400'], ['Street name', 'S Las Vegas Blvd'],
                           ['City', 'Las Vegas'], ['State', 'NV'], ['ZIP', '89109']]) {
      setValue(app, byPlaceholder(app, ph), v);
      await app.settle();
    }
    const t = app.text();
    for (const label of ['Street no.', 'Street name', 'City', 'State', 'ZIP']) {
      assert.ok(t.includes(label),
        `"${label}" names no element once filled — this is the form a customer re-opens to ` +
        'CHECK the address an order is about to be driven to');
    }
  });
});

/* ═══ 3. THE SEEDER MINTS SPLIT RECORDS, NOT LEGACY ONES ════════════════════ */

test('a seeded customer is born with dedicated first and last names', async () => {
  await withApp('pos', async (app) => {
    const Seed = app.window.HWSeed, HW = app.window.HW;
    const r = Seed.customer();
    assert.equal(r.ok, true, r.message);

    const m = HW.MEMBERS.find((x) => x.id === r.id);
    assert.ok(m, 'the seeded customer is not in the book');
    // THE DEFECT: this seeder wrote a joined `name` and nothing else, so every
    // customer it minted was born in exactly the legacy shape the whole split
    // exists to retire — and the next reader had to guess the pair back out.
    // The generator HAD both halves (a human typed them into the list) and
    // threw the pair away, which is the identical defect engage/data.jsx was
    // fixed for.
    assert.equal(typeof m.first_name, 'string', 'no dedicated first_name on a freshly seeded customer');
    assert.equal(typeof m.last_name, 'string', 'no dedicated last_name on a freshly seeded customer');
    assert.ok(m.first_name.length > 0, 'the seeded first name is empty');
    assert.ok(m.last_name.length > 0, 'the seeded last name is empty');
    // DERIVED, not a second independent copy — two stored copies of one fact
    // drift, and after they drift nothing says which the fingerprint used.
    assert.equal(m.name, app.window.HWName.join(m.first_name, m.last_name),
      'the joined `name` disagrees with the split pair beside it on the very record that was ' +
      'just created from that pair');
  });
});

test('a seeded MONONYM keeps an empty surname rather than copying the first', async () => {
  await withApp('pos', async (app) => {
    const Seed = app.window.HWSeed, HW = app.window.HW;
    const r = Seed.customer({ name: 'Ng' });
    const m = HW.MEMBERS.find((x) => x.id === r.id);

    assert.equal(m.first_name, 'Ng');
    assert.equal(m.last_name, '',
      'copying the single token into the surname would mint a name_dob_fp for a surname we do ' +
      'not have, and collide with everyone genuinely carrying "Ng" as one — the server returns ' +
      'None for a missing last name, which is the honest outcome');
    assert.equal(m.name, 'Ng', 'the derived display name must not carry a trailing space');
  });
});

test('an explicit first/last pair is taken as GIVEN and never re-split', async () => {
  // The caller knows both halves. Running them back through the splitter would
  // turn a fact into an inference for no reason at all.
  await withApp('pos', async (app) => {
    const Seed = app.window.HWSeed, HW = app.window.HW;
    const r = Seed.customer({ first: 'Mary Jo', last: 'Van Der Berg' });
    const m = HW.MEMBERS.find((x) => x.id === r.id);

    assert.equal(m.first_name, 'Mary Jo');
    assert.equal(m.last_name, 'Van Der Berg',
      'the compound surname the caller supplied was re-derived by the last-token rule, which ' +
      'gets this exact name wrong — the one name the whole guess-marking effort is named after');
    assert.equal(m.name, 'Mary Jo Van Der Berg');
  });
});
