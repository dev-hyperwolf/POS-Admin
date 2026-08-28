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

window.GuestEditor = function GuestEditor({ primaryName, guests, onChange }) {
  const P = useP();
  const list = (guests || []).map(normGuest);
  const [q, setQ] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [nf, setNf] = React.useState({ name: '', dob: '', phone: '', doc: null });
  const setNf1 = (k, v) => setNf((p) => ({ ...p, [k]: v }));

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
  const linkMember = (m) => {push({ key: m.id, id: m.id, name: m.name, dob: '', phone: m.phone, member: m.member, doc: docOnFileFor(m.id) });setQ('');};
  const startNew = (seed) => {setNf({ name: seed || q.trim(), dob: '', phone: '', doc: null });setAdding(true);setQ('');};
  const commitNew = () => {
    if (!nf.doc) return;
    push({ key: 'new-' + Date.now(), id: null, name: nf.name.trim(), dob: nf.dob, phone: nf.phone, member: false, doc: nf.doc });
    setNf({ name: '', dob: '', phone: '', doc: null });setAdding(false);
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
      if (m) { linkMember(m); setAdding(false); setNf({ name: '', dob: '', phone: '', doc: null }); return; }
      setUnresolved({ memberId: d.memberId, doc: d });
      setNf({ name: '', dob: '', phone: '', doc: null });
      return;
    }
    setNf((p) => ({ ...p, doc: d, name: d && d.name || '', dob: d && d.dob || '' }));
  };
  // Create the record anyway — an explicit choice, never a default.
  const forceNewFromUnresolved = () => {
    const d = unresolved && unresolved.doc;
    setUnresolved(null);
    setNf({ name: d && d.name || '', dob: d && d.dob || '', phone: '', doc: d || null });
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
            <PBtn variant="accent" size="xs" onClick={() => startNew(q.trim())}>Start</PBtn>
          </div>}
        {!ql && poolNames.length > 0 &&
        <div style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Already in the waiting room</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {poolNames.map((n) => {
              const m = window.HW.MEMBERS.find((x) => x.name === n);
              return <button key={n} type="button" onClick={() => m ? linkMember(m) : startNew(n)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, fontSize: 12.5, fontWeight: 600, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <CIField label="Full name · from ID" value={nf.name} onChange={(v) => setNf1('name', v)} />
              <CIField label="Date of birth · from ID" value={nf.dob} onChange={(v) => setNf1('dob', v)} placeholder="MM/DD/YYYY" mono />
            </div>
            <CIField label="Phone (optional)" value={nf.phone} onChange={(v) => setNf1('phone', v)} placeholder="(000) 000-0000" mono />
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
  const [nf, setNf] = React.useState({ name: '', phone: '', email: '', dob: '', gender: '', street: '', city: '', state: 'CA', zip: '', doc: null, fromScan: {} });
  const setNf1 = (k, v) => setNf((p) => ({ ...p, [k]: v,
    // A field typed over after the scan is no longer "from ID". The suffix is a
    // legal claim about where the value came from, so it has to be withdrawn
    // the moment a human edits it.
    fromScan: Object.assign({}, p.fromScan, { [k]: false }) }));
  // Seeding a customer is the ONE place type/delivery come from the record.
  const adoptCustomer = (c) => {
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
    if (!d) {setNf((p) => Object.assign({}, p, { doc: null, name: '', dob: '', fromScan: {} }));setUnresolved(null);return;}
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
    setNf((prev) => Object.assign({}, prev, {
      name: d.name || prev.name,
      dob: d.dob || prev.dob,
      doc: d,
      // Which fields the DOCUMENT filled. Document-backed and hand-typed are
      // different legal claims and must not render as the same grey box.
      fromScan: Object.assign({}, prev.fromScan, { name: !!d.name, dob: !!d.dob }),
    }));
    setNewOpen(true);
  };
  // The scanner offered INSIDE an already-selected customer's card. What comes
  // back is a document about a PERSON; it only belongs on this record if it is
  // that person's. Compare before binding.
  const onPrimaryScan = (d) => {
    setDocMismatch(null);
    if (!d) {setCustomer((c) => c ? Object.assign({}, c, { doc: null }) : c);return;}
    const c = customer;
    if (!c) return;
    const wrongMember = !!(d.memberId && c.id && c.id !== 'new' && d.memberId !== c.id);
    const wrongName = !!(d.name && c.name && !sameName(d.name, c.name));
    if (wrongMember || wrongName) {setDocMismatch({ doc: d });return;}
    setCustomer(Object.assign({}, c, { doc: d }));
  };
  const attachAnyway = () => {
    const d = docMismatch && docMismatch.doc;
    setDocMismatch(null);
    if (d) setCustomer((c) => c ? Object.assign({}, c, { doc: d }) : c);
  };
  // Create the record anyway, as an explicit choice the operator makes.
  const forceNewFromUnresolved = () => {
    const d = unresolved && unresolved.doc;
    setUnresolved(null);
    setNf((p) => Object.assign({}, p, { name: d && d.name || '', dob: d && d.dob || '', doc: d || null,
      fromScan: { name: !!(d && d.name), dob: !!(d && d.dob) } }));
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
    if (!nf.name.trim() || !nf.doc || expiryBlocks(nf.doc, null)) return;
    setCustomer({ id: 'new', name: nf.name.trim(), email: nf.email || '—', phone: nf.phone || '—', points: 0,
      type: type || 'AdultUse', member: false, gender: nf.gender,
      // `nf` was being dumped wholesale into `address`, which is how the
      // scanned document ended up as a stowaway at customer.address.doc where
      // nothing reads it. Address is an address; the document is the document.
      address: { street: nf.street, city: nf.city, state: nf.state, zip: nf.zip },
      dob: nf.dob,
      doc: nf.doc });
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
                <PBtn variant="ghost" size="sm" icon="pencil" onClick={() => {setCustomer(null);setTypeFrom(null);setDeliveryFrom(null);}}>Change</PBtn>
              </div>
              {/* THE REFUSAL THAT DID NOT HAPPEN. Without this the card shows
                  a document on file for somebody the gate refuses the moment
                  the owner's switch is turned on, and the population that
                  switch would block is the thing a default-OFF toggle exists to
                  let you COUNT before you turn it on. */}
              {primaryScanLapsedSoft &&
              <div data-hw="soft-lapse-primary" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                <Icon name="alert" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                  <b>The ID scanned for this customer EXPIRED on {primaryScan.expires}.</b> WOULD HAVE BEEN REFUSED — expiry enforcement is OFF, so this check-in is allowed and the refusal is recorded instead of applied. Ask for a current ID anyway: turn enforcement on and this customer stops clearing.
                </span>
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
                {docMismatch &&
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="shield" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This document is not this customer’s. The barcode reads <b style={{ fontFamily: P.fontMono }}>{docMismatch.doc.name || 'no name'}</b>{docMismatch.doc.memberId ? <> (customer <b style={{ fontFamily: P.fontMono }}>{docMismatch.doc.memberId}</b>)</> : null}, and the record selected here is <b style={{ fontFamily: P.fontMono }}>{customer.name}</b>{customer.id && customer.id !== 'new' ? <> (<b style={{ fontFamily: P.fontMono }}>{customer.id}</b>)</> : null}. Attaching it would put one person's ID under another person's name.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PBtn variant="accent" size="xs" icon="user" onClick={() => {setDocMismatch(null);setCustomer(null);setTypeFrom(null);setDeliveryFrom(null);}}>Pick the right customer</PBtn>
                    <PBtn variant="secondary" size="xs" icon="refresh" onClick={() => setDocMismatch(null)}>Scan again</PBtn>
                    <div style={{ flex: 1 }} />
                    <PBtn variant="ghost" size="xs" onClick={attachAnyway}>Attach to {customer.name} anyway</PBtn>
                  </div>
                </div>}
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
                    </div>
                    {/* '· from ID' is a claim about PROVENANCE. GuestEditor
                        labels these two fields that way and this form did not,
                        so a value read off a government document and a value a
                        colleague typed rendered as the same grey box. The
                        suffix is withdrawn the moment the field is edited —
                        see setNf1. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <CIField label={nf.fromScan && nf.fromScan.name ? 'Full name · from ID' : 'Full name'} value={nf.name} onChange={(v) => setNf1('name', v)} />
                      <CIField label={nf.fromScan && nf.fromScan.dob ? 'Date of birth · from ID' : 'Date of birth'} value={nf.dob} onChange={(v) => setNf1('dob', v)} placeholder="MM/DD/YYYY" mono />
                      <CIField label="Phone" value={nf.phone} onChange={(v) => setNf1('phone', v)} placeholder="(000) 000-0000" mono />
                      <CIField label="Email" value={nf.email} onChange={(v) => setNf1('email', v)} placeholder="name@email.com" />
                    </div>
                    {/* Gender (comment 2) */}
                    <div>
                      <CILabel>Gender</CILabel>
                      <Seg value={nf.gender} onChange={(v) => setNf1('gender', v)} size="sm" options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }, { value: 'Non-binary', label: 'Non-binary' }]} />
                    </div>
                    {/* Address — separate fields for clean data (comment 1) */}
                    <div>
                      <CILabel>Address</CILabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <CIField value={nf.street} onChange={(v) => setNf1('street', v)} placeholder="Street address" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr .8fr', gap: 8 }}>
                          <CIField value={nf.city} onChange={(v) => setNf1('city', v)} placeholder="City" />
                          <CIField value={nf.state} onChange={(v) => setNf1('state', v)} placeholder="State" mono />
                          <CIField value={nf.zip} onChange={(v) => setNf1('zip', v)} placeholder="ZIP" mono />
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
                      <span style={{ flex: 1, fontSize: 11.5, color: nfDocExpired ? P.bad : !nf.doc || !nf.name.trim() ? P.warn : P.inkDim, lineHeight: 1.4 }}>{
                        !nf.doc ? 'Scan the ID first — a name on its own is not enough for the buyer either.' :
                        nfDocExpired ? (
                          nfEnforced === true ? `That document EXPIRED on ${nf.doc.expires}. Expiry enforcement is ON, so an expired ID cannot start a customer at ID-on-file — ask for a current one and re-scan.` :
                          nfEnforced === false ? `That document EXPIRED on ${nf.doc.expires}. WOULD HAVE BEEN REFUSED — expiry enforcement is OFF, so this customer can still be created and the refusal is recorded instead of applied. Ask for a current ID anyway: turn enforcement on and they stop clearing.` :
                          `That document EXPIRED on ${nf.doc.expires}. Whether expiry is enforced here is UNKNOWN — nothing published the switch to this screen, so it is refusing on the strict reading rather than guessing. Ask for a current one and re-scan.`
                        ) :
                        !nf.name.trim() ? 'The document produced no name. Type the legal name to continue.' :
                        'Document captured · this customer starts at ID-on-file.'
                      }</span>
                      <PBtn variant="secondary" size="sm" onClick={() => setNewOpen(false)}>Cancel</PBtn>
                      <PBtn variant="accent" size="sm" icon="check" disabled={!nf.name.trim() || !nf.doc || nfDocBlocks} onClick={createNew}>Create customer</PBtn>
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
                    <PBtn variant="ghost" size="xs" onClick={() => setNewOpen(true)}>Enter manually</PBtn>
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