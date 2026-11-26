import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AcademicCalendarService, type CalendarEventStart } from '../academic-calendar/academic-calendar.service.js';
import { failureKind, failureStack } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { MINUTE_MS, vietnamDate } from '../config/time.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import type { TranscriptSave } from '../transcript/transcript-change.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { type CalendarNotificationKind, LINKS_OF, notificationsDue, NOTIFYING_EVENT_KINDS, startDaysDueOn } from './notification-kinds.js';
import { Notification } from './notification.entity.js';
import { DEFAULT_PAGE_SIZE, NotificationDto, NotificationListDto, NotificationsQueryDto, UnreadCountDto } from './notifications.dto.js';

export const READ_FAILURE_LOG_INTERVAL_MS = MINUTE_MS;

export const notificationNotFound = () => new NotFoundException({ statusCode: 404, code: 'not_found', message: 'No notification with this ID' });

const INSERT_FOR_EVENT = `
  INSERT INTO "notifications"
    ("user_id", "kind", "calendar_event_id", "program_code", "academic_year", "term", "starts_on", "ends_on", "title", "title_en", "created_at")
  SELECT u."id", $2::varchar, $3::uuid, $4::varchar, $5::smallint, $6::smallint, $7::date, $8::date, $9::varchar, $10::varchar, $11::timestamptz
  FROM "users" u
  WHERE u."id" = ANY($1::uuid[]) AND u."deletion_requested_at" IS NULL
  ON CONFLICT ("user_id", "calendar_event_id", "kind") DO NOTHING
  RETURNING "id"`;

export function notificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    kind: notification.kind,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    event:
      notification.calendarEventId === null
        ? null
        : {
            id: notification.calendarEventId,
            programCode: notification.programCode!,
            academicYear: notification.academicYear!,
            term: notification.term,
            startsOn: notification.startsOn!,
            endsOn: notification.endsOn!,
            title: notification.title!,
            titleEn: notification.titleEn,
          },
    links: [...LINKS_OF[notification.kind]],
  };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readFailureLoggedAt: number | null = null;
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

  async createDue(onlyUserId?: string): Promise<number> {
    const now = this.clock.now();
    const due = await this.dueOn(vietnamDate(now));
    if (!due.length) return 0;
    const students = await this.onboarding.userIdsByProgram([...new Set(due.map((d) => d.event.programCode))], onlyUserId);
    const run = { created: 0, statements: 0, failures: [] as string[], stack: undefined as string | undefined };
    for (const { event, kind } of due) {
      const userIds = students.get(event.programCode);
      if (!userIds?.length) continue;
      run.statements++;
      try {
        run.created += await this.insertForEvent(event, kind, userIds, now);
      } catch (error) {
        run.failures.push(failureKind(error));
        run.stack ??= failureStack(error);
      }
    }
    if (run.failures.length) this.logFailure(onlyUserId !== undefined, `Could not create the notifications of ${run.failures.length} of ${run.statements} school date(s) that are due: ${[...new Set(run.failures)].join('; ')}`, run.stack);
    return run.created;
  }

  private async dueOn(day: string): Promise<{ event: CalendarEventStart; kind: CalendarNotificationKind }[]> {
    const events = await this.calendar.startingOn(startDaysDueOn(day), NOTIFYING_EVENT_KINDS);
    return events.flatMap((event) => notificationsDue(event, day).map((kind) => ({ event, kind })));
  }

  private async insertForEvent(event: CalendarEventStart, kind: CalendarNotificationKind, userIds: string[], now: Date): Promise<number> {
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
    return rows.length;
  }

  private async createDueBeforeRead(userId: string): Promise<void> {
    try {
      await this.createDue(userId);
    } catch (error) {
      this.logFailure(true, `Could not create the notifications that are due before a read: ${failureKind(error)}`, failureStack(error));
    }
  }

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

  async list(userId: string, query: NotificationsQueryDto): Promise<NotificationListDto> {
    await this.createDueBeforeRead(userId);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const notifications = this.notifications.createQueryBuilder('n').where('n.userId = :userId', { userId });
    if (query.unread !== undefined) notifications.andWhere(query.unread ? 'n.readAt IS NULL' : 'n.readAt IS NOT NULL');
    if (query.kind?.length) notifications.andWhere('n.kind IN (:...kinds)', { kinds: query.kind });
    if (query.before) {
      if (!(await this.notifications.existsBy({ id: query.before, userId }))) throw notificationNotFound();
      notifications.andWhere('(n.createdAt, n.id) < (SELECT c."created_at", c."id" FROM "notifications" c WHERE c."id" = :before AND c."user_id" = :userId)', { before: query.before });
    }
    const rows = await notifications
      .orderBy('n.createdAt', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .take(limit + 1)
      .getMany();
    const page = rows.slice(0, limit);
    return { notifications: page.map(notificationDto), nextBefore: rows.length > limit ? page[page.length - 1]!.id : null };
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    await this.createDueBeforeRead(userId);
    return this.unreadOf(userId);
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    await this.notifications.update({ id, userId, readAt: IsNull() }, { readAt: this.clock.now() });
    const found = await this.notifications.findOneBy({ id, userId });
    if (!found) throw notificationNotFound();
    return notificationDto(found);
  }

  async markAllRead(userId: string): Promise<UnreadCountDto> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: this.clock.now() });
    return this.unreadOf(userId);
  }

  private async unreadOf(userId: string): Promise<UnreadCountDto> {
    return { unread: await this.notifications.countBy({ userId, readAt: IsNull() }) };
  }

  private async transcriptSaved(tx: EntityManager, save: TranscriptSave): Promise<void> {
    if (save.wasEmpty || !save.changed) return;
    await tx.insert(Notification, { userId: save.userId, kind: 'transcript_changed', createdAt: this.clock.now() });
  }
}
