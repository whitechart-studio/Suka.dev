# ADR 0002: Codex Skills Strategy

## Status

Accepted

## Context

Suka needs repeatable engineering behavior across architecture, backend, dashboard, hosted platform, and quality review work. Codex skills are the right mechanism because they package task-specific instructions, references, and optional resources for repeated workflows.

OpenAI's Codex Skills documentation says repo-scoped skills are discovered from `.agents/skills` and that Codex uses progressive disclosure: it starts with skill metadata and loads full instructions only when a skill is selected.

## Decision

Store Suka project skills in:

```text
.agents/skills/
```

Maintain these skills:

- `suka-architecture`
- `suka-backend`
- `suka-dashboard`
- `suka-hosted-platform`
- `suka-quality-review`

Each skill must keep trigger descriptions concise and front-loaded. Long details must move into `references/` so Codex can load them only when needed.

## Consequences

Future Codex sessions launched inside the repository can discover and use Suka-specific skills automatically. The project now has a practical way to preserve engineering discipline across many AI-assisted coding sessions.
