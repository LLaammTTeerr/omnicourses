import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { PLAN_NAME_MAX_LENGTH } from './api.js';
import { cutPlanName, usePlanActions } from './plan-actions.js';
import { PLAN_ID, plan } from './testing/fixtures.js';

describe('cutPlanName', () => {
  it('cuts a name to the API limit between code points, never inside an emoji', () => {
    const name = cutPlanName(`${'a'.repeat(PLAN_NAME_MAX_LENGTH - 1)}😀😀`);
    expect(Array.from(name)).toHaveLength(PLAN_NAME_MAX_LENGTH);
    expect(name.endsWith('😀')).toBe(true);
    expect(cutPlanName('Kế hoạch')).toBe('Kế hoạch');
  });
});

describe('usePlanActions', () => {
  beforeEach(async () => {
    await setup('/');
  });
  afterEach(() => vi.restoreAllMocks());

  it('copies under a name cut to the limit, then runs what follows', async () => {
    const fetch = mockApi({ [`POST /plans/${PLAN_ID}/duplicate`]: (init: RequestInit) => Response.json(plan([], { name: (sentBody(init) as { name: string }).name })) });
    const then = vi.fn();
    const done = await usePlanActions().copy(PLAN_ID, 'x'.repeat(150), then);
    expect(done).toBe(true);
    expect(sentBody(fetch.mock.calls[0]![1])).toEqual({ name: 'x'.repeat(PLAN_NAME_MAX_LENGTH) });
    expect(then).toHaveBeenCalledWith(expect.objectContaining({ name: 'x'.repeat(PLAN_NAME_MAX_LENGTH) }));
  });

  it('says a failed copy in a toast, and keeps the details in the console', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ [`POST /plans/${PLAN_ID}/duplicate`]: status(500) });
    const actions = usePlanActions();
    expect(await actions.copy(PLAN_ID, 'Copy', vi.fn())).toBe(false);
    expect(actions.dialogError.value).not.toBeNull();
    expect(useToast().message).toBe(actions.dialogError.value);
    expect(actions.busy.value).toBe(false);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('takes a deletion the server already made (404) as done', async () => {
    mockApi({ [`DELETE /plans/${PLAN_ID}`]: status(404) });
    const then = vi.fn();
    expect(await usePlanActions().remove(PLAN_ID, then)).toBe(true);
    expect(then).toHaveBeenCalledOnce();
  });

  it('says nothing after a 401: the student is signed out and App.vue takes them to sign in', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ [`DELETE /plans/${PLAN_ID}`]: status(401) });
    const actions = usePlanActions();
    expect(await actions.remove(PLAN_ID)).toBe(false);
    expect(actions.dialogError.value).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    expect(useAuth().signedIn).toBe(false);
  });

  it('runs one action at a time: a copy while a rename is on its way does nothing', async () => {
    const answers: ((response: Response) => void)[] = [];
    const fetch = mockApi({ [`PATCH /plans/${PLAN_ID}`]: () => new Promise<Response>((resolve) => answers.push(resolve)) });
    const actions = usePlanActions();
    const renamed = actions.rename(PLAN_ID, 'B', vi.fn());
    expect(await actions.copy(PLAN_ID, 'Copy', vi.fn())).toBe(false);
    expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['PATCH']);
    answers[0]!(Response.json(plan([], { name: 'B' })));
    expect(await renamed).toBe(true);
  });
});
