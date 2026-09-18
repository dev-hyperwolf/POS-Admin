# Queue 05 — codebase status refresh

Added the new snapshot after the original introduction, before Modules on the contract. This lets readers see the latest recorded program state before the preserved historical phases. The original Updated sentence remains intact with an appended refresh sentence.

## Provenance of all transcribed facts

The table rows and following paragraphs each carry §9 line citations from BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md:

- Team 0: 46/58, PASS-WITH-NOTES (258); 35, 2fdbf7e, 10/153 (265); 9b9c149, 6005, 15, 1476/0, nine attacks, 512 pass / 0 fail / 5 skip, 25 writes, fixed session issues and follow-up list (267).
- Track 1: 58d8cea, 0.5.0, pending shape fixes (259); 268→289, 403/404, 81, fb28332 and pending pricing / resolution (262).
- Track 2: 583e5bf, 27, 92f6aba, 21, review / dispatched fixes and missing par table (260); d9cb26b, 20–25, c5e9815 (263).
- Track 3: 77a7a1b, 58d8cea (261); 15f87ed, 2bea2be, static PASS-WITH-NOTES, entity filter, 503/502 (264).
- Track 4: 76ebd8f, 32 and in-process backup integration (266); 5 stacks, 51 assertions, 125 tables, 48/48 and session parity (269).
- Wave 2 module list, 12 reports, 7 purposes, 20 forms / batches 1–3, 144/166, 6 failed reviews fixed, 501 fix, tax flag and human approval (269).
- Wave 3: lp 110, strict default, warning validators, signing security fixes, 54/44 goldens, 103, 14 routes, unpushed prefix fix, ten write-backs still fixing and cash/tax refute in progress (273).
- Track 5 requests / no completion claim / no production database / Mongo user (274).
- Track 6 dispatched audit and concepts, four concepts for desktop and phone, missing mobile source (275).
- Battery floor 3692 → 3750, uncommitted and webhook coverage caveat (271; context 249).
- Realtime building / later stages planned, ~30 s failover, Aurora / proxy / Valkey / account setup and no agent deployment (276).
- Owner configuration, rates, backup and concept-pick items (270).

## Checks

PASS existing headings preserved in order, plus one new heading.
PASS original text exactly restored after removing only the new section and appended refresh sentence.
PASS every newly included seven-character commit hash exists verbatim in the master plan.
PASS all five grep commands (below). Total: 8 checks passed / 0 failed. No runtime tests needed for this document-only change.

```text
$ grep -n ^##  docs/CODEBASE-STATUS.md
8:## Build program (2026-09-16/17) — status
30:## Modules on the contract — status (2026-09-09, night)
53:## Phase 4 — Hyperwolf Docs (live on Render since 2026-09-10; contracts 0.3.2)
83:## Phase 5 — Inventory, placement, forms, RFID (2026-09-10)
109:## Phase 3 — compatibility (done, committed, not pushed)
152:## Phases 1–2
154:## Where it stands
160:## What was done
173:## What was verified, and how
189:## Waiting on you
201:## Run it
```

```text
$ grep -Fn 9b9c149 docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md
267:- 2026-09-17 early · **wm-demo committed (9b9c149)** after the full battery (6005 checks; all 15 program suites 1476/0) and a live release review of the session/gate layer (PASS on nine attacks). Sessions refuter had failed on shared login bucket + partial legacy flag + public-mode gate → all fixed. Security-gate probe walks the registry: 512 pass / 0 fail / 5 skip. Route coverage: batch 1 done (25 money/PII writes); batches 2–3 + strict-mode decision in progress. Index export boot-tested before the commit. Follow-ups queued: preview store scoping, actor-label cap, background flag over the reconcile loop, nostack/cycle3 credentials.
```

```text
$ grep -Fn 512 pass / 0 fail / 5 skip docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md
267:- 2026-09-17 early · **wm-demo committed (9b9c149)** after the full battery (6005 checks; all 15 program suites 1476/0) and a live release review of the session/gate layer (PASS on nine attacks). Sessions refuter had failed on shared login bucket + partial legacy flag + public-mode gate → all fixed. Security-gate probe walks the registry: 512 pass / 0 fail / 5 skip. Route coverage: batch 1 done (25 money/PII writes); batches 2–3 + strict-mode decision in progress. Index export boot-tested before the commit. Follow-ups queued: preview store scoping, actor-label cap, background flag over the reconcile loop, nostack/cycle3 credentials.
```

```text
$ grep -Fn 3692 → 3750 docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md
271:- 2026-09-16 · **Battery floor** (wm-demo, uncommitted): 3692 → 3750 by our additions; another session's edit still holds the webhook-SSRF probe out (§8).
```

```text
$ grep -Fn 48/48 docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md
269:- 2026-09-17 night · **Wave 2 (overnight, ~45 agent runs)** on wm-demo: cash drawers (sessions/floats/drops/paid in-out/blind counts/variance flags-not-blocks), tax module (rate table + history, per-line compounding, server-resolved cannabis + member type, off behind WM_TAX_TABLE until JT confirms rates), regions (KML defused, contains/open/hours, sub-regions, store-scoped), reports (12 Blaze-parity reports, CSV guarded), jobs runner (leases, checkpoints, orphans capped), outbound adapters (Discord/Connecteam/email/webhook, per-channel dedupe, SSRF discipline, poisoned rows isolated), Airtable write adapter (journaled, idempotent, restricted-PII guard), Connecteam read adapter, signed links (7 GAS magic-link purposes), form generator features (dispatch, encrypted PII with audited reveal + rate cap, multi-attachment, subset-sum, link submit), 20 forms ported (batches 1–3), LP triage/decision routes + live loss ledger, write-up ladder engine + AI drafts (cap re-validation) + approve-and-send, timesheet audit engine feeding the shared attendance ladder, route policy batches 2–3 (coverage 144/166), operator/admin session split (WM_DEMO_ADMIN_TOKEN), keep-alive 501 root-caused (undrained bodies) and fixed. Track 4: AWS CDK (5 stacks, 51 assertions), container image, Postgres schema/data export (125 tables), TypeScript kit + first strangler port (promotions rules, 48/48 goldens) + same session split with a parity test, Codex offload queue. Refuters ran on every module: 6 FAIL verdicts fixed and re-refuted (money laundering drop, client-controlled tax flags, omnipotent console session, region write gate, cross-channel dedupe, link-minting scope). Agent conduct: one unauthorised commit (e0d1293) corrected by 3b5a770; two blanket pkills (one killed another session's dev server on 8787); scratch servers only, repo DB untouched except one probe's rows since removed and the probe isolated.
```

## Ambiguity deliberately retained

The brief says the latest entry is early, but the committed source ends at evening. This snapshot covers that actual endpoint. §9 dates are not sorted (night precedes morning, and a 2026-09-16 floor entry follows 2026-09-17 entries); chronology is expressed using their explicit labels, with no guessed final floor or coverage. No hash is invented for Wave 2/3 builds. Early pending fixes are not declared complete from later silence. Production deployment, present test health, and the latest living-to-do decisions are not re-verified by this documentation task. The snapshot qualifies owner items as historical and does not reopen them.
