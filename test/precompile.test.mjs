/* ═══ THE DEPLOY-TIME PRECOMPILE, AND THE GATE THAT REFUSES STALE OUTPUT ═════
 *
 * tools/precompile.mjs removes @babel/standalone from the deployed pages by
 * running the same transform at deploy time. Two things about it can break
 * silently, so both are pinned here:
 *
 *   1. FIDELITY. The browser ran preset-env, which turns every top-level
 *      `const` into a `var` on window — last writer wins, no SyntaxError. This
 *      estate DEPENDS on that (pos/data.jsx and delivery/ddata.jsx both declare
 *      DRIVERS; see FINDING-STAGES-COLLISION.md). A transform that leaves
 *      `const` alone makes the SECOND declaring file die with "already been
 *      declared" and takes its screens with it. That is a worse blank page than
 *      the one being fixed, and it would not show up in any other test here,
 *      because test/ui-harness.mjs gives every file its own scope.
 *
 *   2. STALENESS. Compiled output older than its source looks exactly like
 *      working output. The gate must go RED for it. Each assertion below breaks
 *      the tree in one specific way and requires red — a gate nobody has
 *      watched fail is a hypothesis, not a guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from '../tools/precompile.mjs';
import { main as verify } from '../tools/precompile-verify.mjs';

/** Run something with console.log captured, so the suite stays readable and
 *  the assertions can look at what the gate actually SAID. */
function quiet(fn) {
  const said = [];
  const orig = console.log;
  console.log = (...a) => said.push(a.join(' '));
  try { return { value: fn(), said }; } finally { console.log = orig; }
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hw-precompile-'));
  mkdirSync(path.join(root, 'app'), { recursive: true });
  // TWO files that declare the SAME top-level const. This is the estate's real
  // shape, not a contrivance.
  writeFileSync(path.join(root, 'app', 'a.jsx'),
    `const STAGES = ['new', 'pack'];\nwindow.A = () => <div>a {STAGES.length}</div>;\n`);
  writeFileSync(path.join(root, 'app', 'b.jsx'),
    `const STAGES = [{ id: 'new' }];\nwindow.B = () => <div>b {STAGES.length}</div>;\n`);
  writeFileSync(path.join(root, 'plain.js'), `window.PLAIN = 1;\n`);
  writeFileSync(path.join(root, 'page.html'),
    `<!doctype html><html><head><title>t</title></head><body>\n`
    + `<div id="root"></div>\n`
    + `<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>\n`
    + `<script type="text/babel" src="app/a.jsx"></script>\n`
    + `<script type="text/babel" src="app/b.jsx"></script>\n`
    + `<script type="text/babel">window.INLINE = () => <i>hi</i>;</script>\n`
    + `<script defer src="plain.js"></script>\n`
    + `</body></html>\n`);
  return root;
}

const ENV = process.env.HW_PRECOMPILE_IN_PLACE_OK;
function build(root) {
  process.env.HW_PRECOMPILE_IN_PLACE_OK = '1';
  try { return run(['--in-place', '--root', root]); }
  finally { if (ENV === undefined) delete process.env.HW_PRECOMPILE_IN_PLACE_OK; else process.env.HW_PRECOMPILE_IN_PLACE_OK = ENV; }
}
const compiled = (root) => readdirSync(path.join(root, 'build', 'app')).filter((f) => f.endsWith('.js'));

test('the compiled output keeps the browser\'s const-to-var semantics', () => {
  const root = fixture();
  try {
    build(root);
    const files = compiled(root).map((f) => readFileSync(path.join(root, 'build', 'app', f), 'utf8'));
    assert.equal(files.length, 2);
    for (const code of files) {
      assert.match(code, /^var STAGES/m,
        'top-level const must become var — a global, last-writer-wins, exactly as @babel/standalone did in the browser');
      assert.doesNotMatch(code, /^const STAGES/m,
        'a surviving top-level const makes the SECOND file on the page a SyntaxError');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the rewritten page ships no compiler and no browser-side transform', () => {
  const root = fixture();
  try {
    build(root);
    const html = readFileSync(path.join(root, 'page.html'), 'utf8');
    assert.doesNotMatch(html, /type\s*=\s*"text\/babel"/i, 'no tag may still be transformed in the browser');
    assert.doesNotMatch(html, /<script\b[^>]*src="[^"]*@babel\/standalone/i, 'the compiler must be gone');
    assert.equal(quiet(() => verify(['--root', root])).value, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('compiled scripts land AFTER every existing defer, which is where babel ran them', () => {
  const root = fixture();
  try {
    build(root);
    const html = readFileSync(path.join(root, 'page.html'), 'utf8');
    // Babel fetched the text/babel tags and ran them on DOMContentLoaded — after
    // plain.js, wherever plain.js sat in the document. Putting the compiled block
    // before it would reorder the page while looking like a pure translation.
    assert.ok(html.indexOf('plain.js') < html.indexOf('data-hw-src="app/a.jsx"'),
      'the compiled block must come after the page\'s own deferred scripts');
    assert.ok(html.indexOf('data-hw-src="app/a.jsx"') < html.indexOf('data-hw-src="app/b.jsx"'),
      'and must preserve document order among themselves');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an inline text/babel block becomes a file, not an inline script', () => {
  const root = fixture();
  try {
    build(root);
    const html = readFileSync(path.join(root, 'page.html'), 'utf8');
    assert.match(html, /data-hw-src="page\.html \(inline #1\)"/,
      'inline blocks must be deferred too, or they run during parsing and jump the queue');
    assert.doesNotMatch(html, /window\.INLINE/, 'the inline source must not remain in the page');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('GATE GOES RED: a source edited after the build', () => {
  const root = fixture();
  try {
    build(root);
    assert.equal(quiet(() => verify(['--root', root])).value, 0, 'green before the mutation');
    writeFileSync(path.join(root, 'app', 'a.jsx'),
      readFileSync(path.join(root, 'app', 'a.jsx'), 'utf8') + '\n/* forgot to rebuild */\n');
    const { value, said } = quiet(() => verify(['--root', root]));
    assert.equal(value, 1, 'a source newer than its compiled output must fail the build');
    assert.ok(said.some((l) => l.startsWith('FAIL') && /has changed since the build/.test(l)),
      `the failure must lead with FAIL and name the file: ${said.join(' | ')}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('GATE GOES RED: a compiled file that is not on disk', () => {
  const root = fixture();
  try {
    build(root);
    const f = compiled(root)[0];
    renameSync(path.join(root, 'build', 'app', f), path.join(root, 'build', 'app', 'moved.js'));
    const { value, said } = quiet(() => verify(['--root', root]));
    assert.equal(value, 1);
    assert.ok(said.some((l) => l.startsWith('FAIL') && /not on disk/.test(l)), said.join(' | '));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('GATE GOES RED: no build at all', () => {
  const root = fixture();
  try {
    const { value, said } = quiet(() => verify(['--root', root]));
    assert.equal(value, 1, 'an unbuilt tree must not pass — it would ship browser-side babel');
    assert.ok(said[0].startsWith('FAIL'), said.join(' | '));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a dry run writes nothing and --in-place refuses without the interlock', () => {
  const root = fixture();
  try {
    const before = readFileSync(path.join(root, 'page.html'), 'utf8');
    const s = run(['--root', root]);
    assert.equal(s.mode, 'dry-run');
    assert.equal(s.entries.length, 1);
    assert.equal(s.entries[0].compiled, 3);
    assert.equal(readFileSync(path.join(root, 'page.html'), 'utf8'), before, 'a dry run must not touch the tree');
    assert.equal(existsSync(path.join(root, 'build')), false);
    const saved = process.env.HW_PRECOMPILE_IN_PLACE_OK;
    delete process.env.HW_PRECOMPILE_IN_PLACE_OK;
    try {
      assert.throws(() => run(['--in-place', '--root', root]), /HW_PRECOMPILE_IN_PLACE_OK/,
        '--in-place must not rewrite a shared checkout by accident');
    } finally { if (saved !== undefined) process.env.HW_PRECOMPILE_IN_PLACE_OK = saved; }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('every page in THIS repo compiles, and none is left on browser-side babel', () => {
  // The dry run over the real tree. It is the check that a new .jsx added to a
  // page tonight does not fail the deploy tomorrow.
  const s = run([]);
  assert.ok(s.entries.length >= 15, `expected the estate's entry points, saw ${s.entries.length}`);
  const stuck = s.entries.filter((e) => !e.babelFreed);
  assert.equal(stuck.length, 0,
    `these pages would still ship @babel/standalone: ${stuck.map((e) => `${e.html} (${e.unresolved.map((u) => u.src).join(', ')})`).join('; ')}`);
});
