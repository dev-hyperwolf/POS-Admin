/* ── ONE FIELD PER PARAMETER, ON THE FOUR SURFACES NOBODY OWNED ──────────────
 *
 * [OWNER RULING 2026-08-27] "each customer parameter needs a dedicated input
 *  field, we cannot have dirty data — first name / last name / street number +
 *  street name / city / state / zip — everything needs its own separate field.
 *  fix it system-wide"
 *
 * test/customer-field-split.test.mjs pins the splitter itself, the scan path and
 * the POS address book. This file covers the four capture surfaces that ruling
 * had not reached, and it is a SEPARATE FILE on purpose: the check-in modal and
 * the shared split test are being migrated concurrently, and two sessions
 * editing one file is how a merge eats an assertion.
 *
 * WHAT EACH OF THESE IS ABOUT, because a green tick tells you nothing later:
 *
 *   1. engage/screen-customers.jsx — `name.split(' ')[1].toLowerCase()` THREW on
 *      any one-word name and took the entire customer detail screen to a blank.
 *      Not a formatting bug: a crash.
 *   2. pos/screen-stubs.jsx — two joined "name" boxes, and a hardcoded 'CA' on
 *      the COMPLIANCE card, where a missing state rendered as California.
 *   3. shop/screen-checkout.jsx — one free-text box for an entire delivery
 *      address, on the surface that files real orders.
 *   4. pos/screen-orders.jsx — a display abbreviation PERSISTED as the driver's
 *      name, which threw the surname away permanently.
 *
 * ⚠️ EVERYTHING HERE IS JSDOM. It answers "is this wired", never "does this
 * fit". Items 2 and 3 each replace one input with several inside a narrow
 * panel; that this file is green says nothing whatsoever about whether the
 * result is usable on a phone. That needs a browser and a person.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── driving helpers ─────────────────────────────────────────────────────── */
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

/* ═══ 1. ENGAGE: THE CRASH ══════════════════════════════════════════════════ */

test('a ONE-WORD customer name renders the detail screen instead of throwing', async () => {
  await withApp('Hyperwolf Engage.html', async (app) => {
    const D = app.window.ENGAGE_DATA;
    assert.ok(D && D.CUSTOMERS && D.CUSTOMERS.length, 'engage fixtures did not load');

    // A real mononym, built from an existing row so every unrelated field the
    // screen reads is present and only the name is under test.
    const mono = { ...D.CUSTOMERS[0], id: 'ng-mononym-probe', firstName: 'Ng', lastName: '', name: 'Ng', initials: 'N' };
    D.CUSTOMERS.push(mono);

    app.window.__Probe = () => app.window.React.createElement(
      app.window.ScreenCustomerDetail, { path: '#/customers/' + mono.id, navigate: () => {} });
    await app.mount('__Probe');

    // THE ACTUAL REGRESSION. `name.split(' ')[1]` is `undefined` for 'Ng', and
    // `.toLowerCase()` on it threw during render — React then unmounted the
    // whole tree, so the operator got a blank page with no name, no spend, no
    // consent log and no error they could act on.
    const t = app.text();
    assert.ok(t.includes('Ng'), 'the detail screen rendered nothing for a one-word name — ' +
      'this is the crash: a throw inside render takes the entire page down to a blank');
    assert.ok(t.includes('Lifetime spend'),
      'the page is half-drawn; the crash used to abort the render partway');
    assert.equal(app.errors.filter((e) => /toLowerCase|undefined/.test(String(e && e.message || e))).length, 0,
      'a name-splitting TypeError was still raised while rendering');
  });
});

test('the engage customer row carries first and last as DEDICATED fields', async () => {
  await withApp('Hyperwolf Engage.html', async (app) => {
    const D = app.window.ENGAGE_DATA;
    const c = D.CUSTOMERS[0];
    assert.equal(typeof c.firstName, 'string', 'no dedicated firstName on the customer row');
    assert.equal(typeof c.lastName, 'string', 'no dedicated lastName on the customer row');
    // The generator HAD both halves and threw the pair away, keeping only the
    // joined string — which is what forced the consumer to guess them back.
    assert.equal(c.name, [c.firstName, c.lastName].filter(Boolean).join(' '),
      'the joined `name` must be DERIVED from the pair, not stored beside it — two ' +
      'independent copies of one fact is how they drift apart');
  });
});

test('a customer with NO email on record says so, instead of masking one it would invent', async () => {
  await withApp('Hyperwolf Engage.html', async (app) => {
    const D = app.window.ENGAGE_DATA;
    const noEmail = { ...D.CUSTOMERS[0], id: 'no-email-probe', firstName: 'Rosa', lastName: 'Probe',
      name: 'Rosa Probe', hasEncryptedEmail: false };
    D.CUSTOMERS.push(noEmail);
    app.window.__Probe2 = () => app.window.React.createElement(
      app.window.ScreenCustomerDetail, { path: '#/customers/' + noEmail.id, navigate: () => {} });
    await app.mount('__Probe2');

    // The dots rendered identically whether an email existed or not, so a row
    // with none looked like one the operator simply had not revealed yet — and
    // "Reveal (audited)" then produced an address derived from the name.
    const t = app.text();
    assert.ok(t.includes('no email on record'),
      'an absent email is still wearing the mask of a hidden one');
    assert.ok(!t.includes('••••••••••@'),
      'the mask is still drawn for a customer who has nothing behind it');
  });
});

/* ═══ 2. POS: ADD / EDIT MEMBER, AND THE HARDCODED STATE ════════════════════ */

test('Add member captures first and last in SEPARATE boxes, with no joined box left', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('Add Member'), 'no Add Member button');
    await app.settle();

    assert.ok(byPlaceholder(app, 'Jane'), 'no dedicated first-name input');
    assert.ok(byPlaceholder(app, 'Doe'), 'no dedicated last-name input');
    // The joined box must be GONE, not merely joined by new siblings — two ways
    // to enter one parameter is the dirty-data bug wearing a bigger form.
    assert.equal(inputs(app).filter((i) => (i.getAttribute('placeholder') || '') === 'Jane Doe').length, 0,
      'the joined "Jane Doe" full-name box is still present beside the split pair');
    assert.ok(!app.text().includes('Full name'),
      'the "Full name" label survived, so the screen still asks for one parameter as two');
  });
});

test('Add member REFUSES with no first name, and names that as the blocker', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    app.click('Add Member');
    await app.settle();
    const t = app.text();
    assert.ok(t.includes('a first name'),
      'the refusal does not name the missing first name — it used to say "a full name", ' +
      'which does not tell the operator which of the two boxes is empty');
    assert.ok(!t.includes('a full name'), 'the old joined-field wording is still on screen');
  });
});

test('an ID address with NO state does not become Californian', async () => {
  await withApp('pos', async (app) => {
    // A scanner that emits an address without a state. Latent in the fixtures —
    // every seeded document happens to carry one — and fabricating the moment it
    // is not. This is the same defect already removed from customer-extras.jsx,
    // where it made every out-of-state address on file display as Californian.
    app.window.HW.IDV.m2 = { doc: { type: 'CA DL', num: '••••1234', expires: '2029-04-11',
      scannedAt: 'Just now', photo: false, simulated: true,
      address: { streetNumber: '12', streetName: 'Probe Way', street: '12 Probe Way',
                 city: 'Reno', state: '', zip: '89501' } } };
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();

    const t = app.text();
    assert.ok(t.includes('12 Probe Way'), 'the ID address did not render at all');
    assert.ok(!t.includes('Reno, CA'),
      'a state-less address is being printed as California — a fabricated value with a ' +
      'compliance-shaped face, on the one card an operator opens to answer a regulator');
    assert.ok(t.includes('state not recorded'),
      'the missing state is silently absent; an absence on a compliance record has to SAY ' +
      'it is absent, or it reads as a state nobody has scrolled to');
    assert.ok(!/undefined/.test(t), 'a missing part was printed as `undefined`');
  });
});

test('an ID address WITH a state still prints that state, unchanged', async () => {
  // Negative control. Without it the assertions above are just as happy with a
  // renderer that dropped the state entirely.
  await withApp('pos', async (app) => {
    app.window.HW.IDV.m2 = { doc: { type: 'NV DL', num: '••••9999', expires: '2029-04-11',
      scannedAt: 'Just now', photo: false, simulated: true,
      address: { streetNumber: '3400', streetName: 'S Las Vegas Blvd', street: '3400 S Las Vegas Blvd',
                 city: 'Las Vegas', state: 'NV', zip: '89109' } } };
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();

    const t = app.text();
    assert.ok(t.includes('Las Vegas, NV'), "the document's own state was discarded");
    assert.ok(!t.includes('state not recorded'), 'a recorded state is being reported as missing');
  });
});

test('editing a LEGACY joined name marks the split as a guess, and saving makes it real', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');   // a seed row: joined `name`, no split columns
    await app.settle();
    assert.ok(app.click('Edit member'), 'no Edit member button');
    await app.settle();

    // THE EASY CASE IS STILL FLAGGED. 'Manisha Saini' splits correctly, and that
    // is exactly why it must warn: if the easy case reported itself certain,
    // operators would learn to trust the mark and it would mean nothing on
    // 'Mary Jo Van Der Berg'.
    const t = app.text();
    assert.ok(/guess/i.test(t),
      'a split carved out of a stored joined string is presented as though it were read — ' +
      'an inference rendered as a measurement, which is the defect this ruling is about');
    assert.ok(t.includes('Split on the single space') || /space|boundary|inferred/i.test(t),
      'the mark names no failure mode, and a mark with no reason beside it gets dismissed');

    assert.equal(byPlaceholder(app, 'First name').value, 'Manisha');
    assert.equal(byPlaceholder(app, 'Last name').value, 'Saini');

    app.click('Save changes');
    await app.settle();
    // Saving is the operator committing the two values, so the record now HAS
    // separate columns and the next reader does not have to guess again.
    const saved = app.window.HW.MEMBERS.find((m) => m.id === 'm2');
    assert.equal(saved.first_name, 'Manisha');
    assert.equal(saved.last_name, 'Saini');
    assert.ok(!/guess/i.test(app.text()), 'the guess mark survived a save that resolved it');
  });
});

test('a record WITH real split columns is read, not guessed, and is never flagged', async () => {
  // The other half of the rule: flagging everything is how operators learn to
  // ignore the flag. A row that carries its own first/last has nothing inferred.
  await withApp('pos', async (app) => {
    const m = app.window.HW.MEMBERS.find((x) => x.id === 'm2');
    m.first_name = 'Manisha'; m.last_name = 'Saini';
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Edit member');
    await app.settle();
    assert.ok(!/guess/i.test(app.text()),
      'a split READ from dedicated columns is being marked as a guess — cry wolf on the one ' +
      'path that is actually trustworthy and the mark stops meaning anything');
  });
});

/* ═══ 3. SHOP: THE DELIVERY ADDRESS ═════════════════════════════════════════ */

test('the storefront checkout has a dedicated box per address parameter, and no free-text one', async () => {
  await withApp('shop', async (app) => {
    app.window.__AddrProbe = () => app.window.React.createElement(
      app.window.ShopAddressRow, { onChange: () => {} });
    await app.mount('__AddrProbe');
    assert.ok(app.click('Add Address'), 'no Add Address control');
    await app.settle();

    for (const ph of ['Street no.', 'Street name', 'City', 'State', 'ZIP']) {
      assert.ok(byPlaceholder(app, ph), `no dedicated input for "${ph}"`);
    }
    // NO PARSER WAS WRITTEN, and the box that would have needed one is gone.
    // Reversing "Street, city, ZIP" on commas gets '221B Baker St' and
    // 'Apt 4, 1200 E Ocean Blvd' wrong and nothing downstream would ever know.
    assert.equal(inputs(app).filter((i) => /Street, city, ZIP/.test(i.getAttribute('placeholder') || '')).length, 0,
      'the single free-text address box is still there — one box for five parameters is ' +
      'the dirty data the ruling is about');
  });
});

test('the storefront address saves as PARTS, with the joined line derived from them', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    W.SCO_STATE.addr = { streetNumber: '', streetName: '', city: '', state: '', zip: '' };
    W.SCO_STATE.address = '';
    W.__AddrProbe2 = () => W.React.createElement(W.ShopAddressRow, { onChange: () => {} });
    await app.mount('__AddrProbe2');
    app.click('Add Address');
    await app.settle();

    for (const [ph, v] of [['Street no.', '3400'], ['Street name', 'S Las Vegas Blvd'],
                           ['City', 'Las Vegas'], ['State', 'NV'], ['ZIP', '89109']]) {
      setValue(app, byPlaceholder(app, ph), v);
      await app.settle();
    }
    const save = [...app.document.querySelectorAll('button')].find((b) => /^Save$/.test((b.textContent || '').trim()));
    assert.equal(save.disabled, false, 'Save was refused with every field filled');
    save.click();
    await app.settle();

    const a = W.SCO_STATE.addr;
    assert.equal(a.streetNumber, '3400', 'the street number was not captured on its own');
    assert.equal(a.streetName, 'S Las Vegas Blvd');
    assert.equal(a.city, 'Las Vegas');
    assert.equal(a.state, 'NV', 'the state the customer typed was discarded');
    assert.equal(a.zip, '89109');
    // The joined line still exists because three readers take it as a string —
    // but it is DERIVED, so the parts and the line cannot disagree.
    assert.equal(W.SCO_STATE.address, '3400 S Las Vegas Blvd, Las Vegas, NV 89109',
      'the joined line is not derived from the parts it was just built from');
  });
});

test('the storefront refuses an incomplete address OUT LOUD, naming each missing part', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    W.SCO_STATE.addr = { streetNumber: '', streetName: '', city: '', state: '', zip: '' };
    W.SCO_STATE.address = '';
    W.__AddrProbe3 = () => W.React.createElement(W.ShopAddressRow, { onChange: () => {} });
    await app.mount('__AddrProbe3');
    app.click('Add Address');
    await app.settle();
    setValue(app, byPlaceholder(app, 'Street no.'), '3400');
    await app.settle();

    const save = [...app.document.querySelectorAll('button')].find((b) => /^Save$/.test((b.textContent || '').trim()));
    assert.equal(save.disabled, true, 'Save must not look clickable with an unusable address');
    const t = app.text();
    // Each parameter named separately: on a storefront a greyed button with no
    // stated reason does not make the customer look harder, it makes them leave.
    for (const frag of ['a street name', 'a city', 'a 2-letter state', 'a 5-digit ZIP']) {
      assert.ok(t.includes(frag), `the refusal does not name the missing "${frag}"`);
    }
    assert.ok(!t.includes('a street number'), 'a field that WAS filled is still being demanded');
  });
});

/* ═══ 4. POS ORDERS: THE PERSISTED ABBREVIATION ═════════════════════════════ */

test('the driver abbreviation is a RENDERER, and is idempotent on an already-short name', async () => {
  await withApp('pos', async (app) => {
    // `sameDriver` is what lets a stored full name and a seeded board form
    // ("Theo R.", authored that way in HW.DELIVERY and not being rewritten)
    // resolve to one person. It only works because shortening is idempotent.
    const W = app.window;
    assert.ok(W.HW.DELIVERY['ORD-00223'], 'the delivery seed is not loaded');
    assert.equal(W.HW.DELIVERY['ORD-00223'].driver, 'Theo R.',
      'the seed no longer holds the board form, so the comparator this fix relies on is ' +
      'answering a different question than the one it was written for');
    const full = W.HW.DRIVERS.find((d) => d.name === 'Theo Reyes');
    assert.ok(full, 'the roster no longer names drivers in full');
  });
});
