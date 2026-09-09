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
// ── THE 2026-09-08 REBUILD ────────────────────────────────────────────────
// The owner tested the first build on a Mac and called it "extremely
// frictional, feels buggy": too many taps, glare reported AFTER the shutter,
// a consent wall of legal text. This file is the answer, and the shape of the
// answer is borrowed openly from the products that solved it first:
//
//   Onfido      — the document frame with corner brackets that turns from
//                 neutral to accent when the card is actually inside it, and
//                 auto-capture with a "hold still" settle before the shutter.
//   Veriff      — ONE line of live guidance at a time, before the shutter,
//                 never a score and never two complaints at once.
//   Apple Wallet — the card fills the frame and the page snaps itself; there
//                 is no shutter button to hunt for.
//   Stripe Identity — three screens, not nine. Intro folded into consent.
//   Persona     — a visible settle ring so the guest can see the capture
//                 coming, rather than being surprised by it.
//   Didit       — the hosted page is the whole product; nothing else on it.
//
// SO: THE CAMERA SCREENS HAVE NO BUTTONS. The page watches the frame, says one
// sentence about what to change, colours the guide when the frame is good,
// counts a 400 ms settle on a ring, and takes the photo itself. Every quality
// judgement that used to arrive as a post-hoc apology ("hold a little
// steadier") is now a gate that runs BEFORE the shutter, at 12 Hz, on a
// 208-pixel working canvas that costs about a millisecond a frame.
//
// WHAT RUNS ON THE DEVICE, AND NOTHING LEAVES IT:
//   · the frame analyser below (sharpness / glare / exposure / card fill /
//     motion) — plain canvas arithmetic, no library;
//   · `BarcodeDetector` with format `pdf417` where the browser has it, which
//     turns the back-of-licence step into "snap the instant it decodes";
//   · MediaPipe Face Landmarker, vendored under /vendor/mediapipe and served
//     from our own origin — never a CDN. It gates the selfie (one face, filling
//     40–70 % of the oval, centred, lit, still) and then VERIFIES the liveness
//     prompts instead of merely waiting them out.
// The decoded barcode string, the landmarks and the blendshapes are read and
// discarded in the same tick. The only thing that reaches the server is what
// the contract already carries: the media, and `client_metrics`.
//
// THE CAPTURE CLIENT NEVER SETS A STATUS. It uploads media and asks. Only the
// engine's signed callback and an analyst write `idv_sessions.status`
// (wmdemo/idv_api.py L33-34), which is why `submit` answers `In Progress` and
// this file's only job after that is to poll `GET status` and render whatever
// the server says. Client metrics are ADVISORY in exactly the same way: they
// gate OUR shutter, they do not gate the server's decision.
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
// EXPORTS: window.IdvCapture (the component) plus four statics hung off it —
// `IdvCapture.api` (get/post/upload/beacon), `IdvCapture.grab` (video →
// downscaled EXIF-free JPEG Blob), `IdvCapture.metrics` (the frame analyser,
// its thresholds and the pure gate/hint functions) and `IdvCapture.geometry`
// (the guide rectangle and the object-fit:cover mapping). They are on the
// component rather than in a second global because the seam file and a browser
// QA run both need them without re-deriving the URL shape or the guide box,
// and because a pure function that decides whether a frame may be captured
// must be checkable without a camera in the room.
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
    // behaviour based on the SERVER's reading of it.
    if (o.metrics) fd.append('client_metrics', JSON.stringify(o.metrics));
    fd.append('file', blob, o.filename || (kind + extFor(blob)));
    return fetch(capUrl(token, 'media', o.base), { method: 'POST', cache: 'no-store', credentials: 'omit', body: fd })
      .then(readJson).catch(networkError);
  }
  function extFor(blob) {
    const t = (blob && blob.type) || '';
    if (/webm/.test(t)) return '.webm';
    if (/mp4/.test(t)) return '.mp4';
    return '.jpg';
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

  // ── geometry ─────────────────────────────────────────────────────────────
  // THE GUIDE RECTANGLE IS COMPUTED ONCE AND USED TWICE — by the overlay that
  // draws it and by the analyser that measures inside it. In the first build
  // the overlay owned the box privately, which meant the quality numbers were
  // measured over the WHOLE frame while the guest was being asked to line the
  // card up with a box that had nothing to do with them. A glare spot on the
  // desk two inches outside the guide could refuse a perfect card.
  //
  // `shape`: 'card' = ID-1 (85.6 × 53.98 mm, ratio 1.586); 'page' = a doctor's
  // recommendation, taller than wide; 'oval' = the face oval.
  function guideBox(shape, w, h) {
    if (shape === 'oval') {
      const rx = Math.min(w * 0.32, h * 0.30), ry = rx * 1.32;
      return { oval: true, cx: w / 2, cy: h / 2, rx: rx, ry: ry,
        x: w / 2 - rx, y: h / 2 - ry, w: rx * 2, h: ry * 2 };
    }
    const pad = Math.min(w, h) * 0.09;
    let bw = w - pad * 2;
    let bh = shape === 'page' ? bw * 1.294 : bw / 1.586;
    if (bh > h - pad * 2) { bh = h - pad * 2; bw = shape === 'page' ? bh / 1.294 : bh * 1.586; }
    return { oval: false, x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh,
      cx: w / 2, cy: h / 2, rx: bw / 2, ry: bh / 2 };
  }

  // `object-fit: cover` CROPS. The preview box and the camera frame almost
  // never share an aspect ratio, so a rectangle drawn at box coordinates does
  // NOT sit at the same fraction of the video's own pixels — on a 16:9 stream
  // in a 3:2 box roughly 16 % of the frame's width is off-screen entirely.
  // Measuring the "guide region" without undoing that crop measures a region
  // the guest cannot see. These two functions are the crop and its inverse.
  function boxRectToVideoNorm(rect, boxW, boxH, vw, vh) {
    if (!vw || !vh || !boxW || !boxH) return null;
    const scale = Math.max(boxW / vw, boxH / vh);
    const dw = vw * scale, dh = vh * scale;
    const ox = (dw - boxW) / 2, oy = (dh - boxH) / 2;
    return { x: (rect.x + ox) / dw, y: (rect.y + oy) / dh, w: rect.w / dw, h: rect.h / dh };
  }
  function videoNormToBox(pt, boxW, boxH, vw, vh) {
    if (!vw || !vh || !boxW || !boxH) return null;
    const scale = Math.max(boxW / vw, boxH / vh);
    const dw = vw * scale, dh = vh * scale;
    return { x: pt.x * dw - (dw - boxW) / 2, y: pt.y * dh - (dh - boxH) / 2 };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return clamp(v, 0, 1); }
  function round3(v) { return v == null ? null : Math.round(v * 1000) / 1000; }

  // ── the frame analyser ───────────────────────────────────────────────────
  // Five numbers, all measured INSIDE the guide, all on one 208-pixel working
  // canvas, all before the shutter. Each is named for what it is; none of them
  // is ever shown to a guest as a number.
  //
  //   sharpness       variance of a 3×3 Laplacian over the guide region. HIGH
  //                   is sharp. A relative number, not a percentage.
  //   glare_fraction  fraction of pixels in the guide at or above SATURATED
  //                   luma. A licence under a downlight blows out exactly the
  //                   part the OCR needs, and it does it in a spot the guest
  //                   cannot see on a phone preview.
  //   exposure        mean luma in the guide, 0..1. Both ends matter: a dark
  //                   frame is unreadable and a blown one is worse.
  //   card_fill       "is the document inside the box" — edge DENSITY inside
  //                   the guide (a card carries print; a table does not) plus
  //                   a RECTANGLE FILL check that looks for a straight edge
  //                   running along each of the four guide lines.
  //   spill           the same edge density in a band OUTSIDE the guide,
  //                   relative to inside. High spill is a card too big for the
  //                   frame — which reads to a guest as "move closer" if you
  //                   only measure fill, and that is the wrong advice.
  //   motion          mean absolute luma difference against the previous
  //                   analysed frame, inside the guide. The settle timer.
  //
  // WHY 208 PIXELS: a 3×3 Laplacian over a 1080-line frame costs more than the
  // frame is worth on a phone and answers the same question. 208 × 117 is about
  // 24 000 pixels — under a millisecond, comfortably inside a 80 ms tick.
  const ANALYSIS_EDGE = 208;
  const SATURATED = 246;     // luma at which a pixel is "blown", not "bright"
  const EDGE_T = 14;         // |∇luma| above which a pixel counts as an edge

  function makeAnalyser() {
    const c = document.createElement('canvas');
    let ctx = null;
    try { ctx = c.getContext('2d', { willReadFrequently: true }); }
    catch (e) { ctx = c.getContext('2d'); }
    let prev = null, prevW = 0, prevH = 0;

    function read(video, rectNorm) {
      if (!ctx || !video) return null;
      const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
      if (!vw || !vh || !rectNorm) return null;
      const k = ANALYSIS_EDGE / Math.max(vw, vh);
      const w = Math.max(24, Math.round(vw * k)), h = Math.max(24, Math.round(vh * k));
      c.width = w; c.height = h;
      try { ctx.drawImage(video, 0, 0, w, h); } catch (e) { return null; }
      let px;
      try { px = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; }

      const g = new Float32Array(w * h);
      for (let i = 0, p = 0; i < g.length; i++, p += 4) {
        g[i] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
      }

      const rx0 = clamp(Math.round(rectNorm.x * w), 1, w - 3);
      const ry0 = clamp(Math.round(rectNorm.y * h), 1, h - 3);
      const rx1 = clamp(Math.round((rectNorm.x + rectNorm.w) * w), rx0 + 2, w - 1);
      const ry1 = clamp(Math.round((rectNorm.y + rectNorm.h) * h), ry0 + 2, h - 1);
      const rw = rx1 - rx0, rh = ry1 - ry0;

      let sum = 0, hot = 0, n = 0;
      let lapSum = 0, lapSq = 0, lapN = 0;
      let edgeIn = 0, edgeN = 0;
      let motion = 0, motionN = 0;
      const hasPrev = prev && prevW === w && prevH === h;

      for (let y = ry0; y < ry1; y++) {
        for (let x = rx0; x < rx1; x++) {
          const i = y * w + x;
          const v = g[i];
          sum += v; n++;
          if (v >= SATURATED) hot++;
          if (hasPrev) { motion += Math.abs(v - prev[i]); motionN++; }
          if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
            const lap = (g[i - w] + g[i + w] + g[i - 1] + g[i + 1]) - 4 * v;
            lapSum += lap; lapSq += lap * lap; lapN++;
            const gx = Math.abs(g[i + 1] - g[i - 1]);
            const gy = Math.abs(g[i + w] - g[i - w]);
            if (gx + gy > EDGE_T) edgeIn++;
            edgeN++;
          }
        }
      }

      // THE MARGIN BAND. A ring 14 % of the guide's short side wide, just
      // outside it, clipped to the frame. Edge density here is what tells a
      // card that OVERFLOWS the guide apart from one that is merely small.
      const band = Math.max(3, Math.round(Math.min(rw, rh) * 0.14));
      const mx0 = clamp(rx0 - band, 1, w - 2), my0 = clamp(ry0 - band, 1, h - 2);
      const mx1 = clamp(rx1 + band, mx0 + 1, w - 1), my1 = clamp(ry1 + band, my0 + 1, h - 1);
      let edgeOut = 0, edgeOutN = 0;
      for (let y = my0; y < my1; y++) {
        for (let x = mx0; x < mx1; x++) {
          if (x >= rx0 && x < rx1 && y >= ry0 && y < ry1) { x = rx1 - 1; continue; }
          const i = y * w + x;
          const gx = Math.abs(g[i + 1] - g[i - 1]);
          const gy = Math.abs(g[i + w] - g[i - w]);
          if (gx + gy > EDGE_T) edgeOut++;
          edgeOutN++;
        }
      }

      // THE RECTANGLE FILL CHECK. For each of the four guide lines, look in a
      // thin band just inside it for a STRAIGHT run of edge pixels parallel to
      // that line — the card's own border landing where the bracket is. Scored
      // as the best line found in the band, so a card a few pixels off still
      // scores; scored per side and combined min-weighted, so a card with one
      // edge outside the frame cannot pass on the strength of the other three.
      const t = Math.max(2, Math.round(Math.min(rw, rh) * 0.08));
      function vScore(xa, xb) {   // best vertical line between columns xa..xb
        let best = 0;
        for (let x = xa; x < xb; x++) {
          let hits = 0;
          for (let y = ry0 + 1; y < ry1 - 1; y++) {
            const i = y * w + x;
            if (Math.abs(g[i + 1] - g[i - 1]) > EDGE_T) hits++;
          }
          const s = hits / Math.max(1, rh - 2);
          if (s > best) best = s;
        }
        return best;
      }
      function hScore(ya, yb) {   // best horizontal line between rows ya..yb
        let best = 0;
        for (let y = ya; y < yb; y++) {
          let hits = 0;
          for (let x = rx0 + 1; x < rx1 - 1; x++) {
            const i = y * w + x;
            if (Math.abs(g[i + w] - g[i - w]) > EDGE_T) hits++;
          }
          const s = hits / Math.max(1, rw - 2);
          if (s > best) best = s;
        }
        return best;
      }
      const sides = [
        vScore(Math.max(1, rx0 - 1), Math.min(w - 2, rx0 + t)),
        vScore(Math.max(1, rx1 - t), Math.min(w - 2, rx1 + 1)),
        hScore(Math.max(1, ry0 - 1), Math.min(h - 2, ry0 + t)),
        hScore(Math.max(1, ry1 - t), Math.min(h - 2, ry1 + 1)),
      ];
      let sMin = 1, sSum = 0;
      sides.forEach(function (s) { if (s < sMin) sMin = s; sSum += s; });
      const rectFill = clamp01(0.55 * (sMin / 0.55) + 0.45 * ((sSum / 4) / 0.65));

      const density = edgeN ? edgeIn / edgeN : 0;
      const outDensity = edgeOutN ? edgeOut / edgeOutN : 0;
      const lapMean = lapN ? lapSum / lapN : 0;

      prev = g; prevW = w; prevH = h;

      return {
        sharpness: lapN ? Math.round(((lapSq / lapN) - lapMean * lapMean) * 100) / 100 : null,
        glare_fraction: n ? Math.round((hot / n) * 10000) / 10000 : null,
        exposure: n ? Math.round((sum / n / 255) * 1000) / 1000 : null,
        // WEIGHTED TOWARDS THE BORDERS, NOT AVERAGED WITH THE PRINT. An even
        // 50/50 was measured letting a card 55 % TOO BIG for the guide through:
        // its print filled the region (density 1.0) and carried the score over
        // the line while the border alignment underneath was 0.29 — i.e. while
        // the thing the guide is actually asking for was absent. Print density
        // says "something is there"; border alignment says "and it is THIS
        // rectangle". Only the second one is the gate, so it gets the weight.
        card_fill: Math.round(clamp01(0.35 * clamp01(density / 0.085) + 0.65 * rectFill) * 1000) / 1000,
        rect_fill: Math.round(rectFill * 1000) / 1000,
        edge_density: Math.round(density * 1000) / 1000,
        spill: Math.round(clamp01(outDensity / Math.max(0.02, density)) * 1000) / 1000,
        motion: motionN ? Math.round((motion / motionN) * 100) / 100 : null,
        // Source pixels per analysis pixel. The sharpness threshold is derived
        // from it — see docGate.
        resample: Math.round(((rectNorm.w * vw) / Math.max(1, rw)) * 100) / 100,
      };
    }
    return { read: read, reset: function () { prev = null; prevW = 0; prevH = 0; } };
  }

  // The same two measurements over a whole CANVAS rather than a video's guide
  // region. The tilt burst needs them: those frames are grabbed from an already
  // scaled canvas, they have no guide of their own (the card is moving, that is
  // the point), and uploading four extras with `sharpness: null` on each would
  // be sending the engine four rows that say nothing.
  function canvasMetrics(canvas) {
    const target = 160;
    const k = Math.min(1, target / Math.max(canvas.width, canvas.height));
    const w = Math.max(8, Math.round(canvas.width * k));
    const h = Math.max(8, Math.round(canvas.height * k));
    const small = document.createElement('canvas');
    small.width = w; small.height = h;
    let ctx = null;
    try { ctx = small.getContext('2d', { willReadFrequently: true }); }
    catch (e) { ctx = small.getContext('2d'); }
    if (!ctx) return { sharpness: null, glare_fraction: null, exposure: null };
    ctx.drawImage(canvas, 0, 0, w, h);
    let px;
    try { px = ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return { sharpness: null, glare_fraction: null, exposure: null }; }
    const g = new Float32Array(w * h);
    let hot = 0, sum = 0;
    for (let i = 0, p = 0; i < g.length; i++, p += 4) {
      const luma = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
      g[i] = luma; sum += luma;
      if (luma >= SATURATED) hot++;
    }
    let ls = 0, lq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = (g[i - w] + g[i + w] + g[i - 1] + g[i + 1]) - 4 * g[i];
        ls += lap; lq += lap * lap; n++;
      }
    }
    const mean = n ? ls / n : 0;
    return {
      sharpness: n ? Math.round(((lq / n) - mean * mean) * 100) / 100 : null,
      glare_fraction: Math.round((hot / (w * h)) * 10000) / 10000,
      exposure: Math.round((sum / (w * h) / 255) * 1000) / 1000,
    };
  }

  // ── the gates ────────────────────────────────────────────────────────────
  // PURE. Metrics in, { pass, hint, gates } out — so every threshold in this
  // file is testable from Node with a literal object and no camera. That is the
  // whole reason these are not inlined into the loop.
  //
  // ONE SENTENCE AT A TIME, IN THE ORDER A PERSON CAN ACT ON IT: light first
  // (nothing else is measurable in the dark), then glare (which the guest fixes
  // by moving, not by aiming), then framing, then focus, then stillness. Veriff
  // ships this order and it is the right one: telling somebody to hold steady
  // while the frame is black is advice they cannot use.
  const GATE = {
    SHARP_BASE: 420,         // Laplacian variance on the 208 px canvas — MEASURED, see sharpnessFloor
    GLARE_MAX: 0.01,         // < 1 % of the guide may be blown
    EXPOSURE_MIN: 0.22,
    EXPOSURE_MAX: 0.92,
    CARD_FILL_MIN: 0.55,
    RECT_FILL_MIN: 0.45,     // the guide's own four lines must have edges on them
    DENSITY_LOW: 0.03,       // below this there is nothing in the guide at all
    MOTION_MAX: 3.2,
    STEADY_MS: 400,
    // Face, measured against the OVAL, not the frame.
    FACE_FILL_MIN: 0.40,
    FACE_FILL_MAX: 0.70,
    FACE_OFF_CENTRE_MAX: 0.30,   // fraction of the oval radius
    FACE_MOTION_MAX: 0.020,      // centroid travel per frame, oval radii
  };

  // THE SHARPNESS FLOOR IS DERIVED FROM THE FRAME, AND THE DERIVATION WAS
  // MEASURED RATHER THAN REASONED. `resample` is source pixels per analysis
  // pixel — how hard the frame was squeezed to reach the 208 px working canvas.
  //
  // The first version of this scaled the floor DOWN as the resample ratio rose,
  // on the argument that a heavier downscale averages detail away and lowers
  // the variance. That argument is wrong, and one probe against the same
  // synthetic scene rendered at three resolutions said so:
  //
  //     source        resample   sharp frame   8 px defocus
  //     640 × 360       3.08        5 542          213
  //     1280 × 720      6.16        8 555          222
  //     1920 × 1080     9.24        7 780          220
  //
  // A DEFOCUSED frame reads the same at every resolution (~220) — the blur, not
  // the sampling, sets it. A SHARP frame is about 35 % lower at 640 than at
  // 1280, and flat above that. So the only correction the data supports is a
  // modest one at the LOW-resolution end, in the opposite direction to the
  // original guess. Hence: 1.0 from 1280 up, easing to 0.62 for a 640-line
  // webcam, which is where the sharp reading actually falls off.
  //
  // SHARP_BASE = 420 sits between the two populations with room on both sides:
  // it accepts a 4 px defocus (1 181 — soft but readable) and refuses an 8 px
  // one (222), and it refuses an empty frame outright (30). Deliberately
  // conservative: this gate exists to stop an obviously unreadable photo, not
  // to grade a good one, and the cost of being strict on a screen with no
  // shutter button is a guest who can never take a photo at all.
  //
  // `relax` is the anti-dead-end: a step open for a while without firing
  // loosens focus and stillness rather than trapping a guest in front of a
  // frame that will never pass. It never loosens glare or exposure — those two
  // destroy a read outright, and waiting is better than uploading a blown one.
  function sharpnessFloor(m, relax) {
    const r = (m && m.resample) || 6;
    return GATE.SHARP_BASE * clamp(r / 6.16, 0.62, 1) * (relax == null ? 1 : relax);
  }

  // FOCUS IS CHECKED BEFORE FRAMING, AND THAT ORDER IS A MEASUREMENT TOO. A
  // blurred frame smears edge energy evenly across the whole picture, so the
  // framing numbers stop meaning anything: an 8 px defocus at 640 × 360 read
  // `spill: 1.0` and would have told the guest "fit the whole card in the
  // frame" about a card that was framed perfectly and merely out of focus.
  // Framing advice is only trustworthy once the frame is sharp enough to see
  // an edge, so focus is asked first.
  //
  // `spill` — edge energy outside the guide over edge energy inside — is
  // MEASURED AND REPORTED BUT IS NOT A GATE. It cannot tell a card that
  // overflows the guide apart from a busy tablecloth behind one that does not,
  // and refusing a good photograph because of the table it is lying on is a
  // failure the guest cannot act on. The border-alignment half of `card_fill`
  // answers the same question from a signal that is actually about the card.
  function docGate(m, relax) {
    if (!m) return { pass: false, hint: null, gates: {} };
    const gates = {
      light: m.exposure != null && m.exposure >= GATE.EXPOSURE_MIN && m.exposure <= GATE.EXPOSURE_MAX,
      glare: m.glare_fraction != null && m.glare_fraction < GATE.GLARE_MAX,
      focus: m.sharpness != null && m.sharpness >= sharpnessFloor(m, relax),
      fill: m.card_fill != null && m.card_fill >= GATE.CARD_FILL_MIN
        && (m.rect_fill == null || m.rect_fill >= GATE.RECT_FILL_MIN),
      still: m.motion != null && m.motion <= GATE.MOTION_MAX * (relax == null ? 1 : (2 - relax)),
    };
    let hint = null;
    if (!gates.light) hint = (m.exposure != null && m.exposure > GATE.EXPOSURE_MAX)
      ? 'Too bright — move out of the direct light'
      : 'Too dark — find more light';
    else if (!gates.glare) hint = 'Too much glare — tilt the card away from the light';
    else if (!gates.focus) hint = 'Hold steady';
    // TWO WAYS TO FAIL FRAMING, AND THEY NEED OPPOSITE ADVICE — and THIS is
    // where `spill` earns its keep. Both failures look the same from inside the
    // guide (no straight edge on the guide's own lines), and edge density
    // inside cannot separate them: a card at 55 % of the guide still measured
    // 0.18 there, well clear of any "nothing is in the box" floor. What does
    // separate them is what is happening OUTSIDE: a card too big for the box
    // spills its print into the margin (0.77 measured; 0.46 when it hangs off
    // one side), a card too small leaves the margin empty (0.00).
    // As a hint disambiguator a wrong answer costs a confusing sentence for one
    // 200 ms beat, which is why spill is trusted here and nowhere else.
    else if (!gates.fill) hint = (m.spill != null && m.spill > 0.35)
      ? 'Fit the whole card in the frame'
      : 'Move closer';
    else if (!gates.still) hint = 'Hold steady';
    return { pass: gates.light && gates.glare && gates.focus && gates.fill && gates.still,
      hint: hint, gates: gates };
  }

  function faceGate(m, relax) {
    if (!m) return { pass: false, hint: null, gates: {} };
    const gates = {
      light: m.exposure != null && m.exposure >= GATE.EXPOSURE_MIN && m.exposure <= GATE.EXPOSURE_MAX,
      glare: m.glare_fraction == null || m.glare_fraction < GATE.GLARE_MAX * 4,
      one: m.faces === 1,
      fill: m.face_fill != null && m.face_fill >= GATE.FACE_FILL_MIN && m.face_fill <= GATE.FACE_FILL_MAX,
      centre: m.face_offset != null && m.face_offset <= GATE.FACE_OFF_CENTRE_MAX,
      focus: m.sharpness != null && m.sharpness >= sharpnessFloor(m, relax),
      still: m.face_motion != null && m.face_motion <= GATE.FACE_MOTION_MAX * (relax == null ? 1 : (2 - relax)),
    };
    let hint = null;
    if (m.faces === 0) hint = 'Bring your face into the oval';
    else if (m.faces > 1) hint = 'Only one face in the oval, please';
    else if (!gates.light) hint = (m.exposure != null && m.exposure > GATE.EXPOSURE_MAX)
      ? 'Too bright — move out of the direct light'
      : 'Too dark — find more light';
    else if (m.face_fill != null && m.face_fill < GATE.FACE_FILL_MIN) hint = 'Come a little closer';
    else if (m.face_fill != null && m.face_fill > GATE.FACE_FILL_MAX) hint = 'Move back a little';
    else if (!gates.centre) hint = 'Centre your face';
    else if (!gates.focus || !gates.still) hint = 'Hold steady';
    return { pass: gates.light && gates.glare && gates.one && gates.fill && gates.centre && gates.focus && gates.still,
      hint: hint, gates: gates };
  }

  // BOTH VOCABULARIES ON EVERY UPLOAD, DELIBERATELY. The contract's
  // `client_metrics` names are `{blur, glare, face_box}`
  // (docs/IDV-API-CONTRACT.md, "Capture API"); this rebuild measures six more
  // things and names each for what it actually is. Sending only the new names
  // would silently blind whatever already reads the old three, and renaming a
  // field in a contract that other people implement against is not a screen
  // file's call. So the old three are kept as aliases of the same numbers and
  // the new six sit beside them. Additive, never a rename.
  //
  // `detector` is the honest label for WHICH thing decided the shutter could
  // fire: 'barcode' when a PDF417 decoded, 'mediapipe' when the vendored face
  // model gated the frame, 'heuristic' when neither was available and only the
  // canvas arithmetic in this file did.
  function clientMetrics(m, fallbackDetector, extra) {
    const s = m || {};
    return Object.assign({
      blur: s.sharpness == null ? null : s.sharpness,
      glare: s.glare_fraction == null ? null : s.glare_fraction,
      face_box: s.face_box || null,
      sharpness: s.sharpness == null ? null : s.sharpness,
      glare_fraction: s.glare_fraction == null ? null : s.glare_fraction,
      exposure: s.exposure == null ? null : s.exposure,
      steady_ms: s.steady_ms == null ? null : s.steady_ms,
      card_fill: s.card_fill == null ? null : s.card_fill,
      face_fill: s.face_fill == null ? null : s.face_fill,
      detector: s.detector || fallbackDetector || 'heuristic',
      // TRUE ONLY WHEN THE GUEST PRESSED THE ESCAPE HATCH. `detector` says
      // which measurement was AVAILABLE; this says whether it was allowed to
      // decide. Without it a frame taken by hand after the gates gave up is
      // indistinguishable from one they passed — and those are the frames most
      // worth telling apart when a decline is being explained.
      manual: !!s.manual,
    }, extra || {});
  }

  // ── the barcode reader ───────────────────────────────────────────────────
  // The back of a US licence IS a PDF417. When the browser can decode one, the
  // whole quality question collapses: a barcode that decodes is a frame good
  // enough to read, and nothing else needs to be true. Apple Wallet's ID scan
  // behaves exactly this way, and it is why that flow feels instant.
  //
  // FEATURE-DETECTED PROPERLY, because half the browsers that define
  // `BarcodeDetector` do not support pdf417 (Chrome ships the Shape Detection
  // API on Android and ChromeOS; desktop Safari and Firefox have neither), and
  // `new BarcodeDetector({formats:['pdf417']})` on such a browser throws
  // asynchronously rather than returning null.
  //
  // THE DECODED STRING NEVER LEAVES THIS FUNCTION. It carries the guest's name,
  // address and date of birth; the server reads it from the image itself under
  // the purpose limits in the Terms. All this page keeps is "it decoded".
  function makeBarcodeReader() {
    const BD = window.BarcodeDetector;
    if (!BD || typeof BD.getSupportedFormats !== 'function') return null;
    let det = null, dead = false;
    const ready = BD.getSupportedFormats().then(function (formats) {
      if (!formats || formats.indexOf('pdf417') < 0) { dead = true; return false; }
      try { det = new BD({ formats: ['pdf417'] }); } catch (e) { dead = true; return false; }
      return true;
    }, function () { dead = true; return false; });
    return {
      ready: ready,
      available: function () { return !dead && !!det; },
      // Resolves true when a PDF417 decoded in this frame. Never rejects.
      scan: function (video) {
        if (dead || !det || !video || !video.videoWidth) return Promise.resolve(false);
        return det.detect(video).then(function (codes) {
          return !!(codes && codes.length && codes[0] && codes[0].rawValue);
        }, function () { return false; });
      },
    };
  }

  // ── the face landmarker ──────────────────────────────────────────────────
  // MediaPipe Tasks Vision, vendored under /vendor/mediapipe and loaded FROM
  // OUR OWN ORIGIN. The import itself lives in vendor/mediapipe/hw-face.js
  // because this file is Babel-transformed with preset-env, which would rewrite
  // a dynamic import() into a require() — see that file's header.
  //
  // STARTED EARLY, ON PURPOSE. The wasm runtime and the float16 model are about
  // 13 MB together, and the moment a guest needs them is the worst moment to
  // start fetching them. So the load is kicked off the instant the consent
  // screen is on screen, and it downloads while the guest reads the consent
  // line and photographs two sides of a card — by the selfie it is warm.
  //
  // AND IT IS NEVER A DEAD END. If it fails (locked-down browser, no wasm, a
  // network that gave up on 13 MB), the selfie falls back to the sharpness and
  // stillness gates with `detector:'heuristic'` and the manual escape hatch
  // appears sooner. A capture flow that cannot take a selfie because a model
  // did not download is worse than one that takes a slightly worse selfie.
  let faceLoadStarted = false;
  function startFaceLoad() {
    if (faceLoadStarted) return;
    faceLoadStarted = true;
    if (window.HWFaceMP) return;
    try {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = new URL('vendor/mediapipe/hw-face.js', document.baseURI).href;
      s.onerror = function () {
        window.HWFaceMP = { status: 'failed', landmarker: null, error: 'vendor/mediapipe/hw-face.js did not load' };
        try { window.dispatchEvent(new Event('hw-face-mp')); } catch (e) {}
      };
      document.head.appendChild(s);
    } catch (e) {
      window.HWFaceMP = { status: 'failed', landmarker: null, error: String(e && e.message) };
    }
  }
  function faceState() {
    const M = window.HWFaceMP;
    if (!M) return faceLoadStarted ? 'loading' : 'idle';
    return M.status || 'loading';
  }
  function faceLandmarker() {
    const M = window.HWFaceMP;
    return (M && M.landmarker) || null;
  }
  // MediaPipe's VIDEO mode requires strictly increasing timestamps across the
  // whole life of the landmarker instance, and the instance outlives any one
  // component (it is cached on window so a retry does not re-download 13 MB).
  // A per-component clock would go backwards on the second mount and MediaPipe
  // answers that by throwing, not by ignoring it.
  let faceClock = 0;
  function faceTick() { faceClock = Math.max(faceClock + 1, Math.round(performance.now())); return faceClock; }

  // Landmarks → the numbers the gate actually needs, all in oval-relative
  // units so the thresholds mean the same thing on every screen size.
  function faceMetricsFrom(result, boxW, boxH, vw, vh, oval) {
    const faces = (result && result.faceLandmarks) || [];
    if (!faces.length) return { faces: 0, face_fill: null, face_offset: null, face_box: null };
    let best = null, bestArea = -1;
    faces.forEach(function (pts) {
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      }
      const area = (x1 - x0) * (y1 - y0);
      if (area > bestArea) { bestArea = area; best = { x0: x0, y0: y0, x1: x1, y1: y1 }; }
    });
    const tl = videoNormToBox({ x: best.x0, y: best.y0 }, boxW, boxH, vw, vh);
    const br = videoNormToBox({ x: best.x1, y: best.y1 }, boxW, boxH, vw, vh);
    if (!tl || !br) return { faces: faces.length, face_fill: null, face_offset: null, face_box: null };
    const fh = br.y - tl.y, fw = br.x - tl.x;
    const cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2;
    const dx = (cx - oval.cx) / Math.max(1, oval.rx);
    const dy = (cy - oval.cy) / Math.max(1, oval.ry);
    return {
      faces: faces.length,
      face_fill: round3(fh / Math.max(1, oval.h)),
      face_offset: round3(Math.sqrt(dx * dx + dy * dy)),
      // Contract's existing advisory field, in video-normalised coordinates so
      // it means something to a server that never saw our preview box.
      face_box: [round3(best.x0), round3(best.y0), round3(best.x1 - best.x0), round3(best.y1 - best.y0)],
      _centre: { x: cx / Math.max(1, oval.rx), y: cy / Math.max(1, oval.ry) },
      _w: fw, _h: fh,
    };
  }
  // Blendshape lookup. Names are MediaPipe's own ('eyeBlinkLeft'); a missing
  // category is null, never 0, because "we could not tell" and "the eye is
  // wide open" are different answers and only one of them should pass a blink.
  function blend(result, name) {
    const bs = (result && result.faceBlendshapes) || [];
    if (!bs.length || !bs[0] || !bs[0].categories) return null;
    const cats = bs[0].categories;
    for (let i = 0; i < cats.length; i++) {
      if (cats[i].categoryName === name) return cats[i].score;
    }
    return null;
  }
  // Head yaw, from the ratio of the distances from the nose tip to each cheek.
  // Landmark 1 is the nose tip, 234 and 454 the outer cheek edges — a stable
  // triple that does not need the transformation matrix (which costs another
  // output tensor per frame). Negative is the guest's left in VIDEO space.
  function faceYaw(result) {
    const pts = result && result.faceLandmarks && result.faceLandmarks[0];
    if (!pts || pts.length < 455) return null;
    const nose = pts[1], l = pts[234], r = pts[454];
    if (!nose || !l || !r) return null;
    const dl = Math.abs(nose.x - l.x), dr = Math.abs(r.x - nose.x);
    const t = dl + dr;
    if (t < 0.02) return null;
    return round3((dr - dl) / t);
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
  // comes from here.
  //
  // SHORTER THAN THE FIRST BUILD, DELIBERATELY. Every one of these sentences is
  // read while a camera is live and a guide is asking to be filled; the two
  // paragraphs that used to explain PDF417 to a customer were read by nobody
  // and pushed the viewfinder off a phone screen. What the guest needs at this
  // moment is where to point the camera. The live hint says the rest.
  const STEP_COPY = {
    consent: { big: "Let's check your ID", say: 'Two photos of your ID and a quick look at the camera — about half a minute.' },
    document_front: { big: 'Front of your ID', say: 'Lay it flat inside the frame.' },
    document_back: { big: 'Now the back', say: 'Point the barcode at the frame.' },
    medical_rec: { big: "Doctor's recommendation", say: 'Lay the whole page flat inside the frame.' },
    selfie: { big: 'Look at the camera', say: 'Put your face in the oval.' },
    challenge: { big: 'One quick check', say: 'Follow the prompts.' },
  };

  // THE OFFERED (optional) ENTRY COPY — an 18–20-year-old on a REC_21 workflow
  // with offer_medical_path on (contract round-3 addendum; plan §5.5). Shown
  // ONLY while `state.steps[]`'s medical_rec entry is both `optional:true` and
  // still `todo` — a guided retry of an attempt already made skips straight to
  // the capture screen, because the guest already decided.
  const MED_REC_OFFER = {
    big: 'Under 21?',
    say: "Recreational purchases need you to be 21. If you have a doctor's recommendation, add it now.",
  };

  // ── the consent words ────────────────────────────────────────────────────
  // THE OWNER'S RULING, AND WHERE IT DIVERGES FROM THE LEGAL DRAFT.
  //
  // `IDV_TERMS.biometricCheckbox` (idv/terms-text.js, transcribed verbatim from
  // docs/IDV-TERMS-CLAUSE-DRAFT-2026-09-08.md) says the template is kept "for
  // up to 36 months or until I close my account". The owner ruled on
  // 2026-09-08 that the guest-facing line says **until you close your account
  // or withdraw** — no month figure. The two disagree, and a disagreement about
  // a retention period is not something a screen file may settle quietly.
  //
  // SO: terms-text.js IS NOT EDITED. It stays the verbatim transcript of the
  // draft for counsel, and the full Terms sheet still shows the draft's own
  // words including the 36-month figure. What changed is only which sentence
  // this screen puts in front of a guest, and it is written here rather than
  // read from IDV_TERMS precisely so that the divergence is visible in a diff
  // instead of hidden behind a lookup. When counsel settles the number, one of
  // these two strings changes and the other is deleted.
  const BIOMETRIC_SHORT = 'Keep my face on file for faster check-in next time (optional)';
  const BIOMETRIC_LONG = 'If you tick this, we make a face template from your selfie — a set of '
    + 'measurements, not a picture — and keep it until you close your account or withdraw. '
    + 'It lets you skip the ID photos next time. You can withdraw whenever you like and we '
    + 'delete the template within 24 hours. Leaving it unticked changes nothing about today.';

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
  //                 only state that earns the file-input fallback, and the
  //                 screen says that is what happened.
  //   failed      — a camera exists and said yes, then broke.
  //
  // 1920×1080 IDEAL ON BOTH FACINGS. The first build asked the front camera for
  // 1280×720, which is below what a modern face-match wants and is a
  // constraint we were imposing for no reason — `ideal` costs nothing on a
  // device that cannot honour it.
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
      const want = { facingMode: { ideal: facing === 'environment' ? 'environment' : 'user' },
        width: { ideal: 1920 }, height: { ideal: 1080 } };
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
  // Drawn on a <canvas> from tokens, per plan §5.5. `shape:'card'` is the four
  // corner brackets of the Concept D document frame; `'page'` is the same,
  // portrait; `'oval'` is the face oval. Nothing here is a colour literal.
  //
  // TWO THINGS ARE NEW AND BOTH ARE THE POINT OF THE REBUILD:
  //   · `ready` swaps the stroke from neutral to the brand accent the moment
  //     every gate passes. Onfido's frame does this and it is the single
  //     clearest signal in a capture UI — the guest stops reading and starts
  //     holding still.
  //   · `progress` draws the settle ring around the guide's own perimeter, so
  //     the shutter is visibly coming rather than a surprise. Persona's ring,
  //     drawn on the shape the guest is already looking at.
  //
  // NEUTRAL IS `railInk`, NOT `inkFaint`. This canvas sits on top of live
  // video: the ink ramp is near-black in light mode and would be invisible on
  // a dark frame. `railInk` is the estate's "ink on a dark surface" token and
  // is light in BOTH modes, which is what an overlay on video needs.
  function GuideOverlay({ shape, tone, ready, dim, progress }) {
    const P = useP();
    const ref = React.useRef(null);
    const wrapRef = React.useRef(null);
    const colour = ready ? (tone || P.accent) : P.railInk;
    const ring = ready ? P.good : (tone || P.accent);

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
      const box = guideBox(shape, w, h);
      const p = clamp01(progress || 0);

      if (box.oval) {
        if (dim) {
          ctx.fillStyle = dim;
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, 0, Math.PI * 2);
          ctx.fill('evenodd');
        }
        ctx.strokeStyle = colour;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (p > 0) {
          // Ramanujan's ellipse perimeter — exact enough that the ring closes
          // on the same pixel it started, which a 2πr approximation does not.
          const a = box.rx, b = box.ry;
          const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
          ctx.strokeStyle = ring;
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.setLineDash([per * p, per]);
          ctx.beginPath();
          ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, -Math.PI / 2, Math.PI * 1.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        return;
      }

      if (dim) {
        ctx.fillStyle = dim;
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.fill('evenodd');
      }
      const arm = Math.min(box.w, box.h) * 0.22;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      const corners = [[box.x, box.y, 1, 1], [box.x + box.w, box.y, -1, 1],
        [box.x, box.y + box.h, 1, -1], [box.x + box.w, box.y + box.h, -1, -1]];
      corners.forEach(function (c) {
        ctx.beginPath();
        ctx.moveTo(c[0] + arm * c[2], c[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(c[0], c[1] + arm * c[3]);
        ctx.stroke();
      });
      if (p > 0) {
        const per = 2 * (box.w + box.h);
        ctx.strokeStyle = ring;
        ctx.lineWidth = 5;
        ctx.setLineDash([per * p, per]);
        ctx.beginPath();
        ctx.moveTo(box.x, box.y);
        ctx.lineTo(box.x + box.w, box.y);
        ctx.lineTo(box.x + box.w, box.y + box.h);
        ctx.lineTo(box.x, box.y + box.h);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }, [shape, colour, ring, dim, progress]);

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

  // ── the shutter ──────────────────────────────────────────────────────────
  // A 160 ms wash and then a checkmark, over the preview only. It exists for
  // one reason: an auto-capture with no visible shutter reads as a bug. The
  // guest must SEE the photo being taken or they will keep holding the card up
  // wondering whether anything happened — which is precisely the "feels buggy"
  // the owner reported.
  //
  // THE WASH IS `railBright`, WHICH IS THE ESTATE'S ONLY NEAR-WHITE TOKEN —
  // pure white in light mode, warm off-white in dark. A shutter flash has to be
  // brighter than the frame it covers in BOTH themes, and `surface` is
  // near-black in dark mode, so it is the only honest choice on the palette.
  // Zero colour literals, and no new token invented for one animation.
  function Shutter({ on, done }) {
    const P = useP();
    if (!on && !done) return null;
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        background: on ? P.railBright : 'transparent',
        opacity: on ? 0.9 : 1, transition: 'background .16s ease, opacity .16s ease' }}>
        {done ? (
          <span style={{ width: 66, height: 66, borderRadius: P.r999, background: P.good,
            display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade .18s ease' }}>
            <window.Icon name="check" size={34} stroke={3} color={P.railBright} />
          </span>) : null}
      </div>);
  }

  // ── the live hint ────────────────────────────────────────────────────────
  // ONE LINE, OVER THE VIEWFINDER, NOT UNDER IT. Veriff's placement, and the
  // reason for it is eye-line: a guest lining a card up is looking at the
  // preview, and a sentence 200 pixels below it is a sentence nobody reads.
  // `imgScrim` is the token that exists for exactly this — legible ink over
  // unknown pixels.
  function HintChip({ text, tone }) {
    const P = useP();
    if (!text) return null;
    return (
      <div aria-live="polite" style={{ position: 'absolute', left: 0, right: 0, bottom: P.space.x4,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: `0 ${P.space.x3}px` }}>
        <span style={{ maxWidth: '94%', textAlign: 'center', background: P.imgScrim, color: P.railBright,
          borderRadius: P.r20, padding: `${P.space.x2}px ${P.space.x4}px`, fontSize: P.type.h2,
          fontWeight: P.weight.emph, lineHeight: 1.3,
          border: tone ? `2px solid ${tone}` : 'none' }}>{text}</span>
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
    return <p style={{ margin: 0, maxWidth: 460, textAlign: 'center', fontSize: P.type.title,
      lineHeight: 1.55, color: mute ? P.inkMute : P.ink2 }}>{children}</p>;
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

    // 'consent' | 'capture' | 'face' | 'processing' | 'outcome'
    const [phase, setPhase] = React.useState('consent');
    const [cursor, setCursor] = React.useState('consent');
    const [done, setDone] = React.useState({});        // step id -> true, this page session
    const [poll, setPoll] = React.useState(null);      // last GET status body
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState(null);  // one plain sentence, guest-facing
    const [terms, setTerms] = React.useState(false);
    const [biometric, setBiometric] = React.useState(false);
    const [flash, setFlash] = React.useState(null);
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
    // 18–20-year-old on a REC_21 workflow with `offer_medical_path` on.
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
    const nextOutstanding = React.useCallback(function (after, extraDone) {
      const serverDone = {};
      ((state && state.steps) || []).forEach(function (s) { if (s.state === 'done') serverDone[s.id] = true; });
      const consents = (state && state.consents) || [];
      if (consents.some(function (c) { return c.kind === 'terms'; })) serverDone.consent = true;
      const all = stepIds;
      const from = after == null ? 0 : all.indexOf(after) + 1;
      for (let i = Math.max(0, from); i < all.length; i++) {
        const id = all[i];
        if (!serverDone[id] && !done[id] && !(extraDone && extraDone[id])) return id;
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

    // THE 13 MB HEAD START. The face model download begins the moment the flow
    // is on screen and a selfie is in the step list, so it overlaps the consent
    // read and both document photos instead of stalling the selfie screen.
    React.useEffect(function () {
      if (!state) return;
      const wantsFace = stepIds.indexOf('selfie') >= 0 || stepIds.indexOf('challenge') >= 0;
      if (wantsFace) startFaceLoad();
    }, [state, stepIds]);

    // Position the cursor the first time real state arrives, and whenever the
    // server tells us the session is already finished.
    React.useEffect(function () {
      if (!state) return;
      if (isTerminal(state.status)) { setPhase('outcome'); return; }
      // AWAITING USER ON A FRESH LOAD IS NOT "GO STRAIGHT BACK TO THE CAMERA".
      // The guest is owed the one sentence the engine wrote before they retake
      // anything — that is the whole point of `guidance.fix`. So the page
      // routes through 'processing', whose poller reads `GET status` once and
      // lands on the retry frame. Measured: without this, reloading a session
      // the engine had answered `Awaiting User` dropped the guest into the
      // document camera with no explanation of why they were there.
      if (state.status === 'Awaiting User' && !poll) { setPhase('processing'); return; }
      if (submittedRef.current) return;
      const consents = state.consents || [];
      const hasTerms = consents.some(function (c) { return c.kind === 'terms'; });
      // A RESUBMISSION RE-OPENS ONLY WHAT THE SERVER ASKED FOR.
      const retry = ((state.steps || []).filter(function (s) { return s.state === 'retry'; })[0] || {}).id;
      const first = retry || (hasTerms ? (nextOutstanding(null) || 'document_front') : 'consent');
      setCursor(first);
      setPhase(phaseFor(first));
      // eslint-disable-next-line
    }, [state && state.status, state && (state.consents || []).length, state && (state.steps || []).length]);

    // selfie and challenge are ONE SCREEN and one camera session — see FaceStep.
    function phaseFor(step) {
      if (step === 'consent') return 'consent';
      if (step === 'selfie' || step === 'challenge') return 'face';
      return 'capture';
    }

    // ── walk-off beacon ───────────────────────────────────────────────────
    // Plan §5.5: "Abandon: visibilitychange/pagehide beacon". Both events are
    // watched, and neither fires on a terminal status. They do NOT carry the
    // same weight, and the difference is the result of a measurement:
    //
    // BOTH FIRE ONLY BEFORE ANYTHING HAS BEEN CAPTURED:
    //   1. Loading this page in an automated browser whose pane is backgrounded
    //      fired `visibilitychange` → hidden and abandoned a live `Not Started`
    //      session with the guest still sitting on it.
    //   2. A plain `location.reload()` fires `pagehide`. On a session the engine
    //      had already answered `Awaiting User`, with 19 media rows and a real
    //      decision on it, that beacon wrote `Awaiting User → Abandoned` and
    //      destroyed the answer.
    //
    // AND THE SERVER CANNOT UNDO IT. `POST abandon` guards only Approved,
    // Declined, In Review and Kyc Expired (wmdemo/idv_api.py), so it happily
    // overwrites `Awaiting User` — a status only the ENGINE may write — and
    // `_capture_media` lifts a session to `In Progress` from Not Started,
    // Awaiting User and Resubmitted but never from Abandoned. So an abandon sent
    // in error is unrecoverable in both directions.
    //
    // Nothing is lost by the narrowing: the drop-off abandonment exists to
    // measure is "created a session and never took a photo", and that is exactly
    // the pre-capture case that still fires. Two backend changes would let this
    // widen back out and both are recorded as gaps rather than made here:
    // `POST abandon` must refuse a session the engine has already answered, and
    // `_capture_media` must lift `Abandoned` back to `In Progress`.
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
      if (!terms) return;
      setBusy(true); setNotice(null);
      const t = (state && state.terms) || {};
      const body = { kind: 'terms', accepted: true,
        terms_version: t.version || (window.IDV_TERMS && window.IDV_TERMS.version) || null,
        terms_url: t.url || null };
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
          setPhase(phaseFor(nxt));
        };
        if (!biometric) { after(); return; }
        capPost(token, 'consent', Object.assign({}, body, { kind: 'biometric_retention' }), base)
          .then(function () { after(); });
      });
    }

    // ── advancing ─────────────────────────────────────────────────────────
    // Takes a LIST because the face screen finishes two steps (selfie and the
    // challenge) in one mount, and calling a one-step advance twice in a row
    // reads a stale `done` on the second call and re-opens the step that just
    // finished. That was a real bug shape in the first build's challenge path.
    function advance(steps) {
      const list = [].concat(steps);
      setStarted(true);
      const mark = {};
      list.forEach(function (s) { mark[s] = true; });
      const nxt = nextOutstanding(list[list.length - 1], mark);
      setDone(function (d) { return Object.assign({}, d, mark); });
      if (!nxt) { submitNow(); return; }
      setCursor(nxt);
      setPhase(phaseFor(nxt));
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
    // THE MANUAL PATH IS A WORKFLOW FLAG, NOT A CODE PATH (escalation §11.3),
    // read through `GET state` as `manual_fallback_when_engine_down`.
    const manualAllowed = !!(state && state.workflow && state.workflow.manual_fallback_when_engine_down);

    // THE FIX SENTENCE FOLLOWS THE GUEST INTO THE CAMERA. This is the owner's
    // "the retry path re-opens only the weak step with the fix sentence shown
    // INSIDE the camera view": `guidance.fix` is held in a ref across the phase
    // change and rendered as the standing line above the live hint, so a guest
    // who is re-photographing their licence can still see WHY while they do it.
    const fixRef = React.useRef(null);
    const retryStep = (guidance && guidance.step) || (retryInfo && retryInfo.step) || 'selfie';

    const tryAgain = React.useCallback(function () {
      // ONLY the step the server named re-opens. Everything already accepted
      // stays accepted — that is the whole point of `guidance.step`.
      const step = (guidance && guidance.step) || (retryInfo && retryInfo.step) || 'selfie';
      fixRef.current = (guidance && guidance.fix) || (poll && poll.message) || null;
      setPoll(null);
      setNotice(null);
      submittedRef.current = false;
      reportedRef.current = false;
      setDone({});
      setCursor(step);
      setPhase(phaseFor(step));
      loadState();
      // eslint-disable-next-line
    }, [guidance, retryInfo, poll, loadState]);

    // AUTO-REOPEN AFTER 1.2 s. The owner's rule is "one tap Try again max — or
    // auto-reopen after 1.2 s", and auto is the better half of that or: the
    // retry screen exists to deliver ONE sentence, the sentence is repeated
    // inside the camera the guest lands in, and a tap to acknowledge advice you
    // are about to be given again is a tap for nothing.
    //
    // GUARDED BY ATTEMPT, not by a boolean: a second `Awaiting User` for a
    // second attempt must re-arm, and only a re-render of the SAME attempt must
    // not. Without that this reopens in a loop.
    const autoRetryRef = React.useRef(null);
    React.useEffect(function () {
      if (phase !== 'outcome' || status !== 'Awaiting User') return undefined;
      const key = String((retryInfo && retryInfo.attempt) || (guidance && guidance.attempt) || 1)
        + ':' + String(retryStep);
      if (autoRetryRef.current === key) return undefined;
      autoRetryRef.current = key;
      const t = setTimeout(function () { if (aliveRef.current) tryAgain(); }, 1200);
      return function () { clearTimeout(t); };
      // eslint-disable-next-line
    }, [phase, status, retryStep, retryInfo, guidance]);

    // ── the pos-mode override ─────────────────────────────────────────────
    // This is the ONE console route this file touches, and the reason HWIdv is
    // read at all: `PATCH /api/idv/sessions/{id}/update-status` with
    // { new_status:'Approved', override:true, reason } needs the `X-HW-Actor`
    // header, and the backend only grants a POS override when the actor's store
    // matches the session's (wmdemo/idv_api.py L971-973).
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
      height: '100%', background: P.bg, borderRadius: pos ? P.r12 : 0,
      border: pos ? `1px solid ${P.hairline}` : 'none', overflow: 'hidden' };

    // `flush` is the camera variant: the viewfinder wants the screen, not a
    // 24-pixel gutter and a centred column, and the copy under it wants to be
    // one line rather than three.
    // `flush` is the camera variant: the viewfinder wants the screen, not a
    // 24-pixel gutter, and the copy under it wants to be one line, not three.
    //
    // THE INNER `margin:'auto'` IS LOAD-BEARING and it is the same trick
    // pos/atoms.jsx's overlayScrim documents at length: a scrolling flex column
    // with `justifyContent:'center'` STRANDS content above the scroll origin
    // the moment it overflows — the top of a tall consent screen becomes
    // unreachable on a short phone. `align-items` on the scroller plus
    // `margin:auto` on the one child centres it when it fits and scrolls
    // normally when it does not.
    function shell(title, right, body, footLine, footActions, opts) {
      const flush = !!(opts && opts.flush);
      return (
        <div style={shellStyle} data-hw="idv-capture" data-hw-mode={mode}>
          <TopBar brand={brandName} title={title} right={right} />
          {phase !== 'outcome' && !loadErr ? <Pips steps={stepIds} current={cursor} /> : null}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ margin: 'auto', width: '100%', maxWidth: 640, display: 'flex',
              flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              gap: flush ? P.space.x3 : P.space.x4,
              padding: flush ? `${P.space.x3}px ${P.space.x3}px` : `${P.space.x6}px ${P.space.x5}px` }}>
              {body}
            </div>
          </div>
          {/* THE TERMS ARE REACHABLE FROM EVERY STATE, not only from the consent
              screen. A page that photographs a government ID and records a
              biometric consent must let the reader open what they agreed to at
              any point, including from the paused screen and from a decline —
              states the consent card is not on screen for. Terms §5.2 requires
              the link on the capture screen itself, which a consent-only link
              would not satisfy. */}
          {phase !== 'consent' && window.IdvTerms ? (
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: P.space.x2, padding: `${P.space.x1}px ${P.space.x4}px ${P.space.x2}px`, borderTop: `1px solid ${P.hairline}` }}>
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
      return shell(brandName, null, (
        <window.ErrorState title="This link is not valid"
          body="It may have already been used or timed out. Ask for a new one — nothing you did was lost."
          detail={loadErr} onRetry={loadState} />), 'Associate · issue a new link from the session', null);
    }

    // ENGINE DOWN, BEFORE ANYTHING IS CAPTURED — Concept D frame E. The screen
    // says so plainly rather than walking the guest through forty seconds of
    // capture that nothing can judge.
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
                  the person who can answer it (escalation §11.3). */}
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

    // ── consent (intro folded in) ─────────────────────────────────────────
    if (phase === 'consent') {
      return (
        <ConsentScreen shell={shell} brandName={brandName} copy={copy}
          terms={(state && state.terms) || {}} agreed={terms} onAgree={setTerms}
          biometric={biometric} onBiometric={setBiometric}
          busy={busy} notice={notice} onContinue={acceptTerms}
          workflowName={workflowName} />);
    }

    // ── capture (document front / back / medical rec) ─────────────────────
    if (phase === 'capture') {
      return (
        <DocStep key={cursor} step={cursor} token={token} base={base} accent={accent}
          copy={copy} shell={shell} sessionRef={sessionRef}
          onUploaded={function (s) { advance(s); }}
          onNotice={setNotice} notice={notice}
          fix={fixRef.current}
          pickerPhotos={pickerPhotos} setPickerPhotos={setPickerPhotos}
          medicalRecOffered={medicalRecOffered} />);
    }

    // ── selfie + challenge, ONE screen and ONE camera session ─────────────
    if (phase === 'face') {
      const needsSelfie = cursor === 'selfie';
      const needsChallenge = stepIds.indexOf('challenge') >= 0
        && !((state && state.steps) || []).some(function (s) { return s.id === 'challenge' && s.state === 'done'; })
        && !done.challenge;
      return (
        <FaceStep key={'face:' + cursor} token={token} base={base} accent={accent} shell={shell}
          sessionRef={sessionRef} copy={copy} setFlash={setFlash}
          startWith={needsSelfie ? 'selfie' : 'challenge'}
          withChallenge={needsChallenge}
          fix={fixRef.current}
          onNotice={setNotice} notice={notice}
          onUploaded={function (steps) { advance(steps); }} />);
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
      // ONE SENTENCE AND A COUNTDOWN, NOT A BUTTON. The camera re-opens by
      // itself in 1.2 s (see the auto-reopen effect) and the same sentence is
      // waiting there as the standing hint. The button stays only as the
      // impatient path, because a guest who has already read it should not have
      // to watch a timer.
      return shell("Let's try that again", sessionRef, (
        <React.Fragment>
          <Plate tone="warn" icon="refresh" />
          <Big>One more try</Big>
          <Say>{(guidance && guidance.fix) || (poll && poll.message) || 'Move somewhere a bit brighter and look straight at the camera.'}</Say>
          <Say mute>{'Attempt ' + attempt + ' of ' + max + ' · re-opening the camera'}</Say>
          <window.PBtn size="lg" variant="accent" onClick={tryAgain}>Go now</window.PBtn>
        </React.Fragment>),
        'Each attempt writes an event · re-opens only the ' + String(retryStep).replace(/_/g, ' ') + ' step', null);
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
      // MED_REC_* NEVER SHOWS ITS CODE, AND NEVER GUESSES ONE EITHER. Those
      // declines turn on facts about a document this page cannot re-derive, so
      // the server's own sentence (`poll.message`) wins when it sent one.
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
    // sentence lands after a real submit.
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

  // ── the consent screen ───────────────────────────────────────────────────
  // THE OWNER'S SCREEN, TO THE LETTER: one required checkbox reading "I agree
  // to Hyperwolf's Terms and Conditions", with "Terms and Conditions" as a link
  // that opens the full document; one short optional line about keeping a face
  // on file, with "what this means" expanding the long paragraph INLINE and
  // only on request.
  //
  // WHAT THE FIRST BUILD GOT WRONG, AND WHY IT MATTERED: it printed the entire
  // 97-word Part II.A notice and the entire 57-word Part II.B checkbox on the
  // first screen a customer ever sees, above a fold, in body type. Nobody reads
  // 154 words of legal prose standing at a counter, so what it actually bought
  // was a screen that LOOKED like something to escape rather than something to
  // agree to.
  //
  // WHAT DID NOT MOVE: the notice at collection is still on this screen, still
  // before any capture, still one tap away and still verbatim from
  // IDV_TERMS.captureNotice — it is now behind "What we collect", which is
  // disclosure on request rather than disclosure by ambush. Terms §5.1 requires
  // the guest to be informed at or before the point of collection and §5.2
  // requires an active hyperlink on the capture screen; both hold. The
  // biometric consent stays separate, unbundled and unticked (§5.3), and
  // Continue works with it unticked (§5.4).
  //
  // AND THE INTRO SCREEN IS GONE. Stripe Identity's three-screen rule: the
  // "here is what will happen" sentence belongs on the screen where the guest
  // decides, not on a screen of its own that costs a tap to leave.
  // A DISCLOSURE ROW, NOT A LINK IN A PARAGRAPH. The caret says which way it
  // goes and the whole row is the hit area, because a four-word hyperlink is a
  // 90 × 16 pixel target and this is a phone.
  //
  // DECLARED AT MODULE SCOPE, NOT INSIDE ConsentScreen. A component defined in
  // a render body is a NEW component type on every render, so React unmounts
  // and remounts its whole subtree each time the parent state changes — the
  // panel would re-run its fade animation every time the other checkbox moved.
  function Reveal({ open, onToggle, label, children }) {
    const P = useP();
    return (
      <div style={{ width: '100%' }}>
        <button data-hw-i type="button" onClick={onToggle}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', padding: `${P.space.x1}px 0`, cursor: 'pointer', color: P.accentText,
            fontSize: P.type.body, fontWeight: P.weight.emph, fontFamily: P.fontSans,
            textDecoration: 'underline', minHeight: P.ctrlH.sm }}>
          {label}
          <window.Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} stroke={2} color={P.accentText} />
        </button>
        {open ? (
          <div style={{ marginTop: P.space.x2, whiteSpace: 'pre-line', fontSize: P.type.body,
            lineHeight: 1.6, color: P.ink2, background: P.surface2, border: `1px solid ${P.hairline}`,
            borderRadius: P.r10, padding: `${P.space.x3}px ${P.space.x3}px`, animation: 'fade .16s ease' }}>
            {children}
          </div>) : null}
      </div>);
  }

  function ConsentScreen({ shell, brandName, copy, terms, agreed, onAgree, biometric, onBiometric,
    busy, notice, onContinue, workflowName }) {
    const P = useP();
    const [showBio, setShowBio] = React.useState(false);
    const [showNotice, setShowNotice] = React.useState(false);
    const T = window.IDV_TERMS;
    // The last line of captureNotice is a "Full details: … [link] … [link]"
    // placeholder. It is dropped here because the real link is rendered below
    // it — a placeholder shown verbatim on a consent screen reads as a broken
    // page. If the line ever stops starting with "Full details" nothing is
    // lost: the whole notice renders.
    const noticeBody = React.useMemo(function () {
      const raw = (T && T.captureNotice) || null;
      if (!raw) return null;
      const lines = String(raw).split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\s*Full details\s*:/i.test(lines[i])) return lines.slice(0, i).join('\n').replace(/\s+$/, '');
      }
      return raw;
    }, [T]);

    return shell(brandName, null, (
      <React.Fragment>
        <Plate tone="neutral" icon="card" />
        <Big>{STEP_COPY.consent.big}</Big>
        <Say>{copy.intro || STEP_COPY.consent.say}</Say>

        {/* ── the required box ── */}
        <div data-hw-i role="presentation" onClick={function () { onAgree(!agreed); }}
          style={{ width: '100%', maxWidth: 460, textAlign: 'left', display: 'flex', gap: P.space.x3,
            alignItems: 'center', background: P.surface,
            border: `1px solid ${agreed ? P.accentBorder : P.hairline2}`,
            borderRadius: P.r12, padding: `${P.space.x4}px ${P.space.x4}px`, cursor: 'pointer',
            minHeight: P.ctrlH.xl }}>
          <window.Check on={!!agreed} onChange={onAgree} size={24} />
          <span style={{ fontSize: P.type.title, lineHeight: 1.45, color: P.ink, fontWeight: P.weight.body }}>
            {'I agree to ' + brandName + '’s '}
            {/* The link opens IdvTerms.Modal. stopPropagation, or opening the
                Terms would also toggle the box underneath it — which is the
                one interaction on a consent screen that must never be
                accidental in either direction. */}
            <span onClick={function (e) { e.stopPropagation(); }}
              style={{ display: 'inline-block', verticalAlign: 'baseline' }}>
              {window.IdvTerms ? (
                <window.IdvTerms.Link label="Terms and Conditions"
                  style={{ fontSize: P.type.title, color: P.accentText, textDecoration: 'underline',
                    padding: 0, height: 'auto', minHeight: 'auto', fontWeight: P.weight.emph }} />
              ) : <span style={{ color: P.inkMute }}>Terms and Conditions (the terms file did not load)</span>}
            </span>
          </span>
        </div>

        {/* ── the optional line ── */}
        <div style={{ width: '100%', maxWidth: 460, textAlign: 'left', display: 'flex', gap: P.space.x3,
          alignItems: 'flex-start' }}>
          <span style={{ flex: '0 0 auto', paddingTop: 2 }}>
            <window.Check on={!!biometric} onChange={onBiometric} size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span data-hw-i role="presentation" onClick={function () { onBiometric(!biometric); }}
              style={{ display: 'block', fontSize: P.type.body, lineHeight: 1.55, color: P.ink2, cursor: 'pointer' }}>
              {BIOMETRIC_SHORT}
            </span>
            <Reveal open={showBio} onToggle={function () { setShowBio(!showBio); }} label="what this means">
              {BIOMETRIC_LONG}
            </Reveal>
          </div>
        </div>

        {/* ── the notice at collection, on request ── */}
        <div style={{ width: '100%', maxWidth: 460, textAlign: 'left' }}>
          {noticeBody ? (
            <Reveal open={showNotice} onToggle={function () { setShowNotice(!showNotice); }}
              label="What we collect and how long we keep it">
              {noticeBody}
            </Reveal>
          ) : (
            <window.ErrorState compact title="The notice text did not load"
              body="idv/terms-text.js defines window.IDV_TERMS and this page did not get it. Nothing is captured until it does." />)}
          {terms && terms.needs_update_notice ? (
            <div style={{ marginTop: P.space.x2, display: 'flex', gap: P.space.x2, alignItems: 'flex-start',
              background: P.warnSoft, border: `1px solid ${P.warn}`, borderRadius: P.r10,
              padding: `${P.space.x2}px ${P.space.x3}px` }}>
              <window.Icon name="alert" size={14} stroke={2} color={P.warnText} style={{ flex: '0 0 auto', marginTop: 2 }} />
              <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{terms.needs_update_notice}</span>
            </div>) : null}
        </div>

        {notice ? <Say>{notice}</Say> : null}
        <window.PBtn size="xl" variant="accent" busy={busy} onClick={onContinue} disabled={busy || !agreed}>
          Continue
        </window.PBtn>
        {!agreed ? <Say mute>Tick the box above to continue.</Say> : null}
      </React.Fragment>),
      'New session on ' + (workflowName || 'this workflow') + ' · nothing is stored until they tap Continue', null);
  }

  // ── the auto-capture loop ────────────────────────────────────────────────
  // ONE HOOK, BOTH SURFACES. It owns the analysis tick, the settle timer, the
  // hint cadence and the relax ramp; the two capture screens only supply a
  // measure function and a snap function. Keeping the timing in one place is
  // what stops the document screen and the selfie screen drifting into two
  // different definitions of "steady".
  //
  // TICK 80 ms (12 Hz). Fast enough that the ring moves smoothly and a 400 ms
  // settle is five real samples; slow enough that the analyser and — on the
  // selfie — a MediaPipe inference both fit inside it on a mid-range phone.
  //
  // HINT CADENCE 200 ms, WITH A 600 ms FLOOR. The owner asked for 200 ms and
  // that is the recompute rate; the floor is a separate thing and it is not
  // optional. A hint that changes on every recompute strobes between "move
  // closer" and "hold steady" while a hand settles, and a strobing instruction
  // is worse than no instruction. Veriff holds each line for about half a
  // second for the same reason.
  const TICK_MS = 80;
  const HINT_MS = 200;
  const HINT_FLOOR_MS = 600;
  // The relax ramp: full strictness for 4 s, then loosen focus and stillness
  // linearly to 0.62 over the next 10 s. Glare and exposure never relax.
  const RELAX_FROM_MS = 4000, RELAX_TO_MS = 14000, RELAX_FLOOR = 0.62;
  // The manual escape hatch. 6 s when a detector we wanted is missing (the
  // owner's number), 15 s otherwise — because on the full-detector path a
  // button is a failure of the auto-capture, and a failure that takes 6 s to
  // admit will be tapped by people whose next frame would have passed.
  const MANUAL_AFTER_DEGRADED_MS = 6000, MANUAL_AFTER_MS = 15000;

  function useAutoCapture({ live, measure, gate, onSnap, degraded, paused, gen }) {
    const [hint, setHint] = React.useState(null);
    const [ready, setReady] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [manual, setManual] = React.useState(false);
    const metricsRef = React.useRef(null);
    const steadyRef = React.useRef(0);
    const firedRef = React.useRef(false);
    const openedRef = React.useRef(Date.now());
    const hintRef = React.useRef({ text: null, at: 0 });
    // THE THREE CALLBACKS GO THROUGH REFS, NOT THROUGH THE EFFECT'S DEPS.
    // `gate` on the document step closes over `barcodeOk`, which arrives
    // asynchronously a beat after mount; if the loop captured the first
    // closure it would keep asking a gate that still believes the browser has
    // no PDF417 decoder. Putting them in the effect's deps instead would
    // restart the analysis loop — and the settle timer with it — on every
    // render, which is the other way to make auto-capture never fire.
    const fns = React.useRef({});
    fns.current = { measure: measure, gate: gate, onSnap: onSnap };
    // Which measurement the gate was last using, so the escape hatch can report
    // it honestly rather than claiming the frame was never measured at all.
    const detectorRef = React.useRef('heuristic');
    const pausedRef = React.useRef(!!paused);
    pausedRef.current = !!paused;

    // The measured metrics of the last analysed frame, for the upload. Read
    // through a ref so a snap taken from a timer cannot capture a stale render.
    const latest = React.useCallback(function () { return metricsRef.current; }, []);

    // RE-ARMING. `fired` is a one-shot latch — without it a snap in flight
    // would be re-taken on the next tick. So a recoverable failure (the upload
    // was refused, the canvas gave back nothing) has to be able to lift it, and
    // it does that by bumping `gen`. A step that cannot re-arm is a dead end,
    // and on a screen with no shutter button a dead end is the whole flow.
    React.useEffect(function () {
      firedRef.current = false;
      steadyRef.current = 0;
      openedRef.current = Date.now();
      setReady(false); setProgress(0); setManual(false);
    }, [gen]);

    React.useEffect(function () {
      if (!live) return undefined;
      let stopped = false;
      let t = null;
      let last = Date.now();
      function relaxNow() {
        const age = Date.now() - openedRef.current;
        if (age <= RELAX_FROM_MS) return 1;
        const k = clamp01((age - RELAX_FROM_MS) / (RELAX_TO_MS - RELAX_FROM_MS));
        return 1 - k * (1 - RELAX_FLOOR);
      }
      function step() {
        if (stopped) return;
        const now = Date.now();
        const dt = Math.min(400, now - last);
        last = now;
        if (pausedRef.current || firedRef.current) { t = setTimeout(step, TICK_MS); return; }
        Promise.resolve(fns.current.measure()).then(function (m) {
          if (stopped) return;
          metricsRef.current = m;
          const g = fns.current.gate(m, relaxNow());
          if (g.detector) detectorRef.current = g.detector;
          if (g.pass) steadyRef.current = Math.min(GATE.STEADY_MS, steadyRef.current + dt);
          else steadyRef.current = 0;
          setReady(!!g.pass);
          setProgress(steadyRef.current / GATE.STEADY_MS);
          // The immediate path: a decoder that says yes does not wait 400 ms.
          if (g.immediate || steadyRef.current >= GATE.STEADY_MS) {
            firedRef.current = true;
            setProgress(1);
            fns.current.onSnap(Object.assign({}, m || {}, {
              steady_ms: g.immediate ? 0 : Math.round(steadyRef.current),
              detector: g.detector || 'heuristic',
            }));
            return;
          }
          t = setTimeout(step, TICK_MS);
        }, function () {
          if (!stopped) t = setTimeout(step, TICK_MS);
        });
      }
      step();
      return function () { stopped = true; clearTimeout(t); };
      // eslint-disable-next-line
    }, [live, gen]);

    // The hint, on its own clock. Recomputed every 200 ms from whatever the
    // analyser last produced, and held for at least HINT_FLOOR_MS so it reads
    // as an instruction rather than a flicker.
    React.useEffect(function () {
      if (!live) return undefined;
      const id = setInterval(function () {
        if (firedRef.current || pausedRef.current) return;
        const g = fns.current.gate(metricsRef.current, 1);
        const next = g.hint || null;
        const cur = hintRef.current;
        const now = Date.now();
        if (next === cur.text) return;
        if (cur.text && now - cur.at < HINT_FLOOR_MS) return;
        hintRef.current = { text: next, at: now };
        setHint(next);
      }, HINT_MS);
      return function () { clearInterval(id); };
      // eslint-disable-next-line
    }, [live, gen]);

    // The escape hatch timer.
    React.useEffect(function () {
      if (!live) return undefined;
      const ms = degraded ? MANUAL_AFTER_DEGRADED_MS : MANUAL_AFTER_MS;
      const id = setTimeout(function () { if (!firedRef.current) setManual(true); }, ms);
      return function () { clearTimeout(id); };
    }, [live, degraded, gen]);

    return { hint: hint, ready: ready, progress: progress, manual: manual, latest: latest,
      fire: function () {
        if (firedRef.current) return;
        firedRef.current = true;
        fns.current.onSnap(Object.assign({}, metricsRef.current || {}, {
          steady_ms: 0, detector: detectorRef.current, manual: true }));
      } };
  }

  // ── a document step ──────────────────────────────────────────────────────
  // document_front · document_back · medical_rec.
  //
  // MEDIA KIND MAPPING — the one place it is decided, and why:
  //   document_front  the AUTO-SNAPPED frame, which by construction passed
  //                   every gate. The four tilt frames that follow it go up as
  //                   `challenge_frame`, because the contract's media kinds
  //                   (docs/IDV-API-CONTRACT.md "Media"; enforced by
  //                   wmdemo/idv_api.py's _MEDIA_KINDS) offer no
  //                   `document_front_frame`, and of the two multi-frame kinds
  //                   `selfie_frame` is selfie-specific.
  //   document_back   one frame. PDF417 is a read, not an average — and where
  //                   the browser can decode one, the decode IS the gate.
  //   medical_rec     one frame. A recommendation is a page held flat, not a
  //                   card to be rocked, so no burst and no extras.
  const TILT_MS = 1500, TILT_N = 4;

  function DocStep({ step, token, base, accent, copy, shell, sessionRef, onUploaded, onNotice, notice,
    fix, pickerPhotos, setPickerPhotos, medicalRecOffered }) {
    const P = useP();
    // THE CHOICE COMES BEFORE THE CAMERA. An 18–20-year-old on a REC_21
    // workflow is OFFERED this step, not made to sit through it — so while
    // that choice is still open the camera stays off, and no permission prompt
    // fires before the guest has said yes to one.
    const [medChoice, setMedChoice] = React.useState(null);
    const showMedOffer = step === 'medical_rec' && medicalRecOffered && !medChoice;
    const cam = useCamera(!showMedOffer, 'environment');
    const boxRef = React.useRef(null);
    const analyser = React.useMemo(makeAnalyser, []);
    const reader = React.useMemo(function () {
      return step === 'document_back' ? makeBarcodeReader() : null;
    }, [step]);
    const [barcodeOk, setBarcodeOk] = React.useState(step === 'document_back' ? null : false);
    const [shutter, setShutter] = React.useState(false);
    const [snapped, setSnapped] = React.useState(false);
    const [tilt, setTilt] = React.useState(false);
    const [sending, setSending] = React.useState(false);

    const c = STEP_COPY[step] || { big: 'One more photo', say: '' };
    const shape = step === 'medical_rec' ? 'page' : 'card';
    const boxMaxWidth = step === 'medical_rec' ? 420 : 560;
    const boxAspect = step === 'medical_rec' ? '3 / 4' : '3 / 2';

    // Does this browser decode PDF417? Answered once; until it answers, the
    // step is not called degraded, because "we do not know yet" is not "we
    // cannot".
    React.useEffect(function () {
      if (!reader) return;
      let dead = false;
      reader.ready.then(function (ok) { if (!dead) setBarcodeOk(!!ok); });
      return function () { dead = true; };
    }, [reader]);

    // The barcode scan runs on its own slower clock — a full-resolution
    // detect() is an order of magnitude dearer than the 208-pixel analysis and
    // does not need 12 Hz to feel instant.
    const barcodeHitRef = React.useRef(false);
    React.useEffect(function () {
      if (!reader || cam.status !== 'live' || barcodeOk !== true) return undefined;
      let stop = false;
      let t = null;
      function loop() {
        if (stop) return;
        reader.scan(cam.videoRef.current).then(function (hit) {
          if (stop) return;
          if (hit) barcodeHitRef.current = true;
          t = setTimeout(loop, hit ? 600 : 280);
        });
      }
      loop();
      return function () { stop = true; clearTimeout(t); };
    }, [reader, cam.status, barcodeOk, cam.videoRef]);

    function guideNorm() {
      const el = boxRef.current, v = cam.videoRef.current;
      if (!el || !v) return null;
      const box = guideBox(shape, el.clientWidth, el.clientHeight);
      return boxRectToVideoNorm(box, el.clientWidth, el.clientHeight, v.videoWidth, v.videoHeight);
    }

    const measure = React.useCallback(function () {
      const v = cam.videoRef.current;
      const rect = guideNorm();
      if (!v || !rect) return null;
      return analyser.read(v, rect);
      // eslint-disable-next-line
    }, [analyser, cam.videoRef, shape]);

    // THE GATE. On the back of a licence a successful PDF417 decode short
    // circuits everything: a barcode that decoded is by definition a frame the
    // reader could read, and making that guest also satisfy a rectangle-fill
    // heuristic would be refusing a photograph we have already proved is good.
    const gate = React.useCallback(function (m, relax) {
      if (barcodeHitRef.current) {
        return { pass: true, immediate: true, detector: 'barcode', hint: null, gates: { barcode: true } };
      }
      const g = docGate(m, relax);
      if (barcodeOk === true && !g.hint) g.hint = 'Hold the barcode still';
      return g;
    }, [barcodeOk]);

    const degraded = step === 'document_back' && barcodeOk === false;

    // Re-arm the auto-capture after a recoverable failure. `gen` lifts the
    // hook's one-shot latch; it is NOT a React key on the preview, because
    // remounting the <video> element would drop the srcObject the camera hook
    // only re-attaches when the STREAM changes — and the stream would not have.
    const [gen, setGen] = React.useState(0);
    function reopen() { setGen(function (g) { return g + 1; }); }

    const auto = useAutoCapture({
      live: cam.status === 'live' && !showMedOffer,
      measure: measure, gate: gate, degraded: degraded, gen: gen,
      paused: shutter || snapped || sending,
      onSnap: function (metrics) { snap(metrics); },
    });

    function grabFrame(maxEdge, q, withMetrics) {
      const v = cam.videoRef.current;
      if (!v) return Promise.resolve(null);
      const canvas = drawScaled(v, maxEdge || MAX_EDGE);
      if (!canvas) return Promise.resolve(null);
      const m = withMetrics ? canvasMetrics(canvas) : null;
      return canvasToJpeg(canvas, q || JPEG_Q).then(function (blob) {
        return blob ? { blob: blob, metrics: m } : null;
      });
    }

    function snap(metrics) {
      setShutter(true);
      // The frame is read from the <video> element, not from anything the
      // shutter overlay touches — the overlay is a sibling DOM node and the
      // camera does not know it exists, so the order of these two is free.
      grabFrame().then(function (f) {
        setTimeout(function () { setShutter(false); setSnapped(true); }, 160);
        if (!f) {
          onNotice('The camera gave us no picture. Move a little and we will try again.');
          setTimeout(function () { setSnapped(false); reopen(); }, 900);
          return;
        }
        setSending(true);
        const m = clientMetrics(metrics, 'heuristic');
        const up = capUpload(token, step, f.blob, { metrics: m, base: base });

        if (step !== 'document_front') {
          up.then(function (r) {
            setSending(false);
            if (!r.ok) { onNotice(uploadFail(r)); setSnapped(false); reopen(); return; }
            setTimeout(function () { onUploaded(step); }, 380);
          });
          return;
        }

        // THE TILT BURST, AUTOMATIC AND AFTER THE SNAP. The document front is
        // already captured and already uploading; these four frames are the
        // ink-under-tilt evidence, and taking them AFTER the real photo means
        // a guest who moves during them cannot spoil the photo that matters.
        // 1.5 s, four frames, one prompt, no button — and the upload of the
        // photo that matters runs underneath the prompt, so the tilt is not a
        // delay added to the flow, it is the delay the network was costing
        // anyway.
        setTilt(true);
        const frames = [];
        // A CHAIN, NOT AN INTERVAL RACING A TIMEOUT. The first version fired
        // `setInterval(375ms)` alongside a `setTimeout(1500ms)` and uploaded
        // whatever had landed when the timeout won. Measured in a backgrounded
        // tab, where the browser throttles timers to about 1 Hz: ZERO of the
        // four tilt frames were ever captured, and nothing said so — the step
        // simply advanced having silently dropped the evidence it exists to
        // collect. Chaining each wait to the completion of the previous grab
        // guarantees TILT_N attempts whatever the timers do; the prompt's
        // duration is then a consequence of the work, not a race against it.
        const shots = grabBurst(grabFrame, TILT_N, Math.round(TILT_MS / TILT_N), 1280, 0.8, true);
        Promise.all([up, shots.then(function (fs) { fs.forEach(function (f) { frames.push(f); }); })])
          .then(function (out) {
            const r = out[0];
            setTilt(false);
            setSending(false);
            if (!r.ok) { onNotice(uploadFail(r)); setSnapped(false); reopen(); return; }
            // The extras are advisory, and sharpest-first so that if the chain
            // is cut short by a walk-off the frames that landed are the ones
            // worth having. A failure to upload one of them must NOT lose the
            // step that already landed, so each is swallowed.
            const ordered = orderByQuality(frames);
            let ch = Promise.resolve();
            ordered.forEach(function (fr, n) {
              ch = ch.then(function () {
                return capUpload(token, 'challenge_frame', fr.blob,
                  { metrics: clientMetrics(fr.metrics, 'heuristic', { steady_ms: null, card_fill: null }),
                    base: base, filename: 'document_front_tilt_' + (n + 1) + '.jpg' })
                  .then(function () {}, function () {});
              });
            });
            ch.then(function () { onUploaded(step); });
          });
      });
    }

    function uploadFail(r) {
      if (r && r.code === 413) return 'That photo was too large. We will take another.';
      if (r && r.code === 415) return 'That file is not a photo we can read. We will take another.';
      return (r && r.error) || 'That did not go through. We will take another.';
    }

    // ── the offer (18–20 on a REC_21 workflow, offer_medical_path on) ──────
    // A CHOICE, NOT A DECLINE. "I don't have one" continues the flow exactly as
    // if this step were not there — no local verdict is drawn, and the backend
    // still decides.
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
      // picker, and extends it by doing the one thing that control explicitly
      // does not do: uploading.
      return (
        <PickerFallback step={step} token={token} base={base} shell={shell} sessionRef={sessionRef}
          copy={copy} onUploaded={onUploaded} onNotice={onNotice} notice={notice}
          detail={cam.detail} photos={pickerPhotos} setPhotos={setPickerPhotos} />);
    }

    const live = cam.status === 'live';
    const standing = tilt ? 'Slowly tilt the card'
      : sending ? 'Sending…'
        : snapped ? null
          : (auto.hint || fix || c.say);

    return shell(c.big, sessionRef, (
      <React.Fragment>
        <div ref={boxRef} style={{ position: 'relative', width: '100%', maxWidth: boxMaxWidth,
          aspectRatio: boxAspect, background: P.canvas2,
          borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline}` }}>
          <video ref={cam.videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: live ? 1 : 0.25 }} />
          <GuideOverlay shape={shape} tone={accent} ready={auto.ready && !snapped} dim={P.imgScrim}
            progress={snapped ? 0 : auto.progress} />
          <HintChip text={standing} tone={auto.ready ? P.good : null} />
          <Shutter on={shutter} done={snapped && !tilt} />
        </div>
        <Big>{tilt ? 'Slowly tilt the card' : c.big}</Big>
        {/* THE FIX SENTENCE, STANDING, INSIDE THE FLOW. Not a screen of its own
            and not a toast — the guest is re-photographing the thing it is
            about, so it stays visible for as long as they are. */}
        {fix && !snapped ? <Say>{fix}</Say> : null}
        {!fix && !snapped ? <Say mute>{c.say}</Say> : null}
        {barcodeOk === true && step === 'document_back' && !snapped
          ? <Say mute>We read the barcode on the back — this snaps itself the moment it comes through.</Say> : null}
        {notice ? <Say>{notice}</Say> : null}
        {!live ? <Say mute>Starting the camera…</Say> : null}
        {/* THE ESCAPE HATCH, AND NOTHING ELSE. There is no shutter button on
            this screen until the auto-capture has had its chance and failed —
            a visible button is an invitation to press it, and a pressed button
            is a photo taken before the gates said yes. */}
        {auto.manual && live && !snapped ? (
          <window.PBtn size="xl" variant="secondary" icon="camera" onClick={auto.fire}>Take photo</window.PBtn>
        ) : null}
      </React.Fragment>),
      (barcodeOk === true ? 'Rear camera · PDF417 read on-device' : 'Rear camera · quality gates on-device')
      + ' · the server still decides', null, { flush: true });
  }

  // N GRABS, SPACED, AND ALL OF THEM. Resolves with everything that came back,
  // in capture order. Shared by the document tilt burst and the selfie's
  // passive frames because both had the same bug and both need the same
  // guarantee: the number of frames is what was asked for, and the elapsed time
  // is whatever that took — never the other way round.
  function grabBurst(grab, n, gap, maxEdge, quality, withMetrics) {
    const out = [];
    let chain = Promise.resolve();
    for (let i = 0; i < n; i++) {
      chain = chain
        .then(function () { return new Promise(function (r) { setTimeout(r, gap); }); })
        .then(function () { return grab(maxEdge, quality, withMetrics); })
        .then(function (f) { if (f) out.push(f); }, function () {});
    }
    return chain.then(function () { return out; });
  }

  // Sharpest first, glare breaks a near-tie. Pure, so it is checkable without a
  // camera; used to order the tilt extras so that if the upload chain is cut
  // short the frames that landed are the ones worth having.
  function orderByQuality(frames) {
    return (frames || []).filter(function (f) { return f && f.blob; }).slice().sort(function (a, b) {
      const am = a.metrics || {}, bm = b.metrics || {};
      const av = am.sharpness == null ? (am.blur == null ? -1 : am.blur) : am.sharpness;
      const bv = bm.sharpness == null ? (bm.blur == null ? -1 : bm.blur) : bm.sharpness;
      if (Math.abs(av - bv) > Math.max(1, Math.abs(bv) * 0.08)) return bv - av;
      const ag = am.glare_fraction == null ? (am.glare == null ? 1 : am.glare) : am.glare_fraction;
      const bg = bm.glare_fraction == null ? (bm.glare == null ? 1 : bm.glare) : bm.glare_fraction;
      return ag - bg;
    });
  }
  function bestOfBurst(frames) { return orderByQuality(frames)[0] || null; }

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
      // (accept()) in one place and this file out of the business of
      // re-checking types and sizes.
      fetch(ready.url).then(function (r) { return r.blob(); }).then(function (blob) {
        // NOTHING WAS MEASURED, AND THE ROW SAYS SO. A file chosen from the
        // camera roll never passed a gate — there was no live frame to gate —
        // so every measurement is null and `manual` is true. An all-null row is
        // the honest record of a photo whose provenance we do not know.
        return capUpload(token, step, blob, { base: base, filename: ready.name || (step + '.jpg'),
          metrics: clientMetrics({ manual: true }, 'heuristic') });
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
            different experience and the guest is told why. */}
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

  // ── the face step: selfie AND challenge, one mount, one stream ───────────
  // THE SINGLE BIGGEST FRICTION CUT IN THE REBUILD. The first build finished the
  // selfie, unmounted the camera, mounted a second component, re-acquired the
  // same front camera (a second permission check on some browsers, a black
  // rectangle for 400–900 ms on all of them) and then asked the guest to press
  // "Start the check". Four of those five things are gone: one component, one
  // getUserMedia, one MediaPipe instance, and the challenge begins by itself
  // the instant the selfie has landed.
  //
  // WHAT MEDIAPIPE IS ACTUALLY FOR HERE, IN BOTH HALVES:
  //   selfie     one face, filling 40–70 % of the OVAL's height, centred in it,
  //              lit, and still for 400 ms. Measured against the oval the guest
  //              can see, not against the frame they cannot.
  //   challenge  the prompts are VERIFIED, not merely waited out. A "turn left"
  //              completes when the yaw actually crosses, a "blink" when the
  //              blendshape actually fires — so a guest who did it fast is not
  //              held for the full 1.5 s, and a guest who did nothing still
  //              runs out the server's own clock and is judged by the server on
  //              the recording. The page never decides a liveness outcome.
  //
  // THE SCRIPT AND ITS ORDER ARE THE SERVER'S. A page that chose its own turn
  // order or its own colours would make the nonce meaningless, which is the
  // whole point of CHALLENGE_NONCE_MISMATCH.
  const PASSIVE_N = 3, PASSIVE_GAP_MS = 300;
  const TURN_MS = 1500, BLINK_MS = 1200, FLASH_MS = 250;
  const PROMPT_MIN_MS = 600;             // never advance a prompt faster than this
  const YAW_HIT = 0.22, BLINK_HIT = 0.45;
  const FALLBACK_FRAMES = 10, FALLBACK_GAP_MS = 250;
  const FACE_WAIT_MS = 4000;             // how long we wait for a warm model

  function FaceStep({ token, base, accent, shell, sessionRef, copy, setFlash, startWith, withChallenge,
    fix, onNotice, notice, onUploaded }) {
    const P = useP();
    const cam = useCamera(true, 'user');
    const boxRef = React.useRef(null);
    const analyser = React.useMemo(makeAnalyser, []);
    // 'selfie' | 'snapped' | 'challenge' | 'sending'
    const [mode, setMode] = React.useState(startWith === 'challenge' ? 'challenge' : 'selfie');
    const [shutter, setShutter] = React.useState(false);
    const [snapped, setSnapped] = React.useState(false);
    const [prompt, setPrompt] = React.useState(null);   // { text, arrow }
    const [mp, setMp] = React.useState(faceState());
    const stopRef = React.useRef(false);
    const lastFaceRef = React.useRef(null);      // last MediaPipe result, for the challenge
    const centreRef = React.useRef(null);
    const doneRef = React.useRef(false);

    React.useEffect(function () {
      return function () { stopRef.current = true; setFlash(null); };
      // eslint-disable-next-line
    }, []);

    // Watch the vendored model in. It was started back on the consent screen,
    // so on any normal connection it is already 'ready' by the time this mounts.
    React.useEffect(function () {
      startFaceLoad();
      if (faceState() === 'ready' || faceState() === 'failed') { setMp(faceState()); return undefined; }
      let dead = false;
      function onReady() { if (!dead) setMp(faceState()); }
      window.addEventListener('hw-face-mp', onReady);
      // A poll as well as the event: the event fires once, and a component that
      // mounts in the same tick the module settles can miss it.
      const id = setInterval(onReady, 250);
      const giveUp = setTimeout(function () {
        if (!dead && faceState() !== 'ready') setMp('failed');
      }, FACE_WAIT_MS);
      return function () { dead = true; window.removeEventListener('hw-face-mp', onReady); clearInterval(id); clearTimeout(giveUp); };
    }, []);

    const usingMp = mp === 'ready' && !!faceLandmarker();

    function ovalIn() {
      const el = boxRef.current;
      if (!el) return null;
      return guideBox('oval', el.clientWidth, el.clientHeight);
    }
    function guideNorm(oval) {
      const el = boxRef.current, v = cam.videoRef.current;
      if (!el || !v || !oval) return null;
      return boxRectToVideoNorm(oval, el.clientWidth, el.clientHeight, v.videoWidth, v.videoHeight);
    }

    // ONE MEASURE FUNCTION FOR BOTH HALVES. The challenge reads the same
    // landmark result the selfie gate reads, from `lastFaceRef`, so there is one
    // inference per tick and not two.
    const measure = React.useCallback(function () {
      const v = cam.videoRef.current, el = boxRef.current;
      if (!v || !el || !v.videoWidth) return null;
      const oval = ovalIn();
      const rect = guideNorm(oval);
      const base2 = rect ? analyser.read(v, rect) : null;
      if (!usingMp) { lastFaceRef.current = null; return base2; }
      const lm = faceLandmarker();
      let res = null;
      try { res = lm.detectForVideo(v, faceTick()); } catch (e) { res = null; }
      lastFaceRef.current = res;
      const fm = faceMetricsFrom(res, el.clientWidth, el.clientHeight, v.videoWidth, v.videoHeight, oval);
      let motion = null;
      if (fm._centre && centreRef.current) {
        const dx = fm._centre.x - centreRef.current.x, dy = fm._centre.y - centreRef.current.y;
        motion = round3(Math.sqrt(dx * dx + dy * dy));
      }
      centreRef.current = fm._centre || null;
      return Object.assign({}, base2 || {}, {
        faces: fm.faces, face_fill: fm.face_fill, face_offset: fm.face_offset,
        face_box: fm.face_box, face_motion: motion,
      });
      // eslint-disable-next-line
    }, [analyser, cam.videoRef, usingMp]);

    // WITHOUT MEDIAPIPE THE FACE GATES ARE NOT FAKED. The first build's
    // alternative would have been a skin-tone/oval heuristic, and the brief is
    // right to refuse it: a skin heuristic decides who looks like a face, which
    // is not a thing a capture gate may do. So the degraded path keeps ONLY the
    // measurements that are about the photograph — light, glare, focus,
    // stillness — and says nothing about the face at all. The server does the
    // face work either way.
    const gate = React.useCallback(function (m, relax) {
      if (usingMp) {
        const g = faceGate(m, relax);
        g.detector = 'mediapipe';
        return g;
      }
      if (!m) return { pass: false, hint: null, gates: {}, detector: 'heuristic' };
      const g = {
        light: m.exposure != null && m.exposure >= GATE.EXPOSURE_MIN && m.exposure <= GATE.EXPOSURE_MAX,
        focus: m.sharpness != null && m.sharpness >= sharpnessFloor(m, relax),
        still: m.motion != null && m.motion <= GATE.MOTION_MAX * (relax == null ? 1 : (2 - relax)),
      };
      let hint = null;
      if (!g.light) hint = (m.exposure != null && m.exposure > GATE.EXPOSURE_MAX)
        ? 'Too bright — move out of the direct light' : 'Too dark — find more light';
      else if (!g.focus || !g.still) hint = 'Hold steady';
      return { pass: g.light && g.focus && g.still, hint: hint, gates: g, detector: 'heuristic' };
    }, [usingMp]);

    // `card_fill` is nulled on every face upload. The analyser measures it over
    // whatever region it is given, and over a face oval the number is real but
    // it is not the thing the name promises — a reader who found `card_fill` on
    // a selfie row would reasonably read it as a document measurement. A null
    // says "not measured here", which is the truth.
    function payload(metrics, extra) {
      return clientMetrics(metrics, usingMp ? 'mediapipe' : 'heuristic',
        Object.assign({ card_fill: null }, extra || {}));
    }

    function grabOne(maxEdge, q) {
      const v = cam.videoRef.current;
      if (!v) return Promise.resolve(null);
      const canvas = drawScaled(v, maxEdge || MAX_EDGE);
      if (!canvas) return Promise.resolve(null);
      return canvasToJpeg(canvas, q || JPEG_Q);
    }

    // Same one-shot latch, same re-arm. A selfie whose upload was refused has
    // to be retakeable, and on a screen with no shutter button that means the
    // loop, not the guest, has to start again.
    const [gen, setGen] = React.useState(0);
    function reopen() { setSnapped(false); setGen(function (g) { return g + 1; }); }

    const auto = useAutoCapture({
      live: cam.status === 'live' && mode === 'selfie',
      measure: measure, gate: gate, gen: gen,
      // Degraded on the selfie means "we asked for the model and did not get
      // it", which is exactly when the owner's 6 s escape hatch should appear.
      degraded: !usingMp,
      paused: shutter || snapped,
      onSnap: function (metrics) { snapSelfie(metrics); },
    });

    // ── the selfie ───────────────────────────────────────────────────────
    function snapSelfie(metrics) {
      setShutter(true);
      const m = payload(metrics, { steady_ms: metrics && metrics.steady_ms });
      setTimeout(function () { setShutter(false); setSnapped(true); }, 160);

      // Three passive frames and then the selfie, all inside the settle the
      // gates already proved. The passive frames are `selfie_frame`; only the
      // last one is `selfie`. Chained rather than interval-and-race, for the
      // reason spelled out on grabBurst: measured in a throttled tab, the race
      // version uploaded ZERO of the three and said nothing about it.
      grabBurst(function () { return grabOne(); }, PASSIVE_N, PASSIVE_GAP_MS).then(function (frames) {
        let ch = Promise.resolve();
        frames.forEach(function (b) {
          ch = ch.then(function () {
            return capUpload(token, 'selfie_frame', b, { metrics: m, base: base }).then(function () {}, function () {});
          });
        });
        return ch.then(function () { return grabOne(); });
      }).then(function (b) {
          if (!b) {
            onNotice('The camera gave us no picture. Move a little and we will try again.');
            reopen();
            return null;
          }
          return capUpload(token, 'selfie', b, { metrics: m, base: base }).then(function (r) {
            if (!r.ok) {
              onNotice((r && r.error) || 'That did not go through. We will take another.');
              reopen();
              return null;
            }
            // STRAIGHT INTO THE CHALLENGE. No screen, no button, no second
            // camera acquisition — the same stream is already running.
            if (withChallenge) { setTimeout(function () { setSnapped(false); startChallenge(); }, 420); }
            else { setTimeout(function () { finish(['selfie']); }, 420); }
            return null;
          });
      });
    }

    function finish(steps) {
      if (doneRef.current) return;
      doneRef.current = true;
      onUploaded(steps);
    }

    // ── the challenge ────────────────────────────────────────────────────
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // A prompt runs for at most `ms`, and ends early the moment MediaPipe sees
    // the thing actually happen (but never before PROMPT_MIN_MS, so the guest
    // is not whiplashed by an instruction that vanishes as they read it).
    // `check` returns true when satisfied; without MediaPipe it is never called
    // and the prompt simply runs its full time.
    function runPrompt(ms, check) {
      const t0 = Date.now();
      return new Promise(function (resolve) {
        function tick() {
          if (stopRef.current) { resolve(false); return; }
          const age = Date.now() - t0;
          if (age >= ms) { resolve(false); return; }
          if (usingMp && age >= PROMPT_MIN_MS && check && check(lastFaceRef.current)) { resolve(true); return; }
          setTimeout(tick, 60);
        }
        tick();
      });
    }

    // The challenge needs the landmark stream running too — the selfie loop is
    // torn down when `mode` leaves 'selfie', so this is its own light tick that
    // only refreshes lastFaceRef for runPrompt's checks.
    React.useEffect(function () {
      if (mode !== 'challenge' || !usingMp || cam.status !== 'live') return undefined;
      let stop = false, t = null;
      function tick() {
        if (stop) return;
        const v = cam.videoRef.current;
        const lm = faceLandmarker();
        if (v && v.videoWidth && lm) {
          try { lastFaceRef.current = lm.detectForVideo(v, faceTick()); } catch (e) {}
        }
        t = setTimeout(tick, TICK_MS);
      }
      tick();
      return function () { stop = true; clearTimeout(t); };
    }, [mode, usingMp, cam.status, cam.videoRef]);

    function runScript(script) {
      let chain = Promise.resolve();
      (script || []).forEach(function (item) {
        chain = chain.then(function () {
          if (stopRef.current) return null;
          if (item.kind === 'turn') {
            const dir = item.dir === 'right' ? 'right' : 'left';
            setPrompt({ text: 'Turn your head to the ' + dir, arrow: dir === 'right' ? 'arrow-right' : 'arrow-left' });
            // The guest's left is the video's right and vice versa — the front
            // camera is not mirrored in its pixels, only in the preview.
            const want = dir === 'left' ? 1 : -1;
            return runPrompt(item.ms || TURN_MS, function (res) {
              const y = faceYaw(res);
              return y != null && (y * want) > YAW_HIT;
            }).then(function () { setPrompt(null); });
          }
          if (item.kind === 'blink') {
            setPrompt({ text: 'Now blink', arrow: null });
            return runPrompt(item.ms || BLINK_MS, function (res) {
              const l = blend(res, 'eyeBlinkLeft'), r = blend(res, 'eyeBlinkRight');
              return l != null && r != null && (l > BLINK_HIT || r > BLINK_HIT);
            }).then(function () { setPrompt(null); });
          }
          if (item.kind === 'flash') {
            // NEVER SHORTENED. The colour panels are there to light the face
            // for the recording; ending one early because a landmark moved
            // would be shortening the evidence, not the instruction.
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

    const challengeStartedRef = React.useRef(false);
    function startChallenge() {
      if (challengeStartedRef.current) return;
      challengeStartedRef.current = true;
      setMode('challenge');
      onNotice(null);
      setPrompt({ text: 'Getting the check ready', arrow: null });
      capPost(token, 'challenge', {}, base).then(function (r) {
        if (!r.ok || !r.body) {
          setPrompt(null);
          onNotice((r && r.error) || 'We could not start that check. Tap to try it again.');
          challengeStartedRef.current = false;
          return;
        }
        const ch = r.body;
        const stream = cam.stream;
        const MR = window.MediaRecorder;
        // MIME FALLBACK, INCLUDING MP4. Safari has no webm encoder at all and
        // answers `isTypeSupported('video/webm')` false for every profile; it
        // does record `video/mp4`, and the backend admits mp4. Without this the
        // whole liveness step on iPhone fell through to the ten-frame path.
        const mime = (MR && stream && MR.isTypeSupported)
          ? (MR.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
            : MR.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
              : MR.isTypeSupported('video/webm') ? 'video/webm'
                : MR.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1'
                  : MR.isTypeSupported('video/mp4') ? 'video/mp4' : null)
          : null;

        if (mime) {
          let rec = null;
          const chunks = [];
          try { rec = new MR(stream, { mimeType: mime }); } catch (e) { rec = null; }
          if (rec) {
            rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
            rec.onstop = function () {
              const type = mime.split(';')[0];
              const blob = new Blob(chunks, { type: type });
              sendRecording(blob, ch.challenge_id, /mp4/.test(type) ? 'liveness.mp4' : 'liveness.webm');
            };
            try { rec.start(200); } catch (e) { rec = null; }
            if (rec) {
              runScript(ch.script).then(function () {
                setPrompt(null);
                setMode('sending');
                try { rec.stop(); }
                catch (e) { sendRecording(null, ch.challenge_id, 'liveness.webm'); }
              });
              return;
            }
          }
        }
        // FALLBACK: no MediaRecorder at all. Ten frames at 250 ms as
        // `challenge_frame`, with the same challenge id, so the engine still
        // sees the sequence the nonce named.
        const frames = [];
        let n = 0;
        const ticker = setInterval(function () {
          if (n >= FALLBACK_FRAMES || stopRef.current) { clearInterval(ticker); return; }
          n++;
          grabOne(720, 0.8).then(function (b) { if (b) frames.push(b); });
        }, FALLBACK_GAP_MS);
        runScript(ch.script).then(function () {
          clearInterval(ticker);
          setPrompt(null);
          setMode('sending');
          let c2 = Promise.resolve();
          frames.forEach(function (b, i) {
            c2 = c2.then(function () {
              return capUpload(token, 'challenge_frame', b,
                { challengeId: ch.challenge_id, base: base, filename: 'challenge_' + (i + 1) + '.jpg',
                  metrics: payload(null) })
                .then(function () {}, function () {});
            });
          });
          c2.then(function () { finish(startWith === 'challenge' ? ['challenge'] : ['selfie', 'challenge']); });
        });
      });
    }

    function sendRecording(blob, challengeId, filename) {
      if (!blob || !blob.size) {
        setMode('challenge');
        challengeStartedRef.current = false;
        onNotice('The recording came back empty. Tap to run that check again.');
        return;
      }
      capUpload(token, 'liveness_video', blob,
        { challengeId: challengeId, base: base, filename: filename, metrics: payload(null) })
        .then(function (r) {
          if (!r.ok) {
            setMode('challenge');
            challengeStartedRef.current = false;
            onNotice((r && r.error) || 'That recording did not go through. Tap to try again.');
            return;
          }
          finish(startWith === 'challenge' ? ['challenge'] : ['selfie', 'challenge']);
        });
    }

    // A challenge-first mount (the guided retry re-opened only `challenge`)
    // starts the moment the camera is live. No button, same as the selfie path.
    React.useEffect(function () {
      if (startWith !== 'challenge') return;
      if (cam.status !== 'live') return;
      startChallenge();
      // eslint-disable-next-line
    }, [startWith, cam.status]);

    // ── render ───────────────────────────────────────────────────────────
    if (cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'failed') {
      // No camera means no liveness. Say so and stop — a challenge is not
      // something a file picker can stand in for.
      return shell(mode === 'selfie' ? 'Look at the camera' : 'One quick check', sessionRef, (
        <React.Fragment>
          <Plate tone="warn" icon="camera" />
          <Big>{cam.status === 'denied' ? 'The camera is blocked' : 'This device has no camera we can use'}</Big>
          <Say>{cam.status === 'denied'
            ? 'Allow the camera in your browser and reload this page. This check needs live video.'
            : 'This check needs live video, which this device did not give the page. Bring your physical ID to any Hyperwolf store and the associate can verify you there.'}</Say>
          {cam.detail ? <Say mute>{cam.detail}</Say> : null}
        </React.Fragment>), 'Liveness cannot run without a camera', null);
    }

    const live = cam.status === 'live';
    const inChallenge = mode === 'challenge' || mode === 'sending';
    const title = inChallenge ? 'One quick check' : STEP_COPY.selfie.big;
    const chip = inChallenge
      ? (prompt ? prompt.text : (mode === 'sending' ? 'Sending…' : null))
      : (snapped ? null : (auto.hint || fix || STEP_COPY.selfie.say));

    return shell(title, sessionRef, (
      <React.Fragment>
        <div ref={boxRef} style={{ position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '3 / 4',
          background: P.canvas2, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline}` }}>
          <video ref={cam.videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              // The preview is mirrored so the guest sees themselves the way a
              // mirror shows them. The CAPTURED frame is not: drawScaled reads
              // the video element's pixels, not this transform — which is also
              // why the yaw check above flips the sign rather than the image.
              transform: 'scaleX(-1)', opacity: live ? 1 : 0.25 }} />
          <GuideOverlay shape="oval" tone={accent} ready={inChallenge || (auto.ready && !snapped)}
            dim={P.imgScrim} progress={inChallenge || snapped ? 0 : auto.progress} />
          {prompt && prompt.arrow ? (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: prompt.arrow === 'arrow-left' ? 'flex-start' : 'flex-end',
              padding: P.space.x4, pointerEvents: 'none' }}>
              <span style={{ width: 62, height: 62, borderRadius: P.r999, background: P.imgScrim,
                display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade .2s ease' }}>
                <window.Icon name={prompt.arrow} size={34} stroke={2.4} color={P.accent} />
              </span>
            </div>) : null}
          <HintChip text={chip} tone={inChallenge ? P.accent : (auto.ready ? P.good : null)} />
          <Shutter on={shutter} done={snapped} />
        </div>
        <Big>{inChallenge ? (prompt ? prompt.text : 'One quick check') : STEP_COPY.selfie.big}</Big>
        {!inChallenge && fix && !snapped ? <Say>{fix}</Say> : null}
        {!inChallenge && !fix && !snapped ? <Say mute>{copy.selfie || STEP_COPY.selfie.say}</Say> : null}
        {inChallenge && !prompt && mode !== 'sending' ? <Say mute>{STEP_COPY.challenge.say}</Say> : null}
        {/* HONEST ABOUT THE DEGRADED PATH, WITHOUT A DIAGNOSIS. The guest is
            told the framing help is missing, not why, and never a model name. */}
        {!inChallenge && !usingMp && mp === 'failed' && live
          ? <Say mute>The on-screen framing help did not load, so line your face up with the oval yourself.</Say> : null}
        {!inChallenge && !usingMp && mp !== 'failed' && live ? <Say mute>Getting ready…</Say> : null}
        {notice ? <Say>{notice}</Say> : null}
        {!live ? <Say mute>Starting the camera…</Say> : null}
        {!inChallenge && auto.manual && live && !snapped ? (
          <window.PBtn size="xl" variant="secondary" icon="camera" onClick={auto.fire}>Take photo</window.PBtn>
        ) : null}
        {/* The only button the challenge ever shows, and only after it has
            already failed once and said so. */}
        {inChallenge && notice && !challengeStartedRef.current ? (
          <window.PBtn size="lg" variant="accent" onClick={startChallenge}>Run the check again</window.PBtn>
        ) : null}
      </React.Fragment>),
      (usingMp ? 'Front camera · face framing and prompt checks run on-device' : 'Front camera · quality gates on-device')
      + ' · colour sequence and turn order come from the server as a nonce', null, { flush: true });
  }

  // ── statics ─────────────────────────────────────────────────────────────
  // Hung off the component rather than published as a second global. The seam
  // needs the transport; a QA run needs to prove an upload lands without a
  // camera in the room; and every gate here is a pure function of an object, so
  // the thresholds that decide whether a shutter fires are checkable from Node
  // with a literal — which is the only way a capture flow's quality rules ever
  // stay honest.
  window.IdvCapture.api = { url: capUrl, get: capGet, post: capPost, upload: capUpload, beacon: capBeacon };
  window.IdvCapture.grab = { drawScaled: drawScaled, toJpeg: canvasToJpeg, MAX_EDGE: MAX_EDGE, JPEG_Q: JPEG_Q };
  window.IdvCapture.metrics = {
    analyser: makeAnalyser,
    docGate: docGate, faceGate: faceGate, sharpnessFloor: sharpnessFloor,
    faceMetricsFrom: faceMetricsFrom, faceYaw: faceYaw, blend: blend,
    order: orderByQuality, best: bestOfBurst,
    GATE: GATE, ANALYSIS_EDGE: ANALYSIS_EDGE, SATURATED: SATURATED, EDGE_T: EDGE_T,
    TICK_MS: TICK_MS, HINT_MS: HINT_MS,
  };
  window.IdvCapture.geometry = { guideBox: guideBox, toVideo: boxRectToVideoNorm, toBox: videoNormToBox };
  window.IdvCapture.detectors = { barcode: makeBarcodeReader, startFaceLoad: startFaceLoad, faceState: faceState };
})();
