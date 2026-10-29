# ADR 0009: Term encoding

- Status: proposed
- Date: 2026-10-29
- Deciders: Lâm
- Reviewer: Hoà (plans), Triết (offering terms, #23), Dũng (advisor)

## Context

The transcript (ADR 0007), plans, offering terms (#23) and the planner (ADR 0006) all name terms, and the degree audit and the planner compare them across modules. GLOSSARY: a term is "a main term or a summer term", and Vision §4 (Assumptions) sets different credit caps for each (14–25 and 12), so the kind of term must be readable from the value. ADR 0007 first decided the encoding inside the transcript; it moves here so every module finds it.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **A term is two numbers, `year` and `number`, in every module.** `year` is the first calendar year of the academic year (2026 = 2026–2027). `number` is 1 or 2 for main terms and 3 for summer. | A string such as `"2026-1"`; a term index counted from the cohort's start; start and end dates | Two small integers sort correctly, as `(year, number)`, and can't be mistyped. A cohort-relative index breaks when a student changes cohort. Dates differ by year and say nothing about the kind of term. |
| **In SQL: `term_year smallint` and `term_number smallint CHECK (term_number IN (1, 2, 3))`. In JSON: `{ "year": 2026, "number": 1 }`.** In TypeScript, the `Term` interface exported from `transcript/transcript-entry.ts`. | One packed column (`20261`) | Two columns keep each part queryable and checkable. `transcript_rows` uses them, with `term_year BETWEEN 2000 AND 2100` as an input bound. |

## Consequences

- Plans (Hoà), offering terms (#23) and the planner (ADR 0006) adopt this encoding, or change this ADR before they ship.
- Open: confirm on a real portal transcript, read locally, that the portal numbers the summer term 3.
