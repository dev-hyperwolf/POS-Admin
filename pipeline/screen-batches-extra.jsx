// ── /batches/archive + /batches/merge ─────────────────────────────────────
// Ports app/(shell)/batches/{archive,merge}/page.tsx and the merge wizard.
;(function () {
  const useP = window.useP;

  window.ScreenBatchArchive = function ScreenBatchArchive({ entity, navigate }) {
    const P = useP(), HD = window.HD;
    const [query, setQuery] = React.useState('');
    const [sort, setSort] = React.useState({ key: 'archivedAt', dir: 'desc' });

    const archived = React.useMemo(() => window.HD_DATA.BATCHES.filter((b) => b.entity === entity && HD.isArchived(b)), [entity]);
    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return archived;
      return archived.filter((b) => b.productName.toLowerCase().includes(q) || b.sku.toLowerCase().includes(q) || b.brand.toLowerCase().includes(q) || b.metrcPackageId.toLowerCase().includes(q));
    }, [archived, query]);
    const sorted = React.useMemo(() => {
      const copy = [...filtered];
      const dir = sort.dir === 'asc' ? 1 : -1;
      copy.sort((a, b) => {
        switch (sort.key) {
          case 'productName': return a.productName.localeCompare(b.productName) * dir;
          case 'sku': return a.sku.localeCompare(b.sku) * dir;
          case 'status': return a.status.localeCompare(b.status) * dir;
          default: return (new Date(HD.archivedAt(a)).getTime() - new Date(HD.archivedAt(b)).getTime()) * dir;
        }
      });
      return copy;
    }, [filtered, sort]);
    const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

    const units = archived.reduce((s, b) => s + b.qty, 0);
    const value = archived.reduce((s, b) => s + b.qty * b.unitValue, 0);
    const entityMeta = HD.ENTITIES.find((e) => e.id === entity);

    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <button onClick={() => navigate('#/batches')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, marginBottom: 6, fontSize: 12.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Back to active pipeline
            </button>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Batch archive</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13.5, color: P.inkMute, maxWidth: 620 }}>Approved-for-sale, destroyed, resolved recalls, and shelf-ready batches that have aged out of the active board.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <MicroLabel align="right">Entity</MicroLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, justifyContent: 'flex-end' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: HD.hueColor(P, entityMeta?.hue) }} />
                <span style={{ fontSize: 13.5, color: P.ink }}>{entityMeta?.short ?? entity.toUpperCase()}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}><MicroLabel align="right">Archived</MicroLabel><DisplayNum style={{ textAlign: 'right' }}>{archived.length}</DisplayNum></div>
            <div style={{ textAlign: 'right' }}><MicroLabel align="right">Units</MicroLabel><DisplayNum style={{ textAlign: 'right' }}>{units.toLocaleString()}</DisplayNum></div>
            <div style={{ textAlign: 'right' }}><MicroLabel align="right">Value</MicroLabel><DisplayNum style={{ textAlign: 'right' }}>{HD.formatCurrency(value, { showCents: false })}</DisplayNum></div>
          </div>
        </header>

        <div style={{ maxWidth: 420 }}>
          <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, SKU, brand, or METRC package" aria-label="Search archived batches" />
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          {sorted.length === 0
            ? <HDEmpty icon="package" title={archived.length === 0 ? 'Nothing archived yet' : 'No matches'}
              body={archived.length === 0 ? 'Batches will appear here once they reach a terminal state or sit on shelf for more than 7 days.' : 'Try a different search term.'} />
            : <div style={{ overflowX: 'auto' }}>
              <HDTable>
                <thead>
                  <tr style={{ background: P.surface2 }}>
                    <SortableTH label="Product" k="productName" sort={sort} onSort={onSort} />
                    <SortableTH label="SKU" k="sku" sort={sort} onSort={onSort} />
                    <SortableTH label="Status" k="status" sort={sort} onSort={onSort} />
                    <SortableTH label="Archived" k="archivedAt" sort={sort} onSort={onSort} />
                    <TH align="right">Qty</TH><TH align="right">Value</TH><TH align="right">METRC</TH>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <div style={{ fontSize: 13.5, color: P.ink, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.productName}</div>
                        <div style={{ fontSize: 11.5, color: P.inkMute, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brand}</div>
                      </TD>
                      <TD mono style={{ fontSize: 12.5, color: P.ink2 }}>{b.sku}</TD>
                      <TD><HDPill tone={HD.batchStatusTone(b.status)} label={HD.BATCH_STATUS_LABEL[b.status]} icon={false} size="sm" /></TD>
                      <TD style={{ fontSize: 12.5, color: P.ink2, whiteSpace: 'nowrap' }}>{HD.formatDate(HD.archivedAt(b))}</TD>
                      <TD align="right" mono>{b.qty.toLocaleString()}</TD>
                      <TD align="right" mono>{HD.formatCurrency(b.qty * b.unitValue, { showCents: false })}</TD>
                      <TD align="right"><span title={b.metrcPackageId} style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{HD.uidShort(b.metrcPackageId, 'metrc')}</span></TD>
                    </TR>))}
                </tbody>
              </HDTable>
            </div>}
        </Card>
      </div>);
  };

  // ── Merge ───────────────────────────────────────────────────────────────
  const FIELD_LABELS = { sku: 'SKU', batchDate: 'Batch date', testLab: 'Test lab', coaId: 'COA ID', vendor: 'Vendor', entity: 'Entity', unitCost: 'Unit cost' };

  function buildEligibility(left, right) {
    return {
      sku: { left: left.sku, right: right.sku, match: left.sku === right.sku, critical: true },
      batchDate: { left: left.batchDate ?? '—', right: right.batchDate ?? '—', match: (left.batchDate ?? '') === (right.batchDate ?? ''), critical: false },
      testLab: { left: left.testLab ?? '—', right: right.testLab ?? '—', match: (left.testLab ?? '') === (right.testLab ?? ''), critical: true },
      coaId: { left: left.coaId ?? '—', right: right.coaId ?? '—', match: (left.coaId ?? '') === (right.coaId ?? ''), critical: true },
      vendor: { left: left.vendorName, right: right.vendorName, match: left.vendorName === right.vendorName, critical: false },
      entity: { left: left.entity, right: right.entity, match: left.entity === right.entity, critical: true },
      unitCost: { left: left.unitValue, right: right.unitValue, match: Math.abs(left.unitValue - right.unitValue) < 0.01, critical: false },
    };
  }

  function HeaderColumn({ batch, accent }) {
    const P = useP(), HD = window.HD;
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: accent === 'info' ? P.info : P.accent }} />
          <MicroLabel>Package</MicroLabel>
        </div>
        <div style={{ fontSize: 13.5, color: P.ink, lineHeight: 1.35 }}>{batch.productName}</div>
        <div style={{ marginTop: 8 }}><UidChip value={batch.metrcPackageId} kind="metrc" /></div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <HDPill tone="neutral" icon={false} size="sm" label={`${batch.qty} units`} />
          <HDPill tone="info" icon={false} size="sm" label={batch.entity.toUpperCase()} />
        </div>
      </div>);
  }

  function ComparisonRow({ field, left, right, match, critical }) {
    const P = useP(), HD = window.HD;
    const bad = HD.tone(P, critical ? 'blocked' : 'warn');
    const ok = HD.tone(P, 'ok');
    const displayLeft = field === 'Unit cost' ? HD.formatCurrency(Number(left)) : left;
    const displayRight = field === 'Unit cost' ? HD.formatCurrency(Number(right)) : right;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr', borderBottom: `1px solid ${P.hairline}`, background: match ? 'transparent' : bad.bg }}>
        <div style={{ padding: '10px 16px', fontFamily: P.fontMono, fontSize: 12.5, color: P.ink }}>{displayLeft}</div>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderLeft: `1px solid ${P.hairline2}`, borderRight: `1px solid ${P.hairline2}` }}>
          <Icon name={match ? 'check' : 'x'} size={12} stroke={2.4} color={match ? ok.fg : bad.fg} />
          <span style={{ fontSize: 11.5, color: match ? ok.fg : bad.fg }}>
            {field}{!match && critical && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>blocking</span>}
          </span>
        </div>
        <div style={{ padding: '10px 16px', fontFamily: P.fontMono, fontSize: 12.5, color: P.ink }}>{displayRight}</div>
      </div>);
  }

  function MergeWizard({ left, right, navigate }) {
    const P = useP(), HD = window.HD;
    const eligibility = React.useMemo(() => buildEligibility(left, right), [left, right]);
    const criticalMismatches = Object.entries(eligibility).filter(([, v]) => v.critical && !v.match);
    const nonCriticalMismatches = Object.entries(eligibility).filter(([, v]) => !v.critical && !v.match);
    const blocked = criticalMismatches.length > 0;
    const [ack, setAck] = React.useState(false);
    const blockedTone = HD.tone(P, 'blocked'), warnTone = HD.tone(P, 'warn'), okTone = HD.tone(P, 'ok');

    function submit() {
      window.hdToast?.({ title: 'Merge staged — not sent to METRC', description: `${left.qty + right.qty} units combined in this demo. Nothing was filed with the state.`, tone: 'ok' });
      navigate('#/batches');
    }

    return (
      <div style={{ padding: 20, maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => navigate('#/batches')} style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 13.5, color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="chevron-left" size={14} stroke={2} /> Back
        </button>
        <div>
          <MicroLabel>Merge packages</MicroLabel>
          <h1 style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>Combine into one package</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: P.inkDim, maxWidth: 640 }}>Merging two packages replaces them with one new METRC package. Every critical field must match or the operation blocks.</p>
        </div>

        {blocked ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: P.r12, border: `1px solid ${blockedTone.fg}80`, background: blockedTone.bg, padding: '12px 16px' }}>
            <Icon name="shield" size={20} stroke={2} color={blockedTone.fg} />
            <div>
              <div style={{ fontSize: 13.5, color: blockedTone.fg, fontWeight: 500 }}>Merge blocked — {criticalMismatches.length} critical mismatch{criticalMismatches.length === 1 ? '' : 'es'}</div>
              <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 2 }}>{criticalMismatches.map(([k]) => FIELD_LABELS[k]).join(', ')} differ. These fields cannot be overridden.</div>
            </div>
          </div>
        ) : nonCriticalMismatches.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: P.r12, border: `1px solid ${warnTone.fg}66`, background: warnTone.bg, padding: '12px 16px' }}>
            <Icon name="flag" size={18} stroke={2} color={warnTone.fg} />
            <div>
              <div style={{ fontSize: 13.5, color: warnTone.fg, fontWeight: 500 }}>{nonCriticalMismatches.length} non-critical mismatch{nonCriticalMismatches.length === 1 ? '' : 'es'} — you can override, but document why.</div>
              <div style={{ fontSize: 12.5, color: P.inkMute, marginTop: 2 }}>{nonCriticalMismatches.map(([k]) => FIELD_LABELS[k]).join(', ')} differ.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: P.r12, border: `1px solid ${okTone.fg}4d`, background: okTone.bg, padding: '12px 16px' }}>
            <Icon name="check" size={18} stroke={2.4} color={okTone.fg} />
            <div style={{ fontSize: 13.5, color: okTone.fg }}>All 7 fields match. This merge is eligible.</div>
          </div>
        )}

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 0' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Side-by-side comparison</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr', marginTop: 8 }}>
            <HeaderColumn batch={left} accent="info" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0', background: P.surface2, borderLeft: `1px solid ${P.hairline2}`, borderRight: `1px solid ${P.hairline2}` }}>
              <MicroLabel>→</MicroLabel>
              <DisplayNum size={24} style={{ marginTop: 4 }}>{left.qty + right.qty}</DisplayNum>
              <div style={{ fontSize: 11.5, color: P.inkMute }}>merged units</div>
            </div>
            <HeaderColumn batch={right} accent="brand" />
          </div>
          <div style={{ borderTop: `1px solid ${P.hairline2}` }}>
            {Object.entries(eligibility).map(([key, val]) => (
              <ComparisonRow key={key} field={FIELD_LABELS[key]} left={String(val.left)} right={String(val.right)} match={val.match} critical={val.critical} />))}
          </div>
        </Card>

        {!blocked && nonCriticalMismatches.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: P.r10, border: `1px solid ${warnTone.fg}4d`, background: warnTone.bg, cursor: 'pointer' }}>
            <Check on={ack} onChange={setAck} size={18} />
            <span style={{ fontSize: 12.5, color: warnTone.fg }}>I acknowledge the non-critical mismatches above and confirm the merge is still appropriate.</span>
          </label>)}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <PBtn variant="secondary" onClick={() => navigate('#/batches')}>Cancel</PBtn>
          <PBtn variant="accent" icon="arrow-right" disabled={blocked || (nonCriticalMismatches.length > 0 && !ack)} onClick={submit}>Submit merge to METRC</PBtn>
        </div>
      </div>);
  }

  function MergePicker({ label, selected, onPick, disallow }) {
    const P = useP();
    const [query, setQuery] = React.useState('');
    const candidates = window.HD_DATA.BATCHES.filter((b) =>
      b.id !== disallow && (b.status === 'approved' || b.status === 'shelf_ready' || b.status === 'staging') &&
      (query === '' || b.productName.toLowerCase().includes(query.toLowerCase()) || b.sku.toLowerCase().includes(query.toLowerCase()))).slice(0, 6);
    return (
      <Card padding={0}>
        <div style={{ padding: '14px 16px 8px' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>{label}</h3></div>
        <div style={{ padding: '0 16px 16px' }}>
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: P.r10, background: P.surface2, border: `1px solid ${P.accentBorder}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, color: P.ink }}>{selected.productName}</div>
                <div style={{ marginTop: 4 }}><UidChip value={selected.metrcPackageId} kind="metrc" /></div>
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 4, fontFamily: P.fontMono }}>{selected.sku} · {selected.qty} units</div>
              </div>
              <PBtn size="sm" variant="secondary" onClick={() => onPick('')}>Change</PBtn>
            </div>
          ) : (
            <React.Fragment>
              <Field size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product or SKU…" style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {candidates.map((b) => (
                  <button key={b.id} onClick={() => onPick(b.id)}
                    style={{ display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: 'transparent', cursor: 'pointer', fontFamily: P.fontSans }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.surface2)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.productName}</div>
                      <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{b.sku} · {b.qty} units · {b.entity.toUpperCase()}</div>
                    </div>
                    <UidChip value={b.metrcPackageId} kind="metrc" size="sm" />
                  </button>))}
                {candidates.length === 0 && <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No matching packages.</div>}
              </div>
            </React.Fragment>)}
        </div>
      </Card>);
  }

  window.ScreenBatchMerge = function ScreenBatchMerge({ query, navigate }) {
    const P = useP();
    const leftId = query.get('left'), rightId = query.get('right');
    const left = leftId ? window.HD_DATA.BATCHES.find((b) => b.id === leftId) : undefined;
    const right = rightId ? window.HD_DATA.BATCHES.find((b) => b.id === rightId) : undefined;
    if (left && right) return <MergeWizard left={left} right={right} navigate={navigate} />;
    const setParam = (k, v) => {
      const q = new URLSearchParams(query.toString());
      if (v) q.set(k, v); else q.delete(k);
      navigate(`#/batches/merge${q.toString() ? `?${q}` : ''}`);
    };
    return (
      <div style={{ padding: 20, maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <MicroLabel>Merge packages</MicroLabel>
          <h1 style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>Select two packages to merge</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: P.inkDim }}>Same-SKU batches on the floor are eligible. Eligibility is validated in the next step.</p>
        </div>
        <MergePicker label="Package A" selected={left} onPick={(id) => setParam('left', id)} />
        <MergePicker label="Package B" selected={right} onPick={(id) => setParam('right', id)} disallow={left?.id} />
      </div>);
  };
})();
