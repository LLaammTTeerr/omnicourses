import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { byText } from '../common/by-text.js';
import { isCourseCode } from '../common/course-code.js';
import { Course } from './course.entity.js';
import type { CourseRules } from '../rules/inputs.js';
import { CourseRulesService } from './course-rules.service.js';
import { Curriculum } from './curriculum.entity.js';
import { CourseDetailDto, CourseDto, CurriculumCourseDto, CurriculumDto, ProgramDto, ProgramSummaryDto, RequirementGroupDto } from './curriculum.dto.js';
import { Program } from './program.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';
import type { RequirementGroup } from './requirement-group.entity.js';

// Serves the curriculum data the seed or, later, F12 (ADR 0011) stored. It decides no
// academic rule (AGENTS.md hard rule 1): the rule engine reads these shapes and decides.
@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(Program) private readonly programs: Repository<Program>,
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(RequirementGroupCourse) private readonly links: Repository<RequirementGroupCourse>,
    private readonly rules: CourseRulesService,
  ) {}

  /** Every program by code, with the cohorts that have a curriculum, oldest first. */
  async listPrograms(): Promise<ProgramDto[]> {
    const rows = await this.programs.find({ relations: { curriculums: true } });
    return rows
      .map((p) => ({ ...programSummary(p), cohortYears: p.curriculums.map((c) => c.cohortYear).sort((a, b) => a - b) }))
      .sort((a, b) => byText(a.code, b.code));
  }

  /** The curriculum of one cohort of a program, or null when there is none. */
  async findCurriculum(programCode: string, cohortYear: number): Promise<CurriculumDto | null> {
    if (!Number.isInteger(cohortYear)) return null;
    const row = await this.curriculums.findOne({
      where: { cohortYear, program: { code: programCode } },
      relations: { program: true, requirementGroups: { courseLinks: { course: true } } },
    });
    return row ? curriculumDto(row, await this.rules.rulesFor(row.id)) : null;
  }

  /** Like findCurriculum, for a route: a missing curriculum is a 404. */
  async getCurriculum(programCode: string, cohortYear: number): Promise<CurriculumDto> {
    const curriculum = await this.findCurriculum(programCode, cohortYear);
    if (!curriculum) throw new NotFoundException('No curriculum for this program and cohort');
    return curriculum;
  }

  /** A catalog course with every requirement group that links to it, or null. The code must be exact (ADR 0007). */
  async findCourse(code: string): Promise<CourseDetailDto | null> {
    if (!isCourseCode(code)) return null;
    const course = await this.courses.findOneBy({ code });
    if (!course) return null;
    const links = await this.links.find({
      where: { courseCode: code },
      relations: { requirementGroup: { curriculum: { program: true } } },
    });
    const memberships = links
      .map(({ requirementGroup: g }) => ({
        programCode: g.curriculum.program.code,
        cohortYear: g.curriculum.cohortYear,
        curriculumCode: g.curriculum.code,
        requirementGroupId: g.id,
        requirementGroupName: g.name,
        kind: g.kind,
      }))
      .sort((a, b) => byText(a.programCode, b.programCode) || a.cohortYear - b.cohortYear || byText(a.requirementGroupName, b.requirementGroupName));
    return { ...courseDto(course), memberships };
  }

  /** Like findCourse, for a route: an unknown or malformed code is a 404. */
  async getCourse(code: string): Promise<CourseDetailDto> {
    const course = await this.findCourse(code);
    if (!course) throw new NotFoundException('No course has this code');
    return course;
  }

  /** The id of the curriculum of one cohort of a program, or null when there is none. */
  async findCurriculumId(programCode: string, cohortYear: number): Promise<string | null> {
    if (!Number.isInteger(cohortYear)) return null;
    const row = await this.curriculums.findOne({ select: { id: true }, where: { cohortYear, program: { code: programCode } } });
    return row?.id ?? null;
  }

  /** The codes among these that the catalog has, in one query (a whole plan at once). Codes must be exact (ADR 0007). */
  async knownCourseCodes(codes: readonly string[]): Promise<Set<string>> {
    const wellFormed = [...new Set(codes)].filter(isCourseCode);
    if (!wellFormed.length) return new Set();
    const rows = await this.courses.find({ select: { code: true }, where: { code: In(wellFormed) } });
    return new Set(rows.map((c) => c.code));
  }

  /** Catalog credits by code for the codes among these that the catalog has, in one query (a whole plan at once). */
  async courseCredits(codes: readonly string[]): Promise<Map<string, number>> {
    const wellFormed = [...new Set(codes)].filter(isCourseCode);
    if (!wellFormed.length) return new Map();
    const rows = await this.courses.find({ select: { code: true, credits: true }, where: { code: In(wellFormed) } });
    return new Map(rows.map((c) => [c.code, c.credits]));
  }

  /** The ids of the requirement groups of one curriculum; empty when there is none. */
  async requirementGroupIds(curriculumId: string): Promise<Set<string>> {
    const row = await this.curriculums.findOne({ select: { id: true, requirementGroups: { id: true } }, where: { id: curriculumId }, relations: { requirementGroups: true } });
    return new Set(row?.requirementGroups.map((g) => g.id) ?? []);
  }
}

function programSummary(p: Program): ProgramSummaryDto {
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
