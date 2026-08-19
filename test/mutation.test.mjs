/* ── Watching every guard fail ───────────────────────────────────────────────
 *
 * A test that has only ever been seen to PASS is a hypothesis. It might be
 * asserting something the adapter cannot violate, or asserting nothing at all.
 *
 * So each check in ./checks.mjs is run a SECOND time here, against the adapter
 * source rewritten IN MEMORY to reintroduce a specific defect — including the
 * one that actually shipped, the missing category slice that let the POS offer
 * a Pre-Roll to replace Flower. The check is required to fail. If a mutation
 * lands and the check still passes, the check is not doing its job and THIS
 * test fails, which is the whole point.
 *
 * Nothing on disk is modified: `loadWindow({ patch })` rewrites the string it
 * feeds to `vm`, and `replaceOnce` throws if the target text has moved, so a
 * refactor of the adapter cannot silently turn a mutation into a no-op.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWindow, replaceOnce } from './harness.mjs';
import { CHECKS } from './checks.mjs';

/**
 * One reintroduced defect: what it breaks, and which check must catch it.
 * `check` is a key of CHECKS — the SAME function the green test runs, not a
 * paraphrase of it.
 */
const MUTATIONS = [
  {
    name: 'cents: drop the rounding, leave binary float dollars',
    check: 'dollars convert to exact integer cents',
    patch: (src) => replaceOnce(src,
      'const cents = (dollars) => Math.round((+dollars || 0) * 100);',
      'const cents = (dollars) => (+dollars || 0) * 100;'),
  },
  {
    name: "grams: treat 'mg' as a weight, so a 10mg gummy reads as 10 GRAMS",
    check: "'10mg' is a dose and never becomes sizeGrams",
    patch: (src) => replaceOnce(src,
      "return m[2].toLowerCase() === 'g' ? +m[1] : undefined;",
      'return +m[1];'),
  },
  {
    // THE BUG THAT SHIPPED. `buildCandidates` is the engine's shared core and
    // ranks whatever pool it is handed; `planSwap` is what slices by category.
    // Delete the adapter's own slice and the Pre-Rolls come straight back.
    name: 'candidates: delete the category slice — the defect that shipped',
    check: 'candidates() never returns a cross-category result',
    patch: (src) => replaceOnce(src,
      'if (config0.restrictToSameCategory && ep.category !== current.category) continue;',
      '/* category slice deleted */'),
  },
  {
    name: 'candidates: report a fake stock figure instead of reading `qty`',
    check: 'a short candidate is marked partial with a correct fillable/shortfall',
    patch: (src) => replaceOnce(src,
      'return raw && raw.qty != null ? raw.qty : 0;',
      'return 999;'),
  },
  {
    name: 'buildContext: fail to resolve order lines, so the cart looks empty',
    check: 'recommendations() excludes products already on the order',
    patch: (src) => replaceOnce(src,
      'const raw = catalogue.find((p) => p.sku === it.sku || p.id === it.sku);',
      'const raw = null;'),
  },
  {
    name: 'no-engine guard removed: the adapter throws at script-load time',
    check: 'the adapter degrades to null when the engine is absent',
    patch: (src) => replaceOnce(src,
      'if (!E) { window.HWSwap = null; return; }',
      '/* guard removed */'),
  },
];

// Every check must be watched to fail. If someone adds a check to checks.mjs
// and no mutation targets it, that check has never been proven to catch
// anything — and this assertion is what says so, at the moment it happens.
test('every check in checks.mjs has a mutation that must break it', () => {
  const covered = new Set(MUTATIONS.map((m) => m.check));
  const uncovered = Object.keys(CHECKS).filter((k) => !covered.has(k));
  assert.deepEqual(uncovered, [],
    'these checks have never been observed failing — add a mutation for each');

  // SCOPE, stated so nobody reads more into a green run than is there: this
  // guard sees Object.keys(CHECKS) and NOTHING ELSE. The supplementary tests
  // written inline in adapter.test.mjs are outside it and are not
  // mutation-proven. Promote one into CHECKS if you want it covered.


  for (const m of MUTATIONS) {
    assert.ok(CHECKS[m.check], `mutation "${m.name}" names a check that does not exist: ${m.check}`);
  }
});

for (const m of MUTATIONS) {
  test(`MUTANT — ${m.name}`, () => {
    const load = (opts = {}) => loadWindow({ ...opts, patch: m.patch });

    // Sanity: the mutation must actually apply. `replaceOnce` throws when the
    // target text is gone, and `loadWindow` throws when patch() is a no-op —
    // either way this surfaces as a failure rather than a silent green.
    let threw = null;
    try {
      CHECKS[m.check](load);
    } catch (err) {
      threw = err;
    }

    assert.ok(threw,
      `the mutation was applied but "${m.check}" still PASSED — that check does not ` +
      'actually catch this defect and is not protecting the adapter');

    // It must fail as an ASSERTION (or the load-time TypeError the no-engine
    // mutation deliberately causes) — not because the harness misfired.
    assert.ok(!/^harness:|^mutation target/.test(threw.message),
      `the harness itself failed, so nothing was proven: ${threw.message}`);
  });
}

// Belt and braces on the one that shipped: assert the exact wrong product
// comes back, so the record shows WHAT leaks rather than only that something
// did. A Pre-Roll offered as a replacement for a $35 eighth of Flower.
test('MUTANT DETAIL — without the slice, a Pre-Roll is offered to replace Flower', async (t) => {
  const { FLOWER_CURRENT, CATALOGUE, flatten } = await import('./harness.mjs');
  const mut = MUTATIONS.find((m) => m.check === 'candidates() never returns a cross-category result');

  const broken = loadWindow({ patch: mut.patch }).HWSwap;
  const r = broken.candidates({ current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 1 });
  const leaked = flatten(r).filter((c) => c.product.cat !== 'Flower');

  assert.ok(leaked.length > 0, 'the fixture must actually reproduce the shipped bug');
  t.diagnostic('leaked without the category slice: ' +
    leaked.map((c) => `${c.product.name} [${c.product.cat}]`).join(', '));

  // The healthy adapter, same call, same fixture: nothing leaks.
  const healthy = loadWindow().HWSwap;
  const clean = flatten(healthy.candidates({ current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 1 }));
  assert.equal(clean.filter((c) => c.product.cat !== 'Flower').length, 0);
  assert.ok(clean.length > 0, 'and it still offers real Flower alternatives');
});
