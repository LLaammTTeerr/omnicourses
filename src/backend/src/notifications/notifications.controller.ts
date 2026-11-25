import { Controller, Get, HttpCode, Param, PipeTransform, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { NotificationDto, NotificationListDto, NotificationNotFoundDto, NotificationsQueryDto, UnreadCountDto } from './notifications.dto.js';
import { notificationNotFound, NotificationsService } from './notifications.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed ID is a 404 like any unknown notification, as for plans: a 400 or a 500 would tell IDs apart. */
export class NotificationIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw notificationNotFound();
    return value.toLowerCase();
  }
}

// F10, the notification inbox (UC-12, ADR 0018): the signed-in student's own notifications only.
// No route takes a user ID, and none is public (ADR 0002).
@ApiTags('notifications')
@Authenticated()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: NotificationListDto, description: "The caller's notifications, newest first. The notifications due today are created first, so a school date entered for today shows at once." })
  @ApiBadRequestResponse({ description: 'A malformed query value.' })
  @ApiNotFoundResponse({ type: NotificationNotFoundDto, description: "`not_found`: `before` is not one of the caller's notifications." })
  list(@CurrentUser() user: User, @Query() query: NotificationsQueryDto): Promise<NotificationListDto> {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountDto, description: 'The number for the bell. The notifications due today are created first.' })
  unreadCount(@CurrentUser() user: User): Promise<UnreadCountDto> {
    return this.notifications.unreadCount(user.id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOkResponse({ type: UnreadCountDto, description: "Every unread notification of the caller is now read (UC-12 A3). Calling it again changes nothing." })
  markAllRead(@CurrentUser() user: User): Promise<UnreadCountDto> {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NotificationDto, description: 'The notification, read. Calling it again changes nothing: `readAt` keeps the first time.' })
  @ApiNotFoundResponse({ type: NotificationNotFoundDto, description: "`not_found`: no notification with this ID among the caller's (another student's included, and a malformed ID). Nothing changes." })
  markRead(@CurrentUser() user: User, @Param('id', new NotificationIdPipe()) id: string): Promise<NotificationDto> {
    return this.notifications.markRead(user.id, id);
  }
}
