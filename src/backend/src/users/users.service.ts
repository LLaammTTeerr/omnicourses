import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThanOrEqual, MoreThan, Or, Repository } from 'typeorm';
import { accountDeletionGraceDays } from '../config/env.js';
import { DAY_MS } from '../config/time.js';
import { User } from './user.entity.js';

// A pending deletion is cancellable before its stored deadline and due for the
// purge from it on (ADR 0004). The two conditions are complements: change both.
const cancellable = (now: Date) => Or(IsNull(), MoreThan(now));
const due = (now: Date) => LessThanOrEqual(now);

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.toLowerCase() });
  }

  create(fields: Pick<User, 'email' | 'passwordHash' | 'displayName' | 'consentAt'>): Promise<User> {
    return this.users.save(this.users.create({ ...fields, email: fields.email.toLowerCase() }));
  }

  /**
   * Starts the grace period at `at` and returns its deadline. The deadline is
   * stored, so a later change of the setting can't move the one promised.
   */
  async markDeletionRequestedWithin(manager: EntityManager, userId: string, at: Date): Promise<Date> {
    const purgeAfter = new Date(at.getTime() + accountDeletionGraceDays() * DAY_MS);
    await manager.update(User, userId, { deletionRequestedAt: at, purgeAfter });
    return purgeAfter;
  }

  /**
   * Cancels a pending deletion if its deadline is still ahead. False when the
   * deadline has passed or the row is already purged: one conditional UPDATE,
   * so it can't interleave with the purge's DELETE. A deletion already
   * cancelled (a concurrent sign-in got there first) counts as cancelled.
   */
  async cancelDeletion(userId: string, now: Date): Promise<boolean> {
    const result = await this.users.update(
      { id: userId, purgeAfter: cancellable(now) },
      { deletionRequestedAt: null, purgeAfter: null },
    );
    return (result.affected ?? 0) > 0;
  }

  /** The accounts whose stored deletion deadline has passed. */
  async findDueForPurge(now: Date): Promise<string[]> {
    const rows = await this.users.find({ select: { id: true }, where: { purgeAfter: due(now) } });
    return rows.map((row) => row.id);
  }

  /**
   * Deletes the account if it is still due: false when a sign-in cancelled the
   * deletion since findDueForPurge, or the row is already gone. Every user
   * table cascades (ADR 0004).
   */
  async purgeIfDue(userId: string, now: Date): Promise<boolean> {
    const result = await this.users.delete({ id: userId, purgeAfter: due(now) });
    return (result.affected ?? 0) > 0;
  }
}
