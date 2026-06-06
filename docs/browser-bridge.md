---
title: Browser Bridge
date: 2026-06-06
type: reference
status: draft
---

# Browser Bridge

Browser-required operations need a compatible bridge that exposes a visible ChatGPT tab to the SDK runtime.

Ordinary shell runs are still useful. They validate the backend protocol and should produce structured `browser_bridge_unavailable` blockers for commands that require a real browser.

When using a Codex-hosted browser bridge, initialize the bridge in the host runtime, then pass that agent object to `createChatGPT({ agent })`. Keep bridge-hosted backend processes alive while Python clients call through relays; if the host call exits, browser operations can lose their execution context.
