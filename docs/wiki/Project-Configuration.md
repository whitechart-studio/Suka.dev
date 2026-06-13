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
