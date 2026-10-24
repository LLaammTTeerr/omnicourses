import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { deletionGraceMs } from './account.service.js';

const HOUR_MS = 3_600_000;

// Purges accounts whose grace period has ended, at start-up and every hour.
// A plain interval instead of a scheduler library: the job is one idempotent
// DELETE, so two instances running it at once is harmless.
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
    try {
      const purged = await this.users.purgeDeletionsRequestedBefore(new Date(now.getTime() - deletionGraceMs()));
      if (purged) this.logger.log(`Purged ${purged} account(s) after the deletion grace period`);
      return purged;
    } catch (error) {
      this.logger.error(`Account purge failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
