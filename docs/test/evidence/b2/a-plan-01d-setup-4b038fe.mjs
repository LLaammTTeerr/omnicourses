// Carry-over on 4b038fe: PLAN-01d's starting board as on 778d120 (CS469 in 2026-1, CS470 and CS420 in 2026-2, a 4-credit slot of
// "Kiến thức Computer Science (A): tự chọn" in 2026-3).
import { call, signInApi } from './c-lib.mjs';
const t = (await signInApi('b2-s15@example.com')).token;
const id = 'a1e740c8-7b68-4766-85ad-7f6c7231b528';
const show = (j) => JSON.stringify(j.terms.map((x) => [`${x.term.year}-${x.term.number}`, x.placements.map((p) => p.courseCode ?? `slot(${p.credits})`)]));
const cur = (await call('GET', '/programs/APCS/curricula/2024', { token: t, quiet: true })).json;
const AE = cur.requirementGroups.find((g) => g.name === 'Kiến thức Computer Science (A): tự chọn').id;
const c = (code) => ({ kind: 'course', courseCode: code });
await call('PUT', `/plans/${id}/placements`, { token: t, show, body: { terms: [
  { term: { year: 2026, number: 1 }, placements: ['CS160', 'CS201', 'CS202', 'MTH251', 'CS469'].map(c) },
  { term: { year: 2026, number: 2 }, placements: [c('CS470'), c('CS420')] },
  { term: { year: 2026, number: 3 }, placements: [{ kind: 'slot', requirementGroupId: AE, credits: 4 }] },
] } });
