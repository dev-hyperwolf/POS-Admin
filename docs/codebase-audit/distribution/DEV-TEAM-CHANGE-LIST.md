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
