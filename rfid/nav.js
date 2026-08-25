// RFID's one line in the shared nav list.
//
// In the real repo this is a single item added to `shared/app-nav.js` between
// `batches` and `promos` — it lives here only because this module must not edit
// an existing file. Position is the argument, not an accident: Catalog →
// Batches → RFID is the physical-goods run of the rail, and an operator moving
// from "batch approved for sale" to "tag it, pack it, verify the kit" travels
// one item down. Everything below RFID (Promos, Swap & Upsell, Merch) is
// commerce, and belongs after the goods exist.
(function () {
  if (!window.HW_NAV) return;
  var ITEM = { id: 'rfid', label: 'RFID', icon: 'scan', href: 'rfid/index.html' };
  var items = window.HW_NAV.items;
  if (items.some(function (i) { return i.id === 'rfid'; })) return;
  var at = items.findIndex(function (i) { return i.id === 'batches'; });
  items.splice(at < 0 ? items.length : at + 1, 0, ITEM);
  window.HW_NAV.all = items.concat([window.HW_NAV.settings]);
})();
