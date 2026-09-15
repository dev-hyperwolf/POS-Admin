# Product Shells, Formats and Naming — Design Overview

*Hyperwolf internal design reference, shared for external development review.*

## 1. Purpose

Formats standardize how a product name is displayed to customers, on the point-of-sale screen and
on the website, so that the same kind of product looks the same way everywhere it appears. Shells
hold the fields that describe a family of products once — brand, format, default weight, unit and
pack — instead of repeating them on every product. Variations hold only the handful of fields that
differ from one product in a shell to the next, typically the strain or flavor name and, where the
format calls for it, a ratio, tier, or type. Batches sit one level below shells and variations: they
represent the physical lots of inventory that fulfill a given product over time. Batch detail is
out of scope for this document and will follow separately.

## 2. Definitions

**Format** — A named template that defines how a category of product is displayed: its naming
template, default weight/unit/pack, a Weedmaps taxonomy hint, and a delivery packing default. For
example, the Flower category has a "Smalls" format with the template `{name} {size} Smalls`.
Applied to the strain "Cereal Milk" at an eighth (3.5g), where `{size}` is empty for that weight,
the format produces "Cereal Milk Smalls"; the same format applied at a half ounce (14g) produces
"Cereal Milk Half Ounce Smalls".

**Shell** — One brand's instance of a format: a specific brand, format, weight/unit/pack
combination that many individual products can belong to. A shell does not appear to customers; it
is the grouping that products are organized under internally. Brand is never part of a product's
displayed name.

**Variation** — A single catalog product that belongs to a shell, carrying only what differs for
that product: the strain/flavor/product-name text, and optionally a ratio, tier, type, infused
flag, or sour flag, depending on which slots the shell's format template uses. Everything else
(brand, weight, unit, pack, category) is inherited from the shell.

**Naming template and slots** — The template is a short pattern of literal words and placeholder
slots, for example `{name} Live Resin Cartridge` (Vapes) or `{name} {ratio} Gummies` (Edibles). The
naming engine fills each slot from the variation's data and the shell's defaults and produces the
final display name — for example, the strain "Dosi Punch" in a 1g Vapes shell using the first
template above produces "Dosi Punch Live Resin Cartridge"; "Midnight Blueberry" with a 5:1 ratio in
the second template produces "Midnight Blueberry 5:1 Gummies."

**Weedmaps node** — A label on each format that records where that kind of product falls in the
Weedmaps product taxonomy (for example "Concentrates › Live Resin" or "Flower"). It is a display
hint today, held for the later work of binding it directly into an external taxonomy mapping.

**Delivery box** — A label on each format (and overridable per shell) recording which physical
packing/kit grouping that product belongs to for delivery fulfillment — a back-of-house packing
default, not something a customer sees.

**Front of house / back of house placement** — A shell can carry the two in-store locations where
its products live: the front-of-house location (the sales floor or display) and the back-of-house
location (stock room, vault or rack). Each is set per store, with a company-wide default that a
store may override, and both are optional. Variations inherit the shell's placement. These are
physical locations for restocking and counting, distinct from the Weedmaps node (taxonomy) and
the delivery box (packing).

## 3. Naming rules

Both naming engines implement one shared rule set:

- **Doc precedence, shorter wins.** Where Hyperwolf's naming convention document is silent or
  offers a choice, the shorter valid name wins.
- **No numeric weights in a name.** Tokens such as `1g`, `3.5g`, `100mg`, `30ml`, or `1/2 oz` are
  refused wherever they appear, whether typed into a strain/flavor field or hard-coded into a
  template's literal text.
- **Spelled-out flower sizes.** The `{size}` slot (Flower only) renders from the shell's weight:
  7g → "Quarter Ounce", 14g → "Half Ounce", 28g → "Full Ounce"; 3.5g (an eighth) renders nothing,
  so "Biscotti" stays "Biscotti" while the same strain at 7g becomes "Biscotti Quarter Ounce".
- **Pack counts as N-Pack.** The `{count}` slot reads the shell's pack size and renders as a bare
  number that the template pairs with a literal "-Pack", e.g. "Unruly OG 5-Pack"; where a pack has
  no strain, `{name|type}` falls back to the strain type, e.g. "Hybrid 10-Pack".
- **Optional slots**: `{ratio}` (normalized to `a:b` or `a:b:c` with no spaces, e.g. "Lights 2:1
  3-Pack"), `{tier}` (renders as "(Tier N)" at the end, e.g. "Lemon Cherry Runtz Live Resin Budder
  (Tier 4)"), `{type}` (Indica/Sativa/Hybrid), `{infused}` (literal "Infused" when set), `{sour}`
  (literal "Sour," leading, used on gummies, e.g. "Sour Kiwi Strawberry Gummies"). An unfilled
  optional slot collapses cleanly with its surrounding spacing rather than leaving a gap.
- **Casing and punctuation.** Title Case, with brand-internal capitalization preserved (e.g. all
  caps or mixed-case product names); strain crosses use a lowercase " x "; multiple flavors use
  " & "; "Pre-Roll," "N-Pack," "All-In-One," and "Roll-On" are always hyphenated the same way
  regardless of how they were typed; trademark marks (™/®) are stripped.
- **Refusals.** A name is refused (not produced) rather than silently accepted when: no usable
  strain/flavor/type text was supplied; a pack template is used without a valid pack count; a
  flower size template is used with a weight the engine doesn't recognize; a cannabinoid
  abbreviation (THC/CBD/CBN/CBC/CBG) appears in the name text; a numeric weight token appears in
  the name text or in the template's own literal text; or the template references a slot outside
  the known set, or omits both `{name}` and `{name|type}`.
- **Category-specific template guards**, enforced when a format is created or edited: a Pre-Rolls
  template must end in "Pre-Roll," "Infused Pre-Roll," or use the pack slot; a gummies-style
  Edibles template must end in "Gummies" or "Gummy Belts"; a Wellness template must end in
  "Tincture" or a topical noun.

The complete rule set is validated by a shared 87-case test fixture built from every example in
Hyperwolf's naming convention document, run against both engines: `shell_naming.py` (server-side,
Python) and `hw-naming.js` (browser-side, JavaScript). Both currently pass all 87 cases and agree
with each other on the same inputs. **`hw-naming.js` is the engine intended to be embedded in
production** — it needs no server round-trip and can render a name live as an operator types.

## 4. Data shapes

### Format

| Field | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | Slug, e.g. `live-resin-sauce-all-in-one` |
| name | string | yes | Display name, e.g. "Live Resin Sauce All-In-One"; unique per category |
| category | string | yes | Flower \| Pre-Rolls \| Vapes \| Concentrates \| Edibles \| Wellness \| Accessories |
| subcategory | string | no | Finer-grained grouping within the category |
| template | string | yes | Naming template (§3); validated on save |
| default_weight | number | no | Numeric only; never rendered in a name |
| default_unit | string | no | g \| mg \| ml \| ea |
| default_pack | integer | no | 1 for singles; 3/5/10/… for packs |
| wm_node | string | no | Weedmaps taxonomy hint |
| kit_box | string | no | Delivery packing default |
| sort | integer | no | Display order within the category |
| active | boolean | yes | Inactive formats are retained for history but cannot take new shells |

### Shell

| Field | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | Server-assigned, stable identifier |
| brand_key | string | yes | Brand identifier; brand is never shown in a product name |
| brand_name | string | yes | Display brand name |
| format_id | string | yes | References a Format |
| weight, unit, pack | number/string/integer | no | Defaults from the format; a brand may override |
| kit_box, wm_node | string | no | Defaults from the format; overridable per shell |
| name | string | derived | Internal label only, e.g. "Brand · Format Name"; not a customer-facing name |
| active | boolean | yes | |

Uniqueness: one shell per (brand, format, weight, unit, pack) combination.

### Variation / Product

| Field | Type | Required | Notes |
|---|---|---|---|
| sku | string | yes | Product identifier |
| shell_id | string | yes | References a Shell |
| variation slots | object | yes | `{name, ratio?, tier?, type?, infused?, sour?, effect?}` — only what differs per product |
| name | string | **derived** | Never typed directly; produced by the naming engine from the shell + slots, unless a manual override is set |
| name_override | string | no | Set only by a manager; when present, it — not the derived name — is what customers see |
| price | money | yes | |
| category, brand | string | derived | Inherited from the shell/format |

Fields carried by the broader product record (platform, source, sale price, on-hand quantity,
external ids) follow the existing catalog product contract and are unaffected by shells.

**Derived, never typed:** a product's display name and its category/brand are always computed
from the shell and its format, never entered as free text — this is what keeps every product in a
shell displaying consistently.

## 5. Behaviour rules

- **Renaming a format, or editing its template, ripples with a preview.** Every product the change
  would affect is listed with its current and resulting name, all pre-selected. Any subset can be
  unchecked (held back) or split off to a different existing or newly created format, in the same
  step — never applied all-or-nothing, and never one product at a time.
- **Deleting a format requires reassignment.** The delete action stays disabled until every shell
  and product on that format has a destination — either "move everything to…" a chosen format, or
  a destination chosen row by row. This action is restricted to managers.
- **Intake types the strain; the name is derived.** Adding a new product to a shell asks only for
  the strain, flavor, or product-name text (labelled according to what the format calls for), plus
  a ratio, tier, or type only when the format's template uses that slot. The resulting display name
  renders live as the operator types and cannot be typed directly.
- **Operator flags persist.** Manual flags set on existing products — discontinued, duplicate,
  manually unpublished — are retained across a catalog reload rather than being reset.
- **SKU handling.** A SKU is proposed automatically when a variation is created: a short brand
  code, the shell's weight digits and the product's initials (for example `HW-35-BD` for a
  Hyperwolf 3.5g "Blue Dream"). It can be edited before the product is saved. After save it is the
  external id that Weedmaps keys the product by, so it is treated as permanent.

## 6. Derivation (migration)

The Phase 1 migration reads a snapshot of Hyperwolf's own website catalog taken 2026-08-27
(1,619 products as loaded in the working copy). Product names on the live site are **not** rewritten by this phase; the derivation only
produces proposed shell placements and proposed names for review.

**Phase 1 brand scope**: Hyperwolf's own house brand plus its ten largest live-menu brands.

**Results**: 634 products fell within the Phase 1 brand scope. Of those, 611 were placed into 74
shells; 23 remained unplaced, each with a stated reason:

- 13 unplaced because their site subcategory was ambiguous across more than one shell shape (one
  brand)
- 9 unplaced because the SKU was absent from the live-menu data pulled for cross-reference
- 1 unplaced because the resulting name was refused by the naming engine's validation rules

The migration's **output is data** — proposed formats, shells, and product-to-shell placements —
which can be reviewed and imported. The **naming engine is code** (rules, not data) and needs to
run in production wherever a name is displayed or a new product is created, not only during this
one-time migration.

## 7. API surface

| Method | Path | Purpose |
|---|---|---|
| GET | /api/shells/formats | List formats with shell/product counts |
| POST | /api/shells/formats | Create a format |
| POST | /api/shells/formats/preview | Preview the effect of a rename/template edit (no write) |
| POST | /api/shells/formats/apply | Apply a rename/template edit, with per-row apply/split |
| POST | /api/shells/formats/delete | Delete a format, with reassignment of every shell on it (manager only) |
| GET | /api/shells | List shells, filterable by brand/format/category |
| GET | /api/shells/{id} | Get one shell with its format and products |
| POST | /api/shells | Create a shell |
| POST | /api/shells/delete | Delete a shell, requiring product reassignment or an empty shell |
| POST | /api/shells/{id}/variations | Create a product (variation) under a shell |
| POST | /api/shells/{id}/variations/{sku} | Update a variation; re-derives the name (or applies a manager override) |
| POST | /api/shells/name/preview | Preview a derived name for given slots (no write) |
| POST | /api/shells/derive | Run the migration derivation for a given brand list |
| GET | /api/shells/derive/{report_id} | Retrieve a stored derivation report |
| GET / POST | /api/shells/locations | List or create in-store locations (front or back of house, per store) |
| POST | /api/shells/locations/delete/preview, /delete | Delete a location after every shell on it is rebound (all-or-split) |
| GET / POST | /api/shells/{id}/location | Read or set a shell's placement, per store or company default |
| GET | /api/shells/products/{sku}/location | The effective placement of one product for a store |

## 8. What we are asking of you now

Nothing needs to be built against this document yet. Please read it and send back questions —
particularly anything in the data shapes, naming rules, or API surface that looks ambiguous or
would need clarification before implementation.

**What follows**: a companion document covering the batch level (the physical inventory lots
beneath shells and variations), and a proposal for how the implementation work will be divided.
