import { call, signInApi } from './c-lib.mjs';
const t = (await signInApi('b2-s15@example.com')).token;
const id = 'a1e740c8-7b68-4766-85ad-7f6c7231b528';
const before = await call('GET', `/plans/${id}`, { token: t, show: (j) => JSON.stringify(j.terms.map((x) => [x.term, x.placements.map((p) => p.courseCode)])) });
await call('PUT', `/plans/${id}/placements`, { token: t, body: { terms: [{ term: { year: 2026, number: 1 }, placements: ['CS160', 'CS163', 'CS201', 'CS202', 'MTH251'].map((c) => ({ kind: 'course', courseCode: c })) }] }, show: (j) => JSON.stringify(j.terms.map((x) => [x.term, x.placements.map((p) => p.courseCode)])) });
