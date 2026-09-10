# Batch location system — research

Owner ask (from `OWNER-NOTES.md`, 2026-09-10): nothing today records where a batch physically
sits. Warehouse has many racks, labellable or QR-codeable. Set location at receiving on a
handheld. "Design the perfect solution... simple, smart, intuitive and automated." This is
research only — no code, no screens revised here.

## 1. Location addressing

Standard warehouse convention is a **broad-to-narrow hierarchical code**, most commonly
`Zone-Aisle-Bay/Rack-Level/Shelf-Position/Bin`, e.g. `A-03-2-B` or `A-12-04-02-B` (Zone A, Aisle
12, Bay 04, Level 02, Position B) — read like a street address, narrowing left to right so an
unfamiliar person can walk straight to it ([SupplyVelocity](https://www.supplyvelocity.com/wp-content/uploads/2021/11/Lean-Warehouse-Bin-Location-Coding.pdf),
[InventoryQuick](https://inventoryquick.com/blog/warehouse-bin-location-system), [ID Label](https://www.idlabelinc.com/blog/tips-for-effective-warehouse-numbering-schemes/)).
Practical conventions that matter at small scale too:

- **Zero-pad numbers** (`01`, `02`, not `1`, `2`) so software and humans sort locations correctly
  ([ID Label](https://www.idlabelinc.com/blog/tips-for-effective-warehouse-numbering-schemes/)).
- **Reserve even numbers for aisles** (2, 4, 6…) so a new aisle can be inserted later without
  renumbering everything ([ID Label](https://www.idlabelinc.com/blog/tips-for-effective-warehouse-numbering-schemes/)).
- A **check digit** on the code lets the scanner reject a misread before it ever gets recorded as
  a real location — GS1 uses a mod-10 check digit for exactly this; a periodic label audit then
  catches damaged/missing labels before they "orphan" a slot ([Dynamics Tips](https://dynamics-tips.com/how-to-import-locations-with-check-digits/),
  [NTL Storage](https://www.ntlstorage.com/rack-location-labelling-numbering-labels-scan-range/)).
  Voice-picking systems go further and have the picker read the check digit back aloud to prove
  they're at the right spot — irrelevant here (no voice), but the underlying idea (a
  scanner-verifiable code, not a free-text label) is not.
- **Code 128** (with mod-103 check character) is the de facto standard symbology for internal
  warehouse bin/location barcodes — any standard scanner reads it, and it's compact for
  alphanumeric codes ([Camcode](https://camcode.com/blog/how-to-label-a-warehouse-rack/), general
  barcode labelling guidance above). **QR codes** are the better fit for a small operation because
  they hold more data per scan (rack ID + zone + a URL/deep-link into the app), tolerate damage
  and dirt better via built-in error correction, and are cheap to print and re-print at home
  ([Uniqode](https://www.uniqode.com/blog/asset-and-people-management/qr-codes-for-inventory-management),
  [MakeID](https://makeidstore.com/blogs/news/how-to-use-qr-codes-on-warehouse-labels-for-real-time-inventory-tracking-from-static-labels-to-smart-data-gateways)).
- **GS1 GLN** (Global Location Number) is the standards-body answer to "identify a location" —
  it can be encoded in a barcode or RFID tag and can be as granular as a single shelf; **SSCC**
  identifies a specific logistics unit (pallet/case), not a place ([GS1 GLN](https://www.gs1.org/standards/gln-data-model-solution-standard/current-standard),
  [Wikipedia GLN](https://en.wikipedia.org/wiki/Global_Location_Number)). GLN/SSCC are built for
  cross-company EDI (a location that a trading partner also needs to resolve); for one warehouse
  with no external party reading the code, adopting the full GS1 numbering scheme is unnecessary
  ceremony — the useful idea to borrow is just "a location is a first-class, uniquely-coded
  entity, not a free-text note," which a simple internal `Zone-Rack-Shelf` scheme achieves without
  GS1 registration.
- **Colour/zone coding** (a colour per product category — flower vs vape vs edible — painted or
  taped on rack uprights) is a common supplement for human wayfinding on top of the printed code;
  it doesn't replace the code, it speeds up "which rack row am I even walking toward."

**For a vault with racks (not a DC):** skip pallet-position-grade granularity. A vault's shelving
is small enough that **Zone (or Rack ID) → Shelf → Bin** (3 levels) is plenty; a 5-level DC scheme
(zone-aisle-bay-level-position) is over-engineering for racks a person can see end-to-end.

## 2. Directed vs free put-away

- **Free/random put-away**: stock goes wherever there's space; fast to execute, but "often leads
  to misplacements, errors, and a delayed picking process" and is only recommended for small or
  low-SKU-count operations ([Zoho](https://www.zoho.com/inventory/academy/warehouse-management/what-is-putaway.html), [Mecalux](https://www.mecalux.com/blog/putaway-warehouse-logistics)).
- **Directed put-away**: the system tells the receiver exactly which slot, using rules — product
  category, velocity, expiry adjacency — "before the forks lift... less travel per pallet," and
  the WMS can see the whole warehouse and consolidate partial slots better than one person
  guessing ([Zimark](https://zimark.io/knowledge-center/directed-putaway-warehouse/), [ShipBob](https://www.shipbob.com/warehouse-management/warehouse-putaway/)). Directed is explicitly
  recommended for perishable/high-turnover goods ([ShipBob](https://www.shipbob.com/warehouse-management/warehouse-putaway/)) — cannabis batches with THC decay and package
  dates are exactly this case.
- **The scan-scan-confirm loop** is the standard handheld pattern: scan the destination bin
  barcode, then scan the item, and the WMS "looks up what it expects at that point in the
  workflow, validates the scan, updates the inventory record, and sends back a confirmation or
  next instruction" — mistakes (wrong zone, capacity exceeded) are caught at that validation step,
  not discovered later ([Spartan POS](https://spartanpos.com/pages/receiving-putaway-hardware-guide)).
- **The FEFO-adjacency rule the owner wants** ("new batch goes NEXT to it, not with it") is a
  documented pattern: when the same SKU exists in multiple locations with different expiry
  dates, "thoughtful slotting — placing soonest-expiring batches in the most accessible
  locations — reduces travel time," and the system (not the picker) decides which location to
  pick from first ([BoxWise](https://boxwise.io/blog/fefo-inventory-management/), [ShipBob FEFO](https://www.shipbob.com/blog/fefo/)). The put-away analogue is: **suggest an
  adjacent-but-distinct slot** for a new batch of an existing SKU, never the same slot (which
  would physically co-mingle batches you can no longer tell apart by eye).

## 3. RFID location awareness

- **Fixed readers / portals** infer location by which read point saw a tag, but this needs
  antennas at each doorway/zone boundary — capital and installation cost a vault-scale operation
  likely doesn't want yet.
- **RFID location (beacon) tags on racks**: the practical low-cost alternative — "distributing
  beacon tags throughout a space and knowing their locations helps identify the location of
  particular item tags nearby with greater precision" ([USPTO — RFID beacon patent, summarized via search](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8258953)).
  Operationally this is: **scan the rack's RFID/QR tag, then scan the item tags placed there** —
  the read event associates item-tag → rack-tag, no fixed infrastructure needed. This matches the
  Q3 answer already in `OWNER-NOTES.md` (two handhelds, no fixed portal).
- **Honest accuracy limits**: retail RFID reads catch roughly "60–98% of tags... at each transition
  area," not 100%, due to tag orientation and tags packed close together; **best practice is
  multiple polls over time** combined with expected-inventory and sales data to reconcile, rather
  than trusting a single scan as ground truth ([USPTO — RFID positioning](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11907798)). **RF bleed** — a
  reader on one rack also picking up tags on an adjacent rack — is a known problem; the standard
  mitigation is "strongest-read" / RSSI-based disambiguation (already the approach documented in
  this estate's `rfid-middleware`), plus keeping racks physically far enough apart or shielded
  that argmax-RSSI reliably resolves which rack a tag is actually on. **Conclusion for this
  warehouse: RFID confirms and audits location; it should not be trusted as the sole
  location-of-record without a deliberate scan-in event at put-away.**

## 4. Finding things (picker wayfinding)

- **Sort the pick list by location path**, not by SKU or order — this is the single biggest
  wayfinding win: "a consolidated pick list sorted by location allows pickers to move linearly
  through the warehouse, eliminating back-tracking" ([Mecalux](https://www.mecalux.com/blog/example-picking-list), [VentorTech](https://ventor.tech/warehouse-management/how-to-build-picking-routes-in-your-warehouse-for-walking-minimization/)).
- **Pick-by-scan on a handheld** replaces paper: the device shows "the item to pick and its
  location in the warehouse," with description, quantity, and other order details on the same
  screen ([Scanbot](https://scanbot.io/blog/mobile-pick-by-scan-system/)).
- **What the pick slip/screen should carry**, applied to this warehouse: SKU + product name,
  **location path** (rack/shelf/bin), **batch number** (+ THC%/package date if the mixed-batch
  flag needs it), **quantity**, and any **flag** (mixed-batch, quarantine, new-batch-on-hand).
  This is consistent with what the owner already specified for the box card / pick slip schema
  in `REFILL-CONCEPTS.md`'s box-card rows.
- **Rack maps / photos / light-directed picking** exist in larger DCs (pick-to-light towers,
  visual rack diagrams) but are capital-heavy and built for high-SKU-count, high-volume floors;
  for a single vault, a **simple rack photo or floor-plan graphic with the zone codes overlaid**,
  shown once during onboarding, gets nearly the same benefit at near-zero cost. Light-directed
  hardware is not warranted at this scale.

## 5. Keeping it true

- **Cycle counting by location**: RFID lets staff "walk around and wirelessly read inventory from
  distance," at counting speeds far beyond manual barcode counts, and the count can be scoped to
  one zone/rack at a time rather than the whole vault ([RFID4U](https://rfid4u.com/retailers-use-rfid-to-cycle-count-inventory/), [Omniful](https://www.omniful.ai/blog/cycle-count-technology-inventory-precision)).
- **"Last seen"**: every scan (receiving, put-away, pack, cycle count) should stamp the item's
  current known location and timestamp — "the system records each item's location, timestamp, and
  movement history" ([SmartX HUB](https://smartxhub.com/rfid-inventory-management/)) — so location
  is always "as of the last scan," not a one-time write that silently goes stale.
- **Auto-update on any move scan**: a scan of an item at a new rack/box/bench should overwrite its
  last-known location automatically, not require a separate manual "update location" step —
  otherwise the location field decays into fiction the moment anyone moves stock informally.
- **Drift detection**: "handheld readers identify mislocated items by comparing tag reads against
  expected location data, flagging any item that is not where the WMS says it should be," and
  between full counts "numbers drift... RFID closes that gap" by making frequent partial reads
  cheap ([Omniful](https://www.omniful.ai/blog/cycle-count-technology-inventory-precision), [RFID Solution](https://rfidsolution.com/end-the-annual-shutdown-how-rfid-cycle-counts-turn-inventory-into-a-daily-silent-process/)). Applied here: any RFID read of a tag on a rack **other
  than** its recorded location should raise a "read where it should not be" flag, the same shape
  as the pack-verify / return-verify discrepancies already planned in `RFID-FOR-DISTRIBUTION.md`.

## 6. Cannabis specifics

- **Metrc already requires a location field per package**: "storage locations of all cannabis and
  cannabis products must be assigned in Metrc and must be updated accordingly, such as
  Floor/Vault Inventory, Display, Vault, Quality Assurance, Waste, or Quarantine" ([Metrc bulletin](https://www.metrc.com/wp-content/uploads/2022/03/NV-Bulletin-58-updated-COA-Download-New-Item-Category-Locations-for-Packages-Virtual-Transfers-Tagging-Inventory.pdf)).
  This means Metrc already has a coarse location concept (a handful of named locations) — the
  in-house system being designed here should be a **finer-grained subdivision under one of those
  Metrc buckets** (e.g. Metrc location = "Vault"; in-house location = "Vault → Rack 3 → Shelf B"),
  not a replacement or a conflicting parallel system.
- **The Metrc package tag is the natural key**: each package tag already uniquely identifies one
  batch under track-and-trace; the in-house rack/location system should **key off the same tag
  (or the RFID unit tag applied at receiving, per the owner's Q1 answer) rather than minting a
  second identifier** — this is exactly the `tagId` on `productBatches[]` already flagged as a
  developer-list item in `RFID-FOR-DISTRIBUTION.md`.
- **Split tags for split locations**: Metrc's own convention for an item stored in two places at
  once (e.g. sales floor + back vault) is to physically split the tag's top/bottom halves between
  the two locations ([Covа Software](https://www.covasoftware.com/blog/cannabis-tracking-labels-explained-rfid-package-ids-and-metrc-retail-id)) — a precedent worth mirroring conceptually: a
  batch split across two racks needs the system to record two location rows for one batch/tag,
  not force a single location field.
- **Quarantine locations**: standard inventory-quarantine practice is a **dedicated, non-reservable
  physical zone** ("Quarantine Zone A") that "system-enforced rules prevent... from being reserved,
  picked, or moved by normal fulfillment" until a clearance event, with recalled stock quarantined
  "within hours of receiving recall notification" using barcode/RFID to confirm nothing on hold
  leaks into normal flow ([Racklify](https://racklify.com/encyclopedia/the-anatomy-of-quarantine-inventory/), [SG Systems](https://sgsystemsglobal.com/guides/inventory-quarantine-system/), [ASC Software](https://ascsoftware.com/blog/recall-management-software/)). For this warehouse:
  quarantine should be **a real rack/shelf location in the same addressing scheme** (not a status
  flag alone), so a batch on hold is physically segregated and any refill/pick scan against it is
  hard-blocked by the location itself, doubling up with a status field for defense in depth.

## 7. Recommendation for this warehouse

**Addressing scheme** — three levels, human-readable, zero-padded, with a rack-level RFID/QR tag:

```
RACK-SHELF-BIN   e.g.  F2-B-03   (Flower Rack 2, Shelf B, Bin 03)
```

- Prefix racks by category to piggyback on the box-type vocabulary already in Blaze (Flower,
  Vape, Pre-Roll, Edible, Concentrate, Accessories) — `F` `V` `P` `E` `C` `A` — so a rack code
  alone hints at contents.
- Reserve one rack code per category as **Quarantine** (e.g. `Q1`), addressed the same way, so
  holds/recalls are a normal location, not a side system.
- Skip aisle/zone/bay grandeur — a vault is walkable end-to-end; 3 levels is enough, adding a 4th
  only if/when the vault outgrows single-visibility.

**Label type**: **QR code per rack/shelf position** (not per bin, to start — bin-level is the
first thing to relax if it's overkill in practice), printed on adhesive labels, holding the
location code as both human-readable text and the QR payload (a deep link into the app scoped to
that location). QR over Code128/barcode because it survives damage/dirt better, holds a
richer payload for the deep-link, and is cheap to reprint on a laminate printer already on site.

**Put-away flow on the handheld** (directed, not free): **scan batch/RFID tag → app suggests a
slot** (same category rack; if the SKU already has stock elsewhere, suggest the *adjacent* bin to
its existing batch, never the same bin — enforcing the owner's "next to it, not with it" rule) →
**clerk scans the suggested (or overridden) rack/shelf QR to confirm** → location + batch + tag
written together in one transaction, timestamped as "last seen." Any override away from the
suggested slot requires a one-tap reason (e.g. "no room"), so drift has a cause on record.

**The three screens this needs**:
1. **Receiving/put-away (handheld)** — scan tag → see suggested slot → scan slot to confirm →
   done. This is the only new screen that must exist before anything else works.
2. **Find-it / pick screen (handheld or tablet)** — pick list sorted by location path, each line
   showing SKU, batch, location, quantity, and any flag (mixed-batch, quarantine, new-batch-on-hand);
   tapping a line can show a stored rack photo for onboarding-level wayfinding.
3. **Location admin / cycle-count screen (desktop or tablet)** — rack map or list, current
   contents per location from "last seen" scans, drift/discrepancy flags (RFID read somewhere
   other than recorded), and a scoped cycle-count-by-rack action.

**What to automate vs. keep as a human tap**: automate the slot *suggestion* (category match,
FEFO-adjacency, capacity check, quarantine routing) and the location *write* (every scan updates
"last seen" with no separate manual step). Keep the final placement a **human tap-to-confirm**
against the suggested slot — this is the one moment human judgment (a rack is unexpectedly full,
a batch needs to go near a related SKU) should still override the system, and it doubles as the
scan event that makes the location trustworthy in the first place.

---
Sources cited inline above; searched 2026-09-10.
