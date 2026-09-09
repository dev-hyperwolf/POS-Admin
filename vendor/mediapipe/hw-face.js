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
import { FilesetResolver, FaceLandmarker } from './vision_bundle.js';

async function boot() {
  const here = new URL('./', import.meta.url).href;
  const fileset = await FilesetResolver.forVisionTasks(here + 'wasm');
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: here + 'face_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 2,                    // 2, not 1: "is there more than one face in
                                    // the oval" is a gate, and a detector asked
                                    // for one face can never answer it.
    outputFaceBlendshapes: true,    // eyeBlink* — the blink prompt is verified,
                                    // not merely waited out.
    outputFacialTransformationMatrixes: false,
  });
  return landmarker;
}

window.HWFaceMP = { status: 'loading', landmarker: null, error: null, FaceLandmarker: FaceLandmarker };

boot().then(function (lm) {
  window.HWFaceMP.status = 'ready';
  window.HWFaceMP.landmarker = lm;
}, function (err) {
  // A GPU delegate that will not initialise is the common failure on a locked
  // down browser. Try once on CPU before giving up — the model is already
  // downloaded at this point, so the retry costs nothing but a second init.
  return FilesetResolver.forVisionTasks(new URL('./wasm', import.meta.url).href)
    .then(function (fileset) {
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: new URL('./face_landmarker.task', import.meta.url).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true,
      });
    })
    .then(function (lm) { window.HWFaceMP.status = 'ready'; window.HWFaceMP.landmarker = lm; },
      function (e2) {
        window.HWFaceMP.status = 'failed';
        window.HWFaceMP.error = String((e2 && e2.message) || (err && err.message) || e2 || err);
      });
}).then(function () {
  try { window.dispatchEvent(new Event('hw-face-mp')); } catch (e) { /* no Event ctor: the poller still sees .status */ }
});
