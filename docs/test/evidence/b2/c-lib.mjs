// API helpers for the B2 API runs of 25 November 2026 (a-notif-01.mjs, a-share-01.mjs, a-adm-04.mjs).
// Node 22 or later (the run of 25 November 2026 used 24.19.0); no dependencies beyond b-lib.mjs. Synthetic b2- accounts only (test cases §1).
// Never prints a session token, a share token or a password: every printed line goes through redact().
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { API, PASSWORD, sleep } from './b-lib.mjs';

export { check, failureCount, log, sleep, ID } from './b-lib.mjs';

export const PROGRAM = { APCS: 'd3f524f8-e51b-42dd-91ac-013b15d5e033', KHMT: '74ce84b9-c698-43ea-8470-1988a50656a8' };

// Sign-in, sign-up and account deletion allow 10 requests a minute from one address (ADR 0002). Each waits until
// 7 s after the previous one, through the same stamp file as b-lib.mjs, so two scripts never crowd the limit.
const STAMP = path.join(os.tmpdir(), 'omnicourses-b2-last-sign-in.txt');
export async function authSlot() {
  const last = existsSync(STAMP) ? Number(readFileSync(STAMP, 'utf8')) || 0 : 0;
  const wait = last + 7000 - Date.now();
  if (wait > 0) await sleep(wait);
  writeFileSync(STAMP, String(Date.now()));
}

const secrets = [];
/** Prints `label` wherever `value` would appear (a share token, for example). */
export const secret = (value, label) => { if (value) secrets.push([value, label]); };
export const redact = (s) => {
  let out = String(s).replace(/"token":"[^"]+"/g, '"token":"…"');
  for (const [value, label] of secrets) out = out.split(value).join(label);
  return out;
};
// Every printed line goes through redact(), the `observed` part of check() included.
const print = console.log;
console.log = (...args) => print(redact(args.map(String).join(' ')));

/** One request. Prints the method, the route, the status and the answer (first 600 characters), redacted. */
export async function call(method, route, { token, body, raw, headers = {}, quiet = false, show } = {}) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const shown = show ? show(json, text) : quiet || !text ? '' : text.length > 600 ? `${text.slice(0, 600)}…` : text;
  console.log(redact(`  ${method} /api${route}${token ? '' : ' (no token)'} → ${res.status}${shown ? ` ${shown}` : ''}`));
  return { status: res.status, json, text, headers: res.headers };
}

/** API sign-in. Stops the run on a failure. Returns the answer's body (the token is never printed). */
export async function signInApi(email) {
  await authSlot();
  const r = await call('POST', '/auth/sign-in', { body: { email, password: PASSWORD } });
  if (r.status !== 200) { console.log(`STOPPED: sign-in as ${email} answered ${r.status}`); process.exit(2); }
  return r.json;
}

/** Signs the account up (or in, when it exists) and, unless `onboard` is false, onboards it to APCS 2024. */
export async function account(email, { onboard = true } = {}) {
  await authSlot();
  const up = await call('POST', '/auth/sign-up', { body: { email, password: PASSWORD, displayName: 'Test Student', acceptedTerms: true } });
  let token;
  if (up.status === 201) token = up.json.token;
  else token = (await signInApi(email)).token;
  if (onboard) {
    await call('PUT', '/users/me/onboarding', { token, body: { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true } });
  }
  return { token, created: up.status === 201, signUpStatus: up.status };
}

export async function deleteAccount(token) {
  await authSlot();
  return call('DELETE', '/users/me', { token, body: { password: PASSWORD } });
}

/** The Vietnam date (UTC+7) n days from today, YYYY-MM-DD. */
export const vnDate = (n = 0) => new Date(Date.now() + 7 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);

export const T_A = { rows: [
  { courseCode: 'CS160', courseName: 'Nhập môn Tin học', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'CM102', courseName: 'Tư duy độc lập', credits: 4, result: 'graded', grade: 7.5, term: { year: 2024, number: 1 } },
  { courseCode: 'MTH251', courseName: 'Vi tích phân I', credits: 4, result: 'graded', grade: 7.0, term: { year: 2024, number: 1 } },
] };
export const T_B = { rows: [
  { courseCode: 'PH211', courseName: 'Vật lý đại cương I', credits: 4, result: 'graded', grade: 6.5, term: { year: 2024, number: 1 } },
  { courseCode: 'CS163', courseName: 'Cấu trúc dữ liệu', credits: 4, result: 'graded', grade: 8.0, term: { year: 2024, number: 2 } },
] };

/** State kept between the parts of one case's run (IDs only), in the scratch folder given by STATE_DIR or the temp folder. */
export function state(name) {
  const file = path.join(process.env.STATE_DIR || os.tmpdir(), `omnicourses-b2-${name}-state.json`);
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  return { data, save: () => writeFileSync(file, JSON.stringify(data, null, 2)) };
}
