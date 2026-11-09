import { Injectable } from '@nestjs/common';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { TranscriptService } from '../transcript/transcript.service.js';
import { type AdvisorRecord, CourseSource, RecordSource } from './advisor-sources.js';

// The advisor's sources that exist on main. Only the fields ADR 0003 allows leave: program, cohort,
// course codes, credits, results, grades and terms; never a name, email or student ID.

@Injectable()
export class StudentRecordSource extends RecordSource {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly transcript: TranscriptService,
  ) {
    super();
  }

  async recordFor(userId: string): Promise<AdvisorRecord> {
    const [answers, rows] = await Promise.all([this.onboarding.answersFor(userId), this.transcript.rowsFor(userId)]);
    return {
      program: answers.program,
      cohort: answers.cohort,
      courses: rows.map((r) => ({ code: r.courseCode, credits: r.credits, result: r.result, grade: r.grade, term: r.term })),
    };
  }
}

@Injectable()
export class CatalogCourseSource extends CourseSource {
  constructor(private readonly curriculum: CurriculumService) {
    super();
  }

  find(code: string): Promise<unknown | null> {
    return this.curriculum.findCourse(code);
  }
}
