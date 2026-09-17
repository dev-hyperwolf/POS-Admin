# Metrc Program Plan — 2026-09-17

Owner decisions locked 2026-09-17 (do not re-ask): Metrc is its own program, started now. Hyperwolf
has **partner API access with Metrc (full API surface)**. Sync model is **end-of-day batch, not
real-time** — owner's own words: *"this gives us time to fix issues throughout the day vs submit
orders with issues then have to go into metrc and make adjustments."* Manisha's Stilo integration
is the reference (behavior, not code — `stilo-backend`/`stilo-frontend-nextjs` stay untouched).
Promotions/inventory target the grower's **batch**, with unit → batch → Metrc package resolution
underneath, per `docs/shells/PRODUCT-BATCHES-DESIGN.md` and `@hyper-tech/contracts` 0.4.3.

No Metrc endpoint was contacted to produce this document. No `.env` file was read anywhere.

---

## 0. Owner-readable summary

**What Manisha actually built, in one sentence:** two real calls to the real Metrc API — a nightly
cron that POSTs the day's orders as sales receipts, and an on-demand GET of active packages — both
hardcoded to one license number, both fire-and-forget with nothing written down about what was
sent or what Metrc said back. Everything else in the file named "metrc" (rewards, promotions,
tax, member discounts, PDF receipts) is an admin settings module that happens to share the name;
it never calls Metrc at all. There is no packages/items/strains/transfers/waste/compliance-queue
tracking anywhere in the Stilo codebase — Blaze and the production super-admin both have 10+
Metrc-family screens; Stilo has zero.

**Compliance verdict on end-of-day, in one sentence:** it holds for in-store/pickup retail sales
and (with a tighter cadence recommendation) for waste/adjustments, but it does **not** hold for
delivery — California requires the delivery manifest/ledger to be created in Metrc **before the
vehicle leaves**, which cannot be a nightly batch step. See §2 for citations and the parts of this
that are secondary-sourced and need counsel confirmation before they're load-bearing.

**What this document is:** an inventory of what exists (§1), a compliance read of the owner's
chosen model against what could be verified about California's rules (§2), a design for a
day-ledger + exception-queue + pre-flight + nightly-submit + morning-reconciliation pipeline (§3),
a security/integrity spec (§4), a phased build plan with probe suites and a refuter's attack list
(§5), and six one-at-a-time questions for the owner (§6).

---

## 1. What Manisha's Stilo integration does (honest inventory)

**Location:** `stilo-backend/controllers/metrc-controllers.js` (1,557 lines) +
`stilo-backend/routes/metrc-routes.js` (36 lines), mounted at `/api/v1/metrc`
(`startup/routes.js:76`), one cron registration (`startup/nodeCrons.js:9,102-105`), one URL
builder branch (`common/utils.js:60,92-93`), env vars declared in `.env.example` only:
`METRC_BASE_URL`, `METRC_USERNAME`, `METRC_PASSWORD` (never read from an actual `.env` for this
document). No corresponding code exists in `stilo-frontend-nextjs` (the only "metrc" hit there is
`public/lottie/NoSearchResult.json`, coincidental), and none in `hemp-backend`,
`distribution-backend`, or `hyperwolf-backend` (zero grep hits in all three).

### 1.1 The two calls that actually touch Metrc

**`createSales`** (`metrc-controllers.js:22-91`) — the only outbound write.
- Fired by `cron.schedule('59 23 * * *', ...)` (`nodeCrons.js:102-104`), i.e. once daily at 23:59
  server time. The window is computed with plain `new Date().setHours(0,0,0,0)`/`setHours(23,59,59,999)`
  — **no explicit timezone**, unlike `generateReceipts` elsewhere in the same file which explicitly
  uses `moment-timezone` with `America/Los_Angeles` (line 817). On a UTC-clocked host these two
  functions would disagree about what "today" means — worth checking Render's server TZ before
  porting this behavior.
- Queries `Order.find({ createdDate: {$gte, $lte} })`, and for each order builds one Metrc
  sales-receipt object from `order.items[].product.productBatches[]`, using
  `batch.trackingSystem || batch.productBatchId` as `PackageLabel` (line 54) — i.e. it trusts a
  batch/package label already carried on the order line item; it does not re-resolve unit → batch
  → package at submit time.
- POSTs to `POST /sales/v2/receipts?licenseNumber=M10-0000004-LIC` (line 78-82) — **one license
  number, hardcoded as a literal string**, not looked up per store or per order. Auth is HTTP
  Basic built from `METRC_USERNAME:METRC_PASSWORD` base64-encoded (lines 10-12) — mechanically
  identical to Metrc's real vendor-key/user-key model (see §5.3 of Metrc's own docs, confirmed by
  web research below) even though the env var names undersell it.
- **No retry, no backoff, no idempotency key, no persistence of the payload sent or of Metrc's
  response.** The success response to the caller is a static `"Run cron successfully!"`
  (line 83) regardless of what Metrc's own response body contained — `data` from the POST is
  never read, stored, or diffed against the local `Order` collection.
- **Bug found in passing:** the outer `try` (lines 29-90) wraps `Order.find` and payload assembly;
  its `catch` (87-90) only `console.error`s and returns nothing — no `res.send()`. Since this same
  function also backs `router.get('/', metrcController.createSales)` (`metrc-routes.js:5`), a
  manual `GET /api/v1/metrc/` call that hits this path (e.g. a broken `Order` query) would hang
  the HTTP request rather than error cleanly.
- **No lock, no lease.** A manual `GET /api/v1/metrc/` call overlapping the 23:59 cron, or a
  process restart mid-run, has no idempotency key to fall back on — a real double-submit risk
  against a system (Metrc) that has no "delete," only "void."

**`getActivePackages`** (94-112) — the only outbound read.
- On-demand `GET /packages/v1/active?licenseNumber=M10-0000004-LIC` (line 105), same hardcoded
  license, same basic auth, live proxy — Metrc's raw response is returned directly to whatever
  called `GET /active/packages` (`metrc-routes.js:6`). No caching, no persistence, and this audit
  could not confirm what auth middleware (if any) gates this specific router mount — flagged as
  unverified rather than assumed either way.

### 1.2 Everything else in the same file is NOT Metrc, despite the name

18 of the ~20 exported functions in `metrc-controllers.js` never call the Metrc API:
`createRewardSettings`/`updateRewardSetting`/`getRewardSettingListing`/`deleteRewardSetting`,
the parallel `Promotion`/`Tax`/`MemberDiscount` CRUD sets (lines 114–775), `getComplianceAmount`/
`createComplianceAmount`, `getDeliveryFee`/`createDeliveryFee`, `generateReceipts` (814-973) and
its helpers `getRandomRewardPoints`/`getRandomPromotionPoints`/`getRandomTaxPoints`/
`getMemberDiscounts`/`proportionalDiscountFunction`/`complianceFeeFunction`/`deliveryFeeFunction`/
`metrcOrderReceipt`/`generatePDF` (975-1508), and `orderData` (1510-1556).

These persist arbitrary percentage-weighted discount tables into a generic `Miscellaneous`
collection under string keys like `metrcRewardSettings`/`metrcPromotionSettings`/
`metrcTaxSettings`/`metrcMemberDisSettings`/`metrcComplianceFee`/`metrcDeliveryFee`, then
`generateReceipts` draws a reward amount, a promo amount, and (for `Seniors`/`Veteran` membership
groups) a member discount **via a `Math.random()`-weighted lottery against those tables**
(`getRandomRewardPoints`, lines 987-1000: cumulative-weight random draw) — not from any real
per-order loyalty/promotion decision — renders an HTML receipt with Puppeteer, uploads it to S3,
and writes the URL back onto the `Order` document. `orderData` is a plain paginated list of
`orderId`/`receipt`.

**Corroboration from a second codebase:** `hyper-tech/hyperwolf-super-admin/src/layouts/Metrc/`
mounts this at admin route `/manages/metrc` with tabs `promotion`, `reward`, `FeeManagement`,
`orders` (`Metrc/index.js`) — no tab for packages, sales, items, strains, or compliance
difference. `OrderMetrc.js` (286 lines) is the only tab touching order/receipt data, and it is
the receipts list, nothing state-facing. This confirms "Metrc" is the admin's own label for a
settings module, not a compliance dashboard, in both the backend and its admin UI.

**Net finding:** of ~20 endpoints under `/api/v1/metrc`, exactly 2 touch the real Metrc API, both
hit one endpoint each, and neither persists what was sent or received. Nothing exists anywhere in
this estate for Items, Strains, Transfers, Retail Deliveries, Compliance Difference, Waste, or
Adjustments — confirmed by this audit's own grep and independently by
`POS-Admin/docs/GAP-CLOSURE-PLAN-2026-09-17.md:649-653` (T3): *"no Metrc API client and no
Metrc-specific persisted model exist anywhere in wm-demo today... Metrc data is fetched live via
`stilo-backend/controllers/metrc-controllers.js` and folded into the Tax model, not stored as its
own schema."*

### 1.3 Security observations (cross-referenced against the existing audit)

Per `POS-Admin/docs/codebase-audit/repos/stilo-backend.md`:
- `METRC_USERNAME`/`METRC_PASSWORD` are plain env vars — same structural pattern the audit already
  flagged for `PaymentSetting.paymentClientId`/`paymentSecretId` (stored as plain Mongo fields,
  stilo-backend.md:308-311): no secrets-manager use anywhere in this repo.
- Logging is `console.log`/`console.error` only, no structured logs, no correlation IDs, **no
  alerting on a failing cron** (stilo-backend.md:223, 269-270) — exactly the "job that quietly
  produces wrong or partial data sends nothing" failure mode this estate has hit before elsewhere.
- No license/store scoping mechanism at all — the license number is a literal string baked into
  two URLs, meaning this code cannot safely operate more than one licensed store without editing
  source per store.
- No append-only audit of what was submitted or returned — both real Metrc responses are
  discarded after the HTTP response completes.

### 1.4 What is reusable as REFERENCE (behavior, never code — repos stay untouched)

1. The basic-auth construction (`base64(username:password)`, one `Authorization` header) —
   mechanically matches Metrc's real vendor-key/user-key model.
2. The daily-batch-at-close shape (one cron, one time window, one POST per order) is structurally
   right for the owner's chosen model — it needs persistence, idempotency, retry, and license
   scoping added, not a different shape.
3. The receipt-PDF pipeline (Puppeteer render → S3 upload → URL on `Order`) is a reusable pattern
   for a customer-facing receipt, independent of and unrelated to Metrc compliance.

---

## 2. Compliance check of the end-of-day model

**Caveat up front, per the task's own instruction:** the citations below come from the
Department of Cannabis Control's own compliance-hub page (fetched directly, primary-ish source)
plus several compliance-consultancy secondary sources for the general 24-hour rule's exact section
number. I could not pull the full text of Title 4 CCR §15049 itself in this pass. **Treat the
24-hour general-rule citation as needing counsel/compliance confirmation before it is load-bearing
in code** (this is Owner Question 6, §6).

| Activity | What's required | Timing | Can it be nightly? |
|---|---|---|---|
| In-store / pickup retail sale | Record the transaction in Metrc (CCTT) | General commercial-activity rule: within 24 hours (4 CCR §15049, secondary-sourced — see caveat). Separately, CDTFA (tax authority, **not** DCC/Metrc — a different system) requires cannabis sales reported to CDTFA by 11:59pm the day they occur. | **Yes.** A nightly job for the completed calendar day sits comfortably inside a 24-hour Metrc window, provided the job actually finishes before the deadline (see §3's checkpoint/retry design for what happens when it doesn't). |
| Delivery sale — pre-departure | The delivery inventory ledger (driver name/ID/license, vehicle make/model/plate, UIDs and unit quantities of everything loaded, UIDs of any pre-orders) must be **created in CCTT before the delivery employee leaves the licensed premises**; the departure date/time must be entered into CCTT when the trip begins. **4 CCR §15049.3 and §15418** (fetched directly from `cannabis.ca.gov`'s own compliance-hub page, 2026-09-17). | Before departure. | **No.** This is the one part of the owner's model that cannot be end-of-day as stated. |
| Delivery sale — post-completion detail | Delivery date/time, customer type, UID and quantity **sold**, purchase price, delivery county — if maintained outside CCTT during the route (e.g. no active internet), must be entered into CCTT **by the end of each calendar day**. Same citation as above. | End of day. | **Yes** — but only for this half of the delivery record, not the pre-departure manifest. |
| Inventory adjustment (damage, loss, correction) | Recorded in track-and-trace | General 24-hour rule (secondary-sourced, same caveat as retail sales above) | **Marginal-yes.** Fits inside 24 hours if the nightly job runs and succeeds same-day, but the margin is thin — see recommendation below. |
| Waste / destruction | Source package tags, waste weight, rendering method, date/time, witness — recorded in Metrc | Multiple compliance-consultancy sources describe this as expected to be recorded **contemporaneously / same-day** in practice, with 24 hours as the formal backstop (secondary-sourced, not primary CCR text pulled in this pass) | **Marginal-yes, same caveat as adjustments.** |
| Returns | Not independently verified as a distinct Metrc event type in this research pass — typically folds into either the original sale record or a package adjustment. | Unverified. | **Unverified — flag for counsel.** |
| Transfers / receiving (Hyperwolf as the receiving retailer) | Metrc's transfer-manifest requirement (pre-departure) sits with the **shipping** licensee (the cultivator/distributor), not with us as receiver. Our obligation is to accept/reject each incoming transfer into our own facility inventory in a timely fashion once product physically arrives. | Exact receiving-side deadline **not verified** in this research pass. | Naturally a synchronous, on-arrival workflow regardless (staff pulls up the manifest when the truck shows up) — not something a nightly job would touch either way. |

**Verdict, stated plainly:** the owner's end-of-day preference is legally sound for the highest-volume,
lowest-margin-of-error activity (retail/pickup sales) — the exact case the owner's own reasoning
("fix issues throughout the day") targets. It is **not** sound as a blanket rule: delivery's
pre-departure manifest is an explicit, dated regulatory requirement that must be synchronous, and
waste/adjustments sit close enough to their 24-hour backstop that bundling them into one nightly
run adds real risk for comparatively little benefit (these are low-volume, staff-initiated events —
nothing about batching them serves the "fix issues during the day" goal the way batching sales
does). Recommendation carried into §3/§5: **honor end-of-day for sales; make delivery's
pre-departure step synchronous; tighten waste/adjustment to near-real-time rather than nightly.**

### 2.1 Metrc API facts (for the design in §3)

- **Sales receipts, current endpoints:** `GET /sales/v1/receipts/active` (unfinalized/non-voided)
  and `GET /sales/v1/receipts/inactive` (finalized/voided) — the older consolidated
  `GET sales/v1/receipts` was removed (HTTP 405) effective 2021-03-12 for California. Retrieving
  full transaction detail is now a two-step read: list via active/inactive, then
  `GET /sales/v1/receipts/{id}` per receipt. *(Source: Canix's summary of Metrc Bulletin 90,
  fetched 2026-09-17 — [canix.com](https://www.canix.com/metrc-bulletins/metrc-bulletin-90-update-on-endpoint-changes).)*
  Stilo's own `createSales` POSTs to `/sales/v2/receipts` to **create** receipts — a `v2` create
  path can coexist with `v1` read paths; this was not independently re-verified against
  `api-ca.metrc.com`'s live documentation in this pass (no Metrc endpoint was contacted, per the
  hard rule) — flag for confirmation against the current CA API doc page before the new platform's
  client is built.
- **Auth model:** integrator (vendor) API key as username, user API key as password, combined
  with a colon and base64-encoded, sent as HTTP Basic in the `Authorization` header. *(Source:
  search-aggregated Metrc API documentation summary, cross-referenced against
  [pypi.org/project/pymetrc](https://pypi.org/project/pymetrc) and Metrc's own doc portals,
  fetched 2026-09-17.)*
- **Rate limits:** apply per-facility (license) for most endpoints, per-API-key for the handful of
  endpoints that don't require a license number; a 429 response carries the retry window in a
  response header. **Exact numeric limits were not obtainable** — Metrc's own rate-limiting PDF
  (`metrc.com/wp-content/uploads/2021/10/4-Metrc-Rate-Limiting-1.pdf`) rendered as unreadable
  binary/font data in this pass, and the general guidance is that exact limits depend on the
  partner agreement tier. **This is a hard verify-before-build item** (Owner Question 5, §6) —
  the nightly job's concurrency and backoff must be tuned against Hyperwolf's actual partner
  agreement numbers, not a guess.
- **Documentation home:** `api-ca.metrc.com/Documentation/PrintableList` — the authoritative
  reference for the CA-specific endpoint list once real credentials are in hand; not fetched here
  (would require contacting Metrc infrastructure, which is prohibited for this task).

---

## 3. Design

**Day-ledger** — every sale line, at the moment of sale, resolved **unit → batch → Metrc package
tag** per the mapping `docs/shells/PRODUCT-BATCHES-DESIGN.md` §5 already specifies ("sale → unit →
batch → the specific package that unit came from"), written **immutably** to a per-licence,
per-calendar-day ledger table. This is a purely local write — no Metrc call — so it can happen
synchronously at sale time regardless of any Metrc timing rule, and it's what gives the exception
queue something to work against all day.

**Exception queue (daytime, staff-facing)** — surfaces, live, as sales happen: unresolved tags
(a unit rang up with no batch/package resolution), negative package balances (selling more of a
package than its tracked batch quantity supports), unit-of-measure mismatches (Metrc package UOM
vs. POS sale unit), voids/returns needing reversal, price anomalies. This is the mechanism that
makes the owner's own reasoning for choosing end-of-day literally true — the whole point is to
have something to look at and clear before the deadline, not after.

**Pre-flight at close** — a dry-run validation pass, run once per licence shortly before the
nightly submit: re-check the day-ledger against Metrc's current package quantities (a real GET,
same shape as the existing `getActivePackages` call — reusable behavior) so drift between what the
ledger assumes and what Metrc currently holds surfaces *before* the submit job runs, not as a
rejected receipt afterward. Anything the pre-flight can't resolve automatically becomes another
exception-queue item rather than blocking the whole night's batch.

**Nightly submit job** — built on `wm-demo/wmdemo/jobs.py`'s existing runner (leases + checkpoints
+ idempotency, already the estate's answer to `~/.claude/CLAUDE.md` §4's four failure patterns —
see `docs/JOBS.md`), registered as a `daily:HH:MM` job:
- **Idempotency key per receipt** (order id + licence + date), so a re-run after a partial failure
  — the exact bug class today's `createSales` has zero protection against — never double-submits
  a receipt Metrc already accepted.
- **`ctx.retry()` on the smallest unit** — one HTTP call per receipt, never the whole night's
  batch (CLAUDE.md §4.5) — a Metrc-side flake on receipt #40 of 200 must not re-fire receipts
  1-39's already-accepted submissions.
- **`ctx.checkpoint()` per receipt** so a run killed mid-batch (by the platform's real timeout —
  confirmed from an actual observed cap, never a guessed number, per CLAUDE.md §4.2) resumes from
  where it left off instead of restarting.
- **Bounded retries with backoff** tuned to Hyperwolf's actual partner-tier rate limit once known
  (§2.1, §6 Q5) — not the current code's zero-retry, or a guessed number either.
- **Never widen scope**: the submit job writes only its own submission-audit rows; it must never
  touch rows another job owns (CLAUDE.md §4.3's "never widen the range" applies to tables here the
  same way it applies to spreadsheet columns).

**Next-morning reconciliation** — read back what Metrc actually holds (per-package balances,
per-receipt status) against the local ledger; a variance becomes an LP-style case using the
estate's existing register/cash-variance case pattern, extended to compliance variances, rather
than a number nobody looks at.

**Receiving / transfers intake** — READ-only from Metrc (incoming transfer manifests, package
detail) to create local batches/packages on staff confirmation when product physically arrives.
This is naturally synchronous/on-demand regardless of the sales-side timing debate — nothing about
it benefits from batching.

**Read-only phase one (explicitly requested by the owner's brief)** — build the whole read side
(day-ledger, batch→package resolution, pre-flight comparison, morning reconciliation) with the
submit job **disabled by a feature flag**, running in shadow mode against a real licence's real
Metrc data, before any code is allowed to actually POST a sales receipt. This is where the
batch→package resolution logic and the reconciliation math get proven against real numbers before
they're trusted to submit anything.

---

## 4. Security & integrity

- **Keys**: one secret per licence in a secrets manager (never the plain env vars
  `METRC_USERNAME`/`METRC_PASSWORD` pattern this audit found in Stilo) — least-privilege IAM so
  only the nightly job's execution role and the pre-flight/reconciliation backend can read them.
- **Never log payloads.** Replace the estate-wide `console.log`/`console.error` pattern the Stilo
  audit already flagged (stilo-backend.md:269-270) with a payload **hash** plus an append-only
  audit row per submission: licence, idempotency key, payload hash, Metrc response status/id,
  timestamp — never the raw sale/customer payload in application logs.
- **Approval model**: the nightly submit is machine-triggered by default. A manual re-submit or an
  exception override requires a named human approver role — mirror the estate's existing write-up
  "Approve & send" stamp pattern rather than a bare API call with no human on record.
- **Tamper-evidence**: the audit table is append-only at the DB role level (no `UPDATE`/`DELETE`
  grant for the application role that writes it).
- **PII minimisation**: send exactly what Metrc's sales-receipt schema asks for (e.g.
  `SalesCustomerType`, already present in the existing payload shape) — never Hyperwolf-internal
  identifiers Metrc doesn't request (loyalty ids, phone numbers, etc.).
- **Sandbox vs. production**: Metrc issues separate sandbox credentials per licence, distinct from
  production. Today's code has no sandbox/production distinction at all — one env var, presumably
  production. The new build must never share one secret between test and live traffic.
- **Kill switch**: a single flag that disables the nightly submit job specifically without
  disabling the read side (reconciliation, pre-flight, active-packages-style reads) — the same
  per-job enable/disable primitive `jobs.py` already provides.

---

## 5. Build plan

| Phase | Size | What | Notes |
|---|---|---|---|
| 0 | S (owner, no agent time) | Confirm real licence numbers per store; confirm partner API credentials are provisioned and scoped (prod vs. sandbox); route §2's citations to counsel before they're load-bearing; confirm real rate-limit numbers from the partner agreement. | Blocks everything downstream — nothing here should be guessed. |
| 1 | M | Read-only foundation: Metrc API client (auth, single-call retry, rate-limit-aware backoff), batch→package resolution service against the existing `Batch.metrc_packages` contract shape, immutable day-ledger table, reconciliation-read job — **no submit capability compiled in at all.** | This is the owner's requested read-only phase one. |
| 2 | M | Exception-queue screen (daytime) + close-of-day pre-flight screen. Four concepts each. | Staff-facing; this is what makes "fix issues during the day" literally true. |
| 3 | L | Nightly submit job on `jobs.py`: idempotency keys, checkpointing, licence-scoped secrets, kill switch — shipped behind a feature flag, first run in dry-run mode before the first real submit. | The highest-risk phase; gate it hard. |
| 4 | M | Delivery pre-departure path: a **separate, synchronous** at-dispatch Metrc write for the manifest/ledger — cannot reuse the nightly job's timing. Reuse the existing dispatch/Onfleet event feed before building a new trigger (CLAUDE.md §4.8's duplicate-fetch rule). | Owner's model does not extend here — see §2. |
| 5 | M | Transfers/receiving intake: read manifests from Metrc, create local batches/packages on staff confirmation. | Read-only by nature. |
| 6 | S–M | Reconciliation board + LP-style case creation, desktop and phone. Four concepts each. | |

**Probe suite**: a Metrc stub server modeled on the real API's error shapes — 429 with a
retry-window header, the `[{...}]` validation-error array shape the existing Stilo code already
handles (`error.response.data[0]`), a partial-batch failure, and a duplicate-submit-after-crash
case for the idempotency key. `qa/metrc_probe.py` (naming convention matches the estate's existing
`qa/*_probe.py` pattern) exercising: happy path, mid-batch crash + resume, negative-balance
exception routing, rate-limit backoff, and a cross-licence read attempt through a store-scoped key.

**Refuter's attack list**:
1. Crash the nightly job mid-batch — confirm no duplicate submits and no dropped receipts on
   restart.
2. Feed a sale whose resolved package Metrc reports as already fully consumed — confirm it lands
   in the exception queue, not a silent Metrc rejection nobody sees.
3. Attempt to read another licence's packages/exceptions through a store-scoped key.
4. Hold the script/job lock during the nightly run and confirm no other trigger (e.g. an existing
   cash-close job) starves — per CLAUDE.md §4.4's lock-scope rule.
5. Kill the job at the real platform timeout (confirmed from an actual observed cap, not a
   comment) and confirm checkpoint resume rather than a restart from zero.

**Four-concept design rounds required**: exception-queue screen, close-of-day pre-flight screen,
reconciliation board (desktop **and** phone) — three screen families, four concepts each, per the
estate's standing design-process rule.

---

## 6. Questions for the owner

Ask one at a time, multiple-choice, options carry one-sentence pros/cons, recommended option first.

**Q1 — When does the nightly submit job fire?**
- (a) *Recommended.* Fixed clock time after typical close (e.g. 12:30am covering all stores). Pro:
  one simple schedule. Con: a late-closing store might not actually be done yet.
- (b) Per-store configurable close time. Pro: matches real hours. Con: N schedules to maintain
  instead of one.
- (c) Triggered by an explicit "day closed" action from staff, not a clock. Pro: never fires early.
  Con: depends on staff remembering to close.
- (d) Something else (specify).

**Q2 — What triggers the delivery pre-departure Metrc write (§2, cannot be nightly)?**
- (a) *Recommended.* Automatic, fired the instant dispatch marks a delivery "out for delivery"
  (reuse the existing dispatch/Onfleet event). Pro: no new staff step. Con: depends on that event
  firing reliably.
- (b) A manual driver-facing confirm step before pulling out. Pro: an explicit human checkpoint.
  Con: one more thing a driver can skip.
- (c) Reuse whatever Blaze's own delivery flow already does today, if Blaze still handles
  deliveries. Pro: no duplicate build. Con: only works if that flow still exists and is trustworthy.
- (d) Something else (specify).

**Q3 — Cadence for waste/destruction and inventory adjustments (§2 flags nightly as marginal here)?**
- (a) *Recommended.* Near-real-time — submitted within the hour, not bundled into the nightly
  batch. Pro: stays safely inside the 24-hour margin. Con: a second, smaller sync path to build.
- (b) Bundle into the same nightly batch as sales. Pro: one pipeline. Con: tighter legal margin,
  and no benefit since these are low-volume staff-initiated events, not the high-volume case
  end-of-day was chosen for.
- (c) A manual "submit now" button staff presses after each event, no automatic cadence. Pro:
  simplest to build. Con: relies on staff remembering every time.
- (d) Something else (specify).

**Q4 — How long does read-only Phase 1 run before the nightly submit job goes live?**
- (a) *Recommended.* A fixed trial window (e.g. two full weeks) reconciling against real Metrc
  data with zero submits, reviewed by the owner before flipping the switch. Pro: known timeline.
  Con: might approve while an edge case just hasn't happened yet.
- (b) Run in shadow mode until reconciliation shows zero variances for N consecutive days, however
  long that takes. Pro: evidence-based cutover. Con: open-ended timeline.
- (c) Skip the trial, go straight to submit with the pre-flight/exception-queue as the only safety
  net. Pro: fastest to value. Con: no real-data proof before the first live submit.
- (d) Something else (specify).

**Q5 — Sandbox access for build/test, separate from the production partner key?**
- (a) *Recommended.* Request Metrc CA sandbox/test credentials before Phase 1 starts; build and
  test against sandbox first. Pro: real API behavior without touching production data. Con:
  another credential to request and manage.
- (b) Build against the plan's self-hosted stub server only, skip a real Metrc sandbox entirely.
  Pro: no external dependency. Con: a stub can't catch everything a real sandbox would.
- (c) Use production credentials read-only during build, never a test write. Pro: no new
  credential needed. Con: no way to test the write path at all before go-live.
- (d) Something else (specify).

**Q6 — This plan's §2 legal citations are secondary-sourced (compliance consultancies + one DCC
webpage), not a lawyer's read of the primary CCR text. How should that get closed out?**
- (a) *Recommended.* Route §2 to counsel/compliance for sign-off before any code that assumes
  these deadlines ships. Pro: closes the actual risk. Con: adds a review cycle before Phase 3.
- (b) Proceed on this research as sufficient; revisit only if audited. Pro: no delay. Con: the
  24-hour-rule citation specifically was not independently verified against primary text.
- (c) Commission a fresh review from an existing compliance-consultant relationship, if one
  exists, rather than in-house counsel. Pro: faster than counsel, still independent. Con: unclear
  if such a relationship currently exists.
- (d) Something else (specify).
