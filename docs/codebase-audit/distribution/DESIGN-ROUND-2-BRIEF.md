# Design round 2 — shared brief for every concept agent

Read this whole file, then `OWNER-NOTES.md` (all entries; the owner's words are the rules),
`DESIGN-BRIEF.md` (the 14 ranked changes), `USE-CASES.md` §2 (flows) and §3 (edge cases for
your screen), and `INVENTORY-BEST-PRACTICE.md` §4–§5 for counts and exceptions.

## Rules for every mockup
- ONE self-contained HTML file per concept in `/Users/jt/POS-Admin/explorations/`, named
  `<Round> - Concept <X> - <Name>.html`. Inline CSS/JS only, no external scripts or fonts, renders
  from file:// and from a static server. Under 750 lines. Interactions must work.
- Style: copy values inline from `/Users/jt/POS-Admin/pos/tokens.jsx`, `/Users/jt/POS-Admin/shared/hd-ui.jsx`,
  and the rail/header shell of `/Users/jt/POS-Admin/Hyperwolf Bounty.html` (rail active
  "Distribution"). Light and dark both readable (prefers-color-scheme + a toggle). A small banner
  says every name, product, quantity and time is EXAMPLE data. Footer: "<Round> — Concept X of 4 — <Name>".
- **Keepers, reproduce their look** (read the CSS of these two files): the kit column from
  `explorations/Distribution Refill - Concept B - Box Cards.html` (vertical timeline · driver card
  with boxes-packed bar · colour-coded box cards with PRODUCT · SOLD · NEED · CAP · GIVE · REASON
  rows · amber shortfall rows · box-type legend · "Manage box types"); and the box panel from
  `explorations/Distribution Refill - Concept D - Tablet Packing.html` (box breadcrumb, big
  −/+ steppers, amber reason row with Fix, full-width green "Box packed").
- Vocabulary: Region → Kit (one per driver, "Marcus R. · Route 3") → Boxes (Flower Box 1, Pre-Roll
  Box 2, Vape Box 1, Cooler, Concentrate Bin 1, Edible Bin…). Locations use a three-level address
  (F2-B-03: rack, shelf, bin). Never invent codes like "Sub-4B". Stores have back of house (the
  safe) and front of house (the sales floor).
- Batches: one RFID tag per unit recorded to the batch at receiving; THC typed from the product's
  batch label at receiving; two batches of one SKU in a kit line are **LOUD** (red, both batch
  numbers, THC, packaged dates) on screen and on the pick slip; oldest batch first, always.
- Two sales streams: ASAP orders come from the kit (drive refill); scheduled orders come from the
  safe (loss prevention only). Register sales drive floor restock.
- Counts: RFID reads and hand counts **propose**; a variance above a threshold triggers a blind
  recount by a second person; **nothing adjusts stock until a manager approves**.
- Every decision carries a plain-words reason; skips are shown, never silent.
- Paper first: the team works from printed pick slips today and will move to iPads. Any screen
  that has a paper equivalent shows the printed version too (same lines, same flags, a QR per kit
  or per count sheet to close it by scan).

## Rounds and concepts

### Round "Cycle Count"
A — **Walk the Location**: pick a location (or a filter: category, brand, velocity/ABC, expiry
window, batch, random spot), the count sheet lists what the system expects by batch, blind mode
hides expected; enter counted with big steppers; variance column; the recount-then-approve ladder
as a stepper at the top; printable count sheet with QR.
B — **RFID Walk the Vault**: walk with the handheld, racks light as they are read, a live "read vs
expected" per location with drift (a batch read where it should not be); at the end, a proposal
list the manager approves; nothing writes.
C — **Variance Desk**: the manager's view: every open count session, variances ranked by value
and units, who counted, recount status, approve/reject per line with a reason; a trend of
accuracy per location and per counter; thresholds editable.
D — **Count While Open**: a store counting during trading hours: a count window per location,
sales that happen during the window reconciled automatically, associates count one shelf at a
time between customers; the shelf shows "counted 12 min ago" chips.

### Round "Verify"
A — **Pack-Verify on the Tablet**: the box panel keeper gains a "Scan box" step: read result per
batch vs plan, mismatch rows (missing / extra / wrong batch / wrong box), record a reason or fix,
box cannot be marked packed until it matches or a reason is recorded.
B — **Return-Verify at the LP Bench**: a kit comes back: expected (dispatched + refills − ASAP
sold − scheduled sold) vs read, per batch; the driver's closeout beside it; every dispatched tag
ends as sold, returned or a discrepancy with a reason; one case per tag across days.
C — **The Verify Timeline**: one screen per kit for the whole day: built → pack-verified →
dispatched → refilled → pack-verified → returned → return-verified → closed, each with who, when,
and the read result; discrepancies attached where they happened.
D — **Paper First**: the printed pick slip as the primary artifact: box order, batch numbers,
THC, packaged date, the LOUD mixed-batch flag, a QR per kit; the console prints it, the bench
closes it by scanning the QR; the same lines shown on the tablet for the trained team, with a
"paper / tablet" switch per station.

### Round "Store"
A — **Floor Restock**: safe → shelf, several times a day: per shelf, SOLD (register) · ON SHELF ·
PAR · WILL MOVE · REASON, oldest batch first, the loud flag when a second batch would join a
shelf, one "Move to floor" commit, printable restock slip.
B — **New Arrivals to the Floor**: the store's received ledger: today's arrivals in three kinds
with disposition (on floor / in safe / why not), one-tap "put out now"; premium ages visibly.
C — **Register Batch Pick**: at sale, the oldest batch is chosen by default and shown; the
customer asks for a specific batch → the associate picks it and the reason is recorded; a
mixed-batch order warns before the sale; the receipt shows batch and THC.
D — **Store Day**: one screen for a store manager: opening count status, restocks done and due,
new arrivals, floor pars with velocity suggestions (accept / dismiss), end-of-day close.

### Round "Build & Close"
A — **Weekly Build**: templates with an Available column and velocity-suggested min/max beside
each cap (accept / dismiss with evidence), the build preview with reasons per region/kit/box,
partial placement shown, freeze and Blaze-sync state honest.
B — **Build Review**: after the build: what each kit got, what was skipped and why, product age
lane, per-region totals, "one failing region no longer discards the run" made visible.
C — **Day Close**: closure per driver with the return-verify result, revenue reconciliation,
discrepancies as cases, approve; day totals.
D — **Quarantine, Waste & Recall**: a batch on hold: where every unit of it is (safe, shelves,
kits, vehicles), pull tasks per location, waste with reason and approval, recall by batch number
with Metrc tag shown.

Report back in 6 lines per concept: file path and the one idea that defines it.

## Added 2026-09-10 — RFID first (applies to every later round and to revisions of round 2)
Every count, pack-verify, return-verify and register pick begins with an RFID read; rows show
read vs expected per batch; typed steppers appear only in an "exception" row for a dead tag or
an untagged category and are flagged hand-counted. Shelf and rack labels carry a QR that opens
that location's window; count sheets and pick slips carry a QR that closes them by scan. No
location dropdowns. Reads propose; a manager approves.
