# Changesets

Every pull request adds a changeset: a small Markdown file describing the change and its semver bump.

```bash
npx changeset            # pick packages + bump, write the summary
npx changeset --empty    # docs/CI/chore PRs that should not cause a release
```

Bump guide (the product is pre-1.0, so breaking changes are `minor` until 1.0.0):

- `patch`: bug fix, internal change visible to users
- `minor`: new feature (one of F1–F12 or part of it)
- `major`: breaking API change (after 1.0.0)

On merge to `main`, the Release workflow opens or updates a **Version Packages** PR that bumps the versions and writes `CHANGELOG.md`. Merging that PR is the release.
