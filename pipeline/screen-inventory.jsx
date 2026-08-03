// ── /inventory + /products ────────────────────────────────────────────────
// Ports app/(shell)/inventory/page.tsx and app/(shell)/products/page.tsx.
;(function () {
  const useP = window.useP;
  const daysToExpiry = (b) => (b.expirationDate ? Math.round((new Date(b.expirationDate).getTime() - window.HD_DATA.NOW) / 86400000) : null);

  function ExpiryLabel({ days }) {
    const P = useP(), HD = window.HD;
    if (days === null) return <span style={{ fontSize: 12, color: P.inkMute }}>—</span>;
    const color = days < 0 || days <= 14 ? HD.tone(P, 'blocked').fg : days <= 30 ? HD.tone(P, 'warn').fg : P.ink2;
    return <span style={{ fontSize: 12, color, fontFamily: P.fontMono }}>{days < 0 ? `expired ${Math.abs(days)}d ago` : `${days}d left`}</span>;
  }

  const INV_GRID = '28px minmax(200px,2fr) 1fr 1fr 1fr 1fr';

  function BatchRows({ batches, navigate }) {
    const P = useP(), HD = window.HD;
    const sub = (label, align) => <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, textAlign: align }}>{label}</div>;
    return (
      <div style={{ background: P.canvas, borderBottom: `1px solid ${P.hairline2}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: INV_GRID, borderBottom: `1px solid ${P.hairline}` }}>
          <div />{sub('UID · packaged')}{sub('Loc')}{sub('Qty', 'right')}{sub('Expiry')}{sub('Value', 'right')}
        </div>
        {batches.map((b) => (
          <button key={b.id} onClick={() => navigate('#/batches')} style={{ display: 'grid', gridTemplateColumns: INV_GRID, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: `1px solid ${P.hairline}`, cursor: 'pointer', fontFamily: P.fontSans }}
            onMouseEnter={(e) => (e.currentTarget.style.background = P.canvas2)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <div />
            <div style={{ paddingLeft: 28, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
              <div style={{ fontFamily: P.fontMono, fontSize: 12, color: P.ink2 }}>{b.metrcPackageId.slice(0, 12)}…{b.metrcPackageId.slice(-4)}</div>
              <div style={{ fontSize: 11, color: P.inkMute, marginTop: 2 }}>{b.packageDate ? `pkg ${HD.formatDate(b.packageDate)}` : 'pkg —'}</div>
            </div>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}>
              <HDPill tone={(b.location ?? 'foh') === 'foh' ? 'info' : 'neutral'} icon={false} size="sm" label={(b.location ?? 'foh') === 'foh' ? 'Front' : 'Back'} />
            </div>
            <div style={{ padding: '8px 12px', textAlign: 'right', fontFamily: P.fontMono, fontSize: 12, color: P.ink }}>{b.qty} @ {HD.formatCurrency(b.unitValue)}</div>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}><ExpiryLabel days={daysToExpiry(b)} /></div>
            <div style={{ padding: '8px 12px', textAlign: 'right', fontFamily: P.fontMono, fontSize: 12, color: P.ink }}>{HD.formatCurrency(b.qty * b.unitValue, { showCents: false })}</div>
          </button>))}
        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end' }}>
          <PBtn size="sm" variant="secondary" onClick={() => window.hdToast?.({ title: 'Pulled to quarantine', description: `${batches.length} batch${batches.length === 1 ? '' : 'es'} moved to compliance holds.`, tone: 'blocked', action: { label: 'View holds', onClick: () => { location.hash = '#/compliance/holds'; } } })}>Pull to quarantine</PBtn>
        </div>
      </div>);
  }

  function ProductGroup({ group, navigate }) {
    const P = useP(), HD = window.HD;
    const [open, setOpen] = React.useState(false);
    return (
      <React.Fragment>
        <button onClick={() => setOpen((v) => !v)} style={{ display: 'grid', gridTemplateColumns: INV_GRID, width: '100%', textAlign: 'left', borderBottom: `1px solid ${P.hairline}`, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}
          onMouseEnter={(e) => (e.currentTarget.style.background = P.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-right" size={14} stroke={2} color={P.inkMute} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: 13, color: P.ink }}>{group.productName}</div>
            <div style={{ fontSize: 11, color: P.inkMute, marginTop: 2 }}>{group.vendorName}</div>
          </div>
          <div style={{ padding: '12px', fontSize: 13, color: P.ink2 }}>{group.batches.length}</div>
          <div style={{ padding: '12px', textAlign: 'right', fontFamily: P.fontMono, fontSize: 14, color: P.ink }}>{group.totalUnits.toLocaleString()}</div>
          <div style={{ padding: '12px' }}><ExpiryLabel days={group.soonestExpiryDays} /></div>
          <div style={{ padding: '12px', textAlign: 'right', fontFamily: P.fontMono, fontSize: 14, color: P.ink }}>{HD.formatCurrency(group.totalValue, { showCents: false })}</div>
        </button>
        {open && <BatchRows batches={group.batches} navigate={navigate} />}
      </React.Fragment>);
  }

  function groupByProduct(batches, sort) {
    const NOW = window.HD_DATA.NOW;
    const map = new Map();
    for (const b of batches) {
      const ageDays = (NOW - new Date(b.statusEnteredAt).getTime()) / 86400000;
      const exp = daysToExpiry(b);
      const existing = map.get(b.productName);
      if (!existing) {
        map.set(b.productName, { productName: b.productName, vendorName: b.vendorName, batches: [b], totalUnits: b.qty, totalValue: b.qty * b.unitValue, newestDays: ageDays, velocityScore: 1 / Math.max(0.5, ageDays), soonestExpiryDays: exp });
      } else {
        existing.batches.push(b);
        existing.totalUnits += b.qty;
        existing.totalValue += b.qty * b.unitValue;
        existing.newestDays = Math.min(existing.newestDays, ageDays);
        existing.velocityScore += 1 / Math.max(0.5, ageDays);
        if (exp !== null) existing.soonestExpiryDays = existing.soonestExpiryDays === null ? exp : Math.min(existing.soonestExpiryDays, exp);
      }
    }
    const arr = [...map.values()];
    arr.sort((a, b) => {
      switch (sort) {
        case 'velocity': return b.velocityScore - a.velocityScore;
        case 'age': return a.newestDays - b.newestDays;
        case 'value': return b.totalValue - a.totalValue;
        default: return a.productName.localeCompare(b.productName);
      }
    });
    return arr;
  }

  window.ScreenInventory = function ScreenInventory({ navigate }) {
    const P = useP(), HD = window.HD;
    const [query, setQuery] = React.useState('');
    const [sort, setSort] = React.useState('velocity');
    const [location, setLocation] = React.useState('all');
    const [brand, setBrand] = React.useState([]);
    const [category, setCategory] = React.useState([]);

    const approved = React.useMemo(() => window.HD_DATA.BATCHES.filter((b) => b.status === 'approved'), []);
    const brandOptions = React.useMemo(() => [...new Set(approved.map((b) => b.brand))].sort(), [approved]);
    const categoryOptions = React.useMemo(() => [...new Set(approved.map((b) => b.category))].sort(), [approved]);
    const hasActiveFilters = query.trim().length > 0 || location !== 'all' || brand.length > 0 || category.length > 0;

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return approved.filter((b) => {
        if (location !== 'all' && (b.location ?? 'foh') !== location) return false;
        if (brand.length > 0 && !brand.includes(b.brand)) return false;
        if (category.length > 0 && !category.includes(b.category)) return false;
        if (!q) return true;
        return b.productName.toLowerCase().includes(q) || b.vendorName.toLowerCase().includes(q) || b.sku.toLowerCase().includes(q) || b.metrcPackageId.toLowerCase().includes(q);
      });
    }, [approved, query, location, brand, category]);

    const grouped = React.useMemo(() => groupByProduct(filtered, sort), [filtered, sort]);
    const totalUnits = approved.reduce((s, b) => s + b.qty, 0);
    const totalValue = approved.reduce((s, b) => s + b.qty * b.unitValue, 0);
    const lowStockCount = approved.filter((b) => b.qty < 12).length;
    const expiringCount = approved.filter((b) => { const d = daysToExpiry(b); return d !== null && d <= 30; }).length;
    const clearAll = () => { setQuery(''); setLocation('all'); setBrand([]); setCategory([]); };
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const head = (label, align) => <div style={{ padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, textAlign: align }}>{label}</div>;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>Inventory</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkDim }}>Approved-for-sale batches. Group by product (default) or flip to a flat batch list.</p>
          </div>
          <PBtn size="sm" variant="secondary" icon="shield" onClick={() => navigate('#/compliance/holds')}>Compliance holds</PBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="package" label="Total units" value={totalUnits.toLocaleString()} hue="blue" />
          <StatTile icon="dollar" label="Total value at cost" value={HD.formatCurrency(totalValue, { showCents: false })} hue="green" />
          <StatTile icon="flag" label="Low stock (<12)" value={String(lowStockCount)} hue={lowStockCount > 0 ? 'warn' : 'teal'} />
          <StatTile icon="calendar" label="Expiring <30d" value={String(expiringCount)} hue={expiringCount > 0 ? 'warn' : 'teal'} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product, vendor, UID, SKU…" />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['velocity', 'Velocity'], ['age', 'Age'], ['value', '$ value'], ['name', 'Name']].map(([s, label]) => (
              <button key={s} onClick={() => setSort(s)} style={{ fontSize: 12, padding: '0 12px', height: 32, borderRadius: 8, cursor: 'pointer', fontFamily: P.fontSans,
                background: sort === s ? P.accentSoft : 'transparent', color: sort === s ? accentInk : P.inkDim, border: `1px solid ${sort === s ? P.accentBorder : P.hairline2}` }}>{label}</button>))}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div role="group" aria-label="Location filter" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, border: `1px solid ${P.hairline2}`, padding: 2, gap: 2 }}>
            {[['all', 'All locations'], ['foh', 'Front of house'], ['boh', 'Back of house']].map(([id, label]) => (
              <button key={id} aria-pressed={location === id} onClick={() => setLocation(id)}
                style={{ fontSize: 12, padding: '0 10px', height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: P.fontSans,
                  background: location === id ? P.accentSoft : 'transparent', color: location === id ? accentInk : P.inkDim }}>{label}</button>))}
          </div>
          <span style={{ height: 20, width: 1, background: P.hairline2, margin: '0 4px' }} />
          <MultiSelectFilter label="Brand" options={brandOptions.map((b) => ({ id: b, label: b }))} value={brand} onChange={setBrand} />
          <MultiSelectFilter label="Category" options={categoryOptions.map((c) => ({ id: c, label: c }))} value={category} onChange={setCategory} />
          {hasActiveFilters && <button onClick={clearAll} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, fontSize: 12, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button>}
        </div>

        <Card padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: INV_GRID, background: P.canvas, borderBottom: `1px solid ${P.hairline2}` }}>
            {head('')}{head('Product')}{head('Batches')}{head('Units', 'right')}{head('Soonest expiry')}{head('Value', 'right')}
          </div>
          {grouped.length === 0
            ? <HDEmpty title="No inventory matches." body={hasActiveFilters ? 'Nothing matches the current filters. Drop one, or clear them all.' : 'No approved-for-sale inventory yet.'}
              action={hasActiveFilters ? <PBtn size="sm" variant="secondary" onClick={clearAll}>Clear all</PBtn> : undefined} />
            : grouped.map((g) => <ProductGroup key={g.productName} group={g} navigate={navigate} />)}
        </Card>
      </div>);
  };

  // ── Products ────────────────────────────────────────────────────────────
  const TYPE_TONE = { sativa: 'brand', indica: 'info', hybrid: 'ok', cbd: 'neutral', na: 'neutral' };
  const TYPE_LABEL = { sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid', cbd: 'CBD', na: 'N/A' };
  window.HD_TYPE_LABEL = TYPE_LABEL;

  function FilterGroup({ label, options, value, onChange, renderLabel }) {
    const P = useP();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        style={{ height: 28, padding: '0 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontFamily: P.fontSans,
          background: value ? P.accentSoft : P.surface, color: value ? accentInk : P.inkDim, border: `1px solid ${value ? P.accentBorder : P.hairline2}` }}>
        <option value="">{label}: all</option>
        {options.map((o) => <option key={o} value={o}>{label}: {renderLabel ? renderLabel(o) : o}</option>)}
      </select>);
  }

  function ProductCard({ product, navigate }) {
    const P = useP(), HD = window.HD, PR = window.HD_PRODUCTS;
    const s = PR.summarize(product);
    const tpl = PR.getProductShell(product.productShellId);
    const weightLabel = `${product.weight.value}${product.weight.unit}`;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <Card padding={0} hover onClick={() => navigate(`#/products/${product.id}`)} style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', aspectRatio: '4 / 3', background: P.canvas2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Thumb item={{ hue: product.hue }} size={96} radius={16} />
          {s.hasNearExpiry && <div style={{ position: 'absolute', top: 8, right: 8 }}><HDPill tone="warn" size="sm" label="Near expiry" /></div>}
          <div style={{ position: 'absolute', top: 8, left: 8 }}><HDPill tone={TYPE_TONE[product.type]} icon={false} size="sm" label={TYPE_LABEL[product.type]} /></div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: P.inkMute }}>{product.brandName}</div>
              <div style={{ fontSize: 15, color: P.ink, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
            </div>
            <span style={{ flex: '0 0 auto', fontSize: 12, color: P.ink2, fontFamily: P.fontMono }}>{weightLabel}</span>
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{s.effectiveRetailCents != null ? HD.formatCurrency(s.effectiveRetailCents / 100) : '—'}</span>
            {s.retailFromShell && tpl
              ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px', borderRadius: 99, background: P.accentSoft, color: accentInk, border: `1px solid ${P.accentBorder}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>from shell</span>
              : product.customRetailCents != null
                ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px', borderRadius: 99, background: HD.tone(P, 'warn').bg, color: HD.tone(P, 'warn').fg, border: `1px solid ${HD.tone(P, 'warn').fg}4d`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>custom</span>
                : null}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: P.ink2 }}>
              <span style={{ color: P.ink, fontFamily: P.fontMono }}>{s.batchCount}</span> {s.batchCount === 1 ? 'batch' : 'batches'} · <span style={{ color: P.ink, fontFamily: P.fontMono }}>{HD.formatNumber(s.totalQtyOnHand)}</span> units
            </span>
            <span style={{ fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>{product.sku}</span>
          </div>
        </div>
      </Card>);
  }

  window.ScreenProducts = function ScreenProducts({ navigate }) {
    const P = useP(), PR = window.HD_PRODUCTS, HD = window.HD;
    // "New product" is the SAME flow the POS catalog uses — pos/product-shell.jsx.
    // Not a second implementation: the component is loaded, not copied.
    const [addOpen, setAddOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [brandFilter, setBrandFilter] = React.useState(null);
    const [categoryFilter, setCategoryFilter] = React.useState(null);
    const [typeFilter, setTypeFilter] = React.useState(null);
    const [nearExpiryOnly, setNearExpiryOnly] = React.useState(false);
    const brands = React.useMemo(() => [...new Set(PR.PRODUCTS.map((p) => p.brandName))].sort(), []);
    const categories = React.useMemo(() => [...new Set(PR.PRODUCTS.map((p) => p.category))].sort(), []);
    const types = ['sativa', 'indica', 'hybrid', 'cbd'];
    const visible = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return PR.PRODUCTS.filter((p) => {
        if (brandFilter && p.brandName !== brandFilter) return false;
        if (categoryFilter && p.category !== categoryFilter) return false;
        if (typeFilter && p.type !== typeFilter) return false;
        if (nearExpiryOnly && !PR.summarize(p).hasNearExpiry) return false;
        if (q && !`${p.name} ${p.brandName} ${p.sku}`.toLowerCase().includes(q)) return false;
        return true;
      });
    }, [query, brandFilter, categoryFilter, typeFilter, nearExpiryOnly]);
    const activeChips = [];
    if (brandFilter) activeChips.push({ label: `Brand: ${brandFilter}`, clear: () => setBrandFilter(null) });
    if (categoryFilter) activeChips.push({ label: `Category: ${categoryFilter}`, clear: () => setCategoryFilter(null) });
    if (typeFilter) activeChips.push({ label: `Type: ${TYPE_LABEL[typeFilter]}`, clear: () => setTypeFilter(null) });
    if (nearExpiryOnly) activeChips.push({ label: 'Near-expiry batch', clear: () => setNearExpiryOnly(false) });
    const warn = HD.tone(P, 'warn');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: 20, gap: 20 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Products</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: P.inkMute }}>Customer-facing SKU families. Each card wraps the batches sitting underneath it.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="sliders" onClick={() => navigate('#/products/shells')}>
              Product shells <span style={{ marginLeft: 4, color: P.inkMute, fontFamily: P.fontMono }}>{PR.PRODUCT_SHELLS.length}</span>
            </PBtn>
            <PBtn size="sm" variant="accent" icon="plus" onClick={() => setAddOpen(true)}>New product</PBtn>
          </div>
        </header>

        <Card padding={12} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product name, brand, or SKU…" />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <FilterGroup label="Brand" options={brands} value={brandFilter} onChange={setBrandFilter} />
            <FilterGroup label="Category" options={categories} value={categoryFilter} onChange={setCategoryFilter} />
            <FilterGroup label="Type" options={types} value={typeFilter} onChange={setTypeFilter} renderLabel={(t) => TYPE_LABEL[t]} />
            <button onClick={() => setNearExpiryOnly((v) => !v)} aria-pressed={nearExpiryOnly}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontFamily: P.fontSans,
                background: nearExpiryOnly ? warn.bg : P.surface, color: nearExpiryOnly ? warn.fg : P.inkDim, border: `1px solid ${nearExpiryOnly ? warn.fg + '66' : P.hairline2}` }}>
              <Icon name="flag" size={12} stroke={2} />Has near-expiry batch
            </button>
          </div>
          {activeChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Active</span>
              {activeChips.map((c) => (
                <button key={c.label} onClick={c.clear} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 99, background: P.accentSoft, color: accentInk, border: `1px solid ${P.accentBorder}`, fontSize: 12, cursor: 'pointer', fontFamily: P.fontSans }}>
                  {c.label}<Icon name="x" size={11} stroke={2.4} />
                </button>))}
            </div>)}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: P.inkMute }}>
            <span>{visible.length} {visible.length === 1 ? 'product' : 'products'}{visible.length !== PR.PRODUCTS.length && <span> · of {PR.PRODUCTS.length} total</span>}</span>
          </div>
          {visible.length === 0
            ? <Card padding={40} style={{ textAlign: 'center' }}>
              <Icon name="search" size={24} stroke={1.6} color={P.inkMute} />
              <div style={{ fontSize: 14, color: P.ink, marginTop: 8 }}>No products match.</div>
              <div style={{ fontSize: 12, color: P.inkMute, marginTop: 4 }}>Adjust your filters or clear the search box.</div>
            </Card>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {visible.map((p) => <ProductCard key={p.id} product={p} navigate={navigate} />)}
            </div>}
        </div>
        {addOpen && window.AddProductFlow && (
          <window.AddProductFlow entry="pipeline" onClose={() => setAddOpen(false)}
            onDone={() => { setAddOpen(false); window.hdToast?.({ title: 'Product created', description: 'Added to the shell as a new variation. It will appear on the next catalog sync.', tone: 'ok' }); }} />)}
      </div>);
  };
})();
