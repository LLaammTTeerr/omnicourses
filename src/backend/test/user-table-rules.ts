import { IS_USER_ID_KEY, Queryable } from '../src/account/account-export.js';

const OWNED = `
  WITH RECURSIVE owned(relid) AS (
    SELECT conrelid FROM pg_constraint
    WHERE contype = 'f' AND conparentid = 0 AND confdeltype = 'c'
      AND confrelid = 'users'::regclass AND conrelid <> 'users'::regclass
    UNION
    SELECT c.conrelid FROM pg_constraint c JOIN owned o ON c.confrelid = o.relid
    WHERE c.contype = 'f' AND c.conparentid = 0 AND c.confdeltype = 'c'
  )`;

const name = (relid: string) => `format('%I', ${relid}::regclass::text)`;

export async function wrongDeleteRuleToUsers(db: Queryable): Promise<string[]> {
  const rows: { name: string }[] = await db.query(`
    SELECT ${name('c.conrelid')} || '.' || c.conname AS name FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conparentid = 0 AND c.confrelid = 'users'::regclass
      AND c.conrelid <> 'users'::regclass
      AND CASE WHEN EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attname = 'user_id')
          THEN c.confdeltype <> 'c'
          ELSE c.confdeltype NOT IN ('c', 'n') END
    ORDER BY 1`);
  return rows.map((r) => r.name);
}

export async function purgeBlockers(db: Queryable): Promise<string[]> {
  const rows: { name: string }[] = await db.query(`${OWNED}
    SELECT ${name('c.conrelid')} || '.' || c.conname AS name FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conparentid = 0
      AND (c.confdeltype IN ('a', 'r') OR (c.confdeltype = 'n' AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnotnull
          AND a.attnum = ANY(COALESCE(c.confdelsetcols, c.conkey)))))
      AND (c.confrelid = 'users'::regclass OR c.confrelid IN (SELECT relid FROM owned))
    ORDER BY 1`);
  return rows.map((r) => r.name);
}

export async function ownedButNotExported(db: Queryable): Promise<string[]> {
  const rows: { name: string }[] = await db.query(`${OWNED}
    SELECT ${name('o.relid')} AS name FROM owned o
    WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = o.relid AND ${IS_USER_ID_KEY('c')})
    ORDER BY 1`);
  return rows.map((r) => r.name);
}
