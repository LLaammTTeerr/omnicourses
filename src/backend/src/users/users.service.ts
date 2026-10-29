import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.toLowerCase() });
  }

  create(fields: Pick<User, 'email' | 'passwordHash' | 'displayName' | 'consentAt'>): Promise<User> {
    return this.users.save(this.users.create({ ...fields, email: fields.email.toLowerCase() }));
  }

  /** `tx` lets the caller schedule the deletion in the same transaction as other writes. */
  async requestDeletion(userId: string, at: Date, purgeAfter: Date, tx?: EntityManager): Promise<void> {
    await (tx?.getRepository(User) ?? this.users).update(userId, { deletionRequestedAt: at, purgeAfter });
  }

  /**
   * Cancels a pending deletion if its deadline is still ahead. False when the
   * deadline has passed or the row is already purged: one conditional UPDATE,
   * so it can't interleave with the purge's DELETE.
   */
  async cancelDeletion(userId: string, now: Date): Promise<boolean> {
    const result = await this.users.update({ id: userId, purgeAfter: MoreThan(now) }, { deletionRequestedAt: null, purgeAfter: null });
    return (result.affected ?? 0) > 0;
  }

  /** Ids of the accounts whose stored deadline has passed. */
  async findDue(now: Date): Promise<string[]> {
    const due = await this.users.find({ select: { id: true }, where: { purgeAfter: LessThanOrEqual(now) } });
    return due.map((u) => u.id);
  }

  /**
   * Deletes one account if its deadline has still passed (a sign-in since
   * findDue cancels it); every user table cascades. False if nothing matched.
   */
  async purge(userId: string, now: Date): Promise<boolean> {
    const result = await this.users.delete({ id: userId, purgeAfter: LessThanOrEqual(now) });
    return (result.affected ?? 0) > 0;
  }
}
