import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SharingModule } from '../sharing/sharing.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [UsersModule, AuthModule, SharingModule],
  controllers: [AccountController],
  providers: [AccountService, AccountPurgeService],
})
export class AccountModule {}
