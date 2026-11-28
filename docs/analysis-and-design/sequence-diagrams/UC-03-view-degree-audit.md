# Sequence diagrams: UC-03 View degree audit

- Use case: UC-03 (Use-Case Specification v1.0, [`report/assignments/PA2/uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex)), feature F3
- Drawn from the code on `main` (15 November 2026): `src/frontend/src/audit/` (`AuditView.vue`, `AuditGate.vue`, `present.ts`, `api.ts`) and `src/frontend/src/dashboard/` (`DashboardView.vue`), `src/backend/src/audit/`, `src/backend/src/rules/` ([ADR 0013](../adr/0013-rule-engine-and-degree-audit.md))
- Built: the dashboard and the audit page, both drawn from one `GET /api/users/me/audit`. Not built: the estimated graduation term, the past-term picker (A2) on screen and the "Needs attention" links to a place to act; see [the differences list](../design-differences.md). For A2 the API takes `asOfYear` and `asOfNumber`: the controller passes that term to `auditFor`, and `degreeAudit` reads only the transcript rows up to it.

The degree audit is worked out afresh on every call and is never stored. The dashboard (`/dashboard`) and the audit page (`/audit`) both call `useAudit()` and wrap what they show in `AuditGate`, so the flow is the same for both.

## Basic flow: the audit through the rule engine

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as DashboardView or AuditView
    participant Auth as useAuth store
    participant Api as audit/api.ts
    participant Ctrl as AuditController
    participant Rules as RulesService
    participant Onb as OnboardingService
    participant Reader as CurriculumRulesReader
    participant Tr as TranscriptService
    participant Engine as degreeAudit (rules/audit.ts)
    participant DB as PostgreSQL

    Student->>View: opens /dashboard or /audit
    View->>Auth: useAudit(): authed(fetchAudit)
    Auth->>Api: fetchAudit(token)
    Api->>Ctrl: GET /api/users/me/audit, Bearer token
    Note over Api,Ctrl: ThrottlerGuard, then AuthGuard set request.user
    Ctrl->>Rules: auditFor(user.id)
    Rules->>Onb: answersFor(user.id)
    Onb->>DB: SELECT onboarding_answers WHERE user_id = user.id
    Onb-->>Rules: OnboardingDto: finished, program, cohort
    par the curriculum
        Rules->>Reader: rulesFor(program, cohort)
        Reader->>DB: SELECT curriculums with program, requirement groups,<br/>course links and courses
        Reader->>DB: SELECT combined_minimums with their groups,<br/>and requirement_group_overflows
        Reader-->>Rules: CurriculumRules
    and the transcript
        Rules->>Tr: rowsFor(user.id)
        Tr->>DB: SELECT transcript_rows WHERE user_id = user.id
        Tr-->>Rules: TranscriptEntry[]
    end
    Rules->>Engine: degreeAudit(rules, entries)
    Engine->>Engine: courseRecords: the official attempt of each course
    Engine->>Engine: placements: the one group each course counts in
    Engine->>Engine: groupCoverage, combinedMinimumCoverage
    Engine->>Engine: credit summary, GPA summary, term summaries with checkTermLoad
    Engine->>Engine: graduationStatus, unmatched courses, warnings
    Engine-->>Rules: DegreeAudit
    Rules-->>Ctrl: { status: ok, audit }
    Ctrl-->>Api: 200 DegreeAuditDto
    Api-->>View: { status: ready, audit }
    View->>View: AuditGate hands the audit to the page,<br/>present.ts orders and words it
    View-->>Student: graduation status, credits, GPA, requirement groups,<br/>conditions not met, unmatched courses, warnings
```

The pages decide nothing: `present.ts` only orders, colours and formats what the API returned (AGENTS.md hard rule 1). `degreeAudit` is one pure function; the self-calls above are the exported functions it composes (`rules/attempts.ts`, `coverage.ts`, `credit-caps.ts`, `graduation.ts`, `gpa.ts`, `grades.ts`).

## Alternate flows

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Gate as AuditGate
    participant Api as audit/api.ts
    participant Ctrl as AuditController
    participant Rules as RulesService

    Api->>Ctrl: GET /api/users/me/audit
    Ctrl->>Rules: auditFor(user.id)
    alt onboarding not finished, or no program and cohort
        Rules-->>Ctrl: { status: onboarding_required }
        Ctrl-->>Api: 409 { code: onboarding_required }
        Api-->>Gate: { status: onboarding_required }, not an error
        Gate-->>Student: "finish onboarding first", with a link to /onboarding
    else no curriculum for the program and cohort
        Rules-->>Ctrl: { status: curriculum_not_found, programCode, cohortYear }
        Ctrl-->>Api: 409 { code: curriculum_not_found }
        Api-->>Gate: { status: curriculum_not_found }
        Gate-->>Student: "no curriculum for your program and cohort", with a link to /settings
    else the transcript is empty (A1)
        Rules-->>Ctrl: { status: ok, audit } with no term
        Ctrl-->>Api: 200 DegreeAuditDto
        Api-->>Gate: { status: ready, audit }
        Gate-->>Student: a note "no transcript yet" with a link to /transcript,<br/>then the audit with nothing passed
    else 401, the session is over
        Ctrl-->>Api: 401 from AuthGuard
        Api-->>Gate: HttpError 401, the gate shows nothing
        Note over Gate: useAuth cleared the token, App.vue opens /sign-in
    else any other failure (429, 5xx, no answer)
        Api-->>Gate: the error
        Gate-->>Student: "could not load", with a retry button that calls fetchAudit again
    end
```

- **Onboarding not finished:** in the app as built this branch is rarely reached. The router guard (`router.ts`, `onboardingFirst`) sends a signed-in student whose onboarding is unfinished to `/onboarding` before `/dashboard` or `/audit` opens, so `AuditGate`'s notice shows only when the guard could not load the onboarding answers and let the page open. Test case USER-01k expects the dashboard notice; the redirect is the difference tracked in issue #115.
- **A3, course outside the curriculum:** not a separate flow. `degreeAudit` returns such courses in `unmatchedCourses` and adds a `not_in_curriculum` warning; the audit page lists them.
- **A4, graduation status reached:** `graduation.status` is `done` when every condition the data can check is met; the conditions the data cannot check are returned in `graduation.notChecked` and shown as still needing the school.
