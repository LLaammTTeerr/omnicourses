import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aiConfig, loadEnvFiles } from '../config/env.js';
import { type CostGuard, GatewayLlmService } from './gateway-llm.service.js';
import type { ChatEvent } from './llm.service.js';
import { OpenRouterModelClient } from './openrouter-model.client.js';

// One smoke test per operation against the real provider: `npm run test:live -w src/backend`.
// Synthetic input only (AGENTS.md hard rule 3).
loadEnvFiles();

const noGuard: CostGuard = { reserve: async () => 'live', finish: async () => undefined, release: async () => undefined };
const context = { userId: '00000000-0000-4000-8000-000000000000', feature: 'live-test' };

const config = aiConfig();
const configured = Boolean(config.apiKey && config.structuredModel && config.chatModel);

const creditCapTool = (calls: string[]) => ({
  name: 'lookup_credit_cap',
  description: 'Returns the credit cap for a term kind',
  schema: z.object({ termKind: z.enum(['main', 'summer']) }),
  handler: async ({ termKind }: { termKind: 'main' | 'summer' }) => {
    calls.push(termKind);
    return termKind === 'main' ? { min: 14, max: 25 } : { max: 12 };
  },
});

describe.skipIf(!configured)('AI gateway against OpenRouter (live)', () => {
  let llm: GatewayLlmService;

  beforeAll(() => {
    llm = new GatewayLlmService(new OpenRouterModelClient(config.apiKey ?? '', config.timeoutMs), noGuard, config);
  });

  it('structured() returns a reply that passes the schema', async () => {
    const schema = z.object({ creditsPerTerm: z.number().int().nullable(), internshipTerm: z.string().nullable() });
    const reply = await llm.structured({
      context,
      instructions: 'Extract the planning goal. Use null for anything not stated.',
      input: 'I want 18 credits a term and an internship in summer 2027.',
      schema,
    });
    expect(reply.creditsPerTerm).toBe(18);
  });

  it('chat() calls a tool and streams an answer', async () => {
    const calls: string[] = [];
    const events: ChatEvent[] = [];
    for await (const event of llm.chat({
      context,
      instructions: 'Answer using the lookup tool. Be brief.',
      messages: [{ role: 'user', content: 'What is the maximum number of credits in a main term?' }],
      tools: [creditCapTool(calls)],
    })) {
      events.push(event);
    }
    expect(calls).toContain('main');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: expect.stringContaining('25') });
  });

  // Checks the configured chat model accepts tool_choice none with tools defined.
  it('chat() answers in text when it runs out of steps', async () => {
    const calls: string[] = [];
    const events: ChatEvent[] = [];
    for await (const event of llm.chat({
      context,
      instructions: 'Always call the lookup tool again before answering, for every term kind, as many times as you can.',
      messages: [{ role: 'user', content: 'What are the credit caps for main and summer terms?' }],
      tools: [creditCapTool(calls)],
      maxSteps: 2,
    })) {
      events.push(event);
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: expect.stringMatching(/\S/) });
  });
});
