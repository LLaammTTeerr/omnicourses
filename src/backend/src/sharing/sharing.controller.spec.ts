import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ShareBodyPipe } from './sharing.controller.js';
import { sharedPlanHeaders } from './sharing.module.js';

describe('ShareBodyPipe', () => {
  const pipe = new ShareBodyPipe();

  it('reads no body as no choice, and passes an object on as it is', () => {
    expect(pipe.transform(undefined)).toEqual({});
    expect(pipe.transform({})).toEqual({});
    const body = { showName: true, showTranscriptChecks: false };
    expect(pipe.transform(body)).toBe(body);
  });

  it('refuses a body that is not an object', () => {
    for (const body of [[], [{ showName: true }], null, 'showName', 1, true]) {
      expect(() => pipe.transform(body), JSON.stringify(body)).toThrow(new BadRequestException('The body must be a JSON object'));
    }
  });
});

describe('sharedPlanHeaders', () => {
  it('tells search engines and caches to keep nothing, then lets the request go on', () => {
    const res = { setHeader: vi.fn() };
    const next = vi.fn();
    sharedPlanHeaders({} as Request, res as unknown as Response, next);
    expect(res.setHeader.mock.calls).toEqual([
      ['X-Robots-Tag', 'noindex, nofollow'],
      ['Cache-Control', 'no-store'],
    ]);
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });
});
