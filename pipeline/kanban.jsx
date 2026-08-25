// ── Batch Kanban — board · column · card · detail drawer ──────────────────
// Port of components/kanban/*. Drag a card across columns to progress it;
// invalid drops toast and bounce. Approved leaves the board for Inventory.
;(function () {
  const useP = window.useP;

  function BatchCard({ batch, boardEntity, onClick, dragging, draggable = true, onDragStart, onDragEnd }) {
    const P = useP(), HD = window.HD;
    const [h, setH] = React.useState(false);
    const sev = HD.stageSeverity(batch.status, batch.statusEnteredAt);
    const accent = HD.tone(P, HD.stageAccentTone(batch.status)).fg;
    const activeEntity = boardEntity ?? batch.entity;
    const tamperEvident = HD.isTamperEvident(batch.masterProductId);
    const packaging = HD.getPackaging(batch.masterProductId);
    const skipTargetKey = tamperEvident ? HD.nextStageAfterSkip(activeEntity, batch.masterProductId, batch.status) : null;
    const showSkipArrow = tamperEvident && skipTargetKey && batch.status === 'labeling';
    const seal = HD.tone(P, 'sealing');
    return (
      <div role="button" tabIndex={0} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); } }}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ position: 'relative', overflow: 'hidden', flex: '0 0 auto', background: h ? P.surface2 : P.surface, border: `1px solid ${h ? P.accentBorder : P.hairline2}`, borderRadius: P.r12, padding: 12, cursor: 'grab', boxShadow: P.shadowSm, opacity: dragging ? .4 : 1, transform: dragging ? 'scale(.98)' : 'none', transition: 'background .12s, border-color .12s' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: accent }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ height: 40, width: 40, borderRadius: 8, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', color: P.inkMute }}>
            <Icon name="package" size={16} stroke={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.25, color: P.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batch.productName}</div>
            <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batch.sku}</div>
          </div>
          {sev !== 'fresh' && <HDPill tone={sev === 'hot' ? 'blocked' : 'warn'} icon={false} size="sm" label={`${HD.ageInStatus(batch.statusEnteredAt)} here`} style={{ flex: '0 0 auto' }} />}
          {tamperEvident && (
            <span title={packaging?.packagingType ? `Auto-skips Sealing — ${HD.PACKAGING_TYPE_LABEL[packaging.packagingType]}` : 'Auto-skips Sealing — tamper-evident packaging'} aria-label="Auto-skips Sealing"
              style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 20, width: 20, borderRadius: 99, background: seal.bg, border: `1px solid ${seal.fg}66`, color: seal.fg }}>
              <Icon name="shield" size={11} stroke={2} />
            </span>)}
        </div>
        <div title={`${batch.qty} units at ${HD.formatCurrency(batch.unitValue)} wholesale cost each — ${HD.formatCurrency(batch.qty * batch.unitValue)} total batch value`} style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 12.5, fontFamily: P.fontMono, color: P.ink2 }}>
          <span>{batch.qty} <span style={{ color: P.inkMute }}>units</span></span>
          <span style={{ color: P.inkMute }}>×</span>
          <span>{HD.formatCurrency(batch.unitValue)} <span style={{ color: P.inkMute }}>ea</span></span>
          <span style={{ color: P.inkMute }}>=</span>
          <span>{HD.formatCurrency(batch.qty * batch.unitValue, { showCents: false })}</span>
        </div>
        {showSkipArrow && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: seal.fg }}>
            <Icon name="arrow-right" size={10} stroke={2} />
            <span>{HD.BATCH_STATUS_LABEL[skipTargetKey] ?? skipTargetKey}<span style={{ color: P.inkMute }}> · skip seal</span></span>
          </div>)}
        <div style={{ marginTop: 4, fontFamily: P.fontMono, fontSize: 10, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batch.metrcPackageId}</div>
      </div>);
  }

  function Column({ status, batches, onCardClick, boardEntity, dragId, setDragId, onDrop }) {
    const P = useP(), HD = window.HD;
    const [over, setOver] = React.useState(false);
    const totalValue = batches.reduce((s, b) => s + b.qty * b.unitValue, 0);
    const dot = HD.tone(P, HD.batchStatusTone(status)).fg;
    return (
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(status); }}
        style={{ display: 'flex', flexDirection: 'column', width: 280, flex: '0 0 280px', borderRadius: P.r14, overflow: 'hidden', background: over ? P.accentSoft : P.canvas, border: `1px solid ${over ? P.accentBorder : P.hairline2}`, height: '100%', transition: 'background .12s, border-color .12s' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${P.hairline2}`, borderTop: `3px solid ${dot}`, position: 'sticky', top: 0, background: over ? P.accentSoft : P.surface, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: dot, flex: '0 0 auto' }} />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{HD.BATCH_STATUS_LABEL[status]}</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: dot, background: HD.tone(P, HD.batchStatusTone(status)).bg, borderRadius: 99, padding: '1px 7px', fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{batches.length}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{HD.formatCurrency(totalValue, { showCents: false })}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {batches.length === 0
            ? <div style={{ textAlign: 'center', fontSize: 12.5, color: P.inkMute, padding: '24px 0', fontStyle: 'italic' }}>Empty</div>
            : batches.map((b) => (
              <BatchCard key={b.id} batch={b} boardEntity={boardEntity} dragging={dragId === b.id}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(b.id); }}
                onDragEnd={() => setDragId(null)} onClick={() => onCardClick(b.id)} />))}
        </div>
      </div>);
  }

  function DetailDrawer({ batch, open, onClose, onTransition }) {
    const P = useP(), HD = window.HD;
    if (!batch) return null;
    const validTargets = HD.BATCH_STATUS_ORDER.filter((s) => HD.canTransition(batch.status, s));
    return (
      <Sheet open={open} onClose={onClose} width={470}>
        <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>{batch.productName}</h2>
            <IconBtn icon="x" size={16} onClick={onClose} style={{ width: 30, height: 30, margin: -4 }} />
          </div>
          <div style={{ marginTop: 8 }}><UidChip value={batch.metrcPackageId} kind="metrc" /></div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <HDPill tone={HD.batchStatusTone(batch.status)} label={HD.BATCH_STATUS_LABEL[batch.status]} />
            <span style={{ fontSize: 12.5, color: P.inkMute }}>In status · {HD.ageInStatus(batch.statusEnteredAt)}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <MicroLabel style={{ marginBottom: 8 }}>Batch details</MicroLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MetaCell label="SKU" value={batch.sku} mono />
              <MetaCell label="Brand" value={batch.brand} />
              <MetaCell label="Category" value={batch.category} />
              <MetaCell label="Entity" value={batch.entity.toUpperCase()} />
              <MetaCell label="Qty on hand" value={String(batch.qty)} mono />
              <MetaCell label="Unit value" value={HD.formatCurrency(batch.unitValue)} mono />
              <MetaCell label="Batch value" value={HD.formatCurrency(batch.qty * batch.unitValue)} mono />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PBtn size="xs" variant="soft" icon="package" onClick={() => window.HW_NAV.go({ pos: 'catalog' })}>Open in POS catalog</PBtn>
            <PBtn size="xs" variant="soft" icon="swap" onClick={() => { onClose(); location.hash = `#/batches/merge?left=${batch.id}`; }}>Merge package</PBtn>
            <PBtn size="xs" variant="soft" icon="printer" onClick={() => { onClose(); location.hash = `#/batches/${batch.id}/labels`; }}>Print labels</PBtn>
          </div>
          <div>
            <MicroLabel style={{ marginBottom: 8 }}>Status timeline</MicroLabel>
            <ol style={{ listStyle: 'none', margin: 0, padding: '0 0 0 16px', borderLeft: `2px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {batch.timeline.map((t) => (
                <li key={t.id} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -22, top: 4, width: 12, height: 12, borderRadius: 99, background: P.accent, border: `2px solid ${P.surface}` }} />
                  <div style={{ fontSize: 12.5, color: P.ink }}>{t.event}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{HD.formatDateTime(t.at)} · {t.actor}</div>
                </li>))}
            </ol>
          </div>
          <div>
            <MicroLabel style={{ marginBottom: 8 }}>Evidence</MicroLabel>
            {batch.evidence.length === 0
              ? <div style={{ fontSize: 12.5, color: P.inkMute }}>No evidence captured.</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {batch.evidence.map((e) => (
                  <div key={e.id} title={`${e.label} · ${e.uploader}`} style={{ aspectRatio: '1 / 1', borderRadius: P.r10, background: P.surface3, border: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                    <Icon name={e.kind === 'photo' ? 'camera' : e.kind === 'manifest' ? 'receipt' : 'note'} size={18} stroke={1.7} color={P.inkMute} />
                    <div style={{ fontSize: 10, color: P.ink2, textAlign: 'center', padding: '0 4px' }}>{e.label}</div>
                  </div>))}
              </div>}
          </div>
          {batch.notes && (
            <div style={{ padding: 12, borderRadius: P.r10, border: `1px solid ${P.hairline2}`, background: P.surface3, fontSize: 13.5, color: P.ink2 }}>
              <MicroLabel style={{ marginBottom: 4 }}>Note</MicroLabel>
              {batch.notes}
            </div>)}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MicroLabel>Transition to</MicroLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {validTargets.length === 0
              ? <div style={{ fontSize: 12.5, color: P.inkMute }}>Terminal state — no further transitions.</div>
              : validTargets.map((t) => (
                <PBtn key={t} size="sm" variant={t === 'approved' ? 'accent' : 'secondary'} onClick={() => onTransition(batch.id, t)}>{HD.BATCH_STATUS_LABEL[t]}</PBtn>))}
          </div>
        </div>
      </Sheet>);
  }

  window.KanbanBoard = function KanbanBoard({ initial, entity }) {
    const HD = window.HD;
    const [batches, setBatches] = React.useState(initial);
    const [dragId, setDragId] = React.useState(null);
    const [selectedId, setSelectedId] = React.useState(null);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    React.useEffect(() => { setBatches(initial); }, [initial]);

    const workflowStages = React.useMemo(() => HD.getWorkflowStages(entity), [entity]);
    // "Approved" no longer lives on the board — a batch crossing shelf_ready →
    // approved animates off with a toast linking to Inventory. Hold states
    // stay as compact columns so floor users can still drag into them.
    const renderedStatuses = React.useMemo(() => [...workflowStages.map((s) => s.stageKey), 'quarantined', 'recalled', 'destroyed'], [workflowStages]);
    const byStatus = React.useMemo(() => {
      const m = {};
      for (const s of renderedStatuses) m[s] = [];
      batches.forEach((b) => { if (!m[b.status]) m[b.status] = []; m[b.status].push(b); });
      return m;
    }, [batches, renderedStatuses]);

    const selectedBatch = batches.find((b) => b.id === selectedId) || null;

    function applyTransition(id, to) {
      const batch = batches.find((b) => b.id === id);
      setBatches((prev) => prev.map((b) => (b.id === id ? {
        ...b, status: to, statusEnteredAt: new Date().toISOString(),
        timeline: [...b.timeline, { id: `t-${id}-${Date.now()}`, at: new Date().toISOString(), actor: 'Manisha Patel', event: `Moved to ${HD.BATCH_STATUS_LABEL[to]}`, status: to }],
      } : b)));
      if (to === 'approved') {
        window.hdToast?.({ title: 'Batch moved to inventory', description: batch?.productName ?? 'Batch', tone: 'ok', action: { label: 'View inventory', onClick: () => { location.hash = '#/inventory'; } } });
        return;
      }
      window.hdToast?.({ title: 'Batch moved', description: `${batch?.productName ?? 'Batch'} → ${HD.BATCH_STATUS_LABEL[to]}.`, tone: 'ok' });
    }

    function handleDrop(to) {
      const id = dragId;
      setDragId(null);
      if (!id || !to) return;
      const batch = batches.find((b) => b.id === id);
      if (!batch || batch.status === to) return;
      // Tamper-evident masters skip Sealing, so labeling → shelf_ready is a
      // legal bypass even though canTransition doesn't list it.
      const bypass = batch.status === 'labeling' && to === 'shelf_ready' && HD.isTamperEvident(batch.masterProductId);
      if (!bypass && !HD.canTransitionForEntity(batch.status, to, entity)) {
        window.hdToast?.({ title: `Can't move to ${HD.BATCH_STATUS_LABEL[to]}`, description: `${HD.BATCH_STATUS_LABEL[batch.status]} → ${HD.BATCH_STATUS_LABEL[to]} is not a valid transition for this entity.`, tone: 'blocked' });
        return;
      }
      if (to === 'sealing' && HD.isTamperEvident(batch.masterProductId)) {
        const packaging = HD.getPackaging(batch.masterProductId);
        const typeLabel = packaging?.packagingType ? HD.PACKAGING_TYPE_LABEL[packaging.packagingType] : 'tamper-evident packaging';
        if (!window.confirm(`${batch.productName} ships in ${typeLabel.toLowerCase()} — it normally skips the Sealing station. Seal anyway?`)) return;
      }
      applyTransition(id, to);
    }

    return (
      <React.Fragment>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 16px', height: '100%' }}>
          {renderedStatuses.map((s) => (
            <Column key={s} status={s} batches={byStatus[s] ?? []} boardEntity={entity} dragId={dragId} setDragId={setDragId}
              onDrop={handleDrop} onCardClick={(id) => { setSelectedId(id); setDrawerOpen(true); }} />))}
        </div>
        <DetailDrawer batch={selectedBatch} open={drawerOpen} onClose={() => setDrawerOpen(false)}
          onTransition={(id, to) => { applyTransition(id, to); setDrawerOpen(false); }} />
      </React.Fragment>);
  };

  Object.assign(window, { BatchCard, BatchDetailDrawer: DetailDrawer });
})();
