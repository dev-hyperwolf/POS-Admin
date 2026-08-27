/* ── THE COUNTERS THAT REACHED THE JSON AND STOPPED THERE ────────────────────
 *
 * wm_status_queue grew a per-row `next_attempt_at`, and with it queue_summary()
 * grew `deferred` (pending rows serving a backoff) and `ready_now` (pending,
 * due, and not held behind an older push for the same order). GET
 * /api/fulfillment/board served both from the day they were written. NOTHING
 * RENDERED EITHER. `ready_now` had zero readers anywhere in shipping code — not
 * a route, not a loop, not a line of JSX. That is this estate's signature
 * defect, the one it has a commit named after: built, tested, never wired.
 *
 * WHY A COUNTER, OF ALL THINGS, IS WORTH A RENDER TEST. After the head-of-line
 * fix, the ORDINARY steady state of a queue Weedmaps is refusing is a drain
 * pass that attempts nothing at all, because every row is waiting out its own
 * backoff. On a screen that is indistinguishable from an empty queue.
 * `undelivered` alone cannot separate "nothing to do" from "everything is
 * stuck", and telling those apart is the entire reason the numbers exist.
 *
 * WHY THIS FILE AND NOT A GREP. qa/fulfillment_probe.py FU-18 greps this JSX
 * for the binding, the render and the mount, which is real but is still a
 * statement about SOURCE. These tests boot the actual Orders screen into jsdom
 * with a stubbed board route and read the pills off the rendered document —
 * so a strip that is present in the file and throws on render, or renders and
 * shows the wrong number, fails here and passes there.
 *
 * ⚠️ Harness traps (documented at the top of test/ui-harness.mjs): anything
 * reached through `app.window` is a jsdom-realm object, so assert on primitives
 * (.length, .join(','), a string), never deepEqual. And `typeof null ===
 * 'object'`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './ui-harness.mjs';

/** A board payload. Only `queue` is read by the strip. */
const board = (q) => ({ queue: Object.assign(
  { pending: 0, claimed: 0, sent: 0, failed: 0, oldest_pending_at: null,
    undelivered: 0, deferred: 0, ready_now: 0 }, q) });

/**
 * Boot the POS with a fetch that answers ONLY the board route, and mount the
 * Orders screen.
 *
 * `live: false` leaves window.HW_LIVE alone, which is the mock-data case: the
 * strip must render nothing rather than invent zeros for a server nobody asked.
 *
 * Every other seam gets a resolving non-ok response, exactly as the harness's
 * own default does — a REJECTING stub is just a different crash at load, and
 * the not-ok path is the state we want the rest of the screen in anyway.
 */
async function openOrders({ answer, live = true } = {}) {
  const seen = [];
  const app = await boot('pos', {
    fetch(url) {
      const p = String(url);
      seen.push(p);
      if (p.includes('/api/fulfillment/board?limit=')) return answer(p);
      return Promise.resolve({ ok: false, status: 503,
        json: () => Promise.resolve({}), text: () => Promise.resolve('{}') });
    },
  });
  // holdsBase() — the same gate the hold feed uses — is what decides whether
  // this screen believes there is a server to ask at all.
  if (live) app.window.HW_LIVE = { __armed: true, base: '', orders: { live: true } };
  await app.mount('OrdersScreen');
  await app.settle();
  await app.settle();
  return { app, seen, text: () => app.text() };
}

const ok = (body) => Promise.resolve(
  { ok: true, status: 200, json: () => Promise.resolve(body) });

// ── The whole point: both numbers, on a screen, correct ────────────────────

test('the strip renders deferred and ready_now, and the pills add up to undelivered', async () => {
  // 5 undelivered = 1 ready + 3 deferred + 1 remainder. The remainder is
  // rendered rather than dropped, deliberately: a number the strip cannot
  // explain must show up somewhere, not vanish out of the total.
  const { app, seen, text } = await openOrders({
    answer: () => ok(board({ undelivered: 5, deferred: 3, ready_now: 1,
                             sent: 41, failed: 2, pending: 5 })) });
  try {
    const t = text();
    assert.ok(seen.some((u) => u.includes('/api/fulfillment/board?limit=1')),
      'the strip never asked the board route; seen: ' + seen.join(' '));
    assert.ok(t.includes('Weedmaps status queue'), 'no strip on screen');
    assert.ok(t.includes('1 ready now'),
      'ready_now — the counter that had ZERO readers anywhere — did not reach the screen');
    assert.ok(t.includes('3 waiting out a retry backoff'),
      'deferred did not reach the screen: ' + t.slice(0, 400));
    assert.ok(t.includes('5 pushes not yet delivered'), 'undelivered missing');
    assert.ok(t.includes('1 behind an older push for the same order'),
      'the remainder pill must account for undelivered - deferred - ready_now');
    assert.ok(t.includes('2 permanently failed'), 'the failed count is the alarm; missing');
  } finally { app.close(); }
});

test('a queue that is entirely backed off does not read as an empty queue', async () => {
  // THE CASE THE NUMBERS EXIST FOR. Every row deferred, nothing ready: the
  // drain attempts nothing this pass, and without `deferred` on screen that is
  // indistinguishable from having nothing to send.
  const { app, text } = await openOrders({
    answer: () => ok(board({ undelivered: 9, deferred: 9, ready_now: 0, pending: 9 })) });
  try {
    const t = text();
    assert.ok(t.includes('9 waiting out a retry backoff'), 'deferred missing: ' + t.slice(0, 300));
    assert.ok(t.includes('0 ready now'), 'ready_now must be rendered even at zero — that IS the signal');
    assert.ok(!t.includes('Nothing waiting to reach Weedmaps'),
      'a fully-deferred queue rendered as an idle one, which is the exact confusion this strip exists to end');
  } finally { app.close(); }
});

test('an idle queue says so, and does not show a backoff that is not happening', async () => {
  const { app, text } = await openOrders({ answer: () => ok(board({ sent: 12 })) });
  try {
    const t = text();
    assert.ok(t.includes('Nothing waiting to reach Weedmaps'), 'idle queue not reported');
    assert.ok(!t.includes('waiting out a retry backoff'), 'a backoff pill on an empty queue');
  } finally { app.close(); }
});

// ── The three ways this must refuse to invent a number ─────────────────────

test('a board that answers WITHOUT the counters is an error, not a healthy zero', async () => {
  // THIS IS NOT A HYPOTHETICAL PAYLOAD. It is the shape the deployed server
  // serves RIGHT NOW: GET https://hyperwolf-wm-demo.onrender.com/api/
  // fulfillment/board?limit=1 answered 200 on 2026-08-26 with queue keys
  // [claimed, failed, oldest_pending_at, pending, sent, undelivered] and no
  // deferred, no ready_now -- production is still running pre-change code.
  // So until this ships, every operator on the live host hits exactly this
  // branch. Reading `q.deferred` off it yields undefined -> 0, and without the
  // shape check the strip would render "nothing waiting to reach Weedmaps"
  // over a queue whose state it never learned. That is worse than no strip.
  const { app, text } = await openOrders({
    answer: () => ok({ queue: { pending: 4, claimed: 0, sent: 1, failed: 0,
                                oldest_pending_at: null, undelivered: 4 } }) });
  try {
    const t = text();
    assert.ok(t.includes('Queue state not known'),
      'a board missing deferred/ready_now must be reported as not-known: ' + t.slice(0, 300));
    assert.ok(t.includes('the board answered without deferred/ready_now'),
      'the error must name what was missing, or nobody can act on it');
    assert.ok(!t.includes('Nothing waiting to reach Weedmaps'),
      'a shape change rendered as an idle queue');
  } finally { app.close(); }
});

test('a board that does not answer is reported as not known, never as quiet', async () => {
  const { app, text } = await openOrders({
    answer: () => Promise.resolve({ ok: false, status: 500,
      json: () => Promise.resolve({}) }) });
  try {
    const t = text();
    assert.ok(t.includes('Queue state not known'), 'a 500 did not reach the operator');
    assert.ok(t.includes('HTTP 500'), 'the status code is what makes it actionable');
    assert.ok(!t.includes('Nothing waiting to reach Weedmaps'), 'a dead board rendered as an idle queue');
  } finally { app.close(); }
});

test('with no live server the strip renders NOTHING, and asks nothing', async () => {
  // Mock-data mode. There is no queue to have a state, and a strip full of
  // zeros would be a claim about a server that was never contacted.
  const { app, seen, text } = await openOrders({
    live: false, answer: () => ok(board({ undelivered: 3, deferred: 3 })) });
  try {
    assert.ok(!text().includes('Weedmaps status queue'),
      'the strip rendered without a live server to describe');
    assert.ok(!seen.some((u) => u.includes('/api/fulfillment/board?limit=1')),
      'the strip called the board route with no live server armed');
  } finally { app.close(); }
});

// ── The note above it must not out-live the gap it describes ───────────────

test("the DevNote keeps its KNOWN GAP badge while requeue has no button", async () => {
  // The cross-order stall this note used to be about IS fixed, and retoning it
  // to 'info' on that basis silently removed the only visual marker on this
  // screen saying something here is unfinished — while the note still promised
  // a way to requeue a permanently-failed push, which does not exist.
  // fulfillment.requeue() has no route and no control. If someone wires it,
  // this test is the thing that says the badge may now come down.
  const { app, text } = await openOrders({ answer: () => ok(board({ sent: 1 })) });
  try {
    const t = text();
    assert.ok(t.includes('KNOWN GAP'),
      'the KNOWN GAP badge is gone while fulfillment.requeue() still has no route and no control');
    assert.ok(t.includes('a permanently failed push cannot be requeued from any screen'),
      'the note must name the gap that is still open, not the one that was closed');
  } finally { app.close(); }
});
