/* ── pweb/app.jsx (the live "Promotions" screen) — TWO DEAD CONTROLS ─────────
 *
 * Both defects lived in the same screen, so they are fixed and tested together
 * rather than as two separate passes colliding on one file.
 *
 * 1. "SAVE DRAFT" HAD NO onClick. promo/builder-core.jsx's BuilderTopBar
 *    rendered `<PBtn variant="secondary" size="sm">Save draft</PBtn>` — no
 *    handler at all. Publish (right next to it) worked, because it alone
 *    carried `onClick={onSave}`. An operator building a promo who clicked
 *    "Save draft" instead of "Publish" got nothing: no toast, no navigation,
 *    no row in the list. The fix reuses the exact same persistence path as
 *    Publish (`M.draftToMerged` in pweb/merge.jsx, which already maps any
 *    non-'active' draft.status to the promo's 'draft' status) rather than
 *    inventing a second save mechanism — `saveBuilder(statusOverride)` in
 *    pweb/app.jsx now accepts an optional status to force before merging.
 *
 * 2. THE ANALYTICS ICON WAS WIRED TO A VIEW THAT DOES NOT EXIST.
 *    pweb/screens.jsx's Dashboard (aliased to window.LegacyDashboard, the one
 *    actually mounted by pweb/app.jsx's Suite) already calls
 *    `onAnalytics(p.id)` from its chart-line IconBtn. But Suite's own
 *    `goAnalytics` was `(id) => {setAnalyticsId(id); setView('home');}` —
 *    it set the id and then navigated back to the SAME view the icon was
 *    already on. Suite's render switch had no `view === 'analytics'` branch
 *    at all, despite `promo/analytics-center.jsx` defining a complete,
 *    already-working `window.AnalyticsCenter` (loaded by every entry HTML
 *    that loads the suite) that nothing ever mounted. The fix points
 *    `goAnalytics` at a new `'analytics'` view and renders
 *    `<window.AnalyticsCenter/>` there.
 *
 * Both tests drive the REAL Suite() component from pweb/app.jsx. That file
 * self-mounts (`ReactDOM.createRoot(...).render(<Suite/>)` at its own end,
 * same shape as pos/app.jsx), and test/ui-harness.mjs deliberately skips
 * loading any file matching `/app.jsx$/` — see its `scriptsFor` comment — so
 * it is loaded and evaluated by hand here, exactly the way
 * test/error-boundary.test.mjs does for pos/app.jsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { boot } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Boot the Promotions Suite *and* its real shell, which the harness skips. */
async function bootPromoSuite() {
  const app = await boot('Promotions Suite.html');
  try {
    const code = readFileSync(ROOT + 'pweb/app.jsx', 'utf8');
    const out = esbuild.transformSync(code, { loader: 'jsx', target: 'es2020' }).code;
    app.window.eval('(function(){' + out + '\n})();');
    await app.settle();
    return app;
  } catch (err) {
    app.close();
    throw err;
  }
}

/* ── 1 · SAVE DRAFT MUST ACTUALLY SAVE ───────────────────────────────────── */

test('clicking "Save draft" in the promotion builder persists the promo as a draft', async () => {
  const app = await bootPromoSuite();
  try {
    // Enter the builder the same way an operator does — the top bar's own
    // "New promotion" button (SuiteTopBar, onClick={onNew}).
    assert.ok(app.click('New promotion'),
      `no "New promotion" control on the Promotions screen — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.ok(app.buttons().includes('Save draft'),
      'the builder opened but has no "Save draft" button — this test is not testing the right screen');

    const NAME = 'ZZ Save Draft Regression Promo';
    assert.ok(app.type('e.g. Green Wednesday BOGO', NAME),
      'no promotion-name field in the builder (MetaFields)');
    await app.settle();

    assert.ok(app.click('Save draft'), 'no "Save draft" button to click');
    await app.settle();

    // The builder must have actually closed. Before the fix this button had no
    // onClick at all, so nothing below ever happened: the operator stayed on
    // the same builder screen with the same unsaved draft, silently.
    assert.ok(!app.buttons().includes('Save draft') && !app.buttons().includes('Publish'),
      'the builder is still open after clicking "Save draft" — the handler did nothing, '
      + 'which is exactly the original bug (no onClick at all)');

    // Get back to the Promotions list and prove a real row was written, with
    // real draft status — not just that the builder happened to close.
    assert.ok(app.click('Promotions'), 'no way back to the Promotions tab');
    await app.settle();
    assert.ok(app.click((t) => t.startsWith('Draft')),
      `no "Draft" status filter on the Promotions list — buttons: ${app.buttons().join(' | ')}`);
    await app.settle();

    assert.ok(app.text().includes(NAME),
      'the promo the operator named is not in the Promotions list at all after "Save draft" — '
      + 'nothing was persisted');
  } finally { app.close(); }
});

test('"Save draft" saves as a draft even when the builder\'s own Status toggle is left on Active',
  async () => {
    const app = await bootPromoSuite();
    try {
      assert.ok(app.click('New promotion'), 'no "New promotion" control');
      await app.settle();

      const NAME = 'ZZ Draft Overrides Active Toggle';
      assert.ok(app.type('e.g. Green Wednesday BOGO', NAME), 'no promotion-name field');
      await app.settle();

      // Builder defaults draft.status to 'active' (window.newDraft in
      // promo/builder-core.jsx) — leave the Status Seg exactly as it starts.
      assert.ok(app.click('Save draft'), 'no "Save draft" button');
      await app.settle();

      assert.ok(app.click('Promotions'), 'no way back to the Promotions tab');
      await app.settle();
      // The "Live" filter must NOT show this promo — if Save draft merely
      // called the same save path with no status override, draft.status
      // would still read 'active' and M.draftToMerged would file it as 'live'.
      assert.ok(app.click((t) => t.startsWith('Live')), 'no "Live" status filter');
      await app.settle();
      assert.ok(!app.text().includes(NAME),
        '"Save draft" filed the promo as Live — it saved the builder\'s default status instead of '
        + 'forcing draft, so the button is indistinguishable from Publish');

      assert.ok(app.click((t) => t.startsWith('Draft')), 'no "Draft" status filter');
      await app.settle();
      assert.ok(app.text().includes(NAME),
        '"Save draft" did not file the promo under Draft either — it went nowhere');
    } finally { app.close(); }
  });

/* ── 2 · THE ANALYTICS ICON MUST OPEN THE REAL ANALYTICS CENTER ──────────── */

test('the Analytics icon on a promotion row mounts the real AnalyticsCenter', async () => {
  const app = await bootPromoSuite();
  try {
    // Confirm AnalyticsCenter loaded at all — a false positive here (e.g. a
    // boundary swallowing a render error) would make the rest of this test
    // meaningless.
    assert.equal(typeof app.window.AnalyticsCenter, 'function',
      'promo/analytics-center.jsx did not define window.AnalyticsCenter — nothing to mount');

    // No text-content match works here: IconBtn (pos/atoms.jsx) renders a bare
    // <button title="Analytics"><svg/></button> with no visible label.
    const analyticsBtn = [...app.document.querySelectorAll('button[title="Analytics"]')][0];
    assert.ok(analyticsBtn,
      'no chart-line "Analytics" icon rendered on any promotion row — pweb/screens.jsx only shows '
      + 'it for promos with perf data, which the seed data provides');

    assert.doesNotMatch(app.text(), /Analytics command center/,
      'the analytics screen is already showing before the icon was clicked — this test cannot '
      + 'tell whether the click did anything');

    analyticsBtn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    // Before the fix, goAnalytics() set analyticsId and then navigated to
    // 'home' — the SAME view the icon lives on — and Suite's render switch had
    // no 'analytics' branch at all, so nothing ever changed on screen.
    assert.match(app.text(), /Analytics command center/,
      'clicking the Analytics icon did not mount AnalyticsCenter — the icon still does nothing');
    assert.match(app.text(), /Redemptions over time/,
      'AnalyticsCenter did not render its metrics — check it actually mounted rather than just '
      + 'a stray heading');

    // And the screen must not be a dead end: the existing "Promotions" tab
    // has to be able to leave it.
    assert.ok(app.click('Promotions'), 'no way back out of the analytics screen');
    await app.settle();
    assert.doesNotMatch(app.text(), /Analytics command center/,
      'clicking back to Promotions did not leave the analytics view');
  } finally { app.close(); }
});
