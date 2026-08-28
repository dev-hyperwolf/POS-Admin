/* ── THE PHONE-APPROVAL DEAD END ─────────────────────────────────────────────
 *
 * Found during the 2026-08-27/28 error-boundary and honesty-fix pass:
 * `window.M.approvePhone()` (mobile/store.jsx) existed with ZERO callers
 * repo-wide. A driver could submit a new number (EditPhoneSheet ->
 * `submitPhone()`), see "pending management approval" forever, and nothing in
 * the app could ever move it out of that state. Permanent dead end.
 *
 * The fix adds the approval surface itself: a "Pending approvals" row on the
 * Profile screen (Manager tools) that opens `PendingApprovalsSheet`
 * (mobile/screen-profile.jsx), whose Approve button is the first and only
 * caller of `approvePhone()`.
 *
 * This file proves the whole loop, not just the store function (store.jsx's
 * approvePhone() already worked correctly before this fix — the defect was
 * that nothing could reach it):
 *   1. a submission really blocks the new number from taking effect,
 *   2. the manager surface shows it and can approve it,
 *   3. approval really flips the number, and
 *   4. every reader of the pending state (Contact row, the badge, the
 *      approvals row itself) reflects the new state afterward — approving
 *      must not write state that nothing else reads.
 *
 * Same two harness facts as test/driver-dead-ends.test.mjs apply here:
 * mobile/app.jsx (and its SHEETS router) is not loaded, so sheets are
 * mounted directly by name, the same way pushed screens are.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * `Row` (mobile/screen-profile.jsx) is a plain `<div onClick>`, not a
 * button/anchor — the harness's own `app.click()` only matches
 * `button,a,[data-hw-i]`, so it can never find a settings row. Match on the
 * inline `cursor: pointer' Row sets when it's clickable instead.
 */
function clickRow(app, textPrefix) {
  const hit = [...app.window.document.querySelectorAll('div')]
    .find((el) => el.style.cursor === 'pointer' && (el.textContent || '').trim().startsWith(textPrefix));
  if (!hit) return false;
  hit.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}

/** Mount ONE screen/sheet with props (harness mount() passes none) + the MTopBar stub. */
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

test('approvePhone() has a real caller now — it did not before this fix', () => {
  const src = readFileSync(ROOT + 'mobile/screen-profile.jsx', 'utf8');
  const calls = (src.match(/window\.M\.approvePhone\(\)/g) || []).length;
  assert.ok(calls >= 1,
    'approvePhone() must be called from the approval surface — grep found zero call sites');
});

test('a pending submission blocks the new number, and shows on the Profile screen', async () => {
  await withApp('driver', async (app) => {
    const before = app.window.M.profile().phone;
    app.window.M.submitPhone('(555) 555-9876');
    await mountScreen(app, 'ProfileScreen', {});

    assert.equal(app.window.M.profile().phone, before,
      'submitting a new number must not take effect until it is approved');
    // "Pending approval" (singular) is the Contact row's badge; "Pending
    // approvals" (plural) is the Manager tools row's always-present label —
    // check for the singular form so this isn't satisfied by the label alone.
    assert.match(app.text(), /Pending approval(?!s)/,
      'the Contact row must show the pending badge');
    assert.ok(app.text().includes('Pending approvals'),
      'a Manager tools row must exist to reach the approval surface');
    assert.match(app.text(), /Pending approvals\s*1/,
      'the approvals row must count the one pending submission');

    assert.equal(clickRow(app, 'Pending approvals'), true, 'the row must be clickable');
    await app.settle();
    assert.equal(app.window.M.s.sheet && app.window.M.s.sheet.name, 'approvals',
      'clicking it must open the approvals sheet');
  });
});

test('the approvals sheet lists the request and approving it flips the number everywhere', async () => {
  await withApp('driver', async (app) => {
    const d = app.window.MD.DRIVER;
    const oldPhone = app.window.M.profile().phone;
    app.window.M.submitPhone('(555) 555-9876');

    await mountScreen(app, 'PendingApprovalsSheet', {});
    const txt = app.text();
    assert.ok(txt.includes(d.name), 'the request must name the driver it belongs to');
    assert.ok(txt.includes(oldPhone) && txt.includes('(555) 555-9876'),
      'the sheet must show both the current and the requested number');
    assert.ok(app.buttons().includes('Approve'), 'no Approve control on a pending request');

    assert.equal(app.click('Approve'), true);
    await app.settle();

    assert.equal(app.window.M.profile().pendingPhone, null,
      'approving must clear the pending state');
    assert.equal(app.window.M.profile().phone, '(555) 555-9876',
      'approving must be the thing that actually lets the new number take effect');
  });
});

test('once approved, the Profile screen goes quiet', async () => {
  // Two `mountScreen` calls in one `app` create a second React root on the
  // same #root container without unmounting the first — the harness supports
  // one root per boot cleanly, a second is an unsupported double-mount that
  // races on teardown. Split into two `withApp` blocks instead.
  await withApp('driver', async (app) => {
    app.window.M.submitPhone('(555) 555-9876');
    app.window.M.approvePhone();

    await mountScreen(app, 'ProfileScreen', {});
    // The Contact row's badge reads "Pending approval" (singular); the Manager
    // tools row is always labeled "Pending approvals" (plural) regardless of
    // state, so a bare substring check would false-positive on that label.
    assert.ok(!/Pending approval(?!s)/.test(app.text()),
      'an approved submission must not still read as pending on the Contact row');
    assert.match(app.text(), /Pending approvals\s*None/,
      'the approvals row must report nothing pending once the queue is empty');
  });
});

test('once approved, the approval surface itself shows its own empty state', async () => {
  await withApp('driver', async (app) => {
    app.window.M.submitPhone('(555) 555-9876');
    app.window.M.approvePhone();

    await mountScreen(app, 'PendingApprovalsSheet', {});
    assert.ok(app.text().includes('No pending requests'),
      'the approval surface itself must show its own empty state, not a stale request');
    assert.ok(!app.buttons().includes('Approve'),
      'there must be nothing left to approve');
  });
});
