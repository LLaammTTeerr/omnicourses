const SECRET_SUFFIX = /(^|_)(hash|token|secret|key|password|sub|salt|seed)$/;

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
  qualifiedTable: string;
  columns: string[];
}

const COLUMNS_OF = (relid: string) =>
  `ARRAY(SELECT x.attname::text FROM pg_attribute x WHERE x.attrelid = ${relid} AND x.attnum > 0 AND NOT x.attisdropped ORDER BY x.attnum)`;

export async function findUserColumns(db: Queryable): Promise<string[]> {
  const [{ columns }] = await db.query(`SELECT ${COLUMNS_OF(`'users'::regclass`)} AS "columns"`);
  return columns;
}

export const IS_USER_ID_KEY = (constraintAlias: string) => `${constraintAlias}.contype = 'f'
      AND ${constraintAlias}.confrelid = 'users'::regclass
      AND cardinality(${constraintAlias}.conkey) = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = ${constraintAlias}.conrelid AND attnum = ${constraintAlias}.conkey[1]) = 'user_id'
      AND ${constraintAlias}.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'id')]`;

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
