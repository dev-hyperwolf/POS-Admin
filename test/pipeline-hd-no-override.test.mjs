/* pipeline/domain.jsx used to Object.assign OVER window.HD (formatCurrency,
 * formatNumber, formatPercent, formatDate, formatDateTime, relativeTime — all
 * with different implementations than shared/hd-format.jsx), even though
 * hd-format.jsx's own header comment claims "domain.jsx ... does not redefine
 * anything below." Any other app sharing window.HD (Engage) would silently get
 * pipeline's formatting the moment domain.jsx loaded after it on the same page
 * — e.g. formatDateTime dropped hd-format's timeZoneName, and relativeTime read
 * window.HD_DATA.NOW instead of window.ENGAGE_DATA.NOW.
 *
 * The fix: pipeline keeps its OWN namespaced window.HD_PIPE; window.HD is left
 * untouched. This test loads exactly the two scripts named in hd-format.jsx's
 * comment, in the order the real pages load them, under `vm` with no DOM (the
 * same technique test/harness.mjs uses for shared/commerce-adapter.js) and
 * proves window.HD is still hd-format's — not domain.jsx's — after domain.jsx
 * has loaded on top of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadWindow() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/hd-format.jsx'), 'utf8'), ctx, { filename: 'shared/hd-format.jsx' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'pipeline/domain.jsx'), 'utf8'), ctx, { filename: 'pipeline/domain.jsx' });
  return sandbox;
}

test('pipeline/domain.jsx does not override window.HD after loading on top of shared/hd-format.jsx', () => {
  const w = loadWindow();

  // window.HD must be exactly what hd-format.jsx built: same formatDateTime
  // (no timeZoneName dropped), same relativeTime (reads ENGAGE_DATA, not
  // HD_DATA), same ENTITIES (hd-format's names, not domain's).
  const iso = '2026-03-01T20:00:00Z';
  assert.equal(w.HD.formatDateTime(iso), new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    'window.HD.formatDateTime must still be hd-format\'s implementation');
  assert.equal(w.HD.ENTITIES.find((e) => e.id === 'thc').name, 'THC Flower Manufacturing',
    'window.HD.ENTITIES must still be hd-format\'s (not domain.jsx\'s "The Highest Craft")');
  assert.equal(typeof w.HD.formatCents, 'function', 'hd-format\'s formatCents must survive untouched');

  // domain.jsx's own extensions live on window.HD_PIPE, namespaced, not window.HD.
  assert.equal(typeof w.HD_PIPE, 'object', 'pipeline must expose its own window.HD_PIPE');
  assert.equal(w.HD_PIPE.ENTITIES.find((e) => e.id === 'thc').name, 'The Highest Craft',
    'window.HD_PIPE keeps domain.jsx\'s own ENTITIES');
  assert.ok(Array.isArray(w.HD_PIPE.BATCH_STATUS_ORDER) && w.HD_PIPE.BATCH_STATUS_ORDER.length === 10,
    'window.HD_PIPE carries the pipeline-only fields (BATCH_STATUS_ORDER, etc.)');
  assert.equal(w.HD.BATCH_STATUS_ORDER, undefined, 'window.HD must not carry pipeline-only fields');

  // Contracts was not loaded in this vm — BATCH_STATUS_ORDER must fall back to
  // its literal, and that literal must still equal the contract (drift is
  // pinned separately by test/contracts.test.mjs).
  // JSON round-trip: the array was built inside the vm realm, so it has a
  // different Array.prototype than this file's — deepEqual would otherwise
  // report "same structure but not reference-equal" for a non-defect.
  assert.deepEqual(JSON.parse(JSON.stringify(w.HD_PIPE.BATCH_STATUS_ORDER)),
    ['incoming', 'received', 'labeling', 'sealing', 'shelf_ready', 'merchandised', 'approved', 'quarantined', 'recalled', 'destroyed']);
});
