// ── idv/capture.jsx ── window.IdvCapture — the guest-facing capture flow ────
//
// ONE COMPONENT, TWO SURFACES. `mode:'hosted'` is the phone/desktop page the
// site iframes (idv/capture.html at /verify/{token}); `mode:'pos'` is the same
// flow inside the check-in modal on the counter tablet, mounted by
// pos/checkin-verify-seam.jsx. The difference is ONLY chrome: pos adds the
// associate bar at the bottom (session ref, workflow, reason code, one line of
// what to do next) and the override button. Every step, every upload and every
// sentence the guest reads is identical, because two copies of a capture flow
// is two flows to keep in step and one of them will drift.
//
// Design source: explorations/Verify - Concept D - Floor.html, tab 3 "Counter
// capture" (the seven happy-path tablet frames, the retry branch, the two other
// endings, the returning-customer face-only re-auth and the engine-down frame)
// and tab 4 "Website funnel"'s hosted phone frames. Copy discipline from
// docs/IDV-PLAN-2026-09-08.md §5.5 and the exploration's own rule: the guest is
// owed a NEXT STEP, never a diagnosis. No score, no reason code, no node name
// ever reaches a guest-facing string in this file.
//
// THE CAPTURE CLIENT NEVER SETS A STATUS. It uploads media and asks. Only the
// engine's signed callback and an analyst write `idv_sessions.status`
// (wmdemo/idv_api.py L33-34), which is why `submit` answers `In Progress` and
// this file's only job after that is to poll `GET status` and render whatever
// the server says.
//
// WHY THIS FILE HAS ITS OWN TRANSPORT AND DOES NOT USE HWIdv.get/post:
//   1. The capture API is authenticated by the session token IN THE PATH and
//      takes no `X-HW-Actor` header (docs/IDV-API-CONTRACT.md, "Capture API").
//      Sending the console actor header from a guest's phone would be sending
//      an associate id to a surface that has no use for it.
//   2. `POST media` is multipart/form-data with a Blob part. HWIdv.post
//      JSON-encodes its body and sets Content-Type: application/json, so it
//      cannot carry an upload at all.
//   3. capture.html deliberately does not load shared/hw-live.js — it is a
//      guest page with no connectivity badge and no write token — so
//      HWIdv.get() there would answer 'no-live-seam' for every call.
// The ONE place HWIdv is used is the pos-mode override, which IS a console
// route and DOES need the actor header. See consoleOverride() below.
//
// EXPORTS: window.IdvCapture (the component) plus three statics hung off it —
// `IdvCapture.api` (get/post/upload/beacon), `IdvCapture.grab` (video →
// downscaled EXIF-free JPEG Blob) and `IdvCapture.metrics` (the advisory
// blur/glare measurement). They are on the component rather than in a second
// global because the seam file and a browser QA run both need the transport
// without re-deriving the URL shape, and because a pure function that decides
// which of four burst frames to upload should be checkable without a camera.
;(function () {
  const useP = window.useP;

  // ── transport ────────────────────────────────────────────────────────────
  // Same never-reject contract as HWIdv.get/post (conventions checklist §9):
  // every call resolves to { ok, code, body, error }, so no caller in this file
  // needs a try/catch and no failure path can throw during a render.
  //
  // `base` resolution, in order: an explicit prop (the seam passes one when the
  // POS page and the backend are different origins) → window.HW_LIVE.base (POS
  // pages load hw-live.js, so this is the branch that runs there) → '' , which
  // means same-origin and is what the hosted page uses, because wm-demo serves
  // /verify/{token} and /api/idv/capture/* from the one origin.
  function resolveBase(explicit) {
    if (explicit != null) return String(explicit).replace(/\/+$/, '');
    const L = window.HW_LIVE;
    if (L && L.base) return String(L.base).replace(/\/+$/, '');
    return '';
  }
  function capUrl(token, action, base) {
    return resolveBase(base) + '/api/idv/capture/' + encodeURIComponent(token || '') + '/' + action;
  }
  function settle(res, j) {
    return { ok: res.ok, code: res.status, body: j,
      error: (j && j.error) || (res.ok ? null : ('HTTP ' + res.status)) };
  }
  function networkError(e) {
    return { ok: false, code: 0, body: null,
      error: 'request failed: ' + (e && e.message ? e.message : 'unknown') };
  }
  function readJson(res) {
    return res.json().then(function (j) { return settle(res, j); },
      function () { return settle(res, null); });
  }
  function capGet(token, action, base) {
    return fetch(capUrl(token, action, base), { method: 'GET', cache: 'no-store', credentials: 'omit' })
      .then(readJson).catch(networkError);
  }
  function capPost(token, action, body, base) {
    return fetch(capUrl(token, action, base), { method: 'POST', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(readJson).catch(networkError);
  }
  // Multipart, and deliberately WITHOUT a Content-Type header: the browser must
  // write it itself so the boundary matches the body it just built. Setting it
  // by hand is the classic way to make wmdemo/idv_api.py's _parse_multipart
  // answer "the multipart body has no boundary".
  function capUpload(token, kind, blob, opts) {
    const o = opts || {};
    const fd = new FormData();
    fd.append('kind', kind);
    if (o.challengeId) fd.append('challenge_id', o.challengeId);
    // client_metrics is ADVISORY (plan §5.5: "client-side blur/glare hints are
    // advisory — the server decides"). It is sent because the contract lists it
    // and the engine may learn to read it; nothing in this file changes
    // behaviour based on it beyond the on-screen hint.
    if (o.metrics) fd.append('client_metrics', JSON.stringify(o.metrics));
    fd.append('file', blob, o.filename || (kind + (/webm/.test(blob.type || '') ? '.webm' : '.jpg')));
    return fetch(capUrl(token, 'media', o.base), { method: 'POST', cache: 'no-store', credentials: 'omit', body: fd })
      .then(readJson).catch(networkError);
  }
  // Walk-off. sendBeacon survives the page going away; fetch does not.
  function capBeacon(token, action, base) {
    try {
      if (navigator.sendBeacon) return !!navigator.sendBeacon(capUrl(token, action, base), '');
    } catch (e) { /* fall through */ }
    try {
      fetch(capUrl(token, action, base), { method: 'POST', cache: 'no-store', credentials: 'omit', keepalive: true });
      return true;
    } catch (e) { return false; }
  }

  // ── frame capture ────────────────────────────────────────────────────────
  const MAX_EDGE = 1600;   // long edge, per the task brief and the Media rows
  const JPEG_Q = 0.85;

  // EXIF-FREE BY CONSTRUCTION, not by stripping. A canvas holds pixels and
  // nothing else, so re-encoding through toBlob() cannot carry the source
  // frame's orientation tag, GPS tag or maker notes — there is no metadata to
  // strip because none ever existed. shared/id-photos.jsx's header names "NO
  // EXIF STRIPPING" as one of its explicit non-features; this is the path that
  // does not need it.
  function drawScaled(video, maxEdge) {
    const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
    if (!vw || !vh) return null;
    const long = Math.max(vw, vh);
    const k = long > maxEdge ? maxEdge / long : 1;
    const w = Math.max(1, Math.round(vw * k)), h = Math.max(1, Math.round(vh * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return c;
  }
  function canvasToJpeg(canvas, quality) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) { resolve(b || null); }, 'image/jpeg', quality);
        return;
      }
      // Very old WebView: toDataURL is the only encoder available.
      try {
        const url = canvas.toDataURL('image/jpeg', quality);
        const bin = atob(url.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: 'image/jpeg' }));
      } catch (e) { resolve(null); }
    });
  }
  // ADVISORY QUALITY MEASUREMENT — two numbers, both cheap, both honest about
  // what they are:
  //   blur  = variance of a 3x3 Laplacian over a downscaled greyscale copy.
  //           HIGH means sharp; low means soft or out of focus. It is a relative
  //           number, not a percentage, and the thresholds below are hints for
  //           the guest, never a gate.
  //   glare = the fraction of pixels at or above SATURATED luma. A licence held
  //           under a downlight blows out exactly the part the OCR needs.
  // Measured on a small copy on purpose: a 1600px Laplacian on a phone would
  // cost more than the frame is worth, and the answer does not change.
  const BLUR_SOFT = 55;      // below this the hint says "hold still"
  const GLARE_HIGH = 0.045;  // above this the hint says "tilt away from the light"
  const SATURATED = 246;
  function frameMetrics(canvas) {
    const target = 128;
    const k = Math.min(1, target / Math.max(canvas.width, canvas.height));
    const w = Math.max(8, Math.round(canvas.width * k));
    const h = Math.max(8, Math.round(canvas.height * k));
    const small = document.createElement('canvas');
    small.width = w; small.height = h;
    const ctx = small.getContext('2d');
    if (!ctx) return { blur: null, glare: null, face_box: null };
    ctx.drawImage(canvas, 0, 0, w, h);
    let px;
    try { px = ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return { blur: null, glare: null, face_box: null }; }
    const g = new Float32Array(w * h);
    let hot = 0;
    for (let i = 0, p = 0; i < g.length; i++, p += 4) {
      const luma = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
      g[i] = luma;
      if (luma >= SATURATED) hot++;
    }
    let sum = 0, sumsq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = (g[i - w] + g[i + w] + g[i - 1] + g[i + 1]) - 4 * g[i];
        sum += lap; sumsq += lap * lap; n++;
      }
    }
    const mean = n ? sum / n : 0;
    const variance = n ? (sumsq / n) - (mean * mean) : 0;
    return { blur: Math.round(variance * 100) / 100,
      glare: Math.round((hot / (w * h)) * 10000) / 10000,
      face_box: null };
  }
  // One sentence of advice, or null when the frame looks fine. Never blocks.
  function frameHint(m) {
    if (!m) return null;
    if (m.blur != null && m.blur < BLUR_SOFT) return 'Hold a little steadier.';
    if (m.glare != null && m.glare > GLARE_HIGH) return 'Tilt it away from the light.';
    return null;
  }
  // WHICH OF THE BURST TO SEND AS THE REAL DOCUMENT FRONT. Sharpest wins;
  // glare breaks a near-tie. Pure, so it is checkable without a camera.
  function bestOfBurst(frames) {
    let best = null;
    (frames || []).forEach(function (f) {
      if (!f || !f.blob) return;
      if (!best) { best = f; return; }
      const a = f.metrics || {}, b = best.metrics || {};
      const av = a.blur == null ? -1 : a.blur, bv = b.blur == null ? -1 : b.blur;
      if (av > bv * 1.08) { best = f; return; }
      if (bv > av * 1.08) return;
      const ag = a.glare == null ? 1 : a.glare, bg = b.glare == null ? 1 : b.glare;
      if (ag < bg) best = f;
    });
    return best;
  }

  // ── steps ────────────────────────────────────────────────────────────────
  // `consent` is a step this client owns: GET state does not list it (the
  // backend's step list is derived from workflow FEATURES, and consent is not a
  // feature), it reports consent separately as `state.consents`. So the cursor
  // walks a list with consent prepended when no `terms` row exists yet.
  const CAPTURE_STEPS = ['document_front', 'document_back', 'medical_rec', 'selfie', 'challenge'];
  const TERMINAL = ['Approved', 'Declined', 'In Review', 'Abandoned', 'Expired', 'Kyc Expired'];
  function isTerminal(status) { return TERMINAL.indexOf(status) >= 0; }

  // What the guest reads at each step. `branding.copy` (Customization) wins
  // where the owner has set a sentence, because that is the whole point of the
  // white-label screen; the BIG WORD is not in the customization schema, so it
  // comes from here and from the Concept D frames verbatim.
  const STEP_COPY = {
    consent: { big: "Let's check your ID", say: 'Two photos of your licence, then a quick look at the camera. It takes about half a minute.' },
    document_front: { big: 'Front of your licence', say: 'Lay it flat inside the corners. Rock the card gently — that is how we see the ink move.' },
    document_back: { big: 'Now the back', say: 'The barcode on the back is the part we read. It carries your name and date of birth, so we do not have to guess at the print on the front.' },
    medical_rec: { big: "Now your doctor's recommendation", say: "Lay the whole page flat so the doctor's name, licence number and dates are readable." },
    selfie: { big: 'Look at the camera', say: 'Hold still for two seconds.' },
    challenge: { big: 'One quick check', say: 'Follow the prompt. The screen will change colour while you do — that is the check.' },
  };

  // THE OFFERED (optional) ENTRY COPY — an 18–20-year-old on a REC_21 workflow
  // with offer_medical_path on (contract round-3 addendum; plan §5.5). This is
  // shown ONLY while `state.steps[]`'s medical_rec entry is both `optional:true`
  // and still `todo` — a guided retry of an attempt already made skips straight
  // to the capture screen below, because the guest already decided.
  const MED_REC_OFFER = {
    big: 'Under 21?',
    say: "Recreational purchases need you to be 21. If you have a doctor's recommendation, add it now.",
  };

  // GUEST-SAFE DECLINE SENTENCES. The server sends a reason CODE
  // (CAPTURE_SAFE_REASONS in wmdemo/idv_api.py); the guest is never shown one.
  // This is the only place a code becomes a sentence, and every sentence ends
  // where the guest's options are, not where our confidence is.
  const DECLINE_SENTENCE = {
    DOC_EXPIRED: 'The ID you showed us has expired.',
    UNDER_AGE: 'The date of birth on this ID does not meet the age we have to check for.',
    OUT_OF_STATE: 'We could not accept this ID for an order here.',
    DOC_NEAR_EXPIRY: 'The ID you showed us is too close to its expiry date.',
    DOC_QUALITY_LOW: 'We could not read the ID clearly enough.',
    BARCODE_OCR_MISMATCH: 'The barcode and the print on this ID do not agree.',
    FACE_MATCH_LOW: 'The selfie and the photo on the ID did not match closely enough.',
    LIVENESS_LOW: 'The camera check did not come through clearly enough.',
    LIVENESS_FAILED_3X: 'The camera check did not come through after three tries.',
    LIVENESS_ATTEMPTS_EXHAUSTED_HARD: 'The camera check did not come through after three tries.',
    AGE_ESTIMATE_UNDER_MARGIN: 'We could not confirm your age from what we captured.',
  };
  const NEXT_STEP_SENTENCE = {
    in_store: 'Bring your physical ID to any Hyperwolf store — the associate can verify you there.',
    none: 'Nothing you can fix here. If you think that is wrong, ask for the manager.',
  };

  // ── camera ───────────────────────────────────────────────────────────────
  // status: 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'failed'
  //   denied      — the person (or the embedding browser) said no. Recoverable
  //                 by them, not by us, so the screen says how.
  //   unavailable — there is no getUserMedia at all, or no camera. THIS is the
  //                 only state that earns the file-input fallback (task brief:
  //                 "No file-input fallback unless getUserMedia is
  //                 unavailable"), and the screen says that is what happened.
  //   failed      — a camera exists and said yes, then broke.
  function useCamera(active, facing) {
    const [stream, setStream] = React.useState(null);
    const [status, setStatus] = React.useState('idle');
    const [detail, setDetail] = React.useState(null);
    const videoRef = React.useRef(null);

    React.useEffect(function () {
      if (!active) { setStatus('idle'); setStream(null); return undefined; }
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') {
        setStatus('unavailable');
        setDetail('This browser does not offer camera access to the page.');
        return undefined;
      }
      let cancelled = false;
      let got = null;
      setStatus('starting'); setDetail(null);
      // `ideal`, never `exact`: a tablet with one camera must still work. An
      // `exact` facingMode is an OverconstrainedError on every such device.
      const want = facing === 'environment'
        ? { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } };
      md.getUserMedia({ video: want, audio: false }).then(function (s) {
        got = s;
        if (cancelled) { stopStream(s); return; }
        setStream(s); setStatus('live');
      }).catch(function (err) {
        if (cancelled) return;
        const n = (err && err.name) || '';
        if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
          setStatus('denied');
        } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') {
          setStatus('unavailable');
        } else {
          setStatus('failed');
        }
        setDetail((err && err.message) || n || null);
      });
      return function () {
        cancelled = true;
        if (got) stopStream(got);
        setStream(null);
      };
    }, [active, facing]);

    // srcObject is set in its own effect so it is applied whenever EITHER the
    // stream or the <video> element changes. Setting it inside the getUserMedia
    // callback races the first render of the element in this component's tree.
    React.useEffect(function () {
      const v = videoRef.current;
      if (!v) return;
      if (stream) { v.srcObject = stream; const p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else { try { v.srcObject = null; } catch (e) {} }
    }, [stream]);

    return { status: status, detail: detail, videoRef: videoRef, stream: stream };
  }
  function stopStream(s) {
    try { (s.getTracks() || []).forEach(function (t) { t.stop(); }); } catch (e) {}
  }

  // ── the guide overlay ────────────────────────────────────────────────────
  // Drawn on a <canvas> from tokens, per plan §5.5 ("guides drawn on a
  // canvas"). `shape:'card'` is the four corner brackets of the Concept D
  // document frame; `shape:'oval'` is the face oval. Nothing here is a colour
  // literal: every stroke and every fill comes from P.
  function GuideOverlay({ shape, tone, dim }) {
    const P = useP();
    const ref = React.useRef(null);
    const wrapRef = React.useRef(null);
    const colour = tone || P.accent;

    const draw = React.useCallback(function () {
      const cv = ref.current, wrap = wrapRef.current;
      if (!cv || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (shape === 'oval') {
        const rx = Math.min(w * 0.32, h * 0.30), ry = rx * 1.32;
        const cx = w / 2, cy = h / 2;
        if (dim) {
          ctx.fillStyle = dim;
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill('evenodd');
        }
        ctx.strokeStyle = colour;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      // 'card' — an ID-1 aspect box (85.6 x 53.98 mm) with corner brackets.
      // 'page' — the same brackets, but TALLER THAN WIDE: a doctor's
      // recommendation is a full sheet held up to the camera, not a wallet
      // card, and a landscape guide over a portrait document would have the
      // guest hunting for where the corners are supposed to land.
      const pad = Math.min(w, h) * 0.09;
      let bw = w - pad * 2;
      let bh = shape === 'page' ? bw * 1.294 : bw / 1.586;
      if (bh > h - pad * 2) { bh = h - pad * 2; bw = shape === 'page' ? bh / 1.294 : bh * 1.586; }
      const x = (w - bw) / 2, y = (h - bh) / 2;
      if (dim) {
        ctx.fillStyle = dim;
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.rect(x, y, bw, bh);
        ctx.fill('evenodd');
      }
      const arm = Math.min(bw, bh) * 0.22;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const corners = [[x, y, 1, 1], [x + bw, y, -1, 1], [x, y + bh, 1, -1], [x + bw, y + bh, -1, -1]];
      corners.forEach(function (c) {
        ctx.beginPath();
        ctx.moveTo(c[0] + arm * c[2], c[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(c[0], c[1] + arm * c[3]);
        ctx.stroke();
      });
    }, [shape, colour, dim]);

    React.useLayoutEffect(function () {
      draw();
      window.addEventListener('resize', draw);
      return function () { window.removeEventListener('resize', draw); };
    }, [draw]);

    return (
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <canvas ref={ref} style={{ display: 'block' }} />
      </div>);
  }

  // ── chrome ───────────────────────────────────────────────────────────────
  function Pips({ steps, current }) {
    const P = useP();
    const at = steps.indexOf(current);
    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: `${P.space.x2}px 0` }}>
        {steps.map(function (s, i) {
          const done = at >= 0 && i < at, now = i === at;
          return <span key={s} aria-hidden="true" style={{ width: now ? 26 : 8, height: 8, borderRadius: P.r999,
            background: done ? P.good : now ? P.accent : P.hairline2, transition: 'width .18s ease' }} />;
        })}
      </div>);
  }

  function TopBar({ brand, title, right }) {
    const P = useP();
    return (
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: P.space.x3,
        padding: `${P.space.x3}px ${P.space.x4}px`, borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <span style={{ width: 26, height: 26, borderRadius: P.r8, background: P.accent, color: P.accentInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: P.type.strong,
          fontWeight: P.weight.num, flex: '0 0 auto' }}>{(brand || 'V').slice(0, 1).toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: P.weight.emph, color: P.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {right ? <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim, flex: '0 0 auto' }}>{right}</span> : null}
      </div>);
  }

  // The plate is the Concept D "tplate" — one large token-toned tile carrying a
  // single icon. It is the only decoration on an outcome screen.
  function Plate({ tone, icon }) {
    const P = useP();
    const map = { good: [P.goodSoft, P.good], warn: [P.warnSoft, P.warnText], bad: [P.badSoft, P.bad],
      info: [P.infoSoft, P.info], neutral: [P.neutralSoft, P.inkDim] };
    const pair = map[tone] || map.neutral;
    return (
      <div style={{ width: 72, height: 72, borderRadius: P.r20, background: pair[0],
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <window.Icon name={icon} size={34} stroke={1.8} color={pair[1]} />
      </div>);
  }

  function Big({ children }) {
    const P = useP();
    return <h1 style={{ margin: 0, fontSize: P.type.h1, lineHeight: 1.15, fontWeight: 700, color: P.ink, textAlign: 'center' }}>{children}</h1>;
  }
  function Say({ children, mute }) {
    const P = useP();
    if (!children) return null;
    return <p style={{ margin: 0, maxWidth: 420, textAlign: 'center', fontSize: P.type.body,
      lineHeight: 1.6, color: mute ? P.inkMute : P.ink2 }}>{children}</p>;
  }

  // ── the associate bar (pos mode only) ────────────────────────────────────
  // Concept D's rule, verbatim: "The associate bar never shows a score. A
  // number an associate cannot act on becomes a number they argue with the
  // customer about." A reason CODE is shown, because it is what the associate
  // repeats to a manager; a score is not.
  function AssociateBar({ sessionRef, workflow, storeLabel, reasons, line, actions }) {
    const P = useP();
    return (
      <div style={{ flex: '0 0 auto', borderTop: `1px solid ${P.hairline}`, background: P.surface2,
        padding: `${P.space.x2}px ${P.space.x4}px`, display: 'flex', alignItems: 'center',
        gap: P.space.x3, flexWrap: 'wrap', minHeight: P.ctrlH.lg }}>
        <span style={{ fontSize: P.type.micro, fontFamily: P.fontMono, letterSpacing: '.06em',
          textTransform: 'uppercase', color: P.inkMute, flex: '0 0 auto' }}>Associate</span>
        {sessionRef ? <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.ink2 }}>{sessionRef}</span> : null}
        {storeLabel ? <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>{storeLabel}</span> : null}
        {workflow ? <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{workflow}</span> : null}
        {reasons && reasons.length && window.IdvShared ? <window.IdvShared.ReasonChips reasons={reasons} /> : null}
        <span style={{ flex: 1, minWidth: 120, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.45 }}>{line}</span>
        {actions}
      </div>);
  }

  // ── the flash panel ─────────────────────────────────────────────────────
  // The challenge's "flash" step, rendered as the token colour the SERVER named
  // — the sequence is part of the nonce, so the page may not choose it. Fixed
  // and above the modal layer because its job is to light the guest's face:
  // inside a POS modal a panel that only covers the modal would not.
  function FlashPanel({ tone }) {
    const P = useP();
    if (!tone) return null;
    const colour = P[tone] || P.accent;
    return <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: colour, zIndex: P.z.modalPop }} />;
  }

  // ── the component ────────────────────────────────────────────────────────
  window.IdvCapture = function IdvCapture({ token, mode = 'hosted', onDone, sessionRef = null,
    sessionId = null, storeLabel = null, base = null }) {
    const P = useP();
    const pos = mode === 'pos';

    // GET state, once, and again only when something we did changes it. This is
    // deliberately NOT HWIdv.usePoll: `state` has no idv_version to
    // short-circuit on, and a guest page re-fetching a step list every 15 s
    // while the guest is holding a card in front of a camera is bandwidth for
    // nothing. The thing that IS polled is `status`, after submit.
    const [state, setState] = React.useState(null);
    const [loadErr, setLoadErr] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    // 'consent' | 'capture' | 'challenge' | 'processing' | 'outcome'
    const [phase, setPhase] = React.useState('consent');
    const [cursor, setCursor] = React.useState('consent');
    const [done, setDone] = React.useState({});        // step id -> true, this page session
    const [poll, setPoll] = React.useState(null);      // last GET status body
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState(null);  // one plain sentence, guest-facing
    const [hint, setHint] = React.useState(null);      // advisory blur/glare sentence
    const [biometric, setBiometric] = React.useState(false);
    const [flash, setFlash] = React.useState(null);
    const [prompt, setPrompt] = React.useState(null);  // { text, arrow }
    const [pickerPhotos, setPickerPhotos] = React.useState([]);
    const [started, setStarted] = React.useState(false); // any media uploaded from this page

    const submittedRef = React.useRef(false);
    const beaconedRef = React.useRef(false);
    const aliveRef = React.useRef(true);

    const branding = (state && state.branding) || null;
    const copy = (branding && branding.copy) || {};
    const brandName = (branding && branding.brand_name) || 'Hyperwolf';
    // `accent` from Customization is a TOKEN NAME, never a colour
    // (docs/IDV-API-CONTRACT.md: "`accent` must be a token name"). An
    // unrecognised name falls back to the brand accent rather than to
    // undefined, which would paint nothing.
    const accent = (branding && P[branding.accent]) || P.accent;
    const workflowName = (state && state.workflow && state.workflow.name) || null;
    const status = (poll && poll.status) || (state && state.status) || null;

    // OFFERED, NOT REQUIRED. `medical_rec` carries `optional:true` for an
    // 18–20-year-old on a REC_21 workflow with `offer_medical_path` on
    // (contract round-3 addendum; plan §5.5). The choice frame is shown only
    // while the server's own `state` for the step is still `todo` — once an
    // attempt exists (`retry`) the guest already decided to add one, so a
    // guided retry goes straight back to the camera rather than asking again.
    const medicalRecOffered = React.useMemo(function () {
      const entry = ((state && state.steps) || []).filter(function (s) { return s.id === 'medical_rec'; })[0];
      return !!(entry && entry.optional && entry.state === 'todo');
    }, [state]);

    // The step list, with consent prepended while the terms row is missing.
    const stepIds = React.useMemo(function () {
      const server = ((state && state.steps) || []).map(function (s) { return s.id; })
        .filter(function (id) { return CAPTURE_STEPS.indexOf(id) >= 0; });
      const list = server.length ? server : CAPTURE_STEPS.slice();
      const consents = (state && state.consents) || [];
      const hasTerms = consents.some(function (c) { return c.kind === 'terms'; });
      return hasTerms ? list : ['consent'].concat(list);
    }, [state]);

    // WHAT STILL HAS TO HAPPEN. `state.steps[].state` is the server's answer
    // ('todo' | 'done' | 'retry'); `done` is what this page has uploaded since
    // the last state read. A step is outstanding when neither says it is done.
    // `after == null` means "the first outstanding step"; otherwise it means
    // "the first outstanding step AFTER this one", which is why advance() can
    // safely call it before setDone() has landed.
    const nextOutstanding = React.useCallback(function (after) {
      const serverDone = {};
      ((state && state.steps) || []).forEach(function (s) { if (s.state === 'done') serverDone[s.id] = true; });
      const consents = (state && state.consents) || [];
      if (consents.some(function (c) { return c.kind === 'terms'; })) serverDone.consent = true;
      const all = stepIds;
      const from = after == null ? 0 : all.indexOf(after) + 1;
      for (let i = Math.max(0, from); i < all.length; i++) {
        const id = all[i];
        if (!serverDone[id] && !done[id]) return id;
      }
      return null;
    }, [state, stepIds, done]);

    // ── load state ─────────────────────────────────────────────────────────
    const loadState = React.useCallback(function () {
      setLoading(true);
      return capGet(token, 'state', base).then(function (r) {
        if (!aliveRef.current) return;
        setLoading(false);
        if (!r.ok) { setLoadErr(r.error || 'that verification link is not valid'); return; }
        setLoadErr(null);
        setState(r.body);
      });
    }, [token, base]);

    React.useEffect(function () {
      aliveRef.current = true;
      loadState();
      return function () { aliveRef.current = false; };
    }, [loadState]);

    // Position the cursor the first time real state arrives, and whenever the
    // server tells us the session is already finished.
    React.useEffect(function () {
      if (!state) return;
      if (isTerminal(state.status)) { setPhase('outcome'); return; }
      // AWAITING USER ON A FRESH LOAD IS NOT "GO STRAIGHT BACK TO THE CAMERA".
      // The guest is owed the one sentence the engine wrote before they retake
      // anything — that is the whole point of `guidance.fix`, and reopening the
      // camera silently would repeat the same mistake at the same step. So the
      // page routes through 'processing', whose poller reads `GET status` once
      // and lands on the retry frame (Awaiting User stops the poll on the first
      // response). Measured: without this, reloading a session the engine had
      // answered `Awaiting User` dropped the guest into the document camera with
      // no explanation of why they were there.
      if (state.status === 'Awaiting User' && !poll) { setPhase('processing'); return; }
      if (submittedRef.current) return;
      const consents = state.consents || [];
      const hasTerms = consents.some(function (c) { return c.kind === 'terms'; });
      // A RESUBMISSION RE-OPENS ONLY WHAT THE SERVER ASKED FOR. `resubmit_nodes`
      // is the analyst's list; `guidance.step` is the engine's. Either way the
      // guest does one thing, not the whole flow again.
      const retry = ((state.steps || []).filter(function (s) { return s.state === 'retry'; })[0] || {}).id;
      const first = retry || (hasTerms ? (nextOutstanding(null) || 'document_front') : 'consent');
      setCursor(first);
      setPhase(first === 'consent' ? 'consent' : first === 'challenge' ? 'challenge' : 'capture');
      // eslint-disable-next-line
    }, [state && state.status, state && (state.consents || []).length, state && (state.steps || []).length]);

    // ── walk-off beacon ───────────────────────────────────────────────────
    // Plan §5.5: "Abandon: visibilitychange/pagehide beacon". Both events are
    // watched, and neither fires on a terminal status. They do NOT carry the
    // same weight, and the difference is the result of a measurement, not a
    // preference:
    //
    // BOTH FIRE ONLY BEFORE ANYTHING HAS BEEN CAPTURED, and that condition is
    // the result of two measurements, not caution:
    //
    //   1. Loading this page in an automated browser whose pane is backgrounded
    //      fired `visibilitychange` → hidden and abandoned a live `Not Started`
    //      session with the guest still sitting on it.
    //   2. A plain `location.reload()` fires `pagehide`. On a session the engine
    //      had already answered `Awaiting User`, with 19 media rows and a real
    //      decision on it, that beacon wrote `Awaiting User → Abandoned` and
    //      destroyed the answer. Neither event can tell a reload, a tab switch
    //      or an app switch apart from a walk-off; the browser does not offer
    //      that distinction.
    //
    // AND THE SERVER CANNOT UNDO IT. `POST abandon` guards only Approved,
    // Declined, In Review and Kyc Expired (wmdemo/idv_api.py), so it happily
    // overwrites `Awaiting User` — a status only the ENGINE may write — and
    // `_capture_media` lifts a session to `In Progress` from Not Started,
    // Awaiting User and Resubmitted but never from Abandoned. So an abandon sent
    // in error is unrecoverable in both directions.
    //
    // Nothing is lost by the narrowing. The drop-off abandonment exists to
    // measure is "created a session and never took a photo" — the largest single
    // leak in the funnel — and that is exactly the pre-capture case that still
    // fires. A guest who closes the tab mid-flow is still accounted for: the TTL
    // sweeper moves the session to `Expired`, which the funnel already counts
    // separately, and which cannot erase a decision.
    //
    // Two backend changes would let this widen back out to every phase, and both
    // are recorded as gaps rather than made here: `POST abandon` must refuse a
    // session the engine has already answered, and `_capture_media` must lift
    // `Abandoned` back to `In Progress`.
    React.useEffect(function () {
      function bail() {
        if (beaconedRef.current) return;
        const s = status;
        if (!s || isTerminal(s)) return;
        if (started || submittedRef.current || s !== 'Not Started') return;
        beaconedRef.current = true;
        capBeacon(token, 'abandon', base);
      }
      function onVis() { if (document.visibilityState === 'hidden') bail(); }
      window.addEventListener('pagehide', bail);
      document.addEventListener('visibilitychange', onVis);
      return function () {
        window.removeEventListener('pagehide', bail);
        document.removeEventListener('visibilitychange', onVis);
      };
    }, [token, base, status, started]);

    // ── status polling ────────────────────────────────────────────────────
    // 1.5 s, backing off to 4 s once 30 s have gone by, stopping on a terminal
    // status and on `Awaiting User` (which is not terminal but IS waiting on the
    // guest, so polling it would be asking a question only they can answer).
    React.useEffect(function () {
      if (phase !== 'processing') return undefined;
      let timer = null, stopped = false;
      const t0 = Date.now();
      function tick() {
        capGet(token, 'status', base).then(function (r) {
          if (stopped || !aliveRef.current) return;
          if (r.ok && r.body) {
            setPoll(r.body);
            const s = r.body.status;
            if (isTerminal(s) || s === 'Awaiting User') {
              stopped = true;
              setPhase('outcome');
              return;
            }
          }
          schedule();
        });
      }
      function schedule() {
        if (stopped) return;
        const ms = (Date.now() - t0) > 30000 ? 4000 : 1500;
        timer = setTimeout(tick, ms);
      }
      tick();
      return function () { stopped = true; clearTimeout(timer); };
    }, [phase, token, base]);

    // Report the ending outwards exactly once. The seam's Approved path uses
    // this; the hosted page has no onDone at all.
    const reportedRef = React.useRef(false);
    React.useEffect(function () {
      if (phase !== 'outcome' || reportedRef.current) return;
      const s = status;
      if (!s || !isTerminal(s)) return;
      reportedRef.current = true;
      if (typeof onDone === 'function') {
        onDone({ status: s, sessionId: sessionId, sessionRef: sessionRef,
          reasons: (poll && poll.reasons) || [], next_step: (poll && poll.next_step) || null,
          message: (poll && poll.message) || null });
      }
      // eslint-disable-next-line
    }, [phase, status]);

    // ── consent ───────────────────────────────────────────────────────────
    function acceptTerms() {
      setBusy(true); setNotice(null);
      const terms = (state && state.terms) || {};
      const body = { kind: 'terms', accepted: true,
        terms_version: terms.version || (window.IDV_TERMS && window.IDV_TERMS.version) || null,
        terms_url: terms.url || null };
      capPost(token, 'consent', body, base).then(function (r) {
        if (!r.ok) { setBusy(false); setNotice(plainFail(r, 'We could not record that. Try again.')); return; }
        // The biometric box is a SEPARATE, UNBUNDLED consent (plan §3.10). It is
        // posted only when ticked, and declining it still continues — the selfie
        // and template are simply purged after the decision.
        const after = function () {
          setBusy(false);
          setDone(function (d) { return Object.assign({}, d, { consent: true }); });
          const nxt = nextOutstanding('consent') || 'document_front';
          setCursor(nxt);
          setPhase(nxt === 'challenge' ? 'challenge' : 'capture');
        };
        if (!biometric) { after(); return; }
        capPost(token, 'consent', Object.assign({}, body, { kind: 'biometric_retention' }), base)
          .then(function () { after(); });
      });
    }

    // ── uploading a step ──────────────────────────────────────────────────
    function advance(fromStep) {
      setStarted(true);
      setHint(null);
      const nxt = nextOutstanding(fromStep);
      setDone(function (d) { return Object.assign({}, d, { [fromStep]: true }); });
      if (!nxt) { submitNow(); return; }
      setCursor(nxt);
      setPhase(nxt === 'challenge' ? 'challenge' : 'capture');
    }

    function submitNow() {
      submittedRef.current = true;
      setBusy(true); setNotice(null);
      setPhase('processing');
      capPost(token, 'submit', {}, base).then(function (r) {
        setBusy(false);
        if (!r.ok) {
          // A refused submit is not a decision. Stay honest: say it did not go
          // in and keep the guest where they are.
          setPhase('outcome');
          setPoll({ status: 'In Progress', message: plainFail(r, 'We could not send that for checking just now. Try again in a few minutes.'), reasons: [] });
          return;
        }
        // 202 { status:'In Progress', job_id, engine_ok }. Polling picks it up.
      });
    }

    function plainFail(r, fallback) {
      if (r && r.code === 413) return 'That photo was too large. Take it again.';
      if (r && r.code === 415) return 'That file is not a photo we can read. Take it again.';
      if (r && r.code === 403) return 'This verification link is no longer valid. Ask for a new one.';
      if (r && r.code === 409) return 'That step is already finished.';
      return fallback;
    }

    // ── outcome helpers ───────────────────────────────────────────────────
    const guidance = (poll && poll.guidance) || null;
    const retryInfo = (poll && poll.retry) || null;
    const enginePausedNow = !!(poll && poll.message && /paused/i.test(poll.message))
      || !!(state && state.engine_ok === false);
    // THE MANUAL PATH IS A WORKFLOW FLAG, NOT A CODE PATH (escalation §11.3).
    // The task brief and the contract both put it on the workflow config as
    // `manual_fallback_when_engine_down`, read through `GET state`. Today
    // `state.workflow` carries only { name, face_liveness_method }, so this is
    // undefined and the button is drawn OFF — which is also the current correct
    // answer, because the owner has not ruled. Recorded as a contract gap; the
    // read is written against the intended shape so that when the backend adds
    // the field this file needs no change.
    const manualAllowed = !!(state && state.workflow && state.workflow.manual_fallback_when_engine_down);

    function tryAgain() {
      // ONLY the step the server named re-opens. Everything already accepted
      // stays accepted — that is the whole point of `guidance.step`.
      const step = (guidance && guidance.step) || (retryInfo && retryInfo.step) || 'selfie';
      setPoll(null);
      setNotice(null);
      submittedRef.current = false;
      reportedRef.current = false;
      setDone({});
      setCursor(step);
      setPhase(step === 'challenge' ? 'challenge' : 'capture');
      loadState();
    }

    // ── the pos-mode override ─────────────────────────────────────────────
    // This is the ONE console route this file touches, and it is the reason
    // HWIdv is read at all: `PATCH /api/idv/sessions/{id}/update-status` with
    // { new_status:'Approved', override:true, reason } needs the `X-HW-Actor`
    // header, and the backend only grants a POS override when the actor's store
    // matches the session's (wmdemo/idv_api.py L971-973).
    //
    // WHY THE FETCH IS BUILT HERE RATHER THAN CALLED THROUGH HWIdv: HWIdv
    // exposes get() and post() only — there is no patch() — and adding one is an
    // edit to idv/idv-client.jsx, which is outside this task's file scope. The
    // actor header and the write-token convention are read from the same places
    // idv-client.jsx reads them, so there is one convention, not two.
    const [overrideOpen, setOverrideOpen] = React.useState(false);
    const [overrideReason, setOverrideReason] = React.useState('');
    function consoleOverride() {
      const reason = overrideReason.trim();
      if (!reason || !sessionId) return;
      setBusy(true);
      const L = window.HW_LIVE;
      const b = base != null ? resolveBase(base) : (L && L.base ? String(L.base).replace(/\/+$/, '') : '');
      const s = window.HWIdv ? window.HWIdv.session() : null;
      const headers = { 'Content-Type': 'application/json' };
      if (s && s.id) headers['X-HW-Actor'] = s.id;
      let tok = null;
      try { tok = (window.localStorage.getItem('hw-live-token') || '').trim() || null; } catch (e) { tok = null; }
      if (tok && (!b || b === window.location.origin)) headers['x-hw-write-token'] = tok;
      fetch(b + '/api/idv/sessions/' + encodeURIComponent(sessionId) + '/update-status', {
        method: 'PATCH', cache: 'no-store', credentials: 'omit', headers: headers,
        body: JSON.stringify({ new_status: 'Approved', override: true, reason: reason }),
      }).then(function (res) {
        return res.json().then(function (j) { return { ok: res.ok, code: res.status, body: j }; },
          function () { return { ok: res.ok, code: res.status, body: null }; });
      }).catch(function (e) { return { ok: false, code: 0, body: { error: e && e.message } }; })
        .then(function (r) {
          setBusy(false);
          if (!r.ok) {
            setNotice((r.body && r.body.error) || 'The override was refused.');
            return;
          }
          setOverrideOpen(false);
          setPoll({ status: 'Approved', reasons: [], message: null, overridden: true });
          setPhase('outcome');
        });
    }

    // ── render ────────────────────────────────────────────────────────────
    const shellStyle = { display: 'flex', flexDirection: 'column', minHeight: pos ? 460 : '100%',
      height: pos ? '100%' : '100%', background: P.bg, borderRadius: pos ? P.r12 : 0,
      border: pos ? `1px solid ${P.hairline}` : 'none', overflow: 'hidden' };
    const bodyStyle = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: P.space.x4,
      padding: `${P.space.x6}px ${P.space.x5}px`, textAlign: 'center' };

    function shell(title, right, body, footLine, footActions) {
      return (
        <div style={shellStyle} data-hw="idv-capture" data-hw-mode={mode}>
          <TopBar brand={brandName} title={title} right={right} />
          {phase !== 'outcome' && !loadErr ? <Pips steps={stepIds} current={cursor} /> : null}
          <div style={bodyStyle}>{body}</div>
          {/* THE TERMS ARE REACHABLE FROM EVERY STATE, not only from the consent
              screen. Two reasons, and the first is the real one: a page that
              photographs a government ID and records a biometric consent must
              let the reader open what they agreed to at any point, including
              from the paused screen and from a decline — states the consent card
              is not on screen for. The second is that the pinned developer
              banner inside the modal ("Update the Hyperwolf Terms and
              Conditions to cover Civil Code 1798.90.1 …") is a live open item
              the owner wants visible; behind one screen out of nine it would not
              be. The consent screen keeps its OWN inline link as well — the
              terms have to be clickable on the same screen as the box (plan
              §3.10), which a footer does not satisfy on its own. */}
          {phase !== 'consent' && window.IdvTerms ? (
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: P.space.x2, padding: `${P.space.x2}px ${P.space.x4}px`, borderTop: `1px solid ${P.hairline}` }}>
              <span style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>{brandName}</span>
              <window.IdvTerms.Link label="Terms and Conditions" />
            </div>) : null}
          {pos ? <AssociateBar sessionRef={sessionRef} workflow={workflowName} storeLabel={storeLabel}
            reasons={(poll && poll.reasons) || []} line={footLine} actions={footActions} /> : null}
          <FlashPanel tone={flash} />
        </div>);
    }

    // Loading / broken link
    if (loading && !state) {
      return shell(brandName, sessionRef, (
        <React.Fragment>
          <window.Skeleton w={180} h={14} />
          <Say mute>One moment.</Say>
        </React.Fragment>), 'Opening the session…', null);
    }
    if (loadErr) {
      // A bad or expired token is the one failure the guest cannot act on alone,
      // so it names the action they CAN take. NotConnected's shape, own nouns.
      return shell(brandName, null, (
        <window.ErrorState title="This link is not valid"
          body="It may have already been used or timed out. Ask for a new one — nothing you did was lost."
          detail={loadErr} onRetry={loadState} />), 'Associate · issue a new link from the session', null);
    }

    // ENGINE DOWN, BEFORE ANYTHING IS CAPTURED — Concept D frame E. The screen
    // says so plainly rather than walking the guest through forty seconds of
    // capture that nothing can judge. Once media exists the flow continues and
    // the paused sentence arrives from `GET status` instead (see submitNow).
    if (state && state.engine_ok === false && !started && !submittedRef.current && !isTerminal(state.status)) {
      const manual = manualAllowed;
      return shell(brandName, sessionRef, (
        <React.Fragment>
          <Plate tone="warn" icon="pause" />
          <Big>Verification is paused</Big>
          <Say>{copy.paused || 'The check is not running right now. Try again in a few minutes.'}</Say>
          <window.Pill kind="warn" dot>Engine not reachable</window.Pill>
          {pos ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: P.space.x2, marginTop: P.space.x2 }}>
              {/* DRAWN, AND OFF. Hiding the manual path would hide the open
                  decision; drawing it disabled puts the question in front of
                  the person who can answer it (escalation §11.3). It turns on
                  when the workflow's manual_fallback_when_engine_down does. */}
              <window.PBtn size="xl" variant="secondary" disabled={!manual}
                onClick={manual ? function () { setOverrideOpen(true); } : undefined}>
                Associate checked the physical ID
              </window.PBtn>
              <Say mute>{manual ? 'Recorded as a manual decision, re-verified next visit.' : 'Off — needs an owner ruling'}</Say>
            </div>) : null}
          <window.PBtn size="md" variant="ghost" icon="refresh" onClick={loadState}>Check again</window.PBtn>
        </React.Fragment>),
        'Check-in does not continue · no decision has been made', null);
    }

    // ── consent ───────────────────────────────────────────────────────────
    if (phase === 'consent') {
      const terms = (state && state.terms) || {};
      return shell(brandName, sessionRef, (
        <React.Fragment>
          <Plate tone="neutral" icon="card" />
          <Big>{STEP_COPY.consent.big}</Big>
          <Say>{copy.intro || STEP_COPY.consent.say}</Say>
          <ConsentNotice terms={terms} />
          <BiometricBox on={biometric} onChange={setBiometric} />
          {notice ? <Say>{notice}</Say> : null}
          <window.PBtn size="xl" variant="accent" busy={busy} onClick={acceptTerms} disabled={busy}>Continue</window.PBtn>
        </React.Fragment>),
        'New session on ' + (workflowName || 'this workflow') + ' · nothing is stored until they tap Continue', null);
    }

    // ── capture (document front / back / selfie) ───────────────────────────
    if (phase === 'capture') {
      return (
        <CaptureStep key={cursor} step={cursor} token={token} base={base} accent={accent}
          copy={copy} shell={shell} sessionRef={sessionRef} onUploaded={advance}
          onNotice={setNotice} notice={notice} hint={hint} onHint={setHint}
          pickerPhotos={pickerPhotos} setPickerPhotos={setPickerPhotos}
          medicalRecOffered={medicalRecOffered} />);
    }

    // ── challenge ─────────────────────────────────────────────────────────
    if (phase === 'challenge') {
      return (
        <ChallengeStep key="challenge" token={token} base={base} accent={accent} shell={shell}
          setFlash={setFlash} prompt={prompt} setPrompt={setPrompt}
          onNotice={setNotice} notice={notice}
          onDoneStep={function () { advance('challenge'); }} />);
    }

    // ── processing ────────────────────────────────────────────────────────
    if (phase === 'processing') {
      return shell('Checking', sessionRef, (
        <React.Fragment>
          <Plate tone="info" icon="clock" />
          <Big>Give us a few seconds</Big>
          <Say>{copy.processing || 'Usually about three.'}</Say>
          <div style={{ width: 200 }}><window.BarMeter value={0.62} color={P.info} height={6} /></div>
        </React.Fragment>),
        'Waiting on the engine · the tablet sets no status', null);
    }

    // ── outcomes ──────────────────────────────────────────────────────────
    if (status === 'Approved') {
      return shell('Done', sessionRef, (
        <React.Fragment>
          <Plate tone="good" icon="check-circle" />
          <Big>{pos ? "You're verified — welcome back" : "You're verified"}</Big>
          <Say>{copy.approved || 'Thanks. That is everything we needed.'}</Say>
          <window.Pill kind="good" dot>Approved</window.Pill>
        </React.Fragment>),
        pos ? 'Check-in continues' : null, null);
    }
    if (status === 'Awaiting User') {
      const attempt = (retryInfo && retryInfo.attempt) || (guidance && guidance.attempt) || 1;
      const max = (retryInfo && retryInfo.max) || (guidance && guidance.max) || 3;
      return shell("Let's try that again", sessionRef, (
        <React.Fragment>
          <Plate tone="warn" icon="refresh" />
          <Big>One more try</Big>
          {/* ONE SENTENCE, THE SERVER'S. `guidance.fix` is written by the rules
              at callback time precisely so the page does not invent advice. */}
          <Say>{(guidance && guidance.fix) || (poll && poll.message) || 'Move somewhere a bit brighter and look straight at the camera.'}</Say>
          <Say mute>{'Attempt ' + attempt + ' of ' + max}</Say>
          <window.PBtn size="lg" variant="accent" onClick={tryAgain}>{'Try again (attempt ' + attempt + ' of ' + max + ')'}</window.PBtn>
        </React.Fragment>),
        'Each attempt writes an event · re-opens only the ' + (((guidance && guidance.step) || (retryInfo && retryInfo.step) || 'selfie').replace(/_/g, ' ')) + ' step', null);
    }
    if (status === 'In Review') {
      return shell('Almost there', sessionRef, (
        <React.Fragment>
          <Plate tone="warn" icon="clock" />
          <Big>Needs a look</Big>
          <Say>{copy.review || 'Someone is checking this now. It usually takes a few minutes.'}</Say>
          <window.Pill kind="warn" dot>In Review</window.Pill>
        </React.Fragment>),
        'In the needs-a-human lane · the customer is never shown the code', null);
    }
    if (status === 'Declined') {
      const reasons = (poll && poll.reasons) || [];
      // MED_REC_* NEVER SHOWS ITS CODE, AND NEVER GUESSES ONE EITHER. The five
      // decline reasons (expired, name/DOB mismatch, bad licence, out of
      // state) turn on facts about a document this page cannot re-derive, so
      // the server's own sentence (`poll.message`, contract round-3 addendum)
      // wins when it sent one; the fallback is the one plain sentence, never
      // the DECLINE_SENTENCE map's per-code text and never the code itself.
      const isMedRec = reasons.some(function (r) { return /^MED_REC_/.test(r); });
      const sentence = isMedRec
        ? ((poll && poll.message) || "We couldn't verify your doctor's recommendation")
        : (reasons.map(function (r) { return DECLINE_SENTENCE[r]; }).filter(Boolean)[0] || null);
      const nextStep = NEXT_STEP_SENTENCE[(poll && poll.next_step) || 'in_store'] || NEXT_STEP_SENTENCE.in_store;
      return shell('Sorry', sessionRef, (
        <React.Fragment>
          <Plate tone="bad" icon="ban" />
          <Big>We can&rsquo;t verify this today</Big>
          <Say>{sentence || copy.declined || 'We could not complete the check.'}</Say>
          <Say mute>{nextStep}</Say>
          <window.Pill kind="bad" dot>Declined</window.Pill>
          {notice ? <Say>{notice}</Say> : null}
          {pos && overrideOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: P.space.x2, width: '100%', maxWidth: 420 }}>
              {/* atoms' Field hands onChange the raw event, not the value. */}
              <window.Field placeholder="Why are you overriding this? (required)" value={overrideReason}
                onChange={function (e) { setOverrideReason(e.target.value); }} size="lg" />
              <div style={{ display: 'flex', gap: P.space.x2, justifyContent: 'center' }}>
                <window.PBtn size="md" variant="ghost" onClick={function () { setOverrideOpen(false); }}>Cancel</window.PBtn>
                <window.PBtn size="md" variant="primary" busy={busy} disabled={!overrideReason.trim() || busy}
                  onClick={consoleOverride}>Record the override</window.PBtn>
              </div>
            </div>) : null}
        </React.Fragment>),
        pos ? 'You are holding the card — an override is recorded against your name' : null,
        pos && !overrideOpen && sessionId ? (
          <window.PBtn size="sm" variant="secondary" onClick={function () { setOverrideOpen(true); }}>Override with reason</window.PBtn>
        ) : null);
    }
    if (status === 'Abandoned' || status === 'Expired' || status === 'Kyc Expired') {
      return shell(brandName, sessionRef, (
        <React.Fragment>
          <Plate tone="neutral" icon="clock" />
          <Big>This check has timed out</Big>
          <Say>Start again when you are ready — nothing you did was kept.</Say>
        </React.Fragment>), 'Session ' + status, null);
    }
    // In Progress, and the engine has not answered — this is where the paused
    // sentence lands after a real submit (`GET status` returns PAUSED_MESSAGE
    // while an engine.unreachable event stands against the session).
    return shell(brandName, sessionRef, (
      <React.Fragment>
        <Plate tone="warn" icon="pause" />
        <Big>{enginePausedNow ? 'Verification is paused' : 'Still checking'}</Big>
        <Say>{(poll && poll.message) || copy.paused || 'Try again in a few minutes.'}</Say>
        <window.Pill kind="warn" dot>{enginePausedNow ? 'Engine not reachable' : 'In Progress'}</window.Pill>
        {pos ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: P.space.x2 }}>
            <window.PBtn size="xl" variant="secondary" disabled={!manualAllowed}>Associate checked the physical ID</window.PBtn>
            <Say mute>Off — needs an owner ruling</Say>
          </div>) : null}
        <window.PBtn size="md" variant="ghost" icon="refresh"
          onClick={function () { setPoll(null); setPhase('processing'); }}>Check again</window.PBtn>
      </React.Fragment>),
      'No decision has been made · the session stays In Progress', null);
  };

  // ── the consent notice ───────────────────────────────────────────────────
  // Text comes from window.IDV_TERMS.captureNotice and is NOT retyped here
  // (idv/idv-terms.jsx's rule: one source of truth for every legal word). Its
  // last line is a "Full details: … [link] … [link]" placeholder line, so that
  // ONE line is replaced by the real IdvTerms.Link — a placeholder rendered
  // verbatim on a consent screen reads as a broken page, and the words above it
  // are the words that matter. If the line ever stops starting with "Full
  // details", nothing is dropped: the whole notice renders verbatim instead.
  function ConsentNotice({ terms }) {
    const P = useP();
    const T = window.IDV_TERMS;
    const notice = (T && T.captureNotice) || null;
    const split = React.useMemo(function () {
      if (!notice) return { body: null, hadLink: false };
      const lines = String(notice).split('\n');
      let cut = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\s*Full details\s*:/i.test(lines[i])) { cut = i; break; }
      }
      if (cut < 0) return { body: notice, hadLink: false };
      return { body: lines.slice(0, cut).join('\n').replace(/\s+$/, ''), hadLink: true };
    }, [notice]);

    if (!notice) {
      return (
        <window.ErrorState compact title="The notice text did not load"
          body="idv/terms-text.js defines window.IDV_TERMS and this page did not get it. Nothing is captured until it does." />);
    }
    return (
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'left', background: P.surface,
        border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: `${P.space.x4}px ${P.space.x4}px` }}>
        <div style={{ whiteSpace: 'pre-line', fontSize: P.type.body, lineHeight: 1.6, color: P.ink2 }}>{split.body}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x2, flexWrap: 'wrap', marginTop: P.space.x3 }}>
          <span style={{ fontSize: P.type.meta, color: P.inkMute }}>Full details:</span>
          {window.IdvTerms ? <window.IdvTerms.Link label="Identity Verification Terms" /> :
            <span style={{ fontSize: P.type.meta, color: P.inkMute }}>idv/idv-terms.jsx did not load, so the full terms cannot be opened here.</span>}
        </div>
        {terms && terms.needs_update_notice ? (
          <div style={{ marginTop: P.space.x3, display: 'flex', gap: P.space.x2, alignItems: 'flex-start',
            background: P.warnSoft, border: `1px solid ${P.warn}`, borderRadius: P.r10, padding: `${P.space.x2}px ${P.space.x3}px` }}>
            <window.Icon name="alert" size={14} stroke={2} color={P.warnText} style={{ flex: '0 0 auto', marginTop: 2 }} />
            <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{terms.needs_update_notice}</span>
          </div>) : null}
      </div>);
  }

  // THE UNBUNDLED BOX. Specific, separate, and declining it still continues —
  // plan §3.10. Its words are IDV_TERMS.biometricCheckbox verbatim.
  function BiometricBox({ on, onChange }) {
    const P = useP();
    const T = window.IDV_TERMS;
    const text = (T && T.biometricCheckbox) || null;
    if (!text) return null;
    // NOT A <label>. atoms' Check is a <button role="checkbox">, which is not a
    // labelable element, so a wrapping <label> would look clickable and do
    // nothing when the sentence itself is tapped — on a consent box that is the
    // worst possible place for a dead hit area. The row toggles instead, and
    // Check's own stopPropagation stops the two handlers double-firing.
    return (
      <div data-hw-i role="presentation" onClick={function () { onChange(!on); }}
        style={{ width: '100%', maxWidth: 520, textAlign: 'left', display: 'flex', gap: P.space.x3,
          alignItems: 'flex-start', background: P.surface2, border: `1px solid ${on ? P.accentBorder : P.hairline}`,
          borderRadius: P.r12, padding: `${P.space.x3}px ${P.space.x4}px`, cursor: 'pointer',
          minHeight: P.ctrlH.md }}>
        <span style={{ flex: '0 0 auto', paddingTop: 1 }}>
          <window.Check on={!!on} onChange={onChange} size={22} />
        </span>
        <span style={{ fontSize: P.type.body, lineHeight: 1.6, color: P.ink2 }}>{text}</span>
      </div>);
  }

  // ── a capture step ───────────────────────────────────────────────────────
  // One component per step so the camera is torn down and re-acquired when the
  // facing changes — a single long-lived stream switched between front and rear
  // is where "the tablet opened the wrong camera" comes from.
  //
  // MEDIA KIND MAPPING — the one place it is decided, and why:
  //   document_front  the BEST of a 4-frame tilt burst. The other three go up as
  //                   `challenge_frame`, because the contract's media kinds
  //                   (docs/IDV-API-CONTRACT.md "Media"; enforced by
  //                   wmdemo/idv_api.py's _MEDIA_KINDS) offer no
  //                   `document_front_frame`, and of the two multi-frame kinds
  //                   `selfie_frame` is selfie-specific. So `challenge_frame` is
  //                   the generic extra-frame kind and the tilt burst uses it.
  //                   The engine reads them as the frames that accompany the
  //                   document front of the same session.
  //   document_back   one frame. PDF417 is a read, not an average.
  //   medical_rec     one frame, kind `medical_rec` — a recommendation is a
  //                   page held flat, not a card to be rocked, so no burst
  //                   and no `challenge_frame` extras (contract round-3
  //                   addendum). Offered, not required, to an 18–20-year-old
  //                   on a REC_21 workflow — see the choice frame below.
  //   selfie          3 passive frames as `selfie_frame`, then one `selfie`.
  const BURST_N = 4, BURST_GAP_MS = 300;
  const PASSIVE_N = 3, PASSIVE_GAP_MS = 320;

  function CaptureStep({ step, token, base, accent, copy, shell, sessionRef, onUploaded, onNotice, notice, hint, onHint, pickerPhotos, setPickerPhotos, medicalRecOffered }) {
    const P = useP();
    const facing = step === 'selfie' ? 'user' : 'environment';
    // THE CHOICE COMES BEFORE THE CAMERA. An 18–20-year-old on a REC_21
    // workflow is OFFERED this step, not made to sit through it — so while
    // that choice is still open the camera stays off (`active` below), and no
    // permission prompt fires before the guest has said yes to one.
    const [medChoice, setMedChoice] = React.useState(null); // null | 'add'
    const showMedOffer = step === 'medical_rec' && medicalRecOffered && !medChoice;
    const cam = useCamera(!showMedOffer, facing);
    const [busy, setBusy] = React.useState(false);
    const [progress, setProgress] = React.useState(null);
    const c = STEP_COPY[step] || { big: 'One more photo', say: '' };
    const brandSay = step === 'selfie' ? copy.selfie : copy.document;

    function fail(r) { onNotice((r && r.error) || 'That did not go through. Try again.'); setBusy(false); setProgress(null); }

    function grabOne() {
      const v = cam.videoRef.current;
      if (!v) return Promise.resolve(null);
      const canvas = drawScaled(v, MAX_EDGE);
      if (!canvas) return Promise.resolve(null);
      const metrics = frameMetrics(canvas);
      return canvasToJpeg(canvas, JPEG_Q).then(function (blob) {
        return blob ? { blob: blob, metrics: metrics } : null;
      });
    }
    function grabMany(n, gap, onEach) {
      const out = [];
      let chain = Promise.resolve();
      for (let i = 0; i < n; i++) {
        chain = chain.then(function () {
          return grabOne().then(function (f) {
            if (f) { out.push(f); if (onEach) onEach(out.length, n); }
            return new Promise(function (res) { setTimeout(res, gap); });
          });
        });
      }
      return chain.then(function () { return out; });
    }

    function capture() {
      if (busy) return;
      setBusy(true); onNotice(null);

      if (step === 'document_front') {
        setProgress('Rock the card gently…');
        grabMany(BURST_N, BURST_GAP_MS, function (i, n) { setProgress('Rock the card gently… ' + i + ' of ' + n); })
          .then(function (frames) {
            if (!frames.length) { onNotice('The camera gave us no picture. Try again.'); setBusy(false); setProgress(null); return; }
            const best = bestOfBurst(frames);
            onHint(frameHint(best && best.metrics));
            setProgress('Sending…');
            return capUpload(token, 'document_front', best.blob, { metrics: best.metrics, base: base })
              .then(function (r) {
                if (!r.ok) { fail(r); return; }
                // The remaining frames are advisory extras. A failure to upload
                // one of them must NOT lose the step that already landed.
                const extras = frames.filter(function (f) { return f !== best; });
                let ch = Promise.resolve();
                extras.forEach(function (f, i) {
                  ch = ch.then(function () {
                    return capUpload(token, 'challenge_frame', f.blob,
                      { metrics: f.metrics, base: base, filename: 'document_front_tilt_' + (i + 1) + '.jpg' })
                      .then(function () {}, function () {});
                  });
                });
                return ch.then(function () { setBusy(false); setProgress(null); onUploaded('document_front'); });
              });
          });
        return;
      }

      if (step === 'selfie') {
        setProgress('Hold still…');
        grabMany(PASSIVE_N, PASSIVE_GAP_MS, function (i, n) { setProgress('Hold still… ' + i + ' of ' + n); })
          .then(function (frames) {
            let ch = Promise.resolve();
            frames.forEach(function (f) {
              ch = ch.then(function () {
                return capUpload(token, 'selfie_frame', f.blob, { metrics: f.metrics, base: base }).then(function () {}, function () {});
              });
            });
            return ch.then(function () { return grabOne(); }).then(function (f) {
              if (!f) { onNotice('The camera gave us no picture. Try again.'); setBusy(false); setProgress(null); return; }
              onHint(frameHint(f.metrics));
              setProgress('Sending…');
              return capUpload(token, 'selfie', f.blob, { metrics: f.metrics, base: base }).then(function (r) {
                if (!r.ok) { fail(r); return; }
                setBusy(false); setProgress(null); onUploaded('selfie');
              });
            });
          });
        return;
      }

      // document_back and medical_rec — one frame each. A recommendation is a
      // page held flat, not something a tilt burst reads better, so it takes
      // the same single-frame path as the barcode read.
      grabOne().then(function (f) {
        if (!f) { onNotice('The camera gave us no picture. Try again.'); setBusy(false); return; }
        onHint(frameHint(f.metrics));
        setProgress('Sending…');
        return capUpload(token, step, f.blob, { metrics: f.metrics, base: base }).then(function (r) {
          if (!r.ok) { fail(r); return; }
          setBusy(false); setProgress(null); onUploaded(step);
        });
      });
    }

    // ── the offer (18–20 on a REC_21 workflow, offer_medical_path on) ──────
    // A CHOICE, NOT A DECLINE. "I don't have one" continues the flow exactly
    // as if this step were not there — no local verdict is drawn, and the
    // backend still decides: it may accept the guest at 21+ regardless, or
    // decline `UNDER_AGE` once everything is submitted. This screen only
    // decides whether the guest photographs anything.
    if (showMedOffer) {
      return shell(MED_REC_OFFER.big, sessionRef, (
        <React.Fragment>
          <Plate tone="info" icon="help" />
          <Big>{MED_REC_OFFER.big}</Big>
          <Say>{MED_REC_OFFER.say}</Say>
          {notice ? <Say>{notice}</Say> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: P.space.x2, width: '100%', maxWidth: 340 }}>
            <window.PBtn size="xl" variant="accent" onClick={function () { setMedChoice('add'); }}>Add my recommendation</window.PBtn>
            <window.PBtn size="lg" variant="ghost" onClick={function () { onUploaded(step); }}>I don&rsquo;t have one</window.PBtn>
          </div>
        </React.Fragment>),
        'Offered, not required · a decline here is not a local verdict — the backend decides', null);
    }

    // ── camera refused / missing ─────────────────────────────────────────
    if (cam.status === 'denied' || cam.status === 'failed') {
      return shell(c.big, sessionRef, (
        <React.Fragment>
          <Plate tone="warn" icon="camera" />
          <Big>{cam.status === 'denied' ? 'The camera is blocked' : 'The camera stopped'}</Big>
          <Say>{cam.status === 'denied'
            ? 'This page needs the camera to photograph your ID. Allow the camera in your browser, then tap Try again.'
            : 'The camera closed before we could take the picture. Tap Try again.'}</Say>
          {cam.detail ? <Say mute>{cam.detail}</Say> : null}
          <window.PBtn size="lg" variant="accent" icon="refresh"
            onClick={function () { window.location.reload(); }}>Try again</window.PBtn>
        </React.Fragment>),
        'Camera permission is the guest’s to give — nothing to do at the counter', null);
    }
    if (cam.status === 'unavailable') {
      // THE ONLY FILE-INPUT PATH IN THIS FILE. Reached only when getUserMedia
      // does not exist or there is no camera at all, and the screen says which.
      // It reuses shared/id-photos.jsx's control rather than forking a second
      // picker (CLAUDE.md L60-66: "the one ID/passport photo control — IDV must
      // absorb this, never fork it"), and extends it by doing the one thing that
      // control explicitly does not do: uploading. Admission stays
      // HWIdPhotos.accept()'s decision — same limits, same refusal sentences.
      return (
        <PickerFallback step={step} token={token} base={base} shell={shell} sessionRef={sessionRef}
          copy={copy} onUploaded={onUploaded} onNotice={onNotice} notice={notice}
          detail={cam.detail} photos={pickerPhotos} setPhotos={setPickerPhotos} />);
    }

    const live = cam.status === 'live';
    // A PAGE, NOT A CARD. medical_rec gets its own guide shape (taller than
    // wide — GuideOverlay's 'page' branch) and a taller preview box to match,
    // because a doctor's recommendation is a full sheet held up to the
    // camera, and a landscape card frame over a portrait page would have the
    // guest guessing where the corners belong.
    const guideShape = step === 'selfie' ? 'oval' : step === 'medical_rec' ? 'page' : 'card';
    const boxMaxWidth = step === 'selfie' ? 340 : step === 'medical_rec' ? 400 : 520;
    const boxAspect = step === 'selfie' || step === 'medical_rec' ? '3 / 4' : '3 / 2';
    return shell(c.big, sessionRef, (
      <React.Fragment>
        <div style={{ position: 'relative', width: '100%', maxWidth: boxMaxWidth,
          aspectRatio: boxAspect, background: P.canvas2,
          borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline}` }}>
          <video ref={cam.videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              // The selfie preview is mirrored so the guest sees themselves the
              // way a mirror shows them. The CAPTURED frame is not mirrored:
              // drawScaled reads the video element's pixels, not this transform.
              transform: step === 'selfie' ? 'scaleX(-1)' : 'none',
              opacity: live ? 1 : 0.25 }} />
          <GuideOverlay shape={guideShape} tone={accent} dim={P.imgScrim} />
        </div>
        <Big>{c.big}</Big>
        <Say>{brandSay || c.say}</Say>
        {step === 'document_back' ? <Say mute>US licences and state IDs carry a PDF417 barcode on the back. We need it: without it we would be reading the printed front and guessing.</Say> : null}
        {hint ? <Say mute>{hint}</Say> : null}
        {progress ? <Say mute>{progress}</Say> : null}
        {notice ? <Say>{notice}</Say> : null}
        <window.PBtn size="xl" variant="accent" icon="camera" busy={busy} disabled={!live || busy} onClick={capture}>
          {step === 'selfie' ? 'Take the selfie' : 'Take the photo'}
        </window.PBtn>
        {!live ? <Say mute>Starting the camera…</Say> : null}
      </React.Fragment>),
      (step === 'selfie' ? 'Front camera' : 'Rear camera') + ' · blur and glare hints are advisory — the server decides', null);
  }

  // ── the picker fallback ─────────────────────────────────────────────────
  function PickerFallback({ step, token, base, shell, sessionRef, copy, onUploaded, onNotice, notice, detail, photos, setPhotos }) {
    const P = useP();
    const [busy, setBusy] = React.useState(false);
    const c = STEP_COPY[step] || { big: 'One more photo', say: '' };
    const ready = photos && photos.length ? photos[photos.length - 1] : null;

    function send() {
      if (!ready || busy) return;
      setBusy(true); onNotice(null);
      // The record from HWIdPhotos.makePhoto holds a Blob URL, not the File, so
      // the bytes are read back through it. That keeps the admission decision
      // (accept()) in one place and this file out of the business of re-checking
      // types and sizes.
      fetch(ready.url).then(function (r) { return r.blob(); }).then(function (blob) {
        return capUpload(token, step, blob, { base: base, filename: ready.name || (step + '.jpg') });
      }).then(function (r) {
        setBusy(false);
        if (!r || !r.ok) { onNotice((r && r.error) || 'That photo did not go through. Try another.'); return; }
        setPhotos([]);
        onUploaded(step);
      }).catch(function () { setBusy(false); onNotice('That photo could not be read. Try another.'); });
    }

    return shell(c.big, sessionRef, (
      <React.Fragment>
        <Plate tone="neutral" icon="camera" />
        <Big>{c.big}</Big>
        {/* SAY WHAT HAPPENED. A picker where a camera was expected is a
            different experience and the guest is told why, rather than left to
            wonder why the page is asking for a file. */}
        <Say>This device gave the page no camera, so pick or take a photo with your own camera app instead.</Say>
        {detail ? <Say mute>{detail}</Say> : null}
        <Say mute>{copy.document || c.say}</Say>
        <div style={{ width: '100%', maxWidth: 520, textAlign: 'left' }}>
          {window.IdPhotoCapture ?
            <window.IdPhotoCapture photos={photos} onChange={setPhotos} compact /> :
            <window.ErrorState compact title="The photo control did not load"
              body="shared/id-photos.jsx defines window.IdPhotoCapture and this page did not get it, so there is no way to attach a photo here." />}
        </div>
        {notice ? <Say>{notice}</Say> : null}
        <window.PBtn size="xl" variant="accent" busy={busy} disabled={!ready || busy} onClick={send}>Send this photo</window.PBtn>
      </React.Fragment>),
      'No camera on this device · picker fallback, provenance is unknown', null);
  }

  // ── the challenge ────────────────────────────────────────────────────────
  // POST challenge, run the server's script, record it, upload it with the
  // challenge id. The SCRIPT AND ITS ORDER ARE THE SERVER'S — a page that chose
  // its own turn order or its own colours would make the nonce meaningless,
  // which is the whole point of CHALLENGE_NONCE_MISMATCH.
  const TURN_MS = 1500, BLINK_MS = 1200, FLASH_MS = 250;
  const FALLBACK_FRAMES = 10, FALLBACK_GAP_MS = 250;

  function ChallengeStep({ token, base, accent, shell, setFlash, prompt, setPrompt, onNotice, notice, onDoneStep }) {
    const P = useP();
    const cam = useCamera(true, 'user');
    const [running, setRunning] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const stopRef = React.useRef(false);

    React.useEffect(function () {
      return function () { stopRef.current = true; setFlash(null); setPrompt(null); };
      // eslint-disable-next-line
    }, []);

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function runScript(script) {
      let chain = Promise.resolve();
      (script || []).forEach(function (item) {
        chain = chain.then(function () {
          if (stopRef.current) return null;
          if (item.kind === 'turn') {
            setPrompt({ text: 'Turn your head to the ' + (item.dir || 'left'), arrow: item.dir === 'right' ? 'arrow-right' : 'arrow-left' });
            return wait(item.ms || TURN_MS).then(function () { setPrompt(null); });
          }
          if (item.kind === 'blink') {
            setPrompt({ text: 'Now blink', arrow: null });
            return wait(item.ms || BLINK_MS).then(function () { setPrompt(null); });
          }
          if (item.kind === 'flash') {
            const cols = item.colors && item.colors.length ? item.colors : ['accent'];
            setPrompt({ text: 'Keep looking at the screen', arrow: null });
            let c2 = Promise.resolve();
            cols.forEach(function (name) {
              c2 = c2.then(function () {
                if (stopRef.current) return null;
                setFlash(name);
                return wait(item.ms || FLASH_MS);
              });
            });
            return c2.then(function () { setFlash(null); setPrompt(null); });
          }
          return null;
        });
      });
      return chain;
    }

    function start() {
      if (running || busy) return;
      setBusy(true); onNotice(null);
      capPost(token, 'challenge', {}, base).then(function (r) {
        if (!r.ok || !r.body) {
          setBusy(false);
          onNotice((r && r.error) || 'We could not start that check. Try again.');
          return;
        }
        const ch = r.body;
        setRunning(true);
        const stream = cam.stream;
        const MR = window.MediaRecorder;
        const canRecord = !!(MR && stream && MR.isTypeSupported);
        const mime = canRecord
          ? (MR.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
            : MR.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
              : MR.isTypeSupported('video/webm') ? 'video/webm' : null)
          : null;

        if (mime) {
          let rec = null, chunks = [];
          try { rec = new MR(stream, { mimeType: mime }); }
          catch (e) { rec = null; }
          if (rec) {
            rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
            rec.onstop = function () {
              const blob = new Blob(chunks, { type: mime.split(';')[0] });
              upload(blob, ch.challenge_id, 'liveness_video', 'liveness.webm');
            };
            try { rec.start(200); } catch (e) { rec = null; }
            if (rec) {
              runScript(ch.script).then(function () {
                try { rec.stop(); } catch (e) { upload(null, ch.challenge_id, 'liveness_video', 'liveness.webm'); }
              });
              return;
            }
          }
        }
        // FALLBACK: no MediaRecorder (or it refused every webm profile). Ten
        // frames at 250 ms, uploaded as `challenge_frame` with the same
        // challenge id, so the engine still sees the sequence the nonce named.
        const frames = [];
        const grab = function () {
          const v = cam.videoRef.current;
          if (!v) return Promise.resolve();
          const cv = drawScaled(v, 720);
          if (!cv) return Promise.resolve();
          return canvasToJpeg(cv, 0.8).then(function (b) { if (b) frames.push(b); });
        };
        let chain = runScript(ch.script);
        let ticker = null;
        let n = 0;
        const pump = function () {
          if (n >= FALLBACK_FRAMES || stopRef.current) { clearInterval(ticker); return; }
          n++; grab();
        };
        ticker = setInterval(pump, FALLBACK_GAP_MS);
        pump();
        chain.then(function () {
          clearInterval(ticker);
          let c2 = Promise.resolve();
          frames.forEach(function (b, i) {
            c2 = c2.then(function () {
              return capUpload(token, 'challenge_frame', b,
                { challengeId: ch.challenge_id, base: base, filename: 'challenge_' + (i + 1) + '.jpg' })
                .then(function () {}, function () {});
            });
          });
          return c2.then(function () {
            setRunning(false); setBusy(false);
            onDoneStep();
          });
        });
      });
    }

    function upload(blob, challengeId, kind, filename) {
      if (!blob || !blob.size) {
        setRunning(false); setBusy(false);
        onNotice('The recording came back empty. Tap Start to try that check again.');
        return;
      }
      capUpload(token, kind, blob, { challengeId: challengeId, base: base, filename: filename })
        .then(function (r) {
          setRunning(false); setBusy(false);
          if (!r.ok) { onNotice((r && r.error) || 'That recording did not go through. Try again.'); return; }
          onDoneStep();
        });
    }

    if (cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'failed') {
      // No camera means no challenge. Say so and stop — a challenge is not
      // something a file picker can stand in for.
      return shell('One quick check', null, (
        <React.Fragment>
          <Plate tone="warn" icon="camera" />
          <Big>{cam.status === 'denied' ? 'The camera is blocked' : 'This device has no camera we can use'}</Big>
          <Say>{cam.status === 'denied'
            ? 'Allow the camera in your browser and reload this page. This last check needs live video.'
            : 'This last check needs live video, which this device did not give the page. Bring your physical ID to any Hyperwolf store and the associate can verify you there.'}</Say>
          {cam.detail ? <Say mute>{cam.detail}</Say> : null}
        </React.Fragment>), 'Challenge cannot run without a camera', null);
    }

    const live = cam.status === 'live';
    return shell('One quick check', null, (
      <React.Fragment>
        <div style={{ position: 'relative', width: '100%', maxWidth: 340, aspectRatio: '3 / 4',
          background: P.canvas2, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline}` }}>
          <video ref={cam.videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: 'scaleX(-1)', opacity: live ? 1 : 0.25 }} />
          <GuideOverlay shape="oval" tone={accent} dim={P.imgScrim} />
        </div>
        {prompt ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x3 }}>
            {prompt.arrow ? <window.Icon name={prompt.arrow} size={34} stroke={2} color={P.accentText} /> : null}
            <Big>{prompt.text}</Big>
          </div>) : <Big>{STEP_COPY.challenge.big}</Big>}
        {!prompt ? <Say>{STEP_COPY.challenge.say}</Say> : null}
        {notice ? <Say>{notice}</Say> : null}
        {!running ? (
          <window.PBtn size="xl" variant="accent" busy={busy} disabled={!live || busy} onClick={start}>Start the check</window.PBtn>
        ) : <Say mute>Keep looking at the screen.</Say>}
      </React.Fragment>),
      'Colour sequence and turn order come from the server as a nonce · recorded with the challenge id', null);
  }

  // ── statics ─────────────────────────────────────────────────────────────
  // Hung off the component rather than published as a second global. The seam
  // needs the transport; a QA run needs to prove an upload lands without a
  // camera in the room; bestOfBurst and frameMetrics are pure and worth being
  // able to call directly.
  window.IdvCapture.api = { url: capUrl, get: capGet, post: capPost, upload: capUpload, beacon: capBeacon };
  window.IdvCapture.grab = { drawScaled: drawScaled, toJpeg: canvasToJpeg, MAX_EDGE: MAX_EDGE, JPEG_Q: JPEG_Q };
  window.IdvCapture.metrics = { frame: frameMetrics, hint: frameHint, best: bestOfBurst,
    BLUR_SOFT: BLUR_SOFT, GLARE_HIGH: GLARE_HIGH };
})();
