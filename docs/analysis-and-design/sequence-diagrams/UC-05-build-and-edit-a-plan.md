# Sequence diagrams: UC-05 Build and edit a plan

- Use case: UC-05 (Use-Case Specification v1.0, [`report/assignments/PA2/uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex)), feature F5
- Drawn from the code on `main` (15 November 2026): `src/frontend/src/plans/` (`PlannerEntry.vue`, `PlanEditorView.vue`, `board.ts`, `drag.ts`, `api.ts`), `src/backend/src/plans/`, `src/backend/src/rules/` ([ADR 0014](../adr/0014-plan-model.md), [ADR 0012](../adr/0012-credit-caps-by-training-type.md))
- Built: opening a plan, the board with live issues from the rule engine, the drag preview, saving on every change with a retry on 429, undo, keyboard moves, several plans. Not built: the estimated graduation term and the fix suggestion with **Apply** (A2); a term that would break a rule does not refuse the drop. See [the differences list](../design-differences.md).

The editor never judges a placement itself. Every colour, load, cap and reason on the board comes from a report of the rule engine: `GET /api/plans/{id}/issues` for the saved board, `POST /api/plans/{id}/issues/drops` for a drag. `PlansController` reaches the engine through the `PlanIssuesProvider` interface, which `RulesService` implements.

## Open the planner and a plan (steps 1–2, A7, A8)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Entry as PlannerEntry
    participant Editor as PlanEditorView
    participant Api as plans/api.ts
    participant Ctrl as PlansController
    participant Plans as PlansService
    participant Rules as RulesService (PlanIssuesProvider)
    participant Engine as checkPlan (rules/plan-issues.ts)
    participant DB as PostgreSQL

    Student->>Entry: opens /plans
    Entry->>Api: fetchPlans(token)
    Api->>Ctrl: GET /api/plans
    Ctrl->>Plans: list(user.id)
    Plans->>DB: SELECT plans and plan_placements WHERE user_id = user.id
    Ctrl-->>Entry: 200 PlanListDto
    alt the student has a plan
        Entry->>Editor: /plans/{id} of the plan open last, else the first
    else no plan yet, program and cohort known (A8)
        Entry->>Api: createPlan(token, { name, programCode, cohortYear })
        Api->>Ctrl: POST /api/plans
        Ctrl->>Plans: create(user.id, dto)
        Plans->>DB: INSERT plans (curriculum of that program and cohort)
        Ctrl-->>Entry: 201 PlanDto
        Entry->>Editor: /plans/{id} of the new plan
    else no plan and no program
        Entry-->>Student: the plan list, which says to choose a program first
    end
    Editor->>Api: fetchPlan(token, id)
    Api->>Ctrl: GET /api/plans/{id}
    Ctrl->>Plans: get(user.id, id)
    Plans->>DB: SELECT plans WHERE id = id AND user_id = user.id
    Plans->>DB: SELECT plan_placements WHERE plan_id = id
    Plans-->>Ctrl: PlanDto with terms = toBoard(rows)
    Ctrl-->>Editor: 200 PlanDto
    Editor->>Editor: boardOf(terms, rowsFor(terms, current term, target graduation term))
    Editor->>Api: fetchPlanIssues(token, id)
    Api->>Ctrl: GET /api/plans/{id}/issues
    Ctrl->>Plans: get(user.id, id)
    Ctrl->>Rules: issuesFor(user.id, plan)
    par the four inputs of issuesForBoards
        Rules->>DB: CurriculumRulesReader.rulesFor(plan's program and cohort)
    and
        Rules->>DB: CourseRulesService.rulesFor(plan's curriculum)
    and
        Rules->>DB: TranscriptService.rowsFor(user.id)
    and
        Rules->>DB: CurriculumService.courseCredits(placed codes)
    end
    Rules->>Engine: checkPlan({ planId, rules, courseRules, transcript, terms, catalogCredits })
    Engine-->>Rules: PlanIssuesReport: terms with loads and caps, issues, coverage
    Rules-->>Ctrl: PlanIssuesReport
    Ctrl-->>Editor: 200 PlanIssuesDto
    Editor->>Editor: attachIssues(board, report)
    Editor-->>Student: one row per term with tiles, load and caps,<br/>the coverage strip and the Issues panel
```

Alongside, the editor reads the plan's curriculum (`fetchCurriculum`, [UC-04](UC-04-explore-curriculum.md)) for the course names and the tray of courses not placed yet, the degree audit (`fetchAudit`, [UC-03](UC-03-view-degree-audit.md)) for the terms already taken, and the transcript's course codes (`useTranscriptCodes`). The plan is checked against its own curriculum, not the onboarding one: a plan keeps the curriculum it was made against.

**A7, a saved plan that already breaks a rule:** it loads like any other; the report lists the violation and nothing is moved.

## Drag preview (steps 3–4, A1)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Editor as PlanEditorView
    participant Board as board.ts
    participant Api as plans/api.ts
    participant Ctrl as PlansController
    participant Plans as PlansService
    participant Rules as RulesService (PlanIssuesProvider)
    participant Engine as checkPlan (rules/plan-issues.ts)

    Student->>Editor: picks up a tile with the pointer, or lifts it with Space
    Editor->>Editor: previewAll(what): every row but the tile's own
    Editor->>Board: placementOf(board, what), removeTile(board, key), boardBody(without)
    Editor->>Api: previewPlanDrops(token, id, { terms, placement, targets }, signal)
    Api->>Ctrl: POST /api/plans/{id}/issues/drops
    Note over Ctrl: ValidationPipe checks PlanDropPreviewDto:<br/>at most 30 terms, 30 placements a term, 1 to 30 targets
    Ctrl->>Plans: dropBoards(user.id, id, terms, placement, targets)
    Plans->>Plans: get(user.id, id), 404 when not the student's
    Plans->>Plans: withPlacement(terms, placement, target) for each target
    Plans->>Plans: boardProblems on every board, checkBoard on the first
    Plans-->>Ctrl: { plan, boards }, nothing written
    Ctrl->>Rules: issuesForBoards(user.id, plan, boards)
    Note over Rules: the four inputs are read once for all the boards
    loop each board
        Rules->>Engine: checkPlan(input with this board)
        Engine-->>Rules: PlanIssuesReport
    end
    Rules-->>Ctrl: PlanIssuesReport[]
    Ctrl-->>Api: 200 PlanDropReportsDto: one { term, issues } per target
    Api-->>Editor: PlanDropReports
    loop each target row
        Editor->>Board: attachIssues(boardWith(board, what, term), report)
        Editor->>Board: dropVerdict(attached, key, term, issues before)
        Board-->>Editor: DropVerdict: the strongest kind and the reason
    end
    Editor-->>Student: each row toned by its verdict with the reason in words,<br/>and the load it would have against its caps
```

- One request per drag, not one per row: a per-row preview hit the limit of 120 requests a minute ([ADR 0015](../adr/0015-rule-engine-in-the-browser.md), proposed, would move this check into the browser).
- **A new drag, or the drag ends:** `previewAbort.abort()` cancels the request in flight (`AbortController`); its answer is dropped.
- **The preview fails** (429, 5xx, no answer): the rows show "could not check"; there is no timed retry. A failed row asks again, for that row alone, when the pointer comes over it or the keyboard target moves to it (`previewRow`).
- **400:** a target listed twice, a board with a course placed twice, a code not in the catalog or a slot for a group outside the plan's curriculum is refused as `PUT /plans/{id}/placements` would refuse it.
- **Keyboard (A1):** Space lifts the focused tile and asks for the same preview; the arrow keys choose the row; Enter or Space drops; Escape cancels.
- `POST /api/plans/{id}/issues` (`PlansController.previewIssues`, `PlansService.withBoard`) checks one whole board without saving it. The route is built and tested, and `plans/api.ts` has `previewPlanIssues` for it, but no view calls it since the batched route replaced it.

## Drop, save and re-check (steps 5–7, A3, A4, A5)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Editor as PlanEditorView
    participant Board as board.ts
    participant Api as plans/api.ts
    participant Ctrl as PlansController
    participant Plans as PlansService
    participant Cur as CurriculumService
    participant DB as PostgreSQL

    Student->>Editor: drops the tile on a term
    Editor->>Board: moveTile, addCourse or addSlot
    Editor->>Editor: change(next): remember the board for Undo, show it, save()
    loop until the saved board has the tiles on screen
        Editor->>Board: boardBody(board)
        Editor->>Api: savePlacements(token, id, terms)
        Api->>Ctrl: PUT /api/plans/{id}/placements { terms }
        Note over Ctrl: ValidationPipe checks PlanBoardDto
        Ctrl->>Plans: replacePlacements(user.id, id, terms)
        Plans->>DB: BEGIN
        Plans->>DB: SELECT curriculum_id FROM plans WHERE id = id AND user_id = user.id<br/>FOR NO KEY UPDATE
        Plans->>Plans: checkBoard: boardProblems(terms)
        Plans->>Cur: knownCourseCodes(codes), requirementGroupIds(curriculumId)
        Plans->>DB: DELETE plan_placements WHERE plan_id = id
        Plans->>DB: INSERT plan_placements from toRows(id, user.id, terms)
        Plans->>DB: UPDATE plans SET updated_at = now()
        Plans->>DB: COMMIT
        Plans-->>Ctrl: get(user.id, id)
        Ctrl-->>Api: 200 PlanDto
        Api-->>Editor: Plan
        Editor->>Editor: saved = the board that was sent
    end
    Editor->>Api: fetchPlanIssues(token, id)
    Api-->>Editor: 200 PlanIssuesDto, as in the first diagram
    Editor->>Board: attachIssues(saved, report)
    Editor-->>Student: "Saved", the meters, the coverage strip and the Issues panel updated
```

- The save loop sends the board on screen each time round, so changes made while a save is in flight go out in the next request, and only one request per plan is in flight.
- **A5, over the credit cap, or any other violation:** the drop lands and is saved. `PlansService` checks only the board's shape and references; the rule engine reports the violation in the next report ([ADR 0012](../adr/0012-credit-caps-by-training-type.md)). The dropped tile shakes once when its preview verdict was a violation.
- **A3, Undo** (the button or Ctrl+Z) and **A4, remove a course** (drag to the tray or the bin, or Delete) are changes like a drop: `change(board)` then the same save.

## Alternate flows of the save

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Editor as PlanEditorView
    participant Api as plans/api.ts
    participant API as REST API

    Editor->>Api: savePlacements(token, id, terms)
    Api->>API: PUT /api/plans/{id}/placements
    alt 429, too many requests
        API-->>Api: 429 from ThrottlerGuard
        Api-->>Editor: HttpError 429
        Editor->>Editor: keep the board, wait 2 s
        Editor->>Api: savePlacements again, with the board now on screen
        Note over Editor,Api: then 5 s, then 10 s. A fourth 429 in a row fails like any other error
    else 400, the board is refused
        API-->>Api: 400 with the reasons, nothing changed
        Api-->>Editor: HttpError 400 with details
        Editor->>Editor: board = the last saved one, forget the unsaved Undo steps
        Editor-->>Student: "the plan was not saved" with the API's reasons
        Editor->>Api: fetchPlanIssues for the saved board
    else 404, not the student's plan
        API-->>Api: 404, the same for a missing plan, another student's and a malformed id
        Editor->>Editor: board = the last saved one
        Editor-->>Student: "saving failed"
    else 401, the session is over
        API-->>Api: 401 from AuthGuard
        Editor->>Editor: board = the last saved one, no message
        Note over Editor: useAuth cleared the token, App.vue opens /sign-in
    else any other failure (5xx, no answer within 30 s)
        Api-->>Editor: the error
        Editor->>Editor: board = the last saved one
        Editor-->>Student: "saving failed"
        Editor->>Api: fetchPlanIssues for the saved board
    end
```

- **Opening a plan that is not the student's:** `GET /api/plans/{id}` answers 404 and the editor shows "no such plan" with a link to the plan list. `PlanIdPipe` turns a malformed id into the same 404.
- **The issues check fails** while the plan itself loaded: the Issues panel says so with a retry button (`retryCheck`); the board stays usable and still saves.
- **Lock:** a plan locked on this browser (`lock.ts`, `localStorage`) refuses every change in the editor until it is unlocked; the API knows nothing of it.
- **A6, several plans:** rename is `PATCH /api/plans/{id}`, duplicate `POST /api/plans/{id}/duplicate`, delete `DELETE /api/plans/{id}` after a confirmation dialog; each is one call to the `PlansService` method of the same name.
