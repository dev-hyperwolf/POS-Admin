// ── Discrepancy — end-of-shift reconciliation: cash · card · inventory ──────
//   Read-only for the driver; loss prevention reviews flags. Inventory
//   section back-tracks which orders a missing item may have affected.
const useP = window.useP;

function cashRows() {
  const live = (window.M.s.completed || []).filter((s) => (s.cash || 0) > 0);
  const shift = window.MD.SHIFT_COMPLETED.filter((s) => (s.cash || 0) > 0);
  const norm = (s) => ({ id: s.taskId || s.id, order: s.order, name: s.name, method: s.method, expected: s.cash, counted: s.counted != null ? s.counted : s.cash, at: typeof s.at === 'number' ? 'just now' : s.at });
  return [...shift.map(norm), ...live.map(norm)];
}
// Inventory discrepancy card with a driver response (status + note)
function InvCard({ d }) {
  const P = useP();
  const p = window.MD.prod(d.sku);
  const miss = d.qtyExpected - d.qtyCounted;
  const [resp, setResp] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [noteOpen, setNoteOpen] = React.useState(false);
  const RESP = [['found', 'Found it', P.good], ['missing', 'Still missing', P.bad], ['damaged', 'Damaged', P.warn]];
  const tone = resp ? (RESP.find((r) => r[0] === resp) || [])[2] : P.warn;
  return (
    <div style={{ background: P.surface, border: `1px solid ${resp === 'found' ? P.good : P.warn}`, borderRadius: P.r14, padding: '14px 15px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <Thumb item={p} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>{p ? p.name : d.sku}</div>
          <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{p ? p.brand : ''} · <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="box" size={11} stroke={2} />{d.box}</span></div>
        </div>
        <span style={{ padding: '4px 11px', borderRadius: 99, background: resp === 'found' ? P.goodSoft : P.badSoft, color: resp === 'found' ? P.good : P.bad, fontSize: 12, fontWeight: 800, fontFamily: P.fontMono, alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{resp === 'found' ? 'resolved' : `−${miss} missing`}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, padding: '10px 0', borderTop: `1px solid ${P.hairline}`, borderBottom: `1px solid ${P.hairline}`, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>Expected</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{d.qtyExpected}</div></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>Counted</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{d.qtyCounted}</div></div>
      </div>
      <div style={{ fontSize: 10.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, marginBottom: 6 }}>Possibly affected orders</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{d.affected.map((o) => { const tk = window.MD.TASKS.find((t) => t.order === o); return <button key={o} onClick={() => tk && window.M.push('task', { taskId: tk.id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 99, background: P.surface2, border: `1px solid ${P.hairline2}`, color: P.ink, fontSize: 12, fontWeight: 700, fontFamily: P.fontMono, cursor: tk ? 'pointer' : 'default' }}>{o}{tk && <Icon name="chevron-right" size={13} stroke={2.2} color={P.inkFaint} />}</button>; })}</div>
      {d.note && <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: P.ink2, background: P.surface2, borderRadius: P.r8, padding: '9px 11px', marginBottom: 12 }}><Icon name="search" size={14} stroke={2} color={P.inkMute} />{d.note}</div>}

      {/* driver response */}
      <div style={{ borderTop: `1px solid ${P.hairline}`, paddingTop: 12 }}>
        <div style={{ fontSize: 10.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, marginBottom: 8 }}>Your response</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: noteOpen || note ? 10 : 0 }}>{RESP.map(([k, l, c]) => { const a = resp === k; return <button key={k} onClick={() => setResp(a ? null : k)} style={{ flex: 1, padding: '10px 4px', borderRadius: P.r10, border: `1.5px solid ${a ? c : P.hairline2}`, background: a ? c + (P.mode === 'dark' ? '22' : '18') : 'transparent', color: a ? c : P.ink2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>; })}</div>
        {!noteOpen && !note ? <button onClick={() => setNoteOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'none', border: 'none', color: P.info, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}><Icon name="note" size={14} stroke={2} />Add a note</button>
          : <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Found under the driver seat" rows={2} style={{ width: '100%', resize: 'none', padding: '10px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, color: P.ink, fontSize: 13, fontFamily: P.fontSans, outline: 'none' }} />}
        {resp && <PBtn variant="secondary" size="sm" full icon="check" onClick={() => window.M.flash('Response saved for loss prevention')} style={{ marginTop: 10 }}>Save response</PBtn>}
      </div>
    </div>);
}

function cardRows() {
  const live = (window.M.s.completed || []).filter((s) => (s.card || s.cardCharged || 0) > 0);
  const shift = window.MD.SHIFT_COMPLETED.filter((s) => (s.card || 0) > 0);
  const norm = (s) => ({ id: s.taskId || s.id, order: s.order, name: s.name, amt: s.card != null ? s.card : (s.cardCharged || 0), at: typeof s.at === 'number' ? 'just now' : s.at });
  return [...shift.map(norm), ...live.map(norm)];
}

window.DiscrepancyScreen = function DiscrepancyScreen() {
  const P = useP(); const M = window.useM();
  const [view, setView] = React.useState('cash');
  const money = window.HW.fmt.money;

  const cash = cashRows();
  const cashExp = cash.reduce((a, r) => a + r.expected, 0);
  const cashCounted = cash.reduce((a, r) => a + r.counted, 0);
  const cashNet = Math.round((cashCounted - cashExp) * 100) / 100;
  const card = cardRows();
  const cardTotal = card.reduce((a, r) => a + r.amt, 0);
  const inv = window.MD.INV_DISCREPANCY;

  const cashFlags = cash.filter((r) => Math.abs(r.counted - r.expected) >= 0.01).length;
  const statusTone = cashNet === 0 ? P.good : cashNet < 0 ? P.bad : P.warn;
  const statusLabel = cashNet === 0 ? 'Balanced' : cashNet < 0 ? `Short ${money(Math.abs(cashNet))}` : `Over ${money(cashNet)}`;

  const counts = { cash: cashFlags, card: 0, inventory: inv.length };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* summary */}
      <div style={{ padding: '2px 16px 12px', flex: '0 0 auto' }}>
        <div style={{ background: P.rail, borderRadius: P.r20, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>End-of-shift reconciliation</span>
            <div style={{ flex: 1 }} />
            <span style={{ padding: '4px 12px', borderRadius: 99, background: statusTone, color: cashNet < 0 ? '#fff' : P.accentInk, fontSize: 12, fontWeight: 800, fontFamily: P.fontMono }}>{statusLabel}</span>
          </div>
          <div style={{ display: 'flex' }}>
            {[['Cash', money(cashCounted), P.accent], ['Card', money(cardTotal), P.info], ['Inventory', inv.length ? `${inv.length} flag${inv.length > 1 ? 's' : ''}` : 'OK', inv.length ? P.warn : P.good]].map(([k, v, c], i) => (
              <div key={k} style={{ flex: 1, borderLeft: i ? `1px solid ${P.hairline2}` : 'none', paddingLeft: i ? 14 : 0 }}>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', fontFamily: P.fontMono }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c, fontFamily: P.fontMono, marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <Seg full value={view} onChange={setView} options={[{ value: 'cash', label: `Cash${counts.cash ? ' ·' + counts.cash : ''}` }, { value: 'card', label: 'Card' }, { value: 'inventory', label: `Inventory${counts.inventory ? ' ·' + counts.inventory : ''}` }]} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 40px' }}>
        {/* CASH */}
        {view === 'cash' && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Eyebrow>Cash by delivery</Eyebrow><div style={{ flex: 1 }} />{cashFlags > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: P.bad }}>{cashFlags} to review</span>}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cash.map((r) => { const d = Math.round((r.counted - r.expected) * 100) / 100; const ok = Math.abs(d) < 0.01; const tone = ok ? P.good : d < 0 ? P.bad : P.warn; return (
              <div key={r.id} style={{ background: P.surface, border: `1px solid ${ok ? P.hairline2 : tone}`, borderRadius: P.r14, padding: '13px 15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>{r.name}</span><span style={{ padding: '1px 8px', borderRadius: 99, background: P.surface3, color: P.inkDim, fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>{r.method}</span><div style={{ flex: 1 }} /><span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{r.order}</span></div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>Expected</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{money(r.expected)}</div></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>Counted</div><div style={{ fontSize: 15, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono }}>{money(r.counted)}</div></div>
                  <span style={{ padding: '4px 11px', borderRadius: 99, background: ok ? P.goodSoft : d < 0 ? P.badSoft : P.warnSoft, color: tone, fontSize: 12, fontWeight: 800, fontFamily: P.fontMono, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{ok ? <><Icon name="check" size={11} stroke={3} />Match</> : (d < 0 ? '−' : '+') + money(Math.abs(d))}</span>
                </div>
              </div>); })}
          </div>
        </>}

        {/* CARD */}
        {view === 'card' && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', background: P.goodSoft, borderRadius: P.r12, marginBottom: 12 }}><Icon name="check-circle" size={18} stroke={2} color={P.good} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.mode === 'dark' ? P.good : '#1B5E20' }}>Card settles automatically with the processor — nothing to count.</span></div>
          <Eyebrow style={{ marginBottom: 10 }}>Card charges</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {card.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: P.infoSoft, color: P.info, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="card" size={18} stroke={1.9} /></span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>{r.name}</div><div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{r.order} · {r.at}</div></div>
                <span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{money(r.amt)}</span>
              </div>
            ))}
            {card.length === 0 && <div style={{ padding: '30px 0', textAlign: 'center', color: P.inkMute, fontSize: 13 }}>No card charges this shift.</div>}
          </div>
        </>}

        {/* INVENTORY */}
        {view === 'inventory' && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: P.infoSoft, borderRadius: P.r12, marginBottom: 12 }}><Icon name="info" size={16} stroke={2} color={P.info} /><span style={{ fontSize: 12, color: P.info, fontWeight: 600, lineHeight: 1.4 }}>Missing items are matched to the orders they may have affected — check those stops first.</span></div>
          {inv.length === 0 ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', textAlign: 'center' }}><span style={{ width: 70, height: 70, borderRadius: 20, background: P.goodSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Icon name="check-circle" size={34} color={P.good} stroke={1.7} /></span><div style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>Inventory balanced</div><div style={{ fontSize: 13, color: P.inkDim, marginTop: 8 }}>Every item in your van is accounted for.</div></div> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inv.map((d) => <InvCard key={d.id} d={d} />)}
          </div>}
        </>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '12px 14px', background: P.surface2, borderRadius: P.r12 }}>
          <Icon name="info" size={15} stroke={2} color={P.inkMute} />
          <span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.4 }}>Loss prevention reviews and resolves any flags — you don't need to file anything.</span>
        </div>
      </div>
    </div>);
};

Object.assign(window, {});
