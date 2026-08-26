# Direction A — Native console

**Where it sits in the rail.** Directly below **Batches**, above **Promos**. Catalog → Batches
→ RFID is the physical-goods run of the rail: an operator going from "batch approved for sale"
to "tag it, pack it, verify the kit" travels one item down. Everything below is commerce, which
needs the goods to exist first. This study injects that item at runtime (`nav.js`) since it may
not edit existing files — really it is three one-line edits (`shared/app-nav.js`,
`shared/app-switcher.js`, `Hyperwolf.html`), same turn.

**Reused unchanged.** `pos/tokens.jsx`, `pos/icons.jsx`, `pos/atoms.jsx` (Card, PBtn, Field,
Check, BarMeter, IconBtn, Avatar), `shared/app-rail.jsx`, `shared/states.jsx`,
`shared/hd-format.jsx`, `shared/hd-ui.jsx` (HDPill, StatTile, HDTable/TH/TR/TD, UidChip,
MultiSelectFilter, MicroLabel, Sheet, ToastHost), `shared/brands.js`. Shell is the pipeline's:
74px rail + 208px sidebar + 56px topbar + hash routes. Zero hex literals; nothing outside
`rfid-direction-a/` touched.

**Invented, because the system had no pattern.**

- `EpcChip` — an EPC is neither a METRC UID nor a HUID, so it gets its own namespace instead of
  being mislabelled by `UidChip`.
- `LinePill` / `Delta` / `Dbm` — the four reconciliation states map onto existing tones
  (correct→ok, short→blocked, excess→warn, wrong-product→quarantine). No new colour enters.
- `CoverageBar` — a meter with its pass threshold drawn on it.
- `Callout` — a tone-washed inline caveat. This module ships with genuinely unverified claims;
  burying them in a doc is how a pilot ships broken.
- `PowerScale`, and the persistent reader chip in the sidebar footer: the console is meaningless
  if the one handheld is off the bridge.
