#!/usr/bin/env node
/**
 * Static guard for Supabase migrations (runs in `npm run verify` / CI). No database needed.
 *
 * Enforces the conventions documented in supabase/README.md:
 *  1. Filenames are `<14-digit timestamp>_<snake_case>.sql` and timestamps are unique.
 *  2. Every table created in an exposed schema (public) enables RLS in the same migration.
 *  3. Row level security is never disabled.
 *  4. No secrets / service-role material in SQL.
 *  5. seed.sql contains no DDL (schema belongs in migrations).
 *  6. seed.sql only writes approved catalog tables (destinations, interests); never users,
 *     profiles, trips, selections, preferences or other personal data
 *     and every INSERT is idempotent (ON CONFLICT).
 *  7. Fail-closed privileges (Phase 1M-H). Supabase's default privileges grant every new
 *     public table and function to anon/authenticated, so each migration must opt out:
 *     - every public table is followed by `revoke all on table public.<t> from ... anon ...`;
 *     - every public/private function is covered by `revoke all on function <schema>.<f>(`
 *       ... `from public` in the same or an earlier migration;
 *     - every SECURITY DEFINER function sets `search_path = ''`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const SEED_FILE = join(process.cwd(), 'supabase', 'seed.sql');
const FILENAME = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;
const EXPOSED_SCHEMAS = ['public'];

/** Removes `-- line` and `/* block *\/` comments so documentation text isn't parsed as SQL. */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

const failures = [];
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
const seenTimestamps = new Map();
// Functions whose PUBLIC execute has been revoked so far (CREATE OR REPLACE keeps grants).
const revokedFunctions = new Set();

for (const file of files.sort()) {
  const match = FILENAME.exec(file);
  if (!match) {
    failures.push(
      `${file}: name must be <YYYYMMDDHHMMSS>_<snake_case>.sql (use \`npx supabase migration new\`)`,
    );
    continue;
  }
  const timestamp = match[1];
  if (seenTimestamps.has(timestamp)) {
    failures.push(`${file}: duplicate timestamp with ${seenTimestamps.get(timestamp)}`);
  }
  seenTimestamps.set(timestamp, file);

  const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8')).toLowerCase();

  if (/disable\s+row\s+level\s+security/.test(sql)) {
    failures.push(`${file}: disables row level security`);
  }

  const created = [
    ...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?/g),
  ].map((m) => ({ schema: m[1] ?? 'public', table: m[2] }));

  for (const { schema, table } of created) {
    if (!EXPOSED_SCHEMAS.includes(schema)) continue;
    const enableRls = new RegExp(
      `alter\\s+table\\s+(?:only\\s+)?(?:"?${schema}"?\\.)?"?${table}"?\\s+enable\\s+row\\s+level\\s+security`,
    );
    if (!enableRls.test(sql)) {
      failures.push(
        `${file}: ${schema}.${table} is created without enabling RLS in the same migration`,
      );
    }
  }

  for (const { schema, table } of created) {
    if (!EXPOSED_SCHEMAS.includes(schema)) continue;
    const revoke = new RegExp(
      `revoke\\s+all\\s+on\\s+(?:table\\s+)?${schema}\\.${table}\\s+from\\s+[^;]*\\banon\\b`,
    );
    if (!revoke.test(sql)) {
      failures.push(
        `${file}: ${schema}.${table} must revoke Supabase's default grants (revoke all on table ${schema}.${table} from public, anon, authenticated)`,
      );
    }
  }

  for (const m of sql.matchAll(
    /revoke\s+all\s+on\s+function\s+(\w+)\.(\w+)\s*\([^;]*?\bfrom\s+([^;]*)/g,
  )) {
    if (/\bpublic\b/.test(m[3])) revokedFunctions.add(`${m[1]}.${m[2]}`);
  }
  const statements = sql.split(/;\s*(?=create|revoke|grant|alter|comment|insert|drop|$)/);
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(\w+)\.(\w+)\s*\(/g)) {
    const [, schema, name] = m;
    if (!['public', 'private'].includes(schema)) continue;
    if (!revokedFunctions.has(`${schema}.${name}`)) {
      failures.push(
        `${file}: ${schema}.${name}() must revoke execute from public (revoke all on function ${schema}.${name}(...) from public, anon[, authenticated])`,
      );
    }
  }
  for (const stmt of statements) {
    const fn = /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)/.exec(stmt);
    if (fn && /\bsecurity\s+definer\b/.test(stmt) && !/set\s+search_path\s*=\s*''/.test(stmt)) {
      failures.push(`${file}: SECURITY DEFINER function ${fn[1]} must set search_path = ''`);
    }
  }

  if (
    /service_role_key|sb_secret_|sbp_[a-f0-9]{20,}|postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/.test(sql)
  ) {
    failures.push(`${file}: contains secret-looking material`);
  }
}

const seed = stripComments(readFileSync(SEED_FILE, 'utf8')).toLowerCase();
if (/\b(create|alter|drop)\s+(table|schema|function|policy|type|extension)\b/.test(seed)) {
  failures.push('supabase/seed.sql: contains DDL — schema changes belong in migrations');
}

const SEED_WRITABLE_TABLES = ['public.destinations', 'public.interests'];
// `on conflict ... do update set` is part of an upsert, not a separate UPDATE statement.
const seedWrites =
  /\b(?:insert\s+into|(?<!\bdo\s+)update|delete\s+from|truncate(?:\s+table)?)\s+([\w."]+)/g;
for (const m of seed.matchAll(seedWrites)) {
  const target = m[1].replace(/"/g, '');
  const qualified = target.includes('.') ? target : `public.${target}`;
  if (!SEED_WRITABLE_TABLES.includes(qualified)) {
    failures.push(
      `supabase/seed.sql: writes ${qualified} — seed may only write ${SEED_WRITABLE_TABLES.join(', ')}`,
    );
  }
}
const inserts = seed.split(';').filter((stmt) => /\binsert\s+into\b/.test(stmt));
for (const stmt of inserts) {
  if (!/\bon\s+conflict\b/.test(stmt)) {
    failures.push('supabase/seed.sql: every INSERT must be idempotent (ON CONFLICT ...)');
  }
}

if (failures.length > 0) {
  console.error('Migration check FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`Migration check passed (${files.length} migration file(s), seed.sql).`);
