import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Unique('uq_users_google_sub', ['googleSub'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Always stored lowercased (DTO transform + CHECK constraint).
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  // Null for accounts that only sign in with Google (follow-up PR).
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ name: 'google_sub', type: 'varchar', length: 255, nullable: true })
  googleSub!: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  // Privacy NFR: consent recorded at sign-up (Luật 91/2025/QH15).
  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
