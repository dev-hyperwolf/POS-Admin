/* ── The assertions themselves, factored out so they can be RUN TWICE ────────
 *
 * `adapter.test.mjs` runs each check against the real adapter and expects it to
 * pass. `mutation.test.mjs` runs THE SAME FUNCTION against an adapter broken in
 * memory and expects it to fail. That is only meaningful because both call this
 * one copy: a guard proved against a paraphrase of itself proves nothing.
 *
 * Every check takes a `load(opts) -> window` so the mutation test can inject a
 * patched loader.
 */
import assert from 'node:assert/strict';
import { loadWindow, FLOWER_CURRENT, CATALOGUE, flatten } from './harness.mjs';

const swapFrom = (load, opts) => {
  const w = load(opts);
  assert.ok(w.HWSwap, 'HWSwap did not load');
  return w.HWSwap;
};

export const CHECKS = {
  /* Money crosses this boundary exactly once in the whole estate. Dollars in,
   * integer cents out. `x * 100` is wrong for most two-decimal prices in
   * binary floating point and the engine compares prices for equality. */
  'dollars convert to exact integer cents'(load = loadWindow) {
    const { toEngineProduct } = swapFrom(load);

    const cases = [
      [0, 0], [1, 100], [0.07, 7], [8.15, 815], [19.99, 1999],
      [35, 3500], [35.5, 3550], [129.95, 12995], [1234.56, 123456],
    ];
    for (const [dollars, expected] of cases) {
      const ep = toEngineProduct({ id: 'x', price: dollars });
      assert.equal(ep.price, expected, `$${dollars} should be ${expected} cents`);
      assert.ok(Number.isInteger(ep.price), `$${dollars} produced a non-integer: ${ep.price}`);
    }

    // Same conversion for the strike-through price, and a string parses.
    assert.equal(toEngineProduct({ id: 'x', price: '35.50' }).price, 3550);
    assert.equal(toEngineProduct({ id: 'x', price: 40, was: 59.99 }).compareAtPrice, 5999);

    // Missing / junk price must be 0 cents, never NaN — NaN poisons every
    // price band and silently empties the ladders instead of erroring.
    for (const junk of [undefined, null, '', 'free', NaN]) {
      const p = toEngineProduct({ id: 'x', price: junk }).price;
      assert.equal(p, 0, `price ${String(junk)} should floor to 0, got ${p}`);
    }
  },

  /* '10mg' is an EDIBLES DOSE. If it became sizeGrams the engine would read a
   * 10mg gummy as 10 GRAMS and rank it a step up over every eighth. */
  "'10mg' is a dose and never becomes sizeGrams"(load = loadWindow) {
    const { toEngineProduct } = swapFrom(load);
    const size = (wt) => toEngineProduct({ id: 'x', price: 10, wt });

    for (const wt of ['10mg', '100mg', '5 mg', '10MG']) {
      const ep = size(wt);
      assert.equal(ep.sizeGrams, undefined, `${wt} must not carry a weight`);
      assert.ok(!('sizeGrams' in ep),
        `${wt} must not even define sizeGrams — the engine branches on its presence`);
    }

    // Weights DO convert, and keep their decimal.
    assert.equal(size('3.5g').sizeGrams, 3.5);
    assert.equal(size('1g').sizeGrams, 1);
    assert.equal(size('0.5 g').sizeGrams, 0.5);
    assert.equal(size('28G').sizeGrams, 28);

    // Anything that is not a weight is absent, not guessed.
    for (const wt of ['2pk', '5 pack', '', undefined, null, 3.5]) {
      assert.ok(!('sizeGrams' in size(wt)), `${String(wt)} must not produce a weight`);
    }
  },

  /* THE SHIPPED BUG. `buildCandidates` is the engine's shared core and ranks
   * whatever pool it is handed; slicing by category is this adapter's job.
   * Without it the POS offers a Pre-Roll to replace Flower. */
  'candidates() never returns a cross-category result'(load = loadWindow) {
    const HWSwap = swapFrom(load);
    const r = HWSwap.candidates({ current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 1 });

    const all = flatten(r);
    // A category filter that returns nothing would pass the assertion below
    // for the wrong reason, so prove the ladders are actually populated first.
    assert.ok(all.length >= 3, `expected real candidates, got ${all.length}`);
    assert.ok(r.similar.length > 0 && r.cheaper.length > 0 && r.stronger.length > 0,
      'every ladder should have something in this fixture');

    for (const c of all) {
      assert.equal(c.product.cat, 'Flower',
        `cross-category candidate leaked: ${c.product.name} (${c.product.cat})`);
      assert.equal(c.engineProduct.category, 'Flower');
    }
    // Named explicitly: these three are in-price-band, cheaper AND stronger,
    // so they are exactly what leaks when the slice is missing.
    const ids = all.map((c) => c.product.id);
    for (const wrong of ['indica-blunts-2pk', 'mini-j-5pk', 'gummies-100mg']) {
      assert.ok(!ids.includes(wrong), `${wrong} is not Flower and must not be offered`);
    }
    // The line being replaced is never its own alternative.
    assert.ok(!ids.includes(FLOWER_CURRENT.id));
  },

  /* A candidate holding fewer units than the line needs must say so, with the
   * real numbers — a row that claims to replace the line when it can only
   * cover part of it is how a driver ends up short at the door. */
  'a short candidate is marked partial with a correct fillable/shortfall'(load = loadWindow) {
    const HWSwap = swapFrom(load);

    // `last-jar` holds 1 unit; the line needs 3.
    const r = HWSwap.candidates({
      current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 3,
      config: { onInsufficientQuantity: 'offer-partial' },
    });

    const short = flatten(r).find((c) => c.product.id === 'last-jar');
    assert.ok(short, 'the 1-unit candidate should be offered under offer-partial');
    assert.equal(short.unitsAvailable, 1);
    assert.equal(short.fillable, 1, 'it can cover exactly 1 of the 3');
    assert.equal(short.shortfall, 2, '2 units stay on the original line');
    assert.equal(short.partial, true);
    assert.equal(short.fillable + short.shortfall, 3, 'fillable + shortfall must equal the line');

    // A candidate that CAN cover the line is not partial, and never claims
    // more units than the line asked for.
    const full = flatten(r).find((c) => c.product.id === 'do-si-dos');
    assert.ok(full, 'the 8-unit candidate should be offered');
    assert.equal(full.unitsAvailable, 8);
    assert.equal(full.fillable, 3, 'capped at what the line needs, not 8');
    assert.equal(full.shortfall, 0);
    assert.equal(full.partial, false);

    // Under the DEFAULT config a short candidate is excluded outright rather
    // than quietly offered as if it were a whole replacement.
    const strict = HWSwap.candidates({ current: FLOWER_CURRENT, pool: CATALOGUE, quantity: 3 });
    const leaked = flatten(strict).find((c) => c.product.id === 'last-jar');
    assert.equal(leaked, undefined, 'default config must exclude a candidate that cannot fill the line');
    assert.ok(flatten(strict).every((c) => c.partial === false),
      'nothing is partial under the default config');
  },

  /* Recommending what is already on the order is the classic upsell bug. */
  'recommendations() excludes products already on the order'(load = loadWindow) {
    const HWSwap = swapFrom(load);

    const orderItems = [{ sku: 'blue-dream', qty: 1 }, { sku: 'house-flower', qty: 2 }];
    const recs = HWSwap.recommendations({
      catalogue: CATALOGUE, orderItems,
      now: new Date('2026-08-19T18:00:00Z'), // pure engine: the clock is an input
    });

    assert.ok(Array.isArray(recs), 'recommendations() should return an array here');
    assert.ok(recs.length > 0, 'expected some recommendations from this catalogue');

    const onOrder = new Set(orderItems.map((i) => i.sku));
    for (const rec of recs) {
      assert.ok(!onOrder.has(rec.product.sku),
        `${rec.product.name} is already on the order and must not be recommended`);
      assert.ok(!onOrder.has(rec.product.id));
    }
    // It hands back the ESTATE object (dollars, `cat`), not the engine one —
    // a caller that renders `product.price` must not print cents as dollars.
    for (const rec of recs) {
      assert.ok('cat' in rec.product, `${rec.product.id} came back in engine shape, not estate shape`);
      const src = CATALOGUE.find((p) => p.id === rec.product.id);
      assert.equal(rec.product.price, src.price, 'price must still be dollars');
    }
  },

  /* If the engine script fails to load, every caller does
   * `window.HWSwap && …` and renders no swap control. A throw at load time
   * would instead take out whatever script tag ran next. */
  'the adapter degrades to null when the engine is absent'(load = loadWindow) {
    let w;
    assert.doesNotThrow(() => { w = load({ engine: false }); },
      'loading the adapter without the engine must not throw');
    assert.equal(w.HWCommerce, undefined, 'fixture sanity: the engine really is absent');
    assert.equal(w.HWSwap, null, 'HWSwap must be exactly null, so `HWSwap &&` short-circuits');
    // The guard callers actually write.
    assert.equal(w.HWSwap && w.HWSwap.candidates({ current: {}, pool: [] }), null);
  },
};
