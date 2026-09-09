/* ── Pinning the "byte-identical" promise before four money-string sites route
 * through window.HD.formatCents ──────────────────────────────────────────────
 *
 * shared/hd-format.jsx (window.HD.formatCents/formatCurrency) is the ONE money
 * formatter this estate is consolidating onto (BUILD-AGAINST-THE-SOURCE.md §3,
 * docs/codebase-audit/gaps/pos-and-shared.md §2). Four other sites build a
 * "$X.XX" string on their own:
 *
 *   A. shared/hw-live-lines.js:365      money(v)      — dollars in
 *   B. shared/commerce-governance.js:51 money fallback — CENTS in
 *   C. shared/demo-seed.js:159          weedmapsOrder() message — dollars in
 *   D. shared/demo-seed.js:211          product() message       — dollars in
 *
 * Each becomes a call to window.HD.formatCents when it has loaded, with its
 * CURRENT body kept as the fallback for when it has not. This test exists to
 * prove that swap is byte-identical for the values each site actually formats
 * today, for 3 representative values per site — BEFORE the source is touched
 * (this file is written and run once against the pre-change sources, then
 * re-run after the edit as a regression pin) — the same discipline
 * test/harness.mjs applies to shared/commerce-adapter.js: no jsdom, evaluate
 * the real thing under `vm`, and fail loudly rather than silently if the
 * source this test anchors on has moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Real window.HD, loaded exactly as the browser would load the file. */
function loadHD() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared', 'hd-format.jsx'), 'utf8'), ctx,
    { filename: 'shared/hd-format.jsx' });
  return sandbox.HD;
}

/** The exact substring must still be in the file, or the anchor has drifted —
 *  fail loudly (same philosophy as harness.mjs's replaceOnce) rather than
 *  silently characterizing code that no longer exists. */
function mustContain(file, needle) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(src.includes(needle), `${file} no longer contains the anchored text:\n${needle}`);
}

const HD = loadHD();

test('HD.formatCents/formatCurrency loaded for real from shared/hd-format.jsx', () => {
  assert.equal(typeof HD.formatCents, 'function');
  assert.equal(typeof HD.formatCurrency, 'function');
});

// ── A. shared/hw-live-lines.js:365 — money(v), DOLLARS in ───────────────────
// Now delegates to window.HD.formatCents when it has loaded; '$' + n.toFixed(2)
// is the fallback for when it has not. Both paths must agree for these values.
test('A. hw-live-lines.js money(v): the HD path and the no-HD fallback agree', () => {
  mustContain('shared/hw-live-lines.js', 'if (W.HD && typeof W.HD.formatCents === \'function\') { return W.HD.formatCents(Math.round(n * 100)); }');
  mustContain('shared/hw-live-lines.js', "return '$' + n.toFixed(2);");
  const fallbackBody = (v) => {
    const n = Number(v);
    return '$' + n.toFixed(2);
  };
  for (const v of [12.5, 37.99, 0]) {
    assert.equal(HD.formatCents(Math.round(v * 100)), fallbackBody(v), `$${v} must format identically on both paths`);
  }
});

// ── B. shared/commerce-governance.js:51 — money fallback, CENTS in ──────────
test('B. commerce-governance.js money fallback: HD.formatCents and the last-resort arrow agree', () => {
  mustContain('shared/commerce-governance.js', 'window.HD.formatCents');
  mustContain('shared/commerce-governance.js',
    "(c) => (c < 0 ? '-' : '') + '$' + (Math.abs(Math.round(c)) / 100).toFixed(2)");
  const lastResort = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(Math.round(c)) / 100).toFixed(2);
  for (const c of [500, -250, 12995]) {
    assert.equal(HD.formatCents(c), lastResort(c), `${c} cents must format identically on both paths`);
  }
});

// ── C. shared/demo-seed.js:159 — weedmapsOrder() message, DOLLARS in ────────
test('C. demo-seed.js weedmapsOrder() total: fmtDollars() routes through HD.formatCents, byte-identical to the old inline build', () => {
  mustContain('shared/demo-seed.js', "message: id + ' · ' + name + ' · ' + fmtDollars(total) + ' (' + preset.label + ')',");
  mustContain('shared/demo-seed.js', "? window.HD.formatCents(Math.round(n * 100))\n      : '$' + n.toFixed(2);");
  for (const total of [84, 12.5, 128.75]) {
    assert.equal(HD.formatCents(Math.round(total * 100)), '$' + total.toFixed(2), `$${total} must format identically`);
  }
});

// ── D. shared/demo-seed.js:211 — product() message, DOLLARS in ─────────────
test('D. demo-seed.js product() price: fmtDollars() routes through HD.formatCents, byte-identical to the old inline build', () => {
  mustContain('shared/demo-seed.js',
    "message: name + ' · ' + brand + ' · ' + cat + ' · ' + fmtDollars(price) + ' · ' + p.qty + ' in stock',");
  for (const price of [42, 19.99, 60]) {
    assert.equal(HD.formatCents(Math.round(price * 100)), '$' + price.toFixed(2), `$${price} must format identically`);
  }
});
