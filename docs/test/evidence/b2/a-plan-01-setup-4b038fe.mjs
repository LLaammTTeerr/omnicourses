// Carry-over on staging 4b038fe: puts L back to PLAN-01a's starting state (one empty "Default plan", no What-if copy).
import { call, signInApi } from './c-lib.mjs';
const t = (await signInApi('b2-s15@example.com')).token;
const show = (j) => JSON.stringify(j.terms.map((x) => [`${x.term.year}-${x.term.number}`, x.placements.map((p) => p.courseCode ?? `slot(${p.credits})`)]));
const list = (await call('GET', '/plans', { token: t, show: (j) => JSON.stringify(j.plans.map((p) => [p.name, p.id])) })).json.plans;
for (const p of list) await call('GET', `/plans/${p.id}`, { token: t, show });
for (const p of list.filter((x) => x.name !== 'Default plan')) await call('DELETE', `/plans/${p.id}`, { token: t });
const id = list.find((x) => x.name === 'Default plan').id;
await call('PUT', `/plans/${id}/placements`, { token: t, body: { terms: [] }, show });
await call('GET', '/plans', { token: t, show: (j) => JSON.stringify(j.plans.map((p) => [p.name, p.id])) });
