# Guide content files

One file per guide and language (`<id>.<lang>.ts`), typed by hand against `GuideFile` in `../guide-file.ts`. `npm run db:seed` loads them; nothing else writes guides (ADR 0010). What each field holds and the rules for writing: [guides plan](../../../../../docs/requirements/guides-plan.md) §2 and §3.

## Write or change a guide

1. Type the text in both languages (guides plan §6 step 1: by hand, no AI drafting). Quote the portal's labels in “quotation marks”. Plain text only: no Markdown or HTML.
2. A team member follows every step on the real portal and records `lastChecked: { on: 'YYYY-MM-DD', by: '<name>' }`.
3. Set `status: 'published'`. For a change to a published guide, raise `version` by one and write `changeNote`. A re-check that finds nothing changed only updates `lastChecked`.
4. Run `npm run test -w src/backend -- content`. It refuses a missing field, a link that is not https, a typed credit number (hard rule 1), a typed date (§3 rule 4) and a portal missing from G01's board.
5. Open a pull request. Another team member reviews it (guides plan §6 step 3).

A new guide also needs its two imports in `index.ts`.

## What the seed refuses

The seed loads all files in one transaction and changes nothing if any is refused:

- a published file changed without a higher `version`;
- a `version` lower than the one loaded;
- a published guide turned back into `draft` (withdraw it, or publish a new version).

A file removed from this folder, or set to `status: 'withdrawn'`, is hidden but kept in the database, so problem reports about it stay valid.

## Test-only guides

`npm run db:seed -w src/backend -- --guide-fixtures` also loads the synthetic `zz-*` guides of TC-B1-GUIDE-01 from `../testing/guide-fixtures.ts`. Test databases only; a later `npm run db:seed` without the flag withdraws them again. Never put them in this folder.
