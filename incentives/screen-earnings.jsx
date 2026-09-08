// ── incentives/screen-earnings.jsx ── #/earnings — projected, settled, paid ──
// Design: explorations/Incentives - Concept D - Two Seats.html, tab "5 ·
// Earnings", with Concept B's reconciliation strip folded in
// (Incentives - Concept B - Ledger.html, tab 6). Plan:
// docs/INCENTIVES-PLAN-2026-09-07.md §3.6, §5. Contract:
// docs/BOUNTY-API-CONTRACT.md (GET/POST /api/incentives/earnings*).
//
// TWO NUMBERS THAT MUST NEVER MERGE. Projected is what the rules say a person
// is on track for; settled is what a manager has closed out; recorded paid is
// a bookkeeping marker ("someone paid this somewhere else and wrote it down"),
// never a payment instruction. `outstanding_cents` is the contract's own
// pre-computed `settled - recorded_paid` — this screen renders it, never
// re-derives it, so the arithmetic in the API and the arithmetic on screen
// cannot drift apart.
//
// SEAT vs CONSOLE. incentives/app.jsx passes every screen `{navigate, query,
// route, path, session, isManager, previewing, seat: 'console'|'seat', me}` —
// `seat` already accounts for a manager previewing the budtender seat, so
// this file reads it straight off props instead of measuring its own width.
;(function () {
  const useP = window.useP;
  const HWInc = window.HWInc;
  const IncShared = window.IncShared;

  function CardHead({ icon, title, right }) {
    const P = useP();
    return (
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name={icon} size={15} color={P.ink2} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
        {right}
      </div>);
  }

  function FieldLabel({ children }) {
    const P = useP();
    return <label style={{ fontSize: 11, fontWeight: 700, color: P.inkDim, letterSpacing: '.03em', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{children}</label>;
  }

  function sumBy(arr, key) { return (arr || []).reduce((s, x) => s + (x[key] || 0), 0); }

  // ── the bounty state machine's pill, reused for ledger `kind` ────────────
  const KIND_TONE = { earned: 'good', adjusted: 'warn', recorded_paid: 'info' };
  const KIND_LABEL = { earned: 'Earned', adjusted: 'Adjusted', recorded_paid: 'Recorded paid' };
  function KindPill({ kind }) {
    return <Pill kind={KIND_TONE[kind] || 'neutral'} size="sm">{KIND_LABEL[kind] || kind}</Pill>;
  }

  // ── DataTable dense: ts, kind pill, amount, bounty name/round, reason ────
  // Shared by both seats — the manager's version adds a leading person column.
  function LedgerTable({ rows, showPerson, nameFor }) {
    const P = useP();
    const columns = [];
    columns.push({ key: 'ts', label: 'When', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim, whiteSpace: 'nowrap' }}>{window.HD ? window.HD.formatDateTime(r.ts) : r.ts}</span> });
    if (showPerson) columns.push({ key: 'person', label: 'Budtender', render: (r) => <span style={{ fontWeight: 600, color: P.ink }}>{nameFor(r.associate_id)}</span> });
    columns.push({ key: 'kind', label: 'Kind', render: (r) => <KindPill kind={r.kind} /> });
    columns.push({ key: 'amount', label: 'Amount', align: 'right', render: (r) => (
      <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: r.kind === 'recorded_paid' ? P.info : (r.amount < 0 ? P.bad : P.ink2) }}>
        {r.unit === 'points' ? `${HWInc.fmt.number(r.amount)} pts` : HWInc.fmt.cents(r.amount)}
      </span>) });
    columns.push({ key: 'bounty', label: 'Bounty', render: (r) => (
      <span style={{ fontSize: 12, color: P.inkDim }}>{r.contest_name ? `${r.contest_name}${r.round_key ? ' · ' + r.round_key : ''}` : (r.snap_id ? 'Snap' : '—')}</span>) });
    columns.push({ key: 'reason', label: 'Reason', render: (r) => <span style={{ fontSize: 12, color: P.inkDim }}>{r.reason || '—'}</span> });
    return <DataTable columns={columns} rows={rows} dense rowKey={(r) => r.id} />;
  }

  // ── "Record as paid" — a note that a payment happened elsewhere, not a
  // payment itself. The estate's overlayScrim/overlayCard modal shell, the
  // same construction pos/screen-aov.jsx's AovManagerCard edit modal uses.
  // The contract's POST body is exactly {associate_id, amount_cents, actor,
  // reason, contest_id?} — no "method" field exists in
  // docs/BOUNTY-API-CONTRACT.md, so unlike the Concept D mockup's Cash /
  // Payroll / Gift card / Other segmented control, this form does not invent
  // one; "how" is folded into the free-text reason instead (see placeholder).
  function RecordPaidModal({ person, session, onClose, onDone }) {
    const P = useP();
    const [amount, setAmount] = React.useState(((person.outstanding_cents || 0) / 100).toFixed(2));
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const submit = () => {
      const cents = Math.round(parseFloat(amount || '0') * 100);
      if (!cents || cents <= 0 || Number.isNaN(cents)) {
        window.hdToast && window.hdToast({ title: 'Enter an amount', description: 'The amount must be a positive dollar figure.', tone: 'warn' });
        return;
      }
      setBusy(true);
      HWInc.post('/api/incentives/earnings/record-paid', {
        associate_id: person.associate_id, amount_cents: cents, actor: session.id, reason: reason || null,
      }).then((res) => {
        setBusy(false);
        if (res.ok) {
          window.hdToast && window.hdToast({ title: 'Recorded', description: `${HWInc.fmt.cents(cents)} recorded as paid for ${person.name}. This is a note, not a payment — no money moved.`, tone: 'ok' });
          onDone(res.body);
          onClose();
        } else {
          window.hdToast && window.hdToast({ title: 'Could not record it', description: res.error || 'Unknown error', tone: 'blocked' });
        }
      });
    };

    return (
      <div style={window.overlayScrim(P, { padding: '60px 20px' })} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...window.overlayCard, background: P.surface, borderRadius: P.r16, width: 'min(440px,96vw)', border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14.5, color: P.ink }}>Record paid · {person.name}</h3>
            <button onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, color: P.inkMute }}>✕</button>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: P.inkDim, lineHeight: 1.5 }}>
              This records that a payment was made somewhere else — it does not move money.
              {person.outstanding_cents != null && ` Outstanding: ${HWInc.fmt.cents(person.outstanding_cents)}.`}
            </div>
            <div>
              <FieldLabel>Amount ($)</FieldLabel>
              <Field mono value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <FieldLabel>Reason</FieldLabel>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="What was handed over, how, and when — e.g. cash at close, 9/12"
                style={{ width: '100%', height: 64, padding: '9px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, fontFamily: P.fontSans, fontSize: 12.5, resize: 'vertical', background: P.field, color: P.ink }} />
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: P.surface2 }}>
            <PBtn variant="secondary" onClick={onClose}>Cancel</PBtn>
            <PBtn variant="accent" busy={busy} onClick={submit}>Record it</PBtn>
          </div>
        </div>
      </div>);
  }

  // ══════════════════════════════════════════════════════════════════════
  // BUDTENDER SEAT — "My earnings"
  // ══════════════════════════════════════════════════════════════════════

  function MyLedgerView({ session }) {
    const P = useP();
    const path = `/api/incentives/earnings?associate_id=${encodeURIComponent(session.id || '')}`;
    const q = HWInc.usePoll(path, { intervalMs: 20000 });

    if (q.error) return <IncShared.NotConnected onRetry={q.refresh} />;
    if (q.loading || !q.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding={0}><div style={{ padding: 16 }}><SkeletonRows rows={2} avatar={false} /></div></Card>
          <SkeletonRows rows={4} />
        </div>);
    }

    const d = q.data;
    const mine = (d.balances || []).find((b) => b.associate_id === session.id) || (d.balances || [])[0] || {};
    const ledger = d.ledger || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card padding={0}>
          <CardHead icon="coins" title="My balances" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: '14px 16px 6px' }}>
            {[
              ['Projected', mine.projected_cents, P.ink2],
              ['Settled', mine.settled_cents, P.good],
              ['Recorded paid', mine.recorded_paid_cents, P.info],
              ['Outstanding', mine.outstanding_cents, P.ink],
            ].map(([label, v, color]) => (
              <div key={label} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{label}</div>
                <div style={{ fontFamily: P.fontMono, fontSize: 18, fontWeight: 700, color, marginTop: 3 }}>{HWInc.fmt.cents(v)}</div>
              </div>))}
          </div>
          <div style={{ padding: '2px 16px 16px', fontSize: 11, color: P.inkMute, lineHeight: 1.55 }}>
            Settled minus recorded paid is outstanding — {HWInc.fmt.cents(mine.settled_cents)} − {HWInc.fmt.cents(mine.recorded_paid_cents)} = {HWInc.fmt.cents(mine.outstanding_cents)}.
            Projected is never added to that figure — it's what the rules say you're on track for, not what you're owed yet.
          </div>
        </Card>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, marginBottom: 8 }}>My ledger</div>
          {ledger.length === 0
            ? <EmptyState compact icon="coins" title="Nothing here yet" body="Earnings from bounties, adjustments and settlements will show up here." />
            : <LedgerTable rows={ledger} />}
        </div>
      </div>);
  }

  // ══════════════════════════════════════════════════════════════════════
  // MANAGER CONSOLE — the store ledger
  // ══════════════════════════════════════════════════════════════════════

  function ReconciliationStrip({ reconciliation }) {
    const P = useP();
    if (!reconciliation) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: '11px 14px', background: P.goodSoft, border: `1px solid ${P.good}`, borderRadius: P.r10, fontSize: 12, color: P.ink2 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good, flex: '0 0 auto' }} />
        <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{HWInc.fmt.cents(reconciliation.settled_cents)}</span>&nbsp;settled −
        <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{HWInc.fmt.cents(reconciliation.recorded_paid_cents)}</span>&nbsp;recorded paid =
        <span style={{ fontFamily: P.fontMono, fontWeight: 700 }}>{HWInc.fmt.cents(reconciliation.outstanding_cents)}</span>&nbsp;outstanding across the store.
      </div>);
  }

  function useSort(rows, initialKey) {
    const [sort, setSort] = React.useState({ key: initialKey, dir: 'desc' });
    const onSort = (k) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' }));
    const sorted = React.useMemo(() => {
      const arr = [...(rows || [])];
      arr.sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        const an = typeof av === 'string' ? av.toLowerCase() : (av || 0);
        const bn = typeof bv === 'string' ? bv.toLowerCase() : (bv || 0);
        if (an < bn) return sort.dir === 'asc' ? -1 : 1;
        if (an > bn) return sort.dir === 'asc' ? 1 : -1;
        return 0;
      });
      return arr;
    }, [rows, sort]);
    return [sorted, sort, onSort];
  }

  // one row per person, sortable — HDTable/SortableTH (the dense Engage-shape
  // table primitives), matched to DataTable's own bordered/rounded convention.
  function StoreBalancesTable({ balances, onRecordPaid }) {
    const P = useP();
    const [sorted, sort, onSort] = useSort(balances, 'outstanding_cents');
    return (
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, overflow: 'hidden', background: P.surface }}>
        <div style={{ overflowX: 'auto' }}>
          <HDTable>
            <thead><tr>
              <SortableTH label="Budtender" k="name" sort={sort} onSort={onSort} />
              <SortableTH label="Projected" k="projected_cents" sort={sort} onSort={onSort} align="right" />
              <SortableTH label="Settled" k="settled_cents" sort={sort} onSort={onSort} align="right" />
              <SortableTH label="Recorded paid" k="recorded_paid_cents" sort={sort} onSort={onSort} align="right" />
              <SortableTH label="Outstanding" k="outstanding_cents" sort={sort} onSort={onSort} align="right" />
              <SortableTH label="Points" k="points" sort={sort} onSort={onSort} align="right" />
              <TH width={120} />
            </tr></thead>
            <tbody>
              {sorted.length === 0 && <TR><TD colSpan={7} style={{ textAlign: 'center', color: P.inkMute, padding: 32 }}>No results</TD></TR>}
              {sorted.map((b) => (
                <TR key={b.associate_id}>
                  <TD><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={b.name} size={24} /><b style={{ color: P.ink }}>{b.name}</b></div></TD>
                  <TD align="right" mono style={{ color: P.inkDim }}>{HWInc.fmt.cents(b.projected_cents)}</TD>
                  <TD align="right" mono>{HWInc.fmt.cents(b.settled_cents)}</TD>
                  <TD align="right" mono>{HWInc.fmt.cents(b.recorded_paid_cents)}</TD>
                  <TD align="right" mono style={{ fontWeight: 700, color: b.outstanding_cents > 0 ? P.ink : P.inkMute }}>{HWInc.fmt.cents(b.outstanding_cents)}</TD>
                  <TD align="right" mono>{HWInc.fmt.number(b.points || 0)}</TD>
                  <TD align="right">
                    {b.outstanding_cents > 0
                      ? <PBtn size="xs" variant="secondary" onClick={() => onRecordPaid(b)}>Record paid</PBtn>
                      : <PBtn size="xs" variant="ghost" disabled>Record paid</PBtn>}
                  </TD>
                </TR>))}
            </tbody>
          </HDTable>
        </div>
      </div>);
  }

  function StoreLedgerView({ session }) {
    const P = useP();
    const path = `/api/incentives/earnings?store_id=${encodeURIComponent(session.storeId || '')}`;
    const q = HWInc.usePoll(path, { intervalMs: 20000 });
    const [recordFor, setRecordFor] = React.useState(null);
    const [kindFilter, setKindFilter] = React.useState('all');
    const [personFilter, setPersonFilter] = React.useState([]);

    if (q.error) return <IncShared.NotConnected onRetry={q.refresh} />;
    if (q.loading || !q.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {[0, 1, 2].map((i) => <Card key={i} padding={16}><Skeleton lines={2} /></Card>)}
          </div>
          <SkeletonRows rows={5} />
        </div>);
    }

    const d = q.data;
    const balances = d.balances || [];
    const ledger = d.ledger || [];
    const filtered = ledger.filter((r) => (kindFilter === 'all' || r.kind === kindFilter) && (personFilter.length === 0 || personFilter.includes(r.associate_id)));
    const nameFor = (id) => { const b = balances.find((x) => x.associate_id === id); return b ? b.name : id; };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: P.ink }}>Store ledger</h2>
            <div style={{ marginTop: 4, fontSize: 12.5, color: P.inkDim, maxWidth: 560, lineHeight: 1.5 }}>
              Settling writes each person's row once and cannot double-write, so re-running it is safe.
            </div>
          </div>
          <PBtn size="sm" variant="secondary" icon="refresh" onClick={q.refresh}>Refresh</PBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          <KPI icon="coins" label="Settled" value={HWInc.fmt.cents(d.reconciliation ? d.reconciliation.settled_cents : 0)} accent />
          <KPI icon="clock" label="Projected" value={HWInc.fmt.cents(sumBy(balances, 'projected_cents'))} sublabel="not settled yet" />
          <KPI icon="wallet" label="Recorded paid" value={HWInc.fmt.cents(d.reconciliation ? d.reconciliation.recorded_paid_cents : 0)} sublabel="bookkeeping only" />
        </div>

        <ReconciliationStrip reconciliation={d.reconciliation} />

        <StoreBalancesTable balances={balances} onRecordPaid={setRecordFor} />

        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, marginBottom: 8 }}>Ledger</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            <Seg value={kindFilter} onChange={setKindFilter} size="sm" options={[
              { value: 'all', label: 'All' }, { value: 'earned', label: 'Earned' }, { value: 'adjusted', label: 'Adjusted' }, { value: 'recorded_paid', label: 'Recorded paid' },
            ]} />
            <MultiSelectFilter label="Person" options={balances.map((b) => ({ id: b.associate_id, label: b.name }))} value={personFilter} onChange={setPersonFilter} />
          </div>
          {filtered.length === 0
            ? <EmptyState compact icon="coins" title="No ledger entries match" body="Try clearing the person or kind filter." />
            : <LedgerTable rows={filtered} showPerson nameFor={nameFor} />}
        </div>

        {recordFor && <RecordPaidModal person={recordFor} session={session} onClose={() => setRecordFor(null)} onDone={() => q.refresh()} />}
      </div>);
  }

  // ── entry point ───────────────────────────────────────────────────────
  window.IncScreenEarnings = function IncScreenEarnings({ session, isManager, seat }) {
    const showConsole = isManager && seat !== 'seat';
    return (
      <div style={{ width: '100%' }}>
        {showConsole ? <StoreLedgerView session={session} /> : <MyLedgerView session={session} />}
      </div>);
  };
})();
