import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
