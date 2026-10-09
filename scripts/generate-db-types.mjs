#!/usr/bin/env node
/**
 * Regenerates src/services/supabase/database.types.ts with the Supabase CLI.
 *
 *   npm run supabase:types          → from the LINKED development project (needs `supabase login` + `supabase link`)
 *   npm run supabase:types:local    → from the local Supabase stack (needs `supabase start`, i.e. Docker)
 *
 * Writes the file only when generation succeeds, so a failed run never truncates the
 * committed types. The output is CLI-generated: never edit it by hand.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = join(process.cwd(), 'src', 'services', 'supabase', 'database.types.ts');
const SOURCES = { linked: ['--linked'], local: ['--local'] };

const mode = process.argv[2] ?? 'linked';
const sourceArgs = SOURCES[mode];
if (!sourceArgs) {
  console.error(`Unknown mode "${mode}". Use one of: ${Object.keys(SOURCES).join(', ')}`);
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', ...sourceArgs, '--schema', 'public'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);

if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error('Type generation failed; database.types.ts was left unchanged.');
  process.exit(result.status || 1);
}

writeFileSync(OUTPUT, result.stdout);
console.log(
  `Wrote ${OUTPUT} (${mode}). Commit it together with the migration that changed the schema.`,
);
