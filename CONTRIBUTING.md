# Contributing

## 1. Tasks: Discord, Sprint tab

All tasks live in the team Discord server, in the **Sprint** tab, one message per task. Each task also has a **GitHub issue** (*Issues → New → Task*), which holds the spec and is what AI agents read and write ([docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)). Use the words in [GLOSSARY.md](GLOSSARY.md).

1. **Take or create a task** in the Sprint tab, and link its GitHub issue in the message.
2. **Tag the person who assigned it** in the task message.
3. **Keep its state current** the day it changes:
   - **Bucket**: accepted, not started
   - **Doing**: in progress. Add the PR number as soon as the PR is open
   - **Done**: merged *and* deployed
4. **Open a PR, get it reviewed and merge it** (sections 2–4 below). Production deploys by itself.

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
- CI must be green: the `changeset`, `signed-commits`, `pr-title`, `commit-messages`, `backend` and `frontend` checks.
- At least **one approval** from another member. Pushing new commits dismisses earlier approvals.
- **Admin override:** the Project Lead (repo admin) has final authority and may merge a PR without an approval (merge box → *Merge without waiting for requirements to be met*, or `gh pr merge --admin`). CI and signed commits still apply, and it is still a PR. Use it for urgent fixes or tie-breaks, and say why in the PR.
- Reviewers: Frontend Lead for `src/frontend`, Backend Lead for `src/backend`, Project Lead for the data model and the rule engine.
- A feature PR that adds or removes a route or a screen also updates the feature table in [README.md](README.md#what-is-built).

Two GitHub rulesets on `main` enforce these rules. `protect-main` (pull request, CI, signed commits, no force-push or deletion) has no bypass for anyone. `require-approval` (one approval) can be bypassed only by the repository admin (LamTer, Project Lead), and only when merging a pull request. The admin still never pushes to `main` directly and never merges with red CI. Builds B0–B3 are tagged.

## 4. Merge and deploy

1. After approval, **the author** clicks *Squash and merge*.
2. **Production deploys by itself.** When CI passes on the merge commit, the Deploy workflow deploys `main` to production ([deploy/README.md](deploy/README.md)). Nobody runs it by hand. A push to the `staging` branch deploys staging in the same way.
3. To tag a build (`B0`…`B3`), only when the Project Lead asks: `gh workflow run deploy.yml --ref main -f environment=production -f build_tag=B<n>`. A manual run must name `environment=production` on `main`: the default, `staging`, fails on `main`.
4. Move the Discord task to **Done** when the deploy has finished.

### Releases

Every merge to `main` updates an open **chore(release): version packages** PR (opened by GitHub Actions). It bumps the version and writes the changelog from the changesets merged so far. It goes through the same review. Merge it as soon as it holds a user-facing change (Project Lead, 24 November 2026: "release more often"); do not wait for the end of a sprint. Merging it is the release, and production deploys it like any other merge. Never edit `CHANGELOG.md` or a package version by hand. The bump guide is in [.changeset/README.md](.changeset/README.md).

## 5. AI policy

**Using AI is unlimited.** Generate as much code, tests and documentation as you want, with any tool.

**Understanding it is not optional.** Vibe-coding is fine, but you must:

1. **Understand the architecture** of what you generated: where it sits, what calls it, what it depends on.
2. **Own every choice in it**: libraries, data structures, patterns, trade-offs. An AI's default is still your decision once you commit it.
3. **Defend the choice with evidence** in the PR's *Why this design* section: the alternative you rejected and a link that backs the decision (official docs, a benchmark you ran, a test, a spec clause, an ADR).

Reviewers enforce this. A reviewer may ask "why X and not Y?" on any line, and "the AI wrote it" is not an answer. A PR whose author can't explain it is sent back, however good the code is.

Decisions that outlive one PR (a new library, a schema change, a new module boundary) get an ADR in `docs/analysis-and-design/adr/`. Copy [0001](docs/analysis-and-design/adr/0001-technology-stack.md) as the template.

Never paste secrets, personal student data, or real transcripts into an external AI tool.
