/* ── AOV ATTRIBUTION FAILURE MUST NEVER BLOCK THE SALE, BUT MUST NOT BE MUTE ──
 *
 * pos/payment.jsx's finalize() fires POST /api/pos/sale (via shared/hw-live.js's
 * post()) purely to feed the AOV leaderboard. That call is fire-and-forget ON
 * THE SALE by design — the comment right above it is explicit that a slow or
 * unreachable wmdemo backend must never block or delay the drawer pop that
 * already happened, and these tests must not weaken that.
 *
 * Adversarial QA on 2026-08-31 found the gap one layer up: `post()` already
 * resolves { ok, ... } specifically so a caller CAN tell a committed write
 * from a refused one, and finalize() was throwing that answer away — so a
 * whole shift's sales could silently miss the leaderboard with nobody able to
 * notice. The fix keeps the zero-delay completion and adds an after-the-fact,
 * dismissible banner on the done screen when the POST's own answer (once it
 * lands) says it failed.
 *
 * Two things must both be true, so this drives BOTH paths against the same
 * harness rather than trusting one green test:
 *   1. failure path: the sale still completes exactly as before, AND the
 *      operator gets a signal naming what happened.
 *   2. success path: nothing new appears — the done screen is byte-for-byte
 *      the pre-existing behaviour.
 *
 * Harness traps (see ui-harness.mjs): values off `app.window` are jsdom-realm
 * objects — compare primitives, never deepEqual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Same "no live backend" answer test/ui-harness.mjs's own default fetch gives
 *  every request — reused here for every path EXCEPT /api/pos/sale, which each
 *  test drives deliberately. Keeping the rest of the app on the harness's
 *  normal offline behaviour is what makes "the rest of checkout succeeds
 *  normally" mean something: nothing about catalog/customer/order fetches was
 *  changed to make this test pass. */
function offlineResponse(url) {
  return {
    ok: false, status: 503, statusText: 'offline in the test harness', url: String(url),
    json: () => Promise.resolve(null), text: () => Promise.resolve(''),
  };
}

/** `saleOutcome`: 'network-error' rejects the fetch itself (post()'s .catch
 *  branch — a real "backend unreachable", not just a bad status), 'ok' answers
 *  200 with a body post() will read as a committed write. */
function makeFetch(saleOutcome) {
  return function (url) {
    if (!String(url).includes('/api/pos/sale')) return Promise.resolve(offlineResponse(url));
    if (saleOutcome === 'network-error') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve({
      ok: true, status: 200, statusText: 'OK', url: String(url),
      json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve('{"ok":true}'),
    });
  };
}

function totalShown(app) {
  const m = app.text().match(/Items\s*(\d+)\s*Total\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[2].replace(/,/g, '')) : null;
}
function clickStarts(app, prefix, within) {
  return app.click((t, el) => t.startsWith(prefix) && (!within || !!el.closest(within)));
}

/** Walks TENDER → Cash → quick-cash → Complete and stops there, deliberately
 *  NOT clicking "Done · new sale" — the banner under test only exists on the
 *  done stage, before that button tears the modal down. */
async function tenderCashToDone(app, total) {
  assert.ok(app.click('TENDER'), 'no TENDER button');
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Cash')), `no Cash tile — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  const quick = '$' + Math.ceil(total).toFixed(2);
  assert.ok(app.click(quick), `no quick-cash ${quick} — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
  assert.ok(clickStarts(app, 'Complete'), `no Complete button — buttons: ${app.buttons().join(' | ')}`);
  await app.settle();
}

test('AOV POST network failure: sale completes normally AND the operator sees a dismissible signal', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const total = totalShown(app);
    assert.ok(total > 0, 'the seeded ticket should have a total to tender');

    // Complete, and stop there — the drawer pop / receipt / "Payment
    // complete" screen are ALL finalize()'s doing, and finalize() already
    // returned by this point. Nothing from here down can have delayed it.
    await tenderCashToDone(app, total);
    // Give the rejected fetch's .then() a further tick to land and re-render.
    await app.settle();

    // ── the sale itself: completely unaffected by the POST failing ──────
    assert.match(app.text(), /Payment complete/, 'the done screen did not show success at all');
    assert.match(app.text(), /drawer opened/, 'a cash sale should report the drawer as opened, same as always');

    // ── the new, honest signal ───────────────────────────────────────────
    assert.match(app.text(), /AOV attribution/, 'no mention of AOV attribution on the done screen after the POST failed');
    assert.match(app.text(), /didn.t reach the server/, 'the banner does not say what actually happened');
    assert.match(app.text(), /leaderboard/, 'the banner does not say what the operator loses, which is the whole point of surfacing it');

    // dismissible, and dismissing it must not touch the success screen under it
    const dismiss = app.window.document.querySelector('button[aria-label="Dismiss"]');
    assert.ok(dismiss, 'the banner has no way to dismiss it');
    dismiss.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();
    assert.doesNotMatch(app.text(), /AOV attribution/, 'dismissing the banner left it on screen');
    assert.match(app.text(), /Payment complete/, 'dismissing the AOV banner also wiped the success screen');

    // and the sale still finishes the same way it always has: "Done · new
    // sale" still files the real order, exactly as register-sale.test.mjs
    // already proves for the ordinary path.
    const before = HW.ORDERS.length;
    assert.ok(clickStarts(app, 'Done · new sale'), `no "Done · new sale" — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.equal(HW.ORDERS.length, before + 1, 'a failed AOV POST must never stop the sale from reaching the order queue');
    const rec = HW.ORDERS[0];
    assert.equal(rec.total, total, 'the written order does not match what was tendered');
    assert.equal(rec.pay, 'Cash', 'the written order lost its tender type');
  }, { fetch: makeFetch('network-error') });
});

test('AOV POST success: the done screen is unchanged — no signal, nothing new', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    await app.mount('RegisterScreen');
    const total = totalShown(app);
    assert.ok(total > 0, 'the seeded ticket should have a total to tender');

    await tenderCashToDone(app, total);
    await app.settle();

    assert.match(app.text(), /Payment complete/, 'the done screen did not show success');
    assert.doesNotMatch(app.text(), /AOV attribution/, 'a SUCCESSFUL attribution POST must show no signal at all');
    assert.equal(app.window.document.querySelector('button[aria-label="Dismiss"]'), null,
      'a successful attribution left a dismiss control on screen — the success path must render nothing new');

    const before = HW.ORDERS.length;
    assert.ok(clickStarts(app, 'Done · new sale'), `no "Done · new sale" — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();
    assert.equal(HW.ORDERS.length, before + 1, 'the sale did not write an order');
  }, { fetch: makeFetch('ok') });
});
