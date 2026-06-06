from __future__ import annotations

from typing import Any

from .models import CommandDescriptor


def request_backend(backend: Any, command: str, payload: dict[str, Any] | None = None) -> Any:
    request = getattr(backend, "request", None)
    if not callable(request):
        raise RuntimeError(f"This ChatGPT backend does not support {command}.")
    return request(command, payload or {})


def wire_kwargs(**kwargs: Any) -> dict[str, Any]:
    return {
        snake_to_camel(key): value
        for key, value in kwargs.items()
        if value is not None
    }


def snake_to_camel(key: str) -> str:
    head, *tail = key.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


class CommandClient:
    def __init__(self, backend: Any) -> None:
        self._backend = backend

    def commands(self, *, layer: str | None = None) -> list[CommandDescriptor]:
        payload: dict[str, Any] = {}
        if layer is not None:
            payload["filter"] = {"layer": layer}
        result = request_backend(self._backend, "commands", payload)
        if not isinstance(result, list):
            raise RuntimeError("commands backend result must be a list.")
        return [CommandDescriptor.from_wire(item) for item in result]

    def describe(self, name: str) -> CommandDescriptor:
        result = request_backend(self._backend, "describe", {"name": name})
        if not isinstance(result, dict):
            raise RuntimeError("describe backend result must be a command descriptor.")
        return CommandDescriptor.from_wire(result)

    def help(self, topic: str | None = None) -> str:
        payload = {} if topic is None else {"topic": topic}
        result = request_backend(self._backend, "help", payload)
        if not isinstance(result, str):
            raise RuntimeError("help backend result must be a string.")
        return result
