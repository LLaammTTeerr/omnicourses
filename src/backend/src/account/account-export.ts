// The export reads every table whose user_id references users.id from the
// catalog (ADR 0004), so a module that adds a user table is exported without
// anyone remembering to. Only the student's own rows (user_id = them): a row
// that merely references them (viewer_id, reviewed_by) belongs to someone
// else. Credential columns are never selected: the rule is the documented
// suffix (AGENTS.md), in snake_case or camelCase (TypeORM names a column
// after its property unless `name` is set).
const SECRET_SUFFIX = /(^|_)(hash|token|secret|key|password|sub)$/;

const snakeCase = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

export const isSecretColumn = (name: string): boolean => SECRET_SUFFIX.test(snakeCase(name));

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;

export const selectList = (columns: string[]): string => columns.filter((c) => !isSecretColumn(c)).map(quoteIdent).join(', ');

export interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<any>;
}

export interface UserTable {
  table: string;
  /** Schema-qualified and quoted by PostgreSQL itself, safe to put in SQL. */
  qualifiedTable: string;
  columns: string[];
}

const COLUMNS_OF = (relid: string) =>
  `ARRAY(SELECT x.attname::text FROM pg_attribute x WHERE x.attrelid = ${relid} AND x.attnum > 0 AND NOT x.attisdropped ORDER BY x.attnum)`;

export async function findUserColumns(db: Queryable): Promise<string[]> {
  const [{ columns }] = await db.query(`SELECT ${COLUMNS_OF(`'users'::regclass`)} AS "columns"`);
  return columns;
}

/**
 * SQL condition on the pg_constraint row `c`: the key is the user_id column
 * alone, referencing users.id. The test schema rules use it too.
 */
export const IS_USER_ID_KEY = (c: string) => `${c}.contype = 'f'
      AND ${c}.confrelid = 'users'::regclass
      AND cardinality(${c}.conkey) = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = ${c}.conrelid AND attnum = ${c}.conkey[1]) = 'user_id'
      AND ${c}.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'id')]`;

/**
 * Every table whose user_id column has a foreign key to users.id. Left out:
 * other columns that reference users (rows owned by someone else), a
 * partition's copy of its parent's key (the parent's SELECT already covers the
 * partition) and a self-reference on users, whose rows are other accounts.
 */
export async function findUserTables(db: Queryable): Promise<UserTable[]> {
  return db.query(`
    SELECT cl.relname AS "table",
           format('%I.%I', n.nspname, cl.relname) AS "qualifiedTable",
           ${COLUMNS_OF('c.conrelid')} AS "columns"
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE ${IS_USER_ID_KEY('c')}
      AND c.conrelid <> 'users'::regclass
      AND c.conparentid = 0
    ORDER BY cl.relname`);
}
