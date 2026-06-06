---
title: Troubleshooting
date: 2026-06-06
type: reference
status: draft
---

# Troubleshooting

## `browser_bridge_unavailable`

Expected from ordinary shells. Use it as a diagnostic that the command failed safely before touching browser state.

For a real browser run, verify:

- Chrome is open and signed in to ChatGPT.
- The host runtime exposes `globalThis.agent`.
- The browser bridge can claim or open a visible ChatGPT tab.

## Python Backend Bundle Missing

Run from `packages/node`:

```bash
npm ci
npm run bundle:backend
```

Then rerun the Python smoke from `packages/python`.

## Selector Drift

Treat selector drift as a product-change blocker. Capture the smallest public-safe reproduction and update selectors/tests together.

## File Upload Blocked

Check both permission gates:

1. Chrome `chrome://extensions` > Codex/browser bridge extension > **Details** > **Allow access to file URLs**.
2. Codex settings > **Computer Use > Google Chrome > Permissions > Uploads**.

The SDK should report a structured permission blocker when either gate is missing. Do not retry uploads repeatedly without changing the permission state.
