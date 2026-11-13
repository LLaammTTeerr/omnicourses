// The curriculum's value domains as plain constants, apart from the entity files, so the rule
// engine and the DTOs take them without importing TypeORM. The entities re-export them.

/**
 * The training type the regulation names (GLOSSARY): Tiên tiến (advanced), Liên kết (joint),
 * Chất lượng cao (high_quality), đại trà (standard). It sets the terms and the credit caps
 * (QĐ 1175/QĐ-KHTN Điều 6.4 and 7.2, ADR 0012).
 */
export const TRAINING_TYPES = ['advanced', 'joint', 'high_quality', 'standard'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

/** ADR 0005: compulsory groups have a fixed credits_total, elective groups a credits_total_min. */
export const REQUIREMENT_GROUP_KINDS = ['compulsory', 'elective'] as const;
export type RequirementGroupKind = (typeof REQUIREMENT_GROUP_KINDS)[number];
