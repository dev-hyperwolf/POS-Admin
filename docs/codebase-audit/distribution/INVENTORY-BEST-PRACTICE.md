# Inventory best practice — what mature systems do, and what we should borrow

Research memo for the Distribution/RFID redesign. Sources are large-scale WMS/retail platforms
(SAP EWM, Oracle, license-plate-based WMS practice generally), cannabis-specific platforms
(Flowhub, Dutchie, Distru), and California's own Metrc/DCC material. Every claim below is cited
inline; nothing here is a code change or a commitment — it's raw material for the next design
round, to be read alongside `OWNER-NOTES.md` and `DISTRIBUTION-LOGIC-MAP.md`.

## 1. Location model: sites → zones → bins, license plates, unit identity + lot

Mature WMS (SAP EWM is the clearest public reference) model a warehouse as a strict hierarchy:
**warehouse number → storage type → storage section/activity area → storage bin**, where the bin
is "the smallest spatial unit... the exact storage position of a product," often a coordinate like
aisle-stack-level ([SAP Help — Storage Bin](https://help.sap.com/docs/SAP_EXTENDED_WAREHOUSE_MANAGEMENT/3d97bec9bf1649099384bb8167df3cf2/55c8cb53ad377114e10000000a174cb4.html);
[SAP Learning — Defining the Warehouse](https://learning.sap.com/courses/basic-customizing-in-sap-s-4hana-ewm-zh/defining-the-warehouse)).
A storage type is "a physical or logical subdivision... characterized by warehouse technologies,
space, organizational form, or function" — this is exactly the abstraction that lets "a kit box"
and "a shelf" and "a safe" all be the same kind of thing without being the same physical fixture.

On top of bins, mature systems add **license plates (LPNs)**: a unique ID stuck on a *container*
(pallet, tote, carton, box) that lets the system move, count, and pick the whole container as one
entity without re-scanning every unit inside it, while the LPN itself carries "item numbers,
quantities, lot numbers, expiration dates, and storage locations" as attributes
([Softeon — LPN glossary](https://www.softeon.com/glossary/license-plate-number-lpn/);
[RFgen — License Plating](https://www.rfgen.com/solutions/license-plating/)). This is the concept
that cleanly generalizes "kit box" — a kit is a license plate: it has a location (with a driver,
in a vehicle), a manifest of unit-tag-to-batch contents, and it can be dispatched, returned, and
recounted as a unit without walking through every SKU each time.

Beneath the container, unit-level identity is the RFID tag; above the tag sits the **lot/batch**
(what expires, what has a THC value, what was received together). This three-layer model —
*location* (bin or container) → *container/LPN* (kit box, tote, shelf facing) → *unit* (tag) →
*lot* (batch) — is the same shape SAP, Oracle, and license-plate WMS vendors converge on, and it
is materially different from a flat "quantity per SKU per store" table.

**Minimal, future-proof model for us**: a `Location` table (type: safe / sales-floor / kit-box /
vehicle / loss-prevention-bench / returns-bin), a `Container` table for anything that moves as a
unit (a kit box is a container inside a vehicle location; a shelf facing can also be a container
if we ever need to reserve shelf space), a `Unit` per RFID tag with `currentLocationId` and
`batchId`, and a `Batch` carrying `sku`, `batchNo`, `purchaseDate`, `expirationDate`, `thc`, and
(per Owner Notes 2026-09-10) a `storageLocation` field that does not exist in `ProductBatch`
today. Every movement (receiving, kit build, dispatch, refill, sale, return) is one row in a
`Movement` ledger: `unitId, fromLocationId, toLocationId, reason, timestamp, actor`. This is the
same pattern SAP calls a "warehouse task" and is what makes "every unit accounted for" provable
after the fact rather than asserted.

## 2. Replenishment: reorder methods, demand-driven, top-off vs. wave, avoiding the ratchet

**Min/max and reorder point (ROP)** are the baseline: "you specify a trigger level — usually
demand during lead time plus safety stock — and a target level... when inventory dips to the ROP,
the system creates an order to bring stock up to the target"
([Cleverence — Retail replenishment strategies](https://www.cleverence.com/articles/for-business/retail-replenishment-strategies-4827/)).
Min-max is easy to run but only works "in environments where demand patterns are stable and
predictable" — true for our C-items, not for a fast-moving flower SKU.

**Demand-driven replenishment** replaces the fixed trigger with a live forecast: "demand-driven
min–max extends ROP by dynamically setting min and max based on forecasted demand over your review
and lead-time windows," and stock cover (days before stockout) is computed continuously from sales
velocity ([Onebeat / impactanalytics summary via Cleverence](https://www.cleverence.com/articles/for-business/retail-replenishment-strategies-4827/)).
Mature retailers "rarely treat store replenishment as a binary choice between Min-Max and
demand-based models... instead they adopt a hybrid that aligns logic with category behavior" — the
same conclusion the owner is reaching independently (ASAP-sales-since-last-refill for kits, a
different rule for the sales floor).

**"Top-off" vs "wave"**: top-off is small, frequent, per-container replenishment triggered by a
threshold (what a kit refill or a sales-floor restock several times a day already is); a wave is a
scheduled, batched replenishment run across many locations at once (what a weekly kit *build* is).
Both patterns are legitimate — the mistake is running a wave-shaped process (weekly template) for
a top-off-shaped problem (daily kit refill), which is close to what the current
`kit-refill-controller.js` does today per `DISTRIBUTION-LOGIC-MAP.md` §3.

**Priority for new arrivals**: none of the general-purpose sources treat "newly received stock" as
a special queue by default — it is simply supply that raises available-to-promise and should be
evaluated by the same reorder/demand logic immediately, not queued alphabetically or held for the
next scheduled wave. That is the direct fix for Symptom 1 in `DISTRIBUTION-LOGIC-MAP.md` §2: a
receiving event should trigger an on-demand top-off evaluation for every destination the SKU
serves, not wait for the next wave.

**Avoiding the "cap ratchets down" trap**: this is a self-inflicted defect specific to this
codebase (recording *quantity actually handed out* as next cycle's cap — `kit-refill-controller.js
:1307-1308`), not a pattern any cited system uses. The general-purpose fix from the ROP literature
is to always compute demand independently each cycle (sales since last replenishment, uncapped by
history) and treat "we couldn't fulfill it" as a *shortage event* to log, never as a new ceiling.

**Two channels drawing on different stock**: this is the licence-plate/location model doing its
job — ASAP sales draw down the kit-box location, scheduled sales draw down the safe location, and
the two locations reorder independently against their own consumption. This is exactly what the
owner already confirmed is correct in `OWNER-NOTES.md` (2026-09-10, "Q2" entry) and matches how
warehouse zones with different pick sources are treated as independent replenishment domains in
general WMS practice, not a special cannabis rule.

## 3. Lot rotation: FEFO vs. FIFO, mixing, and forcing depletion

**FEFO** ("First Expired, First Out") "prioritizes items by their actual expiration dates or
remaining shelf life" rather than by receipt order, and is the standard for perishables and
anything with a real expiry ([ShipBob — FEFO guide](https://www.shipbob.com/blog/fefo/);
[Extensiv — FEFO](https://www.extensiv.com/blog/what-is-fefo-first-expired-first-out)). FIFO
(receipt-date order) is the fallback when items don't carry a meaningful expiry, or as the
tie-break when two batches expire on the same date — which maps directly onto the owner's "oldest
batches cleared first" instruction (`OWNER-NOTES.md`, 2026-09-10 "oldest first" entry): expiry
first, received date as tie-break, is standard FEFO-with-FIFO-tiebreak, not a bespoke rule.

Best-practice sources emphasize **capturing expiry at receiving** and building pick logic that
"routes staff straight to the nearest-to-expiration item" automatically
([ASC Software — FEFO guide](https://ascsoftware.com/blog/fefo-inventory-management-guide/)) —
i.e., the system should default to FEFO without requiring a picker to check dates manually. None
of the general retail/WMS sources found treat "don't mix lots in one order" as a first-class rule;
that requirement is specific to our situation (THC% and package date make two batches of one SKU
materially different to a cannabis customer) and is already correctly identified as an engine rule
in `OWNER-NOTES.md` (2026-09-10, "MIXED_BATCH" entry) rather than something to borrow externally —
it should be kept as a cannabis-specific addition on top of standard FEFO, not softened to match
generic retail (which usually doesn't care which carton of the same SKU a customer receives).

**Flagging a new lot arriving while an old lot is still on the floor**, and **forcing old-lot
depletion**, are the direct translation of FEFO enforcement into a receiving/allocation workflow:
receiving a new batch of an already-stocked SKU should (a) never silently blend into the old
batch's on-hand count, and (b) should not be eligible for picking/kitting ahead of the older batch
unless the older batch is below a defined exposure threshold (e.g., under N units or under N days
of cover) — this is the "block new-lot picks until old lot is below threshold" pattern the task
description names, and it is a natural extension of FEFO enforcement described generically as
"regularly check and reposition inventory to prioritize products with earlier expiration dates"
([ShipBob — FEFO guide](https://www.shipbob.com/blog/fefo/)), tightened here into a hard gate
because of the mixed-batch customer-experience risk that generic FEFO literature doesn't address.

## 4. Cycle counting: ABC, blind counts, thresholds, RFID accuracy, audit trail

**ABC classification** drives count frequency: "A items represent the top 10-20% of items by cost
or criticality and should be counted weekly or monthly... B items... quarterly... C items...
annually or only when discrepancies occur," and "world-class operations achieve 98-99% inventory
accuracy through proper implementation of ABC-based cycle counting"
([GetOneCart — Cycle Counting Inventory](https://www.getonecart.com/cycle-counting-inventory/);
[Oracle — Cycle Count Criteria](https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26a/famml/cycle-count-criteria.html)).
For us: fast-moving flower/vape SKUs and anything near expiry should be A-class regardless of
dollar value, since the compliance and spoilage risk is time-based, not just cost-based.

**Blind counts** ("no on-screen expected quantity") are recommended for "any count with financial
significance" because they "catch 20-30% more discrepancies than informed counts," with a common
hybrid of "blind first pass for A's, directed for B/C"
([Cleverence — Cycle Count and Packing](https://www.cleverence.com/articles/business-blogs/cycle-count-packing-5273/)).

**Variance thresholds and recounts**: "any variance above roughly 2-3% of on-hand quantity, or any
variance on an A-class SKU, triggers an immediate independent recount by a second counter,"
escalating from supervisor review at 2-10% to freezing the location and an investigation checklist
above 10% ([Cleverence — Cycle counts warehouse](https://www.cleverence.com/articles/for-business/cycle-counts-warehouse-5837/)).
This is a direct, adoptable pattern for our discrepancy queue: auto-recount below threshold,
auto-escalate to a human above it.

**RFID cycle counts and perpetual inventory**: retailers using item-level RFID report accuracy
rising from an industry-typical 65-75% (barcode/manual) to 95-99%+
([Zebra/Nike infographic](https://www.zebra.com/content/dam/zebra_dam/en/infographic/retail-infographic-nike-abm-en-us.pdf);
[Senitron — RFID inventory accuracy](https://senitron.net/blog/how-rfid-revolutionizes-inventory-accuracy-in-retail-e-commerce/)),
and throughput studies show roughly a 20x speedup — one comparison found "10,000 items took two
hours [with RFID] vs. 53 hours with barcode... a 96% reduction in cycle-counting time"
([Lowry Solutions — Measuring the Impact of RFID](https://lowrysolutions.com/blog/measuring-the-impact-of-rfid-in-retailing/)).
A **perpetual inventory system** uses "fixed RFID readers and antennas... constantly counting the
flow of inventory" rather than periodic sweeps (same source) — the fixed-reader version is the
long-term aspiration; a handheld "wave" count (walk the floor, read everything, reconcile) is the
realistic near-term step and is what the owner's pack-verify/return-verify design already assumes
(`OWNER-NOTES.md`, 2026-09-10 RFID entries).

**Reconciling RFID reads vs. system quantity**: read count becomes the count-in-hand; the system
computes the delta per SKU/batch/location and files it as a discrepancy for review rather than
auto-adjusting silently — the same pattern as the variance-threshold rule above, just with the
"count" being a machine read instead of a person with a clipboard.

**Audit trail**: every count (manual or RFID), every recount, every adjustment approval needs an
actor, a timestamp, and a before/after quantity — this is table stakes across every WMS source
above and is also what Metrc examiners expect to see reflected in the *state* system: California
requires a full physical reconciliation of on-site inventory against the track-and-trace system
"at least once every 30 calendar days"
([cannabis.ca.gov — CCTT overview via search summary](https://www.metrc.com/wp-content/uploads/2021/10/CCTT_FAQ_5.8.19.pdf)),
so our internal cycle-count audit trail is also the evidence base for that regulatory reconciliation.

## 5. Exceptions and automation: what to automate, what stays human

**Automate without a human**: generating a replenishment/top-off task the moment stock crosses a
threshold; evaluating every newly received batch against every destination it supplies the moment
it's logged (fixing Symptom 1); auto-flagging a mixed-batch condition on a kit line; auto-creating
a discrepancy record the instant an RFID read disagrees with the expected plan (pack-verify) or
the expected return baseline (return-verify); auto-recounting below the variance threshold. These
are exactly the "auto-replenish tasks, auto-flag new arrivals, auto-hold expiring lots,
auto-discrepancy creation from reads" the task description names, and each maps to a rule already
half-specified in `OWNER-NOTES.md`.

**Always keep a human**: approving an inventory adjustment or write-off (a system should propose
the number, never post it unattended); resolving a variance above threshold; deciding to override
a FEFO block (e.g., intentionally selling a newer batch first for a legitimate reason); closing a
day's reconciliation. This split — machine detects and proposes, human approves anything that
changes the books or overrides a compliance-relevant rule — mirrors both the general
cycle-count-recount pattern in §4 and the DCC's own posture (Metrc requires the *licensee* to
reconcile and attest, not an automated system to self-correct silently).

**Exception queue pattern**: this is functionally identical to what a WMS calls "put-away/pick
exceptions" — a persistent, filterable worklist of "this didn't match" events (mixed batch,
below-threshold refill, RFID mismatch, expiring-soon lot) that a human works down, versus a
transient toast/alert that can be missed. Concept C is the right shape; the addition worth pulling
from the received-ledger design in `OWNER-NOTES.md` (2026-09-10) is that the queue should be a
*subset view* of a complete received/verification ledger, not the only record of what happened —
so "included in 6 kits" items are still visible and auditable, not just the exceptions.

## 6. Cannabis compliance: what Metrc/DCC require, and what falls to us if we leave Blaze

- **Package tags**: "all cannabis and cannabis products on licensed premises must be assigned a
  plant or package tag... for batches held in containers, the package tag shall be affixed to the
  container holding the batch, and if held in multiple containers, other containers shall be
  labeled with the applicable UID number," and tag receipt must be recorded in Metrc "within three
  calendar days of receipt"
  ([Distru — Metrc California](https://www.distru.com/metrc/california)). A pending DCC rulemaking
  (comment period closed July 2026) would allow *group tagging* for cultivation plants, but current
  law still requires the existing per-batch/per-container tagging until adopted
  ([Beard Bros Pharms — DCC group tagging notice](https://beardbrospharms.com/articles/california-dcc-posts-group-metrc-tagging-rulemaking-notice-heres-what-to-know-for-deadlines-today/)).
- **Transfers between licensed locations**: "transfer manifests must be created before product
  leaves the origin facility and closed by the receiving facility within 24 hours of delivery,"
  covering shipper/recipient license details and a planned route with delivery dates; voiding a
  manifest after departure is a violation of BCC §5314
  ([Distru — Metrc Transfer Manifests](https://www.distru.com/cannabis-blog/metrc-transfer-manifests)).
  Late manifest closure escalates from a written warning to $5,000–$15,000 per occurrence on repeat
  violations within 90 days (same source).
- **Delivery manifests**: separate from B2B transfers — a direct-to-consumer delivery ledger needs
  "the delivery employee's name, employee ID, driver's license number, the delivery vehicle's make,
  model and license plate number, and the UID(s) assigned to cannabis goods with unit counts"
  ([Distru — Metrc Transfer Manifests](https://www.distru.com/cannabis-blog/metrc-transfer-manifests);
  DCC's own delivery record-keeping page:
  [cannabis.ca.gov — Record-keeping/track-and-trace requirements for deliveries](https://www.cannabis.ca.gov/licensees/cannaconnect-compliance-hub/new-record-keeping-track-and-trace-requirements-for-deliveries/)).
- **Sales reporting**: retail sales must be reported into Metrc (this is what Blaze/Dutchie/Flowhub
  do automatically today — "Dutchie POS's real-time Metrc integration... automatically reports
  actions performed in Dutchie POS to Metrc"
  ([Dutchie Help Center — POS-Metrc overview](https://support.dutchie.com/hc/en-us/articles/12882294265107-Dutchie-POS-Metrc-overview))).
- **Adjustments/reconciliation**: all annual/provisional licensees must reconcile on-site inventory
  against their track-and-trace account **at least every 30 calendar days**
  ([Metrc CCTT FAQ, via cannabis.ca.gov program](https://www.metrc.com/wp-content/uploads/2021/10/CCTT_FAQ_5.8.19.pdf)),
  and must complete Metrc credentialing and order initial tags within 10 days of licensure (same
  source) — not relevant to ongoing ops but confirms the state's posture that the *licensee*, not
  the POS vendor, is the accountable party.

**What falls to the operator if Blaze is left**: today Blaze is very likely the system of record
performing the real-time package-tag lifecycle, transfer-manifest creation/closure, delivery
manifest generation, and per-sale Metrc reporting — i.e., all five bullets above. If Blaze exits,
whatever replaces it (the in-house `HyperwolfPosProvider` per `OWNER-NOTES.md`'s `PosProvider` port
plan) must independently: create/close transfer manifests within the 24-hour window, generate
compliant delivery manifest data per vehicle/driver, push every completed sale to Metrc in
near-real-time, and support the 30-day reconciliation — none of that is optional or something a
generic inventory system (SAP/Oracle/etc.) does out of the box, since it is a California-specific
regulatory API. **This is the single biggest compliance risk of leaving Blaze**: losing (even
temporarily) the automatic, real-time Metrc reporting pipeline, which if it lapses is a direct and
escalating regulatory exposure (the $5,000–$15,000-per-occurrence range cited above is for manifest
timing alone; failure to report sales or reconcile inventory carries its own citation/suspension
risk per DCC's compliance materials).

## 7. Recommendations for us

**Adopt:**
1. **Location + license-plate (container) + unit-tag + batch model** (§1) — because it is the only
   model that expresses "a kit box is also a location" and "every unit accounted for" without
   special-casing kits, shelves, and safes as different systems.
2. **Demand-driven, uncapped-by-history replenishment per destination** (§2) — because it is the
   direct structural fix for both the "cap ratchets down" bug and the "premium product sits for a
   week" symptom already diagnosed in `DISTRIBUTION-LOGIC-MAP.md`.
3. **FEFO with received-date tie-break, plus a hard mixed-batch flag and an old-lot exposure gate**
   (§3) — because it satisfies the owner's "oldest first" and "100% certainty" requirements in one
   rule set, and the mixed-batch/exposure-gate addition is the cannabis-specific tightening this
   business actually needs beyond generic FEFO.
4. **ABC/velocity-driven cycle counts with blind counts for A-items and a numeric variance→recount
   escalation ladder** (§4) — because it is a proven, off-the-shelf policy that directly produces
   the "full cycle counts by location and by many filters" the owner asked for, without inventing
   anything new.
5. **The exception-queue-as-a-view pattern, backed by a complete received/movement ledger** (§5) —
   because it keeps Concept C's UX while satisfying "100% certainty about every received product,"
   which a pure exception list cannot do on its own (it only shows the abnormal cases).

**Avoid:**
- **Whole-function retry / wave-only replenishment for time-sensitive restocks** — top-off/demand-
  driven logic exists precisely because wave-only (weekly template) replenishment is what produced
  Symptom 1; don't reintroduce it under a new UI.
- **Cost-only ABC weighting** — a pure dollar-value ABC classification would under-prioritize fast-
  turning, low-margin flower SKUs that are exactly what needs FEFO discipline; weight by
  velocity/expiry risk too, not just unit cost.
- **Auto-adjusting book quantity from an RFID read without a human approval step** — every source
  in §4 treats a machine count as a *proposed* reconciliation, not a silent write; keep that line,
  especially given Metrc's 30-day reconciliation is a regulator-facing attestation.
- **Building our own Metrc reporting as an afterthought late in the Blaze exit** — §6 shows this is
  the single largest compliance surface Blaze currently absorbs; it needs its own workstream and
  timeline, not a bullet on the `PosProvider` port ticket.

---
*Compiled 2026-09-10. No code was changed; no files outside this one were written.*
