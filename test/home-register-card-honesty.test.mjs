/* ══ THE HOME SCREEN'S "REGISTER" CARD MUST SAY WHAT IS TRUE ═══════════════
 *
 * pos/screen-home.jsx rendered the Register card off nothing:
 *
 *     <span>Drawer open</span>
 *     <span>since 9:02 AM</span>
 *     ...You're signed in on Register {S.registerId}. Cash counts and
 *     close-out live in the drawer controls up top.
 *
 * Every word of that was a literal — a green dot, the string "Drawer open"
 * and a fixed "since 9:02 AM", with no variable feeding any of it. A register
 * that had never been opened, or one an associate had just closed out, was
 * reported open regardless. The card cannot lie usefully either way: an
 * associate who trusts it walks up to a drawer they think is open and it
 * isn't, or walks away from one that still needs a count-out.
 *
 * THE REAL SOURCE OF TRUTH IS window.POS (pos/store.jsx). Its `session`
 * object — { open, float, openedAt, ... } while open, { open: false,
 * closedAt, ... } once closed — is written by exactly two calls:
 * `POS.openRegister()` and `POS.closeRegister()`, both driven from the real
 * drawer controls in pos/drawer.jsx (OpenRegisterModal / CloseRegisterModal),
 * and persisted to localStorage under 'hw-pos-session' so it survives a
 * reload. window.usePOS() is the subscribe hook every other consumer of this
 * store already uses (pos/drawer.jsx, pos/screen-stubs.jsx).
 *
 * This test drives the ACTUAL production write path — the same
 * POS.openRegister/closeRegister calls the drawer modals invoke on their
 * "Open register" / "Close & reconcile" buttons — and watches the Home
 * screen, mounted on its own with no store patched or invented, follow it in
 * both directions. It does not drive the modals themselves (denomination-
 * count inputs, a separate surface entirely) because the point under test is
 * whether Home reads the store, not whether the modals write it — that half
 * is store logic pos/drawer.jsx already exercises live.
 *
 * ⚠️ THE LOAD-BEARING ENTRY is reverting the Home card to the hardcoded
 * `background: P.good`, literal 'Drawer open' text and 'since 9:02 AM' —
 * every assertion here goes red because the text never changes no matter
 * what POS.openRegister/closeRegister do.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('a register that has never been opened is NOT reported open on Home', async () => {
  await withApp('pos', async (app) => {
    await app.mount('HomeScreen');
    const sess = app.window.POS.getSession();
    assert.equal(sess.open, false, 'test setup: session should start closed in a fresh app');

    const t = app.text();
    assert.ok(t.includes('Drawer closed'),
      `Home should say the drawer is closed when POS.getSession().open is false — saw: ${t.slice(0, 400)}`);
    assert.ok(!t.includes('Drawer open'),
      'Home reported "Drawer open" for a register that was never opened this session');
  });
});

test('opening the register (the real POS.openRegister write) flips the Home card to open', async () => {
  await withApp('pos', async (app) => {
    await app.mount('HomeScreen');
    assert.ok(!app.text().includes('Drawer open'), 'precondition: should not already read open');

    // The exact call OpenRegisterModal's "Open register" button makes
    // (pos/drawer.jsx): window.POS.openRegister(total).
    app.window.POS.openRegister(300, 'Test Manager');
    await app.settle();

    assert.equal(app.window.POS.getSession().open, true, 'the store itself did not record the register as open');

    const t = app.text();
    assert.ok(t.includes('Drawer open'),
      `Home did not update to "Drawer open" after POS.openRegister() — saw: ${t.slice(0, 400)}`);
    assert.ok(!t.includes('Drawer closed'),
      'Home still reads "Drawer closed" after the register was opened');
    assert.ok(!t.includes('since 9:02 AM'),
      'the old literal "since 9:02 AM" is still on screen instead of a real timestamp');
  });
});

test('closing the register (the real POS.closeRegister write) flips the Home card back to closed', async () => {
  await withApp('pos', async (app) => {
    await app.mount('HomeScreen');

    app.window.POS.openRegister(300, 'Test Manager');
    await app.settle();
    assert.ok(app.text().includes('Drawer open'), 'setup: register should read open before closing it');

    // The exact call CloseRegisterModal's "Close & reconcile" button makes
    // (pos/drawer.jsx): window.POS.closeRegister(counted).
    app.window.POS.closeRegister(300);
    await app.settle();

    assert.equal(app.window.POS.getSession().open, false, 'the store itself did not record the register as closed');

    const t = app.text();
    assert.ok(t.includes('Drawer closed'),
      `Home did not update back to "Drawer closed" after POS.closeRegister() — saw: ${t.slice(0, 400)}`);
    assert.ok(!t.includes('Drawer open'),
      'Home still reads "Drawer open" after the register was closed');
  });
});
