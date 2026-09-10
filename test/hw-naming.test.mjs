/* shared/hw-naming.js — the browser-load leak, and the naming-cases fixture.
 *
 * shared/hw-naming.js and wm-demo/wmdemo/shell_naming.py are ONE rule set, two
 * implementations (SHELLS-PLAN-2026-09-09.md §2). This file only proves the JS
 * side against the shared fixture; qa/shells_naming_probe.py proves the Python
 * side against the SAME file. Parity is "both are green", not anything this
 * file checks directly — there is no cross-runtime spawn here because wm-demo
 * is a sibling repo, not a dependency of POS-Admin, so this test degrades to a
 * clear skip rather than a hard failure when that checkout is not present
 * (e.g. a CI runner that only checked out POS-Admin).
 *
 * Loaded via `vm`, the same way test/contracts.test.mjs loads contracts/index.js
 * for its browser-leak check — plain `require()` cannot be used here because
 * POS-Admin's package.json says "type": "module", which makes Node treat a
 * `require()`'d .js file in this package as an ES module with no named exports
 * (module.exports never takes effect); shared/hw-naming.js is written for real
 * browser <script src> loading first, so `vm` with a `window` sandbox is the
 * faithful way to run it, not a workaround.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'shared', 'hw-naming.js');
const FIXTURE = '/Users/jt/wm-demo/qa/fixtures/shells/naming-cases.json';

function loadBrowser() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: 'shared/hw-naming.js' });
  return sandbox;
}

test('browser load leaks exactly one global, HW_NAMING, with the surface the plan promises', () => {
  const w = loadBrowser();
  const leaked = Object.keys(w).filter((k) => !['console', 'window', 'self'].includes(k));
  assert.deepEqual(leaked, ['HW_NAMING']);
  const N = w.HW_NAMING;
  assert.deepEqual(Object.keys(N).sort(),
    ['SLOTS', 'WARNING_CODES', 'derive', 'normaliseName', 'titleCase', 'validateTemplate'].sort());
  assert.equal(typeof N.derive, 'function');
  assert.equal(typeof N.validateTemplate, 'function');
  assert.equal(typeof N.titleCase, 'function');
  assert.equal(typeof N.normaliseName, 'function');
});

test('module.exports mirrors window.HW_NAMING (the Node half of the file actually works)', () => {
  const w = loadBrowser();
  // Re-run the tail of the file's own logic rather than trust it blindly: a
  // real CommonJS host (module defined, no window pre-supplied) must see the
  // same object the browser sandbox got.
  const sandbox = { console, module: { exports: {} } };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: 'shared/hw-naming.js' });
  assert.deepEqual(Object.keys(sandbox.module.exports).sort(), Object.keys(w.HW_NAMING).sort());
});

const hasFixture = fs.existsSync(FIXTURE);
test('naming-cases.json: every acceptance case passes under the JS engine',
  { skip: !hasFixture && 'wm-demo fixture not found at ' + FIXTURE }, () => {
    const N = loadBrowser().HW_NAMING;
    const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).cases;
    assert.ok(cases.length > 0, 'fixture carries no cases');
    const failures = [];
    for (const c of cases) {
      const res = N.derive(c.template, c.slots || {}, c.shell);
      const expectName = c.expect === undefined ? null : c.expect;
      const expectWarnings = [...(c.warnings || [])].sort();
      const gotWarnings = [...res.warnings].sort();
      const nameOk = res.name === expectName;
      const warnOk = JSON.stringify(gotWarnings) === JSON.stringify(expectWarnings);
      if (!nameOk || !warnOk) {
        failures.push(`${c.id}: got name=${JSON.stringify(res.name)} warnings=${JSON.stringify(gotWarnings)}, ` +
          `want name=${JSON.stringify(expectName)} warnings=${JSON.stringify(expectWarnings)}`);
      }
    }
    assert.deepEqual(failures, [], failures.length + ' of ' + cases.length + ' naming-cases failed:\n' + failures.join('\n'));
  });

test('formats-seed.json: validateTemplate accepts every seeded format',
  { skip: !hasFixture && 'wm-demo fixtures not found' }, () => {
    const seedPath = '/Users/jt/wm-demo/qa/fixtures/shells/formats-seed.json';
    if (!fs.existsSync(seedPath)) { return; }
    const N = loadBrowser().HW_NAMING;
    const formats = JSON.parse(fs.readFileSync(seedPath, 'utf8')).formats;
    const rejected = [];
    for (const f of formats) {
      const issues = N.validateTemplate(f.template, f.category);
      if (issues.length) { rejected.push(`${f.category}/${f.name} (${f.template}): ${issues.join(',')}`); }
    }
    assert.deepEqual(rejected, [], 'seeded formats rejected by validateTemplate:\n' + rejected.join('\n'));
  });

test('refusals validateTemplate must catch that the acceptance fixture does not carry', () => {
  const N = loadBrowser().HW_NAMING;
  // validateTemplate's arrays come back from the vm realm hw-naming.js runs
  // in, not this test's own realm, so a plain Array literal on the right of
  // deepEqual would fail on prototype identity alone — spread copies the
  // values into THIS realm's Array first.
  const vt = (t, c) => [...N.validateTemplate(t, c)];
  assert.deepEqual(vt('Live Resin Cartridge', 'Vapes'), ['template_name_slot_missing']);
  assert.ok(vt('{name} {oil} Cartridge', 'Vapes').includes('template_unknown_slot'));
  assert.ok(vt('{name} Live Resin 1g', 'Concentrates').includes('template_weight_token'));
  assert.deepEqual(vt('{name} Pre-Roll', 'Pre-Rolls'), []);
  assert.ok(vt('{name} Whatever', 'Pre-Rolls').includes('template_prerolls_ending'));
  assert.ok(vt('{name} Gummy Whatever', 'Edibles').includes('template_edibles_ending'));
  assert.deepEqual(vt('{name} Cookie', 'Edibles'), []);
  assert.ok(vt('{name} Whatever', 'Wellness').includes('template_wellness_ending'));
});
