---
name: suka-dashboard
description: Dashboard design and frontend implementation guidance for Suka.dev. Use when Codex builds or reviews the Suka web dashboard, Live Room, Repo Map, Timeline, Conflict Radar, Decisions UI, realtime WebSocket state, frontend data modeling, responsive layouts, or visual QA.
---

# Suka Dashboard

## Overview

Use this skill to build the dashboard as Suka's visual command center: dense, professional, realtime, and immediately useful to developers coordinating multiple agents.

## Product Goal

The dashboard must answer these questions within seconds:

- Who is active?
- What are they building?
- Which files/modules are hot?
- What changed recently?
- What might conflict with my work?
- What decisions should agents know before editing?

## Primary Views

Live Room:

- show user, agent/tool, task, status, branch, current files, and freshness
- make stale/expired presence visibly different from active presence
- optimize for scanning, not storytelling

Repo Map:

- visualize folders/modules/domains with overlays for active, claimed, modified, conflict risk, tests failing, and stale decisions
- use stable dimensions so realtime updates do not shift layout

Timeline:

- realtime event stream
- include source agent/tool, event type, affected scope, and time
- preserve readability at hackathon-demo speed

Conflict Radar:

- rank warnings by severity
- explain the reason plainly
- show impacted agents/tasks and affected paths/APIs/domains
- provide an empty state that still teaches the data model through structure, not visible instructions

Decisions:

- split proposed, accepted, stale, and deprecated decisions
- surface evidence paths
- make accepted decisions feel durable and auditable

## Design Direction

- Make it feel like serious developer infrastructure, not a marketing landing page.
- Prefer quiet density, strong hierarchy, readable tables, restrained cards, and purposeful color.
- Avoid large hero sections, decorative blobs, one-note color palettes, and oversized empty surfaces.
- Use icons for repeated controls when an icon exists.
- Keep cards for repeated objects and modals only. Do not nest cards.
- Do not put explanatory product copy inside the app unless it is needed as a label, state, or action.
- Ensure text never overlaps or spills out of buttons, cards, table cells, badges, or panels.
- Support desktop browsers, tablet browsers, and iOS Safari. Treat iPhone/iPad dashboard usage as a real operational view, not an afterthought.

## Realtime State Rules

- Bootstrap from `/api/state`.
- Subscribe to WebSocket events after initial state loads.
- Reconcile events by pointer ID and server timestamp.
- Handle reconnects by refetching `/api/state`.
- Render offline/reconnecting state without clearing the current view.
- Keep fixtures for dashboard states: empty, active, conflict, test failure, stale presence, and decisions.

## Visual QA

Before finishing frontend work:

- run the relevant build/test command
- open the app in the in-app browser when available
- verify desktop and mobile widths
- verify iOS Safari constraints in design: touch targets, safe areas, viewport height behavior, and WebSocket reconnect visibility
- verify realtime updates do not cause layout jumps
- inspect empty, loaded, and conflict states
- check contrast and text fitting

## Reference

Load `references/dashboard-information-architecture.md` when designing or reviewing view layout.
