import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
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

  async requestDeletion(userId: string, at: Date): Promise<void> {
    await this.users.update(userId, { deletionRequestedAt: at });
  }

  async cancelDeletion(userId: string): Promise<void> {
    await this.users.update(userId, { deletionRequestedAt: null });
  }

  /** Deletes accounts whose deletion was requested before `cutoff`; every user table cascades. */
  async purgeDeletionsRequestedBefore(cutoff: Date): Promise<number> {
    const result = await this.users.delete({ deletionRequestedAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
