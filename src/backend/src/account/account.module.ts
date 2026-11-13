import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

// The account's export and deletion lifecycle (ADR 0004).
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AccountController],
  providers: [AccountService, AccountPurgeService],
})
export class AccountModule {}
