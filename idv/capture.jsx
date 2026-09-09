// ── idv/capture.jsx ── window.IdvCapture — the guest-facing capture flow ────
//
// ONE COMPONENT, TWO SURFACES. `mode:'hosted'` is the phone/desktop page the
// site iframes (idv/capture.html at /verify/{token}); `mode:'pos'` is the same
// flow inside the check-in modal on the counter tablet, mounted by
// pos/checkin-verify-seam.jsx. The difference is ONLY chrome: pos adds the
// associate bar at the bottom and the override button. Every step, every
// upload and every sentence the guest reads is identical, because two copies
// of a capture flow is two flows to keep in step and one of them will drift.
//
// ── ROUND 3, 2026-09-09 — WHAT THE OWNER'S iPHONE PROVED ──────────────────
// He tested round 2 on iPhone Safari: "super buggy and super unreliable — this
// needs to be MEGA tuned. On the back — where the barcode is — the system is
// completely unreliable. I spent a good 5 minutes trying to get the system to
// register the back." Four separate defects, each with a measurement:
//
//  1. THERE WAS NO BARCODE READER ON HIS PHONE AT ALL. Round 2 used
//     `window.BarcodeDetector`, which Safari does not implement — on any
//     platform, to this day. So the "snap the instant it decodes" path, which
//     is the entire reason the back of a licence is easy, simply did not
//     exist for him, and he fell through to a heuristic gate and then to the
//     manual button. FIXED by vendoring zxing-wasm's PDF417 reader under
//     vendor/zxing and running it in a Worker. Native `BarcodeDetector` is
//     still preferred WHERE IT ACTUALLY SUPPORTS pdf417; otherwise zxing.
//
//  2. THE FRAME HE COULD NOT GET ACCEPTED WAS READABLE. Measured on his
//     session: barcode-region sharpness 707 against a floor of 340 — sharp —
//     and a barcode 449 px wide in a 1920-wide frame against a 500 px floor.
//     Probed against the vendored decoder on a synthetic 1920×1080 frame
//     carrying a real 294-byte AAMVA payload (205 modules wide), blurred and
//     under-exposed, the floor is not 500 px:
//
//         barcode width   px/module   decodes?
//            360 px         1.76        no
//            400 px         1.95        no
//            420 px         2.05        YES
//            449 px         2.19        YES     ← his frame
//            560 px         2.73        YES
//
//     His frame was ABOVE the real floor and was refused anyway. In round 3
//     nothing refuses a back frame on a width heuristic: the decode is the
//     gate, and a width is only ever advice.
//
//  3. UNDER-EXPOSURE DID NOT MATTER, AND THE SCREEN SAID IT DID. The same
//     sweep at exposure ×0.42 (his "IMAGE_TOO_DARK", quality 77.8) decoded
//     identically at every width — zxing's LocalAverage binarizer normalises
//     it away. What DID break the decode was blur: at 2.19 px/module a 2-pixel
//     defocus killed it while a 1-pixel one did not. So the back-of-card
//     advice is now "Move closer" / "More light" / "Hold still" in that order,
//     and exposure never blocks a decode attempt.
//
//  4. "FIT THE WHOLE CARD IN THE FRAME" WAS STUCK WHILE THE CARD FILLED THE
//     GUIDE. Round 2's fill gate demanded a straight run of edge pixels lying
//     along each of the four guide lines (`rect_fill`, weighted 0.65 of
//     `card_fill`). A card that fills the guide but sits 5° rotated, or 6 %
//     off-centre — i.e. a card held by a human — scores near zero on the worst
//     side and fails, and the failure branch then asks `spill > 0.35`, which
//     any desk or hand satisfies. So a correctly framed card was told to be
//     framed. FIXED: framing is now measured by finding the DOCUMENT'S OWN
//     BOUNDING BOX from edge projection profiles and comparing it to the
//     guide. "Fit the whole card in the frame" fires only when the box is
//     genuinely outside the guide; when the profiles never fall away (a busy
//     background) the answer is "we cannot tell" and NO framing advice is
//     given at all, which is the honest thing and never a dead end.
//
//  AND THE ONE THAT WAS NOT ABOUT THE CAMERA: after submit he sat on "Give us
//  a few seconds" (a backend bug, since fixed), his screen dimmed, and on
//  unlock the page reloaded and asked him to start over. Three fixes, §4 of
//  the brief: a `navigator.wakeLock` on every camera and processing screen
//  re-requested on `visibilitychange`; a router that rebuilds the whole UI
//  from `GET state` so a reload lands where the session actually is; and a
//  processing screen that tells the truth about elapsed time and, past 45 s,
//  says so and offers a re-poll that is not a restart.
//
// ── ROUND 4, 2026-09-09 — THE BACK FAILED ON PIXEL SIZE, AND ONLY THAT ────
// Session #4 on the owner's iPhone, measured off the upload itself:
//
//     uploaded back frame        900 × 1600, portrait
//     the card                   about half the frame width
//     the PDF417 band            417 × 43 px  →  1.85 px/module (226 modules)
//     sharpness                  1 065   (floor 420 — sharp)
//     exposure                   0.60    (fine)
//
// Sharp, well lit, correctly framed by round 3's rules, and undecodable. The
// decoder's floor measured through round 3's path was ≈ 2.05 px/module; his
// barcode was 1.85. Nothing about light or focus could have saved it. TWO
// CAUSES, both of them size:
//
//   (a) THE 1600 px LONG-EDGE DOWNSCALE. `MAX_EDGE` was applied to every
//       upload, so the picture the server got had already lost a third of its
//       linear resolution before anyone tried to read it. (The live decode
//       loop never used that path — it cropped from the raw video — but the
//       SERVER's copy did, and the server is the one that has to decode a
//       barcode this page failed to.)
//   (b) A CARD-SHAPED GUIDE THE CARD ONLY HALF FILLED. An ID-1 guide asks the
//       guest to fit a whole card; a whole card at arm's length is small, and
//       the barcode is 78 % of something small. The barcode is the only thing
//       on the back that matters, so the guide is now the BARCODE's shape.
//
// WHAT ROUND 4 CHANGES, in the order they multiply:
//   1. The camera is asked for 3840 × 2160 (falling back 1920 × 1080, then
//      bare), and every back-of-card decode crops the BAND — not the guide,
//      not the frame — out of the raw video at 1:1, upscaling ×2 only when the
//      band is under 600 px. The decoder never sees a resampled pixel again.
//   2. The back's guide is a 4:1 landscape band with the words "Fit the
//      barcode inside the box", a live indicator drawn on the band the
//      analyser actually found, and one target: 70 % of the guide's width.
//      Where the track reports a `zoom` capability the page ZOOMS to reach it
//      instead of asking the guest to move.
//   3. The DECODE IS THE ONLY GATE on the back. No heuristic shutter, no
//      "Take photo" button, no quality refusal. The uploaded `document_back`
//      is the exact crop the worker decoded, at native pixels, q 0.92.
//   4. The front's upload cap goes to 2400 px so the engine has a portrait
//      worth cropping.
//
// THE ARITHMETIC THAT MATTERS. 226 modules is the width of a compact AAMVA
// PDF417 (13 data columns), and it is what the owner's own frame says:
// 417 px ÷ 1.85 px/module = 225. Round 3's synthetic symbol was 205 modules
// wide, which is why its table reads slightly differently; the estimate this
// file reports is `band_w_px / 226` and it is named `px_per_module_est`
// because it is an estimate of a symbol whose column count we never decoded.
//
// WHAT RUNS ON THE DEVICE, AND NOTHING LEAVES IT:
//   · the frame analyser below (sharpness / glare / exposure / document box /
//     motion) — plain canvas arithmetic, no library, pure and unit-testable;
//   · PDF417 decoding, native or vendored-zxing, in a Worker;
//   · MediaPipe Face Landmarker, vendored under /vendor/mediapipe.
// The decoded barcode NEVER leaves the worker: `client_metrics` carries
// `barcode_decoded: true` and `barcode_bytes: <length>`, never the payload.
//
// THE CAPTURE CLIENT NEVER SETS A STATUS. It uploads media and asks. Only the
// engine's signed callback and an analyst write `idv_sessions.status`, which
// is why `submit` answers `In Progress` and this file's only job after that is
// to poll `GET status` and render whatever the server says.
//
// WHY THIS FILE HAS ITS OWN TRANSPORT AND DOES NOT USE HWIdv.get/post:
//   1. The capture API is authenticated by the session token IN THE PATH and
//      takes no `X-HW-Actor` header. Sending the console actor header from a
//      guest's phone would be sending an associate id to a surface that has no
//      use for it.
//   2. `POST media` is multipart/form-data with a Blob part. HWIdv.post
//      JSON-encodes its body, so it cannot carry an upload at all.
//   3. capture.html deliberately does not load shared/hw-live.js.
// The ONE place HWIdv is used is the pos-mode override, which IS a console
// route and DOES need the actor header. See consoleOverride() below.
//
// EXPORTS: window.IdvCapture plus five statics — `.api`, `.grab`, `.metrics`,
// `.geometry` and `.detectors`. They are on the component rather than in a
// second global because the seam file and a browser QA run both need them
// without re-deriving the URL shape or the guide box, and because a pure
// function that decides whether a shutter may fire must be checkable without a
// camera in the room.
;(function () {
  const useP = window.useP;

  // ── transport ────────────────────────────────────────────────────────────
  // Same never-reject contract as HWIdv.get/post (conventions checklist §9):
  // every call resolves to { ok, code, body, error }, so no caller in this file
  // needs a try/catch and no failure path can throw during a render.
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
  // ── UPLOAD SIZE IS PER KIND NOW, AND EACH NUMBER HAS A REASON ────────────
  // Round 3 used ONE cap for everything and it is the first half of the
  // owner's failure: a 1600 px long edge on a 900 × 1600 portrait upload left
  // his barcode 417 px wide, under the decoder's floor, before the server had
  // even opened the file.
  //
  //   MAX_EDGE        1600  selfies, selfie frames, the picker fallback and a
  //                         doctor's recommendation. Unchanged — none of these
  //                         is read at module scale.
  //   MAX_EDGE_FRONT  2400  §4 of the brief. The engine crops the portrait out
  //                         of this frame with a face detector; at 1600 the
  //                         portrait on a card filling half the guide is under
  //                         200 px and there is nothing to match against.
  //   NO_CAP                the back-of-card BAND crop, which is uploaded at
  //                         native pixels — see snapBack(). The band is a thin
  //                         strip (about 9.7 : 1), so native costs far less
  //                         than a capped whole frame did: a 2030 × 210 crop is
  //                         0.43 Mpx against 1600 × 900's 1.44 Mpx.
  //
  // The server's own ceiling is 8 MB an image (wmdemo/idv_media.py
  // MAX_IMAGE_BYTES). A native band strip at q 0.92 lands around 200–600 kB
  // and the 2400 px front around 0.6–1.2 MB, so neither goes near it.
  const MAX_EDGE = 1600;
  const MAX_EDGE_FRONT = 2400;
  const NO_CAP = Infinity;
  const JPEG_Q = 0.85;
  // The back crop is the only thing on this screen that is read at module
  // scale, and JPEG's chroma subsampling is exactly what smears a 2 px module.
  const JPEG_Q_BACK = 0.92;

  // EXIF-FREE BY CONSTRUCTION, not by stripping. A canvas holds pixels and
  // nothing else, so re-encoding through toBlob() cannot carry the source
  // frame's orientation tag, GPS tag or maker notes — there is no metadata to
  // strip because none ever existed.
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

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return clamp(v, 0, 1); }
  function round3(v) { return v == null ? null : Math.round(v * 1000) / 1000; }

  // ── geometry ─────────────────────────────────────────────────────────────
  // THE GUIDE RECTANGLE IS COMPUTED ONCE AND USED THREE TIMES — by the overlay
  // that draws it, by the analyser that measures inside it, and by the barcode
  // crop. In round 1 the overlay owned the box privately, so the quality
  // numbers were measured over the whole frame while the guest was being asked
  // to line the card up with a box that had nothing to do with them.
  //
  // `shape`: 'card' = ID-1 (85.6 × 53.98 mm, ratio 1.586); 'page' = a doctor's
  // recommendation, taller than wide; 'oval' = the face oval; 'band' = the
  // ROUND 4 barcode guide, a 4 : 1 landscape rectangle.
  //
  // WHY 'band' EXISTS AND WHY IT IS 4 : 1. The back of a licence is one
  // barcode and a lot of legal small print nobody reads. Round 3 drew an ID-1
  // card guide there, so the guest was asked to fit the whole card — and a
  // whole card at a comfortable distance puts its barcode at about a third of
  // the frame width, which is where the owner's 417 px came from. A guide
  // shaped like the thing that has to be read asks for the thing that has to
  // be read. 4 : 1 rather than the symbol's own ~9.7 : 1 because a box drawn
  // exactly the size of the barcode is a box no hand can fill: the extra
  // height is the tolerance, and the band indicator inside it is what reports
  // the real number.
  //
  // GUIDE_PAD IS 0.045, NOT ROUND 2's 0.09. The pad is the gutter between the
  // preview's edge and the guide, and every pixel of it is resolution the card
  // does not get. The owner's barcode was 449 px wide in a 1920 frame — the
  // card was occupying under a third of the picture. Halving the pad puts ~79 %
  // of the frame width inside the guide instead of ~71 %, and the guide is what
  // the guest fills.
  const GUIDE_PAD = 0.045;
  const BAND_ASPECT = 4;          // the barcode guide, width : height
  function guideBox(shape, w, h) {
    if (shape === 'oval') {
      const rx = Math.min(w * 0.34, h * 0.30), ry = rx * 1.32;
      return { oval: true, cx: w / 2, cy: h / 2, rx: rx, ry: ry,
        x: w / 2 - rx, y: h / 2 - ry, w: rx * 2, h: ry * 2 };
    }
    const pad = Math.min(w, h) * GUIDE_PAD;
    let bw = w - pad * 2;
    let bh = shape === 'page' ? bw * 1.294 : shape === 'band' ? bw / BAND_ASPECT : bw / 1.586;
    if (bh > h - pad * 2) {
      bh = h - pad * 2;
      bw = shape === 'page' ? bh / 1.294 : shape === 'band' ? bh * BAND_ASPECT : bh * 1.586;
    }
    return { oval: false, x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh,
      cx: w / 2, cy: h / 2, rx: bw / 2, ry: bh / 2 };
  }

  // `object-fit: cover` CROPS. The preview box and the camera frame almost
  // never share an aspect ratio, so a rectangle drawn at box coordinates does
  // NOT sit at the same fraction of the video's own pixels — on a 16:9 stream
  // in a 3:2 box roughly 16 % of the frame's width is off-screen entirely, and
  // on a PORTRAIT stream in the same box roughly 62 % of its HEIGHT is. Both
  // orientations are exercised by the synthetic-frame check in the QA run;
  // neither is assumed.
  //
  // `coverMap` is the one place the cover transform is written down. The two
  // conversions below are its forward and inverse, and `IdvCapture.geometry`
  // exports all three so the mapping can be checked with numbers rather than
  // with a camera.
  function coverMap(boxW, boxH, vw, vh) {
    if (!vw || !vh || !boxW || !boxH) return null;
    const scale = Math.max(boxW / vw, boxH / vh);
    const dw = vw * scale, dh = vh * scale;
    return { scale: scale, dw: dw, dh: dh, ox: (dw - boxW) / 2, oy: (dh - boxH) / 2 };
  }
  function boxRectToVideoNorm(rect, boxW, boxH, vw, vh) {
    const m = coverMap(boxW, boxH, vw, vh);
    if (!m) return null;
    return { x: (rect.x + m.ox) / m.dw, y: (rect.y + m.oy) / m.dh, w: rect.w / m.dw, h: rect.h / m.dh };
  }
  function videoNormToBox(pt, boxW, boxH, vw, vh) {
    const m = coverMap(boxW, boxH, vw, vh);
    if (!m) return null;
    return { x: pt.x * m.dw - m.ox, y: pt.y * m.dh - m.oy };
  }
  // Grow a normalised rect by `k` of its own size on every side, clamped to the
  // frame. Used for the barcode crop and for the document-box search window.
  function inflateNorm(rect, k) {
    const ix = rect.w * k, iy = rect.h * k;
    const x = clamp01(rect.x - ix), y = clamp01(rect.y - iy);
    return { x: x, y: y,
      w: clamp01(rect.x + rect.w + ix) - x,
      h: clamp01(rect.y + rect.h + iy) - y };
  }

  // THE ONE MEASUREMENT OF THE GUIDE, FROM getBoundingClientRect.
  // `clientWidth` is an integer and ignores CSS transforms; the preview box on
  // a phone is a fractional width inside a flex column and the page may be
  // pinch-zoomed. A half-pixel is nothing, but a transform is not, and the
  // overlay and the analyser have to agree to the pixel or the guest is asked
  // to fill a box we are not measuring. Both call THIS.
  function measureGuide(boxEl, video, shape) {
    if (!boxEl || !video) return null;
    const r = boxEl.getBoundingClientRect();
    const boxW = r.width, boxH = r.height;
    const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
    if (!boxW || !boxH || !vw || !vh) return null;
    const box = guideBox(shape, boxW, boxH);
    const rect = boxRectToVideoNorm(box, boxW, boxH, vw, vh);
    if (!rect) return null;
    return { box: box, rect: rect, boxW: boxW, boxH: boxH, vw: vw, vh: vh };
  }

  // ── the frame analyser ───────────────────────────────────────────────────
  // All of it on one 208-pixel working canvas, all before the shutter, and the
  // arithmetic itself is a PURE FUNCTION of a luma buffer — `analysePixels`.
  // That split is the whole reason round 3 can be checked at all: round 2's
  // measurements only existed inside a `getImageData` call, so the framing bug
  // the owner hit could not be reproduced without a phone, a licence and a
  // desk. Now it is `analysePixels(gray, w, h, rect)` with a synthetic buffer.
  //
  //   sharpness       variance of a 3×3 Laplacian over the guide region. HIGH
  //                   is sharp. A relative number, not a percentage.
  //   glare_fraction  fraction of pixels in the guide at or above SATURATED
  //                   luma. A licence under a downlight blows out exactly the
  //                   part the OCR needs, in a spot the guest cannot see.
  //   exposure        mean luma in the guide, 0..1.
  //   doc_box         THE DOCUMENT'S OWN BOUNDING BOX, found by edge
  //                   projection, in frame-normalised coordinates. See below.
  //   doc_fill        how much of the GUIDE the document covers, 0..1.
  //   doc_outside     how much of the DOCUMENT is outside the guide, 0..1.
  //   band_w          the width a barcode on that document would have, as a
  //                   fraction of the frame width — the number the "Move
  //                   closer" advice is made of.
  //   band_luma       mean luma over the lower half of the document box, where
  //                   the PDF417 lives on a US licence. The "More light" one.
  //   motion          mean absolute luma difference against the previous
  //                   analysed frame, inside the guide. The settle timer.
  //
  // WHY 208 PIXELS: a 3×3 Laplacian over a 1080-line frame costs more than the
  // frame is worth on a phone and answers the same question. 208 × 117 is about
  // 24 000 pixels — under a millisecond, comfortably inside an 80 ms tick.
  const ANALYSIS_EDGE = 208;
  const SATURATED = 246;     // luma at which a pixel is "blown", not "bright"
  const EDGE_T = 14;         // |∇luma| above which a pixel counts as an edge
  // A PDF417 on a US licence runs about 78 % of the card's width. That ratio is
  // how a document box becomes an expected barcode width without decoding
  // anything, which is what the pre-decode guidance needs.
  const BARCODE_OF_CARD = 0.78;

  // ── the document box ─────────────────────────────────────────────────────
  // ROUND 2 ASKED THE WRONG QUESTION. It asked "is there a straight edge lying
  // along each of the four lines I drew?" — which is a question about the
  // guest's aim, at a tolerance no hand can hold, and it answered "no" for a
  // card that filled the guide but sat 5° off. Round 3 asks "where IS the
  // document?" and compares the answer to the guide.
  //
  // Edge-energy projection profiles: sum the gradient magnitude down each
  // column and across each row of a search window, then take the outermost
  // column and row that clear a fraction of the profile's own peak. A document
  // is a rectangle of print on a plainer background, so its own extent is where
  // the profile rises and falls.
  //
  // AND IT KNOWS WHEN IT CANNOT TELL. On a busy background the profile never
  // falls away and the "document" found is simply the whole search window. That
  // is detected — the box touching all four walls — and reported as
  // `doc_box: null`, which means NO FRAMING ADVICE IS GIVEN AT ALL. Saying
  // nothing is the honest answer, and round 2's habit of guessing there is
  // exactly how "Fit the whole card in the frame" got stuck on a card that was
  // already in the frame.
  const DOC_SEARCH_INFLATE = 0.45;   // how far outside the guide to look
  const DOC_PROFILE_FRAC = 0.32;     // of the profile peak, to count as document

  function docBoxFrom(g, w, h, rect) {
    const sw = inflateNorm(rect, DOC_SEARCH_INFLATE);
    const sx0 = clamp(Math.round(sw.x * w), 1, w - 3);
    const sy0 = clamp(Math.round(sw.y * h), 1, h - 3);
    const sx1 = clamp(Math.round((sw.x + sw.w) * w), sx0 + 2, w - 1);
    const sy1 = clamp(Math.round((sw.y + sw.h) * h), sy0 + 2, h - 1);
    const cw = sx1 - sx0, ch = sy1 - sy0;
    if (cw < 6 || ch < 6) return null;

    const col = new Float32Array(cw), row = new Float32Array(ch);
    for (let y = sy0; y < sy1; y++) {
      for (let x = sx0; x < sx1; x++) {
        const i = y * w + x;
        const gx = Math.abs(g[i + 1] - g[i - 1]);
        const gy = Math.abs(g[i + w] - g[i - w]);
        if (gx + gy > EDGE_T) { col[x - sx0] += 1; row[y - sy0] += 1; }
      }
    }
    // A 3-tap box smooth. One noisy column of a tablecloth weave should not be
    // able to move a document's edge by itself.
    function smooth(a) {
      const o = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        const l = a[i - 1] == null ? a[i] : a[i - 1], r = a[i + 1] == null ? a[i] : a[i + 1];
        o[i] = (l + a[i] + r) / 3;
      }
      return o;
    }
    const cS = smooth(col), rS = smooth(row);
    function extent(a) {
      let peak = 0;
      for (let i = 0; i < a.length; i++) if (a[i] > peak) peak = a[i];
      if (peak < 1.5) return null;                       // nothing is there
      const t = peak * DOC_PROFILE_FRAC;
      let lo = -1, hi = -1;
      for (let i = 0; i < a.length; i++) if (a[i] >= t) { lo = i; break; }
      for (let i = a.length - 1; i >= 0; i--) if (a[i] >= t) { hi = i; break; }
      if (lo < 0 || hi <= lo) return null;
      return [lo, hi];
    }
    const ex = extent(cS), ey = extent(rS);
    if (!ex || !ey) return null;
    // THE "WE CANNOT TELL" CASE. If the extent runs wall to wall in BOTH axes
    // the profile never fell away and this is a background, not a document.
    const wallX = ex[0] <= 1 && ex[1] >= cw - 2;
    const wallY = ey[0] <= 1 && ey[1] >= ch - 2;
    if (wallX && wallY) return null;
    return { x: (sx0 + ex[0]) / w, y: (sy0 + ey[0]) / h,
      w: (ex[1] - ex[0] + 1) / w, h: (ey[1] - ey[0] + 1) / h };
  }

  function overlapArea(a, b) {
    const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    if (x1 <= x0 || y1 <= y0) return 0;
    return (x1 - x0) * (y1 - y0);
  }

  // PURE. `g` is a Float32Array of luma (0..255) in row-major w×h; `rect` is
  // the guide in frame-normalised coordinates; `prev` is the previous frame's
  // luma or null. Everything the gates read comes out of here.
  function analysePixels(g, w, h, rect, prev, srcW) {
    if (!g || !w || !h || !rect) return null;
    const rx0 = clamp(Math.round(rect.x * w), 1, w - 3);
    const ry0 = clamp(Math.round(rect.y * h), 1, h - 3);
    const rx1 = clamp(Math.round((rect.x + rect.w) * w), rx0 + 2, w - 1);
    const ry1 = clamp(Math.round((rect.y + rect.h) * h), ry0 + 2, h - 1);
    const rw = rx1 - rx0, rh = ry1 - ry0;

    let sum = 0, hot = 0, n = 0;
    let lapSum = 0, lapSq = 0, lapN = 0;
    let edgeIn = 0, edgeN = 0;
    let motion = 0, motionN = 0;
    const hasPrev = !!(prev && prev.length === g.length);

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

    const doc = docBoxFrom(g, w, h, rect);
    let docFill = null, docOutside = null, bandW = null, bandLuma = null;
    if (doc) {
      const inter = overlapArea(doc, rect);
      const guideArea = rect.w * rect.h, docArea = doc.w * doc.h;
      docFill = guideArea > 0 ? clamp01(inter / guideArea) : null;
      docOutside = docArea > 0 ? clamp01((docArea - inter) / docArea) : null;
      bandW = round3(doc.w * BARCODE_OF_CARD);
      // The lower half of the document box: where a US licence keeps its
      // PDF417. Averaged over that half rather than the whole card, because a
      // bright printed face and a dark barcode strip are different questions
      // and only one of them is the one the reader has to cope with.
      const bx0 = clamp(Math.round(doc.x * w), 0, w - 2);
      const bx1 = clamp(Math.round((doc.x + doc.w) * w), bx0 + 1, w - 1);
      const by0 = clamp(Math.round((doc.y + doc.h * 0.45) * h), 0, h - 2);
      const by1 = clamp(Math.round((doc.y + doc.h) * h), by0 + 1, h - 1);
      let bs = 0, bn = 0;
      for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) { bs += g[y * w + x]; bn++; }
      bandLuma = bn ? round3(bs / bn / 255) : null;
    }

    const density = edgeN ? edgeIn / edgeN : 0;
    const lapMean = lapN ? lapSum / lapN : 0;
    return {
      sharpness: lapN ? Math.round(((lapSq / lapN) - lapMean * lapMean) * 100) / 100 : null,
      glare_fraction: n ? Math.round((hot / n) * 10000) / 10000 : null,
      exposure: n ? round3(sum / n / 255) : null,
      doc_box: doc ? [round3(doc.x), round3(doc.y), round3(doc.w), round3(doc.h)] : null,
      doc_fill: round3(docFill),
      doc_outside: round3(docOutside),
      band_w: bandW,
      band_luma: bandLuma,
      edge_density: round3(density),
      motion: motionN ? Math.round((motion / motionN) * 100) / 100 : null,
      // Source pixels per analysis pixel. The sharpness threshold is derived
      // from it — see sharpnessFloor.
      resample: srcW ? Math.round(((rect.w * srcW) / Math.max(1, rw)) * 100) / 100 : null,
    };
  }

  function makeAnalyser() {
    const c = document.createElement('canvas');
    let ctx = null;
    try { ctx = c.getContext('2d', { willReadFrequently: true }); }
    catch (e) { ctx = c.getContext('2d'); }
    let prev = null;

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
      const out = analysePixels(g, w, h, rectNorm, prev, vw);
      prev = g;
      return out;
    }
    return { read: read, reset: function () { prev = null; } };
  }

  // ── the barcode band ─────────────────────────────────────────────────────
  // WHERE IS THE BARCODE, HOW WIDE IS IT, AND HOW DARK IS IT. Three questions,
  // one projection profile, and none of them is a gate — the decode is the
  // gate. These numbers only ever produce ADVICE and drive the zoom.
  //
  // WHY THIS IS NOT `docBoxFrom`. That function looks for a DOCUMENT: a
  // rectangle of print whose edges are where the gradient rises and falls, in
  // both axes, with a "we cannot tell" answer for a busy background. A PDF417
  // is not a document, it is a texture — hundreds of alternating bars per row —
  // and it announces itself in a way nothing else on a licence does: a ROW that
  // crosses a vertical edge every few pixels for its whole length.
  //
  // ROWS FIRST, AND THAT ORDERING IS A MEASUREMENT. The obvious way round —
  // count vertical-bar crossings down each COLUMN and take the outermost
  // columns above a threshold — was written first and measured wrong on the
  // very first synthetic frame: a card's own left and right EDGES are vertical
  // too, and a column sitting on one crosses at every row of the card, which is
  // several times the count of a column inside a barcode a fraction of the
  // card's height. The card edges won the peak, the threshold followed them,
  // and the "band" came back 750 px wide on a 562 px barcode — WIDER THAN THE
  // CARD. The advice would then have been about the card's size, which is
  // precisely round 3's defect in a new place.
  //
  // A ROW profile does not have that failure: a row through a card edge scores
  // 2, a row through printed text scores about a dozen, and a row through a
  // PDF417 scores a hundred. So the rows are found first, the columns are
  // counted only inside them, and the answer is the LONGEST CONTIGUOUS RUN of
  // columns rather than the outermost ones — because a card edge that survives
  // into the barcode's own rows is a run of two pixels with a quiet zone
  // between it and the symbol, and "outermost" would swallow the gap.
  //
  // AND IT IS MEASURED ON ITS OWN CANVAS, NOT THE 208 px ONE. At 208 px across
  // a 4 K frame a 6 px/module barcode is 0.3 px/module — every bar aliases into
  // its neighbour and the profile is noise. BAND_EDGE is 512, which puts the
  // same barcode at about 1.5 px/module: far too coarse to DECODE, which is
  // not what it is for, and easily textured enough to find. 512 × 128 is 65 000
  // pixels, about 2.5× the main analyser and still well inside a tick.
  const BAND_EDGE = 512;
  const BAND_PROFILE_FRAC = 0.35;   // of a profile's own peak, to count as band
  // A barcode ROW crosses a vertical edge across this much of the strip's width
  // at least. Set from the sweep: at a band filling 25 % of the guide the rows
  // score 12–20 % of the strip width, and printed text on the same card scores
  // about 2 %. 0.04 keeps a band that is still much too small to decode
  // findable — so the guest is told "Move closer" rather than the blanker
  // "Fit the barcode inside the box" — while staying well clear of print.
  const BAND_MIN_ROW_FRAC = 0.04;
  // A LONE BARCODE INSIDE A 4 : 1 GUIDE IS SHORT. At the 70 % target the band
  // is 0.70 × guideW wide and, at the symbol's ~9.7 : 1, 0.072 × guideW tall —
  // 29 % of the guide's own height. A "band" taller than 85 % of the guide is
  // therefore not a band; it is the whole card, or a tablecloth. Reported as
  // unknown, which produces "Fit the barcode inside the box" and no false
  // "Move closer" on a card that is already close.
  const BAND_MAX_H_FRAC = 0.85;
  // 226 modules is a compact AAMVA PDF417 (13 data columns). See the round-4
  // header: the owner's own frame divides out at 225.
  const PDF417_MODULES = 226;

  function smooth5(a) {
    const o = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < a.length) { s += a[j]; n++; } }
      o[i] = s / n;
    }
    return o;
  }
  // THE LONGEST CONTIGUOUS RUN above `t`, tolerating gaps of up to `gap`. The
  // tolerance is what makes it usable on a real profile: a barcode's own wide
  // bars leave columns that dip under the threshold, and a run finder with no
  // tolerance would return one bar.
  function longestRun(a, t, gap) {
    let best = null, start = -1, lastOn = -1;
    function close() {
      if (start < 0) return;
      if (!best || (lastOn - start) > (best[1] - best[0])) best = [start, lastOn];
      start = -1;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] >= t) { if (start < 0) start = i; lastOn = i; }
      else if (start >= 0 && (i - lastOn) > gap) close();
    }
    close();
    return best;
  }
  function peakOf(a) {
    let p = 0;
    for (let i = 0; i < a.length; i++) if (a[i] > p) p = a[i];
    return p;
  }

  // PURE. `g` is luma over the GUIDE STRIP ONLY (w × h), so every fraction it
  // returns is a fraction OF THE GUIDE, which is the number the 70 % target and
  // the zoom are both written in. Returns null when there is no band to speak
  // of, and null is a real answer, not a failure.
  function bandProfile(g, w, h) {
    if (!g || w < 16 || h < 6) return null;
    function cross(i) { return Math.abs(g[i + 1] - g[i - 1]) > EDGE_T; }

    // 1. THE ROWS. See the long note above for why this axis comes first.
    const row = new Float32Array(h);
    for (let y = 1; y < h - 1; y++) {
      let n = 0;
      for (let x = 1; x < w - 1; x++) if (cross(y * w + x)) n++;
      row[y] = n;
    }
    const rS = smooth5(row);
    const rpeak = peakOf(rS);
    if (rpeak < w * BAND_MIN_ROW_FRAC) return null;    // nothing barcode-like
    const ey = longestRun(rS, rpeak * BAND_PROFILE_FRAC, Math.max(1, Math.round(h * 0.03)));
    if (!ey || ey[1] - ey[0] < 2) return null;
    const bh = (ey[1] - ey[0] + 1) / h;
    if (bh > BAND_MAX_H_FRAC) return null;             // not a band: a whole card

    // 2. THE COLUMNS, counted only inside those rows.
    const col = new Float32Array(w);
    for (let y = Math.max(1, ey[0]); y <= Math.min(h - 2, ey[1]); y++) {
      for (let x = 1; x < w - 1; x++) if (cross(y * w + x)) col[x] += 1;
    }
    const cS = smooth5(col);
    const cpeak = peakOf(cS);
    if (cpeak < 1.5) return null;
    const ex = longestRun(cS, cpeak * BAND_PROFILE_FRAC, Math.max(2, Math.round(w * 0.02)));
    if (!ex || ex[1] - ex[0] < 8) return null;

    let sum = 0, n = 0;
    for (let y = ey[0]; y <= ey[1]; y++) {
      for (let x = ex[0]; x <= ex[1]; x++) { sum += g[y * w + x]; n++; }
    }
    return {
      x: ex[0] / w, y: ey[0] / h,
      w: (ex[1] - ex[0] + 1) / w, h: bh,
      frac: (ex[1] - ex[0] + 1) / w,       // of the GUIDE's width — the target
      luma: n ? (sum / n) / 255 : null,
    };
  }

  // The canvas half. Draws the GUIDE REGION of the raw video into a strip at
  // most BAND_EDGE wide, profiles it, and translates the answer back into two
  // coordinate systems the callers need:
  //   `norm`  the band in FRAME-normalised coordinates, which is what the crop
  //           and the on-screen indicator are both built from;
  //   `w_px`  the band's width in SOURCE pixels, which is the only number that
  //           says whether a decode is even possible.
  function makeBandAnalyser() {
    const c = document.createElement('canvas');
    let ctx = null;
    try { ctx = c.getContext('2d', { willReadFrequently: true }); }
    catch (e) { ctx = c.getContext('2d'); }

    function read(video, rectNorm) {
      if (!ctx || !video || !rectNorm) return null;
      const vw = video.videoWidth || 0, vh = video.videoHeight || 0;
      if (!vw || !vh) return null;
      const sx = clamp(Math.floor(rectNorm.x * vw), 0, vw - 2);
      const sy = clamp(Math.floor(rectNorm.y * vh), 0, vh - 2);
      const sw = clamp(Math.round(rectNorm.w * vw), 2, vw - sx);
      const sh = clamp(Math.round(rectNorm.h * vh), 2, vh - sy);
      const k = Math.min(1, BAND_EDGE / sw);
      const w = Math.max(16, Math.round(sw * k)), h = Math.max(6, Math.round(sh * k));
      c.width = w; c.height = h;
      try { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h); } catch (e) { return null; }
      let px;
      try { px = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; }
      const g = new Float32Array(w * h);
      for (let i = 0, p = 0; i < g.length; i++, p += 4) {
        g[i] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
      }
      const b = bandProfile(g, w, h);
      if (!b) return { band_frac: null, band_luma: null, band_w_px: null, band_norm: null };
      return {
        band_frac: round3(b.frac),
        band_luma: round3(b.luma),
        band_w_px: Math.round(b.w * sw),
        px_per_module_est: round3((b.w * sw) / PDF417_MODULES),
        // Frame-normalised, so it survives every later mapping unchanged.
        band_norm: { x: (sx + b.x * sw) / vw, y: (sy + b.y * sh) / vh,
          w: (b.w * sw) / vw, h: (b.h * sh) / vh },
      };
    }
    return { read: read };
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
      exposure: round3(sum / (w * h) / 255),
    };
  }

  // ── the gates ────────────────────────────────────────────────────────────
  // PURE. Metrics in, { pass, hint, gates } out — so every threshold in this
  // file is testable from Node with a literal object and no camera.
  //
  // ONE SENTENCE AT A TIME, IN THE ORDER A PERSON CAN ACT ON IT: light first
  // (nothing else is measurable in the dark), then glare (which the guest fixes
  // by moving, not by aiming), then framing, then focus, then stillness.
  const GATE = {
    SHARP_BASE: 420,         // Laplacian variance on the 208 px canvas
    GLARE_MAX: 0.01,         // < 1 % of the guide may be blown
    EXPOSURE_MIN: 0.20,
    EXPOSURE_MAX: 0.92,
    DOC_FILL_MIN: 0.62,      // of the guide, covered by the document
    DOC_OUTSIDE_MAX: 0.22,   // of the document, outside the guide
    DENSITY_LOW: 0.03,       // below this there is nothing in the guide at all
    MOTION_MAX: 3.2,
    STEADY_MS: 400,
    // ── the back-of-licence advice thresholds, ROUND 4 ──
    // BAND_FILL_MIN is a fraction OF THE 4 : 1 GUIDE, not of the frame, and it
    // is the whole design. On a 2160-wide portrait stream the band guide is
    // ~0.94 of the frame width, so 70 % of it is ~1420 source pixels — 6.3
    // px/module against a decoder floor near 2.0. Even on a 1080-wide fallback
    // it is ~710 px, 3.1 px/module. The owner's failing frame was 417 px.
    BAND_FILL_MIN: 0.70,
    // 70/255. The brief's number, and it is deliberately far below the old
    // 0.20-of-frame exposure rule: round 3 measured that zxing's LocalAverage
    // binarizer normalises a 0.42× exposure away entirely, so "More light" is
    // only worth saying when the band is genuinely near-black.
    BAND_DARK: 0.275,
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
  //     source        resample   sharp frame   8 px defocus
  //     640 × 360       3.08        5 542          213
  //     1280 × 720      6.16        8 555          222
  //     1920 × 1080     9.24        7 780          220
  //
  // A DEFOCUSED frame reads the same at every resolution (~220) — the blur, not
  // the sampling, sets it. A SHARP frame is about 35 % lower at 640 than at
  // 1280, and flat above that. So the only correction the data supports is a
  // modest one at the LOW-resolution end. Hence 1.0 from 1280 up, easing to
  // 0.62 for a 640-line webcam.
  //
  // `relax` is the anti-dead-end: a step open for a while without firing
  // loosens focus and stillness rather than trapping a guest in front of a
  // frame that will never pass. It never loosens glare or exposure.
  function sharpnessFloor(m, relax) {
    const r = (m && m.resample) || 6;
    return GATE.SHARP_BASE * clamp(r / 6.16, 0.62, 1) * (relax == null ? 1 : relax);
  }

  // FOCUS IS CHECKED BEFORE FRAMING, AND THAT ORDER IS A MEASUREMENT TOO. A
  // blurred frame smears edge energy evenly across the whole picture, so the
  // framing numbers stop meaning anything — an 8 px defocus at 640 × 360 filled
  // every projection profile wall to wall. Framing advice is only trustworthy
  // once the frame is sharp enough to see an edge, so focus is asked first.
  //
  // AND FRAMING CANNOT REFUSE A FRAME IT COULD NOT MEASURE. `doc_box: null`
  // means the analyser could not separate the document from its background;
  // `fill` then passes on edge density alone and NO framing sentence is
  // produced. That is the round-2 defect, inverted: the old code guessed, this
  // one declines to.
  function docGate(m, relax, opts) {
    if (!m) return { pass: false, hint: null, gates: {} };
    const o = opts || {};
    const known = m.doc_box != null && m.doc_fill != null;
    const framed = !known
      ? (m.edge_density != null && m.edge_density >= GATE.DENSITY_LOW)
      : (m.doc_fill >= GATE.DOC_FILL_MIN
        && (o.ignoreOutside || m.doc_outside == null || m.doc_outside <= GATE.DOC_OUTSIDE_MAX));
    const gates = {
      light: m.exposure != null && m.exposure >= GATE.EXPOSURE_MIN && m.exposure <= GATE.EXPOSURE_MAX,
      glare: m.glare_fraction != null && m.glare_fraction < GATE.GLARE_MAX,
      focus: m.sharpness != null && m.sharpness >= sharpnessFloor(m, relax),
      fill: framed,
      still: m.motion != null && m.motion <= GATE.MOTION_MAX * (relax == null ? 1 : (2 - relax)),
    };
    let hint = null;
    if (!gates.light) hint = (m.exposure != null && m.exposure > GATE.EXPOSURE_MAX)
      ? 'Too bright — move out of the direct light'
      : 'More light';
    else if (!gates.glare) hint = 'Tilt the card away from the light';
    else if (!gates.focus) hint = 'Hold still';
    else if (!gates.fill) {
      // TWO WAYS TO FAIL FRAMING AND THEY NEED OPPOSITE ADVICE — and this is
      // the branch the owner watched get it wrong for five minutes. It is now
      // answered by WHERE THE DOCUMENT IS, not by how much edge energy happens
      // to be outside a box. `doc_outside` high means the card genuinely hangs
      // over the guide; `doc_fill` low means it is genuinely small. When
      // neither is known the analyser says nothing at all.
      if (!known) hint = 'Lay the card inside the frame';
      else if (m.doc_outside != null && m.doc_outside > GATE.DOC_OUTSIDE_MAX) hint = 'Fit the whole card in the frame';
      else hint = 'Move closer';
    } else if (!gates.still) hint = 'Hold still';
    return { pass: gates.light && gates.glare && gates.focus && gates.fill && gates.still,
      hint: hint, gates: gates };
  }

  // THE BACK OF A LICENCE IS A DIFFERENT QUESTION AND GETS DIFFERENT WORDS.
  // Nothing here is a gate — the DECODE is the gate — so this returns advice
  // only, in the order the brief sets: width, then light, then stillness.
  // Exposure is deliberately NOT allowed to lead: measured against the
  // vendored decoder, a frame at 0.42× exposure decoded identically to one at
  // 1.0× at every barcode width, so telling a guest their picture is too dark
  // while the decoder is perfectly happy is telling them to fix the wrong
  // thing.
  //
  // FOUR SENTENCES AND NOT ONE MORE, and the first of them is the honest
  // "we cannot see a barcode at all":
  //   band unknown          'Fit the barcode inside the box'
  //   band < 70 % of guide  'Move closer'   — unless the page ZOOMED instead,
  //                          in which case the guest is told to hold still,
  //                          because they have nothing left to do
  //   band mean luma < 0.275 'More light'
  //   otherwise              'Hold still'
  // `zoomed` is passed in by the step, not measured here, so this stays a pure
  // function of an object.
  function barcodeHint(m, zoomed) {
    if (!m) return 'Fit the barcode inside the box';
    if (m.band_frac == null) return 'Fit the barcode inside the box';
    if (m.band_frac < GATE.BAND_FILL_MIN) return zoomed ? 'Hold still' : 'Move closer';
    if (m.band_luma != null && m.band_luma < GATE.BAND_DARK) return 'More light';
    return 'Hold still';
  }
  // "IS THE BAND DARK ENOUGH TO EARN THE TORCH." Separate from the hint on
  // purpose: the torch should come on the moment the band is dark, including
  // while the guest is still being told to move closer, and the hint can only
  // say one thing at a time.
  function bandIsDark(m) {
    return !!(m && m.band_luma != null && m.band_luma < GATE.BAND_DARK);
  }
  // THE ZOOM THE BAND WANTS, or null when there is nothing to do or nothing to
  // do it with. PURE, and it is the only place the zoom arithmetic lives, so
  // "does this device even have a zoom" is answered with numbers rather than
  // with a phone.
  //
  //   caps     the track's `getCapabilities().zoom` — { min, max, step } — or
  //            anything falsy, which means this device has no zoom and the
  //            answer is null and the guest is asked to move instead;
  //   current  the track's `getSettings().zoom`, defaulting to caps.min or 1;
  //   frac     the band's width as a fraction of the guide.
  //
  // The target is BAND_FILL_MIN plus a small margin, because zooming to
  // exactly the threshold leaves the band oscillating across it as the hand
  // moves. Capped at the device's own max, and refused when the change is
  // under 8 % — a zoom that moves nothing costs an applyConstraints round trip
  // and a visible lens hunt for no gain.
  const ZOOM_TARGET = GATE.BAND_FILL_MIN + 0.08;
  const ZOOM_MIN_STEP = 1.08;
  const ZOOM_MAX_FACTOR = 4;
  function zoomFor(caps, current, frac) {
    if (!caps || caps.max == null || caps.min == null) return null;
    if (frac == null || frac <= 0 || frac >= GATE.BAND_FILL_MIN) return null;
    const now = current == null ? (caps.min || 1) : current;
    if (!(now > 0)) return null;
    const wantRaw = now * (ZOOM_TARGET / frac);
    const want = clamp(Math.min(wantRaw, now * ZOOM_MAX_FACTOR), caps.min, caps.max);
    if (!(want > now * ZOOM_MIN_STEP)) return null;
    return Math.round(want * 100) / 100;
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
    else if (m.faces > 1) hint = 'Only one face, please';
    else if (!gates.light) hint = (m.exposure != null && m.exposure > GATE.EXPOSURE_MAX)
      ? 'Too bright — move out of the direct light' : 'More light';
    else if (m.face_fill != null && m.face_fill < GATE.FACE_FILL_MIN) hint = 'Come a little closer';
    else if (m.face_fill != null && m.face_fill > GATE.FACE_FILL_MAX) hint = 'Move back a little';
    else if (!gates.centre) hint = 'Centre your face';
    else if (!gates.focus || !gates.still) hint = 'Hold still';
    return { pass: gates.light && gates.glare && gates.one && gates.fill && gates.centre && gates.focus && gates.still,
      hint: hint, gates: gates };
  }

  // BOTH VOCABULARIES ON EVERY UPLOAD, DELIBERATELY. The contract's
  // `client_metrics` names are `{blur, glare, face_box}`; this rebuild measures
  // more things and names each for what it actually is. Sending only the new
  // names would silently blind whatever already reads the old three, and
  // renaming a field in a contract other people implement against is not a
  // screen file's call. Additive, never a rename. `client_metrics` is a free
  // JSON column on `idv_media` (contract addendum 2026-09-08 §C), so the new
  // keys land without a migration.
  //
  // `detector` is the honest label for WHICH thing decided the shutter could
  // fire: 'zxing' or 'barcode' (the native BarcodeDetector) when a PDF417
  // decoded, 'mediapipe' when the vendored face model gated the frame,
  // 'heuristic' when only the canvas arithmetic in this file did.
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
      // `card_fill` is kept as the contract-facing name for the framing number
      // so a reader that learned it in round 2 still finds it; `doc_fill` and
      // `doc_outside` are what it is actually made of now.
      card_fill: s.doc_fill == null ? null : s.doc_fill,
      doc_fill: s.doc_fill == null ? null : s.doc_fill,
      doc_outside: s.doc_outside == null ? null : s.doc_outside,
      doc_box: s.doc_box || null,
      band_w: s.band_w == null ? null : s.band_w,
      // ── ROUND 4: THE FOUR NUMBERS THAT WOULD HAVE DIAGNOSED SESSION #4 ──
      // `band_w` above is round 3's advisory "a barcode on that document box
      // would be this wide", a fraction of the FRAME, inferred and never
      // measured. These are measured, and they are what an analyst needs:
      //   band_w_px          the band's width in SOURCE pixels
      //   px_per_module_est  band_w_px / 226 — the number that was 1.85
      //   band_frac          the band as a fraction of the guide, the target
      //   decode_ms          what the worker took on the frame that decoded
      //   capture_w/h        what the camera actually gave us, which is not
      //                      always what we asked it for
      band_w_px: s.band_w_px == null ? null : s.band_w_px,
      px_per_module_est: s.px_per_module_est == null ? null : s.px_per_module_est,
      band_frac: s.band_frac == null ? null : s.band_frac,
      band_luma: s.band_luma == null ? null : s.band_luma,
      decode_ms: s.decode_ms == null ? null : s.decode_ms,
      capture_w: s.capture_w == null ? null : s.capture_w,
      capture_h: s.capture_h == null ? null : s.capture_h,
      zoom: s.zoom == null ? null : s.zoom,
      torch: s.torch == null ? null : !!s.torch,
      face_fill: s.face_fill == null ? null : s.face_fill,
      detector: s.detector || fallbackDetector || 'heuristic',
      // THE DECODE, AND NEVER THE PAYLOAD. `barcode_bytes` is the LENGTH of the
      // decoded byte string. The string itself carries the guest's name,
      // address and date of birth; the server reads those from the image under
      // the purpose limits in the Terms, and this page keeps only the fact that
      // it decoded and how much of it there was.
      barcode_decoded: !!s.barcode_decoded,
      barcode_bytes: s.barcode_bytes == null ? null : s.barcode_bytes,
      // TRUE ONLY WHEN THE GUEST PRESSED THE ESCAPE HATCH OR TAPPED THE
      // PREVIEW. `detector` says which measurement was AVAILABLE; this says
      // whether it was allowed to decide.
      manual: !!s.manual,
      // TRUE when the gates never agreed and the loop snapped the sharpest
      // recent frame anyway rather than leaving the guest in front of a camera
      // that would never fire. Distinct from `manual`: nobody pressed anything.
      forced: !!s.forced,
    }, extra || {});
  }

  // ── the PDF417 reader ────────────────────────────────────────────────────
  // The back of a US licence IS a PDF417. When the browser can decode one the
  // whole quality question collapses: a barcode that decodes is a frame good
  // enough to read, and nothing else needs to be true. Apple Wallet's ID scan
  // behaves exactly this way, and it is why that flow feels instant.
  //
  // ROUND 2 HAD THIS AND THE OWNER NEVER SAW IT. It used `BarcodeDetector`
  // alone. Safari does not implement `BarcodeDetector` — not on iOS, not on
  // macOS — so on the phone he tested with, the auto-snap path did not exist
  // and he spent five minutes fighting a heuristic that was never meant to be
  // the primary. Round 3 keeps the native detector where it genuinely supports
  // pdf417 (Chrome on Android and ChromeOS) and vendors zxing-wasm for
  // everywhere else, which is most guests.
  //
  // THREE IMPLEMENTATIONS, ONE INTERFACE:
  //   'barcode'  window.BarcodeDetector, only when getSupportedFormats()
  //              actually lists pdf417 — AND ONLY WHILE IT KEEPS DECODING. See
  //              NATIVE_MISS_LIMIT below; this one lied on the very browser
  //              this was verified in.
  //   'zxing'    vendor/zxing/hw-pdf417.js in a Worker. Measured in-browser on
  //              a 1920×1080 frame: 1.7 ms to draw the crop and 3.4 ms to read
  //              its pixels on the main thread, then 43–98 ms of wasm in the
  //              worker. The main thread pays about 5 ms per attempt, which is
  //              why the settle ring stays smooth.
  //   'zxing'    the same wasm on the main thread, if Worker construction or
  //   (main)     the worker's own boot fails (a locked-down browser, a CSP
  //              that forbids worker-src). Slower and jankier, but a guest
  //              whose browser refuses Workers still gets a barcode read.
  const ZX_BOOT_MS = 9000;       // worker has this long to answer 'ready'

  // ── WHAT ROUND 3 CROPPED, AND WHY ROUND 4 DOES NOT ───────────────────────
  // Round 3 handed the decoder the GUIDE, inflated 22 %. That inflation was a
  // correctness rule and it was measured: on synthetic 1920×1080 frames
  // carrying a real 294-byte AAMVA payload, a crop tight to round 2's guide
  // DECAPITATED the symbol at 700 and 820 px wide — the top and bottom rows
  // sheared off a barcode that was otherwise perfect — while +22 % read every
  // width from 449 px up.
  //
  //     barcode width   guide crop   guide+10%   guide+22%   full frame
  //        449 px          OK           OK          OK           OK
  //        560 px          OK           OK          OK           OK
  //        700 px          —            OK          OK           OK
  //        820 px          —            —           OK           OK
  //
  // The rule survives into round 4 (see BAND_PAD_Y); the FUNCTION does not.
  // Round 4 crops the BAND — measured on this frame, by the projection profile
  // — rather than the guide, so `cropForDecode` and its ±22 % have been
  // deleted rather than left sitting next to the thing that replaced them.
  // `bandCropPlan` is above, it is pure, and it is checkable from Node.
  //
  // ONE MEASUREMENT FROM ROUND 3 IS LOAD-BEARING AND IS KEPT HERE: UPSCALING
  // BUYS NOTHING. At 1.76 px/module the 2× crop failed exactly as the 1× crop
  // did, for 2–3.5× the time; the floor is the optics, not the sampling. The
  // brief's "upscale ×2 under 600 px" is therefore not a quality trick — it
  // lifts a SMALL crop (a 640×480 webcam) above zxing's own thresholds, and it
  // is the only reason BAND_UPSCALE exists.

  function imageDataOf(crop) {
    try { return crop.ctx.getImageData(0, 0, crop.canvas.width, crop.canvas.height); }
    catch (e) { return null; }
  }

  // ── ROUND 4: THE BAND CROP ───────────────────────────────────────────────
  // THE DECODER IS HANDED THE BARCODE AND NOTHING ELSE, AT 1 : 1. Round 3
  // cropped the GUIDE — on the round-4 band guide that is a 2030 × 508 strip,
  // 1.0 Mpx, most of it card. The band itself is about 9.7 : 1, so the same
  // barcode arrives as a 2030 × 210 strip: 0.43 Mpx, less than half the work,
  // and every pixel of it is symbol.
  //
  // THE PADS ARE NOT SYMMETRIC AND THAT IS THE POINT. Round 3 measured that a
  // crop tight to the guide DECAPITATED the symbol at 700 and 820 px wide —
  // the top and bottom rows sheared off a symbol that was otherwise perfect.
  // A PDF417 also requires a quiet zone of two modules on every side. So the
  // vertical pad is generous (35 % of the band's own height, which at 9.7 : 1
  // is only 3.6 % of its width) and the horizontal one is 6 %, comfortably
  // more than two modules at any width worth decoding.
  //
  // AND THE UPSCALE IS THE BRIEF'S, WITH ROUND 3's CAVEAT INTACT: ×2 under
  // 600 px, nearest-neighbour, and it buys NO accuracy — round 3 measured a
  // 1.76 px/module symbol failing identically at 1× and 2×. It exists so a
  // small crop off a 640 × 480 webcam clears zxing's own internal thresholds,
  // not to rescue an under-sampled barcode. Nothing here ever scales DOWN.
  const BAND_PAD_X = 0.06;             // of the band's own width
  const BAND_PAD_Y = 0.35;             // of the band's own height
  const BAND_UPSCALE_UNDER_PX = 600;   // brief §1
  const BAND_UPSCALE = 2;

  // PURE. `rect` is frame-normalised; returns the source rectangle in device
  // pixels plus the canvas size to draw it into. No canvas, no video, so the
  // "does it keep native pixels" question is answerable from Node.
  function bandCropPlan(rect, vw, vh, padX, padY) {
    if (!rect || !vw || !vh) return null;
    const px = padX == null ? BAND_PAD_X : padX;
    const py = padY == null ? BAND_PAD_Y : padY;
    const r = { x: rect.x - rect.w * px, y: rect.y - rect.h * py,
      w: rect.w * (1 + px * 2), h: rect.h * (1 + py * 2) };
    const sx = clamp(Math.floor(r.x * vw), 0, vw - 2);
    const sy = clamp(Math.floor(r.y * vh), 0, vh - 2);
    const sw = clamp(Math.round(r.w * vw), 8, vw - sx);
    const sh = clamp(Math.round(r.h * vh), 4, vh - sy);
    const up = sw < BAND_UPSCALE_UNDER_PX ? BAND_UPSCALE : 1;
    return { sx: sx, sy: sy, sw: sw, sh: sh, up: up,
      w: Math.round(sw * up), h: Math.round(sh * up), vw: vw, vh: vh };
  }

  function cropFromPlan(video, plan) {
    if (!plan) return null;
    const c = document.createElement('canvas');
    c.width = plan.w; c.height = plan.h;
    let ctx = null;
    try { ctx = c.getContext('2d', { willReadFrequently: true }); }
    catch (e) { ctx = c.getContext('2d'); }
    if (!ctx) return null;
    // Nearest-neighbour, for the reason round 3 wrote down: a smoothed upscale
    // invents grey where the binarizer wants a decision.
    ctx.imageSmoothingEnabled = false;
    if ('mozImageSmoothingEnabled' in ctx) ctx.mozImageSmoothingEnabled = false;
    if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
    try { ctx.drawImage(video, plan.sx, plan.sy, plan.sw, plan.sh, 0, 0, plan.w, plan.h); }
    catch (e) { return null; }
    return { canvas: c, ctx: ctx, plan: plan,
      sx: plan.sx, sy: plan.sy, sw: plan.sw, sh: plan.sh, up: plan.up,
      vw: plan.vw, vh: plan.vh };
  }

  // ── native ──
  function makeNativeReader() {
    const BD = window.BarcodeDetector;
    if (!BD || typeof BD.getSupportedFormats !== 'function') return null;
    let det = null;
    const ready = BD.getSupportedFormats().then(function (formats) {
      if (!formats || formats.indexOf('pdf417') < 0) return false;
      try { det = new BD({ formats: ['pdf417'] }); } catch (e) { return false; }
      return true;
    }, function () { return false; });
    return {
      kind: 'barcode',
      ready: ready,
      scan: function (crop) {
        if (!det || !crop) return Promise.resolve(null);
        const t0 = Date.now();
        return det.detect(crop.canvas).then(function (codes) {
          const c = codes && codes.length ? codes[0] : null;
          if (!c || !c.rawValue) return null;
          // THE DECODED STRING NEVER LEAVES THIS EXPRESSION. Its length is the
          // only thing that survives the statement.
          let bytes = 0;
          try { bytes = new TextEncoder().encode(c.rawValue).length; }
          catch (e) { bytes = String(c.rawValue).length; }
          return { bytes: bytes, quad: c.cornerPoints || null, ms: Date.now() - t0 };
        }, function () { return null; });
      },
      close: function () { det = null; },
    };
  }

  // ── zxing, worker first ──
  let zxSingleton = null;
  let zxMainBoot = null;
  function zxUrl(file) { return new URL('vendor/zxing/' + file, document.baseURI).href; }

  function zxingMainThread() {
    if (zxMainBoot) return zxMainBoot;
    zxMainBoot = new Promise(function (resolve) {
      function boot() {
        const Z = window.ZXingWASM;
        if (!Z || typeof Z.prepareZXingModule !== 'function') { resolve(false); return; }
        fetch(zxUrl('zxing_reader.wasm'), { cache: 'force-cache', credentials: 'omit' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
          .then(function (bin) { return Z.prepareZXingModule({ overrides: { wasmBinary: bin }, fireImmediately: true }); })
          .then(function () { resolve(true); }, function () { resolve(false); });
      }
      if (window.ZXingWASM) { boot(); return; }
      try {
        const s = document.createElement('script');
        s.src = zxUrl('zxing-reader.js');
        s.onload = boot;
        s.onerror = function () { resolve(false); };
        document.head.appendChild(s);
      } catch (e) { resolve(false); }
    });
    return zxMainBoot;
  }

  const ZX_OPTS_MAIN = { formats: ['PDF417'], tryHarder: true, tryRotate: true, tryInvert: false,
    tryDownscale: false, maxNumberOfSymbols: 1, binarizer: 'LocalAverage', textMode: 'Plain' };

  function makeZxingReader() {
    if (zxSingleton) return zxSingleton;
    let worker = null, via = null, seq = 0, dead = false;
    const pending = {};

    const ready = new Promise(function (resolve) {
      let settled = false;
      function fallback() {
        if (settled) return;
        zxingMainThread().then(function (ok) {
          if (settled) return;
          settled = true; via = ok ? 'main' : null; resolve(ok);
        });
      }
      let w = null;
      try { w = new Worker(zxUrl('hw-pdf417.js')); } catch (e) { w = null; }
      if (!w) { fallback(); return; }
      const giveUp = setTimeout(function () {
        try { w.terminate(); } catch (e) {}
        fallback();
      }, ZX_BOOT_MS);
      w.onmessage = function (ev) {
        const m = ev.data || {};
        if (m.type === 'ready') {
          clearTimeout(giveUp);
          if (settled) { try { w.terminate(); } catch (e) {} return; }
          settled = true; worker = w; via = 'worker'; resolve(true);
          return;
        }
        if (m.type === 'failed') {
          clearTimeout(giveUp);
          try { w.terminate(); } catch (e) {}
          fallback();
          return;
        }
        if (m.type === 'result') {
          const cb = pending[m.id];
          if (cb) { delete pending[m.id]; cb(m); }
        }
      };
      w.onerror = function () {
        clearTimeout(giveUp);
        try { w.terminate(); } catch (e) {}
        fallback();
      };
      try { w.postMessage({ type: 'init', wasmUrl: zxUrl('zxing_reader.wasm') }); }
      catch (e) { clearTimeout(giveUp); fallback(); }
    });

    zxSingleton = {
      kind: 'zxing',
      ready: ready,
      via: function () { return via; },
      scan: function (crop) {
        if (dead || !crop) return Promise.resolve(null);
        const img = imageDataOf(crop);
        if (!img) return Promise.resolve(null);
        if (worker) {
          const id = ++seq;
          return new Promise(function (resolve) {
            // A DEADLINE, BECAUSE A LOST MESSAGE MUST NOT WEDGE THE LOOP. If a
            // worker reply never lands, this resolves null and the next tick
            // goes ahead; without it one dropped message stops the back of the
            // licence for good, which is precisely the failure being fixed.
            const t = setTimeout(function () { delete pending[id]; resolve(null); }, 4000);
            pending[id] = function (m) {
              clearTimeout(t);
              resolve(m && m.hit ? { bytes: m.bytes, quad: m.quad, ms: m.ms } : null);
            };
            try {
              worker.postMessage({ type: 'scan', id: id, buf: img.data.buffer,
                w: img.width, h: img.height }, [img.data.buffer]);
            } catch (e) { clearTimeout(t); delete pending[id]; resolve(null); }
          });
        }
        const Z = window.ZXingWASM;
        if (!Z || typeof Z.readBarcodes !== 'function') return Promise.resolve(null);
        const t0 = Date.now();
        return Z.readBarcodes(img, ZX_OPTS_MAIN).then(function (res) {
          const r = res && res.length ? res[0] : null;
          if (!r || !r.bytes || !r.bytes.length) return null;
          const p = r.position || null;
          return { bytes: r.bytes.length, ms: Date.now() - t0,
            quad: p ? [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft] : null };
        }, function () { return null; });
      },
      close: function () { dead = true; },
    };
    return zxSingleton;
  }

  // THE 1.1 MB HEAD START. Kicked off the moment the flow knows a
  // `document_back` step exists, so the wasm downloads and compiles while the
  // guest reads the consent line and photographs the front — by the time the
  // back is on screen it is warm. Same reasoning as the face model's head
  // start, and the same consequence if it fails: the step still works, it just
  // works the slow way.
  let barcodeLoadStarted = false;
  function startBarcodeLoad() {
    if (barcodeLoadStarted) return;
    barcodeLoadStarted = true;
    const nat = makeNativeReader();
    if (!nat) { makeZxingReader(); return; }
    nat.ready.then(function (ok) { if (!ok) makeZxingReader(); });
  }

  // ONE INTERFACE OVER ALL THREE. `ready` resolves to the kind that won, or
  // null when nothing can decode a PDF417 on this device at all — and that is a
  // real state (a browser with no Worker, no BarcodeDetector and a blocked
  // wasm fetch), which the screen says out loud rather than silently becoming
  // a heuristic-only capture the guest cannot understand.
  //
  // ── NATIVE IS PREFERRED, BUT IT HAS TO EARN IT ─────────────────────────
  // MEASURED, IN THE BROWSER THIS WAS VERIFIED IN, 2026-09-09.
  // `BarcodeDetector.getSupportedFormats()` lists `pdf417`. The detector then
  // decodes NOTHING: on the same synthetic frames the vendored zxing read 294
  // bytes from every one, native returned no result at barcode widths of 449,
  // 560, 700, 900 AND 1100 px. Handed the raw frame it does something worse
  // than fail — it reports a detection whose `rawValue` is the EMPTY STRING,
  // i.e. "there is a PDF417 here and I am not going to tell you what it says".
  //
  //     barcode width   native   zxing
  //        449 px         —      294 B
  //        560 px         —      294 B
  //        700 px         —      294 B
  //        900 px         —      294 B
  //       1100 px         —      294 B
  //
  // THAT IS ROUND 2's DEFECT IN A NEW HAT: trusting a capability flag instead
  // of a result. Round 2 asked `BarcodeDetector` whether it existed and shipped
  // a back-of-licence step that could not read a barcode; preferring native
  // here purely because it advertises the format would ship the same step
  // again on every Chrome, and this time with a decoder sitting unused a
  // hundred kilobytes away.
  //
  // So the preference in the brief is kept — where the native detector really
  // works it is 2–4× faster and cheaper on battery — but it is ON PROBATION.
  // zxing is booted alongside it; after NATIVE_MISS_LIMIT consecutive scans
  // with nothing to show, native is dropped for the rest of the session and
  // zxing takes over. One decode at any point makes native permanent. The
  // demotion costs nothing, because zxing is already warm by the time it
  // happens, and a guest hunting an empty scene for 10 frames is the normal
  // case rather than a diagnosis — being demoted for that is harmless, and the
  // failure it prevents is the entire back-of-licence step.
  const NATIVE_MISS_LIMIT = 10;

  function makePdf417Reader() {
    let impl = null, zx = null, misses = 0, proven = false, swapped = false;
    const ready = (function () {
      const nat = makeNativeReader();
      function toZxing() {
        zx = makeZxingReader();
        return zx.ready.then(function (ok) { if (ok) impl = zx; return ok ? 'zxing' : null; });
      }
      if (!nat) return toZxing();
      return nat.ready.then(function (ok) {
        if (!ok) return toZxing();
        impl = nat;
        // Warm zxing anyway, so a demotion is instant rather than a stall in
        // the middle of the step it is rescuing.
        zx = makeZxingReader();
        return 'barcode';
      }, toZxing);
    })();
    return {
      ready: ready,
      // LIVE, not the value `ready` resolved to: after a demotion the honest
      // answer changes, and both the `detector` field on the upload and the
      // line under the viewfinder read it from here.
      kind: function () { return impl ? impl.kind : null; },
      scan: function (crop) {
        if (!impl) return Promise.resolve(null);
        const was = impl;
        return impl.scan(crop).then(function (r) {
          if (was.kind !== 'barcode') return r;
          if (r) { proven = true; misses = 0; return r; }
          if (proven) return null;
          misses++;
          if (misses >= NATIVE_MISS_LIMIT && zx && !swapped) {
            swapped = true;
            // Only once zxing is genuinely ready: a detector that might work
            // beats no detector at all, so native keeps its turn until the
            // replacement can actually take over.
            zx.ready.then(function (ok) { if (ok && !proven) impl = zx; else swapped = false; });
          }
          return null;
        });
      },
      close: function () { if (impl && impl !== zxSingleton && impl.close) impl.close(); impl = null; },
    };
  }

  // ── the torch ────────────────────────────────────────────────────────────
  // Offered only where `MediaStreamTrack.getCapabilities().torch` says the
  // device has one and the browser will let the page drive it. That is Chrome
  // on Android in practice; iOS Safari exposes no torch constraint at all, so
  // the button correctly never appears there and nothing has to pretend.
  function videoTrackOf(stream) {
    try { const t = stream && stream.getVideoTracks ? stream.getVideoTracks() : null; return (t && t[0]) || null; }
    catch (e) { return null; }
  }
  function trackCaps(track) {
    try { return (track && track.getCapabilities) ? (track.getCapabilities() || {}) : {}; }
    catch (e) { return {}; }
  }
  function hasTorch(track) {
    const c = trackCaps(track);
    return !!(c && Object.prototype.hasOwnProperty.call(c, 'torch') && c.torch);
  }
  function setTorch(track, on) {
    if (!track || !track.applyConstraints) return Promise.resolve(false);
    return track.applyConstraints({ advanced: [{ torch: !!on }] })
      .then(function () { return true; }, function () { return false; });
  }

  // ── the zoom ─────────────────────────────────────────────────────────────
  // SAME CONTRACT AS THE TORCH: read the capability, and where it is absent do
  // nothing and say nothing. `zoom` landed in iOS 17 Safari and has been in
  // Android Chrome for years; on anything older `getCapabilities` either does
  // not exist or has no `zoom` key, `zoomCaps` answers null, `zoomFor` answers
  // null, and the guest is asked to move closer — which is what round 3 did
  // for everyone.
  //
  // `getCapabilities` is missing entirely on Firefox and on older Safari, and
  // `trackCaps` already swallows that into `{}`. The one extra guard here is
  // that a capability object can carry a `zoom` that is not a range (some
  // Android drivers report a bare boolean), which would make the arithmetic
  // produce NaN and the constraint throw.
  function zoomCaps(track) {
    const c = trackCaps(track);
    const z = c && c.zoom;
    if (!z || typeof z !== 'object') return null;
    if (typeof z.min !== 'number' || typeof z.max !== 'number') return null;
    if (!(z.max > z.min)) return null;
    return { min: z.min, max: z.max, step: typeof z.step === 'number' ? z.step : null };
  }
  function trackSettings(track) {
    try { return (track && track.getSettings) ? (track.getSettings() || {}) : {}; }
    catch (e) { return {}; }
  }
  function currentZoom(track) {
    const s = trackSettings(track);
    return typeof s.zoom === 'number' ? s.zoom : null;
  }
  function setZoom(track, z) {
    if (!track || !track.applyConstraints || z == null) return Promise.resolve(false);
    return track.applyConstraints({ advanced: [{ zoom: z }] })
      .then(function () { return true; }, function () { return false; });
  }

  // ── the wake lock ────────────────────────────────────────────────────────
  // THE OWNER'S SCREEN DIMMED WHILE HE WAITED, AND THE UNLOCK RELOADED THE
  // PAGE. Half of that is this hook and half is the router; both halves are
  // needed, because a wake lock is released by the system on any hide and a
  // page that only asks once gets exactly one lock per page load.
  //
  // Guarded three ways: the API may not exist (older iOS, Firefox); the
  // request rejects if the document is not visible, which is a normal thing
  // and not an error; and the lock is auto-released on hide, so the
  // `visibilitychange` listener re-asks rather than assuming it survived.
  function useWakeLock(active) {
    const held = React.useRef(null);
    React.useEffect(function () {
      if (!active) return undefined;
      let dead = false;
      function request() {
        const wl = navigator.wakeLock;
        if (!wl || typeof wl.request !== 'function') return;
        if (document.visibilityState !== 'visible') return;
        if (held.current) return;
        wl.request('screen').then(function (s) {
          if (dead) { try { s.release(); } catch (e) {} return; }
          held.current = s;
          if (s.addEventListener) s.addEventListener('release', function () { held.current = null; });
        }, function () { /* denied, or not visible any more. Nothing to say. */ });
      }
      function onVis() { if (document.visibilityState === 'visible') request(); }
      request();
      document.addEventListener('visibilitychange', onVis);
      return function () {
        dead = true;
        document.removeEventListener('visibilitychange', onVis);
        const s = held.current;
        held.current = null;
        if (s) { try { s.release(); } catch (e) {} }
      };
    }, [active]);
  }

  // ── prefers-reduced-motion ───────────────────────────────────────────────
  // pos/tokens.jsx already forces every CSS animation and transition to 0.01 ms
  // under the media query, but this file animates on a CANVAS — a settle ring,
  // an oval pulse, a countdown arc — and canvas drawing is not CSS. So the
  // preference has to be read as a value, and the motion simply not drawn.
  function useReducedMotion() {
    const [reduced, setReduced] = React.useState(function () {
      try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (e) { return false; }
    });
    React.useEffect(function () {
      let mq = null;
      try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return undefined; }
      if (!mq) return undefined;
      function on() { setReduced(!!mq.matches); }
      if (mq.addEventListener) mq.addEventListener('change', on);
      else if (mq.addListener) mq.addListener(on);
      return function () {
        if (mq.removeEventListener) mq.removeEventListener('change', on);
        else if (mq.removeListener) mq.removeListener(on);
      };
    }, []);
    return reduced;
  }

  // ── the face landmarker ──────────────────────────────────────────────────
  // MediaPipe Tasks Vision, vendored under /vendor/mediapipe and loaded FROM
  // OUR OWN ORIGIN. The import itself lives in vendor/mediapipe/hw-face.js
  // because this file is Babel-transformed with preset-env, which would rewrite
  // a dynamic import() into a require() — see that file's header.
  //
  // STARTED EARLY, ON PURPOSE. The wasm runtime and the float16 model are about
  // 13 MB together, and the moment a guest needs them is the worst moment to
  // start fetching them. The load is kicked off the instant the consent screen
  // is on screen, so it downloads while the guest reads one sentence and
  // photographs two sides of a card.
  //
  // AND IT IS NEVER A DEAD END. If it fails, the selfie falls back to the
  // sharpness and stillness gates with `detector:'heuristic'` and the manual
  // escape hatch appears sooner. A capture flow that cannot take a selfie
  // because a model did not download is worse than one that takes a slightly
  // worse selfie.
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
  // feature), it reports consent separately as `state.consents`.
  const CAPTURE_STEPS = ['document_front', 'document_back', 'medical_rec', 'selfie', 'challenge'];
  const TERMINAL = ['Approved', 'Declined', 'In Review', 'Abandoned', 'Expired', 'Kyc Expired'];
  function isTerminal(status) { return TERMINAL.indexOf(status) >= 0; }

  // What the guest reads at each step. `branding.copy` (Customization) wins
  // where the owner has set a sentence, because that is the whole point of the
  // white-label screen; the BIG WORD is not in the customization schema.
  //
  // ONE PLAIN SENTENCE PER SCREEN. Every one of these is read while a camera is
  // live and a guide is asking to be filled. What the guest needs at this
  // moment is where to point the camera; the live hint says the rest.
  const STEP_COPY = {
    consent: { big: "Let's check your ID", say: 'Two photos of your ID and a quick look at the camera.' },
    document_front: { big: 'Front of your ID', say: 'Lay it flat inside the frame.' },
    // ROUND 4: the back asks for the BARCODE, not for the card. The owner's
    // sentence was "we need the system to look for and recognize the barcode
    // on the screen before we proceed", and a screen that says "now the back"
    // while drawing a card-shaped box is asking for the wrong thing.
    document_back: { big: 'Now the barcode', say: 'Fit the barcode inside the box' },
    medical_rec: { big: "Doctor's recommendation", say: 'Lay the whole page flat inside the frame.' },
    selfie: { big: 'Look at the camera', say: 'Put your face in the oval.' },
    challenge: { big: 'One quick check', say: 'Follow the prompts.' },
  };
  // The header shows the step name and nothing else — no brand mark, no session
  // reference, no status. An associate reads the reference off the associate
  // bar, which is where it belongs.
  const STEP_TITLE = {
    consent: 'Get started', document_front: 'Front of ID', document_back: 'Back of ID',
    medical_rec: 'Recommendation', selfie: 'Selfie', challenge: 'Liveness check',
  };

  // THE OFFERED (optional) ENTRY COPY — an 18–20-year-old on a REC_21 workflow
  // with offer_medical_path on (contract round-3 addendum §B).
  const MED_REC_OFFER = {
    big: 'Under 21?',
    say: "Recreational purchases need you to be 21. If you have a doctor's recommendation, add it now.",
  };

  // ── the consent words ────────────────────────────────────────────────────
  // THE OWNER'S RULING, 2026-09-09, AND EXACTLY WHAT IT CHANGED.
  //
  // The consent screen is ONE CHECKBOX. Not two, no "what we collect"
  // disclosure row, no version banner. Round 2 put a required Terms box, an
  // optional biometric box, an expandable 97-word notice at collection and a
  // `needs_update_notice` warning on the first screen a customer ever sees;
  // the owner's ruling is that the screen reads "I agree to Hyperwolf's Terms
  // and Conditions" and nothing else, with every notice inside the Terms
  // document the link opens.
  //
  // AND THAT IS WHY TWO CONSENT ROWS ARE STILL POSTED FROM ONE TICK. The
  // Terms text itself carries the biometric clause (Part II.B), so a guest who
  // accepts the Terms has accepted it. Posting only `terms` would leave the
  // biometric consent unrecorded while the document the guest agreed to says
  // they gave it — a record that disagrees with the thing it is a record of.
  // So the same acceptance is written twice, `terms` and
  // `biometric_retention`, with the same version and URL.
  //   ⚠️ COUNSEL TO CONFIRM. Whether one tick on a combined document is a valid
  //   unbundled biometric consent is a legal question, not a screen question.
  //   The Terms draft (idv/terms-text.js, Part II.B) still describes a separate
  //   checkbox and a 36-month retention; this screen no longer offers one. That
  //   divergence is deliberate, is the owner's call, and is written here rather
  //   than hidden behind a lookup so it shows up in a diff.
  const CONSENT_LINE_PREFIX = 'I agree to ';
  const CONSENT_LINE_SUFFIX = '’s ';

  // GUEST-SAFE DECLINE SENTENCES. The server sends a reason CODE
  // (CAPTURE_SAFE_REASONS in wmdemo/idv_api.py); the guest is never shown one.
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
  //                 only state that earns the file-input fallback.
  //   failed      — a camera exists and said yes, then broke.
  //
  // THREE THINGS THE TRACK IS ASKED FOR AFTER IT STARTS, ALL OPTIONAL, NONE
  // FATAL — and all three exist because of the owner's phone:
  //   focusMode 'continuous'  a licence held 20 cm from a phone is inside the
  //                           macro range and iOS will happily leave the lens
  //                           parked. Blur, not size, is what actually stopped
  //                           his barcode decoding (measured: at 2.19 px/module
  //                           a 1-pixel defocus decodes and a 2-pixel one does
  //                           not), so asking for continuous autofocus is the
  //                           single highest-value constraint on this screen.
  //   zoom 1.0                several iPhones default a multi-camera
  //                           `environment` stream to the ultra-wide at 0.5×,
  //                           which makes every object in frame HALF the size
  //                           it should be — the exact shape of a barcode that
  //                           measures 449 px when it should measure 900. The
  //                           constraint is clamped into the device's own
  //                           reported range rather than assumed to be legal.
  //   torch                   read only; the button is drawn by the step.
  // Each is applied on its own so one refusal cannot take the others down with
  // it, and `getSupportedConstraints` is consulted first so a browser that has
  // never heard of `focusMode` is not sent one.
  function tuneTrack(track) {
    if (!track || !track.applyConstraints) return;
    let sup = {};
    try { sup = (navigator.mediaDevices.getSupportedConstraints && navigator.mediaDevices.getSupportedConstraints()) || {}; }
    catch (e) { sup = {}; }
    const caps = trackCaps(track);
    function tryOne(c) { try { track.applyConstraints({ advanced: [c] }).catch(function () {}); } catch (e) {} }
    if (sup.focusMode || caps.focusMode) tryOne({ focusMode: 'continuous' });
    if (caps.zoom) {
      const z = caps.zoom;
      const want = clamp(1, z.min == null ? 1 : z.min, z.max == null ? 1 : z.max);
      tryOne({ zoom: want });
    }
  }

  // ── THE RESOLUTION LADDER, ROUND 4 ───────────────────────────────────────
  // ASK FOR 4 K ON THE REAR CAMERA. `ideal` is a hint, not a demand, so on a
  // phone that cannot do it the browser silently gives its best — but "best"
  // for an unspecified request is routinely 640 × 480, and round 3's flat
  // 1920 × 1080 ask capped a 12-megapixel sensor at 2. On the owner's iPhone
  // the difference is the entire defect: at 1080 across, a barcode filling
  // 70 % of the band guide is 710 px and 3.1 px/module; at 2160 across it is
  // 1420 px and 6.3.
  //
  // WHY A LADDER AND NOT ONE `ideal`. `ideal` alone is right in theory and
  // unreliable in practice: several Android drivers answer a 4 K ideal with an
  // OverconstrainedError instead of a downgrade, and at least one answers it
  // with a 4 K stream it cannot actually sustain and then drops frames. So the
  // ask is explicit and descending, each rung tried only when the previous one
  // failed for a reason that is about the CONSTRAINT rather than about
  // PERMISSION — a NotAllowedError stops the ladder dead, because retrying a
  // refusal is how a page gets a second permission prompt it has not earned.
  //
  // The front camera is not laddered. MediaPipe runs an inference on every
  // frame of it and a 4 K selfie stream buys nothing but heat.
  const HI_LADDER = [{ width: { ideal: 3840 }, height: { ideal: 2160 } },
    { width: { ideal: 1920 }, height: { ideal: 1080 } }, null];
  const LO_LADDER = [{ width: { ideal: 1920 }, height: { ideal: 1080 } }, null];
  function isPermissionError(n) {
    return n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError';
  }

  function useCamera(active, facing) {
    const [stream, setStream] = React.useState(null);
    const [status, setStatus] = React.useState('idle');
    const [detail, setDetail] = React.useState(null);
    // WHAT THE CAMERA ACTUALLY GAVE US, read from the track rather than from
    // what we asked for. On iOS the two disagree routinely — and `getSettings`
    // itself disagrees with `videoWidth`/`videoHeight` when the phone is held
    // portrait, which is why every pixel calculation in this file reads the
    // VIDEO ELEMENT and this is only ever reported.
    const [settings, setSettings] = React.useState(null);
    const videoRef = React.useRef(null);

    React.useEffect(function () {
      if (!active) { setStatus('idle'); setStream(null); setSettings(null); return undefined; }
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') {
        setStatus('unavailable');
        setDetail('This browser does not offer camera access to the page.');
        return undefined;
      }
      let cancelled = false;
      let got = null;
      setStatus('starting'); setDetail(null);
      const env = facing === 'environment';
      const ladder = env ? HI_LADDER : LO_LADDER;
      let sup = {};
      try { sup = (md.getSupportedConstraints && md.getSupportedConstraints()) || {}; } catch (e) { sup = {}; }

      // `ideal`, never `exact`: a tablet with one camera must still work. An
      // `exact` facingMode is an OverconstrainedError on every such device.
      function askFor(size) {
        const want = { facingMode: { ideal: env ? 'environment' : 'user' } };
        if (size) { want.width = size.width; want.height = size.height; }
        // `advanced` entries are BEST-EFFORT by spec — a device that cannot
        // honour one skips it rather than failing the whole request — but a
        // browser that has never heard of the name can still reject, so it is
        // only sent where the name is a supported constraint.
        if (sup.focusMode) want.advanced = [{ focusMode: 'continuous' }];
        return md.getUserMedia({ video: want, audio: false });
      }
      function attempt(i, lastErr) {
        if (cancelled) return;
        if (i >= ladder.length) { fail(lastErr); return; }
        askFor(ladder[i]).then(function (s) {
          got = s;
          if (cancelled) { stopStream(s); return; }
          const track = videoTrackOf(s);
          tuneTrack(track);
          setSettings(trackSettings(track));
          setStream(s); setStatus('live');
        }, function (err) {
          if (cancelled) return;
          const n = (err && err.name) || '';
          if (isPermissionError(n)) { fail(err); return; }
          attempt(i + 1, err);
        });
      }
      function fail(err) {
        const n = (err && err.name) || '';
        if (isPermissionError(n)) setStatus('denied');
        else if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') setStatus('unavailable');
        else setStatus('failed');
        setDetail((err && err.message) || n || null);
      }
      attempt(0, null);
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

    // A BACKGROUNDED TAB PAUSES THE ELEMENT AND DOES NOT ALWAYS RESUME IT. On
    // iOS a locked screen pauses the <video>; on unlock the element stays
    // paused and every frame the analyser reads is the last one before the
    // lock — which reads as a camera that has frozen on a picture. Asking it to
    // play again on the way back is one line and removes that whole class of
    // "it stopped working" report.
    React.useEffect(function () {
      function onVis() {
        if (document.visibilityState !== 'visible') return;
        const v = videoRef.current;
        if (!v || !v.srcObject || !v.paused) return;
        const p = v.play(); if (p && p.catch) p.catch(function () {});
      }
      document.addEventListener('visibilitychange', onVis);
      return function () { document.removeEventListener('visibilitychange', onVis); };
    }, []);

    return { status: status, detail: detail, videoRef: videoRef, stream: stream, settings: settings };
  }
  function stopStream(s) {
    try { (s.getTracks() || []).forEach(function (t) { t.stop(); }); } catch (e) {}
  }

  // ── the capture overlay ──────────────────────────────────────────────────
  // ONE CANVAS FOR BOTH SHAPES, drawn from tokens, and it owns its own
  // animation frame rather than re-rendering React sixty times a second.
  //
  // FOUR THINGS HAPPEN ON IT, AND THEY ARE THE WHOLE FEEL OF THE SCREEN:
  //   · the guide — four corner brackets for a card, a full ellipse for a face
  //     — sits in `railInk`, the estate's "ink on a dark surface" token, which
  //     is light in BOTH modes because this canvas is on top of live video and
  //     the ink ramp is near-black in light mode;
  //   · the ACCENT stroke fades in over the neutral one as the gates pass. Not
  //     a colour interpolation — there is no arithmetic to do on a token
  //     string, and inventing one would be inventing a colour. It is the same
  //     stroke drawn again at a rising `globalAlpha`, which is honest canvas
  //     and needs no new token;
  //   · the settle ring fills around the guide's own perimeter, so the shutter
  //     is visibly coming rather than a surprise. Persona's ring, on the shape
  //     the guest is already looking at;
  //   · a soft pulse on lock — one expanding, fading outline — and then the
  //     screen's checkmark. Skipped entirely under `prefers-reduced-motion`,
  //     because pos/tokens.jsx's global rule flattens CSS animation but cannot
  //     reach a canvas.
  const READY_FADE_PER_S = 5.5;   // how fast the accent stroke arrives
  const PULSE_MS = 480;

  function CaptureOverlay({ shape, tone, ready, progress, locked, dim, reduced, mirrored, bandRef }) {
    const P = useP();
    const wrapRef = React.useRef(null);
    const cvRef = React.useRef(null);
    // Every animated input goes through ONE ref that the loop reads. Putting
    // them in the effect's deps would restart the loop — and the pulse clock
    // with it — on every render of the parent, which at 12 Hz is a pulse that
    // never finishes.
    const live = React.useRef({});
    live.current = { shape: shape, tone: tone || P.accent, neutral: P.railInk, good: P.good,
      ready: !!ready, progress: clamp01(progress || 0), locked: !!locked, dim: dim || null,
      reduced: !!reduced, mirrored: !!mirrored, bandRef: bandRef || null };

    React.useEffect(function () {
      let raf = 0, stop = false;
      let alpha = 0, lockedAt = 0, last = 0;
      function frame(t) {
        if (stop) return;
        const s = live.current;
        const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
        last = t;
        const target = s.ready ? 1 : 0;
        if (s.reduced) alpha = target;
        else alpha += (target - alpha) * Math.min(1, dt * READY_FADE_PER_S);
        if (s.locked && !lockedAt) lockedAt = t;
        if (!s.locked) lockedAt = 0;

        const wrap = wrapRef.current, cv = cvRef.current;
        if (wrap && cv) {
          const r = wrap.getBoundingClientRect();
          const w = r.width, h = r.height;
          if (w > 0 && h > 0) {
            const dpr = Math.min(3, window.devicePixelRatio || 1);
            const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
            if (cv.width !== pw || cv.height !== ph) {
              cv.width = pw; cv.height = ph;
              cv.style.width = w + 'px'; cv.style.height = h + 'px';
            }
            const ctx = cv.getContext('2d');
            if (ctx) {
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, w, h);
              // THE OVERLAY IS MIRRORED WITH THE PREVIEW OR IT IS WRONG. The
              // selfie <video> carries scaleX(-1) so the guest sees a mirror;
              // the guide has to live in the same mirror or an off-centre face
              // is nudged the wrong way. The GEOMETRY is symmetric about the
              // centre so this changes nothing measurable — it is here so that
              // anything asymmetric added later cannot silently disagree.
              if (s.mirrored) { ctx.translate(w, 0); ctx.scale(-1, 1); }
              drawGuide(ctx, w, h, s, alpha, lockedAt ? (t - lockedAt) : -1);
            }
          }
        }
        raf = window.requestAnimationFrame(frame);
      }
      raf = window.requestAnimationFrame(frame);
      return function () { stop = true; window.cancelAnimationFrame(raf); };
    }, []);

    return (
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <canvas ref={cvRef} style={{ display: 'block' }} />
      </div>);
  }

  function drawGuide(ctx, w, h, s, alpha, pulseAge) {
    const box = guideBox(s.shape, w, h);
    const p = s.progress;

    if (s.dim) {
      ctx.fillStyle = s.dim;
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      if (box.oval) ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, 0, Math.PI * 2);
      else roundRectPath(ctx, box.x, box.y, box.w, box.h, Math.min(18, box.w * 0.05));
      ctx.fill('evenodd');
    }

    function strokeShape(colour, width, a, grow) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      if (box.oval) ctx.ellipse(box.cx, box.cy, box.rx + (grow || 0), box.ry + (grow || 0), 0, 0, Math.PI * 2);
      else roundRectPath(ctx, box.x - (grow || 0), box.y - (grow || 0),
        box.w + (grow || 0) * 2, box.h + (grow || 0) * 2, Math.min(18, box.w * 0.05));
      ctx.stroke();
      ctx.restore();
    }

    if (box.oval) {
      strokeShape(s.neutral, 3, 1, 0);
      if (alpha > 0.01) strokeShape(s.tone, 3.5, alpha, 0);
    } else if (s.shape === 'band') {
      // A CLOSED BOX, NOT CORNER BRACKETS, AND THE COPY IS WHY. Brackets say
      // "fill this space"; the back of a licence says "fit the barcode inside
      // the box", which is an instruction about a boundary, and a boundary you
      // can see all of is a boundary you can fit something inside.
      strokeShape(s.neutral, 3, 1, 0);
      if (alpha > 0.01) strokeShape(s.tone, 3.5, alpha, 0);
    } else {
      // Corner brackets, not a closed rectangle: the Concept D document frame,
      // and the shape Onfido uses for the same reason — a closed box invites a
      // guest to line up four edges, four brackets invite them to fill a space.
      const arm = Math.min(box.w, box.h) * 0.22;
      const corners = [[box.x, box.y, 1, 1], [box.x + box.w, box.y, -1, 1],
        [box.x, box.y + box.h, 1, -1], [box.x + box.w, box.y + box.h, -1, -1]];
      function brackets(colour, width, a) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.setLineDash([]);
        corners.forEach(function (c) {
          ctx.beginPath();
          ctx.moveTo(c[0] + arm * c[2], c[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.lineTo(c[0], c[1] + arm * c[3]);
          ctx.stroke();
        });
        ctx.restore();
      }
      brackets(s.neutral, 4, 1);
      if (alpha > 0.01) brackets(s.tone, 4.5, alpha);
    }

    // ── THE LIVE BAND INDICATOR (round 4, the back of the card only) ───────
    // WHAT THE ANALYSER FOUND, DRAWN WHERE IT FOUND IT, plus one meter that is
    // the actual target. The guest is being asked for a number they cannot
    // see — "70 % of the guide's width" — so the number is drawn: a rail the
    // width of the guide, a fill the width of the barcode, and a tick at the
    // line the fill has to cross. Nothing here gates anything; it is a
    // speedometer, and the decode is the finish line.
    //
    // READ FROM A REF, NOT A PROP. This updates at the analyser's 12 Hz and is
    // drawn at 60; routing it through React state would re-render the whole
    // capture screen twelve times a second to move a rectangle.
    const band = s.bandRef && s.bandRef.current;
    if (band && !box.oval) {
      if (band.box && band.box.w > 1) {
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = band.ok ? s.good : s.tone;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 5]);
        ctx.strokeRect(band.box.x, band.box.y, band.box.w, band.box.h);
        ctx.restore();
      }
      if (band.frac != null) {
        const railY = box.y + box.h + 12;
        const railW = box.w, railX = box.x;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = s.neutral;
        ctx.beginPath(); ctx.moveTo(railX, railY); ctx.lineTo(railX + railW, railY); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = band.ok ? s.good : s.tone;
        ctx.beginPath(); ctx.moveTo(railX, railY);
        ctx.lineTo(railX + railW * clamp01(band.frac), railY); ctx.stroke();
        // The target tick.
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = s.neutral;
        ctx.lineWidth = 2;
        const tx = railX + railW * (band.target == null ? 0.7 : band.target);
        ctx.beginPath(); ctx.moveTo(tx, railY - 6); ctx.lineTo(tx, railY + 6); ctx.stroke();
        ctx.restore();
      }
    }

    // The settle ring.
    if (p > 0.001) {
      const ring = s.locked ? s.good : s.tone;
      ctx.save();
      ctx.strokeStyle = ring;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      if (box.oval) {
        // Ramanujan's ellipse perimeter — exact enough that the ring closes on
        // the same pixel it started, which a 2πr approximation does not.
        const a = box.rx, b = box.ry;
        const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
        ctx.setLineDash([per * p, per]);
        ctx.beginPath();
        ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, -Math.PI / 2, Math.PI * 1.5);
      } else {
        const per = 2 * (box.w + box.h);
        ctx.setLineDash([per * p, per]);
        ctx.beginPath();
        ctx.moveTo(box.x, box.y);
        ctx.lineTo(box.x + box.w, box.y);
        ctx.lineTo(box.x + box.w, box.y + box.h);
        ctx.lineTo(box.x, box.y + box.h);
        ctx.closePath();
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // The lock pulse: one outline that expands and fades. Not drawn at all
    // when the guest has asked for less motion.
    if (!s.reduced && pulseAge >= 0 && pulseAge < PULSE_MS) {
      const k = pulseAge / PULSE_MS;
      strokeShape(s.good, 4 * (1 - k) + 1, (1 - k) * 0.7, k * Math.min(box.w, box.h) * 0.12);
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
  }

  // ── the shutter ──────────────────────────────────────────────────────────
  // A 200 ms wash and then a checkmark, over the preview only. It exists for
  // one reason: an auto-capture with no visible shutter reads as a bug. The
  // guest must SEE the photo being taken or they will keep holding the card up
  // wondering whether anything happened — which is precisely the "feels buggy"
  // the owner reported of round 1 and still of round 2.
  //
  // THE WASH IS `railBright`, THE ESTATE'S ONLY NEAR-WHITE TOKEN — pure white
  // in light mode, warm off-white in dark. A shutter flash has to be brighter
  // than the frame it covers in BOTH themes, and `surface` is near-black in
  // dark mode, so it is the only honest choice on the palette.
  function Shutter({ on, done }) {
    const P = useP();
    if (!on && !done) return null;
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        background: on ? P.railBright : 'transparent',
        opacity: on ? 0.9 : 1, transition: 'background .2s ease, opacity .2s ease' }}>
        {done ? (
          <span style={{ width: 72, height: 72, borderRadius: P.r999, background: P.good,
            display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade .2s ease' }}>
            <window.Icon name="check" size={38} stroke={3} color={P.railBright} />
          </span>) : null}
      </div>);
  }

  // ── the live hint ────────────────────────────────────────────────────────
  // ONE LINE, OVER THE VIEWFINDER, NOT UNDER IT. Veriff's placement, and the
  // reason for it is eye-line: a guest lining a card up is looking at the
  // preview, and a sentence 200 pixels below it is a sentence nobody reads.
  // `imgScrim` is the token that exists for exactly this — legible ink over
  // unknown pixels.
  function HintChip({ text, tone, bottom }) {
    const P = useP();
    if (!text) return null;
    return (
      <div aria-live="polite" style={{ position: 'absolute', left: 0, right: 0,
        bottom: bottom == null ? P.space.x5 : bottom,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: `0 ${P.space.x3}px` }}>
        <span style={{ maxWidth: '94%', textAlign: 'center', background: P.imgScrim, color: P.railBright,
          borderRadius: P.r20, padding: `${P.space.x2}px ${P.space.x5}px`, fontSize: P.type.h2,
          fontWeight: P.weight.emph, lineHeight: 1.3, transition: 'border-color .2s ease',
          border: `2px solid ${tone || 'transparent'}` }}>{text}</span>
      </div>);
  }

  // ── the torch toggle ─────────────────────────────────────────────────────
  // Small, in the corner of the viewfinder, and drawn only where the track
  // actually reported a torch capability. A phone with no torch constraint
  // never sees it, so there is no button that does nothing.
  function TorchButton({ on, onToggle }) {
    const P = useP();
    return (
      <button data-hw-i type="button" onClick={onToggle}
        aria-pressed={!!on} aria-label={on ? 'Turn the light off' : 'Turn the light on'}
        style={{ position: 'absolute', top: P.space.x3, right: P.space.x3, width: 44, height: 44,
          borderRadius: P.r999, border: `1px solid ${on ? P.accentBorder : P.hairline3}`,
          background: on ? P.accent : P.imgScrim, color: on ? P.accentInk : P.railBright,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          pointerEvents: 'auto', transition: 'background .2s ease, border-color .2s ease' }}>
        <window.Icon name="zap" size={20} stroke={2} color={on ? P.accentInk : P.railBright} />
      </button>);
  }

  // ── the challenge prompt glyph ───────────────────────────────────────────
  // BIG, ANIMATED, AND IT SAYS THE THING IT IS ASKING FOR. Round 2 drew a small
  // static arrow in a corner; Persona and Didit both put a large glyph on the
  // face itself and move it, because a prompt that moves is read as an
  // instruction and a prompt that sits still is read as decoration.
  //   turn   an arrow that slides IN from the direction of travel and keeps
  //          drifting that way, so the motion itself is the instruction.
  //   blink  two icons alternating on a 380 ms clock — an actual blink, built
  //          from `eye` and `eye-off`, needing no keyframe this page does not
  //          already declare.
  // Under `prefers-reduced-motion` the arrow simply appears in place and the
  // eye stops alternating; the instruction is still legible, which is the point.
  function PromptGlyph({ kind, dir, reduced }) {
    const P = useP();
    const [inPlace, setInPlace] = React.useState(false);
    const [shut, setShut] = React.useState(false);

    React.useEffect(function () {
      setInPlace(false);
      const id = window.requestAnimationFrame(function () { setInPlace(true); });
      return function () { window.cancelAnimationFrame(id); };
    }, [kind, dir]);

    React.useEffect(function () {
      if (kind !== 'blink' || reduced) return undefined;
      const id = setInterval(function () { setShut(function (s) { return !s; }); }, 380);
      return function () { clearInterval(id); };
    }, [kind, reduced]);

    if (!kind) return null;
    const sign = dir === 'right' ? 1 : -1;
    const shift = inPlace ? sign * 26 : sign * -18;
    const icon = kind === 'turn' ? (dir === 'right' ? 'arrow-right' : 'arrow-left')
      : kind === 'blink' ? (shut ? 'eye-off' : 'eye') : 'sun';
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ width: 108, height: 108, borderRadius: P.r999, background: P.imgScrim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: inPlace ? 1 : 0,
          transform: kind === 'turn' ? `translateX(${shift}px)` : 'none',
          transition: 'transform .2s ease, opacity .2s ease' }}>
          <window.Icon name={icon} size={58} stroke={2.4} color={P.accent} />
        </span>
      </div>);
  }

  // ── the flash panel ─────────────────────────────────────────────────────
  // The challenge's "flash" step, rendered as the token colour the SERVER named
  // — the sequence is part of the nonce, so the page may not choose it. Fixed
  // and above the modal layer because its job is to light the guest's face:
  // inside a POS modal a panel that only covers the modal would not.
  //
  // NOW WITH A COUNTDOWN RING, which is the whole difference between a screen
  // that flashes colours at somebody and a screen that is visibly doing
  // something for a known length of time. The ring depletes over the panel's
  // own duration using a CSS transition on stroke-dashoffset, so
  // pos/tokens.jsx's reduced-motion rule flattens it for free.
  function FlashPanel({ tone, ms }) {
    const P = useP();
    const [run, setRun] = React.useState(false);
    React.useEffect(function () {
      if (!tone) { setRun(false); return undefined; }
      setRun(false);
      const id = window.requestAnimationFrame(function () { setRun(true); });
      return function () { window.cancelAnimationFrame(id); };
    }, [tone]);
    if (!tone) return null;
    const colour = P[tone] || P.accent;
    const R = 26, C = 2 * Math.PI * R;
    return (
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: colour, zIndex: P.z.modalPop,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={64} height={64} viewBox="0 0 64 64" style={{ opacity: 0.42 }}>
          <circle cx="32" cy="32" r={R} fill="none" stroke={P.rail} strokeWidth="4" strokeOpacity="0.25" />
          <circle cx="32" cy="32" r={R} fill="none" stroke={P.rail} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={run ? C : 0}
            style={{ transition: 'stroke-dashoffset ' + Math.max(80, ms || 250) + 'ms linear',
              transform: 'rotate(-90deg)', transformOrigin: '32px 32px' }} />
        </svg>
      </div>);
  }

  // ── chrome ───────────────────────────────────────────────────────────────
  // Progress pips. `width` and `background` both transition, so a step landing
  // slides rather than snaps — the "progress pips smooth" of the brief.
  function Pips({ steps, current }) {
    const P = useP();
    const at = steps.indexOf(current);
    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: `${P.space.x2}px 0` }}>
        {steps.map(function (s, i) {
          const done = at >= 0 && i < at, now = i === at;
          return <span key={s} aria-hidden="true" style={{ width: now ? 28 : 8, height: 8, borderRadius: P.r999,
            background: done ? P.good : now ? P.accent : P.hairline2,
            transition: 'width .2s ease, background .2s ease' }} />;
        })}
      </div>);
  }

  // THE HEADER IS THE STEP NAME. Nothing else — no brand square, no session
  // reference, no connectivity dot. The brief's "header shows the step name
  // only", and the reference an associate needs is on the associate bar, which
  // is the surface an associate is actually looking at.
  function TopBar({ title }) {
    const P = useP();
    return (
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `${P.space.x3}px ${P.space.x4}px`, borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <span style={{ fontSize: P.type.strong, fontWeight: P.weight.emph, color: P.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>);
  }

  // A thin "2 of 3" for the liveness script. Deliberately quiet: it is
  // orientation, not a scoreboard.
  function StepLine({ index, total }) {
    const P = useP();
    if (!total || total < 2) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x2, justifyContent: 'center' }}>
        <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkMute }}>
          {Math.min(total, index + 1) + ' of ' + total}
        </span>
        <span style={{ display: 'flex', gap: 4 }}>
          {Array.apply(null, { length: total }).map(function (_, i) {
            return <span key={i} aria-hidden="true" style={{ width: 18, height: 3, borderRadius: P.r999,
              background: i < index ? P.good : i === index ? P.accent : P.hairline2,
              transition: 'background .2s ease' }} />;
          })}
        </span>
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

  // ── the processing screen ────────────────────────────────────────────────
  // THE OWNER SAT ON "Give us a few seconds" WHILE THE BACKEND WAS STUCK, AND
  // THE SCREEN KEPT PROMISING SECONDS. The bug behind it is fixed; the screen
  // that lied about it is fixed here.
  //
  // The line is derived from ELAPSED TIME and is monotonic by construction —
  // `Math.max` against the highest index reached, held in a ref — so it can
  // never walk backwards when a poll is slow, which is the one thing a
  // progress line must never do. None of these sentences claims a duration.
  const PROC_STAGES = [
    { at: 0, line: 'Sending your photos…' },
    { at: 2500, line: 'Reading your ID…' },
    { at: 9000, line: 'Checking your selfie…' },
    { at: 18000, line: 'Finishing the checks…' },
  ];
  const PROC_SLOW_MS = 45000;

  function ProcessingScreen({ shell, elapsed, message, onRetry, retrying }) {
    const P = useP();
    const floorRef = React.useRef(0);
    let idx = 0;
    for (let i = 0; i < PROC_STAGES.length; i++) if (elapsed >= PROC_STAGES[i].at) idx = i;
    idx = Math.max(floorRef.current, idx);
    floorRef.current = idx;
    const slow = elapsed >= PROC_SLOW_MS;
    // A meter that fills asymptotically and never reaches the end. A bar that
    // completes and then keeps waiting is a worse lie than no bar.
    const value = clamp01(1 - Math.exp(-elapsed / 14000)) * 0.92;
    return shell('Checking', (
      <React.Fragment>
        <Plate tone="info" icon="clock" />
        <Big>{slow ? 'This is taking longer than usual' : 'Checking your ID'}</Big>
        <Say>{slow ? 'Keep this page open — nothing is lost and we are still working on it.' : PROC_STAGES[idx].line}</Say>
        {slow && message ? <Say mute>{message}</Say> : null}
        <div style={{ width: 220 }}>
          <window.BarMeter value={value} color={slow ? P.warn : P.info} height={6} />
        </div>
        {slow ? (
          <window.PBtn size="lg" variant="secondary" icon="refresh" busy={retrying} onClick={onRetry}>
            Check again
          </window.PBtn>) : null}
      </React.Fragment>),
      'Waiting on the engine · the client sets no status', null);
  }

  // ── the component ────────────────────────────────────────────────────────
  window.IdvCapture = function IdvCapture({ token, mode = 'hosted', onDone, sessionRef = null,
    sessionId = null, storeLabel = null, base = null }) {
    const P = useP();
    const pos = mode === 'pos';
    const reduced = useReducedMotion();

    const [state, setState] = React.useState(null);
    const [loadErr, setLoadErr] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    // 'consent' | 'capture' | 'face' | 'processing' | 'outcome' | 'resuming'
    const [phase, setPhase] = React.useState('resuming');
    const [cursor, setCursor] = React.useState('consent');
    const [done, setDone] = React.useState({});        // step id -> true, this page session
    const [poll, setPoll] = React.useState(null);      // last GET status body
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState(null);  // one plain sentence, guest-facing
    const [terms, setTerms] = React.useState(false);
    const [flash, setFlash] = React.useState(null);    // { tone, ms }
    const [pickerPhotos, setPickerPhotos] = React.useState([]);
    const [started, setStarted] = React.useState(false); // any media uploaded from this page
    const [procElapsed, setProcElapsed] = React.useState(0);
    const [retrying, setRetrying] = React.useState(false);

    // ROUND 4 §3: the guest's own way out of the barcode step. `null` until
    // they take it; then `{ applied }`, where `applied` is what the SERVER said
    // about the abandon — see giveUpToStore().
    const [inStore, setInStore] = React.useState(null);

    const submittedRef = React.useRef(false);
    const beaconedRef = React.useRef(false);
    const aliveRef = React.useRef(true);
    const fixRef = React.useRef(null);
    const resumeSubmitRef = React.useRef(false);
    const terminalFetchedRef = React.useRef(false);
    const pollNowRef = React.useRef(null);   // set by the polling effect

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

    function phaseFor(step) {
      // selfie and challenge are ONE SCREEN and one camera session.
      if (step === 'consent') return 'consent';
      if (step === 'selfie' || step === 'challenge') return 'face';
      return 'capture';
    }

    // ── load state ─────────────────────────────────────────────────────────
    const loadState = React.useCallback(function () {
      setLoading(true);
      return capGet(token, 'state', base).then(function (r) {
        if (!aliveRef.current) return null;
        setLoading(false);
        if (!r.ok) { setLoadErr(r.error || 'that verification link is not valid'); return null; }
        setLoadErr(null);
        setState(r.body);
        return r.body;
      });
    }, [token, base]);

    React.useEffect(function () {
      aliveRef.current = true;
      loadState();
      return function () { aliveRef.current = false; };
    }, [loadState]);

    // The head starts. Both heavy artefacts begin downloading the moment the
    // flow knows it will need them — the face model on any selfie/challenge
    // workflow, the PDF417 reader on any workflow with a document back — so
    // they overlap the consent read and the first photo instead of stalling
    // the screen that needs them.
    React.useEffect(function () {
      if (!state) return;
      if (stepIds.indexOf('selfie') >= 0 || stepIds.indexOf('challenge') >= 0) startFaceLoad();
      if (stepIds.indexOf('document_back') >= 0) startBarcodeLoad();
    }, [state, stepIds]);

    // ── THE ROUTER ─────────────────────────────────────────────────────────
    // THE UI IS REBUILT FROM `GET state`, NOT REMEMBERED. The owner's phone
    // dimmed, reloaded the page on unlock, and was asked to start over — and
    // "start over" was round 2's literal fallback: when every step was already
    // done, `nextOutstanding` answered null and the routing effect fell through
    // to `'document_front'`, re-opening a step the server had accepted.
    //
    // Four answers, in the order the server's own facts settle them:
    //   terminal status        → the outcome screen, nothing to capture
    //   Awaiting User          → ONE `GET status` for the guidance sentence,
    //                            then straight into the step it names. No
    //                            intermediate screen: round 2 routed through
    //                            'processing' to fetch the same sentence and
    //                            then bounced through an outcome screen and a
    //                            1.2 s timer to arrive where this arrives now.
    //   no terms consent yet   → the consent screen
    //   otherwise              → the first step neither the server nor this
    //                            page has finished; and if there is none,
    //                            PROCESSING — never the first step again.
    const routeSig = state ? [state.status, ((state.consents || []).length),
      ((state.steps || []).map(function (s) { return s.id + ':' + s.state; }).join(','))].join('|') : null;
    React.useEffect(function () {
      if (!state) return;
      // While this page is driving (it has submitted, or it is mid-capture with
      // uploads landing) the server's step list is CATCHING UP with us, not
      // telling us something new. Re-routing on it would yank the guest out of
      // a live camera.
      if (submittedRef.current) return;
      if (isTerminal(state.status)) {
        setPhase('outcome');
        // A TERMINAL STATUS ON A COLD LOAD STILL NEEDS ITS DETAIL, and this was
        // measured going wrong: `GET state` carries the status and nothing
        // about the decision — the reason codes, `next_step` and `message` are
        // all on `GET status`, which is only ever fetched by the processing
        // poller. So a guest who reloaded a Declined session got "We could not
        // complete the check" instead of "The ID you showed us has expired",
        // and the sentence the rules actually wrote was one HTTP call away the
        // whole time. One read, once, only when this page has not polled.
        if (!terminalFetchedRef.current) {
          terminalFetchedRef.current = true;
          capGet(token, 'status', base).then(function (r) {
            if (aliveRef.current && r.ok && r.body) setPoll(r.body);
          });
        }
        return;
      }

      if (state.status === 'Awaiting User') {
        setPhase('resuming');
        capGet(token, 'status', base).then(function (r) {
          if (!aliveRef.current) return;
          const b = (r.ok && r.body) || null;
          if (b) setPoll(b);
          const g = (b && b.guidance) || null;
          const fromState = ((state.steps || []).filter(function (s) { return s.state === 'retry'; })[0] || {}).id;
          const step = (g && g.step) || (b && b.retry && b.retry.step) || fromState || 'document_front';
          // THE FIX SENTENCE FOLLOWS THE GUEST INTO THE CAMERA. It is held in a
          // ref across the phase change and rendered as the standing line above
          // the live hint, so a guest re-photographing their licence can still
          // see WHY while they are doing it.
          fixRef.current = (g && g.fix) || (b && b.message) || null;
          setDone({});
          setCursor(step);
          setPhase(phaseFor(step));
        });
        return;
      }

      const consents = state.consents || [];
      const hasTerms = consents.some(function (c) { return c.kind === 'terms'; });
      if (!hasTerms) { setCursor('consent'); setPhase('consent'); return; }

      // A RESUBMISSION RE-OPENS ONLY WHAT THE SERVER ASKED FOR.
      const retry = ((state.steps || []).filter(function (s) { return s.state === 'retry'; })[0] || {}).id;
      const next = retry || nextOutstanding(null);
      if (!next) { setPhase('processing'); return; }
      setCursor(next);
      setPhase(phaseFor(next));
      // eslint-disable-next-line
    }, [routeSig]);

    // ── the wake lock ──────────────────────────────────────────────────────
    // Held on every screen where the guest is looking at the phone and not
    // touching it: the two camera phases and the processing wait. Not on the
    // consent screen (they are reading and tapping) and not on an outcome
    // (there is nothing left to keep awake for).
    useWakeLock(phase === 'capture' || phase === 'face' || phase === 'processing');

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
    // FOUR GUARDS, AND THE PHASE ONE IS NEW. `status !== 'Not Started'` already
    // made it impossible to fire from the processing screen — a session being
    // processed is `In Progress` — but "impossible for a reason two states
    // away" is not the same as "cannot", and the brief asks for it to be
    // verified rather than reasoned. So the phase is checked directly: the
    // beacon cannot fire from `processing`, `outcome` or `face`, full stop.
    const phaseRef = React.useRef(phase);
    phaseRef.current = phase;
    React.useEffect(function () {
      function bail() {
        if (beaconedRef.current) return;
        const ph = phaseRef.current;
        if (ph === 'processing' || ph === 'outcome' || ph === 'face') return;
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
    // status and on `Awaiting User` (which is not terminal but IS waiting on
    // the guest). `pollNowRef` lets the visibility handler and the Retry button
    // jump the queue without restarting the clock.
    React.useEffect(function () {
      if (phase !== 'processing') { setProcElapsed(0); pollNowRef.current = null; return undefined; }
      let timer = null, stopped = false;
      const t0 = Date.now();
      function tick() {
        clearTimeout(timer);
        capGet(token, 'status', base).then(function (r) {
          if (stopped || !aliveRef.current) return;
          setRetrying(false);
          // ELAPSED IS RE-READ HERE, NOT ONLY ON THE 1 Hz BEAT. Measured in a
          // backgrounded pane: the beat is throttled to roughly once a minute,
          // so at 87 s of real waiting the screen was still rendering a 35 s
          // state and the "taking longer than usual" panel had not appeared.
          // The VALUE was always wall-clock — `Date.now() - t0` — it was the
          // update that was late. Stamping it on every poll answer and on the
          // way back from hidden (below) means a guest returning to the page
          // sees the truth on the first paint rather than a minute later.
          setProcElapsed(Date.now() - t0);
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
      pollNowRef.current = function () { if (!stopped) tick(); };
      // A SECOND CLOCK, ONE HERTZ, FOR THE SENTENCE. The poll's own cadence
      // backs off to four seconds and the line would jerk with it; elapsed
      // time is what the guest is actually experiencing.
      const beat = setInterval(function () {
        if (!aliveRef.current) return;
        setProcElapsed(Date.now() - t0);
      }, 1000);
      // COMING BACK FROM A LOCKED SCREEN RE-POLLS AT ONCE. The owner's phone
      // dimmed during exactly this wait; without this the page would sit on a
      // stale body for up to four seconds after he unlocked it, which reads as
      // the page having died while he was away.
      function onVis() {
        if (document.visibilityState !== 'visible' || stopped) return;
        setProcElapsed(Date.now() - t0);
        tick();
      }
      document.addEventListener('visibilitychange', onVis);
      tick();
      return function () {
        stopped = true; clearTimeout(timer); clearInterval(beat);
        pollNowRef.current = null;
        document.removeEventListener('visibilitychange', onVis);
      };
    }, [phase, token, base]);

    // A RESUMED SESSION WHOSE STEPS ARE ALL DONE MAY NEVER HAVE BEEN
    // SUBMITTED. The guest can close the page between the last upload and the
    // submit — that window is exactly the length of one HTTP round trip, and it
    // is where a phone that rings goes. Polling such a session forever is a
    // dead end with no error on it, which is the worst kind.
    //
    // So: if this page did not submit, and twelve seconds of polling have not
    // moved the status off `In Progress`/`Not Started`, submit once. Twelve
    // seconds rather than immediately because a session that WAS submitted is
    // usually answered inside three, and a duplicate job costs the engine real
    // work; once rather than repeatedly because the point is to unstick, not to
    // retry.
    React.useEffect(function () {
      if (phase !== 'processing' || submittedRef.current || resumeSubmitRef.current) return;
      if (procElapsed < 12000) return;
      const s = status;
      if (s && s !== 'In Progress' && s !== 'Not Started') return;
      resumeSubmitRef.current = true;
      capPost(token, 'submit', {}, base).then(function () {
        if (pollNowRef.current) pollNowRef.current();
      });
    }, [phase, procElapsed, status, token, base]);

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
    // ONE TICK, TWO ROWS. See the CONSENT_LINE constants above for the ruling
    // and the open legal question; the mechanic is that both posts carry the
    // same version, the same URL and the same `accepted: true`, and the second
    // is not allowed to fail the first — a `biometric_retention` row that does
    // not land must not strand a guest who has agreed to the Terms, because the
    // Terms are what the capture is authorised by.
    function acceptTerms() {
      if (!terms) return;
      setBusy(true); setNotice(null);
      const t = (state && state.terms) || {};
      const body = { accepted: true,
        terms_version: t.version || (window.IDV_TERMS && window.IDV_TERMS.version) || null,
        terms_url: t.url || null };
      capPost(token, 'consent', Object.assign({ kind: 'terms' }, body), base).then(function (r) {
        if (!r.ok) { setBusy(false); setNotice(plainFail(r, 'We could not record that. Try again.')); return; }
        capPost(token, 'consent', Object.assign({ kind: 'biometric_retention' }, body), base)
          .then(function () {
            setBusy(false);
            setDone(function (d) { return Object.assign({}, d, { consent: true }); });
            const nxt = nextOutstanding('consent') || 'document_front';
            setCursor(nxt);
            setPhase(phaseFor(nxt));
          });
      });
    }

    // ── advancing ─────────────────────────────────────────────────────────
    // Takes a LIST because the face screen finishes two steps (selfie and the
    // challenge) in one mount, and calling a one-step advance twice in a row
    // reads a stale `done` on the second call and re-opens the step that just
    // finished.
    function advance(steps) {
      const list = [].concat(steps);
      setStarted(true);
      const mark = {};
      list.forEach(function (s) { mark[s] = true; });
      const nxt = nextOutstanding(list[list.length - 1], mark);
      setDone(function (d) { return Object.assign({}, d, mark); });
      fixRef.current = null;
      if (!nxt) { submitNow(); return; }
      setCursor(nxt);
      setPhase(phaseFor(nxt));
    }

    function submitNow() {
      submittedRef.current = true;
      setNotice(null);
      setPhase('processing');
      capPost(token, 'submit', {}, base).then(function (r) {
        if (!r.ok) {
          // A refused submit is not a decision. Stay honest: say it did not go
          // in and keep the guest where they are.
          setPhase('outcome');
          setPoll({ status: 'In Progress', reasons: [],
            message: plainFail(r, 'We could not send that for checking just now. Try again in a few minutes.') });
        }
        // 202 { status:'In Progress', job_id, engine_ok }. Polling picks it up.
      });
    }

    function plainFail(r, fallback) {
      if (r && r.code === 410) return 'This verification link has expired. Ask for a new one.';
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
      resumeSubmitRef.current = false;
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

    // ── "I'll verify in store" ────────────────────────────────────────────
    // THE ONE PLACE THIS FLOW LETS SOMEBODY LEAVE, AND IT DOES NOT LIE ABOUT
    // WHAT HAPPENED. `POST abandon` is best-effort and the server is entitled
    // to refuse it: wmdemo/idv_api.py only abandons a `Not Started`/`In
    // Progress` session WITH NO MEDIA ON IT, and by the time a guest has
    // reached the back of the card the front is already uploaded — so the
    // honest answer here is usually `applied: false`, "this session has 1
    // capture on it and the beacon will not discard them".
    //
    // WHICH IS WHY THE SCREEN READS THE ANSWER RATHER THAN ASSUMING ONE. A
    // session that was abandoned says so; a session the server kept says the
    // associate can pick it up, because that is true and because telling a
    // guest their session is gone when it is not is how somebody gets asked to
    // start over at the counter for no reason.
    function giveUpToStore() {
      setInStore({ applied: null });
      capPost(token, 'abandon', {}, base).then(function (r) {
        if (!aliveRef.current) return;
        setInStore({ applied: !!(r && r.ok && r.body && r.body.applied) });
      });
    }

    // ── the pos-mode override ─────────────────────────────────────────────
    // This is the ONE console route this file touches, and the reason HWIdv is
    // read at all: `PATCH /api/idv/sessions/{id}/update-status` with
    // { new_status:'Approved', override:true, reason } needs the `X-HW-Actor`
    // header, and the backend only grants a POS override when the actor's store
    // matches the session's.
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
          if (!r.ok) { setNotice((r.body && r.body.error) || 'The override was refused.'); return; }
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
    // 24-pixel gutter and a centred column.
    //
    // THE INNER `margin:'auto'` IS LOAD-BEARING and it is the same trick
    // pos/atoms.jsx's overlayScrim documents at length: a scrolling flex column
    // with `justifyContent:'center'` STRANDS content above the scroll origin
    // the moment it overflows — the top of a tall screen becomes unreachable on
    // a short phone. `align-items` on the scroller plus `margin:auto` on the
    // one child centres it when it fits and scrolls normally when it does not.
    function shell(title, body, footLine, footActions, opts) {
      const flush = !!(opts && opts.flush);
      return (
        <div style={shellStyle} data-hw="idv-capture" data-hw-mode={mode} data-hw-phase={phase}>
          <TopBar title={title} />
          {/* The pips answer "which step am I on", so they are drawn only while
              there IS one. On `processing` every step is finished and the
              cursor is wherever it was last left — on a resumed session that is
              the initial value, which would light pip one under a screen that
              means "all of them are done". Better to show nothing than to show
              a wrong thing confidently. */}
          {phase !== 'outcome' && phase !== 'resuming' && phase !== 'processing' && !loadErr
            ? <Pips steps={stepIds} current={cursor} /> : null}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ margin: 'auto', width: '100%', maxWidth: flush ? 720 : 640, display: 'flex',
              flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              gap: flush ? P.space.x3 : P.space.x4,
              padding: flush ? `${P.space.x2}px ${P.space.x2}px ${P.space.x4}px` : `${P.space.x6}px ${P.space.x5}px` }}>
              {body}
            </div>
          </div>
          {/* THE TERMS ARE REACHABLE FROM EVERY STATE, not only from the consent
              screen. A page that photographs a government ID and records a
              biometric consent must let the reader open what they agreed to at
              any point, including from a decline — a state the consent card is
              not on screen for. Terms §5.2 requires the link on the capture
              screen itself, which a consent-only link would not satisfy. */}
          {phase !== 'consent' && window.IdvTerms ? (
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: P.space.x2, padding: `${P.space.x1}px ${P.space.x4}px ${P.space.x2}px`, borderTop: `1px solid ${P.hairline}` }}>
              <span style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>{brandName}</span>
              <window.IdvTerms.Link label="Terms and Conditions" />
            </div>) : null}
          {pos ? <AssociateBar sessionRef={sessionRef} workflow={workflowName} storeLabel={storeLabel}
            reasons={(poll && poll.reasons) || []} line={footLine} actions={footActions} /> : null}
          <FlashPanel tone={flash && flash.tone} ms={flash && flash.ms} />
        </div>);
    }

    // Loading / resuming / broken link
    if (loadErr) {
      return shell('Verification', (
        <window.ErrorState title="This link is not valid"
          body="It may have already been used or timed out. Ask for a new one — nothing you did was lost."
          detail={loadErr} onRetry={loadState} />), 'Associate · issue a new link from the session', null);
    }
    if ((loading && !state) || phase === 'resuming') {
      return shell('Verification', (
        <React.Fragment>
          <window.Skeleton w={200} h={14} />
          {/* "Picking up where you left off" and not "Loading": on a reload this
              is exactly what is happening, and it is the sentence that answers
              the fear the owner actually had. */}
          <Say mute>{state ? 'Picking up where you left off…' : 'One moment.'}</Say>
        </React.Fragment>), 'Opening the session…', null);
    }

    // ENGINE DOWN, BEFORE ANYTHING IS CAPTURED — Concept D frame E. The screen
    // says so plainly rather than walking the guest through forty seconds of
    // capture that nothing can judge.
    if (state && state.engine_ok === false && !started && !submittedRef.current && !isTerminal(state.status)) {
      return shell('Verification', (
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
              <window.PBtn size="xl" variant="secondary" disabled={!manualAllowed}
                onClick={manualAllowed ? function () { setOverrideOpen(true); } : undefined}>
                Associate checked the physical ID
              </window.PBtn>
              <Say mute>{manualAllowed ? 'Recorded as a manual decision, re-verified next visit.' : 'Off — needs an owner ruling'}</Say>
            </div>) : null}
          <window.PBtn size="md" variant="ghost" icon="refresh" onClick={loadState}>Check again</window.PBtn>
        </React.Fragment>),
        'Check-in does not continue · no decision has been made', null);
    }

    // ── the guest chose the counter ───────────────────────────────────────
    // Above every phase, because it is a decision the guest made and no camera
    // screen may draw over it.
    if (inStore) {
      return shell('Verify in store', (
        <React.Fragment>
          <Plate tone="neutral" icon="card" />
          <Big>Bring your ID to the counter</Big>
          <Say>{NEXT_STEP_SENTENCE.in_store}</Say>
          <Say mute>{inStore.applied === null ? 'Closing this off…'
            : inStore.applied ? 'We have closed this check off — nothing was kept.'
              : 'What you already sent us is still here, so the associate can pick this up.'}</Say>
        </React.Fragment>),
        inStore.applied === false
          ? 'The guest stopped at the barcode · the session is still open for you'
          : 'The guest stopped at the barcode · the session was abandoned', null);
    }

    // ── consent ───────────────────────────────────────────────────────────
    if (phase === 'consent') {
      return (
        <ConsentScreen shell={shell} brandName={brandName} copy={copy}
          agreed={terms} onAgree={setTerms}
          busy={busy} notice={notice} onContinue={acceptTerms}
          workflowName={workflowName} />);
    }

    // ── capture (document front / back / medical rec) ─────────────────────
    if (phase === 'capture') {
      return (
        <DocStep key={cursor} step={cursor} token={token} base={base} accent={accent}
          copy={copy} shell={shell} reduced={reduced}
          onUploaded={function (s) { advance(s); }}
          onNotice={setNotice} notice={notice}
          fix={fixRef.current}
          pickerPhotos={pickerPhotos} setPickerPhotos={setPickerPhotos}
          medicalRecOffered={medicalRecOffered} onGiveUp={giveUpToStore} />);
    }

    // ── selfie + challenge, ONE screen and ONE camera session ─────────────
    if (phase === 'face') {
      const needsSelfie = cursor === 'selfie';
      const needsChallenge = stepIds.indexOf('challenge') >= 0
        && !((state && state.steps) || []).some(function (s) { return s.id === 'challenge' && s.state === 'done'; })
        && !done.challenge;
      return (
        <FaceStep key={'face:' + cursor} token={token} base={base} accent={accent} shell={shell}
          copy={copy} setFlash={setFlash} reduced={reduced}
          startWith={needsSelfie ? 'selfie' : 'challenge'}
          withChallenge={needsChallenge}
          fix={fixRef.current}
          onNotice={setNotice} notice={notice}
          onUploaded={function (steps) { advance(steps); }} />);
    }

    // ── processing ────────────────────────────────────────────────────────
    if (phase === 'processing') {
      return (
        <ProcessingScreen shell={shell} elapsed={procElapsed} retrying={retrying}
          message={(poll && poll.message) || null}
          onRetry={function () { setRetrying(true); if (pollNowRef.current) pollNowRef.current(); }} />);
    }

    // ── outcomes ──────────────────────────────────────────────────────────
    if (status === 'Approved') {
      return shell('Done', (
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
      // itself in 1.2 s and the same sentence is waiting there as the standing
      // hint. The button stays only as the impatient path.
      return shell('One more try', (
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
      return shell('Almost there', (
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
      return shell('Sorry', (
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
      return shell('Timed out', (
        <React.Fragment>
          <Plate tone="neutral" icon="clock" />
          <Big>This check has timed out</Big>
          <Say>Start again when you are ready — nothing you did was kept.</Say>
        </React.Fragment>), 'Session ' + status, null);
    }
    // In Progress, and the engine has not answered — this is where the paused
    // sentence lands after a real submit.
    return shell('Verification', (
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
  // THE OWNER'S SCREEN, TO THE LETTER (ruling 2026-09-09): a heading, ONE
  // sentence, ONE checkbox reading "I agree to Hyperwolf's Terms and
  // Conditions" with the four link words opening the full document, and
  // Continue. That is the entire screen.
  //
  // WHAT WAS ON IT IN ROUND 2 AND IS NOT ANY MORE, ITEM BY ITEM, because a
  // deletion nobody can see the reason for gets added back by the next person:
  //   · a SECOND checkbox offering optional biometric retention, with a "what
  //     this means" paragraph. Deleted. The Terms carry the biometric clause,
  //     so the single tick covers it and both consent rows are posted from it
  //     (see acceptTerms) — one screen, one decision, and the record still
  //     names both kinds.
  //   · a "What we collect and how long we keep it" disclosure row expanding
  //     the 97-word notice at collection. Deleted from the SCREEN; the notice
  //     itself is untouched and is the first thing inside the Terms sheet
  //     (idv/idv-terms.jsx renders `IDV_TERMS.captureNotice` as Part II.A),
  //     which the link opens. Terms §5.1 asks that the guest be informed at or
  //     before the point of collection and §5.2 that the capture screen carry
  //     an active hyperlink; a link to the notice, present before any camera
  //     starts, is what both ask for.
  //   · the `terms.needs_update_notice` banner. Deleted. It is an instruction
  //     to OUR developers — "update the Hyperwolf Terms and Conditions to cover
  //     Civil Code 1798.90.1 before this goes live" — and a customer standing
  //     at a counter is not its audience. It still shows, pinned, at the top of
  //     the Terms modal, which is where a developer opening the document will
  //     be looking.
  function ConsentScreen({ shell, brandName, copy, agreed, onAgree, busy, notice, onContinue, workflowName }) {
    const P = useP();
    return shell(STEP_TITLE.consent, (
      <React.Fragment>
        <Plate tone="neutral" icon="card" />
        <Big>{STEP_COPY.consent.big}</Big>
        <Say>{copy.intro || STEP_COPY.consent.say}</Say>

        <div data-hw-i role="presentation" onClick={function () { onAgree(!agreed); }}
          style={{ width: '100%', maxWidth: 460, textAlign: 'left', display: 'flex', gap: P.space.x3,
            alignItems: 'center', background: P.surface,
            border: `1px solid ${agreed ? P.accentBorder : P.hairline2}`,
            borderRadius: P.r12, padding: `${P.space.x4}px ${P.space.x4}px`, cursor: 'pointer',
            minHeight: P.ctrlH.xl, transition: 'border-color .2s ease' }}>
          <window.Check on={!!agreed} onChange={onAgree} size={24} />
          <span style={{ fontSize: P.type.title, lineHeight: 1.45, color: P.ink, fontWeight: P.weight.body }}>
            {CONSENT_LINE_PREFIX + brandName + CONSENT_LINE_SUFFIX}
            {/* The link opens IdvTerms.Modal. stopPropagation, or opening the
                Terms would also toggle the box underneath it — which is the one
                interaction on a consent screen that must never be accidental in
                either direction. */}
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

        {notice ? <Say>{notice}</Say> : null}
        <window.PBtn size="xl" variant="accent" busy={busy} onClick={onContinue} disabled={busy || !agreed}>
          Continue
        </window.PBtn>
      </React.Fragment>),
      'New session on ' + (workflowName || 'this workflow') + ' · nothing is stored until they tap Continue', null);
  }

  // ── the auto-capture loop ────────────────────────────────────────────────
  // ONE HOOK, BOTH SURFACES. It owns the analysis tick, the settle timer, the
  // hint cadence, the relax ramp and the disagreement escape; the two capture
  // screens only supply a measure function and a snap function. Keeping the
  // timing in one place is what stops the document screen and the selfie screen
  // drifting into two different definitions of "steady".
  //
  // TICK 80 ms (12 Hz). Fast enough that the ring moves smoothly and a 400 ms
  // settle is five real samples; slow enough that the analyser and — on the
  // selfie — a MediaPipe inference both fit inside it on a mid-range phone.
  //
  // HINT CADENCE 200 ms, WITH A 600 ms FLOOR. The owner asked for 200 ms and
  // that is the recompute rate; the floor is a separate thing and it is not
  // optional. A hint that changes on every recompute strobes between "Move
  // closer" and "Hold still" while a hand settles, and a strobing instruction
  // is worse than no instruction.
  const TICK_MS = 80;
  const HINT_MS = 200;
  const HINT_FLOOR_MS = 600;
  // The relax ramp: full strictness for 4 s, then loosen focus and stillness
  // linearly to 0.62 over the next 10 s. Glare and exposure never relax.
  const RELAX_FROM_MS = 4000, RELAX_TO_MS = 14000, RELAX_FLOOR = 0.62;
  // The manual escape hatch. 6 s when a detector we wanted is missing (the
  // owner's number), 15 s otherwise.
  const MANUAL_AFTER_DEGRADED_MS = 6000, MANUAL_AFTER_MS = 15000;
  // THE DISAGREEMENT ESCAPE — brief §3, "if the gates disagree for 3 s,
  // auto-snap the sharpest recent frame (never wait for a button)". This is
  // what makes it impossible to end up where the owner ended up: five minutes
  // in front of a camera that will not fire, hunting for something to press.
  //
  // "SHARPEST RECENT FRAME" WITHOUT BUFFERING FRAMES. Holding the last five
  // 1600-pixel canvases costs ~30 MB and a `drawImage` on every tick; instead
  // the window watches the sharpness the analyser is ALREADY computing, learns
  // the best value over at least four samples, and fires on the first frame
  // within 8 % of it — or on whatever is live when the window closes. Same
  // outcome, no buffer, and it is the number the frame was judged on rather
  // than a second opinion.
  const FORCE_WINDOW_MS = 700, FORCE_MIN_SAMPLES = 4, FORCE_SHARP_FRAC = 0.92;

  function useAutoCapture({ live, measure, gate, onSnap, degraded, paused, gen, disagreeMs }) {
    const [hint, setHint] = React.useState(null);
    const [ready, setReady] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [manual, setManual] = React.useState(false);
    const metricsRef = React.useRef(null);
    const steadyRef = React.useRef(0);
    const firedRef = React.useRef(false);
    const openedRef = React.useRef(Date.now());
    const hintRef = React.useRef({ text: null, at: 0 });
    const disagreeSinceRef = React.useRef(0);
    const forceUntilRef = React.useRef(0);
    const forceBestRef = React.useRef(0);
    const forceSeenRef = React.useRef(0);
    // THE THREE CALLBACKS GO THROUGH REFS, NOT THROUGH THE EFFECT'S DEPS.
    // `gate` on the document step closes over the barcode state, which arrives
    // asynchronously a beat after mount; if the loop captured the first closure
    // it would keep asking a gate that still believes the browser has no PDF417
    // decoder. Putting them in the effect's deps instead would restart the
    // analysis loop — and the settle timer with it — on every render, which is
    // the other way to make auto-capture never fire.
    const fns = React.useRef({});
    fns.current = { measure: measure, gate: gate, onSnap: onSnap };
    const detectorRef = React.useRef('heuristic');
    const pausedRef = React.useRef(!!paused);
    pausedRef.current = !!paused;

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
      disagreeSinceRef.current = 0;
      forceUntilRef.current = 0; forceBestRef.current = 0; forceSeenRef.current = 0;
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
      function fire(m, extra) {
        firedRef.current = true;
        setProgress(1);
        fns.current.onSnap(Object.assign({}, m || {}, extra));
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
          const g = fns.current.gate(m, relaxNow()) || { pass: false, gates: {} };
          if (g.detector) detectorRef.current = g.detector;
          if (g.pass) steadyRef.current = Math.min(GATE.STEADY_MS, steadyRef.current + dt);
          else steadyRef.current = 0;
          setReady(!!g.pass);
          setProgress(steadyRef.current / GATE.STEADY_MS);
          // The immediate path: a decoder that says yes does not wait 400 ms.
          if (g.immediate || steadyRef.current >= GATE.STEADY_MS) {
            fire(m, { steady_ms: g.immediate ? 0 : Math.round(steadyRef.current),
              detector: g.detector || 'heuristic',
              barcode_decoded: !!g.barcode_decoded, barcode_bytes: g.barcode_bytes == null ? null : g.barcode_bytes });
            return;
          }
          // ── the disagreement escape ──
          if (disagreeMs) {
            const gates = g.gates || {};
            let anyPass = false, anyFail = false;
            Object.keys(gates).forEach(function (k) { if (gates[k]) anyPass = true; else anyFail = true; });
            const stuck = anyPass && anyFail;
            if (!stuck) { disagreeSinceRef.current = 0; forceUntilRef.current = 0; }
            else if (!disagreeSinceRef.current) disagreeSinceRef.current = now;

            if (disagreeSinceRef.current && (now - disagreeSinceRef.current) >= disagreeMs) {
              if (!forceUntilRef.current) {
                forceUntilRef.current = now + FORCE_WINDOW_MS;
                forceBestRef.current = 0; forceSeenRef.current = 0;
              }
              const sharp = (m && m.sharpness) || 0;
              if (sharp > forceBestRef.current) forceBestRef.current = sharp;
              forceSeenRef.current += 1;
              const goodEnough = forceSeenRef.current >= FORCE_MIN_SAMPLES
                && forceBestRef.current > 0 && sharp >= forceBestRef.current * FORCE_SHARP_FRAC;
              if (goodEnough || now >= forceUntilRef.current) {
                fire(m, { steady_ms: 0, detector: g.detector || detectorRef.current, forced: true });
                return;
              }
            }
          }
          t = setTimeout(step, TICK_MS);
        }, function () {
          if (!stopped) t = setTimeout(step, TICK_MS);
        });
      }
      step();
      return function () { stopped = true; clearTimeout(t); };
      // eslint-disable-next-line
    }, [live, gen, disagreeMs]);

    // The hint, on its own clock. Recomputed every 200 ms from whatever the
    // analyser last produced, and held for at least HINT_FLOOR_MS so it reads
    // as an instruction rather than a flicker.
    React.useEffect(function () {
      if (!live) return undefined;
      const id = setInterval(function () {
        if (firedRef.current || pausedRef.current) return;
        const g = fns.current.gate(metricsRef.current, 1) || {};
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
      // The guest's own shutter: the escape-hatch button and a tap anywhere on
      // the preview both land here.
      fire: function () {
        if (firedRef.current) return;
        firedRef.current = true;
        fns.current.onSnap(Object.assign({}, metricsRef.current || {}, {
          steady_ms: 0, detector: detectorRef.current, manual: true }));
      } };
  }

  // N GRABS, SPACED, AND ALL OF THEM. Resolves with everything that came back,
  // in capture order. Shared by the document tilt burst and the selfie's
  // passive frames because both had the same bug and both need the same
  // guarantee: the number of frames is what was asked for, and the elapsed time
  // is whatever that took — never the other way round. Measured in a throttled
  // tab, the interval-and-race version it replaced captured ZERO of four.
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

  // ── a document step ──────────────────────────────────────────────────────
  // document_front · document_back · medical_rec.
  //
  // MEDIA KIND MAPPING — the one place it is decided, and why:
  //   document_front  the AUTO-SNAPPED frame. The four tilt frames that follow
  //                   go up as `challenge_frame`, because the contract's media
  //                   kinds offer no `document_front_frame` and of the two
  //                   multi-frame kinds `selfie_frame` is selfie-specific.
  //   document_back   one frame. PDF417 is a read, not an average — and where
  //                   the browser can decode one, the decode IS the gate.
  //   medical_rec     one frame. A recommendation is a page held flat, not a
  //                   card to be rocked, so no burst and no extras.
  const TILT_MS = 1500, TILT_N = 4;
  // ── THE DECODE CLOCK, ROUND 4 ────────────────────────────────────────────
  // TEN ATTEMPTS A SECOND, ADAPTED. The brief asks for ~10 fps with an EMA of
  // decode latency driving the rate, and the two halves matter for different
  // reasons. 10 fps is the ceiling: a band crop is 0.4–1.0 Mpx and the worker
  // answers in 15–60 ms, so on a good phone the loop idles between attempts
  // and the analyser and the settle ring get the main thread. The EMA is the
  // floor: on a slow device the honest period is the decode's own latency, and
  // scheduling faster than that just queues work behind work.
  //
  // ROUND 3 PACED BY COMPLETION AND THAT WAS ALREADY RIGHT — the change here
  // is that the period is no longer a constant it races against but a number
  // learned from the device, and that it is REPORTED (`decode_ms`) so the next
  // failure has a measurement instead of a guess.
  const DECODE_TARGET_MS = 100;      // ~10 fps ceiling
  const DECODE_MIN_GAP_MS = 16;      // never spin: one frame of breathing room
  const DECODE_MAX_PERIOD_MS = 450;  // and never go quieter than this
  const DECODE_EMA_ALPHA = 0.3;
  // How often the zoom may be nudged. A lens hunt is ~300 ms of visible
  // refocus; nudging faster than it settles is how a preview ends up pumping.
  const ZOOM_EVERY_MS = 700;
  // §3: after 25 s with no decode, ONE line, a Retry and an honest way out.
  const BACK_STALL_MS = 25000;
  const DISAGREE_FRONT_MS = 3000;

  function DocStep({ step, token, base, accent, copy, shell, onUploaded, onNotice, notice,
    fix, pickerPhotos, setPickerPhotos, medicalRecOffered, reduced, onGiveUp }) {
    const P = useP();
    // THE CHOICE COMES BEFORE THE CAMERA. An 18–20-year-old on a REC_21
    // workflow is OFFERED this step, not made to sit through it — so while that
    // choice is still open the camera stays off, and no permission prompt fires
    // before the guest has said yes to one.
    const [medChoice, setMedChoice] = React.useState(null);
    const showMedOffer = step === 'medical_rec' && medicalRecOffered && !medChoice;
    const cam = useCamera(!showMedOffer, 'environment');
    const boxRef = React.useRef(null);
    const analyser = React.useMemo(makeAnalyser, []);
    const isBack = step === 'document_back';
    const reader = React.useMemo(function () {
      return isBack ? makePdf417Reader() : null;
    }, [isBack]);
    const [readerKind, setReaderKind] = React.useState(undefined);   // undefined = still asking
    const kindRef = React.useRef(undefined);
    const [shutter, setShutter] = React.useState(false);
    const [snapped, setSnapped] = React.useState(false);
    const [tilt, setTilt] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [torchOn, setTorchOn] = React.useState(false);
    const [torchable, setTorchable] = React.useState(false);
    const openedRef = React.useRef(Date.now());
    // ── ROUND 4 state, all of it about the band ──
    const bandAnalyser = React.useMemo(function () {
      return isBack ? makeBandAnalyser() : null;
    }, [isBack]);
    // The overlay reads this at 60 Hz and the analyser writes it at 12; it is a
    // ref rather than state so a moving rectangle does not re-render a screen.
    const bandRef = React.useRef(null);
    const [stalled, setStalled] = React.useState(false);
    const [givingUp, setGivingUp] = React.useState(false);
    // The zoom the page applied, and the zoom it found. `base` is restored on
    // the way out — a step that leaves a phone zoomed to 4× has broken the next
    // one, and the next one is the selfie.
    const zoomRef = React.useRef({ caps: null, base: null, applied: null, at: 0, fails: 0 });
    const torchAutoRef = React.useRef(false);
    const torchTriedRef = React.useRef(0);

    const c = STEP_COPY[step] || { big: 'One more photo', say: '' };
    // THE BACK GETS THE BAND GUIDE. Everything else is unchanged.
    const shape = step === 'medical_rec' ? 'page' : isBack ? 'band' : 'card';
    const boxAspect = step === 'medical_rec' ? '3 / 4' : '3 / 2';

    React.useEffect(function () {
      if (!reader) { setReaderKind(null); return undefined; }
      let dead = false;
      reader.ready.then(function (kind) { if (!dead) { kindRef.current = kind || null; setReaderKind(kind || null); } });
      return function () { dead = true; reader.close(); };
    }, [reader]);

    // The torch and the zoom, both read off the live track once it exists, and
    // both entirely absent where the track does not report them.
    //
    // THE CLEANUP IS NOT OPTIONAL. A `zoom` constraint lives on the TRACK, and
    // on iOS the same physical camera is handed to the next getUserMedia in the
    // same page — so a back step that zoomed to 3× and walked away leaves the
    // selfie step looking through a telephoto at somebody's nose. The torch is
    // worse: it stays lit.
    React.useEffect(function () {
      const track = videoTrackOf(cam.stream);
      setTorchable(!!track && hasTorch(track));
      setTorchOn(false);
      torchAutoRef.current = false;
      const caps = track ? zoomCaps(track) : null;
      zoomRef.current = { caps: caps, base: track ? currentZoom(track) : null, applied: null, at: 0, fails: 0 };
      torchTriedRef.current = 0;
      return function () {
        if (!track) return;
        const z = zoomRef.current;
        if (z && z.applied != null && z.base != null) setZoom(track, z.base);
        if (torchAutoRef.current) setTorch(track, false);
      };
    }, [cam.stream]);
    function toggleTorch() {
      const track = videoTrackOf(cam.stream);
      if (!track) return;
      const want = !torchOn;
      setTorch(track, want).then(function (ok) { if (ok) { setTorchOn(want); torchAutoRef.current = want; } });
    }

    // THE GUIDE IS MEASURED FROM THE DOM AND MAPPED THROUGH object-fit: cover,
    // by `measureGuide`, and BOTH the analyser tick and the decode loop call it
    // directly — round 3's one-line `guideNorm()` wrapper is gone because it
    // threw away `boxW/boxH/vw/vh`, which the band indicator needs to put a
    // rectangle back on screen. One function, one rectangle, three readers:
    // the analyser, the crop, and (through the same `guideBox`) the overlay.
    // Round 2's framing bug lived in the gap between them.

    // ── ONE TICK, TWO ANALYSERS ON THE BACK ────────────────────────────────
    // The 208 px analyser still runs there — not to gate anything (on the back
    // nothing but the decode gates) but because `sharpness`, `glare_fraction`
    // and `exposure` are what an analyst reads off a failed session, and round
    // 4 exists because round 3's numbers were the ones that told us the truth.
    // The band analyser adds the four that matter now.
    //
    // AND THE BAND INDICATOR IS FED FROM HERE, in the same pass that measured
    // it, mapped into the overlay's own pixels through the one cover map.
    const measure = React.useCallback(function () {
      const v = cam.videoRef.current;
      const g = measureGuide(boxRef.current, v, shape);
      if (!v || !g) return null;
      const base2 = analyser.read(v, g.rect);
      if (!isBack || !bandAnalyser) return base2;
      const b = bandAnalyser.read(v, g.rect);
      const merged = Object.assign({}, base2 || {}, b || {});
      const track = videoTrackOf(cam.stream);
      // The overlay's rectangle, in box pixels, or null when there is nothing
      // to draw — which is the honest state and reads as "we are still looking".
      if (b && b.band_norm) {
        const tl = videoNormToBox({ x: b.band_norm.x, y: b.band_norm.y }, g.boxW, g.boxH, g.vw, g.vh);
        const br = videoNormToBox({ x: b.band_norm.x + b.band_norm.w, y: b.band_norm.y + b.band_norm.h },
          g.boxW, g.boxH, g.vw, g.vh);
        bandRef.current = {
          box: tl && br ? { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } : null,
          frac: b.band_frac, target: GATE.BAND_FILL_MIN,
          ok: b.band_frac != null && b.band_frac >= GATE.BAND_FILL_MIN,
        };
      } else {
        bandRef.current = null;
      }
      // ── THE TORCH, AUTOMATICALLY, AND ONLY ON A GENUINELY DARK BAND ───────
      // Guarded twice: the capability must be there (`torchable` is read from
      // `getCapabilities().torch`, which iOS Safari never reports) and the
      // measurement must be there. It is never turned off automatically while
      // the step is open — a torch that flickers with the guest's hand is worse
      // than one that stays on — only at the snap and on the way out.
      //
      // AND IT IS TRIED AT MOST TWICE. `getCapabilities().torch` being true is
      // a claim, and `applyConstraints` is entitled to reject it anyway; without
      // a latch a device that says yes and means no would be sent twelve failed
      // constraint calls a second for as long as the step is open.
      if (track && torchable && !torchOn && torchTriedRef.current < 2 && bandIsDark(merged)) {
        torchTriedRef.current += 1;
        setTorch(track, true).then(function (ok) {
          if (ok) { torchAutoRef.current = true; setTorchOn(true); }
        });
      }
      // ── THE ZOOM, INSTEAD OF ASKING THE GUEST TO MOVE ─────────────────────
      // `zoomFor` is pure and answers null for every device without the
      // capability, so on iOS 16 and on Firefox this whole branch costs one
      // null check and the guest reads "Move closer", exactly as before.
      //
      // Same latch, same reason: three refusals and the page stops asking and
      // the guest is told to move, which is what a device with no usable zoom
      // was always going to get.
      const z = zoomRef.current;
      if (track && z && z.caps && z.fails < 3 && merged.band_frac != null
        && Date.now() - z.at > ZOOM_EVERY_MS) {
        const from = z.applied != null ? z.applied : (z.base != null ? z.base : z.caps.min);
        const want = zoomFor(z.caps, from, merged.band_frac);
        if (want != null) {
          z.at = Date.now();
          setZoom(track, want).then(function (ok) { if (ok) z.applied = want; else z.fails += 1; });
        }
      }
      merged.zoom = z && z.applied != null ? z.applied : (z ? z.base : null);
      merged.torch = torchOn || torchAutoRef.current;
      return merged;
      // eslint-disable-next-line
    }, [analyser, bandAnalyser, cam.videoRef, cam.stream, shape, isBack, torchable, torchOn]);

    // ── the decode loop ──
    // Its own clock, its own in-flight guard. A scan that has not answered must
    // never have a second one queued behind it — on the main-thread fallback
    // that would stack 40 ms of wasm behind 40 ms of wasm until the page stops
    // painting, which is the "super buggy" the owner was describing.
    // Re-arm the auto-capture after a recoverable failure. `gen` lifts the
    // hook's one-shot latch; it is NOT a React key on the preview, because
    // remounting the <video> element would drop the srcObject the camera hook
    // only re-attaches when the STREAM changes — and the stream would not have.
    //
    // DECLARED UP HERE, ABOVE THE DECODE LOOP, because that loop now lists it
    // as a dependency and a `const` read from a deps array literal that runs
    // before its own declaration is a temporal-dead-zone ReferenceError, not a
    // stale value. See the note at the end of that effect for why it needs it.
    const [gen, setGen] = React.useState(0);

    const hitRef = React.useRef(null);      // { bytes, quad, canvas, plan } once, then sticky
    const emaRef = React.useRef(null);      // decode latency, ms
    const [decodeSeen, setDecodeSeen] = React.useState(false);
    React.useEffect(function () {
      if (!reader || cam.status !== 'live' || !readerKind) return undefined;
      let stop = false, t = null;
      // PACED BY COMPLETION, WITH THE PERIOD LEARNED FROM THE DEVICE. Round 3
      // raced a fixed 125 ms; round 4 races `max(DECODE_TARGET_MS, ema)` so a
      // laptop answering in 15 ms still only attempts ten times a second (the
      // eleventh would be a frame the camera has not produced) and a phone
      // answering in 300 ms is not asked for four a second it cannot give.
      function again(spent) {
        if (stop) return;
        const ema = emaRef.current;
        const period = clamp(Math.max(DECODE_TARGET_MS, ema == null ? 0 : ema * 1.15),
          DECODE_TARGET_MS, DECODE_MAX_PERIOD_MS);
        t = setTimeout(run, Math.max(DECODE_MIN_GAP_MS, period - (spent || 0)));
      }
      function run() {
        if (stop || hitRef.current) return;
        const v = cam.videoRef.current;
        const g = measureGuide(boxRef.current, v, shape);
        if (!v || !g) { again(0); return; }
        // ── THE CROP THE WHOLE ROUND IS ABOUT ────────────────────────────
        // THE BAND IF THERE IS ONE, THE GUIDE IF THERE IS NOT, AND NEITHER OF
        // THEM RESAMPLED DOWN. The band is measured HERE, on this frame, rather
        // than read off the 12 Hz analyser's last answer: the crop has to match
        // the pixels about to be decoded, and an 80 ms-old rectangle around a
        // moving hand is a crop that clips a symbol it was drawn around. It
        // costs one 512-wide getImageData, about 1–2 ms.
        //
        // The guide fallback uses tiny pads (2 %) because the guide is already
        // the boundary the guest was asked to work inside; the band's pads are
        // generous because a band box is drawn from a profile and a profile's
        // edges are where the quiet zone is.
        const fresh = bandAnalyser ? bandAnalyser.read(v, g.rect) : null;
        const src = (fresh && fresh.band_norm) || g.rect;
        const plan = (fresh && fresh.band_norm)
          ? bandCropPlan(src, v.videoWidth, v.videoHeight)
          : bandCropPlan(src, v.videoWidth, v.videoHeight, 0.02, 0.02);
        const crop = plan ? cropFromPlan(v, plan) : null;
        if (!crop) { again(0); return; }
        const t0 = Date.now();
        reader.scan(crop).then(function (r) {
          if (stop) return;
          const spent = Date.now() - t0;
          emaRef.current = emaRef.current == null ? spent
            : emaRef.current * (1 - DECODE_EMA_ALPHA) + spent * DECODE_EMA_ALPHA;
          // The reader can demote itself mid-step (see NATIVE_MISS_LIMIT), and
          // the footer line and the `detector` on the upload must both say what
          // is actually reading, not what was reading when the step opened.
          const now = reader.kind();
          if (now && now !== kindRef.current) { kindRef.current = now; setReaderKind(now); }
          if (r && r.bytes) {
            // THE CANVAS IS KEPT, AND THAT IS THE POINT OF §3. These are the
            // exact pixels the worker just read a PDF417 out of; uploading a
            // fresh grab would upload a DIFFERENT frame — one nobody has proved
            // decodable — and the server would be asked to repeat a success it
            // was never given the evidence for.
            hitRef.current = { bytes: r.bytes, quad: r.quad || null,
              canvas: crop.canvas, plan: plan, ms: r.ms == null ? spent : r.ms,
              band_w_px: fresh ? fresh.band_w_px : null,
              px_per_module_est: fresh ? fresh.px_per_module_est : null,
              band_frac: fresh ? fresh.band_frac : null,
              band_luma: fresh ? fresh.band_luma : null };
            setDecodeSeen(true);
            return;               // the gate fires on the next analyser tick
          }
          again(spent);
        }, function () { if (!stop) again(Date.now() - t0); });
      }
      run();
      return function () { stop = true; clearTimeout(t); };
      // eslint-disable-next-line
      // ── `gen` IS IN THE DEPS AND IT IS LOAD-BEARING ──────────────────────
      // On a hit, `run()` returns WITHOUT scheduling another attempt — the
      // sticky `hitRef` is the loop's stop condition. `reopen()` clears that
      // ref (a refused upload, a canvas that gave back nothing), and without a
      // dependency that restarts this effect nothing would ever call `run`
      // again: the hunt would be silently dead while the screen went on saying
      // "Fit the barcode inside the box", and on the back — where round 4 has
      // deliberately removed every other way to fire the shutter — that is a
      // permanent dead end. Round 3 survived the same omission only because its
      // heuristic gate could still snap. Found by reading, not by a phone.
    }, [reader, readerKind, cam.status, cam.videoRef, shape, bandAnalyser, gen]);

    // ── THE GATE, AND ON THE BACK THERE IS ONLY ONE ────────────────────────
    // ROUND 4 DELETES THE BACK'S QUALITY GATE ENTIRELY. Round 3 gave the
    // decoder a five-second grace and then let `docGate` snap the card anyway
    // — which is how a 1.85 px/module frame reached the server wearing a
    // "sharpness 1065, exposure 0.60" badge and was refused there instead. A
    // photograph of a barcode nobody could read is not a fallback, it is a
    // decline with extra steps and forty seconds of the guest's afternoon in
    // front of it. So:
    //
    //   BACK   the decode is the ONLY thing that fires the shutter. Ever. No
    //          grace, no relax ramp, no disagreement escape, no "Take photo".
    //          The advice is the barcode's own — box, width, light, stillness —
    //          and if it never decodes the screen says so at 25 s and offers a
    //          way out that does not pretend.
    //   FRONT / medical rec   the ordinary document gate, untouched.
    //
    // AND `gates` IS DELIBERATELY A SINGLE KEY ON THE BACK. `useAutoCapture`'s
    // disagreement escape fires when SOME gates pass and others fail; with one
    // gate there is never a disagreement, so even if a `disagreeMs` were passed
    // it could not force a snap. It is not passed either — belt and braces, on
    // the one path where a forced snap is the defect being fixed.
    const gate = React.useCallback(function (m, relax) {
      if (hitRef.current) {
        const h = hitRef.current;
        return { pass: true, immediate: true, detector: readerKind === 'barcode' ? 'barcode' : 'zxing',
          barcode_decoded: true, barcode_bytes: h.bytes,
          hint: null, gates: { barcode: true } };
      }
      if (isBack) {
        return {
          pass: false,
          detector: readerKind === 'barcode' ? 'barcode' : readerKind === 'zxing' ? 'zxing' : 'heuristic',
          hint: readerKind === null
            ? 'Hold the barcode inside the box'
            : barcodeHint(m, !!(zoomRef.current && zoomRef.current.applied != null)),
          gates: { barcode: false },
        };
      }
      return docGate(m, relax);
    }, [isBack, readerKind]);

    // Degraded means "there is no PDF417 decoder on this device at all", which
    // is now a genuinely rare state (it needs no Worker, no BarcodeDetector and
    // a blocked wasm fetch). On the FRONT it earns the 6 s escape button; on
    // the back there is no button to earn, and the 25 s line says the honest
    // thing instead.
    const degraded = isBack && readerKind === null;

    function reopen() {
      hitRef.current = null; setDecodeSeen(false); emaRef.current = null;
      openedRef.current = Date.now(); setStalled(false);
      setGen(function (g) { return g + 1; });
    }

    // THE 25-SECOND LINE. One timer, restarted by `gen`, and it never touches
    // the camera or the decoder — the hunt continues underneath it, so a guest
    // who is still trying is not interrupted by being told they have failed.
    React.useEffect(function () {
      if (!isBack || cam.status !== 'live') return undefined;
      setStalled(false);
      const id = setTimeout(function () { if (!hitRef.current) setStalled(true); }, BACK_STALL_MS);
      return function () { clearTimeout(id); };
    }, [isBack, cam.status, gen]);

    const auto = useAutoCapture({
      live: cam.status === 'live' && !showMedOffer,
      measure: measure, gate: gate, degraded: degraded, gen: gen,
      disagreeMs: isBack ? null : DISAGREE_FRONT_MS,
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
    // THE UPLOAD CAP FOR THE PRIMARY FRAME OF THIS STEP. The front's 2400 is
    // §4 of the brief; the back never comes through here at all (see snapBack).
    function stepEdge() { return step === 'document_front' ? MAX_EDGE_FRONT : MAX_EDGE; }

    // Both torch paths meet here: the automatic one and the guest's button. It
    // is switched off the moment the picture is taken, because leaving it
    // burning through the upload and into the next step is a hot phone and a
    // flat battery for no gain.
    function torchOff() {
      if (!torchOn && !torchAutoRef.current) return;
      const tr = videoTrackOf(cam.stream);
      if (tr) setTorch(tr, false);
      torchAutoRef.current = false;
      setTorchOn(false);
    }
    // And the zoom is put back where it was found, for the reason in the
    // capability effect: the next step shares the camera.
    function zoomReset() {
      const z = zoomRef.current;
      if (!z || z.applied == null || z.base == null) return;
      const tr = videoTrackOf(cam.stream);
      if (tr) setZoom(tr, z.base);
      z.applied = null;
    }

    // ── THE BACK, AND IT UPLOADS WHAT WAS DECODED ──────────────────────────
    // §3 of the brief, in the order the server needs it:
    //
    //   1. `document_back` — THE CROP. The literal canvas the worker read the
    //      PDF417 out of, at native pixels, q 0.92. Not a fresh grab of a frame
    //      that merely looks similar: the server has to decode the same symbol
    //      this page decoded, and the only way to guarantee that is to send the
    //      same pixels.
    //   2. `challenge_frame` — the whole frame, for the record, so a reviewer
    //      can see the card the crop came out of. Capped at 2400 because its
    //      job is provenance, not decoding, and because a 4 K JPEG on cellular
    //      is fifteen seconds of a guest watching a spinner.
    //
    // THE ORDER IS LOAD-BEARING FOR A SECOND REASON. `_count_attempt` in
    // wmdemo/idv_api.py only advances a step's counter while the session is
    // `Awaiting User`/`Resubmitted`, and the FIRST upload of a retake flips it
    // to `In Progress`. Sending the crop first means a re-taken back burns a
    // `document_back` attempt and the record frame behind it burns nothing;
    // sending the frame first would have burned a `challenge` attempt off the
    // liveness budget for a photograph of a driving licence.
    //
    // AND THE RECORD FRAME DOES NOT HOLD THE GUEST UP. It is grabbed before we
    // advance (the <video> is about to be torn down) but its upload is not
    // awaited — a fetch is not cancelled by a React unmount, and the step that
    // matters has already landed. A failure there is swallowed for the same
    // reason the front's tilt frames are: it must never cost the step.
    function snapBack(metrics) {
      const hit = hitRef.current;
      const v = cam.videoRef.current;
      if (!hit || !hit.canvas || !v) {
        onNotice('The camera gave us no picture. Move a little and we will try again.');
        setTimeout(function () { setSnapped(false); reopen(); }, 900);
        return;
      }
      setShutter(true);
      torchOff();
      const record = drawScaled(v, MAX_EDGE_FRONT);
      setTimeout(function () { setShutter(false); setSnapped(true); }, 200);
      setSending(true);
      // `doc_box` AND ITS FRIENDS ARE NULLED HERE, for the reason the face step
      // nulls them: the analyser measured them, but it measured them over a
      // 4 : 1 BAND guide, and "the document's bounding box inside a strip that
      // is one eighth of a card" is a number whose name promises something it
      // is not. `band_w` — round 3's inferred fraction-of-frame — goes with
      // them: `band_w_px` is measured and this row carries it.
      const m = clientMetrics(metrics, 'zxing', {
        doc_box: null, doc_fill: null, doc_outside: null, card_fill: null, band_w: null,
        band_w_px: hit.band_w_px, px_per_module_est: hit.px_per_module_est,
        band_frac: hit.band_frac, band_luma: hit.band_luma,
        decode_ms: hit.ms == null ? null : Math.round(hit.ms),
        crop_w: hit.plan ? hit.plan.w : null, crop_h: hit.plan ? hit.plan.h : null,
        crop_upscale: hit.plan ? hit.plan.up : null,
        capture_w: v.videoWidth || null, capture_h: v.videoHeight || null,
      });
      canvasToJpeg(hit.canvas, JPEG_Q_BACK).then(function (blob) {
        if (!blob) {
          setSending(false);
          onNotice('We could not save that picture. We will read it again.');
          setSnapped(false); reopen();
          return;
        }
        capUpload(token, 'document_back', blob, { metrics: m, base: base,
          filename: 'document_back_barcode.jpg' }).then(function (r) {
          setSending(false);
          if (!r.ok) { onNotice(uploadFail(r)); setSnapped(false); reopen(); return; }
          if (record) {
            canvasToJpeg(record, JPEG_Q).then(function (full) {
              if (!full) return;
              capUpload(token, 'challenge_frame', full,
                { metrics: clientMetrics(metrics, 'zxing',
                  { steady_ms: null, card_fill: null, doc_box: null, doc_fill: null,
                    doc_outside: null, band_w: null, band_w_px: hit.band_w_px,
                    px_per_module_est: hit.px_per_module_est }),
                base: base, filename: 'document_back_frame.jpg' })
                .then(function () {}, function () {});
            });
          }
          zoomReset();
          setTimeout(function () { onUploaded(step); }, 380);
        });
      });
    }

    function snap(metrics) {
      if (isBack) { snapBack(metrics); return; }
      setShutter(true);
      grabFrame(stepEdge()).then(function (f) {
        setTimeout(function () { setShutter(false); setSnapped(true); }, 200);
        if (!f) {
          onNotice('The camera gave us no picture. Move a little and we will try again.');
          setTimeout(function () { setSnapped(false); reopen(); }, 900);
          return;
        }
        torchOff();
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
        // ink-under-tilt evidence, and taking them AFTER the real photo means a
        // guest who moves during them cannot spoil the photo that matters. The
        // upload of the photo that matters runs underneath the prompt, so the
        // tilt is not a delay added to the flow — it is the delay the network
        // was costing anyway.
        setTilt(true);
        const frames = [];
        const shots = grabBurst(grabFrame, TILT_N, Math.round(TILT_MS / TILT_N), 1280, 0.8, true);
        Promise.all([up, shots.then(function (fs) { fs.forEach(function (f2) { frames.push(f2); }); })])
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
      if (r && r.code === 410) return 'This link has expired. Ask for a new one.';
      return (r && r.error) || 'That did not go through. We will take another.';
    }

    // ── the offer (18–20 on a REC_21 workflow, offer_medical_path on) ──────
    // A CHOICE, NOT A DECLINE. "I don't have one" continues the flow exactly as
    // if this step were not there — no local verdict is drawn, and the backend
    // still decides.
    if (showMedOffer) {
      return shell(STEP_TITLE.medical_rec, (
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
      return shell(STEP_TITLE[step] || 'Photo', (
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
      return (
        <PickerFallback step={step} token={token} base={base} shell={shell}
          copy={copy} onUploaded={onUploaded} onNotice={onNotice} notice={notice}
          detail={cam.detail} photos={pickerPhotos} setPhotos={setPickerPhotos} />);
    }

    const live = cam.status === 'live';
    const standing = tilt ? 'Slowly tilt the card'
      : sending ? 'Sending…'
        : snapped ? null
          : (auto.hint || fix || c.say);
    const readerLine = !isBack ? null
      : readerKind === undefined ? null
        : readerKind ? 'Looking for the barcode — this snaps itself the moment it reads.'
          : 'This browser has no barcode reader, so we cannot read the back here.';
    // ON THE BACK THE PREVIEW IS NOT A SHUTTER. Everywhere else a tap anywhere
    // fires the capture, and that is the cheapest answer to "I could not get it
    // to register". On the back it would be the opposite: a tap would upload a
    // frame nothing has decoded, which is exactly the picture the server then
    // refuses. The decode is the only shutter here, and the way out at 25 s is
    // an honest one rather than a photograph that will not work.
    const tapToSnap = live && !snapped && !isBack;

    return shell(STEP_TITLE[step] || 'Photo', (
      <React.Fragment>
        {/* TAP ANYWHERE ON THE PREVIEW TO SNAP. Brief §3, and the single
            cheapest answer to "I could not get it to register": the whole
            viewfinder is the shutter, always, from the first frame. It is not
            advertised on screen — a visible shutter button is an invitation to
            press it before the gates are happy — but it is always there, and
            the upload it produces is marked `manual: true` so a decline can be
            explained honestly. NOT ON THE BACK — see `tapToSnap`. */}
        <div ref={boxRef} onClick={tapToSnap ? auto.fire : undefined}
          style={{ position: 'relative', width: '100%', aspectRatio: boxAspect,
            background: P.canvas2, borderRadius: P.r12, overflow: 'hidden',
            border: `1px solid ${P.hairline}`, cursor: tapToSnap ? 'pointer' : 'default' }}>
          <video ref={cam.videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: live ? 1 : 0.25, transition: 'opacity .2s ease' }} />
          <CaptureOverlay shape={shape} tone={accent} ready={auto.ready && !snapped} dim={P.imgScrim}
            progress={snapped ? 0 : auto.progress} locked={snapped} reduced={reduced}
            bandRef={isBack && !snapped ? bandRef : null} />
          <HintChip text={standing} tone={auto.ready ? P.good : null} />
          {torchable && live && !snapped ? <TorchButton on={torchOn} onToggle={toggleTorch} /> : null}
          <Shutter on={shutter} done={snapped && !tilt} />
        </div>
        <Big>{tilt ? 'Slowly tilt the card' : c.big}</Big>
        {/* THE FIX SENTENCE, STANDING, INSIDE THE FLOW. Not a screen of its own
            and not a toast — the guest is re-photographing the thing it is
            about, so it stays visible for as long as they are. */}
        {fix && !snapped ? <Say>{fix}</Say> : null}
        {!fix && !snapped ? <Say mute>{c.say}</Say> : null}
        {readerLine && !snapped && !stalled ? <Say mute>{readerLine}</Say> : null}
        {notice ? <Say>{notice}</Say> : null}
        {!live ? <Say mute>Starting the camera…</Say> : null}
        {/* ── 25 SECONDS WITH NO DECODE: ONE LINE AND TWO HONEST DOORS ─────
            The hunt is still running underneath this — Retry only restarts the
            clock and the zoom, it does not stop anything — so a guest who is
            about to succeed is not interrupted, and a guest who is not is told
            so in one sentence instead of being left to work it out over five
            minutes, which is what happened to the owner in round 2. */}
        {isBack && stalled && live && !snapped ? (
          <React.Fragment>
            <Say>Can&rsquo;t read it? Try in better light, or verify in store</Say>
            <div style={{ display: 'flex', flexDirection: 'column', gap: P.space.x2, alignItems: 'center' }}>
              <window.PBtn size="lg" variant="secondary" icon="refresh"
                onClick={function () { zoomReset(); reopen(); }}>Retry</window.PBtn>
              <window.PBtn size="md" variant="ghost" busy={givingUp}
                onClick={function () {
                  if (givingUp) return;
                  setGivingUp(true);
                  if (typeof onGiveUp === 'function') onGiveUp();
                }}>I&rsquo;ll verify in store</window.PBtn>
            </div>
          </React.Fragment>) : null}
        {/* THE ESCAPE HATCH, AND NOTHING ELSE. There is no shutter button on
            this screen until the auto-capture has had its chance and failed —
            and on the back there is never one at all, because a photograph the
            decoder could not read is not a capture, it is a decline. */}
        {auto.manual && live && !snapped && !isBack ? (
          <window.PBtn size="xl" variant="secondary" icon="camera" onClick={auto.fire}>Take photo</window.PBtn>
        ) : null}
      </React.Fragment>),
      (isBack
        ? (readerKind === 'barcode' ? 'Rear camera · PDF417 read on-device (browser decoder)'
          : readerKind === 'zxing' ? 'Rear camera · PDF417 read on-device (vendored zxing)'
            : 'Rear camera · no PDF417 decoder on this device')
        : 'Rear camera · quality gates on-device')
      + (decodeSeen ? ' · barcode decoded' : '')
      + (isBack && !decodeSeen ? ' · the decode is the only shutter' : '')
      + ' · the server still decides', null, { flush: true });
  }

  // ── the picker fallback ─────────────────────────────────────────────────
  function PickerFallback({ step, token, base, shell, copy, onUploaded, onNotice, notice, detail, photos, setPhotos }) {
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

    return shell(STEP_TITLE[step] || 'Photo', (
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
  // THE SINGLE BIGGEST FRICTION CUT, KEPT FROM ROUND 2: one component, one
  // getUserMedia, one MediaPipe instance, and the challenge begins by itself
  // the instant the selfie has landed.
  //
  // WHAT ROUND 3 ADDS IS THE CRAFT — the Persona/Didit bar the brief asks for,
  // and every piece of it is on the screen the guest is already looking at
  // rather than in a panel beside it:
  //   · a full-bleed viewfinder with everything outside the oval dimmed, so the
  //     oval is the only lit thing on the phone;
  //   · the oval's stroke arriving in the accent as the gates pass, a ring
  //     filling around it over the settle, a soft pulse on lock and then the
  //     checkmark — one continuous piece of feedback rather than four states;
  //   · prompts as LARGE animated glyphs on the face: an arrow that slides the
  //     way the head should turn, an eye that actually blinks, a colour panel
  //     with a countdown ring;
  //   · a thin "1 of 3" so a guest knows how much of this there is;
  //   · a completion beat before the processing screen, because cutting
  //     straight from a colour flash to a progress bar reads as a crash.
  // All of it respects `prefers-reduced-motion`: the canvas work is skipped
  // (pos/tokens.jsx cannot reach a canvas) and the CSS work is flattened by
  // that file's global rule.
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
  const DONE_BEAT_MS = 900;              // the completion animation

  function FaceStep({ token, base, accent, shell, copy, setFlash, startWith, withChallenge,
    fix, onNotice, notice, onUploaded, reduced }) {
    const P = useP();
    const cam = useCamera(true, 'user');
    const boxRef = React.useRef(null);
    const analyser = React.useMemo(makeAnalyser, []);
    // 'selfie' | 'challenge' | 'sending' | 'done'
    const [mode, setMode] = React.useState(startWith === 'challenge' ? 'challenge' : 'selfie');
    const [shutter, setShutter] = React.useState(false);
    const [snapped, setSnapped] = React.useState(false);
    const [prompt, setPrompt] = React.useState(null);   // { text, kind, dir }
    const [stepIdx, setStepIdx] = React.useState(0);
    const [stepTotal, setStepTotal] = React.useState(0);
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
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return guideBox('oval', r.width, r.height);
    }
    function measured() { return measureGuide(boxRef.current, cam.videoRef.current, 'oval'); }

    // ONE MEASURE FUNCTION FOR BOTH HALVES. The challenge reads the same
    // landmark result the selfie gate reads, from `lastFaceRef`, so there is one
    // inference per tick and not two.
    const measure = React.useCallback(function () {
      const v = cam.videoRef.current;
      const g = measured();
      if (!v || !g) return null;
      const base2 = analyser.read(v, g.rect);
      if (!usingMp) { lastFaceRef.current = null; return base2; }
      const lm = faceLandmarker();
      let res = null;
      try { res = lm.detectForVideo(v, faceTick()); } catch (e) { res = null; }
      lastFaceRef.current = res;
      const fm = faceMetricsFrom(res, g.boxW, g.boxH, g.vw, g.vh, g.box);
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

    // WITHOUT MEDIAPIPE THE FACE GATES ARE NOT FAKED. The alternative would be
    // a skin-tone/oval heuristic, and the brief is right to refuse it: a skin
    // heuristic decides who looks like a face, which is not a thing a capture
    // gate may do. So the degraded path keeps ONLY the measurements that are
    // about the photograph — light, glare, focus, stillness — and says nothing
    // about the face at all. The server does the face work either way.
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
        ? 'Too bright — move out of the direct light' : 'More light';
      else if (!g.focus || !g.still) hint = 'Hold still';
      return { pass: g.light && g.focus && g.still, hint: hint, gates: g, detector: 'heuristic' };
    }, [usingMp]);

    // `doc_fill` and its friends are nulled on every face upload. The analyser
    // measures them over whatever region it is given, and over a face oval the
    // numbers are real but they are not the thing the names promise — a reader
    // who found `card_fill` on a selfie row would reasonably read it as a
    // document measurement. Null says "not measured here", which is the truth.
    function payload(metrics, extra) {
      return clientMetrics(metrics, usingMp ? 'mediapipe' : 'heuristic',
        Object.assign({ card_fill: null, doc_fill: null, doc_outside: null, doc_box: null, band_w: null }, extra || {}));
    }

    function grabOne(maxEdge, q) {
      const v = cam.videoRef.current;
      if (!v) return Promise.resolve(null);
      const canvas = drawScaled(v, maxEdge || MAX_EDGE);
      if (!canvas) return Promise.resolve(null);
      return canvasToJpeg(canvas, q || JPEG_Q);
    }

    const [gen, setGen] = React.useState(0);
    function reopen() { setSnapped(false); setGen(function (g) { return g + 1; }); }

    const auto = useAutoCapture({
      live: cam.status === 'live' && mode === 'selfie',
      measure: measure, gate: gate, gen: gen,
      // Degraded on the selfie means "we asked for the model and did not get
      // it", which is exactly when the owner's 6 s escape hatch should appear.
      degraded: !usingMp,
      disagreeMs: DISAGREE_FRONT_MS,
      paused: shutter || snapped,
      onSnap: function (metrics) { snapSelfie(metrics); },
    });

    // ── the selfie ───────────────────────────────────────────────────────
    // PASSIVE FRAMES AND THE SELFIE ARE CAPTURED SILENTLY. The guest sees one
    // shutter and one checkmark; the three `selfie_frame` rows that go up
    // underneath it are never mentioned, because they are evidence for the
    // engine and not an event in the guest's afternoon.
    function snapSelfie(metrics) {
      setShutter(true);
      const m = payload(metrics, { steady_ms: metrics && metrics.steady_ms });
      setTimeout(function () { setShutter(false); setSnapped(true); }, 200);

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
          // STRAIGHT INTO THE CHALLENGE. No screen, no button, no second camera
          // acquisition — the same stream is already running.
          if (withChallenge) { setTimeout(function () { setSnapped(false); startChallenge(); }, 480); }
          else { setTimeout(function () { celebrate(['selfie']); }, 420); }
          return null;
        });
      });
    }

    // THE COMPLETION BEAT. One checkmark and one word, held for DONE_BEAT_MS,
    // and then the processing screen. Cutting straight from a colour flash to a
    // progress bar reads as the page having crashed and recovered.
    function celebrate(steps) {
      if (doneRef.current) return;
      setMode('done');
      setPrompt(null);
      setFlash(null);
      setTimeout(function () { finish(steps); }, DONE_BEAT_MS);
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
      const list = script || [];
      setStepTotal(list.length);
      let chain = Promise.resolve();
      list.forEach(function (item, i) {
        chain = chain.then(function () {
          if (stopRef.current) return null;
          setStepIdx(i);
          if (item.kind === 'turn') {
            const dir = item.dir === 'right' ? 'right' : 'left';
            setPrompt({ text: 'Turn your head to the ' + dir, kind: 'turn', dir: dir });
            // The guest's left is the video's right and vice versa — the front
            // camera is not mirrored in its pixels, only in the preview.
            const want = dir === 'left' ? 1 : -1;
            return runPrompt(item.ms || TURN_MS, function (res) {
              const y = faceYaw(res);
              return y != null && (y * want) > YAW_HIT;
            }).then(function () { setPrompt(null); });
          }
          if (item.kind === 'blink') {
            setPrompt({ text: 'Now blink', kind: 'blink', dir: null });
            return runPrompt(item.ms || BLINK_MS, function (res) {
              const l = blend(res, 'eyeBlinkLeft'), r = blend(res, 'eyeBlinkRight');
              return l != null && r != null && (l > BLINK_HIT || r > BLINK_HIT);
            }).then(function () { setPrompt(null); });
          }
          if (item.kind === 'flash') {
            // NEVER SHORTENED. The colour panels are there to light the guest's
            // face for the recording; ending one early because a landmark moved
            // would be shortening the evidence, not the instruction.
            const cols = item.colors && item.colors.length ? item.colors : ['accent'];
            const each = item.ms || FLASH_MS;
            setPrompt({ text: 'Keep looking at the screen', kind: 'flash', dir: null });
            let c2 = Promise.resolve();
            cols.forEach(function (name) {
              c2 = c2.then(function () {
                if (stopRef.current) return null;
                setFlash({ tone: name, ms: each });
                return wait(each);
              });
            });
            return c2.then(function () { setFlash(null); setPrompt(null); });
          }
          return null;
        });
      });
      return chain.then(function () { setStepIdx(list.length); });
    }

    const challengeStartedRef = React.useRef(false);
    function startChallenge() {
      if (challengeStartedRef.current) return;
      challengeStartedRef.current = true;
      setMode('challenge');
      onNotice(null);
      setPrompt({ text: 'Getting the check ready', kind: null, dir: null });
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
          c2.then(function () { celebrate(startWith === 'challenge' ? ['challenge'] : ['selfie', 'challenge']); });
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
          celebrate(startWith === 'challenge' ? ['challenge'] : ['selfie', 'challenge']);
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
      return shell(mode === 'selfie' ? STEP_TITLE.selfie : STEP_TITLE.challenge, (
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
    const finished = mode === 'done';
    const title = finished ? 'All set' : inChallenge ? STEP_TITLE.challenge : STEP_TITLE.selfie;
    const chip = finished ? null
      : inChallenge
        ? (prompt ? prompt.text : (mode === 'sending' ? 'Sending…' : null))
        : (snapped ? null : (auto.hint || fix || STEP_COPY.selfie.say));

    return shell(title, (
      <React.Fragment>
        {/* FULL-BLEED. The viewfinder is the screen: no card, no border, and the
            only lit region on the phone is inside the oval. */}
        <div ref={boxRef} onClick={live && !snapped && !inChallenge && !finished ? auto.fire : undefined}
          style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4',
            background: P.canvas2, borderRadius: P.r20, overflow: 'hidden',
            cursor: live && !snapped && !inChallenge ? 'pointer' : 'default' }}>
          <video ref={cam.videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              // The preview is mirrored so the guest sees themselves the way a
              // mirror shows them. The CAPTURED frame is not: drawScaled reads
              // the video element's pixels, not this transform — which is also
              // why the yaw check above flips the sign rather than the image.
              transform: 'scaleX(-1)', opacity: live ? 1 : 0.25, transition: 'opacity .2s ease' }} />
          <CaptureOverlay shape="oval" tone={accent} mirrored
            ready={inChallenge || finished || (auto.ready && !snapped)}
            dim={P.imgScrim} locked={snapped || finished}
            progress={inChallenge || snapped || finished ? 0 : auto.progress}
            reduced={reduced} />
          {prompt && prompt.kind ? <PromptGlyph kind={prompt.kind} dir={prompt.dir} reduced={reduced} /> : null}
          <HintChip text={chip} tone={inChallenge ? P.accent : (auto.ready ? P.good : null)} />
          <Shutter on={shutter} done={snapped || finished} />
        </div>
        {inChallenge && stepTotal > 1 ? <StepLine index={stepIdx} total={stepTotal} /> : null}
        <Big>{finished ? 'All done' : inChallenge ? (prompt ? prompt.text : 'One quick check') : STEP_COPY.selfie.big}</Big>
        {finished ? <Say mute>Sending that off for checking.</Say> : null}
        {!finished && !inChallenge && fix && !snapped ? <Say>{fix}</Say> : null}
        {!finished && !inChallenge && !fix && !snapped ? <Say mute>{copy.selfie || STEP_COPY.selfie.say}</Say> : null}
        {!finished && inChallenge && !prompt && mode !== 'sending' ? <Say mute>{STEP_COPY.challenge.say}</Say> : null}
        {/* HONEST ABOUT THE DEGRADED PATH, WITHOUT A DIAGNOSIS. The guest is
            told the framing help is missing, not why, and never a model name. */}
        {!finished && !inChallenge && !usingMp && mp === 'failed' && live
          ? <Say mute>The on-screen framing help did not load, so line your face up with the oval yourself.</Say> : null}
        {!finished && !inChallenge && !usingMp && mp !== 'failed' && live ? <Say mute>Getting ready…</Say> : null}
        {notice ? <Say>{notice}</Say> : null}
        {!live ? <Say mute>Starting the camera…</Say> : null}
        {!finished && !inChallenge && auto.manual && live && !snapped ? (
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
  //
  // `metrics.analysePixels` and `geometry.coverMap` are the two that earn their
  // place hardest: between them they are the whole of the framing defect the
  // owner hit, and both can now be exercised with a synthetic buffer and a pair
  // of numbers rather than with a licence on a desk.
  window.IdvCapture.api = { url: capUrl, get: capGet, post: capPost, upload: capUpload, beacon: capBeacon };
  window.IdvCapture.grab = { drawScaled: drawScaled, toJpeg: canvasToJpeg, MAX_EDGE: MAX_EDGE, JPEG_Q: JPEG_Q };
  window.IdvCapture.metrics = {
    analyser: makeAnalyser, analysePixels: analysePixels, canvasMetrics: canvasMetrics,
    docGate: docGate, faceGate: faceGate, barcodeHint: barcodeHint, sharpnessFloor: sharpnessFloor,
    faceMetricsFrom: faceMetricsFrom, faceYaw: faceYaw, blend: blend,
    order: orderByQuality, best: bestOfBurst, clientMetrics: clientMetrics,
    GATE: GATE, ANALYSIS_EDGE: ANALYSIS_EDGE, SATURATED: SATURATED, EDGE_T: EDGE_T,
    TICK_MS: TICK_MS, HINT_MS: HINT_MS, DECODE_TARGET_MS: DECODE_TARGET_MS,
  };
  // ── ROUND 4's OWN STATICS ────────────────────────────────────────────────
  // EVERY ONE OF THESE IS THE ANSWER TO A QUESTION THAT COST A SESSION ON A
  // PHONE. `bandProfile` and `bandCropPlan` are pure and take numbers, so
  // "does a 1.5 px/module barcode produce a Move closer" and "does the crop
  // keep native pixels" are both answerable from Node against a synthetic
  // frame, which is exactly how the floor below was measured. `zoomFor` is
  // here because "is the zoom code guarded when the capability is absent" must
  // be provable without a device that has one.
  window.IdvCapture.barcode = {
    bandProfile: bandProfile, bandAnalyser: makeBandAnalyser,
    bandCropPlan: bandCropPlan, cropFromPlan: cropFromPlan,
    hint: barcodeHint, isDark: bandIsDark, zoomFor: zoomFor,
    zoomCaps: zoomCaps, torchOf: hasTorch,
    BAND_ASPECT: BAND_ASPECT, BAND_EDGE: BAND_EDGE, PDF417_MODULES: PDF417_MODULES,
    BAND_PAD_X: BAND_PAD_X, BAND_PAD_Y: BAND_PAD_Y,
    BAND_UPSCALE_UNDER_PX: BAND_UPSCALE_UNDER_PX, BAND_UPSCALE: BAND_UPSCALE,
    MAX_EDGE_FRONT: MAX_EDGE_FRONT, JPEG_Q_BACK: JPEG_Q_BACK,
    HI_LADDER: HI_LADDER, BACK_STALL_MS: BACK_STALL_MS,
    DECODE_TARGET_MS: DECODE_TARGET_MS, DECODE_MAX_PERIOD_MS: DECODE_MAX_PERIOD_MS,
  };
  window.IdvCapture.geometry = { guideBox: guideBox, coverMap: coverMap,
    toVideo: boxRectToVideoNorm, toBox: videoNormToBox, inflate: inflateNorm,
    measureGuide: measureGuide, GUIDE_PAD: GUIDE_PAD };
  window.IdvCapture.detectors = { pdf417: makePdf417Reader, native: makeNativeReader,
    zxing: makeZxingReader, startBarcodeLoad: startBarcodeLoad,
    startFaceLoad: startFaceLoad, faceState: faceState,
    // Round 4: the crop is planned, not inflated. See window.IdvCapture.barcode.
    bandCropPlan: bandCropPlan, cropFromPlan: cropFromPlan };
})();
