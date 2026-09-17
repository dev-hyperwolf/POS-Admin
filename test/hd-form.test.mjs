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
  _sandboxWindow = sandbox;
  return sandbox.HDForm;
}

let _sandboxWindow = null;
function getSandboxWindow() { return _sandboxWindow; }
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

test('autosave: false never reads, writes or clears the draft key; default still does', () => {
  // FormView needs React to mount, so the seam itself is exercised: the three draft helpers
  // FormView calls (load on init, save on change, clear on submit) with the opt-out flag.
  const def = { id: 'onb_ack_sign', slug: 'onb_ack_sign', fields: [
    { key: 'signatureImage', type: 'signature', required: true },
    { key: 'typedName', type: 'text', required: true },
  ]};
  const calls = [];
  const store = new Map();
  const win = getSandboxWindow();
  win.localStorage = {
    getItem: (k) => { calls.push(['get', k]); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { calls.push(['set', k]); store.set(k, v); },
    removeItem: (k) => { calls.push(['rm', k]); store.delete(k); },
  };
  const key = HDForm._drafts.key(def);
  store.set(key, JSON.stringify({ typedName: 'stale', signatureImage: 'data:image/png;base64,AAAA' }));

  // opt-out: no access of any kind, and a pre-existing draft is neither returned nor removed
  assert.equal(HDForm._drafts.load(def, false), null);
  HDForm._drafts.save(def, { typedName: 'Alice', signatureImage: 'data:image/png;base64,BBBB' }, false);
  HDForm._drafts.clear(def, false);
  assert.deepEqual(calls, [], 'autosave:false must not touch localStorage at all');
  assert.equal(store.get(key).includes('stale'), true, 'existing draft untouched');

  // default (undefined / true): reads, writes and clears exactly as before
  assert.equal(plain(HDForm._drafts.load(def)).typedName, 'stale');
  HDForm._drafts.save(def, { typedName: 'Alice' });
  assert.equal(JSON.parse(store.get(key)).typedName, 'Alice');
  HDForm._drafts.clear(def, true);
  assert.equal(store.has(key), false);
  assert.deepEqual(calls.map(c => c[0]), ['get', 'set', 'rm']);
  delete win.localStorage;
});

test('FormView threads the autosave flag into every draft helper call (source check)', () => {
  const src = fs.readFileSync(HD_FORM, 'utf8');
  const body = src.slice(src.indexOf('function FormView('), src.indexOf('window.HDForm = {'));
  assert.match(body, /var autosave = opts\.autosave !== false/);
  for (const fn of ['loadDraft', 'saveDraft', 'clearDraft']) {
    const uses = body.match(new RegExp(fn + '\\(', 'g')) || [];
    assert.ok(uses.length >= 1, fn + ' is called from FormView');
    const bare = body.match(new RegExp(fn + '\\([^)]*\\)', 'g')).filter(c => !/autosave\)$/.test(c));
    assert.deepEqual(bare, [], fn + ' called without the autosave flag: ' + bare.join(' | '));
  }
  const sign = fs.readFileSync(path.join(ROOT, 'shared', 'hw-sign-page.jsx'), 'utf8');
  assert.match(sign, /autosave:\s*false/, 'signing page opts out of draft autosave');
});

// ── Idempotency-Key (wmdemo forms server, FIX 3, 2026-09-17) ───────────────────────────────

test('genIdemKey returns a fresh, server-acceptable key every call', () => {
  const { genIdemKey } = HDForm._submit;
  const a = genIdemKey();
  const b = genIdemKey();
  assert.match(a, /^[A-Za-z0-9_-]{8,128}$/, 'must satisfy the server\'s own IDEMPOTENCY_KEY_RE');
  assert.match(b, /^[A-Za-z0-9_-]{8,128}$/);
  assert.notEqual(a, b, 'two calls must not collide');
});

test('defaultSubmit sends the Idempotency-Key header when given one, and omits it otherwise', async () => {
  const win = getSandboxWindow();
  const calls = [];
  win.fetch = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({ submission: { id: 1 } }),
    });
  };
  try {
    const { defaultSubmit } = HDForm._submit;
    const withKey = await defaultSubmit({ id: 'writeup' }, { employeeId: 'e1' }, null, 'test-idem-key-0001');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.headers['Idempotency-Key'], 'test-idem-key-0001');
    assert.equal(withKey.ok, true);
    assert.equal(withKey.body.submission.id, 1);

    const withoutKey = await defaultSubmit({ id: 'writeup' }, { employeeId: 'e1' }, null);
    assert.equal(calls.length, 2);
    assert.equal('Idempotency-Key' in calls[1].opts.headers, false,
      'no key given -> no header sent, exactly the pre-FIX-3 request shape');
    assert.equal(withoutKey.ok, true);
  } finally {
    delete win.fetch;
  }
});

// ── _inputAttrs (MOBILE-READINESS-AUDIT-2026-09-17 §3 shared fix #2) ───────

// `plain()` (defined above, next to its doc comment) crosses the vm realm
// boundary — a plain object built inside the vm sandbox has a different
// Object prototype than Node's, so a bare assert.deepEqual would fail
// "same structure but not reference-equal" even for genuinely identical output.

test('_inputAttrs: money always gets a decimal keypad, never touching validation', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'money' })), { inputMode: 'decimal', autoComplete: 'off', enterKeyHint: 'done' });
});

test('_inputAttrs: number gets a numeric keypad by default', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'number' })), { inputMode: 'numeric', autoComplete: 'off', enterKeyHint: 'done' });
});

test('_inputAttrs: number ignores an unrecognized format and still gets a numeric keypad', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'number', format: 'quantity' })), { inputMode: 'numeric', autoComplete: 'off', enterKeyHint: 'done' });
});

test('_inputAttrs: plain text with no format is untouched (byte-identical to pre-fix behavior)', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text' })), {});
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'textarea' })), {});
});

test('_inputAttrs: text format phone gets type=tel and a tel autofill', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text', format: 'phone' })), { type: 'tel', inputMode: 'tel', autoComplete: 'tel', enterKeyHint: 'done' });
});

test('_inputAttrs: text format email gets type=email and autoCapitalize off', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text', format: 'email' })),
    { type: 'email', inputMode: 'email', autoComplete: 'email', autoCapitalize: 'off', enterKeyHint: 'done' });
});

test('_inputAttrs: text format zip gets a numeric keypad and postal-code autofill', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text', format: 'zip' })), { type: 'text', inputMode: 'numeric', autoComplete: 'postal-code', enterKeyHint: 'done' });
});

test('_inputAttrs: text format pin with oneTimeCode true gets autoComplete=one-time-code', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text', format: 'pin', oneTimeCode: true })),
    { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', enterKeyHint: 'done' });
});

test('_inputAttrs: text format pin WITHOUT oneTimeCode defaults autoComplete=off (a permanent PIN, not a delivered code)', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text', format: 'pin' })),
    { type: 'text', inputMode: 'numeric', autoComplete: 'off', enterKeyHint: 'done' });
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'text', format: 'pin', oneTimeCode: false })),
    { type: 'text', inputMode: 'numeric', autoComplete: 'off', enterKeyHint: 'done' });
});

test('_inputAttrs: date/time/datetime map to the matching native input type, no forced inputMode', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'date' })), { type: 'date', autoComplete: 'off' });
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'time' })), { type: 'time', autoComplete: 'off' });
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'datetime' })), { type: 'datetime-local', autoComplete: 'off' });
});

test('_inputAttrs: an unrecognized/unsupported type (select, person, pin_required, undefined) returns {} — never invents a backend contract', () => {
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'select' })), {});
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'person' })), {});
  assert.deepEqual(plain(HDForm._inputAttrs({ type: 'pin_required' })), {});
  assert.deepEqual(plain(HDForm._inputAttrs(undefined)), {});
  assert.deepEqual(plain(HDForm._inputAttrs({})), {});
});

test('FormView generates one Idempotency-Key per instance and threads it into every submit (source check)', () => {
  const src = fs.readFileSync(HD_FORM, 'utf8');
  const body = src.slice(src.indexOf('function FormView('), src.indexOf('window.HDForm = {'));
  assert.match(body, /idemKeyRef\.current === null\) idemKeyRef\.current = genIdemKey\(\)/,
    'the key is generated once (lazy useRef init), never on every render');
  assert.match(body, /defaultSubmit\(definition, payload, opts\.station, idemKeyRef\.current\)/);
  assert.match(body, /idempotency_key:\s*idemKeyRef\.current/,
    'a caller-supplied onSubmit also receives the same key, so it can opt in too');
});
