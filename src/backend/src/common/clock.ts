import { Module } from '@nestjs/common';

/** What time it is. Injected, so a test can fix "now" for every module that reads it. */
export type Clock = () => Date;

/** The injection token of the clock. Override it once (`overrideProvider(CLOCK)`) to move every reader. */
export const CLOCK = Symbol('CLOCK');

/** Provides CLOCK, the system time. A feature that reads "now" imports this module. */
@Module({
  providers: [{ provide: CLOCK, useValue: (() => new Date()) satisfies Clock }],
  exports: [CLOCK],
})
export class ClockModule {}
