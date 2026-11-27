#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

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

function maskComments(source, { html = false } = {}) {
  let masked = source;
  if (html) {
    masked = masked.replace(/<!--[\s\S]*?-->/g, preserveLinesMask);
  }
  masked = masked.replace(/\/\*[\s\S]*?\*\//g, preserveLinesMask);
  masked = masked.replace(/^[ \t]*\/\/.*$/gm, preserveLinesMask);
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

function checkVueSfcRules(rootDir, frontendFiles, addError) {
  for (const fullPath of frontendFiles) {
    if (!fullPath.endsWith('.vue')) continue;
    const relPath = toPosix(path.relative(rootDir, fullPath));
    const raw = fs.readFileSync(fullPath, 'utf8');

    const withoutStyle = maskComments(maskTagBlocks(raw, 'style'), { html: true });
    for (const match of withoutStyle.matchAll(/(?<!\bfunction\s+)(?<![\w$])fetch\s*\(/g)) {
      addError(
        relPath,
        lineAt(raw, match.index),
        'no-vue-fetch',
        'Move HTTP calls to `src/frontend/src/api.ts` (or a sibling API module) instead of calling `fetch(` in Vue components (AGENTS.md)',
      );
    }

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

function checkNginxCspScriptHashes(rootDir, addError) {
  const indexHtmlRel = 'src/frontend/index.html';
  const nginxConfRel = 'deploy/server/nginx-site.conf';
  const indexHtmlPath = path.join(rootDir, indexHtmlRel);
  const nginxConfPath = path.join(rootDir, nginxConfRel);

  if (!fs.existsSync(indexHtmlPath)) {
    addError(indexHtmlRel, 1, 'csp-script-hash', `Missing ${indexHtmlRel}`);
    return;
  }
  if (!fs.existsSync(nginxConfPath)) {
    addError(nginxConfRel, 1, 'csp-script-hash', `Missing ${nginxConfRel}`);
    return;
  }

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const nginx = fs.readFileSync(nginxConfPath, 'utf8');

  const expectedHashes = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const digest = createHash('sha256').update(match[1], 'utf8').digest('base64');
    expectedHashes.push(`sha256-${digest}`);
  }

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

  const configuredHashes = [...scriptSrcMatch[1].matchAll(/'(sha256-[^']+)'/g)].map((m) => m[1]);
  const expectedKey = expectedHashes.join(', ');
  const configuredKey = configuredHashes.join(', ');
  if (expectedKey !== configuredKey) {
    addError(
      nginxConfRel,
      cspLine,
      'csp-script-hash',
      `CSP script-src hash mismatch: nginx-site.conf has [${configuredKey || 'none'}], expected [${expectedKey || 'none'}] from ${indexHtmlRel}`,
    );
  }
}

export function lintWorkspace(rootDir = ROOT) {
  const errors = [];
  const addError = (relPath, line, rule, message) => {
    errors.push({ file: relPath, line, rule, message });
  };

  const backendFiles = walkFiles(path.join(rootDir, 'src/backend/src'), ['.ts']);
  const frontendFiles = walkFiles(path.join(rootDir, 'src/frontend/src'), ['.ts', '.vue']);

  checkTsSuppressionsAndDebugger(rootDir, [...backendFiles, ...frontendFiles], addError);
  checkDirectProcessEnv(rootDir, backendFiles, addError);
  checkVueSfcRules(rootDir, frontendFiles, addError);
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
