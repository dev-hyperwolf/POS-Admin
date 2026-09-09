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

- 2026-09-08 (1:N face search and `/v3` scopes — `wmdemo/idv_api.py`, `wmdemo/idv_store.py`):

  **A. `GET /api/idv/internal/templates` now exists.** It is referenced by the "Engine contract"
  section above and had **never been implemented**: `submit_engine_job` handed the engine a
  `templates_url` pointing at it, the engine fetched it, got a 404, caught the exception and wrote
  an error node — so the 1:N face search (duplicate people, face blocklist) produced nothing on
  every job and raised nothing anywhere. Everything else the feature needs was already built: the
  engine can search, `idv_face_templates` exists, the console has a Face Blocklist, and
  `idv_rules` has both `DUPLICATE_PERSON` and a face-list join. One missing route made all of it
  inert.

  `GET /api/idv/internal/templates?token=<media_token>&person_id=&dob=YYYY-MM-DD&last_initial=X`
  → `200 { "model": "sface", "dim": 128, "templates": [{ "id", "person_id", "session_id",
  "media_id", "model", "dim", "embedding_b64", "quality" }], "list_templates": [{ "id", "list_id",
  "entry_id", "list_name", "media_id", "model", "dim", "embedding_b64" }], "list_media": [{
  "entry_id", "list_id", "list_name", "media_id", "media_url" }], "n", "truncated" }`.
  `n` is `len(templates) + len(list_templates)` — what the engine can actually **search** on this
  answer. `list_media` is work the engine still has to do and is deliberately **not** folded into
  `n`. The `templates[]` rows carry `model`/`dim`/`media_id` beyond the four fields a caller
  strictly needs: `model` and `dim` are what `face.decode_embedding` and the model guard read, and
  `media_id` is the only key a match carries back (see **C**).

  **THE GATE IS THE JOB'S MEDIA TOKEN, and nothing else.** It sits **above** the console's
  `require(act, "viewer")` line — the engine holds a token and no actor, so behind that gate the
  route would answer 403 forever and the engine would fold that into the same silent error node as
  the 404. It also refuses a console **admin**, in the other direction: these are raw face
  embeddings and the only caller with a reason to read one is a job that is running right now. The
  token is extended with a `templates: true` grant at mint time; a token minted before that grant
  existed is refused rather than treated as a wildcard, the same fail-closed direction the
  `media_ids` binding took in addendum **C** above. The token dies with its job, so a token
  authorises the route for that job's lifetime and no longer.

  **The blocking key is non-biometric** (plan §3.2): `dob` ± 2 years **and** `last_initial`. With
  neither, every live template comes back, capped at 20,000 with `truncated: true` — and the cap
  is a signal to send a blocking key, never a page size to raise, because FPIR ≈ N × FMR. Two
  deliberate choices, stated because their opposites are invisible: (i) a template whose identity
  is unknown from **both** the person row and the session's latest decision is **kept** under a
  blocking key — blocking is an optimisation on N and must not become a recall loss; (ii) the DOB
  window widens outwards on 29 February (28 Feb / 1 Mar) rather than clamping inwards.

  **THE ENDPOINT MAY BE CALLED TWICE PER JOB.** `submit_engine_job` now composes `templates_url`
  from the session's own `expected_details`: `?dob=…&last_initial=…` when they are present, and
  **no query at all** when they are not. A session created with no `expected_details` therefore
  gets the unblocked URL, and the engine may re-call the same endpoint with `dob` and
  `last_initial` once the PDF417 barcode has given it a date of birth and a surname. Both calls
  carry the same token.

  **`?person_id=<this session's person>` is no longer what a job is sent.** That is what the
  Engine-contract line above described and what shipped, and it is the wrong half of the
  population: `idv_rules` skips any 1:N match whose `person_id` equals the session's own, so a
  candidate set restricted to that person contained nothing the rules could use and
  `DUPLICATE_PERSON` was unreachable by construction. The parameter is still **accepted** (the
  console and QA both want an exact filter); it is simply not what a job asks for.

  **Face lists reach the engine two ways.** An entry that already has an embedding is a
  `list_templates[]` row. An entry that has only a **face** — an analyst's console upload, which is
  the ordinary case — has no embedding for anyone to send, because the engine is the only thing in
  this estate that can make one; those come back as `list_media[]`, a URL the engine fetches and
  embeds itself. Authorised by extending the **same** token to exactly the media ids it disclosed
  (`grant_list_media`), additively and idempotently so a second call cannot revoke the first call's
  grant mid-fetch. It never widens to the session's own media: the `media_ids` binding of addendum
  **C** still holds, and a file on another session is still 403.

  **THE ENGINE HALF IS OWED AND IS NOT DONE.** `idv-engine/app.py:158-170` (`fetch_templates`)
  returns `data.get("templates")` and **ignores `list_templates` and `list_media`**. Until that one
  function is changed, duplicate-person detection works and the face **blocklist** half of 1:N
  still does not reach the search. `idv-engine/` was read-only for this pass.

  **B. `/v3` enforces scopes.** All seven gates now pass one, mirroring `/v2`: `sessions:write` on
  `POST /v3/session/` and `PATCH /v3/session/{id}/update-status/`; `sessions:read` on
  `GET /v3/session/{id}/decision/`, `GET /v3/session/{id}/generate-pdf/` and `GET /v3/sessions/`;
  `lists:read` on `GET /v3/lists/` and `GET /v3/lists/{id}/entries/`; `users:read` on
  `GET /v3/users/`. Before this they passed **none**, so a key issued read-only could mint sessions
  and move statuses, and the scopes shown on the API Keys screen described a control that existed
  on `/v2` alone.

  **This is a live-integration change, and here is the migration sentence: a key used by the site
  needs BOTH `sessions:read` AND `sessions:write`.** The site creates a session and later reads its
  decision, and those are now two different scopes on `/v3` exactly as they already were on `/v2`.
  An existing key carrying only `sessions:read` gets **403** on `POST /v3/session/` where it used
  to get 201. Create it with `POST /api/idv/api-keys { "name": "hyperwolf-backend", "scopes":
  ["sessions:read", "sessions:write"] }`, or tick both boxes in the Integrate screen's key modal.

  **One gap named, not closed:** the console's key modal offers three scopes and `users:read` is
  not among them (`POS-Admin/idv/screen-integrate.jsx:21` — `SCOPE_OPTIONS`), so a key created in
  the UI cannot read `GET /v3/users/` today. `POST /api/idv/api-keys` accepts any scope list, which
  is the workaround. Adding `'users:read'` to that array is a one-line UI change and is owed.

  **C. A 1:N match resolves to a person or a list entry before anything reads it.** The engine's
  `face.search` builds each match from exactly four candidate keys — `person_id`, `session_id`,
  `media_id`, `list_id` (`idv-engine/pipeline/face.py:348-356`) — and **cannot** return a list
  entry id at all. `idv_rules._face_matches_entry` joins on `list_entry_id` or
  `face_template_id`, neither of which the engine can send, so an unresolved match joined to no
  list entry and carried a null person: a face blocklist that matches nothing and a
  `DUPLICATE_PERSON` that cannot fire, in exactly the shape of a working feature. The callback now
  resolves every match **in place, before `match_lists` and `evaluate` read it**, off `media_id`:
  it fills `person_id`, `session_id`, `face_template_id`, `person_name`, and for a list candidate
  `entry_id` **and** `list_entry_id` (one value, both names — the first is the contract's, the
  second is the one `idv_rules` joins on), `list_id`, `list_name` and `match_type`
  (`person|list_entry`), plus a `media_url`. Mutated in place so the rules, the stored decision,
  the stored event payload and the outbound webhook cannot disagree.

  `GET /api/idv/sessions/{id}` `similar_faces[]` accordingly becomes `[{ "person_id",
  "person_name", "session_id", "entry_id", "list_id", "list_name", "match_type", "similarity",
  "media_url" }]`. It previously emitted a `media_url` key that nothing in the system ever set.

  **`templates[]` on the callback was already persisted** — verified, not changed: the callback is
  the only writer of `idv_face_templates` and it enrols each returned embedding against the
  session's person. The one edit was hoisting the session re-read out of that loop.

  **A limit that cannot be closed from this side:** a face-list entry that has a
  `face_template_id` but **no** `media_id` comes back from the engine with only a `list_id` on it
  and cannot be resolved to its entry, because the entry id does not survive `face.search`. No such
  entry exists today — the console's own path always uploads a face first — and the resolution
  falls back to `match_type: "list_entry"` with the list named but the entry not.

- 2026-09-08 (calibration, backend rules pass — `wmdemo/idv_rules.py`, `wmdemo/idv_api.py`,
  `wmdemo/idv_store.py`). Source for every number below:
  `POS-Admin/scratch/idv-calibration-2026-09-08.md`, measured over 1,020 imported Didit sessions
  carrying media. **Read that report's §8 before quoting any of these**: the corpus contains no
  real capture-path selfie, so every face figure rests on the front-camera frame taken while the
  guest photographed the card, and the face thresholds are provisional pending a re-derivation on
  ≥ 300 real selfies.

  **A. `proposed_status: "Not Finished"` is a PAUSE, and it is now in the engine contract.** The
  engine may answer a job with `proposed_status: "Not Finished"`, `reasons` containing
  `ENGINE_MEDIA_UNAVAILABLE` or `ENGINE_NO_EVIDENCE`, and **empty** decision-node arrays: it could
  not fetch the media, or had nothing to judge. Two new reason codes, both in `REASONS_RETRYABLE`
  and neither in `_GUIDED`.

  `idv_rules.evaluate` handles them in **section 0, before any node block** — with empty nodes
  every other rule reads "no signal" and starts asking for re-captures — and returns
  `{ status: "In Progress", reasons: [<the code>], guidance: null, next_step: null,
  score_cap: null, message: "Checking your ID is taking longer than usual — hang on." }`
  (`idv_rules.PAUSED_MESSAGE_ENGINE_RETRY`). **No attempt is spent and no score cap is applied:** a
  cap is a statement about the evidence and there is none. This sentence is deliberately *not*
  `PAUSED_MESSAGE_ENGINE_DOWN`, which sends the guest to a store — the wrong answer to a
  two-second blip.

  `idv_api._engine_callback` then writes a session event `engine.retry_scheduled` and re-enqueues
  the job on a backoff of **2 s, 10 s, 60 s** (`idv_api.ENGINE_RETRY_BACKOFF_S`). After the third,
  it writes `engine.gave_up`, deletes the schedule and sets the session's `next_step` to
  `in_store` for `hosted`/`embedded` and `none` for `pos` (the associate's recorded override is
  the resolution there). **The session stays `In Progress` throughout** — nothing judged it, and a
  decline is a statement about a person.

  Each retry carries a **new `job_id` and a freshly minted `media_token`**. It cannot re-post the
  original body: `_engine_callback` spends the old job's token in the same transaction as the
  decision, so the engine would fail to fetch the media a second time for an entirely different
  reason and the retry would read as confirmation of the original fault.

  The due time is an `idv_kv` row (`engine_retry:<session_id>` → `{attempt, due_at, session_id,
  reasons, last_job_id}`), fired by `GET /api/idv/capture/{token}/status` — the guest's own poll,
  which is what actually delivers a 2-second retry — and by `idv_store.sweep`, the backstop for a
  guest who closed the tab. No threads and no timers: a sleeping thread loses its queue on every
  restart, and a restart is exactly when an engine outage is likely. `sweep()`'s return gains
  `engine_retries: [...]`.

  `/capture/{token}/status` accordingly gains one behaviour: `next_step` is now emitted whenever
  the session carries one, not only on `Declined`. Before this, a give-up's path existed in the
  database and on no screen.

  **B. The barcode is the data source; OCR is a cross-check.** New reason code
  `BARCODE_NOT_DETECTED` (retryable, guided, step `document_back`, sentence "We couldn't read the
  barcode on the back — fill the frame with the card and hold still."). It replaces
  `DOC_QUALITY_LOW` for a US `DL`/`ID` whose `id_verifications[0].barcode_fields` is empty. It is
  capture-safe, so it reaches the guest's own status screen.

  Why it is its own code: on the corpus the front image scores a **median 96/100** while the
  PDF417 fails to decode on **58.4%** of sessions (§2.1, §2.4). `DOC_QUALITY_LOW`'s sentence is
  "there's glare over the card — tilt it away from the light", which is both untrue and points at
  the **front**. The old behaviour sent 58% of guests back to re-shoot a sharp front image, three
  times, and then declined them. The score cap (`CAP_BARCODE_UNREADABLE`) and the retry budget
  (`resubmission_max`, then `Declined` with `next_step: in_store`) are unchanged.

  **When the barcode is absent, the printed fields may be DISPLAYED but may not satisfy — or
  fail — the age, expiry or name checks.** §2.3 measures the OCR-only fallback at DOB **25.8%**,
  surname **3.3%**, document number **5.0%** agreement with the vendor, against **97.6% / 96.9% /
  98.3%** when the barcode decodes. So on such a session `idv_rules` does not raise `DOC_EXPIRED`
  or `DOC_NEAR_EXPIRY` from the printed expiry, does not raise `UNDER_AGE` from the printed date
  of birth (`age.pass` is `null`), and does not compare the medical recommendation's patient name
  or DOB against the ID (`MED_REC_NAME_MISMATCH` / `MED_REC_DOB_MISMATCH` are skipped).
  `explain` says so on every such session, in one sentence
  (`idv_rules.OCR_ONLY_EXPLAIN`). The reason the checks are skipped rather than merely
  un-passable: each of them is a **hard, unappealable decline**, and deciding one on a coin flip
  turns away a guest holding a current card with no way back. `BARCODE_NOT_DETECTED` has already
  re-opened the back of the card, which is the fix.

  **Scope, stated because it narrows the instruction.** The rule fires only where a barcode was
  *expected*: US `DL`/`ID` (`idv_rules.barcode_expected_but_absent`). Passports and residence
  permits carry no AAMVA PDF417 **by design** — 0 of 50 and 0 of 7 in the corpus decoded, which is
  correct behaviour, not a failure (§2.1) — so treating their missing barcode as "the data source
  is gone" would make every passport holder unverifiable online. The §2.3 accuracy figures were
  measured on exactly the population the rule fires for.

  `BARCODE_OCR_MISMATCH` is unchanged: a cross-check disagreement still gets **one** retake and
  then declines (`MAX_BARCODE_MISMATCH_ATTEMPTS = 2`).

  **C. Workflow `config.thresholds` gains a fourth key, and two numbers change.**

  | key | was | is | provenance |
  |---|---|---|---|
  | `face_match_min` | 75 | **60** | §1.5/§1.9. 75 is a Didit-era number carried across a model change: on the same image pairs Didit's score distribution has median 74 and SFace's has median 66.9 (§1.7). Measured over 582 genuine / 337,730 imposter pairs, **75 implies an 86.9% false-decline rate** (506 of 582), each after three wasted retries. **60 implies 26.1%** (TAR 0.739) at FMR 5.8 × 10⁻². The report's own recommendation was 55.0 (14.6% false decline, FMR 3.0 × 10⁻¹); 60 is the owner's call and buys roughly 5× less imposter acceptance for ~11 pp more false declines. |
  | `face_search_min` | *(absent)* | **80** | §4.2, derived **separately** and used by `idv_rules` for `DUPLICATE_PERSON` and face-list hits instead of `face_match_min`. 1:N is a different problem: FPIR ≈ N × FMR, and selfie-vs-selfie imposters run ~3 points hotter than the selfie-vs-portrait pairs the 1:1 number comes from (mean 55.44, p95 64.36, max 89.32 over 143,781 blocked pairs). Re-running the corpus' duplicate search at the 1:1 operating point of 67.5 produced **1,881 different-identity hits from 144,991 comparisons** — 13× the FMR that threshold buys on the 1:1 problem. At 80 the same measurement expects **3**. |
  | `liveness_min` | 70 | **70** (unchanged) | §3. The passive PAD model as wired returns a near-constant: **max observed 0.049 / 100 across 608 real selfies**, so *any* threshold ≥ 0.05 declines 100% of real guests. It is not load-bearing today because the live workflow pins `face_liveness_method: ACTIVE_3D`, which gates on the nonce-bound challenge. **This is an engine defect, not a threshold problem**, and moving the number would hide it. The wiring is being fixed in the engine; 70 is correct the moment it lands (§3.2 measures FNMR 5.3% there). |
  | `doc_quality_min` | 60 | **60** (unchanged) | §2.4. On our own scale 60 rejects **0.39%** of documents (it would reject 12.4% on Didit's), so it is very nearly inert. Left alone deliberately: after (B) it is the barcode, not the quality score, that decides whether a document can be trusted, and raising this to ~80 would begin declining documents whose barcode decodes perfectly. |

  **How they are applied.** `idv_store.calibrate_workflow_thresholds`, called from
  `ensure_schema`, writes a **new workflow version** for every workflow whose config does not
  carry `"thresholds_calibrated": "2026-09-08"`, setting `face_match_min` and `face_search_min`
  and stamping that key. Never an in-place edit: `idv_sessions` pins `workflow_version`, so a
  session judged under 75 must keep reading 75 when the console reopens it. The seeded "Cannabis
  Verification + Selfie" workflow therefore keeps `face_match_min: 75` at **version 1** and gains
  version 2 with the calibrated numbers; every **imported** Didit workflow is migrated the same
  way, and its own `liveness_min` / `doc_quality_min` are left exactly as the vendor had them.
  The Workflows screen reads `config`, so nothing else changes.

  Idempotency is **by content**, not by a one-shot `idv_kv` flag: a flag would have to be set on
  the first `ensure_schema`, which on a fresh database runs *before* `seed()` creates the default
  workflow — the flag would be set with nothing migrated — and every workflow the Didit importer
  creates later would be missed. `seed()` therefore calls `ensure_schema(migrate=False)` (it is
  creating the rows the migration acts on) and `idv_api.handle` re-runs the migration immediately
  after seeding, so a brand-new install is calibrated on its **first** request.

  **D. `insert_decision` keeps `warnings`, and a missing barcode still reports its quality
  score.** Verified rather than changed: with no explicit `warnings=`, `insert_decision` collects
  `id_verifications[*].warnings` into the decision's own `warnings` column, and `decision_out`
  returns `id_verifications` verbatim, so the document node keeps the engine's
  `BARCODE_NOT_DETECTED` warning (595 of 1,020 imported sessions carry it) into both the decision
  row and `GET /api/idv/sessions/{id}`. `scores.doc_quality` on the sessions row still shows the
  real number — 96 on a session whose barcode did not decode. Without the warning beside it, that
  row reads as a clean 96 and the reason the guest was sent to the **back** of the card appears on
  no screen.

- 2026-09-09 (engine node shapes, measured on a live guest session — `wmdemo/idv_rules.py`):

  **A. Node-level `status` from the engine is `null`, and that does NOT mean "not finished".**
  This is not a defect and it is not optional. The engine posts `decision.*[].status: null` on
  every node and says so in the callback body itself:

  > `proposed_status and reasons are the engine's opinion only. wm-demo's workflow rules and list
  > matches decide the session's actual status; every decision node in decision carries status:
  > null for the same reason.`

  The engine measures; it does not judge. `idv_rules` is the only thing in Verify that judges, so a
  node's `status` is the *workflow's* verdict and the engine is not entitled to fill it in.

  **`"Not Finished"` remains the one and only unfinished marker.** A consumer deciding whether a
  node ran must ask "did it carry a signal?" — a numeric score, or for a document node the per-side
  quality scores and the fields it read — and must not treat a null `status` as an absent node.

  *What it cost:* `idv_rules._finished` read `status in (None, "Not Finished")` as unfinished.
  On the session of 2026-09-09 (`job_4205c5baac5e409eaef53e185bfa7566`, saved scrubbed at
  `wm-demo/qa/fixtures/idv/engine-callback-real-2026-09-09.json`) that produced
  `Awaiting User ['DOC_QUALITY_LOW', 'LIVENESS_LOW', 'LIVENESS_LOW', 'FACE_MATCH_LOW']` with
  "The document node did not finish" for a document scoring **96.8 / 97.4**, "the passive liveness
  model produced no score" for a passive PAD of **97.86**, and "The 1:1 face match produced no
  usable score" for a match of **84.3** — and it pointed the guest at the **front** of a card whose
  front was fine. It was not session-specific: `Approved` was unreachable through this engine for
  **every** guest, and no test could see it, because every fixture in `qa/idv_rules_probe.py` was
  hand-written in the shape the rules expected. The correct verdict for that session is
  `Awaiting User ['BARCODE_NOT_DETECTED', 'LIVENESS_LOW']`, guidance on `document_back`.

  **B. Consumers must read `Score.score`, not the field as a number.** The `Score` fragment under
  *Common fragments* is the shape the engine sends on `liveness_checks[].score`,
  `face_matches[].score` and `face_searches[].matches[].similarity`: an **object**
  `{ score, status, model, model_version, certified, caption }`, carrying the model provenance a
  decision has to be auditable against. `Score.status` is null for the same reason node `status`
  is.

  Both shapes are live on the same field, so a reader must accept both: the bare number is what an
  imported Didit decision, `/v2`, and every hand-written fixture carry.
  `front_image_quality_score` has a **third** shape — the Didit importer writes `{ "value": 96.8 }`
  — so the accepted forms are `n`, `{"score": n}` and `{"value": n}`. A `Score` whose `score` is
  null is **missing**, which is not the same as `0.0`; conflating them is how an absent model
  produces a confident decline. `idv_rules._score_num` is the single reader and every score read in
  that module goes through it; `idv_store._score` already did the same.

  **C. `liveness_checks[0].challenge` may be `null`** when the session ran no challenge (a passive
  capture). A workflow pinning `face_liveness_method: ACTIVE_3D` still requires one, so that is a
  `LIVENESS_LOW` — but the guidance step is **`challenge`**, not `selfie`: there is nothing wrong
  with the selfie they took. `reasons` is de-duplicated, once, at the end: two rules reaching the
  same code is not two facts.

  **D. `document_type` and `issuing_country` come OFF THE BARCODE**, so on a session where the
  barcode did not decode they are usually `null` — including on a genuine US driver licence. Any
  rule scoped by them is therefore asking the document to identify itself with the very data source
  that just failed. `barcode_expected_but_absent` now also fires on an unidentified document when
  `engine_detail.barcode_state` shows a **located-but-unreadable** symbol (`BARCODE_UNDECODABLE`,
  or any non-`DECODED` state with `barcode_regions_found > 0`). `NO_BACK_SUPPLIED` and a clean
  "nothing barcode-shaped found" stay excluded — those are what a passport produces, and a passport
  carries no AAMVA PDF417 by design.

  **E. `portrait_image` on the document node is never set by this engine.** The document portrait
  arrives as the callback's **top-level `portrait_crop`** (`{media_id_source, jpeg_b64}`), and the
  finding is stated as `engine_detail.portrait_face_found`. A consumer asking "was there a face on
  the document?" must accept any of: `portrait_image`, top-level `portrait_crop`,
  `engine_detail.portrait_face_found === true`, or a `face_matches[]` entry whose
  `engine_detail.target` is `document_portrait` with a usable score. Keying on `portrait_image`
  alone raised "No face found on the document" plus a below-the-approve-line score cap on **every**
  hw-engine session — including ones whose 1:1 match against that very portrait scored 84.3.

  **F. The engine's `reasons` are its opinion and are not re-recorded over ours.** The engine has
  no `BARCODE_NOT_DETECTED` in its `reasons` vocabulary and reports an unreadable barcode as
  `DOC_QUALITY_LOW`. That is the coarse sentence addendum **B** of 2026-09-08 exists to stop
  saying, and it outranks `BARCODE_NOT_DETECTED` in the guidance order, so re-raising it takes the
  guest back to the front of the card. It is dropped when these rules have already raised
  `BARCODE_NOT_DETECTED` for the same fact, and still recorded when they have not. Same reasoning
  for the age gate: with the barcode unread there is no trustworthy date of birth, and "no readable
  DOB" is `BARCODE_NOT_DETECTED` on `document_back` — already open, with the right sentence — not
  `DOC_QUALITY_LOW`. The session cannot fail open: `CAP_BARCODE_UNREADABLE` (49.0) is below the
  70.0 approve line.

  *Coverage:* `qa/idv_rules_probe.py` 293 → **313** (section `IDV-J*`, built on the real scrubbed
  callback); `qa/idv_api_probe.py` unchanged at **122** — it deduped its own copy of `reasons`,
  which is exactly why the duplicate `LIVENESS_LOW` was invisible to it.

---

## Addendum — 2026-09-09: the challenge outcome, and never being stuck on "checking"

Measured on the first real end-to-end capture this system has been given: the owner's own iPhone,
session 1, engine job `job_fb9ed08726d1485ebce6267eb27ec655`. Passive liveness **98.6**, face match
**78.7**, a **43.9°** head turn held for 29 frames, a blink on cue — and
**`Declined ['CHALLENGE_NONCE_MISMATCH']`**, no guidance, `next_step: none`.

### A. `liveness_checks[].challenge` gains `result`, `result_reason` and `detail`

```jsonc
"challenge": {
  "id": "ch_…",
  "script": [ … as issued, in either vocabulary … ],
  "result": "completed | not_completed | replay_suspected | not_recorded",
  "result_reason": "…" ,        // null when result == "completed"
  "nonce_ok": true,             // DERIVED: exactly `result == "completed"`
  "detail": {
    "prompts": [{ "index", "expected", "raw", "prompt_ms",
                  "window_s": [start, end], "window_is_inferred": true,
                  "frames_analysed_in_window", "observed", "satisfied",
                  "events", "first_t", "in_inferred_window", "reason" }],
    "series": { "yaw":   { "neutral_deg", "min_deg", "max_deg",
                           "max_left_delta_deg", "max_right_delta_deg",
                           "accept_deg", "sustain_frames", "samples", "sign_note" },
                "blink": { "ear_baseline", "ear_threshold", "ear_min",
                           "relative_drop", "min_closed_frames", "events", "samples" } },
    "clip": { "codec", "fps_reported", "fps_measured", "duration_s",
              "frames_decoded", "frames_analysed", "frames_with_face",
              "width", "height", "orientation",
              "rotation_meta_deg", "rotation_auto_applied_by_decoder",
              "rotation_applied_here_deg", "decode_error" },
    "prompt_timing_tolerance_s": 0.75,
    "prompt_min_frames": 12,
    "window_caveat": "…"
  }
}
```

**`nonce_ok` is not removed and its meaning is narrowed, not changed:** it is now computed as
`result == "completed"`. Every existing reader keeps working. New readers should key on `result`,
because a boolean was the defect: it went false for a prompt not performed, prompts performed out of
order, a response outside the nonce validity window, **and a script the engine could not parse** —
and the consumer could only decline all four the same way.

**`replay_suspected` is rationed to hard evidence** and is the only value that may reach a decline:
byte-identical frames spanning the challenge, a response timestamped outside the nonce validity
window, or a clip too short to contain the script it was issued. An implausibly *regular* frame
cadence is explicitly **not** on that list — OpenCV synthesises `t = i/fps` whenever a container
carries no per-frame timestamps, which is most browser WebM, so a `frame_gap_cv` of 0.0000 is
routinely a property of the decoder. It remains a soft `CAPTURE_TIMING_ANOMALY` warning.

**`not_recorded` covers the engine's own inability to score**, including a script whose prompts it
does not recognise. A vocabulary drift between the two services is an engine defect and can never be
evidence about the person holding the phone.

### B. The challenge `script` has two legal vocabularies and both are canonical

`POST /api/idv/capture/{token}/challenge` issues, stores and forwards to the engine:

```json
[{"kind":"turn","dir":"left","ms":1500}, {"kind":"blink"},
 {"kind":"flash","colors":["accent","info","good","warn"],"ms":250}]
```

The **decision** example in §Decision above shows `["turn_left","blink","flash"]`. Both are on the
wire today; the engine now normalises both (`pipeline.liveness.normalise_script`). Until 2026-09-09
it matched only the flat strings, so every prompt from a live capture scored "unsupported challenge
step" and `nonce_ok` went false on clips where nothing was wrong. **Neither suite could see it** —
each side was internally consistent and neither had ever been handed the other's shape.

Two details that are part of the contract, not the implementation:

* a `flash` step's `ms` is **per colour**; the prompt occupies `ms × len(colors)`;
* `turn` `dir: "left"` means the **guest's own left**, which on an unmirrored front-camera frame is
  a positive MediaPipe yaw delta (measured: Pearson +0.992 between yaw and nose-tip offset toward
  image right; `MediaRecorder` records the unmirrored track even behind a CSS-flipped preview).

**Prompt windows are inferred and never gate satisfaction.** Nothing in this contract carries a
client-side "prompt shown at" timestamp, so the engine infers each window from the script's own
durations. The inference is known to be wrong: the owner's script opens with a 1500 ms turn and the
turn does not begin until t=1.5 s, because the capture page runs its own countdown first. The
windows therefore drive **sampling density only** (≥ 12 analysed frames per window) and are reported
for diagnosis. The ±0.75 s tolerance is applied to the **order** check, where it can only help — a
blink performed *during* a turn lands a few hundred ms out of the issued order and is not evidence of
anything. **If a future capture page sends real prompt timestamps, that is the field to add here**,
and windows can then become a check rather than a diagnostic.

### C. Consumer rule: a failed challenge is a retry

`CHALLENGE_NONCE_MISMATCH` may be raised **only** for `result == "replay_suspected"`.
`not_completed` and `not_recorded` are `LIVENESS_LOW` on guidance step **`challenge`**, spending an
attempt exactly as today. With `face_liveness_method: ACTIVE_3D`, a `not_completed` challenge is
still a retake **even when the passive score clears `liveness_min`** — passive liveness alone never
approves. A consumer reading a node with no `result` (an engine older than 2026-09-09) must degrade a
false `nonce_ok` to the **retake**, not the decline: the worst case there is one extra guided try,
which the attempt counter already bounds, and the worst case the other way is a real customer
accused of fraud.

The same guard applies wherever the code appears. In `wmdemo/idv_rules.py` there are **three** paths
to that decline — the liveness node, the engine's top-level `reasons`, and the catch-all sweep over
`REASONS_DECLINE` — and all three now go through `replay_claim_stands()`: when the node contradicts
the summary, the **node wins**, because the node is the evidence.

### D. `GET /engine/v1/jobs/{id}` and `POST /engine/v1/jobs/{id}/redeliver` are a consumer contract

Both routes already existed and both are signed like every other `/engine/v1` route (`X-Signature-V2`
/ `X-Timestamp`). A **`GET` carries an empty body**, which is signed as `HMAC(secret, "<ts>.")` —
the engine's `signing.verify` falls back to verifying the raw bytes when they are not JSON, so this
is the same scheme and not a second one. `wmdemo/idv_webhooks.sign` canonicalises through
`json.loads` and cannot express it; `idv_api._sign_raw` does.

```
GET  /engine/v1/jobs/{job_id}
  -> 200 { "job_id", "state": "queued|running|done|failed",
           "callback_status": "pending|delivered|dead"|null, "callback_attempts", … }
  -> 404 { "error": "no such job" }

POST /engine/v1/jobs/{job_id}/redeliver   { "force": true }
  -> 200 { "job_id", "redelivered": [{ "kind", "rearmed", "was", "attempt",
                                       "delivered", "state", "event_id" }] }
  -> 409 when the job has no stored callback (the pipeline is NEVER re-run to make one)
```

**wm-demo's obligation.** When a session is `In Progress` with an `engine_job_id`, **no row in
`idv_decisions`**, and ≥ 20 s since its `engine.job_queued` event, `idv_api` calls `GET
/engine/v1/jobs/{id}`; unless the job is still `queued`/`running` it calls `redeliver` with
`{"force": true}` and writes an `engine.redeliver_requested` session event. Bounded at **one ask per
30 s** per session on an `idv_kv` due time, fired by whoever gets there first — `idv_store.sweep`
or the guest's own `/status` poll. After **5 minutes** with no verdict the session takes the existing
outage give-up path: `engine.gave_up`, `next_step` `in_store` (online) or `none` (register), status
still `In Progress`, and the same guest-facing sentence. Nothing is declined: nothing judged it.

Three things about that which are contract, not taste:

* **Redeliver, never re-post.** The verdict already exists. Re-posting is the *outage* path and runs
  the pipeline again — minutes of CPU, and it re-fires every external side effect the job has.
* **`force: true`, and `delivered` is nudged too.** This is the shape that stranded the owner: the
  engine's sixth attempt got a `200`, and this server had failed to persist it. A delivery this end
  never wrote is indistinguishable from one that never arrived, and only this side can tell. Safety
  comes from `_engine_callback`'s existing transition guard, which still refuses to overwrite a
  session an analyst has since decided, and from `event_id` dedupe — a redelivery carries a new
  attempt number, so it applies exactly once.
* **"Stuck" is the decision table being empty**, never the status column. `In Progress` is equally
  what a session submitted two seconds ago looks like, and what one looks like while a guest is being
  asked for another photo.

Why it was needed: `job_fb9ed08726d1485ebce6267eb27ec655` finished **correctly** at 05:14:02Z. Its
callback then `500`d five times against wm-demo (`InterfaceError: Error binding parameter 7`), the
engine's ladder backed off to a 54-minute gap, and the guest sat on "checking" from **05:14 to
06:10 — 56 minutes** — with a finished verdict in the engine's `callbacks` table the whole time.
The engine retries the *callback*, wm-demo retries the *job*, and neither is the thing that failed.
Only the side watching the guest wait can close that.

### E. Known gap, stated rather than fixed: `valid_for_s` does not reach the engine

`POST /api/idv/capture/{token}/challenge` returns `valid_for_s: 90` to the browser and does **not**
persist it on the session, so the engine job carries a challenge with no validity window and
`window_ok` comes back `null`. Nonce binding — described in the engine's own liveness module as the
one cryptographically sound component of the challenge — is therefore inert in production unless a
workflow sets `challenge_valid_for_s`, which is where `app.py` reads it from.

It was left inert on purpose. `window_ok` is measured from `issued_at` to the engine's `received_at`,
which defaults to *when the pipeline runs* and so includes queue delay. Persisting the field on its
own would let a busy engine queue produce `replay_suspected` — after this addendum, the one outcome
that still declines — which is precisely the failure this change exists to remove. The fix is both
halves at once: persist `valid_for_s`, **and** measure the window against the clip's upload time
rather than the engine's dequeue time.

### F. The retake counter, and why §C's bound is not free

`_attempts_for(session, "challenge")` is what makes a `not_completed` challenge terminate rather
than loop. It reads `attempts.challenge`, and **that row only advances when a capture answers a
retake** — `_count_attempt` fires while the session is `Awaiting User`/`Resubmitted` and the first
upload of the retake flips it to `In Progress`, so one retake episode counts exactly once.

Until 2026-09-09 the kind→step map carried `challenge_frame` and **not `liveness_video`** — the clip
that *is* the answer to the prompts, and the only media the engine's challenge scoring reads. A
retake that re-recorded the video therefore advanced nothing, `_attempts_for` fell through to
`liveness_attempts`, and the engine reports `attempts: 1` on every job, so that never grows either.
Harmless while a failed challenge was a first-pass decline; an **unbounded** retake — and unlimited
fresh nonces for anyone genuinely replaying — the moment `not_completed` became a retry. Both kinds
map to the `challenge` step now.

Anything implementing this contract needs the same property, stated as a rule rather than a
constant: **whatever media a client sends to answer a prompt must advance that step's counter.**
And the bound is `attempt >= max`, not `attempt > max`: `liveness_attempts_max: 3` buys **two**
retakes and then the in-store path.

*Coverage:* engine `pytest` 257 → **279** passed / 2 skipped (`tests/test_challenge_taxonomy.py`,
plus six tests in `tests/test_liveness_ip.py` rewritten onto the measured yaw sign — they had
asserted the module's convention against itself). `qa/idv_rules_probe.py` 313 → **321**
(`IDV-A10`, `IDV-A10b..A10i`); `qa/idv_api_probe.py` 122 → **135** (`AP-120..AP-132` — the watchdog, and the challenge retake loop driven through the real capture and callback routes; `AP-74` was also corrected, having asserted a third retake that `idv_rules` does not give);
`qa/idv_store_probe.py` **64** and `qa/idv_import_probe.py` **78** untouched and both still green.
