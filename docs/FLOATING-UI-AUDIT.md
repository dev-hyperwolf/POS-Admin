# Floating UI audit — overlays, collisions, and the rule that stops this recurring

**Status:** diagnosis + build spec. No production code was changed by this document.
**Measured:** 2026-08-26, Chrome, `python3 -m http.server 8830`, light and dark, at viewport
widths 1280 (laptop, usable height 657 after browser chrome) and 1920 (large display, usable
height 806). Every rect and every z-index below was read out of the live DOM with
`getComputedStyle` + `getBoundingClientRect`; every collision was confirmed with
`document.elementFromPoint`, not by eye.

**Reading order:** §1 inventory → §2 judgement → §3 collisions → §4 the build → §5 the rule →
§6 what must not break.

---

## 0. The one-paragraph version

There are **eleven** independently-positioned floating layers, mounted by **nine** files, none of
which knows the others exist. Ten of them pin themselves to a viewport corner with a hard-coded
offset and a z-index between **2,147,480,000 and 2,147,483,000** — within 3,646 of `INT32_MAX`.
Every modal, sheet, popover and sticky action bar in the entire estate sits between **z 10 and
z 400**. So *every* piece of ambient chrome floats above *every* piece of application UI,
unconditionally. The bottom-left status tray needs ~1,906px of width to lay out on one row and
therefore wraps to two rows at **any** real display size, claiming the bottom ~126px of the
content column on the POS page. That is what covered `Confirm match`. The bottom-right build
stamp overlaps the bottom 15px of two buttons and wins the hit test against both. And an
"Accept & post" primary action on the invoice screen loses its right 30px to the app-switcher.

None of this is a styling problem. It is the absence of a registry.

---

## 1. Complete inventory

### 1.1 The eleven layers

Sizes are as measured at 1280×657 unless noted. "Anchor" is the CSS corner it pins to.

| # | Layer | Rendered by | Line | z-index | Anchor | Size (measured) | Pointer |
|---|---|---|---|---|---|---|---|
| 1 | Annotation pin layer + pins + hover tip | `shared/notes.js` | 272, 276, 280 | `2147480000` (root); pins inherit | `inset:0`; each pin `fixed`, centred on its target | root full-viewport; pin 24×24 | root `none`, pin `auto` |
| 2 | Notes launcher button (+ unread badge) | `shared/notes.js` | 281, 284 | inside root `2147480000` | `right:16 · bottom:120` | 44×44 | `auto` |
| 3 | Notes connection label (`hwn-conn`) | `shared/notes.js` | 285 | inside root | `right:70 · bottom:129` | 125×21 | `none` |
| 4 | Notes mode banner (`hwn-mode`) | `shared/notes.js` | 286 | inside root | `left:50% · top:14` | ~300×32 | `none` |
| 5 | Notes thread popover / side panel | `shared/notes.js` | 288, 289, 485 | inside root | popover: near pin · panel: `top:0;bottom:0` + `left:0` or `right:0` | popover 294 wide · panel **376 wide, full height** | `auto` |
| 6 | Guided-tour mask (4 blades) + ring + card | `shared/tour.js` | 56, 58, 59, 61 | `2147481000` | `inset:0`; card follows target | card 352×~230; masks cover the rest of the viewport | masks **`auto`** — they swallow all clicks |
| 7 | Guided-tour "?" launcher | `shared/tour.js` | 82 | `2147480500` | `right:16 · bottom:68` | 44×44 | `auto` |
| 8 | `hw-live` status pill + its panel | `shared/hw-live.js` | 1448 | `2147482000` closed / `2147482005` open | `left:RAIL_W+12 (=86) · bottom:14` | pill 211×30; panel ≤400 wide, `max-height:60vh` | wrapper `none`, pill `auto` |
| 9 | **Seam dock** — 6 status pills + 1 panel slot | `shared/hw-live-identity.js` **and 5 siblings**, identical block | identity 89–119; regions 73–84; taxonomy 89–108; checkin 134–153; lines 147–166; mapping 78–89 | `2147482003` | `left:86 · bottom:52`, column: panel slot on top, pill tray below | **1178×74 at 1280vw · 1818×74 at 1920vw** — always ≥2 rows | root `none`, each pill `auto` |
| 10 | "+ Demo data" button + menu | `shared/demo-seed.js` | 267, 270, 321 | `2147483000` | `right:74 · bottom:16` | button 107×38; menu 290 wide, `max-height:74vh` | `auto` |
| 11 | App-switcher button + menu | `shared/app-switcher.js` | 27, 30, 49 | `2147483000` | `right:16 · bottom:16` | button 44×44; menu 222 wide, `max-height:70vh` | `auto` |
| 12 | **Build stamp** | `build-stamp.js` | 29 | `2147483000` | `right:8 · bottom:8` | **169×23** | `auto` |

Twelve rows, eleven layers — rows 1–5 are five distinct fixed boxes owned by one file.

### 1.2 Two more that the brief did not name, and they matter

| Layer | File | Line | z-index | Anchor | Note |
|---|---|---|---|---|---|
| `hdToast` stack | `shared/hd-ui.jsx` | 158 | **400** | `right:16 · bottom:72` | Sits at the *exact* coordinates of the tour "?" button (`right:16 · bottom:68`), five million times lower in the stack. Every toast on POS is punched through by the "?" button. |
| WM order-lines detail panel | `shared/hw-live-lines.js` | 763–781 | **82** | wide: `top:34 · right:20 · bottom:160`; narrow: `left:12 · right:76 · bottom:88` | Already hand-computed to dodge the launcher column and the seam tray — with a comment explaining that `100vh` and `getBoundingClientRect` disagree by 8% under this pane's zoom. This is the one layer that already tried to be collision-aware, and it did it by hard-coding its neighbours' geometry. That is the failure mode §5 removes. |

### 1.3 Page-local floats (not shared chrome, listed for completeness)

| Layer | File | Line | z-index | Anchor | Pages |
|---|---|---|---|---|---|
| Direction switcher ("Hub & groups / Membership card / Concierge") | `athome/account-switch.jsx` | 17 | `2147482000` | `left:16 · bottom:16` | Customer Account only |
| Shop toast | `shop/chrome.jsx` | 165 | 60 | `left:50% · bottom:28` | Hyperwolf Shop only |
| Terminal select popover / modal scrim | `terminals/tshared.jsx` | 112, 113, 144 | 300/400/401 | anchored / `inset:0` | POS Terminal Configuration only |

### 1.4 Which page carries what

The brief said "13 pages that carry the rail — enumerate them, do not assume". The real numbers
do not land on 13, so here they are as measured.

**14 pages load the shared floating chrome. 11 of them carry a left rail. 3 do not.**
`Swap and Upsell Engine.html` and `index.html` load none of it.

| Page | Rail | notes | tour.js | tour has **steps** | switcher | demo-seed | build-stamp | hw-live + 6 seams |
|---|---|---|---|---|---|---|---|---|
| `Hyperwolf POS.html` | `app-rail.jsx` | ✓ | ✓ | **✓** | ✓ | **✓** | **✓** | **✓ (all 7)** |
| `METRC Batch Pipeline.html` | `app-rail.jsx` | ✓ | ✓ | — | ✓ | — | — | — |
| `Hyperwolf Engage.html` | `app-rail.jsx` | ✓ | ✓ | — | ✓ | — | — | — |
| `Promotions Suite.html` | `app-rail.jsx` | ✓ | ✓ | **✓** | ✓ | — | — | — |
| `Hyperwolf Delivery.html` | `app-rail.jsx` | ✓ | ✓ | **✓** | ✓ | — | — | — |
| `Hyperdrive Logistics.html` | `app-rail.jsx` | ✓ | ✓ | **✓** | ✓ | — | — | — |
| `Hyperwolf Driver App.html` | `app-rail.jsx` | ✓ | ✓ | **✓** | ✓ | **✓** | — | — |
| `POS Terminal Configuration.html` | `app-rail.jsx` | ✓ | ✓ | **✓** | ✓ | — | — | — |
| `Members CRM.html` | `app-rail.jsx` | ✓ | ✓ | — | ✓ | — | — | — |
| `Shop at Home.html` | `app-rail.jsx` | ✓ | ✓ | — | ✓ | — | — | — |
| `dashboard.html` | own `.rail` CSS | ✓ | ✓ | **✓** | ✓ | — | — | — |
| `Hyperwolf Shop.html` | none | ✓ | ✓ | — | ✓ | — | — | — |
| `Customer Account.html` | none | ✓ | ✓ | — | ✓ | — | — | — |
| `Hyperwolf.html` (hub) | none | ✓ | ✓ | **✓** | **—** | — | **✓** | — |

Two consequences fall straight out of that table:

- **The tour "?" button exists on 8 of 14 pages.** `shared/tour.js:26` returns early when
  `HW_TOUR_STEPS` has no entry for the filename, so on Pipeline, Engage, Members CRM, Shop,
  Shop at Home and Customer Account the button is simply absent — leaving a **60px hole** at
  `bottom:68` with the notes button floating above it at `bottom:120` and the app switcher below
  at `bottom:16`. Measured on Pipeline: notes at `y 493–537`, nothing, switcher at `y 597–641`.
- **`Hyperwolf.html` — the demo's landing page — has no app switcher.** It carries the notes
  button at `bottom:120` with *both* slots below it empty, and a build stamp alone in the corner.
  Measured: `data-toggle 1220/493/44/44`, `data-build-stamp 1103/626/169/23`, nothing between.

---

## 2. What each one is for, and whether it earns the space

| Layer | What it is actually for | Verdict |
|---|---|---|
| **Notes pins + launcher + panel** | An external stakeholder is filing feedback against this build **right now**, anchored to specific elements. | **Keep, unconditionally.** This is the highest-value overlay on the page and the only one with an active external user. It should be *more* prominent, not less. |
| Notes `hwn-conn` label | Shows sync/identity state ("passcode incorrect"). A 125×21 always-on label to communicate a state that is almost always fine. | **Demote.** Fold into the notes button (a tone dot on the badge) and the panel header. It does not need permanent screen space. |
| Notes mode banner | "Click anywhere to leave a note · Esc to cancel" while note mode is armed. Transient, top-centre, correct. | **Keep as-is.** |
| **App switcher** | Jumps between the 14 surfaces. In a demo where the whole point is "here are our consoles", this *is* the navigation. | **Keep.** Best-earned button on the screen. |
| **Guided tour "?"** | A 60-second walkthrough per page. Genuinely useful for a stakeholder who has never seen the product. | **Keep the button. Kill the auto-start** — see §4.6. |
| `hw-live` "Live data / Mock data" pill | Tells you whether the page is reading the real API or seeded fixtures. Legitimately load-bearing *for a developer*, and mildly reassuring for a stakeholder ("this is real"). | **Keep one pill.** Collapse the seam pills into it. |
| **The 6 seam pills** (`WM identity`, `WM products`, `Region → listing`, `WM taxonomy`, `Check-in`, `WM order lines`) | Per-integration diagnostics. Each opens a panel explaining which endpoint did not answer and what is mocked as a result. | **Debug affordance. Should not be visible in a stakeholder demo at all.** In the demo state every one of them reads `(no API)` — six pills, wrapped over two rows, all saying the same thing: there is no backend. That is a developer's diagnostic printed six times across the bottom of a sales demo. |
| **"+ Demo data"** | Seeds a fake Weedmaps order / a dirty member / a verification-gate case, so you can drive a flow that needs data. | **Debug/operator affordance.** Useful when *building* the demo, actively harmful *during* one — a stakeholder who clicks it mutates the state you are presenting. Move it out of the corner. |
| **Build stamp** | Answers "which branch is this host serving", after Pages and Render silently diverged for six days. A real problem, honestly documented in the file header. | **Delete the floating badge; keep the mechanism.** The drift it detects is a deploy-time concern checked once, not a fact that needs 169×23px of permanent screen real estate on every page. It is also the single worst-behaved layer on the page (§3.2). |

The honest summary: of eleven layers, **three earn permanent screen space** (notes, app switcher,
tour button), **one earns a single collapsed pill** (live-data status), and **seven are debug
instrumentation** that should be behind a switch.

---

## 3. The collision map

### 3.1 The headline — POS `Catalog → product → Match · N% confidence`

Reproduced at **1280×657, light and dark**: open `Hyperwolf POS.html`, go to Catalog, open any
product, click `Match · 46% confidence`, scroll the modal to its footer.

The modal is `position:fixed; inset:0; z-index:90` (`pos/screen-catalog.jsx:1265`) and is taller
than the viewport, so its own scrim scrolls. When the footer arrives, it lands inside the band the
seam tray owns. Measured `elementFromPoint` results:

| Control | Rect (x/y/w/h) | Point tested | What is actually hit |
|---|---|---|---|
| `Confirm match` (**accent primary**) | `838/555/165/43` | centre | the button ✓ |
| `Confirm match` | same | **top-left +4,+4** | `#hw-mapping-badge` — the **WM products** pill |
| `Unmap · use custom product` | `612/558/216/37` | **centre** | `#hw-lines-badge` — the **WM order lines** pill. **This button cannot be clicked at all.** |
| footer explainer copy | `300/573` | centre | `#hw-checkin-badge` — the **Check-in** pill |

So the primary action is partly shadowed and the secondary action is **completely** unreachable.
The tray is at `z 2147482003`; the modal is at `z 90`.

### 3.2 The build stamp eats two buttons

`build-stamp.js` pins at `right:8 · bottom:8` — 8px further out than everything else — and renders
a **169×23** pill, i.e. `x 1103–1272, y 626–649` at 1280×657. It shares `z-index: 2147483000` with
the app switcher and "+ Demo data", and because it is appended **after** its `fetch()` resolves, it
is later in DOM order and therefore wins every tie.

| Point | Sits inside | Actually hit |
|---|---|---|
| `1150, 620` | "+ Demo data" | the button ✓ |
| `1150, 634` | "+ Demo data" | **`[data-build-stamp]`** |
| `1242, 619` | app-switcher button | the button ✓ |
| `1242, 634` | app-switcher button | **`[data-build-stamp]`** |

**The bottom 15px of both the app switcher and "+ Demo data" are dead.** On a 44px button that is
34% of its height. It is not a visual overlap — the clicks land on the stamp.

### 3.3 The seam tray never fits on one row, at any width

Pill widths measured at 1920 in the demo (`no API`) state:
`271 + 258 + 265 + 279 + 322 + 395 = 1790`, plus 5×6px gaps = **1820px**, plus `LEFT: 86` =
**1,906px of viewport required**. The tray's own cap is `max-width: calc(100vw - 102px)`.

| Viewport | Tray rect | Rows | Band it owns |
|---|---|---|---|
| 1280×657 | `86/531/1178/74` | 2 | `y 531–605` + live pill `y 613–643` → **bottom 126px** |
| 1920×806 | `86/680/1818/74` | 2 | `y 680–754` + live pill `y 762–792` → **bottom 126px** |

A larger display does **not** help. It would need a ~2008px-wide window to lay out on one row, and
even then the band would still be ~70px. On the plain Catalog list (no modal), dark mode at 1280,
the two pill rows sit directly over the table header row (`PRODUCT / SKU · WEEDMAPS · BRAND ·
STRAIN · CATEGORY · STOCK · MARGIN`) and half of the first data row.

### 3.4 `Accept & post` on the invoice screen

`METRC Batch Pipeline.html#/invoices/1`, sticky bottom action bar (`pipeline/screen-invoice.jsx:379`).

- `Accept & post` (accent primary): rect `1103/605/147/40`.
- App-switcher button: rect `1220/597/44/44`.
- Overlap: `x 1220–1250` × `y 605–641` — **the right 30px (20%) of the primary action.**
- `elementFromPoint(1240, 620)` → `svg < button < div[data-hw-switcher]`.

The centre still hits the button, so this is a "sometimes my click does nothing, sometimes it
opens a menu" bug — the most annoying kind. The same geometry threatens
`pipeline/screen-product-detail.jsx:230` (sticky footer) and `pipeline/screen-scan.jsx:156`
(sticky `bottom:20`, `alignSelf:flex-end`, 56px accent pill).

### 3.5 Toasts are punched through by the tour button

`shared/hd-ui.jsx:158` renders the toast stack at `right:16 · bottom:72 · z-index:400`.
`shared/tour.js:82` renders the "?" button at `right:16 · bottom:68 · z-index:2147480500`.
Same 44px-wide column, 4px apart, five million apart in z. On the 8 pages that have tour steps —
**including POS and Delivery** — every toast is overlapped by the "?" button.

On the 6 pages without tour steps the toast instead clips the *notes* button: measured on Pipeline,
toast `1004/530/260/56` vs notes toggle `1220/493/44/44` → 7px of overlap at `y 530–537`.

### 3.6 Overlay-vs-overlay summary

| A | B | Overlap | Winner |
|---|---|---|---|
| Build stamp | App-switcher button | 44×15 | build stamp (later in DOM, same z) |
| Build stamp | "+ Demo data" | 103×15 | build stamp |
| Seam tray (row 2) | "+ Demo data" | ~2px at 1280 | tray (`pointer-events:none` root, so harmless — today) |
| `hdToast` | Tour "?" button | full | tour button |
| `hdToast` | Notes button | 44×7 | notes button |
| Tour mask blades | **everything** | full viewport, `pointer-events:auto` | tour |
| Notes side panel (376 wide) | Seam tray, live pill, both bottom corners | full-height column | notes panel (`z 2147480000` — *below* the seam tray at `2147482003`, so **the seam pills draw on top of the notes panel**) |

That last row is worth stating plainly: **the debug pills render on top of the stakeholder's
annotation panel.**

### 3.7 Every overlay outranks every modal

| Layer class | z-index range |
|---|---|
| In-page sticky bars | 2–40 |
| In-page dropdown scrims | 40–90 |
| **Modals** (`pos/*`, `pipeline/*`, `engage/*`) | **50–320** |
| Sheets (`shared/hd-ui.jsx:137`) | 200 |
| Toasts | 400 |
| **All shared chrome** | **2,147,480,000 – 2,147,483,000** |

There is no scale. Each file picked a number near `INT32_MAX` to guarantee it won, and the
application lost by six orders of magnitude everywhere.

---

## 4. The build

Six changes. They are ordered so that each is shippable on its own; #1 and #2 alone fix the
screenshot.

### 4.1 A z-index scale, in tokens

Add to `pos/tokens.jsx` as `P.z` (both modes share it; it is not a colour). No file may write a
numeric z-index again.

```
z: {
  content:      0,    // page content
  sticky:      10,    // in-page sticky headers / action bars
  dropdown:    60,    // in-page popovers, select menus, filter panels
  chromeDock: 100,    // ambient chrome, bottom-left  (live pill + seam tray)
  chromeBar:  110,    // ambient chrome, right column (launcher buttons)
  chromeMenu: 120,    // menus those launchers open
  scrim:      300,    // modal / sheet backdrop
  modal:      310,    // modal + sheet content
  modalPop:   320,    // popovers owned by an open modal
  toast:      400,    // transient confirmations
  notePin:    500,    // annotation pins — must sit above modals
  notePop:    510,
  notePanel:  520,
  tourMask:   600,
  tourCard:   610,
}
```

The load-bearing decision is that **ambient chrome (100–120) sits below the scrim (300)**. Open a
modal and the launcher column and the status tray go behind it — which is correct: you are not
navigating apps or reading integration diagnostics mid-transaction, and `Esc` still closes.
**Annotation (500+) and the tour (600+) stay above modals**, because both must be able to point at
a modal. That preserves today's relative ordering of notes-under-tour.

**This change alone fixes §3.1.** With the modal at 310 and the tray at 100, `Confirm match` and
`Unmap · use custom product` become clickable again without moving a pixel.

Migration for the 12 layers: `notes.js` root → `notePin`; `.hwn-pop` → `notePop`; `.hwn-panel` →
`notePanel`; `tour.js` `#hwt-w`/`.hwt-m`/`#hwt-ring` → `tourMask`, `#hwt-c` → `tourCard`,
`#hwt-launch` → `chromeBar`; `hw-live.js:1448` → `chromeDock` (drop the open/closed 2147482000 ↔
2147482005 swap — the dock's single-open-panel rule already handles it); the six `dock()` blocks →
`chromeDock`; `demo-seed.js:267` and `app-switcher.js:27` → `chromeBar`, their menus →
`chromeMenu`; `hd-ui.jsx:158` → `toast`; `hw-live-lines.js:775` → `modalPop`.

### 4.2 Collapse the seam tray into one pill

Seven bottom-left elements (six seam pills + the `hw-live` pill) become **one**.

**Collapsed (the default, and the only state a stakeholder ever sees):**

- One pill, `left: var(--hw-chrome-left)`, `bottom: 14`, height 30, `border-radius: r999`,
  `background: P.surface`, `border: 1px solid P.hairline2`, `box-shadow: P.shadowSm`.
- Content, in order: a 7px status dot · `Live data` / `Mock data` / `Checking API…` (13px sans,
  600, `P.ink`) · a mono `P.inkMute` summary. **`max-width: 320px`, `white-space: nowrap`,
  `text-overflow: ellipsis`. It must never wrap.**
- The dot is the **worst** state across all seven seams: any `bad` → `P.bad`; else any `warn` →
  `P.warn`; else `P.good`. Semantic tones only — **never `P.accent`**, which is reserved.
- The summary is a count, not a list: `6 seams · 0 live` (mono, `tabular-nums`). Six labels
  spelled out is the bug.

**Expanded:**

- Click the pill (or `L`-free — no new global key) → the existing `#hw-seam-tray` renders **above**
  the collapsed pill inside the existing `#hw-seam-dock` flex column, as a **vertical** list, one
  seam per row, `flex-direction: column`, `align-items: stretch`, `width: min(400px, calc(100vw -
  var(--hw-chrome-left) - 16px))`, `max-height: 40vh`, `overflow-y: auto`. Vertical, capped and
  self-scrolling is what makes wrapping structurally impossible.
- Each row keeps its current label, sub-text and click target. Opening a seam's panel still fires
  `D.opened(id)` and still closes its siblings — **do not touch that contract**.
- The collapsed pill gains a chevron and `aria-expanded`.

**Getting back:** click the pill again, or `Esc`. The dock already binds a document-level `Escape`
that calls `closeAll()` (`hw-live-identity.js:159`); extend it to also collapse the tray. State
persists in `localStorage['hw-seam-tray'] = 'open' | 'closed'`, default `closed`.

Because all six seam files define `dock()` **byte-identically** and first-loader-wins, the clean
move is to lift that block into a new `shared/hw-seam-dock.js` loaded before the seams, with each
seam keeping its current `if (W.HW_SEAM_DOCK) return W.HW_SEAM_DOCK;` guard as a fallback. If that
extraction is judged too wide for this change, edit all six identically — but then a
`tools/` check that diffs the six blocks is mandatory, because a divergence here is silent.

### 4.3 Delete the floating build stamp

`build-stamp.js` `render()` no longer creates a fixed element. Instead:

- Keep the whole resolution chain (`build-info.json` → GitHub API → nothing) verbatim.
- Publish the result on `window.HW_BUILD = { host, branch, sha, builtAt, source }`.
- `shared/app-switcher.js` renders it as the **last row of its already-existing dark menu**, below
  a `P.hairline`-equivalent divider: `local · main @ 1ec5207` in the menu's mono face at 10px,
  `#726d61`, `user-select: text`, with the current `title` string as its tooltip. That is exactly
  where someone asks "what am I looking at", and it costs zero permanent pixels.
- `Hyperwolf.html` is the one page with no app switcher. Render the same string there as a static
  line in the hub's own page footer — in flow, not fixed.

This removes the estate's only same-z DOM-order-decides overlap and returns 34% of two buttons.

### 4.4 One deterministic right-edge column

Right edge, `right: 16`, 44×44, 8px gaps, **bottom-anchored and gap-free**. Always-present layers
take the low slots so a missing conditional layer never leaves a hole:

| Slot | `bottom` | Layer | Present |
|---|---|---|---|
| 0 | `16` | **App switcher** | 13/14 pages (all but the hub) |
| 1 | `68` | **Notes** — moved down from 120 | 14/14 |
| 2 | `120` | **Tour "?"** | 8/14 |

Assignment is done by the registry (§5), not by hard-coded `bottom` values: each launcher declares
`{ edge: 'right', order: n }` and the registry assigns `bottom = 16 + index * 52` over the layers
that actually mounted. On the hub, notes falls to slot 0 and the "?" to slot 1 — no gap.

Also in this change:

- **Delete `.hwn-conn`** (`shared/notes.js:285`). Its state moves to (a) a tone dot on the notes
  button's existing badge and (b) a line in the panel header. It is the only thing sitting at
  `right: 70`, and removing it clears that column entirely.
- **"+ Demo data" leaves the corner.** It becomes a section inside the app-switcher menu
  ("Demo data", with the same rows and the same `report()` output block), gated to the `debug`
  tier (§5). Nothing renders at `right: 74` any more.
- **`hdToast` moves to `right: 76, bottom: 16`** (`shared/hd-ui.jsx:158`) — clearing the 60px
  launcher column plus a 16px gutter — with `max-width: 380` unchanged. Equivalently, and
  preferably: `right: calc(var(--hw-chrome-right) + 16px)`.
- `shop/chrome.jsx:165` (bottom-centre toast) is fine as-is. Leave it.

Net right edge: at most **three** 44px buttons in one column, 148px tall, nothing at `right: 8`
or `right: 74`, no dead pixels.

### 4.5 Reserve the gutters — this is what fixes `Accept & post`

Z-index cannot fix §3.4, because the sticky action bar is page content and the launcher is chrome
that legitimately floats above page content. Geometry has to fix it.

The registry (§5) sets two custom properties on `:root` at mount and on every `resize`:

```
--hw-chrome-right   : 76px    /* 44 launcher + 16 outer + 16 gutter */
--hw-chrome-bottom  : 60px    /* collapsed status pill: 30 + 14 + 16 */
--hw-chrome-left    : <measured rail width + 12>px
```

`--hw-chrome-left` is **measured**, never assumed. `shared/app-rail.jsx:46` is a flat 74px icon
rail, but Pipeline and Engage render an additional labelled section column beside it and
`dashboard.html` has its own `.rail` CSS. The six seam files each hard-code `LEFT: 86` with a
comment pointing at `app-rail.jsx:46`; that is right on POS today and wrong the first time the
tray ships anywhere else. Read it from the rail element's `getBoundingClientRect().right`.

Then, in the app:

- Every sticky bottom action bar gets `padding-right: var(--hw-chrome-right)` —
  `pipeline/screen-invoice.jsx:379`, `pipeline/screen-product-detail.jsx:230`.
- `pipeline/screen-scan.jsx:156` (`alignSelf: flex-end`) gets
  `margin-right: var(--hw-chrome-right)` in place of its current `marginRight: 20`.
- Full-height, non-scrolling boards get `padding-bottom: var(--hw-chrome-bottom)` on the column
  list — `pipeline/kanban.jsx`.
- `shared/hw-live-lines.js:763–781` replaces its hard-coded `right: 76 / bottom: 88 / bottom: 160`
  with the variables. **Keep the both-edges anchoring** — the comment there is correct and
  hard-won; only the constants change.

### 4.6 Stop the tour from auto-starting

`shared/tour.js:110` fires `start(0)` 700ms after load whenever `localStorage['hw-tour:<file>']`
is unset, and the mask blades are `pointer-events: auto`. Keyed per filename over 8 tour-enabled
pages, that is **eight** separate full-screen takeovers for a first-time visitor — one on the hub
before they have seen anything, one more on POS, and so on.

Replace with:

- Never auto-`start()`.
- Keep the `.pip` dot on the "?" button when the page's tour is unseen (that code already exists).
- **Once per browser**, not once per page: if `localStorage['hw-tour-offered']` is unset, show a
  single toast-shaped card anchored above the "?" button — "New here? Take the 60-second tour."
  with `Start` and `Not now` — then set the key regardless of which they pick.
- Everything else in `tour.js` is unchanged; `launch.onclick = start(0)` still works.

### 4.7 Theme and token compliance while you are in there

Per `HANDOFF.md`, `shared/app-switcher.js` and `shared/tour.js` are grandfathered as fixed dark
chrome. **`build-stamp.js` and `shared/demo-seed.js` are not** — both quietly joined that club
(`build-stamp.js` header cites the precedent explicitly). Since §4.3 and §4.4 fold both into the
app-switcher menu, they inherit its dark chrome legitimately and the exception does not widen.

Accent discipline. `HANDOFF.md`: accent at most once per view, selection is ink never accent.
Today on POS with the tour running you can see `P.accent` in the rail active plate, the
`#FFD100` tour ring, the `#FFD100` tour primary button, the `#FFD100` app-switcher current-app
row, `Add Product`, and the notes mode banner — six accent uses in one frame. The rules for the
consolidated chrome:

- The status pill's dot is **semantic tone only** (`good`/`warn`/`bad`) — never accent.
- The seam tray's selected row is `background: P.ink, color: P.surface` — ink, not accent.
- The notes button's active (`.hwn-btn.on`) state keeps its accent fill; that is the one accent
  the chrome layer is allowed, and only while note mode is armed.
- The app-switcher's current-app row moves from `#FFD100` fill to its dark-chrome ink equivalent
  (`background:#e9e6dd; color:#15140f`) — it is a selection, and selection is ink.

Both themes: the collapsed pill and the tray rows read `P.surface` / `P.hairline2` / `P.ink` /
`P.inkMute` / `P.shadowSm`, so they invert correctly. Verified in dark mode that the current pills
already do this — they blend into the dark table beneath them, which is *worse*, not better,
because the collision becomes invisible until you click.

Mono + `tabular-nums` on every value in the new chrome: the seam counts, the sha, and any timing.

---

## 5. The rule that prevents recurrence

Today each overlay is positioned independently with no shared awareness — that is the actual
defect, and `shared/hw-live-lines.js:763` is the proof: it correctly dodges the launcher column by
**hard-coding its neighbours' geometry in a comment**. That works exactly once, and breaks the day
a neighbour moves.

There is already a working precedent to generalise: `HW_SEAM_DOCK` solved this same problem for six
sibling panels — one tray, one open panel, one `Escape`, height-capped, self-scrolling. Its own
comment says why. Widen it from six seams to all chrome.

### 5.1 `shared/hw-chrome.js` — the registry

A new file, loaded **before** any overlay, owning three things: **slots, gutters, and tiers.**
Nothing else. It renders no UI of its own.

```js
window.HW_CHROME.register({
  id:      'notes',                 // unique; re-registering replaces
  tier:    'stakeholder',           // 'stakeholder' | 'operator' | 'debug'
  edge:    'right',                 // 'right' | 'bottom-left' | 'top-center'
  order:   10,                      // lower = closer to the corner
  size:    { w: 44, h: 44 },
  mount:   function (slot) { ... }, // slot = { left|right, bottom, z }
  onmove:  function (slot) { ... }, // re-invoked on resize / roster change
});
```

The registry then, and only then:

1. **Assigns slots.** For each edge, it sorts the registered layers by `order` and hands each one
   its computed offset over the layers that *actually mounted*. A layer that does not mount (the
   tour with no steps; the app switcher on the hub) leaves no hole, because slots are assigned
   over the live roster, not over a static list.
2. **Assigns z.** From `P.z` (§4.1). A layer that writes its own numeric z fails review.
3. **Publishes the gutters.** Sets `--hw-chrome-right`, `--hw-chrome-bottom`, `--hw-chrome-left`
   on `:root` from the measured roster, and re-publishes on `resize`. App code reserves space with
   the variables and never learns a pixel value.
4. **Stamps every root** it mounts with `data-hw-chrome="<id>"`. This is what makes the layer
   *findable* — see §6.1 and §5.3.
5. **Enforces one open menu.** Reuse `HW_SEAM_DOCK`'s `register(id, close)` / `opened(id)` /
   `closeAll()` contract verbatim, and bind `Escape` once, at the registry, closing all. Today
   `notes.js:585` and each `dock()` bind their own document-level `keydown`; one owner is enough.

### 5.2 Tiers — the demo switch

`HW_CHROME.tier` resolves once at load, first match wins:

1. `?chrome=stakeholder|operator|debug` in the URL,
2. `localStorage['hw-chrome-tier']`,
3. **default: `debug` on `localhost`, `stakeholder` everywhere else.**

A layer mounts only if its `tier` is at or below the active tier. Assignment:

| Tier | Layers |
|---|---|
| `stakeholder` | notes (all 5 boxes), app switcher, tour "?" |
| `operator` | + the collapsed live-data pill |
| `debug` | + the expandable seam tray, "+ Demo data", the build line in the switcher menu |

The consequence is the one the owner wants: **a stakeholder opening the Render or Pages URL sees
three buttons and nothing else**, while `localhost` and `?chrome=debug` keep every diagnostic
exactly as it is today. No instrumentation is lost; it stops being the demo's furniture.

### 5.3 The review rule, stated so it can be enforced

> **No file may create a `position: fixed` element that is not registered with `HW_CHROME`.**
> A fixed element belongs to exactly one of three classes: *chrome* (registered, tiered, slotted),
> *modal/sheet/toast* (owned by a screen, z from `P.z`, dies with its screen), or *bug*.
> Chrome never hard-codes a corner offset, never hard-codes a z-index, and never mentions another
> layer's geometry — if it needs to avoid something, it reads a `--hw-chrome-*` variable.
> App code that must not be covered reserves space with those variables; it never assumes a number.

This is greppable and worth a check in `tools/`: flag any `position:\s*['"]?fixed` outside
`shared/hw-chrome.js` whose file does not also contain `HW_CHROME.register` or a `P.z.` reference.
The existing floats in §1.3 (`athome/account-switch.jsx`, `shop/chrome.jsx`,
`terminals/tshared.jsx`) should either register or be added to an explicit, short allowlist —
`athome/account-switch.jsx` in particular is a `debug`-tier direction switcher pinned bottom-left
at `z 2147482000` and belongs in the registry.

---

## 6. What must not break

### 6.1 Notes is load-bearing. Treat it as production.

An external stakeholder is filing feedback against this build right now. **Nothing in §4 may
change the notes data model, its storage keys, or its export format.**

**The single most fragile behaviour in this repo** is `shared/notes.js` `locate()`. A pin does not
store coordinates. It stores `anchor.elText` (first 80 chars of the target's text) and
`anchor.elTag`, and on every frame it re-finds its element by scanning `document.querySelectorAll('*')`,
keeping visible exact-text matches, and taking the **smallest by area**. Only then does it fall
back to `xPct`/`yPct` of the scroller.

Three consequences, all binding:

1. **Do not re-word, re-tag, or restructure the text of any element that carries a pin.** Layout
   changes are safe (pins recompute from live rects, so `padding-bottom` in §4.5 is fine). *Text*
   changes silently demote a pin to an approximate position — it renders with a dashed border
   (`.hwn-pin.appx`) and lands somewhere near where it used to be. That is a quiet loss of the
   stakeholder's meaning.
2. **`locate()` excludes only `[data-hw-notes]`.** It does not exclude the seam pills, the tour
   card, the app-switcher menu, the demo menu or the build stamp — and those are *small*, so they
   win the smallest-area sort. A pin anchored to the words `Check-in`, `Live data`, `Home`, `POS`
   or `Export` **can migrate onto a floating overlay.** This is a live hazard today, not one §4
   introduces. **Ship the fix with the consolidation:** add
   `if (e.closest('[data-hw-chrome]')) continue;` alongside the existing `[data-hw-notes]` guard,
   and have the registry stamp `data-hw-chrome` on every root (§5.1.4). Do the §4.2 collapse
   *after* that guard is in, or six pill labels' worth of text disappears from the DOM in the same
   change that could have been re-anchoring pins onto them.
3. Pins must stay **above modals**. `P.z.notePin = 500` vs `P.z.modal = 310` preserves that. A pin
   on a modal element that falls behind the modal is unreachable feedback.

Also preserve, verbatim:

- The `N` shortcut to arm note mode, `Esc` to cancel, and the `typing()` guard that suppresses both
  inside the notes UI (`notes.js:585–597`).
- The crosshair cursor (`html.hwn-mode-on`) and the top-centre mode banner.
- The unread badge on the launcher (`.hwn-badge`), and the panel's `This page` / `All pages` scope,
  its status/type/author filters, `Show resolved pins`, `data-goto` scroll-to-pin, `Copy Markdown`
  and `Download JSON`.
- The notes root staying `position: fixed; inset: 0; pointer-events: none` with `auto` only on
  pins, popover, panel and button. Do not reparent it under a chrome wrapper that would create a
  new stacking context beneath modals.
- `panelSide()` (`notes.js:340`) — **note a latent bug while you are here:** it returns `left` for
  `/driver app/i.test(document.title)`, but the Driver App's actual title is
  `"Hyperwolf Driver + POS"`, so it never matches and the panel opens right. Fix by testing the
  filename rather than the title, or leave it — but do not "fix" it by changing the page title,
  which is what pins are keyed against (`n.page`).

### 6.2 The seam dock contract

`register(id, close)` / `opened(id)` / `closeAll()` and its Escape binding are the reason the
identity panel is reachable at all — the comment at `hw-live-identity.js:89` documents the
outage it fixed. `hw-live.js:1168 dockSync()` registers `'hw-live'` into it so the live panel and
the seam panels are mutually exclusive. **Keep the single-open-panel rule, keep the height caps
(`max-height: min(46vh, 380px)`, body scrolls inside), keep the visible close control.** §4.2
changes what the *tray* looks like, not how *panels* behave.

Six files define `dock()` identically and first-loader-wins. Whatever you do, do it to all six, or
extract it — a half-migrated dock is invisible until the wrong file loads first.

### 6.3 Everything else that is deliberate

- **`shared/hw-live-lines.js:763–781`** anchors to both edges on purpose: the pane renders at ~1.08
  zoom and `100vh` disagrees with `getBoundingClientRect` by 8%. Swap the constants for the
  variables; **do not** reintroduce a `calc(100vh - …)` cap.
- **Theme repaint by MutationObserver.** `pos/tokens.jsx` repaints `document.body.style` and emits
  no event, so `hw-live.js:watchTheme()` (and the equivalent in `notes.js`) observe the body's
  `style` attribute. Keep it; there is no event to subscribe to.
- **`build-stamp.js`'s silent failure.** `fetch` → `build-info.json` → GitHub API → render nothing.
  "A missing stamp must never break a page" is right. §4.3 keeps every branch and only changes
  where the string is displayed.
- **`pointer-events: none` on every chrome *wrapper*, `auto` on the interactive child.** Every
  layer that got this right did so after a bug. Do not collapse it while refactoring.
- **`hdToast`'s 4.2s auto-dismiss and `window.hdToast` global** — the batch board's drag-drop
  writes through it.
- **Tour step resolution by visible text** (`tour.js:byText`) has the same fragility as notes
  anchoring, for the same reason. Renaming a button breaks its tour step silently.

### 6.4 Out of scope, found in passing

`pos/screen-catalog.jsx:1268` and `:1284` carry the hex literals `#1F5FC0` and `#fff` inside a
screen file, which `HANDOFF.md` says cannot happen ("there are no color literals in any screen,
data, or helper file"). It is the Weedmaps brand mark, so it may be a deliberate third-party
brand colour — but it is undocumented and unreachable from `pos/tokens.jsx`. Worth a token
(`P.brand.weedmaps`) in a separate change. Not part of this one.

---

## 7. Verification checklist for the implementing agent

Run `python3 -m http.server 8830` from the repo root. For each item, use
`document.elementFromPoint` on the control's centre **and** its four corners — do not judge by eye,
and do not trust a screenshot at a non-1.0 device pixel ratio.

1. **1280×800 and 1920×1080, light and dark**, `Hyperwolf POS.html` → Catalog → any product →
   `Match · N%` → scroll the modal to the footer: all five points of `Confirm match` and of
   `Unmap · use custom product` return the button.
2. Same page, no modal: the collapsed status pill is **one row**, ≤320px wide, and the catalog
   table header row is fully visible.
3. Expand the tray: it is a vertical, capped, self-scrolling column; the tray never wraps at 1280;
   `Esc` collapses it; opening one seam panel still closes the others.
4. `METRC Batch Pipeline.html#/invoices/1`: all four corners of `Accept & post` return the button.
5. Any page: fire `hdToast(...)` and confirm no launcher overlaps it.
6. All **14** pages in §1.4: the right column is gap-free bottom-up, nothing renders at `right: 8`
   or `right: 74`, and `Hyperwolf.html` has no empty slot below its notes button.
7. Load a page for the first time in a fresh profile: **no tour auto-starts**; the "?" carries its
   pip; the one-time offer appears once across all pages, not once per page.
8. With `?chrome=stakeholder`: exactly three buttons, no pills, no demo-data button, no build
   stamp. With `?chrome=debug`: everything, laid out without collisions.
9. **Notes regression, on a profile that already has pins:** every existing pin re-anchors to the
   same element it did before, with the same solid (not dashed) border. Then verify no pin resolves
   onto a `[data-hw-chrome]` element. Export Markdown and JSON before and after and diff them —
   they must be byte-identical.
10. Set `localStorage['hw-pos-theme']` back to `light` and stop the server.
