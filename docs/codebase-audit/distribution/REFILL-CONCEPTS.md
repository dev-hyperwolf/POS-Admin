# Refill Day — four concepts for the inventory team

Same screen, same data, same house style, four different ideas about how the operator should
work. All four use the team's own structure: **Region → Kit (one per driver) → Boxes** (Flower
Box 1, Pre-Roll Box 2, Cooler, Concentrate Bin 1, Edible Bin, … — box types are data, with a
"Manage box types" affordance). All four carry the four required pieces: a refill **preview**
before commit (sold · need · cap · will give · reason), a **received in the last 7 days** lane
with one-tap "Send today", a **status timeline** for the day, and a **skips and shortfalls**
panel in plain words. Every number on them is example data.

Files, in `POS-Admin/explorations/`:

| Concept | File | The one idea | Best for |
|---|---|---|---|
| **A — Ledger** | `Distribution Refill - Concept A - Ledger.html` | One tall Region → Kit → Box tree table with sticky headers and totals at every level; skips docked in a right rail; timeline in the header; print-friendly | A desk operator who wants to see everything and drill into the one box that needs attention |
| **B — Box Cards** | `Distribution Refill - Concept B - Box Cards.html` | The physical box is the unit of work: region tabs, a column per driver, a stack of colour-coded box cards each with its own packed checkbox and pick total; a skipped product shows inside the box it belonged in | Matching the way the warehouse actually packs |
| **C — Exceptions First** | `Distribution Refill - Concept C - Exceptions First.html` | A morning decision queue: every item that needs a human as a card with the consequence in plain words and two or three buttons; the full preview collapsed beneath; Commit unlocks when the queue is empty | The fastest morning with the fewest decisions; nothing fine ever needs a look |
| **D — Tablet Packing** | `Distribution Refill - Concept D - Tablet Packing.html` | One kit at a time on a 10-inch tablet at the bench: boxes as paged panels, big steppers, "Box packed", a persistent bottom bar with kit totals and Commit | The person with the product in their hands |

## What differs, so the team can pick pieces

| Question | A | B | C | D |
|---|---|---|---|---|
| What is the unit of attention? | the whole day | a box | a decision | a kit |
| Where do skips appear? | right rail | inside the box, plus a list on top | as queue cards first | amber rows in place |
| Where is the received lane? | slim strip on top | card carousel on top | the first group of the queue | "New this week" strip per kit |
| Timeline | compact stepper in header | vertical beside each kit | progress bar under the header | dots in the bottom bar |
| Commit | one button, all regions | per region tab | unlocks when the queue is empty | per kit, then all |
| Density | highest | medium | lowest | lowest, biggest targets |
| Device | desktop | desktop | desktop or tablet | tablet first |

## Questions to put to the inventory team

1. Who runs the refill and where: one person at a desk, or the packer at the bench?
2. Is the box the thing they think in, or the kit? (Decides A/B vs D.)
3. Do they want to see everything every morning, or only what needs a decision? (Decides C.)
4. When a product is short, who decides how to split it between drivers, and on what basis?
5. Which box types exist today, per region, and how often do they change?
6. Is "commit per kit" (D) safer than "commit all" (A), or slower?

## Known gaps in the mockups (concept work, not product)

B: "Manage box types" is a stub; "already ran today" is wired for one region. D: paging uses
scroll-snap rather than a custom swipe. C: the agent that built it stalled during its own
verification; the file is complete and parses, but exercise the commit flow once by hand.
