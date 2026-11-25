// Runs a-adm-07.mjs cases one after another, 70 s after the start and 8 s apart, so sign-ins stay under 10 a minute.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [dir, ...cases] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(70000);
for (const c of cases) {
  const r = spawnSync(process.execPath, ['a-adm-07.mjs', c], { cwd: dir, encoding: 'utf8' });
  writeFileSync(`${dir}/a-adm-${c}-output.txt`, r.stdout + r.stderr);
  console.log((r.stdout.match(/^(ADM .*|  (OK|MISMATCH).*|STOPPED.*|All checks OK|\d+ MISMATCH.*)$/gm) ?? []).join('\n'));
  await sleep(8000);
}
