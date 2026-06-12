# Suka Blueprint

## 0. Brand Identity

Product name:

> Suka

Brand phrase:

> The Agent Pointer

Meaning:

Suka is a modern, shortened brand inspired by the Sanskrit word **Suchaka**, which means an indicator, pointer, or informer.

Why it fits:

- agents point to what they are doing
- agents point out conflicts
- agents point other agents to useful context
- the dashboard points humans to live project activity

Tagline options:

- Suka: The Agent Pointer
- Suka: Realtime pointers for AI coding agents
- Suka: See what every agent is working on
- Suka: Live coordination for agentic coding teams
- Suka: Google Docs-style presence for AI coding agents

## 1. One-Line Definition

Suka is an open-source realtime coordination layer for teams using multiple AI coding agents on the same repository.

It gives every developer and every agent shared awareness of:

- who is working on what
- which files, modules, APIs, schemas, and tasks are active
- what decisions or blockers appeared
- where conflicts may happen
- what context future agents should remember

The simplest analogy:

> Google Docs presence + GitHub activity + CI signals + MCP for AI coding agents.

## 2. Core Problem

Modern teams are starting to code with multiple AI agents at the same time:

- one developer uses Codex
- another uses Cursor
- another uses Claude Code
- another uses Copilot
- another uses OpenHands, Aider, or a custom agent

Each agent works in its own isolated context. Even when the humans are on the same GitHub repo, the agents usually do not know what the others are doing.

This creates problems:

- two agents edit the same file or module without knowing
- frontend agent builds against an API while backend agent changes the contract
- one agent adds a migration while another writes old-schema logic
- decisions made in one session do not reach other sessions
- test failures discovered by one agent are invisible to the others
- hackathon teams lose time coordinating manually
- open-source contributors using different tools have no shared agent context

## 3. Product Thesis

The future of software development will involve many agents working in parallel, but those agents need shared awareness.

Suka should not be another AI code generator. It should be the neutral collaboration layer between coding agents.

The product thesis:

> AI coding agents need a shared realtime presence layer, just like humans needed realtime cursors, comments, and activity feeds in collaborative documents.

## 4. What Suka Is

Suka is:

- a local/self-hosted realtime server for repo activity
- a CLI developers can use directly
- an MCP server agents can call
- a web dashboard for live visualization
- a lightweight protocol for agent coordination
- a durable memory store for accepted decisions

Suka is not:

- a replacement for GitHub
- a replacement for Cursor, Codex, Claude Code, or Copilot
- a full project management tool
- a raw chat logger
- a tool that stores private prompts or secrets

## 5. Main Product Concept: Pointers

A pointer is a structured signal that an agent publishes.

Examples:

- I am working on this task.
- I am editing these files.
- I am changing this API.
- I claimed this module temporarily.
- I found this test failure.
- I made this architectural decision.
- I depend on another branch or task.
- I am blocked by this missing information.
- I completed this task.

The name Suka works because the product turns invisible agent activity into visible pointers.

## 6. Core Object Types

### 6.1 Presence Pointer

Temporary live state. Expires quickly.

```json
{
  "type": "presence",
  "id": "ptr_01",
  "agent_id": "codex-trent-01",
  "user_id": "trent",
  "tool": "codex",
  "repo": "acme/webapp",
  "branch": "feat/stripe-webhook",
  "task": "Add Stripe webhook handling",
  "status": "editing",
  "current_files": ["src/billing/webhook.ts"],
  "last_seen": "2026-06-11T12:20:00Z",
  "expires_at": "2026-06-11T12:22:00Z"
}
```

Statuses:

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

### 6.2 Claim Pointer

A soft claim on an area of work. This is not a hard lock.

```json
{
  "type": "claim",
  "id": "ptr_02",
  "agent_id": "codex-trent-01",
  "scope": {
    "paths": ["src/billing/**", "migrations/*billing*"],
    "apis": ["POST /webhooks/stripe"],
    "domains": ["billing", "payments"]
  },
  "reason": "Implementing Stripe webhook and billing events",
  "kind": "soft_claim",
  "created_at": "2026-06-11T12:20:00Z",
  "expires_at": "2026-06-11T13:00:00Z"
}
```

Rules:

- claims expire automatically
- claims warn other agents
- claims do not block human choice
- claims can be extended
- claims can be released

### 6.3 Event Pointer

An important update in the project.

```json
{
  "type": "event",
  "id": "ptr_03",
  "event_type": "contract_changed",
  "summary": "Added POST /webhooks/stripe endpoint",
  "affected_paths": ["src/routes/webhooks.ts"],
  "affected_apis": ["POST /webhooks/stripe"],
  "agent_id": "codex-trent-01",
  "created_at": "2026-06-11T12:31:00Z"
}
```

Event types:

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

### 6.4 Decision Pointer

A durable memory item. This should be evidence-backed.

```json
{
  "type": "decision",
  "id": "ptr_04",
  "title": "Webhook handlers must be idempotent",
  "body": "All payment webhook handlers should handle duplicate delivery safely.",
  "scope": {
    "paths": ["src/billing/**", "src/webhooks/**"],
    "domains": ["billing"]
  },
  "status": "accepted",
  "confidence": "high",
  "evidence": [
    "src/billing/webhook.ts",
    "docs/payments.md"
  ],
  "created_by": "codex-trent-01",
  "approved_by": "trent",
  "created_at": "2026-06-11T12:40:00Z"
}
```

Decision statuses:

- proposed
- accepted
- rejected
- deprecated
- stale

## 7. User Personas

### 7.1 Hackathon Team

Needs:

- move fast
- avoid duplicate work
- see progress visually
- coordinate frontend/backend/AI tasks
- impress judges with a live dashboard

Value:

- projector-friendly command center
- live activity timeline
- conflict radar
- visible agent collaboration

### 7.2 Startup Engineering Team

Needs:

- multiple developers using different AI coding tools
- shared repo conventions
- conflict warnings
- audit trail of agent decisions

Value:

- works without forcing one AI vendor
- can self-host
- reduces coordination overhead

### 7.3 Open-Source Maintainer

Needs:

- contributors use many tools
- avoid inconsistent agent-generated changes
- track proposed decisions
- expose repo context to all agents

Value:

- `.suka/` repo config
- MCP server for any compatible agent
- accepted memory and active coordination

### 7.4 AI Tool Builder

Needs:

- a neutral protocol for sharing agent status
- easy integration
- realtime repo-level state

Value:

- simple HTTP/WebSocket/MCP API
- standard event schema

## 8. Product Surfaces

### 8.1 CLI

The CLI is the lowest-friction entrypoint.

Commands:

```bash
suka init
suka serve
suka join --tool codex --user trent
suka task "Add Stripe webhook"
suka claim "src/billing/**"
suka status
suka events
suka dashboard
suka complete
suka serve-mcp
```

Important CLI flows:

- initialize repo
- start local server
- publish task
- claim paths
- view active work
- check conflict risk
- open dashboard
- run MCP server

### 8.2 MCP Server

This is the main bridge for agents.

Tools:

```text
get_active_work()
set_current_task(task, status)
update_presence(status, current_files)
claim_scope(paths, apis, domains, ttl)
release_claim(claim_id)
publish_event(event_type, summary, affected_paths)
check_conflicts(paths, apis, domains)
get_relevant_context(task, paths)
propose_decision(title, body, evidence, scope)
complete_task(summary, changed_paths)
```

Resources:

```text
suka://active
suka://claims
suka://events/recent
suka://decisions/accepted
suka://context/current-task
```

Prompts:

```text
Before editing, check Suka for active claims and relevant decisions.
After changing an API, publish an api_contract_changed event.
After finding a durable convention, propose a decision with evidence.
```

### 8.3 Web Dashboard

The web dashboard is the visual heart of the product.

Primary views:

1. Live Room
2. Repo Map
3. Timeline
4. Conflict Radar
5. Decisions

#### Live Room

Shows all active humans and agents.

Fields:

- user
- agent/tool
- task
- status
- branch
- current files
- last seen

Example:

```text
Trent / Codex       Stripe webhook       editing          src/billing/webhook.ts
Maya / Cursor       Checkout UI          running tests    app/checkout/*
Ravi / Claude       Auth cleanup         blocked          src/auth/session.ts
```

#### Repo Map

Visualizes the codebase by module, folder, or domain.

States:

- inactive
- active
- claimed
- modified
- conflict risk
- tests failing
- stale decision

Suggested visual:

- tree map for folders
- graph for domains/services
- color-coded overlays for active claims

#### Timeline

Realtime event stream.

Example:

```text
12:01 Codex joined repo
12:02 Codex started "Add Stripe webhook"
12:03 Codex claimed src/billing/**
12:05 Cursor started "Checkout UI"
12:09 Conflict warning: checkout depends on billing API
12:14 Claude reported auth tests failing
12:20 Codex proposed decision: webhooks must be idempotent
```

#### Conflict Radar

Shows possible collisions:

- same file overlap
- same folder overlap
- API producer/consumer mismatch
- schema migration conflict
- env var mismatch
- test failure affecting another active task

Conflict severity:

- low: nearby file or same domain
- medium: same module or API dependency
- high: same file, schema, or route

#### Decisions

Durable memory and accepted project knowledge.

Views:

- proposed decisions
- accepted decisions
- stale decisions
- decisions by domain
- decisions by path

## 9. Conflict Detection

### 9.1 MVP Conflict Detection

Start simple:

- path overlap
- glob overlap
- same branch
- same API string
- same database table name
- same environment variable

Examples:

```text
Agent A claims src/billing/**
Agent B starts editing src/billing/invoice.ts
Warning: medium conflict risk
```

```text
Agent A publishes api_contract_changed for GET /api/payments
Agent B is editing app/checkout/payment-client.ts
Warning: possible API dependency conflict
```

### 9.2 Later Semantic Conflict Detection

Advanced features:

- parse OpenAPI specs
- parse database migrations
- parse TypeScript exported types
- detect changed function signatures
- detect frontend calls to changed backend endpoints
- use embeddings for domain overlap
- use language servers for symbol-level ownership

## 10. Data Model

Core tables:

```sql
agents(
  id text primary key,
  user_id text,
  tool text,
  display_name text,
  created_at text
)

presence(
  agent_id text primary key,
  repo text,
  branch text,
  task text,
  status text,
  current_files text,
  last_seen text,
  expires_at text
)

claims(
  id text primary key,
  agent_id text,
  paths text,
  apis text,
  domains text,
  reason text,
  created_at text,
  expires_at text
)

events(
  id text primary key,
  event_type text,
  agent_id text,
  summary text,
  payload text,
  created_at text
)

decisions(
  id text primary key,
  title text,
  body text,
  scope text,
  status text,
  confidence text,
  evidence text,
  created_by text,
  approved_by text,
  created_at text,
  updated_at text
)
```

For MVP, use SQLite. Later, support Postgres/Supabase.

## 11. Repo Directory

Suggested repo-local config:

```text
.suka/
  config.json
  decisions/
    accepted.jsonl
    proposed.jsonl
  schemas/
    pointer.schema.json
  exports/
    AGENTS.generated.md
```

Do not put noisy live presence in Git by default. Store live presence in the running server. Only durable decisions and config should live in Git.

## 12. System Architecture

MVP:

```text
Developer/Agent
      |
      v
CLI or MCP server
      |
      v
Suka local server
      |
      +--> SQLite
      +--> WebSocket broadcaster
      +--> Web dashboard
      +--> conflict engine
```

Later:

```text
Multiple developers
      |
      v
Self-hosted Suka server
      |
      +--> Postgres
      +--> Redis or pub/sub
      +--> GitHub bridge
      +--> hosted dashboard
      +--> auth
```

## 13. Realtime Design

Use WebSockets first.

Server responsibilities:

- accept presence heartbeats
- expire stale presence
- broadcast new events
- calculate conflict warnings
- store durable events and decisions
- serve dashboard state

Heartbeat:

```text
agent sends heartbeat every 15 seconds
presence expires after 60-120 seconds
claims expire after configurable TTL
```

Why not CRDT first:

- CRDTs are powerful for collaborative text/data editing
- Suka mostly needs event streams and ephemeral presence
- plain WebSocket + SQLite is simpler for MVP

Add Yjs/CRDT later if collaborative editing of decisions becomes central.

## 14. Privacy and Safety

Never store by default:

- full prompts
- chain-of-thought
- secrets
- raw terminal logs
- full chat history
- API keys
- private customer data

Store only structured metadata:

- task name
- file paths
- branch
- status
- event summaries
- accepted decisions
- evidence file references

Safety features:

- secret pattern detection before event publish
- redaction hooks
- local-first mode
- self-host mode
- no mandatory cloud account
- event retention controls

## 15. Agent Integration Strategy

### 15.1 Integration Level 1: Manual CLI

Humans manually run:

```bash
suka task "Build checkout page"
suka claim "app/checkout/**"
```

Good for early testing.

### 15.2 Integration Level 2: MCP

Agents call Suka tools.

This is the main open-source wedge.

Example agent instruction:

```text
Before editing files, call check_conflicts with likely affected paths.
When starting work, call set_current_task.
When editing a module for more than a few minutes, call claim_scope.
When changing an API, call publish_event.
When done, call complete_task.
```

### 15.3 Integration Level 3: File Watcher

Local daemon watches Git working tree and updates current files.

Signals:

- changed files from Git status
- active branch
- uncommitted diffs
- test commands running if launched through wrapper

### 15.4 Integration Level 4: Native Tool Plugins

Later:

- Cursor extension
- VS Code extension
- OpenHands plugin
- GitHub app
- browser dashboard plugin

## 16. Hackathon Demo Plan

The demo should be visual and fast.

Setup:

- one repo
- two or three worktrees
- three simulated agents
- dashboard on screen

Scenario:

1. Agent A starts backend billing work.
2. Agent B starts frontend checkout work.
3. Agent A claims `src/billing/**`.
4. Agent B edits checkout client that depends on billing API.
5. Agent A publishes `api_contract_changed`.
6. Dashboard shows conflict warning.
7. Agent C runs tests and publishes failing test.
8. Agent B gets relevant context before continuing.
9. Agent A completes task and publishes decision.

Judge-visible wow moment:

```text
The dashboard lights up with live agents, claimed files, conflict warning, and accepted decision.
```

## 17. MVP Scope

### Must Have

- CLI
- local server
- WebSocket updates
- SQLite storage
- MCP server
- live dashboard
- presence tracking
- soft claims
- event timeline
- basic conflict detection
- durable decisions

### Should Have

- file watcher
- Git branch detection
- GitHub PR link support
- decision review UI
- export accepted decisions to AGENTS.md

### Not MVP

- hosted SaaS
- advanced semantic conflict detection
- native IDE plugins
- organization billing
- full chat replay
- automatic code generation

## 18. Suggested Tech Stack

### Backend

Option A:

- Node.js or Bun
- Fastify or Hono
- ws for WebSocket
- SQLite
- Drizzle ORM
- MCP SDK

Option B:

- Go
- SQLite
- Gorilla/WebSocket or nhooyr/websocket
- single binary

Recommended MVP:

> TypeScript + Node/Bun because MCP and web dashboard integration will be faster.

### Frontend

- React
- Vite
- TanStack Query
- WebSocket client
- React Flow for graph/map
- Tailwind or simple CSS modules

### Packaging

- npm package for CLI
- Docker image for server later
- single local command:

```bash
npx suka serve
```

## 19. API Sketch

HTTP:

```text
GET    /api/state
GET    /api/agents
GET    /api/presence
GET    /api/claims
GET    /api/events
GET    /api/decisions
POST   /api/presence
POST   /api/claims
DELETE /api/claims/:id
POST   /api/events
POST   /api/decisions
PATCH  /api/decisions/:id
POST   /api/conflicts/check
```

WebSocket:

```text
presence.updated
claim.created
claim.expired
event.created
decision.proposed
decision.accepted
conflict.detected
```

## 20. Example Agent Flow

Before editing:

```text
Agent calls check_conflicts(["src/billing/webhook.ts"]).
Server returns active claim by another agent.
Agent warns user.
```

Starting task:

```text
Agent calls set_current_task("Add Stripe webhook").
Dashboard updates live.
```

During work:

```text
Agent calls claim_scope(["src/billing/**"], ttl=45m).
Server broadcasts claim.
```

Changing API:

```text
Agent calls publish_event("api_contract_changed", "...").
Server checks if other active tasks may depend on it.
Dashboard shows warning.
```

Finishing:

```text
Agent calls complete_task(summary, changed_paths).
Server updates timeline and releases claims.
```

## 21. Open-Source Strategy

Start as developer-first infra.

Repository structure:

```text
suka/
  apps/
    dashboard/
  packages/
    cli/
    server/
    mcp/
    protocol/
    conflict-engine/
  examples/
    demo-repo/
    codex-instructions/
    cursor-rules/
    claude-code/
  docs/
```

License:

- Apache-2.0 or MIT

Community hooks:

- publish protocol schema
- invite AI tool integrations
- provide MCP templates
- provide hackathon demo kit

## 22. Roadmap

### Phase 0: Prototype

Goal: prove the visual demo.

- CLI can publish events
- dashboard updates live
- simple claims
- fake/simulated agents
- basic conflict warning

### Phase 1: Real MVP

Goal: real developers can use it locally.

- MCP server
- local repo config
- SQLite persistence
- file watcher
- active task tracking
- decision proposals

### Phase 2: Team Mode

Goal: multiple machines connect.

- self-hosted server
- auth token
- shared workspace
- GitHub branch/PR awareness
- event retention

### Phase 3: Better Intelligence

Goal: fewer false positives.

- symbol-level detection
- API contract parsing
- migration parsing
- dependency graph
- relevant-context retrieval

### Phase 4: Ecosystem

Goal: become a standard layer.

- VS Code extension
- Cursor integration
- OpenHands integration
- GitHub app
- hosted optional service
- protocol adoption

## 23. Success Metrics

Developer metrics:

- time saved avoiding duplicate work
- number of detected overlaps
- number of useful conflict warnings
- number of accepted decisions
- number of agents connected per repo

Hackathon metrics:

- demo clarity within 30 seconds
- live dashboard engagement
- number of parallel contributors coordinated

Open-source metrics:

- GitHub stars
- MCP server installs
- integrations contributed
- protocol adopters

## 24. Strong Positioning

Best short pitch:

> Suka is Google Docs-style presence for AI coding agents.

More technical pitch:

> Suka is an open-source realtime coordination protocol, MCP server, and dashboard that lets multiple AI coding agents share active work, claims, decisions, and conflict warnings across the same repository.

Hackathon pitch:

> When everyone is vibe coding with different agents, Suka shows who is building what, where conflicts are happening, and what every agent needs to know next.

## 25. Final Product Principle

Suka should make hidden agent work visible.

The product wins if a developer can open the dashboard and immediately answer:

- Who is active?
- What are they building?
- What files/modules are hot?
- What changed recently?
- What might conflict with my work?
- What decisions should my agent know before editing?
