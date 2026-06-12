# ADR 0001: Suka Architecture Foundation

## Status

Accepted

## Context

Suka is an open-source realtime coordination layer for teams using multiple AI coding agents on the same repository. The product should make hidden agent work visible through structured pointers: presence, claims, events, and decisions.

The first architecture must optimize for a local, credible MVP that can become industrial-grade without overbuilding hosted infrastructure too early.

## Decision

Build Suka as a TypeScript monorepo with these ownership boundaries:

```text
apps/
  dashboard/
packages/
  cli/
  server/
  mcp/
  protocol/
  conflict-engine/
examples/
docs/
project-skills/
```

Use:

- shared protocol schemas and types
- local server with HTTP and WebSocket APIs
- SQLite for local persistence
- MCP tools as adapters over server/application services
- deterministic rule-based conflict detection for MVP
- dashboard state bootstrapped from HTTP and updated over WebSocket

## Consequences

This keeps the MVP easy to run locally while preserving clean upgrade paths to team-hosted mode, Postgres, auth, GitHub integration, and better semantic conflict detection.

Protocol changes must be handled deliberately because all surfaces depend on them. Realtime behavior and privacy rules become core architecture, not later polish.

## Quality Bar

Suka code should be considered production-minded only when:

- protocol objects are typed and validated
- server inputs are treated as untrusted
- persistence round trips are tested
- conflict warnings include severity and explainable reasons
- private prompts, secrets, raw terminal logs, and chain-of-thought are not stored by default
- dashboard states are reproducible through fixtures
