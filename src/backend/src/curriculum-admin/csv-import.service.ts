import { createHash } from 'node:crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Course } from '../curriculum/course.entity.js';
import { AffectedCurriculumDto, conflict, importRejected, ImportRowErrorDto } from './admin-errors.js';
import { AdminWriteService } from './admin-write.service.js';
import { CatalogAdminService, type CourseChange, courseChange, type CourseValues, newCourseValues } from './catalog-admin.service.js';
import { CATALOG_COURSES_HEADER, type CatalogColumn, type CsvFile, type CsvRow, GROUP_LINKS_HEADER, type GroupLinkColumn, readCsv } from './csv-file.js';
import {
  CATALOG_FILE,
  CatalogImportPreviewDto,
  GROUP_LINKS_FILE,
  GroupLinkImportPreviewDto,
  ImportConfirmRequestDto,
  ImportPreviewRequestDto,
  ImportResultDto,
  ImportSummaryDto,
} from './csv-import.dto.js';
import { COURSE_FIELDS, type CourseField, CreateCourseDto, wholeNumberOrText } from './curriculum-admin.dto.js';
import { CurriculumAdminService, curriculumIn, noCatalogCourse, parseCourseCode } from './curriculum-admin.service.js';
import type { Need } from './grant-scope.js';
import { validateStrict } from './strict-body.js';

/**
 * The revision of the checks an import runs, inside every reviewVersion. ADR 0011 asks for
 * "the validation-source revision" of the rule engine's final-state validation; that
 * interface does not exist yet (see planLinks), so this constant stands in for it. Change it
 * when a check here or in the manual-entry services changes meaning: a review made before
 * that deploy can then not be confirmed after it.
 */
export const IMPORT_VALIDATION_REVISION = 'f12-structural-1';

const CATALOG: Need = { permission: 'catalog_maintainer' };

/** `reference`: the row is well formed, but what it names is not in the database right now. */
type RowError = ImportRowErrorDto & { reference?: true };

type Action = 'insert' | 'update' | 'no_op';

interface CatalogPlanRow {
  record: number;
  line: number;
  code: string;
  values: CourseValues;
  action: Action;
  current: Course | null;
  change: CourseChange | null;
  affected: AffectedCurriculumDto[];
  impactVersion: string | null;
}

interface LinkPlanRow {
  record: number;
  line: number;
  groupName: string;
  groupId: string;
  code: string;
  action: 'insert' | 'no_op';
}

interface Plan<Row> {
  rows: Row[];
  errors: RowError[];
  /** null while the file has an error: such a file cannot be confirmed. */
  reviewVersion: string | null;
}

const COURSE_COLUMNS: Record<'code' | CourseField, CatalogColumn> = {
  code: 'code',
  nameVi: 'name_vi',
  nameEn: 'name_en',
  credits: 'credits',
  theoryPeriods: 'theory_periods',
  labPeriods: 'lab_periods',
  exercisePeriods: 'exercise_periods',
  projectPeriods: 'project_periods',
};
const REQUIRED_COURSE_COLUMNS: CatalogColumn[] = ['code', 'name_vi', 'credits'];
const REQUIRED = 'a value is required';

/**
 * One catalog row checked as a manual `POST /admin/catalog/courses` body is: the same code
 * rule and the same CreateCourseDto, through the same strict validation. What is CSV-only is
 * the mapping of cells to fields: a blank `name_en` is null, a blank period count is absent
 * (saved as 0), and digits become a number. `code` comes back whenever it is a course code,
 * even on a row with another error, so that a repeated code is always reported.
 */
export async function checkCatalogRow(row: CsvRow<CatalogColumn>): Promise<{ code: string | null; values: CourseValues | null; errors: RowError[] }> {
  const cell = row.values;
  const at = (field: string, message: string): RowError => ({ record: row.record, line: row.line, field, message });
  const missing = REQUIRED_COURSE_COLUMNS.filter((column) => cell[column] === '');
  const errors = missing.map((column) => at(column, REQUIRED));

  const code = parseCourseCode(cell.code, 'code');
  if (code.error !== null && cell.code !== '') errors.push(at('code', code.error.replace(/^code: /, '')));

  const count = (text: string) => (text === '' ? undefined : wholeNumberOrText(text));
  const checked = await validateStrict(CreateCourseDto, {
    code: cell.code,
    nameVi: cell.name_vi,
    nameEn: cell.name_en === '' ? null : cell.name_en,
    credits: count(cell.credits),
    theoryPeriods: count(cell.theory_periods),
    labPeriods: count(cell.lab_periods),
    exercisePeriods: count(cell.exercise_periods),
    projectPeriods: count(cell.project_periods),
  });
  for (const failed of checked.errors ?? []) {
    const column = COURSE_COLUMNS[failed.property as 'code' | CourseField] ?? failed.property;
    if (missing.includes(column)) continue;
    const messages = Object.values(failed.constraints ?? {}).map((m) => (m.startsWith(`${failed.property} `) ? m.slice(failed.property.length + 1) : m));
    errors.push(at(column, messages.join('; ')));
  }
  return { code: code.code, values: errors.length || !checked.value ? null : newCourseValues(checked.value), errors };
}

const version = (...parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('base64url');

const publicErrors = (errors: RowError[]): ImportRowErrorDto[] => errors.map(({ record, line, field, message }) => ({ record, line, field, message }));

function inFileOrder(errors: RowError[], header: readonly string[]): RowError[] {
  const column = (e: RowError) => (e.field === null ? -1 : header.indexOf(e.field));
  return [...errors].sort((a, b) => a.record - b.record || column(a) - column(b));
}

function summaryOf(rows: { action: Action }[]): ImportSummaryDto {
  const count = (action: Action) => rows.filter((r) => r.action === action).length;
  return { inserts: count('insert'), updates: count('update'), noOps: count('no_op') };
}

/**
 * Refuses a confirmation that is not exactly the reviewed one. A file that is wrong whatever
 * the database holds never had a review version: 400 with its errors. Otherwise the file,
 * the saved values or the references differ from what was reviewed (another file, a course
 * edited, a link made, a group renamed or a course deleted since): 409, and nothing is saved.
 */
function assertReviewed(plan: Plan<unknown>, reviewVersion: string): void {
  if (plan.errors.some((e) => !e.reference)) throw importRejected('The file has errors; correct it and preview it again', publicErrors(plan.errors));
  if (plan.reviewVersion === null || plan.reviewVersion !== reviewVersion) {
    throw conflict('impact_changed', 'The file, or the saved data it touches, changed since the preview; preview it again');
  }
}

/** What failed, without the failure's own text: a driver error carries the statement's parameters, which are rows of the file. */
function failureKind(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const sqlState = (error as { driverError?: { code?: unknown } } | null)?.driverError?.code;
  return typeof sqlState === 'string' && /^[0-9A-Z]{5}$/.test(sqlState) ? `${name}, SQLSTATE ${sqlState}` : name;
}

// F12 CSV bulk entry (ADR 0011, "CSV contract and UC-11 handoff"; UC-11 A9): a catalog
// courses file for a catalog maintainer, a group-links file for a program administrator.
//
// One planner per file type reads the current data and says what each row would do. The
// preview runs it on a read-only snapshot and returns the plan with a reviewVersion. The
// confirmation parses the file again, runs the same planner under the F12 write lock with
// the caller's current grants, compares the version, and applies the plan through the steps
// manual entry uses. All of the file is saved, or none of it. Rows the file does not name
// are never deleted. Nothing of the file is stored or logged: neither route keeps a draft.
@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    private readonly writes: AdminWriteService,
    private readonly catalog: CatalogAdminService,
    private readonly curricula: CurriculumAdminService,
  ) {}

  // ---- Catalog courses ---------------------------------------------------------------------

  previewCatalog(callerId: string, dto: ImportPreviewRequestDto): Promise<CatalogImportPreviewDto> {
    const file = readCsv(dto.csv, CATALOG_COURSES_HEADER);
    return this.guarded(async () => catalogPreview(await this.writes.read(callerId, CATALOG, (em) => this.planCatalog(em, file))));
  }

  confirmCatalog(callerId: string, dto: ImportConfirmRequestDto): Promise<ImportResultDto> {
    const file = readCsv(dto.csv, CATALOG_COURSES_HEADER);
    return this.guarded(() =>
      this.writes.run(callerId, CATALOG, async (em) => {
        const plan = await this.planCatalog(em, file);
        assertReviewed(plan, dto.reviewVersion);
        for (const row of plan.rows) {
          if (row.action === 'insert') await this.catalog.insertCourse(em, row.code, row.values);
          else if (row.change) await this.catalog.saveChange(em, row.code, row.change);
        }
        return { fileType: CATALOG_FILE, summary: summaryOf(plan.rows) };
      }),
    );
  }

  /**
   * What each row would do to the catalog as it is in `em`'s transaction: insert a new code,
   * update a saved course whose values differ, or nothing. An update is reviewed with the
   * shared-impact step of the manual PATCH (`reviewChange`), so the version below covers the
   * same facts as its `409 impact_confirmation_required`: the saved values, the proposed
   * values and every curriculum linking the course.
   */
  private async planCatalog(em: EntityManager, file: CsvFile<CatalogColumn>): Promise<Plan<CatalogPlanRow>> {
    const errors: RowError[] = [...file.errors];
    const valid: { record: number; line: number; code: string; values: CourseValues }[] = [];
    const firstRecord = new Map<string, number>();
    for (const row of file.rows) {
      const checked = await checkCatalogRow(row);
      errors.push(...checked.errors);
      if (checked.code === null) continue;
      const first = firstRecord.get(checked.code);
      if (first !== undefined) {
        // ADR 0011: a repeated code is an error even when the two rows are identical.
        errors.push({ record: row.record, line: row.line, field: 'code', message: `${checked.code} is in record ${first} already; a file names a course once` });
        continue;
      }
      firstRecord.set(checked.code, row.record);
      if (checked.values) valid.push({ record: row.record, line: row.line, code: checked.code, values: checked.values });
    }

    const saved = new Map<string, Course>();
    if (valid.length) for (const course of await em.getRepository(Course).findBy({ code: In(valid.map((r) => r.code)) })) saved.set(course.code, course);
    const rows: CatalogPlanRow[] = [];
    for (const row of valid) {
      const current = saved.get(row.code) ?? null;
      const change = current && courseChange(current, row.values);
      if (!current || !change) {
        rows.push({ ...row, action: 'insert', current: null, change: null, affected: [], impactVersion: null });
      } else if (!change.changed.length) {
        rows.push({ ...row, action: 'no_op', current, change: null, affected: [], impactVersion: null });
      } else {
        const review = await this.catalog.reviewChange(em, row.code, current, change.proposed);
        rows.push({ ...row, action: 'update', current, change, affected: review.affected, impactVersion: review.reviewVersion });
      }
    }
    const reviewVersion = errors.length ? null : version(this.validationRevision(), CATALOG_FILE, rows.map((r) => [r.code, COURSE_FIELDS.map((f) => r.values[f]), r.action, r.impactVersion]));
    return { rows, errors: inFileOrder(errors, CATALOG_COURSES_HEADER), reviewVersion };
  }

  // ---- Group links -------------------------------------------------------------------------

  previewLinks(callerId: string, programId: string, curriculumId: string, dto: ImportPreviewRequestDto): Promise<GroupLinkImportPreviewDto> {
    const file = readCsv(dto.csv, GROUP_LINKS_HEADER);
    return this.guarded(async () => {
      const plan = await this.writes.read(callerId, { program: programId }, (em) => this.planLinks(em, programId, curriculumId, file));
      return {
        fileType: GROUP_LINKS_FILE,
        programId,
        curriculumId,
        rows: plan.rows.map((r) => ({ record: r.record, line: r.line, action: r.action, requirementGroupName: r.groupName, requirementGroupId: r.groupId, courseCode: r.code })),
        errors: publicErrors(plan.errors),
        summary: summaryOf(plan.rows),
        reviewVersion: plan.reviewVersion,
      };
    });
  }

  confirmLinks(callerId: string, programId: string, curriculumId: string, dto: ImportConfirmRequestDto): Promise<ImportResultDto> {
    const file = readCsv(dto.csv, GROUP_LINKS_HEADER);
    return this.guarded(() =>
      this.writes.run(callerId, { program: programId }, async (em) => {
        const plan = await this.planLinks(em, programId, curriculumId, file);
        assertReviewed(plan, dto.reviewVersion);
        for (const row of plan.rows) if (row.action === 'insert') await this.curricula.insertLink(em, row.groupId, row.code);
        return { fileType: GROUP_LINKS_FILE, summary: summaryOf(plan.rows) };
      }),
    );
  }

  /**
   * What each row would do to the links of the route's cohort: link the course to the group,
   * or nothing when it is linked already. The program and the cohort come from the route
   * only; the file has no column for them.
   *
   * LIMIT (ADR 0011, "Implementation notes"): the checks are structural only and are those of
   * the manual membership PUT: a canonical course code, a group of this cohort, a course of
   * the catalog. ADR 0011 also asks for a validation of the proposed final set, group credit
   * totals included, "through the agreed deterministic validation interface". The rule engine
   * has no such interface yet, and no credit-total rule may be invented here (AGENTS.md hard
   * rule 1), so none runs, for the import as for the manual PUT. When the interface exists,
   * call it here on the final set and put its revision into IMPORT_VALIDATION_REVISION.
   */
  private async planLinks(em: EntityManager, programId: string, curriculumId: string, file: CsvFile<GroupLinkColumn>): Promise<Plan<LinkPlanRow>> {
    await curriculumIn(em, programId, curriculumId);
    const groups: { id: string; name: string }[] = await em.query('SELECT "id", "name" FROM "requirement_groups" WHERE "curriculum_id" = $1', [curriculumId]);
    const groupIdOf = new Map(groups.map((g) => [g.name, g.id]));
    const links: { requirement_group_id: string; course_code: string }[] = await em.query(
      `SELECT l."requirement_group_id", l."course_code" FROM "requirement_group_courses" l
       JOIN "requirement_groups" g ON g."id" = l."requirement_group_id" WHERE g."curriculum_id" = $1`,
      [curriculumId],
    );
    const linked = new Set(links.map((l) => `${l.requirement_group_id} ${l.course_code}`));
    const inCatalog = new Map<string, boolean>();

    const errors: RowError[] = [...file.errors];
    const rows: LinkPlanRow[] = [];
    const firstRecord = new Map<string, number>();
    for (const { record, line, values } of file.rows) {
      const at = (field: GroupLinkColumn, message: string, reference?: true): RowError => ({ record, line, field, message, ...(reference && { reference }) });
      const groupName = values.requirement_group_name;
      const code = parseCourseCode(values.course_code, 'course_code');
      const shape = [
        ...(groupName === '' ? [at('requirement_group_name', REQUIRED)] : []),
        ...(values.course_code === '' ? [at('course_code', REQUIRED)] : code.error !== null ? [at('course_code', code.error.replace(/^course_code: /, ''))] : []),
      ];
      if (shape.length || code.code === null) {
        errors.push(...shape);
        continue;
      }
      const pair = JSON.stringify([groupName, code.code]);
      const first = firstRecord.get(pair);
      if (first !== undefined) {
        // ADR 0011: a repeated pair is an error even when the two rows are identical.
        errors.push(at('course_code', `this group and ${code.code} are in record ${first} already; a file names a link once`));
        continue;
      }
      firstRecord.set(pair, record);

      // A group of another cohort or program is simply not here: its name resolves nothing.
      const groupId = groupIdOf.get(groupName);
      if (!inCatalog.has(code.code)) inCatalog.set(code.code, await this.curricula.catalogHas(em, code.code));
      const references = [
        ...(groupId === undefined ? [at('requirement_group_name', 'no requirement group of this cohort has this name; a file does not create groups', true)] : []),
        ...(inCatalog.get(code.code) ? [] : [at('course_code', noCatalogCourse(code.code), true)]),
      ];
      if (references.length || groupId === undefined) {
        errors.push(...references);
        continue;
      }
      rows.push({ record, line, groupName, groupId, code: code.code, action: linked.has(`${groupId} ${code.code}`) ? 'no_op' : 'insert' });
    }
    const reviewVersion = errors.length ? null : version(this.validationRevision(), GROUP_LINKS_FILE, programId, curriculumId, rows.map((r) => [r.groupName, r.groupId, r.code, r.action]));
    return { rows, errors: inFileOrder(errors, GROUP_LINKS_HEADER), reviewVersion };
  }

  /** The revision every reviewVersion carries; a method, so that the rule engine's revision can replace the constant here. */
  validationRevision(): string {
    return IMPORT_VALIDATION_REVISION;
  }

  /**
   * Answers an unexpected failure with the usual 500 and logs only its kind. Nest would log
   * the error object itself, and a storage error holds the failed statement's parameters:
   * rows of the file, which must never reach a log (ADR 0011).
   */
  private async guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`A CSV import failed and saved nothing: ${failureKind(error)}`);
      throw new HttpException({ statusCode: 500, message: 'Internal server error' }, 500);
    }
  }
}

function catalogPreview(plan: Plan<CatalogPlanRow>): CatalogImportPreviewDto {
  const course = (code: string, values: CourseValues) => ({ code, ...(Object.fromEntries(COURSE_FIELDS.map((f) => [f, values[f]])) as CourseValues) });
  const affected = new Map<string, AffectedCurriculumDto>();
  for (const row of plan.rows) for (const curriculum of row.affected) affected.set(curriculum.curriculumId, curriculum);
  return {
    fileType: CATALOG_FILE,
    rows: plan.rows.map((r) => ({
      record: r.record,
      line: r.line,
      action: r.action,
      ...course(r.code, r.values),
      changedFields: r.change?.changed ?? [],
      current: r.action === 'update' && r.current ? course(r.code, r.current) : null,
      affectedCurricula: r.affected,
    })),
    errors: publicErrors(plan.errors),
    summary: summaryOf(plan.rows),
    affectedCurricula: [...affected.values()].sort(
      (a, b) => a.programCode.localeCompare(b.programCode, 'en') || a.cohortYear - b.cohortYear || a.curriculumId.localeCompare(b.curriculumId, 'en'),
    ),
    reviewVersion: plan.reviewVersion,
  };
}
