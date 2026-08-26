// ── #/commission and #/registry — tag commissioning + the binding registry ──
// A binding is born here, which is why 1:1 is enforced here rather than
// discovered at scan time. The 409 refusal is a real state on this screen, not
// a toast: it has a run that stopped, a label that was never printed, an audit
// event — and a resolution only a supervisor may choose.
;(function () {
  const useP = window.useP;

  const STATE_TONE = {
    AVAILABLE: 'ok', TRANSFER_PENDING: 'info', ALLOCATED: 'info', DISPATCHED: 'info',
    SOLD: 'archived', HELD: 'warn', SOFT_HOLD: 'warn', RETURNED: 'neutral',
    DAMAGED: 'blocked', DESTROYED: 'blocked',
  };
  window.RFID_STATE_TONE = STATE_TONE;

  function ZplBlock() {
    const P = useP();
    // `white-space: pre` + `overflow-x: auto` + no tab stop meant the right half
    // of every ZPL line was mouse-only. Same fix as the tables.
    return (
      <pre role="region" aria-label="ZPL label template" tabIndex={0}
        style={{ margin: 0, padding: '11px 13px', background: P.surface3, borderRadius: P.r8, border: `1px solid ${P.hairline2}`,
        fontFamily: P.fontMono, fontSize: 11.5, lineHeight: 1.65, color: P.ink2, overflowX: 'auto', whiteSpace: 'pre' }}>
        {window.RFID_DATA.ZPL_SAMPLE}
      </pre>);
  }

  /* ══════════════════════ THE COLLISION ══════════════════════ */
  // Direction C's decision model, on Direction A's data. The handheld held this
  // label and refused it; this panel is where a person picks what happens next.

  function CollisionPanel({ run }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const C = run.collision;
    const [modal, setModal] = React.useState(null);   // 'rebind' | 'keep'
    const resolved = dec.binding.status !== 'open';
    const bad = HD.tone(P, 'blocked'), ok = HD.tone(P, 'ok');

    return (
      <Card padding={0}>
        <div style={{ padding: '16px 16px 12px' }}>
          <CardHead title="Collision — binding refused"
            sub="A retail ID may hold exactly one EPC, for its whole life. The run stopped, nothing was overwritten, and no label was printed."
            right={<FromDevice device={D.DEVICES.reader.id} who={run.actor} when={HD.relativeTime(run.at, D.NOW)} label="refused on" />}
            style={{ marginBottom: 0 }} />
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 44px minmax(0,1fr)', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: P.r12, background: bad.bg, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${bad.fg}` }}>
              <MicroLabel>Incoming EPC · rejected</MicroLabel>
              <div style={{ marginTop: 5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: P.ink, wordBreak: 'break-all' }}>{C.incomingEpc}</div>
              <div style={{ marginTop: 7 }}><HDPill size="sm" tone="blocked" style={monoStyle(P)} label={C.status} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute }}><Icon name="x" size={20} stroke={2.4} /></div>
            <div style={{ padding: '12px 14px', borderRadius: P.r12, background: ok.bg, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${ok.fg}` }}>
              <MicroLabel>Already bound · live</MicroLabel>
              <div style={{ marginTop: 5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: P.ink, wordBreak: 'break-all' }}>{C.boundEpc}</div>
              <div style={{ marginTop: 7, fontSize: 11.5, color: P.inkDim }}>
                <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{HD.formatDate(C.boundAt)}</span> · {C.boundBy}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <MetaCell label="Retail ID" value={C.value} mono />
            <MetaCell label="Audit event" value={C.auditEventId} mono />
            <MetaCell label="Stopped at" value={`unit ${run.commissioned + 1} of ${run.qty}`} mono />
            <MetaCell label="Resolution" value="Supervisor only" />
          </div>

          {resolved
            ? <Callout tone={dec.binding.status === 'rebound' ? 'warn' : 'ok'} icon="lock"
                title={dec.binding.status === 'rebound' ? 'Rebound — the old EPC is retired' : 'Original binding upheld — the incoming label was voided'}>
                {dec.binding.reason}
              </Callout>
            : <Callout tone="blocked" icon="ban" title="Why this is a refusal and not a warning">
                A duplicate caught here is a label we simply do not print. A duplicate caught at scan time is already
                on a jar in a box on a van, and there is no honest way to say which physical unit it is.
              </Callout>}
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${P.hairline2}`, background: P.surface2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: P.inkDim }}>Resolving writes an audit event either way — rebinding is never silent.</span>
          <PBtn size="sm" variant="ghost" icon="activity" onClick={() => { location.hash = '#/audit'; }}>View audit trail</PBtn>
          <PBtn size="sm" variant="secondary" disabled={resolved} onClick={() => setModal('keep')}>Void the label</PBtn>
          <PBtn size="sm" variant="secondary" icon="swap" disabled={resolved} onClick={() => setModal('rebind')}>
            {resolved ? (dec.binding.status === 'rebound' ? 'Rebound' : 'Binding upheld') : 'Rebind the EPC…'}
          </PBtn>
        </div>

        <ReasonModal open={modal === 'rebind'} onClose={() => setModal(null)}
          title="Rebind this retail ID to a new EPC" tone="warn" confirmLabel="Rebind"
          placeholder="e.g. original tag destroyed in the wash-down; physical unit re-tagged and witnessed by M. Reyes"
          body={<React.Fragment>
            Retail ID <b><Mono>{C.value}</Mono></b> currently carries EPC <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{D.shortEpc(C.boundEpc)}</span>,
            bound {HD.relativeTime(C.boundAt, D.NOW)} by {C.boundBy}. Rebinding retires that EPC and points the retail ID at{' '}
            <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{D.shortEpc(C.incomingEpc)}</span> instead.
            If the original tag is still on a physical unit somewhere, that unit becomes unresolvable. This is the override, not the happy path.
          </React.Fragment>}
          onConfirm={(reason) => { dec.resolveBinding('rebound', reason); window.hdToast && window.hdToast({ title: 'EPC rebound', description: `${C.value} now carries the incoming EPC.`, tone: 'warn' }); }} />

        <ReasonModal open={modal === 'keep'} onClose={() => setModal(null)}
          title="Void the incoming label and keep the original binding" tone="ok" confirmLabel="Void the label"
          placeholder="e.g. duplicate retail ID drawn by the allocator; ticket raised against the ID pool"
          body={<React.Fragment>
            The original binding stands. The label that could not be encoded is voided, the run resumes at unit{' '}
            <b><Mono>{run.commissioned + 2}</Mono></b>, and <b><Mono>{run.qty - run.commissioned - 1}</Mono></b> labels remain in this run.
          </React.Fragment>}
          onConfirm={(reason) => { dec.resolveBinding('kept', reason); window.hdToast && window.hdToast({ title: 'Label voided', description: `${C.value} kept its original EPC.`, tone: 'ok' }); }} />
      </Card>);
  }

  /* ══════════════════════ RUN SHEET ══════════════════════ */

  function RunSheet({ run, onClose }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    if (!run) return null;
    const collided = run.status === 'collision';
    return (
      <Sheet open onClose={onClose} width={560}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: P.fontMono, fontSize: 16, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{run.id}</div>
            <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <HDPill size="sm" tone={collided ? 'blocked' : 'ok'} style={monoStyle(P)} label={collided ? run.collision.status : `${run.commissioned} bound`} />
              <HDPill size="sm" tone={run.printed ? 'ok' : 'neutral'} icon={false} label={run.printed ? 'printed' : 'nothing printed'} />
              <span style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{HD.formatDateTime(run.at)}</span>
              <span style={{ fontSize: 12.5, color: P.inkMute }}>{run.actor}</span>
            </div>
          </div>
          <IconBtn icon="x" size={17} onClick={onClose} label="Close" style={{ width: 34, height: 34 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {collided && (
            <Callout tone="blocked" icon="ban" title="Rejected — the retail ID is already bound">
              <div style={{ marginBottom: 8 }}>
                Retail ID <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{run.collision.value}</span> already carries EPC{' '}
                <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{run.collision.boundEpc}</span>, bound {HD.relativeTime(run.collision.boundAt, D.NOW)}.
              </div>
              The run stopped at unit <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{run.commissioned + 1}</span> of{' '}
              <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{run.qty}</span>, an <span style={{ fontFamily: P.fontMono }}>audit_event</span> was written,
              and no label was printed. Resolving it is a decision on the commissioning screen, not here.
            </Callout>)}

          <Card style={{ background: P.surface2 }}>
            <KV label="SKU" value={run.sku} />
            <KV label="Package" value={run.packageId} />
            <KV label="Quantity requested" value={run.qty} />
            <KV label="Bound" value={run.commissioned} tone={collided ? HD.tone(P, 'blocked').fg : undefined} />
            <KV label="Tag material" value={run.material} />
            <KV label="Actor" value={run.actor} mono={false} />
          </Card>

          {!collided && (
            <div>
              <CardHead title="Bindings created" sub="EPC ↔ retail ID, 1:1 in both directions. The EPC carries no product meaning — the SKU lives in the registry, so a re-SKU never means re-tagging a physical unit." />
              <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden' }}>
                <window.ScrollX label="Bound tags table">
                  <HDTable>
                    <thead><tr style={{ background: P.surface2 }}>
                      <TH>EPC</TH><TH>Retail ID</TH><TH>State</TH>
                    </tr></thead>
                    <tbody>
                      {D.LAST_RUN_TAGS.map((t) => (
                        <TR key={t.epc}>
                          <TD><EpcChip value={t.epc} /></TD>
                          <TD mono>{t.retailId}</TD>
                          <TD><HDPill size="sm" tone={STATE_TONE[t.state]} icon={false} label={t.state} /></TD>
                        </TR>))}
                    </tbody>
                  </HDTable>
                </window.ScrollX>
                <div style={{ padding: '9px 12px', background: P.surface2, borderTop: `1px solid ${P.hairline2}`, fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
                  showing {D.LAST_RUN_TAGS.length} of {run.commissioned}
                </div>
              </div>
            </div>)}

          {!collided && (
            <div>
              <CardHead title="Label ZPL" sub="What the ZT411 was sent for the first unit of the run." />
              <ZplBlock />
            </div>)}
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <PBtn size="sm" variant="ghost" onClick={onClose}>Close</PBtn>
          <PBtn size="sm" variant="secondary" icon="printer" disabled={collided}
            onClick={() => window.hdToast && window.hdToast({ title: 'Reprint queued', description: `${run.commissioned} labels re-sent to ZT411-01.`, tone: 'ok' })}>Reprint labels</PBtn>
        </div>
      </Sheet>);
  }

  /* ══════════════════════ COMMISSIONING ══════════════════════ */

  window.ScreenCommission = function ScreenCommission({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const [sku, setSku] = React.useState(D.SKUS[0].sku);
    const [pkg, setPkg] = React.useState('1A4060300012345670000F6D22');
    const [qty, setQty] = React.useState('200');
    const [dryRun, setDryRun] = React.useState(false);
    const [openRun, setOpenRun] = React.useState(null);
    const printer = D.DEVICES.printer;
    const qtyNum = Number(qty) || 0;
    const stockAfter = printer.stockRemaining - qtyNum;
    const overStock = stockAfter < 0;
    const meta = D.SKU_MAP.get(sku);

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Tag commissioning"
          sub="Encode and print RFID labels on the ZT411. This is where an EPC ↔ retail-ID binding is born, which is why 1:1 is enforced here rather than discovered at scan time."
          actions={<React.Fragment>
            <PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=tags')}>See it on the handheld</PBtn>
            <PBtn size="sm" variant="secondary" icon="barcode" onClick={() => navigate('#/registry')}>Tag registry</PBtn>
          </React.Fragment>} />

        <div className="hd-2col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            <Card>
              <CardHead title="New commissioning run" sub="Retail IDs are pre-allocated by Hyperdrive — one per unit. The run mints an opaque 96-bit EPC for each, binds it, and only then prints." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <FormRow label="Product / SKU" hint={meta ? `${meta.name} · ${meta.brand}` : undefined}>
                  <RfidSelect label="SKU" value={sku} onChange={setSku} options={D.SKUS.map((s) => ({ id: s.sku, label: `${s.sku} — ${s.name}` }))} />
                </FormRow>
                <FormRow label="METRC package" hint="The package these units were split from.">
                  <Field size="md" mono aria-label="METRC source package" value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="1A40…" />
                </FormRow>
                <FormRow label="Quantity" hint={<React.Fragment>Retail IDs <Mono color={P.inkMute}>R-{sku}-09120</Mono> … will be drawn in order.</React.Fragment>}>
                  <Field size="md" mono aria-label="Number of tags to commission" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} placeholder="200" />
                </FormRow>
                <FormRow label="Tag material" hint="No on-metal stock was purchased. The option exists in the schema; the support does not.">
                  <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: P.r8, border: `1px solid ${P.hairline2}`, padding: 2, gap: 2 }}>
                    <button aria-pressed="true" style={{ fontSize: 12.5, padding: '0 12px', height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: P.fontSans, background: P.ink, color: P.surface }}>Paper</button>
                    <button disabled title="No on-metal stock purchased" style={{ fontSize: 12.5, padding: '0 12px', height: 32, borderRadius: 6, border: 'none', cursor: 'not-allowed', fontFamily: P.fontSans, background: 'transparent', color: P.inkFaint }}>On-metal</button>
                  </div>
                </FormRow>
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                {/* Ink-filled, not the accent Switch — the accent budget on this
                    view belongs to Commission & print. */}
                <div onClick={() => setDryRun((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: P.ink2, cursor: 'pointer', userSelect: 'none' }}>
                  <window.RfidCheck size={18} label="Dry run — bind, don’t print" on={dryRun} onChange={setDryRun} />
                  <span>Dry run — bind, don’t print</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: overStock ? HD.tone(P, 'blocked').fg : P.inkMute, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
                    {HD.formatNumber(Math.max(0, stockAfter))} labels left after
                  </span>
                  <PBtn size="md" variant="accent" icon="printer" disabled={!qtyNum || overStock}
                    onClick={() => { setOpenRun(D.COMMISSION_RUNS[0]); window.hdToast && window.hdToast({ title: dryRun ? 'Bound (dry run)' : 'Commissioned & printed', description: `${qtyNum} × ${sku}${dryRun ? ' — nothing sent to the printer.' : ' sent to ZT411-01.'}`, tone: 'ok' }); }}>
                    {dryRun ? 'Commission (no print)' : 'Commission & print'}
                  </PBtn>
                </div>
              </div>
              {overStock && (
                <div style={{ marginTop: 12 }}>
                  <Callout tone="blocked" icon="alert" title="Not enough label stock">
                    {HD.formatNumber(qtyNum)} labels requested, {HD.formatNumber(printer.stockRemaining)} on the roll. Load media before running this.
                  </Callout>
                </div>)}
            </Card>

            <CollisionPanel run={D.LIVE_RUN} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title={printer.id} right={<HDPill size="sm" tone="ok" label="online" />} />
              <KV label="Model" value={printer.model} mono={false} />
              <KV label="Media" value={printer.media} mono={false} />
              <KV label="Darkness" value={printer.darkness} />
              <KV label="Speed" value={`${printer.speed} ips`} />
              <KV label="Head temp" value={`${printer.headTemp}°C`} />
              <KV label="Last print" value={HD.relativeTime(printer.lastPrint, D.NOW)} />
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <MicroLabel>Label stock</MicroLabel>
                  <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{HD.formatNumber(printer.stockRemaining)} / {HD.formatNumber(printer.stockTotal)}</span>
                </div>
                <BarMeter value={printer.stockRemaining} max={printer.stockTotal} color={P.ink} height={8} />
                <div style={{ marginTop: 7, fontSize: 11.5, color: P.inkMute, lineHeight: 1.45 }}>
                  <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{HD.formatNumber(printer.stockTotal)}</span> tags ÷ ~<span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>700</span> per kit ≈ 5–6 kits. This is pilot quantity, not a supply.
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="Label ZPL" sub="Encode command, product line, SKU, QR and human-readable retail ID." />
              <ZplBlock />
              <div style={{ marginTop: 12 }}>
                <Callout tone="warn" icon="alert" title="Never printed on real stock">
                  This ZPL has not been run against a ZT411 on Vulcan Glint media. Print one, read it back with the TC22R, and confirm the encoded EPC matches the printed retail ID before any production run.
                </Callout>
              </div>
            </Card>

            <Card>
              <CardHead title="What a run guarantees" />
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: P.inkDim, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><b style={{ color: P.ink2 }}>1:1 both ways.</b> A retail ID that already carries an EPC is a hard <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>409</span>, never a silent overwrite.</li>
                <li><b style={{ color: P.ink2 }}>Bind before print.</b> Nothing is printed until every binding is durable. A jammed printer leaves records without labels — recoverable. Labels in the world with no binding are not.</li>
                <li><b style={{ color: P.ink2 }}>Retry the smallest unit.</b> A minted EPC that collides is re-minted, up to five times. The batch is never replayed.</li>
                <li><b style={{ color: P.ink2 }}>Idempotent.</b> Every run carries an <span style={{ fontFamily: P.fontMono }}>Idempotency-Key</span>; a replay returns the stored result rather than printing twice.</li>
              </ol>
            </Card>
          </div>
        </div>

        {/* Nine columns will not sit in a 740px well beside the printer card,
            so the run history takes the full page width beneath the grid. */}
        <Card padding={0}>
          <div style={{ padding: '16px 16px 12px' }}>
            <CardHead title="Recent runs" sub="Every run writes an audit event, whether it succeeded or was refused. Open one for its bindings — or for the collision that stopped it." style={{ marginBottom: 0 }} />
          </div>
          <window.ScrollX label="Commissioning runs table">
            <HDTable>
              <thead><tr style={{ background: P.surface2 }}>
                <TH>Run</TH><TH>SKU</TH><TH>Package</TH><TH align="right">Requested</TH>
                <TH align="right">Bound</TH><TH width={150}>Progress</TH><TH>Printed</TH><TH>Actor</TH><TH align="right">When</TH><TH>Result</TH>
              </tr></thead>
              <tbody>
                {D.COMMISSION_RUNS.map((r) => (
                  <TR key={r.id} onClick={() => setOpenRun(r)}>
                    <TD mono>{r.id}</TD>
                    <TD><SkuToken sku={r.sku} /></TD>
                    <TD><UidChip value={r.packageId} kind="metrc" /></TD>
                    <TD align="right" mono>{r.qty}</TD>
                    <TD align="right" mono style={{ color: r.commissioned < r.qty ? HD.tone(P, 'blocked').fg : P.ink }}>{r.commissioned}</TD>
                    <TD><BarMeter value={r.commissioned} max={r.qty} color={r.commissioned < r.qty ? HD.tone(P, 'blocked').fg : P.ink} /></TD>
                    <TD><HDPill size="sm" tone={r.printed ? 'ok' : 'neutral'} icon={false} label={r.printed ? 'yes' : 'no'} /></TD>
                    <TD>{r.actor}</TD>
                    <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(r.at, D.NOW)}</TD>
                    <TD><HDPill size="sm" tone={r.status === 'collision' ? 'blocked' : 'ok'} style={r.status === 'collision' ? monoStyle(P) : undefined} label={r.status === 'collision' ? '409 collision' : 'ok'} /></TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </window.ScrollX>
        </Card>

        <RunSheet run={openRun} onClose={() => setOpenRun(null)} />
      </div>);
  };

  /* ══════════════════════ REGISTRY ══════════════════════ */

  window.ScreenRegistry = function ScreenRegistry({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const [q, setQ] = React.useState('');
    const [states, setStates] = React.useState([]);
    const [skus, setSkus] = React.useState([]);

    const rows = D.REGISTRY.filter((t) => {
      if (states.length && !states.includes(t.state)) return false;
      if (skus.length && !skus.includes(t.sku)) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return t.epc.toLowerCase().includes(s) || t.retailId.toLowerCase().includes(s) || t.sku.toLowerCase().includes(s) || t.packageId.toLowerCase().includes(s);
    });
    const active = q.trim() || states.length || skus.length;
    const count = (st) => D.REGISTRY.filter((t) => t.state === st).length;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Tag registry"
          sub="Every EPC ↔ retail-ID binding in the estate, and the lifecycle state of the unit behind it. This table is what resolves a scanned EPC to a SKU during reconciliation."
          actions={<PBtn size="sm" variant="secondary" icon="printer" onClick={() => navigate('#/commission')}>Commission tags</PBtn>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="barcode" label="Bindings" value={HD.formatNumber(D.REGISTRY.length)} hue="violet" sub="1:1, enforced at commissioning" />
          <StatTile icon="check-circle" label="Available" value={String(count('AVAILABLE'))} hue="ok" />
          <StatTile icon="truck" label="In motion" value={String(count('ALLOCATED') + count('DISPATCHED') + count('TRANSFER_PENDING'))} hue="info" sub="allocated · dispatched · transfer" />
          <StatTile icon="lock" label="Held or written off" value={String(count('HELD') + count('SOFT_HOLD') + count('DAMAGED') + count('DESTROYED'))} hue="warn" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" aria-label="Search the tag registry" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by EPC, retail ID, SKU or package…" />
          </div>
          <MultiSelectFilter label="State" value={states} onChange={setStates} options={D.STATES.map((s) => ({ id: s, label: s }))} />
          <MultiSelectFilter label="SKU" value={skus} onChange={setSkus} options={D.SKUS.map((s) => ({ id: s.sku, label: s.sku }))} />
          {active ? <button onClick={() => { setQ(''); setStates([]); setSkus([]); }} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button> : null}
        </div>

        <Card padding={0}>
          {rows.length === 0
            ? <EmptyState icon="barcode" title="No bindings match." body="Nothing in the registry matches those filters." action={<PBtn size="sm" variant="secondary" onClick={() => { setQ(''); setStates([]); setSkus([]); }}>Clear all</PBtn>} />
            : <window.ScrollX label="Tag registry table">
              <HDTable>
                <thead><tr style={{ background: P.surface2 }}>
                  <TH>EPC</TH><TH>Retail ID</TH><TH>SKU</TH><TH>METRC package</TH><TH>State</TH><TH>Material</TH><TH align="right">Registered</TH>
                </tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <TR key={t.epc}>
                      <TD><EpcChip value={t.epc} /></TD>
                      <TD mono>{t.retailId}</TD>
                      <TD><SkuToken sku={t.sku} withName /></TD>
                      <TD><UidChip value={t.packageId} kind="metrc" /></TD>
                      <TD><HDPill size="sm" tone={STATE_TONE[t.state]} icon={false} label={t.state} /></TD>
                      <TD><span style={{ fontSize: 12.5, color: P.inkMute }}>{t.material}</span></TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(t.registeredAt, D.NOW)}</TD>
                    </TR>))}
                </tbody>
              </HDTable>
            </window.ScrollX>}
        </Card>

        <div style={{ fontSize: 12.5, color: P.inkMute, lineHeight: 1.5, maxWidth: 780 }}>
          EPCs here are a private closed-loop scheme — 96 bits of scheme · site · serial · entropy, and deliberately <b>not</b> SGTIN-96.
          They carry no product meaning: the SKU lives in this table, so a re-SKU never means re-tagging a physical unit.
          If an outside trading partner ever has to read these, the scheme has to move to SGTIN-96 under a licensed GS1 prefix.
        </div>
      </div>);
  };
})();
