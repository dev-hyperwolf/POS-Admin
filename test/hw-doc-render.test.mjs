/* shared/hw-doc-render.js — the browser-load leak, and the doc-cases fixture.
 *
 * shared/hw-doc-render.js and wm-demo/wmdemo/engage/documents.py are ONE rule
 * set, two implementations (POS-Admin/docs/ENGAGE-BUILD-CONTRACT.md §2,
 * ENGAGE-PLAN-2026-09-10.md §2 "One block builder"). This file only proves
 * the JS side against the shared fixture; qa/engage_documents_probe.py
 * proves the Python side against the SAME file. Parity is "both are green",
 * not anything this file checks directly — same posture as
 * test/hw-naming.test.mjs, including the same degrade-to-skip when the
 * sibling wm-demo checkout is not present.
 *
 * Loaded via `vm`, same reason as hw-naming.test.mjs: POS-Admin's
 * package.json says "type": "module", so a plain require() of a script
 * written for real browser <script src> loading would not behave the same
 * way `vm` + a `window` sandbox does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'shared', 'hw-doc-render.js');
const FIXTURE = '/Users/jt/wm-demo/qa/fixtures/engage/doc-cases.json';

function loadBrowser() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: 'shared/hw-doc-render.js' });
  return sandbox;
}

test('browser load leaks exactly one global, HW_DOC, with the surface the contract promises', () => {
  const w = loadBrowser();
  const leaked = Object.keys(w).filter((k) => !['console', 'window', 'self'].includes(k));
  assert.deepEqual(leaked, ['HW_DOC']);
  const D = w.HW_DOC;
  assert.deepEqual(Object.keys(D).sort(),
    ['ALLOWED_MERGE_TAGS', 'BLOCK_TYPES', 'mergeTags', 'render', 'renderText', 'validate', 'validateDoc'].sort());
  assert.equal(typeof D.render, 'function');
  assert.equal(typeof D.renderText, 'function');
  assert.equal(typeof D.validateDoc, 'function');
  assert.equal(typeof D.validate, 'function');
  assert.equal(typeof D.mergeTags, 'function');
});

test('module.exports mirrors window.HW_DOC (the Node half of the file actually works)', () => {
  const w = loadBrowser();
  const sandbox = { console, module: { exports: {} } };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: 'shared/hw-doc-render.js' });
  assert.deepEqual(Object.keys(sandbox.module.exports).sort(), Object.keys(w.HW_DOC).sort());
});

test('BLOCK_TYPES is the exact 12, ALLOWED_MERGE_TAGS is the exact 5', () => {
  const D = loadBrowser().HW_DOC;
  // D.BLOCK_TYPES is an Array from the vm realm, not this one — spread it
  // into a plain Array first, same fix hw-naming.test.mjs uses for
  // validateTemplate's return value, or deepEqual fails on prototype
  // identity alone even though every value matches.
  assert.deepEqual([...D.BLOCK_TYPES], [
    'heading', 'text', 'image', 'button', 'divider', 'spacer', 'columns',
    'product_card', 'reward_card', 'points_balance', 'legal_footer', 'gate',
  ]);
  assert.equal(D.BLOCK_TYPES.length, 12);
  assert.deepEqual([...D.ALLOWED_MERGE_TAGS].sort(),
    ['first_name', 'link', 'points_balance', 'reward_name', 'store_name']);
});

function manyBlocksDoc(count) {
  const blocks = [];
  for (let i = 0; i < count; i++) { blocks.push({ id: 'b' + i, type: 'text', props: { text: 'block ' + i } }); }
  return { version: 1, kind: 'email', blocks };
}

function materializeDoc(c) {
  if ('doc' in c) { return c.doc; }
  if (c.doc_generator && c.doc_generator.kind === 'many_blocks') { return manyBlocksDoc(c.doc_generator.count); }
  throw new Error('case ' + c.id + ' has neither doc nor a recognised doc_generator');
}

const hasFixture = fs.existsSync(FIXTURE);

test('doc-cases.json: every fixture case passes under the JS engine',
  { skip: !hasFixture && 'wm-demo fixture not found at ' + FIXTURE }, () => {
    const D = loadBrowser().HW_DOC;
    const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).cases;
    assert.ok(cases.length >= 20, 'fixture must carry at least 20 cases, has ' + cases.length);
    const failures = [];

    for (const c of cases) {
      try {
        if (c.op === 'validate') {
          const doc = materializeDoc(c);
          const got = [...D.validateDoc(doc)].sort();
          const want = [...c.expect_codes].sort();
          if (JSON.stringify(got) !== JSON.stringify(want)) {
            failures.push(`${c.id}: validate got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
          }
        } else if (c.op === 'merge_tags') {
          const doc = materializeDoc(c);
          const got = [...D.mergeTags(doc)].sort();
          const want = [...c.expect_tags].sort();
          if (JSON.stringify(got) !== JSON.stringify(want)) {
            failures.push(`${c.id}: merge_tags got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
          }
        } else if (c.op === 'render') {
          const doc = materializeDoc(c);
          const out = D.render(doc, c.ctx || {}, c.mode);
          const missing = (c.expect_contains || []).filter((s) => !out.includes(s));
          const forbidden = (c.expect_not_contains || []).filter((s) => out.includes(s));
          if (missing.length || forbidden.length) {
            failures.push(`${c.id}: render missing=${JSON.stringify(missing)} forbidden-present=${JSON.stringify(forbidden)}`);
          }
        } else if (c.op === 'render_text') {
          const doc = materializeDoc(c);
          const out = D.renderText(doc, c.ctx || {});
          const missing = (c.expect_contains || []).filter((s) => !out.includes(s));
          const forbidden = (c.expect_not_contains || []).filter((s) => out.includes(s));
          if (missing.length || forbidden.length) {
            failures.push(`${c.id}: render_text missing=${JSON.stringify(missing)} forbidden-present=${JSON.stringify(forbidden)}`);
          }
        } else if (c.op === 'render_error') {
          const doc = materializeDoc(c);
          let threw = null;
          try { D.render(doc, c.ctx || {}, c.mode); } catch (e) { threw = e; }
          if (!threw) {
            failures.push(`${c.id}: expected EngageError code=${c.expect_error_code}, render succeeded instead`);
          } else if (threw.code !== c.expect_error_code) {
            failures.push(`${c.id}: got code=${JSON.stringify(threw.code)} want=${JSON.stringify(c.expect_error_code)}`);
          }
        } else {
          failures.push(`${c.id}: unknown op ${c.op}`);
        }
      } catch (e) {
        failures.push(`${c.id}: threw unexpectedly: ${e.message}`);
      }
    }
    assert.deepEqual(failures, [], failures.length + ' of ' + cases.length + ' doc-cases failed:\n' + failures.join('\n'));
  });

test('no unresolved {{tag}} ever leaks into rendered output', () => {
  const D = loadBrowser().HW_DOC;
  const doc = {
    version: 1, kind: 'email',
    blocks: [{ id: 'h1', type: 'heading', props: { text: 'Hi {{first_name}}' } }],
    merge_tags_required: ['first_name'],
  };
  const out = D.render(doc, { first_name: 'Riley' }, 'email');
  assert.ok(!out.includes('{{') && !out.includes('}}'), 'unresolved merge tag token leaked: ' + out);
});

test('email mode is table-based HTML; landing mode is not required to be', () => {
  const D = loadBrowser().HW_DOC;
  const emailDoc = { version: 1, kind: 'email', blocks: [{ id: 't1', type: 'text', props: { text: 'hi' } }] };
  const emailOut = D.render(emailDoc, {}, 'email');
  assert.ok(emailOut.includes('<table'), 'email-mode output must contain a <table');
});

test('a 13th/unknown block type fails validateDoc', () => {
  const D = loadBrowser().HW_DOC;
  const doc = { version: 1, kind: 'email', blocks: [{ id: 'x1', type: 'video', props: {} }] };
  assert.ok(D.validateDoc(doc).includes('unknown_block_type'));
});

test('escaping: a <script> tag typed into a merge-tag ctx value never reaches the output unescaped', () => {
  const D = loadBrowser().HW_DOC;
  const doc = {
    version: 1, kind: 'email',
    blocks: [{ id: 'h1', type: 'heading', props: { text: 'Hi {{first_name}}' } }],
    merge_tags_required: ['first_name'],
  };
  const out = D.render(doc, { first_name: '<script>alert(1)</script>' }, 'email');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});
