// Shared test scaffolding: loads fixtures/*.json and joins them the way a real caller would
// (Location.box_type -> box-templates.json, exactly how distribution-backend joins
// KitDistributed.regionData[].items through Boxes -> KitTemplateSku). Not a test file itself
// (no *.test.mjs suffix), so node --test does not try to run it directly.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, '..', 'fixtures');
const require = createRequire(import.meta.url);

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'));
}

export function loadFixtures() {
  const products = loadJson('products.json');
  const locations = loadJson('locations.json');
  const templates = loadJson('box-templates.json');
  const batches = loadJson('batches.json');
  const sales = loadJson('sales.json');
  const receiving = loadJson('receiving.json');
  return { products, locations, templates, batches, sales, receiving };
}

/** Every kit_box location of the given box_type, each wired up with its template and an
 *  (optional) existing_batches map the caller can layer on for a specific scenario. */
export function kitDestinations(fixtures, boxType, existingByLocation = {}) {
  const template = fixtures.templates.kit_templates[boxType];
  if (!template) throw new Error(`no kit_templates entry for box_type ${boxType}`);
  return fixtures.locations.locations
    .filter((l) => l.kind === 'kit_box' && l.box_type === boxType)
    .map((l) => ({
      id: l.id,
      name: l.name,
      template,
      existing_batches: existingByLocation[l.id] || {},
    }));
}

export function shelfDestinations(fixtures, shelfType, existingByLocation = {}) {
  const template = fixtures.templates.shelf_templates[shelfType];
  if (!template) throw new Error(`no shelf_templates entry for shelf_type ${shelfType}`);
  return fixtures.locations.locations
    .filter((l) => l.kind === 'shelf' && l.shelf_type === shelfType)
    .map((l) => ({
      id: l.id,
      name: l.name,
      template,
      existing_batches: existingByLocation[l.id] || {},
    }));
}

export function batchesAt(fixtures, locationId) {
  return fixtures.batches.batches.filter((b) => b.location_id === locationId);
}

export function contractsValidate() {
  // contracts/index.js is CommonJS (its own package.json has no "type": "module"); require()
  // (via createRequire) gets module.exports directly, sidestepping ESM/CJS named-export
  // detection on a UMD file that assigns `module.exports = factory()`.
  const contracts = require('../../contracts/index.js');
  return contracts.validate;
}
