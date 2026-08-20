/* 🔴 TOP-LEVEL NAME COLLISIONS BETWEEN FILES ON THE SAME PAGE.
 *
 * These pages have no module system. @babel/standalone is loaded WITHOUT
 * `data-presets`, so it transpiles every top-level `const`/`let` to a plain
 * `var` on window. There is no per-script scope and there is no SyntaxError:
 * the LAST file loaded silently clobbers every earlier declaration of the same
 * name, and functions that resolve the identifier at call time then see the
 * wrong value.
 *
 * THIS ACTUALLY SHIPPED. pos/data.jsx declared `const STAGES` (strings) and
 * pos/screen-orders.jsx declared `const STAGES` (objects) — screen-orders loads
 * later, so `setStage()` did `[{id,…}].includes('pack')` and returned null on
 * EVERY call. The activity log printed "Verified order · cleared for
 * fulfillment" and the kanban card never moved.
 *
 * ⚠️ AND THE TEST SUITE COULD NOT SEE IT. test/ui-harness.mjs wraps each file in
 * (function(){…})(), giving every file its own scope — which the browser does
 * NOT do. Its own comment claimed "separate <script> tags each get their own
 * top-level scope"; that is false, and the live estate disproves it (on
 * Hyperwolf Delivery.html, window.DRIVERS is ddata's rows while HW.DRIVERS is
 * data.jsx's — the same clobber, in production).
 *
 * So the harness was hiding the exact class of bug it exists to catch. This test
 * reads the PAGES rather than booting them, because the collision is a property
 * of how the browser loads them, not of anything the harness can reproduce.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The .jsx files a page loads through Babel, in load order. */
function babelScripts(html) {
  const src = readFileSync(join(ROOT, html), 'utf8');
  return [...src.matchAll(/<script[^>]*type="text\/babel"[^>]*src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => existsSync(join(ROOT, p)));
}

/**
 * Top-level declarations in one file. These files are written flat, so a
 * declaration at column 0 is top level — anything indented is inside something.
 * Deliberately crude: it must not miss a real collision, and a false positive
 * is cheap to read.
 */
function topLevelNames(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const names = new Set();

  /* A file that WRAPS ITSELF in an IIFE leaks nothing, so its declarations
   * cannot collide with anyone. athome/account-a|b|c.jsx do exactly this — they
   * are three variants of one screen that deliberately share ~30 names, and my
   * first version of this detector reported all 30 as clobbers. They open with
   * `;(function(){` on line 3, so none of those names is ever a global.
   *
   * This is the detector being wrong, not the estate. Worth fixing rather than
   * exempting the page: an exemption would also have hidden a REAL collision in
   * those files, and self-wrapping is the pattern we would want more of. */
  if (/^\s*;?\s*\(function\s*\(/m.test(src.split('\n').slice(0, 12).join('\n'))) return names;

  for (const line of src.split('\n')) {
    const decl = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/.exec(line);
    if (decl) {
      const [, name, init] = decl;
      // `const useP = window.useP;` is a deliberate LOCAL ALIAS of the same
      // global, repeated in nearly every file in this estate. Re-declaring a
      // name to the value it already has clobbers nothing — flagging it would
      // bury the real collisions in ~40 lines of noise, and a detector nobody
      // reads is a detector that does not work.
      if (new RegExp('^window\\.' + name + '\\b').test(init.trim())) continue;
      names.add(name);
      continue;
    }
    const other = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*;/.exec(line)
      || /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(line)
      || /^class\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (other) names.add(other[1]);
  }
  return names;
}

/* ── KNOWN, PRE-EXISTING COLLISIONS ──────────────────────────────────────────
 *
 * This estate already had these when the detector was written. They are listed
 * so the test fails on anything NEW rather than being permanently red — a test
 * that is always red is a test nobody reads.
 *
 * ⚠️ THIS LIST IS A DEBT REGISTER, NOT A PERMISSION SLIP. Every line is a real
 * clobber: the later file's value wins at runtime and the earlier file's
 * functions silently see it. `DRIVERS` is CONFIRMED live — on
 * Hyperwolf Delivery.html, window.DRIVERS is ddata's 11 rows while
 * HW.DRIVERS is data.jsx's 6.
 *
 * The dangerous ones to fix first, because pos/data.jsx now has WRITE functions
 * that resolve these identifiers at call time:
 *   ORDERS   pos/data.jsx vs logistics/ldata.jsx   — addOrder would unshift onto
 *            the wrong array if anything on the Logistics page called it
 *   DRIVERS  pos/data.jsx vs delivery/ddata.jsx    — on five pages
 *   REGIONS  pos/data.jsx vs logistics/ldata.jsx
 *
 * The fix is always the same and always cheap: rename the INTERNAL binding and
 * keep the export, the way pos/data.jsx now uses ORDER_STAGES and still exports
 * `STAGES`. Shrink this list; do not add to it.
 */
const KNOWN = new Set([
  'DRIVERS: pos/data.jsx then delivery/ddata.jsx',
  'DRIVERS: pos/data.jsx then logistics/ldata.jsx',
  'REGIONS: pos/data.jsx then logistics/ldata.jsx',
  'ORDERS: pos/data.jsx then logistics/ldata.jsx',
  'L: logistics/lparts.jsx then logistics/lparts2.jsx',
  'L: logistics/lparts.jsx then logistics/lorder.jsx',
  'L: logistics/lparts.jsx then logistics/lviews.jsx',
  'D: delivery/dmap.jsx then delivery/dapp.jsx',
  '_money: pos/customer-extras.jsx then pos/payment.jsx',
  'Sec: pos/screen-categories-edit.jsx then pos/screen-stubs.jsx',
  'scUseP: shop/screen-cart.jsx then shop/screen-checkout.jsx',
  'money: terminals/tshared.jsx then terminals/tdrawer.jsx',
  'money: terminals/tshared.jsx then terminals/v2.jsx',
  'BRANDS: promo/pdata.jsx then pweb/module.jsx',
]);

const PAGES = readdirSync(ROOT).filter((f) => f.endsWith('.html'));

for (const page of PAGES) {
  const scripts = babelScripts(page);
  if (scripts.length < 2) continue;

  test(`no two files clobber each other's globals on ${page}`, () => {
    const owner = new Map();          // name -> first file that declared it
    const clashes = [];
    for (const file of scripts) {
      for (const name of topLevelNames(file)) {
        if (owner.has(name) && owner.get(name) !== file) {
          clashes.push(`${name}: ${owner.get(name)} then ${file}`);
        } else if (!owner.has(name)) {
          owner.set(name, file);
        }
      }
    }
    const fresh = clashes.filter((c) => !KNOWN.has(c));
    assert.deepEqual(fresh, [],
      `these top-level names are declared by more than one file on ${page}. ` +
      'The later file wins at runtime and the earlier one\'s functions silently ' +
      'see the wrong value — no error, no failing test. Rename the internal ' +
      'binding in one of them (see ORDER_STAGES in pos/data.jsx). If it is ' +
      'genuinely pre-existing and you are not fixing it now, add it to KNOWN ' +
      'above WITH a reason — but read that block first, it is a debt register.');
  });
}

test('the detector can actually detect — a known collision is caught', () => {
  // A NEGATIVE CONTROL. If topLevelNames() ever stops matching this estate's
  // declaration style, every page above goes green for the wrong reason. This
  // pins that the matcher still sees a plain top-level const.
  const names = topLevelNames('pos/data.jsx');
  assert.ok(names.has('ORDER_STAGES'), 'the matcher no longer sees top-level consts');
  assert.ok(!names.has('STAGES'), 'pos/data.jsx must not reintroduce a bare STAGES');
  assert.ok(topLevelNames('pos/screen-orders.jsx').has('STAGES'),
    'screen-orders.jsx owns the name STAGES — if that changes, revisit the rename');
});

test('the debt register has no stale entries', () => {
  // If a collision gets fixed and its KNOWN line is left behind, the register
  // stops describing reality and quietly re-authorises the same name later.
  const seen = new Set();
  for (const page of PAGES) {
    const owner = new Map();
    for (const file of babelScripts(page)) {
      for (const name of topLevelNames(file)) {
        if (owner.has(name) && owner.get(name) !== file) seen.add(`${name}: ${owner.get(name)} then ${file}`);
        else if (!owner.has(name)) owner.set(name, file);
      }
    }
  }
  const stale = [...KNOWN].filter((k) => !seen.has(k));
  assert.deepEqual(stale, [],
    'these collisions are listed as known but no longer happen — delete them from KNOWN');
});
