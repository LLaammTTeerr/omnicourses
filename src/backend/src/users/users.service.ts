import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThanOrEqual, MoreThan, Or, Repository } from 'typeorm';
import { nullIfBlank, sentFields, trimmedOrNull } from '../common/field-validators.js';
import { User } from './user.entity.js';

const PROFILE_FIELDS = ['studentId', 'className'] as const;

export type ProfileFields = Partial<Pick<User, (typeof PROFILE_FIELDS)[number]>>;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.toLowerCase() });
  }

  findByEmailForAuth(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findPasswordHash(userId: string): Promise<string | null> {
    const user = await this.users
      .createQueryBuilder('u')
      .select('u.id')
      .addSelect('u.passwordHash')
      .where('u.id = :userId', { userId })
      .getOne();
    return user?.passwordHash ?? null;
  }

  create(fields: Pick<User, 'email' | 'passwordHash' | 'displayName' | 'consentAt'>): Promise<User> {
    return this.users.save(this.users.create({ ...fields, email: fields.email.toLowerCase() }));
  }

  async updateProfile(userId: string, body: ProfileFields): Promise<User> {
    const patch = sentFields(PROFILE_FIELDS, body, { studentId: nullIfBlank, className: trimmedOrNull }) as ProfileFields;
    if (Object.keys(patch).length) await this.users.update(userId, patch);
    return this.users.findOneByOrFail({ id: userId });
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
