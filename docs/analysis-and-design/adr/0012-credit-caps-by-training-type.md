# ADR 0012: Credit caps by training type

- Status: accepted
- Amends: [ADR 0009](0009-term-encoding.md)
- Date: 2026-11-09
- Deciders: Lâm (Project Lead), through his delegate, 9 Nov 2026
- Reviewers: Triết (rule engine), Hoà (plans, screens), Dũng (advisor)

## Context

Vision §4 (Assumptions) took the credit caps to be 14–25 credits in a main term and 12 in summer, for every program. AGENTS.md hard rule 1, ADR 0009 and the B1 test cases repeated it, and the B1 test cases called the UI prototypes' 10–22 a bug. The regulation says otherwise. The HCMUS training regulation, Quy chế đào tạo trình độ đại học, issued with QĐ 1175/QĐ-KHTN of 24 September 2021 ([PDF](https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf)), sets the academic year and the caps by **training type**:

- **Điều 6.4.a, đại trà programs:** two main terms a year, each with 15 weeks of teaching. The school may add a summer term of at least 5 weeks for retaking, improving or getting ahead.
- **Điều 6.4.b, Tiên tiến, Liên kết and Chất lượng cao programs:** three main terms a year, with at least 30 weeks of classes in total. It names no summer term.
- **Điều 7.2.a, minimum per term:** 10 credits for Tiên tiến, Liên kết and Chất lượng cao; 14 for đại trà, not counting Giáo dục quốc phòng, Giáo dục thể chất or general foreign language.
- **Điều 7.2.b, maximum:** 22 credits per main term for Tiên tiến, Liên kết and Chất lượng cao; 25 per main term for đại trà; 12 in a summer term. In special cases a student may go above the maximum or below the minimum with a petition that the faculty supports and the Rector approves.
- **Điều 7.2.c:** a student in two programs at once may take at most 37 credits per main term and 15 per summer term.
- **Điều 7.1.b:** a term's load counts new courses, retaken courses and courses taken again to improve a grade.

APCS is the Advanced Program (Chương trình Tiên tiến), and the seeded CLC 2025 programs are Chất lượng cao. The seeded APCS 2024 and 2025 teaching plans (`src/backend/src/database/seeds/apcs-202{4,5}.teaching-plan.ts`) place courses in 12 terms over 4 years: three a year, as Điều 6.4.b says.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **The credit caps depend on the program's training type.** Tiên tiến, Liên kết and Chất lượng cao: 10–22 credits in every term. Đại trà: 14–25 in a main term and at most 12 in a summer term, with no minimum in summer. | One pair of caps for every program (14–25 and 12, Vision §4); caps typed per curriculum by hand | Điều 7.2.a–b. One pair is wrong for APCS and CLC, which are the programs OmniCourse supports first. The caps follow the training type in the regulation, so storing the type once per program is enough; typing caps per curriculum repeats the regulation and lets it drift. No đại trà minimum in summer is a reading: Điều 7.2.a sets the minimum per term, but a 14-credit minimum cannot hold with a 12-credit summer maximum. |
| **For Tiên tiến, Liên kết and Chất lượng cao, term number 3 is a third main term, not a summer term.** ADR 0009's encoding (`year`, `number` 1–3) stays. The kind of term is read from the program's training type together with `number`: number 3 is a summer term only in a đại trà program. | A fourth number for the summer term; a separate term-kind column on every term | Điều 6.4. The encoding already fits both calendars: each has at most three terms a year. A stored kind would duplicate what the training type already says and could contradict it. |
| **A load outside the caps is a violation the rule engine reports. It does not block saving a plan.** The violation cites Điều 7.2 and says that a petition approved by the faculty and the Rector allows it. | Refusing to save the plan; silently clamping the load | Điều 7.2.b allows going beyond either cap by petition, so a plan outside them can be legitimate. Reporting it keeps the rule visible (AGENTS.md hard rule 1) without forbidding what the regulation allows. |
| **Credits per term in onboarding is the student's preferred load, not a cap.** It stays a whole number of 1 or more with no upper limit (B1 test cases §6 item 2). The rule engine checks the caps when it builds or validates a plan. | Bounding the onboarding field by the caps | A preference outside the caps is still useful input to the planner, and the engine reports the violation where the plan is shown. The field would otherwise need the training type before the student has picked a program. |
| **A student follows one program.** The two-program caps (37 per main term, 15 per summer term) are out of scope. | Modelling a second program per student | OmniCourse models one program and one curriculum per student (UC-01, ADR 0005). |

## Consequences

- Hard rule 1 in AGENTS.md, ADR 0009, GLOSSARY.md and the B1 test cases now state the caps per training type.
- The `programs` table has no training-type column yet (migration `1792912952302`). The rule engine's PR adds one, with APCS as Tiên tiến and the CLC programs as Chất lượng cao, and later đại trà programs when their data is entered (F12).
- The đại trà minimum leaves out Giáo dục quốc phòng, Giáo dục thể chất and general foreign language, so the engine needs to know which courses those are before it checks a đại trà minimum.
- `terms/term.ts`, `terms/term.dto.ts` and `openapi.json` still describe number 3 as the summer term. They change with the rule engine, not in this documentation change.
- Vision §4 and the PA1 Project Plan, under `report/`, keep the old caps: they are submitted assignments. This ADR supersedes that assumption.
