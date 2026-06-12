---
name: suka-backend
description: Backend implementation guidance for Suka.dev. Use when Codex works on the Suka server, CLI, MCP server, protocol schemas, SQLite persistence, WebSocket events, conflict engine, pointer validation, repository config, or tests for these backend packages.
---

# Suka Backend

## Overview

Use this skill to implement Suka backend code with production discipline: typed protocol objects, deterministic conflict checks, clear persistence boundaries, explicit privacy rules, and tests for behavior rather than happy-path demos only.

## Source Of Truth

- `suka-blueprint.md`
- `project-skills/suka-architecture/references/architecture-principles.md`
- `references/backend-contracts.md` when implementing API, schema, or event names.

## Implementation Order

For new backend work, build in this order:

1. Protocol type or schema in `packages/protocol`.
2. Validation and serialization tests.
3. Storage shape or migration.
4. Server route/service.
5. WebSocket broadcast event if state changes.
6. CLI or MCP adapter.
7. Dashboard fixture or API example.

## Backend Rules

- Treat input from CLI, dashboard, MCP, and file watcher as untrusted.
- Validate every pointer before persistence or broadcast.
- Store arrays and nested scope data as JSON with typed parse helpers if using SQLite text columns.
- Use server time for `created_at`, `updated_at`, `last_seen`, and expiration calculations.
- Make expiration idempotent; repeated cleanup should not change valid state.
- Never persist secrets or raw prompts. Add redaction checks before accepting free-form summaries.
- Return conflict warnings with severity, reason, matched scope, and involved pointer IDs.
- Keep MCP tools as adapters over the same application services used by HTTP routes.

## Pointer Semantics

Presence:

- one active presence row per agent
- heartbeat every 15 seconds
- expiry default between 60 and 120 seconds
- update broadcasts `presence.updated`

Claims:

- advisory only
- require `agent_id`, at least one scope dimension, reason, and TTL
- support release and expiration
- broadcasts `claim.created`, `claim.released`, or `claim.expired`

Events:

- append-only unless retention compaction is explicitly implemented
- use controlled `event_type` values
- broadcast `event.created`
- may trigger conflict checks

Decisions:

- durable project memory
- require evidence references for accepted status
- preserve status history where practical
- export accepted decisions to repo-local agent context later

## Test Bar

For backend changes, add focused tests for:

- protocol validation failures and successes
- storage round trips
- expiration behavior
- conflict severity and reason strings
- HTTP response contracts
- MCP tool input/output contract where applicable

## Review Checklist

- Can this behavior run locally without cloud services?
- Is the same state available to CLI, MCP, and dashboard?
- Is every broadcast replayable from persisted state or explicitly ephemeral?
- Does the code avoid private prompts, secrets, and terminal logs?
- Does a failed validation produce actionable error text?
- Does the implementation avoid one-off protocol types hidden in an adapter?
