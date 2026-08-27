/* ── A SUGGESTION THAT WAS NEVER COMPUTED IS NOT A NEGATIVE VERDICT ─────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * 2026-08-26/27. POST /api/mapping/bulk with rescore_all scored every catalogue
 * SKU against every cached Weedmaps product — 148 x 17,749 = 2.6 million
 * comparisons in ONE synchronous request, 82.8s over HTTP — which held the
 * worker, queued /api/state behind it and got the Render instance restarted for
 * exceeding its memory limit. The server fix is brand-scoped scoring plus a
 * cache keyed on the mirror version, and a wall-clock budget as a backstop.
 *
 * The budget is where the DANGER moved to, and it is this panel's problem, not
 * the server's. rows() decided a SKU's state from `suggestion`:
 *
 *     else { st = 'nomatch'; }          // -> "NO CONFIDENT MATCH", in red
 *
 * `suggestion` is null when the engine looked and rejected. It is ALSO null
 * when the pass ran out of budget and never reached the row. Those are opposite
 * facts and they rendered identically: a truncated pass drew rows in red as a
 * verdict the engine never gave. That is this estate's recurring defect —
 * "we scored 40 of 17,749" reaching a human as "no match found" — and the whole
 * reason the server now sends `suggestion_status` on every row and a
 * `suggestions` block on the response.
 *
 * HOW IT TESTS
 * ------------
 * Loads the real shared/hw-live-mapping.js in jsdom with W.HW_LIVE.post and
 * fetch stubbed per scenario, drives HW_MAPPING.refresh(), and reads the
 * derived board off the live HW_MAPPING.rows getter. Nothing on disk and
 * nothing on any port is touched. What is asserted is WHAT STATE A ROW LANDS
 * IN, not what colour a div came out — the state is the thing that was wrong.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = readFileSync(new URL('../shared/hw-live-mapping.js', import.meta.url), 'utf8');

function bulkPayload(rows, suggestions) {
  return {
    rows,
    wm_cached: 17749,
    counters: { total: rows.length, mapped: 0, unmapped: rows.length, overrides: 0 },
    suggestions
  };
}

function row(sku, over) {
  return Object.assign({
    sku, name: sku + ' 3.5g', category: 'Flower',
    weight: { value: 3.5, unit: 'g' },
    wm_product_id: null, mapping: null, queued: false, queue_reason: null,
    suggestion: null, suggestion_status: 'scored'
  }, over || {});
}

/** Boot the seam against a fixture and hand back its derived board. */
async function board(bulk) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:5173/', pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const W = dom.window;
  W.HW_LIVE = {
    post: (path) => Promise.resolve(
      path === '/api/mapping/bulk'
        ? { ok: true, code: 200, body: bulk }
        : { ok: false, code: 404, body: null, error: 'not stubbed' })
  };
  // The three GET reads this panel also makes. Answering them EMPTY rather than
  // failing keeps the scenario about suggestion_status and nothing else.
  W.fetch = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ absences: [], unlooked: [], brands: [],
                                  products: [], menu_state: [], events: [] })
  });
  W.eval(SRC);          // window-scoped, as a <script> would be
  await W.HW_MAPPING.refresh();
  const out = { rows: W.HW_MAPPING.rows, counts: W.HW_MAPPING.counts,
                status: W.HW_MAPPING.status };
  dom.window.close();
  return out;
}

const COMPLETE = { mode: 'brand_scoped', brand_scoped: true, wm_candidates: 17749,
                   scored: 2, requested: 2, complete: true, stopped_reason: null,
                   budget_s: 20.0, cached: false, cache_age_s: 0.0, rescored: true };

test('a SCORED row the engine rejected is still NO CONFIDENT MATCH', async () => {
  const b = await board(bulkPayload(
    [row('A'), row('B')],
    Object.assign({}, COMPLETE)));
  assert.equal(b.status, 'live');
  const byS = Object.fromEntries(b.rows.map(r => [r.sku, r]));
  assert.equal(byS.A.state, 'nomatch',
    'a row the server DID score and found nothing for must keep the negative verdict');
  assert.equal(byS.B.state, 'nomatch');
});

test('a row the pass never reached is NOT SCORED, never NO CONFIDENT MATCH', async () => {
  const b = await board(bulkPayload(
    [row('A', { suggestion_status: 'scored' }),
     row('B', { suggestion_status: 'not_scored_budget' })],
    Object.assign({}, COMPLETE, { scored: 1, requested: 2, complete: false,
                                  stopped_reason: 'budget' })));
  const byS = Object.fromEntries(b.rows.map(r => [r.sku, r]));
  assert.equal(byS.A.state, 'nomatch');
  assert.notEqual(byS.B.state, 'nomatch',
    'THE BUG: an unscored row rendering as a negative verdict the engine never gave');
  assert.equal(byS.B.state, 'unscored');
  assert.equal(byS.B.suggestionStatus, 'not_scored_budget',
    'the server\'s own word must survive onto the derived row');
  assert.equal(b.counts.unscored, 1);
  assert.equal(b.counts.nomatch, 1,
    'the unscored row must not be counted as a no-match anywhere');
});

test('an unscored row is never offered for one-click approval', async () => {
  const b = await board(bulkPayload(
    [row('B', { suggestion_status: 'not_scored_budget' })],
    Object.assign({}, COMPLETE, { scored: 0, requested: 1, complete: false,
                                  stopped_reason: 'budget' })));
  assert.equal(b.counts.ready, 0,
    'READY means the engine returned exact/auto; a row it never scored cannot be ready');
});

test('a real verdict still wins: a scored auto-match is READY, not unscored', async () => {
  const b = await board(bulkPayload(
    [row('A', { suggestion_status: 'scored',
                suggestion: { decision: 'exact', wm_id: 700001, wm_name: 'A 3.5g',
                              score: 1.0, note: 'deterministic exact match',
                              scope: 'brand', pool: 76, brand_id: 21341,
                              brand_source: 'wm_brand_id', cross_brand: false } })],
    Object.assign({}, COMPLETE, { scored: 1, requested: 1 })));
  assert.equal(b.rows[0].state, 'ready');
  assert.equal(b.rows[0].suggestion.wm_id, 700001);
  assert.equal(b.counts.unscored, 0);
});

test('a server that sends no suggestion_status at all behaves as it always did', async () => {
  // Backward compatibility is not optional here: this file ships to a browser
  // and the API it talks to is deployed separately. An older server sends rows
  // with no `suggestion_status` key, and those rows must keep their old
  // meaning rather than silently becoming NOT SCORED.
  const legacy = [{ sku: 'A', name: 'A 3.5g', category: 'Flower',
                    weight: { value: 3.5, unit: 'g' }, wm_product_id: null,
                    mapping: null, queued: false, queue_reason: null,
                    suggestion: null }];
  const b = await board({ rows: legacy, wm_cached: 96,
                          counters: { total: 1, mapped: 0, unmapped: 1, overrides: 0 } });
  assert.equal(b.rows[0].state, 'nomatch');
  assert.equal(b.counts.unscored, 0);
});

/* THE PANEL MUST QUOTE THE SERVER, NOT NARRATE ITS OWN GUESS.
 * The copy that said this read "scores every SKU against every cached WM
 * product" was true when it was written and became the description of an
 * outage. The sentence is now built in ONE place from the server's own
 * `suggestions` block, so there is exactly one thing to check when the wording
 * and the payload disagree. */
/* THE WORD AND THE COLOUR ARE PART OF THE CLAIM.
 * Giving the unscored state the red of NO CONFIDENT MATCH would restore the
 * exact defect while leaving every state assertion above green — the state
 * would be right and the screen would still lie. NEVER LOOKED already owns the
 * `info` ink for "unstarted work of ours"; NOT SCORED YET is the same kind of
 * fact and must share it. */
test('NOT SCORED YET is not drawn as a negative verdict', () => {
  const i = SRC.indexOf("if (st === 'unscored')");
  assert.ok(i > 0, 'no unscored badge branch — the state has no word of its own');
  const seg = SRC.slice(i, SRC.indexOf('\n', i));
  assert.ok(/P\.info/.test(seg),
    'NOT SCORED YET must share NEVER LOOKED\'s ink, not invent a tone');
  assert.ok(!/P\.bad/.test(seg),
    'the red of NO CONFIDENT MATCH asserts that we looked — an unscored row must never wear it');
  assert.ok(!/NO CONFIDENT MATCH/.test(seg),
    'and it must never carry that word either');
});

test('the freshness copy is derived from the server block, in one place', () => {
  assert.ok(/function passSentence\(\)/.test(SRC),
    'no single place builds the sentence about how the pass ran');
  assert.ok(!/scores every SKU against every cached Weedmaps product/.test(SRC),
    'the panel still tells the operator the endpoint does the thing that took the demo down');
  assert.ok(/_sg\.complete === false/.test(SRC),
    'an incomplete pass must raise a banner, not only a per-row note');
  assert.ok(/sg\.cached/.test(SRC),
    'a cached answer must be disclosed — a stale board that looks fresh is the same defect');
});
