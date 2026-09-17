/* shared/hw-safe-area.js — window.HWSafe.top/bottom/left/right(n).
 *
 * Plain JS, classic <script> (no modules, no DOM needed) — loaded into a bare
 * `vm` context the same way test/harness.mjs loads shared/commerce-adapter.js,
 * so this runs under `node --test` with no browser and no build step.
 *
 * What actually matters here: a fixed px pad is right in the framed desktop
 * preview (mobile/ios-frame.jsx draws the device chrome, no real OS inset
 * exists) and wrong on an actual phone, where mobile/app.jsx's ≤600px
 * breakpoint drops the frame and the real notch/home-indicator inset has to be
 * added on top. That's the one behaviour worth locking down: the output is a
 * calc() that keeps the base px AND folds in env(safe-area-inset-*, 0px), so
 * it degrades to the old fixed value when a browser doesn't support env().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'shared', 'hw-safe-area.js');

function loadHWSafe() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'shared/hw-safe-area.js' });
  return sandbox.window.HWSafe;
}

test('window.HWSafe is defined with all four edges as functions', () => {
  const HWSafe = loadHWSafe();
  assert.ok(HWSafe, 'window.HWSafe must exist after the script runs');
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    assert.equal(typeof HWSafe[edge], 'function', `HWSafe.${edge} must be a function`);
  }
});

test('HWSafe.top(52) keeps the base px and adds the top inset, defaulting to 0', () => {
  const HWSafe = loadHWSafe();
  const out = HWSafe.top(52);
  assert.match(out, /^calc\(/, 'must be a calc() expression, not a bare px value');
  assert.match(out, /52px/, 'must preserve the original fixed pad so the framed preview is unchanged');
  assert.match(out, /env\(safe-area-inset-top,\s*0px\)/, 'must read the TOP inset specifically');
});

test('HWSafe.bottom(34) reads the bottom inset, not top', () => {
  const HWSafe = loadHWSafe();
  const out = HWSafe.bottom(34);
  assert.match(out, /34px/);
  assert.match(out, /env\(safe-area-inset-bottom,\s*0px\)/);
  assert.doesNotMatch(out, /safe-area-inset-top/, 'bottom() must not read the top inset');
});

test('left/right map to their own edges and stay distinct from top/bottom', () => {
  const HWSafe = loadHWSafe();
  assert.match(HWSafe.left(10), /env\(safe-area-inset-left,\s*0px\)/);
  assert.match(HWSafe.right(20), /env\(safe-area-inset-right,\s*0px\)/);
  assert.notEqual(HWSafe.left(10), HWSafe.right(10));
});

test('the four edges are independent calls — one does not leak state into another', () => {
  const HWSafe = loadHWSafe();
  const a = HWSafe.top(52);
  HWSafe.bottom(34);
  HWSafe.left(1);
  const b = HWSafe.top(52);
  assert.equal(a, b, 'calling other edges must not change what top(52) returns');
});

test('a numeric 0 pad still produces a valid calc(), not "calc(0px + …)" collapsing to a broken string', () => {
  const HWSafe = loadHWSafe();
  const out = HWSafe.bottom(0);
  assert.match(out, /^calc\(0px \+ env\(safe-area-inset-bottom, 0px\)\)$/);
});
