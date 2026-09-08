# ID Verification — Existing Pieces Digest (2026-09-08)

Reference digest of every identity/verification/check-in piece already in `/Users/jt/POS-Admin`
(frontend) and `/Users/jt/wm-demo` (backend, Python 3.9 stdlib-only, SQLite), so a new ID
Verification module absorbs them instead of duplicating them. Compiled read-only; no files
edited except this one. Note: `/Users/jt/POS-Admin/docs/PROMPT-IDV-MODULE-KICKOFF.md` already
frames a "Didit parity" module against this exact file set, and
`scratch/idv-conventions-digest-2026-09-08.md` / `scratch/idv-didit-console-crossref-2026-09-08.md`
appear to be sibling digests from the same effort — not read in depth here to avoid duplicating
that work; cross-check before final design.

Vendor name is **Didit** (`business.didit.me` / API base `https://verification.didit.me`),
confirmed live at `pos/checkin.jsx:767`, `pos/screen-orders.jsx:168`, and `wm-demo/wmdemo/verify.py`
— deliberately never named in `pos/verification.jsx` UI copy (`IDV_VENDOR = ''`, verification.jsx:68).

---

## PART A — FRONTEND (`/Users/jt/POS-Admin`)

### A1. `pos/verification.jsx` (1028 lines) — the tier/assurance logic library, NOT a screen

No `fetch`/`/api/` calls in this file at all (confirmed by grep — zero network hits). Pure
component/logic library, read/write only against local mock state on `window.HW` /
`window.HW_CHECKIN`.

**Exports (globals):**
```
window.HWExpiry        = { parseExpiry, isExpiredDoc }                          L108
window.HWName           = { splitGuess: splitNameGuess, join: joinName }         L179
window.HWAddress        = { splitStreetGuess, joinStreet }                       L203
window.HWExpiryPolicy   = { expiryEnforced }                                     L240
window.HWV              = { assurance, TIERS, expiryEnforced }                   L288
window.AssuranceBadge   = function AssuranceBadge({ v, size = 'md' })            L291
window.IdentityLadder   = function IdentityLadder({ v, compact })                L307
window.SmsVerifyPanel   = function SmsVerifyPanel({ phone, state, sentAt, attempts, onVerified, onLog, compact })  L389
window.RemoteIdPanel    = function RemoteIdPanel({ phone, remoteId, onLog, onDoor, compact })  L543
window.CustomerPeek     = function CustomerPeek({ member, contact, idv, onClose })  L658
window.IdScanPanel      = function IdScanPanel({ value, onChange, onLog })       L754
window.VerifyPolicyCard = function VerifyPolicyCard({ tight })                   L1008
```

**The tier model — `assurance(v)` (L242-287)**, input `v = { doc, phone, remoteId|persona, doc_expiry }`:
- `TIERS = { 0:'Unverified', 1:'ID on file', 2:'Delivery ready' }` (badge tones bad/warn/good)
- `docOk = !!(doc && doc.scannedAt && doc.photo)`
- `docExpired = isExpiredDoc(doc)` — date comparison vs `doc.expires`, END of day (L100-107); `doc.expired===true` also honored
- `remoteOk = !!(pa && pa.status === 'passed')`; `phoneOk = !!ph.smsVerified`
- Tier 0: `blocker: 'No ID has been seen yet.'`
- Tier 1 (ID, no phone): `blocker: "Phone not confirmed — we can't tie a remote order back to this person."`
- Tier 2: `{ canStore:true, canDelivery:true, via: 'remote'|'door'|'in-store' }`

**Expiry-enforcement switch — `expiryEnforced(v)` (L230-239)**, read in strict precedence order,
default is a real third state, not `false`:
1. `v.doc_expiry.enforced` (per-row)
2. `window.HW_CHECKIN.board.expiry_enforcement.enforced`
3. `window.HW_CHECKIN.contract.doc_expiry_enforced`
4. else `null` — fail-closed: `enforced===null` renders *"NOTHING has told this screen whether expiry is enforced here, so it is refusing on the strict reading rather than guessing."* `enforced===false` renders a distinct soft-lapse tag `{lapsed:true, wouldBlockCode:'lapsed', tone:'warn', wouldBlockReason:'WOULD HAVE BEEN REFUSED…'}` — a passing tier never looks identical to a clean pass.

**`IdScanPanel` is an explicit, on-screen-labeled simulator (L705-1005)** — no PDF417 reader wired.
`DEMO_IDS` = 6 hardcoded people (L739-746), cycled not randomized. Every output carries
`simulated: true` + a `DemoMark` "DEMO" chip. Emitted shape:
```
{ type, num (masked '••••4821'), expires, scannedAt, by, where, photo:true,
  firstName, lastName, nameGuessed, nameGuessNote, name (derived),
  address:{streetNumber,streetName,street,city,state,zip,guessed}|null,
  dob, returning: true|false|null, memberId, lookup:'ok'|'unavailable', simulated:true }
```
Real hardware scanner: explicitly **not implemented** (L985-994) — "no real reader to test a
global listener against, so building one now would be unverifiable, untested plumbing."

**Name/address split contract:** server (`wmdemo/server.py:4843`, `identity_match.py:176`) only
accepts `first_name`/`last_name` separately — no joined `name` key on any create/update endpoint.
`splitNameGuess`/`splitStreetGuess` exist only for legacy joined strings, always mark
`guessed:true` with a `note`.

**`SmsVerifyPanel`/`RemoteIdPanel` — no backend at all:** comment at L419-425: *"Nothing is sent
from this panel — there is no endpoint and no send path anywhere in it."* Same at L571-574 for
`RemoteIdPanel.send`. Both simulate a client-side "sent" log entry only
(`receipt: 'awaiting carrier ack'`), never advance to "delivered" (previously fabricated
`status:'delivered'` — fixed). SMS copy rendered verbatim: `"Hyperwolf: confirm your number to
unlock delivery — hyprwlf.co/v/8Kd2mQ. Reply STOP to opt out."` and `"Hyperwolf: verify your ID to
order for delivery — {link}. Takes 2 minutes. Reply STOP to opt out."`

No error boundary around `assurance()` by deliberate decision (L29-63): it is total (never
throws), so a boundary would only mask real render faults, never wrong verdicts.

### A2. `pos/checkin.jsx` (1503 lines) — check-in screen, also no direct network I/O

Reads local mock state only: `window.HW.IDV` (L47, 995), `window.HW.MEMBERS` (L272, 346, 802,
971); consumes `verification.jsx`'s globals (`window.HWV`, `window.HWExpiry`, `window.HWName`,
`window.HWAddress`).

**Exports:**
```
window.guestName                                                                 L38
window.guestIncomplete                                                           L39
window.GuestEditor  = function GuestEditor({ primaryName, guests, onChange })     L219
window.CheckInModal = function CheckInModal({ onClose, onCheckIn, initialCustomer = null })  L617
```

**Four guest states, not two (L18-37):**
```js
const guestStatus = (g) => g.doc ? g.id ? 'linked' : 'captured' : g.id ? 'linked-no-doc' : 'incomplete';
const guestBlocks = (g) => { const s = guestStatus(g); return s === 'incomplete' || s === 'linked-no-doc'; };
```
`linked-no-doc` (an existing record nobody has ever verified) BLOCKS check-in — fixes a prior bug
where linking any member from search fabricated `doc: { onFile: true }`.

**How an on-file doc is read (`docOnFileFor`, L45-62):**
```js
function docOnFileFor(id) {
  const rec = (window.HW && window.HW.IDV || {})[id] || null;
  const a = window.HWV ? window.HWV.assurance(rec) : { tier: 0 };
  if (a.tier < 1) return null;   // includes an EXPIRED document
  ...
}
```

**How the screen decides "verified" and what it shows when it cannot determine (L985-1007,
footer L1481-1497) — direct answer to "what does Register/check-in show when the check cannot be
made":**
```js
const primaryScan = customer && customer.doc && customer.doc.scannedAt ? customer.doc : null;
const primaryRec = customer && customer.id ? (window.HW && window.HW.IDV || {})[customer.id] || null : null;
const primaryEnforced = expirySwitch(primaryRec);              // true|false|null
const primaryScanExpired = docIsExpired(primaryScan);
const primaryScanBlocks = primaryScanExpired && primaryEnforced !== false;
const primaryScanLapsedSoft = primaryScanExpired && !primaryScanBlocks;
const primaryDoc = customer ? (primaryScan && !primaryScanBlocks ? primaryScan : docOnFileFor(customer.id)) : null;
const primaryNeedsId = !!customer && !primaryDoc;
```
Footer strings by state (L1487-1493): no customer → `'Select a customer'`; lapsed but allowed →
`'ID EXPIRED — allowed, enforcement is OFF'`; lapsed + enforced → `'The scanned ID has EXPIRED'`;
lapsed + enforcement **unknown** (fail-closed) → `'ID EXPIRED — enforcement UNKNOWN, refusing'`;
no ID → `'Scan the buyer's ID'`; guests blocking → `'{n} guest(s) need ID'`; else → `'{n} in
party'`. Both check-in buttons: `disabled={!customer || !!blocked || primaryNeedsId}`
(L1496-1497). There is **no distinct "network error / can't reach server" UI state** — everything
resolves synchronously from local mock objects (`window.HW.IDV`); the screen never spinners or
shows an error card, only a definite tier or an "enforcement UNKNOWN" fail-closed message.

**Submit shape:** `onCheckIn({ customer, guests, type, delivery, start })` (L979). New-customer
object shape (`createNew`, L904-966): `{ id:'new', first_name, last_name, name (derived), email,
phone, points:0, type, member:false, gender, address:{streetNumber,streetName,street,city,state,zip},
dob, doc, idPhotos }`.

**`idPhotos` rides beside `doc`, never inside it** (L953-964; also `GuestEditor` L306-311) —
comment reiterates id-photos.jsx's own claim that nothing is filed anywhere.

**Scan-first design (L759-773):** one PDF417 scan does 4 things at once — identify, capture
document-backed verification, prefill new-customer form, decide new-vs-returning — never asks the
operator. Three-branch resolution (`onCheckInScan`, L774-829; mirrored in `GuestEditor.onScan`
L343+): matched+resolvable → `adoptCustomer`; matched but member id **not resolvable locally** →
distinct `unresolved` state (`forceNewFromUnresolved` lets operator override); no match → prefilled
new-customer form. Doc/customer name mismatch (`onPrimaryScan` ~L840-855) sets `docMismatch`
rather than silently overwriting; `attachAnyway` is an explicit override.

### A3. `shared/id-photos.jsx` (496 lines) — `window.IdPhotoCapture`

**Does NOT use `getUserMedia`, canvas, or base64.** It is a plain `<input type="file">` +
`<input type="file" capture="environment">` file picker. No camera API, no canvas dimensions, no
resolution constraints, no re-encoding.

**Public API (L276-277):**
```js
window.HWIdPhotos = { LIMITS, TYPES, TYPE_NAMES, ACCEPT_ATTR, STORAGE,
  formatBytes, readType, accept, docKeyOf, docNote, docFlag, makePhoto, releasePhoto };

window.IdPhotoCapture = function IdPhotoCapture({ photos, onChange, docKey = null, compact = false, disabled = false })
```
- `photos`: array of photo records, caller-owned (controlled component)
- `onChange(nextArray)`: callback receiving the full new array
- `docKey`: `HWIdPhotos.docKeyOf(currentDocOnScreen)`, null when none; flags photos taken
  alongside a now-discarded/mismatched document
- `disabled`: hides remove buttons

**Capture markup (L429-432):**
```jsx
<input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple onChange={(e) => addFiles(e.target.files)} style={{display:'none'}} />
<input ref={camRef} type="file" accept={ACCEPT_ATTR} capture="environment" onChange={(e) => addFiles(e.target.files)} style={{display:'none'}} />
```
`capture="environment"` is only a hint mobile browsers *may* honor to open the rear camera;
desktop falls back to the file picker. No provenance recorded — *"a file input cannot tell a
camera capture from a file on disk."*

**Photo record shape (`makePhoto`, L246-268):**
```js
{ id: 'idp-{seq}-{Date.now()}', name, size, type, addedAt: ISOString,
  docKey, format: 'JPEG'|'PNG'|'HEIC'|'HEIF'|'WebP',
  url: URL.createObjectURL(file) | null,   // Blob URL — NOT base64
  preview: 'ok' | 'unavailable' | 'failed',
  stored: false,                            // hardcoded false
  storage: 'memory' }
```
Output is a **Blob URL in the browser tab only** — no base64, no quality parameter, nothing
re-encodes the image.

**Admission rules (`accept`, L153-178):** `LIMITS = { maxFiles: 4, maxBytes: 8 * 1024 * 1024 }`
(8MB/photo). MIME allow-list: `image/jpeg, image/png, image/heic, image/heif, image/webp`.
Refuses over-count, unrecognized type (declared type wins over extension), 0-byte files,
over-size — each with a specific message, e.g. `"{name} is {size}. The limit is 8.0 MB per photo
— re-take it at a lower resolution."`

**STORAGE claim, rendered unconditionally on every mount (L185-189, L489-493):**
```js
const STORAGE = { mode: 'memory', short: 'In this browser only · not uploaded',
  line: 'Held in this browser tab only. Nothing is uploaded and nothing is filed against the
  customer — this build has no server route for ID images. Reloading or closing this page loses
  them.' };
```

**Explicit non-features (file header L39-51):** *"NO UPLOAD, NO SERVER CALL, NO INVENTED
ENDPOINT… NO CLIENT-SIDE DOWNSCALING / RE-ENCODING… NO OCR, NO FACE MATCH, NO 'does this photo
match the scan'… NO EXIF STRIPPING."* Header also specifies what the server half would need
(L53-74): a route (e.g. `PUT /api/customer/<id>/id-photo`), retention/encryption policy, audit
trail, a read path — **none exist today**.

### A4. `pos/screen-identity-binding.jsx` (589 lines) — `window.IdentityBindingScreen`

Real, live-wired screen (not mock). Single export `window.IdentityBindingScreen`. "Identity
binding" = which Weedmaps customer account resolves to which internal customer identity, with an
append-only audit trail and deliberately **no** raw re-bind toggle
(`wm_binding.py` docstring: *"No re-attach / bind route. Re-attaching is not an undo, it is the
assertion 'this Weedmaps account IS this person'"*).

**Endpoints used (header comment L8-14, matches server.py routing in Part B):**
```
GET  /api/identity/wm-binding?wm_customer_id=<id>
POST /api/identity/wm-binding/unbind
GET  /api/identity/members?q=&limit=
GET  /api/identity/review/open
POST /api/identity/review/bind
```

**Components:** `HistoryList({events})` L124, `BindingDrawer({wmCustomerId, onClose, onChanged})`
L153, `ReviewQueuePanel({tick, onChanged})` L363, `window.IdentityBindingScreen()` L492.

**`getJSON`/`post` response envelope (L69-99):**
```js
getJSON -> { url, code, ok, body, parsed, raw }
post    -> { ok, code, body, error, hint }
```

**Unbind body (L193-195):**
```js
{ wm_customer_id, identity_id: target, actor: 'Manisha Saini', reason: reason.trim(), ack_orders: !!ackOrders }
```
Refusal code `orders_need_acknowledgement` (L206) when real orders/carts exist under the handle;
copy at L310-313 clarifies unbinding never re-parents past orders. **Post-then-read-back
discipline** (L182-226): a `200 {ok:true}` is treated as a claim, not confirmation — the screen
re-GETs the binding and only reports success once the identity is actually gone.

**Bind Gate body (L389-390):**
```js
post('/api/identity/review/bind', { review_id: reviewId, candidate_identity_id: candidateIdentityId, actor: ACTOR })
```
`outcome:'bound'` writes and drops the row; gate-not-cleared is `ok:true` with nothing written,
message `'Gate did not clear: ' + b.why` — shown, never a silent no-op.

### A5. `shared/hw-live-identity.js` (2474 lines) — dev/QA seam panel, not wired into production screens

Floating debug panel, same-origin only. **Not called from `verification.jsx`, `checkin.jsx`, or
`crm.jsx`** — grep confirms nothing outside this file calls `HW_IDENTITY.*`.

**Public surface (L2427-2466, header L58-62):**
```js
window.HW_IDENTITY = { __armed, status, members, page, totals, member, match, base,
  refresh(), search(q), openMember(id), matchOrder(wmOrderId),
  record(identityId, method, decision, extra), simulate(),
  simForm, simResult, synthetic, open(), close(), disable(), enable() };
window.HW.IDENTITY   // mirrored plain property, unread by any pos/ or athome/ screen
```

**Endpoints wrapped:**
```
GET  /api/identity/members?q=&limit=25&offset=          L449
GET  /api/identity/member?identity_id=<id>               L477
GET  /api/identity/order-match?wm_order_id=<id>          L498
POST /api/identity/verify   {identity_id, method, decision, ref, expires_at, note}   L551
POST /api/customer/create   (simulate — real HMAC webhook door)                       SIM_PATH const L302
```
`record()` response distinguishes `r.body.logged` (bool) from `marked_verified`, plus a verbatim
`r.body.why` (never paraphrased).

**Documents why `pos/screen-orders.jsx`'s fraud panel is fake (L36-43):** *"There is no risk
model — `engine.evaluate_fraud`… returns (action, reason) and nothing else — and there is no
per-field verification model at all. The screen cannot be made honest by feeding it different
numbers, because a bar and a badge ARE the claim that a check ran."*

Toggle: `?hwident=off`, or `HW_IDENTITY.disable()`.

### A6. `shared/hw-live-checkin.js` (2080 lines) — dev/QA seam panel for check-in

Same pattern as A5. `pos/checkin.jsx` does **not** call `HW_CHECKIN.*` directly — the one
connection is `verification.jsx`'s `expiryEnforced()` reading `window.HW_CHECKIN.board` /
`.contract` as a read-only fallback.

**Public surface (L90-94, L2033-2071):**
```js
window.HW_CHECKIN = { status, board, people, orders, contract, candidates, base, counter,
  match(cid, code), bind(cid, oid), bindManual(cid, oid), reject(cid, oid), handoff(oid),
  claim(cid, who), unclaim(cid), leave(cid), create(row),
  refresh(), open(), close(), disable(), enable() };
```

**Endpoints (L573-928):**
```
GET  /api/checkin/board?location_id=<counter>
GET  /api/checkin/contract
POST /api/checkin/candidates  { wm_order_id }
POST /api/checkin/match       { checkin_id, code }
POST /api/checkin/bind        { checkin_id, wm_order_id, decided_by, manual: true|false }
POST /api/checkin/reject      { checkin_id, wm_order_id, decided_by }
POST /api/checkin/handoff     { wm_order_id, decided_by }
POST /api/checkin/state       { checkin_id, claimed_by } | { checkin_id, unclaim:true } | { checkin_id, state:'left' }
POST /api/checkin             (create) — see body below
```

**`create(row)` body (L877-930)** — arrival record with expiry and a hash, never a raw doc value:
```js
{ first_name, last_name, phone, dob, location_id,
  doc_expires_at,
  gov_id_hash: opt(b.gov_id_hash) }   // only forwarded if caller supplies a real hash
```
Comment (L905-920) warns explicitly: the real route refuses raw document values outright and
takes only a pre-computed `gov_id_hash`; `IdScanPanel.doc.num` is a masked display fragment
(`'••••4821'`), **not** a hash — must never be forwarded as one.

**`bindManual` (L799-811)** writes confidence 100, signal `gov_id`, note `"human verification of
the document"` — the attested "I looked at this person's ID myself" action.

**Real production connection point:** `pos/data.jsx`'s `postWalkInCheckIn()` posts to
`/api/checkin/walkin` — a **different, real** route, the actual live wiring from the checkin UI
into the backend (see A8 below).

### A7. `athome/crm.jsx` (344 lines) — Members CRM: identity/verification 100% hardcoded

No connection to `verification.jsx`, `hw-live-identity.js`, `window.HWV`, or `window.HW.IDV`. All
ID-verification data is a static object:
```js
const REC = { ..., idVerified:true, idType:"CA driver's license", idExpires:'Aug 2028', ... };  // L38-47
```
Rendered unconditionally green:
```jsx
{REC.idVerified && <Pill kind="good" soft icon="shield">ID verified</Pill>}          // L132
<span>Verified</span><Pill kind="good" soft icon="check-circle">Face match</Pill>    // L182 — "Face match" has no backing anywhere else in the estate
<div className="mono">DL ••• 4821 · exp {REC.idExpires} · DOB {REC.dob}</div>        // L184
```
`IDPhoto` (L14-23) is a decorative silhouette placeholder, comment: *"verified-ID portrait
placeholder (drop-in for a real scan crop)"* — no connection to `window.IdPhotoCapture`. No tier
concept, no expiry-enforcement awareness. `"Face match"` claim is a genuine loose thread — no
feature anywhere in either repo performs face matching.

### A8. Grep sweep — additional relevant hits

`grep -rn -i 'didit\|verif\|liveness\|selfie\|id_photo\|IdPhoto' pos/ shared/ athome/ engage/ incentives/`
returned 571 lines / 45 files; below are the genuinely new pieces not already covered in A1-A7.

- **`pos/customer-extras.jsx:360`** — `window.MemberVerificationCard = function
  MemberVerificationCard({ m, idv, onLog })` — a real consumer of the tier UI: calls
  `window.HWV.assurance(idv)` (L362), renders `<window.IdentityLadder v={idv} compact />` (L405),
  `<window.SmsVerifyPanel/>` (L406), `<window.RemoteIdPanel/>` (L409) conditionally by tier. Same
  soft-lapse-vs-clean-pass distinction as verification.jsx (L376-398: *"'NOTHING FURTHER WILL EVER
  BE ASKED' IS A PROMISE, AND A SOFT-LAPSED ALLOW CANNOT KEEP IT."*). This is where the
  ID-verification card surfaces on a customer's own record in the POS (`data-tour="member-verify"`,
  L368).

- **`pos/screen-register.jsx`** — real consumer of the ladder on the Register floor:
  - L1136: `const idv = (window.HW.IDV || {})[customer.id] || null;`
  - L1165: `{window.AssuranceBadge && <window.AssuranceBadge v={idv} size="sm" />}` — guarded; if
    verification.jsx failed to load, silently renders nothing at this call site (no distinct
    "verification unavailable" message here).
  - L354-386: `onCheckIn(p)` → `window.HW.addCheckIn(p)`; `checkInCustomer(m)` →
    `window.HW.openCheckInFor(m) || window.HW.addCheckIn(...)`.
  - Comment L760-783 flags a known, unresolved gap: `checkInCustomer`/`CustomerSearch` is a
    **second, divergent path** that checks a known member in immediately with no document gate,
    unlike `CheckInModal` (A2) which blocks until a document is scanned. Not yet consolidated.
  - **Owner rule (see project CLAUDE.md "Never modify the Register screen"):** this file is
    off-limits for direct edits; any new module integrates via a Home card / its own screen, never
    by patching screen-register.jsx.

- **`pos/screen-orders.jsx`** — "Identity & fraud check" fold (`Fold id="wm-fraud"`, L2727-2779):
  reads mock `window.HW.WM_ORDER[o.id]` (`pos/data.jsx:327-361`): `{wmId, contact:{name,phone,
  email,address}, matchOn, wmStatus, risk (0-100), level:'low'|'medium'|'high',
  match:'existing'|'ambiguous'|'new', matchId/candidates, matchConf,
  checks:{id,name,phone,email,address}, flags:[]}`. **Live orders (`o._live===true`) render
  `"NOT COMPUTED"` instead of a risk bar** (L2731-2752): *"There is no risk score and no per-field
  identity check in this system… nothing here has screened this customer."* Non-live/mock orders
  still render a fabricated `score {wm.risk}/100` bar (L2759-2762) — a live-vs-mock behavior split
  worth resolving in the new module (mock path fabricates confidence the real path refuses to
  show). Comment L163-169: *"Verification gates are enforced server-side, not here… In-store ID
  scan counts as document-backed verification, so a customer verified at the counter is **not**
  sent through Didit again."*

- **`pos/data.jsx`** — mock store AND the one real live-write bridge from check-in UI to the
  backend ladder:
  - `const IDV = {...}` (L393-406) — mock ledger keyed by member id:
    `{ doc:{type,num,expires,scannedAt,by,where,photo}, phone:{value,smsVerified,sentAt|verifiedAt},
    remoteId:{status,at|sentAt,by,link,attempts:[{at,by,status,receipt}]} }`.
  - `function addCheckIn(p)` (L669-752) creates the local check-in, then
    `postWalkInCheckIn(c, member)` (L623-665) does a **fire-and-forget POST**:
    ```js
    window.HW_LIVE.post('/api/checkin/walkin', { first_name, last_name, dob, phone, gov_id_hash? })
    ```
    On success stashes `member.hw_identity_id` / `member.hw_identity_outcome` from the response —
    genuinely wired to `wmdemo/checkin_api.create_checkin_resolved` (see B2), which "runs the SAME
    5-tier identity ladder every order-bound path already runs BEFORE writing" (L578-582).
    `identity_id` is `null` on AMBIGUOUS/UNDETERMINED/ANONYMOUS and never overwritten with a guess
    (L618-622).
  - `addCheckIn` also writes a fresh `IDV[member.id]` entry the instant a scanned doc reaches it
    (L722-725) — this is what flips local tier 0→1 for later screens.
  - `function addMember(m)` (L511-533), `updateMember(id, patch)` (L535-552) — allow-list writers;
    comments note both previously silently dropped `idPhotos` and the first/last split (fixed).

- **`athome/account-a.jsx`, `account-b.jsx`, `account-c.jsx`** — identical hardcoded stub in each:
  `ME = { idVerified:true, idExpires:'Aug 2028', ... }` (L16), rendered as
  `sub={ME.idVerified?'Verified · exp '+ME.idExpires:'Not verified'}` (e.g. account-a.jsx L180).
  Same disconnection pattern as A7.

- **`engage/screen-customers.jsx:259`** — `{c.ageVerifiedAt ? <HDPill tone="ok" label="age
  verified"/> : <HDPill tone="warn" label="unverified"/>}` — a third, independent "verified"
  vocabulary (age-verified timestamp), unconnected to the T0/T1/T2 ladder.

- **`pos/screen-cart.jsx`** — no real touch; "Verified" hits are changelog comments only.

No `liveness`, `selfie`, `id_photo` (snake_case), or `IdPhoto` hits outside files already covered.

### A9. Frontend real-vs-stub summary

| Piece | Status |
|---|---|
| `verification.jsx` tier logic (`assurance`, `expiryEnforced`) | **Real, load-bearing** — pure functions, no backend dependency |
| `verification.jsx` `IdScanPanel` | **Explicit simulator** — labeled DEMO, 6 hardcoded people, no PDF417 reader |
| `verification.jsx` `SmsVerifyPanel`/`RemoteIdPanel` send | **No backend** — "no endpoint and no send path" (verbatim) |
| `shared/id-photos.jsx` `IdPhotoCapture` | **Real capture UI, zero persistence** — Blob URLs only, no upload route |
| `pos/screen-identity-binding.jsx` | **Real, live-wired** — GET/POST confirmed against real backend |
| `shared/hw-live-identity.js`, `hw-live-checkin.js` | **Real dev/QA seam panels**, live-wired, not integrated into any production screen |
| `pos/data.jsx` `postWalkInCheckIn` → `/api/checkin/walkin` | **Real, live, fire-and-forget bridge** into the backend ladder |
| `pos/screen-orders.jsx` fraud/risk (mock path) | **Fabricated** for non-live orders; honestly stubbed `"NOT COMPUTED"` for live orders |
| `athome/crm.jsx`, `account-a/b/c.jsx` | **Fully hardcoded/fake** — static `idVerified:true`, unbacked "Face match" claim |
| `engage/screen-customers.jsx` age-verified | Separate static field, not part of the ladder |

---

## PART B — BACKEND (`/Users/jt/wm-demo`)

### B1. `wmdemo/identity_api.py` (1088 lines) — read layer + one write

Docstring (L13-15): *"this module adds NO matching logic. It reads what the ladder decided and
says so. The one thing it writes is the thing that was missing: a record of a verification
ATTEMPT."*

**Table owned:** `identity_verification_log` (append-only), created in `init()` (L103-121):
`id, identity_id, ts, method TEXT('didit'|'in_store'|'wm_document'|'manual'), decision
TEXT('approved'|'declined'|'review'|'unknown'), ref, expires_at, actor, note`.

**Functions:**
```
_db()                                                              L87
_int(v, default=None)                                              L93
init()                                                              L103
_fixture_marker(row)                                                L233   # QA/demo-row heuristic; prefixes QAID,QATIER,QACI,QAAPI,QAPU,QAFU
_member_row(row, verified=None)                                     L254
members(q="", limit=50, offset=0)                                   L285
member(identity_id)                                                 L344
_gov_id_state(h)                                                    L374
_provenance(ev)                                                     L393   # verdict: 'weedmaps'|'demo'|'unknown'
_order_payload(wm_order_id)                                         L445
_weedmaps_side(order)                                                L460
_ours_side(row)                                                     L497
_wm_mapping(order)                                                   L516
_disagreement_reason(stored_id, row, order)                          L556
order_match(wm_order_id)                                             L609   # ZERO writes, engine.resolve_identity(order, persist=False)
verification(identity_id)                                            L734
record_verification(identity_id, method, decision="approved", ref=None, expires_at=None, actor=None, note=None)  L797
candidates_for(subj)                                                  L943
match_order(order)                                                    L996
match_fields(first=None, last=None, dob=None, phone=None, address=None, wm_customer_id=None, gov_id_state=None, gov_id_number=None)  L1008
_match_response(subj)                                                 L1024
qs(path)                                                              L1078
```

`members()` returns `{query, limit, offset, total, total_reason, returned, members,
real_in_page, fixture_in_page, unknown_in_page, fixture_note, verification_totals}`.
`member()` adds `orders, order_count, gov_id, verification`.
`order_match()` returns a large dict: `wm_order_id, found, payload_source, signature_verified,
provenance, weedmaps, ours, match{state,tier,tier_label,factors,evidence,identity_id,
vetoed_by_document,veto_note,address_used,confidence=None,candidates=None}, wm_mapping, stored,
fraud{action,reason,risk_score=None,risk_level=None,checks=None}, verification, gaps`.
`verification()` returns `{identity_id, state:'verified'|'lapsed'|'checked_not_proven'|
'never_checked', verified, via, at, ref, expires_at, ever_checked, reason, attempts,
attempt_count, methods, phone_binding=None, phone_binding_reason}`.
`record_verification()` — the **one write path**: validates `method in store.VERIFY_METHODS`,
`decision in ("approved","declined","review","unknown")`; only `approved` calls
`store.mark_verified`. Returns `{identity_id, logged, marked_verified, why, verification}`.

`GAPS` dict explicitly declares as `None`/unimplemented, with reason strings: risk_score,
risk_level, per-field checks, match_confidence, match_candidates, phone_binding — *"the gap IS the
value."*

### B2. `wmdemo/identity_match.py` (761 lines) — the pure matching core

Pure function, no DB/network/config/clock (proven by `qa/identity_match_pure_probe.py`).
`engine.resolve_identity` **delegates entirely** to this file (since 2026-08-27, no second ladder).

**`__all__`:** `match, answer, subject_from_order, subject, phone_e164, norm_dob, name_dob_fp,
addr_fp, gov_id_hash, wm_id_key, doc_conflict, lev_le1, doc_fingerprint, MATCHED, NO_MATCH,
UNDETERMINED, AMBIGUOUS, ANONYMOUS, LANES, LANE_TIER`.

**The ladder (L140, L143):**
```python
LANES = ("gov_id_hash", "phone", "name_dob_fp", "dob", "wm_id")
LANE_TIER = {"gov_id_hash": 0, "phone": 1, "name_dob_fp": 2, "dob": 3, "wm_id": 4}
```
Tier 0 government document vetoes all others; Tier 1 phone exact; Tier 2 name+DOB exact; Tier 3
DOB + fuzzy name (Levenshtein ≤1); Tier 4 Weedmaps account id (weakest — `AMBIGUOUS` not `MATCHED`
if shared). Address-only matching was **deleted 2026-08-18** (fused two roommates into one
identity) — `addr_fp` is now re-findability signal only, never matched on.

**Key signatures:** `phone_e164(raw)` L153, `norm_dob(raw)` L162, `name_dob_fp(first,last,dob)`
L176 (sha256, casefolded), `addr_fp(addr)` L184 ("RECORDED, NEVER MATCHED ON"), `wm_id_key(wm_id)`
L199, `lev_le1(a,b)` L218, `gov_id_hash(order)` L244, `doc_conflict(candidate, gov_h)` L288, `subject_from_order(order)` L322, `subject(first=None,last=None,dob=None,phone=None,address=None,wm_id=None,gov_id_hash=None,name_dob_fp_=None,addr_fp_=None)` L340, `has_signal(subj)` L366, `match(subj, candidates, unreadable=None)` L453 (the whole decision — returns `{outcome, why, identity, identity_id, tier, factors, decided_lane, ambiguity, unreadable, vetoed, vetoes, has_signal, subject}`), `answer(verdict)` L719 (only-safe accessor: identity row iff `outcome==MATCHED`, else `None`).

**Outcomes (L132-136):** `MATCHED="matched", NO_MATCH="no_match", UNDETERMINED="undetermined",
AMBIGUOUS="ambiguous", ANONYMOUS="anonymous"` — mapped to HTTP 200/409/503 at the shell
(`identity_api.MATCH_HTTP_STATUS`).

### B3. `wmdemo/bind_gate.py` (301 lines) — links a queued order to a walk-in identity

"Bind Gate Part 3." `name_dob_gate(context, candidate)` L130 — pure, `(cleared: bool, why: str)`,
reuses `identity_match.name_dob_fp` for both sides. `_refuse(code, message, **extra)` L192.
`attempt_bind(review_id, candidate_identity_id, actor=None)` L198 — the one entry point. Refusal
codes (L118): `review_not_found, review_not_open, candidate_identity_not_found,
candidate_is_a_merge_tombstone, no_wm_id_on_queued_order`. Success outcomes (both `ok:True`):
`BOUND="bound"` L126, `GATE_NOT_CLEARED="gate_not_cleared"` L127. On `BOUND`:
`store.add_wm_id_to_identity` + `store.resolve_identity_review(...,"bind_gate")`. On
`GATE_NOT_CLEARED`: nothing written, review stays open, attempt recorded via
`store.record_bind_attempt`. Not a re-implementation of `wm_binding.py` (the unbind module) — the
only re-attach route, deliberately narrow (fresh name+DOB evidence required).

### B4. `wmdemo/verify.py` (361 lines) — the Didit provider seam. **KEY CAVEAT SOURCE.**

**Verbatim (L19-24):**
> "THIS PROVIDER IS NOT IN SERVICE — see `SEAM_WIRED` below before trusting a `didit`
> verification. `DiditProvider.verify_document`, `provider()` and `verify_webhook_v2` have ZERO
> callers outside this file. Nothing in either repo performs a Didit check, so a `didit` row in
> the identity ledger is A CLAIM SOMEBODY POSTED, not a document that was inspected. `verify_gate`
> reads `SEAM_WIRED` and refuses to let such a row waive a gate."

**Is Didit actually called? NO.** Evidence: `SEAM_WIRED = False` (L178) with the grep proof
offered in-comment (L154-155): `grep -arn "verify_document\|verify\.provider(" wm-demo
--include='*.py'` → only this file's own defs; `grep -rin didit POS-Admin` → nothing.
L156-160: *"The ONLY way a `didit` row enters the ledger is POST /api/identity/verify →
identity_api.record_verification (identity_api.py:698), which validates the METHOD NAME against
store.VERIFY_METHODS and then records the provider's approval on the caller's say-so. No document
is fetched, no image is read, DIDIT_API_KEY is never read on that path. So a stored `didit`
verification is an ASSERTION, not a check."* `.env`/`.env.example` carry **no `DIDIT_API_KEY`**
(confirmed, §B10). `provider()` (L325-332) returns `NullProvider()` unless `DIDIT_API_KEY` is set
— since it never is here, `NullProvider` is what actually runs.
`NullProvider.verify_document` (L209-215) just returns `result(why="no verification provider
configured")`.

**`DiditProvider` (L218-322) is real, callable HTTP code** (uses `urllib.request.urlopen`, POSTs
multipart to `self.base + "/v3/id-verification/"`) — genuine implementation, simply never invoked
by anything in the repo. `DiditProvider.__init__(self, api_key, base=None, timeout_s=25.0,
persist=False)` L228; `verify_document(self, image_bytes, filename="id.jpg", back=None,
vendor_data=None)` L256; `_map(self, payload, latency_ms)` L295; `_multipart(self, fields, files)`
L235.

**Other API:** `result(**kw)` L62 (closed key-set, raises `KeyError` on unknown kwarg);
`doc_hash(issuing_state, document_number)` L98 (`doc:`-namespaced sha256, state required, DOB
excluded); `url_hash(url)` L122 (`url:`-namespaced, for an upload URL, never an identity);
`is_document_identity(h)` L131 (`True` only for `doc:`); `comparable(a,b)` L136; `seam_status()`
L187 → `{wired, provider, configured, calls_made_this_process, note}`;
`class NullProvider` L209 (`name="null"`); `class DiditProvider` L218 (`name="didit"`);
`provider()` L325; `verify_webhook_v2(raw_body, sig_hdr, ts_hdr, secret, tolerance_s=300)` L337.

**Vocabulary:** `UNKNOWN, APPROVED, DECLINED, REVIEW = "unknown","approved","declined","review"`
(L39); `HARD_FAIL_RISKS` frozenset (L45-51); `_DECISION` vendor-enum map (L57-59); `DOC_NS="doc"`,
`URL_NS="url"` (L94-95).

### B5. `wmdemo/verify_gate.py` (1396 lines) — the verification gate resolver

Owner's rule (L5-11): counter scan (real, in-store) waives Didit delivery check IF verified and
unlapsed. **"Only one of those two routes has been built" (L15-24):** *"The counter scan is real:
checkin.py:858 calls store.mark_verified when a guard scans an ID. The Didit run is NOT…there is
no Didit flow in either repo… no document is fetched and DIDIT_API_KEY is never read."*
**Judgement call 6 (L151-172), key line:** *"AN UNBACKED `didit` DOES NOT WAIVE ANYTHING, ON ANY
GATE, AND IS NOT CONFIGURABLE… `didit` claimed the strongest thing this system can say about a
person… and nothing in either repo performs that inspection… `manual` at least admits nobody
scanned anything, while `didit` asserted a provider approval that never happened."*

**Three gates (`GATES`, L501):** `PICKUP_HANDOFF, DISCOUNT, DELIVERY_DISPATCH`.

**Key functions:** `didit_is_backed()` L319 → `bool(getattr(verify,"SEAM_WIRED",False))` → always
`False` today. `_document_backed()` L342, `_gate_policy(...)` L358, `set_store_policy(store_id,
gate, **kw)` L407, `clear_store_policy(store_id=None)` L418, `policy_for(gate, store_id=None,
override=None)` L514 → `(policy, problems)`.
`class Decision(object)` L615 — the one return shape, never a bare boolean; `__slots__`: `gate,
satisfied, action, enforced, computed, identity_id, resolved_identity_id, state, block_code, via,
at, expires_at, expiry_known, record_verified, ever_checked, reason, remedy, caveats, policy,
expiry_enforced, would_block_code, would_block_reason`.
`resolve(gate, identity_id, now=None, store_id=None, policy=None)` L797 — single function every
gate calls, never raises (wraps `_resolve`, fail-closed on exception). `_resolve(...)` L837.
`gate_pickup_handoff` L1261, `gate_discount` L1266, `gate_delivery_dispatch` L1271,
`requires_didit(identity_id,...)` L1278 → `(needs_check, decision)` — docstring warns the name
overpromises since there's no Didit flow to send anyone to. `identity_for_wm_customer` L1299,
`evaluate_all(identity_id,...)` L1316, `policy_report(store_id=None)` L1321 (includes
`didit_backed`, `didit_note`).

**Accept sets (L301-315):**
```python
DOCUMENT_BACKED_WHEN_WIRED = ("in_store", "didit")
DOCUMENT_BACKED_TODAY = ("in_store",)   # what's actually active
```
Imports `verify` for exactly one constant (`verify.SEAM_WIRED`) — never calls the provider, no
network (L270-274, L455-457). Reads `store.verification_of()` as sole source of truth on
verification state; unrelated to bind_gate.py's concern (order↔identity linking).

### B6. `wmdemo/demo_seed_identities.py` (540 lines) — demo/QA-only seeder

Purpose (L12-18): on live deployment, every one of 8 identities read `verified=False`; this seeds
contrast for panel demos. **Off unless asked for** (L137-138): `WM_DEMO_SEED_IDENTITY_VERIFY`,
falls back to `demo_seed.enabled()`/`WM_DEMO_SEED_DEMO`. Writes only through real production
writers (`identity_api.record_verification()`, `store.mark_verified()`), never hand-writes rows.

7 seeded people (`PLAN`, L178-230): Elena Marchetti (verified, `in_store`, real doc); Paolo
Marchetti (`lapsed`, same phone as Elena but different document — proves verification doesn't
launder across a shared phone); Jane Doe (verified, `manual`, no document/expiry — "the weak
case"); Ari Kessler (`attempt`, `didit`, decision=`declined`, note explicitly *"no vendor call was
made"* — confirms even seed data never touches the real Didit provider); Tomas Iglesias, Marcus
Vane, Noor Haddad (`leave` — deliberate untouched controls).

Functions: `enabled()` L235, `_find(person)` L254, `_document_ref(row)` L288,
`_seeded_attempts(identity_id)` L306, `_record(...)` L315, `_seed_one(person, now)` L330,
`seed(now=None)` L440, `report()` L470, `status()` L489, `_db()` L529,
`seeded_attempt_count()` L536.

### B7. `qa/verify_gate_probe.py` (819 lines) — proof-by-execution for verify_gate.py

Tests (L2-45): truth table across 4 verification states × 3 gates; waiver works and is refused
lapsed; `manual` waives nothing by default / only with `HW_VGATE_MANUAL_WAIVES=1`; `didit`
satisfies its own channel; `wm_document` waives nothing; unknown-expiry cap; fail-closed on DB
error; disabled gate self-explains; malformed config reported not silently honored; mutation
testing (each gate broken must flip probe red then green). Quote: *"A GATE YOU HAVE NOT EXECUTED
IS A HYPOTHESIS."*

Key functions: `check(name, ok, detail="")` L104, `build_ledger()` L160, `truth_table(now)` L202,
`waiver(now)` L243, `manual_case(now)` L284, `method_cases(now)` L333, `expiry_cases(now)` L353,
`failure_modes(now)` L391, `mutations(now)` L510, `toggle_off(now)` L629, `main()` L763.

**Status per `qa/battery.py:992`: `"RED standalone: 75 pass / 6 fail (W1, D1 x n)"` — currently
failing, NOT registered in the battery's `SUITES` list.**

### B8. `qa/gate_wiring_probe.py` (849 lines) — proves verify_gate is wired into engine.py

Docstring premise (L2-6): *"`wmdemo/verify_gate.py` was built, tested (82 pass) and CALLED BY
NOTHING."* Drives whole orders through Draft→Create→ingest against a scratch DB. Checks G0-G5+MUT
(L10-32): source wiring exists (G0); unverified delivery HELD, no driver dispatch, order stays
PENDING (G1); reversible (G1b); verified delivery DISPATCHES (G2); unverified profile refused
first-timer discount (G3); Draft pricing untouched (G3b); exception-swallow trap fixed — fails
closed not open (G4); document-veto audit trail writes `hw_identity_audit` (G5); mutant source
copy per-gate must revert to pre-fix defect (MUT). "NO NETWORK… `verify.provider()` is forced to
the null provider. Nothing here calls Didit." (L34-36).

Key functions: `SetupFailed` L89, `check(...)` L93, `run(name, fn)` L100, `setup()` L322,
`checks()` L376, `main()` L826.

**Status: REGISTERED in battery** (`SUITES`, battery.py:455), floor 19 checks
(`EXPECTED_CHECKS["gate_wiring_probe"]=19`, battery.py:1566).

### B9. `qa/battery.py` (3953 lines) — probe registration mechanism

- `SUITES = [...]` L177 — plain list of probe module names, e.g. `"gate_wiring_probe"` at L455
  (comment: `# 19 checks — the publish gate is actually wired`).
- `REFUSED = {...}` L831 — probe-name → reason for kept-out probes; `verify_gate_probe` here at
  L992 with the "75 pass / 6 fail" reason.
- `EXPECTED_CHECKS = {...}` L1126 — registered-suite → min check-count floor;
  `"gate_wiring_probe":19` at L1566.
- `NOT_A_SUITE = {...}` L2536 — non-probe filenames to ignore.
- `run_suite(name)` (~L3270) — subprocess-runs `qa/<name>.py`, parses stdout for a leading
  PASS/FAIL/NOTRUN/SKIP token (exact match, not prefix — 2026-08-26 fix). Sets env
  `WMDEMO_BASE, WM_DEMO_BASE, BRAND_PULL_PROBE_REUSE=1, PRICING_PROBE_SEED`.

**Net: `gate_wiring_probe` counts toward battery pass/fail (19-check floor); `verify_gate_probe`
does not run as part of the battery at all.**

### B10. `docs/SCOREBOARD.md` (541 lines) — structure

Sections top to bottom: `# Method C — Green-Light Scoreboard` (GL-1..8); `# Implementation Sprint
T1–T6` (incl. T2-a/b/c identity/fraud matching, Sprint N2 identity merge); `## Sprint N1 —
Mapping UX`; `## Sprint N3 — Promo registry`; `## Sprint N2 — Identity merge quality, ledger UI,
Draft-time lookup`; `## Hardening pass`; `# Workstream B — Region × Menu mapping`; `# Workstream C
— Pickup fulfillment`; `# Durability`; `## Session 2026-08-18/19 (overnight) — 207 PASS / 0 FAIL
across 25 suites` (includes `identity_tier_probe` row: tier-4 addr_only deletion, document-veto
decoration bug, tier-0 fraud-matrix gap, `doc_hash` unqualified-number bug, URL-hash-overwriting-
doc bug); `## Hyperwolf Bounty` (BT-1..8, unrelated).

**Grep for `didit|liveness|checkin|verification|verify` across the whole file returns zero
matches.** SCOREBOARD.md documents the *matching* ladder work (T2, N2, identity_tier_probe) but
never mentions verify_gate.py, bind_gate.py, Didit, or the checkin verification flow — those
postdate its last identity entry and aren't reflected there at all. **Gap for the new module's
own tracking doc.**

### B11. `wmdemo/checkin.py` (1090 lines) — pure-function check-in matcher, no HTTP, minimal writes

Thesis (L1-56): arrival is the trigger, outstanding pickup orders are the haystack. Scoring:
`conf = max(weight of matched signals) + 4 if a second signal corroborates` — never summed.

**Weights (L71-72):** `SIGNALS = {"gov_id":100,"code":99,"phone":92,"wm_acct":88,"name_dob":84,
"name":64,"sole":55,"window":15}`. `AUTO,CONFIRM = 90,60`. `CORROBORATION_BONUS=4`.
`AMBIGUITY_PENALTY=25`. `AUTO_MARGIN=20`. `CIRCUMSTANTIAL=frozenset(("sole","window"))` — can
never alone reach CONFIRM.

**Key functions:** `_ci_view(checkin)` L207 — normalizes + resolves identity via 4-tier lookup
(gov_id_hash → row's own identity_id → phone → name_dob_fp); returns `identity_source`.
`_order_view(order)` L256 — pulls WM payload, calls `engine.resolve_identity(payload,
persist=False)`. `_code_matches(code, wm_order_id)` L320 — pickup-code suffix, min 4 alnum chars.
`_name_signal(ci, ov)` L333 — exact surname + Levenshtein≤1 first name; DOB mismatch on both sides
KILLS the signal. `score_candidate(checkin, order, pool=None)` L442 — public pair scorer →
`{"conf":int,"signals":[str],"why":str}`, never raises. `_apply_ambiguity(cands)` L527 — same
evidence on 2+ orders → all penalized -25, capped below AUTO.
`match_checkin(checkin_id, location_id=None, code=None, now=None)` L575 — **the matcher** →
`{"state":"auto"|"confirm"|"choose"|"none","top","candidates","why","pool","excluded",
"same_person","ready","early","margin"}`.
`bind(checkin_id, wm_order_id, decided_by=None, manual=False)` L788 — the write: `manual=True` →
conf 100/gov_id/state 'manual'; `decided_by` set → 'confirm'; `decided_by=None` → 'auto' only if
verdict was already 'auto' (unattended code can never bind below AUTO). **This is where an
in-store scan becomes a Didit-waiving verification:** on confirm/manual bind, stamps
`checkin.gov_id_hash` onto the order's resolved identity via `store.set_gov_id_hash`, then
`store.needs_verification` + `store.mark_verified(learned_id, "in_store", ref="checkin:<id>",
expires_at=doc_exp)`. Auto binds never learn.
`reject(checkin_id, wm_order_id, decided_by=None)` L921 — append-only negative example.
`handoff(wm_order_id, decided_by=None)` L976 — closes to 'served', reports `next_status:"COMPLETE"`
for the caller to push to WM (this module makes zero WM calls itself).
`awaiting_board(location_id=None, now=None)` L1011 — counter board: every order classified
`bound|unclaimed|awaiting_arrival|no_show`.

Imports engine's own normalizers by name (L62-67): `_gov_id_hash, _lev_le1, _name_dob_fp,
_norm_dob, _phone_e164 as _norm_phone, resolve_identity` — deliberately, so there is one
normalization implementation, not two.

A check-in is "checked in" simply by existing with `state='waiting'`; identity is resolved on
read via `_ci_view`, never pre-resolved except when the caller already supplied `identity_id`.

### B12. `wmdemo/checkin_api.py` (1237 lines) — thin HTTP adapter over checkin.py

Owns no tables, no `init()` — deliberate, avoiding the split-ownership bug documented for
`identity_verification_log` (see B13). Imports `checkin, config, identity_api, identity_match,
store` (L80).

**⚠️ Stale docstring flag:** file's own docstring (L5-8) says *"server.py does not import it. Zero
routes, zero rows in `checkins`."* — **now false**: server.py imports `checkin_api` (server.py:77)
and wires 9 routes to it (server.py:2596-2607, 3694-3724). Treat the rationale as valid, the
"currently unwired" claim as stale.

**Handlers:**
```
_expiry_from_body(b)                  L202   # normalizes doc_expires_at|expires_at|doc_expires; refuses disagreeing values
_doc_expiry_view(stored, now=None)    L281   # -> not_supplied|valid|expired|unreadable
awaiting_board(body=None)             L376   # HTTP: merges checkin.awaiting_board() + people strip + expiry_enforcement (config.enforce_doc_expiry())
create_checkin(body=None)             L539   # HTTP: walk-in creation, refuses raw doc values, requires surname/phone/gov_id_hash/identity_id, does NOT resolve identity
create_checkin_resolved(body=None)    L683   # HTTP: "Bind Gate Part 2" — runs the same 5-tier ladder BEFORE writing; matched->merge/upsert, no_match->mint, ambiguous/undetermined->store.queue_identity_review
match(body=None)                      L861   # HTTP: thin wrap over checkin.match_checkin; no "ok" key by design
order_candidates(body=None)           L884   # HTTP: inverse view (order -> ranked people)
bind(body=None)                       L1004  # HTTP: thin wrap over checkin.bind; decided_by has NO default
reject(body=None)                     L1022
handoff(body=None)                    L1035
set_state(body=None)                  L1051  # claim/unclaim, or set waiting/left only (bound/served refused by name)
contract(body=None)                   L1161  # serves scoring weights/constants as JSON so POS-Admin never hardcodes a 2nd copy
```

**JSON field names:** requests: `first_name`/`first`, `last_name`/`last`, `dob`, `phone`,
`gov_id_hash`, `location_id`, `identity_id` (create_checkin only). **Rejected** raw-doc keys:
`gov_id, gov_id_number, document_number, dl_number, id_number, barcode, pdf417`.
Response: `{"ok":true,"checkin":<row>,"id","state","doc_expires_at","doc_expiry":{state,...},
"why"}`; `create_checkin_resolved` adds `"identity":{"outcome","identity_id","created","tier",
"factors","why"}`. `awaiting_board` adds `people[]` (each:
`id,name,first_name,last_name,dob,phone,resolved_identity_id,identity_source,stale,
gov_id_hash_short,doc_expires_at,doc_expiry,identity_id,location_id,arrived_at,waited_s,state,
claimed_by,holds_wm_order_ids,unclaimed`), `people_counts`, `expiry_enforcement`, `stale`.

`SIGNAL_LABELS` dict (L109-118) — human-readable label map for `checkin.SIGNALS` keys; reuse
rather than re-deriving.

### B13. `wmdemo/store.py` (4652 lines) — identity/checkin/verification tables and functions

**`hw_identities`** (L173-186, +ALTER L439-446):
```sql
CREATE TABLE IF NOT EXISTS hw_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_e164 TEXT, phone_is_voip INTEGER NOT NULL DEFAULT 0,
  first_name TEXT, last_name TEXT, dob TEXT,
  name_dob_fp TEXT, addr_fp TEXT, gov_id_hash TEXT,
  wm_ids TEXT NOT NULL DEFAULT '[]',
  pos_customer_id TEXT,
  fulfilled_count INTEGER NOT NULL DEFAULT 0,
  flags TEXT NOT NULL DEFAULT '[]',
  first_timer_redeemed_at REAL, first_timer_redeemed_source TEXT,
  verified_at REAL, verified_via TEXT, verified_ref TEXT, verified_expires_at REAL,
  first_seen_at REAL NOT NULL, last_seen_at REAL NOT NULL
);
-- ALTER-added: merged_into INTEGER (L440, manual-merge tombstone)
```
Indexes: `idx_ident_phone, idx_ident_namedob, idx_ident_addr, idx_ident_dob, idx_ident_verified`
(L187-190, 449-450).

**`checkins`** (L248-256, +ALTER L466-467):
```sql
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,              -- 'ci-<epoch>-<short>'
  identity_id INTEGER,
  first_name TEXT, last_name TEXT, dob TEXT, phone TEXT,
  gov_id_hash TEXT,
  location_id TEXT,
  arrived_at REAL NOT NULL,         -- absolute epoch
  state TEXT NOT NULL DEFAULT 'waiting',  -- waiting|bound|served|left
  claimed_by TEXT
);
-- + doc_expires_at REAL (ALTER, migration 2026-08-19)
```
Indexes: `idx_ci_state(state, arrived_at)`, `idx_ci_gov(gov_id_hash)` (L262-263).

**`checkin_binds`** (L264-270) — append-only, never UPDATE/DELETE:
```sql
CREATE TABLE IF NOT EXISTS checkin_binds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id TEXT NOT NULL, wm_order_id TEXT NOT NULL,
  conf INTEGER NOT NULL, signals TEXT NOT NULL,   -- JSON list
  state TEXT NOT NULL,             -- auto|confirm|manual|rejected|released
  decided_by TEXT, note TEXT, ts REAL NOT NULL
);
```

**`fraud_review`** (L191-198):
```sql
CREATE TABLE IF NOT EXISTS fraud_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wm_order_id TEXT NOT NULL, identity_id INTEGER,
  decision TEXT NOT NULL, reason TEXT NOT NULL, factors TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  created_at REAL NOT NULL, resolved_by TEXT, resolved_at REAL,
  UNIQUE (wm_order_id)
);
```

**`hw_identity_audit`** (L468-471):
```sql
CREATE TABLE IF NOT EXISTS hw_identity_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL,
  action TEXT NOT NULL, src_id INTEGER, dst_id INTEGER, reviewer TEXT, detail TEXT);
```

**`identity_verification_log`** (L511-520) — also created independently in `identity_api.init()`
(intentional, idempotent redundancy after a real 2026-08-26 outage where a process importing
`store` without `identity_api` produced a DB missing this table → 500s on `/api/identity/verify`):
```sql
CREATE TABLE IF NOT EXISTS identity_verification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id INTEGER NOT NULL, ts REAL NOT NULL,
  method TEXT NOT NULL, decision TEXT NOT NULL,
  ref TEXT, expires_at REAL, actor TEXT, note TEXT);
```

**`identity_review_queue`** (L543-551, +ALTER `bind_attempts` L582-584) — Bind Gate Part 1/3:
```sql
CREATE TABLE IF NOT EXISTS identity_review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  outcome TEXT NOT NULL,        -- 'ambiguous' | 'undetermined'
  reason TEXT NOT NULL,
  wm_order_id TEXT,
  context TEXT NOT NULL,        -- JSON
  candidates TEXT NOT NULL,     -- JSON list of candidate hw_identities.id
  state TEXT NOT NULL DEFAULT 'open', resolved_by TEXT, resolved_at TEXT,
  bind_attempts TEXT NOT NULL DEFAULT '[]'
);
```

**`order_dead_letter`** (L611-622) — order-ingest infra, not identity-specific, may incidentally
carry PII in `raw_payload`:
```sql
CREATE TABLE IF NOT EXISTS order_dead_letter (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL,
  source TEXT NOT NULL, reason TEXT NOT NULL,
  wm_order_id TEXT, origin TEXT, event_type TEXT,
  raw_payload TEXT, detail TEXT, resolved_at REAL, resolution TEXT);
```

**Identity functions (all real, direct sqlite3 work):** tier lookups
`get_identity_by_gov_id_hash(h)` L2066, `get_identity_by_phone(phone_e164)` L2088,
`get_identity_by_name_dob_fp(fp)` L2105, `identities_by_dob(dob)` L2114,
`get_identities_by_addr_fp(fp)` L2123, `get_identity(identity_id)` L2132.
`upsert_identity(phone_e164=None, first_name=None, last_name=None, dob=None, name_dob_fp=None,
addr_fp=None, gov_id_hash=None, wm_id=None, force_new=False)` L2150 — find-or-create, fills blanks
only, never overwrites non-null except `last_seen_at`; a real `doc:` gov_id_hash is never
downgraded by a `url:` refresh.
`mark_verified(identity_id, via, ref=None, expires_at=None, ts=None)` L2245 — **first verification
wins** (doesn't rewrite a live one); re-verifies after lapse; `expires_at` coerced via
`expiry_epoch()` which **raises** on unreadable input before any write; `via` restricted to
`VERIFY_METHODS = ("didit","in_store","wm_document","manual")` (L2242) but stored as free text.
`verification_of(identity_id, now=None)` L2357 — **the single source of truth** for "is this
person verified right now": `{identity_id, verified, via, at, ref, expires_at, reason}`, never
raises. `needs_verification(identity_id, now=None)` L2410 — `(bool, why)`.
`resolve_merged(identity_id, _depth=0)` L2455 — follows `merged_into` tombstone chain, depth ≤8.
`identity_split_vetoes(a_id, b_id)` L2683 — `{"vetoes":[...],"overrides":[...],"blocking":bool}`.
`get_identity_by_wm_id(wm_id)` L2985. `add_wm_id_to_identity` L3050 /
`remove_wm_id_from_identity` L3080 (latter is "the ONLY real unbind").
`set_gov_id_hash(identity_id, h, reviewer=None, note=None)` L3301 — refuses to overwrite one real
`doc:` hash with a different `doc:` hash. `queue_identity_review(...)` L3385,
`open_identity_reviews()` L3409, `resolve_identity_review(review_id, reviewer)` L3435,
`record_bind_attempt(review_id, candidate_identity_id, cleared, why, actor=None)` L3477.
`identity_dashboard()` L3590 — wrapped in server.py's bare `except Exception`, so a missing
`identity_verification_log` degrades to empty counters at HTTP 200 rather than a 500.

**Checkin functions (all real):** `expiry_epoch(v)` L4266 — canonical expiry parser (used by both
store.py and checkin_api.py); a bare date resolves to **END of that day** in store timezone
(`config.end_of_printed_day`, owner ruling 2026-08-27), not UTC midnight-start.
`create_checkin(...)` L4436 — only INSERT into `checkins`. `get_checkin`, `list_checkins`
L4459/4466. `set_checkin_state(checkin_id, state, claimed_by=None, clear_claim=False)` L4482 —
raises on contradictory args. `record_bind(...)` L4516 — only writer to `checkin_binds`.
`pickup_orders_awaiting(location_id=None)` L4573 — the haystack query. `checkin_dashboard()`
L4603. `init()` runs at module import (L4652, last line) — every process importing `store` gets
the full schema.

### B14. `wmdemo/server.py` (6768 lines) — flat route chain

Not a route table — one `class Handler(BaseHTTPRequestHandler)` (L1952), two long if/elif chains:
`do_GET → _dispatch_GET` (L2062/2097-3100), `do_POST → _dispatch_POST` (L3165/3211-5299).
Matching is literal `self.path == "..."` / prefix `startswith`. Imports (L76-81):
`bind_gate, checkin_api, identity_api, verify_gate, wm_binding` (+`store` L91-92). **No `didit`
module import anywhere** — grep `-i didit` on server.py returns zero hits.

**Every identity/verification/checkin/bind route, with handler:**

| Path | Method | Handler | Line |
|---|---|---|---|
| `/api/identity/members` | GET | `identity_api.members(q, limit, offset)` | 2389 |
| `/api/identity/member` | GET | `identity_api.member(identity_id)` | 2394 |
| `/api/identity/order-match` | GET | `identity_api.order_match(wm_order_id)` | 2400 |
| `/api/identity/verification` | GET | `identity_api.verification(identity_id)` | 2403 |
| `/api/identity/match` | GET | `identity_api.match_fields(...)` | 2429 |
| `/api/identity/wm-binding` | GET | `wm_binding.binding(wm_customer_id)` | 2445 |
| `/api/identity/review/open` | GET | `store.open_identity_reviews()` | 2456 |
| `/api/checkin/board` (prefix) | GET | `checkin_api.awaiting_board({"location_id": loc})` | 2602 |
| `/api/checkin/contract` | GET | `checkin_api.contract()` | 2607 |
| `/api/identity/verify` | POST | `identity_api.record_verification(identity_id, method, decision, ref=, expires_at=, actor=, note=)` | 3673 |
| `/api/identity/match` | POST | `identity_api.match_order(body)` | 3692 |
| `/api/checkin` | POST | `checkin_api.create_checkin(body)` | 3695 |
| `/api/checkin/walkin` | POST | `checkin_api.create_checkin_resolved(body)` | 3706 |
| `/api/checkin/match` | POST | `checkin_api.match(body)` | 3711 |
| `/api/checkin/candidates` | POST | `checkin_api.order_candidates(body)` | 3713 |
| `/api/checkin/bind` | POST | `checkin_api.bind(body)` | 3718 |
| `/api/checkin/reject` | POST | `checkin_api.reject(body)` | 3720 |
| `/api/checkin/handoff` | POST | `checkin_api.handoff(body)` | 3722 |
| `/api/checkin/state` | POST | `checkin_api.set_state(body)` | 3724 |
| `/api/identity/search` | POST | `store.search_identities(q, limit)` | 5165 |
| `/api/identity/merge` | POST | `store.merge_identities(src_id, dst_id, OPERATOR_EMAIL, override_veto=, override_reason=)` | 5202 |
| `/api/identity/wm-binding/unbind` | POST | `wm_binding.unbind(wm_customer_id, identity_id, actor, reason, ack_orders=)` | 5231 |
| `/api/identity/review/bind` | POST | `bind_gate.attempt_bind(review_id, candidate_identity_id, actor=)` | 5273 |
| `/api/identity/review/resolve` | POST | `store.resolve_fraud_review(wm_order_id, reviewer, action)` | 5294 |

**Routes that gate on verification internally** (not identity-path-named, but call
`verify_gate`): `/api/status` POST → `_handoff_gate()` → `verify_gate.gate_pickup_handoff(
identity_id)` (route 3374, gate call 3461, `_handoff_gate` def L584-648); `/api/order/stage` POST
→ same on `stage=="done"`, refuses 403 (route 3507, gate call 3541); `/api/customer/create` POST →
mints synthetic order, calls `identity_api.order_match`, `identity_api.member`,
`verify_gate.gate_pickup_handoff` (route 3368, body fn L5961-6260).

**No dedicated `/api/verify/*` Didit route exists** — the only write path for a `didit` method is
`POST /api/identity/verify`, which only validates the method-name string.

Excluded false-positive routes (keyword collisions, wrong domain): `/api/taxonomy/categories/
bind|unbind|unbind-all` (L4428-4437, product-taxonomy), `/api/inventory/bind|unbind`
(L4500-4504, channel binding), `/api/brands*`/`/api/aov/*` (reuse `identity_api.qs()` as a generic
querystring utility only).

### B15. Full person/identity/document-data table inventory

All in `store.py`: **`hw_identities`, `checkins`, `checkin_binds`, `fraud_review`,
`hw_identity_audit`, `identity_verification_log`, `identity_review_queue`**. Full column lists in
B13 above. `order_dead_letter` is order-ingest infra (not an identity table) but its
`raw_payload` JSON may incidentally carry customer PII.

### B16. Image/photo storage — definitive answer: **not stored anywhere**

Cross-file grep (`store.py, identity_api.py, checkin_api.py, checkin.py, verify.py,
verify_gate.py, identity_match.py`) for `base64|photo|selfie|image` returns **zero storage hits**
— every match is a comment/docstring, a risk-code string (`"PORTRAIT_IMAGE_NOT_DETECTED"`,
verify.py:46), a parameter name (`image_bytes` in `DiditProvider.verify_document`, verify.py:256),
or an unrelated HMAC-signature base64 mention (identity_api.py:404).

Only a **sha256 hash** of the document is ever persisted, in `checkins.gov_id_hash` and
`hw_identities.gov_id_hash` (TEXT). Produced by `verify.doc_hash(issuing_state,
document_number)` (namespace `doc:<sha256>`) or `verify.url_hash(url)` (namespace `url:<sha256>`,
for an upload URL rather than a scanned document); `is_document_identity()`/`comparable()`
(verify.py:131,136) keep the two namespaces from falsely matching.

`DiditProvider.verify_document(image_bytes, filename, back, vendor_data)` (verify.py:256-293)
takes raw bytes in memory and multipart-POSTs them directly to Didit's real API
(`https://verification.didit.me` by default, `HW_DIDIT_BASE` overridable) — bytes are **never**
written to disk or SQLite. This method has zero callers anywhere in the repo (verify.py:19-24,
quoted in B4). No `UPLOAD_DIR`, no `open(...,"wb")` for images anywhere in these 7 files.

### B17. `.env` / `.env.example` — relevant key names only (no values)

**`.env.example`** — no identity/verification/didit/checkin/photo keys at all; full contents:
`WM_CLIENT_ID, WM_CLIENT_SECRET, WM_MENU_WMID, WM_DELIVERY_WMID, WM_API_BASE,
BLAZE_PARTNER_KEY, BLAZE_AUTH_KEY_CORONA, BLAZE_AUTH_KEY_ELSINORE, MEADOW_CONSUMER_KEY,
MEADOW_CLIENT_KEY_WEST_LA, HW_INC_VENDOR_OFF`.

**`.env`** (exists, mode 600) — same 11 keys plus `ANTHROPIC_API_KEY, CT_API_KEY_LONG_BEACH,
CT_API_KEY_CORONA, CT_API_KEY_WEST_LA, CT_API_KEY_LAKE_ELSINORE, AIRTABLE_PAT`.

**Identity/verification/Didit/checkin-relevant key names present: NONE.** Critically,
**`DIDIT_API_KEY` appears in neither file** — independent confirmation of verify.py's/
verify_gate.py's repeated claim that no Didit credential is configured anywhere, so `provider()`
can only ever return `NullProvider`.

**Env vars the code actually reads for identity/verification/checkin, undocumented anywhere:**
`DIDIT_API_KEY` (verify.py:331), `HW_DIDIT_BASE` (`DiditProvider.__init__`),
`HW_VERIFY_PROVIDER` (verify.py:329, `"null"` forces null path even with a key present),
`HW_ENFORCE_DOC_EXPIRY` (config.py:782, default `"0"`/OFF), `HW_STORE_TZ`,
`HW_VGATE_ENABLED`, `HW_VGATE_MANUAL_WAIVES`, `HW_VGATE_<GATE>_ENABLED`,
`HW_VGATE_<GATE>_METHODS`, `HW_VGATE_<GATE>_UNKNOWN_EXPIRY_DAYS`,
`HW_VGATE_<GATE>_REQUIRE_KNOWN_EXPIRY`, `HW_VGATE_<GATE>_ENFORCE_EXPIRY` (verify_gate.py),
`HW_CHECKIN_WINDOW_MIN_S` (checkin.py:97, default `-300`), `HW_CHECKIN_WINDOW_MAX_S`
(checkin.py:98, default `21600`), `HW_CHECKIN_NO_SHOW_AFTER_S` (checkin.py:102-103, default =
WINDOW_MAX_S), `HW_IDENTITY_GATE, HW_DRAFT_IDENTITY_STRIP, HW_DRAFT_IDENTITY_LOOKUP`
(config.py:915-917).

### B18. Backend real-vs-stub summary

**Real** (reuse): `checkin.py` matching/binding/state-machine; `checkin_api.py` HTTP adapter
(wired into server.py despite its stale docstring); `store.py` identity/checkin functions;
`identity_api.py` read layer + `record_verification`; `identity_match.py` pure 5-tier ladder;
`verify_gate.py` gate resolver; `verify.py`'s `DiditProvider.verify_document` HTTP call code
itself (real, just uncalled); `bind_gate.py` order↔identity linking.

**Stubbed / unwired** (net-new work): live Didit integration (`SEAM_WIRED=False` hardcoded, zero
callers, no credential); `NullProvider` no-op; any risk score / per-field verification badge /
match-confidence / candidate-set surfacing / phone-account-binding (`identity_api.GAPS`
explicitly `None`); image/selfie capture, storage, or comparison (doesn't exist at all);
`DIDIT_API_KEY`/`HW_DIDIT_BASE` undocumented in `.env.example`.

---

## PART C — Cross-cutting answers

### C1. `window.IdPhotoCapture` — exact capture mechanism (task's specific ask)

No `getUserMedia`, no `<canvas>`, no base64. Capture is two hidden `<input type="file">` elements
(`shared/id-photos.jsx:429-432`) — one plain, one with `capture="environment"` (a mobile-only
hint for the rear camera; desktop opens the OS file picker instead). Selected files become
`URL.createObjectURL(file)` Blob URLs (in-memory only, `stored:false`, `storage:'memory'`), never
re-encoded, resized, or persisted. Full props/callbacks and record shape are in A3 above.

### C2. How Register / check-in decides "verified" today, and what shows when the check can't be made

There is **no live network check** at decision time anywhere in the frontend. Every decision is a
pure, synchronous read of local mock state:
- `pos/checkin.jsx` (`CheckInModal`, A2) computes tier via `window.HWV.assurance(customer
  ? (window.HW.IDV||{})[customer.id] : null)` and the expiry-enforcement 3-way switch
  (`expiryEnforced`, A1). When enforcement is **unknown** (`null`, no signal from
  `window.HW_CHECKIN.board/.contract`), it fails **closed** and shows `'ID EXPIRED —
  enforcement UNKNOWN, refusing'` rather than a spinner or generic error. There is no distinct
  "couldn't reach the server" state in this screen — it never calls the server at decision time.
- `pos/screen-register.jsx:1136,1165` reads the same `window.HW.IDV` ledger and renders
  `<AssuranceBadge>`; if `verification.jsx` failed to load, the guarded render (`window.
  AssuranceBadge &&`) silently shows nothing — no explicit "verification unavailable" message.
- The only screen that talks to a live backend for identity state is
  `pos/screen-identity-binding.jsx` (A4), which re-GETs after every write rather than trusting a
  `200 {ok:true}` — the closest existing precedent for a "verify, don't assume" pattern a new
  module should follow.
- On the backend, the equivalent single source of truth is `store.verification_of(identity_id,
  now)` (B13) → `{verified, via, at, ref, expires_at, reason}`, gated per-transaction by
  `verify_gate.resolve()` (B5), which **never raises** and fails closed to a `Decision` object on
  any internal exception — the backend's answer to "what happens when the check can't be made" is
  always a well-formed refusal, never a 500.

### C3. Related in-flight docs found but out of scope for this digest

`/Users/jt/POS-Admin/docs/PROMPT-IDV-MODULE-KICKOFF.md` frames a "Didit parity" module against
this exact file list. `/Users/jt/POS-Admin/scratch/idv-conventions-digest-2026-09-08.md` and
`idv-didit-console-crossref-2026-09-08.md` (plus two `idv-didit-openapi-*.json` files) already
exist in scratch/ from what looks like the same swarm effort — worth reading before finalizing the
new module's design so this digest doesn't get re-derived a second time.

---

## Table: Reuse / Extend / Replace / Leave alone

| Piece | File(s) | Verdict | Why |
|---|---|---|---|
| Tier/assurance logic | `pos/verification.jsx` (`assurance`, `TIERS`, `expiryEnforced`) | **Reuse** | Pure, tested-by-use, load-bearing across 4+ screens; the compliance model itself |
| Expiry parsing | `HWExpiry.parseExpiry/isExpiredDoc` | **Reuse** | Correct end-of-day semantics already match backend `expiry_epoch()` |
| `IdScanPanel` (verification.jsx) | same file | **Replace** | Explicit simulator; new module needs a real PDF417/scan path, keep only the emitted-shape contract |
| `SmsVerifyPanel`/`RemoteIdPanel` | verification.jsx | **Extend** | UI/copy reusable; wire to a real send endpoint (currently none exists) |
| `IdPhotoCapture` | `shared/id-photos.jsx` | **Extend** | Capture UI and admission rules (8MB, MIME allow-list) reusable as-is; needs a persistence layer bolted on |
| `screen-identity-binding.jsx` | pos/ | **Reuse** | Real, live, correct post-then-read-back pattern to copy |
| `hw-live-identity.js` / `hw-live-checkin.js` | shared/ | **Reuse as dev tooling** | Good QA/debug seam pattern; consider promoting into the production module rather than leaving orphaned |
| `checkin.jsx` (`CheckInModal`, `GuestEditor`) | pos/ | **Extend** | State machine (4 guest states, doc-mismatch handling) is sound; needs live backend calls instead of `window.HW.IDV` mock reads |
| `athome/crm.jsx`, `account-a/b/c.jsx` identity block | athome/ | **Replace** | Fully hardcoded `idVerified:true`; unbacked "Face match" claim must be removed or backed for real |
| `screen-orders.jsx` fraud panel (mock path) | pos/ | **Replace** | Fabricated risk score for non-live orders contradicts the honest "NOT COMPUTED" live path — align to the honest one |
| `screen-register.jsx` | pos/ | **Leave alone** | Owner rule: never modify directly; integrate via a Home card / dedicated screen |
| `engage/screen-customers.jsx` age-verified pill | engage/ | **Leave alone** | Separate concern (age, not identity); don't fold into the ID ladder without a product decision |
| `identity_match.py` | wm-demo | **Reuse** | Pure, zero-I/O, proven 5-tier matcher — do not reimplement |
| `identity_api.py` (read layer + `record_verification`) | wm-demo | **Reuse** | Correct API shape; extend `GAPS` fields as real data becomes available |
| `verify_gate.py` | wm-demo | **Reuse** | Complete, mutation-tested gate/decision framework already wired into `engine.py` |
| `bind_gate.py` | wm-demo | **Reuse** | Narrow, correct order↔identity linking pattern |
| `checkin.py` / `checkin_api.py` | wm-demo | **Reuse** | Real signal-scoring matcher + HTTP adapter; fix the stale "unwired" docstring while touching it |
| `verify.py` `NullProvider`/`DiditProvider` | wm-demo | **Extend** | `DiditProvider` HTTP code is real but uncalled — wire a real caller, add `DIDIT_API_KEY`/`HW_DIDIT_BASE` to `.env.example`, flip `SEAM_WIRED` only once a caller exists |
| `demo_seed_identities.py` | wm-demo | **Leave alone** | Correctly gated demo-only seeder; don't let production code depend on it |
| `verify_gate_probe.py` | qa/ | **Extend** | Fix the 6 failing checks (W1, D1) and register it in `battery.py SUITES` |
| `gate_wiring_probe.py` | qa/ | **Reuse** | Already registered, already proves real wiring |
| `docs/SCOREBOARD.md` | wm-demo | **Extend** | Add a section for verify_gate/bind_gate/Didit work — currently absent entirely |

---

## Gaps the new module must fill

1. **No real Didit (or any vendor) document-inspection call exists.** `DiditProvider.
   verify_document` is real HTTP code with zero callers; `SEAM_WIRED=False` is hardcoded;
   `DIDIT_API_KEY`/`HW_DIDIT_BASE` are configured nowhere. A `didit` row today is, in the code's
   own words, "A CLAIM SOMEBODY POSTED, not a document that was inspected."
2. **No image/selfie storage of any kind.** Only a sha256 hash of a document persists
   (`gov_id_hash`). `IdPhotoCapture` produces Blob URLs that vanish on reload/tab close; there is
   no upload route, retention policy, encryption policy, or audit trail for ID images anywhere in
   either repo.
3. **No liveness or face-match capability anywhere**, despite `athome/crm.jsx:182` rendering a
   "Face match" badge with zero backing feature.
4. **No risk score, per-field verification check (name/phone/address), match-confidence
   percentage, or candidate-set surfacing** — `identity_api.GAPS` explicitly declares all of these
   `None` with a reason string.
5. **No phone/SMS account-binding (the T2 rung)** — `SmsVerifyPanel`/`RemoteIdPanel` have "no
   endpoint and no send path" (verbatim); backend `verification()` returns `phone_binding=None`.
6. **Two divergent check-in paths on Register** (`CheckInModal` document-gated vs.
   `CustomerSearch`/`checkInCustomer` un-gated) — flagged in-code (screen-register.jsx:760-783) as
   needing consolidation, never done.
7. **Mock-vs-live UI inconsistency in `screen-orders.jsx`**: live orders honestly show "NOT
   COMPUTED"; mock/demo orders still render a fabricated confidence bar. The new module should
   remove the fabricated path rather than build toward it.
8. **CRM and My-Account screens (`athome/crm.jsx`, `account-a/b/c.jsx`) are fully disconnected**
   from the real tier ladder — static `idVerified:true`, no tier, no expiry awareness. Needs
   wiring to `window.HWV`/live backend or explicit removal of the fake claim.
9. **`verify_gate_probe.py` is red (75/81) and excluded from the battery** — the compliance gate's
   own test suite is not currently trustworthy as a regression guard.
10. **`docs/SCOREBOARD.md` has no section for verify_gate/bind_gate/Didit work** — this whole
    subsystem is untracked in the project's own scoreboard; the new module should add one.
11. **No hardware/PDF417 scanner integration** — `IdScanPanel` is an explicit on-screen simulator;
    building a real listener was deliberately deferred as "unverifiable, untested plumbing"
    without physical hardware to test against.
12. **Three independent "verified" vocabularies coexist** with no reconciliation: the T0/T1/T2
    ladder (`verification.jsx`), CRM's static boolean (`athome/crm.jsx`), and
    `engage/screen-customers.jsx`'s separate `ageVerifiedAt` timestamp. The new module should pick
    one model and either subsume or explicitly scope out the other two.
13. **`checkin_api.py`'s own docstring is stale** ("server.py does not import it") — low-risk but
    should be corrected when the file is next touched, so future readers don't repeat the wrong
    claim.
