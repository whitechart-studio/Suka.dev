# Project Configuration

Future Suka repositories should use `.suka/config.json` to define project-specific behavior.

## Planned Configuration

```json
{
  "domains": [
    {
      "id": "billing",
      "name": "Billing",
      "paths": ["src/billing/**"],
      "apis": ["POST /api/payments"]
    }
  ],
  "ignored_paths": ["node_modules/**", "dist/**"],
  "privacy": {
    "publish_file_paths": true,
    "publish_code_content": false
  },
  "mode": "local"
}
```

## Goals

- Let teams define their own domain map.
- Keep generated/vendor files out of coordination state.
- Make privacy behavior explicit.
- Support local, hosted, and self-hosted modes.

