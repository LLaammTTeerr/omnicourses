import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SRC_DIR = join(import.meta.dirname, '..');

export function sourceFiles(suffix: string, dir = SRC_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(suffix, path);
    return entry.name.endsWith(suffix) ? [path] : [];
  });
}
