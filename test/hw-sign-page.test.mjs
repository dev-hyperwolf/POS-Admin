/* ── shared/hw-sign-page.jsx under node ───────────────────────────────────
 *
 * hw-sign-page.jsx is a `<script type="text/babel">` IIFE, same shape
 * test/hd-form.test.mjs already loads under node: a `vm` context whose
 * global IS `window`, JSX run through the same Babel transform the browser
 * applies (tools/precompile.mjs's own babelOptions). This file only reaches
 * for `window.HWSignPage._test` — the pure helpers `pickFlow()`,
 * `buildSignatureBody()`, `mapSignOutcome()` and `stripPngDataUrl()`, all of
 * which touch no React/DOM/network — so the sandbox needs nothing beyond a
 * bare `window` object; `App`/`mount` (which DO touch React) are never
 * invoked here.
 *
 * Legacy (non-strict) `assert`, deliberately: the module runs inside a vm
 * context with its own realm, so an object literal it hands back is not the
 * same Object/Array constructor as this file's -- `deepStrictEqual` fails on
 * structurally-identical values across that boundary (same reasoning
 * test/hw-link-client.test.mjs's own header comment gives).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIGN_PAGE = path.join(ROOT, 'shared', 'hw-sign-page.jsx');

function babelOptions(filename) {
  return {
    filename,
    presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    sourceMaps: false,
    targets: { browsers: undefined },
  };
}

function loadHelpers() {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const src = fs.readFileSync(SIGN_PAGE, 'utf8');
  const out = Babel.transform(src, babelOptions('shared/hw-sign-page.jsx')).code;
  vm.runInContext(out, ctx, { filename: 'shared/hw-sign-page.jsx' });
  if (!sandbox.HWSignPage || !sandbox.HWSignPage._test) {
    throw new Error('hw-sign-page.test: window.HWSignPage._test did not load');
  }
  return sandbox.HWSignPage._test;
}

const T = loadHelpers();

// ── pickFlow() ───────────────────────────────────────────────────────────

test('pickFlow: writeup subject_kind with a valid subject block -> "writeup"', () => {
  const flow = T.pickFlow({ purpose: 'signature', subject_kind: 'writeup', subject: { kind: 'writeup', id: 'wu_1' } });
  assert.equal(flow, 'writeup');
});

test('pickFlow: onboarding_document subject_kind -> "onboarding"', () => {
  const flow = T.pickFlow({ purpose: 'signature', subject_kind: 'onboarding_document', subject_id: 'doc_1' });
  assert.equal(flow, 'onboarding');
});

test('pickFlow: any other/unknown subject_kind still keeps the legacy "onboarding" path', () => {
  const flow = T.pickFlow({ purpose: 'signature', subject_kind: 'document', subject_id: 'doc_1' });
  assert.equal(flow, 'onboarding');
});

test('pickFlow: writeup subject_kind with NO subject block -> null (missing subject -> generic error)', () => {
  const flow = T.pickFlow({ purpose: 'signature', subject_kind: 'writeup', subject_id: 'wu_1' });
  assert.equal(flow, null);
});

test('pickFlow: writeup subject_kind with a malformed subject.kind -> null', () => {
  const flow = T.pickFlow({ purpose: 'signature', subject_kind: 'writeup', subject: { kind: 'onboarding', id: 'wu_1' } });
  assert.equal(flow, null);
});

test('pickFlow: writeup subject_kind with an empty subject.id -> null', () => {
  const flow = T.pickFlow({ purpose: 'signature', subject_kind: 'writeup', subject: { kind: 'writeup', id: '' } });
  assert.equal(flow, null);
});

test('pickFlow: null/undefined payload -> null, never throws', () => {
  assert.equal(T.pickFlow(null), null);
  assert.equal(T.pickFlow(undefined), null);
});

// ── stripPngDataUrl() ────────────────────────────────────────────────────

test('stripPngDataUrl: strips a data:image/png;base64, prefix', () => {
  assert.equal(T.stripPngDataUrl('data:image/png;base64,AAAABBBB'), 'AAAABBBB');
});

test('stripPngDataUrl: raw base64 with no prefix passes through unchanged', () => {
  assert.equal(T.stripPngDataUrl('AAAABBBB'), 'AAAABBBB');
});

test('stripPngDataUrl: a non-string value passes through unchanged', () => {
  assert.equal(T.stripPngDataUrl(null), null);
  assert.equal(T.stripPngDataUrl(undefined), undefined);
});

// ── buildSignatureBody() ─────────────────────────────────────────────────

test('buildSignatureBody: happy path -> exact WriteupSignature contract shape, data-URL stripped', () => {
  const res = T.buildSignatureBody({ typedName: 'Jamie Rivera', signatureImage: 'data:image/png;base64,AAAABBBB', ackAgree: true });
  assert.equal(res.ok, true);
  assert.deepEqual(res.body, { signature_png_b64: 'AAAABBBB', acknowledged: true, typed_name: 'Jamie Rivera' });
  // additionalProperties:false on WriteupSignature (contracts/index.js) --
  // the body must carry exactly these three keys, nothing else.
  assert.deepEqual(Object.keys(res.body).sort(), ['acknowledged', 'signature_png_b64', 'typed_name']);
});

test('buildSignatureBody: acknowledged false is refused client-side, never reaches the network', () => {
  const res = T.buildSignatureBody({ typedName: 'Jamie', signatureImage: 'data:image/png;base64,AAAA', ackAgree: false });
  assert.equal(res.ok, false);
  assert.match(res.error, /check the box/i);
});

test('buildSignatureBody: ackAgree missing entirely (undefined, not merely falsy in a checked way) is refused', () => {
  const res = T.buildSignatureBody({ typedName: 'Jamie', signatureImage: 'data:image/png;base64,AAAA' });
  assert.equal(res.ok, false);
});

test('buildSignatureBody: missing typedName is refused', () => {
  const res = T.buildSignatureBody({ signatureImage: 'data:image/png;base64,AAAA', ackAgree: true });
  assert.equal(res.ok, false);
  assert.match(res.error, /name/i);
});

test('buildSignatureBody: whitespace-only typedName is refused and never sent untrimmed', () => {
  const res = T.buildSignatureBody({ typedName: '   ', signatureImage: 'data:image/png;base64,AAAA', ackAgree: true });
  assert.equal(res.ok, false);
});

test('buildSignatureBody: typedName is trimmed in the produced body', () => {
  const res = T.buildSignatureBody({ typedName: '  Jamie Rivera  ', signatureImage: 'data:image/png;base64,AAAA', ackAgree: true });
  assert.equal(res.ok, true);
  assert.equal(res.body.typed_name, 'Jamie Rivera');
});

test('buildSignatureBody: missing signatureImage is refused (the contract requires signature_png_b64, minLength 1)', () => {
  const res = T.buildSignatureBody({ typedName: 'Jamie', ackAgree: true });
  assert.equal(res.ok, false);
  assert.match(res.error, /signature/i);
});

test('buildSignatureBody: a missing subject/state object entirely is refused, not thrown', () => {
  const res = T.buildSignatureBody(null);
  assert.equal(res.ok, false);
});

// ── mapSignOutcome() ─────────────────────────────────────────────────────

test('mapSignOutcome: 201 -> signed', () => {
  assert.deepEqual(T.mapSignOutcome(201), { phase: 'signed' });
});

test('mapSignOutcome: 200 (any 2xx) -> signed', () => {
  assert.deepEqual(T.mapSignOutcome(200), { phase: 'signed' });
});

test('mapSignOutcome: 409 -> already_signed', () => {
  assert.deepEqual(T.mapSignOutcome(409), { phase: 'already_signed' });
});

test('mapSignOutcome: 410 -> a fixed, reason-free message', () => {
  const outcome = T.mapSignOutcome(410, 'this write-up has been withdrawn');
  assert.equal(outcome.phase, 'error');
  assert.equal(outcome.msg, 'This write-up is no longer open for signature.');
  // the server's own reason is deliberately never surfaced
  assert.doesNotMatch(outcome.msg, /withdrawn/);
});

test('mapSignOutcome: 404/401/403 -> the same generic invalid-link message', () => {
  const msgs = [404, 401, 403].map((s) => T.mapSignOutcome(s, 'some server detail').msg);
  assert.deepEqual(msgs, ['This link is no longer valid.', 'This link is no longer valid.', 'This link is no longer valid.']);
});

test('mapSignOutcome: 400 -> non-terminal submit_error carrying the server message', () => {
  const outcome = T.mapSignOutcome(400, 'request failed WriteupSignature contract validation');
  assert.equal(outcome.phase, 'submit_error');
  assert.equal(outcome.msg, 'request failed WriteupSignature contract validation');
});

test('mapSignOutcome: 0 (network failure) with no server error falls back to a generic message', () => {
  const outcome = T.mapSignOutcome(0, undefined);
  assert.equal(outcome.phase, 'submit_error');
  assert.equal(outcome.msg, 'Submit failed (HTTP 0)');
});
