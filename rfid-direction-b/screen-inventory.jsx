// ── #/inventory — Operations › Inventory (METRC Batch Pipeline) ────────────
// A faithful recreation of the pipeline's inventory screen: the same stat
// tiles, the same search + ink-selected sort chips, the same location segment,
// the same expandable product→batch grid.
// WITH RFID: one band above the table (the cycle-count result), one extra
// column in the grid (Counted), and a stragglers sheet. Nothing moves.
;(function () {
  const useP = window.useP;
  const D = () => window.RFID_DATA;

  function ExpiryLabel({ days }) {
    const P = useP(), HD = window.HD;
    const color = days <= 14 ? HD.tone(P, 'blocked').fg : days <= 30 ? HD.tone(P, 'warn').fg : P.ink2;
    return <span style={{ fontSize: 12.5, color, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{days}d left</span>;
  }

  // ── The cycle-count band ────────────────────────────────────────────────
  function CycleBand({ onStragglers }) {
    const P = useP();
    const C = D().CYCLE;
    const pass = C.verdict === 'PASS';
    const fig = (label, value, color, title) => (
      <div title={title} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 84 }}>
        <MicroLabel>{label}</MicroLabel>
        <window.Num size={15} weight={600} color={color}>{value}</window.Num>
      </div>);
    return (
      <window.RfidPanel isNew title={'Cycle count · ' + C.room} sub={'Walk-scan ran ' + C.ranAt + ' · ' + C.duration + ' · ' + C.operators + ' operators'}
        right={<HDPill tone={pass ? 'ok' : 'warn'} label={C.verdict} />}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <window.Num size={30} weight={600} color={pass ? P.good : P.warn}>{C.coveragePct}%</window.Num>
              <span style={{ fontSize: 12.5, color: P.inkDim }}>coverage</span>
            </div>
            <div style={{ position: 'relative', marginTop: 10, height: 10, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: C.coveragePct + '%', background: pass ? P.good : P.warn, borderRadius: 99 }} />
              <div style={{ position: 'absolute', top: -2, bottom: -2, left: C.passBar + '%', width: 2, background: P.ink }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11.5, color: P.inkMute }}>Pass bar <window.Num size={11.5} color={P.inkDim}>{C.passBar}%</window.Num></span>
              <span style={{ fontSize: 11.5, color: P.inkMute }}><window.Num size={11.5} color={P.inkDim}>{C.reads.toLocaleString()}</window.Num> reads deduped to <window.Num size={11.5} color={P.inkDim}>{C.uniqueFound}</window.Num> EPCs</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: '1 1 320px' }}>
            {fig('Expected', C.expected)}
            {fig('Found', C.uniqueFound, P.good)}
            {fig('Not located', C.notLocated, P.bad)}
            {fig('Operators', C.operators, undefined, 'Passes dedupe by EPC — overlap costs time, never accuracy')}
            {fig('Duration', C.duration)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
            Three operators walked overlapping passes; reads dedupe by EPC, so the overlap cost eleven minutes and
            nothing else. The eight units nobody saw are listed, not estimated.
          </div>
          <PBtn size="sm" variant="secondary" icon="list" onClick={onStragglers}>View {C.notLocated} stragglers</PBtn>
        </div>
      </window.RfidPanel>);
  }

  function StragglerSheet({ open, onClose }) {
    const P = useP();
    const rows = D().STRAGGLERS;
    return (
      <window.Sheet open={open} onClose={onClose} width={520}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Stragglers</h2>
              <window.RfidTag />
            </div>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 3 }}>Never seen by any of the {D().CYCLE.operators} passes. Send a second walk.</div>
          </div>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" size={16} onClick={onClose} label="Close" style={{ width: 34, height: 34 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {rows.map((s, i) => (
            <div key={s.epc} style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <window.Num size={11.5} color={P.inkDim}>{s.epc}</window.Num>
                <div style={{ flex: 1 }} />
                <HDPill tone="warn" size="sm" icon={false} label={s.cause} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 13.5, color: P.ink }}>{s.product}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute }}>{s.brand}</span>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono }}>{s.shelf}</div>
            </div>))}
          <div style={{ padding: '14px 20px', fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
            Foil pouches and dense stacks are the usual cause. On-metal label stock would help — none was purchased,
            so a second pass is the only remedy today.
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <PBtn variant="ghost" onClick={onClose}>Close</PBtn>
          <PBtn variant="secondary" icon="send" onClick={() => { onClose(); window.hdToast?.({ title: 'Second pass queued', description: '8 units pushed to TC22R-01.', tone: 'info' }); }}>Send to TC22R-01</PBtn>
        </div>
      </window.Sheet>);
  }

  // ── Product → batch grid ────────────────────────────────────────────────
  function ProductGroup({ row, rfid, grid }) {
    const P = useP(), HD = window.HD;
    const [open, setOpen] = React.useState(false);
    const missing = row.units - row.found;
    const value = row.units * row.unitCost;
    return (
      <React.Fragment>
        <button onClick={() => setOpen((v) => !v)}
          style={{ display: 'grid', gridTemplateColumns: grid, width: '100%', textAlign: 'left', borderBottom: `1px solid ${P.hairline}`, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans, alignItems: 'center' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = P.surface2)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-right" size={14} stroke={2} color={P.inkMute} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </div>
          <div style={{ padding: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 99, background: P.cat[row.cat], flex: '0 0 auto' }} />
              <span style={{ fontSize: 13.5, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product}</span>
            </div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{row.brand}</div>
          </div>
          <div style={{ padding: 12 }}><window.Num color={P.ink2}>{row.batches}</window.Num></div>
          <div style={{ padding: 12, textAlign: 'right' }}><window.Num>{row.units}</window.Num></div>
          {rfid && (
            <div style={{ padding: 12, textAlign: 'right' }}>
              {missing === 0
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="check" size={12} stroke={2.6} color={P.good} /><window.Num color={P.good}>{row.found}</window.Num>
                  </span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <window.Num>{row.found}</window.Num>
                    <HDPill tone="warn" size="sm" icon={false} label={'−' + missing} />
                  </span>}
            </div>)}
          <div style={{ padding: 12 }}><ExpiryLabel days={row.expiryDays} /></div>
          <div style={{ padding: 12, textAlign: 'right' }}><window.Num>{HD.formatCurrency(value, { showCents: false })}</window.Num></div>
        </button>
        {open && (
          <div style={{ background: P.surface2, borderBottom: `1px solid ${P.hairline2}`, padding: '10px 12px 12px 40px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
              <window.MetaCell label="SKU" value={row.sku} mono />
              <window.MetaCell label="Location" value={row.loc === 'foh' ? 'Front of house' : 'Back of house'} />
              <window.MetaCell label="Unit cost" value={HD.formatCurrency(row.unitCost)} mono />
              {rfid && <window.MetaCell label="Last verified" value={D().CYCLE.ranAt} />}
              {rfid && missing > 0 && <window.MetaCell label="Not located" value={missing + ' units'} mono />}
              {!rfid && <window.MetaCell label="Last verified" value={D().CYCLE.lastManualCount + ' days ago'} />}
            </div>
          </div>)}
      </React.Fragment>);
  }

  // ── Screen ──────────────────────────────────────────────────────────────
  window.RfidScreenInventory = function RfidScreenInventory({ rfid, app }) {
    const P = useP(), HD = window.HD;
    const C = D().CYCLE;
    const [query, setQuery] = React.useState('');
    const [sort, setSort] = React.useState('velocity');
    const [loc, setLoc] = React.useState('all');
    const [brand, setBrand] = React.useState([]);
    const [category, setCategory] = React.useState([]);
    const [sheet, setSheet] = React.useState(false);

    const all = D().INVENTORY;
    const brandOptions = [...new Set(all.map((r) => r.brand))].sort();
    const categoryOptions = [...new Set(all.map((r) => r.cat))].sort();
    const hasFilters = query.trim().length > 0 || loc !== 'all' || brand.length > 0 || category.length > 0;
    const clearAll = () => { setQuery(''); setLoc('all'); setBrand([]); setCategory([]); };

    const rows = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      const out = all.filter((r) => {
        if (loc !== 'all' && r.loc !== loc) return false;
        if (brand.length && !brand.includes(r.brand)) return false;
        if (category.length && !category.includes(r.cat)) return false;
        if (!q) return true;
        return r.product.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
      });
      const by = {
        velocity: (a, b) => b.units - a.units,
        age: (a, b) => a.expiryDays - b.expiryDays,
        value: (a, b) => b.units * b.unitCost - a.units * a.unitCost,
        name: (a, b) => a.product.localeCompare(b.product),
      }[sort];
      return [...out].sort(by);
    }, [all, query, loc, brand, category, sort]);

    const totalUnits = all.reduce((n, r) => n + r.units, 0);
    const totalValue = all.reduce((n, r) => n + r.units * r.unitCost, 0);
    const expiring = all.filter((r) => r.expiryDays <= 30).length;
    const lowStock = all.filter((r) => r.units < 45).length;

    const GRID = rfid
      ? '28px minmax(200px,2fr) 88px 104px 140px 132px 122px'
      : '28px minmax(200px,2fr) 88px 104px 132px 122px';
    const head = (label, align) => <div key={label + align} style={{ padding: '8px 12px', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, textAlign: align }}>{label}</div>;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <window.RfidPageHead app={app} rfid={rfid} title="Inventory"
          sub={rfid
            ? 'Approved-for-sale stock. The on-hand column is unchanged; what changed is that a walk-scan now says which of those units it actually saw.'
            : 'Approved-for-sale stock. On-hand is whatever the last manual count and every sale since then say it is.'}
          action={
            <React.Fragment>
              <PBtn size="sm" variant="secondary" icon="shield">Compliance holds</PBtn>
              {rfid
                ? <PBtn size="sm" variant="accent" icon="scan" onClick={() => window.hdToast?.({ title: 'Cycle count started', description: 'TC22R-01 · Back of house, Long Beach.', tone: 'info' })}>Start cycle count</PBtn>
                : <PBtn size="sm" variant="accent" icon="list" onClick={() => window.hdToast?.({ title: 'Count sheet generated', description: '612 lines · print and walk the room.', tone: 'info' })}>Start manual count</PBtn>}
            </React.Fragment>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
          <StatTile icon="package" label="Total units" value={totalUnits.toLocaleString()} hue="blue" />
          <StatTile icon="dollar" label="Total value at cost" value={HD.formatCurrency(totalValue, { showCents: false })} hue="green" />
          <StatTile icon="flag" label="Low stock (<45)" value={String(lowStock)} hue={lowStock > 0 ? 'warn' : 'teal'} />
          <StatTile icon="calendar" label="Expiring <30d" value={String(expiring)} hue={expiring > 0 ? 'warn' : 'teal'} />
          {rfid
            ? <React.Fragment>
                <StatTile icon="check-circle" label="Coverage" value={C.coveragePct + '%'} hue="ok" progress={C.coveragePct / 100} sub={'pass bar ' + C.passBar + '%'} />
                <StatTile icon="eye-off" label="Not located" value={String(C.notLocated)} hue="warn" sub="listed, not estimated" />
              </React.Fragment>
            : <StatTile icon="clock" label="Last full count" value={C.lastManualCount + 'd ago'} hue="warn" sub={'~' + C.manualHours + ' hours of floor time'} />}
        </div>

        {rfid && <CycleBand onStragglers={() => setSheet(true)} />}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product, brand, SKU…" />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['velocity', 'Velocity'], ['age', 'Expiry'], ['value', '$ value'], ['name', 'Name']].map(([s, label]) => (
              <button key={s} onClick={() => setSort(s)} aria-pressed={sort === s}
                style={{ fontSize: 12.5, padding: '0 12px', height: 32, borderRadius: 8, cursor: 'pointer', fontFamily: P.fontSans,
                  background: sort === s ? P.ink : 'transparent', color: sort === s ? P.surface : P.inkDim, border: `1px solid ${sort === s ? P.ink : P.hairline2}` }}>{label}</button>))}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div role="group" aria-label="Location filter" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, border: `1px solid ${P.hairline2}`, padding: 2, gap: 2 }}>
            {[['all', 'All locations'], ['foh', 'Front of house'], ['boh', 'Back of house']].map(([id, label]) => (
              <button key={id} aria-pressed={loc === id} onClick={() => setLoc(id)}
                style={{ fontSize: 12.5, padding: '0 10px', height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: P.fontSans,
                  background: loc === id ? P.ink : 'transparent', color: loc === id ? P.surface : P.inkDim }}>{label}</button>))}
          </div>
          <span style={{ height: 20, width: 1, background: P.hairline2, margin: '0 4px' }} />
          <MultiSelectFilter label="Brand" options={brandOptions.map((b) => ({ id: b, label: b }))} value={brand} onChange={setBrand} />
          <MultiSelectFilter label="Category" options={categoryOptions.map((c) => ({ id: c, label: c }))} value={category} onChange={setCategory} />
          {hasFilters && <button onClick={clearAll} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button>}
        </div>

        <Card padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, background: P.surface2, borderBottom: `1px solid ${P.hairline2}`, alignItems: 'center' }}>
            {head('', 'left')}
            {head('Product', 'left')}
            {head('Batches', 'left')}
            {head('On hand', 'right')}
            {rfid && (
              <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Counted</span>
                <window.RfidTag label="NEW" />
              </div>)}
            {head('Soonest expiry', 'left')}
            {head('Value', 'right')}
          </div>
          {rows.length === 0
            ? <window.EmptyState title="No inventory matches." body="Nothing matches the current filters. Drop one, or clear them all."
                action={<PBtn size="sm" variant="secondary" onClick={clearAll}>Clear all</PBtn>} />
            : rows.map((r) => <ProductGroup key={r.sku} row={r} rfid={rfid} grid={GRID} />)}
        </Card>

        {!rfid && (
          <window.RfidPanel title="Why this screen is stale">
            <div style={{ fontSize: 13.5, color: P.inkDim, lineHeight: 1.6 }}>
              On-hand here is derived, not observed: the last full count was {C.lastManualCount} days ago and took about{' '}
              {C.manualHours} hours of floor time, so it does not get repeated often. Everything since is inferred from
              sales and transfers. Shrink shows up as a number nobody can locate.
            </div>
          </window.RfidPanel>)}

        <StragglerSheet open={sheet} onClose={() => setSheet(false)} />
      </div>);
  };
})();
