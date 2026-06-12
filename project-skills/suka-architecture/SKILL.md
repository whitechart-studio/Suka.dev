---
name: suka-architecture
description: Architecture guidance for Suka, the realtime coordination layer for AI coding agents. Use when Codex designs or reviews package boundaries, protocol shape, product scope, repo structure, persistence strategy, realtime behavior, privacy posture, or any cross-cutting implementation decision for Suka.dev.
---

# Suka Architecture

## Overview

Use this skill to keep Suka focused: an open-source coordination layer, not another code generator. Architecture work must preserve the product primitive of structured pointers across CLI, server, MCP, dashboard, and durable repo memory.

## Source Of Truth

Read the blueprint before major architecture changes:

- `suka-blueprint.md`

Load references only when needed:

- `references/architecture-principles.md` for boundaries, MVP scope, and quality bars.

## Product Boundaries

Treat Suka as:

- a local-first realtime coordination server
- a pointer protocol
- a CLI
- an MCP bridge for agents
- a dashboard for live repo awareness
- a durable store for accepted decisions

Do not turn Suka into:

- an AI code generator
- a project management suite
- a GitHub replacement
- a raw chat or prompt logger
- a lock manager that blocks humans

## Architecture Workflow

1. Start from pointer flow: who emits the signal, where it is stored, who consumes it, and whether it is ephemeral or durable.
2. Keep protocol types in a shared package before duplicating them in CLI, server, MCP, or dashboard.
3. Prefer simple MVP mechanics first: HTTP, WebSocket, SQLite, explicit events, and rule-based conflict checks.
4. Model privacy as a system invariant. Store structured metadata, not prompts, secrets, terminal logs, or chain-of-thought.
5. Separate local-first MVP from later team-hosted architecture. Do not add auth, billing, cloud assumptions, Redis, or Postgres until the local loop is real.

## Package Boundaries

Use this target structure unless there is a strong reason not to:

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
```

Rules:

- `protocol` owns schemas, pointer types, event names, status enums, and validators.
- `server` owns API routes, persistence, WebSocket broadcasting, expiration, and orchestration.
- `conflict-engine` owns deterministic conflict checks and severity reasons.
- `mcp` adapts protocol/server capabilities into agent-callable tools.
- `cli` is a thin user-facing client, not a second server.
- `dashboard` consumes API/WebSocket state and must not invent protocol semantics.

## Decision Criteria

Accept an architecture change when it:

- improves pointer reliability, visibility, or interoperability
- keeps the local demo easy to run
- preserves vendor neutrality across coding agents
- has a migration path from SQLite/local mode to team-hosted mode
- can be tested without requiring real private prompts or production repositories

Push back on changes that:

- make semantic intelligence mandatory for MVP
- couple the protocol to one AI vendor
- require hosted SaaS before local value is proven
- store sensitive user/agent internals by default
- add decorative dashboard complexity before live coordination works

## Verification

For architecture changes, produce or update at least one of:

- an ADR in `docs/architecture/`
- protocol schema or type tests
- API contract tests
- conflict-engine unit tests
- a dashboard state fixture that proves the data can be visualized
