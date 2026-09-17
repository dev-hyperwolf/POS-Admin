---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 60
files_allowed: wmdemo/forms_seed.py qa/forms_batch2a_probe.py
verify_command: cd /Users/jt/wm-demo && python3 qa/forms_batch2a_probe.py
---

# Goal

Port two of the Batch-2 forms from
`docs/migration/FORMS-MIGRATION-MATRIX-2026-09-17.md` §C into
`wmdemo/forms_seed.py` as real `FormDef`s: **#1 Employee edit** and
**#3 Upload employee doc**. When this is done, `forms_seed.py` has two new
definitions (seeded, publishable, submittable) whose fields, whitelist, and
validation match the live GAS source exactly, and a new probe proves it —
following the same pattern `qa/forms_batch1_probe.py` already established
for the eight Batch-1 forms.

# Important: verify the premise before you build anything

The migration matrix's own gap analysis (§B, lines ~69-72 and ~109) claims
Employee edit and Upload employee doc need a not-yet-built "PII-masked
field" generator feature (gap 2) before they can be ported. **That claim
does not match the live GAS source for these two specific forms** — verify
this yourself before writing any code:

- Employee edit's real, live editable-field whitelist is
  `_waveBEditFields_()` in the onboarding GAS project's `Server.js` around
  line 5164-5176: `phone` (text), `email` (email), `address` (a single
  **multiline** text field, NOT the composite street/city/state/zip the
  matrix's gap-1 note assumes), `location` (select), `titles`
  (multiselect). No SSN, no DL, no PII-restricted field anywhere in this
  whitelist — the comment right there even says "Deliberately NOT
  editable: Status, Employer link, REPORTS_TO... Unknown keys are
  refused." The function that uses it, `updateEmployeeDetails` (line
  5195), confirms the same five keys.
- Upload employee doc's whitelist is `_waveBDocFields_()` around line
  5364-5376: `docKey` ∈ `{dl, insurance, registration}` (a **select** of
  which attachment slot to fill — the string "dl" is just a slot name here,
  not an SSN/DL text field) plus one file (`uploadEmployeeDoc`, line ~5391:
  base64 + fileName + mimeType, 5 MB cap, mime whitelist
  `image/jpeg|png|gif|webp|heic, application/pdf`).

Both forms are fully expressible with field types `wmdemo/forms.py`
**already implements today**: `text`, `email`, `textarea` (matches GAS's
"multiline"), `select`, `multiselect`, and `files`/`photo` for the upload
(check `wmdemo/forms.py`'s `FIELD_TYPES` tuple and `_field_schema` to
confirm which of `files` vs `photo` is the right fit for a single
image-or-PDF upload — read how `LP_DRIVER_RESPONSE`/other Batch-1 forms in
`forms_seed.py` use whichever type handles a single attachment, and match
that pattern). **No PII-masked field type, no composite address type, and
no new generator feature should be needed for either form.** If, once you
actually try to model these two forms, you hit a real wall that requires
a generator feature that doesn't exist yet — stop, do not build a
workaround, and write up exactly what's missing in your report instead.
This form touches an employee record (Employee edit) and identity documents
(upload) — if you find real PII/SSN/DL exposure that the source above
doesn't show, that is a judgment call outside this brief's scope, not
something to paper over.

# Hard rules

- Never touch any `.env` file.
- No git commands that write — the PM commits after review.
- Only create/edit: additions to `wmdemo/forms_seed.py` (new `FormDef`
  constants + adding them to whatever tuple/list Batch 2 forms belong in —
  follow the existing `BATCH_1` pattern, name it sensibly, e.g. a new
  `BATCH_2A` if that reads naturally next to it) and a new
  `qa/forms_batch2a_probe.py`. Do not touch `wmdemo/forms.py`,
  `wmdemo/forms_api.py`, or `qa/battery.py` — if the probe needs to be
  registered in the battery for it to count, note that as a follow-up in
  your report rather than editing `qa/battery.py` yourself.
- Do not invent Airtable field ids or write real Airtable — this is the
  wmdemo sandbox; a `submit` entry of kind `table`/`airtable` targeting a
  local table is fine (follow the `SUBMIT_KINDS`/`EVENT_STATUSES` pattern
  already in `wmdemo/forms.py`), a real network call to Airtable is not.
- Any server/DB you use for testing: scratch DB, never `wmdemo.sqlite3`.
- Foreground run, `max_minutes` cap above.
- Never lower a check count anywhere; this is new code, so there's nothing
  to lower — just don't pad the probe with checks that don't check
  anything real.

# Steps

1. Do the premise verification above first. Read the two GAS source
   sections named, and read `wmdemo/forms.py`'s `FIELD_TYPES`,
   `_field_schema`, and `compile_schema` to confirm every field type you
   plan to use already exists and works today (not just declared in the
   tuple — check it's actually handled in `_field_schema`'s branches).
2. Read `wmdemo/forms_seed.py` top to bottom: the `WRITEUP`/`CLOSEOUT`
   examples (for the general `FormDef` shape) and the `BATCH_1` forms
   (for the "no generator feature needed" pattern this brief is extending).
   Match that style exactly — same level of comments, same structure.
3. Write the Employee edit `FormDef`: id something like `hr_employee_edit`,
   fields `phone` (text), `email` (email — check whether `forms.py` has a
   distinct `email` kind or whether `text` + a validator/pattern is how
   Batch-1 already does email-shaped fields, and match whichever is real),
   `address` (textarea), `location` (select — options can be a static
   placeholder list since the live picker is dynamic per
   `getEmployeeEditMeta()`, out of scope here; document that choice in a
   comment), `titles` (multiselect, same placeholder-options note). No
   field is required except `recordId`-equivalent identification if the
   generator needs one field always present — follow how Batch-1 forms
   handle "which record this is about."
4. Write the Upload employee doc `FormDef`: id something like
   `hr_upload_employee_doc`, fields `docKey` (select, options exactly
   `dl`/`insurance`/`registration`) and one file field (whichever type you
   confirmed in step 1 handles a single attachment), matching the 5 MB /
   mime-whitelist constraints as field-level validation if the generator
   supports declaring them, or as a documented gap in your report if it
   doesn't.
5. Write `qa/forms_batch2a_probe.py` following `qa/forms_batch1_probe.py`'s
   structure: seed idempotently + schema compiles, required-field
   enforcement, valid submissions pass, field types/options correct. Use
   the same `("FB2A-1", "description", test_fn)` runner pattern.
6. Run the new probe until it's fully green.

# Verify

```
cd /Users/jt/wm-demo && python3 qa/forms_batch2a_probe.py
```
Success: prints a summary with `Failed: 0`, and the printed `Total:` is a
real, non-zero, itemized count (not a single true/false).

# Report format

Write `qa/REPORT-04-forms_batch2_employee_edit_upload_doc.md` covering:
- confirmation of the premise check (field types used, and that none of
  them needed a new generator feature — or exactly what did, if anything)
- the two FormDefs added (paste their field lists)
- the probe's final output
- anything from the "hard rules" file-scope list you could not honor and
  why (should be empty)
