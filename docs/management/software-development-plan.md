# OmniCourse: Software Development Plan

Version 2.0 (draft)

## Revision history

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 18/10/2026 | 1.0 | Initial version submitted for PA1 | Lê Hữu Hoà |
| 25/10/2026 | 2.0 draft | Estimates and risk register completed; ownership, scope and process updated to the Work Breakdown and ADRs 0001–0003; TA feedback pending | Phan Bình Nguyên Lâm |

### Changes from version 1.0

- **§4.1 Project estimates and §4.3.2 risk register are filled in.** They were left empty in v1.0, as PA1 required.
- **Scope of the language model** ([ADR 0003](../analysis-and-design/adr/0003-language-model-scope.md)). A model is used only by F6's goal box and by F8. The F2 transcript import is a deterministic parser, F12 curriculum data is entered by people, and F6 plans are built by a deterministic planner. Objective 3 and the Sprint 4 and 5 content are restated to match.
- **Budget.** The zero-budget constraint becomes a small, capped budget for the model API. Free models log or train on prompts, which the privacy NFR forbids (ADR 0003).
- **Ownership.** Each member owns whole features end to end for the whole project (§3.2), instead of rotating roles per sprint. The test plan moves to Thắng, as the week 2 report assigned it; Dũng keeps the test cases, regression and test reports.
- **Schedule and builds.** The schedule names each key task's owner and handoff date from the Work Breakdown (§4.2.3). Authentication moves into Sprint 2, the AI gateway into Sprint 3, curriculum administration into Sprint 4 and what-if scenarios into Sprint 5. B1 gains onboarding and account export and deletion (§4.2.2).
- **Process.** Every task also has a GitHub issue, and the Discord states are named as in the Sprint tab (Bucket, Doing, Done). CI now enforces signed commits, Conventional Commits and a changeset in every PR, and the Project Lead's admin override is defined (§4.3.3). Weekly reports are stored one file per week in `/docs/management/weekly-reports`.
- **TA feedback on v1.0:** _pending_. It is applied here once received.

## 1. Introduction

This Software Development Plan describes how the OmniCourse team of five students organises, schedules and controls the development of the product in the course project. The project runs for twelve weeks, from 5 October to 13 December 2026, as five two-week sprints inside three RUP phases. The document defines:

- the purpose and scope of the project;
- the team organisation and roles;
- the effort estimates;
- the phase and iteration plan, the planned releases, the schedule and the resourcing;
- reporting, risk management and configuration management.

## 2. Project overview

### 2.1 Project purpose, scope and objectives

OmniCourse is a public web application that gives an HCMUS student one page for everything school-related:

- degree audit;
- curriculum explorer;
- plan to graduation;
- an AI-assisted planner and advisor;
- the exact links and steps for school tasks the application does not perform itself.

The first release covers the Advanced Program in Computer Science (APCS). The model is program-agnostic, so other HCMUS programs, and later other Vietnamese universities, are added as configuration.

Objectives:

1. A deployed, working web application that covers the APCS curriculum.
2. A deterministic rule engine that enforces prerequisites, offering terms, requirement coverage and the program's credit caps, so that no academic rule is decided by a language model.
3. A plan generator that turns a planning goal, given in a form or in the student's own words, into a plan built by a deterministic planner over that engine, and explains every placement. A model only turns the student's words into the form's fields (ADR 0003).
4. A curriculum data model that can be reused for another program or another school without changing the engine.

Out of scope for this course:

- native mobile applications;
- automating the school registration portal;
- storing portal credentials;
- reading transcripts or curriculum documents with a language model;
- the optional modules (tuition, conduct score, paperwork, community).

### 2.2 Assumptions and constraints

- **Fixed schedule:** five sprints of two weeks, 5/10/2026 to 13/12/2026, aligned with the course plan agreed in PA0. No extension is possible.
- **Team:** five students, with no member added or removed during the project.
- **Budget:** free tiers for hosting and CI. The model API is paid, for privacy reasons (ADR 0003), and capped (§4.1 Budget).
- **Effort:** at least 10 hours per member per week, about 50 hours per week for the team.
- **Capacity:** all five members are full-time students, so lecture and examination weeks reduce it.
- **Process:** fixed by the course: three RUP phases, five Scrum sprints, and the tools approved in PA0 (Moodle, Discord, GitHub).
- **No official API** exists for the HCMUS curriculum or the student record. Curriculum data is entered and verified by the team, and the transcript is a file the student uploads.
- **Regulations:** the academic rules follow Thông tư 08/2021/TT-BGDĐT and the published HCMUS credit caps (14 to 25 credits in a main term, 12 in summer). Personal data follows Luật 91/2025/QH15.
- **Portal:** the application never stores a portal password and never automates a registration on the student's behalf.

### 2.3 Project deliverables

Documents are stored in the GitHub repository under `/docs` and submitted in `/pa`, as PA0 requires.

| Artifact | Target date | Assignment |
| --- | --- | --- |
| Project plan v1.0 | 18/10/2026 | PA1 |
| Vision document v1.0 | 18/10/2026 | PA1 |
| UI sketches of the main screens (3 to 6) | 18/10/2026 | PA1 |
| Weekly reports, Sprint 1 (2 reports) | 18/10/2026 | PA1 |
| Project plan v2.0 with TA feedback applied | 1/11/2026 | PA2 |
| Use-case model and use-case specifications | 1/11/2026 | PA2 |
| Vision document v2.0 | 1/11/2026 | PA2 |
| Software architecture document, initial | 1/11/2026 | PA2 |
| Detailed design: class and sequence models | 15/11/2026 | PA3 |
| Test plan and test cases | 15/11/2026 | PA3 |
| Build B1 deployed on staging | 15/11/2026 | PA3 |
| Build B2, working software | 29/11/2026 | PA4 |
| Build B3 release candidate and test report | 13/12/2026 | PA5 |

## 3. Project organization

### 3.1 Organizational structure

The team has a flat structure of five members:

- **Project Lead.** Coordinates the plan, the schedule and the sharing of work, and is the single contact with the instructor and the TAs, who review and grade each assignment and may request changes to the scope.
- **Frontend Lead and Backend Lead.** Each owns one workstream and reviews the pull requests of their side.
- **Two members with testing duties**, on top of their development work.

The stack, the data model and the scope of each sprint are decided together in the weekly meeting, and the Project Lead breaks a tie.

### 3.2 Roles and responsibilities

All five members write code, so every member is a Developer. Each member owns a slice of the product end to end (use case, design, backend module, frontend pages, tests and the sprint demo) and keeps it for the whole project, so no feature changes hands mid-build. Every code folder, database table and document has exactly one owner, and modules call each other only through agreed contracts (Work Breakdown, ownership rules).

| Person | Role | Features | Also owns |
| --- | --- | --- | --- |
| Phan Bình Nguyên Lâm | Project Lead, Developer | F1 account and onboarding, F2 transcript import, F6 plan generator | The plan, schedule and weekly reports; the AI gateway; CI, staging deploy, backups and build tags; privacy and security |
| Võ Nguyễn Minh Triết | Backend Lead, Developer | F3 degree audit, F4 curriculum explorer | Database schema, the rule engine, the software architecture document, migration review |
| Lê Hữu Hoà | Frontend Lead, Developer | F5 planner, F7 what-if scenarios | App shell, i18n, Vision v2, the use-case model, the UI design document |
| Nguyễn Anh Dũng | Developer, Tester | F8 advisor chat, F9 export and sharing, F10 notifications, F11 guides | Test cases, regression on every build, test reports |
| Nguyễn Hữu Quốc Thắng | Developer, Tester | F12 curriculum administration, APCS curriculum data | Test plan, automated test suite, coverage gate, acceptance check of each build |

## 4. Management process

### 4.1 Project estimates

**Method.** Three-point estimates by expert judgement, in hours, for the work remaining from Sprint 2 to Sprint 5 (19/10 to 13/12, eight weeks). For each item:

- **O** is optimistic, **M** most likely and **P** pessimistic;
- the expected effort is **E = (O + 4M + P) / 6** (PERT);
- the uncertainty of an item is (P − O) / 6.

The Project Lead made these first estimates from the Work Breakdown. Each owner re-estimates their own rows at the weekly meeting of 27/10, and the table is updated at the end of each sprint against the hours actually spent.

**Capacity.** Each member gives at least 10 hours a week, so 80 hours each over the eight remaining weeks, and 400 hours for the team.

| Member | Expected effort (h) | Capacity (h) | Load |
| --- | ---: | ---: | ---: |
| Lâm | 139 | 80 | 174% |
| Triết | 94 | 80 | 118% |
| Hoà | 94 | 80 | 118% |
| Thắng | 79 | 80 | 99% |
| Dũng | 74 | 80 | 93% |
| **Team** | **480** | **400** | **120%** |

**Reading the totals:**
- The plan needs about 20% more than the stated minimum effort. The project depends on members working above 10 hours in the construction sprints, which is risk R5.
- **Lâm is the overloaded member.** Two mitigations are planned (risk R4):
  - the auth module, the AI gateway and account export and deletion are done in Sprint 2, ahead of their handoff dates;
  - F6's planner moves to Dũng if Sprint 4 slips.
- Triết and Hoà sit on the critical path: the schema, the rule engine and the `plans` API are what other members wait on. Their reserve comes from their testing and documentation items, which can move later.

#### Lâm

| Work item | O | M | P | E |
| --- | ---: | ---: | ---: | ---: |
| F1 sign-up, sign-in, sessions | 8 | 12 | 20 | 13 |
| F1 onboarding: program, cohort, default planning goal | 4 | 6 | 10 | 6 |
| F1 sign-in with Google | 3 | 5 | 10 | 6 |
| Privacy: consent, export and delete a whole account | 5 | 8 | 12 | 8 |
| AI gateway for the goal box and the advisor | 8 | 12 | 20 | 13 |
| F2 transcript parser, manual entry, review screen | 14 | 20 | 34 | 21 |
| F6 deterministic planner and goal box | 20 | 30 | 50 | 32 |
| CI, staging deploy, nightly backup, build tags | 6 | 10 | 18 | 11 |
| Security pass | 4 | 6 | 10 | 6 |
| Use cases UC-01, UC-02, UC-07 and their sequence diagrams | 4 | 6 | 9 | 6 |
| Project management: SDP v2, weekly reports, final report, submissions | 12 | 16 | 24 | 17 |
| **Total** | | | | **139** |

#### Triết

| Work item | O | M | P | E |
| --- | ---: | ---: | ---: | ---: |
| ERD, curriculum schema and migrations | 8 | 12 | 18 | 12 |
| Software Architecture Document, initial and final | 6 | 10 | 14 | 10 |
| Rule engine, at least 80% statement coverage | 18 | 26 | 40 | 27 |
| F3 degree audit: API and dashboard | 10 | 14 | 22 | 15 |
| F4 curriculum explorer and prerequisite graph | 8 | 12 | 20 | 13 |
| Planner validation endpoint, under 300 ms | 4 | 6 | 10 | 6 |
| Rule engine functions for the F6 planner | 3 | 5 | 8 | 5 |
| Use cases UC-03, UC-04, diagrams, migration review | 4 | 6 | 10 | 6 |
| **Total** | | | | **94** |

#### Hoà

| Work item | O | M | P | E |
| --- | ---: | ---: | ---: | ---: |
| Vision v2 and requirements baseline | 4 | 6 | 10 | 6 |
| Use-case model; use cases UC-05, UC-06 | 4 | 6 | 9 | 6 |
| UI sketches finished; UI design document | 5 | 8 | 12 | 8 |
| App shell, design tokens, i18n, responsive layout | 10 | 14 | 22 | 15 |
| Sign-in and sign-up screens | 3 | 5 | 8 | 5 |
| `plans` module and its API | 6 | 10 | 16 | 10 |
| F5 planner: drag, live validation, compare | 16 | 24 | 36 | 25 |
| F7 what-if scenarios | 8 | 12 | 20 | 13 |
| Accessibility audit and UI polish | 4 | 6 | 10 | 6 |
| **Total** | | | | **94** |

#### Dũng

| Work item | O | M | P | E |
| --- | ---: | ---: | ---: | ---: |
| Use cases UC-08, UC-09, UC-10 and diagrams | 4 | 6 | 9 | 6 |
| F11 guides | 6 | 10 | 16 | 10 |
| F10 notifications | 6 | 10 | 16 | 10 |
| F9 plan export and sharing | 6 | 10 | 16 | 10 |
| F8 advisor chat with cited clauses | 14 | 20 | 32 | 21 |
| Test cases, regression on B0–B3, test reports | 12 | 16 | 24 | 17 |
| **Total** | | | | **74** |

#### Thắng

| Work item | O | M | P | E |
| --- | ---: | ---: | ---: | ---: |
| Test plan, Elaboration and Construction | 5 | 8 | 12 | 8 |
| APCS curriculum seed data, verified | 10 | 14 | 22 | 15 |
| Browser end-to-end harness and automated suite | 8 | 12 | 18 | 12 |
| CI coverage gate on the rule engine | 1 | 2 | 4 | 2 |
| F12 curriculum administration API | 8 | 12 | 20 | 13 |
| F12 curriculum administration UI | 8 | 12 | 20 | 13 |
| Second program or cohort entered through the curriculum administration UI | 3 | 5 | 8 | 5 |
| Performance tests for the NFRs | 4 | 6 | 10 | 6 |
| Acceptance checks of B1–B3 | 3 | 5 | 8 | 5 |
| **Total** | | | | **79** |

**Budget.** The model API is the only paid item. The monthly spending limit on the OpenRouter key is the hard cap, and the per-user daily call limit (20 by default) stops one user from spending it. The limit is set by the Project Lead in the OpenRouter dashboard and reported in the weekly report when it changes.

### 4.2 Project plan

#### 4.2.1 Phase and iteration plan

| Phase | Iteration | Start | End | Overall objectives |
| --- | --- | --- | --- | --- |
| Inception | Sprint 1 | 5/10/2026 | 18/10/2026 | Project proposal, group and tools set up, first versions of the project plan and the vision document, UI sketches. |
| Elaboration | Sprint 2 | 19/10/2026 | 1/11/2026 | Requirements baseline, use cases, initial architecture and database schema, authentication, running skeleton (build B0). |
| Elaboration | Sprint 3 | 2/11/2026 | 15/11/2026 | Detailed design, test plan and test cases, APCS curriculum data, degree audit and curriculum explorer, AI gateway (build B1). |
| Construction | Sprint 4 | 16/11/2026 | 29/11/2026 | Planner with live rule validation, transcript import, notifications, curriculum administration (build B2). |
| Construction | Sprint 5 | 30/11/2026 | 13/12/2026 | Plan generator and advisor chat, what-if scenarios, guides, performance and security pass, regression, release candidate (build B3). |

Milestones:

| ID | Milestone | Date |
| --- | --- | --- |
| M1 | Documents of PA1 approved | 18/10 |
| M2 | Requirements baseline | 1/11 |
| M3 | Architecture, design and test plan approved | 15/11 |
| M4 | Core planning features working | 29/11 |
| M5 | Release candidate and final report | 13/12 |

#### 4.2.2 Releases

Four builds are produced for testing. Each build is deployed to the staging environment from the `main` branch through the deploy workflow and tagged `B0` to `B3`. On every build the testers run the regression suite plus the acceptance criteria of the sprint. Only build B3 is a release.

| Build | Date | Type | Content |
| --- | --- | --- | --- |
| B0 | 1/11/2026, end of Sprint 2 | Demo, walking skeleton | Deployment pipeline, database schema, sign-up and sign-in, one working screen. |
| B1 | 15/11/2026, end of Sprint 3 | Demo, beta | Degree audit and curriculum explorer on the APCS curriculum; onboarding; account export and deletion. |
| B2 | 29/11/2026, end of Sprint 4 | Beta | Planner with live rule validation, transcript import, notifications, curriculum administration. |
| B3 | 13/12/2026, end of Sprint 5 | Release candidate | Plan generator with goal box, advisor chat, what-if scenarios, guides, full regression. |

#### 4.2.3 Project schedule

Tasks are kept in the Discord **Sprint** tab, each linked to a GitHub issue (§4.3.1). This table lists each sprint's key tasks, is copied from that list at the end of each sprint so progress can be checked against the dates, and may change after the review of PA2. The per-member checklist for each sprint is in the Work Breakdown.

| Sprint | Dates | Key tasks | Owners |
| --- | --- | --- | --- |
| Sprint 1 | 5/10 – 18/10 | Project proposal and five user interviews; group registration; tools set-up; stack decision; project plan; vision document; UI sketches; two weekly reports. | All, coordinated by Lâm |
| Sprint 2 | 19/10 – 1/11 | Curriculum schema (Triết, 28/10); authentication handoff (Lâm, 29/10); use-case specifications (all, 28/10) and use-case model (Hoà); Vision v2 (Hoà); initial architecture and the `RulesService` interface (Triết, 1/11); app shell and sign-in screen (Hoà); test plan (Thắng); B0 test cases (Dũng); staging deploy and B0 (Lâm). | All |
| Sprint 3 | 2/11 – 15/11 | Rule engine and degree audit (Triết); curriculum explorer (Triết); APCS seed data (Thắng, 8/11); `plans` API (Hoà, 8/11); AI gateway (Lâm, 8/11); onboarding, account export and deletion (Lâm); guides (Dũng); detailed design; build B1. | All |
| Sprint 4 | 16/11 – 29/11 | Planner with live validation (Hoà, Triết's endpoint 16/11); transcript import and student record (Lâm, 22/11); notifications, export and sharing (Dũng); curriculum administration UI (Thắng); nightly backup (Lâm); build B2; regression. | All |
| Sprint 5 | 30/11 – 13/12 | Plan generator (Lâm, rule-engine functions from Triết 29/11); advisor chat (Dũng); what-if scenarios (Hoà); second program through the curriculum administration UI (Thắng); performance and security pass; full regression; release candidate B3; final report. | All |

#### 4.2.4 Project resourcing

Five members, each committing at least 10 hours per week: about 50 hours per week, and roughly 600 hours over the twelve weeks. Every task has an owner and a reviewer, so no task depends on a single person.

- **Source control and review:** GitHub, one repository, protected `main` branch.
- **Communication and task tracking:** one Discord server, one channel per concern, for the conversation and task state; GitHub issues for each task's specification.
- **Development:** NestJS and Vue run locally, with PostgreSQL 18.6 in a container and seeded curriculum data.
- **Continuous integration and hosting:** GitHub Actions, and a free-tier cloud host for staging.
- **Model API:** OpenRouter, behind the AI gateway, with a monthly spending limit (§4.1 Budget).
- **Documents:** Markdown in `/docs`, exported to `.docx` for submission.

### 4.3 Project monitoring and control

#### 4.3.1 Reporting

Status is reported in three ways:

- **Weekly report** every Sunday, on the course template, stored in `/docs/management/weekly-reports`. It lists what was planned, what was done, the percentage of each task, the issues, and the goals of the following week.
- **Weekly meeting** of about thirty minutes at the start of each week. The report is closed, the sprint's priorities are confirmed, and any blocker is assigned to a person. Decisions are recorded in the channel right after the meeting. A decision that outlives one pull request is also recorded as an ADR in `/docs/analysis-and-design/adr`.
- **Continuous status in Discord.** Each task's owner moves it through Bucket, Doing and Done on the day it changes, and adds the pull request number once the work is open for review. The state of the sprint can be read without asking anyone.

A handoff from the Work Breakdown that slips is reported in the weekly report of the week it slips.

#### 4.3.2 Risk management

Probability and impact are scored from 1 (low) to 5 (high), and exposure = probability × impact. Priority: **High** for 12 and above, **Medium** for 6 to 11, **Low** for 5 and below. The register is reviewed at each weekly meeting, and each risk's owner reports changes in the weekly report.

| ID | Risk | P | I | Exposure | Priority | Owner | Mitigation or contingency |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| R1 | The curriculum schema is late (due 28/10). Every module's tables reference it, so every member waits. | 3 | 5 | 15 | High | Triết | Schema first, before the architecture document. Others build against interfaces and fakes until it lands. A slip of one day goes in Discord the same day; Lâm reassigns review help. |
| R2 | No staging host is chosen, or the free tier sleeps, limits the database or disappears, so B0 cannot be deployed on 1/11. | 4 | 4 | 16 | High | Lâm | Choose the host by 28/10. Pick one with a managed PostgreSQL 18 and keep the deploy workflow host-agnostic (build artifact, migrations, start). Keep a second host's set-up written down as the fallback. |
| R3 | Errors in the APCS curriculum data give students a wrong graduation status. | 3 | 5 | 15 | High | Thắng | Triết checks the seed data line by line against the official PDF (8/11). Unit tests per requirement group with known transcripts. Data is versioned per cohort, so a fix does not break old plans. |
| R4 | The Project Lead is overloaded: management plus three features, at 174% of capacity (§4.1). | 4 | 4 | 16 | High | Lâm | Platform work (auth, AI gateway, account export and deletion) done in Sprint 2. If Sprint 4 slips, F6's planner moves to Dũng, who already uses the AI gateway. Two-factor authentication, a Sprint 5 stretch item in the Work Breakdown, is dropped first. |
| R5 | Lecture and examination weeks cut capacity, and the plan already needs 120% of the minimum hours (§4.1). | 4 | 3 | 12 | High | Lâm | Front-load critical-path work into Sprints 2 and 3. Keep Sprint 5 for the AI features, polish and regression. Cut by feature priority: Low features (F9, F10) are reduced first, as the Vision allows. |
| R6 | The deterministic planner cannot find a valid plan within 30 seconds on real curriculum data. | 3 | 3 | 9 | Medium | Lâm | Planner ADR and a prototype on the APCS seed data in Sprint 4, before the UI. Bound the search, and fall back to a greedy plan that the rule engine still validates. |
| R7 | The portal transcript PDF has no text layer, or its layout changes, so the F2 parser cannot read it. | 3 | 3 | 9 | Medium | Lâm | Check one real transcript locally before Sprint 4 (ADR 0003). Manual entry works in every case. Parser tests use synthetic fixtures of the known layout. |
| R8 | Personal data leaks: a real transcript, student ID or name reaches an AI tool, a log, a fixture or the public repository. | 2 | 5 | 10 | Medium | Lâm | AGENTS.md hard rule 3; synthetic data in tests; uploaded transcript files deleted after reading (proposed in UC-02); no prompt content logged; review checks every PR. A leak is reported under Luật 91/2025/QH15. |
| R9 | A contract between slices changes late (the `plans` API, `RulesService`, the student record), breaking the receiver. | 3 | 3 | 9 | Medium | Triết | Contracts are merged PRs (OpenAPI or exported types) before anyone builds on them. A breaking change needs the receiver's approval. Backend e2e tests run in CI. |
| R10 | Pull requests wait for review, since one approval is required and a new push dismisses it. | 3 | 2 | 6 | Medium | Lâm | Review within one working day. The Project Lead may merge with the admin override for urgent fixes or tie-breaks, and says why in the PR. |
| R11 | The model provider is down, too slow or its budget is spent. | 2 | 3 | 6 | Medium | Lâm | Only the goal box and the advisor use a model. Both fail to a clear "AI unavailable" state while manual planning keeps working (Robustness NFR). Per-user daily cap and a monthly spending limit. |
| R12 | TA feedback on PA1 or PA2 changes the scope. | 3 | 3 | 9 | Medium | Lâm | Feature priorities are already set (Vision §5). A scope change is answered by dropping Low features first and is recorded in this plan's revision history. |
| R13 | A member cannot work for a period (illness, lost access to a tool). | 2 | 4 | 8 | Medium | Lâm | Every contract has a named reviewer who knows it and can take it over. Access problems are fixed in the week they appear. |
| R14 | AI-generated code is merged that its author cannot explain. | 3 | 2 | 6 | Medium | Triết | AI policy (CONTRIBUTING.md §5): every PR's "Why this design" section defends each choice with evidence, and reviewers send back a PR its author cannot explain. |

#### 4.3.3 Configuration management

Source code and documents live in one GitHub repository owned by the team, in the folder layout PA0 requires:

| Folder | Holds |
| --- | --- |
| `/src` | The code |
| `/docs/management` | Plans and reports |
| `/docs/requirements` | Vision document and use cases |
| `/docs/analysis-and-design` | Architecture, models, UI design and ADRs |
| `/docs/test` | Test plan, test cases and test reports |
| `/pa` | Submissions |

Documents are written in Markdown, versioned with the code, and exported to `.docx` only for submission.

- **No one pushes to `main`.** Every change arrives as a pull request from a branch named `<type>/<short-name>`.
- **CI enforces the rules.** A pull request merges only when CI passes and at least one other member has approved it. The required checks are:
  - backend and frontend typecheck, tests and build, and backend e2e tests against PostgreSQL;
  - every commit signed;
  - commit messages and the PR title in Conventional Commits;
  - a changeset in every PR.
- **The Project Lead may use the admin override** to merge without an approval, for urgent fixes or tie-breaks, and says why in the PR. CI and signed commits still apply.
- **The author merges and deploys** after approval (squash merge, then the Deploy workflow).
- **Review duty follows the workstream:** the Frontend Lead reviews frontend work, the Backend Lead backend work, and the Project Lead the data model and the rules.
- **Versions.** Changesets accumulate in a release PR that bumps the version and writes the changelog. It is merged at the end of each sprint, and the build is tagged `B0` to `B3`, so the version that was tested is always identifiable.
- **Decisions** that outlive one pull request (a new library, a schema change, a module boundary) get an ADR.

The technology stack, all at the current stable release and pinned exactly ([ADR 0001](../analysis-and-design/adr/0001-technology-stack.md)):

| Layer | Technology | Version |
| --- | --- | --- |
| Database | PostgreSQL | 18.6 |
| Backend | NestJS, with Nest CLI and Swagger | 12.1.3, 12.0.8, 12.0.2 |
| Frontend | Vue | 3.5.44 |
| API | REST, described by OpenAPI | 3.2.0 |
| Tests | Vitest | 5.0.4 |
| Build | Vite | 8.3.4 |
| Runtime | Node.js, npm | 22.22.1, 11.21.1 |
