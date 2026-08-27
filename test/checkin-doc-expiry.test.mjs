/* THE DOCUMENT EXPIRY, FROM THE SCANNER TO THE WIRE AND BACK TO THE STRIP.
 *
 * /api/checkin accepted a government document's expiry under three spellings,
 * answered ok=True and stored none of them. The server side of that was fixed
 * on 2026-08-27; this file covers the two halves on THIS side, which were
 * what made the fix inert and the render dishonest:
 *
 *   1. shared/hw-live-checkin.js create() posted five fields and none of them
 *      was the expiry, so the value the route now stores could never arrive
 *      from a counter screen at all.
 *   2. The check-in strip showed a document HASH and nothing else, so an
 *      expired licence and a 2031 passport reached the associate as the same
 *      eight characters.
 *
 * THE FIXTURES ARE CAPTURES, NOT PAYLOADS WRITTEN TO PASS.
 * fixtures/checkin-doc-expiry-views.json is the output of the real
 * wmdemo.checkin_api._doc_expiry_view for all four states, dumped against the
 * captured board's own `now` (1787847427.34) so the sentences, the
 * `days_left` and the state names are the server's own words rather than this
 * file's idea of them. If the server ever reworded a state, these break —
 * which is the point: the strip is asserting that it renders what the server
 * said, not that it renders something plausible.
 *
 * fixtures/checkin-board.json is a verbatim capture that PREDATES the expiry
 * work and carries no `doc_expiry` at all. That is not a gap in the fixtures;
 * it is the fifth case, and it has its own test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const load = (n) => JSON.parse(readFileSync(FIX + n, 'utf8'));

const BOARD = load('checkin-board.json');
const CONTRACT = load('checkin-contract.json');
const VIEWS = load('checkin-doc-expiry-views.json');

/* ── the server, as far as this seam can tell ─────────────────────────────
 *
 * Every POST body is recorded verbatim. The point of half these tests is what
 * is IN and what is ABSENT FROM that body, and a mock that answered without
 * keeping it could not tell the two apart.
 */
function serve(board, opts) {
  const o = opts || {};
  const posts = [];
  const ok = (body) => ({
    ok: true, status: 200, statusText: 'OK', url: '',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  const fn = (url, init) => {
    const u = String(url);
    if (init && String(init.method || 'GET').toUpperCase() === 'POST') {
      let parsed = null;
      try { parsed = JSON.parse(init.body); } catch (e) { parsed = { __unparsable: String(init.body) }; }
      posts.push({ url: u, body: parsed });
      if (/\/api\/checkin$/.test(u)) {
        if (o.refuse) return Promise.resolve(ok(o.refuse));
        return Promise.resolve(ok({
          ok: true, id: 'ci-new', state: 'waiting',
          checkin: { id: 'ci-new', state: 'waiting' },
          doc_expires_at: null, doc_expiry: VIEWS.views.not_supplied,
          why: 'checked in at a test counter',
        }));
      }
      return Promise.resolve(ok({ ok: true, why: 'accepted' }));
    }
    if (/\/api\/checkin\/board/.test(u)) return Promise.resolve(ok(board || BOARD));
    if (/\/api\/checkin\/contract/.test(u)) return Promise.resolve(ok(CONTRACT));
    if (/\/api\/checkin\/candidates/.test(u)) return Promise.resolve(ok({ ok: true, candidates: [] }));
    return Promise.resolve({
      ok: false, status: 503, statusText: 'not served by this test', url: u,
      json: () => Promise.resolve(null), text: () => Promise.resolve(''),
    });
  };
  fn.posts = posts;
  return fn;
}

const settleUntil = async (app, pred, what) => {
  for (let i = 0; i < 80; i++) {
    let got = false;
    try { got = !!pred(); } catch (e) { got = false; }
    if (got) return;
    await app.settle();
  }
  assert.fail('never became true within 80 settles: ' + what);
};

const live = async (app) => {
  await settleUntil(app,
    () => app.window.HW_CHECKIN && app.window.HW_CHECKIN.status === 'live',
    'the check-in seam never went live');
};

/** The strip's own panel, opened, as one whitespace-collapsed string. */
const panelText = async (app) => {
  app.window.HW_CHECKIN.open();
  await app.settle();
  const el = app.document.getElementById('hw-checkin-panel');
  assert.ok(el, 'the check-in panel is not in the document');
  return (el.textContent || '').replace(/\s+/g, ' ');
};

/** A board carrying one person per doc_expiry state, plus the counts the real
 *  route derives from exactly those rows. Everything else is the capture. */
function boardWithStates(states, counts) {
  const b = JSON.parse(JSON.stringify(BOARD));
  b.people = states.map((s, i) => Object.assign({}, BOARD.people[i], {
    id: 'ci-' + s, name: 'Person ' + s,
    doc_expiry: VIEWS.views[s],
    doc_expires_at: VIEWS.views[s].expires_at,
  }));
  b.people_counts = Object.assign({}, BOARD.people_counts,
    { in_room: b.people.length }, counts || {});
  return b;
}

/* ═══ 1. WHAT THE COUNTER SENDS ══════════════════════════════════════════ */

test('the expiry the scanner read is what reaches the wire', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    // The scanner's own shape: pos/verification.jsx IdScanPanel puts the
    // expiry on the document as `doc.expires`, YYYY-MM-DD (DEMO_IDS, :493).
    const r = await app.window.HW_CHECKIN.create({
      first_name: 'Aiko', last_name: 'Tanaka', phone: '', dob: '09/17/1999',
      doc: { type: 'Passport', num: '••••4407', expires: '2032-09-16', scannedAt: 'Just now' },
    });
    assert.equal(r.ok, true, 'the create was refused: ' + r.why);
    const post = f.posts.find((p) => /\/api\/checkin$/.test(p.url));
    assert.ok(post, 'nothing was POSTed to /api/checkin');
    assert.equal(post.body.doc_expires_at, '2032-09-16',
      'the scanned expiry did not reach the body: ' + JSON.stringify(post.body));
  }, { fetch: f });
});

test('the expiry is sent under ONE spelling — the canonical one', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    await app.window.HW_CHECKIN.create({
      first_name: 'Aiko', last_name: 'Tanaka',
      doc: { expires: '2032-09-16' },
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    // checkin_api accepts three and REFUSES a body carrying two that disagree,
    // because choosing between two compliance dates by key order is not a
    // decision a wire adapter may make. The way never to trip that is to send
    // one key, so the canonical name is the only one on the body.
    assert.equal(VIEWS.expiry_key_canonical, 'doc_expires_at');
    const sent = VIEWS.expiry_keys.filter((k) => k in body);
    assert.equal(sent.join(','), 'doc_expires_at',
      'more than one expiry spelling is on the body: ' + sent.join(','));
  }, { fetch: f });
});

test('a row that flattened the scan is understood under any of the three spellings', async () => {
  for (const key of VIEWS.expiry_keys) {
    const f = serve();
    await withApp('pos', async (app) => {
      await live(app);
      const row = { first_name: 'A', last_name: 'B' };
      row[key] = '2030-01-19';
      await app.window.HW_CHECKIN.create(row);
      const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
      assert.equal(body.doc_expires_at, '2030-01-19',
        `an expiry supplied as \`${key}\` was dropped`);
    }, { fetch: f });
  }
});

test('no expiry means the key is ABSENT, never a blank standing in for one', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    await app.window.HW_CHECKIN.create({ first_name: 'A', last_name: 'B', doc: null });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    assert.equal('doc_expires_at' in body, false,
      'a blank expiry was sent as a value: ' + JSON.stringify(body));
    // And a document that carries an EMPTY expiry is the same nothing, not ''.
    const f2 = serve();
    await withApp('pos', async (app2) => {
      await live(app2);
      await app2.window.HW_CHECKIN.create({
        first_name: 'A', last_name: 'B', doc_expires_at: '   ', doc: { expires: '' },
      });
      const b2 = f2.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
      assert.equal('doc_expires_at' in b2, false,
        'whitespace was sent as an expiry: ' + JSON.stringify(b2));
    }, { fetch: f2 });
  }, { fetch: f });
});

test('a blank on the row does not mask a real date on the document', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    // First-non-blank-wins, not first-key-present-wins. A form field left
    // untouched next to a scan that DID read a date must not win.
    await app.window.HW_CHECKIN.create({
      first_name: 'A', last_name: 'B',
      doc_expires_at: '', expires_at: '  ',
      doc: { expires: '2028-01-09' },
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    assert.equal(body.doc_expires_at, '2028-01-09');
  }, { fetch: f });
});

test('the date is sent EXACTLY as read, never re-read into another calendar', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    // HWExpiry.parseExpiry accepts MM/DD/YYYY; store._EXPIRY_FORMATS does not.
    // Translating here would decide in a screen whether 03/04/2027 is March or
    // April and post a date nobody printed on the document. The server refuses
    // it BY NAME and asks for a re-scan, which is the better answer.
    await app.window.HW_CHECKIN.create({
      first_name: 'A', last_name: 'B', doc: { expires: '03/04/2027' },
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    assert.equal(body.doc_expires_at, '03/04/2027',
      'the seam reinterpreted a compliance date before sending it');
  }, { fetch: f });
});

test('a masked document number is never laundered into a gov_id_hash', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    await app.window.HW_CHECKIN.create({
      first_name: 'Aiko', last_name: 'Tanaka',
      doc: { type: 'Passport', num: '••••4407', expires: '2032-09-16' },
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    // The route takes ONLY a hash engine._gov_id_hash computed, and refuses
    // raw document values outright. `doc.num` is a masked fragment of a
    // document number; sent as a hash it would be both forbidden things at
    // once, and would sit as the matcher's highest-weighted signal matching
    // nobody, forever, silently.
    assert.equal('gov_id_hash' in body, false,
      'a hash was invented for a scan that supplied none: ' + JSON.stringify(body));
    const raw = ['gov_id', 'gov_id_number', 'document_number', 'dl_number',
                 'id_number', 'barcode', 'pdf417', 'num'].filter((k) => k in body);
    assert.equal(raw.join(','), '', 'a raw document value is on the body: ' + raw.join(','));
    assert.ok(!JSON.stringify(body).includes('4407'),
      'the document number leaked into the body: ' + JSON.stringify(body));
  }, { fetch: f });
});

test('a real hash, from a caller that has one, is forwarded untouched', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    await app.window.HW_CHECKIN.create({
      first_name: 'A', last_name: 'B',
      gov_id_hash: '9f2c4e18aa77bd0311e5c6d2a4b8f09317ee5c41',
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    assert.equal(body.gov_id_hash, '9f2c4e18aa77bd0311e5c6d2a4b8f09317ee5c41');
  }, { fetch: f });
});

test('the server\'s own refusal sentence is what the counter is shown', async () => {
  const refusal = {
    ok: false, field: 'doc_expires_at',
    doc_expiry: { state: 'unreadable', supplied_as: 'doc_expires_at', supplied_value: 'not-a-date' },
    why: "refused: doc_expires_at='not-a-date' is not a readable document expiry, and this "
       + "check-in was NOT created.",
  };
  const f = serve(null, { refuse: refusal });
  await withApp('pos', async (app) => {
    await live(app);
    const r = await app.window.HW_CHECKIN.create({
      first_name: 'A', last_name: 'B', doc: { expires: 'not-a-date' },
    });
    assert.equal(r.ok, false, 'a refused create reported success');
    assert.match(r.why, /not a readable document expiry/,
      'the refusal was paraphrased instead of shown: ' + r.why);
    const txt = await panelText(app);
    assert.match(txt, /not a readable document expiry/,
      'the refusal never reached the panel');
  }, { fetch: f });
});

/* ═══ 2. WHAT THE STRIP RENDERS ══════════════════════════════════════════ */

test('the four states render as four different rows, not four dashes', async () => {
  const f = serve(boardWithStates(VIEWS.contract_states));
  await withApp('pos', async (app) => {
    await live(app);
    const txt = await panelText(app);
    // Every state's own SENTENCE, verbatim from the server. A state rendered
    // without its sentence is a label an associate has to have been taught.
    for (const s of VIEWS.contract_states) {
      if (s === 'valid') continue;      // the one state with nothing to do
      const why = VIEWS.views[s].why;
      assert.ok(txt.includes(why.replace(/\s+/g, ' ')),
        `the server's sentence for \`${s}\` is not on the panel`);
    }
    // And the two DATES are not the only thing telling them apart.
    assert.match(txt, /EXPIRED/, 'no expired row is called expired');
    assert.match(txt, /2026-05-30/, 'the expired date is missing');
    assert.match(txt, /2031-07-23/, 'the valid date is missing');
  }, { fetch: f });
});

test('an absence NEVER renders as a valid document', async () => {
  const f = serve(boardWithStates(['not_supplied', 'unreadable']));
  await withApp('pos', async (app) => {
    await live(app);
    const txt = await panelText(app);
    // The whole point. Three problems, three remedies, and the two that are
    // absences must not wear the word the present-and-good one wears.
    assert.ok(txt.includes('no expiry recorded'),
      'a row with no expiry does not say so: ' + txt.slice(0, 400));
    assert.ok(txt.includes('unreadable — re-scan'),
      'an unreadable expiry does not name its remedy');
    // THE LITERAL RENDERING, not a prettier one that can never match.
    // personHTML concatenates the two fact spans with no whitespace, so a
    // valid document reads "documentvalid · 2031-07-23" in textContent. An
    // earlier version of this line looked for "document valid ·" — with the
    // space — which no board can ever produce, so it passed for every board
    // including one that rendered every state as the word `valid`. A negative
    // assertion that cannot fail is decoration on the one claim this file
    // exists to make.
    assert.ok(!txt.includes('documentvalid'),
      'an absence is being rendered as a valid document: ' + txt.slice(0, 400));
    // And structurally, off the published row rather than off the pixels.
    const states = app.window.HW.CHECKINS.map((c) => c.docExpiry.state).sort().join(',');
    assert.equal(states, 'not_supplied,unreadable',
      'the rows themselves do not carry the two absent states: ' + states);
    // not_supplied and unreadable are BOTH amber and must still be legible
    // apart with the colour thrown away.
    assert.notEqual(VIEWS.views.not_supplied.why, VIEWS.views.unreadable.why);
    assert.ok(txt.includes('not "valid forever"') || txt.includes('not ‘valid forever’')
           || txt.includes("not 'valid forever'"),
      'the not-supplied row does not say it is not a waiver');
  }, { fetch: f });
});

test('a board that never reported an expiry is not read as "none was recorded"', async () => {
  // BOARD is a verbatim capture from before the expiry work: no doc_expiry
  // anywhere on it. Defaulting that to not_supplied would put the server's own
  // words — "no document expiry was recorded with this check-in" — under a
  // server that was never asked. Different fact, different remedy (upgrade the
  // server, not re-scan the customer).
  const f = serve(BOARD);
  await withApp('pos', async (app) => {
    await live(app);
    const txt = await panelText(app);
    assert.ok(!txt.includes(VIEWS.views.not_supplied.why),
      'a silent board was rendered as "no expiry was recorded"');
    assert.ok(txt.includes('this server does not report it'),
      'a silent board does not say who did not speak: ' + txt.slice(0, 500));
    assert.match(txt, /NOT "no expiry was recorded"/,
      'the two absences are not distinguished in words');
    const row = app.window.HW.CHECKINS.find((c) => c.docExpiry);
    assert.equal(row.docExpiry.state, 'not_published');
    assert.equal(row.docExpiry.served, false);
  }, { fetch: f });
});

test('the three counts are printed separately and never added together', async () => {
  const f = serve(boardWithStates(
    ['expired', 'expired', 'not_supplied', 'unreadable'],
    { doc_expired: 2, doc_expiry_not_supplied: 1, doc_expiry_unreadable: 1 }));
  await withApp('pos', async (app) => {
    await live(app);
    const txt = await panelText(app);
    assert.match(txt, /2 expired documents/, 'the expired count is missing');
    assert.match(txt, /1 with no expiry recorded/, 'the not-supplied count is missing');
    assert.match(txt, /1 unreadable expiry/, 'the unreadable count is missing');
    // 2+1+1. A combined "4 documents need attention" is actionable for none of
    // the three, which is why the route counts them apart.
    assert.ok(!/4 documents/.test(txt), 'the three counts were summed: ' + txt.slice(0, 400));
  }, { fetch: f });
});

test('counts the board did not send are not printed as three confident zeroes', async () => {
  const f = serve(BOARD);      // the pre-expiry capture: no doc_* counts at all
  await withApp('pos', async (app) => {
    await live(app);
    const txt = await panelText(app);
    assert.ok(!/0 expired/.test(txt) && !/no expired documents/.test(txt),
      'a board that never counted was reported as zero expired: ' + txt.slice(0, 400));
    assert.match(txt, /reported no document-expiry counts/,
      'the missing counts are not disclosed');
  }, { fetch: f });
});

test('a state the contract does not publish is shown as itself, not folded into the four',
  async () => {
    const b = JSON.parse(JSON.stringify(BOARD));
    b.people = [Object.assign({}, BOARD.people[0], {
      doc_expiry: { state: 'conflicting', expires_on: null, why: 'two spellings disagree' },
    })];
    b.people_counts = Object.assign({}, BOARD.people_counts, { in_room: 1, doc_expired: 0 });
    const f = serve(b);
    await withApp('pos', async (app) => {
      await live(app);
      const txt = await panelText(app);
      assert.match(txt, /conflicting — unrecognised state/,
        'an unknown state was silently folded into one of the four: ' + txt.slice(0, 400));
    }, { fetch: f });
  });

test('a board that reported only SOME of the three counts says which it left out', async () => {
  // All three arrive together from the real route, so this is a board this
  // screen does not recognise. The unguarded render is the one that reads
  // best — two confident figures and a silence an eye takes for a zero.
  const b = boardWithStates(['expired'], { doc_expired: 1 });
  delete b.people_counts.doc_expiry_not_supplied;
  delete b.people_counts.doc_expiry_unreadable;
  const f = serve(b);
  await withApp('pos', async (app) => {
    await live(app);
    const txt = await panelText(app);
    assert.match(txt, /1 expired document/, 'the count that WAS sent is missing');
    assert.match(txt, /did not report the no-expiry-recorded or the unreadable counts/,
      'the two absent counts are passed over in silence: ' + txt.slice(0, 500));
    assert.ok(!/none missing an expiry/.test(txt) && !/none unreadable/.test(txt),
      'an uncounted category was rendered as a measured zero');
  }, { fetch: f });
});

test('two spellings that DISAGREE are handed to the server, not resolved here', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    // checkin_api refuses this body outright and quotes both dates back,
    // because "a compliance date must never be decided by key order". Picking
    // the first non-blank here and sending only that would make the winner
    // 2027-09-14 and ensure the server NEVER SAW the disagreement it exists to
    // catch. create() is public, so this caller is reachable.
    await app.window.HW_CHECKIN.create({
      first_name: 'A', last_name: 'B',
      doc_expires_at: '2027-09-14', expires_at: '2025-01-02',
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    assert.equal(body.doc_expires_at, '2027-09-14');
    assert.equal(body.expires_at, '2025-01-02',
      'the losing date was dropped, so the server cannot refuse the conflict: '
      + JSON.stringify(body));
  }, { fetch: f });
});

test('the same date under two words is a careful caller, not a conflict', async () => {
  const f = serve();
  await withApp('pos', async (app) => {
    await live(app);
    await app.window.HW_CHECKIN.create({
      first_name: 'A', last_name: 'B',
      doc_expires_at: '2029-04-11', expires_at: '2029-04-11',
      doc: { expires: '2029-04-11' },
    });
    const body = f.posts.find((p) => /\/api\/checkin$/.test(p.url)).body;
    const sent = VIEWS.expiry_keys.filter((k) => k in body);
    assert.equal(sent.join(','), 'doc_expires_at',
      'one date under three words was forwarded as a conflict: ' + sent.join(','));
    assert.equal(body.doc_expires_at, '2029-04-11');
  }, { fetch: f });
});
