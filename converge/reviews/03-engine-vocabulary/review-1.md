# Review round 1: 03-engine-vocabulary

Verdict: approve. Nothing blocking found.

## What I checked
1. Behaviour. The five interfaces and two value lists in curriculum/curriculum-rules.ts are the same, field for field, as the code they replace (curriculum-rules.reader.ts, program.entity.ts, requirement-group.entity.ts). CurriculumRuleCombinedMinimum is now exported; before, nothing outside the reader used it. TermDto in terms/term.dto.ts has the same decorators in the same order. CreditCapsDto in plans/plan-issues.dto.ts is unchanged. The entity files only used the types, never the value lists in @Check, so changing them to `import type` is safe. No query, SQL, mapper or error text changed.
2. Contract. Diff of openapi.json, migrations and package-lock.json is empty. After build and openapi, git status is clean, so openapi.json is byte-identical.
3. Tests. The only spec changes are import paths, plus rules.service.spec.ts, where the regex drops `(?!type )` and adds the new pure file. No it/expect lost. Planted `import type { Repository } from 'typeorm'` in rules/coverage.ts: the spec fails ("coverage.ts imports typeorm"). Planted the same in curriculum/curriculum-rules.ts: it fails in the leaf walk. Tree restored. Full backend unit suite: 74 files, 1135 tests pass. Typecheck and lint (including lint.test.mjs) pass.
4. Completeness. Nothing in src/, scripts/, docs/, AGENTS.md or README.md still imports the old names from the reader or the entity files. TermDto no longer comes from common/field-validators. CreditCapsDto is no longer in audit.dto. courseCodesOf and groupIdsOf are untouched.
5. Structure (depgraph, base against head). The edges common->terms, plans->audit and sharing->audit are gone. One edge is new, audit->plans. audit has one user, (root). plans has three users, (root), sharing and audit. So the new edge points from the less stable folder to the more stable one. No cycle. common/ and config/ now depend on no folder. Putting the DTO in common/ instead would have added common->rules (for `implements CreditCaps`), so plans is the right home. layers.mjs matches.
6. Repo rules. No comments, no new dependency, .js suffixes, every commit signed (G), Conventional subjects, exactly one new file under .changeset/.
7. Scope. No off-limits file touched (advisor/, ai/, csv-import, frontend files).

## Non-blocking
- src/backend/src/rules/types.ts lines 1-2: two `import type` lines from '../curriculum/curriculum-rules.js'. Merge them into one.
- rules.service.spec.ts: the purity regex still misses inline type queries such as `type X = import('typeorm').Repository`. This gap existed before; it could be closed by also matching `import\('([^']+)'\)`.
- The implementer report file (scratchpad/batches/03-engine-vocabulary/report.md) does not exist, so I could not check what the implementer says they left out. The intended-edge list the brief asks for (audit -> plans) must be in it.
