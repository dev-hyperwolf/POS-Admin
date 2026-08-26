// ── /ap + /credits + /credits/new ─────────────────────────────────────────
// Ports app/(shell)/{ap,credits,credits/new}/page.tsx plus the AP and credit
// drawers.
;(function () {
  const useP = window.useP;

  // ── AP ──────────────────────────────────────────────────────────────────
  const AP_FILTERS = [
    { value: 'all', label: 'All' }, { value: 'due', label: 'Due this week' }, { value: 'overdue', label: 'Overdue' },
    { value: 'paid', label: 'Paid' }, { value: 'review', label: 'Review' }, { value: 'cfo', label: 'CFO escalation' },
  ];
  const apStatusTone = (s) => ({ paid: 'ok', overdue: 'blocked', cfo: 'blocked', review: 'warn', due_this_week: 'info' }[s]);
  const apShortStatus = (s) => ({ paid: 'Paid', overdue: 'Overdue', cfo: 'CFO', review: 'Review', due_this_week: 'Due' }[s]);
  const apStatusLabel = (s) => ({ paid: 'Paid', overdue: 'Overdue', review: 'Needs review', cfo: 'CFO escalation', due_this_week: 'Due this week' }[s]);

  function MetricBlock({ label, value, sub }) {
    const P = useP();
    return (
      <div style={{ borderRadius: 8, background: P.surface3, border: `1px solid ${P.hairline2}`, padding: 12 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 16, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{sub}</div>}
      </div>);
  }

  function APDrawer({ invoice, open, onClose }) {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const [linkedMemoId, setLinkedMemoId] = React.useState(null);
    const [menuOpen, setMenuOpen] = React.useState(false);
    React.useEffect(() => { setLinkedMemoId(null); }, [invoice?.id]);
    if (!invoice) return null;
    const entity = HD.ENTITIES.find((e) => e.id === invoice.entity);
    const linkableMemos = OPS.CREDIT_MEMOS.filter((m) => m.vendorName === invoice.vendorName && !m.linkedInvoiceId);
    const linkedMemo = OPS.CREDIT_MEMOS.find((m) => m.id === linkedMemoId) ?? null;
    return (
      <Sheet open={open} onClose={onClose} width={520}>
        <header style={{ flex: '0 0 auto', padding: 20, borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <MicroLabel>Invoice</MicroLabel>
              <h2 style={{ margin: '2px 0 0', fontSize: 21, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{invoice.invoiceNumber}</h2>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13.5, color: P.inkMute }}>
                <span>{invoice.vendorName}</span><span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ height: 8, width: 8, borderRadius: 99, background: HD.hueColor(P, entity?.hue) }} />{entity?.short}
                </span>
                <span>·</span><span>Due {HD.formatDate(invoice.dueDate)}</span>
              </div>
              <div style={{ marginTop: 8 }}><HDPill tone={apStatusTone(invoice.status)} label={apStatusLabel(invoice.status)} /></div>
            </div>
            <IconBtn icon="x" size={16} onClick={onClose} style={{ width: 30, height: 30, margin: -4 }} />
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <MetricBlock label="Amount" value={HD.formatCurrency(invoice.amount)} sub={invoice.paidAmount > 0 ? `Paid ${HD.formatCurrency(invoice.paidAmount)}` : undefined} />
            <MetricBlock label="Variance" value={invoice.variance === 0 ? '—' : HD.formatCurrency(invoice.variance)} sub={invoice.variance === 0 ? 'Clean match' : invoice.variance > 0 ? 'Vendor owes' : 'We owe'} />
            <MetricBlock label="Credits avail" value={invoice.creditsAvailable > 0 ? HD.formatCurrency(invoice.creditsAvailable) : '—'} sub={invoice.creditsAvailable > 0 ? 'Auto-apply ready' : undefined} />
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section>
            <MicroLabel style={{ marginBottom: 8 }}>Line items</MicroLabel>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${P.hairline2}`, borderRadius: 8 }}>
              {invoice.lineItems.map((li, i) => (
                <li key={li.id} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13.5, borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.productName}</div>
                    <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{li.sku} · {li.qty} @ {HD.formatCurrency(li.unitCost)}</div>
                  </div>
                  <div style={{ fontFamily: P.fontMono, color: P.ink }}>{HD.formatCurrency(li.total)}</div>
                </li>))}
            </ul>
          </section>
          {invoice.manifestId && (
            <section>
              <MicroLabel style={{ marginBottom: 8 }}>Matched manifest</MicroLabel>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                <Icon name="link" size={14} stroke={1.9} color={P.inkMute} />
                <span style={{ fontFamily: P.fontMono, color: P.ink }}>{invoice.manifestId}</span>
                <span title="Manifest ↔ invoice ↔ receipt" style={{ marginLeft: 'auto', fontSize: 11.5, color: HD.tone(P, 'ok').fg }}>3-way match</span>
              </div>
            </section>)}
          <section>
            <MicroLabel style={{ marginBottom: 8 }}>Linked credit memo</MicroLabel>
            {linkedMemo ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                <Icon name="link" size={14} stroke={1.9} color={HD.tone(P, 'ok').fg} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: P.fontMono, color: P.ink }}>{linkedMemo.memoNumber}</span>
                  <span style={{ color: P.inkMute }}> · {HD.formatCurrency(linkedMemo.amount)}</span>
                </div>
                <button onClick={() => setLinkedMemoId(null)} aria-label="Unlink credit memo" style={{ background: 'none', border: 'none', color: P.inkMute, cursor: 'pointer', display: 'inline-flex' }}><Icon name="x" size={14} stroke={2} /></button>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: P.inkMute }}>No credit memo linked. Use <span style={{ color: P.ink2 }}>Link credit memo</span> below to apply an existing memo. New memos are created in the Credits tab.</div>)}
          </section>
          <section>
            <MicroLabel style={{ marginBottom: 8 }}>Payment history</MicroLabel>
            {invoice.payments.length === 0
              ? <div style={{ fontSize: 13.5, color: P.inkMute }}>No payments recorded yet.</div>
              : <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${P.hairline2}`, borderRadius: 8 }}>
                {invoice.payments.map((p, i) => (
                  <li key={p.id} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13.5, borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ textTransform: 'uppercase', fontSize: 11.5, color: P.inkMute, letterSpacing: '.06em' }}>{p.method.replace('_', ' ')}</span>
                      <span style={{ color: P.inkMute }}>{HD.relativeTime(p.at)}</span>
                    </div>
                    <div style={{ fontFamily: P.fontMono, color: P.ink }}>{HD.formatCurrency(p.amount)}</div>
                  </li>))}
              </ul>}
          </section>
          {invoice.notes && (
            <section>
              <MicroLabel style={{ marginBottom: 8 }}>Notes</MicroLabel>
              <div style={{ fontSize: 13.5, color: P.ink2, border: `1px solid ${P.hairline2}`, borderRadius: 8, padding: '8px 12px', background: P.surface2 }}>{invoice.notes}</div>
            </section>)}
        </div>
        <footer style={{ flex: '0 0 auto', padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', flexWrap: 'wrap', gap: 8, position: 'relative' }}>
          <PBtn size="sm" variant="accent" iconRight="arrow-right" onClick={() => window.hdToast?.({ title: 'Payment scheduled', description: `${invoice.invoiceNumber} · ${HD.formatCurrency(invoice.amount)}`, tone: 'ok' })}>Schedule payment</PBtn>
          <div style={{ position: 'relative' }}>
            <PBtn size="sm" variant="secondary" icon="link" onClick={() => setMenuOpen((v) => !v)}>Link credit memo</PBtn>
            {menuOpen && (
              <div style={{ position: 'absolute', bottom: 40, left: 0, zIndex: 60, minWidth: 280, maxHeight: 300, overflowY: 'auto', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: 10, boxShadow: P.shadowLg, padding: 4 }}>
                <div style={{ padding: '6px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Existing memos · {invoice.vendorName}</div>
                {linkableMemos.length === 0
                  ? <div style={{ padding: '8px', fontSize: 12.5, color: P.inkMute }}>No unlinked credit memos for this vendor. Create one in the Credits tab.</div>
                  : linkableMemos.map((m) => (
                    <button key={m.id} onClick={() => { setLinkedMemoId(m.id); setMenuOpen(false); }}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: P.ink, fontFamily: P.fontSans, textAlign: 'left' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontFamily: P.fontMono }}>{m.memoNumber}</span>
                      <span style={{ color: P.inkMute, textTransform: 'capitalize' }}>{m.source.replace('_', ' ')}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: P.fontMono, color: P.ink2 }}>{HD.formatCurrency(m.amount)}</span>
                    </button>))}
              </div>)}
          </div>
          <PBtn size="sm" variant="ghost">Hold for review</PBtn>
        </footer>
      </Sheet>);
  }

  window.ScreenAP = function ScreenAP() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const [filter, setFilter] = React.useState('all');
    const [query, setQuery] = React.useState('');
    const [selected, setSelected] = React.useState(null);
    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return OPS.AP_INVOICES.filter((i) => {
        if (filter === 'due' && i.status !== 'due_this_week') return false;
        if (filter === 'overdue' && i.status !== 'overdue') return false;
        if (filter === 'paid' && i.status !== 'paid') return false;
        if (filter === 'review' && i.status !== 'review') return false;
        if (filter === 'cfo' && i.status !== 'cfo') return false;
        if (!q) return true;
        return i.invoiceNumber.toLowerCase().includes(q) || i.vendorName.toLowerCase().includes(q) || (i.manifestId?.toLowerCase().includes(q) ?? false);
      });
    }, [filter, query]);
    const counts = React.useMemo(() => {
      const c = { all: OPS.AP_INVOICES.length, due: 0, overdue: 0, paid: 0, review: 0, cfo: 0 };
      OPS.AP_INVOICES.forEach((i) => {
        if (i.status === 'due_this_week') c.due++;
        else if (i.status === 'overdue') c.overdue++;
        else if (i.status === 'paid') c.paid++;
        else if (i.status === 'review') c.review++;
        else if (i.status === 'cfo') c.cfo++;
      });
      return c;
    }, []);
    const summary = OPS.apSummary();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    const ActionButton = ({ status }) => {
      if (status === 'paid') return <PBtn size="xs" variant="ghost" onClick={(e) => e.stopPropagation()}>View</PBtn>;
      if (status === 'cfo') return <PBtn size="xs" variant="danger" onClick={(e) => e.stopPropagation()}>Escalate</PBtn>;
      if (status === 'review') return <PBtn size="xs" variant="secondary" onClick={(e) => e.stopPropagation()}>Review</PBtn>;
      return <PBtn size="xs" variant="accent" onClick={(e) => e.stopPropagation()}>Pay</PBtn>;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <StatTile icon="dollar" label="Outstanding" value={HD.formatCurrency(summary.outstanding, { showCents: false })} sub={`${counts.all - counts.paid} open invoices`} hue="info" />
          <StatTile icon="clock" label="30-day aged" value={HD.formatCurrency(summary.aged30, { showCents: false })} sub="1-30 days past due" hue="warn" />
          <StatTile icon="clock" label="60-day aged" value={HD.formatCurrency(summary.aged60, { showCents: false })} sub="31-60 days past due" hue="warn" />
          <StatTile icon="flag" label="90+ critical" value={HD.formatCurrency(summary.aged90, { showCents: false })} sub="CFO attention" hue="blocked" />
          <StatTile icon="trending-up" label="Credits available" value={HD.formatCurrency(summary.creditsAvailable, { showCents: false })} sub="Auto-applicable" hue="ok" />
        </div>

        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${P.hairline2}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {AP_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                style={{ height: 32, padding: '0 12px', borderRadius: 99, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: P.fontSans,
                  background: filter === f.value ? P.ink : 'transparent', color: filter === f.value ? P.surface : P.inkDim, border: `1px solid ${filter === f.value ? P.ink : P.hairline2}` }}>
                {f.label}<span style={{ fontSize: 11.5, color: filter === f.value ? P.surface : P.inkMute, opacity: filter === f.value ? .8 : 1, fontFamily: P.fontMono }}>{counts[f.value]}</span>
              </button>))}
          </div>
          <div style={{ marginLeft: 'auto', width: 320 }}>
            <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Invoice #, manifest #, or vendor" aria-label="Search invoices" />
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <HDTable>
                <thead><tr>
                  <TH width={140}>Status</TH><TH>Invoice #</TH><TH>Manifest #</TH><TH>Vendor</TH><TH>Entity</TH><TH>Due</TH>
                  <TH align="right">Amount</TH><TH align="right">Variance</TH><TH align="right" width={140}>Action</TH>
                </tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><TD colSpan={9}><div style={{ padding: '40px 0', textAlign: 'center', color: P.inkMute }}><Icon name="receipt" size={24} stroke={1.6} /><div style={{ marginTop: 8 }}>No invoices match.</div></div></TD></tr>
                    : filtered.map((inv) => {
                      const entity = HD.ENTITIES.find((e) => e.id === inv.entity);
                      const daysUntilDue = Math.round((new Date(inv.dueDate).getTime() - window.HD_DATA.NOW) / 86400000);
                      return (
                        <TR key={inv.id} onClick={() => setSelected(inv)}>
                          <TD><HDPill tone={apStatusTone(inv.status)} label={apShortStatus(inv.status)} size="sm" /></TD>
                          <TD mono>{inv.invoiceNumber}</TD>
                          <TD>{inv.manifestId ? <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>{HD.uidShort(inv.manifestId, 'metrc')}</span> : <span title="No matching METRC manifest" style={{ fontSize: 12.5, color: HD.tone(P, 'warn').fg }}>Unmatched</span>}</TD>
                          <TD>
                            <div style={{ color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{inv.vendorName}</div>
                            <div style={{ fontSize: 11.5, color: P.inkMute }}>{inv.vendorCategory}</div>
                          </TD>
                          <TD>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: P.ink2 }}>
                              <span style={{ height: 8, width: 8, borderRadius: 99, background: HD.hueColor(P, entity?.hue) }} />{entity?.short}
                            </span>
                          </TD>
                          <TD>
                            <div style={{ fontSize: 13.5, color: P.ink }}>{HD.formatDate(inv.dueDate)}</div>
                            <div style={{ fontSize: 11.5, color: P.inkMute }}>
                              {inv.status === 'paid' ? `Paid ${HD.relativeTime(inv.paidDate || inv.dueDate)}` : daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'Today' : `in ${daysUntilDue}d`}
                            </div>
                          </TD>
                          <TD align="right" mono>{HD.formatCurrency(inv.amount)}</TD>
                          <TD align="right" mono style={{ color: inv.variance === 0 ? P.inkMute : inv.variance > 0 ? HD.tone(P, 'ok').fg : HD.tone(P, 'warn').fg }}>
                            {inv.variance === 0 ? '—' : (inv.variance > 0 ? '+' : '') + HD.formatCurrency(inv.variance)}
                          </TD>
                          <TD align="right"><ActionButton status={inv.status} /></TD>
                        </TR>);
                    })}
                </tbody>
              </HDTable>
            </div>
          </Card>
          <p style={{ marginTop: 12, fontSize: 12.5, color: P.inkMute }}>Showing {filtered.length} of {OPS.AP_INVOICES.length} invoices. Click a row to open the invoice drawer.</p>
        </div>

        <APDrawer invoice={selected} open={selected !== null} onClose={() => setSelected(null)} />
      </div>);
  };

  // ── Credits ─────────────────────────────────────────────────────────────
  const sourceLabel = (s) => ({ damage: 'Damage', promo: 'Promo', pricing: 'Pricing', return: 'Return', short_ship: 'Short-ship', admin_manual: 'Admin' }[s]);
  const sourceTone = (s) => ({ damage: 'warn', promo: 'brand', pricing: 'info', return: 'quarantine', short_ship: 'warn', admin_manual: 'neutral' }[s]);
  const creditLabel = (s) => ({ draft: 'Draft', pending: 'Pending approval', approved: 'Approved', applied: 'Applied', disputed: 'Disputed' }[s]);
  const creditTone = (s) => ({ draft: 'neutral', pending: 'warn', approved: 'info', applied: 'ok', disputed: 'blocked' }[s]);

  const SOURCE_FILTERS = [
    { value: 'all', label: 'All' }, { value: 'damage', label: 'Damage' }, { value: 'promo', label: 'Promo' },
    { value: 'pricing', label: 'Pricing' }, { value: 'return', label: 'Return' }, { value: 'short_ship', label: 'Short-ship' }, { value: 'admin_manual', label: 'Admin' },
  ];
  const STATUS_FILTERS = [
    { value: 'all', label: 'Any status' }, { value: 'draft', label: 'Draft' }, { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' }, { value: 'applied', label: 'Applied' }, { value: 'disputed', label: 'Disputed' },
  ];

  function CreditDrawer({ memo, open, onClose }) {
    const P = useP(), HD = window.HD;
    if (!memo) return null;
    const entity = HD.ENTITIES.find((e) => e.id === memo.entity);
    const evIcon = (kind) => (kind === 'photo' ? 'camera' : kind === 'email' ? 'mail' : kind === 'manifest' ? 'link' : 'note');
    return (
      <Sheet open={open} onClose={onClose} width={520}>
        <header style={{ flex: '0 0 auto', padding: 20, borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <MicroLabel>Credit memo</MicroLabel>
              <h2 style={{ margin: '2px 0 0', fontSize: 21, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{memo.memoNumber}</h2>
            </div>
            <IconBtn icon="x" size={16} onClick={onClose} style={{ width: 30, height: 30, margin: -4 }} />
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13.5, color: P.inkMute }}>
            <span>{memo.vendorName}</span><span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ height: 8, width: 8, borderRadius: 99, background: HD.hueColor(P, entity?.hue) }} />{entity?.short}</span>
            <span>·</span><span>Created {HD.relativeTime(memo.createdAt)}</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HDPill tone={creditTone(memo.status)} label={creditLabel(memo.status)} />
            <HDPill tone={sourceTone(memo.source)} icon={false} size="sm" label={sourceLabel(memo.source)} />
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <MetricBlock label="Amount" value={HD.formatCurrency(memo.amount)} />
            <MetricBlock label="Linked invoice" value={memo.linkedInvoiceNumber || '—'} sub={memo.linkedInvoiceId} />
            <MetricBlock label="Manifest" value={memo.linkedManifestId ? memo.linkedManifestId.slice(-6) : '—'} sub={memo.linkedManifestId ? 'METRC tag' : undefined} />
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section>
            <MicroLabel style={{ marginBottom: 8 }}>Reason</MicroLabel>
            <p style={{ margin: 0, fontSize: 13.5, color: P.ink2, border: `1px solid ${P.hairline2}`, borderRadius: 8, padding: '8px 12px', background: P.surface2 }}>{memo.reason}</p>
          </section>
          <section>
            <MicroLabel style={{ marginBottom: 8 }}>Evidence</MicroLabel>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${P.hairline2}`, borderRadius: 8 }}>
              {memo.evidence.map((ev, i) => (
                <li key={ev.id} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                  <span style={{ height: 32, width: 32, borderRadius: 8, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute }}>
                    <Icon name={evIcon(ev.kind)} size={14} stroke={1.9} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: P.ink }}>{ev.label}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute }}>{ev.capturedBy} · {HD.relativeTime(ev.capturedAt)}</div>
                  </div>
                  <PBtn size="xs" variant="ghost">View</PBtn>
                </li>))}
            </ul>
          </section>
          <section>
            <MicroLabel style={{ marginBottom: 8 }}>Audit trail</MicroLabel>
            <ol style={{ listStyle: 'none', margin: 0, padding: '0 0 0 16px', borderLeft: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {memo.audit.map((ev) => (
                <li key={ev.id} style={{ fontSize: 13.5, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -21, top: 5, height: 10, width: 10, borderRadius: 99, background: P.accent }} />
                  <div style={{ color: P.ink }}>{ev.action}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute }}>{ev.actor} · {HD.formatDate(ev.at)}</div>
                </li>))}
            </ol>
          </section>
        </div>
        <footer style={{ flex: '0 0 auto', padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {memo.status === 'pending'
            ? <React.Fragment>
              <PBtn size="sm" variant="accent" icon="check-circle">Approve</PBtn>
              <PBtn size="sm" variant="danger" icon="x">Reject</PBtn>
            </React.Fragment>
            : memo.status === 'approved'
              ? <PBtn size="sm" variant="accent" icon="link">Apply to invoice</PBtn>
              : <PBtn size="sm" variant="secondary">View evidence</PBtn>}
          <PBtn size="sm" variant="ghost">Download PDF</PBtn>
        </footer>
      </Sheet>);
  }

  window.ScreenCredits = function ScreenCredits() {
    const P = useP(), HD = window.HD, OPS = window.HD_OPS;
    const [source, setSource] = React.useState('all');
    const [status, setStatus] = React.useState('all');
    const [vendor, setVendor] = React.useState([]);
    const [query, setQuery] = React.useState('');
    const [selected, setSelected] = React.useState(null);
    const vendorOptions = React.useMemo(() => [...new Set(OPS.CREDIT_MEMOS.map((m) => m.vendorName))].sort(), []);
    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return OPS.CREDIT_MEMOS.filter((m) => {
        if (source !== 'all' && m.source !== source) return false;
        if (status !== 'all' && m.status !== status) return false;
        if (vendor.length > 0 && !vendor.includes(m.vendorName)) return false;
        if (!q) return true;
        return m.memoNumber.toLowerCase().includes(q) || m.vendorName.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q);
      });
    }, [source, status, vendor, query]);
    const hasActiveFilters = source !== 'all' || status !== 'all' || vendor.length > 0 || query.trim().length > 0;
    const clearAll = () => { setSource('all'); setStatus('all'); setVendor([]); setQuery(''); };
    const summary = OPS.creditsSummary();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="note" label="Outstanding credits" value={HD.formatCurrency(summary.outstanding, { showCents: false })} sub="Approved + pending" hue="info" />
          <StatTile icon="check-circle" label="Applied this month" value={HD.formatCurrency(summary.appliedThisMonth, { showCents: false })} sub="Offset against AP" hue="ok" />
          <StatTile icon="clock" label="Pending approval" value={HD.formatCurrency(summary.pendingApproval, { showCents: false })} sub={`${OPS.CREDIT_MEMOS.filter((m) => m.status === 'pending').length} memos`} hue="warn" />
          <StatTile icon="flag" label="Disputed" value={HD.formatCurrency(summary.disputed, { showCents: false })} sub={`${OPS.CREDIT_MEMOS.filter((m) => m.status === 'disputed').length} memos`} hue="blocked" />
        </div>

        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SOURCE_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setSource(f.value)}
                style={{ height: 32, padding: '0 12px', borderRadius: 99, fontSize: 13.5, cursor: 'pointer', fontFamily: P.fontSans,
                  background: source === f.value ? P.ink : 'transparent', color: source === f.value ? P.surface : P.inkDim, border: `1px solid ${source === f.value ? P.ink : P.hairline2}` }}>{f.label}</button>))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {STATUS_FILTERS.map((f) => (
                <button key={f.value} onClick={() => setStatus(f.value)}
                  style={{ height: 28, padding: '0 10px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer', fontFamily: P.fontSans,
                    background: status === f.value ? P.ink : 'transparent', color: status === f.value ? P.surface : P.inkDim, border: `1px solid ${status === f.value ? P.ink : P.hairline2}` }}>{f.label}</button>))}
              <span style={{ height: 20, width: 1, background: P.hairline2, margin: '0 4px' }} />
              <MultiSelectFilter label="Brand / Vendor" options={vendorOptions.map((v) => ({ id: v, label: v }))} value={vendor} onChange={setVendor} />
            </div>
            <div style={{ marginLeft: 'auto', width: 320 }}>
              <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Memo #, vendor, reason" aria-label="Search credits" />
            </div>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <HDTable>
                <thead><tr>
                  <TH width={120}>Source</TH><TH>Vendor</TH><TH align="right">Amount</TH><TH>Date</TH><TH>Status</TH><TH>Linked to</TH><TH align="right" width={160}>Action</TH>
                </tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><TD colSpan={7}><HDEmpty icon="note" title="No credits match." body={hasActiveFilters ? 'Nothing matches the current filters. Drop one, or clear them all.' : 'No credit memos on file yet.'} action={hasActiveFilters ? <PBtn size="sm" variant="secondary" onClick={clearAll}>Clear all</PBtn> : undefined} /></TD></tr>
                    : filtered.map((m) => (
                      <TR key={m.id} onClick={() => setSelected(m)}>
                        <TD><HDPill tone={sourceTone(m.source)} icon={false} size="sm" label={sourceLabel(m.source)} /></TD>
                        <TD>
                          <div style={{ color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{m.vendorName}</div>
                          <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{m.memoNumber}</div>
                        </TD>
                        <TD align="right" mono>{HD.formatCurrency(m.amount)}</TD>
                        <TD style={{ color: P.inkMute, fontSize: 13.5 }}>{HD.relativeTime(m.createdAt)}</TD>
                        <TD><HDPill tone={creditTone(m.status)} label={creditLabel(m.status)} size="sm" /></TD>
                        <TD>{m.linkedInvoiceNumber ? <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>{m.linkedInvoiceNumber}</span> : <span style={{ fontSize: 12.5, color: P.inkMute }}>Unlinked</span>}</TD>
                        <TD align="right">
                          <PBtn size="xs" variant={m.status === 'pending' ? 'accent' : m.status === 'approved' ? 'secondary' : 'ghost'} onClick={(e) => e.stopPropagation()}>
                            {m.status === 'pending' ? 'Approve' : m.status === 'approved' ? 'Apply' : m.status === 'disputed' ? 'Resolve' : 'View'}
                          </PBtn>
                        </TD>
                      </TR>))}
                </tbody>
              </HDTable>
            </div>
          </Card>
          <p style={{ marginTop: 12, fontSize: 12.5, color: P.inkMute }}>Showing {filtered.length} of {OPS.CREDIT_MEMOS.length} credits. Click a row to open evidence + audit trail.</p>
        </div>

        <CreditDrawer memo={selected} open={selected !== null} onClose={() => setSelected(null)} />
      </div>);
  };

  // ── /credits/new ────────────────────────────────────────────────────────
  function brandFor(li) {
    const name = li.productName.trim();
    const lower = name.toLowerCase();
    if (lower.startsWith('raw garden')) return 'Raw Garden';
    if (lower.startsWith('heavy hitters')) return 'Heavy Hitters';
    if (lower.startsWith('lowell')) return 'Lowell Farms';
    if (lower.startsWith('alien labs')) return 'Alien Labs';
    if (lower.startsWith('kiva')) return 'Kiva Confections';
    return name.split(/\s+/).slice(0, 2).join(' ');
  }

  function MissingInvoiceCard({ navigate }) {
    const P = useP(), HD = window.HD;
    const warn = HD.tone(P, 'warn');
    return (
      <Card padding={0} style={{ maxWidth: 680 }}>
        <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ display: 'inline-flex', height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: warn.bg, color: warn.fg, border: `1px solid ${warn.fg}66`, flex: '0 0 auto' }}>
            <Icon name="receipt" size={18} stroke={1.9} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>A credit memo must be tied to an existing invoice.</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.inkDim, lineHeight: 1.5 }}>
              Pick an invoice from the Inbox first, then use the Action Bar's <span style={{ color: P.ink, fontWeight: 600 }}>Open credit memo</span> option. Credits cannot exist without a source document — this keeps every credit auditable back to the AP entry it offsets.
            </p>
          </div>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PBtn variant="accent" icon="download" onClick={() => navigate('#/inbox')}>Browse invoices</PBtn>
            <PBtn variant="secondary" onClick={() => navigate('#/credits')}>View existing credits</PBtn>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${P.hairline2}`, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600, color: P.ink2 }}>How this normally works:</span> a buyer reviews an invoice, spots a damage / short-ship / pricing discrepancy, and opens a credit memo right from the variance panel. The credit lands here pre-filled with the distributor and the impacted line items.
          </div>
        </div>
      </Card>);
  }

  window.ScreenCreditNew = function ScreenCreditNew({ query, navigate }) {
    const P = useP(), HD = window.HD;
    const invoiceId = query.get('invoiceId') ?? query.get('invoice') ?? '';
    const invoice = invoiceId ? window.HD_DATA.INVOICES.find((i) => i.id === invoiceId) : undefined;
    const [selected, setSelected] = React.useState(() => new Set());
    const [reason, setReason] = React.useState('');
    const [memoTotal, setMemoTotal] = React.useState('');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    const linesByBrand = React.useMemo(() => {
      if (!invoice) return [];
      const m = new Map();
      for (const li of invoice.lineItems) {
        const b = brandFor(li);
        if (!m.has(b)) m.set(b, []);
        m.get(b).push(li);
      }
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [invoice]);

    const toggleLine = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    const toggleBrand = (lines) => {
      const allSelected = lines.every((l) => selected.has(l.id));
      setSelected((prev) => { const next = new Set(prev); for (const l of lines) allSelected ? next.delete(l.id) : next.add(l.id); return next; });
    };
    const selectedLines = invoice ? invoice.lineItems.filter((l) => selected.has(l.id)) : [];
    const computedTotal = selectedLines.reduce((s, l) => s + l.qty * l.unitCost, 0);

    return (
      <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => navigate('#/credits')} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="arrow-left" size={14} stroke={2} /> Back to credits
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>New credit memo</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.inkDim }}>Credits are issued by a distributor against an existing invoice.</p>
        </div>

        {!invoice ? <MissingInvoiceCard navigate={navigate} /> : (
          <div className="hd-2col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card padding={20} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: P.accentSoft, color: accentInk, border: `1px solid ${P.accentBorder}`, flex: '0 0 auto' }}>
                  <Icon name="shop" size={18} stroke={1.9} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MicroLabel>Credit memo to</MicroLabel>
                  <DisplayNum size={22}>{invoice.vendorName}</DisplayNum>
                  <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 2 }}>Distributor (payee) · {linesByBrand.length} {linesByBrand.length === 1 ? 'brand' : 'brands'} on this invoice</div>
                </div>
                <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                  <MicroLabel align="right">Source invoice</MicroLabel>
                  <button onClick={() => navigate(`#/invoices/${invoice.id}`)} style={{ background: 'none', border: 'none', padding: 0, fontFamily: P.fontMono, fontSize: 13.5, color: P.ink, cursor: 'pointer' }}>{invoice.invoiceNumber}</button>
                  <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono }}>{HD.formatCurrency(invoice.total)}</div>
                </div>
              </Card>

              <Card padding={0}>
                <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Brands on this credit</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: P.inkMute }}>Select the line items to credit. A single memo can cover any mix of brands the distributor carries.</p>
                  </div>
                  <span title="A distributor often carries multiple brands. This credit memo applies against your balance with the distributor; line items can be from any of the brands they distribute."
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface3, color: P.inkMute, fontSize: 11.5, cursor: 'help', flex: '0 0 auto' }}>
                    <Icon name="help" size={12} stroke={2} />One distributor, many brands
                  </span>
                </div>
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {linesByBrand.map(([brand, lines]) => {
                    const brandTotalQty = lines.reduce((s, l) => s + l.qty, 0);
                    const brandTotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
                    const allChecked = lines.every((l) => selected.has(l.id));
                    return (
                      <div key={brand} style={{ borderRadius: 10, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface2 }}>
                          <Check on={allChecked} onChange={() => toggleBrand(lines)} size={18} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{brand}</span>
                              <HDPill tone="neutral" icon={false} size="sm" label={`${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`} />
                            </div>
                            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono }}>{brandTotalQty.toLocaleString()} units · {HD.formatCurrency(brandTotal, { showCents: false })}</div>
                          </div>
                        </div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {lines.map((li, i) => {
                            const checked = selected.has(li.id);
                            return (
                              <li key={li.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: checked ? P.surface3 : 'transparent', borderLeft: `3px solid ${checked ? P.ink : 'transparent'}` }}>
                                  <Check on={checked} onChange={() => toggleLine(li.id)} size={18} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.productName}</div>
                                    <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{li.sku}</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                                    <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink }}>{li.qty} × {HD.formatCurrency(li.unitCost)}</div>
                                    <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{HD.formatCurrency(li.qty * li.unitCost)}</div>
                                  </div>
                                </label>
                              </li>);
                          })}
                        </ul>
                      </div>);
                  })}
                </div>
              </Card>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card padding={0}>
                <div style={{ padding: '16px 20px 8px' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Credit details</h3></div>
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <MicroLabel style={{ marginBottom: 6 }}>Amount</MicroLabel>
                    <Field mono value={memoTotal} onChange={(e) => setMemoTotal(e.target.value)} placeholder={HD.formatCurrency(computedTotal)} inputMode="decimal" />
                    <p style={{ margin: '6px 0 0', fontSize: 11.5, color: P.inkMute }}>Defaults to the sum of selected lines (<span style={{ fontFamily: P.fontMono }}>{HD.formatCurrency(computedTotal)}</span>). Override if the credit only covers part of a line.</p>
                  </div>
                  <div>
                    <MicroLabel style={{ marginBottom: 6 }}>Reason</MicroLabel>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. 8 units arrived crushed; photos attached on source invoice."
                      style={{ width: '100%', padding: '10px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, resize: 'vertical', outline: 'none' }} />
                  </div>
                </div>
              </Card>

              <Card padding={16} style={{ fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: P.ink2, marginBottom: 8 }}>
                  <Icon name="note" size={13} stroke={1.9} /><span style={{ fontWeight: 600 }}>How this memo will apply</span>
                </div>
                <p style={{ margin: 0 }}>The credit will offset your AP balance with <span style={{ color: P.ink }}>{invoice.vendorName}</span>, not the individual brands. Selected line items are recorded for the audit trail so brand-level chargebacks downstream can be reconciled.</p>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PBtn variant="accent" full iconRight="arrow-right" disabled={selected.size === 0}
                  onClick={() => window.hdToast?.({ title: 'Draft saved', description: `${selectedLines.length} line${selectedLines.length === 1 ? '' : 's'} · ${HD.formatCurrency(computedTotal)}`, tone: 'ok' })}>Save draft</PBtn>
                <PBtn variant="ghost" full onClick={() => navigate('#/credits')}>Cancel</PBtn>
              </div>
            </div>
          </div>)}
      </div>);
  };

  Object.assign(window, { creditLabel, creditTone, sourceLabel, sourceTone });
})();
