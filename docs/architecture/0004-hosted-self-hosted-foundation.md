# Hosted And Self-Hosted Foundation

## Status

Accepted

## Context

Suka starts as a local-first coordination layer, but teams need a path to shared self-hosted servers and optional hosted workspaces. The platform model must preserve localhost usage while making workspace identity, repository identity, token boundaries, retention, and audit posture explicit.

## Deployment Modes

Suka uses one shared project configuration contract for all modes:

- `local`: default developer-machine mode. Auth is disabled by default, `.suka/state.json` remains the state file, and the dashboard is expected to run from localhost.
- `self_hosted`: team-controlled server mode. Auth is required by default, workspace and repo IDs are explicit, audit logging defaults on, and retention defaults to 90 days.
- `hosted`: future Suka-managed cloud mode. It follows the same platform contract as self-hosted mode, with organization/project/billing concepts added later.

## Platform Config Contract

`.suka/config.json` includes a `platform` block:

```json
{
  "workspace_id": "local-suka-dev",
  "repo_id": "suka-dev",
  "team_id": "core",
  "public_base_url": "http://127.0.0.1:4366",
  "auth_required": false,
  "auth_token_env": "SUKA_AUTH_TOKEN",
  "retention_days": 30,
  "audit_log_enabled": false
}
```

The token value itself is never stored in config. Agents, CLIs, and future hosted clients should read it from the environment variable named by `auth_token_env`.

## Security And Privacy

- Local mode keeps auth optional to avoid breaking the local developer loop.
- Self-hosted and hosted modes default `auth_required` to `true`.
- Self-hosted and hosted modes default `audit_log_enabled` to `true`.
- Retention defaults to 30 days in local mode and 90 days outside local mode.
- Source code content, private prompts, terminal logs, and secrets remain outside pointer/config state.

## Auth Boundary

`local` mode may run without auth. `self_hosted` and `hosted` configs must validate with `auth_required: true`; the token value itself stays outside config and is loaded from the environment variable named by `auth_token_env`. Future HTTP and WebSocket middleware should reject missing or invalid tokens before reading or mutating workspace state.

## Storage Path

The current file store remains valid for local mode. Self-hosted and hosted storage should use the same service interfaces, with workspace and repo identity available before a Postgres adapter is introduced.

Postgres migration should preserve the local data model first: each persisted record gains `workspace_id` and `repo_id`, then storage adapters can map the same service calls to tables keyed by those IDs. SQLite/file storage remains the local adapter; Postgres becomes the self-hosted/hosted adapter once auth and workspace isolation are enforced at the service boundary.

## Consequences

- Existing legacy configs normalize into safe platform defaults.
- Future HTTP/WebSocket auth can be implemented against the shared config contract.
- Dashboard team connection UI can move from local-only state toward server-backed workspace identity without changing the product model.
