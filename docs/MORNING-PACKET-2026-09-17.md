# Morning packet — 2026-09-17

Everything below is committed locally and verified; nothing is pushed or deployed until you press
the buttons in §4. Plan of record: `docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` (§9 log).

## 1. What landed overnight

**wm-demo (12 commits, HEAD 39c44bb)** — all behind the gate, all refuted:

| Area | What | Checks |
|---|---|---|
| Security | operator/admin session split (`WM_DEMO_ADMIN_TOKEN`), link auth mode, link minting restricted, PII reveal capped + alerted, module gates refuse link principals, region store scoping, `/api/state` scoped, per-channel dedupe, keep-alive 501 root-caused and fixed, route policy batches 2–3 (144/166 covered), gate probe walks the registry | authz 67, sessions 87, gate 1430/16 documented, batch2 78, batch3 146 |
| Cash drawers | sessions, floats, drops, paid in/out, blind counts, expected cash as-of the closing count, variance flags never blocks, one open drawer per store | 97 |
| Tax | rate table with append-only history, per-line compounding, server-resolved cannabis + member type, overlap refused; **off** behind `WM_TAX_TABLE` until you confirm rates | 68 |
| Regions | KML (XML-bomb safe), contains/open/hours, sub-regions, archive with reference counts | 86 |
| Reports | 12 Blaze-parity reports, CSV formula-guarded, employee report PII-scoped | 71 (+20 client) |
| Plumbing | jobs runner (leases, checkpoints, orphans), outbound adapters (Discord/Connecteam/email/webhook, SSRF discipline), Airtable write (journaled, idempotent), Connecteam read, signed links (7 GAS magic-link purposes) | 67 / 89 / 64 / 45 / 83 |
| Forms | dispatch to adapters, encrypted PII with audited reveal, multi-attachment, float subset-sum, row-level conditionals, link submit; **20 HR/LP/onboarding forms ported** | 127 + 48 + 55 + 46 + 47 |
| LP | cases, state machine, decision/re-audit/reopen, driver-response links, **live loss ledger** (stale-driver bug gone), aging jobs | 64 |
| Write-ups | ladder engine on your decided rules (separate attendance/accuracy, 90 days), AI draft cap re-validation, approve-and-send with replay guard, rescind/dismiss, quiet-terminate | 83 + 49 |
| Timesheet | audit engine (thresholds cited to the live GAS engine), violations feed the attendance ladder, background job with digests | 75 |
| Track 4 | AWS CDK (5 stacks, 51 assertions), container image, Postgres schema/data export (125 tables), TypeScript kit + promotions port with 48/48 goldens and the same session split (parity test), off-box S3 backups, Codex offload queue | — |

Full battery: **8553 checks, 8409 pass**; every suite touched tonight is green; the ~30 red suites are
the pre-existing environmental set (Weedmaps read-only in scratch, timing, documented gate gaps).

**POS-Admin (unpushed commits):** contracts additions, client data layers (reports/tax/register/HR),
four concepts each for rule builder, HR Overview, LP Triage + review rounds, migration and port plans,
admin gap list, live admin/Blaze audit, Apps Script port list, forms matrix, offload queue.

## 2. Verdicts

Six FAIL verdicts were fixed and re-refuted: post-count drop laundering a shortfall; client-controlled
`is_cannabis`/`member_type`; the shared console token holding every admin scope; region update route
missing the store gate; cross-channel dedupe swallowing messages; unrestricted link minting.
Remaining notes, all documented in `wm-demo/docs/SECURITY-GATE.md`: 16 over-posting gaps on legacy
module gates; two latent "principal not None" shortcuts fixed in forms/docs; docs route DO-10 body shape.

## 3. Things that need you

1. **Render env (before or right after deploy):** `WM_DEMO_ADMIN_TOKEN` (admin console sessions are
   impossible until set; operators keep working with the existing token). Optional now:
   `HW_BACKUP_S3_*` + `HW_BACKUP_S3_LIVE=1` (off-box backups), `HW_AIRTABLE_KEY` (HR reads),
   `HW_CONNECTEAM_API_KEY_<COMPANY>`, `HW_DISCORD_WEBHOOK_*`. Unset = those features answer 503 or
   record a failed job run; nothing crashes.
2. **Real tax rates per store** (five values, `wm-demo/docs/TAX.md`); the live audit found no admin
   has a tax screen anywhere — where are rates set today?
3. **Winning concepts:** rule builder, HR Overview, LP Triage, Refill Day (team liked B's kit column
   + D's box panel). Review rounds are live at `/explorations/review/`.
4. **Codex queue:** `tools/offload/run_queue.sh --dry-run` then `run_queue.sh` (five briefs).
5. **Incidents to know about:** one agent committed on its own (corrected); two agents ran blanket
   `pkill` — one killed another session's dev server on port 8787 (needs its owner to relaunch); one
   agent's transcript holds the Weedmaps client id (from `cat .env`; rotate if you consider it
   sensitive); one probe wrote rows into the repo DB (removed, probe isolated).
6. **Storefront redesign:** I could not find the redesigned UI files; point me at them.

## 4. Buttons (in this order)

POS-Admin push:
`/Users/jt/POS-Admin/tools/hw_push_pos_admin.sh`

wm-demo push (12 commits):
`cd /Users/jt/wm-demo && git push origin main`

Render deploy:
`/Users/jt/wm-demo/tools/render_deploy.sh`

After the deploy I verify live (gate, sessions, headers, new tables created, background jobs
started) and report.

## 5. Next queue (no decisions needed)

Timesheet Tier-2 messaging, EOS store close-out verify/dispute routes, write-up signing page,
strict route-policy mode (inventory family), warn-severity validator for the float rule, coin-roll
denominations, forms dispatch for the remaining Airtable write-backs, TypeScript ports (restock,
register, tax) with goldens, the AWS stage cutover runbook execution once the account exists.
