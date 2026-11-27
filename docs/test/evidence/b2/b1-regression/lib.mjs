// Shared helpers for the B1 API cases run against staging (docs/test/test-cases-b1.md).
// Synthetic example.com accounts only. Tokens are kept in a cache file outside the repository
// (TOKEN_CACHE) so a rerun does not sign up or sign in again; they are never logged.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

export const API = process.env.API ?? 'https://stag-omnicourses.lamter.cc/api';
export const RUN = process.env.RUN; // random run id: accounts are b1-run-<RUN>-<role>@example.com
export const PW = 'correct horse battery';
export const NAME = 'Test Student';
const UA = 'B1 acceptance run (Node 22 fetch)';
const CACHE = process.env.TOKEN_CACHE;
const LEDGER = process.env.LEDGER; // every account created is appended here, for the clean-up
if (!RUN || !CACHE || !LEDGER) throw new Error('Set RUN, TOKEN_CACHE and LEDGER');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
export const email = (role) => `b1-run-${RUN}-${role}@example.com`;

// Sign-up and sign-in accept 10 requests a minute from one address, shared with the browser runs
// going on at the same time: space them 21 s apart here.
let lastPasswordCall = 0;
async function pace() {
  const wait = lastPasswordCall + 21_000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastPasswordCall = Date.now();
}

export async function call(method, path, { body, token, raw } = {}) {
  const headers = { 'user-agent': UA };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const save = () => writeFileSync(CACHE, JSON.stringify(cache));

/** A signed-in account for a role: from the cache, or signed up (a 409 means it exists: sign in). */
export async function account(role) {
  const address = email(role);
  const cached = cache[address];
  if (cached && (await call('GET', '/users/me', { token: cached.token })).status === 200) return cached;
  await pace();
  let r = await call('POST', '/auth/sign-up', { body: { email: address, password: PW, displayName: NAME, acceptedTerms: true } });
  if (r.status === 201) appendFileSync(LEDGER, address + '\n');
  if (r.status === 409) {
    await pace();
    r = await call('POST', '/auth/sign-in', { body: { email: address, password: PW } });
  }
  if (!r.json?.token) throw new Error(`No session for ${address}: ${r.status} ${r.text.slice(0, 200)}`);
  cache[address] = { email: address, id: r.json.user.id, token: r.json.token };
  save();
  return cache[address];
}
/** A second session for the same account. */
export async function signInAgain(role) {
  await pace();
  const r = await call('POST', '/auth/sign-in', { body: { email: email(role), password: PW } });
  return r;
}
export function forget(role) { delete cache[email(role)]; save(); }

export const onboard = (token, cohort = 2024) =>
  call('PUT', '/users/me/onboarding', {
    token,
    body: { program: 'APCS', cohort, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true },
  });

// Catalog names and credits of the courses the cases use (test-cases-b1.md §7).
const CATALOG = {
  CS160: ['Nhập môn Tin học', 4], CS163: ['Cấu trúc dữ liệu', 4], CS201: ['Lập trình hệ thống', 4],
  CS202: ['Các hệ thống lập trình', 4], CS250: ['Cấu trúc rời rạc I', 4], CS300: ['Nhập môn Công nghệ phần mềm', 4],
  CS323: ['Đạo đức khoa học', 4], CS333: ['Nhập môn Hệ điều hành', 4], CS486: ['Nhập môn các hệ cơ sở dữ liệu', 4],
  ECE341: ['Phần cứng máy tính', 4], CS251: ['Cấu trúc logic', 4], CS252: ['Tư duy tính toán', 4],
  CS311: ['Cấu trúc tính toán', 4], CS320: ['Nguyên lý các ngôn ngữ lập trình', 4], CS350: ['Thuật toán và độ phức tạp', 4],
  CM102: ['Tư duy phản biện', 4], BAA00101: ['Triết học Mác - Lênin', 3], BAA00102: ['Kinh tế chính trị Mác - Lênin', 2],
  BAA00103: ['Chủ nghĩa xã hội khoa học', 2], ZZ999: ['Unknown Synthetic Course', 4],
};
/** `row('CS160', 'graded', 8.0, '2024-1')` is the case notation `CS160 4 graded 8.0 2024-1`. */
export function row(code, result, grade, term) {
  const [courseName, credits] = CATALOG[code];
  const [year, number] = term.split('-').map(Number);
  return { courseCode: code, courseName, credits, result, grade: result === 'graded' ? grade : null, term: { year, number } };
}
export const saveTranscript = (token, rows) => call('PUT', '/users/me/transcript', { token, body: { rows } });
export const audit = (token) => call('GET', '/users/me/audit', { token });

const results = [];
let current;
export function begin(id) { current = { id, checks: [] }; results.push(current); log(id); }
export function check(what, pass, actual) {
  current.checks.push({ what, pass: !!pass });
  const shown = typeof actual === 'string' ? actual : JSON.stringify(actual);
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}${actual === undefined ? '' : ` -> ${shown}`}`);
}
export function note(text) { log(`  note ${text}`); }
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function summary() {
  const line = results.map((r) => `${r.id}:${r.checks.every((c) => c.pass) ? 'all checks ok' : 'CHECK FAILED'}`).join(' ');
  console.log('SUMMARY (checks of this script only; the report gives each case its result) ' + line);
}
