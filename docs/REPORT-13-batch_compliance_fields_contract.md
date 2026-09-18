# Brief 13 — Batch compliance fields, contract 0.5.4

Fixture domain: `batch-compliance`, because this change is solely Batch lot
overrides, not the later Product compliance object or purchase-limit engine.

`index.js`: VERSION 0.5.3 -> 0.5.4 with additive changelog; new LimitBucket
enum `flower | concentrate | plant | non_cannabis`, cited to plan §3.2 with
an explicit simplified Batch naming note; Batch adds is_cannabis:boolean,
limit_bucket:LimitBucket, and net_weight_mg/concentrate_mg/thc_mg/plant_count
as nonnegative integers. All six are optional and nullable. Existing
required keys and additionalProperties:true are unchanged. RULE_FIELD_TYPE
is unchanged. No Product compliance object or behavior added.

`types.d.ts`: sync header updated to 0.5.4, LimitBucket alias added, Batch
properties in the same order as runtime schema, all `?:` and `| null`.
Amounts use number (runtime enforces integer/minimum). Dated version note
matches the existing 0.5.2/0.5.3 section annotation style.

Ran the exporter (no generated JSON hand edits):

```text
wrote enums.json (102 enums) and 48 schemas for contract 0.5.4
```

Previously 101 enums / 48 schemas: enum +1, schema count unchanged.
Every schema's generated contract metadata changed to 0.5.4, including
Product.json; all non-Batch schema content is unchanged, verified against
HEAD. This is the required exporter output, not a Product schema change.

Six valid fixtures: old minimal Batch omitting all additions, full flower
override, all six explicitly null, non-cannabis zero amounts, plant, and
concentrate. Ten invalid fixtures: negative and fractional values for each
of the four amount fields, unknown bucket `infused_split`, and string
`"true"` where is_cannabis requires boolean. Registered with fixture floors
6 valid / 10 invalid, adding two test cases without weakening prior tests.

Cross-field boundary: non_cannabis plus nonzero THC cannot be rejected by
the current validate()/walk() subset, which has no conditional cross-field
rules. Mechanically confirmed such a record validates; this remains a
later business-logic obligation. Used wrong-type boolean instead of a
misleading invalid fixture. No validator feature or business rule added.

Final verification used the authorized sibling worktree explicitly:
`WM_DEMO_ROOT=/Users/jt/codex-work/wm-demo node --test test/contracts.test.mjs`.
An initial run used the test's default read-only estate comparison path;
the final run overrides it to the handoff worktree. Neither run writes to
the estate comparison source. Final full summary:

```text
tests 40
suites 0
pass 40
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 378.867125
```

Browser load, enums/schema parity, types declarations and both new fixture
tests pass. Additional structural verification: 5 groups PASS / 0 FAIL
(required/additionalProperties, nullable additions, prior schemas unchanged,
prior enums/rule fields unchanged, cross-field limitation confirmed).
`git diff --check` PASS. Required grep:

```text
contracts/enums.json:2:  "contract": "0.5.4",
contracts/schema/Batch.json:3:  "contract": "0.5.4",
```

No Python code, UI, credentials or external services touched. No unfinished
work in this contract brief.
