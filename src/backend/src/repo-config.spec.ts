import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Security rules for the repository's own config files (issue #28). Read as
// text: the rules are about lines, and no YAML parser is a direct dependency.
const ROOT = join(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

describe('compose.yaml', () => {
  // The database has a known password: reachable from this machine only.
  it('publishes ports on the loopback address only', () => {
    const ports = [...read('compose.yaml').matchAll(/^\s*-\s*"?([\d.:]+)"?\s*$/gm)].map((m) => m[1]!);
    expect(ports.length).toBeGreaterThan(0);
    for (const port of ports) expect(port).toMatch(/^127\.0\.0\.1:\d+:\d+$/);
  });
});
