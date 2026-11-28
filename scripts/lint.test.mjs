import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { importsOf, lintWorkspace } from './lint.mjs';

const BACKEND = 'src/backend/src';
const FRONTEND = 'src/frontend/src';

const BASE_LAYERS = {
  backendEdges: [],
  frontendKernel: ['api.ts', 'locale.ts', 'components/'],
  frontendComposition: ['App.vue', 'router.ts'],
  frontendLayerExceptions: [],
  frontendFeatureEdges: [],
  identifierHomes: [],
  codedErrorHomes: [`${BACKEND}/common/api-errors.ts`, `${BACKEND}/ai/`],
};

const BASE_FILES = {
  'src/frontend/index.html': '<html></html>',
  'deploy/server/nginx-site.conf': 'add_header Content-Security-Policy "script-src \'self\'";',
  [`${BACKEND}/features.ts`]: "import { HealthModule } from './health/health.module.js';\nexport const FEATURE_MODULES = [HealthModule];\n",
  [`${BACKEND}/health/health.module.ts`]: 'export class HealthModule {}\n',
  'docs/analysis-and-design/architecture.md':
    '## 4. L3\n\n| Module | Folder |\n| --- | --- |\n| health | `health/` |\n\n## 5. Next\n',
  [`${FRONTEND}/api.ts`]: 'export async function load() { return fetch("/api"); }\n',
  [`${FRONTEND}/locale.ts`]: 'export const locale = 1;\n',
};

const created = [];

function workspace(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-test-'));
  created.push(root);
  for (const [relPath, content] of Object.entries({ ...BASE_FILES, ...files })) {
    const full = path.join(root, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function problems(files, layers = {}) {
  return lintWorkspace(workspace(files), { ...BASE_LAYERS, ...layers });
}

function rulesOf(files, layers) {
  return [...new Set(problems(files, layers).map((error) => error.rule))];
}

after(() => {
  for (const root of created) fs.rmSync(root, { recursive: true, force: true });
});

describe('baseline', () => {
  it('passes on a clean workspace', () => {
    assert.deepEqual(problems({}), []);
  });
});

describe('importsOf', () => {
  const parse = (relPath, content) => {
    const root = workspace({ [relPath]: content, [`${BACKEND}/b.ts`]: '', [`${BACKEND}/c.ts`]: '' });
    return importsOf(path.join(root, relPath)).map((entry) => [entry.specifier, entry.line, entry.target !== null]);
  };

  it('reads static, multi-line, type-only, side-effect, re-export and dynamic imports', () => {
    const content = [
      "import { a } from './b.js';",
      'import {',
      '  x,',
      '  y,',
      "} from './c.js';",
      "import type { T } from './b.js';",
      "import './c.js';",
      "export * from './b.js';",
      "export { z } from './c.js';",
      "const m = import('./b.js');",
      "import pkg from 'vue';",
    ].join('\n');
    assert.deepEqual(parse(`${BACKEND}/a.ts`, content), [
      ['./b.js', 1, true],
      ['./c.js', 2, true],
      ['./b.js', 6, true],
      ['./c.js', 7, true],
      ['./b.js', 8, true],
      ['./c.js', 9, true],
      ['./b.js', 10, true],
      ['vue', 11, false],
    ]);
  });

  it('ignores commented imports', () => {
    const content = "// import { a } from './b.js';\n/* import { c } from './c.js'; */\n";
    assert.deepEqual(parse(`${BACKEND}/a.ts`, content), []);
  });

  it('still sees an import between a /* inside one string and a */ inside another', () => {
    const content = "const a = 'src/*.ts';\nimport { x } from './b.js';\nconst b = '**/*.spec.ts';\n";
    assert.deepEqual(parse(`${BACKEND}/a.ts`, content), [['./b.js', 2, true]]);
  });

  it('ignores a commented-out import after a string and keeps line numbers', () => {
    const content = "const a = 'x';\n/* import { c } from './c.js';\n*/\nimport { x } from './b.js';\n";
    assert.deepEqual(parse(`${BACKEND}/a.ts`, content), [['./b.js', 4, true]]);
  });

  it('does not treat // inside a string as a comment', () => {
    const content = "const u = 'http://x.test/'; import { a } from './b.js';\n";
    assert.deepEqual(parse(`${BACKEND}/a.ts`, content), [['./b.js', 1, true]]);
  });

  it('reads the script of a Vue file and skips its template', () => {
    const content = "<template><p>import x from './b.js'</p></template>\n<script setup lang=\"ts\">\nimport { a } from './b.js';\n</script>\n";
    assert.deepEqual(parse(`${BACKEND}/a.vue`, content), [['./b.js', 3, true]]);
  });

  it('resolves index files and extension-less paths', () => {
    const root = workspace({
      [`${BACKEND}/dir/index.ts`]: '',
      [`${BACKEND}/a.ts`]: "import './dir';\nimport './b';\nimport './missing.js';\n",
      [`${BACKEND}/b.ts`]: '',
    });
    const result = importsOf(path.join(root, BACKEND, 'a.ts')).map((entry) => entry.target !== null);
    assert.deepEqual(result, [true, true, false]);
  });
});

describe('existing TypeScript rules', () => {
  it('reports no-ts-ignore and no-debugger in backend test files', () => {
    const rules = rulesOf({ 'src/backend/test/a.e2e-spec.ts': '// @ts-ignore\ndebugger;\n' });
    assert.deepEqual(rules.sort(), ['no-debugger', 'no-ts-ignore']);
  });

  it('reports no-direct-process-env in src and in backend test files', () => {
    assert.ok(rulesOf({ [`${BACKEND}/x.ts`]: 'export const a = process.env.A;\n' }).includes('no-direct-process-env'));
    assert.ok(rulesOf({ 'src/backend/test/support/x.ts': 'export const a = process.env.A;\n' }).includes('no-direct-process-env'));
  });

  it('allows process.env in config/env.ts', () => {
    assert.deepEqual(problems({ [`${BACKEND}/config/env.ts`]: 'export const a = process.env.A;\n' }), []);
  });

  it('reports vue-style-scoped for an unscoped style block', () => {
    const rules = rulesOf({ [`${FRONTEND}/x/V.vue`]: '<template><p /></template>\n<style>p { color: red; }</style>\n' });
    assert.deepEqual(rules, ['vue-style-scoped']);
  });

  it('accepts a scoped style block', () => {
    assert.deepEqual(problems({ [`${FRONTEND}/x/V.vue`]: '<template><p /></template>\n<style scoped>p {}</style>\n' }), []);
  });

  it('reports csp-script-hash when an inline script has no matching hash', () => {
    const rules = rulesOf({ 'src/frontend/index.html': '<script>var a = 1;</script>' });
    assert.deepEqual(rules, ['csp-script-hash']);
  });
});

describe('no-fetch-outside-api', () => {
  it('reports fetch in a .vue file', () => {
    const rules = rulesOf({ [`${FRONTEND}/x/V.vue`]: '<script setup lang="ts">\nawait fetch("/a");\n</script>\n' });
    assert.deepEqual(rules, ['no-fetch-outside-api']);
  });

  it('reports fetch in a production .ts file', () => {
    const [error] = problems({ [`${FRONTEND}/x/store.ts`]: 'export const a = 1;\nexport const b = fetch("/a");\n' });
    assert.equal(error.rule, 'no-fetch-outside-api');
    assert.equal(error.line, 2);
  });

  it('ignores fetch in a style block or a comment but reports it in the script', () => {
    const quiet = '<template><p /></template>\n<style scoped>\n/* fetch("/a") */\n.a::after { content: "fetch(x)"; }\n</style>\n<script setup lang="ts">\n// fetch("/a")\n/* fetch("/b") */\n</script>\n';
    assert.deepEqual(problems({ [`${FRONTEND}/x/Q.vue`]: quiet }), []);
    const loud = '<style scoped>\n.a { color: red; }\n</style>\n<script setup lang="ts">\nawait fetch("/a");\n</script>\n';
    const [error] = problems({ [`${FRONTEND}/x/L.vue`]: loud });
    assert.equal(error.rule, 'no-fetch-outside-api');
    assert.equal(error.line, 5);
  });

  it('allows fetch in api.ts, specs and testing folders, and a method named fetch', () => {
    assert.deepEqual(
      problems({
        [`${FRONTEND}/x/a.spec.ts`]: 'fetch("/a");\n',
        [`${FRONTEND}/x/testing/f.ts`]: 'fetch("/a");\n',
        [`${FRONTEND}/x/b.ts`]: 'function fetch() {}\n',
      }),
      [],
    );
  });
});

describe('backend-import-direction', () => {
  const files = (importLine) => ({
    [`${BACKEND}/a/a.service.ts`]: importLine,
    [`${BACKEND}/b/b.service.ts`]: 'export class B {}\n',
  });

  it('reports a new edge from a plain import', () => {
    const [error] = problems(files("import { B } from '../b/b.service.js';\n"));
    assert.equal(error.rule, 'backend-import-direction');
    assert.equal(error.file, `${BACKEND}/a/a.service.ts`);
    assert.equal(error.line, 1);
    assert.match(error.message, /scripts\/layers\.mjs/);
  });

  it('reports a new edge from a multi-line import', () => {
    assert.deepEqual(rulesOf(files("import {\n  B,\n  C,\n} from '../b/b.service.js';\n")), ['backend-import-direction']);
  });

  it('reports a new edge from a type-only import', () => {
    assert.deepEqual(rulesOf(files("import type { B } from '../b/b.service.js';\n")), ['backend-import-direction']);
  });

  it('reports a new edge from a dynamic import', () => {
    assert.deepEqual(rulesOf(files("const m = import('../b/b.service.js');\n")), ['backend-import-direction']);
  });

  it('accepts a listed edge', () => {
    assert.deepEqual(problems(files("import { B } from '../b/b.service.js';\n"), { backendEdges: ['a -> b'] }), []);
  });

  it('reports a listed edge that no longer exists', () => {
    const [error] = problems(files('export const a = 1;\n'), { backendEdges: ['a -> b'] });
    assert.equal(error.rule, 'backend-import-direction');
    assert.equal(error.file, 'scripts/layers.mjs');
    assert.match(error.message, /remove it from scripts\/layers\.mjs/);
  });

  it('lets the composition root, specs and testing folders import anything', () => {
    assert.deepEqual(
      problems({
        [`${BACKEND}/a/a.service.ts`]: 'export class A {}\n',
        [`${BACKEND}/app.module.ts`]: "import { A } from './a/a.service.js';\nimport { HealthModule } from './health/health.module.js';\n",
        [`${BACKEND}/b/b.spec.ts`]: "import { A } from '../a/a.service.js';\n",
        [`${BACKEND}/b/testing/fake.ts`]: "import { A } from '../../a/a.service.js';\n",
      }),
      [],
    );
  });
});

describe('identifier-home', () => {
  const homes = { identifierHomes: [{ identifiers: ['secret_column', 'secretColumn'], folders: [`${BACKEND}/owner/`, `${BACKEND}/database/migrations/`] }] };

  it('reports an identifier outside its folders', () => {
    const [error, ...rest] = problems({ [`${BACKEND}/other/a.service.ts`]: 'export const a = 1;\nexport const b = "x.secretColumn";\n' }, homes);
    assert.deepEqual(rest, []);
    assert.equal(error.rule, 'identifier-home');
    assert.equal(error.file, `${BACKEND}/other/a.service.ts`);
    assert.equal(error.line, 2);
    assert.match(error.message, /secretColumn/);
  });

  it('allows the identifier in its folders, in specs and testing folders, and does not match a longer name', () => {
    assert.deepEqual(
      problems(
        {
          [`${BACKEND}/owner/a.ts`]: 'export const a = "secret_column";\n',
          [`${BACKEND}/database/migrations/1-a.ts`]: 'export const a = "secret_column";\n',
          [`${BACKEND}/other/a.spec.ts`]: 'export const a = "secret_column";\n',
          [`${BACKEND}/other/testing/a.ts`]: 'export const a = "secretColumn";\n',
          [`${BACKEND}/other/b.ts`]: 'export const a = "secret_columns";\n',
          [`${BACKEND}/other/c.ts`]: 'export const a = "my_secret_column";\n',
        },
        homes,
      ),
      [],
    );
  });
});

describe('coded-error-home', () => {
  const coded = "throw new ConflictException({ statusCode: 409, code: 'x', message: m });\n";

  it('reports a coded body built in an exception outside its homes, also over several lines', () => {
    const [error, ...rest] = problems({
      [`${BACKEND}/other/a.service.ts`]: `export const a = 1;\nexport const b = new ForbiddenException({\n  statusCode: 403,\n  code: "y",\n  message: f(),\n});\n`,
    });
    assert.deepEqual(rest, []);
    assert.equal(error.rule, 'coded-error-home');
    assert.equal(error.file, `${BACKEND}/other/a.service.ts`);
    assert.equal(error.line, 2);
  });

  it('allows it in the homes, in specs, and for an exception without a code', () => {
    assert.deepEqual(
      problems({
        [`${BACKEND}/common/api-errors.ts`]: coded,
        [`${BACKEND}/ai/a.ts`]: coded,
        [`${BACKEND}/other/a.spec.ts`]: coded,
        [`${BACKEND}/other/b.ts`]: "throw new HttpException({ statusCode: 500, message: 'x (code: y)' }, 500);\nconst c = { code: 'z' };\n",
        [`${BACKEND}/other/c.ts`]: "// new ConflictException({ code: 'x' })\nthrow new NotFoundException('code: none');\n",
      }),
      [],
    );
  });
});

describe('frontend-layers', () => {
  it('reports a kernel file importing a feature file', () => {
    const [error] = problems({
      [`${FRONTEND}/components/Card.vue`]: '<script setup lang="ts">\nimport { f } from "../plans/f.js";\n</script>\n',
      [`${FRONTEND}/plans/f.ts`]: 'export const f = 1;\n',
    });
    assert.equal(error.rule, 'frontend-layers');
    assert.equal(error.line, 2);
  });

  it('reports a dynamic import that breaks a layer rule', () => {
    const [error] = problems({
      [`${FRONTEND}/router.ts`]: 'export const router = 1;\n',
      [`${FRONTEND}/plans/f.ts`]: "export const load = () => import('../router.js');\n",
    });
    assert.equal(error.rule, 'frontend-layers');
    assert.equal(error.line, 1);
  });

  it('reports a feature file importing a composition file', () => {
    const rules = rulesOf({
      [`${FRONTEND}/router.ts`]: 'export const router = 1;\n',
      [`${FRONTEND}/plans/f.ts`]: "import { router } from '../router.js';\n",
    });
    assert.deepEqual(rules, ['frontend-layers']);
  });

  it('lets kernel import kernel and composition import a feature', () => {
    assert.deepEqual(
      problems({
        [`${FRONTEND}/components/Card.vue`]: '<script setup lang="ts">\nimport { locale } from "../locale.js";\n</script>\n',
        [`${FRONTEND}/router.ts`]: "import { f } from './plans/f.js';\n",
        [`${FRONTEND}/plans/f.ts`]: 'export const f = 1;\n',
      }, { frontendFeatureEdges: [] }),
      [],
    );
  });

  it('accepts a listed exception and reports a stale one', () => {
    const files = {
      [`${FRONTEND}/components/Card.ts`]: "import { f } from '../plans/f.js';\n",
      [`${FRONTEND}/plans/f.ts`]: 'export const f = 1;\n',
    };
    assert.deepEqual(problems(files, { frontendLayerExceptions: ['components/Card.ts -> plans/f.ts'] }), []);
    const [stale] = problems({ [`${FRONTEND}/plans/f.ts`]: 'export const f = 1;\n' }, { frontendLayerExceptions: ['components/Card.ts -> plans/f.ts'] });
    assert.equal(stale.rule, 'frontend-layers');
    assert.equal(stale.file, 'scripts/layers.mjs');
  });

  it('exempts specs and testing folders', () => {
    assert.deepEqual(
      problems({
        [`${FRONTEND}/router.ts`]: 'export const router = 1;\n',
        [`${FRONTEND}/plans/f.spec.ts`]: "import { router } from '../router.js';\n",
        [`${FRONTEND}/plans/testing/t.ts`]: "import { router } from '../../router.js';\n",
      }),
      [],
    );
  });
});

describe('frontend-feature-edges', () => {
  const files = {
    [`${FRONTEND}/plans/f.ts`]: "import {\n  g,\n} from '../audit/g.js';\n",
    [`${FRONTEND}/audit/g.ts`]: 'export const g = 1;\n',
  };

  it('reports a new edge between feature folders', () => {
    const [error] = problems(files);
    assert.equal(error.rule, 'frontend-feature-edges');
    assert.equal(error.line, 1);
    assert.match(error.message, /plans -> audit/);
  });

  it('accepts a listed edge and reports a stale one', () => {
    assert.deepEqual(problems(files, { frontendFeatureEdges: ['plans -> audit'] }), []);
    const [stale] = problems({ [`${FRONTEND}/plans/f.ts`]: 'export const f = 1;\n' }, { frontendFeatureEdges: ['plans -> audit'] });
    assert.equal(stale.rule, 'frontend-feature-edges');
    assert.equal(stale.file, 'scripts/layers.mjs');
  });

  it('does not count imports of kernel files or within one folder', () => {
    assert.deepEqual(
      problems({
        [`${FRONTEND}/plans/f.ts`]: "import { locale } from '../locale.js';\nimport { h } from './h.js';\n",
        [`${FRONTEND}/plans/h.ts`]: 'export const h = 1;\n',
      }),
      [],
    );
  });
});

describe('modules-registered', () => {
  it('reports a module that nothing imports', () => {
    const [error] = problems({ [`${BACKEND}/rules/rules.module.ts`]: 'export class RulesModule {}\n' });
    assert.equal(error.rule, 'modules-registered');
    assert.equal(error.file, `${BACKEND}/rules/rules.module.ts`);
  });

  it('reports two modules that import only each other', () => {
    const errors = problems(
      {
        [`${BACKEND}/a/a.module.ts`]: "import { BModule } from '../b/b.module.js';\nexport class AModule {}\n",
        [`${BACKEND}/b/b.module.ts`]: "import { AModule } from '../a/a.module.js';\nexport class BModule {}\n",
      },
      { backendEdges: ['a -> b', 'b -> a'] },
    );
    assert.deepEqual(errors.map((error) => [error.rule, error.file]), [
      ['modules-registered', `${BACKEND}/a/a.module.ts`],
      ['modules-registered', `${BACKEND}/b/b.module.ts`],
    ]);
  });

  it('accepts a module imported by another module', () => {
    assert.deepEqual(
      problems(
        {
          [`${BACKEND}/rules/rules.module.ts`]: 'export class RulesModule {}\n',
          [`${BACKEND}/health/health.module.ts`]: "import { RulesModule } from '../rules/rules.module.js';\nexport class HealthModule {}\n",
        },
        { backendEdges: ['health -> rules'] },
      ),
      [],
    );
  });
});

describe('module-index', () => {
  it('reports a registered module whose folder is not in the section 4 table', () => {
    const [error] = problems({
      [`${BACKEND}/users/users.module.ts`]: 'export class UsersModule {}\n',
      [`${BACKEND}/features.ts`]:
        "import { HealthModule } from './health/health.module.js';\nimport { UsersModule } from './users/users.module.js';\nexport const FEATURE_MODULES = [HealthModule, UsersModule];\n",
    });
    assert.equal(error.rule, 'module-index');
    assert.match(error.message, /users\//);
  });

  it('accepts a table that names every folder', () => {
    assert.deepEqual(problems({}), []);
  });
});
