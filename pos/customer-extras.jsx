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
        <PBtn variant="accent" size="md" icon="check" onClick={() => {if (!ok) return;onSave && onSave(hot ? { hot: true, kind, text: text.trim(), block: block || null, by: 'Manisha Saini', at: 'Just now' } : { hot: false, text: text.trim() });}} style={{ opacity: ok ? 1 : .5, ...(hot ? { background: P.bad, color: '#fff' } : null) }}>{hot ? 'Save hot note' : 'Save note'}</PBtn>
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
function seedAddresses(m, idAddr) {
  const h = m.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pool = [
  { label: 'Home', street: '418 Mission Trail', city: 'Wildomar', zip: '92595', region: 'RC7 · Wildomar', zone: 'in' },
  { label: 'Work', street: '2100 Main St, Suite 4', city: 'Lake Elsinore', zip: '92530', region: 'RC2 · Lake Elsinore', zone: 'in' },
  { label: "Mom's", street: '77 Cottonwood Ln', city: 'Murrieta', zip: '92562', region: 'RC1 · Temecula', zone: 'buffer' },
  { label: 'Old place', street: '910 Sierra Way', city: 'Hemet', zip: '92544', region: 'RC9 · Hemet', zone: 'out' }];
  const n = 1 + h % 3;
  const list = pool.slice(0, n).map((a, i) => ({ ...a, id: 'ad' + i, def: i === 0, lastUsed: ['2 days ago', 'Jun 2, 2026', 'May 11, 2026'][i] || '—', orders: Math.max(1, (h + i * 7) % 9) }));
  const sameAsId = idAddr && list[0] && list[0].street === idAddr.street;
  return { list, sameAsId };
}
window.DeliveryAddressBook = function DeliveryAddressBook({ m, idAddr }) {
  const P = useP();
  const seeded = React.useMemo(() => seedAddresses(m, idAddr), [m.id]);
  const [list, setList] = React.useState(seeded.list);
  const [adding, setAdding] = React.useState(false);
  const ZONE = {
    in: { label: 'In zone', c: P.good, icon: 'check-circle', note: 'Routes to this region and can order delivery.' },
    buffer: { label: 'Buffer', c: P.warn, icon: 'shield', note: 'Outside the drawn polygon but inside the buffer ring — accepted, may add time.' },
    out: { label: 'Not served', c: P.bad, icon: 'x', note: 'No region covers this zip. Delivery checkout is blocked for this address.' }
  };
  const setDefault = (id) => setList((l) => l.map((a) => ({ ...a, def: a.id === id })));
  return <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }} data-tour="addr-book">
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="truck" size={14} stroke={1.9} color={P.ink2} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Delivery addresses</span>
      <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{list.length}</span>
      <div style={{ flex: 1 }} />
      <PBtn variant="secondary" size="xs" icon="plus" onClick={() => setAdding(true)}>Add address</PBtn>
    </div>
    {list.map((a, i) => {const z = ZONE[a.zone];
      return <div key={a.id} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: z.c + '18', color: z.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={z.icon} size={13} stroke={2.2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{a.label}</span>
            {a.def && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.accentInk, background: P.accent, borderRadius: 99, padding: '1px 7px' }}>Default</span>}
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: z.c }}>{z.label}</span>
          </div>
          <div style={{ fontSize: 12.5, color: P.ink2, fontFamily: P.fontMono, marginTop: 2 }}>{a.street}, {a.city}, CA {a.zip}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 3, lineHeight: 1.45 }}>{a.region} · {a.orders} order{a.orders > 1 ? 's' : ''} · last used {a.lastUsed}</div>
          <div style={{ fontSize: 11.5, color: z.c, marginTop: 3, lineHeight: 1.45 }}>{z.note}</div>
        </div>
        {!a.def && <button onClick={() => setDefault(a.id)} style={{ flex: '0 0 auto', alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>Make default</button>}
      </div>;})}
    {adding && <div style={{ padding: '12px 13px', borderTop: `1px solid ${P.hairline}`, background: P.surface2, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 110 }}><Field size="sm" placeholder="Label" /></div><div style={{ flex: 1 }}><Field size="sm" placeholder="Street address" /></div></div>
      <div style={{ display: 'flex', gap: 8 }}><div style={{ flex: 1 }}><Field size="sm" placeholder="City" /></div><div style={{ width: 100 }}><Field size="sm" mono placeholder="ZIP" /></div>
        <PBtn variant="accent" size="sm" icon="check" onClick={() => setAdding(false)}>Save</PBtn><PBtn variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</PBtn></div>
      <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>The ZIP decides everything: it resolves to a region, the region's on-shift driver decides what can be sold to it, and an unserved ZIP blocks delivery checkout for this address only.</div>
    </div>}
    <div style={{ display: 'flex', gap: 8, padding: '11px 13px', borderTop: `1px solid ${P.hairline}`, background: P.infoSoft }}>
      <Icon name="info" size={13} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
        The <b>ID address</b> above is the compliance record — it is read from the scanned document, is never edited by staff, and is never used for routing. Delivery addresses are separate, the customer can hold as many as they like, and each is zone-checked on its own.
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
      <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: a.canDelivery ? P.goodSoft : P.surface2, borderRadius: P.r10 }}>
        <Icon name={a.canDelivery ? 'check-circle' : 'shop'} size={13} color={a.canDelivery ? P.good : P.ink2} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
          {a.canDelivery ? <>Cleared for <b>in-store and delivery</b>. Nothing further will ever be asked of them.</> :
          a.canStore ? <>Cleared for <b>in-store</b> — they can shop the counter today with no extra step. Delivery is the only thing waiting on the phone confirmation.</> :
          <>Not yet cleared. {a.next}</>}
        </div>
      </div>
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
  const h = (o.id + m.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const prods = window.HW.PRODUCTS;
  const lines = Array.from({ length: o.items }).map((_, i) => {const p = prods[(h + i * 17) % prods.length];const qty = 1 + (h + i) % 2;return { p, qty, line: +(p.price * qty).toFixed(2) };});
  const sub = +lines.reduce((a, l) => a + l.line, 0).toFixed(2);
  const promo = h % 3 === 0 ? +(sub * 0.1).toFixed(2) : 0;
  const base = +(sub - promo).toFixed(2);
  const tax = window.HW.taxBreakdown(base);
  const fee = o.channel === 'Delivery' ? 5 : 0;
  const grand = +(base + tax.total + fee).toFixed(2);
  const tender = ['Card', 'Cash', 'Split'][h % 3];
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
          <Meta k="Channel" v={o.channel} /><Meta k="Items" v={o.items} /><Meta k="Payment" v={tender} />
          <Meta k="Served by" v={['Priya Nair', 'Marcus Hill', 'Devon Pierce'][h % 3]} />
        </div>
        <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ padding: '8px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Items</div>
          {lines.map((l, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
            <Thumb item={l.p} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.p.name}</div>
              <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{l.p.brand} · {l.p.cat}{l.p.wt ? ' · ' + l.p.wt : ''}</div>
            </div>
            <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>×{l.qty}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, minWidth: 62, textAlign: 'right' }}>{fmt.money(l.line)}</span>
          </div>)}
        </div>
        <div style={{ padding: '12px 14px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
          <Row k="Subtotal" v={fmt.money(sub)} />
          {promo > 0 && <Row k="Promo · FRIENDS" v={'−' + fmt.money(promo)} c={P.good} />}
          {promo > 0 && <Row k="Net subtotal" v={fmt.money(base)} />}
          {tax.lines.map((t) => <Row key={t.k} k={t.k} v={fmt.money(t.v)} />)}
          {fee > 0 && <Row k="Delivery fee" v={fmt.money(fee)} />}
          <div style={{ borderTop: `1px solid ${P.hairline2}`, marginTop: 6, paddingTop: 4 }}><Row k="Total" v={fmt.money(grand)} strong /></div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>Paid by {tender.toLowerCase()}</div>
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

window.HW_HOT = { HOT_KINDS, hotNotesFor };
Object.assign(window, {});