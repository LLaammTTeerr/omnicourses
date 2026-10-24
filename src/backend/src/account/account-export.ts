import { DataSource } from 'typeorm';

// The export reads every table with a foreign key to users.id from the catalog
// (ADR 0004), so a module that adds a user table is exported without anyone
// remembering to. These columns are never exported: credentials and other
// systems' identifiers. Over-dropping is the safe direction.
const SECRET_COLUMN = /(^|_)(hash|token|secret|password|sub|key)($|_)/;

export const isSecretColumn = (name: string): boolean => SECRET_COLUMN.test(name);

export function withoutSecrets(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([column]) => !isSecretColumn(column)));
}

export interface UserTable {
  table: string;
  column: string;
  /** Schema-qualified and quoted by PostgreSQL itself, safe to put in SQL. */
  qualifiedTable: string;
  quotedColumn: string;
  /** pg_constraint.confdeltype: 'c' = ON DELETE CASCADE. */
  onDelete: string;
}

export async function findUserTables(db: DataSource): Promise<UserTable[]> {
  return db.query(`
    SELECT cl.relname AS "table",
           a.attname AS "column",
           format('%I.%I', n.nspname, cl.relname) AS "qualifiedTable",
           quote_ident(a.attname) AS "quotedColumn",
           c.confdeltype AS "onDelete"
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass AND cardinality(c.conkey) = 1
    ORDER BY cl.relname, a.attname`);
}
