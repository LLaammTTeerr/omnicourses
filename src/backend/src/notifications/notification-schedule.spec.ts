import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MINUTE_MS, vietnamDate } from '../config/time.js';
import { MIN_DELAY_MS, msUntilNextRun, NotificationSchedule, RUN_INTERVAL_MS } from './notification-schedule.js';

describe('msUntilNextRun', () => {
  it('waits the interval in the middle of a day', () => {
    expect(msUntilNextRun(new Date('2090-03-01T05:00:00Z'))).toBe(RUN_INTERVAL_MS);
    expect(msUntilNextRun(new Date('2090-03-01T17:00:00Z'))).toBe(RUN_INTERVAL_MS);
  });

  it('aims at 00:00 in Vietnam (17:00 UTC) when that comes before the interval ends', () => {
    expect(msUntilNextRun(new Date('2090-03-01T16:57:00Z'))).toBe(3 * MINUTE_MS);
    expect(msUntilNextRun(new Date('2090-03-01T16:59:58Z'))).toBe(2000);
  });

  it('never waits less than a second, so a clock that stands still cannot make the timer spin', () => {
    expect(msUntilNextRun(new Date('2090-03-01T16:59:59.999Z'))).toBe(MIN_DELAY_MS);
    expect(msUntilNextRun(new Date('2090-03-01T16:59:59.500Z'))).toBe(MIN_DELAY_MS);
  });
});

describe('NotificationSchedule', () => {
  // The clock follows the fake timers: time passes only when a test advances it.
  const clock = { now: () => new Date() };
  let days: string[];
  let createDue: ReturnType<typeof vi.fn>;
  let schedule: NotificationSchedule;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2090-03-01T16:45:00Z'));
    days = [];
    createDue = vi.fn(async () => {
      days.push(vietnamDate(clock.now()));
      return 0;
    });
    schedule = new NotificationSchedule({ createDue } as never, clock as never);
  });

  afterEach(() => {
    schedule.onModuleDestroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('runs at start-up, then at each interval, and at the first instant of the next Vietnam day', async () => {
    schedule.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(createDue).toHaveBeenCalledTimes(1);
    // The timer run is for everyone: no user ID.
    expect(createDue).toHaveBeenCalledWith();

    await vi.advanceTimersByTimeAsync(RUN_INTERVAL_MS - 1);
    expect(createDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createDue).toHaveBeenCalledTimes(2);

    // 16:55 UTC: midnight in Vietnam is five minutes away, sooner than the interval.
    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS - 1);
    expect(createDue).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(createDue).toHaveBeenCalledTimes(3);
    expect(new Date().toISOString()).toBe('2090-03-01T17:00:00.000Z');
    expect(days).toEqual(['2090-03-01', '2090-03-01', '2090-03-02']);

    await vi.advanceTimersByTimeAsync(RUN_INTERVAL_MS);
    expect(days).toEqual(['2090-03-01', '2090-03-01', '2090-03-02', '2090-03-02']);
  });

  it('stops when the app closes', async () => {
    schedule.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    schedule.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(3 * RUN_INTERVAL_MS);
    expect(createDue).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('books nothing when the app closes during a run', async () => {
    let finish!: () => void;
    createDue.mockImplementationOnce(() => new Promise<number>((resolve) => (finish = () => resolve(0))));
    schedule.onApplicationBootstrap();
    schedule.onModuleDestroy();
    finish();
    await vi.advanceTimersByTimeAsync(3 * RUN_INTERVAL_MS);
    expect(createDue).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one timer when a run is asked for by hand, and never keeps the process alive', async () => {
    schedule.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    await schedule.tick();
    await schedule.tick();
    expect(vi.getTimerCount()).toBe(1);
    expect((schedule as unknown as { timer: NodeJS.Timeout }).timer.hasRef()).toBe(false);
  });

  it('survives a failed run, tries again at the next one, and logs the error name only', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    createDue.mockRejectedValueOnce(new Error('duplicate key value: Key (user_id)=(synthetic-id) already exists'));
    await expect(schedule.tick()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toBe('Could not create the notifications that are due: Error');
    // Not a database error: the frames of its stack follow, and never its message.
    const stack = String(error.mock.calls[0]![1]);
    expect(stack).toMatch(/^\s+at /);
    expect(stack).not.toContain('synthetic-id');
    await vi.advanceTimersByTimeAsync(RUN_INTERVAL_MS);
    expect(createDue).toHaveBeenCalledTimes(2);
  });

  it('adds the SQLSTATE of a refused statement to the line, and neither the statement nor its parameters', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const driverError = Object.assign(new Error('insert or update violates foreign key: Key (user_id)=(synthetic-id)'), { code: '23503' });
    createDue.mockRejectedValueOnce(new QueryFailedError('INSERT INTO "notifications" …', ['synthetic-id', 'Synthetic title'], driverError));
    await schedule.tick();
    expect(error.mock.calls.map((c) => c.map(String).join(' '))).toEqual(['Could not create the notifications that are due: QueryFailedError, SQLSTATE 23503']);
  });

  it('logs how many notifications a run created, and nothing about them', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    createDue.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    await schedule.tick();
    expect(log).not.toHaveBeenCalled();
    await schedule.tick();
    expect(log.mock.calls.map((c) => c[0])).toEqual(['Created 3 notification(s)']);
  });
});
