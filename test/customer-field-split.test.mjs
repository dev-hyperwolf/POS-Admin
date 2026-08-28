/* ── ONE FIELD PER CUSTOMER PARAMETER ────────────────────────────────────────
 *
 * [OWNER RULING 2026-08-27] "each customer parameter needs a dedicated input
 *  field, we cannot have dirty data — first name / last name / street number +
 *  street name / city / state / zip — everything needs to have its own separate
 *  field. add this to your to-do list and fix it system-wide"
 *
 * WHY THESE ASSERTIONS EXIST, AND WHY THEY ARE NOT COSMETIC.
 *
 * The identity ladder matches on `name_dob_fp`. Verified against the server on
 * 2026-08-27, wmdemo/identity_match.py:176:
 *
 *     def name_dob_fp(first, last, dob):
 *         if not (first and last and dob): return None
 *         key = "%s|%s|%s" % (first.strip().casefold(), last.strip().casefold(), dob)
 *
 * It takes first and last SEPARATELY, and wmdemo/server.py:4843 accepts only
 * `first_name`/`last_name` — there is no joined `name` key on any create
 * endpoint. So a "Full name" box in the UI was never the wire format. It was a
 * lossy local detour that the client had to reverse, by guessing on whitespace,
 * before it could speak to the server at all — and that guess decides whether
 * two records are the same person. This estate has already put one Weedmaps
 * customer id on four live identities carrying 458 orders, and has already
 * nearly written a government-document hash onto a stranger.
 *
 * The rule these tests defend has two halves, and the second is the one that
 * gets dropped:
 *
 *   1. CAPTURE SPLIT. A field per parameter, so nothing has to infer.
 *   2. WHEN A SPLIT MUST BE GUESSED FROM LEGACY DATA, IT IS MARKED AS A GUESS
 *      AND STAYS EDITABLE. It is never handed on as though the document said
 *      it. This estate has spent the day removing places where an inference was
 *      rendered as a measurement; a guessed surname wearing a "· from ID" label
 *      would be a new one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const inputs = (app) => [...app.document.querySelectorAll('input')];
const byPlaceholder = (app, ph) => inputs(app).find((i) => (i.getAttribute('placeholder') || '').includes(ph));
function setValue(app, el, value) {
  assert.ok(el, 'no field to type into');
  Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
function openMember(app, name) {
  const row = [...app.document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes(name));
  assert.ok(row, `no table row for ${name}`);
  row.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/* ── 1. the splitter never launders a guess into a fact ──────────────────── */

test('a guessed name split is ALWAYS flagged as a guess, and an empty one is not', async () => {
  await withApp('pos', async (app) => {
    const N = app.window.HWName;
    assert.ok(N && typeof N.splitGuess === 'function', 'window.HWName.splitGuess did not load');

    // The easy case is still a guess. This is the whole point: 'Nina Alvarez'
    // being right does not make the RULE right, and the rule is what runs on
    // 'Mary Jo Van Der Berg'.
    const easy = N.splitGuess('Nina Alvarez');
    assert.equal(easy.first, 'Nina');
    assert.equal(easy.last, 'Alvarez');
    assert.equal(easy.guessed, true,
      'a split derived from whitespace is a GUESS even when it happens to be correct — ' +
      'if the easy case reports itself as certain, every caller learns to trust the flag ' +
      'and the flag stops meaning anything on the hard cases');

    // An ABSENCE is not a guess. Flagging it would put a warning on every
    // untouched field, which is how operators learn to ignore the warning.
    const empty = N.splitGuess('');
    assert.equal(empty.guessed, false, 'an empty name is an absence, not a guess');
    assert.equal(empty.first, '');
    assert.equal(empty.last, '');

    // Every guess must carry a human-readable reason, or the UI has nothing
    // honest to show and will fall back to showing nothing.
    for (const s of ['Ng', 'Nina Alvarez', 'Mary Jo Van Der Berg']) {
      const g = N.splitGuess(s);
      assert.equal(g.guessed, true, `'${s}' must be flagged as guessed`);
      assert.ok(g.note && g.note.length > 20,
        `'${s}' was flagged as a guess with no explanation — a mark with no reason ` +
        'beside it gets dismissed, and the operator never learns what to check');
    }
  });
});

test("a mononym's last name is EMPTY, never a copy of the first", async () => {
  await withApp('pos', async (app) => {
    const g = app.window.HWName.splitGuess('Ng');
    assert.equal(g.first, 'Ng');
    assert.equal(g.last, '',
      'copying the single token into the surname field would mint a name_dob_fp for a ' +
      'surname we do not have, and it would collide with every real person carrying "Ng" ' +
      'as a surname — the server returns None for a missing last name, which is the ' +
      'honest outcome: no fingerprint beats a wrong one');
    assert.equal(g.guessed, true);
  });
});

test('the multi-word rule is applied as written, and admits what it gets wrong', async () => {
  await withApp('pos', async (app) => {
    const N = app.window.HWName;
    // Documenting the ACTUAL behaviour, including that it is wrong here. A test
    // that only asserted the easy case would let this rule silently change.
    const g = N.splitGuess('Mary Jo Van Der Berg');
    assert.equal(g.last, 'Berg', 'last-token rule: this is WRONG for this name, and that is why it is marked');
    assert.equal(g.first, 'Mary Jo Van Der');
    assert.equal(g.guessed, true);
    assert.match(g.note, /Van Der Berg|compound|Compound/,
      'the note must name the failure mode, not just say "this is a guess"');
    // Joining is lossless and carries no warning — display only.
    assert.equal(N.join('Nina', 'Alvarez'), 'Nina Alvarez');
    assert.equal(N.join('Ng', ''), 'Ng', 'a mononym must not join to a trailing space');
  });
});

/* ── 2. the scanner reads split fields, because the document has them ────── */

test('a scanned document yields first and last as SEPARATE fields, unguessed', async () => {
  await withApp('pos', async (app) => {
    // Render the real IdScanPanel with a spy for onChange. mount() constructs
    // window[name] with no props, so the probe supplies them.
    app.window.__docs = [];
    app.window.__ScanProbe = () => app.window.React.createElement(
      app.window.IdScanPanel, { onChange: (d) => { if (d) app.window.__docs.push(d); } });
    await app.mount('__ScanProbe');

    assert.ok(app.click('Scan ID'), 'no Scan ID button');
    await app.waitFor(() => app.window.__docs.length > 0, 3000);

    const d = app.window.__docs[0];
    assert.ok(d.firstName, 'the scan emitted no first name field');
    assert.ok(d.lastName, 'the scan emitted no last name field');
    assert.equal(d.nameGuessed, false,
      'AAMVA PDF417 carries family name and given name as distinct elements — a document ' +
      'read has nothing to guess, and marking it as guessed would cry wolf on the one ' +
      'path that is actually trustworthy');
    // `filter(Boolean)` matters: joinName drops an empty half rather than
    // leaving a trailing space, so a mononym joins to itself. Concatenating
    // with a bare ' ' would pass today only because no fixture is a mononym,
    // and would start lying the moment one is added.
    assert.equal(d.name, [d.firstName, d.lastName].filter(Boolean).join(' '),
      'the joined `name` must be DERIVED from the split pair, not stored beside it — ' +
      'two independent copies of one fact is how they drift apart');
  });
});

/** Drive the real IdScanPanel `n` times and return every document it emitted.
 *  The probe holds `value` itself, which is what makes Re-scan → Scan work: the
 *  panel clears to idle only when the caller actually drops the document. */
async function scanTimes(app, n) {
  app.window.__docs = [];
  app.window.__ScanProbe = function ScanProbe() {
    const R = app.window.React;
    const [v, setV] = R.useState(null);
    return R.createElement(app.window.IdScanPanel, {
      value: v, onChange: (d) => { setV(d); if (d) app.window.__docs.push(d); } });
  };
  await app.mount('__ScanProbe');
  for (let i = 0; i < n; i++) {
    const before = app.window.__docs.length;
    if (!app.click('Scan ID')) {
      assert.ok(app.click('Re-scan'), 'neither Scan ID nor Re-scan was on screen');
      await app.settle();
      assert.ok(app.click('Scan ID'), 'Re-scan did not return the panel to a scannable state');
    }
    await app.waitFor(() => app.window.__docs.length > before, 3000);
    await app.settle();
  }
  return app.window.__docs;
}

test('a scanned address arrives split, and an absent address is null rather than a blank shape', async () => {
  await withApp('pos', async (app) => {
    // The pool cycles deterministically over six people; six scans sees them all.
    const docs = await scanTimes(app, 6);
    const withAddr = docs.find((d) => d.address);
    assert.ok(withAddr, 'no scanned document ever carried an address');
    for (const k of ['streetNumber', 'streetName', 'city', 'state', 'zip']) {
      assert.ok(k in withAddr.address, `the scanned address is missing a dedicated \`${k}\` field`);
    }
    assert.equal(withAddr.address.street,
      (withAddr.address.streetNumber + ' ' + withAddr.address.streetName).trim(),
      'the joined `street` must be derived from the split pair — pos/screen-stubs.jsx:367 ' +
      'still reads it, and it must not silently lose the house number');
    assert.equal(withAddr.address.guessed, false, 'a document read is not a guess');

    // NAME THE PRODUCER, do not just look for "a null somewhere". The
    // book-matched branch emits a null address too, so an assertion that only
    // asked "did any document report null" passed even with the passport branch
    // mutated to emit a blank shape — it was reading the OTHER branch's null.
    // Caught by mutation on 2026-08-27; this is the version that actually fails.
    const passport = docs.find((d) => !d.returning && d.type === 'Passport');
    assert.ok(passport, 'the pool produced no document-read passport to check');
    assert.equal(passport.address, null,
      'a passport carries NO address, and null is how that is said. An empty-string shape ' +
      'renders as a blank street the operator assumes they simply have not scrolled to — ' +
      'an absence wearing the face of a value, which is the defect this file exists to stop');
  });
});

test('the ONE path that must still guess a name says so on the document itself', async () => {
  await withApp('pos', async (app) => {
    const docs = await scanTimes(app, 6);

    // Two producers, two provenances. A document read is split at source; a
    // match against the customer book is not, because pos/data.jsx:86 stores a
    // joined `name` and nothing else. Both reach the same form, and they must
    // NOT arrive looking identical.
    const read = docs.filter((d) => !d.returning);
    const matched = docs.filter((d) => d.returning);
    assert.ok(read.length, 'no document-read scans in the pool');
    assert.ok(matched.length,
      'no book-matched scans in the pool — the returning branch is the one that guesses, ' +
      'so a run that never exercises it proves nothing about the marking');

    for (const d of read) {
      assert.equal(d.nameGuessed, false, 'a document read has nothing to guess');
    }
    for (const d of matched) {
      assert.equal(d.nameGuessed, true,
        'the customer book stores a joined name, so splitting it is an INFERENCE. Handing it ' +
        'on unmarked is exactly the defect this estate has spent the day removing — an ' +
        'inference rendered as a measurement, here under a "· from ID" label that would be ' +
        'claiming a government document said something it never said');
      assert.ok(d.nameGuessNote && d.nameGuessNote.length > 20,
        'the guess is flagged with no reason attached, so nothing tells the operator what to check');
      assert.equal(d.name, [d.firstName, d.lastName].filter(Boolean).join(' '),
        'the joined name must stay derived from the split pair even on the guessed path');
    }
  });
});

/* ── 3. the address book captures a state instead of assuming California ─── */

test('the delivery address form has a dedicated field per address parameter', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    assert.ok(app.click('Add address'), 'no Add address button');
    await app.settle();

    for (const ph of ['Label', 'Street no.', 'Street name', 'City', 'State', 'ZIP']) {
      assert.ok(byPlaceholder(app, ph), `no dedicated input for "${ph}"`);
    }
    // The old single "Street address" box must be GONE, not merely joined by
    // new siblings — two ways to enter one parameter is the dirty-data bug
    // wearing a bigger form.
    assert.equal(inputs(app).filter((i) => (i.getAttribute('placeholder') || '') === 'Street address').length, 0,
      'the joined "Street address" box is still present alongside the split pair');
  });
});

test('an out-of-state delivery address is stored as its real state, not as CA', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Add address');
    await app.settle();

    for (const [ph, v] of [['Label', 'Sister'], ['Street no.', '3400'], ['Street name', 'S Las Vegas Blvd'],
                           ['City', 'Las Vegas'], ['State', 'NV'], ['ZIP', '89109']]) {
      setValue(app, byPlaceholder(app, ph), v);
      await app.settle();
    }
    assert.ok(app.click('Save'), 'Save was refused with every field filled');
    await app.settle();

    const t = app.text();
    assert.match(t, /3400 S Las Vegas Blvd/, 'the split street was not recomposed for display');
    assert.match(t, /NV/, 'the state the operator typed was discarded');
    assert.doesNotMatch(t, /Las Vegas, CA/,
      'this line used to end in a hardcoded "CA", so every out-of-state address on file ' +
      'rendered as Californian — a fabricated value wearing a compliance-shaped face');
  });
});

test('Save is refused OUT LOUD, naming the split fields it is still missing', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    openMember(app, 'Manisha Saini');
    await app.settle();
    app.click('Add address');
    await app.settle();
    setValue(app, byPlaceholder(app, 'Label'), 'Mum');
    await app.settle();

    const save = [...app.document.querySelectorAll('button')].find((b) => /^Save$/.test((b.textContent || '').trim()));
    assert.equal(save.disabled, true, 'Save must not look clickable with an empty address');
    const t = app.text();
    // Each parameter is named separately, because "a street address" told the
    // operator nothing about WHICH of the two street boxes was empty.
    for (const frag of ['a street number', 'a street name', 'a city', 'a 2-letter state', 'a 5-digit ZIP']) {
      assert.ok(t.includes(frag), `the refusal does not name the missing "${frag}" — a greyed-out ` +
        'button with no stated reason makes the operator guess which of six fields is the blocker');
    }
  });
});
