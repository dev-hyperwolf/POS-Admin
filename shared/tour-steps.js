// ── Hyperwolf guided tour — step definitions, keyed by page filename ────────
// Each step: { title, body, act?, text?/sel? (what to spotlight), scope?, tag?,
//              place?, pad?, round?, before?() (drive the UI), wait? }
// A step with no resolvable target renders as a centred card — safe by default.
(function () {
  var T = function () { return window.HWTour; };
  var go = function (label, opt) { return function () { var t = T(); t && t.click(label, opt); }; };
  // Open the first product row in the catalog table (its name cell is clickable).
  // Make sure we are on the catalog product list first — this step can be
  // entered from the Categories module or from another product page.
  var openProduct = function () {
    var t = T(); if (!t) return;
    var back = t.byText('Back to catalog') || t.byText('Back to Catalog');
    if (back) back.click();
    setTimeout(function () {
      t.click('Catalog', { tag: 'button', scope: 'aside' });
      setTimeout(function () {
        var rows = document.querySelectorAll('tbody tr');
        for (var i = 0; i < rows.length; i++) {
          var c = rows[i].querySelector('div[style*="cursor"]');
          if (c) { c.click(); return; }
        }
      }, 280);
    }, back ? 240 : 0);
  };
  // Leave the product page (if open) and enter the Categories module.
  var openCategories = function () {
    var t = T(); if (!t) return;
    var back = t.byText('Back to catalog') || t.byText('Back to Catalog');
    if (back) { back.click(); setTimeout(function () { t.click('Categories', { tag: 'button' }); }, 260); }
    else t.click('Categories', { tag: 'button' });
  };
  var catTab = function (label) { return function () { var t = T(); t && t.click(label, { tag: 'button' }); }; };

  // The Weedmaps order block now uses collapsible folds. Open one only if it is
  // shut — clicking an already-open fold would close it and strand the step.
  var openFold = function (label) {
    var t = T(); if (!t) return;
    var b = t.byText(label, { tag: 'button' }); if (!b) return;
    var sv = b.querySelector('svg:last-of-type');
    var shut = !sv || !/180/.test(sv.style.transform || '');
    if (shut) b.click();
  };
  // Open an order of a given kind and expand a fold inside it. Pickup and
  // delivery orders now render different verification states, so the tour has
  // to be explicit about which one it is showing.
  var openOrder = function (delivery, fold) {
    return function () {
      var t = T(); if (!t) return;
      var scrim = document.querySelector('div[style*="z-index: 95"], div[style*="z-index: 200"]');
      if (scrim && scrim.style.position === 'fixed') scrim.click();
      t.click('Orders', { tag: 'button', scope: 'aside' });
      setTimeout(function () {
        t.click(delivery ? 'Delivery Orders' : 'Pickup Orders', { tag: 'button' });
        setTimeout(function () {
          if (delivery) { var tr = document.querySelector('tbody tr'); tr && tr.click(); }
          else {
            var e = t.byText('#ORD-00231'); if (!e) return;
            var n = e;
            for (var k = 0; k < 5 && n; k++) { var r = n.getBoundingClientRect(); if (r.height > 90 && r.height < 210) break; n = n.parentElement; }
            n && n.click();
          }
          if (fold) setTimeout(function () { openFold(fold); }, 500);
        }, 420);
      }, 300);
    };
  };
  // Open a member profile from the Members table (row index).
  var openMember = function (idx) {
    return function () {
      var t = T(); if (!t) return;
      var back = t.byText('Back to members'); if (back) back.click();
      t.click('Members', { tag: 'button', scope: 'aside' });
      setTimeout(function () {
        var rows = document.querySelectorAll('tbody tr');
        rows[idx || 0] && rows[idx || 0].click();
      }, 420);
    };
  };

  window.HW_TOUR_STEPS = {

    // ══════════════════════════════════════════════════════════ POS ════════
    'Hyperwolf POS.html': {
      name: 'POS walkthrough',
      steps: [
        { title: 'Welcome to the register', ey: 'Start',
          body: 'This is where in-store revenue is rung up. In the next couple of minutes you\'ll see how a sale runs end to end — and why what you do here changes what a stranger can buy on Weedmaps seconds later.' },
        { text: 'Home', tag: 'button', scope: 'aside', place: 'right',
          title: 'The rail is the whole app', body: 'Six places: <b>Home</b> for your shift, <b>Register</b> to sell, <b>Orders</b> for the queue, <b>Catalog</b> for products, <b>Members</b> for customers, <b>Settings</b> for the store.' },
        { text: 'Check in customer', place: 'bottom',
          title: 'Everything starts with check-in', body: 'A visit begins by identifying the guest — <b>not</b> mid-sale. Search for an existing customer, or create one with name, <b>date of birth</b> and address.',
          act: 'Date of birth is the age gate. It is not optional metadata.' },
        { title: 'Guests are referrals, not sales', ey: 'Concept',
          body: 'Anyone who walked in with the buyer is added to the party — by count, by name, or grouped from the waiting room. They are tracked as <b>referrals</b>, so the sale stays whole and footfall still gets measured. A group of four with one buyer is one sale and three referrals, never four quarter-sales.' },
        { text: 'Register', tag: 'button', scope: 'aside', place: 'right', before: go('Register', { tag: 'button', scope: 'aside' }), wait: 550,
          title: 'Building the cart', body: 'Availability here is <b>store on-hand stock</b> — not driver kits. That distinction runs through the whole system: pickup sells what is in the building, delivery sells what is in a van.' },
        { sel: '[data-tour="disc-card"]', place: 'left',
          title: 'A manual discount is money leaving the till', ey: 'Policy',
          body: 'So it never applies on an associate\'s say-so. Typing an amount and pressing <b>Apply</b> raises a <b>request</b> — nothing changes on the total yet. A named manager, their PIN and a reason are required, and the amount, the reason and who signed it off are written to the audit log against this sale and into the daily discount report. Anything at 25% or steeper is flagged there automatically.',
          act: 'Promo codes are different — they are pre-approved rules, so they apply straight away.' },
        { sel: '[data-tour="rewards-card"]', place: 'left',
          title: 'The reward ladder is fixed', ey: 'Loyalty',
          body: '<b>100 pts → $2.50 off · 200 → $5 · 400 → $10 · 800 → $20</b>, plus a <b>$20 birthday</b> reward that is a membership perk and needs no points at all. Locked coins are simply below the member\'s balance — there is no approval step, because the points were already earned.' },
        { title: 'Taking payment', ey: 'Concept',
          body: 'Cash, card, or a split. The card leg runs on the reader <b>assigned to this station</b> in Terminal Configuration — readers are static to a counter on purpose, so settlements always reconcile back to the same place.' },
        { text: 'Orders', tag: 'button', scope: 'aside', place: 'right', before: go('Orders', { tag: 'button', scope: 'aside' }), wait: 550,
          title: 'The order queue', body: 'Verification → to pack → packing → ready. In-store sales and channel orders (including Weedmaps) all land in the same queue, because fulfilment does not care where demand came from.' },
        { text: 'Catalog', tag: 'button', scope: 'aside', place: 'right', before: go('Catalog', { tag: 'button', scope: 'aside' }), wait: 600,
          title: 'The single source of truth', body: 'Every product lives here once. Weedmaps, the delivery menu and the driver app are all <b>projections</b> of this record — change a price here and it pushes to both Weedmaps listings in under a second.',
          act: 'Never sell around a wrong stock count. It oversells the Weedmaps pickup listing too.' },
        { title: 'THC comes from batch lots', ey: 'Concept',
          body: 'Each physical lot carries its own potency. Stock is the sum of its lots and carts draw <b>FIFO</b> from the oldest, so the THC we advertise matches the label on the jar the customer is actually handed. A single flat number would be wrong the moment a new lot lands.' },

        // ── Product ↔ Weedmaps sync, on the real record ───────────────────
        { title: 'Now follow one product out to Weedmaps', ey: 'Sync',
          body: 'Opening a product shows its <b>Weedmaps card</b> — the live state of that SKU on the channel. This is the part people misunderstand most, so the next few stops go slowly.',
          before: openProduct, wait: 1100 },
        { sel: '[data-tour="wm-card"]', place: 'left',
          title: 'One product, two listings', body: 'The rows here show which listings this SKU is live on. <b>Pickup</b> is driven by store on-hand stock. <b>Delivery</b> is driven by driver kits — one pin per city, live only in on-shift kits. Same product record, two entirely different availability rules, so a SKU can be live on one and absent from the other, correctly.',
          act: 'Mapping the two listings identically is the classic integration bug.' },
        { sel: '[data-tour="wm-extid"]', place: 'left',
          title: 'The load-bearing key', body: 'Weedmaps does not know our database. It recognises this product solely by <code>external_id</code> — our stable SKU anchor. Every menu write is addressed to it rather than to any Weedmaps id we hold.' },
        { title: 'Why external_id must never change', ey: 'Critical',
          body: 'Change it and Weedmaps treats the item as brand new. It <b>discards the product link, the curated brand, the category mapping and the item\'s entire history</b> — then the SKU reappears as an unmapped stranger that cannot sell. Rename anything else you like. Never this.' },
        { title: 'What a push actually sends', ey: 'Sync',
          body: 'Name and weight go verbatim. Price converts cents → dollars with card fee and rounding applied. THC goes as a real <b>min–max range</b> read from the batch lots. Store on-hand becomes <code>availability</code> on Pickup; kit membership becomes <code>integratorMetadata.driver_ok</code> on Delivery.' },
        { title: 'Auto, 1-click, and hands-off fields', ey: 'Sync',
          body: 'Most fields are <b>auto</b> — no human. <b>Brand</b> and <b>category</b> are <b>manual</b>, curated by a person, and must never be auto-overwritten: Weedmaps discards curation if we stomp it. <b>wm_product_id</b> is <b>1-click</b> — the matcher proposes, a human approves.' },
        { title: 'You almost never press sync', ey: 'Sync',
          body: 'Writes push themselves in under a second through a <b>coalescing bus</b> — ten edits in a row collapse into one API call. A drift sweep re-checks every five minutes as a safety net. If that sweep keeps <i>finding</i> drift, real-time pushes are broken; fix the pushes rather than leaning on the sweep.' },
        { title: 'The two states that stop a sale', ey: 'Critical',
          body: '<b>WM-missing</b> — the SKU is live on a kit but has no Weedmaps product link, so a menu write returns <code>422 no wm_product_id</code> and it cannot sell. <b>Orphaned</b> — a Weedmaps link pointing at a product we no longer carry. The first is an outage; the second is cleanup.' },

        // ── Categories → Weedmaps taxonomy ──────────────────────────────
        { title: 'Where categories are decided', ey: 'Taxonomy',
          body: 'Category is the one field Weedmaps <b>requires</b> on every menu item — and the one it will not let us invent. It has its own fixed taxonomy, so ours has to be mapped onto theirs. That mapping lives in its own module.',
          before: openCategories, wait: 900 },
        { text: 'Categories', up: 2, place: 'bottom', before: catTab('Categories'), wait: 850,
          title: 'Our taxonomy, two levels', body: 'Hyperwolf categories (Flower, Vapes, Concentrates…) each hold <b>sub-categories</b> — the merchandising names staff actually use, like “Smaller Bud Flower” or “Single Infused Pre-Roll”. These are ours; Weedmaps has never heard of them.' },
        { text: 'Sub Categories', tag: 'button', place: 'bottom', before: catTab('Sub Categories'), wait: 900,
          title: 'Sub-categories are the unit of mapping', body: 'Mapping happens at <b>sub-category</b> level, not category level. That is deliberate — “Premium Flower” and “Smaller Bud Flower” are both Flower to us but land on different Weedmaps nodes (<b>Big Buds</b> vs <b>Smalls</b>).' },
        { text: 'Weedmaps mapping', tag: 'button', place: 'bottom', before: catTab('Weedmaps mapping'), wait: 900,
          title: 'The mapping board', body: 'Every sub-category with its Weedmaps target and status: <b>mapped</b>, <b>unmapped</b>, or deliberately <b>skipped</b>. This board is the whole contract in one screen — work it top to bottom and the catalog syncs clean.' },
        { title: 'The real Weedmaps taxonomy', ey: 'Taxonomy', before: catTab('Weedmaps mapping'), wait: 700,
          body: 'The picker is seeded from Weedmaps’ published Menu API taxonomy (2025-07): eleven <b>L1</b> roots — Flower, Pre Roll, Infused Pre Roll, Vape Pens, Concentrates, Edibles, Drinks, Wellness, Gear, Cultivation, Other — each with <b>L2</b> children and, where they exist, <b>L3</b> leaves shown as “L2 › L3”.',
          act: 'These are their names, not ours. Do not rename them to match our language.' },
        { title: 'Unmapped is not cosmetic', ey: 'Critical', before: catTab('Weedmaps mapping'), wait: 700,
          body: 'A menu item must carry at least one valid <code>category_id</code>. A sub-category with no Weedmaps node means every product under it is <b>rejected by Weedmaps</b> — it will not appear, and no amount of re-syncing fixes it. Unmapped rows are the first thing to clear.' },
        { title: 'Mapping is many-to-one, on purpose', ey: 'Taxonomy', before: catTab('Weedmaps mapping'), wait: 700,
          body: 'One of our sub-categories can point at <b>several</b> Weedmaps nodes. “Solventless Rosin / Hash” maps to both <b>Solventless › Rosin</b> and <b>Solventless › Ice Water Hash</b>, so products surface in either place a customer browses. Several of ours can also share one node — all our flower grades sit under <b>Flower › Bud</b>.' },
        { title: 'Skipped means intentionally never synced', ey: 'Taxonomy', before: catTab('Weedmaps mapping'), wait: 700,
          body: 'Promotional and pseudo-categories — <b>Hyper Deals</b>, <b>Clearance</b> — are merchandising constructs with no Weedmaps equivalent. Marking them <b>skipped</b> records that as a decision, so they stop showing up as unmapped errors. Skipped and unmapped look similar and mean opposite things.' },
        { title: 'When Weedmaps changes their tree', ey: 'Done', before: catTab('Weedmaps mapping'), wait: 700,
          body: 'They do, and they announce it — the Concentrates, Edibles/Drinks/Wellness and Vapes trees were all restructured recently. When a node is retired, the mapping goes stale silently and those products quietly stop appearing. Re-check this board after any Weedmaps taxonomy changelog.' },
        { text: 'Members', tag: 'button', scope: 'aside', place: 'right', before: go('Members', { tag: 'button', scope: 'aside' }), wait: 550,
          title: 'One customer ledger', body: 'History, tier and behaviour flags. Every channel merges into this one record — so a hot note written by a driver on Tuesday is visible at this counter on Thursday. <b>Blocked here means blocked everywhere.</b>' },
        { title: 'That\'s the register', ey: 'Done',
          body: 'Next, see where those orders go: open <b>Delivery</b> for the map and regions, <b>Logistics</b> for live dispatch, or <b>Promotions</b> for the Weedmaps channel. Use the grid button in the corner to switch apps — every one has its own walkthrough behind the <b>?</b> button.' },
        // ── Identity, guests & the Weedmaps order block ──────────────────────
        { title: 'Now: who the customer actually is', ey: 'Identity',
          body: 'The rest of this walkthrough is about <b>identity</b> — how a person becomes a verified customer, how a Weedmaps stranger gets mapped onto one, and why a customer never has to verify twice.',
          before: go('Orders', { tag: 'button', scope: 'aside' }), wait: 600 },
        { text: 'Add guest to check-in', place: 'top',
          title: 'Every guest is a customer', body: 'A party is not a headcount. Anyone who walks in with a buyer is either <b>linked to an existing customer</b> or onboarded through the full new-customer flow.',
          act: 'A name on its own is not enough — compliance requires a real record for every person.' },
        { title: 'What onboarding a guest requires', ey: 'Compliance',
          body: 'Full name, date of birth, and a <b>scanned + photographed government ID</b>. Phone is optional but recommended. Until every guest clears that bar, the check-in buttons stay disabled — you cannot accidentally check in a party with a stranger in it.' },
        { title: 'What the ID scan actually captures', ey: 'Concept',
          body: 'The scanner reads the <b>PDF417 barcode</b> on the back of the licence — name, date of birth, document number, expiry — and stores a photo of the document. That is an <b>attended</b> check: a real person held the real ID. It is the strongest evidence we ever get.' },
        { text: '#ORD-00231', place: 'right', pad: 4,
          before: openOrder(false), wait: 1500,
          title: 'A Weedmaps order, opened', body: 'Weedmaps orders land in the same queue as everything else. Open one and the blue block at the top is everything the channel gave us — plus everything we worked out ourselves.' },
        { title: 'Read the triage strip first', ey: 'Reading it',
          body: 'Three chips across the top answer the only questions that decide what to do next: is it <b>verified</b>, is the <b>customer matched</b>, and is <b>ID settled</b>. Everything below is folded, with its state on the closed header — nothing is hidden, it just is not all shouted at once.' },
        { text: 'Order details', tag: 'button', place: 'left', before: function () { openFold('Order details'); }, wait: 600,
          title: 'What Weedmaps actually sends', body: 'Name, phone, and sometimes an address. That is it. <b>No verified document, no date of birth, no email on many orders.</b> Weedmaps is a storefront, not an identity provider — so a WM contact starts at zero on our side.' },
        { text: 'Weedmaps order status', tag: 'button', place: 'left', before: function () { openFold('Weedmaps order status'); }, wait: 600,
          title: 'Two status vocabularies, kept in sync', body: 'Our fulfilment stage, Weedmaps’ own state machine, and what the customer literally reads on weedmaps.com. Moving a stage here pushes the matching WM status back automatically.' },
        { text: 'Identity & fraud check', tag: 'button', place: 'left', before: function () { openFold('Identity & fraud check'); }, wait: 600,
          title: 'The fraud score', body: 'Scored on the document, the name, the phone, the address and device history. <b>Low risk clears itself.</b> High risk on a delivery order is gated — it cannot be released until a human verifies it.' },
        { text: 'Customer identity', tag: 'button', place: 'left', before: function () { openFold('Customer identity'); }, wait: 700,
          title: 'Mapping a stranger onto a customer', body: 'We match the WM contact against our ledger on <b>phone, email, name and device fingerprint</b>, with a confidence score. A confident single match offers a merge; two matches ask you to choose; no match creates a new customer.',
          act: 'Merging unifies order history, wallet and loyalty under one person.' },
        { title: 'This one is a PICKUP order', ey: 'Critical',
          body: 'Scroll to Verification status and it says plainly: <b>no verification SMS is sent</b>. They collect in store, so the counter scans and photographs their ID at hand-off exactly like any walk-in. Texting them would be asking for proof they are about to hand over in person.' },
        { text: 'Verification status', up: 2, place: 'left',
          before: openOrder(true, 'Customer identity'), wait: 2400,
          title: 'Now the same block on a DELIVERY order', body: 'Identical order shape, different channel — and the verification section changes completely. Nobody will be standing at our counter, so the account has to be bound to a real person before a driver is ever dispatched.' },
        { text: 'Pending verification', up: 2, place: 'left',
          title: 'The verification SMS — delivery only', body: 'Tagged <b>Delivery only</b> for a reason: this is the single situation that triggers it. The document may already be settled; what is open for a <b>remote</b> order is whether the person tapping “order” is that same human. One SMS code answers it.',
          act: 'A walk-in buying at the counter is never sent one. Ever.' },
        { text: 'Send log', up: 2, place: 'left',
          title: 'Automatic, and auditable', body: 'The system fires it the moment a delivery order appears for an account with an ID on file but no confirmed phone — nobody has to remember. Every attempt is logged with <b>who triggered it</b>, a timestamp and the <b>carrier delivery receipt</b>, so you can tell “never delivered” from “ignored”.',
          act: 'Resend only when it genuinely never landed. The code box is for reading it back over the phone.' },
        { title: 'Why this is not double verification', ey: 'Policy',
          body: 'Re-checking the document would be asking the same question twice. The ID is not in doubt — <b>account ownership</b> is. Phone possession is the cheapest honest answer to that, and it takes five seconds at the counter while they are already paying.' },
        { title: 'So: walked in, scanned, no Persona — what happens?', ey: 'Policy',
          body: 'They are <b>delivery-ready before they leave the store</b>. ID scanned + photographed, one SMS code, done. When they later order delivery on our site or Weedmaps, the order arrives pre-cleared. <b>They never see Persona.</b>' },
        { title: 'And the customer who never walked in?', ey: 'Policy',
          body: 'Their choice of two, and both are one-time. <b>Persona link</b> before the first order — selfie plus document liveness. Or <b>nothing at all</b>: the driver scans their ID at the door on delivery one, which upgrades the account for every order after it.',
          act: 'Persona is a substitute for the in-store scan, never an extra step on top of one.' },
        { title: 'The door check still happens', ey: 'Important',
          body: 'None of this removes the driver checking a physical ID at handover — that is a legal requirement of the handover itself, not an account check. What it removes is the customer being asked to <b>prove who they are twice before the order is even allowed to exist</b>.' },
        { title: 'One ledger, one identity', ey: 'Identity',
          body: 'In-store scan, door scan and Persona all write to the same customer record, and a block anywhere is a block everywhere. That is why a guest onboarded at the counter today can order delivery tonight with nothing further asked of them.' },

        // ── The customer record itself ────────────────────────────────────
        { title: 'Open a customer and the profile leads with risk', ey: 'Members',
          body: 'Everything you have just seen — verification, merges, driver incidents — lands on one record. The next few stops are what that record shows you, and in what order.',
          before: openMember(3), wait: 1700 },
        { sel: '[data-tour="hot-notes"]', place: 'bottom',
          title: 'Hot notes come first, always', body: 'A hot note is not a normal note. It is a safety or behaviour flag that must be read <b>before</b> anyone serves this customer — violent or abusive at the door, suspected diversion, or a complaint against a named employee.',
          act: 'Pinned at the top in red. Never behind a click into a Notes tab.' },
        { title: 'Five categories, and one that blocks a person', ey: 'Members',
          body: '<b>Safety</b>, <b>Conduct</b>, <b>Suspicious</b>, <b>Service</b> — and <b>Staff conflict</b>, which takes an employee name. That one is enforced, not advisory: check-in warns before putting that person on the sale, and dispatch skips them when assigning a driver.' },
        { title: 'Dispatch writes these too', ey: 'Concept',
          body: 'When a driver cancels a stop for a no-show or a hostile door, the cancel flow offers a hot note and it lands here — same object, same banner. It is how a pattern becomes visible instead of being re-learned by six different people.' },
        { sel: '[data-tour="member-verify"]', place: 'left',
          title: 'The assurance ladder, on the record', body: 'Three rungs, derived from events — never typed. <b>1. ID inspected</b> by a human. <b>2. Phone confirmed</b> by SMS, badged <i>delivery only</i>. <b>3. Delivery unlocked</b>, automatically, the moment rung two lands.',
          act: 'Cleared in store but not for delivery? This card is where you resend the SMS.' },
        { sel: '[data-tour="addr-book"]', place: 'top',
          title: 'ID address vs delivery addresses', body: 'The <b>ID address</b> above is the compliance record — read from the scanned document, never edited by staff, never used for routing. <b>Delivery addresses</b> are a separate list the customer owns, and there can be as many as they like.' },
        { title: 'Each address is zone-checked on its own', ey: 'Concept',
          body: 'A customer can legitimately have one address we serve and another we do not. Each is tagged <b>In zone</b>, <b>Buffer</b> (outside the polygon, inside the ring — accepted) or <b>Not served</b>. The ZIP resolves to a region, that region’s on-shift driver decides what can be sold to it, and an unserved ZIP blocks checkout <b>for that address only</b>.' },
        { title: 'Order history opens the whole order', ey: 'Members',
          body: 'Clicking any order in the history shows the real thing — line items, promo, the tax breakdown, tender and who served it — not a summary that forces a second trip into Orders.',
          act: 'Tax is always local → state excise → state sales, in that order, on every screen.' },
        { text: 'Showing', place: 'bottom',
          before: function () { var t = T(); var b = t && t.byText('Back to members'); b && b.click(); }, wait: 1000,
          title: 'The KPI rail carries a period', body: 'Active members, loyalty redeemed, new members and VIP count all move together across <b>7 days / 30 days / quarter / YTD</b>. A “loyalty redeemed” figure means nothing without the window it covers, so the window is always stated next to it.' },

        // ── Tools that live everywhere ────────────────────────────────────
        { sel: '[data-tour="price-check"]', place: 'bottom',
          title: 'Price check, from any screen', body: 'A budtender holding a jar needs a price without abandoning whatever they were doing. Scan a barcode or type a name, brand or SKU and get price, on-hand, THC, per-gram and any sale delta.',
          act: 'Works from every screen — F2 or ⌘K, no matter what is open.' },
        { title: 'Shelf price is pre-tax', ey: 'Concept',
          body: 'What price check shows is the shelf price. The register adds local cannabis tax, state excise and state sales tax at checkout — so quoting this number to a customer is quoting the pre-tax figure. The panel says so, every time.' },

        // ── Adding a product ──────────────────────────────────────────────
        { text: 'Add Product', tag: 'button', place: 'bottom',
          before: go('Catalog', { tag: 'button', scope: 'aside' }), wait: 1000,
          title: 'There is exactly one way to add a product', body: 'Whether you start here or in the product shell module, the same flow opens. One path means one set of rules — and no way to create a product that quietly skips the shell.' },        { title: 'A product is a variation of a shell', ey: 'Critical',
          body: 'A <b>shell</b> is a format — “Alpine · All-In-One Vape 1g”. A <b>product</b> is one flavour hanging off it, and a single shell can carry fifty. A shell name never contains a flavour, which is why the flow asks you to pick the shell before naming anything.' },
        { title: 'Who owns which field', ey: 'Concept',
          body: '<b>Shell:</b> brand, format, <b>retail price</b>, category, unit, net weight, pack, kit box, meta — shared by every flavour. <b>Variation:</b> the flavour name and SKU, plus an optional price override. <b>Batch:</b> quantity, wholesale cost, barcode / RFID, potency and expiry. Nothing is entered twice.' },
        { title: 'Get the SKU right the first time', ey: 'Critical',
          body: 'A variation’s SKU becomes <code>external_id</code> — the key Weedmaps recognises that product by. Changing it later makes WM treat it as brand new and discard the mapping. The shell’s Weedmaps node is already mapped, so a new variation syncs without joining the review queue.' },
        { title: 'Stock is never typed — it is received', ey: 'Concept',
          body: 'There is no “quantity” or “wholesale cost” field on a product. Both live on a <b>batch</b>, because different batches of the same flavour genuinely cost different amounts and carry different potency. Barcode and RFID are per batch too — each batch is physically labelled.' },
        { title: 'THC follows the same rule', ey: 'Concept',
          body: 'It is <b>typed in per batch, from the batch label on the packaging</b> — not parsed out of a COA. Whoever receives the stock reads the printed THC, CBD and total cannabinoids and enters them. The product page then shows low / high / avg rolled up across every in-stock batch, which is why those fields are read-only there.' },
        { title: 'Identity fields are locked on purpose', ey: 'Concept',
          body: 'On a product page, brand and format show <b>Edit in shell</b> rather than an input. Editing them from one store’s catalog row would let two stores disagree about what the same jar is — so the edit happens once, on the shell, and every variation in every store follows.' },
      ],
    },

    // ══════════════════════════════════════════════ Terminal config ════════
    'POS Terminal Configuration.html': {
      name: 'Terminals walkthrough',
      steps: [
        { title: 'Card readers are physical objects', ey: 'Start',
          body: 'This module tracks which reader is where, who is using it, and which need attention. It exists because a reader assigned wrong is a sale that cannot be taken.' },
        { text: 'Stations', up: 2, place: 'bottom',
          title: 'Station terminals', body: 'Fixed positions in the store. A station has a device, a cashier signed in, a card reader and a <b>cash drawer session</b> with an expected balance.' },
        { text: 'Mobile terminals', up: 2, place: 'bottom',
          title: 'Region terminals', body: 'These live in vans. <b>One driver, one region, one static reader.</b> The reader belongs to the region — not the person.' },
        { title: 'Why readers never travel with people', ey: 'Concept',
          body: 'Reconciliation follows the <b>region</b>. If readers moved with drivers, a single covered shift would scatter card settlements across serial numbers and nothing would tie back to a service area. When someone covers a call-off, reassign the driver — leave the hardware alone.' },
        { text: 'Readers to assign', up: 2, place: 'bottom',
          title: 'Unassigned readers', body: 'A region with no reader cannot take card at the door. This number should be zero for every region that has someone on shift.' },
        { text: 'Needs attention', up: 2, place: 'bottom',
          title: 'The attention list', body: 'Offline during a shift, unassigned readers, drawers left open, unexplained variance. Work this list down daily — each one is a real transaction risk, not a badge.' },
        { title: 'Drawer variance', ey: 'Concept',
          body: 'Counted minus expected. Anything non-zero must be <b>explained</b> before close, every time. Recurring small variance on one station is usually a miscount routine, not a person — and the note is the only thing that lets anyone tell the difference later.' },
        { title: 'Now the cash lifecycle', ey: 'Cash',
          body: 'Every terminal that touches cash runs an explicit session. Stations <b>open a drawer</b>; drivers are <b>issued a cash bag</b>. Both close the same way: count → confirm destination → sealed receipt. Nothing ever just "closes".',
          act: 'The next few steps open a real terminal and walk the whole flow.' },
        { text: 'Temecula', up: 3, place: 'bottom', pad: 4,
          before: function () { var t = window.HWTour, e = t.byText('Temecula'); if (!e) return; var n = e; for (var k = 0; k < 4 && n; k++) { if (n.style && n.style.display === 'grid') break; n = n.parentElement; } n && n.click(); }, wait: 600,
          title: 'Open any terminal', body: 'Clicking a row opens the terminal drawer on the right — device binding, reader, cash position and the activity log, all in one place.' },
        { text: 'Edit', up: 1, place: 'left', tag: 'button',
          title: 'Where a session gets started', body: 'The driver normally does this themselves — they tap <b>Start shift</b> in the Driver App at clock-on and the bag is issued against their region. This button is the manual override for when you hand them the bag over the counter. Stations show <b>Open drawer</b> here instead.',
          act: 'The line underneath always tells you whether a session is currently open.' },
        { title: 'Issuing: who, how much, verified?', ey: 'Cash',
          body: 'Three steps — pick the person and the <b>starting cash balance</b>, optionally <b>count it by denomination</b> before handing it over, then open. Skipping the count records it as issued on trust, and any discrepancy surfaces later as a variance against that starting balance.',
          act: 'We call it the starting cash balance, not a “float” — same thing, plainer name.' },
        { text: 'Deposit bag', place: 'left',
          title: 'Closing it out', body: 'At end of shift this becomes <b>Deposit bag</b> (or <b>Close drawer</b> for a station). It opens the three-stage close-out.' },
        { title: 'Stage 1 — count', ey: 'Cash',
          body: 'Count by denomination or enter a quick total. The panel shows expected cash, card settled separately, and the transaction mix. It then tells you <b>exactly which bills and coins to leave</b> as the starting cash balance — the remainder is your deposit.' },
        { title: 'Stage 2 — confirm', ey: 'Cash',
          body: 'Where the money is going (<b>safe drop</b>, <b>armored pickup</b>, or <b>manager hand-off</b>), the sealed bag number, and who accepted it. If the count is off, a <b>variance reason is required</b> — you cannot confirm without one.' },
        { title: 'Stage 3 — what "Confirm deposit" actually does', ey: 'Cash',
          body: 'It issues a <b>deposit id</b>, seals the bag against it, records the second signature, and posts the whole thing to the activity log. You get a receipt with a status timeline: counted &amp; sealed → accepted → dropped → reconciled to the bank feed. The session closes and the starting cash balance carries to the next person.' },
        { title: 'The activity log is inline', ey: 'Cash',
          body: 'Scroll the terminal drawer and every deposit, sign-in, reader heartbeat and clock-on is listed in place — no clicking out to a separate screen. The deposit you just confirmed appears at the top with its bag number, who accepted it and the variance.' },
        { title: 'Variance is never zero by default', ey: 'Cash',
          body: 'Before you count anything the panel reads <b>not counted</b> — not a huge shortage. Variance only appears once real denominations are entered, so the number on screen always means something.' },
        { title: 'Spares exist so this is fast', ey: 'Done',
          body: 'When a reader dies mid-shift, assign one from the pool and log the dead serial out of the fleet. Thirty seconds, not a day of declined cards.' },
      ],
    },

    // ═══════════════════════════════════════════════════════ Delivery ══════
    'Hyperwolf Delivery.html': {
      name: 'Delivery walkthrough',
      steps: [
        { title: 'This is the map of the business', ey: 'Start',
          body: 'Where we deliver, under what rules, and who covers it. Every routing decision anywhere else — including on Weedmaps — resolves against what is configured here.' },
        { title: 'Four levels, each inheriting down', ey: 'Concept',
          body: '<b>County</b> → <b>sub-region</b> → <b>KML zone</b> → <b>driver</b>. Counties hold the central settings: open and close times, order minimum, delivery fee and buffer. Sub-regions inherit them and carry only the fields they deliberately override.' },
        { title: 'Why inheritance instead of per-region settings',
          body: 'Policy changes are county-wide in practice. When LA extends to 11pm you change one number and every sub-region follows. Overrides then mean something real — a deliberate exception someone chose, not configuration drift.' },
        { title: 'The KML zones', ey: 'Concept',
          body: 'Each sub-region has a drawn polygon plus a dashed <b>buffer</b> ring — extra distance beyond the boundary we will still accept. Use the buffer for edge addresses rather than redrawing a zone.' },
        { text: 'Schedule', place: 'bottom',
          title: 'The roster', body: 'Synced from ConnecTeam. Who covers which region, on which day, at what hours. This is the input to every availability decision in the system.' },
        { title: 'A call-off is an outage, not paperwork', ey: 'Critical',
          body: 'A region with no on-shift driver cannot fulfil delivery. Its kit drops out of the buyable set, its zips stop routing, and Weedmaps stops offering delivery to those addresses <b>within about a second</b>.',
          act: 'Cover an open call-off immediately — you are restoring service.' },
        { title: 'Region → driver → kit', ey: 'Concept',
          body: 'A zip belongs to one region. A region has a driver pool. An on-shift driver has a <b>kit</b> — the SKUs physically in their van. That chain decides what a customer at a given address is even shown. It is the single most important mechanic in the platform.' },
        { title: 'Where this shows up next', ey: 'Done',
          body: 'Open <b>Logistics</b> to see today running live on this map, or <b>Promotions → Weedmaps</b> to see how these same regions gate what the marketplace can sell.' },
      ],
    },

    // ══════════════════════════════════════════════════════ Logistics ══════
    'Hyperdrive Logistics.html': {
      name: 'Dispatch walkthrough',
      steps: [
        { title: 'Today, live', ey: 'Start',
          body: 'Delivery defines the map; this runs what is happening on it right now. Three views over one shared state — your filters and selection follow you between them.' },
        { text: 'Board', tag: 'button', place: 'bottom',
          title: 'Board — triage', body: 'Orders grouped by status with the alarms on top: <b>unassigned</b>, <b>SLA at risk</b>, <b>over capacity</b>. Start every session here.' },
        { text: 'Map', tag: 'button', place: 'bottom', before: go('Map', { tag: 'button' }), wait: 500,
          title: 'Map — why something is late', body: 'Driver route paths with direction arrows and numbered stops coloured by risk, over the region zones. Best for balancing load geographically.' },
        { text: 'Lanes', tag: 'button', place: 'bottom', before: go('Lanes', { tag: 'button' }), wait: 500,
          title: 'Lanes — one column per driver', body: 'Stops in run order. Best for reading a single driver\'s day and for moving a stop from one driver to another.' },
        { title: 'Clear alarms in one order', ey: 'Concept',
          body: 'Unassigned first, then SLA risk. They are the only two states where a customer is actively being failed. Everything else can wait.',
          act: 'A driver over capacity makes every stop after the third one late. Rebalance before it becomes six breaches.' },
        { title: 'Scheduled orders are deliberately quiet',
          body: 'Next-day and future-window orders are excluded from today\'s alarms and from live driver ranking — those drivers are not even on shift yet. They auto-assign about thirty minutes before their window opens.' },
        { title: 'Reschedule has three different flows', ey: 'Concept',
          body: '<b>ASAP:</b> give 5 minutes, come back soon, come back later tonight. <b>Scheduled with a driver:</b> soon, later, or another day with a date and window picker. <b>Scheduled with no driver:</b> straight to the window picker — there is no run to protect.' },
        { title: 'Cancelling writes to the customer', ey: 'Critical',
          body: 'Cancel asks for a reason and offers a <b>hot note</b> — a behaviour flag pinned to the top of that customer\'s profile. No-shows, unreachable and hostile doors belong there. It is how the next driver knows before they arrive.' },
        { title: 'The order panel is a full POS',
          body: 'Deliberately. Edit line items, change quantities, apply a promo or referral code, switch payment type — and <b>swap</b> any item for a similar, more potent or cheaper alternative in the same category, with price and THC deltas shown. The person on the phone can fix the actual problem.' },
        { title: 'The activity log is the record', ey: 'Done',
          body: 'Always open, never collapsed. Every assignment, reschedule, edit and status push, in order. If there is ever a dispute about an order, this is what settles it.' },
      ],
    },

    // ═════════════════════════════════════════════════════ Driver app ══════
    'Hyperwolf Driver App.html': {
      name: 'Driver app walkthrough',
      steps: [
        { title: 'What the driver actually holds', ey: 'Start',
          body: 'The last mile of every delivery order, and the only place the physical world gets recorded — what was handed over, what was collected, and what did not match.' },
        { title: 'Shift starts with the kit', ey: 'Critical',
          body: 'Clock on, confirm the region, confirm the <b>kit</b> — the SKUs physically in the van. The kit is what makes a driver sellable. An unconfirmed kit means that region cannot take delivery orders at all.' },
        { title: 'One kit, one cart', ey: 'Concept',
          body: 'A cart may only contain items from a <b>single driver\'s</b> kit. Not the store\'s stock, not everyone on shift combined — one van, because one van goes to one door. This one rule explains nearly all of the availability logic elsewhere in the platform.' },
        { title: 'ID again at the door', ey: 'Critical',
          body: 'Remote verification is what allows the order to be <b>created</b>. Physical ID at the door is what allows <b>handover</b>. They are two different checkpoints and the second is never optional.' },
        { title: 'Adjust at the door, then take payment',
          body: 'Shop and checkout let the driver fix the order in person — swap something out, add something they are carrying — then tender on the region\'s card reader or in cash. Tips are captured on completion.' },
        { title: 'Discrepancies get filed, not discussed', ey: 'Done',
          body: 'Short counts, damage, refused delivery — all filed in the app so they reconcile against the kit at end of shift. A verbal "it was one short" reconciles against nothing.' },
      ],
    },

    // ══════════════════════════════════════════════════════ Promotions ═════
    'Promotions Suite.html': {
      name: 'Promotions & Weedmaps',
      steps: [
        { title: 'Build a promo once', ey: 'Start',
          body: 'It lands on the weekly board, the calendar, the Weedmaps channel and the creative studio. The suite exists because promotions used to be re-entered per surface — which is exactly how two conflicting discounts end up live on the same product.' },
        { text: 'New promotion', place: 'bottom',
          title: 'The rule engine', body: 'IF/THEN conditions in three editing styles — a plain-English sentence, a step wizard, or raw blocks — all writing the same underlying rule.' },
        { title: 'The fields that decide whether it fires', ey: 'Concept',
          body: '<b>Segment</b> (all / new-customer / first-order), <b>min spend</b> and <b>min items</b>, <b>schedule</b> and dayparts, <b>channel</b> (delivery, pickup or both), and <b>stackable</b> plus priority. When a promo "doesn\'t work", it is nearly always one of these — check them in that order.' },
        { title: 'Stacking is where money leaks', ey: 'Critical',
          body: 'Two stackable promos that both target Flower will both apply. Priority only breaks ties between <b>non-stackable</b> rules. Before you set stackable, check the calendar for anything overlapping the same targets in the same window.' },
        { text: 'Weedmaps', tag: 'button', place: 'bottom', before: go('Weedmaps', { tag: 'button' }), wait: 800,
          title: 'Now the channel', body: 'Weedmaps is a <b>channel, not a platform</b>. It is a place customers find us and build carts — not where our inventory, prices, promotions or customers live. Every integration decision follows from refusing to let it be the source of truth.' },
        { text: 'The two Weedmaps listings', up: 3, place: 'left',
          title: 'Two listings, two rule sets', body: '<b>Pickup</b> sells store on-hand stock, collected in store, no driver. <b>Delivery</b> sells the union of on-shift driver kits, zip-routed to a region. Same catalog underneath — mapping them the same way is the classic mistake.' },
        { text: 'How a Weedmaps order reaches a driver', up: 3, place: 'bottom',
          title: 'The five-second window', body: 'At checkout, Weedmaps posts us the cart and <b>waits about five seconds</b>. Whatever we return becomes the cart the customer actually buys. That is our one chance to make the order fulfillable.' },
        { title: 'What we do inside that window', ey: 'Concept',
          body: 'Four things, in roughly 200ms: <b>route it</b> (zip → region, or → the store), <b>drop what no single on-shift driver carries</b>, <b>reprice</b> with our real pricing and promos, and <b>place soft holds</b> so two carts cannot claim the last unit.',
          act: 'Miss the window and Weedmaps proceeds with its own cart — one we may not be able to fulfil.' },
        { text: 'Regions → drivers → Weedmaps listing', up: 3, place: 'right',
          title: 'Region → driver → kit, live', body: 'This table is the routing chain in the flesh. Zips belong to a region, the region has drivers, and only the <b>on-shift</b> ones contribute their kit. Off-shift and that kit leaves the buyable set in about a second.' },
        { title: 'Why the listing shows more than any cart can hold',
          body: 'The Delivery listing shows the <b>union</b> of every on-shift kit, so customers see the real breadth on the road. At checkout a specific address resolves to a specific driver, so some of it disappears — with a reason, almost always "no on-shift driver in this region carries it".' },
        { text: 'What runs itself', up: 3, place: 'top',
          title: 'What is automatic, and what is not', body: 'Product mapping, identity merging, order routing and promo pushing all run unattended. Humans are pulled in for exactly four things: low-confidence product matches, ambiguous identity merges, no-coverage alerts, and promo overlaps.' },
        { text: 'Every Weedmaps promotion', up: 3, place: 'top',
          title: 'Promotions sync both ways', body: 'Products flow one way — we own them. Promotions do not: Weedmaps runs its own promo machinery, so we <b>push</b> ours out and <b>pull</b> theirs back every 60 seconds. Every row here is <b>mapped</b>, <b>standalone</b> or <b>unmapped</b>.',
          act: 'Unmapped means it is discounting margin with nothing on our side controlling or measuring it.' },
        { title: 'Overlap is the one to watch', ey: 'Critical',
          body: 'An unmapped Weedmaps promo hitting the same products as one of ours can stack with it — two discounts on one item that nobody approved together. Resolve overlaps the day they appear: link, merge, or end it.' },
        { title: 'Products, customers, promos — the pattern', ey: 'Done',
          body: '<b>Products</b> push out (we own them). <b>Customers</b> flow in (we take signals, send back only a verdict). <b>Promotions</b> go both ways (two sources, reconciled). For the raw contracts, endpoints and payloads, open the <b>Dev Console</b>.' },
      ],
    },

    // ════════════════════════════════════════════════════ Dev console ══════
    'dashboard.html': {
      name: 'Integration console',
      steps: [
        { title: 'The developer surface', ey: 'Start',
          body: 'Everything the other apps do smoothly, this exposes raw: payloads, calls, the mapping queue and the failure states. When Weedmaps is wrong, you come here.' },
        { text: 'Order Path', place: 'right',
          title: 'One order through the loop', body: 'A live walk-through of a single order. Toggle <b>Delivery</b> vs <b>Pickup</b> to see exactly where the two fulfilment types diverge — kit-gated and driver-routed versus store stock and no routing.' },
        { text: 'Catalog Mapping', place: 'right',
          title: 'The human bottleneck', body: 'A nightly job scores every SKU against WM\'s catalog on name, brand and category. High confidence auto-links; the rest land here for a yes or no.',
          act: 'An unmapped SKU cannot sell on Weedmaps at all. Work this queue daily.' },
        { title: 'external_id is load-bearing', ey: 'Critical',
          body: 'Our stable anchor — <code>hyperwolf:sku:BD-F-35G</code> — is how Weedmaps recognises a product. If it churns, WM treats the item as brand new and <b>discards the product link, the curated brand and the category mapping</b>. Rename anything else; never this.' },
        { text: 'Field & Sync Map', place: 'right',
          title: 'The contract, rendered', body: 'Every parameter we sync, per entity, with direction and automation level. <b>Auto</b> = no human. <b>1-click</b> = the matcher proposes and you confirm. <b>Manual</b> = a person curates it, and overwriting it destroys that curation.' },
        { text: 'Trust & Money', place: 'right',
          title: 'How customers get verified', body: 'Remote orders are fingerprinted on three signals: <b>device</b> (strongest, never leaves us), <b>phone</b> and <b>email</b>. Clean matches merge silently into the ledger; tier resolves to first-timer, returning or blocked.',
          act: 'Clear fraud auto-cancels as CANCELED_SELLER. Ambiguous cases queue here for a human.' },
        { text: 'Inventory & Supply', place: 'right',
          title: 'Stock, lots, kits and holds', body: 'Region stock is the sum of its <b>batch lots</b>, allocated FIFO so advertised THC matches the jar. A Draft places a short-TTL <b>soft hold</b> so concurrent carts cannot oversell — held units read as (−n).' },
        { text: 'Observability', place: 'right',
          title: 'Real-time versus timers', body: 'Writes push in under a second through a <b>coalescing bus</b> — ten edits to one item become one API call. Timers are only a safety net: promo pull every 60s, reconcile sweep every 5 minutes.',
          act: 'If reconcile regularly finds drift, real-time pushes are broken. Fix the pushes.' },
        { text: 'Dev / API', place: 'right',
          title: 'Payloads and the simulator', body: 'The inspector shows the last Draft round-trip literally — what WM sent versus what we returned, green kept and red dropped with a reason. The simulator fires a signed Draft + Create pair at our own webhook so you can reproduce without a real customer.' },
        { title: 'The endpoints worth memorising', ey: 'Reference',
          body: '<code>POST /callbacks/weedmaps/orders</code> for DRAFT and CREATE, inbound and signature-verified. <code>PUT /wm/2025-07/partners/menus/{wmid}/items/external/{external_id}</code> for menu writes. <code>PUT /oos/2026-01/merchants/{wmid}/orders/{id}</code> for status. <code>GET /wm/2025-07/partners/promotions</code> on the 60s pull.' },
        { title: 'Two failure states to never swallow', ey: 'Done',
          body: 'A <b>zip with no region</b> means we are visible to an address we cannot serve. A <b>region with no on-shift driver</b> means an active area with zero capacity. Both must alert — an empty cart looks to the customer like we simply have nothing in stock.' },
      ],
    },

    // ══════════════════════════════════════════════════════════ Hub ════════
    'Hyperwolf.html': {
      name: 'Where to start',
      steps: [
        { title: 'Seven surfaces, one dataset', ey: 'Start',
          body: 'Every app here reads and writes the same products, regions, drivers, customers and promotions. Nothing is a silo — a driver going off-shift in one app changes what a stranger can buy on Weedmaps a second later.' },
        { title: 'Each app has its own walkthrough', ey: 'How this works',
          body: 'Open any app and look for the <b>?</b> button in the bottom-right corner. It runs a guided tour on the live screen, highlighting real controls as it explains them. It starts automatically the first time you open an app.' },
        { title: 'A suggested order', ey: 'Done',
          body: '<b>POS</b> for how a sale works, then <b>Delivery</b> for regions and coverage, then <b>Logistics</b> for live dispatch, then <b>Promotions → Weedmaps</b> for how the channel plugs in. Developers should finish on the <b>Dev Console</b>.' },
      ],
    },
  };
})();
