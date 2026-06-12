# CLI and Agent Pointers

Suka represents coordination state as pointers.

## Pointer Types

- `presence`: an agent is active and working.
- `claim`: an agent has claimed a scope.
- `event`: something happened in the workflow.
- `decision`: a durable technical decision.

## Presence

Presence should answer:

- Which agent is active?
- Which tool is it using?
- What task is it working on?
- Which branch is it on?
- Which files are currently in focus?

## Claims

Claims can cover:

- Paths.
- APIs.
- Database tables.
- Environment variables.
- Product/domain areas.

## Conflict Checks

The conflict engine detects overlaps between planned work and existing claims.

Examples:

- Two agents editing the same path family.
- API endpoint overlap.
- Shared domain scope overlap.

## Next CLI Work

The next major task is live agent presence publishing so Codex, Cursor, terminal agents, and future adapters can publish state automatically.

