# Form Generator — Architecture Proposal

Read-only research. No code written. Sources: `contracts/index.js` (+ mirror
`wm-demo/wmdemo/contracts.py`), `shared/hd-ui.jsx`, `pos/atoms.jsx`, `pos/tokens.jsx`, and three
live GAS forms sampled with `grep -a`: `writeup-pipeline/IncidentPortal.js`,
`end-of-shift-portal/Form.html`, `onboarding/Index.html`.

## 1. The idea, one paragraph

A form is a saved JSON definition, not a hand-built screen: one renderer (`HDForm`) turns that
definition into a fillable screen, a printable sheet, and a validated API endpoint, wherever in
the admin we need one — so a write-up, a store closeout, an onboarding step, or a discrepancy note
is a data file, not a new HTML file with its own bugs.

## 2. FormDef shape

```
FormDef {
  id, version, title, active: bool
  sections: [{ id, title, showWhen?: Condition, fields: [Field], repeat?: RepeatSpec }]
  fields: Field[]        // Field reuses contract schema keywords directly:
    { key, type, label, required, $enum?, $ref?, pattern?, minLength?, minimum?, maximum?,
      nullable?, options?, showWhen?: Condition, computed?: string /* pure expr over other keys */ }
  types: text | number | money | date | time | select | multiselect | person | store |
         photo | signature | checklist | pin_stepup | repeating_group | section
  submit: { kind: 'event'|'table'|'webhook', target, eventType?($enum EventType) }
  permissions: { fillRoles: Role[], reviewRoles: Role[] }   // $enum Role from contracts
  print: { layout: 'sheet'|'ticket', sections: [id] }       // subset/order for print
  attribution: { filledBy: true, reviewedBy?: Role, stationSignIn?: bool }
}
```
One definition validates in both runtimes because `type`, `$enum`, `$ref`, `pattern`,
`minLength/minimum/maximum`, `nullable`, `required`, `additionalProperties`, array `items` are
exactly the keyword set `contracts/index.js` `validate()` already implements (mirrored in
`contracts.py`) — a FormDef's `fields` compile straight into a `SCHEMAS`-shaped object at submit
time, no second validator to write.

Submissions carry `formId` + `formVersion`; a later edit to the definition never rewrites history.

## 3. Renderer — `shared/hd-form.jsx`

`window.HDForm({ def, initial, mode: 'fill'|'print'|'review', onSubmit })`. Built entirely from
existing atoms — `Field`, `Seg`, `Switch`, `Check`, `PBtn`, `Card`, `SectionHead` (`pos/atoms.jsx`),
`Sheet`, `MultiSelectFilter`, `ToastHost`/`hdToast` (`shared/hd-ui.jsx`) — and `pos/tokens.jsx`
colors, so a generated form is visually indistinguishable from hand-built screens. Validation
errors render via the same message strings `HWContracts.validate()` produces. Autosaves drafts to
`localStorage` keyed by `formId+recordId`; touch targets and `enterkeyhint` follow the closeout
form's pattern (44×44 steppers, `inputmode="numeric"`). Print mode renders `print.layout` with
`@media print` rules, no separate template. Embeds in three lines:
```jsx
<HDForm def={FORMS.writeup} initial={draft} onSubmit={submitForm} />
```

## 4. Backend — wm-demo

Tables: `forms` (id, version, title, definition_json, active, created_by, created_at) and
`form_submissions` (id, form_id, form_version, data_json, submitted_by, reviewed_by, reviewed_at,
status, attachments_json, created_at) — SQLite, matching `contracts_api.py` conventions (integer
cents, ISO-8601 UTC, ObjectId strings). Routes: `GET/POST /api/forms` (admin-only, Role
`manager`+), `POST /api/forms/:id/submit` (server re-validates with `contracts.py`'s subset —
never trust the browser pass), `GET /api/forms/:id/submissions` (list/review), `GET
/api/forms/:id/export.csv`. Attachments (photo/signature) stored as files on disk, referenced by
path in `attachments_json`, same pattern IDV already uses for document images.

## 5. Builder screen, and what v1 must NOT do

Builder: field palette → drag onto a section → per-field validation config (reusing $enum
pickers already in `contracts` ENUMS) → live preview via `HDForm` itself → publish (bumps version,
old submissions keep their schema). **v1 must not**: support branching logic beyond flat
`showWhen` (no nested conditional trees), let non-admins edit published definitions, delete a
form version that has submissions, do PDF generation (print is browser print-to-PDF only), or
attempt real-time multi-user co-editing of one submission.

## 6. Three abridged FormDef examples

**Write-up** (role-capped ladder, mirrors `IncidentPortal.js` `select#incidentType`/severity):
```json
{ "id":"writeup","version":3,"fields":[
  {"key":"employeeId","type":"person","required":true},
  {"key":"category","type":"select","$enum":"Classification","required":true},
  {"key":"ladderStep","type":"select","options":["Verbal","Written","Final"],
   "showWhen":{"role_gte":"manager"}},
  {"key":"description","type":"text","minLength":10,"required":true},
  {"key":"driverInvolved","type":"checkbox"}],
  "submit":{"kind":"event","eventType":"person.merged"} }
```

**Store closeout** (money + cash-drop count, mirrors `Form.html` denom steppers):
```json
{ "id":"closeout","version":5,"fields":[
  {"key":"storeId","type":"store","required":true},
  {"key":"register","type":"select","options":["1","2","Other"]},
  {"key":"denom100","type":"number","minimum":0},
  {"key":"cashCounted","type":"money","computed":"sum(denom*)","$ref":"Money"},
  {"key":"cashToDrop","type":"money","$ref":"Money"},
  {"key":"variance","type":"money","computed":"cashCounted-expected"}],
  "attribution":{"filledBy":true,"stationSignIn":true} }
```

**Discrepancy note** (photo + PIN step-up):
```json
{ "id":"discrepancy","version":1,"fields":[
  {"key":"photo","type":"photo","required":true},
  {"key":"note","type":"text","maxLength":500},
  {"key":"pinStepUp","type":"pin_stepup","showWhen":{"amount_gt":5000}}],
  "permissions":{"fillRoles":["associate","manager"]} }
```

## 7. Phases, hours, dependencies

| Phase | Scope | Elite-dev hrs |
|---|---|---|
| 0 | FormDef JSON Schema + contract-keyword compiler, no UI | 6 |
| 1 | `HDForm` renderer (fill mode only), wm-demo tables + submit route | 14 |
| 2 | Review/list screen, print layout, attachments | 10 |
| 3 | Builder screen (drag, preview, publish/versioning) | 16 |
| 4 | Migrate one real form end-to-end (closeout — highest field-type coverage) | 8 |

Dependencies: `contracts/index.js` stays the single validator source (no drift); wm-demo file
storage path for attachments; Role enum from `contracts` for `permissions`.

**Four concepts to draw next round**: (a) builder canvas drag/drop, (b) `showWhen` condition
editor UI, (c) print-sheet layout for a closeout, (d) review/approval queue screen.

## 8. Owner questions (≤6)

1. Attachments: local disk under wm-demo, or Drive (like onboarding docs today)?
2. Should `form_submissions.status` ladder match write-up statuses (draft/pending/approved) or is
   generic pending/approved/rejected enough for all form types?
3. Is PIN step-up a shared component already, or new to `hd-ui.jsx`?
4. Migrate closeout first (most field types) or write-up first (highest submission volume)?
5. Do builder-created forms need a staging/preview link before "publish," or is preview-in-modal
   enough for v1?
6. Any forms besides the three sampled that must be in scope before Phase 4 picks its target?
