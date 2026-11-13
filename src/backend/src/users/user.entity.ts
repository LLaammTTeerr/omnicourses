import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export const EMAIL_MAX_LENGTH = 254;
export const DISPLAY_NAME_MAX_LENGTH = 100;

@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Unique('uq_users_google_sub', ['googleSub'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Stored lowercased; a CHECK constraint in the migration enforces it.
  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH })
  email!: string;

  // Null for accounts that only sign in with Google.
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: DISPLAY_NAME_MAX_LENGTH })
  displayName!: string;

  @Column({ name: 'google_sub', type: 'varchar', length: 255, nullable: true })
  googleSub!: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  // Privacy NFR: consent recorded at sign-up (Luật 91/2025/QH15).
  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt!: Date;

  // Set by DELETE /users/me; the account is purged after the grace period
  // unless the student signs in again (ADR 0004).
  @Column({ name: 'deletion_requested_at', type: 'timestamptz', nullable: true })
  deletionRequestedAt!: Date | null;

  // The deadline promised to the student when they asked; set and cleared with
  // deletion_requested_at (CHECK), never recomputed from the grace setting.
  @Column({ name: 'purge_after', type: 'timestamptz', nullable: true })
  purgeAfter!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * A deletion was requested and not cancelled (ADR 0004): such an account has no
 * session, and signing in again before the deadline restores it.
 */
export const isPendingDeletion = (user: Pick<User, 'deletionRequestedAt'>): boolean => user.deletionRequestedAt != null;
