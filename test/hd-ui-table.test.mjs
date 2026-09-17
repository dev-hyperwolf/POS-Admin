/* ── shared/hd-ui.jsx under node ──────────────────────────────────────────
 *
 * Same harness shape as test/hd-form.test.mjs: hd-ui.jsx is a classic
 * `<script type="text/babel">` IIFE with one global (`window.HDTable` etc.),
 * loaded into a `vm` context whose global IS `window`, through the same JSX
 * transform the browser runs. hd-ui.jsx has no HWContracts dependency, so no
 * contracts/index.js load is needed here.
 *
 * This file only exercises the two PURE static helpers HDTable exposes for
 * testing (`_minWidthForCols`, `_shouldStack`) — MOBILE-READINESS-AUDIT-
 * 2026-09-17 §3 shared fix #1. Neither needs React to run, so the sandbox
 * never has to provide a React global; the component itself (which DOES use
 * React.createElement/Children/useState/useEffect via JSX) is never invoked
 * here, exactly like hd-form.test.mjs never calls render().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HD_UI = path.join(ROOT, 'shared', 'hd-ui.jsx');

function babelOptions(filename) {
  return {
    filename,
    presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    sourceMaps: false,
    targets: { browsers: undefined },
  };
}

function loadWindow() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const src = fs.readFileSync(HD_UI, 'utf8');
  const out = Babel.transform(src, babelOptions('shared/hd-ui.jsx')).code;
  vm.runInContext(out, ctx, { filename: 'shared/hd-ui.jsx' });
  if (!sandbox.HDTable) throw new Error('hd-ui-table.test: window.HDTable did not load');
  return sandbox.HDTable;
}

const HDTable = loadWindow();

// ── _minWidthForCols ────────────────────────────────────────────────────────

test('_minWidthForCols: zero/negative/missing column counts fall back to the 480px default floor', () => {
  assert.equal(HDTable._minWidthForCols(0), 480);
  assert.equal(HDTable._minWidthForCols(-1), 480);
  assert.equal(HDTable._minWidthForCols(null), 480);
  assert.equal(HDTable._minWidthForCols(undefined), 480);
});

test('_minWidthForCols: a 1-column table still floors at 480 (120*1+40=160 < floor)', () => {
  assert.equal(HDTable._minWidthForCols(1), 480);
});

test('_minWidthForCols: mid-range column counts follow cols*120+40 with no clamping', () => {
  assert.equal(HDTable._minWidthForCols(4), 520);
  assert.equal(HDTable._minWidthForCols(6), 760);
  assert.equal(HDTable._minWidthForCols(10), 1240);
});

test('_minWidthForCols: 13 columns lands exactly at the 1600px cap', () => {
  assert.equal(HDTable._minWidthForCols(13), 1600);
});

test('_minWidthForCols: 14+ columns is clamped to the 1600px cap, never grows unbounded', () => {
  assert.equal(HDTable._minWidthForCols(14), 1600);
  assert.equal(HDTable._minWidthForCols(50), 1600);
});

// ── _shouldStack ─────────────────────────────────────────────────────────────

test('_shouldStack: container narrower than stackBelow -> stack', () => {
  assert.equal(HDTable._shouldStack(300, 600), true);
});

test('_shouldStack: container wider than stackBelow -> scroll, not stack', () => {
  assert.equal(HDTable._shouldStack(700, 600), false);
});

test('_shouldStack: exactly at the threshold -> scroll, not stack (strict less-than)', () => {
  assert.equal(HDTable._shouldStack(600, 600), false);
});

test('_shouldStack: stackBelow falsy (0/undefined/null) disables stacking entirely', () => {
  assert.equal(HDTable._shouldStack(300, 0), false);
  assert.equal(HDTable._shouldStack(300, undefined), false);
  assert.equal(HDTable._shouldStack(300, null), false);
});

test('_shouldStack: an invalid measured width (0, negative, NaN) never stacks', () => {
  assert.equal(HDTable._shouldStack(0, 600), false);
  assert.equal(HDTable._shouldStack(-10, 600), false);
  assert.equal(HDTable._shouldStack(NaN, 600), false);
});
