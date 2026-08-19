/* ── Loading shared/commerce-adapter.js under node, without a browser ────────
 *
 * `shared/commerce-engine.js` and `shared/commerce-adapter.js` are PLAIN JS
 * loaded as classic <script> tags — no modules, no build step, no DOM. So the
 * only thing they actually need is a global called `window`. `vm` gives us
 * exactly that and nothing else, which is the point: no jsdom, no dependencies,
 * and the files are executed BYTE FOR BYTE as the browser executes them rather
 * than through a rewrite that could paper over a bug.
 *
 * The engine bundle is `var HWCommerce = (() => {…})()` at the top level of a
 * classic script, so the `var` lands on the context's global object; making
 * `window` BE that global object is what makes `window.HWCommerce` resolve, the
 * same way it does in the browser.
 *
 * `patch` exists so a test can break the adapter IN MEMORY and prove the guard
 * that is supposed to catch that break actually fails. A guard nobody has
 * watched fail is a hypothesis. Nothing on disk is ever modified.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ENGINE = path.join(ROOT, 'shared', 'commerce-engine.js');
const ADAPTER = path.join(ROOT, 'shared', 'commerce-adapter.js');

export const adapterSource = () => fs.readFileSync(ADAPTER, 'utf8');

/**
 * Boot a fresh browser-ish global and evaluate the two scripts into it.
 *
 * @param {object}   [opts]
 * @param {boolean}  [opts.engine=true]  load commerce-engine.js first
 * @param {(src:string)=>string} [opts.patch] rewrite the adapter in memory
 * @returns {object} the `window` — carries `HWCommerce` and `HWSwap`
 */
export function loadWindow(opts = {}) {
  const { engine = true, patch } = opts;

  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  if (engine) {
    vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx, { filename: 'shared/commerce-engine.js' });
  }

  let src = adapterSource();
  if (patch) {
    const next = patch(src);
    if (next === src) {
      // A mutation that changed nothing would make the mutation test pass for
      // the wrong reason — it would be testing the UNBROKEN adapter.
      throw new Error('harness: patch() did not change the adapter source');
    }
    src = next;
  }
  vm.runInContext(src, ctx, { filename: 'shared/commerce-adapter.js' });

  return sandbox;
}

/** The adapter, or a throw. Tests that need HWSwap should not have to null-check. */
export function loadSwap(opts) {
  const w = loadWindow(opts);
  if (!w.HWSwap) throw new Error('harness: HWSwap did not load');
  return w.HWSwap;
}

/** Exact-string replace that refuses to silently no-op when the source moves on. */
export function replaceOnce(src, find, replaceWith) {
  const first = src.indexOf(find);
  if (first < 0) throw new Error(`mutation target not found in commerce-adapter.js:\n${find}`);
  if (src.indexOf(find, first + find.length) >= 0) {
    throw new Error(`mutation target is not unique in commerce-adapter.js:\n${find}`);
  }
  return src.slice(0, first) + replaceWith + src.slice(first + find.length);
}

// ── Fixtures ────────────────────────────────────────────────────────────────
// Estate shape, NOT engine shape: dollars, `cat`, `wt`, `qty`, margin as 0..1.

/** $35 eighth. The line every swap test is replacing. */
export const FLOWER_CURRENT = {
  id: 'blue-dream', sku: 'blue-dream', name: 'Blue Dream', brand: 'Pacific Stone',
  cat: 'Flower', price: 35, wt: '3.5g', thc: 24, strain: 'hybrid', margin: 0.42, qty: 10,
};

export const CATALOGUE = [
  FLOWER_CURRENT,
  { id: 'do-si-dos', sku: 'do-si-dos', name: 'Do-Si-Dos', brand: 'Claybourne',
    cat: 'Flower', price: 38, wt: '3.5g', thc: 28, strain: 'indica', margin: 0.4, qty: 8 },
  { id: 'house-flower', sku: 'house-flower', name: 'House Flower', brand: 'Hyperwolf',
    cat: 'Flower', price: 25, wt: '3.5g', thc: 19, strain: 'hybrid', margin: 0.55, qty: 12 },
  // Deliberately ONE unit: the partial-fill case.
  { id: 'last-jar', sku: 'last-jar', name: 'Last Jar', brand: 'Sundae',
    cat: 'Flower', price: 34, wt: '3.5g', thc: 27, strain: 'sativa', margin: 0.38, qty: 1 },

  // ⚠️ These three are the shipped bug. Each one is inside the ±40% similar
  // band of the $35 eighth, cheaper than it, AND ≥2 THC points stronger — so
  // if candidates() stops slicing by category they surface in ALL THREE
  // ladders and the POS offers a Pre-Roll to replace Flower.
  { id: 'indica-blunts-2pk', sku: 'indica-blunts-2pk', name: 'Indica Blunts 2pk', brand: 'Claybourne',
    cat: 'Pre-Rolls', price: 23, wt: '2g', thc: 26, strain: 'indica', margin: 0.5, qty: 20 },
  { id: 'mini-j-5pk', sku: 'mini-j-5pk', name: 'Mini J 5pk', brand: 'Pacific Stone',
    cat: 'Pre-Rolls', price: 28, wt: '3g', thc: 30, strain: 'hybrid', margin: 0.47, qty: 15 },
  { id: 'gummies-100mg', sku: 'gummies-100mg', name: 'Gummies 100mg', brand: 'Wyld',
    cat: 'Edibles', price: 26, wt: '10mg', thc: 90, margin: 0.6, qty: 30, was: 32 },
];

export const flatten = (r) => [].concat(r.similar, r.cheaper, r.stronger);

/**
 * Structural copy of a value produced INSIDE the vm context.
 *
 * `assert.deepStrictEqual` compares prototypes by reference, and an object
 * built in another realm has a different `Object.prototype`. Without this the
 * assertion fails with "same structure but not reference-equal", which reads
 * like a real defect and is not one.
 */
export const plain = (v) => JSON.parse(JSON.stringify(v));
