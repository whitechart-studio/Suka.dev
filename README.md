# Suka

**See what every AI coding agent is working on before the work collides.**

Suka is an open-source coordination layer for teams running multiple AI coding agents on the same repository. It gives agents and developers a shared, realtime view of active work, affected files, API changes, test failures, blockers, and accepted engineering decisions.

Suka is being built for teams that want agentic development to become more observable, coordinated, and safe without standardizing on one AI coding tool.

## Why Suka

AI-assisted development is becoming parallel. A backend agent may be changing a payment API while a frontend agent is building checkout. A third agent may be adding a migration while another writes code against the old schema. A test failure may be discovered in one session while another agent continues related work without knowing.

Git records the final code changes, but it does not coordinate work while it is happening. Chat tools help humans talk, but agents need structured context they can read, publish, and act on.

Suka exists to make that live coordination layer explicit.

## What Suka Does

Suka lets agents and developer tools publish small structured coordination signals. These signals describe what is happening in the repository right now and what future agents should know before editing.

Core capabilities:

- realtime presence for active agents and developers
- soft claims on files, modules, APIs, schemas, and domains
- project events for API changes, test results, blockers, and task progress
- conflict warnings for overlapping work
- durable engineering decisions with evidence and scope
- a dashboard for human visibility
- MCP tools for agent-facing coordination
- local-first operation with a path to self-hosted team usage

## Pointers

A **pointer** is a structured coordination signal.

Examples:

- “I am editing `src/billing/webhook.ts`.”
- “I am claiming `src/billing/**` for the next 45 minutes.”
- “`POST /api/payments` changed.”
- “`billing/webhook.test.ts` is failing.”
- “Webhook handlers must be idempotent.”

Suka stores and broadcasts pointers so other agents and developers can react before work diverges.

Pointer types:

| Pointer | Purpose |
| --- | --- |
| Presence | Live status, task, branch, and current files |
| Claim | Advisory claim on files, APIs, domains, or modules |
| Event | Important activity such as API changes, test failures, blockers, or task completion |
| Decision | Durable project memory backed by evidence and approval state |

Claims are not locks. Suka warns about risk without taking control away from developers.

## Example Workflows

### Preventing Overlapping Work

An agent starts a billing task and claims:

```text
task: Implement Stripe webhook handling
paths: src/billing/**
status: editing
```

Another agent begins modifying:

```text
src/billing/invoice.ts
```

Suka can surface:

```text
severity: medium
reason: path_overlap
message: Active billing work overlaps src/billing/invoice.ts
```

The second agent can warn the developer, request confirmation, or check recent billing context before continuing.

### Catching API Contract Drift

A backend agent changes a payment route:

```text
event_type: api_contract_changed
affected_apis: POST /api/payments
summary: Payment creation response now includes risk_review status
```

A frontend agent working on checkout can query Suka and discover that its payment client may need to update before more code is generated against the old response shape.

### Sharing Test Failures

An agent runs tests and publishes:

```text
event_type: test_failed
affected_paths: tests/billing/webhook.test.ts
summary: Duplicate webhook delivery is not idempotent
```

That failure becomes shared project context instead of staying inside one terminal, editor, or chat session.

### Preserving Engineering Decisions

The team accepts:

```text
title: Webhook handlers must be idempotent
scope: src/billing/**, src/webhooks/**
evidence: docs/payments.md, src/billing/webhook.ts
```

Future agents can retrieve the decision before modifying billing or webhook code.

## Who Suka Is For

Suka is intended for:

- engineering teams using multiple AI coding agents in the same repository
- maintainers reviewing agent-generated contributions
- hackathon teams coordinating fast parallel work
- AI tool builders looking for a neutral coordination protocol
- companies that want self-hosted visibility into agent activity without storing private prompts

## What Suka Is Not

Suka is not:

- an AI code generator
- a replacement for Git or GitHub
- a project management suite
- a prompt logger or chat transcript store
- a hard-locking system that prevents developers from editing files
- a tool tied to one editor, model provider, or coding agent

Suka coordinates work. It does not write the code for you.

## Architecture Direction

Suka is designed around a small set of components:

```text
Developer / Agent
      |
      v
CLI or MCP server
      |
      v
Suka server
      |
      +-- persistence
      +-- WebSocket broadcaster
      +-- conflict engine
      +-- web dashboard
```

Planned components:

- **Protocol**: shared pointer schemas and validation
- **Server**: HTTP API, WebSocket updates, persistence, expiration, and coordination logic
- **Conflict engine**: deterministic checks for path, API, schema, branch, and environment overlap
- **MCP server**: agent-facing tools for context lookup, conflict checks, and pointer publishing
- **CLI**: local setup, task publishing, claims, status, and dashboard launch
- **Dashboard**: live room, repo map, timeline, conflict radar, and decisions

## Design Targets

Suka is being designed for:

- local-first development
- self-hosted team deployments
- future hosted service compatibility
- Windows, Linux, and macOS support for developer workflows
- Linux containers for production self-hosting
- iOS and iPadOS dashboard access through responsive web/PWA support

## Design Principles

- **Neutral protocol**: support multiple agents, editors, and model providers.
- **Metadata over transcripts**: store structured coordination data, not private prompts, chain-of-thought, or raw terminal logs.
- **Advisory coordination**: warn about risk without blocking human judgment.
- **Local-first foundation**: provide value before requiring cloud infrastructure.
- **Self-hostable by default**: allow teams to control repository metadata.
- **Typed boundaries**: keep protocol objects explicit and validated across CLI, server, MCP, and dashboard.
- **Cross-platform discipline**: avoid assumptions that only work on one operating system.

## Current Status

Suka is in early architecture and product development. The initial repository is being prepared as an open-source infrastructure project with a local-first core and a clear path to self-hosted team usage.

No stable release is available yet.

## Open Source Resources

- Wiki source: [`docs/wiki`](docs/wiki)
- Architecture notes: [`docs/architecture`](docs/architecture)
- PR gate and CI/CD standards: [`docs/engineering/pr-gate.md`](docs/engineering/pr-gate.md)
- Social preview template: [`docs/assets/social-preview.svg`](docs/assets/social-preview.svg)
- Social preview image: [`docs/assets/social-preview.png`](docs/assets/social-preview.png)

## License

This project is pre-release. License selection is pending.
