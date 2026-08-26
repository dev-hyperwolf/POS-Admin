// ── #/devices and #/audit — the hardware, and everything it wrote ────────
;(function () {
  const useP = window.useP;

  // RF power scale. The setpoint is deliberately at the low end: reduced power
  // is half of why argmax can isolate one box, so the screen shows where in the
  // range we actually sit rather than just printing a number.
  function PowerScale({ value, min, max }) {
    const P = useP();
    const pct = (value - min) / (max - min) * 100;
    return (
      <div>
        <div style={{ position: 'relative', height: 8, borderRadius: 99, background: P.surface3, marginTop: 6 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: P.ink, borderRadius: 99 }} />
          <div style={{ position: 'absolute', left: `${pct}%`, top: -4, width: 3, height: 16, background: P.ink, borderRadius: 99, transform: 'translateX(-1.5px)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, fontVariantNumeric: 'tabular-nums' }}>
          <span>{min} dBm</span><span style={{ color: P.ink }}>{value} dBm · reduced</span><span>{max} dBm</span>
        </div>
      </div>);
  }

  window.ScreenDevices = function ScreenDevices({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const r = D.DEVICES.reader, pr = D.DEVICES.printer;
    const battTone = r.battery > 40 ? 'ok' : r.battery > 15 ? 'warn' : 'blocked';

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Devices"
          sub="One handheld and one printer. Everything in this console runs through them, so their state is a first-class screen rather than a footnote in settings." />

        <Callout tone="warn" icon="alert" title="The Android bridge is a contract, not a verified integration">
          A browser cannot reach the UHF radio and — more decisively — cannot set RF power, which is why a thin Android WebView shell owns the Zebra SDK and streams reads into this page.
          That shell is not written yet. Two of its promises are load-bearing and still unconfirmed on real hardware: that <b>every read carries an RSSI</b>, and that <b>RF power is settable programmatically</b>.
        </Callout>

        <div className="hd-2col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title="TC22R-01 — Zebra TC22R integrated handheld"
                sub="Android, on-board UHF, built-in screen. One device: no sled, no pairing, no second battery."
                right={<HDPill tone="ok" label="on the bridge" />} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 20 }}>
                <div>
                  <MicroLabel>RF power setpoint</MicroLabel>
                  <PowerScale value={r.rfPower} min={r.rfMin} max={r.rfMax} />
                  <div style={{ marginTop: 9, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                    Push this up and neighbour bleed climbs far faster than the wanted read does. That asymmetry is the reason for running low.
                  </div>
                </div>
                <div>
                  <MicroLabel>Battery</MicroLabel>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                    <span style={{ fontFamily: P.fontMono, fontSize: 21, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{r.battery}%</span>
                    <HDPill size="sm" tone={battTone} icon={false} label={r.battery > 40 ? 'healthy' : 'charge soon'} />
                  </div>
                  <div style={{ marginTop: 10 }}><BarMeter value={r.battery} max={100} color={HD.tone(P, battTone).fg} height={8} /></div>
                  <div style={{ marginTop: 9, fontSize: 12.5, color: P.inkDim }}>One charge cradle, one battery. A dead handheld is a stopped packing line.</div>
                </div>
              </div>
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${P.hairline}` }}>
                <KV label="Model" value={r.model} mono={false} />
                <KV label="OS" value={r.os} mono={false} />
                <KV label="Transport" value={`${r.connection} · ${r.bridge}`} mono={false} />
                <KV label="Last read" value={HD.relativeTime(r.lastRead, D.NOW)} mono={false} />
              </div>
            </Card>

            <Card>
              <CardHead title="ZT411-01 — Zebra ZT411 RFID printer"
                sub="Driven directly by the commissioning run. Labels are only sent once every binding is durable."
                right={<HDPill tone="ok" label="online" />} />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                <MicroLabel>Label stock</MicroLabel>
                <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{HD.formatNumber(pr.stockRemaining)} / {HD.formatNumber(pr.stockTotal)}</span>
              </div>
              <BarMeter value={pr.stockRemaining} max={pr.stockTotal} color={P.ink} height={8} />
              <div style={{ marginTop: 16 }}>
                <KV label="Media" value={pr.media} mono={false} />
                <KV label="Last print" value={HD.relativeTime(pr.lastPrint, D.NOW)} mono={false} />
                <KV label="Stock type" value="paper only — no on-metal purchased" mono={false} />
              </div>
              <div style={{ marginTop: 14 }}>
                <PBtn size="sm" variant="secondary" icon="printer" onClick={() => navigate('#/commission')}>Open commissioning</PBtn>
              </div>
            </Card>

            <Card>
              <CardHead title="Why the reads come through a native shell"
                sub="The operator UI is a web app in a WebView. The radio is not." />
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: P.inkDim, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>The shell owns the Zebra SDK and does four things: connect, set power, stream reads, report battery. It is small on purpose, because it is the piece that needs a device to ship.</li>
                <li>Everything that changes weekly — these screens — is web, and updates without touching a device.</li>
                <li>DataWedge cannot carry this design: it delivers barcode-shaped values and guarantees neither per-read RSSI nor programmatic power control.</li>
                <li>Only the reader adapter is hardware-aware. Nothing above it names a vendor, so a different reader is a swap rather than a rewrite.</li>
              </ol>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title="Confidence gate" sub="The safety property of the whole module." />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 30, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{D.CONFIDENCE_THRESHOLD}</span>
                <span style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.inkMute }}>dBm</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                If a tag's strongest read is below this, the module does not know where it is. It goes to rescan: no location asserted, no move suggested, no count.
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}>
                <KV label="Cycle-count pass bar" value={`${(D.ROOM_PASS_COVERAGE * 100).toFixed(0)}%`} />
                <KV label="Overrides" value="audit-logged, per session" mono={false} />
              </div>
              <div style={{ marginTop: 14 }}>
                <Callout tone="warn" icon="flag" title="Simulation-validated only">
                  Both the gate and the reduced-power setpoint were tuned against a simulator. Calibrate them on a real TC22R against real product before rollout — a silently loosened gate turns neighbour bleed back into asserted locations.
                </Callout>
              </div>
            </Card>

            <Card>
              <CardHead title="Not yet verified on hardware" sub="Five things this console currently takes on faith. They are on screen because pretending otherwise is how a pilot ships broken." />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {D.DEVICES.unverified.map((u, i) => (
                  <li key={u.id} style={{ display: 'flex', gap: 10, padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                    <span style={{ color: HD.tone(P, 'warn').fg, flex: '0 0 auto', marginTop: 1 }}><Icon name="alert" size={14} stroke={2} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: P.ink }}>{u.label}</div>
                      <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>{u.note}</div>
                    </div>
                  </li>))}
              </ul>
            </Card>

            <Card>
              <CardHead title="Fleet" />
              <KV label="Handheld readers" value="1" />
              <KV label="Charge cradles" value="1" />
              <KV label="RFID printers" value="1" />
              <KV label="Label stock purchased" value={HD.formatNumber(pr.stockTotal)} />
              <KV label="Fixed / portal readers" value="none — cancelled" mono={false} />
              <div style={{ marginTop: 12, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
                Box-by-box verification works fine with one reader. The multi-operator cycle count does not — it is designed and simulated, and stays unvalidated until a second unit exists.
              </div>
            </Card>
          </div>
        </div>
      </div>);
  };

  /* ══════════════════════ AUDIT ══════════════════════ */

  window.ScreenAudit = function ScreenAudit({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const [q, setQ] = React.useState('');
    const [actions, setActions] = React.useState([]);
    const allActions = [...new Set(D.AUDIT.map((a) => a.action))];
    const rows = D.AUDIT.filter((a) => {
      if (actions.length && !actions.includes(a.action)) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return a.action.toLowerCase().includes(s) || a.subject.toLowerCase().includes(s) || a.detail.toLowerCase().includes(s) || a.actor.toLowerCase().includes(s);
    });
    const rejected = D.AUDIT.filter((a) => a.tone === 'blocked').length;
    const overrides = D.AUDIT.filter((a) => a.action === 'GATE_OVERRIDE').length;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Audit log"
          sub="Every state-changing operation in the module writes here — including the ones that were refused. Nothing is deleted, and a rejection is as much a record as a success."
          actions={<PBtn size="sm" variant="secondary" icon="download" onClick={() => window.hdToast && window.hdToast({ title: 'Audit export queued', description: `${rows.length} events · CSV`, tone: 'ok' })}>Export</PBtn>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="activity" label="Events (24h)" value={String(D.AUDIT.length)} hue="blue" />
          <StatTile icon="ban" label="Rejections" value={String(rejected)} hue={rejected ? 'blocked' : 'ok'} sub="collisions, refused writes" />
          <StatTile icon="sliders" label="Gate overrides" value={String(overrides)} hue={overrides ? 'warn' : 'ok'} sub="non-default confidence gate" />
          <StatTile icon="lock" label="Idempotency" value="on" hue="ok" sub="every POST carries a key" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions, subjects, actors…" />
          </div>
          <MultiSelectFilter label="Action" value={actions} onChange={setActions} options={allActions.map((a) => ({ id: a, label: a }))} />
          {(q.trim() || actions.length) ? <button onClick={() => { setQ(''); setActions([]); }} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button> : null}
        </div>

        <Card padding={0}>
          {rows.length === 0
            ? <EmptyState icon="activity" title="No events match." body="Nothing in the last 24 hours matches those filters." action={<PBtn size="sm" variant="secondary" onClick={() => { setQ(''); setActions([]); }}>Clear all</PBtn>} />
            : <div style={{ overflowX: 'auto' }}>
              <HDTable>
                <thead><tr style={{ background: P.surface2 }}>
                  <TH width={132}>When</TH><TH width={110}>Actor</TH><TH width={250}>Action</TH><TH width={210}>Subject</TH><TH>Detail</TH>
                </tr></thead>
                <tbody>
                  {rows.map((a) => {
                    const c = HD.tone(P, a.tone);
                    return (
                      <TR key={a.at + a.action}>
                        <TD mono style={{ color: P.inkDim, whiteSpace: 'nowrap' }}>{HD.formatDateTime(a.at)}</TD>
                        <TD>{a.actor}</TD>
                        <TD>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: c.fg, flex: '0 0 auto' }} />
                            <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{a.action}</span>
                          </span>
                        </TD>
                        <TD mono style={{ color: P.ink2 }}>{a.subject}</TD>
                        <TD style={{ fontSize: 12.5, color: P.inkDim }}>{a.detail}</TD>
                      </TR>);
                  })}
                </tbody>
              </HDTable>
            </div>}
        </Card>
      </div>);
  };
})();
