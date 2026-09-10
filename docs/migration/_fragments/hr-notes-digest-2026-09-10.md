# HR dashboard — digest of the root notes (fragment from an interrupted audit, 2026-09-10)

Source docs read: `WALKTHROUGH-NOTES-HR.md` (692 lines; the live HR Dashboard in `onboarding/`,
nine screens: Overview, People, Onboarding, Incidents, Write-Ups, Call-Offs, Compliance, Policies,
Settings), `HR-DASHBOARD-EXPIRED-DOC-FALSE-POSITIVES-2026-09-03.md`,
`Hyperwolf_HR_Attendance_Remediation_Brief.md` (2026-07-11). Not yet read:
`ATTENDANCE-REDESIGN-PLAN.md`, `LP-HR-MONEY-VISIBILITY-PLAN.md`, `WALKTHROUGH-NOTES-LP.md`.
Line numbers are as the notes assert them, not re-verified against current code.

## Rules worth carrying into the admin
- Risk score `scoreEmployee()` (`onboarding/RiskScoring.js:94`), deterministic, no model:
  incident decay (≤7d ×8, 8–30d ×4, 31–90d ×2, >90d ×0.5), severity High 6 / Medium 3 / Low 1,
  write-ups unacknowledged ×10 / acknowledged ×2, +8 if any active write-up is Final/Suspension/
  Termination, +4 if any is 2nd Written, compliance = 1.5 × YTD weighted points, pattern flags
  (repeat ≤7d +12, open escalation +6, unacked-prior+newer +5). Bands Low ≥0, Watch ≥15,
  Elevated ≥30, High ≥50; a 0–100 display projection (`Server.js:932`); fallback model
  (`Server.js:896`) only if the primary throws.
- Rank score `scoreEmployeeRank` (`Server.js:3751`): 100 minus penalties, mean of Compliance,
  Loss Prevention, Attendance.
- Dismiss (`Server.js:3346`): three additive fields, cache bust, refuses rows with no Employee link.
- Write-up ladder cap: AI drafts capped at Second Warning; step-ups only via a manager's
  Approve & send (estate memory).

## Live defects the migration must not copy
- `state.isAdmin` hardcoded true in the client (`Index.html:451`); real auth is server-side.
- Dead code: `insuranceCard(e)`; a "Dismiss" in Suggested Escalations that only toasts; three KPI
  chips that reload the same screen; a field named `callOffs7d` with no date filter; one modal
  reused for two purposes with overlapping ids.
- **Expired-document false positives**: Table A "Employee Policies & Documents" wins over the
  directory fields but was backfilled once (2026-07-12) and never updated on renewal
  (`Server.js:1584-1591`; renewals patch only the directory). 13 of 18 "Expired" rows are false,
  across 11 employees; the daily `DocExpirySweep.js` nags them. Fix (unapplied, owner's call): correct
  the 13 rows; make renewal upsert Table A. In the admin: one document record per person with a
  single source of truth.
- Attendance remediation brief (2026-07-11): ConnecTeam shift match uses one of four per-company
  user ids; the time-activity check ignores pending edit requests (the false-positive engine);
  same-morning auto-escalation with no resolved check; `RESOLVED` fields never written; entities
  and job titles share one table. Locked decisions: call-off email canonical in delivery-ops;
  dispute by magic link; break/meal escalation gated on a 24 h employee window + manager
  confirmation; documents as Airtable attachments only; Sunday-night re-audit.

## Open with the owner (from the notes)
WS3 scope (same-day escalation for late clock-in/no-show), entity-table split vs Type flag,
employee-response SLA (24 h assumed), Sunday re-audit time; the two-part expired-document fix.
