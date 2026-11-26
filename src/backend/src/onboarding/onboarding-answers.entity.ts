import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import { CODE_MAX_LENGTH } from '../common/column-limits.js';

@Entity({ name: 'onboarding_answers' })
export class OnboardingAnswers {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
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
