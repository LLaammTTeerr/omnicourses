# Sequence diagrams: UC-10 Follow a school-task guide

- Use case: UC-10 ([specification](../../requirements/use-cases/UC-10-follow-a-school-task-guide.md)), feature F11
- Drawn from the code on `main` (15 November 2026): `src/frontend/src/guides/` (`GuidesView.vue`, `GuideView.vue`, `api.ts`, `search.ts`, `pick-text.ts`), `src/backend/src/guides/` ([ADR 0010](../adr/0010-public-pages-and-guide-content.md))
- Built: browsing, searching and reading a published guide without signing in (steps 1–7, A1, A2, A5, A8). Not built: the parts that use the student's data (A3, A4) and reporting a problem (A6); see [the differences list](../design-differences.md).

Reading a guide needs no account: both routes are `@Public()`, and `guides/api.ts` calls `getJson`, which sends no token even when the reader is signed in.

## Browse and search the guides (steps 1–3, A1, A2)

```mermaid
sequenceDiagram
    autonumber
    actor Reader as Student or signed-out reader
    participant View as GuidesView
    participant Api as guides/api.ts
    participant Throttle as ThrottlerGuard
    participant Guard as AuthGuard
    participant Ctrl as GuidesController
    participant Svc as GuidesService
    participant DB as PostgreSQL

    Reader->>View: opens /guides
    View->>Api: fetchGuides()
    Api->>Throttle: GET /api/guides, no Authorization header
    Throttle->>Guard: allowed (120 a minute per address)
    Guard->>Guard: route is @Public(), skip the token check
    Guard->>Ctrl: list()
    Ctrl->>Svc: list()
    Svc->>DB: SELECT guide_texts with guide WHERE status = published<br/>ORDER BY guide_id, lang
    DB-->>Svc: one row per guide and language
    Svc->>Svc: isOutOfDate(lastCheckedOn, today in Vietnam) per text
    Svc-->>Ctrl: GuideListItemDto[]: id, group, texts by language
    Ctrl-->>Api: 200 GuideListDto { guides }
    Api-->>View: GuideListItem[]
    View->>View: pickText(texts, screen language), group by task group, sort by title
    View-->>Reader: the guides by group, each with its portal and direct link
    Reader->>View: types "hoc phi"
    View->>View: matches(guide, query): titles and keywords in both languages,<br/>with or without diacritics, no request sent
    View-->>Reader: the list narrowed
    opt nothing matches (A2)
        View-->>Reader: "no guide covers this yet", and the task groups to browse
    end
    opt straight to the link (A1)
        Reader->>View: presses the portal link of an entry
        View-->>Reader: the portal opens in a new tab, OmniCourse sees none of it
    end
```

## Read one guide (steps 4–7, A5, A8)

```mermaid
sequenceDiagram
    autonumber
    actor Reader as Student or signed-out reader
    participant View as GuideView
    participant Api as guides/api.ts
    participant Ctrl as GuidesController
    participant Svc as GuidesService
    participant DB as PostgreSQL

    Reader->>View: opens /guides/{id}
    View->>Api: fetchGuide(id)
    Api->>Ctrl: GET /api/guides/{id}, public
    Ctrl->>Svc: get(id)
    alt the id has the shape of a guide id (GUIDE_ID, at most 64 characters)
        Svc->>DB: SELECT guide_texts with guide<br/>WHERE guide_id = id AND status = published
        DB-->>Svc: one row per language, or none
    else any other text
        Svc->>Svc: no query
    end
    alt at least one published text
        Svc->>Svc: isOutOfDate(lastCheckedOn, today in Vietnam)
        Svc-->>Ctrl: GuideDto: id, group, texts by language
        Ctrl-->>Api: 200 GuideDto
        Api-->>View: Guide
        View->>View: pickText(texts, screen language)
        opt no text in the screen's language (A8)
            View->>View: the other language's text, marked with its language
        end
        opt outOfDate is true (A5)
            View-->>Reader: a warning with the last-checked date, the guide stays readable
        end
        View-->>Reader: summary, when, who it applies to, what to prepare, the portal and its account,<br/>numbered steps, notes with their source, version and last-checked date
        Reader->>View: Open the portal
        View-->>Reader: the direct link opens in a new tab
    else unknown, draft or withdrawn guide
        Svc-->>Ctrl: NotFoundException
        Ctrl-->>Api: 404 "Guide not found"
        Api-->>View: null
        View-->>Reader: "this guide does not exist", with a link back to the guides
    end
```

- **Other failures** (429, 5xx, no answer within 30 s): `useAsyncLoad` puts the view in its failed state, and `LoadFailed.vue` shows a message with a retry button that calls the same fetch again.
- **A withdrawn guide and a draft** answer the same 404 as an unknown id, so the API does not reveal that they exist. A draft is never in the database: the seed stores only published and withdrawn texts.
- **Out of date:** `isOutOfDate` (`guides/out-of-date.ts`) is true when `lastCheckedOn` is more than `OUT_OF_DATE_MONTHS` (6) months before today's date in Vietnam. The clock is injected as `GUIDES_CLOCK`, so tests set the date.
- **Where the texts come from:** `npm run db:seed -w src/backend` validates the files in `guides/content/` (`validate-guide.ts`) and stores them (`seed-guides.ts`). No route writes a guide.
