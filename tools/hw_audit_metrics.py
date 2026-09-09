#!/usr/bin/env python3
"""Mechanical, repeatable per-repo metrics for the Hyper-Tech codebase audit.

Usage:  python3 hw_audit_metrics.py <root-with-repos> <out-dir> [repo ...]
Writes <out-dir>/<repo>.json + <repo>.md per repo and CROSS-REPO-DUPLICATES.md.
Every number here is measured from tracked files at HEAD. Secret hits report
file:line and the pattern name ONLY - values are never written anywhere.
Stdlib only (Python 3.9).
"""
import sys, os, re, json, hashlib, subprocess, collections, difflib, datetime

SRC_EXT = ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')
SKIP_DIRS = re.compile(r'(^|/)(node_modules|\.next|dist|build|coverage|public/static|vendor)(/|$)')
MIN_FILE_LINES = 200  # only files this long count as vendored/generated candidates

PATTERNS = {
  'hardcoded': {
    'http_url': r'https?://[^\s\'"`)]+',
    'localhost': r'\blocalhost\b|127\.0\.0\.1',
    'mongo_uri': r'mongodb(\+srv)?://',
    'ip_literal': r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
    'objectid_24hex': r'[\'"][0-9a-f]{24}[\'"]',
    'role_string': r'[\'"](super_?admin|superAdmin|admin|manager|driver|retailer|customer|user|vendor|dispatcher|budtender)[\'"]',
    's3_bucket': r'\.s3\.[a-z0-9-]+\.amazonaws\.com|s3://[a-z0-9.-]+',
    'email_literal': r'[\'"][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}[\'"]',
    'phone_literal': r'[\'"]\+?1?\d{10,11}[\'"]',
    'store_name_literal': r'[\'"](Corona|Lake Elsinore|West Hollywood|Long Beach|Elsinore|WeHo|Hollywood)[\'"]',
  },
  'secrets': {
    'aws_access_key': r'AKIA[0-9A-Z]{16}',
    'private_key_block': r'-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----',
    'stripe_live': r'sk_live_[0-9a-zA-Z]{10,}',
    'stripe_test': r'sk_test_[0-9a-zA-Z]{10,}',
    'google_api_key': r'AIza[0-9A-Za-z_\-]{35}',
    'slack_token': r'xox[bpa]-[0-9A-Za-z-]{10,}',
    'github_token': r'gh[pousr]_[0-9A-Za-z]{30,}',
    'twilio_sid': r'\bAC[0-9a-f]{32}\b',
    'sendgrid_key': r'SG\.[0-9A-Za-z_\-]{20,}\.[0-9A-Za-z_\-]{20,}',
    'jwt_literal': r'eyJ[0-9A-Za-z_\-]{10,}\.eyJ[0-9A-Za-z_\-]{10,}\.[0-9A-Za-z_\-]{10,}',
    'assigned_secret': r'(?i)\b(api_?key|apikey|secret|secret_?key|password|passwd|auth_?token|access_?token|private_?key)\b\s*[:=]\s*[\'"][^\'"\s]{12,}[\'"]',
    'mongo_uri_with_creds': r'mongodb(\+srv)?://[^:/\s]+:[^@/\s]+@',
  },
  'security': {
    'cors_wildcard': r'cors\(\s*\)|origin\s*:\s*[\'"]\*[\'"]|Access-Control-Allow-Origin[\'"]?\s*,\s*[\'"]\*',
    'eval_or_function': r'\beval\(|new Function\(',
    'child_process': r'child_process|execSync\(|\bexec\(',
    'mongo_where': r'\$where',
    'mass_assign_create': r'\.create\(\s*req\.body\s*\)|new\s+\w+\(\s*req\.body\s*\)',
    'mass_assign_update': r'(findByIdAndUpdate|findOneAndUpdate|updateOne|updateMany)\([^;]*req\.body',
    'unfiltered_find': r'\.find\(\s*\)|\.find\(\s*\{\s*\}\s*\)',
    'weak_hash': r'createHash\([\'"](md5|sha1)[\'"]\)',
    'math_random_token': r'Math\.random\(\)[^\n]{0,60}(token|otp|code|password|secret)|(token|otp|code|password|secret)[^\n]{0,60}Math\.random\(\)',
    'jwt_no_expiry_hint': r'jwt\.sign\([^;]*\)',
    'dangerously_set_html': r'dangerouslySetInnerHTML',
    'sql_concat': r'(query|execute|raw)\(\s*[`\'"][^`\'"]*\$\{|[\'"]\s*\+\s*req\.(body|query|params)',
    'disable_tls_verify': r'rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED',
    'req_query_in_regex': r'new RegExp\([^)]*req\.(body|query|params)',
  },
  'performance': {
    'sync_fs': r'\b(readFileSync|writeFileSync|existsSync|readdirSync|execSync)\(',
    'await_in_loop_hint': r'for\s*\(.*\)\s*\{[^}]{0,200}await\s+\w+\.(find|findOne|findById|save|create|update|aggregate|populate)\(',
    'foreach_async': r'\.forEach\(\s*async',
    'find_without_limit': r'\.find\([^;\n]*\)(?![^;\n]*\.limit\()',
    'populate_calls': r'\.populate\(',
    'aggregate_calls': r'\.aggregate\(',
    'settimeout_in_handler': r'setTimeout\(',
  },
  'quality': {
    'console_log': r'console\.(log|debug|info)\(',
    'todo_fixme': r'\b(TODO|FIXME|HACK|XXX)\b',
    'empty_catch': r'catch\s*\([^)]*\)\s*\{\s*\}',
    'commented_code_hint': r'^\s*//\s*(const|let|var|if|for|return|await|function|\w+\()',
    'any_type': r':\s*any\b',
    'ts_ignore': r'@ts-ignore|@ts-nocheck|eslint-disable',
  },
}
ROUTE_RE = re.compile(r'\b(?:router|app|route)\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(\s*([\'"`][^\'"`]*[\'"`])((?:\s*,\s*[A-Za-z_$][\w$.]*(?:\([^)]*\))?)*)')
MONGOOSE_MODEL_RE = re.compile(r'\.model\s*\(\s*[\'"]([A-Za-z0-9_]+)[\'"]')
SCHEMA_FIELD_RE = re.compile(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(\{|\[|String|Number|Boolean|Date|ObjectId|Schema\.Types|mongoose\.Schema)', re.M)
ENUM_RE = re.compile(r'enum\s*:\s*\[([^\]]{0,400})\]')
SEQUELIZE_DEFINE_RE = re.compile(r'sequelize\.define\s*\(\s*[\'"]([A-Za-z0-9_]+)[\'"]')
FUNC_NAME_RE = re.compile(r'(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|exports\.([A-Za-z_$][\w$]*)\s*=)')
IMPORT_RE = re.compile(r'(?:require\(\s*[\'"]([^\'"./][^\'"]*)[\'"]\s*\)|from\s+[\'"]([^\'"./][^\'"]*)[\'"])')

def sh(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True).stdout

def tracked(repo):
    return [f for f in sh(['git', 'ls-files'], repo).splitlines() if f]

def read(path):
    try:
        with open(path, 'rb') as fh:
            return fh.read().decode('utf-8', 'replace')
    except Exception:
        return ''

def pin_class(spec):
    if not isinstance(spec, str): return 'other'
    s = spec.strip()
    if s in ('*', 'latest', ''): return 'unpinned'
    if s.startswith('^'): return 'caret'
    if s.startswith('~'): return 'tilde'
    if re.match(r'^\d', s): return 'exact'
    if s.startswith(('git', 'http', 'file:', 'workspace')): return 'url'
    return 'range'

def eol_notes(deps, engines):
    n = []
    def v(k):
        s = deps.get(k)
        return re.sub(r'[^\d.]', '', s.split()[0]) if isinstance(s, str) else None
    m = lambda k: (v(k) or '').split('.')[0]
    if m('mongoose') == '5': n.append('mongoose 5.x (EOL; 8.x current)')
    if m('express') == '4': n.append('express 4.x (5.x current)')
    if m('axios') == '0': n.append('axios 0.x (1.x current; 0.21 has CVEs)')
    if m('jsonwebtoken') in ('8', '7'): n.append('jsonwebtoken <9 (CVE-2022-23529 family)')
    if m('next') and int(m('next') or 0) < 15: n.append('next %s (15/16 current)' % v('next'))
    if m('react') and int(m('react') or 0) < 19: n.append('react %s' % v('react'))
    if 'react-scripts' in deps: n.append('create-react-app (react-scripts; unmaintained since 2023)')
    if m('node-fetch') == '2': n.append('node-fetch 2.x')
    if m('sequelize') and m('mongoose'): n.append('BOTH sequelize and mongoose in one service')
    e = (engines or {}).get('node') if isinstance(engines, dict) else None
    if e and re.search(r'\b(12|14|16)\b', e): n.append('engines.node = %s (EOL Node)' % e)
    if not e: n.append('no engines.node')
    return n

def scan_repo(root, name):
    repo = os.path.join(root, name)
    sha = sh(['git', 'rev-parse', '--short', 'HEAD'], repo).strip()
    files = tracked(repo)
    src = [f for f in files if f.endswith(SRC_EXT) and not SKIP_DIRS.search(f)]
    by_ext = collections.Counter(os.path.splitext(f)[1] or '(none)' for f in files)
    contents = {f: read(os.path.join(repo, f)) for f in src}
    lines = {f: c.count('\n') + 1 for f, c in contents.items()}
    total_lines = sum(lines.values())
    biggest = sorted(lines.items(), key=lambda x: -x[1])[:12]

    pkg = {}
    pj = os.path.join(repo, 'package.json')
    if os.path.exists(pj):
        try: pkg = json.load(open(pj))
        except Exception as e: pkg = {'_error': str(e)}
    deps = dict(pkg.get('dependencies', {})); dev = dict(pkg.get('devDependencies', {}))
    alld = {**dev, **deps}
    pins = collections.Counter(pin_class(v) for v in alld.values())
    lock = [l for l in ('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml') if l in files]
    fw = {k: alld[k] for k in ('next', 'react', 'react-scripts', 'express', 'mongoose', 'sequelize', 'pg', 'mysql2', 'prisma', '@prisma/client', 'typescript', 'jsonwebtoken', 'axios', 'socket.io', 'node-cron', 'bull', 'bullmq', 'agenda', 'helmet', 'cors', 'express-rate-limit', 'express-validator', 'joi', 'zod', 'yup', 'bcrypt', 'bcryptjs', 'winston', 'pino', 'morgan', 'newrelic', 'firebase-admin', 'aws-sdk', '@aws-sdk/client-s3', 'stripe', 'twilio', 'nodemailer', '@sendgrid/mail', 'redux', '@reduxjs/toolkit', 'zustand', 'react-query', '@tanstack/react-query', 'jest', 'mocha', 'vitest', 'supertest', 'eslint', 'prettier', 'husky') if k in alld}
    test_deps = [k for k in ('jest', 'mocha', 'vitest', 'supertest', 'chai', '@testing-library/react', 'cypress', 'playwright', '@playwright/test') if k in alld]
    test_files = [f for f in files if re.search(r'(^|/)(test|tests|__tests__|spec)(/|$)|\.(test|spec)\.[jt]sx?$', f) and not SKIP_DIRS.search(f)]
    test_lines = sum(lines.get(f, 0) for f in test_files)
    scripts = pkg.get('scripts', {})

    hits = {cat: {} for cat in PATTERNS}
    examples = {cat: {} for cat in PATTERNS}
    for cat, pats in PATTERNS.items():
        for pname, pat in pats.items():
            rx = re.compile(pat, re.M)
            per_file = collections.Counter(); ex = []
            for f, c in contents.items():
                if cat == 'hardcoded' and f.endswith(('.json',)): continue
                for m in rx.finditer(c):
                    if cat == 'hardcoded' and pname == 'http_url':
                        u = m.group(0)
                        if re.search(r'(w3\.org|schema\.org|localhost|example\.com|npmjs|github\.com|fonts\.g|googleapis\.com/css|reactjs\.org|nextjs\.org|xmlns)', u): continue
                    per_file[f] += 1
                    if len(ex) < 6:
                        ln = c.count('\n', 0, m.start()) + 1
                        ex.append('%s:%d' % (f, ln))
            if cat == 'secrets':
                # also scan non-source tracked text files (json, env, yaml, md) but never print values
                for f in files:
                    if f in contents or SKIP_DIRS.search(f) or f == 'package-lock.json': continue
                    if not f.endswith(('.json', '.env', '.env.example', '.yml', '.yaml', '.md', '.txt', '.config.js', '.html', '.py', '.sh')): continue
                    c = read(os.path.join(repo, f))
                    for m in rx.finditer(c):
                        per_file[f] += 1
                        if len(ex) < 6: ex.append('%s:%d' % (f, c.count('\n', 0, m.start()) + 1))
            tot = sum(per_file.values())
            if tot:
                hits[cat][pname] = {'count': tot, 'files': len(per_file), 'top': per_file.most_common(5)}
                examples[cat][pname] = ex

    # routes
    routes = []; mw = collections.Counter()
    for f, c in contents.items():
        for m in ROUTE_RE.finditer(c):
            verb, path, rest = m.group(1), m.group(2).strip('\'"`'), m.group(3)
            mws = [x.strip() for x in rest.split(',') if x.strip()]
            for x in mws[:-1] if len(mws) > 1 else []: mw[x.split('(')[0]] += 1
            routes.append({'verb': verb.upper(), 'path': path, 'file': f, 'line': c.count('\n', 0, m.start()) + 1, 'middleware': mws[:-1] if len(mws) > 1 else []})
    handlers = [r for r in routes if r['verb'] != 'USE']
    unguarded = [r for r in handlers if not r['middleware']]

    # models
    models = []
    for f, c in contents.items():
        for m in MONGOOSE_MODEL_RE.finditer(c):
            fields = SCHEMA_FIELD_RE.findall(c)
            enums = [e.group(1).replace('\n', ' ')[:200] for e in ENUM_RE.finditer(c)]
            idx = len(re.findall(r'\.index\(|index\s*:\s*true|unique\s*:\s*true', c))
            models.append({'kind': 'mongoose', 'name': m.group(1), 'file': f, 'fields': len(set(x[0] for x in fields)), 'enums': enums[:12], 'indexes': idx, 'timestamps': bool(re.search(r'timestamps\s*:\s*true', c))})
        for m in SEQUELIZE_DEFINE_RE.finditer(c):
            models.append({'kind': 'sequelize', 'name': m.group(1), 'file': f})
    prisma = [f for f in files if f.endswith('schema.prisma')]
    if prisma:
        for f in prisma:
            for m in re.finditer(r'^model\s+(\w+)', read(os.path.join(repo, f)), re.M):
                models.append({'kind': 'prisma', 'name': m.group(1), 'file': f})
    money_fields = collections.Counter()
    for f, c in contents.items():
        if '/models/' in f or f.startswith('models/'):
            for m in re.finditer(r'\b(price|amount|total|subtotal|tax|fee|discount|cost|balance|points|credit)\w*\s*:\s*\{?\s*(type\s*:\s*)?(Number|String|Decimal128|Schema\.Types\.Decimal128)', c):
                money_fields[m.group(3)] += 1

    # next.js pages / api routes
    next_pages = [f for f in files if re.search(r'(^|/)app/.*/(page|route|layout)\.[jt]sx?$', f) or re.search(r'(^|/)pages/.*\.[jt]sx?$', f)]
    api_routes = [f for f in next_pages if re.search(r'/api/', f)]

    # deps used vs declared (imports)
    used = collections.Counter()
    for c in contents.values():
        for m in IMPORT_RE.finditer(c):
            mod = (m.group(1) or m.group(2))
            if mod.startswith('@'): mod = '/'.join(mod.split('/')[:2])
            else: mod = mod.split('/')[0]
            used[mod] += 1
    declared = set(alld)
    unused_deps = sorted(d for d in deps if d not in used and not d.startswith('@types/'))
    undeclared = sorted(u for u in used if u not in declared and u not in ('fs', 'path', 'http', 'https', 'crypto', 'os', 'url', 'util', 'events', 'stream', 'child_process', 'buffer', 'querystring', 'zlib', 'net', 'assert', 'react', 'next', 'node:fs', 'node:path') and not u.startswith('node:'))

    # per-file function signature for cross-repo near-dup
    sigs = {}
    for f, c in contents.items():
        norm = re.sub(r'\s+', '', c)
        h = hashlib.sha1(norm.encode()).hexdigest()
        names = sorted(set(n for t in FUNC_NAME_RE.findall(c) for n in t if n))
        sigs[f] = {'hash': h, 'lines': lines[f], 'names': names, 'base': os.path.basename(f)}

    # env vars referenced
    env_refs = sorted(set(re.findall(r'process\.env\.([A-Z0-9_]+)', '\n'.join(contents.values()))))
    env_example = []
    ee = os.path.join(repo, '.env.example')
    if os.path.exists(ee):
        env_example = sorted(set(re.findall(r'^\s*([A-Z0-9_]+)\s*=', read(ee), re.M)))

    # duplicate-in-repo (same normalized hash within the repo)
    inrepo = collections.defaultdict(list)
    for f, s in sigs.items():
        if s['lines'] >= 30: inrepo[s['hash']].append(f)
    inrepo_dups = [v for v in inrepo.values() if len(v) > 1]

    ci = [f for f in files if f.startswith('.github/') or f in ('Dockerfile', 'docker-compose.yml', 'render.yaml', 'vercel.json', 'Procfile', 'ecosystem.config.js', 'serverless.yml', 'app.yaml', 'netlify.toml')]
    docs = [f for f in files if f.endswith('.md')]

    return {
        'repo': name, 'sha': sha, 'scanned_at': datetime.datetime.now().isoformat(timespec='seconds'),
        'files': len(files), 'src_files': len(src), 'src_lines': total_lines, 'by_ext': by_ext.most_common(12),
        'biggest': biggest, 'engines': pkg.get('engines'), 'scripts': scripts, 'lockfiles': lock,
        'deps_count': len(deps), 'dev_count': len(dev), 'pins': dict(pins), 'frameworks': fw,
        'eol_notes': eol_notes(alld, pkg.get('engines')), 'test_deps': test_deps, 'test_files': test_files[:40], 'test_file_count': len(test_files), 'test_lines': test_lines,
        'hits': hits, 'examples': examples,
        'routes_total': len(handlers), 'routes_unguarded': len(unguarded), 'routes_sample': handlers[:400], 'unguarded_sample': unguarded[:60], 'middleware_freq': mw.most_common(15),
        'models': models, 'money_field_types': dict(money_fields), 'next_pages': len(next_pages), 'next_api_routes': api_routes[:200],
        'unused_deps': unused_deps, 'undeclared_imports': undeclared[:40], 'env_refs': env_refs, 'env_example': env_example,
        'env_missing_from_example': sorted(set(env_refs) - set(env_example)), 'inrepo_duplicate_groups': inrepo_dups[:30],
        'ci_deploy_files': ci, 'docs': docs, 'sigs': sigs,
    }

def md_report(r):
    o = []
    A = o.append
    A('# %s @ %s — mechanical metrics' % (r['repo'], r['sha']))
    A('Scanned %s by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.\n' % r['scanned_at'])
    A('## Size\n- files tracked: %d · source files: %d · source lines: %s' % (r['files'], r['src_files'], format(r['src_lines'], ',')))
    A('- by extension: ' + ', '.join('%s %d' % e for e in r['by_ext']))
    A('- biggest source files: ' + '; '.join('%s (%d)' % b for b in r['biggest'][:8]))
    A('\n## Runtime and dependencies\n- engines: %s · lockfile: %s · deps %d / dev %d · pinning: %s' % (r['engines'], r['lockfiles'] or 'NONE', r['deps_count'], r['dev_count'], r['pins']))
    A('- frameworks: ' + json.dumps(r['frameworks']))
    if r['eol_notes']: A('- version risk: ' + '; '.join(r['eol_notes']))
    if r['unused_deps']: A('- declared but never imported (%d): %s' % (len(r['unused_deps']), ', '.join(r['unused_deps'][:30])))
    if r['undeclared_imports']: A('- imported but not declared: %s' % ', '.join(r['undeclared_imports']))
    A('- env vars referenced: %d · in .env.example: %d · referenced but missing from example: %s' % (len(r['env_refs']), len(r['env_example']), ', '.join(r['env_missing_from_example'][:30]) or 'none'))
    A('- CI/deploy files: %s' % (', '.join(r['ci_deploy_files']) or 'NONE'))
    A('\n## Tests\n- test deps: %s · test files: %d · test lines: %d · scripts.test: %s' % (r['test_deps'] or 'none', r['test_file_count'], r['test_lines'], r['scripts'].get('test', 'none')))
    A('\n## API surface\n- route handlers found: %d · with no middleware before the handler: %d · Next pages/routes: %d · Next api routes: %d' % (r['routes_total'], r['routes_unguarded'], r['next_pages'], len(r['next_api_routes'])))
    A('- middleware frequency: ' + ', '.join('%s %d' % m for m in r['middleware_freq']))
    if r['unguarded_sample']:
        A('- unguarded sample: ' + '; '.join('%s %s (%s:%d)' % (u['verb'], u['path'], u['file'], u['line']) for u in r['unguarded_sample'][:15]))
    A('\n## Data model\n- models: %d (%s)' % (len(r['models']), ', '.join(sorted(set(m['name'] for m in r['models'])))[:1500]))
    A('- money field types in models/: %s' % (r['money_field_types'] or 'none matched'))
    for m in r['models']:
        if m.get('enums'): A('  - %s (%s): fields %s, indexes %s, timestamps %s, enums: %s' % (m['name'], m['file'], m.get('fields'), m.get('indexes'), m.get('timestamps'), ' | '.join(m['enums'][:6])[:600]))
    for cat in ('secrets', 'security', 'hardcoded', 'performance', 'quality'):
        A('\n## %s' % cat)
        if not r['hits'][cat]: A('- none matched'); continue
        for p, h in sorted(r['hits'][cat].items(), key=lambda x: -x[1]['count']):
            A('- **%s**: %d hits in %d files — top: %s — e.g. %s' % (p, h['count'], h['files'], ', '.join('%s (%d)' % t for t in h['top'][:3]), ', '.join(r['examples'][cat][p][:4])))
    if r['inrepo_duplicate_groups']:
        A('\n## Byte-identical files inside this repo (>=30 lines)')
        for g in r['inrepo_duplicate_groups'][:20]: A('- ' + ' == '.join(g))
    A('\n## Docs in repo\n- ' + (', '.join(r['docs']) or 'none'))
    return '\n'.join(o) + '\n'

def cross_repo(results, out):
    o = ['# Cross-repo duplication (mechanical)', 'Exact = identical after whitespace removal. Near = same basename, difflib ratio >= 0.6, both >= 40 lines.\n']
    byhash = collections.defaultdict(list)
    for r in results:
        for f, s in r['sigs'].items():
            if s['lines'] >= 30: byhash[s['hash']].append((r['repo'], f, s['lines']))
    exact = [v for v in byhash.values() if len(set(x[0] for x in v)) > 1]
    exact.sort(key=lambda v: -v[0][2])
    o.append('## Exact duplicates across repos: %d groups, %s lines' % (len(exact), format(sum(v[0][2] for v in exact), ',')))
    pair = collections.Counter()
    for v in exact:
        repos = sorted(set(x[0] for x in v))
        for i in range(len(repos)):
            for j in range(i + 1, len(repos)): pair[(repos[i], repos[j])] += v[0][2]
        o.append('- %d lines: ' % v[0][2] + '; '.join('%s:%s' % (x[0], x[1]) for x in v[:6]))
    o.append('\n## Shared exact lines by repo pair')
    for (a, b), n in pair.most_common(40): o.append('- %s ↔ %s: %s lines' % (a, b, format(n, ',')))
    # near duplicates by basename
    o.append('\n## Near duplicates (same basename, different content)')
    bybase = collections.defaultdict(list)
    for r in results:
        for f, s in r['sigs'].items():
            if s['lines'] >= 40 and s['base'] not in ('index.js', 'index.jsx', 'index.ts', 'index.tsx', 'page.jsx', 'page.tsx', 'page.js', 'layout.jsx', 'layout.tsx', 'route.js', 'route.ts', 'loading.jsx', 'types.ts', 'utils.js', 'constants.js'):
                bybase[s['base']].append((r['repo'], f, s['hash']))
    near = []
    for base, lst in bybase.items():
        repos = set(x[0] for x in lst)
        if len(repos) < 2: continue
        seen = set()
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                a, b = lst[i], lst[j]
                if a[0] == b[0] or a[2] == b[2]: continue
                key = (a[0], b[0], base)
                if key in seen: continue
                seen.add(key)
                ca = read(os.path.join(ROOT, a[0], a[1])); cb = read(os.path.join(ROOT, b[0], b[1]))
                if abs(len(ca) - len(cb)) > max(len(ca), len(cb)) * 0.6: continue
                ratio = difflib.SequenceMatcher(None, ca, cb).quick_ratio()
                if ratio >= 0.6:
                    ratio = difflib.SequenceMatcher(None, ca, cb).ratio()
                    if ratio >= 0.6: near.append((ratio, a[0], a[1], b[0], b[1]))
    near.sort(reverse=True)
    for n in near[:150]: o.append('- %.2f  %s:%s  ~  %s:%s' % n)
    o.append('\n(%d near-duplicate pairs total)' % len(near))
    open(os.path.join(out, 'CROSS-REPO-DUPLICATES.md'), 'w').write('\n'.join(o) + '\n')

if __name__ == '__main__':
    ROOT, OUT = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d, '.git')))
    results = []
    for n in names:
        r = scan_repo(ROOT, n); results.append(r)
        slim = {k: v for k, v in r.items() if k != 'sigs'}
        json.dump(slim, open(os.path.join(OUT, n + '.json'), 'w'), indent=1, default=list)
        open(os.path.join(OUT, n + '.md'), 'w').write(md_report(r))
        print('%-26s sha=%s src=%6d lines=%8s routes=%4d unguarded=%4d models=%3d secrets=%s' % (n, r['sha'], r['src_files'], format(r['src_lines'], ','), r['routes_total'], r['routes_unguarded'], len(r['models']), {k: v['count'] for k, v in r['hits']['secrets'].items()}))
    if len(results) > 1: cross_repo(results, OUT)
