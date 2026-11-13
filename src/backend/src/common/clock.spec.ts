import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { CLOCK, type Clock, ClockModule } from './clock.js';

@Injectable()
class Reader {
  constructor(@Inject(CLOCK) readonly now: Clock) {}
}

@Module({ imports: [ClockModule], providers: [Reader] })
class ReaderModule {}

describe('ClockModule', () => {
  it('gives a reader the system time', async () => {
    const app = await Test.createTestingModule({ imports: [ReaderModule] }).compile();
    const before = Date.now();
    const now = app.get(Reader).now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('lets a test fix the time for every reader with one override', async () => {
    const fixed = new Date('2026-11-13T05:00:00Z');
    const app = await Test.createTestingModule({ imports: [ReaderModule] })
      .overrideProvider(CLOCK)
      .useValue(() => fixed)
      .compile();
    expect(app.get(Reader).now()).toBe(fixed);
  });
});
