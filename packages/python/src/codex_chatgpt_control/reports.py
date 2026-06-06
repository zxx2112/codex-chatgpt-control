from __future__ import annotations

from typing import Any

from .commands import wire_kwargs
from .models import CommandResult
from .primitives import command_result


class ReportsClient:
    def __init__(self, backend: Any) -> None:
        self._backend = backend

    def create(self, result: dict[str, Any], **kwargs: Any) -> CommandResult:
        payload: dict[str, Any] = {"result": result}
        args = wire_kwargs(**kwargs)
        if args:
            payload["args"] = args
        return command_result(self._backend, "reports.create", payload)

    def redact(self, value: Any, **kwargs: Any) -> CommandResult:
        payload: dict[str, Any] = {"value": value}
        args = wire_kwargs(**kwargs)
        if args:
            payload["args"] = args
        return command_result(self._backend, "reports.redact", payload)

    def summarize(self, result: dict[str, Any], **kwargs: Any) -> CommandResult:
        payload: dict[str, Any] = {"result": result}
        args = wire_kwargs(**kwargs)
        if args:
            payload["args"] = args
        return command_result(self._backend, "reports.summarize", payload)
