import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { RequirementGroup } from '../curriculum/requirement-group.entity.js';
import { User } from '../users/user.entity.js';
import { Plan } from './plan.entity.js';

// Table `plan_placements` of migration 1794218005469 (ADR 0014): a course, or a slot that holds
// credits for a requirement group until a course is chosen, in one term of a plan.
@Entity({ name: 'plan_placements' })
@Unique('uq_plan_placements_term_position', ['planId', 'termYear', 'termNumber', 'position'])
@Index('uq_plan_placements_course', ['planId', 'courseCode'], { unique: true, where: `"course_code" IS NOT NULL` })
@Index('ix_plan_placements_user_id', ['userId'])
@Index('ix_plan_placements_requirement_group_id', ['requirementGroupId'])
@Check('ck_plan_placements_term_year', `"term_year" BETWEEN 2000 AND 2100`)
@Check('ck_plan_placements_term_number', `"term_number" IN (1, 2, 3)`)
@Check('ck_plan_placements_position', `"position" >= 0`)
@Check('ck_plan_placements_course_code', `"course_code" ~ '^[A-Z0-9]{2,20}$'`)
@Check('ck_plan_placements_course_or_slot', `("course_code" IS NULL) <> ("requirement_group_id" IS NULL)`)
@Check('ck_plan_placements_slot_credits', `("slot_credits" IS NULL) = ("requirement_group_id" IS NULL)`)
@Check('ck_plan_placements_slot_credits_range', `"slot_credits" BETWEEN 1 AND 30`)
export class PlanPlacement {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'plan_placements_pkey' })
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // Composite key: the placement's user_id is always its plan's.
  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'plan_id', referencedColumnName: 'id', foreignKeyConstraintName: 'plan_placements_plan_fkey' },
    { name: 'user_id', referencedColumnName: 'userId', foreignKeyConstraintName: 'plan_placements_plan_fkey' },
  ])
  plan!: Plan;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'plan_placements_user_id_fkey' })
  user!: User;

  @Column({ name: 'term_year', type: 'smallint' })
  termYear!: number;

  @Column({ name: 'term_number', type: 'smallint' })
  termNumber!: number;

  @Column({ type: 'smallint' })
  position!: number;

  @Column({ name: 'course_code', type: 'varchar', length: 20, nullable: true })
  courseCode!: string | null;

  @Column({ name: 'requirement_group_id', type: 'uuid', nullable: true })
  requirementGroupId!: string | null;

  // RESTRICT: F12 refuses to delete a requirement group a saved plan uses (ADR 0011).
  @ManyToOne(() => RequirementGroup, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requirement_group_id', foreignKeyConstraintName: 'plan_placements_requirement_group_id_fkey' })
  requirementGroup!: RequirementGroup | null;

  @Column({ name: 'slot_credits', type: 'smallint', nullable: true })
  slotCredits!: number | null;
}
