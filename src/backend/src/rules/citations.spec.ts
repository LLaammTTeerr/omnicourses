import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as citations from './citations.js';
import { CITED_CLAUSES, REGULATION } from './citations.js';

// The regulation as the F8 advisor reads it, generated from the PDF (advisor/regulations/README.md).
const regulation = JSON.parse(readFileSync(join(__dirname, '..', 'advisor', 'regulations', 'qd-1175-2021.json'), 'utf8')) as {
  id: string;
  shortName: string;
  clauses: { id: string; label: string }[];
};
const labels = new Map(regulation.clauses.map((c) => [c.id, c.label]));

/** '17.3.b' → 'qd-1175-2021/d17/k3/b' */
const clauseId = (ref: string): string => {
  const [article, clause, point] = ref.split('.');
  return [regulation.id, `d${article}`, `k${clause}`, ...(point ? [point] : [])].join('/');
};

/** 'Điều 17, khoản 3, điểm b' → '17.3.b', read from the regulation, not from the code. */
const refOfLabel = (label: string): string => {
  const match = /^Điều (\d+), khoản (\d+)(?:, điểm (\p{L}))?$/u.exec(label);
  if (!match) throw new Error(`Unexpected clause label: ${label}`);
  return match.slice(1).filter(Boolean).join('.');
};

describe('the engine cites clauses that exist in QĐ 1175/QĐ-KHTN', () => {
  it('names the regulation as the regulation names itself', () => {
    expect(REGULATION).toBe(regulation.shortName);
  });

  it.each(Object.entries(CITED_CLAUSES))('%s: every clause it names is in the regulation', (_, refs) => {
    for (const ref of refs) expect(labels.has(clauseId(ref)), ref).toBe(true);
  });

  it('builds each citation from the labels of its clauses', () => {
    const byName = (name: keyof typeof CITED_CLAUSES) => `${regulation.shortName} Điều ${CITED_CLAUSES[name].map((ref) => refOfLabel(labels.get(clauseId(ref))!)).join(', ')}`;
    expect(citations.CAP_CITATION).toBe(byName('caps'));
    expect(citations.OFFERING_CITATION).toBe(byName('offering'));
    expect(citations.GRADUATION_CITATION).toBe(byName('graduation'));
    expect(citations.STUDY_TIME_CITATION).toBe(byName('studyTimeLimit'));
  });

  it('keeps the citation strings the API returns', () => {
    expect({
      cap: citations.CAP_CITATION,
      petition: citations.PETITION_CITATION,
      load: citations.LOAD_CITATION,
      prerequisite: citations.PREREQUISITE_CITATION,
      offering: citations.OFFERING_CITATION,
      improvement: citations.IMPROVEMENT_CITATION,
      curriculum: citations.CURRICULUM_CITATION,
      graduation: citations.GRADUATION_CITATION,
      noProsecution: citations.NO_PROSECUTION_CITATION,
      defence: citations.DEFENCE_CERTIFICATE_CITATION,
      foreignLanguage: citations.FOREIGN_LANGUAGE_CITATION,
      it: citations.IT_STANDARD_CITATION,
      studyTime: citations.STUDY_TIME_CITATION,
      planModel: citations.PLAN_MODEL_CITATION,
    }).toEqual({
      cap: 'QĐ 1175/QĐ-KHTN Điều 7.2',
      petition: 'QĐ 1175/QĐ-KHTN Điều 7.2.b',
      load: 'QĐ 1175/QĐ-KHTN Điều 7.1.b',
      prerequisite: 'QĐ 1175/QĐ-KHTN Điều 3.1.c',
      offering: 'QĐ 1175/QĐ-KHTN Điều 6.5, 7.1.a',
      improvement: 'QĐ 1175/QĐ-KHTN Điều 14.2',
      curriculum: 'QĐ 1175/QĐ-KHTN Điều 15.1',
      graduation: 'QĐ 1175/QĐ-KHTN Điều 17.3.b',
      noProsecution: 'QĐ 1175/QĐ-KHTN Điều 17.3.a',
      defence: 'QĐ 1175/QĐ-KHTN Điều 17.3.c',
      foreignLanguage: 'QĐ 1175/QĐ-KHTN Điều 17.3.d',
      it: 'QĐ 1175/QĐ-KHTN Điều 17.3.e',
      studyTime: 'QĐ 1175/QĐ-KHTN Điều 2.7',
      planModel: 'ADR 0014',
    });
  });
});
