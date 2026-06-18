# ADR 0007: Native Folder Picker and Local Bridge

## Status

Accepted

## Context

Suka needs a premium workflow where a user can select a project folder from the
UI and let Suka track local agent activity for that folder. A normal browser app
cannot freely inspect local folders, process working directories, or long-running
agent sessions. Browser security boundaries are correct: folder access must be
explicit, scoped, and revocable.

The current project registry and Project API support a path-input MVP:

- `POST /api/projects` registers an existing local directory.
- `POST /api/projects/:id/activate` marks one registered project as active.
- `GET /api/projects` and `GET /api/projects/active` expose stored metadata.

That API should remain the stable contract. A future folder picker should feed
the same contract instead of creating a separate project model.

## Options Considered

### Browser File System Access API

Useful for selecting a folder in Chromium-based browsers, but not enough for the
full Suka workflow.

Strengths:

- Native browser picker UX.
- User-granted folder access.
- No extra installer for supported browsers.

Limits:

- Browser support is uneven.
- It exposes file handles to the browser, not process working directories.
- It is not appropriate for background agent/process tracking.
- It does not solve hosted Suka access to a user's local machine.

### Electron or Tauri Shell

Strong candidate for a future desktop app.

Strengths:

- Native folder picker.
- Local process inspection through an owned backend.
- Familiar desktop installation and permission model.
- Can embed the existing dashboard.

Limits:

- Requires packaging, signing, updates, and platform-specific QA.
- Increases product surface area before the core coordination workflow is fully
  proven.

### Native Helper or Local Daemon

Recommended foundation.

Strengths:

- Works with local, self-hosted, and hosted dashboards.
- Keeps privileged local inspection out of the browser.
- Can run as a user-level process without administrator/root permissions.
- Reuses the existing HTTP Project API and pointer publishing model.
- Can later be packaged inside Tauri/Electron without changing server contracts.

Limits:

- Requires lifecycle management: install, start, stop, update, logs.
- Needs clear trust prompts and a local authentication story before hosted mode.

### Browser Extension

Not recommended as the primary path.

Strengths:

- Can bridge browser UI with local context in some environments.
- Familiar install path for browser-based products.

Limits:

- Extension permissions are broad and hard to explain.
- Still needs a native messaging host for process/folder inspection.
- Adds browser-vendor review and compatibility concerns.

### CLI Bridge

Recommended MVP form of the local daemon.

Strengths:

- Already fits Suka's developer audience.
- Cross-platform Node runtime matches the existing codebase.
- Easy to test in CI and run locally.
- Can expose a local-only bridge endpoint or publish directly to the Suka server.

Limits:

- Less polished than a desktop folder picker.
- Requires the user to start a process until packaged as a background helper.

## Decision

Use the existing Project API as the durable project-selection contract and build
the local bridge in layers:

1. Keep the path-input MVP backed by `POST /api/projects`.
2. Add a CLI bridge/daemon that can register and activate a folder, detect local
   agents for the active project, and publish metadata-only presence.
3. Add a native picker only as a thin UI over the same registration flow.
4. Package the bridge later with Tauri or Electron when the product needs a
   desktop-grade install experience.

Hosted Suka still needs a local agent/daemon. A hosted web app cannot and should
not directly inspect a user's machine. The hosted dashboard can coordinate team
state, but local folder tracking must be performed by a user-approved local
process that sends metadata to the chosen Suka server.

## Minimum Bridge Capabilities

The bridge should provide:

- Folder selection or path registration into `POST /api/projects`.
- Active project selection through `POST /api/projects/:id/activate`.
- Local agent detection scoped to the active project root.
- Metadata-only presence publishing for detected agents.
- A health/readiness endpoint for the dashboard.
- Clear status for unsupported OS capabilities.
- Configurable target Suka server URL.
- Local logs that avoid prompts, source contents, terminal output, and secrets.

The bridge must not require:

- Reading source file contents.
- Reading private prompts.
- Reading terminal output.
- Reading raw environment values.
- Administrator or root permissions for normal use.

## Permission and Trust Boundaries

Folder tracking must be explicit. A user action should answer:

- Which folder is being tracked?
- Which Suka server receives metadata?
- Which metadata fields may be published?
- How can tracking be paused or stopped?

Recommended prompt language:

```text
Track this folder with Suka?

Suka will publish coordination metadata such as project path, branch, detected
agent tool, process ID, and current file paths when available. Suka will not
read source contents, prompts, terminal output, environment values, or secrets.
```

The bridge should bind local control endpoints to `127.0.0.1` by default. Hosted
mode must authenticate any browser-to-bridge control flow and should require an
explicit pairing step before sending metadata to a remote workspace.

## Compatibility With the MVP Flow

The path-input flow remains valid. It is the lowest-level project registration
mechanism and should continue to work on Windows, Linux, and macOS.

Future native pickers should return a local path, then call the same server API:

```text
native picker -> selected path -> POST /api/projects -> POST /api/projects/:id/activate
```

This keeps tests, persistence, and dashboard state consistent across CLI,
desktop, hosted, and self-hosted deployments.

## Risks and Mitigations

- Risk: Users assume Suka reads code contents.
  Mitigation: Keep permission copy and docs explicit: metadata only by default.

- Risk: Hosted mode appears able to inspect local machines directly.
  Mitigation: Document the local daemon requirement and require explicit pairing.

- Risk: OS process APIs differ across Windows, Linux, and macOS.
  Mitigation: Keep detection best-effort, report unsupported capabilities, and
  preserve explicit claims/briefs as the source of truth.

- Risk: Desktop packaging slows core product iteration.
  Mitigation: build the CLI bridge first and package it later.

- Risk: Local bridge endpoints become a security boundary.
  Mitigation: bind to localhost, use pairing tokens for hosted control, and avoid
  privileged filesystem/process access.

## Consequences

Suka can provide a useful project selection flow immediately through path input
and the Project API while leaving room for a world-class folder picker later.
The architecture keeps privileged local inspection in a local user-approved
process, not in hosted web code. It also preserves the privacy-first product
line: Suka coordinates context, ownership, and intent without requiring source
contents or secrets.
