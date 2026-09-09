// ── vendor/mediapipe/hw-face.js ── the ONE bridge from idv/capture.jsx to
// MediaPipe Tasks Vision, and the reason it exists as its own file.
//
// idv/capture.jsx is loaded as <script type="text/babel">, and the estate's
// precompiler runs @babel/standalone with presets `react,env`
// (tools/precompile.mjs L20, L116). preset-env in a browser caller has
// `supportsDynamicImport: false`, so a bare `import('…')` written inside
// capture.jsx would be rewritten to a CommonJS `require()` and throw on a page
// that has no module loader. So the dynamic import lives HERE, in a plain ES
// module that Babel never touches, and capture.jsx reaches it by injecting
// <script type="module"> — which is a tag, not an expression, and survives the
// transform intact.
//
// EVERYTHING IS SERVED FROM OUR OWN ORIGIN. No CDN, not even for the model.
// The three vendored artefacts are:
//   vision_bundle.js                 the Tasks Vision runtime (Apache-2.0)
//   wasm/vision_wasm_internal.*      the SIMD build the resolver picks first
//   wasm/vision_wasm_nosimd_internal.*  the fallback for a device without SIMD
//   face_landmarker.task             the float16 Face Landmarker model
// LICENSE (Apache-2.0) sits beside them. Copied verbatim; nothing is patched.
//
// WHY vision_bundle.js AND NOT .mjs: the dev server answers `.mjs` with
// `application/octet-stream`, and a browser refuses a module with a
// non-JavaScript MIME type — silently, with no network error to read. `.js`
// comes back as `text/javascript` from the same server, so the extension is the
// whole fix and no server change is needed. Measured on 127.0.0.1:8793.
//
// This file publishes exactly one global, `window.HWFaceMP`, and dispatches
// `hw-face-mp` on window when it settles either way. It never throws: a page
// that cannot load a 13 MB model still has to take a selfie.
//
// ── ROUND 5, 2026-09-09 — THE 9.4 MB THAT FAILED TWICE ───────────────────────
// MEASURED on the owner's iPhone over a Cloudflare quick tunnel, session #5:
// `wasm/vision_wasm_internal.wasm` — 9 423 986 bytes, the single largest thing
// this estate ships to a phone — failed to download TWICE with "unexpected
// EOF", i.e. the tunnel cut the body part-way through. Round 4 had exactly one
// attempt at it and no memory of the attempt, so the selfie step fell to its
// fallback and stayed there, and a reload would have started the same 9.4 MB
// again from zero.
//
// THREE THINGS CHANGE, and only the third is subtle:
//
//  1. WE FETCH THE BIG BYTES OURSELVES, WITH RETRIES. Three attempts, 1 s and
//     3 s apart. A truncated body is a transport event and the correct answer
//     to one is to ask again. MediaPipe's own loader has no retry and no way to
//     be given one, which is why the fetch has to be ours.
//
//  2. THEY GO IN THE CACHE API, SO A RELOAD NEVER REFETCHES. `caches` is a
//     durable, origin-scoped store that outlives the HTTP cache's eviction
//     rules and a hard reload alike. On the second load `cache.match` answers
//     in milliseconds and nothing crosses the network.
//
//  3. AND MEDIAPIPE IS *HANDED* THEM, rather than being pointed at a URL and
//     trusted to find the cache. This is the part that would silently not work
//     if written the obvious way: the Cache API does NOT intercept `fetch`
//     without a service worker, so `cache.put`ing the wasm and then letting the
//     resolver fetch its own URL would download it a second time and the whole
//     exercise would be theatre. So:
//       · the MODEL goes in as `baseOptions.modelAssetBuffer` — a Uint8Array,
//         a documented alternative to `modelAssetPath`;
//       · the WASM goes in as a `blob:` URL on the fileset's `wasmBinaryPath`.
//     `forVisionTasks` is still called, and still decides SIMD vs no-SIMD by
//     its own feature test — we only REPLACE the binary path it chose with a
//     blob of the same file. Hardcoding the SIMD build here would have broken
//     every device without SIMD, silently, in a file nobody re-reads.
//
// EVERY STEP DEGRADES TO ROUND 4's BEHAVIOUR. No `caches` (an insecure origin,
// a private window that disallows it), a cache write that throws, a fetch that
// never succeeds — each falls back to handing MediaPipe the plain URL, which is
// what it always had. The only thing that is never allowed to happen is a
// throw: a selfie step whose framing help is missing still has to take a
// selfie, and idv/capture.jsx round 5 makes sure it does.
import { FilesetResolver, FaceLandmarker } from './vision_bundle.js';

const CACHE_NAME = 'hw-idv-mediapipe-v1';
const FETCH_ATTEMPTS = 3;
const FETCH_BACKOFF_MS = [1000, 3000];
const BOOT_ATTEMPTS = 3;
const BOOT_BACKOFF_MS = [2000, 5000];

const here = new URL('./', import.meta.url).href;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** The Cache API, or null. Absent on an insecure origin and in some private windows. */
async function openCache() {
  try {
    if (typeof caches === 'undefined' || !caches || !caches.open) return null;
    return await caches.open(CACHE_NAME);
  } catch (e) { return null; }
}

/**
 * The bytes at `url`, from the Cache API if they are there and from the network
 * (with retries) if they are not — and written back to the cache on the way
 * past. Resolves null rather than throwing: every caller has a URL fallback.
 *
 * A RESPONSE IS ONLY CACHED WHEN IT IS COMPLETE. `arrayBuffer()` on a truncated
 * body rejects, which is precisely the "unexpected EOF" the owner hit, so the
 * write happens after the read and a half-download can never be stored as if it
 * were the file. Caching a truncated 9 MB wasm would be worse than not caching
 * at all: it would break on every future load and never re-download.
 */
async function bytesFor(url, cache) {
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) {
        const buf = await hit.arrayBuffer();
        if (buf && buf.byteLength) return new Uint8Array(buf);
      }
    } catch (e) { /* a bad cache entry is not a reason to fail */ }
  }
  for (let n = 1; n <= FETCH_ATTEMPTS; n++) {
    try {
      const res = await fetch(url, { cache: 'force-cache', credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = await res.arrayBuffer();
      if (!buf || !buf.byteLength) throw new Error('empty body');
      if (cache) {
        try {
          await cache.put(url, new Response(buf.slice(0), {
            headers: { 'Content-Type': /\.wasm$/.test(url) ? 'application/wasm' : 'application/octet-stream' },
          }));
        } catch (e) { /* over quota, or a browser that refuses. Not fatal. */ }
      }
      return new Uint8Array(buf);
    } catch (e) {
      if (n >= FETCH_ATTEMPTS) {
        try { console.warn('[hw-face] ' + url + ' failed after ' + n + ' attempts: ' + (e && e.message)); }
        catch (e2) { /* no console */ }
        return null;
      }
      await sleep(FETCH_BACKOFF_MS[Math.min(n - 1, FETCH_BACKOFF_MS.length - 1)]);
    }
  }
  return null;
}

/**
 * One boot attempt. `delegate` is 'GPU' or 'CPU'; everything else is the same
 * both ways, so the CPU retry below is one argument rather than a second copy
 * of the options object drifting away from the first.
 */
async function bootOnce(delegate) {
  // The resolver still chooses SIMD vs no-SIMD. We only swap the BINARY it
  // named for a blob of the same bytes, when we have them.
  const fileset = await FilesetResolver.forVisionTasks(here + 'wasm');
  const cache = await openCache();

  let revoke = null;
  try {
    const wasmUrl = fileset && fileset.wasmBinaryPath;
    if (wasmUrl) {
      const bin = await bytesFor(new URL(wasmUrl, here).href, cache);
      if (bin) {
        const blobUrl = URL.createObjectURL(new Blob([bin], { type: 'application/wasm' }));
        revoke = blobUrl;
        fileset.wasmBinaryPath = blobUrl;
      }
    }
  } catch (e) { /* keep the URL the resolver chose */ }

  const modelUrl = here + 'face_landmarker.task';
  let modelBytes = null;
  try { modelBytes = await bytesFor(modelUrl, cache); } catch (e) { modelBytes = null; }

  const baseOptions = modelBytes
    ? { modelAssetBuffer: modelBytes, delegate: delegate }
    : { modelAssetPath: modelUrl, delegate: delegate };

  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: baseOptions,
      runningMode: 'VIDEO',
      numFaces: 2,                    // 2, not 1: "is there more than one face in
                                      // the oval" is a gate, and a detector asked
                                      // for one face can never answer it.
      outputFaceBlendshapes: true,    // eyeBlink* — the blink prompt is verified,
                                      // not merely waited out.
      outputFacialTransformationMatrixes: false,
    });
  } finally {
    // The runtime has compiled the module by now; holding the blob would hold
    // 9.4 MB of it in memory for the life of the page for nothing.
    if (revoke) { try { URL.revokeObjectURL(revoke); } catch (e) {} }
  }
}

window.HWFaceMP = { status: 'loading', landmarker: null, error: null, attempts: 0,
  FaceLandmarker: FaceLandmarker };

function settle(status, lm, err) {
  window.HWFaceMP.status = status;
  window.HWFaceMP.landmarker = lm || null;
  if (err) window.HWFaceMP.error = String((err && err.message) || err);
  try { window.dispatchEvent(new Event('hw-face-mp')); }
  catch (e) { /* no Event ctor: the poller in capture.jsx still sees .status */ }
}

/**
 * BOOT_ATTEMPTS passes, each of them GPU then CPU, 2 s and 5 s apart.
 *
 * A GPU delegate that will not initialise is the common failure on a locked
 * down browser and it is answered inside the pass, because the model is already
 * in hand at that point and a CPU init costs a second rather than a download.
 * A pass that fails BOTH ways is a download or a runtime problem, and that is
 * what the outer retry is for — after the first pass the bytes are in the Cache
 * API, so a second pass is fast and a third is nearly free.
 *
 * `hw-face-mp` is dispatched ONLY when this settles, in either direction. A
 * dispatch between attempts would tell idv/capture.jsx the model had failed
 * while it was still coming, and capture.jsx would draw the fallback copy over
 * a step that was about to get its helper.
 */
(async function run() {
  for (let n = 1; n <= BOOT_ATTEMPTS; n++) {
    window.HWFaceMP.attempts = n;
    try {
      const lm = await bootOnce('GPU');
      settle('ready', lm, null);
      return;
    } catch (gpuErr) {
      try {
        const lm = await bootOnce('CPU');
        settle('ready', lm, null);
        return;
      } catch (cpuErr) {
        if (n >= BOOT_ATTEMPTS) { settle('failed', null, cpuErr || gpuErr); return; }
        try { console.warn('[hw-face] boot attempt ' + n + ' failed: ' + ((cpuErr && cpuErr.message) || cpuErr)); }
        catch (e) { /* no console */ }
        await sleep(BOOT_BACKOFF_MS[Math.min(n - 1, BOOT_BACKOFF_MS.length - 1)]);
      }
    }
  }
  settle('failed', null, new Error('boot exhausted'));
})();
