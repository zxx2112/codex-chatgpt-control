---
title: Release Process
date: 2026-06-06
type: runbook
status: draft
---

# Release Process

## Source Alpha

1. Keep the repository public and packages unpublished.
2. Run deterministic Node and Python parity gates.
3. Verify no live reports, thread URLs, credentials, or local paths are committed.

## npm Alpha

1. Remove `"private": true` from `packages/node/package.json`.
2. Run `npm pack --dry-run --json` and inspect the allowlist.
3. Install the packed tarball in a fresh temp project.
4. Publish with an alpha tag only after trusted publishing or login is ready.

## PyPI Alpha

1. Build wheel and sdist from `packages/python`.
2. Run `twine check`.
3. Install the wheel in a fresh virtual environment.
4. Publish `0.1.0a1` only after the backend distribution story is documented and tested.
