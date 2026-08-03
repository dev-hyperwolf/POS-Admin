// ── Inline invoice → product mapping (AI matches) ─────────────────────────
// Ports lib/invoice-mapping-store.ts + components/inbox/match-preview.tsx
// and the Hyperdrive Helper sheet it opens.
;(function () {
  const useP = window.useP;
  const HIGH = 0.85, MED = 0.55;
  const bandFor = (c) => (c >= HIGH ? 'high' : c >= MED ? 'med' : 'none');

  // In-memory mapping store — confirmed invoices + per-line decisions.
  let snapshot = { mappedInvoices: new Set(), lineDecisions: new Map(), version: 0 };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
  const store = {
    isMapped: (id) => snapshot.mappedInvoices.has(id),
    setLineDecision(lineId, decision) {
      const next = new Map(snapshot.lineDecisions);
      next.set(lineId, decision);
      snapshot = { ...snapshot, lineDecisions: next, version: snapshot.version + 1 };
      emit();
    },
    bulkAutoConfirm(decisions) {
      const next = new Map(snapshot.lineDecisions);
      for (const d of decisions) next.set(d.lineId, d.decision);
      snapshot = { ...snapshot, lineDecisions: next, version: snapshot.version + 1 };
      emit();
    },
    confirmInvoiceMapping(invoiceId) {
      const next = new Set(snapshot.mappedInvoices);
      next.add(invoiceId);
      snapshot = { ...snapshot, mappedInvoices: next, version: snapshot.version + 1 };
      emit();
    },
  };
  const useMappingStore = () => React.useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  window.HD_MAPPING = { ...store, useMappingStore };

  function ConfidencePill({ confidence, tone }) {
    const P = useP(), c = window.HD.tone(P, tone);
    return <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, fontFamily: P.fontMono, background: c.bg, color: c.fg, border: `1px solid ${c.fg}66` }}>{Math.round(confidence * 100)}%</span>;
  }

  function DecisionPill({ decision }) {
    const P = useP(), HD = window.HD;
    if (decision.kind === 'picked') return <HDPill tone="ok" size="sm" icon={false} label="✓ picked" />;
    if (decision.kind === 'create_new') return <HDPill tone="brand" size="sm" icon={false} label="+ new" />;
    return <HDPill tone="neutral" size="sm" icon={false} label="skipped" />;
  }

  function ProductPicker({ lineId, onClose, candidates }) {
    const P = useP(), PR = window.HD_PRODUCTS;
    const [q, setQ] = React.useState('');
    const [brandFilter, setBrandFilter] = React.useState(new Set());
    const [categoryFilter, setCategoryFilter] = React.useState(new Set());
    const allBrands = React.useMemo(() => [...new Set(PR.PRODUCTS.map((p) => p.brandName))].sort(), []);
    const allCategories = React.useMemo(() => [...new Set(PR.PRODUCTS.map((p) => p.category))].sort(), []);
    const toggle = (set, value, setter) => { const next = new Set(set); next.has(value) ? next.delete(value) : next.add(value); setter(next); };
    const filtered = React.useMemo(() => {
      const lowered = q.trim().toLowerCase();
      if (!lowered && brandFilter.size === 0 && categoryFilter.size === 0) {
        const candidateIds = new Set(candidates.map((c) => c.productId));
        const rest = PR.PRODUCTS.filter((p) => !candidateIds.has(p.id)).slice(0, 12);
        return [...candidates.map((c) => ({ id: c.productId, brand: c.brandName, name: c.productName, score: c.confidence })),
          ...rest.map((p) => ({ id: p.id, brand: p.brandName, name: p.name, score: 0 }))];
      }
      return PR.PRODUCTS.filter((p) => {
        if (brandFilter.size > 0 && !brandFilter.has(p.brandName)) return false;
        if (categoryFilter.size > 0 && !categoryFilter.has(p.category)) return false;
        return !lowered || p.name.toLowerCase().includes(lowered) || p.brandName.toLowerCase().includes(lowered) || p.sku.toLowerCase().includes(lowered);
      }).slice(0, 16).map((p) => ({ id: p.id, brand: p.brandName, name: p.name, score: 0 }));
    }, [q, candidates, brandFilter, categoryFilter]);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const chip = (active) => ({ height: 20, padding: '0 8px', borderRadius: 99, fontSize: 10.5, cursor: 'pointer', fontFamily: P.fontSans,
      background: active ? P.accentSoft : P.surface, color: active ? accentInk : P.inkMute, border: `1px solid ${active ? P.accentBorder : P.hairline2}` });
    return (
      <div style={{ flexBasis: '100%', marginTop: 8, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 8, boxShadow: P.shadowMd }}>
        <Field autoFocus size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by brand, name, or SKU…" aria-label="Search products" />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Brand</span>
          {allBrands.map((b) => <button key={b} onClick={() => toggle(brandFilter, b, setBrandFilter)} style={chip(brandFilter.has(b))}>{b}</button>)}
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, marginLeft: 6 }}>Category</span>
          {allCategories.map((c) => <button key={c} onClick={() => toggle(categoryFilter, c, setCategoryFilter)} style={chip(categoryFilter.has(c))}>{c}</button>)}
          {(brandFilter.size + categoryFilter.size) > 0 && (
            <button onClick={() => { setBrandFilter(new Set()); setCategoryFilter(new Set()); }} style={{ marginLeft: 'auto', height: 20, padding: '0 8px', fontSize: 10.5, color: P.inkMute, background: 'none', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button>)}
        </div>
        <ul role="listbox" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, maxHeight: 192, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.length === 0
            ? <li style={{ fontSize: 12, color: P.inkMute, padding: '6px 8px' }}>No products match.</li>
            : filtered.map((p) => (
              <li key={p.id}>
                <button role="option" onClick={() => { store.setLineDecision(lineId, { kind: 'picked', productId: p.id }); onClose(); }}
                  style={{ width: '100%', textAlign: 'left', fontSize: 12.5, padding: '6px 8px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: P.ink, fontFamily: P.fontSans }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ color: P.inkMute, width: 56, flex: '0 0 56px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {p.score > 0 && <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{Math.round(p.score * 100)}%</span>}
                </button>
              </li>))}
        </ul>
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 24, padding: '0 8px', fontSize: 11, color: P.inkMute, background: 'none', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>Cancel</button>
        </div>
      </div>);
  }

  function MatchRow({ line, match, decision }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const band = bandFor(match.confidence);
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const tone = band === 'high' ? 'ok' : band === 'med' ? 'warn' : 'blocked';
    const c = HD.tone(P, tone);
    const productLabel = (() => {
      if (decision?.kind === 'auto' || decision?.kind === 'picked') {
        const p = PR.PRODUCTS.find((x) => x.id === decision.productId);
        return p ? `${p.brandName} · ${p.name}` : '—';
      }
      if (decision?.kind === 'create_new') return 'New wrapper (will be created)';
      if (decision?.kind === 'skip') return 'Skipped';
      if (match.candidates[0]) return `${match.candidates[0].brandName} · ${match.candidates[0].productName}`;
      return 'No match found';
    })();
    const smallBtn = { height: 26, padding: '0 8px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontFamily: P.fontSans, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink };
    return (
      <li style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, padding: '6px 8px', background: c.bg, flexWrap: 'wrap' }}>
        <span style={{ flex: '0 0 auto', display: 'inline-flex', color: c.fg }}>
          <Icon name={band === 'high' ? 'check' : band === 'med' ? 'help' : 'x'} size={14} stroke={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <div title={line.productName} style={{ color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {line.productName}<span style={{ color: P.inkMute, marginLeft: 6, fontFamily: P.fontMono }}>×{line.qty}</span>
          </div>
          <span style={{ color: P.inkMute }} aria-hidden="true">→</span>
          <div title={productLabel} style={{ color: decision || band === 'high' ? P.ink : P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          {(decision?.kind === 'picked' || decision?.kind === 'create_new' || decision?.kind === 'skip')
            ? <DecisionPill decision={decision} />
            : band === 'high'
              ? <ConfidencePill confidence={match.confidence} tone="ok" />
              : (
                <React.Fragment>
                  <ConfidencePill confidence={match.confidence} tone={band === 'med' ? 'warn' : 'blocked'} />
                  <button onClick={() => setPickerOpen((s) => !s)} style={smallBtn}>Pick product</button>
                  <button onClick={() => store.setLineDecision(line.id, { kind: 'create_new' })}
                    style={band === 'none' ? { ...smallBtn, background: P.accent, color: P.accentInk, border: `1px solid ${P.accent}` } : smallBtn}>+ Create new</button>
                  <button onClick={() => store.setLineDecision(line.id, { kind: 'skip' })} title="Skip this line" aria-label="Skip this line"
                    style={{ height: 26, width: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', color: P.inkMute, cursor: 'pointer' }}>
                    <Icon name="arrow-right" size={12} stroke={2} />
                  </button>
                </React.Fragment>)}
        </div>
        {pickerOpen && <ProductPicker lineId={line.id} onClose={() => setPickerOpen(false)} candidates={match.candidates} />}
      </li>);
  }

  function HelperSheet({ open, onClose, invoice, matches, onConfirmAll }) {
    const P = useP(), HD = window.HD;
    const need = matches.filter((m) => bandFor(m.match.confidence) !== 'high');
    return (
      <Sheet open={open} onClose={onClose} width={480}>
        <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: HD.hueColor(P, 'violet') }}>
              <Icon name="sparkle" size={12} stroke={2} />Hyperdrive Helper
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 600, color: P.ink }}>About {invoice.invoiceNumber}</h2>
          </div>
          <IconBtn icon="x" size={16} onClick={onClose} style={{ width: 30, height: 30, margin: -4 }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: P.ink2, lineHeight: 1.5 }}>
            {invoice.vendorName} sent {matches.length} lines totalling {HD.formatCurrency(invoice.total)}. I matched{' '}
            {matches.length - need.length} of them to existing wrappers at ≥85% confidence.
            {need.length > 0 ? ` ${need.length} ${need.length === 1 ? 'line has' : 'lines have'} no clean twin — most likely a new SKU that isn't in the catalog yet.` : ' Nothing needs your input.'}
          </div>
          {need.length > 0 && (
            <div>
              <MicroLabel style={{ marginBottom: 8 }}>Needs a decision</MicroLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {need.map(({ line, match }) => (
                  <div key={line.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface3 }}>
                    <div style={{ fontSize: 12.5, color: P.ink }}>{line.productName}</div>
                    <div style={{ fontSize: 11, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono }}>{line.sku} · ×{line.qty} · best match {Math.round(match.confidence * 100)}%</div>
                  </div>))}
              </div>
            </div>)}
          <div style={{ fontSize: 12, color: P.inkMute, lineHeight: 1.5 }}>
            Creating a wrapper here adds it to the master catalog with this invoice as its first source. Batches are created for every mapped line and land on the pipeline board as Incoming.
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', gap: 8 }}>
          <PBtn variant="secondary" onClick={onClose}>Close</PBtn>
          <PBtn variant="accent" full icon="sparkle" onClick={() => {
            store.bulkAutoConfirm(matches.map(({ line, match }) => ({ lineId: line.id, decision: match.productId && match.confidence >= HIGH ? { kind: 'auto', productId: match.productId } : { kind: 'create_new' } })));
            onClose(); onConfirmAll();
          }}>Create the new SKU and confirm all matches</PBtn>
        </div>
      </Sheet>);
  }

  window.MatchPreview = function MatchPreview({ invoice }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const matches = React.useMemo(() => invoice.lineItems.map((line) => ({ line, match: PR.matchLineToProduct(line.productName, invoice.vendorName) })), [invoice.id]);
    const snap = useMappingStore();
    const mapped = snap.mappedInvoices.has(invoice.id);
    const [helperOpen, setHelperOpen] = React.useState(false);
    const decisionFor = React.useCallback((line, match) => {
      const explicit = snap.lineDecisions.get(line.id);
      if (explicit) return explicit;
      if (match.productId && match.confidence >= HIGH) return { kind: 'auto', productId: match.productId };
      return undefined;
    }, [snap.lineDecisions]);
    const highCount = matches.filter((m) => bandFor(m.match.confidence) === 'high').length;
    const needCount = matches.length - highCount;
    const allDecided = matches.every(({ line, match }) => !!decisionFor(line, match));
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    function handleConfirmAll() {
      const pending = [];
      for (const { line, match } of matches) {
        if (snap.lineDecisions.has(line.id)) continue;
        if (match.productId && match.confidence >= HIGH) pending.push({ lineId: line.id, decision: { kind: 'auto', productId: match.productId } });
      }
      if (pending.length) store.bulkAutoConfirm(pending);
      store.confirmInvoiceMapping(invoice.id);
      window.hdToast?.({ title: `${matches.length} batches created from this invoice`, description: `${invoice.invoiceNumber} → mapped & posted to inventory.`, tone: 'ok', action: { label: 'View batches', onClick: () => { location.hash = '#/batches'; } } });
    }

    if (mapped) {
      return (
        <div role="status" style={{ borderRadius: 8, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: P.accent, color: P.accentInk }}><Icon name="check" size={14} stroke={2.6} /></span>
          <div style={{ fontSize: 13, color: P.ink }}>
            <strong>{matches.length} batches</strong> mapped from this invoice.{' '}
            <button onClick={() => { location.hash = '#/batches'; }} style={{ background: 'none', border: 'none', padding: 0, color: accentInk, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontSize: 13, fontFamily: P.fontSans }}>View on Batches →</button>
          </div>
        </div>);
    }

    return (
      <div style={{ borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', height: 24, width: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: P.accentSoft, color: accentInk }}><Icon name="sparkle" size={11} stroke={2} /></span>
          <div style={{ fontSize: 12.5, color: P.inkDim }}>
            AI matches for <span style={{ color: P.ink, fontWeight: 600, fontFamily: P.fontMono }}>{invoice.invoiceNumber}</span> from <span style={{ color: P.ink }}>{invoice.vendorName}</span>
          </div>
        </div>
        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {matches.map(({ line, match }) => <MatchRow key={line.id} line={line} match={match} decision={decisionFor(line, match)} />)}
        </ul>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, color: P.inkDim, flex: 1 }}>
            <strong style={{ color: P.ink, fontFamily: P.fontMono }}>{highCount}</strong> of <strong style={{ color: P.ink, fontFamily: P.fontMono }}>{matches.length}</strong> will auto-map
            {needCount > 0 && <React.Fragment> · <strong style={{ color: HD.tone(P, 'warn').fg, fontFamily: P.fontMono }}>{needCount}</strong> {needCount === 1 ? 'needs' : 'need'} your input</React.Fragment>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PBtn size="sm" variant="ghost" icon="sparkle" onClick={() => setHelperOpen(true)}>Ask Claude about this invoice</PBtn>
            <PBtn size="sm" variant="accent" icon="check" disabled={!allDecided} onClick={handleConfirmAll}>Confirm all matches</PBtn>
          </div>
        </div>
        <HelperSheet open={helperOpen} onClose={() => setHelperOpen(false)} invoice={invoice} matches={matches} onConfirmAll={handleConfirmAll} />
      </div>);
  };
})();
