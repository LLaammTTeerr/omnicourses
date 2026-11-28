import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { logFailure } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { HOUR_MS } from '../config/time.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AccountPurgeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AccountPurgeService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly users: UsersService,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    void this.purge();
    this.timer = setInterval(() => void this.purge(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async purge(now = this.clock.now()): Promise<number> {
    let due: string[];
    try {
      due = await this.users.findDueForPurge(now);
    } catch (error) {
      logFailure(this.logger, 'Account purge failed', error);
      return 0;
    }
    let purged = 0;
    let failed = 0;
    for (const id of due) {
      try {
        if (await this.users.purgeIfDue(id, now)) purged++;
      } catch (error) {
        failed++;
        logFailure(this.logger, 'Could not purge an account', error);
      }
    }
    if (purged) this.logger.log(`Purged ${purged} account(s) after the deletion grace period`);
    if (failed) this.logger.error(`${failed} account(s) are past their deletion deadline and could not be purged; retrying next hour`);
    return purged;
  }
}
