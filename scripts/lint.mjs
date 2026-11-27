#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as defaultLayers from './layers.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const BACKEND_SRC = 'src/backend/src';
const BACKEND_TEST = 'src/backend/test';
const FRONTEND_SRC = 'src/frontend/src';
const FRONTEND_API_FILE = 'src/frontend/src/api.ts';
const FEATURES_FILE = 'src/backend/src/features.ts';
const APP_MODULE_FILE = 'src/backend/src/app.module.ts';
const ARCHITECTURE_DOC = 'docs/analysis-and-design/architecture.md';
const LAYERS_FILE = 'scripts/layers.mjs';
const ROOT_FOLDER = '(root)';
const EDGE_SEPARATOR = ' -> ';
const MODULE_SUFFIX = '.module.ts';
const TEST_FILE_PATTERN = /\.(?:spec|browser\.spec|e2e-spec)\.ts$/;
const TESTING_FOLDER_PATTERN = /(?:^|\/)testing\//;
const MODULE_SECTION_PATTERN = /^## 4\. [\s\S]*?(?=^## 5\. )/m;

const KERNEL = 'kernel';
const COMPOSITION = 'composition';
const FEATURE = 'feature';

const UNSCOPED_STYLE_ALLOWLIST = new Set(['src/frontend/src/App.vue']);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dir, extensions, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, extensions, out);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function preserveLinesMask(segment) {
  return segment.replace(/[^\n]/g, ' ');
}

const QUOTES = new Set(["'", '"', '`']);

function blankedRun(source, start, end) {
  return preserveLinesMask(source.slice(start, end));
}

function stringEnd(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') i++;
    else if (source[i] === '\n' && quote !== '`') return i;
    i++;
  }
  return Math.min(i + 1, source.length);
}

function commentEnd(source, start, html) {
  const openers = [
    ['/*', '*/'],
    ['//', '\n'],
    ...(html ? [['<!--', '-->']] : []),
  ];
  for (const [open, close] of openers) {
    if (!source.startsWith(open, start)) continue;
    const found = source.indexOf(close, start + open.length);
    if (found < 0) return source.length;
    return close === '\n' ? found : found + close.length;
  }
  return -1;
}

function maskComments(source, { html = false } = {}) {
  let masked = '';
  let i = 0;
  while (i < source.length) {
    const commentStop = commentEnd(source, i, html);
    const next = commentStop >= 0 ? commentStop : QUOTES.has(source[i]) ? stringEnd(source, i) : i + 1;
    masked += commentStop >= 0 ? blankedRun(source, i, next) : source.slice(i, next);
    i = next;
  }
  return masked;
}

function maskTagBlocks(source, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
  return source.replace(re, preserveLinesMask);
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function checkTsSuppressionsAndDebugger(rootDir, files, addError) {
  for (const fullPath of files) {
    const relPath = toPosix(path.relative(rootDir, fullPath));
    const raw = fs.readFileSync(fullPath, 'utf8');
    const isVue = relPath.endsWith('.vue');

    for (const match of raw.matchAll(/@ts-(?:ignore|nocheck)\b/g)) {
      addError(
        relPath,
        lineAt(raw, match.index),
        'no-ts-ignore',
        `Forbidden TypeScript suppression "${match[0]}"`,
      );
    }

    const codeOnly = maskComments(isVue ? maskTagBlocks(raw, 'style') : raw, { html: isVue });
    for (const match of codeOnly.matchAll(/(?:\bdebugger\s*;|\bdebugger\b(?=\s*(?:$|\n)))/gm)) {
      addError(relPath, lineAt(raw, match.index), 'no-debugger', 'Forbidden `debugger` statement');
    }
  }
}

function checkDirectProcessEnv(rootDir, backendFiles, addError) {
  for (const fullPath of backendFiles) {
    const relPath = toPosix(path.relative(rootDir, fullPath));
    if (relPath === 'src/backend/src/config/env.ts' || relPath.endsWith('.spec.ts')) {
      continue;
    }
    const raw = fs.readFileSync(fullPath, 'utf8');
    const codeOnly = maskComments(raw);
    for (const match of codeOnly.matchAll(/\bprocess\.env\b/g)) {
      addError(
        relPath,
        lineAt(raw, match.index),
        'no-direct-process-env',
        'Read settings through `src/config/env.ts` instead of `process.env` (AGENTS.md)',
      );
    }
  }
}

function isProductionFile(relPath) {
  return !TEST_FILE_PATTERN.test(relPath) && !TESTING_FOLDER_PATTERN.test(relPath);
}

function checkFetchOutsideApi(rootDir, frontendFiles, addError) {
  for (const fullPath of frontendFiles) {
    const relPath = toPosix(path.relative(rootDir, fullPath));
    if (relPath === FRONTEND_API_FILE || !isProductionFile(relPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    const isVue = relPath.endsWith('.vue');
    const code = maskComments(isVue ? maskTagBlocks(raw, 'style') : raw, { html: isVue });
    for (const match of code.matchAll(/(?<!\bfunction\s+)(?<![\w$])fetch\s*\(/g)) {
      addError(
        relPath,
        lineAt(raw, match.index),
        'no-fetch-outside-api',
        'Move HTTP calls to `src/frontend/src/api.ts` instead of calling `fetch(` in another frontend file (AGENTS.md)',
      );
    }
  }
}

function checkVueSfcRules(rootDir, frontendFiles, addError) {
  for (const fullPath of frontendFiles) {
    if (!fullPath.endsWith('.vue')) continue;
    const relPath = toPosix(path.relative(rootDir, fullPath));
    const raw = fs.readFileSync(fullPath, 'utf8');

    if (!UNSCOPED_STYLE_ALLOWLIST.has(relPath)) {
      const withoutScriptOrHtmlComments = maskTagBlocks(
        raw.replace(/<!--[\s\S]*?-->/g, preserveLinesMask),
        'script',
      );
      for (const match of withoutScriptOrHtmlComments.matchAll(/<style\b([^>]*)>/gi)) {
        if (!/\bscoped\b/.test(match[1])) {
          addError(
            relPath,
            lineAt(raw, match.index),
            'vue-style-scoped',
            'Vue SFC `<style>` blocks must be `<style scoped>`',
          );
        }
      }
    }
  }
}

function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const digest = createHash('sha256').update(match[1], 'utf8').digest('base64');
    hashes.push(`sha256-${digest}`);
  }
  return hashes;
}

function checkNginxCspScriptHashes(rootDir, addError) {
  const indexHtmlRel = 'src/frontend/index.html';
  const distHtmlRel = 'src/frontend/dist/index.html';
  const nginxConfRel = 'deploy/server/nginx-site.conf';
  const indexHtmlPath = path.join(rootDir, indexHtmlRel);
  const distHtmlPath = path.join(rootDir, distHtmlRel);
  const nginxConfPath = path.join(rootDir, nginxConfRel);

  if (!fs.existsSync(indexHtmlPath)) {
    addError(indexHtmlRel, 1, 'csp-script-hash', `Missing ${indexHtmlRel}`);
    return;
  }
  if (!fs.existsSync(nginxConfPath)) {
    addError(nginxConfRel, 1, 'csp-script-hash', `Missing ${nginxConfRel}`);
    return;
  }

  const nginx = fs.readFileSync(nginxConfPath, 'utf8');
  const cspMatch = nginx.match(/add_header\s+Content-Security-Policy\s+"([^"]+)"/);
  if (!cspMatch) {
    addError(
      nginxConfRel,
      1,
      'csp-script-hash',
      'Missing `Content-Security-Policy` header in nginx-site.conf',
    );
    return;
  }

  const cspLine = lineAt(nginx, cspMatch.index);
  const scriptSrcMatch = cspMatch[1].match(/(?:^|;\s*)script-src\s+([^;]+)/);
  if (!scriptSrcMatch) {
    addError(
      nginxConfRel,
      cspLine,
      'csp-script-hash',
      'Missing `script-src` directive in `Content-Security-Policy`',
    );
    return;
  }

  const configuredKey = [...scriptSrcMatch[1].matchAll(/'(sha256-[^']+)'/g)]
    .map((m) => m[1])
    .join(', ');

  const targets = [
    [indexHtmlRel, indexHtmlPath],
    ...(fs.existsSync(distHtmlPath) ? [[distHtmlRel, distHtmlPath]] : []),
  ];
  for (const [rel, full] of targets) {
    const expectedKey = inlineScriptHashes(fs.readFileSync(full, 'utf8')).join(', ');
    if (expectedKey !== configuredKey) {
      addError(
        nginxConfRel,
        cspLine,
        'csp-script-hash',
        `CSP script-src hash mismatch: nginx-site.conf has [${configuredKey || 'none'}], expected [${expectedKey || 'none'}] from ${rel}`,
      );
    }
  }
}

function isFile(candidate) {
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
}

function resolveImportTarget(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.vue'),
    `${base}.ts`,
    `${base}.vue`,
    path.join(base, 'index.ts'),
  ];
  return candidates.find(isFile) ?? null;
}

function keepOnlyScriptBlocks(maskedSource) {
  const kept = preserveLinesMask(maskedSource).split('');
  for (const match of maskedSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const start = match.index + match[0].indexOf(match[1], match[0].indexOf('>') + 1);
    kept.splice(start, match[1].length, ...match[1]);
  }
  return kept.join('');
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+[\w$*{},\s]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export function importsOf(fullPath) {
  const raw = fs.readFileSync(fullPath, 'utf8');
  const isVue = fullPath.endsWith('.vue');
  const masked = maskComments(raw, { html: isVue });
  const code = isVue ? keepOnlyScriptBlocks(masked) : masked;
  const found = new Map();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) {
      const specifier = match[1];
      const key = `${match.index}:${specifier}`;
      if (!found.has(key)) {
        found.set(key, {
          specifier,
          line: lineAt(raw, match.index),
          target: resolveImportTarget(fullPath, specifier),
        });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.line - b.line);
}

function relativeImports(rootDir, files) {
  return files.flatMap((fullPath) => {
    const file = toPosix(path.relative(rootDir, fullPath));
    return importsOf(fullPath)
      .filter((entry) => entry.target !== null)
      .map((entry) => ({
        file,
        line: entry.line,
        target: toPosix(path.relative(rootDir, entry.target)),
      }));
  });
}

function topFolder(relPath, srcRoot) {
  const inside = relPath.slice(srcRoot.length + 1);
  return inside.includes('/') ? inside.split('/')[0] : ROOT_FOLDER;
}

function backendFolderImports(rootDir, backendFiles) {
  const prefix = `${BACKEND_SRC}/`;
  return relativeImports(rootDir, backendFiles)
    .filter((entry) => isProductionFile(entry.file) && entry.target.startsWith(prefix))
    .map((entry) => ({
      ...entry,
      from: topFolder(entry.file, BACKEND_SRC),
      to: topFolder(entry.target, BACKEND_SRC),
    }))
    .filter((entry) => entry.from !== ROOT_FOLDER && entry.from !== entry.to);
}

function layerEntryMatches(entries, relPath) {
  return entries.some((entry) => (entry.endsWith('/') ? relPath.startsWith(entry) : relPath === entry));
}

function frontendLayerOf(relPath, layers) {
  if (!isProductionFile(relPath)) return null;
  if (layerEntryMatches(layers.frontendKernel, relPath)) return KERNEL;
  if (layerEntryMatches(layers.frontendComposition, relPath)) return COMPOSITION;
  return FEATURE;
}

function frontendImports(rootDir, frontendFiles, layers) {
  const prefix = `${FRONTEND_SRC}/`;
  return relativeImports(rootDir, frontendFiles)
    .filter((entry) => entry.target.startsWith(prefix))
    .map((entry) => {
      const from = entry.file.slice(prefix.length);
      const to = entry.target.slice(prefix.length);
      return { ...entry, from, to, fromLayer: frontendLayerOf(from, layers), toLayer: frontendLayerOf(to, layers) };
    })
    .filter((entry) => entry.fromLayer !== null && entry.toLayer !== null);
}

function featureFolder(relPath) {
  return relPath.includes('/') ? relPath.split('/')[0] : ROOT_FOLDER;
}

function entryLineLocator(rootDir) {
  const layersPath = path.join(rootDir, LAYERS_FILE);
  const source = fs.existsSync(layersPath) ? fs.readFileSync(layersPath, 'utf8') : null;
  return (entry) => {
    const index = source === null ? -1 : source.indexOf(`'${entry}'`);
    return index < 0 ? 1 : lineAt(source, index);
  };
}

function checkEdgeRatchet({ rule, rootDir, allowed, imports, edgeOf, addError }) {
  const entryLine = entryLineLocator(rootDir);
  const seen = new Set();
  for (const entry of imports) {
    const edge = edgeOf(entry);
    seen.add(edge);
    if (allowed.includes(edge)) continue;
    addError(
      entry.file,
      entry.line,
      rule,
      `New dependency "${edge}": add the edge to ${LAYERS_FILE} on purpose, or move the code`,
    );
  }
  for (const edge of allowed) {
    if (seen.has(edge)) continue;
    addError(
      LAYERS_FILE,
      entryLine(edge),
      rule,
      `Listed dependency "${edge}" no longer exists: remove it from ${LAYERS_FILE}`,
    );
  }
}

function checkBackendImportDirection(rootDir, backendFiles, layers, addError) {
  checkEdgeRatchet({
    rule: 'backend-import-direction',
    rootDir,
    allowed: layers.backendEdges,
    imports: backendFolderImports(rootDir, backendFiles),
    edgeOf: (entry) => `${entry.from}${EDGE_SEPARATOR}${entry.to}`,
    addError,
  });
}

function layerViolation(entry) {
  if (entry.fromLayer === KERNEL && entry.toLayer !== KERNEL) {
    return 'a kernel file may import only kernel files';
  }
  if (entry.fromLayer === FEATURE && entry.toLayer === COMPOSITION) {
    return 'a feature file must not import a composition file';
  }
  return null;
}

function checkFrontendLayers(rootDir, imports, layers, addError) {
  const entryLine = entryLineLocator(rootDir);
  const seen = new Set();
  for (const entry of imports) {
    const reason = layerViolation(entry);
    if (reason === null) continue;
    const edge = `${entry.from}${EDGE_SEPARATOR}${entry.to}`;
    seen.add(edge);
    if (layers.frontendLayerExceptions.includes(edge)) continue;
    addError(
      entry.file,
      entry.line,
      'frontend-layers',
      `Imports ${entry.to} (${entry.toLayer}) from a ${entry.fromLayer} file: ${reason}. Move the code, or change the layer lists in ${LAYERS_FILE} on purpose`,
    );
  }
  for (const edge of layers.frontendLayerExceptions) {
    if (seen.has(edge)) continue;
    addError(
      LAYERS_FILE,
      entryLine(edge),
      'frontend-layers',
      `Listed exception "${edge}" no longer exists: remove it from ${LAYERS_FILE}`,
    );
  }
}

function checkFrontendFeatureEdges(rootDir, imports, layers, addError) {
  checkEdgeRatchet({
    rule: 'frontend-feature-edges',
    rootDir,
    allowed: layers.frontendFeatureEdges,
    imports: imports
      .filter((entry) => entry.fromLayer === FEATURE && entry.toLayer === FEATURE)
      .filter((entry) => featureFolder(entry.from) !== featureFolder(entry.to)),
    edgeOf: (entry) => `${featureFolder(entry.from)}${EDGE_SEPARATOR}${featureFolder(entry.to)}`,
    addError,
  });
}

function reachableModules(rootDir, moduleFiles) {
  const known = new Set(moduleFiles);
  const reached = new Set();
  const pending = [FEATURES_FILE, APP_MODULE_FILE];
  while (pending.length > 0) {
    const fullPath = path.join(rootDir, pending.pop());
    if (!isFile(fullPath)) continue;
    for (const entry of importsOf(fullPath)) {
      if (entry.target === null) continue;
      const relPath = toPosix(path.relative(rootDir, entry.target));
      if (!known.has(relPath) || reached.has(relPath)) continue;
      reached.add(relPath);
      pending.push(relPath);
    }
  }
  return reached;
}

function checkIdentifierHomes(rootDir, backendFiles, layers, addError) {
  for (const fullPath of backendFiles) {
    const relPath = toPosix(path.relative(rootDir, fullPath));
    if (!isProductionFile(relPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    const code = maskComments(raw);
    for (const { identifiers, folders } of layers.identifierHomes) {
      if (folders.some((folder) => relPath.startsWith(folder))) continue;
      for (const identifier of identifiers) {
        for (const match of code.matchAll(new RegExp(`\\b${identifier}\\b`, 'g'))) {
          addError(
            relPath,
            lineAt(raw, match.index),
            'identifier-home',
            `"${identifier}" may appear only under ${folders.join(' or ')}: use what that folder exports, or change ${LAYERS_FILE} on purpose`,
          );
        }
      }
    }
  }
}

function checkModulesRegistered(rootDir, backendFiles, addError) {
  const moduleFiles = backendFiles
    .map((fullPath) => toPosix(path.relative(rootDir, fullPath)))
    .filter((relPath) => relPath.endsWith(MODULE_SUFFIX) && relPath !== APP_MODULE_FILE);
  const reached = reachableModules(rootDir, moduleFiles);
  for (const relPath of moduleFiles) {
    if (reached.has(relPath)) continue;
    addError(
      relPath,
      1,
      'modules-registered',
      `Module is not reachable from ${FEATURES_FILE} or ${APP_MODULE_FILE} through module imports: register it in ${FEATURES_FILE}, import it from a registered module, or delete it`,
    );
  }
}

function checkModuleIndex(rootDir, addError) {
  const featuresPath = path.join(rootDir, FEATURES_FILE);
  const docPath = path.join(rootDir, ARCHITECTURE_DOC);
  if (!isFile(featuresPath) || !isFile(docPath)) return;
  const section = fs.readFileSync(docPath, 'utf8').match(MODULE_SECTION_PATTERN)?.[0] ?? '';
  const folders = importsOf(featuresPath)
    .filter((entry) => entry.target !== null && entry.target.endsWith(MODULE_SUFFIX))
    .map((entry) => topFolder(toPosix(path.relative(rootDir, entry.target)), BACKEND_SRC));
  for (const folder of new Set(folders)) {
    if (new RegExp(`\\|\\s*\\\`${folder}/\\\`\\s*\\|`).test(section)) continue;
    addError(
      ARCHITECTURE_DOC,
      1,
      'module-index',
      `Module folder "${folder}/" is listed in ${FEATURES_FILE} but missing from the module table in section 4: add a row for it`,
    );
  }
}

export function observedLayerData(rootDir, layers) {
  const backendFiles = walkFiles(path.join(rootDir, BACKEND_SRC), ['.ts']);
  const frontendFiles = walkFiles(path.join(rootDir, FRONTEND_SRC), ['.ts', '.vue']);
  const graph = frontendImports(rootDir, frontendFiles, layers);
  const edges = (entries, edgeOf) => [...new Set(entries.map(edgeOf))].sort();
  return {
    backendEdges: edges(backendFolderImports(rootDir, backendFiles), (e) => `${e.from}${EDGE_SEPARATOR}${e.to}`),
    frontendLayerExceptions: edges(graph.filter((e) => layerViolation(e) !== null), (e) => `${e.from}${EDGE_SEPARATOR}${e.to}`),
    frontendFeatureEdges: edges(
      graph.filter((e) => e.fromLayer === FEATURE && e.toLayer === FEATURE && featureFolder(e.from) !== featureFolder(e.to)),
      (e) => `${featureFolder(e.from)}${EDGE_SEPARATOR}${featureFolder(e.to)}`,
    ),
  };
}

export function lintWorkspace(rootDir = ROOT, layers = defaultLayers) {
  const errors = [];
  const addError = (relPath, line, rule, message) => {
    errors.push({ file: relPath, line, rule, message });
  };

  const backendFiles = walkFiles(path.join(rootDir, BACKEND_SRC), ['.ts']);
  const backendTestFiles = walkFiles(path.join(rootDir, BACKEND_TEST), ['.ts']);
  const frontendFiles = walkFiles(path.join(rootDir, FRONTEND_SRC), ['.ts', '.vue']);

  checkTsSuppressionsAndDebugger(rootDir, [...backendFiles, ...backendTestFiles, ...frontendFiles], addError);
  checkDirectProcessEnv(rootDir, [...backendFiles, ...backendTestFiles], addError);
  checkFetchOutsideApi(rootDir, frontendFiles, addError);
  checkVueSfcRules(rootDir, frontendFiles, addError);
  checkBackendImportDirection(rootDir, backendFiles, layers, addError);
  checkIdentifierHomes(rootDir, backendFiles, layers, addError);
  const frontendGraph = frontendImports(rootDir, frontendFiles, layers);
  checkFrontendLayers(rootDir, frontendGraph, layers, addError);
  checkFrontendFeatureEdges(rootDir, frontendGraph, layers, addError);
  checkModulesRegistered(rootDir, backendFiles, addError);
  checkModuleIndex(rootDir, addError);
  checkNginxCspScriptHashes(rootDir, addError);

  return errors;
}

const isMain =
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename);

if (isMain) {
  const errors = lintWorkspace(ROOT);
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`${err.file}:${err.line}: [${err.rule}] ${err.message}`);
    }
    console.error(`\nLint failed with ${errors.length} problem(s).`);
    process.exit(1);
  }
  console.log('Lint passed.');
}
