# Didit console cross-reference (read live via Chrome, 2026-09-08 13:25 PT)

Org "Hyperwolf" 06095f80-64a7-44ed-83f7-82ca40371ecb · single application
"Age Verification Hyperwolf THCa" (Live) 2a16cfd3-ff57-45aa-b1e2-7c95ee9365bd. No other app in the switcher.

## Corrections to the 2026-09-08 reference digest and to the brief

- **Usage figures are cumulative, not monthly.** Usage page shows ID Verification 9,391 with
  "154/500 free this month"; Device & IP 9,345 (153 this month); Face Match 7,877 (153); Passive
  Liveness 7,798 (152). Current run-rate is ~150 sessions/month, inside the 500 free tier.
  The $2,657.89 "total cost" is lifetime; White Label Sessions (9,091 × $0.20 = $2,223.60) is the
  only line with no free tier. The brief's "~9,400 a month" is wrong by ~60×.
- **Verifications table: "2.1K verifications", 0 to review. Newest session #14145 on
  2026-08-04 22:00 PT.** Nothing in the last 30 days (dashboard: 0 verifications, all panels
  "No data yet"). Every visible row is workflow "Hemp Verification (no selfie)", channel "Hosted",
  vendor_data = 8-hex-prefixed id (e.g. 983f3e0e…), phone "—". Statuses seen: APPROVED, DECLINED,
  EXPIRED (EXPIRED rows have N/A user info = abandoned before document).
  Session numbering (#14145) vs "2.1K" listed: ~12k sessions are not in the list (deleted, or
  numbering is org-global) — export must go by API pagination, not by #.
- Owner statement 2026-09-08: hemp flow is sunset; cannabis+selfie is the flow to keep. The console
  shows no session on "Cannabis Verification + Selfie" in the visible page; the live site
  (Hyper-Tech-inc/hyperwolf-backend) decides the workflow_id — see live-site digest.
- Face Match and Passive Liveness usage (7.8k) < ID Verification (9.4k): a selfie workflow WAS used
  for most history, so imported sessions will carry liveness/face-match nodes.

## Workflows (unchanged from digest)
Hemp Verification (no selfie) 5eee239f…7b1d52 · Cannabis Verification + Selfie 2fdbd4d4…ee1448 ·
Biometric Authentication 5aa8635b…4d9f1c · Adaptive Age Estimation d82036bf…0a026a. All KYC/SIMPLE.

## Lists (real entries to migrate)
High Risk Countries (CUSTOM, Country, 35, SYSTEM) · User Blocklist 1 · IP Address Blocklist 2 ·
Document Blocklist 1 (all last entry 2026-05-21) · Face Blocklist 0 · Device/Email/Phone/Bank/
Wallet/Business blocklists 0. No allowlists. Biometric templates tab present.

## Settings surface (parity list)
Account · Team & roles · Security · SSO · Usage (Export, Top up, Date + Application filters,
per-feature table incl. two unlocalised rows idVerificationLookup $0.45 / idVerificationWallet
$0.35) · Billing · Referrals · Audit Logs (= API request log: id, method, status, path, user, IP,
date; e.g. GET /v3/organization/{org}/application/{app}/webhook/destinations/, …/white-label-
customization/, …/onboarding-state/) · Terms & Policies · App Settings.
App-level: /lists, /integrate, /developers/api-keys, /customization, /questionnaires, /workflows,
/kyc/verifications, /kyb/verifications, /transactions, /users, /businesses.

## Console-internal API paths observed (audit log) — useful for the parity data model
/v3/organization/{org}/onboarding-state/ · …/application/{app}/webhook/destinations/ ·
…/application/{app}/white-label-customization/
