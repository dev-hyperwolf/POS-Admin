# Concept-page accessibility audit — 2026-09-17

Scope: 12 concept files plus their 3 review pages, unchanged. Static inspection of markup, inline CSS and scripts (including generated template markup); no browser, server, external request or screenshot. Runtime layout, screen-reader output and actual focus behavior remain unverified. Line numbers below refer to the audited worktree files.

Severity: **blocker** = a demonstrated source-level obstruction to a core keyboard operation; **should-fix** = a concrete accessibility defect or a clearly marked narrow-layout risk; **nice-to-have** = useful semantic polish. Blocker counts count finding rows, not individual elements. This is not a WCAG certification.

Contrast method: convert sRGB channels to linear light (c/12.92 up to 0.04045, otherwise ((c+0.055)/1.055)^2.4), use luminance 0.2126R+0.7152G+0.0722B, then (lighter+0.05)/(darker+0.05). Alpha tokens are composited on the specified background before conversion. Normal text needs 4.5:1 for AA; disabled text is excluded. The task's 44 px target benchmark is reported separately: 44 px is not the blanket WCAG AA target-size threshold. Exact font-dependent heights/overflow require later browser measurement; no new target sizes are approved by this report.

## explorations/Promo Rules - Concept A - Sentence Builder.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Remove condition is a click-only span without keyboard semantics. | `.rm` | 263 | blocker | Use a named native remove button. |
| Generated field/operator/value controls have no associated names. | `.chip select/input` | 252 | should-fix | Label each control by condition and purpose. |
| Action buttons are 32 px and compact buttons 26 px high. | `.btn, .btn-xs` | 78 | should-fix | Provide a 44 px hit area when target sizing is approved. |
| Editing rebuilds the focused card without restoring its control focus. | `renderRule / change listener` | 305 | should-fix | Update controls in place or restore focus by a stable key. |
| Reference table has no dedicated overflow wrapper; long chips need a sub-390 px check. | `.ref-table` | 121 | should-fix | Contain table scrolling and allow chips to wrap without page overflow. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.ref-table th` | 122 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Theme and text buttons are named. No fixed page-wide pixel width found; table/chip overflow is a static risk, not a measured failure.

## explorations/Promo Rules - Concept B - Condition Table.html

**Blockers: 0.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Enabled compact View JSON buttons use a 26 px minimum height. | `.btn-xs` | 89 | should-fix | Provide a 44 px hit area after target approval. |
| Activation replaces its containing card and loses the triggering button node. | `renderRule` | 310 | should-fix | Preserve or restore focus after the status update. |
| View JSON toggles content but exposes no expanded state. | `[data-toggle-json]` | 315 | should-fix | Connect the button with aria-controls and aria-expanded. |
| Header cells exist but lack explicit scope/caption. | `.cond-table` | 319 | nice-to-have | Add a descriptive caption and column scope. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.cond-table th` | 93 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. No input/select/textarea labels are applicable, and active click targets are native buttons. The mobile card-body overflow-x rule at line 135 contains the condition table; no definite fixed-width viewport break found.

## explorations/Promo Rules - Concept C - Batch Picker.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Sortable headers only bind click, so keyboard users cannot sort. | `th[data-k]` | 349 | blocker | Put native sort buttons in headers and expose aria-sort. |
| Field labels are siblings without for/id association. | `.field label` | 191 | should-fix | Associate each visible label with its input ID. |
| Batch checkboxes and stepper plus/minus controls lack contextual names. | `#batchBody input / .stepper` | 335 | should-fix | Name each checkbox by batch and each stepper by threshold/direction. |
| Stepper buttons are 24×24 px and theme control 32×32 px. | `.stepper button` | 113 | should-fix | Increase their hit areas to 44 px after approval. |
| Seven-column batch table has no horizontal overflow containment. | `table.batches` | 94 | should-fix | Use a contained responsive table wrapper below 390 px. |
| Threshold updates replace the stepper controls without focus restoration. | `chipsEl.innerHTML` | 368 | should-fix | Retain focused controls while updating derived values. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `table.batches th` | 95 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Scope checkboxes are correctly nested in labels, unlike generated batch checkboxes. The blank selection-column header is also a semantic gap; remaining data columns have th.

## explorations/Promo Rules - Concept D - Agent Draft Review.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Draft selectors are divs with onclick and no role, tabindex or key handling. | `.rule-card` | 231 | blocker | Use named buttons for draft selection. |
| Rejection text area has only a placeholder. | `#rejectBox textarea` | 299 | should-fix | Add a persistent associated rejection-reason label. |
| Theme button is 32×32 px. | `.theme-btn` | 51 | should-fix | Give the theme control a 44 px hit area after approval. |
| Three-column switcher does not collapse at the columns breakpoint. | `.switcher` | 63 | should-fix | Collapse or wrap draft cards for sub-390 px layouts. |
| Reject opens a region without setting or restoring focus or expansion state. | `toggleReject` | 329 | should-fix | Move focus into the reason field and restore it on dismissal. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.meta-line` | 84 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: No data table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Theme has a title; reject region is hidden with display:none before opening. Desktop content columns collapse below 980 px, but the switcher does not.

## explorations/HR Overview - Concept A - Day Board.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Day-board cards are clickable divs without keyboard activation. | `.dcard` | 424 | blocker | Use a button or link for each detail opener. |
| Closed panel is only translated offscreen; opening supplies no focus management. | `#panel` | 151 | should-fix | Hide/inert the closed panel and use a labeled dialog with focus entry/return and Escape. |
| Close control uses an unexplained cross glyph. | `#panelClose` | 233 | should-fix | Name the button Close detail. |
| Panel close is 28×28 px and theme button 32 px high. | `.panel-x` | 157 | should-fix | Provide 44 px hit areas after owner approval. |
| Entity selection is exposed only through a CSS class. | `#entitySeg` | 197 | should-fix | Publish selection with aria-pressed or native radio controls. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.stat .lbl` | 95 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: No data table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Entity/theme buttons have readable labels; no text inputs. Panel uses max-width:92vw and needs lane scrolls, so the 420 px nominal panel width alone is not a viewport defect; unwrapped entity controls still merit phone testing.

## explorations/HR Overview - Concept B - People First.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| People rows only bind click; detail cannot be opened by normal keyboard navigation. | `#peopleBody tr[data-id]` | 358 | blocker | Add a named detail button or link in each row. |
| Status, document filter and search lack associated labels. | `#statusSel, #docSel, #searchBox` | 185 | should-fix | Add labels for both filters and search. |
| Detail close has only a cross glyph. | `#detailClose` | 377 | should-fix | Add a Close employee detail accessible name. |
| Search is 32 px high and detail close 26×26 px. | `.search, .detail-pop .x` | 145 | should-fix | Use 44 px interactive hit areas after approval. |
| Closing detail rebuilds its contents without returning focus to the opener. | `#detailClose handler` | 390 | should-fix | Restore focus to the employee row action after dismissing detail. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `table.people th` | 90 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. The table has an overflow-x wrapper and the layout collapses at 1080 px; no unbounded fixed-width page container established.

## explorations/HR Overview - Concept C - Compliance Wall.html

**Blockers: 0.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Entity buttons use 12.5 px text with 7 px vertical padding and no 44 px minimum. | `.entity-switch button` | 65 | should-fix | Set an approved minimum interactive hit area rather than relying on line-height. |
| Entity filter selection is visual only. | `#entitySwitch` | 169 | should-fix | Expose the selected entity using aria-pressed or radio semantics. |
| Unwrapped entity switch and nowrap route badges can exceed the narrow content area. | `.entity-switch, .route` | 64 | should-fix | Allow wrapping or contained scrolling while preserving readable labels. |
| Filtered wall and counts are replaced without a polite results announcement. | `#entitySwitch handler` | 467 | nice-to-have | Announce a short updated result count in a status region. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.stat .lbl` | 86 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: No data table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. No editable inputs or icon-only enabled buttons. Doc cards are informational, with no click handlers; disabled M4 actions are intentionally unavailable and are not keyboard blockers. Single-column wall breakpoint exists.

## explorations/HR Overview - Concept D - Manager Inbox.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Folder divs are not tab stops and have no role; global number shortcuts do not provide standard tab operation. | `.folder` | 154 | blocker | Use native folder buttons with selected state and contextual keyboard operation. |
| Global letter shortcuts mutate triage state regardless of focus; focusedIdx changes CSS rather than DOM focus. | `document keydown` | 377 | should-fix | Scope shortcuts to the list and expose the active item using focus or aria-activedescendant. |
| Triage action is a clickable span without a named control. | `.triage` | 339 | should-fix | Use a labeled status-action button or menu per item. |
| Folder hit area is 30 px high. | `.folder` | 81 | should-fix | Use approved 44 px hit areas. |
| Entity selection is a CSS class without programmatic state. | `#entitySwitch` | 140 | should-fix | Use aria-pressed on the entity buttons. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.mstat .l` | 74 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: No data table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. No editable fields or enabled icon-only buttons. A 480 px max-width canvas and scrolling folder strip avoid an unconditional fixed-width break; list has a tabindex but rows only get visual focus styling.

## explorations/LP Triage - Concept A - Queue.html

**Blockers: 2.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Role disclosure is click-only and not focusable. | `#roleChip` | 248 | blocker | Use a disclosure button with aria-expanded and controlled content. |
| Document-level Enter prevents default for every non-input element, including native buttons. | `document keydown` | 498 | blocker | Limit queue key handling to the queue and let unrelated buttons activate normally. |
| Preview-as select has adjacent text but no label association. | `#viewAsSel` | 241 | should-fix | Use a label for viewAsSel. |
| Queue render replaces focused rows; every row is tabbable and selection lacks aria-selected. | `#qtbody` | 400 | should-fix | Use a coherent table or listbox pattern with managed focus and selected state. |
| Theme button is 38×38 px. | `.iconbtn` | 104 | should-fix | Provide a 44 px hit area after approval. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `table.qtbl th` | 142 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Table header cells exist, but role=listbox/option replaces table semantics; decide one interaction model rather than mixing both. Horizontal table wrapper exists and detail column stacks; no definite fixed-width page break established.

## explorations/LP Triage - Concept B - Case File.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Role disclosure is a click-only div. | `#roleChip` | 251 | blocker | Use a named native disclosure button. |
| Preview-as select lacks an associated label. | `#viewAsSel` | 244 | should-fix | Associate the Preview as label with the select. |
| Selecting a case rebuilds both the queue buttons and dossier navigation without returning focus. | `selectCase` | 388 | should-fix | Restore focus to the selected case or stable navigation control. |
| Prev/next controls are 34 px high and theme is 38×38 px. | `.navbtn` | 153 | should-fix | Provide 44 px hit areas after approval. |
| Selected case is signaled by class only. | `.qchip` | 377 | should-fix | Expose the current case programmatically with aria-current or pressed state. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.qchip .qc-sub` | 141 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Queue chips are native buttons, not click-only divs. Queue rail becomes horizontal below 940 px; no definite fixed-width container break established. Keyboard shortcuts exist but do not restore focus after rendering.

## explorations/LP Triage - Concept C - By Day.html

**Blockers: 0.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Drawer is transformed offscreen but remains focusable; opening does not focus/trap/restore, despite a dialog role. | `#drawer` | 167 | should-fix | Use a modal dialog with hidden/inert closed state and focus return. |
| Date input and close glyph lack useful associated names. | `.daypicker input / .drawer-close` | 233 | should-fix | Label the business-day field and name the close button. |
| Day arrows are 28×28 px; drawer close is 30×30 px. | `.daypicker button / .drawer-close` | 103 | should-fix | Provide approved 44 px hit areas. |
| Eight-column board has nowrap cells and no scroll wrapper; narrow rules only shrink cell padding. | `table.board` | 139 | should-fix | Contain the table horizontally or use a phone summary with detail expansion. |
| Action column headers are empty although other th cells exist. | `table.board thead` | 275 | nice-to-have | Add an accessible Actions column name and header scope. |
| Role selector toggles only class state. | `#roleseg` | 240 | should-fix | Expose the role preview choice with aria-pressed. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `table.board th` | 140 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: Tables have header cells; no headerless table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Rows also include native View case buttons, so the redundant onclick row is not counted as a keyboard blocker. Escape closes the dialog; focus management is still missing. Disabled disposition/amount fields also need labels before enabling.

## explorations/LP Triage - Concept D - Store Manager Phone.html

**Blockers: 1.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Notification cards open a case only via onclick. | `.notifcard` | 204 | blocker | Use a named native button or link for each case opener. |
| Sheet stays focusable when translated closed; open/close changes classes without managing focus. | `#sheet` | 131 | should-fix | Use a modal with hidden closed state, focus containment and focus return. |
| Bell and close controls rely on emoji/cross glyphs; response field has only a placeholder. | `.appbar-bell / .sheet-close` | 184 | should-fix | Give icon buttons explicit names and label the response field before enabling it. |
| Bell is 36×36 px and sheet close 28×28 px. | `.appbar-bell, .sheet-close` | 138 | should-fix | Provide approved 44 px hit areas. |
| Tabs and role preview expose selection only via classes. | `.tab / #roleseg` | 197 | should-fix | Use tab or pressed-button semantics with an associated panel. |
| Muted normal text: light rgba(15,15,12,.42) on #ffffff = 2.81:1; dark rgba(245,243,234,.40) on #1a1a14 = 3.55:1, both below AA 4.5:1. | `.appbar-role` | 95 | should-fix | Use a darker light-theme/lighter dark-theme muted text token meeting 4.5:1. |

Coverage notes: No data table found. No raster images/canvas or text baked into images found in source; SVG/emoji icons are separate from readable text. Escape closes the sheet. Its 480 px width is capped at 100vw and the phone at 100%, so those widths alone are not mobile overflow defects. No data table; response controls are disabled deliberately.

## explorations/review/promo-rules.html

**Blockers: 0.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Concept select, section and note text lack associated labels. | `#concept, #section, #text` | 30 | should-fix | Provide persistent labels for all three fields. |
| Light muted #7b8590 on #ffffff is 3.75:1; dark white on #3fb3ad selected tabs/buttons is 2.54:1; white Keep on #1f8a4c is 4.38:1 (all below 4.5). | `.blurb / .tab / .btn / verdict` | 9 | should-fix | Choose contrast-compliant text/background pairs for both themes. |
| Header and tabs never wrap; four long tab labels impose an overflowing minimum width below 390 px. | `header / .tabs` | 8 | should-fix | Stack the heading and use wrapped or contained-scroll tabs on phones. |
| Retract uses 11 px text and zero padding; verdict/tab controls have only 6 px vertical padding. | `.note .x / .verdict button` | 22 | should-fix | Provide approved 44 px hit areas without compressing the note list. |
| aria-selected is placed on generic buttons without a tablist/tab role relationship. | `#tabs` | 45 | should-fix | Use a complete tabs pattern or switch to aria-pressed buttons. |
| Polling replaces notes (and focused retract controls) every 8 seconds. | `#notes render` | 57 | should-fix | Reconcile notes by stable IDs and preserve the focused action. |
| Save/load errors and connection state update plain text without a live region. | `#status` | 36 | should-fix | Use a polite status region and move focus to the PIN prompt when needed. |

Coverage notes: PIN and name labels are correctly associated; iframe has a title. No click-only non-button targets found. No data tables or raster/text-image elements found. The 340 px notes column collapses below 900 px, but the unwrapped header remains a separate narrow-layout problem.

## explorations/review/hr-overview.html

**Blockers: 0.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Concept select, section and note text lack associated labels. | `#concept, #section, #text` | 30 | should-fix | Provide persistent labels for all three fields. |
| Light muted #7b8590 on #ffffff is 3.75:1; dark white on #3fb3ad selected tabs/buttons is 2.54:1; white Keep on #1f8a4c is 4.38:1 (all below 4.5). | `.blurb / .tab / .btn / verdict` | 9 | should-fix | Choose contrast-compliant text/background pairs for both themes. |
| Header and tabs never wrap; four long tab labels impose an overflowing minimum width below 390 px. | `header / .tabs` | 8 | should-fix | Stack the heading and use wrapped or contained-scroll tabs on phones. |
| Retract uses 11 px text and zero padding; verdict/tab controls have only 6 px vertical padding. | `.note .x / .verdict button` | 22 | should-fix | Provide approved 44 px hit areas without compressing the note list. |
| aria-selected is placed on generic buttons without a tablist/tab role relationship. | `#tabs` | 45 | should-fix | Use a complete tabs pattern or switch to aria-pressed buttons. |
| Polling replaces notes (and focused retract controls) every 8 seconds. | `#notes render` | 57 | should-fix | Reconcile notes by stable IDs and preserve the focused action. |
| Save/load errors and connection state update plain text without a live region. | `#status` | 36 | should-fix | Use a polite status region and move focus to the PIN prompt when needed. |

Coverage notes: PIN and name labels are correctly associated; iframe has a title. No click-only non-button targets found. No data tables or raster/text-image elements found. The 340 px notes column collapses below 900 px, but the unwrapped header remains a separate narrow-layout problem.

## explorations/review/lp-triage.html

**Blockers: 0.**

| Issue | Element or selector | Line | Severity | Suggested fix |
|---|---|---:|---|---|
| Concept select, section and note text lack associated labels. | `#concept, #section, #text` | 30 | should-fix | Provide persistent labels for all three fields. |
| Light muted #7b8590 on #ffffff is 3.75:1; dark white on #3fb3ad selected tabs/buttons is 2.54:1; white Keep on #1f8a4c is 4.38:1 (all below 4.5). | `.blurb / .tab / .btn / verdict` | 9 | should-fix | Choose contrast-compliant text/background pairs for both themes. |
| Header and tabs never wrap; four long tab labels impose an overflowing minimum width below 390 px. | `header / .tabs` | 8 | should-fix | Stack the heading and use wrapped or contained-scroll tabs on phones. |
| Retract uses 11 px text and zero padding; verdict/tab controls have only 6 px vertical padding. | `.note .x / .verdict button` | 22 | should-fix | Provide approved 44 px hit areas without compressing the note list. |
| aria-selected is placed on generic buttons without a tablist/tab role relationship. | `#tabs` | 45 | should-fix | Use a complete tabs pattern or switch to aria-pressed buttons. |
| Polling replaces notes (and focused retract controls) every 8 seconds. | `#notes render` | 57 | should-fix | Reconcile notes by stable IDs and preserve the focused action. |
| Save/load errors and connection state update plain text without a live region. | `#status` | 36 | should-fix | Use a polite status region and move focus to the PIN prompt when needed. |

Coverage notes: PIN and name labels are correctly associated; iframe has a title. No click-only non-button targets found. No data tables or raster/text-image elements found. The 340 px notes column collapses below 900 px, but the unwrapped header remains a separate narrow-layout problem.

### Cross-file summary — five most widespread issue groups

| Issue group | Files | Shared fix proposed for a later approved build |
|---|---:|---|
| Normal-text contrast | 15/15 | Shared theme semantic text colors in the design token system, checked on real surfaces. |
| Small interactive hit areas | 15/15 | Shared button/icon-button target primitive; route through the pending target-size design approval. |
| Focus continuity / modal lifecycle | 14/15 | Shared dialog/drawer and keyed-list focus utilities in the common UI layer. |
| Missing or ambiguous control names | 12/15 | Shared labeled field and icon-button primitives. |
| Selected/expanded state is only visual or uses incomplete ARIA | 10/15 | Shared segmented-control, tabs and disclosure primitives with matching keyboard behavior. |

Keyboard-only inaccessible div/span interactions also affect 9 files; replace them with native actions when building the chosen concepts. No HTML, shared component or token was changed.

### Blocker totals

| File | Blockers |
|---|---:|
| explorations/Promo Rules - Concept A - Sentence Builder.html | 1 |
| explorations/Promo Rules - Concept B - Condition Table.html | 0 |
| explorations/Promo Rules - Concept C - Batch Picker.html | 1 |
| explorations/Promo Rules - Concept D - Agent Draft Review.html | 1 |
| explorations/HR Overview - Concept A - Day Board.html | 1 |
| explorations/HR Overview - Concept B - People First.html | 1 |
| explorations/HR Overview - Concept C - Compliance Wall.html | 0 |
| explorations/HR Overview - Concept D - Manager Inbox.html | 1 |
| explorations/LP Triage - Concept A - Queue.html | 2 |
| explorations/LP Triage - Concept B - Case File.html | 1 |
| explorations/LP Triage - Concept C - By Day.html | 0 |
| explorations/LP Triage - Concept D - Store Manager Phone.html | 1 |
| explorations/review/promo-rules.html | 0 |
| explorations/review/hr-overview.html | 0 |
| explorations/review/lp-triage.html | 0 |

Total: 10 blocker rows, 93 findings across 15 files. Counts describe audit findings, not failing automated accessibility tests.

### Verification and limitations

`grep -c "^## " docs/CONCEPT-PAGES-A11Y-AUDIT-2026-09-17.md` → `15`. Source anchors resolve in all 15 files; HTML hashes match before/after; five summary frequencies are derived from file membership rather than duplicate elements. No browser execution, screen-reader testing, font download, API call, or runtime assertion. Narrow-layout risks are explicitly unmeasured.
