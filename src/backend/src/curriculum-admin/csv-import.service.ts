import { HttpException, Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { ValidationError } from 'class-validator';
import { conflict } from '../common/api-errors.js';
import { validateStrict } from '../common/api-requests.js';
import { logFailure } from '../common/failure-kind.js';
import { Course } from '../curriculum/course.entity.js';
import { AffectedCurriculumDto, importRejected, ImportRowErrorDto } from './admin-errors.js';
import { catalogHas, cohortIn, noCatalogCourse, parseCourseCode } from './admin-lookups.js';
import { AdminWriteService } from './admin-write.service.js';
import { CatalogAdminService, type CourseChange, courseChange, type CourseValues, courseValuesInOrder, newCourseValues, reviewHash } from './catalog-admin.service.js';
import { CATALOG_COLUMNS, CATALOG_COURSES_HEADER, type CatalogColumn, type CsvFile, type CsvRow, GROUP_LINKS_HEADER, type GroupLinkColumn, readCsv } from './csv-file.js';
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
import { CurriculumAdminService } from './curriculum-admin.service.js';
import type { Need } from './grants.js';

/**
 * The revision of the checks an import runs, inside every reviewVersion. ADR 0011 asks for
 * "the validation-source revision" of the rule engine's final-state validation; that
 * interface does not exist yet (see planLinks), so this constant stands in for it. Change it
 * when a check here or in the manual-entry services changes meaning: a review made before
 * that deploy can then not be confirmed after it.
 */
const IMPORT_VALIDATION_REVISION = 'f12-structural-1';

const CATALOG: Need = { permission: 'catalog_maintainer' };

/** `reference`: the row is well formed, but what it names is not in the database right now. */
type RowError = ImportRowErrorDto & { reference?: true };

type Action = 'insert' | 'update' | 'no_op';

interface CatalogPlanRow {
  record: number;
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

interface CheckedLink {
  record: number;
  groupName: string;
  code: string;
}

interface CohortLinks {
  groupIdOf: Map<string, string>;
  linked: Set<string>;
}

interface ImportFlow<C extends string, Row extends { action: Action }> {
  need: Need;
  header: readonly C[];
  inScope: (em: EntityManager) => Promise<unknown>;
  plan: (em: EntityManager, file: CsvFile<C>) => Promise<Plan<Row>>;
  save: (em: EntityManager, row: Row) => Promise<void>;
}
/**
 * One catalog row checked as a manual `POST /admin/catalog/courses` body is: the same code
 * rule and the same CreateCourseDto, through the same strict validation, which also refuses
 * a missing code, name or credit count. What is CSV-only is the mapping of cells to fields:
 * a blank `name_en` is null, a blank number is absent (a period count is then saved as 0),
 * and digits become a number. `code` comes back whenever it is a course code, even on a row
 * with another error, so that a repeated code is always reported.
 */
export async function checkCatalogRow(row: CsvRow<CatalogColumn>): Promise<{ code: string | null; values: CourseValues | null; errors: RowError[] }> {
  const at = (field: string, message: string): RowError => ({ record: row.record, field, message });
  const code = parseCourseCode(row.values.code);
  const checked = await validateStrict(CreateCourseDto, catalogBody(row.values));
  const errors: RowError[] = [...(code.error !== null ? [at('code', code.error)] : []), ...(checked.errors ?? []).map((failed) => at(columnOf(failed.property), messagesOf(failed)))];
  return { code: code.code, values: errors.length || !checked.value ? null : newCourseValues(checked.value), errors };
}

function catalogBody(cell: Record<CatalogColumn, string>): Record<'code' | CourseField, unknown> {
  const count = (text: string) => (text === '' ? undefined : wholeNumberOrText(text));
  return {
    code: cell.code,
    nameVi: cell.name_vi,
    nameEn: cell.name_en === '' ? null : cell.name_en,
    credits: count(cell.credits),
    theoryPeriods: count(cell.theory_periods),
    labPeriods: count(cell.lab_periods),
    exercisePeriods: count(cell.exercise_periods),
    projectPeriods: count(cell.project_periods),
  };
}

const columnOf = (property: string): string => CATALOG_COLUMNS[property as 'code' | CourseField] ?? property;

const messagesOf = (failed: ValidationError): string =>
  Object.values(failed.constraints ?? {})
    .map((m) => (m.startsWith(`${failed.property} `) ? m.slice(failed.property.length + 1) : m))
    .join('; ');

export const catalogReviewVersion = (revision: string, rows: Pick<CatalogPlanRow, 'code' | 'values' | 'action' | 'impactVersion'>[]): string =>
  reviewHash(revision, CATALOG_FILE, rows.map((row) => [row.code, courseValuesInOrder(row.values), row.action, row.impactVersion]));

export const linksReviewVersion = (revision: string, programId: string, curriculumId: string, rows: Omit<LinkPlanRow, 'record'>[]): string =>
  reviewHash(revision, GROUP_LINKS_FILE, programId, curriculumId, rows.map((row) => [row.groupName, row.groupId, row.code, row.action]));

const publicErrors = (errors: RowError[]): ImportRowErrorDto[] => errors.map(({ record, field, message }) => ({ record, field, message }));

function inFileOrder(errors: RowError[], header: readonly string[]): RowError[] {
  const column = (e: RowError) => (e.field === null ? -1 : header.indexOf(e.field));
  return [...errors].sort((a, b) => a.record - b.record || column(a) - column(b));
}

function summaryOf(rows: { action: Action }[]): ImportSummaryDto {
  const count = (action: Action) => rows.filter((row) => row.action === action).length;
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

async function checkedCatalogRows(file: CsvFile<CatalogColumn>, errors: RowError[]): Promise<{ record: number; code: string; values: CourseValues }[]> {
  const valid: { record: number; code: string; values: CourseValues }[] = [];
  const firstRecord = new Map<string, number>();
  for (const row of file.rows) {
    const checked = await checkCatalogRow(row);
    errors.push(...checked.errors);
    if (checked.code === null) continue;
    const first = firstRecord.get(checked.code);
    if (first !== undefined) {
      // ADR 0011: a repeated code is an error even when the two rows are identical.
      errors.push({ record: row.record, field: 'code', message: `${checked.code} is in record ${first} already; a file names a course once` });
      continue;
    }
    firstRecord.set(checked.code, row.record);
    if (checked.values) valid.push({ record: row.record, code: checked.code, values: checked.values });
  }
  return valid;
}

async function cohortLinks(em: EntityManager, curriculumId: string): Promise<CohortLinks> {
  const groups: { id: string; name: string }[] = await em.query('SELECT "id", "name" FROM "requirement_groups" WHERE "curriculum_id" = $1', [curriculumId]);
  const links: { requirement_group_id: string; course_code: string }[] = await em.query(
    `SELECT l."requirement_group_id", l."course_code" FROM "requirement_group_courses" l
     JOIN "requirement_groups" g ON g."id" = l."requirement_group_id" WHERE g."curriculum_id" = $1`,
    [curriculumId],
  );
  return { groupIdOf: new Map(groups.map((g) => [g.name, g.id])), linked: new Set(links.map((l) => `${l.requirement_group_id} ${l.course_code}`)) };
}

const linkError = (record: number, field: GroupLinkColumn, message: string, reference?: true): RowError => ({ record, field, message, ...(reference && { reference }) });

function checkedLinkRows(file: CsvFile<GroupLinkColumn>, errors: RowError[]): CheckedLink[] {
  const rows: CheckedLink[] = [];
  const firstRecord = new Map<string, number>();
  for (const { record, values } of file.rows) {
    const groupName = values.requirement_group_name;
    const code = parseCourseCode(values.course_code);
    const shape = [
      // The one check no manual route has: the manual PUT takes the group's ID from the
      // path, and only a file can leave the name out. A blank code fails the code rule.
      ...(groupName === '' ? [linkError(record, 'requirement_group_name', 'a value is required')] : []),
      ...(code.error !== null ? [linkError(record, 'course_code', code.error)] : []),
    ];
    if (shape.length || code.code === null) {
      errors.push(...shape);
      continue;
    }
    const pair = JSON.stringify([groupName, code.code]);
    const first = firstRecord.get(pair);
    if (first !== undefined) {
      // ADR 0011: a repeated pair is an error even when the two rows are identical.
      errors.push(linkError(record, 'course_code', `this group and ${code.code} are in record ${first} already; a file names a link once`));
      continue;
    }
    firstRecord.set(pair, record);
    rows.push({ record, groupName, code: code.code });
  }
  return rows;
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

  // In every method the caller's grant is checked before the file is read, so a caller
  // without it gets 403 for any file and learns nothing from a 400 or a 413. A confirmation
  // checks once outside the write lock, reads the file, then checks again under the lock.

  previewCatalog(callerId: string, dto: ImportPreviewRequestDto): Promise<CatalogImportPreviewDto> {
    return this.guarded(async () => catalogPreview(await this.preview(this.catalogFlow(), callerId, dto.csv)));
  }

  confirmCatalog(callerId: string, dto: ImportConfirmRequestDto): Promise<ImportResultDto> {
    return this.guarded(async () => ({ fileType: CATALOG_FILE, summary: await this.confirm(this.catalogFlow(), callerId, dto) }));
  }

  // ---- Group links -------------------------------------------------------------------------

  previewLinks(callerId: string, programId: string, curriculumId: string, dto: ImportPreviewRequestDto): Promise<GroupLinkImportPreviewDto> {
    return this.guarded(async () => {
      const plan = await this.preview(this.linksFlow(programId, curriculumId), callerId, dto.csv);
      return {
        fileType: GROUP_LINKS_FILE,
        programId,
        curriculumId,
        rows: plan.rows.map((row) => ({ record: row.record, action: row.action, requirementGroupName: row.groupName, requirementGroupId: row.groupId, courseCode: row.code })),
        errors: publicErrors(plan.errors),
        summary: summaryOf(plan.rows),
        reviewVersion: plan.reviewVersion,
      };
    });
  }

  confirmLinks(callerId: string, programId: string, curriculumId: string, dto: ImportConfirmRequestDto): Promise<ImportResultDto> {
    return this.guarded(async () => ({ fileType: GROUP_LINKS_FILE, summary: await this.confirm(this.linksFlow(programId, curriculumId), callerId, dto) }));
  }

  private preview<C extends string, Row extends { action: Action }>(flow: ImportFlow<C, Row>, callerId: string, csv: string): Promise<Plan<Row>> {
    return this.writes.read(callerId, flow.need, async (em) => {
      await flow.inScope(em);
      return flow.plan(em, readCsv(csv, flow.header));
    });
  }

  private async confirm<C extends string, Row extends { action: Action }>(flow: ImportFlow<C, Row>, callerId: string, dto: ImportConfirmRequestDto): Promise<ImportSummaryDto> {
    await this.writes.read(callerId, flow.need, flow.inScope);
    const file = readCsv(dto.csv, flow.header);
    return this.writes.run(callerId, flow.need, async (em) => {
      await flow.inScope(em);
      const plan = await flow.plan(em, file);
      assertReviewed(plan, dto.reviewVersion);
      for (const row of plan.rows) await flow.save(em, row);
      return summaryOf(plan.rows);
    });
  }

  private catalogFlow(): ImportFlow<CatalogColumn, CatalogPlanRow> {
    return {
      need: CATALOG,
      header: CATALOG_COURSES_HEADER,
      inScope: async () => undefined,
      plan: (em, file) => this.planCatalog(em, file),
      save: async (em, row) => {
        if (row.action === 'insert') await this.catalog.insertCourse(em, row.code, row.values);
        else if (row.change) await this.catalog.saveChange(em, row.code, row.change);
      },
    };
  }

  private linksFlow(programId: string, curriculumId: string): ImportFlow<GroupLinkColumn, LinkPlanRow> {
    return {
      need: { program: programId },
      header: GROUP_LINKS_HEADER,
      inScope: (em) => cohortIn(em, programId, curriculumId),
      plan: (em, file) => this.planLinks(em, programId, curriculumId, file),
      save: async (em, row) => {
        if (row.action === 'insert') await this.curricula.insertLink(em, row.groupId, row.code);
      },
    };
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
    const valid = await checkedCatalogRows(file, errors);
    const saved = new Map<string, Course>();
    if (valid.length) for (const course of await em.getRepository(Course).findBy({ code: In(valid.map((row) => row.code)) })) saved.set(course.code, course);
    const rows: CatalogPlanRow[] = [];
    for (const row of valid) rows.push(await this.catalogPlanRow(em, row, saved.get(row.code) ?? null));
    const reviewVersion = errors.length ? null : catalogReviewVersion(this.validationRevision(), rows);
    return { rows, errors: inFileOrder(errors, CATALOG_COURSES_HEADER), reviewVersion };
  }

  private async catalogPlanRow(em: EntityManager, row: { record: number; code: string; values: CourseValues }, current: Course | null): Promise<CatalogPlanRow> {
    const change = current && courseChange(current, row.values);
    if (!current || !change) return { ...row, action: 'insert', current: null, change: null, affected: [], impactVersion: null };
    if (!change.changed.length) return { ...row, action: 'no_op', current, change: null, affected: [], impactVersion: null };
    const review = await this.catalog.reviewChange(em, row.code, current, change.proposed);
    return { ...row, action: 'update', current, change, affected: review.affected, impactVersion: review.reviewVersion };
  }

  /**
   * What each row would do to the links of the route's cohort: link the course to the group,
   * or nothing when it is linked already. The program and the cohort come from the route
   * only; the file has no column for them. The caller has checked that the cohort belongs to
   * the program (`cohortIn`).
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
    const cohort = await cohortLinks(em, curriculumId);
    const errors: RowError[] = [...file.errors];
    const rows: LinkPlanRow[] = [];
    const inCatalog = new Map<string, boolean>();
    for (const link of checkedLinkRows(file, errors)) {
      if (!inCatalog.has(link.code)) inCatalog.set(link.code, await catalogHas(em, link.code));
      const resolved = resolveLink(link, cohort, inCatalog.get(link.code)!);
      if ('errors' in resolved) errors.push(...resolved.errors);
      else rows.push(resolved);
    }
    const reviewVersion = errors.length ? null : linksReviewVersion(this.validationRevision(), programId, curriculumId, rows);
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
      logFailure(this.logger, 'A CSV import failed and saved nothing', error);
      throw new HttpException({ statusCode: 500, message: 'Internal server error' }, 500);
    }
  }
}

function resolveLink(link: CheckedLink, cohort: CohortLinks, inCatalog: boolean): LinkPlanRow | { errors: RowError[] } {
  // A group of another cohort or program is simply not here: its name resolves nothing.
  const groupId = cohort.groupIdOf.get(link.groupName);
  const references = [
    ...(groupId === undefined ? [linkError(link.record, 'requirement_group_name', 'no requirement group of this cohort has this name; a file does not create groups', true)] : []),
    ...(inCatalog ? [] : [linkError(link.record, 'course_code', noCatalogCourse(link.code), true)]),
  ];
  if (references.length || groupId === undefined) return { errors: references };
  return { ...link, groupId, action: cohort.linked.has(`${groupId} ${link.code}`) ? 'no_op' : 'insert' };
}

function catalogPreview(plan: Plan<CatalogPlanRow>): CatalogImportPreviewDto {
  const course = (code: string, values: CourseValues) => ({ code, ...(Object.fromEntries(COURSE_FIELDS.map((field) => [field, values[field]])) as CourseValues) });
  const affected = new Map<string, AffectedCurriculumDto>();
  for (const row of plan.rows) for (const curriculum of row.affected) affected.set(curriculum.curriculumId, curriculum);
  return {
    fileType: CATALOG_FILE,
    rows: plan.rows.map((row) => ({
      record: row.record,
      action: row.action,
      ...course(row.code, row.values),
      changedFields: row.change?.changed ?? [],
      current: row.action === 'update' && row.current ? course(row.code, row.current) : null,
      affectedCurricula: row.affected,
    })),
    errors: publicErrors(plan.errors),
    summary: summaryOf(plan.rows),
    affectedCurricula: [...affected.values()].sort(
      (a, b) => a.programCode.localeCompare(b.programCode, 'en') || a.cohortYear - b.cohortYear || a.curriculumId.localeCompare(b.curriculumId, 'en'),
    ),
    reviewVersion: plan.reviewVersion,
  };
}
