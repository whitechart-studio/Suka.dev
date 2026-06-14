# ADR 0002: Codex Skills Strategy

## Status

Superseded by the repository hygiene decision to keep agent skills local and out
of version control.

## Context

Suka needs repeatable engineering behavior across architecture, backend, dashboard, hosted platform, and quality review work. Codex skills can package task-specific instructions, references, and optional resources for repeated workflows.

The earlier repository strategy considered checking Codex skill files into the
repo, but that would couple the public codebase to one tool's local discovery
format.

## Decision

Do not track `.agent/` or `.agents/` content in the Suka repository. Treat agent
skills, prompts, and tool-specific working memory as local developer
configuration.

Keep durable project guidance in repository-owned documentation instead:

- `docs/architecture/` for accepted design decisions.
- `docs/wiki/` for contributor and operator guidance.
- `README.md` for the public product entrypoint.

## Consequences

Agent-specific skills can still exist on a contributor's machine, but they are not
part of the open source codebase. Project standards now live in normal docs so
every contributor can review them without depending on one AI tool's local skill
format.
