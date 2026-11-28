export const SINGLE_KEY_LOCKS = {
  adminWrite: 11_012_001,
  accessManager: 11_012_002,
} as const;

export const NAMESPACED_LOCKS = {
  signInAttempt: 11_012_003,
  aiQuota: 3003,
} as const;
