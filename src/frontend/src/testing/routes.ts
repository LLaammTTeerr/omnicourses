import type { RouteRecordRaw } from 'vue-router';
import { routes } from '../router.js';

function chunksOf(records: readonly RouteRecordRaw[]): Promise<unknown>[] {
  return records.flatMap((record) => [
    ...(typeof record.component === 'function' ? [(record.component as () => Promise<unknown>)()] : []),
    ...chunksOf(record.children ?? []),
  ]);
}

export async function warmRoutes(): Promise<void> {
  await Promise.all(chunksOf(routes));
}
