import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './auth/auth.guard.js';
import { THROTTLERS } from './auth/rate-limits.js';
import { connectionOptions } from './database/data-source.js';
import { FEATURE_MODULES } from './features.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...connectionOptions(), autoLoadEntities: true }) }),
    ThrottlerModule.forRoot(THROTTLERS),
    ...FEATURE_MODULES,
  ],
  providers: [
    // Order matters: rate-limit first, then authenticate.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class AppModule {}
