#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const includeTests = process.argv.includes('--tests');
const exts = ['.ts', '.vue', '.mts'];
const isTest = (f) => /\.(spec|browser\.spec|e2e-spec)\.ts$/.test(f) || /\/(testing|test)\//.test(f);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(full, out); }
    else if (exts.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}
const files = walk(root).filter((f) => includeTests || !isTest(f));
const set = new Set(files);
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  const cands = [base, base.replace(/\.js$/, '.ts'), base.replace(/\.mjs$/, '.mts'), base + '.ts', base + '.vue', path.join(base, 'index.ts')];
  for (const c of cands) if (set.has(c)) return c;
  return undefined;
}
const rel = (f) => path.relative(root, f);
const top = (f) => { const r = rel(f); return r.includes('/') ? r.split('/')[0] : '(root)'; };
const edges = [];
const unresolved = [];
const re = /(?:^|\n)[ \t]*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"\n]+)['"]|import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    const spec = m[3] ?? m[4];
    const typeOnly = Boolean(m[2]);
    const dynamic = Boolean(m[4]);
    const to = resolve(f, spec);
    if (to === undefined) { if (!/\.(css|json|svg|png|md)(\?.*)?$/.test(spec)) unresolved.push(rel(f) + ' -> ' + spec); continue; }
    if (to === null) continue;
    edges.push({ from: f, to, typeOnly, dynamic });
  }
}
const adj = new Map(files.map((f) => [f, new Set()]));
for (const e of edges) if (!e.typeOnly) adj.get(e.from).add(e.to);
function sccs(nodes, adjOf) {
  let idx = 0; const stack = []; const on = new Set(); const index = new Map(); const low = new Map(); const out = [];
  const strong = (v) => {
    index.set(v, idx); low.set(v, idx); idx++; stack.push(v); on.add(v);
    for (const w of adjOf(v)) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) { const comp = []; let w; do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v); if (comp.length > 1) out.push(comp); }
  };
  for (const v of nodes) if (!index.has(v)) strong(v);
  return out;
}
const fileCycles = sccs(files, (v) => adj.get(v) ?? []).map((c) => c.map(rel).sort());
const folderEdges = new Map();
for (const e of edges) {
  const a = top(e.from), b = top(e.to);
  if (a === b) continue;
  const k = a + ' -> ' + b;
  const cur = folderEdges.get(k) ?? { value: 0, type: 0, examples: [] };
  if (e.typeOnly) cur.type++; else cur.value++;
  if (cur.examples.length < 3) cur.examples.push(rel(e.from) + ' -> ' + rel(e.to));
  folderEdges.set(k, cur);
}
const folders = [...new Set(files.map(top))].sort();
const fAdj = new Map(folders.map((f) => [f, new Set()]));
for (const [k, v] of folderEdges) { const [a, b] = k.split(' -> '); if (v.value > 0) fAdj.get(a).add(b); }
const folderCycles = sccs(folders, (v) => fAdj.get(v) ?? []).map((c) => c.sort());
const fanIn = new Map(); const fanOut = new Map(); const crossIn = new Map();
for (const e of edges) {
  fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
  fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
  if (top(e.from) !== top(e.to)) { const s = crossIn.get(e.to) ?? new Set(); s.add(top(e.from)); crossIn.set(e.to, s); }
}
const topN = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([f, c]) => c + ' ' + rel(f));
const loc = (f) => fs.readFileSync(f, 'utf8').split('\n').length;
const folderStats = folders.map((d) => {
  const fs_ = files.filter((f) => top(f) === d);
  const deps = [...(fAdj.get(d) ?? [])].sort();
  const usedBy = folders.filter((o) => fAdj.get(o)?.has(d));
  const exported = fs_.filter((f) => crossIn.has(f)).length;
  return { folder: d, files: fs_.length, loc: fs_.reduce((s, f) => s + loc(f), 0), dependsOn: deps, usedBy, filesImportedFromOutside: exported };
});
console.log(JSON.stringify({
  root: process.argv[2], files: files.length, edges: edges.length,
  folderStats, folderCycles, fileCycles,
  folderEdges: [...folderEdges.entries()].sort().map(([k, v]) => ({ edge: k, value: v.value, type: v.type, examples: v.examples })),
  topFanIn: topN(fanIn, 30), topFanOut: topN(fanOut, 30),
  mostCrossImported: [...crossIn.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 30).map(([f, s]) => s.size + ' ' + rel(f) + ' <- ' + [...s].sort().join(',')),
  biggest: files.map((f) => [loc(f), rel(f)]).sort((a, b) => b[0] - a[0]).slice(0, 30).map((x) => x.join(' ')),
  unresolved: unresolved.slice(0, 20),
}, null, 1));
