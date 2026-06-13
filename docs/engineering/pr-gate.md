# PR Gate

Suka uses pull requests as the only path into `main`. Every PR should pass the automated gate before review approval or merge.

## Required Checks

- `PR Gate / Quality (ubuntu-latest, Node 20.x)`
- `PR Gate / Quality (macos-latest, Node 20.x)`
- `PR Gate / Quality (windows-latest, Node 20.x)`
- `PR Gate / npm Audit`
- `CodeQL / Analyze JavaScript And TypeScript`

## Advisory Checks

- Dependency Review

Dependency Review requires GitHub Dependency Graph to be enabled in repository settings. Until that setting is enabled, `npm Audit` remains the blocking dependency security gate. After Dependency Graph is enabled, add `actions/dependency-review-action` back to the PR workflow and require it in branch protection.


## Local Verification

Run the same workspace verification locally before opening a PR:

```bash
npm ci
npm run ci:verify
```

## Branch Protection Recommendation

Configure GitHub branch protection for `main`:

- Require a pull request before merging.
- Require approvals before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Block force pushes and deletions.

## Deployment Model

The current CD workflow builds and uploads a versioned artifact from `main`. Hosted deployment should be added as a separate job after the hosting target and secrets are selected.
