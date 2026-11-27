import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { byText } from '../common/collections.js';
import { isCourseCode } from '../common/course-code.js';
import { Course } from './course.entity.js';
import { cohortCurriculum, type CourseRules, CurriculumRulesReader } from './curriculum-rules.reader.js';
import { Curriculum } from './curriculum.entity.js';
import { CourseDetailDto, CourseDto, CurriculumCourseDto, CurriculumDto, ProgramDto, ProgramSummaryDto, RequirementGroupDto } from './curriculum.dto.js';
import { Program } from './program.entity.js';
import { type RequirementGroup, RequirementGroupCourse } from './requirement-group.entity.js';

export interface CourseSummary {
  nameVi: string;
  nameEn: string | null;
  credits: number;
}

export interface CurriculumLabels {
  code: string;
  cohortYear: number;
  nameVi: string;
  nameEn: string | null;
  program: { code: string; nameVi: string; nameEn: string | null };
  groupNames: Map<string, string>;
}

@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(Program) private readonly programs: Repository<Program>,
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(RequirementGroupCourse) private readonly links: Repository<RequirementGroupCourse>,
    private readonly rules: CurriculumRulesReader,
  ) {}

  async listPrograms(): Promise<ProgramDto[]> {
    const rows = await this.programs.find({ relations: { curriculums: true } });
    return rows
      .map((p) => ({ ...programSummary(p), cohortYears: p.curriculums.map((c) => c.cohortYear).sort((a, b) => a - b) }))
      .sort((a, b) => byText(a.code, b.code));
  }

  async findCurriculum(programCode: string, cohortYear: number): Promise<CurriculumDto | null> {
    const where = cohortCurriculum(programCode, cohortYear);
    if (!where) return null;
    const row = await this.curriculums.findOne({ where, relations: { program: true, requirementGroups: { courseLinks: { course: true } } } });
    return row ? curriculumDto(row, await this.rules.courseRules(row.id)) : null;
  }

  async getCurriculum(programCode: string, cohortYear: number): Promise<CurriculumDto> {
    const curriculum = await this.findCurriculum(programCode, cohortYear);
    if (!curriculum) throw new NotFoundException('No curriculum for this program and cohort');
    return curriculum;
  }

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

  async getCourse(code: string): Promise<CourseDetailDto> {
    const course = await this.findCourse(code);
    if (!course) throw new NotFoundException('No course has this code');
    return course;
  }

  async findCurriculumId(programCode: string, cohortYear: number): Promise<string | null> {
    const where = cohortCurriculum(programCode, cohortYear);
    if (!where) return null;
    const row = await this.curriculums.findOne({ select: { id: true }, where });
    return row?.id ?? null;
  }

  async catalogCourses(codes: readonly string[], manager?: EntityManager): Promise<Map<string, CourseSummary>> {
    const wellFormed = [...new Set(codes)].filter(isCourseCode);
    if (!wellFormed.length) return new Map();
    const courses = manager ? manager.getRepository(Course) : this.courses;
    const rows = await courses.find({ select: { code: true, nameVi: true, nameEn: true, credits: true }, where: { code: In(wellFormed) } });
    return new Map(rows.map((c) => [c.code, { nameVi: c.nameVi, nameEn: c.nameEn, credits: c.credits }]));
  }

  async curriculumLabels(curriculumId: string): Promise<CurriculumLabels | null> {
    const row = await this.curriculums.findOne({ where: { id: curriculumId }, relations: { program: true, requirementGroups: true } });
    if (!row) return null;
    return {
      code: row.code,
      cohortYear: row.cohortYear,
      nameVi: row.nameVi,
      nameEn: row.nameEn,
      program: { code: row.program.code, nameVi: row.program.nameVi, nameEn: row.program.nameEn },
      groupNames: new Map(row.requirementGroups.map((g) => [g.id, g.name])),
    };
  }

  async requirementGroupIds(curriculumId: string, manager?: EntityManager): Promise<Set<string>> {
    const curriculums = manager ? manager.getRepository(Curriculum) : this.curriculums;
    const row = await curriculums.findOne({ select: { id: true, requirementGroups: { id: true } }, where: { id: curriculumId }, relations: { requirementGroups: true } });
    return new Set(row?.requirementGroups.map((g) => g.id) ?? []);
  }
}

function programSummary(program: Program): ProgramSummaryDto {
  return { code: program.code, nameVi: program.nameVi, nameEn: program.nameEn, faculty: program.faculty, trainingType: program.trainingType };
}

export function courseDto(course: Course): CourseDto {
  return {
    code: course.code,
    nameVi: course.nameVi,
    nameEn: course.nameEn,
    credits: course.credits,
    theoryPeriods: course.theoryPeriods,
    labPeriods: course.labPeriods,
    exercisePeriods: course.exercisePeriods,
    projectPeriods: course.projectPeriods,
  };
}

function curriculumCourseDto(course: Course, rules: CourseRules): CurriculumCourseDto {
  return { ...courseDto(course), prerequisites: rules.prerequisites.get(course.code) ?? null, offeringTerms: rules.offeringTerms.get(course.code) ?? null };
}

function groupDto(group: RequirementGroup, rules: CourseRules): RequirementGroupDto {
  return {
    id: group.id,
    name: group.name,
    kind: group.kind,
    creditsTotal: group.creditsTotal,
    creditsTotalMin: group.creditsTotalMin,
    officialNotes: group.officialNotes,
    courses: group.courseLinks.map((link) => curriculumCourseDto(link.course, rules)).sort((a, b) => byText(a.code, b.code)),
  };
}

function curriculumDto(curriculum: Curriculum, rules: CourseRules): CurriculumDto {
  return {
    id: curriculum.id,
    code: curriculum.code,
    program: programSummary(curriculum.program),
    cohortYear: curriculum.cohortYear,
    nameVi: curriculum.nameVi,
    nameEn: curriculum.nameEn,
    language: curriculum.language,
    totalCreditsMin: curriculum.totalCreditsMin,
    requirementGroups: curriculum.requirementGroups.map((g) => groupDto(g, rules)).sort((a, b) => byText(a.name, b.name)),
  };
}
