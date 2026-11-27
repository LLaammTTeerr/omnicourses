import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { NAMESPACED_LOCKS } from '../common/advisory-locks.js';
import { PASSWORD_ATTEMPTS } from './rate-limits.js';
import { SignInAttempt } from './sign-in-attempt.entity.js';

const SIGN_IN_ATTEMPT_PURGE_BATCH = 100;

@Injectable()
export class SignInLimiter {
  constructor(@InjectRepository(SignInAttempt) private readonly attempts: Repository<SignInAttempt>) {}

  async reserve(attemptKey: string, now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - PASSWORD_ATTEMPTS.ttl);
    await this.attempts.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
        NAMESPACED_LOCKS.signInAttempt,
        attemptKey,
      ]);
      await manager.delete(SignInAttempt, { attemptKey, attemptedAt: LessThanOrEqual(cutoff) });
      const activeCount = await manager.count(SignInAttempt, {
        where: { attemptKey, attemptedAt: MoreThan(cutoff) },
      });
      if (activeCount >= PASSWORD_ATTEMPTS.limit) {
        throw new HttpException(
          'Too many sign-in attempts for this account; try again in a minute',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await manager.insert(SignInAttempt, { attemptKey, attemptedAt: now });
    });
    await this.purge(cutoff);
  }

  async clear(attemptKey: string): Promise<void> {
    await this.attempts.delete({ attemptKey });
  }

  async purge(cutoff: Date): Promise<void> {
    await this.attempts.query(
      `DELETE FROM "sign_in_attempts" WHERE "id" IN (
        SELECT "id" FROM "sign_in_attempts" WHERE "attempted_at" <= $1
        LIMIT $2 FOR UPDATE SKIP LOCKED
      )`,
      [cutoff, SIGN_IN_ATTEMPT_PURGE_BATCH],
    );
  }
}
