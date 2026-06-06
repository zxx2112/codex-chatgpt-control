from __future__ import annotations

import inspect
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, Protocol

from .agent import Agent
from .models import BackendEvent, ChatGPTRunResult, ChatGPTRunState, SequencePlan


RunResult = ChatGPTRunResult
RunState = ChatGPTRunState


class RunnerBackend(Protocol):
    def runner_run(self, agent: dict[str, Any], input: Any) -> dict[str, Any]:
        ...

    def runner_plan(self, agent: dict[str, Any], input: Any) -> dict[str, Any]:
        ...

    def runner_stream(self, agent: dict[str, Any], input: Any) -> Iterator[dict[str, Any]]:
        ...


@dataclass
class RunResultStreaming:
    _events: Iterator[dict[str, Any]]
    final_result: ChatGPTRunResult | None = None

    def __iter__(self) -> "RunResultStreaming":
        return self

    def __next__(self) -> BackendEvent:
        event = BackendEvent.from_wire(next(self._events))
        if event.type == "completed" and isinstance(event.result, ChatGPTRunResult):
            self.final_result = event.result
        return event


class Runner:
    def __init__(self, backend: Any) -> None:
        self._backend = backend

    async def run(self, agent: Agent, input: Any) -> ChatGPTRunResult:
        result = self._backend.runner_run(agent.to_wire(), input)
        if inspect.isawaitable(result):
            result = await result
        return ChatGPTRunResult.from_wire(result)

    def run_sync(self, agent: Agent, input: Any) -> ChatGPTRunResult:
        return ChatGPTRunResult.from_wire(self._backend.runner_run(agent.to_wire(), input))

    def plan(self, agent: Agent, input: Any) -> SequencePlan:
        return SequencePlan.from_wire(self._backend.runner_plan(agent.to_wire(), input))

    def run_streamed(self, agent: Agent, input: Any) -> RunResultStreaming:
        return RunResultStreaming(iter(self._backend.runner_stream(agent.to_wire(), input)))
