import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';

const HOUR_MS = 3_600_000;

// Purges accounts whose grace period has ended, at start-up and every hour.
// A plain interval instead of a scheduler library: each account is one
// idempotent DELETE, so two instances running it at once is harmless. One
// DELETE per account, so an account whose rows can't be deleted doesn't keep
// every other account past its deadline.
@Injectable()
export class AccountPurgeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AccountPurgeService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly users: UsersService) {}

  onApplicationBootstrap(): void {
    void this.purge();
    this.timer = setInterval(() => void this.purge(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async purge(now = new Date()): Promise<number> {
    let due: string[];
    try {
      due = await this.users.findDue(now);
    } catch (error) {
      this.logger.error(`Account purge failed: ${message(error)}`);
      return 0;
    }
    let purged = 0;
    let failed = 0;
    for (const id of due) {
      try {
        if (await this.users.purge(id, now)) purged++;
      } catch (error) {
        failed++;
        this.logger.error(`Could not purge an account: ${message(error)}`);
      }
    }
    if (purged) this.logger.log(`Purged ${purged} account(s) after the deletion grace period`);
    if (failed) this.logger.error(`${failed} account(s) are past their deletion deadline and could not be purged; retrying next hour`);
    return purged;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
