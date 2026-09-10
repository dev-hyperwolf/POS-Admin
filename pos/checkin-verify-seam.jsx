// ── pos/checkin-verify-seam.jsx ── window.IdvCheckinSeam ───────────────────
//
// THE COUNTER PATH INTO HYPERWOLF VERIFY, AND THE REASON THIS IS ITS OWN FILE.
// pos/screen-register.jsx is never touched by any new module (owner rule,
// conventions checklist §20) and pos/checkin.jsx is a 1,500-line screen with its
// own hard-won rules about names, documents and provenance. So everything Verify
// needs at the counter lives here: creating the session, mounting the capture
// flow, and handing the modal back a document object in the shape it already
// understands. The modal's contribution is ONE guarded element — see the hook
// comment in pos/checkin.jsx's no-document branch.
//
// WHY A HOOK IN checkin.jsx WAS UNAVOIDABLE. docs/IDV-PLAN-2026-09-08.md §5.1
// says this file mounts "in CheckInModal's existing document step via
// window.HW_CHECKIN hooks". `window.HW_CHECKIN` is NOT a mount registry: it is
// the dev/QA data seam published by shared/hw-live-checkin.js L2033, and its
// entire surface is data and actions — { __armed, status, board, people, orders,
// contract, candidates, base, counter, match, bind, bindManual, reject, handoff,
// claim, unclaim, leave, create, refresh, open }. pos/checkin.jsx reads it in
// exactly one place (via pos/verification.jsx L225-233) and only for the
// expiry-enforcement switch. There is no slot, no registry and no render hook of
// any kind, so a component cannot be mounted through it. Verified before
// writing a line of this file; recorded here so the next reader does not
// re-derive it.
//
// WHAT THIS FILE DOES NOT DO:
//   · It does not decide anything. The engine's signed callback and an analyst
//     are the only writers of a session status; this file uploads and asks.
//   · It does not invent a name, a date of birth or a document number. `GET
//     /api/idv/capture/{token}/status` deliberately returns no PII (it is a
//     guest-facing route), so the document object handed back carries provenance
//     and the session id — not fields nobody told us. pos/checkin.jsx's
//     onPrimaryScan compares `d.name` and `d.memberId` before binding; omitting
//     both is what makes that comparison pass honestly rather than by accident.
//   · It does not touch pos/screen-register.jsx, pos/data.jsx or window.HW.IDV.
;(function () {
  const useP = window.useP;

  // ── the workflow this counter uses ───────────────────────────────────────
  // NOTHING IN THE ESTATE SAYS WHICH WORKFLOW A STORE'S COUNTER SHOULD RUN.
  // There is no per-store or per-channel workflow setting in the contract, so
  // this picks the first ACTIVE KYC workflow that carries a document read, which
  // is the only defensible reading of "the counter's workflow" available today.
  // Recorded as a contract gap rather than hard-coding an id: a hard-coded id
  // would silently stop matching the moment a workflow is versioned or archived.
  // `opts.medical` (2026-09-09, gap E): when the seam is started with
  // `{ medical: true }` on <IdvCheckinSeam>, prefer an active KYC+OCR workflow
  // whose config.age_rule is MED_18_REC (or the MED_18_CARD alias) over the
  // first one found — still falling through to the old pick if none exists.
  // Unset/false is byte-identical to the prior behaviour: first active
  // KYC+OCR workflow, medical or not.
  function pickWorkflow(rows, opts) {
    const active = (rows || []).filter(function (w) { return w && w.status === 'active'; });
    const kyc = active.filter(function (w) {
      return w.kind === 'KYC' && (w.features || []).indexOf('OCR') >= 0;
    });
    if (opts && opts.medical) {
      const medicalKyc = kyc.filter(function (w) {
        const rule = String((w.config || {}).age_rule || '').toUpperCase();
        return rule === 'MED_18_REC' || rule === 'MED_18_CARD';
      });
      if (medicalKyc[0]) return medicalKyc[0];
    }
    return (kyc[0] || active[0] || null);
  }

  // ── what a Verify approval looks like to pos/checkin.jsx ────────────────
  // The shape is the one every producer in that screen emits (pos/verification.jsx
  // L846-880 is the reference), reduced to only the claims Verify can actually
  // make:
  //   how:'remote'   docLine() prints "Remote ID check passed …" for this, which
  //                  is exactly what happened — it was not a barcode read at the
  //                  counter. checkin.jsx L68-75.
  //   scannedAt      REQUIRED, and not cosmetic. CheckInModal's `primaryScan` is
  //                  `customer.doc && customer.doc.scannedAt ? customer.doc :
  //                  null` (L1002), and `primaryDoc` falls through to
  //                  docOnFileFor() — which reads window.HW.IDV and has never
  //                  heard of this session — when it is missing. Without
  //                  scannedAt the check-in button stays disabled after a
  //                  successful verification.
  //   no `expires`   HWExpiry.isExpiredDoc() answers false for a doc with no
  //                  expiry date (pos/verification.jsx L100-107), which is the
  //                  truthful answer: the ENGINE checked the expiry, and the
  //                  expiry date itself is PII the capture API does not return.
  //   no `name`, no `memberId`
  //                  See the file header. An omitted claim cannot be a wrong one.
  function verifyDoc(session) {
    return {
      how: 'remote',
      when: 'just now',
      scannedAt: 'Just now',
      by: (window.HWIdv && window.HWIdv.session().name) || null,
      where: 'Hyperwolf Verify',
      photo: true,
      // The session id is the audit handle: it is what an analyst types into the
      // console to see the document images, the scores and the decision trail.
      // It rides on the doc so anything downstream that keeps the doc keeps the
      // pointer to the evidence.
      idvSessionId: session.session_id || null,
      idvSessionNumber: session.session_number || null,
      idvVerifiedAt: new Date().toISOString(),
      idvChannel: 'pos',
    };
  }

  // ── the seam ────────────────────────────────────────────────────────────
  // `onVerified` IS the modal's existing document-verified path (onPrimaryScan).
  // Handing it a doc is the whole integration: from that call onwards the Register
  // screen's own logic runs exactly as it does after a barcode scan, with nothing
  // in it changed.
  // `medical` (opt-in, default false/undefined): pass `{ medical: true }` to
  // route this session to a MED_18_REC workflow instead of the first active
  // KYC+OCR one — see pickWorkflow above. Omitted, behaviour is unchanged.
  window.IdvCheckinSeam = function IdvCheckinSeam({ customer, onVerified, compact, medical }) {
    const P = useP();
    const [phase, setPhase] = React.useState('idle');   // idle | creating | live | failed | needs-pin
    const [session, setSession] = React.useState(null);
    const [err, setErr] = React.useState(null);
    const aliveRef = React.useRef(true);

    React.useEffect(function () {
      aliveRef.current = true;
      return function () { aliveRef.current = false; };
    }, []);

    // The two files this seam cannot work without. Saying WHICH file and WHICH
    // global is missing is the estate's convention for a dependency that did not
    // load (conventions digest §7.6) — and it is the live state today, because
    // Hyperwolf POS.html does not yet carry these script tags.
    const missing = [];
    if (!window.HWIdv) missing.push('idv/idv-client.jsx (window.HWIdv)');
    if (!window.IdvCapture) missing.push('idv/capture.jsx (window.IdvCapture)');
    if (missing.length) {
      return (
        <window.ErrorState compact title="Hyperwolf Verify is not loaded on this page"
          body={'Add the Verify script tags to Hyperwolf POS.html — missing: ' + missing.join(' and ')
            + '. The barcode scanner below is unaffected.'} />);
    }

    // THE PIN GATE, AS THE COUNTER SEES IT (2026-09-09).
    // wmdemo/idv_api.py `require_console` puts one shared PIN in front of every
    // console route on a public deployment. Two of the calls below are console
    // routes — `GET /api/idv/workflows` and `POST /api/idv/sessions` — so this
    // seam is gated too, and it answers 401 until a PIN has been entered ONCE
    // on this device.
    //
    // WHY THIS FILE DOES NOT ASK FOR THE PIN. A PIN field inside the check-in
    // modal would be a second place the secret is typed and a second piece of
    // auth UI to keep honest, on the one screen this module is forbidden to
    // complicate. It is not needed: Hyperwolf Verify and Hyperwolf POS are the
    // SAME ORIGIN and share `localStorage['hw-console-token']`, so the PIN
    // entered once in the Verify app unlocks the counter as well. One sentence
    // pointing there is the whole handling.
    //
    // NOT gated on the CAPTURE routes, and that is why this stays a one-liner
    // rather than a blocker: once a session exists, the guest's own capture
    // flow (window.IdvCapture) carries a per-session bearer token and never
    // touches a console route, so a verification already under way is
    // unaffected by an expiring console token.
    const PIN_NOTE = 'Enter the Verify PIN in the Verify app once on this device.';

    function start() {
      setPhase('creating'); setErr(null);
      const s = window.HWIdv.session();
      window.HWIdv.get('/api/idv/workflows').then(function (r) {
        if (!aliveRef.current) return;
        if (r.needsPin) { setPhase('needs-pin'); setErr(null); return; }
        if (!r.ok) { setPhase('failed'); setErr(r.error || 'Verify did not answer.'); return; }
        const wf = pickWorkflow(r.body && r.body.rows, { medical: medical });
        if (!wf) { setPhase('failed'); setErr('No active Verify workflow is configured, so a session cannot be started.'); return; }
        // vendor_data is the customer key that travels with the session and
        // makes an imported or exported session traceable back to a person
        // (contract: "Verify sends vendor_data from day one"). `pos:<identity
        // id>` is the agreed form; a brand-new customer has no id yet, and an
        // absent key is sent as absent rather than as the literal 'new'.
        const idKey = customer && customer.id && customer.id !== 'new'
          ? (customer.identityId || customer.identity_id || customer.id) : null;
        const body = {
          workflow_id: wf.id,
          channel: 'pos',
          store_id: (s && s.storeId) || null,
          associate_id: (s && s.id) || null,
        };
        if (idKey) body.vendor_data = 'pos:' + idKey;
        window.HWIdv.post('/api/idv/sessions', body).then(function (c) {
          if (!aliveRef.current) return;
          if (c.needsPin) { setPhase('needs-pin'); setErr(null); return; }
          if (!c.ok || !c.body || !c.body.session_token) {
            setPhase('failed');
            setErr((c && c.error) || 'Verify would not open a session.');
            return;
          }
          setSession(Object.assign({}, c.body, { workflow_name: wf.name }));
          setPhase('live');
        });
      });
    }

    // ── the outcome ───────────────────────────────────────────────────────
    // ONLY Approved hands the modal a document. In Review, Awaiting User and
    // Declined leave the check-in exactly where it was: the associate can still
    // scan a barcode, and the customer is still un-verified — which is the
    // truthful state and the one the footer already knows how to describe.
    function onDone(result) {
      if (!result || result.status !== 'Approved') return;
      if (typeof onVerified === 'function') onVerified(verifyDoc(session || {}));
    }

    // ONE LINE, AND IT NAMES THE ONE ACTION THAT FIXES IT. Deliberately an
    // ErrorState rather than the inline warn row below: the barcode scanner is
    // still right there and still works, so this is a closed door with a
    // labelled key, not a failure the associate has to work around blind.
    // `onRetry` re-runs `start()`, which is exactly right — after the PIN has
    // been entered in the Verify app the same button now succeeds.
    if (phase === 'needs-pin') {
      return (
        <div data-hw="idv-checkin-seam" style={{ display: 'flex', flexDirection: 'column', gap: P.space.x2 }}>
          <window.ErrorState compact title="Hyperwolf Verify needs a PIN on this device"
            body={PIN_NOTE + ' The barcode scanner below is unaffected.'}
            onRetry={function () { start(); }} />
        </div>);
    }

    if (phase === 'idle' || phase === 'failed') {
      return (
        <div data-hw="idv-checkin-seam" style={{ display: 'flex', flexDirection: 'column', gap: P.space.x2 }}>
          {phase === 'failed' && err ? (
            <div style={{ display: 'flex', gap: P.space.x2, alignItems: 'flex-start' }}>
              <window.Icon name="alert" size={14} stroke={2} color={P.warnText} style={{ flex: '0 0 auto', marginTop: 2 }} />
              <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.45 }}>{err}</span>
            </div>) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x2, flexWrap: 'wrap' }}>
            {/* SECONDARY, NEVER ACCENT. checkin.jsx's footer already owns the one
                accent on this modal ("Check in & start sale"), and CLAUDE.md
                design rule 1 allows exactly one solid accent per view. */}
            <window.PBtn variant="secondary" size="sm" icon="user-check" onClick={start}>
              {phase === 'failed' ? 'Try Hyperwolf Verify again' : 'Verify with the camera'}
            </window.PBtn>
            <span style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.45 }}>
              Two photos of the ID and a quick look at the camera, on this tablet. About half a minute.
            </span>
          </div>
        </div>);
    }

    if (phase === 'creating') {
      return (
        <div data-hw="idv-checkin-seam" style={{ display: 'flex', alignItems: 'center', gap: P.space.x2 }}>
          <window.Skeleton w={160} h={11} />
          <span style={{ fontSize: P.type.meta, color: P.inkDim }}>Opening a Verify session…</span>
        </div>);
    }

    // Live. The capture flow owns the whole area from here; the seam's only
    // remaining job is the frame it sits in and the Cancel that closes it.
    const s = window.HWIdv.session();
    return (
      <div data-hw="idv-checkin-seam" style={{ display: 'flex', flexDirection: 'column', gap: P.space.x2 }}>
        <div style={{ height: compact ? 420 : 520, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
            <window.IdvCapture
              token={session.session_token}
              mode="pos"
              sessionId={session.session_id}
              sessionRef={session.session_number != null ? ('#' + session.session_number) : null}
              storeLabel={(s && s.storeId) || null}
              onDone={onDone} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x2 }}>
          <div style={{ flex: 1 }} />
          {/* NOT "Cancel". Backing out leaves the customer un-verified and the
              session open for the analyst to see — the button says which state
              it returns the associate to, the same rule the soft-lapse block in
              checkin.jsx follows for its own back-out. */}
          <window.PBtn variant="ghost" size="xs"
            onClick={function () { setPhase('idle'); setSession(null); }}>
            Close the camera and scan the barcode instead
          </window.PBtn>
        </div>
      </div>);
  };
})();
