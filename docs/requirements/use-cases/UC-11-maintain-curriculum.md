# UC-11: Maintain curriculum

- Feature: F12 Curriculum administration
- Owner: Thắng
- Status: draft for PA2; describes work still to be built
- Scope: manual entry and editing. [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md) removes curriculum PDF import, formerly UC-12.

## 1. Brief description

A program administrator adds and updates a program's curriculum using official documents. Each cohort, meaning students who entered the program in the same year, has its own curriculum.

The administrator maintains courses, prerequisites, requirement groups and offering terms. The degree audit, curriculum explorer and planner all read this data. The administrator records what the official documents say; the rule engine checks academic rules using code. No AI model reads or decides the curriculum data.

## 2. Actors

**Program administrator:** a signed-in user with permission to maintain a particular program. They read the official documents and enter the data themselves. No external service takes part.

## 3. Preconditions

- The administrator is signed in through the app's existing authentication ([ADR 0002](../../analysis-and-design/adr/0002-authentication-and-sessions.md)).
- They have permission to maintain the selected program. Creating a new program needs separate permission; see section 8.
- They have the official curriculum document for the program and cohort.

## 4. Basic flow

1. The administrator opens **Curriculum administration** and selects a program and cohort. The system offers only programs they may maintain and shows the selected curriculum.
2. The administrator chooses an item to add or edit, then enters the values from the official document.
3. The administrator checks their entries against the document and presses **Save**.
4. The system checks their permission and the submitted values. It checks required fields, codes and links to other items. Academic checks use the rule engine, through an interface agreed with Triết.
5. The system saves the whole change and shows the saved values, program and cohort. If the save fails, it stores none of the change. Other parts of the app can read successful changes through the curriculum API.

Courses are identified by course code (e.g. CS101 - Introduction to Computer Science, MTH201 - Calculus 1, etc...). The same course can belong to several requirement groups without being entered as a new course each time. After saving, the administrator can return to step 2 to edit another item.

## 5. Alternative flows

### A1. Add a cohort

At step 1, the program exists but the cohort does not. The administrator chooses **Add cohort**, enters its details from the official document and saves. The system rejects a duplicate cohort but allows a different cohort in the same program. The administrator can then enter its curriculum. Earlier cohorts stay unchanged.

### A2. Add a program

At step 1, the program does not exist. A user with permission to create programs chooses **Add program**, enters its details and saves. The system checks that permission and rejects a duplicate program code.

Someone must then receive permission to maintain the new program. Being allowed to edit one program does not give access to another. Who grants these permissions is still open in section 8.

### A3. Invalid or missing values

At step 4, the system finds a problem: a required field is empty, a code is duplicated where it must be unique, a number is invalid, or a linked item does not exist. It marks the affected fields and refuses to save.

For an academic problem, such as an inconsistent prerequisite, the system shows the rule engine's result. Triết and Thắng must agree which academic checks apply before building this feature. The administrator can correct the entries and try again; the saved curriculum stays unchanged.

### A4. No permission or expired sign-in

The system refuses a request if the user is signed out or lacks permission for the program. It asks a signed-out user to sign in again. Otherwise, it explains that they cannot maintain that program.

The backend checks every request, including requests sent directly without using the screen. Changing a program ID in a request cannot bypass the check. No data changes.

### A5. Remove an item or remove a course from a group

At step 2, the administrator requests a removal. The system shows what will be removed and asks for confirmation.

Removing a course from one requirement group keeps the course itself and its links to other groups. If another saved item still needs the data being deleted, the system refuses the deletion and shows what depends on it. This proposed removal policy needs review; see section 8.

### A6. Cancel an edit

Before pressing **Save** at step 3, the administrator cancels. The current edit is discarded. Earlier successful saves remain.

### A7. Save fails or the connection is lost

At step 5, the server may fail to save, or the connection may end before the result reaches the administrator. The system must not report success without knowing it succeeded.

A failed save leaves no partial change. If the result is unknown, the administrator reloads the item to see whether it was saved before trying again.

## 6. Postconditions

- **Saved:** the change belongs to the selected program and cohort and is available through the curriculum API.
- **Rejected or cancelled:** the attempted change is not saved. Earlier successful saves remain.
- **Result unknown:** the administrator checks the saved item before assuming success or failure.
- An edit does not silently change other cohorts, unrelated course/group links, student transcripts or student plans.

## 7. Special requirements

- **Permissions:** reuse the app's sign-in check, then check permission for the selected program on every backend operation.
- **Data:** keep curricula separate by program and cohort. Allow the same course in several groups or curricula. Changes must preserve the meaning of existing data; section 8 identifies the versioning decision needed before editing a curriculum already in use.
- **Academic rules:** use official documents for data and the rule engine for academic checks ([AGENTS.md](../../../AGENTS.md), hard rule 1). This feature does not call an AI model or depend on the AI gateway.
- **Usability:** support Vietnamese and English, keyboard use and different screen sizes. Explain invalid fields in words as well as colour.
- **Testing:** use made-up curriculum records in tests. For B3, enter a second program or cohort through the administration screen and check that the first still works.

## 8. Additional information

### Who owns each part

| Owner | Responsibility | Handoff |
| --- | --- | --- |
| Triết | Database structure, curriculum read API and rule engine. | Agree the interfaces before Thắng builds on them. Database work is in [PR #23](https://github.com/LLaammTTeerr/omnicourses/pull/23). |
| Thắng | Curriculum write API, administration screens and APCS data. | API in B1; screens in B2; second-program or second-cohort check in B3. |
| Lâm | Authentication. | Reuse the work merged in [PR #8](https://github.com/LLaammTTeerr/omnicourses/pull/8). |
| Hoà | Use-case model and agreed requirements. | Review UC-11 for the PA2 model. |

### Decisions still needed

| Question | Current proposal | Who reviews it |
| --- | --- | --- |
| Who can create programs and grant access? | Require explicit permission. Decide who grants access to the first administrator and to each new program's administrator. | Lâm and Triết |
| How do we change a curriculum already used by students or plans? | Preserve what existing records mean. Decide when a correction needs a new curriculum version and which version each part of the app reads. | Triết and Hoà |
| Can we delete data that other records use? | Refuse deletions that break those links. Remove a course from a group separately from deleting the course. Decide whether old data should be archived. | Triết |
| What happens to UC-12? | PDF import is already excluded. Decide whether to remove UC-12 from the model or use that number for a separately agreed use case. | Hoà and Thắng; Lâm if the scope changes |

The API routes, database tables and academic rules are defined in their own designs.

### Examples to test

| Action | Expected result | Reference |
| --- | --- | --- |
| An administrator saves a course change in their program. | The curriculum API returns the change; unrelated data stays unchanged. | Basic flow, steps 2–5 |
| A user tries to change a program they do not maintain. | The system refuses and changes nothing. | A4 |
| An administrator adds a second cohort. | Both cohorts exist; the first curriculum stays intact. | A1 |
| A course belongs to two groups and is removed from one. | The course and its link to the other group remain. | A5, proposed policy |
| Invalid input or a server failure prevents a save. | No partial change is stored and no success is reported. | A3, A7 |

### Sources

The scope and ownership come from the Project Lead's Work Breakdown dated 23 October 2026, supplied for this task, with the changes accepted in ADR 0003. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), and the section structure follows [PR #16](https://github.com/LLaammTTeerr/omnicourses/pull/16). Check this draft against Hoà's Vision v2 and the agreed curriculum interfaces before approving it.
