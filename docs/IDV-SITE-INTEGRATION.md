# Hyperwolf Verify — integration guide for www.hyperwolf.com

For: Hyper-Tech-inc, who own `hyperwolf-frontend-nextjs` + `hyperwolf-backend`.

Hyperwolf is replacing Didit with its own identity-verification service, **Hyperwolf Verify**
(backend `wm-demo`). Verify speaks the same `/v2` shape your backend already calls today, plus a
modern `/v3` API and a signed webhook if you want to move off polling. This doc covers the cutover,
in the order you'll actually do the work. Full field/route reference: `docs/IDV-API-CONTRACT.md`.

## 1. What changes, and what doesn't

Nothing in your code changes. Three environment variables move, one CSP line gets a new host, and
a header you're **already sending** starts actually being checked.

### 1.1 The three env vars (backend only, `.env`)

```
DIDIT_API_BASE_URL=<Verify's base URL — ask us for it; Render demo or the AWS-ported box>
DIDIT_API_KEY=<a Verify API key, created in Verify → Integrate, scopes sessions:read + sessions:write>
DIDIT_WORKFLOW_ID=<the Verify workflow id for "Cannabis Verification + Selfie">
```

These are the same three names in your `.env.example` today (lines 137-140). Repoint them; don't
rename them; no other file reads them except `common/utils.js:75` (`combineBaseurl`, the `didit`
platform case) and `controllers/didit/didit-controllers.js` (lines 3, 127-129, 156, 280, 295, 311).

We'll hand you the base URL and cut the API key for you in the Verify console
(`POST /api/idv/api-keys`, `scopes: ["sessions:read", "sessions:write"]`) — the plaintext key is
shown once, so treat it like any other secret. The workflow id comes from the Integrate screen once
we've confirmed "Cannabis Verification + Selfie" as the workflow to mirror (our seeded default).

### 1.2 The CSP change (frontend, `next.config.ts`)

Your `frame-src` directive currently allows Didit's hosted iframe host:

```
frame-src 'self' ... https://verify.didit.me ...
```

Add (or replace, once Didit is fully retired) Verify's hosted-capture host — the domain
`IDV_PUBLIC_BASE` resolves to on our side (we'll give you the exact value, e.g. a Render
`onrender.com` subdomain today, or the AWS-ported domain once that's live):

```
frame-src 'self' ... https://verify.didit.me https://<verify-public-host> ...
```

Skip this and the iframe loads blank with no console error you'll recognize as CSP. `connect-src`
needs no change: REST calls still go through your own backend proxy, never browser-to-Verify.

### 1.3 The header you already send is now load-bearing

Your code already sets this on every Didit call:

```js
headers: { "x-api-key": process.env.DIDIT_API_KEY }
```

Didit's real `/v2` never checked it. **Verify's `/v2` facade does.** No key, an unrecognized key, a
revoked key, or a key missing the route's scope is now **403 `{ "error": "..." }`** — never 401.
The only failure mode to watch for: base URL repointed, key left as a placeholder or old Didit
value → every call 403s. Set a real Verify key and your existing send path carries it, zero code
changes.

```
POST /v2/session                 needs a key with scope sessions:write
GET  /v2/session/{id}/decision   needs a key with scope sessions:read
```

One key with both scopes covers both routes (that's what we'll issue you).

### 1.4 Response fields your code reads — unchanged, still there

`GET /v2/session/{id}/decision` keeps returning exactly what `getSessionId` and `getStatus` parse
today:

```jsonc
{
  "status": "Approved",                 // response.status — you read this directly
  "id_verification": {                  // response.id_verification — your exact field name, kept as an alias
    "first_name": "...", "last_name": "...", "full_name": "...",
    "date_of_birth": "...", "date_of_issue": "...", "expiration_date": "...",
    "address": "...", "parsed_address": { "city": "...", "region": "...", "postal_code": "...", "country": "..." },
    "gender": "...", "document_number": "...",
    "front_image": "https://.../media/...", "back_image": "https://.../media/..."
  },
  "face_match": {
    "target_image": "https://.../media/..."   // response.face_match.target_image — your exact path, kept
  },
  "kyc": { /* identical object to id_verification, plus "age" — the field we'd like you to migrate to eventually */ }
}
```

`kyc`, `id_verification`, and `face_match` are three names on the **same underlying node** — we emit
all three so nothing in `getSessionId` (`didit-controllers.js:153-274`) needs to change today.
`id_verification`/`face_match.target_image` are permanent aliases, not a deprecation trap; migrate
to `kyc` at your own pace for the extra `age` field — no forcing function.

## 2. Status vocabulary — this is the one real behavior change

**Verify never returns `"In Review"` for a session it decides.** Approve or deny, period — that
was an explicit product ruling, not an oversight. The literal survives only on **imported
historical Didit sessions** (pre-cutover data); any session created through your `/v2/session` or
`/v3/session/` calls after cutover will never carry it.

Full status set you may see on a native session: `Not Started`, `In Progress`, `Awaiting User`,
`Approved`, `Declined`, `Abandoned`, `Expired`, `Resubmitted`. Here's what each means and what your
polling loop should do:

| Status | Meaning | What to do |
|---|---|---|
| `Not Started` | Session created, guest hasn't opened the capture page yet | Keep polling |
| `In Progress` | Guest is actively going through document/selfie capture | Keep polling |
| `Awaiting User` | Engine found one weak step (blur, glare, bad angle, failed liveness), guiding the guest to redo just that step, up to 3 tries | Keep polling — normal mid-flow, not a failure; the hosted page itself shows the guest what to fix |
| `Approved` | Terminal, verified | **Stop polling.** Proceed with signup/checkout exactly as today |
| `Declined` | Terminal, failed (hard signal, or retries exhausted) | **Stop polling.** Show the failure — current toast behavior works unchanged; a `next_step` hint (`"in_store"`/`"none"`) is available if you want to surface it |
| `Abandoned` | Guest closed the tab/window before finishing | **Stop polling.** Treat like `Declined` for UI purposes — offer to restart via a fresh `create/url` call |
| `Expired` | Session TTL passed before completion | **Stop polling.** Same as `Abandoned` — a fresh `create/url` call is required, the old session id is dead |
| `Resubmitted` | An analyst issued a new link after a decline (support flow, not typical for your journeys) | Keep polling — it will move to `In Progress` next |

**Remove the `'In Review'` branch entirely.** Two places currently special-case it and both need
to change:

1. `components/auth/didit-verification-modal.tsx:40` polls for
   `['Approved', 'Declined', 'In Review']`. Change to `['Approved', 'Declined', 'Abandoned',
   'Expired']` (or invert: `status !== 'In Progress' && status !== 'Awaiting User' && status !==
   'Not Started'`).
2. `checkout-container.tsx:729-741` currently lets `'In Review'` place an order:
   ```js
   if (status === 'Approved' || status === 'In Review') {
       await finalizeRegistrationAndOrder(sessionId)
   }
   ```
   Change to `if (status === 'Approved')` only. **This closes a real gap** — today an order can be
   placed before verification actually finished being decided. With Verify there is no
   "in-between-but-good-enough" state to fall back on; `Approved` is the only status that means
   "this person is verified."

`signup-form.tsx:143-175`'s `handleDiditComplete` only special-cases `'Declined'` today and treats
everything else as success — that logic happens to keep working, since `Awaiting User`/`In
Progress` will simply keep the modal polling rather than falling through, but we'd still recommend
tightening it to an explicit `status === 'Approved'` check for the same reason as checkout.

## 3. Recommended upgrade: replace polling with the signed webhook

Polling every 8 seconds works and needs no site change beyond §2, but an approved guest who closes
the tab is never recorded — your backend only learns the outcome if the browser is still there to
ask. The fix: a webhook, so Verify calls you the moment a decision is made.

### 3.1 Register a destination

In the Verify console (or via API): `POST /api/idv/webhooks` with `{ "url": "https://<your-backend>/api/v1/didit/webhook", "events": ["status.updated", "data.updated"] }`. The response includes a
`secret` **shown once** — store it as `DIDIT_WEBHOOK_SECRET` in your `.env`.

### 3.2 What arrives

```jsonc
POST https://<your-backend>/api/v1/didit/webhook
X-Signature-V2: <hex hmac-sha256>
X-Timestamp: 1757347200

{
  "event_id": "evt_9f2a...",
  "event": "status.updated",
  "session_id": "...",
  "session_number": 14146,
  "status": "Approved",
  "workflow_id": "...",
  "vendor_data": "email:8f3a2c...",
  "timestamp": "2026-09-08T20:15:00Z",
  "decision": { /* full V3 decision shape, or just the changed node for data.updated */ }
}
```

Verify retries a failed delivery (no 2xx within 5 seconds, or a non-2xx response) at **60 seconds**,
then **240 seconds**, then marks it `dead` — visible on the Integrate screen's delivery log if you
ever need to check what was sent.

### 3.3 Full Express receiver (Node, `crypto`)

```js
// routes/didit/didit-webhook-route.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET;
const MAX_SKEW_SECONDS = 300;

// Canonical JSON: sorted keys, compact separators, floats rounded to <= 2 decimals.
function canonicalize(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  }
  if (typeof value === 'number' && !Number.isInteger(value)) return String(Math.round(value * 100) / 100);
  return JSON.stringify(value);
}

function verifySignature(rawBody, timestamp, signatureHeader, secret) {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(now - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: 'timestamp skew' };
  const signedString = `${timestamp}.${canonicalize(JSON.parse(rawBody))}`;
  const expected = crypto.createHmac('sha256', secret).update(signedString).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signatureHeader || ''), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' };
  return { ok: true };
}

// Dedupe table — swap this Set for a real collection (unique index on event_id, TTL a few days).
const seenEventIds = new Set();

// Needs the RAW body: mount with express.raw() before any express.json() body parser.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signature = req.header('X-Signature-V2');
  const timestamp = req.header('X-Timestamp');

  const check = verifySignature(rawBody, timestamp, signature, WEBHOOK_SECRET);
  if (!check.ok) {
    console.error('Didit/Verify webhook rejected:', check.reason);
    return res.status(403).send({ error: check.reason });
  }

  const payload = JSON.parse(rawBody);
  if (seenEventIds.has(payload.event_id)) return res.status(200).send({ received: true, duplicate: true });
  seenEventIds.add(payload.event_id);

  res.status(200).send({ received: true }); // respond fast, well under 5s, then do the slow work

  try {
    if (payload.event === 'status.updated') {
      await applyVerificationStatus(payload.session_id, payload.status, payload.decision);
    } // 'data.updated' corrects a field on an already-decided session — log it if you want an audit trail
  } catch (err) {
    // Do not retry here — Verify already has a retry ladder; the next poll/webhook reconciles.
    console.error('Error applying webhook payload:', err);
  }
});

module.exports = router;

async function applyVerificationStatus(sessionId, status, decision) {
  const member = await BlazeUser.findOne({ diditSessionId: sessionId });
  if (!member) return; // session predates this member row, or was created out-of-band
  // ... whatever createSessionId/getStatus does today, but triggered by the webhook instead of
  // the browser's poll. Keep the poll running as a fallback during the migration.
}
```

Mount it the same way as the existing three routes:
```js
app.use('/api/v1/didit', require('./routes/didit/didit-webhook-route'));
```

### 3.4 Correlate sessions properly while you're in here

Today's `createDiditSession()` (`didit-controllers.js:122-140`) sends **only** `{ workflow_id }` —
no `vendor_data`, no `expected_details`. Verify, like Didit before it, has no idea which customer a
session belongs to; correlation happens entirely on your side, keyed by email in Mongo.

Optional, not required for cutover, but worth doing while you're in this file — send two more
fields on create:

```js
const diditReq = {
    body: {
        workflow_id: diditWorkFlowID,
        vendor_data: `email:${crypto.createHash('sha256').update(email).digest('hex')}`,
        expected_details: {
            first_name: existingMember?.userData?.firstName,
            last_name: existingMember?.userData?.lastName,
        }
    },
    headers: { "x-api-key": process.env.DIDIT_API_KEY }
};
```

`vendor_data` lets Verify's console show you which of your customers a session belongs to
independent of your own database, and `expected_details` turns on name-match cross-checking
(`NAME_MISMATCH_EXPECTED`) against whatever the guest types on your signup form before they ever
scan a document.

## 4. Medical guests (18–20-year-olds)

Verify added a doctor's-recommendation verification step inside the **hosted flow only** — nothing
on your site needs to change to support it. The guest sees a new "Under 21? Add your doctor's
recommendation" prompt inside the same iframe, uploads a photo of the recommendation, and Verify's
engine reads and validates it (California physician-license format, name/DOB cross-check against
the ID, expiry) before deciding.

**Practical effect for you:** a guest aged 18–20 can now come back from the same verification flow
with `status: "Approved"` instead of always being declined for `UNDER_AGE`. You don't need to
detect or branch on this — `Approved` means approved, whichever path got them there.

If you ever want to *show* that a guest came through the medical path (e.g. for internal reporting,
not required for checkout to work), the decision payload carries it:

```jsonc
"decision": {
  "medical_recommendations": [{
    "status": "Approved",           // decision.medical_recommendations[0].status
    "expiration_date": "2027-03-01"
  }]
}
```

The person record (via the people/directory API, not something your current integration touches)
carries `medical_rec_expires_at`, so a returning guest inside that validity window isn't asked for
the same paperwork twice.

## 5. Terms and consent

The hosted verification flow now shows a consent screen before capture starts: a link to Hyperwolf's
Terms & Conditions, plus a **separate, unbundled checkbox** for biometric (face template) retention.
Declining the biometric checkbox still lets the guest complete verification — it just means their
selfie and face template are purged after the decision instead of retained for faster return
verification later; the licence-derived data is kept regardless, for fraud-prevention purposes only.

**Action required before go-live, not optional:** the production Hyperwolf Terms & Conditions page
needs updating to actually cover this — California Civil Code § 1798.90.1 (scanning a driver's
license) and CPRA biometric consent aren't addressed today. Draft clause for counsel:
`docs/IDV-TERMS-CLAUSE-DRAFT-2026-09-08.md` — **a draft for licensed counsel, not legal advice.**
Nothing points real guests at the hosted flow in production until that review lands and the Terms
page is live.

## 6. Deployment notes

- **Verify backend** ("wm-demo") runs as a Render web service today (demo), with an AWS port
  (ECS/EC2) planned as a same-container lift — one URL changes, nothing gets rewritten.
- **Engine** (`idv-engine/`) is a separate Docker container doing the OCR/face-match/liveness work,
  built and tested for **x86-64** only. If it's ever run on arm64 (e.g. Graviton), the MediaPipe
  wheel needs re-verifying on that architecture before trusting liveness results — untested there.
- Backend-side env vars, for context if you're troubleshooting with us (not yours to set):
  `IDV_ENGINE_URL` (backend → engine, private network), `IDV_ENGINE_SECRET` (HMAC between the two;
  unset means every engine callback fails closed — the safe direction), `IDV_MEDIA_DIR`
  (document/selfie storage — **must be a persistent volume**, or images vanish on redeploy),
  `IDV_PUBLIC_BASE` (the origin baked into hosted capture URLs — also the host you add to
  `frame-src`, §1.2), `IDV_FRAME_ANCESTORS` (who may iframe the hosted page; defaults already
  include `https://www.hyperwolf.com` and `https://hyperwolf.com`).
- **The engine's callback must reach the backend** — same private network today; if the backend
  moves (e.g. to AWS) before the engine does, re-verify this path or jobs silently never complete.
- **Document images, selfies, and face templates never leave the Verify backend's own origin** —
  the URLs your code already downloads from (`front_image`, `back_image`, `target_image`) are
  short-lived, backend-served links, same as with Didit today, never raw bytes from the engine.

## 7. Test plan

Use a sandbox API key (ask us for one — same scopes, pointed at a non-production workflow) so test
sessions don't mix into real verification data.

```bash
# 1. Create a session (mirrors what createDiditSession() does)
curl -s -X POST "$DIDIT_API_BASE_URL/v2/session" \
  -H "x-api-key: $SANDBOX_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "'"$DIDIT_WORKFLOW_ID"'"}'
# Expect: 200 { "session_id": "...", "url": "https://.../verify/...", "status": "Not Started", ... }

# 2. Missing/bad key — confirm the 403 behavior you'll see in prod if the env var is wrong
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$DIDIT_API_BASE_URL/v2/session" \
  -H "x-api-key: wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "'"$DIDIT_WORKFLOW_ID"'"}'
# Expect: 403

# 3. Open the returned `url` in a browser (or embed it in a local copy of the modal) and complete
#    a test document + selfie capture using a real (non-production) ID.

# 4. Poll the decision endpoint — this is exactly what getStatus() does
curl -s "$DIDIT_API_BASE_URL/v2/session/<session_id>/decision" \
  -H "x-api-key: $SANDBOX_KEY"
# Expect during capture: {"status": "In Progress", ...} or {"status": "Awaiting User", ...}
# Expect after a completed capture: {"status": "Approved", "id_verification": {...}, "face_match": {...}}
#   or {"status": "Declined", ...} — never "In Review".

# 5. If you've wired the webhook (§3), confirm delivery instead of relying on step 4:
#    the Verify console's Integrate → Webhooks → Deliveries log shows each attempt, its response
#    code, and whether it was retried.
```

**Where to watch it live:** the Verify console's Sessions table shows your test session appear
within a second or two of step 1, and the session detail page shows each capture step, the
decision nodes, and — for a `Declined` session — the exact reason code. Ask us for the console URL
and a viewer-role login for your test window.
