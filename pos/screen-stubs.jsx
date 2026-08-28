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
  // Subscribes to the member/check-in store: a record created here has to show
  // up here, or "it worked" and "it did nothing" look identical.
  const HW = window.useHW();
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [filtOpen, setFiltOpen] = React.useState(false);
  const [f, setF] = React.useState({ group: 'All', type: 'All', wm: 'All', tier: 'All' });
  const [span, setSpan] = React.useState('30d');
  const [showCheckIn, setShowCheckIn] = React.useState(false);
  const setF1 = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const clearF = () => setF({ group: 'All', type: 'All', wm: 'All', tier: 'All' });
  const nFilt = ['group', 'type', 'wm', 'tier'].filter((k) => f[k] !== 'All').length;
  const isLinked = (m) => window.HW.wmLinked(m);
  const [exportOpen, setExportOpen] = React.useState(false);

  const all = HW.MEMBERS;
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
  { label: 'Member', render: (m) => <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}><Avatar name={m.name} size={34} crown={m.member} /><div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{m.phone}</div></div></div> },
  { label: 'Email', render: (m) => <span style={{ fontSize: 12.5, color: P.ink2 }}>{m.email.replace(/(.{2}).*(@.*)/, '$1•••$2')}</span> },
  { label: 'Group', render: (m) => <Pill kind="neutral">{m.group}</Pill> },
  { label: 'Type', render: (m) => <span style={{ fontSize: 12.5, color: P.ink2 }}>{m.type}</span> },
  { label: 'Visits', align: 'right', render: (m) => <span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{m.visits}</span> },
  { label: 'Points', align: 'right', render: (m) => <span style={{ fontFamily: P.fontMono, fontWeight: 600, color: m.points > 1000 ? P.good : P.ink }}>{m.points.toLocaleString()}</span> },
  { label: 'Wallet', align: 'right', render: (m) => <span style={{ fontFamily: P.fontMono, fontWeight: 600, color: m.wallet > 0 ? P.good : P.inkMute }}>{window.HW.fmt.money(m.wallet)}</span> },
  { label: 'Weedmaps', render: (m) => {const linked = window.HW.wmLinked(m);return linked ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}><span style={{ width: 5, height: 5, borderRadius: 2, background: '#fff' }} />Linked</span> : <span style={{ fontSize: 11.5, color: P.inkMute }}>In-store</span>;} },
  { label: '', align: 'right', width: '56px', render: (m) => <IconBtn icon="chevron-right" size={16} style={{ width: 32, height: 32 }} onClick={() => setSel(m)} /> }];

  if (sel) return <MemberDetailPage m={sel} onBack={() => setSel(null)} />;
  const FRow = ({ label, k, opts }) => <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{opts.map((o) => {const on = f[k] === o;return <button key={o} onClick={() => setF1(k, o)} style={{ padding: '5px 11px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>{o}</button>;})}</div>
  </div>;
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionHead level={1} eyebrow="Members" title="Members" subtitle={`${active} active members${nFilt || q ? ` · ${members.length} shown` : ''}`}
      action={<PBtn variant="accent" icon="user-plus" size="md" onClick={() => {setFiltOpen(false);setAddOpen(true);}}>Add Member</PBtn>} />
      {/* Same check-in queue as Orders — the exported component, not a copy, so
          the two can never drift apart. */}
      {window.CheckInStrip && <window.CheckInStrip checkins={HW.CHECKINS} onStartSale={() => {}} onNewCheckIn={() => setShowCheckIn(true)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Showing</span>
        <Seg size="sm" value={span} onChange={setSpan} options={SPANS.map((s) => ({ value: s.k, label: s.label }))} />
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{SPAN[span].range}</span>
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
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Filter members</span>
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
        <PBtn variant="secondary" icon="download" size="md" onClick={() => setExportOpen(true)}>Export</PBtn>
      </div>
      <DataTable columns={cols} rows={members} rowKey={(m) => m.id} onRowClick={(m) => setSel(m)} />
      {members.length === 0 && <div style={{ textAlign: 'center', padding: '34px 20px', color: P.inkMute, fontSize: 13.5 }}>No members match those filters.</div>}
      {exportOpen && <ExportMembersModal rows={members} total={all.length} narrowed={nFilt > 0 || !!q} onClose={() => setExportOpen(false)} />}
      {addOpen && <AddMemberModal onClose={() => setAddOpen(false)} onAdd={(m) => {window.HW.addMember(m);setAddOpen(false);}} />}
      {/* The modal hands back {customer, guests, type, delivery} — dropping it
          was the whole bug: the flow completed and created nothing. */}
      {showCheckIn && window.CheckInModal && <window.CheckInModal onClose={() => setShowCheckIn(false)} onCheckIn={(p) => {
        // addCheckIn REFUSES (returns null) when the payload carries no
        // customer. Closing the modal on that branch is the flow reporting
        // completion with nothing written — the same defect the comment above
        // describes, one step quieter. This screen has no toast, so the honest
        // refusal signal is the modal STAYING OPEN with the operator's form
        // still on it, rather than vanishing as though it had worked.
        const ci = window.HW.addCheckIn(p);
        if (!ci) return;
        setShowCheckIn(false);
      }} />}
    </div>);

};

// ── Export — the rows you are looking at, as CSV ───────────────────────────
//
// 'Export' had no handler. It exports what is ON SCREEN, filters and search
// included, because exporting all 5,000 members from a filtered view is the
// classic way to hand somebody the wrong spreadsheet — so the count and the
// caveat are stated before anything is saved. The CSV is shown as well as
// offered: a browser that blocks the download still leaves it copyable.
function ExportMembersModal({ rows, total, narrowed, onClose }) {
  const P = useP();
  const COLS = [
  ['Name', (m) => m.name], ['Email', (m) => m.email], ['Phone', (m) => m.phone],
  ['Group', (m) => m.group], ['Type', (m) => m.type], ['Visits', (m) => m.visits],
  ['Points', (m) => m.points], ['Wallet', (m) => m.wallet],
  ['Weedmaps', (m) => window.HW.wmLinked(m) ? 'Linked' : 'In-store']];
  const cell = (v) => {const t = String(v == null ? '' : v);return (/[",\n]/).test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;};
  const csv = [COLS.map((c) => c[0]).join(',')].concat(rows.map((m) => COLS.map(([, f]) => cell(f(m))).join(','))).join('\n');
  const href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  return (
    <div onClick={onClose} style={window.overlayScrim(P, { z: 120, padding: '48px 20px', animate: true })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(620px, 96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="download" size={16} stroke={2} color={P.accent} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: P.ink }}>Export {rows.length} member{rows.length === 1 ? '' : 's'}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>members.csv · {COLS.length} columns</span>
          </span>
          <IconBtn icon="x" size={17} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {narrowed &&
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
              <Icon name="filter" size={15} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This exports the <b>{rows.length}</b> row{rows.length === 1 ? '' : 's'} your search and filters leave on screen — not all {total}. Clear them first if you want the whole book.</div>
            </div>}
          {rows.length === 0 ?
          <div style={{ fontSize: 12.5, color: P.inkMute }}>Nothing to export — no members match the current filters.</div> : <>
            <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', padding: 12, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>{csv}</pre>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 11.5, color: P.inkDim }}>Nothing leaves the browser — the file is built here.</span>
              <div style={{ flex: 1 }} />
              <a href={href} download="members.csv" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: P.ctrlH.md, padding: '0 16px', borderRadius: P.r8, background: P.accent, color: P.accentInk, border: `1px solid ${P.accentBorder}`, fontSize: 13.5, fontWeight: 600, textDecoration: 'none', fontFamily: P.fontSans }}>
                <Icon name="download" size={15} stroke={2} />Download members.csv
              </a>
            </div>
          </>}
        </div>
      </div>
    </div>);

}

// ── Add member — creates the customer record; ID is still verified at check-in ─
function AddMemberModal({ onClose, onAdd }) {
  const P = useP();
  // ONE FIELD PER PARAMETER [OWNER RULING 2026-08-27]. This modal held a single
  // "Full name *" box. The server takes `first_name`/`last_name` SEPARATELY
  // (wmdemo/server.py:4843 has no joined-name key on any create path) and
  // fingerprints identity on the pair, so the joined box was never the wire
  // format — it was a lossy local detour that something downstream then had to
  // reverse BY GUESSING, and that guess is what decides whether two records are
  // the same person. Captured separately, nothing has to guess.
  const [v, setV] = React.useState({ first: '', last: '', nameGuessed: false, nameGuessNote: '',
    phone: '', email: '', dob: '', type: 'RecreationalUser', group: 'Standard', doc: null });
  const s1 = (k, x) => setV((o) => ({ ...o, [k]: x }));
  // The scan IS the data entry. The PDF417 barcode carries family name and
  // given name as DISTINCT elements, so the scan fills the two fields from the
  // two document elements — no joining, no re-splitting.
  //
  // TWO INVENTED VALUES REMOVED HERE. This read `d.name || 'Jordan A. Vasquez'`
  // and `d.dob || '09/02/1988'`: a scan that returned no name or no date of
  // birth silently filled in a made-up person and a made-up birthday, on the
  // COMPLIANCE path, and the gate below then saw a full form and let it
  // through. A scan that yields nothing now leaves the fields empty and the
  // gate refuses out loud, which is the honest outcome.
  //
  // `nameGuessed` travels WITH the document (pos/verification.jsx). It is true
  // only on the book-matched branch, where the split was derived from a stored
  // joined name; a document read has nothing to guess and arrives false. The
  // flag is adopted only for halves the scan actually filled — a name the
  // operator typed themselves is not a guess this modal gets to relabel.
  const onScan = (d) => setV((o) => {
    const first = o.first || d.firstName || '';
    const last = o.last || d.lastName || '';
    const filledFromDoc = (!o.first && !!d.firstName) || (!o.last && !!d.lastName);
    return { ...o, doc: d, first, last,
      nameGuessed: filledFromDoc ? !!d.nameGuessed : o.nameGuessed,
      nameGuessNote: filledFromDoc ? d.nameGuessNote || '' : o.nameGuessNote,
      dob: o.dob || d.dob || '' };
  });
  // The gate was already right. What was missing was SAYING so: the button had
  // no `disabled` and no message, so clicking it did nothing and named no
  // reason — and the real blocker (the un-scanned ID) was never on screen.
  //
  // A LAST NAME IS NOT REQUIRED, DELIBERATELY. Mononyms exist, and refusing to
  // create one is worse than creating it without a surname: the alternative an
  // operator reaches for is typing the single name into BOTH boxes, which mints
  // a fingerprint for a surname we do not have and collides that customer with
  // every real person carrying it. Empty stays empty, and the note under the
  // fields says what that costs.
  const missing = [
  !v.doc && 'scan the government ID',
  !v.first.trim() && 'a first name',
  !v.dob.trim() && 'a date of birth',
  !v.phone.trim() && 'a phone number'].
  filter(Boolean);
  const ok = missing.length === 0;
  const needs = !missing.length ? '' : missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  const submit = () => {
    if (!ok) return;
    const first = v.first.trim(), last = v.last.trim();
    // `first_name`/`last_name` are what was CAPTURED and what the server takes.
    // The key names are not arbitrary: pos/verification.jsx:807 already prefers
    // `m.first_name || m.last_name` over splitting `m.name`, so a member created
    // here scans back with `nameGuessed:false` — the guess disappears at the
    // source instead of being marked forever downstream.
    // `name` is DERIVED and kept so every existing reader of `m.name` (the
    // table, search, the avatar, the CSV export) keeps working. Two independent
    // copies of one fact is how they drift apart; one derived from the other
    // cannot.
    onAdd({ id: 'm' + Date.now(), first_name: first, last_name: last,
      name: window.HWName ? window.HWName.join(first, last) : [first, last].filter(Boolean).join(' '),
      phone: v.phone.trim(), email: v.email.trim() || '—', type: v.type, group: v.group, visits: 0, points: 0, wallet: 0, member: v.group === 'VIP' });
  };
  const Lb = ({ children }) => <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>{children}</div>;
  // THIS MODAL COULD NOT BE SUBMITTED, AND THE MONONYM CASE WAS THE WORST OF IT.
  // The overlay was a non-scrolling `alignItems:'center'` scrim, so a card taller
  // than the viewport overflowed off BOTH edges with no scroll container to reach
  // it. At 1440x800 that put "Create member" at y=824 — off-screen — and a member
  // could not be created at all. At 1440x900 it fitted by 6px until you typed a
  // first name and no last name: the mononym note below adds 59px and pushed the
  // button to y=908. The note that exists to protect mononyms was what made the
  // mononym case impossible to complete.
  //
  // The fix is the CONTAINER, not the content. `overlayScrim` scrolls and the
  // card centres via auto margins, which collapse to flush-top when the card is
  // taller than the viewport — so this survives any height and no future note can
  // bring the bug back. The note stays exactly as written, and a last name stays
  // optional: see the gate above for why an empty surname is the correct record.
  return <div onClick={onClose} style={window.overlayScrim(P, { z: 200, padding: 20 })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(520px,96%)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user-plus" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Add member</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Creates the customer record — ID is still verified at check-in</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div>
          <Lb>Government ID — required</Lb>
          {window.IdScanPanel ? <window.IdScanPanel value={v.doc} onChange={onScan} /> :
            <PBtn variant="accent" size="sm" icon="scan" onClick={() => onScan({ scannedAt: 'Just now', photo: true })}>Scan ID &amp; capture photo</PBtn>}
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 6, lineHeight: 1.45 }}>Scanning reads name, date of birth and expiry off the barcode and fills the fields below — no typing needed.</div>
        </div>
        {/* ONE BOX PER PARAMETER. This grid held a single "Full name *"; it now
             holds the two fields the server actually takes. Layout note that
             jsdom cannot check: the two name boxes replace one box in the SAME
             two-column grid, so the row count is unchanged and nothing below
             moved — but that is a claim about pixels, and only a browser can
             settle it. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          <div><Lb>First name *</Lb><Field placeholder="Jane" value={v.first} onChange={(e) => s1('first', e.target.value)} /></div>
          <div><Lb>Last name</Lb><Field placeholder="Doe" value={v.last} onChange={(e) => s1('last', e.target.value)} /></div>
          <div><Lb>Date of birth *</Lb><Field placeholder="MM/DD/YYYY" value={v.dob} onChange={(e) => s1('dob', e.target.value)} /></div>
          <div><Lb>Phone *</Lb><Field icon="phone" placeholder="(951) 555-0100" value={v.phone} onChange={(e) => s1('phone', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Lb>Email</Lb><Field icon="mail" placeholder="jane@example.com" value={v.email} onChange={(e) => s1('email', e.target.value)} /></div>
        </div>
        {/* A GUESSED SPLIT IS MARKED, AND THE MARK NAMES THE FAILURE MODE. This
             fires only on the book-matched scan branch, where the two boxes were
             carved out of one stored joined string. A document read arrives
             already split and shows nothing here — if the easy case warned too,
             the warning would be on screen permanently and mean nothing. */}
        {v.nameGuessed &&
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.warnSoft, borderRadius: P.r10, border: `1px solid ${P.warn}40` }}>
          <Icon name="alert" size={14} color={P.warn} style={{ marginTop: 1, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>These two boxes are a guess, not a reading.</b> This customer was matched from the existing book, which stores one joined name and no separate columns — so the boundary between first and last was inferred here, not read off the document. {v.nameGuessNote} Check both against the ID and correct them before creating the record.</span>
        </div>}
        {/* An empty surname is allowed and is not an error, so it gets a plain
             statement of consequence rather than a warning colour. */}
        {!!v.first.trim() && !v.last.trim() &&
        <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>No last name — saved as a single given name. That is correct for a mononym, and it means this record carries no name+DOB fingerprint, so it will not auto-match a returning customer. Do not copy the first name into the last name box to fill it.</div>}
        <div><Lb>Customer type</Lb><Seg full size="sm" value={v.type} onChange={(x) => s1('type', x)} options={[{ value: 'RecreationalUser', label: 'Recreational' }, { value: 'MedicinalUser', label: 'Medicinal' }]} /></div>
        <div><Lb>Group</Lb><Seg full size="sm" value={v.group} onChange={(x) => s1('group', x)} options={[{ value: 'Standard', label: 'Standard' }, { value: 'Delivery', label: 'Delivery' }, { value: 'VIP', label: 'VIP' }]} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: P.infoSoft, borderRadius: P.r10 }}>
          <Icon name="info" size={14} color={P.info} style={{ marginTop: 1, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Date of birth is the age gate, and it comes off the scanned document rather than being typed. Adding a phone lets them order delivery later without ever verifying again.</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {!ok && <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: P.warn, fontWeight: 600, lineHeight: 1.4 }}>Still needs {needs}.</span>}
        <div style={{ flex: ok ? 1 : '0 0 auto' }} />
        <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
        <PBtn variant="accent" size="md" icon="check" onClick={submit} disabled={!ok} title={ok ? undefined : `Still needs ${needs}`}>Create member</PBtn>
      </div>
    </div>
  </div>;
}

// ── Member-page section wrapper ─────────────────────────────────────────────
// Module scope on purpose: a component defined inside a render gets a new
// identity on every state change, and React then remounts its whole subtree —
// which silently wipes the state of anything stateful inside it.
function Sec({ icon, title, sub, right, children }) {
  const P = useP();
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={15} stroke={1.9} /></span>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: 11.5, color: P.inkDim }}>{sub}</div>}</div>{right}
    </div>{children}
  </Card>;
}

// ── Dedicated member page ──────────────────────────────────────────
function MemberDetailPage({ m, onBack }) {
  const P = useP();const fmt = window.HW.fmt;
  // A wallet credit and a member edit both WRITE — this page has to re-render
  // off the store, not off a copy it made when it opened.
  window.useHW();
  const [editing, setEditing] = React.useState(false);
  // ── EDITING A NAME THAT WAS STORED JOINED [OWNER RULING 2026-08-27] ───────
  // This form held one `name` box. The two fields below are the ones the server
  // takes, so they are what the operator must be able to edit.
  //
  // WHERE THE SPLIT COMES FROM DECIDES WHETHER IT IS A GUESS. A member created
  // since the ruling carries real `first_name`/`last_name` columns: those are
  // READ, and reading is not guessing. A legacy row carries only a joined
  // `name`, so its two boxes are carved out of one string by
  // `HWName.splitGuess` — an INFERENCE, and it is marked as one and stays
  // editable. `Nina Alvarez` is marked too: if the easy case reported itself as
  // certain, operators would learn to trust the mark and it would mean nothing
  // on `Mary Jo Van Der Berg`.
  //
  // `name` is held separately and NOT re-derived while the form sits idle, so a
  // legacy row displays byte-for-byte as it was saved. It is recomputed only on
  // Save, from what the operator actually left in the two boxes.
  const nameSplit0 = () => {
    if (m.first_name || m.last_name) return { first: m.first_name || '', last: m.last_name || '', guessed: false, note: '' };
    return window.HWName ? window.HWName.splitGuess(m.name) : { first: m.name || '', last: '', guessed: false, note: '' };
  };
  const blankForm = () => {const g = nameSplit0();
    return { name: m.name, first: g.first, last: g.last, nameGuessed: !!g.guessed, nameGuessNote: g.note || '', phone: m.phone, email: m.email };};
  const [form, setForm] = React.useState(blankForm);
  const [modal, setModal] = React.useState(null); // 'wallet' | 'note'
  const [openOrder, setOpenOrder] = React.useState(null);
  const [hotNotes, setHotNotes] = React.useState(() => window.HW_HOT.hotNotesFor(m.id));
  const [notes, setNotes] = React.useState(() => window.HW_HOT.notesFor(m.id));
  // Adjust-wallet was an uncontrolled input nobody ever read. Both fields live
  // here now, so "Apply credit" applies the amount that is on screen.
  const [wAmt, setWAmt] = React.useState('10.00');
  const [wReason, setWReason] = React.useState('Service recovery');
  const wNum = parseFloat(wAmt);
  const wOk = isFinite(wNum) && wNum > 0;
  const openWallet = () => {setWAmt('10.00');setWReason('Service recovery');setModal('wallet');};
  const applyCredit = () => {
    if (!wOk) return;
    const r = window.HW.creditWallet(m.id, wNum, wReason);
    if (r) setLogged((l) => [{ icon: 'wallet', accent: true, t: `Wallet credit ${fmt.money(r.amount)} · ${r.reason}`, s: 'Manisha Saini · Just now' }, ...l]);
    setModal(null);
  };
  // "Done editing" used to only flip a boolean — the edits lived in `form` and
  // died there, while the header went on showing them until you navigated away.
  // The whole `form` used to be spread onto the record, which would now also
  // write the form's own bookkeeping (`nameGuessed`, `nameGuessNote`) into the
  // member as if they were customer data. Only the captured parameters are
  // written, and `name` is DERIVED from the pair so the two cannot drift.
  const saveEdits = () => {
    const first = String(form.first || '').trim(), last = String(form.last || '').trim();
    const joined = window.HWName ? window.HWName.join(first, last) : [first, last].filter(Boolean).join(' ');
    const saved = window.HW.updateMember(m.id, { first_name: first, last_name: last, name: joined, phone: form.phone, email: form.email });
    // 🔴 THE COMMENT HERE USED TO READ "// Saved." OVER AN UNCHECKED RETURN.
    // updateMember returns null when the id no longer resolves (pos/data.jsx:
    // `if (!m || !patch) return null`), and this cleared the guessed mark on
    // that branch too — which is WORSE THAN A MISSING TOAST, and the reason
    // this site was fixed ahead of the others.
    //
    // `nameGuessed` is not decoration. It is the standing warning that the
    // first/last boxes were INFERRED from one joined string rather than read
    // off a document, and the panel at line ~584 renders it as "These two boxes
    // are a guess… saving is what turns the guess into two real columns".
    // Clearing it is a claim that a human confirmed the boundary and the store
    // now holds two real columns. Clearing it on a refused write left the
    // record LOOKING VERIFIED while nothing had been written: the warning that
    // existed precisely to stop a bad split propagating was gone, the operator
    // had been shown a screen that agreed with them, and the next reader — the
    // identity fingerprint that decides whether two records are one person —
    // would trust a boundary nobody ever confirmed. A silent no-op degrades to
    // stale data; this degraded to CONFIDENT stale data.
    //
    // So the mark is cleared on the WRITTEN BRANCH ONLY, and a refusal says so
    // out loud in the activity log — the same shape applyCredit() above already
    // uses for creditWallet. Editing stays open on refusal: the operator's
    // typed values are still on screen and still unsaved, which is the truth.
    if (!saved) {
      setLogged((l) => [{ icon: 'alert', accent: true, t: 'Edits NOT saved — this member is no longer in the book', s: 'Just now' }, ...l]);
      return;
    }
    // Saved. The split is no longer an inference waiting to be checked — the
    // operator was shown the mark and committed these two values, so the record
    // now HAS separate columns and nothing downstream needs to guess again.
    setForm((f) => ({ ...f, name: joined, nameGuessed: false, nameGuessNote: '' }));
    setEditing(false);
  };
  const idv = (window.HW.IDV || {})[m.id] || null;
  // Was derived from the id's last character, which is why "Unlink Weedmaps
  // identity" had nothing to write to. HW.wmLinked keeps the derivation as the
  // seed and lets a real write win.
  const linked = window.HW.wmLinked(m);
  const [allHist, setAllHist] = React.useState(false);
  const [unlinkAsk, setUnlinkAsk] = React.useState(false);
  const tier = m.member || m.group === 'VIP' ? 'VIP' : 'Member';
  // ── MONEY IS NOT A FUNCTION OF HOW A CUSTOMER ID SPELLS ─────────────────
  // `since`, `lifetime`, spend, AOV and the whole order history were derived
  // from `h` — a character-code sum of m.id. That is the deleted char-hash
  // confidence score, still alive and now denominated in dollars: an operator
  // reads a lifetime spend and an average order value to decide whether to
  // comp, upgrade, or move someone up the queue. A number that measures nothing
  // is worse than a blank here, because a blank prompts a question.
  //
  // What is REAL: HW.ORDERS. Spend and AOV come from the orders this customer
  // actually has, and 'not recorded' is what shows when there are none — the
  // treatment screen-brands.jsx uses for exactly this.
  const myOrders = (window.HW.ORDERS || []).filter((o) => o.name === m.name);
  const lifetime = myOrders.reduce((a, o) => a + (+o.total || 0), 0);
  const hasSpend = myOrders.length > 0;
  // 'Member since Mar 2024' was the same fiction wearing a date. There is no
  // created-at on a member record, so there is nothing to say.
  const since = m.createdAt || null;
  const nextTier = 2000;const prog = Math.min(1, m.points / nextTier);
  // favCategory reads real purchase history. When it has none the answer is
  // "we do not know", not a category picked out of a list by `h % 4`.
  const fav = window.HW.favCategory && window.HW.favCategory(m) || null;
  // 'View all' was inert because the list stopped at six and there was nothing
  // else to show. The generator now runs the customer's whole visit count —
  // dates walk backwards a fortnight at a time past the six hand-written ones —
  // so the control has a second state to move to, and the count it names is the
  // count the member record claims.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const histDate = (i) => {
    if (i < 6) return ['Jun 14', 'Jun 2', 'May 21', 'May 8', 'Apr 27', 'Apr 12'][i] + ', 2026';
    const d = new Date(2026, 3, 12);
    d.setDate(d.getDate() - (i - 5) * 14);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };
  // The order history is the REAL order list for this customer, PLUS clearly
  // marked simulated rows when the demo needs depth. It used to be generated
  // entirely from `h + i * 53` — ids, dates, item counts and totals invented
  // per visit, with no DEMO mark anywhere on it. The generator now lives in
  // shared/demo-seed.js, every row it produces carries `simulated: true`, and
  // NONE of them reach spend or AOV.
  const realHist = myOrders.map((o) => ({ id: o.id, date: histDate(0), items: o.items, total: o.total,
    channel: o.channel === 'Delivery' ? 'Delivery' : 'Pickup', wm: o.source === 'Weedmaps', status: 'Completed' }));
  const simHist = window.HWSeed && window.HWSeed.memberHistory ? window.HWSeed.memberHistory(m, realHist.length) : [];
  const histAll = realHist.concat(simHist);
  const hist = allHist ? histAll : histAll.slice(0, 6);
  const activityBase = [
  since ? { icon: 'user-plus', t: 'Member created', s: since } : null].
  filter(Boolean);
  // Verification actions taken on this profile land in the feed immediately.
  const [logged, setLogged] = React.useState([]);
  const onLog = (e) => setLogged((l) => [{ icon: e.icon || 'shield', accent: true, t: e.action, s: `${e.who} · ${e.time}` }, ...l]);
  const activity = [...notes.map((n) => ({ icon: 'note', t: n.text, s: `${n.by} · ${n.at}` })), ...logged, ...activityBase];
  const kfmt = { visits: m.visits, points: m.points.toLocaleString(), wallet: fmt.money(m.wallet),
    spend: hasSpend ? fmt.money0(lifetime) : 'not recorded',
    aov: hasSpend ? fmt.money(lifetime / myOrders.length) : 'not recorded' };
  // ── THE COMPLIANCE CARD MAY NOT INVENT A DOCUMENT ───────────────────────
  // Same defect as the money above, on a surface where it is worse: the
  // licence number was `'CA D' + (1700000 + h * 53129)`, the date of birth and
  // the expiry were picked out of a list by `h % n`, and the medical card —
  // MMIC number, recommending physician, issue and expiry — was generated the
  // same way and rendered under a green "Medical card · Active / Tax-exempt"
  // header. Those are the fabricated-METRC-id class of claim, on the one card
  // an operator opens to answer a regulator.
  //
  // What is REAL is the IDV ledger: doc.num, doc.type and doc.expires are
  // written by an actual scan. Everything else says so.
  const NR = 'not recorded';
  const idDoc = idv && idv.doc || null;
  const idNum = idDoc && idDoc.num ? (idDoc.type ? idDoc.type + ' ' + idDoc.num : idDoc.num) : NR;
  const idExp = idDoc && idDoc.expires ? idDoc.expires : NR;
  // No surface in this estate stores a date of birth or a gender on the member
  // record — the scan reads a DOB but nothing persists it yet.
  const dob = NR;
  const gender = NR;
  const isMed = m.type === 'MedicinalUser';
  // A medical card is a document with a number, a physician and an expiry. We
  // hold none of them, so the block says that rather than printing four.
  const mmic = NR, medMd = NR, medIssued = NR, medExp = NR;
  // THE ADDRESS WAS THE ONE SURVIVOR OF THE CHAR-HASH PURGE, AND THAT MADE IT
  // WORSE. `pick([...])` chose a street out of a list of four by `h % 4` — the
  // same character-code sum that used to denominate lifetime spend. Sitting in
  // a grid where the four fields above it now honestly read 'not recorded', the
  // one populated value read as the one fact that IS on the licence: an
  // operator answering "what address is on his ID" read out a string derived
  // from how the customer id happens to spell, and a driver was dispatched to
  // it. The ID address is a COMPLIANCE field — it comes off the scanned
  // document or it does not exist.
  const idAddr = idDoc && idDoc.address || null;
  // THE STATE IS READ, NOT ASSUMED [OWNER RULING 2026-08-27]. This line ended
  // in `idAddr.state || 'CA'`, so an address whose state was missing rendered as
  // Californian — on the COMPLIANCE card, the one place an operator goes to
  // answer "what does the ID say". It is latent only because every fixture
  // currently carries a real state (one of them NV), and it starts fabricating
  // the moment a scanner emits a state-less address. The identical defect was
  // already removed from pos/customer-extras.jsx, where it made every
  // out-of-state address on file display as Californian.
  //
  // An absent part is now DROPPED, never printed as `undefined` and never
  // invented. `street` is the joined value the scan derives from its own split
  // pair (pos/verification.jsx), so this reader keeps working unchanged; a
  // legacy row is rendered exactly as it was saved and is never re-split here.
  const addrText = idAddr
    ? [[idAddr.street, idAddr.city].filter(Boolean).join(', '),
       [idAddr.state, idAddr.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') || NR
    : NR;
  // Said out loud rather than silently absorbed: a missing state on a
  // compliance record is a gap someone has to close, not a formatting detail.
  const addrStateMissing = !!(idAddr && !idAddr.state);
  // A PHOTO TILE IS A CLAIM THAT THE PHOTO WAS TAKEN.
  // This was a constant list computed from nothing but `m.type`, so a customer
  // whose ladder says "Nobody has seen a document yet" still got a captioned
  // "License · front" and a "Selfie match" tile, and a Medicinal customer got a
  // "Medical card" tile ten lines above the block saying no medical card is
  // held. The card contradicted itself inside one viewport and the picture won.
  // 'Selfie match' was the worst of the three: it names a biometric comparison
  // result, and nothing in this estate performs one.
  //
  // Tiles are now derived from the evidence: front only when the ledger holds a
  // document photo, and the medical tile only when a medical card record
  // exists — which is never, today. No images ⇒ one honest empty block.
  const idPhotos = idDoc && idDoc.photo ? [{ id: 'front', label: 'License · front', hue: 210, glyph: 'card', simulated: !!idDoc.simulated }] : [];
  // THE SCANNER'S DEMO MARK AND THE CARD'S MARK READ THE SAME FIELD.
  // Every document this build can produce carries `simulated: true`
  // (verification.jsx stamps it on both branches and shows a DEMO chip beside
  // the name at capture), and addCheckIn writes that same object straight into
  // IDV. `doc.simulated` was never read here, so the mark was present in the
  // data and dropped in transit between the scanner and the compliance card —
  // the lesson was applied to the money (the simulated order rows below) and
  // not to the document. Same chip, both surfaces.
  const DemoChip = () => <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', color: P.warn, background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: 4, padding: '1px 5px', flex: '0 0 auto' }}>DEMO</span>;
  const KV = ({ k, v, mono, mark }) => <div style={{ padding: '2px 0' }}><div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div><div style={{ fontSize: 12.5, color: P.ink2, fontWeight: 600, fontFamily: mono === false ? P.fontSans : P.fontMono, lineHeight: 1.3, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{v}{mark ? <DemoChip /> : null}</div></div>;

  const lblU = { fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute };
  const inp = (extra) => ({ padding: '8px 11px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, color: P.ink, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, outline: 'none', width: '100%', boxSizing: 'border-box', ...extra });
  const HField = ({ icon, label, value, onChange, editing: ed, mono }) => <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name={icon} size={11} color={P.inkMute} />{label}</div>
    {ed ? <input value={value} onChange={(e) => onChange && onChange(e.target.value)} style={inp()} /> : <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, wordBreak: 'break-word' }}>{value}</div>}
  </div>;
  // Same non-scrolling scrim as Add-member had. This one is short TODAY, which is
  // exactly the argument that keeps producing the bug — it is a generic wrapper,
  // so its height is whatever a future caller passes as `children`.
  const Modal = ({ title, children, onClose }) => <div onClick={onClose} style={window.overlayScrim(P, { z: 80, padding: 20 })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(440px,96vw)', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}><span style={{ fontSize: 15, fontWeight: 700, color: P.ink, flex: 1 }}>{title}</span><IconBtn icon="x" size={17} onClick={onClose} /></div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  </div>;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2, fontSize: 13.5, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={17} stroke={2.2} />Back to members</button>
        <div style={{ flex: 1 }} />
        <PBtn variant="secondary" size="md" icon="wallet" onClick={openWallet}>Adjust wallet</PBtn>
        <PBtn variant="secondary" size="md" icon="note" onClick={() => setModal('note')}>Add note</PBtn>
        {editing && <PBtn variant="secondary" size="md" onClick={() => {setForm(blankForm());setEditing(false);}}>Discard</PBtn>}
        <PBtn variant="accent" size="md" icon={editing ? 'check' : 'pencil'} onClick={() => editing ? saveEdits() : setEditing(true)}>{editing ? 'Save changes' : 'Edit member'}</PBtn>
      </div>

      {/* Hot notes sit ABOVE the identity header — they have to be read before
           anyone starts serving, never behind a click into a Notes tab. */}
      <window.HotNotesBanner notes={hotNotes} onAdd={() => setModal('note')} onResolve={(i) => setHotNotes((l) => l.filter((_, x) => x !== i))} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 18px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, marginBottom: 16, boxShadow: P.shadowSm }}>
        <Avatar name={m.name} size={62} crown={m.member} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {editing ?
            <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={form.first} placeholder="First name" onChange={(e) => setForm((f) => ({ ...f, first: e.target.value }))} style={inp({ fontSize: 21, fontWeight: 800, maxWidth: 190 })} />
              <input value={form.last} placeholder="Last name" onChange={(e) => setForm((f) => ({ ...f, last: e.target.value }))} style={inp({ fontSize: 21, fontWeight: 800, maxWidth: 190 })} />
            </span> :
            /* NOT re-split for display. A legacy row renders exactly the joined
               string it was saved with; re-splitting stored data on the way to
               the screen would invent a boundary nobody typed. */
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: P.ink }}>{form.name}</span>}
            {tier === 'VIP' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 800, letterSpacing: '.03em', color: P.accentInk, background: P.accent, padding: '5px 13px', borderRadius: 99, boxShadow: P.shadowSm }}><Icon name="crown" size={16} stroke={2} />VIP</span> : <Pill kind="neutral" dot>Member</Pill>}
            <Pill kind="neutral">{m.group}</Pill>
            <span style={{ fontSize: 12.5, color: P.inkDim }}>{m.type}</span>
            {linked ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 5, height: 5, borderRadius: 2, background: '#fff' }} />Weedmaps linked</span> : null}
          </div>
          {/* THE MARK IS ON SCREEN WHILE THE GUESS IS EDITABLE, which is the
               only moment it can still be acted on. It appears only for a
               legacy row whose two boxes were carved out of one stored string —
               a record with real first/last columns is read, not guessed, and
               shows nothing here. */}
          {editing && form.nameGuessed &&
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginTop: 10, background: P.warnSoft, borderRadius: P.r10, border: `1px solid ${P.warn}40` }}>
            <Icon name="alert" size={14} color={P.warn} style={{ marginTop: 1, flex: '0 0 auto' }} />
            <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>These two boxes are a guess.</b> This record was saved with one joined name and no separate first/last columns, so the boundary between them was inferred just now — it is not what anyone typed and not what a document said. {form.nameGuessNote} Correct them before saving; saving is what turns the guess into two real columns.</span>
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px 24px', marginTop: 14 }}>
            <HField icon="phone" label="Phone" editing={editing} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} mono />
            <HField icon="mail" label="Email" editing={editing} value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            <HField icon="user" label="Member ID" value={m.id} mono />
            <HField icon="calendar" label="Member since" value={since || 'not recorded'} />
          </div>
          {/* At a glance — the four numbers that decide how you treat this
              customer. They belong beside the name, not in a right rail you
              have to look for. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(124px,1fr))', gap: 9, marginTop: 15, paddingTop: 15, borderTop: `1px solid ${P.hairline}` }}>
            {[['Visits', kfmt.visits, P.ink, '', 'user-check'], ['Avg order', kfmt.aov, hasSpend ? P.ink : P.inkMute, hasSpend ? 'per recorded order' : '', 'receipt'], ['Points', kfmt.points, m.points > 1000 ? P.good : P.ink, 'available', 'star'], ['Wallet', kfmt.wallet, m.wallet > 0 ? P.good : P.inkMute, 'balance', 'wallet'], ['Lifetime', kfmt.spend, hasSpend ? P.ink : P.inkMute, hasSpend ? 'spend on record' : '', 'trending-up']].map(([k, v, c, s, ic]) =>
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '9px 12px' }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: P.surface3, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={ic} size={14} stroke={1.9} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}><span style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: P.fontMono, lineHeight: 1.15 }}>{v}</span>{s && <span style={{ fontSize: 10, color: P.inkDim }}>{s}</span>}</div>
                </div>
              </div>)}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Sec icon="shield" title="Identity & compliance" sub="Government ID, verification & address" right={<window.AssuranceBadge v={idv} size="sm" />}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Assurance + phone confirmation live HERE — people look for the SMS
                step under identity, not in a right rail below the fold. */}
            <window.MemberVerificationCard m={m} idv={idv} onLog={onLog} />
            {idPhotos.length > 0 ?
            <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
              {idPhotos.map((p2) => <div key={p2.id} style={{ position: 'relative', width: 236, height: 148, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline2}`, background: `linear-gradient(140deg, hsl(${p2.hue} 36% ${P.mode === 'dark' ? '26%' : '78%'}), hsl(${(p2.hue + 30) % 360} 32% ${P.mode === 'dark' ? '18%' : '66%'}))` }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.mode === 'dark' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.85)' }}><Icon name={p2.glyph} size={48} stroke={1.4} /></div>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 11px', background: 'linear-gradient(transparent, rgba(0,0,0,.55))', fontSize: 11.5, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>{p2.label}{p2.simulated && <DemoChip />}</div>
              </div>)}
            </div> :
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px', border: `1px dashed ${P.hairline2}`, borderRadius: P.r12, background: P.surface2 }}>
              <Icon name="card" size={15} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>No document image is held for this customer.</b> Nothing has been photographed at a counter or a door. A tile here would be a claim that a picture exists.</span>
            </div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px 16px' }}>
              <KV k="ID / License #" v={idNum} mark={idDoc && idDoc.simulated} />
              <KV k="Date of birth" v={dob} />
              <KV k="ID expiration" v={idExp} mark={idDoc && idDoc.simulated} />
              <KV k="Gender" v={gender} mono={false} />
              <KV k="Address" v={addrText + (addrStateMissing ? ' · state not recorded' : '')} mono={false} mark={!!(idAddr && idDoc && idDoc.simulated)} />
            </div>
            <window.DeliveryAddressBook m={m} idAddr={idAddr} />
            {/* "Medical card · Active · Tax-exempt" is a TAX position. It was
                rendered in the good tone over four generated values. The record
                says the customer is Medicinal; it does not hold their card, and
                those are different facts. */}
            {isMed ? <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 14px', background: P.warnSoft, borderRadius: P.r12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="shield" size={14} stroke={1.9} color={P.warn} /><span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.warn }}>Medical customer · card not on file</span></div>
              <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This customer is recorded as Medicinal, but no MMIC number, recommending physician or expiry is held. <b>The tax exemption cannot be claimed from a customer type alone</b> — the card has to be captured.</div>
            </div> : <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: P.inkMute }}><Icon name="user" size={13} color={P.inkMute} />Adult-use customer — no medical card on file.</div>}
          </div>
        </Sec>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Sec icon="star" title="Loyalty" sub={`${tier} tier · ${fav ? 'favorite category ' + fav : 'no purchase history to draw a favorite category from'}`}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 30, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{m.points.toLocaleString()}</span><span style={{ fontSize: 12.5, color: P.inkDim }}>points available</span></div>
              <div style={{ height: 8, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}><span style={{ display: 'block', width: `${Math.round(prog * 100)}%`, height: '100%', background: P.accent }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}><span>{tier}</span><span>{Math.max(0, nextTier - m.points).toLocaleString()} pts to next tier</span></div>
            </div>
          </Sec>

          {/* The subtitle used to claim `${m.visits} lifetime orders` beside a
              list generated from a character hash. It names what is on the
              list, and says plainly when the list and the visit count
              disagree — which is a real fact about the data, not a gap to
              paper over. */}
          {/* The subtitle used to claim `${m.visits} lifetime orders` over a
              list generated from a character hash. It now counts the two kinds
              of row separately, because they are different claims. */}
          <Sec icon="receipt" title="Order history" sub={`${realHist.length} on record${simHist.length ? ` + ${simHist.length} SIMULATED` : ''} · showing ${hist.length}`}
          right={histAll.length > 6 ? <PBtn variant="ghost" size="sm" icon={allHist ? 'chevron-up' : 'list'} onClick={() => setAllHist((v) => !v)}>{allHist ? 'Show recent' : `View all ${histAll.length}`}</PBtn> :
          <span style={{ fontSize: 11.5, color: P.inkMute }}>All {histAll.length} shown</span>}>
            <div>
              {hist.length === 0 &&
              <div style={{ padding: '16px', fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>No order is recorded against this customer. Nothing is being withheld — there is nothing to show.</div>}
              {simHist.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 16px', background: P.warnSoft, borderBottom: `1px solid ${P.hairline}` }}>
                <Icon name="alert" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}><b>{simHist.length} of these rows are simulated.</b> This customer's record claims {m.visits} visit{m.visits === 1 ? '' : 's'} and the order board holds {realHist.length}; the difference is filled from demo data and marked below. Lifetime spend and average order use the {realHist.length} real order{realHist.length === 1 ? '' : 's'} only.</span>
              </div>}
              {hist.map((o, i) => <div key={o.id} onClick={() => setOpenOrder(o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 700, color: P.ink2, background: P.surface3, padding: '2px 7px', borderRadius: 6 }}>#{o.id}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{o.items} item{o.items > 1 ? 's' : ''} · {o.channel}{o.wm && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: P.brand.weedmapsInk, background: P.brand.weedmaps, padding: '1px 6px', borderRadius: 99 }}>WM</span>}{o.simulated && <span style={{ marginLeft: 7 }}><DemoChip /></span>}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{o.date}</div></div>
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
                <div style={{ flex: 1, minWidth: 0, paddingBottom: i < activity.length - 1 ? 14 : 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, lineHeight: 1.35 }}>{e.t}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{e.s}</div></div>
              </div>)}
            </div>
          </Sec>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: linked ? P.good : P.inkMute }}>{linked ? 'Linked' : 'In-store only'}</span>
            </div>
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {linked ? <>
                <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>This profile was merged from a Weedmaps order. Order history &amp; loyalty are unified.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}><Icon name="link" size={14} color={P.inkMute} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Merged from</div><div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{m.wmOrderId || 'order id not recorded'}</div></div><span style={{ fontSize: 11.5, color: P.inkMute }}>{m.wmMergedAt || ''}</span></div>
                {unlinkAsk ?
                <div style={{ padding: '10px 12px', background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, marginBottom: 5 }}>Unlink {m.name.split(' ')[0]} from Weedmaps?</div>
                    <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginBottom: 9 }}>The merged order history stays on this profile. The next Weedmaps order from this contact arrives as a fresh match candidate instead of landing here automatically.</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <PBtn variant="ghost" size="xs" onClick={() => setUnlinkAsk(false)}>Cancel</PBtn>
                      <div style={{ flex: 1 }} />
                      <PBtn variant="danger" size="xs" icon="user-off" onClick={() => {
                        // setWmLink returns null when the id does not resolve.
                        // Dismissing the confirm panel on that branch tells the
                        // operator the identity was unlinked while the link is
                        // still there — and the next Weedmaps order still lands
                        // on this profile automatically, which is exactly the
                        // behaviour they just acted to stop.
                        const un = window.HW.setWmLink(m.id, false);
                        if (!un) {
                          setLogged((l) => [{ icon: 'alert', accent: true, t: 'NOT unlinked — this member is no longer in the book', s: 'Just now' }, ...l]);
                          return;
                        }
                        setUnlinkAsk(false);
                      }}>Unlink</PBtn>
                    </div>
                  </div> :
                <PBtn variant="ghost" size="sm" icon="user-off" onClick={() => setUnlinkAsk(true)}>Unlink Weedmaps identity</PBtn>}
              </> : <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>No Weedmaps identity linked. If a Weedmaps order matches this customer, you can merge it from the order.</div>}
            </div>
          </Card>

          <Card padding={0}>
            <div style={{ padding: '12px 15px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Preferences</div></div>
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: P.inkDim }}>Favorite category</span><span style={{ fontWeight: 600, color: fav ? P.ink : P.inkMute }}>{fav || 'not recorded'}</span></div>
              {/* A marketing consent is a legal record. `h % 2 ? 'Opted in' :
                  'Off'` made it a function of how the customer id spells, and
                  "we hold no consent" rendered identically to "they said no" —
                  which are the two states that decide whether a message may be
                  sent at all. */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: P.inkDim }}>SMS marketing</span><span style={{ fontWeight: 600, color: P.inkMute }}>no consent recorded</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: P.inkDim }}>Email marketing</span><span style={{ fontWeight: 600, color: P.inkMute }}>no consent recorded</span></div>
            </div>
          </Card>
        </div>
      </div>
      {modal === 'wallet' && <Modal title="Adjust wallet" onClose={() => setModal(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}><span style={{ fontSize: 11.5, color: P.inkDim }}>Current balance</span><span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 800, fontFamily: P.fontMono, color: m.wallet > 0 ? P.good : P.ink }}>{fmt.money(m.wallet)}</span></div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={lblU}>Amount</span><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, minHeight: 40 }}><span style={{ color: P.inkMute, fontFamily: P.fontMono, fontWeight: 700 }}>$</span><input value={wAmt} onChange={(e) => setWAmt(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" autoFocus style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: P.ink, fontSize: 13.5, fontWeight: 700, fontFamily: P.fontMono }} /></div></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={lblU}>Reason</span><select value={wReason} onChange={(e) => setWReason(e.target.value)} style={inp()}>{['Service recovery', 'Refund to wallet', 'Promo credit', 'Correction'].map((o) => <option key={o}>{o}</option>)}</select></label>
          {!wOk && <div style={{ fontSize: 11.5, color: P.warn, fontWeight: 600, lineHeight: 1.4 }}>Enter an amount above $0.00 to credit this wallet.</div>}
          {wOk && <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.4 }}>Wallet goes to <b style={{ color: P.ink }}>{fmt.money((+m.wallet || 0) + wNum)}</b> and the credit is written to the activity feed.</div>}
          <div style={{ display: 'flex', gap: 9, marginTop: 2 }}><PBtn variant="accent" size="md" full disabled={!wOk} onClick={applyCredit}>Apply credit</PBtn><PBtn variant="secondary" size="md" onClick={() => setModal(null)}>Cancel</PBtn></div>
        </div>
      </Modal>}
      {/* Both branches have to land somewhere. The plain note used to fall
          through this handler and vanish — it now lands in Activity. */}
      {modal === 'note' && <window.AddNoteModal member={m} onClose={() => setModal(null)}
      onSave={(n) => {
        if (n.hot) setHotNotes((l) => [{ kind: n.kind, text: n.text, by: n.by, at: n.at, block: n.block }, ...l]);else
        setNotes(() => window.HW_HOT.addNote(m.id, { text: n.text, by: n.by || 'Manisha Saini', at: n.at || 'Just now' }));
        setModal(null);
      }} />}
      {openOrder && <window.FullOrderView order={openOrder} m={m} onClose={() => setOpenOrder(null)} />}
    </div>);

}

const SETTINGS = [
{ group: 'Store', items: [['Terminal', 'scan'], ['Store Information', 'shop'], ['Notification', 'bell'], ['Tax Management', 'percent']] },
{ group: 'Commerce', items: [['Shop Settings', 'settings'], ['Delivery Management', 'truck'], ['Claim Ceiling', 'shield'], ['Cannabis Limit Management', 'leaf'], ['Credit Card Fee Settings', 'card']] },
{ group: 'Cash handling', items: [['Cash Drawer', 'cash'], ['Close Shift', 'lock'], ['METRC Sync', 'refresh'], ['Audit Log', 'list']] },
{ group: 'Integrations', items: [['Weedmaps Status', 'globe']] }];


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
  return <div onClick={onClose} style={window.overlayScrim(P, { z: 200, padding: 20 })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(520px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="cash" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Cash drawer</div><div style={{ fontSize: 11.5, color: P.inkDim }}>{window.HW.STORE.name}</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={lbl}>Required starting balance</div>
          <div style={{ maxWidth: 200 }}><Field mono value={val} onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" /></div>
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 6, lineHeight: 1.5 }}>Every drawer at this store opens with <b style={{ color: P.ink }}>{money(n)}</b>. Associates count the till against this figure to open — they never choose the amount themselves.</div>
        </div>
        <div>
          <div style={lbl}>Common amounts</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[150, 200, 300, 400, 500].map((x) => {const on = n === x;
              return <button key={x} onClick={() => setVal(String(x))} style={{ padding: '6px 13px', borderRadius: 99, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontMono }}>{money(x)}</button>;})}
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


/* ── Delivery lane economics ─────────────────────────────────────────────────
 *
 * The owner: "Fees vary by distance, zone and time. Express minimum varies by
 * zone — most of the time it is $50", then: make it adjustable here.
 *
 * 🔴 THE NUMBERS ARE PROVISIONAL AND THIS PANEL SAYS SO ON SCREEN. The real
 * per-zone table exists in NO system — checked this repo and the Weedmaps
 * publisher, which has flat fee constants defaulting to zero and regions
 * carrying zips and drivers but nothing economic. A wrong minimum silently
 * blocks real orders or silently free-ships them, and neither shows up as an
 * error, so the operator is told plainly what these are rather than being left
 * to assume they are policy.
 */
function LaneEconomicsSettings({ onClose }) {
  const P = useP();
  const money = window.HW.fmt.money;
  window.useHW();
  const cur = window.HW.laneSettings();
  const [f, setF] = React.useState(() => ({
    expressMinimum: String(cur.expressMinimum), expressFee: String(cur.expressFee),
    scheduledMinimum: String(cur.scheduledMinimum), scheduledFee: String(cur.scheduledFee),
  }));
  const num = (k) => parseFloat(f[k]);
  const bad = Object.keys(f).find((k) => !Number.isFinite(num(k)) || num(k) < 0);
  // The store REFUSED the figures. Today `bad` above screens for the same
  // condition setLaneSettings does, so this should be unreachable through the
  // Save button — but the two checks iterate DIFFERENT KEY SETS (`bad` walks
  // the form's own keys, setLaneSettings walks LANE_DEFAULTS), so they agree by
  // coincidence of the form currently holding exactly those four keys, not by
  // construction. Adding a fifth lane figure to one and not the other silently
  // re-opens the hole, and the failure mode is the modal closing over a refused
  // write. Cheap to hold the door shut instead of asserting nobody will open it.
  const [refused, setRefused] = React.useState(false);
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value.replace(/[^0-9.]/g, '') }));
  const Row = ({ k, label, hint }) =>
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ maxWidth: 180 }}><Field mono value={f[k]} onChange={set(k)} placeholder="0.00" /></div>
      <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
    </div>;

  return <div onClick={onClose} style={window.overlayScrim(P, { z: 200, padding: 20 })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(560px,96vw)', maxHeight: '92vh', overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="truck" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Delivery lanes</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Minimums and fees for Express and Scheduled</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {window.HW.laneSettingsAreDefault() &&
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.warnSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
              <b>These are provisional.</b> $50 is the owner&rsquo;s &ldquo;most of the time&rdquo; figure, adopted so the
              storefront is testable end to end. No confirmed per-zone table exists in any system yet.
            </div>
          </div>}

        <Row k="expressMinimum" label="Express minimum"
          hint={<span>Below <b style={{ color: P.ink }}>{money(num('expressMinimum') || 0)}</b> of express merchandise the customer is shown how much more is needed. It is a <b>progress bar</b>, not a refusal &mdash; the cart never blocks, it just cannot be checked out until the lane is met.</span>} />
        <Row k="expressFee" label="Express delivery fee"
          hint={<span>Added to the express order only, and taxed with it.</span>} />
        <Row k="scheduledMinimum" label="Scheduled minimum"
          hint={<span>Usually zero &mdash; scheduled has lead time to load, so there is no van-capacity reason to hold a floor.</span>} />
        <Row k="scheduledFee" label="Scheduled delivery fee"
          hint={<span>Free today. Each lane is priced on its own row in the customer&rsquo;s order summary; there is no blended delivery fee anywhere.</span>} />

        <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
          <Icon name="info" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
            <b>One figure per lane, for every zone.</b> Zone, distance and time-of-day are not modelled here yet.
            The engine already resolves per-zone rules &mdash; it is the <b>data</b> that is missing, and one honest
            flat number is easier to notice as wrong than a table somebody invented.
          </div>
        </div>

        {bad && <div style={{ fontSize: 11.5, color: P.bad, fontWeight: 600 }}>Every figure must be a number and cannot be negative &mdash; a negative minimum would silently switch the gate off.</div>}
        {refused && !bad && <div style={{ fontSize: 11.5, color: P.bad, fontWeight: 600 }}>Not saved &mdash; the store refused these figures. The lanes are unchanged.</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="ghost" size="md" onClick={() => { const d = window.HW.resetLaneSettings(); setF({ expressMinimum: String(d.expressMinimum), expressFee: String(d.expressFee), scheduledMinimum: String(d.scheduledMinimum), scheduledFee: String(d.scheduledFee) }); }}>Reset</PBtn>
        <span style={{ display: 'flex', gap: 9 }}>
          <PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="accent" size="md" icon="check" disabled={!!bad}
            onClick={() => { const saved = window.HW.setLaneSettings({ expressMinimum: num('expressMinimum'), expressFee: num('expressFee'), scheduledMinimum: num('scheduledMinimum'), scheduledFee: num('scheduledFee') }); if (!saved) { setRefused(true); return; } onClose(); }}>
            Save &middot; min {money(num('expressMinimum') || 0)}
          </PBtn>
        </span>
      </div>
    </div>
  </div>;
}

/* ── Weedmaps status ──────────────────────────────────────────────────────
 *
 * READ-ONLY, v1. wmdemo/config.py already computes rich operator sentences —
 * live_write_mode() ("is this deployment even allowed to write to the real
 * Weedmaps menu, and why"), order_push_blocker() ("order-status push is
 * blocked because Weedmaps hasn't granted the scope") — and until
 * GET /api/wm/status existed neither one left the boot log. This panel is
 * that route's response, laid out. It has NO save button and writes nothing:
 * making any of this editable needs a DB-backed settings-overlay table (the
 * pattern category_edit.py's alias overlay already uses), which is a
 * materially bigger project than a status screen and is explicitly deferred.
 *
 * Fetched through window.HW_LIVE.get(), the same one-seam read path every
 * other live card in this app uses (screen-categories.jsx's
 * useKnownCategories is the model): idle -> pending -> live | error, and an
 * honest "could not reach it" on failure rather than inventing a status.
 */
function useWmStatus() {
  const [st, setSt] = React.useState({ status: 'idle', data: null, err: null });
  React.useEffect(() => {
    if (!window.HW_LIVE || typeof window.HW_LIVE.get !== 'function') {
      setSt({ status: 'error', data: null, err: 'the live data seam (shared/hw-live.js) is not loaded on this page' });
      return;
    }
    let dead = false;
    setSt({ status: 'pending', data: null, err: null });
    window.HW_LIVE.get('/api/wm/status').then((r) => {
      if (dead) return;
      if (!r.ok || !r.body) { setSt({ status: 'error', data: null, err: r.error || ('HTTP ' + r.code) }); return; }
      setSt({ status: 'live', data: r.body, err: null });
    });
    return () => { dead = true; };
  }, []);
  return st;
}

function WmSettingCard({ P, pillKind, pillDot, pillLabel, title, source, children }) {
  return (
    <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 16, background: P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {pillLabel && <Pill kind={pillKind} dot={pillDot} size="sm">{pillLabel}</Pill>}
        <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
      </div>
      <div style={{ fontSize: 12, color: P.ink2, lineHeight: 1.6 }}>{children}</div>
      {source && <div style={{ marginTop: 10, fontSize: 10.5, color: P.inkFaint, fontFamily: P.fontMono, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        {source}
        <span style={{ fontSize: 10, fontWeight: 700, color: P.inkMute, background: P.surface3, padding: '2px 7px', borderRadius: 99, letterSpacing: '.03em', textTransform: 'uppercase', fontFamily: P.fontSans }}>engineer only</span>
      </div>}
    </div>
  );
}

function WeedmapsStatusPanel({ onClose }) {
  const P = useP();
  const st = useWmStatus();
  const kv = { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '5px 0', fontSize: 12 };

  return <div onClick={onClose} style={window.overlayScrim(P, { z: 200, padding: 20 })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(820px,96vw)', maxHeight: '92vh', overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="globe" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Weedmaps</div>
          <div style={{ fontSize: 11.5, color: P.inkDim }}>Environment &amp; write-mode status</div>
        </div>
        <Pill kind="neutral" size="sm">Read-only</Pill>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
          <Icon name="info" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Every card below states a fact this process already computed — nothing here is a control. Most of these values require a process restart to take effect, and one of them (OAuth token scopes) has already caused a real outage from a casual-looking edit, so there is no "change it here" for any of them yet.</div>
        </div>

        {st.status === 'pending' && <div style={{ fontSize: 12.5, color: P.inkDim, padding: '20px 0', textAlign: 'center' }}>Asking GET /api/wm/status…</div>}

        {st.status === 'error' && <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.badSoft, borderRadius: P.r10 }}>
          <Icon name="alert" size={14} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}><b>Could not reach GET /api/wm/status</b> ({st.err}). Nothing below is invented to fill the gap — this panel shows a status, not a guess.</div>
        </div>}

        {st.status === 'live' && (() => {
          const d = st.data;
          const lw = d.live_write || {};
          const op = d.order_push || {};
          const partner = d.partner || {};
          const wh = d.webhook || {};
          const posture = wh.posture || {};
          const sync = d.sync || {};
          const mp = d.merchant_preflight || {};

          return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>

            <WmSettingCard P={P} pillKind={lw.mode === 'allowed' ? 'good' : 'bad'} pillDot
              pillLabel={lw.mode === 'allowed' ? 'allowed' : 'refused'} title="Live write mode"
              source="config.live_write_mode() · WM_API_BASE, WM_ALLOW_LIVE_WM, WM_API_READONLY">
              {lw.reason || 'No reason returned.'}
            </WmSettingCard>

            <WmSettingCard P={P} pillKind={op.entitled ? 'good' : 'bad'} pillDot
              pillLabel={op.entitled ? 'entitled' : 'blocked'} title="Order-status push"
              source="config.order_push_blocker() · ORDERS_SCOPE_ENTITLED">
              {op.entitled ? 'This client carries orders:status:write — queued statuses may drain.' : (op.blocked_reason || 'Blocked, no reason returned.')}
            </WmSettingCard>

            <WmSettingCard P={P} pillKind="info" pillDot
              pillLabel={partner.on_live_host ? 'live partner' : 'non-live host'} title="Environment"
              source="config.API_BASE (WM_API_BASE)">
              Talking to <code style={{ fontFamily: P.fontMono, background: P.surface3, padding: '1px 5px', borderRadius: 6 }}>{partner.api_base || '—'}</code>.
              {partner.read_only_declared ? ' This process has declared itself read-only (WM_API_READONLY=1) — every non-GET to the partner is refused regardless of the write-mode verdict above.' : ' No read-only declaration is in effect for this process.'}
            </WmSettingCard>

            <WmSettingCard P={P} pillKind={wh.signature_key_configured ? 'good' : 'bad'} pillDot
              pillLabel={wh.signature_key_configured ? 'key configured' : 'not configured'} title="Webhook signature"
              source="engine.verify_signature — keyed on config.CLIENT_SECRET">
              <div>The inbound webhook HMAC is keyed on the same secret as the OAuth client credential — its value is never shown here, only whether one is set.</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${P.hairline2}` }}>
                <div style={kv}><span style={{ color: P.inkDim }}>Posture</span><span style={{ fontWeight: 600, color: P.ink }}>{posture.state || 'unknown'}</span></div>
                <div style={kv}><span style={{ color: P.inkDim }}>Verified from Weedmaps</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{posture.external_verified ?? '—'}</span></div>
                <div style={kv}><span style={{ color: P.inkDim }}>Rejected from Weedmaps</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{posture.external_rejected ?? '—'}</span></div>
              </div>
            </WmSettingCard>

            <WmSettingCard P={P} title="Sync cadence"
              source="config.SYNC_DEBOUNCE_S / PROMO_POLL_S / RECONCILE_EVERY_S">
              <div style={kv}><span style={{ color: P.inkDim }}>Write debounce</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{sync.debounce_s ?? '—'}s</span></div>
              <div style={kv}><span style={{ color: P.inkDim }}>Promo poll (no push API exists)</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{sync.promo_poll_s ?? '—'}s</span></div>
              <div style={kv}><span style={{ color: P.inkDim }}>Reconcile safety net</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{sync.reconcile_every_s ?? '—'}s</span></div>
            </WmSettingCard>

            <WmSettingCard P={P} pillKind={mp.enabled ? 'good' : 'neutral'} pillDot
              pillLabel={mp.enabled ? 'on' : 'off'} title="Merchant pre-flight"
              source="config.MERCHANT_PREFLIGHT / _TTL_KNOWN_S / _TTL_UNKNOWN_S">
              <div style={kv}><span style={{ color: P.inkDim }}>Known-merchant cache</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{mp.ttl_known_s ?? '—'}s</span></div>
              <div style={kv}><span style={{ color: P.inkDim }}>Unknown-merchant cache</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{mp.ttl_unknown_s ?? '—'}s</span></div>
              <div style={kv}><span style={{ color: P.inkDim }}>Pre-flight timeout</span><span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{mp.timeout_s ?? '—'}s</span></div>
            </WmSettingCard>

            <WmSettingCard P={P} pillKind={d.public_mode ? 'warn' : 'neutral'} pillDot
              pillLabel={d.public_mode ? 'public' : 'not public'} title="Write token"
              source="config.WRITE_TOKEN (WM_DEMO_WRITE_TOKEN) — secret, never surfaced">
              {d.public_mode ?
                (d.write_token_configured ? 'This service is reachable from the internet and a write token is configured — every mutating route requires it. Reads stay open.' : 'This service is public and NO write token is configured — mutating routes are unprotected.') :
                'This service is not in public mode, so the write-token gate is not in effect' + (d.write_token_configured ? ' (a token is configured anyway).' : '.')}
            </WmSettingCard>

          </div>;
        })()}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <PBtn variant="secondary" size="md" onClick={onClose}>Close</PBtn>
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
          <Card key={label} padding={15} hover onClick={() => { if (label === 'Cash Drawer') setOpen('drawer'); if (label === 'Delivery Management') setOpen('lanes'); if (label === 'Claim Ceiling') setOpen('claim'); if (label === 'Weedmaps Status') setOpen('wmstatus'); }} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 38, height: 38, borderRadius: P.r10, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={18} stroke={1.8} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: P.ink }}>{label}</span>
                  {label === 'Cash Drawer' && <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>Starts at {window.HW.fmt.money(POS.getRequiredFloat())}</span>}
                  {label === 'Delivery Management' && <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>Express min {window.HW.fmt.money(window.HW.laneSettings().expressMinimum)}{window.HW.laneSettingsAreDefault() ? ' · provisional' : ''}</span>}
                  {/* The claim ceiling sits beside the lane minimums because it is the
                      same kind of number: one operator-set figure the storefront is held
                      to. It caps the deepest discount merchandising copy may ADVERTISE —
                      the guard that "Up to 97% off" got past. */}
                  {label === 'Claim Ceiling' && <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>Max advertised {window.HWClaim ? window.HWClaim.get() : '—'}%{window.HWClaim && window.HWClaim.isDefault() ? ' · provisional' : ''}</span>}
                  {label === 'Weedmaps Status' && <span style={{ display: 'block', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>Read-only · GET /api/wm/status</span>}
                </span>
                <Icon name="chevron-right" size={16} stroke={2} color={P.inkMute} />
              </Card>
          )}
          </div>
        </div>
      )}
      {open === 'drawer' && <CashDrawerSettings onClose={() => setOpen(null)} />}
      {open === 'lanes' && <LaneEconomicsSettings onClose={() => setOpen(null)} />}
      {open === 'claim' && window.ClaimCeilingSettings && <window.ClaimCeilingSettings onClose={() => setOpen(null)} />}
      {open === 'wmstatus' && <WeedmapsStatusPanel onClose={() => setOpen(null)} />}
    </div>);

};

Object.assign(window, {});