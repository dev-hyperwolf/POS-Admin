/* ── THE STOREFRONT MUST NOT PROMISE WHAT THE VAN CANNOT DO ────────────────
 *
 * Four defects, one theme. Express is the driver's KIT — `DDATA.REGION_STOCK`
 * — and a kit has a depth. The storefront is the only system in this estate
 * that can falsify an express promise BEFORE it is made, and it was making the
 * promise unconditionally: any sku, any quantity, any lane move.
 *
 * ⚠️ WHAT THESE TESTS DELIBERATELY DO NOT DO, because it is how the last five
 * attempts went green while broken:
 *
 *  · No fixture that fails to STRADDLE. Every cap here is exercised at the van's
 *    exact depth (must be allowed) AND one unit past it (must not be), on the
 *    SAME sku. A fixture entirely on one side of a threshold proves nothing —
 *    a $20 minimum asserted against a $15 product leaves both cases unmet.
 *  · No `assert.equal(x, null)` standing in for a guard. A redundant guard, or
 *    a guard that refuses everything, satisfies that. The assertions here are
 *    on the CART AFTER the attempt: which lane holds how many units.
 *  · No calling the mutator directly where the bug lives in its CALLER. The
 *    lane control and the stepper are clicked on a rendered `ShopCartScreen`,
 *    and the search is a real Enter key on the real header field, because a
 *    render-time gate and a dead key handler are invisible to a direct call.
 *  · No pinned dollar figures. Every quantity is read off the van at the moment
 *    of the assertion.
 *
 * ⚠️ Values off `app.window` are jsdom-realm — compare primitives only.
 * ⚠️ Screens mount on their OWN host node. `app.mount()` re-roots #root and
 *    throws React into "Should not already be working", which poisons LATER
 *    tests rather than failing the one at fault.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Mount any storefront screen into a fresh host node. */
function mounter(app) {
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
    await app.settle(); await app.settle();
    return host;
  };
  open.close = close;
  return open;
}

function withShop(fn) {
  return withApp('shop', async (app) => {
    const open = mounter(app);
    try { await fn(app, app.window, open); } finally { open.close(); }
  }, { settleMs: 60 });
}

/** The cart, as `sku:lane:qty` strings — a primitive, safe across realms. */
const cartOf = (W) => W.SHOP.lines().map((l) => `${l.sku}:${l.lane}:${l.qty}`).sort().join(',');
const laneQty = (W, sku, lane) => {
  const l = W.SHOP.lines().find((x) => x.sku === sku && x.lane === lane);
  return l ? l.qty : 0;
};

/**
 * A sku the van carries, SHALLOW enough that one more unit than its depth is a
 * quantity a customer could plausibly want. Shallow matters: picking the
 * deepest sku and asking for depth+1 tests the same line of code but makes the
 * fixture read as an absurdity rather than as a real order.
 */
function shallowVanSku(W) {
  const D = W.SHOPDATA;
  const p = D.allProducts()
    .filter((x) => D.expressUnits(x.sku) >= 2)
    .sort((a, b) => D.expressUnits(a.sku) - D.expressUnits(b.sku))[0];
  assert.ok(p, 'no sku on today’s van is two deep — this fixture cannot straddle anything');
  return p;
}

/** A sku today's van is carrying NONE of. The reviewer drove 212FFSAFA. */
function noVanSku(W) {
  const D = W.SHOPDATA;
  const p = D.allProducts().find((x) => D.expressUnits(x.sku) === 0);
  assert.ok(p, 'the whole catalogue is on the van — there is no un-carried sku to test with');
  assert.equal(D.isExpress(p.sku), false, 'and it must read as non-express, or the premise is wrong');
  return p;
}

// ── 1. shopAdd cannot load the express lane past the van's depth ────────────

test('express takes exactly what the van carries, and the surplus arrives tomorrow', async () => {
  await withShop(async (app, W) => {
    const D = W.SHOPDATA;
    const p = shallowVanSku(W);
    const depth = D.expressUnits(p.sku);
    assert.ok(depth >= 2, 'the straddle needs a depth of at least two');

    // ── AT the depth: every unit is express. This half is what stops a guard
    //    that simply refuses everything from passing this test.
    W.SHOP.add(p.sku, depth, 'express');
    assert.equal(cartOf(W), `${p.sku}:express:${depth}`,
      `the van is carrying ${depth} — all ${depth} belong in express`);

    // ── ONE PAST it: the extra unit is not refused and is not lost. It moves to
    //    the lane that can actually carry it.
    W.SHOP.add(p.sku, 1, 'express');
    assert.equal(laneQty(W, p.sku, 'express'), depth,
      `express holds ${laneQty(W, p.sku, 'express')} of a sku the van has ${depth} of`);
    assert.equal(laneQty(W, p.sku, 'scheduled'), 1, 'the surplus unit must land in scheduled, not vanish');

    // ── And the shape the reviewer drove: 99 against a van of five.
    W.SHOP.clear();
    W.SHOP.add(p.sku, 99, 'express');
    assert.equal(laneQty(W, p.sku, 'express'), depth);
    assert.equal(laneQty(W, p.sku, 'scheduled'), 99 - depth);
    assert.equal(W.SHOP.itemCount(), 99, 'nothing the customer asked for may be silently dropped');
  });
});

test('a sku the van is not carrying never reaches express, however it is asked for', async () => {
  await withShop(async (app, W) => {
    const p = noVanSku(W);
    W.SHOP.add(p.sku, 3, 'express');       // asked for express EXPLICITLY
    assert.equal(cartOf(W), `${p.sku}:scheduled:3`,
      'an explicit express add of an un-carried sku must still arrive tomorrow');
    assert.equal(W.SHOPDATA.defaultLaneFor(p.sku), 'scheduled');
  });
});

/**
 * ⚠️ THIS TEST EXISTS BECAUSE A MUTATION SURVIVED WITHOUT IT.
 *
 * Reverting `defaultLaneFor` to its old `isExpress(sku)` form broke NOTHING in
 * the whole 286-test suite, because `shopAdd` recomputes the lane itself through
 * `shopAddPlan` — so the cart stayed right while the sentence shown to the
 * customer went wrong. The grid card reads `defaultLaneFor` at RENDER time and
 * puts the answer in the toast, which is the one place that stale answer is
 * visible: "added · Express" for a unit that went scheduled.
 *
 * It is driven through the real grid button rather than by calling the function,
 * because the toast is composed by the CALLER and a direct call cannot see it.
 */
test('the add toast names the lane the unit actually went to, once the van is full', async () => {
  await withShop(async (app, W, open) => {
    const D = W.SHOPDATA;
    const p = shallowVanSku(W);
    const depth = D.expressUnits(p.sku);

    await open('ShopApp');
    W.SHOP.go('shop');
    W.SHOP.setQuery(p.name);        // narrow the grid to this one card
    await app.settle();
    const adds = [...W.document.querySelectorAll('button')]
      .filter((b) => (b.textContent || '').trim() === 'Add');
    assert.equal(adds.length, 1, `the grid must show exactly one Add for "${p.name}"`);

    // Up to the van's depth, the card is telling the truth and must keep doing so.
    for (let i = 0; i < depth; i++) {
      assert.equal(app.click('Add'), true, 'the grid Add button did nothing');
      await app.settle();
      assert.equal(String(W.SHOP.s.toast).endsWith('· Express'), true,
        `unit ${i + 1} of ${depth} is on the van; the card said "${W.SHOP.s.toast}"`);
    }
    assert.equal(laneQty(W, p.sku, 'express'), depth);

    // One past it. The unit goes scheduled — so the sentence must say scheduled.
    assert.equal(app.click('Add'), true);
    await app.settle();
    assert.equal(laneQty(W, p.sku, 'scheduled'), 1, 'the fixture must actually have overflowed');
    assert.equal(String(W.SHOP.s.toast).endsWith('· Scheduled'), true,
      `the van is out of depth and this unit arrives tomorrow, but the card said "${W.SHOP.s.toast}"`);
  });
});

// ── 2. The control is not offered where the van cannot honour it ────────────

test('"Move to Express" renders on the line the van can serve and NOT on the one it cannot', async () => {
  await withShop(async (app, W, open) => {
    const D = W.SHOPDATA;
    const carried = shallowVanSku(W);
    const absent = noVanSku(W);
    // Both in scheduled, so the ONLY difference between the two lines is the van.
    W.SHOP.add(carried.sku, 1, 'scheduled');
    W.SHOP.add(absent.sku, 1, 'scheduled');
    const host = await open('ShopCartScreen');

    const lines = [...host.querySelectorAll('[data-hw="cart-line"]')];
    assert.equal(lines.length, 2, 'both lines must render, or this compares nothing');
    const state = (product) => {
      const el = lines.find((n) => (n.textContent || '').includes(product.name));
      assert.ok(el, `the cart never rendered a line for ${product.name}`);
      const btn = [...el.querySelectorAll('button')]
        .find((b) => (b.textContent || '').trim() === 'Move to Express');
      return { btn, note: el.querySelector('[data-hw="lane-note"]') };
    };

    // POSITIVE CONTROL. Without this, "no button" passes for a screen that
    // stopped rendering the control at all — which is a different bug.
    //
    // ⚠️ COMPARED AS BOOLEANS, DELIBERATELY. `assert.equal(el, undefined)` on a
    // jsdom Element makes assert build a diff by deep-inspecting the node, and a
    // rendered React tree takes ~56s of that before it reports — long enough to
    // read as a hung suite rather than as a failure. Found by running the
    // mutation for this very test.
    const ok = state(carried);
    assert.equal(!!ok.btn, true, `the van carries ${D.expressUnits(carried.sku)} of ${carried.name} — the move must be on offer`);
    assert.equal(!!ok.note, false, 'and a line that CAN move must not also be excused');

    const no = state(absent);
    assert.equal(!!no.btn, false,
      `${absent.name} is not on today’s van — offering the move promises ~90 minutes nobody can keep`);
    assert.equal(!!no.note, true, 'and the line must say what does happen instead of going silent');

    // 🔴 THE FRAMING IS PART OF THE FIX. The lane minimum beside this is drawn
    // as progress and never as a refusal; this has to read the same way.
    const said = no.note.textContent || '';
    assert.ok(/arrives tomorrow/i.test(said), `the copy must offer tomorrow; it said "${said}"`);
    for (const wrong of ['unavailable', 'out of stock', 'sold out', 'cannot', "can't", 'error']) {
      assert.equal(said.toLowerCase().includes(wrong), false,
        `"${wrong}" turns a lane change into a refusal; the copy said "${said}"`);
    }

    // And the control that IS offered actually works — a gate that disables the
    // whole feature would otherwise satisfy every assertion above.
    assert.equal(app.click('Move to Express'), true);
    await app.settle();
    assert.equal(laneQty(W, carried.sku, 'express'), 1, 'the offered move did nothing');
    assert.equal(laneQty(W, absent.sku, 'scheduled'), 1, 'and it took the wrong line with it');
  });
});

// ── 3. The store itself refuses the move, not only the view ─────────────────

test('a lane move into express is refused exactly when the van is out of depth', async () => {
  await withShop(async (app, W) => {
    const D = W.SHOPDATA;
    const p = shallowVanSku(W);
    const depth = D.expressUnits(p.sku);

    // Express already holds all but one of the van's depth: headroom is 1.
    W.SHOP.add(p.sku, depth - 1, 'express');
    W.SHOP.add(p.sku, 2, 'scheduled');
    assert.equal(D.expressHeadroom(p.sku), 1, 'the fixture must leave room for exactly one');
    const sched = W.SHOP.lines().find((l) => l.sku === p.sku && l.lane === 'scheduled');

    // ── OVER the headroom by one. Asserted on the CART, not on a return value:
    //    "returns false" is satisfied by a guard that refuses everything.
    const before = cartOf(W);
    W.SHOP.setLane(sched.id, 'express');
    assert.equal(cartOf(W), before,
      `two units moved into express with room for one — express would hold ${laneQty(W, p.sku, 'express')} of ${depth}`);

    // ── AT the headroom. Same sku, same lane, one unit fewer: it must go.
    W.SHOP.setQty(sched.id, 1);
    assert.equal(laneQty(W, p.sku, 'scheduled'), 1);
    assert.equal(W.SHOP.setLane(sched.id, 'express'), true);
    assert.equal(cartOf(W), `${p.sku}:express:${depth}`,
      'a move the van CAN carry must be honoured, and must merge into the one express line');
    assert.equal(laneQty(W, p.sku, 'scheduled'), 0);
  });
});

// ── 4. The stepper is another way to ask, and the van answers it too ────────

test('the cart stepper cannot step an express line past the van, and says where the unit went', async () => {
  await withShop(async (app, W, open) => {
    const D = W.SHOPDATA;
    const p = shallowVanSku(W);
    const depth = D.expressUnits(p.sku);
    W.SHOP.add(p.sku, depth - 1, 'express');
    await open('ShopCartScreen');

    const plus = (t, el) => el.getAttribute && el.getAttribute('aria-label') === 'Increase';

    // ── UNDER the depth: the stepper does what a stepper does.
    assert.equal(app.click(plus), true, 'the express line must carry a working stepper');
    await app.settle();
    assert.equal(laneQty(W, p.sku, 'express'), depth, 'a step within the van must land in express');

    // ── AT the depth: the next step cannot go express. It is not swallowed and
    //    it is not refused — it arrives tomorrow, same as an over-cap add.
    assert.equal(app.click(plus), true);
    await app.settle();
    assert.equal(laneQty(W, p.sku, 'express'), depth,
      `the stepper pushed express to ${laneQty(W, p.sku, 'express')} against a van of ${depth}`);
    assert.equal(laneQty(W, p.sku, 'scheduled'), 1, 'the stepped unit must show up in scheduled');
    assert.equal(W.SHOP.itemCount(), depth + 1, 'and the customer must still have what they asked for');
  });
});

// ── 5. The header search is not a dead end on the home tab ──────────────────

test('typing in the header search and pressing enter takes you to the results', async () => {
  await withShop(async (app, W, open) => {
    await open('ShopApp');
    assert.equal(W.SHOP.s.tab, 'home', 'the shell must start on home for this to be the reported bug');
    assert.ok(app.text().includes(W.SHOPDATA.CUSTOMER.first), 'and home must actually be on screen');

    const D = W.SHOPDATA;
    const target = D.allProducts()[0];
    const q = target.name;
    const searchable = (p) => (p.name + ' ' + p.brand + ' ' + (p.strain || '') + ' ' + p.cat).toLowerCase();
    const missing = D.allProducts().find((p) => !searchable(p).includes(q.toLowerCase()));
    assert.ok(missing, 'the query must exclude something, or "it filtered" is unfalsifiable');

    assert.equal(app.type('Search strains', q), true, 'the header search field was not found');
    await app.settle();
    assert.equal(W.SHOP.s.tab, 'home', 'typing alone must not navigate — only enter does');

    const field = [...W.document.querySelectorAll('input')]
      .find((i) => (i.getAttribute('placeholder') || '').includes('Search strains'));
    field.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await app.settle();

    assert.equal(W.SHOP.s.tab, 'shop',
      'enter in the global search did nothing — the field is a dead end on this tab');
    const text = app.text();
    assert.ok(text.includes(q), `the results must contain what was searched for; got ${text.slice(0, 200)}`);
    assert.equal(text.includes(missing.name), false,
      `"${missing.name}" does not match "${q}" — the grid did not actually filter`);
  });
});

test('enter on an empty search box leaves you where you are', async () => {
  await withShop(async (app, W, open) => {
    await open('ShopApp');
    W.SHOP.setQuery('   ');
    await app.settle();
    const field = [...W.document.querySelectorAll('input')]
      .find((i) => (i.getAttribute('placeholder') || '').includes('Search strains'));
    field.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await app.settle();
    assert.equal(W.SHOP.s.tab, 'home', 'a blank search must not yank the customer off the page');
  });
});

test('a global search is global — it clears the filters that would hide its own results', async () => {
  await withShop(async (app, W, open) => {
    const D = W.SHOPDATA;
    await open('ShopApp');
    // A category the target product is NOT in, plus a rail it is not on: the
    // state in which a routed search lands on "Nothing here yet" and reads to
    // the customer as "we do not sell it".
    const target = D.allProducts()[0];
    const otherCat = D.categories().map((c) => c.id).find((c) => c !== 'All' && c !== target.cat);
    assert.ok(otherCat, 'the catalogue must offer a category the target is not in');
    W.SHOP.setCategory(otherCat);
    W.SHOP.setRail(D.RAILS[0].id);
    W.SHOP.setQuery(target.name);
    await app.settle();

    const field = [...W.document.querySelectorAll('input')]
      .find((i) => (i.getAttribute('placeholder') || '').includes('Search strains'));
    field.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await app.settle();

    assert.equal(W.SHOP.s.category, 'All', 'a whole-catalogue search must not stay narrowed to one category');
    assert.equal(W.SHOP.s.rail, null, 'nor to one merchandising rail');
    assert.ok(app.text().includes(target.name),
      'the search routed to a grid that could not contain its own result');
  });
});

// ── 6. The loyalty tier is one the estate actually recognises ───────────────

/** Every tier string any live rule in the engine will match. */
function ruleTiers(W) {
  const out = new Set();
  for (const r of W.HWCommerce.BUILTIN_RULES || []) {
    for (const c of r.conditions || []) {
      if (c.id === 'user_loyalty_tier') for (const t of c.tiers || []) out.add(t);
    }
  }
  return out;
}

test('the customer’s loyalty tier is a tier the engine’s own rules match', async () => {
  await withShop(async (app, W) => {
    const tiers = ruleTiers(W);
    assert.ok(tiers.size > 0, 'the engine must carry at least one tier gate or this proves nothing');
    const tier = W.SHOPDATA.CUSTOMER.engine.loyaltyTier;
    assert.equal(tiers.has(tier), true,
      `the storefront tells the engine "${tier}", which matches none of [${[...tiers].join(', ')}] — `
      + 'a tier is matched by exact string equality, so a near miss qualifies the customer for '
      + 'nothing and reports nothing');
  });
});

test('that tier actually earns its rule — and a near-miss string earns nothing', async () => {
  await withShop(async (app, W) => {
    const D = W.SHOPDATA;
    const p = D.allProducts().filter((x) => x.price >= 20)[0];
    W.SHOP.add(p.sku, 2);

    const earned = W.SHOP.totals();
    const tierRule = (W.HWCommerce.BUILTIN_RULES || []).find((r) =>
      (r.conditions || []).some((c) => c.id === 'user_loyalty_tier'));
    assert.ok(tierRule, 'the engine must carry a tier rule for this to mean anything');
    assert.ok(earned.discounts.some((d) => d.name === tierRule.name),
      `the tier rule "${tierRule.name}" never fired for a customer who is in its tier; `
      + `discounts were [${earned.discounts.map((d) => d.name).join(', ')}]`);
    assert.ok(earned.discountCents > 0, 'and it must be worth something');

    // 🔴 THE MUTATION THE BUG WAS: one word short of the real tier.
    D.CUSTOMER.engine.loyaltyTier = 'Wolfpack';
    const nearMiss = W.SHOP.totals();
    assert.equal(nearMiss.discounts.some((d) => d.name === tierRule.name), false,
      '"Wolfpack" must NOT match "Wolfpack Leader" — if it did, this whole test is vacuous');
    assert.equal(nearMiss.discountCents, 0);
    assert.ok(nearMiss.totalCents > earned.totalCents,
      'the near-miss tier must cost the customer real money, which is why it cannot be shipped');
  });
});

/* ── The gaps a refuter found by mutating this very file ─────────────────────
 *
 * Three mutations survived the first eleven tests:
 *   · `scartExpressNote(p.sku, l.qty)` -> `scartExpressNote(p.sku, 1)`
 *     — the QUANTITY dimension was unconstrained. A line of 5 against a van of
 *       2 would still be offered the move, because every test happened to use a
 *       quantity of 1.
 *   · `van is carrying ${units}` -> `${units + 7}` — the number in the sentence
 *     was asserted by nothing, so the storefront could tell the customer the
 *     van holds seven more than it does.
 *   · the `units > 0` branch could be deleted entirely.
 */
import { test as vtest } from 'node:test';

vtest('the note is about THIS LINE, not just this product', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA;
    const note = W.SHOPCART_UI.expressNote;

    // A sku the van IS carrying, some depth n. One unit is fine; n+1 is not.
    const carried = D.allProducts().find((p) => D.expressUnits(p.sku) >= 2);
    assert.ok(carried, 'the fixture needs a sku the van carries at least two of');
    const n = D.expressUnits(carried.sku);

    assert.equal(note(carried.sku, n), null,
      `a line of ${n} against a van of ${n} must be offerable`);
    assert.ok(note(carried.sku, n + 1),
      `a line of ${n + 1} against a van of ${n} must NOT be offerable — ` +
      'the gate is reading the product and ignoring the quantity');
  });
});

vtest('the sentence names the van’s REAL depth', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA;
    const note = W.SHOPCART_UI.expressNote;
    const carried = D.allProducts().find((p) => D.expressUnits(p.sku) >= 2);
    const n = D.expressUnits(carried.sku);

    const said = note(carried.sku, n + 1);
    // Read the number back out of the copy rather than matching the whole
    // string, so this still bites if the wording is rewritten.
    const m = /carrying (\d+)/.exec(said);
    assert.ok(m, `the sentence must state the depth; got: ${said}`);
    assert.equal(+m[1], n,
      `the storefront told the customer the van holds ${m[1]} when it holds ${n}`);
  });
});

vtest('a sku the van has none of gets the other sentence, not a number', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA;
    const note = W.SHOPCART_UI.expressNote;
    const absent = D.allProducts().find((p) => D.expressUnits(p.sku) === 0);
    assert.ok(absent, 'the fixture needs a sku the van is not carrying');

    const said = note(absent.sku, 1);
    assert.ok(said, 'an un-carried sku must never be offerable');
    assert.doesNotMatch(said, /carrying 0/,
      '"carrying 0" reads as a stock error; the copy must say it is not on today’s van');
    // And still in the progress tone, never a refusal.
    for (const bad of ['unavailable', 'out of stock', 'sold out', 'cannot', "can't"]) {
      assert.ok(!said.toLowerCase().includes(bad), `the note must not say "${bad}": ${said}`);
    }
  });
});
