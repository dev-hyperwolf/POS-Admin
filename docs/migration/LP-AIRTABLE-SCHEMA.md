# LP dashboard — the Airtable base behind it, read 2026-09-10

Base **End of Shift Portal (all Entities)** `appouBkOofOK3zjN8`, read-only via the Airtable API.
This is the D0 fact base for migrating the LP dashboard into the admin (`LP-DASHBOARD-INVENTORY.md`
§5). Field ids are omitted here except where a GAS script references them; the full list is in the
API response and can be re-pulled at any time.

## Tables

| Table | Rows (approx) | Role |
|---|---|---|
| **Closer Reports** `tblRDz09UwZdkDnoZ` | thousands (2,739 legacy rows pre-2026-08-05 noted in a field description) | one row per shift close-out: delivery driver (legacy) or retail associate; the LP incident, driver response, manager decision and LP disposition all live on the same row |
| **Daily Summaries** `tblIfKfmpKfxUjpd1` | one per date per entity | rollups of the denominations and deposits over the day's reports |
| **The Highest Craft LLC Drivers (Active)** `tbloZmrKDWEQpR5v9` | staff | synced from an external source; carries **PII** (home address, DOB, phone, email) |
| **Closers (Active)** `tblYWqhKR2rJqXBGR` | staff | closers and auditors; link inverse of Auditor |

## Closer Reports — the field groups (what the migration must carry)

1. **Identity of the shift**: Date of Shift (formula), Created, Driver Name (link), Closer (link),
   Region Worked, **Entity** (legal entity, canonical from the registry), **Mode**
   (Delivery | Retail; empty = Delivery), **Store**, Register / Till (free text today; "upgrade to
   singleSelect once the per-store register set is known").
2. **The cash count**: $100 … $1 bill counts, Rolled Coin Value, Loose Coin Value, **Cash Total
   Calc** (formula), **Closer Counted Total (Entered)** (safeguard vs denomination miscount),
   Denom vs Entered (MISMATCH check), Float Amount (per-entity retail floats: Corona $100,
   Long Beach $50, West Hollywood $200; drivers $60), Safe Drop Amount, **Cash Dropped /
   Deposited (Counted)**, Cash being deposited (formula: total − $60 float), Deposit Variance.
3. **Expected figures and precedence** (documented on the fields): Lead POS Cash (receipt) >
   Blaze Expected Cash (POS) > Expected Cash Value (associate-typed). Blank means unknown, never
   zero. "Counted − POS (includes float — NOT the variance)" is raw arithmetic and is explicitly
   **not** the discrepancy: true variance = that column − Float Amount; the apps compute it
   themselves (`retailComputeVariance_`, `parseCashDiscrepancy_`).
4. **Card reconciliation**: CC Sales Total (from Blaze), Number of Card Payments (Blaze), LP Card
   Count, LP Card Total (LeisurePay), LP vs Blaze Status (formula: PENDING | MATCH | MISMATCH),
   CC Count Δ, CC $ Δ, # Missing CC Transactions, Blaze Transaction #s missing, **LP Batch
   Audited** (TRUE only when the closer asserted they had the LeisurePay batch report; never
   bulk-set on legacy rows), Blaze Reference and LeisurePay Reference (display-only text parked
   nightly, never fed into variance).
5. **Discrepancy and incident**: Total cash count discrepancy?, Over or Under, Discrepancy Type,
   Suspicious Bills + description, Damaged Inventory + notes, Missing Accessories, Broken Hardware,
   Discrepancy with Payment(s) + "Describe what happened", Cancelled Items Snapshot (JSON),
   Closer Error? + Manager's Error Description, Auto-Clear Reason, Type of issue (formula).
6. **The case lifecycle**: Current Resolution Status, **EOS Incident ID** (record in the HR base
   `app8mI9K1lS1D3Uhk/tblGkzrBFpSo2EqzP`, set by GAS), Response Deadline, Driver Response + At,
   Last Context Reminder Sent + Context Reminder Count (24 h cadence, escalates at ≥ 3),
   **Manager Decision** + By + At (discipline), **LP Disposition** + By + At (adjudication, set by
   the LP dashboard; separate from discipline), Amount Recovered, **Final Loss $**, Severity
   (mirrored from `computeSeverity_`), Pattern Flag, Driver History Snapshot (JSON: incidents 7/30/90d,
   total amount 30d, common type), LP Owner + At (claim/assign), Auditor (link), Auditor Notes
   (append log), Last Audited By/At, Dismissed + By + At.
7. **Retail two-stage verification**: Verification Status, Verified By (Team Lead), Verified At,
   Verify Deadline (deliberately not Response Deadline), Dispute Count (past RETAIL_DISPUTE_MAX →
   manager triage), Closing Checklist + Closing Checklist Snapshot (JSON of what was asked and
   answered, with "why not" per unticked item), Deposit Prepared.
8. **Cash carryover claims** (2026-09-01 design): Linked Shift (set only after a human confirms),
   Claim Status, Claimed Amount, Claimed Prior Date, Prior Report ID.
9. **Deprecated, drop on migration**: zDEPRECATED — Created 2, zDEPRECATED — Date (Usable).

## Mapping to the admin (feeds `LP-DASHBOARD-INVENTORY.md` §5 and the form generator)

| Airtable group | Target | Notes |
|---|---|---|
| 1 identity | `Closeout` (new shape) with `Store`, `Person` (closer, driver), `mode`, `register` | register becomes a real Terminal once our POS has terminals |
| 2 cash count | `Closeout.count`: denominations as a repeating group in the **closeout FormDef** (already seeded), totals as `Money` cents | the float is a store setting, never typed |
| 3 expected + precedence | `Closeout.expected` with a `source` enum receipt \| pos \| typed | blank ≠ zero must survive: use null |
| 4 card reconciliation | `Closeout.cards` {blaze_count, blaze_total, lp_count, lp_total, asserted} | LeisurePay is our processor; Blaze goes away with the exit |
| 5–6 discrepancy + case | `Incident` (new shape): type, severity, status, amounts, response, decision, disposition, loss, attribution | one case per shift row today; the tag-level case from the RFID work is a child of this |
| 7 retail verification | `Closeout.verification` {status, by, at, deadline, disputes, checklist snapshot} | checklist becomes a FormDef section |
| 8 carryover | `Closeout.carryover` {status, amount, prior_closeout_id} | human-confirmed link only |
| Drivers / Closers | `Person` (contract) | do not migrate DOB/home address into the closeout data; they belong to HR |
| Daily Summaries | derived view, not a table | rollups computed from closeouts |

## Rules the fields encode (keep)
- Never treat "Counted − POS" as the discrepancy; net the float first.
- Blank expected means unknown; never coerce to 0.
- LP figures count only when the closer asserted the batch report (LP Batch Audited).
- Discipline (Manager Decision) and adjudication (LP Disposition) are separate decisions with
  separate actors and times.
- Carryover links and retail verification are set only by a named human.

## Also read: "Hyperwolf Distribution Management" `app6Hec2OJsdjhlmo`
Not kit distribution: **vendor invoice management** — Retail Invoice Management (invoice, issue and
due dates, total, payments, status, brand, lot numbers, terms), Brands, Payment Records, Payment
Terms, Soft Goods Packaging Inventory, and **Lot Numbers** (Lot Number ID, Product Batch
Identifier, **Cost Per Unit, Tax Owed Per Unit**, associated invoices). The lot table is the
source for `Batch.unit_cost` and the tax basis per batch in the inventory model; the invoice
tables are a later migration group (finance).
