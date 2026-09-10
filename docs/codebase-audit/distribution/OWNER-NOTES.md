# Distribution — the owner's notes as they arrive

Running log. Each entry: what was said (paraphrased closely), what it means for the engine, the
screens and the data, and any question it raises. Newest at the bottom. Screens are not revised
until the owner says the review round is over.

## 2026-09-10 · on the Refill Day concepts (after seeing Concept C)

**Said.** A receiving day can bring 50–60 items. They are of three kinds: (1) a genuinely new
SKU; (2) a restock of a SKU sold before; (3) more quantity of a SKU already in stock but under a
**different batch number**. For flower, vapes and pre-rolls, batches typically have very
different THC results and package dates, so two batches of one SKU are **not the same product to
the customer**: an order for 2 units that ships from two batches is likely to upset the customer
unless dates and THC are near-identical. What the team wants is **100% certainty about every
received product: is it being included in kits (it should be), and if not, why**. And a specific
flag: two batches can be transferred to one kit, but that must be **clearly flagged**, because
the new batch is sometimes stored in a slightly different location; if the refill person does not
know it exists they report "no more quantity to refill", and inventory discrepancies follow
quickly. More notes to come over the next hour; no screen revisions yet.

**Engine implications.**
- The unit of allocation is the **batch**, not the SKU. `ProductBatch.batchData[]` already holds
  `batchNo`, `purchaseDate`, `expirationDate`, `currentQuantity`; the current FEFO pick already
  walks batches by expiry, but it will happily take from two batches for one kit line and never
  says so.
- Rule: fill a kit line from one batch where stock allows; when a line must span batches, emit a
  `MIXED_BATCH` reason on the plan (batch numbers, THC if known, package dates) so the screen can
  flag it, and prefer finishing the older batch before opening the newer one unless the newer is
  the only stock.
- Rule: a **new batch of an in-stock SKU** is a first-class receiving event, distinct from a new
  SKU and a restock; the plan lists all three kinds separately with counts, so 60 arrivals are
  accounted for, not highlighted.
- Output: for every received item today, one line: `included in N kits / not included — reason`
  (below subregion count, not in template, capped, stock reserved, mixed-batch hold, etc.). This
  is the "100% certainty" requirement and it is a table, not a lane of cards.
- Refill "no stock" must be computed from **all batches of the SKU**, and the response must name
  the batches it saw, so "we have none left" can never be said while a newer batch exists.

**Screen implications (for the next round, not now).**
- The received lane becomes a **received ledger**: every arrival of the day, grouped new / restock
  / new batch, each with its disposition and reason; the three-card lane in Concept C is only the
  "needs a decision" subset of it.
- A **batch chip** on any kit line that carries more than one batch, with the batch numbers and,
  where known, THC and package date; and a "new batch on hand, stored at …" note on the SKU wherever
  the refill shows it.
- Certainty language: "included in 6 kits", "not included — below subregion count (5 units, 12
  subregions)", never a bare "skipped".

**Data questions.**
1. Where is a batch's **storage location** recorded, if anywhere? Not in `ProductBatch` today
   (audit: `batchNo`, `purchaseDate`, `expirationDate`, `currentQuantity`, `productBatchId`). If
   it lives in Blaze, which field; if nowhere, it goes on the developer list as an additive field.
2. Do the Blaze batch records carry **THC result and package date**? If so the mixed-batch flag
   can say "THC 24.1% vs 31.6%"; if not, batch number only.
3. How is "near-identical" defined for the team (THC within N points, package dates within N
   days) so the engine can allow a quiet mix inside that band?

## 2026-09-10 · keeper from Concept B (Box Cards)

**Said.** "I really like this part of the design, great job — note that I want to keep it as we
move forward." Screenshot: the region tabs with a "ran today" chip; per driver, a vertical
timeline (Built → Frozen → Synced to Blaze → Dispatched → Refilled → Closed, each with time and
who) running down the left of the kit column; a driver card (name, route, "2 / 2 boxes packed",
unit total) with a progress bar; below it colour-coded box cards (Flower Box 1, Vape Box 1,
Edible Bin) each with PRODUCT · SOLD · NEED · CAP · GIVE · REASON rows, a shortfall row tinted
amber with "short stock"; a legend strip of box types plus shortfall/skipped row colours and a
"Manage box types" button.

**Keep, verbatim, in every later round:** the kit column composition (timeline + driver card +
box card stack), the box-type colour legend, the row schema and the tinted shortfall/skipped rows.
Concept B's file: `explorations/Distribution Refill - Concept B - Box Cards.html`.

## 2026-09-10 · keeper from Concept D (Tablet Packing) + RFID requirement

**Said.** Likes the box panel: box breadcrumb across the top (Flower Box 1 ✓ ▸ Flower Box 2 ▸
Pre-Roll Box 1 ▸ …), "Manage box types", large product rows with SOLD · NEED · CAP and a big
− qty + stepper, the shortfall row tinted amber with "Reason: Short stock" and a Fix button, and
the full-width green "Box packed" button. **Keep.**

**RFID.** Once the team assembles a kit they scan every item in it with an RFID scanner, and that
must immediately flag any discrepancy against the refill plan or the initial build. Kits are
also scanned when the driver returns them, to verify quickly what came back. The RFID project in
our estate must be considered in the next round; no redesign yet.

**Implications.**
- Two new verification moments in the flow: **pack verify** (after build or refill, scan vs plan
  per box) and **return verify** (scan vs dispatched − sold). Both produce discrepancies with a
  reason, and both belong on the timeline (Built → Frozen → Synced → Dispatched → **Pack-verified**
  → Refilled → **Returned/verified** → Closed).
- The plan the engine emits must be **tag-resolvable**: each planned unit maps to a batch, and the
  RFID tag must map to a batch (tag → product batch → SKU); a batch-level mismatch (right SKU,
  wrong batch) is exactly the mixed-batch case from the previous note and must show as such.
- Box-level truth: the RFID screen in our estate already assigns each tag to the box it read
  strongest in; the pack verify can therefore say "GMO 7g: planned 6 in Flower Box 1, read 5 in
  Flower Box 1 and 1 in Flower Box 2".
- Return verify feeds closure: expected back = dispatched − sold (Blaze) ± refills; read back =
  RFID; difference = discrepancy, pre-filled for Loss Prevention.

## 2026-09-10 · RFID study folded in (`RFID-FOR-DISTRIBUTION.md`)

**What exists.** `rfid/` is the shipped module in the rail (mockup: fixture data, nothing
written); three direction studies beside it. A real middleware clone lives at
`/Users/jt/Documents/hyperwolf-repos/rfid-middleware`: TypeScript, 77 tests plus a 100-check
conformance kit, strongest-read (argmax RSSI) reconciliation, a tag lifecycle state machine
(… DISPATCHED → SOLD / RETURNED), a ports-based integration contract. The Android shell that
talks to the radio is specified, not built; reader gates and RSSI values are simulated.

**Gaps against the requirement.**
- Pack-verify after **refill**: absent. The kits screen models the initial build only, and its
  plan is keyed by SKU, so it cannot express "right SKU, wrong batch" — the mixed-batch case.
- **Return-verify**: no screen, no `RETURN` session mode in the middleware (only KIT and CYCLE),
  and nothing computes dispatched − sold; that number lives in distribution-backend and is
  under-counted today (ASAP-only sold filter). The state machine already allows RETURNED.
- The backend's existing scan path (`scanProduct` → one barcode unit per call) cannot carry a
  batch RFID read; integration needs new additive endpoints and fields, never a reuse of
  `scanProduct`. RFID output must never be wired into wm-demo's `/api/kit` (that write republishes
  the public Weedmaps menu).

**For the next round.** The engine's plan is keyed by **box × SKU × batch**; the RFID diff reads
per box (strongest-read) and reports per batch. Three verification moments on the timeline:
pack-verify after build, pack-verify after each refill (per box), return-verify at the door.
Developer list additions: a `POST …/kits/:id/rfid-verify` (additive) that takes a batch read and
writes a Discrepancy with reason codes; `tagId` on `productBatches[]` if tags are applied at
receiving. Middleware additions: a RETURN session mode; batch-keyed plan input.

## 2026-09-10 · answers to the three RFID questions (1 and 2)

**Q1 — tag ↔ batch:** at receiving, **one tag per unit, recorded to the batch**. So the scanner
can tell right product / wrong batch, and a return scan knows which unit came back.

**Q2 — return baseline, in the owner's words:** "factor in all inventory that was dispatched to a
driver: ASAP + Scheduled orders both. The refill logic shouldn't consider the refill template
against scheduled orders as those are sourced from the safe vs the driver kit. Every single item
must be accounted for and we should have a few checkpoints: we have the distribution list — we
scan that in and verify each tag is there so we know what the driver gets; then we have what was
sold — reference ASAP specifically for refill and loss prevention, scheduled orders for loss
prevention only." Also ticked: dispatched − every completed sale + refills; ASAP-only for the
refill (as today); unit-level accounting (every tag that left must be scanned back or sold).

**Correction to our own findings.** The `asap`-only sold filter in the refill
(`common-controllers.js:125`) is **deliberate and correct**: ASAP orders are fulfilled from the
kit, scheduled orders from the safe. It is not a cause of under-refill. The remaining causes
stand (cap ratchet, usedQty only rising, identity joins, IST day boundary, lagging batch data).
`DISTRIBUTION-LOGIC-MAP.md`, `DESIGN-BRIEF.md` and `DEV-TEAM-CHANGE-LIST.md` are amended.

**Engine model that follows.**
- Two demand streams per driver: **ASAP sales** (from the kit → refill need + loss prevention)
  and **scheduled sales** (from the safe → loss prevention only; they still leave with the driver
  and must be accounted for at return).
- Checkpoints, each a set of tags: (1) **dispatch list** = plan → scanned at the bench, every
  planned unit's tag present (pack-verify); (2) **sold** = Blaze completed orders, ASAP and
  scheduled, ideally by tag/batch on the order line; (3) **return scan** = tags read back.
  Identity per unit: every dispatched tag is either sold or returned; anything else is a
  discrepancy with a reason (missing, extra, wrong batch, sold-but-returned).
- Refill need = ASAP sold since last refill per SKU (batch-aware), capped by demand, never by
  what stock allowed last time.

**Q3 — scan points:** a handheld at the **packing bench, per box as it is packed** (a mismatch
interrupts the packer before the next box), **and** a handheld at the **loss-prevention bench**
nearby, for the return scan. So: two handhelds, two stations a few steps apart; no fixed portal;
receiving-time tag commissioning happens at receiving (per Q1) with whichever handheld is free.

**Consequences for the next round.**
- Packing tablet (Concept D keeper) gains a "Scan box" step on the Box packed button: the box
  cannot be marked packed until its read matches the plan per batch, or the packer records a
  reason. The discrepancy is raised there, not at closeout.
- Loss-prevention bench gets its own screen: return scan per kit → expected (dispatched + refills
  − ASAP sold − scheduled sold) vs read, per batch, with the driver's closeout beside it.
- The RFID middleware needs a RETURN session mode and batch-keyed plan input; the developer list
  needs the additive verify endpoint. Both recorded in `RFID-FOR-DISTRIBUTION.md` and the change list.

## 2026-09-10 · in-store flow, Blaze exit, refill clarification, oldest-first

**Said.**
- **In-store** has been missing from the discussion. Stores have **back of house** (usually the
  safe) and **front of house** (the sales floor, ready to sell). The sales floor is restocked
  several times a day — the same concept as a refill. The store must be flagged when new products
  arrive or things need moving to the front — the same as the delivery refill. Stores also need a
  **full cycle count of the entire inventory by location**, and many other filtered approaches.
  Research how large-scale inventory management software does this and borrow the best
  concepts. Goal: automated, easy, stress-free, incredibly smart; the less it relies on a person
  the better. There are more edge and use cases for stores; agents are to put them together for
  **both delivery and in-store**.
- **Blaze exit.** "We will be leaving Blaze soon." Map our POS code so the migration lands
  cleanly; **every module we build must work with or without Blaze.**
- **Refill clarification.** "Refill need = ASAP sales since last refill, batch-aware, capped by
  demand" is correct, **and** the refill must also send any newly received product, of all three
  kinds: a completely new product, a new batch of a sold-out product, a new batch of a product
  that already has batches in kits.
- **Oldest first.** Use logic that clears out older batches first; solid automated inventory
  management across the board.

**Implications.**
- One inventory model for both channels: **locations** (safe / sales floor / kit box / vehicle /
  loss-prevention bench / returns), **units with a tag and a batch**, **movements** between
  locations, and **replenishment rules** per destination (a kit box, a sales-floor shelf). A
  store restock is a refill whose destination is a shelf; a delivery refill is a restock whose
  destination is a box.
- Engine inputs per destination: sales since last replenishment from the channel that draws on
  it (ASAP for kits, register sales for the floor), min/max per SKU, and the **received ledger**
  (new SKU / restock / new batch); outputs: a plan with reasons, oldest batch first (FEFO by
  expiry, then received date), never mixing batches silently.
- Cycle counts: RFID-driven counts by location, ABC/velocity-driven scheduling, blind counts,
  variance thresholds, count-while-open rules.
- **POS adapter**: a `PosProvider` port (products, batches, inventory by location, sales,
  transfers, terminals) with `BlazeProvider` today and `HyperwolfPosProvider` (our own POS in
  POS-Admin/wm-demo) next; Metrc/track-and-trace obligations that Blaze handles today must be
  identified before the exit.

## 2026-09-10 · live tour of admin.hyperwolf.com (read-only; nothing clicked that writes)

**The real box types (15), with product counts today** — box types are a "Boxes" table with a
name, a description and a category rule, plus a Products tab mapping SKUs to boxes:
Flower BOX 1 HW Jar (HW premium 3.5g, 10) · Flower BOX 2 HW Bag (29) · Flower BOX 3 Bag
(outside 3.5g, 69) · Flower BOX 4 Bulk Bag (outside >3.5g, 66) · Flower BOX 5 Boxed (108) ·
Flower BOX 6 Bulk Jar (1) · Pre-Roll BOX 1 Single (249) · Pre-Roll BOX 2 Packs (173) · Vape BOX 1
510 + Pods (166) · Vape BOX 2 All In One (136) · Vape BOX 3 Box Vapes (94) · Concentrate BOX 1
All (184) · Edible BOX 1 Mixed (223) · Edible BOX 3 Beverages (36) · Accessories (31). No cooler
or bin exists as a box type today; the owner's list (Cooler, Concentrate Bin 1/2, Edible Bin) is
the vocabulary the console should offer, so box types stay data.

**Things on the screens we had not discussed**
1. **Box → product mapping is a first-class admin object** (Manage Boxes, Products tab): each
   SKU belongs to a box type by rule; the build reads this. Our console needs the same editor or
   must read it as-is.
2. **Kit Template has two tables**: Distribution and Refill. Two templates live today, T-0001-LA
   (region RC, 9 subregions, 15 boxes, min 1 / max 1100 products per region) and T-0002-LA
   (SB+OC, 9 subregions). "Min/Max Products Per Region" is a template-level cap.
3. **Distribution Config** (global): min/max products per region, per box, per product; default
   "Products Expiring In N days"; **Discrepancy Resolution ETA in hours** ("before products are
   marked as waste") — the field that empties Waste Inventory when unset; a **Discrepancy Type**
   list (today: "Missing SKU"); **Aging Rules By Category** (empty today).
4. **Distributions list**: one distribution, Sep 05 2026, kit value **$112,757.24**, status
   Distributed; "Total unique products" and "Total quantities" show "-". Actions column has two
   unlabeled icon buttons.
5. **Kit Replenishment Logs**: refills on Sep 07 ($10,513 / 867 units), Sep 08 ($4,709 / 451),
   Sep 09 ($5,130 / 505); an **Activity Logs** button; a **Refill Kit** button (one click, no
   preview — confirmed live).
6. **Driver Kit Verification**: a global **SCANNING** toggle; rows D-0001 Distribution (Sep 05,
   verified **0/11,484**), R-0001..R-0003 Refill (verified **0/867, 0/451, 0/505**), all
   "Completed". **Nothing has been scan-verified**: the barcode verification step is not used.
7. **Closure Overview**: every day shows **17 open forms, 0 closed, $0 revenue** (Sep 06–09); a
   revenue min/max filter. Either closure is not being done or revenue is not flowing into it.
8. **Discrepancy Management**: empty. **Discrepancy Approvals**: columns Product/SKU · Sub
   Category · Brand · Weight · **Batch** · Scanned Qty · Discrepancy Type · Status — empty.
   **Waste Inventory**: columns Product · Brand · Batch · Sub Category · Qty Waste · Date Marked ·
   Discrepancy · Type — empty. Batch is already a column in Loss Prevention; not in refill.
9. **Aging Products / Promotional Products**: a filter by "Expiry Days"; list empty today.
10. **Regions** menu item routes to `/regions`, which redirected to Orders in this session — a
    broken or role-gated link (customer data on that page; nothing recorded).
11. **Pick slips**: the refill detail's PDF downloads (box and region) are the pick slips; they
    exist only as PDF via Puppeteer and only from the detail screen.

**What it means.** The production data confirms the studies: a weekly build (11,484 units), a
daily refill of ~450–870 units, zero scan verification, zero closure, zero discrepancies
recorded. The loss-prevention half of the module is unused, so today's "every unit accounted
for" is a spreadsheet or nobody. The console's pack-verify and return-verify replace a step
nobody performs, not one they do badly.

## 2026-09-10 · answers: batch mixing, batch location

**Batch mixing:** never quiet. Any two batches of one SKU in a kit line must be **loud on the UI
and on the pick slips** for the person doing the refill. (No THC/date band; the flag is the rule.)

**Batch location:** must exist; nothing exists today. Set at receiving on the handheld. The
warehouse has many racks that can be labelled, given QR codes, etc. Owner: "design the perfect
solution for it… keep this simple, smart, intuitive and automated." Swarm dispatched: location
research + four concepts (`explorations/Batch Location - Concept A..D.html`).

## 2026-09-10 · Blaze tour (read-only, 20 min; no customer data recorded)

- **Blaze already has the inventory surfaces we are designing**: Cycle Counts (columns: date,
  inventory/location, type, blind, force-scan, employee — **no counts recorded**), Inventory
  Reconciliation, Inventory Transfers, Print Labels, Metrc Batches, Import Batches.
- **Metrc Batches** = the Metrc package per batch: Label (the Metrc tag), Quantity, Measure,
  Product, Category, **Packaged Date**, Testing State, Testing State Date. So package date and
  the Metrc tag are on the batch; **THC result is not a column here** (may be on the product's
  batch detail; unconfirmed) and **there is no storage location field anywhere**.
- **Transactions**: every sale carries a **Metrc ID** — Blaze reports each sale to Metrc for the
  Hyperwolf licence (C12-0000103). Columns: Time, Trans No., **Queue** (e.g. Delivery), **Terminal**
  (one per driver — this is the `sellerTerminalId` → subregion map the refill uses), Type (Sale),
  Employee, Member, Total, Metrc ID. Today: 68 sales/refunds, **91 adjustments/transfers**,
  6 cancellations. ASAP vs scheduled is not a visible column here; it is the `orderTags` field the
  refill filters on via the API (`common-controllers.js:125`).
- **Compliance** is a top-level menu. Leaving Blaze means replacing: per-sale Metrc reporting,
  Metrc package/batch sync, transfers between licensed locations, delivery manifests.
- Products list: name, category, brand, price, stock, vendor, flower type, product type, status.
  ~30 categories including "test data" and "2x Points!!" used as categories.

**Consequence.** The engine's batch record needs Metrc tag + packaged date (from Blaze now, from
our POS later), THC from the COA/test result (source to confirm), and storage location from our
own receiving flow, since no system holds it today.

**Floor pars (in-store):** a manager sets a fixed min/max per SKU as the base, and a **smart
system suggests modifications to the min/max from sales velocity**; **adopt the same engine for
the delivery kits** (kit template min/max get velocity-driven suggestions too). Display case vs
shelf: not chosen; treat as one floor location unless the team says otherwise.

**Blaze exit scope (owner):** everything moves into **our POS** — register, carts, orders,
inventory (batches, locations, transfers, terminals), customer accounts and loyalty, and Metrc
reporting in our own code using Stilo's pattern; **Stilo's code merges into our POS.** Payments:
**Leisurepay**, already integrated (by us and by the developers), behind an adapter.

**Cutover:** module by module with both providers running until each is proven; a pilot store
moves entirely first; a hard switch date closes out whatever remains. (Read-only shadow not
chosen as a separate step; the dual-run per module covers it.)
