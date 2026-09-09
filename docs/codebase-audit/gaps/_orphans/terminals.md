# terminals/ (orphan inventory, 2026-09-09) — 1,545 lines in 5 files
1. Enums: kind 'station|mobile' (tdata.jsx:18-78) but the Add-Terminal wizard emits 'driver' (tshared.jsx:189-197) — mismatch, silent today (consumers test !== 'station'); propose TerminalKind. Shift status 'on-shift|off|offline' (tdata.jsx:48-67,101; v2.jsx:112; tshared.jsx:79,494,523) → propose DriverShiftStatus. drawer.state 'open|closed' (tdata.jsx:16-145; tshared.jsx:83,89,494; v2.jsx:199) → propose DrawerState. Deposit dest 'safe|bank|hand' (tdrawer.jsx:223-226). Region ids RC1…OC2 sliced by prefix (tshared.jsx:326,414,417).
2. Money: window.HW.fmt.money = dollar-float formatter (pos/data.jsx:424-427); floats end to end (tdata.jsx:22,27,42); 9 toFixed in tdrawer.jsx (23,25,109,111,234-263); denominations 0.25/0.10/0.05/0.01 tdrawer.jsx:10-14; no cents boundary.
3. Time: bare strings tdata.jsx:22,137; nowTime() local string tdrawer.jsx:60; no ISO.
4. Ids: rid(pfx) random BAG-/DRW-/DEP-#### tdrawer.jsx:61, no collision guard; device tags bare; PosVendor never referenced.
5. Literals: 'Hyperwolf Lake Elsinore','HW-00001-101' tdata.jsx:13; GROUP_LABEL region map duplicated tshared.jsx:327 vs 415; hardcoded employee names tdata.jsx:18-67,116-122.
6. Second copies: roleTint/roleLabel ×3 (tshared.jsx:267-268, 331-332, 304); RegionReaderMap legacy dead copy tshared.jsx:446-483.
7. Estimate L: float money in every drawer arithmetic line + shared money() in pos/data.jsx; two new enums; kind mismatch.
