# Self-Hosting

Suka can run as a local server or as a small self-hosted service for a team workspace. The current self-host path is Docker-first and keeps state in a mounted data volume.

## Docker Compose

Build and start the server:

```bash
docker compose up --build
```

Open:

```text
http://127.0.0.1:4366/
```

The compose service stores state at `/data/state.json` inside the container and persists it in the `suka-data` volume.

## Runtime Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUKA_HOST` | `0.0.0.0` in Docker, `127.0.0.1` locally | Interface the server binds to. |
| `SUKA_PORT` | `4366` | HTTP and WebSocket port. |
| `SUKA_DATA_FILE` | `/data/state.json` in Docker | File-backed coordination state. |

## Health Check

The server exposes:

```text
GET /healthz
```

Docker uses that endpoint for the image health check.

## Operational Notes

- Run the container behind a trusted reverse proxy for shared team access.
- Treat agent IDs, task summaries, branch names, paths, and event metadata as sensitive workspace data.
- Back up the mounted data volume before upgrades.
- Keep `SUKA_DATA_FILE` on persistent storage; otherwise coordination state is ephemeral.
- Hosted and self-hosted auth enforcement will build on the platform config contract documented in Project Configuration.
