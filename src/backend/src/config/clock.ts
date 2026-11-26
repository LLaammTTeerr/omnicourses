import { Global, Injectable, Module } from '@nestjs/common';

/** The current instant. Injected, so a test sets the time instead of waiting for it (ADR 0018). */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}

@Global()
@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
