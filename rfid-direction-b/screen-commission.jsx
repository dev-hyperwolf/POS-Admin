// ── #/products/:id — Operations › Products › Batches & traceability ───────
// The batch table already ends in a "Print labels" action — that is where a
// unit first gets an identity it carries onto the shelf. Commissioning is that
// same action, grown a second half: the label is encoded as it is printed, and
// the EPC↔retail-ID binding is born there under a 1:1 rule.
;(function () {
  const useP = window.useP;
  const D = () => window.RFID_DATA;

  // ── Print / commission flow ─────────────────────────────────────────────
  function LabelModal({ open, rfid, batch, onClose }) {
    const P = useP();
    const [step, setStep] = React.useState(1);
    React.useEffect(() => { if (open) setStep(1); }, [open]);
    if (!open || !batch) return null;
    const PR = D().PRINTER;
    const collisions = D().COLLISIONS;
    const willMint = batch.qty - collisions.length;

    const label = (t) => <label style={{ display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, marginBottom: 6 }}>{t}</label>;
    const readonlyField = (v, mono) => (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: P.ctrlH.md, padding: '0 13px', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, fontSize: 13.5, color: P.ink2, fontFamily: mono ? P.fontMono : P.fontSans }}>{v}</div>);

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
        <div style={{ position: 'relative', width: rfid ? 620 : 460, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, boxShadow: P.shadowLg, overflow: 'hidden' }}>

          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>{rfid ? 'Encode & print labels' : 'Print labels'}</h2>
              {rfid && <window.RfidTag label="ENCODE" />}
              <div style={{ flex: 1 }} />
              {rfid && <window.Num size={11.5} color={P.inkMute}>Step {step} of 2</window.Num>}
            </div>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 3 }}>{batch.product} · {batch.qty} units · batch {batch.id}</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {step === 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: rfid ? '1fr 1fr' : '1fr', gap: 14 }}>
                <div>{label('Printer')}{readonlyField(rfid ? PR.name + ' · ' + PR.model : 'ZD621-FOH · Zebra ZD621')}</div>
                <div>{label('Quantity')}<Field mono size="md" value={String(batch.qty)} onChange={() => {}} /></div>
                {rfid && <div>{label('Label stock')}{readonlyField(PR.media)}</div>}
                {rfid && <div>{label('Label size')}{readonlyField(PR.size, true)}</div>}
                {!rfid && <div>{label('Template')}{readonlyField('Retail barcode · 2.00 × 1.00 in')}</div>}
                {rfid && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    {label('EPC scheme')}
                    {readonlyField('Closed-loop 96-bit · prefix E280 · not SGTIN-96', true)}
                    <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 6, lineHeight: 1.5 }}>
                      Private scheme, minted here. Retail IDs come from the batch; each one may hold exactly one EPC,
                      and that rule is enforced now rather than discovered at scan time.
                    </div>
                  </div>)}
                {rfid && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: P.r8, background: P.surface2, border: `1px solid ${P.hairline}` }}>
                    <Icon name="printer" size={16} stroke={1.9} color={P.inkDim} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: P.ink2 }}>Label stock remaining</div>
                      <div style={{ marginTop: 6 }}><BarMeter value={PR.stockRemaining} max={PR.stockTotal} height={6} color={P.info} /></div>
                    </div>
                    <window.Num size={13.5}>{PR.stockRemaining.toLocaleString()} <span style={{ color: P.inkMute }}>/ {PR.stockTotal.toLocaleString()}</span></window.Num>
                  </div>)}
              </div>)}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, padding: 12, borderRadius: P.r8, background: P.goodSoft, border: `1px solid ${P.good}44` }}>
                    <MicroLabel>Will be created</MicroLabel>
                    <div style={{ marginTop: 5 }}><window.Num size={21} weight={600} color={P.good}>{willMint}</window.Num></div>
                    <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3 }}>new EPC ↔ retail-ID bindings</div>
                  </div>
                  <div style={{ flex: 1, padding: 12, borderRadius: P.r8, background: P.badSoft, border: `1px solid ${P.bad}44` }}>
                    <MicroLabel>Refused</MicroLabel>
                    <div style={{ marginTop: 5 }}><window.Num size={21} weight={600} color={P.bad}>{collisions.length}</window.Num></div>
                    <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3 }}>409 COLLISION · already bound</div>
                  </div>
                </div>

                <div>
                  <MicroLabel style={{ marginBottom: 8 }}>Binding preview</MicroLabel>
                  <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r8, overflow: 'hidden' }}>
                    <HDTable>
                      <thead><tr><TH>Retail ID</TH><TH>EPC</TH><TH width={110}>State</TH></tr></thead>
                      <tbody>
                        {D().BATCH_TAG_ROWS.map((r) => (
                          <TR key={r.retailId}>
                            <TD mono style={{ fontSize: 12 }}>{r.retailId}</TD>
                            <TD mono style={{ fontSize: 12, color: P.inkDim }}>{r.epc}</TD>
                            <TD><HDPill tone="ok" size="sm" icon={false} label="New" /></TD>
                          </TR>))}
                        {collisions.map((c) => (
                          <TR key={c.retailId} style={{ background: P.badSoft }}>
                            <TD mono style={{ fontSize: 12 }}>{c.retailId}</TD>
                            <TD mono style={{ fontSize: 12, color: P.inkDim }}>{c.epc}</TD>
                            <TD><HDPill tone="blocked" size="sm" icon={false} label="409" /></TD>
                          </TR>))}
                      </tbody>
                    </HDTable>
                  </div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 8 }}>
                    Showing {D().BATCH_TAG_ROWS.length} of {willMint} new bindings, plus every refusal.
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: P.r8, background: P.surface2, border: `1px solid ${P.hairline}` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, marginBottom: 6 }}>Why two are refused</div>
                  {collisions.map((c) => (
                    <div key={c.auditId} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, color: P.inkDim, padding: '3px 0' }}>
                      <window.Num size={11.5}>{c.retailId}</window.Num>
                      <span>bound {c.boundAt} by {c.boundBy}</span>
                      <div style={{ flex: 1 }} />
                      <window.Num size={11.5} color={P.inkMute}>{c.auditId}</window.Num>
                    </div>))}
                  <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 8, lineHeight: 1.5 }}>
                    A collision is a hard refusal with an audit event, never a silent overwrite. Re-label those two
                    units from the reprint queue instead.
                  </div>
                </div>
              </div>)}
          </div>

          <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <PBtn variant="ghost" onClick={onClose}>Cancel</PBtn>
            {!rfid && <PBtn variant="accent" icon="printer" onClick={() => { onClose(); window.hdToast?.({ title: 'Printing', description: batch.qty + ' barcode labels sent to ZD621-FOH.', tone: 'ok' }); }}>Print {batch.qty} labels</PBtn>}
            {rfid && step === 1 && <PBtn variant="primary" iconRight="chevron-right" onClick={() => setStep(2)}>Review bindings</PBtn>}
            {rfid && step === 2 && <PBtn variant="secondary" icon="chevron-left" onClick={() => setStep(1)}>Back</PBtn>}
            {rfid && step === 2 && <PBtn variant="accent" icon="printer" onClick={() => { onClose(); window.hdToast?.({ title: 'Encoding and printing', description: willMint + ' tags on ' + PR.name + ' · 2 refused (409).', tone: 'ok' }); }}>Encode & print {willMint}</PBtn>}
          </div>
        </div>
      </div>);
  }

  // ── Batch table ─────────────────────────────────────────────────────────
  function BatchTable({ rfid, onPrint }) {
    const P = useP(), HD = window.HD;
    return (
      <div style={{ overflowX: 'auto' }}>
        <HDTable>
          <thead>
            <tr>
              <TH>METRC package</TH>
              <TH width={90}>Received</TH>
              <TH align="right" width={70}>Qty</TH>
              <TH align="right" width={96}>Unit cost</TH>
              <TH width={80}>COA</TH>
              {rfid && <TH width={148}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Tags <window.RfidTag label="NEW" /></span></TH>}
              <TH align="right" width={rfid ? 150 : 130} />
            </tr>
          </thead>
          <tbody>
            {D().BATCHES.map((b) => {
              const tagged = b.tagged >= b.qty;
              return (
                <TR key={b.id}>
                  <TD><UidChip value={b.metrc} /></TD>
                  <TD style={{ fontSize: 12.5, color: P.inkDim }}>{b.received}</TD>
                  <TD align="right" mono>{b.qty}</TD>
                  <TD align="right" mono>{HD.formatCurrency(b.unitCost)}</TD>
                  <TD><HDPill tone="ok" size="sm" icon={false} label="Passed" /></TD>
                  {rfid && (
                    <TD>
                      {tagged
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <HDPill tone="ok" size="sm" icon={false} label="Commissioned" />
                            <window.Num size={11.5} color={P.inkMute}>{b.tagged}/{b.qty}</window.Num>
                          </span>
                        : <HDPill tone="warn" size="sm" icon={false} label="Not tagged" />}
                    </TD>)}
                  <TD align="right">
                    {rfid
                      ? tagged
                        ? <PBtn size="xs" variant="ghost" icon="printer" onClick={() => onPrint(b)}>Reprint</PBtn>
                        : <PBtn size="xs" variant="secondary" icon="zap" onClick={() => onPrint(b)}>Encode & print</PBtn>
                      : <PBtn size="xs" variant="secondary" icon="printer" onClick={() => onPrint(b)}>Print labels</PBtn>}
                  </TD>
                </TR>);
            })}
          </tbody>
        </HDTable>
      </div>);
  }

  // ── Screen ──────────────────────────────────────────────────────────────
  window.RfidScreenCommission = function RfidScreenCommission({ rfid, app }) {
    const P = useP(), HD = window.HD;
    const PR = D().PRINTER;
    const item = D().bySku['FLW-3.5-BLUEDREAM'];
    const batches = D().BATCHES;
    const [modal, setModal] = React.useState(null);
    const totalUnits = batches.reduce((n, b) => n + b.qty, 0);
    const taggedUnits = batches.reduce((n, b) => n + b.tagged, 0);

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <window.RfidPageHead app={app} rfid={rfid} title={item.name}
          sub={rfid
            ? 'Three batches of this product. Printing a label and creating the tag binding are now one step, so a unit is never on the shelf with a barcode the system cannot read back.'
            : 'Three batches of this product. Labels are printed per batch from the row action below.'}
          meta={[
            <span key="b" style={{ fontSize: 12.5, color: P.inkMute }}>{item.brand}</span>,
            <span key="d" style={{ fontSize: 12.5, color: P.inkMute }}>·</span>,
            <window.Num key="s" size={12.5} color={P.inkDim}>{item.sku}</window.Num>,
            <StrainPill key="p" type={item.strain} thc={item.thc} />,
          ]}
          action={
            <React.Fragment>
              <PBtn size="sm" variant="secondary" icon="plus">Add batch</PBtn>
              {rfid
                ? <PBtn size="sm" variant="accent" icon="zap" onClick={() => setModal(batches[0])}>Encode & print labels</PBtn>
                : <PBtn size="sm" variant="accent" icon="printer" onClick={() => setModal(batches[0])}>Print labels</PBtn>}
            </React.Fragment>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <StatTile icon="box" label="Batches" value={String(batches.length)} hue="blue" />
          <StatTile icon="package" label="Units on hand" value={String(totalUnits)} hue="teal" />
          <StatTile icon="dollar" label="Value at cost" value={HD.formatCurrency(batches.reduce((n, b) => n + b.qty * b.unitCost, 0), { showCents: false })} hue="green" />
          {rfid
            ? <React.Fragment>
                <StatTile icon="zap" label="Units tagged" value={taggedUnits + ' / ' + totalUnits} hue={taggedUnits === totalUnits ? 'ok' : 'warn'} progress={taggedUnits / totalUnits} sub="1 batch awaiting commissioning" />
                <StatTile icon="printer" label="Label stock" value={PR.stockRemaining.toLocaleString()} hue="info" progress={PR.stockRemaining / PR.stockTotal} sub={'of ' + PR.stockTotal.toLocaleString() + ' · ' + PR.name} />
              </React.Fragment>
            : <StatTile icon="printer" label="Label runs, 30d" value="14" hue="neutral" sub="barcode only" />}
        </div>

        <div className="hd-2col">
          <window.RfidPanel pad={0} title="Batches & traceability"
            sub={rfid ? 'The same table, one column wider. Everything left of Tags is untouched.' : 'Per-lot cost, COA state and label printing.'}>
            <BatchTable rfid={rfid} onPrint={setModal} />
          </window.RfidPanel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <window.RfidPanel title="Product information">
              {[['Brand', item.brand], ['SKU', item.sku], ['Category', item.cat.charAt(0).toUpperCase() + item.cat.slice(1)], ['Strain', item.strain + ' · ' + item.thc + '% THC'], ['Supplier licence', 'C11-0000418-LIC']].map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                  <span style={{ fontSize: 12.5, color: P.inkMute, width: 118, flex: '0 0 auto' }}>{k}</span>
                  <span style={{ fontSize: 13, color: P.ink, fontFamily: k === 'SKU' || k === 'Supplier licence' ? P.fontMono : P.fontSans }}>{v}</span>
                </div>))}
            </window.RfidPanel>

            {rfid
              ? <React.Fragment>
                  <window.RfidPanel isNew title="Tag bindings" sub="EPC ↔ retail ID, one to one">
                    <div style={{ fontSize: 13, color: P.inkDim, lineHeight: 1.6 }}>
                      A binding is born at the printer, not discovered at scan time. Every retail ID may hold exactly one
                      EPC; a second attempt is refused with a <window.Num size={12.5}>409</window.Num> and an audit event
                      rather than overwriting the first.
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <div style={{ flex: 1, padding: 10, borderRadius: P.r8, background: P.surface2 }}>
                        <MicroLabel>Bound</MicroLabel>
                        <div style={{ marginTop: 4 }}><window.Num size={21} weight={600}>{taggedUnits}</window.Num></div>
                      </div>
                      <div style={{ flex: 1, padding: 10, borderRadius: P.r8, background: P.surface2 }}>
                        <MicroLabel>Collisions, 30d</MicroLabel>
                        <div style={{ marginTop: 4 }}><window.Num size={21} weight={600} color={P.bad}>{D().COLLISIONS.length}</window.Num></div>
                      </div>
                    </div>
                  </window.RfidPanel>
                  <window.RfidPanel isNew title="Printer" sub={PR.model}>
                    {[['Name', PR.name], ['Media', PR.media], ['Label size', PR.size], ['Last calibrated', PR.lastCalibrated]].map(([k, v], i) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                        <span style={{ fontSize: 12.5, color: P.inkMute, width: 118, flex: '0 0 auto' }}>{k}</span>
                        <span style={{ fontSize: 13, color: P.ink }}>{v}</span>
                      </div>))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}>
                      <HDPill tone="ok" size="sm" label="Ready" />
                      <div style={{ flex: 1 }} />
                      <PBtn size="xs" variant="ghost" icon="scan" onClick={() => window.hdToast?.({ title: 'Test label queued', description: 'Print one, then read it back on the TC22R.', tone: 'info' })}>Print test label</PBtn>
                    </div>
                  </window.RfidPanel>
                </React.Fragment>
              : <window.RfidPanel title="Labels today">
                  <div style={{ fontSize: 13, color: P.inkDim, lineHeight: 1.6 }}>
                    Labels carry a printed barcode and nothing else. A unit can be identified when somebody points a
                    scanner at it, one at a time, with line of sight — which is why the kit count and the room count
                    are both hand work.
                  </div>
                </window.RfidPanel>}
          </div>
        </div>

        <LabelModal open={!!modal} rfid={rfid} batch={modal} onClose={() => setModal(null)} />
      </div>);
  };
})();
