#!/usr/bin/env node
/**
 * Repository security guard (runs in CI and `npm run security:check`).
 *
 * Fails when:
 *  1. secret-looking material appears in source/config files,
 *  2. code references an EXPO_PUBLIC_* variable that is not on the public allowlist,
 *  3. a real .env file (anything except .env.example) is tracked by git,
 *  4. .env.example contains a value for a key that must stay empty.
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'src', 'scripts', 'tests', '.github'];
const SCAN_ROOT_FILES = [
  'app.config.ts',
  'eas.json',
  'package.json',
  '.env.example',
  'metro.config.js',
];
const SCAN_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|ya?ml|md)$|^\.env\.example$/;
const SELF = 'scripts/check-security.mjs';

const ALLOWED_PUBLIC_VARS = new Set([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_ANALYTICS_ENABLED',
  'EXPO_PUBLIC_SENTRY_DSN',
]);

const SECRET_PATTERNS = [
  { name: 'Supabase secret key', regex: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'service-role env var', regex: /SUPABASE_SERVICE_ROLE(_KEY)?\s*[=:]\s*['"]?\S{10,}/ },
  {
    name: 'JWT with service_role claim',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/,
  },
  { name: 'Resend API key', regex: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/ },
  { name: 'Sentry auth token', regex: /\bsntrys_[A-Za-z0-9_=+/-]{20,}/ },
  { name: 'private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Postgres URL with password', regex: /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/ },
  { name: 'Expo access token', regex: /\bEXPO_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{20,}/ },
];

const MUST_BE_EMPTY_IN_EXAMPLE = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
];

function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...walk(full));
    else if (SCAN_EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir))),
  ...SCAN_ROOT_FILES.map((file) => join(ROOT, file)),
].filter((file) => relative(ROOT, file) !== SELF);

const failures = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(ROOT, file);
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(text)) failures.push(`${rel}: possible ${name}`);
  }
  for (const match of text.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) {
    if (!ALLOWED_PUBLIC_VARS.has(match[0])) {
      failures.push(
        `${rel}: ${match[0]} is not on the EXPO_PUBLIC allowlist (public = shipped in the app)`,
      );
    }
  }
}

// .env.example must not contain real values for sensitive keys.
const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
for (const key of MUST_BE_EMPTY_IN_EXAMPLE) {
  const line = example.split('\n').find((l) => l.startsWith(`${key}=`));
  if (line && line.slice(key.length + 1).trim() !== '') {
    failures.push(`.env.example: ${key} must be an empty placeholder`);
  }
}

// No real env files tracked in git.
try {
  const tracked = execSync('git ls-files', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\n')
    .filter((f) => /(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith('.env.example'));
  for (const f of tracked) failures.push(`${f}: environment file must not be committed`);
} catch {
  // Not a git checkout (e.g. fresh scaffold) — tracked-file check skipped.
}

if (failures.length > 0) {
  console.error('Security check FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`Security check passed (${files.length} files scanned).`);
