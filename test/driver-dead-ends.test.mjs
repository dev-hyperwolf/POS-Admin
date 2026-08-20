/* D— THE FOUR DEAD ENDS IN THE DRIVER APP.
 *
 * Every test here drives the REAL screen through the ui-harness: mounts it with
 * real React in jsdom, clicks real buttons, and reads what the driver would see.
 * Each one FAILS on the code as it stood before this pass — the pre-fix screens
 * had, respectively: no close-out control on an appointment, no field to type a
 * support description into, a "Save response" that wrote nothing anywhere, and
 * "My tips $0.00" over a $25.00 tip bank.
 *
 * ⚠️ TWO HARNESS FACTS THIS FILE DEPENDS ON.
 *
 * 1. mobile/app.jsx is DELIBERATELY not loaded (the harness skips */ /*app.jsx so it
 *    does not boot a second router). window.MTopBar is defined there, so any
 *    pushed screen is unmountable until something supplies it. mountScreen()
 *    stubs it — a back button plus the title, which is all these tests read.
 * 2. app.type() reaches for HTMLInputElement.prototype's value setter, which
 *    throws on a <textarea>. typeInto() uses the right prototype per element.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Mount ONE screen with props (harness mount() passes none) + the MTopBar stub. */
async function mountScreen(app, name, props) {
  const R = app.window.React;
  app.window.MTopBar = ({ title, sub, right, onBack }) => R.createElement('div', null,
    R.createElement('button', { onClick: onBack || (() => app.window.M.pop()) }, 'Back'),
    R.createElement('span', null, ' ' + (title || '') + ' '),
    sub ? R.createElement('span', null, sub + ' ') : null, right || null);
  app.window.__Screen = () => R.createElement(app.window[name], props || {});
  await app.mount('__Screen');
  return app;
}

/** Type into an input OR textarea found by placeholder. Returns false if absent. */
function typeInto(app, placeholder, value) {
  const el = [...app.window.document.querySelectorAll('input,textarea')]
    .find((i) => (i.getAttribute('placeholder') || '').includes(placeholder));
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? app.window.HTMLTextAreaElement.prototype
    : app.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  return true;
}

/* ── 1. A SHOP@HOME APPOINTMENT CAN BE FINISHED ─────────────────────────────
 * The ID gate blocks SHOPPING and should. It must never block FINISHING:
 * "guest won't show ID" is the case that needs an ending most. */
test('an appointment offers a close-out, and it routes to the close-out screen', async () => {
  await withApp('driver', async (app) => {
    await mountScreen(app, 'AppointmentScreen', { taskId: 's1' });
    assert.ok(app.buttons().some((b) => b.includes('Close out appointment')),
      `an appointment with no ending is a dead end mid-visit. Buttons: ${app.buttons().join(' | ')}`);

    assert.equal(app.click('Close out appointment'), true, 'the control must be clickable');
    await app.settle();
    const top = app.window.M.s.stack[app.window.M.s.stack.length - 1];
    assert.ok(top, 'clicking close-out navigated nowhere');
    assert.equal(top.name, 'complete');
    assert.equal(top.props.taskId, 's1');
  });
});

test('the close-out is reachable with the ID gate CLOSED — the actual dead end', async () => {
  await withApp('driver', async (app) => {
    // appointments live in TASKS and SCHEDULED both; findTask() reads either.
    const all = [...app.window.MD.TASKS, ...app.window.MD.SCHEDULED];
    const t = all.find((x) => x.appt && !x.verified);
    assert.ok(t, 'precondition: an unverified appointment must exist in the seed');
    await mountScreen(app, 'AppointmentScreen', { taskId: t.id });
    // shopping is gated...
    assert.ok(app.text().includes("Scan the customer's ID to begin shopping"),
      'the gate must still say what it wants');
    // ...finishing is not.
    assert.equal(app.click('Close out appointment'), true);
    await app.settle();
    assert.equal(app.window.M.s.stack.pop().name, 'complete',
      'with no ID and no close-out the driver is stuck on this screen forever');
  });
});

/* ── 2. HELP ASKS FOR A DESCRIPTION AND CAN TAKE ONE ────────────────────────
 * Nothing here transmits, so the test pins BOTH halves: the description is
 * really captured, and no control claims it was sent. */
test('Help gives the driver somewhere to write the description it asks for', async () => {
  await withApp('driver', async (app) => {
    await mountScreen(app, 'HelpScreen', {});
    assert.ok(app.text().includes('brief description'), 'precondition: the copy still asks for one');
    assert.equal(typeInto(app, 'Describe the issue', 'Van door latch is jammed'), true,
      'the screen asks for a description and offers no field to type it in');
    await app.settle();
    assert.equal(app.click((t) => t === 'Save description'), true);
    await app.settle();
    assert.equal(app.window.localStorage.getItem('hw-m-helpdraft'), 'Van door latch is jammed',
      'the description went nowhere at all');
  });
});

test('Help never claims the message was sent, and the offline chat says so itself', async () => {
  await withApp('driver', async (app) => {
    await mountScreen(app, 'HelpScreen', {});
    const txt = app.text();
    assert.ok(/offline until/i.test(txt), 'the driver must be told chat is closed');
    assert.ok(/not sent|Nothing you write here is sent/i.test(txt),
      'a screen that cannot send must say it cannot send');

    // the empty state names what is missing rather than going quiet
    assert.ok(txt.includes('Type a brief description'), 'the disabled save must say what it wants');
    const save = [...app.window.document.querySelectorAll('button')]
      .find((b) => (b.textContent || '').trim() === 'Save description');
    assert.ok(save, 'the save control must exist even while empty');
    assert.equal(save.disabled, true, 'saving nothing must be refused, visibly');

    typeInto(app, 'Describe the issue', 'x');
    await app.settle();
    app.click((t) => t === 'Save description');
    await app.settle();
    assert.ok(!/\bsent to support\b(?!\s*yet)/i.test(app.text()),
      'nothing on this screen may claim the ticket reached support');
  });
});

test('a kept description comes back, and can be removed again', async () => {
  await withApp('driver', async (app) => {
    app.window.localStorage.setItem('hw-m-helpdraft', 'Bad seal on the cash bag');
    await mountScreen(app, 'HelpScreen', {});
    const box = app.window.document.querySelector('textarea');
    assert.ok(box, 'no field to hold the description');
    assert.equal(box.value, 'Bad seal on the cash bag', 'what was kept must come back');

    typeInto(app, 'Describe the issue', '');
    await app.settle();
    assert.equal(app.click('Remove kept description'), true,
      'clearing the box must offer a way to drop the kept text, not silently keep it');
    await app.settle();
    assert.equal(app.window.localStorage.getItem('hw-m-helpdraft'), null);
  });
});

/* ── 3. THE LOSS-PREVENTION RESPONSE IS ACTUALLY RECORDED ───────────────────
 * The old button flashed "Response saved for loss prevention" and wrote
 * nothing. A false confirmation on a loss-prevention record is worse than no
 * button, so the claim now has to be true and re-readable. */
test('saving a discrepancy response writes it, and the card says it is recorded', async () => {
  await withApp('driver', async (app) => {
    await mountScreen(app, 'DiscrepancyScreen', {});
    assert.equal(app.click((t) => t.startsWith('Inventory')), true, 'inventory tab missing');
    await app.settle();

    assert.equal(app.click('Found it'), true);
    await app.settle();
    assert.equal(app.click('Save response'), true);
    await app.settle();

    const rec = app.window.MInvResp.get('iv1');
    assert.ok(rec, 'the response was confirmed to the driver and stored nowhere');
    assert.equal(rec.status, 'found');
    // and it is on disk, not just in a closure
    assert.ok((app.window.localStorage.getItem('hw-m-invresp') || '').includes('found'),
      'a response that dies with the page never reaches loss prevention');
    assert.ok(app.text().includes('Recorded'), 'the card must show the response as recorded');
  });
});

test('a response written earlier is read back — and the toast does not overclaim', async () => {
  await withApp('driver', async (app) => {
    app.window.localStorage.setItem('hw-m-invresp',
      JSON.stringify({ iv1: { status: 'damaged', note: 'Crushed in transit', at: '4:20 PM' } }));
    await mountScreen(app, 'DiscrepancyScreen', {});
    app.click((t) => t.startsWith('Inventory'));
    await app.settle();

    const txt = app.text();
    assert.ok(txt.includes('Recorded 4:20 PM'), 'a saved response must survive leaving the screen');
    assert.ok(txt.includes('Crushed in transit'), 'the note must come back with it');
    assert.ok(app.buttons().includes('Update response'),
      'a card holding a response should offer to update it, not to save it again');

    app.click('Found it');           // change the status → the control re-arms
    await app.settle();
    assert.equal(app.click('Update response'), true);
    await app.settle();
    assert.equal(app.window.MInvResp.get('iv1').status, 'found');
    assert.ok(!/saved for loss prevention/i.test(String(app.window.M.s.toast?.msg || '')),
      'the toast must not claim a destination this app cannot reach');
  });
});

test('a note with no status is refused out loud, not swallowed', async () => {
  await withApp('driver', async (app) => {
    await mountScreen(app, 'DiscrepancyScreen', {});
    app.click((t) => t.startsWith('Inventory'));
    await app.settle();
    assert.equal(app.click('Add a note'), true);
    await app.settle();
    assert.equal(typeInto(app, 'Found under the driver seat', 'Left it at the last stop'), true);
    await app.settle();
    assert.ok(app.text().includes("a note on its own can't be recorded"),
      'a note that cannot be saved must say so instead of looking saveable');
    assert.equal(app.window.MInvResp.get('iv1'), null, 'and nothing may be written');
  });
});

/* ── 4. THE TIP BANK ON THE PROFILE IS THE REAL ONE ─────────────────────────
 * tipTotal() sums a list that stays null until seedTips() runs, so a screen
 * that reads without seeding reports $0.00 over real money. */
test('Profile shows the same tip bank the tips screen does', async () => {
  await withApp('driver', async (app) => {
    const expected = app.window.MD.TIPS_SEED.reduce((a, t) => a + t.amount, 0);
    assert.ok(expected > 0, 'precondition: the seed holds real tips');
    await mountScreen(app, 'ProfileScreen', {});
    const shown = /My tips\s*(\$[\d,]+\.\d\d)/.exec(app.text());
    assert.ok(shown, 'the tips row disappeared from the profile');
    assert.equal(shown[1], app.window.HW.fmt.money(expected),
      'the profile read the bank without seeding it and reported $0.00 over real money');
  });
});
