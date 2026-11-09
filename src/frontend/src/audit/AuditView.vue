<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { termName } from '../terms.js';
import type { CourseCoverage, DegreeAudit, GraduationCondition, GroupCoverage } from './api.js';
import AuditGate from './AuditGate.vue';
import { AUDIT_MESSAGES } from './messages.js';
import { combinedNamesOf, conditionFor, conditionLabel, courseName, formatScore, groupName, notPassed, shownGroups, useAudit } from './present.js';

// The degree audit (F3, UC-03, ADR 0013): every requirement group with the courses counted in it, its credits and
// what is missing; the minimums across groups; the graduation conditions with the clause each one cites; each term's
// load and averages; and the courses that count toward nothing. All of it is the API's answer, shown as it comes
// (AGENTS.md hard rule 1).
const locale = useLocale();
const m = useMessages(AUDIT_MESSAGES);
const { status, data, error, reload } = useAudit();
const audit = computed(() => (data.value?.status === 'ready' ? data.value.audit : null));

// The dashboard links to a group, a combined minimum or the conditions by hash. The router scrolls before the audit
// has loaded, when the target does not exist yet, so the page scrolls to it once it is drawn.
const route = useRoute();
watch(
  () => [status.value, route.hash] as const,
  async ([loaded, hash]) => {
    if (loaded !== 'loaded' || !hash) return;
    await nextTick();
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  },
  { immediate: true },
);

const score = (value: number | null) => formatScore(value, locale.lang) ?? '–';

/** The grade, or the result when there is no grade (exempt, pass, fail), or nothing. */
function outcome(course: Pick<CourseCoverage, 'grade' | 'result'>): string {
  if (course.grade !== null) return score(course.grade);
  if (course.result === 'exempt' || course.result === 'pass' || course.result === 'fail') return m.value.results[course.result];
  return '–';
}

/** What a group still needs, in words: the API's remaining credits, and for a compulsory group its courses not passed. */
function missingLine(group: GroupCoverage): string {
  if (group.met) return m.value.nothingMissing;
  const parts: string[] = [];
  if (group.remainingCredits !== null) parts.push(m.value.missingCredits(group.remainingCredits));
  if (group.inProgressCredits) parts.push(m.value.inProgress(group.inProgressCredits));
  const left = notPassed(group);
  if (left.length) parts.push(`${m.value.toPass}: ${left.map((course) => course.code).join(', ')}`);
  return parts.join(' · ');
}

const groupCondition = (a: DegreeAudit, id: string) => conditionFor(a, `group:${id}`);
const combinedCondition = (a: DegreeAudit, id: string) => conditionFor(a, `combined:${id}`);
// The list's heading says the status in words; the glyph repeats it beside each condition.
const stateGlyph = (condition: GraduationCondition) => (condition.status === 'met' ? '✓' : condition.status === 'not_met' ? '○' : '?');

usePageTitle(() => m.value.auditTitle);
</script>

<template>
  <div class="page audit-page">
    <header class="page-head">
      <div>
        <h1>{{ m.auditTitle }}</h1>
        <p>{{ m.auditLead }}</p>
        <p v-if="audit" class="small t3" data-test="who">{{ m.curriculum(audit.curriculumCode, audit.credits.yearLevel) }}</p>
      </div>
      <div class="head-actions">
        <RouterLink class="btn" :to="{ name: 'transcript' }"><Icon name="file" size="sm" />{{ m.openTranscript }}</RouterLink>
      </div>
    </header>

    <AuditGate :status="status" :data="data" :error="error" @retry="reload">
      <template #default="{ audit: a }">
        <section id="graduation" class="card au-summary" :aria-label="m.graduation">
          <div class="au-sum-row">
            <div class="au-fig" data-test="graduation">
              <span class="label">{{ m.graduation }}</span>
              <span :class="['chip', a.graduation.status === 'done' ? 'ok' : 'warn']">
                <Icon :name="a.graduation.status === 'done' ? 'check' : 'alert'" size="sm" />
                {{ a.graduation.status === 'done' ? m.graduationDone : m.graduationNotYet }}
              </span>
            </div>
            <div class="au-fig" data-test="credits">
              <span class="label">{{ m.creditsTitle }}</span>
              <b>{{ m.creditsOf(a.credits.towardTotal, a.credits.totalRequired) }}</b>
              <span class="small t2">
                <template v-if="a.credits.remaining !== null">{{ m.remaining(a.credits.remaining) }} · </template>
                {{ m.inProgress(a.credits.inProgressTowardTotal) }} · {{ m.accumulated(a.credits.accumulated) }}
              </span>
            </div>
            <div class="au-fig" data-test="gpa">
              <span class="label">{{ m.gpaTitle }}</span>
              <dl class="au-dl small">
                <dt>{{ m.average }}</dt><dd>{{ score(a.gpa.average) }}</dd>
                <dt>{{ m.accumulatedAverage }}</dt><dd>{{ score(a.gpa.accumulatedAverage) }}</dd>
                <dt>{{ m.fourPoint }}</dt><dd>{{ score(a.gpa.accumulatedAverageFourPoint) }}</dd>
                <dt>{{ m.classification }}</dt><dd>{{ a.gpa.classification ? m.classifications[a.gpa.classification] : '–' }}</dd>
              </dl>
            </div>
          </div>

          <div class="au-conditions">
            <div v-if="a.graduation.unmet.length" data-test="conditions-unmet">
              <h3>{{ m.unmetTitle }}</h3>
              <ul>
                <li v-for="c in a.graduation.unmet" :key="c.id"><span class="state todo" aria-hidden="true">{{ stateGlyph(c) }}</span> {{ conditionLabel(a, c, m) }} <span class="cite">{{ c.citation }}</span></li>
              </ul>
            </div>
            <div v-if="a.graduation.met.length" data-test="conditions-met">
              <h3>{{ m.metTitle }}</h3>
              <ul>
                <li v-for="c in a.graduation.met" :key="c.id"><span class="state ok" aria-hidden="true">{{ stateGlyph(c) }}</span> {{ conditionLabel(a, c, m) }} <span class="cite">{{ c.citation }}</span></li>
              </ul>
            </div>
            <div v-if="a.graduation.notChecked.length" data-test="conditions-not-checked">
              <h3>{{ m.notCheckedTitle }}</h3>
              <p class="small t2">{{ m.notCheckedText }}</p>
              <ul>
                <li v-for="c in a.graduation.notChecked" :key="c.id"><span class="state" aria-hidden="true">{{ stateGlyph(c) }}</span> {{ conditionLabel(a, c, m) }} <span class="cite">{{ c.citation }}</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section
          v-for="{ group, colour, glyph } in shownGroups(a)"
          :id="`group-${group.id}`"
          :key="group.id"
          :class="['card', 'au-group', groupClass(colour)]"
          :aria-labelledby="`au-group-${group.id}`"
          data-test="group"
        >
          <div class="au-group-head">
            <span class="glyph" aria-hidden="true">{{ glyph }}</span>
            <div class="au-group-title">
              <h2 :id="`au-group-${group.id}`">{{ group.name }}</h2>
              <p class="small t3">
                {{ m.kinds[group.kind] }} ·
                <template v-if="group.requiredCredits !== null">{{ m.groupCredits(group.passedCredits, group.requiredCredits) }}</template>
                <template v-else>{{ combinedNamesOf(a, group.id).length ? m.noMinimumIn(combinedNamesOf(a, group.id).join(', ')) : m.noMinimum }}</template>
                <template v-if="group.inProgressCredits"> · {{ m.inProgress(group.inProgressCredits) }}</template>
              </p>
              <p v-if="group.overflowInCredits || group.overflowOutCredits" class="small t2">
                <template v-if="group.overflowInCredits">{{ m.overflowIn(group.overflowInCredits) }}</template>
                <template v-if="group.overflowInCredits && group.overflowOutCredits"> · </template>
                <template v-if="group.overflowOutCredits">{{ m.overflowOut(group.overflowOutCredits, groupName(a, group.overflowToGroupId)) }}</template>
              </p>
            </div>
            <span :class="['chip', group.met ? 'ok' : 'warn']" data-test="group-state">{{ group.met ? `✓ ${m.met}` : `○ ${m.notMet}` }}</span>
          </div>

          <div class="au-missing" data-test="missing">
            <p><b>{{ m.missing }}:</b>{{ ` ${missingLine(group)}` }}</p>
            <span v-if="groupCondition(a, group.id)" class="cite">{{ m.citation }}: {{ groupCondition(a, group.id)!.citation }}</span>
          </div>

          <div class="table-wrap">
            <table class="table au-courses" :aria-label="m.courseTable(group.name)">
              <thead>
                <tr>
                  <th scope="col">{{ m.code }}</th>
                  <th scope="col">{{ m.course }}</th>
                  <th scope="col" class="r">{{ m.credits }}</th>
                  <th scope="col">{{ m.status }}</th>
                  <th scope="col" class="r">{{ m.grade }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="course in group.courses" :key="course.code" :class="`st-${course.status}`" :data-test="`course-${course.code}`">
                  <td><span class="code">{{ course.code }}</span></td>
                  <td>
                    {{ courseName(course, locale.lang) }}
                    <template v-if="!course.countsTowardTotal">{{ ' ' }}<span class="chip">{{ m.outsideTotal }}</span></template>
                    <template v-if="!course.countsTowardGpa">{{ ' ' }}<span class="chip">{{ m.outsideGpa }}</span></template>
                  </td>
                  <td class="r">{{ course.credits }}</td>
                  <td>
                    <span :class="['status', course.status]">{{ m.statuses[course.status] }}</span>
                    <span v-if="course.status === 'counted_in_other_group' && groupName(a, course.countedInGroupId)" class="small t3">
                      · {{ m.countedIn(groupName(a, course.countedInGroupId)!) }}
                    </span>
                  </td>
                  <td class="r">{{ outcome(course) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="a.combinedMinimums.length" class="card" aria-labelledby="au-combined-title">
          <h2 id="au-combined-title">{{ m.combinedTitle }}</h2>
          <ul class="au-list">
            <li v-for="combined in a.combinedMinimums" :id="`combined-${combined.id}`" :key="combined.id" data-test="combined">
              <div class="au-list-head">
                <b>{{ combined.name }}</b>
                <span :class="['chip', combined.met ? 'ok' : 'warn']">{{ combined.met ? `✓ ${m.met}` : `○ ${m.notMet}` }}</span>
              </div>
              <p class="small t2">
                {{ m.combinedCredits(combined.credits, combined.creditsMin)
                }}<template v-if="combined.inProgressCredits"> · {{ m.inProgress(combined.inProgressCredits) }}</template
                ><template v-if="!combined.met"> · {{ m.missing }}: {{ m.missingCredits(combined.remainingCredits) }}</template>
              </p>
              <p class="small t3">{{ m.combinedOf(combined.groupIds.map((id) => groupName(a, id) ?? id).join(', ')) }}</p>
              <p v-if="combined.officialNotes" class="small t3">{{ combined.officialNotes }}</p>
              <span v-if="combinedCondition(a, combined.id)" class="cite">{{ m.citation }}: {{ combinedCondition(a, combined.id)!.citation }}</span>
            </li>
          </ul>
        </section>

        <section v-if="a.terms.length" class="card flush" aria-labelledby="au-terms-title">
          <div class="card-head"><h2 id="au-terms-title">{{ m.termsTitle }}</h2></div>
          <div class="table-wrap">
            <table class="table au-terms" data-test="terms">
              <thead>
                <tr>
                  <th scope="col">{{ m.term }}</th>
                  <th scope="col" class="r">{{ m.load }}</th>
                  <th scope="col" class="r">{{ m.passed }}</th>
                  <th scope="col" class="r">{{ m.termAverage }}</th>
                  <th scope="col" class="r">{{ m.cumulative }}</th>
                  <th scope="col">{{ m.status }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in a.terms" :key="`${t.term.year}-${t.term.number}`">
                  <td>
                    <b>{{ termName(t.term, locale.lang) }}</b>
                    <span v-if="t.kind" class="small t3"><br />{{ m.termKinds[t.kind] }}<template v-if="t.caps"> · {{ m.caps(t.caps.min, t.caps.max) }}</template></span>
                  </td>
                  <td class="r">{{ t.credits }}</td>
                  <td class="r">{{ t.passedCredits }}</td>
                  <td class="r">{{ score(t.average) }}</td>
                  <td class="r">{{ score(t.cumulativeAccumulatedAverage) }}</td>
                  <td>
                    <span v-if="t.capViolations.length === 0 && t.caps" class="small t3">{{ m.noViolation }}</span>
                    <div v-for="v in t.capViolations" :key="v.rule" class="au-violation" data-test="cap-violation">
                      <span class="chip warn">{{ m.capRules[v.rule](v.credits, v.limit) }}</span>
                      <span class="cite">{{ v.citation }}</span>
                      <span class="small t3">{{ v.petition }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="a.unmatchedCourses.length" class="card" aria-labelledby="au-unmatched-title" data-test="unmatched">
          <h2 id="au-unmatched-title">{{ m.unmatchedTitle }}</h2>
          <p class="small t2">{{ m.unmatchedText }}</p>
          <ul class="au-list">
            <li v-for="course in a.unmatchedCourses" :key="course.code">
              <span><span class="code">{{ course.code }}</span>{{ ` ${course.name} · ${m.creditsShort(course.credits)} · ${outcome(course)}` }}</span>
            </li>
          </ul>
        </section>

        <section v-if="a.warnings.length" class="card" aria-labelledby="au-warnings-title" data-test="warnings">
          <h2 id="au-warnings-title">{{ m.warningsTitle }}</h2>
          <ul class="au-list">
            <li v-for="w in a.warnings" :key="`${w.code}-${w.courseCode}`" class="small">{{ m.warnings[w.code](w.courseCode) }}</li>
          </ul>
        </section>

        <p class="small t3">{{ m.engineNote }}</p>
      </template>
    </AuditGate>
  </div>
</template>

<style>
.audit-page .au-sum-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.au-fig { display: grid; gap: 6px; align-content: start; min-width: 0; }
.au-fig .label { font-size: 13px; font-weight: 650; color: var(--ink-3); }
.au-fig > b { font-size: 22px; letter-spacing: -0.02em; }
.au-fig .chip { white-space: normal; min-height: 30px; padding: 4px 12px; justify-self: start; }
.au-dl { display: grid; grid-template-columns: auto auto; gap: 2px 12px; margin: 0; justify-content: start; }
.au-dl dt { color: var(--ink-3); }
.au-dl dd { margin: 0; font-weight: 650; }
.au-conditions { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
.au-conditions h3 { margin-bottom: 6px; }
.au-conditions ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 6px; font-size: 14px; }
.au-conditions li { overflow-wrap: anywhere; }
.audit-page .state { font-weight: 650; color: var(--ink-3); }
.audit-page .state.ok { color: color-mix(in oklab, var(--ok) 80%, var(--ink)); }
.audit-page .state.todo { color: color-mix(in oklab, var(--warn) 80%, var(--ink)); }
.audit-page .cite {
  display: inline-block; font-size: 12px; font-weight: 600; color: var(--ink-3); padding: 0 6px; border-radius: 6px;
  border: 1px solid var(--edge); white-space: normal; overflow-wrap: anywhere;
}
.au-group { display: grid; gap: 12px; }
.au-group-head { display: flex; gap: 12px; align-items: flex-start; }
.au-group-title { flex: 1; min-width: 0; display: grid; gap: 2px; }
.au-group-title h2 { overflow-wrap: anywhere; }
.au-group-head > .chip { white-space: nowrap; }
.au-missing { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; justify-content: space-between; font-size: 14px; padding: 10px 12px; border-radius: 10px; background: var(--c-soft); }
.au-courses td { padding: 8px 12px; }
.au-courses .chip { margin-left: 6px; min-height: 20px; font-size: 11.5px; }
.au-courses .status { font-weight: 650; font-size: 13px; }
.au-courses .status.passed { color: color-mix(in oklab, var(--ok) 80%, var(--ink)); }
.au-courses .status.failed { color: color-mix(in oklab, var(--bad) 80%, var(--ink)); }
.au-courses .status.in_progress { color: var(--c-ink); }
.au-courses .status.not_taken, .au-courses .status.counted_in_other_group { color: var(--ink-3); }
.au-list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 12px; }
.au-list > li { display: grid; gap: 4px; justify-items: start; overflow-wrap: anywhere; }
.au-list-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.au-violation { display: grid; gap: 4px; justify-items: start; }
.au-violation + .au-violation { margin-top: 8px; }
.au-violation .chip { white-space: normal; }
@media (max-width: 760px) {
  .audit-page .au-sum-row { grid-template-columns: minmax(0, 1fr); }
}
</style>
