/* A minimal fake wm-demo shells backend for tests that drive pos/shell-store.jsx
 * through window.HW_LIVE (shared/hw-live.js) — the same GET/POST seam the real
 * server answers (docs/SHELLS-PLAN-2026-09-09.md §3). ui-harness.mjs stubs
 * `window.fetch` to a 503 unless `opts.fetch` is given; this is that override.
 *
 * Intentionally tiny: one brand, one format, one shell, two products. Enough
 * to drive the flows without re-implementing the real server's naming engine —
 * `deriveName()` below only understands `{name}` and drops every other slot
 * token, which is sufficient for a Gummies-style template ('{name} Gummies').
 */
export function makeShellsFixture() {
  const FORMAT = {
    id: 'fmt-gummies', name: 'Gummies 100mg 10pk', category: 'Edibles', subcategory: 'Gummies',
    template: '{name} Gummies', default_weight: 100, default_unit: 'mg', default_pack: 10,
    wm_node: 'Edibles › Gummies', kit_box: 'Edible Box', sort: 1, active: 1
  };
  const SHELL = {
    id: 'SH-0001', brand_key: 'kiva', brand_name: 'Kiva Confections', format_id: FORMAT.id,
    weight: 100, unit: 'mg', pack: 10, kit_box: 'Edible Box', wm_node: FORMAT.wm_node,
    name: 'Kiva Confections · Gummies 100mg 10pk', active: 1
  };
  const PRODUCTS = [
    { sku: 'KIVA-100-WM', name: 'Watermelon Gummies', name_derived: 'Watermelon Gummies', name_override: null,
      variation: { name: 'Watermelon' }, price: 18, inventory: 24, sample: false },
    { sku: 'KIVA-100-MG', name: 'Mango Gummies', name_derived: 'Mango Gummies', name_override: null,
      variation: { name: 'Mango' }, price: 18, inventory: 9, sample: true }
  ];
  const created = [];

  function deriveName(template, slots) {
    const name = (slots && slots.name || '').trim();
    if (!name) return { name: '', warnings: ['missing name'] };
    return { name: template.replace('{name}', name).replace(/\s+/g, ' ').trim(), warnings: [] };
  }

  function json(body, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300, status, statusText: '', url: '',
      json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body))
    });
  }

  const shellsFor = () => [{
    id: SHELL.id, brand_key: SHELL.brand_key, brand_name: SHELL.brand_name, format_id: SHELL.format_id,
    weight: SHELL.weight, unit: SHELL.unit, pack: SHELL.pack, kit_box: SHELL.kit_box, wm_node: SHELL.wm_node,
    name: SHELL.name, active: 1, product_count: PRODUCTS.length + created.length,
    sample_names: [...PRODUCTS, ...created].slice(0, 3).map((p) => p.name)
  }];

  function fetch(url, options) {
    const u = String(url);
    const method = (options && options.method) || 'GET';
    const path = u.replace(/^https?:\/\/[^/]+/, '');

    if (method === 'GET' && /^\/api\/shells\/formats/.test(path)) {
      return json({ formats: [FORMAT], counts: { [FORMAT.id]: { shells: 1, products: PRODUCTS.length + created.length } } });
    }
    if (method === 'GET' && /^\/api\/shells\/SH-0001$/.test(path)) {
      return json({ shell: SHELL, format: FORMAT, products: [...PRODUCTS, ...created] });
    }
    if (method === 'GET' && /^\/api\/shells(\?.*)?$/.test(path)) {
      return json({ shells: shellsFor() });
    }
    if (method === 'POST' && /^\/api\/shells\/name\/preview$/.test(path)) {
      const body = JSON.parse(options.body || '{}');
      const fmt = body.format_id === FORMAT.id ? FORMAT : null;
      if (!fmt) return json({ error: 'unknown_format' }, 400);
      return json(deriveName(fmt.template, body.slots));
    }
    if (method === 'POST' && /^\/api\/shells\/SH-0001\/variations$/.test(path)) {
      const body = JSON.parse(options.body || '{}');
      const d = deriveName(FORMAT.template, body.slots);
      if (!d.name) return json({ error: 'invalid_slots', warnings: d.warnings }, 400);
      const sku = body.sku || ('KIVA-100-' + d.name.slice(0, 2).toUpperCase());
      const product = {
        sku, name: d.name, price: body.price || 0, inventory: body.inventory || 0,
        sample: !!body.sample, category: FORMAT.category
      };
      created.push({ sku: product.sku, name: product.name, name_derived: d.name, name_override: null,
        variation: body.slots, price: product.price, inventory: product.inventory, sample: product.sample });
      return json({ product, name_derived: d.name, warnings: d.warnings });
    }
    if (method === 'GET' && /^\/api\/product\//.test(path)) {
      const sku = decodeURIComponent(path.split('/').pop());
      const p = [...PRODUCTS, ...created].find((x) => x.sku === sku);
      return p ? json({ sku: p.sku, name: p.name, sample: p.sample, price: p.price, inventory: p.inventory })
               : json({ error: 'not_found' }, 404);
    }
    // Everything else (the order/fulfilment board, other live seams booted by
    // the 'pos' harness) — same honest "no live answer" shape ui-harness.mjs's
    // own default stub uses.
    return json(null, 503);
  }

  return { fetch, FORMAT, SHELL, PRODUCTS, created };
}
