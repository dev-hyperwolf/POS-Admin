// ── shared/hw-sign-page.jsx ── the employee-facing signing page ─────────────
//
// The one page an employee reaches from a write-up "approve and send" or an
// onboarding document-acknowledgement notice: `writeups/send.py` and
// `onboarding/SignaturePortal.js`'s ported successor both mint a
// wmdemo/signed_links.py `signature` link (30d TTL, single-use) and hand the
// recipient a URL; this component is what that URL opens. No console
// session exists at any point in this flow — see shared/hw-link-client.js's
// own header comment for why that file (not shared/hw-live.js) is this
// page's only network seam.
//
// TWO FLOWS, ONE PAGE. `wmdemo/forms_batch3_onboarding.py`'s `ONB_ACK_SIGN`
// FormDef cites BOTH `writeup-pipeline/SignaturePortal.js` AND
// `onboarding/SignaturePortal.js` as its source, and both mint the SAME
// `signature` purpose — but as of `wmdemo/writeups/sign.py` (docs/
// WRITEUPS.md's "Employee e-signature" section), a write-up's own signing
// link carries `subject_kind: "writeup"` and a `writeups:sign` scope that
// 403s against `POST /api/forms/onb_ack_sign/submit` (wrong scope for that
// route, always has). `pickFlow()` below reads the resolved payload's
// `subject_kind` to choose between the two: `subject_kind === "writeup"`
// (with a valid `subject` block — see below) goes to `POST
// /api/writeups/<id>/sign` via `HWLinkClient.submitTo()`; anything else
// keeps the pre-existing `onb_ack_sign` form submission this page has
// always used. `SLUG` below names that onboarding path only.
//
// WHAT THE ONBOARDING FLOW DOES **NOT** HAVE. `GET /api/links/resolve`
// returns exactly `{purpose, subject_kind, subject_id, scopes}` for every
// purpose/subject_kind EXCEPT `signature`/`writeup` — docs/SIGNED-LINKS.md
// is explicit that this is deliberate ("the API must not leak more than the
// employee should see"). For the onboarding flow this page never calls any
// OTHER route to fetch richer subject data (there is no scope on a
// signature link that would let it — `forms:fill:<slug>` grants a WRITE,
// not an `hr:read`), so its "document summary" is built from subject_kind/
// subject_id alone, and its acknowledgement paragraph is generic,
// house-written copy — not the real per-document text GAS's
// `SignaturePortal.js`/`signature_portal.html` embed, which never made it
// into `ONB_ACK_SIGN`'s own `ackText` field (that field is a `section` —
// display-only, no body copy of its own either; see NOTE B below). Flagged
// here rather than silently invented. The write-up flow has no such gap:
// `resolve()`'s additive `subject` block (`{kind, id, level_label,
// incident_date, summary_text, ack_text}`, docs/SIGNED-LINKS.md /
// docs/WRITEUPS.md) carries the real level/date/summary/acknowledgement
// text `sign.py::subject_view()` reads straight off the write-up row, and
// this page renders it verbatim as plain text (no markdown, no HTML) —
// see the `writeup` branch of the `ready`-phase render below.
//
// NOTE A — `docId`. `ONB_ACK_SIGN` requires a `docId` field with, per its
// own source comment, "no channel from a signed link's resolved subject_id
// into a field" — the FormDef has no way to know which record `docId`
// should name. The only per-link data this page has at all is
// `subject_id`, so that is what gets bound to `docId`, automatically and
// invisibly (never shown as an editable box an employee could mistype) via
// a permanently-false `showWhen` below. This is an assumption, not a
// verified contract — whichever backend reads `docId` back off the
// submission must treat it as "the signed link's own subject_id", or this
// binding needs to change on that side.
//
// NOTE B — no visible ack copy from the FormDef itself. shared/hd-form.jsx's
// `FieldRow` renders a `section`-type field as `null` unconditionally (it is
// display-only server-side, but the client renderer never had body text to
// show even when a FormDef field carries one) — so `ackText` produces
// nothing to look at. This page supplies its OWN static acknowledgement
// paragraph beneath the summary line rather than lean on that field.
//
// NOTE C — a required-checkbox gap in hd-form.jsx. `HDForm.validate()`'s
// per-field check (`isEmpty`) does not treat `false` as empty, so a
// required checkbox that was toggled on and back off (value `false`, not
// `undefined`) is NOT caught as "missing" by `HDForm.validate()` alone.
// Out of scope to fix here (hd-form.jsx is a shared renderer this task was
// told to USE, not edit) — worked around defensively in `onSubmit` below by
// re-checking both consent checkboxes are strictly `true` before ever
// calling the network.
//
// IIFE, ONE GLOBAL: window.HWSignPage = { App, mount }. Phone-first, no
// console chrome: no app-rail, no nav, no write-token badge, nothing from
// pos/app.jsx's shell. Local atom shims stand in for five shared/pos/atoms.jsx
// components hd-form.jsx's field renderer needs (`PBtn`, `Check`, `Field`, `Sheet`,
// and via ensureAtomShims ~:96-157). This page never has to load pos/tokens.jsx +
// pos/icons.jsx + the rest of the POS atom stack just to render a signature pad
// and two checkboxes.
;(function () {
  'use strict';
  if (window.HWSignPage) { return; }   // idempotent: two tags, one page

  var SLUG = 'onb_ack_sign';

  // The same default token values shared/hd-form.jsx's own `useP()` fallback
  // already uses when `window.useP` is absent (this page never loads
  // pos/tokens.jsx, so hd-form.jsx's rendered fields already fall back to
  // exactly these values) — kept here too so this page's OWN chrome
  // (heading, summary, banners) matches without needing a shared import.
  var P = {
    ink: '#15140f', inkDim: '#5c584c', inkMute: '#8a8578', bad: '#b3261e', good: '#1c7c34',
    surface: '#fff', surface2: '#f5f4ef', surface3: '#efede4', hairline2: '#e2ded2',
    field: '#fff', fieldBorder: '#d8d4c6', r8: 8, r10: 10, r12: 12,
    fontSans: '-apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif',
    fontMono: '"JetBrains Mono","SF Mono",ui-monospace,monospace'
  };

  var PAGE_STYLE = { maxWidth: 480, margin: '0 auto', padding: '28px 18px 60px', fontFamily: P.fontSans, color: P.ink, background: P.surface, minHeight: '100%', boxSizing: 'border-box' };
  var HEADING_STYLE = { fontSize: 18, fontWeight: 700, marginBottom: 16, lineHeight: 1.3 };
  var SUMMARY_STYLE = { padding: '12px 14px', borderRadius: P.r8, background: P.surface2, border: '1px solid ' + P.hairline2, marginBottom: 16 };
  var ACK_COPY_STYLE = { fontSize: 13, lineHeight: 1.55, color: P.inkDim, marginBottom: 24 };
  // Defensive only -- `sign.py::subject_view()` already falls back to its
  // own generic acknowledgement paragraph when a write-up's draft carries
  // none, so `subject.ack_text` should always be a non-empty string in
  // practice. Used only if that ever isn't true, rather than render nothing.
  var _GENERIC_ACK_TEXT_FALLBACK = 'By signing below, you confirm that you have read and understood this written warning. Acknowledging does not necessarily mean you agree, only that you have received it.';
  var ERROR_LINE_STYLE = { color: P.bad, fontSize: 12.5, marginBottom: 12, lineHeight: 1.4 };

  // ── local atom shims — only what hd-form.jsx's FieldRow/PinSheet touch ──
  function ensureAtomShims() {
    if (!window.PBtn) {
      window.PBtn = function PBtn(props) {
        var lg = props.size === 'lg';
        var h = lg ? 48 : 38, px = lg ? 20 : 16, fs = lg ? 14 : 13;
        var off = !!(props.disabled || props.busy);
        var primary = props.variant === 'primary';
        var bg = off ? P.surface3 : (primary ? P.ink : P.surface);
        var fg = off ? P.inkMute : (primary ? P.surface : P.ink);
        var bd = off ? P.fieldBorder : (primary ? P.ink : P.fieldBorder);
        return React.createElement('button', {
          type: 'button', onClick: off ? undefined : props.onClick, disabled: off,
          style: Object.assign({
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: props.full ? '100%' : 'auto', minHeight: h, padding: '0 ' + px + 'px',
            fontSize: fs, fontWeight: 600, borderRadius: P.r10, background: bg, color: fg,
            border: '1px solid ' + bd, cursor: off ? 'not-allowed' : 'pointer', fontFamily: P.fontSans
          }, props.style)
        }, props.busy ? 'Working…' : props.children);
      };
    }
    if (!window.Check) {
      window.Check = function Check(props) {
        var on = !!props.on, size = props.size || 22;
        return React.createElement('button', {
          type: 'button', role: 'checkbox', 'aria-checked': on,
          onClick: function (e) { e.stopPropagation(); props.onChange(!on); },
          style: {
            width: size, height: size, borderRadius: 6, flex: '0 0 auto', cursor: 'pointer',
            border: '1.5px solid ' + (on ? P.ink : P.fieldBorder), background: on ? P.ink : 'transparent',
            color: P.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.62), lineHeight: 1, padding: 0
          }
        }, on ? '✓' : '');
      };
    }
    if (!window.Field) {
      // Only reachable through hd-form.jsx's PinSheet, which this page's
      // FIELDS never open (no pin_required/pin_stepup field in the form).
      window.Field = function Field(props) {
        return React.createElement('input', {
          value: props.value == null ? '' : props.value, disabled: props.disabled,
          inputMode: props.inputMode, placeholder: props.placeholder,
          onChange: props.onChange,
          style: Object.assign({
            minHeight: 44, padding: '0 13px', borderRadius: P.r8, border: '1px solid ' + P.fieldBorder,
            background: P.field, color: P.ink, font: 'inherit', boxSizing: 'border-box',
            width: props.full === false ? 'auto' : '100%'
          }, props.style)
        });
      };
    }
    if (!window.Sheet) {
      // Renders nothing while closed -- PinSheet is never opened by this
      // page's FIELDS, so this branch is dead code in practice, kept only
      // so React.createElement(window.Sheet, ...) never hits `undefined`.
      window.Sheet = function Sheet(props) {
        if (!props.open) { return null; }
        return React.createElement('div', {
          style: { position: 'fixed', left: 0, right: 0, bottom: 0, background: P.surface, borderTop: '1px solid ' + P.fieldBorder, zIndex: 999 }
        }, props.children);
      };
    }
  }

  // docId's showWhen is permanently false (no field in `data` will ever
  // equal this sentinel) -- see NOTE A above. This both hides the field from
  // FieldRow's render and excludes it from HDForm.compile()'s/validate()'s
  // unconditional-required set, so a pre-filled, never-shown value passes
  // through untouched.
  var HIDDEN_SHOW_WHEN = { field: '_hw_link_subject', equals: '__never__' };

  var FIELDS = [
    { key: 'docId', type: 'text', required: true, showWhen: HIDDEN_SHOW_WHEN },
    { key: 'typedName', type: 'text', required: true, minLength: 1, label: 'Type your full legal name' },
    { key: 'signatureImage', type: 'signature', label: 'Draw your signature (optional — typing your name above is enough)' },
    { key: 'ackAgree', type: 'checkbox', required: true, label: 'I have read and understand this document' },
    { key: 'ackEsignConsent', type: 'checkbox', required: true, label: 'I consent to sign this document electronically' }
  ];

  // A local mirror of wmdemo/forms_batch3_onboarding.py::ONB_ACK_SIGN (wm-demo
  // HEAD 39c44bb) — necessary because a link-scoped credential cannot read
  // `GET /api/forms/<slug>` (that route's own auth tuple is session/key
  // only; only `POST .../submit` was opened to a "link" principal). Field
  // ORDER and KEYS must stay in sync with the server FormDef by hand.
  var DEFINITION = { id: SLUG, slug: SLUG, title: 'Document Acknowledgement & Signature', fields: FIELDS };

  // The write-up flow's own fields -- no `docId` (the id travels as
  // `subject.id`, read straight off `resolve()`, never as a form field to
  // bind), no `ackEsignConsent` (`WriteupSignature`, contracts/index.js, has
  // no e-sign-consent property at all -- `additionalProperties:false` on
  // that schema means sending one would fail contract validation server-
  // side). Unlike the onboarding flow's `signatureImage` (optional --
  // typing a name is enough), the write-up contract requires
  // `signature_png_b64` (`minLength:1`; `sign.py::_decode_signature` 400s on
  // an empty/missing one), so it is `required: true` here.
  var FIELDS_WRITEUP = [
    { key: 'typedName', type: 'text', required: true, minLength: 1, label: 'Type your full legal name' },
    { key: 'signatureImage', type: 'signature', required: true, label: 'Draw your signature' },
    { key: 'ackAgree', type: 'checkbox', required: true, label: 'I have read and understand this write-up, and I am signing it electronically' }
  ];
  var DEFINITION_WRITEUP = { id: 'writeup_sign', slug: 'writeup_sign', title: 'Write-Up Acknowledgement & Signature', fields: FIELDS_WRITEUP };

  // ── pure helpers (no React, no fetch — unit-tested directly from the IIFE
  // via window.HWSignPage._test in test/hw-sign-page.test.mjs) ─────────────

  // Which submit path this resolved link takes. `payload` is `res.body` from
  // a 200 `HWLinkClient.resolve()` whose `purpose` is already known to be
  // `'signature'` (the caller checks that first, same as before this flow
  // split existed). -> 'writeup' | 'onboarding' | null (null means: this
  // page cannot render a form for this link at all -- the caller shows the
  // generic invalid-link error, same as any other resolve failure).
  function pickFlow(payload) {
    if (!payload || typeof payload !== 'object') { return null; }
    if (payload.subject_kind === 'writeup') {
      // Requires the additive `subject` block (docs/SIGNED-LINKS.md /
      // docs/WRITEUPS.md) -- a `writeup` subject_kind link resolved by a
      // server that predates `sign.py`'s wiring, or any other shape defect,
      // has nowhere safe to send a signature (no `subject.id` to build
      // `/api/writeups/<id>/sign` from) and must fail closed, not fall
      // through to the onboarding form's `onb_ack_sign` submit (wrong scope,
      // guaranteed 403, and the wrong summary text besides).
      var subj = payload.subject;
      if (!subj || typeof subj !== 'object' || subj.kind !== 'writeup' || subj.id === undefined || subj.id === null || subj.id === '') {
        return null;
      }
      return 'writeup';
    }
    // Every other subject_kind (onboarding_document/document/onboarding/
    // anything this page has never been told about) keeps the path this
    // page has always taken -- this function only carves the ONE new case
    // (writeup) out of the old default, it never invents a third path.
    return 'onboarding';
  }

  // A base64 PNG data URL prefix, stripped so `signature_png_b64` carries
  // raw base64 -- `WriteupSignature` (contracts/index.js) names the field
  // `..._b64`, not `..._data_url`, and `sign.py::_decode_signature` treats
  // anything starting `data:` as a signal to split it itself, but this page
  // sends the field the contract's own name implies rather than lean on
  // that server-side leniency.
  var DATA_URL_PNG_PREFIX = /^data:image\/png;base64,/;
  function stripPngDataUrl(value) {
    return typeof value === 'string' ? value.replace(DATA_URL_PNG_PREFIX, '') : value;
  }

  // Validates + shapes the write-up flow's HDForm data into the exact
  // `WriteupSignature` contract body (contracts/index.js), OR refuses with a
  // human message before any network call happens. Mirrors NOTE C's
  // defensive re-check for the onboarding flow (`HDForm.validate()` alone
  // does not catch a checkbox toggled on then back off) and additionally
  // enforces what `WriteupSignature`'s own schema enforces server-side
  // (`acknowledged` must be the LITERAL `true`, not merely truthy;
  // `signature_png_b64`/`typed_name` both `minLength:1`) so a bad submit
  // never reaches the network at all. `state` is the HDForm `data` object
  // (`{typedName, signatureImage, ackAgree}`). -> `{ok:true, body}` with
  // `body` ready to POST via `HWLinkClient.submitTo()`, or `{ok:false,
  // error}` with a message safe to show inline.
  function buildSignatureBody(state) {
    if (!state || state.ackAgree !== true) {
      return { ok: false, error: 'Please check the box to confirm before submitting.' };
    }
    var typedName = typeof state.typedName === 'string' ? state.typedName.trim() : '';
    if (!typedName) {
      return { ok: false, error: 'Type your full legal name.' };
    }
    var signaturePngB64 = stripPngDataUrl(state.signatureImage);
    if (typeof signaturePngB64 !== 'string' || !signaturePngB64) {
      return { ok: false, error: 'A signature is required.' };
    }
    return { ok: true, body: { signature_png_b64: signaturePngB64, acknowledged: true, typed_name: typedName } };
  }

  // Classifies a `POST /api/writeups/<id>/sign` response (via
  // `HWLinkClient.submitTo()`, so already collapsed to `{status, body}` /
  // `{status, error}`) into this page's UI vocabulary. `serverError` is
  // `res.error` when present. Kept separate from the fetch call itself so
  // the status table is unit-testable with no network/DOM involved.
  //   201            -> signed screen (sign.py::sign() returns 201 on success)
  //   409            -> already-signed screen (link/write-up already used)
  //   410            -> a fixed, reason-free message -- `SignError(code=
  //                     "gone")` covers rescinded/dismissed/quiet-terminated
  //                     alike, and none of those distinctions is this page's
  //                     business to disclose to the employee, same "one
  //                     generic reason" posture docs/SIGNED-LINKS.md's own
  //                     404 rule takes for resolve/consume.
  //   404/401/403    -> the same generic invalid-link message every other
  //                     failure mode on this page already shows (wrong
  //                     link, wrong subject, wrong scope -- none
  //                     distinguished)
  //   anything else  -> a non-terminal inline submit error (400 validation,
  //                     429 rate limit, 0 network failure) -- the form stays
  //                     up so the employee can retry, same posture the
  //                     onboarding flow's own onSubmit already takes for its
  //                     equivalent fallthrough.
  function mapSignOutcome(status, serverError) {
    if (status >= 200 && status < 300) { return { phase: 'signed' }; }
    if (status === 409) { return { phase: 'already_signed' }; }
    if (status === 410) { return { phase: 'error', msg: 'This write-up is no longer open for signature.' }; }
    if (status === 404 || status === 401 || status === 403) {
      return { phase: 'error', msg: 'This link is no longer valid.' };
    }
    return { phase: 'submit_error', msg: serverError || ('Submit failed (HTTP ' + status + ')') };
  }

  function readTokenFromHash() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) { return ''; }
    var tok;
    try { tok = decodeURIComponent(raw); } catch (e) { tok = raw; }
    // Stripped from the address bar immediately, same reasoning
    // shared/hw-live.js's takeTokenFromURL() gives for its own ?hwtoken=:
    // a token left visible can be screenshotted, pasted into a chat
    // alongside the link, or read out of browser history.
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) { /* private mode, older browser -- token still held in memory */ }
    return tok;
  }

  function subjectLabel(kind) {
    if (kind === 'writeup') { return 'write-up'; }
    if (kind === 'onboarding_document' || kind === 'document') { return 'onboarding document'; }
    return kind ? String(kind) : 'document';
  }

  function Banner(props) {
    var color = props.tone === 'bad' ? P.bad : props.tone === 'good' ? P.good : P.inkDim;
    return React.createElement('div', {
      style: { padding: '20px 16px', borderRadius: P.r10, border: '1px solid ' + P.hairline2, background: P.surface2, marginTop: 48, textAlign: 'center' }
    },
      React.createElement('div', { style: { fontWeight: 700, fontSize: 15.5, color: color, marginBottom: 6 } }, props.title),
      props.body ? React.createElement('div', { style: { fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 } }, props.body) : null);
  }

  function App() {
    // 'loading' | 'error' | 'ready' | 'signed' | 'already_signed'
    var _phase = React.useState('loading'); var phase = _phase[0], setPhase = _phase[1];
    var _msg = React.useState(''); var msg = _msg[0], setMsg = _msg[1];
    var _submitMsg = React.useState(''); var submitMsg = _submitMsg[0], setSubmitMsg = _submitMsg[1];
    var _info = React.useState(null); var info = _info[0], setInfo = _info[1];
    // 'writeup' | 'onboarding' -- which submit path this resolved link
    // takes, decided once by pickFlow() and never re-derived after (see
    // effect 1 below).
    var _flow = React.useState(null); var flow = _flow[0], setFlow = _flow[1];
    var tokenRef = React.useRef('');
    var mountRef = React.useRef(null);
    var formRootRef = React.useRef(null);

    // Resolve once, on mount.
    React.useEffect(function () {
      ensureAtomShims();
      var token = readTokenFromHash();
      tokenRef.current = token;
      if (!token) {
        setPhase('error');
        setMsg('No signing link was found. Open this page from the link you were sent.');
        return;
      }
      if (!window.HWLinkClient) {
        setPhase('error');
        setMsg('This page could not load its network component.');
        return;
      }
      window.HWLinkClient.resolve(token).then(function (res) {
        if (res.status === 200 && res.body) {
          if (res.body.purpose !== 'signature') {
            // Any other purpose (driver_response, ssn_backfill, doc_reupload,
            // lead_verify, onboarding, form_fill) is not what this page
            // renders -- refuse visibly rather than show a signature form
            // for a link that was never minted for one.
            setPhase('error');
            setMsg('This link is not a document-signing link.');
            return;
          }
          var chosenFlow = pickFlow(res.body);
          if (!chosenFlow) {
            // subject_kind is 'writeup' but the resolve payload's `subject`
            // block is missing/malformed -- see pickFlow()'s own comment for
            // why this fails closed instead of falling through to the
            // onboarding form.
            setPhase('error');
            setMsg('This link could not be opened.');
            return;
          }
          setInfo(res.body);
          setFlow(chosenFlow);
          setPhase('ready');
          return;
        }
        if (res.status === 404) {
          // "404 for anything invalid" (docs/SIGNED-LINKS.md) -- never
          // distinguished here, per this task's own hard rule.
          setPhase('error');
          setMsg('This link is no longer valid.');
          return;
        }
        if (res.status === 429) {
          setPhase('error');
          setMsg('Too many attempts on this link. Try again in a few minutes.');
          return;
        }
        setPhase('error');
        setMsg(res.error || 'This link could not be opened.');
      });
    }, []);

    // Mount HDForm's own renderer (for the signature pad + checkboxes) the
    // moment the link resolves, into a DOM node THIS component owns. The
    // definition and onSubmit both depend on which flow was chosen above.
    React.useEffect(function () {
      if (phase !== 'ready' || !mountRef.current || formRootRef.current || !window.HDForm) { return; }

      if (flow === 'writeup') {
        var writeupId = info && info.subject && info.subject.id;
        formRootRef.current = window.HDForm.render(mountRef.current, {
          definition: DEFINITION_WRITEUP,
          mode: 'fill',
          autosave: false,
          initial: {},
          onSubmit: function (payload) {
            var data = payload.data || {};
            var built = buildSignatureBody(data);
            if (!built.ok) {
              setSubmitMsg(built.error);
              return { ok: false, body: { error: { message: built.error } } };
            }
            setSubmitMsg('');
            var path = '/api/writeups/' + encodeURIComponent(String(writeupId)) + '/sign';
            return window.HWLinkClient.submitTo(path, tokenRef.current, built.body).then(function (res) {
              var outcome = mapSignOutcome(res.status, res.error);
              if (outcome.phase === 'signed') {
                setPhase('signed');
                return { ok: true, body: res.body };
              }
              if (outcome.phase === 'already_signed') {
                setPhase('already_signed');
                return { ok: false, body: { error: { message: res.error } } };
              }
              if (outcome.phase === 'error') {
                setPhase('error');
                setMsg(outcome.msg);
                return { ok: false, body: { error: { message: outcome.msg } } };
              }
              // submit_error -- 400/429/0, not a spec'd terminal UI state,
              // the form stays up so the employee can retry.
              setSubmitMsg(outcome.msg);
              return { ok: false, body: { error: { message: outcome.msg } } };
            });
          }
        });
        return;
      }

      // onboarding (default/legacy path, unchanged)
      formRootRef.current = window.HDForm.render(mountRef.current, {
        definition: DEFINITION,
        mode: 'fill',
        autosave: false,
        initial: { docId: (info && info.subject_id != null) ? String(info.subject_id) : '' },
        onSubmit: function (payload) {
          var data = payload.data || {};
          // NOTE C (module docstring): re-check both consent checkboxes are
          // strictly `true` -- HDForm.validate() alone can miss a box that
          // was toggled on then back off.
          if (data.ackAgree !== true || data.ackEsignConsent !== true) {
            var needBoth = 'Please check both boxes to confirm before submitting.';
            setSubmitMsg(needBoth);
            return { ok: false, body: { error: { message: needBoth } } };
          }
          setSubmitMsg('');
          return window.HWLinkClient.submit(SLUG, tokenRef.current, data).then(function (res) {
            if (res.status >= 200 && res.status < 300) {
              setPhase('signed');
              return { ok: true, body: res.body };
            }
            if (res.status === 409) {
              // "the ONE reason consume/submit discloses" (docs/SIGNED-LINKS.md)
              setPhase('already_signed');
              return { ok: false, body: { error: { message: res.error } } };
            }
            if (res.status === 404) {
              setPhase('error');
              setMsg('This link is no longer valid.');
              return { ok: false, body: { error: { message: res.error } } };
            }
            // 400 (validation)/401/403 (wrong scope)/429/0 (network) --
            // not a spec'd distinct UI state, but never dropped silently.
            setSubmitMsg(res.error || ('Submit failed (HTTP ' + res.status + ')'));
            return { ok: false, body: { error: { message: res.error } } };
          });
        }
      });
    }, [phase, info, flow]);

    // Tear down the independent HDForm root once no further interaction is
    // possible, rather than leave it mounted under a node this component
    // is about to stop rendering.
    React.useEffect(function () {
      if (phase !== 'ready' && formRootRef.current) {
        var root = formRootRef.current;
        formRootRef.current = null;
        try { root.unmount(); } catch (e) { /* already gone */ }
      }
    }, [phase]);

    if (phase === 'loading') {
      return React.createElement('div', { style: PAGE_STYLE },
        React.createElement('div', { style: { padding: 40, textAlign: 'center', color: P.inkMute, fontSize: 13.5 } }, 'Loading…'));
    }
    if (phase === 'error') {
      return React.createElement('div', { style: PAGE_STYLE },
        React.createElement(Banner, { tone: 'bad', title: 'Link expired', body: msg }));
    }
    if (phase === 'already_signed') {
      return React.createElement('div', { style: PAGE_STYLE },
        React.createElement(Banner, { tone: 'dim', title: 'Already signed', body: 'This document has already been signed. No further action is needed.' }));
    }
    if (phase === 'signed') {
      return React.createElement('div', { style: PAGE_STYLE },
        React.createElement(Banner, { tone: 'good', title: 'Signed', body: 'Thank you — your signature has been recorded.' }));
    }

    if (flow === 'writeup') {
      var subject = (info && info.subject) || {};
      return React.createElement('div', { style: PAGE_STYLE },
        React.createElement('h1', { style: HEADING_STYLE }, 'Write-Up Acknowledgement & Signature'),
        React.createElement('div', { style: SUMMARY_STYLE },
          subject.level_label
            ? React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 4 } }, String(subject.level_label))
            : null,
          subject.incident_date
            ? React.createElement('div', { style: { fontSize: 12, color: P.inkMute, fontFamily: P.fontMono, marginBottom: subject.summary_text ? 8 : 0 } }, 'Incident date: ' + subject.incident_date)
            : null,
          subject.summary_text
            ? React.createElement('div', { style: { fontSize: 13, color: P.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5 } }, String(subject.summary_text))
            : null),
        React.createElement('p', { style: ACK_COPY_STYLE }, subject.ack_text ? String(subject.ack_text) : _GENERIC_ACK_TEXT_FALLBACK),
        submitMsg ? React.createElement('div', { style: ERROR_LINE_STYLE }, submitMsg) : null,
        React.createElement('div', { ref: mountRef }));
    }

    // ready, onboarding flow
    return React.createElement('div', { style: PAGE_STYLE },
      React.createElement('h1', { style: HEADING_STYLE }, 'Document Acknowledgement & Signature'),
      React.createElement('div', { style: SUMMARY_STYLE },
        React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: P.inkMute, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 4 } },
          'You are being asked to sign a ' + subjectLabel(info && info.subject_kind)),
        (info && info.subject_id != null)
          ? React.createElement('div', { style: { fontSize: 12, color: P.inkMute, fontFamily: P.fontMono } }, 'Reference ' + info.subject_id)
          : null),
      React.createElement('p', { style: ACK_COPY_STYLE },
        'By checking the boxes below and submitting, you confirm that you have reviewed this document, understand ' +
        'its contents, and agree that your typed name and/or drawn signature below are your electronic signature, ' +
        'with the same effect as a handwritten one.'),
      submitMsg ? React.createElement('div', { style: ERROR_LINE_STYLE }, submitMsg) : null,
      React.createElement('div', { ref: mountRef }));
  }

  function mount(el) {
    if (!window.React || !window.ReactDOM) { console.error('HWSignPage.mount: React/ReactDOM must be loaded first'); return null; }
    ensureAtomShims();
    var root = window.ReactDOM.createRoot(el);
    root.render(React.createElement(App));
    return root;
  }

  window.HWSignPage = {
    App: App,
    mount: mount,
    // exposed for tests only -- pure helpers with no React/DOM/network
    // involvement, unit-tested directly in test/hw-sign-page.test.mjs.
    _test: { pickFlow: pickFlow, buildSignatureBody: buildSignatureBody, mapSignOutcome: mapSignOutcome, stripPngDataUrl: stripPngDataUrl }
  };
})();
