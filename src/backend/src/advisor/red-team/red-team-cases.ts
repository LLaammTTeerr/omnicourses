import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ChatMessage } from '../../ai/llm.service.js';
import { AskDto, checkConversation } from '../advisor.dto.js';

// The red-team corpus format (docs/test/advisor-red-team.md). Synthetic attacks only.

export const CATEGORIES = [
  'direct_injection',
  'indirect_injection',
  'jailbreak_roleplay',
  'prompt_extraction',
  'off_topic',
  'rule_without_engine',
  'fake_citation',
  'role_injection',
  'act_on_behalf',
  'other_student_data',
  'pii_bait',
  'long_input',
  'unicode_homoglyph',
  'multi_turn_escalation',
] as const;

export interface AttackCase {
  id: string;
  category: (typeof CATEGORIES)[number];
  lang: 'vi' | 'en';
  consent: boolean;
  /** As the attacker sends them: any role, extra keys, `{{repeat:N:text}}` for long inputs. */
  messages: Record<string, unknown>[];
  goal: string;
  escapeIf: string;
}

/** One step of a recorded model reply: a tool call, as the model would send it. */
export type ReplyStep = { tool: string; args: unknown };

export interface RecordedReply {
  steps: ReplyStep[];
  text: string;
}

export interface CaseReplies {
  id: string;
  faithful: RecordedReply;
  compromised: RecordedReply;
}

/** Expands `{{repeat:N:text}}` into text repeated N times. */
export function expand(content: unknown): unknown {
  if (typeof content !== 'string') return content;
  return content.replace(/\{\{repeat:(\d+):([\s\S]*?)\}\}/g, (_m, n: string, text: string) => text.repeat(Number(n)));
}

/** The request body the attacker's browser would send. */
export function requestBody(c: AttackCase): { language: string; messages: Record<string, unknown>[] } {
  return { language: c.lang, messages: c.messages.map((m) => ({ ...m, content: expand(m.content) })) };
}

/**
 * Runs the request body through the route's validation exactly as the ValidationPipe does
 * (whitelist, transform) and the controller's checkConversation. Returns the messages, or the errors.
 */
export async function validateRequest(body: unknown): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; errors: string[] }> {
  const dto = plainToInstance(AskDto, body);
  const errors = await validate(dto, { whitelist: true });
  if (errors.length) return { ok: false, errors: errors.flatMap(flatten) };
  try {
    checkConversation(dto);
  } catch (error) {
    return { ok: false, errors: [(error as Error).message] };
  }
  return { ok: true, messages: dto.messages.map((m) => ({ role: m.role, content: m.content })) };
}

function flatten(error: { property: string; constraints?: Record<string, string>; children?: unknown[] }): string[] {
  const own = Object.values(error.constraints ?? {});
  const children = (error.children ?? []).flatMap((c) => flatten(c as typeof error));
  return [...own, ...children];
}
