# Vision v1.0: NFR source excerpts

These excerpts make the Elaboration test plan's source clauses reviewable without publishing the personal reference folder. They are copied from **OmniCourse — Vision Document, version 1.0**, revision **18 October 2026**, supplied by Thắng on 29 October 2026 as `OmniCourse - Vision Document v1.0.docx`.

Source location: **§6 Other Product Requirements → Non-Functional Requirements**, using the named bullets below. The document does not give those bullets separate requirement IDs.

Source file SHA-256: `dd80841a7298e47f77603c8fd240a23a8a7250e72909c87d3e0c4a071cc77ac9`.

## Performance

> Performance: the audit and the dashboard load in under 2 seconds for a 40-course transcript on a normal connection; a planner edit is validated in under 300 milliseconds; AI plan generation returns in under 30 seconds with visible progress.

## Usability

> Usability: responsive from 360 px to 1920 px, keyboard operable, Vietnamese and English, colour contrast at WCAG 2.1 AA, and every AI answer links to the document and clause it relies on.

## Testability and maintainability

> Testability and maintainability: at least 80% statement coverage of the rule engine, automated tests in the pipeline on every pull request, and the API contract published as OpenAPI 3.2.0.

These are source excerpts, not a new Vision version. Accepted [ADR 0003](../../analysis-and-design/adr/0003-language-model-scope.md) still overrides Vision v1.0's earlier F12 PDF-import scope and limits the language model to F6's goal box and F8.
