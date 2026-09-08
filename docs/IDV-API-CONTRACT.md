# Hyperwolf Verify — API contract (backend ↔ console ↔ capture ↔ engine ↔ site)

Scope: every route the Verify module exposes or consumes. Backend (`wmdemo/idv_api.py`), console
(`idv/*.jsx`), capture page (`idv/capture.jsx`), engine (`idv-engine/`) and the site facade all
build to this file. **A screen never invents a field; a route never omits one listed as required.**

Conventions: timestamps are ISO-8601 UTC text (`2026-09-08T20:15:00Z`); money is integer cents;
scores are numbers 0–100 with one decimal; statuses are the ten Didit literals, case-sensitive;
every read carries `idv_version` (integer, increments on any write) for polling short-circuit;
booleans are JSON booleans, never `"true"`; unknown is `null` with a sibling `*_reason` string.

Errors: `{ "error": "<one plain sentence>" }` with 400 (bad input), 403 (no role / bad key /
bad signature — never 401, matching Didit), 404, 409 (state conflict: e.g. approving an
`Abandoned` session), 413 (media too large), 415 (media type not allowed), 429, 500. **501
"not built — must never ship"** is the only permitted stub response.

Actor header on console routes: `X-HW-Actor: <associate id>`; the backend resolves the role
(`viewer|analyst|admin`) from `associates` and refuses writes without one.

## Common fragments

```jsonc
// Status — one of exactly:
// "Not Started" | "In Progress" | "Awaiting User" | "In Review" | "Approved" | "Declined" |
// "Resubmitted" | "Abandoned" | "Expired" | "Kyc Expired"

// Reason (string enum, §3.4 of the plan)
// review: LIVENESS_LOW LIVENESS_FAILED_3X FACE_MATCH_LOW DOC_QUALITY_LOW BARCODE_OCR_MISMATCH
//         NAME_MISMATCH_EXPECTED DUPLICATE_PERSON IP_HOSTING IP_VPN AGE_ESTIMATE_UNDER_MARGIN
//         OUT_OF_STATE DOC_NEAR_EXPIRY ENGINE_UNAVAILABLE_MANUAL
// decline: DOC_EXPIRED UNDER_AGE FACE_BLOCKLIST_HIT DOCUMENT_BLOCKLIST_HIT USER_BLOCKLIST_HIT
//          IP_TOR INJECTION_DETECTED CHALLENGE_NONCE_MISMATCH LIVENESS_ATTEMPTS_EXHAUSTED_HARD

// Score — every model output carries provenance; the UI prints caption verbatim
{ "score": 87.4, "status": "Approved", "model": "minifasnet-v2", "model_version": "2.0",
  "certified": false, "caption": "open model · uncertified" }

// Person
{ "id": "p_…", "vendor_data": "email:<sha256>", "blaze_member_id": null, "hw_identity_id": null,
  "first_name": "…", "last_name": "…", "date_of_birth": "1994-03-02", "email_masked": "j***@…",
  "phone_masked": "+1 ••• ••• 4421", "status": "active", "last_verified_at": "…",
  "kyc_expires_at": "…", "sessions_count": 3, "face_template_count": 2, "list_hits": [ListHit] }

// SessionSummary (table row)
{ "id": "uuid", "session_number": 14146, "status": Status, "workflow": { "id": "…", "name": "…", "version": 3 },
  "person": { "id": "…", "display_name": "…" } | null, "vendor_data": "…" | null,
  "document": { "type": "DL", "issuing_state": "CA", "issuing_country": "USA" } | null,
  "channel": "hosted|embedded|pos|import", "origin": "website|pos:<store_id>|didit-import",
  "reasons": [Reason], "created_at": "…", "completed_at": "…" | null, "imported_from": "didit" | null }

// Decision (Didit V3 shape, arrays keyed by node_id; only the fields we produce are listed)
{ "session_id": "…", "session_number": 14146, "status": Status, "workflow_id": "…", "vendor_data": "…",
  "created_at": "…", "completed_at": "…",
  "id_verifications": [{ "node_id": "doc-1", "status": Status, "document_type": "DL", "document_number": "…",
     "first_name": "…", "last_name": "…", "full_name": "…", "date_of_birth": "…", "expiration_date": "…",
     "date_of_issue": "…", "issuing_state": "CA", "issuing_country": "USA", "nationality": null, "gender": "M|F|U",
     "address": "…", "parsed_address": { "street_1": "…", "city": "…", "region": "…", "postal_code": "…", "country": "…" },
     "mrz": null, "front_image": "/api/idv/media/<id>", "back_image": "/api/idv/media/<id>", "portrait_image": "/api/idv/media/<id>",
     "front_image_quality_score": 91.2, "back_image_quality_score": 88.0,
     "barcode_fields": { "DAQ": "…", "DCS": "…", "DAC": "…", "DBB": "…", "DBA": "…", "DAJ": "…" },
     "warnings": [{ "risk": "DOCUMENT_EXPIRED", "additional_data": null, "log_type": "error|warning", "short_description": "…", "long_description": "…" }] }],
  "liveness_checks": [{ "node_id": "live-1", "status": Status, "method": "passive|active", "score": Score,
     "reference_image": "/api/idv/media/<id>", "video_url": "/api/idv/media/<id>" | null,
     "face_quality": 0.83, "face_luminance": 0.61, "attempts": 2, "challenge": { "id": "…", "script": ["turn_left","blink","flash"], "nonce_ok": true } | null,
     "capture_integrity": { "virtual_camera_suspected": false, "frame_timing_ok": true, "device_enumeration_ok": true } }],
  "face_matches": [{ "node_id": "face-1", "status": Status, "score": Score, "source_image": "…", "target_image": "…", "warnings": [] }],
  "face_searches": [{ "node_id": "search-1", "status": Status, "matches": [{ "person_id": "…", "session_id": "…", "similarity": 91.0, "list_id": null }] }],
  "age_estimations": [{ "node_id": "age-1", "status": Status, "estimated_age": 27.4, "score": Score, "rule": "REC_21|MED_18_CARD", "margin_ok": true }],
  "ip_analyses": [{ "node_id": "ip-1", "status": Status, "ip_address": "…", "country": "US", "region": "CA", "city": "…",
     "vpn": false, "proxy": false, "tor": false, "hosting": false, "risk_score": 12.0, "source": "open-data:<list names>",
     "device": { "browser": "…", "os": "…", "fingerprint": "…" } }],
  "questionnaire_responses": null,
  "crosschecks": { "barcode_vs_ocr": { "agree": ["first_name","last_name","date_of_birth"], "disagree": [], "missing": [] },
                   "portrait_vs_selfie": 88.1, "name_vs_expected": "match|mismatch|not_provided", "dob_vs_age_rule": "pass|fail|not_provided" },
  "list_hits": [ListHit],
  "reviews": [Review], "events": [Event],
  "engine": { "name": "hw-engine", "version": "0.1.0", "job_id": "…" } | { "name": "didit", "imported_at": "…" } }

// ListHit
{ "list_id": "…", "list_name": "Document Blocklist", "list_type": "blocklist|allowlist|custom", "entry_type": "document", "entry_id": "…", "reason": "…" }

// Review (analyst trail row)
{ "id": 12, "session_id": "…", "analyst": { "id": "…", "name": "…", "role": "analyst" }, "action": "approve|decline|request_resubmission|note|assign|escalate|override_feature|edit_data|merge_person|add_to_list",
  "from_status": Status | null, "to_status": Status | null, "node_ids": ["live-1"], "comment": "…", "diff": { "first_name": ["Jon", "John"] } | null, "created_at": "…" }

// Event
{ "event_id": "…", "type": "status.updated|data.updated|media.uploaded|liveness.attempt|review.action|import", "status_from": Status | null, "status_to": Status | null, "source": "engine|analyst|system|website|pos|didit-import", "received_at": "…", "signature_ok": true }

// Media (row, never bytes)
{ "id": "…", "kind": "document_front|document_back|selfie|selfie_frame|liveness_video|portrait_crop|challenge_frame|import_pdf", "mime": "image/jpeg", "bytes": 412331, "width": 1600, "height": 1000, "captured_at": "…", "source": "capture|pos|didit-import", "url": "/api/idv/media/<id>" }

// RunReport (every import run) — invariant: rows_read == inserted + unchanged + conflicts + rejected
{ "id": 7, "kind": "sessions", "source": "didit", "status": "running|ok|partial|failed", "started_at": "…", "finished_at": "…",
  "rows_read": 2104, "inserted": 2100, "unchanged": 0, "conflicts": 0, "rejected": 4, "unresolved_identities": 1830,
  "cursor_before": null, "cursor_after": "offset=2104", "actor": "…", "error": null }

// EngineHealth
{ "ok": true, "name": "hw-engine", "version": "0.1.0", "arch": "x86_64", "queue_depth": 0, "last_callback_at": "…",
  "models": [{ "capability": "document_ocr", "name": "paddleocr", "version": "…", "licence": "Apache-2.0", "loaded": true }] }
```

## Console API — `/api/idv/*`

### Dashboard
`GET /api/idv/dashboard?window=7d|30d|90d&workflow_id`
```jsonc
{ "idv_version": 812, "window": { "from": "…", "to": "…" },
  "needs_review": { "n": 0, "oldest_enqueued_at": null },
  "recent": [SessionSummary],                       // 10 newest
  "volume": { "n": 154, "series": [{ "day": "2026-09-01", "n": 6 }] },
  "conversion": { "started": 190, "completed": 154, "approved": 141, "rate": 74.2, "n": 190 } | { "n": 0 },
  "conversion_by_country": [{ "country": "USA", "started": 190, "approved": 141 }],
  "resubmissions": { "n": 9, "by_node": { "LIVENESS": 6, "OCR": 3 } },
  "warnings": [{ "risk": "DOCUMENT_EXPIRED", "n": 4 }],
  "id_locations": [{ "issuing_state": "CA", "n": 120 }], "ip_locations": [{ "region": "CA", "n": 130 }],
  "demographics": { "gender": { "M": 80, "F": 70, "U": 4, "n": 154 }, "age": { "21-25": 40, "26-35": 70, "36-50": 34, "51+": 10, "n": 154 } },
  "devices": { "browser": [{ "name": "Safari", "n": 90 }], "os": [{ "name": "iOS", "n": 88 }], "n": 154 },
  "engine": EngineHealth, "backend": { "ok": true } }
```
A panel with nothing in the window returns `{ "n": 0 }` and the screen renders `EmptyState`.

### Sessions
`GET /api/idv/sessions?status&workflow_id&q&from&to&channel&origin&reason&imported&limit=50&cursor`
→ `{ "idv_version", "count", "next_cursor", "rows": [SessionSummary] }`

`POST /api/idv/sessions` (analyst+) body = public create body (below) plus `{ "channel": "hosted|pos", "store_id", "associate_id" }`
→ `201 { "session_id", "session_number", "session_token", "url", "status": "Not Started", "workflow_id", "vendor_data", "expires_at" }`

`GET /api/idv/sessions/{id}` → `{ "idv_version", "session": SessionSummary & { "callback", "metadata", "expected_details", "language", "ip", "user_agent", "store_id", "associate_id", "liveness_attempts", "resubmissions", "resubmit_nodes", "expires_at", "url" }, "decision": Decision | null, "media": [Media], "person": Person | null, "similar_faces": [{ "person_id", "session_id", "similarity", "media_url" }], "queue": { "assigned_to", "priority", "enqueued_at" } | null }`

`PATCH /api/idv/sessions/{id}/update-status` (analyst+; `Declined→Approved` admin)
body `{ "new_status": "Approved|Declined|In Review|Resubmitted", "comment": "…", "nodes_to_resubmit": ["LIVENESS","OCR"] }`
→ `{ "session_id", "status", "review": Review, "resubmit_url": "…" | null }`; 409 if the transition is not allowed.

`PATCH /api/idv/sessions/{id}/update-data` (analyst+) body: any of `document_type, document_number, date_of_birth, date_of_issue, expiration_date, issuing_state, first_name, last_name, gender, address, nationality, parsed_address{…}, node_id` → `{ "decision": Decision, "review": Review }`

`PATCH /api/idv/sessions/{id}/features/{node_id}/update-status` body `{ "new_status": "Approved|Declined|In Review", "comment" }` → `{ "decision": Decision, "review": Review }`

`POST /api/idv/sessions/{id}/resubmit-link` → `{ "url", "session_token", "expires_at" }`

`GET /api/idv/sessions/{id}/pdf` → `application/pdf` (audited)

`DELETE /api/idv/sessions/{id}` body `{ "instruction": "operational_session_delete|privacy_erasure", "retain_face_template": false }` → `{ "deletion_request_id", "status": "requested" }`;
`POST /api/idv/deletion-requests/{id}/execute` (admin) → `{ "outcome": "deleted", "media_deleted": 4, "templates_deleted": 1, "tombstoned": true }`

### Review queue
`GET /api/idv/review-queue?assigned_to&reason&priority&limit&cursor` → `{ "idv_version", "count", "rows": [SessionSummary & { "queue": { "assigned_to", "priority", "enqueued_at", "age_minutes" } }] }`
`POST /api/idv/review-queue/{session_id}/assign` body `{ "assigned_to": "<associate id>" | null, "priority": 1|2|3 }` → `{ "queue": {…}, "review": Review }`

### People
`GET /api/idv/people?q&status&has_hits&expiring_before&limit&cursor` → `{ "idv_version", "count", "rows": [Person] }`
`GET /api/idv/people/{id}` → `{ "person": Person, "sessions": [SessionSummary], "documents": [{ "document_type", "issuing_state", "expiration_date", "document_number_hash", "session_id" }], "templates": [{ "id", "session_id", "created_at", "quality" }], "duplicates": [{ "person_id", "similarity", "via": "face|document|match_tier" }] }`
`PATCH /api/idv/people/{id}` (analyst+) body subset of `{ email, phone, first_name, last_name, date_of_birth, blaze_member_id, status }` → `{ "person": Person }`
`POST /api/idv/people/{id}/merge` (analyst+) body `{ "into": "<person id>", "comment" }` → `{ "person": Person, "review": Review }`

### Workflows, questionnaires, customization
`GET /api/idv/workflows` → `{ "idv_version", "rows": [Workflow] }` where
```jsonc
Workflow = { "id", "name", "kind": "KYC", "version": 3, "status": "active|archived",
  "features": ["OCR","LIVENESS","FACE_MATCH","AGE_ESTIMATION","IP_ANALYSIS"],
  "unsupported_features": ["NFC","AML"],          // stored, shown greyed
  "config": { "face_liveness_method": "PASSIVE|ACTIVE_3D|FLASHING", "thresholds": { "liveness_min": 70, "face_match_min": 75, "doc_quality_min": 60 },
              "age_rule": "REC_21|MED_18_CARD", "allowed_document_types": ["DL","ID","PASSPORT"], "allowed_countries": ["USA"],
              "out_of_state": "allow|review", "duplicate_person": "review|decline", "ip": { "tor": "decline", "hosting": "review", "vpn": "review" },
              "resubmission_max": 3, "liveness_attempts_max": 3, "expires_after_days": 365, "session_ttl_minutes": 60, "questionnaire_id": null,
              "four_eyes": false, "manual_fallback_when_engine_down": false },
  "sessions_count": 2100, "created_at", "updated_at" }
```
`POST /api/idv/workflows` (admin) body `Workflow` minus ids → `201 Workflow`; `PATCH /api/idv/workflows/{id}` (admin) → new version, returns `Workflow`; `GET /api/idv/workflows/{id}/versions` → `[{ "version", "features", "config", "created_at" }]`; `DELETE` archives.

`GET|POST|PATCH /api/idv/questionnaires[/{id}]` → `{ "id", "name", "version", "status", "schema": [{ "id", "type": "single|multi|text|date|bool", "label", "options": [], "required": true }] }`

`GET|PUT /api/idv/customization` → `{ "brand_name", "logo_media_id", "accent": "accent|info|good", "copy": { "intro", "document", "selfie", "processing", "approved", "review", "declined", "paused" }, "hosted_domain", "updated_at" }` (PUT admin; `accent` must be a token name)

### Lists
`GET /api/idv/lists` → `{ "rows": [{ "id", "name", "list_type", "entry_type", "source", "entries": 2, "last_entry_at" }] }`
`POST /api/idv/lists` (admin) `{ "name", "list_type", "entry_type", "description" }`
`GET /api/idv/lists/{id}/entries?limit&cursor` → `{ "rows": [{ "id", "value_masked", "reason", "added_by", "added_at", "expires_at", "source_session_id", "face_media_url" }] }`
`POST /api/idv/lists/{id}/entries` (analyst+) `{ "value": "…" | null, "media_id": "…" | null /* face lists */, "reason", "expires_at", "source_session_id" }` → `201 entry`
`DELETE /api/idv/lists/{id}/entries/{entry_id}` (analyst+) → `{ "removed_at" }`

### Integrate
`GET /api/idv/api-keys` → `{ "rows": [{ "id", "name", "prefix", "scopes", "created_at", "last_used_at", "revoked_at" }] }`
`POST /api/idv/api-keys` (admin) `{ "name", "scopes": ["sessions:write","sessions:read","lists:read"] }` → `201 { "id", "name", "prefix", "key": "hwv_live_…" /* shown once */ }`
`DELETE /api/idv/api-keys/{id}` (admin) → `{ "revoked_at" }`
`GET /api/idv/webhooks` → `{ "rows": [{ "id", "url", "events": ["status.updated","data.updated"], "active", "secret_hint": "…a9f2", "created_at", "last_delivery": { "status", "at", "code" } | null }] }`
`POST /api/idv/webhooks` (admin) `{ "url", "events" }` → `201 { …, "secret": "…" /* shown once */ }`; `PATCH` `{ "url", "events", "active" }`; `DELETE`
`GET /api/idv/webhooks/{id}/deliveries?limit&cursor` → `{ "rows": [{ "id", "event_id", "session_id", "attempt", "status": "queued|delivered|failed|dead", "response_code", "next_attempt_at", "delivered_at", "error" }] }`
`POST /api/idv/webhooks/{id}/test` → `{ "delivery": {…} }` (sends a signed `status.updated` for a synthetic session id prefixed `test_`)
`GET /api/idv/engine/health` → `EngineHealth` (503 with the same shape and `ok:false` when unreachable)

### Usage, audit, team, retention
`GET /api/idv/usage?from&to&feature` → `{ "idv_version", "window", "rows": [{ "feature", "n_window", "n_cumulative", "unit_cost_cents": 0, "cost_cents": 0, "cost_note": "no per-check fee (own engine)" }], "imported": { "feature": "…", "n": 9391, "note": "Didit lifetime counts, imported" } }`
`GET /api/idv/audit?actor&action&via&from&to&path&limit&cursor` → `{ "rows": [{ "at", "actor_id", "actor_role", "via", "method", "path", "status", "action", "target_type", "target_id", "ip", "detail" }] }`
`GET /api/idv/team` → `{ "rows": [{ "associate_id", "name", "role": "viewer|analyst|admin", "store_id" }], "auth_note": "This estate has no login; roles are advisory until platform auth exists." }`
`POST /api/idv/team/{associate_id}/role` (admin) `{ "role" }` → `{ "associate_id", "role" }`
`GET /api/idv/retention` → `{ "policy": "until_customer_deleted", "media_count", "media_bytes", "oldest_media_at", "at_rest": "host volume encryption; app does not encrypt", "deletion_requests": { "pending": 0 } }`
`GET /api/idv/deletion-requests` → `{ "rows": [{ "id", "target_type", "target_id", "instruction", "requested_by", "requested_at", "executed_at", "outcome" }] }`

### Import (migration)
`POST /api/idv/import/didit/{sessions|media|users|lists|workflows|questionnaires}` (admin) body `{ "since": "…" | null, "limit": 500, "resume": true }` → `202 { "run": RunReport }` (runs in a worker thread; poll runs)
`GET /api/idv/import/runs?kind&limit` → `{ "rows": [RunReport] }`; `GET /api/idv/import/runs/{id}` → `{ "run": RunReport, "rejects": [{ "row_ref", "reason" }], "conflicts": [{ "row_ref", "field", "ours", "theirs" }] }`

`GET /api/idv/version` → `{ "idv_version": 812 }`

## Public verification API — `/v3/*` (header `x-api-key`)

`POST /v3/session/` body `{ "workflow_id" (required), "vendor_data", "callback", "callback_method": "GET|POST", "metadata": {}, "language": "en", "contact_details": { "email", "phone" }, "expected_details": { "first_name", "last_name", "date_of_birth", "document_number", "issuing_state", "medical": false } }`
→ `201 { "session_id", "session_token", "url", "status": "Not Started", "workflow_id", "vendor_data" }`
`GET /v3/session/{id}/decision/?include=events` → `Decision`
`GET /v3/sessions/?status&vendor_data&workflow_id&limit=50&offset=0` → `{ "count", "next", "previous", "results": [Decision-lite: session_id, session_number, status, workflow_id, vendor_data, created_at, completed_at] }`
`PATCH /v3/session/{id}/update-status/` body as console → `{ "session_id" }`
`GET /v3/session/{id}/generate-pdf/` → `application/pdf`
`GET /v3/lists/` · `GET /v3/lists/{id}/entries/` · `GET /v3/users/?limit&offset` (Person rows)
Rate limits: 600 GET/min, 300 write/min per key; 429 `{ "error" }`.

### Didit-compatibility facade (what `hyperwolf-backend` calls today)
`POST /v2/session` body `{ "workflow_id" }` → `{ "session_id", "session_token", "url", "status", "workflow_id", "vendor_data": null }`
`GET /v2/session/{id}/decision` → `Decision` with the V2 aliases the site reads: `kyc: { first_name, last_name, full_name, date_of_birth, date_of_issue, expiration_date, address, parsed_address{city,region,postal_code,country}, gender, document_number, front_image, back_image, portrait_image }`, `status`, `vendor_data`. The `url` is iframe-embeddable for the origins in `IDV_FRAME_ANCESTORS`. `In Review` is returned as `In Review`.

## Capture API — `/api/idv/capture/{session_token}/*` (bearer is the token in the path; TTL = `session_ttl_minutes`)

`GET /api/idv/capture/{token}/state` → `{ "status", "steps": [{ "id": "document_front|document_back|selfie|challenge|questionnaire", "state": "todo|done|retry", "attempts": 1, "max": 3 }], "branding": Customization, "workflow": { "name", "face_liveness_method" }, "resubmit_nodes": [], "expires_at", "engine_ok": true }`
`POST /api/idv/capture/{token}/consent` body `{ "kind": "terms|biometric_retention", "terms_version": "2026-09-08", "terms_url": "https://www.hyperwolf.com/terms", "accepted": true }` → `201 { "consent_id", "retention": "purge_24h|until_customer_deleted" }`; `state` carries `{ "terms": { "version", "url", "needs_update_notice": "Update the Hyperwolf Terms and Conditions to cover Civil Code 1798.90.1 before this goes live." }, "consents": [{ "kind", "accepted_at" }] }`.
`POST /api/idv/capture/{token}/challenge` → `{ "challenge_id", "nonce", "script": [{ "kind": "turn", "dir": "left", "ms": 1500 }, { "kind": "blink" }, { "kind": "flash", "colors": ["accent","info","good","warn"], "ms": 250 }], "issued_at", "valid_for_s": 90 }`
`POST /api/idv/capture/{token}/media` multipart `kind, file, challenge_id?, client_metrics {blur, glare, face_box}` → `201 { "media": Media, "status": "In Progress", "next_step": "…" }`; 413/415 on admission failure with `{ "error" }`.
`POST /api/idv/capture/{token}/submit` → `202 { "status": "In Progress", "job_id" }`
`GET /api/idv/capture/{token}/status` → `{ "status", "reasons": [Reason] /* customer-safe subset only */, "retry": { "step": "selfie", "attempt": 2, "max": 3 } | null, "message": "…" }`
`POST /api/idv/capture/{token}/abandon` → `{ "status": "Abandoned" }` (no-op after completion)

## Engine contract — `idv-engine` (private network; both directions signed with `IDV_ENGINE_SECRET`)

`POST /engine/v1/jobs` body `{ "job_id", "session_id", "workflow": { "features", "config" }, "media": [{ "id", "kind", "url", "sha256" }], "media_token": "…", "challenge": { "id", "nonce", "script", "issued_at" } | null, "expected_details": {…} | null, "templates_url": "/api/idv/internal/templates?person_id=…|all" , "callback_url": "https://…/api/idv/webhooks/engine" }` → `202 { "job_id", "queued_at" }`
Callback `POST {callback_url}` headers `X-Signature-V2`, `X-Timestamp`, body `{ "event_id": "<job_id>:<attempt>", "job_id", "session_id", "engine": { "name", "version" }, "proposed_status": Status, "reasons": [Reason], "decision": Decision-nodes (id_verifications, liveness_checks, face_matches, face_searches, age_estimations, ip_analyses, crosschecks), "templates": [{ "media_id", "model", "dim", "embedding_b64", "quality" }], "portrait_crop": { "media_id_source", "jpeg_b64" }, "timings_ms": { "document": 1200, "liveness": 900, "face": 300 } }` → wm-demo replies `200 { "received": true, "applied": true|false, "duplicate": false }`
`GET /engine/v1/health` → `EngineHealth`
`POST /engine/v1/face/search` `{ "embedding_b64" | "media_url", "candidates_url", "top_k": 5, "min_similarity": 80 }` → `{ "matches": [...] }`
`POST /engine/v1/document/analyze` · `/engine/v1/liveness/analyze` · `/engine/v1/face/match` · `/engine/v1/age/estimate` — multipart, synchronous, return the corresponding decision node; used by Integrate "try it" and QA.

## Outbound webhooks (destinations)
Headers `X-Signature-V2` (hex HMAC-SHA256 over canonical JSON: floats shortened to ≤ 2 decimals, keys sorted, separators `,`/`:`), `X-Timestamp` (unix seconds; receivers reject > 300 s skew), body `{ "event_id", "event": "status.updated|data.updated", "session_id", "session_number", "status", "workflow_id", "vendor_data", "timestamp", "decision": Decision /* status.updated only carries the top-level; data.updated carries the changed node */ }`. Retry at 60 s and 240 s, then `dead`.

## Media
`GET /api/idv/media/{id}` (console role) → bytes with the row's `mime`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, `Content-Disposition: inline; filename="<id>.<ext>"`; audited. Internal engine fetch uses `?token=<media_token>` scoped to one job and expiring with it.

## Addenda (append-only, dated)
- 2026-09-08 (owner rulings, round 2): capture is autonomous — `status` responses carry `guidance: { "step", "fix": "<one sentence>", "attempt", "max" }` on `Awaiting User`; `Declined` carries `next_step: "in_store"|"none"`; POS `update-status` accepts `{ "new_status": "Approved", "override": true, "reason": "<required>" }` from the associate on the session's own store only; media rows carry `retention` and `purge_after`; `/api/idv/retention` reports `{ consented, unconsented, purging_next_24h }`.
