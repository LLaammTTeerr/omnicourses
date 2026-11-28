import { globSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import vitestConfig from '../vitest.config.mjs';

const ROOT = join(__dirname, '../../..');
const BACKEND_ROOT = join(__dirname, '..');
const RULE_ENGINE_FOLDER = 'src/rules';
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const HOST_SET_SETTINGS = ['NODE_ENV'];
const FRONTEND_SETTING_PREFIX = 'VITE_';
const ENV_READ = /\benv\.([A-Z][A-Z0-9_]*)/g;
const ENV_EXAMPLE_NAME = /^#?\s*([A-Z][A-Z0-9_]*)=/gm;
const VITE_READ = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g;
const PACKAGE_FILES = ['package.json', 'src/backend/package.json', 'src/frontend/package.json'];
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies'];
const FRONTEND_SOURCE = 'src/frontend/src';
const FRONTEND_SOURCE_FILE = /\.(ts|vue)$/;
const NOT_PRODUCTION = /\.spec\.ts$|(^|\/)testing\//;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const BACKEND_PACKAGE = 'src/backend/package.json';
const FRONTEND_PACKAGE = 'src/frontend/package.json';
const STACK_PACKAGES: Record<string, [string, string[]]> = {
  NestJS: ['@nestjs/core', [BACKEND_PACKAGE]],
  'Nest CLI': ['@nestjs/cli', [BACKEND_PACKAGE]],
  Swagger: ['@nestjs/swagger', [BACKEND_PACKAGE]],
  TypeORM: ['typeorm', [BACKEND_PACKAGE]],
  TypeScript: ['typescript', [BACKEND_PACKAGE]],
  Vue: ['vue', [FRONTEND_PACKAGE]],
  Vite: ['vite', [FRONTEND_PACKAGE]],
  Vitest: ['vitest', [BACKEND_PACKAGE, FRONTEND_PACKAGE]],
};

const namesIn = (text: string, pattern: RegExp): string[] => [...new Set([...text.matchAll(pattern)].map((m) => m[1]!))].sort();
const isFrontendSetting = (name: string): boolean => name.startsWith(FRONTEND_SETTING_PREFIX);

const frontendProductionText = (): string =>
  readdirSync(join(ROOT, FRONTEND_SOURCE), { recursive: true, encoding: 'utf8' })
    .filter((path) => FRONTEND_SOURCE_FILE.test(path) && !NOT_PRODUCTION.test(path))
    .map((path) => read(join(FRONTEND_SOURCE, path)))
    .join('\n');

function versionsIn(path: string, pattern: RegExp): Record<string, string> {
  const versions = [...read(path).matchAll(new RegExp(pattern, 'gm'))].map((m) => m[1]!);
  if (versions.length === 0) throw new Error(`${path} does not state the version matched by ${pattern}`);
  return Object.fromEntries(versions.map((version, index) => [`${path}#${index + 1}`, version]));
}

const versionIn = (path: string, pattern: RegExp): string => Object.values(versionsIn(path, pattern))[0]!;

function expectOneVersion(versions: Record<string, string>): void {
  const [first] = Object.values(versions);
  expect(versions).toEqual(Object.fromEntries(Object.keys(versions).map((file) => [file, first])));
}

describe('compose.yaml', () => {
  it('publishes ports on the loopback address only, because the database password is known', () => {
    const ports = [...read('compose.yaml').matchAll(/^\s*-\s*"?([\d.:]+)"?\s*$/gm)].map((m) => m[1]!);
    expect(ports.length).toBeGreaterThan(0);
    for (const port of ports) expect(port).toMatch(/^127\.0\.0\.1:\d+:\d+$/);
  });
});

describe('coverage gate', () => {
  const productionFilesMatching = (glob: string): string[] =>
    globSync(glob, { cwd: BACKEND_ROOT }).filter((path) => path.endsWith('.ts') && !NOT_PRODUCTION.test(path));
  const globs = Object.entries(vitestConfig.test?.coverage?.thresholds ?? {}).filter(([, threshold]) => typeof threshold === 'object').map(([key]) => key);

  it('sets a threshold on at least one glob', () => {
    expect(globs.length).toBeGreaterThan(0);
  });

  it.each(globs)('matches at least one production file with the threshold glob %s, or Vitest passes it unchecked', (glob) => {
    expect(productionFilesMatching(glob).length).toBeGreaterThan(0);
  });

  it('covers every production file of the rule engine with a threshold', () => {
    const covered = new Set(globs.flatMap(productionFilesMatching));
    const engineFiles = readdirSync(join(BACKEND_ROOT, RULE_ENGINE_FOLDER))
      .filter((file) => file.endsWith('.ts') && !NOT_PRODUCTION.test(file))
      .map((file) => `${RULE_ENGINE_FOLDER}/${file}`);
    expect(engineFiles.length).toBeGreaterThan(0);
    expect(engineFiles.filter((file) => !covered.has(file))).toEqual([]);
  });
});

describe('settings', () => {
  const documented = namesIn(read('.env.example'), ENV_EXAMPLE_NAME).filter((name) => !HOST_SET_SETTINGS.includes(name));

  it('documents in .env.example every setting the backend reads, and only those', () => {
    const readNames = namesIn(read('src/backend/src/config/env.ts'), ENV_READ).filter((name) => !HOST_SET_SETTINGS.includes(name));
    const backendDocumented = documented.filter((name) => !isFrontendSetting(name));
    expect(backendDocumented).toEqual(readNames);
  });

  it('documents in .env.example every VITE_ setting the frontend reads, and only those', () => {
    const frontendRead = namesIn(frontendProductionText(), VITE_READ);
    expect(documented.filter(isFrontendSetting)).toEqual(frontendRead);
  });
});

describe('pinned runtimes', () => {
  it('states one Node version in .nvmrc and the server setup script and AGENTS.md', () => {
    expectOneVersion({
      '.nvmrc': read('.nvmrc').trim(),
      'deploy/server/setup.sh': versionIn('deploy/server/setup.sh', /^NODE_VERSION=(\S+)$/m),
      ...versionsIn('AGENTS.md', /Node (\d+\.\d+\.\d+)/),
      ...versionsIn('deploy/README.md', /Node (\d+\.\d+\.\d+)/),
    });
  });

  it('states one npm version in both workflows, the server setup script and AGENTS.md', () => {
    expectOneVersion({
      '.github/workflows/ci.yml': versionIn('.github/workflows/ci.yml', /^\s*NPM_VERSION:\s*(\S+)$/m),
      '.github/workflows/release.yml': versionIn('.github/workflows/release.yml', /^\s*NPM_VERSION:\s*(\S+)$/m),
      'deploy/server/setup.sh': versionIn('deploy/server/setup.sh', /^NPM_VERSION=(\S+)$/m),
      ...versionsIn('AGENTS.md', /\bnpm (\d+\.\d+\.\d+)\b/),
      ...versionsIn('deploy/README.md', /\bnpm (\d+\.\d+\.\d+)\b/),
    });
  });

  it('states one PostgreSQL version in compose.yaml, ci.yml, the server setup script and AGENTS.md', () => {
    expectOneVersion({
      'compose.yaml': versionIn('compose.yaml', /image:\s*\S*postgres:(\S+)/),
      '.github/workflows/ci.yml': versionIn('.github/workflows/ci.yml', /image:\s*postgres:(\S+)/),
      'deploy/server/setup.sh': versionIn('deploy/server/setup.sh', /^PG_IMAGE=\S*postgres:(\S+)$/m),
      ...versionsIn('AGENTS.md', /PostgreSQL (\d+\.\d+)/),
      ...versionsIn('README.md', /PostgreSQL (\d+\.\d+)/),
      ...versionsIn('deploy/README.md', /PostgreSQL (\d+\.\d+)/),
    });
  });
});

describe('AGENTS.md stack line', () => {
  const packageVersion = (manifest: string, name: string): string => {
    const parsed = JSON.parse(read(manifest)) as Record<string, Record<string, string> | undefined>;
    return DEPENDENCY_SECTIONS.map((section) => parsed[section]?.[name]).find((version) => version !== undefined) ?? 'missing';
  };

  it('states for each package the version its package.json pins', () => {
    const stated = Object.fromEntries(Object.keys(STACK_PACKAGES).map((entry) => [entry, versionIn('AGENTS.md', new RegExp(`\\b${entry} (\\d+\\.\\d+(?:\\.\\d+)?)`))]));
    const pinned = Object.fromEntries(
      Object.entries(STACK_PACKAGES).map(([entry, [name, manifests]]) => {
        const versions = [...new Set(manifests.map((manifest) => packageVersion(manifest, name)))];
        return [entry, versions.length === 1 ? versions[0] : `${versions.join(' vs ')} (manifests disagree)`];
      }),
    );
    expect(stated).toEqual(pinned);
  });

  it('states the OpenAPI specification version the contract uses', () => {
    const contract = JSON.parse(read('src/backend/openapi.json')) as { openapi: string };
    expect({ OpenAPI: versionIn('AGENTS.md', /OpenAPI (\d+\.\d+\.\d+)/) }).toEqual({ OpenAPI: contract.openapi });
  });
});

describe('package.json', () => {
  it('pins every dependency to an exact x.y.z version', () => {
    const unpinned = PACKAGE_FILES.flatMap((file) => {
      const manifest = JSON.parse(read(file)) as Record<string, Record<string, string> | undefined>;
      return DEPENDENCY_SECTIONS.flatMap((section) =>
        Object.entries(manifest[section] ?? {})
          .filter(([, version]) => !EXACT_VERSION.test(version))
          .map(([name, version]) => `${file} ${section} ${name}@${version}`),
      );
    });
    expect(unpinned).toEqual([]);
  });
});
