# Contributing

## 1. Tasks: Discord, Sprint tab

All tasks live in the team Discord server, in the **Sprint** tab, one message per task.

1. **Take or create a task** in the Sprint tab.
2. **Tag the person who assigned it** in the task message.
3. **Keep its state current** the day it changes:
   - **Bucket**: accepted, not started
   - **Doing**: in progress. Add the PR number as soon as the PR is open
   - **Done**: merged *and* deployed
4. **Open a PR, get it reviewed, merge, deploy** (sections 2–4 below).

The weekly report is copied from this list, so a task that isn't updated didn't happen.

## 2. Branches, commit messages and PR titles

```bash
git switch main && git pull
git switch -c <type>/<short-name>      # e.g. feat/degree-audit, fix/credit-cap
```

Commit messages and PR titles follow **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**. CI checks both (`pr-title`, `commit-messages`). The **PR title matters most**: squash merge turns it into the one commit that lands on `main`.

```
<type>(<scope>): <subject>

<body: what and why, wrapped at 72>

<footer: Refs #12, BREAKING CHANGE: …, Co-Authored-By: …>
```

| Part | Rule |
| --- | --- |
| `type` | `feat` new feature · `fix` bug fix · `docs` · `test` · `refactor` (no behaviour change) · `perf` · `build` (deps, tooling) · `ci` · `chore` · `revert` · `style` (formatting only) |
| `scope` | Optional, lowercase: `backend`, `frontend`, `db`, `rules` (rule engine), `audit`, `planner`, `ai`, `auth`, `deps`, `release`, … |
| `!` | Breaking change: `feat(api)!: rename /plans to /roadmaps`, plus a `BREAKING CHANGE:` footer |
| `subject` | Imperative mood ("add", not "added"), starts lowercase, no trailing period, whole header ≤ 72 characters |

Examples:

```
feat(audit): show remaining credits per requirement group
fix(rules): enforce the 12-credit cap in summer terms
test(planner): cover prerequisite chains longer than three
docs: add use-case specification UC-04
build(deps): bump vitest to 5.0.5
```

Branch prefix = the type of the PR. The changeset bump usually follows the type: `fix` → patch, `feat` → minor (pre-1.0), `!` → major (after 1.0). `docs`/`test`/`ci`/`chore` → `--empty`.

### Every commit must be signed

`main` rejects unsigned commits. Set up SSH signing once:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

Then add the **same public key a second time** on GitHub as a **Signing key** (Settings → SSH and GPG keys → New SSH key → Key type: *Signing Key*). An authentication key alone does not make commits *Verified*.

Check: `git log --show-signature -1`, and the *Verified* badge on GitHub.

If you already pushed unsigned commits: `git rebase --exec 'git commit --amend --no-edit -S' main` then `git push --force-with-lease`.

## 3. Pull requests

- **Add a changeset** before opening the PR. CI fails without one:
  ```bash
  npx changeset            # choose bump: patch = fix, minor = feature (pre-1.0), write one user-facing line
  npx changeset --empty    # docs, CI, chores: nothing to release
  ```
  Commit the generated `.changeset/*.md` file. See [.changeset/README.md](.changeset/README.md).
- Fill in the PR template. The **"Why this design"** section is required (see AI policy).
- CI (`backend`, `frontend`) must be green.
- At least **one approval** from another member. Pushing new commits dismisses earlier approvals.
- Reviewers: Frontend Lead for `src/frontend`, Backend Lead for `src/backend`, Project Lead for the data model and the rule engine.

## 4. Merge and deploy: the author does both

1. After approval, **the author** clicks *Squash and merge*.
2. **The author** deploys: *Actions → Deploy → Run workflow* on `main`. At the end of a sprint, fill in `build_tag` (`B0`…`B3`).
3. Move the Discord task to **Done**.

### Releases

Every merge to `main` updates an open **chore(release): version packages** PR (opened by GitHub Actions). It bumps the version and writes the changelog from the changesets merged so far. It goes through the same review. Merge it at the end of a sprint, then deploy with the build tag (`B0`…`B3`).

## 5. AI policy

**Using AI is unlimited.** Generate as much code, tests and documentation as you want, with any tool.

**Understanding it is not optional.** Vibe-coding is fine, but you must:

1. **Understand the architecture** of what you generated: where it sits, what calls it, what it depends on.
2. **Own every choice in it**: libraries, data structures, patterns, trade-offs. An AI's default is still your decision once you commit it.
3. **Defend the choice with evidence** in the PR's *Why this design* section: the alternative you rejected and a link that backs the decision (official docs, a benchmark you ran, a test, a spec clause, an ADR).

Reviewers enforce this. A reviewer may ask "why X and not Y?" on any line, and "the AI wrote it" is not an answer. A PR whose author can't explain it is sent back, however good the code is.

Decisions that outlive one PR (a new library, a schema change, a new module boundary) get an ADR in `docs/analysis-and-design/adr/`. Copy [0001](docs/analysis-and-design/adr/0001-technology-stack.md) as the template.

Never paste secrets, personal student data, or real transcripts into an external AI tool.
