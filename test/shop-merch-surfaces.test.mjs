/* ═══ THE STOREFRONT READS WHAT MARKETING PICKED ═══════════════════════════
 *
 * The incident these guard: the shop advertised "Connected — Up to 97% off" to
 * customers. The arithmetic was right. The problem was that NO HUMAN DECIDED IT
 * — `brandSpotlight()` scanned the catalogue for the deepest markdown and
 * printed it. A screen that composes its own claims will eventually compose one
 * nobody would have signed.
 *
 * So every assertion here is about AUTHORSHIP as much as correctness:
 *   · a live pick renders, and it is the pick, not a derivation;
 *   · no live pick renders the HOUSE CARD — never the derivation, because a
 *     silent fall-back reinstates the incident the first time a slot is
 *     forgotten;
 *   · a claim past the ceiling is REFUSED and recorded, never clamped;
 *   · carousel and weighted are different mechanisms and stay different;
 *   · the reorder row's neverFirst/mustLabel come from the SURFACE DATA, so
 *     flipping them in the data changes what a shopper sees.
 *
 * ⚠️ NOTHING HERE PINS A FIGURE THE AUTHOR COMPUTED. The share-split test counts
 * winners across rolls 0–99 and compares them to the shares that were STORED;
 * the catalogue-shaped assertions read the catalogue.
 *
 * ⚠️ CROSS-REALM. Everything off `app.window` is jsdom's realm — compare
 * primitives, never deepEqual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** The brand the catalogue really carries, so an eligibility check has
 *  something true to pass on. */
const carriedBrand = (D) => {
  const p = D.allProducts().find((x) => x.brand);
  assert.ok(p, 'the catalogue must carry a branded product for any of this to mean anything');
  return p.brand;
};

const spotlight = (D, brand, patch) => ({
  id: 'sp1', kind: 'brand', brand, label: brand,
  headline: brand, offer: 'Up to 15% off', kicker: 'Picked this week', ...patch,
});

test('with nothing picked the spotlight is the HOUSE CARD, not the deepest markdown', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    const sp = D.brandSpotlight();
    assert.equal(sp.source, 'house', 'an unscheduled slot must fall back to the house card');
    assert.equal(sp.cards.length, 1);
    assert.equal(sp.cards[0].title, D.houseCard().headline);
    assert.ok(app.text().includes(D.houseCard().headline), 'the house card never reached the screen');

    // 🔴 THE INCIDENT ITSELF. The derivation still exists as an operator audit;
    // if its sentence is on a customer-facing screen, 97% is back.
    const audit = D.markdownAudit();
    assert.notEqual(audit, null, 'the catalogue must carry a markdown or this proves nothing');
    assert.equal(app.text().includes(audit.offer), false,
      `the shop rendered the DERIVED claim "${audit.offer}" — this is the 97% incident`);
  });
});

test('a live pick is what renders, and it is the marketer’s words', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    const brand = carriedBrand(D);
    const stored = M.set('shop_spotlight', D.region(),
      { items: [spotlight(D, brand)], state: 'live' }, 'M. Saini');
    assert.notEqual(stored, null, 'the store refused a valid set — read the refusal, do not work around it');
    await app.settle();

    const sp = D.brandSpotlight();
    assert.equal(sp.source, 'merch');
    assert.equal(sp.cards[0].offer, 'Up to 15% off');
    assert.equal(sp.by.who, 'M. Saini', 'who picked it must survive to the storefront');
    assert.ok(app.text().includes('Up to 15% off'), 'the marketer’s offer never reached the screen');
    assert.equal(app.text().includes(D.houseCard().headline), false,
      'the house card is a FALLBACK — it must not sit under a live pick');
  });
});

test('a draft and a review never reach a shopper — the house card does', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    const brand = carriedBrand(D);
    for (const state of ['draft', 'review']) {
      M.set('shop_spotlight', D.region(), { items: [spotlight(D, brand)], state }, 'M. Saini');
      await app.settle();
      assert.equal(D.brandSpotlight().source, 'house', `a ${state} set rendered to a shopper`);
      assert.equal(app.text().includes('Up to 15% off'), false, `a ${state} offer was on screen`);
    }
    M.set('shop_spotlight', D.region(), { state: 'live' }, 'M. Saini');
    await app.settle();
    assert.equal(D.brandSpotlight().source, 'merch', 'publishing changed nothing');
  });
});

test('the region comes from the delivery zone, and an unset region inherits "all"', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    const brand = carriedBrand(D);

    // The zone is already known — "Long Beach" — and this must be ITS region,
    // never `zone.regionId`, which is the VAN (LA-01, a Pomona van).
    const city = String(W.SHOPDATA.CUSTOMER.zone.city).trim().toLowerCase().replace(/\s+/g, '-');
    assert.equal(D.region(), city, 'the storefront resolved a region the delivery zone does not name');
    assert.ok(M.REGIONS.indexOf(D.region()) >= 0, 'the resolved region is not one HWMerch knows');

    M.set('shop_spotlight', 'all', { items: [spotlight(D, brand, { offer: 'Up to 5% off' })], state: 'live' }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().cards[0].offer, 'Up to 5% off',
      'one number until it isn’t — an unset region must inherit the "all" default');

    M.set('shop_spotlight', D.region(), { items: [spotlight(D, brand, { offer: 'Up to 25% off' })], state: 'live' }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().cards[0].offer, 'Up to 25% off', 'the regional override did not win');
  });
});

test('a claim past the ceiling is REFUSED and recorded — never clamped, never shown', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    const brand = carriedBrand(D);
    const over = D.claimCeilingPct() + 37;
    M.set('shop_spotlight', D.region(),
      { items: [spotlight(D, brand, { offer: `Up to ${over}% off` })], state: 'live' }, 'M. Saini');
    await app.settle();

    assert.equal(D.brandSpotlight().source, 'house', 'an over-ceiling card took the slot anyway');
    assert.equal(app.text().includes(`${over}%`), false, 'the over-ceiling claim reached a customer');
    // 🔴 REFUSE, NEVER CLAMP. Rewriting it as "Up to <ceiling>% off" would be a
    // second fabricated claim replacing the first.
    assert.equal(app.text().includes(`Up to ${D.claimCeilingPct()}% off`), false,
      'the claim was CLAMPED — a discount nobody chose is now on screen');
    // ⚠️ And it is not swallowed: a silently-dropped card looks identical to an
    // empty schedule, and a marketer would spend a week wondering why.
    const refusal = D.merchRefusals().find((r) => r.surface === 'shop_spotlight');
    assert.ok(refusal, 'the refusal was swallowed — nothing records why the slot is empty');
    assert.equal(refusal.why, 'claim-over-ceiling');
  });
});

test('the ceiling follows the POS setting when one exists, and the constant when it does not', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    const dflt = D.claimCeilingPct();
    assert.equal(dflt, W.SHOP.SPOTLIGHT_MAX_PCT, 'with no setting it must be the shipped constant');

    const brand = carriedBrand(D);
    const claim = dflt + 20;
    M.set('shop_spotlight', D.region(),
      { items: [spotlight(D, brand, { offer: `Up to ${claim}% off` })], state: 'live' }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().source, 'house', 'the constant ceiling did not hold');

    // The setting is being added in pos/data.jsx by another agent; this stands in
    // for it so the read path is proven now rather than on the day it lands.
    const orig = W.HW.laneSettings;
    W.HW.laneSettings = () => ({ ...orig(), claimCeilingPct: claim + 1 });
    try {
      assert.equal(D.claimCeilingPct(), claim + 1, 'the operator setting was ignored');
      assert.equal(D.brandSpotlight().source, 'merch',
        'raising the operator ceiling did not let the claim through');
    } finally { W.HW.laneSettings = orig; }
    assert.equal(D.brandSpotlight().source, 'house', 'restoring the ceiling did not put the claim back');
  });
});

test('carousel shows ALL of them, weighted shows exactly ONE', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    const brand = carriedBrand(D);
    const two = [
      { id: 'a', kind: 'brand', brand, label: 'A', headline: 'Card A', share: 60 },
      { id: 'b', kind: 'brand', brand, label: 'B', headline: 'Card B', share: 40 },
    ];
    const sponsored = () => D.reorderRow().filter((e) => e.kind === 'sponsored');

    assert.notEqual(M.set('home_reorder', D.region(), { mode: 'carousel', items: two, state: 'live' }, 'me'), null);
    await app.settle();
    assert.equal(sponsored().length, two.length,
      'carousel means everyone sees all of them, in order');

    assert.notEqual(M.set('home_reorder', D.region(), { mode: 'weighted', items: two, state: 'live' }, 'me'), null);
    await app.settle();
    assert.equal(sponsored().length, 1,
      'weighted means each visitor sees ONE — rendering all of them gives every item 100% of the slot');
  });
});

test('share of voice is exactly what was stored — the draw does not round anyone off', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA;
    await app.mount('ShopApp');
    const items = [{ id: 'a', share: 70 }, { id: 'b', share: 25 }, { id: 'c', share: 5 }];
    const won = { a: 0, b: 0, c: 0 };
    for (let roll = 0; roll < 100; roll++) {
      const w = D.merchDrawAt(items, roll);
      assert.ok(w, `roll ${roll} drew nobody — a share of the slot went nowhere`);
      won[w.id]++;
    }
    // Compared against the STORED shares, not against numbers typed here.
    for (const it of items) {
      assert.equal(won[it.id], it.share, `${it.id} got ${won[it.id]} of 100, but was sold ${it.share}`);
    }
  });
});

test('the draw is stable for a visitor — the card does not flip between renders', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    const brand = carriedBrand(D);
    M.set('home_reorder', D.region(), { mode: 'weighted', state: 'live', items: [
      { id: 'a', kind: 'brand', brand, headline: 'Card A', share: 50 },
      { id: 'b', kind: 'brand', brand, headline: 'Card B', share: 50 },
    ] }, 'me');
    await app.settle();
    const drawn = () => (D.reorderRow().find((e) => e.kind === 'sponsored') || {}).key;
    const first = drawn();
    assert.ok(first, 'nothing was drawn at all');
    for (let i = 0; i < 5; i++) {
      assert.equal(drawn(), first, 'the weighted draw moved between renders — no visitor has a stable exposure');
    }
  });
});

test('an ineligible winner forfeits its own share — it is NOT handed to the others', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    const brand = carriedBrand(D);
    // 'a' names a brand nobody carries, so it can never be shown. 'b' is real.
    const items = [
      { id: 'a', kind: 'brand', brand: 'A Brand Nobody Carries', headline: 'Ghost', share: 60 },
      { id: 'b', kind: 'brand', brand, headline: 'Real Card', share: 40 },
    ];
    M.set('home_reorder', D.region(), { mode: 'weighted', items, state: 'live' }, 'me');
    await app.settle();

    // The roll is a property of the visitor, so move the visitor to reach both
    // bands. Both branches must be exercised or this proves only one of them.
    const sponsored = () => D.reorderRow().filter((e) => e.kind === 'sponsored');
    const origId = W.SHOPDATA.CUSTOMER.id;
    const bands = { ghost: 0, real: 0 };
    try {
      for (let i = 0; i < 60 && !(bands.ghost && bands.real); i++) {
        W.SHOPDATA.CUSTOMER.id = 'c-probe-' + i;
        const roll = D.merchRoll('home_reorder', D.region());
        const row = sponsored();
        if (roll < 60) {
          bands.ghost++;
          assert.equal(row.length, 0,
            `roll ${roll} landed on the ineligible item, and a sponsored card rendered anyway — `
            + 'somebody else was handed a share nobody bought');
        } else {
          bands.real++;
          assert.equal(row.length, 1, `roll ${roll} landed on the eligible item and nothing rendered`);
          assert.equal(row[0].item.id, 'b');
        }
      }
    } finally { W.SHOPDATA.CUSTOMER.id = origId; }
    assert.ok(bands.ghost > 0, 'no probe ever landed in the ineligible band — the guard is untested');
    assert.ok(bands.real > 0, 'no probe ever landed in the eligible band — the guard is untested');
  });
});

test('the reorder row honours neverFirst and mustLabel FROM THE SURFACE DATA', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    const brand = carriedBrand(D);
    const surface = M.surfaceById('home_reorder');
    assert.equal(surface.neverFirst, true);
    assert.equal(surface.mustLabel, true);

    // `slot: 0` is a marketer asking for the front of the row. The surface says no.
    M.set('home_reorder', D.region(), { mode: 'carousel', state: 'live',
      items: [{ id: 'a', kind: 'brand', brand, headline: 'Partner Card', slot: 0 }] }, 'me');
    await app.settle();

    const row = D.reorderRow();
    assert.equal(row[0].kind, 'order',
      'a sponsored card took index 0 — the slot that wears "Your usual" and carries the row’s credibility');
    const sp = row.find((e) => e.kind === 'sponsored');
    assert.ok(sp, 'the sponsored card never appeared at all');
    assert.ok(sp.sponsorLabel, 'mustLabel is set and the entry carries no disclosure');
    assert.ok(app.text().includes(sp.sponsorLabel), 'the disclosure never rendered to the shopper');

    // 🔴 THE RULES MUST COME FROM THE DATA. Flip them on the surface and the
    // behaviour must follow — a screen that hard-codes "index 1, always
    // labelled" passes every test above and silently stops tracking the owner's
    // decision the moment it changes.
    const orig = M.surfaceById;
    M.surfaceById = (id) => (id === 'home_reorder'
      ? { ...orig.call(M, id), neverFirst: false, mustLabel: false }
      : orig.call(M, id));
    try {
      const loose = D.reorderRow();
      assert.equal(loose[0].kind, 'sponsored',
        'neverFirst:false was ignored — the index rule is hard-coded in the screen, not read from the surface');
      assert.equal(loose[0].sponsorLabel, null,
        'mustLabel:false was ignored — the label is hard-coded, not read from the surface');
    } finally { M.surfaceById = orig; }
  });
});

test('a rail renders the merchandiser’s pick when there is one, and says so', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');

    /* ⚠️ `shop_rail_*` IS NOT IN HWMerch.SURFACES YET, and `set()` correctly
     * refuses an unknown surface — shared/merch-store.js belongs to another
     * agent. So the seam is driven with a stub at exactly the boundary the
     * screen reads through. This proves the read path today; the day the five
     * ids are registered, nothing here changes. */
    assert.equal(M.surfaceById('shop_rail_best'), null,
      'shop_rail_best is registered now — delete this stub and use the real store');

    const picked = D.allProducts().slice(0, 2).map((p) => p.sku);
    assert.equal(picked.length, 2, 'the catalogue must carry two products for this to mean anything');
    const orig = M.live;
    M.live = (surface, region) => (surface === 'shop_rail_best'
      ? { surface, region: region || 'all', mode: 'carousel', state: 'live',
          items: [{ id: 'r1', kind: 'sku', skus: picked }], by: { who: 'M. Saini', at: 'now' } }
      : orig.call(M, surface, region));
    try {
      assert.equal(D.railProducts('best').map((p) => p.sku).join(','), picked.join(','),
        'the rail ignored the merchandiser and used its editorial list');
      const basis = D.railBasis('best');
      assert.equal(basis.source, 'merch');
      assert.equal(basis.by.who, 'M. Saini');
    } finally { M.live = orig; }

    // With the stub gone it is the editorial list again — the fallback the
    // owner asked for, not an empty rail.
    assert.equal(D.railBasis('best').source, 'editorial');
    assert.ok(D.railProducts('best').length > 0, 'the rail fell back to nothing');
  });
});

test('a rail whose NAME claims data we do not have says what it is actually showing', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    // Best Sellers claims a sales ranking; New Arrivals claims stocking dates.
    // The catalogue carries neither field, so an auto rail would have to invent
    // a ranking — the same failure as the 97% card in different clothes.
    for (const railId of ['best', 'new', 'fresh']) {
      const b = D.railBasis(railId);
      assert.equal(b.autoAvailable, false, `${railId}: an auto rail was offered with no data behind it`);
      assert.ok(b.needs, `${railId}: "disabled" without saying what it needs is just broken`);
      assert.equal(D.allProducts().some((p) => p[b.needs] != null), false,
        `${railId}: the catalogue DOES carry ${b.needs} — this rail could be real, so make it real`);

      const label = D.RAILS.find((r) => r.id === railId).label;
      assert.equal(app.click(label), true, `the ${label} chip was not clickable`);
      await app.settle();
      assert.ok(app.text().includes(b.note),
        `${label}: the screen let the label imply a ranking without saying what the list is`);
      app.click(label);          // toggle back off
      await app.settle();
    }
  });
});

test('the On Sale rail is still the real markdown set when nobody has picked one', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA;
    W.HWMerch.reset();
    await app.mount('ShopApp');
    const basis = D.railBasis('sale');
    assert.equal(basis.source, 'markdown', 'a real derivation was thrown away with the fake ones');
    assert.equal(basis.needs, null, 'On Sale needs nothing — it is derivable today');
    const onSale = D.railProducts('sale').map((p) => p.sku).sort().join(',');
    const marked = D.allProducts().filter((p) => p.was != null).map((p) => p.sku).sort().join(',');
    assert.equal(onSale, marked);
    assert.ok(marked.length > 0, 'nothing is marked down — this proves nothing');
  });
});

test('the storefront says out loud that its merchandising is demo storage', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA;
    W.HWMerch.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();
    // Per-browser, no sync: two marketers have two realities. A surface that
    // implied a shared source of truth would be lying about where it got its
    // content, and the seam exists precisely so this stays visible.
    assert.equal(D.merchIsDemo(), true);
    assert.ok(/demo/i.test(app.text()), 'nothing on screen admits this is demo storage');
  });
});

test('a merchandising change repaints the storefront instead of going stale', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();
    assert.ok(app.text().includes(D.houseCard().headline));

    M.set('shop_spotlight', D.region(),
      { items: [spotlight(D, carriedBrand(D), { offer: 'Up to 12% off' })], state: 'live' }, 'me');
    await app.settle();
    // A storefront rendering stale merchandising looks exactly like a storefront
    // with nothing scheduled, which is the failure that has no symptom.
    assert.ok(app.text().includes('Up to 12% off'),
      'publishing a set did not repaint the shop — the screen is not subscribed to the seam');
  });
});

test('the storefront reaches the merch store ONLY through HWMerch', async () => {
  // The owner chose "browser storage for now" AND "decide later — build behind
  // one seam". A screen that touches localStorage directly ends the second half
  // of that: the backing store stops being a decision and becomes a fact.
  const { readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url).pathname;
  for (const f of ['shop/data.jsx', 'shop/screen-shop.jsx', 'shop/screen-home.jsx']) {
    const src = readFileSync(root + f, 'utf8');
    assert.equal(/localStorage\s*\.\s*(get|set|remove)Item\s*\(\s*['"`]hw-merch/.test(src), false,
      `${f} reaches around HWMerch into its storage key`);
    assert.equal(src.includes("'hw-merch-v1'") || src.includes('"hw-merch-v1"'), false,
      `${f} knows the store's storage key, which is the seam's business alone`);
  }
});

test('a card naming a sku the catalogue does not carry is refused, and says which', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    const dead = 'NO-SUCH-SKU-EVER';
    assert.equal(D.productBySku(dead), null, 'the fixture sku must genuinely be absent');
    M.set('shop_spotlight', D.region(), { state: 'live',
      items: [{ id: 'ghost', kind: 'sku', sku: dead, headline: 'Ghost Card' }] }, 'me');
    await app.settle();

    assert.equal(app.text().includes('Ghost Card'), false,
      'the shop advertised a product it does not carry');
    assert.equal(D.brandSpotlight().source, 'house');
    const why = (D.merchRefusals().find((r) => r.surface === 'shop_spotlight') || {}).why;
    assert.equal(why, 'sku-not-in-catalogue',
      'the slot is empty and nothing says why — which looks identical to nothing being scheduled');
  });
});

test('an express-only card is refused when the van serving this zone is not carrying it', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    // ⚠️ EXPRESS IS A PROMISE ABOUT ONE VAN. A card promising express on a sku
    // the van has none of is the shop lying about stock, and the cart would then
    // refuse the lane the card just advertised.
    const off = D.allProducts().find((p) => !D.isExpress(p.sku));
    const on = D.allProducts().find((p) => D.isExpress(p.sku));
    assert.ok(off && on, 'the van kit must carry some skus and not others for this to mean anything');

    M.set('shop_spotlight', D.region(), { state: 'live',
      items: [{ id: 'x', kind: 'sku', sku: off.sku, expressOnly: true, headline: 'Express Promise' }] }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().source, 'house', 'an unkeepable express promise reached a shopper');
    assert.equal((D.merchRefusals().find((r) => r.surface === 'shop_spotlight') || {}).why,
      'not-express-for-this-van');

    M.set('shop_spotlight', D.region(), { state: 'live',
      items: [{ id: 'y', kind: 'sku', sku: on.sku, expressOnly: true, headline: 'Express Promise' }] }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().source, 'merch',
      'a promise the van CAN keep was refused too — the check is not about express at all');
  });
});

test('an express-only BRAND card is refused when the van carries none of that brand', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');

    // A brand the van is carrying nothing from. `isExpress` is per-PRODUCT, so a
    // brand card has to ask the question of the whole brand — checking one sku
    // and calling it a brand promise is how "⚡ Express" ends up over a shelf the
    // driver has none of.
    const brands = [...new Set(D.allProducts().map((p) => p.brand).filter(Boolean))];
    const cold = brands.find((b) => !D.allProducts().some((p) => p.brand === b && D.isExpress(p.sku)));
    const warm = brands.find((b) => D.allProducts().some((p) => p.brand === b && D.isExpress(p.sku)));
    assert.ok(cold, 'every brand is express in this van kit — this guard cannot be exercised');
    assert.ok(warm, 'no brand is express in this van kit — this guard cannot be exercised');

    M.set('shop_spotlight', D.region(), { state: 'live',
      items: [{ id: 'c', kind: 'brand', brand: cold, expressOnly: true, headline: 'Cold Brand' }] }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().source, 'house', 'an unkeepable brand-wide express promise was shown');
    assert.equal((D.merchRefusals().find((r) => r.surface === 'shop_spotlight') || {}).why,
      'not-express-for-this-van');

    M.set('shop_spotlight', D.region(), { state: 'live',
      items: [{ id: 'w', kind: 'brand', brand: warm, expressOnly: true, headline: 'Warm Brand' }] }, 'me');
    await app.settle();
    assert.equal(D.brandSpotlight().source, 'merch',
      'a brand the van IS carrying was refused too — the check is not about express at all');
  });
});

test('the HOUSE CARD is held to the claim ceiling too — a person can type 97% as easily', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, D = W.SHOPDATA, M = W.HWMerch;
    M.reset();
    await app.mount('ShopApp');
    W.SHOP.go('shop');
    await app.settle();

    const over = D.claimCeilingPct() + 37;
    const saved = M.setHouseCard({ headline: 'Hyperwolf', sub: `Up to ${over}% off everything` }, 'M. Saini');
    assert.notEqual(saved, null, 'the store refused a valid house-card edit');
    await app.settle();

    // The card is the FALLBACK, so it is the one thing that renders when nothing
    // is scheduled — which makes it the single most-shown claim on the shop.
    assert.equal(D.houseCard().sub, '', 'the over-ceiling line survived into the card');
    assert.equal(app.text().includes(`${over}%`), false, 'the house card advertised it to customers');
    assert.ok(app.text().includes('Hyperwolf'), 'the whole card was thrown away — a blank card is what it exists to prevent');
    assert.ok(D.merchRefusals().some((r) => r.surface === '_house' && r.why === 'claim-over-ceiling'),
      'nothing records that a house-card line was dropped');
  });
});
