import { applyDecorators, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiPayloadTooLargeResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { AdminErrorDto, ImportRejectedDto } from './admin-errors.js';
import { AdminErrors, uuidParam } from './admin-params.js';
import { CATALOG_COURSES_HEADER, GROUP_LINKS_HEADER } from './csv-file.js';
import { CatalogImportPreviewDto, GroupLinkImportPreviewDto, ImportConfirmRequestDto, ImportPreviewRequestDto, ImportResultDto } from './csv-import.dto.js';
import { CsvImportService } from './csv-import.service.js';
import { CATALOG_IMPORTS, COHORT_IMPORTS } from './import-body-limit.js';
import { StrictBody } from './strict-body.js';

const REFUSED_FILE = '`validation_failed`: the file is malformed, has another header or (on confirm) has a row error; `errors` says where. Also an unknown body field. Nothing is saved.';
const TOO_LARGE = '`payload_too_large`: the JSON body is over 7 MiB, the CSV over 1 MiB of UTF-8, or it has more than 1,000 data records. Nothing is saved.';
const STALE = '`impact_changed`: the file, the saved values or the references differ from the reviewed preview. Nothing is saved; preview again.';
/** On each route: the class-level 400 of AdminErrors() would otherwise hide the `errors` list. */
const ImportErrors = () =>
  applyDecorators(ApiBadRequestResponse({ type: ImportRejectedDto, description: REFUSED_FILE }), ApiPayloadTooLargeResponse({ type: AdminErrorDto, description: TOO_LARGE }));

const PREVIEW = 'Writes nothing. A row error does not fail the request: it is listed in `errors`, and `reviewVersion` is null.';
const CONFIRM = 'Saves the whole file in one transaction, or nothing. Rows the file does not name are left as they are.';

// F12 CSV bulk entry (ADR 0011, UC-11 A9): preview, then confirm, for each of the two file
// types. These four routes are the only ones with the 7 MiB JSON limit (import-body-limit.ts).
@ApiTags('curriculum-admin')
@Authenticated()
@AdminErrors()
@Controller()
export class CsvImportController {
  constructor(private readonly imports: CsvImportService) {}

  @Post(`${CATALOG_IMPORTS}/preview`)
  @HttpCode(200)
  @ImportErrors()
  @ApiOperation({ summary: `Preview a catalog courses file. Header: ${CATALOG_COURSES_HEADER.join(',')}`, description: PREVIEW })
  @ApiBody({ type: ImportPreviewRequestDto })
  @ApiOkResponse({ type: CatalogImportPreviewDto })
  previewCatalog(@CurrentUser() user: User, @StrictBody() dto: ImportPreviewRequestDto): Promise<CatalogImportPreviewDto> {
    return this.imports.previewCatalog(user.id, dto);
  }

  @Post(`${CATALOG_IMPORTS}/confirm`)
  @HttpCode(200)
  @ImportErrors()
  @ApiOperation({ summary: 'Save a previewed catalog courses file', description: CONFIRM })
  @ApiBody({ type: ImportConfirmRequestDto })
  @ApiOkResponse({ type: ImportResultDto })
  @ApiConflictResponse({ type: AdminErrorDto, description: STALE })
  confirmCatalog(@CurrentUser() user: User, @StrictBody() dto: ImportConfirmRequestDto): Promise<ImportResultDto> {
    return this.imports.confirmCatalog(user.id, dto);
  }

  @Post(`${COHORT_IMPORTS}/preview`)
  @HttpCode(200)
  @ImportErrors()
  @ApiOperation({ summary: `Preview a group-links file for this cohort. Header: ${GROUP_LINKS_HEADER.join(',')}`, description: PREVIEW })
  @ApiBody({ type: ImportPreviewRequestDto })
  @ApiOkResponse({ type: GroupLinkImportPreviewDto })
  previewLinks(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @StrictBody() dto: ImportPreviewRequestDto,
  ): Promise<GroupLinkImportPreviewDto> {
    return this.imports.previewLinks(user.id, programId, curriculumId, dto);
  }

  @Post(`${COHORT_IMPORTS}/confirm`)
  @HttpCode(200)
  @ImportErrors()
  @ApiOperation({ summary: 'Save a previewed group-links file for this cohort', description: CONFIRM })
  @ApiBody({ type: ImportConfirmRequestDto })
  @ApiOkResponse({ type: ImportResultDto })
  @ApiConflictResponse({ type: AdminErrorDto, description: STALE })
  confirmLinks(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @StrictBody() dto: ImportConfirmRequestDto,
  ): Promise<ImportResultDto> {
    return this.imports.confirmLinks(user.id, programId, curriculumId, dto);
  }
}
