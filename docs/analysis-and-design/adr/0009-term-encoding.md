# ADR 0009: Term encoding

- Status: proposed
- Amended by: [ADR 0012](0012-credit-caps-by-training-type.md)
- Date: 2026-10-29
- Deciders: Lâm
- Reviewer: Hoà (plans), Triết (offering terms, #23), Dũng (advisor)

## Context

The transcript (ADR 0007), plans, offering terms (#23) and the planner (ADR 0006) all name terms, and the degree audit and the planner compare them across modules. GLOSSARY: a term is "a main term or a summer term", and Vision §4 (Assumptions) sets different credit caps for each (14–25 and 12; amended below), so the kind of term must be readable from the value. ADR 0007 first decided the encoding inside the transcript; it moves here so every module finds it.

**Amended 9 November 2026 ([ADR 0012](0012-credit-caps-by-training-type.md)).** The caps cited above were wrong for most programs. The training regulation, QĐ 1175/QĐ-KHTN Điều 6.4 and 7.2, gives Tiên tiến, Liên kết and Chất lượng cao programs, APCS among them, three main terms a year and 10–22 credits in every term. Only đại trà programs have two main terms (14–25 credits) and an optional summer term (at most 12). The kind of term is still readable, but from the program's training type together with the value, not from the value alone.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **A term is two numbers, `year` and `number`, in every module.** `year` is the first calendar year of the academic year (2026 = 2026–2027). ~~`number` is 1 or 2 for main terms and 3 for summer.~~ *Amended 9 November 2026:* `number` is 1, 2 or 3 in the order of the academic year. 3 is a summer term in a đại trà program and a third main term in a Tiên tiến, Liên kết or Chất lượng cao program (ADR 0012). | A string such as `"2026-1"`; a term index counted from the cohort's start; start and end dates | Two small integers sort correctly, as `(year, number)`, and can't be mistyped. A cohort-relative index breaks when a student changes cohort. Dates differ by year and say nothing about the kind of term. |
| **In SQL: `term_year smallint` and `term_number smallint CHECK (term_number IN (1, 2, 3))`. In JSON: `{ "year": 2026, "number": 1 }`.** In TypeScript, the `Term` interface in `terms/term.ts`, and `TermDto` in `terms/term.dto.ts` for validating a term in a request body; neither belongs to one feature module. | One packed column (`20261`) | Two columns keep each part queryable and checkable. `transcript_rows` uses them, with `term_year BETWEEN 2000 AND 2100` as an input bound. |

## Consequences

- Plans (Hoà), offering terms (#23) and the planner (ADR 0006) adopt this encoding, or change this ADR before they ship.
- Open: confirm on a real portal transcript, read locally, that the portal numbers the third term of the year 3: the summer term of a đại trà program, and the third main term of a Tiên tiến program such as APCS (amended 9 November 2026).
