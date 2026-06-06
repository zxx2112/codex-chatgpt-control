from __future__ import annotations

from _backend import create_backend
from codex_chatgpt_control import ChatGPT


def main() -> None:
    backend = create_backend()
    chatgpt = ChatGPT(backend=backend)

    try:
        response = chatgpt.responses.create(
            {
                "input": "Reply with the word hi.",
                "thread": {"type": "new"},
                "text": {"format": "markdown"},
                "stream": False,
            }
        )
        print(response.status)
        print(response.output_text)

        unsupported = chatgpt.responses.create(
            {
                "input": "Reply with hi.",
                "temperature": 0.2,
            }
        )
        print(unsupported.status)
        for field in unsupported.unsupported_fields:
            print(field["path"])
    finally:
        backend.close()


if __name__ == "__main__":
    main()
