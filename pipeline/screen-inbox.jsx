// ── /inbox — invoice intake ───────────────────────────────────────────────
// Ports app/(shell)/inbox/page.tsx + components/inbox/{filter-bar,invoice-list,
// invoice-preview,empty-inbox,auto-post-rate-tile}.tsx.
;(function () {
  const useP = window.useP;
  const FORWARDING_ADDRESS = 'supply@hyperwolf.com';

  // "Needs you" — anything that is NOT a clean auto-post.
  function needsYou(inv) {
    if (inv.inboxStatus !== 'autoposted') return true;
    if (inv.confidence < 0.9) return true;
    if (inv.varianceSeverity !== 'none') return true;
    if ((inv.unmappedManifestUids?.length ?? 0) > 0) return true;
    return false;
  }

  function AutoPostRateTile() {
    const P = useP(), HD = window.HD;
    const [win, setWin] = React.useState('30d');
    const metric = React.useMemo(() => window.HD_DATA.autoPostRate(win), [win]);
    const headline = Math.round(metric.rate * 100);
    const deltaPct = Math.round(metric.delta * 100);
    const direction = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat';
    const arrowTone = direction === 'up' ? HD.tone(P, 'ok').fg : direction === 'down' ? HD.tone(P, 'blocked').fg : P.inkMute;
    const TOOLTIP = 'Share of inbound invoices auto-extracted without human review in the last 30 days. AI confidence + clean validation.';
    const SUBTITLE = { '7d': 'Auto Post Rate (last 7d)', '30d': 'Auto Post Rate (last 30d)', '90d': 'Auto Post Rate (last 90d)' };
    return (
      <Card padding={16} style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
            <span style={{ color: HD.tone(P, 'ok').fg, display: 'inline-flex' }}><Icon name="check-circle" size={16} stroke={1.9} /></span>
            <span>Auto Post Rate</span>
            <span title={TOOLTIP} aria-label="Auto Post Rate explanation" style={{ cursor: 'help', display: 'inline-flex' }}><Icon name="info" size={11} stroke={2} /></span>
          </div>
          <div role="group" aria-label="Auto Post Rate window" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: 2 }}>
            {['7d', '30d', '90d'].map((w) => (
              <button key={w} onClick={() => setWin(w)} aria-pressed={win === w}
                style={{ height: 22, padding: '0 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, fontFamily: P.fontMono, cursor: 'pointer', border: 'none',
                  background: win === w ? P.ink : 'transparent', color: win === w ? P.surface : P.inkDim }}>{w}</button>))}
          </div>
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div title={TOOLTIP} style={{ fontSize: 36, lineHeight: 1, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{headline}%</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: P.inkMute }}>{SUBTITLE[win]}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Spark data={metric.series} color={arrowTone} width={84} height={32} />
            <div title="Change vs prior equivalent period" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, color: arrowTone, fontFamily: P.fontMono }}>
              <Icon name={direction === 'up' ? 'arrow-up' : direction === 'down' ? 'arrow-down' : 'arrow-right'} size={12} stroke={2.2} />
              <span>{deltaPct > 0 ? '+' : ''}{deltaPct}% vs prior</span>
            </div>
          </div>
        </div>
      </Card>);
  }

  function SummaryCard({ icon, label, value, sub, tone }) {
    const P = useP(), HD = window.HD;
    const valueColor = tone === 'brand' ? (P.mode === 'dark' ? P.accent : P.accentBorder) : HD.tone(P, tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'blocked').fg;
    return (
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
          <Icon name={icon} size={16} stroke={1.9} /><span>{label}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 30, lineHeight: 1, color: valueColor, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{value}</div>
        {sub && <div style={{ marginTop: 6, fontSize: 12.5, color: P.inkMute }}>{sub}</div>}
      </Card>);
  }

  function ViewToggle({ value, onChange, mineCount, allCount }) {
    const P = useP();
    const opts = [{ id: 'mine', label: 'Needs you', count: mineCount }, { id: 'all', label: 'All', count: allCount }];
    return (
      <div role="group" aria-label="Inbox view" style={{ display: 'inline-flex', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 2 }}>
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={active}
              style={{ height: 30, padding: '0 12px', borderRadius: 6, fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none', fontFamily: P.fontSans,
                background: active ? P.surface : 'transparent', color: active ? P.ink : P.inkDim, boxShadow: active ? P.shadowSm : 'none' }}>
              <span>{o.label}</span>
              <span style={{ fontSize: 11.5, fontFamily: P.fontMono, opacity: active ? .8 : 1, color: active ? P.ink : P.inkMute }}>({o.count})</span>
            </button>);
        })}
      </div>);
  }

  function StatusChips({ value, counts, onChange }) {
    const P = useP(), HD = window.HD;
    const options = [{ value: 'all', label: 'All' }, ...HD.INBOX_STATUS_ORDER.map((s) => ({ value: s, label: HD.INBOX_STATUS_META[s].label }))];
    return (
      <div role="group" aria-label="Inbox status filter" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {options.map((o) => {
          const active = value === o.value;
          const meta = o.value === 'all' ? null : HD.INBOX_STATUS_META[o.value];
          return (
            <button key={o.value} onClick={() => onChange(o.value)} title={meta?.description} aria-pressed={active}
              style={{ height: 30, padding: '0 12px', borderRadius: 99, fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: P.fontSans,
                background: active ? P.ink : 'transparent', color: active ? P.surface : P.inkDim, border: `1px solid ${active ? P.ink : P.hairline2}` }}>
              {meta && <Icon name={meta.icon} size={12} stroke={2} />}
              <span>{o.label}</span>
              <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: active ? P.surface : P.inkMute, opacity: active ? .8 : 1 }}>{counts[o.value] ?? 0}</span>
            </button>);
        })}
      </div>);
  }

  function EmptyInbox({ mode = 'empty', navigate }) {
    const P = useP();
    const title = mode === 'filtered' ? 'No invoices match this filter' : 'Your inbox is quiet';
    const body = mode === 'filtered'
      ? 'Try widening the status filter, or clear the search to see the last 30 days.'
      : 'Invoices land here the moment a vendor sends one. Three ways to feed the inbox:';
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{ position: 'relative', height: 112, width: 112, margin: '0 auto 24px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 99, background: P.accent, opacity: .06 }} />
            <div style={{ position: 'absolute', inset: 12, borderRadius: 99, background: P.accent, opacity: .12 }} />
            <div style={{ position: 'absolute', inset: 24, borderRadius: 99, background: P.accent, opacity: .22 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ height: 48, width: 48, borderRadius: 14, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: P.shadowMd }}>
                <Icon name="mail" size={22} stroke={1.9} />
              </div>
            </div>
          </div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 600, color: P.ink, textAlign: 'center', letterSpacing: '-.01em' }}>{title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.inkDim, textAlign: 'center' }}>{body}</p>
          {mode === 'empty' && (
            <React.Fragment>
              <div style={{ marginTop: 20, borderRadius: P.r12, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
                  <Icon name="sparkle" size={12} stroke={2} />Forward to your intake inbox
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontFamily: P.fontMono, fontSize: 13.5, color: P.ink, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, padding: '8px 12px' }}>{FORWARDING_ADDRESS}</code>
                  <PBtn variant="accent" icon="copy" aria-label="Copy forwarding address" onClick={() => {
                    navigator.clipboard?.writeText(FORWARDING_ADDRESS)
                      .then(() => window.hdToast?.({ title: 'Copied', description: `${FORWARDING_ADDRESS} is ready to paste.`, tone: 'ok' }))
                      .catch(() => window.hdToast?.({ title: "Couldn't copy", description: 'Clipboard blocked — copy it manually.', tone: 'warn' }));
                  }}>Copy</PBtn>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: P.inkMute }}>Anything sent here lands in Hyperdrive within 30 seconds — PDFs, email bodies, phone-photo attachments. We strip the duplicates and split the attachments automatically.</p>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                {[{ icon: 'download', title: 'Upload a PDF', sub: 'Drop files straight onto this panel', onClick: () => window.hdToast?.({ title: 'Upload stub', description: 'Drag-and-drop upload lands in Sprint One.', tone: 'info' }) },
                  { icon: 'scan', title: 'Scan on the floor', sub: 'Mobile intake pairs a manifest with a packing slip photo', onClick: () => navigate('#/scan') }].map((a) => (
                  <button key={a.title} onClick={a.onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.surface2)} onMouseLeave={(e) => (e.currentTarget.style.background = P.surface)}>
                    <div style={{ height: 32, width: 32, borderRadius: 8, background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.ink2, flex: '0 0 auto' }}><Icon name={a.icon} size={14} stroke={1.9} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: P.ink, fontWeight: 500 }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute }}>{a.sub}</div>
                    </div>
                  </button>))}
              </div>
            </React.Fragment>)}
        </div>
      </div>);
  }

  function OverflowMenu() {
    const P = useP();
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const items = [{ label: 'Review', icon: 'eye' }, { label: '3-way match', icon: 'search' }, { label: 'Request correction', icon: 'refresh' }];
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-label="More actions" title="More actions"
          style={{ height: 28, width: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: open ? P.surface3 : 'transparent', color: P.inkMute, cursor: 'pointer' }}>
          <Icon name="menu" size={15} stroke={2} />
        </button>
        {open && (
          <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 30, minWidth: 176, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, boxShadow: P.shadowLg, padding: '4px 0' }}>
            {items.map((it) => (
              <button key={it.label} role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 13.5, color: P.ink2, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}
                onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Icon name={it.icon} size={13} stroke={1.9} /><span>{it.label}</span>
              </button>))}
          </div>)}
      </div>);
  }

  function InvoiceRowActions({ inv, isMapped }) {
    const P = useP(), HD = window.HD;
    const single = !isMapped && inv.varianceSeverity === 'none' && typeof inv.confidence === 'number' && inv.confidence >= 0.92 && inv.inboxStatus !== 'autoposted';
    const ok = HD.tone(P, 'ok');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    if (isMapped) return <span style={{ fontSize: 12.5, color: P.inkMute }}>—</span>;
    if (single) {
      const pct = Math.round(inv.confidence * 100);
      return (
        <button onClick={(e) => e.stopPropagation()} title={`AI-suggested action: Approve. Confidence ${pct}%, validation passed.`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 6, background: ok.bg, color: ok.fg, border: `1px solid ${ok.fg}66`, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="sparkle" size={11} stroke={2} /><Icon name="check" size={12} stroke={2.4} /><span>Approve</span>
        </button>);
    }
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        <button title="Approve" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 6, background: P.accentSoft, color: accentInk, border: `1px solid ${P.accentBorder}`, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="check" size={12} stroke={2.4} /><span>Approve</span>
        </button>
        <OverflowMenu />
      </div>);
  }

  function InvoiceList({ invoices, selectedId, onSelect, expandedId, onToggleExpanded }) {
    const P = useP(), HD = window.HD;
    const snap = window.HD_MAPPING.useMappingStore();
    const th = { textAlign: 'left', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, padding: '8px 12px', borderBottom: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap' };
    return (
      <div style={{ overflow: 'auto', maxHeight: '100%' }}>
        <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'separate', borderSpacing: 0, fontFamily: P.fontSans }}>
          <thead style={{ position: 'sticky', top: 0, background: P.surface2, zIndex: 5 }}>
            <tr>
              <th style={{ ...th, width: 32 }} aria-label="Expand"></th>
              <th style={th}>Status</th><th style={th}>Invoice</th><th style={th}>Vendor</th><th style={th}>Received</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th><th style={{ ...th, textAlign: 'right' }}>Variance</th><th style={{ ...th, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, idx) => {
              const isSelected = inv.id === selectedId;
              const isExpanded = inv.id === expandedId;
              const isMapped = snap.mappedInvoices.has(inv.id) || inv.inboxStatus === 'mapped';
              const meta = HD.INBOX_STATUS_META[isMapped ? 'mapped' : inv.inboxStatus];
              const td = { padding: '9px 12px', borderBottom: `1px solid ${P.hairline}`, verticalAlign: 'middle', color: P.ink };
              return (
                <React.Fragment key={inv.id}>
                  <tr tabIndex={0} onClick={() => onSelect(inv.id)} aria-selected={isSelected} aria-expanded={isExpanded}
                    style={{ cursor: 'pointer', background: isSelected ? P.surface3 : idx % 2 === 1 ? P.surface2 : 'transparent' }}>
                    <td style={{ ...td, width: 32, borderLeft: `3px solid ${isSelected ? P.ink : 'transparent'}` }}>
                      <button onClick={(e) => { e.stopPropagation(); onToggleExpanded(inv.id); }} aria-label={isExpanded ? 'Collapse AI matches' : 'Show AI matches'} title={isExpanded ? 'Collapse AI matches' : 'Show AI matches'}
                        style={{ display: 'inline-flex', height: 24, width: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: isExpanded ? P.surface3 : 'transparent', color: isExpanded ? P.ink : P.inkMute }}>
                        <Icon name="chevron-down" size={14} stroke={2} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                      </button>
                    </td>
                    <td style={td}><HDPill tone={meta.color} label={meta.label} title={meta.description} size="sm" /></td>
                    <td style={td}>
                      <div style={{ fontFamily: P.fontMono, fontSize: 13.5 }}>{inv.invoiceNumber}</div>
                      {inv.version > 1 && <div style={{ fontSize: 11.5, color: P.inkMute }}>v{inv.version} · amended</div>}
                    </td>
                    <td style={td}>{inv.vendorName}</td>
                    <td style={{ ...td, color: P.ink2 }}>{HD.relativeOrDate(inv.receivedDate)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: P.fontMono }}>{HD.formatCurrency(inv.total)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {inv.varianceSeverity === 'none'
                        ? <span style={{ color: P.inkMute, fontSize: 12.5 }}>—</span>
                        : <HDPill tone={inv.varianceSeverity === 'critical' || inv.varianceSeverity === 'major' ? 'blocked' : 'warn'} size="sm" icon={false} label={HD.formatCurrency(inv.varianceAmount, { showCents: false })} />}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}><InvoiceRowActions inv={inv} isMapped={isMapped} /></td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: isSelected ? P.surface3 : P.surface2 }}>
                      <td colSpan={8} style={{ padding: 12, borderBottom: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${isSelected ? P.ink : 'transparent'}` }}><MatchPreview invoice={inv} /></td>
                    </tr>)}
                </React.Fragment>);
            })}
          </tbody>
        </table>
      </div>);
  }

  function InvoicePreview({ invoice, navigate }) {
    const P = useP(), HD = window.HD;
    if (!invoice) return <HDEmpty icon="receipt" title="Select an invoice" body="Click a row on the left to preview. Keyboard-nav works too — ↑ ↓ to move, Enter to open." style={{ height: '100%', justifyContent: 'center' }} />;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                <span>Invoice</span><span>·</span><span style={{ color: P.ink2 }}>{invoice.vendorName}</span>
              </div>
              <div style={{ fontFamily: P.fontMono, fontSize: 21, color: P.ink, fontWeight: 600 }}>{invoice.invoiceNumber}</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <HDPill tone={HD.invoiceStatusTone(invoice.status)} label={HD.INVOICE_STATUS_LABEL[invoice.status]} />
                {invoice.version > 1 && <HDPill tone="info" icon={false} size="sm" label={`v${invoice.version}`} />}
                <HDPill tone="neutral" icon={false} size="sm" label={`OCR ${(invoice.confidence * 100).toFixed(0)}%`}
                  title="Claude's confidence in the OCR + field extraction. >0.90 auto-posts; 0.70–0.90 one-click confirm; <0.70 manual review." />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <MicroLabel align="right">Total</MicroLabel>
              <DisplayNum size={28} style={{ marginTop: 4 }}>{HD.formatCurrency(invoice.total)}</DisplayNum>
              <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 4 }}>Received {HD.formatDate(invoice.receivedDate)}</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <MetaCell label="Entity" value={invoice.entity.toUpperCase()} />
            <MetaCell label="Invoice Date" value={HD.formatDate(invoice.invoiceDate)} />
            <MetaCell label="Subtotal" value={HD.formatCurrency(invoice.subtotal)} />
            <MetaCell label="Tax" value={HD.formatCurrency(invoice.tax)} />
            <MetaCell label="METRC Manifest" value={invoice.metrcManifest || '—'} mono />
            <MetaCell label="Variance" value={invoice.varianceSeverity === 'none' ? '—' : HD.formatCurrency(invoice.varianceAmount)} />
          </div>
          <div>
            <MicroLabel style={{ marginBottom: 8 }}>Line items ({invoice.lineItems.length})</MicroLabel>
            <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
                <thead style={{ background: P.surface2 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: P.inkMute, fontWeight: 500, fontSize: 12.5 }}>Product</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: P.inkMute, fontWeight: 500, fontSize: 12.5 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: P.inkMute, fontWeight: 500, fontSize: 12.5 }}>Unit</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: P.inkMute, fontWeight: 500, fontSize: 12.5 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li) => (
                    <tr key={li.id} style={{ borderTop: `1px solid ${P.hairline}` }}>
                      <td style={{ padding: '8px 12px', color: P.ink }}>
                        <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.productName}</div>
                        <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{li.sku}</div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: P.fontMono }}>{li.qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: P.fontMono }}>{HD.formatCurrency(li.unitCost)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: P.fontMono }}>{HD.formatCurrency(li.qty * li.unitCost)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
          {invoice.notes && (
            <div style={{ marginTop: 20, padding: 12, borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface3, fontSize: 13.5, color: P.ink2 }}>
              <MicroLabel style={{ marginBottom: 4 }}>Note</MicroLabel>{invoice.notes}
            </div>)}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 8, background: P.surface2 }}>
          <PBtn variant="accent" full iconRight="arrow-right" onClick={() => navigate(`#/invoices/${invoice.id}`)}>Open detail</PBtn>
          <PBtn variant="secondary" icon="shield" onClick={() => navigate(`#/invoices/${invoice.id}`)}>3-way match</PBtn>
        </div>
      </div>);
  }

  window.ScreenInbox = function ScreenInbox({ navigate }) {
    const P = useP(), HD = window.HD;
    const INVOICES = window.HD_DATA.INVOICES;
    const [view, setView] = React.useState('mine');
    const [filter, setFilter] = React.useState('all');
    const [query, setQuery] = React.useState('');
    const [selectedId, setSelectedId] = React.useState(INVOICES[0]?.id);
    const [expandedId, setExpandedId] = React.useState(undefined);
    const [batchDismissed, setBatchDismissed] = React.useState(false);
    const [confirmOpen, setConfirmOpen] = React.useState(false);

    const viewFiltered = React.useMemo(() => (view === 'mine' ? INVOICES.filter(needsYou) : INVOICES), [view]);
    const filtered = React.useMemo(() => {
      let base = viewFiltered;
      if (filter !== 'all') base = base.filter((i) => i.inboxStatus === filter);
      if (query.trim()) {
        const q = query.toLowerCase();
        base = base.filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.vendorName.toLowerCase().includes(q) || i.lineItems.some((li) => li.productName.toLowerCase().includes(q)));
      }
      return base;
    }, [viewFiltered, filter, query]);

    const counts = React.useMemo(() => {
      const c = { all: viewFiltered.length, unmatched: 0, autoposted: 0, corrected: 0, requested: 0, mapped: 0 };
      viewFiltered.forEach((i) => { c[i.inboxStatus] = (c[i.inboxStatus] || 0) + 1; });
      return c;
    }, [viewFiltered]);

    const needsYouCount = React.useMemo(() => INVOICES.filter(needsYou).length, []);
    const allCount = INVOICES.length;
    const hiddenCount = allCount - needsYouCount;

    // Smart batching — ≥3 clean auto-extracts from one vendor in Needs-you.
    const smartBatchTarget = React.useMemo(() => {
      if (view !== 'mine') return null;
      const clean = INVOICES.filter((i) => i.inboxStatus !== 'autoposted' && i.confidence >= 0.9 && i.varianceSeverity === 'none' && (i.unmappedManifestUids?.length ?? 0) === 0);
      const byVendor = new Map();
      for (const inv of clean) { const list = byVendor.get(inv.vendorName) ?? []; list.push(inv); byVendor.set(inv.vendorName, list); }
      let best = null;
      for (const [vendor, invoices] of byVendor) {
        if (invoices.length < 3) continue;
        if (!best || invoices.length > best.invoices.length) best = { vendor, invoices };
      }
      return best;
    }, [view]);

    const summary = window.HD_DATA.inboxSummary();
    const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0];
    const batchTotal = smartBatchTarget ? smartBatchTarget.invoices.reduce((s, i) => s + i.total, 0) : 0;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 20px 12px', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, flex: '0 0 auto' }}>
          <AutoPostRateTile />
          <SummaryCard icon="clock" label="Pending review" value={String(summary.pendingReview)} tone="warn" sub="Across 7 vendors" />
          <SummaryCard icon="flag" label="CFO escalations" value={String(summary.cfoEscalations)} tone="blocked" sub="Variance > $500" />
          <SummaryCard icon="clock" label="Saved this month" value={`~${summary.hoursSaved}h`} tone="brand" sub="vs manual intake" />
        </div>

        <div style={{ padding: '4px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: '0 0 auto' }}>
          <ViewToggle value={view} onChange={setView} mineCount={needsYouCount} allCount={allCount} />
          {view === 'mine' && hiddenCount > 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: P.inkMute }}>
              Hiding <span style={{ color: P.ink2, fontFamily: P.fontMono }}>{hiddenCount}</span> auto-posted invoices that need no action.{' '}
              <button onClick={() => setView('all')} style={{ background: 'none', border: 'none', padding: 0, color: P.ink2, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontSize: 12.5, fontFamily: P.fontSans }}>Show all</button>
            </p>)}
        </div>

        {smartBatchTarget && !batchDismissed && (
          <div style={{ padding: '0 20px 12px', flex: '0 0 auto' }}>
            <Card padding={16} style={{ border: `1px solid ${P.accentBorder}`, background: P.accentSoft }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: P.accent, color: P.accentInk, flex: '0 0 auto' }}><Icon name="sparkle" size={16} stroke={2} /></span>
                <div style={{ flex: 1, minWidth: 240, fontSize: 13.5, color: P.ink }}>
                  <strong style={{ fontFamily: P.fontMono }}>{smartBatchTarget.invoices.length} invoices</strong> from <strong>{smartBatchTarget.vendor}</strong> are ready to approve — all auto-extracted, all validation passed, total <strong style={{ fontFamily: P.fontMono }}>{HD.formatCurrency(batchTotal, { showCents: false })}</strong>.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                  <PBtn size="sm" variant="ghost" onClick={() => setBatchDismissed(true)}>Dismiss</PBtn>
                  <PBtn size="sm" variant="accent" icon="check-circle" onClick={() => setConfirmOpen(true)}>Approve all</PBtn>
                </div>
              </div>
            </Card>
          </div>)}

        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${P.hairline2}`, flexWrap: 'wrap', flex: '0 0 auto' }}>
          <StatusChips value={filter} counts={counts} onChange={setFilter} />
          <div style={{ marginLeft: 'auto', width: 320 }}>
            <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice #, vendor, product" aria-label="Search invoices" />
          </div>
        </div>

        <div className="hd-split" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ minHeight: 0, overflow: 'hidden', borderRight: `1px solid ${P.hairline2}` }}>
            {INVOICES.length === 0 ? <EmptyInbox mode="empty" navigate={navigate} />
              : filtered.length === 0 ? <EmptyInbox mode="filtered" navigate={navigate} />
              : <InvoiceList invoices={filtered} selectedId={selected?.id} onSelect={setSelectedId} expandedId={expandedId} onToggleExpanded={(id) => setExpandedId((cur) => (cur === id ? undefined : id))} />}
          </div>
          <div style={{ minHeight: 0, overflow: 'hidden', background: P.surface }}>
            <InvoicePreview invoice={selected} navigate={navigate} />
          </div>
        </div>

        {confirmOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setConfirmOpen(false)} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
            <Card padding={0} style={{ position: 'relative', width: 480, maxWidth: '92vw' }}>
              <div style={{ padding: 20 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Approve {smartBatchTarget?.invoices.length ?? 0} invoices?</h2>
                <p style={{ margin: '8px 0 0', fontSize: 13.5, color: P.inkDim, lineHeight: 1.5 }}>
                  All from <span style={{ color: P.ink }}>{smartBatchTarget?.vendor}</span> · auto-extracted at ≥90% confidence · zero variance · all METRC manifests matched. Total <span style={{ color: P.ink, fontFamily: P.fontMono }}>{HD.formatCurrency(batchTotal, { showCents: false })}</span> will post to AP.
                </p>
              </div>
              <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</PBtn>
                <PBtn variant="accent" icon="check-circle" onClick={() => {
                  setConfirmOpen(false); setBatchDismissed(true);
                  window.hdToast?.({ title: `Approved ${smartBatchTarget.invoices.length} invoices — nothing posted to AP`, description: `${smartBatchTarget.vendor} · ${HD.formatCurrency(batchTotal, { showCents: false })} in this demo. No AP entry was created.`, tone: 'ok' });
                }}>Approve all</PBtn>
              </div>
            </Card>
          </div>)}
      </div>);
  };
})();
