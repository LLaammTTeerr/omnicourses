# ADR 0016: Academic calendar

- Status: proposed
- Date: 2026-11-12
- Deciders: Lâm (Project Lead)
- Reviewers: Thắng (curriculum administrator, enters the dates), Hoà (calendar page), Dũng (F10 inbox), Triết (data boundaries)

## Context

F10 (Vision §5, as cited by the test plan's TC-B2-NOTIF-01) reminds students of registration windows and term starts. On 12 November 2026 Lâm decided that F10 in B2 is an **in-app inbox only, no email**, and that the school dates it needs live in an **admin-entered `academic_calendar`**: Thắng, who holds the APCS program-administrator grant ([ADR 0011](0011-curriculum-administration.md)), enters them each term from the school's announcements. AGENTS.md hard rule 2 forbids reading the school portal, so these dates cannot be scraped; they are typed in, like the curriculum.

The calendar page ([prototype](../ui-prototypes/calendar.html)) shows a week and a month view. A per-student timetable (the prototype's classes, rooms and deadlines) is **out of scope** here: this ADR covers only the dates the school publishes for a whole program.

ADR 0015 is claimed by the advisor harness (open PR #77), so this is 0016.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **One table, `academic_calendar` (the name Lâm's decision uses), scoped by `program_id`.** A row is one dated item: `academic_year` (ADR 0009: 2026 is 2026–2027), an optional `term` (1, 2, 3; null for the whole year), a `kind`, `starts_on` and `ends_on` (`date`, inclusive), `title` (Vietnamese, required), optional `title_en`, `source_url` and `notes`. | One calendar for the whole school; a JSON document per term; a table per kind | Programs differ: APCS has a third main term where a đại trà program has a summer term ([ADR 0012](0012-credit-caps-by-training-type.md)), and grants are per program (ADR 0011), so per-program rows let Thắng edit APCS without touching CLC. Rows sort and filter in SQL, which the inbox will need. |
| **Kinds: `term_start`, `term_end`, `registration`, `add_drop`, `exam_period`, `holiday`, `other`.** A CHECK enforces the list. | Free-text kinds | The inbox triggers on a known kind (a registration window opens, a term starts; test plan TC-B2-NOTIF-01). `other` keeps the admin unblocked when the school publishes something new. Adding a kind is a migration and an ADR amendment. |
| **A date range, never a timestamp.** `ends_on >= starts_on` (CHECK). The API takes and returns `YYYY-MM-DD` and refuses a date that does not exist. A one-day item has `ends_on = starts_on`; the create route defaults `endsOn` to `startsOn`. | `timestamptz` instants; a nullable `ends_on` | School announcements give days, not times. A timestamp would shift a day across time zones. A non-null end keeps "is this date in range" one comparison. |
| **`starts_on` must fall in the academic year's first or second calendar year.** | No check; check against term boundaries | Catches a mistyped year (2062 for 2026) without guessing the school's term dates, which are exactly what this table records. |
| **`source_url` is https only** (DTO check and a database CHECK). | Any URL | It links to the school's announcement, which students open. An `http:` or `javascript:` link would be a downgrade or an injection. |
| **Shared data, no `user_id`.** `created_by` and `updated_by` are `uuid REFERENCES users(id) ON DELETE SET NULL` and are never returned by the API. | Per-student copies; no attribution | AGENTS.md and [ADR 0004](0004-account-export-and-deletion.md): a key to `users` in another column must be SET NULL, so purging Thắng's account keeps every program's dates. The export reads `user_id` only, so the dates are not exported as his data. The IDs are other users' identifiers and do not belong in a student's response. |
| **`program_id … ON DELETE RESTRICT`.** | CASCADE | Same as program grants and curricula (ADR 0005, ADR 0011): shared academic data is never deleted as a side effect. |
| **Reads: `GET /api/academic-calendar`, for every signed-in user.** Without `program`, the caller's onboarding program; without one, `{ "program": null, "events": [] }`. An unknown `program` code is `404 not_found`. Filters: `academicYear`, and `from`/`to`, which keep every item that overlaps the range. Order: `starts_on`, `ends_on`, `title`, `id`. | Read through the admin routes; only the caller's own program | The dates are public school information and hold nothing about a student. Overlap, not containment, so a registration window that opened last week still shows in this week's view. A fixed order makes the page and the inbox deterministic. |
| **Writes: `POST /api/admin/programs/:programId/calendar-events`, `PATCH` and `DELETE …/calendar-events/:eventId`, through F12's `AdminWriteService`.** The program-administrator grant for `:programId` is checked inside the F12 write transaction and lock; an event of another program is `404`. Unknown body fields are refused (`StrictBody`). Errors use ADR 0011's codes (`permission_required`, `validation_failed`, `not_found`, `account_deletion_pending`). | A new guard or role (a "calendar editor"); the catalog-maintainer or access-manager permission | ADR 0011: one grant model, checked in the service, no second guard. The program administrator already owns the program's academic data. A separate role would need its own grant table, UI and bootstrap for one table. |
| **Nothing is seeded.** Production starts empty; tests create synthetic programs and dates and delete them. | Seed this year's dates | A wrong date is worse than none: students would plan around it. Hard rule 3 keeps fixtures synthetic. |
| **No academic rule reads this table.** | Let the rule engine derive "current term" from it | Hard rule 1 keeps rules deterministic and sourced from the regulation. The calendar informs and reminds; it never decides eligibility. |

## Consequences

- Hoà's calendar page reads one route. Thắng's admin screen needs the program ID from `GET /api/admin/programs` and the event IDs from the read route.
- F10's inbox (Dũng) can generate reminders from `registration`, `add_drop` and `term_start` rows. Its delivery, timing and duplicate rules remain open in the test plan §8.
- Dates are only as good as the last entry. `updated_at` is returned so the page can say when the calendar was last changed, and `source_url` lets a student check the original.
- A change history of edits is not kept, the same deferral as ADR 0011's audit trail for curriculum writes.
- Adding a kind needs a migration (the CHECK) and an amendment here.
