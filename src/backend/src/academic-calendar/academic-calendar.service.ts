import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Program } from '../curriculum/program.entity.js';
import { notFound, validationFailed } from '../curriculum-admin/admin-errors.js';
import { AdminWriteService } from '../curriculum-admin/admin-write.service.js';
import { AcademicCalendarEvent } from './academic-calendar-event.entity.js';
import {
  AcademicCalendarDto,
  AcademicCalendarEventDto,
  AcademicCalendarQueryDto,
  CalendarProgramDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from './academic-calendar.dto.js';
import { yearOf } from './calendar-date.js';

/** The stored fields a range and year check needs. */
export interface EventDates {
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

const blankToNull = (value: string | null | undefined): string | null => (value === undefined || value === null || value.trim() === '' ? null : value);

export function eventDto(e: AcademicCalendarEvent): AcademicCalendarEventDto {
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

// The school dates of a program (ADR 0016). Reads are open to every signed-in user: the dates
// are shared, published by the school, and hold nothing about a student. Writes reuse F12's
// program grant and write lock (ADR 0011) through AdminWriteService; no guard of their own.
@Injectable()
export class AcademicCalendarService {
  constructor(
    private readonly db: DataSource,
    private readonly writes: AdminWriteService,
  ) {}

  /** The calendar of `query.program`, or of the caller's onboarding program when absent. */
  async list(callerId: string, query: AcademicCalendarQueryDto): Promise<AcademicCalendarDto> {
    if (query.from && query.to && query.to < query.from) throw validationFailed(`to: ${query.to} is before from ${query.from}`);
    const code = query.program ?? (await this.onboardingProgram(callerId));
    if (!code) return { program: null, events: [] };
    const program = await this.db.getRepository(Program).findOneBy({ code });
    if (!program) {
      // A program the caller asked for by name must exist; one remembered from onboarding
      // always does (programs are never deleted while referenced), but stay graceful.
      if (query.program) throw notFound(`No program with code ${query.program}`);
      return { program: null, events: [] };
    }
    const qb = this.db
      .getRepository(AcademicCalendarEvent)
      .createQueryBuilder('e')
      .where('e.programId = :programId', { programId: program.id });
    if (query.academicYear !== undefined) qb.andWhere('e.academicYear = :year', { year: query.academicYear });
    // Overlap with [from, to]: a window that started before `from` but is still open counts.
    if (query.from) qb.andWhere('e.endsOn >= :from', { from: query.from });
    if (query.to) qb.andWhere('e.startsOn <= :to', { to: query.to });
    const events = await qb.orderBy('e.startsOn', 'ASC').addOrderBy('e.endsOn', 'ASC').addOrderBy('e.title', 'ASC').addOrderBy('e.id', 'ASC').getMany();
    return { program: programDto(program), events: events.map(eventDto) };
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
          titleEn: blankToNull(dto.titleEn),
          sourceUrl: blankToNull(dto.sourceUrl),
          notes: blankToNull(dto.notes),
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
      const patch: Partial<AcademicCalendarEvent> = {};
      if (dto.academicYear !== undefined) patch.academicYear = dto.academicYear;
      if (dto.term !== undefined) patch.term = dto.term;
      if (dto.kind !== undefined) patch.kind = dto.kind;
      if (dto.startsOn !== undefined) patch.startsOn = dto.startsOn;
      if (dto.endsOn !== undefined) patch.endsOn = dto.endsOn;
      if (dto.title !== undefined) patch.title = dto.title;
      if (dto.titleEn !== undefined) patch.titleEn = blankToNull(dto.titleEn);
      if (dto.sourceUrl !== undefined) patch.sourceUrl = blankToNull(dto.sourceUrl);
      if (dto.notes !== undefined) patch.notes = blankToNull(dto.notes);
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

  private async onboardingProgram(userId: string): Promise<string | null> {
    const rows: { program_code: string | null }[] = await this.db.query('SELECT "program_code" FROM "onboarding_answers" WHERE "user_id" = $1', [userId]);
    return rows[0]?.program_code ?? null;
  }
}

/** The event, if it belongs to the path's program: an ID from another program is a 404. */
async function eventIn(em: EntityManager, programId: string, eventId: string): Promise<AcademicCalendarEvent> {
  const event = await em.getRepository(AcademicCalendarEvent).findOneBy({ id: eventId, programId });
  if (!event) throw notFound('No calendar date with this ID in this program');
  return event;
}
