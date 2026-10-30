import { Queryable } from '../src/account/account-export.js';

// Schema rules that keep account export and purge complete (AGENTS.md, ADR 0004),
// read from the catalog so they cover every foreign key, composite or not.
// "Owned" tables are users' cascade closure: deleting a user deletes their rows.
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

/**
 * Foreign keys from another table to users with the wrong ON DELETE (AGENTS.md rule).
 * A key with user_id among its columns owns the row: it must CASCADE, so the purge
 * deletes the student's rows. Any other key (reviewed_by, viewer_id) points at
 * someone else's row: CASCADE or SET NULL, so purging that user never blocks and
 * SET NULL keeps the owner's row. NO ACTION, RESTRICT and SET DEFAULT fail.
 */
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

/**
 * Foreign keys into users or an owned table that make the purge's DELETE fail:
 * NO ACTION or RESTRICT, or SET NULL on a NOT NULL column. Catches grandchild
 * tables (plan_items -> plans -> users) and self-references, which the direct
 * check can't see.
 */
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

/**
 * Owned tables without their own user_id key to users(id): the purge deletes
 * their rows but the export, which reads only user_id, would leave them out.
 * AGENTS.md: reference the user from every table as user_id.
 */
export async function ownedButNotExported(db: Queryable): Promise<string[]> {
  const rows: { name: string }[] = await db.query(`${OWNED}
    SELECT ${name('o.relid')} AS name FROM owned o
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.conrelid = o.relid AND c.confrelid = 'users'::regclass
        AND cardinality(c.conkey) = 1 AND a.attname = 'user_id'
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'id')]
    )
    ORDER BY 1`);
  return rows.map((r) => r.name);
}
