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

Publish a one-shot presence update:

```bash
node packages/cli/dist/bin.js presence \
  --agent codex-local \
  --tool codex \
  --status editing \
  --task "Implement live presence publishing" \
  --file packages/cli/src/commands.ts \
  --file packages/cli/src/commands.test.ts
```

Run as a heartbeat publisher:

```bash
node packages/cli/dist/bin.js presence \
  --agent codex-local \
  --tool codex \
  --status editing \
  --task "Work on Suka" \
  --watch \
  --interval 15
```

If `--repo`, `--branch`, or `--file` are omitted, the CLI attempts to detect them from the local Git repository. Repeated `--file` flags and comma-separated file lists are both supported.

## Claims

Claims can cover:

- Paths.
- APIs.
- Database tables.
- Environment variables.
- Product/domain areas.

## Decisions

Decisions are durable project memory. They should capture accepted engineering constraints, architectural choices, and project rules that future agents should respect before editing related areas.

Record an accepted decision:

```bash
node packages/cli/dist/bin.js decision "Webhook handlers must be idempotent" \
  --body "Payment webhook handlers must tolerate duplicate delivery." \
  --path "src/billing/**" \
  --evidence docs/payments.md \
  --agent codex-local \
  --approved-by trent
```

Accepted decisions require at least one evidence reference. Decision scope can use `--path`, `--api`, `--table`, `--env`, or `--domain`.

The server also exposes:

- `GET /api/decisions`
- `POST /api/decisions`

## Conflict Checks

The conflict engine detects overlaps between planned work and existing claims.

Examples:

- Two agents editing the same path family.
- API endpoint overlap.
- Shared domain scope overlap.
