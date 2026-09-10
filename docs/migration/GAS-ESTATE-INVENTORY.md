# GAS Estate Inventory — 2026-09-10

**Scope:** 27 projects catalogued (22 core + 5 depth-coverage). Data extracted via grep/git; no edits performed.

---

## Project Roster

| Project | Files | Purpose | Entry | Triggers | Last | Key Systems | Status |
|---------|-------|---------|-------|----------|------|-------------|--------|
| **airtable-patches** | 3 | Call-off → write-up snapshots | none | 0 | 08-09 | Airtable | util |
| **bug-intake** | 38 | Discord form → ClickUp ticket via Claude | none | 0 | 08-24 | Discord → ClickUp | live |
| **coa-sync** | 2 | Flower info COA sync (web app) | web | 0 | 08-09 | Airtable | legacy |
| **cultivation** | 12 | Grow tracker (batches, phases, batch lifecycle) | web | 4 | 08-20 | Airtable, Slack | live |
| **cultivation-tests** | 3 | Test suite for cultivation | none | 0 | 07-31 | (test only) | test |
| **delivery-intel** | 25 | Real-time KPI dashboard (Onfleet ops) | web | 6 | 07-18 | Onfleet(110), Airtable | legacy |
| **delivery-ops** | 27 | Call-off form intake + terminal retries | web | 9 | 09-07 | Blaze, Airtable | live |
| **discord-bot** | 15 | Interaction handler (slash commands) | web | 0 | 08-17 | Discord, Onfleet | live |
| **driver-mgmt** | 34 | Mileage, breaks, Onfleet data | web | 4 | 08-20 | Onfleet(273), Blaze | live |
| **hw-intake-ops** | 515 | HR intake (badges, ID docs, residency) | menu | 0 | 08-25 | Airtable, Blaze, Slack | live |
| **hyperassist** | 42 | Sheet-based assistant (DEPRECATED) | menu | 4 | 08-17 | Blaze, Airtable | legacy |
| **hyperassist-v2** | 18 | Web-based assistant (replaces v1) | web | 17 | 08-24 | Blaze, Airtable | live |
| **marketing-analytics** | 17 | AlpineIQ API wrapper + dashboard | web | 0 | 07-31 | AlpineIQ, Slack | legacy |
| **meadow-hyperdrive-sync** | 11 | Meadow → Hyperdrive sync | trigger | 2 | 08-17 | Meadow | legacy |
| **orders** | 40 | Order lifecycle (web + dashboard) | web | 9 | 09-04 | Blaze(575) | live |
| **promotions-engine** | 10 | Promo calc + approval (Blaze sync) | web | 4 | 08-16 | Blaze(116), Airtable, Onfleet | live |
| **report-builder** | 8 | Flexible report generator | web | 0 | 09-08 | Blaze(8), Airtable | live |
| **sales** | 8 | Blaze store metrics (minute poll) | web | 1 | 07-18 | Blaze(37) | legacy |
| **scoreboard** | 33 | Live ops metrics (Onfleet) | web | 6 | 08-25 | Onfleet(318), Blaze, Airtable | live |
| **scoreboard-legacy** | 24 | Original scoreboard (DEPRECATED) | web | 0 | 08-25 | Onfleet(225), Blaze, Airtable | legacy |
| **spinwheel** | 28 | Incentive wheel + loyalty (web) | web | 14 | 08-20 | Blaze(198), Onfleet(3), Airtable, Slack | live |
| **tools** | 49 | Misc admin utilities (batch ops) | web | 26 | 08-28 | Blaze(116), Onfleet(14), Airtable, Slack | live |
| **end-of-shift-portal** | 404 | Store closeout web portal | web | 114 | 09-09 | Blaze(1301), Airtable(73), Slack | live |
| **onboarding** | 29 | Identity verification + hiring | web | 9 | 09-08 | Blaze(9), Airtable, Onfleet, Slack | live |
| **daniel-hr** | 7 | HR milestone workflow (simple) | web | 3 | 07-19 | Airtable(4) | legacy |
| **writeup-pipeline** | 119 | AI write-up discipline engine | web | 48 | 09-09 | Airtable(248) | live |
| **timesheet-audit** | 20 | Clock-in/out audit + reports | web | 24 | 09-09 | Airtable(57), Slack | live |

**Summary:** 27 projects | Live: 14 | Legacy: 10 | Test/Util: 3 | Total files: ~1,900 | Total lines: ~1.4M

---

## Shared Plumbing

### (A) Airtable Integration
- **Pat Usage:** 867 calls to `AIRTABLE_PAT` (primary), 510 to `AIRTABLE_API_KEY`
- **Base ID:** 323 refs to `AIRTABLE_BASE_ID` (shared across ~10 projects)
- **Key Tables:** `tblLEDGER00000001` (72 refs, shared ledger); `tblC1000000000001` (14 refs)
- **Helper Pattern:** No centralized Airtable helper library; each project implements its own REST wrapper
- **Risk:** Duplicated auth logic; inconsistent error handling; no batching strategy documented

### (B) Blaze Integration
- **Auth:** 210 refs to `BLAZE_AUTH_KEY_HW_LE` (store auth), 173 to `BLAZE_AUTH_KEY_` (generic pattern)
- **Store IDs:** 187 refs to `BLAZE_STORE_ID_`, 164 to `BLAZE_STORE_ID_HW_LE`
- **Hot Projects:** end-of-shift-portal(1301 refs), orders(575), promotions-engine(116), tools(116), spinwheel(198)
- **Helper Pattern:** No centralized library; each project wraps `/api/bl` endpoints directly
- **Risk:** Endpoint chaos; no API version pinning; no rate-limit handling visible

### (C) Lock/Lease Patterns
- **Used in:** driver-mgmt(55), onboarding(46), cultivation(44), end-of-shift-portal(35+)
- **Pattern:** `LockService.getScriptLock()` in most; `EXPIRING_LEASE` in driver-mgmt and cultivation (lease pattern for long jobs)
- **Risk:** No centralized locking library; lease logic duplicated; no deadlock documentation

### (D) Triggers & Cadence
- **Scheduled:** tools(26), writeup-pipeline(48), end-of-shift-portal(114), timesheet-audit(24) — mostly minutely/hourly
- **Event-driven:** delivery-ops(9), orders(9), onboarding(9)
- **Sheet-bound:** hw-intake-ops, hyperassist (deprecated), cultivation
- **No Trigger:** airtable-patches, bug-intake, coa-sync, cultivation-tests, marketing-analytics (util only)

---

## Migration Groups

### Group 1: Order → Fulfillment Pipeline (12–16 dev-days)
**Core:** orders, promotions-engine, delivery-ops, delivery-intel + spinwheel(incentives) + report-builder  
**Unified:** Single Order/Fulfillment service in admin API.  
**Data:** Orders (Blaze + Airtable ledger), promos (Blaze), fulfillment (sheet + Airtable call-offs), incentives (Blaze).  
**Becomes:** POS-Admin order module + FES microservice (Fulfilment Engine Service).  
**Removes:** 4 separate web UIs; 5 trigger sets; inconsistent Blaze auth.  
**Risk:** Onfleet(110) in delivery-intel is dead (last 07-18); may need API versioning.

### Group 2: Real-Time Operations (HR, Timekeeping, Shifts) (10–14 dev-days)
**Core:** end-of-shift-portal, onboarding, timesheet-audit, cultivation (batching) + driver-mgmt(breaks) + writeup-pipeline  
**Unified:** Single HR/Ops dashboard in admin; timekeeping as separate microservice (TMS).  
**Data:** Shifts (Airtable + sheets), clock-ins (Airtable), write-ups (Airtable discipline engine), ID docs (Drive + Airtable).  
**Becomes:** POS-Admin HR module + Timekeeping/Discipline service.  
**Removes:** 3 separate web UIs; 114 triggers collapse to 12–15; license cultivation via TMS.  
**Risk:** writeup-pipeline(248 Airtable refs) is tightly woven; migration must preserve discipline ladder.

### Group 3: Analytics & Reporting (8–10 dev-days)
**Core:** sales, marketing-analytics, scoreboard, scoreboard-legacy, tools(admin reports)  
**Unified:** Data warehouse → unified analytics API.  
**Data:** Blaze KPIs (sales, promotions, wheel), Onfleet ops (scoreboard), store metrics (sales).  
**Becomes:** POS-Admin analytics module.  
**Removes:** 4 separate dashboards; 2 deprecated copies (scoreboard-legacy, marketing-analytics, sales all legacy).  
**Risk:** No BI tool in place yet; scoreboard depends on Onfleet(318 refs), none of which are live in Onfleet (scoreboard queries aggregated JSON, not API).

### Group 4: Support & Tooling (6–8 dev-days)
**Core:** bug-intake, discord-bot, hyperassist-v2(assistant), tools(batch), airtable-patches, coa-sync  
**Unified:** Admin tools hub (in-app macros or standalone).  
**Data:** Minimal (mostly Airtable config + Discord webhooks).  
**Becomes:** Tooling module in admin.  
**Removes:** 2 separate web UIs (discord, coa-sync); hyperassist v1 already deprecated.  
**Risk:** bug-intake is a template; migrations should not touch it.

---

## Retire-Now Candidates

| Project | Evidence | Successor | Action |
|---------|----------|-----------|--------|
| **hyperassist** | Last 08-17, marked "DEPRECATED v1"; v2 live 08-24 | hyperassist-v2 | Archive now (unblock team name) |
| **scoreboard-legacy** | Last 08-25, has identical metrics to scoreboard (live); UI code duplicated | scoreboard | Archive; verify no unique queries remain |
| **marketing-analytics** | Last 07-31, only web UI (2 endpoints); Slack integration present but unused | (retire + use Blaze reports) | Test POS-Admin analytics module covers AlpineIQ role; retire if yes |
| **sales** | Last 07-18, marked "polling (minute) all Blaze stores" — same data in tools, orders, spinwheel | (tools or analytics) | Check if any unique Blaze queries remain; retire if not |
| **cultivation-tests** | Last 07-31, test suite only; cultivation itself is live | (part of cultivation CI) | Archive; no code runs it |
| **delivery-intel** | Last 07-18, final line "Onfleet[110]" is dead; queryOnfleetBreakOps() unused; maps only | (retire + use scoreboard) | Verify no unique Onfleet queries; archive if scoreboard covers |
| **coa-sync** | Last 08-09, only 2 files; single doGet endpoint; Airtable sync marked legacy | (retire) | Verify no live COA sync dependency; archive |
| **meadow-hyperdrive-sync** | Last 08-17, 11 files but trigger-only; no web UI; Meadow integration status unknown | (retire if Meadow dropped) | Verify Meadow still in use; archive if integration ended |
| **daniel-hr** | Last 07-19, only 7 files; airtable(4) refs only; marked "HR milestone workflow" (simple) | (writeup-pipeline covers) | Verify writeup-pipeline covers all cases; archive if yes |

---

## Owner Questions

1. **Blaze API versioning:** No version pins seen across estate. Calls are to `/api/bl/...` or parameterized store IDs. Is there a published Blaze changelog or versioning contract?

2. **Onfleet data freshness:** scoreboard(318 refs) and delivery-intel(110 refs) both query Onfleet; scoreboard is live, delivery-intel is dead. Who owns Onfleet sync, and is delivery-intel data stale?

3. **Airtable auth consolidation:** 867 `AIRTABLE_PAT` refs vs 510 `AIRTABLE_API_KEY` refs. Can auth be unified to a single credential? Are these two different bases?

4. **Lock contention:** driver-mgmt holds `getScriptLock()` for long jobs (breaks, mileage). Will migrations preserve the EXPIRING_LEASE pattern or switch to row-level locks in the DB?

5. **Trigger explosion:** end-of-shift-portal has 114 triggers, timesheet-audit has 24, writeup-pipeline has 48. Is this sustainable in GAS, or should these be cron-driven microservices?

6. **Report-builder scope:** Report-builder is marked live(09-08) but only 8 files and 2.2K lines. Is this a utility that should become a module, or a standalone service?

---

**Report generated:** 2026-09-10  
**Data sources:** grep -a, git log, file counts (no edits)  
**Next:** Validate retire-now list with owner; lock migration group sequencing
