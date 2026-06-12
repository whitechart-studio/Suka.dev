---
name: suka-hosted-platform
description: Hosted and self-hosted platform architecture guidance for Suka.dev. Use when Codex designs or implements deployment mode, team workspaces, auth tokens, repo/workspace IDs, Postgres migration, Docker packaging, cloud readiness, tenancy, retention, audit logs, or hosted SaaS boundaries for Suka.
---

# Suka Hosted Platform

## Overview

Use this skill when moving Suka beyond localhost while preserving local-first value. The platform path is local MVP, then self-hosted team mode, then optional hosted cloud.

## Deployment Modes

Model deployment mode explicitly:

```text
local | self_hosted | cloud
```

Local mode:

- one developer machine
- SQLite
- optional auth disabled by default
- localhost dashboard and MCP endpoint

Self-hosted mode:

- shared team server
- Docker-first deploy
- Postgres-ready storage
- auth token required
- workspace and repo IDs required

Cloud mode:

- managed hosted Suka
- organizations, projects, invites, billing, retention controls, audit logs
- GitHub OAuth and app integration later

Platform support:

- Windows, Linux, and macOS: CLI, MCP server, local server, file watcher, dashboard access
- iOS/iPadOS: dashboard/PWA client, notifications later, no local server requirement
- Linux containers: primary self-hosted deployment target

## Architecture Rules

- Do not break local mode to support hosted mode.
- Keep deployment configuration outside protocol objects.
- Add workspace and repo IDs before adding organization billing concepts.
- Make auth middleware optional in local mode and mandatory in team/cloud modes.
- Design storage through repository interfaces so SQLite and Postgres can share service behavior.
- Keep WebSocket auth and HTTP auth consistent.
- Treat all user-facing summaries, repo paths, branch names, and event metadata as sensitive customer data in cloud mode.
- Keep deployment scripts and docs cross-platform; put Linux-only behavior behind Docker or clearly marked server deployment paths.

## Hosted Implementation Order

1. Add `workspace_id` and `repo_id` to persisted records where needed.
2. Add server config for deployment mode and public base URL.
3. Add token auth for HTTP and WebSocket.
4. Add Docker packaging and health checks.
5. Add Postgres adapter behind storage interfaces.
6. Add retention controls.
7. Add audit events for admin/security actions.
8. Add cloud-only org/project/billing after self-hosted mode works.

## Verification

Hosted changes must include tests for:

- local mode without auth
- team mode requiring auth
- workspace/repo isolation
- WebSocket authorization failure
- storage adapter parity for core pointer flows
- health check and graceful shutdown behavior

Load `references/hosted-platform-checklist.md` for detailed review.
