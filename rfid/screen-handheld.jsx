// ── #/handheld — the device, and how it relates to this console ──────────
// Direction C's argument, kept structural rather than decorative: the handheld
// is not a preview of the desktop, it is the other half of one session. This
// screen puts the TC22R next to the read path and the decision-rights table so
// the relationship is visible instead of asserted.
//
// Route shape: #/handheld?flow=kit|count|tags|map
;(function () {
  const useP = window.useP;
  const D = () => window.RFID_DATA;

  const FLOWS = [
    { id: 'kit', label: 'Kit verification' },
    { id: 'count', label: 'Cycle count' },
    { id: 'tags', label: 'Tag commissioning' },
    { id: 'map', label: 'How the two connect' },
  ];

  /* ══════════════════════ THE DEVICE PANE ══════════════════════ */

  function HandheldPane({ flow }) {
    const P = useP();
    const set = window.RFID_HH[flow];
    const [screen, setScreen] = React.useState(set.order[0]);
    React.useEffect(() => { setScreen(window.RFID_HH[flow].order[0]); }, [flow]);
    const cur = set.screens[screen] ? screen : set.order[0];
    const idx = set.order.indexOf(cur);
    const scanning = (flow === 'kit' && cur === 'scan') || (flow === 'count' && cur === 'walk');
    const go = (id) => setScreen(id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {/* The device stage. NOT bg2 any more.
            bg2 was the honest choice while it was a distinct ground, but the
            ramps were unified: measured in dark, bg2 is 1.02:1 against bg —
            the fill contributes nothing at all — and its hairline2 edge is
            1.41:1, which is why this was the module's weakest separation.
            surface3 (the "well" token) + hairline3 measures 1.28:1 fill and
            2.87:1 edge in dark, and 1.75:1 edge in light. That is the strongest
            combination the token set can express for a recessed panel, and it
            still reads as a well rather than a card. */}
        <div style={{ background: P.surface3, border: `1px solid ${P.hairline3}`, borderRadius: P.r14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'stretch' }}>
            <MicroLabel>Zebra TC22R · what the floor sees</MicroLabel>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {set.order.length}</span>
          </div>
          <window.TCDevice scanning={scanning} onTrigger={() => setScreen(set.order[Math.min(set.order.length - 1, idx + 1)])}>
            {set.screens[cur].render({ go })}
          </window.TCDevice>
          {/* Pressing a screen-index button swapped the device viewport and
              announced nothing — the only feedback was the button's own
              aria-pressed, which does not say what is now on the device. */}
          <window.SrOnly live="polite">Handheld screen {idx + 1} of {set.order.length}: {set.screens[cur].label}</window.SrOnly>
          <div style={{ alignSelf: 'stretch', fontSize: 11.5, color: P.inkMute, textAlign: 'center', lineHeight: 1.45 }}>
            5″ Android · integrated UHF · the same web UI, in a WebView shell.
            The side triggers step this prototype forward.
          </div>
        </div>

        <Card padding={0}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${P.hairline}` }}>
            <MicroLabel>{set.label} · handheld screens</MicroLabel>
          </div>
          {set.order.map((id, i) => {
            const a = id === cur;
            return (
              <button key={id} onClick={() => setScreen(id)} aria-pressed={a} style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: 10, minHeight: 40, padding: '0 14px',
                background: a ? P.ink : 'transparent', color: a ? P.surface : P.ink2, border: 'none',
                borderTop: i === 0 ? 'none' : `1px solid ${a ? 'transparent' : P.hairline}`,
                cursor: 'pointer', fontFamily: P.fontSans, fontSize: 13, fontWeight: a ? 600 : 500, textAlign: 'left',
              }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', opacity: .7 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ flex: 1 }}>{set.screens[id].label}</span>
                {a && <Icon name="chevron-right" size={14} stroke={2.2} />}
              </button>);
          })}
        </Card>
      </div>);
  }

  /* ══════════════════════ THE RELATIONSHIP ══════════════════════ */

  function AssertDecide() {
    const P = useP();
    const items = [
      { icon: 'scan', t: 'The handheld asserts', d: 'What was read, in which box, at what strength — and when the gate refused to assert anything at all.' },
      { icon: 'refresh', t: 'The module decides the facts', d: <React.Fragment>argmax-RSSI, the <Mono>{D().CONFIDENCE_THRESHOLD} dBm</Mono> gate, the SKU diff and the move list. Computed once; both screens read the result.</React.Fragment> },
      { icon: 'shield', t: 'The desk decides the consequences', d: 'Posting a kit, writing a unit off as missing, rebinding an EPC. None of these are on the handheld, deliberately.' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {items.map((it) => (
          <Card key={it.t} padding={14}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: P.r8, background: P.surface3, border: `1px solid ${P.hairline}`, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <Icon name={it.icon} size={15} stroke={1.9} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: P.ink }}>{it.t}</div>
                <div style={{ fontSize: 12, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>{it.d}</div>
              </div>
            </div>
          </Card>))}
      </div>);
  }

  // Proof, not assertion: the same three figures, taken off the one computed
  // session, side by side. If these ever disagreed, one surface would be lying.
  function AgreementStrip() {
    const P = useP(), S = D().KIT_SUMMARY, HD = window.HD;
    const rows = [
      { label: 'Units assigned', v: S.assigned, note: 'argmax winner per EPC' },
      { label: 'Rescan queue', v: S.rescan, note: 'below the gate' },
      { label: 'Move units', v: S.moveUnits, note: 'fungible per SKU' },
      { label: 'Missing units', v: S.missingUnits, note: 'no surplus to pair' },
    ];
    return (
      <Card padding={0}>
        <div style={{ padding: '9px 16px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MicroLabel>One session · read by both surfaces</MicroLabel>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: HD.tone(P, 'ok').fg }} />
          <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{D().KIT.sessionId}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ padding: '12px 16px', borderLeft: i === 0 ? 'none' : `1px solid ${P.hairline}`, minWidth: 0, flex: '1 1 150px' }}>
              <MicroLabel>{r.label}</MicroLabel>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 21, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{r.v}</span>
                <span title="The handheld and this console show the same figure" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: P.inkMute }}>
                  <Icon name="smartphone" size={11} stroke={1.9} />=<Icon name="layout" size={11} stroke={1.9} />
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11.5, color: P.inkMute }}>{r.note}</div>
            </div>))}
        </div>
      </Card>);
  }

  function SystemMap() {
    const P = useP();
    // The chain arrow is a leading chevron INSIDE each node rather than a
    // separate flex item — a free-standing arrow strands itself at the end of a
    // line whenever the row wraps, and this row wraps in the paired layout.
    const Node = ({ icon, title, sub, tone, wide, first }) => {
      const c = tone ? window.HD.tone(P, tone) : null;
      return (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flex: wide ? '1.4 1 220px' : '1 1 180px', minWidth: 180 }}>
          {!first && (
            <span aria-hidden="true" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', color: P.inkFaint }}>
              <Icon name="arrow-right" size={18} stroke={2} />
            </span>)}
          <div style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: P.r12, background: c ? c.bg : P.surface, border: `1px solid ${P.hairline2}`, borderLeft: c ? `3px solid ${c.fg}` : `1px solid ${P.hairline2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: P.r8, background: P.surface, border: `1px solid ${P.hairline}`, color: c ? c.fg : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <Icon name={icon} size={14} stroke={2} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: P.ink }}>{title}</span>
            </div>
            <div style={{ marginTop: 7, fontSize: 12, color: P.inkDim, lineHeight: 1.45 }}>{sub}</div>
          </div>
        </div>);
    };

    return (
      <Card>
        <CardHead title="Read path" sub="Neither surface re-implements the algorithm. If the two ever disagreed, one of them would be lying — so neither is allowed to compute." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
            <Node first icon="smartphone" title="TC22R radio" sub="Reduced power. Every read carries an RSSI." tone="info" />
            <Node icon="link" title="WebView bridge" sub="The only hardware-aware layer. Connect · set power · stream reads · trigger · battery." />
            <Node icon="refresh" title="Module core" sub="Best-RSSI collapse → argmax → confidence gate → SKU diff → move list. Pure, no I/O." tone="ok" wide />
            <Node icon="database" title="Hyperdrive" sub="Owns the plan, the registry and the DB, behind ports this module never reaches around." />
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
            <Node first icon="scan" title="Operator app" sub="Same result, shaped for a hand: one question per screen, action under the thumb." wide />
            <Node icon="layout" title="This console" sub="Same result, shaped for a desk: every line, every box, every audit event, and the approve button." wide />
          </div>
        </div>
      </Card>);
  }

  function DecisionRights() {
    const P = useP();
    const ownerTone = (o) => (o === 'Supervisor' ? 'info' : o === 'Handheld' ? 'neutral' : 'ok');
    return (
      <Card padding={0}>
        <div style={{ padding: '16px 16px 12px' }}>
          <CardHead title="Decision rights" sub="Which surface is allowed to do what, and why it sits there. The screens in this module enforce this table; nothing may contradict it." style={{ marginBottom: 0 }} />
        </div>
        <window.ScrollX label="Decision rights table">
          <HDTable>
            <thead><tr style={{ background: P.surface2 }}>
              <TH width={290}>Decision</TH><TH width={150}>Owned by</TH><TH>Why it sits there</TH>
            </tr></thead>
            <tbody>
              {D().DECISION_RIGHTS.map((r) => (
                <TR key={r.decision}>
                  <TD>{r.decision}</TD>
                  <TD><HDPill size="sm" icon={false} tone={ownerTone(r.owner)} label={r.owner} /></TD>
                  <TD style={{ color: P.inkDim }}>{r.why}</TD>
                </TR>))}
            </tbody>
          </HDTable>
        </window.ScrollX>
      </Card>);
  }

  function KnownGaps() {
    const P = useP();
    return (
      <Card>
        <CardHead title="Known gaps this design does not paper over" />
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: P.inkDim, lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>One TC22R exists. Multi-operator cycle counting is drawn but cannot be validated yet — the console says so rather than showing a fleet that isn’t there.</li>
          <li>The Android shell is a contract, not a verified integration. Per-read RSSI and programmatic RF power still need confirming on the real device.</li>
          <li>The ZT411 ZPL has never been run. Commissioning carries that warning permanently until someone prints one and reads it back.</li>
          <li>The <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink2 }}>{D().CONFIDENCE_THRESHOLD}</span> dBm gate and the reduced-power setpoint are simulation-validated only. Both are shown on the handheld so a miscalibration is visible, not buried.</li>
          <li>No on-metal label stock was purchased, so “likely cause: behind metal shelf” is a procurement finding, not a scanning bug.</li>
        </ul>
      </Card>);
  }

  /* ══════════════════════ THE SCREEN ══════════════════════ */

  window.ScreenHandheld = function ScreenHandheld({ navigate, query }) {
    const P = useP();
    const flow = FLOWS.some((f) => f.id === query.flow) ? query.flow : 'kit';
    const isMap = flow === 'map';
    const set = !isMap ? window.RFID_HH[flow] : null;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Handheld & desk"
          sub="One session, two surfaces. The TC22R is where the reads come from and where a physical move is confirmed; this console is where a count becomes a posted fact. Both render the same computed reconciliation — neither is allowed to compute its own."
          actions={!isMap
            ? <PBtn size="sm" variant="secondary" icon="layout" onClick={() => navigate(set.desk)}>Open the desk view</PBtn>
            : <PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=kit')}>Open the device</PBtn>} />

        <ChipFilter ariaLabel="Workflow" value={flow} onChange={(v) => navigate(`#/handheld?flow=${v}`)}
          options={FLOWS.map((f) => ({ id: f.id, label: f.label }))} />

        {isMap ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
            <AssertDecide />
            <AgreementStrip />
            <SystemMap />
            <DecisionRights />
            <KnownGaps />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AssertDecide />
            <div className="rfid-pair">
              <div style={{ position: 'sticky', top: 0 }}><HandheldPane flow={flow} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                <AgreementStrip />
                <Card>
                  <CardHead title="What this device may not do"
                    sub="The floor asserts. It never posts a count, never writes a unit off, never overrides a binding." />
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {D().DECISION_RIGHTS.filter((r) => r.owner === 'Supervisor').map((r, i) => (
                      <li key={r.decision} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                        <span style={{ color: P.inkMute, flex: '0 0 auto', marginTop: 1 }}><Icon name="lock" size={14} stroke={2} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: P.ink }}>{r.decision}</div>
                          <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>{r.why}</div>
                        </div>
                      </li>))}
                  </ul>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}>
                    <PBtn size="sm" variant="secondary" icon="arrow-right" onClick={() => navigate(set.desk)}>Go to where those decisions live</PBtn>
                  </div>
                </Card>
                <SystemMap />
              </div>
            </div>
          </div>)}
      </div>);
  };
})();
