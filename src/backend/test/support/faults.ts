import { DataSource } from 'typeorm';
import { runSuffix } from './admin.js';

export interface RefusedInsert {
  table: string;
  column: string;
  value: string;
}

const quoted = (text: string) => `'${text.replace(/'/g, "''")}'`;

export async function withInsertRefused<T>(db: DataSource, refused: RefusedInsert, work: () => PromiseLike<T>): Promise<T> {
  const name = `zz_refuse_${runSuffix().toLowerCase()}`;
  await db.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF to_jsonb(NEW) ->> TG_ARGV[0] = TG_ARGV[1] THEN
        RAISE EXCEPTION 'synthetic refusal of %', to_jsonb(NEW)::text USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END $$`);
  try {
    await db.query(`CREATE TRIGGER ${name} BEFORE INSERT ON "${refused.table}" FOR EACH ROW EXECUTE FUNCTION ${name}(${quoted(refused.column)}, ${quoted(refused.value)})`);
    return await work();
  } finally {
    await db.query(`DROP FUNCTION ${name}() CASCADE`);
  }
}
