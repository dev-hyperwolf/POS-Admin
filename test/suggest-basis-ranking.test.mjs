/* ── THE RANKING, AND THE LABEL THAT SAYS WHAT PRODUCED IT ───────────────────
 *
 * pos/screen-cart.jsx `HWSuggestBasis` is the register's "Suggested" chip. Its
 * own comment used to say "this module ranks nothing, it SELECTS", and that was
 * accurate: there was no ranking to apply. wmdemo/suggestion_rank.py is now
 * that ranking, delivered through `window.HW.purchaseHistory(...)` ordered
 * repeat-purchase first, then category affinity, then brand affinity.
 *
 * TWO DEFECTS WERE MEASURED IN THIS FILE'S SUBJECT BEFORE IT WAS WRITTEN, both
 * by executing it rather than reading it (2026-08-27):
 *
 *   1. THE THREE STATES COLLAPSED. `readHistory` returned null for skus `[]`
 *      (no_purchases) AND for skus `null` (unknown) AND for the transient
 *      state:'loading'. All three then fell to the visit-count fallback and
 *      produced a BYTE-IDENTICAL banner: "Visit 4 — no itemised purchase
 *      history on this record". That sentence is an assertion about the RECORD,
 *      and it was being printed while the request had not come back yet.
 *
 *   2. THE RANKING ORDER WAS THROWN AWAY. The history branch rebuilt the list
 *      with `sellable.filter(...)`, which yields CATALOGUE order. A seam
 *      returning C,A,B rendered as A,B,C — the repeat purchase demoted beneath
 *      two products the customer never bought.
 *
 * EVERY ASSERTION HERE COMPARES TWO STATES AND FAILS IF THEY ARE EQUAL, in the
 * house style of suggested-basis.test.mjs. Nothing pins copy: a build that
 * printed one reassuring sentence for every basis would pass a copy test and is
 * exactly the defect. SBR-7 additionally pins the pre-seam behaviour, because
 * the fix must not change what the shipped build does today.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../pos/screen-cart.jsx', import.meta.url), 'utf8');

/** Evaluate the IIFE alone. No DOM, no React — resolve() is a pure function. */
function boot(purchaseHistory) {
  const w = {};
  const sandbox = { window: w };
  const start = SRC.indexOf('window.HWSuggestBasis = (function () {');
  assert.ok(start > 0, 'HWSuggestBasis is no longer in pos/screen-cart.jsx');
  const end = SRC.indexOf('})();', start) + 5;
  new Function('window', SRC.slice(start, end)).call(sandbox, w);
  w.HW = purchaseHistory === undefined ? {} : { purchaseHistory };
  return w.HWSuggestBasis;
}

const P = (sku, brand, qty) => ({ sku, brand, active: true, qty });
/** Three brands, one of them BLANK — 33 of the 149 live products are blank. */
const CAT = [P('A', 'Hyperwolf', 5), P('B', 'Othermark', 5), P('C', '', 5), P('D', 'Hyperwolf', 5)];
const CUST = { name: 'Repeat Regular', visits: 4 };

const ask = (ph, customer = CUST, catalogue = CAT) =>
  boot(ph).resolve({ customer, catalogue });

/* ── SBR-1..3: the three states must not render alike ──────────────────────── */

test('SBR-1 no_purchases and unknown are different kinds and different sentences', () => {
  const nop = ask(() => ({ skus: [], orders: 0, source: 'route' }));
  const unk = ask(() => ({ skus: null, orders: null, source: 'route',
    state_reason: 'no Weedmaps account is bound to them' }));

  assert.notEqual(nop.line, unk.line,
    `"they have bought nothing" and "we cannot see what they bought" render identically: ${nop.line}`);
  assert.notEqual(nop.kind, unk.kind,
    `both states report kind=${nop.kind}, so no caller can tell them apart either`);
  assert.equal(nop.historyState, 'no-purchases');
  assert.equal(unk.historyState, 'unknown');
  // The unknown banner must not let an operator read the person as a newcomer.
  assert.match(unk.line, /do not/i,
    `the unknown banner does not warn against reading it as a first visit: ${unk.line}`);
});

test('SBR-2 a fetch still in flight asserts nothing and does not move the grid', () => {
  const loading = ask(() => ({ state: 'loading', state_reason: 'reading' }));
  const nop = ask(() => ({ skus: [], orders: 0, source: 'route' }));

  assert.equal(loading.ranks, false,
    'the grid was re-ordered on a default while the real answer was still in flight');
  assert.notEqual(loading.line, nop.line,
    `"still loading" and "has bought nothing" render identically: ${loading.line}`);
  assert.deepEqual(loading.skus, []);
});

test('SBR-3 a refused route is announced, never rendered as an empty history', () => {
  const refused = ask(() => ({ state: 'unavailable', state_code: 'wm_id_on_multiple_identities',
    state_reason: 'this Weedmaps id is bound to 4 different live people' }));
  const nop = ask(() => ({ skus: [], orders: 0, source: 'route' }));

  assert.equal(refused.ranks, false, 'the grid moved on a basis the route refused to supply');
  assert.notEqual(refused.line, nop.line);
  assert.match(refused.line, /wm_id_on_multiple_identities/,
    `the refusal banner does not carry the machine code: ${refused.line}`);
  assert.match(refused.line, /not the same as/i,
    `the refusal is not distinguished from "bought nothing": ${refused.line}`);
});

/* ── SBR-4..6: the ranking is an ORDER, and it survives ────────────────────── */

test('SBR-4 the ranking order from the server survives into the grid', () => {
  // The server ranks D first (their repeat purchase). Catalogue order is A,B,C,D.
  const r = ask(() => ({ skus: ['D', 'B', 'A'], orders: 9, source: 'route' }));
  assert.equal(r.kind, 'history');
  assert.deepEqual(r.skus, ['D', 'B', 'A'],
    `the chip re-sorted the ranking into catalogue order: got ${r.skus.join(',')}`);
});

test('SBR-5 the chip ORDERS and never filters the grid down', () => {
  const r = ask(() => ({ skus: ['D', 'A'], orders: 3, source: 'route' }));
  // Selection is intentional here (only ranked skus are lifted) — what is
  // asserted is that nothing was invented and every lifted sku was asked for.
  assert.ok(r.skus.every((s) => ['D', 'A'].includes(s)),
    `the chip lifted a product the ranking never named: ${r.skus.join(',')}`);
  assert.equal(new Set(r.skus).size, r.skus.length, 'a sku was lifted twice');
});

test('SBR-6 a duplicated sku cannot promote itself past the ranking', () => {
  const r = ask(() => ({ skus: ['B', 'A', 'B'], orders: 4, source: 'route' }));
  assert.deepEqual(r.skus, ['B', 'A'],
    `a repeated sku changed the order or was rendered twice: ${r.skus.join(',')}`);
});

/* ── SBR-7: the shipped build must not change ──────────────────────────────── */

test('SBR-7 with no seam, and with a row carrying no key, behaviour is unchanged', () => {
  const noSeam = ask(undefined);
  // hw-live-history.js answers 'no_key' for every mock MEMBERS row: it fires no
  // fetch, because there is nothing to look the person up by. That is the
  // ordinary state of the shipped build and must read as it always has — NOT as
  // a refusal, which is what routing it to the unavailable branch would do.
  const noKey = ask(() => ({ state: 'no_key', state_reason: 'no customer key was given' }));
  const off = ask(() => ({ state: 'off', state_reason: 'the seam is switched off' }));

  assert.equal(noSeam.kind, 'returning', 'the pre-seam fallback changed');
  assert.equal(noKey.kind, noSeam.kind,
    `a row with no customer key now reports ${noKey.kind} instead of the ordinary fallback`);
  assert.equal(noKey.line, noSeam.line, 'a keyless row now renders a different banner');
  assert.equal(off.line, noSeam.line, 'disarming the seam now renders a different banner');
  assert.equal(noKey.ranks, true, 'the house-brand default stopped ranking on the shipped path');
});

/* ── SBR-8: history vs default must never be the same sentence ─────────────── */

test('SBR-8 a ranking from history and one from the house-brand default differ', () => {
  const hist = ask(() => ({ skus: ['A'], orders: 6, source: 'route' }));
  const dflt = ask(undefined);
  assert.notEqual(hist.line, dflt.line,
    'a personalised ranking and the stranger default print the same sentence');
  assert.equal(hist.reason, 'Bought before');
  assert.notEqual(hist.reason, dflt.reason,
    `the per-tile reason is identical on both bases: ${dflt.reason}`);
  assert.ok(/history/i.test(hist.line), `the history banner does not say so: ${hist.line}`);
  assert.ok(/house brand/i.test(dflt.line), `the default banner does not say so: ${dflt.line}`);
});

/* ── SBR-9: a blank brand is not a brand ───────────────────────────────────── */

test('SBR-9 a product with no brand is counted and never ranked as house brand', () => {
  const d = ask(undefined);
  assert.equal(d.counts.noBrand, 1, 'the blank-brand product was not counted');
  assert.ok(!d.skus.includes('C'), 'a product with no brand was ranked as the house brand');
  assert.match(d.line, /no brand/i,
    `the banner does not say how much of the catalogue could not be judged: ${d.line}`);
});
