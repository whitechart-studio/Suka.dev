# ADR 0003: Platform Compatibility

## Status

Accepted

## Context

Suka should be useful to teams regardless of operating system. Developers may run agents and editors on Windows, Linux, or macOS. Team members may also monitor coordination from phones or tablets.

## Decision

Suka will support:

- Windows, Linux, and macOS for CLI, MCP server, local server, file watcher, and dashboard access.
- Linux containers as the primary self-hosted deployment target.
- iOS and iPadOS as first-class dashboard/client targets through responsive web/PWA behavior.

iOS is not a target for running the local server, CLI, MCP server, or file watcher. It is a client surface for observing activity, reviewing decisions, and responding to team coordination.

## Engineering Rules

- Normalize repo paths through shared utilities before conflict matching.
- Test both POSIX and Windows-style paths.
- Avoid shell-specific behavior in CLI internals.
- Use Node APIs or library abstractions for filesystem, path, process, and networking behavior.
- Keep Docker and Linux-only deployment assumptions out of local developer workflows.
- Design dashboard layouts for desktop, tablet, and phone widths.
- Account for iOS Safari safe areas, viewport-height behavior, touch targets, and WebSocket reconnect state.

## Consequences

Cross-platform support becomes part of the product quality bar. Some implementation work will take longer, especially file watching, path matching, and local process integration, but this avoids painting Suka into a Linux/macOS-only corner.
