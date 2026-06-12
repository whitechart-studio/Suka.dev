---
name: suka-quality-review
description: Industrial-grade quality and review guidance for Suka.dev. Use when Codex reviews or hardens Suka code, adds tests, evaluates architecture risk, prepares PRs, defines acceptance criteria, checks privacy/security behavior, or raises production-readiness issues across backend, dashboard, protocol, MCP, CLI, and hosted platform work.
---

# Suka Quality Review

## Overview

Use this skill to keep Suka professional: small modules, typed contracts, deterministic tests, privacy by default, and review findings that point to concrete fixes.

## Quality Gates

Before considering work complete, verify:

- protocol objects are typed and validated at boundaries
- server inputs are untrusted until parsed
- storage round trips are tested
- realtime events are idempotent or safely reconcilable
- conflicts include severity, reason, and affected scope
- dashboard states cover empty, active, conflict, and stale data
- private prompts, secrets, raw terminal logs, and chain-of-thought are not stored by default
- local mode still works after hosted/self-hosted changes

## Review Stance

Lead with bugs and risks, not praise. Prioritize:

1. data loss, privacy leaks, auth bypass, tenant isolation failures
2. protocol incompatibility across CLI/server/MCP/dashboard
3. incorrect conflict warnings or missed high-risk conflicts
4. brittle realtime behavior under reconnects or expiry
5. missing tests for changed behavior
6. maintainability issues that will slow the project soon

## Test Strategy

Prefer focused tests:

- protocol schema validation
- conflict-engine unit tests
- service-layer tests with in-memory or temp storage
- API contract tests
- WebSocket event reconciliation tests
- dashboard component tests with fixtures
- integration smoke tests for CLI to server where practical

## Acceptance Criteria Format

For substantial changes, write acceptance criteria as:

```text
Given ...
When ...
Then ...
```

Each criterion should be observable by a test, API call, CLI command, or dashboard state.

## Review Output

When reviewing, report:

- finding with severity
- file and line
- why it matters
- concrete fix direction
- missing test, if any

Load `references/release-readiness.md` when preparing a release, PR, or architecture milestone.
