# LP Triage + Manager Decision — Concept Notes

Migration phase M2 (`docs/migration/MIGRATION-PLAN-2026-09-16.md` §1). Four concepts, one per
agent track. All mockups are static HTML, example data only (fake driver/manager names), and
label every read with its proposed route. Every write control renders disabled, tagged "M2 write".

---

## Concept A — Queue

**File:** `explorations/LP Triage - Concept A - Queue.html`

**Defining idea:** the triage queue *is* the screen — a single full-width table sorted by a
composite `age_days × |discrepancy $|` priority score, keyboard-first (↑/↓ moves the selection,
Enter opens it), with exactly one case open at a time in a fixed right-hand pane. Nothing about
the layout changes when a case is selected; the pane just repaints. This rewards an auditor who
wants to burn down the queue fast without a screen transition per case.

**What differs from a Case-File/dossier design:** the queue never leaves view — there is no
"open case" navigation, only a right-pane repaint, so the auditor's place in the list is never
lost. The priority score is the queue's organizing idea: a $90 short that's 15 days old
(`Andre Kessler`, priority 1350) outranks an $85 short that's 6 days old (`Jamie Fallon`, 510)
even though the newer case looks "worse" at a glance — decided/corrected cases fall to the
bottom by construction because their delta is $0. A `Preview as` role selector (lp / admin /
manager / hr) demonstrates the two-tier visibility rule live: the cash-discrepancy history panel
disappears entirely for manager/hr, and within it the "corrected — not a loss" row disappears
again for admin — proving the LP-only tier is stricter than the lp+admin tier, not the same one.

**Three questions for JT/LP:**
1. Is `age_days × |amount|` actually the priority LP wants, or should the discrepancy engine's
   own `severity`/`pattern_flag` (already computed server-side per LP-DASHBOARD-INVENTORY §4)
   weight the sort instead of a client-computed product of two raw fields?
2. With one case open at a time in a fixed-width pane, how does an auditor compare two cases
   side by side (e.g., the same driver's last two shorts) — is that a non-goal for Triage
   (push it to the per-driver history panel), or does Queue need a compare/pin action?
3. The keyboard shortcuts C/W/E map to Charge/Waive/Escalate — placeholder names per this
   track's brief, not the inventory's real field names (LP Disposition's Explained/Process
   Fix/True Loss vs. Manager Decision's Approve Write-Up/Dismiss-Coaching, two separate fields
   on two separate actors). Should the real M2 write route keep those as one 3-way choice, or
   preserve the two-actor/two-field split the current GAS screen has?

---

## Concept B — Case File

**File:** `explorations/LP Triage - Concept B - Case File.html`

**Defining idea:** one case at a time as a full dossier — Closer Report fields, evidence/flags,
the driver-response thread, this driver's history, and the decision panel all stacked as
sections on one scrollable page — with prev/next paging (buttons, or ←/→ and J/K) through the
same priority-ordered set Concept A uses. The queue is demoted to a thin 236px left rail of
compact chips (avatar, name, store, Δamount, status dot); it exists for orientation and jumping
around, not for reading.

**What differs from a Queue-first design:** the case, not the list, is the primary artifact —
every field CloserReport.json carries for a case gets its own labelled slot (mode, register,
card total/status, severity+pattern, all four discrepancy flags rendered as chips) rather than
being compressed into a summary card. This surfaced a real gap: the "Evidence & flags" section
has boolean flags (`suspicious_bills`, `damaged_inventory`, etc.) to show but no attachment/photo
field anywhere in the contract to back an actual evidence gallery — called out in-page as a data
gap rather than faked. Uses the same dataset, role model and gating behavior as Concept A (same
fake cases, same `Preview as` selector) so the two are a fair side-by-side comparison of
queue-first vs. dossier-first for the identical underlying data.

**Three questions for JT/LP:**
1. "Evidence & flags" only has boolean flags today (no photo/receipt reference in
   `CloserReport.json`, and the live GAS form doesn't appear to persist attachments for this
   table either) — does a real Case File need an attachment field added to the contract, or is
   evidence handled entirely outside this record (e.g., linked from the Incident it joins to)?
2. Prev/next pages through the same priority order Concept A sorts by. Is "next" always
   "next by priority," or does an auditor working a specific store or day want prev/next scoped
   to that filtered subset instead — i.e., does paging need its own explicit context, not just
   "the whole queue in whatever order"?
3. The dossier shows one driver's history inline. For a driver with many prior cases, does a
   full-page dossier still work, or does the history section need its own drill-in view once the
   list is longer than the 2-3 rows shown in this mockup's example data?

---

## Concept C — By Day

**File:** `explorations/LP Triage - Concept C - By Day.html`

**Defining idea:** the day is the unit, not the driver or the case. One board per date, grouped
by store, every close-out for that day as a row — flagged or not. This is the morning-review
surface: an LP auditor scans all of today's cash rows across all stores in one pass, not just
the ones already flagged, then drills into any row for the full case (contract fields, cash
card, driver-response thread, disposition/decision panels).

**What differs from a Triage/queue-first design:** no default filter to "flagged only" — By Day
shows every report so the auditor can catch what the discrepancy engine didn't flag. Rows are
grouped by store with a per-store variance total, closer to a ledger/spreadsheet reading pattern
than a card queue.

**Interaction included:** a live role-chip toggle (lp / manager / hr / admin) that masks/rounds
cash figures and hides the cash-discrepancy history + "corrected — not a loss" rows for anyone
who isn't lp/admin — demonstrating the M2 auth rule (§2) as a visible before/after rather than a
sentence in the plan. This toggle is cosmetic (client-side, for the mockup only); the real
control is the server-side filter M2 specifies — no client trust, ever.

**Three questions for JT/LP:**
1. Is "every report for the day" actually what the morning review wants, or does that just
   reproduce the noise By Day was supposed to cut down from Triage's flagged-only queue — should
   the default view start collapsed to flagged rows with a one-click "show all"?
2. The store-group total is a naive sum of that store's row variances. Is a signed net (over +
   under can offset) the right rollup, or should over/under be shown as two separate totals so a
   large short doesn't get quietly masked by an unrelated overage elsewhere?
3. Concept C shows discrepancy history scoped to "this driver" inside a case drawer. Should By
   Day itself expose a store-level or day-level history view (patterns across the whole store,
   not just one driver), or does that belong on Store Close-Outs (Tab 3) instead?

---

## Concept D — Store Manager Phone

**File:** `explorations/LP Triage - Concept D - Store Manager Phone.html`

**Defining idea:** a 480px phone canvas scoped to exactly what a store manager may see — their
store only, no cross-store cash history, cash figures masked/rounded rather than exact (per §2,
"cash-figure detail view" is an lp/admin unlock, not a manager one). The screen is
notification-first: LP-flagged discrepancies and escalation decisions arrive as a list, tapping
one opens a bottom sheet with the case, a disabled "Respond to LP" + "Acknowledge" action pair,
and the same disabled Manager Decision block (Approve Write-Up / Dismiss-Coaching / Escalate)
that appears in Concept C — same control, scoped to the manager's own reports via the
reports-to graph.

**What differs:** this is the only concept built around a role *other* than lp as the primary
persona, and around a fixed, non-cross-store scope rather than a filterable list. It reuses the
same role-chip component as Concept C (toggle manager / "lp (preview)") so the PII gate reads as
one rule demonstrated twice, not two different mechanisms.

**Three questions for JT/LP:**
1. Should a store manager see an *exact* dollar amount for their own store's discrepancy at all
   (they already know their own till), with only *history/pattern* data withheld — or is masking
   the live-case amount too, as built here, the safer default?
2. "Acknowledge" and "Respond to LP" are shown as two separate manager actions. Does acknowledging
   a notice need to be tracked/timestamped the way driver_response is, or is it purely a client
   read-receipt with no contract field of its own?
3. The notifications list mixes discipline-adjacent items (escalation decision needed) with
   informational ones (corrected — not a loss). Should those live in one feed, or does an
   escalation notice need a harder-to-miss channel (push/SMS) given the 24h response-window
   pattern carried over from the driver portal?
