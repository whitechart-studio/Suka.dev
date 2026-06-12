# Suka Backend Contracts

## Pointer Status Values

Presence status values:

- online
- idle
- planning
- reading
- editing
- running_tests
- debugging
- blocked
- waiting_for_human
- complete

Decision status values:

- proposed
- accepted
- rejected
- deprecated
- stale

## Event Types

- task_started
- task_updated
- task_completed
- files_claimed
- files_released
- file_modified
- api_contract_changed
- database_schema_changed
- env_var_added
- test_started
- test_failed
- test_passed
- blocker_found
- decision_proposed
- decision_accepted
- pr_opened
- branch_merged

## HTTP API Sketch

- `GET /api/state`
- `GET /api/agents`
- `GET /api/presence`
- `GET /api/claims`
- `GET /api/events`
- `GET /api/decisions`
- `POST /api/presence`
- `POST /api/claims`
- `DELETE /api/claims/:id`
- `POST /api/events`
- `POST /api/decisions`
- `PATCH /api/decisions/:id`
- `POST /api/conflicts/check`

## WebSocket Events

- `presence.updated`
- `claim.created`
- `claim.released`
- `claim.expired`
- `event.created`
- `decision.proposed`
- `decision.accepted`
- `conflict.detected`

## Conflict Result Shape

Prefer this shape for conflict responses:

```json
{
  "severity": "medium",
  "reason": "path_overlap",
  "message": "Active claim overlaps src/billing/invoice.ts",
  "matched_scope": {
    "paths": ["src/billing/**"]
  },
  "pointers": ["ptr_02"]
}
```

Severity values:

- `low`: nearby file, same domain, weak overlap
- `medium`: same module, glob match, API dependency
- `high`: same file, schema/table, route, or env var
