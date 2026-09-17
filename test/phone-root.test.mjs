/* shared/hw-phone.js — window.HWPhone.isPhone() / .isScanRoute() / .QUERY.
 *
 * Plain JS, classic <script> (no modules, no DOM needed) — loaded into a bare
 * `vm` context the same way test/hw-safe-area.test.mjs loads
 * shared/hw-safe-area.js, so this runs under `node --test` with no browser
 * and no build step.
 *
 * `useIsPhone()` itself (the React hook mobile/app.jsx, athome/account-frame.jsx
 * and pipeline/app.jsx all now call) isn't tested here — it needs a real React
 * render to exercise the lazy-init + matchMedia listener wiring, which is a
 * browser-shaped test, not a unit one. What IS a pure, worth-testing unit is
 * the ≤600px predicate itself (`isPhone`, given a matchMedia) and the /scan
 * route predicate (`isScanRoute`) both of these apps' renders and this file's
 * tests need to agree on — this is the point of pulling both out of three
 * copies (mobile/app.jsx's original `useIsPhone`, and the two duplicates that
 * would otherwise have been hand-written for account-frame.jsx and
 * pipeline/app.jsx) into the one module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'shared', 'hw-phone.js');

// window.HWPhone.useIsPhone calls React.useState/useEffect at module-load
// time only inside the hook body (not eagerly), so a bare sandbox with no
// React global is fine for loading the module and exercising the pure
// exports — React is only touched if useIsPhone() itself is called, which
// none of these tests do.
function loadHWPhone() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'shared/hw-phone.js' });
  return sandbox.window.HWPhone;
}

function fakeMatchMedia(matches) {
  return () => ({ matches });
}

test('window.HWPhone is defined with isPhone/isScanRoute/useIsPhone as functions and QUERY as a string', () => {
  const HWPhone = loadHWPhone();
  assert.ok(HWPhone, 'window.HWPhone must exist after the script runs');
  assert.equal(typeof HWPhone.isPhone, 'function');
  assert.equal(typeof HWPhone.isScanRoute, 'function');
  assert.equal(typeof HWPhone.useIsPhone, 'function');
  assert.equal(typeof HWPhone.QUERY, 'string');
});

test('isPhone(matchMedia) is true when the ≤600px query matches', () => {
  const HWPhone = loadHWPhone();
  assert.equal(HWPhone.isPhone(fakeMatchMedia(true)), true);
});

test('isPhone(matchMedia) is false when the query does not match — the wide/framed-preview case', () => {
  const HWPhone = loadHWPhone();
  assert.equal(HWPhone.isPhone(fakeMatchMedia(false)), false);
});

test('isPhone() degrades to false, not a throw, when matchMedia is missing or throws', () => {
  const HWPhone = loadHWPhone();
  assert.equal(HWPhone.isPhone(undefined), false, 'no matchMedia at all (e.g. a non-browser context)');
  assert.equal(HWPhone.isPhone(() => { throw new Error('nope'); }), false, 'a matchMedia that throws');
});

test('isScanRoute recognizes both a bare path and a hash route, with or without a query string', () => {
  const HWPhone = loadHWPhone();
  assert.equal(HWPhone.isScanRoute('/scan'), true);
  assert.equal(HWPhone.isScanRoute('scan'), true);
  assert.equal(HWPhone.isScanRoute('#/scan'), true);
  assert.equal(HWPhone.isScanRoute('#/scan?lot=42'), true);
  assert.equal(HWPhone.isScanRoute('/scan?lot=42'), true);
});

test('isScanRoute rejects other routes and empty input — a batches/compliance/etc. route never counts as scan', () => {
  const HWPhone = loadHWPhone();
  assert.equal(HWPhone.isScanRoute('/batches'), false);
  assert.equal(HWPhone.isScanRoute('#/compliance/holds'), false);
  assert.equal(HWPhone.isScanRoute('/scanner'), false, 'must not fuzzy-match a route that merely starts with "scan"');
  assert.equal(HWPhone.isScanRoute(''), false);
  assert.equal(HWPhone.isScanRoute(undefined), false);
});

test('QUERY is the same ≤600px breakpoint mobile/app.jsx used before the extraction', () => {
  const HWPhone = loadHWPhone();
  assert.equal(HWPhone.QUERY, '(max-width: 600px)');
});
