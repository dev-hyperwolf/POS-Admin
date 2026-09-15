# www.hyperwolf.com: Didit → Hyperwolf Verify — dev change list

For: Hyper-Tech-inc (`hyperwolf-frontend-nextjs` + `hyperwolf-backend`). Read `docs/IDV-SITE-INTEGRATION.md`
first — this file is the checklist version of it, re-derived line-by-line against your actual
source (not the other way around). Everything below was verified against the real files in
`hyperwolf-frontend-nextjs` and `hyperwolf-backend` on 2026-09-15, and against the real Verify
backend source (`wm-demo/wmdemo/idv_api.py`, `idv_webhooks.py`, `idv_store.py`, `server.py`) on the
same date. Two small inaccuracies found in `IDV-SITE-INTEGRATION.md` while doing this were fixed in
place (noted in §6).

**Bottom line: this is a 3-line code change plus 3 env vars.** Nothing else in your code has to
move. Total engineering time for the required cutover: **~2.5–3.5 hours**, mostly testing. An
optional but recommended follow-up (webhook instead of polling) is another **~2 hours**, separately
schedulable.

---

## 1. Field-by-field match table

Every request the site sends to Didit today, and every field it reads back, checked against what
Verify's `/v2` facade actually accepts and returns (`wmdemo/idv_api.py:5719-5813`).

### 1.1 `POST /v2/session` (site → Verify)

| Site sends (`didit-controllers.js:125-128`) | Verify's `/v2/session` accepts (`_create_session_row`, `idv_api.py:2639`) | Match |
|---|---|---|
| `workflow_id` | `workflow_id` (required; falls back to the seeded default workflow if omitted — `idv_api.py:5735-5740`) | **MATCH** |
| *(nothing else sent)* | optional: `vendor_data`, `callback`, `callback_method`, `metadata`, `expected_details`, `contact_details`, `language`, `store_id`, `associate_id` | not sent, not required — see §5 optional upgrade |
| header `x-api-key: <DIDIT_API_KEY>` | **required**, scope `sessions:write` (`_api_key_gate`, `idv_api.py:5733`) | **MATCH, but now enforced** — this is the one real behavior change; see §2 |

Response, site reads `data?.url` and `data?.session_id` (`didit-controllers.js:131-134`):

| Verify returns (`idv_api.py:5746-5749`) | Site reads | Match |
|---|---|---|
| `session_id` | `data.session_id` | **MATCH** |
| `session_token` | *(not read)* | harmless extra field |
| `url` | `data.url` | **MATCH** |
| `status` | *(not read here)* | harmless extra field |
| `workflow_id` | *(not read)* | harmless extra field |
| `vendor_data: null` (site never sent one) | *(not read)* | **MATCH** |

### 1.2 `GET /v2/session/{id}/decision` (site → Verify, 3 call sites)

Called from `getSessionId` (`didit-controllers.js:153-274`), `getStatus`
(`didit-controllers.js:277-291`), `diditCheck` (`didit-controllers.js:293-300`), **and a fourth,
undocumented-until-now site**: `diditCustomerStatus` in
**`controllers/blaze/user-auth-controllers.js:397-417`** — a copy-pasted duplicate, not shared code,
that also reads `process.env.DIDIT_API_KEY` directly and gates `/register` on
`diditStatus === "Approved"`. Same env var covers it; no separate code change.

| Field the site reads (file:line) | Verify's `/v2` decision emits (`_v2_aliases`, `idv_api.py:5767-5813`) | Match |
|---|---|---|
| `response.status` | `status` (top-level, always the live session status) | **MATCH** |
| `response.id_verification.first_name` | `id_verification.first_name` (alias of `kyc`) | **MATCH** |
| `.last_name`, `.full_name`, `.date_of_birth`, `.date_of_issue`, `.expiration_date`, `.address`, `.gender`, `.document_number` | same names, same nesting | **MATCH** |
| `.parsed_address.city/region/postal_code/country` | same nesting | **MATCH** |
| `.age` (`getSessionId` reads `parsed.age`) | `kyc`/`id_verification.age` — present | **MATCH** |
| `.front_image`, `.back_image` | `id_verification.front_image/back_image` | **MATCH** |
| `response.face_match.target_image` | `face_match.target_image` | **MATCH** |
| header `x-api-key` | **required**, scope `sessions:read` | **MATCH, now enforced** — same behavior change as §1.1 |

`kyc`, `id_verification`, and `face_match` are three names over the **same** underlying decision
node (`idv_api.py:5777-5813`) — verified byte-for-byte against what the site's four call sites
actually dereference. No field the site reads is missing, renamed, or re-nested.

### 1.3 Status vocabulary

| Site behavior | File:line | Verify's actual status set |
|---|---|---|
| Poll every 8000 ms | `didit-verification-modal.tsx:47` (`setInterval(..., 8000)`) | rate limit is 600 GET/min per key — see §7 scale note |
| Stop-poll list: `['Approved','Declined','In Review']` | `didit-verification-modal.tsx:40` | Verify **never emits `In Review`** for a native session (`idv_rules.evaluate` cannot return it — contract addendum "round 3, A"). It stays in the enum only on **imported** historical Didit rows. |
| Checkout finalizes order on `status === 'Approved' \|\| status === 'In Review'` | `checkout-container.tsx:731` | Same — `In Review` never arrives from a native session |
| `handleDiditComplete` treats anything but `'Declined'` as success | `signup-form.tsx:143-175` | Works today because `Awaiting User`/`In Progress` just keep the modal polling; recommend tightening (optional, §5) |

**MISMATCH (behavioral, not a field/type bug):** the modal's stop-list and the checkout gate both
assume `In Review` is a real terminal outcome from a native session. It never will be again. Two
required fixes — §2.

### 1.4 Hosted `url` / iframe embed

| Item | Site | Verify | Match |
|---|---|---|---|
| Embed method | `<iframe src={url} allow="camera; microphone; fullscreen; autoplay; encrypted-media">` (`didit-verification-modal.tsx:83-88`), no `sandbox` attribute | hosted capture page at `/verify/{token}`, serves `Content-Security-Policy: frame-ancestors 'self' https://www.hyperwolf.com https://hyperwolf.com` (`idv_api.py:2147-2151`, `frame_ancestors()` at `idv_api.py:268-271`) | **MATCH** — your two production hosts are in the default `IDV_FRAME_ANCESTORS` already |
| `X-Frame-Options` / `Permissions-Policy` | not sent by your Next.js app for this page | **not set at all** by Verify (only CSP `frame-ancestors`) | **MATCH by omission** — nothing blocks the camera grant your `allow=` attribute already delegates |
| CSP `frame-src` (your side) | needs the Verify host added — see §2 | n/a | **required config change**, not a code bug |
| CSP `connect-src` (your side) | no change | REST calls are server-to-server (Next.js server action → `HYPERWOLF_BASE_URL` → Express `hyperwolf-backend` → Verify); the browser never talks to Verify directly | **MATCH, confirmed**: `lib/api/services/common.ts:215-224` and `app/actions/common.ts:27,45` route through your own `apiClient` (`baseURL: HYPERWOLF_BASE_URL`), not Verify |

### 1.5 CORS

Not applicable. Verified the full call chain: browser → Next.js Server Action
(`app/actions/common.ts`) → `apiClient` (`lib/api/client.ts:33`, `baseURL: HYPERWOLF_BASE_URL`) →
Express `hyperwolf-backend` (`controllers/didit/didit-controllers.js`) → Verify. The browser only
ever loads Verify's `url` inside the iframe (top-level navigation inside the frame, not a
fetch/XHR), so no CORS headers are needed on either side. **No mismatch, no action.**

### 1.6 Error shape

| Site | Verify |
|---|---|
| Catches every failure generically and replies to its own frontend with `{ message: authUserMsg.WRONG_ERROR }` (400) — never forwards Verify's raw error body | `{ "error": "<sentence>" }`, `403` for auth/scope failures (never `401`), `404`, `409`, `429`, `500` (`idv_api.py:298-309`) | **MATCH, and isolated** — because the site never proxies Verify's error text to its own users, the `error` vs `message` key difference between the two hops never surfaces. No action needed, but see §2's "silent 403" trap. |

### 1.7 Rate limits vs. poll cadence

`RATE_GET_PER_MIN = 600`, `RATE_WRITE_PER_MIN = 300`, **per API key** (`idv_api.py:176-177`,
enforced in `_api_key_gate`). The site's poll is 1 GET / 8 s = 7.5 GET/min **per open modal**, and
every guest verifying at once shares the one server-side key. `600 / 7.5 ≈ 80` concurrent open
verification modals before the key starts getting `429`. Not a blocker at today's volume, but a
real ceiling — see §7.

### 1.8 API key format

Verify mints keys as `hwv_live_<24 random bytes, url-safe>` (`idv_store.py:3352`), stored only as a
SHA-256 hash (`find_api_key`, `idv_store.py:3364-3369`) — any string the site sends as
`x-api-key` is looked up verbatim, no prefix/format validation. The site's code never parses or
validates the key it sends (`process.env.DIDIT_API_KEY` goes straight into a header), so **the site
accepts a Verify key as-is, unmodified.** No "sandbox" key namespace exists — a sandbox key is the
same format, pointed at a separate (non-production) workflow.

---

## 2. Required code changes — the "In Review" removal

This is the entire required code diff. Two files, one line each.

### 2.1 `hyperwolf-frontend-nextjs/components/auth/didit-verification-modal.tsx:40`

```diff
- if (['Approved', 'Declined', 'In Review'].includes(status)) {
+ if (['Approved', 'Declined', 'Abandoned', 'Expired'].includes(status)) {
```

Without this, a guest whose Verify session goes `Abandoned` or `Expired` (closed the tab, session
TTL passed) leaves the modal polling forever at 8 s intervals — it was never a problem against real
Didit only because `In Review` was the (mis-handled but present) terminal signal being waited for;
Verify has no such fallback since it never emits it.

**Estimate: 15 min** (one-line change + local click-through).

### 2.2 `hyperwolf-frontend-nextjs/components/checkout/checkout-container.tsx:731`

```diff
- if (status === 'Approved' || status === 'In Review') {
+ if (status === 'Approved') {
```

This *closes a real gap*, it doesn't just clean one up: today an order can be placed on an
`In Review` decision that hasn't actually been decided yet. Verify has no
"good-enough-but-not-final" state — `Approved` is the only status that means "place the order."

**Estimate: 15 min** (one-line change + one manual checkout run).

### 2.3 The env vars

Set in the backend's deployment env (Render/hosting panel today; mirrors `.env.example:137-140`
locally):

| Var | Old value | New value |
|---|---|---|
| `DIDIT_API_BASE_URL` | Didit's real base URL | Verify's base URL — `https://hyperwolf-wm-demo.onrender.com` today (Render demo); ask for the AWS-ported URL once that lifts |
| `DIDIT_API_KEY` | Didit key | a Verify key minted with **both** `sessions:read` and `sessions:write` scopes (`POST /api/idv/api-keys`) — one key covers `POST /v2/session` and `GET /v2/session/{id}/decision` |
| `DIDIT_WORKFLOW_ID` | Didit workflow id | Verify's `"Cannabis Verification + Selfie"` workflow id (`idv_store.DEFAULT_WORKFLOW_NAME`, `idv_store.py:77`) — ask for the id, or omit `workflow_id` entirely: `/v2/session` falls back to this same default workflow automatically if the field is missing (`idv_api.py:5735-5740`) |

**Do not rename these three vars.** `common/utils.js:75/110-111`, `didit-controllers.js` (lines 3,
127-129, 156, 280, 295, 311), and `user-auth-controllers.js:408` all read them by these exact
names. Repointing the values is the entire "integration" on the config side.

**Estimate: 15 min to set, once we hand you the URL/key/workflow id.**

### 2.4 CSP: `hyperwolf-frontend-nextjs/next.config.ts:80`

```diff
- "frame-src 'self' https://www.google.com https://*.google.com https://verify.didit.me https://*.withpersona.com ...",
+ "frame-src 'self' https://www.google.com https://*.google.com https://verify.didit.me https://hyperwolf-wm-demo.onrender.com https://*.withpersona.com ...",
```

Keep `verify.didit.me` in the list until Didit is fully decommissioned (imported/legacy sessions
may still reference it); add Verify's host alongside it, not in place of it, for this cutover.
Skip this and the iframe loads **blank with no recognizable CSP console error** — it just silently
fails to render.

**Estimate: 15 min** (one line + a redeploy to confirm the CSP header actually changed — `next.config.ts` CSP values are baked in at build time on some hosts, not read at runtime).

### 2.5 Total required-cutover estimate

| Step | Time |
|---|---|
| Set 3 env vars (once we hand you the values) | 0.25 h |
| `next.config.ts` CSP line + redeploy verification | 0.5 h |
| `didit-verification-modal.tsx:40` | 0.25 h |
| `checkout-container.tsx:731` | 0.25 h |
| End-to-end smoke test: signup flow + checkout flow against a sandbox key (§8) | 1–1.5 h |
| Buffer for a real deploy/rollback cycle | 0.5 h |
| **Total** | **~2.5–3.5 h** |

---

## 3. What stays untouched (verified, not assumed)

- `common/utils.js` — `combineBaseurl`'s `"didit"` case, `getRequest`/`postRequest`/`removeRestHeaders` — no change. `x-api-key` already survives `removeRestHeaders` (`utils.js:130-132`, strips only `host`/`postman-token`).
- `didit-controllers.js` — `createDiditSession`, `getSessionId`, `getStatus`, `diditCheck` — every field mapping verified against Verify's actual `/v2` response in §1.2. Zero changes.
  - Note (informational, not a bug): `diditCheck`'s `status === "In Review"` branch (`didit-controllers.js:79`, decides whether to mint a fresh session) becomes **unreachable dead code** for native sessions post-cutover, since Verify never emits that literal for one. Harmless to leave — it only ever matters for a member whose `diditSessionId` points at an **imported** legacy Didit session, where the literal can still legitimately appear.
- `user-auth-controllers.js` — `diditCustomerStatus` (its own copy, `:397-417`) — no change, same env var.
- `models/BlazeUser.js` — schema field names (`diditSessionId`, `diditRegisterUrl`) unchanged; we don't rename anything server-side.
- `lib/api/services/common.ts`, `app/actions/common.ts` — no change; these just proxy to your own backend, which is what changes underneath them.
- `signup-form.tsx:143-175` — works as-is (see §1.3); tightening it is optional, §5.

---

## 4. Terms & Conditions — not a dev task, but blocks go-live

Verify's hosted flow shows a consent screen (Terms link + a separate biometric-retention
checkbox) that the current production Hyperwolf Terms & Conditions page doesn't cover (CA Civil
Code §1798.90.1, CPRA biometric consent). Draft clause: `docs/IDV-TERMS-CLAUSE-DRAFT-2026-09-08.md`
— **for counsel, not legal advice, not yours to implement**, just don't point real guests at the
hosted flow in production before that page is live. Not counted in the hour estimate above.

---

## 5. Optional, recommended, separately schedulable (~2 h)

Not required for cutover. Do this in a follow-up PR once the required change is verified live.

### 5.1 Webhook instead of polling (~1.5–2 h)

Register a destination: `POST /api/idv/webhooks` `{ "url": "https://<your-backend>/api/v1/didit/webhook", "events": ["status.updated", "data.updated"] }` → response has a `secret`, shown once, store as `DIDIT_WEBHOOK_SECRET`.

Add a new route (`routes/didit/didit-webhook-route.js`, mounted in `startup/routes.js`) — full,
**corrected** implementation is in `docs/IDV-SITE-INTEGRATION.md` §3.3. (An earlier version of that
snippet re-parsed and re-serialized the body in JS before verifying the signature; that was fixed
in this pass — see §6.2 below for why it mattered.)

Keep polling running in parallel as a fallback during migration; the two are not exclusive.

### 5.2 `vendor_data` + `expected_details` on session create (~15 min)

Verified accepted by `/v2/session` today (`idv_api.py:2639-2665` reads `body.get("vendor_data")`
and `body.get("expected_details")` regardless of which route called it) even though the site
currently sends only `{ workflow_id }`. Optional, turns on `NAME_MISMATCH_EXPECTED` cross-checking
and lets Verify's console show which customer a session belongs to. Snippet in
`IDV-SITE-INTEGRATION.md` §3.4.

### 5.3 Tighten `signup-form.tsx:143-175` to an explicit `status === 'Approved'` check

Not required (current fallthrough behavior happens to still work), but matches the checkout fix's
reasoning and removes one more place that implicitly trusts "not Declined" as "good."

---

## 6. Findings against `IDV-SITE-INTEGRATION.md` itself — fixed in place

Per the task brief for this pass: every claim gets re-derived, including the existing doc's own.
Two real inaccuracies found and corrected directly in `docs/IDV-SITE-INTEGRATION.md`:

### 6.1 §1.1 omitted a fourth `DIDIT_API_KEY` call site

The doc said the env vars are read only by `common/utils.js:75` and `didit-controllers.js`. Grepped
the whole backend for `process.env.DIDIT_API_KEY` and found a fourth site:
`controllers/blaze/user-auth-controllers.js:408`, inside a second, independently-written
`diditCustomerStatus()` (copy-pasted, not a shared helper) that gates `/register`. Doesn't change
the migration cost — same env var — but a dev grepping only `didit-controllers.js` for "everywhere
this key is used" would miss a live call site. Doc updated to name it.

### 6.2 §3.3's webhook signature example had a real, non-theoretical bug

The original Node snippet verified a webhook by `JSON.parse(rawBody)` and then re-serializing with
a hand-rolled `canonicalize()` before hashing. That's unnecessary — Verify's signer
(`wmdemo/idv_webhooks.py`) already POSTs the literal canonical-JSON string as the wire body, so the
raw bytes received **are** the signed string; no reconstruction needed. Worse, the reconstruction
was actively wrong for one real case: Python's `json.dumps` always prints a float with a decimal
(`100.0`), but `JSON.parse('100.0')` collapses to the plain JS number `100`, which the old
`Number.isInteger`-based shortener then reprinted as `"100"` — a byte mismatch, hence a signature
mismatch, for **any decision node carrying an exact 100.0 or 0.0 score** (a perfect or a
worst-possible liveness/face-match score — a real value, not a contrived one). Fixed by signing the
raw received bytes directly (`` `${timestamp}.${rawBody}` ``) instead of round-tripping through
`JSON.parse`/re-serialize. Confirmed against `idv_webhooks.py`'s actual `sign()`/`preimage()`
(`idv_webhooks.py:89-109`): the wire body it sends and the string it signs are the same
`canonical_json(payload)` call, so verifying against the raw bytes as received is both simpler and
correct where the old code was neither.

---

## 7. Scale note (not a blocker, watch it)

`RATE_GET_PER_MIN = 600` per API key (§1.7) supports ~80 concurrently-polling verification modals
before `429`. If that's ever a real ceiling (a promo spike, a store opening), the fix is the
webhook (§5.1) removing the poll entirely, or a second API key split by traffic — either is a
config change, not a rewrite. Nothing to do now; flagging so it's not a surprise later.

---

## 8. Rollback plan

**Fast rollback (env only):** revert `DIDIT_API_BASE_URL`, `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` to
their original Didit values in the deployment env and redeploy. No code revert needed *if* you're
rolling back **before** §2.1/§2.2 shipped.

**If §2.1/§2.2 already shipped and you're rolling back to real Didit anyway:** revert those two
files too, in the same rollback. Real Didit legitimately returns `In Review` as an active state for
some sessions (that's the whole reason the old code special-cased it) — the "remove In Review"
change is **not** backward-compatible with real Didit's own status vocabulary. Leaving the new
`['Approved','Declined','Abandoned','Expired']` stop-list in place against real Didit means a guest
who lands `In Review` on Didit's side never gets unstuck from the polling modal, and checkout no
longer finalizes for them either. Roll back the whole commit together, not just the env vars.

**No data migration either direction** — `BlazeUser.diditSessionId`/`diditRegisterUrl` are opaque
strings to your schema regardless of which vendor issued them.

---

## 9. Verification checklist (run against the real deployment)

Base URL: `https://hyperwolf-wm-demo.onrender.com` (Render demo; swap for the AWS-ported URL once
that's live). Replace `<PLACEHOLDER_KEY>` and `<WORKFLOW_ID>` with the sandbox values we hand you —
**never run this against a real production key from a shell history that isn't secured.**

```bash
# 1. Create a session — mirrors createDiditSession() exactly
curl -s -X POST "https://hyperwolf-wm-demo.onrender.com/v2/session" \
  -H "x-api-key: <PLACEHOLDER_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "<WORKFLOW_ID>"}'
# Expect: 200 {"session_id":"...","session_token":"...","url":"https://.../verify/...",
#              "status":"Not Started","workflow_id":"...","vendor_data":null}

# 2. No key at all — confirms the *new* failure mode if the env var is ever unset
curl -s -X POST "https://hyperwolf-wm-demo.onrender.com/v2/session" \
  -H "Content-Type: application/json" -d '{"workflow_id": "<WORKFLOW_ID>"}'
# Expect: 403 {"error": "this endpoint needs an x-api-key header"}

# 3. Wrong/unknown key
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://hyperwolf-wm-demo.onrender.com/v2/session" \
  -H "x-api-key: wrong-key" -H "Content-Type: application/json" -d '{"workflow_id": "<WORKFLOW_ID>"}'
# Expect: 403

# 4. Confirm the write-token gate does NOT block /v2 on this public deployment
#    (no x-hw-write-token header sent above, and it still worked — that IS the check)

# 5. Open the returned `url` in a real browser (or the modal against a local build) and complete
#    a test document + selfie capture with a real, non-production ID.

# 6. Poll the decision endpoint — exactly what getStatus()/getSessionId() do
curl -s "https://hyperwolf-wm-demo.onrender.com/v2/session/<session_id>/decision" \
  -H "x-api-key: <PLACEHOLDER_KEY>"
# During capture: {"status": "In Progress"} or {"status": "Awaiting User", ...}
# After: {"status": "Approved", "kyc": {...}, "id_verification": {...}, "face_match": {...}}
#     or {"status": "Declined", ...} — confirm you never see "In Review" on a fresh session.

# 7. Confirm the iframe host is allowed to embed
curl -sI "https://hyperwolf-wm-demo.onrender.com/verify/<token from step 1>" | grep -i content-security-policy
# Expect a header containing: frame-ancestors ... https://www.hyperwolf.com https://hyperwolf.com

# 8. In the browser: load your locally-built signup page with the modal pointed at this session's
#    `url`, confirm the camera permission prompt appears (proves the allow="camera" + CSP combo
#    actually works end-to-end, not just in isolation).
```

**Where to watch it live:** the Verify console's Sessions table shows the test session within a
couple seconds of step 1; the session detail page shows each capture step and, on `Declined`, the
exact reason code. Ask for a viewer-role console login for your test window.

---

*Sources checked for this pass: `hyperwolf-frontend-nextjs` (didit-verification-modal.tsx,
signup-form.tsx, checkout-container.tsx, next.config.ts, lib/api/services/common.ts,
app/actions/common.ts, lib/api/client.ts) and `hyperwolf-backend` (controllers/didit/*,
controllers/blaze/user-auth-controllers.js, common/utils.js, routes/didit/*, startup/routes.js,
models/BlazeUser.js, .env.example) — read-only, none of these files were modified. Verify side:
`wm-demo/wmdemo/idv_api.py`, `idv_webhooks.py`, `idv_store.py`, `server.py` — read-only, none
modified. `docs/IDV-API-CONTRACT.md` read for cross-reference; not edited (out of scope for this
pass — only `IDV-SITE-INTEGRATION.md` was in-scope to correct, and was, per §6).*
