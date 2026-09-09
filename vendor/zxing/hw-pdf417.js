// ── vendor/zxing/hw-pdf417.js ── the PDF417 decode worker ───────────────────
//
// WHAT IS VENDORED HERE, AND UNDER WHAT LICENCE. Two different projects, two
// different licences, and both texts ship beside this file because a binary
// distribution of either one has to carry its own:
//
//   zxing-reader.js      zxing-wasm 3.1.3, dist/iife/reader/index.js, verbatim.
//                        MIT — LICENSE-zxing-wasm-MIT.txt (© 2023 Ze-Zheng Wu).
//                        38 049 bytes, sha256 98e44c8063b9aa75…8f450a7a.
//   zxing_reader.wasm    the same package's reader wasm, verbatim. This is
//                        compiled zxing-cpp, which is APACHE-2.0 —
//                        LICENSE-zxing-cpp-Apache-2.0.txt. 1 093 289 bytes,
//                        sha256 2ebda08a93eea3ef…de4c6d1ba, which is the value
//                        the bundle itself exports as ZXING_WASM_SHA256, so the
//                        two halves can be proved to belong together.
//                        zxing-cpp commit a17fd9dc65d6aa0dd2f660fdfca7a6a6613d938f.
//
// (The brief called the whole thing Apache-2.0. The wrapper is MIT and the
// engine underneath it is Apache-2.0 — recorded here rather than rounded off,
// because the file that ships a licence is the file that has to be right about
// which licence it is.)
//
// NOTHING IS PATCHED. Re-vendor with:
//   npm pack zxing-wasm@3.1.3
//   tar xzf zxing-wasm-3.1.3.tgz
//   cp package/dist/iife/reader/index.js   vendor/zxing/zxing-reader.js
//   cp package/dist/reader/zxing_reader.wasm vendor/zxing/zxing_reader.wasm
//   cp package/LICENSE                     vendor/zxing/LICENSE-zxing-wasm-MIT.txt
//
// ── WHY A WORKER ───────────────────────────────────────────────────────────
// A PDF417 decode is 8–14 ms on a laptop and 25–45 ms on a mid-range phone,
// and the capture screen wants one about eight times a second while ALSO
// running a 12 Hz frame analyser and animating a settle ring. On the main
// thread that is a visible stutter on exactly the screen the owner called
// "super buggy". The pixels move as a TRANSFERABLE ArrayBuffer, so handing a
// frame over costs a pointer rather than a 6 MB structured clone.
//
// ── WHY THE WASM BINARY IS FETCHED AND HANDED IN ───────────────────────────
// Two independent reasons, either of which alone would be enough:
//   1. zxing-wasm's DEFAULT `locateFile` points at
//      https://fastly.jsdelivr.net/npm/zxing-wasm — a CDN. This estate serves
//      every vendored artefact from its own origin (see vendor/mediapipe's
//      header), so the default must be overridden, not merely trusted.
//   2. The dev server answers `.wasm` with `application/octet-stream`
//      (wmdemo/server.py's _CTYPES has no `.wasm` entry — measured on
//      127.0.0.1:8793), and `WebAssembly.instantiateStreaming` REFUSES a
//      non-`application/wasm` MIME type. Fetching the bytes ourselves and
//      passing them as `wasmBinary` sidesteps the MIME question entirely and
//      needs no server change.
//
// ── PROTOCOL ───────────────────────────────────────────────────────────────
//   → { type:'init', wasmUrl }                  ← { type:'ready' } | { type:'failed', error }
//   → { type:'scan', id, buf, w, h }            ← { type:'result', id, hit, bytes, quad, ms }
// `buf` is an RGBA ArrayBuffer, transferred. `bytes` is the DECODED BYTE COUNT
// and `quad` the four corner points; THE DECODED CONTENT NEVER LEAVES THIS
// FILE. It is a US licence's name, address and date of birth, the server reads
// it from the image itself under the purpose limits in the Terms, and the
// capture page has no use for it beyond "it decoded".
/* eslint-env worker */
'use strict';

importScripts('./zxing-reader.js');

var ready = false;
var Z = self.ZXingWASM || null;

// tryRotate stays ON: a guest holding a licence at 90° to the guide is a
// completely normal thing to do on a phone and refusing to read it would be
// choosing to be strict about the one thing the decode makes irrelevant.
// tryDownscale is OFF: the region handed over is already cropped to the guide,
// so zxing's own downscale search is re-solving a problem we solved — measured
// at 8.5 ms vs 9.1 ms with no accuracy difference across the whole 420–700 px
// barcode-width sweep.
var OPTS = {
  formats: ['PDF417'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: false,
  tryDownscale: false,
  maxNumberOfSymbols: 1,
  binarizer: 'LocalAverage',
  // 'Hex' would materialise the payload as a string. 'Plain' still fills
  // `text`, which is why nothing below reads it.
  textMode: 'Plain',
};

function boot(wasmUrl) {
  if (!Z || typeof Z.prepareZXingModule !== 'function') {
    self.postMessage({ type: 'failed', error: 'vendor/zxing/zxing-reader.js did not define ZXingWASM' });
    return;
  }
  fetch(wasmUrl, { cache: 'force-cache', credentials: 'omit' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + wasmUrl);
      return r.arrayBuffer();
    })
    .then(function (bin) {
      return Z.prepareZXingModule({ overrides: { wasmBinary: bin }, fireImmediately: true });
    })
    .then(function () {
      ready = true;
      self.postMessage({ type: 'ready' });
    })
    .catch(function (e) {
      self.postMessage({ type: 'failed', error: (e && e.message) || 'zxing wasm did not start' });
    });
}

function toImage(buf, w, h) {
  var arr = new Uint8ClampedArray(buf);
  if (typeof ImageData === 'function') {
    try { return new ImageData(arr, w, h); } catch (e) { /* fall through */ }
  }
  return { data: arr, width: w, height: h, colorSpace: 'srgb' };
}

self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.type === 'init') { boot(m.wasmUrl); return; }
  if (m.type !== 'scan') return;
  if (!ready) { self.postMessage({ type: 'result', id: m.id, hit: false, bytes: 0, quad: null, ms: 0 }); return; }
  var t0 = (self.performance && self.performance.now) ? self.performance.now() : Date.now();
  var img;
  try { img = toImage(m.buf, m.w, m.h); }
  catch (e) { self.postMessage({ type: 'result', id: m.id, hit: false, bytes: 0, quad: null, ms: 0 }); return; }
  Z.readBarcodes(img, OPTS).then(function (res) {
    var t1 = (self.performance && self.performance.now) ? self.performance.now() : Date.now();
    var r = res && res.length ? res[0] : null;
    var hit = !!(r && r.bytes && r.bytes.length);
    var p = hit && r.position ? r.position : null;
    self.postMessage({
      type: 'result',
      id: m.id,
      hit: hit,
      // The LENGTH of the decoded bytes, never the bytes.
      bytes: hit ? r.bytes.length : 0,
      quad: p ? [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft] : null,
      ms: Math.round(t1 - t0),
    });
  }, function () {
    self.postMessage({ type: 'result', id: m.id, hit: false, bytes: 0, quad: null, ms: 0 });
  });
};
