// ── Check-in flow — guests are captured AT CHECK-IN (the start of the visit) ─
// Addresses: add-guest belongs to the check-in step, not mid-sale; check-in
// list + add-guest-to-existing-check-in. GuestEditor is reused everywhere.
const useP = window.useP;

// ── Party & guests ──────────────────────────────────────────────────────────
// COMPLIANCE: every person in a party is a customer record. Not a headcount,
// not a free-text name. Anyone who walks in with a buyer is either linked to an
// existing customer or onboarded through the new-customer flow (name, DOB, and
// a scanned + photographed ID) before the check-in can be completed.
//
// Guests are still tracked as REFERRALS for attribution — the sale stays on the
// primary — but they exist as real, verifiable people in the ledger.
const gName = (g) => typeof g === 'string' ? g : g && g.name || '';
const gKey = (g, i) => (typeof g === 'string' ? g : g && (g.id || g.key || g.name) || 'g') + ':' + i;
const normGuest = (g) => typeof g === 'string' ?
{ key: 'legacy-' + g, id: null, name: g, dob: '', phone: '', member: false, doc: null } : g;
// ── FOUR guest states, because there are four different facts ───────────────
// This was `g.id ? 'linked' : g.doc ? 'captured' : 'incomplete'`, which made
// "this person has an account" satisfy a check that is about a DOCUMENT. It
// paired with linkMember() manufacturing `doc: { onFile: true }` for every
// member pulled out of the search box, so linking Joseph Levi (m5 — doc: null,
// "Never walked in, no document anyone has held") produced a green "Existing
// customer" tick and cleared a gate whose own banner says "A name on its own is
// not enough." A name on its own was exactly what cleared it.
//
//   captured       we hold a document scanned in this session
//   linked         an existing record whose verification is real (T1+)
//   linked-no-doc  an existing record that NOBODY has ever verified. Amber, and
//                  it BLOCKS — this is the state that did not exist before.
//   incomplete     no record and no document
const guestStatus = (g) =>
g.doc ? g.id ? 'linked' : 'captured' : g.id ? 'linked-no-doc' : 'incomplete';
// Blocking states. `guestIncomplete` keeps its name (screen-register.jsx:789
// calls it) but now counts every guest who cannot lawfully be checked in, not
// only the ones with no record at all.
const guestBlocks = (g) => {const s = guestStatus(g);return s === 'incomplete' || s === 'linked-no-doc';};
window.guestName = gName;
window.guestIncomplete = (list) => (list || []).map(normGuest).filter(guestBlocks).length;

// The REAL verification on a member record, or null. Never a fabricated
// `{ onFile: true }`. A remote ID pass counts exactly like a counter scan
// (verification.jsx says so at the top of the file), which is why this asks
// HWV.assurance for the tier rather than only looking for `doc`.
function docOnFileFor(id) {
  if (!id) return null;
  const rec = (window.HW && window.HW.IDV || {})[id] || null;
  const a = window.HWV ? window.HWV.assurance(rec) : { tier: 0 };
  // This DOES now include an expired document: assurance() derives `expired`
  // from doc.expires against today (verification.jsx isExpiredDoc) instead of a
  // `doc.expired` boolean nothing in the estate ever set. The comment used to
  // assert a check that did not exist, which is how the next reviewer stops
  // looking.
  if (a.tier < 1) return null;                 // includes an EXPIRED document
  const doc = rec && rec.doc;
  if (doc && doc.scannedAt) {
    return Object.assign({}, doc, { onFile: true,
      how: doc.where === 'door' ? 'door' : 'in-store', when: doc.scannedAt });
  }
  const rid = rec && (rec.remoteId || rec.persona);
  return { onFile: true, how: 'remote', when: rid && rid.at || null };
}
// One sentence naming WHICH verification, so "ID on file" is checkable rather
// than a tick. Returns null when there is nothing to name.
// THE NAME ON THE DOCUMENT IS THE FIELD THAT EXPOSES A MISMATCH, and it was
// the one field this sentence dropped. "ID scanned Just now by Manisha Saini"
// is true of a document belonging to somebody else entirely.
function docLine(doc) {
  if (!doc) return null;
  const who = doc.name ? ' · ' + doc.name : '';
  if (doc.how === 'remote') return 'Remote ID check passed' + (doc.when ? ' ' + doc.when : '') + who;
  if (doc.how === 'door') return 'ID scanned at the door' + (doc.when ? ' · ' + doc.when : '') + who;
  if (doc.scannedAt) return 'ID scanned ' + doc.scannedAt + (doc.by ? ' by ' + doc.by : '') + who;
  return 'ID captured this visit' + who;
}
// Two names are the same person for THIS purpose only when they are the same
// letters. Deliberately strict: the point is to surface a mismatch for a human
// to resolve, not to decide identity.
function sameName(a, b) {
  const n = (x) => String(x || '').toLowerCase().replace(/[^a-z]+/g, '');
  return !!n(a) && n(a) === n(b);
}
function docIsExpired(doc) {
  return !!(doc && window.HWExpiry && window.HWExpiry.isExpiredDoc(doc));
}
// ── THE OWNER'S EXPIRY SWITCH, ON THIS SCREEN ───────────────────────────────
// [OWNER RULING 2026-08-27] Document-expiry enforcement is a TOGGLE, default
// OFF. This file did not know the switch existed: docIsExpired() hard-blocked
// Create and Check-in, so with enforcement OFF the gate allowed the customer
// and the counter screen refused them anyway. The toggle did not toggle.
//
// DETECTION IS UNCONDITIONAL AND STAYS THAT WAY. docIsExpired() above reads a
// date and nothing else, and every screen below names the lapse, dates it and
// paints it in the alarm tone in ALL THREE switch positions. What the switch
// governs is whether that lapse BLOCKS. Wiring it the other way round — showing
// the expiry only when enforcement is on — would hide a real lapse from the
// associate, which is a worse failure than the one being fixed here.
//
// THREE STATES, NOT TWO. window.HWV.expiryEnforced() returns true / false /
// null, read in specificity order with a strict boolean test at each rung, and
// `null` is NOT `false`: it means nothing published the switch. This screen
// then refuses on the STRICT reading and says that is what happened, rather
// than claiming a policy nobody set. Only an explicit, published `false`
// allows. HWV missing entirely lands on null too — fail-closed by the same
// rule, not by accident.
function expirySwitch(rec) {
  return window.HWV ? window.HWV.expiryEnforced(rec || null) : null;
}
// Does a detected lapse actually stop this person today? Detection AND the
// switch, never one without the other.
function expiryBlocks(doc, rec) {
  return docIsExpired(doc) && expirySwitch(rec) !== false;
}

// ── ONE FIELD PER CUSTOMER PARAMETER, ON THE CHECK-IN SURFACE ───────────────
// [OWNER RULING 2026-08-27] "each customer parameter needs a dedicated input
//  field, we cannot have dirty data — first name / last name / street number +
//  street name / city / state / zip — everything needs to have its own separate
//  field. fix it system-wide"
//
// THIS FILE WAS THE SCREENSHOT. One "FULL NAME" box, one "Street address" box,
// and a `state: 'CA'` sitting in the initial state where a captured value
// belongs. Each of those is a joined or assumed value the client then has to
// take APART again before it can talk to the server — and the server has never
// spoken joined: wmdemo/server.py:4843 accepts `first_name`/`last_name` and has
// no joined `name` key on any create path, and identity_match.py:176 returns
// None from name_dob_fp unless first, last and DOB are all present separately.
// The box was never the wire format. It was a lossy local detour whose reversal
// is a GUESS, and that guess decides whether two records are the same person.
// This estate already has one Weedmaps customer id sitting on four live
// identities with 458 orders between them.
//
// AND THE SCANNER HAD ALREADY BEEN FIXED. Every document IdScanPanel emits
// carries `firstName`, `lastName`, `nameGuessed`, `nameGuessNote` and a SPLIT
// `address` — and this form read `d.name` and `d.dob` and threw the rest away,
// re-deriving by guesswork a split it was being handed for free.
//
// `nameGuessed` had NO RENDERER ANYWHERE in the estate until this change. A
// flag nobody draws is not a safeguard, it is a field in an object.
// NameSplitNote below is the renderer that turns it into one.
const nfJoin = (first, last) => window.HWName ? window.HWName.join(first, last) :
[String(first || '').trim(), String(last || '').trim()].filter(Boolean).join(' ');
const nfJoinStreet = (n, s) => window.HWAddress ? window.HWAddress.joinStreet(n, s) :
[String(n || '').trim(), String(s || '').trim()].filter(Boolean).join(' ');
// A joined legacy string — a search query, a name off the waiting-room list —
// split for prefill. Always marked, because the split is ours. An EMPTY seed is
// an ABSENCE and is not marked: warning on a field nobody has filled in is how
// operators learn to ignore the warning that matters.
const nfSplitGuess = (s) => window.HWName ? window.HWName.splitGuess(s) :
{ first: String(s || '').trim(), last: '', guessed: false, note: '' };

// WHAT A DOCUMENT SAYS THIS PERSON IS CALLED, in the split the form needs.
//
// THREE PRODUCERS, THREE PROVENANCES, AND THE THIRD ONE NEARLY DEAD-ENDED THE
// COUNTER. IdScanPanel emits `firstName`/`lastName` today, and a book match
// emits them with `nameGuessed` set because it split a joined string to get
// them. But a document carrying ONLY a joined `name` still exists — a producer
// nobody has migrated, and the real PDF417 reader when it lands. Reading
// `d.firstName` and stopping meant such a document produced an EMPTY first
// name, and the form then refused to create the customer at all: a person
// standing at the counter holding a valid ID, blocked by a field mapping.
//
// So the joined string is split — as a GUESS, marked and editable, which is the
// one job splitGuess exists for. Same idiom as pos/verification.jsx:807, which
// prefers a real pair and falls back to splitting only when there is none.
// Caught by test/checkin-expiry-toggle.test.mjs, whose stub document carries
// exactly this shape; it is a defect in this file, not in the fixture.
const docName = (d) => {
  if (!d) return { first: '', last: '', guessed: false, note: '' };
  if (d.firstName || d.lastName) {
    return { first: d.firstName || '', last: d.lastName || '',
      guessed: !!d.nameGuessed, note: d.nameGuessNote || '' };
  }
  if (!d.name) return { first: '', last: '', guessed: false, note: '' };
  const g = nfSplitGuess(d.name);
  return { first: g.first, last: g.last, guessed: !!g.guessed, note: g.note || '' };
};

// The three things a name box can be, and they are NOT the same claim:
//   · from ID   the barcode carried this field. A legal claim about provenance.
//   · GUESSED   we split a joined string to get it. Ours, not the document's.
//   · bare      a human typed it.
// A guessed half must never wear "· from ID" — that would be claiming a
// government document said something it never said, which is the exact defect
// this workstream has spent the day removing everywhere else.
function nameFieldLabel(base, guessed, fromScan) {
  return guessed ? base + ' · GUESSED' : fromScan ? base + ' · from ID' : base;
}

// ── THE GUESS, RENDERED ─────────────────────────────────────────────────────
// Shown ONLY while a half is still carrying the mark. Editing a box withdraws
// the mark from THAT box and no other (setNf1), so this names which half is
// still unchecked instead of hanging a permanent warning over a form the
// operator has already corrected. A warning that never clears is a warning that
// gets ignored — and then the one on the hard name means nothing.
function NameSplitNote({ guessed, note }) {
  const P = useP();
  const still = [guessed && guessed.firstName && 'first name',
  guessed && guessed.lastName && 'last name'].filter(Boolean);
  if (!still.length) return null;
  const many = still.length > 1;
  return (
    <div data-hw="name-split-guess" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
      <Icon name="alert" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
        {/* splitGuess's own note already ends by telling the operator to check
             the value against the document, so this closes on the ACT instead
             of repeating the instruction. Read on screen the two together said
             "Check it against the document. Check them against the ID and
             correct them…", and a warning nobody finishes reading is a warning
             that does not work. Caught by looking at it rendered — jsdom
             answers "is it wired", never "does it read". */}
        <b>The {still.join(' and ')} {many ? 'are a GUESS' : 'is a GUESS'} — not something the document said.</b>{note ? ' ' + note : ''} Correct {many ? 'them' : 'it'} here before the record is created.
      </span>
    </div>);

}

window.GuestEditor = function GuestEditor({ primaryName, guests, onChange }) {
  const P = useP();
  const list = (guests || []).map(normGuest);
  const [q, setQ] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  // ONE FIELD PER PARAMETER. `name` is gone; first and last are captured
  // separately, and the joined value is DERIVED at commit for the surfaces that
  // only ever display one. Two stored copies of one fact is how they drift.
  const BLANK_NF = { firstName: '', lastName: '', dob: '', phone: '', doc: null,
    fromScan: {}, guessed: {}, guessNote: '' };
  const [nf, setNf] = React.useState(BLANK_NF);
  // Editing a field withdraws BOTH marks from that field and no other. Both are
  // claims about where the value came from, and a human typing over it retires
  // each of them: it is no longer the document's, and it is no longer our guess.
  const setNf1 = (k, v) => setNf((p) => ({ ...p, [k]: v,
    fromScan: Object.assign({}, p.fromScan, { [k]: false }),
    guessed: Object.assign({}, p.guessed, { [k]: false }) }));
  // WHAT THE DOCUMENT ACTUALLY CARRIES, taken instead of re-derived. `d.name`
  // is the scanner's own derived convenience and is deliberately NOT read here:
  // reading it would put the split back where it was, in this file, as a guess.
  const docFields = (d) => {
    // A book-matched document carries a name we split ourselves (the customer
    // book stores a joined string and nothing else), so it arrives flagged. A
    // document READ has nothing to guess and must not cry wolf.
    const n = docName(d);
    return {
      doc: d || null,
      firstName: n.first, lastName: n.last,
      dob: d && d.dob || '',
      guessed: { firstName: !!n.guessed && !!n.first, lastName: !!n.guessed && !!n.last },
      guessNote: n.note,
      // A guessed half is NOT "from ID". The suffix is a legal claim.
      fromScan: { firstName: !!n.first && !n.guessed,
        lastName: !!n.last && !n.guessed, dob: !!(d && d.dob) }
    };
  };

  const taken = (n) => list.some((g) => gName(g).toLowerCase() === n.toLowerCase()) || n === primaryName;
  const push = (g) => onChange([...list, g]);
  const removeAt = (i) => onChange(list.filter((_, idx) => idx !== i));

  // Existing customers + people already waiting (they are customers too)
  const ql = q.trim().toLowerCase();
  const matches = ql ? window.HW.MEMBERS.filter((m) => !taken(m.name) && (m.name + m.email + m.phone).toLowerCase().includes(ql)).slice(0, 4) : [];
  const poolNames = window.HW.GUEST_POOL.filter((n) => !taken(n));

  // `doc: { onFile: true }` used to be written here unconditionally — a
  // fabricated compliance fact for every member the search box returned. It
  // reads the ledger now, and a member nobody has verified arrives as
  // linked-no-doc, which does not clear the gate.
  // The linked guest carries whatever split the BOOK holds and does not
  // manufacture one it does not: a legacy row with only a joined `name` stays
  // that way here rather than being carved up on the way into the party.
  const linkMember = (m) => {push({ key: m.id, id: m.id, name: m.name, first_name: m.first_name || '', last_name: m.last_name || '', dob: '', phone: m.phone, member: m.member, doc: docOnFileFor(m.id) });setQ('');};
  // THE SEED IS NOT CARRIED, AND IT NEVER WAS. `startNew` used to write the
  // typed query into `nf.name`, and no operator ever saw it: the name fields
  // below render only once a document exists, and the scan overwrites them the
  // moment it does. Prefilling a GUESSED split into boxes that cannot be seen
  // and will be overwritten is the "flag nobody displays" defect in a second
  // costume — a guess is only worth making where a human can check it, and here
  // the barcode answers the question outright a second later.
  const startNew = () => {setNf(BLANK_NF);setAdding(true);setQ('');};
  const commitNew = () => {
    if (!nf.doc) return;
    const firstName = nf.firstName.trim(), lastName = nf.lastName.trim();
    // `first_name`/`last_name` — the key names the store and the server both
    // use, so a guest promoted to a customer record keeps its split.
    push({ key: 'new-' + Date.now(), id: null, first_name: firstName, last_name: lastName,
      // DERIVED, for the many surfaces that only ever display a name (the party
      // row, the avatar, `taken`). The split pair is what was captured and what
      // the server's only name keys want.
      name: nfJoin(firstName, lastName),
      dob: nf.dob, phone: nf.phone, member: false, doc: nf.doc });
    setNf(BLANK_NF);setAdding(false);
  };
  // Scanning the ID IS the data entry — the PDF417 barcode carries the legal
  // name, DOB and expiry, so nobody retypes them. Phone is the only thing a
  // human might add, and it is optional.
  // THE SCAN IS THE SOURCE OF TRUTH, and the two outcomes are different acts.
  //
  // A RETURNING guest's barcode resolves to a customer we already hold, so it
  // LINKS them straight into the party — no onboarding form, no second record.
  // That is the whole point of scanning a returning customer, and it is the
  // path that stops one human accumulating four profiles.
  //
  // A FIRST-TIMER's document fills the form and nothing else does. The old
  // version fell back to `p.name` and then to a hardcoded 'Jordan A. Vasquez' /
  // '09/02/1988' when the read produced no name — so a scan that failed to
  // parse silently inherited whatever name was already in the box, or an
  // invented one, and still rendered a green "ID captured" pill. A fabricated
  // identity under a compliance tick is the one thing this flow must never do.
  // A read with no name now writes no name, and the form stays blocked.
  //
  // AND THE THIRD BRANCH: the barcode said RETURNING and named a member id we
  // cannot resolve. That is not "this person is new" — it is "we matched to a
  // record this device cannot load", and letting it fall through to the
  // first-timer prefill turns an UNKNOWN into an ANSWER. The operator, told by
  // the copy that "no match starts a new one", reads the pre-filled form as
  // proof of no match and creates the second profile this flow exists to
  // prevent.
  const [unresolved, setUnresolved] = React.useState(null);
  // A document scanned against an ALREADY-SELECTED customer whose name (or
  // member id) it does not match. See onPrimaryScan.
  const [docMismatch, setDocMismatch] = React.useState(null); // { memberId, doc }
  const onScan = (d) => {
    setUnresolved(null);
    if (d && d.returning && d.memberId) {
      const m = window.HW.memberById(d.memberId);
      if (m) { linkMember(m); setAdding(false); setNf(BLANK_NF); return; }
      setUnresolved({ memberId: d.memberId, doc: d });
      setNf(BLANK_NF);
      return;
    }
    setNf((p) => Object.assign({}, p, docFields(d)));
  };
  // Create the record anyway — an explicit choice, never a default.
  const forceNewFromUnresolved = () => {
    const d = unresolved && unresolved.doc;
    setUnresolved(null);
    setNf(Object.assign({}, BLANK_NF, docFields(d)));
  };
  const bad = list.filter(guestBlocks).length;
  const noDoc = list.filter((g) => guestStatus(g) === 'linked-no-doc').length;

  const StatusPill = ({ g }) => {
    const s = guestStatus(g);
    if (s === 'linked') return <Pill kind="good" dot>ID on file</Pill>;
    if (s === 'captured') return <Pill kind="good" dot>ID captured</Pill>;
    // Existing record, no verification anybody has ever performed. It is NOT a
    // green tick and it does NOT clear the gate.
    if (s === 'linked-no-doc') return <Pill kind="warn" dot>No ID on file</Pill>;
    return <Pill kind="bad" dot>Needs ID</Pill>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Eyebrow>Party &amp; guests</Eyebrow>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{list.length} guest{list.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.infoSoft, borderRadius: P.r10, marginBottom: 11 }}>
        <Icon name="shield" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Everyone in the party is recorded as a customer — link them if they already exist, or onboard them here. <b>A name on its own is not enough.</b></span>
      </div>

      {/* Add: search existing, or start the new-customer flow */}
      {!adding && <>
        <div style={{ display: 'flex', gap: 8, marginBottom: matches.length || poolNames.length ? 9 : 11 }}>
          <Field icon="search" placeholder="Search guest by name, e-mail or phone" value={q} onChange={(e) => setQ(e.target.value)} size="sm" />
          <PBtn variant="soft" size="sm" icon="user-plus" onClick={() => startNew()}>New guest</PBtn>
        </div>
        {matches.length > 0 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
            {matches.map((m) =>
          <button key={m.id} type="button" onClick={() => linkMember(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                <Avatar name={m.name} size={26} crown={m.member} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink }}>{m.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.type}</span>
                </span>
                <Pill kind="ghost" icon="link">Link</Pill>
              </button>)}
          </div>}
        {ql && matches.length === 0 &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, marginBottom: 10 }}>
            <Icon name="user-plus" size={15} color={P.ink2} />
            <span style={{ flex: 1, fontSize: 11.5, color: P.ink2 }}>No customer called “{q.trim()}” — onboard them as new.</span>
            <PBtn variant="accent" size="xs" onClick={() => startNew()}>Start</PBtn>
          </div>}
        {!ql && poolNames.length > 0 &&
        <div style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Already in the waiting room</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {poolNames.map((n) => {
              const m = window.HW.MEMBERS.find((x) => x.name === n);
              return <button key={n} type="button" onClick={() => m ? linkMember(m) : startNew()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, fontSize: 12.5, fontWeight: 600, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
                  <Icon name="plus" size={12} stroke={2.2} />{n}{!m && <span style={{ fontSize: 10, color: P.warn, fontWeight: 700 }}>new</span>}
                </button>;})}
            </div>
          </div>}
      </>}

      {/* New-guest onboarding — same bar as any other customer */}
      {adding &&
      <div style={{ border: `1px solid ${P.accentBorder}`, borderRadius: P.r12, background: P.surface2, padding: 13, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="user-plus" size={14} stroke={1.9} color={P.ink2} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>New guest — onboarding</span>
            <span style={{ marginLeft: 'auto' }}><IconBtn icon="x" size={14} style={{ width: 26, height: 26 }} onClick={() => setAdding(false)} /></span>
          </div>
          {/* NO PHOTO STRIP HERE YET, AND THAT IS DELIBERATE RATHER THAN
              MISSED. This is the party's guest onboarding, a different form
              with its own `nf`; the control it would adopt is the shared
              window.IdPhotoCapture used by the check-in New-customer form
              below (search this file for HWIdPhotos.docKeyOf). Adopting it is
              three lines — a list on BLANK_NF, the component, and the key on
              whatever this guest is committed as — and it is the aligning
              pass's, so this file is not being edited from two directions at
              once. It is NOT a second implementation. */}
          <div><CILabel>Government ID — scan to fill</CILabel>
            {window.IdScanPanel ? <window.IdScanPanel value={nf.doc} onChange={onScan} /> :
          <PBtn variant="accent" size="sm" icon="scan" onClick={() => onScan({ scannedAt: 'Just now', photo: true })}>Scan ID</PBtn>}
          </div>
          {/* THE REFUSAL. A returning barcode naming a member id we cannot load
              is neither a match nor a miss, and it may not quietly become the
              new-customer form. */}
          {unresolved &&
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>The scan matched <b style={{ fontFamily: P.fontMono }}>customer {unresolved.memberId}</b>, and this device cannot load that record. <b>This is not a new customer</b> — creating one here would give the same person a second profile.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PBtn variant="accent" size="xs" icon="refresh" onClick={() => setUnresolved(null)}>Scan again</PBtn>
              <div style={{ flex: 1 }} />
              <PBtn variant="ghost" size="xs" onClick={forceNewFromUnresolved}>Create a new record anyway</PBtn>
            </div>
          </div>}
          {nf.doc ? <>
            {/* FIRST AND LAST, SEPARATELY — and the label tells the truth about
                each half on its own, because a scan can deliver one of them
                read and the other guessed. The old single box was labelled
                "Full name · from ID" unconditionally, so a value a colleague
                typed over the top still claimed the document said it. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <CIField label={nameFieldLabel('First name', nf.guessed.firstName, nf.fromScan.firstName)} value={nf.firstName} onChange={(v) => setNf1('firstName', v)} />
              <CIField label={nameFieldLabel('Last name', nf.guessed.lastName, nf.fromScan.lastName)} value={nf.lastName} onChange={(v) => setNf1('lastName', v)} />
            </div>
            <NameSplitNote guessed={nf.guessed} note={nf.guessNote} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <CIField label={nameFieldLabel('Date of birth', false, nf.fromScan.dob)} value={nf.dob} onChange={(v) => setNf1('dob', v)} placeholder="MM/DD/YYYY" mono />
              <CIField label="Phone (optional)" value={nf.phone} onChange={(v) => setNf1('phone', v)} placeholder="(000) 000-0000" mono />
            </div>
          </> : unresolved ? null :
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="scan" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Scan the ID and the name, date of birth and expiry fill themselves from the barcode. <b>Phone is the only thing you may need to add — and it is optional.</b></span>
          </div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.4, flex: 1 }}>Adding a phone lets them order delivery later without ever verifying again.</span>
            <PBtn variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancel</PBtn>
            <PBtn variant="accent" size="sm" icon="check" disabled={!nf.doc} onClick={commitNew}>Add to party</PBtn>
          </div>
        </div>}

      {/* The party */}
      {list.length > 0 &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((g, i) =>
        <div key={gKey(g, i)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', background: P.surface2, border: `1px solid ${guestStatus(g) === 'incomplete' ? P.bad : guestStatus(g) === 'linked-no-doc' ? P.warn : P.hairline}`, borderRadius: P.r10 }}>
              <Avatar name={gName(g)} size={26} crown={g.member} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gName(g)}</span>
                {/* NAME THE VERIFICATION, do not tick a box. "Existing
                    customer" said nothing about whether anyone had held a
                    document; this says which scan and when, or says there is
                    none. */}
                <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{
                  guestStatus(g) === 'linked-no-doc' ? 'Existing customer · no ID anyone has held' :
                  docLine(g.doc) || (g.dob ? 'DOB ' + g.dob : 'No details captured')
                }{g.phone ? ' · ' + g.phone : ''}</span>
              </span>
              <StatusPill g={g} />
              <Pill kind="ghost" icon="link">referral</Pill>
              <IconBtn icon="x" size={12} style={{ width: 24, height: 24 }} onClick={() => removeAt(i)} />
            </div>
        )}
        </div>}

      {bad > 0 &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, padding: '9px 11px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
          <Icon name="shield" size={14} color={P.bad} />
          {/* Two different reasons, said separately. "Not in our book" and
              "in our book but nobody has ever seen their ID" need different
              actions from the operator. */}
          <span style={{ fontSize: 11.5, color: P.ink2 }}><b>{bad} guest{bad > 1 ? 's' : ''} cannot be checked in yet.</b>{noDoc > 0 ? ` ${noDoc} ${noDoc > 1 ? 'are' : 'is'} an existing customer with no ID on file — scan the document. ` : ' '}Check-in is blocked until every person has one.</span>
        </div>}
      {list.length > 0 && primaryName && bad === 0 &&
      <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 9, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="info" size={12} color={P.inkMute} />Sale stays on <b style={{ color: P.ink2 }}>{primaryName.split(' ')[0]}</b> · {list.length} guest{list.length > 1 ? 's' : ''} on record, tracked as referrals
        </div>}
    </div>);

};

// New check-in flow. Captures primary customer + party at the start of the visit.
function CILabel({ children }) {
  const P = useP();
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>{children}</div>;
}
function CIField({ label, value, onChange, placeholder, mono }) {
  const P = useP();
  return (
    <div>
      {label && <CILabel>{label}</CILabel>}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '8px 11px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r8, background: P.field, color: P.ink, fontSize: 12.5, fontFamily: mono ? P.fontMono : P.fontSans, outline: 'none', boxSizing: 'border-box' }} />
    </div>);

}

window.CheckInModal = function CheckInModal({ onClose, onCheckIn, initialCustomer = null }) {
  const P = useP();
  const [customer, setCustomer] = React.useState(initialCustomer);
  const [q, setQ] = React.useState('');
  // THE RECORD ANSWERS THIS, NOT THE OPERATOR.
  // `type` and `delivery` were plain 'AdultUse' / 'Pick-up' constants that
  // nothing ever seeded from the resumed customer, and data.jsx then did
  // `p.type || c.type` — where p.type is ALWAYS a non-empty string, so the `||`
  // never fell through. Scanning a Medicinal patient's ID silently
  // re-designated them Adult Use, with different purchase limits and different
  // tax, behind a default that looks like an answer. `null` now means
  // "unchanged — use the record", and the segment says where its value came
  // from.
  const [type, setType] = React.useState(initialCustomer && initialCustomer.type || null);
  const [typeFrom, setTypeFrom] = React.useState(initialCustomer && initialCustomer.type ? 'record' : null);
  const [delivery, setDelivery] = React.useState(initialCustomer && initialCustomer.delivery || null);
  const [deliveryFrom, setDeliveryFrom] = React.useState(initialCustomer && initialCustomer.delivery ? 'record' : null);
  const [guests, setGuests] = React.useState([]);
  const [newOpen, setNewOpen] = React.useState(false);
  // A returning barcode that names a member id we cannot load. Neither a match
  // nor a miss — see onCheckInScan.
  const [unresolved, setUnresolved] = React.useState(null);
  // A document scanned against an ALREADY-SELECTED customer whose name (or
  // member id) it does not match. See onPrimaryScan.
  const [docMismatch, setDocMismatch] = React.useState(null);
  // ── THE SCREEN ASKED FOR AN ACTION IT DID NOT OFFER ────────────────────────
  // With enforcement OFF a lapsed document is ALLOWED, so `primaryDoc` is
  // truthy and this card took the "document on file" branch — which renders one
  // line of mono text and NO scanner. The soft-lapse banner directly above it
  // says "Ask for a current ID anyway", and there was nowhere on the card to
  // scan one. The only route was the Change button, which throws the selected
  // customer away: not what the sentence points at, and not where the operator
  // is looking.
  //
  // It was already true of every VALID document — the on-file branch has never
  // carried a scanner — which is why it went unnoticed. That case is fine: a
  // current document asks the operator for nothing. The soft lapse is what
  // makes it a defect, because the screen is now actively requesting the one
  // thing it withholds.
  //
  // `false` = the affordance is showing as a button; `true` = the SHARED
  // scanner (window.IdScanPanel, never a copy) is open in its place. Any
  // successful capture closes it again — see onPrimaryScan — so while it is
  // open nothing has been captured yet, and the panel is therefore always
  // handed `value={null}`: it opens ready to READ, rather than on the
  // done-state card of the very document it exists to replace.
  const [rescanOpen, setRescanOpen] = React.useState(false);
  // ONE FIELD PER PARAMETER [OWNER RULING 2026-08-27].
  //
  // `name` was one box and `street` was one box. Both are now the split pair
  // the server actually accepts, and both joined values are DERIVED at create
  // time so no existing consumer has to change and no second copy can drift.
  //
  // `state` STARTED AS 'CA' AND THAT WAS THE SAME DEFECT AS THE HARDCODED 'CA'
  // just removed from customer-extras.jsx, one step earlier in the pipe: there
  // a render line printed Californian for every out-of-state address on file;
  // here the form pre-answered the question, so an operator who never looked at
  // that box STORED California on a Nevada licence. An absence must read as an
  // absence — a blank the operator fills, never a default wearing a captured
  // value's face. Danny Fitzgerald's NV licence is the case that makes it real.
  const BLANK_NF = { firstName: '', lastName: '', phone: '', email: '', dob: '', gender: '',
    streetNumber: '', streetName: '', city: '', state: '', zip: '', doc: null,
    // PHOTOS OF THE PHYSICAL DOCUMENT, held beside the scan rather than inside
    // it. The scanner produces `doc`; a human with a camera produces these, and
    // conflating them would let a re-scan silently destroy a capture a person
    // deliberately made. `[]` is an empty list, never null: "no photos" is a
    // state this form is always in until somebody adds one, and it is not an
    // absence anything has to reason about.
    idPhotos: [],
    fromScan: {}, guessed: {}, guessNote: '' };
  const [nf, setNf] = React.useState(BLANK_NF);
  const setNf1 = (k, v) => setNf((p) => ({ ...p, [k]: v,
    // A field typed over after the scan is no longer "from ID". The suffix is a
    // legal claim about where the value came from, so it has to be withdrawn
    // the moment a human edits it. A GUESS mark is withdrawn the same way and
    // for the same reason — the value is now the operator's, not our inference.
    fromScan: Object.assign({}, p.fromScan, { [k]: false }),
    guessed: Object.assign({}, p.guessed, { [k]: false }) }));
  // Every field a document can fill. Used to withdraw exactly the scan's
  // contribution on a re-scan, and nothing a human typed.
  const SCAN_FIELDS = ['firstName', 'lastName', 'dob', 'streetNumber', 'streetName', 'city', 'state', 'zip'];
  // WHAT THE DOCUMENT CARRIES, FIELD BY FIELD, taken rather than re-derived.
  // The scanner has emitted `firstName`/`lastName`/`nameGuessed`/`address` since
  // the split landed; this form read `d.name` and `d.dob` and dropped the rest,
  // then made the client guess back out a split it was being handed.
  // `d.name` is deliberately not read: it is the scanner's derived display
  // convenience, and reading it would put the guess back in this file.
  const applyDoc = (prev, d) => {
    const a = d && d.address || null;
    // A book match splits a joined string (pos/data.jsx:86 stores nothing else),
    // so it arrives marked; a document READ has nothing to guess; a document
    // carrying only a joined `name` is split here and marked — see docName.
    const n = docName(d);
    const next = Object.assign({}, prev, {
      doc: d || null,
      firstName: n.first || prev.firstName,
      lastName: n.last || prev.lastName,
      dob: d && d.dob || prev.dob,
      guessed: { firstName: !!n.guessed && !!n.first, lastName: !!n.guessed && !!n.last },
      guessNote: n.note,
      fromScan: Object.assign({}, prev.fromScan, {
        // A GUESSED half is not "from ID" — see nameFieldLabel.
        firstName: !!n.first && !n.guessed,
        lastName: !!n.last && !n.guessed,
        dob: !!(d && d.dob) })
    });
    // THE ADDRESS ON THE DOCUMENT, SPLIT, WHICH THIS FORM NEVER READ AT ALL.
    // AAMVA PDF417 carries street, city, jurisdiction and postal code as
    // separate elements and the scanner emits them that way; the operator was
    // retyping all four off a screen that already had them. A passport carries
    // NO address and arrives as `null` — that leaves the fields untouched
    // rather than blanking what somebody typed, because absent is not empty.
    if (a) {
      Object.assign(next, {
        streetNumber: a.streetNumber || prev.streetNumber,
        streetName: a.streetName || prev.streetName,
        city: a.city || prev.city,
        state: a.state || prev.state,
        zip: a.zip || prev.zip });
      next.fromScan = Object.assign({}, next.fromScan, {
        streetNumber: !!a.streetNumber, streetName: !!a.streetName,
        city: !!a.city, state: !!a.state, zip: !!a.zip });
    }
    return next;
  };
  // Seeding a customer is the ONE place type/delivery come from the record.
  const adoptCustomer = (c) => {
    // A NEW PERSON GETS A CLOSED CONTROL. The re-scan disclosure belongs to the
    // record that was on screen when it was opened; carrying it across to the
    // next customer would show a scanner already open over somebody whose
    // document nobody has looked at yet.
    setRescanOpen(false);
    setCustomer(c);
    if (c && c.type) {setType(c.type);setTypeFrom('record');}
    if (c && c.delivery) {setDelivery(c.delivery);setDeliveryFrom('record');}
  };
  // THE SCAN IS THE WAY IN. Everything below it is a fallback.
  //
  // This modal opened on a search box. That is backwards for a dispensary
  // counter: the guest is standing there holding the document, an in-store ID
  // scan happens 100% of the time at every store, and the PDF417 barcode
  // already carries the legal name and date of birth. Typing a name to find
  // someone whose ID you are about to scan anyway is the slow path presented
  // as the main one -- and it captures no verification, so the same person
  // would later be sent through Didit for a delivery they should never be
  // asked to re-verify for.
  //
  // ONE SCAN DOES FOUR THINGS: identifies the guest (name + dob is tier 2 on
  // the identity ladder), captures document-backed verification, fills the new
  // -customer form if there is no match, and decides new-vs-returning without
  // asking the operator a question they cannot answer yet.
  const onCheckInScan = (d) => {
    // Re-scan clears upward (verification.jsx calls onChange(null)), so a null
    // here means "discard the document", not "ignore me". Leaving the previous
    // person's document in nf is how a different name ends up wearing it.
    // RE-SCAN DISCARDS THE DOCUMENT'S CONTRIBUTION — precisely that, and no
    // more. It used to clear `name` and `dob` and reset `fromScan` wholesale,
    // which was close enough while the scan filled only those two. It now fills
    // five address fields as well, so "clear everything the scan touched" and
    // "clear the form" have come apart: the first is required (the previous
    // person's street must not sit under the next person's name), the second
    // would throw away what a human typed. `fromScan` already records which is
    // which, so it is the thing that decides.
    if (!d) {
      setNf((p) => {
        const next = Object.assign({}, p, { doc: null, guessed: {}, guessNote: '' });
        const fs = Object.assign({}, p.fromScan);
        for (const k of SCAN_FIELDS) if (fs[k]) {next[k] = '';fs[k] = false;}
        // A GUESSED half is not in `fromScan` (it is not from the ID), so it
        // would survive a re-scan on that rule alone — and a guess derived from
        // a document that has just been discarded is a guess about nobody.
        for (const k of ['firstName', 'lastName']) if (p.guessed && p.guessed[k]) next[k] = '';
        next.fromScan = fs;
        return next;
      });
      setUnresolved(null);return;
    }
    setUnresolved(null);
    if (d.returning && d.memberId) {
      const m = (window.HW.MEMBERS || []).find((x) => x.id === d.memberId);
      if (m) { adoptCustomer(Object.assign({}, m, { doc: d })); setNewOpen(false); return; }
      // THE THIRD BRANCH. "We matched a returning customer to an id we cannot
      // resolve" is not "this person is new". Falling through to the prefill
      // made an absence and an unknown the same screen, with the default being
      // the one that looks like an answer — and the copy below the scanner
      // promises "no match starts a new one", so the operator reads a filled
      // form as proof of no match and creates the duplicate profile.
      setUnresolved({ memberId: d.memberId, doc: d });
      setNewOpen(false);
      return;
    }
    // No match: this is a new guest, and the barcode has already typed the
    // form for us. Open it PRE-FILLED rather than blank -- re-typing what the
    // scan just read is the waste the scanner exists to remove.
    // Which fields the DOCUMENT filled, and which it only let us guess at.
    // Document-backed, guessed and hand-typed are three different legal claims
    // and must not render as the same grey box.
    setNf((prev) => applyDoc(prev, d));
    setNewOpen(true);
  };
  // The scanner offered INSIDE an already-selected customer's card. What comes
  // back is a document about a PERSON; it only belongs on this record if it is
  // that person's. Compare before binding.
  // IT REPLACES THE DOCUMENT'S CONTRIBUTION AND NOTHING ELSE — which on THIS
  // record is exactly `doc`. The new-customer form has to work harder for the
  // same guarantee (`fromScan` records which boxes the last scan filled, so a
  // re-scan clears those and leaves what a human typed — see onCheckInScan),
  // because a scan there fills eight fields. Here the card displays a record
  // the operator did not type: `Object.assign({}, c, { doc: d })` withdraws the
  // old document and writes the new one, and first_name / last_name / address /
  // dob — whether they came from the book or were typed into createNew — are
  // carried through untouched. Same rule, not a second one.
  const onPrimaryScan = (d) => {
    setDocMismatch(null);
    if (!d) {setCustomer((c) => c ? Object.assign({}, c, { doc: null }) : c);setRescanOpen(false);return;}
    const c = customer;
    if (!c) return;
    const wrongMember = !!(d.memberId && c.id && c.id !== 'new' && d.memberId !== c.id);
    const wrongName = !!(d.name && c.name && !sameName(d.name, c.name));
    // A MISMATCH LEAVES THE RE-SCAN OPEN ON PURPOSE. The document did not land,
    // so the operator is not finished; closing the control here would hide the
    // scanner at the exact moment they have to use it again.
    if (wrongMember || wrongName) {setDocMismatch({ doc: d });return;}
    setCustomer(Object.assign({}, c, { doc: d }));
    // CAPTURED, SO THE CONTROL STANDS DOWN. If the replacement is CURRENT the
    // soft lapse is gone honestly and the whole block unmounts with it. If the
    // replacement is ALSO EXPIRED the block stays — now naming the NEW date —
    // and the affordance is back as a button, because the instruction it serves
    // is still on screen and still unsatisfied. Clearing the lapse is something
    // a current document does; it is never something pressing a button does.
    setRescanOpen(false);
  };
  const attachAnyway = () => {
    const d = docMismatch && docMismatch.doc;
    setDocMismatch(null);
    setRescanOpen(false);
    if (d) setCustomer((c) => c ? Object.assign({}, c, { doc: d }) : c);
  };
  // Create the record anyway, as an explicit choice the operator makes.
  const forceNewFromUnresolved = () => {
    const d = unresolved && unresolved.doc;
    setUnresolved(null);
    // The forced path is the ONE that most often carries a guessed split: a
    // returning barcode names a member id we cannot load, and the record it
    // came from stores a joined name. The mark travels with it.
    setNf((p) => applyDoc(Object.assign({}, p, { fromScan: {} }), d));
    setNewOpen(true);
  };

  // THE MANUAL PATH IS THE ONE PLACE A JOINED LEGACY STRING STILL REACHES THIS
  // FORM. The operator has just typed a whole name into the search box and been
  // told nobody by that name exists; opening a blank form threw that away and
  // made them type it again, in two halves this time.
  //
  // So it is split and prefilled — AND MARKED, because splitting on whitespace
  // is a guess and this is exactly the legacy case splitGuess exists for.
  // 'Nina Alvarez' comes out right; 'Mary Jo Van Der Berg', 'Jean-Luc Picard',
  // 'Robert Downey Jr.' and a mononym do not, and the operator is the only one
  // in the building who can see which of those they are looking at. The mark is
  // withdrawn per field the moment they correct it.
  //
  // An EMPTY query seeds nothing and marks nothing: an absence is not a guess,
  // and a warning on an untouched field is how operators learn to ignore
  // warnings.
  const openManual = () => {
    const g = nfSplitGuess(q.trim());
    setNf((p) => Object.assign({}, p, { firstName: g.first, lastName: g.last,
      guessed: { firstName: !!g.guessed && !!g.first, lastName: !!g.guessed && !!g.last },
      guessNote: g.note || '',
      // A guess is emphatically NOT "from ID" — there is no document here at all.
      fromScan: Object.assign({}, p.fromScan, { firstName: false, lastName: false }) }));
    setNewOpen(true);
  };

  const createNew = () => {
    // Same evidentiary bar as a GUEST. It was `!nf.name.trim()` alone, so the
    // BUYER — the person whose age has to be verified for the sale — could be
    // created from a typed name while their friend behind them could not join
    // the party without a scanned document (line 153: disabled={!nf.doc}).
    // An EXPIRED document is not a document. It used to enable this button and
    // print "Document captured · this customer starts at ID-on-file".
    // ...UNLESS THE OWNER'S SWITCH SAYS OTHERWISE. With enforcement OFF the
    // gate allows this person, and refusing here would be the counter screen
    // overruling the server it is supposed to be showing. With enforcement ON —
    // or unpublished, which is not the same as off — this still refuses.
    // A MONONYM HAS NO LAST NAME, so the bar is a FIRST name, not both. The
    // server agrees and is explicit about it: name_dob_fp returns None rather
    // than a fingerprint when a half is missing, and no fingerprint beats a
    // wrong one. Demanding a surname here would make the operator invent one to
    // get past the button, which is the dirty data this ruling is about.
    if (!nf.firstName.trim() || !nf.doc || expiryBlocks(nf.doc, null)) return;
    const firstName = nf.firstName.trim(), lastName = nf.lastName.trim();
    const streetNumber = nf.streetNumber.trim(), streetName = nf.streetName.trim();
    setCustomer({ id: 'new',
      // THE SPLIT PAIR IS WHAT IS STORED, UNDER THE KEY NAMES THE STORE AND THE
      // SERVER BOTH USE — `first_name`/`last_name` (wmdemo/server.py:4843,
      // pos/data.jsx addMember). A camelCase pair here would be dropped by the
      // allow-list one hop later and the record would carry only the joined
      // string again, which is the whole defect. `name` is DERIVED beside them
      // for the surfaces that only display a name (avatar, party row, search);
      // it is never the source, and it is never what gets fingerprinted.
      first_name: firstName, last_name: lastName, name: nfJoin(firstName, lastName),
      email: nf.email || '—', phone: nf.phone || '—', points: 0,
      type: type || 'AdultUse', member: false, gender: nf.gender,
      // `nf` was being dumped wholesale into `address`, which is how the
      // scanned document ended up as a stowaway at customer.address.doc where
      // nothing reads it. Address is an address; the document is the document.
      // Split is the source of truth here too, `street` is derived, and `state`
      // is whatever the operator captured — never a 'CA' nobody typed.
      address: { streetNumber, streetName, street: nfJoinStreet(streetNumber, streetName),
        city: nf.city.trim(), state: nf.state.trim().toUpperCase(), zip: nf.zip.trim() },
      dob: nf.dob,
      doc: nf.doc,
      // THE PHOTOS RIDE ALONG UNDER THEIR OWN KEY, beside the document and not
      // inside it: `doc` is what the scanner read, `idPhotos` is what a human
      // photographed, and one must never be mistaken for evidence of the other.
      // An empty list is stored as an empty list — the record then says "no
      // photos were attached", which is a fact, rather than leaving the key
      // absent and making every reader guess whether the feature even ran.
      //
      // ⚠️ THIS DOES NOT FILE THEM ANYWHERE. Each entry is a Blob URL in this
      // tab (HWIdPhotos.STORAGE.mode === 'memory', and every entry carries
      // `stored: false` to say so on the record itself). There is no server
      // route for ID images in this build; the card states that on screen and
      // nothing here may imply otherwise.
      idPhotos: nf.idPhotos });
    setNewOpen(false);
  };

  // MEMBERS may not be loaded. `.filter` on undefined throws during render and
  // blanks the whole modal, and there is nothing on screen to say why.
  const book = window.HW.MEMBERS || null;
  const results = (book || []).filter((m) => !q || (m.name + m.email + m.phone).toLowerCase().includes(q.toLowerCase()));

  const submit = (start) => onCheckIn && onCheckIn({ customer, guests, type, delivery, start });
  const blocked = window.guestIncomplete ? window.guestIncomplete(guests) : 0;
  // THE BUYER IS HELD TO THE SAME BAR AS THEIR FRIEND. A guest could not join
  // the party without a scanned document while the primary — the person whose
  // age has to be verified for the sale — could be a typed name. Either the
  // document was captured in this session (customer.doc) or the ledger already
  // holds one (docOnFileFor); a name alone is neither.
  // AN EXPIRED DOCUMENT IS NOT A DOCUMENT ON FILE. A scan captured in this
  // session bypassed assurance() entirely, so an expired licence scanned at the
  // counter enabled Create/Check-in and printed "ID on file" in the good tone.
  const primaryScan = customer && customer.doc && customer.doc.scannedAt ? customer.doc : null;
  // The member's own verification record, so that `doc_expiry.enforced` — the
  // most specific of the three publication sites, and the one the server stamps
  // on the row the consequence lands on — outranks the board and the contract,
  // exactly as verification.jsx reads them. A brand-new customer has no record,
  // so their read falls through to the board and then the contract.
  const primaryRec = customer && customer.id ? (window.HW && window.HW.IDV || {})[customer.id] || null : null;
  const primaryEnforced = expirySwitch(primaryRec);
  // DETECTION — unconditional, and displayed in every switch position.
  const primaryScanExpired = docIsExpired(primaryScan);
  // CONSEQUENCE — governed by the switch, and only by an explicit published OFF.
  const primaryScanBlocks = primaryScanExpired && primaryEnforced !== false;
  // A lapse that is ALLOWED rather than refused. The document does count as on
  // file, because the gate allows it — but it must never wear the clean pill a
  // customer with nothing wrong with them wears, or the operator cannot see the
  // cliff that turning the switch on would produce.
  const primaryScanLapsedSoft = primaryScanExpired && !primaryScanBlocks;
  const primaryDoc = customer ? primaryScan && !primaryScanBlocks ? primaryScan : docOnFileFor(customer.id) : null;
  const primaryNeedsId = !!customer && !primaryDoc;
  // The new-customer form's document is held to the same bar — detection and
  // consequence kept apart there too.
  const nfDocExpired = docIsExpired(nf.doc);
  const nfEnforced = expirySwitch(null);
  const nfDocBlocks = nfDocExpired && nfEnforced !== false;

  // ── THE MISMATCH PANEL, LIFTED OUT SO IT REACHES BOTH SCANNERS ─────────────
  // It used to live inline in the no-document branch, which was the only branch
  // that carried a scanner. The soft-lapse re-scan below is a second place a
  // document can arrive and be REJECTED for belonging to somebody else, and a
  // rejection with nothing on screen is the same defect this whole change is
  // about: the operator scans, the card does not move, and nothing says why.
  // Identical markup, one definition — not a copy that can drift.
  //
  // The two call sites are mutually exclusive by construction: a soft lapse
  // makes `primaryDoc` truthy, which is exactly the condition under which the
  // no-document branch does not render.
  const docMismatchPanel = () => !docMismatch || !customer ? null :
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This document is not this customer’s. The barcode reads <b style={{ fontFamily: P.fontMono }}>{docMismatch.doc.name || 'no name'}</b>{docMismatch.doc.memberId ? <> (customer <b style={{ fontFamily: P.fontMono }}>{docMismatch.doc.memberId}</b>)</> : null}, and the record selected here is <b style={{ fontFamily: P.fontMono }}>{customer.name}</b>{customer.id && customer.id !== 'new' ? <> (<b style={{ fontFamily: P.fontMono }}>{customer.id}</b>)</> : null}. Attaching it would put one person's ID under another person's name.</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <PBtn variant="accent" size="xs" icon="user" onClick={() => {setDocMismatch(null);setRescanOpen(false);setCustomer(null);setTypeFrom(null);setDeliveryFrom(null);}}>Pick the right customer</PBtn>
      <PBtn variant="secondary" size="xs" icon="refresh" onClick={() => setDocMismatch(null)}>Scan again</PBtn>
      <div style={{ flex: 1 }} />
      <PBtn variant="ghost" size="xs" onClick={attachAnyway}>Attach to {customer.name} anyway</PBtn>
    </div>
  </div>;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', animation: 'fade .15s ease', overflowY: 'auto' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden', border: `1px solid ${P.hairline2}` }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-check" size={16} stroke={2} color={P.accentInk} /></span>
            <div><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>New check-in</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Start of visit · add the guest &amp; their party</div></div>
          </div>
          <IconBtn icon="x" size={17} onClick={onClose} />
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1 — primary customer */}
          <div>
            <Eyebrow style={{ marginBottom: 9 }}>Customer</Eyebrow>
            {customer ?
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: P.surface2, border: `1px solid ${primaryDoc ? P.accentBorder : P.warn}`, borderRadius: P.r12 }}>
                <Avatar name={customer.name} size={36} crown={customer.member} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{customer.name}</div>
                  {/* The BUYER's verification, named. Selecting a customer from
                      the search box proved a name and nothing else; this says
                      which document backs them, or that none does. */}
                  <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{customer.points} pts · {customer.email}</div>
                </div>
                {/* THREE PILLS FOR THREE FACTS. A soft-lapsed allow reaches
                    "on file" — the gate allows it — and rendering it in the
                    same green as a current document is exactly the defect the
                    toggle work exists to close. */}
                {primaryDoc ? primaryScanLapsedSoft ? <Pill kind="bad" dot>ID on file · EXPIRED</Pill> : <Pill kind="good" dot>ID on file</Pill> : <Pill kind="warn" dot>No ID on file</Pill>}
                <PBtn variant="ghost" size="sm" icon="pencil" onClick={() => {setCustomer(null);setRescanOpen(false);setDocMismatch(null);setTypeFrom(null);setDeliveryFrom(null);}}>Change</PBtn>
              </div>
              {/* THE REFUSAL THAT DID NOT HAPPEN. Without this the card shows
                  a document on file for somebody the gate refuses the moment
                  the owner's switch is turned on, and the population that
                  switch would block is the thing a default-OFF toggle exists to
                  let you COUNT before you turn it on. */}
              {primaryScanLapsedSoft &&
              <div data-hw="soft-lapse-primary" style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Icon name="alert" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                    <b>The ID scanned for this customer EXPIRED on {primaryScan.expires}.</b> WOULD HAVE BEEN REFUSED — expiry enforcement is OFF, so this check-in is allowed and the refusal is recorded instead of applied. Ask for a current ID anyway: turn enforcement on and this customer stops clearing.
                  </span>
                </div>
                {/* AND HERE IS THE ID THEY WERE JUST TOLD TO ASK FOR.
                    The sentence above ends in an instruction; until now the card
                    it sits on had no way to carry it out, because a soft-lapsed
                    allow counts as a document ON FILE and that branch renders a
                    line of text and nothing else. Change was the only route, and
                    Change discards the customer.

                    THE CONTROL IS window.IdScanPanel — the same one the
                    no-document branch, the new-customer form and GuestEditor all
                    render. A "re-scan" of its own would be a second scanner to
                    keep in step with the first, and this file already says why
                    that is not done (line ~949: "not a different control, not a
                    copy"). What IS specific to this situation is the way IN: a
                    labelled button rather than an always-open panel, because the
                    panel is a 90px dashed box and this card already carries a
                    pill, a document line and this banner. The affordance is
                    visible and named for the act; only the reader is deferred.

                    `value={null}`, deliberately: while this is open nothing has
                    been captured (a capture closes it), so the panel opens READY
                    TO READ instead of on the done-state card of the very
                    document being replaced — which would print the expiry a
                    third time and put a Re-scan button behind a Scan button. */}
                {/* COLLAPSED, THE BUTTON CARRIES ITSELF. This first shipped with
                    a line of reassurance beside it — "replaces the document and
                    nothing else" — and measured in a real browser that line cost
                    59px on a modal already 836px tall in an 800px viewport, paid
                    on every soft-lapsed check-in to answer a question nobody has
                    asked yet. The banner directly above ends "Ask for a current
                    ID anyway", so the label needs no lead-in. The guarantee
                    moved to where it earns its space: below, once the scanner is
                    open and the operator is about to use it. jsdom called both
                    shapes fine, because jsdom has no idea what 59px is. */}
                {!rescanOpen ?
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }} />
                  {/* SECONDARY, NOT ACCENT — "one accent per view" (CLAUDE.md
                      design rule 1). It shipped gold and a browser check found
                      two solid accents live at once: this and the footer's
                      "Check in & start sale". The sibling alert blocks (the
                      document mismatch, the unresolved match) DO use accent, and
                      they are not a precedent: each of them only appears while
                      the check-in is blocked, so the footer's accent is greyed
                      out and theirs is the only one. A soft lapse is ALLOWED —
                      the footer is live — so this is the one alert block on the
                      card that has to yield. White on the alarm-red block is not
                      quiet; it is the only button in the box. */}
                  {window.IdScanPanel ?
                  <PBtn variant="secondary" size="xs" icon="scan" onClick={() => setRescanOpen(true)}>Scan a current ID</PBtn> :
                  <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>The ID scanner is not loaded on this page, so a current document cannot be captured here.</span>}
                </div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!docMismatch && <span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>This replaces the document on the record and nothing else — the account, its history and every field already captured are kept.</span>}
                  {!docMismatch && <window.IdScanPanel value={null} onChange={onPrimaryScan} />}
                  {docMismatchPanel()}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }} />
                    {/* NOT "Cancel". Backing out leaves an EXPIRED document on
                        the record — allowed today, refused the moment the switch
                        moves — and the button should say which state it returns
                        the operator to. */}
                    <PBtn variant="ghost" size="xs" onClick={() => {setDocMismatch(null);setRescanOpen(false);}}>Keep the expired ID for now</PBtn>
                  </div>
                </div>}
              </div>}
              {primaryDoc ?
              <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{docLine(primaryDoc)}</div> :
              <div style={{ padding: '10px 12px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Icon name="shield" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>{primaryScanExpired ?
                  primaryEnforced === true ?
                  <><b>The ID scanned for this customer EXPIRED on {primaryScan.expires}.</b> Expiry enforcement is ON, so an expired document does not verify an age today. The account and its history are kept — only the document has to be replaced. Scan a current one.</> :
                  /* enforced === null. NOT the same sentence as ON. Both refuse
                     today, so the wording is the only thing that tells the
                     operator whether the estate decided this or whether nobody
                     told the screen anything — and only one of those two is a
                     wiring fault somebody should go and fix. */
                  <><b>The ID scanned for this customer EXPIRED on {primaryScan.expires}.</b> Whether expiry is enforced here is UNKNOWN — nothing published the switch to this screen, so it is refusing on the strict reading rather than guessing. Scan a current ID. Separately: the server publishes that switch three ways and none of them arrived, which is a wiring fault, not a decision anybody made.</> :
                  <><b>Nobody has held this customer’s ID.</b> A record in the book is a name, not a document — and the buyer is the one person whose age has to be verified for the sale. Scan it to complete the check-in.</>}</span>
                </div>
                {window.IdScanPanel && !docMismatch ?
                <window.IdScanPanel value={customer.doc || null} onChange={onPrimaryScan} /> :
                docMismatch ? null :
                <span style={{ fontSize: 11.5, color: P.ink2 }}>The ID scanner is not loaded on this page, so the document cannot be captured here.</span>}
                {/* THE DOCUMENT IS BOUND TO WHOEVER WAS ALREADY SELECTED.
                    This was `Object.assign({}, c, { doc: d })` with no
                    comparison at all — neither d.name against customer.name nor
                    d.memberId against customer.id — so picking the wrong row out
                    of a search that returned two Danny F's and then scanning the
                    right person's ID produced a green "ID on file" on a record
                    the document does not belong to. Every neighbouring path is
                    careful about exactly this; the BUYER, whose age actually has
                    to be verified for the sale, was the only one whose document
                    was bound to a name nobody compared. Attaching anyway is
                    still available — as a choice someone makes, not as the
                    default. */}
                {docMismatchPanel()}
              </div>}
            </div> :

            <>
                {/* PRIMARY: the same scanner the member module uses. Not a
                    different control, not a copy -- window.IdScanPanel, so the
                    two flows cannot drift apart. */}
                {window.IdScanPanel ?
                  <div style={{ marginBottom: 11 }}>
                    <window.IdScanPanel value={nf.doc} onChange={onCheckInScan} />
                    <div style={{ fontSize: 11, color: P.inkDim, marginTop: 7, lineHeight: 1.45, textAlign: 'center' }}>
                      Scanning identifies the guest and captures their ID in one step. A match resumes their record; no match starts a new one with the name and date of birth already filled.
                    </div>
                  </div> :
                  /* THE PRIMARY ACTION MAY NOT VANISH INTO A TIDY LAYOUT.
                     This branch was `: null`, while the "OR FIND THEM MANUALLY"
                     divider below rendered unconditionally — so the operator
                     saw a rule labelled as an alternative to nothing, on a
                     screen that looked finished rather than broken, and the
                     redesign silently demoted itself to the slow path it exists
                     to demote. GuestEditor degrades with a real fallback; so
                     does this. */
                  <div style={{ marginBottom: 11, padding: '11px 13px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <Icon name="scan" size={15} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <span style={{ flex: 1, fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>The ID scanner is not loaded on this page.</b> The manual search below is the only path available, and it captures no verification — the document still has to be recorded before this check-in can complete.</span>
                  </div>}
                {/* A returning barcode naming a member id we cannot load. */}
                {unresolved &&
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 11, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>The scan matched <b style={{ fontFamily: P.fontMono }}>customer {unresolved.memberId}</b>, and this device cannot load that record. <b>This is not a new customer</b> — onboarding one here gives the same person a second profile.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PBtn variant="accent" size="xs" icon="refresh" onClick={() => setUnresolved(null)}>Scan again</PBtn>
                    <div style={{ flex: 1 }} />
                    <PBtn variant="ghost" size="xs" onClick={forceNewFromUnresolved}>Create a new record anyway</PBtn>
                  </div>
                </div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 10px' }}>
                  <div style={{ flex: 1, height: 1, background: P.hairline2 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: P.inkMute }}>OR FIND THEM MANUALLY</span>
                  <div style={{ flex: 1, height: 1, background: P.hairline2 }} />
                </div>
                {/* THE PRE-EMPTIVE "NEW" BUTTON IS GONE.
                    It asked the operator to declare "this person is new" at the
                    one moment they cannot know it — the same defect as the
                    New/Returning toggle the owner deleted, in a different
                    shape. It also opened a BLANK form, burying the fast
                    physical action under the slow typed one, and pressing it a
                    second time after a scan toggled the form shut and discarded
                    the pre-fill with no warning. The scan opens this form on
                    its own (onCheckInScan). The genuine exception — no document
                    to scan — is a link inside the manual block, below, and only
                    once a search has come back with nothing. */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
                  <Field icon="search" placeholder="Search by name, e-mail or phone" value={q} onChange={(e) => setQ(e.target.value)} size="md" />
                </div>
                {newOpen ?
              <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface2, padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="user-plus" size={14} stroke={1.9} color={P.ink2} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>New customer</span></div>
                    {/* THE SCAN RESULT STAYS VISIBLE, and the scanner is
                        reachable from inside this form — it can be opened by
                        hand (no ID to scan), and there has to be a way to
                        attach one without closing it. */}
                    <div><CILabel>Government ID</CILabel>
                      {window.IdScanPanel ? <window.IdScanPanel value={nf.doc} onChange={onCheckInScan} /> :
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
                        <Icon name="scan" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                        <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>The ID scanner is not loaded on this page, so no document can be captured here.</span>
                      </div>}
                      {/* THE PHOTOS BELONG TO THIS CARD, not to the address
                          block below it: they are a second reading of the SAME
                          document the panel above just read, and separating
                          them would put "what the barcode said" and "what the
                          document looks like" on two different subjects.

                          `docKey` is what lets the strip notice that the
                          document changed under photos already attached — see
                          the long note at HWIdPhotos.docKeyOf. A re-scan does
                          NOT delete them; it makes them say they no longer
                          match, and leaves the operator holding the decision.

                          THE CONTROL IS window.IdPhotoCapture, THE SHARED ONE.
                          Every other scan/create modal adopts this same import;
                          a fork here is a second copy of the storage sentence,
                          and the storage sentence is the compliance-critical
                          part of the whole feature. */}
                      <div style={{ marginTop: 9 }}>
                        <CILabel>Photos of the ID / passport</CILabel>
                        {window.IdPhotoCapture ?
                        <window.IdPhotoCapture
                          photos={nf.idPhotos}
                          onChange={(next) => setNf((p) => Object.assign({}, p, { idPhotos: next }))}
                          docKey={window.HWIdPhotos ? window.HWIdPhotos.docKeyOf(nf.doc) : null} /> :
                        /* Not loaded is not "none attached". Saying "no photos"
                           here would be this screen reporting an absence it has
                           no way to observe. */
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
                          <Icon name="camera" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>The photo control is not loaded on this page, so no image of the document can be attached here — and this screen cannot tell you whether any exist.</span>
                        </div>}
                      </div>
                    </div>
                    {/* '· from ID' is a claim about PROVENANCE, and '· GUESSED'
                        is the retraction of that claim: a split we made from a
                        joined string is OURS, and labelling it "from ID" would
                        say a government document named a surname it never
                        contained. Both suffixes are withdrawn the moment the
                        field is edited — see setNf1. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <CIField label={nameFieldLabel('First name', nf.guessed.firstName, nf.fromScan.firstName)} value={nf.firstName} onChange={(v) => setNf1('firstName', v)} />
                      <CIField label={nameFieldLabel('Last name', nf.guessed.lastName, nf.fromScan.lastName)} value={nf.lastName} onChange={(v) => setNf1('lastName', v)} />
                      <CIField label={nameFieldLabel('Date of birth', false, nf.fromScan.dob)} value={nf.dob} onChange={(v) => setNf1('dob', v)} placeholder="MM/DD/YYYY" mono />
                      <CIField label="Phone" value={nf.phone} onChange={(v) => setNf1('phone', v)} placeholder="(000) 000-0000" mono />
                    </div>
                    <NameSplitNote guessed={nf.guessed} note={nf.guessNote} />
                    <CIField label="Email" value={nf.email} onChange={(v) => setNf1('email', v)} placeholder="name@email.com" />
                    {/* Gender (comment 2) */}
                    <div>
                      <CILabel>Gender</CILabel>
                      <Seg value={nf.gender} onChange={(v) => setNf1('gender', v)} size="sm" options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }, { value: 'Non-binary', label: 'Non-binary' }]} />
                    </div>
                    {/* ADDRESS — ONE FIELD PER PARAMETER, INCLUDING THE STREET.
                        "separate fields for clean data" was written above a
                        single free-text "Street address" box, which is the
                        claim and its own counter-example in five lines. The
                        number and the name are two parameters; joining them
                        pushes the split onto whoever reads it later, and
                        splitStreetGuess exists precisely because that split
                        cannot be done reliably ('221B Baker St', 'PO Box 12',
                        'Apt 4, 1200 E Ocean Blvd').

                        Street number is the small box and street name the wide
                        one, matching the address book in customer-extras.jsx so
                        an operator meets one layout. FIVE BOXES WHERE THERE
                        WERE FOUR, in a modal that is already tall — jsdom
                        cannot see that, it answers "is it wired", never "does
                        it fit". Checked in a browser at 560px, the modal's own
                        width, before this was called done. */}
                    <div>
                      <CILabel>Address</CILabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '.42fr 1fr', gap: 8 }}>
                          <CIField value={nf.streetNumber} onChange={(v) => setNf1('streetNumber', v)} placeholder="Street no." mono />
                          <CIField value={nf.streetName} onChange={(v) => setNf1('streetName', v)} placeholder="Street name" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr .8fr', gap: 8 }}>
                          <CIField value={nf.city} onChange={(v) => setNf1('city', v)} placeholder="City" />
                          {/* NO 'CA' ANYWHERE — not as a value, not as a
                              placeholder that looks like one. Two letters, and
                              blank means blank. */}
                          <CIField value={nf.state} onChange={(v) => setNf1('state', v.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())} placeholder="State" mono />
                          <CIField value={nf.zip} onChange={(v) => setNf1('zip', v.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="ZIP" mono />
                        </div>
                      </div>
                    </div>
                    {/* THE REASON, BESIDE THE CONTROL. A greyed-out button
                        with no stated reason makes the operator guess which of
                        six fields is the blocker, at a counter, with five
                        people waiting. The footer does this correctly; so does
                        this now. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* THE LAPSE IS NAMED IN ALL THREE POSITIONS; only the
                          consequence sentence changes. `nfDocExpired` still
                          drives the alarm colour whether or not it blocks. */}
                      <span style={{ flex: 1, fontSize: 11.5, color: nfDocExpired ? P.bad : !nf.doc || !nf.firstName.trim() ? P.warn : P.inkDim, lineHeight: 1.4 }}>{
                        !nf.doc ? 'Scan the ID first — a name on its own is not enough for the buyer either.' :
                        nfDocExpired ? (
                          nfEnforced === true ? `That document EXPIRED on ${nf.doc.expires}. Expiry enforcement is ON, so an expired ID cannot start a customer at ID-on-file — ask for a current one and re-scan.` :
                          nfEnforced === false ? `That document EXPIRED on ${nf.doc.expires}. WOULD HAVE BEEN REFUSED — expiry enforcement is OFF, so this customer can still be created and the refusal is recorded instead of applied. Ask for a current ID anyway: turn enforcement on and they stop clearing.` :
                          `That document EXPIRED on ${nf.doc.expires}. Whether expiry is enforced here is UNKNOWN — nothing published the switch to this screen, so it is refusing on the strict reading rather than guessing. Ask for a current one and re-scan.`
                        ) :
                        !nf.firstName.trim() ? 'The document produced no first name. Type the legal first name to continue — the last name may legitimately be empty, and a copy of the first is not a surname.' :
                        'Document captured · this customer starts at ID-on-file.'
                      }</span>
                      <PBtn variant="secondary" size="sm" onClick={() => setNewOpen(false)}>Cancel</PBtn>
                      <PBtn variant="accent" size="sm" icon="check" disabled={!nf.firstName.trim() || !nf.doc || nfDocBlocks} onClick={createNew}>Create customer</PBtn>
                    </div>
                  </div> :
              /* THREE OUTCOMES OF A LOOKUP, not one empty rectangle.
                 `results.map` with no empty branch rendered a blank gap for a
                 search that matched nothing AND for a MEMBERS array that had
                 not loaded — so "this person is not in our system" and "the
                 book is not here" looked identical, and the wrong action
                 (onboard a duplicate) was the faster one. */
              book == null ?
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>The customer book is not loaded.</b> Nothing can be searched, and an empty result here would NOT mean this person is new. Scan their ID, or retry once the book is available.</span>
              </div> :
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 168, overflowY: 'auto' }}>
                  {results.map((m) =>
                <button key={m.id} onClick={() => adoptCustomer(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                      <Avatar name={m.name} size={30} crown={m.member} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{m.name}</div>
                        <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.type}</div>
                      </div>
                      <Icon name="chevron-right" size={15} color={P.inkFaint} />
                    </button>
                )}
                  {results.length === 0 && q.trim() &&
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
                    <Icon name="user-plus" size={15} color={P.ink2} />
                    <span style={{ flex: 1, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>No customer called “{q.trim()}”. Scan their ID above — it onboards them and captures the document in one step. No ID to scan?</span>
                    <PBtn variant="ghost" size="xs" onClick={openManual}>Enter manually</PBtn>
                  </div>}
                </div>}
              </>}
          </div>

          {/* Step 2 — visit details. The segments are SEEDED from the record and
              say so; they no longer ask the operator to re-classify something
              the customer's own file already answers. */}
          {customer &&
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <div><Eyebrow style={{ marginBottom: 8 }}>Customer type{typeFrom === 'record' ? <span style={{ color: P.inkMute, fontWeight: 600 }}> · on their record</span> : null}</Eyebrow><Seg value={type || 'AdultUse'} onChange={(v) => {setType(v);setTypeFrom('operator');}} size="sm" options={[{ value: 'AdultUse', label: 'Adult Use' }, { value: 'MedicinalUser', label: 'Medicinal' }]} /></div>
              <div><Eyebrow style={{ marginBottom: 8 }}>Method{deliveryFrom === 'record' ? <span style={{ color: P.inkMute, fontWeight: 600 }}> · on their record</span> : null}</Eyebrow><Seg value={delivery || 'Pick-up'} onChange={(v) => {setDelivery(v);setDeliveryFrom('operator');}} size="sm" options={[{ value: 'Pick-up', label: 'Pick-up', icon: 'shop' }, { value: 'Delivery', label: 'Delivery', icon: 'truck' }]} /></div>
            </div>}

          {/* Step 3 — party / guests (the 3 options) */}
          {customer &&
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.hairline}` }}>
              <div style={{ height: 12 }} />
              <GuestEditor primaryName={customer.name} guests={guests} onChange={setGuests} />
            </div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: `1px solid ${P.hairline2}`, background: P.surface2 }}>
          {/* THE LAPSE IS ON THE FOOTER IN ALL THREE POSITIONS TOO — but a
              footer that says only "the scanned ID has expired" beside an
              ENABLED Check in button reads as a broken screen. Say which of the
              three the operator is looking at. */}
          <span style={{ fontSize: 11.5, color: blocked || primaryNeedsId || primaryScanExpired ? P.bad : P.inkDim, fontFamily: P.fontMono }}>{
            !customer ? 'Select a customer' :
            primaryScanLapsedSoft ? 'ID EXPIRED — allowed, enforcement is OFF' :
            primaryScanExpired ? (primaryEnforced === true ? 'The scanned ID has EXPIRED' : 'ID EXPIRED — enforcement UNKNOWN, refusing') :
            primaryNeedsId ? 'Scan the buyer’s ID' :
            blocked ? blocked + ' guest' + (blocked > 1 ? 's' : '') + ' need ID' :
            1 + guests.length + ' in party'}</span>
          <div style={{ flex: 1 }} />
          <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="soft" size="md" icon="user-check" disabled={!customer || !!blocked || primaryNeedsId} onClick={() => submit(false)}>Check in</PBtn>
          <PBtn variant="accent" size="md" icon="arrow-right" disabled={!customer || !!blocked || primaryNeedsId} onClick={() => submit(true)}>Check in &amp; start sale</PBtn>
        </div>
      </div>
    </div>);

};

Object.assign(window, {});