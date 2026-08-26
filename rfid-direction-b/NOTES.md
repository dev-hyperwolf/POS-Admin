# Direction B — Embedded in existing flows

Open `index.html`. The **Compare** switch in the top bar flips all three screens at once.
Everything RFID adds carries an info-toned rule and an `RFID` tag.

## Screens extended

- **Kit verification** → Hyperdrive Logistics, *Distribution › Kit build* (`#/kits/:id`).
  The `Counted` column changes source; a session strip, a pull list grouped by source box,
  a rescan queue and the handheld view appear. The plan column is untouched.
- **Cycle count** → METRC Batch Pipeline, *Operations › Inventory* (`#/inventory`). One band
  above the table, one `Counted` column inside it, one stragglers sheet. The filter row is
  unchanged.
- **Commissioning** → METRC Batch Pipeline, *Products › Batches & traceability*
  (`#/products/:id`). The row action that already read *Print labels* becomes
  *Encode & print*, and grows a review step: binding preview, 1:1 enforcement,
  `409 COLLISION` with audit ids.

Nothing is added to `shared/app-nav.js` or to the module sidebar — that is the argument.

## Reused verbatim

`pos/tokens.jsx`, `pos/icons.jsx`, `pos/atoms.jsx` (Card, PBtn, IconBtn, Field, BarMeter,
StrainPill, MicroLabel), `shared/app-rail.jsx`, `shared/states.jsx`, `shared/hd-format.jsx`,
`shared/hd-ui.jsx` (HDPill, StatTile, HDTable, UidChip, MultiSelectFilter, MetaCell, Sheet,
ToastHost), and `shared/brands.js` for vendor names. No file outside `rfid-direction-b/`
was touched; zero hex literals.

## Invented

1. **The diff mark** — `RfidPanel isNew` + `RfidTag`. No "this is new" affordance exists;
   ink reads as selection and accent is spoken for.
2. **Dual-fill bar** — tags heard behind tags kept by argmax. `BarMeter` draws one series.
3. **Device frame** — the same route at 360px beside the desk layout.
