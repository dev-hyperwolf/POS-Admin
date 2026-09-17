# `hw.rule.v1` — the PromotionRule shape

Contract: `@hyper-tech/contracts` 0.5.0 (`contracts/index.js` `SCHEMAS.PromotionRule`,
`SCHEMAS.RuleGroup`, `SCHEMAS.RuleCondition`, `SCHEMAS.RuleNode`; enums `RuleShape`, `RuleField`,
`RuleOp`, `RuleThenKind`, `RuleStatus`, `RuleSource`, `RuleChannel`; constants `RULE_FIELD_TYPE`,
`RULE_LIMITS`; function `validatePromotionRule`). Plan of record:
`docs/BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §2.1.

This is additive. Nothing existing in the contract changed shape; `Promotion` gained one optional
`rule` property (`$ref: PromotionRule`).

## 1. Shape

```
PromotionRule {
  shape:      "hw.rule.v1"                                  // RuleShape, one-value enum (subset has no const)
  id:         string
  name:       string                                        // <= 200 chars (RULE_LIMITS.max_string, see §3)
  status:     "draft" | "active" | "paused" | "ended"        // RuleStatus
  priority:   integer
  stackable:  boolean
  window:     { starts_at: ISO-8601 UTC, ends_at: ISO-8601 UTC | null }
  scope:      { store_ids: string[], channels: RuleChannel[] }   // "in_store" | "pickup" | "delivery"
  if:         RuleGroup
  then:       { kind: RuleThenKind, value: any, applies_to: "matched_lines" | "cart",
                cap_cents: integer | null, max_per_order: integer | null }
  meta:       { author: string, source: "ui" | "agent", prompt: string | null, version: integer }
}
RuleGroup    { all: RuleNode[], any: RuleNode[], not: RuleNode[] }   // all three always present, may be empty
RuleCondition{ field: RuleField, op: RuleOp, value: any }
RuleNode     { field?, op?, value?, all?, any?, not? }               // exactly one form — see §3
```

An `if` of `{"all":[],"any":[],"not":[]}` is a valid, unconditional rule (matches everything) —
used for storewide promotions with no targeting.

`window.ends_at` before `window.starts_at` is a modeling smell but is **not** rejected by the
contract — that ordering call belongs to whoever schedules the rule, not to the shape.

## 2. RuleField vocabulary and type

`RULE_FIELD_TYPE` (`contracts/index.js`) maps each closed `RuleField` value to the base type that
decides which ops are legal and what a `value` must look like:

| field | type | notes |
|---|---|---|
| `batch.batch_no` | string | |
| `batch.thc_pct` | number | 0–100, see `Batch.thc_pct` |
| `batch.packaged_at` | date | |
| `batch.received_at` | date | |
| `batch.expires_at` | date | |
| `batch.age_days` | number | derived from `received_at`, not stored |
| `product.shell_id` | string | |
| `product.sku` | string | |
| `product.category_id` | string | |
| `product.brand` | string | |
| `cart.subtotal_cents` | number | integer cents, not dollars |
| `cart.line_count` | number | distinct lines, not units |
| `customer.tier` | enum | loyalty tier — see `LoyaltyTier` |
| `customer.segment_id` | string | |
| `order.channel` | enum | `RuleChannel`: `in_store` \| `pickup` \| `delivery` |
| `order.store_id` | string | |
| `time.dow` | number | day of week |
| `time.hour` | number | |

**`batch.metrc_tag` and anything under `metrc_packages` are deliberately absent.** Owner ruling
2026-09-14, `docs/shells/PRODUCT-BATCHES-DESIGN.md:95`: compliance identifiers are not promotion
inputs. `validatePromotionRule` rejects them the same way it rejects any unlisted field — via the
`RuleField` enum, not a special case.

## 3. What the JSON-Schema subset cannot express (and where it goes instead)

`contracts/index.js`'s subset is `type, required, properties, additionalProperties, items,
enum/$enum, pattern, minLength, minimum, maximum, nullable, $ref` — the same subset
`wmdemo/contracts.py` ports (its docstring lists the identical set; `_walk` in both files is
line-for-line equivalent logic). It has **no `oneOf`, no `maxLength`, no `maxItems`**, and no way
to say "at least one of these two shapes." Four structural rules in the plan therefore cannot live
in `SCHEMAS.PromotionRule` itself and are enforced by `validatePromotionRule(rule)` after the base
`validate('PromotionRule', rule)` passes:

1. **Nesting depth ≤ `RULE_LIMITS.max_depth` (4).** The top `if` counts as depth 1; each nested
   `all`/`any`/`not` group adds one. A condition leaf does not add depth.
2. **Condition-node count ≤ `RULE_LIMITS.max_nodes` (50).** Counted across the whole tree, not
   per branch.
3. **`in`/`not_in` array length ≤ `RULE_LIMITS.max_list` (200)**, and **`between` must be an
   exactly-2-item array.** (No `maxItems` in the subset.)
4. **String length ≤ `RULE_LIMITS.max_string` (200)** on `name`, `meta.prompt`, and any string
   inside a condition `value`. (No `maxLength` in the subset — only `minLength` exists.)

A fifth thing the subset cannot express at all, `oneOf`, is why `RuleNode` is modeled as one flat
object with six *optional* properties (`field`, `op`, `value`, `all`, `any`, `not`) instead of two
real alternatives. `validatePromotionRule` walks the tree and rejects a node that has **both**
forms or **neither**:

```
{ field: 'batch.thc_pct', op: 'gte', value: 30, all: [] }   // both forms — rejected
{ }                                                          // neither form — rejected
```

Two more checks live only in `validatePromotionRule`, because they cross a field and its value and
the subset's `value: {}` (deliberately typeless, since a value can be a number, string, array-of-2,
or array-of-N depending on `op` and field type) has nothing to check against on its own:

5. **Op allowed for the field's type** (`RULE_OPS_BY_TYPE`, JS-only — see below).
6. **Value's JS type matches the field's type** (`in`/`not_in` want an array of the base type;
   `between` wants a 2-item array; `older_than_days`/`newer_than_days` want a non-negative number;
   everything else wants one value of the base type).

| type | allowed ops |
|---|---|
| `number` | `eq neq gt gte lt lte between in not_in` |
| `string` | `eq neq in not_in` |
| `date` | `eq neq gt gte lt lte between before after older_than_days newer_than_days` |
| `enum` | `eq neq in not_in` |

**`RULE_FIELD_TYPE` and `RULE_LIMITS` are exported to `enums.json`** (`rule_field_type`,
`rule_limits` keys — `tools/contracts-export.mjs`), so Python can build the same table. The
**op-per-type compatibility table (`RULE_OPS_BY_TYPE`) is not exported** — it is a JS-only
constant, and the whole depth/node-count/list-length/both-or-neither-form walk in
`validatePromotionRule` has no Python port yet. That is engine-team (1b) work: `wmdemo/contracts.py`
today only gives Python the schema-level `validate('PromotionRule', rule)` check. A record can be
schema-valid and still fail `validatePromotionRule` in JS (wrong op for a field's type, 51
condition nodes, a node with both forms, a 201-char string, an `in` value that isn't an array).
Team 1b must port `validatePromotionRule`'s logic into `wmdemo/contracts.py` (or a sibling module)
reading `rule_field_type` / `rule_limits` from the same `enums.json`, before
`qa/promo_rules_probe.py` (§2.1's Python-side parity runner) can give a fixture the same verdict
as JS.

## 4. Worked examples

**UI-authored, single-branch:**

```json
{
  "shape": "hw.rule.v1", "id": "rule_01J0AGED30PCT", "name": "Aged 30%+ flower, 15% off",
  "status": "active", "priority": 100, "stackable": false,
  "window": { "starts_at": "2026-09-16T00:00:00Z", "ends_at": null },
  "scope": { "store_ids": ["store_wh"], "channels": ["in_store", "delivery"] },
  "if": { "all": [
      { "field": "batch.thc_pct", "op": "gte", "value": 30 },
      { "field": "batch.packaged_at", "op": "older_than_days", "value": 90 },
      { "field": "product.category_id", "op": "in", "value": ["flower"] }
    ], "any": [], "not": [] },
  "then": { "kind": "percent", "value": 15, "applies_to": "matched_lines", "cap_cents": null, "max_per_order": null },
  "meta": { "author": "owner", "source": "ui", "prompt": null, "version": 1 }
}
```

**Nested `all`/`any`/`not` (depth 3):** flower, delivered OR (not a bronze-tier customer) —
`contracts/fixtures/promotion-rule/valid/nested-all-any-not-depth-3.json`.

**Agent-authored draft**, `meta.source: "agent"` with the prompt that produced it kept for audit —
`contracts/fixtures/promotion-rule/valid/agent-sourced-draft.json`:

```json
{ "meta": { "author": "promo-copilot", "source": "agent",
  "prompt": "discount vape batches older than 60 days by 10%", "version": 1 } }
```

## 5. Fixtures

`contracts/fixtures/promotion-rule/valid/*.json` (16) and `.../invalid/*.json` (16), run by
`test/contracts.test.mjs`. Every `RuleOp` and every `RuleThenKind` appears at least once across the
valid set (asserted in the test, not just claimed here). Every invalid fixture's filename names its
defect and its `validatePromotionRule` error names the offending path (e.g.
`$.if.all[0].op: "gt" is not allowed for product.sku (string)`).

## 6. Vendor mapping table

Four rule surfaces exist today in the Hyper-Tech promotions stack, all read-only to this repo.
**`promotion-engine/engine/ruleEvaluator.js` does not exist** in the current clone — the actual
per-type evaluators live at `promotion-engine/rule-types/*/evaluator.js`, which is what the last
two sections below cite instead.

### 6.1 `promotion-backend/models/Promotion.js:95-113`

One `Promotion` document carries **four different, overlapping rule representations** at once,
all typed `mongoose.Schema.Types.Mixed` (untyped, unvalidated at the DB layer):

| field | line | what it is | hw.rule.v1 equivalent |
|---|---|---|---|
| `rule` | 96–99 | free-form object, shape undocumented in this model | superseded by `PromotionRule.if` |
| `actions` | 101–104 | free-form object | superseded by `PromotionRule.then` |
| `rules` | 106–110 | ref to `Rules` (§6.3) | superseded by `PromotionRule.if` |
| `ruleTree` | 113–116 | "recursive JSON structure", comment only, no schema | closest vendor analog to `RuleGroup`/`RuleNode`, but with no shape at all — not even `Rule.js`'s weak enum |

This is the headline finding for the vendor proposal: the vendor has never settled on one rule
shape, and `hw.rule.v1` replacing all four is the pitch, not a refactor of one of them.

### 6.2 `promotion-backend/models/Rule.js` (flat, one condition per document)

| vendor field | line(s) | hw.rule.v1 equivalent |
|---|---|---|
| `rule_type: cart\|user\|product\|bogo` | 11–15 | not representable 1:1 — `hw.rule.v1` has no top-level "rule type"; a condition's `RuleField` prefix (`cart.`/`customer.`/`product.`) carries that distinction per-condition instead of once per rule |
| `operation` (free `String`, **unvalidated**) | 17–20 | `RuleOp` closed enum — the vendor's own model accepts any string here; this is a live gap `hw.rule.v1` closes, not a stylistic difference |
| `attributes: each_or_any` | 25 | superseded by `RuleGroup`'s `all`/`any`/`not` structure |
| `attributes: cart_total` | 26 | `cart.subtotal_cents` (unit differs: vendor value is unstated currency/precision; contract is integer cents) |
| `attributes: cart_count` | 27 | `cart.line_count` (vendor name is ambiguous between line count and unit count; contract disambiguates) |
| `attributes: category_id` | 28 | `product.category_id` |
| `attributes: product_id` | 29 | not representable (by design) — `hw.rule.v1` conditions target `product.sku`/`product.shell_id`, not a raw vendor `product_id`; which one survives depends on the Blaze-id migration, not a naming choice |
| `attributes: user_group` | 30 | partial — splits into two orthogonal contract fields, `customer.tier` and `customer.segment_id`; the vendor's flat "group" conflates loyalty tier and marketing segment |
| `attributes: mp_id` | 31 | not representable today — undocumented in this model; likely a membership-program id with no contract analog |
| `value` (`Mixed`, **unvalidated**) | 36–39 | `RuleCondition.value`, still typeless at the schema layer (subset has no `oneOf`) but constrained per-op/per-field-type by `validatePromotionRule` — the vendor has no equivalent check anywhere |

### 6.3 `promotion-backend/models/Rules.js` (nested `ifRules`/`thenRules`)

| vendor field | line(s) | hw.rule.v1 equivalent |
|---|---|---|
| `IfRuleSchema.operation: enum ['>','<=','>=','==']` | 9 | subset of `RuleOp` (`gt`, `lte`, `gte`, `eq`) — the vendor's own enum is missing `<` and `!=`, which its evaluators still accept as free strings elsewhere (inconsistent even internally) |
| `IfRuleSchema.attributes` (free `String`, **unvalidated**) | 10 | `RuleField` closed enum — another live gap: this model accepts literally any string |
| `IfRuleSchema.type: input\|select` | 7 | not representable — a form-rendering hint, not a rule concept; `hw.rule.v1` has no UI-shape field (that belongs in a promotions-editor screen, not the contract) |
| `ThenRuleSchema.isGroupRule` + `.groupRule` (recursive `RulesSchema`) | 21–22 | same idea as `RuleNode`'s "exactly one form," but expressed as a boolean flag plus a parallel optional field instead of one discriminated shape — `hw.rule.v1` still can't express the discriminant in schema (no `oneOf`) but at least collapses it to one node shape instead of two parallel schemas |

### 6.4 `promotion-engine/core/operators.js` (the operators actually evaluated)

| vendor op | line | hw.rule.v1 equivalent |
|---|---|---|
| `>` / `>=` / `<` / `<=` | 58–61 | `gt` / `gte` / `lt` / `lte` |
| `==` | 62 | `eq` |
| `!=` | 63 | `neq` |
| `IN` | 64 | `in` |
| — | — | **new in hw.rule.v1**: `not_in`, `between`, `before`, `after`, `older_than_days`, `newer_than_days` — the vendor has no negated-membership, no range, and no date-relative comparisons; every date condition today has to be hand-rolled per evaluator (see `getLatestBatchDate`, `product/evaluator.js:12`) instead of expressed as an operator |

### 6.5 `promotion-engine/rule-types/product/definition.js` (`PRODUCT_ATTRIBUTE_MAP`)

| vendor attribute | line | hw.rule.v1 equivalent |
|---|---|---|
| `product_id` | 2 | not representable (by design) — see §6.2 |
| `category_id` | 3 | `product.category_id` |
| `specific_product` | 4 | not representable (by design) — same product-identity gap as `product_id` |
| `product_purchased_quantity_greater_than_n` / `_less_than_n` | 5–8 | not representable today — no per-customer purchase-history field in `RuleField` |
| `product_quantity_greater_than_n` / `_less_than_n` | 9–10 | not representable today — no per-line quantity condition; nearest is `cart.line_count`, which counts lines, not units of one product |
| `product_edition` | 11 | not representable today — no equivalent |
| `product_price` | 12 | not representable (by design) — pricing conditions run against `cart.subtotal_cents`, not a live per-product price read inside a condition (keeps evaluation deterministic and currency-safe) |
| `product_margin` | 13 | not representable — margin is not exposed to conditions at all (a P&L figure, not a merchandising fact) |
| `product_brand` | 14 | `product.brand` |
| `product_type` | 15 | not representable today — no equivalent (`product.category_id` is the closest, but type ≠ category in Blaze) |
| `product_tag` | 16 | not representable (by design) — Blaze merchandising tags have no contract analog |
| `product_thc` | 17 | `batch.thc_pct` — **modeling correction, not a gap**: the vendor keys THC to the product; `hw.rule.v1` correctly keys it to the batch, since THC varies per package |
| `product_cannabinoid` / `product_terpene` / `product_strain` / `product_trait` | 18–21 | not representable today — candidates for a future `product.*` extension, out of the 2026-09-14 field-vocabulary ruling |
| `product_best_seller` / `product_new_arrival` / `product_overstock` / `product_lowstock` / `product_inventory` / `product_days_of_supply` / `product_sales_velocity` / `product_days_without_sale` / `product_bought_by_20_customers_same_day` | 22, 24–29, 31–33 | not representable (by design) — all are **derived/computed** merchandising signals; `hw.rule.v1` conditions read raw stored fields only (`batch.age_days` is the sole derived exception, and it is a pure date subtraction, not a live analytics query) so a rule's evaluation stays deterministic and auditable |
| `days_since_last_purchase` | 23 | not representable today — no purchase-history field on `customer.*` |
| `product_package_date` | 34 | `batch.packaged_at` — same product-vs-batch modeling correction as `product_thc` |
| `product_total_quantity_greater_than_n` | 35 | not representable today — cart-total analog exists (`cart.subtotal_cents`/`cart.line_count`) but not a per-product running total |
| `category_and_brand` | 36 | superseded by `RuleGroup.all` — the vendor needed a compound attribute because it has no AND between separate conditions; `hw.rule.v1` expresses this as two ordinary conditions (`product.category_id` + `product.brand`) under `all` |
| `buy_two_get_one_free` | 30 | superseded by `then.kind: "bogo"` — this is a reward shape, not a condition, and was mis-filed into the attribute map |

### 6.6 `promotion-engine/rule-types/cart/definition.js` (`CART_ATTRIBUTE_MAP`)

| vendor attribute | line | hw.rule.v1 equivalent |
|---|---|---|
| `cart_total` | 2 | `cart.subtotal_cents` |
| `cart_count` / `items_count` | 3, 19 | `cart.line_count` |
| `contains_product` / `contains_specific_product` / `contain_specific_product` / `not_contain_specific_product` | 4–6, 24 | not representable today as a cart-level condition — `hw.rule.v1` has `product.sku`/`product.category_id` for per-line matching (the engine applies them per line), but no "cart contains X" boolean; that is an engine-semantics decision for team 1b, not a contract gap |
| `product_id` | 7 | not representable (by design) — see §6.2 |
| `category_id` / `specific_category_id` | 8, 23 | `product.category_id` |
| `does_not_include` | 9 | expressible via `not_in` on `product.category_id` or `product.sku` |
| `category_item_count` | 10 | not representable today — no per-category line-count field |
| `quantity_same_item` (stored as `item_quantity`) | 11 | not representable today — no per-line quantity-equality condition |
| `bogo_eligible` / `bogo_buy_quantity` / `bogo_get_quantity` | 12, 14, 16 | superseded by `then.kind: "bogo"` — BOGO eligibility is ordinary conditions plus a BOGO reward, not a condition-side attribute |
| `free_shipping_eligible` / `shipping_eligibility` / `eligible_free_shipping` | 17, 20, 25 | not representable — `hw.rule.v1` has no shipping domain (a fulfillment concern, not a promotions-rule concern) |
| `payment_method` | 18 | not representable today — no `order.payment_method` field in the 2026-09-16 `RuleField` list (the contract does have a `PaymentMethod` enum elsewhere, just not wired into `RuleField`) |
| `specific_period` | 21 | partial — `time.dow`/`time.hour` plus `window.starts_at`/`ends_at` cover most of this, but not an arbitrary recurring window (e.g. "weekends only" needs `time.dow` `in` `[6,7]`, which works; "the first week of the month" does not) |
| `cart_product_same_item_quantity` | 22 | not representable today — no per-line quantity-equality condition, same gap as `quantity_same_item` |

## 7. The three headline gaps (plan §2.1)

Everything above rolls up to the three things the plan calls out as what none of the four vendor
surfaces can express today:

1. **Batch attributes** (`batch.thc_pct`, `batch.packaged_at`, `batch.age_days`, …) — every vendor
   surface keys these to the *product*, not the *batch*; none can express "this specific delivery
   is aged out" independent of the SKU's general THC range.
2. **Store/channel scope** (`scope.store_ids`, `scope.channels`) — no vendor rule model has a
   store or channel field at all; scoping today happens outside the rule (which stores a promo
   code is *published to*), not inside the condition tree.
3. **Agent authorship** (`meta.source: "agent"`, `meta.prompt`) — no vendor model records who or
   what authored a rule, or the prompt that produced it. `Promotion.js` has `createdAt` and
   nothing else; there is no author field anywhere in `Rule.js`, `Rules.js`, or the rule-type
   definitions.
