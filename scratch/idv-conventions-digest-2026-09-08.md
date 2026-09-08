# POS-Admin conventions digest — for the ID Verification console build

Compiled 2026-09-08 for the team building **Hyperwolf IDV** (working name) inside the
`/Users/jt/POS-Admin` frontend estate. Every claim below cites an exact file and line range.
This is a reference digest, not the plan — see `docs/PROMPT-IDV-MODULE-KICKOFF.md` and
`scratch/didit-reference-digest-2026-09-08.md` for product scope. Read `incentives/` and
`Hyperwolf Bounty.html` as the template: it is the newest app, built 2026-09-08 to these exact
rules, and IDV should copy its shape file-for-file.

---

## 1. `CLAUDE.md` (project root) — the map, in full

Full file: `/Users/jt/POS-Admin/CLAUDE.md` (135 lines). Key facts an IDV builder needs:

- **L1-4**: `Hyperwolf.html` is the hub/index of record. Every live surface must be linked from
  it, updated in the same turn a file is added/renamed/retired.
- **L6-22**: the "one HTML at root + one folder of screens" pattern, with the live-app table.
  IDV will add a row here: `| ID Verification | \`Hyperwolf IDV.html\` | \`idv/\` |` (naming TBD).
- **L24-70**: the shared-by-everything list (mirrors the digest sections below): `pos/tokens.jsx`,
  `pos/icons.jsx`, `pos/atoms.jsx`, `shared/app-nav.js`, `shared/brands.js`, `shared/hd-ui.jsx` +
  `shared/hd-format.jsx`, `shared/app-rail.jsx`, `shared/states.jsx`, `shared/commerce-engine.js` +
  `shared/commerce-adapter.js` (not relevant to IDV), `shared/hw-wait.js`, `shared/id-photos.jsx`
  (**the one ID/passport photo control — IDV must absorb this, never fork it**, L60-66),
  `shared/app-switcher.js`, `shared/tour-steps.js` + `shared/tour.js`, `shared/notes.js`.
- **L72-79**: exact script load order every app HTML follows — see §6 below for the two concrete
  examples (Bounty, Engage).
- **L81-88**: `explorations/` = "pick a direction" studies, linked from the hub, folded into the
  live app and deleted once a direction is chosen. `exports/` = auto-generated standalone
  offline builds, never hand-edited. `uploads/` = the user's own files, never touched.
- **L89-95**: repo mirrors 1:1 to `dev-hyperwolf/POS-Admin` on GitHub Pages. Four root files must
  stay intact: `README.md`, `HANDOFF.md`, `index.html`, `.nojekyll`.
- **L97-110 — design-system rules from the UI audit** (verbatim, these are hard rules):
  1. One accent per view — solid `accent` is the single most important action on screen.
  2. **Never write a colour literal. Zero hex outside `pos/tokens.jsx`.**
  3. Type comes from `P.type` only — micro 10 · meta 11.5 · body 12.5 · strong 13.5 · title 16 ·
     h2 21 · h1 30, plus numRow 15 / numTotal 21. Nothing below 10px, ever.
  4. Controls use `P.ctrlH` (30/34/40/44/48) as `minHeight`. Anything a hand touches is 40+.
  5. A card has a border OR a shadow, never both — `elevation` (flat/raised/sunken) +
     `density` (compact/default/roomy), not a padding number.
  6. Radius by role: 8 controls · 12 cards · 20 sheets · 999 pills.
  7. Focus is automatic (`:focus-visible` ring injected by `pos/tokens.jsx`); add `data-hw-i`
     only to non-button interactives (table rows, custom chips).
- **L112-126 — Tests**: `npm test` (node --test, zero deps). `.jsx` screens are NOT covered by
  automated tests — babel-in-browser, no build step; verify by loading the page.
- **L128-135 — Rules**: no orphan source files; no duplicate standalone exports; don't scatter
  QA screenshots; new design versions go in as a toggle/tab inside the existing app, never a new
  root file; every app renders the shared rail and appears in `shared/app-nav.js`,
  `shared/app-switcher.js` and the hub — **all three, same turn**.

---

## 2. `pos/tokens.jsx` (234 lines) — the only place colour/type/space/radius live

Two full theme objects, `LIGHT` (L6-82) and `DARK` (L84-141), merged with a mode-independent
`SHARED` block (L144-195) into `THEMES = { light, dark }` (L197-200). Consumed via
`useP()` / `useTheme()` (L202-204) inside a `ThemeProvider` (L206-232) that persists mode to
`localStorage['hw-pos-theme']` and injects the global `:focus-visible` CSS (L216-227).
Exported: `Object.assign(window, { THEMES, ThemeCtx, useP, useTheme, ThemeProvider })` (L234).

**Rule, restated from CLAUDE.md**: "Hyperwolf yellow (`#FFD100`) is the ONLY brand accent" (L3).
Every other colour is a token; a new screen never writes a hex literal.

### Token groups (name → representative light-mode value; each has a dark-mode counterpart)

- **Surfaces** (L8-13): `bg #F4F2EC`, `bg2`, `surface #FFFFFF`, `surface2`, `surface3`.
- **Rail** (L14-19): `rail` (near-black), `railInk`, `railBright`, `railHover`, `railActive`,
  `railHair`. `scrim` (L20) is the modal/overlay dim colour.
- **Ink** (L22-27): `ink`, `ink2`, `inkDim`, `inkMute`, `inkFaint` — a five-step opacity ramp.
- **Hairlines** (L29-32): `hairline`, `hairline2`, `hairline3`.
- **Accent** (L34-42): `accent #FFD100`, `accentInk`, `accentSoft`, `accentBorder`,
  `accentHover`, `accentActive`, and **`accentText`** — "the ONE place that gold exists" for text
  on a light surface, because raw yellow fails contrast as text (L40-42).
- **`highlightSoft`** (L43-44): neutral "notice" wash, replaces decorative uses of `accentSoft`.
- **Focus/disabled** (L45-47): `focusRing` (a full box-shadow string, not a colour), `disabledBg`,
  `disabledInk`, `disabledBorder`.
- **Signals** (L49-61): `good`/`goodSoft`, `warn`/`warnSoft`/**`warnText`** (a separately-tuned
  darker amber for text-on-`warnSoft`, because the signal colour and the readable colour are not
  the same colour — L52-58), `bad`/`badSoft`, `info`/`infoSoft`, `neutral`/`neutralSoft`.
- **Strain** (L63-64): `indica`, `sativa`, `hybrid`.
- **`hue`** (L66-69): decorative categorical wayfinding (`blue/violet/teal/green/pink`) —
  DEPRECATED for new work except Engage stat tiles.
- **`canvas`/`canvas2`** (L71-74): dense-surface fill, now unified with `bg`/`bg2`.
- **Field** (L76-77): `field`, `fieldBorder`.
- **Shadows** (L79-81): `shadowSm`, `shadowMd`, `shadowLg` — each a two-layer box-shadow string.
- **`SHARED` block** (mode-independent, L144-195):
  - `z` — the stacking scale, sourced from `window.HW_Z` (plain script `shared/hw-z.js`, must
    load first) with an in-file fallback object if that script is missing (L160-167). Keys:
    `content 0, sticky 10, dropdown 60, chromeDock 64, chromeBar 66, chromeMenu 68, scrim 300,
    modal 310, modalPop 320, toast 400, notePin 500, notePanel 510, notePop 520, tourMask 600,
    tourCard 610`.
  - `brand` (L171): third-party brand marks, e.g. `weedmaps:'#1F5FC0'` — not themeable, still not
    a literal in a screen file.
  - `imgScrim` (L174): scrim for a chip over a product image.
  - **Radius** (L177): `r6, r8, r10, r12, r14, r16, r20, r24, r999` — by ROLE per rule 6 above
    (`r6`/`r16`/`r24` deprecated, kept for old call sites).
  - **`ctrlH`** (L180): `{ xs:30, sm:34, md:40, lg:44, xl:48 }`.
  - **`space`** (L182): 4px scale `{ x1:4, x2:8, x3:12, x4:16, x5:20, x6:24, x8:32 }`.
  - **`type`** (L185): `{ micro:10, meta:11.5, body:12.5, strong:13.5, title:16, h2:21, h1:30,
    numRow:15, numTotal:21 }`.
  - `weight` (L186): `{ body:500, emph:600, num:800 }`.
  - `fontSans` (L187): `"Inter", -apple-system, system-ui, sans-serif`.
  - `fontMono` (L188): `"JetBrains Mono","SF Mono",ui-monospace,monospace`.
  - **`cat`** (L190-194): product-category accent colours — `flower, vape, edibles, concentrate,
    tincture, preroll, wellness, deals, premium, other`. IDV has no product category use, but this
    is the pattern to follow if IDV ever needs a fixed enum→colour map (e.g. document type or
    risk-tier colours) — add a new named group here, not literals in a screen.

---

## 3. `pos/atoms.jsx` (439 lines) — every exported primitive

All exports are `window.<Name>` assignments (no ES modules); every primitive reads `useP()` for
live theme tokens. One-line purpose + prop signature for each:

| Atom | Signature (destructured props) | Purpose |
|---|---|---|
| `Card` (L12-32) | `{ children, padding, density='default', elevation='flat', radius, style, onClick, hover }` | The one card shell. `elevation`: flat (border, in-page) / raised (shadow, popovers/sheets) / sunken (canvas2 fill, wells/empty states). Never both border+shadow. |
| `overlayScrim(P, opts)` (L78-94) | function, not component | Returns the style object for a modal's fixed scrim — `alignItems:'flex-start'` + the card's own `margin:'auto'` (see the load-bearing comment on why, L41-77) so an overflowing modal never strands content above the viewport. |
| `overlayCard` (L109) | `{ margin:'auto', flex:'0 1 auto' }` | Paired style object for the modal card itself. |
| `Eyebrow` (L112-115) | `{ children, color, style }` | Mono, uppercase micro-label. |
| `SectionHead` (L118-142) | `{ eyebrow, title, subtitle, action, level=2, style }` | h1/h2/h3 header with eyebrow + subtitle + right-aligned action. |
| `KPI` (L145-168) | `{ label, value, sublabel, delta, deltaKind, hint, accent, icon, spark, sparkColor, onClick }` | KPI tile with optional sparkline and delta arrow. |
| `Spark` (L170-180) | `{ data, color, height=22, width=96, fill }` | Inline SVG sparkline. |
| `Pill` (L185-203) | `{ kind, tone, label, children, dot, icon, soft, size, style }` | Status pill. Accepts BOTH the POS `kind` vocabulary (good/warn/bad/info/accent/neutral/ghost/dark) and the Hyperdrive `tone` vocabulary (ok/warn/blocked/quarantine/sealing/brand/archived/info/neutral) — HD tones map onto the nearest POS kind (L188-189). |
| `PBtn` (L210-244) | `{ variant='secondary', size='md', children, icon, iconRight, onClick, disabled, busy, active, full, style, title }` | The one button. Variants: primary (ink-filled), accent (the one action), secondary (outline), soft (deprecated alias), ghost, danger. Sizes xs/sm/md/lg/xl are MIN-HEIGHTS from `P.ctrlH`. |
| `IconBtn` (L248-259) | `{ icon, size=18, onClick, badge, badgeColor, tone='ghost', title, label, style }` | 40×40 icon-only button; `label` becomes the accessible name when there's no visible text. |
| `Seg` (L262-273) | `{ value, onChange, options, size='md', full }` | Segmented control. |
| `Tabs` (L276-284) | `{ value, onChange, options, style }` | Underline tabs. |
| `BarMeter` (L287-294) | `{ value, max=1, color, height=6, showLabel, width }` | Progress bar. |
| `Thumb` (L297-306) | `{ item, size=42, radius=9 }` | Product-thumbnail gradient (not relevant to IDV). |
| `Avatar` (L309-319) | `{ name='', size=34, hue, crown }` | Initials avatar with deterministic hue from name; optional crown badge. |
| `Field` (L322-332) | `{ icon, placeholder, value, onChange, size='md', suffix, full=true, style, mono }` | Text input; focus ring is `P.info` (blue), never yellow — "yellow means primary action" (L321). |
| `DualRange` (L342-373) | `{ min, max, valueMin, valueMax, onChange, step=1, formatLabel, toPos, toValue }` | Dual-handle range slider, two stacked native `<input type=range>` for full keyboard operability. |
| `Stepper` (L375-384) | `{ value, onChange, min=0, size='md' }` | +/- quantity stepper. |
| `Switch` (L387-392) | `{ on, onChange, size=20 }` | Toggle switch. |
| `StrainPill` (L395-405) | `{ type, thc, size='sm' }` | Cannabis strain pill (not relevant to IDV). |
| `DataTable` (L408-431) | `{ columns, rows, dense, onRowClick, stickyHead, rowKey, selectedKeys, style }` | The one data table. `columns[i]` = `{ label, key, align, width, render(row) }`. Empty state built in ("No results"), but the estate's convention is to prefer `EmptyState`/`SkeletonRows` around it for real screens. |
| `Check` (L434-438) | `{ on, onChange, size=20 }` | Checkbox. |

Every interactive atom carries `data-hw-i` so the shared `:focus-visible` CSS rule
(`pos/tokens.jsx` L220-226) applies automatically.

---

## 4. `shared/states.jsx` (81 lines) — Empty / Loading / Error, verbatim copy

Three exports, all reading `useP()`, all "one icon, one line of plain language, one action. No
illustrations, no apologies" (L4-5):

- **`EmptyState`** (L9-23) — `{ icon='shield', title, body, action, compact, style }`. "There is
  nothing here YET." No default title (caller-required); optional `body`/`action`.
- **`Skeleton`** (L27-39) — `{ lines, w, h=12, radius, gap=8, style }`. Shimmer-gradient bar(s);
  `lines` mode renders N bars with the last at 62% width.
- **`SkeletonRows`** (L42-53) — `{ rows=3, avatar=true, style }`. List-shaped default: avatar +
  two skeleton lines, N times, inside bordered rows.
- **`ErrorState`** (L56-79) — `{ title='That didn't load', body, detail, onRetry, compact, style
  }`. **Default body, verbatim**: *"The data didn't come back. Nothing was changed — try again,
  and if it keeps failing tell an admin."* Renders an optional `onRetry` "Try again" button and a
  collapsible `detail` block (monospace, for raw error text — never shown by default).

`Object.assign(window, {})` at L81 — this file leaks nothing extra; `HDEmpty` (alias of
`EmptyState`) is actually defined in `shared/hd-ui.jsx` L50-52, not here.

**The estate's "not connected" copy pattern** (from `incentives/inc-shared.jsx` L186-191, the
exact model IDV should follow):

```jsx
window.IncShared.NotConnected = function NotConnected({ onRetry, compact }) {
  return (
    <ErrorState compact={compact} title="Bounty isn't connected"
      body="Needs the wmdemo backend — not reachable right now. Standings, bounties and earnings will appear here once it connects."
      onRetry={onRetry} />);
};
```

IDV's equivalent (module-local, in an `idv-shared.jsx` or similar) should read e.g. `"IDV isn't
connected"` / `"Needs the wmdemo backend — not reachable right now. Sessions, reviews and lists
will appear here once it connects."` — same shape, own nouns.

---

## 5. `shared/hd-ui.jsx` (219 lines) — the Hyperdrive UI kit

IIFE-wrapped (`;(function () { … })()`, L5-219), used by the pipeline and Engage; consumable by
IDV for anything table/tone/sheet-shaped that the POS atom set doesn't cover:

- `HDPill` (L13-22) — `{ tone='neutral', label, children, icon=true, size='md', title, style }`.
  Tone-aware pill using `HD.tone(P, tone)`; icon defaults by tone via `TONE_ICON` map (L9).
- `StatTile` (L25-46) — `{ icon, label, value, sub, hue='info', progress, onClick, style }`. Card
  with a 3px coloured top strip + hue wash + icon chip + optional progress bar.
- `HDEmpty` (L50-52) — deprecated alias of `window.EmptyState`.
- `UidChip` (L55-76) — `{ value, kind='auto', expanded, size='sm', showPrefix=true,
  onClickBehavior='expand', style }`. METRC-blue / HUID-gold chip, click to expand, copy when
  expanded. Not directly relevant to IDV but the click-to-expand-then-copy pattern is reusable
  for e.g. a session ID or document number chip.
- `MultiSelectFilter` (L79-123) — `{ label, options, value, onChange, align='start' }`. Dropdown
  multi-select filter chip used across filter bars — directly reusable for IDV's
  verifications-table filters (status, workflow, store).
- `Sheet` (L126-143) — `{ open, onClose, side='right', width=460, children }`. Right-hand (or
  bottom) drawer, Escape-to-close, scrim click-to-close. Use for session detail / review panels.
- `ToastHost` (L146-169) — mounts once, installs `window.hdToast({ title, description, tone,
  action })`. **Every app must mount `<ToastHost/>` once** or write outcomes are silent no-ops
  (see Bounty's comment on this, `incentives/app.jsx` L301-303).
- `HDTable` / `TH` / `TD` / `TR` / `SortableTH` (L172-198) — raw table primitives, 34px compact
  rows, uppercase micro-label heads. `SortableTH` takes `{ label, k, sort, onSort, align }` where
  `sort = { key, dir }`.
- `MicroLabel` (L201-204) — uppercase micro-label div.
- `MetaCell` (L205-212) — `{ label, value, mono }` — label-over-value composite for detail panels.
- `DisplayNum` (L215-218) — `{ children, size=22, style }` — big tabular-mono metric for page
  headers.

---

## 6. How an app gets a rail item, a switcher entry, and a home card

### 6.1 `shared/app-nav.js` (48 lines) — `window.HW_NAV`

One `ITEMS` array (L6-29), each `{ id, label, icon, pos? | href? }`. `pos` routes inside the POS
app (sets `localStorage['hw-pos-route']` then navigates to `Hyperwolf POS.html`, L34-46); `href`
navigates to a standalone app HTML directly. Example (Bounty's own entry, L20-22, chosen to sit
next to Members "People-adjacent... the same people Members tracks identity for"):

```js
{ id: 'bounty', label: 'Bounty', icon: 'trophy', href: 'Hyperwolf Bounty.html' },
```

IDV's entry would be similarly placed near Members/identity-adjacent items, e.g.:
```js
{ id: 'idv', label: 'ID Verification', icon: '<pick or add an icon>', href: 'Hyperwolf IDV.html' },
```
Exported: `window.HW_NAV = { items: ITEMS, settings: SETTINGS, all: ITEMS.concat([SETTINGS]), go
}` (L47).

### 6.2 `shared/app-rail.jsx` (55 lines) — `window.HWRail`

One component, every app renders `<window.HWRail active="<its id>" onNav={...}/>` (L9). Reads
`window.HW_NAV.items` directly (L50) — nothing to configure per-app beyond registering in
app-nav.js. Auto-scrolls the active item into view on mount/resize (L14-24).

### 6.3 `shared/app-switcher.js` (113 lines) — floating cross-app launcher

Plain JS, self-mounting, one `APPS` array of `[href, label, shortId]` tuples (L7-23). Bounty's
entry (L13): `['Hyperwolf Bounty.html', 'Bounty', 'bty']`. IDV adds a matching row. Included via
`<script src="shared/app-switcher.js"></script>` (root apps).

### 6.4 `Hyperwolf.html` (229 lines) — the hub card

Two `.grid` sections: "Staff apps" (L73-141) and "Customer & driver apps" (L146-166), each a
`<a class="card" href="...">` with `.arw` (external-link glyph), `.ic` (24×24 inline SVG icon),
`.nm` (name), `.ds` (one-line description). Bounty's exact card (L92-97):

```html
<a class="card" href="Hyperwolf%20Bounty.html">
  <span class="arw"><svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg></span>
  <span class="ic"><svg viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 01-10 0z"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3"/><path d="M12 13v3M9 20h6M10 16.5h4v3.5h-4z"/></svg></span>
  <div class="nm">Bounty</div>
  <div class="ds">Budtender standings, bounties and earnings, scored from POS sales.</div>
</a>
```

IDV needs one more of these in the "Staff apps" grid, plus its href URL-encoded like the others
(`Hyperwolf%20IDV.html`). All three (nav, switcher, hub) must land in the **same turn** per
CLAUDE.md L135.

---

## 7. `incentives/app.jsx` + `Hyperwolf Bounty.html` — the pattern to copy exactly

Bounty is the newest app (built overnight 2026-09-08) and is explicitly cited in
`docs/PROMPT-IDV-MODULE-KICKOFF.md` L54 as "the most recent app... copy its shape". Its own
header comment (`incentives/app.jsx` L4-5) says it copied its skeleton from `engage/app.jsx`.

### 7.1 File-load order — `Hyperwolf Bounty.html` (81 lines)

```html
<script src="shared/hw-z.js"></script>            <!-- stacking scale, plain JS, MUST be first -->
<script src="shared/brands.js"></script>
<script src="shared/app-nav.js"></script>
<script src="shared/hw-live.js" data-hw-live-lite="1"></script>   <!-- see §7.4 -->
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="..." crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="..." crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="..." crossorigin="anonymous"></script>
<script src="shared/error-boundary.jsx"></script>  <!-- plain JS, AFTER React, BEFORE babel -->

<script type="text/babel" src="pos/tokens.jsx"></script>
<script type="text/babel" src="pos/icons.jsx"></script>
<script type="text/babel" src="pos/atoms.jsx"></script>
<script type="text/babel" src="shared/app-rail.jsx"></script>
<script type="text/babel" src="shared/states.jsx"></script>
<script type="text/babel" src="shared/hd-format.jsx"></script>
<script type="text/babel" src="shared/hd-ui.jsx"></script>
<script type="text/babel" src="incentives/inc-client.jsx"></script>   <!-- window.HWInc -->
<script type="text/babel" src="incentives/inc-shared.jsx"></script>   <!-- window.IncShared -->
<!-- one <script> per screen file, registering window.IncScreen* -->
<script type="text/babel" src="incentives/screen-standings.jsx"></script>
...
<script type="text/babel" src="incentives/app.jsx"></script>          <!-- shell, LAST -->

<script src="shared/app-switcher.js"></script>
```

For IDV: same order, swap `incentives/` for the IDV folder name, `inc-client.jsx` for an
`idv-client.jsx` (or reuse patterns from `shared/hw-live-identity.js` — see the kickoff prompt),
and register every IDV screen file before `idv/app.jsx`. Note Bounty's `<style>` block (L23-28)
explicitly defines the `fade`/`hwspin`/`shimmer` keyframes because "Engage's HTML never declares
these even though `shared/states.jsx`'s `Skeleton` depends on `shimmer`" — POS.html declares them
in its own `<style>`; **a new app HTML must declare all three keyframes itself.**

### 7.2 IIFE file pattern, `window.X*` globals

Every Bounty file opens `;(function () { ... })()` and assigns only `window.Inc*` /
`window.HWInc` / `window.BountyApp`. This is enforced by `test/global-collisions.test.mjs` (see
§10) — a file that self-wraps leaks nothing and cannot collide with any other file's top-level
`const`/`let`, which the no-module-system browser load would otherwise silently clobber.

### 7.3 The single session accessor — `incentives/inc-client.jsx` L16-33

```js
function session() {
  var assoc = window.HW && window.HW.STATS && window.HW.STATS.associate;
  if (assoc && assoc.id) {
    return { id: assoc.id, name: assoc.name, role: assoc.role,
             storeId: assoc.storeId || assoc.store_id || null };
  }
  // Fallback mirrors pos/app.jsx's USER exactly — the demo person kept in sync
  // in three places (pos/app.jsx USER, pos/data.jsx window.HW.STATS.associate,
  // wmdemo/associates.py 'manisha-saini' row).
  return { id: 'manisha-saini', name: 'Manisha Saini', role: 'Floor Manager', storeId: 'elsinore' };
}
window.HWInc = { session: session, get: get, post: post, usePoll: usePoll, fmt: fmt };
```

"The estate has no login... this module isolates that one fact behind one function instead of
forty call sites. Swapping in real auth later is a one-function change here" (`inc-client.jsx`
L12-15). IDV's client should define the identical `session()` shape under its own `window.HWIdv`
(or similar) namespace — one function, same fallback identity, same production-swap contract.

### 7.4 `data-hw-live-lite="1"` — the live seam on a non-POS page

`shared/hw-live.js` was written for the POS page and by default fetches `/api/state` (~1.9 MB)
plus the fulfilment board and installs a `window.HW` accessor — all POS-specific. Lite mode
(added 2026-09-08 *for* `Hyperwolf Bounty.html`, `shared/hw-live.README.md` L168-210) arms only:
base-URL resolution (`?hwlive=` override), the write token (`localStorage['hw-live-token']`,
`?hwtoken=`), `HW_LIVE.get(path)` / `HW_LIVE.post(path, body)`, and the connectivity badge. It
skips the `/api/state` fetch, the board fetch, and the `window.HW` `Object.defineProperty`. Boot
calls `loadLite()`, which uses a non-mutating write-probe (`POST /api/__hw_write_probe`) as the
reachability signal instead of checking catalog shape. Badge copy differs honestly: `Bounty
backend` / `Not connected` rather than `N SKUs · M regions`.

**IDV must add the same `data-hw-live-lite="1"` attribute** on its `<script src="shared/hw-live.js">`
tag — it carries no POS catalog either.

`get`/`post` signatures (`shared/hw-live.js` L202-246, both **never reject**):
```js
HW_LIVE.get(path)        // -> Promise<{ ok, code, body, error, hint }>
HW_LIVE.post(path, body) // -> Promise<{ ok, code, body, error, hint, gated }>
```
`inc-client.jsx`'s `get`/`post` (L38-51) wrap these and degrade to the same `{ ok:false, code:0,
body:null, error:'no-live-seam' }` shape when `HW_LIVE` itself is absent — "a caller can always
destructure the result without a try/catch" (L9-10 comment). Copy this wrapper verbatim for IDV.

### 7.5 `usePoll` — the ledger_version short-circuit (`inc-client.jsx` L59-102)

```js
function usePoll(path, opts) // opts: { intervalMs=15000, enabled=true }
// -> { loading, error, data, refresh }
```
Re-fetches `path` on an interval; if the response's `body.ledger_version` is unchanged since the
last fetch, it escapes `loading` without touching `data` — "must not force React to re-render a
screen with data it has already shown, or the cache buys nothing" (L57-58). IDV's backend should
expose an equivalent monotonic version field (e.g. `ledger_version` or a session/review-queue
equivalent) if any IDV screen polls, and the client hook should reuse this exact pattern.

### 7.6 ErrorState for unbuilt routes — the "did not load" convention

`incentives/app.jsx` keeps two parallel maps: `ROUTES()` (a **function**, resolved at render time
so late-loaded screen files still resolve, L42-52) and `SCREEN_SOURCE` (path → `[expected file,
expected global]`, L58-68). When a route's screen global is missing:

```jsx
const source = sourceFor(path);
const label = bountyLabel(path);
const screenSlot = Screen ? <Screen {...ctx} /> : (
  <ErrorState title={`The ${label} screen did not load`}
    body={`${source[0]} defines ${source[1]} and this page did not get it — check that Hyperwolf Bounty.html loads that file, or that this screen has not been built yet.`} />
);
```

This is the estate's convention for "screen not yet built" — **never a blank screen, never
"Something went wrong"** (see `app.jsx` L56-57, L81-86 for the matching `bountyLabel()` fallback
namer for unlisted paths). Engage uses a softer `Placeholder` ("This Engage surface is next in
the port queue", `engage/app.jsx` L237-239) for the same situation — Bounty's ErrorState-with-
file-path version is the newer, stricter convention and the one to copy for IDV.

### 7.7 Error boundaries — `window.ScreenBoundary` / `window.CriticalBoundary`

Loaded from `shared/error-boundary.jsx` (plain JS, after React, before Babel — both HTMLs).
Bounty falls back to a no-op passthrough if the file didn't load, with a console error naming the
page (`app.jsx` L96-102). Boundaries are placed at each independently-failing REGION (rail, top
bar, the routed frame) — never around a panel inside one — and the routed frame is **keyed by
path** so a failure clears on navigation instead of following the operator (`app.jsx` L88-95,
L286-289). Bounty reasons it needs no `CriticalBoundary` because it carries no money-execution
surface (`app.jsx` L94-95, "payout EXECUTION is explicitly out of scope"); Engage's comment
(`engage/app.jsx` L259-276) is the fuller version of this reasoning for PII-bearing screens — read
that block, since IDV holds PII and should follow the CONTAIN-vs-REFUSE analysis Engage lays out,
not just copy Bounty's simpler case.

### 7.8 Route/screen registration mechanics

Each screen file (`incentives/screen-*.jsx`) registers a `window.IncScreen*` global. `app.jsx`'s
`ROUTES()` array pairs a hash path with that global, resolved fresh on every render (not cached
at module load) specifically so script-tag order/load timing can't produce a stale `undefined`.
IDV should follow the identical `window.Idv Screen*` (or similarly prefixed) naming and the same
`ROUTES()`-as-function pattern.

### 7.9 Toast host

`window.ToastHost` (from `shared/hd-ui.jsx`) must be mounted once at the app root — Bounty does
this at `app.jsx` L303: `{window.ToastHost ? <window.ToastHost /> : null}` — or every write's
result is a silent no-op (installs `window.hdToast` only once mounted, `hd-ui.jsx` L149-155).

---

## 8. `engage/app.jsx` + `Hyperwolf Engage.html` — differences from Bounty worth knowing

- **No `shared/hw-live.js` at all** (`Hyperwolf Engage.html` has no such script tag) — Engage
  runs entirely on `engage/data.jsx` mock data; it never wired a live seam. Bounty's lite-mode
  addition (§7.4) exists precisely because Bounty needed one and Engage's pattern didn't cover it.
- **Two-tier nav**: `HWRail` (cross-app) **plus** its own `ModuleSidebar` — five nav groups
  (`Reach/Engage/Understand/Insights/Operate`, `app.jsx` L7-40), collapsible, with a
  categorical-hue icon per item and a command palette (`⌘K`, L164-204). Bounty has no second-tier
  sidebar (it has a two-seat frame instead — see below); a module with many screens (which IDV,
  with dashboard/verifications/workflows/lists/integrate/usage, likely is) should look at this
  pattern more than Bounty's.
- **`Placeholder` fallback, not the file-path `ErrorState`** (§7.6) — a softer, less specific
  convention. Prefer Bounty's stricter version for IDV.
- **Breadcrumbs** (`crumbsFor`, L42-64) driven by a flat `[path-prefix, [crumb, trail]]` array,
  matched by `startsWith`.
- **Error-boundary placement rationale is explicit and IDV-relevant** (L259-276): Engage CONTAINS
  at the SCREEN level "so a screen therefore renders whole or not at all... no state where a
  customer detail comes up with its do-not-contact row silently missing while the rest of the
  record looks complete" — this exact reasoning (a partial PII record looking complete) applies
  directly to an IDV session/decision screen.
- **Keyboard shortcuts**: `g` then a letter (`g d` → dashboard, etc, L312-330), plus `⌘K`/`Ctrl+K`
  for the command palette — a nicety Bounty does not have.
- Both apps: same `ThemeProvider` wrap, same `ReactDOM.createRoot(...).render(...)` backstop
  pattern at the very end of the IIFE, same `window.<AppName>App = App` export before rendering.

---

## 9. `docs/INCENTIVES-PLAN-2026-09-07.md`, `BOUNTY-API-CONTRACT.md`, `BOUNTY-STATUS.md` — document conventions

IDV's own plan/contract/status docs should mirror these section structures exactly (the kickoff
prompt, `docs/PROMPT-IDV-MODULE-KICKOFF.md` L65-66, says so explicitly: "Your plan, contract and
status note follow the same format and the same standard").

### 9.1 Plan doc — `INCENTIVES-PLAN-2026-09-07.md` heading structure (in order)

```
# Title
Status line: **APPROVED <date>** (owner: "<verbatim approval quote>") · author: <name>
<one-paragraph scope/promise>
Research citation line (scratch docs used, with line counts, and the [measured]/[documented]/[unconfirmed] tagging convention)
---
## 0. Decisions already made (from the kickoff Q&A)      <- a | Decision | Ruling | table
## 1. What the research changed                          <- numbered findings, each tagged [measured]/[documented]/[unconfirmed]
## 2. Backend architecture (stack, module table)          <- | Module | Responsibility | table
## 3. Data model                                          <- ### 3.1, 3.2 ... one subsection per table group, SQL DDL in fenced blocks, "Rules:" bullet lists under the DDL
## 4. API surface                                         <- | Method | Path | Notes | table
## 5. Frontend                                             <- ### 5.1 Files (a file-tree-shaped list with one-line purpose per file), ### 5.2 Design-system rules honoured, ### 5.3 Honesty labelling, ### 5.4 <the live-seam note>, ### 5.5 <surface-specific notes>
## 6. Roles and identity (and the production gap)
## 7. Build sequence, agents, models                      <- ### 7.0 Prerequisites from JT, ### 7.1..7.4 Phase N (model, parallelism, disjoint-file split)
## 8. Verification standard (what "done" means)            <- bullet list of concrete probes/greens
## 9. Risks and how the design absorbs them                <- | Risk | Handling | table
## 10. Name — decided                                      <- | Concept | Copy | vocabulary table
## 11. Escalations (not built without a ruling)             <- numbered, each a decision only the owner can make
```

### 9.2 API contract doc — `BOUNTY-API-CONTRACT.md` conventions

- Opens with a one-line scope statement plus the hard rule: **"A screen never invents a field; a
  route never omits one listed as required."** (L5).
- States the money/time conventions once, globally: money is integer cents, timestamps ISO-8601
  UTC text, a `local_day` field is `YYYY-MM-DD` in store tz, every read carries a version field
  for polling short-circuit (L5-7).
- **Errors** stated once as a table-free line: `{ "error": "<sentence>" }` with the HTTP codes
  and what each means, including **501 "not built — must never ship"** (L10) — i.e. a stub route
  must say so explicitly rather than fake success.
- **`## Common fragments`** section (L17-38) — reusable JSON shapes (`Source`, `Person`,
  `Standing`, `Unattributed`, `Trail`) defined once in fenced `jsonc` blocks with inline `//`
  comments, then referenced by name (`Person`, `[Standing]`) in every endpoint below rather than
  respelled.
- Endpoints grouped by feature area with `##`/`###` headings matching the plan's §4 order; each
  shows the exact request line (`GET /api/incentives/me?store_id&associate_id`) followed by a
  fenced `jsonc` response shape, comments inline for anything non-obvious.
- **Addenda section at the end** (`## Addenda (2026-09-08, from the screen builds — backend must
  honour)`, L160-171) — a dated, append-only log of contract changes discovered during
  implementation, each a one-line bullet. IDV should keep the same pattern: never silently edit
  an already-built section, append a dated addendum instead.
- A dedicated closing subsection explaining a genuine semantic gotcha in plain language (here:
  `/api/aov/*` vs `/api/incentives/*` disagreeing about refunds, L231-262) — worth doing for any
  IDV metric that has two legitimate but different readings (e.g. "verifications attempted" vs
  "verifications completed").

### 9.3 Status doc — `BOUNTY-STATUS.md` conventions

```
# <App name> — overnight build status
Written <date>, for <owner>'s morning. <push/deploy caveat line>
## What shipped                    <- **Backend (<path>)** bullet list, **Frontend (<path>)** bullet list
## What was verified live (not just by probes)
## Facts you should know           <- surprises discovered during the build, plain language
## Waiting on you                  <- numbered, each a concrete external dependency (keys, files, decisions)
## Run it                          <- exact shell commands + exact URLs to open
## Open (known, not fixed tonight) <- bulleted, honest, including "session identity is hard-coded" style caveats
## Verification summary (final run, scratch databases)  <- | Suite | Checks | table, then a bolded total row
```

The ingest-run-report invariant, stated exactly (`BOUNTY-STATUS.md` L10, and formally in the plan
§3.3 DDL comment, `INCENTIVES-PLAN-2026-09-07.md` L210):

```
rows_read == inserted + unchanged + conflicts + rejected
```

Every ingest/import run (IDV will have this for its Didit-history migration, per the kickoff
prompt L93-94) must assert this invariant and report all four counts, plus `unresolved_identities`
where relevant. The `inc_ingest_runs` DDL (plan §3.3, L194-208) — columns `kind, source, store_id,
filename, format, started_at, finished_at, status ('running'|'ok'|'partial'|'failed'), rows_read,
inserted, unchanged, conflicts, rejected, unresolved_identities, window_from, window_to,
cursor_before, cursor_after, actor, error` plus sibling tables `inc_ingest_rejects` (per-row
reason) and `inc_ingest_conflicts` (per-field diff) — is the concrete shape to copy for an IDV
import-run table.

---

## 10. `test/global-collisions.test.mjs` (181 lines) — how new globals are registered/tested

This test reads the **built HTML pages themselves** (not a runtime harness) because the
collision it catches is a property of how the browser loads flat `<script type="text/babel">`
tags with no module system — `@babel/standalone` transpiles top-level `const`/`let` to plain
`var` on `window`, and the LAST file loaded silently clobbers any earlier same-named declaration,
with no SyntaxError (file header comment, L1-26).

- `babelScripts(html)` (L36-41) — regex-extracts every `<script type="text/babel" src="...">` in
  a page, in load order.
- `topLevelNames(file)` (L49-83) — extracts top-level `const`/`let`/`var`/`function`/`class`
  names from a file. **A file that self-wraps in `;(function(){` in its first 12 lines is
  exempted entirely** (L53-62) — this is exactly why every IDV file must open with the IIFE
  pattern (§7.2): it is not just style, it is what makes this test correctly report zero risk
  for that file's internals.
- A local alias re-declaration (`const useP = window.useP;`) is explicitly NOT flagged (L67-73).
- `KNOWN` (L108-123) — a Set of `"<name>: <file A> then <file B>"` strings, the pre-existing debt
  register. IDV should add **zero** new entries here — a genuine new collision must be fixed by
  renaming the internal binding (the file's own comment names the fix pattern: keep the export
  name, rename the internal `const`, as `pos/data.jsx` did with `ORDER_STAGES`/`STAGES`, L104-106).
- One `test(...)` block is generated **per HTML page** at module scope (L127-152), asserting no
  fresh (non-`KNOWN`) collision exists among that page's babel scripts.
- Two meta-tests (L154-181) pin that the detector itself still works (`ORDER_STAGES`/`STAGES`
  negative control) and that `KNOWN` has no stale entries (a fixed collision left in the register
  would silently re-permit it).

**Extending it for IDV**: nothing to touch by hand — the test enumerates `readdirSync(ROOT)`
for `*.html` (L125) and reads each page's own babel script list, so `Hyperwolf IDV.html` and its
`idv/*.jsx` files are picked up automatically the moment the HTML exists with `text/babel` script
tags. The plan doc (§5.1 in the Bounty plan) explicitly calls this out: *"Every file is
IIFE-wrapped; only `window.Inc*` and `window.HWInc` leak. `test/global-collisions.test.mjs` is
extended to include the new files."* (L392) — "extended" here just means "the new HTML/files
exist"; there is no registration list to edit.

**How to run tests** — `package.json` (L7-11, `/Users/jt/POS-Admin/package.json`):
```json
"scripts": {
  "test": "node --test \"test/*.test.mjs\"; s1=$?; node test/category-map-board-render-queue.check.mjs; s2=$?; exit $((s1 > s2 ? s1 : s2))",
  "precompile": "node tools/precompile.mjs",
  "precompile:deploy": "HW_PRECOMPILE_IN_PLACE_OK=1 node tools/precompile.mjs --in-place && node tools/precompile-verify.mjs"
}
```
Run with `npm test`, or narrow to just the collision test with
`node --test test/global-collisions.test.mjs`. Bounty's status doc confirms the exact green run:
`node --test test/global-collisions.test.mjs` → `15/15 (includes Hyperwolf Bounty.html)`
(`docs/BOUNTY-STATUS.md` L113).

---

## 11. `explorations/Incentives - Concept A - Scoreboard.html` — exploration-HTML structure

File size: **137,454 bytes** (~134 KB), 1,658 lines total. This is the format the kickoff prompt
(`docs/PROMPT-IDV-MODULE-KICKOFF.md` L106-109) tells IDV to copy for its four design concepts:
*"copy the format of `Incentives - Concept A..D`... each a full take on the entire console...
grounded in the real tokens... Serve them on a fresh local port and hand the owner an `open …`
Run button; the desktop app's inline file viewer does not run their scripts."*

- **Fully self-contained**: no external JS dependencies, no React/Babel, no `<script src>` to any
  POS-Admin file. All CSS is inline in one `<style>` block (L10-337ish).
- **Tokens are hand-copied as CSS custom properties**, not loaded from `pos/tokens.jsx` — `:root`
  (L12-34) and `[data-theme="dark"]` (L35-53) redeclare the exact same token names/values as
  `pos/tokens.jsx`'s `LIGHT`/`DARK`/`SHARED` objects (`--bg`, `--accent:#FFD100`, `--r8`...`--r999`,
  `--shadowSm/Md/Lg`, `--fontSans`, `--fontMono`, plus a `cat`-equivalent `--catFlower` etc,
  L32-33). This is the exploration-HTML convention: same design language, zero build step, zero
  shared-file dependency, so it can be opened and eyeballed with nothing else running.
- Theme toggle via `data-theme="light"`/`"dark"` attribute on `<html>` (L2) — same attribute name
  as the live app's `document.documentElement`/`body.style.colorScheme` pattern in
  `pos/tokens.jsx`'s `ThemeProvider` (L212-215), just driven by inline JS here instead of React.
- **Tab/screen switching is a plain click handler**, no router: a `.seg`-styled `<div
  class="seg" id="tabseg">` holds one `<button class="tab-btn" data-tab="...">` per concept
  screen (L371-381: `why, standings, contests, builder, earnings, learn, data, goals, pos,
  states` — ten tabs for ten concerns, including a dedicated `states` tab presumably for
  empty/loading/error demonstrations), and a `DOMContentLoaded` listener (L342-352) toggles
  `.active` on the clicked button and the matching `.tabpanel`.
  ```html
  <div class="seg" id="tabseg">
  <button class="tab-btn active" data-tab="why">1 · Why</button>
  <button class="tab-btn" data-tab="standings">2 · Standings</button>
  ...
  </div>
  ```
- Sticky top header (`.doc-head`, L59-63) carries the concept title/subtitle and the tab
  segmented control, `position:sticky; z-index:50`.
- Component classes mirror the live atom set 1:1 by name-shape: `.pill`/`.pill-good` etc mirrors
  `Pill`'s `kind` map; `.btn`/`.btn-primary`/`.btn-accent`/`.btn-ghost`/`.btn-danger` mirrors
  `PBtn`'s `variant` map; `.card`/`.card.sunken` mirrors `Card`'s `elevation` prop; `.bar-track`/
  `.bar-fill` mirrors `BarMeter`. This is deliberate: the exploration is meant to read as "the
  real app, sketched," so a reviewer's eye maps directly onto the atoms it will actually be built
  from — IDV's four concept HTMLs should keep this same 1:1 class-to-atom naming.
- A `## 0 · Why` / "Why" first tab (`data-tab="why"`, active by default) is the convention for
  leading with rationale/scope before the screens — keep this as concept-doc tab 1 for IDV too.

---

## Rules a new app must obey — checklist (≤20 lines)

1. **Zero hex literals outside `pos/tokens.jsx`.** Every colour is `P.<token>`; add a new named
   group to `SHARED` (tokens.jsx) rather than inventing a literal.
2. Every screen built from `pos/atoms.jsx` (+ `shared/hd-ui.jsx` for table/tone/sheet needs); no
   private div-tree duplicating an existing atom.
3. Type only from `P.type`; controls sized from `P.ctrlH`; radius from `P.r*` by role
   (8/12/20/999); a `Card` never has both a border and a shadow.
4. Every list/table has all three states: `EmptyState`, `Skeleton`/`SkeletonRows`, `ErrorState` —
   never render nothing when there is nothing, never fall back to a fixture number.
5. Not-connected copy follows `IncShared.NotConnected`'s exact shape: named title + "Needs the
   wmdemo backend — not reachable right now..." body + `onRetry`.
6. Every new file is IIFE-wrapped (`;(function () {...})()`), leaking only `window.<Prefix>*`
   globals — required for `test/global-collisions.test.mjs` to exempt it.
7. One session accessor (`session()`), same fallback-identity shape as `HWInc.session()`, so
   production auth is a one-function swap later.
8. Load `shared/hw-live.js` with `data-hw-live-lite="1"` — IDV has no `/api/state` catalog either.
9. `get`/`post` wrappers must never reject; always resolve to `{ ok, code, body, error, hint }`.
10. Any polling screen short-circuits on an unchanged version field, exactly like `usePoll`'s
    `ledger_version` check.
11. Missing/unbuilt screen route → `ErrorState` naming the exact expected file + expected
    `window.*` global (Bounty's pattern), never a blank screen or "Something went wrong".
12. Mount `window.ToastHost` once at app root or every write is a silent no-op.
13. Error boundaries at region level (rail/topbar/routed-frame), keyed by route/path, CONTAIN by
    default; escalate to REFUSE only where a partial render could look complete and be wrong
    (Engage's PII reasoning applies directly to IDV's PII).
14. Script load order: `hw-z.js` → `brands.js` → `app-nav.js` → `hw-live.js` (lite) → React →
    ReactDOM → Babel → `error-boundary.jsx` → babel-type tokens/icons/atoms/rail/states/
    hd-format/hd-ui → app-specific client/shared/screens → `app.jsx` last → `app-switcher.js`.
15. Declare `fade`/`hwspin`/`shimmer` keyframes in the entry HTML's own `<style>` (not inherited).
16. Register in `shared/app-nav.js`, `shared/app-switcher.js`, and `Hyperwolf.html`'s hub card —
    all three in the same turn.
17. Money is integer cents; timestamps ISO-8601 UTC text; every ingest/import run asserts
    `rows_read == inserted + unchanged + conflicts + rejected`.
18. Plan/contract/status docs follow the Bounty docs' exact section structure (§9 above).
19. Design concepts as self-contained exploration HTMLs in `explorations/`, CSS vars mirroring
    `pos/tokens.jsx` verbatim, no external JS, tab-switch via plain click handler.
20. `pos/screen-register.jsx` is never touched by any new module (owner rule, carried over).
