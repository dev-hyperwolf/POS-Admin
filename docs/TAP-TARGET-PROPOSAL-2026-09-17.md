# Tap-Target Size — Proposal for Owner Approval — 2026-09-17

**Status: design only. No source file has been changed.** This is the one-page decision doc
for the mockups at `explorations/Tap Targets - Before and After.html` (interactive) and the
review round at `explorations/review/tap-targets.html`. Nothing below is committed to code
until the owner picks a proposal.

## The finding

`pos/tokens.jsx:180` defines the control-height scale used by nearly every button, chip, row,
and toggle in the estate:

```js
ctrlH:{ xs:30, sm:34, md:40, lg:44, xl:48 },
```

Only `lg`/`xl` meet the 44px touch-target guideline. `sm`/`md` are the two most-used sizes
across the codebase (`pos/atoms.jsx`'s `PBtn`, `Seg`, and dozens of screen-level buttons all
size off this scale). `IconBtn` (`pos/atoms.jsx:248`) ignores the scale entirely and is
hard-coded to 40×40. `Check` (`pos/atoms.jsx:434`) is a bare 20×20 button with no padding, and
`Switch` (`pos/atoms.jsx:387`) is 20 tall × 37 wide. Per the Mobile-Readiness Audit
(`docs/MOBILE-READINESS-AUDIT-2026-09-17.md` §4, item 2), this is flagged independently by
every per-app sub-report and estimated to touch **100+ screens** — the single highest-leverage
shared-component fix in the whole audit, after the nav rail.

Three concrete screens were read directly (not from the audit's summary) to ground the mockups:

| Screen | File | Real violations found today |
|---|---|---|
| Register — New Sale | `pos/screen-register.jsx` (read-only, owner-locked) | Category/brand chips, suggest/rank toggle (`minHeight:40`, line 833/838), product-search icon button (38px, line 1408), waiting-strip claim button (`ctrlH.md`=40), `ProductRow` "Add" button (`minHeight:30`, line 2347) |
| Cart pane (mounted by Register) | `pos/screen-cart.jsx` | `Stepper size="sm"` (30×30, atoms.jsx:377), "Clear cart" / "Add promo code" links (`ctrlH.xs`=30, lines 525/972) |
| Driver App — Checkout | `mobile/screen-checkout.jsx` | Already mostly compliant — today's commit `7164204` bumped quick-cash chips to `minHeight:44`; the numeric keypad and primary CTA already use `PBtn size="lg"/"xl"` (44/48px) |
| METRC Pipeline — Inventory | `pipeline/screen-inventory.jsx`, `shared/hd-ui.jsx` | Product table rows are already 44px with an overflow-x wrapper (fixed since the audit — see the comment at screen-inventory.jsx:173 citing this same audit). Remaining: sort pills (32px, line 154), location segmented toggle (28px, line 163), `MultiSelectFilter` trigger (30px, `shared/hd-ui.jsx:95`), `Field size="sm"` (34px) |

This matters: the Pipeline Inventory screen shows the fix is **already partially landing
piecemeal** (the table wrapper was fixed, the toolbar pills were not) — a token-level fix closes
that gap in one place instead of screen-by-screen drift.

## Two proposals

### Proposal 1 — "Touch floor"

Nothing interactive drops under 44px **on touch-capable devices**. Mouse-only desktops are
left alone.

| Token / component | Today | Proposal 1 |
|---|---|---|
| `ctrlH.xs` | 30 | **40** visual, **44** hit-area via a negative-inset `::before` (no extra layout space consumed) |
| `ctrlH.sm` | 34 | **44** |
| `ctrlH.md` | 40 | **44** |
| `ctrlH.lg` / `xl` | 44 / 48 | unchanged |
| `IconBtn` | 40×40 fixed | **44×44** |
| `Check` | 20×20, no padding | glyph stays 20×20; **44×44 invisible hit box** via padding/pseudo, matching the existing pattern the estate already uses for icon buttons |
| `Switch` | 20 tall × 37 wide | glyph unchanged; **44×44 hit box** (asymmetric padding: ±12px vertical, ±4px horizontal) |
| `DataTable` dense row | 36px | **44px** minimum |
| Desktop-only back-office screens (mouse pointer) | — | **unchanged** — this proposal is conditioned on touch capability, not applied blindly |

**Screens fixed:** every touch-capable screen using `pos/atoms.jsx` — estimated 100+ per the
audit's own ranking, since `PBtn`/`Check`/`IconBtn` are shared. Desktop-only tools (Delivery
console, dashboard.html, most of `pipeline/`) are explicitly out of scope for this proposal and
keep today's density.

**Judgment call, flagged for the owner:** `Check`/`Switch` get the same hit-area treatment
under *both* proposals below — growing a checkbox glyph to a visible 44px square would look
wrong regardless of which control-height policy is chosen, so this piece isn't proposal-specific.

### Proposal 2 — "Uniform 44"

The same sizes everywhere, desktop included. No density tiers below 44 for interactive controls,
regardless of touch capability.

| Token / component | Today | Proposal 2 |
|---|---|---|
| `ctrlH.xs` / `sm` / `md` | 30 / 34 / 40 | **44, 44, 44** (direct — no hit-area trick, real visual growth) |
| `IconBtn` | 40×40 | **44×44** |
| `Check` / `Switch` | as above | same hit-area-only treatment as Proposal 1 |
| `DataTable` dense row | 36px | **44px** |
| Desktop-only / mouse-only screens | — | **also affected** — no exemption |

**Screens fixed:** the same 100+ as Proposal 1, *plus* every desktop-only back-office and admin
surface (roughly another 39 screens classed "Desktop-only" in the audit's totals). **Cost:**
those back-office screens get visibly denser-looking toolbars for no touch benefit — several
(METRC Pipeline, Delivery console, dashboard.html) are built assuming a mouse and a lot of
on-screen density; this proposal makes them permanently less dense even though nobody taps them
with a finger.

## Register — what actually moves

Register is owner-locked and was **not edited**; this is a design read of what the same code
would look like under either proposal, verified in the interactive mockup's "what moves" panel
(computed live from the rendered DOM, not estimated by hand).

- **Vertical, not horizontal.** The product tile grid is `repeat(auto-fill, minmax(252px,1fr))`
  (`screen-register.jsx:872`) — column count is driven by *width*, not by control height. Neither
  proposal causes wrapping or horizontal overflow at 1280px or at 1024px (a typical touch-terminal
  width).
- **The intake bar and category/filter row grow taller** as chips and toggle buttons go from
  ~30-40px to 40-44px. Net effect in the mockup: roughly 30-50px less vertical room for the
  product grid at both widths — in practice, about one fewer visible tile row before the cashier
  has to scroll. Open the mockup's Register tab and toggle "Show hit areas" + the fold notice to
  see the measured number at whatever width you're testing.
- **The cart pane's `Stepper`** (30×30 → 44×44) makes each line item taller, so a long ticket
  scrolls its own line list slightly sooner — the cart already has its own internal scroll, so
  this doesn't touch the page-level layout.
- **The 408px fixed cart-pane width itself is untouched by either proposal** — this is purely a
  control-height question, not a column-width one.

### Register-only mitigation (recommended if the owner wants the touch benefit without the layout risk)

**Mitigation 1 — hit-area only, zero visual change (built in the mockup's third tab).** Every
undersized Register control keeps today's exact pixel box — same paint, same row heights, same
grid — and gains an invisible negative-inset hit zone reaching 44px. With the mockup's overlay
off, the mitigation tab is pixel-identical to Before; with it on, the enlarged (but invisible)
tap zones are visible. This is the same technique Proposal 1 already uses for `Check`/`Switch`
and for `ctrlH.xs`, just applied to every Register control instead of a subset.

**Mitigation 2 — spacing only, not a full fix (not built, described here for completeness).**
The one place Mitigation 1 can't cleanly apply is the category-chip row, where chips sit
back-to-back with only ~7px of gap — expanding each chip's invisible hit zone that much would
make neighboring chips' hit zones overlap. The fallback there is to widen the *gap* between
chips instead of the box. This reduces mis-taps but does **not** reach the 44px target-size
standard, so if the owner picks it for that one row, it should be recorded as a knowing
exception, not represented as compliant.

**Trade-off to be explicit about:** the mitigation gets Register's *worst* offenders (the
30px `ProductRow` Add button, the Stepper, the cart's text links) to a real 44px tap zone with
zero layout risk, but it doesn't fix the *visual* density problem the audit also flagged — the
controls will still *look* small even though they're now easy to hit. Proposal 1 or 2's direct
sizing fixes both; the mitigation only fixes the tap accuracy.

## Accessibility references

- **WCAG 2.2 Success Criterion 2.5.8 Target Size (Minimum)** — Level AA, 24×24 CSS px floor
  (with exceptions for inline text links and equivalent controls). <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- **WCAG 2.2 Success Criterion 2.5.5 Target Size (Enhanced)** — Level AAA, 44×44 CSS px, the
  standard both proposals target. <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html>
- **Apple Human Interface Guidelines — Layout** — minimum 44×44 pt tap target.
  <https://developer.apple.com/design/human-interface-guidelines/layout>
- **Material Design 3 — Accessibility, touch target size** — minimum 48×48 dp recommended, 24dp
  absolute floor. <https://m3.material.io/foundations/accessible-design/overview>

## Rollout / rollback

- **One commit, tokens only.** All sizing lives in `pos/tokens.jsx` (`ctrlH`) and
  `pos/atoms.jsx` (`Check`, `Switch`, `IconBtn`, `DataTable` dense row). No screen file needs to
  change for either proposal to take effect, since screens already read these tokens rather than
  hard-coding sizes — the exceptions found during this review (Register's inline pixel values,
  the Pipeline toolbar's inline pixel values) are pre-existing drift from the tokens, not new
  work created by this proposal, and are a natural follow-on cleanup either way.
- **Behind a body class**, e.g. `document.body.classList.toggle('hw-touch-floor', …)`, so the
  new sizing can be switched off instantly without a redeploy if it causes a layout regression
  somewhere the audit didn't catch. Default off until the owner approves; default on once shipped.
- **Rollback** is deleting the one class/commit — no data migration, no schema, no deployment
  dependency.

## Recommendation

Ship **Proposal 1 (Touch floor)** as the token-level default — it captures the same 100+ screen
win as Proposal 2 without imposing a density cost on mouse-only back-office tools that were
never the problem. Layer the **Register-only mitigation** on top rather than Register's full
Proposal 1 sizing, at least for the first release: it removes Register's real tap-accuracy risk
(the 30px Add button and Stepper are the two most-tapped controls on the busiest screen in the
estate) with the fold-loss risk measured in this doc's mockup being zero, not "probably fine."
If the owner reviews the mockup and decides the visual growth on Register is worth the lost row,
switching Register from the mitigation to full Proposal 1 sizing is a one-class change, not a
redesign.
