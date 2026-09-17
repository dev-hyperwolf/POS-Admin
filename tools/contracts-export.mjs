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
// rule_field_type + rule_limits (0.5.0): PromotionRule's per-field type table and DoS-guard
// limits, exported the same way http_status already is, so Python reads the same numbers
// instead of a second copy (BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §2.1).
// rule_ops_by_type + pii_class (0.5.0, Team 3b): RULE_OPS_BY_TYPE was JS-only until now (Team 1a's own
// comment said Python re-implements the ops check in code); exporting it costs nothing and lets a second
// reader stay in sync. pii_class is PII_CLASS (docs/migration/MIGRATION-PLAN-2026-09-16.md §4 Track 3).
writeFileSync(join(dir, 'enums.json'), JSON.stringify({ contract: C.VERSION, header: C.HEADER, http_status: C.HTTP_STATUS, rule_field_type: C.RULE_FIELD_TYPE, rule_limits: C.RULE_LIMITS, rule_ops_by_type: C.RULE_OPS_BY_TYPE, pii_class: C.PII_CLASS, enums }, null, 2) + '\n');
mkdirSync(join(dir, 'schema'), { recursive: true });
for (const f of readdirSync(join(dir, 'schema'))) if (f.endsWith('.json')) unlinkSync(join(dir, 'schema', f));
for (const [name, schema] of Object.entries(C.SCHEMAS)) writeFileSync(join(dir, 'schema', name + '.json'), JSON.stringify({ $id: name, contract: C.VERSION, ...schema }, null, 2) + '\n');
console.log('wrote enums.json (' + Object.keys(enums).length + ' enums) and ' + Object.keys(C.SCHEMAS).length + ' schemas for contract ' + C.VERSION);
