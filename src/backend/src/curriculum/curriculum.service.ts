import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isCourseCode } from '../common/course-code.js';
import { Course } from './course.entity.js';
import { Curriculum } from './curriculum.entity.js';
import { CourseDetailDto, CourseDto, CurriculumDto, ProgramDto, ProgramSummaryDto, RequirementGroupDto } from './curriculum.dto.js';
import { Program } from './program.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';
import type { RequirementGroup } from './requirement-group.entity.js';

/** Code-point order: the same on every machine, unlike a locale collation. */
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Serves the curriculum data the seed or, later, F12 (ADR 0011) stored. It decides no
// academic rule (AGENTS.md hard rule 1): the rule engine reads these shapes and decides.
@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(Program) private readonly programs: Repository<Program>,
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(RequirementGroupCourse) private readonly links: Repository<RequirementGroupCourse>,
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
    return row ? curriculumDto(row) : null;
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
}

function programSummary(p: Program): ProgramSummaryDto {
  return { code: p.code, nameVi: p.nameVi, nameEn: p.nameEn, faculty: p.faculty };
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

function groupDto(g: RequirementGroup): RequirementGroupDto {
  return {
    id: g.id,
    name: g.name,
    kind: g.kind,
    creditsTotal: g.creditsTotal,
    creditsTotalMin: g.creditsTotalMin,
    officialNotes: g.officialNotes,
    courses: g.courseLinks.map((link) => courseDto(link.course)).sort((a, b) => byText(a.code, b.code)),
  };
}

export function curriculumDto(c: Curriculum): CurriculumDto {
  return {
    id: c.id,
    code: c.code,
    program: programSummary(c.program),
    cohortYear: c.cohortYear,
    nameVi: c.nameVi,
    nameEn: c.nameEn,
    language: c.language,
    totalCreditsMin: c.totalCreditsMin,
    requirementGroups: c.requirementGroups.map(groupDto).sort((a, b) => byText(a.name, b.name)),
  };
}
