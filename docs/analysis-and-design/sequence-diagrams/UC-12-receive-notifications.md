# Sequence diagrams: UC-12 Receive notifications

- Use case: UC-12 (Use-Case Specification v1.0, [`report/assignments/PA2/uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex#L688-L733)), feature F10
- Drawn from the code on `main`: `src/frontend/src/App.vue`, `src/frontend/src/notifications/` (`NotificationsView.vue`, `UnreadBadge.vue`, `store.ts`, `api.ts`, `messages.ts`), `src/backend/src/notifications/` (`notifications.controller.ts`, `notifications.service.ts`, `notification-schedule.ts`, `notification-kinds.ts`), `src/backend/src/academic-calendar/academic-calendar.service.ts`, `src/backend/src/onboarding/onboarding.service.ts`, `src/backend/src/transcript/transcript.service.ts` ([ADR 0018](../adr/0018-notification-inbox.md), [ADR 0017](../adr/0017-academic-calendar.md))
- Built: scheduled creation of `registration_soon` (7 days before), `registration_open` (opening day) and `term_start` (first day) notifications in Vietnam time, transactional `transcript_changed` notifications on transcript edits, unread badge polling (`useUnread`, `UnreadBadge.vue`), the `/notifications` inbox (`NotificationsView.vue`) with pagination, **Mark as read**, **Mark all as read** and action links (`calendar`, `planner`, `audit`). Not built: bell popover, inbox filters (A4), per-kind opt-out settings (A5), "plan breaks a rule" (A2), and course/audit-diff details inside notifications ([design differences, UC-12](../design-differences.md#uc-12-receive-notifications-f10)).

## Scheduled school-date notifications (UC-12 steps 1–3, A6)

```mermaid
sequenceDiagram
    autonumber
    participant Timer as NotificationSchedule
    participant Clock as Clock
    participant Svc as NotificationsService
    participant Cal as AcademicCalendarService
    participant Onb as OnboardingService
    participant DB as PostgreSQL

    Note over Timer: runs onApplicationBootstrap, then at the sooner of<br/>10 minutes or 00:00 Vietnam time (17:00:00 UTC)
    Timer->>Svc: tick() -> createDue()
    Svc->>Clock: now()
    Clock-->>Svc: instant -> today = vietnamDate(instant), inSevenDays = today + 7 days
    Svc->>Cal: startingOn([today, inSevenDays], ["registration", "term_start"])
    Cal->>DB: SELECT academic_calendar JOIN programs<br/>WHERE kind IN (...) AND starts_on = ANY(...)
    DB-->>Cal: CalendarEventStart[]
    Cal-->>Svc: events
    Svc->>Svc: notificationsDue(event, today) -> registration_soon (starts_on = today + 7),<br/>registration_open (starts_on = today), term_start (starts_on = today)
    opt at least one notification is due today
        Svc->>Onb: userIdsByProgram(programCodes)
        Onb->>DB: SELECT user_id, program_code FROM onboarding_answers WHERE program_code = ANY(...)
        Onb-->>Svc: Map of programCode -> userIds
        loop each due (event, kind) with recipients
            Svc->>DB: INSERT INTO notifications (user_id, kind, calendar_event_id, snapshot columns, created_at)<br/>SELECT u.id, ... FROM users u WHERE u.id = ANY(recipients)<br/>AND u.deletion_requested_at IS NULL<br/>ON CONFLICT (user_id, calendar_event_id, kind) DO NOTHING
            Note over Svc,DB: each statement runs outside a shared transaction so one failure<br/>logs only failureKind + SQLSTATE and never blocks other programs
        end
    end
```

- **Strict day rule and no repeats:** missed past days are never backfilled, and `uq_notifications_user_event_kind` (`user_id`, `calendar_event_id`, `kind`) guarantees each student receives each notification of a school date at most once, even across concurrent timer ticks, reads or date moves.
- **Snapshot independence:** `notifications` stores a snapshot of the school date (`programCode`, `academicYear`, `term`, `startsOn`, `endsOn`, `title`, `titleEn`) with no foreign key to `academic_calendar`, so deleting the calendar event leaves delivered notifications intact.

## Transcript-changed notification inside the save transaction (UC-12 A1)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as TranscriptView
    participant Ctrl as TranscriptController
    participant Trans as TranscriptService
    participant Notif as NotificationsService (onSaved)
    participant DB as PostgreSQL

    Student->>View: reviews rows (and pre-save diff when overwriting) and presses Save transcript
    View->>Ctrl: PUT /api/users/me/transcript { rows }
    Ctrl->>Trans: replace(user.id, dto.rows)
    Trans->>DB: BEGIN
    Trans->>DB: SELECT 1 FROM users WHERE id = user.id FOR NO KEY UPDATE
    Trans->>DB: SELECT existing transcript_rows -> before
    Trans->>DB: DELETE transcript_rows WHERE user_id = user.id, INSERT new rows
    Trans->>DB: SELECT stored transcript_rows -> after
    Trans->>Trans: multiset comparison -> wasEmpty = (before.length === 0), changed = !sameTranscript(before, after)
    Trans->>Notif: listener(tx, { userId: user.id, wasEmpty, changed })
    opt wasEmpty is false and changed is true
        Notif->>DB: INSERT INTO notifications (user_id, kind = "transcript_changed", created_at = clock.now())
    end
    Trans->>DB: COMMIT
    Trans-->>Ctrl: TranscriptEntry[]
    Ctrl-->>View: 200 TranscriptDto { rows }
```

- First-time imports (`wasEmpty === true`), saves with identical rows in any order (`changed === false`), validation refusals (`400`) and rolled-back transactions create no notification. The listener receives only `{ userId, wasEmpty, changed }`, never a grade or course code.

## Unread bell polling, opening `/notifications`, and marking read (UC-12 steps 4–7, A3)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Shell as App.vue / UnreadBadge
    participant Unread as useUnread store
    participant View as NotificationsView
    participant Api as notifications/api.ts
    participant Ctrl as NotificationsController
    participant Svc as NotificationsService
    participant DB as PostgreSQL

    Note over Shell,Unread: on sign-in, on every route change, and every 60 s while !document.hidden
    Shell->>Unread: refresh()
    Unread->>Api: GET /api/notifications/unread-count, Bearer token
    Api->>Ctrl: unreadCount(user)
    Ctrl->>Svc: unreadCount(user.id)
    Svc->>Svc: createDue(user.id) (errors caught and rate-logged so the read still succeeds)
    Svc->>DB: SELECT count(*)::int FROM notifications WHERE user_id = user.id AND read_at IS NULL
    DB-->>Svc: count
    Svc-->>Ctrl: UnreadCountDto { unread }
    Ctrl-->>Unread: 200 { unread }
    Unread-->>Shell: UnreadBadge displays count (capped at 99+, hidden when 0)

    Student->>View: clicks Notifications bell and opens /notifications
    View->>Api: fetchNotifications(50, null) -> GET /api/notifications?limit=50
    Api->>Ctrl: list(user, query)
    Ctrl->>Svc: list(user.id, query)
    Svc->>Svc: createDue(user.id)
    Svc->>DB: SELECT notifications WHERE user_id = user.id<br/>ORDER BY created_at DESC, id DESC LIMIT 51
    DB-->>Svc: rows
    Svc-->>Ctrl: NotificationListDto { notifications, nextBefore }
    Ctrl-->>View: 200 NotificationListDto
    View-->>Student: bilingual cards worded from kind and event snapshot,<br/>with action links (calendar, planner, audit) and Mark as read

    alt Student clicks an action link or Mark as read on an unread card (step 7)
        Student->>View: clicks link or Mark as read
        View->>Api: POST /api/notifications/{id}/read
        Api->>Ctrl: markRead(user, id) (NotificationIdPipe turns malformed UUID into 404)
        Ctrl->>Svc: markRead(user.id, id)
        Svc->>DB: UPDATE notifications SET read_at = COALESCE(read_at, clock.now())<br/>WHERE id = id AND user_id = user.id RETURNING *
        Svc-->>Ctrl: NotificationDto (or 404 not_found when unknown or another student's)
        Ctrl-->>View: 200 NotificationDto
        View->>Unread: refresh() (or navigates to /calendar, /plans or /audit, triggering App.vue refresh)
    else Student presses Mark all as read (A3)
        Student->>View: presses Mark all as read
        View->>Api: POST /api/notifications/read-all
        Api->>Ctrl: markAllRead(user)
        Ctrl->>Svc: markAllRead(user.id)
        Svc->>DB: UPDATE notifications SET read_at = clock.now()<br/>WHERE user_id = user.id AND read_at IS NULL
        Svc-->>Ctrl: UnreadCountDto { unread: 0 }
        Ctrl-->>View: 200 { unread: 0 }
        View->>Unread: set(0)
        View-->>Student: toast confirming all notifications are marked read
    else Student presses Show older notifications
        Student->>View: presses Show older notifications
        View->>Api: fetchNotifications(50, nextBefore) -> GET /api/notifications?limit=50&before={id}
        Api->>Ctrl: list(user, query)
        Ctrl->>Svc: list(user.id, query) resolves cursor (created_at, id) inside PostgreSQL
        Ctrl-->>View: 200 NotificationListDto appended to the list
    end
```
