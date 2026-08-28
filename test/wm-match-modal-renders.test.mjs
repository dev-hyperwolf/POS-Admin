/* ── THE MODAL THAT HAD NEVER RENDERED ──────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * 2026-08-27. `WmMatchModal` (pos/screen-catalog.jsx) threw
 * `ReferenceError: conf is not defined` on its FIRST render, every time, for
 * every SKU. Two lines survived the rewrite that deleted the fake matcher:
 *
 *     const level = conf >= 0.85 ? { t: 'High confidence', ... } : ...
 *     const cands = [ { ..., conf: conf }, ... ];
 *
 * `conf` was `wmConf`, deleted at screen-catalog.jsx:950 along with every other
 * number that screen used to manufacture. The rewrite replaced the whole render
 * — the modal now reads the engine's own verdict off the mapping board — but
 * left these two locals behind. NOTHING READ THEM. They were dead code that
 * still executed, which is the only kind that can kill a screen.
 *
 * A bare undeclared identifier is a ReferenceError, not an `undefined`. So this
 * was not a wrong number on a panel; it was a blank modal behind two live
 * buttons in the product detail panel. It survived because the rewrite was
 * careful about what it PRINTED and nobody opened the thing afterwards.
 *
 * WHAT IS ASSERTED, AND WHY EACH ONE
 * ----------------------------------
 *  1. REACHABILITY, established rather than assumed. If nothing could open it
 *     the honest fix would have been deletion, and that is a product call. It
 *     is reachable: a real click on the real button opens it.
 *  2. IT RENDERS. This is the check that would have caught the defect, and the
 *     mutation that restores `conf` must take it red. Content is asserted
 *     alongside the error list so that a swallowed exception cannot pass —
 *     "no errors" over a blank page is exactly the reading that let this live.
 *  3. NO BAND. The deleted line was not merely broken, it was unsourceable.
 *     The engine's floors are T_AUTO = 0.86 and T_AI = 0.50 (wmdemo/mapping.py)
 *     and NEITHER IS SERVED to this client, so 0.85 / 0.6 were never the
 *     engine's opinion: 0.85 would have printed "High confidence" over a score
 *     the engine refuses to auto-map, and 0.6 "Medium confidence" over one it
 *     had already escalated to AI review. Re-sourcing the band was not the fix.
 *     Refusing to draw one is, and the modal already says so in words.
 *  4. THE BAND IS NOT IN THE SOURCE EITHER — checked on the esbuild output, so
 *     the long comment above the fix (which quotes the dead strings verbatim)
 *     does not itself trip the check. A rendered-text assertion alone would go
 *     green on the day the band is re-added behind a state this fixture does
 *     not reach.
 *
 * ⚠️ `ResizeObserver is not defined` IS NAMED AND ALLOWED, NARROWLY. jsdom has
 * no ResizeObserver and the `ImageSlot` custom element reaches for one in
 * connectedCallback. That is a harness gap, not this screen's bug, and it is
 * the ONLY error tolerated — matched on its exact identifier, never on
 * "ReferenceError", or it would mask the very thing this file is here to catch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { withApp } from './ui-harness.mjs';

const SRC_PATH = new URL('../pos/screen-catalog.jsx', import.meta.url);

/** The four band labels the dead line would have printed. */
const BANDS = ['High confidence', 'Medium confidence', 'Low confidence', 'No match found'];

/** Everything except the one harness gap named in the header. */
const realErrors = (app) => app.errors.filter((e) => !/ResizeObserver is not defined/.test(e));

/**
 * Open the first product in the catalog, then the Weedmaps modal.
 * Returns whether the modal button was found and clicked.
 *
 * The product card is a `Card` div with an onClick, not a button, so
 * app.click() (which queries button/a/[data-hw-i]) cannot see it. Dispatch on
 * the node directly — it is still a real event through React's handler.
 */
async function openModal(app) {
  const D = app.window.document;
  const cards = [...D.querySelectorAll('div')]
    .filter((el) => /cursor: *pointer/.test(el.getAttribute('style') || ''));
  assert.ok(cards.length > 0, 'no clickable product row on the catalog screen');
  cards[0].dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await app.settle();
  const opened = app.click('Product match & mapping');
  await app.settle();
  return opened;
}

test('the Weedmaps match modal is reachable — a live control in the product panel opens it', async () => {
  await withApp('pos', async (app) => {
    await app.mount('CatalogScreen');
    const opened = await openModal(app);
    // If this ever goes false the modal is dead code and DELETION becomes the
    // honest fix — which is a product call, not this file's to make. Fail loudly
    // rather than quietly asserting nothing.
    assert.equal(opened, true,
      'no "Product match & mapping" control on the product detail panel — the modal '
      + 'is unreachable, which changes what the right fix is. Report, do not delete.');
  });
});

test('opening it renders the modal and raises no ReferenceError', async () => {
  await withApp('pos', async (app) => {
    await app.mount('CatalogScreen');
    await openModal(app);
    const t = app.text();

    // CONTENT FIRST. An empty error list over a blank page is the reading that
    // let a dead modal sit behind a live button, so prove the thing drew before
    // believing anything about the errors.
    for (const marker of ['Our product', 'Weedmaps product',
      'Candidates · ranked by the engine', 'external_id']) {
      assert.ok(t.includes(marker),
        `the modal did not render — "${marker}" is absent. Errors: `
        + (app.errors.join(' | ') || '(none)'));
    }

    // THE CHECK THAT WOULD HAVE CAUGHT IT.
    assert.deepEqual(realErrors(app), [],
      'rendering the Weedmaps match modal raised an error');
  });
});

test('it states no confidence band, because it cannot source one', async () => {
  await withApp('pos', async (app) => {
    await app.mount('CatalogScreen');
    await openModal(app);
    const t = app.text();
    for (const band of BANDS) {
      assert.ok(!t.includes(band),
        `the modal printed "${band}". T_AUTO and T_AI are not served to this client, `
        + 'so a band drawn here is this screen guessing at the engine\'s opinion and '
        + 'printing the guess in the engine\'s voice.');
    }
    // …and it says WHY, rather than leaving a silent gap where a number was.
    // THIS FIXTURE IS OFFLINE, so the sentence that reaches the page is the
    // candidate list's: the harness answers every POST with 503, and the modal
    // prints the server's own reason in place of a score. The board-row note
    // ("it carries no band") is the equivalent sentence one state further on
    // and is deliberately NOT asserted here — it needs a live mapping row,
    // which this fixture has no way to produce without stubbing the seam.
    assert.ok(t.includes('That is the server’s own reason, not a score'),
      'a refused request stopped saying it was refused. An absence with no account '
      + 'of itself reads as a missing feature rather than a refusal, and the next '
      + 'step from there is a zero standing in for "not computed".');
    assert.ok(!/\b0%|\b0\.00\b/.test(t),
      'a zero appeared where the answer is "not known" — 404 is not a 0%.');
  });
});

test('no confidence band is coded into pos/screen-catalog.jsx at all', () => {
  // esbuild strips comments, so the note documenting the deleted line — which
  // quotes all four labels verbatim — cannot trip this. Verified: the strings
  // are absent from the transform output and present in the raw source.
  const raw = readFileSync(SRC_PATH, 'utf8');
  const code = transformSync(raw, { loader: 'jsx', target: 'es2020' }).code;

  for (const band of BANDS) {
    assert.ok(!code.includes(band),
      `"${band}" is live code in pos/screen-catalog.jsx. The engine's floors `
      + '(T_AUTO 0.86 / T_AI 0.50) are not served here; any band is invented.');
  }
  // The guard above is only meaningful while the comment really is stripped.
  // If a future esbuild kept comments this test would pass vacuously.
  assert.ok(raw.includes('High confidence'),
    'the explanatory comment naming the deleted band is gone from the source, so '
    + 'this test can no longer prove that comments are what esbuild strips');
});
