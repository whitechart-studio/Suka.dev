# Project Hygiene

Suka uses GitHub Issues as the product/work tracking layer and pull requests as implementation records. The project board should answer what is planned, what is active, what is under review, and what is actually done.

## Tracking Model

- **Issue:** product scope, engineering task, bug, or documentation work with acceptance criteria.
- **Pull request:** implementation linked to one or more issues.
- **Project item:** the issue that represents the work, not every PR created along the way.

Avoid adding every PR as a standalone project card. PR cards make the board noisy and hide the product backlog. Link PRs to issues instead.

## Status Rules

- **Backlog:** accepted work that is not ready to start or not actively being worked.
- **Ready:** scoped work with enough detail to begin.
- **In progress:** implementation has started on a branch.
- **In review:** a PR is open and ready for review.
- **Done:** the acceptance criteria are complete, the PR is merged, and no follow-up is required for that issue.

Do not move an issue to `Done` only because a PR merged. Move it to `Done` when the issue's acceptance criteria are satisfied.

## Pull Request Flow

1. Create or select the issue before implementation begins.
2. Move the issue to `In progress` when work starts.
3. Open a PR and link it to the issue.
4. Move the issue to `In review` when the PR is ready.
5. Keep review fixes in the same PR unless the feedback reveals a separate scope.
6. After merge, move the issue to `Done` only when the issue is fully complete.

If a merged PR only completes part of an issue, leave the issue open and update the issue comment or checklist with what remains.

## Good Issue Shape

Each issue should include:

- outcome or product intent
- scope
- acceptance criteria
- relevant implementation notes or constraints

Issues should be small enough to finish through one focused PR when possible. Larger roadmap items should be split into protocol, server/API, CLI, dashboard, documentation, and integration issues.

## Board Review

During project cleanup:

- confirm merged PRs are linked to their issues
- move completed issues to `Done`
- keep roadmap issues in `Backlog`
- close or rewrite stale issues that no longer match the product direction
- avoid using the board as a raw PR archive

This keeps Suka's project board useful for planning instead of becoming a history log.
