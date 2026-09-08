# Didit Identity Verification — Live Site Integration Digest

Source: shallow clone at `/Users/jt/hyper-tech-src/` (read-only; not edited).
- `hyperwolf-backend` = Express/Node API
- `hyperwolf-frontend-nextjs` = Next.js site
- `hyperwolf-super-admin` = React admin

Purpose: document exactly how Didit works today so a same-shaped replacement backend
can be dropped in with minimal site change.

---

## 1. Backend

### 1.1 Routes / mount

`startup/routes.js:55,70`
```js
const diditRoutes=require('../routes/didit/didit-routes')
...
app.use('/api/v1/didit',diditRoutes)
```

`routes/didit/didit-routes.js` (full file):
```js
router.post('/create/url', diditController.createSessionId)
router.get('/retrieve/session',diditController.getSessionId)
router.get('/retrieve/status',diditController.getStatus)
```

Live endpoints:
- `POST /api/v1/didit/create/url` → `createSessionId`
- `GET  /api/v1/didit/retrieve/session?sessionId=` → `getSessionId`
- `GET  /api/v1/didit/retrieve/status?sessionId=` → `getStatus`

### 1.2 `createSessionId` — `controllers/didit/didit-controllers.js:16-121`

Request body from frontend: `{ email, phone?, guestCheckout?, callback? }` (in
practice only `email`, sometimes `phone`/`guestCheckout`; `callback` is declared
via destructure at line 21 but the frontend never actually sends it — see §2.3).

Flow:
1. Looks up `Miscellaneous` doc `uniqueId: "signupStatus"` (the super-admin toggle,
   §3) and, in parallel, an existing `BlazeUser` by `email` OR `phone` (line 32-37).
2. If the matched member has `blockOnlinePayments.status`, returns a block message
   immediately — no Didit call.
3. Checks Persona (`getPersonaStatus`) and Didit (`diditCustomerStatus`, line 49)
   status for the email. If either shows fully verified and it's not a guest
   checkout, returns 400 "Member already exists!" (line 51-53).
4. **New member** (no `existingMember`): if `signupStatus.data.diditStatus ===
   "active"`, calls `createDiditSession()` and creates the `BlazeUser` row with
   whatever it got back (lines 59-72). If the toggle is off, no session is created
   at all — `diditSessionId`/`diditRegisterUrl` stay empty.
5. **Existing member** (line 73-93): if it has no `diditSessionId`/`diditRegisterUrl`
   yet, calls `createDiditSession()` — **unconditionally, without re-checking the
   `signupStatus` toggle**. If it already has a session, calls `diditCheck()`
   (line 293-300, a second `/v2/session/{id}/decision` GET) and — **only if status
   is `"Declined"` or `"In Review"`** — creates a brand-new Didit session
   (line 78-82). This is the resubmission path: a declined/in-review user gets a
   fresh session on their next `create/url` call.
6. `isDiditRequired = diditStatus !== "Approved"` (line 95). If required, `userData`
   is `null`; if not, `userData` is pulled from `memberDoc.userData` or, failing
   that, from Blaze (`memberData(email)`, line 142-150, `GET
   /api/v1/partner/user/find?email=`).
7. Responds:
```js
{ email, guestCheckout, isDiditRequired, registerUrl, diditSessionId, userData, callback }
```

**`createDiditSession()` — lines 122-140 (the actual call to Didit):**
```js
const diditReq = {
    body: { workflow_id: diditWorkFlowID },
    headers: { "x-api-key": process.env.DIDIT_API_KEY }
};
const data = await postRequest("didit", "/v2/session", diditReq);
return {
    diditRegisterUrl: data?.url || "",
    diditSessionId: data?.session_id || "",
    verifyMethod: "didit"
};
```
- Endpoint: `POST {DIDIT_API_BASE_URL}/v2/session`
- Header: `x-api-key: {DIDIT_API_KEY}`
- Body: **only** `{ workflow_id: DIDIT_WORKFLOW_ID }`. **No `vendor_data`, no
  `callback`/`callback_url`, no `metadata`, no `expected_details` are ever sent** —
  the goal's assumption that these are populated does not hold; the live call is
  the minimum possible payload. `diditWorkFlowID` is a single global env var
  (`process.env.DIDIT_WORKFLOW_ID`, line 3) — there is no per-store or per-flow
  workflow selection.
- On error, caught and swallowed to `{}` (line 136-139) — caller sees empty
  `diditRegisterUrl`/`diditSessionId`, not a thrown error.
- Because no `vendor_data` is attached at creation, Didit has **no notion of which
  Blaze/Hyperwolf customer a session belongs to** — correlation back to
  `BlazeUser` happens entirely on this side, by storing `diditSessionId` on the
  Mongo `BlazeUser` row and querying by email/phone.

`combineBaseurl` (`common/utils.js:75,77-108`): `platform === 'didit'` path resolves
to `diditBaseUrl.concat(endpoint)` where `diditBaseUrl = process.env.DIDIT_API_BASE_URL`.

### 1.3 `getSessionId` — `controllers/didit/didit-controllers.js:153-274`

`GET /api/v1/didit/retrieve/session?sessionId=`. Called by the frontend once
polling detects a terminal Didit status (§2.1/2.3).

1. `GET {DIDIT_API_BASE_URL}/v2/session/{sessionId}/decision`, header
   `x-api-key: {DIDIT_API_KEY}` (line 156, 162) — same decision endpoint used
   throughout, no separate "result" endpoint.
2. Maps `response.id_verification` into:
```js
{
  firstName, lastName, fullName, dob, recIssueDate, dlExpiration,
  city, country, state, sex, address, zip, dlNo,
  isVerified: response.status === "Approved",
  age
}
```
   (field source: `parsed.first_name`, `.last_name`, `.full_name`,
   `.date_of_birth`, `.date_of_issue`, `.expiration_date`,
   `.parsed_address.{city,country,region,postal_code}`, `.gender`, `.address`,
   `.document_number`, `.age`.)
3. Downloads `parsed.front_image`, `parsed.back_image`, and
   `response.face_match.target_image` (selfie) from Didit's CDN URLs to local
   temp files under `./assets/imgMerge/{front,back,selfie}/`.
4. Resizes front/back to 1400×900 with `sharp`, stacks them vertically into one
   JPEG at `./uploads/{customerUid}-combined.jpeg` — this is the "DL photo"
   Blaze later receives (see §1.5).
5. Uploads only the **selfie** to S3 bucket `hyperwolf-website-assets` (key
   `{customerUid}-selfie.jpeg`, via `middlewares/awsBucket`) — permanent storage.
   The combined front/back image stays on local disk until `registerUser`
   deletes it after forwarding to Blaze (§1.5).
6. Deletes the three downloaded temp files (not the combined file).
7. Looks up `BlazeUser` by `diditSessionId`, sets `selfiePhotoUrl` to the S3
   URL, saves. **This is the only Didit-derived field persisted to Mongo** —
   name/dob/dlNo/address/etc. are computed fresh on every call and returned to
   the frontend, never written to `BlazeUser`.
8. Responds `{ ...mappedData, filePath: "{customerUid}-combined.jpeg", selfiePath: <S3 url>, email }`.

No age/21+ check, no medical-card logic, anywhere in this function — `age` is
returned but unused server-side.

### 1.4 `getStatus` — `controllers/didit/didit-controllers.js:277-291`

`GET /api/v1/didit/retrieve/status?sessionId=` → same `/v2/session/{id}/decision`
call, returns only `{ status }`. This is the endpoint the frontend polls every 8s
(§2.1).

`diditCheck()` (line 293-300) and `diditCustomerStatus()` (line 302-320) are
internal helpers hitting the identical `/v2/session/{id}/decision` endpoint —
**there are three separate call sites in this one file alone** doing the same
GET. `diditCustomerStatus` resolves the `BlazeUser` by `userData.cpn: "+1{phone}"`
if phone given, else by `email`.

### 1.5 Webhook / signature check — **none exists**

`grep -rn -a -i "X-Signature|webhook|hmac|event_id"` across the whole backend
(excluding `node_modules`) turns up webhook receivers for `ledgergreen`, `fhl`,
and Blaze's own outbound webhooks (`routes/blaze/integration/blaze-integration-routes.js`)
plus an unrelated `crypto.createHmac` in `controllers/intercom/intercom-controllers.js:76`
(Intercom's identity-verification HMAC, not Didit's). **Nothing Didit-related
matches at all.** There is no `routes/didit` POST receiver for a callback, no
signature verification code, no `event_id` handling. Verification status is
learned exclusively by the frontend polling `getStatus`, which polls
`/v2/session/{id}/decision` on Didit directly. If Didit supports a
`callback_url`/webhook + `X-Signature` mechanism, this integration does not use it.

### 1.6 How the decision reaches Blaze — `controllers/blaze/user-auth-controllers.js`

The Didit result is applied at **account creation**, not directly inside the
didit controller:

- Signup gate (`registerUser`, lines 78-93):
```js
const isDiditRequired = signupStatus?.data?.diditStatus === "active"
    && signupStatus?.data?.personaStatus !== "active"
if (isDiditRequired) {
    const diditStatus = email ? await diditCustomerStatus("", email) : undefined
    if (diditStatus !== "Approved") {
        return res.status(400).send({ message: authUserMsg.IDENTITY_VERIFICATION_REQUIRED })
    }
}
```
- On successful gate, `registerUser` calls Blaze's own partner API
  (`postRequest('blaze','/api/v1/partner/user/register', req)`), then
  `POST /api/v1/partner/store/user` (opt-in), then `acceptMember()`
  (`common/utils.js`), then **the call that actually marks the Blaze member
  verified** (lines 173-181, mirrored at 254-264):
```js
const updateReqObj = {
  headers: {...},
  body: {
    ...memberResponse, marketingSource: "Hyperwolf", status: "Active", memberGroupId,
    "identifications": [{ "verified": true }],
    "recommendations": [{ "verified": true }],
  }
};
await putRequest('blaze', `/api/v1/partner/members/${memberResponse.memberId}`, updateReqObj)
```
  i.e. `PUT {BLAZE_BASE_URL}/api/v1/partner/members/{memberId}` with
  `identifications`/`recommendations` hard-set `verified: true`. This call fires
  purely because the signup form got past the `isDiditRequired` gate — **it does
  not re-check the actual Didit decision payload**, it trusts the earlier
  `diditStatus !== "Approved"` short-circuit.
- The combined DL image built in `getSessionId` (§1.3) is uploaded to Blaze here
  too: `postRequestFormData('blaze', '/api/v1/partner/store/user/dlPhoto', {..., filePath, name})`
  (lines 186-198), then the local file is deleted (`fs.unlink`).
- `memberGroupId = "656f8e7896a70f3ae9b13d6c"` is force-set only for `age >= 65`
  (line 170-171, 251-252) — a senior member-group assignment, unrelated to 21+
  gating.
- Age 21+ / "AdultUse" gating exists but is **separate from Didit entirely** — it
  lives in `loginWithPhoneAndPassword` (`controllers/blaze/user-auth-controllers.js:469`)
  and compares Blaze's own stored DOB against `memberType.consumerType ===
  "AdultUse"`, blocking login for under-21 adult-use members. Medical/21+ logic
  in `controllers/persona/personaController.js:283` is Persona-specific, not
  Didit-specific. **No age/medical logic exists inside the Didit controllers.**

### 1.7 `models/BlazeUser.js` (31 lines, full relevant fields)

```js
const blazeUserSchema = new Schema({
    email: String,
    userData: { type: Object, default: {} },
    fhlOtp: String,
    personaUid: String,
    diditSessionId: { type: String },
    guestCheckout: Boolean,
    selfiePhotoUrl: { type: String, default: "" },
    diditRegisterUrl: String,
    sessionToken: String,
    inquiryId: String,
    idImage: String,
    blockOnlinePayments: { status, blockedReason, blockedDate, blockedBy },
}, { versionKey: false, minimize: true })
```
No `diditStatus`/`verifiedAt`/`expiresAt`/document-number fields exist on this
model — verification state is **not cached** here beyond the session id and
selfie URL; every gate check re-hits Didit's `/decision` endpoint live.

### 1.8 Cron / re-verification / expiry — **none found**

`grep` for cron/agenda/node-schedule files that also mention `didit` returns
nothing. There is no scheduled job that re-checks a Didit session, expires a
stale verification, or purges old sessions. Once `diditStatus === "Approved"` is
observed, nothing ever re-verifies it (aside from the ad-hoc re-check baked into
`createSessionId`'s existing-member branch, §1.2 step 5, which only fires on the
next `create/url` call, not on a timer).

### 1.9 Env vars (names only, from `.env.example:137-140`)

```
DIDIT_API_BASE_URL=<didit-api-url>
DIDIT_API_KEY=<didit-api-key>
DIDIT_WORKFLOW_ID=<didit-workflow-id>
```
Marked "Optional: Didit." in the example file. No separate webhook-secret /
signing-key env var exists (consistent with §1.5 — there's no signature to verify).

### 1.10 `README.md`

Backend `README.md:106,145` lists Didit only as one bullet under "Identity
Verification: Berbix, Persona, Didit" — no operational detail beyond the table of
contents; route definitions are pointed at `routes/` / `startup/routes.js` (both
already covered above). No dedicated Didit section exists in the README.

---

## 2. Frontend (`hyperwolf-frontend-nextjs`)

### 2.1 `components/auth/didit-verification-modal.tsx` (93 lines, full file behavior)

- **No `@didit-protocol/sdk-web` or any Didit package** — `grep -i didit
  package.json` returns nothing in either repo. Verification is a **plain
  `<iframe src={url} allow="camera; microphone; fullscreen; autoplay;
  encrypted-media">`** pointed at the `registerUrl` Didit returned.
- Props: `isOpen, onClose, url, sessionId, onComplete(sessionId, status)`.
- On open, starts a `setInterval` **polling `commonService.getSessionDiditURl`
  (→ `GET /api/v1/didit/retrieve/status`) every 8000ms**. When the returned
  status is one of `['Approved', 'Declined', 'In Review']`, clears the interval
  and calls `onComplete(sessionId, status)`. There is no `postMessage`/event
  listener from the iframe itself — completion is detected purely by polling,
  the iframe's own `onLoad` only toggles a loading spinner.
- No handling at all for an "Expired" or unknown status string — the interval
  just keeps polling silently until one of the three listed values appears.

### 2.2 `lib/api/services/common.ts:213-225`

```js
createDiditURl(data) { return apiClient.post('didit/create/url', data) },
getSessionDiditURl(sessionId) { return apiClient.get('didit/retrieve/status', { params: { sessionId } }) },
retrieveSessionUrl(sessionId) { return apiClient.get('didit/retrieve/session', { params: { sessionId } }) },
```
`apiClient` = `hyperwolfClient` (`lib/api/client.ts:31-38,49`), `baseURL:
${HYPERWOLF_BASE_URL}/api/v1/` where `HYPERWOLF_BASE_URL =
process.env.NEXT_PUBLIC_HYPERWOLF_API_BASE_URL || 'https://api.hyperwolf.prod.ths.agency'`,
header `X-API-KEY: process.env.NEXT_PUBLIC_API_HEMP_AUTH_KEY` plus common
`x-auth-token`. So the three `didit/*` calls resolve to
`{HYPERWOLF_BASE_URL}/api/v1/didit/{create/url|retrieve/status|retrieve/session}`
— matches the backend mount exactly.

### 2.3 `app/actions/common.ts:25-53`

Thin server actions wrapping the above for use in Server Components/Actions:
```js
createDiditUrlAction({ email, phone, guestCheckout })  → commonService.createDiditURl(data)
retrieveDiditSessionAction(sessionId)                   → commonService.retrieveSessionUrl(sessionId)
```
Note `createDiditUrlAction`'s declared param type includes no `callback` field —
confirms the frontend never sends one (matches backend's dead `callback`
destructure, §1.2).

### 2.4 `components/auth/signup-form.tsx` (657 lines)

- `onEmailSubmit` (line 259-300): if `signupStatus.personaStatus === 'active'`
  goes down the Persona path; **else** calls `commonService.createDiditURl({
  email: verificationEmail })` (no phone, no guestCheckout — signup is never
  guest). If `res.data.isDiditRequired`, opens `DiditVerificationModal` with
  `registerUrl`/`diditSessionId`; if not required, skips straight to the
  `'details'` step.
- `handleDiditComplete` (line 143-175): if `status === 'Declined'`, toasts and
  stops — **`'In Review'` is treated as success here** (falls through to the
  `try` block) because only `'Declined'` is special-cased, unlike checkout
  (§2.5) which explicitly lists both `'Approved'` and `'In Review'` as
  acceptable. On success, calls `commonService.retrieveSessionUrl(sessionId)`
  (→ `getSessionId` backend controller) and pre-fills `firstName`/`lastName`/`dob`
  from the response, moves to `'details'` step.
- `completeSignup` (line 177-257) builds the Blaze signup payload from
  `verificationData` (`vd`): `dlNo, recIssueDate, dlExpiration, filePath,
  selfiePath, diditSessionId` etc. are all taken straight from what
  `getSessionId` returned — **client-supplied**, not re-validated server-side at
  signup time beyond the `isDiditRequired`/`diditStatus==='Approved'` gate.
- Age gating (line 244-250): `age = calculateAge(data.dob)` computed **from the
  form's DOB field**, independent of Didit's own `age` field (which is fetched
  but never read here — confirmed no `.age` reference outside the calc
  function). If `age < 21`, routes to a `'medical'` step ("Account created!
  Medical verification required.") instead of `/login` — this is a UI branch
  only, not tied to any Didit/Persona re-check.

### 2.5 `components/checkout/checkout-container.tsx` (1285 lines)

- `initiateVerification(email, phone, isGuest)` (line 769+): only runs when
  `signupStatus?.diditStatus === 'active'`. Calls
  `createDiditUrlAction({ email, phone, guestCheckout: true })`
  (used for **guest checkout only** — logged-in users are not re-verified at
  checkout). If `isDiditRequired && registerUrl && diditSessionId`, opens the
  modal; if verification isn't required and `userData` came back with a real
  user, places the order directly with no signup.
- `handleDiditComplete` (line 729-741):
```js
if (status === 'Approved' || status === 'In Review') {
    await finalizeRegistrationAndOrder(sessionId)
} else {
    toast({ title: "Verification Failed", description: `Verification status is ${status}...` })
}
```
  **`'In Review'` orders are allowed to place** — the checkout flow does not wait
  for a final Didit decision; the customer's own submitted-but-unreviewed status
  is enough to buy.
- `finalizeRegistrationAndOrder(completedDiditSessionId?, diditUserData?)`
  (line 832+): fetches identity data via `retrieveDiditSessionAction` (→
  `getSessionId`) when a session id is present, else uses the `userData` Didit
  create/url already returned, then proceeds to guest registration/order
  placement using that data.

### 2.6 `next.config.ts` CSP (lines 71-83)

```
frame-src 'self' ... https://verify.didit.me ...
```
`connect-src` does **not** list any `didit`/`*.didit.me` host — all Didit REST
calls go through the Hyperwolf backend proxy (`api.hyperwolf.prod.ths.agency`,
already whitelisted), never directly from the browser to Didit's API. Only the
verification **iframe** talks to Didit directly, and only to `verify.didit.me`.

### 2.7 `.agent/api-caching-strategy.md:350-353`

```
#### 58. Didit Operations - NO CACHE
- Endpoints: didit/*
- Reason: Session-based operations
- Usage: Identity verification
```
Confirms all three `didit/*` routes are explicitly excluded from the frontend's
API response cache layer.

### 2.8 `BUNDLE_SIZE_ISSUES.md:46,143-156`

`DiditVerificationModal` (along with `PersonaVerificationModal`,
`SplitPaymentModal`, `RestrictAmountModal`) is dynamically imported
(`dynamic(..., { ssr: false })`) in both `signup-form.tsx` and
`checkout-container.tsx` purely as a bundle-size optimization — "KYC/identity
flows triggered only in edge cases." No functional behavior difference from this.

### 2.9 Broader `verif` grep — status/copy handling

- `didit-verification-modal.tsx:40` — poll terminal states `['Approved',
  'Declined', 'In Review']` only (no `'Expired'`/`'Not Started'`/other string is
  ever specially handled — an unrecognized status value polls forever until the
  modal is closed).
- `signup-form.tsx:147-148` — only `'Declined'` blocks; everything else
  (including `'In Review'`) proceeds as if verified.
- `checkout-container.tsx:731` — `'Approved'` or `'In Review'` both proceed;
  anything else shows "Verification Failed... status is {status}."
- No copy anywhere handles a `'Not Started'`, `'Expired'`, or resubmission-prompt
  state distinctly from a generic failure toast.

---

## 3. Super-admin (`hyperwolf-super-admin`)

`src/layouts/manageSingupType/index.jsx` (full file read, 266 lines) — the only
Didit-adjacent screen in super-admin:

- A single `Members Registration` card with four mutually-exclusive toggles:
  `personaStatus`, `diditStatus`, `agecheckerStatus` (Hyperwolf/Stilo modes
  hide this one), `registerStatus` (also hidden for Hyperwolf/Stilo).
- `onStatusChangeHandler` (line 50-70) always sends **all four** keys in one
  payload, forcing the other three to `'inactive'` whenever one is flipped
  `'active'` — this is a true radio-button-via-checkboxes pattern, not
  independent flags, and it blocks turning everything off ("Atleast one
  registration should be active").
- Dispatches `updateSignupStatus(payload)` → Redux thunk → presumably
  `POST /api/v1/signup/status/update` (backend `routes/common-routes.js:33`,
  handler `updateVariables` in `controllers/common-controllers.js:1300-1319`),
  which is the exact `Miscellaneous{uniqueId:"signupStatus"}` doc read
  everywhere in §1.
- No workflow-id picker, no per-store Didit config, no session-list/audit view
  in this screen — toggling Didit on/off is the entirety of the admin surface
  for this integration.

---

## 4. Data model / correlation key

- **What's stored where:**
  - `BlazeUser` (Mongo, this app's own DB): `email`, `diditSessionId`,
    `diditRegisterUrl`, `guestCheckout`, `selfiePhotoUrl` (S3 URL), `userData`
    (raw Blaze partner-API user object once registered). **No document number,
    DOB, address, or ID images are stored in Mongo** — those pass through this
    app in-memory/on-disk-temporarily and land only in **Blaze** (via
    `dlPhoto` upload + member `PUT`) and in **S3** (`hyperwolf-website-assets`,
    selfie only, indefinite retention — no lifecycle rule seen in this repo).
  - Local disk: the combined front/back license JPEG sits under `./uploads/`
    between `getSessionId` writing it and `registerUser` deleting it after the
    Blaze `dlPhoto` upload succeeds — if `registerUser` is never called (e.g.
    user abandons signup after Didit approval), the file is an orphan.
  - **Didit itself** is presumably the long-term host of the raw ID
    images/decision — nothing in this codebase re-fetches or archives them
    beyond the one-time front/back/selfie download in `getSessionId`.
- **Correlation key across the stack:** **email** is the primary key everywhere
  — `BlazeUser` lookups (`createSessionId`, `diditCustomerStatus`), Blaze
  partner-API lookups (`/api/v1/partner/user/find?email=`), and the
  `signupStatus`/gate logic in `registerUser` all key on email. Phone is a
  secondary lookup key only in `diditCustomerStatus` (via `userData.cpn:
  "+1{phone}"`) and in `createSessionId`'s initial `$or` match. **Blaze
  member id (`memberId`/`cuid`) does not exist yet at the time a Didit session
  is created** — it's assigned only after Blaze registration, which happens
  after Didit approval. This matters for migration: **there is no `vendor_data`
  to key against on the Didit side at all today** (§1.2) — a replacement
  backend has total freedom to choose email as `vendor_data`, but must
  replicate the "session lives only in our Mongo, addressed by email/phone"
  correlation model since nothing on Didit's side carries it.

---

## 5. Deliverables

### 5a. Sequence diagram (text)

```
Signup (logged-out) or Guest Checkout
  │
  ▼
Site (Next.js)
  │  POST /api/v1/didit/create/url  { email[, phone, guestCheckout] }
  ▼
Backend (createSessionId)
  │  1. Mongo: find BlazeUser by email/phone
  │  2. Mongo: find Miscellaneous{signupStatus} (Didit toggle)
  │  3. GET {DIDIT}/v2/session/{existingId}/decision   (if a prior session exists)
  │  4. POST {DIDIT}/v2/session  { workflow_id }        (if new/needs resubmission)
  ▼
Didit API
  │  → { session_id, url }
  ▼
Backend  →  Site: { registerUrl, diditSessionId, isDiditRequired, userData }
  │
  ▼
Site opens <iframe src=registerUrl> (verify.didit.me) inside DiditVerificationModal
  │
  ▼
User completes ID scan + selfie live on Didit's hosted page (no site-side event)
  │
  ▼
Site polls every 8s:  GET /api/v1/didit/retrieve/status?sessionId=
  ▼
Backend (getStatus)  →  GET {DIDIT}/v2/session/{id}/decision  →  { status }
  ▼
Site sees status ∈ {Approved, Declined, In Review} → closes modal, calls onComplete
  │  (Declined → stop here, except checkout also stops on any status other than
  │   Approved/In Review)
  ▼
Site: GET /api/v1/didit/retrieve/session?sessionId=  (retrieveSessionUrl)
  ▼
Backend (getSessionId)
  │  1. GET {DIDIT}/v2/session/{id}/decision  (again — 3rd/4th hit on this session)
  │  2. Download front/back/selfie images from Didit CDN URLs
  │  3. Merge front+back → local combined.jpeg; upload selfie → S3
  │  4. Mongo: BlazeUser.selfiePhotoUrl = S3 url; save
  ▼
Backend → Site: { firstName, lastName, dob, dlNo, address, ..., filePath, selfiePath }
  │
  ▼
Site: POST signup (authService.signUp) or guest-checkout registration,
      carrying the above fields verbatim
  ▼
Backend (registerUser)
  │  1. Re-check: diditCustomerStatus(email) === "Approved"?  (else 400)
  │  2. POST {BLAZE}/api/v1/partner/user/register
  │  3. POST {BLAZE}/api/v1/partner/store/user           (opt-in)
  │  4. PUT  {BLAZE}/api/v1/partner/members/{memberId}
  │           { identifications:[{verified:true}], recommendations:[{verified:true}], status:"Active" }
  │  5. POST {BLAZE}/api/v1/partner/store/user/dlPhoto    (uploads combined.jpeg)
  │  6. delete local combined.jpeg
  ▼
Blaze member now shows verified; site proceeds to /login or places the order
```

### 5b. Minimum change list for a same-shaped replacement backend

Everything below is what a drop-in backend must keep byte-compatible; nothing
in the frontend needs to change if the new backend honors this contract.

1. **Keep the three routes and their exact paths/shapes**, mounted under
   whatever path the frontend calls — currently `POST didit/create/url`,
   `GET didit/retrieve/status?sessionId=`, `GET didit/retrieve/session?sessionId=`
   — OR change `lib/api/services/common.ts:213-225` (3 lines) to point at new
   paths if the mount differs.
2. **`create/url` response must include** `{ registerUrl, diditSessionId,
   isDiditRequired, userData, email, guestCheckout }` — `signup-form.tsx:292-298`
   and `checkout-container.tsx:781-802` read `registerUrl`/`diditSessionId`/
   `isDiditRequired`/`userData` by those exact key names.
3. **`registerUrl` must be an iframe-embeddable URL** (X-Frame-Options / CSP
   frame-ancestors permitting) that runs entirely client-side to completion —
   the modal never listens for `postMessage`, only polls status.
4. **`retrieve/status` must return `{ status }`** with values drawn from the
   set the frontend already special-cases: `'Approved'`, `'Declined'`,
   `'In Review'`. Any other string is currently treated as "keep polling"
   (modal) or "verification failed" (signup/checkout on completion) — so a new
   provider's status vocabulary should be translated to these three strings
   server-side rather than pushed to the frontend as-is.
5. **`retrieve/session` must return** `{ firstName, lastName, fullName, dob,
   recIssueDate, dlExpiration, city, country, state, sex, address, zip, dlNo,
   isVerified, age, filePath, selfiePath, email }` — `signup-form.tsx:154-164`
   and the `completeSignup` payload builder (`vd.*`, lines 182-222) read these
   exact keys. `filePath`/`selfiePath` specifically must resolve to files the
   backend can hand to Blaze's `dlPhoto` upload — i.e. the new backend still
   needs to do its own image fetch/merge/S3-upload work; the frontend doesn't
   do any of that.
6. **Env vars to swap** (all backend-only, nothing in frontend `.env`):
   `DIDIT_API_BASE_URL`, `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` in the backend's
   environment (`.env.example:137-140`, consumed in `common/utils.js:75` and
   `controllers/didit/didit-controllers.js:3,127-129`) — repoint these at the
   new provider or repurpose the same names for the new backend's own
   base-URL/key/workflow config.
7. **`next.config.ts:80` CSP `frame-src`** must list the new provider's iframe
   host in place of (or alongside) `verify.didit.me`, or the iframe will be
   silently blocked by the browser.
8. Everything else (super-admin toggle, `signupStatus` Miscellaneous doc,
   Blaze `PUT .../members/{id}` verified-flag call, `dlPhoto` upload,
   `BlazeUser.diditSessionId`/`selfiePhotoUrl` fields) is internal to the
   current backend and can be re-implemented however the new backend likes, as
   long as it's driven by the same `signupStatus.diditStatus === 'active'`
   toggle super-admin already writes to (§3) — no super-admin change needed
   unless the toggle itself is renamed.

### 5c. What the current integration does NOT do (blunt)

- **No webhook receiver, no signature/HMAC verification, no `event_id` handling
  at all.** Confirmed by a repo-wide grep — verification status is discovered
  exclusively by the frontend polling a GET endpoint every 8 seconds, which
  itself just proxies Didit's `/decision` GET. If Didit's session is approved
  and the user never returns to the tab (closes the modal, kills the browser),
  **nothing on the backend ever learns about it** until/unless the user starts
  a new `create/url` call later.
- **No `vendor_data`, `callback_url`, `metadata`, or `expected_details` sent to
  Didit at session creation** — the POST body is `{ workflow_id }` only. Didit
  has no way to tag a session with "this is Hyperwolf customer X."
- **No resubmission UI copy** — `'Declined'`/`'In Review'` both silently permit
  a fresh session on the next `create/url` call (backend logic), but the
  frontend gives no explicit "verify again" affordance; the user has to restart
  signup/checkout from scratch.
- **`'In Review'` is treated as good enough to complete checkout** — an order
  can be placed before Didit has finished its own review. This is a real
  business-risk gap, not a documentation nuance.
- **No expiry / re-verification cron.** A member approved once stays
  "Approved" forever in the eyes of this system (until/unless they trip the
  ad-hoc re-check inside `createSessionId`, which only runs if they ever call
  `create/url` again).
- **No document data retention in the app's own database** — DOB, license
  number, address are fetched fresh from Didit on every `retrieve/session`
  call and handed to Blaze; nothing is cached locally beyond the selfie S3 URL
  and the session id. (Arguably good for minimization, bad for auditability —
  there's no local record of what was approved and when, only Blaze's copy.)
- **No 21+/medical logic tied to Didit's own `age`/`dob` output** — age gating
  in `signup-form.tsx` is computed independently from a form field the user
  types in, not from Didit's verified DOB. Nothing cross-checks the two.
- **Errors from Didit are swallowed, not surfaced distinctly.**
  `createDiditSession()` catches and returns `{}`, so a Didit outage looks
  identical to "no session needed yet" from the caller's point of view — no
  retry, no alerting hook visible in this codebase.
- **Duplicate Didit API calls within a single user journey.** The same
  `/v2/session/{id}/decision` endpoint is hit up to 3-4 times across one
  approve → complete → register cycle (`diditCheck`, `diditCustomerStatus`,
  `getStatus` polling every 8s, `getSessionId`) with no caching layer between
  them (confirmed also by `.agent/api-caching-strategy.md:350-353` explicitly
  excluding `didit/*` from the frontend cache).

### 5d. Open questions

1. Does Didit actually support a webhook/callback mechanism (`X-Signature`,
   `event_id`) that this integration is simply not using? If so, is there an
   appetite to add one for the replacement rather than keep polling?
2. What should replace the currently-empty `vendor_data`/correlation strategy —
   should the new backend start sending Blaze `email` (or a stable internal id
   minted before session creation) as `vendor_data` so the new provider can be
   queried/audited independently of this app's Mongo?
3. Is the "`'In Review'` allowed to complete checkout" behavior intentional
   business policy (fast checkout, review happens after) or an oversight to
   fix in the replacement?
4. Should the replacement persist document data (DOB, license number, address)
   in this app's own DB, or continue treating Blaze as the sole system of
   record? Current behavior leans toward "Blaze is the record," which has
   compliance implications if Blaze's copy is ever wrong/missing.
5. Is there a retention/lifecycle policy intended for the permanent S3 selfie
   uploads (`hyperwolf-website-assets`)? None is visible in this codebase.
6. The orphaned local `./uploads/{customerUid}-combined.jpeg` file (created in
   `getSessionId`, only deleted by a later, separate `registerUser` call) —
   is disk cleanup for abandoned signups handled anywhere outside this repo
   (e.g. a cron on the box itself), or is this a real leak?
7. `createDiditSession()`'s existing-member branch (§1.2 step 5) creates a
   session even when the `signupStatus.diditStatus` toggle is off — is that
   intentional (once opted in, always re-verifiable) or a bug that should be
   fixed in the rewrite?
8. Super-admin's `manageSingupType` screen has zero Didit-specific
   configuration (workflow id, environment, per-store settings) — will the
   replacement need any admin UI beyond the existing on/off toggle, or does a
   config-file/env-var-only setup remain acceptable?
