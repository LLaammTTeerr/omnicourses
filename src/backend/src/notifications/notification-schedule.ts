import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { logFailure } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { MINUTE_MS, msUntilVietnamMidnight } from '../config/time.js';
import { NotificationsService } from './notifications.service.js';

export const RUN_INTERVAL_MS = 10 * MINUTE_MS;
export const MIN_DELAY_MS = 1000;

export function msUntilNextRun(now: Date): number {
  return Math.max(MIN_DELAY_MS, Math.min(RUN_INTERVAL_MS, msUntilVietnamMidnight(now)));
}

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

  async tick(): Promise<void> {
    try {
      const created = await this.notifications.createDue();
      if (created) this.logger.log(`Created ${created} notification(s)`);
    } catch (error) {
      logFailure(this.logger, 'Could not create the notifications that are due', error);
    }
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), msUntilNextRun(this.clock.now()));
    this.timer.unref();
  }
}
