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

test('the banner has five distinct states, not two', () => {
  const b = bannerBlock();
  for (const branch of ['loading', 'err', 'notfound', 'empty', 'good']) {
    assert.ok(b.includes(branch), `banner does not branch on ${branch}`);
  }
});

test('loading renders NO banner — it must not claim mock before it knows', () => {
  const b = bannerBlock();
  const m = b.match(/if \(lstate === 'loading'\) \{\s*banner = (null|\[)/);
  assert.ok(m, 'no explicit loading branch');
  assert.equal(m[1], 'null',
    'loading must yield NO banner; v2 rendered the red mock warning during the fetch');
});

test('found:false is NOT green — it is a definite answer, not a live payload', () => {
  const b = bannerBlock();
  const i = b.indexOf("lstate === 'notfound'");
  assert.ok(i > 0, 'no explicit not-found branch');
  const seg = b.slice(i, i + 400);
  assert.ok(seg.includes("'bad'"), 'found:false must use the bad tone');
  assert.ok(!seg.includes("'good'"), 'found:false must never render as a live payload');
});

test('found-but-empty is its own state, distinct from not-found and from unread', () => {
  const b = bannerBlock();
  assert.ok(b.includes("'warn'"),
    'an order that exists with zero lines must not share a tone with "never looked"');
});

/* THE DOT AND THE BANNER ARE ONE DERIVATION.
 * v3 widened the banner to four states and left the status dot at three
 * (`d ? P.good : err ? P.bad : P.inkFaint`). `d` is truthy on found:false, so
 * the dot rendered GREEN beside the red ORDER NOT FOUND banner, and green again
 * beside the amber FOUND, NO LINES — and the dot is the faster read. "Add a
 * state" was the wrong remedy here; "branch on the state you already have" was.
 * v4 computes the state once and both surfaces switch on it. */
test('the status dot branches on the same state the banner does', () => {
  assert.ok(/var lstate = /.test(SRC), 'no single lstate expression');
  assert.ok(!/background: d \? P\.good : err \? P\.bad : P\.inkFaint/.test(SRC),
    'the dot is still derived from `d` — it goes green on found:false');
  assert.ok(/background: DOT\[lstate\]/.test(SRC),
    'the dot must read the same five-way state the banner switches on');
  assert.ok(/DOT = \{[^}]*notfound: P\.bad[^}]*\}/.test(SRC),
    'found:false must not be green under any reading');
  assert.ok(/DOT = \{[^}]*empty: P\.warn[^}]*\}/.test(SRC),
    'found-but-empty must not be green either');
});

/* WHAT THE SHEET IS DRAWING. The banner once ended "the sheet behind this panel
 * prefers them", INFERRING the sheet's leg from its own cache. The fix at the
 * time disclaimed the fact entirely ("not visible from here"). That disclaimer
 * went stale the moment HW.orderLineSource shipped and screen-orders.jsx began
 * consuming it: the panel can now state the answer, so refusing to is its own
 * defect — it sends the operator to read source code for something one call
 * away. Neither the guess nor the disclaimer is acceptable; the published
 * answer is, and an ABSENT publisher is stated specifically. */
test('the banner reports the sheet\'s leg from the ONE published definition', () => {
  const b = bannerBlock();
  assert.ok(!/sheet behind this panel prefers/i.test(b),
    'the panel must not INFER which leg screen-orders.jsx took from its own cache');
  assert.ok(!/not visible from here/i.test(b),
    'HW.orderLineSource publishes this — the panel must not disclaim knowing it');
  assert.ok(/sheetSentence\(\)/.test(b),
    'the live banner should state the sheet\'s leg via sheetSentence()');
  assert.ok(/HW\.orderLineSource/.test(SRC),
    'sheetSentence must be derived from HW.orderLineSource, not re-implemented');
  assert.ok(/orderLineSource is not loaded on this page/.test(SRC),
    'an absent orderLineSource must be stated specifically, not as "cannot be known"');
});

/* The err branch asserted the sheet's leg — the very claim the good branch said
 * it could not make — and asserted it WRONGLY on an edited order, where
 * orderLineSource returns 'edited' and the sheet is drawing real human-edited
 * lines. It told the operator those were "hardcoded mock products", and an
 * operator who believes it discards a real line table as fake. */
test('the error branch does not name mock products it has not checked for', () => {
  const i = SRC.indexOf("lstate === 'err'", SRC.indexOf('var body = []'));
  assert.ok(i > 0, 'no err branch in the body');
  const seg = SRC.slice(i, i + 1200);
  assert.ok(!/hardcoded mock products/i.test(seg.replace(/^\s*\/\/.*$/gm, '')),
    "the err branch must not name 'hardcoded mock products' — on an edited order that is false");
  assert.ok(/sheetSentence\(\)/.test(seg),
    'the err branch must use the same published answer the live branch uses');
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

/* ── THE THIRD AND FOURTH SURFACES ──────────────────────────────────────────
 * The in-sheet banner was wired to HW.orderLineSource and the DOCKED seam panel
 * was not, so this file shipped two rendered surfaces contradicting each other
 * on the same fact: the banner stating the sheet's leg, and the docked panel
 * still saying "Which one it took is decided there, not here." That is the same
 * two-writer shape the "still mock" test above already exists to catch — found
 * twice before in this one file, which is why it is asserted rather than
 * remembered.
 *
 * A DISCLAIMER IS A CLAIM. "Not visible from here" was true when written and
 * false the moment cc47fbc shipped HW.orderLineSource. Nothing revisits a
 * sentence that sounds modest, so its staleness has to be enforced from
 * outside the file. */
function panelBodyBlock() {
  const i = SRC.indexOf('function panelBodyHTML(');
  assert.ok(i > 0, 'panelBodyHTML not found — did the docked panel get renamed?');
  const j = SRC.indexOf('function pillBits(', i);
  assert.ok(j > i, 'could not delimit panelBodyHTML');
  return SRC.slice(i, j).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
}

test('the docked seam panel reports the published leg instead of disclaiming it', () => {
  const b = panelBodyBlock();
  assert.ok(!/decided there, not here|cannot see which leg|not visible from here/i.test(b),
    'the docked panel still disclaims a fact HW.orderLineSource publishes');
  assert.ok(/sheetLegSentence\(/.test(b),
    'the docked panel must read the SAME published answer the banner does, not re-derive it');
});

/** The leg sentence, which must have exactly one definition in this file. */
function legFn() {
  const hits = [...SRC.matchAll(/function sheetLegSentence\(/g)];
  assert.equal(hits.length, 1,
    'sheetLegSentence must be defined exactly once — two copies that agree today are a scheduled outage');
  const i = hits[0].index;
  const j = SRC.indexOf('\n  }\n', i);
  assert.ok(j > i, 'could not delimit sheetLegSentence');
  return SRC.slice(i, j);
}

/* NULL IS NOT 'mock'. orderLineSource returns null for "no order was asked
 * about" and 'mock' for "asked, and the sheet is drawing the demo cart".
 * Rendering them identically throws away the distinction the API was created to
 * carry, and does it invisibly — both sentences look fine on screen. Asserted
 * by comparing the two returns, so a copy-paste that collapses them fails here
 * rather than in front of an operator. */
test('null renders differently from "mock" — no order at all is its own answer', () => {
  const fn = legFn();
  const mockAt = fn.indexOf("src === 'mock'");
  assert.ok(mockAt > 0, 'no explicit mock branch in sheetLegSentence');
  const mockReturn = /return ([\s\S]*?);/.exec(fn.slice(mockAt))[1];
  const returns = [...fn.matchAll(/return ([\s\S]*?);/g)].map((m) => m[1]);
  const fallthrough = returns[returns.length - 1];
  assert.notEqual(fallthrough, mockReturn,
    'the no-order (null) case renders identically to mock — that collapse is what HW.orderLineSource exists to prevent');
  assert.ok(/demo cart/i.test(mockReturn), "the 'mock' branch should name the bundled demo cart");
  assert.ok(!/demo cart/i.test(fallthrough),
    'the no-order case must not claim the sheet is drawing a demo cart — it was never asked');
});

/* An ABSENT orderLineSource is its own answer, not a flavour of "unknown". This
 * file loads on pages that do not carry pos/data.jsx, and the fix for that
 * (serve the page beside data.jsx) is different from every other branch's. */
test('an absent orderLineSource is named, not folded into "cannot be known"', () => {
  const fn = legFn();
  assert.ok(/orderLineSource is not loaded on this page/.test(fn),
    'an absent publisher must be stated specifically');
  assert.ok(/typeof W\.HW\.orderLineSource === 'function'/.test(fn),
    'sheetLegSentence must feature-detect the publisher rather than assume it');
});

/* ── AND NOW RUN IT ─────────────────────────────────────────────────────────
 * Every assertion above this line reads the SHAPE of the branches. None of them
 * has ever executed one, and a regex that matches is not an answer that
 * renders — the previous three cuts of this banner all had branches that looked
 * right in source. sheetLegSentence lives inside the file's IIFE and is not
 * exported, so it is lifted out BY SOURCE TEXT and run against a fake `W`. The
 * code under test is the byte-for-byte shipped function, not a restatement of
 * it: if the extraction stops matching, legFn() fails loudly rather than
 * quietly testing nothing. */
function legSentenceFor(orderLineSource, ord) {
  const body = legFn() + '\n  }';
  const make = new Function('W', body + '\n  return sheetLegSentence;');
  return make({ HW: orderLineSource === undefined ? {} : { orderLineSource } })(ord);
}

test('every answer the API can give renders as a DIFFERENT sentence', () => {
  const said = {
    edited: legSentenceFor(() => 'edited', { id: 'o1', lines: [{}] }),
    weedmaps: legSentenceFor(() => 'weedmaps', { id: 'o1' }),
    mock: legSentenceFor(() => 'mock', { id: 'o1' }),
    noOrder: legSentenceFor(() => null, null),
    noPublisher: legSentenceFor(undefined, { id: 'o1' })
  };
  const vals = Object.values(said);
  assert.equal(new Set(vals).size, vals.length,
    'two of the five answers render identically:\n' + JSON.stringify(said, null, 2));
  // The one collapse that matters most, named on its own so the failure says why.
  assert.notEqual(said.noOrder, said.mock,
    'null read the same as mock at RUNTIME — "nothing was asked" is not "the sheet is drawing the demo cart"');
  assert.match(said.edited, /EDITED/);
  assert.match(said.weedmaps, /Weedmaps payload lines/);
  assert.match(said.mock, /demo cart/);
  assert.ok(!/demo cart/i.test(said.noOrder));
  assert.match(said.noPublisher, /not loaded on this page/);
  // These sentences render on the in-sheet banner AND on the docked seam panel,
  // which is not behind any sheet. "the sheet behind this panel" was true on one
  // and false on the other — sharing a sentence only helps if it is true on both.
  for (const [leg, text] of Object.entries(said)) {
    assert.ok(!/behind this panel/i.test(text),
      `the "${leg}" sentence names a sheet behind the panel; the docked seam panel has none`);
  }
});

/* orderLineSource reaches back into HW_LINES.get for its 'weedmaps' leg, so it
 * can throw. A banner that disappears because the sentence under it threw is
 * worse than the stale sentence this whole change replaced. */
test('a throwing orderLineSource is reported, not propagated', () => {
  const out = legSentenceFor(() => { throw new Error('boom'); }, { id: 'o1' });
  assert.match(out, /threw \(boom\)/,
    'a throw in the publisher must be reported as itself, not crash the panel');
});

/* An unrecognised leg — a sixth string added to orderLineSource and not to this
 * file — must not be silently drawn as "no order was asked about". It falls to
 * the same terminal branch as null, which is the one place this design is
 * lossy; asserting it here is how that stays a known cost instead of a surprise. */
test('an unrecognised leg falls to the no-answer sentence, not to a leg it is not', () => {
  const out = legSentenceFor(() => 'something-new', { id: 'o1' });
  assert.ok(!/demo cart|EDITED|drawing these rows/.test(out),
    'an unknown leg must never be drawn as one of the three known legs');
});
