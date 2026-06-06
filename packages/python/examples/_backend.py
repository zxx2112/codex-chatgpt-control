from __future__ import annotations

import os
import shlex
from pathlib import Path

from codex_chatgpt_control import BackendClient, StdioBackendTransport


WORK_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BACKEND = WORK_ROOT / "node" / "dist" / "codex-chatgpt-control-backend.mjs"
BACKEND_COMMAND_ENV = "CHATGPT_BROWSER_BACKEND_COMMAND"


def backend_command() -> list[str]:
    command = os.environ.get(BACKEND_COMMAND_ENV)
    if command:
        return shlex.split(command)
    return ["node", str(DEFAULT_BACKEND)]


def create_backend() -> BackendClient:
    return BackendClient(StdioBackendTransport(command=backend_command()))
