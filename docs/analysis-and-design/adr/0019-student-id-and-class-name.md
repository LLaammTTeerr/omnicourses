# ADR 0019: Storing the student ID and the class name

- Status: accepted
- Date: 2026-11-28
- Deciders: Lâm (Project Lead), on the team Discord, 27 November 2026 (answer "4B")
- Reviewers: Triết (backend), Hoà (dashboard header), Dũng

## Context

The header of the dashboard prototype ([`ui-prototypes/dashboard.html`](../ui-prototypes/dashboard.html)) shows the student's name, class name and student ID (mã số sinh viên, MSSV). OmniCourse stored neither: the `users` table held the email, the display name, the consent time and the deletion state ([ADR 0002](0002-authentication-and-sessions.md), [ADR 0004](0004-account-export-and-deletion.md)).

On 27 November 2026 Lâm answered four questions about the dashboard in one Discord message:

1. **1A**: the conduct-score tile (điểm rèn luyện) of the prototype is dropped. OmniCourse has no source for it.
2. **2A**: the "estimated graduation" figure on the dashboard is the target term the student chose in onboarding, labelled as their target. No academic rule computes a graduation term (UC-03 step 3), and none is added.
3. **3A**: classification (xếp loại) applies only to the cumulative average, as [ADR 0013](0013-rule-engine-and-degree-audit.md) already says, never to a single term.
4. **4B**: the header shows the student ID and the class name, as in the prototype.

This ADR records 4B and how the two values are stored. 1A and 2A are recorded in [design-differences.md](../design-differences.md) (UC-03), and 3A in ADR 0013 (dated line of 28 November 2026).

The number 0016 is still kept for the advisor harness (open PR #77), so this is 0019.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **The student types both in Settings.** Both are optional. `PATCH /api/users/me` takes `studentId` and `className`. A field left out keeps its value; `null` or a blank string clears it. Any other field in the body is refused with 400, so this route cannot change the email or the display name. | Not storing them, so the header has no student ID (rejected by Lâm's 4B). Reading them from the school portal (forbidden by AGENTS.md hard rule 2: OmniCourse never signs in to the portal for a student). | `test/profile.e2e-spec.ts`, `users/user.dto.spec.ts` |
| **Two nullable columns on `users`**: `student_id varchar(8)` and `class_name varchar(32)` (migration `1795700000000`). A `CHECK` keeps `student_id` to exactly 8 ASCII digits, whatever writes it. | A table of its own, with a `user_id` key. It would add a join to every read of the account for two values that belong to it, one to one. | ADR 0004: the export reads every column of the student's `users` row, and the purge deletes the row. |
| **Validation**: the student ID is exactly 8 digits 0–9 (no full-width or Arabic-Indic digits, no spaces inside), sent as a string. The class name is trimmed, at most 32 code points, with no control character (`\p{Cc}`, U+0000 included). Both are trimmed first. | Any length of student ID: HCMUS student IDs have 8 digits (`24120000` is the shape). A class-name format: classes are named differently across programs and years. | `users/user.dto.spec.ts`; the frontend checks the same pattern and length, and `account/api.spec.ts` reads them from `openapi.json` |
| **No uniqueness on `student_id`.** Two accounts may type the same number. | A unique key. The value is self-typed and unverified, so a unique key would let anyone block another student's number, and its 409 would tell a stranger that the number has an account. | — |
| **The account DTO carries both** (`UserDto.studentId`, `UserDto.className`), so `GET /api/users/me`, sign-in and refresh return them to their owner. No other route returns them: `UserDto` is used only for the signed-in student's own account. | A separate profile route. The header already has the account from sign-in. | `grep UserDto src/backend/src` |

## Privacy

- **Export and deletion**: the column names do not end in a credential suffix (`*_hash`, `*_token`, `*_key`, …), so the export includes them. Deleting the `users` row at the purge deletes them. Tested in `test/profile.e2e-spec.ts`.
- **Never sent to a language model** (AGENTS.md hard rule 3, [ADR 0003](0003-language-model-scope.md)). They are identity fields, not part of the pseudonymous record that F8 may send. The AI gateway receives only a user id for metering, plus the prompt and messages its caller writes. It never reads the account. `test/profile.e2e-spec.ts` stores both for a student, runs a structured call and a chat for that student through the real gateway against a recording model client, and checks that neither value (nor the user id) is in any request. **Whoever builds F8's record (PR #77) must not read these two columns.** A test of the record builder must check that.
- **Never logged.** The validation messages name the field, not the value, and the frontend logs only the HTTP status of a failed save. Both are tested.
- **Shown only to the student.** The shared-plan page and the administration screens do not show them.

## Consequences

- Hoà's dashboard header reads `auth.user.studentId` and `auth.user.className`. After a save, Settings replaces the signed-in account with the reply (`useAuth().setUser`), so the header updates without signing in again.
- The values are unverified. Nothing may use them as an identity or to decide an academic rule.
