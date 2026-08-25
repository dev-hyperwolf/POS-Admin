// ── /invoices/[id] — three-way match detail ───────────────────────────────
// Ports app/(shell)/invoices/[id]/page.tsx + components/invoice-detail/*.
;(function () {
  const useP = window.useP;

  function MappingLegend() {
    const P = useP(), HD = window.HD;
    const item = (tone, label, flag) => {
      const c = HD.tone(P, tone);
      return (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: P.ink2 }}>
          {flag ? <Icon name="flag" size={11} stroke={2} color={c.fg} /> : <span style={{ width: 8, height: 8, borderRadius: 99, background: c.fg }} />}
          {label}
        </span>);
    };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, fontSize: 10 }}>Mapping</span>
        {item('ok', '≥92% mapped')}{item('warn', '70–92% needs check')}{item('blocked', 'unmapped', true)}
        <span title="≥92% — auto-mapped: exact SKU + qty or sum-match with siblings. 70–92% — needs check: fuzzy SKU or qty-only match. Unmapped — no plausible match; blocks auto-post until resolved."
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: P.inkMute, cursor: 'help' }}>
          <Icon name="info" size={12} stroke={2} /><span>legend</span>
        </span>
      </div>);
  }

  const GRID = '24px minmax(200px,2fr) 1fr 1fr 1fr';
  const mappingReasonLabel = (r) => ({ exact_sku_qty: 'Exact SKU + qty match', sum_match: 'Sibling package — sum matches', fuzzy_sku_exact_qty: 'Fuzzy SKU + exact qty', qty_only: 'Qty-only plausible match', manual: 'Manually mapped', unmapped: 'Unmapped' }[r] || r);

  function VarianceCell({ qty, unit, highlight, tooltip }) {
    const P = useP(), HD = window.HD;
    const c = highlight ? HD.tone(P, highlight) : null;
    return (
      <div title={tooltip} style={{ padding: '12px', borderLeft: `1px solid ${P.hairline2}`, textAlign: 'right', background: c ? c.bg : 'transparent' }}>
        <div style={{ fontFamily: P.fontMono, fontSize: 13.5, color: c ? c.fg : P.ink }}>{qty} × {HD.formatCurrency(unit)}</div>
        <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>= {HD.formatCurrency(qty * unit)}</div>
      </div>);
  }

  function UidRow({ uid, totalUnit, isSibling, siblingIndex, siblingCount }) {
    const P = useP(), HD = window.HD;
    const high = uid.confidence >= 0.92;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const unmapped = uid.matchReason === 'unmapped';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: GRID, background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
        <div />
        <div style={{ paddingLeft: 24, paddingRight: 12, paddingTop: 8, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          {isSibling && <span aria-hidden="true" style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: P.accentBorder, opacity: .6 }} />}
          {isSibling && (
            <span title={`Sibling ${siblingIndex} of ${siblingCount}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 16, padding: '0 6px', borderRadius: 3, background: P.accentSoft, color: accentInk, fontSize: 10, fontWeight: 700, fontFamily: P.fontMono, letterSpacing: '.06em' }}>{siblingIndex}/{siblingCount}</span>)}
          <UidChip value={uid.uid} kind="metrc" size="sm" />
          {unmapped
            ? <span title="No confident map — manual review required" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: HD.tone(P, 'blocked').fg }}><Icon name="flag" size={10} stroke={2} />unmapped</span>
            : <span title={`${mappingReasonLabel(uid.matchReason)} · ${(uid.confidence * 100).toFixed(1)}% confidence`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: HD.tone(P, high ? 'ok' : 'warn').fg }} />
              <span style={{ fontSize: 10, color: high ? P.inkMute : HD.tone(P, 'warn').fg }}>{(uid.confidence * 100).toFixed(0)}%</span>
            </span>}
        </div>
        <div style={{ padding: '8px 12px', textAlign: 'right' }}><span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>{uid.qty} units</span></div>
        <div style={{ padding: '8px 12px', textAlign: 'right' }}><span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{high ? 'mapped' : 'needs check'}</span></div>
        <div style={{ padding: '8px 12px', textAlign: 'right' }}><span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>= {HD.formatCurrency(uid.qty * totalUnit)}</span></div>
      </div>);
  }

  function LineRow({ li }) {
    const P = useP(), HD = window.HD;
    const manifest = li.manifestQty ?? li.qty;
    const receipt = li.receiptQty ?? li.qty;
    const invoiceQty = li.invoiceQty ?? li.qty;
    const expectedUnit = li.expectedUnitCost ?? li.unitCost;
    const qtyVariance = invoiceQty !== receipt || receipt !== manifest;
    const costVariance = li.unitCost !== expectedUnit;
    const uids = li.metrcUids ?? [];
    const hasUids = uids.length > 0;
    const isSiblingGroup = uids.length > 1;
    const [open, setOpen] = React.useState(uids.length > 1 || uids.some((u) => u.confidence < 0.92));
    const mappedQty = uids.reduce((s, u) => s + u.qty, 0);
    const qtyMismatch = hasUids && mappedQty !== manifest;
    const sumConfirmed = hasUids && !qtyMismatch;
    const sev = li.variance === 'critical' || li.variance === 'major' ? 'blocked' : 'warn';
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <React.Fragment>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, borderBottom: `1px solid ${P.hairline}` }}>
          <button onClick={() => setOpen((v) => !v)} disabled={!hasUids} aria-expanded={open} aria-label={open ? 'Collapse UIDs' : 'Expand UIDs'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: P.inkMute, cursor: hasUids ? 'pointer' : 'default', opacity: hasUids ? 1 : .3 }}>
            <Icon name="chevron-right" size={14} stroke={2} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: P.ink }}>{li.productName}</span>
              {isSiblingGroup && <span title={`${uids.length} sibling packages map to this line`} style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 99, background: P.accentSoft, border: `1px solid ${P.accentBorder}`, color: accentInk, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{uids.length} siblings</span>}
            </div>
            <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{li.sku}</div>
            {hasUids && (
              <div style={{ fontSize: 11.5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: P.inkMute, fontFamily: P.fontMono }}>{uids.length} UID{uids.length === 1 ? '' : 's'}</span>
                <span style={{ color: P.inkMute }}>·</span>
                {sumConfirmed && isSiblingGroup
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: HD.tone(P, 'ok').fg, fontFamily: P.fontMono }}><Icon name="check" size={10} stroke={2.6} />sum {mappedQty}/{manifest}</span>
                  : <span style={{ fontFamily: P.fontMono, color: qtyMismatch ? HD.tone(P, 'warn').fg : P.inkMute }}>{mappedQty}/{manifest} units mapped</span>}
              </div>)}
            {li.varianceNote && <div style={{ fontSize: 11.5, color: HD.tone(P, 'warn').fg, marginTop: 4 }}>{li.varianceNote}</div>}
          </div>
          <VarianceCell qty={manifest} unit={expectedUnit} highlight={qtyVariance && manifest !== invoiceQty ? sev : undefined} tooltip={`Manifest qty ${manifest}`} />
          <VarianceCell qty={receipt} unit={expectedUnit} highlight={receipt !== manifest || receipt !== invoiceQty ? sev : undefined}
            tooltip={`Receipt qty ${receipt}${receipt !== manifest ? ` · ${receipt - manifest > 0 ? '+' : ''}${receipt - manifest} vs manifest` : ''}`} />
          <VarianceCell qty={invoiceQty} unit={li.unitCost} highlight={qtyVariance || costVariance ? sev : undefined}
            tooltip={`Invoice qty ${invoiceQty} · Unit ${HD.formatCurrency(li.unitCost)}${costVariance ? ` (vs ${HD.formatCurrency(expectedUnit)} expected)` : ''}`} />
        </div>
        {open && hasUids && uids.map((u, idx) => (
          <UidRow key={u.uid} uid={u} totalUnit={expectedUnit} isSibling={isSiblingGroup} siblingIndex={idx + 1} siblingCount={uids.length} />))}
      </React.Fragment>);
  }

  function ThreeWayMatch({ invoice }) {
    const P = useP(), HD = window.HD;
    const head = (label, tone) => (
      <div style={{ padding: '10px 12px', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, fontWeight: 500, borderBottom: `1px solid ${P.hairline2}`, background: P.surface2, display: 'flex', alignItems: 'center', gap: 6 }}>
        {tone && <span style={{ width: 8, height: 8, borderRadius: 99, background: tone === 'brand' ? P.accent : HD.tone(P, tone).fg }} />}
        {label}
      </div>);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MappingLegend />
        <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden', background: P.surface }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID }}>
            {head('')}{head('Product / SKU')}{head('METRC Manifest', 'info')}{head('Receipt (Hyperdrive)', 'brand')}{head('Vendor Invoice', 'warn')}
          </div>
          {invoice.lineItems.map((li) => <LineRow key={li.id} li={li} />)}
        </div>
      </div>);
  }

  function VariancePanel({ invoice }) {
    const P = useP(), HD = window.HD;
    const variances = invoice.lineItems.filter((li) => li.variance && li.variance !== 'none');
    const qtyShort = variances.filter((li) => (li.receiptQty ?? 0) < (li.invoiceQty ?? 0)).reduce((s, li) => s + ((li.invoiceQty ?? 0) - (li.receiptQty ?? 0)) * li.unitCost, 0);
    const costDiff = variances.reduce((s, li) => s + (li.unitCost - (li.expectedUnitCost ?? li.unitCost)) * (li.receiptQty ?? li.qty), 0);
    const Row = ({ icon, tone, label, value, bold }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: P.ink2 }}><Icon name={icon} size={14} stroke={1.9} color={HD.tone(P, tone).fg} /><span>{label}</span></div>
        <span style={{ fontFamily: P.fontMono, color: P.ink, fontWeight: bold ? 600 : 400 }}>{value}</span>
      </div>);
    return (
      <Card padding={0}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Variance summary</h3>
          {invoice.varianceSeverity !== 'none' && <HDPill tone={invoice.varianceSeverity === 'critical' || invoice.varianceSeverity === 'major' ? 'blocked' : 'warn'} icon={false} size="sm" label={invoice.varianceSeverity} />}
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {invoice.varianceSeverity === 'none'
            ? <div style={{ fontSize: 13.5, color: P.inkDim, padding: '8px 0' }}>No variances detected. Ready to post.</div>
            : (
              <React.Fragment>
                <Row icon="box" tone="blocked" label="Short ship" value={HD.formatCurrency(qtyShort)} />
                <Row icon="trending-up" tone="warn" label="Unit cost drift" value={HD.formatCurrency(costDiff)} />
                <div style={{ borderTop: `1px solid ${P.hairline2}`, paddingTop: 12 }} />
                <Row icon="flag" tone="warn" label="Total variance" value={HD.formatCurrency(invoice.varianceAmount)} bold />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {variances.map((li) => (
                    <div key={li.id} style={{ fontSize: 12.5, borderLeft: `2px solid ${HD.tone(P, 'warn').fg}99`, paddingLeft: 8, paddingTop: 2, paddingBottom: 2 }}>
                      <div style={{ color: P.ink2 }}>{li.productName}</div>
                      <div style={{ color: P.inkMute }}>{li.varianceNote}</div>
                    </div>))}
                </div>
              </React.Fragment>)}
        </div>
      </Card>);
  }

  function EvidenceGallery({ invoice }) {
    const P = useP(), HD = window.HD;
    const items = [
      { id: 'pdf', label: 'Vendor PDF', icon: 'note' },
      { id: 'manifest', label: 'METRC manifest', icon: 'receipt' },
      { id: 'photo', label: 'Dock photo', icon: 'camera' },
    ];
    return (
      <Card padding={0}>
        <div style={{ padding: '14px 16px 8px' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Evidence</h3></div>
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ aspectRatio: '1 / 1', borderRadius: 10, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
              <Icon name={it.icon} size={18} stroke={1.7} color={P.inkMute} />
              <div style={{ fontSize: 11.5, color: P.ink2, textAlign: 'center', padding: '0 4px' }}>{it.label}</div>
              <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{HD.formatDate(invoice.receivedDate)}</div>
            </div>))}
        </div>
      </Card>);
  }

  function scoreCandidates(u, invoice) {
    return invoice.lineItems.map((line) => {
      let score = 0;
      const reasons = [];
      const manifest = line.manifestQty ?? line.qty;
      if (manifest === u.qty) { score += 0.5; reasons.push(`qty ${u.qty} matches`); }
      else if (Math.abs(manifest - u.qty) <= 2) { score += 0.3; reasons.push(`qty within 2 of ${u.qty}`); }
      if (u.productHint) {
        const hintTokens = u.productHint.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
        const nameTokens = line.productName.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
        const overlap = hintTokens.filter((t) => nameTokens.includes(t)).length;
        if (overlap > 0) { score += Math.min(0.4, overlap * 0.15); reasons.push(`${overlap} product token${overlap === 1 ? '' : 's'} match`); }
      }
      const mappedSum = (line.metrcUids ?? []).reduce((s, x) => s + x.qty, 0);
      const room = manifest - mappedSum;
      if (room >= u.qty) { score += 0.1; reasons.push(`line has ${room} unmapped units`); }
      return { line, score, reasons };
    }).sort((a, b) => b.score - a.score);
  }

  function UnmappedResolver({ u, invoice, onMap }) {
    const P = useP(), HD = window.HD;
    const candidates = React.useMemo(() => scoreCandidates(u, invoice), [u, invoice]);
    const [showAll, setShowAll] = React.useState(false);
    const visible = showAll ? candidates : candidates.slice(0, 3);
    const bestScore = candidates[0]?.score ?? 0;
    const [selectedId, setSelectedId] = React.useState(bestScore >= 0.5 ? candidates[0]?.line.id ?? null : null);
    const Row = ({ label, value, bold, tone }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
        <span style={{ color: P.inkMute }}>{label}</span>
        <span style={{ fontFamily: P.fontMono, fontWeight: bold ? 600 : 400, color: tone ? HD.tone(P, tone).fg : P.ink }}>{value}</span>
      </div>);
    return (
      <div style={{ borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <UidChip value={u.uid} kind="metrc" size="md" />
            <div style={{ fontSize: 13.5, color: P.ink, marginTop: 6 }}>{u.productHint ?? <span style={{ color: P.inkMute, fontStyle: 'italic' }}>unknown product</span>}</div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{u.qty} units · {u.reason}</div>
          </div>
        </div>
        <MicroLabel style={{ marginBottom: 8 }}>Candidate invoice lines</MicroLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {visible.map((c, idx) => {
            const isBest = idx === 0 && bestScore >= 0.5;
            const selected = c.line.id === selectedId;
            const manifest = c.line.manifestQty ?? c.line.qty;
            const roomLeft = manifest - (c.line.metrcUids ?? []).reduce((s, x) => s + x.qty, 0);
            return (
              <button key={c.line.id} onClick={() => setSelectedId(c.line.id)} aria-pressed={selected}
                style={{ position: 'relative', textAlign: 'left', borderRadius: 10, padding: 12, cursor: 'pointer', fontFamily: P.fontSans,
                  background: selected ? P.surface3 : P.surface, border: `1px solid ${selected ? P.ink : isBest ? P.accentBorder : P.hairline2}` }}>
                {isBest && <span style={{ position: 'absolute', top: -8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, height: 18, padding: '0 6px', borderRadius: 99, background: P.accent, color: P.accentInk, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}><Icon name="sparkle" size={9} stroke={2.4} />best pair</span>}
                <div style={{ fontSize: 12.5, color: P.ink, minHeight: 34 }}>{c.line.productName}</div>
                <div style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute, marginTop: 4 }}>{c.line.sku}</div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Row label="Line qty" value={`${c.line.qty}`} />
                  <Row label="Unit cost" value={HD.formatCurrency(c.line.unitCost)} />
                  <Row label="Line total" value={HD.formatCurrency(c.line.qty * c.line.unitCost)} bold />
                  <Row label="Room left" value={`${roomLeft} units`} tone={roomLeft >= u.qty ? 'ok' : roomLeft <= 0 ? 'blocked' : 'warn'} />
                </div>
                {c.reasons.length > 0 && <div style={{ marginTop: 8, fontSize: 10, color: P.inkMute }}>{c.reasons.slice(0, 2).join(' · ')}</div>}
                {selected && <span style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', height: 20, width: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: P.ink, color: P.surface }}><Icon name="check" size={12} stroke={3} /></span>}
              </button>);
          })}
        </div>
        {candidates.length > 3 && (
          <button onClick={() => setShowAll((v) => !v)} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 11.5, color: P.inkMute, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>
            {showAll ? 'Show top 3 candidates' : `Show all ${candidates.length} lines`}
          </button>)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline2}` }}>
          <span style={{ marginRight: 'auto', fontSize: 11.5, color: P.inkMute }}>
            {selectedId ? `Ready to map to ${candidates.find((c) => c.line.id === selectedId)?.line.productName.slice(0, 40)}` : 'Pick a candidate to continue.'}
          </span>
          <PBtn size="sm" variant="accent" icon="check" disabled={!selectedId} onClick={() => {
            const line = candidates.find((c) => c.line.id === selectedId)?.line;
            if (line) onMap(u, line.productName);
          }}>Confirm mapping</PBtn>
        </div>
      </div>);
  }

  function UnmappedUidsSection({ invoice }) {
    const P = useP(), HD = window.HD;
    const initial = invoice.unmappedManifestUids ?? [];
    const [remaining, setRemaining] = React.useState(initial);
    React.useEffect(() => { setRemaining(invoice.unmappedManifestUids ?? []); }, [invoice.id]);
    if (initial.length === 0) return null;
    const bad = HD.tone(P, 'blocked'), ok = HD.tone(P, 'ok');
    return (
      <React.Fragment>
        {remaining.length > 0 ? (
          <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: P.r12, border: `1px solid ${bad.fg}66`, background: bad.bg, padding: '12px 16px' }}>
            <Icon name="flag" size={18} stroke={2} color={bad.fg} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: bad.fg, fontWeight: 500 }}>{remaining.length} manifest UID{remaining.length === 1 ? '' : 's'} couldn't be mapped. Review below.</div>
              <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 2 }}>Auto-post is blocked until every UID is resolved.</div>
            </div>
          </div>
        ) : (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: P.r12, border: `1px solid ${ok.fg}4d`, background: ok.bg, padding: '12px 16px' }}>
            <Icon name="check" size={18} stroke={2.4} color={ok.fg} />
            <div style={{ fontSize: 13.5, color: ok.fg }}>All {initial.length} manifest UID{initial.length === 1 ? ' is' : 's are'} mapped. Ready to post.</div>
          </div>)}
        {remaining.length > 0 && (
          <Card padding={0}>
            <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Unmapped manifest UIDs</h3>
              <span style={{ fontSize: 11.5, color: P.inkMute }}>{remaining.length} of {initial.length} remaining</span>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {remaining.map((u) => (
                <UnmappedResolver key={u.uid} u={u} invoice={invoice} onMap={(uu, label) => {
                  setRemaining((prev) => prev.filter((p) => p.uid !== uu.uid));
                  window.hdToast?.({ title: 'UID mapped', description: `${uu.uid.slice(0, 9)}… → ${label}`, tone: 'ok' });
                }} />))}
            </div>
          </Card>)}
      </React.Fragment>);
  }

  window.ScreenInvoiceDetail = function ScreenInvoiceDetail({ path, navigate }) {
    const P = useP(), HD = window.HD;
    const id = path.split('/')[2];
    const invoice = window.HD_DATA.INVOICES.find((i) => i.id === id) || window.HD_DATA.INVOICES[0];
    const [selectedVersion, setSelectedVersion] = React.useState(String(invoice.version));
    const unmappedCount = invoice.unmappedManifestUids?.length ?? 0;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => navigate('#/inbox')} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="arrow-left" size={14} stroke={2} /> Back to inbox
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ height: 48, width: 48, borderRadius: 12, background: P.accentSoft, border: `1px solid ${P.accentBorder}`, color: accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
              {invoice.vendorName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
            <div>
              <MicroLabel>{invoice.vendorName} · {invoice.entity.toUpperCase()}</MicroLabel>
              <h1 style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 600, color: P.ink, lineHeight: 1.1, fontFamily: P.fontMono, letterSpacing: '-.01em' }}>{invoice.invoiceNumber}</h1>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <HDPill tone={HD.invoiceStatusTone(invoice.status)} label={HD.INVOICE_STATUS_LABEL[invoice.status]} />
                <HDPill tone="neutral" icon={false} size="sm" label={`OCR ${(invoice.confidence * 100).toFixed(0)}%`} />
                <HDPill tone="neutral" icon={false} size="sm" label={`Received ${HD.formatDate(invoice.receivedDate)}`} />
                {invoice.metrcManifest
                  ? <HDPill tone="info" icon={false} size="sm" label={`${invoice.metrcManifest.slice(0, 12)}…`} />
                  : <HDPill tone="warn" icon={false} size="sm" label="No manifest" />}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {invoice.version > 1 && (
              <div>
                <MicroLabel style={{ marginBottom: 4 }}>Amendment</MicroLabel>
                <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}
                  style={{ minWidth: 120, height: 34, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 13.5, padding: '0 10px', color: P.ink, fontFamily: P.fontSans }}>
                  {Array.from({ length: invoice.version }, (_, i) => <option key={i + 1} value={String(i + 1)}>v{i + 1} {i + 1 === invoice.version ? '(current)' : ''}</option>)}
                </select>
              </div>)}
            <div style={{ textAlign: 'right' }}>
              <MicroLabel align="right">Invoice total</MicroLabel>
              <DisplayNum size={40} style={{ marginTop: 4 }}>{HD.formatCurrency(invoice.total)}</DisplayNum>
              <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 4, fontFamily: P.fontMono }}>{HD.formatCurrency(invoice.subtotal)} subtotal · {HD.formatCurrency(invoice.tax)} tax</div>
            </div>
          </div>
        </div>

        <UnmappedUidsSection invoice={invoice} />

        <div className="hd-2col">
          <Card padding={0}>
            <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>3-way match</h3>
              <div style={{ fontSize: 11.5, color: P.inkMute }}>METRC manifest · Receipt · Vendor invoice · UIDs</div>
            </div>
            <div style={{ padding: '0 16px 16px' }}><ThreeWayMatch invoice={invoice} /></div>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <VariancePanel invoice={invoice} />
            <EvidenceGallery invoice={invoice} />
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, margin: '0 -20px', padding: '12px 20px', borderTop: `1px solid ${P.hairline2}`, background: P.surface2 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <PBtn variant="secondary" icon="refresh" onClick={() => navigate(`#/credits/new?invoiceId=${invoice.id}`)}>Open credit memo</PBtn>
            <PBtn variant="secondary" icon="mail" onClick={() => window.hdToast?.({ title: 'Corrected invoice requested', description: 'Vendor portal notification sent.', tone: 'info' })}>Request corrected invoice</PBtn>
            <PBtn variant="danger" icon="flag" onClick={() => window.hdToast?.({ title: 'Escalated to CFO', description: `${invoice.invoiceNumber} flagged for review.`, tone: 'blocked' })}>Escalate to CFO</PBtn>
            <PBtn variant="accent" icon="check-circle" disabled={unmappedCount > 0}
              onClick={() => {
                if (unmappedCount > 0) { window.hdToast?.({ title: 'Auto-post blocked', description: 'Resolve all unmapped METRC UIDs before posting.', tone: 'blocked' }); return; }
                window.hdToast?.({ title: 'Invoice accepted & posted', description: `${invoice.invoiceNumber} posted to ledger.`, tone: 'ok' });
              }}>Accept &amp; post</PBtn>
          </div>
        </div>
      </div>);
  };
})();
