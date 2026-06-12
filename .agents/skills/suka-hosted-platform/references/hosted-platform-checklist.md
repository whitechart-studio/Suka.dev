# Hosted Platform Checklist

## Configuration

- `SUKA_DEPLOYMENT_MODE`
- `SUKA_PUBLIC_URL`
- `SUKA_AUTH_TOKEN` or token provider
- `SUKA_DATABASE_URL`
- retention window
- WebSocket heartbeat and timeout settings

## HTTP Operational Endpoints

- `GET /healthz`: process is alive
- `GET /readyz`: database and required dependencies are reachable
- `GET /metrics`: optional, gated if exposed

## Tenancy

Every persisted pointer should be scoped to:

- workspace ID
- repo ID
- agent ID

Avoid global queries except admin/ops paths.

## Security

- Authenticate HTTP and WebSocket connections in non-local modes.
- Never log auth tokens.
- Redact likely secrets from event summaries before persistence.
- Keep audit logs for auth failures, admin actions, retention deletes, and export operations.
- Define retention defaults before cloud launch.

## Deployment

Self-hosted should support:

- Docker image
- example compose file
- Postgres
- reverse proxy / HTTPS assumptions documented
- health checks
- persistent volume for SQLite local installs
