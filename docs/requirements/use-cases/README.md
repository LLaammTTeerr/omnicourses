# Use-case specifications

One file per use case, in the RUP structure: brief description, actors, preconditions, basic flow, alternative flows, postconditions, special requirements. Use the words in [GLOSSARY.md](../../../GLOSSARY.md). Hoà builds the use-case model from these files.

| Use case | Feature | Owner | File |
| --- | --- | --- | --- |
| UC-01 Sign up and onboard | F1 | Lâm | [UC-01](UC-01-sign-up-and-onboard.md) |
| UC-02 Import transcript | F2 | Lâm | [UC-02](UC-02-import-transcript.md) |
| UC-03 View degree audit | F3 | Triết | |
| UC-04 Explore curriculum | F4 | Triết | |
| UC-05 Build and edit a plan | F5 | Hoà | |
| UC-06 Simulate a what-if scenario | F7 | Hoà | |
| UC-07 Generate a plan | F6 | Lâm | [UC-07](UC-07-generate-a-plan.md) |
| UC-08 Ask the advisor chat | F8 | Dũng | [UC-08](UC-08-ask-the-advisor-chat.md) |
| UC-09 Share or export a plan | F9 | Dũng | [UC-09](UC-09-share-or-export-a-plan.md) |
| UC-10 Follow a school-task guide | F11 | Dũng | [UC-10](UC-10-follow-a-school-task-guide.md) |
| UC-11 Maintain curriculum | F12 | Thắng | [UC-11](UC-11-maintain-curriculum.md) (#30) |
| ~~UC-12 Import a curriculum PDF~~ | F12 | | Dropped |

UC-12 is dropped: [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md) allows no curriculum PDF-to-data import, so curriculum data is entered by a program administrator or catalog maintainer (UC-11). Restoring it needs a separate scope decision.
