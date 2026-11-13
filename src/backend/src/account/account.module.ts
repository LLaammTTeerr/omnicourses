import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

// The account's export and deletion lifecycle (ADR 0004). Scheduling a
// deletion asks users to mark the row and auth to revoke the sessions, in one
// transaction; the purge deletes the accounts whose deadline has passed.
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AccountController],
  providers: [AccountService, AccountPurgeService],
})
export class AccountModule {}
