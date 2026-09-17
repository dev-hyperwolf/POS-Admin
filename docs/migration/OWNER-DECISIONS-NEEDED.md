# Owner Decisions Needed — LP + HR Migration (2026-09-16)

Collapsed from the 16 open questions in `LP-DASHBOARD-INVENTORY.md` §6 and
`HR-DASHBOARD-INVENTORY.md` §6, minus items already resolved. See `MIGRATION-PLAN-2026-09-16.md`
for the full context each item feeds into.

**Already resolved, not listed below (do not re-ask):**
- HR §6 Q1 (PIN second-factor) — answered by the program's own D1 decision: PIN step-up for SSN
  reveal and approve is already specified.
- HR §6 Q5 (writeup-pipeline's 10 unmapped tables) — mapped in this pass via
  `writeup-pipeline/SignaturePortal.js:13-24` + `ConfigReader.js`: 6 are small config lookup
  tables (shift start times, call-off reasons, incident types, issue categories, severity levels,
  allowed submitter titles — no PII), 4 are the Signature Portal's documents/versions/requests/
  signatures (restricted PII — signed documents + signature images). See migration plan §7 risks.
- HR §6 Q6 (ladder cap revisit) — answered by the 2026-09-16 write-up ladder decision; not open.
- HR §6 Q8 / LP §6 priority ordering — answered by the master plan's own M0→M5 phase order
  (read screens before writes, writes before write-up/SSN).

---

> **Resolved 2026-09-16 by the build-program PM (mechanics, per the decision-authority rule):** items 1–5 take the
> recommended default. Item 2: SSN stays in Airtable (system of record through M2) and never transits our
> server except on the audited PIN-gated reveal call; encryption-at-rest becomes a line item when data moves.
> Item 5 (`lp` + `admin` only see cash-discrepancy history) is a role default JT may widen; flagged in the
> program report because it is closest to a people question.

## BLOCKING — nothing in the named phase starts until answered

| # | Question | Blocks | Recommended default | Consequence of the alternative |
|---|---|---|---|---|
| 1 | Should `HrEmployee` be a new contract referencing `Person.id`, or should `Person` grow an optional HR extension block? (HR §6 Q3) | M0 contracts work — every later HR route is typed against this | New `HrEmployee` contract referencing `Person.id` (HR inventory's own recommendation — Person is POS/verify-shaped, has different access-control needs) | Growing `Person` means every consumer of `Person` anywhere in POS-Admin now has a path to HR-only fields; harder to keep restricted PII out of unrelated screens |
| 2 | SSN handling: keep plaintext-with-admin-PIN-gate-and-audit-log (current design), or require encryption-at-rest? (HR §6 Q4) | M4 (SSN reveal action) — not M1, since M1 never fetches the field at all | Keep plaintext+PIN+audit for M4 ship; open encryption-at-rest as a fast-follow security item, not a blocker | Requiring encryption-at-rest first adds real calendar time to M4 for a field that already has field-level gating + an audit log; deferring it means the live-DB compromise scenario is still plaintext until the fast-follow lands |
| 3 | Table-A doc-expiry fix (13 of 18 false positives): fix pre-migration in the live GAS, or carry the correction only into the rebuild's data model? (HR §6 Q2) | M1 Policies screen | Fix only in the rebuild's read logic (read renewals directly, ignore Table A's stale status) — do not touch live GAS | If GAS is also patched, the false positives stop appearing before M1 ships, but that's a second place to get the fix right and a live-GAS edit outside this program's guardrails |
| 4 | Retail hard duplicate block (delivery has one, retail doesn't): build it now in a GAS patch, or carry the gap forward and build it as part of the M2 rebuild? (LP §6 Q1) | M2 Store Close-Outs scope | Carry forward, build only in the M2 rebuild (matches "bugs fixed in rebuild, not before" pattern already used for Table-A and LossLedger) | Patching GAS now closes the gap sooner but is a live-GAS change outside this program, and duplicates effort once M2 replaces the screen anyway |
| 5 | LP→HR money-visibility: which **role/scope** (not named individuals) may see an employee's cash-discrepancy history in the new admin? (LP §6 Q2) | M2 Triage/cash-history views | `lp` + `admin` scopes only; `hr` and `manager` excluded by default | Broader default access to cash-discrepancy history is a PII/trust decision with no clean way to walk back once shipped — narrower default, widen later if asked |

## NON-BLOCKING — proceed with the stated default, override later

| # | Question | Phase | Default |
|---|---|---|---|
| 6 | Keep the legacy email-button manager-decision path (dead code, still live), or drop it in the rebuild? (LP §6 Q4) | M2 | Drop — it's already confirmed dead (`ManagerDecision.gs`, "dead per WALKTHROUGH-NOTES-LP.md:632-639") |
| 7 | Should "corrected — not a loss" rows appear on the HR-visible cash card, or stay LP-view-only? (LP §6 Q3) | M2 | LP-view-only for the initial ship; revisit if HR asks for it post-launch |
| 8 | Any objection to replacing the 30-min Airtable loss-mirror with a live query? (LP §6 Q8) | M2 | Replace it — this is also the fix for the stale-driver bug (§5 of the migration plan); the live query changes the read path but removes a confirmed defect |
| 9 | Form generator: build the retail float subset-sum check and denomination counting as first-class field types, or special-case the Closeout form? (LP §6 Q6) | M3 | Special-case for now — `forms_seed.py`'s `CLOSEOUT` example already models denominations as a `repeating_group`; promote to a first-class type only if a second form needs the same pattern |
| 10 | Store Close-Outs UX fixes (2026-09-07 audit): patch the old GAS screen now, or fold straight into the React rebuild? (LP §6 Q7) | M2 | Fold into the rebuild only — skip fixing what's being replaced |
| 11 | Is the retail dispute-aging trigger actually installed live today? (LP §6 Q5) | M2 (pre-build verification) | Verify via the Apps Script trigger list as a QA task before M2 scoping locks; treat as "not confirmed installed" until checked, since the inventory itself flags it unverified |
| 12 | Timesheet compliance engine has no UI today — give it one in the rebuild, or keep it a background job with digest emails only? (HR §6 Q7) | M5 | Stay background-only — matches the master plan's own M5 framing ("background jobs... re-homed... to Render scheduled tasks"); revisit if ops asks for a dashboard post-M5 |

---

**Judgement-call note:** none of the 12 items above are "who gets disciplined/told" questions —
they are mechanics (contract shape, fix location, role/scope defaults, UI scope). Item 5 is the
closest to a people question but is phrased as a **role**, not a named roster; if the real
requirement turns out to be specific named individuals rather than the `lp`/`admin` scopes, that
becomes a genuine escalate-to-JT item at that point, not now.
