#!/usr/bin/env node
// Writes contracts/enums.json and contracts/schema/*.json FROM contracts/index.js, so Python
// (wm-demo) reads the same vocabulary the JS exports. test/contracts.test.mjs fails if these
// files and index.js ever disagree — run `node tools/contracts-export.mjs` after editing index.js.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = createRequire(import.meta.url)(join(ROOT, 'contracts', 'index.js'));
const dir = join(ROOT, 'contracts');
const enums = {}; for (const [k, v] of Object.entries(C.ENUMS)) enums[k] = v.values;
writeFileSync(join(dir, 'enums.json'), JSON.stringify({ contract: C.VERSION, header: C.HEADER, http_status: C.HTTP_STATUS, enums }, null, 2) + '\n');
mkdirSync(join(dir, 'schema'), { recursive: true });
for (const f of readdirSync(join(dir, 'schema'))) if (f.endsWith('.json')) unlinkSync(join(dir, 'schema', f));
for (const [name, schema] of Object.entries(C.SCHEMAS)) writeFileSync(join(dir, 'schema', name + '.json'), JSON.stringify({ $id: name, contract: C.VERSION, ...schema }, null, 2) + '\n');
console.log('wrote enums.json (' + Object.keys(enums).length + ' enums) and ' + Object.keys(C.SCHEMAS).length + ' schemas for contract ' + C.VERSION);
