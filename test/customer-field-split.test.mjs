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
/** A CIField is a labelled input with NO placeholder, so the label sitting
 *  immediately above it is the only handle on it. */
function fieldByLabel(app, label) {
  const wrap = [...app.document.querySelectorAll('div')].find((d) => {
    const lab = d.firstElementChild;
    return lab && (lab.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()) &&
      d.querySelector(':scope > input');
  });
  return wrap && wrap.querySelector(':scope > input');
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

/* ── 4. the check-in screen — the surface the ruling was pointed at ──────── */
//
// The owner's screenshot was THIS form: one "FULL NAME" box, one "Street
// address" box. Everything below it was already waiting and was being thrown
// away — the scanner has emitted `firstName`, `lastName`, `nameGuessed`,
// `nameGuessNote` and a split `address` since the producer was migrated, and
// pos/checkin.jsx read `d.name` and `d.dob` and dropped the rest, then made the
// client re-derive by guesswork a split it was being handed for free.

/** Open the check-in modal and reach the MANUAL new-customer form by searching
 *  for somebody who does not exist. This is the one path a joined legacy string
 *  still travels — the operator types a whole name, is told nobody has it, and
 *  the form opens on the split. */
async function manualForm(app, query) {
  await app.mount('MembersScreen');
  assert.ok(app.click('New check-in'), 'no New check-in tile');
  await app.settle();
  // Three inputs on this page match a shorter search fragment; this is the
  // modal's own.
  assert.ok(app.type('by name, e-mail or phone', query), 'no manual search field');
  await app.settle();
  assert.ok(app.click('Enter manually'), 'a search matching nobody must still offer a manual path');
  await app.settle();
}

test('the check-in new-customer form has a dedicated field per parameter, and the joined boxes are GONE', async () => {
  await withApp('pos', async (app) => {
    await manualForm(app, 'Zzz Nobody Probe');

    for (const l of ['First name', 'Last name', 'Date of birth', 'Phone', 'Email']) {
      assert.ok(fieldByLabel(app, l), `no dedicated input labelled "${l}"`);
    }
    for (const ph of ['Street no.', 'Street name', 'City', 'State', 'ZIP']) {
      assert.ok(byPlaceholder(app, ph), `no dedicated input for "${ph}"`);
    }
    // GONE, not merely joined by new siblings. Two ways to enter one parameter
    // is the dirty-data bug wearing a bigger form.
    assert.equal(inputs(app).filter((i) => (i.getAttribute('placeholder') || '') === 'Street address').length, 0,
      'the joined "Street address" box is still present alongside the split pair');
    assert.doesNotMatch(app.text(), /Full name/,
      'the joined "Full name" box is still on the screen the owner sent back — the server has ' +
      'no joined name key on any create path (wmdemo/server.py:4843), so this box was never ' +
      'the wire format, only a lossy detour the client had to reverse by guessing');
  });
});

test('the State box starts EMPTY — absent is not California', async () => {
  await withApp('pos', async (app) => {
    await manualForm(app, 'Zzz Nobody Probe');
    const st = byPlaceholder(app, 'State');
    assert.equal(st.value, '',
      "the form's initial state carried `state: 'CA'`, so an operator who never looked at that " +
      'box STORED California on an out-of-state licence. It is the identical defect removed ' +
      'from customer-extras.jsx one step later in the pipe, where a hardcoded CA in a render ' +
      'line made every out-of-state address on file display as Californian. An absence must ' +
      'read as an absence — a default that looks like a captured value is a fabrication');
    assert.doesNotMatch(app.text(), /\bCA\b/,
      "no 'CA' may appear anywhere on an untouched new-customer form — not as a value and not " +
      'as a placeholder that reads like one');
  });
});

test('a name split out of a typed query is prefilled, MARKED as a guess, and never labelled from ID', async () => {
  await withApp('pos', async (app) => {
    // Three words: the case the last-token rule gets WRONG, which is the whole
    // reason the mark exists. 'Nobody Probe' is not this person's surname.
    await manualForm(app, 'Zzz Nobody Probe');

    assert.equal(fieldByLabel(app, 'First name').value, 'Zzz Nobody');
    assert.equal(fieldByLabel(app, 'Last name').value, 'Probe');

    const t = app.text();
    // THE RENDERER. `nameGuessed` has travelled on every document this estate
    // scans since the producer was split, and until this change NOTHING drew
    // it anywhere — a flag with no renderer is not a safeguard, it is a field
    // in an object.
    assert.ok(app.document.querySelector('[data-hw="name-split-guess"]'),
      'the guessed split is presented with no mark at all, which is an inference rendered as a ' +
      'measurement — the exact defect this file exists to stop');
    assert.match(t, /is a GUESS|are a GUESS/,
      'the mark must say the word: a subtle tint is not a warning');
    assert.match(t, /Compound surnames|Van Der Berg|words/,
      'the mark must NAME the failure mode. A flag with no reason beside it gets dismissed and ' +
      'the operator never learns what to check');
    // THE LABEL IS A LEGAL CLAIM. A guessed surname wearing "· from ID" would
    // say a government document named something it never contained.
    assert.match(t, /First name · GUESSED/, 'the guessed first name is not marked on its own label');
    assert.match(t, /Last name · GUESSED/, 'the guessed last name is not marked on its own label');
    assert.doesNotMatch(t, /First name · from ID|Last name · from ID/,
      'there is no document on this path at all — claiming "from ID" here would be inventing a ' +
      'provenance for a value the operator typed and we then cut in half');
  });
});

test('correcting a guessed half withdraws the mark from THAT half and no other', async () => {
  await withApp('pos', async (app) => {
    await manualForm(app, 'Zzz Nobody Probe');
    setValue(app, fieldByLabel(app, 'Last name'), 'Van Der Berg');
    await app.settle();

    const t = app.text();
    assert.doesNotMatch(t, /Last name · GUESSED/,
      'the operator has just typed this value, so it is theirs and no longer our inference');
    assert.match(t, /First name · GUESSED/,
      'correcting one half says NOTHING about the other. Clearing both marks on a single edit ' +
      'would silently certify a field nobody has looked at');
    // The note narrows rather than vanishing, so it keeps naming what is left.
    assert.match(t, /first name is a GUESS/,
      'the note must name the half that is still unchecked, not disappear on the first keystroke');

    setValue(app, fieldByLabel(app, 'First name'), 'Mary Jo');
    await app.settle();
    assert.equal(app.document.querySelector('[data-hw="name-split-guess"]'), null,
      'with both halves corrected there is no guess left to warn about — a warning that never ' +
      'clears is a warning that gets ignored, and then it means nothing on the hard name');
  });
});

test('an EMPTY manual form is an absence and is not flagged', async () => {
  await withApp('pos', async (app) => {
    // No query typed at all. Reached through the guest editor's own manual
    // path, which seeds nothing.
    await app.mount('MembersScreen');
    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.type('by name, e-mail or phone', '   '), 'no manual search field');
    await app.settle();
    // A whitespace-only query matches everybody, so reach the form the other
    // way: a query with no match, then clear the boxes it seeded.
    assert.ok(app.type('by name, e-mail or phone', 'Zzzq'), 'no manual search field');
    await app.settle();
    app.click('Enter manually');
    await app.settle();
    setValue(app, fieldByLabel(app, 'First name'), '');
    await app.settle();
    setValue(app, fieldByLabel(app, 'Last name'), '');
    await app.settle();
    assert.equal(app.document.querySelector('[data-hw="name-split-guess"]'), null,
      'an empty field is an ABSENCE, not a guess. Hanging a warning on every untouched box is ' +
      'how operators learn to ignore the warning that matters');
  });
});

test('the buyer is created from the SPLIT pair, with the joined name derived from it', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const before = HW.MEMBERS.length;
    await app.mount('MembersScreen');
    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'the modal must lead with the scanner');
    await new Promise((r) => setTimeout(r, 900));
    await app.settle();

    setValue(app, fieldByLabel(app, 'First name'), 'Ng');
    await app.settle();
    // A MONONYM. Its last name stays empty — never a copy of the first, which
    // would mint a name_dob_fp for a surname we do not have and collide with
    // everyone genuinely carrying 'Ng' as one.
    setValue(app, fieldByLabel(app, 'Last name'), '');
    await app.settle();

    const create = [...app.document.querySelectorAll('button')]
      .find((b) => (b.textContent || '').trim() === 'Create customer');
    assert.equal(create.disabled, false,
      'a first name and a document is the bar. Demanding a surname makes the operator INVENT ' +
      'one to get past the button, which is the dirty data this ruling is about — and the ' +
      'server already says so, returning None from name_dob_fp rather than a wrong fingerprint');
    app.click('Create customer');
    await app.settle();
    assert.ok(app.click('Check in'), 'no Check in button');
    await app.settle();

    assert.equal(HW.MEMBERS.length, before + 1, 'the check-in created no customer');
    // addMember unshifts, so the new record is at the FRONT of the book.
    const m = HW.MEMBERS.find((x) => x.name === 'Ng');
    assert.ok(m, 'the created customer is not in the book under its derived joined name');
    assert.equal(m.first_name, 'Ng', 'the record does not carry a dedicated first name');
    assert.equal(m.last_name, '',
      "a mononym's surname is EMPTY on the record too — no fingerprint beats a wrong one");
    // WHAT THIS PROVES AND WHAT IT DOES NOT, stated rather than implied.
    // It pins that the stored joined string AGREES with the stored pair — the
    // drift check, which is what matters once both sit on one record. It does
    // NOT prove the join drops an empty half rather than leaving a trailing
    // space: addMember trims `name`, so a naive `first + ' ' + last` survives
    // this line. Mutation-tested 2026-08-27, and it survived — which is why
    // this says so instead of taking the credit. The trailing-space property is
    // pinned where it can be: the `N.join('Ng', '')` assertion above.
    assert.equal(m.name, app.window.HWName.join(m.first_name, m.last_name),
      'the joined `name` on the record must agree with the split pair beside it. It is a ' +
      'display convenience derived from them, and two stored copies of one fact drift apart — ' +
      'at which point nothing on screen tells you which one the fingerprint used');
    assert.equal(m.name, 'Ng', 'the derived display name is wrong for a mononym');
  });
});

test('the scanned address fills the split fields, and the state is the document’s own', async () => {
  await withApp('pos', async (app) => {
    await app.mount('MembersScreen');
    assert.ok(app.click('New check-in'), 'no New check-in tile');
    await app.settle();
    assert.ok(app.click('Scan ID'), 'the modal must lead with the scanner');
    await new Promise((r) => setTimeout(r, 900));
    await app.settle();

    const st = byPlaceholder(app, 'State');
    const num = byPlaceholder(app, 'Street no.');
    const name = byPlaceholder(app, 'Street name');
    assert.ok(st && num && name, 'the scanned form has no split address fields');
    // The first read of a session is Marcus Webb — 1180 Grand Ave, Corona CA.
    // Asserting the VALUES, not merely that something arrived: an address that
    // prefilled from nothing would pass a presence check.
    assert.equal(num.value, '1180',
      'the house number was dropped — the scanner emits `streetNumber` as its own element and ' +
      'this form used to read only the joined `street`, so the operator retyped what the ' +
      'barcode had already handed over');
    assert.equal(name.value, 'Grand Ave', 'the street name did not arrive split');
    assert.equal(byPlaceholder(app, 'City').value, 'Corona');
    assert.equal(st.value, 'CA',
      'the state must come FROM THE DOCUMENT. It reads CA here because this licence is ' +
      'Californian — not because the form assumed it');
    assert.equal(byPlaceholder(app, 'ZIP').value, '92879');
  });
});

test('a document carrying ONLY a joined name is split, MARKED, and does not dead-end the counter', async () => {
  await withApp('pos', async (app) => {
    // The producer this estate has not migrated yet — and the real PDF417
    // reader on the day it lands. Driven through the scanner seam with a stub,
    // because the simulator only ever emits already-split documents and this
    // path would otherwise never run.
    app.window.HW.MEMBERS = [];
    const R = app.window.React;
    const doc = { type: 'CA DL', num: '••••4821', expires: '2032-05-30', scannedAt: 'Just now',
      by: 'Manisha Saini', photo: true, name: 'Mary Jo Van Der Berg', dob: '04/02/1988',
      returning: false, lookup: 'ok', simulated: true };
    app.window.IdScanPanel = function StubScan({ onChange }) {
      return R.createElement('button', { onClick: () => onChange(doc) }, 'STUB SCAN');
    };
    app.window.__CheckInProbe = () =>
      R.createElement(app.window.CheckInModal, { onClose() {}, onCheckIn() {} });
    await app.mount('__CheckInProbe');
    assert.ok(app.click('STUB SCAN'), 'the stub scanner was never rendered');
    await app.settle();

    // THE DEFECT THIS PINS: reading `d.firstName` and stopping left the first
    // name EMPTY, and the form then refused to create the customer at all — a
    // person at the counter holding a valid ID, blocked by a field mapping.
    assert.equal(fieldByLabel(app, 'First name').value, 'Mary Jo Van Der');
    assert.equal(fieldByLabel(app, 'Last name').value, 'Berg');
    const create = [...app.document.querySelectorAll('button')]
      .find((b) => (b.textContent || '').trim() === 'Create customer');
    assert.equal(create.disabled, false,
      'a document that carries a name in the old shape must not dead-end the check-in — ' +
      'splitting it is the one job splitGuess exists for');

    const t = app.text();
    assert.match(t, /is a GUESS|are a GUESS/,
      'the split is OURS here, not the document’s, and it has to say so');
    assert.doesNotMatch(t, /First name · from ID|Last name · from ID/,
      'the barcode named neither half. "· from ID" on a value we cut out of a joined string ' +
      'would be claiming a government document said something it never said — and the ' +
      'joined-name shape is exactly where that claim is most tempting and least true');
  });
});
