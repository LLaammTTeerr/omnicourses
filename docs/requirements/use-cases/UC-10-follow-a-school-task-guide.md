# UC-10: Follow a school-task guide

- Feature: F11 Quicklinks and step-by-step guides (Vision §5). The glossary calls each entry a **guide**.
- Owner: Dũng
- Status: draft for the use-case model (PA2); describes work still to be built (Sprint 3, build B1)
- Which guides exist and what each one contains: the guides plan (`docs/requirements/guides-plan.md`).

## 1. Brief description

A student needs to do a school task that OmniCourse does not perform, such as registering for courses or paying tuition. They find the guide for that task, read when to do it and what to prepare, and follow the steps on the official portal through the guide's direct link. OmniCourse never signs in to a portal and never acts on one for the student.

## 2. Actors

- **Student** (primary), signed in or not: reading a guide needs no account.
- **Portal** (secondary): the HCMUS website where the task is done. OmniCourse only links to it and exchanges no data with it.

## 3. Preconditions

- At least one guide is published.

No sign-in is needed to read guides (ADR 0010). Only the parts that use the student's data need it: the program's values (A3) also need finished onboarding (UC-01 A7), and the plan's courses (A4) need a saved plan. Reporting a problem (A6) needs sign-in too.

## 4. Basic flow

1. The student opens **Guides**.
2. The system lists the guides grouped by task group, such as Registration, Tuition and fees, Records and certificates, and Graduation. Each entry shows the task, the portal it uses, the account it needs and the direct link. A search box sits above the list.
3. The student types a few words, such as "register" or "học phí". The system narrows the list as they type, matching titles and keywords in Vietnamese and English, with or without Vietnamese diacritics ("hoc phi" finds "học phí").
4. The student opens a guide.
5. The system shows the guide:
   - what the task is for and who needs to do it;
   - when to do it, with a link to the school's announcement for this term's dates;
   - what to prepare, with links into OmniCourse where they help;
   - the portal and the account it needs;
   - numbered steps, quoting the portal's buttons as they appear on screen;
   - notes on what commonly goes wrong;
   - the guide's version and the date a team member last checked it on the portal.
6. The student presses **Open <portal name>**. The system opens the direct link in a new tab, on the deepest page the school allows (a deep link), instead of the portal's home page.
7. The student signs in on the portal with their school account and completes the task there. OmniCourse sees none of it.

## 5. Alternative flows

**A1. Straight to the link.** At step 2 the student already knows what to do and presses the direct link in the list. The flow continues at step 7.

**A2. No guide matches.** At step 3 nothing matches. The system says no guide covers it yet and shows the task groups to browse. That is all A2 does in B1. From B3 it also offers **Suggest a guide** (A6) and asking the advisor chat (UC-08).

**A3. A note that depends on the program.** At step 5 a note depends on the student's program, for example the credit cap when registering for courses. If the student is signed in and has finished onboarding, the system shows the value for their program and cohort as the rule engine gives it, with the regulation it comes from. Otherwise it says the value depends on the program and offers to sign in or finish onboarding (UC-01). The guide's own text never states the value (AGENTS.md hard rule 1).

**A4. Course registration from a plan.** At step 5 of the course registration guide, a signed-in student with saved plans chooses one. A signed-out reader sees an offer to sign in instead. The system lists the courses that plan places in the next term, with their codes ready to copy. OmniCourse does not check sections or timetables, and never registers for the student (AGENTS.md hard rule 2). The portal does the registration.

**A5. The guide may be out of date.** At step 5 the guide was last checked more than 6 months ago. The system shows a warning that the portal may have changed, with the last-checked date. The guide stays readable. In B1 this 6-month rule is the only trigger; from B3, when reports arrive with A6, a reported broken link that is not yet fixed also shows the warning.

**A6. Report a problem.** At any step the student presses **Report a problem** (or **Suggest a guide** from A2). A signed-out reader is asked to sign in first. They choose a reason (link broken, steps changed, missing guide, other) and may add a short note. The form warns them not to include their name, student ID or password. The system stores the report against the guide and its version and thanks the student. Dũng reviews reports; a stale guide counts as a bug (Vision F11) and is fixed like any other defect.

**A7. The portal is down.** At step 7 the portal does not load. That is outside OmniCourse. If the guide knows another way, such as an office or a second address the school publishes, its **If the portal is down** note gives it.

**A8. One language only.** At step 5 the guide exists in one language only. The system shows that version with a note saying so.

## 6. Postconditions

- **Success:** the student has the direct link and the steps, and has done the task on the portal. OmniCourse stores nothing about the task, including whether it was completed.
- **Report made (A6):** one report is stored against the guide and version.
- Guides themselves never change through this use case.

## 7. Special requirements

- **No portal access** (AGENTS.md hard rule 2): OmniCourse never asks for a portal password, never fills in a portal form and never reads a portal page. Integration is by link only.
- **Academic rules** (AGENTS.md hard rule 1): a guide never states an academic rule's value. A value that depends on the program comes from the rule engine (A3); otherwise the guide cites the regulation clause.
- **Privacy** (AGENTS.md hard rule 3): screenshots in guides use a synthetic account or hide every name, student ID and grade.
- **Versioning** (Vision F11, glossary **Guide**): every published change gets a new version number, a change note and a new last-checked date.
- **Usability:** Vietnamese and English, from 360 px wide (students often read the guide on a phone next to the portal on a laptop), and by keyboard. Direct links are ordinary links that open in a new tab.

## 8. Additional information

**Depends on:** the rule engine (Triết) for A3 and the `plans` API (Hoà) for A4. Search, browse and reading (steps 1–7) depend on nothing else, so they can ship in B1.

**Decided** (Lâm, 30 Oct 2026):
- B1 (15 Nov): steps 1–7, A1, A2 with the task groups only, A5 with the 6-month rule only, and A8, with the first four guides of the guides plan. B3: A3, A4, A6, the rest of A2 and A5, and the remaining guides.
- Guides can be read without signing in, and are content files in the repository, loaded into the database by a seed, with no admin screen. Both change ADR 0002 and are recorded in ADR 0010.

**Proposed here, to confirm:** a guide is out of date (A5) when it was last checked more than 6 months ago. Every guide is checked again before each main term's registration.

**Open:** each guide's portal address, account and steps must be checked on the real portal by a team member before it is published. None is verified yet.
