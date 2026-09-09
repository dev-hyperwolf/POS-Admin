/* ══ DRAWER CASH MATH MUST NOT CARRY FLOAT NOISE ═════════════════════════════
 *
 * terminals/tdrawer.jsx counts a drawer/bag by denomination and uses the total
 * to compute `variance` (counted - expected) and the deposit amount. The UI
 * stays in dollars (denomination labels, the field the cashier types into),
 * but doing the SUM in float dollars is exactly the kind of arithmetic that
 * drifts: 0.10 + 0.10 + 0.10 + 0.05 + 0.05 in IEEE-754 does not reliably land
 * on 0.40, and a drawer "variance" that is really just float noise is
 * indistinguishable on screen from a real shortage.
 *
 * The fix (see the comment above `denomSum` in tdrawer.jsx) does the sum in
 * integer cents via HWContracts.centsFromDollars() per denomination value
 * times count, and only converts back to dollars once at the end via
 * dollarsFromCents(). This test proves the exact case named in the fix:
 * 3 dimes + 2 nickels must equal 0.40 exactly, not 0.39999999999999997 or
 * 0.4000000000000001 — the classic float-accumulation failure this file's
 * own arithmetic was exposed to before the fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('denomSum: 3 dimes + 2 nickels is exactly 0.40, not a float-drifted neighbor', async () => {
  await withApp('POS Terminal Configuration.html', async (app) => {
    await app.settle();
    const denomSum = app.window.denomSum;
    assert.equal(typeof denomSum, 'function', 'terminals/tdrawer.jsx must expose denomSum on window for this test');
    const total = denomSum({ 'c0.1': '3', 'c0.05': '2' });
    assert.equal(total, 0.4, 'expected exactly 0.4');
    // Guard against the specific failure mode: a value that LOOKS like 0.4 when
    // printed but is not exactly 0.4 as a float (e.g. 0.39999999999999997).
    assert.ok(Object.is(total, 0.4), `expected Object.is(total, 0.4); got ${total}`);
  });
});

test('denomSum: a larger mixed count of bills, coins and rolls still sums exactly', async () => {
  await withApp('POS Terminal Configuration.html', async (app) => {
    await app.settle();
    const denomSum = app.window.denomSum;
    // 2×$20 + 3×$10 + 1×$5 + 4×quarters + 3×dimes + 2×nickels + 1×penny-roll(0.50)
    const total = denomSum({ b20: '2', b10: '3', 'c0.25': '4', 'c0.1': '3', 'c0.05': '2', 'r0.5': '1' });
    // 40 + 30 + 1.00 + 0.30 + 0.10 + 0.50 = 71.90
    assert.equal(total, 71.9);
    assert.ok(Object.is(total, 71.9), `expected Object.is(total, 71.9); got ${total}`);
  });
});

test('denomSum: an empty count is exactly 0', async () => {
  await withApp('POS Terminal Configuration.html', async (app) => {
    await app.settle();
    const denomSum = app.window.denomSum;
    assert.equal(denomSum({}), 0);
  });
});
