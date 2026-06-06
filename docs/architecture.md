---
title: Architecture
date: 2026-06-06
type: reference
status: draft
---

# Architecture

`codex-chatgpt-control` is a visible-session SDK, not an API wrapper.

```text
Codex agent -> SDK runner -> browser bridge -> visible chatgpt.com session
```

The Node package owns browser automation, DOM interpretation, response capture, redaction, contract fixtures, and the local backend server. The Python package talks to that backend through a versioned protocol so Python can share runner semantics without duplicating browser-control logic.

The public contract lives under `packages/node/contracts/v1`. Tests in both languages validate that fixtures and model shapes stay aligned.
