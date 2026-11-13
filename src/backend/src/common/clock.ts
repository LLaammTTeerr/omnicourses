import { Module } from '@nestjs/common';

/** What time it is. Injected, so a test can fix "now" for the modules that read it through here. */
export type Clock = () => Date;

/**
 * The injection token of the clock. Overriding it (`overrideProvider(CLOCK)`) moves its readers only:
 * the guides read today through it; onboarding's goal-term validator, auth and account still call
 * `new Date()` themselves, so a fixed clock does not reach them yet.
 */
export const CLOCK = Symbol('CLOCK');

/** Provides CLOCK, the system time. A feature that reads "now" should import this module. */
@Module({
  providers: [{ provide: CLOCK, useValue: (() => new Date()) satisfies Clock }],
  exports: [CLOCK],
})
export class ClockModule {}
