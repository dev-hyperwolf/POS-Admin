/* ── THE GUARD THAT MAKES THE LADDER THE EASY PATH ──────────────────────────
 *
 * WHY THIS FILE EXISTS. `shared/hw-z.js` is a documented stacking scale — "ONE
 * ladder for every layer that leaves the flow". The plain-JS chrome adopted it
 * completely: fourteen files in shared/ write `z-index:var(--hwz-*)` and not one
 * writes a number. The React app layer did not. At the time this file was
 * written the app layer held 165 hand-typed `zIndex` literals across 69 files,
 * against four files reading `P.z.*`.
 *
 * Nothing failed when you hand-typed one. So people typed the number that won on
 * their screen, and two of them won against layers they were never meant to
 * reach:
 *
 *   pos/screen-register.jsx  z 1000 / 1001   (Brands filter popover)
 *   promo/pshared.jsx        z 2000 / 2001   (AnchoredPopover — every SlotChip)
 *
 * Both are above notePanel (520), tourMask (600) and tourCard (610). MEASURED IN
 * A BROWSER at 1440x900, POS Register, filter popover open and the guided tour
 * running: the tour's "Next" button occupied (820,519,58x31) and
 * `document.elementFromPoint` at its own centre returned the popover's
 * full-viewport click-catcher, `DIV z=1000`. The tour was visible and could not
 * be advanced. After the fix, the same probe at the same rect returns the tour
 * card (z 610) and the click lands.
 *
 * That is the same disease as the modal-scroll defect that
 * test/overlay-scrim-registry.test.mjs exists for, one layer up: a value that is
 * always typeable, a correct value that is merely *available*, and no failure
 * when the two diverge. A component you cannot render without importing it gets
 * adopted (PBtn: 1481 call sites). A NUMBER never does.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO. It does not demand that all 165
 * literals become `P.z.*`. Most of them cannot hurt anybody: an in-page dropdown
 * at 40 and a sticky header at 10 collide only with their own screen's peers, and
 * turning 165 correct-today numbers into 165 mechanical edits would be churn
 * bought with review risk. The bands below are drawn where the DAMAGE is, not
 * where the count is. §3 measures and reports the unpoliced band every run, so
 * the next person knows it was weighed and left rather than missed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/* Same skip list as the scrim registry, on purpose: two guards that disagree
 * about what "shipped source" means will eventually disagree about a file. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'uploads', 'screenshots', 'exports', 'docs', 'test'
]);

function sources(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

/* ── THE LADDER, READ FROM ITS OWN SOURCE ──────────────────────────────────
 *
 * Parsed out of shared/hw-z.js rather than re-typed here. A guard that carries
 * its own copy of the scale is a second copy of the scale, which is the exact
 * failure it was written to prevent. */
export function readLadder() {
  const src = readFileSync(join(ROOT, 'shared/hw-z.js'), 'utf8');
  // `window.HW_Z` also appears in the file's own header comment, ABOVE the
  // declaration — slicing to that occurrence yields an empty body and an empty
  // ladder, which makes every band check below vacuously true. Anchor on the
  // assignment itself, and let §0 fail loudly if this ever stops matching.
  const start = src.indexOf('var Z = {');
  const end = src.indexOf('window.HW_Z = Z', start);
  const body = start >= 0 && end > start ? src.slice(start, end) : '';
  const Z = {};
  for (const m of body.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):\s*(\d+),/gm)) Z[m[1]] = +m[2];
  return Z;
}

const Z = readLadder();

/** Every hand-typed numeric zIndex in one source, with its line. */
export function handTypedZ(src) {
  const out = [];
  for (const m of src.matchAll(/zIndex:\s*(\d+)/g)) {
    out.push({ value: +m[1], line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

/* ═══ 0. THE LADDER ITSELF MUST STAY A LADDER ══════════════════════════════
 *
 * Everything below trusts these numbers. If the scale stops being ordered, a
 * migration ONTO it stops being a fix. */

test('the stacking scale parses, ascends, and keeps its load-bearing ordering', () => {
  assert.ok(Object.keys(Z).length >= 12,
    `only parsed ${Object.keys(Z).length} rungs out of shared/hw-z.js — the ` +
    'regex above no longer matches its source, so every band check below is ' +
    'silently measuring against an empty ladder');

  const names = Object.keys(Z);
  for (let i = 1; i < names.length; i += 1) {
    assert.ok(Z[names[i]] > Z[names[i - 1]],
      `shared/hw-z.js: ${names[i]} (${Z[names[i]]}) is not above ` +
      `${names[i - 1]} (${Z[names[i - 1]]}). The scale is declared in stacking ` +
      'order and read as one; a rung out of order means a layer that reads ' +
      'higher in the source paints lower on the screen.');
  }

  // The three sentences the ladder's own header comment commits to.
  assert.ok(Z.chromeMenu < Z.scrim,
    'AMBIENT CHROME SITS BELOW APPLICATION UI: the chrome band must stay under ' +
    'the modal scrim, or the status tray covers modal buttons again');
  assert.ok(Z.modal > Z.scrim,
    'a modal must paint above its own backdrop');
  assert.ok(Z.notePin > Z.toast && Z.tourMask > Z.notePanel,
    'annotation and the guided tour are the only layers above the application, ' +
    'because both must be able to point AT a modal');
});

/* ═══ 1. NOTHING THE APP DRAWS MAY OUTRANK ANNOTATION OR THE TOUR ══════════
 *
 * THE LOAD-BEARING RULE, and the one both defects broke. `notePin` (500) upward
 * is reserved: the annotation layer and the guided tour must be able to sit above
 * anything a screen draws, because their whole job is to point at it. An app
 * element at 600, 1000 or 2000 does not "win" — it makes two shipped features
 * unusable while it is open, on a viewport nobody screenshots.
 *
 * This is a BAN, not a register: there is no legitimate reason for a screen to
 * outrank the tour, so the escape hatch is narrow and named in Z_EXCEPTIONS with
 * a reason, not a count that can be nudged upward one commit at a time. */

const RESERVED_FLOOR = Z.notePin;

/* Deliberate exceptions. `why` is required — an exemption with no reason is the
 * drift starting again. Keep this list SHORT; if it grows, the rule is wrong and
 * should be changed on purpose rather than eroded. */
/* EMPTY, AND THAT IS THE POINT. The one entry that lived here — the
 * pos/sales-panel.jsx sale-confirmed flash toast, hand-typed at 600, an exact
 * tie with tourMask where the winner was DOM order — was fixed on 2026-08-27 to
 * `zIndex: P.z.toast`. The register did its job: the defect was recorded rather
 * than lost, and the entry was retired by fixing it rather than by widening the
 * rule. An empty exception list is the strongest state this can be in; any hit
 * at all is now new. */
const Z_EXCEPTIONS = {};

test('no screen hand-types a zIndex at or above the annotation layer', () => {
  const offenders = [];
  for (const p of sources()) {
    const rel = relative(ROOT, p);
    for (const hit of handTypedZ(readFileSync(p, 'utf8'))) {
      if (hit.value < RESERVED_FLOOR) continue;
      const ex = Z_EXCEPTIONS[rel];
      if (ex && ex.lines.includes(hit.line)) continue;
      offenders.push(`${rel}:${hit.line} (zIndex: ${hit.value})`);
    }
  }

  assert.deepEqual(offenders, [],
    'these hand-typed z-indexes sit at or above notePin (' + RESERVED_FLOOR +
    '), the floor reserved for the annotation layer and the guided tour:\n  ' +
    offenders.join('\n  ') + '\n\n' +
    'THE FIX: read the rung instead of typing a number — `zIndex: P.z.<rung>` ' +
    'in a .jsx (P comes from useP(); pos/tokens.jsx merges window.HW_Z in as ' +
    'P.z), or `z-index: var(--hwz-<rung>)` in plain-JS chrome. The rungs are ' +
    Object.keys(Z).map((k) => `${k}=${Z[k]}`).join(' · ') + '.\n' +
    'Pick by ROLE: an anchored menu or filter popover is `dropdown` (its own ' +
    'click-catcher on `dropdown`, its panel on `dropdown + 1`); a modal ' +
    'backdrop is `scrim` and its card `modal`; a popover owned by an OPEN ' +
    'modal is `modalPop`; a transient confirmation is `toast`.\n' +
    'A big number is never the answer: shared/hw-z.js exists because ten pieces ' +
    'of chrome each picked one within 3,646 of INT32_MAX and the bottom-left ' +
    'tray ended up covering "Confirm match".\n' +
    'If you genuinely must outrank the tour, add the file and line to ' +
    'Z_EXCEPTIONS in this test WITH A REASON.');
});

test('the reserved-floor exception list does not grow', () => {
  const n = Object.values(Z_EXCEPTIONS).reduce((a, e) => a + e.lines.length, 0);
  assert.equal(n, 0,
    `Z_EXCEPTIONS now covers ${n} call site(s), not 0. Every entry is a place ` +
    'where a screen outranks the annotation layer and the guided tour. Adding ' +
    'one is a decision about a shipped feature, not bookkeeping — if it is a ' +
    'real dispensation, change this number in the same commit and say why in ' +
    'the entry. The list reached 0 when the sales-panel toast was migrated to ' +
    'P.z.toast; going back up means a screen is outranking the tour again.');
});

/* ═══ 2. THE CHROME BAND IS THE CHROME'S ═════════════════════════════════════
 *
 * 64/66/68 belong to shared/*.js — the live pill, the seam tray, the launcher
 * column and the menus those launchers open. An app element landing IN that band
 * ties with a piece of ambient chrome, and a tie is decided by DOM order across
 * two files that never see each other. This register starts EMPTY, which is the
 * strongest state a register can be in: any hit at all is new. */

test('no screen hand-types a zIndex inside the shared chrome band', () => {
  const lo = Z.chromeDock, hi = Z.chromeMenu;
  const offenders = [];
  for (const p of sources()) {
    const rel = relative(ROOT, p);
    if (rel.startsWith('shared/')) continue; // the band's owners
    for (const hit of handTypedZ(readFileSync(p, 'utf8'))) {
      if (hit.value >= lo && hit.value <= hi) offenders.push(`${rel}:${hit.line} (zIndex: ${hit.value})`);
    }
  }
  assert.deepEqual(offenders, [],
    `these hand-typed z-indexes land inside the shared chrome band ${lo}..${hi}, ` +
    'which belongs to shared/*.js (chromeDock / chromeBar / chromeMenu):\n  ' +
    offenders.join('\n  ') + '\n\n' +
    'A tie inside this band is resolved by DOM order between an app screen and ' +
    'ambient chrome that never see each other, so it is stable on your machine ' +
    'and not on anyone else\'s. THE FIX: an in-page menu belongs BELOW the band ' +
    `on P.z.dropdown (${Z.dropdown}); a modal belongs ABOVE it on P.z.scrim ` +
    `(${Z.scrim}) / P.z.modal (${Z.modal}). Never inside it.`);
});

/* ═══ 3. WHAT WAS LEFT, MEASURED EVERY RUN ═════════════════════════════════
 *
 * The band between the chrome and the reserved floor is NOT policed, and that is
 * a decision rather than an oversight. This test states the decision, prints the
 * current population, and fails only if that population grows by more than a
 * fifth — so ordinary work is never blocked, but a bulk regression (someone
 * copying a screen, or reverting a migration) is not silent either.
 *
 * If this fails and the growth is legitimate, raise CEILING and say why. If it
 * fails because 40 new literals appeared in one commit, that is the signal. */

const UNPOLICED_BASELINE = 63;   // literals in (chromeMenu, notePin), measured at the time of writing
const CEILING = Math.ceil(UNPOLICED_BASELINE * 1.2);

test('the unpoliced middle band is measured, and is not quietly filling up', () => {
  const hits = [];
  for (const p of sources()) {
    const rel = relative(ROOT, p);
    for (const hit of handTypedZ(readFileSync(p, 'utf8'))) {
      if (hit.value > Z.chromeMenu && hit.value < RESERVED_FLOOR) hits.push(`${rel}:${hit.line}=${hit.value}`);
    }
  }
  assert.ok(hits.length <= CEILING,
    `${hits.length} hand-typed z-indexes now sit between the chrome band and ` +
    `the reserved floor, against a baseline of ${UNPOLICED_BASELINE} and a ` +
    `ceiling of ${CEILING}. Individually these are harmless — they can only ` +
    'collide with peers on their own screen — which is why they are not banned. ' +
    'A jump this size is not one modal though. THE FIX for a new one is ' +
    '`zIndex: P.z.<rung>`; the rungs are ' +
    Object.keys(Z).map((k) => `${k}=${Z[k]}`).join(' · ') + '. ' +
    'If the growth is real and intended, raise UNPOLICED_BASELINE in this test ' +
    'and say what added them.');
});

/* ═══ 4. THE MIGRATED SITES STAY MIGRATED ══════════════════════════════════
 *
 * §1 catches a NEW offender. This catches the other direction — the two fixes
 * being reverted, which would restore a defect that no other test in the suite
 * can see. */

const MIGRATED = {
  'pos/screen-register.jsx': { calls: 2, wasZ: [1000, 1001], what: 'the Brands filter popover' },
  'promo/pshared.jsx':       { calls: 2, wasZ: [2000, 2001], what: 'AnchoredPopover — every SlotChip and the sentence builder' }
};

test('the two measured collisions stay on the ladder', () => {
  for (const [f, spec] of Object.entries(MIGRATED)) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const n = (src.match(/zIndex:\s*P\.z\.dropdown/g) || []).length;
    assert.equal(n, spec.calls,
      `${f}: expected ${spec.calls} \`zIndex: P.z.dropdown\` reference(s) for ` +
      `${spec.what}, found ${n} — the migration was reverted. This is the site ` +
      'where the guided tour\'s "Next" button was measured unclickable at ' +
      '1440x900; do not put a number back.');

    for (const v of spec.wasZ) {
      assert.equal(new RegExp('zIndex:\\s*' + v + '\\b').test(src), false,
        `${f} hand-types zIndex ${v} again — that is the exact value that ` +
        'painted this popover over the annotation layer and the guided tour. ' +
        'Use P.z.dropdown for the click-catcher and P.z.dropdown + 1 for the panel.');
    }
  }
});
