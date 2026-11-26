import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { logFailure } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { HOUR_MS } from '../config/time.js';
import { UsersService } from '../users/users.service.js';

// Purges accounts whose grace period has ended, at start-up and every hour.
// A plain interval instead of a scheduler library: each account is one
// idempotent DELETE, so two instances running it at once is harmless. One
// DELETE per account, so an account whose rows can't be deleted doesn't keep
// every other account past its deadline.
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
      // The error's class and its SQLSTATE only: a database message can quote row values (AGENTS.md
      // hard rule 3). The frames of an error that is not a database error, to find the code that threw it.
      logFailure(this.logger, 'Account purge failed', error);
      return 0;
    }
    let purged = 0;
    let failed = 0;
    for (const id of due) {
      try {
        // Still due: a sign-in since the find cancels the deletion. Every user table cascades.
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
