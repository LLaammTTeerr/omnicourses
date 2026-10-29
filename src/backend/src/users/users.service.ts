import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
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

  async requestDeletion(userId: string, at: Date, purgeAfter: Date): Promise<void> {
    await this.users.update(userId, { deletionRequestedAt: at, purgeAfter });
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

  /** Deletes accounts whose stored deadline has passed; every user table cascades. */
  async purgeDue(now: Date): Promise<number> {
    const result = await this.users.delete({ purgeAfter: LessThanOrEqual(now) });
    return result.affected ?? 0;
  }
}
