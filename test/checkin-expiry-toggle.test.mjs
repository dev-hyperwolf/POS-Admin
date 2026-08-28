/* ══ THE OWNER'S EXPIRY TOGGLE, ON THE CHECK-IN SCREEN ═════════════════════
 *
 * [OWNER RULING 2026-08-27] Document-expiry enforcement is a TOGGLE, default
 * OFF, and an expired document dies at the END of its printed day.
 *
 * `test/doc-expiry-toggle.test.mjs` pinned the toggle in pos/verification.jsx.
 * pos/checkin.jsx is THE SAME DEFECT ONE FILE OVER: docIsExpired() hard-blocked
 * `createNew` and the Check-in footer with no knowledge of the switch at all,
 * so with enforcement OFF the gate allowed the customer and the counter screen
 * refused them anyway. The toggle did not toggle here either.
 *
 * TWO CLAIMS THAT MUST NOT BE CONFLATED, and this file exists mostly to keep
 * them apart:
 *
 *   DETECTION is UNCONDITIONAL. In all three switch positions the lapse is
 *   named, dated and shown in the alarm tone. A fix that shows the expiry only
 *   when enforcement is on would hide a real lapse from an associate, which is
 *   worse than the bug being fixed — so every position below asserts the date
 *   is still on screen.
 *
 *   CONSEQUENCE reads the switch. Only an explicit, published `false` allows.
 *
 * THREE STATES, NOT TWO. `true`, `false` and ABSENT must produce three
 * DIFFERENT sentences. Absent refuses — fail-closed — but says it is refusing
 * because nothing published the policy, rather than claiming a policy. Folding
 * absent into "off" would silently allow every lapsed document in the estate
 * against an older server; folding it into "on" would report a decision nobody
 * made as if somebody had.
 */
process.env.TZ = 'America/Los_Angeles';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* A document that lapsed in 2020 and one good until 2032, identical in every
 * other respect — the render assertions compare the two, and a second
 * difference between them would let an assertion pass by accident. */
const LAPSED = { type: 'CA DL', num: '••••4821', expires: '2020-05-30',
  scannedAt: 'Just now', photo: 'blob:x', by: 'Manisha Saini', where: 'counter',
  name: 'Marcus Webb' };
const CURRENT = { ...LAPSED, expires: '2032-05-30' };
const CUSTOMER = { id: 'm-expiry-1', name: 'Marcus Webb', email: 'marcus@yopmail.com',
  phone: '(951) 555-0142', points: 0, member: false, type: 'AdultUse' };

/** Point HW_CHECKIN at a switch position. `undefined` publishes NOTHING — the
 *  third state — by removing the object entirely. Same helper shape as
 *  test/doc-expiry-toggle.test.mjs, deliberately: one vocabulary for one fact. */
function setSwitch(app, { contract, board } = {}) {
  const ck = {};
  if (contract !== undefined) ck.contract = { doc_expiry_enforced: contract };
  if (board !== undefined) ck.board = { expiry_enforcement: { enforced: board } };
  app.window.HW_CHECKIN = Object.keys(ck).length ? ck : undefined;
}

/** Render CheckInModal over a customer whose document was scanned THIS session
 *  — the path that bypassed assurance() entirely and is the actual defect. */
async function screen(app, doc) {
  app.window.HW = app.window.HW || {};
  app.window.HW.MEMBERS = app.window.HW.MEMBERS || [];
  app.window.HW.IDV = app.window.HW.IDV || {};
  app.window.__CheckInProbe = () =>
    app.window.React.createElement(app.window.CheckInModal, {
      initialCustomer: { ...CUSTOMER, doc },
      onClose() {}, onCheckIn() {},
    });
  await app.mount('__CheckInProbe');
  return app;
}

/** The two footer controls, by label, with their real disabled state. */
function footerButtons(app) {
  const out = {};
  for (const b of app.document.querySelectorAll('button')) {
    const t = (b.textContent || '').trim();
    if (t === 'Check in' || t === 'Check in & start sale' || t === 'Create customer') {
      out[t] = { disabled: !!b.disabled };
    }
  }
  return out;
}

/* ═══ A. THE PRIMARY CARD, IN ALL THREE SWITCH POSITIONS ═══════════════════ */

test('enforcement ON: a session-scanned lapsed ID refuses the check-in, exactly as before the toggle existed', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: true });
    await screen(app, LAPSED);
    const b = footerButtons(app);
    assert.equal(b['Check in'].disabled, true, 'enforcement is on — this document clears nothing');
    assert.equal(b['Check in & start sale'].disabled, true);
    const t = app.text();
    assert.match(t, /EXPIRED on 2020-05-30/, 'and the lapse is named and dated');
    assert.match(t, /Expiry enforcement is ON/,
      'it must say WHICH way the switch was set, not just that it refused');
  });
});

test('enforcement OFF: the SAME lapsed document lets the check-in through — the switch actually switches', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    await screen(app, LAPSED);
    const b = footerButtons(app);
    assert.equal(b['Check in'].disabled, false,
      'THE DEFECT: with enforcement off the gate allows this customer and this screen refused ' +
      'them anyway, because checkin.jsx had no knowledge of the switch at all');
    assert.equal(b['Check in & start sale'].disabled, false);
  });
});

test('enforcement OFF: the allow is STILL shown as a lapse, and carries the refusal that did not happen', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    await screen(app, LAPSED);
    const t = app.text();
    assert.match(t, /EXPIRED on 2020-05-30/,
      'DETECTION IS UNCONDITIONAL — an allowed lapse is still a lapse and is still named');
    assert.match(t, /WOULD HAVE BEEN REFUSED/,
      'the refusal that did not happen is the whole point of a default-OFF toggle: the ' +
      'population it will block has to be countable BEFORE it is turned on');
    assert.match(t, /enforcement is OFF/i);
    assert.ok(app.document.querySelector('[data-hw="soft-lapse-primary"]'),
      'and it is its own block on the card, not a word buried in a sentence');
  });
});

test('enforcement OFF: an allowed lapse does not wear the clean green pill', async () => {
  const pill = (position) => withApp('pos', async (app) => {
    setSwitch(app, position);
    await screen(app, position === null ? CURRENT : LAPSED);
    return app.text();
  });
  const soft = await pill({ contract: false });
  const clean = await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    await screen(app, CURRENT);
    return app.text();
  });
  assert.match(soft, /ID on file · EXPIRED/,
    'THE DEFECT ONE LAYER OUT: the document IS on file — the gate allowed it — but rendering ' +
    'it in the same pill as a current document makes an allowed lapse pixel-identical to a ' +
    'customer with nothing wrong with them');
  assert.match(clean, /ID on file/);
  assert.doesNotMatch(clean, /EXPIRED/, 'and a current document is never called expired');
  assert.doesNotMatch(clean, /WOULD HAVE BEEN REFUSED/);
});

test('the flag ABSENT is a THIRD state: it refuses, and it says nobody published the switch', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, {});                            // nothing published it at all
    await screen(app, LAPSED);
    const b = footerButtons(app);
    assert.equal(b['Check in'].disabled, true,
      'ABSENT MUST NOT BE COERCED TO false — defaulting an unread compliance switch to "off" ' +
      'would silently allow every lapsed document in the estate against an older server');
    const t = app.text();
    assert.match(t, /EXPIRED on 2020-05-30/, 'the lapse is named here too');
    assert.match(t, /UNKNOWN/,
      'and it must not be coerced to true either: this refusal is the strict reading, not a policy');
    assert.doesNotMatch(t, /Expiry enforcement is ON/, 'nothing said it was on');
    assert.doesNotMatch(t, /enforcement is OFF/i, 'and nothing said it was off');
  });
});

test('the three switch positions produce three DIFFERENT sentences on this screen too', async () => {
  const say = (position) => withApp('pos', async (app) => {
    setSwitch(app, position);
    await screen(app, LAPSED);
    return app.text();
  });
  const on = await say({ contract: true });
  const off = await say({ contract: false });
  const unknown = await say({});
  assert.notEqual(on, off);
  assert.notEqual(off, unknown);
  assert.notEqual(on, unknown,
    'THE POINT OF THE THIRD STATE: ON and UNPUBLISHED both refuse today, so the sentence is ' +
    'the only thing that tells an operator whether the estate decided this or whether nobody ' +
    'told the screen anything — and only one of those is a wiring fault to go and fix');
  assert.match(unknown, /nothing published the switch|is UNKNOWN/i,
    'the unknown state must name itself as unknown rather than describe a policy');
  for (const [name, t] of [['on', on], ['off', off], ['unknown', unknown]]) {
    assert.match(t, /EXPIRED on 2020-05-30/,
      `DETECTION IS UNCONDITIONAL and it is missing in the ${name} position`);
  }
});

test('the switch governs the LAPSE ONLY — a current document is untouched in all three positions', async () => {
  for (const position of [{ contract: true }, { contract: false }, {}]) {
    await withApp('pos', async (app) => {
      setSwitch(app, position);
      await screen(app, CURRENT);
      const b = footerButtons(app);
      assert.equal(b['Check in'].disabled, false,
        `a valid document clears at ${JSON.stringify(position)}`);
      const t = app.text();
      assert.doesNotMatch(t, /EXPIRED/, 'and is never called expired');
      assert.doesNotMatch(t, /WOULD HAVE BEEN REFUSED/, 'nor carries a would-block');
    });
  }
});

test('no document at all is still no document, whatever the switch says', async () => {
  for (const position of [{ contract: true }, { contract: false }, {}]) {
    await withApp('pos', async (app) => {
      setSwitch(app, position);
      await screen(app, null);
      assert.equal(footerButtons(app)['Check in'].disabled, true,
        `an unscanned buyer is refused at ${JSON.stringify(position)} — the expiry switch is ` +
        'not a switch on whether an ID is needed');
      assert.match(app.text(), /Nobody has held this customer/);
    });
  }
});

/* ── the publication sites, and which one wins ───────────────────────────── */

test('the board publishes the switch too, and this screen reads it', async () => {
  for (const [board, expectDisabled] of [[false, false], [true, true]]) {
    await withApp('pos', async (app) => {
      setSwitch(app, { board });
      await screen(app, LAPSED);
      assert.equal(footerButtons(app)['Check in'].disabled, expectDisabled,
        `board.expiry_enforcement.enforced=${board} was not read`);
    });
  }
});

test('specificity wins: the row on the member record beats the board', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { board: false });
    app.window.HW = app.window.HW || {};
    app.window.HW.MEMBERS = [];
    // The server stamps `doc_expiry.enforced` on the row the consequence lands
    // on. It is the most specific of the three sites and must outrank the board.
    app.window.HW.IDV = { [CUSTOMER.id]: { doc_expiry: { state: 'expired', enforced: true } } };
    app.window.__CheckInProbe = () =>
      app.window.React.createElement(app.window.CheckInModal, {
        initialCustomer: { ...CUSTOMER, doc: LAPSED }, onClose() {}, onCheckIn() {} });
    await app.mount('__CheckInProbe');
    assert.equal(footerButtons(app)['Check in'].disabled, true,
      'the row said ENFORCED and the board said off; the row is where the server stamps it');
  });
});

test('a non-boolean is not a switch position: it falls through instead of being coerced', async () => {
  // The board says OFF. The row carries junk in `enforced`. None of those is a
  // reading, so each must defer to the board rather than be truthy-tested into
  // one — which would flip this customer from allowed to refused on a string.
  for (const junk of ['true', 'false', 1, 0, null, {}, 'yes']) {
    await withApp('pos', async (app) => {
      setSwitch(app, { board: false });
      // ⚠️ window.HW carries a live-seam SETTER that repaints a badge from
      // HW.orders, so assigning a fresh object throws inside the seam. Mutate.
      app.window.HW.MEMBERS = [];
      app.window.HW.IDV = { [CUSTOMER.id]: { doc_expiry: { state: 'expired', enforced: junk } } };
      app.window.__CheckInProbe = () =>
        app.window.React.createElement(app.window.CheckInModal, {
          initialCustomer: { ...CUSTOMER, doc: LAPSED }, onClose() {}, onCheckIn() {} });
      await app.mount('__CheckInProbe');
      assert.equal(footerButtons(app)['Check in'].disabled, false,
        `doc_expiry.enforced=${JSON.stringify(junk)} is not a boolean and must not be read as one`);
    });
  }
});

/* ═══ B. THE NEW-CUSTOMER FORM ═════════════════════════════════════════════
 * The other half of the same defect: `createNew` returned early on
 * docIsExpired(nf.doc) and the Create button was disabled on it, both with no
 * knowledge of the switch. Driven through the real scanner seam — a stub that
 * hands back a fixed document, because IdScanPanel's own simulator randomises
 * and a compliance assertion cannot rest on a coin toss. */
async function newCustomerForm(app, doc) {
  app.window.HW.MEMBERS = [];   // see the note on the setter above
  app.window.HW.IDV = {};
  const R = app.window.React;
  app.window.IdScanPanel = function StubScan({ onChange }) {
    return R.createElement('button', { onClick: () => onChange(doc) }, 'STUB SCAN');
  };
  app.window.__CheckInProbe = () =>
    R.createElement(app.window.CheckInModal, { onClose() {}, onCheckIn() {} });
  await app.mount('__CheckInProbe');
  assert.ok(app.click('STUB SCAN'), 'the stub scanner was never rendered');
  await app.settle();
  return app;
}

const SCANNED_LAPSED = { ...LAPSED, name: 'Dana Vance', returning: false, dob: '1988-04-02' };
const SCANNED_CURRENT = { ...SCANNED_LAPSED, expires: '2032-05-30' };

test('new customer, enforcement ON: a lapsed scan cannot start a record, and says which switch position refused it', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: true });
    await newCustomerForm(app, SCANNED_LAPSED);
    assert.equal(footerButtons(app)['Create customer'].disabled, true);
    const t = app.text();
    assert.match(t, /EXPIRED on 2020-05-30/);
    assert.match(t, /Expiry enforcement is ON/);
  });
});

test('new customer, enforcement OFF: the record CAN be started — and the form still says the document is expired', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    await newCustomerForm(app, SCANNED_LAPSED);
    assert.equal(footerButtons(app)['Create customer'].disabled, false,
      'THE DEFECT: the gate allows this person and the form refused to create them');
    const t = app.text();
    assert.match(t, /EXPIRED on 2020-05-30/, 'DETECTION IS UNCONDITIONAL here too');
    assert.match(t, /WOULD HAVE BEEN REFUSED/);
    assert.match(t, /enforcement is OFF/i);
  });
});

test('new customer, enforcement OFF: pressing Create actually creates — the button and the guard agree', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    await newCustomerForm(app, SCANNED_LAPSED);
    assert.ok(app.click('Create customer'), 'the Create button was not on screen');
    await app.settle();
    // The form closes and the customer card takes its place. A guard that still
    // returned early would leave the form exactly where it was — which is how a
    // "fixed" disabled attribute ships over a still-broken handler.
    assert.match(app.text(), /Dana Vance/,
      'createNew() still refused the document the button had just allowed');
  });
});

test('new customer, switch UNPUBLISHED: refused, and named as unpublished rather than as a policy', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, {});
    await newCustomerForm(app, SCANNED_LAPSED);
    assert.equal(footerButtons(app)['Create customer'].disabled, true, 'fail-closed');
    const t = app.text();
    assert.match(t, /EXPIRED on 2020-05-30/);
    assert.match(t, /UNKNOWN/);
    assert.doesNotMatch(t, /enforcement is OFF/i);
    assert.doesNotMatch(t, /Expiry enforcement is ON/);
  });
});

test('new customer, a CURRENT document is unaffected in all three positions', async () => {
  for (const position of [{ contract: true }, { contract: false }, {}]) {
    await withApp('pos', async (app) => {
      setSwitch(app, position);
      await newCustomerForm(app, SCANNED_CURRENT);
      assert.equal(footerButtons(app)['Create customer'].disabled, false,
        `a valid document creates at ${JSON.stringify(position)}`);
      assert.doesNotMatch(app.text(), /EXPIRED/);
    });
  }
});
