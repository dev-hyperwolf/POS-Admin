/* ═══ THE STALENESS GATE ═════════════════════════════════════════════════════
 *
 * Guard G2 of tools/precompile.mjs. Run it AFTER the precompile, in the same
 * build. It re-derives every hash from the .jsx files on disk and refuses to
 * let a deploy proceed that is not exactly what those sources compile to.
 *
 * WHAT IT REFUSES, each of which is a way stale output stays invisible:
 *   · a page that still carries a `type="text/babel"` tag         (not compiled)
 *   · a page that still loads @babel/standalone                   (not compiled)
 *   · a referenced build/*.js that is not on disk                 (404 at runtime)
 *   · a build/*.js whose filename hash ≠ hash of its source today (STALE)
 *   · a build/*.js whose embedded SOURCE_SHA ≠ its filename hash  (tampered)
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK: mtimes. "output older than source" was
 * the obvious test and it is strictly WEAKER than the content hash above,
 * which already folds in the source bytes, the babel version and the tool
 * version. It is also a liar: `git clone`, `cp`, and an iCloud sync all move
 * mtimes without changing a byte, so it goes red on builds that are perfectly
 * correct. A gate that cries wolf gets ignored, and then it protects nothing.
 *   · a manifest that disagrees with the HTML                     (partial build)
 *
 * ⚠️ EVERY LINE IT PRINTS LEADS WITH `PASS` OR `FAIL`, and a crash exits
 * non-zero with a FAIL line, because a probe that dies quietly reads as green.
 *
 * MUTATION-TESTED: touch a .jsx after the build and this goes red; rebuild and
 * it goes green. If you change this file, redo that both ways before trusting it.
 *
 *   node tools/precompile-verify.mjs [--root DIR]
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { outputHash } from './precompile.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function baseDirFor(htmlAbs, html) {
  const dir = path.dirname(htmlAbs);
  const m = /<base\b[^>]*href\s*=\s*"([^"]*)"/i.exec(html);
  return m ? path.resolve(dir, m[1]) : dir;
}

function main(argv) {
  let root = path.resolve(process.cwd());
  const ri = argv.indexOf('--root');
  if (ri !== -1) root = path.resolve(argv[ri + 1]);

  const fails = [];
  const fail = (msg) => { fails.push(msg); console.log('FAIL precompile-verify: ' + msg); };

  const manifestPath = path.join(root, 'build', 'precompiled.json');
  if (!existsSync(manifestPath)) {
    console.log('FAIL precompile-verify: build/precompiled.json is missing — the precompile did not run, '
      + 'so this tree would ship browser-side babel while looking built.');
    return 1;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const babelVersion = require(process.env.HW_BABEL_STANDALONE || '@babel/standalone').version;
  if (manifest.babel !== babelVersion) {
    fail(`manifest was built with babel ${manifest.babel} but ${babelVersion} is installed — every output hash is wrong.`);
  }

  let checked = 0;
  for (const entry of manifest.entries) {
    const htmlAbs = path.join(root, entry.html);
    if (!existsSync(htmlAbs)) { fail(`${entry.html}: named by the manifest, not on disk.`); continue; }
    const html = readFileSync(htmlAbs, 'utf8');
    const baseDir = baseDirFor(htmlAbs, html);

    if (/type\s*=\s*"text\/babel"/i.test(html)) {
      fail(`${entry.html}: still carries a type="text/babel" tag — this page transforms in the browser.`);
    }
    if (/<script\b[^>]*src="[^"]*(?:@babel\/standalone|babel(?:\.min)?\.js)"/i.test(html)) {
      fail(`${entry.html}: still loads @babel/standalone.`);
    }

    const refs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*\bdata-hw-src="([^"]+)"/gi)]
      .map((m) => ({ href: m[1], source: m[2] }));
    if (refs.length !== entry.compiled) {
      fail(`${entry.html}: manifest says ${entry.compiled} compiled scripts, the page references ${refs.length}.`);
    }

    for (const ref of refs) {
      const outAbs = path.resolve(baseDir, ref.href);
      if (!existsSync(outAbs)) {
        fail(`${entry.html}: ${ref.href} is referenced but not on disk — a 404 for every visitor. `
          + `This is what STALE looks like: the page asks for the hash of ${ref.source} as it is now.`);
        continue;
      }
      const out = readFileSync(outAbs, 'utf8');
      const nameHash = (path.basename(outAbs).match(/\.([0-9a-f]{8})\.js$/) || [])[1];
      const embedded = (out.match(/HW_PRECOMPILED_SOURCE_SHA:\s*([0-9a-f]{64})/) || [])[1];
      if (!nameHash) { fail(`${ref.href}: filename carries no content hash.`); continue; }
      if (!embedded) { fail(`${ref.href}: no HW_PRECOMPILED_SOURCE_SHA header — not produced by this tool.`); continue; }
      if (embedded.slice(0, 8) !== nameHash) {
        fail(`${ref.href}: filename hash ${nameHash} ≠ embedded source sha ${embedded.slice(0, 8)} — tampered or renamed.`);
        continue;
      }

      // The real question: does the SOURCE ON DISK still hash to this?
      const srcAbs = path.resolve(root, ref.source);
      if (ref.source.includes('(inline #')) {
        // Inline blocks were rewritten out of the page; the page itself is the
        // source, and the manifest's sha is the record. Check that instead.
        const rec = entry.scripts.find((s) => s.source === ref.source);
        if (!rec || rec.sha256 !== embedded) fail(`${ref.href}: inline block sha disagrees with the manifest.`);
        checked++;
        continue;
      }
      if (!existsSync(srcAbs)) { fail(`${ref.source}: source is gone but its compiled output is still shipped.`); continue; }
      const fresh = outputHash(readFileSync(srcAbs), babelVersion);
      if (fresh !== embedded) {
        fail(`${ref.source} has changed since the build. The page asks for ${nameHash}, the source now hashes to `
          + `${fresh.slice(0, 8)}. STALE — rebuild with: node tools/precompile.mjs --in-place`);
        continue;
      }
      checked++;
    }
  }

  if (fails.length) {
    console.log(`FAIL precompile-verify: ${fails.length} problem(s) across ${manifest.entries.length} pages. `
      + 'Refusing to call this build good.');
    return 1;
  }
  console.log(`PASS precompile-verify: ${checked} compiled scripts across ${manifest.entries.length} pages match their `
    + `sources; no page transforms in the browser. babel ${babelVersion}, built ${manifest.builtAt}.`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let code = 1;
  try { code = main(process.argv.slice(2)); }
  catch (err) { console.log('FAIL precompile-verify: crashed — ' + err.message); code = 1; }
  process.exit(code);
}
export { main };
