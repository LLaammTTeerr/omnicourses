import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { notFound, validationFailed } from '../common/api-errors.js';
import { nullIfBlank, sentFields, yearOf } from '../common/field-validators.js';
import { Program } from '../curriculum/program.entity.js';
import { AdminWriteService } from '../curriculum-admin/admin-write.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import type { TermNumber } from '../terms/term.js';
import { AcademicCalendarEvent, type CalendarEventKind } from './academic-calendar-event.entity.js';
import {
  AcademicCalendarDto,
  AcademicCalendarEventDto,
  AcademicCalendarQueryDto,
  CalendarProgramDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from './academic-calendar.dto.js';

/** The stored fields a range and year check needs. */
interface EventDates {
  academicYear: number;
  startsOn: string;
  endsOn: string;
}

/**
 * Why these dates cannot be saved, or null. endsOn is never before startsOn, and the first day
 * falls in the academic year's first or second calendar year (ADR 0009: 2026 runs 2026–2027),
 * which catches a mistyped year without guessing the school's term boundaries.
 */
export function datesProblem({ academicYear, startsOn, endsOn }: EventDates): string | null {
  if (endsOn < startsOn) return `endsOn: ${endsOn} is before startsOn ${startsOn}`;
  const year = yearOf(startsOn);
  if (year !== academicYear && year !== academicYear + 1) return `startsOn: ${startsOn} is outside the academic year ${academicYear}–${academicYear + 1}`;
  return null;
}

/**
 * What another module may read of a school date (ADR 0018): its program, kind, days and titles.
 * No notes, no source link and no actor IDs.
 */
export interface CalendarEventStart {
  id: string;
  programCode: string;
  academicYear: number;
  term: TermNumber | null;
  kind: CalendarEventKind;
  startsOn: string;
  endsOn: string;
  title: string;
  titleEn: string | null;
}

const EVENT_FIELDS = ['academicYear', 'term', 'kind', 'startsOn', 'endsOn', 'title', 'titleEn', 'sourceUrl', 'notes'] as const;

const OPTIONAL_TEXT = { titleEn: nullIfBlank, sourceUrl: nullIfBlank, notes: nullIfBlank };

function eventDto(e: AcademicCalendarEvent): AcademicCalendarEventDto {
  return {
    id: e.id,
    academicYear: e.academicYear,
    term: e.term,
    kind: e.kind,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    title: e.title,
    titleEn: e.titleEn,
    sourceUrl: e.sourceUrl,
    notes: e.notes,
    updatedAt: e.updatedAt,
  };
}

const programDto = (p: Program): CalendarProgramDto => ({ id: p.id, code: p.code, nameVi: p.nameVi, nameEn: p.nameEn });

// The school dates of a program (ADR 0017). Reads are open to every signed-in user: the dates
// are shared, published by the school, and hold nothing about a student. Writes reuse F12's
// program grant and write lock (ADR 0011) through AdminWriteService; no guard of their own.
@Injectable()
export class AcademicCalendarService {
  constructor(
    private readonly db: DataSource,
    private readonly writes: AdminWriteService,
    private readonly onboarding: OnboardingService,
  ) {}

  /** The calendar of `query.program`, or of the caller's onboarding program when absent. */
  async list(callerId: string, query: AcademicCalendarQueryDto): Promise<AcademicCalendarDto> {
    if (query.from && query.to && query.to < query.from) throw validationFailed(`to: ${query.to} is before from ${query.from}`);
    const code = query.program ?? (await this.onboarding.answersFor(callerId)).program;
    if (!code) return { program: null, events: [] };
    const program = await this.db.getRepository(Program).findOneBy({ code });
    if (!program) {
      // A program the caller asked for by name must exist; one remembered from onboarding
      // always does (programs are never deleted while referenced), but stay graceful.
      if (query.program) throw notFound(`No program with code ${query.program}`);
      return { program: null, events: [] };
    }
    const events = this.db
      .getRepository(AcademicCalendarEvent)
      .createQueryBuilder('e')
      .where('e.programId = :programId', { programId: program.id });
    if (query.academicYear !== undefined) events.andWhere('e.academicYear = :year', { year: query.academicYear });
    // Overlap with [from, to]: a window that started before `from` but is still open counts.
    if (query.from) events.andWhere('e.endsOn >= :from', { from: query.from });
    if (query.to) events.andWhere('e.startsOn <= :to', { to: query.to });
    const found = await events.orderBy('e.startsOn', 'ASC').addOrderBy('e.endsOn', 'ASC').addOrderBy('e.title', 'ASC').addOrderBy('e.id', 'ASC').getMany();
    return { program: programDto(program), events: found.map(eventDto) };
  }

  /**
   * The dates of the given kinds whose first day is one of `days`, in every program, in a fixed
   * order. Read-only: the notification inbox asks which dates start today or in seven days
   * (ADR 0018). It grants nothing: the same dates are open to every signed-in user through list().
   */
  async startingOn(days: readonly string[], kinds: readonly CalendarEventKind[]): Promise<CalendarEventStart[]> {
    if (!days.length || !kinds.length) return [];
    const events = await this.db
      .getRepository(AcademicCalendarEvent)
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.program', 'p')
      .where('e.startsOn IN (:...days)', { days })
      .andWhere('e.kind IN (:...kinds)', { kinds })
      .orderBy('e.startsOn', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .getMany();
    return events.map((e) => ({
      id: e.id,
      programCode: e.program.code,
      academicYear: e.academicYear,
      term: e.term,
      kind: e.kind,
      startsOn: e.startsOn,
      endsOn: e.endsOn,
      title: e.title,
      titleEn: e.titleEn,
    }));
  }

  create(callerId: string, programId: string, dto: CreateCalendarEventDto): Promise<AcademicCalendarEventDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const dates = { academicYear: dto.academicYear, startsOn: dto.startsOn, endsOn: dto.endsOn ?? dto.startsOn };
      const problem = datesProblem(dates);
      if (problem) throw validationFailed(problem);
      const repo = em.getRepository(AcademicCalendarEvent);
      const saved = await repo.save(
        repo.create({
          programId,
          ...dates,
          term: dto.term ?? null,
          kind: dto.kind,
          title: dto.title,
          titleEn: nullIfBlank(dto.titleEn),
          sourceUrl: nullIfBlank(dto.sourceUrl),
          notes: nullIfBlank(dto.notes),
          createdBy: callerId,
          updatedBy: callerId,
        }),
      );
      return eventDto(await repo.findOneByOrFail({ id: saved.id }));
    });
  }

  update(callerId: string, programId: string, eventId: string, dto: UpdateCalendarEventDto): Promise<AcademicCalendarEventDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const event = await eventIn(em, programId, eventId);
      const dates = { academicYear: dto.academicYear ?? event.academicYear, startsOn: dto.startsOn ?? event.startsOn, endsOn: dto.endsOn ?? event.endsOn };
      const problem = datesProblem(dates);
      if (problem) throw validationFailed(problem);
      const patch = sentFields(EVENT_FIELDS, dto, OPTIONAL_TEXT) as Partial<AcademicCalendarEvent>;
      const repo = em.getRepository(AcademicCalendarEvent);
      // update() also sets updated_at.
      if (Object.keys(patch).length) await repo.update({ id: eventId }, { ...patch, updatedBy: callerId });
      return eventDto(await repo.findOneByOrFail({ id: eventId }));
    });
  }

  remove(callerId: string, programId: string, eventId: string): Promise<void> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await eventIn(em, programId, eventId);
      await em.getRepository(AcademicCalendarEvent).delete({ id: eventId });
    });
  }
}

/** The event, if it belongs to the path's program: an ID from another program is a 404. */
async function eventIn(em: EntityManager, programId: string, eventId: string): Promise<AcademicCalendarEvent> {
  const event = await em.getRepository(AcademicCalendarEvent).findOneBy({ id: eventId, programId });
  if (!event) throw notFound('No calendar date with this ID in this program');
  return event;
}
