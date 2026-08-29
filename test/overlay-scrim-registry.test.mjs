/* ── THE GUARD THAT MAKES THE CORRECT SCRIM THE EASY ONE ────────────────────
 *
 * WHY THIS FILE EXISTS. The modal-scroll defect was never one bug. It was one
 * object literal retyped at 35 call sites, and the copies drifted: at HEAD,
 * 14 of the 31 hand-typed copies omitted `overflowY`, so any modal built from
 * one of those copies could not be scrolled and any control below the fold was
 * permanently unreachable. Measured in a browser at 1280x500, before the fix:
 * the Add-guest party modal in pos/screen-orders.jsx rendered a 947px card,
 * stranded its top at y=-174 by `alignItems:'center'`, pinned `scrollTop` at 0
 * against a `maxScroll` of 174, and left its "Done" button at y=715..755.
 *
 * NOTHING IN THE SUITE COULD SEE THAT. jsdom has no layout, so it answers "is
 * this wired" and never "can a human reach it". 802 tests were green while the
 * button was off-screen.
 *
 * So this file does not try to measure pixels. It removes the CONDITION that
 * let the defect exist: it refuses to let a 36th hand-typed scrim be written.
 * Every modal scrim is either `window.overlayScrim(...)` — which cannot be
 * asked for a non-scrolling overlay — or it is named in the register below with
 * a reason. Adding one without touching this file turns the suite red.
 *
 * WOULD IT HAVE CAUGHT THE ORIGINAL DEFECT? Yes, and not by luck: the original
 * defect WAS a hand-typed scrim, and every one of the 14 broken copies matches
 * the detector below. Had this file existed with an empty register, all 31
 * would have failed it on the day they were written. See the mutation note at
 * the end of this comment for the proof that it goes red on demand.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not require every scrim to be the
 * helper. Two of the survivors are not centred modals at all — a right-edge
 * side drawer and a bottom sheet — and `overlayScrim` hard-codes
 * `justifyContent:'center'` / `alignItems:'flex-start'`, so migrating them
 * would break their geometry. They are exempted BY NAME and their own cards
 * are checked to scroll instead. An exemption with a reason is a decision; an
 * exemption with no reason is the drift starting again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { withApp } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/* Directories with no shipped app in them. `test` is excluded so this file's own
 * source cannot match its own detector. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'uploads', 'screenshots', 'exports', 'docs', 'test'
]);

/* pos/atoms.jsx is where the helper is DEFINED. Its literal is the one copy
 * that is supposed to exist, so scanning it would be scanning the fix. */
const HELPER_FILE = 'pos/atoms.jsx';

function sources(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Find every hand-typed MODAL SCRIM in one source.
 *
 *  Three conditions together, because any one alone is wrong:
 *   · `position:'fixed', inset:0` alone also matches transparent click-catchers
 *     behind popovers — pos/screen-register.jsx has several and NOT ONE of them
 *     is a scrim (that file contains zero `P.scrim`). Flagging those would make
 *     the guard cry wolf and get it deleted.
 *   · `P.scrim` is what makes it a scrim rather than page chrome.
 *   · `display:'flex'` is what makes it hold a card rather than being a wash.
 *
 *  The brace walk from the match to the end of the enclosing object literal is
 *  what lets `omitsOverflowY` be read off the SAME object, instead of grepping a
 *  fixed number of following characters and getting the answer from a sibling.
 */
export function handTypedScrims(src) {
  const found = [];
  const re = /position:\s*'fixed'\s*,\s*inset:\s*0\b/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, j = m.index + m[0].length;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') depth -= 1;
      j += 1;
    }
    const obj = src.slice(m.index, j);
    if (!obj.includes('P.scrim')) continue;
    if (!/display:\s*'flex'/.test(obj)) continue;
    found.push({
      line: src.slice(0, m.index).split('\n').length,
      omitsOverflowY: !obj.includes('overflowY'),
      obj
    });
  }
  return found;
}

/* ── THE REGISTER ───────────────────────────────────────────────────────────
 *
 * Every hand-typed scrim still in the tree, with the count and the reason it is
 * still hand-typed. A file not in this map is allowed ZERO. Migrate one and the
 * count here must come down; write a new one and the suite goes red.
 *
 * The `mustScrollItsOwnCard` entries are the shapes `overlayScrim` cannot
 * express. They are not oversights and they are not broken — their cards carry
 * their own `overflowY:'auto'`, which is asserted below.
 */
const REGISTER = {
  // ── not centred modals; overlayScrim would destroy their geometry ──
  // screen-brands.jsx carries TWO of these: Picker's "map to a Weedmaps
  // brand" drawer (line ~605) and HistoryDrawer's "audit trail" drawer (line
  // ~902, added later in the needs-attention-queue work) — both hand-type the
  // identical right-edge shape independently rather than sharing one drawer
  // component. Neither is broken; both scroll their own card.
  'pos/screen-brands.jsx':    { n: 2, why: 'right-edge side drawer: alignItems stretch, justifyContent flex-end', mustScrollItsOwnCard: true },
  'mobile/screen-task.jsx':   { n: 1, why: 'bottom sheet: alignItems flex-end, card capped at 86%',                mustScrollItsOwnCard: true },
  // pos/screen-identity-binding.jsx's BindingDrawer is the same right-edge
  // drawer shape as screen-brands.jsx's pair above: overlayScrim hard-codes
  // justifyContent:'center'/alignItems:'flex-start', which would destroy a
  // drawer pinned to the right edge exactly the way the comment above already
  // explains. Its own card carries `overflowY:'auto'` (asserted below).
  'pos/screen-identity-binding.jsx': { n: 1, why: 'right-edge side drawer: alignItems stretch, justifyContent flex-end', mustScrollItsOwnCard: true }

  // ── AND NOTHING ELSE. ────────────────────────────────────────────────────
  // The sixteen "correct but hand-typed" centred modals that used to be listed
  // here were migrated onto window.overlayScrim + window.overlayCard on
  // 2026-08-27. Not one of them was broken — every one already carried
  // `overflowY`, which is precisely why it survived the first pass. They were
  // migrated because being correct today is not the same as staying correct
  // through the next edit: each was a hand-copy of a ten-key object literal, and
  // this register could only ever stop the list GROWING, never shrink it.
  //
  // Each site's z-index was carried across VERBATIM (`{ z: 120 }`, `{ z: 220 }`,
  // …) instead of being collapsed onto P.z.scrim. That is deliberate: several
  // are deliberately stacked against one another — screen-orders opens
  // FindCustomerSheet at 130 over the 120 sheets, and product-sheet's 240 sits
  // over product-shell's 220 — so flattening all sixteen onto one rung would
  // have converted those orderings into DOM-order ties. Migrating the SHAPE and
  // renumbering the LADDER are two different changes; this was only the first.
  //
  // The three entries above are the entire list, and all three are shapes the
  // helper cannot express rather than work left undone.
};

/* ═══ 1. NO NEW HAND-TYPED SCRIM, ANYWHERE ═════════════════════════════════ */

test('no file grows a hand-typed modal scrim that is not in the register', () => {
  const actual = {};
  for (const p of sources()) {
    const rel = relative(ROOT, p);
    if (rel === HELPER_FILE) continue;
    const hits = handTypedScrims(readFileSync(p, 'utf8'));
    if (hits.length) actual[rel] = hits;
  }

  const unregistered = Object.keys(actual).filter((f) => !REGISTER[f]).sort();
  assert.deepEqual(unregistered, [],
    'these files hand-type a modal scrim and are not in the register: ' +
    unregistered.map((f) => `${f}:${actual[f].map((h) => h.line).join(',')}`).join(' · ') +
    ' — use window.overlayScrim(P, opts) instead, or add the file to the ' +
    'register in this test with the reason it cannot use the helper');

  for (const [f, spec] of Object.entries(REGISTER)) {
    const n = (actual[f] || []).length;
    assert.equal(n, spec.n,
      `${f}: register says ${spec.n} hand-typed scrim(s), found ${n}. ` +
      (n > spec.n
        ? 'A new one was hand-typed — call window.overlayScrim(P, opts) instead.'
        : 'One was migrated; lower the count in the register so the next one is still caught.'));
  }
});

/* ═══ 2. EVERY SURVIVOR SCROLLS SOMETHING ══════════════════════════════════
 *
 * This is the defect restated as a property. A scrim that neither scrolls
 * itself nor caps a card that scrolls itself has content nobody can reach. */

test('every hand-typed scrim either scrolls itself or caps a card that does', () => {
  for (const [f, spec] of Object.entries(REGISTER)) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const hit of handTypedScrims(src)) {
      if (!hit.omitsOverflowY) continue;
      assert.ok(spec.mustScrollItsOwnCard,
        `${f}:${hit.line} hand-types a scrim with NO overflowY and is not one of ` +
        'the documented drawer/sheet shapes. That is the original defect exactly: ' +
        'a modal taller than the viewport cannot be scrolled and its primary ' +
        'control is unreachable. Use window.overlayScrim(P, opts).');
      // The exempt shapes must put the scroll on the card instead. The window is
      // 20 lines, not 6, because in a drawer the scroller is not the card itself
      // — the card is `overflow:hidden` with a fixed header above a `flex:1`
      // body, and that body is what scrolls. A 6-line window found the header
      // and reported a false failure.
      const after = src.split('\n').slice(hit.line, hit.line + 20).join('\n');
      assert.match(after, /overflowY:\s*'auto'/,
        `${f}:${hit.line} is exempt as "${spec.why}" — but its own card does not ` +
        'scroll either, so nothing in this modal scrolls at all');
    }
  }
});

/* ═══ 3. THE HELPER'S CONTRACT, INCLUDING THE PART THAT WAS WRONG ══════════ */

/* THE DISEASE INSIDE THE CURE, NOW GUARDED.
 *
 * `overlayScrim`'s default z was the literal `200` — a rung that does not exist
 * in shared/hw-z.js, written into the one helper whose entire purpose is to stop
 * people hand-typing a scrim. A modal built the CORRECT way (helper, no explicit
 * `z`) would have painted below every scrim still hand-typed at the real rung,
 * 300, so doing the right thing was the way to get the wrong answer.
 *
 * It was invisible because every call site in the estate passes an explicit `z`,
 * so the default was dead code — a trap armed for the next person, not a live
 * bug. Reverting the fix to `200` on 2026-08-27 left all 846 tests green, which
 * is why this test exists: without it the fix silently reverts. */
test('overlayScrim defaults its z to the scrim rung, and never to a literal', async () => {
  await withApp('pos', async (app) => {
    const { HW_Z } = app.window;
    const P = { scrim: 'rgba(0,0,0,.5)', z: HW_Z };

    assert.equal(app.window.overlayScrim(P, {}).zIndex, HW_Z.scrim,
      'a scrim built with no explicit z must land on P.z.scrim (' + HW_Z.scrim +
      '). A hard-coded default is the exact defect this helper exists to remove, ' +
      'and at 200 it would sit BELOW a hand-typed scrim on the real rung.');
    assert.equal(app.window.overlayScrim(P).zIndex, HW_Z.scrim,
      'omitting the opts object entirely must give the same rung');

    // An explicit z is still honoured — the migrated call sites carry their own
    // numbers deliberately, because several are stacked against each other.
    assert.equal(app.window.overlayScrim(P, { z: 130 }).zIndex, 130,
      'an explicit z must still win; flattening every modal onto one rung would ' +
      'turn deliberate orderings (FindCustomerSheet 130 over the 120 sheets) ' +
      'into DOM-order ties');

    // And a page that forgot shared/hw-z.js must degrade to a sane layer rather
    // than to `undefined`, which serialises to NO z-index — a scrim painted
    // under the very page it is dimming.
    const bare = app.window.overlayScrim({ scrim: 'rgba(0,0,0,.5)' }, {});
    assert.equal(typeof bare.zIndex, 'number',
      'with no P.z and no window.HW_Z the default must still be a number');
    assert.ok(bare.zIndex >= HW_Z.chromeMenu,
      `the no-ladder fallback (${bare.zIndex}) must still outrank the chrome band`);
  });
});

test('overlayCard centres without shrink-locking the card', async () => {
  await withApp('pos', async (app) => {
    const card = app.window.overlayCard;
    assert.equal(card.margin, 'auto',
      'auto margins are what collapse to 0 when free space goes negative; ' +
      'without them the card cannot be both centred and fully scrollable');

    // WHY flex-shrink MUST NOT BE 0. The scrim is a ROW flex container, so the
    // card's cross axis is the vertical one — and flex-shrink does not act on
    // the cross axis at all. `alignItems:'flex-start'` is already what stops
    // vertical stretch. A shrink factor of 0 therefore buys nothing on the axis
    // this contract exists for, and on the axis it DOES touch (width) it removes
    // the shrink that used to absorb the scrollbar. Measured in a browser: a
    // `min(780px, 96vw)` card at a 720px viewport went from fitting to forcing
    // an 11px HORIZONTAL scrollbar, because `96vw` counts the very scrollbar
    // the overlay's own overflowY had just added.
    const shrink = String(card.flex).trim().split(/\s+/)[1];
    assert.notEqual(shrink, '0',
      `overlayCard.flex is "${card.flex}" — a shrink factor of 0 cannot help on ` +
      'the vertical axis (flex-shrink does not apply to the cross axis) and on ' +
      'the horizontal axis it makes a 96vw card overflow sideways as soon as the ' +
      'overlay grows a vertical scrollbar');
    assert.equal(String(card.flex).trim().split(/\s+/)[0], '0',
      'the card must not GROW to fill the overlay; only the overlay scrolls');
  });
});

/* ═══ 4. THE MIGRATED CALL SITES STAY MIGRATED ═════════════════════════════
 *
 * The register above catches a NEW hand-typed scrim. This catches the other
 * direction: a migrated call site quietly reverted, or the helper's result
 * spread into a literal that then overrides the part that matters. */

const MIGRATED = {
  'pos/screen-orders.jsx': 9,     // 3 from the first pass + the 6 correct copies
  'pos/customer-extras.jsx': 3,
  'pos/screen-merch.jsx': 1,
  'pos/payment.jsx': 1,
  'pos/sales-panel.jsx': 1,
  'delivery/dapp.jsx': 2,         // 1 from the first pass + the 1 correct copy
  'logistics/lorder.jsx': 2,
  'pos/screen-stubs.jsx': 6,   // 5 from the first pass + WeedmapsStatusPanel (2026-08-28)
  // ── the 2026-08-27 pass: correct-but-hand-typed, now on the helper ──
  'pos/product-shell.jsx': 3,
  'pos/checkin.jsx': 1,
  'pos/drawer.jsx': 1,
  'pos/product-sheet.jsx': 1,     // spreads the helper to keep its own fontFamily
  'pos/screen-cart.jsx': 1,
  'pos/screen-catalog.jsx': 1,
  'pweb/carousel.jsx': 1
};

test('every migrated call site still calls the helper, and none overrides the scroll', () => {
  for (const [f, n] of Object.entries(MIGRATED)) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const calls = src.match(/window\.overlayScrim\(/g) || [];
    assert.equal(calls.length, n,
      `${f}: expected ${n} window.overlayScrim(...) call(s), found ${calls.length} ` +
      '— a migrated modal was reverted to a hand-typed scrim');

    // Spreading the helper and then re-specifying the scroll would reinstate the
    // bug while still passing every count above. pos/customer-extras.jsx does
    // spread it (to keep a fontFamily the portal needs), so the shape is legal —
    // overriding these three keys is not.
    for (const key of ['overflowY', 'alignItems', 'position']) {
      const re = new RegExp('\\.\\.\\.window\\.overlayScrim\\([^)]*\\)[^}]*\\b' + key + ':');
      assert.equal(re.test(src), false,
        `${f}: a spread of window.overlayScrim(...) overrides "${key}" — that is ` +
        'the fix being undone one key at a time');
    }

    // And the card half, which is what keeps an overflowing card flush-top.
    const cards = src.match(/\.\.\.window\.overlayCard\b/g) || [];
    assert.equal(cards.length, n,
      `${f}: ${calls.length} scrim(s) but ${cards.length} card(s) spread ` +
      'window.overlayCard — a card without it pins to the top edge instead of centring');
  }
});
