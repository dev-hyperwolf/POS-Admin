# Distribution — changes requested from the development team

**From:** Hyperwolf (owner) · **Date:** 2026-09-10 · **Scope:** `distribution-backend` and the
distribution screens in `hyperwolf-super-admin`.

## Why this list exists

We studied the distribution module end to end because the team reports two problems every week:
newly received premium product sits in the warehouse for up to a week before it reaches a kit,
and the daily refill sends product that did not sell while leaving out product that did. We
traced both to specific lines in the code (the study is in `DISTRIBUTION-LOGIC-MAP.md`; every
claim there cites a file and line, and every line was read twice).

We are going to fix the decision logic ourselves, as a separate, tested package that the
existing service imports, and build a new operator console that calls the routes you already
expose. **Nothing about the database, the routes, the deploy or the Blaze transfers changes.**
The items below are the things we cannot do from outside the service, or that make what we build
safer and faster. They are all additive. None of them is urgent on its own; items 1 and 2 are
what we need first because the rest of our work waits on them.

Each item says what we are asking for, why, the exact shape we need, and how we will both know it
is done. Where a line number is given it is against the repository as of commit `aaa6ecb`
(distribution-backend) so you can find it quickly; the code may have moved since.

---

## Now: what unblocks our work

### 1. Allow our console's origin in CORS

**What.** Parse `ALLOW_ORIGIN` as a comma-separated list and add the origin of our console (we
will send the exact hostname; it is the same host that serves the Bounty and Verify apps).

**Why.** The new console is a separate web app on a different origin. Browsers refuse its calls
to `distribution-backend` unless the server names that origin. Today `startup/middleware.js`
defines `corsOptionsDelegate` with an allow-list but never mounts it (`app.use(cors())` is open
to every origin in practice, which is its own problem). Mounting the delegate and adding our
origin solves both.

**Prove.** A preflight `OPTIONS` from the console returns 204 with our origin echoed; a request
from an unknown origin is refused.

### 2. A one-off, read-only export of the distribution data

**What.** A `mongodump` of these collections from the production distribution database:
`kitdistributeds`, `kittemplates`, `kittemplateskus`, `kitboxes`, `productbatches`,
`distributionglobalsettings`, `regiondriverassigns`, `activitylogs` (last 30 days), plus the
`Regions`/`SubRegions` collections; and, from Blaze, 14 days of transactions
(`/api/v1/partner/transactions`) and the terminal map (`/store/inventory/terminals`). No
customer fields: strip names, phones, emails and addresses from anything that carries them.

**Why.** The refill and build logic has no test suite, so there is no way to prove a change is
correct except by replaying real days. We will run the new decision engine against these
documents and check that it produces the kits and refills the team says should have happened,
and that it no longer produces the two failures above. Without this export every change is a
guess verified in production, which is how the current problems went unnoticed.

**Prove.** We receive the archive and confirm a real refill day replays offline.

---

## Soon: correctness of the data the logic depends on

### 3. Indexes on `KitDistributed`

**What.** Add three indexes: `{weekStartDate: -1, status: 1}`,
`{"regionData.subRegionId": 1}`, `{"regionData.items.productId": 1}`.

**Why.** The collection has no indexes at all and is never archived, so every week it grows.
Four endpoints load the entire collection into memory
(`closure-overview-controller.js:35`, `common-controllers.js:888`,
`kit-refill-controller.js:3985`, `discrepancy-management-controller.js:34`), and the refill mints
its next sequence number by unwinding every refill log ever written, on every run
(`kit-refill-controller.js:459-489`). That last one runs on the write path, so it is the piece
most likely to start timing out first, and it will look like "the refill button just spins".
Indexes are the cheapest, safest change on this list and buy time for everything else.

**Prove.** `explain()` on the refill's load query shows an index scan instead of a collection
scan.

### 4. Store the true demand on refill logs

**What.** When a refill log is written, record `neededQty` (what the driver actually needed)
beside the existing `refillQty` (what was handed out). Additive field.

**Why.** Today the log stores only what was given (`kit-refill-controller.js:1307-1308`), and
the next day's cap is read from that same number (`:1026-1035`). So on any day the warehouse is
short of a product, the amount given is smaller than the amount needed, and from then on the
ceiling for that product in that kit is permanently the smaller number. There is no path back
up. This is one of the two direct causes of "products that need refilling get left out". Storing
the demand separately lets the new engine derive the cap from what the kit actually needs.

**Prove.** New refill logs carry both fields; a day with a shortage no longer lowers the next
day's cap.

### 5. A scheduler that the company owns, with a lease

**What.** One `node-cron` job per flow (product-batch sync, sold-quantity sync, daily refill,
weekly build), each calling a plain function with an options object rather than an Express
handler, and a lease document so two triggers for the same business day cannot overlap.

**Why.** Every cron in `startup/nodeCrons.js` is commented out (lines 7-42), so nothing in the
service runs on its own. Whatever triggers the refill today is an external caller hitting
`POST /kit-refill/cron` that nobody has been able to name. Two of the four commented jobs would
also crash if simply uncommented, because `dailyRefillKit` and `kitDistributed` read `req.body`
on their first line (`kit-refill-controller.js:861`). We need to know that received inventory is
refreshed on a schedule (today it is refreshed only when a refill happens to run) and that a
refill runs exactly once per business day. Please also tell us what the external trigger is
today, so we can retire it cleanly.

**Prove.** The activity log shows exactly one refill per business day, and the product-batch
sync runs on its schedule with no refill involved.

### 6. One definition of "today"

**What.** A single `utils/businessDay.js` exporting `businessDay(ts)` in the business timezone
(Pacific unless you tell us otherwise), used by build, refill and closure. We will ship the same
function in the engine so both agree.

**Why.** The refill computes its day boundary with a hardcoded +5.5 hour offset, which is India
Standard Time, in four separate copies (`kit-refill-controller.js:855-858, 1510-1513, 2633-2636,
4940-4943`); the build uses the server's local midnight
(`manageDistributions.repository.js:48-49`); closure uses a third, unoffset midnight
(`closure-overview-controller.js:453-454` and five more). For a California business the refill's
"already ran today" check fires at the wrong hour, which produces both double refills and false
"already completed" refusals, and the closure screen files the same event under a different date
than the refill screen. We need to know where +5.5 came from before it is replaced, in case it
was intentional.

**Prove.** For one refill event, the build, refill and closure screens all show the same date.

### 7. Read global settings with the platform filter

**What.** In the kit-build path, read `DistributionGlobalSettings` with `findOne({platform})`
the way the admin read already does (`distribution-controller.js:85`).

**Why.** The build reads `findOne()` with no filter (`manageDistributions.repository.js:162-166`)
while the model carries `platform: hyperwolf | stilo`. If both platforms have a settings
document, the build applies whichever Mongo returns first to every template, so one platform's
kits are capped by the other's numbers. If the collection is ever empty the build crashes with
a raw null-reference message instead of saying that settings are missing.

**Prove.** A Stilo build and a Hyperwolf build each use their own min and max caps.

### 8. Initialise Sentry

**What.** Call `Sentry.init` once at boot with `SENTRY_DSN`, and mount the error handler after
the routes.

**Why.** `SENTRY_DSN` is required by the config but `Sentry.init` is never called, so every
`Sentry.captureException` in the code is a no-op. Eight places in the refill swallow a failed
audit write with only a `console.error` (`kit-refill-controller.js:1466` and seven more), and
the batch sync's failure count is discarded (`:870`). Today a failing refill audit or a Blaze
outage leaves no trace anywhere. We cannot support the module without seeing its errors.

**Prove.** A thrown route error appears in Sentry within a minute.

---

## Next: what the new console needs

### 9. A refill preview route

**What.** `POST /api/v1/admin/kit-refill/preview` with the same input as `/cron`, returning the
plan (per subregion, per product: sold, need, cap, will give, reason) and writing nothing. We
will supply the function that computes it; this is the route that exposes it.

**Why.** Today "Refill Kit" commits on one click with no preview; the operator sees the result
only afterwards, and a wrong quantity is discovered at closeout. The console's central screen
is a preview the operator can check and adjust before committing. That is the single design
change that turns "we found out at the end of the day" into "we fixed it before the kits left".

**Prove.** Preview followed by commit with no edits produces identical refill logs.

### 10. Structured warnings in build and refill responses

**What.** Beside the existing response fields, add
`{skipped: [{subRegionId, productId, reason}], warnings: []}`. Additive.

**Why.** The build silently drops any product whose total stock is below the number of
subregions (`manageDistributions.repository.js:722, 745`), the refill skips subregions that lack
a refill template, and the sold-quantity sync counts ASAP orders only (correct for refill, since scheduled orders
are sourced from the safe). None of this reaches the screen: the HTTP client passes every
200 through and no screen reads `skippedSubRegionIds`. The operator sees a green toast for a run
that left three subregions untouched. With reasons in the response, the console can show a
skips-and-shortfalls panel the team can act on the same morning.

**Prove.** A run that skips a subregion returns it with a reason.

### 11. Auth on the routes that have none

**What.** Put the `[admin]` middleware on `POST /api/v1/blaze/distribution/inventory`,
`bulkInventoryTransferSubRegionWise`, `GET .../kit-refill/reports/download` and
`GET .../manage-distributions/reports/download`.

**Why.** The first two create real inventory transfers in Blaze for any `subRegionId` or
`distributionId` the caller supplies, with no token. The report downloads stream PDFs from S3
with no token. These are reachable from the internet today.

**Prove.** An anonymous call to each returns 401.

### 12. Fix the closure inventory value

**What.** `closure-overview-controller.js:993` computes
`totalQty * totalInventoryValue`; it should be the sum over products of quantity × unit value.

**Why.** The number is a quantity multiplied by an already-summed dollar total, so it is wrong
by a factor of the quantity on every closure with more than one unit. The frontend hid the
column rather than fixing it (`regionClosureForms.js:106-114`, `details.js:303-306`), so the
team lost a useful number instead of getting a correct one.

**Prove.** The closure detail equals a hand calculation for one day.

---

## Meanwhile: small fixes to the existing screens

The current super-admin screens stay in use until the console replaces them. These are one-line
changes that make them less misleading now.

### 13. Show distribution status with the existing component

`distributionManagement/index.js:72-78` prints the status as raw text. `StatusText.jsx` already
maps `splitting`, `freeze` and `distributed` to a colour and label and is used on five other
screens. Use it here too, and restore the commented-out gate at line 84 that disables editing
after freeze. **Why:** operators cannot tell which distributions are still being built and can
edit one after it has been frozen.

### 14. Delete the stray `return`

`addDistribution/index.js:134` returns one line before the save at line 136, so every edit made
on the Update Distribution screen is silently lost. **Why:** the route is live and reachable;
people are using a form that does nothing.

### 15. Re-enable the quantity guard on manual refill adds

The available-quantity check on `qtyPerDriver` in the add-product-refill validation is commented
out. **Why:** this form is the only way to rush a newly received product out today, and today it
lets someone assign more units than exist.

### 16. Un-comment the aging column

`agingProducts/index.js:121-128`. **Why:** it is the only place in the app that shows how long a
product has been sitting, and it is hidden. This is the on-screen half of "premium product sits
for a week".

### 17. Rename the freeze button

`freezeDistribution.jsx:138` reads "Yes, Distribute" but the action only sets the status to
`freeze`; the Blaze sync call beside it is commented out at line 37. **Why:** operators believe
product moved when it did not.

### 18. Put the box, the batch number and the THC on every plan line

A refill or restock plan line today carries only `product_id` and `batch_id`. The printed pick
slip (paper first, per the owner) needs the human product name, the batch number, the THC from
the batch label, the received/packaged date, and which box in the kit the line goes to. Please
stamp `product_name`, `batch_no`, `thc_pct`, `received_at` and `box` on each plan line when the
plan is built, from the Batch record and the kit's box list. **Why:** the packer works from paper
with no screen beside them; a slip that says "batch 64f1a…" instead of "#HW-2411-07 · 24.1% THC"
is how a mixed-batch kit goes out unnoticed. Until this lands, our renderer falls back to the
batch id and "THC n/a" and prints the line under "Unboxed".

---

### 19. Make the batch the unit of control, with Metrc packages underneath it

Today the Hyperwolf catalog has no batch record at all, the hemp backend has `ProductBatch`, and
Metrc reporting keys on the package tag. Please add one `Batch` record per grower lot (batch
number, THC result, packaged date, received date, product) and hang the Metrc packages under it:
`metrc_packages: [{tag, quantity, packaged_at}]`, since one batch is routinely split across
several packages. Inventory units, sales, counts and the promotion rule builder reference the
batch; Metrc reporting resolves unit -> batch -> package to find the tag. **Why:** the owner
controls pricing, rotation and promotions per batch, not per package; two packages of one batch
must never look like two different products, and two batches of one product must never merge.
Shape and validator: `@hyper-tech/contracts` 0.4.3 `Batch`.

---

## Questions we would like answered alongside this list

1. What calls `POST .../kit-refill/cron` and `POST .../manage-distributions/cron` today, and when?
2. Confirmed by the owner: the `asap`-only sold filter is deliberate for refills. Which Blaze order
   tags identify scheduled orders, so the return baseline can include them?
3. Where did the +5.5 hour offset come from, and what timezone should a business day use?
4. Is `freeze` a required step between build and dispatch, or a leftover?
5. Is `DistributionGlobalSettings` one row or two in production, and is
   `discrepancyResolutionETA` set? (When it is unset, Waste Inventory returns an empty list with
   no error.)
6. Does Chromium/Puppeteer work on the production host for the PDF reports?
7. Who set up the Grafana connection to CloudWatch two weeks ago, and where is the dashboard?

## Phase 2: operator console foundation (inventory distribution API)

Items 20–25 add the routes needed for the new Floor Restock and console screens, and resolve a Python/JS parity gap. Reference: CONSOLE-ENDPOINT-MAP.md section D.

### 20. Shelf Par editor API

The Floor Restock mockup says "Manage shelf pars" opens a par editor; the control is wired but the route does not exist. **Smallest change:** a GET /api/inventory/shelf-pars and PUT /api/inventory/shelf-pars/{location_id} pair to read/write par (par:int, updated_by, updated_at) for each Location. Attach to Floor Restock's "Manage shelf pars" link.

**Why:** Shelf par levels (target qty per product per shelf) drive restock planning. Without an editor, the pars are static or absent, and Floor Restock cannot tune refill size to actual shelf space.

**Prove:** The "Manage shelf pars" link in the Floor Restock UI opens a form, fetches the current pars from GET /api/inventory/shelf-pars?location_id=..., updates one, and persists via PUT.

**Storage (folded from a duplicate item 26, 2026-09-16):** a `shelf_pars` table {store_id, shelf_location_id, product_id or shell_id, par_qty, updated_by, updated_at}; `plan_restock` (wmdemo/restock_engine.py, `def plan_restock`) today derives need/cap from register sales only, so PAR is absent from the plan until this lands.

### 21. StatusTimeline API

The Verify round concepts include a "day's status per kit" timeline (built → pack → dispatch → refill → close, with who/when/result). No event log or status route exists. **Smallest change:** a GET /api/inventory/restock/events?since=&kit_id= that returns timestamped status transitions (kind:enum, kit_id, actor, at, detail) for every restock step. Used by StatusTimeline component and status/verification screens.

**Why:** Operators need to know when each kit reached each stage (built at 14:30, packed at 15:12, dispatched at 18:00) to triage delays and verify the shipment happened.

**Prove:** A GET /api/inventory/restock/events?kit_id=<id> returns a sorted list of {kind, at, actor, detail}; a test kit's timeline matches manual inspection of the activity log.

### 22. Box types management API

REFILL-CONCEPTS.md lists "Manage box types" as a shared component; the mockup has a stub. **Smallest change:** POST /api/inventory/box-types (create), GET /api/inventory/box-types (list), PUT /api/inventory/box-types/{id} (update). Box type schema: {id, name, category, capacity_units, active, region_id}.

**Why:** Box types define kit structure (how many shelves, how many units per shelf). Today they are static data; without a management API, console operators cannot adjust kit geometry to respond to product mix or demand changes.

**Prove:** The console's "Manage box types" screen fetches the list, creates one, and updates its capacity; the new type appears in the Kit editor.

### 23. Received lane: last-N-days filter

ReceivedLane shows "received last 7 days"; client currently must call GET /api/inventory/received?day=YYYY-MM-DD once per day to backfill. **Smallest change:** add an optional ?days=7 param to GET /api/inventory/received that returns all receipts in the last N days in a single call.

**Why:** The console's ReceivedLane component loads its data once; today it must loop 7 times. A range query reduces client complexity and API calls.

**Prove:** GET /api/inventory/received?days=7 returns all receipts in the last 7 calendar days in one response; loop-based calls and range-based calls return the same data.

### 24. Tree-walk for KitBoxTree

Location hierarchy is parent_id linked; client must chase links. **Smallest change:** add GET /api/inventory/locations/tree?root_id=&kind= that returns a nested JSON tree of Locations with children[], or add a ?expand=tree param to the existing GET /api/inventory/locations to include children[].

**Why:** The console's KitBoxTree component needs the full hierarchy (Region → Kit → Box) at once; today it must fetch and link manually.

**Prove:** GET /api/inventory/locations/tree returns a JSON tree with nested children[] arrays; a hand-built tree from the result matches a manual walk of the database.

### 25. planHandoff export in Python

distribution-engine exports `planHandoff(input)` but no Python twin exists in restock_engine.py. **Smallest change:** implement plan_handoff(input) in restock_engine.py following the shape of plan_refill/plan_restock (Handoff: region → kit → summary of pack/dispatch/return cycle), or clarify that Handoff is JS-only (tablet packing screen, no backend needed yet).

**Why:** The JS engine defines the handoff plan contract; a Python twin allows the backend to build handoff plans server-side for packing and dispatch screens, or confirms that the tablet will always generate its own.

**Prove:** plan_handoff(input) returns a valid Handoff contract, or the PM confirms that Handoff is tablet-only and this item is marked N/A.

---

## Phase 3: security & platform findings across the customer/driver estate (2026-09-17)

Everything below is outside distribution-backend — it spans `hyperdrive-backend` (driver app),
`hyperwolf-backend` (customer app), `hemp-backend`, and `stilo-backend`. It is appended here
rather than started as a new document because this is the one list the dev team already watches.
Each item was re-read against the live checkout at `/Users/jt/hyper-tech` today, not taken from
a prior summary on trust. Where an item was already surfaced by the earlier codebase audit, that
is stated explicitly with its citation so nothing here is double-counted as new.

### 26. Stop storing driver passwords with base64, not encryption

**What.** `hyperdrive-backend/common/util.js:208-216` — `encodeText`/`decodeText` wrap the
`base-64` package (`require('base-64')`, line 6). `controllers/fleets/fleet-controller.js` uses
these, not a hash, to set and check `fleetPassword`: login compare at line 48
(`(await decodeText(fleetData.fleetPassword)).trim() != fleetPassword`), set/reset at lines 315
and 880, a second login/compare path at line 384.

**Why.** Base64 is an encoding, not encryption — anyone with read access to the `Fleets`
collection (a DB dump, a backup, a compromised read-only credential) recovers every driver's
plaintext password by decoding a string, no key required. This is a different, worse bug than
the plaintext-field-named-secrets finding the earlier audit already made for `hyperwolf-backend`'s
`Admin`/`Store`/`StoreUser` passwords (`repos/hyperwolf-backend.md:554-573`, `THE-GRADE.md`); this
one is in the driver backend and was not previously cited.

**Prove.** `fleetPassword` is a `bcrypt`/`argon2` hash after the fix; a direct read of the
`Fleets` collection no longer discloses a usable password for any driver.

### 27. hyperdrive-backend has no login rate limiting at all — not even declared

**What.** `hyperdrive-backend/package.json` does not declare `express-rate-limit` anywhere
(`grep -rln "express-rate-limit" hyperdrive-backend/` returns nothing), and no route in the repo
throttles repeated login/OTP attempts.

**Why.** The earlier audit already flagged `hyperwolf-backend` for declaring `express-rate-limit`
in `package.json:30` and never requiring it on any route (`repos/hyperwolf-backend.md:48-52,
498-499` — cited, not new). `hyperdrive-backend` is worse: the package was never even added.
Between the two backends, every login surface in the estate — customer and driver — is
brute-forceable today.

**Prove.** A scripted burst of failed logins against `hyperdrive-backend`'s driver/fleet login
route gets throttled (429) after a small number of attempts, same as the fix expected on
`hyperwolf-backend`.

### 28. Proof-of-delivery uploads are still `public-read` (carried forward, please prioritize)

**What.** `hyperdrive-backend/middlewares/multiFileUploadToS3.js:22` sets `acl: 'public-read'`
on every upload through this middleware — the same middleware that handles proof-of-delivery
photos and signatures.

**Why.** Already reported (`repos/hyperdrive-backend.md:283`, and independently in
`MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §3.2 item 2, which explicitly warns "do not port the
ACL as-is" when this shape gets rebuilt). Restating it here because this is the first time it has
gone into an actual dev-team ask list rather than an internal audit note — every photo/signature
a driver has ever captured is a guessable-URL away from public view today.

**Prove.** A freshly uploaded proof-of-delivery file returns 403 to an unauthenticated `GET`; the
app still displays it to authorized viewers via a signed URL or an authenticated proxy route.

### 29. Merged ID+selfie identity images are served from a public static folder

**What.** `hyperwolf-backend/startup/middleware.js:57` — `app.use(express.static('uploads'))`,
mounted with no auth in front of it. `controllers/berbix/berbix-controller.js:182` writes the
merged ID+selfie composite image to `./uploads/${fileName}` — the same directory tree that
`express.static` serves back to anyone who requests the filename.

**Why.** This is a new finding, not previously cited by file:line in the earlier audit (which
flagged the general pattern of unauthenticated routes and a committed Firebase key, but not this
specific static-folder-serves-identity-documents path). A merged ID+selfie image is exactly the
kind of KYC artifact that must never be reachable by URL guess alone — worse than the S3
`public-read` issue above because there is not even a bucket ACL to fix; it's Express serving a
local disk folder.

**Prove.** A request for a known or guessed `uploads/<filename>` for an ID/selfie composite
returns 403/404 without a valid session; legitimate access goes through an authenticated route
that streams the file server-side.

### 30. Name the unauthenticated order-creation route specifically

**What.** `hyperwolf-backend/routes/order-routes.js:8` — `router.post('/', orderController.createOrder)`
carries no auth/admin middleware, unlike its siblings on the same file (`:10-11,13` use `[auth]`/
`[admin]`).

**Why.** The earlier audit already flagged the shared-static-token model itself
(`middlewares/auth.js`, `repos/hyperwolf-backend.md:190`) and the general category of "~33
unauthenticated route files including financial writes" with two illustrative examples
(`repos/hyperwolf-backend.md:235-238,554,683`). Order creation was one of the un-named 22 in that
bucket; this item gives the dev team the specific file:line so it can be triaged instead of
re-discovered.

**Prove.** An anonymous `POST /api/v1/order` (no token) is refused; a valid customer session can
still place an order.

### 31. Rotate and remove the three committed Firebase service-account keys (carried forward)

**What.** Three live-shaped service-account JSON files are tracked in git:
`hyperwolf-backend/hyperdrive-firebase-adminsdk.json` (repo root), `hemp-backend/staticDB/
fcmtoken.json`, `stilo-backend/staticDB/fcmtoken.json`.

**Why.** Already reported and already tracked: `repos/hyperwolf-backend.md` Critical-5 (lines
569-573), `repos/hemp-backend.md` (lines 289-294, 522, 797), `repos/stilo-backend.md` (lines 242,
448-449), and `TEAM-TODO.md:13` item 0.1 ("Rotate the Firebase/GCP service-account keys committed
in three repos"). No new file was found beyond these three. Restated here only because this is
the first time these three land in a message actually addressed to the dev team rather than an
internal note — TEAM-TODO.md is ours, not theirs.

**Prove.** Firebase console shows the old key IDs revoked; push notifications keep working from
the new, env-var-sourced key; `git log -p` on all three paths is scrubbed or the repos are
confirmed private-enough that history scrubbing is deprioritized (owner's call, not ours).

### 32. Stilo's "Metrc integration" is one hardcoded-license nightly POST and one live GET — harden or scope down

**What.** `stilo-backend/controllers/metrc-controllers.js:22-91` (`createSales`, the only
outbound write) and `:94-112` (`getActivePackages`, the only outbound read), both hardcoded to
`licenseNumber=M10-0000004-LIC` (lines 78-82, 105). `createSales` has no retry, no backoff, no
idempotency key, and never persists the payload sent or Metrc's response (verified: `data` from
the POST is read nowhere). Its `catch` block (lines 87-90) only logs and never calls `res.send()`;
because the same function backs `GET /api/v1/metrc/` (`metrc-routes.js:5`), a manual call that
hits the catch branch hangs the HTTP request rather than erroring. Full analysis and both
citations independently re-verified today against source:
`POS-Admin/docs/METRC-PROGRAM-PLAN-2026-09-17.md` §1.1.

**Why.** This is the estate's only real compliance-facing Metrc call, and it currently: (a) can't
serve more than one licensed store without a source edit, (b) has a real double-submit risk on
any overlap between the 23:59 cron and a manual call or process restart, and (c) can hang a
request indefinitely on a broken `Order` query. None of Items, Strains, Transfers, Retail
Deliveries, Compliance Difference, Waste, or Adjustments exist anywhere in this integration.

**Prove.** `createSales` persists what it sent and what Metrc returned, refuses to double-submit
the same order, returns a real error (not a hang) on failure, and the license number is looked up
per store rather than hardcoded.

### 33. Eight dangling/broken Mongoose refs, and the `Tax.taxRate` scale question

**What.** From `POS-Admin/docs/migration/LEGACY-DATA-MODEL-INVENTORY-2026-09-17.md` ("Broken/
dangling references found in this pass"), re-verified today: `HempBlogs.author._id` and
`HyperwolfBlogs.author._id` both `ref: "Author"` against a registered `Authors` (plural);
`stilo-backend:Blog.author._id` — same bug; `OrderManager.order` (hemp/hyperwolf/stilo-backend) —
bare `ObjectId` array, no `ref` at all; `KitTemplate.regionId`/`subRegionId`
(distribution-backend) — `ref: "Region"`/`"SubRegion"` against registered `Regions`/`SubRegions`;
`boxProduct.productId` (distribution-backend) — `ref: "Products"` against registered `Product`;
`fleetTaskActivityLogs.taskId` (hyperdrive-backend) — `ref: "Fleets"`, almost certainly meant
`Tasks`; `hyperdrive-backend:Region` — five refs (`companyId`, `taxRuleId`, `drivers`,
`terminals`, `shopId`) pointing at models absent from every repo's census; `promotion-backend:
Promotion.rules` — `ref: "Rules"` declared on a `Mixed`-typed field, which Mongoose refs cannot
resolve regardless. Separately: `stilo-backend:Tax.taxes[].taxRate` (`models/Tax.js:16`) — unclear
whether values are a percent (`15`), a fraction (`0.15`), or basis points already.

**Why.** These are new to this list (first surfaced in the migration inventory pass, not the
original codebase audit). A dangling `ref` doesn't break Mongoose at write time, only silently
fails to `.populate()` — which is exactly the shape of bug that ships quietly and is found months
later. The tax-rate scale question is higher-stakes: guessing wrong mis-taxes every order.

**Prove.** Each `ref` above resolves via `.populate()` against the correct model name; the dev
team confirms in writing whether `taxRate` is a percent, a fraction, or basis points, with one
worked example from a real tax record.

### 34. Fix the misnamed `assetlinks.json` — it's Apple AASA content, not Android Asset Links

**What.** `hyperdrive-backend/public/.well-known/assetlinks.json` contains
`applinks`/`webcredentials`/`appclips` keys (Apple's `apple-app-site-association` schema,
Team ID `WKJ7ST229V`, app IDs `WKJ7ST229V.com.hyperdrive.hyperwolf` listed twice identically) —
not Android's Asset Links schema (`relation`/`target.package_name`/`sha256_cert_fingerprints`).
No file of either kind exists in `hyperwolf-frontend-nextjs` or any other repo.

**Why.** New finding, independently confirmed today (`cat` of the file). Apple's Universal Links
require this exact content served at `/.well-known/apple-app-site-association` with **no file
extension** — a file literally named `assetlinks.json` is not where iOS looks, so universal
links (`/buy/*`, `/help/*`) and the configured App Clip are very likely non-functional as shipped.
Whether a correctly-named file exists on the live `hyperwolf.com`/driver-app domain (outside
source control) is unverified from here — first cited in
`MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §1.1.

**Prove.** `curl -I https://<driver-app-domain>/.well-known/apple-app-site-association` returns
200 with this JSON; a real Android Asset Links file (if one is needed) is added separately under
its own correct filename.

### 35. HyperDrive iOS: ~39 drivers locked out on expired TestFlight builds — need a build today, and a permanent fix

**What.** Per `BUILD-PROGRAM-TODO.md` item A1 (owner-tracked, not independently re-derivable by
this audit since it depends on App Store Connect account state we don't have access to): all
TestFlight builds for HyperDrive expired 2026-09-17, locking out roughly 39 drivers. HyperDrive
has no public App Store listing at all (confirmed: `MOBILE-APP-AUDIT-GROUNDWORK-2026-09-17.md` §1
— no iOS listing found under any searched name), so TestFlight has been the only distribution
channel, and every build on it expires 90 days after its own upload date regardless of app
version.

**Why.** This is both urgent and structural: today's ask is version 1.0.6 build 3 uploaded and
assigned to both tester groups (same version number should qualify for expedited beta review);
the permanent ask is the unlisted-App-Store-distribution plan in
`docs/HYPERDRIVE-APP-DISTRIBUTION-PLAN-2026-09-17.md` (deliverable 3 of today's set) so this
90-day cycle stops recurring.

**Prove.** Drivers on the two tester groups can install/update HyperDrive today; six months from
now no driver is locked out by a silent TestFlight expiry.

---

## What we need FROM the dev team (or whoever holds these), alongside this list

1. **A read-only MongoDB user for the sync tool** — TLS required, `read` role only, scoped to the
   collections in item 2 above plus whatever this pass's items 26-34 touch for verification.
2. **Who controls `hyperwolf.com` DNS** — needed to confirm/deploy the correctly-named
   `apple-app-site-association` file (item 34) and to plan any future subdomain for the console.
3. **The driver-app (HyperDrive) source repo** — none of the twelve `hyper-tech` repos contain
   client code; every mobile-app finding in this pass and in `MOBILE-APP-AUDIT-GROUNDWORK-
   2026-09-17.md` is inferred from the backend APIs the app must call.
4. **TestFlight and Play internal-testing access** — to close out item 35 and to give this audit
   real version/rating/data-safety detail instead of public search snippets.
