import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AiCostGuard } from './ai-cost-guard.service.js';
import { GatewayLlmService } from './gateway-llm.service.js';
import type { ChatEvent } from './llm.service.js';
import { OpenRouterModelClient } from './openrouter-model.client.js';

// One smoke test per operation against the real provider: `npm run test:live -w src/backend`.
// Synthetic input only (AGENTS.md hard rule 3).
for (const file of ['.env', '../../.env']) if (existsSync(file) && !process.env.OPENROUTER_API_KEY) process.loadEnvFile(file);

const noGuard: Pick<AiCostGuard, 'reserve' | 'finish'> = { reserve: async () => 'live', finish: async () => undefined };
const context = { userId: '00000000-0000-4000-8000-000000000000', feature: 'live-test' };

const configured = Boolean(process.env.OPENROUTER_API_KEY && process.env.AI_MODEL_STRUCTURED && process.env.AI_MODEL_CHAT);

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
  const llm = new GatewayLlmService(new OpenRouterModelClient(), noGuard as never);

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

  // The last step keeps the tools with tool_choice none, since the history holds
  // tool calls; this checks the configured chat model accepts that and answers.
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
