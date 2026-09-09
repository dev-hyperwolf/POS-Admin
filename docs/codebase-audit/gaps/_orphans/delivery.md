# delivery/ (orphan inventory, 2026-09-09)
1. Enums: SUBREGIONS status 'on|off' (ddata.jsx:18-26; dmap.jsx:59,74; dapp.jsx:30,53,379,511) and CALLOFFS status 'open|covered' (ddata.jsx:141-143) → propose RegionShiftStatus, CallOffStatus. DRIVERS = ROSTER.filter(p.role==='driver') (ddata.jsx:119) reads a Classification through a Role field — contract ROLE_MAP maps 'driver'→'associate', so a normalised roster empties the schedule silently.
2. Money: window.HW.fmt.money on dollar floats (dapp.jsx:6,146-148,365,476,543; ddata.jsx:8-11 min/fee); raw '$'+pin.min string concat dapp.jsx:202-203 bypasses the formatter.
3. Time: bare strings '9:00a','Jul 13','7:42 AM' with hand regex parsers fmtTime/startMin (ddata.jsx:8,121,141; dapp.jsx:56,140); no ISO.
4. Ids: Weedmaps wmid/pinId/token synthesised bare (dapp.jsx:260-281), never externalId('weedmaps',…); sub-region ids 'RC-01' fail isSlug (uppercase) (contracts/index.js:142); newCountyId ad hoc dapp.jsx:440.
5. Literals: STORE_PINS store names dapp.jsx:266; 12 driver names ddata.jsx.
6. Second copies: char-code-sum hash dapp.jsx:258 == mobile/data.jsx:174 — the anagram-collision pattern ddata.jsx:56-58 documents as a prior bug; governance.test.mjs does not cover dapp.jsx.
7. Estimate M: shapes isolated to ddata.jsx + WeedmapsPanel/RegionsHome; needs two new enums and the role/classification decision.
