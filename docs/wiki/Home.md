# Suka.dev Wiki

Suka.dev is an open-source coordination layer for teams running multiple AI coding agents in the same codebase.

It helps a team answer the operational questions that matter during agentic development:

- Who is active?
- What is each agent working on?
- Which files, APIs, or domains are claimed?
- Where are conflicts likely?
- What decisions should agents respect before editing?

## Core Concepts

- **Agent presence**: a live signal showing an agent, tool, task, branch, and active files.
- **Claims**: temporary work ownership over paths, APIs, tables, env keys, or domains.
- **Conflict radar**: warnings when planned work overlaps with existing claims or risky areas.
- **Repo map**: a visual map of the repository and active coordination signals.
- **Decision memory**: shared technical decisions that agents and humans should follow.

## Start Here

1. [[Getting Started]]
2. [[Architecture]]
3. [[Dashboard]]
4. [[CLI and Agent Pointers]]
5. [[Self-Hosting]]
6. [[Security and Privacy]]
7. [[Release Workflow]]
8. [[Roadmap]]

## Current Status

Suka is in early foundation stage. The repository includes:

- TypeScript monorepo structure.
- Protocol validation package.
- Conflict engine package.
- Local HTTP server.
- CLI package.
- React dashboard with repo map and inspector.
- Docker self-hosting path.
- Project-specific Codex skills.
- Visual QA script for the dashboard.
