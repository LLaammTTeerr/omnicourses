import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { TranscriptResult } from './transcript-entry.js';

@Entity({ name: 'transcript_rows' })
@Index('ix_transcript_rows_user_id', ['userId'])
export class TranscriptRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'course_code', type: 'varchar', length: 20 })
  courseCode!: string;

  @Column({ name: 'course_name', type: 'varchar', length: 255 })
  courseName!: string;

  // As the transcript states it; the curriculum may say otherwise (ADR 0007).
  @Column({ type: 'smallint' })
  credits!: number;

  // graded, in_progress, exempt, pass or fail (ADR 0007). A CHECK keeps grade set exactly when graded.
  @Column({ type: 'varchar', length: 20 })
  result!: TranscriptResult;

  // 10-point scale, one decimal, when the result is graded; null otherwise.
  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    nullable: true,
    // pg returns numeric as a string.
    transformer: { to: (v: number | null) => v, from: (v: string | null) => (v === null ? null : Number(v)) },
  })
  grade!: number | null;

  // Term encoding of ADR 0007: academic year 2026 = 2026–2027; 1 and 2 are main terms, 3 is summer.
  @Column({ name: 'term_year', type: 'smallint' })
  termYear!: number;

  @Column({ name: 'term_number', type: 'smallint' })
  termNumber!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
