---
title: Safety
date: 2026-06-06
type: reference
status: draft
---

# Safety

The SDK should preserve the user's agency and visibility.

- Submit only user-approved prompts and files.
- Prefer fresh, agent-owned tabs or threads for live smokes when possible.
- Return structured blockers instead of retrying blindly when login, captcha, permission, rate-limit, selector drift, or bridge availability problems occur.
- Redact run reports by default.
- Treat ChatGPT output as model judgment, not verified truth.

The SDK must not use hidden endpoints, bypass authentication, scrape private sessions, or hide actions from the user.
