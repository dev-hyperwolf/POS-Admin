// ── pos/screen-identity-binding.jsx ── Weedmaps customer <-> identity binding ─
// wmdemo/wm_binding.py (backend, unedited by this file) is the one place this
// estate can answer "which of our customers does this Weedmaps account belong
// to, and can we undo it if it's wrong". Read end-to-end before writing this
// screen, plus its wiring in wmdemo/server.py, to check the earlier research
// note that called it "completely built and routed" for bind AND unbind.
//
// THAT CLAIM WAS HALF RIGHT. Confirmed live against a scratch copy of
// wmdemo.sqlite3 (sqlite3.backup(), never the real file) on a throwaway port:
//   GET  /api/identity/wm-binding?wm_customer_id=<id>   -> wm_binding.binding()
//   POST /api/identity/wm-binding/unbind                -> wm_binding.unbind()
// both exist, both work exactly as their own extensive comments describe, and
// binding() already embeds history() in its response -- no second call needed
// for the audit trail.
//
// THERE IS STILL NO RAW BIND ROUTE, AND THAT REMAINS DELIBERATE.
// wm_binding.py's own docstring, in full: "No re-attach / bind route.
// Re-attaching is not an undo, it is the assertion 'this Weedmaps account IS
// this person' -- a new claim, which belongs downstream of the document veto
// machinery (engine._record_document_veto, store.merge_identities) and not
// in a rollback button." That principle is still true, and this screen still
// does not expose store.add_wm_id_to_identity as a bare admin toggle where an
// operator types any identity id next to any Weedmaps handle and it sticks.
//
// 🔴 CORRECTED 2026-09-03 — Bind Gate, Part 3/4. A narrower, GATED bind now
// exists and this screen wires it: wmdemo/bind_gate.py's
// POST /api/identity/review/bind attaches ONE specific
// identity_review_queue row's captured Weedmaps order to ONE candidate
// identity, and ONLY when their name + date of birth match exactly (see that
// module's docstring for why DOB is the gate and not a second ID scan). It
// is not the rollback button the paragraph above refuses to build — it
// supplies the one thing a re-attach needs and never had: a specific,
// checkable piece of new evidence, tied to a specific queued order. The
// REVIEW QUEUE PANEL below (GET /api/identity/review/open, new in the same
// change) is where that evidence is presented; the paragraph above is
// retained rather than deleted because the general principle it states —
// no bare re-attach toggle — still governs everything else on this screen,
// including the identity roster and the unbind flow.
//
// LISTING NEEDED NO NEW ROUTE FOR THE ROSTER. GET /api/identity/members
// (identity_api.members / _member_row) already returns wm_ids + wm_id_count
// per customer -- it is the ledger the Members table would use if that
// screen were live-wired. This screen reads it read-only and never
// duplicates its search logic.
//
// Self-wrapping IIFE, same discipline as pos/screen-brands.jsx: declares
// nothing at top level, its only export is window.IdentityBindingScreen.
// Reads GET /api/identity/members, GET /api/identity/wm-binding, GET
// /api/identity/review/open. Writes through window.HW_LIVE.post (the one
// token-aware POST path) via the same post() wrapper pos/screen-brands.jsx
// uses, falling back to a bare fetch if HW_LIVE never loaded.
;(function () {
  'use strict';
  const useP = window.useP;

  // The demo's floor operator identity (pos/app.jsx's USER.name) — this file
  // does not import app.jsx, so the name is repeated rather than reached for
  // across a module boundary that does not exist yet.
  const ACTOR = 'Manisha Saini';

  function base() {
    try { if (window.HW_LIVE && window.HW_LIVE.base) { return window.HW_LIVE.base; } } catch (e) {}
    return window.location.origin;
  }

  // Same shape as screen-brands.jsx's getJSON: every GET answers
  // { url, code, ok, body, parsed, raw }, so a route that is not there and a
  // route that answered "nothing" can never be confused with each other.
  function getJSON(path) {
    const url = base() + path;
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null, parsed = false;
        try { body = JSON.parse(txt); parsed = true; } catch (e) {}
        return { url: url, code: res.status, ok: res.ok, body: body, parsed: parsed, raw: txt.slice(0, 400) };
      });
    }).catch(function (e) {
      return { url: url, code: 0, ok: false, body: null, parsed: false, raw: '', netError: (e && e.message) || 'request failed' };
    });
  }

  function post(path, payload) {
    if (window.HW_LIVE && typeof window.HW_LIVE.post === 'function') {
      return window.HW_LIVE.post(path, payload);
    }
    return fetch(base() + path, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, code: res.status, body: j, error: (j && (j.error || j.why)) || ('HTTP ' + res.status), hint: (j && j.hint) || null };
      }, function () {
        return { ok: res.ok, code: res.status, body: null, error: 'HTTP ' + res.status + ' (body was not JSON)', hint: null };
      });
    }).catch(function (e) {
      return { ok: false, code: 0, body: null, error: 'request failed: ' + ((e && e.message) || 'unknown'), hint: null };
    });
  }

  function fmtTs(ts) {
    if (ts == null) { return '—'; }
    try { return new Date(ts * 1000).toLocaleString(); } catch (e) { return String(ts); }
  }

  const VERDICT_TONE = {
    agrees: 'good',
    no_ingest_log: 'neutral',
    no_identity_carries_this_wm_id: 'warn',
    names_a_merge_tombstone: 'warn',
    disagrees: 'bad'
  };

  // ── audit trail, one wm_binding_events row per line ─────────────────────
  // Same three-signal palette (good/bad/warn) screen-brands.jsx's own history
  // drawer uses, read off the ACTION the server already decided -- this panel
  // reports, it does not re-judge.
  function dotColor(P, action) {
    if (action === 'unbind') { return P.warn; }
    if (action === 'unbind_refused') { return P.bad; }
    return P.inkFaint;
  }

  function HistoryList({ events }) {
    const P = useP();
    if (!events || events.length === 0) {
      return <div style={{ padding: '12px 0', fontSize: 12, color: P.inkMute }}>
        No unbind or refused-unbind has ever been recorded for this Weedmaps customer id.
      </div>;
    }
    return <div>
      {events.map(function (ev) {
        const d = ev.detail && typeof ev.detail === 'object' ? ev.detail : null;
        return <div key={ev.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid ' + P.hairline, fontSize: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: dotColor(P, ev.action), marginTop: 5, flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: P.ink }}>{ev.action}</span>
            {ev.identity_id != null && <span style={{ fontFamily: P.fontMono, color: P.inkDim }}> &middot; identity #{ev.identity_id}</span>}
            <span style={{ color: P.inkDim }}> &middot; {ev.actor || 'unknown actor'}</span>
            <div style={{ color: P.ink2, marginTop: 2, lineHeight: 1.45 }}>{ev.reason}</div>
            {d && d.code && <div style={{ color: P.inkMute, marginTop: 2 }}>refusal code: <code style={{ fontFamily: P.fontMono }}>{d.code}</code></div>}
            {d && d.wm_ids_before && <div style={{ fontFamily: P.fontMono, color: P.inkMute, marginTop: 2, fontSize: 11 }}>
              {JSON.stringify(d.wm_ids_before)} &rarr; {JSON.stringify(d.wm_ids_after)}
            </div>}
            <div style={{ fontFamily: P.fontMono, fontSize: 10.5, color: P.inkMute, marginTop: 2 }}>{fmtTs(ev.ts)}</div>
          </div>
        </div>;
      })}
    </div>;
  }

  // ── one Weedmaps customer id, everything wm_binding.binding() knows ──────
  function BindingDrawer({ wmCustomerId, onClose, onChanged }) {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [unbindTarget, setUnbindTarget] = React.useState(null);
    const [reason, setReason] = React.useState('');
    const [needsAck, setNeedsAck] = React.useState(false);
    const [writeBusy, setWriteBusy] = React.useState(false);
    const [writeRes, setWriteRes] = React.useState(null);

    React.useEffect(function () {
      let dead = false;
      setHttp(null);
      getJSON('/api/identity/wm-binding?wm_customer_id=' + encodeURIComponent(wmCustomerId))
        .then(function (r) { if (!dead) { setHttp(r); } });
      return function () { dead = true; };
    }, [wmCustomerId, tick]);

    const body = http && http.parsed ? http.body : null;
    const refused = http && http.code === 503;
    const live = body && body.live_binding;
    const log = body && body.ingest_log;
    const orders = body && body.orders;
    const verdict = body && body.reconciliation && body.reconciliation.verdict;

    function openUnbind(identityId) {
      setUnbindTarget(identityId); setReason(''); setNeedsAck(false); setWriteRes(null);
    }

    // THE POST-THEN-READ-BACK DISCIPLINE (pos/shell-store.jsx's
    // createVariation / renameVariation, wmdemo/engine.py's
    // set_product_published): a 200 with ok:true is a claim, not a
    // confirmation. Re-GET the binding and check the identity is actually
    // gone from live_binding.identities before the operator is told it
    // worked. A refusal (ok:false, including the orders-acknowledgement
    // gate) is trusted as-is -- the server already told us nothing was
    // written, and there is nothing to read back that would prove otherwise.
    function submitUnbind(ackOrders) {
      const target = unbindTarget;
      setWriteBusy(true);
      post('/api/identity/wm-binding/unbind', {
        wm_customer_id: wmCustomerId, identity_id: target,
        actor: ACTOR, reason: reason.trim(), ack_orders: !!ackOrders
      }).then(function (r) {
        const b = r && r.body;
        if (!b) {
          setWriteBusy(false);
          setWriteRes({ phase: 'error', message: r.error || ('HTTP ' + r.code) });
          return;
        }
        if (b.ok === false) {
          setWriteBusy(false);
          setWriteRes({ phase: 'refused', body: b });
          if (b.code === 'orders_need_acknowledgement') { setNeedsAck(true); }
          return;
        }
        // b.ok === true from the write. Confirm it, don't just believe it.
        getJSON('/api/identity/wm-binding?wm_customer_id=' + encodeURIComponent(wmCustomerId))
          .then(function (r2) {
            setWriteBusy(false);
            const b2 = r2 && r2.parsed ? r2.body : null;
            const stillCarries = !!(b2 && b2.live_binding &&
              b2.live_binding.identities.some(function (x) { return x.identity_id === target; }));
            setHttp(r2);
            setWriteRes({
              phase: stillCarries ? 'unconfirmed' : 'confirmed',
              body: b, identityId: target
            });
            if (!stillCarries) {
              setUnbindTarget(null);
              onChanged && onChanged();
            }
          });
      });
    }

    const inputStyle = {
      width: '100%', minHeight: 64, padding: '8px 10px', border: '1px solid ' + P.hairline3,
      borderRadius: P.r8, background: P.field || P.surface, color: P.ink, fontSize: 12.5,
      fontFamily: P.fontSans, resize: 'vertical', boxSizing: 'border-box'
    };

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: P.scrim, zIndex: 60,
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
        <div onClick={function (e) { e.stopPropagation(); }} style={{ width: 'min(620px, 96vw)', background: P.surface,
          borderTopLeftRadius: P.r20, borderBottomLeftRadius: P.r20, display: 'flex', flexDirection: 'column',
          boxShadow: P.shadowLg, overflow: 'hidden' }}>

          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid ' + P.hairline2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Eyebrow>Weedmaps binding</Eyebrow>
              <div style={{ fontSize: 20, fontWeight: 700, color: P.ink, marginTop: 5, letterSpacing: '-.01em', fontFamily: P.fontMono }}>{wmCustomerId}</div>
              {verdict && <div style={{ marginTop: 6 }}><Pill kind={VERDICT_TONE[verdict] || 'neutral'} size="sm">{verdict.replace(/_/g, ' ')}</Pill></div>}
            </div>
            <IconBtn icon="x" label="Close" onClick={onClose} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 24px' }}>
            {!http && <SkeletonRows rows={4} avatar={false} />}

            {http && refused &&
              <Card density="compact" style={{ background: P.warnSoft, borderColor: P.warn, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="ban" size={15} stroke={2} color={P.warn} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: P.warn }}>The identity store is not here</span>
                </div>
                <div style={{ fontSize: 12, color: P.ink2, marginTop: 6, lineHeight: 1.55 }}>
                  <code style={{ fontFamily: P.fontMono }}>GET /api/identity/wm-binding</code> answered <strong>503</strong>{body && body.error ? ': ' + body.error : '.'}
                </div>
              </Card>}

            {http && !refused && !http.ok &&
              <ErrorState compact title={'GET /api/identity/wm-binding answered HTTP ' + (http.code || 'nothing')}
                body="A failed read is not the same as an unbound account -- nothing here has been confirmed either way."
                detail={http.netError || http.raw} />}

            {body && body.ok && <>
              {/* ── live binding: the fact that decides matches ── */}
              <Card density="compact" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Live binding — decides matches</div>
                {!live.bound && <div style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.5 }}>
                  Not bound to any identity right now. <b>There is deliberately no bind control here</b> — attaching a Weedmaps account
                  to a person is a new claim, not an undo, and belongs with identity merge or document verification, never a raw admin toggle.
                </div>}
                {live.bound && live.identities.map(function (id) { return (
                  <div key={id.identity_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid ' + P.hairline }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{id.name || '(no name on file)'} <span style={{ fontFamily: P.fontMono, fontWeight: 400, color: P.inkDim }}>#{id.identity_id}</span></div>
                      <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{id.pos_customer_id || '—'} &middot; {id.fulfilled_count || 0} fulfilled</div>
                    </div>
                    <PBtn variant="danger" size="xs" icon="user-off" onClick={function () { openUnbind(id.identity_id); }}>Unbind</PBtn>
                  </div>);
                })}
                {live.shared_account_warning && <div style={{ marginTop: 8, padding: '8px 10px', background: P.warnSoft, borderRadius: P.r8, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>
                  <Icon name="alert" size={12} color={P.warn} /> {live.shared_account_warning}
                </div>}
                {live.tombstones && live.tombstones.length > 0 && <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 4 }}>Also named by (merge tombstones)</div>
                  {live.tombstones.map(function (t) { return <div key={t.identity_id} style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>#{t.identity_id} ({t.pos_customer_id}) &rarr; merged into #{t.merged_into}</div>; })}
                </div>}
              </Card>

              {/* ── unbind form, opened per identity ── */}
              {unbindTarget != null && <Card density="compact" style={{ marginBottom: 12, borderColor: P.bad }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, marginBottom: 8 }}>Unbind {wmCustomerId} from identity #{unbindTarget}</div>
                <textarea value={reason} onChange={function (e) { setReason(e.target.value); }} placeholder="Why is this binding wrong? Required — becomes the audit row."
                  style={inputStyle} disabled={writeBusy} />

                {writeRes && writeRes.phase === 'refused' && <div style={{ marginTop: 8, padding: '8px 10px', background: P.badSoft, borderRadius: P.r8, fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                  <b>Refused ({writeRes.body.code}):</b> {writeRes.body.error}
                </div>}
                {writeRes && writeRes.phase === 'error' && <div style={{ marginTop: 8, padding: '8px 10px', background: P.badSoft, borderRadius: P.r8, fontSize: 11.5, color: P.ink2 }}>{writeRes.message}</div>}
                {writeRes && writeRes.phase === 'unconfirmed' && <div style={{ marginTop: 8, padding: '8px 10px', background: P.warnSoft, borderRadius: P.r8, fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                  The server answered ok, but a fresh read still shows identity #{writeRes.identityId} carrying this handle — not confirmed. Nothing further was assumed; try again or investigate.
                </div>}

                {needsAck && orders && <div style={{ marginTop: 8, padding: '8px 10px', background: P.warnSoft, borderRadius: P.r8, fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                  <b>{orders.count} real order(s)</b>{orders.cart_count ? ' and ' + orders.cart_count + ' cart(s) that never became orders' : ''} already arrived under this handle.
                  Unbinding will not re-parent them — they stay attributed to identity #{unbindTarget}; only future orders stop matching. Confirm you understand this to proceed.
                </div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <PBtn variant="secondary" size="sm" onClick={function () { setUnbindTarget(null); }} disabled={writeBusy}>Cancel</PBtn>
                  {!needsAck && <PBtn variant="danger" size="sm" icon="user-off" busy={writeBusy} disabled={!reason.trim()} onClick={function () { submitUnbind(false); }}>Unbind — requires a reason</PBtn>}
                  {needsAck && <PBtn variant="danger" size="sm" icon="alert" busy={writeBusy} disabled={!reason.trim()} onClick={function () { submitUnbind(true); }}>Acknowledge orders and unbind</PBtn>}
                </div>
              </Card>}

              {/* ── ingest log: historical, never handed out unqualified ── */}
              <Card density="compact" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Ingest log — what old orders were filed under</div>
                {!log && <div style={{ fontSize: 12, color: P.inkMute }}>Nothing was ever filed at ingest for this Weedmaps customer id.</div>}
                {log && <>
                  <div style={{ fontSize: 12.5, color: P.ink2 }}>Named <span style={{ fontFamily: P.fontMono }}>{log.pos_customer_id_at_ingest}</span> at ingest &middot; first seen {fmtTs(log.first_seen_at)} &middot; last seen {fmtTs(log.last_seen_at)}</div>
                  <div style={{ fontSize: 11, color: P.inkMute, marginTop: 4 }}>{body.reconciliation.detail}</div>
                </>}
              </Card>

              {/* ── orders, creates vs drafts kept apart ── */}
              {orders && <Card density="compact" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Orders under this handle</div>
                <div style={{ display: 'flex', gap: 18 }}>
                  <div><div style={{ fontFamily: P.fontMono, fontSize: 17, fontWeight: 700, color: P.ink }}>{orders.count}</div><div style={{ fontSize: 10.5, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em' }}>Real orders</div></div>
                  <div><div style={{ fontFamily: P.fontMono, fontSize: 17, fontWeight: 700, color: P.inkDim }}>{orders.cart_count}</div><div style={{ fontSize: 10.5, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.06em' }}>Carts only</div></div>
                </div>
              </Card>}

              {/* ── audit history, already embedded in binding() ── */}
              <Card density="compact">
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 4 }}>Audit history</div>
                <HistoryList events={body.history} />
              </Card>
            </>}
          </div>
        </div>
      </div>);
  }

  // ── Bind Gate, Part 3/4: the review queue, and the one gated bind ────────
  // Every row here is an identity_review_queue entry store.queue_identity_review
  // wrote because engine.resolve_identity (an ambiguous/undetermined Weedmaps
  // order) or checkin_api.create_checkin_resolved (an ambiguous/undetermined
  // walk-in) refused to guess. Nothing here MATCHES anybody — bind_gate.py
  // does that, server-side, on name+DOB — this panel only lists what is open,
  // lets an operator name a candidate identity to try, and shows the gate's
  // verdict PLAINLY, including a miss. A "gate did not clear" is a real
  // answer, not a failed request, and it is never left off the screen.
  const REVIEW_OUTCOME_TONE = { ambiguous: 'warn', undetermined: 'bad' };

  function ReviewQueuePanel({ tick, onChanged }) {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [candidateById, setCandidateById] = React.useState({});   // review id -> typed identity id
    const [busyId, setBusyId] = React.useState(null);
    const [resultById, setResultById] = React.useState({});         // review id -> {tone, text}

    React.useEffect(function () {
      let dead = false;
      setHttp(null);
      getJSON('/api/identity/review/open').then(function (r) { if (!dead) { setHttp(r); } });
      return function () { dead = true; };
    }, [tick]);

    const body = http && http.parsed ? http.body : null;
    const reviews = (body && body.reviews) || [];

    function runGate(reviewId) {
      const raw = (candidateById[reviewId] || '').trim();
      const candidateIdentityId = parseInt(raw, 10);
      if (!raw || !Number.isFinite(candidateIdentityId)) {
        setResultById(function (m) { return Object.assign({}, m, { [reviewId]: { tone: 'bad', text: 'Enter a numeric identity id first.' } }); });
        return;
      }
      setBusyId(reviewId);
      setResultById(function (m) { return Object.assign({}, m, { [reviewId]: null }); });
      post('/api/identity/review/bind', {
        review_id: reviewId, candidate_identity_id: candidateIdentityId, actor: ACTOR
      }).then(function (r) {
        setBusyId(null);
        const b = r && r.body;
        if (!b) {
          setResultById(function (m) { return Object.assign({}, m, { [reviewId]: { tone: 'bad', text: r.error || ('HTTP ' + r.code) } }); });
          return;
        }
        if (b.ok === false) {
          setResultById(function (m) { return Object.assign({}, m, { [reviewId]: { tone: 'bad', text: 'Refused (' + b.code + '): ' + b.error } }); });
          return;
        }
        if (b.outcome === 'bound') {
          setResultById(function (m) { return Object.assign({}, m, { [reviewId]: { tone: 'good', text: 'Bound — wm id ' + b.wm_id + ' attached to identity #' + b.candidate_identity_id + '. ' + b.why } }); });
          // The row is resolved server-side now; refresh so it drops off this
          // open-only list rather than sitting here looking actionable.
          onChanged && onChanged();
        } else {
          // gate_not_cleared: ok:true, nothing written, row stays OPEN.
          // Shown here exactly like a success — never a silent no-op — and
          // the row itself now also carries this attempt in bind_attempts,
          // so a refresh keeps showing it even if this operator navigates
          // away before reading the message below.
          setResultById(function (m) { return Object.assign({}, m, { [reviewId]: { tone: 'warn', text: 'Gate did not clear: ' + b.why } }); });
        }
      }).catch(function (e) {
        setBusyId(null);
        setResultById(function (m) { return Object.assign({}, m, { [reviewId]: { tone: 'bad', text: String((e && e.message) || e) } }); });
      });
    }

    const toneBg = { good: P.goodSoft, bad: P.badSoft, warn: P.warnSoft };
    const toneFg = { good: P.good, bad: P.bad, warn: P.warn };

    return (
      <Card density="roomy" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute }}>
            Review queue — orders the identity ladder refused to guess
          </div>
          {body && <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{reviews.length} open</span>}
        </div>
        <div style={{ fontSize: 11.5, color: P.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
          Each row is a Weedmaps order (or walk-in) the ladder marked <code style={{ fontFamily: P.fontMono }}>ambiguous</code> or <code style={{ fontFamily: P.fontMono }}>undetermined</code> instead
          of attributing to a guess. Binding one is gated on <b>name + date of birth</b> matching the candidate identity exactly — never a second ID scan — and a miss leaves the row open, visibly.
        </div>

        {!http && <SkeletonRows rows={2} avatar={false} />}
        {http && !http.parsed && <ErrorState compact title={'GET /api/identity/review/open answered HTTP ' + (http.code || 'nothing')}
          body="A failed read is not the same as an empty queue." detail={http.netError || http.raw} />}

        {body && reviews.length === 0 && <div style={{ fontSize: 12, color: P.inkMute, padding: '6px 0' }}>Nothing open right now.</div>}

        {body && reviews.map(function (r) {
          const ctx = r.context || {};
          const attempts = r.bind_attempts || [];
          const last = attempts.length ? attempts[attempts.length - 1] : null;
          const result = resultById[r.id];
          const busy = busyId === r.id;
          return (
            <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid ' + P.hairline }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Pill kind={REVIEW_OUTCOME_TONE[r.outcome] || 'neutral'} size="sm">{r.outcome}</Pill>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
                    {[ctx.first, ctx.last].filter(Boolean).join(' ') || '(no name captured)'}
                    {ctx.dob && <span style={{ fontWeight: 400, color: P.inkDim }}> &middot; dob {ctx.dob}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>
                    {r.wm_order_id ? ('order ' + r.wm_order_id) : '(walk-in, no order)'}
                    {ctx.wm_id ? (' · wm id ' + ctx.wm_id) : ' · no wm id captured'}
                    {' · queued ' + fmtTs(r.created_at ? Date.parse(r.created_at) / 1000 : null)}
                  </div>
                  <div style={{ fontSize: 11.5, color: P.ink2, marginTop: 4, lineHeight: 1.45 }}>{r.reason}</div>

                  {/* EVERY PRIOR ATTEMPT, NEVER JUST THE LAST — a human deciding
                      whether to try again needs to know this has already been
                      tried and refused, not just that it currently sits open. */}
                  {attempts.length > 0 && <div style={{ marginTop: 6, padding: '7px 9px', background: last.cleared ? P.goodSoft : P.warnSoft, borderRadius: P.r8, fontSize: 11, color: P.ink2, lineHeight: 1.45 }}>
                    <b>{attempts.length} prior bind attempt{attempts.length > 1 ? 's' : ''}.</b> Last: against identity #{last.candidate_identity_id}, {last.cleared ? 'CLEARED' : 'did NOT clear'} ({last.why}) by {last.actor || 'unknown'} at {last.ts}.
                  </div>}

                  {!ctx.wm_id && <div style={{ marginTop: 6, fontSize: 11, color: P.inkMute }}>
                    No Weedmaps customer id was captured on this row — bind_gate.attempt_bind refuses these (<code style={{ fontFamily: P.fontMono }}>no_wm_id_on_queued_order</code>); nothing to bind to here.
                  </div>}

                  {!!ctx.wm_id && <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                    <Field mono placeholder="candidate identity id, e.g. 233" style={{ maxWidth: 220 }}
                      value={candidateById[r.id] || ''} disabled={busy}
                      onChange={function (e) { const v = e.target.value; setCandidateById(function (m) { return Object.assign({}, m, { [r.id]: v }); }); }} />
                    <PBtn variant="secondary" size="sm" icon="link" busy={busy} onClick={function () { runGate(r.id); }}>Run Bind Gate</PBtn>
                  </div>}

                  {result && <div style={{ marginTop: 6, padding: '7px 9px', borderRadius: P.r8, fontSize: 11.5, lineHeight: 1.45, background: toneBg[result.tone] || P.surface2, color: toneFg[result.tone] || P.ink }}>{result.text}</div>}
                </div>
              </div>
            </div>);
        })}
      </Card>);
  }

  // ── the roster: every identity, which Weedmaps handles it carries ────────
  window.IdentityBindingScreen = function IdentityBindingScreen() {
    const P = useP();
    const [q, setQ] = React.useState('');
    const [boundOnly, setBoundOnly] = React.useState(false);
    const [listHttp, setListHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [lookupId, setLookupId] = React.useState('');
    const [openId, setOpenId] = React.useState(null);

    React.useEffect(function () {
      let dead = false;
      setListHttp(null);
      const params = new URLSearchParams();
      if (q.trim()) { params.set('q', q.trim()); }
      params.set('limit', '200');
      getJSON('/api/identity/members?' + params.toString()).then(function (r) { if (!dead) { setListHttp(r); } });
      return function () { dead = true; };
    }, [q, tick]);

    const body = listHttp && listHttp.parsed ? listHttp.body : null;
    const refused = listHttp && listHttp.code === 503;
    const allMembers = (body && body.members) || [];
    const boundMembers = allMembers.filter(function (m) { return m.wm_ids && m.wm_ids.length; });
    const rows = boundOnly ? boundMembers : allMembers;

    const cols = [
      { label: 'Customer', render: function (m) {
        return <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{m.name || '(no name)'}</div>
          <div style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{m.pos_customer_id || '#' + m.identity_id}</div>
        </div>;
      } },
      { label: 'Weedmaps ids', render: function (m) {
        const ids = m.wm_ids || [];
        if (!ids.length) { return <span style={{ fontSize: 11.5, color: P.inkMute }}>Not bound</span>; }
        return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {ids.map(function (id) {
            return <button key={id} onClick={function (e) { e.stopPropagation(); setOpenId(id); }}
              style={{ fontFamily: P.fontMono, fontSize: 11, fontWeight: 700, color: P.wm || '#1F5FC0', background: (P.wmSoft || '#E3ECFA'), border: 'none', borderRadius: 99, padding: '2px 9px', cursor: 'pointer' }}>{id}</button>;
          })}
        </div>;
      } },
      { label: 'Fulfilled', align: 'right', render: function (m) { return <span style={{ fontFamily: P.fontMono, fontWeight: 600 }}>{m.fulfilled_count || 0}</span>; } },
      { label: 'Verified', render: function (m) { return m.verified ? <Pill kind="good" size="sm">verified</Pill> : <Pill kind="neutral" size="sm">unverified</Pill>; } }
    ];

    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHead level={1} eyebrow="Weedmaps" title="Identity &amp; binding"
          subtitle="Which customer a Weedmaps account resolves to, its audit trail, and the one real undo this backend offers."
          action={<PBtn variant="secondary" icon="refresh" size="md" onClick={function () { setTick(function (t) { return t + 1; }); }}>Refresh</PBtn>} />

        <Card density="roomy" style={{ marginBottom: 16, background: P.infoSoft, borderColor: P.info }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <Icon name="info" size={15} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 12, color: P.ink2, lineHeight: 1.55 }}>
              <b>What this screen can and cannot do.</b> <code style={{ fontFamily: P.fontMono, background: P.surface, padding: '1px 5px', borderRadius: 5 }}>GET/POST /api/identity/wm-binding[/unbind]</code> are
              real, wired, careful routes — reading a binding and unbinding it both work exactly as shown below. There is still <b>no raw bind toggle</b> here: re-attaching any Weedmaps account to any
              identity by admin fiat remains a new identity claim, not a rollback, and this screen does not fabricate one. What it does offer, below, is the narrower <b>Bind Gate</b> (
              <code style={{ fontFamily: P.fontMono, background: P.surface, padding: '1px 5px', borderRadius: 5 }}>POST /api/identity/review/bind</code>): attaching ONE specific queued Weedmaps order
              to ONE candidate identity, gated on an exact name+date-of-birth match — never a second ID scan — with a miss shown plainly rather than silently discarded.
            </div>
          </div>
        </Card>

        <ReviewQueuePanel tick={tick} onChanged={function () { setTick(function (t) { return t + 1; }); }} />

        <Card density="roomy" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 10 }}>Look up a Weedmaps customer id directly</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field icon="search" mono placeholder="e.g. 16665721" value={lookupId} onChange={function (e) { setLookupId(e.target.value); }} />
            <PBtn variant="secondary" onClick={function () { if (lookupId.trim()) { setOpenId(lookupId.trim()); } }} disabled={!lookupId.trim()}>Look up</PBtn>
          </div>
          <div style={{ fontSize: 11, color: P.inkMute, marginTop: 6 }}>Useful for a handle nobody's roster below carries yet — an unbound id, or one only a merge tombstone still names.</div>
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', maxWidth: 380 }}><Field icon="search" placeholder="Search by name, phone, POS id…" value={q} onChange={function (e) { setQ(e.target.value); }} /></div>
          <Seg size="sm" value={boundOnly ? 'bound' : 'all'} onChange={function (v) { setBoundOnly(v === 'bound'); }}
            options={[{ value: 'all', label: 'All customers' }, { value: 'bound', label: 'Bound to Weedmaps · ' + boundMembers.length }]} />
        </div>

        {!listHttp && <SkeletonRows rows={5} avatar={false} />}

        {listHttp && refused && <Card density="compact" style={{ background: P.warnSoft, borderColor: P.warn, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: P.ink2 }}><Icon name="ban" size={13} color={P.warn} /> The identity store is not reachable right now — this is not the same as "no customers".</div>
        </Card>}

        {listHttp && !refused && !listHttp.ok && <ErrorState title={'GET /api/identity/members answered HTTP ' + (listHttp.code || 'nothing')}
          body="A failed read is not the same as an empty roster." detail={listHttp.netError || listHttp.raw} />}

        {body && <DataTable columns={cols} rows={rows} rowKey={function (m) { return m.identity_id; }} />}
        {body && rows.length === 0 && <div style={{ textAlign: 'center', padding: '34px 20px', color: P.inkMute, fontSize: 13.5 }}>No customers match.</div>}

        {openId && <BindingDrawer wmCustomerId={openId} onClose={function () { setOpenId(null); }} onChanged={function () { setTick(function (t) { return t + 1; }); }} />}
      </div>);
  };
})();
