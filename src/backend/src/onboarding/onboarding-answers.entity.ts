import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

// One row per student, written by the first save (UC-01 steps 6–10). No row means nothing answered.
// CHECKs in the migration keep each term pair whole and program and cohort set together.
@Entity({ name: 'onboarding_answers' })
export class OnboardingAnswers {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'program_code', type: 'varchar', length: 50, nullable: true })
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

  // "None planned" (B1 §6 item 3): distinct from an unanswered internship term, where both are null.
  @Column({ name: 'no_internship_planned', type: 'boolean', default: false })
  noInternshipPlanned!: boolean;

  // Set when the student first presses Finish, kept by later saves from Settings.
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
