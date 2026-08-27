/* The four states of the "Line items · from the Weedmaps payload" banner.
 *
 * WHY THIS FILE EXISTS. The banner was wrong three times in a row and no test
 * ever asserted it, which is precisely why each fix shipped with the next bug
 * in it:
 *
 *   v1  UNCONDITIONAL. "STILL MOCK" rendered on every pass with no check on
 *       whether a payload had arrived, so a developer watching lines resolve
 *       perfectly was told the opposite.
 *   v2  BINARY (`if (!d)`), which is one condition too few in BOTH directions:
 *       `loading` is `!!_inflight || (!d && !err)`, so during the fetch the red
 *       "nothing below is a real order line" rendered directly above the
 *       panel's own "Reading..." note; and a found:false payload carries counts
 *       and lines:[] (verified against order_lines('999999999')), so it PASSES
 *       validation, lands in _lines, and drew the GREEN "live payload" banner
 *       over an order that is not in the database at all.
 *   v3  this. Four states, asserted here.
 *
 * The correct tri-state was one line away the whole time -- the status dot uses
 * `d ? good : err ? bad : inkFaint`. The dot was ternary and the banner binary,
 * in the same component. That is the bug this file is really guarding.
 *
 * It also guards the claim the banner MAY NOT MAKE. It used to end "the sheet
 * behind this panel prefers them". It cannot know that: screen-orders.jsx picks
 * o.lines -> this seam -> mock, gated on isLiveOrder(o) and state==='live', so
 * on a demo order, an empty lineItems array, or an edited order, the sheet
 * never consulted the seam. Asserting the absence of that claim is the point.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../shared/hw-live-lines.js', import.meta.url), 'utf8');

/** The banner block, extracted so these assertions cannot drift onto other copy. */
function bannerBlock() {
  const i = SRC.indexOf('var banner = null;');
  assert.ok(i > 0, 'banner state machine not found — did it get rewritten?');
  const j = SRC.indexOf('if (banner) {', i);
  assert.ok(j > i, 'banner render not found');
  return SRC.slice(i, j);
}

test('the banner has four distinct states, not two', () => {
  const b = bannerBlock();
  for (const branch of ['loading', 'err', '!d.found', 'd.lines.length']) {
    assert.ok(b.includes(branch), `banner does not branch on ${branch}`);
  }
});

test('loading renders NO banner — it must not claim mock before it knows', () => {
  const b = bannerBlock();
  const m = b.match(/if \(loading\) \{\s*banner = (null|\[)/);
  assert.ok(m, 'no explicit loading branch');
  assert.equal(m[1], 'null',
    'loading must yield NO banner; v2 rendered the red mock warning during the fetch');
});

test('found:false is NOT green — it is a definite answer, not a live payload', () => {
  const b = bannerBlock();
  const i = b.indexOf('!d.found');
  const seg = b.slice(i, i + 400);
  assert.ok(seg.includes("'bad'"), 'found:false must use the bad tone');
  assert.ok(!seg.includes("'good'"), 'found:false must never render as a live payload');
});

test('found-but-empty is its own state, distinct from not-found and from unread', () => {
  const b = bannerBlock();
  assert.ok(b.includes("'warn'"),
    'an order that exists with zero lines must not share a tone with "never looked"');
});

test('the banner never claims to know what the sheet chose', () => {
  const b = bannerBlock();
  assert.ok(!/sheet behind this panel prefers/i.test(b),
    'the panel cannot see which leg screen-orders.jsx took and must not assert it');
  assert.ok(/not visible from here|decided in screen-orders/i.test(b),
    'the banner should say the sheet\'s choice is not visible from here');
});

/** Source with `//` comments stripped. The first cut of the test below scanned
 *  raw source and failed on the file's own header prose and on the comment
 *  explaining this very history -- acheck that flags its own documentation is
 *  noise, and noise is what gets a real failure ignored. Only what RENDERS
 *  counts. */
function code() {
  return SRC.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
}

test('no rendered surface still asserts "still mock"', () => {
  // There were THREE writers, not the two the review found: the panel, the
  // docked seam panel, and a short third one. Fixing one is not fixing the
  // message.
  assert.ok(!/still mock/i.test(code()),
    'a rendered surface still claims "still mock" unconditionally');
});

test('no surface still points at the stale screen-orders.jsx:1486', () => {
  const hits = [...SRC.matchAll(/screen-orders\.jsx:1486/g)];
  for (const h of hits) {
    const around = SRC.slice(Math.max(0, h.index - 200), h.index + 120);
    assert.ok(/STALE|stale/.test(around),
      'screen-orders.jsx:1486 is now a closing div; any surviving reference must be marked stale');
  }
});
