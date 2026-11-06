import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Or, Repository } from 'typeorm';
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

  async markDeletionRequestedWithin(manager: EntityManager, userId: string, at: Date, purgeAfter: Date): Promise<void> {
    await manager.update(User, userId, { deletionRequestedAt: at, purgeAfter });
  }

  /**
   * Cancels a pending deletion if its deadline is still ahead. False when the
   * deadline has passed or the row is already purged: one conditional UPDATE,
   * so it can't interleave with the purge's DELETE. A deletion already
   * cancelled (a concurrent sign-in got there first) counts as cancelled.
   */
  async cancelDeletion(userId: string, now: Date): Promise<boolean> {
    const result = await this.users.update(
      { id: userId, purgeAfter: Or(IsNull(), MoreThan(now)) },
      { deletionRequestedAt: null, purgeAfter: null },
    );
    return (result.affected ?? 0) > 0;
  }
}
