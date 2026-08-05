// ── /buyers — Buyer Analytics dashboard ───────────────────────────────────
// Port of app/(shell)/buyers/page.tsx + ui/sell-through-thermometer.tsx.
;(function () {
  const useP = window.useP;
  const HORIZONS = ['7d', '30d', '90d'];

  // Sell-through thermometer — days of supply against reorder cadence.
  function Thermometer({ daysOfSupply, reorderFrequencyDays, health, size = 'sm' }) {
    const P = useP(), HD = window.HD;
    const tone = health === 'stockout_imminent' ? 'blocked' : health === 'at_risk' ? 'warn' : 'ok';
    const c = HD.tone(P, tone);
    const finite = Number.isFinite(daysOfSupply);
    const pct = finite ? Math.max(0.04, Math.min(1, daysOfSupply / (reorderFrequencyDays * 2))) : 1;
    const label = health === 'stockout_imminent' ? 'Stockout imminent' : health === 'at_risk' ? 'At-risk' : 'Healthy';
    const w = size === 'md' ? 120 : 84;
    return (
      <span title={`${finite ? `${Math.round(daysOfSupply)}d of supply` : 'No movement'} · reorder every ${reorderFrequencyDays}d`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: w, height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden', display: 'inline-block', flex: '0 0 auto' }}>
          <span style={{ display: 'block', height: '100%', width: `${pct * 100}%`, background: c.fg, borderRadius: 99 }} />
        </span>
        <span style={{ fontSize: 11.5, color: c.fg, whiteSpace: 'nowrap' }}>{label}</span>
      </span>);
  }

  function HorizonToggle({ value, onChange }) {
    const P = useP();
    return (
      <div role="group" aria-label="Time horizon" style={{ display: 'inline-flex', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, padding: 2, alignSelf: 'flex-start' }}>
        {HORIZONS.map((h) => (
          <button key={h} onClick={() => onChange(h)}
            style={{ height: 28, padding: '0 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 500, fontFamily: P.fontMono, cursor: 'pointer', border: 'none',
              background: value === h ? P.ink : 'transparent', color: value === h ? P.surface : P.inkDim }}>{h}</button>))}
      </div>);
  }

  function FilterChipRow({ label, options, value, onChange, renderDot }) {
    const P = useP();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, width: 64, flex: '0 0 64px' }}>{label}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {options.map((o) => (
            <button key={o.id} onClick={() => onChange(o.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer', fontFamily: P.fontSans,
                background: value === o.id ? P.ink : P.surface, color: value === o.id ? P.surface : P.inkDim, border: `1px solid ${value === o.id ? P.ink : P.hairline2}` }}>
              {renderDot?.(o.id)}{o.label}
            </button>))}
        </div>
      </div>);
  }

  function KpiCell({ label, value, sub, delta, horizon, tone = 'neutral' }) {
    const P = useP(), HD = window.HD;
    const deltaColor = delta === undefined ? P.inkMute : delta > 0 ? HD.tone(P, 'ok').fg : delta < 0 ? HD.tone(P, 'blocked').fg : P.inkMute;
    const valueColor = tone === 'warn' ? HD.tone(P, 'warn').fg : P.ink;
    return (
      <div style={{ padding: 16 }}>
        <MicroLabel>{label}</MicroLabel>
        <div style={{ marginTop: 4, fontSize: 21, lineHeight: 1, fontWeight: 600, color: valueColor, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {delta !== undefined
          ? <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: deltaColor, fontFamily: P.fontMono }}>
            {delta !== 0 && <Icon name={delta > 0 ? 'trending-up' : 'arrow-down'} size={12} stroke={2} />}
            {HD.formatPercent(Math.abs(delta), 1)}
            {horizon && <span style={{ color: P.inkMute, marginLeft: 4 }}>vs prior {horizon}</span>}
          </div>
          : sub ? <div style={{ marginTop: 8, fontSize: 12.5, color: P.inkMute }}>{sub}</div> : null}
      </div>);
  }

  const labelForSortKey = (k) => ({ sku: 'SKU', brand: 'brand', category: 'category', store: 'store', sellThrough: 'sell-through', margin: 'margin', daysOfSupply: 'days of supply', lastSale: 'last sale' }[k]);

  function SortTH({ label, k, sort, onSort, align, hint }) {
    const P = useP();
    const active = sort.key === k;
    return (
      <TH align={align}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => onSort(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer' }}>
            <span>{label}</span>
            <Icon name={active ? (sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'} size={11} stroke={2} style={{ opacity: active ? 1 : .4 }} />
          </button>
          {hint && <span title={hint} aria-label={`${label} explanation`} style={{ color: P.inkMute, cursor: 'help', display: 'inline-flex' }}><Icon name="info" size={11} stroke={2} /></span>}
        </span>
      </TH>);
  }

  function StockoutWatchCard({ items, horizon }) {
    const P = useP(), HD = window.HD, B = window.HD_BUYER;
    return (
      <Card padding={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="flag" size={14} stroke={2} color={HD.tone(P, 'blocked').fg} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Stockout Watch</h2>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Top 5 worst · {horizon}</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: P.inkMute }}>SKUs selling faster than they can be replenished.</p>
        {items.length === 0
          ? <div style={{ marginTop: 16, fontSize: 13.5, color: P.inkMute }}>Nothing critical — every SKU has runway.</div>
          : <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(({ sku, dos }) => (
              <div key={sku.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sku.productName}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sku.brand} · {sku.qtyOnHand} on hand · reorder every {sku.reorderFrequencyDays}d</div>
                </div>
                <Thermometer daysOfSupply={dos} reorderFrequencyDays={sku.reorderFrequencyDays} health={B.stockHealth(sku, horizon)} />
              </div>))}
          </div>}
      </Card>);
  }

  function BrandMixCard({ rollup, total, activeBrand, onBrandClick }) {
    const P = useP(), HD = window.HD;
    const ring = [P.accent, HD.hueColor(P, 'blue'), HD.hueColor(P, 'violet'), HD.tone(P, 'warn').fg, HD.tone(P, 'info').fg, HD.hueColor(P, 'teal'), HD.hueColor(P, 'pink'), HD.hueColor(P, 'green')];
    return (
      <Card padding={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Brand mix</h2>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Revenue share · click to filter</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: P.inkMute }}>Each brand's contribution to total revenue.</p>
        <div style={{ marginTop: 16, height: 12, width: '100%', borderRadius: 99, overflow: 'hidden', display: 'flex', border: `1px solid ${P.hairline2}`, background: P.surface3 }}>
          {rollup.map((b, i) => {
            const pct = total === 0 ? 0 : (b.revenueCents / total) * 100;
            const isActive = activeBrand === b.brand;
            return (
              <button key={b.brand} onClick={() => onBrandClick(b.brand)} title={`${b.brand} · ${HD.formatPercent(total === 0 ? 0 : b.revenueCents / total, 0)}`}
                aria-label={`${b.brand}, ${pct.toFixed(0)}% of revenue`}
                style={{ height: '100%', width: `${pct}%`, background: ring[i % ring.length], border: 'none', cursor: 'pointer', opacity: activeBrand && !isActive ? .35 : 1, outline: isActive ? `1px solid ${P.ink}` : 'none' }} />);
          })}
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
          {rollup.map((b, i) => {
            const pct = total === 0 ? 0 : b.revenueCents / total;
            const isActive = activeBrand === b.brand;
            return (
              <button key={b.brand} onClick={() => onBrandClick(b.brand)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', fontSize: 12.5, padding: '4px 6px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: P.fontSans,
                  background: isActive ? P.accentSoft : 'transparent', color: isActive ? P.ink : P.ink2 }}>
                <span style={{ height: 8, width: 8, borderRadius: 99, background: ring[i % ring.length], flex: '0 0 auto' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brand}</span>
                <span style={{ fontFamily: P.fontMono, color: P.inkMute }}>{HD.formatPercent(pct, 0)}</span>
              </button>);
          })}
        </div>
      </Card>);
  }

  window.ScreenBuyers = function ScreenBuyers() {
    const P = useP(), HD = window.HD, B = window.HD_BUYER;
    const [horizon, setHorizon] = React.useState('30d');
    const [storeFilter, setStoreFilter] = React.useState('all');
    const [categoryFilter, setCategoryFilter] = React.useState('all');
    const [brandFilter, setBrandFilter] = React.useState(null);
    const [slowOnly, setSlowOnly] = React.useState(false);
    const [sort, setSort] = React.useState({ key: 'sellThrough', dir: 'desc' });
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const warn = HD.tone(P, 'warn');

    const baseSkus = React.useMemo(() => B.BUYER_SKUS.filter((s) => {
      if (storeFilter !== 'all' && s.entity !== storeFilter) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (brandFilter && s.brand !== brandFilter) return false;
      return true;
    }), [storeFilter, categoryFilter, brandFilter]);

    const slowMoverIds = React.useMemo(() => {
      const set = new Set();
      for (const s of baseSkus) if (B.isSlowMover(s, baseSkus, horizon)) set.add(s.id);
      return set;
    }, [baseSkus, horizon]);

    const visibleSkus = React.useMemo(() => (slowOnly ? baseSkus.filter((s) => slowMoverIds.has(s.id)) : baseSkus), [baseSkus, slowOnly, slowMoverIds]);

    const kpis = React.useMemo(() => {
      const revenueCents = baseSkus.reduce((a, s) => a + B.revenueCentsForWindow(s, horizon), 0);
      const profitCents = baseSkus.reduce((a, s) => a + B.profitCentsForWindow(s, horizon), 0);
      const avgSellThrough = baseSkus.length === 0 ? 0 : baseSkus.reduce((a, s) => a + B.sellThroughRate(s, horizon), 0) / baseSkus.length;
      const priorRevenueCents = baseSkus.reduce((a, s) => {
        if (horizon === '7d') return a + s.qtySold30d * s.sellCents * (1 / 4) * 0.92;
        if (horizon === '30d') return a + s.qtySold90d * s.sellCents * (1 / 3) * 0.95;
        return a + s.qtySold90d * s.sellCents * 0.97;
      }, 0);
      const priorProfitCents = baseSkus.reduce((a, s) => {
        const margin = s.sellCents - s.costCents;
        if (horizon === '7d') return a + s.qtySold30d * margin * (1 / 4) * 0.9;
        if (horizon === '30d') return a + s.qtySold90d * margin * (1 / 3) * 0.93;
        return a + s.qtySold90d * margin * 0.96;
      }, 0);
      return {
        revenueCents, profitCents, avgSellThrough, slowMoverCount: slowMoverIds.size,
        revenueDelta: priorRevenueCents === 0 ? 0 : (revenueCents - priorRevenueCents) / priorRevenueCents,
        profitDelta: priorProfitCents === 0 ? 0 : (profitCents - priorProfitCents) / priorProfitCents,
      };
    }, [baseSkus, horizon, slowMoverIds]);

    const brandRollup = React.useMemo(() => B.rollupByBrand(baseSkus, horizon), [baseSkus, horizon]);
    const totalBrandRevenue = brandRollup.reduce((a, b) => a + b.revenueCents, 0);
    const totalBrandProfit = brandRollup.reduce((a, b) => a + b.profitCents, 0);

    const stockoutWatch = React.useMemo(() => [...baseSkus]
      .map((s) => ({ sku: s, dos: B.daysOfSupply(s, horizon) }))
      .filter((x) => Number.isFinite(x.dos))
      .sort((a, b) => a.dos - b.dos).slice(0, 5), [baseSkus, horizon]);

    const sortedSkus = React.useMemo(() => {
      const copy = [...visibleSkus];
      const dir = sort.dir === 'asc' ? 1 : -1;
      copy.sort((a, b) => {
        switch (sort.key) {
          case 'sku': return a.sku.localeCompare(b.sku) * dir;
          case 'brand': return a.brand.localeCompare(b.brand) * dir;
          case 'category': return a.category.localeCompare(b.category) * dir;
          case 'store': return a.entity.localeCompare(b.entity) * dir;
          case 'sellThrough': return (B.sellThroughRate(a, horizon) - B.sellThroughRate(b, horizon)) * dir;
          case 'margin': return (B.marginPct(a) - B.marginPct(b)) * dir;
          case 'daysOfSupply': {
            const ad = B.daysOfSupply(a, horizon), bd = B.daysOfSupply(b, horizon);
            if (!Number.isFinite(ad) && !Number.isFinite(bd)) return 0;
            if (!Number.isFinite(ad)) return 1;
            if (!Number.isFinite(bd)) return -1;
            return (ad - bd) * dir;
          }
          default: return (new Date(a.lastSaleAt).getTime() - new Date(b.lastSaleAt).getTime()) * dir;
        }
      });
      return copy;
    }, [visibleSkus, sort, horizon]);

    const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

    const activeFilterChips = [];
    if (storeFilter !== 'all') {
      const e = HD.ENTITIES.find((x) => x.id === storeFilter);
      activeFilterChips.push({ label: `Store: ${e?.short ?? storeFilter}`, clear: () => setStoreFilter('all') });
    }
    if (categoryFilter !== 'all') activeFilterChips.push({ label: `Category: ${categoryFilter}`, clear: () => setCategoryFilter('all') });
    if (brandFilter) activeFilterChips.push({ label: `Brand: ${brandFilter}`, clear: () => setBrandFilter(null) });

    const STORE_OPTIONS = [{ id: 'all', label: 'All stores' }, ...HD.ENTITIES.map((e) => ({ id: e.id, label: e.short }))];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', padding: 20, gap: 20 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Buyer Analytics</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: P.inkMute, maxWidth: 620 }}>Sell-through, margin, and stockout signal across stores and brands. Click a brand bar to filter everything.</p>
          </div>
          <HorizonToggle value={horizon} onChange={setHorizon} />
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FilterChipRow label="Store" options={STORE_OPTIONS} value={storeFilter} onChange={setStoreFilter}
            renderDot={(id) => (id === 'all' ? null : <span style={{ height: 8, width: 8, borderRadius: 99, background: HD.hueColor(P, HD.ENTITIES.find((e) => e.id === id)?.hue) }} />)} />
          <FilterChipRow label="Category" options={[{ id: 'all', label: 'All categories' }, ...B.BUYER_CATEGORIES.map((c) => ({ id: c, label: c }))]} value={categoryFilter} onChange={setCategoryFilter} />
          {activeFilterChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Icon name="filter" size={13} stroke={2} color={P.inkMute} />
              <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Active</span>
              {activeFilterChips.map((c) => (
                <button key={c.label} onClick={c.clear} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 99, background: P.accentSoft, color: accentInk, border: `1px solid ${P.accentBorder}`, fontSize: 12.5, cursor: 'pointer', fontFamily: P.fontSans }}>
                  {c.label}<Icon name="x" size={11} stroke={2.4} />
                </button>))}
            </div>)}
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div style={{ borderRight: `1px solid ${P.hairline2}` }}><KpiCell label="Revenue" value={HD.formatCurrency(kpis.revenueCents / 100, { showCents: false })} delta={kpis.revenueDelta} horizon={horizon} /></div>
            <div style={{ borderRight: `1px solid ${P.hairline2}` }}><KpiCell label="Profit" value={HD.formatCurrency(kpis.profitCents / 100, { showCents: false })} delta={kpis.profitDelta} horizon={horizon} /></div>
            <div style={{ borderRight: `1px solid ${P.hairline2}` }}><KpiCell label="Avg sell-through" value={HD.formatPercent(kpis.avgSellThrough, 0)} sub={`across ${baseSkus.length} SKUs`} /></div>
            <KpiCell label="Slow-movers" value={String(kpis.slowMoverCount)} sub="< ½ category median" tone={kpis.slowMoverCount > 0 ? 'warn' : 'neutral'} />
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
          <StockoutWatchCard items={stockoutWatch} horizon={horizon} />
          <BrandMixCard rollup={brandRollup} total={totalBrandRevenue} activeBrand={brandFilter} onBrandClick={(b) => setBrandFilter((cur) => (cur === b ? null : b))} />
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}`, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Product performance</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: P.inkMute }}>Sorted by {labelForSortKey(sort.key)} · {sortedSkus.length} of {baseSkus.length} SKUs</p>
            </div>
            <button onClick={() => setSlowOnly((v) => !v)} aria-pressed={slowOnly}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: P.fontSans,
                background: slowOnly ? warn.bg : P.surface, color: slowOnly ? warn.fg : P.inkDim, border: `1px solid ${slowOnly ? warn.fg + '66' : P.hairline2}` }}>
              <span style={{ height: 6, width: 6, borderRadius: 99, background: slowOnly ? warn.fg : P.inkMute }} />Show slow-movers only
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr>
                <SortTH label="SKU" k="sku" sort={sort} onSort={onSort} />
                <SortTH label="Brand" k="brand" sort={sort} onSort={onSort} />
                <SortTH label="Category" k="category" sort={sort} onSort={onSort} />
                <SortTH label="Store" k="store" sort={sort} onSort={onSort} />
                <SortTH label="Sell-through" k="sellThrough" sort={sort} onSort={onSort} align="right" hint="Computed from 30d sales / current inventory. Higher means it's moving fast — reorder consideration." />
                <SortTH label="Margin" k="margin" sort={sort} onSort={onSort} align="right" />
                <SortTH label="Days supply" k="daysOfSupply" sort={sort} onSort={onSort} align="right" />
                <TH>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Stockout risk
                    <span title="AI flagged based on sell-through pace vs reorder lead time. Red = will be out before reorder arrives." style={{ color: P.inkMute, cursor: 'help', display: 'inline-flex' }}><Icon name="info" size={11} stroke={2} /></span>
                  </span>
                </TH>
                <SortTH label="Last sale" k="lastSale" sort={sort} onSort={onSort} />
              </tr></thead>
              <tbody>
                {sortedSkus.length === 0
                  ? <tr><TD colSpan={9}><div style={{ padding: '40px 0', textAlign: 'center', color: P.inkMute }}><Icon name="package" size={24} stroke={1.6} /><div style={{ marginTop: 8 }}>No SKUs match the current filters.</div></div></TD></tr>
                  : sortedSkus.map((s) => {
                    const ent = HD.ENTITIES.find((e) => e.id === s.entity);
                    const sellT = B.sellThroughRate(s, horizon);
                    const dos = B.daysOfSupply(s, horizon);
                    const slow = slowMoverIds.has(s.id);
                    const sellColor = sellT < 0.3 ? HD.tone(P, 'blocked').fg : sellT < 0.5 ? warn.fg : HD.tone(P, 'ok').fg;
                    return (
                      <TR key={s.id}>
                        <TD>
                          <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink }}>{s.sku}</div>
                          <div style={{ fontSize: 12.5, color: P.inkMute, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.productName}</div>
                        </TD>
                        <TD>
                          <button onClick={() => setBrandFilter((cur) => (cur === s.brand ? null : s.brand))} style={{ fontSize: 13.5, color: P.ink, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans }}>{s.brand}</button>
                        </TD>
                        <TD style={{ fontSize: 12.5, color: P.ink2 }}>{s.category}</TD>
                        <TD>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: P.ink2 }}>
                            <span style={{ height: 8, width: 8, borderRadius: 99, background: HD.hueColor(P, ent?.hue) }} />{ent?.short}
                          </span>
                        </TD>
                        <TD align="right">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            {slow && <HDPill tone="warn" icon={false} size="sm" label="SLOW" />}
                            <span style={{ color: sellColor, fontFamily: P.fontMono }}>{HD.formatPercent(sellT, 0)}</span>
                          </div>
                        </TD>
                        <TD align="right" mono>{HD.formatPercent(B.marginPct(s), 0)}</TD>
                        <TD align="right" mono>{Number.isFinite(dos) ? `${Math.round(dos)}d` : '—'}</TD>
                        <TD><Thermometer daysOfSupply={dos} reorderFrequencyDays={s.reorderFrequencyDays} health={B.stockHealth(s, horizon)} /></TD>
                        <TD style={{ fontSize: 12.5, color: P.inkMute, whiteSpace: 'nowrap' }}>{HD.relativeTime(s.lastSaleAt, B.BUYER_NOW)}</TD>
                      </TR>);
                  })}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>Brand profitability</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: P.inkMute }}>Cost vs sell vs contribution to total profit for the selected window.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr>
                <TH>Brand</TH><TH align="right">SKUs</TH><TH align="right">Cost</TH><TH align="right">Sell</TH>
                <TH align="right">Margin %</TH><TH align="right">Profit</TH><TH align="right">Contribution</TH><TH align="right">Flagged</TH>
              </tr></thead>
              <tbody>
                {brandRollup.map((b) => {
                  const margin = b.revenueCents === 0 ? 0 : (b.revenueCents - b.costCents) / b.revenueCents;
                  const contribution = totalBrandProfit === 0 ? 0 : b.profitCents / totalBrandProfit;
                  return (
                    <TR key={b.brand} onClick={() => setBrandFilter((cur) => (cur === b.brand ? null : b.brand))} style={{ background: brandFilter === b.brand ? P.accentSoft : 'transparent' }}>
                      <TD>{b.brand}</TD>
                      <TD align="right" mono style={{ color: P.ink2 }}>{b.skuCount}</TD>
                      <TD align="right" mono style={{ color: P.ink2 }}>{HD.formatCurrency(b.costCents / 100, { showCents: false })}</TD>
                      <TD align="right" mono>{HD.formatCurrency(b.revenueCents / 100, { showCents: false })}</TD>
                      <TD align="right" mono style={{ color: margin < 0.35 ? warn.fg : HD.tone(P, 'ok').fg }}>{HD.formatPercent(margin, 0)}</TD>
                      <TD align="right" mono>{HD.formatCurrency(b.profitCents / 100, { showCents: false })}</TD>
                      <TD align="right" mono>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ width: 64, height: 6, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: P.accent, width: `${Math.max(2, contribution * 100)}%` }} />
                          </div>
                          <span>{HD.formatPercent(contribution, 0)}</span>
                        </div>
                      </TD>
                      <TD align="right">{b.flaggedSkuCount > 0 ? <HDPill tone="warn" icon={false} size="sm" label={String(b.flaggedSkuCount)} /> : <span style={{ color: P.inkMute }}>—</span>}</TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };
})();
