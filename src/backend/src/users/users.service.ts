import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThanOrEqual, MoreThan, Or, Repository } from 'typeorm';
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

  async cancelDeletion(userId: string, now: Date): Promise<boolean> {
    const result = await this.users.update(
      { id: userId, purgeAfter: Or(IsNull(), MoreThan(now)) },
      { deletionRequestedAt: null, purgeAfter: null },
    );
    return (result.affected ?? 0) > 0;
  }

  async findDueForPurge(now: Date): Promise<string[]> {
    const due = await this.users.find({ select: { id: true }, where: { purgeAfter: LessThanOrEqual(now) } });
    return due.map(({ id }) => id);
  }

  async purgeIfDue(userId: string, now: Date): Promise<boolean> {
    const { affected } = await this.users.delete({ id: userId, purgeAfter: LessThanOrEqual(now) });
    return Boolean(affected);
  }
}
