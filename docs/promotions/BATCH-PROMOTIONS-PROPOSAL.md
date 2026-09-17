# Batch-first promotions: one rule shape for the whole stack

Draft for JT, 2026-09-16. **Not sent.** Companion to `PRODUCT-SHELLS-DESIGN.md` and
`PRODUCT-BATCHES-DESIGN.md` (both already with the vendor). Technical backing: `RULE-SHAPE.md`
(the shape, its limits, the fixture set, the mapping table) and contracts 0.5.0.

---

## 1. The problem in one paragraph

The promotions stack carries four rule representations at once. One `Promotion` document holds
`rule`, `actions`, `rules` and `ruleTree`, every one typed `Mixed` and none validated at the
database (`promotion-backend/models/Promotion.js:95-113`). Beside them sit a flat one-condition
model whose `operation` is a free string (`models/Rule.js:17-20`), a nested `ifRules/thenRules`
model whose `attributes` is a free string (`models/Rules.js:10`), and a separate engine repo with
its own attribute vocabulary (`promotion-engine/rule-types/*/definition.js`). The admin's own
reference file for rule attributes cites backend files that do not exist
(`hyperwolf-super-admin/src/layouts/promo/backendRuleAttributes.js:5-8`). A promotion can be
written four ways, evaluated by code that disagrees about which way is current, and never checked.

None of the four can say the thing we most need to say: *this batch*. Rules target a product id,
a category, a user group. A batch of flower that tested at 34% and was packaged 120 days ago is
invisible to all of them, and the only date-aware attribute (`product_package_date`) reads an
embedded array on the product rather than a batch record.

## 2. The proposal

**One shape, `hw.rule.v1`, replaces all four.** A promotion is a JSON if/then record:

```json
{
  "shape": "hw.rule.v1", "id": "rule_01J…", "name": "Aged 30%+ flower, 15% off",
  "status": "active", "priority": 100, "stackable": false,
  "window": { "starts_at": "2026-09-16T00:00:00Z", "ends_at": null },
  "scope":  { "store_ids": ["store_wh"], "channels": ["in_store", "delivery"] },
  "if": { "all": [
      { "field": "batch.thc_pct",       "op": "gte",             "value": 30 },
      { "field": "batch.packaged_at",   "op": "older_than_days", "value": 90 },
      { "field": "product.category_id", "op": "in",              "value": ["flower"] }
    ], "any": [], "not": [] },
  "then": { "kind": "percent", "value": 15, "applies_to": "matched_lines",
            "cap_cents": null, "max_per_order": null },
  "meta": { "author": "owner", "source": "ui", "prompt": null, "version": 1 }
}
```

Three properties make it different from what exists today, and they are the whole pitch:

1. **It targets the batch.** `batch.batch_no`, `batch.thc_pct`, `batch.packaged_at`,
   `batch.received_at`, `batch.expires_at`, `batch.age_days`. The batch is the grower's lot: one
   harvest, one THC result, one packaged date, often split across several Metrc packages. A rule
   can never reference a Metrc package tag; the validator rejects the field. Compliance reporting
   still resolves unit → batch → package underneath, unchanged.
2. **It is closed.** Fields, operators and outcome kinds are enums. An operator is legal only for
   the field's type. Nesting depth, node count, list length, string length and total size are
   capped. A rule that does not validate is not stored. The four existing surfaces accept any
   string in the places that matter.
3. **Any client can write it.** A screen, an import, or an AI agent posts the same JSON to the
   same route. The server stamps who wrote it from the credential, not the body; a rule written by
   an agent lands as a draft and only a person with the activate scope can switch it on.

## 3. What the vendor gets

| Today | With `hw.rule.v1` |
|---|---|
| Four rule fields per promotion, all `Mixed` | One `rule` field, one schema, validated on write |
| `operation` and `attributes` are free strings | Closed enums; a typo is a 400, not a silent no-match |
| Rules target product ids and categories | Rules target batches (age, THC, dates) as well as product, cart, customer, channel, time |
| Store and channel scope not expressible | `scope.store_ids`, `scope.channels` |
| No notion of who wrote a rule | `meta.author` and `meta.source` stamped server-side; agent drafts cannot self-activate |
| Evaluation code split across two repos | One pure evaluator, same code for live quotes and dry-run preview |
| No test fixtures | 50 fixtures (21 valid, 29 invalid) that JS and Python must agree on |

## 4. What it costs the vendor

The mapping in `RULE-SHAPE.md` §6 is exact. The short version:

- Every operator in `promotion-engine/core/operators.js` has an equivalent.
- `cart_total` → `cart.subtotal_cents` (integer cents, no ambiguity); `cart_count` →
  `cart.line_count`; `category_id` → `product.category_id`; `user_group` splits into
  `customer.tier` and `customer.segment_id` because the flat "group" conflates loyalty tier and
  marketing segment.
- **Not carried over, by design:** `rule_type` as a top-level field (the field prefix carries it
  per condition), `type: input|select` (a form hint, not a rule concept), `mp_id` (undocumented),
  and any reference to a Metrc tag.
- **Needs a decision:** `product_id`. The contract targets `product.sku` and `product.shell_id`;
  which one survives depends on the Blaze id migration, not on this proposal.

**Measured, not estimated.** `wmdemo/engage/rule_export.py` maps every `hw.rule.v1` rule to the
vendor's legacy `ifRules` shape and lists what cannot cross, per rule, in `unsupported[]` (81
probe checks). What comes out unsupported today: every `batch.*` field; `product.sku` and
`product.shell_id` (pending the product-id decision); `order.channel`, `order.store_id`, `time.*`
and any non-empty `scope`; the operators `not_in`, `between`, `before`, `after`,
`older_than_days`, `newer_than_days`; `not` over more than one node; `bogo`, `gift`, `points`
outcomes; and `customer.tier` / `customer.segment_id` collapse onto one `user_group`. Everything
else (`> >= < <= == != IN`, `cart_total`, `cart_count`, `category_id`, percent and amount) maps
cleanly. That list is the gap between the two systems, in code.

The vendor's data model does not change to adopt this. `Promotion` gains one optional `rule`
property; the four legacy fields can stay until the last old promotion expires. The export shape
their engine reads today (`ruleType`, `creteria`, `ifRules`) is still emitted by our side for the
transition.

## 5. What is built and running

- Contracts 0.5.0 (`@hyper-tech/contracts`): the shape, enums, limits, `validatePromotionRule`,
  fixtures, and a Python validator that reads the same exported tables.
- A pure evaluator and five routes on the demo server: list, create/update (write scope),
  activate/end (activate scope), preview (which live batches and which cart lines a rule matches,
  with a reason per line), and quote integration behind a per-store flag.
- A seeded demo: one flower shell, three batches (22 / 31 / 34% THC, packaged 10 / 95 / 120 days
  ago), one rule written from the UI and one written by an agent through the identical route. The
  quote discounts only the aged high-THC batches. Preview shows why each batch matched or not.
- Adversarial review closed four real holes before this draft: a rule of a million empty groups
  that validated, unbounded discount values, self-activation by claiming a UI source, and batch
  resolution that ignored which store the cart was in. The probe suite (254 checks and rising)
  now covers each.
- Four rule-builder screen concepts for the inventory team to choose from
  (`explorations/Promo Rules - Concept A..D.html`).

## 6. Suggested path with the vendor

1. Walk them through §1–§3 with the demo open. Ask them to confirm which of their four surfaces
   is authoritative today; we could not tell from the code.
2. Agree the `product_id` question (§4).
3. They add the optional `rule` property and accept `hw.rule.v1` on their write route, validating
   with the shared contract (JS package, no new dependency).
4. Their evaluator gains one branch: if `rule.shape == "hw.rule.v1"`, call the shared evaluator;
   otherwise the legacy path. Old promotions keep working until they expire.
5. Retire the three redundant fields when the last legacy promotion ends.

## 7. Open on our side

- Rotation order: the batch resolver follows the pick path (expiry first, then received date);
  `PRODUCT-BATCHES-DESIGN.md` §4 says received date. One sentence in that doc needs to change, or
  the pick path does. Owner call.
- Percent rounding is now half-away-from-zero per matched line, like the till. Confirm that is the
  convention the vendor's register uses.
