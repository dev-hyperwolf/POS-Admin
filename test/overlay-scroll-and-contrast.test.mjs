/* ── THE THREE DEFECTS A GREEN SUITE COULD NOT SEE ───────────────────────────
 *
 * All three were found by a browser QA pass against a suite that was fully
 * green, and the reason is the same in every case: jsdom has no layout and no
 * colour. It cannot tell you a button sits at y=824 on an 800px viewport, and
 * it cannot tell you 13.5px of amber on amber is 3.05:1.
 *
 * So these tests deliberately do NOT try to measure pixels or rendered colour.
 * They assert the INVARIANTS that make the browser outcome impossible to
 * regress, which is the part jsdom can hold honestly:
 *
 *   · the overlay is a scroll container, whatever height its content becomes;
 *   · no modal in the owned file hand-types a scrim any more, so there is one
 *     place left to get this wrong rather than five;
 *   · the two text colours clear AA against the exact backgrounds they are
 *     painted on, computed from the real token values in pos/tokens.jsx.
 *
 * The contrast maths is WCAG 2.x relative luminance, and it is calibrated: run
 * against the pre-fix values it reproduces the QA pass's measurements to two
 * decimals (3.05:1 for the refusal headline, 12.64 vs its reported 12.6 body).
 * A ratio function that agreed with nothing would prove nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/* ── WCAG contrast, with alpha flattened onto a known backdrop ────────────── */
const chan = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
function parse(c) {
  c = String(c).trim();
  if (c.startsWith('#')) return [...chan(c), 1];
  const m = c.match(/rgba?\(([^)]+)\)/);
  assert.ok(m, `cannot parse colour: ${c}`);
  const p = m[1].split(',').map((s) => parseFloat(s));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
/** A token like rgba(15,15,12,.42) is NOT a colour until it is over something.
 *  Flattening onto the real backdrop is the difference between measuring the
 *  screen and measuring a swatch. */
const over = (fg, bg) => { const f = parse(fg), b = parse(bg), a = f[3]; return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a)); };
const lum = (rgb) => { const s = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
function ratio(fg, bg) {
  const L1 = lum(over(fg, bg)), L2 = lum(parse(bg).slice(0, 3));
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
const AA = 4.5;

/* ── the harness's own sanity check ───────────────────────────────────────── */
test('the contrast function reproduces the QA pass it is standing in for', () => {
  // The exact pre-fix pair the browser measured at 3.05:1. If this drifts, every
  // threshold below is being judged by a ruler nobody has checked.
  assert.equal(ratio('#C07A12', '#FBEFD6').toFixed(2), '3.05');
  // And the body text on the same card, reported as 12.6:1.
  assert.equal(ratio('#2A2A26', '#FBEFD6').toFixed(1), '12.6');
  assert.equal(ratio('#000000', '#FFFFFF').toFixed(0), '21');
  assert.equal(ratio('#FFFFFF', '#FFFFFF').toFixed(0), '1');
});

/* ═══ 1. THE OVERLAY SCROLLS — AT ANY CONTENT HEIGHT ═══════════════════════ */

/** Every fixed, full-bleed overlay currently in the document.
 *  The page chrome (dock, bars) is fixed too, so `inset:0` is what separates a
 *  modal overlay from it. jsdom serialises that shorthand as "0", the browser
 *  as "0px" — accept both rather than depending on which one is reading. */
const scrims = (app) => [...app.document.querySelectorAll('div')]
  .filter((d) => d.style && d.style.position === 'fixed' && ['0', '0px'].includes(d.style.inset));

test('the Add-member overlay is a scroll container, so a tall card stays reachable', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('Add Member'), 'no Add Member button');
    await app.settle();

    const s = scrims(app);
    assert.equal(s.length, 1, `expected exactly one overlay, saw ${s.length}`);
    const scrim = s[0];

    // THE BUG, STATED AS AN ASSERTION. Without this the card overflows off both
    // edges of a non-scrolling overlay and "Create member" is unreachable at
    // 1440x800 — the modal simply cannot be submitted.
    assert.equal(scrim.style.overflowY, 'auto',
      'the modal overlay does not scroll, so any card taller than the viewport ' +
      'is partly unreachable and the form cannot be submitted');

    // Centring an OVERFLOWING child is what stranded the top 44px above the
    // scroll origin. Auto margins centre only while centring is safe.
    assert.notEqual(scrim.style.alignItems, 'center',
      'the overlay centres its card, which puts the overhang outside the scroll range');

    const card = [...scrim.children].find((c) => c.tagName === 'DIV');
    assert.ok(card, 'the overlay has no card');
    assert.equal(card.style.margin, 'auto',
      'the card is not centred by auto margins, so it either cannot centre or ' +
      'cannot collapse to flush-top when it outgrows the viewport');
  });
});

test('typing a mononym adds the note and leaves the modal submittable', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('Add Member'), 'no Add Member button');
    await app.settle();

    const first = [...app.document.querySelectorAll('input')]
      .find((i) => (i.getAttribute('placeholder') || '') === 'Jane');
    assert.ok(first, 'no first-name box');
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    };
    set(first, 'Teller');
    await app.settle();

    // The note is the POINT, not the problem. It is what made the card 947px
    // tall and broke 1440x900 — and it must survive the fix, because a mononym
    // is exactly the case it exists to explain.
    assert.match(app.text(), /correct for a mononym/,
      'the mononym note is gone — the container was supposed to be fixed, not the note');
    assert.match(app.text(), /Create member/,
      'the submit control vanished with the taller content');

    // The taller card must not have cost the overlay its scrolling.
    const scrim = scrims(app)[0];
    assert.equal(scrim.style.overflowY, 'auto',
      'the overlay stopped scrolling once the content grew — which is precisely ' +
      'the case that put Create member off-screen at 1440x900');
  });
});

test('overlayScrim cannot be asked for a non-scrolling overlay', async () => {
  await withApp('pos', async (app) => {
    const P = app.window.THEMES.light;
    const mk = app.window.overlayScrim;
    assert.equal(typeof mk, 'function', 'there is no shared overlay helper');
    // Whatever a caller passes, the scroll behaviour is not theirs to opt out of.
    for (const opts of [undefined, {}, { z: 80 }, { padding: 20 }, { padding: '48px 20px', animate: true }]) {
      const st = mk(P, opts);
      assert.equal(st.overflowY, 'auto', `overflowY lost for ${JSON.stringify(opts)}`);
      assert.equal(st.alignItems, 'flex-start', `alignItems wrong for ${JSON.stringify(opts)}`);
      assert.equal(st.position, 'fixed');
    }
    assert.equal(app.window.overlayCard.margin, 'auto',
      'the card half of the contract no longer centres by auto margin');
    // Opt-in, so migrating a modal cannot silently add an animation.
    assert.equal(mk(P, {}).animation, undefined);
    assert.equal(mk(P, { animate: true }).animation, 'fade .15s ease');
  });
});

test('no modal in screen-stubs hand-types a scrim any more', () => {
  const src = readFileSync(ROOT + 'pos/screen-stubs.jsx', 'utf8');
  // Five copies of one object literal is why four of them were wrong and one
  // was right. The helper is only a fix if the copies are actually gone.
  const handTyped = src.match(/position: 'fixed', inset: 0[^}]*background: P\.scrim/g) || [];
  assert.equal(handTyped.length, 0,
    `${handTyped.length} hand-typed scrim(s) survive in screen-stubs.jsx; each is a ` +
    'place the scroll fix can be missed again');
  assert.ok(src.includes('window.overlayScrim('), 'the file no longer uses the shared overlay helper');
});

/* ═══ 2. CONTRAST ══════════════════════════════════════════════════════════ */

test('the SectionHead eyebrow clears AA on every surface it is drawn on', async () => {
  await withApp('pos', async (app) => {
    const src = readFileSync(ROOT + 'pos/atoms.jsx', 'utf8');
    const m = src.match(/\{eyebrow && <div style=\{\{[^}]*color: P\.(\w+)/);
    assert.ok(m, 'cannot find the SectionHead eyebrow colour');
    const token = m[1];

    for (const mode of ['light', 'dark']) {
      const P = app.window.THEMES[mode];
      const fg = P[token];
      assert.ok(fg, `${mode}: no such token ${token}`);
      // 10px uppercase is the smallest type on the screen, so it is NORMAL text
      // for WCAG and the 3:1 large-text allowance does not apply. It was failing
      // even that lower floor.
      for (const bgName of ['bg', 'surface', 'surface2', 'surface3']) {
        const r = ratio(fg, P[bgName]);
        assert.ok(r >= AA,
          `${mode}: eyebrow P.${token} on P.${bgName} is ${r.toFixed(2)}:1, under AA ${AA}:1`);
      }
    }
  });
});

test('the brand refusal headline outranks its own body text again', async () => {
  await withApp('pos', async (app) => {
    const src = readFileSync(ROOT + 'pos/screen-brands.jsx', 'utf8');
    const m = src.match(/color: P\.(\w+) \}\}>\s*\n\s*Nothing here can be bound/);
    assert.ok(m, 'cannot find the refusal headline colour');
    const token = m[1];

    for (const mode of ['light', 'dark']) {
      const P = app.window.THEMES[mode];
      // In dark, warnSoft is itself translucent, so it has to be flattened onto
      // the canvas before anything is measured against it.
      const wash = parse(P.warnSoft)[3] < 1
        ? 'rgb(' + over(P.warnSoft, P.canvas).map(Math.round).join(',') + ')'
        : P.warnSoft;
      const head = ratio(P[token], wash);
      assert.ok(head >= AA,
        `${mode}: refusal headline P.${token} on the warn wash is ${head.toFixed(2)}:1, under AA ${AA}:1`);

      // The specific complaint was not just "under AA" — it was that the most
      // important sentence was the LEAST readable thing on its own card. The
      // headline is bold and larger, so it must not read fainter than the body.
      const body = ratio(P.ink2, wash);
      assert.ok(head >= body * 0.4,
        `${mode}: the headline (${head.toFixed(2)}:1) is still far fainter than the ` +
        `body beneath it (${body.toFixed(2)}:1)`);
    }
  });
});
