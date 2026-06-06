from __future__ import annotations

from typing import Any

from .commands import wire_kwargs
from .models import CommandResult
from .primitives import command_result


class WorkflowClient:
    def __init__(self, backend: Any) -> None:
        self._backend = backend

    def ask(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "ask", wire_kwargs(**kwargs))

    def ask_in_thread(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "askInThread", wire_kwargs(**kwargs))

    def ask_with_files(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "askWithFiles", wire_kwargs(**kwargs))

    def ask_and_download(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "askAndDownload", wire_kwargs(**kwargs))

    def run_messages(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "runMessages", wire_kwargs(**kwargs))

    def open_thread(self, thread: dict[str, Any]) -> CommandResult:
        return command_result(self._backend, "openThread", thread)

    def read_latest(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "readLatest", wire_kwargs(**kwargs))

    def copy_latest(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "copyLatest", wire_kwargs(**kwargs))

    def download_latest(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "downloadLatest", wire_kwargs(**kwargs))

    def run_plan(self, plan: dict[str, Any]) -> CommandResult:
        return command_result(self._backend, "runPlan", plan)

    def doctor(self, **kwargs: Any) -> CommandResult:
        return command_result(self._backend, "doctor", wire_kwargs(**kwargs))

    def create_report(self, result: dict[str, Any], **kwargs: Any) -> CommandResult:
        payload: dict[str, Any] = {"result": result}
        args = wire_kwargs(**kwargs)
        if args:
            payload["args"] = args
        return command_result(self._backend, "createReport", payload)
