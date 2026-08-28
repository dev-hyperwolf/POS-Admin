// ── Weedmaps channel — integrated into the Promotions Suite (pweb) ──────────
// How Weedmaps plugs into Hyperwolf: orders → regions → drivers, sync health,
// and reconciling WM promotions against ours. Uses WM_* data from promo/pdata.
const useP = window.useP;
const { pfmt, WM_REGIONS, WM_LISTINGS, WM_STORE, WM_SYNC, WM_ORDER_FLOW, WM_AUTOMATION } = window;

const WM_ACTOR = { Weedmaps:'#1F5FC0', Hyperwolf:'#15140F', Driver:'#2E7D46', Store:'#B7791F' };

function WmPanel({ title, sub, right, children, pad = 18 }) {
  const P = useP();
  return (
    <div style={{ background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r14, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 18px', borderBottom:`1px solid ${P.hairline}` }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:P.ink }}>{title}</div>
          {sub && <div style={{ fontSize:11.5, color:P.inkDim, marginTop:2, lineHeight:1.45 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding:pad }}>{children}</div>
    </div>);
}

function WmActorChip({ actor }) {
  const c = WM_ACTOR[actor] || '#7C7869';
  return <span style={{ fontSize: 10, fontWeight:800, letterSpacing:'.04em', textTransform:'uppercase', color:'#fff', background:c, borderRadius:20, padding:'2px 8px', whiteSpace:'nowrap' }}>{actor}</span>;
}

function WmOrderFlow() {
  const P = useP();
  return (
    <div style={{ display:'flex', gap:0, overflowX:'auto', paddingBottom:4 }}>
      {WM_ORDER_FLOW.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ flex:'1 0 148px', minWidth:148, background: s.key ? P.accentSoft : P.surface2, border:`1px solid ${s.key ? P.accentBorder : P.hairline2}`, borderRadius:P.r12, padding:'11px 13px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
              <WmActorChip actor={s.actor} /><span style={{ fontFamily:P.fontMono, fontSize:10, fontWeight:800, color:P.inkFaint }}>{i + 1}</span>
            </div>
            <div style={{ fontSize:12.5, fontWeight:700, color:P.ink, lineHeight:1.25, marginBottom:3 }}>{s.t}</div>
            <div style={{ fontSize: 11.5, color:P.inkDim, lineHeight:1.4 }}>{s.d}</div>
          </div>
          {i < WM_ORDER_FLOW.length - 1 && <div style={{ display:'flex', alignItems:'center', color:P.inkFaint, padding:'0 3px' }}><Icon name="chevron-right" size={16} stroke={2.2} /></div>}
        </React.Fragment>))}
    </div>);
}

function WmRegionMap() {
  const P = useP();
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', minWidth:620, borderCollapse:'collapse', fontSize:12.5 }}>
        <thead><tr style={{ background:P.surface2 }}>
          {['Region', 'Zip codes', 'Drivers (on-shift feed the listing)', 'Feeds'].map((h, i) => (
            <th key={i} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>))}
        </tr></thead>
        <tbody>
          {WM_REGIONS.map((r) => {
            const on = r.drivers.filter((d) => d.on).length; const L = WM_LISTINGS[r.listing];
            return (
              <tr key={r.region}>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontWeight:700, color:P.ink }}>{r.region}<div style={{ fontSize:10, fontWeight:500, color: on ? P.good : P.warn, fontFamily:P.fontMono }}>{on}/{r.drivers.length} on shift</div></td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontFamily:P.fontMono, fontSize: 11.5, color:P.ink2 }}>{r.zips.join(' · ')}</td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {r.drivers.map((d) => (
                      <span key={d.n} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize: 11.5, fontWeight:600, padding:'2px 8px', borderRadius:20, background: d.on ? P.goodSoft : P.neutralSoft, color: d.on ? P.good : P.inkDim }}>
                        <span style={{ width:6, height:6, borderRadius:99, background: d.on ? P.good : P.inkMute }} />{d.n} · {d.kit} SKUs</span>))}
                  </div>
                </td>
                <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}><Pill kind={L.kind === 'Pickup' ? 'warn' : 'info'} dot>{L.kind}</Pill></td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>);
}

// ── Weedmaps promotions — the real registry, wired to the real routes ──────
// wmdemo/promos.py + store.py already implement the whole loop: mirror-pull
// (pull_wm_promos), an internal promo registry (upsert_internal_promo /
// delete_internal_promo), named WM<->internal relations — mirrors /
// supersedes / conflict (add_promo_link) — and automatic overlap detection
// with a severity (detect_overlap, check_overlaps). promo_registry() already
// returns the combined "which pairs need a decision" view. Routes, all POST
// (wmdemo/server.py, verified by grep — there is no GET variant, registry
// included): /api/promos/registry, /pull, /link, /link/delete, /internal,
// /internal/delete.
//
// WHAT USED TO BE HERE: a "Push to Weedmaps" table whose Push / Re-sync /
// Pause / Resume buttons faked success via a client-side setTimeout with no
// backing route, and a "WM discounts we mirror" table whose Link / Merge /
// Keep-standalone / Unlink buttons had no onClick handler at all — reading
// from window.WM_PROMOS, a static mock array in promo/pdata.jsx, not
// anything pulled from Weedmaps. Both are replaced by ONE real panel below.
//
// WHY "PUSH" IS GONE, NOT JUST UNWIRED: Weedmaps' partner API has no
// promo-push endpoint at all (wmdemo/config.py's own comment — polling is
// the only mechanism that exists for promotions). A "push our promo to
// Weedmaps" control is not a missing wire, it is a capability that does not
// exist on the other end, so no version of this panel offers one. Creating
// a Weedmaps-side deal happens in their own merchant portal, never here.
//
// `ApplicableDiscountAttributes` (the schema behind every WM promo row) also
// publishes no monetary field of any kind — no amount, percent, discount
// type, scope, stacking rule, or redemption count — which is why the table
// below shows relationships and overlaps, not per-promo revenue or ROI: we
// have no source for those figures, and this panel does not invent one.

function severityMeta(sev) {
  return sev === 'high' ? { kind:'bad', label:'high' } : { kind:'warn', label:'low' };
}
function overlapKindLabel(k) { return k === 'code' ? 'code' : k === 'window' ? 'window' : (k || '—'); }
function fmtPromoWindow(w) {
  const s = (w && w.start) || null, e = (w && w.end) || null;
  if (!s && !e) return 'open-ended';
  return (s || 'open') + ' → ' + (e || 'open');
}
// promos.py's own _on_weedmaps guard, mirrored client-side for the "also run
// on Weedmaps" KPI sublabel — an internal promo's `channels` list is the only
// place that fact lives.
function onWeedmapsChannel(row) {
  const ch = row && row.channels;
  if (!Array.isArray(ch)) return false;
  return ch.some((c) => ['weedmaps', 'wm'].indexOf(String(c).trim().toLowerCase()) !== -1);
}

const PROMO_RELATIONS = [
  { value:'mirrors', title:'Mirrors — same offer, two channels',
    sub:'Redeeming it burns both ledgers. Use this when the WM promo and the internal one are the same real-world deal.' },
  { value:'supersedes', title:'Supersedes — one replaces the other',
    sub:'Informational tag only in this version; does not change which one prices the cart.' },
  { value:'conflict', title:'Conflict — flag it, decide manually',
    sub:'Keeps the alert open but records that a human has seen it.' },
];

// Live read of promos.promo_registry() via HW_PROMOS_LIVE (shared/hw-live-
// promos.js). Read-only, never triggers a WM pull itself — matches the
// server function's own docstring.
function useWmPromoRegistry() {
  const [state, setState] = React.useState({ loading:true, error:null, data:null });
  const refresh = React.useCallback(() => {
    const live = window.HW_PROMOS_LIVE;
    if (!live) {
      setState({ loading:false, error:'shared/hw-live-promos.js is not on this page — there is no live seam to read.', data:null });
      return Promise.resolve(null);
    }
    setState((s) => ({ ...s, loading:true }));
    return live.registry().then((r) => {
      if (r.ok && r.body && !r.body.error) {
        setState({ loading:false, error:null, data:r.body });
        return r.body;
      }
      const msg = (r.body && r.body.error) || r.error || ('HTTP ' + r.code);
      setState((s) => ({ ...s, loading:false, error:msg }));
      return null;
    });
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}

// Relation modal — the ONE write for both flows: resolving a named overlap
// (both sides fixed, from the "unlinked overlaps" list) and linking a WM
// promo to any internal promo by hand (internal side picked from a select).
// Write, then READ BACK to confirm before claiming success — same discipline
// as pos/shell-store.jsx's createVariation / wmdemo/engine.py's
// set_product_published: a 200 from POST /api/promos/link means the gate let
// the write through, not that the registry now shows it.
function LinkModal({ wmId, wmName, internalId, internalName, defaultRelation, internalOptions, onClose, onSaved }) {
  const P = useP();
  const locked = internalId != null;
  const [relation, setRelation] = React.useState(defaultRelation || 'mirrors');
  const [chosen, setChosen] = React.useState(locked ? internalId : '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const save = () => {
    const iid = locked ? internalId : Number(chosen);
    if (!iid) { setErr('Pick an internal promo to link.'); return; }
    const live = window.HW_PROMOS_LIVE;
    if (!live) { setErr('shared/hw-live-promos.js is not on this page — there is no write path to call.'); return; }
    setBusy(true); setErr(null);
    live.link(wmId, iid, relation).then((r) => {
      if (!r.ok || !r.body || r.body.error) {
        setBusy(false);
        setErr((r.body && r.body.error) || r.error || ('HTTP ' + r.code));
        return;
      }
      const linkId = r.body.id;
      onSaved(linkId, iid).then((confirmed) => {
        setBusy(false);
        if (confirmed) { onClose(); }
        else {
          setErr('The write was accepted, but a fresh read of the registry does not show this link yet. Reopen the panel before assuming it failed — do not retry blindly.');
        }
      });
    });
  };

  return <div onClick={onClose} style={window.overlayScrim(P, { z:200, padding:'32px 20px', animate:true })}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width:'min(520px, 96vw)', background:P.surface, border:`1px solid ${P.hairline2}`, borderRadius:P.r16, boxShadow:P.shadowLg, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', borderBottom:`1px solid ${P.hairline}` }}>
        <span style={{ flex:1, minWidth:0, fontSize:13.5, fontWeight:700, color:P.ink }}>Link {wmName}</span>
        <IconBtn icon="x" size={17} onClick={onClose} />
      </div>
      <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:12, color:P.inkDim, lineHeight:1.55 }}>
          {locked
            ? <>An overlap exists between <b>{wmName}</b> (Weedmaps) and <b>{internalName}</b> (internal). Pick what these two rows mean to each other — this does not change what a customer pays; pricing.quote_cart() still applies exactly one price effect per line either way.</>
            : <>Pick an internal promo to pair with <b>{wmName}</b>, and what the pairing means.</>}
        </div>
        {!locked && <div>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.inkMute, marginBottom:5 }}>Internal promo</div>
          <select value={chosen} onChange={(e) => setChosen(e.target.value)}
            style={{ width:'100%', padding:'9px 11px', borderRadius:P.r10, border:`1px solid ${P.hairline2}`, background:P.surface2, color:P.ink, fontSize:12.5 }}>
            <option value="" disabled>Choose one…</option>
            {(internalOptions || []).map((o) => <option key={o.id} value={o.id}>{o.name}{o.code ? ' (' + o.code + ')' : ''}</option>)}
          </select>
        </div>}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {PROMO_RELATIONS.map((r) => (
            <label key={r.value} onClick={() => setRelation(r.value)} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', borderRadius:P.r10, border:`1px solid ${relation === r.value ? P.accentBorder : P.hairline2}`, background: relation === r.value ? P.accentSoft : P.surface2, cursor:'pointer' }}>
              <input type="radio" checked={relation === r.value} onChange={() => setRelation(r.value)} style={{ marginTop:3 }} />
              <div><div style={{ fontSize:12.5, fontWeight:700, color:P.ink }}>{r.title}</div><div style={{ fontSize:11, color:P.inkDim, marginTop:2, lineHeight:1.4 }}>{r.sub}</div></div>
            </label>))}
        </div>
        {err && <div style={{ fontSize:11.5, color:P.ink2, background:P.badSoft, border:`1px solid ${P.bad}`, borderRadius:P.r10, padding:'8px 10px', lineHeight:1.45 }}>{err}</div>}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 18px', borderTop:`1px solid ${P.hairline}` }}>
        <PBtn variant="ghost" onClick={onClose} disabled={busy}>Cancel</PBtn>
        <PBtn variant="accent" onClick={save} busy={busy} disabled={busy || (!locked && !chosen)}>Save link</PBtn>
      </div>
    </div>
  </div>;
}

function RegistryRow({ row, onUnlink, unlinkBusy, unlinkErr, internalOptions, openManualLink }) {
  const P = useP();
  const td = { padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, verticalAlign:'middle' };
  const codeKind = row.side === 'wm'
    ? (row.kind === 'auto' ? 'auto-apply' : 'code' + (row.code ? ' · ' + row.code : ''))
    : (row.kind || '—') + (row.code ? ' · ' + row.code : '');
  const unresolved = (row.overlaps || []).filter((o) => !o.linked);
  return <>
    <tr>
      <td style={td}><Pill kind={row.side === 'wm' ? 'info' : 'neutral'} size="sm">{row.side === 'wm' ? 'weedmaps' : 'internal'}</Pill></td>
      <td style={td}>
        <div style={{ fontWeight:600, color:P.ink }}>{row.name}</div>
        {row.side === 'internal' && row.state === 'inactive' && <div style={{ fontSize:10, color:P.inkFaint }}>inactive</div>}
      </td>
      <td style={{ ...td, fontSize:11.5, color:P.ink2 }}>{codeKind}</td>
      <td style={{ ...td, fontFamily:P.fontMono, fontSize:11 }}>{fmtPromoWindow(row.window)}</td>
      <td style={td}>
        {row.links.length > 0
          ? <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {row.links.map((l) => <div key={l.link_id} style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:11.5, color:P.good, fontWeight:700 }}>{l.relation}</span>
                <span style={{ fontSize:10.5, color:P.inkMute }}>&rarr; {l.other_name}</span>
                <PBtn variant="ghost" size="xs" busy={!!unlinkBusy[l.link_id]} onClick={() => onUnlink(l.link_id)}>Unlink</PBtn>
              </div>)}
              {unlinkErr && <div style={{ fontSize:10.5, color:P.bad }}>{unlinkErr}</div>}
            </div>
          : unresolved.length > 0
            ? <span style={{ fontSize:11.5, color:P.bad, fontWeight:700 }}>unlinked overlap · {unresolved[0].severity}</span>
            : row.side === 'wm'
              ? <PBtn variant="ghost" size="xs" onClick={() => openManualLink(row)}>Link…</PBtn>
              : <span style={{ color:P.inkFaint, fontStyle:'italic' }}>—</span>}
      </td>
    </tr>
  </>;
}

// The real sync surface. Everything on it is either the server's own value
// (promos.promo_registry()) or the direct result of a write this page just
// made and re-read back to confirm.
function WmPromoRegistry({ registry }) {
  const P = useP();
  const { loading, error, data, refresh } = registry;
  const [pullBusy, setPullBusy] = React.useState(false);
  const [pullMsg, setPullMsg] = React.useState(null);
  const [modal, setModal] = React.useState(null);
  const [unlinkBusy, setUnlinkBusy] = React.useState({});
  const [unlinkErrs, setUnlinkErrs] = React.useState({});

  const doPull = () => {
    const live = window.HW_PROMOS_LIVE;
    if (!live) { setPullMsg({ ok:false, text:'shared/hw-live-promos.js is not on this page.' }); return; }
    setPullBusy(true); setPullMsg(null);
    // source:'live' — the real behaviour an operator means by "Pull from
    // Weedmaps". Matches what the server's own background sync loop does
    // every PROMO_POLL_S (wmdemo/server.py:_promo_sync_loop); the route's
    // OWN default when `source` is omitted is 'fixture', which exists as a
    // conservative fallback for a stray call, not what this button should send.
    live.pull({ source:'live' }).then((r) => {
      if (!r.ok || !r.body || r.body.error) {
        setPullBusy(false);
        setPullMsg({ ok:false, text:(r.body && r.body.error) || r.error || ('HTTP ' + r.code) });
        return;
      }
      const b = r.body;
      // Write-then-read-back: re-read the registry so the table reflects
      // what the mirror actually holds now, not a summary of the call.
      refresh().then(() => {
        setPullBusy(false);
        const bits = [(b.pulled || 0) + ' discount row(s) pulled'];
        if ((b.appeared || []).length) bits.push(b.appeared.length + ' appeared');
        if ((b.disappeared || []).length) bits.push(b.disappeared.length + ' disappeared');
        if ((b.alerts || []).length) bits.push('alerts: ' + b.alerts.join('; '));
        setPullMsg({ ok:true, text:bits.join(' · ') });
      });
    });
  };

  const confirmLinked = (linkId, wmId) => refresh().then((fresh) => {
    if (!fresh) { return false; }
    const row = fresh.rows.find((r) => r.side === 'wm' && r.id === wmId);
    return !!(row && row.links.some((l) => l.link_id === linkId));
  });

  const doUnlink = (linkId) => {
    const live = window.HW_PROMOS_LIVE;
    if (!live) { return; }
    setUnlinkBusy((b) => ({ ...b, [linkId]: true }));
    setUnlinkErrs((e) => { const n = { ...e }; delete n[linkId]; return n; });
    live.unlink(linkId).then((r) => refresh().then((fresh) => {
      setUnlinkBusy((b) => { const n = { ...b }; delete n[linkId]; return n; });
      // Read-back confirm: if the link is STILL in the fresh registry, the
      // delete did not land, whatever HTTP code came back.
      const stillThere = fresh && fresh.rows.some((row) => row.links.some((l) => l.link_id === linkId));
      if (stillThere || !r.ok) {
        setUnlinkErrs((e) => ({ ...e, [linkId]: (r.body && r.body.error) || r.error ||
          (stillThere ? 'Still shows linked after a fresh read — the delete did not land.' : ('HTTP ' + r.code)) }));
      }
    }));
  };

  if (loading && !data) {
    return <WmPanel title="Promo registry" sub="Reading /api/promos/registry…">
      <div style={{ padding:24, textAlign:'center', color:P.inkMute, fontSize:12.5 }}>Loading…</div>
    </WmPanel>;
  }
  if (error && !data) {
    return <WmPanel title="Promo registry" sub="Could not read the registry.">
      <div style={{ padding:'13px 15px', background:P.badSoft, border:`1px solid ${P.bad}`, borderRadius:P.r10, color:P.ink2, fontSize:12.5, lineHeight:1.5 }}>{error}</div>
    </WmPanel>;
  }

  const counters = data.counters;
  const inRows = data.rows.filter((r) => r.side === 'internal');
  const internalOptions = inRows.filter((r) => r.state !== 'inactive');
  const onWmCount = inRows.filter(onWeedmapsChannel).length;

  return <>
    <WmPanel title="Promo registry" pad={0}
      sub="One-way pull, side-by-side registry, and the three real relations you can declare between a Weedmaps promo and one of ours. No control here claims Weedmaps can be pushed to — its partner API has no promo-push endpoint."
      right={<div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
        <PBtn variant="secondary" size="sm" icon="refresh" busy={pullBusy} onClick={doPull}>Pull from Weedmaps</PBtn>
        {pullMsg && <span style={{ fontSize:10.5, color: pullMsg.ok ? P.good : P.bad, maxWidth:340, textAlign:'right' }}>{pullMsg.text}</span>}
      </div>}>
      <div style={{ padding:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom: counters.unlinked_overlaps ? 18 : 14 }}>
          <KPI label="WM promos mirrored" value={String(counters.wm)} sublabel="live on the mirror" icon="gift" />
          <KPI label="Internal promos" value={String(counters.internal)} sublabel={onWmCount + ' also run on Weedmaps'} icon="tag" />
          <KPI label="Linked pairs" value={String(counters.linked)} sublabel="acknowledged, no longer alertable" icon="link" />
          <KPI label="Unlinked overlaps" value={String(counters.unlinked_overlaps)} sublabel="need a decision" icon="shield" accent={counters.unlinked_overlaps > 0} />
        </div>

        {counters.unlinked_overlaps > 0 && <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:P.inkDim, marginBottom:9 }}>Unlinked overlaps — need a decision</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {data.unlinked_overlaps.map((o) => {
              const sm = severityMeta(o.severity);
              return <div key={o.wm_promo_id + '|' + o.internal_promo_id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', background:P.surface2, border:`1px solid ${P.hairline2}`, borderRadius:P.r10 }}>
                <Pill kind={sm.kind} size="sm">{sm.label} · {overlapKindLabel(o.kind)}</Pill>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, color:P.ink }}><b>{o.wm_name}</b> (Weedmaps) overlaps <b>{o.internal_name}</b> (internal)</div>
                  <div style={{ fontSize:11, color:P.inkDim, marginTop:2, lineHeight:1.4 }}>{(o.reasons || [])[0]}</div>
                </div>
                <PBtn variant="secondary" size="xs" onClick={() => setModal({ wmId:o.wm_promo_id, wmName:o.wm_name, internalId:o.internal_promo_id, internalName:o.internal_name, defaultRelation: o.kind === 'code' ? 'mirrors' : 'conflict' })}>Resolve</PBtn>
              </div>;
            })}
          </div>
        </div>}

        <div>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase', color:P.inkDim, marginBottom:9 }}>Full registry</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:820, borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:P.surface2 }}>
                {['Side', 'Name', 'Code / kind', 'Window', 'Links'].map((h) => <th key={h} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.rows.map((r) => <RegistryRow key={r.side + r.id} row={r} onUnlink={doUnlink}
                  unlinkBusy={unlinkBusy} unlinkErr={r.links.some((l) => unlinkErrs[l.link_id]) ? Object.values(unlinkErrs)[0] : null}
                  internalOptions={internalOptions}
                  openManualLink={(row) => setModal({ wmId:row.id, wmName:row.name })} />)}
                {data.rows.length === 0 && <tr><td colSpan={5} style={{ padding:34, textAlign:'center', color:P.inkMute }}>Nothing mirrored yet — pull from Weedmaps, or add an internal promo.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </WmPanel>

    {modal && <LinkModal {...modal} internalOptions={internalOptions}
      onClose={() => setModal(null)}
      onSaved={(linkId) => confirmLinked(linkId, modal.wmId)} />}
  </>;
}

window.WeedmapsView = function WeedmapsView({ onOpen, onOpenWm }) {
  const P = useP();
  const registry = useWmPromoRegistry();
  const rc = registry.data && registry.data.counters;

  const kpis = [
    { label:'Products mapped', value:`${WM_SYNC.productsMapped}/${WM_SYNC.productsTotal}`, sublabel:`${WM_SYNC.review} in review`, icon:'package' },
    { label:'Unlinked promo overlaps',
      value: rc ? String(rc.unlinked_overlaps) : (registry.loading ? '…' : '—'),
      sublabel: rc ? `${rc.linked} linked · ${rc.wm} WM mirrored` : (registry.error ? 'registry unavailable' : ''),
      icon:'gift', accent: !!(rc && rc.unlinked_overlaps > 0) },
    { label:'WM orders today', value:pfmt.num(WM_SYNC.ordersToday), sublabel:'auto-routed', icon:'truck' },
    { label:'Push latency', value:`${WM_SYNC.p50}ms`, sublabel:`p95 ${WM_SYNC.p95}ms`, icon:'refresh' },
    { label:'Sync errors 60s', value:WM_SYNC.errors, sublabel:`reconcile ${WM_SYNC.lastReconcile}`, icon:'shield', accent:WM_SYNC.errors > 0 },
    { label:'API token', value:`${WM_SYNC.tokenDays}d`, sublabel:'auto-renews', icon:'clock' },
  ];

  return (
    <div style={{ maxWidth:1320, margin:'0 auto' }}>
      <SectionHead level={1} eyebrow="Channel" title="Weedmaps"
        subtitle="How Weedmaps plugs into Hyperwolf — orders, regions, drivers and promotions. Almost all of it runs in the background; you only step in when the logic can’t resolve something itself."
        action={<Pill kind="good" dot>Live · event-driven</Pill>} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:22 }}>
        {kpis.map((k) => <KPI key={k.label} {...k} />)}
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPromoRegistry registry={registry} />
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="How a Weedmaps order reaches a driver" sub="A customer’s cart on Weedmaps becomes a routed, driver-assigned order in seconds. Highlighted steps are where our logic decides who can fulfil it.">
          <WmOrderFlow />
          <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10, padding:'11px 13px' }}>
              <div style={{ fontSize: 11.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.info, marginBottom:4 }}>Delivery orders</div>
              <div style={{ fontSize: 12.5, color:P.ink2, lineHeight:1.55 }}>Come from Weedmaps → we resolve <b>zip → region → one on-shift driver</b>, and only offer SKUs in that driver’s kit. The order binds to that driver.</div>
            </div>
            <div style={{ background:P.surface2, border:`1px solid ${P.hairline}`, borderRadius:P.r10, padding:'11px 13px' }}>
              <div style={{ fontSize: 11.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:P.warn, marginBottom:4 }}>Pickup orders</div>
              <div style={{ fontSize: 12.5, color:P.ink2, lineHeight:1.55 }}>Also from Weedmaps, but fulfilled from <b>store on-hand stock</b> — no driver, no routing. The order binds to the <b>{WM_STORE.name}</b> store and is marked ready for pickup.</div>
            </div>
          </div>
        </WmPanel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16, marginBottom:22 }}>
        <WmPanel title="Regions → drivers → Weedmaps listing" sub="Each region maps to a set of zips and drivers. On-shift drivers’ kits decide what the Delivery listing can sell right now.">
          <WmRegionMap />
        </WmPanel>
        <WmPanel title="The two Weedmaps listings" sub="Same catalog, different availability rules.">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {Object.values(WM_LISTINGS).map((l) => (
              <div key={l.id} style={{ border:`1px solid ${P.hairline2}`, borderLeft:`3px solid ${l.kind === 'Pickup' ? P.warn : P.info}`, borderRadius:P.r10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize: 13.5, fontWeight:700, color:P.ink }}>{l.name}</span>
                  <Pill kind={l.kind === 'Pickup' ? 'warn' : 'info'}>{l.kind}</Pill>
                </div>
                <div style={{ fontSize: 11.5, color:P.inkDim, fontFamily:P.fontMono, marginBottom:4 }}>wmid {l.id} · {l.policy}</div>
                <div style={{ fontSize:11.5, color:P.ink2, lineHeight:1.45 }}>{l.desc}</div>
              </div>))}
          </div>
        </WmPanel>
      </div>

      <div style={{ marginBottom:22 }}>
        <WmPanel title="What runs itself — and when we ask a human" sub="Mapping and routing are automated end-to-end. A person is only pulled in for the cases the logic can’t safely resolve.">
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:680, borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:P.surface2 }}>
                {['Area', 'How it works', 'Automatic', 'Needs a human'].map((h, i) => (
                  <th key={i} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:P.inkDim, borderBottom:`1px solid ${P.hairline2}` }}>{h}</th>))}
              </tr></thead>
              <tbody>
                {WM_AUTOMATION.map((a) => (
                  <tr key={a.area}>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, fontWeight:700, color:P.ink, whiteSpace:'nowrap' }}>{a.area}</td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, color:P.ink2, lineHeight:1.45 }}>{a.how}</td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}` }}><span style={{ display:'inline-flex', alignItems:'center', gap:6, color:P.good, fontWeight:600 }}><Icon name="check" size={13} stroke={2.6} />{a.auto}</span></td>
                    <td style={{ padding:'11px 14px', borderTop:`1px solid ${P.hairline}`, color:P.warn, fontWeight:600 }}>{a.human}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </WmPanel>
      </div>

    </div>);
};
