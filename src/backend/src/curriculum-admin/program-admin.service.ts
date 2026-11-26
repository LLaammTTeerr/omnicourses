import { Injectable } from '@nestjs/common';
import { conflict } from '../common/api-errors.js';
import { changedFields, trimmedOrNull } from '../common/field-validators.js';
import { Curriculum } from '../curriculum/curriculum.entity.js';
import { Program } from '../curriculum/program.entity.js';
import { cohortIn, programIn } from './admin-lookups.js';
import { AdminWriteService } from './admin-write.service.js';
import { COHORT_FIELDS, CohortDetailsDto, CreateCohortDto, CreateProgramDto, PROGRAM_FIELDS, ProgramDetailsDto, UpdateCohortDto, UpdateProgramDto } from './program-admin.dto.js';

const NULLABLE_TEXT = { nameEn: trimmedOrNull, faculty: trimmedOrNull, language: trimmedOrNull };

export function detailsPatch<T, F extends keyof T & string>(fields: readonly F[], stored: T, dto: { [K in F]?: T[K] }): { [K in F]?: T[K] } {
  return changedFields(fields, stored as Record<F, unknown>, dto, NULLABLE_TEXT) as { [K in F]?: T[K] };
}

@Injectable()
export class ProgramAdminService {
  constructor(private readonly writes: AdminWriteService) {}

  createProgram(callerId: string, dto: CreateProgramDto): Promise<ProgramDetailsDto> {
    return this.writes.run(callerId, { permission: 'access_manager' }, async (em) => {
      const programs = em.getRepository(Program);
      if (await programs.existsBy({ code: dto.code })) throw conflict('duplicate_code', `A program already has the code ${dto.code}`);
      const { identifiers } = await programs.insert({ code: dto.code, nameVi: dto.nameVi, nameEn: trimmedOrNull(dto.nameEn), faculty: trimmedOrNull(dto.faculty) });
      return programDto(await programs.findOneByOrFail({ id: identifiers[0].id as string }));
    });
  }

  updateProgram(callerId: string, programId: string, dto: UpdateProgramDto): Promise<ProgramDetailsDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const programs = em.getRepository(Program);
      const program = await programIn(em, programId);
      const patch = detailsPatch(PROGRAM_FIELDS, program, dto);
      if (Object.keys(patch).length) await programs.update({ id: programId }, patch);
      return programDto(await programs.findOneByOrFail({ id: programId }));
    });
  }

  listCohorts(callerId: string, programId: string): Promise<CohortDetailsDto[]> {
    return this.writes.read(callerId, { program: programId }, async (em) => {
      const rows = await em.getRepository(Curriculum).find({ where: { programId }, order: { cohortYear: 'ASC' } });
      return rows.map(cohortDto);
    });
  }

  getCohort(callerId: string, programId: string, curriculumId: string): Promise<CohortDetailsDto> {
    return this.writes.read(callerId, { program: programId }, async (em) => cohortDto(await cohortIn(em, programId, curriculumId)));
  }

  createCohort(callerId: string, programId: string, dto: CreateCohortDto): Promise<CohortDetailsDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const curriculums = em.getRepository(Curriculum);
      await programIn(em, programId);
      if (await curriculums.existsBy({ programId, cohortYear: dto.cohortYear })) {
        throw conflict('duplicate_cohort', `This program already has a cohort ${dto.cohortYear}`);
      }
      if (await curriculums.existsBy({ code: dto.code })) throw conflict('duplicate_code', `A curriculum already has the code ${dto.code}`);
      const { identifiers } = await curriculums.insert({
        programId,
        cohortYear: dto.cohortYear,
        code: dto.code,
        nameVi: dto.nameVi,
        nameEn: trimmedOrNull(dto.nameEn),
        language: trimmedOrNull(dto.language),
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

function programDto(program: Program): ProgramDetailsDto {
  return { id: program.id, code: program.code, nameVi: program.nameVi, nameEn: program.nameEn, faculty: program.faculty, trainingType: program.trainingType, updatedAt: program.updatedAt };
}

function cohortDto(curriculum: Curriculum): CohortDetailsDto {
  return {
    id: curriculum.id,
    programId: curriculum.programId,
    cohortYear: curriculum.cohortYear,
    code: curriculum.code,
    nameVi: curriculum.nameVi,
    nameEn: curriculum.nameEn,
    language: curriculum.language,
    totalCreditsMin: curriculum.totalCreditsMin,
    updatedAt: curriculum.updatedAt,
  };
}
