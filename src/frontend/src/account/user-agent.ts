// A short name for the device of a session ("Chrome · Windows"), from its User-Agent header. A guess for the
// student's eyes only: nothing depends on it, and an agent it does not recognise gives null.

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bCocCoc\//, 'Cốc Cốc'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\b(?:Headless)?Chrome\/|\bCriOS\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/\bAndroid\b/, 'Android'],
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bLinux\b/, 'Linux'],
];

const first = (agent: string, list: [RegExp, string][]) => list.find(([pattern]) => pattern.test(agent))?.[1];

export function describeDevice(agent: string | null): string | null {
  if (!agent) return null;
  const parts = [first(agent, BROWSERS), first(agent, SYSTEMS)].filter((part): part is string => part !== undefined);
  return parts.length ? parts.join(' · ') : null;
}
