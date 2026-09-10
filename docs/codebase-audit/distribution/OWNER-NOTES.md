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
