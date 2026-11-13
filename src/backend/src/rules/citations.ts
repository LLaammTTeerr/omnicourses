// Where each rule of the engine comes from: one constant per citation, each built from the
// clauses of QĐ 1175/QĐ-KHTN it names. citations.spec.ts checks every clause against the
// regulation's own text (`advisor/regulations/qd-1175-2021.json`), the one the F8 advisor cites,
// so a wrong clause number fails a test instead of reaching a student.

/** The training regulation, Quy chế đào tạo trình độ đại học, issued with QĐ 1175/QĐ-KHTN (2021). */
export const REGULATION = 'QĐ 1175/QĐ-KHTN';

/**
 * The clauses each citation names, as article.clause[.point]: '7.2' is Điều 7, khoản 2; '17.3.b'
 * is Điều 17, khoản 3, điểm b.
 */
export const CITED_CLAUSES = {
  /** The credit caps per term (ADR 0012). */
  caps: ['7.2'],
  /** Going outside the caps by petition. */
  petition: ['7.2.b'],
  /** What a term's load counts: new courses, retakes and grade improvements. */
  load: ['7.1.b'],
  prerequisite: ['3.1.c'],
  /** Điều 6.5: the term plan says which courses open; Điều 7.1.a: students register for those. */
  offering: ['6.5', '7.1.a'],
  improvement: ['14.2'],
  curriculum: ['15.1'],
  graduation: ['17.3.b'],
  noProsecutionOrSuspension: ['17.3.a'],
  defenceEducationCertificate: ['17.3.c'],
  foreignLanguageStandard: ['17.3.d'],
  itStandard: ['17.3.e'],
  studyTimeLimit: ['2.7'],
} as const satisfies Record<string, readonly string[]>;

type Cited = keyof typeof CITED_CLAUSES;

const cite = (name: Cited): string => `${REGULATION} Điều ${CITED_CLAUSES[name].join(', ')}`;

export const CAP_CITATION = cite('caps');
export const PETITION_CITATION = cite('petition');
export const LOAD_CITATION = cite('load');
export const PREREQUISITE_CITATION = cite('prerequisite');
export const OFFERING_CITATION = cite('offering');
export const IMPROVEMENT_CITATION = cite('improvement');
export const CURRICULUM_CITATION = cite('curriculum');
export const GRADUATION_CITATION = cite('graduation');
export const NO_PROSECUTION_CITATION = cite('noProsecutionOrSuspension');
export const DEFENCE_CERTIFICATE_CITATION = cite('defenceEducationCertificate');
export const FOREIGN_LANGUAGE_CITATION = cite('foreignLanguageStandard');
export const IT_STANDARD_CITATION = cite('itStandard');
export const STUDY_TIME_CITATION = cite('studyTimeLimit');

/** A course placed twice breaks the plan model, not a clause of the regulation. */
export const PLAN_MODEL_CITATION = 'ADR 0014';
