import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Curriculum } from '../curriculum/curriculum.entity.js';
import { Program } from '../curriculum/program.entity.js';
import { conflict, notFound } from './admin-errors.js';
import { AdminWriteService } from './admin-write.service.js';
import { COHORT_FIELDS, CohortDetailsDto, CreateCohortDto, CreateProgramDto, PROGRAM_FIELDS, ProgramDetailsDto, UpdateCohortDto, UpdateProgramDto } from './program-admin.dto.js';

/** The optional text columns: a blank value is stored as null. The Vietnamese name is required and is never one. */
const NULLABLE_TEXT: ReadonlySet<string> = new Set(['nameEn', 'faculty', 'language']);

const blankToNull = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

/**
 * The declared editable fields that the body holds and that differ from the stored row. A field
 * left out keeps its value. Nothing outside `fields` can enter the result, so an identifier or
 * a gated column is never written, whatever reached the DTO.
 */
export function detailsPatch<T, F extends keyof T & string>(fields: readonly F[], stored: T, dto: { [K in F]?: T[K] }): { [K in F]?: T[K] } {
  const patch: { [K in F]?: T[K] } = {};
  for (const field of fields) {
    const sent = dto[field];
    if (sent === undefined) continue;
    const value = NULLABLE_TEXT.has(field) ? (blankToNull(sent as string | null) as T[F]) : sent;
    if (value !== stored[field]) patch[field] = value;
  }
  return patch;
}

// Programs and their cohorts (ADR 0011, UC-11 A1 and A2). An access manager creates a program
// and gets no grant on it; everything else needs the program grant of the path's program. Every
// write runs under the F12 lock with the caller's current grants, and a cohort is resolved from
// its stored program: a curriculum ID from another program is a 404, never a read or a write.
// Nothing here is an academic rule. A new program stores no training type and a new cohort no
// credit total: both stay "not recorded" until a reviewed contract lets F12 enter them.
@Injectable()
export class ProgramAdminService {
  constructor(private readonly writes: AdminWriteService) {}

  // ---- Programs ----------------------------------------------------------------------------

  createProgram(callerId: string, dto: CreateProgramDto): Promise<ProgramDetailsDto> {
    return this.writes.run(callerId, { permission: 'access_manager' }, async (em) => {
      const programs = em.getRepository(Program);
      if (await programs.existsBy({ code: dto.code })) throw conflict('duplicate_code', `A program already has the code ${dto.code}`);
      // No grant row is written: creation never grants editing access (ADR 0011).
      const { identifiers } = await programs.insert({ code: dto.code, nameVi: dto.nameVi, nameEn: blankToNull(dto.nameEn), faculty: blankToNull(dto.faculty) });
      return programDto(await programs.findOneByOrFail({ id: identifiers[0].id as string }));
    });
  }

  updateProgram(callerId: string, programId: string, dto: UpdateProgramDto): Promise<ProgramDetailsDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const programs = em.getRepository(Program);
      const program = await programIn(em, programId);
      const patch = detailsPatch(PROGRAM_FIELDS, program, dto);
      // update() sets updated_at with the change (ADR 0011). No change: no write.
      if (Object.keys(patch).length) await programs.update({ id: programId }, patch);
      return programDto(await programs.findOneByOrFail({ id: programId }));
    });
  }

  // ---- Cohorts -----------------------------------------------------------------------------

  listCohorts(callerId: string, programId: string): Promise<CohortDetailsDto[]> {
    return this.writes.read(callerId, { program: programId }, async (em) => {
      const rows = await em.getRepository(Curriculum).find({ where: { programId }, order: { cohortYear: 'ASC' } });
      return rows.map(cohortDto);
    });
  }

  getCohort(callerId: string, programId: string, curriculumId: string): Promise<CohortDetailsDto> {
    return this.writes.read(callerId, { program: programId }, async (em) => cohortDto(await cohortIn(em, programId, curriculumId)));
  }

  /** A new curriculums row and nothing else: no group, link or rule is copied from another cohort. */
  createCohort(callerId: string, programId: string, dto: CreateCohortDto): Promise<CohortDetailsDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const curriculums = em.getRepository(Curriculum);
      await programIn(em, programId);
      if (await curriculums.existsBy({ programId, cohortYear: dto.cohortYear })) {
        throw conflict('duplicate_cohort', `This program already has a cohort ${dto.cohortYear}`);
      }
      // The column has no unique constraint; the F12 lock makes this check and the insert one step.
      if (await curriculums.existsBy({ code: dto.code })) throw conflict('duplicate_code', `A curriculum already has the code ${dto.code}`);
      // total_credits_min stays null: a gated field (ADR 0011).
      const { identifiers } = await curriculums.insert({
        programId,
        cohortYear: dto.cohortYear,
        code: dto.code,
        nameVi: dto.nameVi,
        nameEn: blankToNull(dto.nameEn),
        language: blankToNull(dto.language),
      });
      return cohortDto(await curriculums.findOneByOrFail({ id: identifiers[0].id as string }));
    });
  }

  updateCohort(callerId: string, programId: string, curriculumId: string, dto: UpdateCohortDto): Promise<CohortDetailsDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const curriculums = em.getRepository(Curriculum);
      const cohort = await cohortIn(em, programId, curriculumId);
      const patch = detailsPatch(COHORT_FIELDS, cohort, dto);
      if (Object.keys(patch).length) await curriculums.update({ id: curriculumId }, patch);
      return cohortDto(await curriculums.findOneByOrFail({ id: curriculumId }));
    });
  }
}

/** The program of the path. A grant references its program, so a caller who passed the grant check always finds it. */
async function programIn(em: EntityManager, programId: string): Promise<Program> {
  const program = await em.getRepository(Program).findOneBy({ id: programId });
  if (!program) throw notFound('No program has this ID');
  return program;
}

/** The cohort, only if it belongs to the path's program. */
async function cohortIn(em: EntityManager, programId: string, curriculumId: string): Promise<Curriculum> {
  const cohort = await em.getRepository(Curriculum).findOneBy({ id: curriculumId, programId });
  if (!cohort) throw notFound('No such cohort in this program');
  return cohort;
}

function programDto(p: Program): ProgramDetailsDto {
  return { id: p.id, code: p.code, nameVi: p.nameVi, nameEn: p.nameEn, faculty: p.faculty, trainingType: p.trainingType, updatedAt: p.updatedAt };
}

function cohortDto(c: Curriculum): CohortDetailsDto {
  return {
    id: c.id,
    programId: c.programId,
    cohortYear: c.cohortYear,
    code: c.code,
    nameVi: c.nameVi,
    nameEn: c.nameEn,
    language: c.language,
    totalCreditsMin: c.totalCreditsMin,
    updatedAt: c.updatedAt,
  };
}
