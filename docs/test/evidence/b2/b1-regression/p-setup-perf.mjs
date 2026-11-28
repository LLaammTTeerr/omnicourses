// Account P for the B1 regression on staging (b1-perf exists on production only): sign up
// b1-run-<RUN>-perf@example.com, onboard it to APCS 2024 and save the completion fixture as committed in 95ea154
// (read with git show, so a CRLF checkout does not change the bytes). Prints statuses and the fixture's SHA-256 only.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const API = 'https://stag-omnicourses.lamter.cc/api';
const EMAIL = `b1-run-${process.env.RUN ?? 'r27a'}-perf@example.com`;
const call = async (method, path, body, token) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const bytes = execFileSync('git', ['show', '95ea154:src/backend/test/fixtures/apcs-2024-completion.json']);
console.log('fixture sha256', createHash('sha256').update(bytes).digest('hex'));
const up = await call('POST', '/auth/sign-up', { email: EMAIL, password: 'correct horse battery', displayName: 'Test Student', acceptedTerms: true });
console.log(EMAIL, 'sign-up', up.status);
const token = up.json.token;
console.log('onboarding', (await call('PUT', '/users/me/onboarding', { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true }, token)).status);
console.log('transcript PUT', (await call('PUT', '/users/me/transcript', bytes.toString('utf8'), token)).status);
const rows = (await call('GET', '/users/me/transcript', undefined, token)).json;
console.log('rows held', (rows.rows ?? rows).length);
