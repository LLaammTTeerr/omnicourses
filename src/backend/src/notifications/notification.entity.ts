import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { NotificationKind } from './notification-kinds.js';

// Table of migration 1795575059760 (ADR 0018): one row per notification of one student.
// user_id cascades, so account export and deletion cover it with no extra code (ADR 0004).
// calendar_event_id has no foreign key on purpose: a notification already sent stays readable
// when an administrator deletes the school date, so the row keeps a copy of what it announced.
// The uniqueness key holds the event, never its date: a moved date sends nothing again. A
// transcript notification has no event, so the key (NULLs are distinct) never limits it.
@Entity({ name: 'notifications' })
@Unique('uq_notifications_user_event_kind', ['userId', 'calendarEventId', 'kind'])
@Index('ix_notifications_user_created', ['userId', 'createdAt', 'id'])
@Check('ck_notifications_kind', `"kind" IN ('registration_soon', 'registration_open', 'term_start', 'transcript_changed')`)
@Check('ck_notifications_event', `("kind" = 'transcript_changed') = ("calendar_event_id" IS NULL)`)
@Check(
  'ck_notifications_snapshot',
  `CASE WHEN "calendar_event_id" IS NULL
        THEN num_nonnulls("program_code", "academic_year", "term", "starts_on", "ends_on", "title", "title_en") = 0
        ELSE num_nulls("program_code", "academic_year", "starts_on", "ends_on", "title") = 0 END`,
)
export class Notification {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'notifications_pkey' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'notifications_user_id_fkey' })
  user!: User;

  @Column({ type: 'varchar', length: 32 })
  kind!: NotificationKind;

  /** The school date announced (academic_calendar.id); null for a transcript notification. No foreign key. */
  @Column({ name: 'calendar_event_id', type: 'uuid', nullable: true })
  calendarEventId!: string | null;

  // The school date as it was when the notification was made. Never updated afterwards.
  @Column({ name: 'program_code', type: 'varchar', length: 50, nullable: true })
  programCode!: string | null;

  @Column({ name: 'academic_year', type: 'smallint', nullable: true })
  academicYear!: number | null;

  @Column({ type: 'smallint', nullable: true })
  term!: 1 | 2 | 3 | null;

  // `date` columns: TypeORM reads them as 'YYYY-MM-DD' strings.
  @Column({ name: 'starts_on', type: 'date', nullable: true })
  startsOn!: string | null;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn!: string | null;

  /** Written from the injected clock, so the order of the inbox does not depend on the database's time. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
