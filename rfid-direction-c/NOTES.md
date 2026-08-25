# Direction C — Operator-first, device-shaped

## Handheld ergonomics

- **One question per screen.** A packing-room operator reads while moving, so each
  screen opens with a full-bleed verdict band — tone fill, 44–56px mono figure — and
  keeps the detail below it for when they stop.
- **The action lives under the thumb.** A pinned 64px dock at the bottom holds at most
  one accent action; back sits top-left because it is rare. Rows are 64px, chips 40px,
  steppers 48px — all above HANDOFF's ≥56px scan-screen floor for anything primary.
- **Never two accents.** While the radio is reading, "Lock box" is disabled and quiet;
  it only becomes the accent action once counts settle.
- **Values never dance.** Every count, RSSI, dBm and EPC is mono with tabular-nums, so
  a ticking number never reflows its row.
- **The gate is visible.** Power and gate sit in the scan field and the status bar, so a
  miscalibration shows on the floor rather than in a log.

## Reused from the system

`pos/tokens.jsx`, `pos/icons.jsx`, `pos/atoms.jsx` (PBtn, Pill, Seg, Tabs, BarMeter,
Avatar, IconBtn, Eyebrow, SectionHead), `shared/hd-ui.jsx` (StatTile, HDPill, HDTable,
MicroLabel, MetaCell, ToastHost), `shared/states.jsx`, `shared/app-rail.jsx`,
`shared/brands.js`. No existing file was touched.

## Invented

- **`TCDevice`** — `mobile/ios-frame.jsx`'s frame structure re-cut as a Zebra TC22R:
  square bezel, side triggers, Android nav triad, 360×660 screen. An iPhone frame would
  have misrepresented the hardware.
- **`HHBand` / `HHDock` / `HHAction` / `HHScanField`** — a glanceable-state and
  thumb-dock layer the system did not have; `mobile/chrome.jsx` is store-coupled.
