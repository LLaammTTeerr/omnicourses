import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './auth/auth.guard.js';
import { databaseUrl } from './config/env.js';
import { dataSourceOptions } from './database/data-source.js';
import { FEATURE_MODULES } from './features.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions, url: databaseUrl(), autoLoadEntities: true }) }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    ...FEATURE_MODULES,
  ],
  providers: [
    // Order matters: rate-limit first, then authenticate.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class AppModule {}
