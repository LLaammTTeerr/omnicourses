# Sequence diagrams: UC-04 Explore curriculum

- Use case: UC-04 (Use-Case Specification v1.0, [`report/assignments/PA2/uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex)), feature F4
- Drawn from the code on `main` (15 November 2026): `src/frontend/src/explorer/` (`ExplorerView.vue`, `CourseDrawer.vue`), `src/frontend/src/curriculum/` (`api.ts`, `present.ts`), `src/frontend/src/transcript/codes.ts`, `src/backend/src/curriculum/` ([ADR 0005](../adr/0005-curriculum-cohort-and-course-catalog.md))
- Built: the list by requirement group with course readiness states (`passed`, `in_progress`, `available` / ready, `locked`), search without diacritics, and the course drawer with recorded prerequisites, readiness states and unlocked courses. Not built: the prerequisite graph (A1). See [the differences list](../design-differences.md#uc-04-explore-curriculum-f4).

## Basic flow: read the curriculum

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as ExplorerView
    participant Onb as useOnboarding store
    participant Auth as useAuth store
    participant Api as curriculum/api.ts
    participant Ctrl as CurriculumController
    participant Svc as CurriculumService
    participant CR as CurriculumRulesReader
    participant DB as PostgreSQL

    Student->>View: opens /explorer
    View->>Onb: answers (loaded by the router guard)
    Onb-->>View: the student's program and cohort
    View->>View: selection = what the student picked, else their own<br/>program and cohort, else the first offered one
    Note over View: The selection does not wait for GET /api/programs. Without answers,<br/>programChoices lists the offered programs from OFFERED_COHORTS
    par the program and cohort menus
        View->>Auth: authed(fetchPrograms)
        Auth->>Api: fetchPrograms(token)
        Api->>Ctrl: GET /api/programs
        Ctrl->>Svc: listPrograms()
        Svc->>DB: SELECT programs with their curriculums
        Svc-->>Ctrl: ProgramDto[] with cohortYears
        Ctrl-->>View: 200 ProgramListDto
        View->>View: fill the program and cohort menus, nothing else
    and the curriculum of the selection
        View->>Auth: authed(fetchCurriculum)
        Auth->>Api: fetchCurriculum(token, program, cohort)
        Api->>Ctrl: GET /api/programs/{program}/curricula/{cohort}
        Ctrl->>Svc: getCurriculum(program, cohort)
        Svc->>DB: SELECT curriculums with program, requirement groups,<br/>course links and courses
        Svc->>CR: courseRules(curriculum.id)
        CR->>DB: SELECT course_prerequisite_lists with prerequisites,<br/>and course_offering_terms
        CR-->>Svc: CourseRules
        Svc-->>Ctrl: CurriculumDto: groups, courses, each course's<br/>prerequisites and offeringTerms, or null when not recorded
        Ctrl-->>View: 200 CurriculumDto
    and the transcript marks
        View->>Auth: useTranscriptCodes: authed(fetchTranscript)
        Auth-->>View: the course codes of the saved transcript
    end
    View->>View: orderGroups, groupColour, one section per requirement group
    View-->>Student: every course by group, with a neutral<br/>"in your transcript" mark on the saved ones
```

The three reads start together when the view is set up (`ExplorerView.vue`); none waits for another. `GET /api/programs` only fills the program and cohort menus. The curriculum is read again each time the selection changes, for example when the student picks another program or cohort.

The transcript read is `GET /api/users/me/transcript`, drawn in [UC-02](UC-02-import-transcript.md). It only adds a mark: whether a course is passed is the rule engine's call, and the explorer does not ask it. `GET /api/programs` and the curriculum read need a signed-in user like every other route; they are not public.

## Search and open a course (steps 4–8)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as ExplorerView
    participant Present as curriculum/present.ts
    participant Drawer as CourseDrawer
    participant Api as curriculum/api.ts
    participant Ctrl as CurriculumController
    participant Svc as CurriculumService
    participant DB as PostgreSQL

    Student->>View: types "cau truc du lieu"
    View->>Present: matches(query, code, nameVi, nameEn) per course
    Present-->>View: true when the folded text contains the folded query
    View-->>Student: the list narrowed, no request sent
    opt nothing matches (A2)
        View-->>Student: "no course matches", the search box stays
    end
    Student->>View: opens a course
    View->>Drawer: course, group, inTranscript
    Drawer->>Api: authed(fetchCourse(token, code))
    Api->>Ctrl: GET /api/courses/{code}
    Ctrl->>Svc: getCourse(code)
    Svc->>DB: SELECT courses WHERE code = code
    Svc->>DB: SELECT requirement_group_courses with group,<br/>curriculum and program WHERE course_code = code
    Svc-->>Ctrl: CourseDetailDto with memberships
    Ctrl-->>Drawer: 200 CourseDetailDto
    Drawer-->>Student: code, both names, credits, periods, the groups that list it,<br/>and a note that prerequisites and offering terms are not recorded yet
    Student->>Drawer: closes it
```

## Alternate flows

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as ExplorerView or CourseDrawer
    participant Api as curriculum/api.ts
    participant Ctrl as CurriculumController
    participant Svc as CurriculumService

    alt the cohort is not a 4-digit year
        Api->>Ctrl: GET /api/programs/APCS/curricula/abc
        Ctrl-->>Api: 404, the service is not called
        Api-->>View: HttpError 404
        View-->>Student: "no curriculum for this program and cohort"
    else no curriculum for the program and cohort
        Api->>Ctrl: GET /api/programs/{program}/curricula/{cohort}
        Ctrl->>Svc: getCurriculum(program, cohort)
        Svc-->>Ctrl: NotFoundException
        Ctrl-->>Api: 404
        View-->>Student: "no curriculum for this program and cohort"
    else unknown or malformed course code
        Api->>Ctrl: GET /api/courses/{code}
        Ctrl->>Svc: getCourse(code)
        Svc-->>Ctrl: NotFoundException
        Ctrl-->>Api: 404
        View-->>Student: the drawer keeps the course from the list and says<br/>its requirement groups could not be loaded
    else 401, the session is over
        Ctrl-->>Api: 401 from AuthGuard
        Note over View: useAuth cleared the token, App.vue opens /sign-in
    else any other failure
        Api-->>View: the error
        View-->>Student: "could not load", with a retry button
    end
```

- **Another program or cohort:** the student picks one of the offered ones from the two menus; `ExplorerView` calls `fetchCurriculum` again with the new pair (`useAsyncLoad` reloads when its key changes). Only the cohorts in `OFFERED_COHORTS` (`onboarding/api.ts`) are listed.
- **A3, offering terms unknown:** the API answers `offeringTerms: null` and `prerequisites: null` for a course with nothing recorded, and the drawer shows a fixed note instead of any value.
- **From the planner:** `/explorer?course=CODE` scrolls to that course and focuses it once the curriculum has loaded.
