import { describe, expect, it } from 'vitest';
import { HANDBOOK_QUESTIONS, OFF_TOPIC_QUESTIONS, RECORD_QUESTIONS, REGULATION_QUESTIONS } from './retrieval/labelled-questions.js';
import { corpusIndex } from './retrieval/regulation-corpus.js';
import { gate, hasRecordIntent } from './topic-gate.js';

describe('topic gate', () => {
  const index = corpusIndex();
  const passes = (q: string) => gate(index, [q], true).decision !== 'off_topic';

  // ADR 0015 reports these numbers. Positive = on topic (a regulation, handbook or own-record question).
  // With the handbook in the index, one off-topic request shares enough of its words ("tiếng Anh",
  // "Việt Nam") to pass at the chosen threshold: a known false positive, documented in ADR 0015. It
  // reaches the model, whose prompt refuses it, and the guard still checks the reply.
  it('lets every labelled on-topic question through and stops every labelled off-topic one but one', () => {
    const onTopic = [...REGULATION_QUESTIONS, ...HANDBOOK_QUESTIONS, ...RECORD_QUESTIONS].map((q) => q.question);
    const offTopic = OFF_TOPIC_QUESTIONS.map((q) => q.question);
    const truePositives = onTopic.filter(passes).length;
    const falsePositives = offTopic.filter(passes).length;
    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / onTopic.length;
    console.info(
      `advisor topic gate: precision ${(precision * 100).toFixed(1)}%, recall ${(recall * 100).toFixed(1)}% ` +
        `(${onTopic.length} on-topic, ${offTopic.length} off-topic questions)`,
    );
    expect(onTopic.filter((q) => !passes(q))).toEqual([]);
    expect(offTopic.filter(passes)).toEqual(['Dịch câu này sang tiếng Anh: tôi yêu Việt Nam']);
  });

  it('asks for consent, without the model, when an own-record question has no consent', () => {
    expect(gate(index, ['Lộ trình của mình có lỗi gì không?'], false).decision).toBe('needs_consent');
    expect(gate(index, ['Lộ trình của mình có lỗi gì không?'], true).decision).toBe('answer');
    // A regulation question still gets a general answer without consent (UC-08 A1).
    expect(gate(index, ['Mình còn thiếu bao nhiêu tín chỉ để tốt nghiệp?'], false).decision).toBe('answer');
    // A course is catalogue data, not the student's record.
    expect(gate(index, ['What are the prerequisites of my course CS163?'], false).decision).toBe('answer');
  });

  it('gates a short follow-up together with the question before it', () => {
    expect(gate(index, ['Học kỳ chính được đăng ký tối đa bao nhiêu tín chỉ?', 'còn chương trình đại trà?'], true).decision).toBe('answer');
    expect(gate(index, ['Học kỳ chính được đăng ký tối đa bao nhiêu tín chỉ?', 'Write a poem about the sea'], true).decision).toBe('answer');
    expect(gate(index, ['What is the capital of France?', 'and of Spain?'], true).decision).toBe('off_topic');
  });

  // Offline red team of PR #77 (ADR 0015): two real questions the gate refused, and two off-topic
  // ones that "<word> <digits>" let through as if they named a course.
  it('lets through questions typed without diacritics or in students’ words, and reads only real course codes', () => {
    expect(passes('lam sao de phuc khao diem thi')).toBe(true);
    expect(passes('Có được học vượt để ra trường sớm không?')).toBe(true);
    expect(gate(index, ['Write an essay of 500 words about climate change.'], true).decision).toBe('off_topic');
    expect(gate(index, ['In 2024 who won the football World Cup qualifiers in Asia?'], true).decision).toBe('off_topic');
    expect(gate(index, ['Can I take cs163 next term?'], true).courseIntent).toBe(true);
    expect(gate(index, ['Can I take CS 163 next term?'], true).courseIntent).toBe(true);
  });

  it('returns the retrieved clauses for the prompt', () => {
    const result = gate(index, ['How many credits can I take in a term?'], true);
    expect(result.regulationMatch).toBe(true);
    expect(result.hits.map((h) => h.clause.id)).toContain('qd-1175-2021/d7/k2/b');
  });

  it('reads own-record intent in both languages, with or without diacritics', () => {
    expect(hasRecordIntent("What's my GPA?")).toBe(true);
    expect(hasRecordIntent('diem cua minh the nao')).toBe(true);
    expect(hasRecordIntent('Tôi bị đau đầu thì uống thuốc gì?')).toBe(false);
    expect(hasRecordIntent('my cat is cute')).toBe(false);
  });
});
