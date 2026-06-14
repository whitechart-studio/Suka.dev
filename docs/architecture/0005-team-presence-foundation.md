# ADR 0005: Team Presence Foundation

## Status

Accepted

## Context

Suka needs to show how users and agents are connected before hosted workspaces
exist. The dashboard already visualizes presence, claims, events, and decisions,
but it does not expose a first-class team/workspace summary that clients can use
to answer who is connected, which workspace they belong to, and which sessions
are active.

## Decision

Derive team presence from existing structured pointers instead of introducing a
separate account system.

The server exposes `/api/team`, which summarizes:

- active agents
- workspace IDs
- repo IDs
- session IDs
- claim, event, and decision counts per workspace
- member metadata from presence pointers

Realtime mutations broadcast `team.updated` after state-changing pointer
operations so clients can refresh team surfaces without inventing their own
summary logic.

## Consequences

Suka can now present a real team connection surface in local mode while staying
compatible with hosted mode later. The protocol remains privacy-preserving
because the summary is built from existing metadata and does not store prompts,
terminal logs, secrets, or code content.
