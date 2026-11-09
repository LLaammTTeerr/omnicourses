import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseOfferingTerm } from './course-offering-term.entity.js';
import { CoursePrerequisiteList } from './course-prerequisite-list.entity.js';

/**
 * The prerequisites and offering terms recorded for the courses of one curriculum. A course
 * absent from a map has nothing recorded: callers must read that as unknown, not as none.
 */
export interface CourseRules {
  /** Course code → its prerequisite codes, sorted; [] when "none" was recorded. */
  prerequisites: Map<string, string[]>;
  /** Course code → the term numbers it is offered in, ascending; never empty. */
  offeringTerms: Map<string, number[]>;
}

// Read side of the F12 prerequisite and offering-term tables (ADR 0011, amended 9 November
// 2026). The rule engine reads these; it decides what they mean (AGENTS.md hard rule 1).
@Injectable()
export class CourseRulesService {
  constructor(
    @InjectRepository(CoursePrerequisiteList) private readonly lists: Repository<CoursePrerequisiteList>,
    @InjectRepository(CourseOfferingTerm) private readonly offerings: Repository<CourseOfferingTerm>,
  ) {}

  async rulesFor(curriculumId: string): Promise<CourseRules> {
    const [lists, offerings] = await Promise.all([
      this.lists.find({ where: { curriculumId }, relations: { prerequisites: true } }),
      this.offerings.find({ where: { curriculumId } }),
    ]);
    const prerequisites = new Map(lists.map((l) => [l.courseCode, l.prerequisites.map((p) => p.prerequisiteCode).sort(byText)]));
    const offeringTerms = new Map<string, number[]>();
    for (const o of offerings) offeringTerms.set(o.courseCode, [...(offeringTerms.get(o.courseCode) ?? []), o.termNumber]);
    for (const terms of offeringTerms.values()) terms.sort((a, b) => a - b);
    return { prerequisites, offeringTerms };
  }
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
