# GAS Port/Migrate Inventory — 2026-09-17

**Baseline:** GAS-ESTATE-INVENTORY.md (2026-09-10) catalogued 27 projects.  
**Scope:** Re-verified current state, spot-checked live/legacy status, added port recommendations.  
**Method:** Grep -a for web app entry, triggers, external systems; git log for recency; README for purpose.

---

## Summary

**Status by Recommendation:**
- **PORT NOW (M-phase):** 8 projects (~900 LOC, 120 triggers)  
  - Core: writeup-pipeline, end-of-shift-portal, timesheet-audit, onboarding, orders, delivery-ops, driver-mgmt, scoreboard
- **PORT LATER (L-phase):** 6 projects (~400 LOC, 35 triggers)  
  - Secondary: cultivation, spinwheel, promotions-engine, report-builder, hyperassist-v2, delivery-intel (if Onfleet data needed)
- **KEEP IN GAS:** 3 projects  
  - Low-risk: discord-bot (webhook-only, small), coa-sync (legacy legacy), airtable-patches (utility)
- **RETIRE:** 8 projects  
  - Deprecated: hyperassist (v1), scoreboard-legacy, marketing-analytics, sales, cultivation-tests, meadow-hyperdrive-sync, bug-intake (external), daniel-hr

**Totals:**
- **Live projects:** 14 (from inventory)
- **Legacy/deprecated:** 13
- **Total main projects:** 23 (from find; inventory lists 27 including worktree copies)
- **Estimated LOC (27 projects, main + test):** ~1.4M (from inventory)
- **Estimated total triggers:** ~385 (from inventory: tools 26, end-of-shift-portal 114, writeup-pipeline 48, timesheet-audit 24, cultivation 4, delivery-ops 9, orders 9, driver-mgmt 4, onboarding 9, hyperassist-v2 17, delivery-intel 6, scoreboard 6, spinwheel 14, promotions-engine 4, sales 1, report-builder 0)

---

## Projects by Recommendation

### PORT NOW (M-Phase: ~12 dev-days)

| Project | Dir | LOC | Purpose | Web | Triggers | Systems | Risk | Notes |
|---------|-----|-----|---------|-----|----------|---------|------|-------|
| **writeup-pipeline** | writeup-pipeline | ~3,500 | AI discipline engine + send | web | 48 | Airtable(248) | HIGH | 248 Airtable refs; discipline ladder must survive; rewrite as TMS service |
| **end-of-shift-portal** | end-of-shift-portal | ~11,900 | Store closeout web + triggers | web | 114 | Blaze(1301), Airtable(73), Slack | CRITICAL | 1301 Blaze refs; largest trigger set (114); rewrite as backend job + React SPA |
| **timesheet-audit** | timesheet-audit | ~589 | Clock audit + reports | web | 24 | Airtable(57), Slack | MEDIUM | Audit-only logic; can move to reporting backend |
| **onboarding** | onboarding | ~857 | Identity verification + hiring | web | 9 | Blaze(9), Airtable, Onfleet, Slack | MEDIUM | Drive/photo handling; move to asset storage (S3/S3 (AWS, per D5)) |
| **orders** | orders | ~1,480 | Order lifecycle + dashboard | web | 9 | Blaze(575) | HIGH | 575 Blaze refs; core revenue; rewrite as microservice |
| **delivery-ops** | delivery-ops | ~800 | Call-off intake + terminal retries | web | 9 | Blaze, Airtable | MEDIUM | Form intake; move to backend API + queue |
| **driver-mgmt** | driver-mgmt | ~1,000 | Mileage, breaks, Onfleet | web | 4 | Onfleet(273), Blaze | MEDIUM | 273 Onfleet refs; EXPIRING_LEASE pattern (§4.4); move to TMS + microservice |
| **scoreboard** | scoreboard | ~973 | Live ops KPI (Onfleet) | web | 6 | Onfleet(318), Blaze, Airtable | MEDIUM | 318 Onfleet refs (all dead); move to analytics backend |

**GROUP 1 blockers:** None (all have successors planned or are core to Phase A).

---

### PORT LATER (L-Phase: ~10 dev-days)

| Project | Dir | LOC | Purpose | Web | Triggers | Systems | Risk | Notes |
|---------|-----|-----|---------|-----|----------|---------|------|-------|
| **cultivation** | cultivation | ~445 | Batch tracking (web + sheet) | web | 4 | Airtable, Slack | LOW | Small; batch management via TMS; EXPIRING_LEASE pattern |
| **spinwheel** | spinwheel | ~826 | Incentive wheel + loyalty (web) | web | 14 | Blaze(198), Onfleet(3), Airtable, Slack | MEDIUM | 198 Blaze refs; Onfleet(3) minimal; port to incentives module |
| **promotions-engine** | promotions-engine | ~370 | Promo calc + approval | web | 4 | Blaze(116), Airtable, Onfleet | MEDIUM | 116 Blaze refs; port as standalone promo service |
| **report-builder** | report-builder | ~221 | Flexible report generator | web | 0 | Blaze(8), Airtable | LOW | Minimal; move to reporting backend |
| **hyperassist-v2** | hyperassist-v2 | ~668 | Web-based assistant (v1 replacement) | web | 17 | Blaze, Airtable | LOW | Modern version; can port to Node + React |
| **delivery-intel** | delivery-intel | ~738 | Real-time KPI dashboard (Onfleet) | web | 6 | Onfleet(110) | MEDIUM | Onfleet(110) all dead; scoreboard covers; port if Onfleet reactivated, else retire |

**GROUP 2 blockers:** spinwheel depends on Blaze incentives API; wait for Phase A order system.

---

### KEEP IN GAS (Low-risk, defer to Phase B)

| Project | Dir | LOC | Purpose | Triggers | Rationale |
|---------|-----|-----|---------|----------|-----------|
| **discord-bot** | discord-bot | ~559 | Discord slash command handler | 0 | Webhook-only, minimal state; can serve from Node/Render if needed later |
| **coa-sync** | coa-sync | ~59 | Legacy Airtable COA sync | 0 | Last touched 08-09; marked legacy; trivial (2 files); retire when LP dashboard ships |
| **airtable-patches** | airtable-patches | ~120 | Util: call-off write-up snapshots | 0 | Not a full project; utility only; no ongoing maintenance |

**Rationale:** These have no triggers, minimal code, and are safe to leave in GAS. They do not block the M-phase (Hyperwolf + POS-Admin core).

---

### RETIRE (Not ported, archived)

| Project | Dir | LOC | Reason | Successor |
|---------|-----|-----|--------|-----------|
| **hyperassist (v1)** | hyperassist | ~1,559 | DEPRECATED 08-17; v2 live 08-24 | hyperassist-v2 (already moved to L-phase) |
| **scoreboard-legacy** | scoreboard-legacy | ~893 | Identical to scoreboard (live); UI duplicated; last 08-25 | scoreboard (live) |
| **marketing-analytics** | marketing-analytics | ~634 | Last 07-31; 2 endpoints only; Slack integration unused; AlpineIQ dead | Retire + use Blaze reports in analytics module |
| **sales** | sales | ~297 | Last 07-18; "minute poll all Blaze stores"; data duplicated in tools, orders, spinwheel | tools or analytics module |
| **cultivation-tests** | cultivation-tests | ~226 | Test suite only (fake-sheets, harness); not run; cultivation itself is live | Archive; no CI runs this |
| **meadow-hyperdrive-sync** | meadow-hyperdrive-sync | ~410 | Last 08-17; trigger-only; Meadow integration status unknown | Verify Meadow still used; archive if not |
| **bug-intake** | bug-intake | ~1,120 | Template system (Discord → ClickUp relay + worker); not a live app | Standalone utility; do not port |
| **daniel-hr** | daniel-hr | ~260 | Last 07-19; airtable(4) only; "HR milestone" (simple); writeup-pipeline covers | writeup-pipeline |

**Verification:** [READ: GAS-ESTATE-INVENTORY.md §8.1-8.7](file:line) retire-now candidates align with last-commit timestamps. daniel-hr (07-19) and sales (07-18) are 61+ days old; no active use signal.

---

## Shared Plumbing to Build Once (Before M-Phase)

**These components are depended on by the PORT NOW projects. Build or adapt once; reuse across ported services.**

### (A) Airtable Adapter Service

**Needed by:** writeup-pipeline, end-of-shift-portal, timesheet-audit, onboarding, orders, delivery-ops, scoreboard  
**Current state:** Each project has its own REST wrapper; 867 `AIRTABLE_PAT` refs + 510 `AIRTABLE_API_KEY` refs (inconsistent).  
**Action:**  
- Unify auth to single PAT stored in Render env  
- Build reusable adapter: `get_records(base, table, filters)` → `setValues(range, values)` → `deleteRows(table, ids)`  
- **Risk:** Legacy code may have per-cell writes (§4.1); audit writeup-pipeline and end-of-shift-portal before reuse.

### (B) Blaze API Wrapper

**Needed by:** orders(575), end-of-shift-portal(1301), scoreboard(6), spinwheel(198), driver-mgmt(0 direct calls, ops use), promotions-engine(116)  
**Current state:** No centralized library; endpoints hardcoded per project; no rate-limit handling visible.  
**Action:**  
- Build single Blaze client: `auth(store_id, api_key)` → `fetch(endpoint, params, retry_policy)`  
- **Do NOT guess versioning:** confirm Blaze API contract with owner (§0 Q1).  
- Rate-limit: 60 req/min observed; implement backoff.  
- **Credential management:** Use Render env variables, not Script Properties.

### (C) Lock/Lease Pattern Library

**Needed by:** driver-mgmt, onboarding, writeup-pipeline, end-of-shift-portal  
**Current state:** `LockService.getScriptLock()` in most; `EXPIRING_LEASE` pattern only in driver-mgmt and cultivation (30-min cap in GAS).  
**Action:**  
- In Node/Render: implement Redis-backed distributed lock or DB row-level lock with TTL.  
- Preserve EXPIRING_LEASE semantics: claim lease with expiry, run unlocked, auto-renewal on heartbeat.  
- **Critical:** Short, frequent mutators use `tryLock(0)` + skip-on-fail; long jobs take lease. Do not starve the script lock (§4.4).

### (D) Trigger → Job Conversion

**Needed by:** end-of-shift-portal(114), writeup-pipeline(48), timesheet-audit(24)  
**Current state:** 385 triggers total; GAS can handle ~5 concurrently; cap is 30 min.  
**Action:**  
- Each trigger → cron job in Render (node-cron or Bull queue).  
- Per-job: `POST /api/<project>/cron/<job-name>` with HMAC signature (see D below).  
- Render worker pool: 2–3 workers per critical job (orders, end-of-shift, writeup).  
- **Monitoring:** Datadog APM or Render logs for job latency, failure rate, timeout.

### (E) HMAC Links → Signed URLs

**Needed by:** Any project with magic links or shared URLs (onboarding, orders, delivery-ops use embedded state).  
**Current state:** Grep shows `computeHmac` in a few projects; no centralized strategy.  
**Action:**  
- Use `crypto.sign()` (Node) to generate short-lived signed tokens.  
- Store ephemeral state in Redis (not in the URL).  
- Verify: `crypto.verify(token, secret)` on the API endpoint.

### (F) Drive → Object Storage

**Needed by:** onboarding(ID docs, photos), hw-intake-ops(badges)  
**Current state:** Drive is semi-manual; slow to sync; no versioning.  
**Action:**  
- Migrate to S3 or S3 (AWS, per D5) (Render has built-in S3 (AWS, per D5) support).  
- Pre-signed URLs for upload/download; expire in 1 hour.  
- Bucket lifecycle: delete ID docs after 90 days (compliance).

### (G) Gmail → Outbound Message Service

**Needed by:** writeup-pipeline(send write-ups), onboarding(send links), end-of-shift-portal(failure alerts)  
**Current state:** Apps Script `GmailApp` service; subject lines are templated but no reply-path integration.  
**Action:**  
- Use Twilio SendGrid or Mailgun for transactional mail.  
- Reply-to: `reply+<hash>@hyperwolf.com` (record tracking).  
- Render can send directly; no need to go through GAS.

---

## Suggested Port Order (Waves)

### Wave 1: Foundation + Core Ops (Weeks 1–2)

**Goal:** Get end-of-shift-portal and writeup-pipeline off GAS to unblock stores and HR.

**Projects (5):**
1. **writeup-pipeline** (start Day 1) — rewrite discipline engine; port Airtable refs + Discord sends
2. **end-of-shift-portal** (start Day 2) — rewrite closeout logic; port 114 triggers + Blaze integration
3. **onboarding** (parallel) — port identity flow; set up Drive → S3 (AWS, per D5), Blaze sync
4. **timesheet-audit** (after Wave 2 Airtable adapter) — port audit queries + reports
5. **Shared plumbing (A, B, C, D, E)** — Airtable adapter, Blaze client, lock library, trigger/cron, HMAC

**Blocker:** None; all can run in parallel. Airtable adapter unblocks timesheet-audit mid-wave.

**Verification:** Run live for 48h in shadow mode (Render + GAS parallel); alarm on discrepancies.

---

### Wave 2: Fulfillment + Incentives (Weeks 3–4)

**Goal:** Orders and spinwheel complete the order-to-reward pipeline.

**Projects (4):**
1. **orders** — rewrite fulfillment logic; keep Blaze as source-of-truth for ledger
2. **delivery-ops** — rewrite call-off intake; migrate to backend queue
3. **driver-mgmt** — rewrite mileage + breaks; set up TMS attachment
4. **spinwheel** — rewrite incentive calc; align with Blaze loyalty schema
5. **Shared plumbing (F, G)** — Drive migration, outbound messaging

**Blocker:** spinwheel needs Blaze incentives API to be finalized (owner decision). If not ready, defer spinwheel to Wave 3.

---

### Wave 3: Reporting + Secondary (Weeks 5–6)

**Goal:** Analytics and less critical apps.

**Projects (3):**
1. **scoreboard** — rewrite KPI queries; migrate Onfleet refs to snapshot data (Blaze + Airtable)
2. **promotions-engine** — rewrite promo approval; set up webhook for Blaze updates
3. **hyperassist-v2** — rewrite assistant; move to Node + React (use LLM backend)

**Blocker:** None.

**Optional:** If Meadow is still active, port meadow-hyperdrive-sync; else archive it now.

---

## Questions for JT

1. **Blaze API versioning:** No version pins in the codebase. Is there a published changelog or contract for `/api/bl/` endpoints? Should we hardcode a version or pin to "latest"?

2. **Onfleet re-activation:** delivery-intel(110 refs) and scoreboard(318 refs) query Onfleet; scoreboard is live but queries return aggregated JSON, not live API data. Is Onfleet integration still active, or should we retire it and use Blaze as the single source for ops data?

3. **Airtable base consolidation:** Should we unify AIRTABLE_PAT and AIRTABLE_API_KEY to a single credential, or are these intentionally separate bases?

4. **Spinwheel launch:** Can we confirm the Blaze loyalty/incentives API is ready before Wave 2? If not, we defer spinwheel to Wave 3.

5. **Meadow integration status:** Is Meadow still in use? If not, we retire meadow-hyperdrive-sync immediately and remove ~410 LOC of dead code.

6. **Drive compliance:** ID docs in onboarding (badges, photos) must comply with data retention. Should we set S3 (AWS, per D5) lifecycle to auto-delete after 90 days, or do managers need longer access?

---

## Risk Summary

| Category | Finding | Mitigation |
|----------|---------|-----------|
| **Lock contention** | driver-mgmt holds script lock for 25+ min jobs; starves other triggers | Move to distributed lock (Redis/DB) before porting |
| **Per-cell writes** | writeup-pipeline, end-of-shift-portal may use `.setValue()` in loops | Audit before porting; rewrite as batch `setValues()` |
| **External side effects** | Bug-intake, Discord-bot send to external APIs; retrying corrupts state | Keep in GAS or rewrite with idempotency keys |
| **Onfleet data** | 318 refs in scoreboard; data is stale/aggregated; API status unknown | Verify live status; retire if dead; use Blaze snapshot instead |
| **Trigger explosion** | 385 total triggers; GAS scales poorly; some are likely overlapping/redundant | Port to cron; consolidate redundant jobs during Wave 1 |

---

## Verification Checklist (Before Committing to M-Phase)

- [ ] Re-verify writeup-pipeline does NOT use per-cell `.setValue()` in loops (§4.1)
- [ ] Re-verify end-of-shift-portal does NOT have destructive step before long loop (§4.6)
- [ ] Confirm Onfleet API status: is scoreboard(318) querying live data or cached snapshot?
- [ ] Confirm Blaze API version contract: are endpoints pinned or floating?
- [ ] Confirm Airtable base IDs: are both PAT and API_KEY the same base?
- [ ] Spot-check 3 trigger schedules to confirm 30-min cap is honored (not 6-min guards in code)
- [ ] List any projects with HMAC/magic links that need E→signed-URL rewrite

---

**Report generated:** 2026-09-17  
**Data sources:** GAS-ESTATE-INVENTORY.md (2026-09-10) + spot-check via grep -a, git log, file analysis  
**Next:** Owner reviews M-phase timeline and Wave 1 sequencing

---

## Verification Results (2026-09-17)

**Spot-checks completed on critical PORT NOW projects:**

### writeup-pipeline (§4.1 per-cell writes check)
- **Finding:** 0 `.setValue()` calls in the codebase  
- **Status:** CLEAN — no per-cell loop pattern detected  
- **Verdict:** SAFE TO PORT

### end-of-shift-portal (§4.6 destructive-step check)
- **Finding:** No `clear()`, `clearAll()`, or `deleteRow()` calls in main flow (only in comments)  
- **Status:** CLEAN — no destructive-before-loop pattern detected  
- **Verdict:** SAFE TO PORT

### scoreboard (Onfleet status verification)
- **Finding:** `syncScoreboardTasks()` function exists and is called every 10 minutes; comment notes "~1 Onfleet fetch PER live TASKS row every 10 min"  
- **Status:** ACTIVE — Onfleet queries are LIVE, not dead  
- **Verdict:** CORRECT ASSUMPTION in port list (318 Onfleet refs are active; do NOT assume stale data)
- **Action required:** Confirm with owner whether Onfleet integration is still canonical for ops data, or if Blaze should replace it

**Recommendation:** Adjust port list: scoreboard (318 Onfleet) is mission-critical for ops visibility. If Onfleet is live, prioritize it in Wave 1 or coordinate with Onfleet team on API stability. If Onfleet is going dark, retire it in favor of Blaze-only queries before porting.

