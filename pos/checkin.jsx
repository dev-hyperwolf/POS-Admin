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
const guestStatus = (g) => g.id ? 'linked' : g.doc ? 'captured' : 'incomplete';
window.guestName = gName;
window.guestIncomplete = (list) => (list || []).map(normGuest).filter((g) => guestStatus(g) === 'incomplete').length;

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

  const linkMember = (m) => {push({ key: m.id, id: m.id, name: m.name, dob: '', phone: m.phone, member: m.member, doc: { onFile: true } });setQ('');};
  const startNew = (seed) => {setNf({ name: seed || q.trim(), dob: '', phone: '', doc: null });setAdding(true);setQ('');};
  const commitNew = () => {
    if (!nf.doc) return;
    push({ key: 'new-' + Date.now(), id: null, name: nf.name.trim(), dob: nf.dob, phone: nf.phone, member: false, doc: nf.doc });
    setNf({ name: '', dob: '', phone: '', doc: null });setAdding(false);
  };
  // Scanning the ID IS the data entry — the PDF417 barcode carries the legal
  // name, DOB and expiry, so nobody retypes them. Phone is the only thing a
  // human might add, and it is optional.
  const onScan = (d) => setNf((p) => ({ ...p, doc: d, name: d && d.name || p.name || 'Jordan A. Vasquez', dob: d && d.dob || p.dob || '09/02/1988' }));
  const bad = list.filter((g) => guestStatus(g) === 'incomplete').length;

  const StatusPill = ({ g }) => {
    const s = guestStatus(g);
    if (s === 'linked') return <Pill kind="good" dot>Existing customer</Pill>;
    if (s === 'captured') return <Pill kind="good" dot>ID captured</Pill>;
    return <Pill kind="bad" dot>Needs ID</Pill>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Eyebrow>Party &amp; guests</Eyebrow>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{list.length} guest{list.length === 1 ? '' : 's'}</span>
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
                  <span style={{ display: 'block', fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.type}</span>
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
              return <button key={n} type="button" onClick={() => m ? linkMember(m) : startNew(n)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, fontSize: 12, fontWeight: 600, color: P.ink2, cursor: 'pointer', fontFamily: P.fontSans }}>
                  <Icon name="plus" size={12} stroke={2.2} />{n}{!m && <span style={{ fontSize: 9.5, color: P.warn, fontWeight: 700 }}>new</span>}
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
          {nf.doc ? <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <CIField label="Full name · from ID" value={nf.name} onChange={(v) => setNf1('name', v)} />
              <CIField label="Date of birth · from ID" value={nf.dob} onChange={(v) => setNf1('dob', v)} placeholder="MM/DD/YYYY" mono />
            </div>
            <CIField label="Phone (optional)" value={nf.phone} onChange={(v) => setNf1('phone', v)} placeholder="(000) 000-0000" mono />
          </> :
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="scan" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Scan the ID and the name, date of birth and expiry fill themselves from the barcode. <b>Phone is the only thing you may need to add — and it is optional.</b></span>
          </div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, color: P.inkMute, lineHeight: 1.4, flex: 1 }}>Adding a phone lets them order delivery later without ever verifying again.</span>
            <PBtn variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancel</PBtn>
            <PBtn variant="accent" size="sm" icon="check" disabled={!nf.doc} onClick={commitNew}>Add to party</PBtn>
          </div>
        </div>}

      {/* The party */}
      {list.length > 0 &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((g, i) =>
        <div key={gKey(g, i)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', background: P.surface2, border: `1px solid ${guestStatus(g) === 'incomplete' ? P.bad : P.hairline}`, borderRadius: P.r10 }}>
              <Avatar name={gName(g)} size={26} crown={g.member} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gName(g)}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{g.id ? 'Existing customer' : g.dob ? 'DOB ' + g.dob : 'No details captured'}{g.phone ? ' · ' + g.phone : ''}</span>
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
          <span style={{ fontSize: 11.5, color: P.ink2 }}><b>{bad} guest{bad > 1 ? 's' : ''} without an ID.</b> Check-in is blocked until every person is on record.</span>
        </div>}
      {list.length > 0 && primaryName && bad === 0 &&
      <div style={{ fontSize: 11, color: P.inkDim, marginTop: 9, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="info" size={12} color={P.inkMute} />Sale stays on <b style={{ color: P.ink2 }}>{primaryName.split(' ')[0]}</b> · {list.length} guest{list.length > 1 ? 's' : ''} on record, tracked as referrals
        </div>}
    </div>);

};

// New check-in flow. Captures primary customer + party at the start of the visit.
function CILabel({ children }) {
  const P = useP();
  return <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>{children}</div>;
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
  const [type, setType] = React.useState('AdultUse');
  const [delivery, setDelivery] = React.useState('Pick-up');
  const [guests, setGuests] = React.useState([]);
  const [newOpen, setNewOpen] = React.useState(false);
  const [nf, setNf] = React.useState({ name: '', phone: '', email: '', dob: '', gender: '', street: '', city: '', state: 'CA', zip: '' });
  const setNf1 = (k, v) => setNf((p) => ({ ...p, [k]: v }));
  const createNew = () => {
    if (!nf.name.trim()) return;
    setCustomer({ id: 'new', name: nf.name.trim(), email: nf.email || '—', phone: nf.phone || '—', points: 0, type, member: false, gender: nf.gender, address: nf });
    setNewOpen(false);
  };

  const results = window.HW.MEMBERS.filter((m) => !q || (m.name + m.email + m.phone).toLowerCase().includes(q.toLowerCase()));

  const submit = (start) => onCheckIn && onCheckIn({ customer, guests, type, delivery, start });
  const blocked = window.guestIncomplete ? window.guestIncomplete(guests) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', animation: 'fade .15s ease', overflowY: 'auto' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, overflow: 'hidden', border: `1px solid ${P.hairline2}` }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-check" size={16} stroke={2} color={P.accentInk} /></span>
            <div><div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>New check-in</div><div style={{ fontSize: 11, color: P.inkDim }}>Start of visit · add the guest &amp; their party</div></div>
          </div>
          <IconBtn icon="x" size={17} onClick={onClose} />
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1 — primary customer */}
          <div>
            <Eyebrow style={{ marginBottom: 9 }}>Customer</Eyebrow>
            {customer ?
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.accentBorder}`, borderRadius: P.r12 }}>
                <Avatar name={customer.name} size={36} crown={customer.member} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{customer.name}</div>
                  <div style={{ fontSize: 11, color: P.inkDim, fontFamily: P.fontMono }}>{customer.points} pts · {customer.email}</div>
                </div>
                <PBtn variant="ghost" size="sm" icon="pencil" onClick={() => setCustomer(null)}>Change</PBtn>
              </div> :

            <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
                  <Field icon="search" placeholder="Search by name, e-mail or phone" value={q} onChange={(e) => setQ(e.target.value)} size="md" />
                  <PBtn variant={newOpen ? 'accent' : 'soft'} size="md" icon="user-plus" onClick={() => setNewOpen((o) => !o)}>New</PBtn>
                </div>
                {newOpen ?
              <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, background: P.surface2, padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="user-plus" size={14} stroke={1.9} color={P.ink2} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>New customer</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <CIField label="Full name" value={nf.name} onChange={(v) => setNf1('name', v)} />
                      <CIField label="Date of birth" value={nf.dob} onChange={(v) => setNf1('dob', v)} placeholder="MM/DD/YYYY" mono />
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <PBtn variant="secondary" size="sm" onClick={() => setNewOpen(false)}>Cancel</PBtn>
                      <PBtn variant="accent" size="sm" icon="check" disabled={!nf.name.trim()} onClick={createNew}>Create customer</PBtn>
                    </div>
                  </div> :
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 168, overflowY: 'auto' }}>
                  {results.map((m) =>
                <button key={m.id} onClick={() => setCustomer(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                      <Avatar name={m.name} size={30} crown={m.member} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{m.name}</div>
                        <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{m.phone} · {m.type}</div>
                      </div>
                      <Icon name="chevron-right" size={15} color={P.inkFaint} />
                    </button>
                )}
                </div>}
              </>}
          </div>

          {/* Step 2 — visit details */}
          {customer &&
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <div><Eyebrow style={{ marginBottom: 8 }}>Customer type</Eyebrow><Seg value={type} onChange={setType} size="sm" options={[{ value: 'AdultUse', label: 'Adult Use' }, { value: 'MedicinalUser', label: 'Medicinal' }]} /></div>
              <div><Eyebrow style={{ marginBottom: 8 }}>Method</Eyebrow><Seg value={delivery} onChange={setDelivery} size="sm" options={[{ value: 'Pick-up', label: 'Pick-up', icon: 'shop' }, { value: 'Delivery', label: 'Delivery', icon: 'truck' }]} /></div>
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
          <span style={{ fontSize: 11.5, color: blocked ? P.bad : P.inkDim, fontFamily: P.fontMono }}>{customer ? blocked ? blocked + ' guest' + (blocked > 1 ? 's' : '') + ' need ID' : 1 + guests.length + ' in party' : 'Select a customer'}</span>
          <div style={{ flex: 1 }} />
          <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="soft" size="md" icon="user-check" disabled={!customer || !!blocked} onClick={() => submit(false)}>Check in</PBtn>
          <PBtn variant="accent" size="md" icon="arrow-right" disabled={!customer || !!blocked} onClick={() => submit(true)}>Check in &amp; start sale</PBtn>
        </div>
      </div>
    </div>);

};

Object.assign(window, {});