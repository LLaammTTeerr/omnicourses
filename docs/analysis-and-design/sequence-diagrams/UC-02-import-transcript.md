# Sequence diagrams: UC-02 Import transcript (as built: transcript entry)

- Use case: UC-02 ([specification](../../requirements/use-cases/UC-02-import-transcript.md)), feature F2
- Drawn from the code on `main` (15 November 2026): `src/frontend/src/transcript/` (`TranscriptView.vue`, `rows.ts`, `api.ts`), `src/frontend/src/auth/store.ts`, `src/backend/src/transcript/` ([ADR 0007](../adr/0007-transcript.md))
- What is built is the part of UC-02 from the review table on: the student types the rows in (A4), reviews them (step 6) and saves the whole set (steps 7–8, A5). Steps 1–5 (the paste) and A1 and A8 have no code. The Project Lead decided on 15 November 2026 that F2 is "paste the grades table, or type it in" ([ADR 0007, amendment](../adr/0007-transcript.md#amendment-15-november-2026-paste-or-type-no-file)); pasting is not on `main` yet and is not drawn. See [the differences list](../design-differences.md).

Participants are real modules. `useAuth` is the Pinia store in `auth/store.ts`; its `authed(call)` passes the session token to an API function. `ThrottlerGuard` and `AuthGuard` run before every controller method and are drawn once, in [UC-01, "Every signed-in request"](UC-01-sign-up-and-onboard.md#every-signed-in-request); here they appear as one step.

## Open the transcript

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as TranscriptView
    participant Auth as useAuth store
    participant Api as transcript/api.ts
    participant Ctrl as TranscriptController
    participant Svc as TranscriptService
    participant DB as PostgreSQL

    Student->>View: opens /transcript
    Note over View: the router guard has already checked sign-in<br/>and finished onboarding (router.ts)
    View->>Auth: authed(fetchTranscript)
    Auth->>Api: fetchTranscript(token)
    Api->>Ctrl: GET /api/users/me/transcript, Bearer token
    Note over Api,Ctrl: ThrottlerGuard, then AuthGuard set request.user
    Ctrl->>Svc: rowsFor(user.id)
    Svc->>DB: SELECT transcript_rows WHERE user_id = user.id<br/>ORDER BY term_year, term_number, course_code, id
    DB-->>Svc: rows, or none
    Svc-->>Ctrl: TranscriptEntry[]
    Ctrl-->>Api: 200 TranscriptDto { rows }
    Api-->>View: Transcript
    View->>View: rows = saved.map(fromRow), remember the saved state
    View-->>Student: the review table, empty when nothing is saved
```

The load goes through `useAsyncLoad`: while it runs the view shows a loading line, and a failure shows a message with a retry button that calls the same load again.

## Enter rows, review and save (steps 6–8, A2, A3, A4, A6)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as TranscriptView
    participant Rows as rows.ts
    participant Auth as useAuth store
    participant Api as transcript/api.ts
    participant Ctrl as TranscriptController
    participant Svc as TranscriptService
    participant DB as PostgreSQL

    loop each course taken
        Student->>View: Add a row, then term, course code, name, credits, result, grade
        View->>Rows: blankRow(key, rows), then problems(row) on every change
        Rows-->>View: the fields still wrong: term, courseCode, courseName, credits, result, grade
        View-->>Student: what to fix under the row, in words
    end
    Student->>View: Save transcript
    alt a row still has a problem (A2)
        View-->>Student: the save button stays off, with the count of rows to fix
    else every row is complete
        View->>Rows: toRow(row) for each row
        View->>Auth: authed(saveTranscript)
        Auth->>Api: saveTranscript(token, rows)
        Api->>Ctrl: PUT /api/users/me/transcript { rows }
        Note over Ctrl: ValidationPipe checks TranscriptDto:<br/>at most 300 rows, course code 2–20 letters or digits,<br/>credits 0–30, result one of five, grade 0–10 with one decimal<br/>only when the result is graded, term year and number
        Ctrl->>Svc: replace(user.id, dto.rows)
        Svc->>DB: BEGIN
        Svc->>DB: SELECT 1 FROM users WHERE id = user.id FOR NO KEY UPDATE
        Note over Svc,DB: two saves at once run one after the other
        Svc->>DB: DELETE transcript_rows WHERE user_id = user.id
        Svc->>DB: INSERT transcript_rows, one per row
        Svc->>DB: COMMIT
        Svc->>Svc: rowsFor(user.id)
        Svc-->>Ctrl: TranscriptEntry[]
        Ctrl-->>Api: 200 TranscriptDto { rows }
        Api-->>View: Transcript
        View->>View: rows = saved.map(fromRow), remember the saved state
        View-->>Student: toast "saved n rows"
    end
```

- **A3, course in progress:** the student picks the result `in_progress`; the row has no grade and is saved like any other. What it means for graduation is the rule engine's call.
- **A6, the same course twice:** each attempt is its own row. Nothing in the view or the service merges them; the rule engine picks the official attempt.
- **A5, saving over an existing transcript:** the save always replaces the whole set in one transaction. The view shows no comparison with the saved rows.
- **A9, leaving:** `onBeforeRouteLeave` asks the student to confirm when the rows on screen differ from the saved ones. Nothing was sent, so nothing is stored.

## Alternate flows of the save

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as TranscriptView
    participant Auth as useAuth store
    participant Api as transcript/api.ts
    participant API as REST API
    participant App as App.vue

    View->>Auth: authed(saveTranscript)
    Auth->>Api: saveTranscript(token, rows)
    Api->>API: PUT /api/users/me/transcript { rows }
    alt 400, a row the API refuses
        API-->>Api: 400 with one message per failed rule, nothing saved
        Api-->>View: HttpError 400
        View-->>Student: "the transcript was refused", rows stay on screen
    else 401, the session is over
        API-->>Api: 401 from AuthGuard
        Api-->>Auth: HttpError 401
        Auth->>Auth: clear() forgets the token
        Auth-->>View: HttpError 401, the view says nothing
        App->>App: signedIn turned false on a private page
        App-->>Student: /sign-in?redirect=/transcript
    else 429, too many requests
        API-->>Api: 429 from ThrottlerGuard (120 a minute per route and address)
        Api-->>View: HttpError 429
        View-->>Student: "saving failed", rows stay on screen, the student saves again
    else no answer within 30 s, or the network is down
        Api-->>View: the fetch fails (REQUEST_TIMEOUT_MS)
        View-->>Student: "saving failed", rows stay on screen
    end
```

The view's own checks (`problems` in `rows.ts`) mirror the DTO's, so a 400 is rare; it still has its own message. The transcript save has no automatic retry on 429: only the planner's save does ([UC-05](UC-05-build-and-edit-a-plan.md)).
