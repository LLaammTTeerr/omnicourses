// After PLAN-01 and the PLAN-02 retests: CS420's offering terms, and what L and P keep.
import { call, signInApi } from './c-lib.mjs';
const show = (j) => JSON.stringify(j.terms.map((x) => [`${x.term.year}-${x.term.number}`, x.placements.map((p) => p.courseCode ?? `slot(${p.credits})`)]));
const l = (await signInApi('b2-s15@example.com')).token;
const cur = await call('GET', '/programs/APCS/curricula/2024', { token: l, quiet: true });
const all = cur.json.requirementGroups.flatMap((g) => g.courses);
console.log(`  CS420 offeringTerms = ${JSON.stringify(all.find((c) => c.code === 'CS420').offeringTerms)}; CS470 prerequisites = ${JSON.stringify(all.find((c) => c.code === 'CS470').prerequisites)}`);
const lp = await call('GET', '/plans', { token: l, show: (j) => JSON.stringify(j.plans.map((p) => [p.name, p.id])) });
for (const p of lp.json.plans) await call('GET', `/plans/${p.id}`, { token: l, show });
const p = (await signInApi('b2-s5@example.com')).token;
await call('GET', '/plans/e3ab2633-ac3b-4938-b374-23cfb81d0bd3', { token: p, show });
