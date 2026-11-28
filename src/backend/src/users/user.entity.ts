import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export const EMAIL_MAX_LENGTH = 254;
export const DISPLAY_NAME_MAX_LENGTH = 100;
export const STUDENT_ID_LENGTH = 8;
export const CLASS_NAME_MAX_LENGTH = 32;

@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Unique('uq_users_google_sub', ['googleSub'])
@Check('ck_users_email_lowercase', `"email" = lower("email")`)
@Check('ck_users_has_credential', `"password_hash" IS NOT NULL OR "google_sub" IS NOT NULL`)
@Check('ck_users_deletion_pending', `("deletion_requested_at" IS NULL) = ("purge_after" IS NULL)`)
@Check('ck_users_student_id', `"student_id" ~ '^[0-9]{8}$'`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH })
  email!: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: DISPLAY_NAME_MAX_LENGTH })
  displayName!: string;

  @Column({ name: 'student_id', type: 'varchar', length: STUDENT_ID_LENGTH, nullable: true })
  studentId!: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: CLASS_NAME_MAX_LENGTH, nullable: true })
  className!: string | null;

  @Column({ name: 'google_sub', type: 'varchar', length: 255, nullable: true })
  googleSub!: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt!: Date;

  @Column({ name: 'deletion_requested_at', type: 'timestamptz', nullable: true })
  deletionRequestedAt!: Date | null;

  @Column({ name: 'purge_after', type: 'timestamptz', nullable: true })
  purgeAfter!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
