/* Three defects the refuters found in the driver fixes themselves.
 *
 * All three are the same shape as the bugs they were fixing: the app tells the
 * driver something happened that did not happen, or fixes a symptom at one call
 * site while an identical dead end survives at the next one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('a discrepancy response that FAILED to store does not report success', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    // NOTE: jsdom's Storage.setItem lives on the prototype and is NOT writable
    // by plain assignment — `W.localStorage.setItem = fn` silently does nothing
    // and the stub never fires, which makes this test pass against a BROKEN
    // implementation. It has to be defineProperty.
    const proto = Object.getPrototypeOf(W.localStorage);
    const real = Object.getOwnPropertyDescriptor(proto, 'setItem');
    // Private browsing and a full quota both throw here. Swallowing it and
    // returning the record anyway is how "Recorded · saved on this phone"
    // ends up printed over a write that never landed.
    Object.defineProperty(proto, 'setItem', {
      configurable: true, writable: true,
      value: () => { throw new Error('QuotaExceededError'); },
    });
    try {
      const out = W.MInvResp.set('d-probe', { status: 'found', note: '', at: '4:20 PM' });
      assert.equal(out, null, 'a failed write must not return the record');
      assert.equal(W.MInvResp.get('d-probe'), null, 'and must not read back');
    } finally { Object.defineProperty(proto, 'setItem', real); }

    const ok = W.MInvResp.set('d-probe2', { status: 'found', note: '', at: '4:21 PM' });
    assert.ok(ok, 'a working write still returns the record');
    assert.equal(W.MInvResp.get('d-probe2').status, 'found');
  });
});

test('tipTotal seeds itself, so no reader can show $0.00 over a real bank', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    // The bug was fixed at the Profile call site. MakeChangeSheet — reached from
    // checkout — reads the same accessor and never seeded, so it kept the dead
    // end. Fixing the ACCESSOR is what makes that unreachable for every reader.
    W.M.s.tips = null;
    const expected = W.MD.TIPS_SEED.reduce((a, t) => a + t.amount, 0);
    assert.ok(expected > 0, 'the seed must actually hold money or this proves nothing');
    assert.equal(W.M.tipTotal(), expected, 'a cold reader must not see $0.00');
  });
});

test('Apply commits the filters, and the list actually narrows', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    W.M.clearFilters();
    const all = W.MD.TASKS.length;
    assert.ok(all > 0);

    W.M.setFilters({ status: [], tags: ['High'] });
    const high = W.MD.TASKS.filter((t) => W.M.matchesFilters(t));
    assert.ok(high.length > 0, 'the fixture must contain a high-priority stop');
    assert.ok(high.length < all, 'a filter that narrows nothing cannot prove it was applied');
    assert.ok(high.every((t) => t.prio === 'high'));

    // OR within a group.
    W.M.setFilters({ status: [], tags: ['High', 'Medium'] });
    assert.ok(W.MD.TASKS.filter((t) => W.M.matchesFilters(t)).length > high.length);

    W.M.clearFilters();
    assert.equal(W.MD.TASKS.filter((t) => W.M.matchesFilters(t)).length, all, 'cleared means everything is back');
  });
});

test('the Filters button and the count admit a filter is on', async () => {
  await withApp('driver', async (app) => {
    const W = app.window;
    W.M.setFilters({ status: [], tags: ['High'] });
    W.M.setDuty(true);   // off duty renders WelcomeHero, and the toolbar with it
    try {
      // An empty-looking list with a plain "Filters" button reads as the app
      // having lost the driver's stops.
      assert.equal(W.M.filterCount(), 1);
      await app.mount('HomeScreen');
      const t = app.text();
      assert.match(t, /Filters · 1/, 'the button must show that a filter is active');
      assert.match(t, /of \d+ stops · filtered/, 'the count must say it is showing a subset');
    } finally { W.M.clearFilters(); W.M.setDuty(false); }
  });
});
