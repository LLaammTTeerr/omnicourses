// ACAD-01e, plans part, API only: the load issue GET /api/plans/{id}/issues gives at 9, 10, 22 and 23 credits.
// Follow-up to p-acad-01e-planner.mjs, whose own extraction of the load issue from the answer was wrong (it printed
// "none" although the screen showed the card). Same plan "Caps 01e", same rows.
import { call, check, email, log, summary, tokenFor } from './p-lib.mjs';

const LOADS = [
  [9, ['CS160', 'BAA00101', 'BAA00102']],
  [10, ['CS160', 'CS163', 'BAA00102']],
  [22, ['CS160', 'CS163', 'CS201', 'CS202', 'CS250', 'BAA00102']],
  [23, ['CS160', 'CS163', 'CS201', 'CS202', 'BAA00101', 'BAA00102', 'BAA00103']],
];
const token = await tokenFor(email('01'));
const listed = (await call(token, 'GET', '/plans')).json;
const plan = (Array.isArray(listed) ? listed : listed.plans ?? listed.items).find((p) => p.name === 'Caps 01e');
for (const [credits, codes] of LOADS) {
  const put = await call(token, 'PUT', `/plans/${plan.id}/placements`, { terms: [{ term: { year: 2024, number: 1 }, placements: codes.map((courseCode) => ({ kind: 'course', courseCode })) }] });
  const iss = await call(token, 'GET', `/plans/${plan.id}/issues`);
  const kinds = {};
  for (const i of iss.json.issues) kinds[`${i.kind}:${i.code}`] = (kinds[`${i.kind}:${i.code}`] ?? 0) + 1;
  const load = iss.json.issues.filter((i) => i.code.startsWith('load_'));
  const term = iss.json.terms.find((t) => t.term.year === 2024 && t.term.number === 1);
  log(`${credits} credits: PUT ${put.status}; GET issues ${iss.status}; trainingType ${iss.json.trainingType}; term ${JSON.stringify(term)}; issues by kind:code ${JSON.stringify(kinds)}; load issues ${JSON.stringify(load)}`);
  check('ACAD-01e', `${credits} credits: PUT 200, caps { min: 10, max: 22 }`, put.status === 200 && JSON.stringify(term.caps) === '{"min":10,"max":22}', term.caps);
  if (credits === 9 || credits === 23) {
    const want = credits === 9 ? ['load_below_minimum', 10] : ['load_above_maximum', 22];
    const i = load[0];
    check('ACAD-01e', `${credits} credits: one ${want[0]}, kind flag, credits ${credits}, limit ${want[1]}, citation QĐ 1175/QĐ-KHTN Điều 7.2`, load.length === 1 && i.code === want[0] && i.kind === 'flag' && i.credits === credits && i.limit === want[1] && i.citation === 'QĐ 1175/QĐ-KHTN Điều 7.2', load);
  } else check('ACAD-01e', `${credits} credits: no load issue`, load.length === 0, load);
}
summary();
