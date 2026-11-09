import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { User } from '../users/user.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

// The account's export and deletion lifecycle (ADR 0004). Scheduling a
// deletion asks users to mark the row and auth to revoke the sessions, in one
// transaction; the purge deletes the accounts whose deadline has passed.
@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule, AuthModule],
  controllers: [AccountController],
  providers: [AccountService, AccountPurgeService],
})
export class AccountModule {}
