/**
 * Code-point order: the same on every machine, unlike a locale collation (`localeCompare`). Every
 * order the rule engine, the curriculum reads and F12 promise is built on it.
 */
export const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
