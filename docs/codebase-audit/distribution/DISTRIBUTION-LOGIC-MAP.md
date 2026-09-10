# Distribution module — how the logic works, why it fails, what to change

Synthesis of four read-only studies of `Hyper-Tech-inc/distribution-backend` (2026-09-10):
`KIT-BUILD-AND-DISPATCH.md`, `REFILLS-CLOSURE-AND-REPORTS.md`, `CALLERS-AND-DEPENDENCIES.md`,
`SYMPTOMS-RECEIVED-INVENTORY-AND-REFILL-QTY.md`. Every claim below was re-read at the cited line.
Nothing in the repo was changed.

## 1. What the module is, in one paragraph

An admin-only Node service. A warehouse admin builds weekly **kits** (boxes of product per driver
per subregion) from hand-edited **templates**, **dispatches** them (which creates Blaze inventory
transfers), runs a **daily refill** that tops kits up from Blaze sales, scans product in and out
at the warehouse, **closes** each day by reconciling assigned vs scanned vs sold, and produces PDF
reports. Its only client is one screen set inside `hyperwolf-super-admin`, driven by a single
1,497-line redux file. There is no driver app: the "driver PIN" is a super-admin re-auth. Nothing
in the service runs on a schedule of its own — every cron is commented out — so whatever runs
today is an external caller hitting `POST .../manage-distributions/cron` and
`POST .../kit-refill/cron` with an admin token. Nobody in the estate could say what that caller is.

## 2. The two reported symptoms, traced to code

### Symptom 1 — newly received premium product sits for up to a week

Freshness is not an input anywhere in the decision path.

| Where the decision is made | What it actually does | Cite |
|---|---|---|
| Kit template | Hand-edited min/max per SKU; no date, no priority, no hook | `kit-template-controller.js:17-284`, `models/templateSku.js:7-12` |
| Kit build allocation | Round-robin 1 unit per subregion per pass, FEFO by expiry; a product whose total stock is below the number of subregions is **never placed anywhere**, not even partially | `manageDistributions.repository.js:722,745,770-775` |
| Refill "new product" pass | Candidates sorted **alphabetically by product id**; same all-subregions-or-nothing gate | `kit-refill-controller.js:2021`, `:2095-2098` |
| Aging rules (purchase date, expiry) | Feed reports and promotions only; never read by build or refill | `aging-rules.repository.js:140-1252` |
| Receiving data (`ProductBatch.batchData`, `safeInventory`) | Written only by `saveProductBatches`, whose cron is commented out; runs only inside the daily refill or by an unknown external call | `common-controllers.js:643-843`, `nodeCrons.js:25-32` |

So a premium SKU that lands in a small first tranche (say 5 units for 12 subregions) is skipped on
every run until stock accumulates, and even then it queues alphabetically behind everything else.

### Symptom 2 — refill quantities wrong: refills what did not sell, omits what did

Not one bug but a stack. The three systemic ones:

| Mechanism | Effect | Cite |
|---|---|---|
| "Sold" counts only Blaze transactions tagged **`asap`**; every other completed sale is invisible | Omission: a product that sold through a non-ASAP order is never refilled | `common-controllers.js:125` |
| The refill log stores the quantity **actually handed out** as next cycle's cap; one short-stock day permanently lowers the ceiling, with no reset | Persistent under-refill | `kit-refill-controller.js:1307-1308` → `:1026-1035` |
| `usedQty` is `max(existing, calculated)` and only falls when a refill consumes it | Over-refill against phantom demand after any miscount | `common-controllers.js:977-981` |

Seven more mechanisms (unmapped terminal, product id changed in Blaze, missing `usedQty`, cap of
zero, stale `safeInventory`, only the latest week's distributions, subregion without a refill
template) are tabled with a data check each in `SYMPTOMS-…md` §2(e). The formula itself is
`refill = min(sold since last refill, cap)`; the template's min/max play no part in refilling
existing items.

## 3. Structural defects that make the whole module unreliable

1. **Three definitions of "today".** The refill hand-rolls a day boundary with a hardcoded
   **+5.5 h India offset** in four places (`kit-refill-controller.js:855-858, 1510-1513, 2633-2636,
   4940-4943`), the build uses server-local `moment().startOf("day")`
   (`manageDistributions.repository.js:48-49`), closure uses server-local `setHours(0,0,0,0)`
   (`closure-overview-controller.js:453-454` and five more). For a Pacific business the refill's
   "already ran today" guard fires at the wrong hour: double refills or false "already completed".
2. **Distributions are born in a state the Blaze sync never looks for.** Created as `splitting`
   (`manageDistributions.repository.js:640`); the two Blaze bulk-transfer builders query only
   `freeze` (`blaze-syncing-controller.js:597, 1177`); the only writer of `freeze` sets it just when
   a driver assignment changed (`:1358-1364`). Common case: the sync reports "0 distributions".
3. **One failing template discards the whole run.** Failure is checked after the loop and
   `insertMany` runs only if nothing failed (`manageDistributions.repository.js:1020-1027, 1213`).
4. **No scheduler.** All four crons commented out (`nodeCrons.js:7-42`); two of them would crash
   if uncommented because the handlers read `req.body` (`kit-refill-controller.js:861`).
5. **Batch data never attached at build.** The push is commented out under a `// 🔥 ADD THIS`
   marker (`manageDistributions.repository.js:441-455`); anything reading `productBatchesBlaze`
   before a scan sees nothing to transfer.
6. **Dispatch can answer twice and record nothing on a Blaze failure**
   (`driver-kit-verification-controller.js:2280-2293, 2465-2481`), and every dispatch **wipes the
   subregion's dispatch history** first (`:2175`).
7. **Scale.** `KitDistributed` has no indexes and is never archived; four endpoints load the whole
   collection; the refill mints its next sequence number with an unindexed triple-`$unwind` over
   the entire collection on every run (`kit-refill-controller.js:459-489`). This is the piece that
   will time out first.
8. **Lost updates.** `versionKey:false` plus load-mutate-`save()` with no lock
   (`kit-refill-controller.js:310-448`) races the targeted `bulkWrite`s and live scans.
9. **Silent failures.** `saveProductBatches` result discarded (`:870`); eight `KitRefill` audit
   writes swallowed with `console.error`; Sentry never initialised; closure's
   `totalInventoryValue` multiplies a quantity by a dollar total (`closure-overview-controller.js:993`);
   Waste Inventory returns empty when `discrepancyResolutionETA` is unset
   (`waste-inventory-controller.js:27-37`).
10. **Global settings read without the platform filter** (`manageDistributions.repository.js:162-166`)
    while the model carries `hyperwolf|stilo`; two rows means one platform gets the other's caps.

## 4. Dependencies and blast radius (what a change can break)

- **Caller**: `hyperwolf-super-admin` only. Any response-shape change needs a matching edit in
  `redux/slices/hyperwolf/inventoryDistribution.js`.
- **Other services' databases**: reads `Fleets`, `Order`, `Products`, `ProductBatch`,
  `FleetOffDutyCloseout` straight out of hyperwolf-backend's DB with a drifting schema copy;
  **writes** `ProductBatch` (product sync) and `FleetOffDutyCloseout` (closure approval) there;
  reads and writes `Admin` in hemp-backend's DB (JWT and PIN).
- **Blaze**: create+accept transfer per batch, per-batch isolation, retry only on 429, a
  process-global daily request budget.
- **Tests**: none. **Validation**: none on the kit/refill/dispatch routes. **Auth**: two Blaze
  transfer routes and two report downloads are unauthenticated.
- **Host**: the storefront's fallback constant names `distribution-backend.js.thcs.in`; no EC2
  instance in the AWS inventory carries that name (A2 in the operating plan).

## 5. What "working" would require (the target behaviour, for the team to confirm)

1. **Freshness is an input.** Received date (Blaze `purchasedDate`, already stored) ranks
   candidates in both build and refill; a product under N days old may be placed partially
   (waive the all-subregions gate) so a small premium tranche moves the day it lands.
2. **Sold means sold.** All completed Blaze transactions count, joined on a stable product key
   with a SKU fallback, in the business timezone, since the last refill.
3. **Need is demand, not history.** Store `neededQty` and `refillQty` separately; next cap derives
   from the template or original distribution, never from what stock allowed last time.
4. **One clock.** A single `businessDay(ts)` in one module, Pacific, used by build, refill and
   closure alike.
5. **Runs on a schedule the company owns**, idempotent per business day, with a lease so two
   triggers cannot overlap, and a result the admin can read (what was refilled, what was short,
   what was skipped and why).
6. **Observable.** Every skip and shortfall recorded with a reason; failures reach Sentry.

## 6. Three ways to get there (owner decision)

| Option | What | Risk | Effort (elite dev, hours) |
|---|---|---|---|
| **A. Patch in place** | Fix the ten defects and the two symptoms inside the existing 5,479-line controller and 1,311-line repository, on branches, PR by PR | Every change lands in functions with no tests and four copies of the same bug; the super-admin file must move in step | 40–60 for §2–§3, plus 8–16 to add the first tests |
| **B. New decision engine beside it** | Leave the CRUD, scanning, closure and reports where they are; move **only the decisions** (what goes in a kit, what to refill, in what order, how much) into a new, tested module with one clock and one "sold" definition; the old controller calls it | Two systems until cutover; needs the deploy line for this service | 60–90, most of it the engine and its fixture tests against real `KitDistributed` documents |
| **C. Rebuild the module in our estate** | A Distribution app in POS-Admin/wm-demo on the contracts package, as Bounty and Verify were built, with Blaze behind an adapter; super-admin screen retired | Largest; touches Blaze transfers and closure approval that write into other services' databases; needs the data migration | 200–300 |

Recommendation: **B**, and start it with the two symptoms. The engine can be proven against
exported production documents before it decides anything live, which is the only way to know a
refill number is right without a test suite. A is the fallback if the team cannot host a second
module; C is where the consolidation plan (wave 4.8, "hyperdrive owns Fleet/Task") ends up
anyway and should not be attempted before Phase A of the operating plan.

## 7. Questions for the team (answers change the design)

1. Who or what calls `POST .../kit-refill/cron` and `POST .../manage-distributions/cron` today,
   and when? If nobody knows, refills are not on a schedule at all.
2. Was the `asap`-only sold filter deliberate? Which order tags exist in Blaze and which count as
   a sale from a driver's kit?
3. What timezone is a "day"? Where did +5.5 h come from?
4. Is `freeze` a required step between build and dispatch, or a leftover?
5. Is `discrepancyResolutionETA` set in production? Is `DistributionGlobalSettings` one row or two?
6. Does Chromium/Puppeteer work on the production host, and does anything outside the estate call
   the report-download routes?
7. Can we get a read-only export of `kitdistributeds`, `productbatches` and one week of Blaze
   transactions to replay the refill decisions offline? That export is the test fixture for any
   option above.
