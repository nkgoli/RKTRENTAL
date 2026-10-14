import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(import.meta.dirname, '../../src');
const FORBIDDEN = [
  /^@prisma\/client$/,
  /^node:/,
  /^(fs|path|crypto|os|child_process)$/,
  /^@\/lib\/db/,
];

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? path.join(src, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Value imports (not `import type`) reachable from a file, as [importer, specifier] pairs. */
function valueImports(file: string, seen = new Set<string>()): [string, string][] {
  if (seen.has(file)) return [];
  seen.add(file);
  const found: [string, string][] = [];
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gms)) {
    const specifier = match[1]!;
    found.push([file, specifier]);
    const local = resolveLocal(file, specifier);
    if (local) found.push(...valueImports(local, seen));
  }
  return found;
}

describe('Edge middleware', () => {
  it('only imports Edge-runtime-safe modules (no Prisma, Node built-ins or code generation)', () => {
    const imports = valueImports(path.join(src, 'middleware.ts'));
    const bad = imports.filter(([, specifier]) => FORBIDDEN.some((rule) => rule.test(specifier)));
    expect(bad.map(([file, specifier]) => `${path.relative(src, file)} -> ${specifier}`)).toEqual(
      [],
    );
    expect(imports.some(([, specifier]) => specifier === '@/lib/auth/session')).toBe(true);
  });
});
