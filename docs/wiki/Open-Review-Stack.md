# Open Review Stack

Suka keeps CodeRabbit as an optional reviewer, but the project should not depend on a single hosted review tool or PR quota.

## Layers

- **PR Gate** remains the hard quality gate: typecheck, build, tests, audit, and the OS matrix.
- **CodeQL** remains the security scanner.
- **Danger Policy** adds Suka-specific PR review rules, such as large PR warnings, protocol/test coverage reminders, and workflow-change warnings.
- **Reviewdog Diff Hygiene** posts inline PR comments for diff hygiene issues reported by `git diff --check`.
- **CodeRabbit** can still provide extra review when quota is available.

## Intent

The open review stack is deterministic, cheap to run, and owned by the repository. It should catch repeatable review concerns before humans or AI reviewers spend attention on them.

## Rule Direction

Keep rules factual and low-noise:

- warn when a contract changes without nearby tests
- warn when dashboard changes omit build validation
- warn on workflow permission changes
- fail only for clear risks such as oversized PRs or secret-bearing files

Rules should be tuned through PR feedback rather than becoming a second, unpredictable reviewer.
