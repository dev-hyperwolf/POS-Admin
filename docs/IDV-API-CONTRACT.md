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

### Didit-compatibility facade (what `hyperwolf-backend` calls today) — **header `x-api-key`**
Both routes below need `x-api-key` (scopes `sessions:write` to create, `sessions:read` to read a
decision) as of the 2026-09-08 safety-pass addendum **A**. They shipped unauthenticated.
`POST /v2/session` body `{ "workflow_id" }` → `{ "session_id", "session_token", "url", "status", "workflow_id", "vendor_data": null }`
`GET /v2/session/{id}/decision` → `Decision` with the V2 aliases the site reads: `kyc: { first_name, last_name, full_name, date_of_birth, date_of_issue, expiration_date, address, parsed_address{city,region,postal_code,country}, gender, document_number, front_image, back_image, portrait_image }`, `status`, `vendor_data`. The `url` is iframe-embeddable for the origins in `IDV_FRAME_ANCESTORS`. `In Review` is returned as `In Review`.

## Capture API — `/api/idv/capture/{session_token}/*` (bearer is the token in the path; TTL = `session_ttl_minutes`)

`GET /api/idv/capture/{token}/state` → `{ "status", "steps": [{ "id": "document_front|document_back|selfie|challenge|questionnaire", "state": "todo|done|retry", "attempts": 1, "max": 3 }], "branding": Customization, "workflow": { "name", "face_liveness_method" }, "resubmit_nodes": [], "expires_at", "engine_ok": true }`
`POST /api/idv/capture/{token}/consent` body `{ "kind": "terms|biometric_retention", "terms_version": "2026-09-08", "terms_url": "https://www.hyperwolf.com/terms", "accepted": true }` → `201 { "consent_id", "retention": "purge_after_decision|until_customer_deleted" }`; `state` carries `{ "terms": { "version", "url", "needs_update_notice": "Update the Hyperwolf Terms and Conditions to cover Civil Code 1798.90.1 and biometric consent before this goes live." }, "consents": [{ "kind", "accepted_at" }] }`.
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
- 2026-09-08 (owner rulings, round 2): capture is autonomous — `status` responses carry `guidance: { "step", "fix": "<one sentence>", "attempt", "max" }` on `Awaiting User`; `Declined` carries `next_step: "in_store"|"none"`; POS `update-status` accepts `{ "new_status": "Approved", "override": true, "reason": "<required>" }` from the associate on the session's own store only; media rows carry `retention`, `purpose` ('verification_fraud' for licence-derived media, which no convenience path may read) and `purge_after`; `/api/idv/retention` reports `{ consented, unconsented, purging_next_24h }`.
- 2026-09-08 (backend core, `wmdemo/idv_*.py`, written while building to this file):
  - **`/v2` decision carries three names for one node.** The contract says `kyc`; the live site
    (`hyperwolf-backend/controllers/didit/didit-controllers.js:153-274`, digest §1.3) reads
    `response.id_verification` (singular) and `response.face_match.target_image`. The facade emits
    all three over the same underlying node — `kyc`, `id_verification` (identical object) and
    `face_match` — so the site repoints with an env var and no code change, then migrates to `kyc`
    at its own pace. `kyc` additionally carries `age`, which the site maps and does not use.
  - **`idv_sessions` gains `guidance` (JSON) and `next_step` (text).** The round-2 addendum above
    requires `/capture/{token}/status` to return `guidance` on `Awaiting User` and `next_step` on
    `Declined`; both are decided by the rules at callback time and read back by a client that has
    no other way to derive them, so they are stored on the session rather than recomputed.
  - **`idv_decisions` gains `face_searches`, `list_hits`, `reasons`, `engine_job_id`, `gender`,
    `doc_quality_score`, `browser`, `os`.** The plan's §3.3 DDL predates the `Decision` shape in
    this file, which lists `face_searches` and `list_hits`; the four extra scalars are what the
    Dashboard's demographics and devices panels sum, and computing them by re-parsing every
    decision's JSON per request is what makes a dashboard disagree with its own table.
  - **Roles.** `associates.role` is free text in this estate ("Associate", "Floor Manager"). The
    mapping is: an explicit override from `POST /api/idv/team/{id}/role` wins (and is the only way
    to create a `viewer`); otherwise role text containing 'manager' or 'admin' is `admin`;
    otherwise any associate is `analyst`; an `X-HW-Actor` that is not an associate has no role and
    every write is 403. Overrides live in an `idv_kv` row, not a new table.
  - **`override` with no reason is 400, not 403.** An override missing its reason is a malformed
    request; answering 403 sends an associate to find an admin when what they need is one sentence
    in the box.
  - **`POST /api/idv/import/didit/{kind}` records a `failed` run, not a 501.** The importer
    (`wmdemo/idv_import_didit.py`) is a later phase and no Didit credentials exist on this server,
    so the route creates a real `RunReport` whose `error` says exactly that. A `status:"ok"` over
    zero rows would read on the Migration screen as "Didit has no sessions".
  - **Media route job tokens.** `GET /api/idv/media/{id}?token=…` accepts a job-scoped token
    instead of a console role, minted at submit, scoped to ONE session and expiring in 3600 s. A
    token for another session's job is 403.
  - **Env vars this backend introduces**: `IDV_MEDIA_DIR` (default `./idv_media`),
    `IDV_ENGINE_URL` (default `http://127.0.0.1:8801`), `IDV_ENGINE_SECRET` (no default; an unset
    secret makes every inbound callback 403, which is the safe direction), `IDV_PUBLIC_BASE` (the
    origin baked into hosted capture URLs and the engine callback URL), `IDV_FRAME_ANCESTORS`
    (default `'self' https://www.hyperwolf.com https://hyperwolf.com`).
  - **Known deployment gap, not fixed here.** `wmdemo/server.py`'s PUBLIC-mode write gate refuses
    every POST without `x-hw-write-token` except the Weedmaps webhook. On a public deployment that
    would also refuse the engine callback and the whole capture API, both of which authenticate
    themselves (HMAC, session token). Widening that exemption is a one-line change to an existing
    condition and was left for the owner rather than made silently.
- 2026-09-08 (owner rulings, round 3 — "approve or deny only" and "Verify verifies the recommendation"):

  **A. `In Review` is never an outcome.** Approve or deny only. `idv_rules.evaluate()` cannot
  return the literal on any channel for any input, and that includes the POS engine-down path,
  which previously produced it: with the engine unreachable at the register and
  `manual_fallback_when_engine_down` on, the session **stays `In Progress`** with
  `message: idv_rules.PAUSED_MESSAGE_ENGINE_DOWN` ("Verification is paused — our checks are
  offline. An associate can look at the physical ID and finish this here."), `next_step: "none"`,
  `guidance: null` and `reasons: ["ENGINE_UNAVAILABLE_MANUAL"]`. Nothing has been judged, so no
  verdict is written. The associate holding the physical ID has exactly two moves, both recorded:
  `PATCH /v3/session/{id}/update-status/` (or the console equivalent) with
  `{ "new_status": "Approved", "override": true, "reason": "<required>" }`, or the same with
  `"Declined"`. Online, the same outage still declines with `next_step: "in_store"`.
  - `ENGINE_UNAVAILABLE_MANUAL` remains in the review-reason enum as a **warning code**. It no
    longer maps to a status of its own.
  - `Decision` and `/capture/{token}/status` gain **`message`** (string or `null`): a sentence for
    a state that is neither a guided retry nor a decision. Today only the engine-down pause sets
    it. `guidance` still means "the guest can fix one step"; `message` does not.
  - `can_transition` **forbids every transition into `In Review`, for every actor** — `engine`,
    `system`, `viewer`, `analyst` and `admin`, with and without `override` — and says so in the
    refusal text rather than answering "not a legal transition". The two edges that used to exist
    (`In Progress` → `In Review` and `Awaiting User` → `In Review`, both `system`) are gone.
  - The literal survives in the ten-status enum **only because imported Didit rows carry it**.
    Support/admin may move an imported `In Review` row OUT, to `Approved`, `Declined` or
    `Resubmitted`; `engine`, `system` and `viewer` may not. Sweepers may still `Abandon`/`Expire`
    one. The `/v2` and `/v3` facades keep returning `In Review` verbatim for those imported rows;
    they never produce it for a native session.
  - `_OVERRIDE_TRANSITIONS` is now the whole list of edges the recorded in-store override widens:
    `Declined → Approved`, `In Progress → Approved`, `In Progress → Declined`. All three need
    `analyst` (not `admin`) *with* `override: true` and a reason; `viewer` is refused, because
    override is not a role, and the system actors cannot use it at all. No other edge changes.

  **B. Medical guests must upload a doctor's recommendation that Verify verifies.**

  `age_rule` is renamed **`REC_21 | MED_18_REC`**. `MED_18_CARD` is accepted forever as an alias
  for `MED_18_REC` (workflows and sessions pinned under the old name must keep evaluating);
  anything unrecognised falls back to `REC_21`, the stricter rule. The inline `Workflow.config`
  and `age_estimations[].rule` fragments above still print the old name — read them as
  `REC_21|MED_18_REC`. `MED_18_REC` means **age ≥ 18 from the barcode DOB AND a verified
  recommendation node**; `REC_21` is unchanged.

  New `Workflow.config` key: **`offer_medical_path`** (boolean, default `true`).

  New capture step **`medical_rec`**, between `document_back` and `selfie` — after the card the
  recommendation is cross-checked against, before the liveness attempt it would otherwise waste.
  `GET /api/idv/capture/{token}/state` `steps[].id` therefore becomes
  `document_front|document_back|medical_rec|selfie|challenge|questionnaire`, and the `medical_rec`
  entry carries **`optional: true`** when it is being offered to an 18–20-year-old rather than
  required. It is present only when one of three things is true:
  1. the workflow's `age_rule` is `MED_18_REC`; or
  2. `expected_details.medical` is `true` (which makes the step required on a `REC_21` workflow
     too, and drops that guest's age floor to 18); or
  3. the guest is **18–20** on a `REC_21` workflow whose `offer_medical_path` is `true` — then the
     page offers "Under 21? Add your doctor's recommendation" **instead of an immediate `UNDER_AGE`
     decline**. The step is optional here; a guest who cannot produce a valid recommendation ends
     `Declined UNDER_AGE`, which is where they started.

  New media kind: **`medical_rec`** (`Media.kind` becomes
  `document_front|document_back|medical_rec|selfie|selfie_frame|liveness_video|portrait_crop|challenge_frame|import_pdf`).
  Licence-derived purpose limits do not reach it — a recommendation is not a government ID — but it
  is verification/fraud data and is retained on the same terms.

  New `Person` field: **`medical_rec_expires_at`** (date or `null`) — the computed validity end of
  the guest's last accepted recommendation, so a returning guest is not asked for the same paper
  twice inside its validity. `idv_rules.evaluate()` returns it as `medical.expires_at`.

  New `Decision` node array, **field-exact**:

```jsonc
"medical_recommendations": [{
  "node_id": "rec-1",
  "status": Status,                       // "Approved" gates approval; "Not Finished" == absent
  "patient_name": "Jane Doe",
  "patient_dob": "1994-03-02",
  "physician_name": "Alice Nguyen, MD",
  "physician_license": "A123456",
  "license_state": "CA",
  "issue_date": "2026-03-01",
  "expiration_date": "2027-03-01",        // null when the document prints none
  "recommendation_id": "REC-88231",
  "verifier_phone": "+1 555 010 2200",
  "ocr_confidence": 92.5,
  "image": "/api/idv/media/<id>",
  "crosscheck": { "name_vs_document": "match|mismatch|unreadable",
                  "dob_vs_document": "match|mismatch|unreadable" },
  "warnings": [{ "risk": "…", "additional_data": null, "log_type": "error|warning",
                 "short_description": "…", "long_description": "…" }]
}]
```

  `idv_rules.evaluate()` returns a **`medical`** block alongside `age` (or `null` when the session
  has nothing to do with the medical path):
  `{ "required", "offered", "optional", "verified", "node_id", "status", "expires_at",
  "expiry_source": "printed"|"issue+12m", "physician_license_kind": "md_ps"|"do_ps"|null }`.

  **Validity rules (California), in the order they are applied** — hard facts about the document
  first, capture problems last, so a guest is never asked to re-photograph a recommendation that
  would be refused anyway:
  1. `license_state` must be `CA` → else decline `MED_REC_OUT_OF_STATE`. Absent (not
     out-of-state) → retryable `MED_REC_UNREADABLE`.
  2. `physician_license` must match a California pattern (below) → else decline
     `MED_REC_INVALID_LICENSE`. Absent → `MED_REC_UNREADABLE`.
  3. `patient_name` must fuzzy-match the ID: normalised edit distance on the **last name** ≤ 0.2
     **and** an identical **first-name initial** → else decline `MED_REC_NAME_MISMATCH`.
     Comparison is on letters only (punctuation, hyphens and spaces normalised away, so
     "O'Brien"/"OBrien" and "Smith-Jones"/"Smith Jones" match); `patient_name` is split on the LAST
     whitespace run, so "Maria de la Cruz" gives last name "Cruz". Only the initial of the first
     name is compared because recommendations print "R.", "Rob" and "Roberto" for one guest. The
     rules re-derive this from the node's own fields whenever both names are present and fall back
     to `crosscheck.name_vs_document` only when they are not.
     *Honest property:* 0.2 tolerates one character in eight and **none in four**, so "Doe"/"Does"
     is a mismatch. That is the strict direction on the shortest surnames, where a one-letter edit
     is most likely to be a different person. Loosening it means a new ruling, not a quiet edit.
  4. `patient_dob` must **equal** the ID DOB when the recommendation prints one → else decline
     `MED_REC_DOB_MISMATCH`. When it prints none, `crosscheck.dob_vs_document` decides
     (`mismatch` → decline, `unreadable` → `MED_REC_UNREADABLE`, absent → nothing: a missing DOB is
     not a mismatch, and the name plus the licence carry the join).
  5. `issue_date` ≤ today, and valid through `expiration_date` if printed, else **12 months from
     issue** (California recommendations are conventionally annual; the shorter reading is the safe
     direction for an age gate) → else decline `MED_REC_EXPIRED`. A printed expiry always wins,
     even when it is earlier than issue + 12 months. There is **no reason code for a
     future-dated document**, so an `issue_date` after today is reported as `MED_REC_EXPIRED`
     ("not valid today") with the real cause in `explain` — flagged rather than invented.
  6. `ocr_confidence` ≥ `config.thresholds.doc_quality_min` → else retryable
     `MED_REC_UNREADABLE`. A null confidence is "we cannot tell", not a pass.
  7. No node at all (or `status: "Not Finished"`) → retryable `MED_REC_MISSING`.

  **Physician licence patterns** (format checks — see the honest limit below):
  - **MD, Medical Board of California, Physician and Surgeon**: `^[ACG]\d{4,7}$`. The letter
    records the licensure pathway (G = NBME, A = FLEX/USMLE/LMCC, C = reciprocity after four years
    in another state). The board's canonical storage is letter + 7 digits, zero-padded after the
    letter to eight characters, but printed cards and letterheads routinely show the unpadded
    number (`G12345`, `A123456`), so 4–7 digits are accepted.
  - **DO, Osteopathic Medical Board of California**: `^20A\d{4,5}$`. Every osteopathic number is
    prefixed with the literal `20A`; the licence number proper is the trailing four or five digits
    (e.g. `20A12345`).
  - Whitespace, dots and hyphens are stripped and the value upper-cased before matching, so
    `A 123456` and `20A-12345` are the same licences. A field carrying two numbers
    (`"A123456; DEA BN1234567"`) matches nothing.
  - Sources, read 2026-09-08: California Cancer Registry / PAQC coding manual, *Physician License
    Numbers* (`http://docs.ccrcal.org/PAQC_Pubs/V1_2016_Online_Manual/Part_III_Identification/III_3_12_1_License_Numbers.htm`)
    — a leading letter plus the numeric part, zero-padded after the letter to eight characters,
    types A/C/G being the Physician-and-Surgeon pathways; Osteopathic Medical Board of California,
    license verification (`https://ombc.ca.gov/consumer_complaint/license_ver.shtml`) — numbers
    "always start with 20A", the licence number being the last four or five digits; Medical Board
    of California, License Types (`https://www.mbc.ca.gov/License-Verification/License-Types.aspx`).
  - **Honest limit, stated in `explain` on every medical session:** these are FORMAT checks.
    Nothing here proves the licence was issued or is in good standing. A real existence check means
    the Medical Board's own verification service, i.e. a third party, which plan §0 rules out from
    day one. If the owner wants existence checked, that is a §0 exception to raise, not a gap to
    assume away.

  **New reason codes.** Retryable (re-open the `medical_rec` step, `resubmission_max` tries):
  `MED_REC_MISSING`, `MED_REC_UNREADABLE`. Decline: `MED_REC_EXPIRED`, `MED_REC_NAME_MISMATCH`,
  `MED_REC_DOB_MISMATCH`, `MED_REC_INVALID_LICENSE`, `MED_REC_OUT_OF_STATE`. `UNDER_AGE` is
  additionally recorded whenever an **18–20-year-old** ends up without a valid recommendation —
  both when a recommendation was produced and refused (the specific `MED_REC_*` code leads,
  `UNDER_AGE` follows) and when the tries run out (`UNDER_AGE` leads, the `MED_REC_*` code is the
  detail). Under 18 is always `UNDER_AGE`, recommendation or not: 18 is a floor, not a suggestion.
  An **over-21** guest on a `MED_18_REC` workflow who never produces one declines under
  `MED_REC_MISSING` — `UNDER_AGE` would be a lie.

  **Score cap.** `CAP_MED_REC_UNVERIFIED = 45.0`, below `APPROVE_SCORE_LINE`: a medical session
  cannot be `Approved` without a `medical_recommendations[0].status == "Approved"` node **and**
  every validity rule above satisfied. Both have to hold — the engine's own verdict on the node
  does not substitute for the rules, and the rules do not substitute for it. A node the engine
  refused for a reason these rules cannot re-derive is asked for again, never approved.

  **Per-step attempts.** `session.attempts` gains `medical_rec` alongside `document_front`,
  `document_back`, `selfie` and `challenge`; without the dedicated counter it falls back to
  `resubmissions`, like the document steps, so the step always advances.

  **Not built by this change, and not silently assumed:** the `medical_recommendations` node has
  to be *produced* (engine: an OCR pass over the recommendation, `POST /engine/v1/medical/analyze`
  by analogy with `/document/analyze`) and *captured* (the `medical_rec` step on the capture page,
  and `POST /api/idv/capture/{token}/media` accepting `kind=medical_rec`). Both follow this
  contract; neither exists yet. Note also that `wmdemo/idv_api.py:1631` passes the raw callback
  `body` to `evaluate()` while this contract nests the nodes under `body.decision` — so
  `medical_recommendations`, like every other node, is only read if that mismatch is resolved.
- 2026-09-08 (backend consolidation, `wmdemo/idv_api.py` + `wmdemo/idv_store.py`, written while
  reading this file's own addenda against the code):

  **A. The engine callback envelope.** The callback body nests its nodes under `decision`, and
  `idv_rules.evaluate()` reads them off the TOP LEVEL of its `engine` argument. The backend now
  flattens one into the other — `engine = dict(body); engine.update(body["decision"])` — so the
  rules see `id_verifications`, `liveness_checks`, `face_matches`, `face_searches`,
  `age_estimations`, `ip_analyses`, `crosschecks` **and** `medical_recommendations` alongside the
  envelope's own `proposed_status`/`reasons`. Storage still reads `body["decision"]` verbatim, so
  what is stored is byte-comparable with Didit's. This is the mismatch the previous addendum
  flagged at `idv_api.py:1631`; it is resolved, and it was not only the medical node that was
  invisible — every node array read empty.

  **B. The callback is transition-checked.** Before applying, the receiver asks
  `can_transition(current, proposed, "engine")`. A callback that would move a session which has
  since been decided (`Approved`, `Declined`) or closed (`Abandoned`, `Expired`) is **stored as an
  event of type `callback.ignored`** and answered `200 { "received": true, "applied": false,
  "reason": "<the refusal sentence>" }`. `reason` is new on this response and is present only on
  an ignored callback. A callback whose proposed status EQUALS the current one is applied as
  before (it is a re-evaluation, not a move). An analyst verdict is never overwritten by a job
  that was queued before it.

  **C. `idv_sessions.attempts` (JSON) and `idv_media.client_metrics` / `challenge_id`.** Three
  columns added by `ALTER TABLE … ADD COLUMN` in `ensure_schema` (guarded by `PRAGMA table_info`;
  `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists).
  - `attempts` is `{step: n}` over `document_front | document_back | medical_rec | selfie |
    challenge`, and is what `idv_rules._attempts_for` reads. It counts the capture that ANSWERS an
    `Awaiting User` for that step, never the first capture of a step — so `guidance.attempt` reads
    1 on the first judgement and reaches `max` on the last, and `LIVENESS_FAILED_3X` and the
    medical exhaustion path are reachable at all. `liveness_attempts` and `resubmissions` are kept
    in step with it and are never moved downwards, including by an engine node reporting the
    attempts inside ONE job.
  - `client_metrics` and `challenge_id` are persisted from the `POST /capture/{token}/media`
    multipart form. `Media` therefore gains **`challenge_id`** (string or null) and
    **`client_metrics`** (object or null), and the engine job body's `media[]` entries gain the
    same two fields alongside `id`, `kind`, `url`, `sha256`. The engine cannot re-derive either.

  **D. `expires_at` is enforced at the capture-token lookup.** `idv_store.parse_iso` used
  `time.mktime(...) - time.timezone`, which reads the struct as local time and applies the host's
  DST rule while `time.timezone` is the standard-time offset only: every timestamp inside DST
  parsed an hour early on this host. It is now `calendar.timegm`. Every
  `/api/idv/capture/{token}/*` route answers **`410 { "error": "This link has expired — ask for a
  new one." }`** once `expires_at` has passed, rather than waiting for the sweeper's next pass.
  The sweeper is unchanged.

  **E. `POST /api/idv/capture/{token}/abandon` is a no-op unless the session is untouched.** The
  beacon fires on any page-hide (rotation, the photo picker, a backgrounded tab), so it may only
  act on a session whose status is `Not Started` or `In Progress` **and** which has zero media
  rows. Response gains **`applied`** (boolean) and, when false, **`reason`**: `200 { "status":
  "<unchanged>", "applied": false, "reason": "…" }`; a real abandon answers `200 { "status":
  "Abandoned", "applied": true }`. `POST …/media` may lift `Abandoned` back to `In Progress`, and
  only because the token is still inside its TTL (D).

  **F. Reasons are de-duplicated, order-preserving**, on the session row, in `SessionSummary`
  and in `/capture/{token}/status`.

  **G. `In Review` is not writable.** `PATCH /api/idv/sessions/{id}/update-status` and
  `PATCH /v3/session/{id}/update-status/` accept `Approved | Declined | Resubmitted`. `In Review`
  is still PARSED, and refused with **409** carrying the r3 ruling, so the answer reads as a state
  conflict rather than a typo; the refusal is checked AFTER the role gate, so a viewer still gets
  403. Transitions OUT of `In Review` are unchanged for imported Didit rows. `enqueue_review` is
  gone from the callback path entirely: the review queue holds imported `In Review` rows and
  nothing else.

  **H. `POST /api/idv/media` (analyst+), new.** Multipart `kind` ∈ `face_list | medical_rec |
  document_front | document_back | selfie`, `file`, optional `session_id` → `201 { "media": Media
  & { "session_id": "…" | null } }`. Same magic-byte admission as the capture route (413/415).
  A row with no session is owned by the sentinel session id `"console"`, because the column is NOT
  NULL and a media row with no owner is an orphan the purge can never find.
  `POST /api/idv/lists/{id}/entries` already accepted `media_id`; it now answers **404** when that
  id resolves to nothing, instead of creating a face-list entry that matches nobody.

  **I. `GET /api/idv/capture/{token}/state`** gains `session_id`, `session_number`, and
  `workflow.age_rule` / `workflow.manual_fallback_when_engine_down`. `steps[]` includes
  `medical_rec` between `document_back` and `selfie` when the r3 §B rules put it in play, carrying
  `optional: true` only for the 18–20 offer. The guest's age is read from the latest decision's
  DOB and then from `expected_details.date_of_birth`; when neither is known the step is not
  offered, which is the strict direction — the offer arrives once the card has been read.
  `medical_rec` is admitted by `POST …/media` with the document kinds' purpose
  (`verification_fraud`) and retention (`until_customer_deleted`), and every media row including
  it is listed in the engine job.

  **J. `idv_version` on every read.** Added to `/lists`, `/lists/{id}/entries`, `/team`,
  `/retention`, `/deletion-requests`, `/questionnaires[/{id}]`, `/customization`, `/import/runs`
  and `/import/runs/{id}`. **`GET /api/idv/workflows/{id}/versions` therefore changes shape** from
  a bare array to `{ "idv_version", "rows": [ … ] }` — a bare array has nowhere to put the counter
  the console polls.

  **K. `SessionSummary` gains `imported_at` and `scores`.** `imported_at` is the `received_at` of
  the session's own import event (never `created_at`, which is Didit's creation time and often a
  year older) and is `null` for a native session. `scores` is
  `{ "liveness", "face_match", "doc_quality" }`, read from the decision's own denormalised columns
  so the row and the record cannot disagree; each member is `null` when there is no decision yet.

  **L. Already true, now written down.** `GET /api/idv/sessions/{id}` returns `consents: [{ kind,
  accepted_at }]` at the top level alongside `session`, `decision`, `media`, `person`,
  `similar_faces` and `queue`; `session` carries `guidance` (object or null) and `next_step`
  (string or null).

  **M. `/api/idv/usage` `imported` is an ARRAY** of `{ feature, n, note }`, `[]` until an import
  writes the counts (`idv_store.set_imported_usage`, stored in `idv_kv`). The single-object shape
  could only ever carry one feature and shipped as `{"feature": null, "n": 0}`, which the Usage
  screen renders as a feature called "null".

  **Not done by this pass, and not silently assumed.** The engine still has no
  `POST /engine/v1/medical/analyze`, so a `medical_recommendations` node is accepted and evaluated
  but nothing produces one yet; the capture PAGE (`idv/capture.jsx`) does not render the
  `medical_rec` step or send `client_metrics` — the backend accepts both and the page is a
  separate file this pass did not touch. `wmdemo/server.py`'s PUBLIC-mode write gate still refuses
  the engine callback and the capture API (the known deployment gap recorded above) — unchanged,
  and still one line for the owner.

- 2026-09-08 (backend safety pass, `wmdemo/idv_api.py`, four confirmed findings — probes
  `qa/idv_api_probe.py` AP-95..AP-101, 94 → 101 checks):

  **A. `/v2` IS AUTHENTICATED. THE SITE BACKEND MUST SEND A HEADER IT DOES NOT SEND TODAY.**
  Both facade routes now take the same `x-api-key` gate as `/v3`, plus a scope each that `/v3`
  itself does **not** enforce (see the caveat at the end of this item):

  ```
  POST /v2/session                 x-api-key: <Verify key with scope sessions:write>
  GET  /v2/session/{id}/decision   x-api-key: <Verify key with scope sessions:read>
  ```

  The exact header is `x-api-key: hwv_live_…` — the same header, name and value shape the site
  already sends to `/v3`. No key, an unknown key, a **revoked** key, or a key without the route's
  scope is **403 `{ "error" }`** (never 401, matching Didit and the rest of this file). A key that
  authenticates has its `last_used_at` stamped **even when it is then refused for scope** — a key
  being hammered by a mis-configured site must not read as "never used" on the API Keys screen, and
  the refusal is metered like any other call. Rate limits are the `/v3` ones: 600 GET/min, 300
  write/min per key.

  This route shipped **open**: anyone who could reach the host could mint sessions and read a
  decision — name, date of birth, licence number, the portrait and selfie URLs — for any session id
  they could guess or observe. "The site posts server-to-server" describes who we expected to call
  it, not a control. **This is the header the migration checklist on the Integrate screen already
  implies**: that screen says `DIDIT_API_KEY` → a Verify key, and until now that swap was cosmetic
  because `/v2` read no key at all. It is now load-bearing, and a site backend that repoints its
  base URL without setting the key will get 403 on every call. Cut the key in the console
  (`POST /api/idv/api-keys` with `scopes: ["sessions:read", "sessions:write"]`, or both scopes on
  one key), set it as the site's `DIDIT_API_KEY`, and the existing `x-api-key` send path carries it.

  **Caveat, stated rather than left to be found: `/v3` enforces no scopes.** All seven of its
  `_api_key_gate` call sites pass none, so a `sessions:read` key still creates a session on
  `/v3/session/`. Scopes bite on `/v2` only, which is where the site is being pointed. Making them
  mean the same thing on `/v3` changes behaviour for live integrations holding narrow keys and is
  a separate decision; it is owed, not done.

  **B. Every `/api/idv/*` route needs an actor, READS INCLUDED.** `require(actor, "viewer")` now
  runs for every console route before it dispatches. An absent `X-HW-Actor`, or one that resolves
  to nobody, is **403 `{ "error" }`** on `GET /sessions`, `GET /sessions/{id}`, `/people`,
  `/dashboard`, `/audit`, `/lists`, `/workflows`, `/team`, `/usage`, `/retention` — everything.
  Four routes are deliberately exempt and stay open: `GET /api/idv/version` and
  `GET /api/idv/engine/health` (the header polls both before anyone is known and neither says
  anything about a person), the `/api/idv/capture/{session_token}/*` routes (the bearer IS the
  token in the path), and `POST /api/idv/webhooks/engine` (HMAC-signed; it holds no actor). The
  media route `GET /api/idv/media/{id}` keeps its own two-way gate — a job token **or** a viewer
  role — and is therefore also not behind the blanket check.

  **One route will have to join that exempt list and does not exist yet.** `submit_engine_job`
  hands the engine `templates_url = /api/idv/internal/templates?person_id=…`, and the engine
  fetches it with `?token=<media token>` (`idv-engine/app.py:427`, `163-164`). Nothing implements
  it: it fell through to 404 before this change and answers 403 now, and the engine swallows both
  into an error node, so the 1:N face search degrades **in silence** either way. Whoever
  implements it must gate it on the media token, not the viewer role, or it is born behind this
  gate and breaks the engine on day one with nothing raised.

  Until now the WRITE routes each took their own `require` while the reads took no actor at all, so
  the console looked gated: a name, a date of birth, a licence number and the audit trail itself
  came back to any caller who could reach the host, and the audit row written for that read
  recorded actor `null`. **Note the honest limit:** `X-HW-Actor` identifies, it does not
  authenticate. What changed is that a caller must now name somebody who exists, so every look at
  an identity document is attributable. A real session login is still owed.

  **C. The engine media token is scoped to its job AND that job's media ids.** `mint_media_token`
  takes the media ids the job lists and stores them on the token record; `check_media_token`
  refuses any id that is not on it. The token also dies when its job does: the callback receiver
  writes `mt.spent:{job_id}` **in the same transaction that applies the decision**, so an applied
  callback and a live token cannot come apart, and a token whose job never calls back still expires
  at `MEDIA_TOKEN_TTL_S` (3600 s). A token minted before this binding existed carries no media ids
  and is refused rather than treated as a wildcard — fail closed; the engine re-fetches on its next
  job, a leaked old token does not. The docstring claimed job scoping and the code compared only
  `session_id`: one token opened every file on the session for a full hour, including media
  captured **after** the job was submitted and media belonging to a later job the engine was never
  given.

  **D. `In Review` is refused on a decision NODE too.** `PATCH /api/idv/sessions/{id}/features/
  {node_id}/update-status` now answers **409** with the r3 ruling text — verbatim the same sentence
  as addendum G's session route — when the session is native. Imported Didit rows still accept it,
  because their nodes legitimately carry `In Review` and support has to be able to put one back;
  the test is `idv_sessions.imported_from IS NOT NULL`. The refusal is checked AFTER the role gate,
  so a viewer still gets 403. Addendum G closed the session route and left this one open: the same
  state by a quieter door. A node's status drives the per-feature badge on the session screen
  (`idv/screen-session.jsx:657-661`); it is NOT what the review queue reads — that reads
  `idv_review_queue` rows, a separate table. Note also the term this route has that
  `update-status` does not: `_update_status` refuses `In Review` for every session, imported ones
  included, because moving a SESSION into that state is what the ruling forbids, while a feature
  NODE on an imported row legitimately carries it. `imported_from` is written only by the importer
  and by no API create path, so the exemption is not caller-reachable.
