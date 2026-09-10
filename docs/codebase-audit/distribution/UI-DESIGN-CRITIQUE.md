# Distribution screens — UI design critique

Scope: `hyperwolf-super-admin/src/components/distributionSetting/**` — read-only review, no
edits made under `hyper-tech`. Primary evidence: `distributionManagement/index.js` and
`distributionManagement/distributionDetails/index.js` (manage-distributions list + detail),
`refillLogs/index.js` and `refillLogs/components/refillDetails.jsx` (kit refill list + detail),
`distributionManagement/addRegionKit/index.js` (the form), `common/component/StatusText.jsx`
(status encoding), `components/tables/AgGridAccordionTable.jsx` +
`components/tables/CommonAgGridTable.jsx` (the shared table), `assets/theme/base/colors.js` +
`typography.js` (the design tokens that exist), `styles/custom.scss` (11,935 lines, confirmed
by `wc -l`). Backend context: `docs/codebase-audit/distribution/DISTRIBUTION-LOGIC-MAP.md` §1–3, §5.

## 1. What the system actually is today

Material Dashboard 2 React (MUI) with a real token file (`assets/theme/base/colors.js`,
`typography.js` — Inter, a 10-step type scale, a 9-color semantic palette) that the
distribution screens mostly **do not use**. Every screen instead:

- Hardcodes literal hex inline via `sx`/`style` — `#2E2E3A`, `#656575`, `#9A9AAF`, `#D0D0DA`,
  `#f7f7f9`, `#F2F3F7`, `#f5f5f5`, `#d9d9d9`, `#8E0CF5` — none of which trace back to
  `colors.js` (`dark.main` is `#2E2E3A` and `grey.600` is `#656575`, so two of these *are* the
  theme's values, just re-typed instead of referenced; `#8E0CF5`, `#f5f5f5`, `#d9d9d9` aren't in
  the palette at all). Evidence: `refillDetails.jsx:76-77,131,162-167,226,396,405,423,605,619,630`;
  `distributionDetails/index.js:246,274,282,298,308,321,351,394,400`; `addRegionKit/index.js:150,224,226`.
- Overrides MUI's own `MDButton` with `!important` on background/color/border on nearly every
  button instance (10+ occurrences across two files) rather than adding a variant — the code is
  visibly fighting its own component API. Evidence: `refillDetails.jsx:396,405,423,630`;
  `distributionDetails/index.js:246,274,298,321,351`.
- Leans on one 11,935-line global `styles/custom.scss` for layout that the theme file doesn't
  own at all (grid columns, accordion rows, sidebar widths) — a second, uncoordinated styling
  system sitting beside the MUI theme.

## 2. What works

- The MUI theme itself is coherent: one font (Inter), a real type scale, a real 9-color
  semantic palette (`primary/secondary/info/success/warning/error/light/dark/grey`) — the
  raw material for a good system exists, it just isn't reaching these screens.
- `AgGridAccordionTable` (`components/tables/AgGridAccordionTable.jsx`) is a reasonable shared
  pattern: one row = one summary line, expand for the region/sub-region breakdown, infinite
  scroll instead of pagination controls. The instinct to have one shared table component is right.
- The master/detail layout (region list on the left, product grid on the right) matches how an
  operator actually thinks about the data — regions first, then products within a region.

## 3. What fails, and what it costs

### 3.1 Status color has collided into meaninglessness
`common/component/StatusText.jsx:24-113` hardcodes 20 status strings to hand-picked hex, and the
same color is reused for unrelated states:
- **`#24CA49` (green)** → active, distributed, dispatched, verified, approved, closed, "verified
  and dispatched", completed, resolved — **9 different states, one color.**
- **`#8E0CF5` / `#A162F7` (purple)** → pending, freeze, "closure pending", "verification in
  progress" — **4 different states, one color family**, and neither purple exists in
  `colors.js` at all.
- Any status string **not** in this hardcoded map falls through to the default at line 117 and
  renders **error red** (`#FD4438`) regardless of meaning. `paused`, `short`, and `skipped` —
  three of the eight states this brief asks the mockup to encode — **are not in the map**, so if
  the backend ever emits them today, they render as an alarming failure color for what may be a
  routine skip. This is a real, load-bearing bug, not a hypothetical.
- Cost to the operator: scanning a table of 20 kits, nine of them green tells you nothing about
  *which* stage each is actually in — you have to read the caption-sized text next to the icon
  every time, which defeats the point of a status color.

### 3.2 No responsive layout at all
`grep -c "@media" styles/custom.scss` returns **0**. The two-column shell used by both detail
screens is fixed-pixel: `.dis-sidebar-left { width: 300px }` and
`.dis-con-right { width: calc(100% - 324px) }` (`custom.scss:7860,7930`). Table columns also
carry fixed `minWidth` in px that sum well past a tablet viewport
(`refillLogs/index.js:39` `minWidth:400`; `refillDetails.jsx:115,183,191,199`
`minWidth:200/80/80`). On a warehouse tablet (768–1024px, frequently portrait), the sidebar
never collapses and the grid can't shrink — the operator gets a pinned 300px sidebar plus a
horizontally-scrolling table, i.e., two independent scroll axes on one screen. This is the
single biggest reason a warehouse tablet user would give up and go back to paper.

### 3.3 Touch targets are mouse-sized
Row actions are `IconButton size="small"` with 16px icons (`refillLogs/index.js:74-87`,
`refillDetails.jsx:213-229`) — MUI's small `IconButton` padding yields roughly a 28–30px hit
box, well under the ~44px minimum usable with gloves or a moving cart. Row height itself is
`56px` (`CommonAgGridTable.jsx:190`), so there's room in the row; the interactive element inside
it just doesn't use it.

### 3.4 No consistent visual hierarchy between actions
Every button on `distributionDetails` and `refillDetails` — "Low Stock Products" (informational),
"Distribute"/"Refill Kit" (the primary action), "Get Box PDF"/"Get Driver Kit PDF"/"Pick Slip
PDF" (secondary/export), "Reset Distribution" (destructive), "Bulk Update" — is the same
`MDButton variant="contained"` at nearly the same height (36–47px), differentiated only by
one-off inline colors. Nothing signals "this is the one action that matters on this screen"
(`distributionDetails/index.js:244-335`, `refillDetails.jsx:394-438,602-633`).

### 3.5 Status text is the smallest, least prominent thing in the row
`StatusText.jsx:27` renders the label as MUI `variant="caption"` (12px) — the smallest type step
in the whole scale — while the row's other fields use body text. The single field an operator
scans a list *for* (what stage is this kit in?) is typographically the least important thing on
the row.

### 3.6 Dark mode exists in the theme and is broken by these screens
`App.js:23,497` wires a real `themeDark` (there's a whole parallel `assets/theme-dark/` tree).
But because every distribution screen hardcodes literal light-mode hex with `!important`
(`background: "#ffffff !important", color: "#2E2E3A !important"` — `refillDetails.jsx:405`,
`distributionDetails/index.js:274,298`), toggling dark mode leaves white buttons floating on a
dark canvas. The theme was built to support two modes; these screens silently opt out of one.

### 3.7 Empty, loading, and error states are one generic each
Every list uses the same bare `<CircularProgress size={32} />` (`AgGridAccordionTable.jsx:184-186,196-199`)
and the same generic `<NoDataFound />` (line 254) regardless of *why* the list is empty — no
distinction between "nothing has ever been distributed here," "no results match your filter,"
and "the request failed." Failures only ever surface as a transient MUI Snackbar
(`openSnackbar` in `redux/slices/common`) that disappears in a few seconds — on warehouse wifi,
a failed fetch just leaves a permanently-empty-looking screen with no retry affordance.

### 3.8 Dead code shipped into production JSX
Large commented-out blocks sit inside the live component tree — 55 lines in
`refillDetails.jsx:455-485` duplicating the block directly below it with a stale field name,
plus `distributionManagement/index.js:117-126`, `refillLogs/index.js:223-230`,
`distributionDetails/index.js:387-390`. Harmless to runtime, but it's a signal nobody is
treating this screen as a finished design — which tracks with why the visual language has
drifted screen to screen.

### 3.9 The gap the backend logic map already names
Per `DISTRIBUTION-LOGIC-MAP.md` §2, freshness ("received in the last 7 days") is not read by
build or refill at all today, and §5 lists "every skip and shortfall recorded with a reason" as
target behavior, not current behavior — so a "why was this skipped" UI has no backing field yet.
§3.1 also means an "already refilled today" guard can't be trusted at the hour boundary until
the three definitions of "today" become one Pacific clock. The mockup below assumes those two
backend fixes land (Option B in the logic map); it is the UI target, not a claim about what the
API returns today.

## 4. Token-level proposal (bring it in line with Bounty / Verify)

**Palette** — stop inventing hex per screen; use exactly these, sourced from the same family
this estate already uses elsewhere (`pos/tokens.jsx`): warm paper surfaces
(`#F4F2EC` / `#FFFFFF`), near-black ink (`#0F0F0C`), one yellow accent used only for the
single primary action per screen, and five semantic tones — `good` (green), `warn` (amber),
`bad` (red), `info` (blue), `neutral` (grey) — each with a soft background wash for pills.

**Type scale** — seven steps with jobs, not ten steps with none: `micro` (10, unit labels),
`meta`/`body` (11.5/12.5, table cells), `strong` (13.5, emphasis), `title` (16, section
headers), `h2`/`h1` (21/30, page headers). Status text moves from `caption` to `strong` — it
should never be the smallest thing in the row.

**Status colors — eight states, five tones, never color alone.** The token file's own hue set
is documented "decorative only, never status" (`pos/tokens.jsx:66`) — correctly; that's not
where these eight belong. Every status is icon + label + color, so no two ever collide when
color-blind or on a washed-out warehouse tablet screen in direct light:

| Status | Tone | Icon | Note |
|---|---|---|---|
| Building (splitting) | `warn` (amber) | refresh | in progress |
| Frozen | `info` (blue) | lock | locked for dispatch |
| Dispatched | new `transit` (teal) | truck | on its way, not yet counted in |
| Refilled / Distributed | `good` (green) | check-circle | done today |
| Closed | `ink` solid chip | check | archived, day is over |
| Paused (merges "on hold") | `neutral` (grey), solid border | pause | held on purpose |
| Skipped | `neutral` (grey), **dashed** border | skip-forward | not held — just not touched this pass |
| Short | `bad` (red) | alert-triangle | needs a decision today |

Unknown/unmapped status strings render **neutral grey with the raw label**, never red by
default — closing the exact bug in §3.1.

**Density rule**: table rows stay 44px minimum (not 56px of dead space around a 16px icon);
every clickable control gets a real 40–44px hit box regardless of visual icon size.
**Responsive rule**: the fixed 300px sidebar collapses to a horizontal scroller (or a
`<select>`) under 1024px; no screen ships without at least one breakpoint.

## 5. What the mockup changes

`Distribution Console - Refill Day.html` is one screen built around the two reported failures —
premium stock sitting for a week, and refill quantities that don't match sales — rather than
the current generic list. It surfaces "received in last 7 days" as its own lane with a one-tap
partial-send, replaces the opaque refill number with an editable line-item table that shows
*Sold since last refill → Need → Cap → Will give → Reason* per row, gives the day a visible
built→frozen→dispatched→refilled→closed timeline with who/when, and puts every skip and
shortfall in one panel in plain language instead of leaving the operator to guess why a SKU
didn't show up in a box.
