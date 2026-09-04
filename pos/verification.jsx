// ── Identity assurance ──────────────────────────────────────────────────────
// One customer record. Many verification EVENTS. The tier is DERIVED from the
// events — never typed by hand, never set per channel.
//
//   T0  Unverified      browse only
//   T1  Document on file  a person physically inspected the ID: scanned the
//                         barcode and photographed it. Staff at the counter, or
//                         a driver at the door. Clears in-store sale instantly.
//   T2  Account bound     T1 + we proved they control the phone on the account
//                         (one SMS code). THIS is what unlocks delivery.
//
// Why delivery needs T2 and not "check the document again": the ID is already verified by
// a human who held it. The only open question for a remote order is whether the
// person tapping "order" is that same human — which is an ACCOUNT-BINDING
// question, answered by phone ownership, not by re-checking the document.
//
// The remote ID check is therefore a SUBSTITUTE for T1, not an extra step on top
// of it. It exists for customers who have never walked in. A customer who has
// been scanned in store never sees it. Ever.
//
// WHO GETS THE VERIFICATION SMS: delivery customers only. An in-store walk-in
// is fully cleared by the counter ID scan (T1) and is NEVER sent one — there is
// nothing to bind, because the person is standing in front of you holding the
// document. The SMS exists solely to answer "is the person placing this REMOTE
// order the same human whose ID we inspected", so it is triggered by a delivery
// order, not by a check-in. Walk-ins who later want delivery are asked once, at
// the counter, as a courtesy — never as a condition of shopping in store.
//
// ── WHY THERE IS DELIBERATELY NO ERROR BOUNDARY IN THIS FILE ────────────────
//
// This is a recorded decision, not an oversight. Do not "fix" it by wrapping a
// badge; read this first and then argue with it.
//
// The rule for this estate is that a compliance verdict must never survive its
// own failure. The natural reading is "wrap the verdict in a CriticalBoundary".
// That is the wrong tool HERE, for a specific reason: the verdict-bearing code
// in this file does not fail. `assurance()` is total — every input traced,
// including {}, null and garbage, returns a tier rather than throwing.
// `AssuranceBadge` and `IdentityLadder` faithfully render whatever it decided.
// So a boundary around them could only ever fire on an infrastructure fault (a
// missing `useP`, a missing `Icon`) and would blank an otherwise-correct panel,
// while every verdict that is actually WRONG renders straight through it, green.
// A passing boundary test over that is worse than no boundary: it reads as cover
// for a class of failure the mechanism cannot see.
//
// Omission is also not the unsafe default. Per shared/error-boundary.jsx, an
// unbounded throw propagates to the nearest ScreenBoundary above and fails the
// whole frame — so a genuine render fault here already stops the screen rather
// than showing half a verdict. Adding a boundary would CONTAIN that, which is
// the one outcome this surface must not have.
//
// The real defects here are verdicts built from truthiness. They need
// predicates, not boundaries:
//   · `docOk` / `phoneOk` below test truthiness only, so a record whose
//     `phone.smsVerified` is the STRING 'pending' clears to T2 "Delivery ready".
//   · `isExpiredDoc` fails OPEN on an unparseable date — unknown renders as
//     clean. The `docExpiryUnknown` third state the comment at ~line 51 promises
//     is not implemented anywhere in this repo.
//   · `parseExpiry` reads a non-US `30/05/2026` as June 2028, so an expired
//     document reads valid. shared/hw-live-checkin.js refuses to guess that
//     ordering on the wire for exactly this reason; this screen guesses anyway.
// Logged with the boundary pass; they are the next job on this file.
// ────────────────────────────────────────────────────────────────────────────
const useP = window.useP;
// The remote ID-verification VENDOR is deliberately never named in the UI, so a
// change of provider is a config change, not a redesign. Set this to a name if
// we ever want to badge it; empty means the chip is hidden.
const IDV_VENDOR = '';

const TIERS = {
  0: { key: 't0', label: 'Unverified', short: 'T0', tone: 'bad' },
  1: { key: 't1', label: 'ID on file', short: 'T1', tone: 'warn' },
  2: { key: 't2', label: 'Delivery ready', short: 'T2', tone: 'good' }
};

// Derive everything from the events. Order of checks matters.
// EXPIRY IS A DATE. NOTHING WAS COMPARING IT TO TODAY.
// The tier-0 expired branch below was gated on a boolean `doc.expired` that
// NOTHING in this estate ever sets — every producer emits an expiry DATE
// (`expires: '2026-05-30'`), so the branch was unreachable and an expired
// driving licence rendered as literally the same pixels as a 2032 passport:
// green "ID on file", Create customer enabled, "this customer starts at
// ID-on-file". The honest branch costs one date comparison; the dishonest one
// was free. An explicit `doc.expired` flag is still honoured if a real
// provider ever sends one.
//
// Unparseable is NOT expired. A date we cannot read is unknown, and unknown
// must not wear the good tone either — `docExpiryUnknown` is its own state.
function parseExpiry(x) {
  if (!x) return null;
  const s = String(x).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
// A document is expired at the END of its expiry day, not the start of it.
function isExpiredDoc(doc, now) {
  if (!doc) return false;
  if (doc.expired === true) return true;
  const d = parseExpiry(doc.expires);
  if (!d) return false;
  const t = now || new Date();
  return d.getTime() < new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
}
window.HWExpiry = { parseExpiry, isExpiredDoc };

// ── NAMES ARE CAPTURED SPLIT. THEY ARE NEVER GUESSED SPLIT AND STORED. ──────
// [OWNER RULING 2026-08-27: "each customer parameter needs a dedicated input
//  field, we cannot have dirty data … first name / last name / street number +
//  street name / city / state / zip … fix it system-wide"]
//
// WHY THIS IS AN IDENTITY BUG AND NOT A TIDINESS ONE. The identity ladder
// matches on `name_dob_fp` — a fingerprint over first name, last name and date
// of birth. A single "Full name" box means the split is performed by code, on
// whitespace, at write time, and that guess then DECIDES WHETHER TWO RECORDS
// ARE THE SAME PERSON. This estate has already put one Weedmaps customer id on
// four live identities carrying 458 orders between them, and has already nearly
// written a government-document hash onto a stranger. A fingerprint built from
// a bad split is that same failure with a different first mover.
//
// THE SERVER HAS ALWAYS WANTED THEM SPLIT — verified 2026-08-27 against
// wmdemo/identity_match.py:176 and wmdemo/server.py:4843:
//     def name_dob_fp(first, last, dob):
//         if not (first and last and dob): return None
// It takes `first_name`/`last_name` as separate keys and there is NO joined
// `name` key on any create/update endpoint. So the joined box in the UI was
// never the wire format — it was a lossy local detour that the client had to
// reverse by guessing before it could speak to the server at all.
//
// WHITESPACE DOES NOT SPLIT NAMES. 'Nina Alvarez' is the easy case and it is
// the only easy case:
//   'Mary Jo Van Der Berg'      — 2-token given name, 3-token surname
//   'Maria de los Angeles Ruiz' — particles that are not the surname
//   'Jean-Luc Picard'           — a hyphen is not a separator here
//   'Ng'                        — a mononym has no last name AT ALL
//   'Robert Downey Jr.'         — the last token is a suffix, not a surname
// No heuristic gets these right, so this one DOES NOT TRY to be right. It
// returns its best guess AND a standing declaration that it is a guess, and
// every caller must render the result editable and marked.
//
// THE ONLY REAL FIX IS UPSTREAM: capture first and last separately, and have a
// scanner that reads a document read them separately too. AAMVA PDF417 carries
// family name and given name as DISTINCT elements (DCS / DAC) — a joined name
// on the scan path was something this code invented, never something the
// barcode did. `splitGuess` exists for ONE job: LEGACY joined strings that
// already exist and have nothing better to offer. It is not a field.
function splitNameGuess(joined) {
  const raw = String(joined == null ? '' : joined).trim().replace(/\s+/g, ' ');
  // Nothing in, nothing guessed. An empty name is an ABSENCE, and marking an
  // absence as a "guess" would hang a warning on a field nobody has filled in
  // yet — which is how operators learn to ignore the warning that matters.
  if (!raw) return { first: '', last: '', guessed: false, confidence: 'none', note: '' };
  const parts = raw.split(' ');
  if (parts.length === 1) {
    // A MONONYM'S LAST NAME IS EMPTY, NOT A COPY OF THE FIRST. Duplicating the
    // token would mint a name_dob_fp for a surname we do not have, and it would
    // collide with everyone who genuinely carries that token as a surname.
    // Leaving it empty makes the server return None from name_dob_fp, which is
    // the honest outcome: no fingerprint beats a wrong one.
    return { first: parts[0], last: '', guessed: true, confidence: 'low',
      note: 'One word only — we cannot tell whether this is a given name, a family name or a mononym. The last-name field is left EMPTY on purpose rather than filled with a copy of the first.' };
  }
  if (parts.length === 2) {
    return { first: parts[0], last: parts[1], guessed: true, confidence: 'low',
      note: 'Split on the single space. Two words is the case this guess is least wrong on — it is still a guess.' };
  }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1], guessed: true, confidence: 'low',
    note: parts.length + ' words — everything before the last word went to the first-name field. Compound surnames (Van Der Berg, de los Angeles) and suffixes (Jr.) come out WRONG under this rule. Check it against the document.' };
}
// Joining is lossless and needs no warning — it is only ever a display concern.
// A mononym joins to itself, with no trailing space.
function joinName(first, last) {
  return [String(first == null ? '' : first).trim(), String(last == null ? '' : last).trim()]
    .filter(Boolean).join(' ');
}
window.HWName = { splitGuess: splitNameGuess, join: joinName };

// ── ADDRESSES, SAME RULING ──────────────────────────────────────────────────
// Street number and street name are separate parameters. Splitting a joined
// street line is a guess for the same reasons: '12 Probe Way' is easy, and
// 'Apt 4, 1200 E Ocean Blvd', 'PO Box 12', '221B Baker St' and '1/2 Front St'
// are not. A house number is not reliably leading, and not reliably numeric.
function splitStreetGuess(joined) {
  const raw = String(joined == null ? '' : joined).trim().replace(/\s+/g, ' ');
  if (!raw) return { number: '', name: '', guessed: false, confidence: 'none', note: '' };
  const m = raw.match(/^([0-9][0-9A-Za-z\-\/]*)\s+(.*)$/);
  if (!m) {
    // No leading number at all. We refuse to invent one — the whole string is
    // the street name and the number field stays empty for a human to fill.
    return { number: '', name: raw, guessed: true, confidence: 'low',
      note: 'No leading street number was found, so the number field is left EMPTY rather than carved out of the text.' };
  }
  return { number: m[1], name: m[2], guessed: true, confidence: 'low',
    note: 'Split at the first space after a leading number. Unit/apartment prefixes and PO boxes come out wrong under this rule.' };
}
function joinStreet(number, name) {
  return [String(number == null ? '' : number).trim(), String(name == null ? '' : name).trim()]
    .filter(Boolean).join(' ');
}
window.HWAddress = { splitStreetGuess, joinStreet };

// ── THE OWNER'S EXPIRY-ENFORCEMENT SWITCH [RULING 2026-08-27] ───────────────
// Whether a lapsed document REFUSES is a toggle, default OFF, and the server
// owns its position. Detection is not the toggle: an expired document is still
// detected, still counted and still shown either way. The switch decides one
// thing — whether this screen refuses.
//
// THIS SCREEN HAD NO KNOWLEDGE OF IT AT ALL. assurance() hard-blocked on a
// lapse (tier 0, canStore:false, canDelivery:false), so with enforcement OFF
// the server allowed the order and the counter still refused it. The switch the
// owner asked for did not switch.
//
// THREE STATES, NOT TWO. The flag is READ — never inferred, never defaulted.
// If nothing published it (an older server, a board that predates the switch),
// that is `null`: it is not "enforcing" and it is not "not enforcing", and
// rendering an absence as either answer is the exact failure this estate has
// spent the week finding. A compliance switch is the last place to add one.
//
// Read in specificity order — the row the consequence lands on beats the board,
// the board beats the estate-wide contract:
//   1. v.doc_expiry.enforced        per-row (checkin_api._doc_expiry_view)
//   2. HW_CHECKIN.board.expiry_enforcement.enforced      the check-in board
//   3. HW_CHECKIN.contract.doc_expiry_enforced           the served contract
// Each read is a STRICT boolean test. A missing key, a null, a string 'false'
// and an object all fall through to the next source rather than being coerced;
// coercing is how `null` becomes `false` and the third state disappears.
function expiryEnforced(v) {
  const row = v && v.doc_expiry;
  if (row && typeof row.enforced === 'boolean') return row.enforced;
  const ck = typeof window !== 'undefined' && window.HW_CHECKIN;
  const bd = ck && ck.board && ck.board.expiry_enforcement;
  if (bd && typeof bd.enforced === 'boolean') return bd.enforced;
  const ct = ck && ck.contract;
  if (ct && typeof ct.doc_expiry_enforced === 'boolean') return ct.doc_expiry_enforced;
  return null;                                    // absent. NOT false.
}
window.HWExpiryPolicy = { expiryEnforced };

function assurance(v) {
  if (!v) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, blocker: 'No ID has been seen yet.', next: 'Scan their ID at the counter, or send a remote ID-check link.' };
  const doc = v.doc,ph = v.phone || {},pa = v.remoteId || v.persona;
  const docOk = !!(doc && doc.scannedAt && doc.photo);
  const docExpired = isExpiredDoc(doc);
  const remoteOk = !!(pa && pa.status === 'passed');
  const phoneOk = !!ph.smsVerified;
  const enforced = expiryEnforced(v);
  const on = doc && doc.expires ? ' on ' + doc.expires : '';
  // What a soft-lapsed ALLOW carries down the ladder with it. Mirrors the
  // server's Decision fields verbatim (verify_gate.Decision: expiry_enforced /
  // would_block_code / would_block_reason) so the two never drift into two
  // vocabularies for one fact.
  let soft = enforced === null ? { expiryEnforced: null } : { expiryEnforced: enforced };

  if (docExpired) {
    if (enforced === true) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, expired: true,
      lapsed: true, expiryEnforced: true,
      blocker: 'The ID we have on file expired' + on + '.',
      next: 'Re-scan a current ID — the account and history are kept.' };
    if (enforced === null) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, expired: true,
      lapsed: true, expiryEnforced: null, expiryEnforcementUnknown: true,
      blocker: 'The ID we have on file expired' + on + ' — and NOTHING has told this screen whether ' +
        'expiry is enforced here, so it is refusing on the strict reading rather than guessing.',
      next: 'Re-scan a current ID. Separately: the server publishes the enforcement switch three ways ' +
        '(the check-in board, the served contract, and the row itself) and none of them reached this ' +
        'screen — that is a wiring fault to fix, not a decision anybody made.' };
    // enforced === false. ALLOW — and carry the refusal that did not happen, so
    // that turning the switch on later is a number somebody counted rather than
    // a cliff nobody predicted.
    // `tone: 'warn'` deliberately OVERRIDES the tier's own tone below. A soft
    // lapse that reaches T2 would otherwise wear TIERS[2].tone === 'good' and
    // render as the identical green chip as a customer with nothing wrong with
    // them — which is the whole defect: allowed-because-the-switch-is-off must
    // never look like allowed-on-the-merits.
    soft = { expiryEnforced: false, lapsed: true, wouldBlockCode: 'lapsed', tone: 'warn',
      wouldBlockReason: 'WOULD HAVE BEEN REFUSED: the ID on file expired' + on + '. Expiry ' +
        'enforcement is OFF, so this is allowed and the refusal is recorded instead of applied. ' +
        'Turn enforcement on and this person stops clearing.' };
  }
  if (!docOk && !remoteOk) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, ...soft, blocker: 'No ID has been seen yet.', next: 'Scan their ID at the counter, or send a remote ID-check link.' };
  if (!phoneOk) return { tier: 1, ...TIERS[1], canStore: true, canDelivery: false, ...soft,
    blocker: 'Phone not confirmed — we can’t tie a remote order back to this person.',
    next: 'One SMS code, and only if they want delivery. In-store shopping needs nothing more.' };
  return { tier: 2, ...TIERS[2], canStore: true, canDelivery: true, ...soft, via: remoteOk && !docOk ? 'remote' : doc && doc.where === 'door' ? 'door' : 'in-store' };
}
window.HWV = { assurance, TIERS, expiryEnforced };

// ── Badge ───────────────────────────────────────────────────────────────────
window.AssuranceBadge = function AssuranceBadge({ v, size = 'md' }) {
  const P = useP();
  const a = assurance(v);
  const c = a.tone === 'good' ? P.good : a.tone === 'warn' ? P.warn : P.bad;
  const sm = size === 'sm';
  // A SOFT-LAPSED ALLOW IS NOT A CLEAN PASS AND MUST NOT WEAR ONE. The tier is
  // real — the server allowed this order — but it was allowed only because
  // enforcement is off, so the chip says `lapsed`, drops the tick for an alert
  // glyph, and puts the sentence the gate WOULD have refused with in the title.
  const soft = a.wouldBlockCode === 'lapsed';
  return <span title={soft ? a.wouldBlockReason : a.blocker || 'Cleared for in-store and delivery'} data-hw-would-block={soft ? a.wouldBlockCode : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: sm ? '2px 8px' : '4px 10px', borderRadius: 99, background: c + '1f', color: c, fontSize: sm ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
    <Icon name={soft ? 'alert' : a.tier === 2 ? 'check-circle' : a.tier === 1 ? 'shield' : 'x'} size={sm ? 11 : 13} stroke={2.2} />{a.label}{soft ? ' · ID lapsed' : ''}
  </span>;
};

// ── The ladder — where this customer is and what is actually missing ────────
window.IdentityLadder = function IdentityLadder({ v, compact }) {
  const P = useP();
  const a = assurance(v);
  const doc = v && v.doc || {};
  const ph = v && v.phone || {};
  const pa = v && (v.remoteId || v.persona);
  const rungs = [
  { n: 1, t: 'ID inspected', done: a.tier >= 1,
    d: a.tier >= 1 ?
    pa && pa.status === 'passed' && !doc.scannedAt ? 'Remote ID check passed ' + pa.at :
    doc.where === 'door' ? 'Scanned at the door by ' + doc.by + ' · ' + doc.scannedAt :
    'Scanned & photographed by ' + doc.by + ' · ' + doc.where :
    'Nobody has seen a document yet.',
    // The date alone is not the fact. A lapsed document printed as a plain
    // "expires 2026-05-30" beside a green tick asks the reader to do the date
    // arithmetic the code already did.
    meta: a.tier >= 1 && doc.num ? doc.type + ' ' + doc.num + ' · expires ' + doc.expires +
      (a.wouldBlockCode === 'lapsed' ? ' — LAPSED, not enforced' : '') : null },
  { n: 2, t: 'Phone confirmed', done: !!ph.smsVerified, note: 'delivery only',
    d: ph.smsVerified ? 'SMS code confirmed ' + (ph.verifiedAt || '') + ' — ' + ph.value :
    ph.sentAt ? 'Code sent ' + ph.sentAt + ' to ' + ph.value + ' — waiting on them' :
    'Not sent. Only sent when they order delivery — never for an in-store visit.' },
  { n: 3, t: 'Delivery unlocked', done: a.tier >= 2,
    // "No further checks, ever" is FALSE over a lapsed document: the switch
    // being turned on is exactly a further check, and it is the one this
    // customer fails.
    d: a.tier >= 2 ? (a.wouldBlockCode === 'lapsed'
      ? 'Can order delivery today — but on a LAPSED document, allowed only while expiry enforcement is off. This is not a permanent clearance.'
      : 'Can order delivery on our site and on Weedmaps. No further checks, ever.') :
    'Opens automatically the moment step 2 lands. In-store shopping is already open.' }];

  return <div style={{ display: 'flex', flexDirection: 'column' }}>
    {/* THE REFUSAL THAT DID NOT HAPPEN. Without this the ladder shows three
        green ticks for somebody the gate would refuse the moment the owner's
        switch is turned on — and the point of a default-OFF toggle is that the
        population it will block can be COUNTED before it is turned on. A rung
        that reads "No further checks, ever" over a lapsed document is the
        cliff being hidden rather than measured. */}
    {a.wouldBlockCode === 'lapsed' &&
      <div data-hw="soft-lapse" style={{ display: 'flex', gap: 8, padding: '8px 10px', marginBottom: 10, background: P.warnSoft, border: `1px solid ${P.warn}44`, borderRadius: P.r8 }}>
        <Icon name="alert" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
          <b>Allowed only because expiry enforcement is off.</b> {a.wouldBlockReason}
        </div>
      </div>}
    {a.expiryEnforcementUnknown &&
      <div data-hw="expiry-switch-unknown" style={{ display: 'flex', gap: 8, padding: '8px 10px', marginBottom: 10, background: P.warnSoft, border: `1px solid ${P.warn}44`, borderRadius: P.r8 }}>
        <Icon name="alert" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
          <b>Expiry enforcement: not published.</b> {a.next}
        </div>
      </div>}
    {rungs.map((r, i) => {
      const c = r.done ? P.good : P.inkMute;
      return <div key={r.n} style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{ width: 20, height: 20, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.done ? P.good : 'transparent', border: r.done ? 'none' : `1.5px dashed ${P.hairline3 || P.hairline2}`, color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: P.fontMono }}>
            {r.done ? <Icon name="check" size={11} stroke={3.2} color="#fff" /> : <span style={{ color: P.inkMute }}>{r.n}</span>}</span>
          {i < rungs.length - 1 && <span style={{ flex: 1, width: 1.5, background: r.done ? P.good : P.hairline, margin: '2px 0', minHeight: compact ? 8 : 12 }} />}
        </div>
        <div style={{ paddingBottom: i < rungs.length - 1 ? compact ? 9 : 12 : 0, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: r.done ? P.ink : P.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>{r.t}{r.note && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.info, background: P.infoSoft, borderRadius: 99, padding: '1px 6px' }}>{r.note}</span>}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1, lineHeight: 1.45 }}>{r.d}</div>
          {r.meta && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{r.meta}</div>}
        </div>
      </div>;})}
  </div>;
};

// ── Verification SMS ────────────────────────────────────────────────────────
// DELIVERY ONLY. The system sends this automatically when a DELIVERY order
// appears for an account that has an ID on file but no confirmed phone. An
// in-store walk-in never triggers it. Staff never have to remember to send it —
// but they CAN resend when the first one silently fails, and every attempt is
// timestamped with its carrier delivery receipt so you can tell "not delivered"
// from "ignored".
const SMS_STATE = {
  queued: { label: 'Queued', tone: 'dim', icon: 'clock' },
  sent: { label: 'Sent', tone: 'dim', icon: 'arrow-right' },
  delivered: { label: 'Delivered', tone: 'good', icon: 'check' },
  failed: { label: 'Undelivered', tone: 'bad', icon: 'x' }
};
window.SmsVerifyPanel = function SmsVerifyPanel({ phone, state, sentAt, attempts, onVerified, onLog, compact }) {
  const P = useP();
  const [st, setSt] = React.useState(state === 'verified' ? 'verified' : 'pending');
  const [code, setCode] = React.useState('');
  const [secs, setSecs] = React.useState(0);
  // Staff choose what the customer receives: a 6-digit code to read back, or a
  // one-tap magic link. Both bind the same phone to the same account.
  const [mode, setMode] = React.useState('link');
  // A RECEIPT WE DID NOT RECEIVE CANNOT BE A FALLBACK VALUE.
  // This used to seed `{ at: sentAt || '2 min ago', status: 'delivered',
  // receipt: 'carrier ack 1.4s' }` whenever no attempts were passed — and NO
  // call site passes attempts, so the fabricated row rendered on every real
  // render, and the header pill read a green "Delivered" off it. For m5
  // (phone: { smsVerified:false }, no sentAt at all) the screen claimed a
  // verification SMS was delivered two minutes ago and the carrier acknowledged
  // in 1.4s. Nothing was ever sent. An operator reading "Delivered" concludes
  // the customer is ignoring the code and does not resend — the one action that
  // would unblock the delivery.
  // Nothing sent renders as NO log and NO status pill. Same seed shape as
  // RemoteIdPanel below, which got this right first.
  const [log, setLog] = React.useState(attempts && attempts.length ? attempts :
  sentAt ? [{ at: sentAt, by: 'System · auto', status: 'sent', receipt: 'no carrier receipt recorded', kind: 'link' }] : []);
  React.useEffect(() => {if (secs <= 0) return;const t = setTimeout(() => setSecs(secs - 1), 1000);return () => clearTimeout(t);}, [secs]);

  const resend = () => {
    setSecs(30);
    const first = log.length === 0;
    const kind = mode === 'link' ? 'link' : 'code';
    setLog((l) => [{ at: 'Just now', by: 'Manisha Saini · manual', status: 'sent', receipt: 'awaiting carrier ack', kind }, ...l]);
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: `${first ? 'Sent' : 'Resent'} the verification ${kind} by SMS to ` + phone, time: 'just now', icon: 'phone' });
    // A CARRIER RECEIPT IS A THIRD PARTY'S STATEMENT ABOUT A MESSAGE WE NEVER
    // HANDED THEM. Round 1 deleted the fabricated SEED; the same claim was
    // still being written 1.6 seconds after the click by a
    // `setTimeout(... status: 'delivered', receipt: 'carrier ack 0.9s')`, which
    // made it look EARNED rather than defaulted and therefore carried more
    // authority than the row that was removed. Nothing is sent from this panel
    // — there is no endpoint and no send path anywhere in it — so the row stays
    // at 'sent · awaiting carrier ack', which is exactly the state a real
    // unwired build is in. The operator who taps Resend and does NOT see a
    // green Delivered keeps resending and keeps looking at the number, which
    // are the two things that actually unblock the order.
  };
  const verify = () => {setSt('verified');onVerified && onVerified();onLog && onLog({ who: phone, role: 'Customer', action: 'Confirmed phone by SMS code — account bound, delivery unlocked', time: 'just now', icon: 'check-circle' });};

  if (st === 'verified') return <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
    <Icon name="check-circle" size={16} stroke={2} color={P.good} />
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Phone confirmed — delivery unlocked</div>
      <div style={{ fontSize: 11.5, color: P.inkDim }}>{phone} is now bound to this account. They will never be asked again.</div></div>
  </div>;

  const last = log[0] || {};
  const lastMeta = SMS_STATE[last.status] || SMS_STATE.sent;
  const lastCol = lastMeta.tone === 'good' ? P.good : lastMeta.tone === 'bad' ? P.bad : P.inkDim;

  return <div style={{ padding: '11px 13px', background: P.warnSoft, border: `1px solid ${P.warn}66`, borderRadius: P.r10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
      <Icon name="phone" size={14} color={P.warn} />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.warn }}>Pending verification</span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.info, background: P.infoSoft, borderRadius: 99, padding: '1px 7px' }}>Delivery only</span>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{phone}</span>
    </div>

    {/* What gets sent — link or code — and the exact message. */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Seg value={mode} onChange={setMode} size="sm" options={[{ value: 'link', label: 'Magic link', icon: 'link' }, { value: 'code', label: '6-digit code', icon: 'lock' }]} />
      <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>expires in 15 min</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: P.surface, borderRadius: P.r8, marginBottom: 9 }}>
      <Icon name="mail" size={13} color={P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, fontFamily: P.fontMono, minWidth: 0 }}>
        {mode === 'link' ?
        <>“Hyperwolf: confirm your number to unlock delivery — <b style={{ color: P.info }}>hyprwlf.co/v/8Kd2mQ</b>. Reply STOP to opt out.”</> :
        <>“Hyperwolf: your verification code is <b style={{ color: P.ink }}>481 302</b>. Reply STOP to opt out.”</>}
      </div>
    </div>

    {/* Send / resend is always available — it is the whole point of the panel. */}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 9 }}>
      {/* "RESEND" IS A CLAIM THAT A FIRST MESSAGE WENT OUT.
           The log block below was fixed to say nothing was sent; this control —
           the loudest element on the panel — went on offering to send it AGAIN,
           so the two halves of one panel disagreed about the same fact. An
           operator reads the button, concludes a code is already sitting on the
           customer's phone, and treats a delivery blocked on a message nobody
           sent as a customer who is ignoring one. Same branch, same state. */}
      <PBtn variant="accent" size="sm" icon={secs > 0 ? 'clock' : 'phone'} disabled={secs > 0} onClick={resend}>
        {secs > 0 ? `${log.length > 1 ? 'Resend' : 'Send'} in ${secs}s` : `${log.length ? 'Resend' : 'Send'} ${mode === 'link' ? 'link' : 'code'} by SMS`}
      </PBtn>
      {mode === 'code' && <>
        <div style={{ flex: '1 1 96px', minWidth: 92 }}><Field mono value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="000000" size="sm" /></div>
        <PBtn variant="primary" size="sm" icon="check" disabled={code.length < 6} onClick={verify}>Confirm</PBtn>
      </>}
      {mode === 'link' && <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: P.inkDim, lineHeight: 1.4 }}>They tap the link and it confirms itself — nothing to read back.</span>}
    </div>

    {/* Send log — every attempt, who triggered it, and the carrier receipt.
        NO ATTEMPTS ⇒ NO LOG AND NO STATUS PILL. An empty log used to be
        impossible because one was manufactured; now "nothing has been sent"
        is a state of its own and says so, rather than wearing a green
        Delivered nobody earned. */}
    {log.length > 0 ?
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, overflow: 'hidden', marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>Send log</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: lastCol }}>
          <Icon name={lastMeta.icon} size={11} stroke={2.6} color={lastCol} />{lastMeta.label}</span>
      </div>
      {log.slice(0, 3).map((a, i) => {
        const m = SMS_STATE[a.status] || SMS_STATE.sent;
        const c = m.tone === 'good' ? P.good : m.tone === 'bad' ? P.bad : P.inkMute;
        return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: c, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink, flex: '0 0 auto' }}>{a.at}</span>
          {a.kind && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.inkDim, background: P.surface3, borderRadius: 4, padding: '1px 5px', flex: '0 0 auto' }}>{a.kind}</span>}
          <span style={{ fontSize: 11.5, color: P.inkDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.by}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: c, flex: '0 0 auto' }}>{m.label}</span>
          <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{a.receipt}</span>
        </div>;})}
    </div> :
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: P.surface, border: `1px dashed ${P.hairline2}`, borderRadius: P.r8, marginBottom: 9 }}>
      <Icon name="clock" size={12} color={P.inkMute} style={{ flex: '0 0 auto' }} />
      <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Nothing has been sent to this number yet — there is no send log and no carrier receipt to read.</span>
    </div>}

    {last.status === 'failed' &&
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, fontSize: 11.5, fontWeight: 600, color: P.bad }}>
        <Icon name="shield" size={12} color={P.bad} />Carrier rejected the number — check it is a mobile line before resending.
      </div>}

    {!compact && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 7, lineHeight: 1.45 }}>Sent automatically when a <b style={{ color: P.ink2 }}>delivery</b> order appears for an account with an ID on file but no confirmed phone. Walk-ins are never sent one. Resend only if it never landed — the code box is for reading it back over the phone.</div>}
  </div>;
};

// ── Remote ID capture ───────────────────────────────────────────────────────
// For customers who have NEVER walked in. We text them a link; they photograph
// their document and face with our ID-verification provider; a pass writes a T1
// document event on
// our side. It is a SUBSTITUTE for the counter scan, not an extra hoop — anyone
// whose ID we have already held never sees it.
const RID_STEPS = [
{ k: 'sent', label: 'Link sent', sub: 'SMS delivered to their phone' },
{ k: 'opened', label: 'Opened', sub: 'They tapped the link' },
{ k: 'submitted', label: 'Photos submitted', sub: 'Document + selfie uploaded' },
{ k: 'passed', label: 'Passed', sub: 'Document verified — ID on file' }];
const RID_META = {
  idle: { label: 'Not sent', tone: 'bad' },
  sent: { label: 'Waiting on them', tone: 'warn' },
  opened: { label: 'In progress', tone: 'warn' },
  submitted: { label: 'Under review', tone: 'info' },
  passed: { label: 'Verified', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  expired: { label: 'Link expired', tone: 'bad' }
};
window.RemoteIdPanel = function RemoteIdPanel({ phone, remoteId, onLog, onDoor, compact }) {
  const P = useP();
  const p0 = remoteId || {};
  const [status, setStatus] = React.useState(p0.status || 'idle');
  const [secs, setSecs] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const link = p0.link || 'hyprwlf.co/id/Q7m2';
  // Gating on p0.sentAt was already right — but the row it seeded still claimed
  // a carrier acknowledgement and its latency, neither of which the seed
  // carries. "We know it was sent" and "the carrier confirmed delivery in 1.2s"
  // are different claims; only the first one is in the data.
  const [log, setLog] = React.useState(p0.attempts && p0.attempts.length ? p0.attempts :
  p0.sentAt ? [{ at: p0.sentAt, by: (p0.by || 'System') + ' · SMS', status: 'sent', receipt: 'no carrier receipt recorded' }] : []);
  React.useEffect(() => {if (secs <= 0) return;const t = setTimeout(() => setSecs(secs - 1), 1000);return () => clearTimeout(t);}, [secs]);

  const meta = RID_META[status] || RID_META.idle;
  const tone = meta.tone === 'good' ? P.good : meta.tone === 'warn' ? P.warn : meta.tone === 'info' ? P.info : P.bad;
  const reached = (k) => {
    const order = ['sent', 'opened', 'submitted', 'passed'];
    const at = order.indexOf(status === 'failed' || status === 'expired' ? 'sent' : status);
    return at >= order.indexOf(k);
  };

  const send = () => {
    const first = status === 'idle';
    setSecs(30);setStatus('sent');
    setLog((l) => [{ at: 'Just now', by: 'Manisha Saini · manual', status: 'sent', receipt: 'awaiting carrier ack' }, ...l]);
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: `${first ? 'Sent' : 'Resent'} the remote ID-check link by SMS to ${phone}`, time: 'just now', icon: 'phone' });
    // Same fabrication as SmsVerifyPanel.resend, same removal. The seed was
    // fixed in round 1 and the runtime timer that re-wrote 'delivered · carrier
    // ack 0.8s' onto the row was left standing. No carrier is involved in this
    // build, so no carrier acknowledgement is ever written.
  };
  const copy = () => {setCopied(true);setTimeout(() => setCopied(false), 1600);
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: 'Copied the ID-check link to read out over the phone', time: 'just now', icon: 'link' });};
  const door = () => {onDoor && onDoor();
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: 'Deferred to a door scan — the driver will inspect the ID on delivery', time: 'just now', icon: 'scan' });};

  if (status === 'passed') return <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
    <Icon name="check-circle" size={16} stroke={2} color={P.good} />
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Remote ID check passed — ID on file</div>
      <div style={{ fontSize: 11.5, color: P.inkDim }}>Verified remotely {p0.at || ''}. Counts exactly like a counter scan — they will never be asked again.</div></div>
  </div>;

  const last = log[0];
  return <div style={{ padding: '11px 13px', background: status === 'failed' || status === 'expired' ? P.badSoft : P.infoSoft, border: `1px solid ${tone}55`, borderRadius: P.r10 }} data-hw="remote-id-panel">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
      <Icon name="scan" size={14} color={tone} />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: tone }}>Remote ID check</span>
      {IDV_VENDOR && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.ink2, background: P.surface3, borderRadius: 99, padding: '1px 7px' }}>{IDV_VENDOR}</span>}
      <span style={{ fontSize: 10, fontWeight: 700, color: tone, background: tone + '1f', borderRadius: 99, padding: '2px 8px' }}>{meta.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{phone}</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: P.surface, borderRadius: P.r8, marginBottom: 9 }}>
      <Icon name="mail" size={13} color={P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, fontFamily: P.fontMono, minWidth: 0 }}>
        “Hyperwolf: verify your ID to order for delivery — <b style={{ color: P.info }}>{link}</b>. Takes 2 minutes. Reply STOP to opt out.”
      </div>
    </div>

    {/* Where they are in the remote-check flow */}
    <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
      {RID_STEPS.map((s, i) => {const on = status !== 'idle' && reached(s.k);const isLast = i === RID_STEPS.length - 1;
        return <div key={s.k} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 15, height: 15, borderRadius: 99, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? tone : P.surface, border: `1.5px solid ${on ? tone : P.hairline3}` }}>{on && <Icon name="check" size={9} stroke={3.4} color={P.surface} />}</span>
            {!isLast && <span style={{ flex: 1, height: 1.5, background: on ? tone : P.hairline2 }} />}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: on ? P.ink : P.inkMute, lineHeight: 1.2, paddingRight: 6 }}>{s.label}</span>
          {!compact && <span style={{ fontSize: 10, color: P.inkMute, lineHeight: 1.3, paddingRight: 6 }}>{s.sub}</span>}
        </div>;})}
    </div>

    {(status === 'failed' || status === 'expired') &&
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 9, padding: '8px 10px', background: P.surface, borderRadius: P.r8, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>
        <Icon name="shield" size={13} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span>{status === 'expired' ? <>The link timed out before they finished. <b>Send a fresh one</b> — nothing they uploaded is lost.</> : <>The check could not match the document to the selfie. Send a new link, or have the driver scan the ID at the door.</>}</span>
      </div>}

    {/* Send log */}
    {log.length > 0 &&
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, overflow: 'hidden', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>Link sends</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: P.inkDim }}>{log.length} total</span>
        </div>
        {log.slice(0, 3).map((a, i) => {
        const m2 = SMS_STATE[a.status] || SMS_STATE.sent;
        const c = m2.tone === 'good' ? P.good : m2.tone === 'bad' ? P.bad : P.inkMute;
        return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: c, flex: '0 0 auto' }} />
            <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink, flex: '0 0 auto' }}>{a.at}</span>
            <span style={{ fontSize: 11.5, color: P.inkDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.by}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: c, flex: '0 0 auto' }}>{m2.label}</span>
            <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{a.receipt}</span>
          </div>;})}
      </div>}

    {/* Actions — always reachable */}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <PBtn variant="accent" size="sm" icon={secs > 0 ? 'clock' : 'phone'} disabled={secs > 0} onClick={send}>
        {secs > 0 ? `Resend in ${secs}s` : status === 'idle' ? 'Send ID check link by SMS' : 'Resend ID check link'}
      </PBtn>
      <PBtn variant="secondary" size="sm" icon={copied ? 'check' : 'link'} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</PBtn>
      <PBtn variant="ghost" size="sm" icon="scan" onClick={door}>Verify at the door instead</PBtn>
    </div>
    {!compact && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 7, lineHeight: 1.45 }}>
      The remote check is only for customers whose ID <b style={{ color: P.ink2 }}>nobody has ever held</b> — a pass writes the same document event as a counter scan, so they are never asked twice. A door scan clears them just as permanently and keeps the first order frictionless.
      {last ? <> Last sent {last.at.toLowerCase()} by {last.by.split(' · ')[0]}.</> : ' Nothing has been sent yet.'}
    </div>}
  </div>;
};

// ── Customer peek — open a profile from anywhere, without losing your place ─
window.CustomerPeek = function CustomerPeek({ member, contact, idv, onClose }) {
  const P = useP();
  const fmt = window.HW.fmt;
  const m = member || {};
  const name = m.name || contact && contact.name || 'Unknown customer';
  const rows = [
  ['Phone', m.phone || contact && contact.phone || '—', true],
  ['Email', m.email || contact && contact.email || 'Not provided', false],
  ['Customer type', m.type || '—', false],
  ['Group', m.group || '—', false]];

  const stats = [['Visits', m.visits != null ? m.visits : '—'], ['Points', m.points != null ? m.points.toLocaleString() : '—'], ['Wallet', m.wallet != null ? fmt.money(m.wallet) : '—']];
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(24,20,16,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: P.fontSans }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(430px,96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <Avatar name={name} size={42} crown={m.member} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{name}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{m.id ? 'Customer ' + m.id : 'Not yet a customer record'}</div>
          </div>
          <IconBtn icon="x" size={16} onClick={onClose} />
        </div>
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {idv && <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Verification</div>
            <window.IdentityLadder v={idv} compact /></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
            {stats.map(([k, v]) => <div key={k} style={{ padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, marginTop: 3 }}>{v}</div>
            </div>)}
          </div>
          <div style={{ background: P.surface2, borderRadius: P.r10, overflow: 'hidden' }}>
            {rows.map(([k, v, mono], i) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <span style={{ fontSize: 11.5, color: P.inkDim }}>{k}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
            </div>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '13px 18px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
          <PBtn variant="secondary" size="sm" icon="clock" full>Order history</PBtn>
          <PBtn variant="primary" size="sm" icon="user" full>Open in Members</PBtn>
        </div>
      </div>
    </div>, document.body);
};

// ── ID scan + photo (the in-store event that does the heavy lifting) ────────
//
// THIS IS A SIMULATED SCANNER AND IT SAYS SO ON SCREEN. No PDF417 reader is
// wired to this build. It exists so the flows that DEPEND on a scan — building
// a party, onboarding a first-timer, locating a returning customer — can be
// exercised end to end before the real module lands.
//
// WHY IT IS LABELLED RATHER THAN SILENT. The panel it replaces returned ONE
// hardcoded human on every scan (Jordan A. Vasquez, CA DL ••••4821, DOB
// 09/02/1988) with no indication it was invented, so a party of two was
// impossible and every "captured" ID was the same fabricated person wearing a
// green tick. A simulated capture presented as a real government-ID check is
// the one thing this screen must never do — the tick is a compliance claim.
// Simulated results carry `simulated: true` and every surface that renders a
// scan result shows the DEMO mark.
//
// The pool cycles rather than randomises, so repeated scans give DIFFERENT
// people in a repeatable order — which is what makes a party testable.
//
// THE POOL CARRIES SPLIT FIELDS BECAUSE A REAL DOCUMENT DOES.
// [OWNER RULING 2026-08-27 — see window.HWName at the top of this file]
// AAMVA PDF417 encodes family name, given name, street, city, jurisdiction and
// postal code as SEPARATE data elements (DCS, DAC, DAG, DAI, DAJ, DAK). The
// previous pool stored one joined `name` string, so the scan path handed the
// new-customer form something a real barcode never produces, and the form then
// had to guess the split back out on the way to a server whose ONLY name keys
// are `first_name` and `last_name` (wmdemo/server.py:4843). The guess was
// ours, start to finish — it was never in the document and never on the wire.
//
// The six people, their order and their joined spelling are UNCHANGED, so the
// cycling that makes a party testable still lands on the same person on the
// same scan. `name` below is DERIVED from first + last, not stored beside them:
// one source of truth, and no way for the two to drift apart.
// `addr` is likewise what the barcode carries, already split.
const DEMO_IDS = [
  { first: 'Marcus', last: 'Webb',        dob: '03/11/1994', type: 'CA DL',    num: '••••4821', expires: '2029-04-11', addr: { number: '1180', street: 'Grand Ave',      city: 'Corona',        state: 'CA', zip: '92879' } },
  { first: 'Priya',  last: 'Raman',       dob: '11/02/1991', type: 'CA DL',    num: '••••7730', expires: '2027-11-02', addr: { number: '415',  street: 'Diamond Dr',    city: 'Lake Elsinore', state: 'CA', zip: '92530' } },
  { first: 'Tomas',  last: 'Alvarez',     dob: '07/24/1988', type: 'Passport', num: '••••2264', expires: '2031-07-23', addr: { number: '',     street: '',              city: '',              state: '',   zip: '' } },
  { first: 'Ruth',   last: 'Okonjo',      dob: '01/09/1997', type: 'CA DL',    num: '••••5518', expires: '2028-01-09', addr: { number: '22',   street: 'Palomar St',    city: 'Wildomar',      state: 'CA', zip: '92595' } },
  { first: 'Danny',  last: 'Fitzgerald',  dob: '05/30/1985', type: 'NV DL',    num: '••••9012', expires: '2026-05-30', addr: { number: '3400', street: 'S Las Vegas Blvd', city: 'Las Vegas',   state: 'NV', zip: '89109' } },
  { first: 'Aiko',   last: 'Tanaka',      dob: '09/17/1999', type: 'Passport', num: '••••4407', expires: '2032-09-16', addr: { number: '',     street: '',              city: '',              state: '',   zip: '' } },
];
// A PASSPORT CARRIES NO ADDRESS. The two passport holders above have an empty
// address on purpose — that is a real property of the document, and inventing a
// street for them would be exactly the fabrication the DEMO mark exists to
// prevent. An empty address must render as "not recorded", never as a blank
// street the operator assumes they simply have not scrolled to.
let _demoIdx = 0;

window.IdScanPanel = function IdScanPanel({ value, onChange, onLog }) {
  const P = useP();
  const [st, setSt] = React.useState(value && value.scannedAt ? 'done' : 'idle'); // idle | scanning | done
  // Which path the next simulated scan takes. Explicit rather than random:
  // a demo you cannot steer is a demo you cannot test a specific flow on.
  // `mode` is gone with the toggle it drove. The simulator alternates
  // internally now (see scan()), so both the new and the returning path
  // still get exercised without asking the operator to classify a guest
  // the scan has not read yet.

  // A returning scan resolves to a REAL existing customer record, so the
  // "the barcode finds their account" path is genuinely exercised rather than
  // mimed. Falls back to the new-customer path when the book is empty, and
  // says so rather than inventing a match.
  // THE BOOK IS READ ON EVERY SCAN. `pickReturning` used to fetch the book
  // itself, and it was only called on the odd branch — so on the even path
  // (which includes the FIRST scan of every session) nothing consulted
  // anything, and `returning: false` was emitted anyway. Reading the book is
  // now the caller's job, done once, unconditionally; this only chooses WHICH
  // record to present.
  const pickReturning = (M) => M && M.length ? M[_demoIdx++ % M.length] : null;

  // THE SCAN DECIDES. It does not ask.
  //
  // This used to be steered by a "New customer / Returning" segmented control
  // sitting next to the Scan button, and that is backwards in the way that
  // matters: at a real counter nobody KNOWS whether the person is returning
  // until the barcode is read. Asking the operator to declare it first makes
  // them do the machine's job, and in the Add-member flow it was incoherent
  // as well -- you are adding a member, so "Returning" contradicts the screen
  // it is on.
  //
  // The steering existed for a good reason ("a demo you cannot steer is a demo
  // you cannot test a specific flow on") and that reason is preserved: the
  // simulator still alternates so BOTH paths get exercised. What changed is
  // that the alternation is now an implementation detail of the fake scanner
  // rather than a question put to the user.
  //
  // WHAT A REAL SCAN DOES, and what this now mimics: the PDF417 barcode yields
  // a name and date of birth. Those are matched against the customer book.
  // Match -> returning, and we say who. No match -> new, and the record is
  // pre-filled from the document. Either way the operator is TOLD, never asked.
  const scan = () => {
    setSt('scanning');
    setTimeout(() => {
      let doc;
      // THREE OUTCOMES, NOT TWO.
      // The comment above pickReturning claimed it "says so rather than
      // inventing a match" when the customer book is empty — but nothing said
      // so: a null lookup fell straight through to the new-customer branch and
      // emitted `returning:false`. "We consulted the book and this person is
      // not in it" and "we could not consult the book" rendered identically,
      // and the default was the one that looks like an answer. An operator told
      // "New customer" onboards, and a person who already has an account
      // collects a second profile — the exact failure checkin.jsx:53-54 says
      // this flow exists to stop.
      //
      // AND THE READ HAPPENS ON BOTH BRANCHES.
      // The three-state machinery above was real and correct, and it was
      // BYPASSED BY CONSTRUCTION on half of all scans: the book was consulted
      // only inside `if (_tryReturning)`, and `_demoIdx` starts at 0, so the
      // first scan of every session skipped the lookup entirely and still
      // emitted `returning: false` — "we consulted the book and this person is
      // not in it" — plus `lookup: 'ok'`. With MEMBERS unloaded, scanning the
      // SAME person twice gave "New customer · from the document" and then "the
      // customer book was NOT available", two contradictory sentences about one
      // unchanged state, and the answer-shaped one arrived first.
      //
      // The read is now unconditional and the READ decides. `_tryReturning`
      // keeps the job it can honestly do: which of two available demo
      // identities to present — never whether to perform a lookup.
      // A ZERO-ROW BOOK IS NOT A MISS EITHER. `MEMBERS` missing and `MEMBERS`
      // empty are indistinguishable at a counter — a dispensary customer book
      // is never legitimately empty, so zero rows means it did not load, not
      // that this person is a first-timer. Both are 'unavailable'.
      const M = window.HW && window.HW.MEMBERS || null;
      let lookup = M == null || M.length === 0 ? 'unavailable' : 'ok';
      const _tryReturning = (_demoIdx % 2) === 1;   // alternate, so both paths run
      if (lookup === 'ok' && _tryReturning) {
        const m = pickReturning(M);
        if (m) {
          // THE RETURNING BRANCH IS THE ONE PLACE THAT STILL HAS TO GUESS, AND
          // IT SAYS SO. `window.HW.MEMBERS` rows carry a joined `name` and
          // nothing else (pos/data.jsx:86 — no first/last, no address), so the
          // split here is derived, not read. `nameGuessed` travels WITH the
          // document so every downstream surface can mark the two fields as a
          // guess instead of presenting them as something the barcode said.
          // When MEMBERS grows real first/last columns this branch stops
          // guessing on its own and `nameGuessed` goes false — no other file
          // has to change.
          const g = m.first_name || m.last_name
            ? { first: m.first_name || '', last: m.last_name || '', guessed: false, note: '' }
            : splitNameGuess(m.name);
          doc = { type: 'CA DL', num: '••••' + String(1000 + (_demoIdx * 37) % 9000), expires: '2029-04-11',
                  scannedAt: 'Just now', by: 'Manisha Saini', where: 'Front Counter 1', photo: true,
                  firstName: g.first, lastName: g.last,
                  nameGuessed: !!g.guessed, nameGuessNote: g.note || '',
                  // Kept as a DERIVED convenience for surfaces that only ever
                  // display a name. It is not the source of truth and must
                  // never be the thing that gets stored or fingerprinted.
                  name: joinName(g.first, g.last) || m.name,
                  // The customer book holds no address, and an absent address
                  // is not an empty one. `null` so it renders as "not recorded".
                  address: null,
                  dob: m.dob || '', memberId: m.id, returning: true, lookup: 'ok', simulated: true };
        }
      }
      if (!doc) {
        const d = DEMO_IDS[_demoIdx++ % DEMO_IDS.length];
        const hasAddr = !!(d.addr && (d.addr.number || d.addr.street || d.addr.city || d.addr.zip));
        doc = { type: d.type, num: d.num, expires: d.expires, scannedAt: 'Just now',
                by: 'Manisha Saini', where: 'Front Counter 1', photo: true,
                // READ OFF THE DOCUMENT, SPLIT, WITH NO GUESS ANYWHERE. This is
                // the whole point of the ruling: the fields arrive separate, so
                // nothing has to infer where one name ends and the next begins.
                firstName: d.first, lastName: d.last, nameGuessed: false, nameGuessNote: '',
                name: joinName(d.first, d.last),      // derived, display only
                // A passport has no address. null, not an empty shape.
                // SPLIT IS THE SOURCE OF TRUTH; `street` IS DERIVED FROM IT.
                // pos/screen-stubs.jsx:367 renders `idAddr.street` as one line
                // and does not belong to this workstream, so the joined key
                // stays and keeps meaning what it always meant. Adding the
                // split keys beside it migrates the producer without stranding
                // a consumer on a shape that changed under it.
                address: hasAddr ? { streetNumber: d.addr.number, streetName: d.addr.street,
                                     street: joinStreet(d.addr.number, d.addr.street),
                                     city: d.addr.city, state: d.addr.state, zip: d.addr.zip,
                                     guessed: false } : null,
                dob: d.dob,
                // `returning: null` is NOT `false`. Null means unknown, and the
                // result card gives it its own neutral face.
                returning: lookup === 'unavailable' ? null : false, lookup, simulated: true };
      }
      setSt('done');
      onChange && onChange(doc);
      onLog && onLog({ who: 'Manisha Saini', role: 'You',
        action: 'SIMULATED ID scan · ' + doc.type + ' ' + doc.num + (
          doc.returning ? ' · matched an existing customer' :
          doc.lookup === 'unavailable' ? ' · customer book unavailable, match not determined' :
          ' · new customer'),
        time: 'just now', icon: 'scan' });
    }, 700);
  };

  // Re-scan discards the document EVERYWHERE, not just in this panel's own
  // state. The caller holds it (nf.doc); leaving it there is how a new name
  // ends up wearing an old person's ID under a green compliance tick.
  const rescan = () => { setSt('idle'); onChange && onChange(null); };

  const DemoMark = () =>
    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', color: P.warn,
      background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: 4, padding: '1px 5px', flex: '0 0 auto' }}>DEMO</span>;

  if (st === 'done') {
    const d = (value && value.scannedAt) ? value : null;
    if (!d) {
      // We were told a scan finished but handed nothing to show. Say that,
      // rather than redrawing the old panel's hardcoded card as if it were read.
      return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10 }}>
        <Icon name="alert" size={15} color={P.inkMute} />
        <span style={{ flex: 1, fontSize: 11.5, color: P.ink2 }}>A scan completed but no document reached this panel — nothing is recorded.</span>
        <PBtn variant="ghost" size="xs" icon="refresh" onClick={rescan}>Scan again</PBtn>
      </div>;
    }
    // THREE FACES, matching the three outcomes of the lookup.
    //   returning === true   → an account was found, and we name it
    //   returning === false  → the book was read and this person is not in it
    //   returning == null    → the book could NOT be read. Neutral, and it says
    //                          so, because "not in the book" and "no book" are
    //                          different facts and only one of them licenses
    //                          onboarding a new record.
    // A FOURTH FACE: THE DOCUMENT IS EXPIRED.
    // The card had three (returning / new / unknown) and an expired licence
    // wore whichever one the lookup produced, differing from a valid document
    // only by a date string in dim mono that nobody is asked to read. It is the
    // one compliance claim in this product a regulator would ask about, and the
    // honest branch costs a date comparison.
    const expired = window.HWExpiry ? window.HWExpiry.isExpiredDoc(d) : false;
    // WHAT THE LAPSE COSTS IS THE OWNER'S SWITCH, NOT THIS CARD'S OPINION.
    // "it cannot clear a check-in" is a claim about CONSEQUENCE, and with
    // enforcement off it is simply untrue — the gate allows this person. The
    // detection stays unconditional (red, named, dated, either way); only the
    // sentence about what happens next reads the switch. Absent switch is its
    // own sentence again: not "blocked" and not "allowed".
    const enf = window.HWV ? window.HWV.expiryEnforced(null) : null;
    const lapseCost = enf === true
      ? ' — it cannot clear a check-in. Ask for a current ID.'
      : enf === false
        ? ' — expiry enforcement is OFF, so this will still clear a check-in today. Ask for a current ID anyway: turning enforcement on stops them.'
        : ' — and nothing has told this screen whether expiry is enforced here, so whether it clears a check-in is UNKNOWN from this card. Ask for a current ID.';
    const unknownMatch = d.returning == null;
    const tone = expired ? P.bad : d.returning ? P.good : unknownMatch ? P.warn : P.info;
    const toneSoft = expired ? P.badSoft : d.returning ? P.goodSoft : unknownMatch ? P.warnSoft : P.infoSoft;
    return <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: toneSoft, border: `1px solid ${tone}44`, borderRadius: P.r10 }}>
      <span style={{ width: 44, height: 30, borderRadius: 5, background: P.surface, border: `1px solid ${tone}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icon name={expired ? 'x' : d.returning ? 'user-check' : unknownMatch ? 'alert' : 'user-plus'} size={15} color={tone} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
          {d.name || 'Name not read'}{d.simulated && <DemoMark />}
        </div>
        <div style={{ fontSize: 11.5, color: expired ? P.bad : P.inkDim, fontFamily: P.fontMono }}>
          {expired ? `This document EXPIRED on ${d.expires}${lapseCost}` :
           d.returning ? 'Existing customer · account found' :
           unknownMatch ? 'Document read · the customer book was NOT available, so we do not know whether they already have an account' :
           'New customer · from the document'}{expired ? '' : ` · ${d.type} ${d.num} · expires ${d.expires}`}
        </div>
        {expired && <div style={{ fontSize: 11.5, color: P.ink2, fontFamily: P.fontSans, marginTop: 2, lineHeight: 1.45 }}>{d.type} {d.num}{d.returning ? ' · this IS an existing customer — the account and its history are kept, only the document has to be replaced.' : ''}</div>}
      </div>
      {/* Re-scan clears the document UPWARD as well as locally. It used to call
          setSt('idle') alone, so the caller's nf.doc still held the previous
          person's document: scan Marcus Webb, press Re-scan, type another name
          over the top, and 'Add to party' — gated on !nf.doc, still truthy —
          committed a different human under a green "ID captured" pill. A
          fabricated identity under a compliance tick is the one thing this flow
          must never do. */}
      <PBtn variant="ghost" size="xs" icon="refresh" onClick={rescan}>Re-scan</PBtn>
    </div>;
  }

  return <div style={{ padding: '13px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10, textAlign: 'center' }}>
    <Icon name="scan" size={22} color={P.inkMute} />
    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {st === 'scanning' ? 'Reading barcode…' : 'Scan the guest’s ID or passport'}<DemoMark />
    </div>
    <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>
      No scanner is wired to this build. This simulates the read so the flows that depend on it can be tested — a real barcode supplies name, date of birth and expiry. The scan decides whether this is a new or a returning guest; you are not asked.
    </div>
    <div style={{ marginTop: 9, display: 'flex', gap: 7, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
      <PBtn variant="accent" size="sm" icon="scan" disabled={st === 'scanning'} onClick={scan}>{st === 'scanning' ? 'Scanning…' : 'Scan ID'}</PBtn>
    </div>
    {/* [owner requirement 2026-09-03, called out here for whoever wires the
        real reader]: a USB/Bluetooth barcode scanner acts like a keyboard —
        it must be captured with a GLOBAL keydown listener (see PriceCheck's
        F2/⌘K listener in customer-extras.jsx for the existing pattern this
        codebase uses for that), so a scan works from anywhere on screen the
        instant a check-in-capable screen is open. It must NOT require
        clicking this "Scan ID" button first — the button is a manual
        fallback, not the only path in. Not implemented yet: there is no real
        reader to test a global listener against, so building one now would
        be unverifiable, untested plumbing. */}
    <div style={{ marginTop: 8, fontSize: 10.5, color: P.warn, lineHeight: 1.4 }}>
      DEV: the real scanner must work from anywhere on screen, not only via this button — see the comment above this line.
    </div>
  </div>;
};

// ── The policy, stated once, where people will actually read it ─────────────
window.VerifyPolicyCard = function VerifyPolicyCard({ tight }) {
  const P = useP();
  const rows = [
  { i: 'shop', t: 'Walked in first', d: 'Counter scans the ID and photographs it. That alone clears them to shop in store — no SMS, no app, nothing else. If they later want delivery, one SMS code binds their phone and they are never asked again.' },
  { i: 'truck', t: 'Never walked in', d: 'Two options, their choice: a remote ID-check link before the first order, or nothing at all — the driver scans their ID at the door on delivery one, which upgrades the account for every order after it.' },
  { i: 'phone', t: 'The SMS is a delivery gate, not a door policy', d: 'It is only ever sent for a delivery order. A walk-in buying at the counter never receives one — the person is standing there with the document.' },
  { i: 'shield', t: 'The remote check is a substitute, not an extra', d: 'It only runs when no human has ever held the document. A scanned-in-store customer never sees it.' }];

  return <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="shield" size={14} color={P.ink2} />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.ink2 }}>Verify once — never twice</span>
    </div>
    <div style={{ padding: tight ? '10px 13px' : '13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map((r) => <div key={r.t} style={{ display: 'flex', gap: 10 }}>
        <Icon name={r.i} size={15} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{r.t}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5, marginTop: 1 }}>{r.d}</div></div>
      </div>)}
    </div>
  </div>;
};