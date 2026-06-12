# Suka Architecture Principles

## Product Thesis

Suka is the neutral realtime coordination layer for multiple AI coding agents working on the same repository. It should make hidden agent work visible through structured pointers.

## Pointer Classes

- Presence pointer: ephemeral live status, expires quickly.
- Claim pointer: soft claim on files, APIs, domains, or modules; never a hard lock.
- Event pointer: durable-ish timeline activity such as API changes, test failures, and task completion.
- Decision pointer: accepted or proposed project memory with evidence and approval state.

## MVP Stack Bias

- TypeScript for shared protocol, CLI, server, MCP, and dashboard speed.
- SQLite for local persistence.
- WebSocket for realtime updates.
- Rule-based conflict detection before semantic detection.
- Local-first operation before team-hosted mode.

## Non-Negotiables

- Do not store prompts, chain-of-thought, secrets, raw terminal logs, or full chat history by default.
- Keep claims advisory.
- Keep all protocol objects explicit and serializable.
- Make every conflict warning explainable with a simple reason.
- Prefer boring, testable infrastructure over clever orchestration.
- Support Windows, Linux, and macOS for CLI/server/MCP workflows.
- Support iOS/iPadOS as a dashboard/client surface through responsive web/PWA behavior.

## Quality Bar

Architecture is industrial-grade when:

- modules have single ownership
- protocol changes are typed and validated
- persistence has migration discipline
- realtime behavior is deterministic under reconnects and expiration
- tests cover conflict severity, expiration, schema validation, and API responses
- dashboard state can be reproduced from fixtures
- platform-specific behavior is tested or abstracted behind adapters
