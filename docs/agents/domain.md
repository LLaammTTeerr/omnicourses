# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase. Layout: **single-context** (one glossary for the whole product; `src/backend` and `src/frontend` are two halves of one domain, not two contexts).

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/analysis-and-design/adr/`**: read ADRs that touch the area you're about to work in.
- **`docs/requirements/use-cases/`**: the use case behind the feature you work on. The Vision document's features (F1–F12) and NFRs are in `report/assignments/PA2/Vision.tex`.
- **[README.md, What is built](../../README.md#what-is-built)**: which features have an API and a screen today.

`docs/test/evidence/`, `report/`, `docs/management/weekly-reports/` and `docs/analysis-and-design/ui-prototypes/assets/` are dated records, so `.rgignore` hides them from code search; the living documents are the ones listed above, the code, and `docs/analysis-and-design/architecture.md`.

## ADRs in this repo

This repo's ADRs live in **`docs/analysis-and-design/adr/`**, the folder the course's document structure requires. Wherever a skill says `docs/adr/`, read and write this folder instead, and number new ADRs after the highest one there.

Write new ADRs in the repo's format, which [0002](../analysis-and-design/adr/0002-authentication-and-sessions.md) shows: a `Status / Date / Deciders / Reviewer` list, a **Context** section citing the Vision or SDP clause, and a **Decisions** table with *Decision / Alternatives rejected / Evidence* columns. The evidence column is the team AI policy (CONTRIBUTING.md §5), so it is never empty. The domain-modeling skill's tests for *when* to offer an ADR still apply.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0002 (authentication and sessions), but worth reopening because…_
