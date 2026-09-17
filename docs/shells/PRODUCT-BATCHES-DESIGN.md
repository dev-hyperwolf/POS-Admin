# Product Batches and Metrc Packages — Design Overview

*Hyperwolf internal design reference, shared for external development review.*

## 1. Purpose

The batch is the unit of control for physical inventory: pricing, rotation, promotions, counts,
pick slips, and the tags applied at receiving all key on the batch, not on anything below it. A
Metrc package tag is a compliance identifier — it exists so state reporting can trace a unit of
product back to the package it was reported under. A package sits **under** a batch, not
alongside it: one batch (one harvest or production run) is routinely split across several Metrc
packages, and the batch is what operators see and act on either way.

Batches sit one level below the shell and variation (product) described in the companion shells
document. A shell groups products by brand, format, and pack; a variation is one catalog product
within a shell. A batch is a physical lot of inventory that fulfills a given product (variation)
over time — the same product can be restocked from many batches across its life, and, briefly,
from more than one batch at once.

## 2. Definitions

**Batch** — A grower's lot: one harvest or production run, one THC lab result, one packaged date.
A batch is received once (`received_at`), may have a packaged date (`packaged_at`) and an
expiration (`expires_at`), and carries a quantity, a unit cost, and the store location it lives
at. A batch belongs to exactly one product (`product_id`).

**Metrc package** — A compliance-tracked container with a single tag, used for state seed-to-sale
reporting. A package is not a unit of business control; it has no pricing, promotion, or rotation
role of its own.

**Batch ↔ package relationship** — One-to-many. A batch carries a list of Metrc packages
(`metrc_packages`), each with its own tag, quantity, and packaged date, because a single grower's
lot is routinely split across several packages at intake. The reverse is never true: a package
does not span more than one batch.

**Unit-level tags at receiving** — Receiving asks which batch a delivery belongs to once, then
records every Metrc tag scanned against that one batch. The handheld does not ask for a batch per
tag.

**Mixed-batch** — The state where one product has more than one batch present and sellable at the
same time (for example, a new batch arrives before the old one sells through). This must be
visible, not silent: a mixed-batch product is flagged wherever it would otherwise look like a
single uniform batch — on plan lines, pick slips, and counts — so staff never treat two batches of
one product as interchangeable, and never treat two packages of one batch as two different
products.

## 3. Data shapes

Shapes below are taken from `@hyper-tech/contracts` 0.4.3, the authoritative source. `Batch` is
the schema of record for this document; `Movement` and `ReceivedItem` are included at a summary
level because they reference a batch by id.

### Batch

| Field | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | |
| product_id | string | yes | The variation (product) this batch fulfills |
| sku | string \| null | no | |
| batch_no | string | yes | Grower's lot number |
| metrc_tag | string \| null | no | **Deprecated as of contract 0.4.3.** Kept only as "first tag" so existing readers don't break; write `metrc_packages` instead |
| metrc_packages | array | no | `[{ tag: string (required), quantity?: integer, packaged_at?: ISO 8601 UTC }]`; one entry per Metrc package the batch has been split into |
| packaged_at | ISO 8601 UTC \| null | no | |
| expires_at | ISO 8601 UTC \| null | no | |
| received_at | ISO 8601 UTC | yes | |
| thc_pct | number (0–100) \| null | no | Lab result for this batch |
| unit_cost | Money \| null | no | |
| quantity | integer | yes | |
| location_id | string \| null | no | |
| external_ids | ExternalId[] | no | |

### Movement (summary)

Records inventory moving between locations. Keyed by `product_id` and `batch_id`, with quantity,
reason, source/destination location, and optional tag references — never a Metrc package tag
directly.

| Field | Type | Required |
|---|---|---|
| id, at, reason, product_id, batch_id, quantity, to_location_id | — | yes |
| from_location_id, tag_ids, actor_id, ref, note | — | no |

### ReceivedItem (summary)

Records one intake event. Keyed by `product_id` and `batch_id`.

| Field | Type | Required |
|---|---|---|
| id, received_at, kind, product_id, batch_id, quantity | — | yes |
| location_id, included_in, reason, premium | — | no |

## 4. How the batch keys the rest

- **Rotation** is oldest-batch-first, ordered by the batch's `received_at` (or `packaged_at`
  where that is the more relevant date for the product type). Never ordered by package tag.
- **Promotions** target batch attributes only: `batch_no`, `thc_pct`, `packaged_at`, or
  `received_at`. A promotion rule can never reference a Metrc package tag.
- **Counts and pick slips** are per batch. A pick slip line carries the batch number, THC, and
  packaged/received date so a packer working from paper can identify the physical lot without a
  screen.
- **The mixed-batch flag** surfaces on plan lines and counts whenever a product has more than one
  batch live at once, so a mixed-batch kit or count is never mistaken for a single-batch one.

## 5. Metrc mapping

Compliance reporting resolves **sale → unit → batch → the specific package that unit came from**.
This is what lets the Metrc report carry the correct package tag on every sale, while operators —
receiving, counts, pick slips, promotions — work exclusively in batches and never need to know
which package a given unit sits in.

Metrc reporting today is keyed directly on the package tag, with no batch record beneath it, and
the Hyperwolf catalog today has no batch record at all. The change described here is to introduce
the batch as the operator-facing key, with Metrc packages hanging underneath it as compliance
metadata — not to change what gets reported to the state, only what operators key their work on.

## 6. What we are asking of you now

Nothing needs to be built against this document yet. Please read it and send back questions —
particularly anything in the batch↔package relationship, the data shapes, or the Metrc mapping
that looks ambiguous or would need clarification before implementation.

Shape and validator: `@hyper-tech/contracts` 0.4.3 `Batch` is the authoritative source for every
field named above.
