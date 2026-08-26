// ── #/devices, #/audit, #/settings — the hardware, the record, the knobs ──
;(function () {
  const useP = window.useP;

  /* ══════════════════════ DEVICES ══════════════════════ */

  window.ScreenDevices = function ScreenDevices({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const r = D.DEVICES.reader, pr = D.DEVICES.printer;
    const battTone = r.battery > 40 ? 'ok' : r.battery > 15 ? 'warn' : 'blocked';

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Devices"
          sub="One handheld and one printer. Everything in this console runs through them, so their state is a first-class screen rather than a footnote in settings."
          actions={<PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=kit')}>Open the handheld</PBtn>} />

        <Callout tone="warn" icon="alert" title="The Android bridge is a contract, not a verified integration">
          A browser cannot reach the UHF radio and — more decisively — cannot set RF power, which is why a thin Android WebView shell owns the Zebra SDK and streams reads into this page.
          That shell is not written yet. Two of its promises are load-bearing and still unconfirmed on real hardware: that <b>every read carries an RSSI</b>, and that <b>RF power is settable programmatically</b>.
        </Callout>

        <div className="hd-2col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title={`${r.id} — ${r.model}`}
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
                <KV label="Firmware" value={r.firmware} />
                <KV label="Screen" value={r.screen} />
                <KV label="Transport" value={`${r.connection} · ${r.bridge}`} mono={false} />
                <KV label="Last read" value={HD.relativeTime(r.lastRead, D.NOW)} />
              </div>
            </Card>

            <Card>
              <CardHead title={`${pr.id} — ${pr.model}`}
                sub="Driven directly by the commissioning run. Labels are only sent once every binding is durable."
                right={<HDPill tone="ok" label="online" />} />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                <MicroLabel>Label stock</MicroLabel>
                <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{HD.formatNumber(pr.stockRemaining)} / {HD.formatNumber(pr.stockTotal)}</span>
              </div>
              <BarMeter value={pr.stockRemaining} max={pr.stockTotal} color={P.ink} height={8} />
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                <MicroLabel>Ribbon</MicroLabel>
                <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.round(pr.ribbonRemaining * 100)}%</span>
              </div>
              <BarMeter value={pr.ribbonRemaining} max={1} color={P.ink} height={8} />
              <div style={{ marginTop: 16 }}>
                <KV label="Media" value={pr.media} mono={false} />
                <KV label="Darkness · speed" value={`${pr.darkness} · ${pr.speed} ips`} />
                <KV label="Head temp" value={`${pr.headTemp}°C`} />
                <KV label="Calibrated" value={HD.relativeTime(pr.lastCalibration, D.NOW)} />
                <KV label="Last print" value={HD.relativeTime(pr.lastPrint, D.NOW)} />
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
              <CardHead title="Confidence gate" sub="The safety property of the whole module."
                right={dec.gate != null ? <HDPill size="sm" tone="warn" label="overridden" /> : null} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 30, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{dec.gateValue}</span>
                <span style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.inkMute }}>dBm</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                If a tag's strongest read is below this, the module does not know where it is. It goes to rescan: no location asserted, no move suggested, no count.
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}>
                <KV label="Default" value={`${D.CONFIDENCE_THRESHOLD} dBm`} />
                <KV label="Cycle-count pass bar" value={`${(D.ROOM_PASS_COVERAGE * 100).toFixed(0)}%`} />
                <KV label="Overrides" value="audit-logged, per session" mono={false} />
              </div>
              <div style={{ marginTop: 14 }}>
                <Callout tone="warn" icon="flag" title="Simulation-validated only">
                  Both the gate and the reduced-power setpoint were tuned against a simulator. Calibrate them on a real TC22R against real product before rollout — a silently loosened gate turns neighbour bleed back into asserted locations.
                </Callout>
              </div>
              <div style={{ marginTop: 12 }}>
                <PBtn size="sm" variant="secondary" icon="sliders" full onClick={() => navigate('#/settings')}>Change it in Settings</PBtn>
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

            <Card>
              <CardHead title="On the floor now" sub="Two operators, one reader — they take turns." />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {D.OPERATORS.map((o, i) => (
                  <li key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                    <Avatar name={o.name} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: P.ink }}>{o.name}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute }}>{o.task}</div>
                    </div>
                    <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim, fontVariantNumeric: 'tabular-nums' }}>{o.device}</span>
                  </li>))}
              </ul>
            </Card>
          </div>
        </div>
      </div>);
  };

  /* ══════════════════════ AUDIT ══════════════════════ */

  window.ScreenAudit = function ScreenAudit({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const [q, setQ] = React.useState('');
    const [actions, setActions] = React.useState([]);
    const all = React.useMemo(() => dec.events.concat(D.AUDIT), [dec.events]);
    const allActions = [...new Set(all.map((a) => a.action))];
    const rows = all.filter((a) => {
      if (actions.length && !actions.includes(a.action)) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return a.action.toLowerCase().includes(s) || a.subject.toLowerCase().includes(s) || a.detail.toLowerCase().includes(s) || a.actor.toLowerCase().includes(s);
    });
    const rejected = all.filter((a) => a.tone === 'blocked').length;
    const overrides = all.filter((a) => a.action === 'GATE_OVERRIDE').length;
    const decisions = dec.events.length;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Audit log"
          sub="Every state-changing operation in the module writes here — including the ones that were refused. Nothing is deleted, and a rejection is as much a record as a success."
          actions={<PBtn size="sm" variant="secondary" icon="download" onClick={() => window.hdToast && window.hdToast({ title: 'Audit export queued', description: `${rows.length} events · CSV`, tone: 'ok' })}>Export</PBtn>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="activity" label="Events (24h)" value={String(all.length)} hue="blue" />
          <StatTile icon="shield" label="Your decisions" value={String(decisions)} hue={decisions ? 'info' : 'ok'} sub="approvals, write-offs, rebinds" />
          <StatTile icon="ban" label="Rejections" value={String(rejected)} hue={rejected ? 'blocked' : 'ok'} sub="collisions, refused writes" />
          <StatTile icon="sliders" label="Gate overrides" value={String(overrides)} hue={overrides ? 'warn' : 'ok'} sub="non-default confidence gate" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" aria-label="Search audit events" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions, subjects, actors…" />
          </div>
          <MultiSelectFilter label="Action" value={actions} onChange={setActions} options={allActions.map((a) => ({ id: a, label: a }))} />
          {(q.trim() || actions.length) ? <button onClick={() => { setQ(''); setActions([]); }} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button> : null}
        </div>

        <Card padding={0}>
          {rows.length === 0
            ? <EmptyState icon="activity" title="No events match." body="Nothing in the last 24 hours matches those filters." action={<PBtn size="sm" variant="secondary" onClick={() => { setQ(''); setActions([]); }}>Clear all</PBtn>} />
            : <window.ScrollX label="Audit events table">
              <HDTable>
                <thead><tr style={{ background: P.surface2 }}>
                  <TH width={140}>When</TH><TH width={120}>Actor</TH><TH width={250}>Action</TH><TH width={210}>Subject</TH><TH>Detail</TH>
                </tr></thead>
                <tbody>
                  {rows.map((a, i) => {
                    const c = HD.tone(P, a.tone);
                    return (
                      <TR key={a.at + a.action + i}>
                        <TD mono style={{ color: P.inkDim, whiteSpace: 'nowrap' }}>{HD.formatDateTime(a.at)}</TD>
                        <TD>
                          {a.actor}
                          {a.live && <span style={{ marginLeft: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: HD.tone(P, 'info').fg }}>this session</span>}
                        </TD>
                        <TD>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: c.fg, flex: '0 0 auto' }} />
                            <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{a.action}</span>
                          </span>
                        </TD>
                        <TD mono style={{ color: P.ink2 }}>{a.subject}</TD>
                        <TD style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{a.detail}</TD>
                      </TR>);
                  })}
                </tbody>
              </HDTable>
            </window.ScrollX>}
        </Card>
      </div>);
  };

  /* ══════════════════════ SETTINGS ══════════════════════ */

  // What the drafted gate would actually DO, computed by re-running the engine at that
  // value over the same reads. This card previously changed a number and nothing else,
  // which is the estate's defining bug shape: a control that looks like it works.
  function GateConsequence({ draft, valid }) {
    const P = window.useP();
    const D = window.RFID_DATA;
    const dec = window.useDecisions();
    const at = React.useMemo(() => {
      if (!valid) return null;
      return D.reconcileKit(D.KIT_READS, (e) => D.SKU_OF.get(e), D.KIT_PLAN, draft);
    }, [draft, valid]);
    if (!at) return null;
    const base = dec.baseline;
    const rows = [
      ['tags in rescan', at.rescan.length, base.rescan.length],
      ['short lines', at.short.length, base.short.length],
      ['excess lines', at.excess.length, base.excess.length],
      ['wrong-product lines', at.wrongProduct.length, base.wrongProduct.length],
      ['move lines', at.moves.length, base.moves.length],
    ];
    const moved = rows.some(([, a, b]) => a !== b);
    return (
      <div style={{ marginTop: 14, padding: '12px 14px', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 10 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: P.inkMute, marginBottom: 8 }}>
          At <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{draft}</span> dBm, this session reconciles as
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(132px,1fr))', gap: 10 }}>
          {rows.map(([label, a, b]) => (
            <div key={label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 19, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{a}</span>
                {a !== b && (
                  <span style={{ fontFamily: P.fontMono, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: a > b ? P.warn : P.good }}>
                    {a > b ? '+' : ''}{a - b}
                  </span>)}
              </div>
              <div style={{ fontSize: 11, color: P.inkMute }}>{label}</div>
            </div>))}
        </div>
        <div style={{ marginTop: 9, fontSize: 11.5, color: P.inkMute, lineHeight: 1.45 }}>
          {moved
            ? 'Recomputed from the same reads. The audit log is not rewritten — it records what was decided at the gate in force at the time.'
            : 'No line changes at this value on this session. The gate still governs what may be asserted.'}
        </div>
      </div>);
  }

  window.ScreenSettings = function ScreenSettings({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const [draft, setDraft] = React.useState(String(D.CONFIDENCE_THRESHOLD));
    const [modal, setModal] = React.useState(false);
    React.useEffect(() => { setDraft(String(dec.gateValue)); }, [dec.gateValue]);
    const next = Number(draft);
    const valid = Number.isFinite(next) && next <= -40 && next >= -80;
    const changed = valid && next !== dec.gateValue;
    const looser = valid && next < D.CONFIDENCE_THRESHOLD;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Settings"
          sub="Two numbers decide what this module is willing to assert. Both are supervisor-owned, both are audit-logged, and neither can be changed from the handheld."
          actions={<PBtn size="sm" variant="secondary" icon="activity" onClick={() => navigate('#/audit')}>Audit log</PBtn>} />

        <div className="hd-2col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title="Confidence gate"
                sub="A tag whose strongest read is below this gets no box, no move and no count. It is the one property that keeps neighbour bleed out of the numbers."
                right={dec.gate != null ? <HDPill size="sm" tone="warn" label="overridden" /> : <HDPill size="sm" tone="ok" icon={false} label="default" />} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'end' }}>
                <FormRow label="Gate (dBm)" hint="Range −80 to −40. Lower is looser: it accepts weaker reads and asserts more locations.">
                  <Field size="md" mono aria-label="Confidence gate in dBm" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9-]/g, ''))} placeholder="-62" />
                </FormRow>
                <div>
                  <MicroLabel>Currently in force</MicroLabel>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: P.fontMono, fontSize: 30, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{dec.gateValue}</span>
                    <span style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.inkMute }}>dBm</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11.5, color: P.inkMute }}>
                    default <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{D.CONFIDENCE_THRESHOLD}</span> dBm
                  </div>
                </div>
              </div>
              {!valid && draft !== '' && (
                <div style={{ marginTop: 12 }}>
                  <Callout tone="blocked" icon="alert" title="Out of range">
                    A gate outside −80…−40 dBm is not a calibration, it is a mistake. −80 accepts almost everything; −40 rejects almost everything.
                  </Callout>
                </div>)}
              {changed && looser && (
                <div style={{ marginTop: 12 }}>
                  <Callout tone="warn" icon="flag" title="This loosens the gate">
                    At <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{next}</span> dBm the module will start asserting boxes for reads it currently refuses to place.
                    Neighbour bleed sits between <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>−63</span> and <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>−84</span> dBm in simulation — a looser gate turns some of that back into a location.
                  </Callout>
                </div>)}
              <GateConsequence draft={next} valid={valid} />
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: P.inkMute }}>Changing this writes a <span style={{ fontFamily: P.fontMono }}>GATE_OVERRIDE</span> event with your reason.</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {dec.gate != null && (
                    <PBtn size="sm" variant="ghost" onClick={() => setDraft(String(D.CONFIDENCE_THRESHOLD))}>Restore default</PBtn>)}
                  <PBtn size="sm" variant="secondary" icon="sliders" disabled={!changed} onClick={() => setModal(true)}>Change the gate…</PBtn>
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="Cycle-count pass bar" sub="Coverage at or above this is a PASS. It is not editable in the pilot — the number came out of a simulation and moving it before hardware calibration would only hide a miscount." />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 30, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{(D.ROOM_PASS_COVERAGE * 100).toFixed(1)}</span>
                <span style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.inkMute }}>%</span>
                <HDPill size="sm" tone="neutral" icon={false} label="locked for the pilot" style={{ marginLeft: 8 }} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Callout tone="info" icon="info" title="A PASS is a trading decision, not an accounting one">
                  It clears a room to keep selling. It does not write anything off — that stays a per-unit supervisor decision on the count screen.
                </Callout>
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title="Who may change what" sub="The same table the handheld screen renders. It is here because a settings page is exactly where the line gets crossed." />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {D.DECISION_RIGHTS.map((r, i) => (
                  <li key={r.decision} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                    <HDPill size="sm" icon={false} tone={r.owner === 'Supervisor' ? 'info' : r.owner === 'Handheld' ? 'neutral' : 'ok'} label={r.owner} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: P.ink2 }}>{r.decision}</span>
                  </li>))}
              </ul>
            </Card>

            <Card>
              <CardHead title="Module defaults" />
              <KV label="EPC scheme" value="closed-loop 96-bit" mono={false} />
              <KV label="Scheme id · site" value="01 · 0A" />
              <KV label="Mint retries" value="5" />
              <KV label="Idempotency" value="every POST carries a key" mono={false} />
              <KV label="Tag material" value="paper only" mono={false} />
              <KV label="Reader adapter" value="Zebra TC22R via WebView bridge" mono={false} />
            </Card>

            <Card>
              <CardHead title="Reset this prototype" sub="Clears the decisions made in this session — the kit approval, any write-offs, the binding resolution and any gate override." />
              <PBtn size="sm" variant="secondary" icon="refresh" full onClick={() => { dec.reset(); window.hdToast && window.hdToast({ title: 'Session decisions cleared', description: 'The kit is back to awaiting approval.', tone: 'info' }); }}>Reset decisions</PBtn>
            </Card>
          </div>
        </div>

        <ReasonModal open={modal} onClose={() => setModal(false)}
          title="Change the confidence gate" tone="warn" confirmLabel="Apply the override"
          placeholder="e.g. calibrating against real product in Vault A with M. Reyes; reverting at end of shift"
          body={<React.Fragment>
            The gate moves from <b><Mono>{dec.gateValue}</Mono></b> dBm to <b><Mono>{next}</Mono></b> dBm for every session in this module.
            {looser
              ? ' A looser gate asserts more locations from weaker reads — including some that are neighbour bleed.'
              : ' A tighter gate sends more tags to rescan and asserts fewer locations.'}
            {' '}It is written to the audit log as a <b>GATE_OVERRIDE</b> against your name, and the handheld will show the new value in its status bar.
          </React.Fragment>}
          onConfirm={(reason) => { dec.setGate(next, reason); window.hdToast && window.hdToast({ title: 'Gate changed', description: `Now ${next} dBm — logged as a GATE_OVERRIDE.`, tone: 'warn' }); }} />
      </div>);
  };
})();
