import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { TranscriptResult } from './transcript-entry.js';

export const COURSE_NAME_MAX_LENGTH = 255;

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

  @Column({ name: 'course_name', type: 'varchar', length: COURSE_NAME_MAX_LENGTH })
  courseName!: string;

  @Column({ type: 'smallint' })
  credits!: number;

  @Column({ type: 'varchar', length: 20 })
  result!: TranscriptResult;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 1,
    nullable: true,
    transformer: { to: (v: number | null) => v, from: (v: string | null) => (v === null ? null : Number(v)) },
  })
  grade!: number | null;

  @Column({ name: 'term_year', type: 'smallint' })
  termYear!: number;

  @Column({ name: 'term_number', type: 'smallint' })
  termNumber!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
