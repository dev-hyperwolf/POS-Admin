---
repo: /Users/jt/POS-Admin
model_hint: gpt-5-codex
max_minutes: 40
files_allowed: contracts/index.js contracts/types.d.ts test/contracts.test.mjs
verify_command: cd /Users/jt/POS-Admin && node --test test/contracts.test.mjs
---

# Goal

Add six ADDITIVE, optional fields to the `Batch` contract shape (0.5.3 ->
0.5.4) so the purchase-limits engine
(`docs/PURCHASE-LIMITS-PLAN-2026-09-17.md`) has somewhere to read
per-lot compliance data that varies by batch: `is_cannabis` (boolean),
`limit_bucket` (enum `flower | concentrate | plant | non_cannabis`),
`net_weight_mg` (integer), `concentrate_mg` (integer), `thc_mg` (integer),
`plant_count` (integer). None of these are required yet -- that lands later,
with the admin UI gate. When this is done: `contracts/index.js`'s `VERSION`
is `0.5.4` with a changelog comment in its existing style;
`contracts/enums.json` and `contracts/schema/Batch.json` (generated files,
see below) reflect the new fields and the new `LimitBucket` enum;
`contracts/types.d.ts`'s `Batch` interface has the six new optional
properties; fixtures exist proving the additive change and its stated
invalid cases; and `node --test test/contracts.test.mjs` passes.

# Read first -- and one naming note that matters

1. `docs/PURCHASE-LIMITS-PLAN-2026-09-17.md` §3.2 for background -- but
   **do not copy its field names**. §3.2 proposes a fuller `compliance.*`
   object on `Product.json` (`compliance.bucket` with enum values
   `non_concentrated | concentrate | infused_split | immature_plant | seed |
   non_cannabis`, `compliance.non_concentrated_mg`, etc.) -- that is a
   separate, later, Product-level piece of work, NOT this brief. This brief
   adds a smaller, Batch-level override with the SPECIFIC field/enum names
   given in the Goal above (`is_cannabis`, `limit_bucket` with values
   `flower|concentrate|plant|non_cannabis`, `net_weight_mg`,
   `concentrate_mg`, `thc_mg`, `plant_count`) -- these are deliberately
   simpler and DIFFERENT from §3.2's `compliance.*` names. Use exactly the
   names in the Goal section above; do not rename them to match §3.2, and
   do not also add the `compliance` object to `Product.json` -- that is
   out of scope.
2. `contracts/index.js`'s existing `Batch:` schema entry (search for
   `Batch: { type: 'object', required:`) and the `VERSION` changelog block
   right above it (search for `var VERSION = '0.5.3'`) for the exact
   inline-object style and the changelog-comment convention (one `// 0.5.N
   (additive): ...` paragraph per version, newest first, ending "No prior
   shape changed." when nothing existing was altered).
3. **How the generated files actually work -- read
   `tools/contracts-export.mjs`'s own header comment first.**
   `contracts/enums.json` and every `contracts/schema/*.json` file
   (including `Batch.json`) are WRITTEN FROM `contracts/index.js` by that
   script -- they are build output, not hand-maintained source. The correct
   edit order is: (a) edit `contracts/index.js` (VERSION, the `Batch` schema
   entry, and a new `LimitBucket` entry in the `ENUMS` object, matching the
   `{ values: [...], source: '...' }` shape the most recent entries there
   use, e.g. `SaleLinePricedBy`), then (b) run `node
   tools/contracts-export.mjs` from the repo root to regenerate
   `enums.json` and `contracts/schema/Batch.json` -- never hand-edit those
   two generated files directly, your changes would be silently wiped the
   next time anyone runs the export script. (`enums.json` and
   `contracts/schema/*.json` are NOT in this brief's `files_allowed` for
   exactly this reason -- you regenerate them with the script, you don't
   hand-edit them.)
4. This brief's "check how 0.5.3 did it" instruction, answered: there is
   **no separate Python validator table to update**. `wm-demo/wmdemo/
   contracts.py`'s own module docstring says it "never re-types its
   vocabulary: it loads `contracts/enums.json` and `contracts/schema/*.json`"
   at runtime -- Python automatically sees your new fields once you
   regenerate those two files in step 3(b). Do not create or edit any
   Python file for this brief (wm-demo is a separate repo from this one
   anyway, and out of scope).
5. `contracts/fixtures/metrc/` (`valid/`, `invalid/`, one JSON file per
   case, shape `{"shape": "<SchemaName>", "record": {...}}`) for the
   fixture-file convention, and `test/contracts.test.mjs`'s
   `checkFixtureDomain(domain, minValid, minInvalid)` helper (search for
   `function checkFixtureDomain`) plus its registration calls right below
   it (`checkFixtureDomain('metrc', 6, 9);` etc.) -- **`Batch` currently has
   NO fixture domain and NO dedicated test coverage in this file at all** --
   you are adding both the fixtures AND the `checkFixtureDomain(...)` call
   that actually exercises them; without that call, fixture files alone
   prove nothing.
6. `test/contracts.test.mjs`'s "browser load" / `enums.json` / `types.d.ts`
   parity tests (grep the file for `'enums.json'` and `'types.d.ts'` in test
   names) -- these fail loudly if `contracts/index.js` and the generated
   files ever disagree, which is your safety net for step 3.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write. Read-only git is fine. The PM commits after
  review, explicit paths only, never `git add -A`/`.`.
- Touch only `contracts/index.js`, `contracts/types.d.ts`, and
  `test/contracts.test.mjs` directly. You MAY (must, per step 3) also run
  `node tools/contracts-export.mjs`, which will rewrite
  `contracts/enums.json` and every file under `contracts/schema/` -- that is
  expected and required, not a scope violation; just don't hand-edit those
  two targets with a text editor.
- New fixture files go under a new `contracts/fixtures/<domain>/valid/` and
  `contracts/fixtures/<domain>/invalid/` directory (pick a domain name that
  reads naturally, e.g. `purchase-limits` or `batch-compliance` -- your
  call, say which and why in your report) -- these are new files this
  brief's own steps ask you to create, not a `files_allowed` violation.
- `/Users/jt/hyper-tech/*` is read-only reference material -- not relevant
  here, but never edit anything under it regardless.
- Do not touch `pos/screen-register.jsx` or `pos/screen-catalog.jsx`.
- Fields are ADDITIVE and OPTIONAL. Do not add `is_cannabis`, `limit_bucket`,
  or any of the four amount fields to `Batch`'s `required` array. Do not
  change `additionalProperties` on `Batch` (it's already `true`).
- Do not add the new fields to `enums.json`'s `rule_field_type` map --
  these are not promotion-rule-targetable fields (same posture as the
  existing `batch.metrc_tag`/`metrc_packages` exclusion documented in the
  0.5.0 PromotionRule changelog comment) -- leave `RULE_FIELD_TYPE`
  untouched.
- Never lower a check count or weaken an assertion anywhere in
  `test/contracts.test.mjs` to make something pass.
- Foreground run, `max_minutes` cap above.

# Steps

1. In `contracts/index.js`'s `ENUMS` object, add `LimitBucket`:
   `LimitBucket: { values: ['flower', 'concentrate', 'plant',
   'non_cannabis'], source:
   'docs/PURCHASE-LIMITS-PLAN-2026-09-17.md §3.2 (Batch-level override --
   simplified from that section's fuller Product-level compliance.bucket
   enum)' }`, placed near the other recent (0.5.x) enum entries, with a
   short comment above it in the file's existing style explaining what each
   value means for THIS field (not §3.2's values).
2. In the `Batch` schema entry's `properties`, add the six new properties,
   all `nullable: true` (meaning: optional AND may be explicitly null, same
   posture as `sku`/`metrc_tag`/`location_id` already on this shape):
   `is_cannabis: { type: 'boolean', nullable: true }`,
   `limit_bucket: { type: 'string', $enum: 'LimitBucket', nullable: true }`,
   `net_weight_mg: { type: 'integer', minimum: 0, nullable: true }`,
   `concentrate_mg: { type: 'integer', minimum: 0, nullable: true }`,
   `thc_mg: { type: 'integer', minimum: 0, nullable: true }`,
   `plant_count: { type: 'integer', minimum: 0, nullable: true }`. Add a
   one-line comment right above them citing this brief's own reasoning
   (purchase-limits engine, Batch-level override, additive, not required
   yet -- becomes required with the admin UI gate).
3. Bump `VERSION` to `'0.5.4'` and add the changelog paragraph in the
   established style: `// 0.5.4 (additive): Batch.is_cannabis/limit_bucket/
   net_weight_mg/concentrate_mg/thc_mg/plant_count + LimitBucket enum
   (docs/PURCHASE-LIMITS-PLAN-2026-09-17.md §3.2, Batch-level override --
   simplified naming, see index.js's own LimitBucket comment). No prior
   shape changed.` -- placed as the newest entry, above the existing 0.5.3
   paragraph.
4. From the repo root, run `node tools/contracts-export.mjs`. Confirm its
   printed line reports contract `0.5.4` and the same schema count as
   before (Batch's field count grew, the schema count itself didn't).
5. Update `contracts/types.d.ts`'s `Batch` interface (single-line style,
   matching the file's existing convention) to add the six new optional
   properties in the same order as `index.js`'s properties object, each
   typed as `boolean | null`, `LimitBucket | null` (add the
   `export type LimitBucket = 'flower' | 'concentrate' | 'plant' |
   'non_cannabis';` type alias near the file's other small enum type
   aliases), or `number | null` as appropriate. Add a dated one-line comment
   above the `Batch` interface noting the 0.5.4 addition, matching how prior
   version bumps are annotated in this file (check how the 0.5.2/0.5.3
   additions were marked, if at all, and match that -- if prior additions
   used no per-interface comment, don't invent a new convention here).
6. Create the new fixture domain directory (`contracts/fixtures/<your
   chosen domain name>/{valid,invalid}/`) with, at minimum: 2 valid Batch
   fixtures (one with none of the six new fields set at all, proving they
   stay fully optional against the existing shape; one with all six set to
   realistic values for a `flower` bucket item) and 3 invalid fixtures
   (negative `net_weight_mg` or `thc_mg`/`concentrate_mg`/`plant_count`;
   `limit_bucket` set to a value outside the four-value enum; a
   `non_cannabis` `limit_bucket` combined with a nonzero `thc_mg` -- read
   the Goal section again: is a non_cannabis batch reporting THC actually a
   contract-level violation, or only a business-logic one the SCHEMA can't
   express? If the schema genuinely cannot enforce that cross-field rule
   with the JSON-Schema subset `contracts/index.js`'s own `validate()`
   implements -- checked/required/nullable/enum/pattern/min/max, no
   conditional cross-field rules -- say so plainly in your report and
   substitute a different invalid case that the schema CAN actually reject
   instead of writing a fixture that will just fail your own test for the
   wrong reason).
7. Add `checkFixtureDomain('<your domain name>', 2, 3);` to
   `test/contracts.test.mjs` right after the existing `checkFixtureDomain`
   calls (after the `'sales'` one), with a one-line comment in the same
   style as the others explaining what it covers.
8. Run the verify command until green.

# Verify

```
cd /Users/jt/POS-Admin && node --test test/contracts.test.mjs
```
Success: all tests pass, including the new `checkFixtureDomain(...)` tests
for your domain (at least 2 valid + 3 invalid fixtures found and correctly
judged) and the existing `enums.json`/`types.d.ts`/"browser load" parity
tests (proving `index.js`, the regenerated JSON, and `types.d.ts` all agree
on `0.5.4` and the new fields). Also run, and paste the output of:
```
cd /Users/jt/POS-Admin && grep -n '"contract"' contracts/enums.json contracts/schema/Batch.json
```
both must say `0.5.4`.

# Security notes

None of these fields carry PII. They are additive-only and not required,
so no existing caller's payload can become invalid because of this change.
The one thing to verify explicitly: confirm `additionalProperties` stayed
`true` on `Batch` (unchanged) and that you did not accidentally tighten it
to `false`, which would break every existing caller that posts a `Batch`
with fields this schema doesn't yet know about.

# What NOT to do

- Do not touch `Product.json` / add a `compliance` object anywhere -- out of
  scope, a separate later piece of work per §3.2.
- Do not hand-edit `contracts/enums.json` or `contracts/schema/*.json` with
  a text editor -- regenerate them with `tools/contracts-export.mjs`.
- Do not make any of the six new fields required.
- Do not touch `RULE_FIELD_TYPE`/`rule_field_type`.
- Do not touch any Python file in any repo.

# Report format

Write `docs/REPORT-13-batch_compliance_fields_contract.md` covering:
- the fixture domain name you chose and why
- the exact `index.js` diff (VERSION, ENUMS.LimitBucket, Batch properties)
- confirmation the export script ran cleanly and what it printed
- the `types.d.ts` diff
- your invalid-fixture choices, and specifically your answer to the
  cross-field (`non_cannabis` + nonzero `thc_mg`) question in step 6 --
  what you actually did instead if the schema can't express it
- the full `node --test test/contracts.test.mjs` output summary, and the
  `contract` grep from Verify

# Log entry

Append "## 13 -- Batch compliance fields, contracts 0.5.4 -- COMPLETE" (or
BLOCKED) to `docs/CODEX-HANDOFF-LOG.md`, matching the style of its existing
entries (e.g. task 06's entry, which is the same "contracts version bump"
shape this task is). Commit with explicit paths, never push.
