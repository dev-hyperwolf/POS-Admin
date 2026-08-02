// ── Members + Settings screens ─────────────────────────────────────────────
const useP = window.useP;

// The KPI rail is a period report, so it has to carry a period. Every tile
// moves together — a "loyalty redeemed" figure means nothing without knowing
// the window it covers.
const SPANS = [{ k: '7d', label: '7 days' }, { k: '30d', label: '30 days' }, { k: 'qtr', label: 'Quarter' }, { k: 'ytd', label: 'YTD' }];
const SPAN = {
  '7d': { range: 'Jul 14 – Jul 20, 2026', sub: 'last 7 days', active: '19', activeD: 6, loyalty: '$310', fresh: '7', freshD: 12, vip: '4' },
  '30d': { range: 'Jun 21 – Jul 20, 2026', sub: 'last 30 days', active: '84', activeD: 9, loyalty: '$1,240', fresh: '23', freshD: 18, vip: '11' },
  qtr: { range: 'Apr 21 – Jul 20, 2026', sub: 'this quarter', active: '206', activeD: 14, loyalty: '$3,905', fresh: '61', freshD: 22, vip: '19' },
  ytd: { range: 'Jan 1 – Jul 20, 2026', sub: 'year to date', active: '412', activeD: 31, loyalty: '$9,180', fresh: '148', freshD: 27, vip: '34' }
};

window.MembersScreen = function MembersScreen() {
  const P = useP();
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [added, setAdded] = React.useState([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [filtOpen, setFiltOpen] = React.useState(false);
  const [f, setF] = React.useState({ group: 'All', type: 'All', wm: 'All', tier: 'All' });
  const [span, setSpan] = React.useState('30d');
  const [showCheckIn, setShowCheckIn] = React.useState(false);
  const setF1 = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const clearF = () => setF({ group: 'All', type: 'All', wm: 'All', tier: 'All' });
  const nFilt = ['group', 'type', 'wm', 'tier'].filter((k) => f[k] !== 'All').length;
  const isLinked = (m) => m.id.charCodeAt(m.id.length - 1) % 2 === 0;

  const all = added.concat(window.HW.MEMBERS);
  const members = all.filter((m) => {
    if (q && !(m.name + m.email + m.phone).toLowerCase().includes(q.toLowerCase())) return false;
    if (f.group !== 'All' && m.group !== f.group) return false;
    if (f.type !== 'All' && m.type !== f.type) return false;
    if (f.wm !== 'All' && f.wm === 'Linked' !== isLinked(m)) return false;
    if (f.tier !== 'All') {const vip = m.member || m.group === 'VIP';if (f.tier === 'VIP' !== vip) return false;}
    return true;
  });
  const active = all.length;
  const groups = ['All'].concat(Array.from(new Set(all.map((m) => m.group))));
  const types = ['All'].concat(Array.from(new Set(all.map((m) => m.type))));
  const cols = [
  { label: 'Member', render: (m) => <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}><Avatar name={m.name} size={34} crown={m.member} /><div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{m.phone}</div></div></div> },
  { label: 'Email', render: (m) => <span style={{ fontSize: 12.5, color: P.ink2 }}>{m.email.replace(/(.{2}).*(@.*)/, '$1•••$2')}</span> },
  { label: 'Group', render: (m) => <Pill kind="neutral">{m.group}</Pill> },
  { label: 'Type', render: (m) => <span style={{ fontSize: 12.5, color: P.ink2 }}>{m.type}</span> },
  { label: 'Visits', align: 'right', render: (m) => <span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{m.visits}</span> },
  { label: 'Points', align: 'right', render: (m) => <span style={{ fontFamily: P.fontMono, fontWeight: 600, color: m.points > 1000 ? P.good : P.ink }}>{m.points.toLocaleString()}</span> },
  { label: 'Wallet', align: 'right', render: (m) => <span style={{ fontFamily: P.fontMono, fontWeight: 600, color: m.wallet > 0 ? P.good : P.inkMute }}>{window.HW.fmt.money(m.wallet)}</span> },
  { label: 'Weedmaps', render: (m) => {const linked = m.id.charCodeAt(m.id.length - 1) % 2 === 0;return linked ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}><span style={{ width: 5, height: 5, borderRadius: 2, background: '#fff' }} />Linked</span> : <span style={{ fontSize: 11.5, color: P.inkMute }}>In-store</span>;} },
  { label: '', align: 'right', width: '56px', render: (m) => <IconBtn icon="chevron-right" size={16} style={{ width: 32, height: 32 }} onClick={() => setSel(m)} /> }];

  if (sel) return <MemberDetailPage m={sel} onBack={() => setSel(null)} />;
  const FRow = ({ label, k, opts }) => <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{opts.map((o) => {const on = f[k] === o;return <button key={o} onClick={() => setF1(k, o)} style={{ padding: '5px 11px', borderRadius: 99, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, background: on ? P.accentSoft : P.surface, color: on ? P.mode === 'dark' ? P.accent : '#7A5A00' : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{o}</button>;})}</div>
  </div>;
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionHead level={1} eyebrow="Members" title="Members" subtitle={`${active} active members${nFilt || q ? ` · ${members.length} shown` : ''}`}
      action={<PBtn variant="accent" icon="user-plus" size="md" onClick={() => {setFiltOpen(false);setAddOpen(true);}}>Add Member</PBtn>} />
      {/* Same check-in queue as Orders — the exported component, not a copy, so
          the two can never drift apart. */}
      {window.CheckInStrip && <window.CheckInStrip checkins={window.HW.CHECKINS} onStartSale={() => {}} onNewCheckIn={() => setShowCheckIn(true)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Showing</span>
        <Seg size="sm" value={span} onChange={setSpan} options={SPANS.map((s) => ({ value: s.k, label: s.label }))} />
        <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{SPAN[span].range}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 11, marginBottom: 20 }}>
        <KPI icon="users" label="Active members" value={SPAN[span].active} delta={SPAN[span].activeD} deltaKind="good" sublabel={SPAN[span].sub} />
        <KPI icon="star" label="Loyalty redeemed" value={SPAN[span].loyalty} sublabel={SPAN[span].sub} />
        <KPI icon="user-plus" label="New members" value={SPAN[span].fresh} delta={SPAN[span].freshD} deltaKind="good" sublabel={SPAN[span].sub} />
        <KPI icon="crown" label="VIP tier" value={SPAN[span].vip} sublabel="members" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 280px', maxWidth: 380 }}><Field icon="search" placeholder="Search by name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div style={{ flex: 1 }} />
        {nFilt > 0 && <PBtn variant="ghost" size="md" onClick={clearF}>Clear</PBtn>}
        <div style={{ position: 'relative' }}>
          <PBtn variant={nFilt ? 'accent' : 'secondary'} icon="filter" size="md" onClick={() => setFiltOpen((v) => !v)}>Filters{nFilt ? ` · ${nFilt}` : ''}</PBtn>
          {filtOpen && <>
            <div onClick={() => setFiltOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 7px)', right: 0, zIndex: 61, width: 300, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, padding: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Filter members</span>
                <div style={{ flex: 1 }} />
                <IconBtn icon="x" size={14} onClick={() => setFiltOpen(false)} style={{ width: 26, height: 26 }} />
              </div>
              <FRow label="Group" k="group" opts={groups} />
              <FRow label="Customer type" k="type" opts={types} />
              <FRow label="Tier" k="tier" opts={['All', 'VIP', 'Member']} />
              <FRow label="Weedmaps" k="wm" opts={['All', 'Linked', 'In-store']} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <PBtn variant="secondary" size="sm" full onClick={clearF}>Clear all</PBtn>
                <PBtn variant="accent" size="sm" full onClick={() => setFiltOpen(false)}>Show {members.length}</PBtn>
              </div>
            </div>
          </>}
        </div>
        <PBtn variant="secondary" icon="download" size="md">Export</PBtn>
      </div>
      <DataTable columns={cols} rows={members} rowKey={(m) => m.id} onRowClick={(m) => setSel(m)} />
      {members.length === 0 && <div style={{ textAlign: 'center', padding: '34px 20px', color: P.inkMute, fontSize: 13 }}>No members match those filters.</div>}
      {addOpen && <AddMemberModal onClose={() => setAddOpen(false)} onAdd={(m) => {setAdded((a) => [m, ...a]);setAddOpen(false);}} />}
      {showCheckIn && window.CheckInModal && <window.CheckInModal onClose={() => setShowCheckIn(false)} onCheckIn={() => setShowCheckIn(false)} />}
    </div>);

};

// ── Add member — creates the customer record; ID is still verified at check-in ─
function AddMemberModal({ onClose, onAdd }) {
  const P = useP();
  const [v, setV] = React.useState({ name: '', phone: '', email: '', dob: '', type: 'RecreationalUser', group: 'Standard', doc: null });
  const s1 = (k, x) => setV((o) => ({ ...o, [k]: x }));
  // The scan IS the data entry. Reading the PDF417 barcode fills name and DOB
  // in one action — typing them by hand is the fallback, not the path.
  const onScan = (d) => setV((o) => ({ ...o, doc: d, name: o.name || d.name || 'Jordan A. Vasquez', dob: o.dob || d.dob || '09/02/1988' }));
  const ok = v.name.trim() && v.phone.trim() && v.dob.trim() && !!v.doc;
  const submit = () => {
    if (!ok) return;
    onAdd({ id: 'm' + Date.now(), name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() || '—', type: v.type, group: v.group, visits: 0, points: 0, wallet: 0, member: v.group === 'VIP' });
  };
  const Lb = ({ children }) => <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>{children}</div>;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,96%)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-plus" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>Add member</div><div style={{ fontSize: 11, color: P.inkDim }}>Creates the customer record — ID is still verified at check-in</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div>
          <Lb>Government ID — required</Lb>
          {window.IdScanPanel ? <window.IdScanPanel value={v.doc} onChange={onScan} /> :
            <PBtn variant="accent" size="sm" icon="scan" onClick={() => onScan({ scannedAt: 'Just now', photo: true })}>Scan ID &amp; capture photo</PBtn>}
          <div style={{ fontSize: 11, color: P.inkDim, marginTop: 6, lineHeight: 1.45 }}>Scanning reads name, date of birth and expiry off the barcode and fills the fields below — no typing needed.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          <div><Lb>Full name *</Lb><Field placeholder="Jane Doe" value={v.name} onChange={(e) => s1('name', e.target.value)} /></div>
          <div><Lb>Date of birth *</Lb><Field placeholder="MM/DD/YYYY" value={v.dob} onChange={(e) => s1('dob', e.target.value)} /></div>
          <div><Lb>Phone *</Lb><Field icon="phone" placeholder="(951) 555-0100" value={v.phone} onChange={(e) => s1('phone', e.target.value)} /></div>
          <div><Lb>Email</Lb><Field icon="mail" placeholder="jane@example.com" value={v.email} onChange={(e) => s1('email', e.target.value)} /></div>
        </div>
        <div><Lb>Customer type</Lb><Seg full size="sm" value={v.type} onChange={(x) => s1('type', x)} options={[{ value: 'RecreationalUser', label: 'Recreational' }, { value: 'MedicinalUser', label: 'Medicinal' }]} /></div>
        <div><Lb>Group</Lb><Seg full size="sm" value={v.group} onChange={(x) => s1('group', x)} options={[{ value: 'Standard', label: 'Standard' }, { value: 'Delivery', label: 'Delivery' }, { value: 'VIP', label: 'VIP' }]} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}>
          <Icon name="info" size={14} color={P.info} style={{ marginTop: 1, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Date of birth is the age gate, and it comes off the scanned document rather than being typed. Adding a phone lets them order delivery later without ever verifying again.</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" onClick={submit} style={{ opacity: ok ? 1 : .5 }}>Create member</PBtn>
      </div>
    </div>
  </div>;
}

// ── Dedicated member page ──────────────────────────────────────────
function MemberDetailPage({ m, onBack }) {
  const P = useP();const fmt = window.HW.fmt;
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({ name: m.name, phone: m.phone, email: m.email });
  const [modal, setModal] = React.useState(null); // 'wallet' | 'note'
  const [openOrder, setOpenOrder] = React.useState(null);
  const [hotNotes, setHotNotes] = React.useState(() => window.HW_HOT.hotNotesFor(m.id));
  const idv = (window.HW.IDV || {})[m.id] || null;
  const h = m.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const linked = m.id.charCodeAt(m.id.length - 1) % 2 === 0;
  const tier = m.member || m.group === 'VIP' ? 'VIP' : 'Member';
  const since = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][h % 6] + ' 2024';
  const lifetime = m.visits * (38 + h % 64);
  const nextTier = 2000;const prog = Math.min(1, m.points / nextTier);
  const fav = window.HW.favCategory && window.HW.favCategory(m) || ['Flower', 'Vapes', 'Edibles', 'Pre-Rolls'][h % 4];
  const hist = Array.from({ length: Math.min(m.visits, 6) || 1 }).map((_, i) => {const hh = h + i * 53;return { id: 'ORD-' + String(230 - i * 4).padStart(5, '0'), date: ['Jun 14', 'Jun 2', 'May 21', 'May 8', 'Apr 27', 'Apr 12'][i] + ', 2026', items: 1 + hh % 4, total: 24 + hh % 78, channel: hh % 3 === 0 ? 'Delivery' : 'Pickup', wm: linked && i % 3 === 0, status: 'Completed' };});
  const activity = [
  linked ? { icon: 'link', accent: true, t: `Merged from Weedmaps order WM-${88000 + h % 900}`, s: 'System · Jun 2, 2026' } : null,
  { icon: 'star', t: `Redeemed ${200 + h % 400} points · $10 off`, s: 'May 21, 2026' },
  { icon: 'wallet', t: `Wallet credit ${fmt.money(5 + h % 20)} · service recovery`, s: 'May 8, 2026' },
  { icon: 'user-plus', t: 'Member created', s: since }].
  filter(Boolean);
  const kfmt = { visits: m.visits, points: m.points.toLocaleString(), wallet: fmt.money(m.wallet), spend: fmt.money0(lifetime), aov: fmt.money(m.visits ? lifetime / m.visits : 0) };
  const pick = (arr) => arr[h % arr.length];
  const dob = pick(['04/14/1991', '09/02/1988', '12/21/1995', '06/30/1983', '02/11/1979']);
  const idNum = 'CA D' + (1700000 + h * 53129).toString().slice(0, 7);
  const idExp = pick(['08 / 2027', '03 / 2026', '11 / 2028', '05 / 2027']);
  const gender = pick(['Female', 'Male', 'Non-binary', 'Female', 'Male']);
  const isMed = m.type === 'MedicinalUser';
  const mmic = 'MMIC-' + (25800 + h * 137).toString().slice(0, 5);
  const medMd = pick(['Dr. A. Okafor', 'Dr. L. Brandt', 'Dr. S. Patel', 'Dr. R. Nguyen']);
  const medIssued = pick(['Jan 2026', 'Nov 2025', 'Mar 2026', 'Aug 2025']);
  const medExp = pick(['12 / 2026', '06 / 2027', '09 / 2026']);
  const addr = pick([{ street: '418 Mission Trail', city: 'Wildomar', zip: '92595' }, { street: '92 Diamond Dr', city: 'Lake Elsinore', zip: '92530' }, { street: '5571 Grand Ave', city: 'Lakeland Village', zip: '92530' }, { street: '210 Riverside Dr', city: 'Temescal', zip: '92883' }]);
  const idPhotos = [{ id: 'front', label: 'License · front', hue: 210, glyph: 'card' }, { id: 'selfie', label: 'Selfie match', hue: 150, glyph: 'user' }].concat(isMed ? [{ id: 'med', label: 'Medical card', hue: 90, glyph: 'shield' }] : []);
  const KV = ({ k, v, mono }) => <div style={{ padding: '2px 0' }}><div style={{ fontSize: 9, color: P.inkMute, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div><div style={{ fontSize: 12.5, color: P.ink2, fontWeight: 600, fontFamily: mono === false ? P.fontSans : P.fontMono, lineHeight: 1.3, wordBreak: 'break-word' }}>{v}</div></div>;

  const lblU = { fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute };
  const inp = (extra) => ({ padding: '8px 11px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, color: P.ink, fontSize: 13, fontWeight: 600, fontFamily: P.fontSans, outline: 'none', width: '100%', boxSizing: 'border-box', ...extra });
  const HField = ({ icon, label, value, onChange, editing: ed, mono }) => <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 9, color: P.inkMute, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name={icon} size={11} color={P.inkMute} />{label}</div>
    {ed ? <input value={value} onChange={(e) => onChange && onChange(e.target.value)} style={inp()} /> : <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, wordBreak: 'break-word' }}>{value}</div>}
  </div>;
  const Modal = ({ title, children, onClose }) => <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px,96vw)', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}><span style={{ fontSize: 15, fontWeight: 700, color: P.ink, flex: 1 }}>{title}</span><IconBtn icon="x" size={17} onClick={onClose} /></div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  </div>;

  const Sec = ({ icon, title, sub, right, children }) => <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={15} stroke={1.9} /></span>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: 11, color: P.inkDim }}>{sub}</div>}</div>{right}
    </div>{children}
  </Card>;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2, fontSize: 13, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={17} stroke={2.2} />Back to members</button>
        <div style={{ flex: 1 }} />
        <PBtn variant="secondary" size="md" icon="wallet" onClick={() => setModal('wallet')}>Adjust wallet</PBtn>
        <PBtn variant="secondary" size="md" icon="note" onClick={() => setModal('note')}>Add note</PBtn>
        <PBtn variant="accent" size="md" icon={editing ? 'check' : 'pencil'} onClick={() => setEditing((v) => !v)}>{editing ? 'Done editing' : 'Edit member'}</PBtn>
      </div>

      {/* Hot notes sit ABOVE the identity header — they have to be read before
           anyone starts serving, never behind a click into a Notes tab. */}
      <window.HotNotesBanner notes={hotNotes} onAdd={() => setModal('note')} onResolve={(i) => setHotNotes((l) => l.filter((_, x) => x !== i))} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 18px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, marginBottom: 16, boxShadow: P.shadowSm }}>
        <Avatar name={m.name} size={62} crown={m.member} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {editing ? <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inp({ fontSize: 19, fontWeight: 800, maxWidth: 300 })} /> : <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: P.ink }}>{form.name}</span>}
            {tier === 'VIP' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, letterSpacing: '.03em', color: P.accentInk, background: P.accent, padding: '5px 13px', borderRadius: 99, boxShadow: P.shadowSm }}><Icon name="crown" size={16} stroke={2} />VIP</span> : <Pill kind="neutral" dot>Member</Pill>}
            <Pill kind="neutral">{m.group}</Pill>
            <span style={{ fontSize: 12, color: P.inkDim }}>{m.type}</span>
            {linked ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 5, height: 5, borderRadius: 2, background: '#fff' }} />Weedmaps linked</span> : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px 24px', marginTop: 14 }}>
            <HField icon="phone" label="Phone" editing={editing} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} mono />
            <HField icon="mail" label="Email" editing={editing} value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            <HField icon="user" label="Member ID" value={m.id} mono />
            <HField icon="calendar" label="Member since" value={since} />
          </div>
          {/* At a glance — the four numbers that decide how you treat this
              customer. They belong beside the name, not in a right rail you
              have to look for. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(124px,1fr))', gap: 9, marginTop: 15, paddingTop: 15, borderTop: `1px solid ${P.hairline}` }}>
            {[['Visits', kfmt.visits, P.ink, '', 'user-check'], ['Avg order', kfmt.aov, P.ink, 'per visit', 'receipt'], ['Points', kfmt.points, m.points > 1000 ? P.good : P.ink, 'available', 'star'], ['Wallet', kfmt.wallet, m.wallet > 0 ? P.good : P.inkMute, 'balance', 'wallet'], ['Lifetime', kfmt.spend, P.ink, 'spend', 'trending-up']].map(([k, v, c, s, ic]) =>
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '9px 12px' }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={ic} size={14} stroke={1.9} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 8.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}><span style={{ fontSize: 17, fontWeight: 800, color: c, fontFamily: P.fontMono, lineHeight: 1.15 }}>{v}</span>{s && <span style={{ fontSize: 9.5, color: P.inkDim }}>{s}</span>}</div>
                </div>
              </div>)}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Sec icon="shield" title="Identity & compliance" sub="Government ID, verification & address" right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color: P.good, background: P.goodSoft, padding: '3px 9px', borderRadius: 99 }}><Icon name="check-circle" size={12} stroke={2} />ID VERIFIED</span>}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
              {idPhotos.map((p2) => <div key={p2.id} style={{ position: 'relative', width: 236, height: 148, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline2}`, background: `linear-gradient(140deg, hsl(${p2.hue} 36% ${P.mode === 'dark' ? '26%' : '78%'}), hsl(${(p2.hue + 30) % 360} 32% ${P.mode === 'dark' ? '18%' : '66%'}))` }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.mode === 'dark' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.85)' }}>{p2.id === 'selfie' ? <Avatar name={m.name} size={68} /> : <Icon name={p2.glyph} size={48} stroke={1.4} />}</div>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 11px', background: 'linear-gradient(transparent, rgba(0,0,0,.55))', fontSize: 11.5, fontWeight: 700, color: '#fff' }}>{p2.label}</div>
              </div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px 16px' }}>
              <KV k="ID / License #" v={idNum} />
              <KV k="Date of birth" v={dob} />
              <KV k="ID expiration" v={idExp} />
              <KV k="Gender" v={gender} mono={false} />
              <KV k="Address" v={`${addr.street}, ${addr.city}, CA ${addr.zip}`} mono={false} />
            </div>
            <window.DeliveryAddressBook m={m} idAddr={addr} />
            {isMed ? <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 14px', background: P.goodSoft, borderRadius: P.r12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="shield" size={14} stroke={1.9} color={P.good} /><span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.good }}>Medical card · Active</span><span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: P.good }}><Icon name="check-circle" size={12} stroke={2} />Tax-exempt</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px 16px' }}>
                <KV k="MMIC #" v={mmic} />
                <KV k="Expires" v={medExp} />
                <KV k="Recommending MD" v={medMd} mono={false} />
                <KV k="Issued" v={medIssued} />
              </div>
            </div> : <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: P.inkMute }}><Icon name="user" size={13} color={P.inkMute} />Adult-use customer — no medical card on file.</div>}
          </div>
        </Sec>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Sec icon="star" title="Loyalty" sub={`${tier} tier · favorite category ${fav}`}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 26, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{m.points.toLocaleString()}</span><span style={{ fontSize: 12, color: P.inkDim }}>points available</span></div>
              <div style={{ height: 8, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}><span style={{ display: 'block', width: `${Math.round(prog * 100)}%`, height: '100%', background: P.accent }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}><span>{tier}</span><span>{Math.max(0, nextTier - m.points).toLocaleString()} pts to next tier</span></div>
            </div>
          </Sec>

          <Sec icon="receipt" title="Order history" sub={`${m.visits} lifetime orders`} right={<PBtn variant="ghost" size="sm">View all</PBtn>}>
            <div>
              {hist.map((o, i) => <div key={o.id} onClick={() => setOpenOrder(o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontFamily: P.fontMono, fontSize: 11, fontWeight: 700, color: P.ink2, background: P.surface3, padding: '2px 7px', borderRadius: 6 }}>#{o.id}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{o.items} item{o.items > 1 ? 's' : ''} · {o.channel}{o.wm && <span style={{ marginLeft: 7, fontSize: 9, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '1px 6px', borderRadius: 99 }}>WM</span>}</div><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{o.date}</div></div>
                <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{fmt.money(o.total)}</span>
                <Pill kind="good" dot>{o.status}</Pill>
                <Icon name="chevron-right" size={15} stroke={2} color={P.inkFaint} />
              </div>)}
            </div>
          </Sec>

          <Sec icon="clock" title="Activity" sub="What happened, and when">
            <div style={{ padding: '14px 16px' }}>
              {activity.map((e, i) => <div key={i} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 99, background: e.accent ? '#eaf1fb' : P.surface3, color: e.accent ? '#1F5FC0' : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${e.accent ? '#1F5FC0' : P.hairline2}` }}><Icon name={e.icon} size={13} stroke={1.9} /></span>
                  {i < activity.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 14, background: P.hairline2 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: i < activity.length - 1 ? 14 : 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.35 }}>{e.t}</div><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{e.s}</div></div>
              </div>)}
            </div>
          </Sec>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <window.MemberVerificationCard m={m} idv={idv} />

          <Card padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: linked ? P.good : P.inkMute }}>{linked ? 'Linked' : 'In-store only'}</span>
            </div>
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {linked ? <>
                <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This profile was merged from a Weedmaps order. Order history &amp; loyalty are unified.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}><Icon name="link" size={14} color={P.inkMute} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 9, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Merged from</div><div style={{ fontSize: 12, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>WM-{88000 + h % 900}</div></div><span style={{ fontSize: 10.5, color: P.inkMute }}>Jun 2</span></div>
                <PBtn variant="ghost" size="sm" icon="user-off">Unlink Weedmaps identity</PBtn>
              </> : <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>No Weedmaps identity linked. If a Weedmaps order matches this customer, you can merge it from the order.</div>}
            </div>
          </Card>

          <Card padding={0}>
            <div style={{ padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Preferences</div></div>
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: P.inkDim }}>Favorite category</span><span style={{ fontWeight: 600, color: P.ink }}>{fav}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: P.inkDim }}>SMS marketing</span><span style={{ fontWeight: 600, color: h % 2 ? P.good : P.inkMute }}>{h % 2 ? 'Opted in' : 'Off'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: P.inkDim }}>Email marketing</span><span style={{ fontWeight: 600, color: h % 3 ? P.good : P.inkMute }}>{h % 3 ? 'Opted in' : 'Off'}</span></div>
            </div>
          </Card>
        </div>
      </div>
      {modal === 'wallet' && <Modal title="Adjust wallet" onClose={() => setModal(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}><span style={{ fontSize: 11.5, color: P.inkDim }}>Current balance</span><span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, fontFamily: P.fontMono, color: m.wallet > 0 ? P.good : P.ink }}>{fmt.money(m.wallet)}</span></div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={lblU}>Amount</span><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, minHeight: 40 }}><span style={{ color: P.inkMute, fontFamily: P.fontMono, fontWeight: 700 }}>$</span><input defaultValue="10.00" inputMode="decimal" autoFocus style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: P.ink, fontSize: 14, fontWeight: 700, fontFamily: P.fontMono }} /></div></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={lblU}>Reason</span><select style={inp()}>{['Service recovery', 'Refund to wallet', 'Promo credit', 'Correction'].map((o) => <option key={o}>{o}</option>)}</select></label>
          <div style={{ display: 'flex', gap: 9, marginTop: 2 }}><PBtn variant="accent" size="md" full onClick={() => setModal(null)}>Apply credit</PBtn><PBtn variant="secondary" size="md" onClick={() => setModal(null)}>Cancel</PBtn></div>
        </div>
      </Modal>}
      {modal === 'note' && <window.AddNoteModal member={m} onClose={() => setModal(null)}
      onSave={(n) => {if (n.hot) setHotNotes((l) => [{ kind: n.kind, text: n.text, by: n.by, at: n.at, block: n.block }, ...l]);setModal(null);}} />}
      {openOrder && <window.FullOrderView order={openOrder} m={m} onClose={() => setOpenOrder(null)} />}
    </div>);

}

const SETTINGS = [
{ group: 'Store', items: [['Terminal', 'scan'], ['Store Information', 'shop'], ['Notification', 'bell'], ['Tax Management', 'percent']] },
{ group: 'Commerce', items: [['Shop Settings', 'settings'], ['Delivery Management', 'truck'], ['Cannabis Limit Management', 'leaf'], ['Credit Card Fee Settings', 'card']] },
{ group: 'Cash handling', items: [['Cash Drawer', 'cash'], ['Close Shift', 'lock'], ['METRC Sync', 'refresh'], ['Audit Log', 'list']] }];


// ── Cash Drawer settings — the store-level required starting balance ───────
// Managers set one number here. Every drawer in the store opens with exactly
// that amount, so the associate is verifying against a policy rather than
// deciding what to put in.
function CashDrawerSettings({ onClose }) {
  const P = useP();const money = window.HW.fmt.money;
  const POS = window.usePOS();
  const [val, setVal] = React.useState(String(POS.getRequiredFloat()));
  const n = parseFloat(val) || 0;
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 };
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: P.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="cash" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>Cash drawer</div><div style={{ fontSize: 11, color: P.inkDim }}>{window.HW.STORE.name}</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={lbl}>Required starting balance</div>
          <div style={{ maxWidth: 200 }}><Field mono value={val} onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" /></div>
          <div style={{ fontSize: 11, color: P.inkDim, marginTop: 6, lineHeight: 1.5 }}>Every drawer at this store opens with <b style={{ color: P.ink }}>{money(n)}</b>. Associates count the till against this figure to open — they never choose the amount themselves.</div>
        </div>
        <div>
          <div style={lbl}>Common amounts</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[150, 200, 300, 400, 500].map((x) => {const on = n === x;
              return <button key={x} onClick={() => setVal(String(x))} style={{ padding: '6px 13px', borderRadius: 99, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, background: on ? P.accentSoft : P.surface, color: on ? P.mode === 'dark' ? P.accent : '#7A5A00' : P.ink2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontMono }}>{money(x)}</button>;})}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
          <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This is per store — another location can run a different figure. Within this store <b>every drawer matches</b>, which is what makes an open-time count meaningful and a close-time variance real.</div>
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
          <Icon name="lock" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Changing this takes effect on the <b>next</b> drawer opened. Sessions already open keep the balance they were opened with, so their close-out still reconciles correctly.</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" onClick={() => {window.POS.setRequiredFloat(n);onClose();}}>Save · {money(n)}</PBtn>
      </div>
    </div>
  </div>;
}

window.SettingsScreen = function SettingsScreen() {
  const P = useP();
  const POS = window.usePOS();
  const [open, setOpen] = React.useState(null);
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <SectionHead level={1} eyebrow="Settings" title="Settings" subtitle="Configure this terminal and store" />
      {SETTINGS.map((sec) =>
      <div key={sec.group} style={{ marginBottom: 24 }}>
          <Eyebrow style={{ marginBottom: 11 }}>{sec.group}</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(248px,1fr))', gap: 11 }}>
            {sec.items.map(([label, icon]) =>
          <Card key={label} padding={15} hover onClick={() => label === 'Cash Drawer' && setOpen('drawer')} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 38, height: 38, borderRadius: P.r10, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={18} stroke={1.8} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: P.ink }}>{label}</span>
                  {label === 'Cash Drawer' && <span style={{ display: 'block', fontSize: 11, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>Starts at {window.HW.fmt.money(POS.getRequiredFloat())}</span>}
                </span>
                <Icon name="chevron-right" size={16} stroke={2} color={P.inkMute} />
              </Card>
          )}
          </div>
        </div>
      )}
      {open === 'drawer' && <CashDrawerSettings onClose={() => setOpen(null)} />}
    </div>);

};

Object.assign(window, {});