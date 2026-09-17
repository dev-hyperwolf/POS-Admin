// ── shared/hw-dist-ui.jsx ── Distribution/Refill shared components ─────────
// IIFE. Publishes window.HWDistUI. The five (plus one) pieces every Refill
// concept already shares (docs/codebase-audit/distribution/REFILL-CONCEPTS.md:
// Region -> Kit -> Boxes, a preview before commit, a received-last-7-days
// lane with "Send today", a status timeline, a skips-and-shortfalls panel —
// per BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §3.2 these become data-bound
// components with NO PAGE LAYOUT; the winning concept composes them once JT
// names it (owner rule — no console page here).
//
// EVERY COMPONENT: data props + callbacks only. Nothing in this file calls
// fetch, HW_LIVE or HWDistData — shared/hw-dist-data.js is the only thing
// that talks to the network; a page (or explorations/Distribution Components
// - Bench.html) wires the two together.
//
// ROUTE COVERAGE (docs/codebase-audit/distribution/CONSOLE-ENDPOINT-MAP.md §B):
//   KitBoxTree       -> GET /api/inventory/locations
//   PlanPreviewTable -> GET /api/inventory/restock/preview (+ GET .../batches for the per-line enrichment)
//   ReceivedLane     -> GET /api/inventory/received?day=  (looped) ; "Send today" -> POST /api/inventory/restock/apply
//   SkipsPanel       -> GET /api/inventory/restock/preview (plan.skipped[]/warnings[])
//   StatusTimeline   -> NO ROUTE (census item 21) -- display-only, note shown always
//   BoxTypesManager  -> NO ROUTE (census item 22) -- display-only, note shown always
//
// Vocabulary: Region -> Kit (one per driver) -> Boxes. Box types are DATA —
// "Flower Box 1", "Pre-Roll Box 2", "Cooler", "Concentrate Bin 1", "Edible
// Bin" — never an invented code. Batch / batch_no / THC / packaged date;
// never a Metrc tag on an operator screen.
;(function () {
  const useP = window.useP;

  function Icon(props) { return window.Icon ? <window.Icon {...props} /> : null; }
  function HDPill(props) { return window.HDPill ? <window.HDPill {...props} /> : <span>{props.label}</span>; }

  // A one-line, always-visible banner for the two census items with no
  // backing route. Never hidden behind a prop — the "no live source yet"
  // note is the whole point of shipping these two at all.
  function NoRouteNote({ P, text }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginBottom: 8, borderRadius: P.r10 || 8, background: P.highlightSoft, border: `1px dashed ${P.hairline3}`, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontSans }}>
        <Icon name="info" size={12} stroke={2} />
        <span>{text}</span>
      </div>
    );
  }

  function reasonsText(reasons) {
    if (!reasons) { return '—'; }
    if (Array.isArray(reasons)) { return reasons.length ? reasons.join('; ') : '—'; }
    return String(reasons);
  }

  function dash(v) { return (v === undefined || v === null || v === '') ? '—' : v; }

  // ── 1. KitBoxTree — Region -> Kit -> Boxes ─────────────────────────────
  // props: { tree: [regionNode...] } (shape from HWDistData.fetchKitBoxTree,
  //   each node = the location record + children[]), selectedId, onSelect(node).
  // Box type NAME is whatever the location record carries — never invented.
  window.HWDistUI = window.HWDistUI || {};
  window.HWDistUI.KitBoxTree = function KitBoxTree({ tree = [], selectedId, onSelect, style }) {
    const P = useP();
    const [collapsed, setCollapsed] = React.useState({});
    const toggle = (id) => setCollapsed((c) => Object.assign({}, c, { [id]: !c[id] }));

    function row(node, depth, iconName) {
      const isOpen = !collapsed[node.id];
      const hasKids = node.children && node.children.length > 0;
      const isSel = node.id === selectedId;
      return (
        <div key={node.id}>
          <div
            onClick={() => onSelect && onSelect(node)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: onSelect ? 'pointer' : 'default',
              padding: '5px 8px', paddingLeft: 8 + depth * 16, borderRadius: 7,
              background: isSel ? P.highlightSoft : 'transparent', fontFamily: P.fontSans, fontSize: 13
            }}
            onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = P.surface2; }}
            onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
          >
            {hasKids ? (
              <span onClick={(e) => { e.stopPropagation(); toggle(node.id); }} style={{ display: 'inline-flex', width: 14, height: 14, color: P.inkMute }}>
                <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} stroke={2.2} />
              </span>
            ) : <span style={{ width: 14 }} />}
            <Icon name={iconName} size={13} stroke={1.8} style={{ color: P.inkMute, flex: '0 0 auto' }} />
            <span style={{ color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || node.id}</span>
            {node.code && <span style={{ color: P.inkFaint, fontFamily: P.fontMono, fontSize: 11 }}>{node.code}</span>}
            {node.active === false && <HDPill tone="neutral" label="inactive" size="sm" />}
          </div>
          {hasKids && isOpen && node.children.map((child) =>
            row(child, depth + 1, node.kind === 'region' ? 'truck' : 'box'))}
        </div>
      );
    }

    return (
      <div style={{ fontFamily: P.fontSans, ...style }}>
        {tree.length === 0
          ? <div style={{ padding: 12, fontSize: 12.5, color: P.inkMute }}>No regions loaded.</div>
          : tree.map((region) => row(region, 0, 'map-pin'))}
      </div>
    );
  };

  // ── 2. PlanPreviewTable — sold · need · cap · will give · reason ───────
  // props: { lines: plan.lines[] (from HWDistData.fetchRestockPreview),
  //   batchesBySku: { [sku or product_id]: { batches, mixed } } (optional,
  //   from HWDistData.fetchBatches — enrichment only, never required),
  //   style }. No math: sold/need/cap/give are rendered exactly as given.
  window.HWDistUI.PlanPreviewTable = function PlanPreviewTable({ lines = [], batchesBySku = {}, style }) {
    const P = useP();
    const HDTable = window.HDTable, TH = window.TH, TR = window.TR, TD = window.TD;
    if (!HDTable) { return null; }
    return (
      <div style={{ overflowX: 'auto', ...style }}>
        <HDTable>
          <thead>
            <tr>
              <TH>Product</TH>
              <TH align="right">Sold</TH>
              <TH align="right">Need</TH>
              <TH align="right">Cap</TH>
              <TH align="right">Will give</TH>
              <TH>Reason</TH>
              <TH>Batch</TH>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <TR><TD colSpan={7} style={{ color: P.inkMute, textAlign: 'center', padding: 18 }}>No lines in this plan.</TD></TR>
            )}
            {lines.map((line, i) => {
              const key = line.product_id || line.sku || i;
              const batchInfo = batchesBySku[line.product_id] || batchesBySku[line.sku];
              const firstBatch = batchInfo && batchInfo.batches && batchInfo.batches[0];
              return (
                <TR key={key}>
                  <TD>{dash(line.product_name || line.product_id)}</TD>
                  <TD align="right" mono>{dash(line.sold)}</TD>
                  <TD align="right" mono>{dash(line.need)}</TD>
                  <TD align="right" mono>{dash(line.cap)}</TD>
                  <TD align="right" mono>{dash(line.give)}</TD>
                  <TD>{reasonsText(line.reasons)}</TD>
                  <TD>
                    {firstBatch ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: P.fontMono, fontSize: 11.5 }}>
                        <span>{dash(firstBatch.batch_no)}</span>
                        <span style={{ color: P.inkMute }}>{firstBatch.thc_pct != null ? `${firstBatch.thc_pct}% THC` : ''}</span>
                        <span style={{ color: P.inkMute }}>{dash(firstBatch.packaged_date)}</span>
                        {batchInfo.mixed && <HDPill tone="warn" label="Mixed batch" size="sm" />}
                      </div>
                    ) : <span style={{ color: P.inkFaint }}>{dash(line.batch_id)}</span>}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </HDTable>
      </div>
    );
  };

  // ── 3. ReceivedLane — received in the last 7 days + "Send today" ──────
  // props: { days: [{day, ok, received[], error?}] (HWDistData.
  //   fetchReceivedLast7Days's own shape), onSendToday(dayEntry) (optional —
  //   bound by the CALLER to HWDistData.applyRestockPlan; the route exists
  //   (POST /api/inventory/restock/apply per census §A "Move to floor"), so
  //   omitting the callback here just disables the button rather than
  //   inventing a client-side send), sendingDay, style }.
  window.HWDistUI.ReceivedLane = function ReceivedLane({ days = [], onSendToday, sendingDay, style }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: P.fontSans, ...style }}>
        {days.length === 0 && <div style={{ fontSize: 12.5, color: P.inkMute, padding: 8 }}>No received data loaded.</div>}
        {days.map((d) => {
          const count = (d.received || []).length;
          return (
            <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: P.r10 || 8, border: `1px solid ${P.hairline2}`, background: P.surface }}>
              <Icon name="inbox" size={14} stroke={1.8} style={{ color: P.inkMute }} />
              <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, width: 92 }}>{d.day}</span>
              {d.ok === false ? (
                <span style={{ fontSize: 12, color: P.inkMute }}>could not load ({dash(d.error)})</span>
              ) : (
                <span style={{ fontSize: 12.5, color: P.inkDim }}>{count} item{count === 1 ? '' : 's'} received</span>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                disabled={!onSendToday || sendingDay === d.day || d.ok === false || count === 0}
                onClick={() => onSendToday && onSendToday(d)}
                title={!onSendToday ? 'no send handler wired' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 99,
                  fontSize: 12, fontWeight: 500, fontFamily: P.fontSans, cursor: onSendToday ? 'pointer' : 'not-allowed',
                  background: onSendToday ? P.accent : P.disabledBg, color: onSendToday ? P.accentInk : P.disabledInk,
                  border: `1px solid ${onSendToday ? P.accentBorder : P.disabledBorder}`, opacity: (d.ok === false || count === 0) ? 0.5 : 1
                }}
              >
                <Icon name="send" size={11} stroke={2} />
                {sendingDay === d.day ? 'Sending…' : 'Send today'}
              </button>
            </div>
          );
        })}
        {!onSendToday && days.length > 0 && (
          <div style={{ fontSize: 11, color: P.inkFaint, padding: '2px 2px 0' }}>
            "Send today" posts to POST /api/inventory/restock/apply — wire onSendToday to HWDistData.applyRestockPlan to enable it.
          </div>
        )}
      </div>
    );
  };

  // ── 4. StatusTimeline — day's status per kit ───────────────────────────
  // NO ROUTE (census item 21: GET /api/inventory/restock/events?since=&kit_id=
  // does not exist). Display-only, props-in: { events: [{kind, actor, at,
  // detail}] } — accepted so a future page can hand it real data the moment
  // the route ships, but the note is shown unconditionally.
  window.HWDistUI.StatusTimeline = function StatusTimeline({ events = [], style }) {
    const P = useP();
    return (
      <div style={{ fontFamily: P.fontSans, ...style }}>
        <NoRouteNote P={P} text="No live source yet — census item 21 (GET /api/inventory/restock/events) is not built. Shown here with example data only." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.length === 0 && <div style={{ fontSize: 12.5, color: P.inkMute }}>No events supplied.</div>}
          {events.map((ev, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, background: P.surface2, fontSize: 12.5 }}>
              <Icon name="clock" size={12} stroke={1.9} style={{ color: P.inkMute }} />
              <span style={{ fontWeight: 500, color: P.ink }}>{dash(ev.kind)}</span>
              <span style={{ color: P.inkDim }}>{dash(ev.detail)}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: P.inkMute, fontFamily: P.fontMono, fontSize: 11 }}>{dash(ev.actor)}</span>
              <span style={{ color: P.inkFaint, fontFamily: P.fontMono, fontSize: 11 }}>{dash(ev.at)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── 5. SkipsPanel — skips and shortfalls, in plain words ───────────────
  // props: { skipped: plan.skipped[], warnings: plan.warnings[] } (from
  // HWDistData.fetchSkips / fetchRestockPreview).
  window.HWDistUI.SkipsPanel = function SkipsPanel({ skipped = [], warnings = [], style }) {
    const P = useP();
    return (
      <div style={{ fontFamily: P.fontSans, display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
        {warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: P.inkDim }}>
                <Icon name="flag" size={12} stroke={2} style={{ color: P.inkMute, marginTop: 2 }} />
                <span>{typeof w === 'string' ? w : JSON.stringify(w)}</span>
              </div>
            ))}
          </div>
        )}
        {skipped.length === 0
          ? <div style={{ fontSize: 12.5, color: P.inkMute }}>Nothing was skipped.</div>
          : skipped.map((s, i) => (
            <div key={s.product_id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: P.r10 || 8, border: `1px solid ${P.hairline2}`, background: P.surface }}>
              <Icon name="alert" size={14} stroke={1.8} style={{ color: P.inkMute, flex: '0 0 auto' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dash(s.product_name || s.product_id)}</div>
                <div style={{ fontSize: 12, color: P.inkDim }}>{reasonsText(s.reasons)}</div>
              </div>
              {s.need != null && <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkMute }}>need {s.need}</span>}
              {s.cap != null && <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkMute }}>cap {s.cap}</span>}
            </div>
          ))}
      </div>
    );
  };

  // ── 6. BoxTypesManager — "Manage box types" ────────────────────────────
  // NO ROUTE (census item 22: no create/list/edit route for box types).
  // Display-only, props-in: { boxTypes: [{id, name, category, capacity_units,
  // active, region_id}] }. Box types are DATA (Flower Box 1, Pre-Roll Box 2,
  // Cooler, Concentrate Bin 1, Edible Bin…) — this component never invents a
  // code and never renders create/edit/delete controls.
  window.HWDistUI.BoxTypesManager = function BoxTypesManager({ boxTypes = [], style }) {
    const P = useP();
    return (
      <div style={{ fontFamily: P.fontSans, ...style }}>
        <NoRouteNote P={P} text="No live source yet — census item 22 (box-types CRUD) is not built. List only; no create/edit here." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {boxTypes.length === 0 && <div style={{ fontSize: 12.5, color: P.inkMute }}>No box types supplied.</div>}
          {boxTypes.map((bt) => (
            <div key={bt.id || bt.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, background: P.surface2, fontSize: 12.5 }}>
              <Icon name="package" size={13} stroke={1.8} style={{ color: P.inkMute }} />
              <span style={{ color: P.ink }}>{dash(bt.name)}</span>
              {bt.category && <span style={{ color: P.inkMute }}>({bt.category})</span>}
              <div style={{ flex: 1 }} />
              {bt.capacity_units != null && <span style={{ fontFamily: P.fontMono, color: P.inkMute }}>{bt.capacity_units} cap</span>}
              {bt.active === false && <HDPill tone="neutral" label="inactive" size="sm" />}
            </div>
          ))}
        </div>
      </div>
    );
  };
})();
