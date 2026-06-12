# Getting Started

## Requirements

- Node.js 20 or newer.
- npm.
- Git.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Run Tests

```bash
npm test
```

## Start the Local Server

```bash
SUKA_PORT=4366 SUKA_DATA_FILE=.suka/state.json node packages/server/dist/bin.js
```

Open:

```text
http://127.0.0.1:4366/
```

## Development Loop

Recommended local loop:

```bash
npm run typecheck
npm run build
npm test
```

For dashboard visual QA:

```bash
PLAYWRIGHT_MODULE_DIR=/path/to/node_modules node scripts/dashboard-visual-qa.mjs
```

The Codex desktop runtime can provide the Playwright module path during local development.

