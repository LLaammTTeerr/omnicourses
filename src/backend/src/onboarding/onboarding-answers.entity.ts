import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import { CODE_MAX_LENGTH } from '../common/column-limits.js';

@Entity({ name: 'onboarding_answers' })
@Index('idx_onboarding_answers_program_code', ['programCode'])
@Check('ck_onboarding_answers_program_cohort', `("program_code" IS NULL) = ("cohort_year" IS NULL)`)
@Check('ck_onboarding_answers_cohort_year', `"cohort_year" BETWEEN 2000 AND 2100`)
@Check('ck_onboarding_answers_target_term', `("target_graduation_term_year" IS NULL) = ("target_graduation_term_number" IS NULL)`)
@Check('ck_onboarding_answers_target_term_year', `"target_graduation_term_year" BETWEEN 2000 AND 2100`)
@Check('ck_onboarding_answers_target_term_number', `"target_graduation_term_number" IN (1, 2, 3)`)
@Check('ck_onboarding_answers_credits_per_term', `"credits_per_term" >= 1`)
@Check('ck_onboarding_answers_internship_term', `("internship_term_year" IS NULL) = ("internship_term_number" IS NULL)`)
@Check('ck_onboarding_answers_internship_term_year', `"internship_term_year" BETWEEN 2000 AND 2100`)
@Check('ck_onboarding_answers_internship_term_number', `"internship_term_number" IN (1, 2, 3)`)
@Check('ck_onboarding_answers_no_internship', `NOT "no_internship_planned" OR "internship_term_year" IS NULL`)
@Check('ck_onboarding_answers_finished', `"finished_at" IS NULL OR "program_code" IS NOT NULL`)
export class OnboardingAnswers {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'onboarding_answers_user_id_fkey' })
  user!: User;

  @Column({ name: 'program_code', type: 'varchar', length: CODE_MAX_LENGTH, nullable: true })
  programCode!: string | null;

  @Column({ name: 'cohort_year', type: 'smallint', nullable: true })
  cohortYear!: number | null;

  @Column({ name: 'target_graduation_term_year', type: 'smallint', nullable: true })
  targetGraduationTermYear!: number | null;

  @Column({ name: 'target_graduation_term_number', type: 'smallint', nullable: true })
  targetGraduationTermNumber!: number | null;

  @Column({ name: 'credits_per_term', type: 'integer', nullable: true })
  creditsPerTerm!: number | null;

  @Column({ name: 'internship_term_year', type: 'smallint', nullable: true })
  internshipTermYear!: number | null;

  @Column({ name: 'internship_term_number', type: 'smallint', nullable: true })
  internshipTermNumber!: number | null;

  @Column({ name: 'no_internship_planned', type: 'boolean', default: false })
  noInternshipPlanned!: boolean;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
