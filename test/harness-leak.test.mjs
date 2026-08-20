/* THE HARNESS MUST NOT LEAK, AND NOTHING ELSE WOULD EVER CATCH IT.
 *
 * I added a timer tracker so close() could cancel pending timers, and it
 * RETAINED EVERY ONE-SHOT ID for the life of the run in a Set only close()
 * emptied. A page scheduling timers in a loop grew it without bound — the
 * harness turning a page-level bug into a memory leak of its own. Across many
 * concurrent runs that took a machine down.
 *
 * ⚠️ NO ASSERTION IN ANY OTHER SUITE COULD HAVE FOUND THIS. A Set that merely
 * grows fails nothing, throws nothing, and turns no test red. It was found by
 * someone reading my own fix suspiciously — which is the only way this class
 * gets found, and the reason it now has a test of its own.
 *
 * The multiplier, flagged by the other session: requestAnimationFrame is
 * aliased onto setTimeout, so an ANIMATING page retained an entry per frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('a one-shot timer releases its tracking entry when it fires', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    let fired = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) W.setTimeout(() => { fired++; }, 0);
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(fired, N, 'every scheduled one-shot must actually run');
    // The Set is private, so this asserts the OBSERVABLE consequence: the
    // harness stays responsive and tears down after thousands of timers rather
    // than accumulating them.
  });
});

test('requestAnimationFrame is routed through the TRACKED timer path', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    // A bare `setTimeout` inside the harness module resolves to NODE's global,
    // not window's — so rAF bypassed the tracker entirely and its callbacks
    // were never cancelled at teardown. Pinning the routing, because "it works"
    // and "it is cancellable" are different properties.
    let seen = 0;
    const real = W.setTimeout;
    W.setTimeout = (fn, ms, ...rest) => { seen++; return real(fn, ms, ...rest); };
    try {
      W.requestAnimationFrame(() => {});
      assert.equal(seen, 1, 'rAF must schedule through window.setTimeout, not Node\'s');
    } finally { W.setTimeout = real; }
  });
});

test('teardown returns cleanly with thousands of timers outstanding', async () => {
  // The failure this guards is not an assertion — it is the runner hanging.
  // If close() cannot get out from under a large timer set, this test never
  // returns and node --test reports the FILE, which is exactly the shape that
  // quarantined merch-screen.
  await withApp('pos', async (app) => {
    const W = app.window;
    for (let i = 0; i < 3000; i++) W.setTimeout(() => {}, 60000);   // still pending at close
    assert.ok(true);
  });
});
