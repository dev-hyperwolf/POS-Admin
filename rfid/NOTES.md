# RFID — the shipped module

Direction **A** as the base, with Direction **C**'s handheld surface and decision model grafted
on. This is one module, not a third study. `rfid-direction-a/`, `-b/` and `-c/` are untouched.

Open `rfid/index.html` **through a server** — Babel cannot XHR `.jsx` over `file://`:

```
cd /Users/jt/Documents/hyperwolf-repos/POS-Admin-merged && python3 -m http.server 8807
# → http://localhost:8807/rfid/index.html
```

Theme is `localStorage['hw-pos-theme']`. Light is the default; both modes are designed.

## What came from where

**From A — the whole spine.**

- `data.jsx` is A's port of `rfid-middleware/src/reconciliation/engine.ts` — argmax-RSSI →
  −62 dBm gate → SKU resolve → per-box diff → greedy cross-box moves. Nothing on any screen is
  typed: 696 assigned, 1,745 reads, 14 correct / 5 short / 1 excess / 1 wrong, 2 moves (7 units),
  2 rescan, 4 missing units and every per-box figure fall out of that one run.
- The rail-app chrome: shared 74px `HWRail` + 208px module sidebar + 56px topbar + hash routes.
- All seven of A's routes, plus one: `#/kits`, `#/counts`, `#/commission`, `#/registry`,
  `#/handheld`, `#/devices`, `#/audit`, `#/settings`.
- A's admin surface intact: tag registry, devices, audit log.
- A's primitives: `EpcChip`, `LinePill`, `Delta`, `Dbm`, `ChipFilter`, `Callout`, `CoverageBar`,
  `PowerScale`, `SkuToken`, `KV`, `CardHead`.

**From C — the floor, and who is allowed to decide what.**

- The TC22R device frame and all **13 handheld screens** (6 kit · 4 count · 3 commissioning),
  reachable at `#/handheld?flow=kit|count|tags|map`.
- C's ergonomics: 64px rows, 64px dock actions, 48px steppers, 40px chips, one accent per
  screen, the full-bleed verdict band, values that never reflow.
- C's **decision-rights model**, now enforced rather than described. `DECISION_RIGHTS` in
  `data.jsx` is the single table; `#/handheld?flow=map` renders it, `#/settings` repeats it, and
  the screens obey it.
- C's "How the two connect" view, kept as a real route rather than a tab.

**From B — nothing.** Its inventory `Batches` mono-numeral fix had no equivalent surface here:
every numeral in this module is already mono/tabular. Its embedded-in-existing-flows argument
was the direction not chosen.

## The decision layer (`RfidDecisionProvider` in `ui.jsx`)

The handheld **asserts**; the desk **decides**. Four decisions are live and round-trip:

| Decision | Where | Gate |
|---|---|---|
| Approve & post a kit | `#/kits/:id` sticky bar | typed reason ≥ 8 chars |
| Reject & re-scan | `#/kits/:id` sticky bar | typed reason |
| Close a straggler as missing | `#/counts/:id` sticky bar | select rows + typed reason |
| Rebind an EPC / uphold the binding | `#/commission` collision panel | typed reason |
| Override the confidence gate | `#/settings` | typed reason, range-checked |

Every one writes an audit event that appears at the top of `#/audit` tagged `this session`, and
the handheld re-renders to match — approve the kit on the desk and the device's Kit verdict band
turns from `REVIEW` to `APPROVED BY THE DESK`. `#/settings → Reset decisions` clears them.

## Design-system notes

- **Zero hex literals** in every `.jsx`/`.js` under `rfid/`. The only literal colour anywhere is
  the sanctioned `rgba(128,128,120,…)` scrollbar/placeholder chrome in `index.html`, copied
  verbatim from the other entry pages.
- **No `canvas` / `canvas2`.** Since the ramps were unified, `canvas === bg` and `canvas2 === bg2`
  — and in dark mode `bg2` is *darker* than `bg`, so anything that leaned on the old cool ramp to
  read "raised" now collapses. Structure here comes from `surface`/`surface2`/`surface3`, a
  `hairline`/`hairline2` border, or `shadowSm`. Root is `bg`; the sidebar and the device stage are
  `bg2` **with an explicit hairline**. `Card elevation="sunken"` is avoided because the shared
  atom resolves it to `canvas2`.
- **Accent at most once per view**, never for selection. Selection is `background: P.ink,
  color: P.surface` everywhere — chips, box cards, the handheld screen index, the material
  toggle. The module mark in the sidebar is ink, not accent, so the rail keeps the only accent
  plate in the chrome. Modal confirms are the one accent inside a modal.
- **Mono + `tabular-nums` on every value** — numbers, IDs, EPCs, dBm, timestamps, percents, SKUs,
  and the machine-generated audit `detail` strings. Sans is kept for prose and for *names*
  (product names like "Blue Dream 3.5g", hardware model names like "Zebra TC22R", media names
  like "Vulcan Glint UHF · NXP UCODE 9xe"). That is HANDOFF's line: a value is mono, a name is not.

## Where A and C genuinely conflicted

1. **Two different kits.** Both fixtures were named `KIT-2026-0824-03` and disagreed on
   everything — plan, faults, SKU ids, brands, operators, clock. A's engine wins outright, so C's
   handheld copy was re-pointed at A's computed lines: the moves are now 2 (not C's 2 different
   ones), the unresolved list is 3 lines / 4 units, and the box the device stands in front of is
   box 3 because that is where A's wrong-product fault lives.
2. **Which surface is primary.** C made the handheld the default route and the desktop the
   second pane. A is a rail app. Resolved in A's favour: the desk is the app, the handheld is a
   first-class route inside it (`The floor → Handheld & desk`, plus a "See it on the handheld"
   button on each workflow and a persistent reader chip in the sidebar). **This is a real demotion
   of C's central argument** — the owner should know it was a deliberate trade, not an oversight.
3. **Per-box telemetry.** C typed `unique / reads / bleedRejected / avgRssi / seconds` per box.
   Four of those are now derived from the same read map the engine consumes; `seconds` is the one
   that cannot be, so it is computed from the read count at the adapter's ~12 reads/s rather than
   typed twice.
4. **Tone for rescan.** A used `quarantine`, C used `info`. C's wins on the device (a rescan is
   not a quarantine), A's stays on the desk stat tile where it sits beside the four line states.

## Still weak

- **The reconciliation is real; the rest is fixtures.** Only `KIT-2026-0824-03` carries a
  computed session. The other four kit rows are list fixtures and say so when opened. The three
  cycle counts and five commissioning runs are hand-written records, not engine output — a cycle
  count has no engine to port.
- **Decision state is `React.useState`.** It resets on reload, and nothing is persisted. That is
  the prototype's honest shape, but it means the audit log's "this session" rows vanish on
  refresh.
- **The handheld's live counters are eased animations toward a computed target**, not a
  simulated read stream. They settle at the right number; they do not model arrival order.
- **`#/settings` gate override changes the number everywhere it is displayed, but does not
  re-run the engine.** Setting the gate to −70 will not move a tag out of the rescan queue. Doing
  it properly means re-running `reconcileKit` with the new gate — cheap to add (the function is
  already exported and pure), deliberately not done because it would make the seeded audit-log
  figures disagree with the recomputed ones.
- **`Card elevation="raised"`** is unused here; the device stage on `#/handheld` uses `bg2` +
  hairline. In a very dark room that stage is a subtle recess. It is correct, not invisible, but
  it is the weakest surface separation in the module.
- **Two multi-word pill labels stay sans** — "7 lines need a decision", "Request rescan of 2" —
  because they are sentences with a count in them, not values. Defensible, but it is a judgement
  call someone may want reversed.
- **Nothing here is verified on hardware.** The five unverified items on `#/devices` are the real
  list, and the ZPL warning is permanent until someone prints one label and reads it back.
