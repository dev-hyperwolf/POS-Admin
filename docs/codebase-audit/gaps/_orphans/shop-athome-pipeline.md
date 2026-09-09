# shop/ athome/ pipeline/ (orphan inventory, 2026-09-09)
## shop/ — estimate M
1. Enums: lane 'express|scheduled' ×~15 sites (data.jsx:128-131,143,802-854; screen-cart.jsx:51,154,383,387,514-515; screen-checkout.jsx:110,208,235,429-462; screen-shop.jsx:178) → propose Lane; stage 'verify' reuses pos/data.jsx:955 ORDER_STAGES → propose OrderStage/FulfillmentStage; source 'Hyperwolf', channel 'Web', pay 'Card' screen-checkout.jsx:238-239.
2. Money: screen-checkout.jsx:220 Math.round(price*100) in a screen, violating data.jsx:733-734's own rule that dollars→cents lives in the adapter; six toFixed(2) building a dollar-float order record screen-checkout.jsx:224,236,246,249,250,255; data.jsx:889-898,933 intentional bridging; display via window.HW.fmt.money with bare dollars.
3. Time: ephemeral new Date() only; nothing serialised.
4. Ids: sku opaque (data.jsx:149); no vendor ids.
5. Literals: 'Hyperwolf' screen-checkout.jsx:230,238, screen-shop.jsx:38; data.jsx:589,641 correctly use HW_BRANDS.
6. Second copies: screen-checkout.jsx:220-224 reinvents shared/commerce-adapter.js:66 toEngineProduct.
## athome/ (Shop @ Home admin, Members CRM, Customer Account — consumer mockup, no verification literals) — estimate M
1. Enums: STATUS requested/confirmed/en_route/in_session/completed/canceled (admin.jsx:74-80) → AtHomeVisitStatus; GSTATUS available/en_route/in_session/off (admin.jsx:82-86) → GeniusShiftStatus; crm.jsx:27-34,50-55 statuses; tier Gold/Silver/Bronze/Platinum (crm.jsx:27-34; account-a.jsx:13) → LoyaltyTier; role 'Ops'/'Genius' free text crm.jsx:70-71.
2. Money: money/money2 reinvented ×5 (account-a/b/c.jsx:8-9; admin.jsx:9-10; crm.jsx:7-8); ~63 float-dollar fields.
3. Time: free-text strings only.
4. Ids: 'A-2041','g1' hand-typed.
5. Literals: cities duplicated admin.jsx:24-28,63-70 vs crm.jsx:27-34; brand strings account-a/b/c.jsx:16-19; person fixtures triplicated.
6. Second copies: ME/ORDERS fixtures verbatim across account-a/b/c.jsx:12-24.
## pipeline/ (supply-chain intake, not incidents) — estimate L
1. Enums: BATCH_STATUS_ORDER 10 values (domain.jsx:24) → BatchStatus; INVOICE_STATUS_LABEL (domain.jsx:38-41) → InvoiceStatus; INBOX_STATUS_META/ORDER (domain.jsx:57-64) → InboxStatus; matchReason exact_sku_qty|sum_match (data.jsx:59,68,71) → LineMatchReason; credit-memo statuses data-ops.jsx:138-141 → CreditMemoStatus.
2. Money: dollar floats (data.jsx:124-125,203-205; data-vendors.jsx:68,78) AND *Cents ints (screen-product-detail.jsx:346; screen-buyers.jsx:270-375; screen-inventory.jsx:223); 15 hand '/ 100' sites instead of HD.formatCents; 48 toFixed; percent reinvented (screen-inbox.jsx:287; screen-invoice.jsx:55,57,338; screen-buyers.jsx:130) vs HD.formatPercent.
3. Time: ISO via toISOString (84 hits) off a frozen NOW, but the epoch literal is hardcoded in three files (data.jsx:21; data-products.jsx:4; data-buyer.jsx:18) and kanban.jsx:185 mixes Date.now().
4. Ids: vendorId/masterProductId/metrcPackageId bare (fixture data, data.jsx:1-4).
5. Literals: entity names in three drifted places domain.jsx:8-11, data-ops.jsx:38, shared/hd-format.jsx:7-11.
6. Second copies — REAL BUG: domain.jsx:286-295 Object.assign-overrides window.HD formatCurrency/formatNumber/formatPercent/formatDate/formatDateTime/relativeTime with different implementations (domain.jsx:245-266; relativeTime reads HD_DATA.NOW vs ENGAGE_DATA.NOW) while shared/hd-format.jsx:4-5 claims domain.jsx "does not redefine anything"; formatCents survives only by omission.
