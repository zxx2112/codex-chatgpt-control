from __future__ import annotations

import asyncio

from _backend import create_backend
from codex_chatgpt_control import Agent, Runner


def run_sync_example() -> None:
    backend = create_backend()
    runner = Runner(backend)
    agent = Agent(name="python-sync-reviewer", instructions="Reply briefly.")
    try:
        result = runner.run_sync(
            agent,
            {
                "input": "Reply with the word hi.",
                "thread": {"type": "new"},
                "response": {"format": "markdown"},
            },
        )
        print(result.status)
        print(result.output_text)
    finally:
        backend.close()


async def run_async_example() -> None:
    backend = create_backend()
    runner = Runner(backend)
    agent = Agent(name="python-async-reviewer", instructions="Reply briefly.")
    try:
        result = await runner.run(
            agent,
            {
                "input": "Reply with the word hi.",
                "thread": {"type": "new"},
                "response": {"format": "markdown"},
            },
        )
        print(result.status)
        print(result.output_text)
    finally:
        backend.close()


if __name__ == "__main__":
    run_sync_example()
    asyncio.run(run_async_example())
