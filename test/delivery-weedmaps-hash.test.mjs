/* ══ THE ANAGRAM-COLLISION HASH BUG, REPEATED IN A SECOND FILE ══════════════
 *
 * delivery/ddata.jsx's own _stockHash carries a comment explaining a prior
 * mistake: summing character codes collides on anagrams, because addition is
 * order-independent. 'RC-01' and its own characters reordered would sum to
 * the same total, so two different region/pin identities could hash to the
 * same wmid/pinId/token — exactly the identifier delivery/dapp.jsx's
 * WeedmapsPanel derives every Weedmaps pin field from.
 *
 * delivery/dapp.jsx had exactly that char-code-sum `hash()` before this fix
 * (it was never covered by test/governance.test.mjs). The fix replaces it
 * with FNV-1a 32-bit, hoisted to module scope as `fnv1aHash` and exposed on
 * `window.fnv1aHash` so this test can reach the REAL function the page runs,
 * not a reimplementation of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('fnv1aHash: two strings using the same characters in a different order do not collide', async () => {
  await withApp('Hyperwolf Delivery.html', async (app) => {
    await app.settle();
    const hash = app.window.fnv1aHash;
    assert.equal(typeof hash, 'function', 'delivery/dapp.jsx must expose fnv1aHash on window for this test');

    // The exact failure mode named in the fix's comment: two strings that are
    // anagrams of each other summed to the same char-code total under the old
    // hash() and would therefore have produced the same wmid/pinId/token.
    const a = hash('RC-01');
    const b = hash('1C-R0'); // same characters as 'RC-01', reordered
    assert.notEqual(a, b, 'FNV-1a must not collide on an anagram the way a char-code sum did');

    // A plain char-code sum would also collide 'SB-01' against 'RC-01' shifted —
    // not an anagram, but the same demonstrable class of false-equal hash that
    // delivery/ddata.jsx's comment warns about ("the SUM of 'SB-01' and of
    // 'RC-01' is the same number"). FNV-1a must tell these apart too.
    const c = hash('SB-01');
    const d = hash('RC-01');
    assert.notEqual(c, d);
  });
});

test('fnv1aHash: deterministic — same input always produces the same output', async () => {
  await withApp('Hyperwolf Delivery.html', async (app) => {
    await app.settle();
    const hash = app.window.fnv1aHash;
    assert.equal(hash('LA-01'), hash('LA-01'));
    assert.equal(hash(''), hash(''));
  });
});

test('fnv1aHash: always returns a non-negative 32-bit integer', async () => {
  await withApp('Hyperwolf Delivery.html', async (app) => {
    await app.settle();
    const hash = app.window.fnv1aHash;
    for (const s of ['RC-01', 'LA-02', '', 'a-very-long-region-name-that-is-unusually-verbose']) {
      const h = hash(s);
      assert.equal(typeof h, 'number');
      assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff, `${s} -> ${h} is not a valid uint32`);
    }
  });
});
