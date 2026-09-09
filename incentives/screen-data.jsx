// ── incentives/screen-data.jsx ── #/data — connections · upload · runs · identities · roster ─
// Design: explorations/Incentives - Concept D - Two Seats.html tab "7 · Data" (layout, the
// seat's one-line treatment) + Incentives - Concept B - Ledger.html tab "3 · Data" (the run
// report read as a bank statement, the reject/conflict detail shape). Contract:
// docs/BOUNTY-API-CONTRACT.md §Data, §Identities, §Settings. Plan: §5.3 (honesty labelling).
//
// MANAGER ONLY, AND THE SEAT SAYS SO. `props.isManager`/`props.session` come straight from
// incentives/app.jsx. A real budtender session never reaches ConsoleFrame, so the only place
// this branch matters is a manager previewing the seat — in that case the shell's own
// pointer-events lock, not this file, disables interaction; the copy below is what a
// non-manager session (the production case once auth exists) will actually see.
//
// NOTHING HERE IS FABRICATED. Every table, every card, every counter reads straight off the
// GET it is next to. The one derived thing is the connection "state" pill (Healthy / Stale /
// Failing / Not configured) — computed from configured/last_ok_at/last_error/stale, never a
// fifth field invented on top of the four the contract actually sends.
;(function () {
  const useP = window.useP;
  const HWInc = window.HWInc;

  // ── data hooks — GET-on-mount/refresh, the same shape as pos/screen-aov.jsx's useAovStats ──
  function useGet(path, enabled) {
    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    const load = React.useCallback(() => {
      if (!enabled && enabled !== undefined) { setState({ loading: false, error: null, data: null }); return; }
      setState((s) => ({ ...s, loading: true }));
      HWInc.get(path).then((r) => {
        if (r.ok && r.body) setState({ loading: false, error: null, data: r.body });
        else setState({ loading: false, error: r.error || 'unreachable', data: null });
      });
    }, [path, enabled]);
    React.useEffect(() => { load(); }, [load]);
    return { ...state, refresh: load };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(binary);
  }

  // ── small local composites (built from atoms only — inc-shared.jsx is a shared file; these
  // are specific enough to this screen's tables that they stay local, per the shared brief) ──
  function SubHead({ icon, title, right, count, tone }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 28, height: 28, borderRadius: P.r8, background: tone ? (tone === 'bad' ? P.badSoft : tone === 'warn' ? P.warnSoft : P.infoSoft) : P.surface3,
          color: tone ? (tone === 'bad' ? P.bad : tone === 'warn' ? P.warnText : P.info) : P.ink2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name={icon} size={15} stroke={1.9} />
        </span>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
        {count != null && <Pill kind={tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'neutral'} size="sm">{count}</Pill>}
        {right}
      </div>);
  }
  function KV({ k, v, mono }) {
    const P = useP();
    return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '6px 0', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
      <span style={{ color: P.inkDim }}>{k}</span><span style={{ fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : undefined }}>{v}</span>
    </div>;
  }
  function CounterTile({ label, value, tone }) {
    const P = useP();
    const border = tone === 'bad' ? P.bad : tone === 'warn' ? P.warnText : tone === 'good' ? P.good : tone === 'info' ? P.info : P.hairline2;
    return (
      <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderLeft: `3px solid ${border}`, borderRadius: P.r10, padding: '10px 12px' }}>
        <div style={{ fontSize: 9.5, color: P.inkMute, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, marginTop: 3 }}>{value}</div>
      </div>);
  }
  // A button that arms a confirm row instead of firing on first click — the estate's
  // never-use-confirm() rule (CLAUDE.md via the shared brief) for a per-row destructive-ish
  // write (binding attaches real sales to a real person; it should not be one click).
  // `extra` renders BETWEEN the prompt and the buttons — the only slot where a
  // choice that changes what "Confirm" does can sit and still be read before
  // the click. Create-a-person uses it for the new person's classification.
  function InlineConfirm({ label, confirmLabel, prompt, busy, variant = 'accent', size = 'xs', onConfirm, extra }) {
    const P = useP();
    const [armed, setArmed] = React.useState(false);
    if (!armed) return <PBtn size={size} variant={variant} onClick={() => setArmed(true)}>{label}</PBtn>;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: P.inkDim }}>{prompt}</span>
        {extra}
        <PBtn size="xs" variant="ghost" onClick={() => setArmed(false)} disabled={busy}>Cancel</PBtn>
        <PBtn size="xs" variant={variant} busy={busy} onClick={() => onConfirm(() => setArmed(false))}>{confirmLabel}</PBtn>
      </span>);
  }

  function connState(s) {
    if (s.last_error) return { kind: 'bad', label: 'Failing' };
    if (s.stale) return { kind: 'warn', label: 'Stale' };
    if (s.last_ok_at) return { kind: 'good', label: 'Healthy' };
    if (!s.configured) return { kind: 'neutral', label: 'Not configured' };
    return { kind: 'neutral', label: 'Never synced' };
  }
  function noSourceReason(store) {
    if (store.pos === 'treez') return 'no data source · runs ' + (store.pos.charAt(0).toUpperCase() + store.pos.slice(1));
    if (store.pos === 'none' || !store.pos) return 'no data source';
    return 'not configured';
  }
  const RUN_STATUS = { running: { kind: 'info', label: 'Running' }, ok: { kind: 'good', label: 'OK' }, partial: { kind: 'warn', label: 'Partial' }, failed: { kind: 'bad', label: 'Failed' } };

  // ── Connections ─────────────────────────────────────────────────────────
  function ConnectionsCard({ status, stores, actorId, onSynced, onJumpToUpload }) {
    const P = useP();
    const [syncing, setSyncing] = React.useState(null); // key of the row currently syncing

    const rows = [];
    const byStore = {};
    (status.data.sources || []).forEach((s) => { (byStore[s.store_id] = byStore[s.store_id] || []).push(s); });
    stores.forEach((store) => {
      const list = byStore[store.id];
      if (list && list.length) list.forEach((s) => rows.push({ kind: 'source', store, s }));
      else rows.push({ kind: 'none', store });
    });

    const syncNow = (store, s) => {
      const key = store.id + ':' + s.source;
      setSyncing(key);
      HWInc.post('/api/incentives/ingest/sync-now', { source: s.source, store_id: store.id, actor: actorId }).then((r) => {
        setSyncing(null);
        if (r.ok && r.body && r.body.run) {
          const run = r.body.run;
          window.hdToast && window.hdToast({
            title: run.status === 'failed' ? 'Sync failed' : 'Synced',
            description: run.status === 'failed' ? (run.error || 'The source did not answer.')
              : `${store.name} · ${s.source} — ${run.inserted} new, ${run.unchanged} unchanged${run.conflicts ? `, ${run.conflicts} conflicts` : ''}`,
            tone: run.status === 'failed' ? 'blocked' : run.status === 'partial' ? 'warn' : 'ok',
          });
        } else {
          window.hdToast && window.hdToast({ title: 'Sync failed', description: r.error || 'The source did not answer.', tone: 'blocked' });
        }
        onSynced();
      });
    };

    return (
      <Card padding={0}>
        <SubHead icon="plug" title="Connections" right={<span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{stores.length} stores</span>} />
        {window.DevNote && <div style={{ padding: '0 16px' }}>
          <window.DevNote id="conn-hwpos-production-wiring" tone="gap" title="Production POS wiring">
            <window.DevNoteP>
              This note is itself a developer marker, not customer copy — it exists so whoever wires the real
              register reads this before the <window.DevNoteMono>hwpos</window.DevNoteMono> row above shows up
              here as a live source.
            </window.DevNoteP>
            <window.DevNoteP>
              The production POS must <window.DevNoteMono>POST /api/pos/sale</window.DevNoteMono> on
              <b> every completed tender</b> with the documented body (docs/BOUNTY-API-CONTRACT.md), including
              {' '}<window.DevNoteMono>lines[]</window.DevNoteMono> — one entry per cart line, built once at tender
              time: <window.DevNoteMono>product_name, brand, category, sku, quantity, unit_price_cents,
              line_gross_cents, line_net_cents, discount_cents</window.DevNoteMono>. Without{' '}
              <window.DevNoteMono>lines[]</window.DevNoteMono>, the register's sales post their total to the
              store/associate boards but are <b>invisible to every brand and category bounty</b> — those score off
              <window.DevNoteMono> inc_lines</window.DevNoteMono>, not the transaction total.
            </window.DevNoteP>
            <window.DevNoteP>
              A field the register genuinely does not know (an unresolved SKU, a catalogue with no brand on a
              line) must be sent as <window.DevNoteMono>null</window.DevNoteMono> — never{' '}
              <window.DevNoteMono>0</window.DevNoteMono>, which reads as "this line cost nothing" instead of
              "we don't know what this line cost."
            </window.DevNoteP>
            <window.DevNoteP>
              Refunds and voids are their <b>own POST</b>, never folded into the sale they reverse — add
              {' '}<window.DevNoteMono>txn_type</window.DevNoteMono> to the body,
              one of <window.DevNoteMono>sale|refund|void</window.DevNoteMono>, defaulting to{' '}
              <window.DevNoteMono>sale</window.DevNoteMono> when absent (see{' '}
              <window.DevNoteMono>aov_compat.record_hwpos_sale</window.DevNoteMono>). A refund should also carry
              {' '}<window.DevNoteMono>ref_txn_id</window.DevNoteMono> — the original sale's{' '}
              <window.DevNoteMono>order_id</window.DevNoteMono> — the same role Blaze's{' '}
              <window.DevNoteMono>parentTransactionId</window.DevNoteMono> plays.
            </window.DevNoteP>
            <window.DevNoteP>
              <window.DevNoteMono>associate_id</window.DevNoteMono> must be the person who actually rang the
              sale — never the terminal or a shared till login. Every board and bounty here attributes to a
              person, not a register; a terminal ID in that field makes every sale on that lane
              unattributable to any one associate.
            </window.DevNoteP>
          </window.DevNote>
        </div>}
        <DataTable
          columns={[
            { key: 'store', label: 'Store', render: (r) => <b style={{ color: P.ink }}>{r.store.name}</b> },
            { key: 'source', label: 'Source', render: (r) => r.kind === 'source' ? <Pill kind="neutral" size="sm">{r.s.source}</Pill> : <Pill kind="neutral" size="sm">none</Pill> },
            { key: 'state', label: 'State', render: (r) => { const st = r.kind === 'source' ? connState(r.s) : { kind: 'neutral', label: 'No source' }; return <Pill kind={st.kind} size="sm" dot>{st.label}</Pill>; } },
            { key: 'last_ok', label: 'Last ok', render: (r) => r.kind === 'source' ? <span style={{ fontFamily: P.fontMono, fontSize: 11.5 }}>{r.s.last_ok_at ? `${r.s.last_ok_at} · ${HWInc.fmt.relative(r.s.last_ok_at)}` : 'never'}</span> : <span style={{ color: P.inkMute, fontFamily: P.fontMono, fontSize: 11.5 }}>never</span> },
            { key: 'last_error', label: 'Last error', render: (r) => r.kind === 'source' && r.s.last_error ? <span style={{ fontFamily: P.fontMono, fontSize: 11, color: P.bad }}>{r.s.last_error_at ? `${r.s.last_error_at} — ` : ''}{r.s.last_error}</span> : (r.kind === 'none' ? <span style={{ fontSize: 11.5, color: P.inkDim }}>{noSourceReason(r.store)}</span> : <span style={{ color: P.inkFaint }}>—</span>) },
            { key: 'today', label: 'Today', align: 'right', render: (r) => r.kind === 'source' && r.s.today ? <span style={{ fontFamily: P.fontMono, fontSize: 12 }}>{HWInc.fmt.number(r.s.today.txns)} txns</span> : <span style={{ color: P.inkFaint }}>—</span> },
            {
              key: 'action', label: '', align: 'right', render: (r) => {
                if (r.kind === 'none') return null;
                if (r.s.source.endsWith('-api')) {
                  const key = r.store.id + ':' + r.s.source;
                  return <PBtn size="xs" variant="secondary" icon="refresh" busy={syncing === key} onClick={() => syncNow(r.store, r.s)}>Sync now</PBtn>;
                }
                return <PBtn size="xs" variant="secondary" icon="download" onClick={() => onJumpToUpload(r.store.id)}>Upload</PBtn>;
              },
            },
          ]}
          rows={rows}
          rowKey={(r) => r.store.id + ':' + (r.kind === 'source' ? r.s.source : 'none')}
        />
      </Card>);
  }

  // ── Upload ──────────────────────────────────────────────────────────────
  const CHUNK_BYTES = 1400000; // keeps each base64 chunk under the 2 MB cap (contract §Data)
  function UploadCard({ stores, defaultStoreId, actorId, onRunProduced, jumpKey }) {
    const P = useP();
    const [storeId, setStoreId] = React.useState(defaultStoreId);
    const [phase, setPhase] = React.useState('idle'); // idle | reading | uploading | committing | done | error
    const [progress, setProgress] = React.useState(0);
    const [fileMeta, setFileMeta] = React.useState(null);
    const [run, setRun] = React.useState(null);
    const [err, setErr] = React.useState(null);
    const inputRef = React.useRef(null);

    React.useEffect(() => { if (jumpKey) setStoreId(jumpKey); }, [jumpKey]);

    const reset = () => { setPhase('idle'); setProgress(0); setFileMeta(null); setRun(null); setErr(null); if (inputRef.current) inputRef.current.value = ''; };

    const startUpload = async (file) => {
      setFileMeta({ name: file.name, size: file.size });
      setRun(null); setErr(null); setPhase('reading'); setProgress(0);
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const begin = await HWInc.post('/api/incentives/ingest/upload/begin', { store_id: storeId, filename: file.name, size: bytes.length, actor: actorId });
        if (!begin.ok || !begin.body || !begin.body.upload_id) { setPhase('error'); setErr(begin.error || 'The upload could not start.'); return; }
        const uploadId = begin.body.upload_id;
        const total = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
        setPhase('uploading');
        for (let seq = 0; seq < total; seq++) {
          const slice = bytes.subarray(seq * CHUNK_BYTES, Math.min(bytes.length, (seq + 1) * CHUNK_BYTES));
          const chunkRes = await HWInc.post('/api/incentives/ingest/upload/chunk', { upload_id: uploadId, seq, b64: bytesToBase64(slice) });
          if (!chunkRes.ok) { setPhase('error'); setErr(chunkRes.error || 'The upload failed partway through.'); return; }
          setProgress((seq + 1) / total);
        }
        setPhase('committing');
        const commit = await HWInc.post('/api/incentives/ingest/upload/commit', { upload_id: uploadId });
        if (!commit.ok || !commit.body || !commit.body.run) { setPhase('error'); setErr(commit.error || 'The file could not be parsed.'); return; }
        setRun(commit.body.run);
        setPhase('done');
        onRunProduced();
      } catch (e) {
        setPhase('error'); setErr(String((e && e.message) || e));
      }
    };

    const equation = run ? { sum: (run.inserted || 0) + (run.unchanged || 0) + (run.conflicts || 0) + (run.rejected || 0), balanced: null } : null;
    if (equation) equation.balanced = equation.sum === run.rows_read;

    return (
      <Card padding={0}>
        <SubHead icon="download" title="Upload" />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {window.DevNote && (
            <window.DevNote id="upload-vs-live-paths" tone="info" title="CSV upload is the backfill path">
              <window.DevNoteP>
                This note is a developer marker, not user copy. CSV upload here is how a store's <b>past</b>{' '}
                Blaze/Meadow export gets into the ledger — a manager runs it by hand, after the fact. The{' '}
                <b>live</b> paths are the vendor APIs (Connections' "Sync now") and the register's own{' '}
                <window.DevNoteMono>POST /api/pos/sale</window.DevNoteMono> — those land the moment a sale
                happens, with no manager action. A production POS integration replaces the need for this
                card for <window.DevNoteMono>hwpos</window.DevNoteMono>, the same way a Blaze/Meadow API key
                replaces it for those vendors.
              </window.DevNoteP>
            </window.DevNote>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Seg value={storeId} onChange={setStoreId} options={stores.map((s) => ({ value: s.id, label: s.name }))} size="sm" />
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xlsm" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) startUpload(f); }} />
            <PBtn size="sm" variant="accent" icon="download" disabled={phase === 'uploading' || phase === 'committing' || phase === 'reading'} onClick={() => inputRef.current && inputRef.current.click()}>
              Choose a file
            </PBtn>
            <span style={{ fontSize: 11, color: P.inkMute }}>.csv, .xlsx or .xlsm — Blaze All Sales, Blaze Total Sales, or a Meadow Orders Report</span>
            {phase !== 'idle' && <PBtn size="xs" variant="ghost" onClick={reset}>Clear</PBtn>}
          </div>

          {fileMeta && (phase === 'reading' || phase === 'uploading' || phase === 'committing') && (
            <div style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: P.ink }}>{fileMeta.name}</span>
                <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>{(fileMeta.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <BarMeter value={phase === 'uploading' ? progress : phase === 'committing' ? 1 : 0.02} max={1} color={P.info} height={8} />
              <div style={{ marginTop: 6, fontSize: 11, color: P.inkDim, fontFamily: P.fontMono }}>
                {phase === 'reading' && 'reading the file…'}
                {phase === 'uploading' && `uploading · ${Math.round(progress * 100)}%`}
                {phase === 'committing' && 'parsing on the server…'}
              </div>
            </div>)}

          {phase === 'error' && (
            <ErrorState compact title="The upload didn’t go through" body={err} onRetry={reset} />)}

          {phase === 'done' && run && (
            <Card padding={0} elevation="sunken">
              <SubHead icon={run.status === 'failed' ? 'x' : 'check-circle'} title={`Run report · ${run.id}`}
                tone={run.status === 'failed' ? 'bad' : run.status === 'partial' ? 'warn' : undefined}
                right={<Pill kind={(RUN_STATUS[run.status] || RUN_STATUS.ok).kind} size="sm" dot>{(RUN_STATUS[run.status] || {}).label || run.status}</Pill>} />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: P.surface }}>
                <KV k="File" v={fileMeta ? fileMeta.name : run.filename} mono />
                <KV k="Detected format" v={run.format || '—'} mono />
                <KV k="Store" v={(stores.find((s) => s.id === run.store_id) || {}).name || run.store_id} />
                {run.window_from && <KV k="Window in the file" v={`${run.window_from} → ${run.window_to || '…'}`} mono />}
                {run.status === 'failed' && run.error && (
                  <div style={{ background: P.badSoft, border: `1px solid ${P.bad}`, borderRadius: P.r10, padding: '10px 13px', fontSize: 12, color: P.ink2 }}>{run.error}</div>)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                  <CounterTile label="Rows read" value={HWInc.fmt.number(run.rows_read)} />
                  <CounterTile label="Inserted" value={HWInc.fmt.number(run.inserted)} tone="good" />
                  <CounterTile label="Unchanged" value={HWInc.fmt.number(run.unchanged)} />
                  <CounterTile label="Conflicts" value={HWInc.fmt.number(run.conflicts)} tone={run.conflicts ? 'warn' : undefined} />
                  <CounterTile label="Rejected" value={HWInc.fmt.number(run.rejected)} tone={run.rejected ? 'bad' : undefined} />
                  <CounterTile label="Unresolved names" value={HWInc.fmt.number(run.unresolved_identities)} tone={run.unresolved_identities ? 'info' : undefined} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: P.fontMono, color: equation.balanced ? P.good : P.bad }}>
                  <Icon name={equation.balanced ? 'check-circle' : 'alert'} size={14} stroke={2} />
                  {HWInc.fmt.number(run.inserted)} + {HWInc.fmt.number(run.unchanged)} + {HWInc.fmt.number(run.conflicts)} + {HWInc.fmt.number(run.rejected)} = {HWInc.fmt.number(equation.sum)}
                  {equation.balanced ? ` — every row is accounted for` : ` — does not match ${HWInc.fmt.number(run.rows_read)} rows read`}
                </div>
                {run.brands_unknown && run.brands_unknown.length > 0 && (
                  <div style={{ fontSize: 11.5, color: P.inkDim }}>Brands not in the brand DB: {run.brands_unknown.join(', ')}</div>)}
              </div>
            </Card>)}
        </div>
      </Card>);
  }

  // ── Runs (+ rejects / conflicts detail) ────────────────────────────────
  function RunsCard({ runs, actorId, onChanged }) {
    const P = useP();
    const [selected, setSelected] = React.useState(null);
    const detail = useGet(selected ? `/api/incentives/ingest/runs/${selected}/rejects` : null, !!selected);
    const detailConflicts = useGet(selected ? `/api/incentives/ingest/runs/${selected}/conflicts` : null, !!selected);
    const [applying, setApplying] = React.useState(null); // txn_key being applied, or 'ALL'

    const applyIncoming = (runId, txnKey) => {
      setApplying(txnKey || 'ALL');
      HWInc.post('/api/incentives/ingest/conflicts/apply', { run_id: runId, txn_key: txnKey || undefined, actor: actorId }).then((r) => {
        setApplying(null);
        if (r.ok && r.body) {
          window.hdToast && window.hdToast({ title: 'Applied', description: `${r.body.applied} row${r.body.applied === 1 ? '' : 's'} updated from the incoming file.`, tone: 'ok' });
          detailConflicts.refresh();
          onChanged();
        } else {
          window.hdToast && window.hdToast({ title: 'Could not apply', description: r.error || 'Try again.', tone: 'blocked' });
        }
      });
    };

    const runList = runs.data ? runs.data.runs || [] : null;
    return (
      <Card padding={0}>
        <SubHead icon="clock" title="Runs" count={runList ? runList.length : null} />
        {runs.loading && <div style={{ padding: 16 }}><SkeletonRows rows={3} avatar={false} /></div>}
        {!runs.loading && runs.error && <div style={{ padding: 16 }}><ErrorState compact title="Runs aren’t connected" body="Needs the wmdemo backend — not reachable right now." onRetry={runs.refresh} /></div>}
        {!runs.loading && runList && (
          <DataTable
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelected(selected === r.id ? null : r.id)}
            selectedKeys={selected ? new Set([selected]) : undefined}
            columns={[
              { key: 'id', label: 'Run', render: (r) => <span style={{ fontFamily: P.fontMono }}>#{r.id}</span> },
              { key: 'kind', label: 'Kind · source', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5 }}>{r.kind} · {r.source}</span> },
              { key: 'format', label: 'Format', render: (r) => r.format || <span style={{ color: P.inkFaint }}>—</span> },
              { key: 'started', label: 'Started', render: (r) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5 }}>{r.started_at}</span> },
              { key: 'status', label: 'Status', render: (r) => { const st = RUN_STATUS[r.status] || { kind: 'neutral', label: r.status }; return <Pill kind={st.kind} size="sm" dot>{st.label}</Pill>; } },
              { key: 'rows', label: 'Read', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono }}>{HWInc.fmt.number(r.rows_read)}</span> },
              { key: 'rejected', label: 'Rejected', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: r.rejected ? P.bad : P.inkFaint }}>{HWInc.fmt.number(r.rejected)}</span> },
              { key: 'conflicts', label: 'Conflicts', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: r.conflicts ? P.warnText : P.inkFaint }}>{HWInc.fmt.number(r.conflicts)}</span> },
            ]}
            rows={runList}
          />)}

        {selected && (
          <div style={{ borderTop: `1px solid ${P.hairline2}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: P.canvas2 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Rejected rows</div>
              {detail.loading && <SkeletonRows rows={2} avatar={false} />}
              {!detail.loading && detail.data && (
                <DataTable dense
                  columns={[
                    { key: 'row_no', label: 'Row', width: 70, render: (x) => <span style={{ fontFamily: P.fontMono }}>{x.row_no}</span> },
                    { key: 'reason', label: 'Why', render: (x) => x.reason },
                    { key: 'raw', label: 'What was in it', render: (x) => <span style={{ fontFamily: P.fontMono, fontSize: 11, color: P.inkDim }}>{x.raw_excerpt}</span> },
                  ]}
                  rows={detail.data.rejects || []} rowKey={(x) => x.row_no} />)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, flex: 1 }}>Conflicts</span>
                {detailConflicts.data && detailConflicts.data.conflicts && detailConflicts.data.conflicts.length > 0 &&
                  <PBtn size="xs" variant="secondary" busy={applying === 'ALL'} onClick={() => applyIncoming(selected, null)}>Apply incoming for all</PBtn>}
              </div>
              {detailConflicts.loading && <SkeletonRows rows={2} avatar={false} />}
              {!detailConflicts.loading && detailConflicts.data && (
                <DataTable dense
                  columns={[
                    { key: 'txn', label: 'Transaction', render: (x) => <span style={{ fontFamily: P.fontMono, fontSize: 11 }}>{x.txn_key}</span> },
                    { key: 'field', label: 'Field', render: (x) => x.field },
                    { key: 'stored', label: 'Stored', render: (x) => <span style={{ fontFamily: P.fontMono }}>{String(x.stored_value)}</span> },
                    { key: 'incoming', label: 'Incoming', render: (x) => <span style={{ fontFamily: P.fontMono, color: P.warnText }}>{String(x.incoming_value)}</span> },
                    { key: 'action', label: '', align: 'right', render: (x) => <PBtn size="xs" variant="secondary" busy={applying === x.txn_key} onClick={() => applyIncoming(selected, x.txn_key)}>Apply incoming</PBtn> },
                  ]}
                  rows={detailConflicts.data.conflicts || []} rowKey={(x) => x.txn_key + ':' + x.field} />)}
            </div>
          </div>)}
      </Card>);
  }

  // ── Identities ──────────────────────────────────────────────────────────
  function IdentityCard({ identity, roster, classes, actorId, onDone }) {
    const P = useP();
    const [picking, setPicking] = React.useState(false);
    const [pickId, setPickId] = React.useState('');
    const [busyKind, setBusyKind] = React.useState(null);
    // The class the NEW person is created into. Defaulting to budtender is the
    // backend's rule too, and a queue at a delivery depot is mostly drivers —
    // asking here is what stops a manager minting fourteen people onto the
    // budtenders' board and moving them one at a time afterwards.
    const [newClass, setNewClass] = React.useState('budtender');

    const resolve = (associateId, done) => {
      setBusyKind('bind');
      HWInc.post('/api/incentives/identities/resolve', { identity_key: identity.identity_key, associate_id: associateId, actor: actorId }).then((r) => {
        setBusyKind(null);
        if (r.ok && r.body) {
          const re = r.body.reattributed || {};
          window.hdToast && window.hdToast({ title: 'Bound', description: `${re.txns || 0} sales · ${re.lines || 0} lines reattributed.`, tone: 'ok' });
          onDone();
        } else {
          window.hdToast && window.hdToast({ title: 'Could not bind', description: r.error || 'Try again.', tone: 'blocked' });
        }
        done && done();
      });
    };
    const create = (done) => {
      setBusyKind('create');
      HWInc.post('/api/incentives/identities/create', { identity_key: identity.identity_key, actor: actorId, classification: newClass }).then((r) => {
        setBusyKind(null);
        if (r.ok) {
          const label = ((classes || []).find((c) => c.id === newClass) || {}).label || newClass;
          window.hdToast && window.hdToast({ title: 'Person created', description: `“${identity.raw_name}” is now its own associate, classified as ${label.toLowerCase()}.`, tone: 'ok' });
          onDone();
        }
        else window.hdToast && window.hdToast({ title: 'Could not create', description: r.error || 'Try again.', tone: 'blocked' });
        done && done();
      });
    };

    return (
      <Card padding={14} elevation="sunken">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <b style={{ fontSize: 13, color: P.ink }}>&#8220;{identity.raw_name}&#8221;</b>
          <Pill kind="neutral" size="sm">{identity.source} · {identity.store_id}</Pill>
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>
          {identity.seen_count} seen · {identity.sales_count} sales · {HWInc.fmt.cents(identity.cents)} · first seen {identity.first_seen} · last seen {identity.last_seen}
        </div>

        {identity.suggestions && identity.suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {identity.suggestions.map((sug) => (
              <div key={sug.associate_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, padding: '6px 10px' }}>
                <Avatar name={sug.name} size={22} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, flex: 1, minWidth: 0 }}>{sug.name}</span>
                <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{sug.score.toFixed(2)} · {sug.evidence}</span>
                <InlineConfirm label="Bind" confirmLabel="Confirm" prompt={`Bind to ${sug.name}?`} busy={busyKind === 'bind'} onConfirm={(done) => resolve(sug.associate_id, done)} />
              </div>))}
          </div>)}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!picking && <PBtn size="xs" variant="secondary" onClick={() => setPicking(true)}>Pick someone</PBtn>}
          {picking && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <select value={pickId} onChange={(e) => setPickId(e.target.value)}
                style={{ height: 30, borderRadius: P.r8, border: `1px solid ${P.hairline3}`, background: P.surface, color: P.ink, fontSize: 12, fontFamily: P.fontSans, padding: '0 8px' }}>
                <option value="">Choose from the roster…</option>
                {roster.map((r) => <option key={r.associate_id} value={r.associate_id}>{r.name} · {r.store_name}</option>)}
              </select>
              <PBtn size="xs" variant="accent" disabled={!pickId} busy={busyKind === 'bind'} onClick={() => resolve(pickId, () => setPicking(false))}>Bind</PBtn>
              <PBtn size="xs" variant="ghost" onClick={() => setPicking(false)}>Cancel</PBtn>
            </span>)}
          <InlineConfirm label="Create a new person" confirmLabel="Create" prompt={`Create “${identity.raw_name}” as a`} busy={busyKind === 'create'} variant="secondary" onConfirm={create}
            extra={(classes || []).length ? (
              <select value={newClass} onChange={(e) => setNewClass(e.target.value)}
                style={{ height: 26, borderRadius: P.r8, border: `1px solid ${P.hairline3}`, background: P.surface, color: P.ink, fontSize: 11.5, fontFamily: P.fontSans, padding: '0 6px' }}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>) : null} />
        </div>
      </Card>);
  }

  function IdentitiesCard({ identities, roster, classes, actorId, onChanged }) {
    const list = identities.data ? identities.data.identities || [] : null;
    return (
      <Card padding={0}>
        <SubHead icon="users" title="Unresolved identities" count={list ? list.length : null} tone={list && list.length ? 'info' : undefined} />
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {identities.loading && <SkeletonRows rows={2} />}
          {!identities.loading && identities.error && <ErrorState compact title="Identities aren’t connected" body="Needs the wmdemo backend — not reachable right now." onRetry={identities.refresh} />}
          {!identities.loading && list && list.length === 0 &&
            <EmptyState compact icon="check-circle" title="Nothing unresolved" body="Every POS name at this store is bound to a person." />}
          {!identities.loading && list && list.map((idn) => (
            <IdentityCard key={idn.identity_key} identity={idn} roster={roster.data ? roster.data.roster || [] : []} classes={classes} actorId={actorId} onDone={onChanged} />
          ))}
        </div>
      </Card>);
  }

  // ── Roster ──────────────────────────────────────────────────────────────
  // A NATIVE <select>, MATCHING THE ONE ABOVE. The identity queue's "Pick
  // someone" control is a styled native select for the same reason: this is a
  // one-of-six choice made in a table cell, and the atom set has no listbox.
  // Its styling is copied from that control deliberately — a second dropdown
  // shape three cards down the same screen reads as a different kind of thing.
  function ClassSelect({ value, onChange, options, disabled, busy }) {
    const P = useP();
    return (
      <select value={value || ''} disabled={disabled || busy}
        onChange={(e) => onChange(e.target.value)}
        style={{ height: 28, borderRadius: P.r8, border: `1px solid ${P.hairline3}`,
          background: busy ? P.surface2 : P.surface, color: P.ink, fontSize: 12,
          fontFamily: P.fontSans, padding: '0 6px', maxWidth: 160,
          opacity: busy ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>);
  }

  function RosterCard({ roster, classes, actorId, canClassify, onChanged }) {
    const P = useP();
    const [busyId, setBusyId] = React.useState(null);
    const options = (classes && classes.length ? classes : [])
      .map((c) => ({ id: c.id, label: c.label }));

    // The class is written the moment it is picked — no Save button. It is one
    // field, it is reversible, and every change is already an append-only row
    // in inc_classification_events with the manager's name on it, so a
    // confirmation step would guard nothing that is not already recorded.
    const classify = (r, next) => {
      if (next === r.classification) return;
      setBusyId(r.associate_id);
      HWInc.post('/api/incentives/roster/classify',
        { associate_id: r.associate_id, classification: next, actor: actorId,
          reason: 'set from the roster table' }).then((res) => {
        setBusyId(null);
        if (res.ok) {
          const label = (options.find((o) => o.id === next) || {}).label || next;
          window.hdToast && window.hdToast({
            title: `${r.name} is a ${label.toLowerCase()}`,
            description: 'Bounties open to that class now include them, and the board they appear on has changed.',
            tone: 'ok' });
          onChanged && onChanged();
        } else {
          window.hdToast && window.hdToast({ title: 'Could not change the classification',
            description: (res.body && res.body.error) || res.error || 'Try again.', tone: 'blocked' });
        }
      });
    };

    return (
      <Card padding={0}>
        <SubHead icon="user-check" title="Roster" count={roster.data && roster.data.roster ? roster.data.roster.length : null} />
        {roster.loading && <div style={{ padding: 16 }}><SkeletonRows rows={2} /></div>}
        {!roster.loading && roster.error && <div style={{ padding: 16 }}><ErrorState compact title="Roster isn’t connected" body="Needs the wmdemo backend — not reachable right now." onRetry={roster.refresh} /></div>}
        {!roster.loading && roster.data && (
          <DataTable
            columns={[
              { key: 'name', label: 'Person', render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={r.name} size={24} /><b>{r.name}</b></div> },
              { key: 'store', label: 'Store', render: (r) => r.store_name },
              // WHAT KIND OF PERSON THIS IS — which bounties they are eligible
              // for and which board they appear on. Blaze cannot tell us: its
              // employee payload has roleLevel {ADMIN, MANAGER, OTHER} and a
              // `driver` flag, so a budtender, the loss-prevention officer and
              // a support account arrive identical. This cell is where the
              // difference is actually made, which is why it is a control and
              // not a label.
              { key: 'classification', label: 'Classification', width: 180, render: (r) => (canClassify && options.length
                ? <ClassSelect value={r.classification || 'budtender'} options={options}
                    busy={busyId === r.associate_id} onChange={(v) => classify(r, v)} />
                : <window.IncShared.ClassPill cls={r.classification} />) },
              { key: 'active', label: 'Active', render: (r) => <Pill kind={r.active ? 'good' : 'neutral'} size="sm">{r.active ? 'active' : 'inactive'}</Pill> },
              {
                key: 'ids', label: 'Bound identities', render: (r) => (r.identities || []).length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {r.identities.map((i, k) => <span key={k} style={{ fontFamily: P.fontMono, fontSize: 10.5, color: P.inkDim, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r6, padding: '2px 6px' }}>{i.source}:{i.raw_name} · {i.match_kind}</span>)}
                  </div>) : <span style={{ color: P.inkFaint, fontSize: 11.5 }}>none</span>,
              },
            ]}
            rows={roster.data.roster || []} rowKey={(r) => r.associate_id} />)}
      </Card>);
  }

  // ── screen ──────────────────────────────────────────────────────────────
  window.IncScreenData = function IncScreenData({ session, isManager }) {
    const P = useP();

    const status = HWInc.usePoll('/api/incentives/ingest/status', { intervalMs: 20000, enabled: isManager });
    const settings = useGet('/api/incentives/settings', isManager);
    const [storeFilter, setStoreFilter] = React.useState(session.storeId || 'all');
    const [uploadJump, setUploadJump] = React.useState(null);
    const scopedStoreId = storeFilter === 'all' ? undefined : storeFilter;
    const runs = useGet(isManager ? `/api/incentives/ingest/runs${scopedStoreId ? `?store_id=${encodeURIComponent(scopedStoreId)}&limit=25` : '?limit=25'}` : null, isManager);
    const identities = useGet(isManager ? `/api/incentives/identities/unresolved${scopedStoreId ? `?store_id=${encodeURIComponent(scopedStoreId)}` : ''}` : null, isManager);
    const roster = useGet(isManager ? `/api/incentives/roster${scopedStoreId ? `?store_id=${encodeURIComponent(scopedStoreId)}` : ''}` : null, isManager);

    if (!isManager) {
      return (
        <EmptyState icon="database" title="Data is a manager tool"
          body="Your sales sync in from the store's POS automatically — there's nothing to configure here. If a number on your board looks wrong, tell a manager; they can see exactly which sales are missing and why." />);
    }

    if (status.loading && !status.data) {
      return <Card padding={0}>
        <SubHead icon="database" title="Data" />
        <div style={{ padding: 16 }}><SkeletonRows rows={4} /></div>
      </Card>;
    }
    if (status.error || !status.data) {
      return <window.IncShared.NotConnected onRetry={status.refresh} />;
    }
    if (settings.loading && !settings.data) return <div style={{ padding: 16 }}><SkeletonRows rows={2} avatar={false} /></div>;
    if (settings.error || !settings.data) return <window.IncShared.NotConnected onRetry={settings.refresh} />;

    const stores = settings.data.stores || [];
    // `roster` is in here now: creating a person from the identity queue adds
    // a roster row, and classifying one changes a cell in the table below.
    const refreshAll = () => { status.refresh(); runs.refresh(); identities.refresh(); roster.refresh(); };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.01em', color: P.ink }}>Data</h1>
            <p style={{ margin: '4px 0 0', maxWidth: 640, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
              Where every number in Bounty comes from, and what happened the last time each source was read.
            </p>
          </div>
          <Seg value={storeFilter} onChange={setStoreFilter} size="sm"
            options={[{ value: 'all', label: 'All stores' }].concat(stores.map((s) => ({ value: s.id, label: s.name })))} />
        </div>

        <ConnectionsCard status={status} stores={stores} actorId={session.id} onSynced={refreshAll} onJumpToUpload={(id) => setUploadJump(id)} />
        <UploadCard stores={stores} defaultStoreId={session.storeId || (stores[0] && stores[0].id)} actorId={session.id} onRunProduced={refreshAll} jumpKey={uploadJump} />
        <RunsCard runs={runs} actorId={session.id} onChanged={refreshAll} />
        <IdentitiesCard identities={identities} roster={roster} classes={settings.data.classes || []} actorId={session.id} onChanged={refreshAll} />
        <RosterCard roster={roster} classes={settings.data.classes || []} actorId={session.id}
          canClassify={isManager} onChanged={() => { roster.refresh(); }} />
      </div>);
  };
})();
