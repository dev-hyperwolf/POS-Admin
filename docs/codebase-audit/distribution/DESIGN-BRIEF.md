# Distribution console — design brief

Does the design of the distribution screens need to improve, why, and how each improvement helps
the team. Drawn from `UX-REVIEW.md` (24 screens, five journeys, 14 ranked findings) and
`UI-DESIGN-CRITIQUE.md` (visual system, token proposal), plus the mockup
`explorations/Distribution Console - Refill Day.html`. Read-only; nothing in the super-admin
repo was changed.

## Verdict

Yes, and the design is part of the two problems the team reported, not just a cosmetic matter.
The screens commit the two most consequential actions in the warehouse, "Distribute" and
"Refill Kit", on one click with no preview; they show product age nowhere an operator can act;
and they surface only one of the four reasons a product gets skipped. The backend defects in the
logic map stay invisible because the screens were never built to show them. The component
library and the status vocabulary underneath are sound; they are unused or disconnected in the
places that matter.

## What to change, ranked by what it does for the team

| # | Change | Why (evidence) | What it does for the team |
|---|---|---|---|
| 1 | **Preview before commit** for build and refill: product · sold since last refill · need · cap · will give · reason, editable, then one explicit Commit | Both actions fire on Save from the same region picker (`distributionManagement/index.js:202-209`, `refillLogs/index.js:148-157`); a preview thunk exists and is never called | A wrong quantity or a skipped SKU is caught at the desk, not at closeout. This is the single change that turns "we found out at the end of the day" into "we fixed it before the kits left" |
| 2 | **Received-date lane** on the build, box and both add-product screens, with a one-tap send that places partially when stock is below the subregion count | No screen in the workflow shows received or purchase date; the one aging column that existed is commented out (`agingProducts/index.js:121-128`) | Premium product goes out the day it lands. Directly answers symptom 1 |
| 3 | **Skips and shortfalls panel** with plain-words reasons: short stock, below subregion count, not in refill template, no sales counted, capped | Only "box limitation" is ever shown, and only after the fact (`lowStockProducts.jsx:159`). Note: "no sales counted" must distinguish scheduled orders, which are sourced from the safe and rightly excluded from refill | Silent omissions become a to-do list someone can act on the same morning |
| 4 | **One status timeline** per distribution: built → frozen → synced to Blaze → dispatched → refilled → closed, with time and who | Status is raw text on the main screen while a coloured `StatusText` exists and is used on five others (`distributionManagement/index.js:72-78`); per-region pending/hold/paused shown nowhere | Everyone can see where a distribution is without inferring it from which buttons are visible; a paused subregion is no longer a mystery at refill time |
| 5 | **Honest buttons.** "Yes, Distribute" on the freeze dialog becomes "Freeze"; the Blaze sync gets a visible state and a manual "Sync now" | The button only flips a status flag; the sync call is commented out (`freezeDistribution.jsx:37,138`) | Operators stop believing product moved when it did not |
| 6 | **Partial-success banner** fed by a structured `{skipped, warnings}` field | The HTTP client passes every 200 through; no screen reads `skippedSubRegionIds` (`axiosClientDistribution.js:44-56`) | A refill that skipped three subregions stops showing as a green toast |
| 7 | **Scan feedback**: a visible ready state, a running "X of Y left" counter, three distinct outcomes (ok / wrong product / over quantity), and a timeout with retry on the socket call | Hidden input, one generic toast for every failure, no timeout (`driverKitDetails.js:516-527`) | Fewer mis-scans, and a dropped connection no longer looks like a broken scanner. Fewer discrepancies for Loss Prevention to chase |
| 8 | **Two templates, clearly two**: distribution and refill templates as labelled tabs with an "out of sync" indicator | Both tables render back to back on one route with identical columns (`kitTemplate/index.js:9-11`) | Editing the wrong template, a plausible cause of "wrong products in kits", stops happening |
| 9 | **Stock beside the caps**: an Available column on the template SKU grid | Min/max are set blind (`assignProducts.jsx:97-197`) | Caps are set against reality, not memory |
| 10 | **Day Close lives with Distribution**: closure, discrepancy and waste under the same menu, kit report linked to that driver's closure form | Two disconnected top-level menus (`routes.js:2261, 2566`) | The evidence that explains a refill error is one click from the refill, not a menu switch away |
| 11 | **Status colours that mean something**: one colour per state, and short / skipped / paused defined instead of falling to alarm red | Nine states share one green; unknown states default to red (`StatusText.jsx`) | The screen reads at a glance from across a warehouse |
| 12 | **Tablet layout**: responsive, one scrollbar, larger targets | Zero media queries in 11,935 lines of styles; fixed 300 px sidebar | The tool works where the work happens |
| 13 | **Fix, don't hide**: restore Total Retail Value once the backend formula is fixed; show the waste ETA setting and a distinct empty state | Columns commented out to hide a wrong number (`regionClosureForms.js:106-114`); waste list empty when a setting is unset with no message | The team gets correct numbers back instead of missing ones |
| 14 | **Two dead ends removed**: the Update Distribution save that returns before saving; the manual-add quantity guard that is commented out | `addDistribution/index.js:134`; add-product-refill validation | Edits stop vanishing; the rush-it-out path stops assigning more than exists |

## How this fits the rebuild

Per the owner's decision, the new console **Hyperwolf Distribution** is built in our estate to
this brief, with every control bound to an existing route (see `DISTRIBUTION-REBUILD-PLAN.md`
D3). Items 1, 3 and 6 need the engine's reasons and a preview route; those are on the developer
change list (#9) and the engine ships them. Items 2, 4, 5, 7–12 need nothing new underneath.
Items 13–14 and the surgical super-admin fixes (use `StatusText` on the main screen, delete the
stray `return`, re-enable the quantity guard, un-comment the aging column) go on the change list
so the existing screens improve while the console is built.

The mockup shows items 1–4 on one screen, in the estate's own tokens, so the console will look and
behave like Bounty and Verify.
