# logistics/ (orphan inventory, 2026-09-09)
Whole module is a pinned snapshot mockup (ldata.jsx:1-2, NOW = Jul 20 2026 7:52 PM).
1. Enums: driver status 'duty|idle|break|meal|oos' (ldata.jsx:36,38,41; lparts.jsx:49 stMap second copy) → propose DriverStatus; riskBand 'ok|warn|bad' (ldata.jsx:9,100); orders have NO status enum, only booleans sched/future/driver:null and speed 'ASAP|Schedule' (ldata.jsx:50-69) → real gap vs OrderStatus/TaskStatus/TaskAssignmentMode.
2. Money: tax = +(sub*0.0822).toFixed(2) duplicated ldata.jsx:95 and lorder.jsx:325; money fallback lambda duplicated lorder.jsx:4 and lparts2.jsx:4; applyPromo float math ldata.jsx:194; window.Money renders `$${v}` ldata.jsx:239; orderTotals float reduce lorder.jsx:93-96. toFixed: ldata 6, lorder 6, lparts2 1.
3. Time: 37 literal 'H:MM PM' strings, NOW='7:52 PM' (ldata.jsx:8), day labels lorder.jsx:200,321,376; no ISO anywhere.
4. Ids: driver ids bare ints 1193-1391 (ldata.jsx:30-44), order ids 1000-1104, txn '1284420' strings (ldata.jsx:51); skus bare (ldata.jsx:74-79); no vendor ids present.
5. Literals: region/city table ldata.jsx:12-21 (8 cities); 13 REAL driver names + phone numbers ldata.jsx:30-44 ("from the roster screenshots", ldata.jsx:3) — PII in source; CUSTOMERS ldata.jsx:174-181; county map CN duplicated lviews.jsx:274 vs :330 with different suffix.
6. Second copies: money fallback ×2, tax rate ×2, county map ×2 (drifted), status→tone lviews.jsx:123 vs lparts.jsx:49.
7. Estimate L: order state model must be designed, not relabelled.
