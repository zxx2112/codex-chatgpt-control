from __future__ import annotations

from _backend import create_backend
from codex_chatgpt_control import Agent, Runner


def main() -> None:
    backend = create_backend()
    runner = Runner(backend)
    agent = Agent(
        name="python-stream-reviewer",
        defaults={
            "wait": {"timeoutMs": 120000, "stableMs": 2000},
            "read": {"format": "markdown"},
        },
    )

    try:
        stream = runner.run_streamed(
            agent,
            {
                "input": "Reply with the word hi.",
                "thread": {"type": "new"},
                "response": {"format": "markdown"},
            },
        )
        for event in stream:
            if event.name is not None:
                print(event.name)

        if stream.final_result is not None:
            print(stream.final_result.status)
            print(stream.final_result.output_text)
    finally:
        backend.close()


if __name__ == "__main__":
    main()
