import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Program } from '../curriculum/program.entity.js';
import { User } from '../users/user.entity.js';

/** ADR 0011: the two permissions that cover the whole deployment. */
export const GLOBAL_PERMISSIONS = ['catalog_maintainer', 'access_manager'] as const;
export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number];

// Tables of migration 1794230000000 (ADR 0011). A row belongs to its recipient (user_id,
// CASCADE), so account export and purge cover it (ADR 0004); granted_by is another user's
// ID and is nulled when they are purged.

@Entity({ name: 'program_admin_grants' })
@Index('ix_program_admin_grants_program_id', ['programId'])
export class ProgramAdminGrant {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', primaryKeyConstraintName: 'program_admin_grants_pkey' })
  userId!: string;

  @PrimaryColumn({ name: 'program_id', type: 'uuid', primaryKeyConstraintName: 'program_admin_grants_pkey' })
  programId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'program_admin_grants_user_id_fkey' })
  user!: User;

  @ManyToOne(() => Program, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'program_admin_grants_program_id_fkey' })
  program!: Program;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'now()' })
  grantedAt!: Date;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'granted_by', foreignKeyConstraintName: 'program_admin_grants_granted_by_fkey' })
  granter!: User | null;
}

@Entity({ name: 'global_admin_grants' })
@Check('ck_global_admin_grants_permission', `"permission" IN ('catalog_maintainer', 'access_manager')`)
export class GlobalAdminGrant {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', primaryKeyConstraintName: 'global_admin_grants_pkey' })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 32, primaryKeyConstraintName: 'global_admin_grants_pkey' })
  permission!: GlobalPermission;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'global_admin_grants_user_id_fkey' })
  user!: User;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'now()' })
  grantedAt!: Date;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'granted_by', foreignKeyConstraintName: 'global_admin_grants_granted_by_fkey' })
  granter!: User | null;
}
