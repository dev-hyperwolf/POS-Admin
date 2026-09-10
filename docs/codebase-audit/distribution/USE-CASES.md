# Distribution — use cases and edge cases (spec input for the decision engine + console)

Source: `OWNER-NOTES.md` (all entries), `DISTRIBUTION-LOGIC-MAP.md` §1–§2, `RFID-FOR-DISTRIBUTION.md`
§4, `UX-REVIEW.md` §2, `pos/screen-home.jsx`, `pos/checkin.jsx`, `BOUNTY-STATUS.md` §1. Catalogue
only — no design, no code. These are candidate rules for the engine and console, not a description
of what exists today (most of it doesn't; see the other files here for gap analysis).

## 1. Actors and locations

**Actors:** receiving clerk, packer, loss prevention (LP), driver, store associate, store manager,
warehouse manager, system (decision engine).

**Locations:** receiving dock; safe/BOH (bulk storage; source for scheduled orders and floor
restock); sales floor/FOH — display case (customer-visible, few units), shelf (bulk-facing),
back counter (staging); packing bench; kit box (per driver per route; sub-boxes by category);
vehicle; LP bench; returns/quarantine; waste/destruction; transfer-out.

## 2. Daily flows (happy paths)

Each: trigger · inputs · decision · outputs · notified · automated vs. human.

### Delivery

1. **Receiving — new SKU.** Truck arrival with no prior record. Inputs: PO, product + batch data.
   Decision: create SKU and first batch. Outputs: received-ledger line "new SKU." Notified:
   warehouse manager (no template min/max yet). Automated: ledger entry, tag-commission queue.
   Human: clerk confirms count; manager sets initial min/max.

2. **Receiving — restock of a sold-out SKU.** Arrival of a SKU at zero stock. Decision: open a new
   batch under the existing SKU. Outputs: ledger line "restock." Notified: nobody, unless an
   active shortfall exists. Automated: fully. Human: count-confirm.

3. **Receiving — new batch of an in-stock SKU.** Arrival under a different batch number while stock
   remains. Decision: open the new batch, keep existing batch(es) live and unmerged; flag the SKU
   as multi-batch. Outputs: ledger line "new batch," storage-location note if it differs. Notified:
   packer/refill person, warehouse manager. Automated: ledger entry, flag. Human: clerk records
   location if different.

4. **Tag commissioning.** Any received unit. Decision: mint one RFID tag, bind 1:1 to `batchId`
   (never nullable). Outputs: a scannable unit for every downstream checkpoint. Notified: nobody.
   Automated: mint, bind, print job. Human: clerk applies the tag.

5. **Weekly kit build.** Schedule or manager action. Inputs: kit template, current stock by batch,
   driver-subregion assignments. Decision: allocate oldest-batch-first; a line spanning two batches
   is flagged `MIXED_BATCH`, never silently split. Outputs: batch-keyed plan per box/driver; a
   table of every SKU — included in N kits, or not, with reason. Notified: warehouse manager,
   packer. Automated: allocation, reasons. Human: manager approves before freeze.

6. **Daily kit refill.** Schedule, once per business day. Inputs: ASAP sales since last refill,
   current kit contents, new arrivals of all three receiving kinds. Decision: need = ASAP sold
   since last refill, capped by demand (never by prior stock limits); new arrivals pushed in too;
   oldest batch first. Outputs: delta plan per box, reasons for exclusions. Notified: packer,
   manager on shortfall. Automated: computation, allocation. Human: packer executes; manager
   resolves flagged shortfalls.

7. **Pack-verify per box.** A box is packed. Decision: reconcile RFID scan vs. plan per batch; a
   box can't be marked packed until it matches, or the packer records a reason. Outputs: match, or
   a discrepancy (missing/extra/wrong batch). Notified: packer immediately, manager if unresolved.
   Automated: scan-vs-plan diff. Human: mismatch disposition.

8. **Dispatch.** All boxes for a driver pack-verified. Decision: mark dispatched; capture timestamp
   (build + refills = dispatch baseline). Notified: driver, manager. Automated: state transition.
   Human: none.

9. **On-route.** ASAP sales post through the day; a mid-day refill or driver swap may occur.
   Decision: each sale decrements kit stock; a mid-day refill re-runs flow 6 for that driver.
   Notified: packer if a refill is requested. Automated: sale-to-kit decrement. Human: the request.

10. **Return-verify.** Driver returns at end of shift. Inputs: dispatch baseline, completed sales
    (ASAP + scheduled), RFID scan of returned contents. Decision: expected = dispatched − all sold
    + refills since dispatch; diff vs. scanned; every tag is sold, returned, or a discrepancy.
    Outputs: per-batch discrepancy list, pre-filled for LP. Notified: LP, driver if needed.
    Automated: diff. Human: LP disposition.

11. **Day close.** After return-verify. Decision: close only when every dispatched unit is sold,
    returned, or explained. Notified: manager, owner on exceptions. Automated: completeness check.
    Human: approval.

### In-store

12. **Opening count.** Store open. Decision: confirm expected floor + BOH inventory against
    overnight movement. Notified: manager on variance. Automated: diff. Human: recount/explain.

13. **Floor restock (BOH → FOH), N times a day.** Schedule or a shelf/display below par. Decision:
    move stock to floor, oldest batch first; two live batches on the floor is flagged like a kit.
    Outputs: restock ledger by SKU/batch/sub-location. Notified: associate, manager if BOH can't
    cover par. Automated: need calc, oldest-first pick. Human: physical move.

14. **New-arrival push to floor.** Any of the three receiving kinds lands at a store. Decision:
    same three-kind logic as delivery; a new batch of an already-floored SKU is flagged so
    "no back stock" is never said while missing it. Notified: associate, manager. Automated:
    flag, task generation. Human: the move, any withhold decision.

15. **Register sale.** Customer purchase. Decision: oldest batch deducted by default; associate can
    override to a named batch if the customer asks for one specifically. Outputs: sale tagged to
    the batch actually sold. Notified: nobody routine. Automated: default pick. Human: override.

16. **End-of-day.** Store close. Decision: reconcile expected floor + BOH against the day's sales,
    restocks, transfers. Notified: manager. Automated: reconciliation. Human: variance
    investigation.

17. **Cycle count.** Schedule or request, scoped by location, category, brand, velocity/ABC,
    expiry window, batch, or random spot. Decision: RFID scan of scope vs. expected. Notified:
    manager, warehouse manager on threshold breach. Automated: diff. Human: close stragglers,
    explain variance.

18. **Full count.** Schedule or repeated cycle-count variance. Decision: same mechanics at full
    scope; may require restricting sales during the window. Notified: manager, owner. Automated:
    scan aggregation, diff. Human: approval, write-off decisions.

## 3. Edge cases

Each: what happens · system default · what it asks a human · what it records.

1. **Two batches needed for one kit line.** Older batch first, newer only if insufficient. Asks:
   whether a near-identical mix can go quiet, if that band is undefined. Records: `MIXED_BATCH`
   with both batch numbers, THC, package dates.
2. **New batch stored elsewhere.** Flags the SKU so "no stock" can't be said while it exists.
   Asks: clerk to record the location. Records: batch → location, a note wherever the SKU appears.
3. **An order would mix batches within one line.** Fills single-batch by default; only spans
   batches if unavoidable, flagged either way. Asks: substitute, split, or hold — a person decides.
   Records: the mix and reason.
4. **Batch approaching expiry.** Ladder: hold new allocation → promote to front of FEFO → quarantine
   → destroy at expiry. Asks: manager to confirm promote vs. quarantine when ambiguous. Records:
   every transition with timestamp and reason.
5. **Batch recall.** Locate every unit by tag across every location; halt further allocation.
   Asks: manager/owner to confirm retrieval and disposition. Records: full retrieval list, outcome
   per unit.
6. **Damaged or opened product.** Moves to quarantine/waste immediately, removed from sellable
   count. Asks: whether it's chargeable. Records: unit, batch, location found, reason, disposition.
7. **Short stock split across drivers.** Proportional to subregion demand, oldest batch first;
   never silently zeroes a subregion. Asks: manager on ties or a floor breach. Records: allocation
   and shortfall reason.
8. **Customer return, delivery.** Driver receives it back tagged; held from sellable stock pending
   inspection. Asks: LP for sellable vs. quarantine. Records: return tied to original sale, batch,
   disposition.
9. **Customer return, in-store.** Associate scans at register/back counter; held, not returned to
   floor automatically. Asks: manager for restock vs. destroy. Records: same as delivery return.
10. **Driver returns unsold scheduled orders.** Returns to safe/BOH, not floor logic; still counted
    in return-verify. Asks: nothing routine. Records: return against the scheduled-order line.
11. **Extra tag found on a scan.** Box/return held from completion. Asks: packer/LP for a reason
    (misrouted, wrong box, stray). Records: extra tag, its batch, expected vs. found location.
12. **Tag missing at pack-verify.** Box can't be marked packed. Asks: rescan, search, or record a
    reason. Records: expected-but-absent tag, reason, resolution.
13. **Tag reads in the wrong box.** Reported as a location correction, not a shortfall, once
    confirmed. Asks: packer to confirm the move or correct a misread. Records: before/after state.
14. **Tag with no batch bound.** Data-integrity discrepancy; held out of any plan. Asks: receiving
    to re-derive and re-bind. Records: orphan-tag event, resolution.
15. **RFID reader down.** Falls back to barcode/manual count with a reason code; nothing blocks
    indefinitely. Asks: confirm fallback mode. Records: outage window, which checkpoints fell back.
16. **Internet down at the bench.** Local queue of scans, synced on reconnect, idempotent (no
    duplicate posts). Asks: nothing automatic. Records: offline window, queued events, sync result.
17. **POS (Blaze or ours) is down.** Build/refill/sale proceed on last-known data with a "stale as
    of" marker; no destructive write queues until confirmed. Asks: manager to proceed or wait.
    Records: outage window, which decisions used stale data.
18. **Sales data lags.** Refill/return-verify need is recomputed when the late sale lands; never
    silently ignored. Asks: nothing unless a threshold already acted on is crossed. Records:
    original vs. corrected figures.
19. **Product renamed/re-ID'd in the POS.** Joined on a stable internal key, SKU as fallback only;
    a rename can't orphan batches or open counts. Asks: confirm the mapping if ambiguous. Records:
    old-ID → new-ID mapping and batches carried forward.
20. **Refill requested twice, same driver/day.** Idempotent; second request computes near-zero
    delta. Asks: nothing. Records: both requests, second shows "already run" plus any real delta.
21. **Refill run after midnight.** One business-day boundary decides attribution, not run time.
    Asks: nothing. Records: which business day the run counted toward.
22. **Driver's kit swapped mid-day.** Kit identity (boxes, tags) moves with it, not the driver;
    tracking follows the kit. Asks: dispatcher to confirm. Records: swap time, both drivers, kit ID.
23. **Vehicle breakdown mid-route.** Ownership doesn't change until physically moved; a transfer to
    a new vehicle/driver is edge case 22; an unsold return to base is an early return-verify.
    Asks: dispatcher for the recovery plan. Records: interruption and resolution.
24. **Inter-store transfer.** Transfer-out at source, a "transfer" receiving event at destination
    (not new/restock/new-batch); batch identity preserved. Asks: manager approval both ends.
    Records: transfer manifest by batch and tag.
25. **Store-to-delivery-hub transfer.** Same mechanics as inter-store; destination is a kit-building
    hub, not a sales floor. Asks: manager approval. Records: manifest, ledger shows "transfer."
26. **Samples and promo giveaways.** Distinct disposition, not a sale or a return; own reason code
    so it never reads as shrink or revenue. Asks: manager approval above a threshold. Records:
    unit, batch, purpose.
27. **Employee purchases.** Normal sale tagged employee-purchase for reporting; oldest-first still
    applies. Asks: manager approval if discounted. Records: sale tagged accordingly.
28. **Count variance beyond threshold.** Holds the location/SKU from further automated allocation.
    Asks: manager to investigate, adjust, or escalate as shrink. Records: variance amount, outcome.
29. **Counting during operating hours.** A partial count shouldn't block sales; in-flight sales
    during the window are reconciled, not treated as discrepancies. Asks: whether to restrict sales
    on counted SKUs. Records: window bounds, in-window sales and their reconciliation.
30. **Unit reads on the floor via RFID but was already sold.** Tag-not-decremented discrepancy, not
    found inventory; held from resale until resolved. Asks: manager to confirm which record is
    wrong. Records: both events, resolution.
31. **Shrink.** Only declared after the full chain (missing at count, no sale/return/transfer/
    destruction match) is exhausted. Asks: manager/LP to confirm before booking. Records: the
    ruled-out chain.
32. **Batch with no THC data.** Mixed-batch flag falls back to batch number and package date only.
    Asks: nothing automatic; flagged for data completeness. Records: SKU/batch missing THC.
33. **Weight-based (deli-style) product**, if any exists. Batch/tag model applies to the source
    container; a sold sub-quantity deducts from its running weight. Asks: whether such SKUs exist
    at all (§5). Records: running weight per container/batch.
34. **Pre-orders.** Reserved against a specific batch only once that batch is confirmed in stock;
    otherwise a demand signal, not an allocation. Asks: manager if unfillable by the promised date.
    Records: reservation state and resolution.
35. **Multi-store price/batch differences for one SKU.** Pricing and availability are per-store;
    the system should say why "the same" SKU differs (different receiving history). Asks: nothing
    routine. Records: per-store batch/price snapshot at query time.
36. **New box type added mid-week.** Existing templates keep their current composition; the new
    type applies to the next build or an explicit manual add. Asks: manager whether to apply it to
    in-progress kits. Records: box-type change log with effective date.
37. **Template edited after the build already ran.** Affects the next cycle only; the system states
    which template version a given build/refill used. Asks: nothing unless it conflicts with an
    in-flight plan. Records: template version history.
38. **A store/subregion missing from today's assignment.** Not selectable for allocation; the plan
    says so explicitly rather than silently omitting it. Asks: manager to confirm intent. Records:
    the gap and reason.
39. **A discrepancy recurs for a unit already under an open discrepancy.** Linked as one lifecycle
    per tag, not a second unrelated case. Asks: nothing automatic; LP confirms the link. Records:
    linked history per tag.
40. **Count requested mid-restock** (units in transit BOH↔FOH). System names in-transit units
    separately so they're neither double-counted nor missed. Asks: nothing routine. Records:
    in-transit units at count time, resolved against pre/post ledgers.
41. **Recalled batch already sold to a customer.** Surfaces on the retrieval list as "sold —
    contact required," not dropped because it's no longer in inventory. Asks: manager/compliance
    for the contact/remediation process. Records: sale record linked to the recall.
42. **Two clerks commission tags for the same batch concurrently.** 1:1 binding enforced by
    compare-and-set at commissioning; a duplicate mint is caught immediately, not later at a scan.
    Asks: clerk to resolve on the spot. Records: the rejected duplicate attempt.

## 4. Cross-cutting rules

- **Batch rotation:** FEFO (expiry, then received date) applied identically to kit allocation,
  floor restock, and register-sale defaults.
- **No silent batch mixing:** any line/box/sale spanning more than one batch carries a `MIXED_BATCH`
  reason and the batch identities involved — never resolved invisibly.
- **Every unit sold, returned, or explained:** identity is per-tag; anything unaccounted for is a
  discrepancy with a reason, not a rounding error.
- **One business day, one clock:** a single day boundary, in the business's real timezone, shared
  by build, refill, restock, and closure.
- **One "sold" definition per channel:** ASAP drives kit refill; register sales drive floor
  restock; scheduled sales count only for loss-prevention/return-verify, never for refill need.
- **Reasons on every decision:** every inclusion, exclusion, hold, mix, or skip carries a
  human-readable reason and its source data — never a bare skip.
- **Provider-agnostic POS:** every rule is expressed against a `PosProvider` contract (products,
  batches, inventory by location, sales, transfers) so the engine runs unchanged with Blaze today
  and an in-house POS after the exit.

## 5. Open questions for the owner

**Delivery**
1. What THC-percentage/package-date proximity counts as "near-identical enough to mix quietly"
   versus raising `MIXED_BATCH`?
2. Does a mid-day refill re-run full daily-refill logic for one driver, or only cover the reported
   shortage?
3. Is a second RFID reader or fixed portal planned for the return dock, or does return-verify stay
   single-handheld indefinitely?

**In-store**
4. What par levels govern floor restock per SKU, and do display case and shelf get separate pars?
5. Can an associate restock the floor from anywhere other than that store's own BOH?
6. What variance threshold escalates a cycle count to the store manager versus a routine
   adjustment?
7. Does weight-based (deli-style) product exist anywhere in the current or planned catalog?

**Both**
8. Where is a batch's physical storage location recorded today, and who keeps it current?
9. Do batch records carry THC result and package date as queryable fields, or only batch number?
10. Is tagging receiving-only, or does packing-time commissioning need support for any product
    class?
11. Is tag-to-unit always 1:1, or do sealed cases need case-level tagging?
12. What is the real execution cap and retry policy once the POS/RFID stack runs unattended, for
    checkpointing refill and return-verify jobs?
13. Who approves a recall's disposition, and does it differ between dispatched and floor-sold units
    of the same batch?
14. Are samples/promo giveaways and employee purchases excluded from revenue reporting entirely?
15. Is there a reconciliation cutover point during the Blaze exit, or a hard switch date?
