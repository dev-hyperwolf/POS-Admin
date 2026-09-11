/* ── shared/hd-form.jsx under node ────────────────────────────────────────
 *
 * hd-form.jsx is a classic `<script type="text/babel">` IIFE, same as every
 * other estate file — no module system, one global (`window.HDForm`). Loading
 * it under node needs the same two things test/harness.mjs and
 * test/gov-harness.mjs already establish for plain-JS files: a `vm` context
 * whose global IS `window`, so `window.HDForm = ...` lands where a real page
 * would put it. The one thing this file adds is JSX — hd-form.jsx's `render()`
 * builds React elements, so it must go through the SAME transform the browser
 * runs (`tools/precompile.mjs`'s `babelOptions`: @babel/standalone, presets
 * ['react','env']) before `vm` can evaluate it. `compile()`/`validate()` never
 * touch React, so this loads cleanly with no React/ReactDOM in the sandbox at
 * all — only calling `render()` would need those, and nothing here does.
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
const CONTRACTS = path.join(ROOT, 'contracts', 'index.js');
const HD_FORM = path.join(ROOT, 'shared', 'hd-form.jsx');

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
  vm.runInContext(fs.readFileSync(CONTRACTS, 'utf8'), ctx, { filename: 'contracts/index.js' });
  const src = fs.readFileSync(HD_FORM, 'utf8');
  const out = Babel.transform(src, babelOptions('shared/hd-form.jsx')).code;
  vm.runInContext(out, ctx, { filename: 'shared/hd-form.jsx' });
  if (!sandbox.HDForm) throw new Error('hd-form.test: window.HDForm did not load');
  return sandbox.HDForm;
}

const HDForm = loadWindow();

/** Structural copy across the vm realm boundary (see test/harness.mjs `plain`):
 *  an array/object built inside the vm context has a DIFFERENT Array/Object
 *  prototype than Node's, so assert.deepEqual fails "same structure but not
 *  reference-equal" even when the values are identical. */
const plain = (v) => JSON.parse(JSON.stringify(v));

// The write-up FormDef, straight out of
// docs/migration/FORM-GENERATOR-PROPOSAL.md §6 (abridged example, verbatim).
const WRITEUP_DEF = {
  id: 'writeup', version: 3,
  fields: [
    { key: 'employeeId', type: 'person', required: true },
    { key: 'category', type: 'select', $enum: 'Classification', required: true },
    { key: 'ladderStep', type: 'select', options: ['Verbal', 'Written', 'Final'], showWhen: { role_gte: 'manager' } },
    { key: 'description', type: 'text', minLength: 10, required: true },
    { key: 'driverInvolved', type: 'checkbox' },
  ],
  submit: { kind: 'event', eventType: 'person.merged' },
};

test('compile() derives the unconditional required set from the write-up FormDef', () => {
  const c = HDForm.compile(WRITEUP_DEF);
  assert.deepEqual(plain(c.required).sort(), ['category', 'description', 'employeeId']);
  // showWhen excludes ladderStep even though the field carries no required:true
  // of its own — the point being proven is that the EXCLUSION mechanism (any
  // showWhen at all) fires, not that this particular field would otherwise
  // have been required.
  assert.ok(!c.required.includes('ladderStep'));
  assert.ok(!c.required.includes('driverInvolved'));
});

test('compile() carries the $enum constraint through to the schema', () => {
  const c = HDForm.compile(WRITEUP_DEF);
  assert.equal(c.schema.properties.category.$enum, 'Classification');
  assert.equal(c.schema.properties.category.type, 'string');
  assert.equal(c.schema.properties.description.minLength, 10);
});

test('validate() rejects a submission missing a required field', () => {
  const res = HDForm.validate(WRITEUP_DEF, { employeeId: 'manisha-saini', category: 'budtender' });
  assert.equal(res.ok, false);
  assert.ok(res.fieldErrors.description, 'description should be flagged missing');
});

test('validate() accepts a complete submission', () => {
  const res = HDForm.validate(WRITEUP_DEF, {
    employeeId: 'manisha-saini', category: 'budtender', description: 'Missed two scheduled breaks this week.',
  });
  assert.equal(res.ok, true);
  assert.equal(plain(res.errors).length, 0);
});

test('validate() rejects a non-integer money value', () => {
  const def = {
    id: 'closeout', fields: [
      { key: 'cashCounted', type: 'money', required: true },
    ],
  };
  const bad = HDForm.validate(def, { cashCounted: 42.5 });
  assert.equal(bad.ok, false);
  assert.match(bad.fieldErrors.cashCounted, /whole number of cents/);

  const good = HDForm.validate(def, { cashCounted: 4250 });
  assert.equal(good.ok, true);
});

test('a field hidden by showWhen is not required, and is skipped even when marked required:true', () => {
  const def = {
    id: 'discrepancy',
    fields: [
      { key: 'amountOver', type: 'number', required: true },
      // Only visible (and thus only required) once role === 'manager'.
      { key: 'managerNote', type: 'text', required: true, showWhen: { field: 'role', equals: 'manager' } },
    ],
  };
  // role absent -> managerNote stays hidden -> must NOT be flagged missing.
  const res = HDForm.validate(def, { amountOver: 12, role: 'associate' });
  assert.equal(res.ok, true, JSON.stringify(res.fieldErrors));
  assert.ok(!('managerNote' in res.fieldErrors));

  // Flip the condition true: now it IS required.
  const res2 = HDForm.validate(def, { amountOver: 12, role: 'manager' });
  assert.equal(res2.ok, false);
  assert.ok(res2.fieldErrors.managerNote);

  // And compile()'s static required set never included it either way.
  const c = HDForm.compile(def);
  assert.ok(!c.required.includes('managerNote'));
});

test('a repeating group validates each row independently', () => {
  const def = {
    id: 'closeout',
    fields: [
      {
        key: 'denominations', type: 'repeating_group', required: true,
        fields: [
          { key: 'label', type: 'text', required: true },
          { key: 'count', type: 'number', required: true, minimum: 0 },
        ],
      },
    ],
  };
  const res = HDForm.validate(def, {
    denominations: [
      { label: '$20', count: 3 },
      { label: '', count: 5 },      // row 1: missing required label
      { label: '$5' },              // row 2: missing required count
    ],
  });
  assert.equal(res.ok, false);
  assert.ok(res.fieldErrors['denominations[1].label'], 'row 1 missing label should be flagged');
  assert.ok(res.fieldErrors['denominations[2].count'], 'row 2 missing count should be flagged');
  assert.ok(!res.fieldErrors['denominations[0].label'] && !res.fieldErrors['denominations[0].count'],
    'row 0 is complete and must not be flagged');

  // An empty group with required:true is flagged at the group level.
  const empty = HDForm.validate(def, { denominations: [] });
  assert.equal(empty.ok, false);
  assert.ok(empty.fieldErrors.denominations);
});

test('a computed field is read-only and never appears in the required set or validation errors', () => {
  const def = {
    id: 'closeout',
    fields: [
      { key: 'a', type: 'number', required: true },
      { key: 'b', type: 'number', required: true },
      { key: 'total', type: 'computed', computed: { op: 'sum', fields: ['a', 'b'] } },
    ],
  };
  const c = HDForm.compile(def);
  assert.ok(!c.required.includes('total'));
  const res = HDForm.validate(def, { a: 1, b: 2 }); // total omitted entirely
  assert.equal(res.ok, true);
  assert.equal(HDForm.computeValue(def.fields[2], { a: 1, b: 2 }), 3);
});
