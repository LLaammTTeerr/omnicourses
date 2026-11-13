import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { byText } from '../common/by-text.js';
import { isCourseCode } from '../common/course-code.js';
import { Course } from './course.entity.js';
import { CourseRulesService } from './course-rules.service.js';
import { Curriculum } from './curriculum.entity.js';
import { CourseDetailDto, CurriculumDto, ProgramDto } from './curriculum.dto.js';
import { courseDto, curriculumDto, programSummary } from './curriculum.mappers.js';
import { loadCurriculum } from './curriculum-query.js';
import { Program } from './program.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';

// Serves the curriculum explorer (F4): the data the seed or F12 (ADR 0011) stored. It decides no
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
    const row = await loadCurriculum(this.curriculums, { programCode, cohortYear });
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
}
