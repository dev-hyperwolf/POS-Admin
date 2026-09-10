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
