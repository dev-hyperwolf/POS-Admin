/* ── PROVING THE BOUNDARIES ACTUALLY BOUND SOMETHING ─────────────────────────
 *
 * A boundary nobody has watched catch a throw is a hypothesis. So every test in
 * here BREAKS SOMETHING ON PURPOSE and then asks what survived — never "does
 * the component exist".
 *
 * The two that matter are at the bottom, and they run against the REAL router
 * (pos/app.jsx, which test/ui-harness.mjs deliberately skips):
 *
 *   · throw inside a screen  →  the rest of the POS still works, and still
 *                               NAVIGATES. A boundary that leaves you looking
 *                               at a tidy card you cannot leave is not a fix.
 *   · throw inside the cash  →  the app REFUSES with a visible panel instead of
 *     drawer control            silently rendering nothing, which for that
 *                               control is indistinguishable from healthy.
 *
 * ⚠️ Expect stack traces in this file's output. React logs every caught error,
 * and shared/error-boundary.jsx re-dispatches it on window on purpose — a
 * boundary that produced a QUIET test run would be the swallow-bug we are
 * removing. Noise here is the assertion passing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { boot, withApp } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Boot the POS *and* its real router, which the harness skips on purpose. */
async function bootPos(prepare) {
  const app = await boot('pos');
  try {
    if (prepare) prepare(app);
    const code = readFileSync(ROOT + 'pos/app.jsx', 'utf8');
    const out = esbuild.transformSync(code, { loader: 'jsx', target: 'es2020' }).code;
    app.window.eval('(function(){' + out + '\n})();');
    await app.settle();
    return app;
  } catch (err) {
    app.close();
    throw err;
  }
}

/** Define components inside the jsdom realm. They must use ITS React. */
function define(app, src) { app.window.eval(src); }

const panels = (app, kind) =>
  [...app.document.querySelectorAll(`[data-hw-boundary="${kind}"]`)];
const ledger = (app) => [...app.window.HW_BOUNDARY.failures]
  .map((f) => `${f.kind}:${f.name}:${f.message}`);

/* ═══ 1. THE COMPONENT ITSELF ══════════════════════════════════════════════ */

test('a contained failure names what broke, and its siblings keep rendering', async () => {
  await withApp('pos', async (app) => {
    define(app, `
      window.__Boom = function Boom(){ throw new Error('sku HW-9001 is not in the catalogue'); };
      window.__Case = function Case(){
        var R = window.React;
        return R.createElement('div', null,
          R.createElement('div', null, 'THE SIBLING SURVIVED'),
          R.createElement(window.ScreenBoundary, { name: 'Catalog' },
            R.createElement(window.__Boom)));
      };`);
    await app.mount('__Case');

    const text = app.text();
    // Named, not "Something went wrong".
    assert.ok(text.includes('Catalog stopped working.'), `no named title. Got: ${text}`);
    assert.ok(text.includes('sku HW-9001 is not in the catalogue'), 'the error message is not shown');
    // ...and the point of containing it:
    assert.ok(text.includes('THE SIBLING SURVIVED'), 'the boundary took its sibling down with it');
    assert.equal(panels(app, 'contained').length, 1);
    // A way back.
    assert.ok(app.buttons().includes('Reload the page'), `no way out. Buttons: ${app.buttons()}`);
  });
});

test('a contained failure is NOT swallowed — ledger, console and the window', async () => {
  await withApp('pos', async (app) => {
    app.window.HW_BOUNDARY.reset();
    const before = app.errors.length;
    define(app, `
      window.__Boom = function Boom(){ throw new Error('swallow me'); };
      window.__Case = function Case(){
        return window.React.createElement(window.ScreenBoundary, { name: 'Orders' },
          window.React.createElement(window.__Boom));
      };`);
    await app.mount('__Case');

    assert.deepEqual(ledger(app), ['contained:Orders:swallow me']);
    // The build guard in tools/precompile.mjs listens on window 'error'. The
    // harness listens on the same event, so this proves the guard's path was
    // reached — a caught React error does not fire it by itself.
    const raised = app.errors.slice(before).filter((e) => /HW boundary/.test(e));
    assert.ok(raised.length >= 1,
      `nothing reached the window error path. Saw: ${app.errors.slice(before).join(' | ')}`);
  });
});

test('an unnamed boundary still renders, and complains', async () => {
  await withApp('pos', async (app) => {
    define(app, `
      window.__Case = function Case(){
        return window.React.createElement(window.ScreenBoundary, null,
          window.React.createElement(function(){ throw new Error('anon'); }));
      };`);
    await app.mount('__Case');
    assert.ok(app.text().includes('(an unnamed ScreenBoundary)'),
      'a missing name must be visible, not silently blank');
  });
});

/* ═══ 2. REFUSAL, AND THE THING THAT MAKES IT WORTH HAVING ═════════════════ */

test('a CriticalBoundary refuses the WHOLE enclosing frame, not just its pane', async () => {
  await withApp('pos', async (app) => {
    app.window.HW_BOUNDARY.reset();
    define(app, `
      window.__Boom = function Boom(){ throw new Error('cart.map of undefined'); };
      window.__Case = function Case(){
        var R = window.React;
        return R.createElement('div', null,
          R.createElement('div', null, 'OUTSIDE THE SCREEN'),
          R.createElement(window.ScreenBoundary, { name: 'The register' },
            R.createElement('div', null,
              R.createElement('button', null, 'Charge $42.00'),
              R.createElement(window.CriticalBoundary, { name: 'Cart', flow: 'This sale' },
                R.createElement(window.__Boom)))));
      };`);
    await app.mount('__Case');

    const text = app.text();
    // The refusal is the WHOLE frame — the tender button beside the broken cart
    // is gone. This is the assertion the whole design exists for: a money pane
    // must not leave a usable-looking shell around a hole.
    assert.ok(!app.buttons().includes('Charge $42.00'),
      'the tender button survived a broken cart — a sale could be rung against it');
    assert.ok(text.includes('This sale has been stopped.'), `not refused. Got: ${text}`);
    assert.ok(text.includes('cart.map of undefined'), 'the refusal does not say what broke');
    assert.equal(panels(app, 'refused').length, 1);
    assert.equal(panels(app, 'contained').length, 0, 'a money failure was contained, not refused');
    // The frame refuses; everything outside it is untouched.
    assert.ok(text.includes('OUTSIDE THE SCREEN'), 'refusal escaped its own frame');
    assert.deepEqual(ledger(app), ['refused:Cart:cart.map of undefined']);
  });
});

test('a CriticalBoundary with nothing above it paints its own refusal, never null', async () => {
  await withApp('pos', async (app) => {
    define(app, `
      window.__Case = function Case(){
        return window.React.createElement(window.CriticalBoundary,
          { name: 'Tender', flow: 'This payment' },
          window.React.createElement(function(){ throw new Error('no parent here'); }));
      };`);
    await app.mount('__Case');
    // Escalating to nobody is a white screen, which is the bug this file ends.
    assert.ok(app.text().includes('This payment has been stopped.'),
      `an orphan CriticalBoundary rendered nothing. Got: "${app.text()}"`);
    assert.equal(panels(app, 'refused').length, 1);
  });
});

test('a ScreenBoundary INSIDE a CriticalBoundary does not contain — it escalates', async () => {
  await withApp('pos', async (app) => {
    define(app, `
      window.__Case = function Case(){
        var R = window.React;
        return R.createElement(window.ScreenBoundary, { name: 'Check-in' },
          R.createElement('div', null,
            R.createElement('button', null, 'Admit customer'),
            R.createElement(window.CriticalBoundary, { name: 'ID check', flow: 'This check-in' },
              R.createElement(window.ScreenBoundary, { name: 'Scan pane' },
                R.createElement(function(){ throw new Error('expiry unreadable'); })))));
      };`);
    await app.mount('__Case');

    // The inner ScreenBoundary must NOT have quietly contained this.
    assert.equal(panels(app, 'contained').length, 0,
      'a boundary inside a refusing region contained the failure and undid the refusal');
    assert.ok(!app.buttons().includes('Admit customer'),
      'the admit button survived a failed ID scan');
    assert.ok(app.text().includes('has been stopped.'), `not refused. Got: ${app.text()}`);
  });
});

/* ═══ 3. AGAINST THE REAL ROUTER ═══════════════════════════════════════════ */

test('MUTATION: a screen that throws does not take the POS down, and you can navigate away', async () => {
  const app = await bootPos((a) => {
    try { a.window.localStorage.setItem('hw-pos-route', 'members'); } catch (e) {}
    // The exact shape of the 2026-08-27 outage: a render-path dereference.
    a.window.MembersScreen = function MembersScreen() {
      const rows = undefined;
      return rows.map((r) => r);
    };
  });
  try {
    const text = app.text();
    assert.ok(text.includes('Members stopped working.'), `screen not bounded. Got: ${text.slice(0, 400)}`);
    assert.equal(panels(app, 'contained').length, 1);

    // THE WHOLE POINT: the shell is alive.
    const labels = app.buttons();
    for (const nav of ['Catalog', 'Orders', 'Register']) {
      assert.ok(labels.some((l) => l.includes(nav)), `the rail lost "${nav}". Buttons: ${labels}`);
    }
    // And it is not just PAINTED — it still routes.
    assert.ok(app.click((t) => t.trim() === 'Catalog'), 'could not click Catalog');
    await app.settle();
    assert.equal(panels(app, 'contained').length, 0,
      'the failure followed us to the next screen — the boundary is not keyed by route');
    assert.ok(!app.text().includes('Members stopped working.'), 'stale failure survived navigation');
  } finally { app.close(); }
});

test('MUTATION: a broken cash-drawer control REFUSES visibly instead of vanishing', async () => {
  const app = await bootPos((a) => {
    // It renders `null` whenever the drawer is shut, so "contained" here would
    // look EXACTLY like healthy. It must refuse loudly instead.
    a.window.CashDrawerOverlay = function CashDrawerOverlay() {
      throw new Error('getDrawer() returned undefined');
    };
  });
  try {
    const text = app.text();
    assert.equal(panels(app, 'contained').length, 0, 'a cash control was contained rather than refused');
    assert.equal(panels(app, 'refused').length, 1, `no refusal panel. Got: ${text.slice(0, 400)}`);
    assert.ok(text.includes('Cash handling has been stopped.'), `not named. Got: ${text.slice(0, 400)}`);
    assert.ok(text.includes('getDrawer() returned undefined'), 'the refusal does not say what broke');
    assert.ok(app.window.HW_BOUNDARY.failures.some((f) => f.kind === 'refused'),
      'the refusal was not recorded');
  } finally { app.close(); }
});

test('the boundaries are actually wired into the page, not just defined', async () => {
  const html = readFileSync(ROOT + 'Hyperwolf POS.html', 'utf8');
  const order = ['react@', 'shared/error-boundary.jsx', 'pos/app.jsx']
    .map((s) => html.indexOf(s));
  assert.ok(order.every((i) => i >= 0), `a required script tag is missing: ${order}`);
  assert.deepEqual(order.slice().sort((a, b) => a - b), order,
    'shared/error-boundary.jsx must load after React and before pos/app.jsx');

  const app = readFileSync(ROOT + 'pos/app.jsx', 'utf8');
  assert.ok(/<ScreenFrame\s+key=\{route\}/.test(app),
    'the routed screen must be keyed by route or a failure follows the user');
  assert.ok(/<CriticalFrame[^>]*CashDrawer|CriticalFrame[\s\S]{0,200}CashDrawerOverlay/.test(app),
    'the cash drawer control must be inside a CriticalFrame');
});
