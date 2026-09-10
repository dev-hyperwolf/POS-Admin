/* ── THE DISPLAY-SAMPLE FLAG MUST SURVIVE THE STORE ──────────────────────────
 *
 * The Add Product flow makes a promise in its own confirmation copy:
 *
 *     "Marked as a display sample — Kept off the sellable menu, still tracked
 *      as a full product profile."
 *
 * pos/shell-store.jsx `seed()` broke it in the rebuild, with a literal:
 *
 *     variations: items.map((p) => ({ …, active: p.active, sample: false, … }))
 *
 * THIS FILE, ORIGINALLY. Every variation reconstructed from a stored item
 * came back `sample: false` whatever the item said — the client-side seed()
 * rebuild threw the flag away before Weedmaps ever got a chance to honour or
 * break the owner's rule that a staff sample is NEVER mapped to a Weedmaps
 * product.
 *
 * REWIRED 2026-09-09 (docs/SHELLS-PLAN-2026-09-09.md). `seed()`, `addVariation`
 * and the client-side `SHELLS` mock are gone: shells and their variations now
 * come from the server (GET /api/shells/<id> -> products[]), and `sample` is
 * read straight off the product row the server hands back — there is no
 * client rebuild left to lose it. This file now proves the NEW round trip:
 * a product the fake backend marks `sample: true` renders with the Sample
 * tag on the shell detail screen, and creating a variation with the toggle on
 * sends `sample: true` in the POST body the store makes.
 *
 * ⚠️ THE INFERENCE THAT MUST NEVER BE MADE, still true here: `sample` is its
 * own field, never inferred from low/zero inventory or a switched-off product.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';
import { makeShellsFixture } from './shells-fetch-stub.mjs';

// ── 1 · A SAMPLE FROM THE SERVER RENDERS AS ONE ─────────────────────────────

// The shell card is a Card (a <div onClick>, atoms.jsx) — not a <button>, <a>
// or [data-hw-i] — so app.click()'s restricted selector cannot find it. Any
// element carrying the "Open shell" text bubbles a click up to the Card's own
// handler, the same way a real click on nested content would in a browser.
const clickOpenShell = (app) => {
  const el = [...app.document.querySelectorAll('span')].find((s) => /Open shell/.test((s.textContent || '').trim()));
  if (!el) return false;
  el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};

test('a product the server flags as a sample renders the Sample tag on the shell page', async () => {
  const fixture = makeShellsFixture();
  await withApp('pos', async (app) => {
    await app.mount('ShellsModule');
    await app.waitFor(() => [...app.document.querySelectorAll('span')].some((s) => /Open shell/.test((s.textContent || '').trim())),
      { what: 'the fixture shell card to render in the library' });
    assert.ok(clickOpenShell(app), 'could not click into the shell');
    await app.waitFor(() => /Mango/.test(app.text()), { what: 'the shell detail to load its products' });
    await app.settle();
    const txt = app.text();
    // Mango is seeded with sample:true, Watermelon with sample:false — both
    // must be distinguishable on the same screen, not just "some tag exists".
    assert.match(txt, /Sample/, 'the fixture\'s sampled product does not render a Sample tag at all');
    assert.ok(!/Watermelon[^]*Sample/.test(txt) || /Sample[^]*Watermelon/.test(txt) === false,
      'the ordinary (non-sample) product picked up a Sample tag it was never given');
  }, { fetch: fixture.fetch });
});

// ── 2 · CREATING WITH THE TOGGLE ON SENDS sample:true ───────────────────────

/** The MiniSwitch has no label of its own — it is the button in the row whose
 *  heading reads "Display sample". Found structurally, not by text. */
const sampleSwitch = (app) => {
  const heading = [...app.document.querySelectorAll('div')]
    .find((d) => (d.textContent || '').trim() === 'Display sample');
  if (!heading) return null;
  for (let el = heading; el; el = el.parentElement) {
    const btn = el.querySelector && el.querySelector('button');
    if (btn) return btn;
  }
  return null;
};

test('flipping "Display sample" sends sample:true to the server, not just to local state', async () => {
  const fixture = makeShellsFixture();
  const bodies = [];
  const fetch = (url, options) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    if ((options && options.method) === 'POST' && /\/variations$/.test(path)) {
      bodies.push(JSON.parse(options.body || '{}'));
    }
    return fixture.fetch(url, options);
  };

  await withApp('pos', async (app) => {
    const W = app.window;
    await app.mount('AddProductFlow');
    await app.settle();
    assert.ok(app.click((t) => /Add variation/.test(t)), 'no shell row was clickable');
    await app.settle();

    assert.ok(app.type('e.g. Fruit Punch', 'Bench Sample'), 'could not find the name field');
    assert.ok(app.type('0.00', '12.50'), 'could not find the price field');
    await app.settle();

    const sw = sampleSwitch(app);
    assert.ok(sw, 'the Display sample toggle is not on the variation step');
    sw.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    const continueBtn = () => [...app.document.querySelectorAll('button')]
      .find((b) => /^Continue$/.test((b.textContent || '').trim()));
    await app.waitFor(() => continueBtn() && continueBtn().disabled === false,
      { what: 'the derived-name preview to resolve' });
    assert.ok(app.click('Continue'), 'Continue did not advance to the batch step');
    await app.settle();
    assert.ok(app.type('0', '6'), 'no quantity field on the batch step');
    assert.ok(app.type('0.00', '4.00'), 'no wholesale cost field on the batch step');
    await app.settle();

    assert.ok(app.click('Create variation'), 'the flow would not create the variation');
    await app.waitFor(() => bodies.length > 0, { what: 'the create-variation POST to fire' });
    await app.settle();

    assert.match(app.text(), /Marked as a display sample/,
      'the confirmation dropped the display-sample line — the copy that states ' +
      'the contract is the first thing to check when the flag goes missing');

    assert.equal(bodies.length, 1, 'expected exactly one create-variation POST');
    assert.equal(bodies[0].sample, true,
      'the toggle was on and the request body still says sample is not set — the ' +
      'flag never left the client, so the server (and Weedmaps behind it) never saw it');
    assert.equal(bodies[0].inventory, 6, 'the batch quantity was lost in the request');
  }, { fetch });
});
