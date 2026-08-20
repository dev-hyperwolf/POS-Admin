/* Operator-controlled lane economics.
 *
 * The owner: "Fees vary by distance, zone and time. Express minimum varies by
 * zone — most of the time it is $50", and: make it adjustable in POS settings.
 *
 * The numbers are PROVISIONAL — no confirmed per-zone table exists in this repo
 * or in the Weedmaps publisher. What must be true is that whatever the operator
 * sets is what the customer is actually held to, everywhere, from one source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('the shipped default is the owner’s provisional $50, and says it is default', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    HW.resetLaneSettings();
    assert.equal(HW.laneSettings().expressMinimum, 50);
    assert.equal(HW.laneSettings().expressFee, 2);
    assert.equal(HW.laneSettingsAreDefault(), true);
    HW.setLaneSettings({ expressMinimum: 75 });
    assert.equal(HW.laneSettingsAreDefault(), false,
      'a surface cannot label these "provisional" if it cannot tell they are untouched');
    HW.resetLaneSettings();
  });
});

test('a negative or non-numeric figure is REFUSED, not coerced', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    HW.resetLaneSettings();
    // A negative minimum would silently switch the gate off — every cart would
    // clear a floor of -10, and nothing would look wrong.
    assert.equal(HW.setLaneSettings({ expressMinimum: -10 }), null);
    assert.equal(HW.setLaneSettings({ expressFee: 'free' }), null);
    assert.equal(HW.laneSettings().expressMinimum, 50, 'a refused write must not have landed');
    HW.resetLaneSettings();
  });
});

test('a partial patch leaves the other figures alone', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    HW.resetLaneSettings();
    // ⚠️ THE UNTOUCHED FIGURE MUST BE MOVED OFF ITS DEFAULT FIRST. My first
    // version patched the fee and then checked the minimum was still 50 — but
    // 50 IS the default, so an implementation that discarded the current
    // settings and rebuilt from defaults passed. Caught by mutating it.
    HW.setLaneSettings({ expressMinimum: 77 });
    HW.setLaneSettings({ expressFee: 3.5 });
    assert.equal(HW.laneSettings().expressFee, 3.5);
    assert.equal(HW.laneSettings().expressMinimum, 77,
      'setting the fee reset the minimum the operator had already chosen');
    HW.resetLaneSettings();
  });
});

test('what the operator sets is what the STOREFRONT holds the customer to', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, HW = W.HW, SHOP = W.SHOP, D = W.SHOPDATA;
    HW.resetLaneSettings();
    const ex = D.allProducts().find((p) => D.isExpress(p.sku));
    assert.ok(ex, 'the fixture needs an express-available product');
    SHOP.clear();
    SHOP.add(ex.sku, 1, 'express');

    const laneOf = () => SHOP.totals().lanes.find((l) => l.lane === 'express');
    // Straddle the ACTUAL line value rather than two numbers picked in advance —
    // my first version used $20 against a $15 product, so BOTH minimums were
    // unmet and the test proved nothing. The negative control below is what
    // caught it.
    const sub = laneOf().subtotalCents;
    assert.ok(sub > 200, 'the fixture line must be worth enough to sit either side of a minimum');
    const under = Math.floor(sub / 100) - 1;      // dollars, comfortably below
    const over = Math.ceil(sub / 100) + 50;       // dollars, comfortably above

    HW.setLaneSettings({ expressMinimum: under });
    const low = laneOf();
    HW.setLaneSettings({ expressMinimum: over });
    const high = laneOf();

    assert.equal(low.minimumCents, under * 100, 'the engine did not receive the operator’s minimum');
    assert.equal(high.minimumCents, over * 100);
    assert.notEqual(low.minimumMet, high.minimumMet,
      'the fixture must straddle the two minimums or this proves nothing');
    assert.ok(high.shortfallCents > 0 && high.progress < 1,
      'the progress bar must reflect the operator’s figure, not a shipped constant');
    HW.resetLaneSettings();
  });
});

test('the fee the operator sets is the fee the customer is charged', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, HW = W.HW, SHOP = W.SHOP, D = W.SHOPDATA;
    HW.resetLaneSettings();
    const ex = D.allProducts().find((p) => D.isExpress(p.sku));
    SHOP.clear();
    // ONE unit, deliberately. A larger cart crosses the free-delivery rule and
    // the fee is legitimately WAIVED — my first version added eight and then
    // asserted the fee was charged, which failed against entirely correct code.
    SHOP.add(ex.sku, 1, 'express');
    HW.setLaneSettings({ expressMinimum: 1 });

    const laneOf = () => SHOP.totals().lanes.find((l) => l.lane === 'express');
    assert.equal(laneOf().feeWaived, false, 'this fixture must NOT trigger the free-delivery rule');

    HW.setLaneSettings({ expressFee: 2 });
    assert.equal(laneOf().feeCents, 200);
    HW.setLaneSettings({ expressFee: 7.5 });
    assert.equal(laneOf().feeCents, 750, 'the operator raised the fee and the customer was charged the old one');
    HW.resetLaneSettings();
  });
});

test('a waived fee stays waived whatever the operator sets — the rule outranks the setting', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, HW = W.HW, SHOP = W.SHOP, D = W.SHOPDATA;
    HW.resetLaneSettings();
    const ex = D.allProducts().find((p) => D.isExpress(p.sku));
    SHOP.clear();
    SHOP.add(ex.sku, 12, 'express');          // over the free-delivery threshold
    HW.setLaneSettings({ expressMinimum: 1, expressFee: 25 });

    const lane = SHOP.totals().lanes.find((l) => l.lane === 'express');
    assert.equal(lane.feeWaived, true, 'the fixture must be over the free-delivery threshold');
    assert.equal(lane.feeCents, 0,
      'a customer promised free delivery was charged the operator’s fee anyway');
    HW.resetLaneSettings();
  });
});
