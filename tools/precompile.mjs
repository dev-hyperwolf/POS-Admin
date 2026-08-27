/* ═══ PRECOMPILE THE JSX AT DEPLOY TIME ══════════════════════════════════════
 *
 * WHY THIS EXISTS. Every app page in this repo shipped 10-35
 * `<script type="text/babel">` tags and transformed them IN THE BROWSER at
 * load, via @babel/standalone from unpkg. That put a ~3MB compiler plus 35
 * XHR fetches plus 35 transforms on the critical path of the demo the owner
 * shows to developers. It worked on fast machines with warm caches and
 * intermittently painted a BLANK COLOURED PAGE on his — the seam pills (plain
 * .js, parser-executed) rendered and nothing else did, which is the signature
 * of the babel stage never completing rather than of a broken file.
 *
 * This runs the SAME transform ahead of time, so the page ships plain JS.
 *
 * ── FIDELITY IS THE WHOLE POINT ─────────────────────────────────────────────
 *
 * It uses @babel/standalone — the identical package, pinned to the identical
 * version the pages loaded from unpkg — with the EXACT option set
 * `transformScriptTags` builds for a classic `text/babel` script:
 *
 *     presets: ['react', 'env']
 *     plugins: ['transform-class-properties',
 *               'transform-object-rest-spread',
 *               'transform-flow-strip-types']
 *
 * That is not a stylistic choice, it is load-bearing. `preset-env` with no
 * targets compiles to ES5, which turns every top-level `const`/`let` into a
 * `var` — a property of `window`, last-writer-wins, NO SyntaxError. This
 * estate depends on that: pos/data.jsx and delivery/ddata.jsx both declare
 * DRIVERS at top level, pos/data.jsx and pos/screen-orders.jsx both declared
 * STAGES (see FINDING-STAGES-COLLISION.md). Under any transform that leaves
 * `const` alone, the SECOND file to declare the name dies with "Identifier
 * has already been declared" and its screens vanish — a WORSE blank page than
 * the one being fixed.
 *
 * ⚠️ esbuild CANNOT do this. `transformSync` refuses to lower const/let to var
 * ("Transforming const to the configured target environment is not supported
 * yet") — verified against esbuild 0.24 on this tree, at every target down to
 * es5. esbuild is the right tool for the TEST HARNESS, which deliberately
 * gives each file its own scope; it is the wrong tool here, where the job is
 * to reproduce the browser exactly.
 *
 * ── EXECUTION ORDER IS PRESERVED EXACTLY ────────────────────────────────────
 *
 * Babel does not run the text/babel scripts where they sit. It fetches them by
 * XHR and executes them, in document order, on DOMContentLoaded — i.e. AFTER
 * every plain `<script src>` on the page, including the `defer` ones. So the
 * true order today is:
 *
 *     1. plain non-deferred scripts, in document order
 *     2. plain deferred scripts (demo-seed.js, build-stamp.js)
 *     3. all text/babel scripts, in document order
 *
 * Rewriting each babel tag in place would move group 3 into group 1 and
 * silently reorder the page. Instead, each babel tag is replaced by a comment
 * that records what used to be there, and the compiled scripts are emitted as
 * one `defer` block immediately before </body> — after every existing defer.
 * That reproduces 1 → 2 → 3 byte for byte in behaviour.
 *
 * ── STALE COMPILED OUTPUT CANNOT BE SERVED SILENTLY ─────────────────────────
 *
 * A compiled bundle older than its source looks exactly like a working one.
 * Three independent guards, so that is impossible rather than merely unlikely:
 *
 *   G1  CONTENT-ADDRESSED FILENAMES. Output is
 *       build/<path>/<name>.<sha8>.js, where sha8 derives from the SOURCE
 *       bytes + the babel version + this tool's version. The HTML asks for
 *       the hash of the source it was built from. Edit the source without
 *       rebuilding and the page requests a name that does not exist: a 404,
 *       which G3 turns into words on the screen. There is no filename under
 *       which an older compile of newer source can answer. This is why the
 *       gate hashes CONTENT and never compares mtimes — see the note in
 *       tools/precompile-verify.mjs.
 *   G2  tools/precompile-verify.mjs re-derives every hash from the sources on
 *       disk and fails the BUILD on any mismatch, any missing output, any
 *       surviving text/babel tag, any surviving @babel/standalone tag, and any
 *       output older than its source.
 *   G3  A boot guard inlined into every rewritten page. A script that fails to
 *       load, or a mount node still empty after load, paints a NAMED red panel
 *       listing the exact URLs and errors. The failure mode stops being "blank
 *       coloured page" and becomes a sentence.
 *
 * ── MODES ───────────────────────────────────────────────────────────────────
 *
 *   node tools/precompile.mjs                 dry run. Compiles everything in
 *                                             memory, reports, writes NOTHING.
 *   node tools/precompile.mjs --in-place      writes build/** and rewrites the
 *                                             HTML. Requires
 *                                             HW_PRECOMPILE_IN_PLACE_OK=1.
 *   --root DIR                                operate on another tree (tests).
 *   --json                                    machine-readable summary.
 *
 * ⚠️ --in-place REWRITES THE WORKING TREE and is meant for the throwaway clone
 * Render makes at deploy time, never for a laptop checkout shared with other
 * people's edits. Hence the env-var interlock. See the DEV LOOP note at the
 * bottom of this file: a developer editing .jsx runs NOTHING.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Bump when the emitted code or the option set changes: it is folded into
 *  every content hash, so a tool change invalidates every output name. */
export const TOOL_VERSION = '1';

const SKIP_DIRS = new Set(['node_modules', '.git', 'uploads', 'build', 'screenshots', '.github']);

/** The option set @babel/standalone builds for a classic text/babel script.
 *  Read out of node_modules/@babel/standalone/babel.js (buildBabelOptions).
 *  Do not "tidy" this — see the fidelity note at the top. */
export function babelOptions(filename) {
  return {
    filename,
    presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    sourceMaps: true,
    sourceFileName: filename,
    targets: { browsers: undefined },
  };
}

export function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

/** The hash that names an output file. Source bytes + babel version + tool
 *  version: change any of the three and the name changes. */
export function outputHash(sourceBytes, babelVersion) {
  return sha256(Buffer.concat([
    Buffer.from(sourceBytes),
    Buffer.from('\0' + babelVersion + '\0' + TOOL_VERSION),
  ]));
}

function walkHtml(root) {
  const out = [];
  (function rec(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) rec(path.join(dir, e.name)); }
      else if (e.isFile() && e.name.endsWith('.html')) out.push(path.join(dir, e.name));
    }
  })(root);
  return out.sort();
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
function attr(attrs, name) {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i').exec(attrs);
  return m ? m[1] : null;
}

/** Where the browser resolves this page's relative URLs from. Honours <base>:
 *  rfid/index.html and rfid-direction-a/index.html both carry
 *  <base href="../"/>, so their src="pos/tokens.jsx" means REPO ROOT. Getting
 *  this wrong reports 31 perfectly good files as missing. */
function baseDirFor(root, htmlAbs, html) {
  const dir = path.dirname(htmlAbs);
  const m = /<base\b[^>]*href\s*=\s*"([^"]*)"/i.exec(html);
  if (!m) return dir;
  return path.resolve(dir, m[1]);
}

/**
 * Plan one HTML entry. Pure: reads sources, writes nothing.
 * Returns null when the page loads no text/babel scripts.
 */
export function planEntry(root, htmlAbs, Babel) {
  const html = readFileSync(htmlAbs, 'utf8');
  if (!/type\s*=\s*"text\/babel"/i.test(html)) return null;

  const baseDir = baseDirFor(root, htmlAbs, html);
  const rel = path.relative(root, htmlAbs);
  const units = [];        // compiled, in document order
  const unresolved = [];   // referenced by the page but not on disk
  const remote = [];
  let inlineN = 0;

  SCRIPT_RE.lastIndex = 0;
  let m;
  while ((m = SCRIPT_RE.exec(html))) {
    const [, attrs, body] = m;
    if ((attr(attrs, 'type') || '').toLowerCase() !== 'text/babel') continue;
    const src = attr(attrs, 'src');

    if (src && /^(https?:)?\/\//.test(src)) { remote.push(src); continue; }

    if (!src) {
      // An INLINE text/babel block. It must become a FILE, not stay inline:
      // an inline script cannot be deferred, so leaving it in the body would
      // run it during parsing — ahead of the deferred compiled block instead
      // of alongside it, which is precisely the reordering this tool exists
      // to avoid. Five pages have one.
      inlineN += 1;
      const slug = rel.replace(/\.html$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase();
      units.push({ tag: m[0], kind: 'inline', sourceRel: `${rel} (inline #${inlineN})`,
                   code: body, mtimeMs: statSync(htmlAbs).mtimeMs,
                   outRel: null, slug: `${slug}.inline-${inlineN}` });
      continue;
    }

    const abs = path.resolve(baseDir, src.split('?')[0]);
    if (!abs.startsWith(root + path.sep) && abs !== root) { unresolved.push({ src, why: 'outside the tree' }); continue; }
    if (!existsSync(abs)) { unresolved.push({ src, why: 'no such file' }); continue; }
    // rawSha is the PLAIN sha256 of the file on disk, published in
    // build/precompiled-sources.txt. It is deliberately NOT the output hash:
    // that one is salted with the babel and tool versions so a compiler change
    // renames every output, which is right for the internal gate and useless to
    // anyone outside. The sync-render workflow hashes the copy GitHub Pages
    // serves and looks for it here — the assertion being "Render compiled this
    // from exactly the bytes the other host is serving", which is a stronger
    // statement than the byte-compare it replaced.
    units.push({ tag: m[0], kind: 'file', sourceRel: path.relative(root, abs), abs,
                 code: readFileSync(abs, 'utf8'), rawSha: sha256(readFileSync(abs)),
                 mtimeMs: statSync(abs).mtimeMs });
  }

  if (!units.length && !unresolved.length) return null;

  // Compile. A failure here is fatal for the whole build: half a page is the
  // blank screen wearing a different hat.
  for (const u of units) {
    const name = u.kind === 'inline' ? u.slug : u.sourceRel;
    let res;
    try {
      res = Babel.transform(u.code, babelOptions(name));
    } catch (err) {
      throw new Error(`FAIL precompile: ${rel}: ${name} did not compile: ${err.message}`);
    }
    const hash = outputHash(u.code, Babel.version);
    const h8 = hash.slice(0, 8);
    const outRel = u.kind === 'inline'
      ? path.posix.join('build', `${u.slug}.${h8}.js`)
      : path.posix.join('build', u.sourceRel.split(path.sep).join('/').replace(/\.jsx?$/i, '') + `.${h8}.js`);
    const header = `/* PRECOMPILED — DO NOT EDIT. Regenerate with tools/precompile.mjs.\n`
      + ` * source: ${name}\n * HW_PRECOMPILED_SOURCE_SHA: ${hash}\n`
      + ` * babel: ${Babel.version} (presets react,env — same as the browser ran)\n */\n`;
    const mapName = path.posix.basename(outRel) + '.map';
    u.hash = hash;
    u.outRel = outRel;
    u.mapRel = outRel + '.map';
    u.out = header + res.code + `\n//# sourceMappingURL=${mapName}\n`;
    u.map = JSON.stringify({ ...res.map, sourcesContent: [u.code] });
    // The URL the PAGE must ask for, resolved from the page's own base.
    u.href = path.relative(baseDir, path.join(root, outRel)).split(path.sep).join('/');
  }

  return { rel, htmlAbs, html, baseDir, units, unresolved, remote };
}

/** The inline boot guard. Turns a failed load into a sentence on the screen. */
function bootGuard(entryRel, units, builtAt, mountId) {
  // Deliberately terse. An inline script's source counts toward
  // document.body.textContent, so a chatty guard shows up in every text
  // assertion anyone writes against these pages — it cost me an hour proving
  // a 3.9KB "rendering difference" was this comment. The long explanation
  // lives in the tools/, where it does not ship.
  return `<script>
/* HW BOOT GUARD: a blank page must never be silent. See tools/precompile.mjs. */
(function(){
  var failed=[], errs=[], painted=false;
  window.__HW_PRECOMPILED__={entry:${JSON.stringify(entryRel)},builtAt:${JSON.stringify(builtAt)},scripts:${units.length}};
  function paint(title){
    if(painted) return; painted=true;
    var d=document.createElement('div');
    d.setAttribute('data-hw-boot-failure','1');
    d.style.cssText='position:fixed;inset:0;z-index:2147483647;overflow:auto;padding:32px;'+
      'background:#1a0f0f;color:#ffd7d7;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace';
    var html='<div style="font:700 20px/1.3 system-ui,sans-serif;color:#ff8a8a;margin-bottom:8px">'+title+'</div>'+
      '<div style="color:#c9b7b7;margin-bottom:20px">'+${JSON.stringify(entryRel)}+' — precompiled build '+
      ${JSON.stringify(builtAt)}+'. This panel is the build guard, not the app.</div>';
    if(failed.length){html+='<div style="color:#ff8a8a;font-weight:700">Scripts that failed to load ('+failed.length+'):</div><ul>';
      failed.forEach(function(u){html+='<li>'+u+'</li>';});html+='</ul>'+
      '<div style="color:#c9b7b7;margin:12px 0 20px">A 404 here means the compiled file named by this page is not on the server. '+
      'The filename carries the hash of its .jsx source, so this is what a STALE or MISSING build looks like. '+
      'Run: node tools/precompile.mjs --in-place &amp;&amp; node tools/precompile-verify.mjs</div>';}
    if(errs.length){html+='<div style="color:#ff8a8a;font-weight:700">Errors:</div><ul>';
      errs.forEach(function(e){html+='<li>'+e+'</li>';});html+='</ul>';}
    if(!failed.length&&!errs.length){html+='<div>No script failed to load and no error was raised. '+
      'The mount node is empty, so the app decided to render nothing.</div>';}
    d.innerHTML=html; (document.body||document.documentElement).appendChild(d);
  }
  window.addEventListener('error',function(e){
    var t=e&&e.target;
    if(t&&t.tagName==='SCRIPT'&&t.src){failed.push(t.src);paint('This page could not load its code.');return;}
    if(e&&e.message)errs.push(String(e.message)+(e.filename?' @ '+e.filename+':'+e.lineno:''));
  },true);
  window.addEventListener('load',function(){setTimeout(function(){
    if(failed.length)return paint('This page could not load its code.');
    var el=${mountId ? `document.getElementById(${JSON.stringify(mountId)})` : 'null'}||document.body;
    if(el&&el.children.length===0)paint('The app did not mount.');
  },2000);});
})();
</script>
`;
}

/** Rewrite one page. Returns the new HTML string. */
export function rewriteEntry(plan, builtAt) {
  let html = plan.html;
  const clean = plan.unresolved.length === 0 && plan.remote.length === 0;

  for (const u of plan.units) {
    const note = `<!-- precompiled: ${u.sourceRel} -> ${u.href} (built ${builtAt}) -->`;
    html = html.replace(u.tag, note);
  }

  // The compiler itself. Only removed once nothing on the page still needs it.
  if (clean) {
    html = html.replace(/[ \t]*<script\b[^>]*src="[^"]*(?:@babel\/standalone|babel(?:\.min)?\.js)[^"]*"[^>]*>\s*<\/script>[ \t]*\r?\n?/gi,
      `<!-- @babel/standalone removed: this page is precompiled (${builtAt}). -->\n`);
  }

  const mount = /<div\b[^>]*\bid="([^"]+)"/i.exec(html.split(/<body\b[^>]*>/i)[1] || '');
  const guard = bootGuard(plan.rel, plan.units, builtAt, mount ? mount[1] : null);
  html = /<body\b[^>]*>/i.test(html)
    ? html.replace(/(<body\b[^>]*>)/i, `$1\n${guard}`)
    : guard + html;

  const block = ['<!-- ═══ PRECOMPILED APP CODE ═══════════════════════════════════════════',
    '     These were browser-transformed script tags scattered through the body.',
    '     Babel ran them ALL on DOMContentLoaded, after every plain and deferred',
    '     script on the page. `defer` here, at the very end of the body, is what',
    '     reproduces that order exactly. Sources are the .jsx files; the hash in',
    '     each filename is the hash of its source, so a stale build 404s.',
    '     ═══════════════════════════════════════════════════════════════════ -->']
    .concat(plan.units.map((u) => `<script defer src="${u.href}" data-hw-src="${u.sourceRel}"></script>`))
    .join('\n') + '\n';

  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, block + '</body>') : html + block;
  return html;
}

export function run(argv = []) {
  const opt = {
    root: path.resolve(process.cwd()),
    inPlace: argv.includes('--in-place'),
    json: argv.includes('--json'),
  };
  const ri = argv.indexOf('--root');
  if (ri !== -1) opt.root = path.resolve(argv[ri + 1]);
  opt.root = opt.root.replace(/\/$/, '');

  if (opt.inPlace && process.env.HW_PRECOMPILE_IN_PLACE_OK !== '1') {
    throw new Error('FAIL precompile: --in-place rewrites the HTML files in this tree and is meant for the '
      + 'throwaway clone the deploy makes, not a shared checkout. Set HW_PRECOMPILE_IN_PLACE_OK=1 if you mean it.');
  }

  // HW_BABEL_STANDALONE lets the deploy install the compiler into a throwaway
  // prefix instead of into POS-Admin's own node_modules. `npm install` in the
  // repo would drag in the whole devDependency tree — 67MB, esbuild's native
  // binary and all — to get ONE pure-JS package the build actually needs.
  let Babel;
  const from = process.env.HW_BABEL_STANDALONE || '@babel/standalone';
  try { Babel = require(from); }
  catch {
    throw new Error(`FAIL precompile: could not load @babel/standalone from "${from}". This build needs the SAME `
      + 'compiler the browser used to run, at the SAME version — a different one would emit different globals. '
      + 'Install it with: npm install --no-save --prefix /tmp/hw-babel @babel/standalone@7.29.0');
  }

  const builtAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const plans = [];
  for (const htmlAbs of walkHtml(opt.root)) {
    const p = planEntry(opt.root, htmlAbs, Babel);
    if (p) plans.push(p);
  }

  /* ⚠️ THIS TOOL IS NOT IDEMPOTENT, AND THE SECOND RUN IS THE DANGEROUS ONE.
   *
   * A rewritten page has no browser-transformed tags left, so a re-run finds
   * nothing to do and — before this check — reported a cheerful PASS having
   * compiled zero files. Caught by testing the deploy script on a tree that had
   * already been built once: a source with a deliberate syntax error sailed
   * through with exit 0, because nothing was looked at. A build step that
   * succeeds by doing nothing is the same failure as a stale bundle: everything
   * downstream believes it ran.
   *
   * On Render this cannot arise (the clone is fresh every time), which is
   * exactly why it needed to be made loud rather than left to luck. */
  if (!plans.length) {
    throw new Error(`FAIL precompile: no page under ${opt.root} loads a browser-transformed script. Either this tree `
      + 'has ALREADY been precompiled (this tool rewrites in place and must be run on a fresh clone), or --root '
      + 'points at the wrong directory. Refusing to report success for a build that compiled nothing.');
  }

  const summary = { tool: TOOL_VERSION, babel: Babel.version, builtAt, root: opt.root,
                    mode: opt.inPlace ? 'in-place' : 'dry-run', entries: [] };
  const seen = new Map();
  for (const p of plans) {
    const bytesIn = p.units.reduce((a, u) => a + Buffer.byteLength(u.code), 0);
    const bytesOut = p.units.reduce((a, u) => a + Buffer.byteLength(u.out), 0);
    summary.entries.push({
      html: p.rel, compiled: p.units.length, bytesIn, bytesOut,
      unresolved: p.unresolved, remoteBabel: p.remote,
      babelFreed: p.unresolved.length === 0 && p.remote.length === 0,
      scripts: p.units.map((u) => ({ source: u.sourceRel, out: u.outRel, sha256: u.hash })),
    });
    for (const u of p.units) seen.set(u.outRel, u);
  }

  if (opt.inPlace) {
    for (const [outRel, u] of seen) {
      const abs = path.join(opt.root, outRel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, u.out);
      writeFileSync(abs + '.map', u.map);
    }
    for (const p of plans) writeFileSync(p.htmlAbs, rewriteEntry(p, builtAt));
    mkdirSync(path.join(opt.root, 'build'), { recursive: true });
    writeFileSync(path.join(opt.root, 'build', 'precompiled.json'), JSON.stringify(summary, null, 2) + '\n');
    writeFileSync(path.join(opt.root, 'build', 'precompiled-sources.txt'),
      [...new Set(plans.flatMap((p) => p.units.filter((u) => u.kind === 'file')
        .map((u) => `${u.rawSha}  ${u.sourceRel}`)))].sort().join('\n') + '\n');
  }

  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const s = run(process.argv.slice(2));
    if (process.argv.includes('--json')) { console.log(JSON.stringify(s, null, 2)); }
    else {
      let tin = 0, tout = 0, tn = 0, bad = 0;
      for (const e of s.entries) {
        tin += e.bytesIn; tout += e.bytesOut; tn += e.compiled;
        const flag = e.babelFreed ? 'babel REMOVED' : 'babel KEPT';
        console.log(`  ${String(e.compiled).padStart(3)} files  ${flag.padEnd(13)}  ${e.html}`);
        for (const u of e.unresolved) { bad++; console.log(`        ! unresolved ${u.src} (${u.why}) — page left on browser-side babel`); }
      }
      console.log(`\nPASS precompile ${s.mode}: ${tn} scripts across ${s.entries.length} pages, `
        + `${(tin / 1024).toFixed(0)}KB source -> ${(tout / 1024).toFixed(0)}KB compiled, babel ${s.babel}`);
      if (bad) console.log(`FAIL precompile: ${bad} unresolved script reference(s) above — those pages still ship @babel/standalone.`);
      if (s.mode === 'dry-run') console.log('(dry run — nothing was written. --in-place to write, needs HW_PRECOMPILE_IN_PLACE_OK=1)');
    }
  } catch (err) {
    console.error(err.message.startsWith('FAIL') ? err.message : `FAIL precompile: ${err.message}`);
    process.exit(1);
  }
}

/* ── THE DEV LOOP, PLAINLY ───────────────────────────────────────────────────
 *
 * A developer editing a .jsx runs NOTHING and builds NOTHING.
 *
 * The HTML files IN GIT still say `<script type="text/babel" src="pos/x.jsx">`.
 * Locally, and on GitHub Pages, the browser still transforms them — edit, save,
 * reload, see it. The precompile happens only inside the deploy, on the
 * disposable clone Render makes (wm-integration/render.yaml buildCommand), and
 * the rewritten HTML never exists in anybody's working tree.
 *
 * That is also why stale output is not merely unlikely but IMPOSSIBLE on the
 * deployed host: nothing compiled is ever committed, cached or reused. Every
 * deploy compiles from the sources it just cloned, and precompile-verify.mjs
 * fails the build if the result does not match those sources.
 *
 * To see what the deploy will ship, without touching your tree:
 *     node tools/precompile.mjs
 */
