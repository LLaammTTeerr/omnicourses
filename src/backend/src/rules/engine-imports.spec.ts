import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The engine is pure (ADR 0013), the precondition for running it in the browser (ADR 0015). Only
// RulesService and its module load inputs through Nest, and CreditCapsDto is the one Swagger DTO
// kept beside its rule. Every other file of this folder imports the folder itself and these leaf
// modules, which import nothing else; a new import of a service or a package fails here.
const SRC = join(__dirname, '..');
const NEST_FILES = ['rules.service.ts', 'rules.module.ts', 'credit-caps.dto.ts'];
const LEAVES = ['terms/term.ts', 'common/by-text.ts', 'transcript/transcript-entry.ts', 'curriculum/curriculum-types.ts'];

const engineFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return engineFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !NEST_FILES.includes(entry.name) ? [path] : [];
  });

/** Every module a source text names: static imports and re-exports (type-only too), side-effect and dynamic imports. */
const specifiersIn = (text: string): string[] => [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]!);
const importsOf = (file: string): string[] => specifiersIn(readFileSync(file, 'utf8'));

/** The file an import names, relative to src/, or the package name. */
function target(file: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  return relative(SRC, join(file, '..', specifier)).replace(/\.js$/, '.ts');
}

const isEngineOrLeaf = (t: string): boolean => (t.startsWith('rules/') && !NEST_FILES.includes(t.slice('rules/'.length))) || LEAVES.includes(t);

const RULES = join(SRC, 'rules');
const FILES = engineFiles(RULES);

describe('rule engine imports', () => {
  it('finds the engine files', () => {
    expect(FILES.map((f) => relative(RULES, f))).toEqual(expect.arrayContaining(['attempts.ts', 'audit.ts', 'plan-issues.ts', 'testing/fixtures.ts']));
  });

  it.each(FILES.map((f) => [relative(SRC, f), f]))('%s imports only the engine and its leaf modules', (_name, file) => {
    const outside = importsOf(file)
      .map((specifier) => target(file, specifier))
      .filter((t) => !isEngineOrLeaf(t));
    expect(outside).toEqual([]);
  });

  it.each(LEAVES)('%s imports only the other leaf modules', (leaf) => {
    const file = join(SRC, leaf);
    expect(importsOf(file).map((s) => target(file, s)).filter((t) => !LEAVES.includes(t))).toEqual([]);
  });

  it('reads every kind of import and refuses a service, a Nest file of the folder or a package', () => {
    const text = "import type { A } from '../a.js';\nexport * from './b.js';\nimport './c.js';\nconst d = await import('../d.js');\nimport { E } from '@nestjs/common';";
    expect(specifiersIn(text)).toEqual(['../a.js', './b.js', './c.js', '../d.js', '@nestjs/common']);
    const file = join(RULES, 'audit.ts');
    const named = ['../curriculum/curriculum.service.js', './rules.service.js', './credit-caps.dto.js', '@nestjs/common', 'typeorm', './attempts.js', '../terms/term.js'];
    expect(named.filter((s) => isEngineOrLeaf(target(file, s)))).toEqual(['./attempts.js', '../terms/term.js']);
  });
});
