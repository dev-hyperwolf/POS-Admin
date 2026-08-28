/* ══ THE OWNER'S EXPIRY-ENFORCEMENT TOGGLE, ON THE CLIENT ══════════════════
 *
 * [OWNER RULING 2026-08-27] Document-expiry enforcement is a TOGGLE, default
 * OFF, and an expired document dies at the END of its printed day rather than
 * at midnight UTC.
 *
 * The server side landed first. verify_gate now allows a lapsed document when
 * enforcement is off and stamps the Decision `expiry_enforced=False`,
 * `would_block_code='lapsed'`, `would_block_reason=...`. The switch position is
 * published THREE ways: contract().doc_expiry_enforced, the check-in board's
 * expiry_enforcement.enforced, and per-row at doc_expiry.enforced.
 *
 * WHAT WAS WRONG HERE. pos/verification.jsx's assurance() hard-blocked a lapsed
 * document client-side — tier 0, canStore:false, canDelivery:false — with no
 * knowledge of the switch at all. So with enforcement OFF the server allowed
 * the order and the counter screen still refused it. The toggle did not toggle.
 *
 * AND THE SECOND HALF. shared/hw-live-identity.js rendered block_code and
 * remedy but not would_block_code / would_block_reason, so an order allowed
 * ONLY because enforcement is off was pixel-identical to one that had nothing
 * wrong with it. A default-OFF toggle exists so the population that turning it
 * ON would refuse can be COUNTED first; a screen that never shows what WOULD
 * have been refused is a screen nobody can see the cliff coming from.
 *
 * THREE STATES, NOT TWO. If no source published the flag — an older server, a
 * board that predates the switch — that is `null`. It is not "enforcing" and it
 * is not "not enforcing". Every test below that exercises the toggle exercises
 * all three, because a toggle tested in one position is half a toggle, and
 * because rendering an absence as an answer is the failure this estate has
 * spent the week finding. A compliance switch is the last place to add one.
 *
 * ⚠️ TIMEZONE. The boundary is a LOCAL-DAY comparison, so these tests pin
 * process.env.TZ to the store's zone before the first Date is constructed.
 * `test/doc-expiry-toggle.test.mjs` is its own process under `node --test`, so
 * this affects nothing else. One test deliberately un-pins it — see the note
 * on the runtime-zone characterisation below.
 */
process.env.TZ = 'America/Los_Angeles';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { withApp } from './ui-harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/* ── the LIVE boundary functions, lifted out of the file under test ──────────
 * Not a copy. The source is read and the two functions are evaluated verbatim,
 * so an edit to verification.jsx that moves the boundary fails this file rather
 * than leaving a stale duplicate agreeing with itself. */
function liveExpiryFns() {
  const src = readFileSync(ROOT + 'pos/verification.jsx', 'utf8');
  const grab = (name) => {
    const i = src.indexOf('function ' + name + '(');
    assert.ok(i >= 0, `pos/verification.jsx no longer defines ${name}()`);
    let depth = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
    }
    throw new Error(`unbalanced braces in ${name}()`);
  };
  return new Function(grab('parseExpiry') + '\n' + grab('isExpiredDoc') +
    '\nreturn { parseExpiry, isExpiredDoc };')();
}

/* ── the SERVER's own answer, not a re-derivation of it ─────────────────────
 * These are the exact floats wmdemo/config.end_of_printed_day() returned when
 * called on 2026-08-27, captured by running it:
 *
 *   cd /Users/jt/wm-demo && python3 -c "import sys; sys.path.insert(0,'.'); \
 *     from wmdemo import config; print(config.end_of_printed_day(2026,3,7))"
 *
 * Pasting the server's output rather than re-implementing its rule is the whole
 * point: a JS re-implementation of "midnight of the next calendar day in
 * America/Los_Angeles" would be a second copy that agrees with my reading of
 * the Python, not with the Python.
 *
 * The seven dates are chosen to straddle both 2026 DST transitions — 03-08
 * (spring forward, a 23-hour day) and 11-01 (fall back, a 25-hour day) — plus
 * yesterday, today, and a year end. The epochs prove the server is doing
 * next-calendar-midnight and not +24h: 03-07 → 03-08 is 82800s (23h) and
 * 10-31 → 11-01 is 90000s (25h). */
const SERVER_BOUNDARIES = {
  '2026-03-07': 1772956800,   // dies 00:00 PST 03-08, the day the clocks move
  '2026-03-08': 1773039600,   // dies 00:00 PDT 03-09 — 23h later, not 24
  '2026-08-26': 1787814000,   // yesterday
  '2026-08-27': 1787900400,   // printed TODAY: must not be expired yet
  '2026-10-31': 1793516400,   // dies 00:00 PDT 11-01, the day the clocks move
  '2026-11-01': 1793606400,   // dies 00:00 PST 11-02 — 25h later, not 24
  '2026-12-31': 1798790400,
};
const PROBE_OFFSETS = [['-1h', -3600], ['-1s', -1], ['+1s', 1], ['+1h', 3600]];

/* ── fixtures ───────────────────────────────────────────────────────────────
 * A document that lapsed yesterday and one that is good for years, identical in
 * every other respect. "Identical in every other respect" is load-bearing: the
 * render assertions below compare the two, and any second difference between
 * them would let a badge pass by accident. */
const LAPSED = { type: 'Driver licence', num: '••••4821', expires: '2020-05-30',
  scannedAt: '2 days ago', photo: 'blob:x', by: 'Manisha Saini', where: 'counter',
  name: 'Marcus Webb' };
const CURRENT = { ...LAPSED, expires: '2032-05-30' };
const PHONE_OK = { value: '+1 555 0142', smsVerified: true, verifiedAt: 'yesterday' };

/** Point HW_CHECKIN at a switch position. `undefined` publishes NOTHING —
 *  the third state — by removing the object entirely. */
function setSwitch(app, { contract, board } = {}) {
  const ck = {};
  if (contract !== undefined) ck.contract = { doc_expiry_enforced: contract };
  if (board !== undefined) ck.board = { expiry_enforcement: { enforced: board } };
  app.window.HW_CHECKIN = Object.keys(ck).length ? ck : undefined;
}

/* ═══ A. THE BOUNDARY ═══════════════════════════════════════════════════════
 * The server agent reported that our parseExpiry / isExpiredDoc already agree
 * with the moved boundary at 28 instants. Inherited verification is not
 * verification; this re-derives it. */

test('the client expiry boundary agrees with the server at 28 instants — 1s and 1h either side of seven boundaries, both 2026 DST transitions included', () => {
  const { isExpiredDoc } = liveExpiryFns();
  const disagreements = [];
  let checked = 0;
  for (const [printed, boundary] of Object.entries(SERVER_BOUNDARIES)) {
    for (const [tag, offset] of PROBE_OFFSETS) {
      const nowEpoch = boundary + offset;
      // wmdemo/checkin_api._doc_expiry_view: `expired = epoch <= now`.
      const server = nowEpoch >= boundary;
      const client = isExpiredDoc({ expires: printed }, new Date(nowEpoch * 1000));
      checked++;
      if (server !== client) {
        disagreements.push(`${printed} ${tag}: server=${server} client=${client} ` +
          `(now ${new Date(nowEpoch * 1000).toISOString()})`);
      }
    }
  }
  assert.equal(checked, 28, 'the probe must cover 7 boundaries x 4 offsets');
  assert.deepEqual(disagreements, [],
    'the counter screen and the gate disagree about when a document dies. That is two ' +
    'compliance answers for one document, and the one the customer sees is whichever ' +
    'screen they are standing in front of');
});

test('a document printed TODAY is valid all day and dies only when the day ends', () => {
  const { isExpiredDoc } = liveExpiryFns();
  const printed = '2026-08-27';
  const endOfDay = SERVER_BOUNDARIES[printed];
  // 00:00:01 on the printed day — under the OLD midnight-UTC reading this was
  // already dead, 31 hours early in PDT.
  assert.equal(isExpiredDoc({ expires: printed }, new Date((endOfDay - 86399) * 1000)), false,
    'a licence printed today must not be refused at one second past midnight');
  assert.equal(isExpiredDoc({ expires: printed }, new Date((endOfDay - 1) * 1000)), false,
    'a licence printed today is valid through the last second of the day');
  assert.equal(isExpiredDoc({ expires: printed }, new Date(endOfDay * 1000)), true,
    'and dies exactly when the day ends');
});

test('an expiry we cannot READ is not an expiry that has PASSED', () => {
  const { parseExpiry, isExpiredDoc } = liveExpiryFns();
  assert.equal(parseExpiry('sometime'), null, 'an unreadable date parses to null');
  assert.equal(isExpiredDoc({ expires: 'sometime' }, new Date()), false,
    'unreadable must not be reported as expired — the server calls that state `unreadable`, ' +
    'its remedy is a re-scan, and it is NOT governed by the enforcement switch');
  assert.equal(isExpiredDoc({ expires: null }, new Date()), false,
    'nobody supplied an expiry — the server calls that `not_supplied`, a third fact again');
});

/* ⚠️ KNOWN LIMITATION, PINNED SO IT CANNOT DRIFT UNNOTICED.
 *
 * isExpiredDoc compares LOCAL midnights, so it computes the boundary in the
 * BROWSER's zone, not the store's. The parity above holds because this machine
 * and the store are both America/Los_Angeles. A terminal set to any other zone
 * silently moves the boundary — which is the same class of defect the ruling
 * just fixed on the server, one layer out. This test does not assert the bug is
 * fixed; it asserts the divergence EXISTS, so that a future fix has to come
 * here and delete it deliberately rather than by accident. */
test('KNOWN GAP: the boundary is computed in the RUNTIME zone, so a terminal outside the store zone flips a document on a different instant', () => {
  const { isExpiredDoc } = liveExpiryFns();
  const printed = '2026-08-27';
  // 23:30 PDT on the printed day == 06:30Z the next day. In the store's zone
  // the licence is still valid; in UTC the calendar has already turned over.
  const instant = new Date((SERVER_BOUNDARIES[printed] - 1800) * 1000);
  const inStore = isExpiredDoc({ expires: printed }, instant);
  const saved = process.env.TZ;
  let inUtc;
  try {
    process.env.TZ = 'UTC';
    inUtc = isExpiredDoc({ expires: printed }, instant);
  } finally {
    process.env.TZ = saved;
  }
  assert.equal(inStore, false, 'in the store zone the document is still valid at 23:30');
  assert.equal(inUtc, true,
    'and in UTC the same instant reads as expired. If this assertion ever fails it means the ' +
    'client boundary became zone-aware — good; delete this test and say so');
  assert.equal(isExpiredDoc({ expires: printed }, instant), false,
    'the zone must be restored, or every test after this one runs in the wrong day');
});

/* ═══ B. assurance() IN ALL THREE SWITCH POSITIONS ══════════════════════════ */

test('enforcement ON: a lapsed document is refused, exactly as before the toggle existed', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: true });
    const a = app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK });
    assert.equal(a.tier, 0, 'enforcement is on — a lapsed document clears nothing');
    assert.equal(a.canStore, false);
    assert.equal(a.canDelivery, false);
    assert.equal(a.expired, true);
    assert.equal(a.expiryEnforced, true, 'and it says which way the switch was set');
    assert.equal(a.wouldBlockCode, undefined,
      'a refusal that HAPPENED is not a would-block; would_block is for the refusal that did not');
  });
});

test('enforcement OFF: the same lapsed document is ALLOWED — the switch actually switches', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    const a = app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK });
    assert.equal(a.tier, 2,
      'THE DEFECT: with enforcement off the gate allows this order and the screen used to ' +
      'refuse it anyway, because assurance() had no knowledge of the switch at all');
    assert.equal(a.canStore, true);
    assert.equal(a.canDelivery, true);
    assert.equal(a.expiryEnforced, false);
  });
});

test('enforcement OFF: the allow is STAMPED with the refusal that did not happen', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    const a = app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK });
    assert.equal(a.wouldBlockCode, 'lapsed',
      'the server stamps would_block_code on the Decision; the client must carry the same word');
    assert.equal(a.lapsed, true);
    assert.match(a.wouldBlockReason, /WOULD HAVE BEEN REFUSED/,
      'and the sentence the customer would have been given');
    assert.match(a.wouldBlockReason, /2020-05-30/,
      'naming the date on the document, so the operator can check it against the card in hand');
    assert.notEqual(a.tone, 'good',
      'allowed-because-the-switch-is-off must never wear the same tone as allowed-on-the-merits');
  });
});

test('the flag ABSENT is a THIRD state — neither enforcing nor not-enforcing, and it says so', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, {});                      // nothing published it at all
    const a = app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK });
    assert.equal(a.expiryEnforced, null,
      'ABSENT MUST NOT BE COERCED TO false. Defaulting an unread compliance switch to "off" ' +
      'would silently allow every lapsed document in the estate against an older server');
    assert.equal(a.expiryEnforcementUnknown, true);
    assert.equal(a.wouldBlockCode, undefined,
      'and it must not be coerced to true either — a would-block implies an allow happened');
    assert.equal(a.canStore, false, 'it refuses on the strict reading rather than guessing');
    assert.equal(a.canDelivery, false);
  });
});

test('the three switch positions produce three DIFFERENT sentences — an absence is never rendered as an answer', async () => {
  await withApp('pos', async (app) => {
    const say = (contract) => {
      setSwitch(app, contract === undefined ? {} : { contract });
      const a = app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK });
      return String(a.blocker || '') + ' || ' + String(a.next || '') +
             ' || ' + String(a.wouldBlockReason || '');
    };
    const on = say(true), off = say(false), unknown = say(undefined);
    assert.notEqual(on, off);
    assert.notEqual(on, unknown,
      'THE POINT OF THE THIRD STATE: an unpublished switch must not read like an enforced one. ' +
      'They lead to the same refusal today, so the sentence is the only thing that tells an ' +
      'operator whether the estate decided this or nobody told the screen anything');
    assert.notEqual(off, unknown);
    assert.match(unknown, /NOTHING has told this screen|not published|did not/i,
      'the unknown state must name itself as unknown, not describe a policy');
  });
});

/* ── the three publication sites, and which one wins ─────────────────────── */

test('the board publishes the switch too, and it is read', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { board: false });
    assert.equal(app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK }).expiryEnforced, false);
    setSwitch(app, { board: true });
    assert.equal(app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK }).expiryEnforced, true);
  });
});

test('specificity wins: the row beats the board, and the board beats the contract', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: true, board: false });
    assert.equal(app.window.HWV.assurance({ doc: LAPSED, phone: PHONE_OK }).expiryEnforced, false,
      'the board is closer to the consequence than the estate-wide contract');
    const withRow = { doc: LAPSED, phone: PHONE_OK, doc_expiry: { state: 'expired', enforced: true } };
    assert.equal(app.window.HWV.assurance(withRow).expiryEnforced, true,
      'and the row the consequence LANDS ON beats both — that is where the server stamps it');
  });
});

test('a non-boolean is not a switch position: it falls through instead of being coerced', async () => {
  await withApp('pos', async (app) => {
    // The board says OFF. The row carries junk in `enforced` — a string, a
    // number, an explicit null, a missing key. None of those is a reading, so
    // each must defer to the board rather than being truthy-tested into one.
    setSwitch(app, { board: false });
    for (const junk of ['false', 'true', 0, 1, null, undefined, {}, 'yes']) {
      const v = { doc: LAPSED, phone: PHONE_OK, doc_expiry: { state: 'expired', enforced: junk } };
      assert.equal(app.window.HWV.assurance(v).expiryEnforced, false,
        `doc_expiry.enforced=${JSON.stringify(junk)} is not a boolean and must not be read as one`);
    }
    // With nothing else published, junk lands on UNKNOWN — never on false.
    setSwitch(app, {});
    for (const junk of ['false', 0, null, 'no']) {
      const v = { doc: LAPSED, phone: PHONE_OK, doc_expiry: { state: 'expired', enforced: junk } };
      assert.equal(app.window.HWV.assurance(v).expiryEnforced, null,
        `doc_expiry.enforced=${JSON.stringify(junk)} with no other source is UNKNOWN, not off`);
    }
  });
});

test('the switch governs the LAPSE ONLY — a current document is untouched in all three positions', async () => {
  await withApp('pos', async (app) => {
    for (const pos of [{ contract: true }, { contract: false }, {}]) {
      setSwitch(app, pos);
      const a = app.window.HWV.assurance({ doc: CURRENT, phone: PHONE_OK });
      assert.equal(a.tier, 2, `a valid document clears at ${JSON.stringify(pos)}`);
      assert.equal(a.wouldBlockCode, undefined, 'and carries no would-block');
      assert.equal(a.lapsed, undefined);
      // An unverified customer is still refused with the switch off — the
      // server's policy_report says so in as many words.
      const none = app.window.HWV.assurance({ doc: null, phone: PHONE_OK });
      assert.equal(none.tier, 0, 'no document is still no document, whatever the switch says');
    }
  });
});

/* ═══ C. WHAT THE SCREEN SHOWS ══════════════════════════════════════════════ */

async function badge(app, v) {
  app.window.__ExpiryBadgeProbe = () =>
    app.window.React.createElement(app.window.AssuranceBadge, { v });
  await app.mount('__ExpiryBadgeProbe');
  const root = app.document.getElementById('root');
  // TEXT AND MARKUP SEPARATELY, DELIBERATELY. An earlier version of this test
  // asserted /lapsed/i against innerHTML and survived deleting the words from
  // the chip — because `data-hw-would-block="lapsed"` and the tooltip both
  // matched. An operator reads the CHIP, not the attribute.
  return { text: root.textContent, html: root.innerHTML,
    title: root.querySelector('[title]') ? root.querySelector('[title]').getAttribute('title') : '' };
}

test('a soft-lapsed allow does not render as a clean pass on the badge', async () => {
  const clean = await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    return badge(app, { doc: CURRENT, phone: PHONE_OK });
  });
  const soft = await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    return badge(app, { doc: LAPSED, phone: PHONE_OK });
  });
  assert.notEqual(soft.html, clean.html,
    'THE DEFECT: both reach tier 2 and the badge rendered identically, so an order allowed only ' +
    'because the owner\'s switch is off looked exactly like one with nothing wrong with it');
  assert.match(soft.text, /lapsed/i,
    'the WORDS ON THE CHIP must say the document is lapsed — a data attribute and a hover ' +
    'tooltip are not something a busy operator reads');
  assert.doesNotMatch(clean.text, /lapsed/i, 'and must not say it about a document that is not');
  assert.match(soft.title, /WOULD HAVE BEEN REFUSED/,
    'the sentence the gate would have refused with belongs on the chip too, in its title');
  assert.doesNotMatch(clean.title, /WOULD HAVE BEEN REFUSED/);
});

async function ladderText(app, v) {
  app.window.__ExpiryLadderProbe = () =>
    app.window.React.createElement(app.window.IdentityLadder, { v });
  await app.mount('__ExpiryLadderProbe');
  return app.document.getElementById('root').textContent;
}

test('the ladder names the refusal that did not happen, instead of three green ticks', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    const t = await ladderText(app, { doc: LAPSED, phone: PHONE_OK });
    assert.match(t, /Allowed only because expiry enforcement is off/,
      'the ladder must say WHY this cleared');
    assert.match(t, /WOULD HAVE BEEN REFUSED/);
    // ANCHORED TO THE DOCUMENT RUNG'S OWN LINE. A bare /LAPSED/ passed even
    // with this marker deleted, because rung 3's sentence contains the word
    // too — one assertion covering two claims covers neither.
    assert.match(t, /expires 2020-05-30 — LAPSED, not enforced/,
      'the rung showing the document must SAY it is lapsed beside the date, not print the date ' +
      'and leave the reader to do the arithmetic the code already did');
    assert.doesNotMatch(t, /No further checks, ever/,
      '"No further checks, ever" is FALSE over a lapsed document — turning the switch on IS a ' +
      'further check, and it is the one this customer fails');
  });
});

test('the ladder does not show a soft-lapse banner for a customer who has nothing wrong with them', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, { contract: false });
    const t = await ladderText(app, { doc: CURRENT, phone: PHONE_OK });
    assert.doesNotMatch(t, /Allowed only because expiry enforcement is off/);
    assert.match(t, /No further checks, ever/, 'a clean pass keeps its clean sentence');
  });
});

test('with the switch unpublished the ladder says the switch is unpublished — not that it is off', async () => {
  await withApp('pos', async (app) => {
    setSwitch(app, {});
    const t = await ladderText(app, { doc: LAPSED, phone: PHONE_OK });
    assert.match(t, /Expiry enforcement: not published/);
    assert.doesNotMatch(t, /Allowed only because expiry enforcement is off/,
      'nothing said it was off');
  });
});

test('the scan card stops asserting a consequence the switch may have removed', async () => {
  const say = async (pos) => withApp('pos', async (app) => {
    setSwitch(app, pos);
    app.window.__ExpiryScanProbe = () =>
      app.window.React.createElement(app.window.IdScanPanel, { value: LAPSED, state: 'done' });
    await app.mount('__ExpiryScanProbe');
    return app.document.getElementById('root').textContent;
  });
  const on = await say({ contract: true });
  const off = await say({ contract: false });
  const unknown = await say({});
  assert.match(on, /cannot clear a check-in/,
    'with enforcement ON the old sentence is correct and stays');
  assert.doesNotMatch(off, /it cannot clear a check-in/,
    'with enforcement OFF it is simply untrue — the gate allows this person');
  assert.match(off, /enforcement is OFF/i);
  assert.match(unknown, /UNKNOWN/,
    'and unpublished is its own sentence again, not either of the other two');
  for (const t of [on, off, unknown]) {
    assert.match(t, /EXPIRED on 2020-05-30/,
      'DETECTION IS UNCONDITIONAL. The switch governs the consequence; the lapse itself is ' +
      'named, dated and red in every position');
  }
});

/* ═══ D. THE IDENTITY PANEL ═════════════════════════════════════════════════
 * simVerdictHTML is private to the seam's IIFE. Rather than widen the seam's
 * public surface for a test, the source is loaded with ONE line appended inside
 * the closure that hands the function out. Nothing about the function under
 * test changes. */
function verdictRenderer() {
  const src = readFileSync(ROOT + 'shared/hw-live-identity.js', 'utf8');
  assert.match(src, /\}\)\(\);\s*$/, 'shared/hw-live-identity.js is no longer a trailing IIFE');
  const hooked = src.replace(/\}\)\(\);\s*$/,
    '  W.__HW_IDENTITY_TEST__ = { simVerdictHTML: simVerdictHTML };\n})();\n');
  // `?hwident=off` disarms the seam, so loading it fetches nothing and paints
  // nothing — the renderer is all this needs.
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { url: 'http://localhost/?hwident=off', runScripts: 'dangerously' });
  const el = dom.window.document.createElement('script');
  el.textContent = hooked;
  dom.window.document.head.appendChild(el);
  const hook = dom.window.__HW_IDENTITY_TEST__;
  assert.ok(hook && typeof hook.simVerdictHTML === 'function',
    'the seam did not evaluate — simVerdictHTML was not handed out');
  return { render: (r) => hook.simVerdictHTML(PAL, r), close: () => dom.window.close() };
}

/* A palette stub. Only the keys this renderer reads, each a distinguishable
 * string so a mis-keyed colour shows up as `undefined` in the output. */
const PAL = {
  type: { meta: 11, micro: 10 }, r8: 8, fontMono: 'mono', fontSans: 'sans',
  ink: '#111', ink2: '#222', inkDim: '#333', inkMute: '#444', inkFaint: '#555',
  bad: '#b00', badSoft: '#fee', good: '#0b0', goodSoft: '#efe',
  warn: '#c80', warnSoft: '#ffd', info: '#08c', infoSoft: '#def',
  surface: '#fff', surface2: '#fafafa', surface3: '#f0f0f0',
  hairline: '#eee', hairline2: '#ddd', hairline3: '#ccc',
};

/** The smallest sim result the verdict renderer will walk to the gate block. */
function simResult(pickupHandoff) {
  return { code: 200, order_id: 'o-1', fulfillment: 'pickup', doc_mode: 'none',
    created_new: true, flagged: true, ladder: { tier: 1, tier_label: 'document', state: 'x',
      identity_id: 7, stored_by_ingest: 7, evidence: ['document'] },
    verification: { verified: true, state: 'verified', note: 'n',
      pickup_handoff: pickupHandoff } };
}

test('an allow that would have been refused renders the would-block code and its sentence', () => {
  const R = verdictRenderer();
  try {
    const h = R.render(simResult({ allowed: true, block_code: null, reason: '', remedy: '',
      computed: true, expiry_enforced: false, would_block_code: 'lapsed',
      would_block_reason: 'WOULD HAVE BEEN REFUSED: the document expired on 2020-05-30.' }));
    assert.match(h, /WOULD HAVE BEEN REFUSED/,
      'THE DEFECT: this block rendered block_code and remedy only, so a soft-lapsed allow was ' +
      'indistinguishable from a clean one');
    assert.match(h, /lapsed/, 'the code the gate stamped, printed verbatim');
    assert.match(h, /2020-05-30/, 'and the gate\'s own sentence, not a paraphrase');
    assert.match(h, /enforcement is OFF/i, 'naming which switch position produced the allow');
  } finally { R.close(); }
});

test('a genuinely clean allow does not grow a would-block box', () => {
  const R = verdictRenderer();
  try {
    const h = R.render(simResult({ allowed: true, block_code: null, reason: '', remedy: '',
      computed: true, expiry_enforced: true, would_block_code: null, would_block_reason: '' }));
    assert.doesNotMatch(h, /WOULD HAVE BEEN REFUSED/);
    assert.doesNotMatch(h, /the route does not return one/,
      'the route DID report a would-block field; it was null, which is an answer');
  } finally { R.close(); }
});

test('an allow from a route that reports NO would-block field says so, rather than reading as clean', () => {
  const R = verdictRenderer();
  try {
    // What wmdemo/server.py's pickup_handoff dict built BEFORE 2026-08-27:
    // allowed / block_code / reason / remedy / computed, and none of the three
    // soft-lapse fields. That route now forwards all three, so this is no
    // longer a description of our own server — it is the OLDER-ROUTE case, and
    // it stays because that is exactly what a client talking to a server that
    // predates the toggle receives, and reading it as clean is the failure.
    const h = R.render(simResult({ allowed: true, block_code: null, reason: '', remedy: '',
      computed: true }));
    assert.match(h, /does not return one/,
      'ABSENCE IS NOT "NOTHING WAS WRONG". The route drops the three Decision fields today, so ' +
      'until it forwards them an allow here cannot be read as clean — and saying that is ' +
      'cheaper than an operator concluding otherwise');
    assert.doesNotMatch(h, /WOULD HAVE BEEN REFUSED/,
      'and it must not invent a refusal either');
  } finally { R.close(); }
});

test('a genuine BLOCK still renders its block code and remedy — the new box did not displace the old one', () => {
  const R = verdictRenderer();
  try {
    const h = R.render(simResult({ allowed: false, block_code: 'didit_unbacked',
      reason: 'no provider call has ever run', remedy: 'scan at the counter', computed: true }));
    assert.match(h, /BLOCKED/);
    assert.match(h, /didit_unbacked/);
    assert.match(h, /scan at the counter/);
    assert.doesNotMatch(h, /does not return one/,
      'the missing-field note is about an ALLOW that cannot be read as clean; a refusal is ' +
      'already telling the operator everything it needs to');
  } finally { R.close(); }
});
