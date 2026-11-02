// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script, runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));

describe('PA2 clickable prototypes', () => {
  it('loads every page script without missing local assets or syntax errors', () => {
    for (const name of readdirSync(root).filter((name) => name.endsWith('.html'))) {
      const html = readFileSync(join(root, name), 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const src = /src="([^"]+)"/.exec(match[1]);
        const script = src ? join(root, src[1]) : null;
        if (script) expect(existsSync(script), `${name}: ${src![1]}`).toBe(true);
        expect(() => new Script(script ? readFileSync(script, 'utf8') : match[2], { filename: name })).not.toThrow();
      }
    }
  });

  it('keeps a failed sitting visible after the course is passed on a retake', () => {
    const context = { window: {} as { OC?: any } };
    runInNewContext(readFileSync(join(root, 'assets/data.js'), 'utf8'), context);
    const data = context.window.OC!;
    const sittings = data.attempts.filter((attempt: any) => attempt.c.code === 'MTH252');
    expect(sittings.map((attempt: any) => [attempt.term, attempt.grade, attempt.failed])).toEqual([
      ['2024-2', 4.3, true],
      ['2025-1', 7, false],
    ]);
    expect(data.history.find((entry: any) => entry.term.id === '2024-2').failedCodes).toContain('MTH252');
    expect(data.history.find((entry: any) => entry.term.id === '2025-1').failedCodes).not.toContain('MTH252');
  });
});
