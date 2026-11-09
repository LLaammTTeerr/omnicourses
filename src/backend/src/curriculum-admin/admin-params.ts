import { applyDecorators, ParseUUIDPipe } from '@nestjs/common';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { AdminErrorDto, PermissionRequiredDto, validationFailed } from './admin-errors.js';

/** A path ID that must be a UUID: otherwise `400 validation_failed`, before any lookup. */
export const uuidParam = (name: string) => new ParseUUIDPipe({ exceptionFactory: () => validationFailed(`${name}: must be a UUID`) });

/** The errors every F12 route can answer, on top of the 401 of @Authenticated(). */
export const AdminErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ type: AdminErrorDto, description: '`validation_failed`: a malformed ID or code, an unknown field or an invalid value; nothing is saved' }),
    ApiForbiddenResponse({ type: PermissionRequiredDto, description: '`permission_required`: the caller lacks the grant this needs; `account_deletion_pending`' }),
    ApiNotFoundResponse({ type: AdminErrorDto, description: '`not_found`: nothing with this ID or code within the authorised scope' }),
  );
