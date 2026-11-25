import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { failureKind, failureStack } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { msUntilVietnamMidnight } from '../config/time.js';
import { NotificationsService } from './notifications.service.js';

/** Between two runs at most: a school date entered for today reaches students who do not open the app within this time. */
export const RUN_INTERVAL_MS = 10 * 60_000;
/** Between two runs at least, so a clock that stands still (a test) cannot make the timer spin. */
export const MIN_DELAY_MS = 1000;

/** When to run next: after the interval, or at the next Vietnam midnight when that comes first. */
export function msUntilNextRun(now: Date): number {
  return Math.max(MIN_DELAY_MS, Math.min(RUN_INTERVAL_MS, msUntilVietnamMidnight(now)));
}

// Creates the notifications that are due, at start-up and then on a timer (ADR 0018). A plain
// timeout instead of a scheduler library, like the account purge (ADR 0004): the run is one
// idempotent function, so two instances running it at once is harmless. Each run books the
// next one, aimed at 00:00 in Vietnam, so a day's notifications exist when the day starts.
@Injectable()
export class NotificationSchedule implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedule.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    void this.tick();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** One run, then books the next. Never rejects: a failed run is logged and tried again next time. */
  async tick(): Promise<void> {
    try {
      const created = await this.notifications.createDue();
      // A count only: never a student, a title or a date (AGENTS.md hard rule 3).
      if (created) this.logger.log(`Created ${created} notification(s)`);
    } catch (error) {
      // The error's class and its SQLSTATE only: a database message can quote row values. The
      // frames of an error that is not a database error, to find the code that threw it.
      const stack = failureStack(error);
      const line = `Could not create the notifications that are due: ${failureKind(error)}`;
      if (stack) this.logger.error(line, stack);
      else this.logger.error(line);
    }
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), msUntilNextRun(this.clock.now()));
    // Never keeps the process alive on its own.
    this.timer.unref();
  }
}
