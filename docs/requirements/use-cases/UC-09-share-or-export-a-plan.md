# UC-09: Share or export a plan

- Feature: F9 Plan export (Vision §5: "Export a plan as PDF, or share a read-only link with an academic advisor.")
- Owner: Dũng
- Status: draft for the use-case model (PA2); planned for build B2
- What is built: the [README feature table](../../../README.md#what-is-built). Where the API differs from this specification, see [design differences](../../analysis-and-design/design-differences.md) and the amendment of [ADR 0010](../../analysis-and-design/adr/0010-public-pages-and-guide-content.md).

## 1. Brief description

A student gives one of their plans to someone else, usually a lecturer or academic advisor who reviews it. The student either downloads the plan as a PDF file, or creates a **shared plan**: a read-only link that anyone holding it can open without an account. The student can stop sharing at any time, and the link stops working at once.

## 2. Actors

- **Student** (primary).
- **Advisor** (secondary): a lecturer or academic advisor who opens the shared plan. They need no OmniCourse account. Anyone else who is given the link can open it too.

## 3. Preconditions

- The student is signed in and has at least one saved plan (UC-05 or UC-07).

## 4. Basic flow

1. The student opens one of their plans and presses **Share**.
2. The system shows what a reader of the link will see:
   - the plan's name, program, cohort and curriculum version;
   - each term with its courses and credits;
   - the violations the rule engine finds from the plan and its curriculum alone, such as a credit cap exceeded or a course placed in a term it is not taught in;
   - when the plan was last changed.

   It also says what a reader will not see: the student's grades, email, transcript and other plans. The student's display name is hidden unless the student ticks **Show my name**.

   The checks that come from the student's transcript are hidden unless the student ticks **Show the checks from my transcript**: prerequisites not met, courses already passed or in progress, requirements not covered, the coverage of each requirement and the estimated graduation term. When the box is ticked, the system tells the student plainly that a reader can then tell which courses the student has passed, failed or is taking, though never a grade. When it is not ticked, the system says that a reader will be told that some checks are not shown.

   The system warns that anyone who has the link can open it. The student can change both boxes later without getting a new link.
3. The student presses **Create link**.
4. The system creates an unguessable link for this plan and shows it with a **Copy** button.
5. The student copies the link and sends it to their advisor through any channel, such as email or chat. OmniCourse sends nothing itself.
6. The advisor opens the link.
7. The system shows the plan read-only, term by term, with the content listed in step 2 and a banner: "Shared plan, read-only, last changed <date>". The page has no edit control and asks for no sign-in.
8. The advisor reviews the plan and replies to the student outside OmniCourse.

## 5. Alternative flows

**A1. Download as PDF.**
1. At step 1 the student presses **Download PDF** instead.
2. The system makes a PDF with the same content as the shared view (step 2), plus the date it was made, on A4 pages. The PDF follows the same choice about the checks from the transcript as the link: they are in the PDF only when the student ticked the box, with the same warning.
3. The browser saves the file. No link is created, and the file is not kept on the server.

**A2. Stop sharing.** The student opens the plan's **Share** panel and presses **Stop sharing**. The link stops working at once. Anyone who opens it sees "This plan is not shared", the same page as for a link that never existed, so the page does not reveal whether a plan was there.

**A3. Share again.** After A2 the student presses **Create link** again. The system creates a new link; the old one stays dead.

**A4. The plan is already shared.** At step 1 the plan already has a live link. The system shows that link with **Copy** and **Stop sharing** instead of creating a second one. A plan has at most one live link.

**A5. The plan changes after sharing.** The student edits the shared plan. The shared view shows the plan as it is now, with the new last-changed date. A PDF downloaded earlier does not change.

**A6. The plan is deleted.** The link stops working, as in A2.

**A7. Account deletion requested.** When the student asks to delete their account ([ADR 0004](../../analysis-and-design/adr/0004-account-export-and-deletion.md)), every link they created stops working at once, like their sessions. If the student signs in during the grace period and the account is restored, the links stay stopped; the student shares again (A3).

**A8. Unknown or mistyped link.** Someone opens a link that does not match a live shared plan. The system shows the A2 page.

**A9. Plan with violations.** The plan breaks an academic rule, for example a credit cap exceeded. Sharing is still allowed. The shared view and the PDF show the violations as the rule engine reports them. The advisor sees the same problems as the student only when the student chose to show the checks from the transcript (step 2). Otherwise the checks that come from the transcript are left out, and the page and the PDF say that some checks are not shown, so that an empty list does not read as a plan with no problem.

## 6. Postconditions

- **Shared:** a live link for the plan exists until the student stops sharing, deletes the plan or asks to delete the account. The plan itself is unchanged, and a reader cannot change anything.
- **Downloaded:** a PDF is on the student's device. Nothing new is stored on the server.
- **Stopped:** the plan has no live link.

## 7. Special requirements

- **Privacy** (AGENTS.md hard rule 3; Vision §6, Luật 91/2025/QH15): a reader sees only the content listed in step 2. Grades, email, student ID and transcript rows never appear in the shared view or the PDF. When the student chose to show the checks from the transcript, a reader can tell from those checks which courses the student has passed, failed or is taking; without that choice, nothing a reader sees depends on the transcript, and the transcript is not read. The page tells search engines not to index it (`noindex`).
- **Security:** the link holds a random token at least as strong as a session token (32 random bytes, [ADR 0002](../../analysis-and-design/adr/0002-authentication-and-sessions.md)), so it cannot be found by guessing. The shared page is one of the public routes of ADR 0010: it needs no sign-in, only reads, and is rate-limited like other routes (120 requests a minute per address).
- **Academic rules** (AGENTS.md hard rule 1): the violations, and the estimated graduation term once it is computed (see **Gap** below), in the shared view and the PDF come from the rule engine, computed against the curriculum version the plan was made with.
- **Usability:** the shared view works from 360 px wide and by keyboard, in Vietnamese and English (the reader's browser language). The PDF is readable when printed in black and white: violations are marked in words, not only by colour.

## 8. Additional information

**Depends on:** Hoà's `plans` module (due 8 Nov) and the planner (UC-05); Triết's rule engine for violations and the estimated graduation term.

**Decided** (Lâm, 30 Oct 2026):
- The shared view shows the plan as it is now (A5), not a copy taken when the link was made.
- One live link per plan (A4), with no expiry date. The student can stop sharing at any time (A2).
- The student's display name is hidden unless the student chooses to show it (step 2).
- Links stay stopped when a pending account deletion is cancelled (A7).
- The shared page opens without signing in. This changes ADR 0002 and is recorded in ADR 0010.
- Sharing is Dũng's own `sharing` module. It reads plans only through a read-only method that Hoà's `PlansService` exports (ADR 0010).

**Agreed by Dũng, owner of F9, and accepted by Lâm, Project Lead** (25 Nov 2026, team Discord; Lâm answered "yes"). Recorded in [ADR 0010](../../analysis-and-design/adr/0010-public-pages-and-guide-content.md), amendment of 25 November 2026:
- The student chooses, for each link, whether a reader sees the checks that come from the transcript (step 2, A9, §7). The choice is off unless the student turns it on, it can be changed on a live link, and the PDF follows it (A1).
- The PDF is made in the browser, as a print layout of the shared view. Nothing is made on the server.
- The link's token is stored so that it can be shown again (A4), not as a hash.

**Gap:** nothing computes the estimated graduation term yet (step 2, §7), so neither the shared view nor the PDF can show it. When the rule engine computes it, it goes under the choice about the checks from the transcript.

**Out of scope:** comments from the advisor on the plan, sharing inside a cohort (Vision "community features"), and sending the link by email from OmniCourse (no mail sender before B3, UC-01).
