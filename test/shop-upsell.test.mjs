/* ── THE UPSELL ENGINE, ON THE STOREFRONT'S CART AND CHECKOUT ───────────────
 *
 * These boot the real storefront, render the real screens into jsdom and click
 * real buttons. Every expectation is derived from `window.HWCommerce` at the
 * moment of the assertion — no offer id, product, price or threshold is written
 * down here. A test that pinned "Thin Mint Sugar" would pass a build whose rail
 * had stopped consulting the engine entirely.
 *
 * ⚠️ Values off `app.window` are jsdom-realm: compare primitives.
 * ⚠️ `app.click` matches text EXACTLY; the dismiss control is an IconBtn with no
 *    text, so it is reached by a predicate on its aria-label — and every click's
 *    RETURN VALUE is asserted, because a test that clicks nothing and passes is
 *    the failure this harness exists to replace.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Mount a screen on its OWN host node — app.mount() re-roots #root. */
function screens(app) {
  const W = app.window;
  let cur = null;
  const close = () => {
    if (!cur) return;
    try { cur.root.unmount(); } catch { /* already gone */ }
    cur.host.remove();
    cur = null;
  };
  const open = async (name, props) => {
    close();
    assert.equal(typeof W[name], 'function', `${name} is not defined — the page did not finish loading`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W[name], props || {}));
    cur = { root, host };
    await app.settle();
    await app.settle();
    return host;
  };
  open.close = close;
  return open;
}

function withShop(fn) {
  return withApp('shop', async (app) => {
    const open = screens(app);
    try { await fn(app, app.window, open); } finally { open.close(); }
  }, { settleMs: 60 });
}

/** What the ENGINE says, asked directly — the yardstick for every assertion. */
const engineOffers = (W, surface) =>
  W.HWCommerce.getUpsells(W.SHOP.context(), surface, { rules: W.SHOP.engineOptions().rules });

const laneOf = (W, id) => W.SHOP.totals().lanes.find((l) => l.lane === id) || null;

/** The offer ids the screen currently has on it, in DOM order. */
const shownIds = (host) => [...host.querySelectorAll('[data-hw-offer]')]
  .map((el) => el.getAttribute('data-hw-offer'));

/**
 * An express-dominant cart, over the express minimum and still SHORT of the
 * free-delivery promotion — the band where both threshold surfaces are live at
 * once, which is the only band that exercises either of them.
 *
 * The express sku must be one TODAY'S VAN carries deep enough, or the whole add
 * spills into scheduled and the fixture has no express lane at all.
 */
function loadExpressCart(W, qty = 3) {
  const p = W.SHOPDATA.allProducts()
    .filter((x) => x.qty > 0 && x.price >= 20 && W.SHOPDATA.expressUnits(x.sku) >= qty)
    .sort((a, b) => a.price - b.price)[0];
  assert.ok(p, `nothing on today's van ${qty} deep — no express lane is buildable`);
  W.SHOP.add(p.sku, qty, 'express');
  assert.ok(laneOf(W, 'express'), 'the fixture must produce an express lane');
  return p;
}

// ── The rail is the engine's, card for card ────────────────────────────────

test('the cart rail renders exactly the offers the engine returned, by id', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    const expected = engineOffers(W, 'cart_add_to_order')
      .filter((o) => W.SHOPCART_UI.deliverable(o.product.id, o.quantity, o.lane))
      .map((o) => o.id);
    assert.ok(expected.length > 1, 'this case needs the engine to actually produce a rail');

    const host = await open('ShopCartScreen');
    assert.equal(shownIds(host).join(','), expected.join(','),
      "the rail must be the engine's list, in the engine's order");

    // The engine's own copy, verbatim — not a rewrite of it.
    const text = app.text();
    for (const o of engineOffers(W, 'cart_add_to_order').slice(0, 2)) {
      assert.ok(text.includes(o.headline), `the engine's headline "${o.headline}" must be on screen`);
    }
  });
});

test("the checkout asks for its OWN surface, and the engine caps it lower than the cart", async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    W.SCO_STATE.address = '123 Test St, Long Beach';
    const cartN = engineOffers(W, 'cart_add_to_order').length;
    const outN = engineOffers(W, 'checkout_callout').length;
    assert.ok(outN > 0 && outN < cartN,
      `this case is only meaningful when the surfaces differ; cart=${cartN} checkout=${outN}`);

    const host = await open('ShopCheckoutScreen');
    assert.equal(shownIds(host).length, outN,
      "the checkout rail must hold the checkout surface's slots, not the cart's");
    const rail = host.querySelector('[data-hw="upsell-rail"]');
    assert.ok(rail, 'the checkout must carry an upsell rail');
    assert.equal(rail.getAttribute('data-hw-surface'), 'checkout_callout');
  });
});

// ── 🔴 Never offer what the customer's lane cannot deliver ─────────────────

test('an offer for a sku today’s van is not carrying never reaches an express cart', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);

    // The engine's availability comes from HWSwap.buildContext, which reports
    // WAREHOUSE qty for both lanes. So it will offer an express shopper things
    // no driver has — this fixture only proves anything if it actually does.
    const raw = engineOffers(W, 'cart_add_to_order');
    const undeliverable = raw.filter((o) => o.lane === 'express'
      && W.SHOPDATA.expressHeadroom(o.product.id) < o.quantity);
    assert.ok(undeliverable.length > 0,
      'the engine must be offering at least one off-van sku, or this test proves nothing');

    const host = await open('ShopCartScreen');
    const shown = shownIds(host);
    for (const o of undeliverable) {
      assert.ok(!shown.includes(o.id),
        `${o.product.id} is not on today's van — offering it promises ~90 minutes nobody can keep`);
    }
    assert.equal(shown.length, raw.length - undeliverable.length,
      'every other offer must survive — the filter must refuse the van, not the rail');
  });
});

// ── 🔴 A dismissed offer does not come back for that visit ─────────────────

test('dismissing a card removes THAT offer and backfills the rail rather than shrinking it', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    const host = await open('ShopCartScreen');
    const before = shownIds(host);
    assert.ok(before.length >= 2, 'this case needs a rail with something to backfill from');

    const victim = engineOffers(W, 'cart_add_to_order')[0];
    assert.equal(before[0], victim.id);
    assert.ok(app.click((t, el) => el.getAttribute('aria-label') === `Dismiss ${victim.headline}`),
      'each offer card must carry a reachable dismiss control');
    await app.settle();

    const after = shownIds(host);
    assert.ok(!after.includes(victim.id), 'the dismissed offer must be gone');
    // 🔴 NOT an assertion on the COUNT. The engine suppresses while BUILDING, so
    // the rail refills to the same width — a count check would pass even if the
    // dismissal had been ignored entirely.
    assert.ok(after.length > 0, 'the rail must refill rather than collapse');
    // And what IS left is still the engine's answer, asked afresh with the
    // dismissal in hand — not a list this screen edited for itself.
    assert.equal(after.join(','),
      W.HWCommerce.getUpsells(W.SHOP.context(), 'cart_add_to_order', {
        rules: W.SHOP.engineOptions().rules, dismissed: [victim.id],
      }).filter((o) => W.SHOPCART_UI.deliverable(o.product.id, o.quantity, o.lane))
        .map((o) => o.id).join(','),
      'what is left must still be exactly what the engine returns once told');
  });
});

test('an offer dismissed in the cart does not reappear at the checkout', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    W.SCO_STATE.address = '123 Test St, Long Beach';

    // Pick something the CHECKOUT would show, then wave it away one screen earlier.
    let host = await open('ShopCheckoutScreen');
    const atCheckout = shownIds(host);
    assert.ok(atCheckout.length > 0, 'the checkout must start with a rail');
    const victim = engineOffers(W, 'checkout_callout').find((o) => o.id === atCheckout[0]);
    assert.ok(victim, "the checkout rail must be the engine's offers");

    host = await open('ShopCartScreen');
    assert.ok(shownIds(host).includes(victim.id), 'the fixture needs it on the cart too');
    assert.ok(app.click((t, el) => el.getAttribute('aria-label') === `Dismiss ${victim.headline}`),
      'the cart card must be dismissable');
    await app.settle();

    host = await open('ShopCheckoutScreen');
    assert.ok(!shownIds(host).includes(victim.id),
      'a dismissal is for the VISIT — it must cross from the cart to the checkout');
  });
});

// ── 🔴 The threshold comes from the engine's lane record, never from a $50 ──

test("the “meets the minimum” badge tracks the OPERATOR's minimum, not a literal", async () => {
  await withShop(async (app, W, open) => {
    // One cheap express line, under the minimum whatever the operator set it to.
    const cheap = W.SHOPDATA.allProducts()
      .filter((p) => p.qty > 0 && p.price > 0 && W.SHOPDATA.expressUnits(p.sku) > 0)
      .sort((a, b) => a.price - b.price)[0];
    W.SHOP.add(cheap.sku, 1, 'express');

    /** Which offer ids the screen badges as clearing the lane minimum. */
    const badged = (host) => [...host.querySelectorAll('[data-hw-offer]')]
      .filter((el) => /Meets the Express minimum/.test(el.textContent || ''))
      .map((el) => el.getAttribute('data-hw-offer'));
    /** Which ones the ENGINE's own lane record says clear it. */
    const shouldBadge = () => {
      const lane = laneOf(W, 'express');
      return W.SHOPCART_UI.offers('cart_add_to_order')
        .filter((e) => e.offer.product.price * e.offer.quantity >= lane.shortfallCents)
        .map((e) => e.offer.id).sort();
    };

    // ── At the shipped minimum ──
    let lane = laneOf(W, 'express');
    assert.equal(lane.minimumMet, false, 'the fixture must start under the minimum');
    let host = await open('ShopCartScreen');
    let want = shouldBadge();
    assert.ok(want.length > 0 && want.length < shownIds(host).length,
      'the fixture must STRADDLE the threshold — some offers clear it, some do not; '
      + `${want.length} of ${shownIds(host).length}`);
    assert.equal(badged(host).sort().join(','), want.join(','));

    // ── Now move the minimum, as an operator can, and demand the badge moves ──
    // Raised so that NO single offer can close it. A literal threshold survives
    // the first half of this test and dies here.
    const raised = Math.round((lane.subtotalCents + 40000) / 100);
    assert.ok(W.HW.setLaneSettings({ expressMinimum: raised }), 'the operator minimum must be settable');
    lane = laneOf(W, 'express');
    assert.equal(lane.minimumCents, raised * 100, 'the engine must be pricing the NEW minimum');

    host = await open('ShopCartScreen');
    want = shouldBadge();
    assert.equal(want.length, 0,
      'at a minimum this far above the cart, no single offer can close it');
    assert.equal(badged(host).length, 0,
      'the badge must follow the operator minimum the progress bar is drawing');
  });
});

test('nothing is badged once the lane minimum is already met', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    assert.equal(laneOf(W, 'express').minimumMet, true, 'this fixture must clear the minimum');
    const host = await open('ShopCartScreen');
    assert.ok(shownIds(host).length > 0, 'there must be a rail to inspect');
    assert.ok(!/Meets the Express minimum/.test(host.textContent || ''),
      'a met minimum cannot be "met" again by adding something');
  });
});

// ── 🔴 "Spend $X more for free delivery" — the rule's own gap ──────────────

test("the savings line states the engine's gap, and follows it as the cart grows", async () => {
  await withShop(async (app, W, open) => {
    const p = loadExpressCart(W);
    const rows = W.SHOPCART_UI.savings();
    assert.ok(rows.length > 0, 'this cart must be short of at least one live promotion');
    const row = rows[0];

    let host = await open('ShopCartScreen');
    assert.ok(host.querySelector('[data-hw="savings-line"]'), 'the cart must carry a savings line');
    assert.ok((host.textContent || '').includes(`Add ${W.SHOP.money(row.gap.amountCents)} more`),
      "the amount must be the engine's gap, formatted by the engine");
    assert.ok((host.textContent || '').includes(row.rule.name),
      "the promotion must be named by the merchandiser's own copy");

    // ── Close some of the gap. The sentence must move with it. ──
    const before = row.gap.amountCents;
    W.SHOP.add(p.sku, 1, 'express');
    const after = W.SHOPCART_UI.savings()[0];
    assert.ok(after && after.gap.amountCents < before,
      'adding to the express lane must shrink the express gap');
    host = await open('ShopCartScreen');
    assert.ok((host.textContent || '').includes(`Add ${W.SHOP.money(after.gap.amountCents)} more`),
      'the line must re-derive, not hold the figure it first rendered');
    assert.ok(!(host.textContent || '').includes(`Add ${W.SHOP.money(before)} more`),
      'the stale figure must be gone');
  });
});

test('a promotion this customer cannot earn is never advertised as almost-earned', async () => {
  await withShop(async (app, W, open) => {
    /* 🔴 THE FIXTURE HAS TO STRADDLE THE RULE, NOT JUST SIT NEXT TO IT.
     *
     * WELCOME20 is first-order-only AND needs a $60 subtotal. This customer has
     * two orders behind him, so its order-count condition is `unreachable` — but
     * its subtotal condition is an ordinary, perfectly closable spend gap.
     *
     * That only becomes a LIE the screen could tell while the subtotal is short:
     * over $60 the rule reports no closable gap at all and any implementation
     * looks correct. So this cart is deliberately UNDER it — one cheap line —
     * which is the state where an unguarded read renders
     * "Add $x more · Welcome — $20 off your first order" to a customer who can
     * never have it. */
    const cheap = W.SHOPDATA.allProducts()
      .filter((p) => p.qty > 0 && p.price > 0 && W.SHOPDATA.expressUnits(p.sku) > 0)
      .sort((a, b) => a.price - b.price)[0];
    W.SHOP.add(cheap.sku, 1, 'express');

    const E = W.HWCommerce, ctx = W.SHOP.context();
    const welcome = W.SHOP.engineOptions().rules.find((r) => r.code);
    assert.ok(welcome, 'the rule set must contain a coded first-order promotion for this case');
    const r = E.evaluateRule(welcome, ctx);
    assert.equal(r.satisfied, false);
    assert.equal(r.blockedByUnreachable, true,
      'the fixture is only meaningful while something the customer cannot change blocks this rule');
    assert.ok(r.closableGaps.some((g) => g.kind === 'spend'),
      'and only while it ALSO reports a closable spend gap — that is the trap');

    assert.ok(!W.SHOPCART_UI.savings().some((x) => x.rule.id === welcome.id),
      `${welcome.id} cannot be earned by adding to this cart — it must not be dangled`);

    const host = await open('ShopCartScreen');
    assert.ok(!(host.textContent || '').includes(welcome.name),
      'a promotion the cart cannot earn must not appear as a threshold');
    // The surface is not simply dead: a promotion that CAN be closed is on it.
    assert.ok(host.querySelector('[data-hw="savings-line"]'),
      'this must be a filter, not an empty savings surface that would pass by accident');
  });
});

test('a dismissed savings line does not come back for that visit', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    const row = W.SHOPCART_UI.savings()[0];
    assert.ok(row, 'the fixture needs a savings line to dismiss');
    const host = await open('ShopCartScreen');
    assert.ok(app.click((t, el) => el.getAttribute('aria-label') === `Dismiss ${row.rule.name}`),
      'the savings line must carry a reachable dismiss control');
    await app.settle();
    assert.ok(!(host.textContent || '').includes(row.rule.name), 'it must be gone from the cart');
    assert.ok(!W.SHOPCART_UI.savings().some((r) => r.rule.id === row.rule.id),
      'and gone from the surface the checkout reads too');
  });
});

// ── Taking an offer ────────────────────────────────────────────────────────

test("Add puts the engine's quantity into the engine's lane, and the totals move by exactly that", async () => {
  await withShop(async (app, W, open) => {
    // A SCHEDULED-dominant cart, so the engine infers the scheduled lane. An
    // express-only fixture cannot tell "added to the offer's lane" apart from
    // "added to whatever lane the storefront defaults to".
    const p = W.SHOPDATA.allProducts().filter((x) => x.qty > 0 && x.price >= 20)[0];
    W.SHOP.add(p.sku, 6, 'scheduled');
    const offers = W.SHOPCART_UI.offers('cart_add_to_order');
    assert.ok(offers.length > 0, 'the fixture needs a rail');
    const o = offers[0].offer;
    assert.equal(o.lane, 'scheduled', 'the engine must have inferred the scheduled lane here');

    const host = await open('ShopCartScreen');
    const laneBefore = laneOf(W, 'scheduled').subtotalCents;
    const card = host.querySelector(`[data-hw-offer="${o.id}"]`);
    assert.ok(card, 'the offer must be on screen to be taken');
    assert.ok(app.click((t, el) => t === 'Add' && card.contains(el)),
      'the card must carry a working Add');
    await app.settle();

    const line = W.SHOP.lines().find((l) => l.sku === o.product.id);
    assert.ok(line, 'the offered sku must be in the cart');
    assert.equal(line.lane, 'scheduled', 'it must land in the lane the offer was validated against');
    assert.equal(line.qty, o.quantity, "the engine's quantity, not one");
    assert.equal(laneOf(W, 'scheduled').subtotalCents, laneBefore + o.product.price * o.quantity,
      "the lane subtotal must move by exactly the engine's own price for what was added");
  });
});

// ── Rules the shipped set does not contain, authored here on purpose ───────
//
// 🔴 TWO GUARDS SURVIVED THEIR FIRST MUTATION BECAUSE NOTHING IN
// `BUILTIN_RULES` COULD REACH THEM.
//
// The estate ships four promotions: three carry ONE condition, and the only
// two-condition rule carries a code, which a different guard rejects first. So
// "an AND rule two additions away" and "an unlock that needs two units" were
// unreachable states — the code was right, and deleting it changed nothing that
// any test could see.
//
// A merchandiser can author either one tomorrow, in the Promotions Suite,
// without touching this repo. So these push a rule onto the engine's own
// `BUILTIN_RULES` — the same array `SHOP.engineOptions()` hands to
// `computeCartTotals` — inside one boot, which is exactly what authoring one
// looks like from the storefront's side.

/** Author a promotion for the duration of this boot. */
function authorRule(W, rule) {
  W.HWCommerce.BUILTIN_RULES.push(rule);
  assert.ok(W.SHOP.engineOptions().rules.some((r) => r.id === rule.id),
    'the authored rule must reach the same rule set the cart is priced with');
  return rule;
}

test('a promotion that is TWO additions away is not advertised as almost-unlocked', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    const sub = W.SHOP.totals().subtotalCents;
    const cat = W.SHOPDATA.categories().map((c) => c.name || c).find((c) => c && c !== 'All');
    assert.ok(cat, 'the catalogue must have a category to write a condition against');

    // Both conditions unmet: one an ordinary spend gap, one that a single
    // addition cannot close. Closing the spend gap alone earns NOTHING, so
    // "Add $x more" beside this promotion's name would be false.
    const rule = authorRule(W, {
      id: 'test-two-gaps', name: 'Two things away — $10 off', status: 'live', combiner: 'AND',
      conditions: [
        { id: 'cart_subtotal_gte', amountCents: sub + 5000 },
        { id: 'cart_contains', filter: { categories: [cat] }, minQuantity: 99 },
      ],
      reward: { kind: 'dollar_off_cart', amountCents: 1000 }, priority: 1,
    });

    const r = W.HWCommerce.evaluateRule(rule, W.SHOP.context());
    assert.equal(r.satisfied, false);
    assert.equal(r.conditions.filter((c) => !c.satisfied).length, 2,
      'the fixture is only meaningful while BOTH conditions are unmet');
    assert.ok(r.closableGaps.some((g) => g.kind === 'spend'),
      'and only while one of them still reports a perfectly closable spend gap');

    assert.ok(!W.SHOPCART_UI.savings().some((x) => x.rule.id === rule.id),
      'one addition does not unlock this rule, so no threshold may claim it does');
    const host = await open('ShopCartScreen');
    assert.ok(!(host.textContent || '').includes(rule.name),
      'a two-gap promotion must not appear on the savings surface');
    assert.ok(host.querySelector('[data-hw="savings-line"]'),
      'and the surface itself must still be alive, or this passes for the wrong reason');
  });
});

test('an unlock offer that needs TWO units adds two, and speaks the merchandiser’s copy', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    const cat = 'Pre-Rolls';
    const pool = W.SHOPDATA.allProducts().filter((p) => p.cat === cat && p.qty >= 2);
    assert.ok(pool.length, `the catalogue must carry ${cat} for this case`);

    const rule = authorRule(W, {
      id: 'test-two-units', name: 'Buy 2 pre-rolls, save $30', status: 'live', combiner: 'AND',
      conditions: [{ id: 'cart_contains', filter: { categories: [cat] }, minQuantity: 2 }],
      reward: { kind: 'dollar_off_cart', amountCents: 3000 }, priority: 40,
      upsell: { enabled: true, surfaces: ['cart_add_to_order'],
        headline: 'Unlock $30 off', subline: 'Add two pre-rolls to save' },
    });

    const entry = W.SHOPCART_UI.offers('cart_add_to_order')
      .find((e) => e.offer.kind === 'unlock_promotion' && e.offer.unlock.ruleId === rule.id);
    assert.ok(entry, 'the engine must derive an unlock card from the authored promotion');
    const o = entry.offer;
    assert.equal(o.quantity, 2, 'the gap is two units — this case exists to prove the TWO travels');

    const host = await open('ShopCartScreen');
    const text = host.textContent || '';
    assert.ok(text.includes(rule.upsell.headline), 'the authored headline must be printed verbatim');
    assert.ok(text.includes(rule.upsell.subline), 'and the authored subline with it');

    const card = host.querySelector(`[data-hw-offer="${o.id}"]`);
    assert.ok(card, 'the unlock card must be on screen to be taken');
    const laneBefore = laneOf(W, o.lane).subtotalCents;
    assert.ok(app.click((t, el) => t === 'Add' && card.contains(el)), 'the unlock card must Add');
    await app.settle();

    const line = W.SHOP.lines().find((l) => l.sku === o.product.id && l.lane === o.lane);
    assert.ok(line, 'the offered sku must be in the offered lane');
    assert.equal(line.qty, 2, 'adding one of a two-unit unlock unlocks nothing');
    assert.equal(laneOf(W, o.lane).subtotalCents, laneBefore + o.product.price * 2,
      'the lane must move by the engine’s price for BOTH units');
    // And the promotion it promised is now actually earned.
    assert.equal(W.HWCommerce.evaluateRule(rule, W.SHOP.context()).satisfied, true,
      'an unlock card that does not unlock is the worst card on the page');
  });
});

test('a promotion that needs a CODE is not advertised while the cart has no code', async () => {
  await withShop(async (app, W, open) => {
    loadExpressCart(W);
    const E = W.HWCommerce;
    const sub = W.SHOP.totals().subtotalCents;

    /* 🔴 THE ONE STATE THE SHIPPED RULE SET CANNOT REACH.
     *
     * WELCOME20 is coded AND first-order-only, so the customer filter refuses it
     * before the code filter is ever consulted — deleting the code check changed
     * nothing any test could see. This is a coded promotion that passes every
     * OTHER gate: live, on channel, available to this customer, one ordinary
     * spend gap from satisfied. The only thing standing between it and the
     * screen is that nobody has typed SAVE15. */
    const rule = authorRule(W, {
      id: 'test-coded', name: 'SAVE15 — $15 off', status: 'live', code: 'SAVE15', combiner: 'AND',
      conditions: [{ id: 'cart_subtotal_gte', amountCents: sub + 3000 }],
      reward: { kind: 'dollar_off_cart', amountCents: 1500 }, priority: 1,
    });

    const ctx = W.SHOP.context();
    assert.equal(E.isRuleActive(rule, ctx.now), true);
    assert.equal(E.isRuleOnChannel(rule, ctx), true);
    assert.equal(E.isRuleAvailableToCustomer(rule, ctx), true,
      'every gate EXCEPT the code must pass, or this proves nothing about the code gate');
    const r = E.evaluateRule(rule, ctx);
    assert.equal(r.satisfied, false);
    assert.equal(r.blockedByUnreachable, false);
    assert.equal(r.closableGaps.filter((g) => g.kind === 'spend').length, 1,
      'it must be exactly one ordinary spend away — the shape that gets advertised');
    assert.ok(!(ctx.cart.appliedCodes || []).includes(rule.code),
      'and the cart must genuinely not carry the code');

    assert.ok(!W.SHOPCART_UI.savings().some((x) => x.rule.id === rule.id),
      'a code nobody has entered does not price this cart, so nothing may promise it');
    const host = await open('ShopCartScreen');
    assert.ok(!(host.textContent || '').includes(rule.name),
      'the coded promotion must not appear on the savings surface');
    assert.ok(host.querySelector('[data-hw="savings-line"]'),
      'and the surface must still be alive, or this passes for the wrong reason');
  });
});
