# 0006 Package Manager Strategy

## Status

Accepted

## Context

Suka currently uses npm workspaces with `package-lock.json`, npm-based GitHub Actions caching, `npm audit`, and Docker build steps based on `npm ci`.

Issue #39 raised pnpm as a possible package-manager improvement after moving the server workspace into `apps/server`. The server move is complete. Package-manager migration is a separate repository-wide decision because it affects:

- contributor setup
- lockfile ownership
- CI cache keys and install commands
- Docker install and prune behavior
- security audit workflow
- Dependabot configuration
- Windows, macOS, and Linux parity

## Decision

Keep npm as the package manager for now.

Do not migrate to pnpm until there is a concrete pressure that npm is not solving, such as install performance, disk usage, dependency isolation, workspace hoisting control, or repeatable CI pain.

## Rationale

The current npm setup is simple, already validated in CI, and familiar to new contributors. Switching package managers now would add process and tooling churn without solving an active failure in the codebase.

pnpm remains a good future option, especially if Suka grows more packages, needs stricter dependency boundaries, or starts publishing public packages from the monorepo.

## Future Migration Criteria

Revisit pnpm when at least one of these is true:

- install time or lockfile churn becomes a recurring contributor problem
- workspace dependency boundaries need stricter enforcement
- CI caching becomes slow or unreliable with npm
- the monorepo grows enough packages that pnpm's content-addressed store gives meaningful benefit
- package publishing requires stronger workspace release controls

## Migration Checklist

If Suka migrates to pnpm later:

- replace `package-lock.json` with `pnpm-lock.yaml`
- set `packageManager` to the selected pnpm version
- add `pnpm-workspace.yaml`
- update GitHub Actions cache and install steps
- update Dockerfile install and production prune steps
- update local setup docs and README
- verify `npm audit` replacement or equivalent security workflow
- verify Windows, macOS, Linux, and Docker builds
- update Dependabot configuration
