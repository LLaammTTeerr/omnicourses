import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { AdminErrorDto } from '../curriculum-admin/admin-errors.js';
import { AdminErrors, uuidParam } from '../curriculum-admin/admin-params.js';
import { StrictBody } from '../curriculum-admin/strict-body.js';
import { User } from '../users/user.entity.js';
import { AcademicCalendarDto, AcademicCalendarEventDto, AcademicCalendarQueryDto, CreateCalendarEventDto, UpdateCalendarEventDto } from './academic-calendar.dto.js';
import { AcademicCalendarService } from './academic-calendar.service.js';

const EVENTS = 'admin/programs/:programId/calendar-events';

// F10 school dates (ADR 0016). Every signed-in user reads; only an administrator of the
// program writes, checked by the service inside the F12 write transaction (ADR 0011).
@ApiTags('academic-calendar')
@Authenticated()
@Controller()
export class AcademicCalendarController {
  constructor(private readonly calendar: AcademicCalendarService) {}

  @Get('academic-calendar')
  @ApiOkResponse({ type: AcademicCalendarDto, description: 'The school dates of the program, by date. Empty when nothing is entered.' })
  @ApiBadRequestResponse({ description: 'A malformed query value, or `to` before `from` (`validation_failed`).' })
  @ApiNotFoundResponse({ type: AdminErrorDto, description: '`not_found`: no program has the code given in `program`.' })
  list(@CurrentUser() user: User, @Query() query: AcademicCalendarQueryDto): Promise<AcademicCalendarDto> {
    return this.calendar.list(user.id, query);
  }

  @Post(EVENTS)
  @AdminErrors()
  @ApiBody({ type: CreateCalendarEventDto })
  @ApiCreatedResponse({ type: AcademicCalendarEventDto })
  create(@CurrentUser() user: User, @Param('programId', uuidParam('programId')) programId: string, @StrictBody() dto: CreateCalendarEventDto): Promise<AcademicCalendarEventDto> {
    return this.calendar.create(user.id, programId, dto);
  }

  @Patch(`${EVENTS}/:eventId`)
  @AdminErrors()
  @ApiBody({ type: UpdateCalendarEventDto })
  @ApiOkResponse({ type: AcademicCalendarEventDto })
  update(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('eventId', uuidParam('eventId')) eventId: string,
    @StrictBody() dto: UpdateCalendarEventDto,
  ): Promise<AcademicCalendarEventDto> {
    return this.calendar.update(user.id, programId, eventId, dto);
  }

  @Delete(`${EVENTS}/:eventId`)
  @AdminErrors()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted.' })
  remove(@CurrentUser() user: User, @Param('programId', uuidParam('programId')) programId: string, @Param('eventId', uuidParam('eventId')) eventId: string): Promise<void> {
    return this.calendar.remove(user.id, programId, eventId);
  }
}
