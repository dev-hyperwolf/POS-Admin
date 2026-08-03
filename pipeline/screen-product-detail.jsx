// ── /products/[id] + /products/pricing-templates ──────────────────────────
;(function () {
  const useP = window.useP;
  const TYPE_LABEL = { sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid', cbd: 'CBD', na: 'N/A' };

  function StatusBadge({ status }) {
    if (status === 'selling') return <HDPill tone="ok" icon={false} size="sm" label="Selling" />;
    if (status === 'active') return <HDPill tone="info" icon={false} size="sm" label="Active" />;
    if (status === 'sold_out') return <HDPill tone="neutral" icon={false} size="sm" label="Sold out" />;
    return <HDPill tone="blocked" icon={false} size="sm" label="Recalled" />;
  }

  function ExpiryCell({ iso }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const status = PR.batchExpiryStatus(iso);
    if (status === 'expired') return <span style={{ fontFamily: P.fontMono, color: HD.tone(P, 'blocked').fg }}>{HD.formatDate(iso)}</span>;
    if (status === 'near') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: P.fontMono, color: HD.tone(P, 'warn').fg }}><Icon name="flag" size={10} stroke={2} />{HD.formatDate(iso)}</span>;
    return <span style={{ fontFamily: P.fontMono, color: P.ink2 }}>{HD.formatDate(iso)}</span>;
  }

  function BatchTableRow({ batch, retailCents, navigate }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const margin = PR.batchMarginPct(batch.wholesaleCostCents, retailCents);
    const marginColor = margin == null ? P.inkMute : margin < 0.3 ? HD.tone(P, 'blocked').fg : margin < 0.45 ? HD.tone(P, 'warn').fg : HD.tone(P, 'ok').fg;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <TR>
        <TD><UidChip value={batch.metrcPackageId} kind="metrc" size="sm" /></TD>
        <TD align="right" mono>
          <div style={{ color: P.ink }}>{batch.qtyOnHand}</div>
          <div style={{ fontSize: 11, color: P.inkMute }}>of {batch.qtyReceived}</div>
        </TD>
        <TD align="right" mono>{batch.thcPct != null ? `${batch.thcPct.toFixed(1)}%` : batch.thcMg != null ? `${batch.thcMg}mg` : '—'}</TD>
        <TD>
          <div style={{ fontSize: 12, color: P.ink2 }}>Pkg {HD.formatDate(batch.packageDate)}</div>
          <div style={{ fontSize: 12 }}>Exp <ExpiryCell iso={batch.expirationDate} /></div>
        </TD>
        <TD align="right" mono>{HD.formatCurrency(batch.wholesaleCostCents / 100)}</TD>
        <TD align="right" mono style={{ color: marginColor }}>{margin == null ? '—' : HD.formatPercent(margin, 0)}</TD>
        <TD>
          <button onClick={() => navigate('#/ap')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: accentInk, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontMono, textDecoration: 'underline', textUnderlineOffset: 2 }}>
            <Icon name="receipt" size={11} stroke={2} />{batch.sourceInvoiceId}
          </button>
        </TD>
        <TD><StatusBadge status={batch.status} /></TD>
      </TR>);
  }

  function AttachSheet({ open, onClose, sourceBatch }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const [picked, setPicked] = React.useState(null);
    React.useEffect(() => { if (open) setPicked(null); }, [open, sourceBatch?.id]);
    if (!sourceBatch) return null;
    const suggestions = PR.matchLineToProduct(sourceBatch.productName, sourceBatch.vendorName).candidates;
    return (
      <Sheet open={open} onClose={onClose} width={480}>
        <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <MicroLabel>Map batch to product</MicroLabel>
            <h2 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 600, color: P.ink }}>{sourceBatch.productName}</h2>
            <div style={{ marginTop: 8 }}><UidChip value={sourceBatch.metrcPackageId} kind="metrc" size="sm" /></div>
            <div style={{ marginTop: 6, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{sourceBatch.brand} · {sourceBatch.category} · {sourceBatch.qty} units</div>
          </div>
          <IconBtn icon="x" size={16} onClick={onClose} style={{ width: 30, height: 30, margin: -4 }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <MicroLabel style={{ marginBottom: 8 }}>Suggested wrappers</MicroLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((c) => (
              <button key={c.productId} onClick={() => setPicked(c.productId)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans,
                  background: picked === c.productId ? P.accentSoft : P.surface, border: `1px solid ${picked === c.productId ? P.accent : P.hairline2}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: P.ink }}>{c.brandName} · {c.productName}</div>
                  <div style={{ fontSize: 11, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono }}>{Math.round(c.confidence * 100)}% match</div>
                </div>
                {picked === c.productId && <Icon name="check" size={16} stroke={2.6} color={P.mode === 'dark' ? P.accent : P.accentBorder} />}
              </button>))}
            {suggestions.length === 0 && <div style={{ fontSize: 12, color: P.inkMute }}>No confident wrapper suggestions — create a new one.</div>}
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', gap: 8 }}>
          <PBtn variant="secondary" onClick={onClose}>Cancel</PBtn>
          <PBtn variant="accent" full icon="link" disabled={!picked} onClick={() => {
            PR.mapBatchToProduct(sourceBatch.id, picked);
            onClose();
            window.hdToast?.({ title: 'Batch mapped', description: `${sourceBatch.productName} → wrapper.`, tone: 'ok' });
          }}>Map to product</PBtn>
        </div>
      </Sheet>);
  }

  window.ScreenProductDetail = function ScreenProductDetail({ path, navigate }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const id = path.split('/')[2];
    const product = PR.PRODUCTS.find((p) => p.id === id);
    const [attachOpen, setAttachOpen] = React.useState(false);
    const [activeUnmapped, setActiveUnmapped] = React.useState(null);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    if (!product) {
      return (
        <div style={{ padding: 40 }}>
          <Card padding={40} style={{ textAlign: 'center' }}>
            <Icon name="search" size={28} stroke={1.6} color={P.inkMute} />
            <div style={{ color: P.ink, marginTop: 8 }}>Product not found.</div>
            <button onClick={() => navigate('#/products')} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: accentInk, fontSize: 13, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} /> Back to products
            </button>
          </Card>
        </div>);
    }

    const batches = PR.batchesFor(product.id);
    const tpl = PR.getPricingTemplate(product.pricingTemplateId);
    const retailCents = PR.productRetailCents(product, tpl);
    const totalOnHand = batches.reduce((acc, b) => acc + b.qtyOnHand, 0);
    const warn = HD.tone(P, 'warn');

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: P.inkMute }}>
          <button onClick={() => navigate('#/products')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontSize: 12, fontFamily: P.fontSans }}>Products</button>
          <Icon name="chevron-right" size={12} stroke={2} />
          <span style={{ color: P.ink2 }}>{product.brandName}</span>
          <Icon name="chevron-right" size={12} stroke={2} />
          <span style={{ color: P.ink }}>{product.name}</span>
        </div>

        <div className="hd-prod" style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ aspectRatio: '1 / 1', background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Thumb item={{ hue: product.hue }} size={160} radius={24} />
              </div>
              <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${P.hairline2}` }}>
                {[0, 1, 2].map((i) => <Thumb key={i} item={{ hue: product.hue + i * 12 }} size={48} radius={8} />)}
              </div>
            </Card>

            <Card padding={20}>
              <div style={{ fontSize: 12, color: P.inkMute }}>{product.brandName}</div>
              <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 600, color: P.ink, lineHeight: 1.3 }}>{product.name}</h1>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <HDPill tone="brand" icon={false} size="sm" label={TYPE_LABEL[product.type]} />
                <span style={{ fontSize: 12, color: P.ink2, fontFamily: P.fontMono }}>{product.weight.value}{product.weight.unit}</span>
                <span style={{ color: P.inkMute }}>·</span>
                <span style={{ fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>{product.sku}</span>
              </div>
              {product.traits.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {product.traits.map((t) => (
                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 99, background: P.surface3, color: P.ink2, border: `1px solid ${P.hairline2}`, fontSize: 11 }}>
                      <Icon name="sparkle" size={9} stroke={2} />{t}
                    </span>))}
                </div>)}
            </Card>

            <Card padding={20}>
              <MicroLabel>Retail price</MicroLabel>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{retailCents != null ? HD.formatCurrency(retailCents / 100) : '—'}</span>
                {product.customRetailCents != null ? <HDPill tone="warn" icon={false} size="sm" label="Custom override" />
                  : tpl ? <HDPill tone="brand" icon={false} size="sm" label="From template" />
                  : <HDPill tone="neutral" icon={false} size="sm" label="Not set" />}
              </div>
              {tpl && (
                <button onClick={() => navigate('#/products/pricing-templates')}
                  style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface3, padding: '8px 12px', cursor: 'pointer', fontFamily: P.fontSans }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Icon name="tag" size={12} stroke={2} color={accentInk} />
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 12, color: P.ink }}>{tpl.name}</div>
                      <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{HD.formatCurrency(tpl.basePriceCents / 100)} · {HD.formatPercent(tpl.marginPct, 0)} target margin</div>
                    </div>
                  </div>
                  <Icon name="chevron-right" size={12} stroke={2} color={P.inkMute} />
                </button>)}
              <button style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, color: accentInk, fontSize: 12, cursor: 'pointer', fontFamily: P.fontSans, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                <Icon name="pencil" size={11} stroke={2} />Edit retail
              </button>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PR.UNMAPPED_BATCHES.length > 0 && (
              <Card padding={16} style={{ border: `1px solid ${warn.fg}66`, background: warn.bg }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Icon name="flag" size={16} stroke={2} color={warn.fg} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: P.ink }}>{PR.UNMAPPED_BATCHES.length} batch{PR.UNMAPPED_BATCHES.length === 1 ? '' : 'es'} on the floor aren't mapped to a product yet</div>
                    <div style={{ fontSize: 12, color: P.ink2, marginTop: 2 }}>Map them so retail price + the menu pull in correctly.</div>
                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {PR.UNMAPPED_BATCHES.slice(0, 3).map((u) => (
                        <button key={u.id} onClick={() => { setActiveUnmapped(u); setAttachOpen(true); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '0 12px 0 8px', borderRadius: 99, background: P.surface, border: `1px solid ${P.hairline2}`, fontSize: 12, cursor: 'pointer', fontFamily: P.fontSans }}>
                          <span style={{ fontFamily: P.fontMono, fontSize: 10, color: P.inkMute }}>{u.metrcPackageId.slice(0, 6)}…</span>
                          <span style={{ color: P.ink2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.productName}</span>
                        </button>))}
                    </div>
                  </div>
                </div>
              </Card>)}

            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Batches ({batches.length})</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: P.inkMute, fontFamily: P.fontMono }}>{totalOnHand} units on hand across {batches.length} {batches.length === 1 ? 'lot' : 'lots'}</p>
                </div>
                <PBtn size="sm" variant="secondary" icon="plus" style={{ marginLeft: 'auto' }}>Add batch</PBtn>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <HDTable>
                  <thead><tr>
                    <TH>METRC package</TH><TH align="right">Qty</TH><TH align="right">Potency</TH><TH>Package / Expires</TH>
                    <TH align="right">Wholesale</TH><TH align="right">Margin</TH><TH>Source</TH><TH>Status</TH>
                  </tr></thead>
                  <tbody>
                    {batches.length === 0
                      ? <tr><TD colSpan={8}><div style={{ padding: '40px 0', textAlign: 'center', color: P.inkMute }}>No batches mapped to this product yet.</div></TD></tr>
                      : batches.map((b) => <BatchTableRow key={b.id} batch={b} retailCents={retailCents} navigate={navigate} />)}
                  </tbody>
                </HDTable>
              </div>
            </Card>
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: P.surface, borderTop: `1px solid ${P.hairline2}` }}>
          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('#/products')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Back
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PBtn size="sm" variant="ghost" icon="pencil">Edit wrapper</PBtn>
              <PBtn size="sm" variant="ghost" icon="settings">Manage batches</PBtn>
              <PBtn size="sm" variant="accent" icon="tag" onClick={() => navigate('#/products/pricing-templates')}>Adjust pricing</PBtn>
            </div>
          </div>
        </div>

        <AttachSheet open={attachOpen} onClose={() => { setAttachOpen(false); setActiveUnmapped(null); }} sourceBatch={activeUnmapped} />
      </div>);
  };

  // ── Pricing templates ───────────────────────────────────────────────────
  window.ScreenPricingTemplates = function ScreenPricingTemplates({ navigate }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const [templates, setTemplates] = React.useState(PR.PRICING_TEMPLATES);
    const [editing, setEditing] = React.useState(null);
    const [confirming, setConfirming] = React.useState(null);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    function commit() {
      if (!confirming) return;
      setTemplates((cur) => cur.map((t) => (t.id === confirming.template.id ? { ...t, basePriceCents: confirming.basePriceCents, marginPct: confirming.marginPct } : t)));
      window.hdToast?.({ title: 'Template updated', description: `${confirming.template.productCount} product${confirming.template.productCount === 1 ? '' : 's'} re-priced.`, tone: 'ok' });
      setConfirming(null); setEditing(null);
    }

    const Row = ({ label, value, emphasis }) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ color: P.inkMute }}>{label}</span>
        <span style={{ color: emphasis ? P.ink : P.ink2, fontFamily: P.fontMono }}>{value}</span>
      </div>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: 20, gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: P.inkMute }}>
          <button onClick={() => navigate('#/products')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', fontSize: 12, fontFamily: P.fontSans }}>Products</button>
          <Icon name="chevron-right" size={12} stroke={2} /><span style={{ color: P.ink }}>Pricing templates</span>
        </div>

        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Pricing templates</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkMute }}>One template prices an entire SKU family. Update once, the menu reflects everywhere.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('#/products')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Back
            </button>
            <PBtn size="sm" variant="accent" icon="plus">New template</PBtn>
          </div>
        </header>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Template</TH><TH>Audience</TH><TH align="right">Base price</TH><TH align="right">Target margin</TH><TH align="right">Products</TH><TH></TH></tr></thead>
              <tbody>
                {templates.map((t) => {
                  const bound = PR.PRODUCTS.filter((p) => p.pricingTemplateId === t.id);
                  return (
                    <TR key={t.id}>
                      <TD><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="tag" size={12} stroke={2} color={accentInk} /><span style={{ color: P.ink }}>{t.name}</span></div></TD>
                      <TD>{t.appliesToCategory ? <HDPill tone="neutral" icon={false} size="sm" label={t.appliesToCategory} /> : <span style={{ color: P.inkMute }}>—</span>}</TD>
                      <TD align="right" mono>{HD.formatCurrency(t.basePriceCents / 100)}</TD>
                      <TD align="right" mono style={{ color: P.ink2 }}>{HD.formatPercent(t.marginPct, 0)}</TD>
                      <TD align="right" mono>
                        <button onClick={() => navigate('#/products')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, color: accentInk, cursor: 'pointer', fontFamily: P.fontMono, fontSize: 13 }}>
                          {bound.length}<Icon name="chevron-right" size={11} stroke={2} />
                        </button>
                      </TD>
                      <TD align="right"><PBtn size="xs" variant="ghost" icon="pencil" onClick={() => setEditing({ template: t, basePriceCents: t.basePriceCents, marginPct: t.marginPct })}>Edit</PBtn></TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Card padding={20}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Products on each template</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: P.inkMute }}>A quick at-a-glance binding map — useful for spotting orphan products before a price change goes out.</p>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {templates.map((t) => {
              const bound = PR.PRODUCTS.filter((p) => p.pricingTemplateId === t.id);
              return (
                <div key={t.id} style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, padding: 12, background: P.surface2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="tag" size={12} stroke={2} color={accentInk} /><span style={{ fontSize: 13, color: P.ink }}>{t.name}</span></div>
                  <div style={{ marginTop: 4, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{HD.formatCurrency(t.basePriceCents / 100)} · {HD.formatPercent(t.marginPct, 0)}</div>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {bound.map((p) => (
                      <button key={p.id} onClick={() => navigate(`#/products/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: P.ink2, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
                        <span style={{ height: 6, width: 6, borderRadius: 99, background: P.accent, flex: '0 0 auto' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        {p.customRetailCents != null && <HDPill tone="warn" icon={false} size="sm" label="override" style={{ height: 16, fontSize: 9 }} />}
                      </button>))}
                    {bound.length === 0 && <span style={{ fontSize: 12, color: P.inkMute }}>No products on this template.</span>}
                  </div>
                </div>);
            })}
          </div>
        </Card>

        {editing && !confirming && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setEditing(null)} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
            <Card padding={0} style={{ position: 'relative', width: 440, maxWidth: '92vw' }}>
              <div style={{ padding: 20 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: P.ink }}>Edit {editing.template.name}</h2>
                <p style={{ margin: '6px 0 16px', fontSize: 13, color: P.inkDim }}>Changes will affect {editing.template.productCount} product{editing.template.productCount === 1 ? '' : 's'} bound to this template.</p>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, marginBottom: 6 }}>Base price ($)</label>
                <Field type="number" step={0.5} value={(editing.basePriceCents / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, basePriceCents: Math.round(Number(e.target.value || 0) * 100) })} />
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, margin: '12px 0 6px' }}>Target margin (%)</label>
                <Field type="number" step={1} value={Math.round(editing.marginPct * 100)} onChange={(e) => setEditing({ ...editing, marginPct: Math.max(0, Math.min(95, Number(e.target.value || 0))) / 100 })} />
              </div>
              <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="ghost" onClick={() => setEditing(null)}>Cancel</PBtn>
                <PBtn variant="accent" onClick={() => setConfirming(editing)}>Review change</PBtn>
              </div>
            </Card>
          </div>)}

        {confirming && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setConfirming(null)} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
            <Card padding={0} style={{ position: 'relative', width: 440, maxWidth: '92vw' }}>
              <div style={{ padding: 20 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: P.ink }}>Update template?</h2>
                <p style={{ margin: '6px 0 16px', fontSize: 13, color: P.inkDim }}>{confirming.template.productCount} product{confirming.template.productCount === 1 ? '' : 's'} will reflect the new retail price the next time the menu rebuilds.</p>
                <div style={{ borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface3, padding: 12, fontSize: 12 }}>
                  <Row label="Old price" value={HD.formatCurrency(confirming.template.basePriceCents / 100)} />
                  <Row label="New price" value={HD.formatCurrency(confirming.basePriceCents / 100)} emphasis />
                  <Row label="Old margin" value={HD.formatPercent(confirming.template.marginPct, 0)} />
                  <Row label="New margin" value={HD.formatPercent(confirming.marginPct, 0)} emphasis />
                </div>
              </div>
              <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="ghost" onClick={() => setConfirming(null)}>Cancel</PBtn>
                <PBtn variant="accent" onClick={commit}>Update + re-price</PBtn>
              </div>
            </Card>
          </div>)}
      </div>);
  };
})();
