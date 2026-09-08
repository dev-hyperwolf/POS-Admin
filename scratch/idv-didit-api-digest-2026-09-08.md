# Didit Identity-Verification API — Field-Exact Reference Digest
_Captured 2026-09-08. Every field/enum/header below was read from a fetched document; anything not confirmed is marked **UNVERIFIED**. Primary sources: `openapi-25.json` (v3.0.0, 145 paths / 97 component schemas, downloaded to `idv-didit-openapi-25.json`), `openapi-auth.json` (Auth API, downloaded to `idv-didit-openapi-auth.json`), and the docs.didit.me pages cited per section._

---

## 1. Auth

Source: `openapi-auth.json` (server `https://apx.didit.me/auth/v2`) + `https://docs.didit.me/api-reference/overview`.

**Two separate credential systems:**

1. **`x-api-key`** — the long-lived application secret. Sent on every call to `https://verification.didit.me/v3/...` (sessions, workflows, standalone APIs, AML, etc). Never expires by itself; only rotated by creating a new application or (per the Console) manually.
2. **`Authorization: Bearer <access_token>`** — RS256 JWT, used only for Account Management endpoints on `apx.didit.me/auth/v2` (register, login, list/manage organizations & applications). Default lifetime `86400`s (`expires_in`).

**Base URLs**
| Purpose | Base URL |
|---|---|
| Verification / sessions / standalone APIs | `https://verification.didit.me/v3/` |
| Account Management / programmatic onboarding | `https://apx.didit.me/auth/v2` |
| Hosted verification flow | `https://verify.didit.me/{language}/session/{session_token}` |
| MCP server | `https://mcp.didit.me/mcp` (see §Export plan) |

**Programmatic account creation** (`https://docs.didit.me/integration/integration-prompt` calls this "two API calls, no browser, no 2FA"):

| Step | Method + path | Request fields | Response fields |
|---|---|---|---|
| 1. Register | `POST /programmatic/register/` | `email` (required), `password` (required, min 8 chars, needs upper/lower/digit/special char) | `message`, `email` |
| 2. Verify email | `POST /programmatic/verify-email/` | `email` (required), `code` (required, 6-char alphanumeric, 10 min TTL) | `access_token`, `refresh_token`, `expires_in`, `organization{uuid,name}`, `application{uuid,name,client_id,api_key}` — **persist `application.api_key` now** |
| Resend | `POST /programmatic/resend-otp/` | `email`, `password` | `{}` (200) |
| Login (existing) | `POST /programmatic/login/` | `email`, `password` | `access_token`, `refresh_token`, `expires_in`, `message` |

Rate limits (from operation descriptions): register 5/IP/hour; resend-otp 60s per-email cooldown + same 5/IP/hour budget.

**Organization / application management** (Bearer-token, owner/admin only):

| Method + path | Purpose | Key response fields |
|---|---|---|
| `GET /organizations/me/` | List orgs the user belongs to | array of `{uuid, name, contact_email, created_at}` |
| `POST /organizations/me/{org_id}/applications/` | Create application | `{uuid, name, client_id, api_key, website_url, redirect_uris, terms_url, privacy_url, description, created_at}` |
| `GET /organizations/me/{org_id}/applications/` | List applications | (used to discover `app_id` to recover a lost key) |
| `GET /organizations/me/{org_id}/applications/{app_id}/` | Get application credentials (recover lost `api_key`) | same shape as create |
| `PATCH /organizations/me/{org_id}/applications/{app_id}/` | Update metadata (`api_key`/`client_id` never rotate) | same shape |

**Application-level request fields** (create/update): `name`, `website_url`, `redirect_uris[]`, `terms_url`, `privacy_url`, `description` — all optional; empty body creates an app named `"<organization name> App"`.

**Rate limits (verification API, general)** — `api-reference/overview`: free tier 10 req/min, paid tier 600 req/min, `429` on breach. Per-endpoint limits are more specific and are noted next to each operation below (they override the general figure).

**Auth failure semantics** — repeatedly confirmed across every `/v3/...` operation: **this API never returns `401`**. Missing/invalid/expired `x-api-key` returns `403` with `{"detail": "..."}`; the two `detail` strings that recur are `"Authentication credentials were not provided or are invalid."` and `"You do not have permission to perform this action."`, with no machine-readable discriminator. Exception: `POST /v3/session/{sessionId}/share/` (Reusable KYC) does return `401` for missing/invalid credentials — the one endpoint in the spec that follows the standard permission decorator.

---

## 2. Session lifecycle (create → open → webhook → decision)

Source: `openapi-25.json` operations `post_v3_session_create`, `get_v3_session_decision`, `patch_v3_session_update_status`; `https://docs.didit.me/integration/webhooks`; `https://docs.didit.me/sessions-api/update-status`.

### 2.1 Create — `POST /v3/session/`

Request body (`application/json`), required: `workflow_id` (uuid). Optional top-level: `vendor_data`, `callback`, `callback_method` (enum `initiator`|`completer`|`both`, default `initiator`), `metadata` (any JSON), `language` (ISO 639-1, full enum: en, ar, bg, bn, bs, ca, cnr, cs, da, de, el, es, et, fa, fi, fr, he, hi, hr, hu, hy, id, it, ja, ka, kk, ko, ky, lt, lv, mk, mn, ms, nl, no, pl, pt-BR, pt, ro, ru, sk, sl, so, sq, sr, sv, th, tr, uk, uz, vi, zh-CN, zh-TW, zh), `portrait_image` (base64, ≤2MB), `sandbox_scenario`.

Nested `contact_details{}`: `email`, `send_notification_emails` (bool, default false), `email_lang`, `phone` (E.164).

Nested `expected_details{}`: `first_name`, `last_name`, `date_of_birth`, `gender` (`M`|`F`|null), `nationality`, `country`, `address`, `identification_number`, `ip_address`, `expected_document_types[]` (codes: `P`,`ID`,`DL`,`RP`,`HIC`,`TC`,`SSC`), `id_country`, `poa_country`, `company_name`, `registry_country`, `registration_number` (last three KYB-only).

**Idempotency**: an unfinished session (`Not Started`/`In Progress`/`Resubmitted`/`Awaiting User`) with the same `vendor_data` on the workflow's *current latest published version* is returned instead of creating a duplicate (still `201`), with `callback`/`metadata` refreshed. Sessions on an older republished workflow version are not reused.

Response `201`: `session_id` (uuid), `session_number` (int), `session_token` (12-char, URL-safe), `url` (hosted flow), `vendor_data`, `metadata`, `status` (one of the 10 literals, §3), `callback`, `workflow_id`, `workflow_version` (int). `400` on validation/insufficient credits; `403` (never `401`) on auth; `429` at 600 session-creates/min/API-key.

```json
// Request
{"workflow_id":"3f9a...","vendor_data":"user_42","callback":"https://app.example.com/kyc/done",
 "language":"en","contact_details":{"email":"a@b.com","send_notification_emails":true}}
// Response 201
{"session_id":"7d4f1f60-...","session_number":1234,"session_token":"aB3xQ9zK7m2p",
 "url":"https://verify.didit.me/en/session/aB3xQ9zK7m2p","vendor_data":"user_42",
 "metadata":null,"status":"Not Started","callback":"https://app.example.com/kyc/done",
 "workflow_id":"3f9a...","workflow_version":4}
```

### 2.2 Open — hosted flow / SDK
The end user opens `url` (embeds `session_token`); native SDKs take `session_token` directly. Not part of the REST surface itself — see §10 for SDK package names captured from the AI-integration prompt.

### 2.3 Webhook — see §5 in full.

### 2.4 Decision — `GET /v3/session/{sessionId}/decision/`
See §4 for the full field-by-field object. `include=events` query param adds `events`, `activity_reviews`, `blocklisted`, `cost_breakdown` (per session's own description — cut off at the fetch boundary in the raw spec, but these four keys are explicit). Rate limit: 600 GET/min/credential (source: endpoint's own `429` description); switch to webhook-then-fetch if hitting this while polling. `403` (never `401`) for auth failures — two distinct `detail` strings as above. `404` when the id resolves to neither a KYC nor KYB session (owner lookup runs *before* credential validation, so `404` also fires unauthenticated).

### 2.5 Manual decision — `PATCH /v3/session/{sessionId}/update-status/`
Eligible current states: `Approved`, `Declined`, `In Review`, `Kyc Expired`, `Abandoned`, `Resubmitted` (i.e. NOT `Not Started`/`In Progress`/`Awaiting User`/`Expired` → `400 Wrong Current Status`, checked *before* body validation). Requires `write:sessions`.

Request: `new_status` (required, enum `Approved`|`Declined`|`Resubmitted`), `comment`, `nodes_to_resubmit[]` (only acted on for `Resubmitted`; each item `{node_id, feature}` — feature enum has 24 values incl. aliases `ID_VERIFICATION`→`OCR`, `POA`→`PROOF_OF_ADDRESS`, `PHONE`→`PHONE_VERIFICATION`, `EMAIL`→`EMAIL_VERIFICATION`; `KYB_REGISTRY`/`KYB_KEY_PEOPLE`/`KYB` always `400`), `send_email` (bool), `email_address` (required if `send_email`), `email_language`.

If `nodes_to_resubmit` omitted on `Resubmitted`, server auto-selects existing OCR/Liveness/Face Match/POA/Phone/Email/AML/Database Validation/Questionnaire attempts whose status is `Declined`/`In Review`/`Not Finished`/`Expired` — **never-attempted features are not auto-selected**, so a zero-attempt session gets `400 "No features found that need resubmission"`. Backend-only steps (`AML`, `DATABASE_VALIDATION`, `IP_ANALYSIS`) at the head of the list run immediately with no user interaction; if every resubmitted step is backend-only the session re-finalizes within the same request. Response `200`: `{"session_id": "<uuid>"}` only — re-fetch the decision for the new state. `429` if a backend-only-only resubmit repeats inside a 30s cooldown. Fires `status.updated` webhook once committed.

### 2.6 Delete / batch delete
`DELETE /v3/session/{sessionId}/delete/` — single session (KYC or KYB), body optional: `retain_face_embeddings` (bool|null), `face_retention_days` (1–3650), `face_retention_deadline` (datetime), `deletion_instruction` (`operational_session_delete`|`privacy_erasure`, default former), `instruction_id`. Response `200`: `session_id`, `session_number`, `face_retention_outcome` (`retained_with_user`|`deleted`|`none`|`ineligible_no_vendor_user`), `biometric_template_uuid` (nullable). Deletes decision, extracted data, feature records, and **all** stored media (document photos/videos, portrait crops, NFC images, liveness videos, face-match images, POA docs, extra files); previously issued media URLs stop resolving. **Not affected**: blocklist entries from the session, already-issued share tokens, already-queued webhook deliveries, consumed credits, the parent User/Business entity. `503` if a biometric store is unavailable (nothing deleted; retry — idempotent).

`POST /v3/sessions/delete/` — **KYC only**, by `session_number` (digit-string array) or `delete_all: true`. Same retention/instruction fields as above. Unknown/mismatched numbers are **silently skipped** (no per-item failure report, still `200`). Response: `results[]` of `{session_id, session_number, face_retention_outcome, biometric_template_uuid}` — `face_retention_outcome: failed_retryable` means that one item was NOT deleted. No webhook fires for deletions; no undo. Shared write rate limit: **300 POST/PATCH/DELETE per minute per API key** (stated on both delete endpoints' `429`).

### 2.7 PDF — `GET /v3/session/{sessionId}/generate-pdf/`
Eligible statuses: KYC `Approved`/`Declined`/`In Review`/`Kyc Expired`; KYB `Approved`/`Declined`/`In Review` — else `403` with an explanatory `detail`. Returns raw `application/pdf` binary (no JSON wrapper, no URL indirection), starts with `%PDF` (v1.7). No caching — every call re-renders (byte-different across calls); English only, no language param. Dedicated rate limit: **50/min/credential**, on top of the global 600/min GET limit.

### 2.8 Reusable KYC (share / import)
`POST /v3/session/{sessionId}/share/` — request `for_application_id` (required uuid, must differ from caller), `ttl_in_seconds` (60–86400, default 3600). Response: `share_token` (HS256 JWT), `for_application_id`, `session_kind`. **This is the one endpoint that returns `401`** for auth failures instead of `403`.

`POST /v3/session/import-shared/` — request `share_token` (required), `trust_review` (required bool — `true` keeps source status, `false` forces `In Review`), `workflow_id` (required, must belong to caller), `vendor_data` (optional override). Response `201`: full V3 decision payload plus `shared_from_session` (original session_id). Not idempotent — one redeem per receiver (`403` on repeat). `400` for invalid/expired/wrong-target token.

### 2.9 Bulk verification import
`POST /v3/session/imports/` creates an import job; `GET /v3/session/imports/{importId}/` polls status; `GET /v3/session/imports/{importId}/errors/` lists per-row failures; `GET /v3/session/imports/template/` downloads a CSV template (`import_type` query: `user_verification`|`business_verification`|`status_rules`|`transactions`, response `text/csv`).

### 2.10 Other session-scoped mutation endpoints (field-exact, from `openapi-25.json`)
| Endpoint | Purpose | Key request fields |
|---|---|---|
| `PATCH /v3/session/{sessionId}/features/{nodeId}/update-status/` | Override one feature's status (not the whole session) | `new_status` (`Approved`\|`Declined`\|`In Review`), `comment`. `nodeId` literal `default` for non-graph workflows. Response echoes `feature_type` (model name, e.g. `KYC`,`Face`,`FaceMatch`,`AML`,`POA`). |
| `PATCH /v3/session/{sessionId}/update-data/` | Correct OCR-extracted KYC data | `document_type` (12 codes + 6 long-form aliases), `document_number`, `personal_number`, `date_of_birth`, `date_of_issue`, `expiration_date`, `issuing_state`, `first_name`, `last_name` (recomputes `full_name`), `gender` (`M`\|`F`\|`U`), `address`, `place_of_birth`, `nationality`, `marital_status` (`SINGLE`\|`MARRIED`\|`DIVORCED`\|`WIDOWED`\|`UNKNOWN`), `extra_fields{}` (per-key override, `null` deletes a key), `parsed_address{address_type,city,region,street_1,street_2,postal_code,country}`. Query/body `node_id` selects which KYC record on multi-step workflows. |
| `PATCH /v3/session/{sessionId}/update-poa-data/` | Correct POA-extracted data | `issuing_state`, `document_type` (`UTILITY_BILL`\|`BANK_STATEMENT`\|`GOVERNMENT_ISSUED_DOCUMENT`\|`OTHER_POA_DOCUMENT`\|`UNKNOWN`), `document_language`, `issuer`, `issue_date`, `poa_address`, `name_on_document`, `extra_fields{}` (9 bank/contact keys), `poa_parsed_address{...}`. |
| `PATCH /v3/session/{sessionId}/kyb/parties/{partyUuid}/` | Skip/re-require a KYB Key-People party | `is_skipped` (required bool). Response includes `kyc_session_deleted`, `kyb_sub_session_deleted`. |
| `PATCH /v3/session/{sessionId}/kyb/{companyUuid}/update-data/` | Correct KYB registry data | `company_name`, `registration_number`, `country_code`, `region`, `incorporation_date`, `tax_number`, `legal_address` (aliased to `registered_address`), `company_type`, `registry_status`, `verification_status` (`verified`\|`failed`\|`unknown`), `alternative_names`, `nature_of_business`, `registered_capital(_amount/_currency)`, `website`, `email`, `phone`, `legal_entity_identifier`, `location_of_registration`, `vat_number`, `control_scheme`. |
| `POST /v3/session/{sessionId}/sandbox/arm/` | (Re-)arm a sandbox scenario, only while `Not Started` | `scenario` (required slug). |
| `PATCH /v3/session/{sessionId}/update-aml-hit-status/` | Review one AML hit | `hit_id` (required), `review_status` (required: `Unreviewed`\|`Confirmed Match`\|`False Positive`\|`Inconclusive`), `node_id` (when multiple AML checks). |
| `PATCH /v3/session/{sessionId}/bulk-update-aml-hit-status/` | Review many hits at once | `hit_updates[]` (`{hit_id, review_status}`), `node_id`. |
| `GET /v3/sessions/{session_id}/reviews/` | Session's manual-review / activity feed | Paginated (`limit`/`offset`/`ordering`, default `-created_at`). Rows: `uuid`, `activity_type`, `actor_display`, `actor_email`, `actor_type`, `new_status`, `previous_status`, `comment`, `mentioned_emails`, `previous_value`, `new_value`, `changed_fields`, `metadata`, `created_at`. |
| `POST /v3/sessions/{session_id}/reviews/` | Add a free-text review note (no actor attribution — always `"Unknown"`) | `new_status` (optional, any of the 10 status literals, does NOT change the real status), `comment`. |

---

## 3. Status literals and allowed transitions

Source: `https://docs.didit.me/integration/verification-statuses` + cross-checked against the `status` enum on `session_create` response and `session_decision` response (both list the identical 10 values).

**The 10 literals** (exact, case-sensitive strings): `Not Started`, `In Progress`, `Awaiting User`, `In Review`, `Approved`, `Declined`, `Resubmitted`, `Expired`, `Kyc Expired`, `Abandoned`.

| From | Can move to |
|---|---|
| Not Started | In Progress, Expired |
| In Progress | Approved, Declined, In Review, Awaiting User, Abandoned |
| Awaiting User (KYB: waiting on child KYC sessions) | Approved, Declined, In Review |
| In Review | Approved, Declined, Resubmitted |
| Declined | Resubmitted |
| Resubmitted | Approved, Declined, In Review (or KYB parent reverts to Awaiting User) |
| Approved | Kyc Expired |

Terminal (no further transitions documented): `Approved` only transitions to `Kyc Expired` on its own expiry clock; `Declined`, `Expired`, `Abandoned` are dead ends other than via manual `Resubmitted` (from `Declined`) or a fresh session.

**Feature-level status** is a separate, smaller axis — the docs page states only that resubmittable features can carry `Declined`, `In Review`, `Not Finished`, `Not Started`, or `Expired`, with no formally published enum name (session-level `status` is called the "single source of truth"). The `PATCH .../features/{nodeId}/update-status/` endpoint restricts manual overrides to `Approved`|`Declined`|`In Review` only (§2.10).

---

## 4. Decision object V3 — every array, every field

Source: `openapi-25.json` `get_v3_session_decision` response schema (full read, 1832 lines) + `https://docs.didit.me/reference/data-models`.

Top level: `session_id`, `session_kind` (`user`|`business`), `session_number`, `session_url`, `status` (§3), `workflow_id`, `features[]` (display names; with `include=events` each entry is `{feature, node_id}` and email is renamed `EMAIL`), `vendor_data`, `metadata`, `expected_details{}` (echoes create-time input, §2.1), `contact_details{}`, `callback`, `created_at`, `expires_at`, `environment` (`live`|`sandbox`), `reviews[]` (`user`, `new_status`, `comment`, `created_at` — `user` is `"API Client"` for API-driven changes, `"Unknown"` when unresolved).

**Every feature block is a plural JSON array**, one item per workflow-graph node that ran it (never a singular object), `null` until that feature has produced data at least once:

| Array | Item fields (top-level; nested objects abbreviated) |
|---|---|
| `id_verifications[]` | `node_id`, `verification_method` (`document`\|`id_lookup`\|`wallet`), `assurance` (`documentary`\|`data_match`\|`cryptographic`), `wallet_provider`, `fallback_from{method,reason,action}`, `id_lookup{source,checked_at,attempts,max_attempts,outcome,comparison,registry_portrait,face_match_score}`, `wallet_verification{provider,provider_name,issuing_authority,issuing_country,credential_type,level_of_assurance,verified_at,signature_valid,attributes,portrait,face_match_score}`, `status`, `document_type`, `document_subtype`, `document_number`, `personal_number`, `portrait_image`, `front_image`, `front_video`, `back_image`, `back_video`, `full_front_image`, `full_back_image`, `front_image_camera_front`, `back_image_camera_front`, `date_of_birth`, `age`, `expiration_date`, `date_of_issue`, `issuing_state`, `issuing_state_name`, `first_name`, `last_name`, `full_name`, `gender`, `address`, `formatted_address`, `place_of_birth`, `marital_status`, `nationality`, `extra_fields{}` (incl. `_non_latin`/`_latin` script variants per `preferred_characters`), `mrz{}` (surname, name, country, nationality, birth_date, expiry_date, sex, document_type, document_number, optional_data, optional_data_2, birth_date_hash, expiry_date_hash, document_number_hash, final_hash, personal_number, warnings, errors, mrz_type, mrz_string, mrz_key), `parsed_address{}`, `extra_files[]`, `front/back_image_camera_front_face_match_score`, `front/back_image_quality_score{focus_score,brightness_score,brightness_issue,is_document_fully_visible,resolution_score,overall_score}`, `warnings[]`, `matches[]` (up to 5, duplicate/blocklist detection) |
| `nfc_verifications[]` | `node_id`, `status`, `is_nfc_skipped`, `skip_reason` (6-value enum, §below), `portrait_image`, `signature_image`, `chip_data{document_type,issuing_country,document_number,expiration_date,first_name,last_name,birth_date,gender,nationality,address,place_of_birth}`, `authenticity{sod_integrity,dg_integrity}`, `certificate_summary{issuer,subject,serial_number,not_valid_after,not_valid_before}`, `warnings[]`. Session also carries a top-level `nfc_skip_reason` for when NFC was bypassed before ever offering (same 6-value enum). |
| `liveness_checks[]` | `node_id`, `status`, `method` (`ACTIVE_3D`\|`FLASHING`\|`PASSIVE` — data-models page), `score` (0–100), `reference_image`, `video_url`, `age_estimation`, `matches[]` (`source`: `session`\|`imported`\|`list_entry`\|`retained_template`), `warnings[]`, `face_quality` (passive only), `face_luminance` (passive only) |
| `face_matches[]` | `node_id`, `status`, `score`, `source_image_session_id`, `source_image`, `target_image`, `warnings[]` |
| `phone_verifications[]` | `node_id`, `status`, `phone_number_prefix`, `phone_number`, `full_number`, `country_code`, `country_name`, `carrier{name,type}`, `is_disposable`, `is_virtual`, `verification_method`, `verification_attempts`, `verified_at`, `lifecycle[]`, `warnings[]`, `matches[]` (`source`: `session`\|`list_entry`, capped 5) |
| `email_verifications[]` | `node_id`, `status`, `email`, `is_breached`, `breaches[]`, `is_disposable`, `is_undeliverable`, `verification_attempts`, `verified_at`, `warnings[]`, `lifecycle[]`, `matches[]` |
| `poa_verifications[]` | `node_id`, `status`, `document_file`, `issuing_state`, `document_type`, `document_subtype`, `document_language`, `document_metadata{file_size,content_type,creation_date,modified_date,overlay_manipulation,creator,producer,software,encryption,is_signed,is_tampered,signature_info,exif_original_date,exif_digitized_date,processed_by_known_editor,has_different_creation_mod_date}`, `issuer`, `issue_date`, `expiration_date`, `poa_address`, `poa_formatted_address`, `poa_parsed_address{}`, `name_on_document`, `name_match_score_expected_details`, `name_match_score_id_verification`, `expected_details_address/_formatted_address/_parsed_address`, `extra_fields{bank_account_number,bank_iban,bank_sort_code,bank_routing_number,bank_swift_bic,bank_branch_name,bank_branch_address,document_phone_number,additional_names}`, `extra_files[]`, `warnings[]`, `detected_codes[]` |
| `document_ai_documents[]` | Grouped by node: `status` (rolled up), `node_id`, `items[]` (per-document), `warnings[]` — present only when `session_kind=user` |
| `questionnaire_responses[]` | `node_id`, `questionnaire_id`, `title`, `description`, `languages[]`, `default_language`, `is_active`, `is_simple_questionnaire`, `questionnaire_group_id`, `version`, `published_at`, `sections[]`, `status` |
| `aml_screenings[]` | `node_id`, `status`, `total_hits`, `entity_type` (`person`\|`company`), `hits[]`, `score` (0–100, highest across hits), `screened_data{full_name,nationality,date_of_birth,document_number}`, `is_ongoing_monitoring_enabled`, `next_ongoing_monitoring_bill_date`, `warnings[]` |
| `ip_analyses[]` | `node_id`, `status`, `device_brand`, `device_model`, `browser_family`, `os_family`, `platform`, `device_fingerprint`, `ip_country`, `ip_country_code`, `ip_state`, `ip_city`, `latitude`, `longitude`, `ip_address`, `isp`, `organization`, `is_vpn_or_tor`, `is_data_center`, `time_zone`, `time_zone_offset`, `ip{location, distance_from_id_document, distance_from_poa_document}`, `id_document{location, distance_from_ip, distance_from_poa_document}`, `poa_document{location, distance_from_ip, distance_from_id_document}`, `warnings[]`, `matches[]` (device_fingerprint capped at 10 = two 5-caps; carries `match_source`,`confidence`,`match_mode`,`device_info`,`location_info`, plus `recovery_similarity`/`tls_ja4_corroborated`/`recovery_gate_reason` when `match_source=recovered_high`) |
| `database_validations[]` | `node_id`, `issuing_state` (open set, 60+ countries — see country-specific `screened_data`/`source_data` shapes in §7), `validation_type` (`one_by_one`\|`two_by_two`\|`not_enabled`), `screened_data{}`, `validations[]` (`service_id`,`service_name`,`validation`,`outcome_code`,`outcome_detail`,`source_data`), `errors[]` (key omitted entirely when empty), `match_type` (`full_match`\|`partial_match`\|`no_match`, nullable), `status`, `warnings[]` |
| **KYB only** `registry_checks[]` | `status`, `node_id`, `data_resolved`, `company{}` (37 fields — see §9 Get Business shape), `ownership_structure{}` (raw registry JSON), `warnings[]` |
| **KYB only** `key_people_checks[]` | `status`, `node_id`, `registry{officers,beneficial_owners}`, `submitted{parties}`, `ubo_kyc_summary{total,approved,flagged,pending}` (nullable), `warnings[]` |
| **KYB only** `document_verifications[]` | `status`, `node_id`, `items[]`, `groups{}` (per-group counters, e.g. `legal_presence`, `ownership_structure`), `required_groups[]`, `warnings[]` |

**Warning object** (every `warnings[]` entry, per `reference/data-models`): `feature` (enum `ID_VERIFICATION`,`NFC`,`LIVENESS`,`FACEMATCH`,`PROOF_OF_ADDRESS`,`PHONE`,`EMAIL`,`AML`,`LOCATION`,`DATABASE_VALIDATION`,`QUESTIONNAIRE`,`KYB_REGISTRY`,`KYB_DOCUMENTS`,`KYB_KEY_PEOPLE`), `risk` (string code, e.g. `POSSIBLE_FRAUD`, `LOW_LIVENESS_SCORE`), `additional_data` (nullable object), `log_type` (`error`\|`warning`\|`information` — `error` forces the feature `Declined`), `short_description`, `long_description`, `node_id`.

**`nfc_skip_reason` / per-report `skip_reason` enum**: `USER_SKIPPED`, `DOCUMENT_WITHOUT_CHIP`, `CHIP_CERTIFICATE_UNAVAILABLE`, `DEVICE_WITHOUT_NFC`, `INTEGRATION_WITHOUT_NFC_ACCESS`, `MRZ_KEY_UNAVAILABLE`.

**Cross-session `matches[]` common shape** (id_verifications/liveness_checks/phone/email/ip_analyses, per `openapi-25.json` field descriptions): `session_id`, `session_number`, `similarity_percentage`/`score` (face only), `source` (`session`|`imported`|`list_entry`|`retained_template`), `vendor_data`, `vendor_user_id`, `biometric_template_id`, `verification_date`, `user_details{full_name,...}`, `match_image_url`, `status`, `is_blocklisted`, `is_allowlisted`, `api_service`. Non-session sources leave `session_id`/`session_number`/`status`/`api_service` `null`.

**Media URLs are short-lived presigned links** — fetch promptly or re-request the decision; do not persist them long-term (endpoint description, verbatim).

---

## 5. Webhook contract

Source: `https://docs.didit.me/integration/webhooks` (WebFetch) + `https://docs.didit.me/integration/integration-prompt` (canonicalization order confirmation).

**Headers sent on every delivery**:
| Header | Purpose |
|---|---|
| `X-Signature-V2` (recommended) | HMAC-SHA256 over the sorted, Unicode-preserved canonical JSON body |
| `X-Signature` | HMAC-SHA256 over the exact raw request bytes (legacy) |
| `X-Signature-Simple` (deprecated) | HMAC-SHA256 over the literal string `{timestamp}:{session_id}:{status}:{webhook_type}` |
| `X-Timestamp` | Unix epoch seconds the request was signed |

**Signing/verification algorithm (V2, canonical)** — per the integration prompt: **`shortenFloats` → `sortKeys` → `JSON.stringify` → HMAC-SHA256 → constant-time compare**, using the destination's `secret_shared_key` (returned by `POST /v3/webhook/destinations/`, §6). "shortenFloats" = normalize float precision before serialization so a re-serialized payload on your side matches Didit's byte-for-byte (exact precision rule not spelled out beyond this on the fetched pages — **UNVERIFIED beyond "shortenFloats" naming**; treat as "round/format floats consistently before hashing" and prefer `X-Signature-V2` plus re-canonicalizing your own copy of the received body rather than reconstructing it from scratch).

**Timestamp window**: reject if `abs(now - X-Timestamp) > 300` (5 minutes).

**Retry schedule**: initial delivery + 2 retries (3 total). 1st retry ~1 minute after initial failure; 2nd retry ~4 minutes after the 1st. Triggers: 5xx, 404, timeout, connection failure.

**Egress IP**: `18.203.201.92` (static — usable for firewall allow-listing).

**Documented event types** (`webhook_type`): `status.updated`, `data.updated`, `user.status.updated`, `user.data.updated`, `business.status.updated`, `business.data.updated`, `activity.created`, `transaction.created`, `transaction.status.updated`, `travel_rule.status.updated`.

**Sample `status.updated` payload** (from webhooks doc):
```json
{
  "event_id": "uuid",
  "webhook_type": "status.updated",
  "timestamp": 1774970000,
  "X-Timestamp": "1774970000",
  "session_id": "uuid",
  "status": "Approved",
  "decision": { "session_id": "uuid", "status": "Approved" }
}
```
`Resubmitted` payloads additionally carry `resubmit_info.nodes_to_resubmit[]` (each `{node_id, feature}` plus a reason) — confirmed via the resubmission web search summary; the exact full shape of `resubmit_info` beyond `nodes_to_resubmit` is **UNVERIFIED** (not fully reproduced in a fetched page).

**Destination management** — `openapi-25.json` `/v3/webhook/destinations/` (§6 table): `POST` request `label` (required), `url` (required, HTTPS, unique per app), `enabled` (bool), `webhook_version` (enum `v1`|`v2`|`v3`, `v3` recommended), `subscribed_events[]` (effectively required — empty array rejected `400`, omitted field subscribes to nothing). Response adds `uuid`, `secret_shared_key` (43-char URL-safe, auto-generated, full value only to API-key callers or Console users with `read:webhooks`), `created_at`, `updated_at`, `summary{total_deliveries,failed_deliveries,error_rate_percentage,min/avg/max_response_time_ms,last_delivery_at}`.

### Python-stdlib-only HMAC verification sketch (V2 signature)

```python
import hmac, hashlib, json, time

def shorten_floats(obj):
    """Recursively round floats to a fixed precision so serialization is
    stable across languages. Didit's own precision rule is not published
    beyond the name 'shortenFloats' (UNVERIFIED exact digit count) --
    2 decimal places matches every float example seen in the fetched docs
    (scores, coordinates); adjust if Didit publishes a stricter spec."""
    if isinstance(obj, float):
        return round(obj, 2)
    if isinstance(obj, dict):
        return {k: shorten_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [shorten_floats(v) for v in obj]
    return obj

def canonical_json(payload: dict) -> bytes:
    normalized = shorten_floats(payload)
    # sort_keys=True + compact separators == "sortKeys" + "JSON.stringify"
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=False).encode("utf-8")

def verify_didit_webhook(raw_body: bytes, headers: dict, secret_shared_key: str,
                          max_skew_seconds: int = 300) -> bool:
    # 1. Timestamp freshness
    ts = int(headers.get("X-Timestamp", "0"))
    if abs(time.time() - ts) > max_skew_seconds:
        return False

    # 2. Re-canonicalize the parsed body (never trust raw bytes for V2 --
    #    the signature covers the *canonical* form, not what was sent over the wire)
    payload = json.loads(raw_body)
    canonical = canonical_json(payload)

    # 3. HMAC-SHA256 with the per-destination secret
    expected = hmac.new(secret_shared_key.encode("utf-8"), canonical,
                         hashlib.sha256).hexdigest()

    # 4. Constant-time compare against X-Signature-V2
    received = headers.get("X-Signature-V2", "")
    return hmac.compare_digest(expected, received)
```
Dedupe deliveries on `event_id` (idempotency key per the integration prompt's step 7); a webhook that throws must return a 2xx within your own timeout to avoid triggering Didit's retry schedule above.

---

## 6. Operational endpoints table

Source: `openapi-25.json` (full path enumeration, 145 paths total). Full paths/methods for every tag are in the spec; identity-verification-relevant ones are detailed in §2/§7/§8/§9 above/below. Condensed by tag:

| Tag | # ops | Representative endpoints (see other sections for full field tables) |
|---|---|---|
| Sessions | 23 | create, decision, update-status, delete, batch-delete, list, generate-pdf, share, import-shared, imports (create/get/errors/template), features update-status, update-data, kyb party/company update, sandbox arm, AML hit status (single+bulk), update-poa-data, reviews (list/create) — §2 |
| Standalone APIs | 19 | id-verification, passive-liveness, face-match, age-estimation, face-search, aml, poa, document-ai, database-validation, kyb search/select/shareholders/ubo, email send/check/risk, phone send/check/risk, ip/risk — §7 |
| Users | 6 | list, create, get, update, update-status, batch-delete — §9 |
| Businesses | 6 | list, create, get, update, update-status, batch-delete — §9 |
| Webhook | 5 | destinations list/create/get/update/delete — §5/§6 |
| Workflows | 5 | list, create, get, update, delete |
| Biometric Templates | 5 | list, count, bulk-delete, get, delete — §7.6 |
| Questionnaires | 5 | list, create, get, update, delete |
| Billing | 2 | balance, top-up |
| Customization | 2 | get/update branding |
| Cases (investigations) | 20 | list/create/get/update/delete case, checklist, notes (+ presigned attachment upload/download), links, events, assign, escalate, resolve, reopen, transfer, request-info, approve/reject-approval (4-eyes), print (PDF), regulatory-reports sub-resource — **out of IDV scope, not detailed above** |
| Networks (fraud-graph) | 8 | get/list network, graph, map, members, signals, timeline, per-entity membership lookups (session/business/transaction/user) — **out of IDV scope** |
| Transactions (crypto/fiat monitoring, KYT) | 14 | create/get/list transaction, rules CRUD + backtest + library install, SDK token, wallet screening (+PDF) — **out of IDV scope** |
| Travel Rule | 12 | settings, VASP directory search, wallet address book CRUD, transfer actions, ownership confirm, inbound registration, pickup (email-rail), widget session — **out of IDV scope** |
| Case Blueprints / Report Templates / Regulatory Reports | 17 | CRUD + presets install + finalize/validate/download-url — **out of IDV scope, compliance-ops tooling** |
| System | 1 | `GET /system/healthcheck` — public, unauthenticated |

**Pagination convention** (confirmed on every list endpoint checked: sessions, users, businesses, workflows, questionnaires, biometric-templates): `limit`/`offset` query params, response `{count, next, previous, results[]}`. `next`/`previous` are ready-made absolute URLs — prefer following them over hand-computing offsets. `count` is exact for most KYC-scoped lists but **capped at 100** for KYB rows and for the generic Users/Businesses list endpoints ("exact up to 100, capped at 100 beyond that") — use `next === null` to detect the last page, never `count`.

**Rate limits actually documented, per endpoint** (no single blanket number — use the most specific one that applies):
| Scope | Limit | Source |
|---|---|---|
| General API (free tier) | 10 req/min | api-reference/overview |
| General API (paid tier) | 600 req/min | api-reference/overview |
| `POST /v3/session/` (create) | 600/min/API-key (a `FREE_SESSION_RATE_LIMIT=10/min` exists in source but is **not applied** to this v3 endpoint) | session_create `429` description |
| `GET` endpoints generally (incl. decision) | 600/min/credential | session_decision `429` description |
| Write ops (POST/PATCH/DELETE) shared limit | 300/min/API-key | session_delete / batch_delete_sessions `429` |
| `GET .../generate-pdf/` | 50/min/credential (in addition to the 600/min GET limit) | session_pdf `429` |
| Resubmit targeting only backend-only features | 30-second cooldown before an identical repeat is accepted | update-status `429` |
| Programmatic account register / resend-otp | 5/IP/hour; resend also has a 60s per-email cooldown | openapi-auth.json |

---

## 7. Standalone engine APIs

Source: `openapi-25.json`, each operation's `multipart/form-data` (image endpoints) or `application/json` (AML/database-validation/KYB) request schema. Every one shares the response envelope `{request_id, <feature_key>: {...}, vendor_data, metadata, created_at}`. `request_id` is the persisted session id when `save_api_request=true` (default on all of them; usable with `GET /v3/session/{sessionId}/decision/`) or a transient correlation UUID when `false`. Pricing: **UNVERIFIED from the fetched openapi/docs pages** (not present in any fetched schema or doc body) — Hyperwolf's own Console Usage page lists per-unit prices actually billed to this account (see §11 callout), but that is account-specific billing, not a published price list, so treat it as directional only.

| Endpoint | Input essentials | Output essentials |
|---|---|---|
| `POST /v3/id-verification/` | `front_image` (req, ≤10MB, tiff/jpg/jpeg/png/webp/pdf), `back_image`, `*_password` (encrypted PDF), `perform_document_liveness`, `minimum_age` (accepted, **not enforced**), `expiration_date_not_detected_action`/`invalid_mrz_action`/`inconsistent_data_action` (`NO_ACTION`\|`DECLINE`), `preferred_characters` (`latin`\|`non_latin`) | `id_verification.status` (`Approved`\|`Declined`), full field set matching `id_verifications[]` in §4 minus session-only fields (camera-front fields always `null` on this endpoint), `barcodes[]` |
| `POST /v3/passive-liveness/` | `user_image` (req, ≤5MB), `face_liveness_score_decline_threshold` (default 30), `rotate_image` | `liveness.status`, `method` always `PASSIVE`, `score`, `user_image.{entities,best_angle}`, `warnings[]` (`NO_FACE_DETECTED`,`LOW_LIVENESS_SCORE`,`LIVENESS_FACE_ATTACK`,`FACE_IN_BLOCKLIST`,`POSSIBLE_FACE_IN_BLOCKLIST` all `error`), `face_quality`, `face_luminance` |
| `POST /v3/face-match/` | `user_image` (req), `ref_image` (req), `face_match_score_decline_threshold`, `rotate_image` | `face_match.status`, `score`, `user_image`/`ref_image` detection blocks, `warnings[]` (`NO_REFERENCE_IMAGE`, `LOW_FACE_MATCH_SIMILARITY`) |
| `POST /v3/age-estimation/` | `user_image` (req), `face_liveness_score_decline_threshold`, `age_estimation_decline_threshold` (0 disables age check), `rotate_image` | `age_estimation.status`, `method` always `PASSIVE`, `score` (liveness), `age_estimation` (predicted age of largest face), `warnings[]` |
| `POST /v3/face-search/` | `user_image` (req, ≤5MB), `search_type` (`most_similar` default \| `blocklisted_or_approved`), `rotate_image` | `face_search.status` (`Declined` only on blocklist hit), `total_matches`, `matches[]` (≤5, incl. `is_blocklisted`/`is_allowlisted`), `warnings[]` |
| `POST /v3/aml/` | `full_name` (req), `entity_type` (`person`\|`company`), `date_of_birth`, `nationality` (alpha-2), `document_number`, `aml_score_approve_threshold`, `aml_score_review_threshold`, `aml_name_weight`+`aml_dob_weight`+`aml_country_weight` (must sum to 100), `aml_match_score_threshold`, `include_adverse_media` (~30s extra latency), `include_ongoing_monitoring` (requires `save_api_request=true`), `Idempotency-Key` header (up to 255 chars, dedupes retries) | `aml.status` (`Approved`\|`In Review`\|`Declined`), `total_hits`, `entity_type`, `hits[]`, `score`, `screened_data`, `warnings[]` (`POSSIBLE_MATCH_FOUND`) |
| `POST /v3/poa/` | `document` (req, ≤15MB, multi-page PDF supported), `expected_address`/`_country`/`_first_name`/`_last_name`, `poa_languages_allowed` (ISO 639-1 list, 51 supported), `poa_document_age_months` (per-type max age), 6× `poa_*_action` fields (`DECLINE`\|`NO_ACTION`) | `poa.status`, `document_type` (`UTILITY_BILL`\|`BANK_STATEMENT`\|`GOVERNMENT_ISSUED_DOCUMENT`\|`OTHER_POA_DOCUMENT`\|`UNKNOWN`), `document_subtype`, full address/name/bank extraction, `detected_codes[]`, `warnings[]` |
| `POST /v3/document-ai/` | `document` (req, ≤30MB, incl. `zip`), `fields` (req, JSON array string, 1–30 field defs, key/name/type/required), `expected_first_name`+`_last_name` or `expected_company_name` (mutually exclusive), 5× `document_ai_*_action` (`DECLINE`\|`REVIEW`\|`NO_ACTION`) | `document_ai.status` (`Approved`\|`Declined`\|`In Review`), `extracted_data{}` (typed per field), `detected_codes[]`, `fields[]` echo, `name_match_score`, `warnings[]` |
| `POST /v3/database-validation/` | `issuing_state` (req, alpha-3), `services[]` (catalog ids, else one default service runs), `consent` (required when a service needs it), 60+ possible identity fields (`identification_number`, name/DOB/address components, 20+ country-specific document numbers — full field list in the raw table above), `partial_match_action`/`no_match_action` (`DECLINE`\|`NO_ACTION`, no-match defaults `DECLINE`) | `database_validation.status`, `validation_type` (`one_by_one`\|`two_by_two`), `match_type` (`full_match`\|`partial_match`\|`no_match`), `validations` (shape flips on `save_api_request`), `services_used[]`, `match_score` (only present when `services` was explicit), `errors[]` |
| `POST /v3/kyb/search/` | `country_code` (req, alpha-2 [+ ISO 3166-2 subdivision]), `name` or `registration_number` (one required), `search_type` (`contains`\|`start_with`\|`fuzzy`), `webhook_url` (switches to async — unsigned `kyb.registry_search.resolved` callback) | `kyb_registry.companies[]` (each carries an ephemeral `kyb_response_id`), `pagination{total,page,per_page}`, `search_status` (`pending`\|`resolved`), `search_resolved` |
| `POST /v3/kyb/select/` (Lite) | `kyb_response_id` (req, from search) | Full registry `kyb_registry{}` profile — `registry_tier_requested`/`_delivered` = `basic`, 35+ company fields (see full table captured), `vat_validation_status` (`valid`\|`invalid`\|`could_not_validate`\|`not_applicable`) |
| `POST /v3/kyb/shareholders/` | same as select | `registry_tier_requested`=`shareholders`; adds ownership fields when available |
| `POST /v3/kyb/ubo/` | same as select | `registry_tier_requested`=`ubo`; full beneficial-ownership chain when available |
| `POST /v3/email/send/` | `email` (req), `options{code_size,alphanumeric_code,locale (27+ codes),use_white_label_customization}`, `signals{ip,device_id,device_platform,device_model,os_version,app_version,user_agent}` | `request_id`, `status` (`Success`\|`Retry`\|`Undeliverable`), `reason` (`email_can_not_be_delivered`) |
| `POST /v3/email/check/` | `email` (req), `code` (req), `duplicated_email_action`/`breached_email_action`/`disposable_email_action` (`NO_ACTION`\|`DECLINE`) | `status` (`Approved`\|`Declined`\|`Failed`\|`Expired or Not Found`), `email{is_breached,breaches[],is_disposable,is_undeliverable,lifecycle[],matches[]}` |
| `POST /v3/email/risk/` | `email` (req), `country_code`, `signals{}` | `status` (`Approved`\|`In Review`\|`Declined`), `email{email_intelligence,...}` |
| `POST /v3/phone/send/` | `phone_number` (req, E.164), `options{code_size,locale,preferred_channel: whatsapp\|sms\|telegram\|voice\|rcs\|viber\|zalo}`, `signals{}` | `status` (`Success`\|`Retry`\|`Blocked`), `reason` (e.g. `repeated_attempts`,`suspicious`,`spam`) |
| `POST /v3/phone/check/` | `phone_number` (req), `code` (req, 4-8 digits), `duplicated_phone_number_action`/`disposable_number_action`/`voip_number_action` | `status` (`Approved`\|`Declined`\|`Failed`\|`Expired or Not Found`), `phone{carrier,is_disposable,is_virtual,lifecycle[],matches[]}` |
| `POST /v3/phone/risk/` | `phone_number` (req), `country_code`, `signals{}` | `status` (`Approved`\|`In Review`\|`Declined`), `phone{phone_intelligence,enrichment}` |
| `POST /v3/ip/risk/` | `ip_address` (req), `claimed_country`, `user_agent` | `status` (`Approved`\|`In Review`), `ip{ip_country,latitude,longitude,isp,organization,is_vpn_or_tor,is_data_center,asn_number,asn_organization,connection_type,carrier,proxy_type,claimed_country,country_mismatch}` |

### 7.6 Biometric Templates (retained face embeddings — not a session)
`GET /v3/biometric-templates/` — filters `vendor_data`, `vendor_user_uuid`, `status` (`pending`\|`active`\|`expired`\|`held_out_of_use`\|`purge_pending`\|`purge_failed`\|`purged`), `source_type` (`session_delete`\|`automatic_retention`\|`backfill`), `retained_from`/`retained_to`, `ordering`, `limit`/`offset`. `GET .../count/` — same filters, `{count}`. `POST .../delete/` — `template_uuids[]` or `delete_all` + same filters, response `results[]{uuid,outcome}`. `GET/DELETE .../{template_uuid}/` — full record: `uuid`, `vendor_user_uuid`, `vendor_data`, `source_type`, `provenance_reference` (opaque, not resolvable to the deleted session), `retention_policy` (`delete_with_session`\|`retain_until_user_deleted`), `retention_override`, `retained_at`, `expires_at`, `retained_by`, `retained_by_type` (`API_KEY`\|`CONSOLE_USER`\|`SYSTEM`), `instruction_class` (`operational_session_delete`\|`privacy_erasure`), `instruction_source`, `instruction_id`, `held_out_of_use`, `status`, `purged_at`.

---

## 8. Lists APIs (blocklist / allowlist / custom)

**Important discrepancy**: `openapi-25.json` (the fetched spec) contains **no `/v3/lists/...` paths at all** — only an orphaned, unreferenced `BlocklistItem` component schema (`type`, `session_id`, `session_number`, `blocklisted_at`, `face_image`, `document_type`, `document_number`, `phone_number`, `email` — all nullable except `type`). It is not attached to any operation in the spec. A direct WebFetch of `https://docs.didit.me/management-api/lists/overview` (separate docs page, not the OpenAPI file) describes it as a real REST API:

| Method + path | Purpose |
|---|---|
| `GET /v3/lists/` | Retrieve all lists |
| `POST /v3/lists/` | Create an allowlist or custom list (blocklists are system-created, one per entry type) |
| `GET /v3/lists/{list_uuid}/entries/` | Paginated entries |
| `POST /v3/lists/{list_uuid}/entries/` | Add entry |
| `DELETE /v3/lists/{list_uuid}/entries/{entry_uuid}/` | Remove entry |
| `POST /v3/lists/{list_uuid}/entries/face-upload/` | Add a face entry from a base64 image without a session |

Base path per that page: `https://verification.didit.me/v3/lists/`, same `x-api-key` auth as everything else. **List types**: `blocklist` (system-created per entry type; a hit auto-declines), `allowlist` (user-created; suppresses the matching duplicate/reuse warning for that entry type, e.g. a face allowlist skips `DUPLICATED_FACE`), `custom` (user-created, for workflow branching/monitoring). **Entry types** (12): `face`, `document`, `phone`, `email`, `ip_address`, `device_fingerprint`, `wallet_address`, `bank_account`, `user`, `business`, `country`, `key`. Entries can be linked via `reference_session_id` (auto-extracts from a session) or `reference_object_uuid` + `metadata.reference_type`. **This entire section is sourced from a docs page, not the OpenAPI spec** — treat the exact request/response field names as best-effort (the summarizing fetch, not a raw schema dump) and re-verify against a live `GET /v3/lists/` call before building against it; mark anything beyond the bullet points above as **UNVERIFIED**.

The MCP tool catalog (§10) independently confirms a Lists surface exists: `didit_lists_list`, `didit_lists_get`, `didit_lists_create`, `didit_lists_update`, `didit_lists_delete`, `didit_lists_entries_list`, `didit_lists_entry_create`, `didit_lists_entry_upload_face`, `didit_lists_entry_delete`, plus legacy helpers `didit_blocklist_get`/`_add`/`_remove` and `didit_allowlist_add`.

Decision-object cross-references to list membership (all confirmed field-exact in §4): `matches[].source = "list_entry"` (id_verifications/liveness/phone/email), `matches[].is_blocklisted`/`is_allowlisted` (face-related arrays), `face_search.matches[].is_blocklisted`/`is_allowlisted` (§7).

---

## 9. Users / Businesses

Source: `openapi-25.json` `/v3/users/*`, `/v3/businesses/*`.

Both resources share the same shape: `vendor_data` is your own free-form identifier (**not** a UUID), `status` enum `ACTIVE`|`FLAGGED`|`BLOCKED` on both, `metadata{}` (fully replaced, not merged, on PATCH).

**Users** — `GET /v3/users/` (paginated `limit`/`offset`, no filter params, `count` capped at 100) rows: `didit_internal_id`, `vendor_data`, `display_name`, `full_name`, `date_of_birth`, `effective_name`, `status`, `portrait_image_url`, `session_count`, `approved_count`, `declined_count`, `in_review_count`, `issuing_states[]`, `approved_emails[]`, `approved_phones[]`, `features[]`, `features_list[]`, `last_session_at`, `first_session_at`, `last_activity_at`, `tags`, `created_at`. `POST /v3/users/create/` body: `vendor_data` (req, unique), `full_name`, `display_name`, `date_of_birth`, `status` (default `ACTIVE`), `metadata`, `approved_emails[]`, `approved_phones[]`, `issuing_states[]`. `GET`/`PATCH /v3/users/{vendor_data}/` — PATCH body same fields minus `vendor_data`; changing `status` here does **not** sync the system blocklist (use `PATCH .../update-status/` for that — `BLOCKED` adds `vendor_data` to the system blocklist). `POST /v3/users/delete/` body: `vendor_data_list[]` or `didit_internal_id_list[]` or `delete_all`; response `{deleted: <int>}`.

**Businesses** — mirrors Users with `legal_name`, `registration_number`, `country_code` (alpha-2) instead of person fields; same status/blocklist coupling on `PATCH .../update-status/`; `POST /v3/businesses/delete/` mirrors the users batch-delete shape.

**Vendor-user face upload / ongoing-monitoring toggles** (org-scoped paths, seen in §6 tag census, not deep-dived): `POST /v3/organization/{organization_id}/application/{application_id}/vendor-users/by-id/{didit_internal_id}/faces/upload/`; `PATCH .../vendor-users/toggle-ongoing-monitoring/` + job-status GET; equivalent `vendor-businesses/toggle-ongoing-monitoring/` pair.

---

## 10. Export plan — pulling all history out of Didit

Combines confirmed REST calls (§2/§6/§9) with the MCP tool catalog fetched from `https://docs.didit.me/integration/mcp/tools`.

### 10.1 Via REST (direct, scriptable, no OAuth dance)
1. **Sessions (KYC + KYB) + full decision JSON**
   - Page through `GET /v3/sessions/?session_kind=all&limit=<N>&offset=<K>` following `next` until `null`. Remember: with `session_kind=all`, `count`/pagination reflects the **KYC** side only and a page can hold up to `2×limit` rows (§2.4's own doc caveat) — for exact separate counts, page `user` and `business` independently.
   - For each `session_id`, call `GET /v3/session/{sessionId}/decision/?include=events` once (adds `events`, `activity_reviews`, `blocklisted`, `cost_breakdown`) — this is the full record (§4).
   - Rate limits: GET 600/min/credential; if exporting thousands of sessions, throttle to stay under that, or prefer webhook-driven incremental sync going forward instead of full re-polls.
2. **Media (document/face/POA images & videos)** — every URL embedded in a decision (`front_image`, `portrait_image`, `video_url`, `document_file`, etc.) is a **short-lived presigned link** (endpoint description, verbatim) — download and archive it immediately after each decision fetch; do not batch the JSON pull separately from the media pull, or links will expire before you download them. No documented TTL figure was found in the fetched pages — **UNVERIFIED exact expiry duration**; treat as minutes, not hours.
3. **Compliance PDFs** — `GET /v3/session/{sessionId}/generate-pdf/` per eligible session (§2.7); dedicated 50/min rate limit; not cached, so download once and store — a second call re-renders (byte-different).
4. **Users** — `GET /v3/users/?limit=&offset=`, page via `next`.
5. **Businesses** — `GET /v3/businesses/?limit=&offset=`, page via `next`.
6. **Workflows** — `GET /v3/workflows/?limit=&offset=` (config snapshot, needed to interpret which features ran on old sessions pinned to old versions).
7. **Questionnaires** — `GET /v3/questionnaires/?limit=&offset=`.
8. **Lists (blocklist/allowlist/custom)** — `GET /v3/lists/` then `GET /v3/lists/{list_uuid}/entries/` per list (§8 — **sourced from docs page, verify shape against a live call first**).
9. **Webhook destinations config** — `GET /v3/webhook/destinations/` (includes `secret_shared_key` for your records, not historical data but needed if migrating the integration).
10. **Biometric templates** (retained faces outliving their session) — `GET /v3/biometric-templates/` (§7.6), separate from session export since these persist after a session is deleted.
11. **Billing/usage** — `GET /v3/billing/balance/` (current balance only — no historical usage-ledger endpoint was found in the fetched spec; the Console's Usage page is the only place per-line-item billing history was observed, see §11).

### 10.2 Via MCP (agent-driven, same data, different transport)
Server: `https://mcp.didit.me/mcp` — **remote HTTP MCP, not an installable npm package**. Auth is browser-based "Log in with Didit" OAuth 2.1 — no API keys in config (confirmed from `https://docs.didit.me/integration/mcp/installation`; this contradicts a stray note found elsewhere referring to `@didit-protocol/mcp-server` as an installable package — that name is **UNVERIFIED/likely stale**, trust the installation page's HTTP-transport instructions instead). Install per client:
- Claude Code: `claude mcp add --transport http didit https://mcp.didit.me/mcp`, then `/mcp` to trigger OAuth.
- Claude Desktop: Settings → Connectors → Add custom connector → URL `https://mcp.didit.me/mcp`.
- Cursor/VS Code: JSON config pointing at the same URL (native `http`/`url` transport).
- Windsurf/Zed: wrap with `npx -y mcp-remote@latest https://mcp.didit.me/mcp` (these two clients need the remote-to-stdio bridge; Claude/Cursor/VS Code speak HTTP natively).

Relevant export sequence (tool names verbatim from the fetched tool reference, `https://docs.didit.me/integration/mcp/tools`):
`didit_session_list` → `didit_session_get_decision` (per session) → `didit_session_generate_pdf` (per eligible session) → `didit_vendor_user_list` → `didit_vendor_business_list` → `didit_lists_list` + `didit_lists_entries_list` → `didit_workflow_list` → `didit_questionnaire_list` → `didit_webhook_list` → `didit_report_export` (bulk export job — `didit_report_list`/`didit_report_get`/`didit_report_get_download_url` to retrieve it) → `didit_audit_log_list` (Console activity, if permitted). The tool doc states **115 tools total** across sessions, workflows, AML, Travel Rule, marketplace, lists, webhooks, and billing; the fetch captured every tool name in each category (reproduced in full under §10.3).

### 10.3 Full MCP tool catalog (as fetched, grouped by the doc page's own headings)
Discovery/cross-app: `didit_context_get`, `didit_session_search`, `didit_transaction_search`, `didit_case_search`, `didit_vendor_user_search`, `didit_vendor_business_search`, `didit_analytics`.
Sessions: `didit_session_create`, `_list`, `_get_decision`, `_update_status`, `_update_data`, `_update_poa_data`, `_add_review`, `_list_reviews`, `_generate_pdf`, `_share`, `_import_shared`, `_delete`, `_batch_delete`, `_create_import`, `_get_import_template`, `_get_import`, `_get_import_errors`.
Workflows/Questionnaires: `didit_workflow_list/_search/_get/_create/_update/_delete/_get_graph/_get_field_definitions/_get_branch_fields/_validate_graph/_edit_graph/_set_graph/_create_draft/_publish/_get_id_verification_methods_catalog`, `didit_questionnaire_list/_get/_create/_update/_delete`.
Verification APIs (standalone): `didit_verify_id`, `_poa`, `_database`, `_kyb_search`, `_kyb_select`, `_passive_liveness`, `_face_match`, `_face_search`, `_age`, `_aml`, `_email_send`, `_email_check`, `_phone_send`, `_phone_check`.
Transaction Monitoring: `didit_transaction_list/_get/_create/_screen_wallet/_sdk_token/_rule_list/_rule_get/_rule_create/_rule_update/_rule_delete/_rule_backtest/_rule_library_list/_rule_install/_rule_uninstall`.
Travel Rule: `didit_travel_rule_get_settings/_update_settings/_search_vasps/_list_wallet_addresses/_add_wallet_address/_update_wallet_address/_delete_wallet_address/_transfer_action/_confirm_ownership/_register_inbound/_create_widget_session`.
Marketplace: `didit_marketplace_list_catalog/_list_connections/_request_integration`.
Vendor Users/Businesses: `didit_vendor_user_list/_get/_create/_update/_update_status/_delete`, `didit_vendor_business_list/_get/_create/_update/_update_status/_delete`.
Lists/Blocklist/Allowlist: `didit_lists_list/_get/_create/_update/_delete/_entries_list/_entry_create/_entry_upload_face/_entry_delete`, `didit_blocklist_get/_add/_remove`, `didit_allowlist_add`.
Cases: `didit_case_list/_get/_statistics/_create/_manage`.
Reports/Audit/Alerts: `didit_report_list/_get/_get_download_url/_export`, `didit_audit_log_list`, `didit_alert_list/_configure`.
Webhooks: `didit_webhook_list/_get/_create/_update/_delete`.
Account/Org/Billing: `didit_account_register/_verify_email/_resend_otp/_login` (local-server-only), `didit_org_list/_list_applications/_get_application/_get_balance/_list_members/_list_roles/_list_api_keys/_invite_member/_update_member/_remove_member/_top_up/_reveal_application_api_key`, `didit_branding_get/_update`.

---

## 11. Things Didit does that have no API (console-only)

Source: `https://docs.didit.me/console/audit-logs`, `https://docs.didit.me/console/export-pdf-csv`, `https://docs.didit.me/console/data-retention`, plus WebSearch summaries of the same pages.

- **CSV bulk export** — "console only (no API endpoint mentioned)" per the export-pdf-csv page. The PDF has an API (§2.7); CSV does not.
- **Audit Logs (Console activity log — request metadata, not verification data)** — Console-only read access, gated to **Admin/Owner roles**; retained 365 days then auto-deleted; the docs page describes filtering/searching in the UI and even "screenshot the results for documentation" as the workflow, with no API/export mechanism mentioned. (Distinct from `didit_audit_log_list`, an MCP tool listed in §10.3 — that tool's existence suggests an underlying API surface Didit has not documented publicly; **UNVERIFIED** whether it is generally available outside MCP.)
- **Data retention window configuration** — set in Console → App Settings → Data (1 month–10 years or unlimited); no API endpoint found in the fetched spec for reading/writing this setting (the *deletion itself* is API-driven per §2.6, but the *policy knob* was only described as a Console control).
- **Team & roles / SSO** — referenced in the console sidebar (per the pre-existing scratch note captured from Hyperwolf's own account, cited below) but no `/v3/...` endpoint for role/permission management was found in `openapi-25.json`. Only `didit_org_list_roles`/`_list_members`/`_invite_member`/`_update_member`/`_remove_member` (MCP, §10.3) suggest an underlying surface — **UNVERIFIED** as a public REST API.
- **Billing history / itemized usage ledger** — `GET /v3/billing/balance/` gives current balance + auto-refill config only (§2.10/9); no historical per-line-item usage endpoint was found. The Console's Usage page shows this.
- **Full user-history PDF bundle** (cover page + up to 20 most recent reportable sessions) — described as a Console-only action (user detail page → Actions → Download PDF); the API's `generate-pdf` endpoint is per-session, not per-user.

**Supplementary context (not part of the fetched API docs, but genuinely fetched from Hyperwolf's own live Didit Console the same day — file `didit-reference-digest-2026-09-08.md` in this scratch directory, written by a separate session with console access)**: Hyperwolf's production workflows are "Hemp Verification (no selfie)" (document + IP, no liveness), "Cannabis Verification + Selfie" (document + liveness + face match), "Biometric Authentication" (returning-user re-auth), and "Adaptive Age Estimation." Features paid for but currently unused: Active Liveness, NFC, Proof of Address, Phone/Email verification+intelligence, AML screening/monitoring, Database Validation, Questionnaires, KYB, Document AI, Transaction Monitoring, standalone Face Search 1:N. Console sidebar structure observed: Home (dashboard) · Directory (Users, Businesses) · Verifications (User/Business/Transactions) · Configure (Workflows, Customization, Questionnaires, Lists, Marketplace) · Manage (Integrate) · Settings (Account, Team & roles, Security, SSO, Usage, Billing, Referrals, Audit Logs, Terms & Policies, App Settings). Treat this paragraph as directional operational context, not as a verified API surface — everything above the line in this section is what was independently re-confirmed against fetched docs/spec pages during this task.

---

## Appendix: raw material saved for follow-up

- `/Users/jt/POS-Admin/scratch/idv-didit-openapi-25.json` — full downloaded spec (2.5MB, 145 paths, 97 schemas)
- `/Users/jt/POS-Admin/scratch/idv-didit-openapi-auth.json` — full downloaded auth spec (67KB, 7 paths)
- `/Users/jt/POS-Admin/scratch/ops/*.json` — per-operation extracted request/response schemas for the 75 operations detailed above (script: `extract.py`)
- `/Users/jt/POS-Admin/scratch/rendered/*.md` — auto-generated field tables per operation group, source for §2/§7/§9 tables above
