# Architecture

Suka is designed as a local-first coordination system that can grow into hosted and self-hosted team workspaces.

## Packages

- `packages/protocol`: shared pointer types, constants, and validation.
- `packages/conflict-engine`: path/API/domain overlap detection.
- `apps/server`: local HTTP server, persistence, repo map, and dashboard serving.
- `packages/cli`: command-line interface for publishing and reading coordination state.
- `apps/dashboard`: React dashboard for the operations canvas.

## Runtime Shape

```text
Agents / CLI
    |
    v
Suka Server
    |
    +-- Protocol validation
    +-- Conflict engine
    +-- File-backed local state
    +-- Repo map
    |
    v
Dashboard
```

## Design Principles

- Local-first by default.
- Explicit claims instead of invisible agent behavior.
- Realtime awareness before merge-time conflict.
- Repo-aware coordination, not generic chat.
- Human-readable state and contracts.
- Hosted mode must preserve a self-hosted path.

## Near-Term Architecture Work

- Agent presence publishing.
- Project config through `.suka/config.json`.
- More intelligent repo relationship parsing.
- Hosted/team workspace model.

## Realtime Endpoint

The local server exposes a WebSocket endpoint at:

```text
ws://<host>:<port>/api/realtime
```

On connection, the server sends:

```json
{
  "type": "state.bootstrap",
  "data": {
    "presence": [],
    "claims": [],
    "events": [],
    "decisions": []
  }
}
```

State-changing HTTP routes then broadcast messages such as:

- `pointer.published`
- `claim.released`
- `state.expired`
