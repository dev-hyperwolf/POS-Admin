# LP Dashboard — Migration Inventory

Read-only audit, 2026-09-10. Project: `end-of-shift-portal/` (GAS, script id not re-derived).
Sources: `WALKTHROUGH-NOTES-LP.md` (743 ln, cited as file:line throughout — re-derived spot
checks below, not a full re-read), `LP-DASHBOARD-STORE-CLOSEOUTS-UX-AUDIT-2026-09-07.md`,
`LP-HR-MONEY-VISIBILITY-PLAN.md`, `LP-DUPLICATE-BLOCK-2026-08-19.md`, plus direct grep/read of
`end-of-shift-portal/*.gs`. Citations below not already in the notes are freshly verified.

## 1. What it is / users / reach / cadence

**LP Dashboard** (`end-of-shift-portal/LpDashboard.html`, 3602 ln) is the Loss Prevention
triage, adjudication and retail-close-out-verification surface for Hyperwolf's delivery +
retail cash/card reconciliation. It is one of five surfaces in the same GAS project (single
`doPost`/`doGet` router):

| Surface | Route | Audience | File |
|---|---|---|---|
| Closer Report submission (delivery + retail) | default (no param), `?entity=<slug>` | driver/associate, in-store/in-cab | `Form.html` (4654 ln) |
| **LP Dashboard** | `?page=lp` | LP auditor, LP manager, store verifier (retail tab) | `LpDashboard.html` |
| Driver response portal | `?action=respond` (HMAC magic link) | the flagged driver | `ResponsePortal.gs` |
| Manager decision (legacy email buttons) | `?action=decide` / `?action=managerDecision` | LP manager, via email | `ManagerDecision.gs`, dead per `WALKTHROUGH-NOTES-LP.md:632-639` |
| Resolution Log (waste/credit-memo/warranty) | `?action=resolution` | staff only | `ResolutionForm.html`, `ResolutionFormServer.gs` |
| Retail Team Lead verify | `?action=verify` (HMAC) | store lead | `LeadVerify.html` |
| Retail store queue | `?action=queue` | store lead | routed in `FormServer.gs:96` |

Routing: `end-of-shift-portal/FormServer.gs:24-137` (`doGet`), `WebhookHandler.gs:8` (`doPost`,
2 handlers). `page=lp` → `Dashboard.gs:39-54` (`handleLpDashboardGet`), auth = any
`@hyperwolf.com` session on the domain-restricted deployment, no role check
(`Dashboard.gs:29-36`).

**Triggers/cadence** (`ScriptApp.newTrigger`, verified 2026-09-10):
- `sendEosDailyDigest` — daily 8am PT (`ManagerDigest.gs:1335-1336`)
- `checkIncidentAging` — every 4h (`ManagerDigest.gs:1338-1339`)
- `mirrorLossToDirectory` — every 30 min, writes HR base (`LossLedger.gs:343`)
- `RETAIL_AGING_TRIGGER_FN` / `RETAIL_DISPUTE_AGING_TRIGGER_FN` — every 4h (`RetailEngine.gs:7079,7288`) — dispute-aging install is manual-run-only, **not verified installed live** (`WALKTHROUGH-NOTES-LP.md:654-659`)
- `RETAIL_DIGEST_TRIGGER_FN` / `RETAIL_FINDINGS_DIGEST_TRIGGER_FN` (`RetailEngine.gs:7525,7676`)
- `blazeReferenceNightlySweep`, `leisurePayAssociateSyncNightly`, `leisurePayReferenceNightlySweep`, `POLLER_TRIGGER_FN` every 30 min (`Poller.gs:93`), `sendDailyContextReminders`, `eosW_sendWarrantyWeeklyReport`

## 2. Screens and forms

### Screens/dialogs (LpDashboard.html)
| Screen | Anchor | Purpose |
|---|---|---|
| Global chrome (refresh, tabs) | `:120,127-130` | nav |
| Tab 1 Triage — summary strip, 6 KPI cards, filter bar, open table, row drawer, LP Disposition block, Manager Decision block, LP>Blaze panel, Decided table | `:134-170` | daily audit queue |
| Tab 2 By Day — day picker, day table, day drawer (cash figures, auditor notes, Flag→Triage, Re-audit) | `:177-189` | audit every report for a date, not just flagged |
| Tab 3 Store Close-Outs (`HWR` namespace) — identity line, store nav, overview cards, per-store table+drawer, Verify/Dispute form, confirm panel, Re-open panel | `:200-204` | retail till reconciliation |

Full row/column/chip inventory: `WALKTHROUGH-NOTES-LP.md` §§2-5 (already file:line cited;
re-verified spot-checks on §3.7/§3.8/§6 below).

### Forms and fields
| Form | Fields (name: type, required, validation) | Submit writes | Cite |
|---|---|---|---|
| **Closer Report — delivery** (`Form.html`) | driverRecordId (select, req), auditorRecordId (select, req — "who is submitting"), regionWorked (select, req), lpCardCount (int, req), lpCardTotal (currency, req), expectedCashValue (currency, req — Blaze cash total), closerCountedTotal (currency, req), completedOrders (int, req), cashOrders/cardOrders/splitOrders (int), ccSalesTotal (currency, req), cashDenominations+rolledCoinValue+looseCoinValue, returnsFlag/damagedFlag (bool), cancelledItemsResult (per-item note **required** when unverified), cashDiscOverUnder/cashDiscNotes/cashDiscOther, suspiciousBills(+desc), missingCcTxns, brokenHardware/hardwareBroken/missingAccessories (multi-select), paymentDiscrepancy+describeHappened, countMismatchConfirmed (attestation checkbox), expectedCashXrefFlag+Explanation (explanation **required** when flagged) | `createCloserReport` → Closer Reports (`appouBkOofOK3zjN8`/`tblRDz09UwZdkDnoZ`) | `FormServer.gs:2174-2199` (validate), `:2209-2295` (sanitise), `:1636-1717` (submit) |
| **Closer Report — retail** (`Form.html`, `mode='retail'`) | associateRecordId/driverRecordId (req), dailySummaryRecordId (ISO date, req), register (req), expectedCashValue (req), coin counts (int, whole-number validated), float-adequacy check (subset-sum, server-enforced), expectedCashXrefFlag+Explanation | same table, `Mode=Retail`; no `closerCountedTotal` requirement (till count IS the roll-up) | `FormServer.gs:2387-2419` |
| **Driver response** (`ResponsePortal.gs`) | responseText (textarea, req) | `DRIVER_RESPONSE`, response timestamp on the Closer Report | `ResponsePortal.gs:101-102,163-191` |
| **LP Disposition** (LpDashboard, `#disp_/#recov_/#loss_`) | disposition (select: Explained/Process Fix/True Loss, req), Recovered $ / Final Loss $ (3-state: blank/clear/set; True Loss requires Final Loss) | `LP_DISPOSITION`,`AMOUNT_RECOVERED`,`FINAL_LOSS` + by/at | `Dashboard.gs:689-757`, `LpDashboard.html:570-624` |
| **Manager Decision** (LpDashboard) | choice: Approve Write-Up / Dismiss-Coaching (bare `confirm()`, no fields) | `RESOLUTION_STATUS`, `MANAGER_DECISION`(+by/at), `LAST_AUDITED_BY/AT`, Incidents `STATUS`/`ESCALATE_TO_WRITEUP` | `ManagerDecision.gs:347-404` |
| **Re-audit** (By Day) | rastat (select, 6-value server whitelist, req), ranote (text, optional, append-only) | `RESOLUTION_STATUS`,`LAST_AUDITED_BY/AT`,`AUDITOR_NOTES` (prepend) | `Dashboard.gs:775-813` |
| **Retail Verify/Dispute** | Cash counted $, Terminal card total $, Terminal card count (blank≠0 rule), note (required to dispute) | close-out status, `AUDITOR_NOTES`, possible incident/email | `RetailEngine.gs:1322,1775-1789` |
| **Retail Re-open** | note (req), no count fields | status→Pending Verification, re-arms 24h SLA | `RetailEngine.gs:2216-2280` |
| **Resolution Log** (staff-only, waste/credit-memo/warranty) | Amount (>0, req), Employee (req), Order# (req), Reason (req), Submitted by (req), + inventory block when applicable: Brand/Product (or "can't find"), support-mgr approval, weight, qty≥1, METRC tag (req) | Expected Adjustments / Waste Log rows, base `app3JjiGtCwWFpula` | `ResolutionFormServer.gs:449-793` |

## 3. Data stores (read/write, per surface)

**Airtable bases/tables**
- `appouBkOofOK3zjN8` (EOS) `tblRDz09UwZdkDnoZ` Closer Reports — **money + PII (driver identity)**; read/write by nearly every surface (`Config.gs:31,36`)
- `appouBkOofOK3zjN8` `tblIfKfmpKfxUjpd1` Daily Summaries — read (`Config.gs:39`)
- `appouBkOofOK3zjN8` `tblTKoLHp3tTWE3vk` Expected Adjustments — write, money (`Config.gs:645`)
- `app8mI9K1lS1D3Uhk` (HR) `tblDtY9WsQGQOgHgw` Employee Directory — read (join), write by `mirrorLossToDirectory` (**money**, LossLedger.gs:160-205) (`Config.gs:32,37`)
- `app8mI9K1lS1D3Uhk` `tblGkzrBFpSo2EqzP` Incidents (shared with write-up pipeline) — read/write, **PII+discipline** (`Config.gs:38`)
- `app3JjiGtCwWFpula` Waste Log/Credit Memo/Warranty — write from Resolution Log, **money** (`Config.gs:33`)

**Sheets**: `LP_PERF_SHEET_ID` (tab `TERMINALS`, `Dashboard.gs:94`, `BlazeDiagnostics.gs:243-244`); `ORDERS_CANCEL_SHEET_ID` (tab `Cancellations`, `FormServer.gs:2010-2011`, `Setup.gs:388-436`).

**Script Properties** (names only, no values): `AIRTABLE_PAT`, `HMAC_SECRET`, `RESPONSE_PORTAL_URL`, `LP_DASHBOARD_URL`, `DELIVERY_OPS_URL`+`_SECRET`, `EOS_WEBHOOK_SECRET`, `ADMIN_EMAIL`, `ESCALATION_EMAIL`, `EOS_DUP_BLOCK_ENABLED`, `EOS_RETAIL_DUP_BLOCK_ENABLED`, `EOS_AMEND_WINDOW_MIN`, `EOS_EXCLUDED_BUCKET_EMAILS/_EMP_IDS`, `RETAIL_VERIFY_SLA_HOURS`(24), `RETAIL_DISPUTE_SLA_HOURS`(72), `RETAIL_CC_VALUE_TOLERANCE`, `RETAIL_VERIFIER_EMAILS`, `RETAIL_ALL_STORE_EMAILS`, `RETAIL_NO_CARD_AUDIT_STORES`, `RETAIL_SWEEPS_PAUSED`, `RETAIL_DIGEST_MODE`, `RETAIL_FINDINGS_DIGEST`, `HIGH_RISK_LOSS_THRESHOLD`, `SEVERITY_LOW_MAX`/`_MED_MAX`, `RISK_FREQ_MED`/`_HIGH`, `PATTERN_*` (9 props), `EOB_HOUR`, `AUTO_CLOSE_THRESHOLD`, `EXPLAIN_*` (3), `BLAZE_AUTH_KEY_*`, `BLAZE_PARTNER_KEY`, `BLAZE_POS_SETTLE_HOUR`, `BLAZE_EXPECTED_CASH_ENABLED`, `LEISUREPAY_ENABLED`, `LEISUREPAY_DEVICE_REGISTER_MAP_`, `DISCORD_WEBHOOK_URL`, `HR_FROM_EMAIL/_NAME`, `SWAP_TOLERANCE`, `WRITEUP_THRESHOLD_OFFENSES`, `LP_SHIFT_ROLLBACK_HRS`, `RESO_REGIONS_JSON` — full list from `grep getProp_` across `end-of-shift-portal/*.gs`.

**External APIs** (`UrlFetchApp`, hosts grepped): `api.blaze.me` (POS reconcile), `api.connecteam.com`/`v2.connecteam.com` (driver messaging), `cardreceiptshub.com`/`api.cardreceiptshub.com` (LeisurePay card processor), Discord webhook, Airtable REST.

**PII/money flags**: driver/associate email+name (PII) touches nearly everything; cash/card $ amounts touch Closer Reports, Expected Adjustments, LossLedger mirror, Waste Log. No Drive-folder use found in this project.

## 4. Logic worth keeping (file:line) + known defects

- **Duplicate block** (`DuplicateGuard.gs`, 1155 ln) — one close-out per driver/shift-day (delivery), lock-scoped to check→create only (`FormServer.gs:1698-1717`), fails closed on dup / open on error. **Retail has no hard block**, advisory only (`LP-DUPLICATE-BLOCK-2026-08-19.md` §"SCOPE"). Prior no-op bug (link-field `FIND()` never matches) fixed `299129a`; identical bug still live, unfixed, in `writeup-pipeline` (`AiDraftPoller.js:503`, `CorrectionSweep.js:174`, `SignaturePortal.js:145`).
- **Cash-drop reconciliation**: `cashDelta = CASH_TOTAL_CALC − EXPECTED_CASH_VALUE` (`Dashboard.gs:520`); denomination-vs-entered mismatch requires closer attestation (`FormServer.gs:1122-1139`); retail float-adequacy is subset-sum, shared client/server (`RetailFloatPlan.gs`, `FormServer.gs:2420-2440`).
- **Thresholds**: severity Low≤$10/Med≤$50/High else (`Config.gs:247-248`); risk High = lifetime≥$50 OR pattern OR 30d incidents≥4, Med≥2 (`RiskEngine.gs:25-26,90`); retail SLA 24h verify/72h dispute (`Config.gs:284,298`).
- **Escalation**: Approve Write-Up → Airtable checkbox only, no webhook, picked up by `writeup-pipeline` poller every **15 min** (not 5 as legacy page claims) (`ManagerDecision.gs:347-404`, `AiDraftPoller.js:523`). Dismiss sends nothing to the employee — intentional silence (`ManagerDecision.gs:385-400`).
- **Digest**: daily 8am PT manager digest + 4h aging sweep (`ManagerDigest.gs:1335-1339`).
- **Known defects/open items (from notes, not yet fixed)**: `submitLpDecision`/`submitLpDisposition` take no lock, can re-fire on repeat click (`Dashboard.gs:829-831`); Reassign/Release have no ownership check (`Dashboard.gs:873-906`); "Other…" reassign accepts any syntactically-valid email, no domain check (`Dashboard.gs:853`); once a manager decision is recorded, LP Disposition can never be changed again (no drawer on Decided rows); `AUDITOR_NOTES` invisible on Triage tab, only visible via By Day (`Dashboard.gs:629-679`); two incompatible note-author formats in one field; `mirrorLossToDirectory` never clears a driver who drops out of the rollup map — stale non-zero figure persists (`LossLedger.gs:63-64,166`, flagged 🔴 most dangerous in `LP-HR-MONEY-VISIBILITY-PLAN.md` §2.1c); `state.isAdmin` client-side flag in the *HR* dashboard is hardcoded `true` and never gates anything real (cross-referenced, `onboarding/Index.html:451`); retail dispute-aging trigger install unverified live; UX audit (`LP-DASHBOARD-STORE-CLOSEOUTS-UX-AUDIT-2026-09-07.md`) — no urgency ordering, no keyboard access, no responsive table, mouse-only rows, no aria-live.

## 5. Migration map

| LP screen/form | → POS-Admin / wm-demo | Contract shapes | Build | Retires | Order |
|---|---|---|---|---|---|
| Triage tab (KPIs, filters, table, drawer) | POS-Admin new "LP Triage" screen (React), reading wm-demo `/lp/incidents` | `Person`(driver), `Money`, new `Discrepancy`/`Incident` shape (status, severity, disposition, deltas) — no existing contract fits | Discrepancy engine port (severity/risk/pattern calc) to wm-demo Python; React table+drawer | `LpDashboard.html` Tab 1 | 1st — highest daily use |
| LP Disposition + Manager Decision | POS-Admin dialog on same screen, wm-demo `/lp/incidents/{id}/decision` | `Money`, `Person`(manager), `ContractEvent` for escalation | Server-side decision endpoint w/ idempotency + lock (fixes existing gap) | `ManagerDecision.gs`, legacy email path | 1st, same slice |
| By Day tab (all reports, re-audit, Flag→Triage) | POS-Admin "Daily Audit" view, wm-demo `/lp/reports?date=` | reuses `Discrepancy` | port cash-figures view + auditor-notes log (unify note format) | `LpDashboard.html` Tab 2 | 2nd |
| Store Close-Outs (HWR) | POS-Admin "Store Close-Outs" screen, wm-demo `/lp/closeouts` | `Store`, `Money`, `Person`; new `Closeout` shape (SLA clocks, status) | port urgency ordering + UX fixes from the 2026-09-07 audit while rebuilding (cheaper than porting then fixing) | `LpDashboard.html` Tab 3, `RetailEngine.gs` verify/dispute/reopen | 3rd |
| Closer Report form (delivery+retail) | Form-generator saved definition (per the planned generator) feeding wm-demo `/lp/reports` POST | `Person`, `Store`, `Money`, `Order`-adjacent line items for cancelled-item notes | build the generator's money/coin-count/attestation field types first — this form is the hardest one it must support | `Form.html` | 4th — depends on generator existing |
| Driver response portal | POS-Admin/staff-portal "respond" flow or keep as a lightweight token-gated page | `Person`, `ContractEvent` | keep HMAC magic-link pattern; simplest surface | `ResponsePortal.gs` | alongside triage |
| Resolution Log (waste/credit-memo) | Separate from LP — feeds `Product`/`Batch`/`Movement` contracts already defined | `Product`, `Batch`, `Movement`, `Money` | lowest priority, different domain (inventory, not cash) | `ResolutionForm.html` | last |
| LossLedger mirror | Replace with a live wm-demo query (per-employee 4-state total per `LP-HR-MONEY-VISIBILITY-PLAN.md` §6) instead of a cross-base Airtable mirror | `Money`, `Person` | fix the "never clears" bug as part of the rebuild, not before | `LossLedger.gs` mirror only (keep ledger calc) | with Triage slice |

**Elite-dev hours (rough order-of-magnitude, not a quote)**: Triage+Decision slice ~40-60h
(discrepancy engine + risk/pattern port + UI); By Day ~15-20h; Store Close-Outs ~35-50h
(includes the UX-audit fixes); Closer Report form ~30-40h *after* the form generator exists,
+generator itself is a separate multi-week effort; Driver response ~8-10h; Resolution Log
~20-25h. Total LP-only, excluding the form generator: roughly 150-200h.

## 6. Questions for the owner

1. Retail has no hard duplicate block server-side — build it now as part of migration, or carry the gap forward?
2. LP→HR money-visibility plan (§9.3.2) needs a named roster for who may see an employee's cash history in the new admin — who?
3. Should "corrected — not a loss" rows appear on the new HR-visible cash card at all, or only in LP's own view?
4. Keep the legacy email-button manager-decision path (dead code, still live) or drop it in the rebuild?
5. Is retail dispute-aging trigger (`RETAIL_DISPUTE_AGING_TRIGGER_FN`) actually installed today — needed to know if disputes currently auto-escalate at all?
6. Form generator: does it need to support the retail float subset-sum check and coin-denomination counting as first-class field types, or is Closer Report special-cased?
7. Priority: ship Store Close-Outs UX fixes in the old GAS screen now, or fold them straight into the React rebuild (skip fixing what's being replaced)?
8. Any objection to replacing the 30-min Airtable loss-mirror with a live query (removes a known stale-data bug but changes the read path HR currently depends on)?
