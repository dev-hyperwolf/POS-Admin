// ── The handheld (TC22R) screens ─────────────────────────────────────────
// Thirteen screens across the three workflows, designed for a 5-inch screen
// held in one hand in a packing room: one question per screen, the answer in a
// band you can read while moving, the action pinned under the thumb.
//
// The one rule that makes this a module and not two prototypes: **every figure
// on these screens is read from window.RFID_DATA**, which is the same computed
// reconciliation the desktop renders. If the device says 696 assigned, the desk
// says 696. Nothing here recomputes, and nothing here holds a fixture.
//
// The handheld ASSERTS. It never approves, never writes anything off, never
// rebinds. Those live on the desk, and the docks below say so out loud.
;(function () {
  const useP = window.useP;
  const D = () => window.RFID_DATA;

  const plannedFor = (b) => D().BOXES[b - 1].planned;
  const actualFor = (b) => D().BOXES[b - 1].actual;
  const linesFor = (b) => D().BOXES[b - 1].lines;

  function SkuLead({ sku, size }) {
    const s = D().skuOf(sku);
    return <window.CatDot cat={s.cat} size={size || 34} label={s.sku.slice(0, 3)} />;
  }

  // Ease a live counter up to its computed target. The target is never
  // invented — it is whatever the engine assigned.
  function useSettle(target, frames = 26) {
    const [v, setV] = React.useState(0);
    React.useEffect(() => {
      let f = 0;
      const t = setInterval(() => {
        f += 1;
        const k = Math.min(1, f / frames);
        setV(1 - Math.pow(1 - k, 2.2));
        if (k >= 1) clearInterval(t);
      }, 90);
      return () => clearInterval(t);
    }, [target]);
    return { k: v, value: Math.round(target * v), settled: v >= 1 };
  }

  /* ═══════════════════════════ 1 · KIT VERIFICATION ═══════════════════════ */

  function KitPickup({ go }) {
    const P = useP(), K = D().KIT, dec = window.useDecisions();
    return (<React.Fragment>
      <window.HHBar title="Kit verification" sub={K.id} right={<Pill kind="neutral" size="sm" style={monoStyle(P)}>{K.device}</Pill>} />
      <window.HHBand tone="info" icon="package" title="Kit staged" value={`${K.boxCount} boxes`}
        sub={`${K.plannedUnits} units planned · ${K.route}`} />
      <window.HHBody>
        <window.HHSection>Scan order</window.HHSection>
        {K.boxes.map((b) => (
          <window.HHRow key={b.box}
            lead={<window.HHLead text={b.box} />}
            title={<React.Fragment>Box <Mono>{b.box}</Mono></React.Fragment>}
            sub={`${Object.keys(K.plan[b.box]).length} SKUs planned`}
            value={plannedFor(b.box)} valueSub="units" />))}
        <window.HHMeta items={[
          { label: 'RF power', value: `${K.rfPower} dBm (reduced)` },
          { label: 'Confidence gate', value: `${dec.gateValue} dBm` },
          { label: 'Reader', value: K.device },
          { label: 'Opened', value: D().fmtClock(new Date(K.startedAt).getTime()) },
        ]} />
        <window.HHText>
          Scan one box at a time. Every tag is credited to the single box it read strongest in, so a
          neighbour box bleeding into this read never double-counts.
        </window.HHText>
      </window.HHBody>
      <window.HHDock note="Squeeze and hold either side trigger to read.">
        <window.HHAction icon="scan" onClick={() => go('scan')} sub={`${plannedFor(1)} units planned`}>Scan Box <Mono color="inherit">1</Mono></window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function KitScanning({ go }) {
    const K = D().KIT, dec = window.useDecisions();
    const box = K.liveBox;
    const target = D().BOXES[box - 1];
    const s = useSettle(target.actual);
    const running = !s.settled;
    return (<React.Fragment>
      <window.HHBar title={`Box ${box} of ${K.boxCount}`} sub={`${K.id} · ${plannedFor(box)} planned`} onBack={() => go('pickup')} />
      <window.HHScanField scanning={running} unique={s.value} reads={Math.round(target.reads * s.k)}
        seconds={Math.round(target.seconds * s.k)} gate={dec.gateValue} power={K.rfPower} />
      <window.HHBody pad={12} style={{ gap: 6 }}>
        <window.HHSection>Seen in this box</window.HHSection>
        {linesFor(box).filter((l) => l.actual > 0).map((l) => {
          const m = D().skuOf(l.sku);
          return <window.HHRow key={l.sku} lead={<SkuLead sku={l.sku} />} title={m.name} sub={l.sku}
            value={Math.round(l.actual * s.k)} valueSub={`${m.unit}s`} />;
        })}
        <window.HHText>Counts settle as reads arrive. Nothing is compared to the plan until the box is locked.</window.HHText>
      </window.HHBody>
      <window.HHDock note={running ? 'Keep the trigger held — sweep the box top to bottom.' : 'Release the trigger, then lock the box.'}>
        <window.HHAction icon="lock" variant={running ? 'quiet' : 'accent'} disabled={running}
          onClick={() => go('box')} sub={`${s.value} unique tags`}>Lock Box <Mono color="inherit">{box}</Mono></window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function KitBoxResult({ go }) {
    const K = D().KIT, box = K.liveBox;
    const b = D().BOXES[box - 1];
    const ls = linesFor(box);
    const worst = ls.find((l) => l.state !== 'correct');
    const m = worst ? D().skuOf(worst.sku) : null;
    const next = Math.min(K.boxCount, box + 1);
    return (<React.Fragment>
      <window.HHBar title={`Box ${box} result`} sub={`${actualFor(box)} of ${plannedFor(box)} units`} onBack={() => go('scan')} />
      <window.HHBand tone={worst ? D().STATE_TONE[worst.state] : 'ok'} icon={worst ? 'alert' : 'check-circle'}
        title={worst ? `Box ${box} · ${D().STATE_LABEL[worst.state]}` : `Box ${box} · matches plan`}
        value={worst ? `${worst.delta > 0 ? '+' : ''}${worst.delta}` : actualFor(box)}
        sub={worst
          ? `${m.name} — ${worst.actual} read where the plan calls for ${worst.planned}. Everything else in this box is correct.`
          : 'Every SKU in this box matches its planned quantity.'} />
      <window.HHBody>
        {ls.map((l) => {
          const sk = D().skuOf(l.sku);
          return (
            <window.HHRow key={l.sku} lead={<SkuLead sku={l.sku} />} title={sk.name}
              sub={`${l.actual} of ${l.planned} · ${l.sku}`}
              value={l.state === 'correct' ? '✓' : `${l.delta > 0 ? '+' : ''}${l.delta}`}
              valueSub={D().STATE_LABEL[l.state].toLowerCase()}
              tone={D().STATE_TONE[l.state]} />);
        })}
        <window.HHMeta items={[
          { label: 'Read for', value: D().fmtDur(b.seconds) },
          { label: 'Avg RSSI', value: `${b.avgRssi} dBm` },
          { label: 'Bleed rejected', value: `${b.bleedRejected} reads` },
          { label: 'Assigned here', value: `${b.actual} tags` },
        ]} />
      </window.HHBody>
      <window.HHDock note={`Box ${box} is locked. Moves are decided once every box is in.`}>
        <window.HHAction icon="arrow-right" onClick={() => go('kit')} sub={`${plannedFor(next)} units planned`}>Next — Box <Mono color="inherit">{next}</Mono></window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function KitVerdict({ go }) {
    const S = D().KIT_SUMMARY, K = D().KIT, dec = window.useDecisions();
    const decided = dec.kit.status !== 'submitted';
    return (<React.Fragment>
      <window.HHBar title="Kit verdict" sub={K.id} onBack={() => go('box')} />
      <window.HHBand
        tone={dec.kit.status === 'approved' ? 'ok' : dec.kit.status === 'rejected' ? 'blocked' : 'warn'}
        icon={dec.kit.status === 'approved' ? 'check-circle' : dec.kit.status === 'rejected' ? 'ban' : 'flag'}
        title={dec.kit.status === 'approved' ? 'Approved by the desk'
          : dec.kit.status === 'rejected' ? 'Rejected — re-scan the kit'
          : `Review — ${S.moveLines} move lines`}
        value={`${S.assigned} / ${S.planned}`}
        sub={dec.kit.status === 'approved'
          ? `Posted by ${dec.kit.by}. ${S.missingUnits} units carried forward as a kit exception.`
          : dec.kit.status === 'rejected'
          ? dec.kit.note
          : `${K.boxCount} boxes read. ${S.moveLines} lines can be fixed by moving product between boxes; ${D().UNRESOLVED.length} cannot.`} />
      <window.HHBody>
        <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
          <window.HHStat label="Correct" value={S.correct} sub="lines" tone="ok" />
          <window.HHStat label="Short" value={S.short} sub="lines" tone="blocked" />
        </div>
        <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
          <window.HHStat label="Excess" value={S.excess} sub="lines" tone="warn" />
          <window.HHStat label="Wrong product" value={S.wrong} sub="lines" tone="quarantine" />
        </div>
        <window.HHRow lead={<window.HHLead icon="refresh" tone="info" />}
          title="Rescan queue" sub="Below the confidence gate — no box asserted" value={S.rescan} valueSub="tags" tone="info"
          onClick={() => go('rescan')} />
        <window.HHRow lead={<window.HHLead icon="help" />}
          title="Unregistered EPCs" sub="Read clearly, but not in the tag registry" value={S.unknown} valueSub="tags" />
        <window.HHMeta items={[
          { label: 'Scanned', value: `${S.scanned} tags` },
          { label: 'Assigned', value: `${S.assigned} tags` },
          { label: 'Bleed rejected', value: `${S.phantomUnitsAvoided} reads` },
          { label: 'Gate', value: `${dec.gateValue} dBm` },
        ]} />
        {decided && (
          <window.HHNote tone={dec.kit.status === 'approved' ? 'ok' : 'blocked'} icon={dec.kit.status === 'approved' ? 'check-circle' : 'ban'}>
            This session is closed to the floor. {dec.kit.status === 'approved' ? 'The counts are posted.' : 'Start a fresh session to re-scan it.'}
          </window.HHNote>)}
      </window.HHBody>
      <window.HHDock>
        <window.HHAction icon="list" onClick={() => go('pull')} sub={`${S.moveUnits} units across ${S.moveGroups} boxes`}>Open pull list</window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function KitPullList({ go }) {
    const groups = D().MOVE_GROUPS, unresolved = D().UNRESOLVED, K = D().KIT;
    const dec = window.useDecisions();
    const [done, setDone] = React.useState({});
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const doneCount = Object.values(done).filter(Boolean).length;
    const [submitted, setSubmitted] = React.useState(false);
    const locked = dec.kit.status !== 'submitted';
    return (<React.Fragment>
      <window.HHBar title="Pull list" sub={`${groups.length} source boxes · ${D().KIT_SUMMARY.moveUnits} units`} onBack={() => go('kit')} />
      <window.HHBand tone={doneCount === total ? 'ok' : 'neutral'} icon="package"
        title={doneCount === total ? 'All moves done' : 'Work one box at a time'}
        value={`${doneCount} / ${total}`} sub="Any unit of the SKU will do — never hunt a specific tag." />
      <window.HHBody>
        {groups.map((g) => (
          <React.Fragment key={g.fromBox}>
            <window.HHSection right={`${g.totalUnits} units`}>Pull from Box {g.fromBox}</window.HHSection>
            {g.items.map((it) => {
              const key = `${g.fromBox}:${it.sku}:${it.toBox}`;
              const s = D().skuOf(it.sku);
              const on = !!done[key];
              return (
                <window.HHRow key={key} done={on} onClick={() => setDone((d) => ({ ...d, [key]: !d[key] }))}
                  lead={<window.HHTick on={on} />}
                  title={`${it.qty} × ${s.name}`}
                  sub={`${it.sku} · ${s.brand}`}
                  value={`→ ${it.toBox}`} valueSub="box" />);
            })}
          </React.Fragment>))}

        <window.HHSection>Moving won’t fix these</window.HHSection>
        {unresolved.map((u) => {
          const s = D().skuOf(u.sku);
          return (
            <window.HHRow key={`${u.boxIndex}-${u.sku}`} lead={<SkuLead sku={u.sku} />}
              title={`${u.qty} × ${s.name}`}
              sub={u.maybeRescan ? `Box ${u.boxIndex} · one unit is in the rescan queue` : `Box ${u.boxIndex} is short — no box has spare`}
              value={`−${u.qty}`} valueSub={u.maybeRescan ? 'maybe' : 'missing'}
              tone={u.maybeRescan ? 'info' : 'blocked'} />);
        })}
        <window.HHText>
          These {D().KIT_SUMMARY.missingUnits} units go to the supervisor as a kit shortfall. Writing one off as
          missing is an accounting decision, and it is not on this device.
        </window.HHText>
      </window.HHBody>
      <window.HHDock note={locked
        ? `The desk has already ${dec.kit.status} this kit.`
        : submitted ? 'Submitted. The desk decides from here.'
        : doneCount < total ? `${total - doneCount} move${total - doneCount === 1 ? '' : 's'} left before you can submit.`
        : 'Submitting asserts what you read. It does not post the counts.'}>
        <window.HHAction icon="check-circle" disabled={doneCount < total || submitted || locked}
          variant={doneCount < total || submitted || locked ? 'quiet' : 'accent'}
          onClick={() => { setSubmitted(true); window.hdToast && window.hdToast({ title: 'Kit submitted — not sent to the desk', description: `${K.id} marked done on this device only. Nothing changed for the desk to review.`, tone: 'ok' }); }}
          sub={`${doneCount} of ${total} moves confirmed`}>
          {locked ? `Kit ${dec.kit.status}` : submitted ? 'Awaiting the desk' : 'Submit kit'}
        </window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function KitRescan({ go }) {
    const K = D().KIT, dec = window.useDecisions();
    const r = K.recon.rescan;
    return (<React.Fragment>
      <window.HHBar title="Rescan queue" sub={`gate ${dec.gateValue} dBm`} onBack={() => go('kit')} />
      <window.HHBand tone="info" icon="refresh" title="No location asserted" value={r.length}
        sub="Their strongest read was below the gate. No box was blamed and no move was suggested." />
      <window.HHBody>
        {r.map((t) => (
          <window.HHRow key={t.epc} lead={<window.HHLead icon="help" tone="info" />}
            title={`Heard nearest Box ${t.nearestBox}`}
            sub={D().shortEpc(t.epc)} value={t.bestRssi.toFixed(1)} valueSub="dBm best" tone="info" />))}
        <window.HHMeta items={[
          { label: 'Gate', value: `${dec.gateValue} dBm` },
          { label: 'Power', value: `${K.rfPower} dBm` },
          { label: 'Likeliest box', value: 'not asserted', mono: false },
          { label: 'Moves emitted', value: '0' },
        ]} />
        <window.HHText>
          Hold the reader within arm’s length of one box at a time. If a tag still will not clear the
          gate, it is probably foil-lined or wedged against metal — flag it instead of guessing.
        </window.HHText>
        {dec.rescanRequested && (
          <window.HHNote tone="info" icon="send">The desk has requested this pass. It is queued on {K.device}.</window.HHNote>)}
      </window.HHBody>
      <window.HHDock note="Re-reading a single box does not re-open the boxes already locked.">
        <window.HHAction icon="scan" onClick={() => go('scan')} sub={`${r.length} tags to re-read`}>Rescan up close</window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  /* ═══════════════════════════ 2 · CYCLE COUNT ════════════════════════════ */

  function CountStart({ go }) {
    const [id, setId] = React.useState(D().LIVE_COUNT.id);
    const c = D().COUNTS.find((x) => x.id === id) || D().LIVE_COUNT;
    return (<React.Fragment>
      <window.HHBar title="Cycle count" sub="Walk-scan · deduped by EPC" />
      <window.HHBand tone="neutral" icon="grid" title="Expected on hand" value={c.expected}
        sub={`${c.room} · last counted ${D().fmtClock(new Date(c.finishedAt).getTime())} by ${c.operator}`} />
      <window.HHBody>
        <window.HHChips value={id} onChange={setId} options={D().COUNTS.map((x) => ({ value: x.id, label: x.room, count: x.expected }))} />
        <window.HHMeta items={[
          { label: 'Pass bar', value: `${(D().ROOM_PASS_COVERAGE * 100).toFixed(1)}% coverage` },
          { label: 'Last verdict', value: c.verdict },
          { label: 'Last coverage', value: `${c.coveragePct.toFixed(1)}%` },
          { label: 'Reader', value: c.device },
        ]} />
        <window.HHText>
          Walk every aisle at a steady pace with the trigger held. Reads dedupe by EPC, so covering
          the same shelf twice costs time and never accuracy.
        </window.HHText>
        <window.HHNote tone="warn">
          One reader exists. Multi-operator dedupe is designed but cannot be validated until a second
          TC22R lands.
        </window.HHNote>
      </window.HHBody>
      <window.HHDock note="The count runs until you end it — there is no timer.">
        <window.HHAction icon="play" onClick={() => go('walk')} sub={`${c.expected} units expected`}>Start walk</window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function CountWalk({ go }) {
    const P = useP(), c = D().LIVE_COUNT;
    const s = useSettle(c.uniqueFound, 30);
    const cov = (s.value / c.expected) * 100;
    const running = !s.settled;
    const t = window.HD.tone(P, cov >= D().ROOM_PASS_COVERAGE * 100 ? 'ok' : 'warn');
    const bar = D().ROOM_PASS_COVERAGE * 100;
    return (<React.Fragment>
      <window.HHBar title={c.room} sub={`${c.zones[c.liveZone]} · ${D().fmtDur(c.minutes * 60 * s.k)}`} onBack={() => go('start')} />
      <div style={{ flex: '0 0 auto', padding: '16px 16px 14px', background: t.bg, borderBottom: `2px solid ${t.fg}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 52, lineHeight: .95, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em' }}>{cov.toFixed(1)}</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>%</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.ink2, fontVariantNumeric: 'tabular-nums' }}>{s.value} / {c.expected}</span>
        </div>
        <div style={{ marginTop: 12, position: 'relative', height: 10, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, cov)}%`, background: t.fg, borderRadius: 99, transition: 'width .1s linear' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${bar}%`, width: 2, background: P.ink }} />
        </div>
        <div style={{ marginTop: 4, fontFamily: P.fontMono, fontSize: 10, color: P.inkMute, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>pass bar {bar.toFixed(1)}%</div>
      </div>
      <window.HHBody>
        <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
          <window.HHStat label="Unique EPCs" value={s.value} sub="deduped" />
          <window.HHStat label="Raw reads" value={Math.round(c.passes.reduce((n, p) => n + p.reads, 0) * s.k)} sub="all passes" />
        </div>
        <window.HHSection>Zones</window.HHSection>
        {c.zones.map((z, i) => {
          const state = i < c.liveZone ? 'done' : i === c.liveZone ? 'now' : 'todo';
          return (
            <window.HHRow key={z} title={z}
              sub={state === 'done' ? 'covered' : state === 'now' ? 'walking now' : 'not yet walked'}
              value={state === 'done' ? '✓' : state === 'now' ? '•' : '—'}
              tone={state === 'done' ? 'ok' : state === 'now' ? 'info' : undefined} />);
        })}
      </window.HHBody>
      <window.HHDock note={running ? 'Keep walking — coverage is still climbing.' : 'Coverage has settled. End the walk to reconcile.'}>
        <window.HHAction icon="check-circle" variant={running ? 'quiet' : 'accent'} disabled={running}
          onClick={() => go('result')} sub={`${cov.toFixed(1)}% coverage`}>End walk & reconcile</window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function CountResult({ go }) {
    const c = D().LIVE_COUNT;
    const pass = c.verdict === 'PASS';
    return (<React.Fragment>
      <window.HHBar title="Count result" sub={`${c.room} · ${c.id}`} onBack={() => go('walk')} />
      <window.HHBand tone={pass ? 'ok' : 'warn'} icon={pass ? 'check-circle' : 'flag'}
        title={`${c.verdict} · bar is ${(D().ROOM_PASS_COVERAGE * 100).toFixed(1)}%`} value={`${c.coveragePct.toFixed(1)}%`}
        sub={`${c.uniqueFound} of ${c.expected} units located across ${c.passes.length} passes.`} />
      <window.HHBody>
        <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
          <window.HHStat label="Located" value={c.uniqueFound} sub="unique EPCs" tone="ok" />
          <window.HHStat label="Not located" value={c.notLocated} sub="stragglers" tone="warn" />
        </div>
        <window.HHSection>Coverage by pass</window.HHSection>
        {c.passes.map((p) => (
          <window.HHRow key={p.n} lead={<window.HHLead text={p.n} />} title={`Pass ${p.n}`} sub={`${p.reads} reads`}
            value={`+${p.newlySeen}`} valueSub="newly seen" />))}
        <window.HHMeta items={[
          { label: 'Walk time', value: `${c.minutes} min` },
          { label: 'Passes', value: String(c.passes.length) },
          { label: 'Operator', value: c.operator, mono: false },
          { label: 'Finished', value: D().fmtClock(new Date(c.finishedAt).getTime()) },
        ]} />
        <window.HHText>
          A PASS still leaves stragglers. They are not written off — they go to a second pass, and
          only a supervisor can close one as missing.
        </window.HHText>
      </window.HHBody>
      <window.HHDock>
        <window.HHAction icon="target" onClick={() => go('strag')} sub={`${c.stragglers.length} tags to chase`}>Show stragglers</window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function CountStragglers({ go }) {
    const c = D().LIVE_COUNT, dec = window.useDecisions();
    const [found, setFound] = React.useState({});
    const open = c.stragglers.filter((s) => !dec.stragglersClosed[s.epc]);
    const n = open.filter((s) => found[s.epc]).length;
    return (<React.Fragment>
      <window.HHBar title="Stragglers" sub={`${open.length} open · second pass`} onBack={() => go('result')} />
      <window.HHBand tone={n ? 'ok' : 'warn'} icon="target" title="Second pass" value={`${n} / ${open.length}`}
        sub="Shelf hints come from where each tag was last seen — go there first." />
      <window.HHBody>
        {open.length === 0 && (
          <window.HHNote tone="ok" icon="check-circle">
            Nothing left to chase. Everything on this list has either been located or closed as missing by the desk.
          </window.HHNote>)}
        {open.map((s) => {
          const m = D().skuOf(s.sku);
          const on = !!found[s.epc];
          return (
            <window.HHRow key={s.epc} done={on} onClick={() => setFound((f) => ({ ...f, [s.epc]: !f[s.epc] }))}
              lead={<window.HHTick on={on} />}
              title={m.name} sub={`${s.shelf} · ${s.cause}`}
              value={s.epc.slice(-6)} valueSub="epc" />);
        })}
        {Object.keys(dec.stragglersClosed).length > 0 && (
          <React.Fragment>
            <window.HHSection>Closed by the desk</window.HHSection>
            {c.stragglers.filter((s) => dec.stragglersClosed[s.epc]).map((s) => (
              <window.HHRow key={s.epc} done lead={<window.HHLead icon="ban" tone="blocked" />}
                title={D().skuOf(s.sku).name} sub={s.epc.slice(-6)} value="—" valueSub="written off" />))}
          </React.Fragment>)}
      </window.HHBody>
      <window.HHDock note="Anything still missing after this pass is a supervisor decision.">
        <window.HHAction icon="send" onClick={() => window.hdToast && window.hdToast({ title: 'Second pass closed', description: `${n} of ${open.length} stragglers located.`, tone: n ? 'ok' : 'warn' })}
          sub={`${open.length - n} still missing`}>Close second pass</window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  /* ═══════════════════════════ 3 · COMMISSIONING ══════════════════════════ */

  function TagSetup({ go }) {
    const P = useP(), RUN = D().LIVE_RUN, PR = D().DEVICES.printer, INV = D().TAG_INVENTORY;
    const s = D().skuOf(RUN.sku);
    const [qty, setQty] = React.useState(RUN.qty);
    return (<React.Fragment>
      <window.HHBar title="Tag commissioning" sub={`${PR.id} · ${INV.remaining} labels left`} />
      <window.HHBand tone="neutral" icon="printer" title="Encode & print" value={qty} sub={`${s.name} · ${s.brand}`} />
      <window.HHBody>
        <window.HHRow lead={<SkuLead sku={RUN.sku} />} title={s.name} sub={RUN.sku} value={s.cat.slice(0, 3).toUpperCase()} valueSub="cat" />
        <window.HHRow lead={<window.HHLead icon="box" />} title="Source package" sub={RUN.packageId} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, padding: '0 12px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, flex: '0 0 auto' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>Labels to print</div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>One tag per retail unit</div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
            <button onClick={() => setQty((q) => Math.max(10, q - 10))} aria-label="Fewer" style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: P.ink, cursor: 'pointer' }}><Icon name="minus" size={18} stroke={2.4} /></button>
            <span style={{ minWidth: 52, textAlign: 'center', fontFamily: P.fontMono, fontSize: 18, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
            <button onClick={() => setQty((q) => q + 10)} aria-label="More" style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: P.ink, cursor: 'pointer' }}><Icon name="plus" size={18} stroke={2.4} /></button>
          </div>
        </div>
        <window.HHMeta items={[
          { label: 'Printer', value: PR.id },
          { label: 'Stock', value: PR.media, mono: false },
          { label: 'Labels on roll', value: `${PR.stockRemaining}` },
          { label: 'Ribbon left', value: `${Math.round(PR.ribbonRemaining * 100)}%` },
        ]} />
        <window.HHNote tone="warn">
          The ZPL template has never been run on a real ZT411. Print one label on the real Glint stock
          and read it back before any production run.
        </window.HHNote>
      </window.HHBody>
      <window.HHDock note="Every label is read back after encoding — a tag that will not encode is voided, not shipped.">
        <window.HHAction icon="printer" onClick={() => go('printing')} sub={`${INV.remaining - qty} labels remain after this run`}>Encode & print <Mono color="inherit">{qty}</Mono></window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function TagPrinting({ go }) {
    const P = useP(), RUN = D().LIVE_RUN;
    const s = useSettle(RUN.commissioned, 28);
    const voided = D().LIVE_RUN_TAGS.filter((t) => !t.ok && t.n <= s.value).length;
    const rows = D().LIVE_RUN_TAGS.slice(Math.max(0, s.value - 6), s.value).reverse();
    return (<React.Fragment>
      <window.HHBar title="Encoding run" sub={RUN.id} onBack={() => go('setup')} />
      <window.HHBand tone={s.settled ? 'blocked' : 'ok'} icon={s.settled ? 'ban' : 'printer'}
        title={s.settled ? 'Halted at a collision' : 'Printing'} value={`${s.value} / ${RUN.qty}`}
        sub={`${RUN.labelsPerMin} labels/min · ${voided} voided on read-back · 1 collision`} />
      <window.HHBody>
        <div style={{ height: 8, borderRadius: 99, background: P.surface3, overflow: 'hidden', flex: '0 0 auto' }}>
          <div style={{ height: '100%', width: `${(s.value / RUN.qty) * 100}%`, background: window.HD.tone(P, s.settled ? 'blocked' : 'ok').fg, borderRadius: 99, transition: 'width .1s linear' }} />
        </div>
        <window.HHSection>Just printed</window.HHSection>
        {rows.map((r) => (
          <window.HHRow key={r.n} title={r.retailId} sub={D().shortEpc(r.epc)}
            value={r.ok ? '✓' : 'VOID'} valueSub={r.ok ? 'read back' : 'encode failed'}
            tone={r.ok ? 'ok' : 'blocked'} />))}
        {s.settled && (
          <window.HHRow lead={<window.HHLead icon="ban" tone="blocked" />}
            title="1 collision held" sub="Retail ID already bound to another EPC" value="409" valueSub="held"
            tone="blocked" onClick={() => go('collision')} />)}
      </window.HHBody>
      <window.HHDock note="Pausing stops the printer between labels — no partial encode.">
        <window.HHAction icon={s.settled ? 'ban' : 'pause'} variant={s.settled ? 'ink' : 'quiet'}
          onClick={() => s.settled ? go('collision') : window.hdToast && window.hdToast({ title: 'Run paused', description: `${RUN.id} paused at label ${s.value}.`, tone: 'warn' })}
          sub={`${RUN.qty - s.value} labels remaining`}>
          {s.settled ? 'Open the collision' : 'Pause run'}
        </window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  function TagCollision({ go }) {
    const C = D().COLLISION, RUN = D().LIVE_RUN, dec = window.useDecisions();
    const resolved = dec.binding.status !== 'open';
    return (<React.Fragment>
      <window.HHBar title="Binding refused" sub={RUN.id} onBack={() => go('printing')} />
      <window.HHBand tone={resolved ? (dec.binding.status === 'rebound' ? 'warn' : 'ok') : 'blocked'}
        icon={resolved ? 'lock' : 'ban'}
        title={resolved ? (dec.binding.status === 'rebound' ? 'Rebound by the desk' : 'Original binding upheld') : C.status}
        value="1"
        sub={resolved
          ? dec.binding.reason
          : 'This retail ID is already bound to a different EPC. Nothing was written and nothing was overwritten.'} />
      <window.HHBody>
        <window.HHRow title="Retail ID" sub={C.value} value="1:1" valueSub="enforced" tone="blocked" />
        <window.HHRow title="Incoming EPC" sub={D().shortEpc(C.incomingEpc)} value="—" valueSub="rejected" />
        <window.HHRow title="Already bound to" sub={D().shortEpc(C.boundEpc)} value="✓" valueSub="live" tone="ok" />
        <window.HHMeta items={[
          { label: 'Bound at', value: new Date(C.boundAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
          { label: 'Bound by', value: C.boundBy, mono: false },
          { label: 'Audit event', value: C.auditEventId },
          { label: 'Idempotency', value: 'replay-safe', mono: false },
        ]} />
        <window.HHText>
          Rebinding a retail ID is not something the floor can do. Void this label, keep printing, and
          a supervisor resolves the binding from the console.
        </window.HHText>
      </window.HHBody>
      <window.HHDock>
        <window.HHAction icon="printer" onClick={() => go('printing')} sub="run continues at the next label">Void label & continue</window.HHAction>
        <window.HHAction variant="outline" icon="send" disabled={resolved}
          onClick={() => window.hdToast && window.hdToast({ title: 'Sent to supervisor — nothing was queued', description: `${C.auditEventId} noted here only. No binding-review queue exists yet.`, tone: 'info' })}>
          {resolved ? 'Resolved on the desk' : 'Send to supervisor'}
        </window.HHAction>
      </window.HHDock>
    </React.Fragment>);
  }

  /* ══════════════════════════ SCREEN REGISTRY ═════════════════════════════ */

  window.RFID_HH = {
    kit: {
      label: 'Kit verification',
      desk: '#/kits/KIT-2026-0824-03',
      order: ['pickup', 'scan', 'box', 'kit', 'pull', 'rescan'],
      screens: {
        pickup: { label: 'Kit staged', render: (p) => <KitPickup {...p} /> },
        scan: { label: 'Scanning box 3', render: (p) => <KitScanning {...p} /> },
        box: { label: 'Box 3 result', render: (p) => <KitBoxResult {...p} /> },
        kit: { label: 'Kit verdict', render: (p) => <KitVerdict {...p} /> },
        pull: { label: 'Pull list', render: (p) => <KitPullList {...p} /> },
        rescan: { label: 'Rescan queue', render: (p) => <KitRescan {...p} /> },
      },
    },
    count: {
      label: 'Cycle count',
      desk: '#/counts/CNT-2026-0824-02',
      order: ['start', 'walk', 'result', 'strag'],
      screens: {
        start: { label: 'Room start', render: (p) => <CountStart {...p} /> },
        walk: { label: 'Walking', render: (p) => <CountWalk {...p} /> },
        result: { label: 'Coverage result', render: (p) => <CountResult {...p} /> },
        strag: { label: 'Stragglers', render: (p) => <CountStragglers {...p} /> },
      },
    },
    tags: {
      label: 'Tag commissioning',
      desk: '#/commission',
      order: ['setup', 'printing', 'collision'],
      screens: {
        setup: { label: 'Bind & print', render: (p) => <TagSetup {...p} /> },
        printing: { label: 'Encoding run', render: (p) => <TagPrinting {...p} /> },
        collision: { label: 'Collision · 409', render: (p) => <TagCollision {...p} /> },
      },
    },
  };
})();
