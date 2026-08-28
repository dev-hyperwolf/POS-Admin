// ── Customer & catalog extras ───────────────────────────────────────────────
// Hot notes, the delivery address book, the member-side verification card, the
// global price check, and the full order view opened from order history.
const useP = window.useP;
const _money = (n) => window.HW.fmt.money(n);

// ── Hot notes ───────────────────────────────────────────────────────────────
// A hot note is NOT a normal note. It is a safety / behaviour flag that must be
// read BEFORE anyone serves this customer — violent or abusive at the door,
// suspected diversion, or a complaint against a named employee who must not be
// assigned to them again. They are pinned at the top of the profile, never
// behind a click, and they are the same object dispatch writes from a cancel.
const HOT_KINDS = {
  safety: { label: 'Safety', icon: 'shield', tone: 'bad', blurb: 'Violent, threatening or abusive. Two-person rule.' },
  conduct: { label: 'Conduct', icon: 'flag', tone: 'bad', blurb: 'Rude or abusive to staff.' },
  staff: { label: 'Staff conflict', icon: 'user-off', tone: 'warn', blurb: 'Complained about a specific employee — do not assign.' },
  fraud: { label: 'Suspicious', icon: 'eye-off', tone: 'warn', blurb: 'Chargebacks, ID concerns, suspected diversion.' },
  service: { label: 'Service', icon: 'note', tone: 'info', blurb: 'Handle-with-care history — not a warning.' }
};
// Seeded per member so the demo shows the real states. Deterministic.
const HOT_SEED = {
  m2: [{ kind: 'staff', text: 'Complained about Devon Pierce (Jun 2). Do not assign Devon to this customer — reassign at check-in.', by: 'Manisha Saini', at: 'Jun 2, 2026', block: 'Devon Pierce' }],
  m4: [
  { kind: 'safety', text: 'Aggressive at the door on a delivery — shouted at the driver and blocked the vehicle. Two-person rule for any future delivery.', by: 'Dispatch · auto from cancel', at: 'Jun 9, 2026' },
  { kind: 'fraud', text: 'Two chargebacks in 60 days. Card sales require manager approval.', by: 'Carla Mendes', at: 'May 30, 2026' }],
  m5: [{ kind: 'service', text: 'Deaf — please text on arrival rather than knocking. Prefers contactless hand-off.', by: 'Priya Nair', at: 'Apr 18, 2026' }]
};
function hotNotesFor(id) {return (HOT_SEED[id] || []).slice();}

// Plain internal notes. A hot note is a banner; a plain note is history — and
// history that is thrown away the moment it is written is not history. Kept per
// member here so it survives leaving the profile and coming back.
const NOTE_LOG = {};
function notesFor(id) {return (NOTE_LOG[id] || []).slice();}
function addNote(id, n) {
  const rec = { text: (n && n.text || '').trim(), by: n && n.by || 'Manisha Saini', at: n && n.at || 'Just now' };
  if (!rec.text) return notesFor(id);
  NOTE_LOG[id] = [rec].concat(NOTE_LOG[id] || []);
  return notesFor(id);
}

window.HotNotesBanner = function HotNotesBanner({ notes, onAdd, onResolve }) {
  const P = useP();
  if (!notes || !notes.length) return null;
  const worst = notes.some((n) => HOT_KINDS[n.kind].tone === 'bad') ? 'bad' : notes.some((n) => HOT_KINDS[n.kind].tone === 'warn') ? 'warn' : 'info';
  const c = worst === 'bad' ? P.bad : worst === 'warn' ? P.warn : P.info;
  const soft = worst === 'bad' ? P.badSoft : worst === 'warn' ? P.warnSoft : P.infoSoft;
  return <div style={{ border: `1.5px solid ${c}`, background: soft, borderRadius: P.r14, overflow: 'hidden', marginBottom: 16 }} data-tour="hot-notes">
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 15px', background: c, color: '#fff' }}>
      <Icon name="shield" size={15} stroke={2.2} color="#fff" />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' }}>Hot notes — read before serving</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, background: 'rgba(255,255,255,.22)', borderRadius: 99, padding: '1px 8px' }}>{notes.length}</span>
      <div style={{ flex: 1 }} />
      {onAdd && <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(255,255,255,.45)', background: 'transparent', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}><Icon name="plus" size={12} stroke={2.6} color="#fff" />Add</button>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {notes.map((n, i) => {const k = HOT_KINDS[n.kind] || HOT_KINDS.service;const kc = k.tone === 'bad' ? P.bad : k.tone === 'warn' ? P.warn : P.info;
        return <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 15px', borderTop: i ? `1px solid ${c}33` : 'none' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: '#fff', color: kc, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', border: `1px solid ${kc}44` }}><Icon name={k.icon} size={14} stroke={2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: kc }}>{k.label}</span>
              {n.block && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: kc, borderRadius: 99, padding: '1px 8px' }}>Do not assign · {n.block}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: P.ink, lineHeight: 1.5, textWrap: 'pretty' }}>{n.text}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{n.by} · {n.at}</div>
          </div>
          {onResolve && <button onClick={() => onResolve(i)} title="Resolve this note" style={{ flex: '0 0 auto', alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 99, border: `1px solid ${kc}55`, background: '#fff', color: kc, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>Resolve</button>}
        </div>;})}
    </div>
  </div>;
};

// Add note — one modal, two kinds. A hot note demands a category and surfaces
// immediately; a standard note is quiet history.
window.AddNoteModal = function AddNoteModal({ member, onClose, onSave }) {
  const P = useP();
  const [hot, setHot] = React.useState(false);
  const [kind, setKind] = React.useState('conduct');
  const [text, setText] = React.useState('');
  const [block, setBlock] = React.useState('');
  const STAFF = ['Devon Pierce', 'Priya Nair', 'Marcus Hill', 'Manisha Saini', 'Carla Mendes'];
  const ok = text.trim().length > 3;
  const c = hot ? HOT_KINDS[kind].tone === 'bad' ? P.bad : HOT_KINDS[kind].tone === 'warn' ? P.warn : P.info : P.ink;
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 };
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,96%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: hot ? c : P.surface3, color: hot ? '#fff' : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={hot ? 'shield' : 'note'} size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{hot ? 'Add hot note' : 'Add note'}</div><div style={{ fontSize: 11.5, color: P.inkDim }}>{member ? member.name : 'Customer'}</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label onClick={() => setHot((v) => !v)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 14px', background: hot ? P.badSoft : P.surface2, border: `1.5px solid ${hot ? P.bad : P.hairline2}`, borderRadius: P.r12, cursor: 'pointer' }}>
          <Check on={hot} onChange={setHot} size={18} />
          <div><div style={{ fontSize: 13.5, fontWeight: 700, color: hot ? P.bad : P.ink }}>Make this a hot note</div>
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, marginTop: 2 }}>Pins to the top of the profile in red and shows to anyone who opens this customer — at the counter, in dispatch and on the driver app. Use for violent, abusive or sketchy behaviour, or a complaint against a named employee.</div></div>
        </label>
        {hot && <div>
          <div style={lbl}>Category</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {Object.keys(HOT_KINDS).map((k) => {const m = HOT_KINDS[k];const on = kind === k;const kc = m.tone === 'bad' ? P.bad : m.tone === 'warn' ? P.warn : P.info;
              return <button key={k} onClick={() => setKind(k)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', textAlign: 'left', background: on ? kc + '18' : P.surface2, border: `1px solid ${on ? kc : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}>
                <Icon name={m.icon} size={14} stroke={2} color={on ? kc : P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} />
                <span><span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: on ? kc : P.ink }}>{m.label}</span><span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, lineHeight: 1.4, marginTop: 1 }}>{m.blurb}</span></span>
              </button>;})}
          </div>
        </div>}
        {hot && kind === 'staff' && <div>
          <div style={lbl}>Employee not to be assigned</div>
          <select value={block} onChange={(e) => setBlock(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, color: P.ink, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, outline: 'none' }}>
            <option value="">Select an employee…</option>{STAFF.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 5, lineHeight: 1.45 }}>Check-in will warn before this person is put on the sale, and dispatch will skip them when assigning a driver.</div>
        </div>}
        <div>
          <div style={lbl}>{hot ? 'What happened' : 'Note'}</div>
          <textarea autoFocus rows={hot ? 4 : 5} value={text} onChange={(e) => setText(e.target.value)} placeholder={hot ? 'Be specific and factual — dates, what was said or done, who was present.' : 'Add an internal note about this member…'} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.surface, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.5, outline: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" onClick={() => {if (!ok) return;onSave && onSave(hot ? { hot: true, kind, text: text.trim(), block: block || null, by: 'Manisha Saini', at: 'Just now' } : { hot: false, text: text.trim(), by: 'Manisha Saini', at: 'Just now' });}} disabled={!ok} title={ok ? undefined : 'Write the note first — a few words at least'} style={hot && ok ? { background: P.bad, color: '#fff' } : null}>{hot ? 'Save hot note' : 'Save note'}</PBtn>
      </div>
    </div>
  </div>;
};

// ── Delivery address book ───────────────────────────────────────────────────
// The ID address is what is printed on the government document. It is a
// COMPLIANCE field — it is never edited by staff and never used for routing.
// Delivery addresses are a separate, many-per-customer list the customer owns.
// Each one carries its own zone verdict, because a customer can legitimately
// have one address we serve and another we do not.
// A DELIVERY ADDRESS IS A ROUTING INSTRUCTION, AND THIS ONE WAS INVENTED.
// The book was built from the same character-code sum of m.id that used to
// denominate lifetime spend: HOW MANY addresses (`1 + h % 3`), sliced out of a
// hardcoded pool of four, each stamped with an order count (`(h + i*7) % 9`)
// and a hardcoded last-used date. Every row then rendered with a green
// check-circle and "Routes to this region and can order delivery." — for a
// customer whose record holds no address at all.
//
// It is worse than a fabricated compliance field because it is actionable in
// the next sixty seconds: an operator taking a delivery order reads
// "Home · Default · In zone · 418 Mission Trail · 6 orders · last used 2 days
// ago" and dispatches a driver to a door nobody ever gave us. The order count
// and the last-used date are exactly what make it believable — they say other
// people have already delivered here.
//
// There is no endpoint that returns a customer's saved addresses, so the book
// starts EMPTY and says so. `m.addresses` is the seam a real one plugs into.
// The one address this build can legitimately hold is the one an operator
// types into the form below, and that one carries a real ZIP-derived zone.
function seedAddresses(m) {
  const stored = m && Array.isArray(m.addresses) ? m.addresses : [];
  const list = stored.map((a, i) => Object.assign({}, a, { id: a.id || 'ad' + i, def: a.def != null ? a.def : i === 0 }));
  return { list };
}
// Kept per member so an address the operator adds is still there next time they
// open the profile — a "saved" address that only lived in component state was
// indistinguishable from one that was never saved.
const ADDR_BOOK = {};
function addressesFor(m) {
  if (!ADDR_BOOK[m.id]) ADDR_BOOK[m.id] = seedAddresses(m).list;
  return ADDR_BOOK[m.id];
}
// The ZIP is what decides the region and therefore the zone — the panel says so,
// so the form has to actually do it. An unknown ZIP is 'not served', which is a
// real answer, not a failure to save.
const ZIP_ZONE = {
  '92595': { region: 'RC7 · Wildomar', zone: 'in' },
  '92530': { region: 'RC2 · Lake Elsinore', zone: 'in' },
  '92532': { region: 'RC2 · Lake Elsinore', zone: 'in' },
  '92883': { region: 'RC4 · Temescal', zone: 'in' },
  '92562': { region: 'RC1 · Temecula', zone: 'buffer' },
  '92563': { region: 'RC1 · Temecula', zone: 'buffer' }
};
function zoneForZip(zip) {return ZIP_ZONE[String(zip || '').trim()] || { region: 'No region covers this ZIP', zone: 'out' };}
/** The name of ONE address parameter, sitting above its own box and staying
 *  there once the box is full. Deliberately tiny: this panel is narrow and the
 *  split turned four boxes into six, so the label has to cost close to nothing
 *  vertically or it buys clarity on the field and loses it on the form.
 *
 *  `inkDim`, NOT `inkMute`, AND THE DIFFERENCE WAS MEASURED IN A BROWSER. The
 *  first version of this used P.inkMute at 9.5px — rgba(15,15,12,.42), which
 *  composites to 2.81:1 against the card it sits on, where AA for text this
 *  size wants 4.5:1. It passed every assertion in the suite, because jsdom
 *  reads textContent and a label it can FIND is a label it calls present; on
 *  screen it was an unreadable smudge. inkDim (.60) measures 4.95:1 here and
 *  5.03:1 on the storefront's white card. A label nobody can read is the same
 *  defect as no label, one step quieter — and the suite cannot tell them apart,
 *  which is exactly why the number is written down here. */
function AddrLab({ children }) {
  const P = useP();
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    color: P.inkDim, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</div>;
}
window.DeliveryAddressBook = function DeliveryAddressBook({ m, idAddr }) {
  const P = useP();
  const [list, setList] = React.useState(() => addressesFor(m));
  const [adding, setAdding] = React.useState(false);
  // ONE FIELD PER PARAMETER [OWNER RULING 2026-08-27]. This form used to hold a
  // single free-text "Street address" and NO state field at all — the state was
  // a literal 'CA' hardcoded into the render below, which meant every
  // out-of-state address on file silently displayed as Californian. Danny
  // Fitzgerald's NV licence is the case that makes it concrete.
  // `state` is captured, not assumed; the blank start is deliberate, because
  // seeding it with 'CA' is the same defect wearing an input box.
  const BLANK_NF = { label: '', streetNumber: '', streetName: '', city: '', state: '', zip: '' };
  const [nf, setNf] = React.useState(BLANK_NF);
  const setNf1 = (k, v) => setNf((p) => ({ ...p, [k]: v }));
  // AN UNSTARTED FORM IS NOT A FORM WITH ERRORS. The amber "Still needs …"
  // line below used to render the instant `adding` flipped true, so opening
  // the panel greeted the operator with a six-item list of everything they had
  // not yet typed. That is the same defect the split-name work exists to avoid
  // one field over: an ABSENCE reported as a fault. An operator who meets the
  // amber every single time they open the form learns to read past it — at
  // which point it is worth nothing on the address that really is half-filled.
  //
  // DERIVED rather than held as its own flag, deliberately: Cancel and a
  // successful save both reset `nf` to BLANK_NF, so "every box is empty" IS
  // "nobody has started here", and there is no second piece of state that can
  // be left set behind the first one.
  const touched = Object.keys(nf).some((k) => String(nf[k]).trim() !== '');
  const commit = (next) => {ADDR_BOOK[m.id] = next;setList(next);};
  const missing = [
  !nf.label.trim() && 'a label',
  !nf.streetNumber.trim() && 'a street number',
  !nf.streetName.trim() && 'a street name',
  !nf.city.trim() && 'a city',
  !/^[A-Za-z]{2}$/.test(nf.state.trim()) && 'a 2-letter state',
  !/^\d{5}$/.test(nf.zip.trim()) && 'a 5-digit ZIP'].
  filter(Boolean);
  const addrOk = missing.length === 0;
  const needs = !missing.length ? '' : missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  const saveAddress = () => {
    if (!addrOk) return;
    const z = zoneForZip(nf.zip);
    const streetNumber = nf.streetNumber.trim(), streetName = nf.streetName.trim();
    const rec = { id: 'ad-' + Date.now().toString(36), label: nf.label.trim(),
      streetNumber, streetName,
      // `street` is DERIVED and kept only so existing readers of a.street keep
      // working. The split pair is what was captured and what should be sent.
      street: window.HWAddress ? window.HWAddress.joinStreet(streetNumber, streetName) : (streetNumber + ' ' + streetName).trim(),
      city: nf.city.trim(), state: nf.state.trim().toUpperCase(), zip: nf.zip.trim(),
      region: z.region, zone: z.zone, def: list.length === 0, lastUsed: null, orders: 0, addedHere: true };
    commit(list.concat([rec]));
    setNf(BLANK_NF);
    setAdding(false);
  };
  const ZONE = {
    in: { label: 'In zone', c: P.good, icon: 'check-circle', note: 'Routes to this region and can order delivery.' },
    buffer: { label: 'Buffer', c: P.warn, icon: 'shield', note: 'Outside the drawn polygon but inside the buffer ring — accepted, may add time.' },
    out: { label: 'Not served', c: P.bad, icon: 'x', note: 'No region covers this zip. Delivery checkout is blocked for this address.' }
  };
  const setDefault = (id) => commit(list.map((a) => ({ ...a, def: a.id === id })));
  return <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }} data-tour="addr-book">
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="truck" size={14} stroke={1.9} color={P.ink2} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Delivery addresses</span>
      <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{list.length}</span>
      <div style={{ flex: 1 }} />
      <PBtn variant="secondary" size="xs" icon="plus" onClick={() => setAdding(true)}>Add address</PBtn>
    </div>
    {list.length === 0 && !adding &&
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px' }}>
      <Icon name="truck" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>No delivery address is on file for this customer.</b> Nothing is being withheld — no address has ever been saved against this record, so there is no zone verdict to give. Add one above and its ZIP decides the region.</span>
    </div>}
    {list.map((a, i) => {const z = ZONE[a.zone];
      return <div key={a.id} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: z.c + '18', color: z.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={z.icon} size={13} stroke={2.2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{a.label}</span>
            {a.def && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.accentInk, background: P.accent, borderRadius: 99, padding: '1px 7px' }}>Default</span>}
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: z.c }}>{z.label}</span>
          </div>
          {/* THE STATE IS READ, NOT ASSUMED. This line used to end with a
               hardcoded `CA`, so an address in Nevada rendered as Californian
               and nothing anywhere said otherwise — a fabricated value with a
               compliance-shaped face. A row that carries no state now SAYS it
               carries no state. Legacy rows keep whatever joined `street` they
               were saved with: re-splitting stored data here would invent a
               number/name boundary nobody typed. */}
          <div style={{ fontSize: 12.5, color: P.ink2, fontFamily: P.fontMono, marginTop: 2 }}>{
            [window.HWAddress ? window.HWAddress.joinStreet(a.streetNumber, a.streetName) || a.street : a.street, a.city].filter(Boolean).join(', ')
          }{a.state ? ', ' + a.state : ''} {a.zip}{!a.state && <span style={{ color: P.warn, fontFamily: 'inherit' }}> · state not recorded</span>}</div>
          {/* AN ORDER COUNT AND A LAST-USED DATE ARE MEASUREMENTS, and nothing
               measures them here. They used to be generated beside the address
               and they were the two things that made an invented address
               believable — they say other people have already delivered here.
               An address the operator typed a moment ago has no delivery
               history, and that is what it now says. */}
          <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 3, lineHeight: 1.45 }}>{a.region} · {a.orders == null ? 'delivery history not recorded' : a.orders === 0 ? 'no delivery to this address yet' : `${a.orders} order${a.orders === 1 ? '' : 's'}`}{a.lastUsed ? ` · last used ${a.lastUsed}` : ''}</div>
          <div style={{ fontSize: 11.5, color: z.c, marginTop: 3, lineHeight: 1.45 }}>{z.note}</div>
        </div>
        {!a.def && <button onClick={() => setDefault(a.id)} style={{ flex: '0 0 auto', alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>Make default</button>}
      </div>;})}
    {adding && <div style={{ padding: '12px 13px', borderTop: `1px solid ${P.hairline}`, background: P.surface2, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* SIX FIELDS WHERE THERE WERE FOUR, in a panel that is already narrow.
           Street number is deliberately the small box and street name the wide
           one; state is two characters. This is a real layout change and jsdom
           cannot see it — it answers "is it wired", never "does it fit". */}
      {/* A PLACEHOLDER IS NOT A LABEL. It is the one piece of text that
           disappears exactly when the field stops being self-explanatory: the
           moment "3400" is in the narrow box and "S Las Vegas Blvd" is in the
           wide one, nothing on screen says which of the two is the number and
           which is the name. Splitting one box into five and then leaving the
           five unnamed moves the ambiguity rather than removing it, and this
           panel is the one an operator comes back to in order to CHECK an
           address, not only to type one. The label is the smallest thing that
           survives being filled in. */}
      <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 110 }}><AddrLab>Label</AddrLab><Field size="sm" placeholder="Label" value={nf.label} onChange={(e) => setNf1('label', e.target.value)} /></div><div style={{ width: 92 }}><AddrLab>Street no.</AddrLab><Field size="sm" mono placeholder="Street no." value={nf.streetNumber} onChange={(e) => setNf1('streetNumber', e.target.value)} /></div><div style={{ flex: 1 }}><AddrLab>Street name</AddrLab><Field size="sm" placeholder="Street name" value={nf.streetName} onChange={(e) => setNf1('streetName', e.target.value)} /></div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}><div style={{ flex: 1 }}><AddrLab>City</AddrLab><Field size="sm" placeholder="City" value={nf.city} onChange={(e) => setNf1('city', e.target.value)} /></div><div style={{ width: 64 }}><AddrLab>State</AddrLab><Field size="sm" mono placeholder="State" value={nf.state} onChange={(e) => setNf1('state', e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())} /></div><div style={{ width: 100 }}><AddrLab>ZIP</AddrLab><Field size="sm" mono placeholder="ZIP" value={nf.zip} onChange={(e) => setNf1('zip', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} /></div>
        <PBtn variant="accent" size="sm" icon="check" disabled={!addrOk} title={addrOk ? undefined : `Still needs ${needs}`} onClick={saveAddress}>Save</PBtn><PBtn variant="ghost" size="sm" onClick={() => {setNf(BLANK_NF);setAdding(false);}}>Cancel</PBtn></div>
      {touched && !addrOk && <div style={{ fontSize: 11.5, color: P.warn, fontWeight: 600, lineHeight: 1.45 }}>Still needs {needs}.</div>}
      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>The ZIP decides everything: it resolves to a region, the region's on-shift driver decides what can be sold to it, and an unserved ZIP blocks delivery checkout for this address only.</div>
    </div>}
    <div style={{ display: 'flex', gap: 8, padding: '11px 13px', borderTop: `1px solid ${P.hairline}`, background: P.infoSoft }}>
      <Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
        {idAddr ?
        <>The <b>ID address</b> above is the compliance record — it is read from the scanned document, is never edited by staff, and is never used for routing. Delivery addresses are separate, the customer can hold as many as they like, and each is zone-checked on its own.</> :
        <>No <b>ID address</b> has been read off a document for this customer, which is why the field above says <i>not recorded</i> rather than showing one. A delivery address is a separate thing the customer gives us; it is zone-checked on its own and is never a substitute for the compliance record.</>}
      </div>
    </div>
  </div>;
};

// ── Member-side verification ────────────────────────────────────────────────
// The same identity model the order screen uses, surfaced where the customer
// record lives. Phone confirmation is a DELIVERY gate only — an in-store
// walk-in is fully cleared by the ID scan and is never sent an SMS.
window.MemberVerificationCard = function MemberVerificationCard({ m, idv, onLog }) {
  const P = useP();
  const a = window.HWV ? window.HWV.assurance(idv) : { tier: 0 };
  const [door, setDoor] = React.useState(false); // deferred to a driver ID scan
  // The ladder is detail, not headline — the badge plus the one-line verdict is
  // what staff need at a glance, so the rungs collapse behind a disclosure.
  // It opens by default only while something is still outstanding.
  const [open, setOpen] = React.useState(a.tier === 1);
  return <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }} data-tour="member-verify">
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="shield" size={14} stroke={1.9} color={P.ink2} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Verification</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{a.tier === 2 ? 'in-store + delivery' : a.tier === 1 ? 'in-store only' : 'nothing cleared'}</span>
    </div>
    <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* "NOTHING FURTHER WILL EVER BE ASKED" IS A PROMISE, AND A SOFT-LAPSED
           ALLOW CANNOT KEEP IT. With HW_ENFORCE_DOC_EXPIRY off, a customer
           whose ID has expired still clears to tier 2 carrying
           `wouldBlockCode: 'lapsed'` (see assurance() in verification.jsx).
           For them the sentence was false in the most expensive direction:
           turning the switch on IS something further, and it stops them at the
           door. The clean pass and the soft pass also shared one green chip and
           one check icon, which is the same defect the badge already had.
           Only TWO states reach this line, not three — an expired document
           under an UNPUBLISHED switch refuses at tier 0 and never gets here,
           so there is no unpublished branch to write. */}
      {(() => {
        const softLapse = a.canDelivery && a.wouldBlockCode === 'lapsed';
        const good = a.canDelivery && !softLapse;
        return <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: good ? P.goodSoft : softLapse ? P.warnSoft : P.surface2, borderRadius: P.r10 }}>
        <Icon name={good ? 'check-circle' : softLapse ? 'shield' : 'shop'} size={13} color={good ? P.good : softLapse ? P.warn : P.ink2} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
          {softLapse ? <>Cleared for <b>in-store and delivery</b> — but only because expiry enforcement is OFF. Their ID has lapsed, and turning the switch on stops them clearing. Ask for a current ID.</> :
          good ? <>Cleared for <b>in-store and delivery</b>. Nothing further will ever be asked of them.</> :
          a.canStore ? <>Cleared for <b>in-store</b> — they can shop the counter today with no extra step. Delivery is the only thing waiting on the phone confirmation.</> :
          <>Not yet cleared. {a.next}</>}
        </div>
      </div>;})()}
      <button onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 10px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, cursor: 'pointer', fontFamily: P.fontSans }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2 }}>Verification steps</span>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{Math.min(a.tier + 1, 3)} / 3</span>
        <div style={{ flex: 1 }} />
        <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && <window.IdentityLadder v={idv} compact />}
      {a.tier === 1 && <window.SmsVerifyPanel phone={(idv.phone || {}).value || m.phone} state={(idv.phone || {}).sentAt ? 'sent' : 'idle'} sentAt={(idv.phone || {}).sentAt} onLog={onLog} />}
      {/* Nobody has ever held this person's ID — a remote check is the way to fix that
          without making them come in. Always reachable, never buried. */}
      {a.tier === 0 && <window.RemoteIdPanel phone={(idv && idv.phone || {}).value || m.phone} remoteId={idv && idv.remoteId} onLog={onLog} onDoor={() => setDoor(true)} />}
      {door && <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
        <Icon name="scan" size={15} color={P.good} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}><b>Deferred to a door scan.</b> The next driver inspects and photographs the ID on delivery — that clears the account permanently, exactly like a counter scan.</span>
        <PBtn variant="ghost" size="xs" icon="x" onClick={() => setDoor(false)}>Undo</PBtn>
      </div>}
    </div>
  </div>;
};

// ── Full order view (opened from member order history) ──────────────────────
// Was a four-tile summary that forced a second click into Orders. Now it is the
// order: lines, the tax breakdown in the mandated order, tender and fulfilment.
window.FullOrderView = function FullOrderView({ order, m, onClose }) {
  const P = useP();
  const fmt = window.HW.fmt;
  const o = order;
  // ══ A RECEIPT MAY NOT INVENT THE BASKET IT IS A RECEIPT FOR ════════════════
  //
  // 🔴 `h = (o.id + m.id).charCodeSum` produced every line on this receipt:
  //     lines   prods[(h + i*17) % prods.length]  WHICH PRODUCTS THEY BOUGHT
  //     qty     1 + (h + i) % 2                   how many of each
  //     promo   h % 3 === 0 ? sub * 0.1 : 0       a discount that was given
  //     tender  ['Card','Cash','Split'][h % 3]    how they paid
  //     served  ['Priya Nair', …][h % 3]          WHICH EMPLOYEE SERVED THEM
  // and the subtotal, tax and grand total were then computed off those lines —
  // so the receipt's own Total disagreed with `o.total`, the figure the order
  // book holds, and the operator was reading the invented one.
  //
  // An order in this build records a NAME, an item COUNT and a TOTAL, and no
  // line items at all (pos/data.jsx O_()). Naming a product someone bought, an
  // employee who served them, or a discount they were given, from a hash of two
  // ids, is the same defect as the fabricated licence number one screen over.
  //
  // The record's own total is what this renders. The basket, the tender and the
  // associate are stated as not held.
  const lines = Array.isArray(o.lines) ? o.lines : null;
  const sub = lines ? +lines.reduce((a, l) => a + (+l.line || 0), 0).toFixed(2) : null;
  const promo = +(o.discount || 0) || 0;
  const fee = +(o.deliveryFee || 0) || 0;
  // THE TOTAL COMES OFF THE RECORD. Recomputing it from a basket we do not have
  // is how the two figures drifted apart in the first place.
  const grand = o.total != null ? +(+o.total).toFixed(2) : null;
  // The tax breakdown is only shown when there is a merchandise base to break
  // down. Applying taxBreakdown() to a total we did not build produces line
  // items that do not sum to it.
  const tax = sub != null ? window.HW.taxBreakdown(+(sub - promo).toFixed(2)) : null;
  const base = sub != null ? +(sub - promo).toFixed(2) : null;
  const tender = o.pay || null;
  const servedBy = o.associate || null;
  const Row = ({ k, v, strong, c }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: strong ? 14 : 12.5 }}>
    <span style={{ color: strong ? P.ink : P.inkDim, fontWeight: strong ? 700 : 500 }}>{k}</span>
    <span style={{ color: c || P.ink, fontWeight: strong ? 800 : 600, fontFamily: P.fontMono }}>{v}</span></div>;
  const Meta = ({ k, v }) => <div><div style={{ fontSize: 10, color: P.inkMute, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>{k}</div><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, marginTop: 2 }}>{v}</div></div>;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(660px,96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="receipt" size={17} stroke={1.9} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>#{o.id}</span><Pill kind="good" dot>{o.status}</Pill>{o.wm && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}>Weedmaps</span>}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{o.date} · {m.name}</div>
        </div>
        <IconBtn icon="x" size={17} onClick={onClose} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12, padding: '12px 14px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
          <Meta k="Channel" v={o.channel} /><Meta k="Items" v={o.items} />
          <Meta k="Payment" v={tender || 'not recorded'} />
          <Meta k="Served by" v={servedBy || 'not recorded'} />
        </div>
        <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ padding: '8px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Items</div>
          {lines ? lines.map((l, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
            <Thumb item={l.p} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p.name}</div>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{l.p.brand} · {l.p.cat}{l.p.wt ? ' · ' + l.p.wt : ''}</div>
            </div>
            <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>×{l.qty}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, minWidth: 62, textAlign: 'right' }}>{fmt.money(l.line)}</span>
          </div>) :
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px' }}>
            <Icon name="alert" size={14} stroke={2} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
              <b>No line items are held for this order.</b> The record carries {o.items} item{o.items === 1 ? '' : 's'} as a COUNT and a total — which products, and how many of each, were never recorded. This list used to name products chosen by a character sum of the order and member ids.
            </div>
          </div>}
        </div>
        <div style={{ padding: '12px 14px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
          {sub != null && <Row k="Subtotal" v={fmt.money(sub)} />}
          {promo > 0 && <Row k="Discount" v={'−' + fmt.money(promo)} c={P.good} />}
          {promo > 0 && base != null && <Row k="Net subtotal" v={fmt.money(base)} />}
          {tax && tax.lines.map((t) => <Row key={t.k} k={t.k} v={fmt.money(t.v)} />)}
          {fee > 0 && <Row k="Delivery fee" v={fmt.money(fee)} />}
          <div style={{ borderTop: `1px solid ${P.hairline2}`, marginTop: 6, paddingTop: 4 }}><Row k="Total" v={grand == null ? 'not recorded' : fmt.money(grand)} strong /></div>
          {/* ⚠️ The total is the RECORD's. A tax breakdown is printed only when
              there is a basket to break down — a subtotal + tax + fee that do
              not add up to the total shown is worse than no breakdown. */}
          {sub == null && grand != null && <div style={{ marginTop: 6, fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>Total as recorded on the order. No subtotal or tax split is held for it, so none is shown.</div>}
          <div style={{ marginTop: 6, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{tender ? 'Paid by ' + String(tender).toLowerCase() : 'Tender not recorded'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 9, padding: '13px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="md" icon="printer">Reprint receipt</PBtn>
        <PBtn variant="secondary" size="md" icon="refresh">Reorder</PBtn>
        <div style={{ flex: 1 }} />
        <PBtn variant="secondary" size="md" icon="receipt" onClick={onClose}>Open in Orders</PBtn>
      </div>
    </div>
  </div>;
};

// ── Price check ─────────────────────────────────────────────────────────────
// Header tool, on every screen, F2 or ⌘/Ctrl+K. A budtender holding a jar needs
// price + stock + potency without leaving whatever they were doing.
window.PriceCheck = function PriceCheck() {
  const P = useP();
  const fmt = window.HW.fmt;
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const k = (e) => {
      if (e.key === 'F2' || (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {e.preventDefault();setOpen(true);}
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', k);return () => window.removeEventListener('keydown', k);
  }, []);
  React.useEffect(() => {if (open && ref.current) ref.current.focus();}, [open]);
  const hits = !q.trim() ? [] : window.HW.PRODUCTS.filter((p) => (p.name + ' ' + p.brand + ' ' + p.sku + ' ' + p.cat).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const p = sel;
  return <>
    <button onClick={() => setOpen(true)} title="Price check (F2 or ⌘K)" data-tour="price-check" style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: P.r10, color: P.ink2, cursor: 'pointer', flex: '0 0 auto', transition: 'background .12s' }}
    onMouseEnter={(e) => e.currentTarget.style.background = P.surface3} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <Icon name="tag" size={18} stroke={1.8} />
    </button>
    {open && ReactDOM.createPortal(
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 20px', fontFamily: P.fontSans }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
            <Icon name="tag" size={17} stroke={1.9} color={P.ink2} />
            <input ref={ref} value={q} onChange={(e) => {setQ(e.target.value);setSel(null);}} placeholder="Scan a barcode or type a product, brand or SKU…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: P.ink, fontSize: 15, fontWeight: 600, fontFamily: P.fontSans }} />
            <IconBtn icon="x" size={16} onClick={() => setOpen(false)} />
          </div>
          {p ? <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 15 }}>
              <Thumb item={p} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{p.brand}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em', lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{p.sku} · {p.cat}{p.wt ? ' · ' + p.wt : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {p.was && <div style={{ fontSize: 12.5, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{fmt.money(p.was)}</div>}
                <div style={{ fontSize: 30, fontWeight: 800, color: p.was ? P.bad : P.ink, fontFamily: P.fontMono, lineHeight: 1.1 }}>{fmt.money(p.price)}</div>
                {p.was && <div style={{ fontSize: 11.5, fontWeight: 800, color: P.bad }}>SALE · save {fmt.money(p.was - p.price)}</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 9 }}>
              {[['On hand', p.qty + ' units', p.qty < 10 ? P.warn : P.ink], ['THC', p.thc != null ? p.thc + '%' : '—', P.ink], ['Strain', p.strain || '—', P.ink], ['Per gram', p.wt && /g$/.test(p.wt) ? fmt.money(p.price / (parseFloat(p.wt) || 1)) : '—', P.ink2]].map(([k, v, c]) =>
              <div key={k} style={{ padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: c, fontFamily: P.fontMono, marginTop: 2 }}>{v}</div>
                </div>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13, padding: '9px 12px', background: P.infoSoft, borderRadius: P.r10, fontSize: 11.5, color: P.ink2 }}>
              <Icon name="info" size={13} color={P.info} />Shelf price before tax. The register adds local, state excise and state sales tax at checkout.
            </div>
            <div style={{ marginTop: 13 }}><PBtn variant="secondary" size="sm" icon="chevron-left" onClick={() => setSel(null)}>Back to search</PBtn></div>
          </div> :
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {hits.map((x) => <button key={x.sku} onClick={() => setSel(x)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', borderTop: `1px solid ${P.hairline}`, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Thumb item={x} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{x.brand} · {x.qty} on hand</div>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: x.was ? P.bad : P.ink, fontFamily: P.fontMono }}>{fmt.money(x.price)}</span>
            </button>)}
            {!q.trim() && <div style={{ padding: '26px 20px', textAlign: 'center', color: P.inkMute, fontSize: 12.5, lineHeight: 1.6 }}>Scan a barcode or start typing.<br /><span style={{ fontSize: 11.5 }}>Works from any screen — <b style={{ color: P.ink2 }}>F2</b> or <b style={{ color: P.ink2 }}>⌘K</b>.</span></div>}
            {q.trim() && hits.length === 0 && <div style={{ padding: '26px 20px', textAlign: 'center', color: P.inkMute, fontSize: 12.5 }}>Nothing matches “{q}”.</div>}
          </div>}
        </div>
      </div>, document.body)}
  </>;
};

window.HW_HOT = { HOT_KINDS, hotNotesFor, notesFor, addNote };
Object.assign(window, {});