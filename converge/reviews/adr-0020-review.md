# Review of ADR 0020 (branch refactor/cv-21-structure-adr, commit f627ae4)

I checked the ADR against the code and the docs, and ran `node scripts/lint.mjs` (it passes). Two-way pairs worked out from scripts/layers.mjs today: backend `auth <-> users` only, frontend `plans <-> sharing` only. These are true: no `common ->` or `config ->` edge; `frontendLayerExceptions = []` (layers.mjs:131), emptied by #224; every rule name cited is real and has a failing and a passing case in lint.test.mjs. Every owner file exists and holds what the ADR says. The ruleset does not require a branch to be up to date (protect-main: strict=false). The route table was byte-identical in #233 and #237 (both PR bodies say so). The ADR 0015 package and the architecture.md line 217 claim about TypeScript 5 are right. Every PR number beside a decision matches the PR's diff (#220 lint rules; #222 locks and seeds; #223 vocabulary, TermDto, removal of common->terms, audit->plans; #224 exceptions emptied; #225 attempts/prerequisites; #229 account-state and identifier-home; #231 api-errors and coded-error-home; #232/#238 contract; #233/#237 routes and dashboard; #234 admin-access).

## Findings

1. **Wrong: what #207 added.** ADR line 10: "the next large pull request (#207) added two cross-module imports that nobody had to decide on (`notifications` to `academic-calendar`, `sharing` to `plans`)".
   Code: both backend edges were there before #207. See `git grep` at 3c4da22^: notifications/notifications.module.ts:3 imports academic-calendar, and sharing/plan-share.entity.ts:2 imports plans. Comparing the import graph before and after 3c4da22 shows what #207 really added. Backend: `account -> curriculum-admin` and `curriculum -> curriculum-admin`. Frontend: `plans -> sharing`, `sharing -> plans`, `admin -> calendar` and three more. The wrong claim was copied from the #220 PR body.
   Corrected: "the next large pull request (#207) added cross-module imports that nobody had to decide on: on the backend `curriculum -> curriculum-admin` (which closed a cycle) and `account -> curriculum-admin`, on the frontend `plans <-> sharing`."

2. **Imprecise: the backend cycles.** ADR line 10: "the folder cycles `curriculum <-> curriculum-admin <-> database` and `auth <-> users`".
   Code: the layers.mjs that #220 added lists `curriculum -> curriculum-admin`, `curriculum-admin -> curriculum`, `curriculum -> database`, `database -> curriculum` and `curriculum-admin -> database`. There is no `database -> curriculum-admin`. So the cycles were two pairs that both go through curriculum. Neither was between curriculum-admin and database. #222 removed both.
   Corrected: "the folder cycles `curriculum <-> curriculum-admin`, `curriculum <-> database` and `auth <-> users`".

3. **Imprecise: one owner of the coded error body.** ADR line 24: "the coded error body (`common/api-errors.ts`)", and the accepted exceptions do not mention a second home.
   Code: scripts/layers.mjs:93 `codedErrorHomes = ['src/backend/src/common/api-errors.ts', 'src/backend/src/ai/']`. src/backend/src/ai/ai-unavailable.error.ts:23 builds `{ statusCode: 503, code: 'ai_unavailable', message }` by hand.
   Corrected: "the coded error body (`common/api-errors.ts`; the AI gateway's `AiUnavailableError` in `ai/` is the one other listed home)". Add the same as an accepted exception.

4. **Wrong: "Each is listed where the rule lives".** ADR line 30: "Each is listed where the rule lives, so it cannot spread without an edit there."
   Code: `auth <-> users`, `plans <-> sharing` and `audit -> plans` are lines in layers.mjs (lines 29/84, 150/154, 22). The other three exceptions are listed nowhere. lint.mjs checks only imports across folders (backendFolderImports filters `from !== to`, lint.mjs:355), so a cycle between entity files inside curriculum/ is never checked. The `variant` prop (plans/CapMeter.vue:4, plans/IssueCard.vue:16) and the before/after option of `codedError` (common/api-errors.ts:29-31) are ordinary code.
   Corrected: "The three import exceptions are lines in `scripts/layers.mjs`, so they cannot spread without an edit there. The other three are design choices that no check enforces."

5. **Imprecise: why `audit -> plans`.** ADR line 35: "`rules/` would be the closer home, but the purity check of the engine exempts only its loader files."
   Code: rules/rules.service.spec.ts (the purity describe) has two lists. `LOADERS = ['rules.module.ts', 'rules.service.ts']` is exempt. `PURE_IMPORTS = ['../common/collections.js', '../curriculum/curriculum-rules.js', '../terms/term.js', '../transcript/transcript-entry.js']` lists files outside rules/ that the engine may import. The #223 body gives the reason: putting the DTO in rules/ "would need a special case for that file", because the DTO uses `@nestjs/swagger`. Also, `audit -> plans` is a plain one-way edge, not a two-way pair. `sharing` imports `CreditCapsDto` too (sharing/sharing.dto.ts:6).
   Corrected: "`CreditCapsDto` (used by `audit` and `sharing`) lives in `plans/plan-issues.dto.ts`. In `rules/` its Swagger decorators would need a special case in the engine's purity check, which allows framework imports only in `rules.module.ts` and `rules.service.ts`."

6. **Wrong and inconsistent: the SQL count.** ADR line 24 (Alternatives): "a change to what 'waiting for deletion' means needed nine edits, three of them inside SQL strings". Context line 12 says the same reads were "mostly inside raw SQL".
   Code on main (`git grep deletion_requested_at main`): the column was read inside SQL strings at seven sites. They are access-admin.service.ts:32, admin-lookups.ts:57, admin-write.service.ts:38 and :81, notifications.service.ts:24, and sharing.service.ts:57 and :93. Other reads were TypeScript property checks, such as auth.service.ts:86 and :111 and access-admin.service.ts:18.
   Corrected: "needed edits in nine places, most of them (seven) inside SQL strings". Or drop the number so it agrees with Context.

7. **Incomplete: exemptions the ADR does not mention.** The ADR names the composition root as the only file exempt from the import rules (line 20).
   Code: scripts/lint.mjs:22-23 and 155-157 (`isProductionFile`) take specs, `*.browser.spec.ts`, `*.e2e-spec.ts` and every `testing/` folder out of backend-import-direction, frontend-layers, frontend-feature-edges, identifier-home and coded-error-home. lint.test.mjs:231 and :350 test this. The `PURE_IMPORTS` list (finding 5) is a second exemption list that the ADR does not mention.
   Corrected sentence to add: "Spec files and `testing/` folders may import anything and are not checked by the home rules."

8. **Imprecise: the curriculum entity files.** ADR line 33: "The three curriculum entity files import each other."
   Code: curriculum/curriculum.entity.ts:14-15 imports program.entity and requirement-group.entity. program.entity.ts:2 and requirement-group.entity.ts:16 import curriculum.entity back. program and requirement-group do not import each other. combined-minimum.entity and course-rules.entities import curriculum.entity one way only.
   Corrected: "`curriculum.entity.ts` and the `program` and `requirement-group` entity files import each other in pairs: TypeORM relations need both ends."

9. **Missing decision row.** The rules `modules-registered` and `module-index` came in #220 (lint.mjs:558-591; tests at lint.test.mjs:393-439). They outlive one pull request: every new backend module must be reachable from features.ts and named in section 4 of architecture.md. The ADR mentions them only under Consequences (line 42), with no Decision row and no evidence.
   Corrected: add a row such as "**Every backend module is registered and documented.** A `*.module.ts` not reachable from `features.ts` or `app.module.ts`, or a module folder missing from the section 4 table of architecture.md, fails lint." Evidence: "rules `modules-registered`, `module-index`; #220".

## Minor (not counted)
- Format: docs/agents/domain.md:18 asks the Context to cite a Vision or SDP clause. This ADR cites AGENTS.md, which is reasonable for a structural decision. The header, the three columns and the Evidence cells (none empty) follow the format. The architecture.md section 8 row is correct.
- Line 12, "read in nine places in five modules": main has about eleven read lines in auth, curriculum-admin, notifications and sharing, plus users. The number is plausible but loose.
- Line 20: config/ never had an outgoing edge (none in #220's list). Only `common -> terms` was removed, by #223. The row is accurate. It just credits #223 for both folders.

9 corrections
