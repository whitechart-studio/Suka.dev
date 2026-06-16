# Roadmap

Suka is moving toward a professional coordination layer for AI-assisted engineering teams. The roadmap is intentionally product-led: each increment should make parallel agent work clearer, safer, and easier to hand off.

GitHub Issues and pull requests track execution. This page tracks product direction, shipped foundation, and the next high-value work.

## Product Sentence

Suka is the live handoff and coordination layer for AI-assisted engineering. Worktrees isolate code; Suka coordinates context, ownership, and intent.

## Shipped Foundation

- Typed pointer protocol for presence, claims, events, decisions, briefs, and project configuration.
- Conflict engine for path, API, domain, table, and environment-key overlap.
- Scoped coordination context with `workspace_id`, `repo_id`, and `session_id`.
- Local HTTP and WebSocket server with in-memory and file-backed state.
- CLI workflow for sessions, presence, claims, blocked scopes, conflicts, decisions, briefs, reminders, and cleanup.
- Dashboard operations canvas with repo domains, agents, claims, Current Truth, team connection, and inspector panels.
- Repo map intelligence for package relationships, source imports, package names, route hints, and test counts.
- PR gate, CI/CD, Docker build validation, CodeQL, npm audit, Danger policy checks, and reviewdog diff hygiene.
- Open-source README, wiki source, social preview assets, and contribution guidance.

## Current Priorities

### 1. Repo Intelligence

Goal: make the dashboard understand the codebase well enough to guide agents before they start editing.

Next useful increments:

- Detect routes with method metadata, not only path strings.
- Extract package dependency direction and edge reasons for dashboard tooltips.
- Add test coverage hints per domain, including nearest tests for changed files.
- Identify high-risk files such as config, schema, auth, deployment, and shared protocol files.

Done means the repo map can explain why an area matters, not only where it sits.

### 2. Shared Truth Workflow

Goal: make briefs, decisions, and recent events the default handoff path between agents.

Next useful increments:

- Show latest brief per session directly on the canvas.
- Add stale-context warnings when a selected domain changed after an agent's last presence.
- Add brief quality checks for missing assumptions, risks, or next action.
- Let `suka remind` point to the exact missing shared-truth action.

Done means the next agent can open Suka and understand what changed, what was decided, and what to avoid.

### 3. Ownership Boundaries

Goal: make claims and blocked scopes feel like a lightweight coordination contract.

Next useful increments:

- Show ownership boundaries before claim creation.
- Add domain-level claim suggestions from changed files.
- Add release and extend flows for expiring claims.
- Improve conflict explanations with owner, reason, scope, and expected expiry.

Done means agents can see who owns what before touching a file.

### 4. Team Connection

Goal: make local, self-hosted, and future hosted team use feel consistent.

Next useful increments:

- Add a clearer workspace/session switcher.
- Show connected team members by workspace, repo, and session.
- Add invite and join copy that works for local and self-hosted teams.
- Define the hosted workspace contract without weakening local-first privacy.

Done means a small team can coordinate multiple agents without reading setup docs every time.

### 5. Production Hardening

Goal: keep the project trustworthy as it grows.

Next useful increments:

- Add structured observability for server state changes.
- Add dashboard visual regression checks to CI when stable enough.
- Define release versioning and changelog workflow.
- Add security notes for hosted mode, retention, and metadata boundaries.

Done means contributors can change the system confidently and reviewers can trust the gate.

## Not In Scope Yet

- Replacing coding agents or generating code directly.
- Storing prompts, transcripts, raw source content, or terminal logs.
- Enforcing hard file locks.
- Building hosted billing, organizations, or enterprise administration before the local and self-hosted workflow is strong.

## Decision Rules

Prioritize work that:

- reduces stale reads between agents
- makes ownership and intent visible
- improves handoff quality
- keeps local-first and self-hosted use viable
- strengthens CI, security, and cross-platform reliability

Defer work that is mostly cosmetic, requires hosted assumptions too early, or adds complex automation before the coordination contract is clear.
