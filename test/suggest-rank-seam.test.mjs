/* shared/hw-live-suggest.js — the wrapper that carries the RANKING to the grid.
 *
 * The seam under it (shared/hw-live-history.js) gets the three states right and
 * returns `skus` in ITEMS order, because GET /api/customer/purchase-history
 * ranks nothing on purpose. GET /api/customer/suggestions is the ranking. This
 * file is the join, and the ways a join like this goes wrong are all silent:
 *
 *   * it fights the seam for window.HW.purchaseHistory and one of them wins by
 *     <script> order (SRS-1 pins the delegation instead);
 *   * it invents an order while the ranking is still in flight, so the grid
 *     shows a confident ranking that is really catalogue order (SRS-3);
 *   * it turns a `no_purchases` [] or an `unknown` null into a list on its way
 *     past — the collapse both modules exist to prevent (SRS-2);
 *   * it DROPS a product the ranking did not mention (SRS-5).
 *
 * These RUN the file against a stubbed fetch. A grep would pass on a build that
 * returned the unranked list under a ranked label.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../shared/hw-live-suggest.js', import.meta.url), 'utf8');

/** Boot the IIFE over a fake HW whose purchaseHistory we control. */
function boot({ history, ranked, refuse }) {
  const w = {
    HW: { purchaseHistory: () => history },
    setTimeout: (fn) => fn(),
    fetch: (url) => Promise.resolve({
      ok: !refuse,
      status: refuse ? 409 : 200,
      json: () => Promise.resolve(refuse
        ? { code: 'wm_id_on_multiple_identities', error: 'bound to 4 people' }
        : { ranked: (ranked || []).map((sku) => ({ sku })),
            basis_effective: 'repeat_purchase',
            basis_shifted: false,
            basis_sentence_effective: 'Ranked on their own purchases.' }),
    }),
  };
  w.window = w;
  new Function('window', 'setTimeout', SRC).call(w, w, w.setTimeout);
  return w;
}

const HIST = (extra = {}) => ({
  state: 'history', state_reason: 'they bought things',
  skus: ['A', 'B', 'C'], orders: 5, source: '/api/customer/purchase-history',
  subject: { identity_id: 77 }, ...extra,
});

const settle = () => new Promise((r) => setImmediate(r));

test('SRS-1 it wraps the existing accessor instead of racing it for the property', () => {
  const w = boot({ history: HIST() });
  assert.equal(typeof w.HW.purchaseHistory, 'function');
  assert.equal(w.HW.__suggestWrapped, true);
  assert.equal(w.HW_SUGGEST.status().wrapped, true,
    'the wrapper did not capture the accessor it is meant to delegate to');
  // A second boot must not wrap the wrapper.
  new Function('window', 'setTimeout', SRC).call(w, w, w.setTimeout);
  const again = w.HW.purchaseHistory;
  assert.equal(again, w.HW.purchaseHistory, 'double-wrapped on a second load');
});

test('SRS-2 no_purchases and unknown pass through untouched — never made into a list', async () => {
  for (const [label, state, skus] of [['no_purchases', 'no_purchases', []],
                                      ['unknown', 'unknown', null]]) {
    const src = { state, skus, subject: { identity_id: 77 }, source: 'route' };
    const w = boot({ history: src, ranked: ['C', 'A'] });
    await settle();
    const got = w.HW.purchaseHistory({ identity_id: 77 });
    assert.deepEqual(got.skus, skus, `${label} had its skus rewritten to ${JSON.stringify(got.skus)}`);
    assert.equal(got.state, state, `${label} had its state rewritten`);
  }
});

test('SRS-3 before the ranking answers, the list is returned UNRANKED and says so', () => {
  const w = boot({ history: HIST(), ranked: ['C', 'A', 'B'] });
  const first = w.HW.purchaseHistory({ identity_id: 77 });   // fetch only starts here
  assert.equal(first.ranked, false,
    'the first call claimed a ranking before the ranking route had answered');
  assert.deepEqual(first.skus, ['A', 'B', 'C'], 'an order was invented in flight');
  assert.match(first.ranked_note, /not ranked|has not come back/i,
    `the unranked answer does not say it is unranked: ${first.ranked_note}`);
});

test('SRS-4 once the ranking answers, the order is the ranking’s and the label follows', async () => {
  const w = boot({ history: HIST(), ranked: ['C', 'A', 'B'] });
  w.HW.purchaseHistory({ identity_id: 77 });
  await settle();
  const got = w.HW.purchaseHistory({ identity_id: 77 });
  assert.equal(got.ranked, true);
  assert.deepEqual(got.skus, ['C', 'A', 'B'],
    `the ranking did not reach the list: ${got.skus.join(',')}`);
  assert.equal(got.basis_effective, 'repeat_purchase');
  assert.ok(/suggestions/.test(got.source),
    `source does not name the route that produced the order: ${got.source}`);
  assert.notEqual(got.source, HIST().source, 'source still names only the unranked route');
});

test('SRS-5 a product the ranking never mentioned keeps its place, it is not dropped', async () => {
  // The ranking covers the sellable catalogue; 'B' is not in it (out of stock).
  const w = boot({ history: HIST(), ranked: ['C', 'A'] });
  w.HW.purchaseHistory({ identity_id: 77 });
  await settle();
  const got = w.HW.purchaseHistory({ identity_id: 77 });
  assert.deepEqual(got.skus, ['C', 'A', 'B'],
    `an unranked product was dropped from the customer's own history: ${got.skus.join(',')}`);
  assert.match(got.ranked_note, /not in the/i,
    `the payload does not say a product fell outside the ranking: ${got.ranked_note}`);
});

test('SRS-6 a refused ranking leaves the history intact and names the refusal', async () => {
  const w = boot({ history: HIST(), refuse: true });
  w.HW.purchaseHistory({ identity_id: 77 });
  await settle();
  const got = w.HW.purchaseHistory({ identity_id: 77 });
  assert.equal(got.ranked, false, 'a refused ranking was reported as ranked');
  assert.deepEqual(got.skus, ['A', 'B', 'C'], 'a refusal cost the customer their history');
  assert.match(got.ranked_note, /wm_id_on_multiple_identities/,
    `the refusal code is not surfaced: ${got.ranked_note}`);
});

test('SRS-7 an answer with no identity_id is returned untouched, never guessed at', () => {
  const w = boot({ history: HIST({ subject: { identity_id: null } }), ranked: ['C'] });
  const got = w.HW.purchaseHistory({ wm_customer_id: 'x' });
  assert.equal(got.ranked, false);
  assert.deepEqual(got.skus, ['A', 'B', 'C']);
  assert.match(got.ranked_note, /identity_id/,
    `the payload does not explain why it was not ranked: ${got.ranked_note}`);
});

test('SRS-8 disabling the wrapper restores the seam’s own answer exactly', () => {
  const w = boot({ history: HIST(), ranked: ['C', 'A', 'B'] });
  w.HW_SUGGEST.disable();
  const got = w.HW.purchaseHistory({ identity_id: 77 });
  assert.deepEqual(got.skus, ['A', 'B', 'C']);
  assert.equal(got.ranked, undefined, 'a disabled wrapper still decorated the answer');
});

test('SRS-9 a non-history state carrying skus is still left alone', async () => {
  // The `state !== 'history'` guard is not redundant with the empty-list check
  // below it: those two catch no_purchases ([]) and unknown (null), and this
  // catches the case they cannot — a state that carries a NON-EMPTY list. A
  // mutation removing the guard survived the suite on 2026-08-27 for exactly
  // that reason. Only a positive history has an order worth applying, and a
  // future or malformed state must not acquire one on its way past.
  const odd = { state: 'unknown', skus: ['A', 'B', 'C'], source: 'route',
    subject: { identity_id: 77 } };
  const w = boot({ history: odd, ranked: ['C', 'A', 'B'] });
  w.HW.purchaseHistory({ identity_id: 77 });
  await settle();
  const got = w.HW.purchaseHistory({ identity_id: 77 });
  assert.equal(got.state, 'unknown', 'the state was rewritten');
  assert.deepEqual(got.skus, ['A', 'B', 'C'],
    `a non-history state was given a ranking: ${got.skus.join(',')}`);
  assert.notEqual(got.ranked, true, 'a non-history answer was labelled ranked');
});
