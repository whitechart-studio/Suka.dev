# Project Configuration

Suka repositories use `.suka/config.json` to define project identity, privacy posture, ignored paths, and optional domain mapping.

## Example

```json
{
  "version": 1,
  "repo": "whitechart-studio/Suka.dev",
  "mode": "local",
  "server_url": "http://127.0.0.1:4366",
  "data_file": ".suka/state.json",
  "platform": {
    "workspace_id": "local-whitechart-studio-suka-dev",
    "repo_id": "whitechart-studio-suka-dev",
    "public_base_url": "http://127.0.0.1:4366",
    "auth_required": false,
    "auth_token_env": "SUKA_AUTH_TOKEN",
    "retention_days": 30,
    "audit_log_enabled": false
  },
  "ignored_paths": ["node_modules/**", "dist/**", "coverage/**", ".git/**"],
  "domains": [
    {
      "id": "billing",
      "name": "Billing",
      "paths": ["src/billing/**"],
      "apis": ["POST /api/payments"],
      "tables": [],
      "env": []
    }
  ],
  "privacy": {
    "publish_file_paths": true,
    "publish_code_content": false,
    "publish_terminal_logs": false
  }
}
```

## Modes

- `local`: default mode for a repo-local server and `.suka/state.json`.
- `self_hosted`: reserved for team-controlled deployments.
- `hosted`: reserved for future Suka-hosted workspaces.

## Platform Identity

The `platform` block prepares Suka for local, self-hosted, and hosted deployments without storing secrets:

- `workspace_id`: stable workspace identifier used for future tenancy boundaries.
- `repo_id`: stable repository identifier inside the workspace.
- `team_id`: optional team identifier for self-hosted or hosted workspaces.
- `public_base_url`: URL agents and teammates should use to reach the Suka server.
- `auth_required`: whether HTTP and WebSocket clients must authenticate.
- `auth_token_env`: environment variable name that stores the token value. The token itself must not be committed.
- `retention_days`: default coordination-state retention window.
- `audit_log_enabled`: whether admin/security actions should be auditable.

Local mode defaults to `auth_required: false`, 30-day retention, and audit logging off. Self-hosted and hosted mode require auth, and default to 90-day retention and audit logging on.

## Privacy Defaults

Suka stores coordination metadata by default. It must not store source code content, private prompts, raw terminal logs, or chain-of-thought in project config or pointer state.

The default privacy settings allow file path metadata because path-level coordination is the core product primitive:

```json
{
  "publish_file_paths": true,
  "publish_code_content": false,
  "publish_terminal_logs": false
}
```

## Domain Mapping

Domains let teams name the parts of a repository that agents should coordinate around. A domain must have a unique `id` and at least one scope value across `paths`, `apis`, `tables`, or `env`.

Examples:

- `billing`: `src/billing/**`, `POST /api/payments`
- `dashboard`: `apps/dashboard/**`
- `database`: tables such as `payments`, `users`, or `audit_log`

## Goals

- Let teams define their own domain map.
- Keep generated/vendor files out of coordination state.
- Make privacy behavior explicit.
- Support local, hosted, and self-hosted modes.
