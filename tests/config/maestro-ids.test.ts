/**
 * Keeps the Maestro flows honest: every `id:` a flow taps or asserts must exist in the app
 * source, either literally or as a derived ID (`<testID>-primary`, `<testID>-<option>`, …).
 * Catches the drift that silently broke the Phase 0M smoke flow.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full, pattern);
    return pattern.test(entry) ? [full] : [];
  });
}

const source = [...files(join(ROOT, 'app'), /\.tsx?$/), ...files(join(ROOT, 'src'), /\.tsx?$/)]
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

// Interest chips are `interest-<slug>`; the slugs ship in catalog migrations (M-01).
const catalogSql = files(join(ROOT, 'supabase', 'migrations'), /catalog_.*\.sql$/)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

function existsInSource(id: string): boolean {
  if (source.includes(`'${id}'`) || source.includes(`"${id}"`) || source.includes(`\`${id}\``)) {
    return true;
  }
  if (id.startsWith('interest-') && source.includes('`interest-${interest.slug}`')) {
    return catalogSql.includes(`('${id.slice('interest-'.length)}',`);
  }
  // Derived IDs: the base testID is in source and the suffix is appended at runtime.
  const base = id.slice(0, id.lastIndexOf('-'));
  return base.length > 0 && (source.includes(`'${base}'`) || source.includes(`"${base}"`));
}

const flows = files(join(ROOT, 'tests', 'e2e', 'maestro', 'flows'), /\.ya?ml$/);

describe('Maestro flows', () => {
  it('exist', () => {
    expect(flows.length).toBeGreaterThan(0);
  });

  it.each(flows.map((file) => [file.slice(ROOT.length + 1), file]))(
    '%s only uses test IDs that exist in the app',
    (_name, file) => {
      const ids = [...readFileSync(file, 'utf8').matchAll(/^\s*id:\s*([\w-]+)\s*$/gm)].map(
        (match) => match[1] ?? '',
      );
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.filter((id) => !existsInSource(id))).toEqual([]);
    },
  );
});
