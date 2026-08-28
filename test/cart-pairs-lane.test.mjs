/* ── "PAIRS WITH CART", INSIDE THE CART — THE LANE, AND THE REFUSAL ──────────
 *
 * The owner asked for pairs-well-with-cart suggestions on the cards inside the
 * cart. The lane that answers that question (`pairs_with_cart`, wmdemo/reco/
 * core.py) REFUSES on today's data: a co-occurrence pair needs three distinct
 * customers and 187 of the 191 multi-item baskets belong to one synthetic
 * account. There is also no HTTP route serving the lane yet.
 *
 * So the thing under test is not "does a list appear". It is:
 *
 *   1. does the REFUSAL reach the screen, in the lane's own words, with the
 *      lane's own code — rather than an empty card, a spinner, or a filler list
 *   2. is a SUBSTITUTE ever rendered under a heading that says "pairs with"
 *   3. does a real pairing, when one exists, actually render
 *
 * ⚠️ EVERY PAYLOAD HERE IS core.rank's REAL SHAPE, not a shape invented to make
 * the seam pass. `recommends` / `refusal:{code,sentence}` / `items[].
 * contributions[].source` / `meta.cart.substitutes_found` are read off
 * wmdemo/reco/core.py — `_refuse()`, `_items()` and `_rank_cart()`. A fixture
 * that agreed with the seam and disagreed with the engine would prove nothing.
 *
 * ⚠️ THE SUBSTITUTE FIXTURES ARE THE POINT. Two of them return
 * `recommends: true` with products the lane scored on ATTRIBUTE SIMILARITY
 * alone. That is the shape `allow_substitutes=True` produces, and it is the one
 * shape where a careless caller renders "buy this instead" as "buy this too".
 * The seam must refuse it, and the card must show no tiles for it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const SRC = readFileSync(new URL('../shared/hw-live-suggest.js', import.meta.url), 'utf8');

/* ── the seam, on a bare window ───────────────────────────────────────────── */

/** Boot shared/hw-live-suggest.js against a stubbed fetch. `routes(path)` →
 *  { status, body }. Returns the window plus the list of paths asked for. */
function bootSeam(routes) {
  const calls = [];
  const W = {
    setTimeout, clearTimeout,
    // A purchaseHistory on HW so the OTHER IIFE in this file wraps immediately
    // and stops its 200-attempt retry loop, rather than leaving timers pending.
    HW: { purchaseHistory: () => null },
    fetch(url) {
      calls.push(url);
      const hit = routes(String(url));
      return Promise.resolve({
        ok: hit.status >= 200 && hit.status < 300,
        status: hit.status,
        json: () => (hit.body === undefined ? Promise.reject(new Error('no body'))
          : Promise.resolve(hit.body)),
      });
    },
  };
  W.window = W;
  new Function('window', 'setTimeout', 'clearTimeout', SRC)(W, setTimeout, clearTimeout);
  return { W, calls };
}

/** Let the stubbed fetch and its .then chain run to completion. */
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

/* ── payloads, in core.rank's own shape ───────────────────────────────────── */

const contrib = (source, why, support = 9) => ({ source, why, support, points: 1.5 });

/** `_items()`'s row shape. `sources` decides whether this is a pairing. */
const item = (sku, sources, extra = {}) => ({
  position: 1, sku, name: `Product ${sku}`, brand_name: 'Acme', category: 'Vapes',
  price: 42, score: 3.2,
  contributions: sources.map((s) => contrib(s, `${s} evidence for ${sku}`)),
  top_reason: `4 of the 11 baskets that contained CART-1 also contained ${sku}`,
  evidence_basis: 'similar_guests_or_products', personalised: false,
  borrowed_signal: sources.slice(), support_total: 9,
  stock: 'in_stock', stock_known: true, business: null, ...extra,
});

/** `_refuse()`'s payload, plus the `substitutes` key the cart lane staples on. */
const refusal = (code, sentence, subs = 0) => ({
  lane: 'pairs_with_cart', recommends: false,
  refusal: { code, sentence },
  items: [], personalised: false, basis: 'refused', basis_sentence: sentence,
  substitutes: Array.from({ length: subs }, (_, i) => item(`SUB-${i}`, ['cart_content'])),
  meta: { cart: { size: 1, pairings_found: 0, substitutes_found: subs } },
});

const answer = (items, pairings) => ({
  lane: 'pairs_with_cart', recommends: true, refusal: null, items,
  personalised: false, basis: 'look_alike_or_similar_products',
  basis_sentence: `${items.length} product(s) that pair with the 1 item(s) on the counter, `
    + `${pairings} of them ranked on how often they have actually been bought together.`,
  meta: { cart: { size: 1, pairings_found: pairings, substitutes_found: items.length - pairings } },
});

const NO_COOC = 'NO PAIRING EVIDENCE EXISTS. Nothing in this cart (CART-1) has ever been '
  + 'bought together with anything else by enough different customers to count.';

/* ── 1. the route does not exist, and that is a DEPLOYMENT fact ───────────── */

test('a 404 on the pairing route reads as a missing route, not as a fact about the cart', async () => {
  const { W, calls } = bootSeam(() => ({ status: 404, body: { error: 'not found' } }));
  assert.equal(typeof W.HW.cartPairings, 'function', 'the seam did not publish HW.cartPairings');

  const first = W.HW.cartPairings(['CART-1']);
  assert.equal(first.state, 'loading', 'the first ask claimed something before the route answered');
  assert.equal(first.items.length, 0, 'a loading lane produced products');

  await flush();
  const after = W.HW.cartPairings(['CART-1']);
  assert.equal(after.state, 'unavailable');
  assert.equal(after.code, 'route_missing',
    `a 404 came back as ${after.code} — the screen would blame the cart for a missing endpoint`);
  assert.equal(after.items.length, 0);
  assert.ok(after.sentence.includes('/api/reco/pairs-with-cart'),
    `the refusal does not name the route it needs: ${after.sentence}`);

  // AND IT STOPS ASKING. A 404 is the same 404 for every cart; a rail that
  // re-fires a failing request on every scan is its own outage.
  const asked = calls.length;
  W.HW.cartPairings(['CART-2']);
  W.HW.cartPairings(['CART-3', 'CART-4']);
  await flush();
  assert.equal(calls.length, asked,
    `the seam kept asking a route it knows is absent (${calls.length} calls, was ${asked})`);
  assert.equal(W.HW.cartPairings(['CART-9']).code, 'route_missing');
});

/* ── 2. the refusal is the lane's own words, carried through ──────────────── */

test('a lane refusal reaches the caller with its own code and its own sentence, and no items', async () => {
  const { W } = bootSeam(() => ({ status: 200, body: refusal('no_cooccurrence_evidence', NO_COOC, 6) }));
  W.HW.cartPairings(['CART-1']);
  await flush();

  const a = W.HW.cartPairings(['CART-1']);
  assert.equal(a.state, 'refused');
  assert.equal(a.code, 'no_cooccurrence_evidence',
    'the lane\'s refusal code was replaced with one of the seam\'s own');
  assert.equal(a.sentence, NO_COOC,
    'the seam summarised the lane\'s sentence instead of carrying it through');
  assert.equal(a.items.length, 0, 'a refusal produced products');

  // The substitutes are COUNTED and not one of them is handed back.
  assert.equal(a.substitutes_found, 6, 'the substitute count did not survive the refusal');
  assert.ok(!Array.isArray(a.substitutes) || a.substitutes.length === 0,
    'the seam handed back substitutes under a pairing answer');
});

/* ── 3. substitutes are never promoted into pairings ──────────────────────── */

test('a `recommends: true` answer built only from attribute similarity is REFUSED, not rendered', async () => {
  // This is exactly what `allow_substitutes=True` produces: real items, real
  // scores, and not one `cart_item_item` contribution among them.
  const subsOnly = answer([item('S1', ['cart_content']), item('S2', ['cart_content', 'popularity_prior'])], 0);
  const { W } = bootSeam(() => ({ status: 200, body: subsOnly }));
  W.HW.cartPairings(['CART-1']);
  await flush();

  const a = W.HW.cartPairings(['CART-1']);
  assert.equal(a.state, 'refused',
    `two attribute-similar products were served as pairings (state ${a.state})`);
  assert.equal(a.code, 'no_cooccurrence_evidence');
  assert.equal(a.items.length, 0, 'a substitute was returned as a pairing');
  assert.equal(a.substitutes_found, 2, 'the substitutes were dropped without being counted');
});

test('a mixed answer keeps the co-occurrence rows and drops the attribute-similar ones', async () => {
  const mixed = answer([
    item('PAIR-1', ['cart_item_item', 'popularity_prior']),
    item('SUB-1', ['cart_content']),
    item('PAIR-2', ['cart_item_item']),
  ], 2);
  const { W } = bootSeam(() => ({ status: 200, body: mixed }));
  W.HW.cartPairings(['CART-1']);
  await flush();

  const a = W.HW.cartPairings(['CART-1']);
  assert.equal(a.state, 'pairs');
  assert.equal(a.items.map((x) => x.sku).join(','), 'PAIR-1,PAIR-2',
    'the list is not exactly the rows with co-occurrence evidence behind them');
  // Popularity rode along on PAIR-1 and did not put anything on the list by
  // itself — SUB-1 carried attribute similarity and is gone.
  assert.ok(!a.items.some((x) => x.sku === 'SUB-1'), 'a substitute survived into the pairing list');
});

/* ── 4. an empty cart has no question, and it is not a refusal ────────────── */

test('an empty cart is its own state — the lane is never even asked', async () => {
  const { W, calls } = bootSeam(() => ({ status: 200, body: answer([item('P', ['cart_item_item'])], 1) }));
  const a = W.HW.cartPairings([]);
  assert.equal(a.state, 'empty');
  assert.equal(a.code, 'cart_empty');
  await flush();
  assert.equal(calls.length, 0, 'the seam asked what pairs with an empty cart');
});

/* ── 5. the cart is a SET — the same cart may not give two answers ────────── */

test('cart order and duplicates do not change which question is asked', async () => {
  const { W, calls } = bootSeam(() => ({ status: 200, body: answer([item('P', ['cart_item_item'])], 1) }));
  W.HW.cartPairings(['B', 'A']);
  await flush();
  const one = W.HW.cartPairings(['A', 'B', 'A']);
  assert.equal(one.state, 'pairs', 'the same cart in another order was treated as a new cart');
  assert.equal(calls.length, 1,
    `the same cart was asked about ${calls.length} times — the scan order changes the request`);
  assert.ok(calls[0].includes('cart=A%2CB'), `the cart was not sent normalised: ${calls[0]}`);
  // And it never opts into substitutes on the wire.
  assert.ok(!calls[0].includes('allow_substitutes'),
    `the seam asked the lane to serve substitutes: ${calls[0]}`);
});

/* ── 6. the card on the actual screen ─────────────────────────────────────── */

/** The pairs card's state and code, read off the DOM it publishes. */
function card(app) {
  const el = app.document.querySelector('[data-hw-cart-pairs]');
  if (!el) return null;
  return {
    state: el.getAttribute('data-hw-cart-pairs'),
    code: el.getAttribute('data-hw-cart-pairs-code'),
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    adds: [...el.querySelectorAll('button[title^="Add "]')].map((b) => b.getAttribute('title')),
  };
}

test('the cart carries a "Pairs with cart" card, and with no route it states the refusal instead of going blank', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    await app.settle();

    const c = card(app);
    assert.ok(c, `no pairs-with-cart card in the cart — cart text: ${app.text().slice(0, 300)}`);
    assert.ok(c.text.includes('Pairs with cart'), `the card is not headed "Pairs with cart": ${c.text}`);

    // The harness is offline, so the lane cannot be reached. The card must SAY
    // so — an empty card here is indistinguishable from a lane that ran and
    // found nothing, which is the defect this whole surface guards against.
    assert.notEqual(c.state, 'pairs', 'an offline harness produced pairings');
    assert.ok(c.code && c.code.length > 0, 'the card is in a non-answer state and names no code');
    assert.ok(c.text.length > 80,
      `the card went quiet instead of stating why it has nothing: ${JSON.stringify(c.text)}`);
    assert.equal(c.adds.length, 0, 'a card with no pairing evidence is still offering products');
  });
});

test('a real refusal renders the lane\'s sentence and its code, and offers nothing', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    await app.mount('RegisterScreen');
    await app.settle();
    assert.ok(W.HW_CART_PAIRS, 'the cart-pairing seam did not load on the page');

    // A cart of exactly one known product, so the payload can be seeded for it.
    assert.ok(app.click('Clear cart'), 'no Clear cart control');
    await app.settle();
    const p = W.HW.PRODUCTS.find((x) => x.active && x.qty > 0);
    assert.ok(app.click((t, el) => t === 'Add' && !!el.closest(`[data-hw-sku="${p.sku}"]`)),
      `could not add ${p.sku} from the grid`);
    await app.settle();

    W.HW_CART_PAIRS.seed([p.sku], refusal('no_cooccurrence_evidence', NO_COOC, 6));
    await app.settle();

    const c = card(app);
    assert.equal(c.state, 'refused', `the seeded refusal rendered as ${c.state}`);
    assert.equal(c.code, 'no_cooccurrence_evidence');
    assert.ok(c.text.includes('NO PAIRING EVIDENCE EXISTS'),
      `the lane's own sentence is not on the screen: ${c.text}`);
    assert.ok(c.text.includes('no_cooccurrence_evidence'),
      `the refusal code is not on the screen: ${c.text}`);
    // The six substitutes are DECLARED and none of them is shown.
    assert.ok(/6 products are attribute-similar/.test(c.text),
      `the substitutes were not declared: ${c.text}`);
    assert.equal(c.adds.length, 0,
      `the card offered ${c.adds.join(', ')} under a heading claiming they pair with the cart`);
  });
});

test('a real pairing renders, with the evidence the lane counted', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    await app.mount('RegisterScreen');
    await app.settle();

    assert.ok(app.click('Clear cart'), 'no Clear cart control');
    await app.settle();
    const [anchor, mate] = W.HW.PRODUCTS.filter((x) => x.active && x.qty > 0);
    assert.ok(mate, 'the catalogue is too small for this fixture');
    assert.ok(app.click((t, el) => t === 'Add' && !!el.closest(`[data-hw-sku="${anchor.sku}"]`)));
    await app.settle();

    const row = item(mate.sku, ['cart_item_item']);
    row.name = mate.name;
    row.top_reason = `7 of the 19 baskets that contained ${anchor.sku} also contained this`;
    W.HW_CART_PAIRS.seed([anchor.sku], answer([row], 1));
    await app.settle();

    const c = card(app);
    assert.equal(c.state, 'pairs', `a seeded pairing rendered as ${c.state} (${c.code})`);
    assert.ok(c.text.includes(mate.name), `the paired product is not on the card: ${c.text}`);
    assert.ok(c.text.includes('7 of the 19 baskets'),
      `the card shows a pairing and not the evidence behind it: ${c.text}`);
    assert.equal(c.adds.length, 1, `the card renders a pairing it cannot add: ${c.adds.join(', ')}`);

    // And the anchor is not sold back to the ticket it is already on.
    assert.ok(!c.adds.some((t) => t.includes(anchor.name)),
      'the card offered a product that is already in the cart');
  });
});
