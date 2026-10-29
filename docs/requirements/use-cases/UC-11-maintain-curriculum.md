# UC-11: Maintain curriculum

- Feature: F12 Curriculum administration
- Owner: Thắng
- Status: draft for PA2; describes work still to be built
- Scope: manual entry and editing. Curriculum PDF import is excluded by accepted [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md); any proposal to restore it needs a separate scope decision.

## 1. Brief description

A program administrator adds and updates a program's curriculum using official documents. Each cohort, meaning students who entered the program in the same year, has its own curriculum.

The administrator maintains requirement groups and their course links for that cohort. Courses themselves form one shared catalog: changing a course's name or credits affects every program and cohort that links to it. Only a user with separate catalog permission may make that change, after reviewing its impact (A8).

Prerequisites and offering terms are part of the intended curriculum data, but their schema and service interfaces still need a handoff from Triết (section 8). The administrator records what the official documents say; the rule engine checks academic rules using code. No AI model reads or decides the curriculum data.

## 2. Actors

**Program administrator:** a signed-in user with permission to maintain a particular program. They read the official documents and enter the data themselves. No external service takes part.

**Catalog maintainer:** a signed-in user with permission to maintain shared course records across programs. **Access manager:** a signed-in user who may create programs and grant or revoke administration permissions. These are proposed F12 permissions, owned by Thắng; one user may hold more than one (section 8).

## 3. Preconditions

- The administrator is signed in through the app's existing authentication ([ADR 0002](../../analysis-and-design/adr/0002-authentication-and-sessions.md)).
- They have the permission for the operation: program permission for curriculum data, catalog permission for shared courses, or access-manager permission for program creation and access grants (section 8).
- They have the official curriculum document for the program and cohort.

## 4. Basic flow

1. The administrator opens **Curriculum administration** and selects a program and cohort. The system offers only programs they may maintain and shows the selected curriculum.
2. The administrator chooses a curriculum item to add or edit, then enters the values from the official document. They select existing courses from the catalog; creating or changing a catalog course follows A8.
3. The administrator checks their entries against the document and presses **Save**. A shared course change also requires confirmation of every affected curriculum (A8).
4. The system checks the operation's permission and the submitted values. It checks required fields, code format and links to other items. Academic checks use the rule engine, through an interface agreed with Triết.
5. The system saves the whole change and shows the saved values, program and cohort. If the save fails, it stores none of the change. Other parts of the app can read successful changes through the curriculum API.

Course codes use the canonical format `^[A-Z0-9]{2,20}$`: trim surrounding whitespace, convert letters to uppercase, then validate. Examples are `CS101` and `MTH201`. This follows [ADR 0007 in PR #29](https://github.com/LLaammTTeerr/omnicourses/blob/812d0c2336ad6ec4f8a942f7f388300e7434ef21/docs/analysis-and-design/adr/0007-transcript.md); Triết must align the catalog's current `varchar(50)` with that contract before implementation. The same course can belong to several groups without being entered again. After saving, the administrator can return to step 2.

## 5. Alternative flows

### A1. Add a cohort

At step 1, the program exists but the cohort does not. The administrator chooses **Add cohort**, enters its details from the official document and saves. The system rejects a duplicate cohort but allows a different cohort in the same program. The administrator can then enter its curriculum. Earlier cohorts stay unchanged.

### A2. Add a program

At step 1, the program does not exist. A user with permission to create programs chooses **Add program**, enters its details and saves. The system checks that permission and rejects a duplicate program code.

An access manager grants program-maintainer permission to an existing user for the new program. Creating a program does not automatically grant curriculum or catalog editing rights. The proposed permissions are defined in section 8.

### A3. Invalid or missing values

At step 4, the system finds a problem: a required field is empty, a code is duplicated where it must be unique, a number is invalid, or a linked item does not exist. It marks the affected fields and refuses to save.

For an academic problem, such as an inconsistent prerequisite, the system shows the rule engine's result. Triết and Thắng must agree which academic checks apply before building this feature. The administrator can correct the entries and try again; the saved curriculum stays unchanged.

### A4. No permission or expired sign-in

The system refuses a request if the user is signed out or lacks the permission for that operation. It asks a signed-out user to sign in again. Otherwise, it explains whether program, catalog or access-manager permission is missing.

The backend checks every request, including requests sent directly without using the screen. Changing a program ID in a request cannot bypass the check. No data changes.

### A5. Remove an item or remove a course from a group

At step 2, the administrator requests a removal. The system shows what will be removed and asks for confirmation.

Removing a course from one requirement group keeps the course itself and its links to other groups. If another saved item still needs the data being deleted, the system refuses the deletion and shows what depends on it. This proposed removal policy needs review; see section 8.

### A6. Cancel an edit

Before pressing **Save** at step 3, the administrator cancels. The current edit is discarded. Earlier successful saves remain.

### A7. Save fails or the connection is lost

At step 5, the server may fail to save, or the connection may end before the result reaches the administrator. The system must not report success without knowing it succeeded.

A failed save leaves no partial change. If the result is unknown, the administrator reloads the item to see whether it was saved before trying again.

### A8. Create or change a shared catalog course

A catalog maintainer can open **Course catalog** directly, without selecting a program or holding a program grant. A user who also has program permission may enter from step 2. They may create a course with a new code, or correct an existing course's name, credits or time breakdown. Program permission alone cannot authorize either operation. Linking the course to a requirement group separately requires permission for that group's program.

Before saving an existing course, the system shows its old and new values and every linked program and cohort. It explains that all those curricula will read the new values. The catalog maintainer checks the official source and confirms that impact. The backend checks catalog permission and rechecks the affected links; if the impact changed during review, it requires another review before saving.

A catalog correction applies to every linked curriculum. If the intended value differs by cohort, this shared edit cannot represent it: refuse that use of the edit and require Triết's versioning design first. Do not promise cohort-specific course values in the current catalog. A catalog maintainer may delete only an unreferenced course; a linked course is protected by A5. Changing a linked course code needs a separate reviewed migration, not an ordinary edit.

## 6. Postconditions

- **Saved curriculum item:** the change belongs to the selected program and cohort and is available through the curriculum API.
- **Saved catalog item:** every linked program and cohort reads the new shared course values. The degree audit and planner may return different results when they next use those values.
- **Rejected or cancelled:** the attempted change is not saved. Earlier successful saves remain.
- **Result unknown:** the administrator checks the saved item before assuming success or failure.
- Curriculum membership edits leave other cohorts' links unchanged. Catalog edits have the explicitly confirmed reach described in A8. Neither edit rewrites stored transcript rows or course placements in saved plans.

## 7. Special requirements

- **Permissions:** reuse the app's sign-in check, then enforce the operation's program, catalog or access-manager permission on every backend request. Thắng owns these F12 permissions under [ADR 0002](../../analysis-and-design/adr/0002-authentication-and-sessions.md).
- **Data:** curriculum groups and membership are separate by program and cohort; course attributes are shared, following [ADR 0005 in PR #23](https://github.com/LLaammTTeerr/omnicourses/blob/a8b71ddf77028b6d0441fa89f37e9fe0ab6e2121/docs/analysis-and-design/adr/0005-curriculum-cohort-and-course-catalog.md). A8 governs global corrections. Cohort-specific course attributes need a separate versioning design before they can be edited.
- **Academic rules:** use official documents for data and the rule engine for academic checks ([AGENTS.md](../../../AGENTS.md), hard rule 1). This feature does not call an AI model or depend on the AI gateway.
- **Usability:** support Vietnamese and English, keyboard use and different screen sizes. Explain invalid fields in words as well as colour.
- **Testing:** use made-up curriculum records in tests. For B3, enter a second program or cohort through the administration screen and check that the first still works.

## 8. Additional information

### Who owns each part

| Owner | Responsibility | Handoff |
| --- | --- | --- |
| Triết | Database structure, curriculum read API and rule engine. | [PR #23](https://github.com/LLaammTTeerr/omnicourses/pull/23) has no prerequisite or offering-term tables. Supply those migrations and the read/validation interfaces, plus an impact query listing every curriculum linked to a course, before the related writes are built. |
| Thắng | Curriculum write API, F12 permission model, administration screens and APCS data. | Verified seed data for B1; administration API and screens in B2/Sprint 4, following [SDP v2 §4.2.1–4.2.3 in PR #20](https://github.com/LLaammTTeerr/omnicourses/blob/1e8d8c4623017738574812431dadd639d8bc4545/docs/management/software-development-plan.md#42-project-plan); second-program or second-cohort check in B3. |
| Lâm | Authentication. | Reuse the work merged in [PR #8](https://github.com/LLaammTTeerr/omnicourses/pull/8). |
| Hoà | Use-case model and agreed requirements. | Review UC-11 for the PA2 model. |

Offering terms use `term_number` values `1` and `2` for main terms and `3` for summer, from proposed [ADR 0009 in PR #29](https://github.com/LLaammTTeerr/omnicourses/blob/812d0c2336ad6ec4f8a942f7f388300e7434ef21/docs/analysis-and-design/adr/0009-term-encoding.md). If an offering is tied to an academic year, also use its `term_year`. The encoding moved out of ADR 0007; Triết must agree this handoff before implementation. A suggested study term is not evidence of an offering term.

### Proposed F12 permission model

Thắng owns this proposal and its implementation; Lâm reviews authentication integration and Triết reviews the data boundaries. Permissions are independent and denied by default.

| Permission | Allows | Does not grant |
| --- | --- | --- |
| Program maintainer for a named program | Edit that program's details, cohorts, groups and course links; maintain its prerequisites/offering terms once their contract exists. | Shared catalog writes, another program's data, program creation or permission grants. |
| Catalog maintainer, global | Create shared courses; correct their attributes after the A8 impact review; delete only unreferenced courses. | Editing curriculum membership or granting permissions. |
| Access manager, global | Create programs and grant/revoke these permissions for existing users. | Automatic program-maintainer or catalog-maintainer rights. |

The Project Lead provisions the first access manager through a controlled setup step implemented by F12. After that, access managers grant/revoke permissions through F12; sign-up and onboarding never grant them. Every write checks the current grants, including after a revocation. The storage and bootstrap command belong in Thắng's F12 design.

### Decisions still needed

| Question | Current proposal | Who reviews it |
| --- | --- | --- |
| Does the proposed permission model fit deployment and the curriculum API? | Thắng implements the three permissions above and the controlled first-access-manager setup; review those boundaries before coding. | Thắng owns; Lâm and Triết review |
| How do we represent course values that differ by cohort? | The current catalog cannot do this. Use A8 only for corrections intended for every linked curriculum; design course versions before allowing cohort-specific values. | Triết and Hoà |
| Can we delete data that other records use? | Refuse deletions that break those links. Remove a course from a group separately from deleting the course. Decide whether old data should be archived. | Triết |

The API routes, database tables and academic rules are defined in their own designs.

### Examples to test

IDs follow `TC-<build>-<area>-<number>`. Dũng expands each example into cases with preconditions and steps, using suffixes such as `TC-B2-ADM-01a` without changing the parent ID. These are B2 checks; B1 uses reviewed seed data.

| ID | Action | Expected result | Requirement / flow |
| --- | --- | --- | --- |
| TC-B2-ADM-01 | A catalog maintainer with no program grant opens the catalog directly and changes a course shared by two programs after reviewing both; a program-only maintainer tries the same write. | The authorized correction reaches both curricula; the program-only write is refused. Cohort-specific values are refused under the shared model. | F12; UC-11 A4, A8; ADR 0002, ADR 0005 (#23) |
| TC-B2-ADM-02 | Exercise each permission boundary and revoke a grant before another write. | Program writes stay within grants; catalog/access-manager operations require their own grants; revoked access cannot write. | F12; UC-11 A2, A4, §8; ADR 0002 |
| TC-B2-ADM-03 | A program maintainer adds a second cohort and links an existing course. | Both cohorts exist; the first cohort's membership stays intact; no duplicate catalog course appears. | F12; UC-11 A1; ADR 0005 (#23) |
| TC-B2-ADM-04 | Remove one of a course's group links, then attempt to delete the still-linked course. | The other group link and course remain; catalog deletion is refused while referenced. | F12; UC-11 A5, A8; ADR 0005 (#23) |
| TC-B2-ADM-05 | Submit invalid codes or links; cancel; fail a save or lose its response; change course links during impact review. | Validate canonical codes; save nothing on rejection/cancel; no partial save; check an unknown result; require renewed impact review. | F12; UC-11 A3, A6–A8; ADR 0007 (#29) |

### Sources

Scope follows accepted ADR 0003 and ownership follows the supplied Work Breakdown, as updated by Lâm's review of PR #30. The administration schedule follows SDP v2 in PR #20. Schema, course-code and term-encoding references above are proposals still under review in PRs #23 and #29; they are explicit handoffs, not claims about the current main branch. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), and the section structure follows [PR #16](https://github.com/LLaammTTeerr/omnicourses/pull/16).
