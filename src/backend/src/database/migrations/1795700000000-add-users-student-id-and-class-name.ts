import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersStudentIdAndClassName1795700000000 implements MigrationInterface {
  name = 'AddUsersStudentIdAndClassName1795700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "student_id" varchar(8), ADD COLUMN "class_name" varchar(32)`);
    await q.query(`ALTER TABLE "users" ADD CONSTRAINT "ck_users_student_id" CHECK ("student_id" ~ '^[0-9]{8}$')`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_student_id"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "class_name", DROP COLUMN "student_id"`);
  }
}
