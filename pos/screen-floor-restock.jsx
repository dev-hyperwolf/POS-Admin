// ── pos/screen-floor-restock.jsx ── Floor Restock (Store — Concept A) ───────
// Built straight from explorations/Store - Concept A - Floor Restock.html
// (owner decision D3) against the four live routes this build's endpoint
// census confirmed (docs/codebase-audit/distribution/CONSOLE-ENDPOINT-MAP.md
// section A): GET .../restock/preview, POST .../restock/plan, POST
// .../restock/apply, GET .../restock/slip, plus GET /api/inventory/locations
// for the shelf picker. All five go through shared/hw-restock.js
// (window.HWRestock), which itself goes through window.HW_LIVE — this file
// has no fetch of its own.
//
// ONE GAP FROM THE MOCKUP, A DATA GAP RATHER THAN A MISSING ROUTE — see the
// build report for the full account:
//
//   1. "Manage shelf pars" (the mockup's dashed pill) has NO ROUTE — confirmed
//      in the endpoint census and in wmdemo/restock_engine.py's own adapter
//      docstring ("no par/template table wired into wm-demo"). Per this
//      build's hard rule, a control with no route is OMITTED, not stubbed.
//      Consequence: the mockup's PAR and ON SHELF columns have no live field
//      behind them either (need/cap ARE demand-derived, not par-derived —
//      plan_restock's `need` is literally the sold count in the window, and
//      `cap` mirrors it). This screen's table shows SOLD · NEED · CAP · GIVE
//      · REASON — the PlanLine contract's own field names — instead of
//      inventing ON SHELF/PAR numbers no route returns.
//
// batch_no / thc_pct / packaged_at ARE now structured PlanLine fields (contract
// 0.5.0, additive — batch is the unit of control everywhere, owner ruling).
// restock_engine.py populates them from batch_meta for every line; batchDetailLine()
// below renders "batch_no · NN% THC · packaged YYYY-MM-DD" from them and falls back
// to the free-text `note` only when batch_no is null (no batch_meta for that batch_id).
//
// RFID-first apply, per wmdemo/inventory_api.py's _restock_apply: a give>0
// line applies untagged when the POST carries no `read` at all; with
// `read.tag_ids`, a line applies BY TAG only when every unit backing its
// `give` count was scanned, and a gap comes back in the apply response's
// `skipped` as reason 'hand_count_required' — UNLESS the poster had already
// stamped `hand_counted: true` on that PlanLine (contract-legal:
// PlanLine.additionalProperties is true), which applies it qty-only. So the
// RFID panel is client-side tag collection ONLY (no separate RFID endpoint
// call) and "hand count required" is only knowable from an apply() response,
// never predicted client-side — this screen surfaces it and lets the
// operator mark those specific lines hand_counted and resubmit.
//
// Nothing here computes `give`. Every number rendered is read straight off a
// Plan/PlanLine the server returned.
;(function () {
  'use strict';
  const useP = window.useP;

  // The Floor Restock persona Store Concept A itself names (the mockup's
  // ACTOR literal) — same convention pos/screen-identity-binding.jsx uses for
  // its own local ACTOR const: no module boundary reaches pos/app.jsx's USER
  // from here, so this screen owns its own attribution string, sent verbatim
  // to plan()/apply() and nothing else.
  const ACTOR = 'Marcus D.';
  const STATION_ID = 'floor-restock-1'; // attribution only; appended server-side to the move note

  function isoStartOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  function fmtWhen(iso) {
    if (!iso) { return '—'; }
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  // display formatting only — never fed back into a request
  function toDatetimeLocal(iso) {
    if (!iso) { return ''; }
    try {
      var d = new Date(iso);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return ''; }
  }
  function fromDatetimeLocal(v) {
    if (!v) { return null; }
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  var REASON_LABEL = {
    short_stock: 'Short stock in safe',
    capped: 'Capped to observed demand',
    partial_placement: 'Partial placement — safe could not cover the whole line',
    below_subregion_count: 'Below sub-region count',
    mixed_batch: 'Mixed batch',
    new_arrival: 'New arrival',
    sold: 'Register sale since last restock',
    oldest_first: 'Oldest batch first'
  };
  function reasonLabel(r) { return REASON_LABEL[r] || r; }

  // Parses the RFID panel's free-text paste/scan box into a de-duped tag id
  // list — text splitting for display/input purposes, not arithmetic on any
  // contract number.
  function parseTagIds(text) {
    return Array.from(new Set(String(text || '').split(/[\s,]+/).map(function (s) { return s.trim(); }).filter(Boolean)));
  }

  function lineKey(line) { return (line.product_id || '') + '::' + (line.batch_id || ''); }

  function groupByProduct(lines) {
    var order = [], byKey = {};
    (lines || []).forEach(function (l) {
      var k = l.product_id;
      if (!byKey[k]) { byKey[k] = { product_id: k, lines: [] }; order.push(k); }
      byKey[k].lines.push(l);
    });
    return order.map(function (k) { return byKey[k]; });
  }

  // ── the shelf picker ───────────────────────────────────────────────────
  function LocPicker({ label, value, onChange, options, placeholder }) {
    const P = useP();
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
        <select value={value || ''} onChange={function (e) { onChange(e.target.value); }}
          style={{ height: 38, borderRadius: P.r10, border: '1px solid ' + P.hairline3, background: P.field || P.surface, color: P.ink, padding: '0 10px', fontSize: 13, fontFamily: P.fontSans, minWidth: 220 }}>
          <option value="">{placeholder || 'Select…'}</option>
          {options.map(function (o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
        </select>
      </label>);
  }

  // batch_no/thc_pct/packaged_at are structured PlanLine fields as of contract 0.5.0
  // (populated from batch_meta server-side). Show them when present; a line whose
  // batch_id has no meta (batch_no null) falls back to the free-text `note` instead.
  function batchDetailLine(line) {
    if (line.batch_no == null) return null;
    var parts = [line.batch_no];
    if (line.thc_pct != null) parts.push(line.thc_pct + '% THC');
    if (line.packaged_at) parts.push('packaged ' + line.packaged_at.slice(0, 10));
    return parts.join(' · ');
  }

  // ── one PlanLine row ───────────────────────────────────────────────────
  function LineRow({ line, exceptionReason, handCounted, onToggleHandCounted }) {
    const P = useP();
    var loud = !!line.mixed_batch;
    var bg = loud ? P.badSoft : (exceptionReason ? P.warnSoft : 'transparent');
    var detail = batchDetailLine(line);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 64px 64px 64px 74px 1.5fr', gap: 8, alignItems: 'flex-start', padding: '7px 10px', background: bg, borderRadius: 8, fontSize: 12 }}>
        <div style={{ fontFamily: P.fontMono, color: P.inkDim, minWidth: 0 }}>
          <b style={{ color: P.ink }}>batch {line.batch_id}</b>
          {(detail || line.note) && <div style={{ fontSize: 10.5, color: loud ? P.bad : P.inkMute, marginTop: 2, lineHeight: 1.35 }}>{detail || line.note}</div>}
        </div>
        <div style={{ fontFamily: P.fontMono, textAlign: 'right', color: P.ink2 }}>{line.sold ?? 0}</div>
        <div style={{ fontFamily: P.fontMono, textAlign: 'right', color: P.ink2 }}>{line.need ?? 0}</div>
        <div style={{ fontFamily: P.fontMono, textAlign: 'right', color: P.ink2 }}>{line.cap ?? 0}</div>
        <div style={{ fontFamily: P.fontMono, textAlign: 'right', fontWeight: 700, color: P.ink }}>{line.give ?? 0}</div>
        <div style={{ fontSize: 10.5, color: P.inkMute, lineHeight: 1.4 }}>
          {loud && <Pill kind="bad" size="sm" style={{ marginRight: 4, marginBottom: 3 }}>LOUD — second batch joins this shelf</Pill>}
          {exceptionReason === 'hand_count_required' && <Pill kind="warn" size="sm" style={{ marginRight: 4, marginBottom: 3 }}>HAND COUNT</Pill>}
          {(line.reasons || []).map(reasonLabel).join(' · ')}
          {exceptionReason === 'hand_count_required' && (
            <div style={{ marginTop: 5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: P.ink2 }}>
                <Check on={!!handCounted} onChange={onToggleHandCounted} size={16} />
                <span>Hand counted — no RFID tag, apply qty only</span>
              </label>
            </div>
          )}
        </div>
      </div>);
  }

  function ShelfTable({ lines, skippedByKey, handCountedByKey, onToggleHandCounted }) {
    const P = useP();
    var groups = groupByProduct(lines);
    if (!groups.length) {
      return <window.HDEmpty icon="package" title="Nothing to move"
        body="No register sales since the chosen time at this shelf — plan_restock only proposes a line where the shelf actually sold something." />;
    }
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 64px 64px 64px 74px 1.5fr', gap: 8, padding: '0 10px 6px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: P.inkMute, borderBottom: '1px solid ' + P.hairline }}>
          <div>Batch</div><div style={{ textAlign: 'right' }}>Sold</div><div style={{ textAlign: 'right' }}>Need</div>
          <div style={{ textAlign: 'right' }}>Cap</div><div style={{ textAlign: 'right' }}>Give</div><div>Reason</div>
        </div>
        {groups.map(function (g) {
          return (
            <div key={g.product_id} style={{ padding: '8px 0', borderBottom: '1px solid ' + P.hairline }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink, padding: '0 10px 4px', fontFamily: P.fontMono }}>{g.product_id}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.lines.map(function (line, i) {
                  var k = lineKey(line);
                  var skip = skippedByKey[k];
                  return <LineRow key={k + '#' + i} line={line} exceptionReason={skip ? skip.reason : null}
                    handCounted={!!handCountedByKey[k]} onToggleHandCounted={function () { onToggleHandCounted(k); }} />;
                })}
              </div>
            </div>);
        })}
      </div>);
  }

  // ── RFID read panel ────────────────────────────────────────────────────
  function RfidPanel({ tagText, onChangeTagText, tagCount }) {
    const P = useP();
    return (
      <Card density="default" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="scan" size={16} color={P.ink2} />
          <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>RFID read</div>
          <Pill kind={tagCount ? 'good' : 'neutral'} size="sm">{tagCount} tag{tagCount === 1 ? '' : 's'} read</Pill>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 8 }}>
          Paste or scan RFID tag ids before committing — one per line or comma-separated. A give line applies by tag
          only when every unit it needs was read here; a gap comes back flagged for hand count after "Move to floor".
        </div>
        <textarea value={tagText} onChange={function (e) { onChangeTagText(e.target.value); }} rows={3} placeholder="e.g. E200 3412 0198 4471&#10;E200 3412 0198 4472"
          style={{ width: '100%', borderRadius: 8, border: '1px solid ' + P.hairline3, background: P.field || P.surface, color: P.ink, fontFamily: P.fontMono, fontSize: 11.5, padding: 8, resize: 'vertical' }} />
      </Card>);
  }

  function OutcomePanel({ result, onRetryHandCounted, retryBusy }) {
    const P = useP();
    if (!result) { return null; }
    if (!result.ok) {
      return <window.ErrorState title="Move to floor did not apply" body={result.error || 'The server refused this apply.'} />;
    }
    return (
      <Card density="default" style={{ marginTop: 12, background: P.surface2 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: result.handCountRequired.length ? 10 : 0 }}>
          <div><Pill kind="good" size="sm" icon="check-circle">{result.applied.length} applied</Pill></div>
          <div><Pill kind={result.adjusted.length ? 'warn' : 'neutral'} size="sm">{result.adjusted.length} capped</Pill></div>
          <div><Pill kind={result.skipped.length ? 'bad' : 'neutral'} size="sm">{result.skipped.length} skipped</Pill></div>
          <div style={{ fontSize: 11.5, color: P.inkMute }}>{result.movements.length} movement{result.movements.length === 1 ? '' : 's'} written</div>
        </div>
        {result.adjusted.length > 0 && (
          <div style={{ fontSize: 11.5, color: P.warnText, marginBottom: 8 }}>
            {result.adjusted.length} line{result.adjusted.length === 1 ? '' : 's'} capped server-side against re-derived safe stock — a posted `give` is never trusted as-is.
          </div>
        )}
        {result.handCountRequired.length > 0 && (
          <div>
            <div style={{ fontSize: 11.5, color: P.bad, fontWeight: 700, marginBottom: 6 }}>
              {result.handCountRequired.length} line{result.handCountRequired.length === 1 ? '' : 's'} need a hand count — mark them above, then retry.
            </div>
            <PBtn variant="secondary" size="sm" busy={retryBusy} onClick={onRetryHandCounted}>Retry the marked lines</PBtn>
          </div>
        )}
      </Card>);
  }

  window.FloorRestockScreen = function FloorRestockScreen() {
    const P = useP();

    const [locState, setLocState] = React.useState({ loading: true, error: null, rows: [] });
    const [storeId, setStoreId] = React.useState('');
    const [shelfId, setShelfId] = React.useState('');
    const [sinceIso, setSinceIso] = React.useState(isoStartOfToday());

    const [previewState, setPreviewState] = React.useState({ loading: false, error: null, plan: null });
    const [tagText, setTagText] = React.useState('');
    const [handCountedByKey, setHandCountedByKey] = React.useState({});
    const [committing, setCommitting] = React.useState(false);
    const [retrying, setRetrying] = React.useState(false);
    const [applyResult, setApplyResult] = React.useState(null);
    const [lastAppliedPlan, setLastAppliedPlan] = React.useState(null); // the actor-stamped Plan plan() returned, for retry

    React.useEffect(function () {
      let dead = false;
      setLocState({ loading: true, error: null, rows: [] });
      window.HWRestock.locations({ active: true }).then(function (res) {
        if (dead) { return; }
        setLocState({ loading: false, error: res.ok ? null : res.error, rows: res.locations || [] });
      });
      return function () { dead = true; };
    }, []);

    var shelves = locState.rows.filter(function (l) { return l.kind === 'shelf'; });
    var boh = locState.rows.filter(function (l) { return l.kind !== 'shelf'; });
    // The demo dataset may not use a 'shelf' kind at all — fall back to the full list rather
    // than showing an empty picker for a partition this deployment never draws.
    if (!shelves.length) { shelves = locState.rows; }
    if (!boh.length) { boh = locState.rows; }

    function loadPreview() {
      if (!storeId || !shelfId || !sinceIso) { return; }
      setApplyResult(null); setLastAppliedPlan(null); setHandCountedByKey({});
      setPreviewState({ loading: true, error: null, plan: previewState.plan });
      window.HWRestock.preview({ store_id: storeId, shelf_location_id: shelfId, since: sinceIso }).then(function (res) {
        setPreviewState({ loading: false, error: res.ok ? null : res.error, plan: res.ok ? res.plan : null });
      });
    }

    React.useEffect(function () {
      if (storeId && shelfId && sinceIso) { loadPreview(); }
      // eslint-disable-next-line
    }, [storeId, shelfId]);

    var skippedByKey = {};
    (applyResult && applyResult.skipped || []).forEach(function (s) {
      if (s && s.line) { skippedByKey[lineKey(s.line)] = s; }
    });

    function toggleHandCounted(key) {
      setHandCountedByKey(function (m) { var next = Object.assign({}, m); next[key] = !next[key]; return next; });
    }

    function commit() {
      if (!storeId || !shelfId) { return; }
      setCommitting(true); setApplyResult(null);
      window.HWRestock.plan({ store_id: storeId, shelf_location_id: shelfId, since: sinceIso, actor: ACTOR }).then(function (planRes) {
        if (!planRes.ok || !planRes.plan) {
          setCommitting(false);
          setApplyResult({ ok: false, error: planRes.error || 'plan() did not return a Plan' });
          return;
        }
        setLastAppliedPlan(planRes.plan);
        return window.HWRestock.apply({
          plan: planRes.plan, actor: ACTOR, station_id: STATION_ID,
          read: { tag_ids: parseTagIds(tagText) }
        }).then(function (res) {
          setCommitting(false);
          setApplyResult(res);
          if (res.ok) { setSinceIso(new Date().toISOString()); } // next preview on this shelf defaults from this apply
        });
      });
    }

    function retryHandCounted() {
      if (!lastAppliedPlan) { return; }
      var marked = Object.keys(handCountedByKey).filter(function (k) { return handCountedByKey[k]; });
      if (!marked.length) { return; }
      var markedSet = {}; marked.forEach(function (k) { markedSet[k] = true; });
      var patched = Object.assign({}, lastAppliedPlan, {
        lines: (lastAppliedPlan.lines || []).map(function (l) {
          return markedSet[lineKey(l)] ? Object.assign({}, l, { hand_counted: true }) : l;
        })
      });
      setRetrying(true);
      window.HWRestock.apply({
        plan: patched, actor: ACTOR, station_id: STATION_ID, read: { tag_ids: parseTagIds(tagText) }
      }).then(function (res) {
        setRetrying(false);
        setApplyResult(res);
        setLastAppliedPlan(patched);
      });
    }

    function openSlip(format) {
      if (!storeId || !shelfId) { return; }
      window.open(window.HWRestock.slipUrl({ store_id: storeId, shelf_location_id: shelfId, since: sinceIso }, format || 'html'), '_blank', 'noopener');
    }

    var tagCount = parseTagIds(tagText).length;
    var plan = previewState.plan;
    var canCommit = !!(storeId && shelfId && plan && !committing);

    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        <SectionHead level={1} eyebrow="Store · Concept A" title="Floor Restock"
          subtitle="Safe to shelf, several times a day. Oldest batch first; a loud flag when a second batch would join a shelf."
          action={<PBtn variant="secondary" icon="refresh" size="md" onClick={loadPreview} disabled={!storeId || !shelfId}>Refresh</PBtn>} />

        <Card density="roomy" style={{ marginBottom: 14 }}>
          {locState.loading && <window.SkeletonRows rows={2} avatar={false} />}
          {!locState.loading && locState.error && <window.ErrorState compact title="GET /api/inventory/locations did not answer" detail={locState.error} onRetry={function () { setLocState({ loading: true, error: null, rows: [] }); window.HWRestock.locations({ active: true }).then(function (res) { setLocState({ loading: false, error: res.ok ? null : res.error, rows: res.locations || [] }); }); }} />}
          {!locState.loading && !locState.error && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <LocPicker label="Store (safe)" value={storeId} onChange={setStoreId} placeholder="Pick a store location"
                options={boh.map(function (l) { return { value: l.id, label: (l.name || l.id) + (l.kind ? ' · ' + l.kind : '') }; })} />
              <LocPicker label="Shelf" value={shelfId} onChange={setShelfId} placeholder="Scan / pick a shelf"
                options={shelves.map(function (l) { return { value: l.id, label: (l.name || l.id) + (l.kind ? ' · ' + l.kind : '') }; })} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Since</span>
                <input type="datetime-local" value={toDatetimeLocal(sinceIso)} onChange={function (e) { var iso = fromDatetimeLocal(e.target.value); if (iso) { setSinceIso(iso); } }}
                  style={{ height: 38, borderRadius: P.r10, border: '1px solid ' + P.hairline3, background: P.field || P.surface, color: P.ink, padding: '0 10px', fontSize: 13, fontFamily: P.fontMono }} />
              </label>
              <PBtn variant="accent" size="md" onClick={loadPreview} disabled={!storeId || !shelfId}>Load plan</PBtn>
            </div>
          )}
          {locState.rows.length === 0 && !locState.loading && !locState.error && (
            <window.HDEmpty icon="pin" title="No locations came back" body="GET /api/inventory/locations returned an empty list — nothing to pick from yet." />
          )}
        </Card>

        {!storeId || !shelfId ? (
          <window.HDEmpty icon="shop" title="Pick a store and a shelf" body="Choose both above to load that shelf's restock plan." />
        ) : (
          <React.Fragment>
            <RfidPanel tagText={tagText} onChangeTagText={setTagText} tagCount={tagCount} />

            <Card density="default" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>Shelf plan — since {fmtWhen(sinceIso)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <PBtn variant="secondary" size="sm" icon="printer" onClick={function () { openSlip('html'); }} disabled={!plan}>Print restock slip</PBtn>
                </div>
              </div>

              {previewState.loading && <window.SkeletonRows rows={4} avatar={false} />}
              {!previewState.loading && previewState.error && (
                <window.ErrorState title="GET /api/inventory/restock/preview did not answer" detail={previewState.error} onRetry={loadPreview} />
              )}
              {!previewState.loading && !previewState.error && plan && (
                <ShelfTable lines={plan.lines} skippedByKey={skippedByKey} handCountedByKey={handCountedByKey} onToggleHandCounted={toggleHandCounted} />
              )}
            </Card>

            <div style={{ position: 'sticky', bottom: 0, background: P.surface, border: '1px solid ' + P.hairline2, borderRadius: P.r12, padding: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11.5, color: P.inkMute }}>
                {plan ? (plan.lines || []).length + ' line' + ((plan.lines || []).length === 1 ? '' : 's') + ' on this shelf' : 'No plan loaded'}
              </div>
              <PBtn variant="primary" size="lg" style={{ marginLeft: 'auto' }} busy={committing} disabled={!canCommit} onClick={commit}>Move to floor</PBtn>
            </div>

            <OutcomePanel result={applyResult} onRetryHandCounted={retryHandCounted} retryBusy={retrying} />
          </React.Fragment>
        )}
      </div>);
  };
})();
