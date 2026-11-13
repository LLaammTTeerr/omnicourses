import { byText } from '../common/by-text.js';
import type { CourseRules } from '../rules/inputs.js';
import type { Course } from './course.entity.js';
import type { Curriculum } from './curriculum.entity.js';
import type { CourseDto, CurriculumCourseDto, CurriculumDto, ProgramSummaryDto, RequirementGroupDto } from './curriculum.dto.js';
import type { Program } from './program.entity.js';
import type { RequirementGroup } from './requirement-group.entity.js';

// Entities to the curriculum DTOs: pure functions, shared by the explorer (F4) and F12's writes.

export function programSummary(p: Program): ProgramSummaryDto {
  return { code: p.code, nameVi: p.nameVi, nameEn: p.nameEn, faculty: p.faculty, trainingType: p.trainingType };
}

export function courseDto(c: Course): CourseDto {
  return {
    code: c.code,
    nameVi: c.nameVi,
    nameEn: c.nameEn,
    credits: c.credits,
    theoryPeriods: c.theoryPeriods,
    labPeriods: c.labPeriods,
    exercisePeriods: c.exercisePeriods,
    projectPeriods: c.projectPeriods,
  };
}

function curriculumCourseDto(c: Course, rules: CourseRules): CurriculumCourseDto {
  return { ...courseDto(c), prerequisites: rules.prerequisites.get(c.code) ?? null, offeringTerms: rules.offeringTerms.get(c.code) ?? null };
}

function groupDto(g: RequirementGroup, rules: CourseRules): RequirementGroupDto {
  return {
    id: g.id,
    name: g.name,
    kind: g.kind,
    creditsTotal: g.creditsTotal,
    creditsTotalMin: g.creditsTotalMin,
    officialNotes: g.officialNotes,
    courses: g.courseLinks.map((link) => curriculumCourseDto(link.course, rules)).sort((a, b) => byText(a.code, b.code)),
  };
}

export function curriculumDto(c: Curriculum, rules: CourseRules): CurriculumDto {
  return {
    id: c.id,
    code: c.code,
    program: programSummary(c.program),
    cohortYear: c.cohortYear,
    nameVi: c.nameVi,
    nameEn: c.nameEn,
    language: c.language,
    totalCreditsMin: c.totalCreditsMin,
    requirementGroups: c.requirementGroups.map((g) => groupDto(g, rules)).sort((a, b) => byText(a.name, b.name)),
  };
}
