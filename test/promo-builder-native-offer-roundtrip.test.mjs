/* ── pweb/merge.jsx + promo/builder-blocks.jsx — POINTS/TIERED/DOLLAR/BUNDLE
 *    PROMOS WERE PERMANENTLY DESTROYED BY OPEN+SAVE ────────────────────────
 *
 * THE BUG: opening ANY promo whose real discount was 'points', 'tiered',
 * 'dollar' or 'bundle' in the Promotions Builder and clicking Save (either
 * button — "Save draft" or "Publish") silently rewrote it into a generic
 * "spend $X, get %off" rule. The original points multiplier, tier
 * breakpoints, fixed dollar amount, or bundle description were gone for
 * good — there was no way back to them once saved.
 *
 * ROOT CAUSE: pweb/merge.jsx bridges TWO promo models that predate each
 * other by four days: the rule/condition/reward IF/THEN taxonomy
 * (promo/pdata.jsx's ENTITIES + REWARDS, edited by promo/builder-blocks.jsx)
 * and the older `discount:{kind,...}` shape every promo actually carries
 * (pweb/module.jsx's seedPromos/OFFERS — 'percent'|'dollar'|'bogo'|'bundle'|
 * 'gift'|'tiered'|'points'). mergedToDraft() ran EVERY promo's discount
 * through discountToRule() to populate the Builder, and draftToMerged() ran
 * the resulting rule back through ruleToOffer() on save. ruleToOffer() can
 * only PRODUCE 'percent' | 'bogo' | 'gift' — it has no branch that emits
 * 'points', 'tiered', 'dollar' or 'bundle' at all, and the rule model itself
 * (REWARDS in promo/pdata.jsx: discount_self, free_product, discount_other)
 * has no slot for a points multiplier, a tier table, or a bundle
 * description. So a tiered promo's `tiers` array, a points promo's
 * multiplier, a dollar promo's fixed amount + minimum spend, and a bundle's
 * hand-written description were all discarded on the very first save,
 * whether or not the operator touched a single field.
 *
 * THE FIX: mergedToDraft()/draftToMerged() in pweb/merge.jsx now detect
 * these four kinds (NATIVE_OFFER_KINDS) and copy `discount` straight into
 * `draft.nativeOffer` / back out again, never through ruleToOffer(). The
 * Builder (promo/builder-blocks.jsx) routes a draft carrying `nativeOffer`
 * to promo/builder-native.jsx's window.NativeOfferEditor, which renders and
 * edits each kind's REAL fields (points multiplier, editable tier rows,
 * dollar amount + minimum, bundle description) instead of the generic
 * IF/THEN canvas.
 *
 * These tests drive the REAL Suite() from pweb/app.jsx, the same way
 * test/promo-save-draft-and-analytics.test.mjs does, and prove round-trips
 * through the actual DOM: open a seeded promo of each kind, confirm its real
 * fields render (not the generic rule canvas), edit a field, save, and
 * confirm the promotions list still shows the promo's real, updated offer —
 * not a collapsed "%off" rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { boot } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

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

/** Set an <input>'s value the way a real keystroke would, bypassing React's
 * value-setter interception (same trick test/ui-harness.mjs's own `type()`
 * uses for placeholder-addressed fields — this is for fields that have
 * none). */
function setValue(app, el, value) {
  const setter = Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}

function inputs(app) { return [...app.window.document.querySelectorAll('input')]; }
function findInput(app, value) { return inputs(app).find((i) => i.value === String(value)); }

/* ── TIERED: '4th of July Blowout' — discount:{kind:'tiered', scope:'cart',
 *    tiers:[{min:100,value:15},{min:200,value:25}]} ─────────────────────── */

test('opening a tiered promo shows its real tier breakpoints, not the IF/THEN rule canvas', async () => {
  const app = await bootPromoSuite();
  try {
    assert.ok(app.click((t) => t.includes('4th of July Blowout')),
      `no row for the seeded tiered promo — rows found: ${app.text().slice(0, 400)}`);
    await app.settle();

    // The generic rule canvas (BuilderBlocks) must NOT be what rendered —
    // before the fix this is exactly where the tiers got flattened away.
    assert.ok(!app.buttons().includes('Add condition block'),
      'the generic IF/THEN rule canvas rendered for a tiered promo — it has no way to represent '
      + 'tier breakpoints, which is the entire bug');

    // Both real tier breakpoints must be on screen as editable fields. The
    // OLD buggy path (discountToRule\'s catch-all branch) would show a
    // "spend more than $1" condition instead — never 100 or 200.
    assert.ok(findInput(app, 100), 'tier 1\'s $100 spend threshold is not rendered as an editable field');
    assert.ok(findInput(app, 15), 'tier 1\'s 15% reward is not rendered as an editable field');
    assert.ok(findInput(app, 200), 'tier 2\'s $200 spend threshold is not rendered as an editable field');
    assert.ok(findInput(app, 25), 'tier 2\'s 25% reward is not rendered as an editable field');
  } finally { app.close(); }
});

test('a tiered promo round-trips through Save unchanged, and an edited tier persists', async () => {
  const app = await bootPromoSuite();
  try {
    assert.ok(app.click((t) => t.includes('4th of July Blowout')), 'no row for the tiered promo');
    await app.settle();

    // Edit tier 2's reward from 25% to 30%, proving the write path (not just
    // pass-through) works.
    const tier2 = findInput(app, 25);
    assert.ok(tier2, 'tier 2\'s 25% field is missing before the edit');
    setValue(app, tier2, '30');
    await app.settle();

    assert.ok(app.click('Publish'), 'no Publish control in the native offer editor');
    await app.settle();

    // saveBuilder() lands on the 'studio' view (pweb/app.jsx), not the
    // Promotions list — go there explicitly, the same way
    // test/promo-save-draft-and-analytics.test.mjs does after its own save.
    assert.ok(app.click('Promotions'), 'no way back to the Promotions tab after saving');
    await app.settle();

    // Back on the list, the Offer column reads straight from the real
    // `discount` object (pweb/module.jsx offerLabel's 'tiered' branch:
    // "$100→15%  ·  $200→30%"). Before the fix this promo would have come
    // back reading "1% off" or a stray "15% off (up to $50)" — never a tier
    // table — because ruleToOffer() cannot emit kind:'tiered' at all.
    assert.match(app.text(), /\$100.{0,3}15%/,
      'tier 1 ($100 → 15%) did not survive the save — the tier table was destroyed');
    assert.match(app.text(), /\$200.{0,3}30%/,
      'the edited tier 2 ($200 → 30%) is not reflected after save — either the edit was not '
      + 'written, or the whole discount object was replaced by something generic');

    // Re-open and confirm the tier table itself, not just its list summary,
    // still carries both breakpoints — a real read-after-write on the
    // promo's actual stored discount.
    assert.ok(app.click((t) => t.includes('4th of July Blowout')), 'cannot re-open the promo after saving it');
    await app.settle();
    assert.ok(findInput(app, 100), 'tier 1\'s $100 threshold did not survive re-opening after save');
    assert.ok(findInput(app, 200), 'tier 2\'s $200 threshold did not survive re-opening after save');
    assert.ok(findInput(app, 30), 'the edited tier 2 value (30%) did not survive re-opening after save');
  } finally { app.close(); }
});

/* ── POINTS: 'Points Redemption Boost' — discount:{kind:'points', value:1.5,
 *    scope:'cart'} ────────────────────────────────────────────────────────
 */

test('a points-multiplier promo shows its real multiplier and round-trips an edit', async () => {
  const app = await bootPromoSuite();
  try {
    assert.ok(app.click((t) => t.includes('Points Redemption Boost')), 'no row for the seeded points promo');
    await app.settle();
    assert.ok(!app.buttons().includes('Add condition block'),
      'the generic rule canvas rendered for a points promo instead of the native points editor');

    const mult = findInput(app, 1.5);
    assert.ok(mult, 'the real 1.5× points multiplier is not rendered as an editable field');
    setValue(app, mult, '3');
    await app.settle();

    assert.ok(app.click('Publish'), 'no Publish control');
    await app.settle();
    assert.ok(app.click('Promotions'), 'no way back to the Promotions tab after saving');
    await app.settle();

    // offerLabel's 'points' branch: `${d.value}× points on ${scope}`.
    assert.match(app.text(), /3×\s*points/,
      'the edited points multiplier (3×) is not reflected on the promotions list after save — '
      + 'before the fix this promo\'s kind would have been overwritten to \'percent\' entirely');
  } finally { app.close(); }
});

/* ── DOLLAR: 'Welcome — $20 Off First Order' — discount:{kind:'dollar',
 *    value:20, scope:'cart', min:60} ─────────────────────────────────────
 */

test('a fixed dollar-off promo shows its real amount and minimum spend, and round-trips an edit', async () => {
  const app = await bootPromoSuite();
  try {
    assert.ok(app.click((t) => t.includes('Welcome') && t.includes('First Order')), 'no row for the seeded dollar-off promo');
    await app.settle();
    assert.ok(!app.buttons().includes('Add condition block'),
      'the generic rule canvas rendered for a dollar-off promo instead of the native $-off editor');

    assert.ok(findInput(app, 20), 'the real $20 discount amount is not rendered as an editable field');
    const min = findInput(app, 60);
    assert.ok(min, 'the real $60 minimum spend is not rendered as an editable field');
    setValue(app, min, '75');
    await app.settle();

    assert.ok(app.click('Publish'), 'no Publish control');
    await app.settle();
    assert.ok(app.click('Promotions'), 'no way back to the Promotions tab after saving');
    await app.settle();

    // offerLabel's 'dollar' branch: `$${value} off orders $${min}+`.
    assert.match(app.text(), /\$20 off orders \$75\+/,
      'the edited minimum spend ($75) is not reflected after save with the original $20 amount '
      + 'intact — before the fix this promo\'s minimum-spend condition and fixed amount were both '
      + 'discarded in favor of a generic percent-off rule');
  } finally { app.close(); }
});

/* ── BUNDLE: 'Weekend Flower Bundle' — discount:{kind:'bundle',
 *    scope:'category', items:['Flower'], text:'Buy 2 eighths, get a 3rd for
 *    half price'} ─────────────────────────────────────────────────────────
 */

test('a bundle promo shows its real hand-written description and round-trips an edit', async () => {
  const app = await bootPromoSuite();
  try {
    assert.ok(app.click((t) => t.includes('Weekend Flower Bundle')), 'no row for the seeded bundle promo');
    await app.settle();
    assert.ok(!app.buttons().includes('Add condition block'),
      'the generic rule canvas rendered for a bundle promo instead of the native bundle editor');

    const desc = findInput(app, 'Buy 2 eighths, get a 3rd for half price');
    assert.ok(desc, 'the bundle\'s real hand-written description is not rendered as an editable field');
    setValue(app, desc, 'Buy 2 eighths, get a 3rd FREE');
    await app.settle();

    assert.ok(app.click('Publish'), 'no Publish control');
    await app.settle();
    assert.ok(app.click('Promotions'), 'no way back to the Promotions tab after saving');
    await app.settle();

    // offerLabel's 'bundle' branch returns `d.text` verbatim.
    assert.match(app.text(), /Buy 2 eighths, get a 3rd FREE/,
      'the edited bundle description is not reflected on the promotions list after save — before '
      + 'the fix a bundle promo\'s entire hand-written description was discarded and replaced by a '
      + 'generic percent-off rule with no description at all');
  } finally { app.close(); }
});
