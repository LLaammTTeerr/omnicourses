# UC-12: Import a curriculum PDF

- Feature: F12 Curriculum administration
- Owner: Thắng, working with Triết on curriculum data and validation
- Status: draft for PA2; describes work still to be built
- Scope: import an official curriculum PDF into draft data, review it, then save the confirmed changes. Manual entry and editing are covered by [UC-11](UC-11-maintain-curriculum.md).

**Scope confirmed on 29 October 2026:** Thắng confirmed that curriculum PDF import remains in their work alongside Triết. This draft follows that direction and the deterministic parsing requirement in [AGENTS.md](../../../AGENTS.md). [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md) still excludes all PDF-to-data import; its F12 wording and the requirements baseline need to be reconciled by their owners. This draft does not introduce an AI gateway dependency.

## 1. Brief description

A program administrator uploads an official curriculum PDF for a selected program and cohort. The system extracts the data it can read into a draft. The administrator checks the draft against the source, corrects missing or incorrect values, and confirms the changes before they become available to the degree audit, curriculum explorer and planner.

The import records courses, credits, prerequisites, requirement groups and offering terms only where the source states them. It does not invent missing values or decide academic rules. Parsing follows fixed rules; academic checks belong to the rule engine.

## 2. Actors

**Program administrator:** a signed-in user with permission to maintain the selected program. They supply the PDF, review its contents and confirm the import. No external AI service takes part.

Triết's data review is a team responsibility, not a separate application role or a mandatory second approval screen.

## 3. Preconditions

- The administrator is signed in through the existing authentication ([ADR 0002](../../analysis-and-design/adr/0002-authentication-and-sessions.md)) and may maintain the selected program.
- The program and cohort exist. If needed, the administrator creates them through UC-11 first.
- The administrator has the official curriculum PDF for that program and cohort and can check the draft against it.

## 4. Basic flow

1. The administrator opens **Curriculum administration**, selects a program and cohort, and chooses **Import curriculum PDF**. The system explains the supported files and upload limit, then accepts the PDF and its source title or version.
2. The system checks permission and the file, then reads it with the deterministic parser. It prepares draft courses and their curriculum links, marks unreadable or missing information, and keeps the saved curriculum unchanged.
3. The system shows the draft with source page references and a comparison with existing data. The administrator checks the target program and cohort, reviews every proposed change against the PDF, and corrects or completes the draft. Unreadable sections are shown so the administrator can enter what was missed.
4. The administrator presses **Confirm import**. The system rechecks permission, required fields, course codes, links and any changes to the saved curriculum since review. Academic checks use the rule engine through the interface agreed with Triết. It refuses to save while blocking problems remain.
5. The system saves all confirmed changes together and shows the result for the selected program and cohort. The curriculum read API exposes the saved data to the other features. If saving fails, none of the import is applied.

An uploaded file or a parsed draft is not a completed import. Only the confirmed, validated save changes the curriculum.

## 5. Alternative flows

### A1. Invalid or unsupported file

At steps 1–2, the file is not a valid PDF, exceeds the stated limit, is damaged or password-protected, or cannot be read by the supported parser. The system explains the cause and offers another upload or manual entry through UC-11. It changes no curriculum data.

The initial proposal is to support an agreed APCS PDF layout with a readable text layer. A scanned PDF or an unfamiliar layout follows this flow unless support has been explicitly added and tested; see section 8.

### A2. Missing, unreadable or inconsistent data

At steps 2–4, a field or section cannot be read, a required value is missing, a course code conflicts with another entry, or a link refers to a course or group that cannot be resolved. The system marks the affected item and explains what needs correction. It does not guess a prerequisite, offering term, group rule or credit value.

The administrator completes the draft from the official source, removes an unrelated extracted row, or cancels. If the PDF lacks required information, they must use another official source and record it before saving. Removing a row must not hide a missing required item or leave a broken link. Rule-engine failures are shown with the affected items and must be resolved before confirmation succeeds.

### A3. Existing data or repeated import

At step 3, the target already contains some of the data. The system identifies unchanged items, additions and conflicting values using the agreed curriculum identifiers. It does not create a second course just because the same course appears in another requirement group or is imported again.

The administrator resolves each conflict explicitly. Items absent from the PDF are not deleted automatically. A repeated import with no differences reports that there is nothing to change. Changes to a curriculum already used by students must follow the versioning policy shared with UC-11; until that policy is agreed, replacing such data is outside this draft's supported flow.

### A4. Wrong target, no permission or expired sign-in

If the administrator notices the wrong program or cohort before confirmation, they cancel and restart with the correct target. The system also blocks confirmation when the source identifies a different target; it asks for the correct file or target instead of silently importing it.

On every backend request, including upload, draft access and confirmation, the system checks sign-in and permission for the target program. A signed-out user must sign in again; a user without permission is refused access. Changing an identifier in a request cannot bypass these checks. No curriculum changes are saved.

### A5. Curriculum changes during review

At step 4, another operation has changed the target curriculum since the draft comparison. The system refuses the stale confirmation and shows an updated comparison. The administrator reviews the new differences before confirming again. The import does not overwrite changes the administrator has not reviewed.

### A6. Cancel or parsing fails

Before confirmation, the administrator cancels, or parsing fails or times out. The system reports cancellation or failure and leaves the saved curriculum unchanged. It offers another attempt or manual entry. Temporary files and draft data are removed according to the retention policy in section 8.

### A7. Save fails or its result is unknown

At step 5, a server failure leaves no partial import. If the connection ends before the result arrives, the system does not claim success or assume failure. The administrator checks the saved curriculum before retrying; the comparison in A3 prevents a retry from creating duplicate data.

## 6. Postconditions

- **Saved:** all confirmed changes belong to the selected program and cohort and are available through the curriculum API. No unresolved blocking problem remains.
- **Rejected, cancelled or failed before saving:** the attempted import changes no saved curriculum data. Earlier successful saves remain.
- **Result unknown:** the administrator checks the saved curriculum before treating the import as successful or trying again.
- Other cohorts, unrelated course/group links, student transcripts and saved plans are not silently rewritten by the import.

## 7. Special requirements

- **Determinism and academic rules:** the same PDF and parser version produce the same extracted draft. No language model extracts, repairs or validates curriculum data. The rule engine remains the authority on academic rules ([AGENTS.md](../../../AGENTS.md), hard rule 1).
- **Review and source evidence:** show source pages, missing sections and all proposed changes. Keep the source document title/version and references with the confirmed data so it can be checked later. Reuse UC-11's curriculum identifiers, validation and save rules through agreed interfaces.
- **Permissions and file handling:** enforce program permission on the server. Process uploads within OmniCourse, apply file and processing limits, and remove temporary files and drafts under the agreed policy. Do not place personal data or file contents in prompts, fixtures or logs.
- **Usability:** support Vietnamese and English, keyboard use and different screen sizes. Explain problems in words as well as colour, show processing progress, and keep manual entry available when a PDF is unsupported.
- **Testing:** use synthetic PDFs and curriculum records. Cover supported layouts, incomplete extraction, conflicts, repeated imports, permission checks, concurrent changes and failed saves. The APCS seed still needs Triết's line-by-line check against the official source.

## 8. Additional information

### Who owns each part

| Owner | Responsibility | Handoff |
| --- | --- | --- |
| Thắng | UC-12 specification, import workflow in the administration API and screens, parser tests and APCS data preparation. | Agree the PDF examples and data contract with Triết before implementation; import delivery is planned for B2. |
| Triết | Curriculum schema, read API, rule engine and review of the imported APCS data. | Agree course identifiers, draft fields, validation and version handling with Thắng; check APCS data against the official source. |
| Hoà | Use-case model and requirements baseline. | Keep UC-12 as curriculum PDF import and align its relationship with UC-11. |
| Lâm | Authentication and ownership of ADR 0003. | Reconcile the F12 exclusion with the confirmed scope. The import does not depend on the AI gateway. |

### Details to settle before implementation

| Question | Current proposal | Who reviews it |
| --- | --- | --- |
| Which PDFs are supported first? | Start with one verified APCS layout with a text layer. Check actual official examples before committing to support; offer UC-11 for other layouts. | Thắng and Triết |
| What are the upload, processing and retention limits? | Choose limits from the supported examples; delete temporary uploads and drafts after completion, cancellation or expiry, while retaining source references with saved data. Fix the exact limits and expiry before implementation. | Thắng and Triết |
| How does a draft map to existing curriculum data? | Use shared identifiers, explicit conflict review, no deletion by omission, and an atomic save. Agree the academic checks and versioning policy with UC-11 before allowing replacement of a curriculum already in use. | Triết and Thắng; Hoà for the effect on existing student views |
| Which documents need the confirmed scope? | Align [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md)'s F12 clause and Vision/use-case model with deterministic PDF import. The original Work Breakdown's AI-gateway wording for F12 no longer applies. | Lâm and Hoà |

These details do not reopen whether UC-12 exists or who owns its specification. Parser libraries, database tables and API routes belong in the implementation design.

### Examples to test

| Action | Expected result | Reference |
| --- | --- | --- |
| An administrator imports a supported synthetic PDF, reviews it and confirms. | Nothing changes during review; confirmation saves the full validated change for the selected cohort. | Basic flow, steps 1–5 |
| A PDF is unreadable or a required field cannot be resolved. | The system explains the problem, saves nothing and offers correction or manual entry. | A1–A2 |
| The same PDF is imported twice, or a course appears in two groups. | Existing items are matched without duplicate courses; both intended group links remain and omitted items are not deleted. | A3 |
| An unauthorized user confirms, or the curriculum changed during review. | The system refuses the request or requires renewed review, without applying the import. | A4–A5 |
| The administrator cancels, saving fails or the response is lost. | No partial import is exposed; an unknown result is checked before retrying. | A6–A7 |

### Sources

Scope and ownership come from the Work Breakdown dated 23 October 2026 and Thắng's confirmation on 29 October 2026 that curriculum PDF import continues alongside Triết. The document follows [UC-11](UC-11-maintain-curriculum.md)'s section structure and [GLOSSARY.md](../../../GLOSSARY.md)'s terms. [AGENTS.md](../../../AGENTS.md) supplies the deterministic parsing and rule-engine constraints; the outstanding conflict with [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md) is stated above rather than treated as an approved ADR revision.
