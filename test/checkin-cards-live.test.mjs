/* The check-in cards END TO END: the real seam, the real payloads.
 *
 * test/checkin-cards.test.mjs drives the CARD by writing rows into
 * HW.CHECKINS by hand. That proves the render and proves nothing about the
 * thing that actually broke: shared/hw-live-checkin.js building those rows out
 * of what wmdemo returns. Both halves were correct in isolation on the tree the
 * owner screenshotted, and the screen was still wrong.
 *
 * So these fixtures are VERBATIM CAPTURES from a running wmdemo
 * (WM_DEMO_DB=/tmp/wf13_checkin-cards.sqlite3 WM_DEMO_PORT=8950, 2026-08-27),
 * not payloads written to make a test pass:
 *
 *   checkin-board.json      six people, four of them waiting since 2026-08-19
 *                           (waited_s ≈ 677,000 — the "162h 34m 16s" the owner
 *                           saw, still climbing)
 *   checkin-hist-1914.json  Dana Whitfield, one bound account, ONE purchase
 *   checkin-hist-242.json   Pickup Tester — resolved BY PHONE to identity 242,
 *   checkin-hist-246.json   Cross Region  — resolved BY PHONE to identity 246.
 *                           Both carry wm customer 16665721, which sits on
 *                           FOUR live identities and 461 non-cancelled orders.
 *                           Rendering that as either person's count would put
 *                           the same 461 on four strangers' cards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const load = (n) => JSON.parse(readFileSync(FIX + n, 'utf8'));

const BOARD = load('checkin-board.json');
const CONTRACT = load('checkin-contract.json');
const HIST = {
  1914: load('checkin-hist-1914.json'),
  242: load('checkin-hist-242.json'),
  246: load('checkin-hist-246.json'),
};

/** Serve the captured payloads; 503 everything else, exactly as the offline
 *  harness does, so no OTHER seam is accidentally driven by this test. */
function serve(boardOverride, histOverride) {
  let dead = false;
  const ok = (body) => ({
    ok: true, status: 200, statusText: 'OK', url: '',
    json: () => (dead ? new Promise(() => {}) : Promise.resolve(body)),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  const fn = (url, init) => {
    const u = String(url);
    if (/\/api\/checkin\/board/.test(u)) return Promise.resolve(ok(boardOverride || BOARD));
    if (/\/api\/checkin\/contract/.test(u)) return Promise.resolve(ok(CONTRACT));
    if (/\/api\/checkin\/candidates/.test(u)) {
      return Promise.resolve(ok({ ok: true, candidates: [] }));
    }
    if (/purchase-history/.test(u)) {
      const m = /identity_id=(\d+)/.exec(u);
      const id = m && m[1];
      if (id === '0') {
        // The seam's route probe. The real route answers 409 here with a body.
        return Promise.resolve({
          ok: false, status: 409, statusText: 'Conflict', url: u,
          json: () => Promise.resolve({ error: 'no identity 0', code: 'no_such_identity' }),
          text: () => Promise.resolve('{}'),
        });
      }
      const H = (histOverride && histOverride[id]) || HIST[id];
      if (H) return Promise.resolve(ok(H));
    }
    return Promise.resolve({
      ok: false, status: 503, statusText: 'not served by this test', url: u,
      json: () => Promise.resolve(null), text: () => Promise.resolve(''),
    });
  };
  fn.stop = () => { dead = true; };
  return fn;
}

const stripText = (app) => [...app.document.querySelectorAll('button')]
  .filter((b) => (b.getAttribute('title') || '').startsWith('Open '))
  .map((b) => (b.parentElement.textContent || '').replace(/\s+/g, ' '))
  .join(' | ');

/* MOUNT AFTER THE SEAM HAS ANSWERED, NOT BEFORE.
 *
 * The first version of this file mounted RegisterScreen immediately and waited
 * for the seam to force a re-render. It passed alone and failed in the suite,
 * and the reason is worth writing down: this harness shares ONE ReactDOM across
 * every boot in the process (its own header flags the sealed-namespace problem),
 * so shared/hw-live-checkin.js's `createRoot.__hwCheckin` guard makes the SECOND
 * and every later boot skip its render capture. Only the first app in a process
 * ever gets a seam-forced repaint here. That is a property of the harness, not
 * of the browser, and a test whose result depends on which position it holds in
 * the file is measuring the harness.
 *
 * So: let the board and the histories land FIRST, then mount. The strip's very
 * first render reads live rows, which is the thing under test — whether
 * hw-live-checkin.js builds rows the card renders correctly — and it is the
 * same answer in either order.
 */
const settleUntil = async (app, pred, what) => {
  for (let i = 0; i < 80; i++) {
    let got = false;
    try { got = !!pred(); } catch (e) { got = false; }
    if (got) return;
    await app.settle();
  }
  assert.fail('never became true within 80 settles: ' + what);
};

const rowFor = (app, id) =>
  app.window.HW.CHECKINS.find((c) => c.resolvedIdentityId === id);

/** Boot, wait for the live board AND every purchase history to settle out of
 *  'loading', then mount the register. */
const liveRegister = async (app) => {
  await settleUntil(app,
    () => app.window.HW_CHECKIN && app.window.HW_CHECKIN.status === 'live'
       && app.window.HW.CHECKINS.some((c) => c.name === 'Dane Whitfield'),
    'the live board replaced HW.CHECKINS');
  await settleUntil(app,
    () => app.window.HW.CHECKINS.every(
      (c) => !c.history || c.history.state !== 'loading'),
    'every purchase history stopped loading');
  await app.mount('RegisterScreen');
  await app.settle();
};


test('the live board reaches the cards at all', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    assert.equal(app.window.HW_CHECKIN.status, 'live',
      'the seam never went live, so nothing below is testing the live path');
    const names = app.window.HW.CHECKINS.map((c) => c.name).join(',');
    assert.ok(/Dana Whitfield/.test(names) && /Pickup Tester/.test(names),
      'the mock people are still on the board: ' + names);
  }, { fetch: serve() });
});

test('a week-old wait is shown in days, never as a five-figure minute count', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const txt = stripText(app);
    // 677,000s. The broken card rendered floor(677000/60) = "11283m".
    assert.ok(!/\d{4,}m/.test(txt), 'still a five-figure minute count: ' + txt);
    assert.match(txt, /7d \d+h/, 'a 7-day wait is not shown in days: ' + txt);
  }, { fetch: serve() });
});

test('a week-old wait is called stale rather than drawn as a live queue timer', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const rows = app.window.HW.CHECKINS.filter((c) => c.stale);
    assert.ok(rows.length >= 4,
      `only ${rows.length} of the week-old rows are flagged stale`);
    assert.match(stripText(app), /stale/);
    // The number itself is NOT adjusted — the evidence has to survive.
    assert.ok(rows[0].waitSec > 600000, 'the elapsed time was quietly reset');
  }, { fetch: serve() });
});

test('a resolved person with a real, unshared purchase count gets the number', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const dana = rowFor(app, 1914);
    assert.ok(dana, 'the board row that resolves to identity 1914 is missing');
    assert.equal(dana.identitySource, 'name_dob');
    assert.equal(dana.history.priorOrders, 1,
      'the measured purchase count did not reach the row');
    assert.equal(dana.history.label, '1 prior order');
    // Singular, and it says ORDER. It is not a visit and must never be one.
    assert.ok(!/visit/.test(dana.history.label));
    assert.match(stripText(app), /1 prior order/);
  }, { fetch: serve() });
});

test('a count four people share is NOT rendered as one person\'s count', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const shared = app.window.HW.CHECKINS.filter(
      (c) => c.resolvedIdentityId === 242 || c.resolvedIdentityId === 246);
    assert.equal(shared.length, 2, 'the two phone-resolved rows are missing');
    for (const c of shared) {
      assert.equal(c.history.priorOrders, null,
        `${c.name} was given a per-person count off a shared account`);
      assert.equal(c.history.label, 'shared account');
      assert.match(c.history.why, /16665721/,
        'the reason does not name the account that is shared');
    }
    const txt = stripText(app);
    assert.ok(!/461/.test(txt),
      'the shared 461-order total is on a card: ' + txt);
  }, { fetch: serve() });
});

test('a person nobody in the ledger matches still reads "visits unknown"', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const dane = app.window.HW.CHECKINS.find((c) => c.name === 'Dane Whitfield');
    assert.ok(dane, 'Dane Whitfield is not on the board');
    assert.equal(dane.resolvedIdentityId, null);
    assert.equal(dane.history.state, 'no_identity');
    assert.equal(dane.history.label, 'visits unknown');
    assert.match(stripText(app), /visits unknown/);
  }, { fetch: serve() });
});

test('Dana and Dane are TWO ROWS on the board — nothing collapses them', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const w = app.window.HW.CHECKINS.filter((c) => /Whitfield/.test(c.name));
    // Two Danas (different dobs) and one Dane. demo_seed.py seeds the
    // Dana/Dane pair ON PURPOSE as the contested-match case, and a
    // name-similarity dedupe here would delete a real person from the room.
    assert.ok(w.length >= 2, 'the Whitfields are not both on the board');
    const ids = new Set(w.map((c) => c.id));
    assert.equal(ids.size, w.length, 'two Whitfield rows share one id');
    const cards = [...app.document.querySelectorAll('button')]
      .filter((b) => /Whitfield/.test(b.getAttribute('title') || ''));
    assert.equal(cards.length, w.length,
      'the strip drew a different number of Whitfield cards than there are rows');
  }, { fetch: serve() });
});

test('no live row claims a visit ordinal anywhere on the strip', async () => {
  await withApp('pos', async (app) => {
    await liveRegister(app);
    const txt = stripText(app);
    assert.ok(!/\d(st|nd|rd|th) visit/.test(txt),
      'a live card is asserting a visit number it does not have: ' + txt);
  }, { fetch: serve() });
});

test('a crowded room reads a bounded number of histories, and says so for the rest', async () => {
  // WHY THIS IS NOT A THEORETICAL LIMIT. hw-live-history caches 100 entries and
  // evicts least-recently-used; this seam re-publishes on that module's
  // subscribe callback. Uncapped, a room past 100 resolved people would miss on
  // the evicted ones every publish, fetch them, evict what it just read, notify
  // and publish again — an unbounded request loop this file starts itself. The
  // cap is 40, and the people it cuts off are told nothing was read for them,
  // never that they bought nothing.
  const big = JSON.parse(JSON.stringify(BOARD));
  const one = big.people[0];
  big.people = [];
  for (let i = 0; i < 55; i++) {
    const p = JSON.parse(JSON.stringify(one));
    p.id = 'ci-crowd-' + i;
    p.name = 'Crowd Person ' + i;
    p.first_name = 'Crowd'; p.last_name = 'Person' + i;
    p.resolved_identity_id = 1914;      // all resolvable, all would cost a read
    p.identity_source = 'name_dob';
    p.waited_s = 1000 - i;              // board order: longest wait first
    big.people.push(p);
  }
  let asked = 0;
  const base = serve(big);
  const counting = (url, init) => {
    if (/purchase-history/.test(String(url)) && !/identity_id=0\b/.test(String(url))) asked += 1;
    return base(url, init);
  };
  await withApp('pos', async (app) => {
    await settleUntil(app,
      () => app.window.HW_CHECKIN && app.window.HW_CHECKIN.status === 'live'
         && app.window.HW.CHECKINS.length === 55,
      'the 55-person board landed');
    await settleUntil(app,
      () => app.window.HW.CHECKINS.every(
        (c) => c.history && c.history.state !== 'loading'),
      'every history settled');

    const read = app.window.HW.CHECKINS.filter((c) => c.history.state === 'history');
    const skipped = app.window.HW.CHECKINS.filter((c) => c.history.state === 'not_read_cap');
    assert.equal(read.length + skipped.length, 55);
    assert.equal(skipped.length, 15, 'the cap did not apply at 40');
    // All 55 resolve to the SAME identity here, so the cache answers 54 of them
    // — what matters is that the seam stopped ASKING, and that the rows past
    // the cap say nothing was read rather than reporting a count.
    for (const c of skipped) {
      assert.equal(c.history.priorOrders, null);
      assert.equal(c.history.label, 'visits unknown');
      assert.match(c.history.why, /Nothing was read for this person/);
    }
    assert.ok(asked >= 1, 'no history was read at all — the test proves nothing');
  }, { fetch: counting });
});

/* THE RESPONSE SHAPE THE OTHER TESTS CANNOT SEE.
 *
 * Every captured fixture carries subject.shared_accounts, so all three exercise
 * a route that KNOWS about account sharing. A route that predates that field
 * emits no such key at all — and `(d.subject || {}).shared_accounts` reads
 * undefined for it, which is indistinguishable from "not shared" and falls
 * through to the count. Identity 242's account is the shared one, so under that
 * shape its 461 orders land on the card as one person's.
 *
 * Absence is not emptiness. A route that never told us must read `visits
 * unknown`, the same as any other thing we could not measure.
 */
const stripKey = (body) => {
  const c = JSON.parse(JSON.stringify(body));
  delete c.subject.shared_accounts;
  delete c.subject.shared_accounts_note;
  return c;
};

test('a route that does not report sharing must not yield a per-person count', async () => {
  const OLD = { 242: stripKey(HIST[242]), 246: stripKey(HIST[246]) };
  assert.ok(!('shared_accounts' in OLD[242].subject),
    'the fixture for this test still carries the key it is meant to lack');
  assert.equal(OLD[242].state, 'history',
    'this only bites on the branch that prints a count');

  await withApp('pos', async (app) => {
    await liveRegister(app);
    for (const id of [242, 246]) {
      const c = rowFor(app, id);
      assert.ok(c, `the board row that resolves to identity ${id} is missing`);
      assert.equal(c.history.priorOrders, null,
        `identity ${id} was given a count off a route that never said whose it is`);
      assert.equal(c.history.label, 'visits unknown');
    }
    const txt = stripText(app);
    assert.ok(!/461/.test(txt),
      'the shared 461-order total is on a card: ' + txt);
  }, { fetch: serve(undefined, OLD) });
});

/* ═══ THE CLAIM ACTUALLY LEAVES THE BROWSER ════════════════════════════════
 *
 * THE GAP THIS CLOSES, stated as the mutation that used to survive: change
 *
 *     if (typeof _hw.claimCheckin === 'function' && !_origClaim) {
 *   to
 *     if (false) {
 *
 * in shared/hw-live-checkin.js step 7 and the entire suite stayed green. That
 * override is the ONLY thing that points HW.claimCheckin at the server; with it
 * gone the live build falls back to pos/data.jsx's mock, which writes
 * `claimedBy` onto the row object the seam published. The pill flips, the
 * associate is satisfied, nothing is recorded — and the next board read
 * replaces the CONTENTS of HW.CHECKINS and the claim silently disappears.
 * Every other check-in test drove the mock handles or asserted on rendered
 * text, so not one of them could tell the two builds apart.
 *
 * So this asserts on the WIRE and then on the state the SERVER reports back:
 * a POST to /api/checkin/state carrying this check-in's id, and a pill still
 * reading Unclaim after HW_CHECKIN.refresh() has thrown away every local row
 * and rebuilt them from the board.
 */

/** serve(), plus a writable /api/checkin/state that mutates its own board copy
 *  and records what was posted. The board is a deep copy per call, so a write
 *  here cannot leak into the read-only tests above. */
function serveWritable() {
  const board = JSON.parse(JSON.stringify(BOARD));
  const posts = [];
  const inner = serve(board);
  const okJson = (body) => Promise.resolve({
    ok: true, status: 200, statusText: 'OK', url: '',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  const fn = (url, init) => {
    const u = String(url);
    const method = String((init && init.method) || 'GET').toUpperCase();
    if (method === 'POST' && /\/api\/checkin\/state/.test(u)) {
      let body = {};
      try { body = JSON.parse((init && init.body) || '{}'); } catch (e) { body = {}; }
      posts.push({ url: u, body });
      const p = board.people.find((x) => x.id === body.checkin_id);
      if (!p) return okJson({ ok: false, why: 'no such check-in ' + body.checkin_id });
      // `unclaim: true` is a WORD, not a blank field — checkin_api._opt turns
      // '' and null into "absent", so a blank claimed_by releases nobody. This
      // stub honours that distinction, or it would not be testing the thing the
      // seam is careful about.
      if (body.unclaim === true) { p.claimed_by = null; return okJson({ ok: true, why: 'released' }); }
      if (body.claimed_by) { p.claimed_by = body.claimed_by; return okJson({ ok: true, why: 'claimed' }); }
      return okJson({ ok: false, why: 'nothing to change' });
    }
    return inner(url, init);
  };
  fn.stop = inner.stop;
  fn.posts = posts;
  fn.board = board;
  return fn;
}

/** The claim/unclaim control on the live strip card for this person. */
const pillFor = (app, name) => {
  const body = [...app.document.querySelectorAll('button')]
    .find((b) => (b.getAttribute('title') || '') === `Open ${name}'s cart`);
  assert.ok(body, `no live strip card for ${name}`);
  return [...body.parentElement.querySelectorAll('button')].find((b) => b !== body);
};

const untilPill = async (app, name, expect) => {
  for (let i = 0; i < 80; i++) {
    const p = pillFor(app, name);
    if (p && expect.test(p.textContent || '')) return p;
    await app.settle();
  }
  assert.fail(`the pill for ${name} never matched ${expect} — it reads: `
    + (pillFor(app, name) || {}).textContent);
};

test('a claim on the LIVE strip is POSTed, and survives a board refresh', async () => {
  const fetchFn = serveWritable();
  await withApp('pos', async (app) => {
    // The live claim ASKS who is taking the customer and deliberately drops the
    // name the register could supply: HW.STATS.associate is one of
    // pos/data.jsx's invented people, and writing that against a real customer
    // would look exactly like a real claim. So a person answers, here too.
    app.window.prompt = () => 'QA Associate';
    await liveRegister(app);

    const WHO = 'Dane Whitfield';   // the one unambiguous name on this board
    const row = app.window.HW.CHECKINS.find((c) => c.name === WHO);
    assert.ok(row && !row.claimedBy, `${WHO} did not start unclaimed`);

    const pill = pillFor(app, WHO);
    assert.match(pill.textContent, /Claim/);
    assert.doesNotMatch(pill.textContent, /Unclaim/);

    pill.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await untilPill(app, WHO, /Unclaim/);

    // 1. IT LEFT THE BROWSER. Under the `if (false)` mutation the mock handle
    //    runs instead and this array is empty, however convincing the pill is.
    const writes = fetchFn.posts.filter((p) => p.body.checkin_id === row.id);
    assert.equal(writes.length, 1,
      `the claim sent ${writes.length} writes to /api/checkin/state, not 1`);
    assert.match(writes[0].url, /\/api\/checkin\/state$/);
    assert.equal(writes[0].body.claimed_by, 'QA Associate',
      'the POST did not carry the name the person actually gave');

    // 2. THE SERVER HOLDS IT. refresh() re-reads the board and rebuilds every
    //    row from scratch, so anything kept only in component state is gone by
    //    the time this returns — which is exactly how the real claim vanished.
    await app.window.HW_CHECKIN.refresh();
    await untilPill(app, WHO, /Unclaim/);
    assert.equal(app.window.HW.CHECKINS.find((c) => c.name === WHO).claimedBy,
      'QA Associate', 'the claim did not survive the board refresh');

    // 3. AND THE RELEASE IS A WRITE TOO, with the word `unclaim`, not a blank.
    pillFor(app, WHO).dispatchEvent(
      new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await untilPill(app, WHO, /^Claim$/);
    const rel = fetchFn.posts.filter((p) => p.body.checkin_id === row.id
      && p.body.unclaim === true);
    assert.equal(rel.length, 1, 'the release never reached /api/checkin/state');
    await app.window.HW_CHECKIN.refresh();
    await untilPill(app, WHO, /^Claim$/);
    assert.equal(app.window.HW.CHECKINS.find((c) => c.name === WHO).claimedBy, null,
      'the release did not survive the board refresh');
  }, { fetch: fetchFn });
});
