import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AcademicCalendarService, type CalendarEventStart } from '../academic-calendar/academic-calendar.service.js';
import { failureKind, failureStack } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { vietnamDate } from '../config/time.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import type { TranscriptSave } from '../transcript/transcript-change.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { type CalendarNotificationKind, LINKS_OF, notificationsDue, NOTIFYING_EVENT_KINDS, startDaysDueOn } from './notification-kinds.js';
import { Notification } from './notification.entity.js';
import { DEFAULT_PAGE_SIZE, NotificationDto, NotificationListDto, NotificationsQueryDto, UnreadCountDto } from './notifications.dto.js';

/** At most one line a minute about the failures of reads (ADR 0018, decision 15). */
export const READ_FAILURE_LOG_INTERVAL_MS = 60_000;

/** Unknown, malformed and another student's ID answer the same 404: the answer never tells them apart. */
export const notificationNotFound = () => new NotFoundException({ statusCode: 404, code: 'not_found', message: 'No notification with this ID' });

// One statement per school date and kind, for every recipient at once. The recipients are the
// given students minus the accounts waiting for deletion (ADR 0004). ON CONFLICT on the
// (user, event, kind) key: a second run, two runs at once and a moved date insert nothing.
const INSERT_FOR_EVENT = `
  INSERT INTO "notifications"
    ("user_id", "kind", "calendar_event_id", "program_code", "academic_year", "term", "starts_on", "ends_on", "title", "title_en", "created_at")
  SELECT u."id", $2::varchar, $3::uuid, $4::varchar, $5::smallint, $6::smallint, $7::date, $8::date, $9::varchar, $10::varchar, $11::timestamptz
  FROM "users" u
  WHERE u."id" = ANY($1::uuid[]) AND u."deletion_requested_at" IS NULL
  ON CONFLICT ("user_id", "calendar_event_id", "kind") DO NOTHING
  RETURNING "id"`;

export function notificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    kind: n.kind,
    createdAt: n.createdAt,
    readAt: n.readAt,
    event:
      n.calendarEventId === null
        ? null
        : {
            id: n.calendarEventId,
            // Set together with calendar_event_id (CHECK ck_notifications_snapshot).
            programCode: n.programCode!,
            academicYear: n.academicYear!,
            term: n.term,
            startsOn: n.startsOn!,
            endsOn: n.endsOn!,
            title: n.title!,
            titleEn: n.titleEn,
          },
    links: [...LINKS_OF[n.kind]],
  };
}

// F10, the notification inbox (ADR 0018). It announces school dates and a changed transcript.
// It states no academic rule and reads no grade (AGENTS.md hard rules 1 and 3): the calendar
// gives the dates, onboarding the students of a program, and the transcript only says "changed".
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  /** When a read last logged a failure, in this process; null until one does. */
  private readFailureLoggedAt: number | null = null;
  /** The reads whose failure was not logged since that line. */
  private readFailuresNotLogged = 0;

  constructor(
    private readonly db: DataSource,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly clock: Clock,
    private readonly calendar: AcademicCalendarService,
    private readonly onboarding: OnboardingService,
    private readonly transcript: TranscriptService,
  ) {}

  onModuleInit(): void {
    this.transcript.onSaved((tx, save) => this.transcriptSaved(tx, save));
  }

  /**
   * Creates every notification that is due on today's Vietnam day and does not exist yet; returns
   * how many it created. Safe to call at any time and from several places at once. The timer calls
   * it for everyone; a read calls it with `onlyUserId`, the same rules narrowed to the caller.
   *
   * A student receives a school date's notification when their saved program is the date's program
   * at this moment and their account is not waiting for deletion. A student who joins the program
   * later the same day still gets today's notifications; one who joins tomorrow does not.
   *
   * Each school date is written by a statement of its own, outside any shared transaction. A
   * statement that fails is counted and the run goes on, so one bad date does not cost the
   * students of the other dates their day: a missed day is never caught up. It rejects only when
   * the dates or the students cannot be read at all.
   */
  async createDue(onlyUserId?: string): Promise<number> {
    const now = this.clock.now();
    const day = vietnamDate(now);
    const events = await this.calendar.startingOn(startDaysDueOn(day), NOTIFYING_EVENT_KINDS);
    const due: { event: CalendarEventStart; kind: CalendarNotificationKind }[] = events.flatMap((event) => notificationsDue(event, day).map((kind) => ({ event, kind })));
    if (!due.length) return 0;
    const students = await this.onboarding.userIdsByProgram([...new Set(due.map((d) => d.event.programCode))], onlyUserId);
    let created = 0;
    let statements = 0;
    const failures: string[] = [];
    let stack: string | undefined;
    for (const { event, kind } of due) {
      const userIds = students.get(event.programCode);
      if (!userIds?.length) continue;
      statements++;
      try {
        // this.db, never a transaction's manager: in a shared transaction the first failure
        // would make PostgreSQL refuse every statement after it (SQLSTATE 25P02).
        const rows: unknown[] = await this.db.query(INSERT_FOR_EVENT, [
          userIds,
          kind,
          event.id,
          event.programCode,
          event.academicYear,
          event.term,
          event.startsOn,
          event.endsOn,
          event.title,
          event.titleEn,
          now,
        ]);
        created += rows.length;
      } catch (error) {
        failures.push(failureKind(error));
        stack ??= failureStack(error);
      }
    }
    // One line for the run, counts and failure kinds only: no student, no date, no title.
    if (failures.length) this.logFailure(onlyUserId !== undefined, `Could not create the notifications of ${failures.length} of ${statements} school date(s) that are due: ${[...new Set(failures)].join('; ')}`, stack);
    return created;
  }

  /**
   * createDue for a read. A failure must not cost the student the notifications already stored,
   * so it is logged, by kind only, and the read goes on. Left to Nest, the error would answer 500
   * and be logged with the failed statement and its parameters (a user ID, a date's title).
   */
  private async createDueBeforeRead(userId: string): Promise<void> {
    try {
      await this.createDue(userId);
    } catch (error) {
      this.logFailure(true, `Could not create the notifications that are due before a read: ${failureKind(error)}`, failureStack(error));
    }
  }

  /**
   * Logs a failure to create notifications. A run for everyone (the timer) logs every time. A read
   * logs the first failure, then at most one line a minute while failures go on, by the injected
   * clock: every inbox read would otherwise log the same line while a cause lasts.
   */
  private logFailure(forRead: boolean, line: string, stack: string | undefined): void {
    if (forRead) {
      const now = this.clock.now().getTime();
      if (this.readFailureLoggedAt !== null && now - this.readFailureLoggedAt < READ_FAILURE_LOG_INTERVAL_MS) {
        this.readFailuresNotLogged++;
        return;
      }
      if (this.readFailuresNotLogged) line += ` (${this.readFailuresNotLogged} more failed read(s) since the last line were not logged)`;
      this.readFailureLoggedAt = now;
      this.readFailuresNotLogged = 0;
    }
    if (stack) this.logger.error(line, stack);
    else this.logger.error(line);
  }

  /** The caller's notifications, newest first, after creating the ones due today for the caller alone. */
  async list(userId: string, query: NotificationsQueryDto): Promise<NotificationListDto> {
    await this.createDueBeforeRead(userId);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const qb = this.notifications.createQueryBuilder('n').where('n.userId = :userId', { userId });
    if (query.unread !== undefined) qb.andWhere(query.unread ? 'n.readAt IS NULL' : 'n.readAt IS NOT NULL');
    if (query.kind?.length) qb.andWhere('n.kind IN (:...kinds)', { kinds: query.kind });
    if (query.before) {
      if (!(await this.notifications.existsBy({ id: query.before, userId }))) throw notificationNotFound();
      // Compared inside PostgreSQL: a timestamp read into JavaScript loses its microseconds.
      qb.andWhere('(n.createdAt, n.id) < (SELECT c."created_at", c."id" FROM "notifications" c WHERE c."id" = :before AND c."user_id" = :userId)', { before: query.before });
    }
    const rows = await qb
      .orderBy('n.createdAt', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .take(limit + 1)
      .getMany();
    const page = rows.slice(0, limit);
    return { notifications: page.map(notificationDto), nextBefore: rows.length > limit ? page[page.length - 1]!.id : null };
  }

  /** How many of the caller's notifications are unread, after creating the ones due today for the caller alone. */
  async unreadCount(userId: string): Promise<UnreadCountDto> {
    await this.createDueBeforeRead(userId);
    return { unread: await this.notifications.countBy({ userId, readAt: IsNull() }) };
  }

  /** Marks one of the caller's notifications read. Again does nothing: the first time stays. */
  async markRead(userId: string, id: string): Promise<NotificationDto> {
    await this.notifications.update({ id, userId, readAt: IsNull() }, { readAt: this.clock.now() });
    const found = await this.notifications.findOneBy({ id, userId });
    if (!found) throw notificationNotFound();
    return notificationDto(found);
  }

  /** Marks every unread notification of the caller read (UC-12 A3). */
  async markAllRead(userId: string): Promise<UnreadCountDto> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: this.clock.now() });
    return { unread: await this.notifications.countBy({ userId, readAt: IsNull() }) };
  }

  /**
   * Dũng's rule 3: one notification for each save that changes a transcript that was not empty.
   * Saving over an empty transcript is a first import and makes none; emptying a saved transcript
   * is a change. Written through the save's transaction, so a save that fails leaves nothing.
   */
  private async transcriptSaved(tx: EntityManager, save: TranscriptSave): Promise<void> {
    if (save.wasEmpty || !save.changed) return;
    await tx.insert(Notification, { userId: save.userId, kind: 'transcript_changed', createdAt: this.clock.now() });
  }
}
