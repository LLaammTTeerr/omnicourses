// Puts L's plan back to PLAN-01c's starting board (CS469 in 2026-1 with the others, CS470 in 2026-2) after an attempt.
import { call, signInApi } from './c-lib.mjs';
const t = (await signInApi('b2-s15@example.com')).token;
const id = 'a1e740c8-7b68-4766-85ad-7f6c7231b528';
const show = (j) => JSON.stringify(j.terms.map((x) => [x.term, x.placements.map((p) => p.courseCode ?? `slot(${p.credits})`)]));
await call('GET', `/plans/${id}`, { token: t, show });
const c = (code) => ({ kind: 'course', courseCode: code });
await call('PUT', `/plans/${id}/placements`, { token: t, show, body: { terms: [
  { term: { year: 2026, number: 1 }, placements: ['CS160', 'CS201', 'CS202', 'MTH251', 'CS469'].map(c) },
  { term: { year: 2026, number: 2 }, placements: [c('CS470')] },
] } });
