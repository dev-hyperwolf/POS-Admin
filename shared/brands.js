// Hyperwolf — THE brand (vendor) database. One list, every surface.
// POS catalog, shells, promotions, the METRC pipeline vendor list, buyer
// analytics and Engage all read from here. There is no second brand list.
//
//   key        short handle used in code (pos/data.jsx product rows)
//   name       the display name — the only string shown in UI
//   category   the vendor's primary category (pipeline vendor list)
//   posCats    POS catalog categories this brand actually supplies
(function () {
  var LIST = [
    { key: 'kiva',      id: 'v-kiva',      name: 'Kiva Confections', category: 'Edibles',     posCats: ['Edibles'] },
    { key: 'stiiizy',   id: 'v-stiiizy',   name: 'STIIIZY',          category: 'Vape',        posCats: ['Vapes'] },
    { key: 'jeeter',    id: 'v-jeeter',    name: 'Jeeter',           category: 'Pre-roll',    posCats: ['Pre-Rolls'] },
    { key: 'lowell',    id: 'v-lowell',    name: 'Lowell Farms',     category: 'Flower',      posCats: ['Flower'] },
    { key: 'raw',       id: 'v-raw',       name: 'Raw Garden',       category: 'Concentrate', posCats: ['Concentrates'] },
    { key: 'papa',      id: 'v-papa',      name: 'Papa & Barkley',   category: 'Topical',     posCats: ['Wellness'] },
    { key: 'cann',      id: 'v-cann',      name: 'Cann',             category: 'Beverage',    posCats: ['Wellness'] },
    { key: 'heavy',     id: 'v-heavy',     name: 'Heavy Hitters',    category: 'Vape',        posCats: ['Vapes'] },
    { key: 'wyld',      id: 'v-wyld',      name: 'Wyld',             category: 'Edibles',     posCats: ['Edibles'] },
    { key: 'connected', id: 'v-connected', name: 'Connected',        category: 'Flower',      posCats: ['Flower'] },
    { key: 'select',    id: 'v-select',    name: 'Select',           category: 'Vape',        posCats: ['Vapes'] },
    { key: 'pax',       id: 'v-pax',       name: 'Pax Labs',         category: 'Hardware',    posCats: ['Accessories'] },
    { key: 'camino',    id: 'v-camino',    name: 'Camino',           category: 'Edibles',     posCats: ['Edibles'] },
    { key: 'alien',     id: 'v-alien',     name: 'Alien Labs',       category: 'Flower',      posCats: ['Flower'] },
    { key: 'labs710',   id: 'v-710',       name: '710 Labs',         category: 'Concentrate', posCats: ['Concentrates'] },
    { key: 'cookies',   id: 'v-cookies',   name: 'Cookies',          category: 'Flower',      posCats: ['Flower','Pre-Rolls'] }
  ];
  var name = {}, byId = {}, byName = {};
  LIST.forEach(function (b) { name[b.key] = b.name; byId[b.id] = b; byName[b.name] = b; });
  window.HW_BRANDS = {
    list: LIST,
    name: name,                                   // HW_BRANDS.name.kiva → 'Kiva Confections'
    names: LIST.map(function (b) { return b.name; }),
    byId: byId,
    byName: byName,
    forCategory: function (cat) { return LIST.filter(function (b) { return b.posCats.indexOf(cat) > -1; }); }
  };
})();
