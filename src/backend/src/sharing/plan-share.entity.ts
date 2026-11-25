import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plan } from '../plans/plan.entity.js';
import { User } from '../users/user.entity.js';

// Table `plan_shares` of migration 1795564800000 (UC-09, ADR 0010): the live link of a shared plan.
// No row means the plan is not shared; stopping a link deletes its row.
@Entity({ name: 'plan_shares' })
@Unique('uq_plan_shares_plan_id', ['planId'])
@Unique('uq_plan_shares_share_token', ['shareToken'])
@Index('ix_plan_shares_user_id', ['userId'])
@Check('ck_plan_shares_share_token', `"share_token" ~ '^[A-Za-z0-9_-]{43}$'`)
export class PlanShare {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'plan_shares_pkey' })
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // Composite key: the link's user_id is always its plan's.
  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'plan_id', referencedColumnName: 'id', foreignKeyConstraintName: 'plan_shares_plan_fkey' },
    { name: 'user_id', referencedColumnName: 'userId', foreignKeyConstraintName: 'plan_shares_plan_fkey' },
  ])
  plan!: Plan;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'plan_shares_user_id_fkey' })
  user!: User;

  // A credential: anyone who holds it reads the plan. The _token suffix keeps it out of the account export (ADR 0004).
  @Column({ name: 'share_token', type: 'varchar', length: 43 })
  shareToken!: string;

  /** Whether a reader sees the owner's display name. Hidden unless the owner chooses (UC-09 step 2). */
  @Column({ name: 'show_name', type: 'boolean', default: false })
  showName!: boolean;

  /**
   * Whether a reader sees the checks the rule engine decides from the owner's transcript, with the
   * coverage they add up to. Off unless the owner chooses: with it on, a reader can tell which
   * courses the owner has passed, failed or is taking (ADR 0010).
   */
  @Column({ name: 'show_transcript_checks', type: 'boolean', default: false })
  showTranscriptChecks!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
