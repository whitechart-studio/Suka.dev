# Release Readiness

## MVP Release Bar

- `suka init`, `suka serve`, `suka task`, `suka claim`, `suka status`, and `suka dashboard` work locally.
- MCP server exposes active work, presence update, claim, release, conflict check, relevant context, decision proposal, and completion tools.
- Dashboard shows Live Room, Timeline, Conflict Radar, and Decisions from real server state.
- SQLite data survives restart.
- Presence and claims expire predictably.
- Basic path/API/schema/env conflict checks are tested.

## Self-Hosted Release Bar

- Docker image builds reproducibly.
- Health and readiness endpoints exist.
- Auth is required outside local mode.
- Workspace/repo isolation is tested.
- Postgres adapter passes the same service tests as SQLite.
- Retention controls are documented and tested.

## Cloud Release Bar

- Organization and project membership model exists.
- GitHub OAuth/app integration threat model is documented.
- Billing is isolated from protocol semantics.
- Customer data retention and deletion flows are tested.
- Audit logs cover auth, admin, export, and deletion events.
