/* ── Loading the GOVERNED substitution stack under node ─────────────────────
 *
 * Same idea as test/harness.mjs: a `vm` context whose global IS `window`, so the
 * plain-JS files execute byte for byte as the browser executes them.
 *
 * Two differences, both forced by what this bridge actually needs:
 *
 * 1. It reads ESTATE DATA — `pos/data.jsx` (the catalogue and the tax helper)
 *    and `delivery/ddata.jsx` (region kit stock). Those two are `.jsx` by
 *    extension only; neither contains a byte of JSX, so `vm` runs them as-is.
 *
 * 2. Each estate file is wrapped in an IIFE before evaluation. They are written
 *    for `<script type="text/babel">`, where @babel/standalone's preset lowers
 *    top-level `const` to `var` and redeclaration is legal — and it has to be,
 *    because `pos/data.jsx` and `delivery/ddata.jsx` BOTH declare a top-level
 *    `const DRIVERS` and both load on `Hyperwolf Delivery.html`. Raw `vm` does
 *    not lower anything, so without the wrapper the second file dies on
 *    "Identifier 'DRIVERS' has already been declared". The wrapper changes
 *    nothing observable: every one of these files publishes through `window.X`.
 *
 * The two shared/ files are NOT wrapped — they are plain `<script>` and must be
 * executed exactly as shipped.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Estate data files: wrapped, because they are babel-transformed in the browser. */
const ESTATE = ['shared/brands.js', 'pos/data.jsx', 'delivery/ddata.jsx'];
/** Plain classic scripts: run verbatim, in load order. */
const PLAIN = ['shared/commerce-engine.js', 'shared/commerce-adapter.js', 'shared/commerce-governance.js'];

/**
 * Boot a browser-ish global and load the whole governed stack into it.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.skip] file paths (as listed above) to leave out — used
 *        to prove the degrade-to-null path rather than assume it.
 * @returns {object} the `window`
 */
export function loadWindow(opts = {}) {
  const skip = new Set(opts.skip || []);
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const f of ESTATE) {
    if (skip.has(f)) continue;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext('(function(){\n' + src + '\n})()', ctx, { filename: f });
  }
  for (const f of PLAIN) {
    if (skip.has(f)) continue;
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return sandbox;
}

/** The governance bridge, or a throw — tests should not have to null-check. */
export function loadGovern(opts) {
  const w = loadWindow(opts);
  if (!w.HWGovern) throw new Error('gov-harness: HWGovern did not load');
  return { w, G: w.HWGovern, HW: w.HW, DDATA: w.DDATA, E: w.HWCommerce };
}

/** Structural copy across the vm realm boundary (see test/harness.mjs). */
export const plain = (v) => JSON.parse(JSON.stringify(v));

/** A fixed clock. Every engine call takes `now`; nothing here reads a real one. */
export const NOW = new Date('2026-08-19T18:00:00.000Z');

/** Find a catalogue product by sku. */
export const sku = (HW, s) => HW.PRODUCTS.find((p) => p.sku === s);

/**
 * $5 off the cart while a specific product is in it.
 *
 * Keyed on `productIds` rather than a brand or a category on purpose: every
 * Pre-Roll in the demo catalogue is the same brand, and the engine restricts
 * candidates to the same category, so a brand- or category-keyed rule would
 * survive every swap it is supposed to be broken by and the test would pass
 * without testing anything.
 */
export function promoOn(productId, amountCents = 500, name = 'Bundle deal') {
  return {
    id: 'promo-' + productId,
    name,
    status: 'live',
    combiner: 'AND',
    conditions: [{ id: 'cart_contains', filter: { productIds: [productId] }, minQuantity: 1 }],
    reward: { kind: 'dollar_off_cart', amountCents },
  };
}
