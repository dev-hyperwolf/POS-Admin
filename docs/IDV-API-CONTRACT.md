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
//          MED_REC_JURISDICTION_UNCONFIGURED
// (contracts 0.3.2, appended in this order): BARCODE_NOT_DETECTED DOC_PORTRAIT_NOT_FOUND
//          ENGINE_MEDIA_UNAVAILABLE ENGINE_NO_EVIDENCE MED_REC_DOB_MISMATCH MED_REC_EXPIRED
//          MED_REC_INVALID_LICENSE MED_REC_MISSING MED_REC_NAME_MISMATCH MED_REC_OUT_OF_STATE
//          MED_REC_UNREADABLE MRZ_LOW_CONFIDENCE MRZ_NOT_FOUND OVI_SHIFT_NOT_SEEN SCREEN_REPLAY_SUSPECTED

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

### G. §E closed on wm-demo's side: `valid_for_s` persisted, `answered_at` wired to the media's server upload time — but the engine does not read it yet

**wm-demo (`wmdemo/idv_store.py`, `wmdemo/idv_api.py`), 2026-09-09.** §E above described the gap
and deliberately left it inert. This closes wm-demo's half of it:

* **`POST /api/idv/capture/{token}/challenge`** now persists `valid_for_s` on the session's
  `challenge` alongside `id`/`nonce`/`script`/`issued_at` (module constant
  `idv_api.CHALLENGE_VALID_FOR_S = 90`, used for both the browser response and the persisted value,
  so the two cannot drift). Previously only the browser saw it.
* **`idv_media` gains `uploaded_at`** (guarded `ALTER TABLE`, additive, existing rows read back
  `NULL`): the server clock at the instant `insert_media` writes the row. It is **not** a function
  parameter — nothing can hand it a client-supplied or backdated value, unlike `captured_at`, which
  takes an optional `captured_at=` argument that happens to be unused today but is not guaranteed to
  stay that way.
* **The engine job body's `challenge` block now carries six fields**, not five:
  ```jsonc
  "challenge": {
    "id": "ch_…", "nonce": "…", "script": [ … ],
    "issued_at": "2026-09-09T07:20:27Z",
    "valid_for_s": 90,
    "answered_at": "2026-09-09T07:20:41Z"   // NEW — see below
  }
  ```
  `answered_at` is the `liveness_video` media row's `uploaded_at` for *this job's* media set — the
  server-stamped moment the clip that answers the challenge reached wm-demo, not the moment the
  engine's worker gets around to looking at it. A session with **no** challenge still sends
  `"challenge": null`, exactly as before (`prepare_engine_job` in `wmdemo/idv_api.py`).

**The exact field name the engine reads is `received_at`, not `challenge.answered_at` — read, not
edited, per instruction.** `idv-engine/pipeline/liveness.py:analyze()` takes `received_at` as its
own keyword argument, separate from the `challenge` dict entirely, and falls back to `time.time()`
— wall clock at the moment `analyze()` runs — when it is `None`:

```python
now = received_at if received_at is not None else time.time()
...
elapsed = now - issued.timestamp()
window_ok = bool(0 <= elapsed <= valid_for) if valid_for > 0 else None
```

`idv-engine/app.py:run_pipeline()` calls `live_mod.analyze(frames=frames, challenge=challenge,
method=…, media_ids=…, attempts=…, video_meta=vmeta)` — it **never passes `received_at`**, so
`window_ok` is, today, always measured against whenever the worker happened to dequeue the job. A
repo-wide search of `idv-engine` for `answered_at` returns zero matches; the engine has no code path
that reads it under any name.

**So §E is only half closed.** wm-demo now hands the engine the field the fix needs
(`challenge.answered_at`), and the contract now documents it, but nothing in `idv-engine` consumes
it — `run_pipeline` would need to read `body["challenge"]["answered_at"]` and pass it as
`received_at` to `analyze()` (or `analyze()` would need to prefer `challenge.get("answered_at")`
over its own `received_at` argument when both are present) before `window_ok` actually reflects
upload time instead of dequeue time. Until that engine-side change lands, a busy queue can still
produce a spurious `window_ok: false` exactly as §E described — the wm-demo half removes the
*silent* half of the gap (the field now exists and is correct), not the behavior itself. This is
deliberately **not** made in this pass: the instruction that produced this addendum was explicit
that `idv-engine/pipeline/liveness.py` is read-only here.

*Coverage:* `qa/idv_api_probe.py` 135 → **137** (`AP-133`: `valid_for_s` persisted and all six
challenge fields reach the job body, `answered_at` equal to the `liveness_video` row's
`uploaded_at`; `AP-134`: no challenge still sends `challenge: null`). `qa/idv_store_probe.py`
**64**, untouched and still green — the new `idv_media.uploaded_at` column is additive and no
existing read depends on its absence. Both standalone runs passed on this tree: 137/137, 64/64.
`qa/battery.py`'s `EXPECTED_CHECKS["idv_api_probe"]` raised 135 → 137 and `TOTAL_CHECK_FLOOR` raised
2142 → 2144 to match, each with the justification inline as a comment at the point of change.

---

## Addendum — 2026-09-09: the barcode is the data source, and our own OCR may not decline anyone

**The session that produced this ruling.** Measured on the owner's real iPhone, tonight. The PDF417
on the back decoded with **27 AAMVA fields**. Passive liveness **99.97**. 1:1 face match **80.6**.
As clean a session as this system produces. The front-side OCR read a garbage first name and no
surname at all, and the engine reported that honestly:

```json
"crosschecks": {
  "barcode_vs_ocr": {
    "agree":    ["expiration_date"],
    "disagree": ["last_name", "first_name"],
    "missing":  ["date_of_birth", "date_of_issue", "document_number"],
    "confidence": 40.0
  }
}
```

The rules raised `BARCODE_OCR_MISMATCH`, spent the guest's one retake, and then returned
**`Declined` — "The barcode and the print on this ID do not agree."** To a real, valid guest holding
a current, machine-readable licence. `confidence: 40.0` was in the payload the whole time and no
rule read it.

**Why this was always going to happen.** The old rule was `disagree ∩ {first_name, last_name,
date_of_birth} ≠ ∅`, with no confidence floor. The calibration report (2026-09-08) had **already**
measured open OCR at **~50% exact-field match on ID cards**. A witness that is wrong half the time
was being given an equal vote against a machine-written symbol that agrees with the vendor 97.6% of
the time — and it was the only such vote in this module that could reach a decline. Everywhere else
the rules already refuse to be decided by OCR: the age gate, the expiry check and the medical
name/DOB comparisons all abstain when the barcode did not decode (`OCR_ONLY_EXPLAIN`). The
cross-check was the last place the print could outvote the chip.

### The rule now

`BARCODE_OCR_MISMATCH` fires **only** when **both** hold:

1. `barcode_vs_ocr.confidence >= 85` (`idv_rules.OCR_CROSSCHECK_CONFIDENCE_MIN`, inclusive), and
2. the `disagree` set includes **`date_of_birth`** or **`document_number`**
   (`idv_rules.OCR_IDENTITY_FIELDS`).

That pair is the tamper signal and nothing else is: a confidently-read print naming a *different*
date of birth or licence number than the chip is the shape a doctored card has, and the one shape
our OCR is not plausibly inventing at ≥85 confidence. Both halves are load-bearing — without the
floor a 40%-confidence read declines real people; without the field test a doctored date of birth
walks through. When it fires, the mechanic is **unchanged**: one retake on `document_back`, then
`Declined` with `next_step: "in_store"` (`MAX_BARCODE_MISMATCH_ATTEMPTS = 2`). *This supersedes the
2026-09-08 §B sentence "`BARCODE_OCR_MISMATCH` is unchanged: a cross-check disagreement still gets
one retake and then declines" — the mechanic is unchanged, the trigger is not.*

Everything else the print has to say becomes a `warnings[]` entry with **no status effect, no score
cap, no retake and no reason code**:

| condition | `warnings[].risk` | effect |
|---|---|---|
| `confidence >= 85`, disagrees on `date_of_birth` or `document_number` | *(none — reason `BARCODE_OCR_MISMATCH`)* | one retake, then `Declined` |
| `confidence >= 85`, disagrees only on names / address / `date_of_issue` / `expiration_date` | `OCR_PRINT_DISAGREES` | none — records the fields and the confidence |
| `confidence < 85`, or absent (`null`), or the OCR never produced the fields (`missing`) | `OCR_LOW_CONFIDENCE` | none — records the fields it differed on *and* the ones it never read |
| `disagree` and `missing` both empty (full agreement, or `status: "NO_BARCODE"`) | *(none)* | silent |
| barcode did not decode at all (`barcode_expected_but_absent`) | *(none from the cross-check)* | `BARCODE_NOT_DETECTED` already re-opened `document_back` |

Both new risks are advisory strings in `warnings[]`, the same shape as every other risk
(`{risk, log_type, short_description}`). **No console filter, no `reasons` vocabulary and no §3.4
reason code changes** — a client that does not know these two strings renders them as it renders any
other warning. Age and expiry continue to be decided by the **barcode** and by nothing else.

**A missing `confidence` is treated as low, not high.** `confidence: null` is what the engine sends
when it could not score the comparison; defaulting an absent number to "confident enough" would
restore the original bug for every engine version that omits the field.

**`explain` names the source.** Every session where the print is recorded and not acted on carries
`idv_rules.PRINT_IGNORED_EXPLAIN` — the barcode was the data source and was used, the print is a
photograph read at ~50% field accuracy, and only a ≥85-confidence contradiction on `date_of_birth`
or `document_number` could have changed the outcome. An approval whose audit trail does not name the
deciding source cannot be reviewed later.

**The engine's own opinion no longer re-opens the door.** `_engine_reason_block` re-raises a short
list of engine-proposed `reasons` as findings, and `BARCODE_OCR_MISMATCH` is on it — but the engine
derives that reason from the *same* `barcode_vs_ocr` block and applies **no confidence floor**.
Re-recording it would have restored the false decline in full through a second door. It is now
dropped when these rules' own reading of the block is not a tamper signal, and the disagreement
between the two is written to `explain` rather than being silent. (Same precedent as the 2026-09-08
`DOC_QUALITY_LOW` / `BARCODE_NOT_DETECTED` case immediately above it in that function.)

**Guest-facing copy for `BARCODE_OCR_MISMATCH` changed**, because the old sentence described a
condition this code can no longer be raised for: it said *"The barcode on the back didn't read
cleanly"*, which is `BARCODE_NOT_DETECTED`'s fact, not this one. It now reads *"The details printed
on this card don't match the barcode on the back — lay the card flat on a dark surface, fill the
frame and photograph it again."* Step is still `document_back`.

**Shape note.** The `Decision` example near the top of this file shows `barcode_vs_ocr` with only
`agree` / `disagree` / `missing`. The engine also sends **`confidence`** (float or `null`) and, when
there was no chip to compare against, **`status: "NO_BARCODE"`**. Both are read by the rules as of
this addendum; the example is the older, narrower shape and is superseded here rather than edited in
place, per the append-only convention.

*Coverage:* `qa/idv_rules_probe.py` 321 → **333**, new section **K (IDV-K01..K12)** built on the
owner's exact crosscheck with a full 27-field barcode. `K01` and `K04` are the same session decided
twice — approved when the challenge is `completed`, and still `Awaiting User [LIVENESS_LOW]` on the
`challenge` step when `challenge.result: "not_completed"` — because "not declined" is only half the
claim and a rule that approved both would be a fail-open wearing this ruling as a disguise. `K05`
walks the confident-DOB tamper path retake → `Declined` unchanged, `K06` does the same for
`document_number`, `K07` is the confident name-only warning, `K08` pins the 85 floor from both
sides, `K09` the absent confidence, `K10` the engine's second door, `K11` the no-chip case and `K12`
silence on a clean session. `IDV-A24`/`A25`/`A30` were **edited, not added**: their cross-checks now
carry the confidence the new rule requires. Verified by mutation — restoring the old predicate
(floor 0, names as identity fields) fails 7 of the 12 new checks. `qa/idv_api_probe.py` **137**,
untouched and still green: the API layer renders whatever the rules return and no route reads the
cross-check itself. Both standalone runs passed on this tree: 333/333, 137/137.
`qa/battery.py`'s `EXPECTED_CHECKS["idv_rules_probe"]` raised 321 → 333 and `TOTAL_CHECK_FLOOR`
2144 → 2156, each with the justification inline at the point of change.

---

## Addendum — 2026-09-09: only evidence moves a session, and the challenge script is a setting

Measured on the owner's own phone, session #7 (`vendor_data: "email:owner-iphone-7"`). Four separate
faults, one screen. Everything below is the contract as of this date; the older text it narrows is
superseded here rather than edited in place, per the append-only convention.

### A. The stranding — `In Progress` for ever, with the answer already on the row

The sequence, from the session's own event trail:

| time | what happened |
|---|---|
| 18:32:50 | the engine answers `Awaiting User` — retake the challenge. `guidance` is written to the session. |
| 18:32:51 | a best-effort `challenge_frame` the capture page had already begun uploading lands. |
| 18:32:51 | `_capture_media` lifts the session back to `In Progress`. **No job is running.** |
| thereafter | `/status` answers `In Progress` for ever. After 30 s the page shows *"This is taking longer than usual"* with the retake sentence underneath it, unreachable. |

The frame was one second late and belonged to the attempt that had *just been judged*. It was not an
answer to anything, and it cost a real guest their session.

**Rule 1 — only evidence changes state.** `POST /capture/{token}/media` now splits its `kind`
vocabulary in two:

- **Evidence** — `document_front`, `document_back`, `medical_rec`, `selfie`, `liveness_video`.
  Unchanged behaviour: may lift `Not Started` / `Awaiting User` / `Resubmitted` / `Abandoned` to
  `In Progress`, may spend an attempt on the step it answers, and is what the engine judges.
- **Best-effort** — `challenge_frame`, `selfie_frame`, and any kind added later that is not on the
  evidence list. **Stored, and nothing else.** Never changes `status`, never advances an attempt
  counter, never clears `guidance`. The response still returns `201` with the media row, its
  `challenge_id` and its `client_metrics`; the `status` field in that response is the session's
  status *unchanged*.

The line is *what the guest submitted* versus *what the page volunteered*. The capture page fires
these frames while the camera is open, whether or not the guest did anything.

`liveness_video` stays on the evidence side and this is load-bearing: the clip **is** the answer to
the prompts, and it must still spend the `attempts.challenge` try, or the retake loop that
2026-09-09's challenge-taxonomy addendum introduced never ends. `challenge_frame` has been **removed
from `_STEP_FOR_KIND`** — it no longer maps to a step at all.

**Rule 2 — `/status` never strands.** `GET /capture/{token}/status` now repairs the shape rather than
only the one route that produced it. When **all** of the following hold:

- the session is `In Progress`; and
- the newest `idv_decisions` row for it says `Awaiting User`; and
- no engine job is pending,

…then `/status` answers with **that decision's** status, guidance and `retry` block, and **writes the
status back to the session row**. Repairing the row is not cosmetic: the console session list, the
analyst screen and the sessions export all read `idv_sessions.status`, and an analyst seeing
`In Progress` while the guest is being asked to retake is the same defect wearing a different hat.

**"No job pending" is asked two ways, and both must say no.**

1. `idv_sessions.engine_job_id` still equals the decision's `engine_job_id`. `POST …/submit` writes
   the new job id onto the session **before** it posts, so this is true the instant a resubmit
   begins — *including* the case where the POST then fails and an outage retry owns the session,
   which writes no `engine.job_queued` event at all and which a timestamp scan alone would therefore
   mistake for a strand.
2. No `engine.job_queued` event is newer than the decision's `computed_at`. Timestamps are
   one-second ISO text, so an event inside the decision's own second is ambiguous and is settled by
   the job id: the same id is the job that produced this decision, a different one is a new job.

**Ambiguity resolves towards *not* repairing.** A wrong repair is the worse failure: `Awaiting User`
cannot become `Approved` under `can_transition`, so the genuine verdict would arrive afterwards and
be silently ignored. A session that has already given up (`engine.gave_up`) is left alone — it is
`In Progress` on purpose, its `guidance` was deliberately cleared, and it has a `next_step` the guest
can actually take.

### B. The challenge script is a workflow setting

**New config key: `config.challenge_script`** — a list of step kinds drawn from
`turn_left | turn_right | blink | flash`. **Default `["blink"]`.**

It used to be a three-prompt literal inside the issuing route — turn left, blink, colour flash —
identical for every session and chosen by nobody. Two of its three prompts are ones this estate
cannot act on: `flash` is reported by the engine as *unknown*, never as satisfied or failed (iProov
US 9,075,975, active to 2033), and a turn adds a second way to fail — "turned the other way", which
the engine reports precisely because it happens — to a check whose only job is to show that a live
human is present. A blink does that on its own.

`POST /capture/{token}/challenge` now builds its `script` from the workflow's setting. The wire shape
is unchanged and the response still carries `challenge_id`, `nonce`, `script`, `issued_at`,
`valid_for_s`, all five persisted on the session. The **nonce is untouched** and still minted per
call: the workflow settles *which prompts are asked*, never whether the answer is time-bound to the
ask.

| kind | issued as |
|---|---|
| `blink` | `{"kind": "blink", "ms": 2500}` |
| `turn_left` / `turn_right` | `{"kind": "turn", "dir": "left"\|"right", "ms": 1500}` |
| `flash` | `{"kind": "flash", "colors": ["accent","info","good","warn"], "ms": 250}` (`ms` is **per colour**) |

An unrecognised kind is **dropped**, not issued, and a config that names nothing recognisable falls
back to a single blink rather than an empty script. Empty is the dangerous answer: the engine scores
a script it cannot read as `not_recorded`, which is a **retry**, so one typo in a workflow config
would hand every guest an unlimited supply of fresh nonces.

**Migration.** `idv_store.migrate_challenge_scripts` writes `challenge_script: ["blink"]` onto every
workflow as a **new version row**, exactly as `calibrate_workflow_thresholds` does and for the
identical reason: `idv_sessions` pins `workflow_version`, and the stored script is what an analyst
needs to answer *"what were they actually asked to do"*. Rewriting it in place would answer that
question wrongly for every session already decided. Idempotent **by content** via a
`challenge_script_migrated: "2026-09-09"` stamp at config level — a stamp rather than the key's own
presence, so an operator who deliberately clears the script to `[]` does not have `["blink"]` written
back under them on the next request. Both migrations now run through one entry point,
`idv_store.run_data_migrations`, called from `ensure_schema` and again from `idv_api.handle` after
`seed()` (the seed rows are born unmigrated). **The seeded default workflow is therefore at version 3
on a fresh install**: version 1 as seeded, version 2 calibrated, version 3 with the script.

#### What a blink-only script requires to score `completed` — read out of `idv-engine/pipeline/liveness.py`

Confirmed by reading the module (read-only; the engine was not modified). A single `blink` step is
scored `completed` when **all** of the following hold:

1. **The clip decodes and a face is found.** `landmark_error` is unset and
   `capture_integrity.frames_with_face ≥ 1`; otherwise `not_recorded`.
2. **The prompt is recognised.** `blink` is in `_STEP_ALIASES`, so `scorable` is non-empty. (A script
   of *only* unrecognised prompts is `not_recorded`, never an accusation.)
3. **A blink is detected.** `_blink_events` needs at least `EAR_BASELINE_MIN_FRAMES` (8) analysed
   frames carrying an EAR to establish a baseline — the median of the upper half of the clip's own
   EAR values — and then a run of at least `BLINK_MIN_CLOSED_FRAMES` (2) consecutive analysed frames
   below `EAR_RELATIVE_DROP × baseline` (0.60 × baseline).
4. **The blink lands in the prompt's window.** This is the part that a blink-only script makes
   trivially true, and it is why blink-only is the safest script this engine can be given: with one
   step, `_prompt_windows` returns exactly one window spanning the **whole clip** (a single duration
   is scaled onto the clip's own span, and the last window is clamped to the clip's end), so *every*
   blink in the clip is in-window. A multi-prompt script infers its sub-windows from a schedule no
   client timestamps, which is the inference the owner's 2026-09-09 clip proved wrong.
5. **Order is trivially satisfied.** `order_ok` is a pairwise comparison over the satisfied steps'
   own events; with one step the comparison set is empty and it is always `True`.
6. **Enough frames inside the window.** `_challenge_sample` samples to a frame *rate*
   (`CHALLENGE_TARGET_FPS` 15, cap `CHALLENGE_MAX_FRAMES` 90) and tops each prompt window up to
   `PROMPT_MIN_FRAMES` (12); a clip of `CHALLENGE_MIN_FRAMES` (30) frames or fewer is not thinned at
   all. A blink is 100–400 ms, so the two closed frames need roughly ≥10 fps of analysed frames
   through the closure.
7. **No replay evidence.** `replay_suspected` outranks everything and is the only outcome wm-demo may
   decline on. It fires on ≥5 consecutive byte-identical frames; on ≥50% byte-identical duplicates in
   a clip of ≥8 frames; on a response arriving outside `valid_for_s` (90 s) of `issued_at`; and on
   `clip_span + PROMPT_TIMING_TOLERANCE_S (0.75) < scripted_s`.

On (7)'s last clause: `scripted_s` for the new blink-only script is **2.5 s**, so a clip shorter than
**~1.75 s** is scored `replay_suspected`. **This is not a regression** — the old three-prompt script
summed to exactly the same 2.5 s (1.5 s turn + 0 for a blink that carried no `ms` + 250 ms × 4
colours = 1.0 s for the flash sweep), so the short-clip lower bound is unchanged. It is recorded here
because it is now carried by a *single* prompt: shortening `CHALLENGE_BLINK_MS` moves that bound, and
a capture page that stops the recording early would trip it.

Two things that are **warnings, not failures**: a first response earlier than `RESPONSE_MIN_S` (0.30 s)
raises `CHALLENGE_RESPONSE_IMPLAUSIBLY_FAST`, and later than `RESPONSE_MAX_S` (12.0 s) raises
`CHALLENGE_RESPONSE_SLOW`. `nonce_ok` is a derived field with exactly one meaning: `result ==
"completed"`.

### C. A missing document portrait is not glare

**New reason code: `DOC_PORTRAIT_NOT_FOUND`** — retryable, step `document_front`, guest-facing
sentence:

> We couldn't see the photo on your ID — hold the card flat and fill the frame.

The engine reports the condition three ways at once and none of them is a reason code: a
`PORTRAIT_IMAGE_NOT_DETECTED` warning on the document node, `engine_detail.portrait_face_found:
false`, and — because there was no second face — no 1:1 face match at all. Its `reasons` list still
carries the one word it has, `DOC_QUALITY_LOW`, whose sentence is *"There's glare over the card — tilt
it away from the light"*. That was said to the owner about a front image scoring **96.8**. The card
was not badly lit; the portrait was out of frame. The guest gets three tries, and one of them was
spent on lighting advice for a photograph that was already sharp.

Same precedent as `BARCODE_NOT_DETECTED` (2026-09-08): a coarse vendor code that sends a guest to fix
the wrong thing gets its own code and its own sentence.

**Two call sites, and both matter.**

- `_document_block`: `FACE_MATCH` requested and `_document_portrait_present` is false → raises
  `DOC_PORTRAIT_NOT_FOUND` (was `DOC_QUALITY_LOW`), with `CAP_NO_DOCUMENT_FACE` unchanged.
- `_face_block`: the 1:1 match produced **no comparable score at all**. Which step to re-open now
  depends on *why*. When the card carried a findable portrait, the comparison itself failed and the
  **selfie** is the thing to take again — `FACE_MATCH_LOW`, unchanged. When it did not, the match
  could not have run, and asking for another selfie spends a liveness try on a document problem and
  then asks again, because nothing about the selfie was ever wrong. That case now raises
  `DOC_PORTRAIT_NOT_FOUND`. The cap is applied in both branches: a session that was never matched
  cannot be approved either way.

**The engine's own opinion is suppressed by name.** `_engine_reason_block` re-raises a short list of
engine-proposed reasons as findings, and `DOC_QUALITY_LOW` is on it. It is now dropped when these
rules have already raised `BARCODE_NOT_DETECTED` **or** `DOC_PORTRAIT_NOT_FOUND` for the same fact,
and the `explain` line **names which finding displaced it** rather than describing it — a dropped
reason code that does not say what displaced it is an unexplained absence. Without this half the fix
does nothing observable: `DOC_QUALITY_LOW` outranks `DOC_PORTRAIT_NOT_FOUND` in `_GUIDED` at the
**same step**, so re-raising it hands the single guidance slot straight back to the glare sentence.
Measured with the suppression removed and a decodable barcode: `['DOC_QUALITY_LOW',
'DOC_PORTRAIT_NOT_FOUND']`, glare sentence, every other check still green.

**Ordering inside `_GUIDED`:** `DOC_QUALITY_LOW` stays ahead of `DOC_PORTRAIT_NOT_FOUND`. Both belong
to `document_front`, and the order settles only the case where both genuinely fire — a card that is
washed out *and* has no findable portrait, where the glare is why the portrait was not found and
fixing the lighting fixes both. In every case this reason code was added for, the image is sharp and
`DOC_QUALITY_LOW` is not raised at all.

### Coverage

| suite | before | after | added |
|---|---|---|---|
| `qa/idv_rules_probe.py` | 333 | **338** | `IDV-J13`, `J13b`, `J13c`, `J13d`, `J13e` |
| `qa/idv_api_probe.py` | 137 | **145** | `AP-135` … `AP-142` |
| `qa/idv_store_probe.py` | 64 | **64** | — |
| `qa/idv_import_probe.py` | 78 | **78** | — |

`IDV-J13`..`J13c` run the **real** 2026-09-09 callback fixture with the one thing changed that the
engine actually reported that day — no findable portrait, no face match, `PORTRAIT_IMAGE_NOT_DETECTED`
in the document warnings — and assert the front-of-card retake, the framing sentence verbatim, and
that neither the glare sentence nor `FACE_MATCH_LOW` survives. `J13d` is the boundary in the other
direction: a card that *does* carry a portrait and still produces no comparable score stays
`FACE_MATCH_LOW` on `selfie`. `J13e` is the one to keep hardest — it is the only check that can see
the suppression half, because `J13c`'s fixture also raises `BARCODE_NOT_DETECTED`, which suppresses
the engine's opinion by itself.

`AP-135`/`AP-136` reproduce the stranding through the real routes: a `challenge_frame` uploaded after
an `Awaiting User` verdict leaves status, guidance and every attempt counter untouched, and `/status`
answers the retake sentence rather than *"taking longer than usual"*. `AP-137` is the boundary —
`selfie_frame` inert on the same terms, `liveness_video` still lifting the session and still spending
the challenge try. `AP-138` is the repair and `AP-139` its brake. `AP-140`..`AP-142` cover the
challenge script: issued from the workflow, migrated as a new version row and idempotent by content,
and the builder's drop-unknown / fall-back-to-blink vocabulary.

**Three existing checks were edited, none deleted**, and each is named because an edited expectation
is where a silent loosening hides: `IDV-A32` and `IDV-J11b` now expect `DOC_PORTRAIT_NOT_FOUND` where
they expected `DOC_QUALITY_LOW` (`A32` also gained a `no_reasons` guard it did not have), and `AP-2b`
expects workflow version **3** with three version rows rather than 2 and two.

*Verified by mutation*, per Trap 17 — a safeguard that has never been exercised is a hypothesis. Each
fix was reverted in turn and the suites re-run: forcing `evidence = True` fails `AP-135` and `AP-137`;
removing the `/status` repair fails `AP-138`; dropping the `engine_job_id` guard fails `AP-139`;
restoring the hard-coded three-prompt script fails `AP-140`; unwiring the migration fails `AP-2b`,
`AP-140` and `AP-141`; restoring `DOC_QUALITY_LOW` on the portrait branch fails `IDV-A32`, `IDV-D05`,
`IDV-J11b`, `IDV-J13b`, `IDV-J13c` and `IDV-J13e`; sending the no-score face-match branch back to
`FACE_MATCH_LOW` unconditionally fails `IDV-J13c`; and removing the engine-opinion suppression fails
`IDV-J13c` and `IDV-J13e`. Every mutation was applied singly, against an otherwise clean tree.

Standalone runs on this tree: **338/338**, **145/145**, **64/64**, **78/78**.
`qa/battery.py`'s `EXPECTED_CHECKS` raised for both suites and `TOTAL_CHECK_FLOOR` 2189 → **2202**,
each with the arithmetic and its justification inline at the point of change.

## Addendum — 2026-09-09: a session belongs to somebody, whatever the verdict

Measured on the owner's own phone (read-only copy taken 2026-09-09). Seven sessions, **ten face
templates, zero rows in `idv_people`**, every `face_searches[].matches` empty, "Similar faces"
reading 0 on all seven, and a customer file that could not group his own attempts.

One condition caused all of it. `_link_person` was called only under `if new_status == "Approved"`,
and none of his seven sessions passed. With no person row:

* every template enrolled with `person_id NULL`, so a 1:N match had nothing to resolve to;
* `idv_rules._duplicate_block` skips any match carrying no `person_id`, so `DUPLICATE_PERSON` was
  unreachable **by construction**;
* the customer file had nothing to group six attempts under.

The whole 1:N feature answered *"no hit"* in exactly the shape of a working one, which is why a
green probe suite never saw it. Everything below supersedes the older text rather than editing it.

### A. A person is resolved on EVERY engine decision

`POST /api/idv/webhooks/engine` resolves an identity **before the rules run**, on every applied
callback — Declined, Awaiting User and Abandoned included. The resolution order, strongest key
first (`idv_store.resolve_person_for_session`):

| # | key | rule |
|---|---|---|
| a | `document_number_hash` | the PDF417 barcode's issuer + number (`verify.doc_hash`). The same card scanned tomorrow hashes the same and nobody can mistype it. Looked up on `idv_documents` first, then on `idv_decisions` joined through the session. |
| b | `vendor_data` | the site told us who it thinks this is. |
| c | face 1:N | any `face_searches[].matches` entry at or above the workflow's `face_search_min` whose template belongs to a person. Highest similarity first; the template's own `person_id`, else its **session's** person. |
| d | `identity_match` | surname + DOB from the barcode, through `wmdemo/identity_match.py` — its tiers 2 (`name_dob_fp`) and 3 (exact DOB + exact surname + fuzzy given name), with its document veto and its ambiguity refusal. Reused, not restated. |
| — | else | **create** a person, `status='unverified'`, `vendor_data` from the session (**may be null**), names and DOB from the barcode when it decoded. |

The session, **its face templates and its documents** are all pointed at the resolved person in one
step (`link_session_person`); templates and documents are claimed only where they are unowned, since
re-pointing a row that already has a person is a merge and merges are an analyst's decision.
`sessions_count` then counts **every** session of that person, whatever its status.

Ordering is load-bearing: resolution runs **before** `idv_rules.evaluate`, because the duplicate
block skips a match whose `person_id` equals the session's own. Resolved afterwards, a returning
guest's second attempt would flag *himself* as a possible duplicate.

Resolution runs in **its own transaction**, before the transition guard. A person is a fact about a
guest, not part of a verdict, and must not be rolled back by a late callback whose status change is
refused. A **replayed** callback (duplicate `event_id`) still writes nothing at all: the replay check
runs first.

### B. Two documents are never merged automatically

Rules (c) and (d) both **refuse to cross a licence number**. If a candidate person's documents are
known and this session's `document_number_hash` is not among them, the candidate is **dropped** and a
warning is written to the decision:

```json
{"risk": "POSSIBLE_DUPLICATED_USER", "log_type": "warning",
 "short_description": "A face on this session matched person p_… at 96.8, but that person's
                       document is a different licence number. …"}
```

The session gets its **own** person, and the flagged person's `GET /api/idv/people/{id}` carries a
`duplicates[]` row naming the other, with the `merge_url` on it. Support merges deliberately; the
system never does. An automatic merge fuses two verification histories permanently and leaves nothing
behind saying it happened.

`identity_match` gives (d) the same rule for free (`doc_conflict`), plus one more: when a surname and
DOB are carried by **two or more** people the verdict is `ambiguous`, no match is taken, a new person
is created and the same warning is written.

### C. `status` on `idv_people`

`unverified | active | blocked | deleted` — a closed set, validated in `idv_store.update_person` and
`upsert_person`, and a 400 on both `GET /api/idv/people?status=…` and `PATCH /api/idv/people/{id}`.

* `unverified` — created by resolution; a person we have only ever seen fail, abandon, or still be in
  progress.
* `active` — set by `confirm_person_verified` the first time a session of theirs is Approved, which
  also sets `last_verified_at` and `kyc_expires_at`.
* `blocked` / `deleted` — **never overwritten by an approval.** An analyst blocked them on purpose;
  the KYC clock still starts so the console can see the verification happened, and the status stays.

### D. Face searches resolve to a session when they cannot resolve to a person

`_resolve_face_searches` mutates each match in place, before the rules, the stored decision, the
stored event payload and the outbound webhook all read the same object. A match whose template has
**no** person now resolves to its session rather than to nothing:

```json
{"match_type": "session", "person_id": null,
 "session_id": "…", "session_number": 4,
 "media_id": "m_…", "media_url": "/api/idv/media/m_…", "similarity": 84.4}
```

`GET /api/idv/internal/templates` already returns such templates with `person_id: null` and their
`session_id`, and that is now contractual: dropping them would make the searched population *"people
we already approved"* — the wrong half, since the guests worth recognising are the ones who keep
failing.

### E. `similar_faces` on `GET /api/idv/sessions/{id}`

Each row gains `session_number` and a `label`:

| label | when |
|---|---|
| the list's name | the match is a face-list entry (`match_type: "list_entry"`) |
| `earlier attempt` | the match belongs to **this session's own person**, or to no person at all |
| the person's name | the match belongs to a **different** person — the real duplicate finding |

**The session's own templates are excluded.** A resubmission matches the selfie it uploaded four
minutes ago at ~99 and that is the same photograph, not a finding; it would head the list on every
retry. It is still resolved and still stored on the decision — the record of what the engine found is
not edited — and it is filtered at the panel.

`GET /api/idv/people/{id}` likewise: `sessions[]` is every attempt of that person, `duplicates[]` is
only ever **other** people whose face matched one of them.

### F. The backfill

`idv_store.relink_people(conn, session_id=None) -> counts` applies §A to sessions that already exist,
oldest first so the first session to present a licence mints the person and every later one finds it.
A session with **no engine decision** is `skipped_no_decision`, never linked: rule (a)–(d) resolve on
a decision, and a `Not Started` session has no document, no face and no name, so a person minted for
it would be a guest who has never presented anything. Running it twice creates nobody.

Returns `{sessions, skipped_no_decision, already_linked, linked, people_created, templates_linked,
documents_linked, warnings, by_rule}`.

## Addendum — 2026-09-09 (r2): the numbers decide, and a warning is not a verdict

**The session that produced this ruling.** The owner's own phone, session **#9**
(`vendor_data: "email:owner-iphone-9"`, session `9f26cc0a…`, workflow `cf8229dd…` v3). Three
evaluations, three engine callback jobs — `job_762bd4fe…`, `job_0eaae810…`, `job_3622f1ae…`. Every
one of them carried:

| measurement | value | threshold |
|---|---|---|
| `front_image_quality_score` | **86.5** | `doc_quality_min` 60 |
| `back_image_quality_score` | **96.2** | `doc_quality_min` 60 |
| barcode | **`DECODED`**, 27 AAMVA elements, 0 anomalies | — |
| `portrait_face_found` | **true** (0.904) | — |
| passive liveness | **99.96 / 100.0 / 99.89**, challenge `completed` | `liveness_min` 70 |
| 1:1 face match | **75.75 / 71.21 / 71.73** | `face_match_min` 60 |

And the outcomes were **`Awaiting User [DOC_QUALITY_LOW]`**, **`Awaiting User [DOC_QUALITY_LOW]`**,
**`Declined`** — *"There's glare over the card — tilt it away from the light and take the photo
again"*, said three times to a guest whose card had already been read completely, and then refused.

**Which door it came from, because it was not the obvious one.** `_document_block`'s quality rule
never fired: it compares the weaker side against `doc_quality_min` and 86.5 clears 60. The finding
came out of **`_engine_reason_block`**, which re-raised the engine's `reasons[0]` as a guided
finding — and the engine derives `DOC_QUALITY_LOW` from **its own `warnings[]`**. This session
carried two:

```json
"warnings": [
  {"risk": "IMAGE_TOO_BRIGHT",   "additional_data": {"glare_fraction": 0.0724, "threshold": 0.035}},
  {"risk": "DATA_INCONSISTENT",  "additional_data": {"confidence": 90.0,
                                  "fields": {"first_name": {"barcode": "JACOB", "ocr": "NJACOB…"}}}}
]
```

Neither is a reason to re-shoot anything. Glare over 7.2% of the card is a fact about the photograph
that the quality score has **already priced in** — that is what the score is — and a printed first
name our OCR mangled is the failure mode the 2026-09-09 barcode ruling exists to ignore.
`BARCODE_OCR_MISMATCH` was correctly dropped on this session by that ruling; `DOC_QUALITY_LOW` came
in through the door next to it, and it took the guidance slot because it outranks everything else in
`_GUIDED`.

### The rule now

**The numeric per-side quality scores against `doc_quality_min` are the ONLY thing that can raise
`DOC_QUALITY_LOW` off a finished document.** Two consequences, both enforced in `idv_rules`:

1. **Engine warnings are `warnings[]` and nothing else.** `IMAGE_TOO_BRIGHT`, `IMAGE_TOO_DARK`,
   `IMAGE_TOO_BLURRY`, `DATA_INCONSISTENT`, and `SCREEN_CAPTURE_DETECTED` reported *as suspected*,
   are passed through to the decision for the console — **no reason code, no guided retake, no
   decline, no score cap** — whenever the score clears the bar. The ruling moves them out of the
   outcome, not out of the record: they are the only evidence that the photograph had glare on it,
   and silencing them would be a different bug.
2. **The engine's own `DOC_QUALITY_LOW` is dropped when our numeric read passes**, with the drop
   written into `explain` naming the reason code, the measurement and the floor. This is the same
   pattern the OCR-mismatch suppression already used one reason code along.

**Generalised, on purpose.** The fix is not "stop believing `DOC_QUALITY_LOW`". Every reason the
engine can propose is now classified, and `idv_rules.NUMERIC_REASONS` is the set we hold the same
measurement for:

| class | reasons | what happens to the engine's proposal |
|---|---|---|
| **numeric** | `DOC_QUALITY_LOW`, `LIVENESS_LOW`, `FACE_MATCH_LOW`, `BARCODE_OCR_MISMATCH` | re-derived by `idv_rules.own_numeric_read(reason, engine, cfg, features)`. Our read **passes** → dropped with an `explain` line. Our read **fails** → the owning block has already raised the finding, carrying *our* figures. |
| **trusted** | `INJECTION_DETECTED`, `OVI_SHIFT_NOT_SEEN`, `CHALLENGE_NONCE_MISMATCH`, `LIVENESS_ATTEMPTS_EXHAUSTED_HARD`, the blocklist and `MED_REC_*` verdicts, `DOC_EXPIRED`, `UNDER_AGE`, … | taken at its word. We hold no local signal — the pixels, the counters and the list state are the engine's or an imported decision's. Refusing a signal you cannot check is not scepticism, it is fail-open. |
| **inert** | `OUT_OF_STATE`, `IP_VPN`, `IP_HOSTING`, `BARCODE_NOT_DETECTED`, `DOC_PORTRAIT_NOT_FOUND`, `MED_REC_MISSING`, `MED_REC_UNREADABLE` | workflow policy answers it, or these rules raise it themselves off the evidence and never accept it second-hand. |

**"No number" is not "a passing number."** `own_numeric_read` returns `absent` when the feature was
not requested, the node never finished, or the score is null — and an `absent` read leaves the
engine's reason **standing**. An imported Didit decision carries verdicts and no measurements, and
treating a missing score as a clearing one would approve every one of them.

**What did not change.** The cross-check still bites: a print read at ≥85 confidence contradicting
the barcode on `date_of_birth` or `document_number` is still `BARCODE_OCR_MISMATCH`, one retake on
`document_back`, then `Declined`. The rule is *"the numbers decide"*, not *"the engine's opinion
loses"*.

### Where it is held

`qa/idv_rules_probe.py` **section L**, 59 checks (suite 338 → **397**). The fixture is the real
`job_762bd4fe…` callback body with the identity scrubbed everywhere it appears —
`warnings[].additional_data.fields`, `engine_detail.ocr_fields` and `engine_detail.crosscheck.fields`
included — and every score, warning and `status: null` as the engine sent them:
`qa/fixtures/idv/engine-callback-real-session9-2026-09-09.json`.

- **L01–L03** — session #9 approves, both warnings still on the decision, the drop auditable.
- **L04** — *which door*: `own_numeric_read` reads the document as a pass, and the identical body
  with `reasons` emptied always approved. A fix aimed at `_document_block` would have changed nothing.
- **L05** — the same session on attempts 1, 2 and 3, because the real refusal happened on the third.
- **L06/L07** — all four numeric reasons, both directions, plus `absent` → still standing.
- **L07b** — a score on a node the engine abandoned, or on a document this workflow never asked
  for, is `absent` too: the gate is on the *read*, not on the presence of a number.
- **L08** — the partition is **total**: asserted as set equality against `REASONS`, so a new reason
  code cannot arrive unclassified, then each one walked on a clean baseline.
- **L09** — each of the five warnings above, attached alone to a passing document: kept, decides
  nothing.
- **L10** — the tamper signal still fires.

`qa/idv_api_probe.py` is unchanged at **155/155**: no route was touched — the API layer renders
whatever the rules return.

---

## Addendum — 2026-09-09 (r3): names rejoin the tamper set, and a garble is not a name

**Amends the 2026-09-09 barcode addendum above. That ruling is otherwise unchanged.**

### The hole the first ruling left

The barcode ruling removed `first_name` and `last_name` from the tamper set **entirely** — the
`disagree` set had to contain `date_of_birth` or `document_number` before anything could happen. That
stopped the false decline it was written for, and it opened the attack the cross-check exists for.

The cheapest forgery of a US licence is a **reprinted front over a genuine back**: the attacker's
photo and the attacker's name printed on the front, the victim's untouched PDF417 on the back. Walk
that session through the rules as they stood:

| check | reads | verdict |
|---|---|---|
| age gate | barcode `DBB` | **passes** — it is the victim's real date of birth |
| expiry | barcode `DBA` | **passes** |
| `document_number` cross-check | barcode vs print | **agrees** — the attacker never touched it |
| `date_of_birth` cross-check | barcode vs print | **agrees** — same |
| 1:1 face match | selfie vs **front** portrait | **passes** — the front portrait *is* the attacker |
| name cross-check | barcode vs print | **disagrees — and drew a warning** |

The printed name was the only signal in the entire payload, and it had been demoted to
`OCR_PRINT_DISAGREES`. `Approved`.

### The rule now

`BARCODE_OCR_MISMATCH` fires when `barcode_vs_ocr.confidence >= 85`
(`idv_rules.OCR_CROSSCHECK_CONFIDENCE_MIN`, inclusive — **unchanged, and still evaluated first**)
**and** either:

1. the `disagree` set includes **`date_of_birth`** or **`document_number`**
   (`idv_rules.OCR_IDENTITY_FIELDS`) — **unchanged**; or
2. a name in `disagree` (`idv_rules.OCR_NAME_FIELDS` = `first_name`, `last_name`) is a
   **different name**, not a bad read of the same one. Either name alone is enough; both is the
   strongest form.

A name disagreement is a **different name** only when *all* of these hold
(`idv_rules.name_disagreement_is_tamper`):

| test | fails ⇒ warning | why |
|---|---|---|
| both strings legible | a printed name we never read | absence is not contradiction |
| **no shared token** | `LOPEZ GARCIA` vs `GARCIA-LOPEZ`, `JONES` vs `SMITH JONES` | compound, hyphenated and reordered surnames are the largest single source of name disagreement on real cards, and every one of them shares a word with the truth |
| **neither contains the other** | `NMARISOLODETTE` vs `MARISOL` | the longer is the shorter plus noise: a run-together or truncated read |
| **normalised edit distance ≥ 0.50** (`OCR_NAME_TAMPER_DISTANCE_MIN`) | `HOLLINGSWORTB` vs `HOLLINGSWORTH` (0.08) | half the characters of the longer name have to be wrong; a different surname measures 0.7–1.0 |
| **≥ 3 absolute character edits** (`OCR_NAME_TAMPER_EDITS_MIN`) | `NA` vs `NG`, `LU` vs `LI`, `YO` vs `VO` — one substitution each | a normalised threshold alone fails at the short end: one wrong letter on a **two-letter surname** is normalised distance **exactly 0.50** and shares no token, so the other tests both call `NG`→`NA` a forgery |

`OCR_NAME_TAMPER_EDITS_MIN` was **found by writing the probe, not before it** — every fixture in the
section was a long anglophone surname, which is exactly how a threshold that fails at the short end
stays invisible. The honest consequence, stated rather than hidden: **a surname of one or two letters
can never trip the name test on its own**, and a three-letter one needs every character to differ
(`LEE` vs `WON` still tampers). That is a deliberate fail-*open* on the narrowest slice of the name
test, taken because the alternative fails *closed* on real guests — NG, LI and VO are among the most
common surnames in California. The rest of the tamper set is untouched underneath it: `date_of_birth`,
`document_number` and the *other* name still apply to exactly those sessions.

Anything that fails any test stays `OCR_PRINT_DISAGREES` (or `OCR_LOW_CONFIDENCE` below the floor):
recorded, no reason code, no cap, no retake. A name tamper walks the same **one retake on
`document_back`, then `Declined` with `next_step: "in_store"`** path as the other two fields.

`OCR_NAME_TAMPER_DISTANCE_MIN` (0.50) is deliberately **2.5× looser** than
`MED_REC_NAME_MAX_DISTANCE` (0.20). They answer opposite questions: the medical one asks whether a
receptionist's letterhead *matches* the card and errs toward calling a typo a mismatch; this one asks
whether a photograph of print *proves a forgery* and must err the other way.

### The containment guard is not decoration — it is session #9

`MARISOL` (barcode) vs `NMARISOLODETTE` (print) is normalised edit distance **exactly 0.50** — at the
floor, inclusive — and the two share **no token**. Both of the other tests call a real guest a forger
at confidence 90.0. That is the owner's phone session #9 (`IDV-L01`), whose front-side OCR ran the
`FN` label letter, the first name and the middle name together into one string. Without the
containment guard this amendment declines that session and turns section L red.

### What this still does not catch — stated, not discovered later

Every guard is a deliberate fail-*open*, and each one has a forgery it lets through as a warning.
Measured against `idv_rules.name_disagreement_is_tamper`:

| pair (barcode → print) | verdict | the guard that let it through |
|---|---|---|
| `SMITH` → `SMITHSON`, `MARTINEZ` → `MARTIN`, `BROWN` → `BROWNE` | warning | containment |
| `ALVAREZ-DIAZ` → `DIAZ-ORTEGA` | warning | shared token (`DIAZ`) |
| `JOHNSON` → `JOHNSTON` | warning | distance 0.12 |
| `NG` → `NA` (and any 1–2 letter surname) | warning | the 3-edit floor |

This is the accepted cost, and it is **not a regression**: before this amendment *every* name
disagreement was a warning, so the rule strictly narrows the hole rather than trading one for
another. The attacker in each row still has to carry the victim's `date_of_birth` **and**
`document_number` on the print, and the *other* name is tested independently. The alternative —
tightening any of these — declines real guests, which is the outcome this module exists to avoid, and
`MARISOL` → `NMARISOLODETTE` (a real session) is the proof that the containment guard in particular
cannot be traded away.

### Where the two strings come from

`crosschecks.barcode_vs_ocr` carries field **names** and no values, so this test reads the per-field
map the engine puts on the document node:

```json
"engine_detail": { "crosscheck": { "fields": {
  "first_name": { "barcode": "MARISOL", "ocr": "NMARISOLODETTE",
                  "distance": 0.5, "result": "disagree", "rule": "name:first" }
}}}
```

Ladder, in order (`idv_rules.printed_vs_barcode_name`): the engine-level
`crosschecks.barcode_vs_ocr.fields` if a future version ever publishes values there → the document
node's `engine_detail.crosscheck.fields` → `engine_detail.ocr_fields` (`first_name`,
`family_name`/`last_name`) against the AAMVA elements `DAC` / `DCS`.

**The document node's own top-level `first_name` / `last_name` are NOT a source at any rung, and
consumers must not use them for this either.** They are the *merged* values and their provenance
flips by engine version — session #9 carries the **barcode** value there, the owner's earlier session
carries the **OCR** value. A rule reading them would compare the barcode against itself on one engine
and decline real guests on the next.

When no rung yields a pair, the printed name is **unknown**, and an unknown value is never a
different name: warning, never tamper. This is why `IDV-K07` (a confident name-only disagreement on a
fixture with no per-field map) is still green and still asserts a warning.

### Where it is held

`qa/idv_rules_probe.py` **section K, checks K13–K24** — 12 checks, suite **397 → 409**. No existing
check was edited or deleted; K01–K12 all still assert exactly what they asserted.

- **K13/K14** — the half that must not move. The owner's original session still approves under the
  rule that put names *back*; and a print naming a flagrantly different person at confidence **40**
  is **still only a warning**, because the confidence floor is evaluated *before* the name test.
  K13 alone would pass even with that ordering reversed.
- **K15** — the attack: `OKONKWO` vs `HOLLINGSWORTH` at 90 → retake, then `Declined`, `in_store`.
- **K16/K17** — the two ways to be a bad read: the one-letter typo (the distance test) and the
  reordered compound surname, which measures **0.91** and would decline on distance alone — only the
  shared-token test saves that guest.
- **K18/K19** — both names different at exactly the floor (inclusive on the name path too), and a
  different **first** name alone: a surname-only rule passes a front reprinted for another member of
  the same household.
- **K20** — the containment guard, on the real session #9 fixture.
- **K24** — the short-name trap: `NA` for `NG` is a warning (distance exactly 0.50, no shared token —
  both other tests call it a forgery), while `WON` for `LEE` still tampers, so the absolute floor is a
  minimum and not a length exemption.
- **K21** — the value ladder, three legs: neither string legible → warning; print absent, barcode
  legible → warning; `ocr_fields` + `DCS` with no map → still tampers.
- **K22/K23** — the ruling is auditable (the warning spells out *why* a name disagreement was not
  tamper), the engine's own unfiltered `BARCODE_OCR_MISMATCH` still loses to our read in **both**
  directions, and a confident `date_of_birth` disagreement beside a garbled surname still tampers on
  the **DOB alone**, with the garbled name kept out of the guest's reason string.

`qa/idv_api_probe.py` is unchanged at **168/168** — no route was touched; the API layer renders
whatever the rules return, and no route reads the cross-check itself.

---

## Addendum — 2026-09-09 (r4): the console PIN

**Adds a gate. Changes no existing route's shape, status or body.** Everything above this line is
still true of an ungated deployment, and an ungated deployment is what local dev and the QA battery
run — the gate is off unless `IDV_CONSOLE_PIN` is set.

### What was wrong

`X-HW-Actor` is a header the caller writes for itself. It is honest **attribution** — the audit trail
needs it, and every row is stamped with it — and it is not authentication of any kind. So the role
ladder (`viewer|analyst|admin`) documented above was a lock whose key was printed on the door: on a
public URL, `curl -H 'X-HW-Actor: manisha-saini' …/api/idv/people` returned names, dates of birth,
document numbers and the audit trail itself.

### The gate

One shared secret, `IDV_CONSOLE_PIN` (env, **≥ 6 characters**), exchanged once per device for a
12-hour token.

| `IDV_CONSOLE_PIN` | `WM_DEMO_PUBLIC` | behaviour |
|---|---|---|
| set (≥ 6 chars) | either | **on** — gated routes need `X-HW-Console-Token` |
| unset / too short | public | **misconfigured** — every gated route is `503 {"error": "Console PIN is not configured on this server."}` |
| unset / too short | not public | **off** — exactly as documented above this addendum |

A too-short value is treated as unset on purpose: `1234` typed into a dashboard is not a gate, and
accepting it would produce a console that *looks* gated.

### Routes

**`POST /api/idv/auth/pin`** — body `{"pin": "…"}`.

- `201 {"token": "hwc.<issued_at>.<64 hex>", "expires_at": "<ISO-8601>"}` on a match. The token is
  `hwc.<unix issued_at>.<hex HMAC-SHA256(key, issued_at)>`, where the key is
  `SHA-256("hw-console-token-v1|" + IDV_CONSOLE_PIN)` — **derived, not the PIN itself**, so one
  captured token does not hand an attacker key material a six-digit PIN would otherwise be.
  Valid 12 hours; a token dated in the future (more than 60 s of clock slack) is refused as hard as
  an expired one, or `hwc.9999999999.<sig>` would be a token that never expires.
- `403 {"error": "That PIN is not right."}` on a mismatch, and on a missing `pin` key — the refusal
  must not tell a guesser whether it got the shape right.
- `429` after **5 attempts per minute per client IP**, counted in `idv_kv` (one row per IP, rewritten
  when the window rolls). Every attempt counts, the correct one included. The IP is
  `X-Forwarded-For`'s first hop, falling back to the socket peer — spoofable, and accepted as such:
  it is a rate-limit bucket, not an authorisation, and the alternative (one global bucket behind
  Render's proxy) turns one scanner into an outage for the counter.
- `503` when the gate is not `on`.
- **Every attempt writes an audit row** — `console.pin.ok` / `console.pin.failed` /
  `console.pin.rate_limited`, with the status, the IP and the attempt's position in the window.
  **The PIN is in none of them: not the value, not a prefix, not a length.**

**`GET /api/idv/auth/status`** → `200 {"gated": bool, "ok": bool, "idv_version": n}`. `gated` is
whether a gate exists at all; `ok` is whether *this* caller is through it. This is the **one** route
that still answers `200` in the misconfigured state — without it the console would render "backend
not connected" and send the operator hunting a dead server instead of a missing variable.

### What the gate covers, and what it must not

When the gate is on, **every `/api/idv/*` route requires `X-HW-Console-Token`**, and the token check
runs **before** the actor/role check — so an unauthenticated caller is told `PIN required.` and never
learns which roles exist or which actor ids resolve. Missing, expired, forged or PIN-changed:
`401 {"error": "PIN required."}`.

**401 here, not 403, and that is deliberate.** `/v3` and `/v2` answer 403 for every auth failure
because the Didit contract says so, and that is unchanged. This is the **console**, which no
Didit client speaks to, and 401 is the status whose meaning is "authenticate and retry" — which is
exactly the instruction the client acts on.

Exempt, and each for its own reason:

| exempt | why |
|---|---|
| `POST /api/idv/auth/pin`, `GET /api/idv/auth/status` | how a device gets a token in the first place |
| `GET /api/idv/version`, `GET /api/idv/engine/health` | the console header polls both before it knows who is looking, and neither says anything about a person |
| `/api/idv/capture/*` | the guest's phone. It carries a per-session bearer token and its TTL; a customer has no PIN and must never be asked for one |
| `POST /api/idv/webhooks/engine` | an HMAC only the engine can produce — and the only thing that can approve a session |
| `GET /api/idv/media/{id}?token=…` | the **engine's** fetch of the front, the back, the selfie and granted face-list images. The console branch of the same route (no `?token=`) **is** gated |
| `GET /api/idv/internal/templates?token=…` | the engine's 1:N candidate set, already gated on the job's media token |

There is **no `?ctoken=` query form** of the console token. Every media fetch in `idv/idv-client.jsx`
already goes through `fetch()` with headers, so a query-string copy would be a second way in, printed
into `Referer` and every access log, bought for nothing.

**Revocation is the PIN.** The signing key is derived from it, so changing `IDV_CONSOLE_PIN` kills
every outstanding token at once. There is no per-token revocation list and no per-person credential:
everybody on the counter shares the PIN, and `X-HW-Actor` remains the only thing that says *who*
acted. That is the whole promise, written down so nobody reads more into it later.

### One constraint this pass did not remove

On a public deployment `POST /api/idv/auth/pin` **also sits behind the existing write-token gate** in
`wmdemo/server.py` (`x-hw-write-token`, `WM_DEMO_WRITE_TOKEN`), because that gate covers every POST
under `/api/idv/*` that is not self-authenticating, and `server.py` was out of scope here. So a
device that has never been opened from an `?hwtoken=…` link is refused *before* the PIN is compared,
with the write gate's own `403 read-only: …` body. `HWIdv.auth.enter()` relays that case as
`gated: true` and `PinGate` prints a sentence about the owner's link rather than "That PIN is not
right." **If the two gates are ever meant to be independent, exempting `/api/idv/auth/` in
`server.py`'s two public-write blocks is the one-line change** — deliberately not made here.

### The client

- `HWIdv` keeps the token in `localStorage['hw-console-token']` and sends `X-HW-Console-Token` on
  **every** request, including the exempt ones (a per-route allow-list in the client would be a
  second copy of the table above, in a different file, and its drift shows up as a screen that 401s
  for a reason nobody can find).
- Every result from `get`/`post`/`patch`/`put`/`del`/`usePoll` carries **`needsPin`**, derived from
  `code === 401` and never from the error text. `503` is deliberately **not** `needsPin`: a server
  with no PIN configured cannot be fixed by typing one.
- Any 401, from any verb, drops the stored token and notifies subscribers, so a token that expires
  mid-shift raises the PIN card rather than an error panel on a screen that will never load again.
- `HWIdv.auth` = `{ status, enter, clear, subscribe, token, onUnauthorized }`. `status()` never
  rejects and answers `{gated, ok, unknown}` — **`unknown` is not `gated`**: when the backend cannot
  be reached the question has no answer, and showing the PIN card then would ask an operator to fix
  connectivity by typing a PIN. Unknown renders the app.
- `IdvShared.PinGate` replaces the **routed frame** (rail, top bar and EngineBadge stay), built from
  atoms, numeric and masked, no hex and no token on screen.
- **`Hyperwolf POS.html` shares the same origin and the same key.** The check-in seam
  (`pos/checkin-verify-seam.jsx`) uses two console routes — `GET /api/idv/workflows` and
  `POST /api/idv/sessions` — so it is gated too; it does **not** ask for the PIN itself (a second
  place the secret is typed, on the one screen this module may not complicate) and instead shows one
  `ErrorState`: *"Enter the Verify PIN in the Verify app once on this device."* A verification
  already under way is unaffected — the capture routes are exempt.

### Where it is held

`qa/idv_api_probe.py` **AP-150…AP-162** — 13 checks, suite **155 → 168**, `TOTAL_CHECK_FLOOR`
**2301 → 2314**. No existing check was edited or deleted. Six hold the gate (401 with no token, 403
on a wrong PIN, 429 after five a minute per IP, the token's shape and its 12 hours,
expired/forged/future-dated, and the PIN change that revokes). Two hold the misconfiguration. **Five
hold what must stay open through it** — the guest's capture routes, the engine's signed callback, the
engine's job-scoped media and template fetches, and the gate-off state the other 155 run under. A
gate that also stopped those would leave every console check green while no verification in the
estate could finish.

---

## Addendum — 2026-09-09 (r5): the version a session was judged by, and five other things that only looked implemented

**Adds two session columns, one field on `GET /sessions/{id}`, one field on the engine job body, one
role gate, one refusal and one fallback. Changes no route's path or method.** Every item below is a
feature that already had a column, a field or a comment saying it worked; none of them did.

### 1. A session is judged by the workflow version it was created on

`idv_sessions.workflow_version` has been written on every session since the table shipped, and
`update_workflow` has written an `idv_workflow_versions` row on every PATCH. **Nothing read either.**
Every decision path — `prepare_engine_job`, the callback's `rules.evaluate`, the capture page's step
list, `/status` — loaded the **current** workflow row.

So an operator who raised `face_match_min` at 14:00 re-judged every session still in flight from
13:00, including the guest mid-retake who would then be told to redo a step they had already passed.
`idv_store.calibrate_workflow_thresholds`' own docstring promises that a session judged under 75
keeps reading 75; that promise was inert.

**`idv_store.workflow_at_version(conn, workflow_id, version)`** returns the `get_workflow` shape with
`version`, `features`, `unsupported_features` and `config` read out of `idv_workflow_versions`.
`idv_api.session_workflow(conn, s)` is the one call every site now makes.

| resolution | answer |
|---|---|
| the version row exists | that version's features and config |
| the version row is absent (a Didit-imported workflow predates them; a hand-edited `workflow_version`) | **the current row** — refusing would make a verifiable session undecidable, and this is what happened before the function existed |
| `version` is `None` or unparseable | the current row |
| the **workflow** is gone | `None` — the callback still answers `409` |

`name`, `kind` and `status` stay the current row's: `idv_workflow_versions` carries no name column and
a rename is not a rule change. A version that genuinely recorded `features: []` keeps its empty list
(`loads(text, default)`, never `loads(text) or default` — `[]` is falsy).

**A known limit, stated rather than hidden.** `idv_import_didit.py:1311` writes **Didit's**
`workflow_version` onto a **Verify** workflow id. For an imported session that number is not ours, so
it either misses (→ the current row, as before) or *collides* with a Verify version number and
resolves to a config the session was never judged by. The importer's own version numbering is the
thing to fix; this function cannot tell the two apart from the column alone. **Native sessions are
unaffected** — `_create_session_row` pins `wf["version"]` from the row it has just read.

**`GET /api/idv/sessions/{id}`** now answers

```
"workflow": {"id": "...", "name": "...", "version": 2, "config": { ...that version's config... }}
```

resolved the same way. `version` is the value stored **on the session**, so when the resolution had to
fall back the number on screen is still the number in the row.

**Two more resolvers were still reading the current row**, both found by adversarial review after the
first cut was green:

- `idv_store.confirm_person_verified` took `expires_after_days` from the live workflow. That value
  sets a date on a **person** which gates them out of the estate a year later, and it is called from
  inside `_engine_callback` — three lines from the code that had just been taught to pin the
  thresholds. It now resolves the session's own version.
- `idv_store.resolve_person_for_session`'s `face_search_min` fallback did the same. `_face_search_min`
  never passes `None`, so the only caller reaching that branch is `relink_people` — the one-shot
  **backfill**, i.e. exactly the path that re-decides history and the last place a present-day
  threshold belongs. The console previously printed the
pinned version *number* beside the *current* version's thresholds, which reads as provenance and was
not: an analyst asking why a 62 was declined saw `face_match_min: 60` next to it.

**This closes the gap `idv/screen-session.jsx` names in its own header (gap #3).** That file works
around the missing field by fetching `GET /api/idv/workflows/{id}/versions` and matching
`session.workflow.version`, with the same fall-back-to-latest rule implemented here — so the console
is correct today and the extra round trip is now redundant rather than load-bearing. Reading
`session.workflow.config` directly is a follow-up, not a fix this addendum requires.

### 2. The engine's replay fingerprint round-trips

The liveness node now carries `replay_fingerprint: {clip_sha256, blink_hash, …}`. The engine has no
database of its own, so a fingerprint it cannot compare against anything is a field in a response:
the same recorded clip could be re-submitted under a new session for ever.

- **New columns** (guarded `ALTER`, `idv_store._ADDED_COLUMNS`): `idv_sessions.clip_sha256`,
  `idv_sessions.blink_hash`. Written by the callback when the liveness node carries a fingerprint,
  and **never cleared** — a later job with no liveness node (a retry, or a resubmission whose
  liveness step was not the one redone) leaves the stored value alone. Blanking it would silently
  delete the one hash that makes the guest's next attempt checkable.
- **The engine job body** carries `session_id` (as before) and now
  `known_clips: [{session_id, clip_sha256, blink_hash}]`, most recent first, from
  `idv_store.known_clip_fingerprints`: **this person's other sessions, uncapped**, plus the
  **500 most recent globally** (`idv_store.KNOWN_CLIPS_LIMIT`). Two populations because they answer
  two questions — "is this the clip that got them declined an hour ago" and "have we seen this clip
  from somebody else".
- **This session's own row is never in the list.** A resubmission re-posts a job for a session that
  already holds a fingerprint from its first pass; handing it back makes the engine find a perfect
  match against itself and report a replay for a guest who did nothing wrong. Same defect
  `templates_url_for` documents for the 1:N face search.
- Rows with neither fingerprint are skipped (nothing to compare, at the cost of a hash in every
  body), and tombstoned sessions (`deleted_at`) are skipped — a deletion that leaves the clip hash
  behind as evidence is not a deletion.
- **`session.person_id` is `null` on every brand-new session** (`create_session` never sets it;
  resolution runs in the callback, *after* the job is built), so the person-scoped half was inert on
  the very case it exists for — the same guest returning with the clip that was declined an hour ago.
  `idv_api._person_for_clips` therefore falls back to `get_person_by_vendor_data`, the site's own
  stable handle, which **is** set at creation. It **links nothing**: it is a read used only to choose
  which hashes to send. Guessing wrong there costs a few extra hashes in a request body; guessing
  wrong in `resolve_person_for_session` would merge two guests.
- The engine already tolerates the key and drops rows naming the current session on its own side
  (`idv-engine/pipeline/liveness.py:_normalise_known_clips`), so the exclusion is belt **and** braces
  — deliberately, since only one of the two ends is in this repo's release.

### 3. `similar_faces` names and faces are analyst-only

A 1:N hit is a claim that this face belongs to a **different named guest**, and the image beside it is
that guest's biometric media. Neither is queue-monitoring information.

On `GET /api/idv/sessions/{id}`, for role **< analyst**:

| field | viewer sees |
|---|---|
| `person_name` | `null` |
| `media_url` | `null` |
| `label`, when it is another person's name | `"another guest on file"` |
| `session_id`, `session_number`, `similarity`, `match_type`, `person_id`, and the array length | unchanged |

`label` is redacted **as well**, and that is the half a field-by-field reading of the rule would have
missed: it falls back to the person's name, so blanking only `person_name` leaks the same string
through the phrase the screen actually prints. `"earlier attempt"` (this session's own person, or a
person-less template) and a blocklist's `list_name` are **not** redacted — neither names a guest.

**`person_id` goes too, and so does the rest of the response body.** Two adversarial reviews of the
first cut of this addendum found the gate defeated three ways, none of them visible from the changed
lines:

- `GET /sessions/{id}` returns the same finding **twice** — as `similar_faces` *and*, verbatim, inside
  `decision.face_searches[].matches[]`. The second copy carried the name, the `media_id` and the
  `media_url` in the adjacent key of the same response. Both now go through one function,
  `idv_api.redact_face_match`, because a redaction written out twice is a redaction applied once.
- `media_id` is redacted as well as `media_url`: `_media_route`'s console branch requires only
  **viewer**, so an id *is* a URL.
- `person_id` is redacted (except when the match is the session's own person, already named on that
  screen): `GET /api/idv/people/{id}` is viewer-readable and answers with the name, which would make
  the whole redaction one HTTP call deep.
- **A person id was also embedded in prose.** `idv_store.resolve_person_for_session` wrote
  *"A face on this session matched person `<id>` at 96.8…"* into `decision.warnings[].short_description`
  — which travels to the session screen, the PDF, the outbound webhook and `/v3`, none of which is
  role-gated the way `similar_faces` is. The sentence now names no one; the identity lives only in the
  structured places that **are** gated. The warning row's three keys (`risk`, `log_type`,
  `short_description`) are unchanged.

**Still open, and named rather than left implied:** the `AMBIGUOUS` warning in the same function lists
`hw_identities` ids in its sentence, and the audit trail's `person.resolved` detail carries candidate
person ids. Both are a different id space and a different route's role gate; neither is in this
addendum's scope.

### 4. No upload after a verdict

`POST /api/idv/capture/{token}/media` and `POST /api/idv/media` (when it carries a `session_id`) now
answer **`409 {"error": "This verification is already finished."}`** once the session's status is one
of **`Approved`, `Declined`, `Expired`, `Kyc Expired`**.

Refused **before the multipart is parsed**, so no media row and no file are written: bytes on a
finished session with nothing in the audit trail explaining them is its own problem.

Past the link's TTL the capture route still answers **`410`** first, for every write, which is
unchanged: the link *was* valid and the guest needs to be told to ask for a new one. The `409` is
therefore what a **live link on a finished session** gets — which is the case the late frame actually
arrives in.

`Abandoned` is deliberately **not** in that set. The capture page's beacon fires on any page-hide, so
`Abandoned` routinely means "the guest rotated their phone", and lifting it back to `In Progress` is
exactly what the media route is for — unchanged. A console upload with **no** `session_id` (the
unattached bucket) is also unchanged.

The measured shape is the 2026-09-09 stranding one step further on: the page fires the last frame of
a step, the verdict lands first, the frame arrives afterwards. `_capture` deliberately keeps a
finished session's link **readable** so the guest can reload the outcome screen, and the media route
sat inside that with no check at all — a late `selfie` spent an attempt and moved an **Approved**
session back to `In Progress`.

### 5. The hosted link is never relative, and a missing capture page is a 503

- **`GET /verify/{token}`** answers **`503 {"error": "Verification is unavailable on this deployment: the capture page (idv/capture.html) is missing."}`**
  when neither `WM_DEMO_STATIC_DIR/idv/capture.html` nor `idv_api.CAPTURE_PAGE_FALLBACK` exists. It
  previously answered **200 `text/plain`** with an apology, so a monitor saw a healthy page while the
  site's iframe rendered the sentence "the capture page is not built yet" where the camera should be.
  The session token is no longer echoed into the body — it is a bearer credential and an error body
  ends up in proxy logs. The `frame-ancestors` header is still sent.
- **`idv_api.public_base()`** falls back to the **request's own `Host`** when `IDV_PUBLIC_BASE` is
  unset. Scheme: `X-Forwarded-Proto`'s first value when a proxy sent one, otherwise **`https`**, and
  **`http` only for localhost / `127.*` / `[::1]`**. Unset, this returned `""`, so
  `POST /v3/session/` answered `url: "/verify/<token>"` — a **relative path**, in a link whose every
  consumer (the embedding site, the guest's SMS, the engine's `callback_url`) is off-origin by
  construction. The host is held in a **thread-local**, set once at the top of `idv_api.handle`:
  `server.py` serves on a `ThreadingHTTPServer`, and a module global would let one guest's request
  mint the link for another guest's session on a different domain. Outside a request (the sweeper
  thread) it is still `""`, which is the pre-existing behaviour and why the environment variable stays
  the first thing consulted on a real deployment.
- **`callback_url` never uses the fallback.** `Host` is written by whoever sent the request, and
  `callback_url` is where our engine POSTs the decision — name, date of birth, document number,
  signed. Borrowing the header there would let a guest submitting their own session name the host that
  receives it. `prepare_engine_job` builds that one URL from `idv_api.configured_base()`
  (`IDV_PUBLIC_BASE` alone): unset, it stays relative, exactly as before this addendum. The
  asymmetry is deliberate — `media[].url` still borrows the host, because a forged host there costs
  the attacker their **own** session's media fetch and gains them nothing they did not already
  control. `IDV_PUBLIC_BASE` is `sync: false` in `render.yaml`, so setting it on the live service
  remains the right thing to do, and this is why.

### 6. `POST /api/idv/auth/pin` is reachable on a public deployment

Addendum r4 documents the PIN gate. On a **public** deployment `server.py` refused every write with
no `x-hw-write-token` — **including the PIN exchange itself**. The gate required a credential
obtainable only through the route the gate was blocking, so the PIN card's Continue button answered
`403` on the only kind of deployment the PIN gate exists for.

`/api/idv/auth/` joins the self-authenticating exemptions in **both** public write-gate blocks
(`_dispatch_POST` and `_idv_verb`) alongside `/api/idv/webhooks/engine`, `/api/idv/capture/`, `/v3/`
and `/v2/`. It authenticates itself the same way the other four do: the PIN **is** the credential,
compared with `hmac.compare_digest`, rate-limited at 5/min per client IP, and audited on every
attempt with the PIN in no row. A wrong PIN is `403` **from the route**, not from the gate.

**Nothing else moved.** `/api/idv/auth/` has exactly two routes (`GET status`, `POST pin`); every
console write still needs `x-hw-write-token` **and** the token this route mints.

### 7. `sessions_count` counts every status but not every row

`idv_store.bump_person_sessions` now counts `deleted_at IS NULL` — the same clause `list_sessions`
has carried since the table shipped. It still counts **every status**: `Declined`, `Abandoned`,
`Expired`, `In Progress` and `Not Started` are all things this person did, and a counter that hides
the failures is the screen the owner said was wrong.

Counting tombstones made the customer file say "4 sessions" over a list of 3, and the one number a
privacy erasure exists to change was the one number that still remembered. `execute_deletion` now
re-bumps the owning person — reading the owner **before** the tombstones go down, because afterwards
there is no way left to know whose counter to move, which is how this exclusion would have been
invisible on the screen it was written for.

**`merge_person` was a second, forgotten writer of the same column** and kept its own hand-written
`SELECT COUNT(*)`, so a support merge after a privacy erasure silently restored the number the
exclusion exists to kill — and `_person_duplicates` is precisely the screen that drives merges. It now
calls `bump_person_sessions`, so there is one writer.

### Where it is held

| suite | checks | was → now |
|---|---|---|
| `qa/idv_api_probe.py` | **AP-163…AP-175** | 168 → **181** |
| `qa/idv_store_probe.py` | **ST-73…ST-77** | 72 → **77** |
| `qa/idv_import_probe.py` | — | 78 → **78** (unchanged; the importer writes sessions and workflows and reads neither the pin nor the fingerprints) |
| `qa/battery.py` | `TOTAL_CHECK_FLOOR` | 2326 → **2344** |

No existing check was edited or deleted. AP-172 is driven through the **real `server.Handler`** with
only its socket removed, and it asserts on **both** gate blocks: the PATCH/PUT/DELETE gate was added
separately for Verify and its prefix list has drifted from `_dispatch_POST`'s once already.
AP-170 required lifting the capture page's fallback path out of `_capture_page` into the module
constant `idv_api.CAPTURE_PAGE_FALLBACK` — a 503 no test can reach on a machine where the file
happens to exist is a branch nobody knows the shape of.

**AP-173…AP-175 and ST-76/ST-77 are the adversarial-review half.** They exist because two reviewers,
run *after* the first ten checks were green, refuted three of the six fixes — and in every case the
defect was a **second path to the same thing**, invisible from the changed lines. That is this
estate's recurring failure shape, which is why each one got a check rather than a comment.

`qa/idv_rules_probe.py` and `wmdemo/idv_rules.py` were being edited **concurrently by another agent**
throughout this pass and are not part of these numbers. That suite printed **413/413** on the last run
here while `qa/battery.py`'s `EXPECTED_CHECKS` still says 409 — so **+4 to its entry and to
`TOTAL_CHECK_FLOOR` (2344 → 2348) is still owed by that agent**, deliberately left to them: raising a
floor for checks somebody else wrote, whose justification you cannot give, is how that constant stops
meaning anything.

---

## Addendum — 2026-09-09 (r6): the cross-check floor was read off the wrong number

**Amends the r3 addendum above (`names rejoin the tamper set`). The 2026-09-09 barcode ruling and r3's
name definition are otherwise unchanged. Numbering: this is the third revision of the *cross-check*
rule, and its lineage reads r3 → r6 with a gap, because r4 (console PIN) and r5 (workflow versioning)
are addenda to unrelated subsystems in the same global sequence.**

### `barcode_vs_ocr.confidence` is not a read confidence. It is an agreement ratio.

r3 gated the whole cross-check on `barcode_vs_ocr.confidence >= 85` and called it "a confidently-read
print". Measured in `idv-engine/pipeline/document.py::_crosscheck` — not inferred from the name of the
key — that number is a **weighted agreement ratio**:

| field | weight |
|---|---|
| `date_of_birth` | 3 |
| `expiration_date` | 2 |
| `document_number` | 2 |
| `last_name` | 2 |
| `first_name` | 1 |
| `date_of_issue` | 1 |

```
confidence = 100 × (weight of the AGREEING fields)
                 ÷ (weight of the agreeing + the DISAGREEING fields)
```

A field the OCR never produced is `missing` and weighs on **neither** side. So the number says how
*much* of the card the two surfaces agree on, says nothing about how well the recogniser read the
print — and, being a ratio over the disagreement, **it falls as the disagreement it gates grows.**

Put r3's name test beside that arithmetic, on a card where all six fields compared:

| the disagreement | ratio | r3's 85 floor |
|---|---|---|
| **both names** — the strongest form of the forgery | 8/11 = **72.73** | **below** |
| **surname only** | 9/11 = **81.82** | **below** |
| first name only | 10/11 = 90.91 | above |

**The name branch r3 added to catch a reprinted front over a genuine barcode could not fire for that
forgery.** The stronger the attack, the further below the floor the gate that guarded it. Only a
first-name-only reprint cleared it, which is why the branch looked alive rather than dead.

It is worse than a name problem. Solving `w/(11−w) ≥ 85/15` for each field: **no** single-field
disagreement in `OCR_IDENTITY_FIELDS` can reach 85 on this ratio either — `date_of_birth` needs an
agreeing weight of 17 out of a possible 8, `document_number` 11.33 out of 9. On this engine only
`first_name` and `date_of_issue` can clear it alone. r3's identity half was as unreachable as its name
half; both were surviving on hand-typed fixtures.

### How twelve green checks missed it

Every name fixture in probe section K typed the confidence in by hand — `_name_session(90.0,
first=…, last=…)` — and *both names disagreeing at 90.0* is a payload the engine cannot produce, since
the confidence **is a function of** the disagree list beside it. A fixture that sets two dependent
fields independently can assert a contradiction, and this one did, in the direction that looked green.

`qa/idv_rules_probe.py` now **derives** the ratio (`engine_agreement`, mirroring
`ENGINE_AGREEMENT_WEIGHTS`) from the very disagree list under assertion. `IDV-K27` pins that mirror
against two **real captured payloads** — the owner's session comes out at exactly 40.0 and session #9
at exactly 90.0, which is where their recorded `confidence` values came from — and then states the
unreachability above as numbers. Had that row existed, r3's fixtures could not have been written.

### The engine now reports the two measurements separately

| key | meaning | status |
|---|---|---|
| `agreement` | the ratio above, unchanged | **new name for the old number** |
| `confidence` | alias for `agreement` | **kept for one release**, then removed |
| `ocr_confidence` | 0–100, mean recogniser confidence of the OCR lines the compared fields were read off | **new** |
| `ocr_field_confidence` | `{field: 0–100}` where the engine has a per-field number | **new** |

The engine also now compares the printed first name against **both** AAMVA given-name tokens
(`DAC` *and* `DAD`), because a US front prints given and middle on one line while the barcode splits
them.

`ocr_confidence` is the same measurement `MED_REC_UNREADABLE` already gates on (`ocr_confidence` on
the medical-recommendation node) — one meaning for the word across the module.

### The rule now

`BARCODE_OCR_MISMATCH` fires when, **for the disagreeing field itself**
(`idv_rules.ocr_tamper_gate` — the one place this lives):

1. the **OCR read confidence** is ≥ 85 (`OCR_CROSSCHECK_CONFIDENCE_MIN`, inclusive, unchanged value):
   `ocr_field_confidence[field]` when the engine reports one, else `ocr_confidence`. The per-field
   number **wins in both directions** — it promotes a sharp surname on a smeared card and demotes a
   smeared surname on a sharp one (`IDV-K28`); **and**
2. the field is `date_of_birth` / `document_number` (`OCR_IDENTITY_FIELDS`), or it is a name that is a
   **different name** under r3's definition plus the three new clauses below.

**The agreement ratio is never a tamper gate again.** Gating a disagreement on a ratio that falls with
it is the same category error as gating a fire alarm on how little smoke there is.

#### The fallback, and its one asymmetry

An **older engine** and the **1,020 imported rows** carry no `ocr_confidence`. For those payloads the
gate falls back to r3's behaviour on `confidence` — **but only for `date_of_birth` and
`document_number`. A name is never a tamper signal on the agreement ratio alone.**

That asymmetry is the point of the fallback, not a rough edge in it: the unconditional half of the rule
keeps behaving exactly as it has on every payload ever recorded, and r3's false decline — the owner's
session, refused on two garbled names — becomes unreachable on those payloads **by construction**
rather than by a threshold that could be mis-set. `first_name` alone is the one name shape whose ratio
clears 85 (90.91), so it is the only fixture that can tell the two halves of the fallback apart, and
it is exactly the shape that declined under r3 (`IDV-K25`).

The honest consequence, stated rather than buried: **on the older engine, and in an imported row, a
reprinted-front forgery is not caught here.** It was not caught before this amendment either — the
arithmetic above says so — so nothing regresses. What changes is that the reason is now a rule instead
of an accident of arithmetic.

#### Three more ways to be a misassigned read

r3's clauses all ask *how far apart are these two strings*. A photograph of a licence has three ways to
put a string in the wrong **slot**, and every one of them is maximally far from the truth by every
distance this module owns — so r3 declined all three at 92 confidence (`IDV-K26`):

| clause | fails ⇒ warning | why a distance cannot see it |
|---|---|---|
| **not a field label** (`OCR_NAME_LABEL_TOKENS` = `FN`, `LN`, `DOB`, `EXP`, `DL`, `ID`) | `LN` against `HOLLINGSWORTH` | printed beside the values on every US licence; an OCR that associates a line with its own caption returns the caption. Distance 1.00, 13 edits. |
| **not a US jurisdiction** (`OCR_NAME_STATE_TOKENS`, names and two-letter codes) | `CALIFORNIA` against `HOLLINGSWORTH` | the state name is the largest print on the card and lands in a name field the same way |
| **not the card's own given-name words** (`OCR_NAME_GIVEN_ELEMENTS` = `DAC`, `DAD`; token-subset test) | `ODETTE` where `MARISOL` belongs | the front prints given + middle on one line while the barcode splits them, so the OCR read the card *correctly* and filed it wrongly. Session #9's containment guard catches only the run-together form (`NMARISOLODETTE`) and cannot catch the clean swap. |

**The honest cost, again stated rather than hidden:** a genuine forgery whose printed surname happens
to *be* a US jurisdiction is waved through this branch — **WASHINGTON** is a common American surname,
and VIRGINIA and MONTANA are given names. That is the same deliberate fail-*open* as
`OCR_NAME_TAMPER_EDITS_MIN`, taken for the same reason: the alternative fails *closed* on real guests,
`date_of_birth` and `document_number` still apply to exactly those sessions, and a forger reprinting a
front does not reprint it with a state name where the surname goes.

### Two smaller things the same pass found

**Every sentence now names *which* confidence it is quoting** (`idv_rules._conf_phrase`). The whole
defect was one number wearing another number's name; an audit trail that repeats the confusion is how
the next reviewer re-derives the wrong conclusion. A guest record reads either
`92.0 OCR read confidence`, `92.0 OCR read confidence for that field`, or
`90.9 barcode/OCR agreement — this engine version reports no OCR read confidence, …`.

**`printed_vs_barcode_name` no longer raises on a non-dict node.** Its contract is "`(None, None)` is
always a safe answer", and it was guarding with `x or {}`, which catches `None` and passes a string, a
list or a number straight into the caller's `.get`. An `engine_detail: ""`, a `crosscheck: []` or a
`barcode_fields: "none"` — all shapes another process can send — raised `AttributeError` inside the one
function whose job is to warn when it cannot see the strings. A rule that cannot see the strings must
**warn**, and it cannot warn from a traceback: a traceback here is no decision at all for a guest
standing at a counter. `idv_rules._as_dict` / `_seq` now guard every rung, and `_seq` deliberately
treats a **string as not a sequence** — `disagree: "first_name"` would otherwise iterate as eleven
single characters and match no field at all, silently.

### Where it is held

| suite | checks | was → now |
|---|---|---|
| `qa/idv_rules_probe.py` | **IDV-K25…K28** added; K05, K06, K08, K09, K13, K16, K18, K20, K21 rewritten | 409 → **413** |
| `qa/idv_api_probe.py` | — | **178 → 178** (unchanged) |
| `qa/battery.py` | `TOTAL_CHECK_FLOOR` | **+4** — owned by another pass, not edited here |

No check was deleted. Nine K-section fixtures were rewritten because they asserted against payloads
the engine cannot send; each rewritten row states what it now derives and why.

**`IDV-K16` was re-pinned because it did not test the constant it named.** It claimed the 0.50 distance
floor using `HOLLINGSWORTB` vs `HOLLINGSWORTH` — one edit, distance 0.08 — and with
`OCR_NAME_TAMPER_DISTANCE_MIN` mutated to **0.0 the check stayed green**, because the 3-edit floor
underneath it stopped the same fixture on its own. Both fixtures are kept now, pinning different
clauses: the one-edit typo for the edits floor, and `HOLLINGSWQBIN` (4 edits, distance 0.31 — over the
edits floor, under the distance floor) for the distance floor.

Mutation results for the section, each run in its own process:

| mutation | reddens |
|---|---|
| `OCR_NAME_TAMPER_DISTANCE_MIN` 0.50 → 0.0 | **K16** only |
| `OCR_NAME_TAMPER_EDITS_MIN` 3 → 0 | **K24** only |
| gate reads the agreement ratio first (revert to r3) | **14 rows**, including the flagship K18 |
| names may tamper on the ratio (drop the r6 asymmetry) | **K25** only |
| drop the three misassigned-read clauses | **K26** only |
| `_as_dict` → the old `x or {}` guard | `AttributeError` in `printed_vs_barcode_name`; the suite aborts |
| `OCR_CROSSCHECK_CONFIDENCE_MIN` 85 → 0 | **7 rows**, including K02/K13/K14 — the owner's own session |

The three floors are now pinned by **disjoint** fixtures. Under r3, K16 and K24 both keyed on the edits
floor and neither depended on the distance floor.

**Correcting the r5 addendum's last paragraph:** the `IDV-K05` format-string failure it recorded in
`qa/idv_rules_probe.py` was this pass's own transient edit, not a pre-existing bug. It is fixed; the
suite is 413/413.

- 2026-09-09 (r7 — passport / MRZ support, `wmdemo/idv_store.py` + `idv_api.py` + `idv_rules.py`,
  built to `mrz-contract.md`'s "Session", "Engine job input" and "Rules (autonomous), passports"
  sections):

  **A. Store.** `idv_sessions.document_type TEXT NOT NULL DEFAULT 'drivers_license'`, added by the
  same guarded `ALTER TABLE ... ADD COLUMN` mechanism as `attempts` before it (`_ADDED_COLUMNS` /
  `_add_missing_columns`, `PRAGMA table_info`-checked — a no-op on a database that already has the
  column, so every request after the first runs no DDL). `st.DOCUMENT_TYPES = ("drivers_license",
  "passport")`; `create_session(..., document_type=...)` falls back to the licence default for
  anything not in that set rather than storing an unrecognised value verbatim — a third capture flow
  must be a deliberate code change, not a typo in a request body. `document_type` is writable via
  `update_session` (`_SESSION_WRITABLE`), filterable on `list_sessions(document_type=...)`
  (additive — not one of this file's documented `/api/idv/sessions` query params, so an unset
  filter changes nothing for an existing caller), and exposed on every session row for free (`SELECT
  *`), on `GET /api/idv/sessions/{id}`'s `session.document_type` (distinct from
  `session.document.type`, which is the DECISION's own denormalised `id_verifications[0].
  document_type` — the Didit literal, `"Passport"`, and null until a decision exists), and on
  `GET /api/idv/capture/{token}/state`'s `document_type`. `idv_documents.mrz` already existed
  (anticipated by an earlier pass) and `insert_document` was already writing it verbatim; nothing
  there needed to change.

  **B. Capture flow.** A passport session has no `document_back` step: `_capture_state`'s step-list
  loop and `_capture_media`'s `next_step` computation both skip it when `session.document_type ==
  "passport"` (the same `_STEP_FOR_FEATURE` iteration, one added guard each — mirrored, not forked).
  Before this pass a passport guest who had just shot `document_front` would have been told
  `next_step: "document_back"` for a side that does not exist and could never satisfy it — the
  concrete shape of the contract's "evidence-required logic" instruction. `_stranded_decision` /
  `_repair_stranded` needed no change: both operate purely on status/decision/job-id timestamps and
  carry no capture-step logic at all. New route **`POST /api/idv/capture/{token}/document-type`**
  body `{"document_type": "passport"|"drivers_license"}` → `200` with the exact same body as `state`
  (so the capture page can render the new step list with no second round trip); `400` on an
  unrecognised value; `409` once the session is past `Not Started`/`In Progress` OR once any
  `_EVIDENCE_KINDS` media row exists (switching type after a licence back has been photographed
  would orphan that upload against a step list with no slot for it); audited as
  `session.document_type_set`.

  **C. Engine job input.** `prepare_engine_job`'s body gained a top-level `document_type` field
  (`session.document_type`, defaulted to `'drivers_license'`) — "same literals", per the contract.
  Everything else in the job body is unchanged.

  **D. Console detail and the PDF.** `GET /api/idv/sessions/{id}` and the outbound `data.updated`
  webhook / `/v3/session/{id}/decision/` already pass `decision.id_verifications[0].mrz` through
  **untouched** — `decision_out` reads the column verbatim off the stored JSON blob with no
  whitelist, exactly like every other `id_verifications` field, and storage (`insert_decision`)
  already stores the callback's node array byte-for-byte. Verified by reading the actual code paths
  end to end (not assumed): zero lines changed for this half of the requirement, confirmed by
  `AP-184`. The compliance PDF had no such passthrough (`idv_decisions` denormalises scalar identity
  columns and has no column for a whole sub-object) — `idv_pdf.compliance_pdf` gained an optional
  `mrz=` argument and a "Machine-readable zone (MRZ)" section printed only when present; both `/pdf`
  call sites in `idv_api.py` now read `id_verifications[0].mrz` off the decision row and pass it
  through.

  **E. Rules — identity source.** "MRZ (valid) → nothing else": `_mrz_identity(doc)` (the passport
  analogue of `_read_dob`, deliberately not the same function) returns a date of birth ONLY when
  `mrz.valid` is `True`, and `_document_block`'s expiry check reads `mrz.expiration_date` the same
  way for a passport document — never the top-level OCR fields, which are a tamper check on the MRZ
  here, not a fallback identity source the way a licence's printed line at least is. `barcode_
  expected_but_absent` gained an explicit early return for `document_type == "PASSPORT"` (was already
  structurally true; now stated rather than merely implied) so `BARCODE_NOT_DETECTED` and the
  barcode/OCR crosscheck can never fire on a passport — "no barcode on a passport is never a
  mismatch."

  **F. Rules — MRZ warnings, new `_mrz_block`.** `MRZ_NOT_FOUND` / `MRZ_LOW_CONFIDENCE` are two new
  reason codes (`REASONS_RETRYABLE`, `_GUIDED`) with the contract's verbatim guidance sentence
  ("Open to the photo page and hold it flat so both lines of the code at the bottom are inside the
  frame."), re-opening `document_front` for the standard 3 tries before declining with a path — the
  same mechanic every other document-step finding already uses. Raised off `mrz.valid` DIRECTLY
  (`_mrz_block` computes it itself rather than trusting only the engine's warning string), so an
  engine that forgets to name the specific warning still asks for a retake instead of silently
  approving an identity nobody read — the same fail-closed discipline `own_numeric_read` applies to
  the numeric thresholds, and `CAP_BARCODE_UNREADABLE` closes the score-ceiling side of that same
  door.

  **`MRZ_INVALID` is deliberately NOT its own reason code.** Chosen reason: **`BARCODE_OCR_MISMATCH`**
  — reused verbatim, not invented. Rationale: "check digits fail on a confidently read band" is the
  same shape as a confidently read AAMVA barcode contradicting the print, which is exactly what
  `BARCODE_OCR_MISMATCH` already means and already carries the right mechanic for
  (`MAX_BARCODE_MISMATCH_ATTEMPTS = 2` — one retake, then Declined under that same reason, which is
  precisely "one retake, then Declined" as specified). Its default `GUIDANCE` names `document_back`,
  a step a passport session does not have, so the `fix=` override points at `document_front` with
  the contract's MRZ sentence (`_FIX_MRZ_RETAKE`) — the same override pattern `_document_block`
  already uses for `worst_side == "document_back"`. The `mrz_vs_ocr` crosscheck reuses this
  mechanism too: `mrz_ocr_verdict(engine)` is `barcode_ocr_verdict(engine, bvo=_mrz_vs_ocr(engine))`
  — a thin wrapper, not a fork — and `barcode_ocr_name_reads` gained an optional `bvo=` parameter for
  the same reason, both defaulting to their old behaviour so every existing licence call site is
  byte-for-byte unaffected.

  **G. Licences are unchanged, mutation-checked.** The full rules probe was run before this pass's
  probe edits (410/413, 3 failures — see below) and after (420/420, 0 failures), on the same tree,
  with every failure attributed to a fixture that used `"PASSPORT"` as an incidental placeholder
  value rather than a real defect: `IDV-A39`/`IDV-A40` (document-type/country policy warnings) were
  repointed to `"RESIDENCE_PERMIT"`, since `PASSPORT` is no longer just another `document_type`
  string — it now switches the whole session onto the MRZ-only identity path — and `IDV-A103` (which
  asserted a barcode-less passport approves off its OCR fields, the pre-MRZ shape) was rewritten to
  carry a valid `mrz` node; the pre-MRZ shape is kept as new fixture `IDV-A103b`, asserting the
  contract-correct behaviour instead (a retake, not a silent approval). No other licence-path check
  changed answer.

  **Probes: before → after.** `idv_rules_probe` 413 → 420 (+7: `IDV-A103` rewritten, `IDV-A103c`
  MRZ_LOW_CONFIDENCE, `IDV-A103d` the 3-try retake ladder, `IDV-A103e`/`IDV-A103f` MRZ_INVALID's
  one-retake-then-decline, plus two auto-generated `IDV-L08` classification rows for the new reason
  codes). `idv_store_probe` 77 → 78 (+1: `ST-78`, the `document_type` column/migration/filter).
  `idv_api_probe` 181 → 190 (+9: `AP-176`..`AP-182` the capture-flow step list and the
  `document-type` route's two 409s, `AP-183` the engine job body, `AP-184` the console-detail +
  PDF-input MRZ passthrough). `idv_import_probe` unchanged at 78/78 (not touched this pass). All
  four run green, standalone, on this tree. `qa/battery.py`'s `EXPECTED_CHECKS` and
  `TOTAL_CHECK_FLOOR` (2359 → 2376) were updated to match, each with a dated comment.

  **Not done by this pass, and not silently assumed.** The engine half (actually reading the MRZ off
  the photo page, populating `id_verifications[0].mrz` and the top-level identity fields, and the
  `mrz_vs_ocr` crosscheck block) and the capture-page half (offering the document-type choice,
  sending `POST .../document-type`, and rendering the passport step list) are separate agents'
  work against this same contract and were not touched here.

## Addendum — 2026-09-09 (r8): middle name, the proof image, and the medical-rec skip

Built to `mrz-contract.md`'s "Addendum 2" section (middle name, proof image, medical-rec skip) and
`med18-brief.md` gap B (the "I don't have one" request that never got made). `wmdemo/idv_store.py` +
`idv_api.py` + `idv_pdf.py`; `idv_rules.py` untouched — every reason code, the attempt ladder and the
3-try exhaustion this pass exercises already existed and needed no change, only a caller that finally
drives them correctly.

**A. Middle name.** `id_verifications[0].middle_name` — licences: AAMVA DAD; passports: MRZ given
names beyond the first token; `first_name` stays the first given name (DAC). Backend consumption
only: no engine change here, and the field is `None` on every existing fixture and every imported
Didit row (unaffected, exactly as specified). `idv_people.middle_name` and `idv_decisions.
middle_name` TEXT columns, added by the same guarded `ALTER TABLE ... ADD COLUMN` mechanism as
`document_type` before them (`_ADDED_COLUMNS`/`_add_missing_columns`, `PRAGMA table_info`-checked).
`st.barcode_identity(doc)` reads `doc.get("middle_name")` (trimmed, `None` when absent or blank) —
no AAMVA fallback of its own, unlike `first_name`/`last_name`'s DAC/DCS: `middle_name` is the
engine's field to fill or leave null. `st.upsert_person`/`update_person`/`_fill_person_blanks` all
gained a `middle_name` parameter on the same fill-blanks-only rule the other name fields already
carry (never overwrite a non-null column). **`st.full_name(first, middle, last)` is the one new
function this pass adds** — a single join (blanks dropped, `None` if nothing survives) that every
first_name/last_name display string in the codebase now threads middle_name through instead of
repeating its own `' '.join(...)`, which is exactly how the middle name went missing the first time
("we aren't including the middle name anymore? fix that"): `session_summary`'s `person.display_name`
(the console title/list), `person_out` (`middle_name` + a computed `full_name`), the three
person-name joins in the 1:N/duplicate-detection code, the `_update_data` analyst-correction path
(`middle_name` added to `_DATA_FIELDS`, threaded through `update_decision_fields`'s existing
`**scalars`), the compliance PDF's Name line (`idv_pdf.py`), and the `/v2` (and, by the same
function, `/v3`) `kyc.full_name` field — which is now **always** `st.full_name(...)`, never the
engine's own `full_name` verbatim, because a stale or pre-middle-name `full_name` on the node would
silently reintroduce the exact gap this addendum closes (caught by the probe's own first run: a
fixture carrying `full_name: "Jane Roe"` alongside a newly-added `middle_name: "Quinn"` produced
`"Jane Roe"` in `/v2`'s kyc block until the fallback was made unconditional). `id_verifications[0].
middle_name` itself needs no passthrough code at all — `decision_out` and the outbound webhook both
already read the node array verbatim off the stored JSON blob, with no per-field whitelist.

**B. Proof image.** The engine builds a composite JPEG (selfie stacked over the document-front crop)
whenever both exist, on **any** verdict, and emits it in the **callback body**, not inside `decision`:
`"proof_image": {"jpeg_b64": "<base64>", "width": W, "height": H}`. `idv_api._store_proof_image`
(called from inside `_engine_callback`'s own transaction, after `insert_document`, before the media
token is spent) decodes it and validates the BYTES, never the claim — the same "the type is read from
the file, not the header" rule `idv_media.sniff` enforces everywhere else: JPEG magic
(`idv_media.sniff(raw) == "image/jpeg"`), a 2 MB cap (tighter than `idv_media.MAX_IMAGE_BYTES`'s 8 MB
— a server-built composite from two already-admitted photos claiming more than a couple of megabytes
is suspicious, not merely generous), and sane decoded dimensions (16–8000 px each side, read off the
actual JPEG SOF marker via `idv_media.dimensions`, not the callback's own `width`/`height` metadata).
A missing, malformed, oversized or non-JPEG field is audited (`proof.rejected`) and dropped — it never
fails the callback that carries the actual verdict. On success it replaces any earlier `proof` row
for the session (`idv_media.purge_file` + `st.mark_media_deleted` called directly rather than through
`idv_media.purge`, which opens its own transaction — nesting a second `BEGIN IMMEDIATE` inside the
callback's would error) and is stored via `idv_media.store_upload` with kind **`proof`**, `mime
image/jpeg`, `purpose verification_biometric`, `retention until_customer_deleted`, `source "engine"`,
audited as `proof.stored`.

`proof` is **not** an evidence kind and deliberately touches none of the mechanisms that gate
evidence: absent from `_MEDIA_KINDS` (no capture route ever accepts an upload of this kind — it is
engine output, never guest input) and from `_DOCUMENT_KINDS`/`_CONSOLE_MEDIA_KINDS` (no analyst
manual-upload path either), and therefore also absent from `_EVIDENCE_KINDS` — it can never spend an
attempt (`_count_attempt` never runs on it) or move a session's status. `prepare_engine_job` (the one
function every submit path funnels through — `_capture_submit`, the engine-outage retry, and
`submit_engine_job`) drops any `proof`-kind row from `media_rows` before building a job body: a
resubmission's `st.list_media(...)` call would otherwise include a `proof` row a previous callback
wrote and hand the engine back the very image it produced, which is not evidence, it is the engine's
own output. Deletion/tombstoning needed **zero** changes: `execute_deletion` iterates every row
`list_media` returns for a session with no kind filter, so a `proof` row is unlinked and tombstoned
by the existing privacy-erasure path exactly like any other media kind, and `_session_detail`'s
`media[]` already includes it (same `st.list_media` call, same `media_out` shape) with no code
change either.

Exposed two ways, both auditable and both gated identically: `_session_detail` now computes
`session.proof_url` (`"/api/idv/sessions/{id}/proof"` when a `proof` row exists, else `null`), and
the new route **`GET /api/idv/sessions/{id}/proof`** (added to `_sessions`'s tail dispatch, so it
inherits the exact `require_console` + `require(act, "viewer")` gate every other `/api/idv/sessions/*`
route gets from `_console`'s dispatcher before routing reaches `_sessions` — no separate gate was
written) serves the bytes with a forced mime off the row, `x-content-type-options: nosniff`,
`cache-control: private, no-store`, and an audit row (`media.fetched`), same as `_media_route`. **The
POS path needed no new route or auth mechanism at all.** Traced through `pos/checkin-verify-seam.jsx`:
the check-in seam already authenticates as a console actor — it calls `GET /api/idv/workflows` and
`POST /api/idv/sessions` under the same shared console PIN/token every analyst screen uses
(`localStorage['hw-console-token']`, one PIN entered once in the Verify app unlocks the counter too,
per the seam's own "THE PIN GATE, AS THE COUNTER SEES IT" comment). There is no `/api/idv/pos/*`
namespace anywhere in this codebase — `checkin_api.py`'s `/api/identity/verify` age-gate module is a
separate system entirely. So `session.proof_url` on the same console-gated `GET /api/idv/sessions/
{id}` the seam is already positioned to call, fetched with the same console credential it already
holds for the two calls above, **is** "a route the POS can fetch with that same auth" — no second
endpoint, no second auth path, no `POS-Admin` file touched.

**C. Medical-rec skip (gap B).** New route **`POST /api/idv/capture/{token}/skip`** body
`{"step": "medical_rec"}` — only `medical_rec` is skippable (`_SKIPPABLE_STEPS`); every other step's
only honest answer is a photograph. Runs through the **exact same** `_count_attempt` machinery
`_capture_media` uses for a real upload: the counter advances only while the session is actually
`Awaiting User`/`Resubmitted` **and** waiting on `medical_rec` specifically (`_awaiting_step`) — a
skip sent before anything asked to redo the step, or for a step nobody is waiting on, records nothing,
the same rule an unsolicited upload would follow. When it does advance, it lifts the session back to
`In Progress` the same way an evidence upload does (this IS the guest's answer to the step), is
audited (`capture.skipped`) and evented, and is refused **409** on a finished session
(`_refuse_if_finished`, the same guard `_capture_media` and `_update_data` already carry). It never
touches `idv_media` — no bytes, no sniff, no storage. This closes the exact gap measured in
`med18-brief.md`: before this route existed, `POS-Admin/idv/capture.jsx`'s "I don't have one" choice
called `onUploaded(step)` locally and advanced with **no request at all**, so `attempts.medical_rec`
never moved and a guest with no recommendation recomputed `attempt=1` on every submission forever —
`idv_rules.py`'s 3-try `MED_REC_MISSING` → `UNDER_AGE` exhaustion (`idv_rules.py:4022-4041`) was
unreachable through this path. No change to `idv_rules.py` was needed or made: the exhaustion logic
already existed and was already correct — it simply never received a third attempt to exhaust.

**D. `qa/idv_med18_replay.py` — proved end to end, not just at the API layer.** `qa/idv_api_probe.py`
pins `idv_rules` with a reference stub (see its own docstring), so it cannot prove the skip's actual
effect on the 3-try exhaustion — only that the route's own mechanics (attempt counting, status
lifting, gating) behave correctly against a stubbed rules interface (`AP-189a`..`AP-189d`). This new
script is a standalone replay, over **real HTTP** on a spare local port (`127.0.0.1:8798`, a minimal
`http.server.HTTPServer` wrapping `idv_api.handle` directly — not `wmdemo/server.py`, which wires
unrelated POS/incentives/check-in machinery this test has no use for), against the **real, unstubbed**
`idv_rules.py`, using a real-shaped fixture built from `qa/fixtures/idv/
engine-callback-real-session9-2026-09-09.json` (a genuine captured hw-engine callback) with its two
unrelated findings neutralised (a glare warning, a `barcode_vs_ocr` name mismatch) and the identity
retargeted to a synthetic AAMVA barcode DOB of `2006-05-01`. Three sessions, three real workflows,
real `/capture/{token}/skip`, `/submit` and signed `/webhooks/engine` calls:

  - **(a)** `REC_21`, `offer_medical_path: false` → **one** submission, `Declined`, reasons
    `["UNDER_AGE"]`, `next_step: "in_store"` (hosted channel) — no medical offer at all, confirming
    the age gate still declines outright when the medical path is not open.
  - **(b)** `MED_18_REC` (required regardless of actual age) with a valid, matching recommendation
    node (CA-licensed, name/DOB matching the ID, current) → **one** submission, `Approved`, empty
    `review_reasons`, the stored decision carrying the `2006-05-01` identity the age gate actually
    judged.
  - **(c)** `MED_18_REC`, the guest calling `skip` before each of three submissions and never
    uploading a recommendation (the `medical_recommendations` key is **absent** from the decision
    entirely on every round — the real engine never sends an empty array, per
    `idv-engine/app.py:875-881`, "looked for, not found" is a different claim than "not looked for")
    → rounds 1–2 pause `Awaiting User` on `medical_rec` with the guidance `attempt` field reading 1,
    then 2; round 3 exhausts the 3-try cap and declines `Declined` with reasons
    `["UNDER_AGE", "MED_REC_MISSING"]` — `UNDER_AGE` leading, `MED_REC_MISSING` kept as the detail,
    exactly as `idv_rules.py:4022-4041` specifies. `attempts.medical_rec` reads `2` at the final round
    (the counter advances on the SKIP that answers an open `Awaiting User`, not on the submission
    that opens one — `attempt = _attempts_for(...) + 1` is what reaches 3), which is the concrete,
    end-to-end proof that gap B is closed: before the skip route existed this same sequence would sit
    at `attempt=1` on every one of the three rounds and never decline.

All four assertions (`MED18-A`, `MED18-B`, `MED18-C`, `MED18-C.guidance`) pass on a clean run,
verified twice for flakiness. Not registered in `qa/battery.py`'s `EXPECTED_CHECKS` — it is a
standalone replay against a real HTTP server on its own port, not an in-process battery-style suite —
run it directly: `python3 qa/idv_med18_replay.py`.

**Probes: before → after.** `idv_store_probe` 78 → 80 (+2: `ST-79a` `st.full_name` +
`barcode_identity`'s `middle_name` extraction, `ST-79b` `upsert_person`'s fill-blanks-only rule for
it). `idv_api_probe` 190 → 201 (+11: `AP-185`/`AP-185b`/`AP-185c` middle name end to end — console
display name, `person_out`, the `/v2` kyc block's corrected `full_name`, the PDF, an analyst
correction; `AP-186`/`AP-186b`/`AP-187`/`AP-188` the proof image — stored, served, gated, validated,
excluded from every evidence/engine-job mechanism; `AP-189a`..`AP-189d` the skip endpoint). Existing
`AP-57` (the `/v2` kyc key set) updated in place to include `middle_name` rather than left to drift
into a false failure. `idv_rules_probe` unchanged at 420/420 and `idv_import_probe` unchanged at
78/78 — neither file was touched this pass. All four run green, standalone, on this tree, plus the
new `qa/idv_med18_replay.py` (4/4). `qa/battery.py`'s `EXPECTED_CHECKS` and `TOTAL_CHECK_FLOOR`
(2376 → 2389) were updated to match, each with a dated comment.

**Not done by this pass, and not silently assumed.** The engine half (splitting a licence's DAD or a
passport's MRZ given-names-beyond-the-first into `middle_name` — today's fixtures still carry it as
`None`, and `AVERY QUINN` still arrives crammed into a single `first_name` on the one real fixture
this pass inspected for shape; correctly splitting that is the engine's field to fill, not the
backend's to guess at) and the capture-page half (the `POS-Admin/idv/capture.jsx` "I don't have one"
choice actually calling `POST .../skip` instead of only advancing locally) are separate agents' work
against this same contract and were not touched here.

## Addendum — 2026-09-10 (r9): verification timing, the aggregate view, and the ID-only workflow

Built to `mrz-contract.md`'s "Addendum 3" section (link-opened → decision timing, per-step and
retake-loop breakdown, the `GET /stats/timing` aggregate, and the "Cannabis Verification — ID only"
workflow). `wmdemo/idv_store.py` + `idv_api.py`; `idv_rules.py` untouched except by proof — the
feature-gating (`"LIVENESS" in features`, `"FACE_MATCH" in features`) that makes an ID-only session
approve on front+back alone already existed and needed no change, only a workflow that actually
declares the narrower feature set. Field names below are **frozen** — the console agent building the
timing screens works against these in parallel and did not see this pass's code.

**A. `opened_at`/`device_os`/`device_browser`, stamped once.** Three new `idv_sessions` columns
(`TEXT`, all nullable, added by the same guarded `ALTER TABLE ... ADD COLUMN` mechanism as
`document_type` before them — `_ADDED_COLUMNS`/`_add_missing_columns`, `PRAGMA table_info`-checked).
`opened_at` is written **only** inside `idv_api._capture`'s `action == "state" and method == "GET"`
branch, and only when the column is still null on that session's row — "the first capture `GET state`
this session ever answers", never overwritten by a reload, a poll, or the guest coming back later.
`device_os`/`device_browser` are parsed off that **same request's** `User-Agent` header in the same
write and never touched again either. A `session.opened` audit row is written alongside (`via:
"system"`, `detail: {device_os, device_browser}`) — once, not once per poll, proved by `AP-193`
calling `state` twice with two completely different User-Agents and asserting the second call changed
nothing.

`idv_store.parse_user_agent(ua) -> (os, browser)` is a small, pure, stdlib-only parser (`re` only —
the owner rule "zero third parties at runtime" applies to a backend helper as hard as it does to the
capture page). Recognises iOS/Android/macOS/Windows for the OS half (`"iOS 18"`, `"Android 14"`,
`"macOS 14"` — real newer macOS, or `"macOS 10.15"` for a browser still under Apple's
backward-compatibility version freeze, `"Windows 10"` — NT 10.0 covers both Windows 10 and 11, the
platform stopped bumping the NT number, and no UA string can tell them apart) and
Safari/Chrome/Firefox/Edge/Samsung Internet for the browser half, in an order that matters: Samsung
Internet and Chromium Edge both carry a `Chrome/` token, and **every** WebKit-based browser (Chrome
and Firefox on iOS included, since Apple requires them to embed WebKit there) carries a `Safari/`
token — the specific markers (`SamsungBrowser/`, `Edg/`/`EdgA/`/`EdgiOS/`, `CriOS/`, `FxiOS/`) are
checked first and `Safari` is the fallback of last resort, taken only when nothing more specific
matched **and** the UA carries `Version/`, which a browser merely embedding WebKit does not. Returns
`(None, None)` for empty, missing or unrecognisable input rather than guessing. 12 fixtures in
`qa/idv_store_probe.py` `ST-80`, one per platform/browser pairing plus three "answers nothing" cases.

**B. `st.session_timing(conn, session_id)` — one function, computed from timestamps that already
exist.** Reads `idv_sessions` (`created_at`, `opened_at`, `completed_at`, `attempts`), `idv_media`
(`kind`, `captured_at`) and `idv_decisions` (`version`, `status`, `computed_at`); a `capture.skipped`
audit row closes a step exactly like a media capture would (the contract's "media captured_at / skip
audit rows" together — `ST-83`). Returns
`{opened_at, decided_at, total_s, before_open_s, steps: [{step, first_s, last_s, attempts}], base_s,
retake_s, retakes}`. `decided_at` is the session's own `completed_at` when `status` is
`Approved`/`Declined`, else `None` — an Abandoned or Expired session has no engine decision to time.
`total_s`/`before_open_s`/`base_s` and every step's `first_s`/`last_s` are seconds **since**
`opened_at` (or, for `before_open_s`, `created_at` → `opened_at`) and are honestly `None` whenever
`opened_at` itself is unknown — a session decided before this column existed, or one whose link was
never opened at all. **`retake_s`/`retakes` need no absolute reference point** and are computed even
without `opened_at`: for every decision in the chain whose `status` is `Awaiting User`, find the
**next** capture/skip event after its `computed_at` and sum `(that event − the decision)`; this is
what let `ST-87a` validate the real owner passport session
(`22530969820a411e872b508584ec1dc0`, frozen into `qa/fixtures/idv/
session-timing-real-2026-09-10.json` rather than read live from `scratch/idv-phone/
wmdemo-idv-phone.sqlite3` — same reason `qa/idv_rules_probe.py` freezes its own real callback into a
fixture instead of reading a live file) against real data with **no** `opened_at` on the row at all:
two `MRZ_NOT_FOUND` retake loops, 6s then 4s, `retakes: 2`, `retake_s: 10` — computed from nothing but
the real decision and media timestamps. A step's `attempts` prefers the session's own per-step
counter (`idv_sessions.attempts`) over the raw capture count when the session has one — the real
passport session shows `document_front: 2` on its counter against **three** physical captures, and
`session_timing` reports 2, trusting the counter the rules engine itself advances rather than
re-deriving a different number from the media table (`ST-87b`).

`timing_json` (a fourth new `idv_sessions` column) is `session_timing`'s own output, **cached at the
terminal decision** (`idv_api._engine_callback`, immediately after the `Approved`/`Declined` fields
are written) so `GET /sessions` does not recompute the full breakdown for every row in a list.
`idv_store.timing_for_session(conn, session_row)` is the read-side pair: the cached JSON verbatim when
one is on the row, a live `session_timing` call otherwise — "recomputed on read for older rows", the
fallback path a session decided before this cache existed (or not yet decided at all) takes
(`ST-84`).

**C. `GET /api/idv/sessions/{id}` and list rows.** `session_summary` (shared by every list call and
overridden by `_session_detail` for the single-session read, same pattern `workflow` already uses —
a two-key stub in the list, the full resolved object in the detail) now carries
`"timing": {"total_s": ...}` in every row; `_session_detail` replaces it with the full
`timing_for_session(...)` object. `AP-194` proves the two numbers agree because both read the same
cached `timing_json`.

**D. `GET /api/idv/stats/timing`** (console gate + viewer role — the standard `require_console` +
`require(act, "viewer")` every other `/api/idv/*` console read already sits behind, no separate gate
written). Query params exactly as specified: `from`/`to` (ISO, `to` widened to end-of-day the same way
every other windowed read in this codebase is — `day_upper_bound`), `preset` (`24h|7d|30d|90d`,
400 on anything else), `bucket` (`day|week`, 400 on anything else), `age_band`/`sex`/`state`/`os`/
`browser` (all optional, all narrow the population before anything is aggregated), `include_open=1`.
Population: `idv_store.sessions_for_timing` — decided (`Approved`/`Declined`) sessions whose
`completed_at` falls in the window, **plus**, only when `include_open` asks for it, undecided
sessions whose `opened_at` falls in the same window (there is no `completed_at` to have filtered an
undecided session by). Demographics for the `age_band`/`sex`/`state` filters and breakdown come off
the session's own latest decision exactly as specified — age band from `date_of_birth` at
`decided_at` (a new `_age_band_at` helper in `idv_api.py`, distinct from the older, coarser
`_age_band` the dashboard already has — different bucket scheme, not reused), sex from
`gender` (already denormalised onto `idv_decisions` from barcode DBC/MRZ, no new column), state from
`issuing_state`. `os`/`browser` come off the session's own `device_os`/`device_browser` (§A), not off
anything in the decision. `median`/`mean`/`p90` are computed in **pure Python** — linear
interpolation, no numpy, no third party — over `total_s`/`base_s`/`retake_s`/`before_open_s` for the
decided population, and per-step over each step's `last_s` for the `steps` breakdown; validated
against a five-value fixture (`total_s = 10/20/30/40/50`) whose p90 (46, interpolated 40% of the way
from the 4th to the 5th value) is not any single sample — proof the interpolation actually ran and did
not just return the max (`AP-196a`). `buckets` groups by `decided_at`'s calendar day, or the Monday
that starts its ISO week for `bucket=week`. `breakdown` groups the same decided population by each of
the five dimensions, `{count, median_s}` per value — the shape the contract's own example response
shows.

**E. A real defect this pass found and fixed while seeding a features-diminished workflow for the
first time.** `idv_api._capture_state`'s `challenge` step was gated on `cfg.get("face_liveness_method")
in ("ACTIVE_3D", "FLASHING")` **alone** — not on `"LIVENESS" in features`, unlike every other step in
that function. Every workflow before this pass either had LIVENESS on with `face_liveness_method` set,
or LIVENESS off with `face_liveness_method` never populated in practice, so the gap was latent. The
ID-only workflow (§F) is seeded from `DEFAULT_WORKFLOW_CONFIG` verbatim except for `features` — there
is no ID-only-specific config to invent, and the contract does not ask for one — so it still carries
`face_liveness_method: "ACTIVE_3D"`, and without this fix its capture page would have been told to
record a blink clip that `idv_rules._liveness_block` (correctly gated on `"LIVENESS" in features`
already) would never have looked at. Fixed by adding the same `"LIVENESS" in (wf["features"] or [])`
guard the `selfie` step already carries a few lines up. Caught by `AP-195` before it reached a
fixture, not discovered later.

**F. The ID-only workflow.** `idv_store.seed_id_only_workflow(conn)` — idempotent **by name**
(`ID_ONLY_WORKFLOW_NAME = "Cannabis Verification — ID only"`, exact string including the em dash),
wired into `run_data_migrations` (so an already-running install gets it on its next request, the same
way `calibrate_workflow_thresholds`/`migrate_challenge_scripts` reach an existing database) rather
than into `seed()` (which only ever creates the rows a fresh install needs before the migrations that
act on them run). Features `["OCR", "IP_ANALYSIS"]` — no LIVENESS, no FACE_MATCH, no AGE_ESTIMATION —
`config` is `DEFAULT_WORKFLOW_CONFIG` verbatim (so it rides the exact same calibrated thresholds
(§r6/r7) the default workflow does; there is nothing ID-only-specific to calibrate). "Front + back
only, no selfie" needed **zero new gating logic**: `idv_api._STEP_FOR_FEATURE` already only offers
`document_front`/`document_back` (from `OCR`) and `selfie` (from `LIVENESS`), so a workflow missing
LIVENESS already listed just the two document steps once §E's fix landed (`AP-195`), and
`idv_rules._liveness_block`/`_face_block` already no-op without their features (proved two ways in
`qa/idv_rules_probe.py`: `IDV-N01` a clean front+back approves with no liveness/face/face_search node
in the engine body at all, and `IDV-N02` — the one that cannot be faked by an engine that forgot to
leave those nodes out of its own response — the **same** workflow still Approves when the engine body
carries FAILING liveness/face/face_search nodes, because it is the workflow's declared `features` that
disables those blocks, not merely their absence. `IDV-N03` confirms OCR and IP_ANALYSIS still decide
normally — an undecoded barcode is still `BARCODE_NOT_DETECTED`, a Tor exit is still `IP_TOR`;
dropping the selfie step never dropped the checks that remain switched on).

**Probes: before → after.** `idv_store_probe` 80 → 90 (+10: `ST-80` the User-Agent parser, `ST-81`/
`ST-82`/`ST-83` `session_timing` on hand-built fixtures — one clean pass, two `Awaiting User` retake
loops, a `medical_rec` skip — `ST-84` `timing_for_session`'s cache-or-live fallback, `ST-85`
`sessions_for_timing`'s decided-by-`completed_at` vs. undecided-by-`opened_at`-with-`include_open`
population, `ST-86` `seed_id_only_workflow`'s idempotent-by-name creation, `ST-87a`/`ST-87b`/`ST-87c`
the real-data validation against the frozen passport + two licence sessions). `idv_api_probe` 204 →
210 (+6: `AP-193` `opened_at`/`device_os`/`device_browser` stamped once off the first `state` call,
`AP-194` the full timing object on `GET /sessions/{id}` vs. `total_s`-only on a list row, `AP-195` the
ID-only workflow's two-step capture state (this is also what caught §E), `AP-196a`/`AP-196b` the
stats aggregate's percentile math and its filters, `AP-197` preset/bucket validation). `AP-2`
(previously asserting exactly one seeded workflow at index 0) updated in place to find the default
workflow **by name** rather than by list position, because `seed_id_only_workflow` now seeds a second
row that sorts ahead of it by `created_at` — the same "updated in place rather than left to drift into
a false failure" treatment r8 gave `AP-57`. `idv_rules_probe` 427 → 430 (+3: `IDV-N01`/`IDV-N02`/
`IDV-N03`, §F). `idv_import_probe` unchanged at 78/78 — not touched this pass. All four run green,
standalone, on this tree: 430/430, 90/90, 210/210, 78/78. **`qa/battery.py` was not touched by this
pass** (another session held uncommitted hunks there at the time) — its `EXPECTED_CHECKS` needs
`"idv_rules_probe": 427` → `430`, `"idv_store_probe": 80` → `90`, `"idv_api_probe": 204` → `210`
(lines 2774/2811/3061 on the tree this pass read), and `TOTAL_CHECK_FLOOR` needs `2707` → `2726`
(+19, matching the three deltas above), each with a dated comment in the style every prior pass's
entry there already uses.

**Not done by this pass, and not silently assumed.** No console/UI work: the timing screens
(`POS-Admin/idv/*` reading `session.timing`, a new dashboard tile for `GET /stats/timing`) are the
console agent's own work against these frozen field names, built in parallel, and this pass never
touched a `.jsx` file. The `steps` breakdown in `GET /stats/timing` reports median/p90 of each step's
`last_s` (when a step is captured more than once, the LAST capture — its final, accepted answer) —
the contract does not say which of `first_s`/`last_s` the aggregate should read, and `last_s` was
picked as the one that answers "how long until this step was actually settled"; `first_s` is still
available per-session for whoever wants "how long until the guest first attempted it" instead. No
backfill: `timing_json` is populated only going forward, at each session's own terminal decision — an
already-Approved/Declined session from before this pass reads its timing live via `timing_for_session`
(computed correctly, including `retake_s`/`retakes` with no `opened_at` at all — §B, `ST-87a`) rather
than from a one-time migration that back-populates the cache column for every historical row.

## Addendum — 2026-09-10 (r10): jurisdictions, and a persistence bug the PDF agent found

Built to `mrz-contract.md`'s "Addendum 4" section (owner ruling, "expand outside California when the
business does") plus a real defect this pass fixed while it was in the neighbourhood. An `idv-engine`
agent built `idv-engine/pipeline/jurisdictions.py` and the engine-side `proof_type`/`jurisdiction` node
fields in parallel and is not this pass's own work; everything below is `wmdemo/idv_jurisdictions.py`
(new), `idv_rules.py`, `idv_store.py`, `idv_api.py`, the three `qa/idv_*_probe.py` files, and
`POS-Admin/idv/screen-workflows.jsx` / `screen-session.jsx` / `screen-sessions.jsx`.

### A. `wmdemo/idv_jurisdictions.py` — the mirror on this side

One table, keyed by two-letter state code, same shape as the engine's:
`{name, rec_age, med_age, medical_proof, physician_license_patterns, medical_card_patterns, notes}`.
The 50 states + DC. Only `CA` is **configured** (a non-empty pattern list for its own `medical_proof`
type) — copied byte for byte from what `idv_rules.MED_REC_LICENSE_PATTERNS` held before this table
existed (`IDV-J07` asserts the two are still identical through `idv_rules.license_kind`). Every other
entry is present (so `codes()` always answers "what jurisdictions exist" the same way) but
**unconfigured**: empty pattern lists, `medical_proof: "state_medical_card"` as the honest DEFAULT
assumption (most states issue a registry card, not a physician letter), and a `notes` sentence saying
exactly that. `configured(code)` checks the pattern list that MATTERS for that state's own
`medical_proof` — not a blanket "any pattern present" — which is the predicate that keeps a
registry-card state's empty `physician_license_patterns` from reading as unconfigured once it does have
a `medical_card_patterns` list. `normalise(value)` never raises (bare code, full name in any case, or
garbage → falls back to `DEFAULT_JURISDICTION`, "CA") — the console validates on write instead (§D);
this function's job is a pure workflow-config read that must never crash a decision.

**THE ONE DOCUMENTED EXCEPTION to `idv_rules.py`'s "no imports from any other wmdemo module."** This
module is equally pure — no I/O, no database, no clock, no network, just a table and some regex
compilation — so `idv_rules.py` imports it (`from . import idv_jurisdictions as jur`) without
compromising the property that rule actually protects (a rules module `qa/idv_rules_probe.py` can test
without a server). The module docstring on both sides records this explicitly rather than silently
breaking the stated invariant.

### B. Everywhere California was hard-wired, now reading `cfg["jurisdiction"]`

`idv_rules._CONFIG_DEFAULTS["jurisdiction"]` defaults to `idv_jurisdictions.DEFAULT_JURISDICTION`
("CA"); `_cfg()` normalises whatever a workflow's stored config carries through `jur.normalise` on
every read, so a garbled or absent value never reaches the rules as anything but a real table key.
`_medical_block` (~24 sites, per the addendum's own estimate — the AAMVA barcode state-name table at
`idv_rules.py`'s `_US_JURISDICTIONS`/similar is a DIFFERENT question, "what does this two-letter code
mean on a barcode", and is untouched):

  - **Step 0, new:** before a node is even read, `jur.configured(jurisdiction)` — an unconfigured
    jurisdiction declines `MED_REC_JURISDICTION_UNCONFIGURED` immediately, no capture required, because
    a state with no verified pattern can never pass step 2 however clean the photograph is. Asking the
    guest to try anyway would spend a real attempt on a session that cannot Approve.
  - **Step 1** (`license_state` match) compares against `jurisdiction`, not the old `MED_REC_STATE`
    module constant.
  - **Step 2** (`license_kind`) now takes an optional `jurisdiction` argument (defaults to
    `DEFAULT_JURISDICTION`, so every caller written before this pass — including
    `qa/idv_rules_probe.py`'s `LICENCE_CASES`, one argument, unchanged — keeps reading California's
    patterns with no edit) and reads `idv_jurisdictions.credential_kind` instead of a hard-coded tuple.
  - Guest-facing `GUIDANCE` text for `MED_REC_OUT_OF_STATE`/`MED_REC_INVALID_LICENSE`/`OUT_OF_STATE`
    no longer names California specifically (that dict has no per-session argument — the one other
    reader, `idv_pdf.compliance_pdf`, looks it up by bare reason code) — generalised to "the state we
    operate in" / "the configured jurisdiction's pattern"; the DECLINE's own `explain` text, which does
    have the session's `jurisdiction` in scope, still names the actual state.
  - `MED_REC_JURISDICTION_UNCONFIGURED` joins `REASONS_DECLINE`; its `GUIDANCE` entry gives the
    in-store path ("bring your physical ID and recommendation to any Hyperwolf store") the same way
    every other hard medical decline already does — `_fallback_next_step` (unchanged) still resolves
    that to `next_step: "in_store"` online, `"none"` at the register.

Recreational (REC_21, not offered the medical path) sessions are completely unaffected: `_medical_scope`
still gates on age alone, and an unconfigured jurisdiction is only ever read once `_medical_block`
decides the session has something to do with the medical path at all — exactly the "rec sessions keep
working in any state from the barcode DOB" the addendum asks for. `IDV-A73b`/`A73c` prove the
unconfigured decline (no node needed, and a full node that would otherwise pass every other check does
not save it); `IDV-A73d` proves a full state NAME in config normalises the same as a bare code.

### C. The cross-service agreement probe

`qa/idv_rules_probe.py`'s `IDV-J01`..`J09` load `idv-engine/pipeline/jurisdictions.py` **read-only**, by
file path (`idv-engine` is a hyphenated directory name and cannot be a normal Python import — same
`importlib.util.spec_from_file_location` trick this file already uses to read fixture JSON without a
server, applied to Python source instead) and assert: the same 51 keys, the same configured set, the
same `ENTRY_KEYS`, CA's `rec_age`/`med_age`/`medical_proof` and its two `physician_license_patterns`
regex SOURCE STRINGS byte-identical, CA's own patterns still matching what
`MED_REC_LICENSE_PATTERNS` held before this table existed, and every OTHER state's
name/ages/configured-ness agreeing. This is the check the addendum's own promise — "adding a state
later is filling in that state's entry in the two tables and nothing else" — depends on: if the two
tables ever disagree about which states are configured, the engine could "Approve" a node these rules
decline, a failure that would only be visible after a guest stood at a counter.

### D. Workflow config: `jurisdiction`, validated on write, migrated forward

`idv_store.DEFAULT_WORKFLOW_CONFIG["jurisdiction"] = idv_jurisdictions.DEFAULT_JURISDICTION` — explicit
on a freshly-created workflow, the same convention every other config default in that dict already
follows, rather than left to `_cfg`'s own default three modules away.
`idv_store.migrate_workflow_jurisdiction(conn)` — idempotent BY CONTENT-STAMP
(`jurisdiction_migrated: "2026-09-10"`), same shape as `migrate_challenge_scripts`/
`calibrate_workflow_thresholds` before it, wired into `run_data_migrations` — gives every EXISTING
workflow an explicit, normalised `jurisdiction` as a NEW VERSION (so the console's "workflow as this
session pinned it" screen can show it for old sessions too). It changes no session's decision: `_cfg`
already defaulted a missing key to the identical value at read time. Once a row carries the stamp, a
later console edit to `jurisdiction` is left alone by the migration — it backfills absence once, it does
not re-normalise on every request (`ST-88b`).

`idv_api._normalised_workflow_config(cfg)` runs `jur.normalise` on `config.jurisdiction` on every
`POST /workflows` and `PATCH /workflows/{id}` whose body actually carries the key — "validated against
the table" happens at the write, not only defaulted at the read, so a console admin's own typo (a
lower-case code, a full state name, an unrecognised string) is cleaned before it is stored rather than
echoed back later as whatever they typed (`AP-164d`..`f`). A PATCH that omits `config` entirely is a
no-op for this field (`AP-164g`) — leaving a workflow's config untouched must not force a value through
the normaliser with nothing to normalise.

`prepare_engine_job`'s job body carries `jurisdiction` as a top-level convenience field (normalised),
the same relationship `document_type` already has to the session row it also echoes — the engine
already receives the full value inside `workflow.config.jurisdiction` too, since that dict passes
through whole.

### E. The persistence bug (found by the PDF-review agent working the console in parallel)

`idv_decisions` had a column for `id_verifications`/`liveness_checks`/`face_matches`/`face_searches`/
`ip_analyses`/`age_estimations`/`questionnaire_responses` — every node array the engine's callback
`decision` object carries **except** `medical_recommendations`, a sibling key of `id_verifications` on
that same object. `insert_decision` simply never stored it, so `GET /api/idv/sessions/{id}` could not
show the recommendation the engine actually read, and `POS-Admin/idv/screen-session.jsx`'s `medRec`
constant — which has read `decision.medical_recommendations[0]` since the 2026-09-09 gap-C pass —
always saw an empty array. The only place the node survived was the raw callback body
`_engine_callback` has always logged onto `idv_session_events.payload`; the PDF route's
`_latest_medical_rec` scanned that log backwards as a workaround, and the console screen simply had no
data to read at all.

**Fixed**: `idv_decisions.medical_recommendations TEXT`, added the same way `middle_name` was (in the
`CREATE TABLE IF NOT EXISTS` for a fresh database, AND in `_ADDED_COLUMNS`/`_add_missing_columns` for
an existing one — `ST-56b` proves the ALTER path on a database whose `idv_decisions` predates the
column). `insert_decision` now reads `nodes.get("medical_recommendations")` — already present on its
`nodes` argument, no new parameter needed, because `nodes` IS the callback's raw `decision` object —
and stores it verbatim, denormalised nowhere (`ST-13b`/`ST-13c`). `idv_api.decision_out` returns it
(defensively, `dict(d).get(...)` rather than `d[...]`, for a Row read before the ALTER ran); `_pdf_extras`
/ `_latest_medical_rec` now takes the session's latest decision row and reads the column FIRST,
falling back to the event-log scan only when the column is empty — the fallback is KEPT, not removed,
for decision rows written before this fix (`AP-210f` proves it explicitly, by blanking the column on a
real decision and confirming the PDF still finds the node). `screen-session.jsx`'s `medRec` line did
not have to change at all to pick this up — it was already reading the right field on the right object,
the object just never carried the data.

### F. Console: `POS-Admin/idv/*`

`screen-workflows.jsx`: a `<select>` (the 50 states + DC, `JURISDICTIONS`/`JURISDICTION_NAME` constants
mirroring the two Python tables' keys and names) in the Age rule Card, one sentence on what it changes
(the out-of-state comparison and the medical-proof rule; a REC_21 guest is unaffected), and a warning
line naming the state when the selected jurisdiction has no configured medical-proof pattern —
`JURISDICTION_CONFIGURED` is a literal `Set(['CA'])` here, not fetched, because a state's pattern
landing is a code change on both Python sides already, not a runtime toggle this screen could read.
`screen-sessions.jsx`: the Workflow column's list-row cell gains a small `jurisdiction` line under the
name/version, and the CSV export gains a `jurisdiction` column. `screen-session.jsx`: a "Jurisdiction"
row in Session facts (`sess.jurisdiction`, pinned to the session's own workflow version, same as every
other fact in that card); `MED_REC_REASON_TEXT` gains `MED_REC_JURISDICTION_UNCONFIGURED` and the two
California-specific sentences (`MED_REC_OUT_OF_STATE`/`MED_REC_INVALID_LICENSE`) are generalised to not
name a state that may no longer be the workflow's configured one. The Doctor's recommendation card's
`medRec` line needed no change — see §E.

`idv_api.session_summary` (the list-row shape) and `_session_detail` (the override, pinned-version
accuracy) both gain `jurisdiction`, same pattern the `workflow`/`timing` fields already use: the list
row reads the CURRENT workflow's config (one extra `config` column on the same query that already reads
`id, name` — no new query), the session detail overrides it with the PINNED version's own value
(`AP-164b`/`c` prove the list-row approximation and the detail's pin separately — moving the live
workflow to a different jurisdiction after a session was created leaves that session's own detail
unmoved, the identical invariant `AP-163`/`AP-164` already proved for thresholds and features).

### Probes: before → after

`idv_rules_probe` 430 → 443 (+13: `IDV-A73b`/`A73c`/`A73d` the unconfigured-jurisdiction declines and
the full-state-name normalisation, `IDV-J01`..`J09` the cross-service table-agreement probe against the
engine's read-only file). `idv_api_probe` 227 → 236 (+9: `AP-164b`/`c` jurisdiction on the list row and
the version pin, `AP-164d`..`g` write-side validation and the config-omitted no-op, `AP-210d`/`e` the
persistence fix proved through the console read, `AP-210f` the event-log fallback proved by blanking
the column on a real row). `idv_store_probe` 90 → 95 (+5: `ST-13b`/`c` `medical_recommendations`
round-tripping through `insert_decision`/`get_decision`, `ST-56b` the ALTER path on a database whose
`idv_decisions` predates the column, `ST-88`/`b` the jurisdiction migration's backfill and its
idempotent-by-stamp behaviour on an already-migrated row). `idv_import_probe` unchanged at 78/78 — not
touched this pass. `node --test test/global-collisions.test.mjs` unchanged at 17/17 (no new top-level
name landed on a page that already declares it). All five run green, standalone, on this tree: 443/443,
236/236, 95/95, 78/78, 17/17.

**`qa/battery.py` was not touched by this pass**, per this pass's own scope — its `EXPECTED_CHECKS`
already carried stale numbers before this pass started (`"idv_rules_probe": 427`, `"idv_store_probe":
80`, `"idv_api_probe": 204` — r9's own note said these needed bumping to 430/90/210 and that bump never
landed), so the honest instruction for whoever next touches that file is: read the CURRENT live numbers
off each probe's own `main()` (not off this addendum, which will itself go stale) before writing new
ones in, and update `TOTAL_CHECK_FLOOR` by the sum of every drift since the register was last true, not
only this pass's own +27.

### Not done by this pass, and not silently assumed

The engine-side OCR reader's `state_medical_card` label set (patient name, DOB, card/registry number,
expiry, issuing state) is the parallel `idv-engine` agent's own work, not read or verified here — this
pass's probes exercise only the two jurisdiction TABLES agreeing with each other, never the engine's OCR
extraction for a state that has no configured pattern to extract against yet. No state beyond California
is actually configured: adding one is still "fill in that state's entry in both Python tables, add its
console option's `JURISDICTION_CONFIGURED` membership" and nothing else structural, exactly as the
addendum promises, but nobody has done that filling-in for a second state in this pass. The `OUT_OF_STATE`
(non-medical, document-issued-elsewhere) finding was left alone beyond its guidance sentence's wording —
its actual decision (`cfg["out_of_state"]` policy) was never California-specific engine-side logic to
begin with, so there was nothing to make jurisdictional there.
