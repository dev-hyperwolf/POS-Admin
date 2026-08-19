/* shared/commerce-adapter.js — the hand-written boundary between this estate's
 * product shape and the (built, never hand-edited) commerce engine.
 *
 * It converts money, it decides what a weight is, and it has already shipped
 * one real bug: it forgot to slice the candidate pool by category, so the POS
 * offered a Pre-Roll to replace Flower. Nothing would have caught that.
 *
 * TWO TIERS, AND THE DIFFERENCE MATTERS — be honest about which you are adding.
 *
 *   ./checks.mjs   MUTATION-PROVEN. mutation.test.mjs re-runs these very same
 *                  functions against a deliberately broken adapter and REQUIRES
 *                  each to fail. A coverage guard fails the suite if a check
 *                  there has no mutation aimed at it.
 *   this file      the supplementary tests below are NOT mutation-proven. They
 *                  are green, and green is all that is known about them. A test
 *                  nobody has watched fail is a hypothesis, so treat these as
 *                  weaker evidence than anything in checks.mjs.
 *
 * Adversarial review on 2026-08-19 caught this file claiming the stronger
 * guarantee for all of it. It does not hold, and the honest split is recorded
 * here rather than quietly implied. If a supplementary test below turns out to
 * be load-bearing, promote it into checks.mjs and give it a mutation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWindow, CATALOGUE, flatten, FLOWER_CURRENT, plain } from './harness.mjs';
import { CHECKS } from './checks.mjs';

test('the two scripts load into a bare `window` with no DOM', () => {
  const w = loadWindow();
  assert.equal(typeof w.HWCommerce, 'object', 'engine bundle exposed itself');
  assert.equal(typeof w.HWSwap, 'object');
  assert.deepEqual(
    Object.keys(w.HWSwap).sort(),
    ['MODES', 'buildContext', 'candidates', 'emptyNote', 'engine', 'recommendations', 'toEngineProduct'],
    'the public surface callers depend on',
  );
});

for (const [name, check] of Object.entries(CHECKS)) {
  test(name, () => check(loadWindow));
}

// ── Smaller mappings, asserted once so a rename cannot pass silently ─────────

test('estate fields map onto the engine product', () => {
  const { toEngineProduct } = loadWindow().HWSwap;

  const ep = toEngineProduct(FLOWER_CURRENT);
  assert.equal(ep.id, 'blue-dream');
  assert.equal(ep.sku, 'blue-dream');
  assert.equal(ep.category, 'Flower', 'estate `cat` becomes engine `category`');
  assert.equal(ep.strainType, 'hybrid');
  assert.equal(ep.thcPercent, 24);
  // POS margin is a 0..1 fraction; the engine wants 0..100. Getting this
  // backwards makes every margin weight 100x too small and silently reorders
  // nothing — the exact kind of bug that never raises an error.
  assert.equal(ep.marginPct, 42, '0.42 must become 42, not 0.42');

  // `brand` is required by the engine on purpose: a swap row cannot render
  // without one, so the adapter fills a placeholder rather than emit undefined.
  const bare = toEngineProduct({ sku: 'only-sku' });
  assert.equal(bare.id, 'only-sku', 'id falls back to sku');
  assert.equal(bare.brand, '—');
  assert.equal(bare.category, '—');
  assert.equal(toEngineProduct(null), null);

  // An unrecognised strain is dropped, not passed through as junk.
  assert.ok(!('strainType' in toEngineProduct({ id: 'x', price: 1, strain: 'Runtz' })));
});

test('candidates() returns null for a line it cannot map', () => {
  const { candidates } = loadWindow().HWSwap;
  assert.equal(candidates({ current: null, pool: CATALOGUE }), null);
});

test('candidates() carries both the estate object and the engine one', () => {
  const HWSwap = loadWindow().HWSwap;
  const r = HWSwap.candidates({ current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 1 });

  for (const c of flatten(r)) {
    const src = CATALOGUE.find((p) => p.id === c.product.id);
    assert.ok(src, 'product must be the ORIGINAL estate object');
    assert.equal(c.product, src, 'same reference, so callers keep their own fields');
    assert.equal(c.engineProduct.price, Math.round(src.price * 100), 'engine copy is in cents');
    assert.ok(typeof c.priceDeltaLabel === 'string' || c.priceDeltaLabel === null);
  }
  assert.equal(r.total, r.similar.length + r.cheaper.length + r.stronger.length);
});

test('candidates() honours the caller-supplied pool and exclusions', () => {
  const HWSwap = loadWindow().HWSwap;

  // The POS passes the store catalogue; the driver app passes ONE van's kit.
  const vanKit = CATALOGUE.filter((p) => p.id === 'house-flower' || p.id === FLOWER_CURRENT.id);
  const r = HWSwap.candidates({ current: FLOWER_CURRENT, pool: vanKit, quantity: 1 });
  assert.deepEqual([...new Set(flatten(r).map((c) => c.product.id))], ['house-flower']);

  const excluded = HWSwap.candidates({
    current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 1, exclude: ['house-flower', 'do-si-dos'],
  });
  const ids = flatten(excluded).map((c) => c.product.id);
  assert.ok(!ids.includes('house-flower') && !ids.includes('do-si-dos'));
});

test('emptyNote() always returns a renderable sentence', () => {
  const HWSwap = loadWindow().HWSwap;

  // Nothing in the pool but the item itself → every ladder is empty.
  const r = HWSwap.candidates({ current: FLOWER_CURRENT, pool: [FLOWER_CURRENT], quantity: 1 });
  assert.equal(r.total, 0);
  for (const mode of ['similar', 'cheaper', 'stronger']) {
    const note = HWSwap.emptyNote(r, mode, 'Flower');
    assert.equal(typeof note, 'string');
    assert.ok(note.length > 0, `${mode} produced an empty note`);
  }
  // And it still speaks when handed nothing at all, rather than throwing into
  // a render.
  assert.equal(typeof HWSwap.emptyNote(null, 'similar', 'Flower'), 'string');
  assert.ok(HWSwap.emptyNote(null, 'similar', 'Flower').includes('Flower'));
});

test('buildContext() reports stock per product and derives affinity from the order', () => {
  const HWSwap = loadWindow().HWSwap;

  const ctx = HWSwap.buildContext({
    catalogue: CATALOGUE,
    orderItems: [{ sku: 'blue-dream', qty: 2 }, { sku: 'not-in-catalogue', qty: 1 }],
    now: new Date('2026-08-19T18:00:00Z'),
  });

  assert.equal(ctx.snapshot.products.length, CATALOGUE.length);
  // `plain()` because these objects are built inside the vm realm — see harness.
  assert.deepEqual(plain(ctx.snapshot.availability['blue-dream']), { express: 10, scheduled: 10 });

  // A line whose sku is not in the catalogue is DROPPED, not carried as a
  // dangling productId the engine would have to guess about.
  assert.equal(ctx.cart.lines.length, 1);
  assert.deepEqual(plain(ctx.cart.lines[0]),
    { id: 'l0', productId: 'blue-dream', quantity: 2, lane: 'express' });

  assert.deepEqual(plain(ctx.customer.favoriteCategories), ['Flower']);
  assert.deepEqual(plain(ctx.customer.purchasedBrands), ['Pacific Stone']);

  // The clock is an input, never read — that is what makes the engine testable.
  assert.equal(ctx.now.toISOString(), '2026-08-19T18:00:00.000Z');

  // A caller-supplied customer wins over the derived one.
  const withCust = HWSwap.buildContext({
    catalogue: CATALOGUE, orderItems: [{ sku: 'blue-dream', qty: 1 }],
    customer: { favoriteCategories: ['Edibles'], loyaltyTier: 'Gold' },
  });
  assert.deepEqual(plain(withCust.customer.favoriteCategories), ['Edibles']);
  assert.equal(withCust.customer.loyaltyTier, 'Gold');
});

test('recommendations() returns null rather than throwing when the engine rejects the context', () => {
  const HWSwap = loadWindow().HWSwap;

  // A malformed promotion rule makes the engine throw. The adapter must
  // swallow it and return null — that is the signal every caller falls back
  // on. A throw here would take out the render that called it.
  assert.equal(HWSwap.recommendations({ catalogue: CATALOGUE, rules: [null] }), null);

  // An EMPTY catalogue is not an error, it is an empty list. Conflating the
  // two would make callers show a fallback rail for a store with no stock.
  const none = HWSwap.recommendations({ catalogue: [] });
  assert.notEqual(none, null, 'an empty store is an empty list, not a failure');
  assert.equal(none.length, 0);

  // NOTE the adapter writes `slotsBySurface[surface] = limit` for whatever
  // surface it is given, so an unrecognised surface still gets slots and still
  // ranks. Asserted so the behaviour is chosen rather than assumed: the engine
  // alone would have given an unknown surface 0 slots.
  const odd = HWSwap.recommendations({ catalogue: CATALOGUE, surface: 'not-a-real-surface' });
  assert.ok(Array.isArray(odd) && odd.length > 0,
    'the adapter opens slots for any surface it is handed');
  assert.ok(odd.every((o) => 'cat' in o.product), 'still estate shape');
});
