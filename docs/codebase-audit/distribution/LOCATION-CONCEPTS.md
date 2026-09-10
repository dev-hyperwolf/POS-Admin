# Batch location — four concepts for the inventory team

Problem: nothing records where a batch is stored; a new batch of an in-stock SKU is invisible to
the refill person. Owner's constraints: set at receiving on the handheld; one tag per unit,
recorded to the batch; two batches of one SKU in a kit must be loud on the UI and the pick slip;
"simple, smart, intuitive and automated". Research: `LOCATION-SYSTEM-RESEARCH.md` recommends a
three-level address (rack-shelf-bin, e.g. F2-B-03), QR labels on shelves, directed put-away with
scan-to-confirm, RFID as the auditor of drift rather than the sole record.

| Concept | File (`explorations/`) | The one idea | Best for |
|---|---|---|---|
| **A — Scan the Rack** | `Batch Location - Concept A - Scan the Rack.html` | Every shelf has a scannable address; the handheld proposes a slot next to the SKU's older batch (never on it), and "Put away" unlocks only after a rack scan and a bulk read | The most certain record with the least new hardware: QR labels and the handheld you already plan |
| **B — The Map** | `Batch Location - Concept B - The Map.html` | A drawn floor map of the vault is the one surface for receiving (the proposed shelf pulses), finding (a search lights every shelf holding the SKU, oldest first) and picking (a walking route that prints as the pick slip) | Teams who think spatially; new staff learn the vault from the screen |
| **C — The System Decides** | `Batch Location - Concept C - The System Decides.html` | Racks carry RFID location tags, so the handheld knows where it is standing; the clerk reads the delivery once and follows a walk list; the UI interrupts only for wrong rack, no capacity, unknown SKU; a "walk the vault" mode reports drift | Maximum automation; needs location tags on racks and reliable reads |
| **D — Ask the Vault** | `Batch Location - Concept D - Ask the Vault.html` | One big search box answers "where is it" and "where does it go" with a slot label and a rack photo; "what is new since my last refill" returns the three arrival kinds with locations | The refill person's daily question, answered in one tap |

All four print the same pick-slip strip (location path, batch, THC, package date, quantity)
with the loud mixed-batch flag, and all four reuse the kept elements from the refill concepts.

## Questions for the team
1. QR labels on shelves (A, B, D) or RFID location tags on racks (C)? C is the only one that
   removes the rack scan; it also needs the reader to tell adjacent racks apart.
2. Is a rack photo worth maintaining (D), or is the address enough?
3. Do they want the map (B) as the way to set up and relabel the vault, even if they pick another
   concept for daily use?
4. Where does the THC result come from for the pick slip: the COA on receiving, or the POS?
