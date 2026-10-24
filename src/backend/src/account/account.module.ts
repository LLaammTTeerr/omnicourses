import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

// Its own module because it needs AuthService (password check, revoke all),
// and UsersModule cannot import AuthModule without a cycle.
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AccountController],
  providers: [AccountService, AccountPurgeService],
})
export class AccountModule {}
