# Port plan — writeup-pipeline (Apps Script → our estate)

2026-09-17. Sections 3 and 5 are from the read-only pass (path:line cited); sections 1, 2, 4 and 6
are to be filled by the first builder as its step 0 (read-only, from the same sources).

**Governing rule:** the port implements the owner's 2026-09-16 ladder decision (attendance and
accuracy ladders tracked separately, 90-day window, dismissed never count, one total ledger, AI
drafts capped at Second Warning, step-ups only through a manager's approve-and-send stamp) — NOT
the live GAS behaviour where it differs. "Port verbatim" in HR-DASHBOARD-INVENTORY.md:99 applies to
the AI cap re-validation only.

## 3. The ladder engine spec

**As coded today (GAS, READ):**

| Aspect | Value | Evidence |
|---|---|---|
| AI-writable levels | `First Warning`, `Second Warning` only | Aiwriteupdrafter.js:891 |
| Recommendation field (unenforced) | First/Second Warning, Final Warning, Termination | Aiwriteupdrafter.js:892 |
| Cap enforcement | post-response re-validation; out-of-set output forced to Second Warning, opinion kept in `severity_recommendation` | Aiwriteupdrafter.js:893-903 |
| Step-up mechanism | HMAC-signed `SEND_WRITEUP` POST from the HR Dashboard carrying `approvedBy`; stamps `Manager Approved By` | Webapp.js:1536-1599 (1580-1585) |
| Step-up gates | `PHASE3_ACTIONS_ENABLED` script property must be 'true'; `ALLOW_WRITES` kill switch | Webapp.js:1551-1564 |
| Write-up history window | 24 months | Aiwriteupdrafter.js:432-436 |
| Incident history window | 12 months | Aiwriteupdrafter.js:482-486 |
| Dismissed | HR-dismissed write-ups AND incidents excluded (field id and name key both checked) | Aiwriteupdrafter.js:463-465, 517-520 |
| Rescinded | excluded via `wpIsRescinded_` (fail-closed) | Aiwriteupdrafter.js:459-468 |
| Corrected incidents | excluded (`Source !== WP_CORRECTED_SOURCE`) | Aiwriteupdrafter.js:517-528 |
| Ladder shape | ONE combined write-up + incident count | same functions, no category split |
| Lookup failure | fails closed (`null`, never `[]`) so an outage never reads as "no priors" | Aiwriteupdrafter.js:400-411 |

**Decision table — GAS vs the decided target:**

| Rule | GAS today | Target (decided 2026-09-16) | Port action |
|---|---|---|---|
| AI cap | Second Warning, hard | same | carry forward, incl. the post-response re-validation |
| Step-up | manager stamp via signed channel | manager approve-and-send stamp | carry forward (signed links + session principal) |
| Ladder scope | one combined ladder | attendance and accuracy SEPARATE | build new |
| Window | 24 mo write-ups / 12 mo incidents | 90 days | build new |
| Dismissed | never count | never count | carry forward |
| Fail-closed lookups | yes | yes | carry forward |

Field ids: `fldRNvfDQ9dUggbFN` HR Dismissed (write-up), `fldYbGQsMoI2kqFlO` HR Dismissed (incident),
`fldQHQKKMGQRZO0VK` Write-Up Level.

## 5. Build order

1. **Contract fixtures** — `WriteUp`/`Incident`/`CallOff` against the field-id map. Haiku. No dependency.
2. **Ladder engine (pure, no I/O)** — the decided rules: per-ladder counts within 90 days, dismissed/rescinded/corrected excluded, level derivation, step-up eligibility. Sonnet. Depends on 1. Probe `writeup_ladder_probe` fed by the §4 goldens.
3. **AI draft adapter** — wraps the docs app's `llm_adapter`, reproduces the Aiwriteupdrafter.js:893-903 cap re-validation exactly. Sonnet. Depends on 2 and on `wmdemo/hr/airtable_read.py` (landed) + `airtable_write.py` (in progress).
4. **Approve-and-send route** — signed-link + session principal, replay guard (Webapp.js:1195-1207 pattern: ±300 s window, constant-time compare), stamps the approver, sends via `wmdemo/outbound`. Sonnet (security-sensitive). Depends on 3, `signed_links.py`, `outbound/`.
5. **Call-off Discord/Connecteam routing** — already shipped in GAS (per team/entity via Entities); reuse the outbound adapters' routing map, do not re-port; check CLAUDE.md §4.8 for duplicate fetches. Haiku.
6. **Goldens + cutover gate** — the 10 §4 scenarios run against the new engine (and against GAS read-only where `ContractTest.js` can run standalone); any mismatch blocks cutover. Sonnet.

Sections 1 (entry points, triggers, side effects, Airtable tables), 2 (function → module map), 4 (10
goldens with expected outcomes) and 6 (risks; people-judgement questions for JT) — to be written by
the step-2 builder before coding, from the same sources, with path:line.
